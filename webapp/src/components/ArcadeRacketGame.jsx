import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/**
 * Ultra-table-tennis arcade experience.
 * The logic is rewritten from scratch with a modular layout that mirrors
 * high-end mobile racket games: input abstraction, ballistics, spin model,
 * AI planning, camera choreography, and rally/serve orchestration.
 */

const GAME_CONFIGS = {
  tennis: {
    courtL: 23.77,
    courtW: 9.2,
    netHeight: 1.2,
    ballRadius: 0.2,
    tableHeight: 0,
    playerZOffset: 1.5,
    cameraHeight: 9,
    cameraOffset: 16,
    background: 0x134e2a,
    groundColor: 0x1f7a3a,
    playerColor: 0x00b4ff,
    enemyColor: 0xff3b3b,
    ballColor: 0xffeb3b,
  },
  tabletennis: {
    courtL: 2.74,
    courtW: 1.525,
    netHeight: 0.1525,
    ballRadius: 0.04,
    tableHeight: 0.76,
    playerZOffset: 0.28,
    cameraHeight: 2.4,
    cameraOffset: 4.2,
    background: 0x0d3b1e,
    groundColor: 0x1a4d2d,
    playerColor: 0x22c55e,
    enemyColor: 0xef4444,
    ballColor: 0xfff1c0,
  },
};

function useGoalRushToast(initialText) {
  const [toast, setToast] = useState(initialText);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  return [toast, setToast];
}

class Smoother {
  constructor(alpha = 0.2) {
    this.alpha = alpha;
    this.value = 0;
  }

  update(target, dt) {
    const blend = 1 - Math.pow(1 - this.alpha, dt * 60);
    this.value += (target - this.value) * blend;
    return this.value;
  }
}

class RollingAverage {
  constructor(size = 6) {
    this.values = new Array(size).fill(0);
    this.index = 0;
    this.filled = 0;
  }

  push(v) {
    this.values[this.index] = v;
    this.index = (this.index + 1) % this.values.length;
    this.filled = Math.min(this.filled + 1, this.values.length);
  }

  mean() {
    if (!this.filled) return 0;
    const sum = this.values.reduce((a, b) => a + b, 0);
    return sum / this.filled;
  }
}

class InputController {
  constructor(targetMesh, xConverter, gameplayMode) {
    this.mesh = targetMesh;
    this.xConverter = xConverter;
    this.gameplayMode = gameplayMode;
    this.state = {
      active: false,
      startX: 0,
      startY: 0,
      lastX: 0,
      lastY: 0,
      startT: 0,
      lerpFactor: gameplayMode === 'tabletennis' ? 0.44 : 0.32,
    };
  }

  begin(clientX, clientY) {
    this.state.active = true;
    this.state.startX = clientX;
    this.state.startY = clientY;
    this.state.lastX = clientX;
    this.state.lastY = clientY;
    this.state.startT = Date.now();
    this.mesh.position.x = this.xConverter(clientX);
  }

  track(clientX, clientY) {
    this.state.lastX = clientX;
    this.state.lastY = clientY;
    const targetX = this.xConverter(clientX);
    this.mesh.position.x += (targetX - this.mesh.position.x) * this.state.lerpFactor;
  }

  swipeMetrics(endX, endY) {
    const resolvedX = endX ?? this.state.lastX;
    const resolvedY = endY ?? this.state.lastY;
    const swipeTime = Math.max((Date.now() - this.state.startT) / 1000, 0.1);
    return {
      distX: resolvedX - this.state.startX,
      distY: this.state.startY - resolvedY,
      swipeTime,
    };
  }

  finish(endX, endY) {
    const swipe = this.swipeMetrics(endX, endY);
    this.state.active = false;
    return swipe;
  }
}

class CameraRig {
  constructor(camera, cfg, halfW, halfL, mode) {
    this.camera = camera;
    this.cfg = cfg;
    this.halfW = halfW;
    this.halfL = halfL;
    this.mode = mode;
    this.target = new THREE.Vector3();
    this.lookAt = new THREE.Vector3();
    this.followStrength = mode === 'tabletennis' ? 0.26 : 0.16;
  }

