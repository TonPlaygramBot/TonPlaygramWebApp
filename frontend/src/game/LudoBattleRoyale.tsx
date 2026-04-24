import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const HUMAN_URL = 'https://threejs.org/examples/models/gltf/readyplayer.me.glb';
const TILE_COUNT = 10;
const DICE_SIZE = 0.066;
const TABLE_TOP_Y = 0.895;
const DICE_CENTER_Y = TABLE_TOP_Y + DICE_SIZE / 2;

type GamePhase = 'idle' | 'throwing';
type ArmMode =
  | 'idle'
  | 'reachDice'
  | 'gripDice'
  | 'holdDice'
  | 'windUp'
  | 'release'
  | 'followThrough'
  | 'reachToken'
  | 'gripToken'
  | 'carryToken'
  | 'placeToken';

type SavedBone = {
  rotation: THREE.Euler;
  position: THREE.Vector3;
};

type BoneRig = {
  bones: THREE.Bone[];
  saved: Map<THREE.Bone, SavedBone>;
  hips?: THREE.Bone;
  spine?: THREE.Bone;
  chest?: THREE.Bone;
  neck?: THREE.Bone;
  head?: THREE.Bone;
  leftUpperLeg?: THREE.Bone;
  leftLowerLeg?: THREE.Bone;
  leftFoot?: THREE.Bone;
  rightUpperLeg?: THREE.Bone;
  rightLowerLeg?: THREE.Bone;
  rightFoot?: THREE.Bone;
  leftUpperArm?: THREE.Bone;
  leftForeArm?: THREE.Bone;
  leftHand?: THREE.Bone;
  rightUpperArm?: THREE.Bone;
  rightForeArm?: THREE.Bone;
  rightHand?: THREE.Bone;
  rightThumb: THREE.Bone[];
  rightIndex: THREE.Bone[];
  rightMiddle: THREE.Bone[];
  rightRing: THREE.Bone[];
  rightPinky: THREE.Bone[];
};

