"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { CHESS_HUMAN_CHARACTER_OPTIONS } from "../../config/chessBattleInventoryConfig.js";
import { POOL_ROYALE_HDRI_VARIANTS } from "../../config/poolRoyaleInventoryConfig.js";
import { getChessBattleInventory, isChessOptionUnlocked } from "../../utils/chessBattleInventory.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

type PlayerSide = "near" | "far";
type PointReason = "out" | "doubleBounce" | "net" | "wrongSide" | "miss";
type StrokeAction = "ready" | "forehand" | "backhand" | "serve";
type ServeStage = "own" | "opponent";
type AiTactic = "serve" | "loop" | "drive" | "push" | "wide" | "body";

type DesiredHit = {
  target: THREE.Vector3;
  power: number;
  topSpin: number;
  sideSpin: number;
  tactic?: AiTactic;
};

type BallPhase =
  | { kind: "serve"; server: PlayerSide; stage: ServeStage }
  | { kind: "rally" };

type BallState = {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  lastHitBy: PlayerSide | null;
  bounceSide: PlayerSide | null;
  bounceCount: number;
  phase: BallPhase;
};

type BonePack = {
  spine?: THREE.Bone;
  chest?: THREE.Bone;
  neck?: THREE.Bone;
  rightShoulder?: THREE.Bone;
  rightUpperArm?: THREE.Bone;
  rightForeArm?: THREE.Bone;
  rightHand?: THREE.Bone;
  leftShoulder?: THREE.Bone;
  leftUpperArm?: THREE.Bone;
  leftForeArm?: THREE.Bone;
  leftHand?: THREE.Bone;
};

type BoneRest = { bone: THREE.Bone; q: THREE.Quaternion };

type ArmChain = {
  shoulder?: THREE.Bone;
  upper: THREE.Bone;
  fore: THREE.Bone;
  hand: THREE.Bone;
  upperLen: number;
  foreLen: number;
};

type StrokePose = {
  rightShoulder: THREE.Vector3;
  rightElbow: THREE.Vector3;
  rightHand: THREE.Vector3;
  leftShoulder: THREE.Vector3;
  leftElbow: THREE.Vector3;
  leftHand: THREE.Vector3;
  paddleGrip: THREE.Vector3;
  paddleCenter: THREE.Vector3;
  faceNormal: THREE.Vector3;
  torsoYaw: number;
  torsoLean: number;
  shoulderLift: number;
  wristPronation: number;
  crouch: number;
};

type HumanRig = {
  side: PlayerSide;
  root: THREE.Group;
  modelRoot: THREE.Group;
  fallback: THREE.Group;
  paddle: THREE.Group;
  model: THREE.Object3D | null;
  bones: BonePack;
  rest: BoneRest[];
  rightArmChain?: ArmChain;
  leftArmChain?: ArmChain;
  pos: THREE.Vector3;
  target: THREE.Vector3;
  yaw: number;
  action: StrokeAction;
  swingT: number;
  cooldown: number;
  desiredHit: DesiredHit | null;
  hitThisSwing: boolean;
  speed: number;
};

type HudState = { nearScore: number; farScore: number; status: string; power: number; spin: number };

type ControlState = {
  active: boolean;
  pointerId: number | null;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  startPlayer: THREE.Vector3;
};

const TABLE_GLTF_URL = "";
const DEFAULT_HDRI_URLS = [
  "https://threejs.org/examples/textures/equirectangular/royal_esplanade_1k.hdr",
  "https://threejs.org/examples/textures/equirectangular/venice_sunset_1k.hdr"
];

const UP = new THREE.Vector3(0, 1, 0);
const Y_AXIS = UP;

const CFG = {
  // Match Pool Royale stage proportions so table footprint/height align in the same HDRI placement.
  tableL: 5.8,
  tableW: 3.2,
  tableY: 1.45,
  tableTopThickness: 0.075,
  netH: 0.1525,
  netPostOutside: 0.1525,
  ballR: 0.038,
  gravity: 9.81,
  airDrag: 0.22,
  magnus: 0.00125,
  tableRestitution: 0.875,
  tableFriction: 0.965,
  spinDecay: 0.72,
  playerHeight: 2.9,
  playerSpeed: 3.35,
  aiSpeed: 3.45,
  reach: 0.82,
  swingDuration: 0.34,
  backhandDuration: 0.29,
  serveDuration: 0.86,
  hitWindowStart: 0.43,
  hitWindowEnd: 0.72,
  serveContactT: 0.68,
  playerVisualYawFix: Math.PI,
  paddlePalmOffset: 0.038,
};

const TABLE_REFERENCE_LENGTH = 2.74;
const TABLE_SCALE_FACTOR = CFG.tableL / TABLE_REFERENCE_LENGTH;
const PADDLE_SCALE_FACTOR = Math.max(1, TABLE_SCALE_FACTOR * 0.78);

const TABLE_HALF_W = CFG.tableW / 2;
const TABLE_HALF_L = CFG.tableL / 2;
const BALL_SURFACE_Y = CFG.tableY + CFG.ballR;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const clamp01 = (v: number) => clamp(v, 0, 1);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const sideOfZ = (z: number): PlayerSide => (z >= 0 ? "near" : "far");
const opposite = (side: PlayerSide): PlayerSide => (side === "near" ? "far" : "near");

function material(color: number, roughness = 0.72, metalness = 0.02) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function transparentMaterial(color: number, opacity: number, roughness = 0.72) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02, transparent: true, opacity, depthWrite: false });
}

function enableShadow(obj: THREE.Object3D) {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
    }
  });
  return obj;
}

function addBox(group: THREE.Group | THREE.Scene, size: [number, number, number], pos: [number, number, number], matArg: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), matArg);
  mesh.position.set(...pos);
  enableShadow(mesh);
  group.add(mesh);
  return mesh;
}

function addCylinder(group: THREE.Group | THREE.Scene, radiusTop: number, radiusBottom: number, height: number, pos: [number, number, number], matArg: THREE.Material, segments = 32) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), matArg);
  mesh.position.set(...pos);
  enableShadow(mesh);
  group.add(mesh);
  return mesh;
}

function yawFromForward(forward: THREE.Vector3) {
  return Math.atan2(-forward.x, -forward.z);
}

function forwardFromYaw(yaw: number) {
  return new THREE.Vector3(0, 0, -1).applyAxisAngle(Y_AXIS, yaw).normalize();
}

function rightFromForward(forward: THREE.Vector3) {
  return new THREE.Vector3(-forward.z, 0, forward.x).normalize();
}

function getWorldPos(obj: THREE.Object3D) {
  return obj.getWorldPosition(new THREE.Vector3());
}

function isOverTable(x: number, z: number, margin = 0) {
  return Math.abs(x) <= TABLE_HALF_W + margin && Math.abs(z) <= TABLE_HALF_L + margin;
}

function buildRealisticTableTennisTable() {
  const group = new THREE.Group();
  group.name = "RealisticTableTennisTable_ProceduralGLTFStyle";

  const tableBlue = material(0x123f73, 0.78, 0.02);
  const tableEdge = material(0x10161d, 0.55, 0.06);
  const whiteLine = material(0xf6f7f0, 0.45, 0.0);
  const metal = material(0x171c22, 0.38, 0.32);
  const wheelMat = material(0x0b0e12, 0.46, 0.28);
  const netMat = transparentMaterial(0x050505, 0.46, 0.7);
  const netTape = material(0xf2f2f2, 0.46, 0.02);

  addBox(group, [CFG.tableW, CFG.tableTopThickness, CFG.tableL], [0, CFG.tableY - CFG.tableTopThickness / 2, 0], tableBlue);
  addBox(group, [CFG.tableW + 0.055, 0.035, CFG.tableL + 0.055], [0, CFG.tableY - CFG.tableTopThickness - 0.015, 0], tableEdge);

  const y = CFG.tableY + 0.003;
  const edgeLine = 0.02;
  const centerLine = 0.003;
  addBox(group, [CFG.tableW, 0.004, edgeLine], [0, y, -TABLE_HALF_L + edgeLine / 2], whiteLine);
  addBox(group, [CFG.tableW, 0.004, edgeLine], [0, y, TABLE_HALF_L - edgeLine / 2], whiteLine);
  addBox(group, [edgeLine, 0.004, CFG.tableL], [-TABLE_HALF_W + edgeLine / 2, y, 0], whiteLine);
  addBox(group, [edgeLine, 0.004, CFG.tableL], [TABLE_HALF_W - edgeLine / 2, y, 0], whiteLine);
  addBox(group, [centerLine, 0.004, CFG.tableL], [0, y + 0.001, 0], transparentMaterial(0xffffff, 0.54));

  addBox(group, [CFG.tableW * 0.88, 0.035, 0.05], [0, 0.64, 0.42], metal);
  addBox(group, [CFG.tableW * 0.88, 0.035, 0.05], [0, 0.64, -0.42], metal);
  addBox(group, [0.045, 0.035, CFG.tableL * 0.74], [-0.56, 0.64, 0], metal);
  addBox(group, [0.045, 0.035, CFG.tableL * 0.74], [0.56, 0.64, 0], metal);
  for (const x of [-0.58, 0.58]) {
    for (const z of [-1.06, -0.44, 0.44, 1.06]) {
      const leg = addCylinder(group, 0.025, 0.027, 0.66, [x, 0.33, z], metal, 16);
      leg.rotation.z = z > 0 ? 0.05 : -0.05;
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.015, 10, 20), wheelMat);
      wheel.position.set(x, 0.035, z);
      wheel.rotation.x = Math.PI / 2;
      enableShadow(wheel);
      group.add(wheel);
    }
  }
  addBox(group, [0.05, 0.035, 1.74], [-0.62, 0.39, 0], metal).rotation.y = 0.16;
  addBox(group, [0.05, 0.035, 1.74], [0.62, 0.39, 0], metal).rotation.y = -0.16;

  const netY = CFG.tableY + CFG.netH / 2;
  addBox(group, [CFG.tableW + CFG.netPostOutside * 2, CFG.netH, 0.012], [0, netY, 0], netMat);
  addBox(group, [CFG.tableW + CFG.netPostOutside * 2 + 0.035, 0.018, 0.026], [0, CFG.tableY + CFG.netH + 0.009, 0], netTape);
  for (let i = -6; i <= 6; i++) addBox(group, [0.0035, CFG.netH * 0.86, 0.014], [(i * CFG.tableW) / 12, CFG.tableY + CFG.netH * 0.43, 0.008], transparentMaterial(0xffffff, 0.25));
  for (let j = 1; j <= 3; j++) addBox(group, [CFG.tableW + 0.12, 0.0035, 0.014], [0, CFG.tableY + (j * CFG.netH) / 4, 0.009], transparentMaterial(0xffffff, 0.24));
  const leftPost = addCylinder(group, 0.017, 0.02, CFG.netH + 0.08, [-(TABLE_HALF_W + CFG.netPostOutside), CFG.tableY + (CFG.netH + 0.08) / 2, 0], metal, 18);
  const rightPost = addCylinder(group, 0.017, 0.02, CFG.netH + 0.08, [TABLE_HALF_W + CFG.netPostOutside, CFG.tableY + (CFG.netH + 0.08) / 2, 0], metal, 18);
  leftPost.rotation.z = -0.03;
  rightPost.rotation.z = 0.03;
  addBox(group, [0.09, 0.035, 0.13], [-(TABLE_HALF_W + 0.13), CFG.tableY - 0.075, 0], metal);
  addBox(group, [0.09, 0.035, 0.13], [TABLE_HALF_W + 0.13, CFG.tableY - 0.075, 0], metal);

  enableShadow(group);
  return group;
}