  snap(ballPosition) {
    this.camera.position.set(0, this.cfg.tableHeight + this.cfg.cameraHeight, ballPosition.z + this.cfg.cameraOffset);
    this.camera.lookAt(ballPosition.x, this.cfg.tableHeight + this.cfg.ballRadius, ballPosition.z);
  }

  update(dt, ballPosition, ballVelocity, rallyStarted) {
    const yLift = this.cfg.tableHeight + THREE.MathUtils.lerp(
      this.cfg.cameraHeight,
      this.cfg.cameraHeight * 0.68,
      Math.min((ballPosition.y - this.cfg.tableHeight) * 0.45, 1)
    );
    const depthLead = rallyStarted ? THREE.MathUtils.clamp(ballVelocity.z * 0.24, -2.4, 3.8) : 0;
    const cameraDepth = Math.max(ballPosition.z + depthLead, 0) + this.cfg.cameraOffset * (this.mode === 'tabletennis' ? 0.72 : 0.94);
    const maxDepth = this.halfL - this.cfg.playerZOffset + this.cfg.cameraOffset * 0.4;
    this.target.set(
      THREE.MathUtils.clamp(ballPosition.x * 0.92, -this.halfW, this.halfW),
      yLift,
      THREE.MathUtils.clamp(cameraDepth, this.cfg.tableHeight + this.cfg.ballRadius + 0.12, maxDepth)
    );
    this.camera.position.lerp(this.target, this.#blend(this.followStrength, dt));
    this.lookAt.set(
      ballPosition.x,
      Math.max(this.cfg.tableHeight + this.cfg.ballRadius * 1.6, ballPosition.y),
      Math.max(ballPosition.z, 0)
    );
    this.camera.lookAt(this.lookAt);
  }

  #blend(alphaPerStep, dt) {
    return 1 - Math.pow(1 - alphaPerStep, dt / (1 / 60));
  }
}

class ShotPlanner {
  constructor(cfg, baseConfig, mode) {
    this.cfg = cfg;
    this.baseConfig = baseConfig;
    this.mode = mode;
    this.forwardMin = mode === 'tabletennis' ? 3.8 : 4.8;
    this.forwardMax = mode === 'tabletennis' ? 11.4 : 14.4;
    this.liftMin = mode === 'tabletennis' ? 2.5 : 3.2;
    this.liftMax = mode === 'tabletennis' ? 8.2 : 9.4;
    this.lateralClampBase = mode === 'tabletennis' ? 1.1 : 1.6;
    this.lateralScaleFactor = mode === 'tabletennis' ? 0.2 : 0.22;
  }

  swipeToShot(distX, distY, swipeTime, towardsEnemy = true) {
    const lateralScale = this.cfg.courtW / this.baseConfig.courtW;
    const forwardScale = this.cfg.courtL / this.baseConfig.courtL;

    const swipeT = Math.max(swipeTime, 0.08);
    const speed = Math.hypot(distX, distY) / swipeT;
    const minSwipe = this.mode === 'tabletennis' ? 110 : 220;
    const maxSwipe = this.mode === 'tabletennis' ? 900 : 1400;
    const clamped = THREE.MathUtils.clamp(speed, minSwipe * 0.6, maxSwipe * 1.1);
    const normalized = THREE.MathUtils.clamp((clamped - minSwipe * 0.6) / (maxSwipe * 1.1 - minSwipe * 0.6), 0, 1);

    const forward = THREE.MathUtils.lerp(this.forwardMin, this.forwardMax, normalized) * forwardScale;
    const lift = THREE.MathUtils.lerp(this.liftMin, this.liftMax, normalized);
    const lateralInfluence = THREE.MathUtils.clamp(distX / Math.max(Math.abs(distY), 80), -this.lateralClampBase, this.lateralClampBase);
    const lateral = THREE.MathUtils.clamp(
      lateralInfluence * forward * this.lateralScaleFactor,
      -3.2 * lateralScale,
      3.2 * lateralScale
    );

    return {
      forward: towardsEnemy ? -forward : forward,
      lift,
      lateral,
      normalized,
    };
  }
}

class SpinModel {
  constructor() {
    this.vector = new THREE.Vector3(0, 0, 0);
  }

  set(side, top, back) {
    this.vector.set(side, top, back);
  }

  clear() {
    this.vector.set(0, 0, 0);
  }

