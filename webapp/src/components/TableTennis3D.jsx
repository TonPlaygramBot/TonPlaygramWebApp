import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { createArenaCarpetMaterial, createArenaWallMaterial } from '../utils/arenaDecor.js';
import { applySRGBColorSpace } from '../utils/colorSpace.js';

const TABLE_SPEC = {
  length: 2.74,
  width: 1.525,
  height: 0.76,
  netHeight: 0.1525,
  border: 0.018,
  tableThickness: 0.024,
};

const CAMERA_PROFILES = {
  broadcast: {
    fov: 55,
    height: 2.12,
    distance: 3.8,
    yaw: 0,
    yawRange: 0.35,
    pitch: 0.34,
    followLerp: 0.2,
  },
  sideline: {
    fov: 60,
    height: 1.86,
    distance: 3.4,
    yaw: -0.16,
    yawRange: 0.52,
    pitch: 0.3,
    followLerp: 0.26,
  },
  analytic: {
    fov: 52,
    height: 2.62,
    distance: 3.2,
    yaw: 0,
    yawRange: 0.18,
    pitch: 0.44,
    followLerp: 0.16,
  },
};

const TOUCH_PRESETS = {
  precision: { minSpeed: 200, maxSpeed: 1650, lift: [0.34, 1.1], forward: [0.82, 1.5], lateralScale: 1.4, curveScale: 0.9 },
  arcade: { minSpeed: 140, maxSpeed: 1900, lift: [0.42, 1.2], forward: [0.9, 1.68], lateralScale: 1.8, curveScale: 1.05 },
  stable: { minSpeed: 190, maxSpeed: 1550, lift: [0.3, 1.0], forward: [0.78, 1.28], lateralScale: 1.15, curveScale: 0.7 },
};

const LIGHTING_PRESETS = {
  pro: {
    ambient: { color: 0xffffff, intensity: 0.55 },
    hemi: { sky: 0xffffff, ground: 0x1b2233, intensity: 0.95 },
    sun: { color: 0xffffff, intensity: 1, position: [-16, 28, 18] },
    rim: { color: 0x99ccff, intensity: 0.35, position: [16, 12, -12] },
    spots: [
      { position: [-8, 6, -8], color: 0xffffff, intensity: 0.72, angle: Math.PI / 5, penumbra: 0.35 },
      { position: [8, 6, -8], color: 0xffffff, intensity: 0.72, angle: Math.PI / 5, penumbra: 0.35 },
      { position: [-8, 6, 8], color: 0xffffff, intensity: 0.72, angle: Math.PI / 5, penumbra: 0.35 },
      { position: [8, 6, 8], color: 0xffffff, intensity: 0.72, angle: Math.PI / 5, penumbra: 0.35 },
    ],
  },
  neon: {
    ambient: { color: 0x7a9dff, intensity: 0.65 },
    hemi: { sky: 0x7a9dff, ground: 0x12041f, intensity: 1.05 },
    sun: { color: 0xff63d1, intensity: 0.95, position: [-12, 24, 16] },
    rim: { color: 0x4bf9ff, intensity: 0.65, position: [18, 12, -14] },
    spots: [
      { position: [-8, 6.5, -7], color: 0xff63d1, intensity: 0.92, angle: Math.PI / 4.4, penumbra: 0.55 },
      { position: [8, 6.5, -7], color: 0x55f7ff, intensity: 0.92, angle: Math.PI / 4.6, penumbra: 0.55 },
      { position: [-8, 6.5, 7], color: 0xff63d1, intensity: 0.88, angle: Math.PI / 4.3, penumbra: 0.5 },
      { position: [8, 6.5, 7], color: 0x55f7ff, intensity: 0.88, angle: Math.PI / 4.3, penumbra: 0.5 },
    ],
  },
  zen: {
    ambient: { color: 0xfff7e6, intensity: 0.6 },
    hemi: { sky: 0xfff7e6, ground: 0x1a2c1f, intensity: 0.98 },
    sun: { color: 0xffd08a, intensity: 1.08, position: [-14, 26, 14] },
    rim: { color: 0x90d4a8, intensity: 0.32, position: [16, 12, -10] },
    spots: [
      { position: [-7.5, 6.2, -7.5], color: 0xffc28a, intensity: 0.82, angle: Math.PI / 4.8, penumbra: 0.38 },
      { position: [7.5, 6.2, -7.5], color: 0xffd6a3, intensity: 0.82, angle: Math.PI / 4.8, penumbra: 0.38 },
      { position: [-7.5, 6.2, 7.5], color: 0xffc28a, intensity: 0.78, angle: Math.PI / 4.9, penumbra: 0.36 },
      { position: [7.5, 6.2, 7.5], color: 0xffd6a3, intensity: 0.78, angle: Math.PI / 4.9, penumbra: 0.36 },
    ],
  },
};

