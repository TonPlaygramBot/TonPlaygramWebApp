import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

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

function useGoalRushToast(text) {
  const [toast, setToast] = useState(text);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  return [toast, setToast];
}

const BASE_CONFIG = GAME_CONFIGS.tennis;

export default function ArcadeRacketGame({ mode = 'tennis', title, stakeLabel, trainingMode = false }) {
  const mountRef = useRef(null);
  const [toast, setToast] = useGoalRushToast(trainingMode ? 'Training Mode · Swipe to serve' : 'Swipe UP to shoot');

  useEffect(() => {
    const config = GAME_CONFIGS[mode] || GAME_CONFIGS.tennis;
    const container = mountRef.current;
    if (!container) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(config.background);

    let width = Math.max(1, container.clientWidth);
    let height = Math.max(1, container.clientHeight);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 5000);
    camera.position.set(0, config.tableHeight + config.cameraHeight, config.cameraOffset);
    camera.lookAt(0, config.tableHeight, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1);
    sun.position.set(0, 80, 60);
    scene.add(sun);

    const apron = mode === 'tennis' ? 4 : 0.8;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(config.courtW + apron, config.courtL + apron),
      new THREE.MeshStandardMaterial({ color: config.groundColor })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = config.tableHeight;
    scene.add(ground);

    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    function addLine(w, h, x, z) {
      const l = new THREE.Mesh(new THREE.PlaneGeometry(w, h), lineMat);
      l.rotation.x = -Math.PI / 2;
      l.position.set(x, config.tableHeight + 0.01, z);
      scene.add(l);
    }

    const halfL = config.courtL / 2;
    const halfW = config.courtW / 2;
    addLine(config.courtW, 0.04, 0, halfL);
    addLine(config.courtW, 0.04, 0, -halfL);
    addLine(0.04, config.courtL, halfW, 0);
    addLine(0.04, config.courtL, -halfW, 0);

    const net = new THREE.Mesh(
      new THREE.BoxGeometry(config.courtW, config.netHeight, 0.1),
      new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
    net.position.y = config.tableHeight + config.netHeight / 2;
    scene.add(net);

    const racketGeo = new THREE.BoxGeometry(1, 0.15, 0.4);
    const racketBaseY = config.tableHeight + (mode === 'tabletennis' ? 0.92 : 1);
    const playerBaseZ = halfL - config.playerZOffset;
    const enemyBaseZ = -halfL + config.playerZOffset;
    const player = new THREE.Mesh(racketGeo, new THREE.MeshStandardMaterial({ color: config.playerColor }));
    player.position.set(0, racketBaseY, playerBaseZ);
    scene.add(player);

    const enemy = new THREE.Mesh(racketGeo, new THREE.MeshStandardMaterial({ color: config.enemyColor }));
    enemy.position.set(0, racketBaseY, enemyBaseZ);
    scene.add(enemy);

    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(config.ballRadius, 32, 32),
      new THREE.MeshStandardMaterial({ color: config.ballColor, emissive: new THREE.Color(config.ballColor).multiplyScalar(0.35) })
    );
    ball.position.set(0, config.tableHeight + config.ballRadius + 0.22, halfL - config.playerZOffset - 0.4);
    scene.add(ball);

    const velocity = new THREE.Vector3();
    const previousPosition = new THREE.Vector3();
    const clock = new THREE.Clock();
    const BASE_STEP = 1 / 120;
    const MAX_SUBSTEPS = 8;
    const GRAVITY = mode === 'tabletennis' ? -18.5 : -16.5;
    const AIR_DECAY = mode === 'tabletennis' ? 0.9976 : 0.9945;
    const TABLE_RESTITUTION = 0.92;
    const WALL_REBOUND = 0.7;
    const FLOOR_FRICTION = 0.935;

    const MIN_SWIPE_SPEED = mode === 'tabletennis' ? 110 : 220;
    const MAX_SWIPE_SPEED = mode === 'tabletennis' ? 900 : 1400;
    const BASE_POWER = mode === 'tabletennis' ? 9.6 : 12;

    let started = false;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastY = 0;
    let startT = 0;
    let queuedSwing = null;
    let server = 'player';
    let enemyServeTimer = null;
    let playerSwing = 0;
    let enemySwing = 0;
    const cameraLook = new THREE.Vector3();
    const cameraTarget = new THREE.Vector3();

    function clampX(x) {
      return THREE.MathUtils.clamp(x, -halfW + config.ballRadius * 2, halfW - config.ballRadius * 2);
    }

    function screenToCourt(clientX) {
      const rect = renderer.domElement.getBoundingClientRect();
      const normX = (clientX - rect.left) / rect.width;
      return clampX((normX - 0.5) * config.courtW);
    }

    function clearEnemyServeTimer() {
      if (enemyServeTimer) {
        clearTimeout(enemyServeTimer);
        enemyServeTimer = null;
      }
    }

    function swipeToShot(distX, distY, swipeTime, towardsEnemy = true) {
      const lateralScale = config.courtW / BASE_CONFIG.courtW;
      const forwardScale = config.courtL / BASE_CONFIG.courtL;

      const forwardMin = mode === 'tabletennis' ? 3.6 : 4.8;
      const forwardMax = mode === 'tabletennis' ? 10.6 : 14.2;
      const liftMin = mode === 'tabletennis' ? 2.6 : 3.2;
      const liftMax = mode === 'tabletennis' ? 7.6 : 9.4;
      const lateralClampBase = mode === 'tabletennis' ? 1.2 : 1.6;
      const lateralScaleFactor = mode === 'tabletennis' ? 0.18 : 0.22;

      const swipeT = Math.max(swipeTime, 0.08);
      const speed = Math.hypot(distX, distY) / swipeT;
      const clampedSpeed = THREE.MathUtils.clamp(speed, MIN_SWIPE_SPEED * 0.6, MAX_SWIPE_SPEED * 1.05);
      const normalized = THREE.MathUtils.clamp(
        (clampedSpeed - MIN_SWIPE_SPEED * 0.6) / ((MAX_SWIPE_SPEED * 1.05) - MIN_SWIPE_SPEED * 0.6),
        0,
        1
      );

      const forward = THREE.MathUtils.lerp(forwardMin, forwardMax, normalized) * forwardScale;
      const lift = THREE.MathUtils.lerp(liftMin, liftMax, normalized);
      const lateralInfluence = THREE.MathUtils.clamp(distX / Math.max(Math.abs(distY), 80), -lateralClampBase, lateralClampBase);
      const lateral = THREE.MathUtils.clamp(
        lateralInfluence * forward * lateralScaleFactor,
        -3.1 * lateralScale,
        3.1 * lateralScale
      );

      const direction = towardsEnemy ? -1 : 1;
      return {
        forward: direction * forward,
        lift,
        lateral,
        normalized,
      };
    }

    function nextServer() {
      server = server === 'player' ? 'enemy' : 'player';
    }

    function scheduleEnemyServe() {
      if (server !== 'enemy') return;
      clearEnemyServeTimer();
      enemyServeTimer = setTimeout(() => {
        const lateralScale = config.courtW / BASE_CONFIG.courtW;
        const forwardScale = config.courtL / BASE_CONFIG.courtL;
        const targetX = clampX((Math.random() - 0.5) * halfW * 0.8);
        const servePower = 12 + Math.random() * 6;
        const powerScale = servePower / BASE_POWER;
        const forward = THREE.MathUtils.clamp(
          THREE.MathUtils.mapLinear(servePower, 8, 20, 4 * forwardScale, 12.4 * forwardScale),
          4 * forwardScale,
          12.4 * forwardScale
        );
        const lateral = THREE.MathUtils.clamp((targetX - ball.position.x) * 0.9, -2.4 * lateralScale, 2.4 * lateralScale);
        const lift = THREE.MathUtils.clamp(3 + powerScale * 1.1, 3, 7.6);
        velocity.set(lateral, lift, forward);
        started = true;
        setToast('AI serving · defend!');
      }, 900);
    }

    function resetBall(showToast = true) {
      started = false;
      velocity.set(0, 0, 0);
      queuedSwing = null;
      clearEnemyServeTimer();

      const serverIsPlayer = server === 'player';
      const zOffset = serverIsPlayer ? halfL - config.playerZOffset - 0.3 : -halfL + config.playerZOffset + 0.3;
      ball.position.set(0, config.tableHeight + config.ballRadius + 0.22, zOffset);
      camera.position.set(0, config.tableHeight + config.cameraHeight, ball.position.z + config.cameraOffset);
      camera.lookAt(ball.position.x, config.tableHeight + config.ballRadius, ball.position.z);

      if (showToast) {
        if (!serverIsPlayer) {
          setToast('AI will serve · get ready to return');
        } else {
          setToast(trainingMode ? 'Training Mode · Swipe to serve' : 'Swipe UP to serve');
        }
      }

      if (!serverIsPlayer) {
        scheduleEnemyServe();
      }
    }

    function blend(alphaPerStep, dt) {
      return 1 - Math.pow(1 - alphaPerStep, dt / BASE_STEP);
    }

    function applyShotImpulse(distX, distY, swipeTime) {
      const towardsEnemy = ball.position.z >= 0;
      const shot = swipeToShot(distX, distY, swipeTime, towardsEnemy);

      const hitDir = Math.sign(shot.forward) || -1;
      const hitOffset = Math.max(0.42, config.ballRadius * 6.2);

      velocity.set(shot.lateral, shot.lift, shot.forward);
      ball.position.set(
        clampX(player.position.x),
        Math.max(config.tableHeight + config.ballRadius + 0.08, player.position.y + 0.62),
        player.position.z + hitDir * hitOffset
      );
      started = true;
      setToast('Rally in progress');
      playerSwing = 1.1;
    }

    function onPointerDown(e) {
      const t = e.touches ? e.touches[0] : e;
      startX = t.clientX;
      startY = t.clientY;
      lastX = startX;
      lastY = startY;
      startT = Date.now();
      touchActive = true;
      player.position.x = screenToCourt(t.clientX);
    }

    function launchFromSwipe(endX, endY) {
      const distX = endX - startX;
      const distY = startY - endY;
      const time = Math.max((Date.now() - startT) / 1000, 0.12);
      if (distY < 32) return;

      if (started) {
        queuedSwing = swipeToShot(distX, distY, time, ball.position.z >= 0);
        setToast('Swing i gati · prit topin');
        return;
      }

      applyShotImpulse(distX, distY, time);
    }

    function onPointerUp(e) {
      const end = e.changedTouches ? e.changedTouches[0] : e;
      launchFromSwipe(end.clientX || lastX, end.clientY || lastY);
      touchActive = false;
    }

    function onPointerMove(e) {
      const t = e.touches ? e.touches[0] : e;
      lastX = t.clientX;
      lastY = t.clientY;
      const targetX = screenToCourt(t.clientX);
      player.position.x += (targetX - player.position.x) * 0.28;
    }

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('touchstart', onPointerDown, { passive: true });
    renderer.domElement.addEventListener('touchend', onPointerUp, { passive: true });
    renderer.domElement.addEventListener('touchmove', onPointerMove, { passive: true });

    // Global touch handlers so swipes that begin on the canvas but end off of it still launch the ball.
    function isInsideCanvas(touch) {
      const rect = renderer.domElement.getBoundingClientRect();
      return touch.clientX >= rect.left && touch.clientX <= rect.right && touch.clientY >= rect.top && touch.clientY <= rect.bottom;
    }

    let touchActive = false;
    function onDocumentTouchStart(e) {
      const t = e.touches?.[0];
      if (!t || !isInsideCanvas(t)) return;
      touchActive = true;
      startX = t.clientX;
      startY = t.clientY;
      lastX = startX;
      lastY = startY;
      startT = Date.now();
    }

    function onDocumentTouchEnd(e) {
      if (!touchActive) return;
      touchActive = false;
      const t = e.changedTouches?.[0];
      if (!t) return;
      launchFromSwipe(t.clientX, t.clientY);
    }

    document.addEventListener('touchstart', onDocumentTouchStart, { passive: true });
    document.addEventListener('touchend', onDocumentTouchEnd, { passive: true });

    function updateRacketHeight(dt) {
      const surfaceY = config.tableHeight + config.ballRadius;
      const targetY = Math.max(surfaceY + 0.2, Math.min(ball.position.y, surfaceY + 2.6));
      const alpha = blend(0.22, dt);
      const swingDamping = Math.exp(-dt * 8);
      playerSwing *= swingDamping;
      enemySwing *= swingDamping;
      if (!touchActive) {
        const autoTrackX = clampX(ball.position.x * 0.9);
        player.position.x += (autoTrackX - player.position.x) * blend(0.32, dt);
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

      const travel = Math.abs((enemy.position.z - ball.position.z) / Math.max(Math.abs(velocity.z), 0.001));
      const predictedX = clampX(ball.position.x + velocity.x * travel * 0.85);
      enemy.position.x += (predictedX - enemy.position.x) * blend(0.16, dt);

      const hitWindow = Math.max(halfW * 0.08, config.ballRadius * 8);
      const approachingEnemy = velocity.z < 0 && ball.position.z < enemy.position.z + hitWindow;
      if (approachingEnemy && ball.position.distanceTo(enemy.position) < hitWindow) {
        const targetX = clampX(player.position.x + (Math.random() - 0.5) * halfW * 0.35);
        const aiPower = THREE.MathUtils.clamp(10 + Math.abs(velocity.z) * 0.35, 8, 20);
        const powerScale = aiPower / BASE_POWER;
        const aimForward = THREE.MathUtils.clamp((Math.abs(velocity.z) + 3.4) * powerScale, 4 * (config.courtL / BASE_CONFIG.courtL), 12 * (config.courtL / BASE_CONFIG.courtL));
        const aimLateral = THREE.MathUtils.clamp((targetX - ball.position.x) * 0.95, -2.4, 2.4);
        const lift = THREE.MathUtils.clamp(3.2 + powerScale * 1.2 + Math.random() * 0.9, 3, 9);
        velocity.set(aimLateral, lift, Math.abs(aimForward));
        enemySwing = 1.05;
      }
    }

    function attemptPlayerReturn(dt) {
      const hitWindow = Math.max(halfW * 0.08, config.ballRadius * 8);
      const approachingPlayer = velocity.z > 0 && ball.position.z > player.position.z - hitWindow;
      if (!approachingPlayer || ball.position.distanceTo(player.position) >= hitWindow) return;

      const swing = queuedSwing || swipeToShot(lastX - startX, startY - lastY, Math.max((Date.now() - startT) / 1000, 0.12), true);
      const correction = THREE.MathUtils.clamp((ball.position.x - player.position.x) * 0.8, -2.6, 2.6);

      velocity.set(
        swing.lateral + correction,
        swing.lift + Math.max(0, Math.abs(velocity.z) * 0.02),
        swing.forward
      );
      queuedSwing = null;
      setToast('Kthim perfekt!');
      started = true;
      playerSwing = 1.2;
    }

    function updateCamera(dt) {
      const followStrength = mode === 'tabletennis' ? 0.2 : 0.1;
      const yLift = config.tableHeight + THREE.MathUtils.lerp(
        config.cameraHeight,
        config.cameraHeight * 0.65,
        Math.min((ball.position.y - config.tableHeight) * 0.4, 1)
      );
      const cameraDepth = Math.max(ball.position.z, 0) + config.cameraOffset * (mode === 'tabletennis' ? 0.72 : 0.95);
      const maxDepth = halfL - config.playerZOffset + config.cameraOffset * 0.35;
      cameraTarget.set(
        THREE.MathUtils.clamp(ball.position.x * 0.85, -halfW, halfW),
        yLift,
        THREE.MathUtils.clamp(cameraDepth, config.tableHeight + config.ballRadius + 0.12, maxDepth)
      );
      camera.position.lerp(cameraTarget, blend(followStrength, dt));
      cameraLook.set(
        ball.position.x,
        Math.max(config.tableHeight + config.ballRadius * 1.5, ball.position.y),
        Math.max(ball.position.z, 0)
      );
      camera.lookAt(cameraLook);
    }

    function handleTableBounds(dt) {
      const floorY = config.tableHeight + config.ballRadius;
      const damping = Math.pow(AIR_DECAY, dt / BASE_STEP);
      previousPosition.copy(ball.position);
      velocity.multiplyScalar(damping);
      velocity.y += GRAVITY * dt;
      ball.position.addScaledVector(velocity, dt);

      const inCourt = Math.abs(ball.position.x) <= halfW && Math.abs(ball.position.z) <= halfL;

      // Net collision with sweep to avoid tunneling
      const crossedNet = previousPosition.z >= 0 !== ball.position.z >= 0;
      if (
        (Math.abs(ball.position.z) < 0.06 || crossedNet) &&
        ball.position.y <= config.tableHeight + config.netHeight + config.ballRadius * 1.4
      ) {
        const sign = ball.position.z >= 0 ? 1 : -1;
        ball.position.z = 0.08 * sign;
        velocity.z = -Math.abs(velocity.z) * WALL_REBOUND * sign;
        velocity.y = Math.abs(velocity.y) * 0.6;
      }

      // Side rails to keep training rallies playable
      if (Math.abs(ball.position.x) > halfW - config.ballRadius * 1.2) {
        ball.position.x = clampX(ball.position.x);
        velocity.x *= -WALL_REBOUND;
      }

      if (ball.position.y <= floorY) {
        if (inCourt) {
          ball.position.y = floorY;
          velocity.y = Math.abs(velocity.y) * TABLE_RESTITUTION;
          velocity.x *= FLOOR_FRICTION;
          velocity.z *= FLOOR_FRICTION;
        } else {
          velocity.set(0, 0, 0);
          started = false;
          setToast('Out of bounds · Swipe to restart');
          nextServer();
          resetBall(false);
        }
      }

      const clippedOut = Math.abs(ball.position.z) > halfL + 0.4 || ball.position.y < -1;
      if (clippedOut) {
        velocity.set(0, 0, 0);
        started = false;
        setToast('Rally finished · Swipe to restart');
        nextServer();
        resetBall(false);
      }
    }

    function physics(dt) {
      const steps = Math.min(MAX_SUBSTEPS, Math.max(1, Math.ceil(dt / BASE_STEP)));
      const stepDt = Math.min(dt / steps, BASE_STEP);
      for (let i = 0; i < steps; i += 1) {
        if (started) {
          handleTableBounds(stepDt);
          if (started) {
            attemptPlayerReturn(stepDt);
            enemyAI(stepDt);
          }
        }
        updateRacketHeight(stepDt);
        updateCamera(stepDt);
      }
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
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('touchstart', onPointerDown);
      renderer.domElement.removeEventListener('touchend', onPointerUp);
      renderer.domElement.removeEventListener('touchmove', onPointerMove);
      document.removeEventListener('touchstart', onDocumentTouchStart);
      document.removeEventListener('touchend', onDocumentTouchEnd);
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