  applyMagnus(velocity, magFactor, dt) {
    if (!magFactor) return;
    const c = new THREE.Vector3().copy(this.vector).cross(velocity);
    velocity.addScaledVector(c, magFactor * dt);
  }

  dampen(amount) {
    this.vector.multiplyScalar(amount);
  }
}

class BallPhysics {
  constructor(cfg, mode) {
    this.cfg = cfg;
    this.mode = mode;
    this.ball = new THREE.Mesh(
      new THREE.SphereGeometry(cfg.ballRadius, 24, 16),
      new THREE.MeshStandardMaterial({ color: cfg.ballColor })
    );
    this.velocity = new THREE.Vector3();
    this.previous = new THREE.Vector3();
    this.spin = new SpinModel();
    this.clockDilation = new Smoother(0.22);
    this.gravity = mode === 'tabletennis' ? -9.81 : -16.5;
    this.airDrag = mode === 'tabletennis' ? 0.15 : 0;
    this.magnus = mode === 'tabletennis' ? 0.00076 : 0.0002;
    this.airDecay = mode === 'tabletennis' ? 1 : 0.9945;
    this.tableRestitution = mode === 'tabletennis' ? 0.9 : 0.92;
    this.wallRebound = mode === 'tabletennis' ? 0.82 : 0.7;
    this.netThickness = mode === 'tabletennis' ? 0.012 : 0.1;
    this.floorFriction = 0.935;
    this.maxSubsteps = 8;
  }

  resetAt(pos) {
    this.ball.position.copy(pos);
    this.velocity.set(0, 0, 0);
    this.previous.copy(pos);
    this.spin.clear();
  }

  addImpulse(vec) {
    this.velocity.add(vec);
  }

  setSpin(x, y, z) {
    this.spin.set(x, y, z);
  }

  #blend(alphaPerStep, dt) {
    return 1 - Math.pow(1 - alphaPerStep, dt / (1 / 60));
  }

  #applyAirDrag(dt) {
    if (!this.airDrag) return;
    const k = 1 / (1 + this.airDrag * dt);
    this.velocity.multiplyScalar(k);
  }

  #handleNetCollision(predicted, halfW) {
    const crossedNet = this.previous.z >= 0 !== predicted.z >= 0;
    if (
      (Math.abs(predicted.z) < this.netThickness || crossedNet) &&
      predicted.y <= this.cfg.tableHeight + this.cfg.netHeight + this.cfg.ballRadius * 1.4
    ) {
      const sign = predicted.z >= 0 ? 1 : -1;
      predicted.z = (this.netThickness + this.cfg.ballRadius * 1.25) * sign;
      this.velocity.z = -Math.abs(this.velocity.z) * this.wallRebound * sign;
      this.velocity.y = Math.abs(this.velocity.y) * 0.62;
      this.spin.dampen(0.88);
    }
  }

  integrate(dt, opts) {
    const { halfW, halfL, onOutOfBounds, onGroundContact } = opts;
    const steps = Math.min(this.maxSubsteps, Math.max(1, Math.ceil(dt / (1 / 120))));
    const stepDt = Math.min(dt / steps, 1 / 60);

    for (let i = 0; i < steps; i += 1) {
      this.previous.copy(this.ball.position);
      this.#applyAirDrag(stepDt);
      this.spin.applyMagnus(this.velocity, this.magnus, stepDt);
      this.velocity.multiplyScalar(Math.pow(this.airDecay, stepDt / (1 / 60)));
      this.velocity.y += this.gravity * stepDt;

      const predicted = new THREE.Vector3().copy(this.ball.position).addScaledVector(this.velocity, stepDt);
      const inCourt = Math.abs(predicted.x) <= halfW && Math.abs(predicted.z) <= halfL;

      this.#handleNetCollision(predicted, halfW);

      if (Math.abs(predicted.x) > halfW - this.cfg.ballRadius * 1.1) {
        predicted.x = THREE.MathUtils.clamp(predicted.x, -halfW + this.cfg.ballRadius * 1.05, halfW - this.cfg.ballRadius * 1.05);
        this.velocity.x *= -this.wallRebound;
      }

      const floorY = this.cfg.tableHeight + this.cfg.ballRadius;
      if (predicted.y <= floorY) {
        if (inCourt) {
          predicted.y = floorY;
          this.velocity.y = Math.abs(this.velocity.y) * this.tableRestitution;
          this.velocity.x *= this.floorFriction;
          this.velocity.z *= this.floorFriction;
          this.spin.dampen(0.86);
          if (onGroundContact) onGroundContact();
        } else {
          this.velocity.set(0, 0, 0);
          if (onOutOfBounds) onOutOfBounds();
          return;
        }
      }

      this.ball.position.copy(predicted);
      const clippedOut = Math.abs(this.ball.position.z) > halfL + 0.5 || this.ball.position.y < -1;
      if (clippedOut) {
        this.velocity.set(0, 0, 0);
        this.spin.clear();
        if (onOutOfBounds) onOutOfBounds();
        return;
      }
    }
  }
}