function createConfiguredGltfLoader(renderer: THREE.WebGLRenderer) {
  const loader = new GLTFLoader().setCrossOrigin("anonymous");
  const dracoLoader = new DRACOLoader().setDecoderPath("https://www.gstatic.com/draco/v1/decoders/");
  const ktx2Loader = new KTX2Loader().setTranscoderPath("https://cdn.jsdelivr.net/npm/three@0.181.1/examples/jsm/libs/basis/");
  ktx2Loader.detectSupport(renderer);
  loader.setDRACOLoader(dracoLoader);
  loader.setMeshoptDecoder?.(MeshoptDecoder);
  loader.setKTX2Loader(ktx2Loader);
  return loader;
}

function addTable(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
  const fallback = buildRealisticTableTennisTable();
  scene.add(fallback);
  if (!TABLE_GLTF_URL) return fallback;

  const tableLoader = createConfiguredGltfLoader(renderer);
  tableLoader.load(
    TABLE_GLTF_URL,
    (gltf) => {
      const loaded = gltf.scene;
      const box = new THREE.Box3().setFromObject(loaded);
      const size = box.getSize(new THREE.Vector3());
      const scale = Math.min(CFG.tableW / Math.max(size.x, 0.001), CFG.tableL / Math.max(size.z, 0.001));
      loaded.scale.setScalar(scale);
      loaded.updateMatrixWorld(true);
      const newBox = new THREE.Box3().setFromObject(loaded);
      loaded.position.set(-(newBox.min.x + newBox.max.x) / 2, CFG.tableY - newBox.max.y, -(newBox.min.z + newBox.max.z) / 2);
      enableShadow(loaded);
      fallback.visible = false;
      scene.add(loaded);
    },
    undefined,
    () => {
      fallback.visible = true;
    }
  );
  return fallback;
}

function normalizeHuman(model: THREE.Object3D, targetHeight: number) {
  model.rotation.set(0, CFG.playerVisualYawFix, 0);
  model.position.set(0, 0, 0);
  model.scale.setScalar(1);
  model.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(model);
  const h = Math.max(0.001, box.max.y - box.min.y);
  model.scale.setScalar(targetHeight / h);
  model.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.add(new THREE.Vector3(-center.x, -box.min.y, -center.z));
}

function createFallbackHuman(color: number) {
  const g = new THREE.Group();
  const skin = material(0xf0c7a0, 0.78, 0.02);
  const shirt = material(color, 0.74, 0.02);
  const shorts = material(0x20232a, 0.76, 0.02);
  const shoe = material(0xffffff, 0.55, 0.03);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 28, 20), skin);
  head.position.y = 1.53;
  g.add(head);
  addCylinder(g, 0.045, 0.05, 0.12, [0, 1.36, 0], skin, 18);
  const torso = addCylinder(g, 0.19, 0.26, 0.66, [0, 0.98, 0], shirt, 28);
  torso.scale.x = 0.78;
  const hips = addCylinder(g, 0.21, 0.22, 0.22, [0, 0.57, 0], shorts, 22);
  hips.scale.x = 0.9;
  const leftLeg = addCylinder(g, 0.055, 0.07, 0.58, [-0.11, 0.29, 0], shorts, 16);
  const rightLeg = addCylinder(g, 0.055, 0.07, 0.58, [0.11, 0.29, 0], shorts, 16);
  leftLeg.rotation.z = 0.1;
  rightLeg.rotation.z = -0.1;
  addBox(g, [0.2, 0.05, 0.28], [-0.12, 0.035, -0.04], shoe);
  addBox(g, [0.2, 0.05, 0.28], [0.12, 0.035, -0.04], shoe);
  enableShadow(g);
  return g;
}

function createTableTennisPaddle(colorA: number, colorB = 0x090909) {
  const s = PADDLE_SCALE_FACTOR;
  const g = new THREE.Group();
  const wood = material(0x9a6a35, 0.62, 0.02);
  const redRubber = material(colorA, 0.86, 0.01);
  const blackRubber = material(colorB, 0.88, 0.01);
  const edge = material(0xead5a7, 0.6, 0.0);

  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.048 * s, 0.14 * s, 0.034 * s), wood);
  handle.position.y = 0.045 * s;
  handle.rotation.z = 0.02;
  enableShadow(handle);
  g.add(handle);

  const throat = new THREE.Mesh(new THREE.BoxGeometry(0.07 * s, 0.05 * s, 0.014 * s), wood);
  throat.position.y = 0.125 * s;
  enableShadow(throat);
  g.add(throat);

  const bladeEdge = new THREE.Mesh(new THREE.CylinderGeometry(0.092 * s, 0.092 * s, 0.012 * s, 56), edge);
  bladeEdge.rotation.x = Math.PI / 2;
  bladeEdge.scale.x = 0.92;
  bladeEdge.scale.y = 1.08;
  bladeEdge.position.y = 0.19 * s;
  enableShadow(bladeEdge);
  g.add(bladeEdge);

  const front = new THREE.Mesh(new THREE.CircleGeometry(0.089 * s, 56), redRubber);
  front.scale.y = 1.08;
  front.position.set(0, 0.19 * s, 0.0078 * s);
  g.add(front);

  const back = new THREE.Mesh(new THREE.CircleGeometry(0.089 * s, 56), blackRubber);
  back.scale.y = 1.08;
  back.rotation.y = Math.PI;
  back.position.set(0, 0.19 * s, -0.0078 * s);
  g.add(back);

  for (let i = 0; i < 18; i++) {
    const dot = new THREE.Mesh(new THREE.BoxGeometry(0.005 * s, 0.005 * s, 0.018 * s), edge);
    const a = (i / 18) * Math.PI * 2;
    dot.position.set(Math.cos(a) * 0.084 * 0.92 * s, (0.19 + Math.sin(a) * 0.09 * 1.08) * s, 0);
    dot.rotation.z = a;
    g.add(dot);
  }

  enableShadow(g);
  return g;
}

function findFirstBone(root: THREE.Object3D, tests: string[]) {
  let found: THREE.Bone | undefined;
  root.traverse((o) => {
    if (found) return;
    const b = o as THREE.Bone;
    if (!b.isBone) return;
    const n = b.name.toLowerCase().replace(/[_.\-\s]/g, "");
    if (tests.some((t) => n.includes(t))) found = b;
  });
  return found;
}

function findHumanBones(model: THREE.Object3D): BonePack {
  return {
    spine: findFirstBone(model, ["spine"]),
    chest: findFirstBone(model, ["chest", "spine2", "upperchest"]),
    neck: findFirstBone(model, ["neck"]),
    rightShoulder: findFirstBone(model, ["rightshoulder", "rshoulder"]),
    rightUpperArm: findFirstBone(model, ["rightarm", "rightupperarm", "rarm", "rupperarm"]),
    rightForeArm: findFirstBone(model, ["rightforearm", "rightlowerarm", "rforearm", "rlowerarm"]),
    rightHand: findFirstBone(model, ["righthand", "rhand"]),
    leftShoulder: findFirstBone(model, ["leftshoulder", "lshoulder"]),
    leftUpperArm: findFirstBone(model, ["leftarm", "leftupperarm", "larm", "lupperarm"]),
    leftForeArm: findFirstBone(model, ["leftforearm", "leftlowerarm", "lforearm", "llowerarm"]),
    leftHand: findFirstBone(model, ["lefthand", "lhand"]),
  };
}

function captureRestPose(bones: BonePack) {
  const out: BoneRest[] = [];
  Object.values(bones).forEach((bone) => {
    if (bone && !out.some((r) => r.bone === bone)) out.push({ bone, q: bone.quaternion.clone() });
  });
  return out;
}

