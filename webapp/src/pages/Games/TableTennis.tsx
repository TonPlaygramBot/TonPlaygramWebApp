"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GameManager } from "./tableTennis/GameManager";
import { CameraController } from "./tableTennis/CameraController";
import { PlayerAvatar, PlayerController } from "./tableTennis/PlayerController";
import { UIOverlay } from "./tableTennis/UIOverlay";
import { BALL_SURFACE_Y, PlayerSide, ShotType, TABLE_HALF_L, TABLE_HALF_W, clamp01, gameConfig } from "./tableTennis/gameConfig";

function material(color: number, roughness = 0.72, metalness = 0.02) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function enableShadow(obj: THREE.Object3D) {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
  return obj;
}

function addBox(group: THREE.Group, size: [number, number, number], pos: [number, number, number], mat: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
  mesh.position.set(...pos);
  group.add(mesh);
  return mesh;
}

function addCylinder(group: THREE.Group, radius: number, depth: number, pos: [number, number, number], mat: THREE.Material, radial = 24) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, depth, radial), mat);
  mesh.position.set(...pos);
  group.add(mesh);
  return mesh;
}

function createTable() {
  const group = new THREE.Group();
  const blue = material(0x123f73, 0.78, 0.02);
  const edge = material(0x10161d, 0.55, 0.06);
  const line = material(0xf6f7f0, 0.45, 0);
  const metal = material(0x171c22, 0.38, 0.32);
  const netMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.78, transparent: true, opacity: 0.66 });

  addBox(group, [gameConfig.table.width, gameConfig.table.thickness, gameConfig.table.length], [0, gameConfig.table.topY - gameConfig.table.thickness / 2, 0], blue);
  addBox(group, [gameConfig.table.width + 0.055, 0.035, gameConfig.table.length + 0.055], [0, gameConfig.table.topY - gameConfig.table.thickness - 0.015, 0], edge);
  const y = gameConfig.table.topY + 0.004;
  addBox(group, [gameConfig.table.width, 0.004, 0.02], [0, y, -TABLE_HALF_L + 0.01], line);
  addBox(group, [gameConfig.table.width, 0.004, 0.02], [0, y, TABLE_HALF_L - 0.01], line);
  addBox(group, [0.02, 0.004, gameConfig.table.length], [-TABLE_HALF_W + 0.01, y, 0], line);
  addBox(group, [0.02, 0.004, gameConfig.table.length], [TABLE_HALF_W - 0.01, y, 0], line);
  addBox(group, [0.004, 0.004, gameConfig.table.length], [0, y + 0.001, 0], line);

  const netSpan = gameConfig.table.width + gameConfig.net.postOutside * 2;
  addBox(group, [netSpan, gameConfig.net.height, gameConfig.net.thickness], [0, gameConfig.table.topY + gameConfig.net.height / 2, 0], netMat);
  addCylinder(group, 0.019, gameConfig.net.height + 0.08, [-(TABLE_HALF_W + gameConfig.net.postOutside), gameConfig.table.topY + (gameConfig.net.height + 0.08) / 2, 0], metal, 14);
  addCylinder(group, 0.019, gameConfig.net.height + 0.08, [TABLE_HALF_W + gameConfig.net.postOutside, gameConfig.table.topY + (gameConfig.net.height + 0.08) / 2, 0], metal, 14);
  for (const x of [-0.62, 0.62]) for (const z of [-1.05, -0.45, 0.45, 1.05]) addCylinder(group, 0.027, 0.66, [x, 0.33, z], metal, 16);
  enableShadow(group);
  return group;
}

function createPaddle(side: PlayerSide) {
  const group = new THREE.Group();
  const face = new THREE.Mesh(new THREE.CylinderGeometry(gameConfig.paddle.visualRadius, gameConfig.paddle.visualRadius, 0.018, 48), material(side === "near" ? 0xb91f26 : 0x234ebf, 0.58, 0.02));
  face.rotation.x = Math.PI / 2;
  group.add(face);
  const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.026, 0.18, 8, 16), material(0x8b5a2b, 0.55, 0.02));
  handle.position.y = -0.16;
  group.add(handle);
  return enableShadow(group) as THREE.Group;
}

