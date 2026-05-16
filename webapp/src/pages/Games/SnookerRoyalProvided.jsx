import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import {
  resolveSnookerGlbFitTransform,
  TABLE_MODEL_OPENSOURCE_GLB_URL
} from './snookerTableModel.js';

const HUMAN_URL = 'https://threejs.org/examples/models/gltf/readyplayer.me.glb';

const MENU_PRESETS = {
  graphics: [
    { id: 'performance', label: 'Performance', pixelRatio: 1.15, shadows: false },
    { id: 'balanced', label: 'Balanced', pixelRatio: 1.6, shadows: true },
    { id: 'ultra', label: 'Ultra', pixelRatio: 2, shadows: true }
  ],
  cloth: [
    { id: 'championship', label: 'Championship Green', color: 0x0f6f45, repeat: [7, 13] },
    { id: 'televised', label: 'TV Emerald', color: 0x087a4a, repeat: [8, 14] },
    { id: 'royal', label: 'Royal Blue', color: 0x174ea6, repeat: [6, 12] }
  ],
  finish: [
    { id: 'walnut', label: 'Walnut Rail', wood: 0x4d2f1f, cushion: 0x1b5b39 },
    { id: 'mahogany', label: 'Mahogany Rail', wood: 0x6b2f1a, cushion: 0x145c35 },
    { id: 'ebony', label: 'Ebony Rail', wood: 0x14100e, cushion: 0x0f4f35 }
  ],
  hdri: [
    { id: 'studio', label: 'Studio HDRI', url: null, background: 0x0b0b0b, exposure: 1.05 },
    { id: 'arena', label: 'Arena HDRI', url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_09_1k.hdr', background: 0x101827, exposure: 1.18 },
    { id: 'club', label: 'Club HDRI', url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/exr/1k/satara_night_1k.exr', background: 0x09090b, exposure: 0.92 }
  ],
  camera: [
    { id: 'broadcast-a', label: 'Broadcast A', pos: [1.85, 2.45, 7.85], target: [0, 1.05, 0], fov: 40 },
    { id: 'broadcast-b', label: 'Broadcast B', pos: [-4.8, 2.8, -5.9], target: [0, 0.95, 0], fov: 42 },
    { id: 'cue', label: 'Cue Follow', pos: [0, 1.18, 2.1], target: [0, 0.86, 0], fov: 48 },
    { id: 'overhead', label: 'Overhead', pos: [0, 8.8, 0.01], target: [0, 0.84, 0], fov: 36 }
  ]
};
const DEFAULT_OPTIONS = Object.freeze({ graphics: 'balanced', cloth: 'championship', finish: 'walnut', hdri: 'studio', camera: 'broadcast-a' });
const SNOOKER_COLOURS = Object.freeze({
  red: { value: 1, label: 'Red' },
  yellow: { value: 2, label: 'Yellow' },
  green: { value: 3, label: 'Green' },
  brown: { value: 4, label: 'Brown' },
  blue: { value: 5, label: 'Blue' },
  pink: { value: 6, label: 'Pink' },
  black: { value: 7, label: 'Black' }
});
function findPreset(group, id) {
  return MENU_PRESETS[group].find((item) => item.id === id) || MENU_PRESETS[group][0];
}
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
function createBall(number, color, isCue = false, meta = {}) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(CFG.ballR, 48, 48), createMaterial(color, isCue ? 0.18 : 0.28, 0.018));
  const shine = new THREE.Mesh(new THREE.SphereGeometry(CFG.ballR * 0.18, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22 }));
  shine.position.set(-CFG.ballR * 0.28, CFG.ballR * 0.34, CFG.ballR * 0.32);
  mesh.add(shine);
  mesh.userData = { ballNumber: number, snookerRole: meta.role, snookerValue: meta.value || 0, spot: meta.spot?.clone?.() || null };
  enableShadow(mesh);
  return {
    mesh,
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    spin: new THREE.Vector2(),
    isCue,
    number,
    role: meta.role || (isCue ? 'cue' : 'red'),
    value: meta.value || 0,
    label: meta.label || '',
    spot: meta.spot?.clone?.() || null,
    potted: false,
    radius: CFG.ballR
  };
}
function snookerRackPositions() {
  const out = [{ n: 0, c: 0xf8fafc, p: new THREE.Vector3(0, CFG.ballR, CFG.tableL * 0.31), cue: true, role: 'cue', value: 0, label: 'Cue' }];
  const redOrigin = new THREE.Vector3(0, CFG.ballR, -CFG.tableL * 0.19);
  let idx = 1;
  for (let row = 0; row < 5; row += 1) {
    for (let i = 0; i <= row; i += 1) {
      out.push({
        n: idx++,
        c: 0xdc2626,
        role: 'red',
        value: SNOOKER_COLOURS.red.value,
        label: SNOOKER_COLOURS.red.label,
        p: new THREE.Vector3(redOrigin.x + (i - row / 2) * CFG.ballR * 2.05, CFG.ballR, redOrigin.z - row * CFG.ballR * 1.88)
      });
    }
  }
  const colourBalls = [
    { role: 'yellow', c: 0xfacc15, p: new THREE.Vector3(-CFG.tableW * 0.23, CFG.ballR, CFG.tableL * 0.2) },
    { role: 'green', c: 0x16a34a, p: new THREE.Vector3(CFG.tableW * 0.23, CFG.ballR, CFG.tableL * 0.2) },
    { role: 'brown', c: 0x7c2d12, p: new THREE.Vector3(0, CFG.ballR, CFG.tableL * 0.2) },
    { role: 'blue', c: 0x2563eb, p: new THREE.Vector3(0, CFG.ballR, 0) },
    { role: 'pink', c: 0xf472b6, p: new THREE.Vector3(0, CFG.ballR, -CFG.tableL * 0.13) },
    { role: 'black', c: 0x111827, p: new THREE.Vector3(0, CFG.ballR, -CFG.tableL * 0.37) }
  ];
  colourBalls.forEach((ball) => {
    const spec = SNOOKER_COLOURS[ball.role];
    out.push({ ...ball, n: idx++, value: spec.value, label: spec.label, spot: ball.p.clone() });
  });
  return out;
}
function addBalls(tableGroup) {
  const balls = snookerRackPositions().map((item) => {
    const ball = createBall(item.n, item.c, Boolean(item.cue), item);
    ball.pos.copy(item.p);
    ball.mesh.position.copy(ball.pos);
    tableGroup.add(ball.mesh);
    return ball;
  });
  return { balls, cueBall: balls.find((b) => b.isCue) || balls[0] };
}
function createBaizeTexture(clothPreset = findPreset('cloth', DEFAULT_OPTIONS.cloth)) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = `#${clothPreset.color.toString(16).padStart(6, '0')}`;
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 18000; i += 1) {
    const a = 0.025 + Math.random() * 0.06;
    ctx.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 2, 1);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(...clothPreset.repeat);
  return tex;
}
function addTable(scene, renderer, setStatus, optionsRef) {
  const tableGroup = new THREE.Group();
  tableGroup.position.y = CFG.tableTopY;
  scene.add(tableGroup);
  const proceduralParts = new THREE.Group();
  tableGroup.add(proceduralParts);
  const applyTableMaterials = () => {
    const clothPreset = findPreset('cloth', optionsRef.current.cloth);
    const finishPreset = findPreset('finish', optionsRef.current.finish);
    proceduralParts.clear();
    addBox(proceduralParts, [CFG.tableW * CFG.tableVisualMultiplier + 0.1 * CFG.scale, CFG.topThickness, CFG.tableL * CFG.tableVisualMultiplier + 0.1 * CFG.scale], [0, -CFG.topThickness / 2 + CFG.ballR, 0], new THREE.MeshStandardMaterial({ color: clothPreset.color, map: createBaizeTexture(clothPreset), roughness: 0.96 }));
    const wood = createMaterial(finishPreset.wood, 0.64);
    const cushion = createMaterial(finishPreset.cushion, 0.9, 0);
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
    ].forEach(([size, pos, mat]) => addBox(proceduralParts, size, pos, mat));
  };
  applyTableMaterials();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(48 * CFG.scale, 48 * CFG.scale), createMaterial(0x1d232a, 0.96, 0));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const gltf = createUniversalGLTFLoader(renderer);
  let disposed = false;
  let glbModel = null;
  setStatus('Loading official snooker table GLB…');
  gltf.loader.load(TABLE_MODEL_OPENSOURCE_GLB_URL, (asset) => {
    if (disposed) return;
    const model = asset?.scene || asset?.scenes?.[0];
    if (!model) {
      setStatus('GLB had no scene; using procedural fallback table.');
      return;
    }
    model.updateMatrixWorld(true);
    const sourceBox = new THREE.Box3().setFromObject(model);
    const sourceSize = sourceBox.getSize(new THREE.Vector3());
    if (sourceSize.x > sourceSize.z) model.rotation.y = Math.PI / 2;
    model.updateMatrixWorld(true);
    const rotatedBox = new THREE.Box3().setFromObject(model);
    const rotatedSize = rotatedBox.getSize(new THREE.Vector3());
    const targetSize = new THREE.Vector3(
      CFG.tableW * CFG.tableVisualMultiplier + CFG.railW * 2.4,
      CFG.topThickness + CFG.railH * 2.4,
      CFG.tableL * CFG.tableVisualMultiplier + CFG.railW * 2.4
    );
    const fit = resolveSnookerGlbFitTransform(rotatedSize, targetSize);
    const uniformPlanScale = Math.min(fit.scale.x, fit.scale.z);
    model.scale.set(uniformPlanScale, uniformPlanScale, uniformPlanScale);
    model.updateMatrixWorld(true);
    const scaledBox = new THREE.Box3().setFromObject(model);
    const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
    model.position.set(-scaledCenter.x, CFG.ballR - scaledBox.max.y + CFG.topThickness * 0.26, -scaledCenter.z);
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.frustumCulled = false;
        if (child.material) child.material.needsUpdate = true;
      }
    });
    tableGroup.add(model);
    glbModel = model;
    setStatus('Pooltool snooker_generic GLB fitted to the champion table footprint.');
  }, undefined, () => {
    if (!disposed) setStatus('GLB table failed to load; procedural fallback is active.');
  });

  return {
    tableGroup,
    applyTableMaterials,
    disposeTableLoader: () => {
      disposed = true;
      gltf.dispose();
      if (glbModel) tableGroup.remove(glbModel);
    }
  };
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
function applyCueShot(cueBall, power, yaw, tmp, spin = { x: 0, y: 0 }) {
  const forward = tmp.set(0, 0, -1).applyAxisAngle(Y_AXIS, yaw).normalize();
  const side = new THREE.Vector3(forward.z, 0, -forward.x).normalize();
  cueBall.vel.copy(forward)
    .addScaledVector(side, spin.x * 0.22)
    .normalize()
    .multiplyScalar((1.9 + 8.2 * Math.pow(power, 1.08)) * CFG.scale);
  cueBall.spin.set(spin.x, spin.y);
}
function resolveSnookerPockets() {
  const halfW = CFG.tableW / 2;
  const halfL = CFG.tableL / 2;
  return [
    new THREE.Vector3(-halfW, CFG.ballR, -halfL),
    new THREE.Vector3(halfW, CFG.ballR, -halfL),
    new THREE.Vector3(-halfW, CFG.ballR, halfL),
    new THREE.Vector3(halfW, CFG.ballR, halfL),
    new THREE.Vector3(-halfW, CFG.ballR, 0),
    new THREE.Vector3(halfW, CFG.ballR, 0)
  ];
}
function isAllStill(balls) {
  return balls.every((ball) => ball.potted || ball.vel.lengthSq() < CFG.minSpeed2 * 1.8);
}
function updateSnookerScore(ball, scoreRef, setScore) {
  if (ball.isCue) return;
  const remainingReds = scoreRef.current.remainingReds;
  const expected = scoreRef.current.nextTarget;
  const isLegalRed = expected === 'red' && ball.role === 'red';
  const isLegalColour = expected === 'colour' && ball.role !== 'red';
  const points = ball.value || 0;
  let nextScore;
  if (isLegalRed || isLegalColour) {
    nextScore = {
      ...scoreRef.current,
      player: scoreRef.current.player + points,
      remainingReds: ball.role === 'red' ? Math.max(0, remainingReds - 1) : remainingReds,
      nextTarget: ball.role === 'red' ? 'colour' : (remainingReds > 0 ? 'red' : 'colour-clearance'),
      message: `Potted ${ball.label}: +${points}`
    };
  } else if (expected === 'colour-clearance' && ball.role !== 'red') {
    nextScore = { ...scoreRef.current, player: scoreRef.current.player + points, message: `Clearance ${ball.label}: +${points}` };
  } else {
    nextScore = { ...scoreRef.current, opponent: scoreRef.current.opponent + 4, message: `Foul on ${ball.label || 'ball'}: opponent +4` };
  }
  scoreRef.current = nextScore;
  setScore(nextScore);
}
function updateBalls(balls, dt, tmpA, tmpB, scoreRef, setScore) {
  const halfW = CFG.tableW / 2, halfL = CFG.tableL / 2;
  const pockets = resolveSnookerPockets();
  for (const ball of balls) {
    if (ball.potted) continue;
    if (ball.spin.lengthSq() > 0.0001 && ball.vel.lengthSq() > CFG.minSpeed2) {
      const side = tmpA.set(ball.vel.z, 0, -ball.vel.x).normalize();
      ball.vel.addScaledVector(side, ball.spin.x * dt * 0.9 * CFG.scale);
      ball.vel.multiplyScalar(1 + ball.spin.y * dt * 0.08);
      ball.spin.multiplyScalar(Math.exp(-2.6 * dt));
    }
    ball.pos.addScaledVector(ball.vel, dt);
    ball.vel.multiplyScalar(Math.exp(-CFG.friction * dt));
    if (ball.vel.lengthSq() < CFG.minSpeed2) ball.vel.set(0, 0, 0);
    if (ball.pos.x < -halfW + CFG.ballR) { ball.pos.x = -halfW + CFG.ballR; ball.vel.x = Math.abs(ball.vel.x) * CFG.restitution; ball.spin.x *= -0.55; }
    else if (ball.pos.x > halfW - CFG.ballR) { ball.pos.x = halfW - CFG.ballR; ball.vel.x = -Math.abs(ball.vel.x) * CFG.restitution; ball.spin.x *= -0.55; }
    if (ball.pos.z < -halfL + CFG.ballR) { ball.pos.z = -halfL + CFG.ballR; ball.vel.z = Math.abs(ball.vel.z) * CFG.restitution; }
    else if (ball.pos.z > halfL - CFG.ballR) { ball.pos.z = halfL - CFG.ballR; ball.vel.z = -Math.abs(ball.vel.z) * CFG.restitution; }
  }
  for (let i = 0; i < balls.length; i += 1) for (let j = i + 1; j < balls.length; j += 1) {
    const a = balls[i], b = balls[j];
    if (a.potted || b.potted) continue;
    const delta = tmpA.copy(a.pos).sub(b.pos);
    const dist = delta.length();
    const minDist = CFG.ballR * 2;
    if (dist <= 0 || dist >= minDist) continue;
    const n = delta.normalize();
    const rel = tmpB.copy(a.vel).sub(b.vel);
    const sep = rel.dot(n);
    const overlap = minDist - dist;
    a.pos.addScaledVector(n, overlap * 0.5 + 0.0005 * CFG.scale);
    b.pos.addScaledVector(n, -overlap * 0.5 - 0.0005 * CFG.scale);
    if (sep <= 0) {
      const impulse = -(1 + CFG.restitution) * sep * 0.5;
      a.vel.addScaledVector(n, impulse);
      b.vel.addScaledVector(n, -impulse);
    }
  }
  for (const ball of balls) {
    if (ball.potted) continue;
    const potted = pockets.some((pocket) => ball.pos.distanceTo(pocket) < CFG.ballR * 1.55);
    if (!potted) {
      ball.mesh.position.copy(ball.pos);
      continue;
    }
    ball.vel.set(0, 0, 0);
    ball.spin.set(0, 0);
    if (ball.isCue) {
      ball.pos.set(0, CFG.ballR, CFG.tableL * 0.31);
      ball.mesh.position.copy(ball.pos);
      const nextScore = { ...scoreRef.current, opponent: scoreRef.current.opponent + 4, message: 'Cue ball in pocket: opponent +4, ball-in-hand reset.' };
      scoreRef.current = nextScore;
      setScore(nextScore);
    } else if (ball.role !== 'red' && scoreRef.current.remainingReds > 0) {
      updateSnookerScore(ball, scoreRef, setScore);
      ball.pos.copy(ball.spot || new THREE.Vector3(0, CFG.ballR, 0));
      ball.mesh.position.copy(ball.pos);
    } else {
      updateSnookerScore(ball, scoreRef, setScore);
      ball.potted = true;
      ball.mesh.visible = false;
      ball.pos.set(999, 999, 999);
    }
  }
}