function makeArmChain(shoulder: THREE.Bone | undefined, upper: THREE.Bone | undefined, fore: THREE.Bone | undefined, hand: THREE.Bone | undefined): ArmChain | undefined {
  if (!upper || !fore || !hand) return undefined;
  upper.updateMatrixWorld(true);
  fore.updateMatrixWorld(true);
  hand.updateMatrixWorld(true);
  const a = getWorldPos(upper);
  const b = getWorldPos(fore);
  const c = getWorldPos(hand);
  return {
    shoulder,
    upper,
    fore,
    hand,
    upperLen: Math.max(0.05, a.distanceTo(b)),
    foreLen: Math.max(0.05, b.distanceTo(c)),
  };
}

function setBoneWorldQuaternion(bone: THREE.Bone, worldQ: THREE.Quaternion) {
  const parentWorldQ = new THREE.Quaternion();
  if (bone.parent) bone.parent.getWorldQuaternion(parentWorldQ);
  bone.quaternion.copy(parentWorldQ.invert().multiply(worldQ));
}

function rotateBoneSoChildPointsTo(bone: THREE.Bone, child: THREE.Object3D, targetDirWorld: THREE.Vector3) {
  bone.updateMatrixWorld(true);
  child.updateMatrixWorld(true);
  const bonePos = getWorldPos(bone);
  const childPos = getWorldPos(child);
  const currentDir = childPos.sub(bonePos).normalize();
  const desiredDir = targetDirWorld.clone().normalize();
  if (currentDir.lengthSq() < 1e-8 || desiredDir.lengthSq() < 1e-8) return;
  const delta = new THREE.Quaternion().setFromUnitVectors(currentDir, desiredDir);
  const currentWorldQ = bone.getWorldQuaternion(new THREE.Quaternion());
  setBoneWorldQuaternion(bone, delta.multiply(currentWorldQ));
}

function solveTwoBoneArm(chain: ArmChain | undefined, shoulderTarget: THREE.Vector3, elbowHint: THREE.Vector3, handTarget: THREE.Vector3) {
  if (!chain) return false;
  const { shoulder, upper, fore, hand, upperLen, foreLen } = chain;
  upper.updateMatrixWorld(true);
  fore.updateMatrixWorld(true);
  hand.updateMatrixWorld(true);

  const rootPos = getWorldPos(upper);
  const toTarget = handTarget.clone().sub(rootPos);
  const distRaw = Math.max(0.0001, toTarget.length());
  const dist = clamp(distRaw, 0.001, upperLen + foreLen - 0.001);
  const dir = toTarget.normalize();

  const hintDir = elbowHint.clone().sub(rootPos);
  let normal = new THREE.Vector3().crossVectors(dir, hintDir).normalize();
  if (normal.lengthSq() < 1e-8) {
    normal = new THREE.Vector3(0, 1, 0).cross(dir);
    if (normal.lengthSq() < 1e-8) normal = new THREE.Vector3(1, 0, 0);
    normal.normalize();
  }
  const bendAxis = new THREE.Vector3().crossVectors(normal, dir).normalize();
  const a = (upperLen * upperLen - foreLen * foreLen + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, upperLen * upperLen - a * a));
  const mid = rootPos.clone().addScaledVector(dir, a);
  const elbowA = mid.clone().addScaledVector(bendAxis, h);
  const elbowB = mid.clone().addScaledVector(bendAxis, -h);
  const elbow = elbowA.distanceToSquared(elbowHint) < elbowB.distanceToSquared(elbowHint) ? elbowA : elbowB;

  if (shoulder) {
    shoulder.updateMatrixWorld(true);
    const shoulderPos = getWorldPos(shoulder);
    const shoulderDir = shoulderTarget.clone().sub(shoulderPos);
    if (shoulderDir.lengthSq() > 1e-8) rotateBoneSoChildPointsTo(shoulder, upper, shoulderDir.normalize());
  }
  upper.updateMatrixWorld(true);
  rotateBoneSoChildPointsTo(upper, fore, elbow.clone().sub(getWorldPos(upper)).normalize());
  fore.updateMatrixWorld(true);
  rotateBoneSoChildPointsTo(fore, hand, handTarget.clone().sub(getWorldPos(fore)).normalize());
  hand.updateMatrixWorld(true);
  return true;
}

function addLocalRotation(bone: THREE.Bone | undefined, x: number, y: number, z: number) {
  if (!bone) return;
  bone.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, "XYZ")));
}

function addHuman(scene: THREE.Scene, renderer: THREE.WebGLRenderer, side: PlayerSide, start: THREE.Vector3, accent: number, humanUrl?: string): HumanRig {
  const root = new THREE.Group();
  const modelRoot = new THREE.Group();
  const fallback = createFallbackHuman(accent);
  const paddle = createTableTennisPaddle(side === "near" ? 0xb91f26 : 0x234ebf);

  root.position.copy(start);
  modelRoot.position.copy(start);
  modelRoot.add(fallback);
  scene.add(root, modelRoot, paddle);

  const rig: HumanRig = {
    side,
    root,
    modelRoot,
    fallback,
    paddle,
    model: null,
    bones: {},
    rest: [],
    rightArmChain: undefined,
    leftArmChain: undefined,
    pos: start.clone(),
    target: start.clone(),
    yaw: side === "near" ? 0 : Math.PI,
    action: "ready",
    swingT: 0,
    cooldown: 0,
    desiredHit: null,
    hitThisSwing: false,
    speed: side === "near" ? CFG.playerSpeed : CFG.aiSpeed,
  };

  modelRoot.rotation.y = rig.yaw;
  paddle.visible = true;

  createConfiguredGltfLoader(renderer).load(
    humanUrl || CHESS_HUMAN_CHARACTER_OPTIONS[0]?.modelUrls?.[0],
    (gltf) => {
      const model = gltf.scene;
      normalizeHuman(model, CFG.playerHeight);
      enableShadow(model);
      rig.model = model;
      rig.bones = findHumanBones(model);
      rig.rest = captureRestPose(rig.bones);
      rig.fallback.visible = false;
      rig.modelRoot.add(model);
      rig.modelRoot.updateMatrixWorld(true);
      rig.rightArmChain = makeArmChain(rig.bones.rightShoulder, rig.bones.rightUpperArm, rig.bones.rightForeArm, rig.bones.rightHand);
      rig.leftArmChain = makeArmChain(rig.bones.leftShoulder, rig.bones.leftUpperArm, rig.bones.leftForeArm, rig.bones.leftHand);
    },
    undefined,
    () => {
      rig.fallback.visible = true;
    }
  );

  return rig;
}

function makeBallTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#f6f2dc";
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = "rgba(255,255,255,0.58)";
  ctx.beginPath();
  ctx.arc(88, 78, 52, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(180,170,150,0.55)";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(128, 128, 72, -0.7, Math.PI + 0.5);
  ctx.stroke();
  return c;
}

function createBall() {
  const tex = new THREE.CanvasTexture(makeBallTexture());
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.58, metalness: 0.0 });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(CFG.ballR, 32, 24), mat);
  enableShadow(mesh);
  return {
    mesh,
    pos: new THREE.Vector3(0, CFG.tableY + 0.24, TABLE_HALF_L + 0.36),
    vel: new THREE.Vector3(),
    spin: new THREE.Vector3(),
    lastHitBy: null,
    bounceSide: null,
    bounceCount: 0,
    phase: { kind: "serve", server: "near", stage: "own" },
  } as BallState;
}

function baseVectors(player: HumanRig) {
  const forward = forwardFromYaw(player.yaw);
  const right = rightFromForward(forward);
  return { forward, right };
}

function servePalmPosition(player: HumanRig) {
  const { forward, right } = baseVectors(player);
  return player.pos.clone().addScaledVector(right, -0.18).addScaledVector(forward, 0.18).setY(CFG.tableY + 0.28);
}

function serveTossPosition(player: HumanRig, tRaw: number) {
  const palm = servePalmPosition(player);
  const contactT = CFG.serveContactT;
  const phase = clamp01(tRaw / contactT);
  const tossRise = Math.sin(phase * Math.PI);
  const smallForwardDrift = easeOutCubic(phase) * 0.08;
  const { forward } = baseVectors(player);
  return palm.clone().addScaledVector(forward, smallForwardDrift).setY(palm.y + 0.08 + tossRise * 0.54);
}

function serveContactPosition(player: HumanRig) {
  const { forward, right } = baseVectors(player);
  return player.pos.clone().addScaledVector(right, 0.08).addScaledVector(forward, 0.27).setY(CFG.tableY + 0.31);
}

function resetBallForServe(ball: BallState, server: HumanRig) {
  ball.pos.copy(serveTossPosition(server, 0));
  ball.vel.set(0, 0, 0);
  ball.spin.set(0, 0, 0);
  ball.lastHitBy = null;
  ball.bounceSide = null;
  ball.bounceCount = 0;
  ball.phase = { kind: "serve", server: server.side, stage: "own" };
  ball.mesh.position.copy(ball.pos);
}

function restoreRestPose(player: HumanRig) {
  for (const r of player.rest) r.bone.quaternion.copy(r.q);
}