class RallyManager {
  constructor(cfg, halfL, playerZOffset, setToast) {
    this.cfg = cfg;
    this.halfL = halfL;
    this.playerZOffset = playerZOffset;
    this.server = 'player';
    this.score = { player: 0, enemy: 0 };
    this.setToast = setToast;
  }

  nextServer() {
    this.server = this.server === 'player' ? 'enemy' : 'player';
  }

  rallyOver(winner, resetFn) {
    this.score[winner] += 1;
    this.setToast(`${winner === 'player' ? 'You' : 'AI'} score! Swipe to continue`);
    this.nextServer();
    resetFn(false);
  }

  spawnPosition() {
    const serverIsPlayer = this.server === 'player';
    const zOffset = serverIsPlayer ? this.halfL - this.playerZOffset - 0.28 : -this.halfL + this.playerZOffset + 0.28;
    return new THREE.Vector3(0, this.cfg.tableHeight + this.cfg.ballRadius + 0.25, zOffset);
  }
}

class OpponentBrain {
  constructor(cfg, halfW, halfL, mode) {
    this.cfg = cfg;
    this.halfW = halfW;
    this.halfL = halfL;
    this.mode = mode;
    this.reaction = mode === 'tabletennis' ? 0.23 : 0.18;
    this.errorRate = mode === 'tabletennis' ? 0.08 : 0.16;
    this.driveBias = mode === 'tabletennis' ? 1.05 : 0.9;
    this.swing = 0;
    this.biasSampler = new RollingAverage(5);
  }

  planReturn(ball, velocity, playerX) {
    const travel = Math.abs((this.halfL - Math.abs(ball.z)) / Math.max(Math.abs(velocity.z), 0.01));
    const predictedX = THREE.MathUtils.clamp(ball.x + velocity.x * travel * 0.96, -this.halfW, this.halfW);
    const error = (Math.random() - 0.5) * this.errorRate * this.halfW;
    this.biasSampler.push(error);
    const smoothedError = this.biasSampler.mean();
    return predictedX + smoothedError * 0.6 + (playerX - ball.x) * 0.16;
  }

  shouldSwing(ball, velocity) {
    const hitWindow = Math.max(this.halfW * 0.08, this.cfg.ballRadius * 8);
    const approaching = velocity.z < 0 && ball.z < -hitWindow * 0.15;
    return approaching && Math.abs(ball.z + this.halfL - this.cfg.playerZOffset) < hitWindow;
  }

  executeSwing(ball, velocity, targetX) {
    const aiPower = THREE.MathUtils.clamp(12 + Math.abs(velocity.z) * 0.4, 10, 22);
    const forwardScale = this.cfg.courtL / GAME_CONFIGS.tennis.courtL;
    const aimForward = THREE.MathUtils.clamp((Math.abs(velocity.z) + 4) * (aiPower / 12) * this.driveBias, 6 * forwardScale, 13.6 * forwardScale);
    const aimLateral = THREE.MathUtils.clamp((targetX - ball.x) * 1.05, -2.8, 2.8);
    const lift = THREE.MathUtils.clamp(3.6 + aiPower * 0.1 + Math.random() * 1.1, 3.2, 9.2);
    const nextVelocity = new THREE.Vector3(aimLateral, lift, Math.abs(aimForward));

    const spin = new SpinModel();
    if (this.mode === 'tabletennis') {
      const sideSpin = THREE.MathUtils.clamp((Math.random() - 0.5) * 220, -200, 200);
      const topSpin = THREE.MathUtils.clamp((0.45 + Math.random()) * 160, 60, 200);
      spin.set(0, sideSpin, topSpin);
    }
    this.swing = 1.05;
    return { velocity: nextVelocity, spin };
  }
}