export default function SnookerRoyalProvided({ gameTitle = 'Snooker Royal Provided' } = {}) {
  const hostRef = useRef(null);
  const canvasRef = useRef(null);
  const [power, setPower] = useState(0);
  const [shotState, setShotState] = useState('idle');
  const [tableStatus, setTableStatus] = useState('Preparing Snooker Champion table…');
  const [humanStatus, setHumanStatus] = useState('Preparing ReadyPlayer human…');
  const [menuOpen, setMenuOpen] = useState(false);
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [score, setScore] = useState({ player: 0, opponent: 0, remainingReds: 15, nextTarget: 'red', message: 'Break starts: pot a red first.' });
  const [spin, setSpin] = useState({ x: 0, y: 0 });
  const powerRef = useRef(0);
  const shotPowerRef = useRef(0);
  const shotStateRef = useRef('idle');
  const draggingSliderRef = useRef(false);
  const aimYawRef = useRef(0);
  const optionsRef = useRef(DEFAULT_OPTIONS);
  const scoreRef = useRef({ player: 0, opponent: 0, remainingReds: 15, nextTarget: 'red', message: 'Break starts: pot a red first.' });
  const spinRef = useRef({ x: 0, y: 0 });
  useEffect(() => { powerRef.current = power; }, [power]);
  useEffect(() => { shotStateRef.current = shotState; }, [shotState]);
  useEffect(() => { optionsRef.current = options; }, [options]);
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { spinRef.current = spin; }, [spin]);
  const animatePowerToZero = (from, ms = 220) => {
    const start = performance.now();
    const tick = () => {
      const t = clamp01((performance.now() - start) / ms);
      setPower(lerp(from, 0, easeOutCubic(t)));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const setSliderPower = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const p = clamp01((e.clientY - r.top) / r.height);
    setPower(p);
    shotPowerRef.current = p;
  };
  const onSliderDown = (e) => { e.currentTarget.setPointerCapture(e.pointerId); draggingSliderRef.current = true; setShotState('dragging'); setSliderPower(e); };
  const onSliderMove = (e) => { if (draggingSliderRef.current) setSliderPower(e); };
  const onSliderUp = (e) => { try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {} draggingSliderRef.current = false; setShotState(shotPowerRef.current > 0.02 ? 'striking' : 'idle'); animatePowerToZero(powerRef.current, 180); };
  const setOption = (group, value) => setOptions((current) => ({ ...current, [group]: value }));

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return undefined;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setClearColor(0x0b0b0b, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = findPreset('hdri', optionsRef.current.hdri).exposure;
    renderer.shadowMap.enabled = findPreset('graphics', optionsRef.current.graphics).shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    const cameraPreset = findPreset('camera', optionsRef.current.camera);
    const camera = new THREE.PerspectiveCamera(cameraPreset.fov, 1, 0.05 * CFG.scale, 80 * CFG.scale);
    camera.position.set(...cameraPreset.pos.map((v) => v * CFG.scale));
    camera.lookAt(...cameraPreset.target.map((v) => v * CFG.scale));
    scene.add(new THREE.AmbientLight(0xffffff, 0.86));
    scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 0.55));
    const sun = new THREE.DirectionalLight(0xffffff, 1.35);
    sun.position.set(3.5 * CFG.scale, 7 * CFG.scale, 5 * CFG.scale);
    sun.castShadow = true;
    scene.add(sun);
    const hdriPreset = findPreset('hdri', optionsRef.current.hdri);
    scene.background = new THREE.Color(hdriPreset.background);
    let environmentTexture = null;
    if (hdriPreset.url) {
      const envLoader = hdriPreset.url.endsWith('.exr') ? new EXRLoader() : new RGBELoader();
      envLoader.load(hdriPreset.url, (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        environmentTexture = texture;
        scene.environment = texture;
        scene.background = texture;
      }, undefined, () => {
        scene.background = new THREE.Color(hdriPreset.background);
      });
    }
    const { tableGroup, disposeTableLoader } = addTable(scene, renderer, setTableStatus, optionsRef);
    const { balls, cueBall } = addBalls(tableGroup);
    const cue = createCue();
    scene.add(cue.group);
    const human = addHuman(scene, renderer, setHumanStatus);
    const cueLine = createLine(0xffd166, 0.95);
    const aimLine = createLine(0xff6b4a, 0.85);
    scene.add(cueLine, aimLine);
    const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3();
    let strikeT = 0, didHit = false, frameId = 0, last = performance.now(), isAiming = false, lastAimX = 0;
    const resize = () => {
      const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
      renderer.setSize(w, h, false);
      renderer.setPixelRatio(Math.min(findPreset('graphics', optionsRef.current.graphics).pixelRatio, window.devicePixelRatio || 1));
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
      const dt = Math.min(0.033, (now - last) / 1000);
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
      if (state === 'dragging') gap += pull + practiceStroke;
      if (state === 'striking') gap = lerp(CFG.idleGap + pull, CFG.contactGap, easeOutCubic(strikeNorm));
      const cueTipShoot = cueBallWorld.clone().addScaledVector(aimForward, -(CFG.ballR + gap));
      const cueBackShoot = bridgeCuePoint.clone().addScaledVector(aimForward, -(CFG.cueLength - CFG.bridgeDist - CFG.ballR - gap)).add(new THREE.Vector3(0, 0.024 * CFG.scale, 0));
      const standingYaw = yawFromForward(aimForward);
      const idleRightHandTarget = humanRootTarget.clone().add(new THREE.Vector3(CFG.idleRightHandX, CFG.idleRightHandY, CFG.idleRightHandZ).applyAxisAngle(Y_AXIS, standingYaw));
      const idleLeftHandTarget = humanRootTarget.clone().add(new THREE.Vector3(-0.18 * CFG.scale, 1.08 * CFG.scale, 0.03 * CFG.scale).applyAxisAngle(Y_AXIS, standingYaw));
      const idleDir = CFG.idleCueDir.clone().applyAxisAngle(Y_AXIS, standingYaw).normalize();
      const idleCue = cuePoseFromGrip(idleRightHandTarget, idleDir, CFG.idleCueGripFromBack, CFG.cueLength);
      if (state === 'idle') { strikeT = 0; didHit = false; }
      else if (state === 'dragging') { strikeT = 0; didHit = false; }
      else if (state === 'striking') {
        strikeT += dt;
        if (!didHit && strikeNorm > 0.88) { didHit = true; applyCueShot(cueBall, shotPowerRef.current, aimYawRef.current, tmpC, spinRef.current); }
        if (strikeT >= CFG.strikeTime + CFG.holdTime) { strikeT = 0; didHit = false; setShotState('rolling'); }
      }
      const activeCueBack = state === 'idle' ? idleCue.back : cueBackShoot;
      const activeCueTip = state === 'idle' ? idleCue.tip : cueTipShoot;
      setCuePose(cue, activeCueBack, activeCueTip);
      updateBalls(balls, dt, tmpB, tmpC, scoreRef, setScore);
      if (state === 'idle' && !isAllStill(balls)) setShotState('rolling');
      if (state === 'rolling' && isAllStill(balls)) setShotState('idle');
      updateHumanPose(human, dt, state, humanRootTarget, aimForward, bridgeHandTarget, idleRightHandTarget, idleLeftHandTarget, activeCueBack, activeCueTip, activePower);
      setLinePoints(cueLine, activeCueBack, cueBallWorld);
      setLinePoints(aimLine, cueBallWorld, cueBallWorld.clone().add(aimForward.clone().multiplyScalar(2.1 * CFG.scale)));
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
      environmentTexture?.dispose?.();
      renderer.dispose();
    };
  }, [options.graphics, options.cloth, options.finish, options.hdri, options.camera]);

  const sliderH = 320;
  const sliderW = 58;
  const knob = 30;
  const knobTop = clamp(power * sliderH - knob / 2, -2, sliderH - knob + 2);
  const glass = { color: 'white', background: 'linear-gradient(135deg, rgba(8,14,28,0.78), rgba(12,24,40,0.56))', border: '1px solid rgba(255,255,255,0.16)', boxShadow: '0 16px 44px rgba(0,0,0,0.32)', backdropFilter: 'blur(14px)' };
  const renderOptionGroup = (group, title) => (
    <section style={{ display: 'grid', gap: 8 }}>
      <div style={{ fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.68)' }}>{title}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {MENU_PRESETS[group].map((item) => {
          const active = options[group] === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setOption(group, item.id)}
              style={{
                border: active ? '1px solid rgba(255,213,115,0.95)' : '1px solid rgba(255,255,255,0.14)',
                background: active ? 'linear-gradient(135deg, rgba(255,213,115,0.28), rgba(255,255,255,0.12))' : 'rgba(255,255,255,0.07)',
                color: '#fff',
                borderRadius: 999,
                padding: '7px 10px',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.04em'
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </section>
  );
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0b0b0b' }}>
      <div ref={hostRef} style={{ position: 'absolute', inset: 0 }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }} />
      </div>
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ position: 'absolute', left: 10, top: 10, padding: '10px 12px', borderRadius: 16, fontSize: 12, lineHeight: 1.35, maxWidth: '74vw', ...glass }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="button" onClick={() => setMenuOpen((open) => !open)} style={{ pointerEvents: 'auto', width: 36, height: 36, borderRadius: 12, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 20, lineHeight: 1 }}>☰</button>
            <div>
              <strong style={{ fontSize: 15, letterSpacing: '0.03em' }}>{gameTitle}</strong>
              <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 11 }}>Same Pool Royal-style broadcast controls · official snooker frame</div>
            </div>
          </div>
          <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            <div><b>{score.player}</b><br /><span style={{ color: 'rgba(255,255,255,0.62)' }}>You</span></div>
            <div><b>{score.remainingReds}</b><br /><span style={{ color: 'rgba(255,255,255,0.62)' }}>Reds</span></div>
            <div><b>{score.opponent}</b><br /><span style={{ color: 'rgba(255,255,255,0.62)' }}>Opponent</span></div>
          </div>
          <div style={{ marginTop: 7, color: 'rgba(255,255,255,0.82)' }}>{score.message}</div>
          <div style={{ marginTop: 5, color: 'rgba(255,255,255,0.62)' }}>{tableStatus}<br />{humanStatus}</div>
        </div>

        {menuOpen && (
          <div style={{ position: 'absolute', left: 10, top: 158, width: 'min(420px, calc(100vw - 20px))', maxHeight: 'calc(100vh - 176px)', overflow: 'auto', padding: 14, borderRadius: 18, pointerEvents: 'auto', ...glass }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: 12 }}>Game Options</div>
              <button type="button" onClick={() => setMenuOpen(false)} style={{ border: 0, borderRadius: 999, width: 30, height: 30, background: 'rgba(255,255,255,0.12)', color: '#fff' }}>×</button>
            </div>
            <div style={{ display: 'grid', gap: 14 }}>
              {renderOptionGroup('graphics', 'Graphics')}
              {renderOptionGroup('cloth', 'Textures / Cloth')}
              {renderOptionGroup('finish', 'Table Finish')}
              {renderOptionGroup('hdri', 'HDRI Lighting')}
              {renderOptionGroup('camera', 'Broadcast Cameras')}
            </div>
          </div>
        )}

        <div style={{ position: 'absolute', left: 12, bottom: 16, display: 'grid', gap: 8, width: 138, padding: 12, borderRadius: 18, pointerEvents: 'auto', ...glass }}>
          <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.68)' }}>Cue Spin</div>
          <div
            onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
            onPointerMove={(e) => {
              if (e.buttons !== 1) return;
              const r = e.currentTarget.getBoundingClientRect();
              setSpin({ x: clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1), y: clamp(1 - ((e.clientY - r.top) / r.height) * 2, -1, 1) });
            }}
            style={{ position: 'relative', height: 112, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #fff, #dfe7f2 55%, #9aa5b3)', border: '1px solid rgba(0,0,0,0.22)' }}
          >
            <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'rgba(0,0,0,0.18)' }} />
            <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'rgba(0,0,0,0.18)' }} />
            <div style={{ position: 'absolute', left: `${50 + spin.x * 43}%`, top: `${50 - spin.y * 43}%`, transform: 'translate(-50%, -50%)', width: 18, height: 18, borderRadius: 999, background: '#ef4444', border: '2px solid white', boxShadow: '0 4px 12px rgba(0,0,0,0.32)' }} />
          </div>
          <button type="button" onClick={() => setSpin({ x: 0, y: 0 })} style={{ border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: '#fff', borderRadius: 999, padding: '7px 10px', fontSize: 11, fontWeight: 800 }}>Reset Spin</button>
        </div>

        <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, pointerEvents: 'auto', touchAction: 'none', userSelect: 'none' }}>
          <div onPointerDown={onSliderDown} onPointerMove={onSliderMove} onPointerUp={onSliderUp} style={{ position: 'relative', height: sliderH, width: sliderW, borderRadius: 18, background: 'rgba(255,255,255,0.92)', boxShadow: '0 12px 28px rgba(0,0,0,0.2)', padding: 9 }}>
            <div style={{ position: 'absolute', left: 14, right: 14, top: 14, bottom: 14, borderRadius: 999, background: 'rgba(0,0,0,0.12)', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: `${power * 100}%`, background: 'rgba(17,17,17,0.58)' }} />
            </div>
            <div style={{ position: 'absolute', left: (sliderW - knob) / 2, top: 14 + knobTop, width: knob, height: knob, borderRadius: 999, background: 'rgba(255,255,255,0.98)', border: '1px solid rgba(0,0,0,0.18)', boxShadow: '0 10px 18px rgba(0,0,0,0.18)' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