const MATERIAL_PRESET = {
  table: { color: 0x1e3a8a, roughness: 0.58 },
  lines: { color: 0xffffff, roughness: 0.35 },
  metal: { color: 0x9aa4b2, roughness: 0.45, metalness: 0.65 },
  wheel: { color: 0x111111, roughness: 0.9 },
  paddles: { player: 0xff4d6d, opponent: 0x49dcb1 },
  ball: {
    color: 0xfff1cc,
    emissive: 0xffd7a1,
    emissiveIntensity: 0.55,
    glowColor: 0xffd7a1,
    glowIntensity: 0.85,
    glowDistance: 4,
  },
};

const PHYSICS_BASELINE = {
  gravity: new THREE.Vector3(0, -9.81, 0),
  airDrag: 0.18,
  magnus: 0.0006,
  spinDecay: 0.92,
  tableRest: 0.9,
  tableFriction: 0.2,
  paddleRest: 1.04,
  paddleAim: 0.62,
  paddleLift: 0.18,
  netRest: 0.35,
  wallRest: 0.7,
  floorFriction: 0.94,
};

const GAME_RULES = {
  pointsToWin: 11,
  winBy: 2,
  serveRotate: 2,
};

const BASE_STEP = 1 / 120;
const MAX_SUB_STEPS = 8;

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

function makeRenderer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  applySRGBColorSpace(renderer);
  return renderer;
}

function makeCamera(profile, aspect) {
  const cam = new THREE.PerspectiveCamera(profile.fov, aspect, 0.1, 200);
  cam.position.set(0, profile.height, profile.distance);
  cam.lookAt(0, TABLE_SPEC.height, 0);
  return cam;
}

function makeTable(materials) {
  const { length: L, width: W, height: H, netHeight: NET_H, border: B, tableThickness: T } = TABLE_SPEC;
  const group = new THREE.Group();
  const tableMat = new THREE.MeshStandardMaterial({ color: materials.table.color, roughness: materials.table.roughness });
  const lineMat = new THREE.MeshStandardMaterial({ color: materials.lines.color, roughness: materials.lines.roughness });
  const metalMat = new THREE.MeshStandardMaterial({ color: materials.metal.color, roughness: materials.metal.roughness, metalness: materials.metal.metalness });
  const wheelMat = new THREE.MeshStandardMaterial({ color: materials.wheel.color, roughness: materials.wheel.roughness });

  const top = new THREE.Mesh(new THREE.BoxGeometry(W, T, L), tableMat);
  top.position.set(0, H - T / 2, 0);
  top.receiveShadow = true;
  top.castShadow = true;
  group.add(top);

  const railT = 0.018;
  const mkLine = (w, h, d, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lineMat);
    mesh.position.set(x, y, z);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  mkLine(B, 0.003, L, -W / 2 + B / 2, H + 0.002, 0);
  mkLine(B, 0.003, L, W / 2 - B / 2, H + 0.002, 0);
  mkLine(W, 0.003, B, 0, H + 0.002, L / 2 - B / 2);
  mkLine(W, 0.003, B, 0, H + 0.002, -L / 2 + B / 2);
  mkLine(B, 0.003, L - B * 2, 0, H + 0.002, 0);

  const netGroup = new THREE.Group();
  const netWidth = W + 0.05;
  const netGeo = new THREE.PlaneGeometry(netWidth, NET_H);
  const netAlpha = makeHexNetAlpha(512, 256, 9);
  const netWeave = makeWeaveTex(256, 256);
  const netMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    transparent: true,
    alphaMap: netAlpha,
    map: netWeave,
    roughness: 0.9,
    side: THREE.DoubleSide,
  });
  const netMesh = new THREE.Mesh(netGeo, netMat);
  netMesh.position.set(0, H + NET_H / 2, 0);
  netMesh.castShadow = false;
  netMesh.receiveShadow = true;
  netGroup.add(netMesh);

  const bandT = 0.014;
  const band = new THREE.Mesh(new THREE.BoxGeometry(netWidth, bandT, 0.004), lineMat);
  band.position.set(0, H + NET_H - bandT / 2, 0);
  netGroup.add(band);

  const postR = 0.012;
  const postH = NET_H + 0.08;
  const postGeo = new THREE.CylinderGeometry(postR, postR, postH, 24);
  const postRMesh = new THREE.Mesh(postGeo, metalMat);
  postRMesh.position.set(W / 2 + postR * 0.8, H + postH / 2, 0);
  const postLMesh = postRMesh.clone();
  postLMesh.position.x = -W / 2 - postR * 0.8;
  postRMesh.castShadow = postLMesh.castShadow = true;
  postRMesh.receiveShadow = postLMesh.receiveShadow = true;
  group.add(postRMesh, postLMesh, netGroup);

  const clampGeo = new THREE.BoxGeometry(0.06, 0.025, 0.05);
  const clampR = new THREE.Mesh(clampGeo, metalMat);
  clampR.position.set(W / 2 + 0.03, H + 0.03, 0);
  const clampL = clampR.clone();
  clampL.position.x = -W / 2 - 0.03;
  group.add(clampR, clampL);

  const legMat = metalMat;
  const legGeo = new THREE.CylinderGeometry(0.015, 0.015, H, 14);
  const legOffsetX = W * 0.35;
  const legOffsetZ = L * 0.35;
  const legs = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(legOffsetX * sx, H / 2, legOffsetZ * sz);
      leg.castShadow = true;
      leg.receiveShadow = true;
      legs.push(leg);
    }
  }
  group.add(...legs);

  const wheelGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.028, 18);
  for (let i = 0; i < legs.length; i += 1) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.copy(legs[i].position.clone().setY(0.05));
    wheel.castShadow = true;
    wheel.receiveShadow = true;
    group.add(wheel);
  }

  group.userData = { netMat, lineMat, tableMat, metalMat, wheelMat };
  return group;
}