function installPointerListeners(renderer, input, launchFn) {
  function onPointerDown(e) {
    const t = e.touches ? e.touches[0] : e;
    if (!t) return;
    input.begin(t.clientX, t.clientY);
  }

  function onPointerUp(e) {
    const end = e.changedTouches ? e.changedTouches[0] : e;
    if (!input.state.active) return;
    const swipe = input.finish(end?.clientX, end?.clientY);
    launchFn(swipe);
  }

  function onPointerMove(e) {
    const t = e.touches ? e.touches[0] : e;
    if (!t || !input.state.active) return;
    input.track(t.clientX, t.clientY);
  }

  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointerup', onPointerUp);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('touchstart', onPointerDown, { passive: true });
  renderer.domElement.addEventListener('touchend', onPointerUp, { passive: true });
  renderer.domElement.addEventListener('touchmove', onPointerMove, { passive: true });

  function isInsideCanvas(touch) {
    const rect = renderer.domElement.getBoundingClientRect();
    return touch.clientX >= rect.left && touch.clientX <= rect.right && touch.clientY >= rect.top && touch.clientY <= rect.bottom;
  }

  function onDocumentTouchStart(e) {
    const t = e.touches?.[0];
    if (!t || !isInsideCanvas(t)) return;
    input.begin(t.clientX, t.clientY);
  }

  function onDocumentTouchEnd(e) {
    const t = e.changedTouches?.[0];
    if (!input.state.active || !t) return;
    const swipe = input.finish(t.clientX, t.clientY);
    launchFn(swipe);
  }

  document.addEventListener('touchstart', onDocumentTouchStart, { passive: true });
  document.addEventListener('touchend', onDocumentTouchEnd, { passive: true });

  return () => {
    renderer.domElement.removeEventListener('pointerdown', onPointerDown);
    renderer.domElement.removeEventListener('pointerup', onPointerUp);
    renderer.domElement.removeEventListener('pointermove', onPointerMove);
    renderer.domElement.removeEventListener('touchstart', onPointerDown);
    renderer.domElement.removeEventListener('touchend', onPointerUp);
    renderer.domElement.removeEventListener('touchmove', onPointerMove);
    document.removeEventListener('touchstart', onDocumentTouchStart);
    document.removeEventListener('touchend', onDocumentTouchEnd);
  };
}

const BASE_CONFIG = GAME_CONFIGS.tennis;

