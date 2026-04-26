"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { BilardoShqipRules } from "../../../../src/rules/BilardoShqipRules.ts";

type ShotState = "idle" | "dragging" | "striking";
type BallState = { mesh: THREE.Mesh; pos: THREE.Vector3; vel: THREE.Vector3; number: number; isCue: boolean };
type CueRig = { group: THREE.Group; shaft: THREE.Mesh; ferrule: THREE.Mesh; tip: THREE.Mesh };
type BoneKey =
  | "hips" | "spine" | "chest" | "neck" | "head"
  | "leftUpperArm" | "leftLowerArm" | "leftHand"
  | "rightUpperArm" | "rightLowerArm" | "rightHand"
  | "leftUpperLeg" | "leftLowerLeg" | "leftFoot"
  | "rightUpperLeg" | "rightLowerLeg" | "rightFoot";
type AvatarBones = Partial<Record<BoneKey, THREE.Bone>>;
type HumanRig = {
  root: THREE.Group;
  modelRoot: THREE.Group;
  model: THREE.Object3D | null;
  fallback: THREE.Group;
  bones: AvatarBones;
  leftFingers: THREE.Bone[];
  rightFingers: THREE.Bone[];
  restQuats: Map<THREE.Bone, THREE.Quaternion>;
  loaded: boolean;
  activeGlb: boolean;
  poseT: number;
  walkT: number;
  yaw: number;
  breathT: number;
  settleT: number;
  strikeRoot: THREE.Vector3;
  strikeYaw: number;
  strikeClock: number;
};
type HumanFrame = {
  t: number;
  breath: number;
  stroke: number;
  follow: number;
  walkAmount: number;
  forward: THREE.Vector3;
  side: THREE.Vector3;
  up: THREE.Vector3;
  rootWorld: THREE.Vector3;
  torsoCenterWorld: THREE.Vector3;
  chestCenterWorld: THREE.Vector3;
  neckWorld: THREE.Vector3;
  headCenterWorld: THREE.Vector3;
  leftElbow: THREE.Vector3;
  rightElbow: THREE.Vector3;
  leftHandWorld: THREE.Vector3;
  rightHandWorld: THREE.Vector3;
  leftKnee: THREE.Vector3;
  rightKnee: THREE.Vector3;
  leftFootWorld: THREE.Vector3;
  rightFootWorld: THREE.Vector3;
  cueBackWorld: THREE.Vector3;
  cueTipWorld: THREE.Vector3;
};
type ShotPlan = { yaw: number; power: number; target: BallState | null; pocket: THREE.Vector3 | null };

const HUMAN_URL = "https://threejs.org/examples/models/gltf/readyplayer.me.glb";
const CFG = {
  tableTopY: 0.84,
  tableW: 2.0,
  tableL: 3.6,
  topThickness: 0.09,
  railW: 0.15,
  railH: 0.08,
  railInset: 0.03,
  cushionT: 0.18,
  cushionH: 0.1,
  legW: 0.16,
  legD: 0.16,
  legInset: 0.14,
  ballR: 0.055,
  friction: 1.34,
  restitution: 0.94,
  minSpeed2: 0.0007,
  idleGap: 0.012,
  contactGap: 0.0012,
  pullRange: 0.42,
  strikeTime: 0.12,
  holdTime: 0.05,
  cueLength: 1.46,
  bridgeDist: 0.24,
  gripRatio: 0.76,
  edgeMargin: 0.58,
  desiredShootDistance: 1.06,
  poseLambda: 9,
  moveLambda: 5.6,
  rotLambda: 8.5,
  humanScale: 1.18,
  humanVisualYawFix: Math.PI,
  stanceWidth: 0.52,
  bridgePalmTableLift: 0.012,
  bridgeCueLift: 0.026,
  bridgeHandBackFromBall: 0.245,
  bridgeHandSide: -0.008,
  gripHandBackOnCue: 0.78,
  chinToCueHeight: 0.11,
  cueArmElbowRise: 0.43,
};
const BALL_COLORS = [0xf7f7f7, 0xffc52c, 0x0a58ff, 0xd32232, 0x8f32d6, 0xff7c1f, 0x0faa60, 0x651f28, 0x111111, 0xffc52c, 0x0a58ff, 0xd32232, 0x8f32d6, 0xff7c1f, 0x0faa60, 0x651f28];
const BALL_PATTERNS: ("cue" | "solid" | "stripe")[] = [
  "cue",
  "solid",
  "solid",
  "solid",
  "solid",
  "solid",
  "solid",
  "solid",
  "solid",
  "stripe",
  "stripe",
  "stripe",
  "stripe",
  "stripe",
  "stripe",
  "stripe",
];
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const UP = Y_AXIS;
const BASIS_MAT = new THREE.Matrix4();
const RACE_TO_POINTS = 61;
const CUE_BALL_RESPOT = new THREE.Vector3(0, CFG.ballR, 1.02);
const POCKET_CAPTURE_RADIUS = CFG.ballR * 1.52;
const stillMoving = (balls: BallState[]) => balls.some((ball) => ball.vel.lengthSq() > CFG.minSpeed2);


const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const clamp01 = (v: number) => clamp(v, 0, 1);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => t * t * (3 - 2 * t);
const dampScalar = (current: number, target: number, lambda: number, dt: number) => THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));
const dampVector = (current: THREE.Vector3, target: THREE.Vector3, lambda: number, dt: number) => current.lerp(target, 1 - Math.exp(-lambda * dt));
const yawFromForward = (forward: THREE.Vector3) => Math.atan2(-forward.x, -forward.z);
const planar = (v: THREE.Vector3) => new THREE.Vector3(v.x, 0, v.z);
const cleanName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