function makeHexNetAlpha(w, h, density = 8) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'white';
  const step = w / density;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const isOdd = ((x / step) + (y / step)) % 2 > 0.5;
      if (isOdd) ctx.fillRect(x, y, step * 0.65, step * 0.65);
    }
  }
  return new THREE.CanvasTexture(canvas);
}

function makeWeaveTex(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#e2e8f0';
  for (let y = 0; y < h; y += 12) {
    ctx.fillRect(0, y, w, 6);
  }
  for (let x = 0; x < w; x += 12) {
    ctx.fillRect(x, 0, 6, h);
  }
  return new THREE.CanvasTexture(canvas);
}

function makePaddle(color, isPlayer) {
  const radius = 0.15;
  const thickness = 0.02;
  const group = new THREE.Group();
  const face = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, thickness, 48), new THREE.MeshStandardMaterial({ color, roughness: 0.36 }));
  face.rotation.z = Math.PI / 2;
  face.rotation.y = Math.PI / 2;
  face.castShadow = true;
  face.receiveShadow = true;
  group.add(face);

  const handleGeo = new THREE.BoxGeometry(0.045, 0.22, 0.04);
  const handle = new THREE.Mesh(handleGeo, new THREE.MeshStandardMaterial({ color: 0x6b4c32, roughness: 0.68 }));
  handle.position.set(0, -0.18, 0);
  handle.castShadow = true;
  handle.receiveShadow = true;
  group.add(handle);

  group.position.set(0, TABLE_SPEC.height + 0.1, isPlayer ? TABLE_SPEC.length / 2 - 0.4 : -TABLE_SPEC.length / 2 + 0.4);
  group.userData.radius = radius;
  return group;
}

function makeBall(materials) {
  const geo = new THREE.SphereGeometry(0.02, 32, 32);
  const mat = new THREE.MeshPhysicalMaterial({
    color: materials.ball.color,
    roughness: 0.52,
    metalness: 0,
    emissive: new THREE.Color(materials.ball.emissive),
    emissiveIntensity: materials.ball.emissiveIntensity,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeTrail(color, count = 16) {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6 });
  const line = new THREE.Line(geo, mat);
  line.frustumCulled = false;
  return { line, positions };
}

function createLights(scene, preset) {
  const ambient = new THREE.AmbientLight(preset.ambient.color, preset.ambient.intensity);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(preset.hemi.sky, preset.hemi.ground, preset.hemi.intensity);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(preset.sun.color, preset.sun.intensity);
  dir.position.fromArray(preset.sun.position);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  dir.shadow.camera.left = -5;
  dir.shadow.camera.right = 5;
  dir.shadow.camera.top = 5;
  dir.shadow.camera.bottom = -5;
  dir.shadow.camera.far = 30;
  scene.add(dir);

  const rim = new THREE.DirectionalLight(preset.rim.color, preset.rim.intensity);
  rim.position.fromArray(preset.rim.position);
  scene.add(rim);

  const spots = [];
  for (const s of preset.spots) {
    const spot = new THREE.SpotLight(s.color, s.intensity, 30, s.angle, s.penumbra, 1);
    spot.position.fromArray(s.position);
    spot.target.position.set(0, TABLE_SPEC.height, 0);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    scene.add(spot);
    scene.add(spot.target);
    spots.push(spot);
  }
  return { ambient, hemi, dir, rim, spots };
}

function createArena(scene) {
  const carpet = createArenaCarpetMaterial();
  carpet.bumpScale = 0.28;
  carpet.emissiveIntensity = 0.24;
  const carpetMesh = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), carpet);
  carpetMesh.rotation.x = -Math.PI / 2;
  carpetMesh.receiveShadow = true;
  carpetMesh.position.y = 0.01;
  scene.add(carpetMesh);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshStandardMaterial({ color: 0x0f1222, roughness: 0.95, metalness: 0.05 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const wallMat = createArenaWallMaterial();
  wallMat.color.setHex(0xdce4ff);
  const wallH = 4.4;
  const wallGeo = new THREE.BoxGeometry(30, wallH, 30);
  const wall = new THREE.Mesh(wallGeo, wallMat);
  wall.position.y = wallH / 2 - 0.12;
  wall.receiveShadow = true;
  scene.add(wall);
  return { carpet, floor, wall };
}

class AudioDirector {
  constructor() {
    this.ctx = null;
    this.buffers = {};
  }

  ensure() {
    if (this.ctx) return this.ctx;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    this.ctx = new Ctor();
    return this.ctx;
  }

  buffer(name, freq, duration, noise = false) {
    const ctx = this.ensure();
    if (!ctx || this.buffers[name]) return this.buffers[name];
    const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) {
      const t = i / ctx.sampleRate;
      const env = Math.pow(1 - t / duration, 3);
      const osc = noise ? (Math.random() * 2 - 1) * 0.7 : Math.sin(2 * Math.PI * freq * t);
      data[i] = osc * env;
    }
    this.buffers[name] = buf;
    return buf;
  }

  play(name, gain = 0.9, rate = 1) {
    const ctx = this.ensure();
    const buffer = this.buffers[name];
    if (!ctx || !buffer) return;
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    g.gain.value = gain;
    src.connect(g).connect(ctx.destination);
    src.start();
  }
}