export default function ArcadeRacketGame({ mode = 'tennis', title, stakeLabel, trainingMode = false }) {
  const mountRef = useRef(null);
  const [toast, setToast] = useGoalRushToast(trainingMode ? 'Training Mode · Swipe to serve' : 'Swipe UP to shoot');

  useEffect(() => {
    const cfg = GAME_CONFIGS[mode] || GAME_CONFIGS.tennis;
    const container = mountRef.current;
    if (!container) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(cfg.background);

    let width = Math.max(1, container.clientWidth);
    let height = Math.max(1, container.clientHeight);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 5000);
    camera.position.set(0, cfg.tableHeight + cfg.cameraHeight, cfg.cameraOffset);
    camera.lookAt(0, cfg.tableHeight, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.62));
    const sun = new THREE.DirectionalLight(0xffffff, 1.05);
    sun.position.set(0, 80, 60);
    scene.add(sun);

    const apron = mode === 'tennis' ? 4 : 0.8;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(cfg.courtW + apron, cfg.courtL + apron), new THREE.MeshStandardMaterial({ color: cfg.groundColor }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = cfg.tableHeight;
    scene.add(ground);

    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const halfL = cfg.courtL / 2;
    const halfW = cfg.courtW / 2;
    function addLine(w, h, x, z) {
      const l = new THREE.Mesh(new THREE.PlaneGeometry(w, h), lineMat);
      l.rotation.x = -Math.PI / 2;
      l.position.set(x, cfg.tableHeight + 0.01, z);
      scene.add(l);
    }

    addLine(cfg.courtW, 0.04, 0, halfL);
    addLine(cfg.courtW, 0.04, 0, -halfL);
    addLine(0.04, cfg.courtL, halfW, 0);
    addLine(0.04, cfg.courtL, -halfW, 0);

    const net = new THREE.Mesh(new THREE.BoxGeometry(cfg.courtW, cfg.netHeight, 0.1), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    net.position.y = cfg.tableHeight + cfg.netHeight / 2;
    scene.add(net);

    const racketGeo = new THREE.BoxGeometry(0.42, 1.1, 0.18);
    const racketBaseY = cfg.tableHeight + (mode === 'tabletennis' ? 0.98 : 1.08);
    const playerBaseZ = halfL - cfg.playerZOffset;
    const enemyBaseZ = -halfL + cfg.playerZOffset;
    const player = new THREE.Mesh(racketGeo, new THREE.MeshStandardMaterial({ color: cfg.playerColor }));
    player.position.set(0, racketBaseY, playerBaseZ);
    player.rotation.z = -0.06;
    scene.add(player);

    const enemy = new THREE.Mesh(racketGeo, new THREE.MeshStandardMaterial({ color: cfg.enemyColor }));
    enemy.position.set(0, racketBaseY, enemyBaseZ);
    enemy.rotation.z = 0.06;
    enemy.rotation.y = Math.PI;
    scene.add(enemy);

    const ballPhysics = new BallPhysics(cfg, mode);
    scene.add(ballPhysics.ball);

    const cameraRig = new CameraRig(camera, cfg, halfW, halfL, mode);
    const shotPlanner = new ShotPlanner(cfg, BASE_CONFIG, mode);
    const rallyManager = new RallyManager(cfg, halfL, cfg.playerZOffset, setToast);
    const opponent = new OpponentBrain(cfg, halfW, halfL, mode);

    const clock = new THREE.Clock();
    const BASE_STEP = 1 / 60;

    function clampX(x) {
      return THREE.MathUtils.clamp(x, -halfW + cfg.ballRadius * 2, halfW - cfg.ballRadius * 2);
    }

    function screenToCourt(clientX) {
      const rect = renderer.domElement.getBoundingClientRect();
      const normX = THREE.MathUtils.clamp((clientX - rect.left) / rect.width, 0.02, 0.98);
      return clampX((normX - 0.5) * cfg.courtW);
    }

    const input = new InputController(player, screenToCourt, mode);

    let started = false;
    let queuedSwing = null;
    let enemyServeTimer = null;
    let playerSwing = 0;
    let enemySwing = 0;

    function clearEnemyServeTimer() {
      if (enemyServeTimer) {
        clearTimeout(enemyServeTimer);
        enemyServeTimer = null;
      }
    }

    function scheduleEnemyServe() {
      if (rallyManager.server !== 'enemy') return;
      clearEnemyServeTimer();
      enemyServeTimer = setTimeout(() => {
        const lateralScale = cfg.courtW / BASE_CONFIG.courtW;
        const forwardScale = cfg.courtL / BASE_CONFIG.courtL;
        const cornerBias = Math.random() > 0.5 ? 1 : -1;
        const targetX = clampX((cornerBias * 0.45 + (Math.random() - 0.5) * 0.25) * halfW);
        const servePower = 14 + Math.random() * 6;
        const powerScale = servePower / 12;
        const forward = THREE.MathUtils.clamp(THREE.MathUtils.mapLinear(servePower, 10, 22, 6.4 * forwardScale, 13.6 * forwardScale), 6 * forwardScale, 13.6 * forwardScale);
        const lateral = THREE.MathUtils.clamp((targetX - ballPhysics.ball.position.x) * 1.05, -2.6 * lateralScale, 2.6 * lateralScale);
        const lift = THREE.MathUtils.clamp(3.6 + powerScale * 1.35, 3.4, 8.2);
        ballPhysics.ball.position.x = targetX * 0.35;
        ballPhysics.velocity.set(lateral, lift, forward);
        started = true;
        setToast('AI serving · defend!');
      }, 900);
    }

    function resetBall(showToast = true) {
      started = false;
      queuedSwing = null;
      clearEnemyServeTimer();
      ballPhysics.resetAt(rallyManager.spawnPosition());
      cameraRig.snap(ballPhysics.ball.position);

      if (showToast) {
        if (rallyManager.server !== 'player') {
          setToast('AI will serve · get ready to return');
        } else {
          setToast(trainingMode ? 'Training Mode · Swipe to serve' : 'Swipe UP to serve');
        }
      }

      if (rallyManager.server === 'enemy') {
        scheduleEnemyServe();
      }
    }

    function applyShotImpulse(distX, distY, swipeTime) {
      const towardsEnemy = ballPhysics.ball.position.z >= 0;
      const shot = shotPlanner.swipeToShot(distX, distY, swipeTime, towardsEnemy);

      const impulse = new THREE.Vector3(shot.lateral, shot.lift, shot.forward);
      ballPhysics.velocity.copy(impulse);
      if (mode === 'tabletennis') {
        const swipeTimeSafe = Math.max(80, swipeTime || 1);
        const sideSpin = THREE.MathUtils.clamp(-(distX / swipeTimeSafe) * 100, -120, 140);
        const topSpin = THREE.MathUtils.clamp((distY / swipeTimeSafe) * 160, -90, 200);
        ballPhysics.setSpin(0, sideSpin, topSpin);
      }

      started = true;
      playerSwing = 1.12;
    }

    function launchFromSwipe(swipe) {
      const { distX, distY, swipeTime } = swipe;
      if (distY < 32) return;

      if (started) {
        queuedSwing = shotPlanner.swipeToShot(distX, distY, swipeTime, ballPhysics.ball.position.z >= 0);
        setToast('Swing gati · prit topin');
        return;
      }

      applyShotImpulse(distX, distY, swipeTime);
    }

    const detachListeners = installPointerListeners(renderer, input, launchFromSwipe);

    function updateRacketHeight(dt) {
      const surfaceY = cfg.tableHeight + cfg.ballRadius;
      const targetY = Math.max(surfaceY + 0.22, Math.min(ballPhysics.ball.position.y, surfaceY + 2.6));
      const alpha = 1 - Math.pow(1 - 0.22, dt / BASE_STEP);
      const swingDamping = Math.exp(-dt * 8);
      playerSwing *= swingDamping;
      enemySwing *= swingDamping;

      if (!input.state.active) {
        const autoTrackX = clampX(ballPhysics.ball.position.x * 0.9);
        player.position.x += (autoTrackX - player.position.x) * (1 - Math.pow(1 - 0.32, dt / BASE_STEP));
      }

      player.position.y += (targetY - player.position.y) * alpha;
      enemy.position.y += (targetY - enemy.position.y) * alpha;
      player.position.z = playerBaseZ - playerSwing * 0.18;
      enemy.position.z = enemyBaseZ + enemySwing * 0.16;
      player.rotation.x = -playerSwing * 0.65;
      enemy.rotation.x = -enemySwing * 0.6;
    }

    function enemyAI(dt) {
      if (!started) return;
      const travel = Math.abs((enemy.position.z - ballPhysics.ball.position.z) / Math.max(Math.abs(ballPhysics.velocity.z), 0.001));
      const predictedX = clampX(ballPhysics.ball.position.x + ballPhysics.velocity.x * travel * 0.9);
      enemy.position.x += (predictedX - enemy.position.x) * (1 - Math.pow(1 - 0.2, dt / BASE_STEP));

      if (opponent.shouldSwing(ballPhysics.ball.position, ballPhysics.velocity)) {
        const targetX = clampX(player.position.x + (Math.random() - 0.5) * halfW * 0.28);
        const { velocity, spin } = opponent.executeSwing(ballPhysics.ball.position, ballPhysics.velocity, targetX);
        ballPhysics.velocity.copy(velocity);
        if (mode === 'tabletennis') {
          ballPhysics.spin = spin;
        }
        enemySwing = 1.05;
        started = true;
      }
    }

    function attemptPlayerReturn() {
      const hitWindow = Math.max(halfW * 0.08, cfg.ballRadius * 8);
      const approachingPlayer = ballPhysics.velocity.z > 0 && ballPhysics.ball.position.z > player.position.z - hitWindow;
      if (!approachingPlayer || ballPhysics.ball.position.distanceTo(player.position) >= hitWindow) return;

      const swipe = input.swipeMetrics(input.state.lastX, input.state.lastY);
      const swing = queuedSwing || shotPlanner.swipeToShot(swipe.distX, swipe.distY, swipe.swipeTime, true);
      const correction = THREE.MathUtils.clamp((ballPhysics.ball.position.x - player.position.x) * 0.8, -2.6, 2.6);

      ballPhysics.velocity.set(swing.lateral + correction, swing.lift + Math.max(0, Math.abs(ballPhysics.velocity.z) * 0.02), swing.forward);
      if (mode === 'tabletennis') {
        const swipeTimeSafe = Math.max(80, swipe.swipeTime || 1);
        const sideSpin = THREE.MathUtils.clamp(-(swipe.distX / swipeTimeSafe) * 90, -120, 120);
        const topSpin = THREE.MathUtils.clamp((swipe.distY / swipeTimeSafe) * 140, -90, 180);
        ballPhysics.setSpin(0, sideSpin, topSpin);
      }
      queuedSwing = null;
      setToast('Kthim perfekt!');
      started = true;
      playerSwing = 1.22;
    }

    function handleGrounded() {
      // Soft feedback hook for audio/particles in future.
    }

    function handleOut() {
      started = false;
      setToast('Rally finished · Swipe to restart');
      rallyManager.nextServer();
      resetBall(false);
    }

    function physics(dt) {
      if (started) {
        ballPhysics.integrate(dt, {
          halfW,
          halfL,
          onOutOfBounds: handleOut,
          onGroundContact: handleGrounded,
        });
        if (started) {
          attemptPlayerReturn();
          enemyAI(dt);
        }
      }
      updateRacketHeight(dt);
      cameraRig.update(dt, ballPhysics.ball.position, ballPhysics.velocity, started);
    }

    resetBall();

    let raf = 0;
    function animate() {
      const dt = Math.min(clock.getDelta(), 0.05);
      physics(dt);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    }
    animate();

    function onResize() {
      width = Math.max(1, container.clientWidth);
      height = Math.max(1, container.clientHeight);
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }

    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      detachListeners();
      clearEnemyServeTimer();
      try {
        container.removeChild(renderer.domElement);
      } catch (err) {
        console.warn(err);
      }
      renderer.dispose();
    };
  }, [mode, setToast, trainingMode]);

  return (
    <div className="relative w-full h-[100dvh] bg-[#0b1220]">
      <div ref={mountRef} className="w-full h-full" />
      <div className="pointer-events-none absolute inset-0 flex items-start justify-center pt-3">
        <div
          className="rounded-2xl px-4 py-2 text-white"
          style={{
            background: 'rgba(10,16,34,0.76)',
            border: '1px solid #1f2944',
            fontFamily: "'Luckiest Guy','Comic Sans MS',cursive",
            textShadow: '0 2px 8px rgba(0,0,0,0.45)',
            letterSpacing: 0.2,
          }}
        >
          {title || (mode === 'tennis' ? 'Tennis Battle Royal' : 'Table Tennis')}
        </div>
      </div>
      {(stakeLabel || trainingMode) && (
        <div className="pointer-events-none absolute top-3 right-4 flex gap-2">
          {trainingMode ? (
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold uppercase text-white"
              style={{
                background: 'rgba(34,197,94,0.8)',
                border: '1px solid #14532d',
                fontFamily: "'Luckiest Guy','Comic Sans MS',cursive",
                letterSpacing: 0.4,
              }}
            >
              Training
            </span>
          ) : null}
          {stakeLabel ? (
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold uppercase text-white"
              style={{
                background: 'rgba(14,116,144,0.85)',
                border: '1px solid #0ea5e9',
                fontFamily: "'Luckiest Guy','Comic Sans MS',cursive",
                letterSpacing: 0.4,
              }}
            >
              {stakeLabel}
            </span>
          ) : null}
        </div>
      )}
      {toast ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className="rounded-xl px-4 py-3 text-white text-center"
            style={{
              background: 'rgba(10,16,34,0.7)',
              border: '1px solid #1f2944',
              fontFamily: "'Luckiest Guy','Comic Sans MS',cursive",
              textShadow: '-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,1px 1px 0 #000',
              minWidth: 240,
            }}
          >
            {toast}
          </div>
        </div>
      ) : null}
    </div>
  );
}
