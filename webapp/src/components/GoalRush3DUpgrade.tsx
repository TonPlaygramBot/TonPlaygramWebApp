'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

type Team = 'blue' | 'red';
type MatchPhase = 'ready' | 'playing' | 'goal' | 'finished';
type AnimName = 'Idle' | 'Walk' | 'Run';

type Bones = {
  hips?: THREE.Bone;
  spine?: THREE.Bone;
  rightUpLeg?: THREE.Bone;
  rightLeg?: THREE.Bone;
  rightFoot?: THREE.Bone;
  leftUpLeg?: THREE.Bone;
  leftLeg?: THREE.Bone;
  leftFoot?: THREE.Bone;
};

type PlayerState = {
  team: Team;
  group: THREE.Group;
  body: THREE.Mesh;
  head: THREE.Mesh;
  leftFoot: THREE.Mesh;
  rightFoot: THREE.Mesh;
  arrow: THREE.Mesh;
  shadow: THREE.Mesh;
  fallback: THREE.Group;
  model: THREE.Object3D | null;
  mixer: THREE.AnimationMixer | null;
  actions: Partial<Record<AnimName, THREE.AnimationAction>>;
  current: AnimName;
  bones: Bones;
  bind: WeakMap<THREE.Bone, THREE.Quaternion>;
  loaded: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  facing: THREE.Vector3;
  radius: number;
  stamina: number;
  dashCooldown: number;
  tackleCooldown: number;
  tackleTime: number;
  kickTime: number;
  kickCooldown: number;
  stunTime: number;
  possession: number;
  target: THREE.Vector3;
  name: string;
};

type BallState = {
  mesh: THREE.Mesh;
  halo: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  radius: number;
  owner: Team | null;
};

type InputState = {
  x: number;
  y: number;
  sprint: boolean;
  tackle: boolean;
  shoot: boolean;
};

type SwipeShot = {
  dir: THREE.Vector3;
  power: number;
  curve: number;
};

type HudState = {
  blue: number;
  red: number;
  clock: number;
  phase: MatchPhase;
  status: string;
  stamina: number;
  boost: string;
};

type MatchRuntime = {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  blue: PlayerState;
  red: PlayerState;
  ball: BallState;
  clock: number;
  blueScore: number;
  redScore: number;
  phase: MatchPhase;
  phaseTimer: number;
  lastGoalTeam: Team | null;
  cameraTarget: THREE.Vector3;
  particles: THREE.Group;
  crowd: THREE.Group;
};

const FIELD_W = 7.4;
const FIELD_H = 11.4;
const GOAL_W = 2.28;
const GOAL_DEPTH = 0.62;
const PLAYER_RADIUS = 0.28;
const BALL_RADIUS = 0.16;
const MATCH_SECONDS = 90;
const TARGET_SCORE = 5;
const WALK_SPEED = 3.05;
const SPRINT_SPEED = 4.85;
const AI_SPEED = 3.55;
const BALL_DAMPING = 0.985;
const WALL_BOUNCE = 0.78;
const TOUCH_RANGE = 0.62;
const KICK_RANGE = 0.78;
const DT_CAP = 1 / 32;
const TMP = new THREE.Vector3();
const TMP2 = new THREE.Vector3();
const TMP3 = new THREE.Vector3();
const BLUE = 0x21a7ff;
const RED = 0xff315a;
const HUMAN_URL = 'https://threejs.org/examples/models/gltf/Soldier.glb';
const HUMAN_HEIGHT = 1.14;

const buttonStyle: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,0.26)',
  borderRadius: 20,
  minWidth: 88,
  height: 56,
  padding: '0 16px',
  color: '#fff',
  fontWeight: 900,
  letterSpacing: 0.2,
  background: 'linear-gradient(180deg, rgba(30,41,59,0.94), rgba(15,23,42,0.9))',
  boxShadow: '0 16px 34px rgba(0,0,0,0.35)',
  touchAction: 'none'
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function damp(value: number, target: number, lambda: number, dt: number) {
  return THREE.MathUtils.damp(value, target, lambda, dt);
}

function flat(v: THREE.Vector3) {
  v.y = 0;
  return v;
}

function makeMat(color: number, roughness = 0.72, metalness = 0.03) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    emissive: new THREE.Color(color).multiplyScalar(0.035)
  });
}


function cleanBoneName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findBones(model: THREE.Object3D): Bones {
  const bones: Bones = {};
  model.traverse((object) => {
    const bone = object as THREE.Bone;
    if (!bone.isBone) return;
    const name = cleanBoneName(bone.name);
    if (!bones.hips && name.includes('hips')) bones.hips = bone;
    if (!bones.spine && name.includes('spine')) bones.spine = bone;
    if (!bones.rightUpLeg && (name.includes('rightupleg') || name.includes('rightthigh'))) bones.rightUpLeg = bone;
    if (!bones.leftUpLeg && (name.includes('leftupleg') || name.includes('leftthigh'))) bones.leftUpLeg = bone;
    if (!bones.rightLeg && !name.includes('foot') && !name.includes('upleg') && (name.includes('rightleg') || name.includes('rightcalf'))) bones.rightLeg = bone;
    if (!bones.leftLeg && !name.includes('foot') && !name.includes('upleg') && (name.includes('leftleg') || name.includes('leftcalf'))) bones.leftLeg = bone;
    if (!bones.rightFoot && name.includes('rightfoot')) bones.rightFoot = bone;
    if (!bones.leftFoot && name.includes('leftfoot')) bones.leftFoot = bone;
  });
  return bones;
}

function saveBindPose(model: THREE.Object3D) {
  const bind = new WeakMap<THREE.Bone, THREE.Quaternion>();
  model.traverse((object) => {
    const bone = object as THREE.Bone;
    if (bone.isBone) bind.set(bone, bone.quaternion.clone());
  });
  return bind;
}

function normalizeHumanModel(model: THREE.Object3D, targetHeight = HUMAN_HEIGHT) {
  model.rotation.set(0, Math.PI, 0);
  model.scale.setScalar(1);
  model.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(model);
  const height = Math.max(0.001, box.max.y - box.min.y);
  model.scale.setScalar(targetHeight / height);
  model.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box.min.y;
}

function tintHumanKit(model: THREE.Object3D, team: Team) {
  const kit = new THREE.Color(team === 'blue' ? BLUE : RED);
  const shorts = new THREE.Color(team === 'blue' ? 0x0f3b85 : 0x7f1d1d);
  model.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((raw, index) => {
      const material = raw as THREE.MeshStandardMaterial;
      if (!material.color) return;
      material.color.lerp(index % 2 ? shorts : kit, 0.38);
      material.roughness = Math.min(0.9, material.roughness ?? 0.72);
      material.needsUpdate = true;
    });
  });
}

