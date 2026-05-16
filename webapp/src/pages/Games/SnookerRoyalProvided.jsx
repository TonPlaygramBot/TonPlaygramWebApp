import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { PoolRoyalePowerSlider } from '../../../../pool-royale-power-slider.js';
import '../../../../pool-royale-power-slider.css';
import {
  POOL_ROYALE_HDRI_VARIANTS,
  POOL_ROYALE_DEFAULT_HDRI_ID
} from '../../config/poolRoyaleInventoryConfig.js';
import { POOL_ROYALE_CLOTH_VARIANTS } from '../../config/poolRoyaleClothPresets.js';
import { WOOD_FINISH_PRESETS } from '../../utils/woodMaterials.js';
import { getTelegramUsername, getTelegramPhotoUrl } from '../../utils/telegram.js';
import { mapSpinForPhysics, normalizeSpinInput } from './poolRoyaleSpinUtils.js';
import {
  TABLE_MODEL_OPENSOURCE_GLB_URL,
  resolveSnookerGlbFitTransform
} from './snookerTableModel.js';

const HUMAN_URL = 'https://threejs.org/examples/models/gltf/readyplayer.me.glb';

const SNOOKER_CHAMPION_TABLE_GLB_URL = TABLE_MODEL_OPENSOURCE_GLB_URL;
const FRAME_RATE_OPTIONS = Object.freeze([
  { id: 'fhd60', label: 'Performance (60 Hz)', fps: 60, pixelRatioCap: 1.4, resolution: '2K texture pack', description: 'Pool Royale performance preset for stable battery-friendly play.' },
  { id: 'qhd90', label: 'Smooth (90 Hz)', fps: 90, pixelRatioCap: 1.55, resolution: '4K texture pack', description: 'Pool Royale smooth preset for sharper textures and 90 FPS timing.' },
  { id: 'uhd120', label: 'Ultra (120 Hz)', fps: 120, pixelRatioCap: 1.85, resolution: 'Desktop 8K / Mobile 4K', description: 'Pool Royale ultra preset with the highest pixel cap available on this device.' }
]);
const CAMERA_MODE_OPTIONS = Object.freeze([
  { id: 'rail-overhead', label: 'Rail Overhead', description: 'Pool Royale locked broadcast rail camera.' },
  { id: 'cue-follow', label: 'Cue Follow', description: 'Low cue-side player camera while lining up the shot.' },
  { id: 'tv-broadcast', label: 'TV Broadcast', description: 'Alternates cue view, rail overhead, and pocket-style action framing.' }
]);
const BROADCAST_SYSTEM_OPTIONS = Object.freeze([
  { id: 'rail-overhead', label: 'Rail Overhead', method: 'Single rail-overhead mount', description: 'Same default broadcast technique used by Pool Royale.' },
  { id: 'pocket-cuts', label: 'Pocket Cuts', method: 'Corner pocket cutaways', description: 'Cuts to a pocket-side view when balls are close to a pocket.' },
  { id: 'cinematic', label: 'Cinematic Follow', method: 'Cue + action dolly blend', description: 'Smooth shot-following angle for replays and live pot attempts.' }
]);
const SNOOKER_TEXTURE_OPTIONS = Object.freeze([
  { id: 'showood', label: 'Showood Walnut', rail: 0x4d2f1f, trim: 0xd4af37 },
  { id: 'carbon', label: 'LT Carbon Black', rail: 0x090b10, trim: 0x8fb3ff },
  { id: 'rosewood', label: 'Rosewood Gloss', rail: 0x5a1f16, trim: 0xf4c76b },
  { id: 'oak', label: 'Oak Tournament', rail: 0x76512f, trim: 0xd9dde7 }
]);
const DEFAULT_CLOTH_ID = 'snooker-green';
const SNOOKER_CHAMPION_STORAGE_PREFIX = 'snookerChampion:';
const SNOOKER_BALL_VALUES = Object.freeze({ red: 1, yellow: 2, green: 3, brown: 4, blue: 5, pink: 6, black: 7 });
const SNOOKER_COLOR_LABELS = Object.freeze({ yellow: 'Yellow', green: 'Green', brown: 'Brown', blue: 'Blue', pink: 'Pink', black: 'Black' });
const SNOOKER_COLOR_ORDER = Object.freeze(['yellow', 'green', 'brown', 'blue', 'pink', 'black']);
const SPIN_CONTROL_DIAMETER_PX = 124;
const SPIN_DOT_DIAMETER_PX = 18;
const POOL_ROYALE_BOTTOM_HUD_LEFT_INSET_PX = 150;
const POOL_ROYALE_BOTTOM_HUD_RIGHT_INSET_PX = SPIN_CONTROL_DIAMETER_PX + 150;
const POOL_ROYALE_BOTTOM_OFFSET_PX = 12;
const POOL_ROYALE_STANDING_VIEW_FOV = 66;
const POOL_ROYALE_RAIL_OVERHEAD_PHI = Math.PI / 2 - 0.26 + 0.18;
const loadStoredOption = (key, fallback, validIds) => {
  if (typeof window === 'undefined') return fallback;
  try {
    const stored = window.localStorage.getItem(`${SNOOKER_CHAMPION_STORAGE_PREFIX}${key}`);
    return stored && (!validIds || validIds.includes(stored)) ? stored : fallback;
  } catch {
    return fallback;
  }
};
const storeOption = (key, value) => {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(`${SNOOKER_CHAMPION_STORAGE_PREFIX}${key}`, value); } catch {}
};
const WORLD_SCALE = 3.5;
const CFG = {
  scale: WORLD_SCALE,
  tableTopY: 0.84 * WORLD_SCALE,
  tableW: 2.55 * WORLD_SCALE,
  tableL: 4.85 * WORLD_SCALE,
  tableVisualMultiplier: 1.18,
  topThickness: 0.09 * WORLD_SCALE,
  railW: 0.15 * WORLD_SCALE,
  railH: 0.08 * WORLD_SCALE,
  ballR: 0.045 * WORLD_SCALE,
  friction: 1.18,
  restitution: 0.92,
  minSpeed2: 0.00045 * WORLD_SCALE * WORLD_SCALE,
  idleGap: 0.012 * WORLD_SCALE,
  contactGap: 0.0012 * WORLD_SCALE,
  pullRange: 0.42 * WORLD_SCALE,
  strikeTime: 0.12,
  holdTime: 0.05,
  cueLength: 1.78 * WORLD_SCALE,
  bridgeDist: 0.28 * WORLD_SCALE,
  edgeMargin: 0.68 * WORLD_SCALE,
  desiredShootDistance: 1.25 * WORLD_SCALE,
  poseLambda: 9,
  moveLambda: 5.6,
  rotLambda: 8.5,
  humanScale: 1.2 * 1.78 * WORLD_SCALE,
  humanVisualYawFix: Math.PI,
  stanceWidth: 0.52 * WORLD_SCALE,
  bridgePalmTableLift: 0.006 * WORLD_SCALE,
  bridgeCueLift: 0.018 * WORLD_SCALE,
  bridgeHandBackFromBall: 0.235 * WORLD_SCALE,
  bridgeHandSide: -0.012 * WORLD_SCALE,
  chinToCueHeight: 0.11 * WORLD_SCALE,
  footGroundY: 0.035 * WORLD_SCALE,
  footLockStrength: 1,
  kneeBendShot: 0.16 * WORLD_SCALE,
  rightElbowShotRise: 0.18 * WORLD_SCALE,
  rightElbowShotSide: -0.46 * WORLD_SCALE,
  rightElbowShotBack: -0.78 * WORLD_SCALE,
  rightForearmOutward: 0.36 * WORLD_SCALE,
  rightForearmBack: 0.44 * WORLD_SCALE,
  rightForearmDown: 0.48 * WORLD_SCALE,
  rightForearmLength: 0.34 * WORLD_SCALE,
  rightStrokePull: 0.30 * WORLD_SCALE,
  rightStrokePush: 0.24 * WORLD_SCALE,
  rightHandShotLift: -0.30 * WORLD_SCALE,
  shootCueGripFromBack: 0.58 * WORLD_SCALE,
  idleRightHandY: 0.8 * WORLD_SCALE,
  idleRightHandX: 0.31 * WORLD_SCALE,
  idleRightHandZ: -0.015 * WORLD_SCALE,
  idleCueGripFromBack: 0.24 * WORLD_SCALE,
  idleCueDir: new THREE.Vector3(0.055, 0.965, -0.13),
  rightHandRollIdle: -2.2,
  rightHandRollShoot: -2.05,
  rightHandDownPose: 0.42,
  rightHandCueSocketLocal: new THREE.Vector3(-0.004, -0.014, 0.092).multiplyScalar(WORLD_SCALE)
};
const UP = new THREE.Vector3(0, 1, 0);
const Y_AXIS = UP;
const BASIS_MAT = new THREE.Matrix4();
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const clamp01 = (v) => clamp(v, 0, 1);
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => t * t * (3 - 2 * t);
const dampScalar = (current, target, lambda, dt) => THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));
const dampVector = (current, target, lambda, dt) => current.lerp(target, 1 - Math.exp(-lambda * dt));
const yawFromForward = (forward) => Math.atan2(-forward.x, -forward.z);
const cleanName = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