function tableTennisPose(player: HumanRig, ball: BallState): StrokePose {
  const { forward, right } = baseVectors(player);
  const tRaw = player.swingT > 0 ? clamp01(player.swingT) : 0;
  const action = player.action;
  const base = player.pos.clone();

  const crouch = action === "ready" ? 0.1 : 0.06;
  const shoulderY = 1.34 - crouch;
  const rightShoulder = base.clone().addScaledVector(right, 0.26).addScaledVector(forward, -0.005).setY(shoulderY);
  const leftShoulder = base.clone().addScaledVector(right, -0.26).addScaledVector(forward, -0.005).setY(shoulderY);

  let rightElbow = rightShoulder.clone().addScaledVector(right, 0.17).addScaledVector(forward, 0.08).setY(CFG.tableY + 0.34);
  let rightHand = rightShoulder.clone().addScaledVector(right, 0.32).addScaledVector(forward, 0.23).setY(CFG.tableY + 0.18);
  let leftElbow = leftShoulder.clone().addScaledVector(right, -0.18).addScaledVector(forward, 0.07).setY(CFG.tableY + 0.34);
  let leftHand = leftShoulder.clone().addScaledVector(right, -0.28).addScaledVector(forward, 0.2).setY(CFG.tableY + 0.18);
  let paddleCenter = rightHand.clone().addScaledVector(forward, 0.14).setY(CFG.tableY + 0.2);
  let faceNormal = forward.clone().multiplyScalar(-1).add(new THREE.Vector3(0, 0.08, 0)).normalize();
  let torsoYaw = 0;
  let torsoLean = 0.1;
  let shoulderLift = 0;
  let wristPronation = 0;

  const readyServe = ball.lastHitBy === null && ball.phase.kind === "serve" && ball.phase.server === player.side && action === "ready";

  if (action === "serve" || readyServe) {
    const s = action === "serve" ? tRaw : 0;
    const toss = clamp01(s / 0.34);
    const load = clamp01((s - 0.1) / 0.28);
    const drop = clamp01((s - 0.38) / 0.2);
    const contact = clamp01((s - 0.58) / 0.14);
    const follow = clamp01((s - 0.72) / 0.28);
    const palm = servePalmPosition(player);

    torsoYaw = -0.32 * load + 0.55 * contact - 0.18 * follow;
    torsoLean = 0.13 - 0.07 * load + 0.12 * contact;
    shoulderLift = 0.16 * contact;

    leftElbow = leftShoulder.clone().addScaledVector(right, -0.08).addScaledVector(forward, 0.14).setY(lerp(CFG.tableY + 0.22, CFG.tableY + 0.72, toss) - 0.42 * contact);
    leftHand = palm.clone().setY(lerp(CFG.tableY + 0.28, CFG.tableY + 0.88, toss) - 0.55 * contact);

    const prepHand = rightShoulder.clone().addScaledVector(right, 0.24).addScaledVector(forward, -0.12).setY(CFG.tableY + 0.32);
    const dropHand = rightShoulder.clone().addScaledVector(right, 0.3).addScaledVector(forward, 0.03).setY(CFG.tableY + 0.15);
    const contactHand = serveContactPosition(player).addScaledVector(right, -0.08).addScaledVector(forward, -0.04).setY(CFG.tableY + 0.24);
    const followHand = base.clone().addScaledVector(right, -0.26).addScaledVector(forward, 0.24).setY(CFG.tableY + 0.52);

    rightHand.copy(prepHand).lerp(dropHand, drop).lerp(contactHand, contact).lerp(followHand, easeOutCubic(follow));
    rightElbow = rightShoulder.clone().lerp(rightHand, 0.54).addScaledVector(right, 0.06).setY((rightShoulder.y + rightHand.y) * 0.5 - 0.02);
    paddleCenter = rightHand.clone().addScaledVector(forward, 0.18 + 0.1 * contact).addScaledVector(right, -0.03 * follow).setY(rightHand.y + 0.04 + 0.12 * contact);
    faceNormal = forward.clone().multiplyScalar(-0.75).addScaledVector(right, -0.3).add(new THREE.Vector3(0, -0.18, 0)).normalize();
    wristPronation = -0.75 * load + 1.3 * contact - 0.32 * follow;
  } else if (action === "backhand") {
    const prep = clamp01(tRaw / 0.25);
    const contact = clamp01((tRaw - 0.36) / 0.18);
    const follow = clamp01((tRaw - 0.55) / 0.35);
    const sideOffset = clamp(ball.pos.x - player.pos.x, -0.28, 0.16);

    torsoYaw = 0.25 * prep - 0.42 * contact;
    torsoLean = 0.14;
    shoulderLift = 0.03;

    const prepHand = rightShoulder.clone().addScaledVector(right, -0.18 + sideOffset).addScaledVector(forward, 0.12).setY(CFG.tableY + 0.2);
    const contactHand = ball.pos.clone().addScaledVector(forward, -0.06).setY(clamp(ball.pos.y - 0.02, CFG.tableY + 0.1, CFG.tableY + 0.42));
    const followHand = rightShoulder.clone().addScaledVector(right, 0.12).addScaledVector(forward, 0.42).setY(CFG.tableY + 0.38);
    rightHand.copy(prepHand).lerp(contactHand, contact).lerp(followHand, easeOutCubic(follow));
    rightElbow = rightShoulder.clone().lerp(rightHand, 0.5).addScaledVector(right, -0.1).setY((rightShoulder.y + rightHand.y) * 0.52);
    paddleCenter = rightHand.clone().addScaledVector(forward, 0.16).addScaledVector(right, -0.02).setY(rightHand.y + 0.04);
    faceNormal = forward.clone().multiplyScalar(-0.88).addScaledVector(right, -0.22).add(new THREE.Vector3(0, 0.06, 0)).normalize();
    leftElbow = leftShoulder.clone().addScaledVector(right, -0.16).addScaledVector(forward, 0.18).setY(CFG.tableY + 0.36);
    leftHand = leftShoulder.clone().addScaledVector(right, -0.22).addScaledVector(forward, 0.34).setY(CFG.tableY + 0.2);
    wristPronation = -0.85 + 0.7 * contact;
  } else {
    const prep = clamp01(tRaw / 0.24);
    const contact = clamp01((tRaw - 0.38) / 0.18);
    const follow = clamp01((tRaw - 0.56) / 0.42);
    const sideOffset = clamp(ball.pos.x - player.pos.x, -0.15, 0.32);

    torsoYaw = -0.5 * prep + 0.75 * contact - 0.15 * follow;
    torsoLean = 0.16 - 0.06 * contact;
    shoulderLift = 0.09 * contact;

    const prepHand = rightShoulder.clone().addScaledVector(right, 0.34 + sideOffset).addScaledVector(forward, -0.14).setY(CFG.tableY + 0.18);
    const contactHand = ball.pos.clone().addScaledVector(forward, -0.07).addScaledVector(right, -0.02).setY(clamp(ball.pos.y - 0.03, CFG.tableY + 0.1, CFG.tableY + 0.42));
    const followHand = base.clone().addScaledVector(right, -0.24).addScaledVector(forward, 0.35).setY(CFG.tableY + 0.62);

    rightHand.copy(prepHand).lerp(contactHand, contact).lerp(followHand, easeOutCubic(follow));
    rightElbow = rightShoulder.clone().lerp(rightHand, 0.5).addScaledVector(right, 0.09 * (1 - follow)).setY((rightShoulder.y + rightHand.y) * 0.5 + 0.03);
    paddleCenter = rightHand.clone().addScaledVector(forward, 0.16).addScaledVector(right, 0.02).setY(rightHand.y + 0.04 + 0.12 * follow);
    faceNormal = forward.clone().multiplyScalar(-0.82).addScaledVector(right, 0.16).add(new THREE.Vector3(0, 0.1 + 0.18 * contact, 0)).normalize();

    leftElbow = leftShoulder.clone().addScaledVector(right, -0.18).addScaledVector(forward, 0.14).setY(CFG.tableY + 0.38);
    leftHand = leftShoulder.clone().addScaledVector(right, -0.28 + 0.18 * follow).addScaledVector(forward, 0.26).setY(CFG.tableY + 0.2 + 0.28 * follow);
    wristPronation = 0.55 * prep + 0.9 * contact + 0.22 * follow;
  }

  return {
    rightShoulder,
    rightElbow,
    rightHand,
    leftShoulder,
    leftElbow,
    leftHand,
    paddleGrip: rightHand.clone(),
    paddleCenter,
    faceNormal,
    torsoYaw,
    torsoLean,
    shoulderLift,
    wristPronation,
    crouch,
  };
}

function updateSkeletonTorso(player: HumanRig, pose: StrokePose) {
  addLocalRotation(player.bones.spine, pose.torsoLean, pose.torsoYaw * 0.28, pose.torsoYaw * 0.08);
  addLocalRotation(player.bones.chest, pose.torsoLean * 0.6, pose.torsoYaw * 0.44, pose.torsoYaw * 0.18);
  addLocalRotation(player.bones.neck, -pose.torsoLean * 0.35, -pose.torsoYaw * 0.16, 0);
}

function updateModelRigWithHands(player: HumanRig, pose: StrokePose) {
  if (!player.model) return false;
  restoreRestPose(player);
  updateSkeletonTorso(player, pose);
  const rightSolved = solveTwoBoneArm(player.rightArmChain, pose.rightShoulder, pose.rightElbow, pose.rightHand);
  const leftSolved = solveTwoBoneArm(player.leftArmChain, pose.leftShoulder, pose.leftElbow, pose.leftHand);
  if (rightSolved) {
    addLocalRotation(player.bones.rightHand, 0.03, pose.wristPronation, -0.1);
    addLocalRotation(player.bones.rightForeArm, 0, 0.04, pose.shoulderLift * 0.18);
  }
  if (leftSolved) addLocalRotation(player.bones.leftForeArm, -0.03, 0, 0.04);
  player.modelRoot.updateMatrixWorld(true);
  return rightSolved;
}

function setPaddlePose(paddle: THREE.Group, grip: THREE.Vector3, center: THREE.Vector3, faceNormal: THREE.Vector3) {
  const yAxis = center.clone().sub(grip).normalize();
  let zAxis = faceNormal.clone().normalize();
  zAxis.addScaledVector(yAxis, -zAxis.dot(yAxis)).normalize();
  if (zAxis.lengthSq() < 1e-8) zAxis = new THREE.Vector3(0, 0, 1);
  const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis).normalize();
  zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();

  const m = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
  paddle.position.copy(grip);
  paddle.quaternion.setFromRotationMatrix(m);
}

