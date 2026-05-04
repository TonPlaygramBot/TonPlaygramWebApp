"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { useLocation } from "react-router-dom";
import { POOL_ROYALE_DEFAULT_HDRI_ID, POOL_ROYALE_HDRI_VARIANTS } from "../../config/poolRoyaleInventoryConfig.js";
import { HUMAN_CHARACTER_OPTIONS } from "../../config/ludoBattleOptions.js";
import { getPoolRoyalInventory } from "../../utils/poolRoyalInventory.js";

type PlayerSide = "near" | "far";
type PointReason = "winner" | "out" | "doubleBounce" | "net";
type StrokeAction = "ready" | "forehand" | "serve";

type BallState = {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  spin: number;
  lastHitBy: PlayerSide | null;
  bounceSide: PlayerSide | null;
  bounceCount: number;
};

type ShotTechnique = "flat" | "topspin" | "slice";

type DesiredHit = { target: THREE.Vector3; power: number; technique?: ShotTechnique };

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
  racketGrip: THREE.Vector3;
  racketHead: THREE.Vector3;
  torsoYaw: number;
  torsoLean: number;
  shoulderLift: number;
  wristPronation: number;
};

type HumanRig = {
  side: PlayerSide;
  root: THREE.Group;
  modelRoot: THREE.Group;
  fallback: THREE.Group;
  racket: THREE.Group;
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

type HudState = { nearScore: number; farScore: number; status: string; power: number };

type ControlState = {
  active: boolean;
  pointerId: number | null;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  startPlayer: THREE.Vector3;
};

const HUMAN_URL = "https://threejs.org/examples/models/gltf/readyplayer.me.glb";
const UP = new THREE.Vector3(0, 1, 0);
const Y_AXIS = UP;

const TENNIS_HDRI_OPTION_IDS = Object.freeze(["suburbanGarden","countryTrackMidday","autumnPark","rooitouPark","rotesRathaus","veniceDawn2","piazzaSanMarco"]);

const CFG = {
  courtW: 5.85,
  doublesW: 7.1,
  courtL: 15.4,
  serviceLineZ: 2.85,
  netH: 0.64,
  ballR: 0.085,
  gravity: 9.8,
  airDrag: 0.078,
  bounceRestitution: 0.74,
  groundFriction: 0.86,
  minBallSpeed: 0.12,
  playerHeight: 1.82,
  playerSpeed: 5.9,
  aiSpeed: 8.2,
  reach: 1.12,
  swingDuration: 0.38,
  serveDuration: 0.86,
  hitWindowStart: 0.42,
  hitWindowEnd: 0.72,
  serveContactT: 0.72,
  playerVisualYawFix: Math.PI,
  serveNearBaselineZ: 6.4,
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const clamp01 = (v: number) => clamp(v, 0, 1);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => t * t * (3 - 2 * t);
const sideOfZ = (z: number): PlayerSide => (z >= 0 ? "near" : "far");
const opposite = (side: PlayerSide): PlayerSide => (side === "near" ? "far" : "near");

function material(color: number, roughness = 0.74, metalness = 0.02) {
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


function createGrassTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#2f7d3d";
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 28000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const g = 90 + Math.floor(Math.random() * 90);
    ctx.fillStyle = `rgba(${20 + Math.floor(Math.random() * 30)},${g},${20 + Math.floor(Math.random() * 25)},0.45)`;
    ctx.fillRect(x, y, 1, 3);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3.2, 6.4);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function addCourt(scene: THREE.Scene, options: { hideFloor?: boolean } = {}) {
  const group = new THREE.Group();
  scene.add(group);

  const hideFloor = !!options.hideFloor;
  const grassTex = new THREE.TextureLoader().load("https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/grass_field_01/grass_field_01_diff_1k.jpg");
  grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
  grassTex.repeat.set(3.2, 6.4);
  grassTex.colorSpace = THREE.SRGBColorSpace;
  const outerMat = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.96, metalness: 0 });
  const courtMat = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.93, metalness: 0, color: new THREE.Color(0x3f9f4f) });
  const serviceMat = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.9, metalness: 0, color: new THREE.Color(0x57b365) });
  const lineMat = material(0xf7f7f7, 0.42, 0.0);
  const netMat = transparentMaterial(0x111111, 0.36, 0.55);
  const netWhite = material(0xf7f7f7, 0.5, 0.0);
  const postMat = material(0x333333, 0.35, 0.25);

  if (!hideFloor) {
    addBox(group, [CFG.doublesW + 1.15, 0.035, CFG.courtL + 1.15], [0, -0.015, 0], outerMat);
    addBox(group, [CFG.courtW, 0.04, CFG.courtL], [0, 0.004, 0], courtMat);
    addBox(group, [CFG.courtW - 0.2, 0.043, CFG.serviceLineZ * 2], [0, 0.012, 0], serviceMat);
  }

  const y = 0.045;
  const thick = 0.045;
  const halfW = CFG.courtW / 2;
  const halfL = CFG.courtL / 2;

  addBox(group, [CFG.courtW + thick, thick, thick], [0, y, -halfL], lineMat);
  addBox(group, [CFG.courtW + thick, thick, thick], [0, y, halfL], lineMat);
  addBox(group, [thick, thick, CFG.courtL + thick], [-halfW, y, 0], lineMat);
  addBox(group, [thick, thick, CFG.courtL + thick], [halfW, y, 0], lineMat);
  addBox(group, [CFG.courtW, thick, thick], [0, y, -CFG.serviceLineZ], lineMat);
  addBox(group, [CFG.courtW, thick, thick], [0, y, CFG.serviceLineZ], lineMat);
  addBox(group, [thick, thick, CFG.serviceLineZ * 2], [0, y, 0], lineMat);
  addBox(group, [thick, thick, 0.38], [0, y, -halfL + 0.18], lineMat);
  addBox(group, [thick, thick, 0.38], [0, y, halfL - 0.18], lineMat);
  addBox(group, [thick, thick, CFG.courtL + thick], [-CFG.doublesW / 2, y, 0], transparentMaterial(0xffffff, 0.34));
  addBox(group, [thick, thick, CFG.courtL + thick], [CFG.doublesW / 2, y, 0], transparentMaterial(0xffffff, 0.34));

  const netBody = addBox(group, [CFG.doublesW + 0.35, CFG.netH, 0.025], [0, CFG.netH / 2, 0], netMat);
  addBox(group, [CFG.doublesW + 0.55, 0.052, 0.075], [0, CFG.netH + 0.025, 0], netWhite);
  addCylinder(group, 0.045, 0.052, CFG.netH + 0.36, [-(CFG.doublesW / 2 + 0.22), (CFG.netH + 0.36) / 2, 0], postMat, 22);
  addCylinder(group, 0.045, 0.052, CFG.netH + 0.36, [CFG.doublesW / 2 + 0.22, (CFG.netH + 0.36) / 2, 0], postMat, 22);
  for (let i = -5; i <= 5; i++) addBox(group, [0.012, CFG.netH * 0.92, 0.03], [(i * CFG.doublesW) / 10, CFG.netH * 0.46, 0.018], transparentMaterial(0xffffff, 0.28));
  for (let j = 1; j <= 3; j++) addBox(group, [CFG.doublesW + 0.12, 0.011, 0.032], [0, (j * CFG.netH) / 4, 0.019], transparentMaterial(0xffffff, 0.24));

  return { group, netBody };
}