type ActiveThrow = {
  startMs: number;
  result: number;
  fromTile: number;
  toTile: number;
  diceStart: THREE.Vector3;
  diceLanding: THREE.Vector3;
  rollAxis: THREE.Vector3;
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};
const easeOutCubic = (v: number) => 1 - Math.pow(1 - clamp01(v), 3);
const easeInOutCubic = (v: number) => {
  const t = clamp01(v);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
const lerp = THREE.MathUtils.lerp;

function makeCanvasTexture(draw: (ctx: CanvasRenderingContext2D, size: number) => void, size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function makeDiceFaceTexture(value: number) {
  const pipMaps: Record<number, Array<[number, number]>> = {
    1: [[0.5, 0.5]],
    2: [[0.32, 0.32], [0.68, 0.68]],
    3: [[0.3, 0.3], [0.5, 0.5], [0.7, 0.7]],
    4: [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]],
    5: [[0.3, 0.3], [0.7, 0.3], [0.5, 0.5], [0.3, 0.7], [0.7, 0.7]],
    6: [[0.3, 0.25], [0.7, 0.25], [0.3, 0.5], [0.7, 0.5], [0.3, 0.75], [0.7, 0.75]],
  };

  return makeCanvasTexture((ctx, size) => {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 16;
    roundRect(ctx, 10, 10, size - 20, size - 20, 26);
    ctx.stroke();
    ctx.fillStyle = '#0f172a';
    for (const [x, y] of pipMaps[value]) {
      ctx.beginPath();
      ctx.arc(x * size, y * size, size * 0.072, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function makeTileTexture(label: string, active = false) {
  return makeCanvasTexture((ctx, size) => {
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, active ? '#fbbf24' : '#334155');
    grad.addColorStop(1, active ? '#f59e0b' : '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = active ? '#fde68a' : '#94a3b8';
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, size - 16, size - 16);
    ctx.fillStyle = active ? '#111827' : '#e5e7eb';
    ctx.font = 'bold 88px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, size / 2, size / 2 + 5);
  });
}

function makeLabelSprite(text: string, color = '#ffffff', bg = 'rgba(15, 23, 42, 0.82)') {
  const tex = makeCanvasTexture((ctx, size) => {
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = bg;
    roundRect(ctx, 22, 64, size - 44, 128, 28);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.font = 'bold 54px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, size / 2, 128);
  }, 512);

  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(0.9, 0.45, 1);
  return sprite;
}

function roundedBox(width: number, height: number, depth: number, radius: number, smoothness = 3) {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: smoothness,
    bevelSize: radius * 0.45,
    bevelThickness: radius * 0.45,
  });
  geo.center();
  return geo;
}

function addBox(
  scene: THREE.Scene | THREE.Group,
  size: [number, number, number],
  position: [number, number, number],
  color: string,
  options: { roughness?: number; metalness?: number; radius?: number } = {},
) {
  const geo = options.radius
    ? roundedBox(size[0], size[1], size[2], options.radius)
    : new THREE.BoxGeometry(size[0], size[1], size[2]);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.65,
    metalness: options.metalness ?? 0.02,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function addCylinder(
  scene: THREE.Scene | THREE.Group,
  radiusTop: number,
  radiusBottom: number,
  height: number,
  position: [number, number, number],
  color: string,
  segments = 32,
) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
    new THREE.MeshStandardMaterial({ color, roughness: 0.7 }),
  );
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function normalizeBoneName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findBone(bones: THREE.Bone[], ...needles: string[]) {
  const normalized = bones.map((bone) => ({ bone, name: normalizeBoneName(bone.name) }));
  for (const needle of needles) {
    const clean = normalizeBoneName(needle);
    const exact = normalized.find((item) => item.name === clean);
    if (exact) return exact.bone;
    const contains = normalized.find((item) => item.name.includes(clean));
    if (contains) return contains.bone;
  }
  return undefined;
}

function findBoneChain(bones: THREE.Bone[], ...needles: string[]) {
  const normalized = bones.map((bone) => ({ bone, name: normalizeBoneName(bone.name) }));
  const result: THREE.Bone[] = [];

  for (const needle of needles) {
    const clean = normalizeBoneName(needle);
    const matched = normalized
      .filter((item) => item.name.includes(clean))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    for (const item of matched) {
      if (!result.includes(item.bone)) result.push(item.bone);
    }
    if (result.length) break;
  }

  return result.slice(0, 4);
}

function buildRig(model: THREE.Object3D): BoneRig {
  const bones: THREE.Bone[] = [];
  model.traverse((obj) => {
    if ((obj as THREE.Bone).isBone) bones.push(obj as THREE.Bone);
  });

  const saved = new Map<THREE.Bone, SavedBone>();
  bones.forEach((bone) => {
    saved.set(bone, {
      rotation: bone.rotation.clone(),
      position: bone.position.clone(),
    });
  });

  return {
    bones,
    saved,
    hips: findBone(bones, 'hips', 'pelvis'),
    spine: findBone(bones, 'spine'),
    chest: findBone(bones, 'spine2', 'chest', 'upperchest'),
    neck: findBone(bones, 'neck'),
    head: findBone(bones, 'head'),
    leftUpperLeg: findBone(bones, 'leftupleg', 'leftthigh', 'leftupperleg'),
    leftLowerLeg: findBone(bones, 'leftleg', 'leftlowerleg', 'leftcalf'),
    leftFoot: findBone(bones, 'leftfoot'),
    rightUpperLeg: findBone(bones, 'rightupleg', 'rightthigh', 'rightupperleg'),
    rightLowerLeg: findBone(bones, 'rightleg', 'rightlowerleg', 'rightcalf'),
    rightFoot: findBone(bones, 'rightfoot'),
    leftUpperArm: findBone(bones, 'leftarm', 'leftupperarm'),
    leftForeArm: findBone(bones, 'leftforearm', 'leftlowerarm'),
    leftHand: findBone(bones, 'lefthand'),
    rightUpperArm: findBone(bones, 'rightarm', 'rightupperarm'),
    rightForeArm: findBone(bones, 'rightforearm', 'rightlowerarm'),
    rightHand: findBone(bones, 'righthand'),
    rightThumb: findBoneChain(bones, 'righthandthumb', 'rightthumb'),
    rightIndex: findBoneChain(bones, 'righthandindex', 'rightindex'),
    rightMiddle: findBoneChain(bones, 'righthandmiddle', 'rightmiddle'),
    rightRing: findBoneChain(bones, 'righthandring', 'rightring'),
    rightPinky: findBoneChain(bones, 'righthandpinky', 'rightpinky'),
  };
}

function resetRig(rig: BoneRig) {
  rig.saved.forEach((base, bone) => {
    bone.rotation.copy(base.rotation);
    bone.position.copy(base.position);
  });
}

function addLocalRotation(rig: BoneRig, bone: THREE.Bone | undefined, x = 0, y = 0, z = 0, weight = 1) {
  if (!bone) return;
  const base = rig.saved.get(bone);
  if (!base) return;
  bone.rotation.x = base.rotation.x + x * weight;
  bone.rotation.y = base.rotation.y + y * weight;
  bone.rotation.z = base.rotation.z + z * weight;
}

function addLocalPosition(rig: BoneRig, bone: THREE.Bone | undefined, x = 0, y = 0, z = 0, weight = 1) {
  if (!bone) return;
  const base = rig.saved.get(bone);
  if (!base) return;
  bone.position.x = base.position.x + x * weight;
  bone.position.y = base.position.y + y * weight;
  bone.position.z = base.position.z + z * weight;
}

function curlChain(rig: BoneRig, chain: THREE.Bone[], amount: number, sideSpread = 0) {
  const grip = clamp01(amount);
  chain.forEach((bone, index) => {
    const curl = index === 0 ? -0.38 : -0.72;
    const side = index === 0 ? sideSpread : sideSpread * 0.25;
    addLocalRotation(rig, bone, curl * grip, 0.03 * grip, side * grip, 1);
  });
}

function applyRightHandGrip(rig: BoneRig, gripAmount: number) {
  const grip = clamp01(gripAmount);
  const open = 1 - grip;

  curlChain(rig, rig.rightIndex, grip, -0.08 + 0.08 * open);
  curlChain(rig, rig.rightMiddle, grip, -0.02);
  curlChain(rig, rig.rightRing, grip, 0.04 - 0.04 * open);
  curlChain(rig, rig.rightPinky, grip, 0.09 - 0.06 * open);

  rig.rightThumb.forEach((bone, index) => {
    const fold = index === 0 ? -0.28 : -0.48;
    addLocalRotation(rig, bone, fold * grip, -0.24 * grip, 0.22 * grip, 1);
  });
}

function applyHumanPose(rig: BoneRig | null, mode: ArmMode = 'idle', intensity = 0, handGrip = 0) {
  if (!rig) return;
  resetRig(rig);

  const t = smooth(intensity);
  const breathe = Math.sin(performance.now() * 0.002) * 0.012;

  addLocalPosition(rig, rig.hips, 0, -0.31, -0.105, 1);
  addLocalRotation(rig, rig.hips, -0.11, 0, 0, 1);
  addLocalRotation(rig, rig.spine, 0.15 + breathe, 0, 0, 1);
  addLocalRotation(rig, rig.chest, 0.12, 0, 0, 1);
  addLocalRotation(rig, rig.neck, -0.05, 0, 0, 1);
  addLocalRotation(rig, rig.head, -0.06, 0, 0, 1);

  addLocalRotation(rig, rig.leftUpperLeg, 0.94, -0.08, 0.04, 1);
  addLocalRotation(rig, rig.leftLowerLeg, -1.08, 0, 0, 1);
  addLocalRotation(rig, rig.leftFoot, 0.22, 0, 0, 1);
  addLocalRotation(rig, rig.rightUpperLeg, 0.94, 0.08, -0.04, 1);
  addLocalRotation(rig, rig.rightLowerLeg, -1.08, 0, 0, 1);
  addLocalRotation(rig, rig.rightFoot, 0.22, 0, 0, 1);

  addLocalRotation(rig, rig.leftUpperArm, -0.28, 0.12, 0.96, 1);
  addLocalRotation(rig, rig.leftForeArm, -0.62, 0.05, -0.24, 1);
  addLocalRotation(rig, rig.leftHand, -0.16, 0, 0, 1);

  let shoulderX = -0.2;
  let shoulderY = -0.02;
  let shoulderZ = -0.72;
  let forearmX = -0.5;
  let forearmY = -0.04;
  let forearmZ = 0.14;
  let wristX = -0.08;
  let wristY = 0;
  let wristZ = 0.06;
  let chestX = 0.12;
  let chestY = 0;
  let headX = -0.06;
  let headY = 0;

  if (mode === 'reachDice') {
    shoulderX = lerp(shoulderX, -0.7, t);
    shoulderY = lerp(shoulderY, -0.08, t);
    shoulderZ = lerp(shoulderZ, -1.03, t);
    forearmX = lerp(forearmX, -0.86, t);
    forearmY = lerp(forearmY, -0.18, t);
    forearmZ = lerp(forearmZ, -0.26, t);
    wristX = lerp(wristX, -0.2, t);
    wristY = lerp(wristY, 0.18, t);
    wristZ = lerp(wristZ, -0.18, t);
    chestX = lerp(chestX, 0.24, t);
    chestY = lerp(chestY, -0.08, t);
    headX = lerp(headX, 0.03, t);
    headY = lerp(headY, -0.08, t);
  }

  if (mode === 'gripDice') {
    shoulderX = lerp(shoulderX, -0.76, t);
    shoulderY = lerp(shoulderY, -0.1, t);
    shoulderZ = lerp(shoulderZ, -0.96, t);
    forearmX = lerp(forearmX, -0.82, t);
    forearmY = lerp(forearmY, -0.2, t);
    forearmZ = lerp(forearmZ, -0.18, t);
    wristX = lerp(wristX, -0.3, t);
    wristY = lerp(wristY, 0.15, t);
    wristZ = lerp(wristZ, -0.12, t);
    chestX = lerp(chestX, 0.23, t);
    chestY = lerp(chestY, -0.08, t);
    headX = lerp(headX, 0.01, t);
    headY = lerp(headY, -0.08, t);
  }

  if (mode === 'windUp') {
    shoulderX = lerp(shoulderX, -0.72, t);
    shoulderY = lerp(shoulderY, -0.34, t);
    shoulderZ = lerp(shoulderZ, -0.3, t);
    forearmX = lerp(forearmX, -1.18, t);
    forearmY = lerp(forearmY, -0.18, t);
    forearmZ = lerp(forearmZ, 0.46, t);
    wristX = lerp(wristX, -0.62, t);
    wristY = lerp(wristY, -0.08, t);
    wristZ = lerp(wristZ, 0.22, t);
  }

  if (mode === 'release') {
    shoulderX = lerp(shoulderX, -1.08, t);
    shoulderY = lerp(shoulderY, -0.18, t);
    shoulderZ = lerp(shoulderZ, -0.86, t);
    forearmX = lerp(forearmX, -0.34, t);
    forearmY = lerp(forearmY, -0.1, t);
    forearmZ = lerp(forearmZ, 0.04, t);
    wristX = lerp(wristX, 0.38, t);
    wristY = lerp(wristY, 0.14, t);
    wristZ = lerp(wristZ, -0.08, t);
  }

  if (mode === 'followThrough') {
    shoulderX = lerp(shoulderX, -0.86, t);
    shoulderY = lerp(shoulderY, -0.12, t);
    shoulderZ = lerp(shoulderZ, -1.02, t);
    forearmX = lerp(forearmX, -0.22, t);
    forearmY = lerp(forearmY, 0.02, t);
    forearmZ = lerp(forearmZ, -0.05, t);
    wristX = lerp(wristX, 0.22, t);
    wristZ = lerp(wristZ, -0.08, t);
  }

  if (mode === 'reachToken') {
    shoulderX = lerp(shoulderX, -0.84, t);
    shoulderY = lerp(shoulderY, 0.04, t);
    shoulderZ = lerp(shoulderZ, -1.02, t);
    forearmX = lerp(forearmX, -0.72, t);
    forearmY = lerp(forearmY, -0.18, t);
    forearmZ = lerp(forearmZ, -0.22, t);
    wristX = lerp(wristX, -0.14, t);
    wristY = lerp(wristY, 0.16, t);
    wristZ = lerp(wristZ, -0.2, t);
    chestX = lerp(chestX, 0.24, t);
    headX = lerp(headX, 0.08, t);
  }

  if (mode === 'gripToken') {
    shoulderX = lerp(shoulderX, -0.88, t);
    shoulderY = lerp(shoulderY, 0.02, t);
    shoulderZ = lerp(shoulderZ, -1, t);
    forearmX = lerp(forearmX, -0.7, t);
    forearmY = lerp(forearmY, -0.14, t);
    forearmZ = lerp(forearmZ, -0.18, t);
    wristX = lerp(wristX, -0.22, t);
    wristY = lerp(wristY, 0.12, t);
    wristZ = lerp(wristZ, -0.14, t);
  }

  if (mode === 'carryToken') {
    shoulderX = lerp(shoulderX, -0.94, t);
    shoulderY = lerp(shoulderY, -0.04, t);
    shoulderZ = lerp(shoulderZ, -1.08, t);
    forearmX = lerp(forearmX, -0.54, t);
    forearmY = lerp(forearmY, -0.12, t);
    forearmZ = lerp(forearmZ, -0.12, t);
    wristX = lerp(wristX, 0.02, t);
    wristY = lerp(wristY, 0.1, t);
    wristZ = lerp(wristZ, -0.1, t);
  }

  if (mode === 'placeToken') {
    shoulderX = lerp(shoulderX, -0.76, t);
    shoulderY = lerp(shoulderY, 0.02, t);
    shoulderZ = lerp(shoulderZ, -0.92, t);
    forearmX = lerp(forearmX, -0.84, t);
    forearmY = lerp(forearmY, -0.16, t);
    forearmZ = lerp(forearmZ, -0.26, t);
    wristX = lerp(wristX, -0.24, t);
    wristY = lerp(wristY, 0.12, t);
    wristZ = lerp(wristZ, -0.16, t);
  }

  addLocalRotation(rig, rig.chest, chestX, chestY, 0, 1);
  addLocalRotation(rig, rig.head, headX, headY, 0, 1);
  addLocalRotation(rig, rig.rightUpperArm, shoulderX, shoulderY, shoulderZ, 1);
  addLocalRotation(rig, rig.rightForeArm, forearmX, forearmY, forearmZ, 1);
  addLocalRotation(rig, rig.rightHand, wristX, wristY, wristZ, 1);
  applyRightHandGrip(rig, handGrip);
}

function createDice() {
  const materials = [1, 6, 2, 5, 3, 4].map(
    (value) =>
      new THREE.MeshStandardMaterial({
        map: makeDiceFaceTexture(value),
        roughness: 0.38,
        metalness: 0.02,
      }),
  );
  const dice = new THREE.Mesh(new THREE.BoxGeometry(DICE_SIZE, DICE_SIZE, DICE_SIZE), materials);
  dice.castShadow = true;
  dice.receiveShadow = true;
  return dice;
}

function createToken() {
  const group = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.072, 0.086, 0.08, 44),
    new THREE.MeshStandardMaterial({ color: '#ef4444', roughness: 0.36, metalness: 0.12 }),
  );
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.072, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.MeshStandardMaterial({ color: '#f87171', roughness: 0.4, metalness: 0.05 }),
  );
  cap.position.y = 0.04;
  cap.castShadow = true;
  cap.receiveShadow = true;
  group.add(cap);
  return group;
}