function makeBasisQuaternion(side, up, forward) {
  BASIS_MAT.makeBasis(side.clone().normalize(), up.clone().normalize(), forward.clone().normalize());
  return new THREE.Quaternion().setFromRotationMatrix(BASIS_MAT);
}
function createMaterial(color, roughness = 0.72, metalness = 0.03) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}
function enableShadow(obj) {
  obj.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      child.frustumCulled = false;
    }
  });
  return obj;
}
function addBox(group, size, pos, mat) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
  mesh.position.set(...pos);
  enableShadow(mesh);
  group.add(mesh);
  return mesh;
}
function createUnitCylinder(color) {
  return new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 18), createMaterial(color, 0.7, 0.03));
}
function setSegment(mesh, a, b, radius) {
  const dir = b.clone().sub(a);
  const len = Math.max(0.0001, dir.length());
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
  mesh.scale.set(radius, len, radius);
}
function createLine(color, opacity = 0.9) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  return new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
}
function setLinePoints(line, a, b) {
  const pos = line.geometry.getAttribute('position');
  pos.setXYZ(0, a.x, a.y, a.z);
  pos.setXYZ(1, b.x, b.y, b.z);
  pos.needsUpdate = true;
  line.geometry.computeBoundingSphere();
}
function createCue() {
  const group = new THREE.Group();
  const shaft = createUnitCylinder(0xd9b88d);
  const ferrule = createUnitCylinder(0xf8fafc);
  const tip = createUnitCylinder(0x2563eb);
  group.add(enableShadow(shaft), enableShadow(ferrule), enableShadow(tip));
  return { group, shaft, ferrule, tip };
}
function setCuePose(cue, back, tip) {
  const dir = tip.clone().sub(back).normalize();
  const tipBack = tip.clone().addScaledVector(dir, -0.02 * CFG.scale);
  const ferruleBack = tipBack.clone().addScaledVector(dir, -0.03 * CFG.scale);
  setSegment(cue.shaft, back, ferruleBack, 0.012 * CFG.scale);
  setSegment(cue.ferrule, ferruleBack, tipBack, 0.0105 * CFG.scale);
  setSegment(cue.tip, tipBack, tip, 0.009 * CFG.scale);
}
function cuePoseFromGrip(grip, dir, gripFromBack, length = CFG.cueLength) {
  const n = dir.clone().normalize();
  return { back: grip.clone().addScaledVector(n, -gripFromBack), tip: grip.clone().addScaledVector(n, length - gripFromBack) };
}
function createBall(number, color, isCue = false, kind = 'red', value = 1, spot = null) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(CFG.ballR, 48, 48), createMaterial(color, isCue ? 0.14 : 0.24, 0.012));
  const shine = new THREE.Mesh(new THREE.SphereGeometry(CFG.ballR * 0.18, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22 }));
  shine.position.set(-CFG.ballR * 0.28, CFG.ballR * 0.34, CFG.ballR * 0.32);
  mesh.add(shine);
  enableShadow(mesh);
  return {
    mesh,
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    spin: new THREE.Vector2(),
    isCue,
    number,
    kind,
    value,
    spot: spot ? spot.clone() : null,
    potted: false,
    radius: CFG.ballR
  };
}
function snookerRackPositions() {
  const baulkZ = CFG.tableL * 0.29;
  const redApexZ = -CFG.tableL * 0.16;
  const out = [{ n: 0, c: 0xf8fafc, p: new THREE.Vector3(-CFG.tableW * 0.16, CFG.ballR, baulkZ), cue: true, kind: 'cue', value: 0 }];
  let idx = 1;
  for (let row = 0; row < 5; row += 1) {
    for (let i = 0; i <= row; i += 1) {
      out.push({
        n: idx++,
        c: 0xdc2626,
        p: new THREE.Vector3((i - row / 2) * CFG.ballR * 2.04, CFG.ballR, redApexZ - row * CFG.ballR * 1.78),
        kind: 'red',
        value: SNOOKER_BALL_VALUES.red
      });
    }
  }
  const spots = {
    yellow: new THREE.Vector3(-CFG.tableW * 0.24, CFG.ballR, baulkZ),
    green: new THREE.Vector3(CFG.tableW * 0.24, CFG.ballR, baulkZ),
    brown: new THREE.Vector3(0, CFG.ballR, baulkZ),
    blue: new THREE.Vector3(0, CFG.ballR, 0),
    pink: new THREE.Vector3(0, CFG.ballR, redApexZ + CFG.ballR * 2.5),
    black: new THREE.Vector3(0, CFG.ballR, -CFG.tableL * 0.36)
  };
  out.push(
    { n: 16, c: 0xfacc15, p: spots.yellow, kind: 'yellow', value: SNOOKER_BALL_VALUES.yellow, spot: spots.yellow },
    { n: 17, c: 0x16a34a, p: spots.green, kind: 'green', value: SNOOKER_BALL_VALUES.green, spot: spots.green },
    { n: 18, c: 0x7c2d12, p: spots.brown, kind: 'brown', value: SNOOKER_BALL_VALUES.brown, spot: spots.brown },
    { n: 19, c: 0x2563eb, p: spots.blue, kind: 'blue', value: SNOOKER_BALL_VALUES.blue, spot: spots.blue },
    { n: 20, c: 0xf472b6, p: spots.pink, kind: 'pink', value: SNOOKER_BALL_VALUES.pink, spot: spots.pink },
    { n: 21, c: 0x111827, p: spots.black, kind: 'black', value: SNOOKER_BALL_VALUES.black, spot: spots.black }
  );
  return out;
}
function addBalls(tableGroup) {
  const balls = snookerRackPositions().map((item) => {
    const ball = createBall(item.n, item.c, Boolean(item.cue), item.kind, item.value, item.spot);
    ball.pos.copy(item.p);
    ball.mesh.position.copy(ball.pos);
    tableGroup.add(ball.mesh);
    return ball;
  });
  return { balls, cueBall: balls.find((b) => b.isCue) || balls[0] };
}
function createBaizeTexture(color = 0x0f6f45) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = `#${new THREE.Color(color).getHexString()}`;
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 18000; i += 1) {
    const a = 0.025 + Math.random() * 0.06;
    ctx.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 2, 1);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(7, 13);
  return tex;
}
function expandLocalBoxByMesh(box, mesh) {
  if (!mesh?.geometry) return box;
  mesh.updateMatrix();
  if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
  const meshBox = mesh.geometry.boundingBox?.clone();
  if (!meshBox || meshBox.isEmpty()) return box;
  const corners = [
    new THREE.Vector3(meshBox.min.x, meshBox.min.y, meshBox.min.z),
    new THREE.Vector3(meshBox.min.x, meshBox.min.y, meshBox.max.z),
    new THREE.Vector3(meshBox.min.x, meshBox.max.y, meshBox.min.z),
    new THREE.Vector3(meshBox.min.x, meshBox.max.y, meshBox.max.z),
    new THREE.Vector3(meshBox.max.x, meshBox.min.y, meshBox.min.z),
    new THREE.Vector3(meshBox.max.x, meshBox.min.y, meshBox.max.z),
    new THREE.Vector3(meshBox.max.x, meshBox.max.y, meshBox.min.z),
    new THREE.Vector3(meshBox.max.x, meshBox.max.y, meshBox.max.z)
  ];
  corners.forEach((corner) => box.expandByPoint(corner.applyMatrix4(mesh.matrix)));
  return box;
}
function resolveSnookerChampionTargetBounds(meshes) {
  const bounds = new THREE.Box3();
  meshes.forEach((mesh) => expandLocalBoxByMesh(bounds, mesh));
  if (bounds.isEmpty()) {
    bounds.set(
      new THREE.Vector3(-CFG.tableW * CFG.tableVisualMultiplier * 0.5, -CFG.topThickness + CFG.ballR, -CFG.tableL * CFG.tableVisualMultiplier * 0.5),
      new THREE.Vector3(CFG.tableW * CFG.tableVisualMultiplier * 0.5, CFG.ballR + CFG.railH, CFG.tableL * CFG.tableVisualMultiplier * 0.5)
    );
  }
  return bounds;
}
function resolveSnookerChampionGlbUpperBounds(model, fullBounds) {
  const sourceSize = fullBounds.getSize(new THREE.Vector3());
  const upperCutoff = fullBounds.min.y + sourceSize.y * 0.45;
  const upperBounds = new THREE.Box3();
  model.traverse((node) => {
    if (!node?.isMesh) return;
    const nodeBox = new THREE.Box3().setFromObject(node);
    if (nodeBox.isEmpty()) return;
    const centerY = nodeBox.getCenter(new THREE.Vector3()).y;
    const label = `${node.name || ''} ${node.material?.name || ''}`.toLowerCase();
    const isOriginalBaseLike = /leg|stand|base|foot|pedestal|support/.test(label);
    if (isOriginalBaseLike) return;
    if (centerY >= upperCutoff || /cloth|felt|slate|bed|rail|cushion|frame/.test(label)) {
      upperBounds.union(nodeBox);
    }
  });
  return upperBounds.isEmpty() ? fullBounds.clone() : upperBounds;
}
function addTable(scene, renderer, options = {}) {
  const tableGroup = new THREE.Group();
  tableGroup.position.y = CFG.tableTopY;
  scene.add(tableGroup);
  const clothColor = options.clothColor ?? 0x0f6f45;
  const textureOption = SNOOKER_TEXTURE_OPTIONS.find((item) => item.id === options.textureId) ?? SNOOKER_TEXTURE_OPTIONS[0];
  const cloth = new THREE.MeshStandardMaterial({ color: clothColor, map: createBaizeTexture(clothColor), roughness: 0.96 });
  const proceduralTableMeshes = [];
  const playfield = addBox(tableGroup, [CFG.tableW * CFG.tableVisualMultiplier + 0.1 * CFG.scale, CFG.topThickness, CFG.tableL * CFG.tableVisualMultiplier + 0.1 * CFG.scale], [0, -CFG.topThickness / 2 + CFG.ballR, 0], cloth);
  playfield.name = 'snooker-champion-procedural-cloth';
  proceduralTableMeshes.push(playfield);
  const wood = createMaterial(textureOption.rail, 0.64);
  const trim = createMaterial(textureOption.trim, 0.38, 0.42);
  const cushion = createMaterial(clothColor, 0.9, 0);
  const railY = CFG.railH / 2 - CFG.topThickness + CFG.ballR;
  const cushionY = 0.11 * CFG.scale + CFG.ballR;
  const w = CFG.tableW * CFG.tableVisualMultiplier;
  const l = CFG.tableL * CFG.tableVisualMultiplier;
  [
    [[CFG.railW, CFG.railH, l + 0.34 * CFG.scale], [-(w / 2 + CFG.railW / 2 - 0.03 * CFG.scale), railY, 0], wood],
    [[CFG.railW, CFG.railH, l + 0.34 * CFG.scale], [w / 2 + CFG.railW / 2 - 0.03 * CFG.scale, railY, 0], wood],
    [[w + 0.34 * CFG.scale, CFG.railH, CFG.railW], [0, railY, -(l / 2 + CFG.railW / 2 - 0.03 * CFG.scale)], wood],
    [[w + 0.34 * CFG.scale, CFG.railH, CFG.railW], [0, railY, l / 2 + CFG.railW / 2 - 0.03 * CFG.scale], wood],
    [[0.18 * CFG.scale, 0.1 * CFG.scale, l + 0.38 * CFG.scale], [-(w / 2 + 0.09 * CFG.scale), cushionY, 0], cushion],
    [[0.18 * CFG.scale, 0.1 * CFG.scale, l + 0.38 * CFG.scale], [w / 2 + 0.09 * CFG.scale, cushionY, 0], cushion],
    [[w + 0.18 * CFG.scale, 0.1 * CFG.scale, 0.18 * CFG.scale], [0, cushionY, -(l / 2 + 0.09 * CFG.scale)], cushion],
    [[w + 0.18 * CFG.scale, 0.1 * CFG.scale, 0.18 * CFG.scale], [0, cushionY, l / 2 + 0.09 * CFG.scale], cushion]
  ].forEach(([size, pos, mat]) => {
    proceduralTableMeshes.push(addBox(tableGroup, size, pos, mat));
  });
  const pocketRadius = CFG.ballR * 1.75;
  const pocketPositions = [
    [-CFG.tableW / 2, CFG.ballR + 0.006 * CFG.scale, -CFG.tableL / 2],
    [CFG.tableW / 2, CFG.ballR + 0.006 * CFG.scale, -CFG.tableL / 2],
    [-CFG.tableW / 2, CFG.ballR + 0.006 * CFG.scale, CFG.tableL / 2],
    [CFG.tableW / 2, CFG.ballR + 0.006 * CFG.scale, CFG.tableL / 2],
    [-CFG.tableW / 2, CFG.ballR + 0.006 * CFG.scale, 0],
    [CFG.tableW / 2, CFG.ballR + 0.006 * CFG.scale, 0]
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z));
  pocketPositions.forEach((pos) => {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(pocketRadius, pocketRadius * 0.82, 0.035 * CFG.scale, 32), new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.92 }));
    cup.position.copy(pos);
    cup.rotation.x = Math.PI / 2;
    tableGroup.add(enableShadow(cup));
    proceduralTableMeshes.push(cup);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(pocketRadius, 0.012 * CFG.scale, 10, 28), trim);
    ring.position.copy(pos).setY(pos.y + 0.004 * CFG.scale);
    ring.rotation.x = Math.PI / 2;
    tableGroup.add(enableShadow(ring));
    proceduralTableMeshes.push(ring);
  });
  let disposed = false;
  const gltfTools = createUniversalGLTFLoader(renderer);
  gltfTools.loader.load(
    SNOOKER_CHAMPION_TABLE_GLB_URL,
    (gltf) => {
      if (disposed) return;
      const model = gltf?.scene || gltf?.scenes?.[0];
      if (!model) return;
      enableShadow(model);
      model.updateMatrixWorld(true);
      const targetBounds = resolveSnookerChampionTargetBounds(proceduralTableMeshes);
      const targetSize = targetBounds.getSize(new THREE.Vector3());
      const targetCenter = targetBounds.getCenter(new THREE.Vector3());
      const targetTopY = targetBounds.max.y;
      const fullSourceBounds = new THREE.Box3().setFromObject(model);
      const sourceFitBounds = resolveSnookerChampionGlbUpperBounds(model, fullSourceBounds);
      const sourceFitSize = sourceFitBounds.getSize(new THREE.Vector3());
      const fit = resolveSnookerGlbFitTransform(
        { x: sourceFitSize.x, y: sourceFitSize.y, z: sourceFitSize.z },
        { x: targetSize.x, y: targetSize.y, z: targetSize.z }
      );
      const upperTableScale = Math.min(fit.scale.x, fit.scale.z);
      fit.scale.y = upperTableScale;
      model.scale.set(fit.scale.x, fit.scale.y, fit.scale.z);
      model.updateMatrixWorld(true);
      const scaledFullBounds = new THREE.Box3().setFromObject(model);
      const scaledFitBounds = resolveSnookerChampionGlbUpperBounds(model, scaledFullBounds);
      const scaledFitCenter = scaledFitBounds.getCenter(new THREE.Vector3());
      model.position.set(
        targetCenter.x - scaledFitCenter.x,
        targetTopY - scaledFullBounds.max.y,
        targetCenter.z - scaledFitCenter.z
      );
      model.name = 'snooker-champion-pooltool-snooker-generic-glb';
      model.userData.loadedBySnookerChampion = true;
      model.traverse((child) => {
        if (!child.isMesh || !child.material) return;
        const matName = `${child.material.name || child.name || ''}`.toLowerCase();
        if (matName.includes('cloth') || matName.includes('felt') || matName.includes('cushion')) {
          child.material = child.material.clone();
          child.material.color = new THREE.Color(clothColor);
          child.material.roughness = Math.max(child.material.roughness ?? 0.8, 0.86);
        }
      });
      tableGroup.add(model);
      proceduralTableMeshes.forEach((mesh) => { mesh.visible = false; });
      if (typeof options.onStatus === 'function') {
        options.onStatus('Snooker Royal arena table GLB loaded at the same playfield size and height');
      }
    },
    undefined,
    () => {
      if (typeof options.onStatus === 'function') {
        options.onStatus('GLB table fallback active: procedural snooker table fitted to the same playfield');
      }
    }
  );
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(48 * CFG.scale, 48 * CFG.scale), createMaterial(options.floorColor ?? 0x1d232a, 0.96, 0));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  return { tableGroup, pocketPositions, disposeTableLoader: () => { disposed = true; gltfTools.dispose(); } };
}
function createUniversalGLTFLoader(renderer) {
  const manager = new THREE.LoadingManager();
  const loader = new GLTFLoader(manager);
  loader.setCrossOrigin('anonymous');
  const draco = new DRACOLoader(manager);
  draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
  loader.setDRACOLoader(draco);
  const ktx2 = new KTX2Loader(manager);
  ktx2.setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/basis/');
  ktx2.detectSupport(renderer);
  loader.setKTX2Loader(ktx2);
  loader.setMeshoptDecoder(MeshoptDecoder);
  return { loader, dispose: () => { draco.dispose(); ktx2.dispose(); } };
}
function findBone(all, aliases) {
  const list = all.map((bone) => ({ bone, name: cleanName(bone.name) }));
  const names = aliases.map(cleanName);
  for (const alias of names) {
    const exact = list.find((x) => x.name === alias || x.name.endsWith(alias));
    if (exact) return exact.bone;
  }
  for (const alias of names) {
    const loose = list.find((x) => x.name.includes(alias));
    if (loose) return loose.bone;
  }
  return undefined;
}
function buildAvatarBones(model) {
  const all = [];
  model.traverse((obj) => { if (obj.isBone) all.push(obj); });
  const f = (...names) => findBone(all, names);
  return {
    hips: f('hips', 'pelvis', 'mixamorigHips'), spine: f('spine', 'spine01', 'mixamorigSpine'), chest: f('spine2', 'chest', 'upperchest', 'mixamorigSpine2', 'mixamorigSpine1'), neck: f('neck', 'mixamorigNeck'), head: f('head', 'mixamorigHead'),
    leftUpperArm: f('leftupperarm', 'leftarm', 'upperarml', 'mixamorigLeftArm'), leftLowerArm: f('leftforearm', 'leftlowerarm', 'forearml', 'mixamorigLeftForeArm'), leftHand: f('lefthand', 'handl', 'mixamorigLeftHand'),
    rightUpperArm: f('rightupperarm', 'rightarm', 'upperarmr', 'mixamorigRightArm'), rightLowerArm: f('rightforearm', 'rightlowerarm', 'forearmr', 'mixamorigRightForeArm'), rightHand: f('righthand', 'handr', 'mixamorigRightHand'),
    leftUpperLeg: f('leftupleg', 'leftupperleg', 'leftthigh', 'mixamorigLeftUpLeg'), leftLowerLeg: f('leftleg', 'leftlowerleg', 'leftcalf', 'mixamorigLeftLeg'), leftFoot: f('leftfoot', 'footl', 'mixamorigLeftFoot'),
    rightUpperLeg: f('rightupleg', 'rightupperleg', 'rightthigh', 'mixamorigRightUpLeg'), rightLowerLeg: f('rightleg', 'rightlowerleg', 'rightcalf', 'mixamorigRightLeg'), rightFoot: f('rightfoot', 'footr', 'mixamorigRightFoot')
  };
}
function collectFingerBones(hand) {
  const out = [];
  hand?.traverse((obj) => {
    if (!obj.isBone || obj === hand) return;
    const n = cleanName(obj.name);
    if (['thumb', 'index', 'middle', 'ring', 'pinky', 'little', 'finger'].some((s) => n.includes(s))) out.push(obj);
  });
  return out;
}
function normalizeHuman(model) {
  model.rotation.set(0, CFG.humanVisualYawFix, 0);
  model.position.set(0, 0, 0);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const height = Math.max(box.max.y - box.min.y, 0.0001);
  model.scale.multiplyScalar(CFG.humanScale / height);
  model.updateMatrixWorld(true);
  const scaledBox = new THREE.Box3().setFromObject(model);
  const center = scaledBox.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -scaledBox.min.y, -center.z);
}
function addHuman(scene, renderer, setStatus) {
  const human = { root: new THREE.Group(), modelRoot: new THREE.Group(), model: null, bones: {}, leftFingers: [], rightFingers: [], restQuats: new Map(), activeGlb: false, poseT: 0, walkT: 0, yaw: 0, breathT: 0, settleT: 0, strikeRoot: new THREE.Vector3(), strikeYaw: 0, strikeClock: 0 };
  human.root.visible = false;
  human.modelRoot.visible = false;
  scene.add(human.root, human.modelRoot);
  const { loader } = createUniversalGLTFLoader(renderer);
  setStatus('Loading ReadyPlayer GLTF human…');
  loader.load(HUMAN_URL, (gltf) => {
    const model = gltf.scene;
    normalizeHuman(model);
    model.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.castShadow = true;
      obj.receiveShadow = true;
      obj.frustumCulled = false;
      const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
      mats.forEach((m) => { if (m.map) { m.map.colorSpace = THREE.SRGBColorSpace; m.map.flipY = false; m.map.needsUpdate = true; } m.needsUpdate = true; });
    });
    human.bones = buildAvatarBones(model);
    human.leftFingers = collectFingerBones(human.bones.leftHand);
    human.rightFingers = collectFingerBones(human.bones.rightHand);
    [...Object.values(human.bones), ...human.leftFingers, ...human.rightFingers].forEach((bone) => bone && human.restQuats.set(bone, bone.quaternion.clone()));
    human.activeGlb = Boolean(human.bones.hips && human.bones.spine && human.bones.head && human.bones.rightUpperArm && human.bones.rightLowerArm && human.bones.rightHand);
    human.model = model;
    human.modelRoot.add(model);
    human.modelRoot.visible = human.activeGlb;
    setStatus(human.activeGlb ? 'ReadyPlayer GLTF human active' : 'ReadyPlayer loaded but skeleton aliases incomplete');
  }, undefined, () => setStatus('ReadyPlayer GLTF human failed'));
  return human;
}
function setBoneWorldQuaternion(bone, q) {
  if (!bone || !q) return;
  const parentQ = new THREE.Quaternion();
  bone.parent?.getWorldQuaternion(parentQ);
  bone.quaternion.copy(parentQ.invert().multiply(q));
  bone.updateMatrixWorld(true);
}
function firstBoneChild(bone) { return bone?.children.find((child) => child.isBone); }
function rotateBoneToward(bone, target, strength = 1, fallbackDir = UP) {
  if (!bone || strength <= 0) return;
  const bonePos = bone.getWorldPosition(new THREE.Vector3());
  const childPos = firstBoneChild(bone)?.getWorldPosition(new THREE.Vector3()) || bonePos.clone().addScaledVector(fallbackDir.clone().normalize(), 0.25 * CFG.scale);
  const current = childPos.sub(bonePos).normalize();
  const desired = target.clone().sub(bonePos);
  if (desired.lengthSq() < 1e-6 || current.lengthSq() < 1e-6) return;
  const delta = new THREE.Quaternion().slerpQuaternions(new THREE.Quaternion(), new THREE.Quaternion().setFromUnitVectors(current, desired.normalize()), clamp01(strength));
  setBoneWorldQuaternion(bone, delta.multiply(bone.getWorldQuaternion(new THREE.Quaternion())));
}
function twistBone(bone, axis, amount) {
  if (!bone || Math.abs(amount) < 1e-5) return;
  setBoneWorldQuaternion(bone, new THREE.Quaternion().setFromAxisAngle(axis.clone().normalize(), amount).multiply(bone.getWorldQuaternion(new THREE.Quaternion())));
}
function aimTwoBone(upper, lower, elbow, hand, pole, upperStrength = 0.96, lowerStrength = 0.98) {
  for (let i = 0; i < 4; i += 1) {
    rotateBoneToward(upper, elbow, upperStrength, pole);
    rotateBoneToward(lower, hand, lowerStrength, pole);
  }
}
function setHandBasis(bone, side, up, forward, roll = 0, strength = 1) {
  if (!bone || strength <= 0) return;
  const q = makeBasisQuaternion(side, up, forward);
  if (Math.abs(roll) > 1e-4) q.multiply(new THREE.Quaternion().setFromAxisAngle(forward.clone().normalize(), roll));
  setBoneWorldQuaternion(bone, bone.getWorldQuaternion(new THREE.Quaternion()).slerp(q, clamp01(strength)));
}
function cueSocketOffsetWorld(side, up, forward, roll, socketLocal = CFG.rightHandCueSocketLocal) {
  const q = makeBasisQuaternion(side, up, forward);
  if (Math.abs(roll) > 1e-5) q.multiply(new THREE.Quaternion().setFromAxisAngle(forward.clone().normalize(), roll));
  return socketLocal.clone().applyQuaternion(q);
}
function poseFingers(fingers, mode, weight) {
  const w = clamp01(weight);
  fingers.forEach((finger, i) => {
    const n = cleanName(finger.name);
    const thumb = n.includes('thumb'), index = n.includes('index'), middle = n.includes('middle'), ring = n.includes('ring'), pinky = n.includes('pinky') || n.includes('little');
    const base = !(n.includes('2') || n.includes('3') || n.includes('intermediate') || n.includes('distal'));
    const mid = n.includes('2') || n.includes('intermediate');
    const tip = n.includes('3') || n.includes('distal');
    if (mode === 'idle') { finger.rotation.x += 0.018 * w; finger.rotation.z += 0.01 * w * (i % 2 ? -1 : 1); return; }
    if (mode === 'grip') {
      if (thumb) { finger.rotation.x += 0.48 * w; finger.rotation.y += -0.82 * w; finger.rotation.z += 0.54 * w; return; }
      const curl = index ? (base ? 0.58 : mid ? 0.9 : 0.68) : middle ? (base ? 0.76 : mid ? 1.02 : 0.76) : ring ? (base ? 0.72 : mid ? 0.92 : 0.7) : pinky ? (base ? 0.62 : mid ? 0.82 : 0.62) : 0;
      finger.rotation.x += curl * w;
      finger.rotation.y += (index ? -0.12 : middle ? -0.03 : ring ? 0.04 : pinky ? 0.08 : 0) * w;
      finger.rotation.z += (index ? -0.08 : middle ? -0.02 : ring ? 0.06 : pinky ? 0.12 : 0) * w;
      return;
    }
    if (thumb) { finger.rotation.x += -0.18 * w; finger.rotation.y += 0.95 * w; finger.rotation.z += -0.95 * w; }
    else if (index) { finger.rotation.x += (base ? 0.26 : mid ? 0.42 : 0.28) * w; finger.rotation.y += -0.46 * w; finger.rotation.z += -0.42 * w; }
    else if (middle) { finger.rotation.x += (base ? 0.18 : mid ? 0.32 : 0.22) * w; finger.rotation.y += -0.12 * w; finger.rotation.z += -0.14 * w; }
    else if (ring || pinky) { finger.rotation.x += (base ? (ring ? 0.08 : 0.05) : mid ? (ring ? 0.18 : 0.16) : tip ? (ring ? 0.12 : 0.1) : 0.1) * w; finger.rotation.y += (ring ? 0.18 : 0.34) * w; finger.rotation.z += (ring ? 0.28 : 0.46) * w; }
  });
}
function driveHuman(human, frame) {
  if (!human.activeGlb || !human.model) return;
  human.modelRoot.visible = true;
  human.modelRoot.position.copy(frame.rootWorld);
  human.modelRoot.rotation.y = human.yaw;
  human.modelRoot.updateMatrixWorld(true);
  human.restQuats.forEach((q, bone) => bone.quaternion.copy(q));
  human.modelRoot.updateMatrixWorld(true);
  const b = human.bones;
  const ik = easeInOut(clamp01(frame.t));
  const idle = 1 - ik;
  const cueDir = frame.cueTipWorld.clone().sub(frame.cueBackWorld).normalize();
  const standingCueDir = CFG.idleCueDir.clone().applyAxisAngle(Y_AXIS, human.yaw).normalize();
  const shotQ = makeBasisQuaternion(frame.side, UP, frame.forward);
  if (frame.walkAmount * idle > 0.001) {
    const s = Math.sin(human.walkT * 6.2), c = Math.cos(human.walkT * 6.2), w = frame.walkAmount * idle;
    if (b.leftUpperLeg) b.leftUpperLeg.rotation.x += s * 0.22 * w;
    if (b.rightUpperLeg) b.rightUpperLeg.rotation.x -= s * 0.22 * w;
    if (b.leftLowerLeg) b.leftLowerLeg.rotation.x += Math.max(0, -s) * 0.18 * w;
    if (b.rightLowerLeg) b.rightLowerLeg.rotation.x += Math.max(0, s) * 0.18 * w;
    if (b.leftUpperArm) b.leftUpperArm.rotation.x -= s * 0.2 * w;
    if (b.rightUpperArm) b.rightUpperArm.rotation.x += s * 0.2 * w;
    if (b.spine) b.spine.rotation.z += c * 0.02 * w;
    if (b.hips) b.hips.rotation.z -= c * 0.014 * w;
  }
  if (ik >= 0.025) {
    rotateBoneToward(b.hips, frame.torsoCenterWorld, (0.12 + 0.35 * ik) * ik, frame.forward);
    twistBone(b.hips, frame.side, -0.045 * ik);
    twistBone(b.spine, frame.side, -0.2 * ik);
    rotateBoneToward(b.spine, frame.chestCenterWorld, (0.34 + 0.34 * ik) * ik, frame.forward);
    rotateBoneToward(b.chest, frame.neckWorld, (0.5 + 0.28 * ik) * ik, frame.forward);
    twistBone(b.chest, frame.side, -0.32 * ik);
    rotateBoneToward(b.neck, frame.headCenterWorld, 0.64 * ik, frame.forward);
    setBoneWorldQuaternion(b.head, b.head ? b.head.getWorldQuaternion(new THREE.Quaternion()).slerp(shotQ.clone().multiply(new THREE.Quaternion().setFromAxisAngle(frame.side, -0.12 * ik)), 0.74 * ik) : shotQ);
    human.modelRoot.updateMatrixWorld(true);
  }
  const rightGrip = frame.rightHandWorld.clone();
  const rightIdleElbow = rightGrip.clone().addScaledVector(UP, 0.04 * CFG.scale + 0.14 * CFG.scale * ik).addScaledVector(frame.side, -0.2 * CFG.scale).addScaledVector(frame.forward, -0.03 * CFG.scale * idle);
  const rightElbow = frame.rightElbow.clone().lerp(rightIdleElbow, idle * 0.5);
  aimTwoBone(b.rightUpperArm, b.rightLowerArm, rightElbow, rightGrip, frame.side.clone().multiplyScalar(-1).addScaledVector(UP, 0.32).addScaledVector(frame.forward, -0.55).normalize(), 0.9 + 0.1 * ik, 1);
  const standingHandSide = frame.side.clone().multiplyScalar(-1).addScaledVector(UP, -0.55).addScaledVector(frame.forward, 0.16).normalize();
  const standingHandUp = UP.clone().multiplyScalar(-1).addScaledVector(frame.side, -0.64).addScaledVector(frame.forward, 0.2).normalize();
  setHandBasis(b.rightHand, standingHandSide, standingHandUp, ik >= 0.025 ? cueDir : standingCueDir, ik >= 0.025 ? CFG.rightHandRollShoot : CFG.rightHandRollIdle, 1);
  poseFingers(human.rightFingers, 'grip', 0.95);
  if (ik < 0.025) { poseFingers(human.leftFingers, 'idle', 1); return; }
  aimTwoBone(b.leftUpperArm, b.leftLowerArm, frame.leftElbow, frame.leftHandWorld, frame.side.clone().multiplyScalar(-1).addScaledVector(UP, 0.1).normalize(), 0.98 * ik, ik);
  setHandBasis(b.leftHand, frame.side.clone().multiplyScalar(-1).addScaledVector(frame.forward, -0.52).normalize(), UP.clone().multiplyScalar(0.78).addScaledVector(frame.forward, -0.28).addScaledVector(frame.side, -0.16).normalize(), cueDir, -0.68 * ik, ik);
  poseFingers(human.leftFingers, 'bridge', ik);
  aimTwoBone(b.leftUpperLeg, b.leftLowerLeg, frame.leftKnee, frame.leftFootWorld, frame.forward.clone().addScaledVector(UP, 0.18).normalize(), 0.9 * ik, ik);
  aimTwoBone(b.rightUpperLeg, b.rightLowerLeg, frame.rightKnee, frame.rightFootWorld, frame.forward.clone().multiplyScalar(-1).addScaledVector(UP, 0.18).normalize(), 0.9 * ik, ik);
}
function chooseHumanEdgePosition(cueBallWorld, aimForward) {
  const desired = cueBallWorld.clone().addScaledVector(aimForward, -CFG.desiredShootDistance);
  const xEdge = CFG.tableW / 2 + CFG.edgeMargin;
  const zEdge = CFG.tableL / 2 + CFG.edgeMargin;
  const candidates = [new THREE.Vector3(-xEdge, 0, clamp(desired.z, -zEdge, zEdge)), new THREE.Vector3(xEdge, 0, clamp(desired.z, -zEdge, zEdge)), new THREE.Vector3(clamp(desired.x, -xEdge, xEdge), 0, -zEdge), new THREE.Vector3(clamp(desired.x, -xEdge, xEdge), 0, zEdge)];
  return candidates.sort((a, b) => a.distanceToSquared(desired) - b.distanceToSquared(desired))[0].clone();
}
function updateHumanPose(human, dt, state, rootTarget, aimForward, bridgeTarget, idleRight, idleLeft, cueBack, cueTip, power) {
  human.poseT = dampScalar(human.poseT, state === 'idle' ? 0 : 1, CFG.poseLambda, dt);
  human.breathT += dt * (state === 'idle' ? 1.05 : 0.5);
  human.settleT = dampScalar(human.settleT, state === 'dragging' ? 1 : 0, 5.5, dt);
  if (state === 'striking') {
    if (human.strikeClock === 0) { human.strikeRoot.copy(human.root.position.lengthSq() > 0.001 ? human.root.position : rootTarget); human.strikeYaw = human.yaw; }
    human.strikeClock += dt;
  } else human.strikeClock = 0;
  const rootGoal = state === 'striking' ? human.strikeRoot : rootTarget;
  dampVector(human.root.position, rootGoal, state === 'striking' ? 12 : CFG.moveLambda, dt);
  const moveAmountRaw = human.root.position.distanceTo(rootGoal);
  human.walkT += dt * (2 + Math.min(7, moveAmountRaw * 10 / CFG.scale));
  human.yaw = dampScalar(human.yaw, state === 'striking' ? human.strikeYaw : yawFromForward(aimForward), CFG.rotLambda, dt);
  const t = easeInOut(human.poseT), idle = 1 - t;
  const breath = Math.sin(human.breathT * Math.PI * 2) * ((0.006 + idle * 0.004) * CFG.scale);
  const walk = Math.sin(human.walkT * 6.2) * Math.min(1, moveAmountRaw * 12 / CFG.scale);
  const walkAmount = clamp01(moveAmountRaw * 18 / CFG.scale) * idle;
  const dragStroke = state === 'dragging' ? Math.sin(performance.now() * 0.011) * (0.25 + power * 0.75) : 0;
  const strikeFollow = state === 'striking' ? Math.sin(clamp01(human.strikeClock / (CFG.strikeTime + CFG.holdTime)) * Math.PI) : 0;
  const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(Y_AXIS, human.yaw).normalize();
  const side = new THREE.Vector3(forward.z, 0, -forward.x).normalize();
  const local = (v) => v.clone().applyAxisAngle(Y_AXIS, human.yaw).add(human.root.position);
  const powerLean = power * t;
  const rootWorld = human.root.position.clone().addScaledVector(forward, (0.018 * powerLean + 0.026 * strikeFollow) * CFG.scale);
  rootWorld.y = 0;
  const torso = local(new THREE.Vector3(0, lerp(1.3, 1.14, t) * CFG.scale + breath, (lerp(0.02, -0.16, t) - 0.014 * powerLean) * CFG.scale));
  const chest = local(new THREE.Vector3(0, lerp(1.52, 1.24, t) * CFG.scale + breath, (lerp(0.02, -0.42, t) - 0.024 * powerLean) * CFG.scale));
  const neck = local(new THREE.Vector3(0, lerp(1.68, 1.28, t) * CFG.scale + breath, (lerp(0.02, -0.61, t) - 0.028 * powerLean) * CFG.scale));
  const head = local(new THREE.Vector3(0, lerp(1.84, 1.37, t) * CFG.scale + breath - CFG.chinToCueHeight * 0.16 * t, (lerp(0.04, -0.72, t) - 0.028 * powerLean) * CFG.scale));
  const leftShoulder = local(new THREE.Vector3(-0.23 * CFG.scale, lerp(1.58, 1.36, t) * CFG.scale + breath, (lerp(0, -0.46, t) - 0.018 * human.settleT) * CFG.scale));
  const rightShoulder = local(new THREE.Vector3(0.23 * CFG.scale, lerp(1.58, 1.36, t) * CFG.scale + breath, (lerp(0, -0.34, t) - 0.018 * human.settleT) * CFG.scale));
  const leftHip = local(new THREE.Vector3(-0.13 * CFG.scale, 0.92 * CFG.scale, 0.02 * CFG.scale));
  const rightHip = local(new THREE.Vector3(0.13 * CFG.scale, 0.92 * CFG.scale, 0.02 * CFG.scale));
  const leftFoot = local(new THREE.Vector3(-0.13 * CFG.scale, CFG.footGroundY, 0.03 * CFG.scale + walk * 0.018 * CFG.scale).lerp(new THREE.Vector3(-CFG.stanceWidth * 0.42, CFG.footGroundY, -0.34 * CFG.scale), t));
  const rightFoot = local(new THREE.Vector3(0.13 * CFG.scale, CFG.footGroundY, -0.03 * CFG.scale - walk * 0.018 * CFG.scale).lerp(new THREE.Vector3(CFG.stanceWidth * 0.5, CFG.footGroundY, 0.34 * CFG.scale), t));
  const bridgePalmTarget = bridgeTarget.clone().addScaledVector(forward, -0.006 * CFG.scale * t).addScaledVector(side, -0.012 * CFG.scale * t).setY(CFG.tableTopY + CFG.bridgePalmTableLift).addScaledVector(UP, -0.01 * CFG.scale * human.settleT);
  const leftHand = idleLeft.clone().lerp(bridgePalmTarget, t);
  const cueDirForHand = cueTip.clone().sub(cueBack).normalize();
  const handIk = easeInOut(clamp01(t));
  const idleGripSide = side.clone().multiplyScalar(-1).addScaledVector(UP, -0.55).addScaledVector(forward, 0.16).normalize();
  const idleGripUp = UP.clone().multiplyScalar(-1).addScaledVector(side, -0.64).addScaledVector(forward, 0.2).normalize();
  const liveGripSide = side.clone().multiplyScalar(-1).addScaledVector(UP, lerp(-0.55, -0.62, handIk)).addScaledVector(side, 0.5 * handIk).addScaledVector(forward, lerp(0.16, -0.08, handIk)).normalize();
  const liveGripUp = UP.clone().multiplyScalar(lerp(-1, 0.12, handIk)).addScaledVector(side, lerp(-0.64, -0.04, handIk)).addScaledVector(forward, lerp(0.2, -0.48, handIk)).normalize();
  const lockedRightElbow = rightShoulder.clone().addScaledVector(UP, lerp(0.04 * CFG.scale, CFG.rightElbowShotRise, t)).addScaledVector(side, lerp(-0.18 * CFG.scale, CFG.rightElbowShotSide, t)).addScaledVector(forward, lerp(-0.04 * CFG.scale, CFG.rightElbowShotBack, t));
  const forearmStroke = (state === 'dragging' ? -CFG.rightStrokePull * easeOutCubic(power) : 0) + (state === 'striking' ? CFG.rightStrokePush * strikeFollow : 0) + (state === 'dragging' ? dragStroke * 0.035 * CFG.scale : 0);
  const forearmBase = lockedRightElbow.clone().addScaledVector(side, CFG.rightForearmOutward * t).addScaledVector(UP, -CFG.rightForearmDown * t).addScaledVector(UP, CFG.rightHandShotLift * t).addScaledVector(forward, -CFG.rightForearmBack * t).addScaledVector(cueDirForHand, CFG.rightForearmLength);
  const liveCueGripPoint = forearmBase.clone().addScaledVector(cueDirForHand, forearmStroke);
  const idleWristTarget = idleRight.clone().sub(cueSocketOffsetWorld(idleGripSide, idleGripUp, cueDirForHand, CFG.rightHandRollIdle));
  const liveWristTarget = liveCueGripPoint.clone().sub(cueSocketOffsetWorld(liveGripSide, liveGripUp, cueDirForHand, lerp(CFG.rightHandRollIdle, CFG.rightHandRollShoot - CFG.rightHandDownPose, handIk)));
  const rightHand = idleWristTarget.clone().lerp(liveWristTarget, t);
  const leftElbow = leftShoulder.clone().lerp(leftHand, 0.62).addScaledVector(UP, 0.006 * CFG.scale * t).addScaledVector(side, -0.044 * CFG.scale * t).addScaledVector(forward, 0.065 * CFG.scale * t);
  const leftKnee = leftHip.clone().lerp(leftFoot, 0.53).addScaledVector(UP, lerp(0.2 * CFG.scale, CFG.kneeBendShot, t)).addScaledVector(forward, 0.04 * CFG.scale * t).addScaledVector(side, -0.012 * CFG.scale * t);
  const rightKnee = rightHip.clone().lerp(rightFoot, 0.52).addScaledVector(UP, lerp(0.2 * CFG.scale, CFG.kneeBendShot * 0.88, t)).addScaledVector(forward, -0.03 * CFG.scale * t).addScaledVector(side, 0.014 * CFG.scale * t);
  driveHuman(human, { t, stroke: forearmStroke / CFG.scale, follow: strikeFollow, walkAmount, forward, side, up: UP, rootWorld, torsoCenterWorld: torso, chestCenterWorld: chest, neckWorld: neck, headCenterWorld: head, leftElbow, rightElbow: lockedRightElbow, leftHandWorld: leftHand, rightHandWorld: rightHand, leftKnee, rightKnee, leftFootWorld: leftFoot, rightFootWorld: rightFoot, cueBackWorld: cueBack, cueTipWorld: cueTip });
}
function applyCueShot(cueBall, power, yaw, out, spinInput = { x: 0, y: 0 }) {
  const p = clamp01(power);
  const dir = out.set(0, 0, -1).applyAxisAngle(Y_AXIS, yaw).normalize();
  const side = new THREE.Vector3(dir.z, 0, -dir.x).normalize();
  const spin = mapSpinForPhysics(normalizeSpinInput(spinInput));
  const speed = (2.8 + p * 9.2) * CFG.scale;
  cueBall.vel.copy(dir.multiplyScalar(speed));
  cueBall.vel.addScaledVector(side, (spin.x ?? 0) * p * 1.05 * CFG.scale);
  cueBall.spin.set(spin.x ?? 0, spin.y ?? 0);
  cueBall.impacted = false;
  cueBall.lastShotSpin = { x: spin.x ?? 0, y: spin.y ?? 0 };
}
function respotColorBall(ball, balls) {
  if (!ball?.spot) return;
  const occupied = (spot) => balls.some((other) => !other.potted && other !== ball && other.pos.distanceToSquared(spot) < (CFG.ballR * 2.2) ** 2);
  const candidate = ball.spot.clone();
  if (occupied(candidate)) {
    for (let ring = 1; ring <= 5; ring += 1) {
      for (let i = 0; i < 12; i += 1) {
        const a = (i / 12) * Math.PI * 2;
        candidate.copy(ball.spot).add(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(CFG.ballR * 2.3 * ring));
        if (!occupied(candidate)) break;
      }
      if (!occupied(candidate)) break;
    }
  }
  ball.pos.copy(candidate);
  ball.vel.set(0, 0, 0);
  ball.spin.set(0, 0);
  ball.potted = false;
  ball.mesh.visible = true;
}
function updateSnookerRulesAfterPot(ball, balls, rulesState) {
  if (!rulesState || ball.isCue) return;
  const redsRemaining = balls.some((item) => item.kind === 'red' && !item.potted);
  rulesState.score += ball.value ?? 0;
  if (ball.kind === 'red') {
    rulesState.lastPot = 'red';
    rulesState.target = 'colour';
  } else {
    rulesState.lastPot = ball.kind;
    rulesState.target = redsRemaining ? 'red' : 'colours';
    if (redsRemaining) respotColorBall(ball, balls);
  }
  if (!balls.some((item) => item.kind === 'red' && !item.potted)) {
    const nextColour = SNOOKER_COLOR_ORDER.find((kind) => balls.some((item) => item.kind === kind && !item.potted));
    rulesState.target = nextColour ? SNOOKER_COLOR_LABELS[nextColour] : 'Frame complete';
  }
}
function updateBalls(balls, dt, tmpA, tmpB, pocketPositions = [], rulesState = null) {
  const halfW = CFG.tableW / 2;
  const halfL = CFG.tableL / 2;
  for (const ball of balls) {
    if (ball.potted) continue;
    const rollingThrow = ball.spin?.x ? ball.spin.x * 0.22 * CFG.scale * dt : 0;
    const followDraw = ball.spin?.y ? ball.spin.y * 0.11 * CFG.scale * dt : 0;
    if (ball.vel.lengthSq() > CFG.minSpeed2) {
      const forward = tmpA.copy(ball.vel).setY(0).normalize();
      const side = tmpB.set(forward.z, 0, -forward.x).normalize();
      ball.vel.addScaledVector(side, rollingThrow);
      ball.vel.addScaledVector(forward, followDraw);
    }
    ball.pos.addScaledVector(ball.vel, dt);
    ball.vel.multiplyScalar(Math.exp(-CFG.friction * dt));
    if (ball.spin) ball.spin.multiplyScalar(Math.exp(-2.0 * dt));
    if (ball.vel.lengthSq() < CFG.minSpeed2) ball.vel.set(0, 0, 0);
    if (ball.pos.x < -halfW + CFG.ballR) { ball.pos.x = -halfW + CFG.ballR; ball.vel.x = Math.abs(ball.vel.x) * CFG.restitution; if (ball.spin) ball.spin.x *= -0.65; }
    else if (ball.pos.x > halfW - CFG.ballR) { ball.pos.x = halfW - CFG.ballR; ball.vel.x = -Math.abs(ball.vel.x) * CFG.restitution; if (ball.spin) ball.spin.x *= -0.65; }
    if (ball.pos.z < -halfL + CFG.ballR) { ball.pos.z = -halfL + CFG.ballR; ball.vel.z = Math.abs(ball.vel.z) * CFG.restitution; if (ball.spin) ball.spin.x *= -0.65; }
    else if (ball.pos.z > halfL - CFG.ballR) { ball.pos.z = halfL - CFG.ballR; ball.vel.z = -Math.abs(ball.vel.z) * CFG.restitution; if (ball.spin) ball.spin.x *= -0.65; }
    const pocket = pocketPositions.find((p) => ball.pos.distanceToSquared(p) < (CFG.ballR * 1.72) ** 2);
    if (pocket && ball.vel.lengthSq() < (8.5 * CFG.scale) ** 2) {
      if (ball.isCue) {
        ball.pos.set(-CFG.tableW * 0.16, CFG.ballR, CFG.tableL * 0.29);
        ball.vel.set(0, 0, 0);
        ball.spin?.set(0, 0);
        if (rulesState) {
          rulesState.foul = 'Cue ball in-off: foul, ball in hand inside the D.';
          rulesState.score = Math.max(0, rulesState.score - 4);
        }
      } else {
        ball.potted = true;
        ball.vel.set(0, 0, 0);
        ball.spin?.set(0, 0);
        ball.mesh.visible = false;
        updateSnookerRulesAfterPot(ball, balls, rulesState);
      }
    }
  }
  for (let i = 0; i < balls.length; i += 1) for (let j = i + 1; j < balls.length; j += 1) {
    const a = balls[i], b = balls[j];
    if (a.potted || b.potted) continue;
    const delta = tmpA.copy(b.pos).sub(a.pos);
    const dist = delta.length();
    const minDist = CFG.ballR * 2;
    if (dist > 0 && dist < minDist) {
      const n = delta.multiplyScalar(1 / dist);
      const overlap = minDist - dist;
      a.pos.addScaledVector(n, -overlap * 0.5);
      b.pos.addScaledVector(n, overlap * 0.5);
      const sep = tmpB.copy(a.vel).sub(b.vel).dot(n);
      if (sep < 0) {
        const impulse = -(1 + CFG.restitution) * sep * 0.5;
        a.vel.addScaledVector(n, impulse);
        b.vel.addScaledVector(n, -impulse);
        if (a.spin && b.spin) {
          const spinTransfer = (a.spin.x - b.spin.x) * 0.18;
          b.spin.x += spinTransfer;
          a.spin.x -= spinTransfer * 0.45;
        }
      }
    }
  }
  for (const ball of balls) if (!ball.potted) ball.mesh.position.copy(ball.pos);
}
function updateCamera(camera, mode, broadcastMode, cueBallWorld, aimForward, activePower, now) {
  camera.fov = POOL_ROYALE_STANDING_VIEW_FOV;
  camera.updateProjectionMatrix();
  const focus = cueBallWorld.clone().setY(CFG.tableTopY + 0.16 * CFG.scale);
  if (mode === 'rail-overhead') {
    const halfVerticalFov = THREE.MathUtils.degToRad(camera.fov * 0.5);
    const radius = Math.max(
      (CFG.tableL * 0.62) / Math.tan(halfVerticalFov),
      CFG.tableL * 1.28
    );
    const sph = new THREE.Spherical(radius, POOL_ROYALE_RAIL_OVERHEAD_PHI, 0);
    camera.position.setFromSpherical(sph).add(new THREE.Vector3(CFG.tableW * 0.006, CFG.tableTopY, CFG.tableL * 0.02));
    camera.lookAt(CFG.tableW * 0.006, CFG.tableTopY, CFG.tableL * 0.02);
    return;
  }
  if (mode === 'tv-broadcast' && broadcastMode === 'pocket-cuts' && activePower > 0.35) {
    camera.position.set(Math.sign(aimForward.x || 1) * 2.25 * CFG.scale, 1.42 * CFG.scale, -2.65 * CFG.scale);
    camera.lookAt(focus);
    return;
  }
  if (mode === 'tv-broadcast' && broadcastMode === 'cinematic') {
    const orbit = now * 0.00016;
    camera.position.set(Math.sin(orbit) * 2.3 * CFG.scale, 1.85 * CFG.scale, Math.cos(orbit) * 3.1 * CFG.scale);
    camera.lookAt(focus);
    return;
  }
  const behind = cueBallWorld.clone().addScaledVector(aimForward, 2.25 * CFG.scale);
  behind.y = CFG.tableTopY + 0.86 * CFG.scale;
  camera.position.lerp(behind, 0.18);
  camera.lookAt(focus.clone().addScaledVector(aimForward, -0.78 * CFG.scale));
}