function updatePoseAndPaddle(player: HumanRig, ball: BallState) {
  const pose = tableTennisPose(player, ball);
  const handSolved = updateModelRigWithHands(player, pose);
  const vectorToBlade = pose.paddleCenter.clone().sub(pose.paddleGrip);
  const bladeDir = vectorToBlade.clone().normalize();

  if (handSolved && player.bones.rightHand) {
    const wrist = getWorldPos(player.bones.rightHand);
    const palmGrip = wrist.clone().addScaledVector(bladeDir, CFG.paddlePalmOffset);
    setPaddlePose(player.paddle, palmGrip, palmGrip.clone().add(vectorToBlade), pose.faceNormal);
  } else {
    setPaddlePose(player.paddle, pose.paddleGrip, pose.paddleCenter, pose.faceNormal);
  }
  player.paddle.visible = true;
}

function ballisticVelocity(from: THREE.Vector3, target: THREE.Vector3, flight: number) {
  return new THREE.Vector3(
    (target.x - from.x) / flight,
    (target.y - from.y + 0.5 * CFG.gravity * flight * flight) / flight,
    (target.z - from.z) / flight
  );
}

function makeUserHitFromSwipe(startX: number, startY: number, endX: number, endY: number, isServe: boolean): DesiredHit {
  const dx = endX - startX;
  const dy = endY - startY;
  const power = clamp(Math.hypot(dx, dy) / 210, isServe ? 0.42 : 0.2, 1);
  const lateral = clamp(dx / 170, -1, 1);
  const depth = clamp((-dy + 42) / 255, 0, 1);
  const targetX = clamp(lateral * (TABLE_HALF_W - 0.13), -TABLE_HALF_W + 0.12, TABLE_HALF_W - 0.12);
  const targetZ = isServe ? -lerp(0.38, TABLE_HALF_L - 0.32, depth) : -lerp(0.32, TABLE_HALF_L - 0.15, depth);
  return {
    target: new THREE.Vector3(targetX, BALL_SURFACE_Y, targetZ),
    power,
    topSpin: clamp(0.35 + depth * 0.65 + power * 0.25, 0.22, 1.15),
    sideSpin: lateral,
  };
}

function makeAiServeTarget(): DesiredHit {
  const sideSpin = clamp((Math.random() - 0.5) * 1.7, -0.95, 0.95);
  const shortServe = Math.random() < 0.56;
  const wide = Math.random() < 0.45;
  const x = clamp((wide ? Math.sign(Math.random() - 0.5) * 0.58 : (Math.random() - 0.5) * 0.45), -TABLE_HALF_W + 0.1, TABLE_HALF_W - 0.1);
  const z = shortServe ? lerp(0.32, 0.52, Math.random()) : lerp(TABLE_HALF_L - 0.35, TABLE_HALF_L - 0.16, Math.random());
  return {
    target: new THREE.Vector3(x, BALL_SURFACE_Y, z),
    power: shortServe ? 0.48 + Math.random() * 0.12 : 0.62 + Math.random() * 0.18,
    topSpin: shortServe ? 0.24 + Math.random() * 0.28 : 0.62 + Math.random() * 0.35,
    sideSpin,
    tactic: "serve",
  };
}

function makeAiTarget(near: HumanRig, ball: BallState): DesiredHit {
  const pressure = clamp01((-ball.pos.z + TABLE_HALF_L) / CFG.tableL);
  const nearRecoverX = clamp(near.pos.x, -0.75, 0.75);
  const highBall = ball.pos.y > CFG.tableY + 0.34;
  const lowBall = ball.pos.y < CFG.tableY + 0.16;
  let tactic: AiTactic;
  const roll = Math.random();
  if (lowBall) tactic = roll < 0.62 ? "push" : "wide";
  else if (highBall) tactic = roll < 0.72 ? "loop" : "drive";
  else tactic = roll < 0.38 ? "wide" : roll < 0.7 ? "body" : "drive";

  let x = 0;
  let z = 0.92;
  let power = 0.58;
  let topSpin = 0.75;
  let sideSpin = clamp((Math.random() - 0.5) * 0.8, -0.8, 0.8);

  if (tactic === "push") {
    x = clamp(-nearRecoverX * 0.42 + (Math.random() - 0.5) * 0.24, -TABLE_HALF_W + 0.14, TABLE_HALF_W - 0.14);
    z = lerp(0.26, 0.58, Math.random());
    power = 0.34 + Math.random() * 0.16;
    topSpin = -0.28;
    sideSpin *= 0.45;
  } else if (tactic === "wide") {
    const openSide = near.pos.x > 0 ? -1 : 1;
    x = clamp(openSide * (TABLE_HALF_W - 0.14), -TABLE_HALF_W + 0.1, TABLE_HALF_W - 0.1);
    z = lerp(0.74, TABLE_HALF_L - 0.16, Math.random());
    power = 0.66 + pressure * 0.18;
    topSpin = 0.86 + pressure * 0.25;
    sideSpin = openSide * 0.6;
  } else if (tactic === "body") {
    x = clamp(near.pos.x * 0.78 + (Math.random() - 0.5) * 0.12, -TABLE_HALF_W + 0.12, TABLE_HALF_W - 0.12);
    z = lerp(0.62, 0.95, Math.random());
    power = 0.62 + pressure * 0.2;
    topSpin = 0.68 + pressure * 0.22;
  } else if (tactic === "loop") {
    x = clamp(-nearRecoverX * 0.72 + (Math.random() - 0.5) * 0.18, -TABLE_HALF_W + 0.12, TABLE_HALF_W - 0.12);
    z = lerp(TABLE_HALF_L - 0.34, TABLE_HALF_L - 0.13, Math.random());
    power = 0.78 + pressure * 0.14;
    topSpin = 1.05 + pressure * 0.22;
    sideSpin *= 0.35;
  } else {
    x = clamp(-nearRecoverX * 0.56 + (Math.random() - 0.5) * 0.34, -TABLE_HALF_W + 0.12, TABLE_HALF_W - 0.12);
    z = lerp(0.68, TABLE_HALF_L - 0.18, Math.random());
    power = 0.62 + pressure * 0.2;
    topSpin = 0.72 + pressure * 0.2;
  }

  return {
    target: new THREE.Vector3(x, BALL_SURFACE_Y, z),
    power: clamp(power, 0.32, 0.96),
    topSpin: clamp(topSpin, -0.35, 1.25),
    sideSpin: clamp(sideSpin, -1, 1),
    tactic,
  };
}

function performHit(player: HumanRig, ball: BallState, hit: DesiredHit, serve = false) {
  const dirZ = player.side === "near" ? -1 : 1;
  const target = hit.target.clone();
  target.x = clamp(target.x, -TABLE_HALF_W + 0.1, TABLE_HALF_W - 0.1);
  target.z = player.side === "near" ? clamp(target.z, -TABLE_HALF_L + 0.12, -0.18) : clamp(target.z, 0.18, TABLE_HALF_L - 0.12);
  target.y = BALL_SURFACE_Y;

  if (serve) {
    ball.pos.copy(serveContactPosition(player));
    const ownBounce = new THREE.Vector3(clamp(target.x * 0.45, -TABLE_HALF_W + 0.12, TABLE_HALF_W - 0.12), BALL_SURFACE_Y, dirZ * -0.56);
    const flight = clamp(0.22 + (1 - hit.power) * 0.09, 0.22, 0.32);
    ball.vel.copy(ballisticVelocity(ball.pos, ownBounce, flight));
    ball.spin.set(-dirZ * (46 + hit.topSpin * 42), hit.sideSpin * 78, hit.sideSpin * 8);
    ball.phase = { kind: "serve", server: player.side, stage: "own" };
  } else {
    ball.pos.y = clamp(ball.pos.y, CFG.tableY + 0.08, CFG.tableY + 0.48);
    const dist = Math.hypot(target.x - ball.pos.x, target.z - ball.pos.z);
    const speedScale = Math.max(1, TABLE_SCALE_FACTOR * 0.85);
    const flight = clamp(dist / ((3.45 + hit.power * 3.35) * speedScale), 0.18, 0.48);
    ball.vel.copy(ballisticVelocity(ball.pos, target, flight));
    ball.spin.set(-dirZ * (62 + hit.topSpin * 92), hit.sideSpin * 104, hit.sideSpin * 12);
    ball.phase = { kind: "rally" };
  }

  ball.lastHitBy = player.side;
  ball.bounceSide = null;
  ball.bounceCount = 0;
  ball.mesh.position.copy(ball.pos);
  player.cooldown = serve ? 0.34 : 0.2;
  player.hitThisSwing = true;
}

function startSwing(player: HumanRig, desiredHit: DesiredHit, action: StrokeAction) {
  player.action = action;
  player.swingT = 0.001;
  player.desiredHit = desiredHit;
  player.hitThisSwing = false;
}

function canReachBall(player: HumanRig, ball: BallState) {
  if (player.cooldown > 0 || ball.lastHitBy === player.side || ball.lastHitBy === null) return false;
  if (sideOfZ(ball.pos.z) !== player.side) return false;
  if (ball.bounceSide !== player.side || ball.bounceCount < 1) return false;
  if (ball.pos.y < CFG.tableY + 0.06 || ball.pos.y > CFG.tableY + 0.62) return false;
  const pose = tableTennisPose(player, ball);
  const paddleReach = pose.paddleCenter.distanceTo(ball.pos) < 0.24 * PADDLE_SCALE_FACTOR;
  return paddleReach;
}