function makeBasisQuaternion(side: THREE.Vector3, up: THREE.Vector3, forward: THREE.Vector3) {
  BASIS_MAT.makeBasis(side.clone().normalize(), up.clone().normalize(), forward.clone().normalize());
  return new THREE.Quaternion().setFromRotationMatrix(BASIS_MAT);
}
function material(color: number, roughness = 0.72, metalness = 0.03) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}
function createBilardoBallTexture(color: number, pattern: "cue" | "solid" | "stripe", number: number | null) {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const colorHex = `#${new THREE.Color(color).getHexString()}`;
  ctx.fillStyle = pattern === "stripe" ? "#ffffff" : colorHex;
  ctx.fillRect(0, 0, size, size);

  if (pattern === "stripe") {
    const stripeHeight = size * 0.45;
    const stripeY = (size - stripeHeight) / 2;
    ctx.fillStyle = colorHex;
    ctx.fillRect(0, stripeY, size, stripeHeight);
  }

  if (pattern === "cue") {
    const dotRadius = size * 0.08;
    const dots = [
      [size * 0.5, size * 0.5],
      [size * 0.23, size * 0.5],
      [size * 0.77, size * 0.5],
      [size * 0.5, size * 0.23],
      [size * 0.5, size * 0.77],
    ] as const;
    ctx.fillStyle = "#d33131";
    dots.forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  if (number != null) {
    const badgeR = size * 0.09;
    const cx = size * 0.5;
    const cy = size * 0.5;
    ctx.beginPath();
    ctx.ellipse(cx, cy, badgeR, badgeR * 1.8, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = size * 0.013;
    ctx.strokeStyle = "#000";
    ctx.stroke();
    ctx.fillStyle = "#000";
    ctx.font = `900 ${number > 9 ? size * 0.12 : size * 0.14}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(number), cx, cy);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}
function billiardBallMaterial(color: number, pattern: "cue" | "solid" | "stripe", number: number | null) {
  const map = createBilardoBallTexture(color, pattern, number);
  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.18,
    metalness: 0.03,
    map: map ?? undefined,
  });
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
function createUnitCylinder(color: number) {
  return new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 16), material(color, 0.72, 0.04));
}
function setSegment(mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3, radius: number) {
  const dir = b.clone().sub(a);
  const len = Math.max(0.0001, dir.length());
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
  mesh.scale.set(radius, len, radius);
}
function createLine(color: number, opacity = 0.9) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
  return new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
}
function setLinePoints(line: THREE.Line, a: THREE.Vector3, b: THREE.Vector3) {
  const pos = line.geometry.getAttribute("position") as THREE.BufferAttribute;
  pos.setXYZ(0, a.x, a.y, a.z);
  pos.setXYZ(1, b.x, b.y, b.z);
  pos.needsUpdate = true;
  line.geometry.computeBoundingSphere();
}
function setCuePose(cue: CueRig, back: THREE.Vector3, tip: THREE.Vector3) {
  const dir = tip.clone().sub(back).normalize();
  const tipBack = tip.clone().addScaledVector(dir, -0.02);
  const ferruleBack = tipBack.clone().addScaledVector(dir, -0.03);
  setSegment(cue.shaft, back, ferruleBack, 0.012);
  setSegment(cue.ferrule, ferruleBack, tipBack, 0.0105);
  setSegment(cue.tip, tipBack, tip, 0.009);
}

function createBall(number: number, color: number, pattern: "cue" | "solid" | "stripe", isCue = false): BallState {
  const labelNumber = isCue ? null : number;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(CFG.ballR, 36, 36), billiardBallMaterial(color, pattern, labelNumber));
  enableShadow(mesh);
  return { mesh, pos: new THREE.Vector3(), vel: new THREE.Vector3(), number, isCue };
}
function rackPositions(origin: THREE.Vector3) {
  const out: THREE.Vector3[] = [];
  const rowSpacing = CFG.ballR * 2 * 0.92;
  const colSpacing = CFG.ballR * 2.06;
  for (let row = 0; row < 5; row++) {
    for (let i = 0; i <= row; i++) out.push(new THREE.Vector3(origin.x + (i - row / 2) * colSpacing, CFG.ballR, origin.z - row * rowSpacing));
  }
  return out;
}
function getPocketPositions() {
  const hw = CFG.tableW / 2 - 0.02;
  const hl = CFG.tableL / 2 - 0.02;
  return [new THREE.Vector3(-hw, 0, -hl), new THREE.Vector3(hw, 0, -hl), new THREE.Vector3(-hw, 0, hl), new THREE.Vector3(hw, 0, hl), new THREE.Vector3(-hw, 0, 0), new THREE.Vector3(hw, 0, 0)];
}

function addBox(group: THREE.Group, size: [number, number, number], pos: [number, number, number], mat: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
  mesh.position.set(...pos);
  enableShadow(mesh);
  group.add(mesh);
  return mesh;
}
function addTable(scene: THREE.Scene) {
  const tableGroup = new THREE.Group();
  tableGroup.position.y = CFG.tableTopY;
  scene.add(tableGroup);

  addBox(tableGroup, [CFG.tableW + 0.1, CFG.topThickness, CFG.tableL + 0.1], [0, -CFG.topThickness / 2, 0], material(0x105f3c, 0.92, 0));

  const wood = material(0x4a2c1a, 0.46);
  const cushion = material(0x124a2e, 0.86, 0);
  const railY = CFG.railH / 2 - CFG.topThickness;
  const cushionY = 0.06 + CFG.cushionH / 2;
  [
    [[CFG.railW, CFG.railH, CFG.tableL + 0.34], [-(CFG.tableW / 2 + CFG.railW / 2 - CFG.railInset), railY, 0], wood],
    [[CFG.railW, CFG.railH, CFG.tableL + 0.34], [CFG.tableW / 2 + CFG.railW / 2 - CFG.railInset, railY, 0], wood],
    [[CFG.tableW + 0.34, CFG.railH, CFG.railW], [0, railY, -(CFG.tableL / 2 + CFG.railW / 2 - CFG.railInset)], wood],
    [[CFG.tableW + 0.34, CFG.railH, CFG.railW], [0, railY, CFG.tableL / 2 + CFG.railW / 2 - CFG.railInset], wood],
    [[CFG.cushionT, CFG.cushionH, CFG.tableL + 0.38], [-(CFG.tableW / 2 + CFG.cushionT / 2 - 0.01), cushionY, 0], cushion],
    [[CFG.cushionT, CFG.cushionH, CFG.tableL + 0.38], [CFG.tableW / 2 + CFG.cushionT / 2 - 0.01, cushionY, 0], cushion],
    [[CFG.tableW + 0.18, CFG.cushionH, CFG.cushionT], [0, cushionY, -(CFG.tableL / 2 + CFG.cushionT / 2 - 0.01)], cushion],
    [[CFG.tableW + 0.18, CFG.cushionH, CFG.cushionT], [0, cushionY, CFG.tableL / 2 + CFG.cushionT / 2 - 0.01], cushion],
  ].forEach(([size, pos, matArg]) => addBox(tableGroup, size as [number, number, number], pos as [number, number, number], matArg as THREE.Material));

  const pocketMat = material(0x050505, 0.6, 0);
  getPocketPositions().forEach((p) => {
    const pocket = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.012, 28), pocketMat);
    pocket.rotation.x = Math.PI / 2;
    pocket.position.set(p.x, 0.016, p.z);
    tableGroup.add(pocket);
  });

  const legHeight = CFG.tableTopY - 0.03;
  const legMat = material(0x392114, 0.75, 0.01);
  [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => addBox(tableGroup, [CFG.legW, legHeight, CFG.legD], [sx * (CFG.tableW / 2 - CFG.legInset), -legHeight / 2, sz * (CFG.tableL / 2 - CFG.legInset)], legMat)));

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), material(0x1d232a, 0.96, 0));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  return { tableGroup };
}
function addBalls(tableGroup: THREE.Group) {
  const balls: BallState[] = [];
  const cueBall = createBall(0, BALL_COLORS[0], BALL_PATTERNS[0], true);
  cueBall.pos.set(0, CFG.ballR, 1.02);
  balls.push(cueBall);
  rackPositions(new THREE.Vector3(0, CFG.ballR, -0.78)).forEach((p, i) => {
    const b = createBall(i + 1, BALL_COLORS[i + 1], BALL_PATTERNS[i + 1]);
    b.pos.copy(p);
    balls.push(b);
  });
  balls.forEach((b) => {
    b.mesh.position.copy(b.pos);
    tableGroup.add(b.mesh);
  });
  return { balls, cueBall };
}
function addCue(scene: THREE.Scene): CueRig {
  const group = new THREE.Group();
  const cue = { group, shaft: createUnitCylinder(0xd9b88d), ferrule: createUnitCylinder(0xf2f2f2), tip: createUnitCylinder(0x3476d6) };
  [cue.shaft, cue.ferrule, cue.tip].forEach((m) => group.add(enableShadow(m)));
  scene.add(group);
  return cue;
}

function createFallbackHuman() {
  const group = new THREE.Group();
  const gray = material(0x6b7280, 0.7, 0.05);
  const skin = material(0xf0c9a5, 0.8, 0);
  const boxes: Array<[number, number, number, number, number, number, THREE.Material]> = [
    [0, 1.18, 0, 0.42, 0.72, 0.22, gray],
    [-0.09, 0.45, 0, 0.14, 0.9, 0.14, gray],
    [0.09, 0.45, 0, 0.14, 0.9, 0.14, gray],
    [-0.31, 1.18, 0, 0.12, 0.72, 0.12, gray],
    [0.31, 1.18, 0, 0.12, 0.72, 0.12, gray],
  ];
  boxes.forEach(([x, y, z, w, h, d, m]) => addBox(group, [w, h, d], [x, y, z], m));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 20, 20), skin);
  head.position.set(0, 1.7, 0);
  group.add(enableShadow(head));
  return group;
}
function findBone(all: THREE.Bone[], aliases: string[]) {
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
function buildAvatarBones(model: THREE.Object3D): AvatarBones {
  const all: THREE.Bone[] = [];
  model.traverse((obj) => {
    const bone = obj as THREE.Bone;
    if (bone.isBone) all.push(bone);
  });
  const f = (...names: string[]) => findBone(all, names);
  return {
    hips: f("hips", "pelvis", "mixamorigHips"), spine: f("spine", "spine01", "mixamorigSpine"), chest: f("spine2", "chest", "upperchest", "mixamorigSpine2", "mixamorigSpine1"), neck: f("neck", "mixamorigNeck"), head: f("head", "mixamorigHead"),
    leftUpperArm: f("leftupperarm", "leftarm", "upperarml", "mixamorigLeftArm"), leftLowerArm: f("leftforearm", "leftlowerarm", "forearml", "mixamorigLeftForeArm"), leftHand: f("lefthand", "handl", "mixamorigLeftHand"),
    rightUpperArm: f("rightupperarm", "rightarm", "upperarmr", "mixamorigRightArm"), rightLowerArm: f("rightforearm", "rightlowerarm", "forearmr", "mixamorigRightForeArm"), rightHand: f("righthand", "handr", "mixamorigRightHand"),
    leftUpperLeg: f("leftupleg", "leftupperleg", "leftthigh", "mixamorigLeftUpLeg"), leftLowerLeg: f("leftleg", "leftlowerleg", "leftcalf", "mixamorigLeftLeg"), leftFoot: f("leftfoot", "footl", "mixamorigLeftFoot"),
    rightUpperLeg: f("rightupleg", "rightupperleg", "rightthigh", "mixamorigRightUpLeg"), rightLowerLeg: f("rightleg", "rightlowerleg", "rightcalf", "mixamorigRightLeg"), rightFoot: f("rightfoot", "footr", "mixamorigRightFoot"),
  };
}
function collectFingerBones(hand?: THREE.Bone) {
  const out: THREE.Bone[] = [];
  hand?.traverse((obj) => {
    const bone = obj as THREE.Bone;
    if (!bone.isBone || bone === hand) return;
    const n = cleanName(bone.name);
    if (["thumb", "index", "middle", "ring", "pinky", "little", "finger"].some((s) => n.includes(s))) out.push(bone);
  });
  return out;
}
function normalizeHuman(model: THREE.Object3D) {
  model.scale.setScalar(CFG.humanScale);
  model.rotation.set(0, CFG.humanVisualYawFix, 0);
  model.position.set(0, 0, 0);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -box.min.y, -center.z);
}
function addHuman(scene: THREE.Scene): HumanRig {
  const human: HumanRig = { root: new THREE.Group(), modelRoot: new THREE.Group(), model: null, fallback: createFallbackHuman(), bones: {}, leftFingers: [], rightFingers: [], restQuats: new Map(), loaded: false, activeGlb: false, poseT: 0, walkT: 0, yaw: 0, breathT: 0, settleT: 0, strikeRoot: new THREE.Vector3(), strikeYaw: 0, strikeClock: 0 };
  human.root.visible = false;
  human.modelRoot.visible = false;
  scene.add(human.root, human.modelRoot, human.fallback);

  new GLTFLoader().setCrossOrigin("anonymous").load(
    HUMAN_URL,
    (gltf) => {
      const model = gltf.scene;
      normalizeHuman(model);
      model.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
        materials.forEach((m: any) => {
          if (m.map) {
            m.map.colorSpace = THREE.SRGBColorSpace;
            m.map.needsUpdate = true;
          }
          m.needsUpdate = true;
        });
      });
      human.bones = buildAvatarBones(model);
      human.leftFingers = collectFingerBones(human.bones.leftHand);
      human.rightFingers = collectFingerBones(human.bones.rightHand);
      [...Object.values(human.bones), ...human.leftFingers, ...human.rightFingers].forEach((bone) => bone && human.restQuats.set(bone, bone.quaternion.clone()));
      human.activeGlb = Boolean(human.bones.hips && human.bones.spine && human.bones.head && human.bones.leftUpperArm && human.bones.leftLowerArm && human.bones.leftHand && human.bones.rightUpperArm && human.bones.rightLowerArm && human.bones.rightHand && human.bones.leftUpperLeg && human.bones.leftLowerLeg && human.bones.rightUpperLeg && human.bones.rightLowerLeg);
      human.model = model;
      human.modelRoot.add(model);
      human.modelRoot.visible = human.activeGlb;
      human.fallback.visible = !human.activeGlb;
      human.loaded = true;
    },
    undefined,
    () => {
      human.loaded = true;
      human.activeGlb = false;
      human.modelRoot.visible = false;
      human.fallback.visible = true;
    }
  );
  return human;
}

function setBoneWorldQuaternion(bone?: THREE.Bone, q?: THREE.Quaternion) {
  if (!bone || !q) return;
  const parentQ = new THREE.Quaternion();
  bone.parent?.getWorldQuaternion(parentQ);
  bone.quaternion.copy(parentQ.invert().multiply(q));
  bone.updateMatrixWorld(true);
}
function firstBoneChild(bone?: THREE.Bone) {
  return bone?.children.find((child) => (child as THREE.Bone).isBone) as THREE.Bone | undefined;
}
function rotateBoneToward(bone: THREE.Bone | undefined, target: THREE.Vector3, strength = 1, fallbackDir = UP) {
  if (!bone || strength <= 0) return;
  const bonePos = bone.getWorldPosition(new THREE.Vector3());
  const childPos = firstBoneChild(bone)?.getWorldPosition(new THREE.Vector3()) || bonePos.clone().addScaledVector(fallbackDir.clone().normalize(), 0.25);
  const current = childPos.sub(bonePos).normalize();
  const desired = target.clone().sub(bonePos);
  if (desired.lengthSq() < 1e-6 || current.lengthSq() < 1e-6) return;
  const delta = new THREE.Quaternion().slerpQuaternions(new THREE.Quaternion(), new THREE.Quaternion().setFromUnitVectors(current, desired.normalize()), clamp01(strength));
  setBoneWorldQuaternion(bone, delta.multiply(bone.getWorldQuaternion(new THREE.Quaternion())));
}
function twistBone(bone: THREE.Bone | undefined, axis: THREE.Vector3, amount: number) {
  if (!bone || Math.abs(amount) < 1e-5) return;
  setBoneWorldQuaternion(bone, new THREE.Quaternion().setFromAxisAngle(axis.clone().normalize(), amount).multiply(bone.getWorldQuaternion(new THREE.Quaternion())));
}
function aimTwoBone(upper: THREE.Bone | undefined, lower: THREE.Bone | undefined, elbow: THREE.Vector3, hand: THREE.Vector3, pole: THREE.Vector3, upperStrength = 0.96, lowerStrength = 0.98) {
  for (let i = 0; i < 2; i++) {
    rotateBoneToward(upper, elbow, upperStrength, pole);
    rotateBoneToward(lower, hand, lowerStrength, pole);
    twistBone(upper, pole, 0.025 * upperStrength);
  }
}
function setHandBasis(bone: THREE.Bone | undefined, side: THREE.Vector3, up: THREE.Vector3, forward: THREE.Vector3, roll = 0, strength = 1) {
  if (!bone || strength <= 0) return;
  const q = makeBasisQuaternion(side, up, forward);
  if (Math.abs(roll) > 1e-4) q.multiply(new THREE.Quaternion().setFromAxisAngle(forward.clone().normalize(), roll));
  setBoneWorldQuaternion(bone, bone.getWorldQuaternion(new THREE.Quaternion()).slerp(q, clamp01(strength)));
}
function poseFingers(fingers: THREE.Bone[], mode: "idle" | "bridge" | "grip", weight: number) {
  const w = clamp01(weight);
  fingers.forEach((finger, i) => {
    const n = cleanName(finger.name);
    const thumb = n.includes("thumb"), index = n.includes("index"), middle = n.includes("middle"), ring = n.includes("ring"), pinky = n.includes("pinky") || n.includes("little");
    const base = !(n.includes("2") || n.includes("3") || n.includes("intermediate") || n.includes("distal"));
    const tip = n.includes("3") || n.includes("distal");
    if (mode === "idle") {
      finger.rotation.x += 0.02 * w;
      finger.rotation.z += 0.01 * w * (i % 2 ? -1 : 1);
      return;
    }
    if (mode === "grip") {
      if (thumb) {
        finger.rotation.x += 0.22 * w;
        finger.rotation.y += -0.42 * w;
        finger.rotation.z += 0.22 * w;
        return;
      }
      const curl = index ? (base ? 0.42 : tip ? 0.48 : 0.62) : middle ? (base ? 0.54 : tip ? 0.58 : 0.78) : ring ? (base ? 0.48 : tip ? 0.52 : 0.68) : pinky ? (base ? 0.42 : tip ? 0.46 : 0.6) : 0;
      finger.rotation.x += curl * w;
      finger.rotation.z += (index ? -0.03 : ring ? 0.04 : pinky ? 0.07 : 0) * w;
      return;
    }
    if (thumb) {
      finger.rotation.x += -0.04 * w;
      finger.rotation.y += 0.62 * w;
      finger.rotation.z += -0.58 * w;
    } else if (index) {
      finger.rotation.x += (base ? 0.12 : tip ? 0.22 : 0.28) * w;
      finger.rotation.y += -0.26 * w;
      finger.rotation.z += -0.2 * w;
    } else if (middle) {
      finger.rotation.x += (base ? 0.1 : tip ? 0.18 : 0.22) * w;
      finger.rotation.y += -0.04 * w;
      finger.rotation.z += -0.04 * w;
    } else if (ring || pinky) {
      finger.rotation.x += (base ? (ring ? 0.03 : 0.02) : tip ? (ring ? 0.1 : 0.08) : ring ? 0.12 : 0.1) * w;
      finger.rotation.y += (ring ? 0.08 : 0.16) * w;
      finger.rotation.z += (ring ? 0.16 : 0.28) * w;
    }
  });
}

function driveHuman(human: HumanRig, frame: HumanFrame) {
  if (!human.activeGlb || !human.model) {
    human.fallback.visible = true;
    human.fallback.position.copy(frame.rootWorld);
    human.fallback.rotation.y = human.yaw;
    human.fallback.rotation.x = -0.16 * frame.t;
    human.fallback.position.y -= 0.035 * frame.t;
    return;
  }

  human.fallback.visible = false;
  human.modelRoot.visible = true;
  human.modelRoot.position.copy(frame.rootWorld);
  human.modelRoot.rotation.y = human.yaw;
  human.modelRoot.position.y += 0.006 * frame.breath - 0.018 * frame.t;
  human.modelRoot.updateMatrixWorld(true);
  human.restQuats.forEach((q, bone) => bone.quaternion.copy(q));
  human.modelRoot.updateMatrixWorld(true);

  const b = human.bones;
  const ik = easeInOut(clamp01(frame.t));
  const idle = 1 - ik;
  const cueDir = frame.cueTipWorld.clone().sub(frame.cueBackWorld).normalize();
  const shotQ = makeBasisQuaternion(frame.side, UP, frame.forward);

  if (frame.walkAmount * idle > 0.001) {
    const s = Math.sin(human.walkT * 6.2), c = Math.cos(human.walkT * 6.2), w = frame.walkAmount * idle;
    if (b.leftUpperLeg) b.leftUpperLeg.rotation.x += s * 0.34 * w;
    if (b.rightUpperLeg) b.rightUpperLeg.rotation.x -= s * 0.34 * w;
    if (b.leftLowerLeg) b.leftLowerLeg.rotation.x += Math.max(0, -s) * 0.28 * w;
    if (b.rightLowerLeg) b.rightLowerLeg.rotation.x += Math.max(0, s) * 0.28 * w;
    if (b.leftUpperArm) b.leftUpperArm.rotation.x -= s * 0.23 * w;
    if (b.rightUpperArm) b.rightUpperArm.rotation.x += s * 0.23 * w;
    if (b.spine) b.spine.rotation.z += c * 0.025 * w;
    if (b.hips) b.hips.rotation.z -= c * 0.018 * w;
  }

  const rightGrip = frame.rightHandWorld.clone().addScaledVector(cueDir, -0.028 * (0.25 + 0.75 * ik)).addScaledVector(UP, 0.006 * ik);
  const rightIdleElbow = rightGrip.clone().addScaledVector(UP, 0.24 + 0.19 * ik).addScaledVector(frame.side, 0.09).addScaledVector(frame.forward, -0.03 * idle);
  const rightElbow = frame.rightElbow.clone().lerp(rightIdleElbow, idle * 0.68);
  const rightHold = 0.56 + 0.4 * ik;
  aimTwoBone(b.rightUpperArm, b.rightLowerArm, rightElbow, rightGrip, frame.side.clone().addScaledVector(UP, 0.22).normalize(), rightHold, rightHold);
  setHandBasis(b.rightHand, frame.side.clone().addScaledVector(UP, -0.08).normalize(), UP.clone().multiplyScalar(0.76).addScaledVector(frame.side, 0.18).addScaledVector(frame.forward, -0.1).normalize(), cueDir, 0.08 * idle + 0.2 * ik + 0.03 * frame.stroke, 0.78 + 0.18 * ik);
  poseFingers(human.rightFingers, "grip", 0.58 + 0.28 * ik);

  if (ik < 0.025) {
    poseFingers(human.leftFingers, "idle", 1);
    return;
  }

  rotateBoneToward(b.hips, frame.torsoCenterWorld, (0.16 + 0.44 * ik) * ik, frame.forward); twistBone(b.hips, frame.side, -0.075 * ik); twistBone(b.hips, frame.forward, -0.04 * ik);
  rotateBoneToward(b.spine, frame.chestCenterWorld, (0.38 + 0.36 * ik) * ik, frame.forward); twistBone(b.spine, frame.side, -0.23 * ik); twistBone(b.spine, frame.forward, -0.055 * ik);
  rotateBoneToward(b.chest, frame.neckWorld, (0.52 + 0.3 * ik) * ik, frame.forward); twistBone(b.chest, frame.side, -0.35 * ik); twistBone(b.chest, frame.forward, -0.035 * ik);
  rotateBoneToward(b.neck, frame.headCenterWorld, 0.66 * ik, frame.forward); twistBone(b.neck, frame.side, -0.13 * ik);
  setBoneWorldQuaternion(b.head, b.head ? b.head.getWorldQuaternion(new THREE.Quaternion()).slerp(shotQ.clone().multiply(new THREE.Quaternion().setFromAxisAngle(frame.side, -0.12 * ik)).multiply(new THREE.Quaternion().setFromAxisAngle(frame.forward, -0.025 * ik)), 0.74 * ik) : shotQ);

  const leftHand = frame.leftHandWorld.clone().addScaledVector(frame.forward, 0.012 * ik).addScaledVector(frame.side, -0.006 * ik).addScaledVector(UP, -0.01 * ik);
  const leftElbow = frame.leftElbow.clone().addScaledVector(frame.forward, 0.02 * ik).addScaledVector(frame.side, -0.03 * ik).addScaledVector(UP, -0.005 * ik);
  aimTwoBone(b.leftUpperArm, b.leftLowerArm, leftElbow, leftHand, frame.side.clone().multiplyScalar(-1).addScaledVector(UP, 0.14).normalize(), 0.95 * ik, 0.99 * ik);
  twistBone(b.leftUpperArm, frame.forward, -0.16 * ik);
  twistBone(b.leftLowerArm, frame.forward, 0.05 * ik);
  setHandBasis(b.leftHand, frame.side.clone().multiplyScalar(-1).addScaledVector(frame.forward, -0.2).normalize(), UP.clone().multiplyScalar(0.96).addScaledVector(frame.forward, -0.08).addScaledVector(frame.side, -0.04).normalize(), cueDir, -0.22 * ik, 0.98 * ik);
  poseFingers(human.leftFingers, "bridge", ik);

  aimTwoBone(b.leftUpperLeg, b.leftLowerLeg, frame.leftKnee, frame.leftFootWorld, frame.forward.clone().addScaledVector(UP, 0.12).normalize(), 0.68 * ik, 0.84 * ik);
  twistBone(b.leftUpperLeg, frame.forward, -0.07 * ik);
  setHandBasis(b.leftFoot, frame.side, frame.up, frame.forward, -0.1 * ik, 0.68 * ik);
  aimTwoBone(b.rightUpperLeg, b.rightLowerLeg, frame.rightKnee, frame.rightFootWorld, frame.forward.clone().multiplyScalar(-1).addScaledVector(UP, 0.1).normalize(), 0.68 * ik, 0.84 * ik);
  twistBone(b.rightUpperLeg, frame.forward, 0.06 * ik);
  setHandBasis(b.rightFoot, frame.side, frame.up, frame.forward, 0.07 * ik, 0.68 * ik);
}
function updateHumanPose(human: HumanRig, dt: number, state: ShotState, rootTarget: THREE.Vector3, aimForward: THREE.Vector3, bridgeTarget: THREE.Vector3, gripTarget: THREE.Vector3, idleRight: THREE.Vector3, idleLeft: THREE.Vector3, cueBack: THREE.Vector3, cueTip: THREE.Vector3, power: number) {
  human.poseT = dampScalar(human.poseT, state === "idle" ? 0 : 1, CFG.poseLambda, dt);
  human.breathT += dt * (state === "idle" ? 1.05 : 0.5);
  human.settleT = dampScalar(human.settleT, state === "dragging" ? 1 : 0, 5.5, dt);

  if (state === "striking") {
    if (human.strikeClock === 0) {
      human.strikeRoot.copy(human.root.position.lengthSq() > 0.001 ? human.root.position : rootTarget);
      human.strikeYaw = human.yaw;
    }
    human.strikeClock += dt;
  } else human.strikeClock = 0;

  const rootGoal = state === "striking" ? human.strikeRoot : rootTarget;
  dampVector(human.root.position, rootGoal, state === "striking" ? 12 : CFG.moveLambda, dt);
  const moveAmountRaw = human.root.position.distanceTo(rootGoal);
  human.walkT += dt * (2 + Math.min(7, moveAmountRaw * 10));
  human.yaw = dampScalar(human.yaw, state === "striking" ? human.strikeYaw : yawFromForward(aimForward), CFG.rotLambda, dt);

  const t = easeInOut(human.poseT);
  const idle = 1 - t;
  const breath = Math.sin(human.breathT * Math.PI * 2) * (0.006 + idle * 0.004);
  const walk = Math.sin(human.walkT * 6.2) * Math.min(1, moveAmountRaw * 12);
  const walkAmount = clamp01(moveAmountRaw * 18) * idle;
  const stroke = state === "dragging" ? Math.sin(performance.now() * 0.011) * (0.25 + power * 0.75) : 0;
  const follow = state === "striking" ? Math.sin(clamp01(human.strikeClock / (CFG.strikeTime + CFG.holdTime)) * Math.PI) : 0;
  const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(Y_AXIS, human.yaw).normalize();
  const side = new THREE.Vector3(forward.z, 0, -forward.x).normalize();
  const local = (v: THREE.Vector3) => v.clone().applyAxisAngle(Y_AXIS, human.yaw).add(human.root.position);
  const powerLean = power * t;

  const rootWorld = human.root.position.clone().addScaledVector(forward, 0.018 * powerLean + 0.026 * follow);
  const torso = local(new THREE.Vector3(0, lerp(1.3, 1.12, t) + breath, lerp(0.02, -0.16, t) - 0.014 * powerLean));
  const chest = local(new THREE.Vector3(0, lerp(1.52, 1.22, t) + breath, lerp(0.02, -0.42, t) - 0.024 * powerLean));
  const neck = local(new THREE.Vector3(0, lerp(1.68, 1.25, t) + breath, lerp(0.02, -0.61, t) - 0.028 * powerLean));
  const head = local(new THREE.Vector3(0, lerp(1.84, 1.34, t) + breath - CFG.chinToCueHeight * 0.16 * t, lerp(0.04, -0.72, t) - 0.028 * powerLean));
  const leftShoulder = local(new THREE.Vector3(-0.23, lerp(1.58, 1.36, t) + breath, lerp(0, -0.46, t) - 0.018 * human.settleT));
  const rightShoulder = local(new THREE.Vector3(0.23, lerp(1.58, 1.36, t) + breath, lerp(0, -0.34, t) - 0.018 * human.settleT));
  const leftHip = local(new THREE.Vector3(-0.13, 0.92, 0.02));
  const rightHip = local(new THREE.Vector3(0.13, 0.92, 0.02));
  const leftFoot = local(new THREE.Vector3(-0.13, 0.035, 0.03 + walk * 0.03).lerp(new THREE.Vector3(-CFG.stanceWidth * 0.42, 0.035, -0.36), t));
  const rightFoot = local(new THREE.Vector3(0.13, 0.035, -0.03 - walk * 0.03).lerp(new THREE.Vector3(CFG.stanceWidth * 0.5, 0.035, 0.36), t));
  const leftHand = idleLeft.clone().lerp(bridgeTarget.clone().addScaledVector(forward, -0.026 * t).addScaledVector(side, -0.018 * t).setY(CFG.tableTopY + CFG.bridgePalmTableLift).addScaledVector(UP, -0.006 * human.settleT), t);
  const rightHand = idleRight.clone().lerp(gripTarget.clone().addScaledVector(forward, 0.032 * stroke * t + 0.052 * follow * power).addScaledVector(UP, -0.007 * follow), t);
  const leftElbow = leftShoulder.clone().lerp(leftHand, 0.57).addScaledVector(UP, 0.02 * t).addScaledVector(side, -0.03 * t).addScaledVector(forward, 0.035 * t);
  const rightElbow = rightHand.clone().addScaledVector(UP, lerp(0.18, CFG.cueArmElbowRise, t)).addScaledVector(side, lerp(0.03, 0.07, t)).addScaledVector(forward, lerp(-0.03, 0, t));
  const leftKnee = leftHip.clone().lerp(leftFoot, 0.53).addScaledVector(UP, lerp(0.18, 0.105, t)).addScaledVector(forward, 0.052 * t).addScaledVector(side, -0.016 * t);
  const rightKnee = rightHip.clone().lerp(rightFoot, 0.52).addScaledVector(UP, lerp(0.18, 0.08, t)).addScaledVector(forward, -0.032 * t).addScaledVector(side, 0.018 * t);

  driveHuman(human, { t, breath, stroke, follow, walkAmount, forward, side, up: UP, rootWorld, torsoCenterWorld: torso, chestCenterWorld: chest, neckWorld: neck, headCenterWorld: head, leftElbow, rightElbow, leftHandWorld: leftHand, rightHandWorld: rightHand, leftKnee, rightKnee, leftFootWorld: leftFoot, rightFootWorld: rightFoot, cueBackWorld: cueBack, cueTipWorld: cueTip });
}

function applyCueShot(cueBall: BallState, power: number, yaw: number, tmp: THREE.Vector3) {
  cueBall.vel.copy(tmp.set(0, 0, -1).applyAxisAngle(Y_AXIS, yaw).normalize()).multiplyScalar(1.9 + 8.2 * Math.pow(power, 1.08));
}
function updateBalls(
  balls: BallState[],
  dt: number,
  tmpA: THREE.Vector3,
  tmpB: THREE.Vector3,
  shotLog?: { firstContact: number | null; potted: Set<number>; cueBallPotted: boolean }
) {
  const halfW = CFG.tableW / 2;
  const halfL = CFG.tableL / 2;
  const pockets = getPocketPositions();
  for (const ball of balls) {
    if (!ball.mesh.visible) continue;
    ball.pos.addScaledVector(ball.vel, dt);
    ball.vel.multiplyScalar(Math.exp(-CFG.friction * dt));
    if (ball.vel.lengthSq() < CFG.minSpeed2) ball.vel.set(0, 0, 0);
    if (ball.pos.x < -halfW + CFG.ballR) {
      ball.pos.x = -halfW + CFG.ballR;
      ball.vel.x = Math.abs(ball.vel.x) * CFG.restitution;
    } else if (ball.pos.x > halfW - CFG.ballR) {
      ball.pos.x = halfW - CFG.ballR;
      ball.vel.x = -Math.abs(ball.vel.x) * CFG.restitution;
    }
    if (ball.pos.z < -halfL + CFG.ballR) {
      ball.pos.z = -halfL + CFG.ballR;
      ball.vel.z = Math.abs(ball.vel.z) * CFG.restitution;
    } else if (ball.pos.z > halfL - CFG.ballR) {
      ball.pos.z = halfL - CFG.ballR;
      ball.vel.z = -Math.abs(ball.vel.z) * CFG.restitution;
    }
    const pocketed = pockets.some((pocket) => planar(ball.pos).distanceTo(planar(pocket)) <= POCKET_CAPTURE_RADIUS);
    if (pocketed) {
      if (ball.isCue) {
        ball.pos.copy(CUE_BALL_RESPOT);
        ball.vel.set(0, 0, 0);
        if (shotLog) shotLog.cueBallPotted = true;
      } else {
        ball.vel.set(0, 0, 0);
        ball.pos.set(999, 999, 999);
        ball.mesh.visible = false;
        if (shotLog) shotLog.potted.add(ball.number);
      }
    }
  }
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i], b = balls[j];
      if (!a.mesh.visible || !b.mesh.visible) continue;
      const delta = tmpA.copy(a.pos).sub(b.pos);
      const dist = delta.length();
      const minDist = CFG.ballR * 2;
      if (dist <= 0 || dist >= minDist) continue;
      const n = delta.normalize();
      const rel = tmpB.copy(a.vel).sub(b.vel);
      const sep = rel.dot(n);
      const overlap = minDist - dist;
      a.pos.addScaledVector(n, overlap * 0.5 + 0.0005);
      b.pos.addScaledVector(n, -overlap * 0.5 - 0.0005);
      if (sep <= 0) {
        const impulse = -(1 + CFG.restitution) * sep * 0.5;
        a.vel.addScaledVector(n, impulse);
        b.vel.addScaledVector(n, -impulse);
        if (shotLog?.firstContact == null) {
          if (a.isCue && !b.isCue) shotLog.firstContact = b.number;
          else if (b.isCue && !a.isCue) shotLog.firstContact = a.number;
        }
      }
    }
  }
  for (const ball of balls) {
    ball.mesh.position.copy(ball.pos);
    const v = tmpA.copy(ball.vel);
    v.y = 0;
    const speed = v.length();
    if (speed > 0.0001) ball.mesh.rotateOnWorldAxis(tmpB.set(v.z, 0, -v.x).normalize(), (speed / CFG.ballR) * dt);
  }
}
function blockersOnPath(balls: BallState[], a: THREE.Vector3, b: THREE.Vector3, ignore: Set<number>, radius: number) {
  let count = 0;
  const ab = b.clone().sub(a);
  const r2 = radius * radius;
  for (const ball of balls) {
    if (ignore.has(ball.number)) continue;
    const p = planar(ball.pos);
    const t = clamp(p.clone().sub(a).dot(ab) / Math.max(1e-6, ab.lengthSq()), 0, 1);
    if (p.distanceToSquared(a.clone().addScaledVector(ab, t)) < r2) count++;
  }
  return count;
}
function chooseAiShot(balls: BallState[], cueBall: BallState): ShotPlan {
  const cue = planar(cueBall.pos);
  const pocketList = getPocketPositions().map(planar);
  let best: (ShotPlan & { score: number }) | null = null;
  for (const target of balls.filter((b) => !b.isCue)) {
    const obj = planar(target.pos);
    for (const pocket of pocketList) {
      const objToPocket = pocket.clone().sub(obj);
      const objPocketDist = objToPocket.length();
      if (objPocketDist < 0.1) continue;
      objToPocket.normalize();
      const ghost = obj.clone().addScaledVector(objToPocket, -CFG.ballR * 2.04);
      if (Math.abs(ghost.x) > CFG.tableW / 2 - CFG.ballR || Math.abs(ghost.z) > CFG.tableL / 2 - CFG.ballR) continue;
      const cueToGhost = ghost.clone().sub(cue);
      const cueGhostDist = cueToGhost.length();
      if (cueGhostDist < 0.1) continue;
      const cueDir = cueToGhost.normalize();
      const cutDot = clamp(cueDir.dot(objToPocket), -1, 1);
      if (cutDot < 0.2) continue;
      const blockers = blockersOnPath(balls, cue, ghost, new Set([0, target.number]), CFG.ballR * 2.05) + blockersOnPath(balls, obj, pocket, new Set([0, target.number]), CFG.ballR * 1.7);
      const score = cueGhostDist * 0.9 + objPocketDist * 0.7 + (1 - cutDot) * 2.4 + blockers * 9;
      const yaw = yawFromForward(new THREE.Vector3(cueDir.x, 0, cueDir.z));
      const power = clamp(0.24 + cueGhostDist * 0.13 + objPocketDist * 0.09 + blockers * 0.05, 0.28, 0.82);
      if (!best || score < best.score) best = { score, yaw, power, target, pocket };
    }
  }
  if (best) return best;
  const nearest = balls.filter((b) => !b.isCue).sort((a, b) => cue.distanceTo(planar(a.pos)) - cue.distanceTo(planar(b.pos)))[0];
  if (!nearest) return { yaw: 0, power: 0.45, target: null, pocket: null };
  const dir = planar(nearest.pos).sub(cue).normalize();
  return { yaw: yawFromForward(new THREE.Vector3(dir.x, 0, dir.z)), power: 0.48, target: nearest, pocket: null };
}
function chooseHumanEdgePosition(cueBallWorld: THREE.Vector3, aimForward: THREE.Vector3) {
  const desired = cueBallWorld.clone().addScaledVector(aimForward, -CFG.desiredShootDistance);
  const xEdge = CFG.tableW / 2 + CFG.edgeMargin;
  const zEdge = CFG.tableL / 2 + CFG.edgeMargin;
  const candidates = [
    new THREE.Vector3(-xEdge, 0, clamp(desired.z, -zEdge, zEdge)),
    new THREE.Vector3(xEdge, 0, clamp(desired.z, -zEdge, zEdge)),
    new THREE.Vector3(clamp(desired.x, -xEdge, xEdge), 0, -zEdge),
    new THREE.Vector3(clamp(desired.x, -xEdge, xEdge), 0, zEdge),
  ];
  return candidates.sort((a, b) => a.distanceToSquared(desired) - b.distanceToSquared(desired))[0].clone();
}

export default function BilardoShqipGame() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [power, setPower] = useState(0);
  const [shotState, setShotState] = useState<ShotState>("idle");
  const [aiLabel, setAiLabel] = useState("AI ready");
  const [scoreboard, setScoreboard] = useState({
    raceTo: RACE_TO_POINTS,
    currentPlayer: "A",
    scores: { A: 0, B: 0 },
    winner: null as "A" | "B" | null
  });

  const powerRef = useRef(0);
  const shotPowerRef = useRef(0);
  const shotStateRef = useRef<ShotState>("idle");
  const scoreboardRef = useRef(scoreboard);
  const draggingSliderRef = useRef(false);
  const aimYawRef = useRef(0);
  const aiShotRef = useRef<() => void>(() => {});
  const timersRef = useRef<number[]>([]);
  const rulesRef = useRef(new BilardoShqipRules(RACE_TO_POINTS));
  const shotLogRef = useRef<{ firstContact: number | null; potted: Set<number>; cueBallPotted: boolean } | null>(null);
  const wasMovingRef = useRef(false);

  useEffect(() => { powerRef.current = power; }, [power]);
  useEffect(() => { shotStateRef.current = shotState; }, [shotState]);
  useEffect(() => { scoreboardRef.current = scoreboard; }, [scoreboard]);

  const animatePowerToZero = (from: number, ms = 220) => {
    const start = performance.now();
    const tick = () => {
      const t = clamp01((performance.now() - start) / ms);
      setPower(lerp(from, 0, easeOutCubic(t)));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const setSliderPower = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const p = clamp01((e.clientY - r.top) / r.height);
    setPower(p);
    shotPowerRef.current = p;
  };
  const onSliderDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (scoreboardRef.current.winner || scoreboardRef.current.currentPlayer !== "A") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingSliderRef.current = true;
    setShotState("dragging");
    setSliderPower(e);
  };
  const onSliderMove = (e: React.PointerEvent<HTMLDivElement>) => { if (draggingSliderRef.current) setSliderPower(e); };
  const onSliderUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (scoreboardRef.current.winner || scoreboardRef.current.currentPlayer !== "A") return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    draggingSliderRef.current = false;
    setShotState(shotPowerRef.current > 0.02 ? "striking" : "idle");
    animatePowerToZero(powerRef.current, 180);
  };

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    rulesRef.current = new BilardoShqipRules(RACE_TO_POINTS);
    const initial = rulesRef.current.getSnapshot();
    setScoreboard({
      raceTo: initial.raceTo,
      currentPlayer: initial.currentPlayer,
      scores: initial.scores,
      winner: initial.winner
    });
    shotLogRef.current = null;
    wasMovingRef.current = false;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setClearColor(0x0b0b0b, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    const mainCamera = new THREE.PerspectiveCamera(42, 1, 0.05, 50);
    mainCamera.position.set(1.65, 2.15, 6.35);
    mainCamera.lookAt(0, 1.05, 0);
    const cueCamera = new THREE.PerspectiveCamera(56, 1, 0.01, 10);

    scene.add(new THREE.AmbientLight(0xffffff, 0.86));
    scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 0.55));
    const sun = new THREE.DirectionalLight(0xffffff, 1.35);
    sun.position.set(3.5, 7, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    scene.add(sun);

    const { tableGroup } = addTable(scene);
    const { balls, cueBall } = addBalls(tableGroup);
    const cue = addCue(scene);
    const human = addHuman(scene);
    const cueLine = createLine(0xffd166, 0.95);
    const aimLine = createLine(0xff6b4a, 0.85);
    const aiTargetLine = createLine(0x72f5b5, 0.62);
    scene.add(cueLine, aimLine, aiTargetLine);

    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), d = new THREE.Vector3();
    let strikeT = 0, didHit = false, frameId = 0, last = performance.now();
    let isAiming = false, lastAimX = 0, plannedTarget: BallState | null = null, plannedPocket: THREE.Vector3 | null = null;
    const resolveShot = () => {
      const log = shotLogRef.current;
      if (!log) return;
      shotLogRef.current = null;
      const outcome = rulesRef.current.resolveShot({
        firstContact: log.firstContact,
        potted: Array.from(log.potted),
        cueBallPotted: log.cueBallPotted
      });
      setScoreboard({
        raceTo: outcome.raceTo,
        currentPlayer: outcome.nextPlayer,
        scores: outcome.scores,
        winner: outcome.winner
      });
      const details = outcome.foul
        ? `Foul: ${outcome.reason || "illegal shot"}`
        : outcome.scored > 0
          ? `+${outcome.scored} (${outcome.pointsByBall.join(", ")})`
          : "No points";
      setAiLabel(
        outcome.winner
          ? `${outcome.winner === "A" ? "Player" : "AI"} wins ${outcome.scores[outcome.winner]}-${Math.min(outcome.scores.A, outcome.scores.B)}`
          : `${outcome.nextPlayer === "A" ? "Player" : "AI"} turn · ${details}`
      );
      if (!outcome.winner && outcome.nextPlayer === "B") {
        timersRef.current.push(window.setTimeout(() => aiShotRef.current?.(), 620));
      }
    };

    const resize = () => {
      const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
      renderer.setSize(w, h, false);
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      mainCamera.aspect = w / h;
      mainCamera.updateProjectionMatrix();
    };
    const onCanvasDown = (e: PointerEvent) => {
      if (!draggingSliderRef.current && !scoreboardRef.current.winner && scoreboardRef.current.currentPlayer === "A") {
        isAiming = true;
        lastAimX = e.clientX;
      }
    };
    const onCanvasMove = (e: PointerEvent) => {
      if (!isAiming || draggingSliderRef.current) return;
      aimYawRef.current -= (e.clientX - lastAimX) * 0.006;
      lastAimX = e.clientX;
      plannedTarget = null;
      plannedPocket = null;
      setAiLabel("manual aim");
    };
    const onCanvasUp = () => { isAiming = false; };
    canvas.addEventListener("pointerdown", onCanvasDown);
    canvas.addEventListener("pointermove", onCanvasMove);
    canvas.addEventListener("pointerup", onCanvasUp);
    canvas.addEventListener("pointercancel", onCanvasUp);

    const renderCueInset = (w: number, h: number, cueBack: THREE.Vector3, cueTip: THREE.Vector3) => {
      const insetW = Math.floor(w * 0.34), insetH = Math.floor(h * 0.2);
      cueCamera.position.copy(cueBack).add(new THREE.Vector3(0, 0.07, 0));
      cueCamera.lookAt(cueTip);
      cueCamera.aspect = insetW / insetH;
      cueCamera.updateProjectionMatrix();
      renderer.clearDepth();
      renderer.setScissorTest(true);
      renderer.setViewport(14, 14, insetW, insetH);
      renderer.setScissor(14, 14, insetW, insetH);
      renderer.render(scene, cueCamera);
      renderer.setScissorTest(false);
    };
    aiShotRef.current = () => {
      const board = scoreboardRef.current;
      if (board.winner || board.currentPlayer !== "B") return;
      const plan = chooseAiShot(balls, cueBall);
      aimYawRef.current = plan.yaw;
      shotPowerRef.current = plan.power;
      plannedTarget = plan.target;
      plannedPocket = plan.pocket;
      setPower(plan.power);
      setShotState("dragging");
      setAiLabel(plan.target ? `AI: ball ${plan.target.number}` : "AI: fallback shot");
      timersRef.current.push(window.setTimeout(() => { setShotState("striking"); animatePowerToZero(plan.power, 240); }, 720));
    };

    resize();
    window.addEventListener("resize", resize);

    function animate() {
      frameId = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const state = shotStateRef.current;
      const activePower = state === "dragging" ? powerRef.current : shotPowerRef.current;
      const cueBallWorld = cueBall.mesh.getWorldPosition(new THREE.Vector3());
      const aimForward = a.set(0, 0, -1).applyAxisAngle(Y_AXIS, aimYawRef.current).normalize();
      const aimSide = b.set(aimForward.z, 0, -aimForward.x).normalize();
      const humanRootTarget = chooseHumanEdgePosition(cueBallWorld, aimForward);
      const bridgeHandTarget = cueBallWorld.clone().addScaledVector(aimForward, -CFG.bridgeHandBackFromBall).addScaledVector(aimSide, CFG.bridgeHandSide).setY(CFG.tableTopY + CFG.bridgePalmTableLift);
      const bridgeCuePoint = bridgeHandTarget.clone().addScaledVector(aimForward, 0.01).add(new THREE.Vector3(0, CFG.bridgeCueLift, 0));
      const pull = CFG.pullRange * easeOutCubic(activePower);
      const practiceStroke = state === "dragging" ? Math.sin(now * 0.012) * 0.035 * (0.25 + activePower * 0.75) : 0;
      const strikeNorm = clamp01(strikeT / CFG.strikeTime);
      let gap = CFG.idleGap;
      if (state === "dragging") gap += pull + practiceStroke;
      if (state === "striking") gap = lerp(CFG.idleGap + pull, CFG.contactGap, easeOutCubic(strikeNorm));
      const cueTipShoot = cueBallWorld.clone().addScaledVector(aimForward, -(CFG.ballR + gap));
      const cueBackShoot = bridgeCuePoint.clone().addScaledVector(aimForward, -(CFG.cueLength - CFG.bridgeDist - CFG.ballR - gap)).add(new THREE.Vector3(0, 0.028, 0));
      const gripHandTarget = cueTipShoot.clone().lerp(cueBackShoot, CFG.gripRatio);
      const standingYaw = yawFromForward(aimForward);
      const idleRightHandTarget = humanRootTarget.clone().add(new THREE.Vector3(0.24, 1.12, 0.02).applyAxisAngle(Y_AXIS, standingYaw));
      const idleLeftHandTarget = humanRootTarget.clone().add(new THREE.Vector3(-0.18, 1.08, 0.03).applyAxisAngle(Y_AXIS, standingYaw));
      let cueBackVisual = cueBackShoot.clone(), cueTipVisual = cueTipShoot.clone();

      if (state === "idle") {
        strikeT = 0;
        didHit = false;
        const idleDir = new THREE.Vector3(0.16, 0.74, -0.22).applyAxisAngle(Y_AXIS, standingYaw).normalize();
        cueBackVisual = idleRightHandTarget.clone().addScaledVector(idleDir, -0.22);
        cueTipVisual = idleRightHandTarget.clone().addScaledVector(idleDir, 0.96);
      } else if (state === "dragging") {
        strikeT = 0;
        didHit = false;
      } else {
        strikeT += dt;
        if (!shotLogRef.current) {
          shotLogRef.current = { firstContact: null, potted: new Set<number>(), cueBallPotted: false };
        }
        if (!didHit && strikeNorm > 0.88) {
          didHit = true;
          applyCueShot(cueBall, shotPowerRef.current, aimYawRef.current, c);
        }
        if (strikeT >= CFG.strikeTime + CFG.holdTime) {
          strikeT = 0;
          didHit = false;
          setShotState("idle");
        }
      }

      setCuePose(cue, state === "idle" ? cueBackVisual : cueBackShoot, state === "idle" ? cueTipVisual : cueTipShoot);
      updateBalls(balls, dt, c, d, shotLogRef.current || undefined);
      const moving = stillMoving(balls);
      if (wasMovingRef.current && !moving) resolveShot();
      wasMovingRef.current = moving;
      updateHumanPose(human, dt, state, humanRootTarget, aimForward, bridgeHandTarget, gripHandTarget, idleRightHandTarget, idleLeftHandTarget, cueBackVisual, cueTipVisual, activePower);
      setLinePoints(cueLine, cueBackVisual, cueBallWorld);
      setLinePoints(aimLine, cueBallWorld, cueBallWorld.clone().add(aimForward.clone().multiplyScalar(2.1)));
      if (plannedTarget && plannedPocket) {
        setLinePoints(aiTargetLine, plannedTarget.mesh.getWorldPosition(new THREE.Vector3()), plannedPocket.clone().setY(CFG.tableTopY + 0.06));
        aiTargetLine.visible = true;
      } else aiTargetLine.visible = false;
      const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
      renderer.setViewport(0, 0, w, h);
      renderer.setScissorTest(false);
      renderer.render(scene, mainCamera);
      renderCueInset(w, h, cueBackVisual, cueTipVisual);
    }
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      timersRef.current.forEach((id) => window.clearTimeout(id));
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onCanvasDown);
      canvas.removeEventListener("pointermove", onCanvasMove);
      canvas.removeEventListener("pointerup", onCanvasUp);
      canvas.removeEventListener("pointercancel", onCanvasUp);
      renderer.dispose();
    };
  }, []);

  const sliderH = 320, sliderW = 58, knob = 30;
  const knobTop = clamp(power * sliderH - knob / 2, -2, sliderH - knob + 2);
  return (
    <div style={{ position: "fixed", inset: 0, background: "#0b0b0b" }}>
      <div ref={hostRef} style={{ position: "absolute", inset: 0 }}>
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }} />
      </div>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ position: "absolute", left: 14, bottom: 18, display: "flex", alignItems: "center", gap: 10, pointerEvents: "auto" }}>
          <button
            onClick={() => aiShotRef.current?.()}
            disabled={scoreboard.currentPlayer !== "B" || Boolean(scoreboard.winner)}
            style={{
              border: "1px solid rgba(255,255,255,0.22)",
              background: scoreboard.currentPlayer === "B" && !scoreboard.winner ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.4)",
              color: "#111827",
              borderRadius: 14,
              padding: "11px 14px",
              fontWeight: 800,
              boxShadow: "0 10px 24px rgba(0,0,0,0.28)"
            }}
          >
            AI Shot
          </button>
          <div style={{ color: "white", background: "rgba(0,0,0,0.42)", border: "1px solid rgba(255,255,255,0.16)", borderRadius: 14, padding: "10px 12px", fontSize: 12, letterSpacing: 0.2, maxWidth: 220 }}>
            {`Race to ${scoreboard.raceTo} · Player ${scoreboard.scores.A} : AI ${scoreboard.scores.B}`}
            <br />
            {scoreboard.winner ? `${scoreboard.winner === "A" ? "Player" : "AI"} wins` : aiLabel}
            <br />
            {`Turn: ${scoreboard.currentPlayer === "A" ? "Player" : "AI"} · Rotation 61 rules`}
          </div>
        </div>
        <div style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, pointerEvents: "auto", touchAction: "none", userSelect: "none" }}>
          <div onPointerDown={onSliderDown} onPointerMove={onSliderMove} onPointerUp={onSliderUp} style={{ position: "relative", height: sliderH, width: sliderW, borderRadius: 18, background: "rgba(255,255,255,0.92)", boxShadow: "0 12px 28px rgba(0,0,0,0.2)", padding: 9, opacity: scoreboard.currentPlayer === "A" && !scoreboard.winner ? 1 : 0.45, pointerEvents: scoreboard.currentPlayer === "A" && !scoreboard.winner ? "auto" : "none" }}>
            <div style={{ position: "absolute", left: 14, right: 14, top: 14, bottom: 14, borderRadius: 999, background: "rgba(0,0,0,0.12)", overflow: "hidden" }}>
              <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: `${power * 100}%`, background: "rgba(17,17,17,0.58)" }} />
            </div>
            <div style={{ position: "absolute", left: (sliderW - knob) / 2, top: 14 + knobTop, width: knob, height: knob, borderRadius: 999, background: "rgba(255,255,255,0.98)", border: "1px solid rgba(0,0,0,0.18)", boxShadow: "0 10px 18px rgba(0,0,0,0.18)" }} />
          </div>
        </div>
        <div style={{ position: "absolute", left: 14, top: 14, width: "34vw", maxWidth: 260, borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)", boxShadow: "0 10px 20px rgba(0,0,0,0.28)", pointerEvents: "none", background: "rgba(8,12,18,0.58)", color: "white", padding: "10px 12px", fontSize: 11, lineHeight: 1.4 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Bilardo Shqip · Rotation 61</div>
          <div>• Lowest numbered ball must be first contact.</div>
          <div>• Solids + stripes use their ball number as points.</div>
          <div>• Foul = turn loss and cue-ball in hand.</div>
          <div>• First player to {scoreboard.raceTo} wins.</div>
        </div>
      </div>
    </div>
  );
}