function createAvatar(side: PlayerSide, accent: number): PlayerAvatar {
  const group = new THREE.Group();
  const body = new THREE.Group();
  const skin = material(0xe7d8c9, 0.86, 0.01);
  const shirt = material(accent, 0.82, 0.02);
  const shorts = material(0x20232a, 0.76, 0.02);
  const shoe = material(0xe7edf6, 0.62, 0.02);
  const torso = addCylinder(body, 0.2, 0.55, [0, 0.95, 0], shirt, 28);
  torso.scale.x = 0.78;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 28, 20), skin);
  head.position.y = 1.35;
  body.add(head);
  addCylinder(body, 0.055, 0.52, [-0.1, 0.42, 0], shorts, 16);
  addCylinder(body, 0.055, 0.52, [0.1, 0.42, 0], shorts, 16);
  addBox(body, [0.2, 0.05, 0.24], [-0.1, 0.04, 0.02], shoe);
  addBox(body, [0.2, 0.05, 0.24], [0.1, 0.04, 0.02], shoe);
  group.add(body);
  const start = new THREE.Vector3(0, 0, side === "near" ? TABLE_HALF_L + 0.72 : -TABLE_HALF_L - 0.72);
  group.position.copy(start);
  const paddle = createPaddle(side);
  return {
    side,
    group: enableShadow(group) as THREE.Group,
    body,
    head,
    paddle,
    position: start.clone(),
    target: start.clone(),
    yaw: side === "near" ? Math.PI : 0,
    swing: 0,
    swingT: 0,
    recovery: 0,
    stroke: "ready",
    paddleWorld: new THREE.Vector3(),
    paddleForward: new THREE.Vector3(0, 0, side === "near" ? -1 : 1),
  };
}

function createBallMesh() {
  const ball = new THREE.Mesh(new THREE.SphereGeometry(gameConfig.ball.radius, 32, 20), new THREE.MeshStandardMaterial({ color: 0xfffff4, roughness: 0.38, metalness: 0.01, emissive: 0x22220f, emissiveIntensity: 0.16 }));
  enableShadow(ball);
  return ball;
}

function playFx(src: string, volume: number, rate = 1) {
  const audio = new Audio(src);
  audio.volume = volume;
  audio.playbackRate = rate;
  audio.play().catch(() => undefined);
}