export default function SnookerRoyalProvided({ gameTitle = 'Snooker Royal Provided' } = {}) {
  const hostRef = useRef(null);
  const canvasRef = useRef(null);
  const sliderMountRef = useRef(null);
  const spinPadRef = useRef(null);
  const spinDotRef = useRef(null);
  const [power, setPower] = useState(0);
  const [shotState, setShotState] = useState('idle');
  const [tableStatus, setTableStatus] = useState('Loading Pooltool snooker table GLB…');
  const [humanStatus, setHumanStatus] = useState('Preparing ReadyPlayer human…');
  const [score, setScore] = useState(0);
  const [target, setTarget] = useState('red');
  const [foul, setFoul] = useState('');
  const [configOpen, setConfigOpen] = useState(false);
  const [frameRateId, setFrameRateId] = useState(() => loadStoredOption('graphics', 'qhd90', FRAME_RATE_OPTIONS.map((item) => item.id)));
  const [cameraMode, setCameraMode] = useState(() => loadStoredOption('cameraMode', 'rail-overhead', CAMERA_MODE_OPTIONS.map((item) => item.id)));
  const [broadcastSystemId, setBroadcastSystemId] = useState(() => loadStoredOption('broadcastSystem', 'rail-overhead', BROADCAST_SYSTEM_OPTIONS.map((item) => item.id)));
  const [environmentHdriId, setEnvironmentHdriId] = useState(() => loadStoredOption('hdri', POOL_ROYALE_DEFAULT_HDRI_ID, POOL_ROYALE_HDRI_VARIANTS.map((item) => item.id)));
  const [clothId, setClothId] = useState(() => loadStoredOption('cloth', DEFAULT_CLOTH_ID, POOL_ROYALE_CLOTH_VARIANTS.map((item) => item.id)));
  const [textureId, setTextureId] = useState(() => loadStoredOption('texture', SNOOKER_TEXTURE_OPTIONS[0].id, SNOOKER_TEXTURE_OPTIONS.map((item) => item.id)));
  const [spin, setSpin] = useState({ x: 0, y: 0 });
  const powerRef = useRef(0);
  const shotPowerRef = useRef(0);
  const shotStateRef = useRef('idle');
  const draggingSliderRef = useRef(false);
  const aimYawRef = useRef(0);
  const spinRef = useRef({ x: 0, y: 0 });
  const rulesRef = useRef({ score: 0, target: 'red', foul: '' });
  const activeFrameRate = FRAME_RATE_OPTIONS.find((item) => item.id === frameRateId) ?? FRAME_RATE_OPTIONS[1];
  const activeHdri = POOL_ROYALE_HDRI_VARIANTS.find((item) => item.id === environmentHdriId) ?? POOL_ROYALE_HDRI_VARIANTS[0];
  const activeCloth = POOL_ROYALE_CLOTH_VARIANTS.find((item) => item.id === clothId) ?? POOL_ROYALE_CLOTH_VARIANTS[0];
  const activeTexture = SNOOKER_TEXTURE_OPTIONS.find((item) => item.id === textureId) ?? SNOOKER_TEXTURE_OPTIONS[0];
  const playerName = getTelegramUsername() || 'Player';
  const playerAvatar = getTelegramPhotoUrl() || '/assets/icons/profile.svg';
  const opponentName = 'Snooker AI';
  const opponentAvatar = '/assets/icons/snooker-regular.svg';
  const opponentScore = 0;
  const avatarSizeClass = 'h-[3.7rem] w-[3.7rem]';
  const nameWidthClass = 'max-w-[9.5rem]';
  const nameTextClass = 'text-sm';
  const hdriOptions = useMemo(() => POOL_ROYALE_HDRI_VARIANTS.slice(0, 12), []);
  const clothOptions = useMemo(() => {
    const snookerFirst = POOL_ROYALE_CLOTH_VARIANTS.filter((item) => /green|blue|red|black|gold/i.test(`${item.id} ${item.label}`));
    return (snookerFirst.length ? snookerFirst : POOL_ROYALE_CLOTH_VARIANTS).slice(0, 10);
  }, []);
  const textureOptions = useMemo(() => {
    const woodOptions = WOOD_FINISH_PRESETS?.slice?.(0, 4)?.map((item, idx) => ({
      id: item.id || `wood-${idx}`,
      label: item.label || item.name || `Wood ${idx + 1}`,
      rail: SNOOKER_TEXTURE_OPTIONS[idx % SNOOKER_TEXTURE_OPTIONS.length].rail,
      trim: SNOOKER_TEXTURE_OPTIONS[idx % SNOOKER_TEXTURE_OPTIONS.length].trim
    })) ?? [];
    return [...SNOOKER_TEXTURE_OPTIONS, ...woodOptions];
  }, []);

  useEffect(() => { powerRef.current = power; }, [power]);
  useEffect(() => { shotStateRef.current = shotState; }, [shotState]);
  useEffect(() => { spinRef.current = spin; }, [spin]);
  useEffect(() => { storeOption('graphics', frameRateId); }, [frameRateId]);
  useEffect(() => { storeOption('cameraMode', cameraMode); }, [cameraMode]);
  useEffect(() => { storeOption('broadcastSystem', broadcastSystemId); }, [broadcastSystemId]);
  useEffect(() => { storeOption('hdri', environmentHdriId); }, [environmentHdriId]);
  useEffect(() => { storeOption('cloth', clothId); }, [clothId]);
  useEffect(() => { storeOption('texture', textureId); }, [textureId]);

  useEffect(() => {
    const mount = sliderMountRef.current;
    if (!mount) return undefined;
    mount.innerHTML = '';
    const slider = new PoolRoyalePowerSlider({
      mount,
      value: 0,
      min: 0,
      max: 100,
      step: 1,
      cueSrc: '/assets/snooker/cue.webp',
      labels: true,
      onStart: () => {
        draggingSliderRef.current = true;
        setShotState('dragging');
      },
      onChange: (value) => {
        const normalized = clamp01(value / 100);
        setPower(normalized);
        if (draggingSliderRef.current) shotPowerRef.current = normalized;
      },
      onCommit: (value) => {
        const normalized = clamp01(value / 100);
        shotPowerRef.current = normalized;
        draggingSliderRef.current = false;
        setShotState(normalized > 0.02 ? 'striking' : 'idle');
        slider.animateToMin({ duration: 180 });
      }
    });
    return () => slider.destroy();
  }, []);

  useEffect(() => {
    const pad = spinPadRef.current;
    const dot = spinDotRef.current;
    if (!pad || !dot) return undefined;
    const applySpinFromEvent = (e) => {
      const rect = pad.getBoundingClientRect();
      const rawX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const rawY = (0.5 - (e.clientY - rect.top) / rect.height) * 2;
      const normalized = normalizeSpinInput({ x: rawX, y: rawY });
      setSpin(normalized);
      dot.style.left = `${50 + normalized.x * 42}%`;
      dot.style.top = `${50 - normalized.y * 42}%`;
    };
    const onPointerDown = (e) => { pad.setPointerCapture(e.pointerId); applySpinFromEvent(e); };
    const onPointerMove = (e) => { if (e.buttons) applySpinFromEvent(e); };
    const onPointerUp = (e) => { try { pad.releasePointerCapture(e.pointerId); } catch {} };
    pad.addEventListener('pointerdown', onPointerDown);
    pad.addEventListener('pointermove', onPointerMove);
    pad.addEventListener('pointerup', onPointerUp);
    pad.addEventListener('pointercancel', onPointerUp);
    return () => {
      pad.removeEventListener('pointerdown', onPointerDown);
      pad.removeEventListener('pointermove', onPointerMove);
      pad.removeEventListener('pointerup', onPointerUp);
      pad.removeEventListener('pointercancel', onPointerUp);
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return undefined;
    setTableStatus('Loading Pooltool snooker table GLB…');
    rulesRef.current = { score: 0, target: 'red', foul: '' };
    setScore(0);
    setTarget('red');
    setFoul('');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setClearColor(activeHdri?.swatches?.[0] ? new THREE.Color(activeHdri.swatches[0]) : new THREE.Color(0x0b0b0b), 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = activeHdri?.exposure ?? 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(renderer.getClearColor(new THREE.Color()), 18 * CFG.scale, 42 * CFG.scale);
    const camera = new THREE.PerspectiveCamera(POOL_ROYALE_STANDING_VIEW_FOV, 1, 0.05 * CFG.scale, 80 * CFG.scale);
    camera.position.set(1.85 * CFG.scale, 2.45 * CFG.scale, 7.85 * CFG.scale);
    camera.lookAt(0, 1.05 * CFG.scale, 0);
    scene.add(new THREE.AmbientLight(0xffffff, 0.74 + ((activeHdri?.environmentIntensity ?? 1) * 0.08)));
    scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 0.55));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2 + ((activeHdri?.backgroundIntensity ?? 1) * 0.15));
    sun.position.set(3.5 * CFG.scale, 7 * CFG.scale, 5 * CFG.scale);
    sun.castShadow = true;
    scene.add(sun);
    const { tableGroup, pocketPositions, disposeTableLoader } = addTable(scene, renderer, {
      clothColor: activeCloth?.color ?? 0x0f6f45,
      textureId,
      floorColor: activeHdri?.swatches?.[1] ? new THREE.Color(activeHdri.swatches[1]).getHex() : 0x1d232a,
      onStatus: setTableStatus
    });
    const { balls, cueBall } = addBalls(tableGroup);
    const cue = createCue();
    scene.add(cue.group);
    const human = addHuman(scene, renderer, setHumanStatus);
    const cueLine = createLine(0xffd166, 0.95);
    const aimLine = createLine(0xff6b4a, 0.85);
    scene.add(cueLine, aimLine);
    const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3();
    let strikeT = 0, didHit = false, frameId = 0, last = performance.now(), isAiming = false, lastAimX = 0;
    let lastScore = rulesRef.current.score;
    let lastTarget = rulesRef.current.target;
    let lastFoul = rulesRef.current.foul;
    const resize = () => {
      const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
      renderer.setSize(w, h, false);
      renderer.setPixelRatio(Math.min(activeFrameRate.pixelRatioCap, window.devicePixelRatio || 1));
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const onCanvasDown = (e) => { if (!draggingSliderRef.current) { isAiming = true; lastAimX = e.clientX; } };
    const onCanvasMove = (e) => { if (!isAiming || draggingSliderRef.current) return; aimYawRef.current -= (e.clientX - lastAimX) * 0.006; lastAimX = e.clientX; };
    const onCanvasUp = () => { isAiming = false; };
    canvas.addEventListener('pointerdown', onCanvasDown);
    canvas.addEventListener('pointermove', onCanvasMove);
    canvas.addEventListener('pointerup', onCanvasUp);
    canvas.addEventListener('pointercancel', onCanvasUp);
    window.addEventListener('resize', resize);
    resize();
    function animate() {
      frameId = requestAnimationFrame(animate);
      const now = performance.now();
      const targetFrameSeconds = 1 / Math.max(activeFrameRate.fps, 30);
      const dt = Math.min(0.033, Math.max(targetFrameSeconds * 0.5, (now - last) / 1000));
      last = now;
      const state = shotStateRef.current;
      const activePower = state === 'dragging' ? powerRef.current : shotPowerRef.current;
      const cueBallWorld = cueBall.mesh.getWorldPosition(new THREE.Vector3());
      const aimForward = tmpA.set(0, 0, -1).applyAxisAngle(Y_AXIS, aimYawRef.current).normalize().clone();
      const aimSide = tmpB.set(aimForward.z, 0, -aimForward.x).normalize().clone();
      const humanRootTarget = chooseHumanEdgePosition(cueBallWorld, aimForward);
      const bridgeHandTarget = cueBallWorld.clone().addScaledVector(aimForward, -CFG.bridgeHandBackFromBall).addScaledVector(aimSide, CFG.bridgeHandSide).setY(CFG.tableTopY + CFG.bridgePalmTableLift);
      const bridgeCuePoint = bridgeHandTarget.clone().addScaledVector(aimForward, 0.014 * CFG.scale).add(new THREE.Vector3(0, CFG.bridgeCueLift, 0));
      const pull = CFG.pullRange * easeOutCubic(activePower);
      const practiceStroke = state === 'dragging' ? Math.sin(now * 0.012) * 0.035 * CFG.scale * (0.25 + activePower * 0.75) : 0;
      const strikeNorm = clamp01(strikeT / CFG.strikeTime);
      let gap = CFG.idleGap;
      const spinOffset = mapSpinForPhysics(spinRef.current);
      if (state === 'dragging') gap += pull + practiceStroke;
      if (state === 'striking') gap = lerp(CFG.idleGap + pull, CFG.contactGap, easeOutCubic(strikeNorm));
      const cueTipShoot = cueBallWorld.clone()
        .addScaledVector(aimForward, -(CFG.ballR + gap))
        .addScaledVector(aimSide, (spinOffset.x ?? 0) * CFG.ballR * 0.52)
        .add(new THREE.Vector3(0, (spinOffset.y ?? 0) * CFG.ballR * 0.44, 0));
      const cueBackShoot = bridgeCuePoint.clone().addScaledVector(aimForward, -(CFG.cueLength - CFG.bridgeDist - CFG.ballR - gap)).add(new THREE.Vector3(0, 0.024 * CFG.scale, 0));
      const standingYaw = yawFromForward(aimForward);
      const idleRightHandTarget = humanRootTarget.clone().add(new THREE.Vector3(CFG.idleRightHandX, CFG.idleRightHandY, CFG.idleRightHandZ).applyAxisAngle(Y_AXIS, standingYaw));
      const idleLeftHandTarget = humanRootTarget.clone().add(new THREE.Vector3(-0.18 * CFG.scale, 1.08 * CFG.scale, 0.03 * CFG.scale).applyAxisAngle(Y_AXIS, standingYaw));
      const idleDir = CFG.idleCueDir.clone().applyAxisAngle(Y_AXIS, standingYaw).normalize();
      const idleCue = cuePoseFromGrip(idleRightHandTarget, idleDir, CFG.idleCueGripFromBack, CFG.cueLength);
      if (state === 'idle') { strikeT = 0; didHit = false; }
      else if (state === 'dragging') { strikeT = 0; didHit = false; }
      else {
        strikeT += dt;
        if (!didHit && strikeNorm > 0.88) { didHit = true; applyCueShot(cueBall, shotPowerRef.current, aimYawRef.current, tmpC, spinRef.current); }
        if (strikeT >= CFG.strikeTime + CFG.holdTime) { strikeT = 0; didHit = false; setShotState('idle'); }
      }
      const activeCueBack = state === 'idle' ? idleCue.back : cueBackShoot;
      const activeCueTip = state === 'idle' ? idleCue.tip : cueTipShoot;
      setCuePose(cue, activeCueBack, activeCueTip);
      updateBalls(balls, dt, tmpB, tmpC, pocketPositions, rulesRef.current);
      if (rulesRef.current.score !== lastScore) { lastScore = rulesRef.current.score; setScore(lastScore); }
      if (rulesRef.current.target !== lastTarget) { lastTarget = rulesRef.current.target; setTarget(lastTarget); }
      if (rulesRef.current.foul !== lastFoul) { lastFoul = rulesRef.current.foul; setFoul(lastFoul); }
      updateHumanPose(human, dt, state, humanRootTarget, aimForward, bridgeHandTarget, idleRightHandTarget, idleLeftHandTarget, activeCueBack, activeCueTip, activePower);
      setLinePoints(cueLine, activeCueBack, cueBallWorld);
      setLinePoints(aimLine, cueBallWorld, cueBallWorld.clone().add(aimForward.clone().multiplyScalar(2.1 * CFG.scale)));
      updateCamera(camera, cameraMode, broadcastSystemId, cueBallWorld, aimForward, activePower, now);
      renderer.render(scene, camera);
    }
    animate();
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', onCanvasDown);
      canvas.removeEventListener('pointermove', onCanvasMove);
      canvas.removeEventListener('pointerup', onCanvasUp);
      canvas.removeEventListener('pointercancel', onCanvasUp);
      disposeTableLoader();
      renderer.dispose();
    };
  }, [activeCloth?.color, activeFrameRate.fps, activeFrameRate.pixelRatioCap, activeHdri, broadcastSystemId, cameraMode, textureId]);

  const resetSpin = () => {
    setSpin({ x: 0, y: 0 });
    if (spinDotRef.current) {
      spinDotRef.current.style.left = '50%';
      spinDotRef.current.style.top = '50%';
    }
  };
  const hudButton = 'pointer-events-auto rounded-full border border-white/15 bg-black/60 px-3 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-gray-100 shadow-[0_6px_18px_rgba(2,6,23,0.45)] transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70';
  const optionButtonClass = (active) => `w-full rounded-2xl border px-4 py-2 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${active ? 'border-emerald-300 bg-emerald-300/90 text-black shadow-[0_0_16px_rgba(16,185,129,0.55)]' : 'border-white/20 bg-white/10 text-white/80 hover:bg-white/20'}`;

  return (
    <div className="fixed inset-0 bg-[#0b0b0b] text-white">
      <div ref={hostRef} className="absolute inset-0">
        <canvas ref={canvasRef} className="block h-full w-full touch-none" />
      </div>
      <div className="pointer-events-none fixed inset-0 font-sans">
        <div className="absolute left-1/2 top-4 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => setConfigOpen((prev) => !prev)}
            aria-expanded={configOpen}
            aria-controls="snooker-champion-config-panel"
            className={hudButton}
            aria-label={configOpen ? 'Close game settings menu' : 'Open game settings menu'}
          >
            <span className="text-lg leading-none" aria-hidden="true">☰</span> Menu
          </button>
          {configOpen ? (
            <div id="snooker-champion-config-panel" className="pointer-events-auto mt-2 max-h-[72vh] w-[min(92vw,26rem)] overflow-y-auto rounded-3xl border border-emerald-400/45 bg-slate-950/92 p-4 text-xs shadow-[0_24px_58px_rgba(0,0,0,0.68)] backdrop-blur">
              <div className="flex items-center justify-between gap-4">
                <span className="text-[10px] uppercase tracking-[0.45em] text-emerald-200/80">Snooker Champion Menu</span>
                <button type="button" onClick={() => setConfigOpen(false)} className="rounded-full p-1 text-white/70 transition hover:text-white" aria-label="Close setup">✕</button>
              </div>
              <div className="mt-3 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-[11px] font-semibold leading-relaxed text-emerald-50/85">
                Mirrors Pool Royale controls: graphics quality, table textures, cloth, HDRI room mood, cameras, broadcast style, power slider, and spin controller.
              </div>
              <div className="mt-4 space-y-4">
                <div>
                  <h3 className="text-[10px] uppercase tracking-[0.35em] text-emerald-100/70">Graphics</h3>
                  <div className="mt-2 grid gap-2">
                    {FRAME_RATE_OPTIONS.map((option) => (
                      <button key={option.id} type="button" onClick={() => setFrameRateId(option.id)} aria-pressed={option.id === frameRateId} className={optionButtonClass(option.id === frameRateId)}>
                        <span className="flex items-center justify-between gap-2"><span className="font-black uppercase tracking-[0.2em]">{option.label}</span><span>{option.resolution}</span></span>
                        <span className="mt-1 block text-[10px] uppercase tracking-[0.16em] opacity-70">{option.description}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-[10px] uppercase tracking-[0.35em] text-emerald-100/70">HDRI Rooms</h3>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {hdriOptions.map((option) => (
                      <button key={option.id} type="button" onClick={() => setEnvironmentHdriId(option.id)} aria-pressed={option.id === environmentHdriId} className={optionButtonClass(option.id === environmentHdriId)}>
                        <span className="font-bold">{option.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-[10px] uppercase tracking-[0.35em] text-emerald-100/70">Cloth</h3>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {clothOptions.map((option) => (
                      <button key={option.id} type="button" onClick={() => setClothId(option.id)} aria-pressed={option.id === clothId} className={optionButtonClass(option.id === clothId)}>
                        <span className="inline-flex items-center gap-2"><span className="h-4 w-4 rounded-full border border-white/30" style={{ backgroundColor: `#${new THREE.Color(option.color ?? 0x0f6f45).getHexString()}` }} />{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-[10px] uppercase tracking-[0.35em] text-emerald-100/70">Table Textures</h3>
                  <div className="mt-2 grid gap-2">
                    {textureOptions.map((option) => (
                      <button key={option.id} type="button" onClick={() => setTextureId(option.id)} aria-pressed={option.id === textureId} className={optionButtonClass(option.id === textureId)}>
                        <span className="font-bold">{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-[10px] uppercase tracking-[0.35em] text-emerald-100/70">Cameras</h3>
                  <div className="mt-2 grid gap-2">
                    {CAMERA_MODE_OPTIONS.map((option) => (
                      <button key={option.id} type="button" onClick={() => setCameraMode(option.id)} aria-pressed={option.id === cameraMode} className={optionButtonClass(option.id === cameraMode)}>
                        <span className="font-bold">{option.label}</span><span className="mt-1 block opacity-70">{option.description}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-[10px] uppercase tracking-[0.35em] text-emerald-100/70">Broadcast Modes</h3>
                  <div className="mt-2 grid gap-2">
                    {BROADCAST_SYSTEM_OPTIONS.map((option) => (
                      <button key={option.id} type="button" onClick={() => setBroadcastSystemId(option.id)} aria-pressed={option.id === broadcastSystemId} className={optionButtonClass(option.id === broadcastSystemId)}>
                        <span className="flex items-center justify-between gap-2"><span className="font-bold">{option.label}</span><span className="text-[10px] opacity-70">{option.method}</span></span>
                        <span className="mt-1 block opacity-70">{option.description}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div
          className="absolute bottom-3 z-50 flex pointer-events-none justify-center"
          style={{
            left: `${POOL_ROYALE_BOTTOM_HUD_LEFT_INSET_PX}px`,
            right: `${POOL_ROYALE_BOTTOM_HUD_RIGHT_INSET_PX}px`
          }}
        >
          <div className="pointer-events-auto flex min-h-[3.35rem] max-w-[min(40rem,100%)] items-center justify-center gap-5 rounded-full border border-emerald-400/40 bg-black/70 py-3 pl-8 pr-10 text-white shadow-[0_12px_32px_rgba(0,0,0,0.45)] backdrop-blur">
            <div className="flex min-w-0 flex-col" data-player-index="0">
              <div className="flex min-w-0 items-center gap-2.5">
                <img
                  src={playerAvatar}
                  alt="player avatar"
                  className={`${avatarSizeClass} rounded-full object-cover ring-2 ring-emerald-200 shadow-[0_0_16px_rgba(16,185,129,0.55)] transition-all duration-150`}
                />
                <span className={`${nameWidthClass} truncate ${nameTextClass} font-semibold tracking-wide`}>{playerName}</span>
              </div>
              <div className="mt-1 flex items-center gap-1 pl-1">
                {Array.from({ length: 5 }).map((_, index) => <span key={`player-red-${index}`} className="h-2 w-2 rounded-full bg-red-600/85" />)}
                <span className="h-2 w-2 rounded-full bg-yellow-300" />
                <span className="h-2 w-2 rounded-full bg-green-500" />
                <span className="h-2 w-2 rounded-full bg-blue-500" />
              </div>
            </div>
            <div className="flex items-center gap-2 text-base font-semibold">
              <span className="text-amber-300">{score}</span>
              <span className="text-white/50">-</span>
              <span>{opponentScore}</span>
            </div>
            <div className="flex min-w-0 flex-col text-sm" data-player-index="1">
              <div className="flex min-w-0 items-center gap-2.5">
                <img
                  src={opponentAvatar}
                  alt="opponent avatar"
                  className={`${avatarSizeClass} rounded-full object-cover transition-all duration-150`}
                />
                <span className={`${nameWidthClass} truncate ${nameTextClass} font-semibold tracking-wide`}>{opponentName}</span>
              </div>
              <div className="mt-1 flex items-center gap-1 pl-1">
                {Array.from({ length: 5 }).map((_, index) => <span key={`opponent-red-${index}`} className="h-2 w-2 rounded-full bg-red-900/70" />)}
                <span className="h-2 w-2 rounded-full bg-yellow-900/70" />
                <span className="h-2 w-2 rounded-full bg-green-900/70" />
                <span className="h-2 w-2 rounded-full bg-blue-900/70" />
              </div>
            </div>
          </div>
        </div>

        <div className="absolute left-3 top-3 max-w-[min(76vw,28rem)] rounded-2xl border border-emerald-300/20 bg-black/45 p-2 text-[11px] leading-relaxed text-white/75 shadow-xl backdrop-blur">
          <strong className="text-emerald-100">{gameTitle}</strong> • Target: <span className="font-black text-emerald-200">{target}</span>
          {foul ? <><br /><span className="font-bold text-red-200">{foul}</span></> : null}
          <br />{tableStatus} • {humanStatus}
        </div>

        <div className="pointer-events-auto absolute right-4 top-1/2 z-40 h-[320px] w-[70px] -translate-y-1/2 touch-none select-none" ref={sliderMountRef} />

        <div
          className="absolute pointer-events-auto z-40"
          style={{
            right: '28px',
            bottom: `${POOL_ROYALE_BOTTOM_OFFSET_PX}px`,
            transform: 'scale(0.88)',
            transformOrigin: 'bottom right'
          }}
        >
          <div
            id="spinBox"
            ref={spinPadRef}
            className="relative rounded-full border border-white/70 bg-white shadow-[0_18px_34px_rgba(0,0,0,0.45)] touch-none"
            style={{ width: `${SPIN_CONTROL_DIAMETER_PX}px`, height: `${SPIN_CONTROL_DIAMETER_PX}px` }}
            aria-label="Pool Royale style spin controller"
          >
            <div
              id="spinDot"
              ref={spinDotRef}
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-600"
              style={{
                width: `${SPIN_DOT_DIAMETER_PX}px`,
                height: `${SPIN_DOT_DIAMETER_PX}px`,
                left: '50%',
                top: '50%'
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