function loadGltfHuman(loader: GLTFLoader, player: PlayerState) {
  loader.load(
    HUMAN_URL,
    (gltf) => {
      const model = gltf.scene;
      normalizeHumanModel(model);
      tintHumanKit(model, player.team);
      player.group.add(model);
      player.model = model;
      player.fallback.visible = false;
      player.bones = findBones(model);
      player.bind = saveBindPose(model);
      player.mixer = new THREE.AnimationMixer(model);
      const clips = new Map(gltf.animations.map((clip) => [clip.name.toLowerCase(), clip]));
      const aliases: Record<AnimName, string[]> = {
        Idle: ['idle'],
        Walk: ['walk', 'walking'],
        Run: ['run', 'running']
      };
      (Object.keys(aliases) as AnimName[]).forEach((name) => {
        const clip = aliases[name].map((alias) => clips.get(alias)).find(Boolean);
        if (!clip || !player.mixer) return;
        const action = player.mixer.clipAction(clip);
        action.enabled = true;
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.setEffectiveWeight(name === 'Idle' ? 1 : 0);
        action.play();
        player.actions[name] = action;
      });
      player.loaded = true;
    },
    undefined,
    () => {
      player.loaded = false;
      player.fallback.visible = true;
    }
  );
}

function setAction(player: PlayerState, next: AnimName) {
  if (player.current === next || !player.actions[next]) return;
  const previous = player.actions[player.current];
  const action = player.actions[next];
  if (previous && action) {
    action.enabled = true;
    action.reset();
    action.setEffectiveWeight(1);
    previous.crossFadeTo(action, 0.16, false);
    action.play();
  }
  player.current = next;
}

function applyBoneKickPose(player: PlayerState) {
  if (!player.model || player.kickTime <= 0) return;
  const t = 1 - player.kickTime / 0.26;
  const strike = Math.sin(clamp(t, 0, 1) * Math.PI);
  const shootingRight = player.pos.x <= 0;
  const upper = shootingRight ? player.bones.rightUpLeg : player.bones.leftUpLeg;
  const lower = shootingRight ? player.bones.rightLeg : player.bones.leftLeg;
  const foot = shootingRight ? player.bones.rightFoot : player.bones.leftFoot;
  const plant = shootingRight ? player.bones.leftUpLeg : player.bones.rightUpLeg;
  if (player.bones.hips) player.bones.hips.rotation.z += (shootingRight ? -1 : 1) * 0.08 * strike;
  if (player.bones.spine) player.bones.spine.rotation.x += -0.08 * strike;
  if (upper) upper.rotation.x += 1.12 * strike;
  if (lower) lower.rotation.x += -0.72 * strike;
  if (foot) foot.rotation.x += -0.42 * strike;
  if (plant) plant.rotation.x += -0.14 * strike;
}

function applyBodyBehaviour(player: PlayerState, dt: number) {
  const speedRatio = clamp(player.vel.length() / SPRINT_SPEED, 0, 1);
  const next: AnimName = player.stunTime > 0 || player.tackleTime > 0 || player.kickTime > 0 ? 'Idle' : speedRatio > 0.72 ? 'Run' : speedRatio > 0.08 ? 'Walk' : 'Idle';
  setAction(player, next);
  if (player.actions.Walk) player.actions.Walk.timeScale = clamp(player.vel.length() / WALK_SPEED, 0.75, 1.35);
  if (player.actions.Run) player.actions.Run.timeScale = clamp(player.vel.length() / SPRINT_SPEED, 0.75, 1.3);
  player.mixer?.update(dt);
  applyBoneKickPose(player);

  const stride = Math.sin(performance.now() * (speedRatio > 0.72 ? 0.018 : 0.012)) * speedRatio;
  player.leftFoot.rotation.x = stride * 0.8;
  player.rightFoot.rotation.x = -stride * 0.8;
  player.body.rotation.z = -player.vel.x * 0.035;
  player.body.rotation.x = player.tackleTime > 0 ? -0.48 * (player.tackleTime / 0.28) : 0;
  player.head.rotation.x = player.stunTime > 0 ? 0.24 : 0;
  player.fallback.position.y = player.stunTime > 0 ? -0.03 : 0;
  if (player.tackleTime > 0 && player.bones.hips) player.bones.hips.rotation.x += -0.38 * (player.tackleTime / 0.28);
  if (player.tackleTime > 0 && player.bones.spine) player.bones.spine.rotation.x += 0.32 * (player.tackleTime / 0.28);
  if (player.stunTime > 0) player.group.rotation.z = (player.team === 'blue' ? -1 : 1) * 0.12 * (player.stunTime / 0.48);
  else player.group.rotation.z = 0;
  player.kickTime = Math.max(0, player.kickTime - dt);
}

function canvasTexture(draw: (ctx: CanvasRenderingContext2D, size: number) => void) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function createPitchTexture() {
  return canvasTexture((ctx, size) => {
    const stripeW = size / 8;
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#15803d' : '#16a34a';
      ctx.fillRect(i * stripeW, 0, stripeW, size);
    }
    ctx.globalAlpha = 0.16;
    for (let y = 0; y < size; y += 18) {
      ctx.fillStyle = y % 36 === 0 ? '#dcfce7' : '#052e16';
      ctx.fillRect(0, y, size, 2);
    }
    ctx.globalAlpha = 1;
  });
}

function createBallTexture() {
  return canvasTexture((ctx, size) => {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#111827';
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 5;
    for (let y = 44; y < size; y += 92) {
      for (let x = (Math.round(y / 92) % 2 ? 68 : 24); x < size; x += 106) {
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
          const px = x + Math.cos(a) * 18;
          const py = y + Math.sin(a) * 18;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
          ctx.beginPath();
          ctx.moveTo(x + Math.cos(a) * 22, y + Math.sin(a) * 22);
          ctx.lineTo(x + Math.cos(a) * 48, y + Math.sin(a) * 48);
          ctx.stroke();
        }
      }
    }
  });
}

function addLine(scene: THREE.Scene, points: THREE.Vector3[], color = 0xffffff, opacity = 0.8) {
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity })
  );
  line.position.y = 0.014;
  scene.add(line);
  return line;
}

function addBox(
  parent: THREE.Object3D,
  size: [number, number, number],
  pos: [number, number, number],
  color: number,
  roughness = 0.65,
  metalness = 0.05
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), makeMat(color, roughness, metalness));
  mesh.position.set(...pos);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function makeNet(width: number, height: number, depth: number, team: Team) {
  const group = new THREE.Group();
  const color = team === 'blue' ? BLUE : RED;
  const matLine = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.56 });
  const glow = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.72 });
  for (let i = 0; i <= 10; i++) {
    const x = -width / 2 + (i / 10) * width;
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, 0, 0),
      new THREE.Vector3(x, height, -depth)
    ]), i === 0 || i === 10 ? glow : matLine));
  }
  for (let j = 0; j <= 6; j++) {
    const y = (j / 6) * height;
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-width / 2, y, -depth * 0.12),
      new THREE.Vector3(width / 2, y, -depth * 0.12)
    ]), matLine));
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-width / 2, y, -depth),
      new THREE.Vector3(width / 2, y, -depth)
    ]), matLine));
  }
  return group;
}


