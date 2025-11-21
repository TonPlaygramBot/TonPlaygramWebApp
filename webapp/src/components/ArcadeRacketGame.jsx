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
    speedScale: 1,
    powerCap: 0.45,
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
    speedScale: 0.32,
    powerCap: 0.34,
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
    const GRAVITY = mode === 'tennis' ? -0.009 : -0.015;
    const BOUNCE = mode === 'tennis' ? 0.78 : 0.68;
    const AIR = 0.995;
    let started = false;

    let startX = 0;
    let startY = 0;
    let startT = 0;

    function clampX(x) {
      return THREE.MathUtils.clamp(x, -halfW + 0.4, halfW - 0.4);
    }

    function onPointerDown(e) {
      const t = e.touches ? e.touches[0] : e;
      startX = t.clientX;
      startY = t.clientY;
      startT = Date.now();
    }

    function launchFromSwipe(endX, endY) {
      const distX = endX - startX;
      const distY = startY - endY;
      const time = Math.max((Date.now() - startT) / 1000, 0.15);
      if (distY < 40) return;
      started = true;
      const power = Math.min((distY / time) * 0.0008 * config.speedScale, config.powerCap);
      const forwardScale = mode === 'tabletennis' ? 0.32 : 1;
      velocity.x = THREE.MathUtils.clamp(distX * 0.0007 * config.speedScale, -0.12, 0.12);
      velocity.y = (mode === 'tabletennis' ? 0.08 : 0.12) + power * 0.2;
      velocity.z = -(0.11 * forwardScale + power * 0.35);
      ball.position.set(clampX(player.position.x), player.position.y + 0.4, player.position.z - 0.5);
      setToast('Rally në progres');
    }

    function onPointerUp(e) {
      const end = e.changedTouches ? e.changedTouches[0] : e;
      launchFromSwipe(end.clientX, end.clientY);
    }

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('touchstart', onPointerDown, { passive: true });
    renderer.domElement.addEventListener('touchend', onPointerUp, { passive: true });

    function updateRacketHeight() {
      const targetY = Math.max(config.ballRadius + 0.6, Math.min(ball.position.y, config.ballRadius + 2.5));
      player.position.y += (targetY - player.position.y) * 0.25;
      enemy.position.y += (targetY - enemy.position.y) * 0.25;
    }

    function enemyAI() {
      if (!started) return;
      const travel = Math.abs((enemy.position.z - ball.position.z) / (velocity.z || 0.001));
      const targetX = clampX(ball.position.x + velocity.x * travel);
      enemy.position.x += (targetX - enemy.position.x) * 0.18;
      if (ball.position.distanceTo(enemy.position) < 0.8 && velocity.z < 0) {
        velocity.z = Math.abs(velocity.z) + (mode === 'tabletennis' ? 0.06 : 0.12);
        velocity.y = (mode === 'tabletennis' ? 0.1 : 0.14) + Math.random() * 0.05;
      }
    }

    function updateCamera() {
      const camTarget = new THREE.Vector3(ball.position.x, config.cameraHeight, ball.position.z + config.cameraOffset);
      camera.position.lerp(camTarget, 0.08);
      camera.lookAt(ball.position);
    }

    function physics() {
      if (!started) return;
      velocity.y += GRAVITY;
      ball.position.add(velocity);

      const inCourt = Math.abs(ball.position.x) <= halfW && Math.abs(ball.position.z) <= halfL;
      const floorY = config.ballRadius;

      if (ball.position.y < floorY) {
        if (inCourt) {
          ball.position.y = floorY;
          velocity.y *= -BOUNCE;
          velocity.x *= AIR;
          velocity.z *= AIR;
        } else {
          velocity.set(0, 0, 0);
          started = false;
          setToast('Jashtë fushës · Swipe për të rifilluar');
        }
      }

      if (ball.position.distanceTo(player.position) < 0.8 && velocity.z > 0) {
        velocity.z = -Math.abs(velocity.z) - (mode === 'tabletennis' ? 0.05 : 0.08);
        velocity.y = mode === 'tabletennis' ? 0.1 : 0.14;
      }

      enemyAI();
      updateRacketHeight();
      updateCamera();
    }

    let raf = 0;
    function animate() {
      physics();
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
      renderer.domElement.removeEventListener('touchstart', onPointerDown);
      renderer.domElement.removeEventListener('touchend', onPointerUp);
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