function updatePlayerMotion(player: HumanRig, ball: BallState, dt: number) {
  const to = player.target.clone().sub(player.pos);
  const dist = to.length();
  const maxStep = player.speed * dt;
  if (dist > 0.0001) player.pos.addScaledVector(to.normalize(), Math.min(maxStep, dist));

  player.pos.x = clamp(player.pos.x, -TABLE_HALF_W * 0.82, TABLE_HALF_W * 0.82);
  if (player.side === "near") player.pos.z = clamp(player.pos.z, TABLE_HALF_L + 0.18, TABLE_HALF_L + 0.9);
  else player.pos.z = clamp(player.pos.z, -TABLE_HALF_L - 0.9, -TABLE_HALF_L - 0.18);

  let face: THREE.Vector3;
  if (ball.lastHitBy === null && ball.phase.kind === "serve" && ball.phase.server === player.side) face = new THREE.Vector3(0.12, 0, player.side === "near" ? -1 : 1).normalize();
  else face = ball.pos.clone().sub(player.pos).setY(0);
  if (face.lengthSq() < 0.001) face.set(0, 0, player.side === "near" ? -1 : 1);
  face.normalize();

  const targetYaw = yawFromForward(face);
  let delta = targetYaw - player.yaw;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  player.yaw += delta * (1 - Math.exp(-10 * dt));

  player.root.position.copy(player.pos);
  player.modelRoot.position.copy(player.pos);
  player.modelRoot.rotation.y = player.yaw;

  if (player.model) {
    const runAmount = clamp01(dist / 0.18);
    const bob = Math.sin(performance.now() * 0.015) * 0.014 * runAmount;
    player.model.position.y = bob - (player.action === "ready" ? 0.012 : 0);
    player.model.rotation.x = 0.025 * runAmount;
  }

  player.cooldown = Math.max(0, player.cooldown - dt);
  if (player.swingT > 0) {
    const duration = player.action === "serve" ? CFG.serveDuration : player.action === "backhand" ? CFG.backhandDuration : CFG.swingDuration;
    player.swingT += dt / duration;
    if (player.swingT >= 1) {
      player.swingT = 0;
      player.action = "ready";
      player.desiredHit = null;
      player.hitThisSwing = false;
    }
  }
}

function predictNextTableBounce(ball: BallState) {
  const p = ball.pos.clone();
  const v = ball.vel.clone();
  const dt = 1 / 90;
  for (let i = 0; i < 160; i++) {
    const magnus = ball.spin.clone().cross(v).multiplyScalar(CFG.magnus);
    v.y += (-CFG.gravity + magnus.y) * dt;
    v.x += magnus.x * dt;
    v.z += magnus.z * dt;
    p.addScaledVector(v, dt);
    if (p.y <= BALL_SURFACE_Y && isOverTable(p.x, p.z, 0.02)) return p;
  }
  return p;
}

function chooseServerAfterScore(nearScore: number, farScore: number): PlayerSide {
  const total = nearScore + farScore;
  return Math.floor(total / 2) % 2 === 0 ? "near" : "far";
}