function makeStadiumBowl(scene: THREE.Scene) {
  const crowd = new THREE.Group();
  const concrete = makeMat(0x64748b, 0.86, 0.04);
  const riserMat = makeMat(0x334155, 0.8, 0.05);
  const railMat = makeMat(0xdbeafe, 0.45, 0.2);
  const chairMats = [makeMat(BLUE, 0.72, 0.02), makeMat(0xffffff, 0.72, 0.02), makeMat(RED, 0.72, 0.02)];
  const fanMats = [makeMat(BLUE, 0.8), makeMat(RED, 0.8), makeMat(0xfacc15, 0.8), makeMat(0x22c55e, 0.8), makeMat(0xa855f7, 0.8)];
  const sides = [
    { width: FIELD_W + 1.6, rows: 5, pos: new THREE.Vector3(0, 0, FIELD_H / 2 + 1.02), rot: Math.PI },
    { width: FIELD_W + 1.6, rows: 5, pos: new THREE.Vector3(0, 0, -FIELD_H / 2 - 1.02), rot: 0 },
    { width: FIELD_H + 1.3, rows: 4, pos: new THREE.Vector3(FIELD_W / 2 + 1.02, 0, 0), rot: Math.PI / 2 },
    { width: FIELD_H + 1.3, rows: 4, pos: new THREE.Vector3(-FIELD_W / 2 - 1.02, 0, 0), rot: -Math.PI / 2 }
  ];

  sides.forEach((side, sideIndex) => {
    const stand = new THREE.Group();
    stand.position.copy(side.pos);
    stand.rotation.y = side.rot;
    const cols = Math.max(16, Math.floor(side.width / 0.34));
    const rowDepth = 0.34;
    const rowRise = 0.17;
    for (let row = 0; row < side.rows; row++) {
      const tread = new THREE.Mesh(new THREE.BoxGeometry(side.width, 0.08, rowDepth), concrete);
      tread.position.set(0, 0.16 + row * rowRise, -row * rowDepth);
      const riser = new THREE.Mesh(new THREE.BoxGeometry(side.width, rowRise, 0.045), riserMat);
      riser.position.set(0, 0.12 + row * rowRise, -row * rowDepth + rowDepth * 0.47);
      stand.add(tread, riser);
      for (let col = 0; col < cols; col++) {
        const x = (col - (cols - 1) / 2) * (side.width / cols);
        if (Math.abs(col - cols * 0.33) < 1 || Math.abs(col - cols * 0.66) < 1) continue;
        const chair = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.16), chairMats[(col + row + sideIndex) % chairMats.length]);
        chair.position.set(x, 0.23 + row * rowRise, -row * rowDepth + 0.04);
        stand.add(chair);
        if ((col + row + sideIndex) % 2 === 0) {
          const fan = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.14, 4, 8), fanMats[(col + row) % fanMats.length]);
          fan.position.set(x, 0.36 + row * rowRise, -row * rowDepth + 0.03);
          fan.userData.baseY = fan.position.y;
          fan.userData.phase = col * 0.37 + row * 0.91;
          stand.add(fan);
        }
      }
    }
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(side.width + 0.25, 0.75, 0.08), riserMat);
    backWall.position.set(0, 0.56, -(side.rows - 1) * rowDepth - 0.34);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(side.width + 0.16, 0.045, 0.045), railMat);
    rail.position.set(0, 0.43, 0.23);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(side.width + 0.42, 0.055, 1.05), makeMat(0x0f172a, 0.58, 0.22));
    roof.position.set(0, 1.28, -(side.rows - 1) * rowDepth - 0.22);
    roof.rotation.x = -0.12;
    stand.add(backWall, rail, roof);
    stand.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    crowd.add(stand);
  });

  const poleMat = makeMat(0xe2e8f0, 0.4, 0.24);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.065, 3.2, 14), poleMat);
    pole.position.set(sx * (FIELD_W / 2 + 0.72), 1.6, sz * (FIELD_H / 2 + 0.72));
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.22, 0.14), new THREE.MeshBasicMaterial({ color: 0xf8fafc }));
    lamp.position.set(pole.position.x, 3.12, pole.position.z);
    lamp.lookAt(0, 0, 0);
    const light = new THREE.PointLight(0xdbeafe, 1.2, 8);
    light.position.copy(lamp.position);
    scene.add(pole, lamp, light);
  });

  scene.add(crowd);
  return crowd;
}

function buildArena(scene: THREE.Scene) {
  scene.background = new THREE.Color(0x06130d);
  scene.fog = new THREE.Fog(0x06130d, 12, 23);

  const pitchTexture = createPitchTexture();
  pitchTexture.wrapS = THREE.RepeatWrapping;
  pitchTexture.wrapT = THREE.RepeatWrapping;
  pitchTexture.repeat.set(1.5, 2.2);
  const pitch = new THREE.Mesh(
    new THREE.PlaneGeometry(FIELD_W, FIELD_H),
    new THREE.MeshStandardMaterial({ map: pitchTexture, roughness: 0.92 })
  );
  pitch.rotation.x = -Math.PI / 2;
  pitch.receiveShadow = true;
  scene.add(pitch);

  const board = new THREE.Group();
  scene.add(board);
  addBox(board, [FIELD_W + 0.42, 0.36, 0.16], [0, 0.18, FIELD_H / 2 + 0.08], 0x0f172a, 0.42, 0.15);
  addBox(board, [FIELD_W + 0.42, 0.36, 0.16], [0, 0.18, -FIELD_H / 2 - 0.08], 0x0f172a, 0.42, 0.15);
  addBox(board, [0.16, 0.36, FIELD_H + 0.32], [FIELD_W / 2 + 0.08, 0.18, 0], 0x0f172a, 0.42, 0.15);
  addBox(board, [0.16, 0.36, FIELD_H + 0.32], [-FIELD_W / 2 - 0.08, 0.18, 0], 0x0f172a, 0.42, 0.15);

  addLine(scene, [new THREE.Vector3(-FIELD_W / 2, 0, 0), new THREE.Vector3(FIELD_W / 2, 0, 0)], 0xffffff, 0.78);
  const circle: THREE.Vector3[] = [];
  for (let i = 0; i <= 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    circle.push(new THREE.Vector3(Math.cos(a) * 1.05, 0, Math.sin(a) * 1.05));
  }
  addLine(scene, circle, 0xffffff, 0.62);
  const blueBox = [
    new THREE.Vector3(-1.65, 0, FIELD_H / 2 - 1.34),
    new THREE.Vector3(1.65, 0, FIELD_H / 2 - 1.34),
    new THREE.Vector3(1.65, 0, FIELD_H / 2),
    new THREE.Vector3(-1.65, 0, FIELD_H / 2),
    new THREE.Vector3(-1.65, 0, FIELD_H / 2 - 1.34)
  ];
  addLine(scene, blueBox, BLUE, 0.7);
  addLine(scene, blueBox.map((p) => p.clone().multiply(new THREE.Vector3(1, 1, -1))), RED, 0.7);

  const goalBlue = new THREE.Group();
  goalBlue.position.set(0, 0.02, FIELD_H / 2 + 0.08);
  goalBlue.rotation.y = Math.PI;
  goalBlue.add(makeNet(GOAL_W, 1.34, GOAL_DEPTH, 'blue'));
  addBox(goalBlue, [GOAL_W + 0.12, 0.08, 0.08], [0, 1.3, -0.02], BLUE, 0.3, 0.35);
  addBox(goalBlue, [0.08, 1.34, 0.08], [-GOAL_W / 2, 0.67, -0.02], BLUE, 0.3, 0.35);
  addBox(goalBlue, [0.08, 1.34, 0.08], [GOAL_W / 2, 0.67, -0.02], BLUE, 0.3, 0.35);
  scene.add(goalBlue);

  const goalRed = new THREE.Group();
  goalRed.position.set(0, 0.02, -FIELD_H / 2 - 0.08);
  goalRed.add(makeNet(GOAL_W, 1.34, GOAL_DEPTH, 'red'));
  addBox(goalRed, [GOAL_W + 0.12, 0.08, 0.08], [0, 1.3, -0.02], RED, 0.3, 0.35);
  addBox(goalRed, [0.08, 1.34, 0.08], [-GOAL_W / 2, 0.67, -0.02], RED, 0.3, 0.35);
  addBox(goalRed, [0.08, 1.34, 0.08], [GOAL_W / 2, 0.67, -0.02], RED, 0.3, 0.35);
  scene.add(goalRed);

  const crowd = makeStadiumBowl(scene);

  const particles = new THREE.Group();
  scene.add(particles);
  return { crowd, particles };
}