export default function MobileRealisticTableTennisGame() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const managerRef = useRef<GameManager | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [debug, setDebug] = useState(false);
  const [hud, setHud] = useState({ near: 0, far: 0, status: "Swipe up to serve", replaying: false, shotLabel: "", debugInfo: { state: "idle" as const, bounceCount: 0, hitValidity: "ready", predicted: "—" } });

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x091014);
    scene.fog = new THREE.Fog(0x091014, 7, 14);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.86;

    const camera = new THREE.PerspectiveCamera(48, 1, 0.05, 80);
    const cameraController = new CameraController();
    scene.add(new THREE.HemisphereLight(0xeaf2ff, 0x102030, 1.35));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-3.2, 7, 4.5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x8ec5ff, 0.75);
    fill.position.set(3, 4, -4);
    scene.add(fill);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 14), new THREE.ShadowMaterial({ opacity: 0.24 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    scene.add(createTable());

    const nearAvatar = createAvatar("near", 0xf3f4f6);
    const farAvatar = createAvatar("far", 0xe5eefc);
    scene.add(nearAvatar.group, farAvatar.group, nearAvatar.paddle, farAvatar.paddle);
    const near = new PlayerController(nearAvatar);
    const far = new PlayerController(farAvatar, gameConfig.ai.moveSpeed);
    const manager = new GameManager(near, far);
    managerRef.current = manager;
    const ballMesh = createBallMesh();
    scene.add(ballMesh);

    const predictedMarker = new THREE.Mesh(new THREE.RingGeometry(0.08, 0.105, 36), new THREE.MeshBasicMaterial({ color: 0xfff3a3, transparent: true, opacity: 0.42, side: THREE.DoubleSide }));
    predictedMarker.rotation.x = -Math.PI / 2;
    scene.add(predictedMarker);
    const playerGhost = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.22, 38), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, side: THREE.DoubleSide }));
    playerGhost.rotation.x = -Math.PI / 2;
    scene.add(playerGhost);

    let frame = 0;
    let last = performance.now();
    let shotLabelTimer = 0;
    let pointer: { id: number; sx: number; sy: number; lx: number; ly: number; startX: number; startZ: number } | null = null;
    let lastHitValidity = "ready";

    manager.onStatus = (status) => setHud((prev) => ({ ...prev, status, replaying: manager.replay.active }));
    manager.onScore = () => {
      playFx("/assets/sounds/successful.mp3", 0.26);
      setHud((prev) => ({ ...prev, near: manager.score.state.near, far: manager.score.state.far, status: manager.score.state.status, replaying: true }));
    };
    manager.onHit = (label) => {
      shotLabelTimer = 1.0;
      lastHitValidity = "valid";
      setHud((prev) => ({ ...prev, shotLabel: label, status: label }));
      playFx("/assets/sounds/freesound_community-ping-pong-ball-100140.mp3", 0.42);
    };
    manager.onBounce = () => playFx("/assets/sounds/freesound_community-ping-pong-ball-100140.mp3", 0.2, 1.08);
    manager.onNet = () => playFx("/assets/sounds/snooker-cue-put-on-table-81295.mp3", 0.18, 1.4);

    const resize = () => {
      const w = Math.max(1, host.clientWidth);
      const h = Math.max(1, host.clientHeight);
      renderer.setSize(w, h, false);
      renderer.setPixelRatio(Math.min(1.75, window.devicePixelRatio || 1));
      camera.aspect = w / h;
    };

    const chooseShot = (dx: number, dy: number): ShotType => {
      if (dy > 80) return "push";
      if (dy < -170) return "lob";
      if (Math.abs(dx) > 95) return "brush/topspin";
      return dx < -40 ? "backhand drive" : "forehand drive";
    };

    const pointerDown = (event: PointerEvent) => {
      if (manager.replay.active) return;
      canvas.setPointerCapture(event.pointerId);
      pointer = { id: event.pointerId, sx: event.clientX, sy: event.clientY, lx: event.clientX, ly: event.clientY, startX: nearAvatar.target.x, startZ: nearAvatar.target.z };
      setHud((prev) => ({ ...prev, status: manager.physics.ball.lastHitBy ? "Move into position; release to hit" : "Aim serve; release" }));
    };
    const pointerMove = (event: PointerEvent) => {
      if (!pointer || pointer.id !== event.pointerId || manager.replay.active) return;
      pointer.lx = event.clientX;
      pointer.ly = event.clientY;
      near.setTarget(pointer.startX + (event.clientX - pointer.sx) * 0.0047, pointer.startZ + (event.clientY - pointer.sy) * 0.0032);
    };
    const pointerUp = (event: PointerEvent) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      canvas.releasePointerCapture(event.pointerId);
      const dx = event.clientX - pointer.sx;
      const dy = event.clientY - pointer.sy;
      const isServe = manager.physics.ball.lastHitBy === null && manager.score.state.server === "near";
      const target = manager.makeUserTarget(dx, dy, isServe);
      const power = clamp01(Math.hypot(dx, dy) / 220);
      const spin = THREE.MathUtils.clamp(dx / 170, -1, 1);
      if (isServe) {
        near.startSwing("serve");
        manager.serve("near", target, power, spin);
      } else {
        const stroke = near.chooseStroke(manager.physics.ball);
        near.startSwing(stroke);
        const ok = manager.attemptHit("near", chooseShot(dx, dy), target, Math.max(0.35, power), spin, 0, 0.9);
        lastHitValidity = ok ? "valid" : "invalid";
      }
      pointer = null;
    };

    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointermove", pointerMove);
    canvas.addEventListener("pointerup", pointerUp);
    canvas.addEventListener("pointercancel", pointerUp);
    window.addEventListener("resize", resize);
    resize();

    const animate = () => {
      frame = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      manager.update(dt);
      near.update(dt, manager.physics.ball);
      far.update(dt, manager.physics.ball);
      ballMesh.position.copy(manager.physics.ball.position);
      if (manager.physics.ball.spin.length() > 0.01) ballMesh.rotateOnWorldAxis(manager.physics.ball.spin.clone().normalize(), manager.physics.ball.spin.length() * dt * 0.18);
      playerGhost.position.copy(nearAvatar.target).setY(0.035);
      const landing = manager.physics.predictLandingPoint();
      predictedMarker.position.copy(landing).setY(gameConfig.table.topY + 0.012);
      (predictedMarker.material as THREE.MeshBasicMaterial).opacity = debug ? 0.42 : 0;
      shotLabelTimer = Math.max(0, shotLabelTimer - dt);
      cameraController.update(camera, dt, manager.physics.ball.position, camera.aspect);
      renderer.render(scene, camera);
      setHud((prev) => ({
        ...prev,
        replaying: manager.replay.active,
        shotLabel: shotLabelTimer > 0 ? prev.shotLabel : "",
        debugInfo: {
          state: manager.physics.ball.state,
          bounceCount: manager.physics.ball.bounceCountOnSide,
          hitValidity: lastHitValidity,
          predicted: `${landing.x.toFixed(2)}, ${landing.z.toFixed(2)}`,
        },
      }));
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerUp);
      window.removeEventListener("resize", resize);
      renderer.dispose();
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose();
          const mat = mesh.material as THREE.Material | THREE.Material[];
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat?.dispose();
        }
      });
      managerRef.current = null;
    };
  }, [debug]);

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#091014", touchAction: "none", userSelect: "none" }}>
      <div ref={hostRef} style={{ position: "absolute", inset: 0 }}>
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }} />
      </div>
      <UIOverlay
        nearScore={hud.near}
        farScore={hud.far}
        status={hud.status}
        replaying={hud.replaying}
        shotLabel={hud.shotLabel}
        menuOpen={menuOpen}
        debug={debug}
        debugInfo={hud.debugInfo}
        onToggleMenu={() => setMenuOpen((prev) => !prev)}
        onToggleDebug={() => setDebug((prev) => !prev)}
      />
    </div>
  );
}