function tilePosition(index: number) {
  const startX = -0.95;
  const step = 0.21;
  return new THREE.Vector3(startX + index * step, 0.91, -0.37);
}

function tokenPlacedPosition(index: number) {
  return tilePosition(index).add(new THREE.Vector3(0, 0.095, 0));
}

function diceFinalRotation(result: number) {
  const rotations: Record<number, THREE.Euler> = {
    1: new THREE.Euler(0, 0, 0),
    2: new THREE.Euler(-Math.PI / 2, 0, 0),
    3: new THREE.Euler(0, 0, Math.PI / 2),
    4: new THREE.Euler(0, 0, -Math.PI / 2),
    5: new THREE.Euler(Math.PI / 2, 0, 0),
    6: new THREE.Euler(Math.PI, 0, 0),
  };
  return rotations[result] ?? rotations[1];
}

function diceHoldPoint(t: number) {
  const a = clamp01(t);
  if (a < 0.52) {
    const p = smooth(a / 0.52);
    return new THREE.Vector3(lerp(-0.55, -0.73, p), lerp(1.02, 1.15, p), lerp(-0.02, 0.15, p));
  }
  const p = easeOutCubic((a - 0.52) / 0.48);
  return new THREE.Vector3(lerp(-0.73, -0.22, p), lerp(1.15, 1.1, p), lerp(0.15, -0.08, p));
}