function makePlayer(loader: GLTFLoader, team: Team, name: string, x: number, z: number) {
  const group = new THREE.Group();
  const color = team === 'blue' ? BLUE : RED;
  const dark = team === 'blue' ? 0x0f3b85 : 0x7f1d1d;
  const fallback = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.58, 7, 14), makeMat(color, 0.58, 0.08));
  body.position.y = 0.58;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 16), makeMat(0xf6c8a6, 0.82));
  head.position.y = 1.02;
  const leftFoot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.07, 0.29), makeMat(dark, 0.62));
  leftFoot.position.set(-0.11, 0.06, 0.11);
  const rightFoot = leftFoot.clone();
  rightFoot.position.x = 0.11;
  const arrow = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.42, 3),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.78 })
  );
  arrow.position.set(0, 1.26, 0.1);
  arrow.rotation.x = Math.PI / 2;
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.34, 28),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  fallback.add(body, head, leftFoot, rightFoot);
  group.add(shadow, fallback, arrow);
  group.position.set(x, 0, z);
  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
  const player = {
    team,
    group,
    body,
    head,
    leftFoot,
    rightFoot,
    arrow,
    shadow,
    fallback,
    model: null,
    mixer: null,
    actions: {},
    current: 'Idle' as AnimName,
    bones: {},
    bind: new WeakMap<THREE.Bone, THREE.Quaternion>(),
    loaded: false,
    pos: new THREE.Vector3(x, 0, z),
    vel: new THREE.Vector3(),
    facing: new THREE.Vector3(0, 0, team === 'blue' ? -1 : 1),
    radius: PLAYER_RADIUS,
    stamina: 1,
    dashCooldown: 0,
    tackleCooldown: 0,
    tackleTime: 0,
    kickTime: 0,
    kickCooldown: 0,
    stunTime: 0,
    possession: 0,
    target: new THREE.Vector3(x, 0, z),
    name
  } satisfies PlayerState;
  loadGltfHuman(loader, player);
  return player;
}

function makeBall() {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS, 32, 18),
    new THREE.MeshStandardMaterial({ map: createBallTexture(), roughness: 0.5, metalness: 0.02 })
  );
  mesh.position.y = BALL_RADIUS;
  mesh.castShadow = true;
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(0.24, 0.32, 36),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, side: THREE.DoubleSide })
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.022;
  return {
    mesh,
    halo,
    pos: new THREE.Vector3(0, BALL_RADIUS, 0),
    vel: new THREE.Vector3(),
    spin: new THREE.Vector3(),
    radius: BALL_RADIUS,
    owner: null
  } satisfies BallState;
}

function resetKickoff(match: MatchRuntime, nextAttack: Team | null = null) {
  const blueZ = nextAttack === 'blue' ? 1.05 : 2.1;
  const redZ = nextAttack === 'red' ? -1.05 : -2.1;
  match.blue.pos.set(-0.72, 0, blueZ);
  match.red.pos.set(0.72, 0, redZ);
  match.blue.vel.set(0, 0, 0);
  match.red.vel.set(0, 0, 0);
  match.blue.facing.set(0, 0, -1);
  match.red.facing.set(0, 0, 1);
  match.blue.stunTime = 0;
  match.red.stunTime = 0;
  match.ball.pos.set(0, BALL_RADIUS, 0);
  match.ball.vel.set(nextAttack === 'red' ? 0.45 : nextAttack === 'blue' ? -0.45 : 0, 0, nextAttack === 'red' ? -0.2 : 0.2);
  match.ball.owner = null;
  match.phase = 'playing';
  match.phaseTimer = 0;
}

function kickBall(ball: BallState, p: PlayerState, dir: THREE.Vector3, power: number, curve = 0) {
  const shotDir = flat(dir.clone()).normalize();
  if (shotDir.lengthSq() < 0.1) shotDir.copy(p.facing);
  ball.owner = null;
  ball.vel.copy(shotDir.multiplyScalar(power));
  ball.vel.x += curve * 0.55;
  ball.spin.set(curve * 3.4, 0, -ball.vel.x * 1.5);
  p.kickCooldown = 0.22;
  p.kickTime = 0.26;
  p.pos.addScaledVector(shotDir, -0.045);
}

