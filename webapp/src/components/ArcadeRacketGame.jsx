import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const GAME_CONFIGS = {
  tennis: {
    courtL: 23.77,
    courtW: 9.2,
    netHeight: 1.2,
    ballRadius: 0.2,
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
  const [toast, setToast] = useGoalRushToast(trainingMode ? 'Modaliteti Trajnim · Swipe për shërbim' : 'Swipe UP për gjuajtje');

  useEffect(() => {
    const config = GAME_CONFIGS[mode] || GAME_CONFIGS.tennis;
    const container = mountRef.current;
    if (!container) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(config.background);

    let width = Math.max(1, container.clientWidth);
    let height = Math.max(1, container.clientHeight);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 5000);
    camera.position.set(0, config.cameraHeight, config.cameraOffset);
    camera.lookAt(0, 0, 0);

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
    scene.add(ground);

    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    function addLine(w, h, x, z) {
      const l = new THREE.Mesh(new THREE.PlaneGeometry(w, h), lineMat);
      l.rotation.x = -Math.PI / 2;
      l.position.set(x, 0.01, z);
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
    net.position.y = config.netHeight / 2;
    scene.add(net);

    const racketGeo = new THREE.BoxGeometry(1, 0.15, 0.4);
    const player = new THREE.Mesh(racketGeo, new THREE.MeshStandardMaterial({ color: config.playerColor }));
    player.position.set(0, 1, halfL - config.playerZOffset);
    scene.add(player);

    const enemy = new THREE.Mesh(racketGeo, new THREE.MeshStandardMaterial({ color: config.enemyColor }));
    enemy.position.set(0, 1, -halfL + config.playerZOffset);
    scene.add(enemy);

    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(config.ballRadius, 32, 32),
      new THREE.MeshStandardMaterial({ color: config.ballColor })
    );
    ball.position.set(0, config.ballRadius + 0.8, halfL - config.playerZOffset - 0.4);
    scene.add(ball);

    const velocity = new THREE.Vector3();
    const clock = new THREE.Clock();
    const BASE_STEP = 1 / 60;
    const GRAVITY = mode === 'tabletennis' ? -36 : -22;
    const AIR_DECAY = 0.985;
    const TABLE_RESTITUTION = 0.9;
    const WALL_REBOUND = 0.65;
    const FLOOR_FRICTION = 0.92;

    let started = false;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastY = 0;
    let startT = 0;
    let queuedSwing = null;

    function clampX(x) {
      return THREE.MathUtils.clamp(x, -halfW + config.ballRadius * 2, halfW - config.ballRadius * 2);
    }

    function screenToCourt(clientX) {
      const rect = renderer.domElement.getBoundingClientRect();
      const normX = (clientX - rect.left) / rect.width;
      return clampX((normX - 0.5) * config.courtW);
    }

    function resetBall(showToast = true) {
      started = false;
      velocity.set(0, 0, 0);
      queuedSwing = null;
      const zOffset = halfL - config.playerZOffset - 0.3;
      ball.position.set(0, config.ballRadius + 0.7, zOffset);
      camera.position.set(0, config.cameraHeight, ball.position.z + config.cameraOffset);
      camera.lookAt(ball.position);
      if (showToast) {
        setToast(trainingMode ? 'Modaliteti Trajnim · Swipe për shërbim' : 'Swipe UP për shërbim');
      }
    }

    function blend(alphaPerStep, dt) {
      return 1 - Math.pow(1 - alphaPerStep, dt / BASE_STEP);
    }

    function applyShotImpulse(distX, distY, swipeTime) {
      const lateralScale = config.courtW / BASE_CONFIG.courtW;
      const forwardScale = config.courtL / BASE_CONFIG.courtL;

      const lateral = THREE.MathUtils.clamp((distX / Math.max(swipeTime, 0.12)) * 0.0022 * lateralScale, -2.2 * lateralScale, 2.2 * lateralScale);
      const forward = THREE.MathUtils.clamp((distY / Math.max(swipeTime, 0.12)) * 0.003 * forwardScale, 3 * forwardScale, 9.5 * forwardScale);
      const vertical = THREE.MathUtils.clamp((distY / Math.max(swipeTime, 0.12)) * 0.0018, 2.2, 8.5);

      const direction = ball.position.z >= 0 ? -1 : 1;
      const hitOffset = Math.max(0.32, config.ballRadius * 6);

      velocity.set(lateral, vertical, direction * forward);
      ball.position.set(clampX(player.position.x), Math.max(config.ballRadius + 0.05, player.position.y + 0.55), player.position.z + direction * hitOffset);
      started = true;
      setToast('Rally në progres');
    }

    function onPointerDown(e) {
      const t = e.touches ? e.touches[0] : e;
      startX = t.clientX;
      startY = t.clientY;
      lastX = startX;
      lastY = startY;
      startT = Date.now();
      player.position.x = screenToCourt(t.clientX);
    }

    function launchFromSwipe(endX, endY) {
      const distX = endX - startX;
      const distY = startY - endY;
      const time = Math.max((Date.now() - startT) / 1000, 0.12);
      if (distY < 32) return;

      if (started) {
        const lateralScale = config.courtW / BASE_CONFIG.courtW;
        queuedSwing = {
          lateral: THREE.MathUtils.clamp((distX / Math.max(time, 0.12)) * 0.0015 * lateralScale, -1.6 * lateralScale, 1.6 * lateralScale),
          lift: THREE.MathUtils.clamp((distY / Math.max(time, 0.12)) * 0.0012, 0, 2.5),
        };
        setToast('Swing i gati · prit topin');
        return;
      }

      applyShotImpulse(distX, distY, time);
    }

    function onPointerUp(e) {
      const end = e.changedTouches ? e.changedTouches[0] : e;
      launchFromSwipe(end.clientX || lastX, end.clientY || lastY);
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
      const targetY = Math.max(config.ballRadius + 0.6, Math.min(ball.position.y, config.ballRadius + 3));
      const alpha = blend(0.22, dt);
      player.position.y += (targetY - player.position.y) * alpha;
      enemy.position.y += (targetY - enemy.position.y) * alpha;
    }

    function enemyAI(dt) {
      if (!started) return;

      const travel = Math.abs((enemy.position.z - ball.position.z) / Math.max(Math.abs(velocity.z), 0.001));
      const predictedX = clampX(ball.position.x + velocity.x * travel * 0.85);
      enemy.position.x += (predictedX - enemy.position.x) * blend(0.16, dt);

      const hitWindow = Math.max(halfW * 0.08, config.ballRadius * 8);
      const approachingEnemy = velocity.z < 0 && ball.position.z < enemy.position.z + hitWindow;
      if (approachingEnemy && ball.position.distanceTo(enemy.position) < hitWindow) {
        const aimForward = THREE.MathUtils.clamp(Math.abs(velocity.z) + 2.8, 3.4, 9.2) * (config.courtL / BASE_CONFIG.courtL);
        const aimLateral = THREE.MathUtils.clamp((ball.position.x - enemy.position.x) * 1.4, -2.2, 2.2);
        velocity.set(aimLateral, 3 + Math.random() * 1.2, Math.abs(aimForward));
      }
    }

    function attemptPlayerReturn(dt) {
      const hitWindow = Math.max(halfW * 0.08, config.ballRadius * 8);
      const approachingPlayer = velocity.z > 0 && ball.position.z > player.position.z - hitWindow;
      if (!approachingPlayer || ball.position.distanceTo(player.position) >= hitWindow) return;

      const rebound = THREE.MathUtils.clamp(Math.abs(velocity.z) + 2.2, 3.2, 9) * (config.courtL / BASE_CONFIG.courtL);
      const correction = THREE.MathUtils.clamp((ball.position.x - player.position.x) * 1.3, -1.8, 1.8);
      const queuedLateral = queuedSwing?.lateral ?? 0;
      const queuedLift = queuedSwing?.lift ?? 0;
      velocity.set(correction + queuedLateral, 3.4 + queuedLift + Math.random() * 0.8, -Math.abs(rebound));
      queuedSwing = null;
      setToast('Kthim perfekt!');
      started = true;
    }

    function updateCamera(dt) {
      const camTarget = new THREE.Vector3(
        THREE.MathUtils.clamp(ball.position.x, -halfW, halfW),
        config.cameraHeight,
        ball.position.z + config.cameraOffset
      );
      camera.position.lerp(camTarget, blend(0.08, dt));
      camera.lookAt(ball.position);
    }

    function handleTableBounds(dt) {
      const floorY = config.ballRadius;
      const damping = Math.pow(AIR_DECAY, dt / BASE_STEP);
      velocity.multiplyScalar(damping);
      velocity.y += GRAVITY * dt;
      ball.position.addScaledVector(velocity, dt);

      const inCourt = Math.abs(ball.position.x) <= halfW && Math.abs(ball.position.z) <= halfL;

      // Net collision
      if (Math.abs(ball.position.z) < 0.06 && ball.position.y <= config.netHeight + config.ballRadius) {
        ball.position.z = ball.position.z >= 0 ? 0.07 : -0.07;
        velocity.z *= -WALL_REBOUND;
        velocity.y = Math.abs(velocity.y) * 0.5;
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
          setToast('Jashtë fushës · Swipe për të rifilluar');
          resetBall(false);
        }
      }

      const clippedOut = Math.abs(ball.position.z) > halfL + 0.4 || ball.position.y < -1;
      if (clippedOut) {
        velocity.set(0, 0, 0);
        started = false;
        setToast('Rally përfundoi · Swipe për të rifilluar');
        resetBall(false);
      }
    }

    function physics(dt) {
      if (started) {
        handleTableBounds(dt);
        if (started) {
          attemptPlayerReturn(dt);
          enemyAI(dt);
        }
      }
      updateRacketHeight(dt);
      updateCamera(dt);
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