export default function MobileRealisticTableTennisGame() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hud, setHud] = useState<HudState>({ nearScore: 0, farScore: 0, status: "Swipe up to serve", power: 0, spin: 0 });
  const hudRef = useRef(hud);
  const controlRef = useRef<ControlState>({ active: false, pointerId: null, startX: 0, startY: 0, lastX: 0, lastY: 0, startPlayer: new THREE.Vector3() });
  const [menuOpen, setMenuOpen] = useState(false);
  const [graphicsId, setGraphicsId] = useState<'performance' | 'balanced' | 'ultra'>(() => 'balanced');
  const accountId = typeof window !== "undefined" ? window.localStorage.getItem("accountId") || "guest" : "guest";
  const [inventory] = useState(() => getChessBattleInventory(accountId));
  const unlockedHumanCharacters = useMemo(
    () =>
      CHESS_HUMAN_CHARACTER_OPTIONS.filter((option) =>
        isChessOptionUnlocked("humanCharacter", option.id, inventory)
      ),
    [inventory]
  );
  const unlockedHdris = useMemo(
    () =>
      POOL_ROYALE_HDRI_VARIANTS.filter((option) =>
        isChessOptionUnlocked("environmentHdri", option.id, inventory)
      ),
    [inventory]
  );
  const [selectedHumanCharacterId, setSelectedHumanCharacterId] = useState<string>("");
  const [selectedHdriId, setSelectedHdriId] = useState<string>("");

  useEffect(() => { hudRef.current = hud; }, [hud]);
  useEffect(() => {
    const fallbackHuman = unlockedHumanCharacters[0]?.id || CHESS_HUMAN_CHARACTER_OPTIONS[0]?.id || "default";
    const fallbackHdri = unlockedHdris[0]?.id || POOL_ROYALE_HDRI_VARIANTS[0]?.id || "colorfulStudio";
    const savedHuman = typeof window !== "undefined" ? window.localStorage.getItem("tableTennisSelectedHumanCharacter") : null;
    const savedHdri = typeof window !== "undefined" ? window.localStorage.getItem("tableTennisSelectedHdri") : null;
    setSelectedHumanCharacterId(
      savedHuman && unlockedHumanCharacters.some((entry) => entry.id === savedHuman) ? savedHuman : fallbackHuman
    );
    setSelectedHdriId(savedHdri && unlockedHdris.some((entry) => entry.id === savedHdri) ? savedHdri : fallbackHdri);
  }, [unlockedHdris, unlockedHumanCharacters]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (selectedHumanCharacterId) window.localStorage.setItem("tableTennisSelectedHumanCharacter", selectedHumanCharacterId);
    if (selectedHdriId) window.localStorage.setItem("tableTennisSelectedHdri", selectedHdriId);
  }, [selectedHdriId, selectedHumanCharacterId]);


  const selectedHumanOption = useMemo(
    () => unlockedHumanCharacters.find((option) => option.id === selectedHumanCharacterId) || unlockedHumanCharacters[0],
    [selectedHumanCharacterId, unlockedHumanCharacters]
  );
  const selectedHdriOption = useMemo(
    () => unlockedHdris.find((option) => option.id === selectedHdriId) || unlockedHdris[0],
    [selectedHdriId, unlockedHdris]
  );

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setClearColor(0x091014, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();

    const scene = new THREE.Scene();
    scene.fog = null;
    let activeEnvMap: THREE.Texture | null = null;
    const hdriLoader = new RGBELoader().setDataType(THREE.HalfFloatType).setCrossOrigin("anonymous");
    const hdriCandidateUrls = selectedHdriOption?.assetId ? [
      `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/4k/${selectedHdriOption.assetId}_4k.hdr`,
      `https://dl.polyhaven.org/file/ph-assets/HDRIs/exr/4k/${selectedHdriOption.assetId}_4k.exr`,
      ...DEFAULT_HDRI_URLS
    ] : DEFAULT_HDRI_URLS;
    const loadHdri = (idx = 0) => {
      const url = hdriCandidateUrls[idx];
      if (!url) return;
      hdriLoader.load(url, (hdrTex) => {
        const env = pmrem.fromEquirectangular(hdrTex).texture;
        hdrTex.dispose();
        if (activeEnvMap) activeEnvMap.dispose();
        activeEnvMap = env;
        scene.environment = env;
        scene.background = env;
        scene.backgroundBlurriness = 0;
        scene.backgroundIntensity = 1.0;
        scene.environmentIntensity = 1.0;
      }, undefined, () => loadHdri(idx + 1));
    };
    loadHdri();

    const camera = new THREE.PerspectiveCamera(46, 1, 0.03, 36);
    const cameraTarget = new THREE.Vector3(0, CFG.tableY + 0.1, -0.05);

    scene.add(new THREE.AmbientLight(0xffffff, 0.64));
    scene.add(new THREE.HemisphereLight(0xffffff, 0x263f4b, 0.8));
    const key = new THREE.DirectionalLight(0xffffff, 1.55);
    key.position.set(-2.8, 4.6, 3.7);
    key.castShadow = true;
    key.shadow.mapSize.width = 2048;
    key.shadow.mapSize.height = 2048;
    key.shadow.camera.near = 0.4;
    key.shadow.camera.far = 12;
    key.shadow.camera.left = -3.8;
    key.shadow.camera.right = 3.8;
    key.shadow.camera.top = 4.5;
    key.shadow.camera.bottom = -4.5;
    scene.add(key);

    const rim = new THREE.DirectionalLight(0xb8e6ff, 0.55);
    rim.position.set(2.4, 2.1, -3.1);
    scene.add(rim);

    addTable(scene, renderer);

    const humanModelUrl = selectedHumanOption?.modelUrls?.[0];
    const nearPlayer = addHuman(scene, renderer, "near", new THREE.Vector3(0, 0, TABLE_HALF_L + 1.05), 0xff6b2e, humanModelUrl);
    const farPlayer = addHuman(scene, renderer, "far", new THREE.Vector3(0, 0, -TABLE_HALF_L - 1.05), 0x4ab7ff, humanModelUrl);
    const players: Record<PlayerSide, HumanRig> = { near: nearPlayer, far: farPlayer };
    const ball = createBall();
    scene.add(ball.mesh);

    let currentServer: PlayerSide = "near";
    let aiServeWindup = 0;
    resetBallForServe(ball, nearPlayer);

    const aimGhost = new THREE.Mesh(
      new THREE.RingGeometry(0.07, 0.09, 40),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, side: THREE.DoubleSide })
    );
    aimGhost.rotation.x = -Math.PI / 2;
    aimGhost.position.set(0, CFG.tableY + 0.009, -0.72);
    scene.add(aimGhost);

    const playerGhost = new THREE.Mesh(
      new THREE.RingGeometry(0.18, 0.22, 38),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.24, side: THREE.DoubleSide })
    );
    playerGhost.rotation.x = -Math.PI / 2;
    playerGhost.position.copy(nearPlayer.target).setY(0.035);
    scene.add(playerGhost);

    let frameId = 0;
    let last = performance.now();
    let pointLock = false;
    let pointLockT = 0;
    const shotFx = new Audio("/assets/sounds/freesound_community-ping-pong-ball-100140.mp3");
    shotFx.volume = 0.48;
    const bounceFx = new Audio("/assets/sounds/freesound_community-ping-pong-ball-100140.mp3");
    bounceFx.volume = 0.28;
    bounceFx.playbackRate = 1.08;
    const netFx = new Audio("/assets/sounds/snooker-cue-put-on-table-81295.mp3");
    netFx.volume = 0.22;
    netFx.playbackRate = 1.4;
    const scoreFx = new Audio("/assets/sounds/successful.mp3");
    scoreFx.volume = 0.26;
    const playFx = (fx: HTMLAudioElement) => { fx.currentTime = 0; fx.play().catch(() => {}); };
    const replayFrames: THREE.Vector3[] = [];
    let replayT = 0;

    const setHudSafe = (patch: Partial<HudState>) => setHud((prev) => ({ ...prev, ...patch }));

    const awardPoint = (winner: PlayerSide, reason: PointReason) => {
      if (pointLock) return;
      pointLock = true;
      pointLockT = 0.86;
      replayT = 1.2;
      const prev = hudRef.current;
      const next = {
        nearScore: prev.nearScore + (winner === "near" ? 1 : 0),
        farScore: prev.farScore + (winner === "far" ? 1 : 0),
      };
      currentServer = chooseServerAfterScore(next.nearScore, next.farScore);
      aiServeWindup = 0;
      const reasonText =
        reason === "out" ? "Out" :
        reason === "doubleBounce" ? "Second bounce" :
        reason === "net" ? "Net" :
        reason === "wrongSide" ? "Wrong side" :
        "Miss";
      setHud({ ...prev, ...next, status: `${reasonText}: ${winner === "near" ? "You" : "AI"} scores`, power: 0, spin: 0 });
      playFx(scoreFx);
    };

    const resize = () => {
      const w = Math.max(1, host.clientWidth);
      const h = Math.max(1, host.clientHeight);
      renderer.setSize(w, h, false);
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      camera.aspect = w / h;
      camera.fov = camera.aspect < 0.72 ? 48 : 42;
      camera.position.set(0, camera.aspect < 0.72 ? 5.9 : 5.0, camera.aspect < 0.72 ? 7.0 : 6.1);
      camera.lookAt(cameraTarget);
      camera.updateProjectionMatrix();
    };
    const applyGraphicsPreset = () => {
      const preset = graphicsId === 'performance'
        ? { pixelRatio: 1.2, shadows: false, envIntensity: 0.8 }
        : graphicsId === 'ultra'
          ? { pixelRatio: 2, shadows: true, envIntensity: 1.2 }
          : { pixelRatio: 1.6, shadows: true, envIntensity: 1.0 };
      renderer.setPixelRatio(Math.min(preset.pixelRatio, window.devicePixelRatio || 1));
      renderer.shadowMap.enabled = preset.shadows;
      scene.environmentIntensity = preset.envIntensity;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (currentServer === "far" && ball.lastHitBy === null) return;
      if (controlRef.current.active) return;
      canvas.setPointerCapture(e.pointerId);
      controlRef.current = {
        active: true,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        startPlayer: nearPlayer.target.clone(),
      };
      setHudSafe({ status: ball.lastHitBy === null ? "Aim legal serve, release" : "Drag to move, release to hit", power: 0, spin: 0 });
    };

    const onPointerMove = (e: PointerEvent) => {
      const control = controlRef.current;
      if (!control.active || control.pointerId !== e.pointerId) return;
      control.lastX = e.clientX;
      control.lastY = e.clientY;
      const dx = e.clientX - control.startX;
      const dy = e.clientY - control.startY;
      nearPlayer.target.x = clamp(control.startPlayer.x + dx * 0.0047, -TABLE_HALF_W * 0.82, TABLE_HALF_W * 0.82);
      nearPlayer.target.z = clamp(control.startPlayer.z + dy * 0.0032, TABLE_HALF_L + 0.18, TABLE_HALF_L + 0.9);
      setHudSafe({ power: clamp01(Math.hypot(dx, dy) / 210), spin: clamp(dx / 170, -1, 1) });

      const plan = makeUserHitFromSwipe(control.startX, control.startY, e.clientX, e.clientY, ball.lastHitBy === null);
      aimGhost.position.x += (plan.target.x - aimGhost.position.x) * 0.35;
      aimGhost.position.z += (plan.target.z - aimGhost.position.z) * 0.35;
      (aimGhost.material as THREE.MeshBasicMaterial).opacity = 0.66;
    };

    const onPointerUp = (e: PointerEvent) => {
      const control = controlRef.current;
      if (!control.active || control.pointerId !== e.pointerId) return;
      canvas.releasePointerCapture(e.pointerId);
      control.active = false;
      control.pointerId = null;
      const isServe = ball.lastHitBy === null && currentServer === "near";
      const hit = makeUserHitFromSwipe(control.startX, control.startY, e.clientX, e.clientY, isServe);
      const sideBall = ball.pos.x - nearPlayer.pos.x;
      const action: StrokeAction = isServe ? "serve" : sideBall < -0.12 ? "backhand" : "forehand";
      startSwing(nearPlayer, hit, action);
      setHudSafe({ status: isServe ? "Legal toss and serve" : action === "backhand" ? "Backhand brush" : "Forehand topspin", power: 0, spin: 0 });
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("resize", resize);
    resize();
    applyGraphicsPreset();

    function updateServeTossLock() {
      for (const player of [nearPlayer, farPlayer]) {
        const serving = player.action === "serve" && player.swingT > 0 && !player.hitThisSwing && ball.lastHitBy === null && ball.phase.kind === "serve" && ball.phase.server === player.side;
        if (!serving) continue;
        if (player.swingT < CFG.serveContactT) {
          ball.pos.copy(serveTossPosition(player, player.swingT));
          ball.vel.set(0, 0, 0);
          ball.spin.set(0, 0, 0);
          ball.mesh.position.copy(ball.pos);
          return true;
        }
      }
      return false;
    }

    function handleTableBounce(side: PlayerSide) {
      const hitter = ball.lastHitBy;
      if (!hitter) return;
      if (ball.phase.kind === "serve") {
        const server = ball.phase.server;
        if (ball.phase.stage === "own") {
          if (side !== server) {
            awardPoint(opposite(server), "wrongSide");
            return;
          }
          ball.phase.stage = "opponent";
          ball.bounceSide = side;
          ball.bounceCount = 1;
          return;
        }
        if (side !== opposite(server)) {
          awardPoint(opposite(server), "wrongSide");
          return;
        }
        ball.phase = { kind: "rally" };
        ball.bounceSide = side;
        ball.bounceCount = 1;
        return;
      }

      const expected = opposite(hitter);
      if (side !== expected) {
        awardPoint(expected, "wrongSide");
        return;
      }
      if (ball.bounceSide === side && ball.bounceCount >= 1) {
        awardPoint(hitter, "doubleBounce");
        return;
      }
      ball.bounceSide = side;
      ball.bounceCount = 1;
    }

    function updateBall(dt: number) {
      const prev = ball.pos.clone();
      const magnus = ball.spin.clone().cross(ball.vel).multiplyScalar(CFG.magnus);
      ball.vel.x += (magnus.x - ball.vel.x * CFG.airDrag) * dt;
      ball.vel.y += (-CFG.gravity + magnus.y - ball.vel.y * CFG.airDrag * 0.45) * dt;
      ball.vel.z += (magnus.z - ball.vel.z * CFG.airDrag) * dt;
      ball.pos.addScaledVector(ball.vel, dt);
      ball.spin.multiplyScalar(Math.exp(-CFG.spinDecay * dt));

      if (ball.spin.length() > 0.01) {
        const spinAxis = ball.spin.clone().normalize();
        ball.mesh.rotateOnWorldAxis(spinAxis, ball.spin.length() * dt * 0.18);
      } else if (ball.vel.length() > 0.02) {
        const rollAxis = new THREE.Vector3(ball.vel.z, 0, -ball.vel.x);
        if (rollAxis.lengthSq() > 0.0001) ball.mesh.rotateOnWorldAxis(rollAxis.normalize(), (ball.vel.length() / CFG.ballR) * dt);
      }

      const crossedNet = (prev.z > 0 && ball.pos.z <= 0) || (prev.z < 0 && ball.pos.z >= 0) || Math.abs(ball.pos.z) < 0.01;
      if (crossedNet && Math.abs(ball.pos.x) <= TABLE_HALF_W + CFG.netPostOutside && ball.pos.y < CFG.tableY + CFG.netH + CFG.ballR * 0.6 && ball.lastHitBy) {
        ball.pos.z = ball.lastHitBy === "near" ? 0.025 : -0.025;
        ball.vel.z *= -0.24;
        ball.vel.y = Math.max(0.1, Math.abs(ball.vel.y) * 0.24);
        playFx(netFx);
        awardPoint(opposite(ball.lastHitBy), "net");
      }

      const descendingThroughSurface = prev.y > BALL_SURFACE_Y && ball.pos.y <= BALL_SURFACE_Y && ball.vel.y < 0;
      if (descendingThroughSurface && isOverTable(ball.pos.x, ball.pos.z, 0)) {
        ball.pos.y = BALL_SURFACE_Y;
        const side = sideOfZ(ball.pos.z);
        ball.vel.y = -ball.vel.y * CFG.tableRestitution;
        ball.vel.x *= CFG.tableFriction;
        ball.vel.z *= CFG.tableFriction;
        ball.vel.z += ball.spin.x * 0.0016;
        ball.vel.x += ball.spin.y * 0.0012;
        ball.spin.x *= 0.82;
        ball.spin.y *= 0.86;
        playFx(bounceFx);
        handleTableBounce(side);
      }

      if (ball.pos.y <= CFG.ballR && !isOverTable(ball.pos.x, ball.pos.z, 0.08) && ball.lastHitBy) {
        const hitter = ball.lastHitBy;
        const hadLegalBounce = ball.bounceSide === opposite(hitter) && ball.bounceCount >= 1;
        awardPoint(hadLegalBounce ? hitter : opposite(hitter), "out");
      }

      if ((Math.abs(ball.pos.x) > TABLE_HALF_W + 1.3 || Math.abs(ball.pos.z) > TABLE_HALF_L + 1.8 || ball.pos.y < -0.7) && ball.lastHitBy) {
        const hitter = ball.lastHitBy;
        const hadLegalBounce = ball.bounceSide === opposite(hitter) && ball.bounceCount >= 1;
        awardPoint(hadLegalBounce ? hitter : opposite(hitter), "out");
      }

      ball.mesh.position.copy(ball.pos);
      replayFrames.push(ball.pos.clone());
      if (replayFrames.length > 220) replayFrames.shift();
    }

    function updateAi(dt: number) {
      const home = new THREE.Vector3(0, 0, -TABLE_HALF_L - 1.05);

      if (ball.lastHitBy === null && ball.phase.kind === "serve" && ball.phase.server === "far") {
        farPlayer.target.lerp(new THREE.Vector3(0.08, 0, -TABLE_HALF_L - 1.05), 0.045);
        aiServeWindup += dt;
        if (aiServeWindup > 0.62 && farPlayer.swingT === 0) {
          startSwing(farPlayer, makeAiServeTarget(), "serve");
          setHudSafe({ status: "AI serve: spin and placement" });
          aiServeWindup = -99;
        }
        return;
      }

      const incoming = ball.lastHitBy === "near" && ball.pos.z < 0.22;
      if (incoming) {
        const landing = predictNextTableBounce(ball);
        const strikeZ = landing.z - (ball.pos.y > CFG.tableY + 0.35 ? 0.42 : 0.32);
        farPlayer.target.x = clamp(landing.x, -TABLE_HALF_W * 0.82, TABLE_HALF_W * 0.82);
        farPlayer.target.z = clamp(strikeZ, -TABLE_HALF_L - 1.45, -TABLE_HALF_L - 0.42);
      } else {
        farPlayer.target.lerp(home, 0.04);
      }

      if (incoming && canReachBall(farPlayer, ball) && farPlayer.swingT === 0) {
        const plan = makeAiTarget(nearPlayer, ball);
        const action: StrokeAction = ball.pos.x - farPlayer.pos.x > 0.1 || plan.tactic === "push" ? "backhand" : "forehand";
        startSwing(farPlayer, plan, action);
        const label = plan.tactic === "loop" ? "AI loop" : plan.tactic === "push" ? "AI short push" : plan.tactic === "wide" ? "AI wide angle" : plan.tactic === "body" ? "AI body shot" : "AI drive";
        setHudSafe({ status: label });
      }
    }

    function checkSwingHits() {
      for (const player of [nearPlayer, farPlayer]) {
        if (player.swingT <= 0 || player.hitThisSwing || !player.desiredHit) continue;
        if (player.action === "serve") {
          if (player.swingT >= CFG.serveContactT) {
            playFx(shotFx);
            performHit(player, ball, player.desiredHit, true);
            setHudSafe({ status: player.side === "near" ? "Serve: own side then AI side" : "AI served legally" });
          }
          continue;
        }
        if (player.swingT < CFG.hitWindowStart || player.swingT > CFG.hitWindowEnd) continue;
        if (canReachBall(player, ball)) {
          playFx(shotFx);
          performHit(player, ball, player.desiredHit, false);
          setHudSafe({ status: player.side === "near" ? "Return sent" : "AI returned" });
        } else if (player.side === "near" && player.swingT > CFG.hitWindowEnd - 0.02) {
          setHudSafe({ status: "Too early or too far from ball" });
        }
      }
    }

    function animate() {
      frameId = requestAnimationFrame(animate);
      const now = performance.now();
      const dtBase = Math.min(0.026, (now - last) / 1000);
      const dt = replayT > 0 ? dtBase * 0.35 : dtBase;
      last = now;
      if (replayT > 0) {
        replayT = Math.max(0, replayT - dtBase);
        setHudSafe({ status: "VAR Replay: slow motion review" });
      }

      if (pointLock) {
        pointLockT -= dt;
        if (pointLockT <= 0) {
          pointLock = false;
          nearPlayer.action = "ready";
          farPlayer.action = "ready";
          nearPlayer.swingT = 0;
          farPlayer.swingT = 0;
          nearPlayer.target.set(0, 0, TABLE_HALF_L + 1.05);
          farPlayer.target.set(0, 0, -TABLE_HALF_L - 1.05);
          resetBallForServe(ball, players[currentServer]);
          aiServeWindup = 0;
          setHudSafe({ status: currentServer === "near" ? "Your serve: swipe up" : "AI is serving", power: 0, spin: 0 });
        }
      } else {
        updateAi(dt);
        const lockedByServeToss = updateServeTossLock();
        checkSwingHits();
        if (!lockedByServeToss || ball.lastHitBy !== null) updateBall(dt);
      }

      updatePlayerMotion(nearPlayer, ball, dt);
      updatePlayerMotion(farPlayer, ball, dt);
      updatePoseAndPaddle(nearPlayer, ball);
      updatePoseAndPaddle(farPlayer, ball);

      playerGhost.position.x += (nearPlayer.target.x - playerGhost.position.x) * (1 - Math.exp(-14 * dt));
      playerGhost.position.z += (nearPlayer.target.z - playerGhost.position.z) * (1 - Math.exp(-14 * dt));
      (playerGhost.material as THREE.MeshBasicMaterial).opacity = controlRef.current.active ? 0.48 : 0.2;
      if (!controlRef.current.active) (aimGhost.material as THREE.MeshBasicMaterial).opacity *= 0.94;

      camera.lookAt(cameraTarget);
      renderer.render(scene, camera);
    }

    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      renderer.dispose();
      if (activeEnvMap) activeEnvMap.dispose();
      pmrem.dispose();
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose?.();
          const mat = mesh.material as THREE.Material | THREE.Material[];
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat?.dispose?.();
        }
      });
    };
  }, [graphicsId, selectedHdriOption?.assetId, selectedHumanOption?.id]);

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#091014", touchAction: "none", userSelect: "none" }}>
      <div ref={hostRef} style={{ position: "absolute", inset: 0 }}>
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }} />
      </div>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif" }}>
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          style={{ position: "absolute", top: 22, left: "50%", transform: "translateX(-50%)", pointerEvents: "auto", width: 42, height: 42, borderRadius: 999, border: "1px solid rgba(255,255,255,0.32)", background: "rgba(5,10,15,0.78)", color: "#fff", fontSize: 20, fontWeight: 800 }}
          aria-label={menuOpen ? "Close game settings menu" : "Open game settings menu"}
        >
          ☰
        </button>
        {menuOpen && (
          <div style={{ position: "absolute", top: 72, left: "50%", transform: "translateX(-50%)", pointerEvents: "auto", width: 248, maxHeight: "68vh", overflowY: "auto", borderRadius: 14, border: "1px solid rgba(255,255,255,0.24)", background: "rgba(5,10,15,0.9)", padding: 12, color: "#fff" }}>
            <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.9, marginBottom: 8 }}>Graphics</div>
            {[
              { id: "performance", label: "Performance" },
              { id: "balanced", label: "Balanced" },
              { id: "ultra", label: "Ultra" }
            ].map((option) => (
              <button key={option.id} type="button" onClick={() => setGraphicsId(option.id as any)} style={{ width: "100%", textAlign: "left", marginTop: 6, borderRadius: 10, border: "1px solid rgba(255,255,255,0.2)", background: graphicsId === option.id ? "rgba(255,255,255,0.24)" : "rgba(255,255,255,0.08)", color: "#fff", padding: "8px 10px", fontWeight: 700 }}>
                {option.label}
              </button>
            ))}
            <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.9, marginTop: 10 }}>Human Characters</div>
            {unlockedHumanCharacters.map((option) => (
              <button key={option.id} type="button" onClick={() => setSelectedHumanCharacterId(option.id)} style={{ width: "100%", textAlign: "left", marginTop: 6, borderRadius: 10, border: "1px solid rgba(255,255,255,0.2)", background: selectedHumanCharacterId === option.id ? "rgba(255,255,255,0.24)" : "rgba(255,255,255,0.08)", color: "#fff", padding: "8px 10px", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                {option.thumbnail ? <img src={option.thumbnail} alt={option.label} style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover" }} /> : <span>🙂</span>}
                <span>{option.label}</span>
              </button>
            ))}
            <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.9, marginTop: 10 }}>HDRI</div>
            {unlockedHdris.map((option) => (
              <button key={option.id} type="button" onClick={() => setSelectedHdriId(option.id)} style={{ width: "100%", textAlign: "left", marginTop: 6, borderRadius: 10, border: "1px solid rgba(255,255,255,0.2)", background: selectedHdriId === option.id ? "rgba(255,255,255,0.24)" : "rgba(255,255,255,0.08)", color: "#fff", padding: "8px 10px", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                {option.thumbnail ? <img src={option.thumbnail} alt={option.label} style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover" }} /> : <span>🌆</span>}
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        )}
        <div style={{ position: "absolute", left: "50%", top: 10, transform: "translateX(-50%)", color: "white", background: "rgba(0,0,0,0.58)", border: "1px solid rgba(255,255,255,0.16)", padding: "9px 13px", borderRadius: 16, fontSize: 13, fontWeight: 850, letterSpacing: 0.2, boxShadow: "0 12px 26px rgba(0,0,0,0.25)", textAlign: "center", minWidth: 178 }}>
          You {hud.nearScore} — {hud.farScore} AI
          <div style={{ fontSize: 11, fontWeight: 650, opacity: 0.84, marginTop: 2 }}>{hud.status}</div>
        </div>
      </div>
    </div>
  );
}