function movePlayer(p: PlayerState, desired: THREE.Vector3, topSpeed: number, dt: number) {
  if (p.stunTime > 0) {
    p.stunTime = Math.max(0, p.stunTime - dt);
    desired.multiplyScalar(0.15);
  }
  const len = desired.length();
  if (len > 1) desired.multiplyScalar(1 / len);
  const speed = topSpeed * clamp(len, 0, 1);
  TMP.copy(desired).multiplyScalar(speed);
  p.vel.lerp(TMP, 1 - Math.pow(0.0007, dt));
  p.pos.addScaledVector(p.vel, dt);
  p.pos.x = clamp(p.pos.x, -FIELD_W / 2 + p.radius, FIELD_W / 2 - p.radius);
  p.pos.z = clamp(p.pos.z, -FIELD_H / 2 + p.radius, FIELD_H / 2 - p.radius);
  if (p.vel.lengthSq() > 0.02) p.facing.lerp(p.vel.clone().normalize(), 1 - Math.pow(0.02, dt)).normalize();
  p.group.position.copy(p.pos);
  p.group.rotation.y = Math.atan2(p.facing.x, p.facing.z);
  applyBodyBehaviour(p, dt);
  p.arrow.visible = p.team === 'blue';
  (p.arrow.material as THREE.MeshBasicMaterial).opacity = 0.56 + Math.sin(performance.now() * 0.008) * 0.12;
  p.dashCooldown = Math.max(0, p.dashCooldown - dt);
  p.tackleCooldown = Math.max(0, p.tackleCooldown - dt);
  p.tackleTime = Math.max(0, p.tackleTime - dt);
  p.kickCooldown = Math.max(0, p.kickCooldown - dt);
}

function resolvePlayerCollision(a: PlayerState, b: PlayerState) {
  TMP.copy(a.pos).sub(b.pos);
  const distance = TMP.length();
  const minDistance = a.radius + b.radius;
  if (distance <= 0.001 || distance >= minDistance) return;
  TMP.multiplyScalar((minDistance - distance) / distance / 2);
  a.pos.add(TMP);
  b.pos.sub(TMP);
  const shove = a.vel.clone().sub(b.vel).dot(TMP.normalize());
  if (shove < 0) return;
  a.vel.addScaledVector(TMP, -shove * 0.25);
  b.vel.addScaledVector(TMP, shove * 0.25);
}

function nearestGoalDir(team: Team, from: THREE.Vector3) {
  return new THREE.Vector3(0, 0, team === 'blue' ? -FIELD_H / 2 - 0.45 : FIELD_H / 2 + 0.45).sub(from).setY(0).normalize();
}

function updateBall(match: MatchRuntime, dt: number) {
  const { ball } = match;
  if (ball.owner) {
    const owner = ball.owner === 'blue' ? match.blue : match.red;
    ball.pos.copy(owner.pos).addScaledVector(owner.facing, 0.42).setY(BALL_RADIUS);
    ball.vel.copy(owner.vel).addScaledVector(owner.facing, 0.7);
    owner.possession = Math.min(1, owner.possession + dt * 2.2);
  } else {
    ball.vel.x += ball.spin.x * dt * 0.22;
    ball.pos.addScaledVector(ball.vel, dt);
    ball.vel.multiplyScalar(Math.pow(BALL_DAMPING, dt * 60));
    ball.spin.multiplyScalar(Math.pow(0.965, dt * 60));
  }

  if (Math.abs(ball.pos.x) > FIELD_W / 2 - BALL_RADIUS) {
    ball.pos.x = Math.sign(ball.pos.x) * (FIELD_W / 2 - BALL_RADIUS);
    ball.vel.x *= -WALL_BOUNCE;
    ball.owner = null;
  }

  const inGoalMouth = Math.abs(ball.pos.x) < GOAL_W / 2;
  if (ball.pos.z < -FIELD_H / 2 - BALL_RADIUS * 0.2 && inGoalMouth) scoreGoal(match, 'blue');
  else if (ball.pos.z > FIELD_H / 2 + BALL_RADIUS * 0.2 && inGoalMouth) scoreGoal(match, 'red');
  else if (Math.abs(ball.pos.z) > FIELD_H / 2 - BALL_RADIUS) {
    ball.pos.z = Math.sign(ball.pos.z) * (FIELD_H / 2 - BALL_RADIUS);
    ball.vel.z *= -WALL_BOUNCE;
    ball.owner = null;
  }

  ball.mesh.position.copy(ball.pos);
  ball.mesh.rotation.x += ball.vel.z * dt * 3.2;
  ball.mesh.rotation.z -= ball.vel.x * dt * 3.2;
  ball.halo.position.set(ball.pos.x, 0.025, ball.pos.z);
  (ball.halo.material as THREE.MeshBasicMaterial).opacity = ball.owner ? 0.36 : 0.18;
}

function tryAcquireBall(match: MatchRuntime, p: PlayerState, dt: number) {
  if (match.ball.owner && match.ball.owner !== p.team) return;
  const distance = flat(match.ball.pos.clone().sub(p.pos)).length();
  if (distance > TOUCH_RANGE || p.kickCooldown > 0 || p.stunTime > 0) return;
  const goalDir = nearestGoalDir(p.team, p.pos);
  const facingTouch = p.facing.dot(goalDir) > -0.5 || distance < 0.42;
  if (!match.ball.owner && (facingTouch || match.ball.vel.length() < 2.3)) {
    match.ball.owner = p.team;
    p.possession = Math.max(p.possession, 0.18);
  }
}

function scoreGoal(match: MatchRuntime, team: Team) {
  if (match.phase === 'goal' || match.phase === 'finished') return;
  if (team === 'blue') match.blueScore += 1;
  else match.redScore += 1;
  match.lastGoalTeam = team;
  match.phase = match.blueScore >= TARGET_SCORE || match.redScore >= TARGET_SCORE ? 'finished' : 'goal';
  match.phaseTimer = match.phase === 'finished' ? 4 : 1.6;
  match.ball.owner = null;
  match.ball.vel.set(0, 0, 0);
  emitGoalBurst(match, team);
}

function emitGoalBurst(match: MatchRuntime, team: Team) {
  const color = team === 'blue' ? BLUE : RED;
  const z = team === 'blue' ? -FIELD_H / 2 : FIELD_H / 2;
  for (let i = 0; i < 28; i++) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 8, 6),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 })
    );
    mesh.position.set((Math.random() - 0.5) * GOAL_W, 0.35 + Math.random() * 0.8, z);
    mesh.userData.vel = new THREE.Vector3((Math.random() - 0.5) * 2.8, Math.random() * 2.2, (team === 'blue' ? 1 : -1) * (1.2 + Math.random() * 2.2));
    mesh.userData.life = 1.1;
    match.particles.add(mesh);
  }
}

function updateParticles(group: THREE.Group, dt: number) {
  [...group.children].forEach((child) => {
    const mesh = child as THREE.Mesh;
    const vel = mesh.userData.vel as THREE.Vector3 | undefined;
    if (!vel) return;
    vel.y -= 2.4 * dt;
    mesh.position.addScaledVector(vel, dt);
    mesh.userData.life -= dt;
    const material = mesh.material as THREE.MeshBasicMaterial;
    material.opacity = clamp(mesh.userData.life, 0, 1);
    if (mesh.userData.life <= 0) group.remove(mesh);
  });
}