function addStadiumBillboards(scene: THREE.Scene) {
  const boardGroup = new THREE.Group();
  scene.add(boardGroup);
  const banners = ["TONPLAYGRAM", "TENNIS PRO", "REAL SPEED", "LIVE ARENA"];
  const fontCanvas = document.createElement("canvas");
  fontCanvas.width = 512;
  fontCanvas.height = 128;
  const ctx = fontCanvas.getContext("2d");
  const makeTexture = (text: string, t: number) => {
    if (!ctx) return null;
    ctx.clearRect(0, 0, fontCanvas.width, fontCanvas.height);
    const grad = ctx.createLinearGradient(0, 0, fontCanvas.width, 0);
    grad.addColorStop(0, `hsl(${(t * 40) % 360} 85% 55%)`);
    grad.addColorStop(1, `hsl(${(180 + t * 65) % 360} 80% 45%)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, fontCanvas.width, fontCanvas.height);
    ctx.fillStyle = "rgba(255,255,255,0.94)";
    ctx.font = "bold 54px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, fontCanvas.width / 2, fontCanvas.height / 2);
    const texture = new THREE.CanvasTexture(fontCanvas);
    texture.needsUpdate = true;
    return texture;
  };
  const panels: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x0a0a0a, roughness: 0.4, metalness: 0.05 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), mat);
    const side = i % 2 === 0 ? 1 : -1;
    const lane = Math.floor(i / 2);
    mesh.position.set(side * (CFG.doublesW / 2 + 1.25), 0.95, -4.8 + lane * 4.8);
    mesh.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    boardGroup.add(mesh);
    panels.push(mesh);
  }
  return (elapsed: number) => {
    panels.forEach((panel, idx) => {
      const text = banners[(Math.floor(elapsed * 1.8 + idx) % banners.length + banners.length) % banners.length];
      const tex = makeTexture(text, elapsed + idx * 0.2);
      if (tex && panel.material instanceof THREE.MeshStandardMaterial) panel.material.map = tex;
      panel.position.y = 0.95 + Math.sin(elapsed * 2.1 + idx) * 0.03;
      panel.material.needsUpdate = true;
    });
  };
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

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 28, 20), skin);
  head.position.y = 1.62;
  g.add(head);
  addCylinder(g, 0.055, 0.06, 0.12, [0, 1.43, 0], skin, 18);
  const torso = addCylinder(g, 0.24, 0.31, 0.72, [0, 1.04, 0], shirt, 28);
  torso.scale.x = 0.78;
  const hips = addCylinder(g, 0.24, 0.25, 0.24, [0, 0.61, 0], shorts, 22);
  hips.scale.x = 0.9;
  const leftLeg = addCylinder(g, 0.07, 0.085, 0.63, [-0.13, 0.31, 0], shorts, 16);
  const rightLeg = addCylinder(g, 0.07, 0.085, 0.63, [0.13, 0.31, 0], shorts, 16);
  leftLeg.rotation.z = 0.06;
  rightLeg.rotation.z = -0.06;
  addBox(g, [0.23, 0.055, 0.34], [-0.13, 0.035, -0.04], shoe);
  addBox(g, [0.23, 0.055, 0.34], [0.13, 0.035, -0.04], shoe);
  enableShadow(g);
  return g;
}

function createRacket(color: number) {
  const g = new THREE.Group();
  const handleMat = material(0x1d1d1f, 0.55, 0.1);
  const frameMat = material(color, 0.36, 0.45);
  const stringMat = transparentMaterial(0xffffff, 0.5, 0.42);

  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.42, 16), handleMat);
  handle.position.y = -0.11;
  enableShadow(handle);
  g.add(handle);

  const throatA = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.29, 12), frameMat);
  throatA.position.set(-0.048, 0.22, 0);
  throatA.rotation.z = -0.18;
  enableShadow(throatA);
  g.add(throatA);
  const throatB = throatA.clone();
  throatB.position.x *= -1;
  throatB.rotation.z *= -1;
  g.add(throatB);

  const head = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.019, 12, 52), frameMat);
  head.scale.y = 1.34;
  head.position.y = 0.56;
  enableShadow(head);
  g.add(head);

  const stringPlane = new THREE.Mesh(new THREE.CircleGeometry(0.182, 36), stringMat);
  stringPlane.scale.y = 1.3;
  stringPlane.position.y = 0.56;
  g.add(stringPlane);
  for (let i = -3; i <= 3; i++) {
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.48, 0.005), stringMat);
    v.position.set(i * 0.052, 0.56, 0.007);
    g.add(v);
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.005, 0.005), stringMat);
    h.position.set(0, 0.56 + i * 0.065, 0.007);
    g.add(h);
  }
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
  const target = handTarget.clone();
  const toTarget = target.clone().sub(rootPos);
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
  rotateBoneSoChildPointsTo(fore, hand, target.clone().sub(getWorldPos(fore)).normalize());
  hand.updateMatrixWorld(true);
  return true;
}

function addLocalRotation(bone: THREE.Bone | undefined, x: number, y: number, z: number) {
  if (!bone) return;
  bone.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, "XYZ")));
}

function addHuman(scene: THREE.Scene, side: PlayerSide, start: THREE.Vector3, accent: number, modelUrl = HUMAN_URL): HumanRig {
  const root = new THREE.Group();
  const modelRoot = new THREE.Group();
  const fallback = createFallbackHuman(accent);
  const racket = createRacket(accent);

  root.position.copy(start);
  modelRoot.position.copy(start);
  modelRoot.add(fallback);
  scene.add(root, modelRoot, racket);

  const rig: HumanRig = {
    side,
    root,
    modelRoot,
    fallback,
    racket,
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
  modelRoot.scale.setScalar(0.9);
  racket.visible = false;

  new GLTFLoader().setCrossOrigin("anonymous").load(
    modelUrl,
    (gltf) => {
      const model = gltf.scene;
      normalizeHuman(model, CFG.playerHeight);
      model.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh || !mesh.material) return;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((m) => {
          const mat = m as THREE.MeshStandardMaterial;
          if ((mat as any).map) (mat as any).map.colorSpace = THREE.SRGBColorSpace;
          mat.needsUpdate = true;
        });
      });
      enableShadow(model);
      rig.model = model;
      rig.bones = findHumanBones(model);
      rig.rest = captureRestPose(rig.bones);
      rig.fallback.visible = false;
      rig.modelRoot.add(model);
      rig.modelRoot.updateMatrixWorld(true);
      rig.rightArmChain = makeArmChain(rig.bones.rightShoulder, rig.bones.rightUpperArm, rig.bones.rightForeArm, rig.bones.rightHand);
      rig.leftArmChain = makeArmChain(rig.bones.leftShoulder, rig.bones.leftUpperArm, rig.bones.leftForeArm, rig.bones.leftHand);
      rig.racket.visible = true;
    },
    undefined,
    () => {
      rig.fallback.visible = true;
      rig.racket.visible = false;
    }
  );

  return rig;
}

function createBall() {
  const tex = new THREE.CanvasTexture(makeBallTexture());
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.42, metalness: 0.01 });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(CFG.ballR, 32, 24), mat);
  enableShadow(mesh);
  return {
    mesh,
    pos: new THREE.Vector3(0, 1.18, CFG.courtL / 2 - 1.25),
    vel: new THREE.Vector3(),
    spin: 0,
    lastHitBy: null,
    bounceSide: null,
    bounceCount: 0,
  } as BallState;
}

function makeBallTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#d7ff35";
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.arc(62, 128, 92, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(194, 128, 92, Math.PI / 2, (Math.PI * 3) / 2);
  ctx.stroke();
  return c;
}

function baseVectors(player: HumanRig) {
  const forward = forwardFromYaw(player.yaw);
  const right = rightFromForward(forward);
  return { forward, right };
}

function strokePose(player: HumanRig, ball: BallState): StrokePose {
  const { forward, right } = baseVectors(player);
  const tRaw = player.swingT > 0 ? clamp01(player.swingT) : 0;
  const sideSign = player.side === "near" ? 1 : -1;
  const base = player.pos.clone();
  const rightShoulder = base.clone().addScaledVector(right, 0.31).addScaledVector(forward, -0.02).setY(1.43);
  const leftShoulder = base.clone().addScaledVector(right, -0.31).addScaledVector(forward, -0.02).setY(1.43);

  let rightElbow = rightShoulder.clone().addScaledVector(right, 0.24).addScaledVector(forward, -0.15).setY(1.08);
  let rightHand = rightShoulder.clone().addScaledVector(right, 0.47).addScaledVector(forward, 0.04).setY(0.88);
  let leftElbow = leftShoulder.clone().addScaledVector(right, -0.18).addScaledVector(forward, 0.0).setY(1.05);
  let leftHand = leftShoulder.clone().addScaledVector(right, -0.25).addScaledVector(forward, 0.18).setY(0.82);
  let racketHead = rightHand.clone().addScaledVector(right, 0.1).setY(1.45);
  let torsoYaw = 0;
  let torsoLean = 0;
  let shoulderLift = 0;
  let wristPronation = 0;

  const isServeReady = ball.lastHitBy === null && player.side === "near" && player.action === "ready";
  if (player.action === "serve" || isServeReady) {
    const s = player.action === "serve" ? tRaw : 0;
    const toss = clamp01(s / 0.34);
    const trophy = clamp01((s - 0.18) / 0.3);
    const drop = clamp01((s - 0.45) / 0.2);
    const contact = clamp01((s - 0.62) / 0.16);
    const follow = clamp01((s - 0.74) / 0.26);

    torsoYaw = -0.42 * sideSign + 0.72 * contact - 0.34 * follow;
    torsoLean = -0.08 - 0.2 * trophy + 0.28 * contact;
    shoulderLift = 0.28 * trophy + 0.32 * contact;

    rightElbow = rightShoulder.clone().addScaledVector(right, lerp(0.34, 0.18, drop)).addScaledVector(forward, lerp(-0.28, -0.02, contact)).setY(lerp(0.96, 1.55, trophy) - 0.18 * drop + 0.22 * contact);
    rightHand = rightShoulder.clone().addScaledVector(right, lerp(0.48, 0.24, contact)).addScaledVector(forward, lerp(-0.32, 0.46, contact)).setY(lerp(0.82, 1.76, trophy) - 0.56 * drop + 0.78 * contact);
    racketHead = rightHand.clone().addScaledVector(right, lerp(0.1, -0.2, follow)).addScaledVector(forward, lerp(-0.12, 0.52, contact) - 0.22 * follow).setY(lerp(1.34, 2.38, contact) - 0.95 * follow);

    leftElbow = leftShoulder.clone().addScaledVector(right, -0.12).addScaledVector(forward, 0.12).setY(lerp(1.0, 1.7, toss) - 0.68 * contact);
    leftHand = leftShoulder.clone().addScaledVector(right, -0.16).addScaledVector(forward, 0.28).setY(lerp(0.86, 2.02, toss) - 1.1 * contact);

    if (follow > 0) {
      rightHand.lerp(base.clone().addScaledVector(right, -0.34).addScaledVector(forward, 0.38).setY(1.07), easeOutCubic(follow));
      rightElbow.lerp(base.clone().addScaledVector(right, -0.08).addScaledVector(forward, 0.2).setY(1.18), follow);
      racketHead.lerp(base.clone().addScaledVector(right, -0.58).addScaledVector(forward, 0.18).setY(0.78), easeOutCubic(follow));
    }
    wristPronation = 1.2 * contact - 0.55 * follow;
  } else {
    const prep = clamp01(tRaw / 0.28);
    const slot = clamp01((tRaw - 0.18) / 0.26);
    const contact = clamp01((tRaw - 0.42) / 0.18);
    const follow = clamp01((tRaw - 0.58) / 0.42);
    const ballSide = clamp((ball.pos.x - player.pos.x) * 0.9, -0.4, 0.4);

    torsoYaw = -0.52 * prep + 0.88 * contact - 0.25 * follow;
    torsoLean = -0.1 * prep + 0.08 * contact;
    shoulderLift = 0.12 * contact;

    const prepHand = rightShoulder.clone().addScaledVector(right, 0.62 + ballSide).addScaledVector(forward, -0.35).setY(1.05);
    const slotHand = rightShoulder.clone().addScaledVector(right, 0.54 + ballSide).addScaledVector(forward, -0.05).setY(0.82);
    const contactHand = player.pos.clone().addScaledVector(right, 0.38 + ballSide * 0.45).addScaledVector(forward, 0.72).setY(clamp(ball.pos.y, 0.72, 1.24));
    const followHand = player.pos.clone().addScaledVector(right, -0.42).addScaledVector(forward, 0.34).setY(1.38);

    rightHand.copy(prepHand).lerp(slotHand, slot).lerp(contactHand, contact).lerp(followHand, follow);
    rightElbow = rightShoulder.clone().lerp(rightHand, 0.52).addScaledVector(right, 0.1 * (1 - follow)).setY((rightShoulder.y + rightHand.y) * 0.5 + 0.12);

    const lagHead = rightHand.clone().addScaledVector(right, 0.35).addScaledVector(forward, -0.26).setY(1.25);
    const contactHead = ball.pos.clone().addScaledVector(forward, 0.02).setY(clamp(ball.pos.y, 0.74, 1.3));
    const followHead = player.pos.clone().addScaledVector(right, -0.68).addScaledVector(forward, 0.22).setY(1.56);
    racketHead.copy(lagHead).lerp(contactHead, contact).lerp(followHead, follow);

    leftElbow = leftShoulder.clone().addScaledVector(right, -0.23).addScaledVector(forward, 0.08).setY(1.08 + 0.12 * follow);
    leftHand = leftShoulder.clone().addScaledVector(right, -0.42 + 0.34 * follow).addScaledVector(forward, 0.15).setY(0.92 + 0.46 * follow);
    wristPronation = 1.15 * contact + 0.25 * follow;
  }

  return { rightShoulder, rightElbow, rightHand, leftShoulder, leftElbow, leftHand, racketGrip: rightHand.clone(), racketHead, torsoYaw, torsoLean, shoulderLift, wristPronation };
}

function serveTossPosition(player: HumanRig, tRaw: number) {
  const { forward, right } = baseVectors(player);
  const arc = easeOutCubic(clamp01(tRaw / 0.36));
  return player.pos.clone().addScaledVector(right, -0.18).addScaledVector(forward, lerp(0.22, 0.46, arc)).setY(lerp(0.96, 2.36, arc));
}

function serveContactPosition(player: HumanRig) {
  const { forward, right } = baseVectors(player);
  return player.pos.clone().addScaledVector(right, 0.16).addScaledVector(forward, 0.52).setY(2.22);
}

function resetBallForServe(ball: BallState, near: HumanRig) {
  ball.pos.copy(serveTossPosition(near, 0));
  ball.vel.set(0, 0, 0);
  ball.spin = 0;
  ball.lastHitBy = null;
  ball.bounceSide = null;
  ball.bounceCount = 0;
  ball.mesh.position.copy(ball.pos);
}

function setRacketPose(racket: THREE.Group, grip: THREE.Vector3, head: THREE.Vector3, roll: number) {
  const dir = head.clone().sub(grip).normalize();
  racket.position.copy(grip);
  racket.quaternion.setFromUnitVectors(UP, dir);
  racket.rotateY(roll);
}

function restoreRestPose(player: HumanRig) {
  for (const r of player.rest) r.bone.quaternion.copy(r.q);
}

function updateSkeletonTorso(player: HumanRig, pose: StrokePose) {
  addLocalRotation(player.bones.spine, pose.torsoLean, pose.torsoYaw * 0.22, pose.torsoYaw * 0.08);
  addLocalRotation(player.bones.chest, pose.torsoLean * 0.6, pose.torsoYaw * 0.38, pose.torsoYaw * 0.18);
  addLocalRotation(player.bones.neck, -pose.torsoLean * 0.45, -pose.torsoYaw * 0.18, 0);
}

function updateModelRigWithCharacterHands(player: HumanRig, pose: StrokePose) {
  if (!player.model) return false;
  restoreRestPose(player);
  updateSkeletonTorso(player, pose);

  const rightSolved = solveTwoBoneArm(player.rightArmChain, pose.rightShoulder, pose.rightElbow, pose.rightHand);
  const leftSolved = solveTwoBoneArm(player.leftArmChain, pose.leftShoulder, pose.leftElbow, pose.leftHand);

  if (rightSolved) {
    addLocalRotation(player.bones.rightHand, 0.05, pose.wristPronation, -0.12);
    addLocalRotation(player.bones.rightForeArm, 0, 0.05, pose.shoulderLift * 0.15);
    addLocalRotation(player.bones.rightUpperArm, -pose.shoulderLift * 0.08, 0, 0);
  }
  if (leftSolved) {
    addLocalRotation(player.bones.leftForeArm, -0.04, 0, 0.05);
  }
  player.modelRoot.updateMatrixWorld(true);
  return rightSolved;
}

function updatePoseAndRacket(player: HumanRig, ball: BallState) {
  const pose = strokePose(player, ball);
  const handSolved = updateModelRigWithCharacterHands(player, pose);

  if (handSolved && player.bones.rightHand) {
    const actualGrip = getWorldPos(player.bones.rightHand);
    const desiredVector = pose.racketHead.clone().sub(pose.racketGrip);
    setRacketPose(player.racket, actualGrip, actualGrip.clone().add(desiredVector), pose.wristPronation);
    player.racket.visible = true;
  } else {
    player.racket.visible = false;
  }
}

function ballisticVelocity(from: THREE.Vector3, target: THREE.Vector3, power: number, serve = false) {
  const flatDist = Math.hypot(target.x - from.x, target.z - from.z);
  const baseSpeed = serve ? 10.4 + power * 5.8 : 7.6 + power * 4.6;
  const flight = clamp(flatDist / baseSpeed, serve ? 0.42 : 0.58, serve ? 0.92 : 1.22);
  return new THREE.Vector3(
    (target.x - from.x) / flight,
    (target.y - from.y + 0.5 * CFG.gravity * flight * flight) / flight,
    (target.z - from.z) / flight
  );
}

function makeUserTargetFromSwipe(startX: number, startY: number, endX: number, endY: number, isServe: boolean) {
  const dx = endX - startX;
  const dy = endY - startY;
  const power = clamp(Math.hypot(dx, dy) / 165, isServe ? 0.6 : 0.24, 1);
  const aimX = clamp((dx / 140) * (CFG.courtW / 2), -CFG.courtW / 2 + 0.42, CFG.courtW / 2 - 0.42);
  const upward = clamp((-dy + 40) / 230, 0, 1);
  const targetZ = isServe ? lerp(-1.0, -CFG.serviceLineZ + 0.22, upward) : lerp(-1.15, -CFG.courtL / 2 + 0.88, upward);
  return { target: new THREE.Vector3(aimX, CFG.ballR, targetZ), power };
}

function makeAiTarget(near: HumanRig, ball: BallState): DesiredHit {
  const pressure = clamp01((Math.abs(ball.pos.z) - 0.6) / (CFG.courtL / 2 - 0.8));
  const sideRead = clamp((ball.vel.x || 0) * 0.26, -0.5, 0.5);
  const x = clamp(near.pos.x * 0.72 + sideRead + (Math.random() - 0.5) * 0.75, -CFG.courtW / 2 + 0.35, CFG.courtW / 2 - 0.35);
  const z = lerp(1.2, CFG.courtL / 2 - 0.7, 0.42 + pressure * 0.5);
  const power = clamp(0.72 + pressure * 0.42 + Math.random() * 0.2, 0.62, 1);
  const roll = Math.random();
  const technique: ShotTechnique = pressure > 0.72 ? "topspin" : roll > 0.66 ? "slice" : roll < 0.22 ? "lob" : "flat";
  return { target: new THREE.Vector3(x, CFG.ballR, z), power, technique };
}

function performHit(player: HumanRig, ball: BallState, hit: DesiredHit, serve = false) {
  const target = hit.target.clone();
  target.x = clamp(target.x, -CFG.courtW / 2 + 0.28, CFG.courtW / 2 - 0.28);
  target.z = player.side === "near" ? clamp(target.z, -CFG.courtL / 2 + 0.6, -0.65) : clamp(target.z, 0.65, CFG.courtL / 2 - 0.6);

  if (serve) ball.pos.copy(serveContactPosition(player));
  else ball.pos.y = clamp(ball.pos.y, 0.58, 1.25);

  ball.vel.copy(ballisticVelocity(ball.pos, target, hit.power, serve));
  const technique = hit.technique || "flat";
  if (technique === "topspin") {
    ball.vel.y += 0.35 + hit.power * 0.35;
    ball.spin = 1.05 + hit.power * 1.1;
  } else if (technique === "slice") {
    ball.vel.x += (Math.random() - 0.5) * 1.6;
    ball.vel.y -= 0.12;
    ball.spin = -1.15 - hit.power * 0.62;
  } else {
    ball.spin = serve ? 0.95 + hit.power * 0.9 : 0.6 + hit.power * 1.25;
  }
  ball.lastHitBy = player.side;
  ball.bounceSide = null;
  ball.bounceCount = 0;
  player.cooldown = serve ? 0.42 : 0.28;
  player.hitThisSwing = true;
}

function canReachBall(player: HumanRig, ball: BallState) {
  if (player.cooldown > 0) return false;
  if (sideOfZ(ball.pos.z) !== player.side && ball.lastHitBy !== null) return false;
  if (ball.pos.y < 0.16 || ball.pos.y > 1.62) return false;
  const pose = strokePose(player, ball);
  const dx = ball.pos.x - pose.racketHead.x;
  const dy = ball.pos.y - pose.racketHead.y;
  const dz = ball.pos.z - pose.racketHead.z;
  const racketNear = dx * dx + dy * dy * 0.45 + dz * dz < 0.48 * 0.48;
  const bodyDx = ball.pos.x - player.pos.x;
  const bodyDz = ball.pos.z - player.pos.z;
  return racketNear || bodyDx * bodyDx + bodyDz * bodyDz < CFG.reach * CFG.reach;
}

function startSwing(player: HumanRig, desiredHit: DesiredHit, action: StrokeAction) {
  player.action = action;
  player.swingT = 0.001;
  player.desiredHit = desiredHit;
  player.hitThisSwing = false;
}

function updatePlayerMotion(player: HumanRig, ball: BallState, dt: number) {
  const to = player.target.clone().sub(player.pos);
  const dist = to.length();
  const maxStep = player.speed * dt;
  if (dist > 0.0001) player.pos.addScaledVector(to.normalize(), Math.min(maxStep, dist));

  player.pos.x = clamp(player.pos.x, -CFG.courtW / 2 + 0.35, CFG.courtW / 2 - 0.35);
  if (player.side === "near") player.pos.z = clamp(player.pos.z, 0.76, CFG.courtL / 2 - 0.42);
  else player.pos.z = clamp(player.pos.z, -CFG.courtL / 2 + 0.42, -0.76);

  let face: THREE.Vector3;
  if (ball.lastHitBy === null && player.side === "near") face = new THREE.Vector3(0.22, 0, -1).normalize();
  else face = ball.pos.clone().sub(player.pos).setY(0);
  if (face.lengthSq() < 0.02) face.set(0, 0, player.side === "near" ? -1 : 1);
  face.normalize();

  const targetYaw = yawFromForward(face);
  let delta = targetYaw - player.yaw;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  player.yaw += delta * (1 - Math.exp(-8 * dt));

  player.root.position.copy(player.pos);
  player.modelRoot.position.copy(player.pos);
  player.modelRoot.rotation.y = player.yaw;

  if (player.model) {
    const runAmount = clamp01(dist / 0.42);
    const moveDir = dist > 0.0001 ? to.clone().normalize() : new THREE.Vector3();
    const localForward = forwardFromYaw(player.yaw);
    const localRight = rightFromForward(localForward);
    const forwardDot = moveDir.dot(localForward);
    const sideDot = moveDir.dot(localRight);
    const walkT = performance.now() * 0.015 + (player.side === "near" ? 0 : Math.PI);
    const bob = Math.sin(walkT) * 0.03 * runAmount;
    const strafeLean = sideDot * 0.1 * runAmount;
    player.model.position.y = bob;
    player.model.rotation.x = 0.05 * runAmount * Math.max(0, forwardDot) - 0.03 * runAmount * Math.max(0, -forwardDot);
    player.model.rotation.z = strafeLean;
  }

  player.cooldown = Math.max(0, player.cooldown - dt);
  if (player.swingT > 0) {
    const duration = player.action === "serve" ? CFG.serveDuration : CFG.swingDuration;
    player.swingT += dt / duration;
    if (player.swingT >= 1) {
      player.swingT = 0;
      player.action = "ready";
      player.desiredHit = null;
      player.hitThisSwing = false;
    }
  }
}

function predictLanding(ball: BallState) {
  const p = ball.pos.clone();
  const v = ball.vel.clone();
  const dt = 1 / 45;
  for (let i = 0; i < 95; i++) {
    v.y -= CFG.gravity * dt;
    p.addScaledVector(v, dt);
    if (p.y <= CFG.ballR) return p;
  }
  return p;
}

export default function MobileThreeTennisPrototype() {
  const { search } = useLocation();
  const query = new URLSearchParams(search);
  const playerName = query.get("name") || "You";
  const playerAvatar = query.get("avatar") || "";
  const rivalName = query.get("mode") === "online" ? "Opponent" : "AI";
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hud, setHud] = useState<HudState>({ nearScore: 0, farScore: 0, status: "Swipe up to serve", power: 0 });
  const [menuOpen, setMenuOpen] = useState(false);
  const [hdriChoices, setHdriChoices] = useState<any[]>([]);
  const [selectedHdriId, setSelectedHdriId] = useState(() => localStorage.getItem("tennisSelectedHdri") || POOL_ROYALE_DEFAULT_HDRI_ID);
  const [selectedHumanCharacterId, setSelectedHumanCharacterId] = useState(() => localStorage.getItem("tennisSelectedHumanCharacter") || HUMAN_CHARACTER_OPTIONS[0]?.id || "rpm-current");
  const tennisPoint = (score: number) => ["0", "15", "30", "40", "Ad"][Math.min(score, 4)];
  const hudRef = useRef(hud);
  const controlRef = useRef<ControlState>({ active: false, pointerId: null, startX: 0, startY: 0, lastX: 0, lastY: 0, startPlayer: new THREE.Vector3() });

  useEffect(() => { hudRef.current = hud; }, [hud]);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setClearColor(0x07100c, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();

    const scene = new THREE.Scene();
    let activeEnvMap: THREE.Texture | null = null;
    scene.fog = null;

    const camera = new THREE.PerspectiveCamera(44, 1, 0.05, 70);
    const cameraTarget = new THREE.Vector3(0, 0.95, -1.45);
    const cameraOffset = new THREE.Vector3(0, 4.95, 7.7);
    const cameraPosTarget = new THREE.Vector3();

    scene.add(new THREE.AmbientLight(0xffffff, 0.62));
    scene.add(new THREE.HemisphereLight(0xffffff, 0x254c3d, 0.7));
    const sun = new THREE.DirectionalLight(0xffffff, 1.55);
    sun.position.set(-4.2, 8.5, 5.2);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 25;
    sun.shadow.camera.left = -8;
    sun.shadow.camera.right = 8;
    sun.shadow.camera.top = 9;
    sun.shadow.camera.bottom = -9;
    scene.add(sun);


    const hdriLoader = new RGBELoader().setDataType(THREE.HalfFloatType).setCrossOrigin("anonymous");
    const applyHdri = (id: string) => {
      const variant = POOL_ROYALE_HDRI_VARIANTS.find((v) => v.id === id) || POOL_ROYALE_HDRI_VARIANTS.find((v) => v.id === POOL_ROYALE_DEFAULT_HDRI_ID);
      if (!variant) return;
      const order = variant.preferredResolutions?.length ? variant.preferredResolutions : ["4k","2k"];
      const urls = order.map((res: string) => `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/${res}/${variant.assetId}_${res}.hdr`);
      const loadAt = (idx: number) => {
        if (!urls[idx]) return;
        hdriLoader.load(urls[idx], (hdrTex) => {
          const env = pmrem.fromEquirectangular(hdrTex).texture;
          hdrTex.dispose();
          if (activeEnvMap) activeEnvMap.dispose();
          activeEnvMap = env;
          scene.environment = env;
          scene.background = env;
          scene.backgroundBlurriness = 0.02;
        }, undefined, () => loadAt(idx + 1));
      };
      loadAt(0);
    };
    applyHdri(selectedHdriId);
    const courtVisual = addCourt(scene, { hideFloor: false });
    const updateBillboards = () => {};

    const nearHuman = HUMAN_CHARACTER_OPTIONS.find((c) => c.id === selectedHumanCharacterId) || HUMAN_CHARACTER_OPTIONS[0];
    const aiPool = HUMAN_CHARACTER_OPTIONS.filter((c) => c.id !== nearHuman?.id);
    const aiHuman = (aiPool.length ? aiPool : HUMAN_CHARACTER_OPTIONS)[Math.floor(Math.random() * (aiPool.length ? aiPool.length : HUMAN_CHARACTER_OPTIONS.length))];
    const nearPlayer = addHuman(scene, "near", new THREE.Vector3(0, 0, CFG.courtL / 2 - 1.04), 0xff7a2f, nearHuman?.modelUrls?.[0] || HUMAN_URL);
    const farPlayer = addHuman(scene, "far", new THREE.Vector3(0, 0, -CFG.courtL / 2 + 1.04), 0x62d2ff, aiHuman?.modelUrls?.[0] || HUMAN_URL);
    const ball = createBall();
    scene.add(ball.mesh);
    resetBallForServe(ball, nearPlayer);
    let netShakeT = 0;

    const ghost = new THREE.Mesh(
      new THREE.RingGeometry(0.25, 0.32, 36),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.42, side: THREE.DoubleSide })
    );
    ghost.rotation.x = -Math.PI / 2;
    ghost.position.copy(nearPlayer.target).setY(0.07);
    scene.add(ghost);

    let frameId = 0;
    const shotFx = new Audio("https://assets.mixkit.co/active_storage/sfx/2614/2614-preview.mp3");
    shotFx.volume = 0.6;
    const bounceFx = new Audio("https://assets.mixkit.co/active_storage/sfx/2614/2614-preview.mp3");
    bounceFx.volume = 0.34;
    const crowdFx = new Audio("/assets/sounds/crowd-cheering-383111.mp3");
    crowdFx.volume = 0.32;
    const faultFx = new Audio("/assets/sounds/metal-whistle-6121.mp3");
    faultFx.volume = 0.25;
    let last = performance.now();
    let pointLock = false;
    let pointLockT = 0;
    let replayText = "";
    let replayT = 0;

    const setHudSafe = (patch: Partial<HudState>) => setHud((prev) => ({ ...prev, ...patch }));

    const awardPoint = (winner: PlayerSide, reason: PointReason) => {
      if (pointLock) return;
      pointLock = true;
      pointLockT = 0.78;
      const prev = hudRef.current;
      const next = {
        nearScore: prev.nearScore + (winner === "near" ? 1 : 0),
        farScore: prev.farScore + (winner === "far" ? 1 : 0),
      };
      const reasonText = reason === "out" ? "Out ball" : reason === "doubleBounce" ? "Double bounce" : reason === "net" ? "Net fault" : "Point";
      replayText = `Replay: ${reasonText} by ${winner === "near" ? "You" : "AI"}`;
      replayT = 1.7;
      void (reason === "out" || reason === "doubleBounce" || reason === "net" ? faultFx.play() : crowdFx.play()).catch(() => {});
      setHud({ ...prev, ...next, status: `${reasonText}: ${winner === "near" ? "You" : "AI"} scores`, power: 0 });
    };

    const resize = () => {
      const w = Math.max(1, host.clientWidth);
      const h = Math.max(1, host.clientHeight);
      renderer.setSize(w, h, false);
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      camera.aspect = w / h;
      camera.fov = camera.aspect < 0.72 ? 52 : 46;
      if (camera.aspect < 0.72) cameraOffset.set(0, 5.45, 8.55);
      else cameraOffset.set(0, 4.95, 7.7);
      cameraPosTarget.copy(nearPlayer.target).add(cameraOffset);
      camera.position.copy(cameraPosTarget);
      camera.lookAt(cameraTarget);
      camera.updateProjectionMatrix();
    };

    const onPointerDown = (e: PointerEvent) => {
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
      setHudSafe({ status: ball.lastHitBy === null ? "Hold, aim serve, release" : "Drag to move, release to swing", power: 0 });
    };

    const onPointerMove = (e: PointerEvent) => {
      const control = controlRef.current;
      if (!control.active || control.pointerId !== e.pointerId) return;
      control.lastX = e.clientX;
      control.lastY = e.clientY;
      const dx = e.clientX - control.startX;
      const dy = e.clientY - control.startY;
      nearPlayer.target.x = clamp(control.startPlayer.x + dx * 0.012, -CFG.courtW / 2 + 0.35, CFG.courtW / 2 - 0.35);
      const minZ = ball.lastHitBy === null ? CFG.serveNearBaselineZ : 0.76;
      nearPlayer.target.z = clamp(control.startPlayer.z + dy * 0.012, minZ, CFG.courtL / 2 - 0.42);
      setHudSafe({ power: clamp01(Math.hypot(dx, dy) / 185) });
    };

    const onPointerUp = (e: PointerEvent) => {
      const control = controlRef.current;
      if (!control.active || control.pointerId !== e.pointerId) return;
      try { canvas.releasePointerCapture(e.pointerId); } catch {}
      control.active = false;
      control.pointerId = null;
      const isServe = ball.lastHitBy === null;
      const hit = makeUserTargetFromSwipe(control.startX, control.startY, e.clientX, e.clientY, isServe);
      startSwing(nearPlayer, hit, isServe ? "serve" : "forehand");
      setHudSafe({ status: isServe ? "Serve motion" : "Forehand swing", power: 0 });
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("resize", resize);
    resize();

    function updateServeTossLock() {
      const serving = nearPlayer.action === "serve" && nearPlayer.swingT > 0 && !nearPlayer.hitThisSwing && ball.lastHitBy === null;
      if (!serving) return false;
      if (nearPlayer.swingT < CFG.serveContactT) {
        ball.pos.copy(serveTossPosition(nearPlayer, nearPlayer.swingT));
        ball.mesh.position.copy(ball.pos);
        return true;
      }
      return false;
    }

    function updateBall(dt: number) {
      const prevZ = ball.pos.z;
      ball.vel.y -= CFG.gravity * (1 + ball.spin * 0.18) * dt;
      ball.vel.multiplyScalar(Math.exp(-CFG.airDrag * dt));
      ball.pos.addScaledVector(ball.vel, dt);
      ball.spin *= Math.exp(-0.95 * dt);

      if (ball.vel.length() > 0.02) {
        const rollAxis = new THREE.Vector3(ball.vel.z, 0, -ball.vel.x);
        if (rollAxis.lengthSq() > 0.0001) ball.mesh.rotateOnWorldAxis(rollAxis.normalize(), (ball.vel.length() / CFG.ballR) * dt);
      }

      const crossesNet = (prevZ > 0 && ball.pos.z <= 0) || (prevZ < 0 && ball.pos.z >= 0) || Math.abs(ball.pos.z) < 0.055;
      if (crossesNet && Math.abs(ball.pos.x) <= CFG.doublesW / 2 + 0.1 && ball.pos.y < CFG.netH + CFG.ballR * 0.6 && ball.lastHitBy) {
        ball.pos.z = ball.lastHitBy === "near" ? 0.09 : -0.09;
        ball.vel.z *= -0.22;
        ball.vel.y = Math.max(0.25, Math.abs(ball.vel.y) * 0.22);
        netShakeT = 0.45;
        awardPoint(opposite(ball.lastHitBy), "net");
      }

      if (ball.pos.y <= CFG.ballR) {
        ball.pos.y = CFG.ballR;
        if (ball.vel.y < 0) {
          ball.vel.y = -ball.vel.y * CFG.bounceRestitution;
          ball.vel.x *= CFG.groundFriction;
          ball.vel.z *= CFG.groundFriction;
          const bounceSide = sideOfZ(ball.pos.z);
          void bounceFx.play().catch(() => {});
          if (ball.bounceSide === bounceSide) ball.bounceCount += 1;
          else {
            ball.bounceSide = bounceSide;
            ball.bounceCount = 1;
          }
          const outsideX = Math.abs(ball.pos.x) > CFG.courtW / 2;
          const outsideZ = Math.abs(ball.pos.z) > CFG.courtL / 2;
          if ((outsideX || outsideZ) && ball.lastHitBy) awardPoint(opposite(ball.lastHitBy), "out");
          else if (ball.bounceCount > 1) awardPoint(opposite(bounceSide), "doubleBounce");
        }
      }

      if ((Math.abs(ball.pos.x) > 7.5 || Math.abs(ball.pos.z) > 9.3 || ball.pos.y < -1.2) && ball.lastHitBy) awardPoint(opposite(ball.lastHitBy), "out");
      if (ball.vel.length() < CFG.minBallSpeed && ball.pos.y <= CFG.ballR + 0.002 && ball.lastHitBy) awardPoint(opposite(sideOfZ(ball.pos.z)), "doubleBounce");
      ball.mesh.position.copy(ball.pos);
    }

    function updateAi() {
      const landing = predictLanding(ball);
      const home = new THREE.Vector3(0, 0, -CFG.courtL / 2 + 0.9);
      const ballComingToAi = ball.lastHitBy === "near" && (ball.pos.z < 0.65 || landing.z < 0);
      if (ballComingToAi) {
        farPlayer.target.x = clamp(landing.x, -CFG.courtW / 2 + 0.35, CFG.courtW / 2 - 0.35);
        farPlayer.target.z = clamp(Math.min(-0.72, landing.z + 0.42), -CFG.courtL / 2 + 0.42, -0.64);
      } else {
        farPlayer.target.lerp(home, 0.035);
      }
      if (ballComingToAi && canReachBall(farPlayer, ball) && farPlayer.swingT === 0) startSwing(farPlayer, makeAiTarget(nearPlayer, ball), "forehand");
    }

    function checkSwingHits() {
      for (const player of [nearPlayer, farPlayer]) {
        if (player.swingT <= 0 || player.hitThisSwing || !player.desiredHit) continue;
        if (player.action === "serve") {
          if (player.swingT >= CFG.serveContactT) {
            performHit(player, ball, player.desiredHit, true);
            void shotFx.play().catch(() => {});
            setHudSafe({ status: "Serve sent" });
          }
          continue;
        }
        if (player.swingT < CFG.hitWindowStart || player.swingT > CFG.hitWindowEnd) continue;
        if (canReachBall(player, ball)) {
          performHit(player, ball, player.desiredHit, false);
          void shotFx.play().catch(() => {});
          setHudSafe({ status: player.side === "near" ? "Forehand return" : "AI returned" });
        }
      }
    }

    function animate() {
      frameId = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;

      if (replayT > 0) {
        replayT -= dt;
        if (replayT > 0.05) setHudSafe({ status: replayText });
      }

      if (pointLock) {
        pointLockT -= dt;
        if (pointLockT <= 0) {
          pointLock = false;
          nearPlayer.action = "ready";
          farPlayer.action = "ready";
          nearPlayer.target.set(0, 0, CFG.courtL / 2 - 1.04);
          farPlayer.target.set(0, 0, -CFG.courtL / 2 + 1.04);
          resetBallForServe(ball, nearPlayer);
          setHudSafe({ status: "Swipe up to serve", power: 0 });
        }
      } else {
        updateAi();
        const ballLockedByServe = updateServeTossLock();
        checkSwingHits();
        if (!ballLockedByServe || ball.lastHitBy !== null) updateBall(dt);
      }

      updatePlayerMotion(nearPlayer, ball, dt);
      updatePlayerMotion(farPlayer, ball, dt);
      updatePoseAndRacket(nearPlayer, ball);
      updatePoseAndRacket(farPlayer, ball);

      if (netShakeT > 0) {
        netShakeT = Math.max(0, netShakeT - dt);
        const k = netShakeT / 0.45;
        const wobble = Math.sin((0.45 - netShakeT) * 55) * 0.05 * k;
        courtVisual.netBody.scale.z = 1 + Math.abs(wobble) * 1.6;
        courtVisual.netBody.position.z = wobble;
      } else {
        courtVisual.netBody.scale.z += (1 - courtVisual.netBody.scale.z) * (1 - Math.exp(-10 * dt));
        courtVisual.netBody.position.z += (0 - courtVisual.netBody.position.z) * (1 - Math.exp(-10 * dt));
      }

      ghost.position.x += (nearPlayer.target.x - ghost.position.x) * (1 - Math.exp(-12 * dt));
      ghost.position.z += (nearPlayer.target.z - ghost.position.z) * (1 - Math.exp(-12 * dt));
      (ghost.material as THREE.MeshBasicMaterial).opacity = controlRef.current.active ? 0.62 : 0.28;

      cameraPosTarget.copy(nearPlayer.target).add(cameraOffset);
      camera.position.lerp(cameraPosTarget, 1 - Math.exp(-5.5 * dt));
      cameraTarget.x += (nearPlayer.target.x - cameraTarget.x) * (1 - Math.exp(-5.2 * dt));
      cameraTarget.z += ((nearPlayer.target.z - 6.9) - cameraTarget.z) * (1 - Math.exp(-4.3 * dt));
      updateBillboards(now * 0.001);
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
      if (activeEnvMap) activeEnvMap.dispose();
      pmrem.dispose();
      renderer.dispose();
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
  }, [selectedHdriId, selectedHumanCharacterId]);

  useEffect(() => {
    localStorage.setItem("tennisSelectedHumanCharacter", selectedHumanCharacterId);
  }, [selectedHumanCharacterId]);

  useEffect(() => {
    let cancelled = false;
    getPoolRoyalInventory().then((inventory) => {
      if (cancelled) return;
      const owned = new Set(inventory?.environmentHdri || []);
      const tennisHdriSet = new Set(TENNIS_HDRI_OPTION_IDS);
      const options = POOL_ROYALE_HDRI_VARIANTS.filter((v) => tennisHdriSet.has(v.id) && owned.has(v.id));
      const fallbackId = options[0]?.id || TENNIS_HDRI_OPTION_IDS[0] || POOL_ROYALE_DEFAULT_HDRI_ID;
      setHdriChoices(options.length ? options : POOL_ROYALE_HDRI_VARIANTS.filter((v) => tennisHdriSet.has(v.id)).slice(0, 1));
      if (!options.some((v) => v.id === selectedHdriId)) setSelectedHdriId(fallbackId);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [selectedHdriId]);

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#07100c", touchAction: "none", userSelect: "none" }}>
      <div ref={hostRef} style={{ position: "absolute", inset: 0 }}>
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }} />
      </div>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif" }}>
        <div style={{ position: "absolute", left: 10, right: 10, top: 64, color: "white", background: "rgba(5,12,18,0.78)", border: "1px solid rgba(255,255,255,0.2)", padding: "8px 10px", borderRadius: 14, fontSize: 12, boxShadow: "0 12px 26px rgba(0,0,0,0.22)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{ width: 30, height: 30, borderRadius: "999px", overflow: "hidden", border: "1px solid rgba(255,255,255,.25)", background: "#1f2937" }}>{playerAvatar ? <img src={playerAvatar} alt={playerName} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}</div>
              <div><div style={{ fontWeight: 700 }}>{playerName}</div><div style={{ opacity: 0.7 }}>Points {hud.nearScore}</div></div>
            </div>
            <div style={{ textAlign: "center", fontWeight: 900, fontSize: 18, letterSpacing: 1 }}>{tennisPoint(hud.nearScore)} : {tennisPoint(hud.farScore)}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div><div style={{ fontWeight: 700, textAlign: "right" }}>{rivalName}</div><div style={{ opacity: 0.7, textAlign: "right" }}>Points {hud.farScore}</div></div>
              <div style={{ width: 30, height: 30, borderRadius: "999px", border: "1px solid rgba(255,255,255,.25)", background: "#334155", display: "flex", alignItems: "center", justifyContent: "center" }}>🎾</div>
            </div>
            <button type="button" style={{ pointerEvents: "auto", width: 92, height: 34, borderRadius: 999, border: "1px solid rgba(255,255,255,0.25)", background: "rgba(0,0,0,0.55)", color: "#fff", fontWeight: 700, letterSpacing: 0.4 }} onClick={() => setMenuOpen((v) => !v)}>☰ Menu</button>
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.82, marginTop: 6, textAlign: "center" }}>{hud.status}</div>
        </div>

        {menuOpen && (
          <div style={{ position: "absolute", right: 10, top: 108, width: 210, maxHeight: 300, overflow: "auto", background: "rgba(8,16,24,0.94)", border: "1px solid rgba(255,255,255,0.22)", borderRadius: 12, padding: 8 }}>
            <div style={{ color: "#fff", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Owned HDRI</div>
            {hdriChoices.map((opt) => (
              <button key={opt.id} type="button" onClick={() => { setSelectedHdriId(opt.id); localStorage.setItem("tennisSelectedHdri", opt.id); }} style={{ width: "100%", display: "flex", gap: 8, alignItems: "center", marginBottom: 6, borderRadius: 10, border: selectedHdriId === opt.id ? "1px solid #7dd3fc" : "1px solid rgba(255,255,255,.18)", background: "rgba(255,255,255,0.08)", padding: 6, color: "#fff" }}>
                <img src={opt.thumbnail} alt={opt.name} style={{ width: 42, height: 24, objectFit: "cover", borderRadius: 6 }} />
                <span style={{ fontSize: 11, textAlign: "left" }}>{opt.name}</span>
              </button>
            ))}
          </div>
        )}
  
      </div>
    </div>
  );
}
