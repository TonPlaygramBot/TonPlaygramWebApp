import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { getGameVolume } from '../utils/sound.js';
import { getAvatarUrl } from '../utils/avatarUtils.js';

/**
 * AIR HOCKEY 3D — Mobile Portrait
 * -------------------------------
 * • Top‑down 3D air hockey table that fits portrait screens
 * • Controls: drag bottom half to move mallet
 * • AI opponent on top half with simple tracking logic
 * • Scoreboard with avatars
 */

export default function AirHockey3D({ player, ai }) {
  const hostRef = useRef(null);
  const raf = useRef(0);
  const [ui, setUi] = useState({ left: 0, right: 0 });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const playHit = () => {
      const a = new Audio('/assets/sounds/frying-pan-over-the-head-89303.mp3');
      a.volume = getGameVolume();
      a.play().catch(() => {});
    };
    const playGoal = () => {
      const a = new Audio('/assets/sounds/a-football-hits-the-net-goal-313216.mp3');
      a.volume = getGameVolume();
      a.play().catch(() => {});
    };

    // renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    // ensure canvas CSS size matches the host container
    renderer.setSize(host.clientWidth, host.clientHeight);
    host.appendChild(renderer.domElement);

    // scene & lights
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0e13);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x1a2330, 0.9);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(-10, 20, 10);
    scene.add(dir);

    // table dims (slightly bigger for mobile screens)
    // expanded 20% toward the top for more play space
    const TABLE = { w: 2.2, h: 4.8 * 1.2, rim: 0.06, goalW: 1 };

    // camera
    const camera = new THREE.PerspectiveCamera(
      58,
      host.clientWidth / host.clientHeight,
      0.05,
      100
    );
    const cam = {
      y: 4.5,
      z: 3.8,
      x: 0,
      tiltTarget: new THREE.Vector3(0, 0, 0)
    };
    const fitCam = () => {
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.position.set(cam.x, cam.y, cam.z);
      camera.lookAt(cam.tiltTarget);
      camera.updateProjectionMatrix();
      // keep canvas sized with the host on layout changes
      renderer.setSize(host.clientWidth, host.clientHeight);
    };

    // build table
    const group = new THREE.Group();
    // shift table slightly upward so the bottom edge stays visible on mobile screens
    group.position.z = -0.2;
    scene.add(group);

    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(TABLE.w, 0.08, TABLE.h),
      new THREE.MeshStandardMaterial({ color: 0x1d6fb8, roughness: 0.9 })
    );
    floor.position.y = -0.04;
    group.add(floor);

    // walls
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xdbe9ff,
      transparent: true,
      opacity: 0.3,
      roughness: 0.2,
      metalness: 0.1
    });
    const wallH = 0.25;
    const wallT = 0.04;
    const wallTop = new THREE.Mesh(
      new THREE.BoxGeometry(TABLE.w, wallH, wallT),
      wallMat
    );
    wallTop.position.set(0, wallH / 2, -TABLE.h / 2 - wallT / 2);
    group.add(wallTop);
    const wallBot = new THREE.Mesh(
      new THREE.BoxGeometry(TABLE.w, wallH, wallT),
      wallMat
    );
    wallBot.position.set(0, wallH / 2, TABLE.h / 2 + wallT / 2);
    group.add(wallBot);
    const wallL = new THREE.Mesh(
      new THREE.BoxGeometry(wallT, wallH, TABLE.h),
      wallMat
    );
    wallL.position.set(-TABLE.w / 2 - wallT / 2, wallH / 2, 0);
    group.add(wallL);
    const wallR = new THREE.Mesh(
      new THREE.BoxGeometry(wallT, wallH, TABLE.h),
      wallMat
    );
    wallR.position.set(TABLE.w / 2 + wallT / 2, wallH / 2, 0);
    group.add(wallR);

    // center line & circles
    const lineMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.6
    });
    const midLine = new THREE.Mesh(
      new THREE.BoxGeometry(TABLE.w, 0.01, 0.02),
      lineMat
    );
    midLine.position.y = 0.005;
    group.add(midLine);

    const ring = (r, thick, z) => {
      const g = new THREE.TorusGeometry(r, thick, 16, 60);
      const m = new THREE.Mesh(
        g,
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 })
      );
      m.rotation.x = Math.PI / 2;
      m.position.set(0, 0.01, z);
      group.add(m);
    };
    ring(0.18, 0.008, -TABLE.h * 0.33);
    ring(0.18, 0.008, TABLE.h * 0.33);

    // goals
    const goalGeom = new THREE.BoxGeometry(TABLE.goalW, 0.11, wallT * 0.6);
    const goalMat = new THREE.MeshStandardMaterial({
      color: 0x99ffd6,
      emissive: 0x003322,
      emissiveIntensity: 0.6
    });
    const goalTop = new THREE.Mesh(goalGeom, goalMat);
    goalTop.position.set(0, 0.05, -TABLE.h / 2 - wallT * 0.7);
    group.add(goalTop);
    const goalBot = new THREE.Mesh(goalGeom, goalMat);
    goalBot.position.set(0, 0.05, TABLE.h / 2 + wallT * 0.7);
    group.add(goalBot);

    // mallets
    const makeMallet = c => {
      const g = new THREE.Group();
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 0.05, 24),
        new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, metalness: 0.2 })
      );
      const knob = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 0.08, 24),
        new THREE.MeshStandardMaterial({ color: 0x222222 })
      );
      base.position.y = 0.025;
      knob.position.y = 0.115;
      g.add(base, knob);
      return g;
    };
    const you = makeMallet(0xff5577);
    you.position.set(0, 0, TABLE.h * 0.36);
    group.add(you);
    const aiMallet = makeMallet(0x66ddff);
    aiMallet.position.set(0, 0, -TABLE.h * 0.36);
    group.add(aiMallet);

    // puck
    const puck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.02, 24),
      new THREE.MeshStandardMaterial({ color: 0x111111 })
    );
    puck.position.y = 0.01;
    group.add(puck);

    // physics state
    const S = {
      vel: new THREE.Vector3(0, 0, 0),
      friction: 0.94,
      lastTouch: 0
    };

    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

    // input mapping
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();

    const touchToXZ = (clientX, clientY) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.x = ((clientX - r.left) / r.width) * 2 - 1;
      ndc.y = -((clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(ndc, camera);
      ray.ray.intersectPlane(plane, hit);
      const localX = hit.x - group.position.x;
      const localZ = hit.z - group.position.z;
      return {
        x: clamp(localX, -TABLE.w / 2 + 0.12, TABLE.w / 2 - 0.12),
        z: clamp(localZ, 0, TABLE.h / 2 - 0.12)
      };
    };

    const onMove = e => {
      const t = e.touches ? e.touches[0] : e;
      const { x, z } = touchToXZ(t.clientX, t.clientY);
      you.position.set(x, 0, z);
    };

    renderer.domElement.addEventListener('touchstart', onMove, {
      passive: true
    });
    renderer.domElement.addEventListener('touchmove', onMove, {
      passive: true
    });
    renderer.domElement.addEventListener('mousemove', onMove);

    const handleCollision = mallet => {
      const dx = puck.position.x - mallet.position.x;
      const dz = puck.position.z - mallet.position.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 0.12 * 0.12) {
        const HIT_FORCE = 0.5;
        S.vel.x += dx * HIT_FORCE;
        S.vel.z += dz * HIT_FORCE;
        S.lastTouch = 0.15;
        playHit();
      }
    };

    // AI logic (movement only; collisions handled in tick)
    const aiUpdate = dt => {
      const targetZ =
        puck.position.z < 0
          ? clamp(puck.position.z + 0.15, -TABLE.h / 2 + 0.12, 0 - 0.12)
          : -TABLE.h * 0.36;
      const targetX = clamp(
        puck.position.x,
        -TABLE.w / 2 + 0.12,
        TABLE.w / 2 - 0.12
      );
      const k = 3.4;
      aiMallet.position.x += (targetX - aiMallet.position.x) * k * dt;
      aiMallet.position.z += (targetZ - aiMallet.position.z) * k * dt;
    };

    const reset = towardTop => {
      puck.position.set(0, 0.01, 0);
      S.vel.set(0, 0, towardTop ? -0.05 : 0.05);
      you.position.set(0, 0, TABLE.h * 0.36);
      aiMallet.position.set(0, 0, -TABLE.h * 0.36);
    };

    // ensure table fits view
    const corners = [
      new THREE.Vector3(-TABLE.w / 2, 0, -TABLE.h / 2),
      new THREE.Vector3(TABLE.w / 2, 0, -TABLE.h / 2),
      new THREE.Vector3(-TABLE.w / 2, 0, TABLE.h / 2),
      new THREE.Vector3(TABLE.w / 2, 0, TABLE.h / 2)
    ];
    const toNDC = v => v.clone().project(camera);
    const ensureFit = () => {
      camera.position.set(0, cam.y, cam.z);
      camera.lookAt(0, 0, 0);
      for (let i = 0; i < 16; i++) {
        const over = corners.some(c => {
          const p = toNDC(c);
          return Math.abs(p.x) > 1 || Math.abs(p.y) > 1;
        });
        if (!over) break;
        cam.z += 0.18;
        camera.position.z = cam.z;
        camera.updateProjectionMatrix();
      }
    };

    // loop
    const clock = new THREE.Clock();
    reset();
    fitCam();
    ensureFit();

    const tick = () => {
      const dt = Math.min(0.033, clock.getDelta());

      puck.position.x += S.vel.x;
      puck.position.z += S.vel.z;
      S.vel.multiplyScalar(S.friction);
      // keep puck speed manageable
      S.vel.clampLength(0, 0.08);

      if (Math.abs(puck.position.x) > TABLE.w / 2 - 0.06) {
        puck.position.x = clamp(
          puck.position.x,
          -TABLE.w / 2 + 0.06,
          TABLE.w / 2 - 0.06
        );
        S.vel.x = -S.vel.x;
        playHit();
      }

      const goalHalf = TABLE.goalW / 2;
      const atTop = puck.position.z < -TABLE.h / 2 + 0.06;
      const atBot = puck.position.z > TABLE.h / 2 - 0.06;
      if (atTop || atBot) {
        if (Math.abs(puck.position.x) <= goalHalf) {
          setUi(s => ({
            left: s.left + (atBot ? 1 : 0),
            right: s.right + (atTop ? 1 : 0)
          }));
          playGoal();
          reset(!atBot);
        } else {
          S.vel.z = -S.vel.z;
          puck.position.z = clamp(
            puck.position.z,
            -TABLE.h / 2 + 0.06,
            TABLE.h / 2 - 0.06
          );
          playHit();
        }
      }

      aiUpdate(dt);
      handleCollision(you);
      handleCollision(aiMallet);
      renderer.render(scene, camera);
      raf.current = requestAnimationFrame(tick);
    };

    tick();

    const onResize = () => {
      fitCam();
      ensureFit();
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener('resize', onResize);
      try {
        host.removeChild(renderer.domElement);
      } catch {}
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className="w-full h-[100dvh] bg-black relative overflow-hidden select-none"
    >
      <div className="absolute top-1 left-2 flex items-center space-x-2 text-white text-xs bg-white/10 rounded px-2 py-1">
        <img
          src={getAvatarUrl(player.avatar)}
          alt=""
          className="w-5 h-5 rounded-full object-cover"
        />
        <span>
          {player.name}: {ui.left}
        </span>
      </div>
      <div className="absolute top-1 right-2 flex items-center space-x-2 text-white text-xs bg-white/10 rounded px-2 py-1">
        <span>
          {ui.right}: {ai.name}
        </span>
        <img
          src={getAvatarUrl(ai.avatar)}
          alt=""
          className="w-5 h-5 rounded-full object-cover"
        />
      </div>
      <button
        onClick={() => window.location.reload()}
        className="absolute left-2 bottom-2 text-white text-xs bg-white/10 hover:bg-white/20 rounded px-2 py-1"
      >
        Reset
      </button>
    </div>
  );
}