function updateAi(match: MatchRuntime, dt: number) {
  const ai = match.red;
  const ball = match.ball;
  const attacking = ball.owner === 'red' || ball.pos.z < 0.9;
  const danger = ball.pos.z > FIELD_H / 2 - 2.6;

  if (ball.owner === 'red') {
    const lane = Math.abs(ai.pos.x) < 0.62 ? (ai.pos.x >= 0 ? 1 : -1) : -Math.sign(ai.pos.x);
    ai.target.set(lane * 0.95, 0, FIELD_H / 2 - 0.9);
    if (ai.pos.z > FIELD_H / 2 - 1.65 || ai.possession > 0.52) {
      const aim = new THREE.Vector3(clamp(-ai.pos.x * 0.42, -0.75, 0.75), 0, 1).normalize();
      kickBall(ball, ai, aim, 5.3 + Math.random() * 0.9, (Math.random() - 0.5) * 0.8);
      ai.possession = 0;
    }
  } else if (attacking) {
    ai.target.copy(ball.pos).setY(0).add(new THREE.Vector3(clamp(ball.pos.x * 0.2, -0.3, 0.3), 0, -0.25));
  } else if (danger) {
    ai.target.set(clamp(ball.pos.x, -1.18, 1.18), 0, FIELD_H / 2 - 1.05);
  } else {
    ai.target.set(clamp(ball.pos.x * 0.55, -1.55, 1.55), 0, 1.1);
  }

  TMP.copy(ai.target).sub(ai.pos).setY(0);
  const desired = TMP.length() > 0.05 ? TMP.normalize() : TMP.set(0, 0, 0);
  const burst = danger || ball.owner === 'red' ? 0.35 : 0;
  movePlayer(ai, desired, AI_SPEED + burst, dt);

  const distance = flat(ball.pos.clone().sub(ai.pos)).length();
  const blueDistance = flat(match.blue.pos.clone().sub(ai.pos)).length();
  if (ball.owner === 'blue' && blueDistance < 0.66 && ai.tackleCooldown <= 0) {
    ai.tackleCooldown = 0.9;
    ai.tackleTime = 0.24;
    match.blue.stunTime = 0.26;
    ball.owner = null;
    ball.vel.copy(ai.facing).multiplyScalar(2.1);
  } else if (distance < KICK_RANGE && !ball.owner && ai.kickCooldown <= 0 && ball.pos.z < ai.pos.z + 0.25) {
    kickBall(ball, ai, nearestGoalDir('red', ai.pos), 4.8, (Math.random() - 0.5) * 0.7);
  }
}

function updateHuman(match: MatchRuntime, input: InputState, shot: SwipeShot | null, dt: number) {
  const p = match.blue;
  const desired = new THREE.Vector3(input.x, 0, input.y);
  const sprinting = input.sprint && p.stamina > 0.08 && desired.lengthSq() > 0.08;
  const topSpeed = sprinting ? SPRINT_SPEED : WALK_SPEED;
  if (sprinting) p.stamina = Math.max(0, p.stamina - dt * 0.34);
  else p.stamina = Math.min(1, p.stamina + dt * 0.22);

  if (input.tackle && p.tackleCooldown <= 0 && p.stamina > 0.16) {
    p.tackleTime = 0.28;
    p.tackleCooldown = 0.82;
    p.stamina -= 0.14;
    p.vel.addScaledVector(p.facing, 2.25);
    const rival = match.red;
    if (flat(rival.pos.clone().sub(p.pos)).length() < 0.78 && p.facing.dot(rival.pos.clone().sub(p.pos).normalize()) > 0.1) {
      rival.stunTime = 0.48;
      if (match.ball.owner === 'red') {
        match.ball.owner = null;
        match.ball.vel.copy(p.facing).multiplyScalar(2.6);
      }
    }
  }

  movePlayer(p, desired, topSpeed, dt);

  const ballDistance = flat(match.ball.pos.clone().sub(p.pos)).length();
  if (shot && ballDistance < KICK_RANGE && p.kickCooldown <= 0) {
    const adjusted = shot.dir.clone();
    if (adjusted.z > -0.2) adjusted.z = -0.35;
    kickBall(match.ball, p, adjusted.normalize(), shot.power, shot.curve);
    p.possession = 0;
  } else if (input.shoot && ballDistance < KICK_RANGE && p.kickCooldown <= 0) {
    kickBall(match.ball, p, nearestGoalDir('blue', p.pos), 4.35, -p.pos.x * 0.22);
    p.possession = 0;
  }
}

function updateCamera(match: MatchRuntime, dt: number) {
  match.cameraTarget.lerp(match.ball.pos, 1 - Math.pow(0.015, dt));
  const targetZ = clamp(match.cameraTarget.z + 5.5, -0.9, 6.4);
  const targetX = clamp(match.cameraTarget.x * 0.45 + match.blue.pos.x * 0.2, -2.1, 2.1);
  match.camera.position.x = damp(match.camera.position.x, targetX, 4.5, dt);
  match.camera.position.y = damp(match.camera.position.y, 8.8, 4.5, dt);
  match.camera.position.z = damp(match.camera.position.z, targetZ, 4.5, dt);
  TMP.set(match.cameraTarget.x * 0.18, 0, clamp(match.cameraTarget.z - 0.65, -3.1, 2.7));
  match.camera.lookAt(TMP);
}

function updateMatch(match: MatchRuntime, input: InputState, pendingShot: React.MutableRefObject<SwipeShot | null>, dt: number) {
  if (match.phase === 'ready') {
    match.phaseTimer -= dt;
    if (match.phaseTimer <= 0) resetKickoff(match);
    return;
  }

  if (match.phase === 'goal') {
    match.phaseTimer -= dt;
    updateParticles(match.particles, dt);
    updateCamera(match, dt);
    if (match.phaseTimer <= 0) resetKickoff(match, match.lastGoalTeam === 'blue' ? 'red' : 'blue');
    return;
  }

  if (match.phase === 'finished') {
    match.phaseTimer -= dt;
    updateParticles(match.particles, dt);
    updateCamera(match, dt);
    if (match.phaseTimer <= 0) {
      match.blueScore = 0;
      match.redScore = 0;
      match.clock = MATCH_SECONDS;
      resetKickoff(match);
    }
    return;
  }

  match.clock = Math.max(0, match.clock - dt);
  if (match.clock <= 0) {
    match.phase = 'finished';
    match.phaseTimer = 4;
  }

  const shot = pendingShot.current;
  pendingShot.current = null;
  updateHuman(match, input, shot, dt);
  updateAi(match, dt);
  resolvePlayerCollision(match.blue, match.red);
  tryAcquireBall(match, match.blue, dt);
  tryAcquireBall(match, match.red, dt);
  updateBall(match, dt);
  updateParticles(match.particles, dt);
  updateCamera(match, dt);

  match.crowd.traverse((object) => {
    if (typeof object.userData.baseY !== 'number') return;
    object.position.y = object.userData.baseY + Math.sin(performance.now() * 0.006 + object.userData.phase) * 0.035;
  });
}