class TouchController {
  constructor(target, preset, clampX) {
    this.target = target;
    this.preset = preset;
    this.clampX = clampX;
    this.active = false;
    this.startX = 0;
    this.startY = 0;
    this.lastX = 0;
    this.lastY = 0;
    this.startT = 0;
    this.lerp = { x: 0.54, z: 0.38 };
  }

  begin(x, y) {
    this.active = true;
    this.startX = x;
    this.startY = y;
    this.lastX = x;
    this.lastY = y;
    this.startT = performance.now();
  }

  track(x, y, converter) {
    this.lastX = x;
    this.lastY = y;
    const tx = converter(x);
    this.target.position.x += (tx - this.target.position.x) * this.lerp.x;
  }

  finish(x, y) {
    const endX = x ?? this.lastX;
    const endY = y ?? this.lastY;
    const distX = endX - this.startX;
    const distY = this.startY - endY;
    const swipeTime = Math.max((performance.now() - this.startT) / 1000, 0.12);
    this.active = false;
    return { distX, distY, swipeTime };
  }

  metrics(x, y) {
    const endX = x ?? this.lastX;
    const endY = y ?? this.lastY;
    const distX = endX - this.startX;
    const distY = this.startY - endY;
    const swipeTime = Math.max((performance.now() - this.startT) / 1000, 0.12);
    return { distX, distY, swipeTime };
  }
}

class TrailSystem {
  constructor(scene, color, count = 18) {
    const { line, positions } = makeTrail(color, count);
    this.line = line;
    this.positions = positions;
    this.count = count;
    this.index = 0;
    scene.add(line);
  }

  update(position, velocity, dt) {
    const speed = velocity.length();
    const alpha = clamp(speed * 0.12, 0.2, 0.9);
    this.line.material.opacity = alpha;
    this.positions.copyWithin(3, 0);
    this.positions[0] = position.x;
    this.positions[1] = position.y;
    this.positions[2] = position.z;
    this.line.geometry.attributes.position.needsUpdate = true;
  }

  dispose(scene) {
    scene.remove(this.line);
    this.line.geometry.dispose();
    this.line.material.dispose();
  }
}

class ScoreManager {
  constructor(playerName, aiName) {
    this.playerName = playerName;
    this.aiName = aiName;
    this.reset();
  }

  reset(server = 'P') {
    this.scoreP = 0;
    this.scoreO = 0;
    this.server = server;
    this.gameOver = false;
    this.winner = null;
    this.toast = `${server === 'P' ? this.playerName : this.aiName} to serve`;
  }

  point(who) {
    if (this.gameOver) return;
    if (who === 'P') this.scoreP += 1; else this.scoreO += 1;
    const total = this.scoreP + this.scoreO;
    if (Math.max(this.scoreP, this.scoreO) >= GAME_RULES.pointsToWin && Math.abs(this.scoreP - this.scoreO) >= GAME_RULES.winBy) {
      this.gameOver = true;
      this.winner = this.scoreP > this.scoreO ? this.playerName : this.aiName;
      this.toast = `${this.winner} wins!`;
    } else {
      if (total % GAME_RULES.serveRotate === 0) {
        this.server = this.server === 'P' ? 'O' : 'P';
      }
      this.toast = `${this.server === 'P' ? this.playerName : this.aiName} to serve`;
    }
  }
}