function diceGripPointFromTable(start: THREE.Vector3, t: number) {
  const p = smooth(t);
  const hold = diceHoldPoint(0);
  const liftArc = Math.sin(p * Math.PI) * 0.085;
  return new THREE.Vector3(lerp(start.x, hold.x, p), lerp(start.y, hold.y, p) + liftArc, lerp(start.z, hold.z, p));
}

function tokenCarryPoint(fromTile: number, toTile: number, t: number) {
  const from = tokenPlacedPosition(fromTile);
  const to = tokenPlacedPosition(toTile);
  if (toTile <= fromTile) return from.clone();

  const totalSegments = toTile - fromTile;
  const scaled = clamp01(t) * totalSegments;
  const segment = Math.min(totalSegments - 1, Math.floor(scaled));
  const localT = smooth(scaled - segment);
  const a = tokenPlacedPosition(fromTile + segment);
  const b = tokenPlacedPosition(fromTile + segment + 1);

  return new THREE.Vector3(lerp(a.x, b.x, localT), Math.max(from.y, to.y) + 0.245 + Math.sin(localT * Math.PI) * 0.025, lerp(a.z, b.z, localT));
}

export function LudoBattleRoyale() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [diceResult, setDiceResult] = useState<number | null>(null);
  const [tokenTile, setTokenTile] = useState(1);
  const [phase, setPhase] = useState<GamePhase>('idle');
  const throwRequestRef = useRef(0);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0f172a');
    scene.fog = new THREE.Fog('#0f172a', 5.4, 11);
    const initialSize = { width: mount.clientWidth || window.innerWidth, height: mount.clientHeight || window.innerHeight };

    const camera = new THREE.PerspectiveCamera(42, initialSize.width / initialSize.height, 0.1, 100);
    camera.position.set(1.75, 1.62, -3.95);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(initialSize.width, initialSize.height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(-0.34, 0.9, 0.35);
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minDistance = 2.4;
    controls.maxDistance = 6.2;
    controls.update();

    scene.add(new THREE.HemisphereLight(0xf8fafc, 0x111827, 1.25));
    const key = new THREE.DirectionalLight(0xffffff, 3);
    key.position.set(2.5, 4.8, -3.5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x93c5fd, 1);
    rim.position.set(-3.2, 2.7, 3.5);
    scene.add(rim);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshStandardMaterial({ color: '#1f2937', roughness: 0.94 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const chair = new THREE.Group();
    scene.add(chair);
    addBox(chair, [0.76, 0.13, 0.72], [-0.9, 0.45, 0.67], '#78350f', { roughness: 0.62, radius: 0.04 });
    addBox(chair, [0.78, 0.86, 0.12], [-0.9, 0.9, 0.99], '#92400e', { roughness: 0.58, radius: 0.05 });
    for (const x of [-1.22, -0.58]) {
      for (const z of [0.38, 0.92]) {
        addCylinder(chair, 0.035, 0.042, 0.48, [x, 0.23, z], '#451a03', 18);
      }
    }

    const table = new THREE.Group();
    scene.add(table);
    addBox(table, [2.55, 0.14, 1.16], [0.02, 0.78, -0.03], '#7c2d12', { roughness: 0.54, radius: 0.055 });
    addBox(table, [2.28, 0.035, 0.95], [0.02, 0.875, -0.03], '#a16207', { roughness: 0.5, radius: 0.035 });
    for (const x of [-1.08, 1.12]) {
      for (const z of [-0.48, 0.42]) {
        addCylinder(table, 0.045, 0.06, 0.78, [x, 0.39, z], '#451a03', 18);
      }
    }

    const tiles: THREE.Mesh[] = [];
    for (let i = 0; i < TILE_COUNT; i += 1) {
      const tile = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.035, 0.18),
        new THREE.MeshStandardMaterial({ map: makeTileTexture(String(i + 1), i === 0), roughness: 0.48, metalness: 0.02 }),
      );
      tile.position.copy(tilePosition(i));
      tile.castShadow = true;
      tile.receiveShadow = true;
      scene.add(tile);
      tiles.push(tile);
    }

    const dice = createDice();
    const firstDiceRest = new THREE.Vector3(-0.42, DICE_CENTER_Y, -0.04);
    dice.position.copy(firstDiceRest);
    dice.rotation.set(0.12, 0.35, 0.18);
    scene.add(dice);

    const token = createToken();
    token.position.copy(tokenPlacedPosition(0));
    scene.add(token);

    const resultSprite = makeLabelSprite('Ready', '#e2e8f0');
    resultSprite.position.set(0.55, 1.42, -0.15);
    scene.add(resultSprite);

    let human: THREE.Group | null = null;
    let rig: BoneRig | null = null;
    const loader = new GLTFLoader();
    loader.setCrossOrigin('anonymous');

    loader.load(HUMAN_URL, (gltf) => {
      human = gltf.scene;
      human.scale.setScalar(1.08);
      human.position.set(-0.9, -0.07, 0.62);
      human.rotation.set(0, Math.PI, 0);
      human.traverse((obj: any) => {
        if (obj.isMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
          obj.frustumCulled = false;
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((mat: THREE.Material & { map?: THREE.Texture }) => {
            if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
            mat.needsUpdate = true;
          });
        }
      });
      rig = buildRig(human);
      applyHumanPose(rig, 'idle', 1, 0);
      scene.add(human);
    });

    let frameId = 0;
    let active: ActiveThrow | null = null;
    let currentTile = 0;
    let lastResult: number | null = null;
    let lastDiceRest = firstDiceRest.clone();
    let lastThrowRequest = throwRequestRef.current;

    const setActiveTile = (index: number) => {
      tiles.forEach((tile, i) => {
        const mat = tile.material as THREE.MeshStandardMaterial;
        mat.map?.dispose();
        mat.map = makeTileTexture(String(i + 1), i === index);
        mat.needsUpdate = true;
      });
    };

    const startThrow = () => {
      const result = Math.floor(Math.random() * 6) + 1;
      active = {
        startMs: performance.now(),
        result,
        fromTile: currentTile,
        toTile: Math.min(TILE_COUNT - 1, currentTile + result),
        diceStart: lastDiceRest.clone(),
        diceLanding: new THREE.Vector3(0.12 + (Math.random() - 0.5) * 0.34, DICE_CENTER_Y, -0.13 + (Math.random() - 0.5) * 0.18),
        rollAxis: new THREE.Vector3(Math.random() * 0.7 + 0.4, Math.random() * 0.45 + 0.15, Math.random() * 0.8 + 0.4).normalize(),
      };
      setPhase('throwing');
      setDiceResult(null);
    };

    const updateLoop = (now: number) => {
      if (!active) {
        applyHumanPose(rig, 'idle', 1, 0);
        dice.position.lerp(lastDiceRest, 0.18);
        return;
      }

      const seconds = (now - active.startMs) / 1000;
      const gripDiceT = clamp01((seconds - 0.55) / 0.3);
      const windT = clamp01((seconds - 0.85) / 0.46);
      const releaseT = clamp01((seconds - 1.31) / 0.28);
      const flightT = clamp01((seconds - 1.58) / 0.72);
      const rollT = clamp01((seconds - 2.3) / 0.82);
      const settleT = clamp01((seconds - 3.12) / 0.32);
      const reachTokenT = clamp01((seconds - 3.52) / 0.55);
      const gripTokenT = clamp01((seconds - 4.07) / 0.28);
      const carryT = clamp01((seconds - 4.35) / 1.16);
      const placeT = clamp01((seconds - 5.51) / 0.46);
      const returnT = clamp01((seconds - 5.97) / 0.45);

      if (seconds < 0.55) applyHumanPose(rig, 'reachDice', clamp01(seconds / 0.55), 0.05);
      else if (seconds < 0.85) applyHumanPose(rig, 'gripDice', gripDiceT, gripDiceT);
      else if (seconds < 1.31) applyHumanPose(rig, 'windUp', windT, 1);
      else if (seconds < 1.58) applyHumanPose(rig, 'release', releaseT, 1 - releaseT);
      else if (seconds < 2.55) applyHumanPose(rig, 'followThrough', clamp01((seconds - 1.58) / 0.65), 0);
      else if (seconds < 3.52) applyHumanPose(rig, 'idle', 1, 0);
      else if (seconds < 4.07) applyHumanPose(rig, 'reachToken', reachTokenT, 0.05);
      else if (seconds < 4.35) applyHumanPose(rig, 'gripToken', gripTokenT, gripTokenT);
      else if (seconds < 5.51) applyHumanPose(rig, 'carryToken', carryT, 1);
      else if (seconds < 5.97) applyHumanPose(rig, 'placeToken', placeT, 1 - placeT * 0.85);
      else applyHumanPose(rig, 'idle', returnT, 0);

      if (seconds < 0.55) dice.position.copy(active.diceStart);
      else if (seconds < 0.85) dice.position.copy(diceGripPointFromTable(active.diceStart, gripDiceT));
      else if (seconds < 1.58) dice.position.copy(diceHoldPoint(seconds < 1.31 ? windT * 0.56 : 0.56 + releaseT * 0.44));
      else if (seconds < 2.3) {
        const t = easeInOutCubic(flightT);
        const releasePoint = diceHoldPoint(1);
        dice.position.set(
          lerp(releasePoint.x, active.diceLanding.x - 0.14, t),
          lerp(releasePoint.y, active.diceLanding.y + 0.015, t) + Math.sin(t * Math.PI) * 0.42,
          lerp(releasePoint.z, active.diceLanding.z + 0.06, t),
        );
      } else if (seconds < 3.12) {
        const t = clamp01(rollT);
        const ease = easeOutCubic(t);
        dice.position.set(
          lerp(active.diceLanding.x - 0.14, active.diceLanding.x, ease),
          active.diceLanding.y + Math.abs(Math.sin(t * Math.PI * 6.5)) * Math.pow(1 - t, 1.65) * 0.105,
          lerp(active.diceLanding.z + 0.06, active.diceLanding.z, ease),
        );
      } else {
        const finalRot = diceFinalRotation(active.result);
        const t = smooth(settleT) * 0.22;
        dice.position.lerp(active.diceLanding, 0.22);
        dice.rotation.x = lerp(dice.rotation.x, finalRot.x, t);
        dice.rotation.y = lerp(dice.rotation.y, finalRot.y, t);
        dice.rotation.z = lerp(dice.rotation.z, finalRot.z, t);
      }

      if (settleT >= 1 && lastResult !== active.result) {
        lastResult = active.result;
        setDiceResult(active.result);
      }

      if (seconds < 4.07) token.position.copy(tokenPlacedPosition(active.fromTile));
      else if (seconds < 4.35) token.position.copy(tokenPlacedPosition(active.fromTile).lerp(tokenPlacedPosition(active.fromTile).add(new THREE.Vector3(0, 0.25, 0)), smooth(gripTokenT)));
      else if (seconds < 5.51) token.position.copy(tokenCarryPoint(active.fromTile, active.toTile, easeInOutCubic(carryT)));
      else token.position.copy(tokenCarryPoint(active.fromTile, active.toTile, 1).lerp(tokenPlacedPosition(active.toTile), smooth(placeT)));

      if (seconds >= 6.42) {
        currentTile = active.toTile;
        setTokenTile(currentTile + 1);
        setActiveTile(currentTile);
        token.position.copy(tokenPlacedPosition(currentTile));
        dice.position.copy(active.diceLanding);
        lastDiceRest = active.diceLanding.clone();
        active = null;
        setPhase('idle');
      }
    };

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const now = performance.now();
      if (throwRequestRef.current !== lastThrowRequest && !active) {
        lastThrowRequest = throwRequestRef.current;
        if (currentTile >= TILE_COUNT - 1) {
          currentTile = 0;
          setTokenTile(1);
          setActiveTile(0);
          token.position.copy(tokenPlacedPosition(0));
          lastDiceRest.copy(firstDiceRest);
          dice.position.copy(firstDiceRest);
        }
        startThrow();
      }
      updateLoop(now);
      controls.update();
      renderer.render(scene, camera);
    };

    const onResize = () => {
      const w = mount.clientWidth || window.innerWidth;
      const h = mount.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', onResize);
    animate();

    const click = () => {
      if (active) return;
      throwRequestRef.current += 1;
    };

    mount.addEventListener('click', click);

    return () => {
      mount.removeEventListener('click', click);
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(frameId);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-slate-950 text-white">
      <div ref={mountRef} className="h-full w-full" />
      <div className="pointer-events-none absolute left-3 right-3 top-3 rounded-2xl border border-white/10 bg-slate-950/70 p-3 shadow-2xl backdrop-blur">
        <div className="text-sm font-semibold tracking-wide text-slate-100">Ludo Battle Royale — Seated Human Dice Throw</div>
        <div className="mt-1 text-xs leading-snug text-slate-300">Tap anywhere to run the full pickup → throw → token carry animation.</div>
        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-200">
          <span>Dice: <b className="text-amber-200">{diceResult ?? '—'}</b></span>
          <span>Token tile: <b className="text-rose-200">{tokenTile}/10</b></span>
          <span>Status: <b className="text-cyan-200">{phase}</b></span>
        </div>
      </div>
      <button
        onClick={() => {
          throwRequestRef.current += 1;
        }}
        className="absolute bottom-5 left-1/2 w-[min(88vw,360px)] -translate-x-1/2 rounded-2xl bg-amber-400 px-5 py-4 text-base font-bold text-slate-950 shadow-2xl"
      >
        {phase === 'throwing' ? 'Animating...' : tokenTile === 10 ? 'Restart + Throw Dice' : 'Pick + Throw Dice'}
      </button>
    </div>
  );
}