function createMatch(canvas: HTMLCanvasElement, host: HTMLElement) {
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
  renderer.setSize(host.clientWidth, host.clientHeight, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const camera = new THREE.PerspectiveCamera(46, host.clientWidth / Math.max(1, host.clientHeight), 0.1, 80);
  camera.position.set(0, 8.8, 5.5);

  scene.add(new THREE.HemisphereLight(0xa7f3d0, 0x07110b, 1.4));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(-3.6, 8.6, 5.6);
  key.castShadow = true;
  key.shadow.mapSize.set(1536, 1536);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 22;
  key.shadow.camera.left = -8;
  key.shadow.camera.right = 8;
  key.shadow.camera.top = 10;
  key.shadow.camera.bottom = -10;
  scene.add(key);

  const { crowd, particles } = buildArena(scene);
  const loader = new GLTFLoader();
  const blue = makePlayer(loader, 'blue', 'You', -0.72, 2.1);
  const red = makePlayer(loader, 'red', 'Rival', 0.72, -2.1);
  const ball = makeBall();
  scene.add(blue.group, red.group, ball.mesh, ball.halo);

  const match: MatchRuntime = {
    scene,
    renderer,
    camera,
    blue,
    red,
    ball,
    clock: MATCH_SECONDS,
    blueScore: 0,
    redScore: 0,
    phase: 'ready',
    phaseTimer: 1.0,
    lastGoalTeam: null,
    cameraTarget: new THREE.Vector3(),
    particles,
    crowd
  };

  return match;
}

function formatClock(seconds: number) {
  const s = Math.ceil(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function hudFromMatch(match: MatchRuntime): HudState {
  const leader = match.blueScore === match.redScore ? 'Next goal shifts momentum' : match.blueScore > match.redScore ? 'Blue is leading' : 'Red is leading';
  const status =
    match.phase === 'ready'
      ? 'Kickoff loading — drag the stick and swipe to shoot.'
      : match.phase === 'goal'
        ? `${match.lastGoalTeam === 'blue' ? 'BLUE' : 'RED'} GOAL! Resetting kickoff.`
        : match.phase === 'finished'
          ? match.blueScore === match.redScore
            ? 'Full time draw — instant rematch.'
            : `${match.blueScore > match.redScore ? 'BLUE' : 'RED'} wins — instant rematch.`
          : match.ball.owner === 'blue'
            ? 'Dribble, sprint into space, then swipe toward goal.'
            : match.ball.owner === 'red'
              ? 'Chase back and tap tackle to steal possession.'
              : leader;
  return {
    blue: match.blueScore,
    red: match.redScore,
    clock: match.clock,
    phase: match.phase,
    status,
    stamina: match.blue.stamina,
    boost: match.blue.tackleCooldown > 0 ? 'Recovering' : match.blue.stamina < 0.2 ? 'Low stamina' : 'Ready'
  };
}

export default function GoalRush3DUpgrade() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const joyBase = useRef<HTMLDivElement | null>(null);
  const joyKnob = useRef<HTMLDivElement | null>(null);
  const input = useRef<InputState>({ x: 0, y: 0, sprint: false, tackle: false, shoot: false });
  const stickPointer = useRef<number | null>(null);
  const swipe = useRef({ pointerId: null as number | null, x: 0, y: 0, active: false });
  const pendingShot = useRef<SwipeShot | null>(null);
  const matchRef = useRef<MatchRuntime | null>(null);
  const [hud, setHud] = useState<HudState>({ blue: 0, red: 0, clock: MATCH_SECONDS, phase: 'ready', status: 'Building arena…', stamina: 1, boost: 'Ready' });

  const researchNotes = useMemo(
    () => [
      'Fast 90-second rounds',
      '1v1 duels with boards always in play',
      'Swipe shots, sprint stamina, tackle recovery',
      'AI rotates between keeper, press, and counter-attack lanes'
    ],
    []
  );

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const match = createMatch(canvas, host);
    matchRef.current = match;
    let raf = 0;
    let last = performance.now();
    let hudTimer = 0;

    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      match.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
      match.renderer.setSize(width, height, false);
      match.camera.aspect = width / height;
      match.camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    window.addEventListener('resize', resize);
    resize();

    const loop = (now: number) => {
      const dt = Math.min(DT_CAP, Math.max(0.001, (now - last) / 1000));
      last = now;
      updateMatch(match, input.current, pendingShot, dt);
      match.renderer.render(match.scene, match.camera);
      hudTimer += dt;
      if (hudTimer > 0.08) {
        hudTimer = 0;
        setHud(hudFromMatch(match));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('resize', resize);
      match.scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry?.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((material) => material?.dispose());
      });
      match.renderer.dispose();
      matchRef.current = null;
    };
  }, []);

  useEffect(() => {
    const keyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'KeyW'].includes(e.code)) input.current.y = -1;
      if (['ArrowDown', 'KeyS'].includes(e.code)) input.current.y = 1;
      if (['ArrowLeft', 'KeyA'].includes(e.code)) input.current.x = -1;
      if (['ArrowRight', 'KeyD'].includes(e.code)) input.current.x = 1;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.current.sprint = true;
      if (e.code === 'Space') input.current.shoot = true;
      if (e.code === 'KeyE') input.current.tackle = true;
    };
    const keyUp = (e: KeyboardEvent) => {
      if (['ArrowUp', 'KeyW'].includes(e.code) && input.current.y < 0) input.current.y = 0;
      if (['ArrowDown', 'KeyS'].includes(e.code) && input.current.y > 0) input.current.y = 0;
      if (['ArrowLeft', 'KeyA'].includes(e.code) && input.current.x < 0) input.current.x = 0;
      if (['ArrowRight', 'KeyD'].includes(e.code) && input.current.x > 0) input.current.x = 0;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.current.sprint = false;
      if (e.code === 'Space') input.current.shoot = false;
      if (e.code === 'KeyE') input.current.tackle = false;
    };
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    return () => {
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
    };
  }, []);

  const updateStick = (x: number, y: number) => {
    const rect = joyBase.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = x - cx;
    const dy = y - cy;
    const max = rect.width * 0.34;
    const distance = Math.min(max, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx);
    const nx = max > 0 ? (Math.cos(angle) * distance) / max : 0;
    const ny = max > 0 ? (Math.sin(angle) * distance) / max : 0;
    input.current.x = clamp(nx, -1, 1);
    input.current.y = clamp(ny, -1, 1);
    if (joyKnob.current) joyKnob.current.style.transform = `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px)`;
  };

  const resetStick = () => {
    stickPointer.current = null;
    input.current.x = 0;
    input.current.y = 0;
    if (joyKnob.current) joyKnob.current.style.transform = 'translate(0, 0)';
  };

  const beginSwipe = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-control="true"]')) return;
    swipe.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, active: true };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const endSwipe = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!swipe.current.active || swipe.current.pointerId !== e.pointerId) return;
    const dx = e.clientX - swipe.current.x;
    const dy = e.clientY - swipe.current.y;
    const length = Math.hypot(dx, dy);
    swipe.current.active = false;
    swipe.current.pointerId = null;
    if (length < 22) {
      input.current.shoot = true;
      window.setTimeout(() => (input.current.shoot = false), 120);
      return;
    }
    const lateral = clamp(dx / Math.max(length, 1), -0.85, 0.85);
    const forward = clamp(dy / Math.max(length, 1), -1, 0.45);
    pendingShot.current = {
      dir: new THREE.Vector3(lateral, 0, forward < 0.08 ? forward : -0.32).normalize(),
      power: clamp(3.4 + length / 34, 4.1, 7.9),
      curve: clamp(dx / 240, -1.1, 1.1)
    };
  };

  return (
    <div
      ref={hostRef}
      onPointerDown={beginSwipe}
      onPointerUp={endSwipe}
      onPointerCancel={endSwipe}
      style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#06130d', touchAction: 'none', userSelect: 'none' }}
    >
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', background: 'radial-gradient(circle at 50% 72%, transparent 45%, rgba(2,6,23,0.5) 100%)' }} />

      <header style={{ position: 'fixed', left: 12, right: 12, top: 10, display: 'grid', gap: 8, pointerEvents: 'none', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div style={{ padding: '9px 12px', borderRadius: 18, background: 'rgba(2,6,23,0.64)', border: '1px solid rgba(255,255,255,0.14)', boxShadow: '0 16px 36px rgba(0,0,0,0.28)' }}>
            <div style={{ fontSize: 11, opacity: 0.72, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.4 }}>Goal Rush 1v1</div>
            <div style={{ fontSize: 24, fontWeight: 1000, lineHeight: 1 }}><span style={{ color: '#38bdf8' }}>BLUE</span> {hud.blue} - {hud.red} <span style={{ color: '#fb7185' }}>RED</span></div>
          </div>
          <div style={{ minWidth: 92, textAlign: 'center', padding: '10px 12px', borderRadius: 18, background: 'rgba(2,6,23,0.64)', border: '1px solid rgba(255,255,255,0.14)' }}>
            <div style={{ fontSize: 11, opacity: 0.7, fontWeight: 800 }}>CLOCK</div>
            <div style={{ fontSize: 22, fontWeight: 1000 }}>{formatClock(hud.clock)}</div>
          </div>
        </div>
        <div style={{ justifySelf: 'center', maxWidth: 390, padding: '8px 12px', borderRadius: 999, textAlign: 'center', background: 'rgba(15,23,42,0.58)', border: '1px solid rgba(255,255,255,0.12)', fontSize: 12, fontWeight: 800, textShadow: '0 2px 10px #000' }}>{hud.status}</div>
      </header>

      <aside style={{ position: 'fixed', left: 14, top: 112, width: 176, display: 'grid', gap: 7, pointerEvents: 'none', color: '#e2e8f0', fontFamily: 'Inter, system-ui, sans-serif' }}>
        {researchNotes.map((note) => (
          <div key={note} style={{ padding: '7px 9px', borderRadius: 14, background: 'rgba(2,6,23,0.45)', border: '1px solid rgba(255,255,255,0.1)', fontSize: 11, fontWeight: 750 }}>⚽ {note}</div>
        ))}
      </aside>

      <div data-control="true" style={{ position: 'fixed', left: 20, right: 20, bottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'end', pointerEvents: 'none' }}>
        <div
          ref={joyBase}
          data-control="true"
          onPointerDown={(e) => {
            e.stopPropagation();
            stickPointer.current = e.pointerId;
            e.currentTarget.setPointerCapture(e.pointerId);
            updateStick(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            e.stopPropagation();
            if (stickPointer.current === e.pointerId) updateStick(e.clientX, e.clientY);
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            resetStick();
          }}
          onPointerCancel={(e) => {
            e.stopPropagation();
            resetStick();
          }}
          style={{ width: 132, height: 132, borderRadius: 999, pointerEvents: 'auto', background: 'radial-gradient(circle, rgba(255,255,255,0.2), rgba(15,23,42,0.54))', border: '1px solid rgba(255,255,255,0.23)', display: 'grid', placeItems: 'center', boxShadow: '0 22px 42px rgba(0,0,0,0.34)' }}
        >
          <div ref={joyKnob} style={{ width: 56, height: 56, borderRadius: 999, background: 'linear-gradient(180deg,#fff,#cbd5e1)', boxShadow: '0 10px 20px rgba(0,0,0,0.36)', transition: 'transform 60ms linear' }} />
        </div>

        <div style={{ display: 'grid', justifyItems: 'center', gap: 10, color: 'white', fontFamily: 'Inter, system-ui, sans-serif' }}>
          <div style={{ width: 154, height: 12, borderRadius: 999, overflow: 'hidden', background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.18)' }}>
            <div style={{ width: `${Math.round(hud.stamina * 100)}%`, height: '100%', background: hud.stamina > 0.25 ? 'linear-gradient(90deg,#22c55e,#facc15)' : 'linear-gradient(90deg,#ef4444,#f97316)', transition: 'width 120ms linear' }} />
          </div>
          <div style={{ fontSize: 11, fontWeight: 900, opacity: 0.86 }}>{hud.boost} • WASD/Arrows supported</div>
        </div>

        <div style={{ display: 'grid', gap: 10, pointerEvents: 'auto' }}>
          <button data-control="true" style={buttonStyle} onPointerDown={() => (input.current.sprint = true)} onPointerUp={() => (input.current.sprint = false)} onPointerCancel={() => (input.current.sprint = false)}>Sprint</button>
          <button data-control="true" style={{ ...buttonStyle, background: 'linear-gradient(180deg, rgba(239,68,68,0.95), rgba(127,29,29,0.94))' }} onPointerDown={() => (input.current.tackle = true)} onPointerUp={() => (input.current.tackle = false)} onPointerCancel={() => (input.current.tackle = false)}>Tackle</button>
        </div>
      </div>

      <footer style={{ position: 'fixed', left: '50%', bottom: 166, transform: 'translateX(-50%)', width: 'min(86vw, 430px)', padding: '9px 12px', borderRadius: 18, background: 'rgba(2,6,23,0.52)', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.12)', textAlign: 'center', font: '800 12px Inter, system-ui, sans-serif', pointerEvents: 'none' }}>
        Drag left stick to move • tap field for a quick shot • swipe toward goal for a curved power strike • first to {TARGET_SCORE}
      </footer>
    </div>
  );
}