class PhysicsState {
  constructor(ball) {
    this.ball = ball;
    this.velocity = new THREE.Vector3();
    this.spin = new THREE.Vector3();
    this.prev = new THREE.Vector3();
  }

  step(dt, settings) {
    this.prev.copy(this.ball.position);
    this.velocity.addScaledVector(settings.gravity, dt);
    this.velocity.multiplyScalar(1 / (1 + settings.airDrag * dt));
    if (this.spin.lengthSq() > 0.0001) {
      const magnus = new THREE.Vector3().copy(this.spin).cross(this.velocity).multiplyScalar(settings.magnus * dt);
      this.velocity.add(magnus);
      this.spin.multiplyScalar(Math.pow(settings.spinDecay, dt * 60));
    }
    this.ball.position.addScaledVector(this.velocity, dt);
  }
}

class AIController {
  constructor(paddle, difficulty) {
    this.paddle = paddle;
    this.diff = difficulty;
    this.reaction = 0;
  }

  update(dt, ball, velocity) {
    this.reaction = Math.max(0, this.reaction - dt);
    if (this.reaction > 0) return;
    const targetX = clamp(ball.position.x + velocity.x * 0.32, -TABLE_SPEC.width / 2 + 0.12, TABLE_SPEC.width / 2 - 0.12);
    this.paddle.position.x = damp(this.paddle.position.x, targetX, this.diff.speed, dt);
    const desiredY = damp(this.paddle.position.y, TABLE_SPEC.height + 0.35 + Math.abs(velocity.y) * 0.08, this.diff.vertical, dt);
    this.paddle.position.y = desiredY;
  }
}

class CameraDirector {
  constructor(camera, profile) {
    this.camera = camera;
    this.profile = profile;
    this.yaw = profile.yaw;
  }

  update(dt, ballPos, ballVel) {
    const lead = clamp(ballVel.z * 0.12, -0.8, 1.2);
    const targetYaw = clamp(ballPos.x * 0.4, -this.profile.yawRange, this.profile.yawRange) + this.profile.yaw;
    this.yaw = damp(this.yaw, targetYaw, 6 * this.profile.followLerp, dt);
    const dist = this.profile.distance + lead;
    const height = this.profile.height + clamp(ballPos.y - TABLE_SPEC.height, -0.2, 0.6);
    const offset = new THREE.Vector3(0, height, dist);
    const rot = new THREE.Euler(-this.profile.pitch, this.yaw, 0, 'YXZ');
    offset.applyEuler(rot);
    const target = new THREE.Vector3(ballPos.x * 0.6, clamp(ballPos.y, TABLE_SPEC.height + 0.02, TABLE_SPEC.height + 1.8), ballPos.z * 0.5);
    this.camera.position.lerp(target.clone().add(offset), damp(0, 1, this.profile.followLerp, dt));
    this.camera.lookAt(target);
  }
}

function swipeToShot(swipe, preset, towardsOpponent = true) {
  const speed = Math.hypot(swipe.distX, swipe.distY) / swipe.swipeTime;
  const normalized = clamp((speed - preset.minSpeed) / (preset.maxSpeed - preset.minSpeed), 0, 1);
  const forward = lerp(preset.forward[0], preset.forward[1], normalized) * (towardsOpponent ? -1 : 1);
  const lift = lerp(preset.lift[0], preset.lift[1], normalized);
  const lateral = clamp((swipe.distX / Math.max(Math.abs(swipe.distY), 60)) * preset.lateralScale, -1.8, 1.8);
  const curve = clamp((swipe.distX / swipe.swipeTime) * 0.35 * preset.curveScale, -160, 160);
  const chop = clamp((swipe.distY / swipe.swipeTime) * 0.18, -90, 140);
  return { forward, lift, lateral, curve, chop, normalized };
}

function screenToTableX(canvas, clientX) {
  const rect = canvas.getBoundingClientRect();
  const norm = clamp((clientX - rect.left) / rect.width, 0.02, 0.98) - 0.5;
  return clamp(norm * TABLE_SPEC.width, -TABLE_SPEC.width / 2 + 0.1, TABLE_SPEC.width / 2 - 0.1);
}

export default function TableTennis3D({ player, ai }) {
  const hostRef = useRef(null);
  const [toast, setToast] = useState('Swipe upwards to serve');
  const [score, setScore] = useState({ p: 0, o: 0, serving: 'P', over: false, winner: null });
  const [profileKey] = useState('broadcast');
  const [touchProfileKey] = useState('precision');
  const rafRef = useRef(0);
  const audio = useRef(new AudioDirector());
  const scoreMgrRef = useRef(null);

  const playerLabel = player?.name || 'You';
  const aiLabel = ai?.name || 'AI';
  const difficulty = useMemo(() => {
    const level = (ai?.difficulty || ai?.level || 'pro').toString().toLowerCase();
    const presets = {
      easy: { speed: 3.2, vertical: 2.4, react: 0.12 },
      medium: { speed: 3.6, vertical: 2.6, react: 0.08 },
      pro: { speed: 4.1, vertical: 3, react: 0.05 },
      legend: { speed: 4.6, vertical: 3.4, react: 0.04 },
    };
    return presets[level] || presets.pro;
  }, [ai?.difficulty, ai?.level]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const renderer = makeRenderer(host);
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0e14);
    const cameraProfile = CAMERA_PROFILES[profileKey];
    const camera = makeCamera(cameraProfile, Math.max(1, host.clientWidth) / Math.max(1, host.clientHeight));
    const camDirector = new CameraDirector(camera, cameraProfile);

    const lights = createLights(scene, LIGHTING_PRESETS.pro);
    const clock = new THREE.Clock();
    createArena(scene);
    const table = makeTable(MATERIAL_PRESET);
    scene.add(table);

    const paddleP = makePaddle(MATERIAL_PRESET.paddles.player, true);
    const paddleO = makePaddle(MATERIAL_PRESET.paddles.opponent, false);
    scene.add(paddleP, paddleO);

    const ball = makeBall(MATERIAL_PRESET);
    ball.position.set(0, TABLE_SPEC.height + 0.05, TABLE_SPEC.length / 2 - 0.35);
    scene.add(ball);

    const trail = new TrailSystem(scene, MATERIAL_PRESET.ball.color, 18);

    const physics = new PhysicsState(ball);
    const aiCtrl = new AIController(paddleO, difficulty);
    const touchPreset = TOUCH_PRESETS[touchProfileKey];
    const touchCtrl = new TouchController(paddleP, touchPreset, (x) => screenToTableX(renderer.domElement, x));

    const scoreMgr = new ScoreManager(playerLabel, aiLabel);
    scoreMgrRef.current = scoreMgr;
    setScore({ p: scoreMgr.scoreP, o: scoreMgr.scoreO, serving: scoreMgr.server, over: scoreMgr.gameOver, winner: scoreMgr.winner });
    setToast(scoreMgr.toast);

    const sounds = audio.current;
    sounds.buffer('bounce', 420, 0.16, true);
    sounds.buffer('paddle', 920, 0.14, false);

    const state = {
      started: false,
      awaitingServe: true,
      server: scoreMgr.server,
      serveTimer: null,
      queuedSwing: null,
    };

    const bounds = {
      minX: -TABLE_SPEC.width / 2 + 0.04,
      maxX: TABLE_SPEC.width / 2 - 0.04,
      minZ: -TABLE_SPEC.length / 2 + 0.06,
      maxZ: TABLE_SPEC.length / 2 - 0.06,
      floor: 0.02,
    };

    const physicsProfile = { ...PHYSICS_BASELINE, magnus: 0.00064, airDrag: 0.18 };

    const clampBall = () => {
      ball.position.x = clamp(ball.position.x, bounds.minX, bounds.maxX);
      ball.position.z = clamp(ball.position.z, bounds.minZ, bounds.maxZ);
    };

    const resetBall = () => {
      state.started = false;
      physics.velocity.set(0, 0, 0);
      physics.spin.set(0, 0, 0);
      state.queuedSwing = null;
      const serverIsP = scoreMgr.server === 'P';
      const z = serverIsP ? bounds.maxZ - 0.08 : bounds.minZ + 0.08;
      ball.position.set(0, TABLE_SPEC.height + 0.04, z);
      paddleP.position.x = 0;
      paddleO.position.x = 0;
      camDirector.update(BASE_STEP, ball.position, physics.velocity);
      setToast(serverIsP ? 'Swipe to serve' : `${aiLabel} serving`);
      state.awaitingServe = true;
      if (!serverIsP) scheduleAiServe();
    };

    const applyShot = (swipe) => {
      const towardsOpponent = ball.position.z >= 0;
      const shot = swipeToShot(swipe, touchPreset, towardsOpponent);
      physics.velocity.set(shot.lateral, shot.lift, shot.forward * 6.4);
      physics.spin.set(0, shot.curve, shot.chop);
      ball.position.set(clamp(paddleP.position.x, bounds.minX, bounds.maxX), TABLE_SPEC.height + 0.12, paddleP.position.z - 0.14);
      state.started = true;
      state.awaitingServe = false;
      setToast('Rally on');
      sounds.play('paddle', 0.8 + shot.normalized * 0.3, 0.98 + shot.normalized * 0.1);
    };

    const scheduleAiServe = () => {
      clearTimeout(state.serveTimer);
      state.serveTimer = setTimeout(() => {
        const lateral = (Math.random() - 0.5) * 0.6;
        physics.velocity.set(lateral, 3.6 + Math.random(), 7 + Math.random() * 2);
        physics.spin.set(0, (Math.random() - 0.5) * 80, 120 + Math.random() * 40);
        state.started = true;
        state.awaitingServe = false;
        sounds.play('paddle', 0.82, 1.05);
        setToast('Defend the serve!');
      }, 600 + Math.random() * 480);
    };

    const handlePaddleBounce = (paddle, towardOpponent) => {
      const swing = state.queuedSwing || touchCtrl.metrics(touchCtrl.lastX, touchCtrl.lastY);
      const shot = swipeToShot(swing, touchPreset, towardOpponent);
      const aimCorrection = clamp(ball.position.x - paddle.position.x, -0.7, 0.7);
      physics.velocity.set(
        shot.lateral + aimCorrection * PHYSICS_BASELINE.paddleAim,
        shot.lift + PHYSICS_BASELINE.paddleLift,
        shot.forward * 6.8
      );
      physics.spin.set(0, shot.curve, shot.chop + Math.abs(physics.velocity.z) * 2.4);
      state.started = true;
      state.awaitingServe = false;
      state.queuedSwing = null;
      sounds.play('paddle', 0.86, 1.02 + shot.normalized * 0.08);
    };

    const awardPoint = (who) => {
      scoreMgr.point(who);
      setScore({ p: scoreMgr.scoreP, o: scoreMgr.scoreO, serving: scoreMgr.server, over: scoreMgr.gameOver, winner: scoreMgr.winner });
      setToast(scoreMgr.toast);
      if (!scoreMgr.gameOver) {
        state.server = scoreMgr.server;
        resetBall();
      }
    };

    const processTableCollision = () => {
      const { height: H, netHeight: NET_H, width: W } = TABLE_SPEC;
      if (ball.position.y < H && ball.position.y > H - 0.05 && Math.abs(ball.position.x) <= W / 2 + 0.05) {
        if (ball.position.y < H) {
          ball.position.y = H + 0.005;
          physics.velocity.y = -physics.velocity.y * PHYSICS_BASELINE.tableRest;
          physics.velocity.x *= PHYSICS_BASELINE.tableFriction;
          physics.velocity.z *= PHYSICS_BASELINE.tableFriction;
          audio.current.play('bounce', 0.7, 1);
        }
      }
      if (Math.abs(ball.position.z) < 0.05 && ball.position.y < H + NET_H) {
        physics.velocity.z = -physics.velocity.z * PHYSICS_BASELINE.netRest;
        physics.velocity.x *= 0.85;
        sounds.play('bounce', 0.5, 0.8);
      }
    };

    const processBounds = () => {
      if (ball.position.x <= bounds.minX || ball.position.x >= bounds.maxX) {
        physics.velocity.x = -physics.velocity.x * PHYSICS_BASELINE.wallRest;
        ball.position.x = clamp(ball.position.x, bounds.minX, bounds.maxX);
      }
      if (ball.position.z <= bounds.minZ || ball.position.z >= bounds.maxZ) {
        physics.velocity.z = -physics.velocity.z * PHYSICS_BASELINE.wallRest;
        ball.position.z = clamp(ball.position.z, bounds.minZ, bounds.maxZ);
      }
      if (ball.position.y < bounds.floor) {
        ball.position.y = bounds.floor;
        physics.velocity.y = -physics.velocity.y * 0.35;
        physics.velocity.multiplyScalar(PHYSICS_BASELINE.floorFriction);
        if (Math.abs(physics.velocity.y) < 0.4) awardPoint(ball.position.z > 0 ? 'O' : 'P');
      }
    };

    const detectPaddleContact = () => {
      const distP = ball.position.distanceTo(paddleP.position);
      if (distP < paddleP.userData.radius + 0.04 && ball.position.z > 0) {
        handlePaddleBounce(paddleP, true);
      }
      const distO = ball.position.distanceTo(paddleO.position);
      if (distO < paddleO.userData.radius + 0.04 && ball.position.z < 0) {
        handlePaddleBounce(paddleO, false);
      }
    };

    const aiLogic = (dt) => {
      aiCtrl.update(dt, ball, physics.velocity);
      const approachingAI = physics.velocity.z < 0 && ball.position.z < 0;
      if (approachingAI && Math.abs(ball.position.z - paddleO.position.z) < 0.24) {
        handlePaddleBounce(paddleO, false);
        aiCtrl.reaction = difficulty.react;
      }
    };

    const playerAuto = (dt) => {
      if (!touchCtrl.active) {
        const target = clamp(ball.position.x * 0.7, bounds.minX, bounds.maxX);
        paddleP.position.x = damp(paddleP.position.x, target, 4.6, dt);
      }
      paddleP.position.y = damp(paddleP.position.y, TABLE_SPEC.height + 0.24, 6, dt);
    };

    const physicsTick = (dt) => {
      const steps = Math.min(MAX_SUB_STEPS, Math.max(1, Math.ceil(dt / BASE_STEP)));
      const stepDt = Math.min(dt / steps, BASE_STEP);
      for (let i = 0; i < steps; i += 1) {
        physics.step(stepDt, physicsProfile);
        processTableCollision();
        processBounds();
        detectPaddleContact();
        aiLogic(stepDt);
        playerAuto(stepDt);
      }
      clampBall();
      trail.update(ball.position, physics.velocity, dt);
      camDirector.update(dt, ball.position, physics.velocity);
    };

    const animate = () => {
      const dt = Math.min(0.05, clock.getDelta() || BASE_STEP);
      physicsTick(dt);
      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(animate);
    };

    animate();

    const onResize = () => {
      const w = Math.max(1, host.clientWidth);
      const h = Math.max(1, host.clientHeight);
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };

    window.addEventListener('resize', onResize);

    const handlePointerDown = (e) => {
      const t = e.touches ? e.touches[0] : e;
      touchCtrl.begin(t.clientX, t.clientY);
      audio.current.ensure()?.resume?.();
    };
    const handlePointerMove = (e) => {
      const t = e.touches ? e.touches[0] : e;
      if (!t) return;
      touchCtrl.track(t.clientX, t.clientY, (x) => screenToTableX(renderer.domElement, x));
    };
    const handlePointerUp = (e) => {
      const t = e.changedTouches ? e.changedTouches[0] : e;
      if (!touchCtrl.active) return;
      const swipe = touchCtrl.finish(t.clientX, t.clientY);
      if (swipe.distY < 28) return;
      if (state.awaitingServe || !state.started) {
        applyShot(swipe);
      } else {
        state.queuedSwing = swipe;
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);
    renderer.domElement.addEventListener('touchstart', handlePointerDown, { passive: true });
    renderer.domElement.addEventListener('touchmove', handlePointerMove, { passive: true });
    renderer.domElement.addEventListener('touchend', handlePointerUp, { passive: true });

    resetBall();

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('touchstart', handlePointerDown);
      renderer.domElement.removeEventListener('touchmove', handlePointerMove);
      renderer.domElement.removeEventListener('touchend', handlePointerUp);
      clearTimeout(state.serveTimer);
      host.removeChild(renderer.domElement);
      renderer.dispose();
      trail.dispose(scene);
      [table, ball, paddleP, paddleO].forEach((m) => m?.geometry?.dispose?.());
      [table, ball, paddleP, paddleO].forEach((m) => m?.material?.dispose?.());
      lights.spots.forEach((s) => s.dispose?.());
    };
  }, [aiLabel, difficulty, playerLabel, profileKey, touchProfileKey]);

  return (
    <div className="relative w-full h-[100dvh] bg-[#05070d] overflow-hidden select-none">
      <div ref={hostRef} className="w-full h-full" />
      <div className="pointer-events-none absolute inset-0 flex items-start justify-center pt-3">
        <div
          className="rounded-2xl px-4 py-2 text-white shadow-lg"
          style={{
            background: 'rgba(7,10,18,0.8)',
            border: '1px solid #13203a',
            fontFamily: "'Luckiest Guy','Comic Sans MS',cursive",
            letterSpacing: 0.2,
            textShadow: '0 2px 8px rgba(0,0,0,0.45)',
          }}
        >
          Table Tennis Pro
        </div>
      </div>
      <div className="pointer-events-none absolute top-3 right-3 flex items-center gap-2 text-xs text-white/80">
        <div className="rounded-full bg-white/10 px-3 py-1 border border-white/15">Serve: {score.serving === 'P' ? 'You' : aiLabel}</div>
        <div className="rounded-full bg-white/10 px-3 py-1 border border-white/15">{playerLabel} {score.p} : {score.o} {aiLabel}</div>
      </div>
      {toast && (
        <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-8">
          <div
            className="rounded-xl px-4 py-3 text-white text-center max-w-[320px]"
            style={{
              background: 'rgba(5,7,13,0.8)',
              border: '1px solid #1a253b',
              fontFamily: "'Luckiest Guy','Comic Sans MS',cursive",
              textShadow: '-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,1px 1px 0 #000',
            }}
          >
            {score.over ? `${score.winner} wins the game!` : toast}
          </div>
        </div>
      )}
    </div>
  );
}
