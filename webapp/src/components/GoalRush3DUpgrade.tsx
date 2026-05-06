"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { MURLAN_CHARACTER_THEMES } from "../config/murlanCharacterThemes.js";

type Team = "blue" | "red";
type AnimName = "Idle" | "Walk" | "Run";

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

type KickFoot = "left" | "right";
type Player = {
  team: Team;
  root: THREE.Group;
  model: THREE.Object3D | null;
  fallback: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  actions: Partial<Record<AnimName, THREE.AnimationAction>>;
  current: AnimName;
  bones: Bones;
  bind: WeakMap<THREE.Bone, THREE.Quaternion>;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  dir: THREE.Vector3;
  targetDir: THREE.Vector3;
  speed: number;
  radius: number;
  kickTime: number;
  kickQueued: boolean;
  kickFired: boolean;
  kickFoot: KickFoot;
  queuedShotDir: THREE.Vector3 | null;
  queuedShotPower: number;
  queuedShotLift: number;
  tackleTime: number;
  tackleQueued: boolean;
  tackleFired: boolean;
  fallTime: number;
  fallDir: THREE.Vector3;
  loaded: boolean;
};

type InputState = { x: number; y: number; sprint: boolean; tackle: boolean };

type SwipeShot = { dir: THREE.Vector3; power: number; lift: number; screenPower: number };

type SwipeState = { pointerId: number | null; startX: number; startY: number; endX: number; endY: number; active: boolean };

type SeatedSpectator = {
  root: THREE.Group;
  fallback: THREE.Group;
  instance: THREE.Object3D | null;
  bones: Partial<Record<"hips" | "spine" | "head" | "leftUpperArm" | "leftForeArm" | "leftHand" | "rightUpperArm" | "rightForeArm" | "rightHand" | "leftThigh" | "leftCalf" | "rightThigh" | "rightCalf", THREE.Bone>>;
  base: Partial<Record<"hips" | "spine" | "head" | "leftUpperArm" | "leftForeArm" | "leftHand" | "rightUpperArm" | "rightForeArm" | "rightHand" | "leftThigh" | "leftCalf" | "rightThigh" | "rightCalf", THREE.Euler>>;
  index: number;
};

type StadiumRig = { spectators: SeatedSpectator[]; cheerTime: number };

type ReplayFrame = { ball: THREE.Vector3; ballQuat: THREE.Quaternion; blue: THREE.Vector3; blueRot: THREE.Euler; red: THREE.Vector3; redRot: THREE.Euler; cam: THREE.Vector3; look: THREE.Vector3 };

type BallState = {
  object: THREE.Group;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  lastSafe: THREE.Vector3;
  stuckTimer: number;
};

const HUMAN_URL = "https://threejs.org/examples/models/gltf/Soldier.glb";
const MURLAN_CHARACTER_URLS = MURLAN_CHARACTER_THEMES.map((theme) => theme.modelUrls?.[0] ?? theme.url).filter(Boolean);
const MURLAN_CHARACTER_COLORS = [0x1d69ff, 0xdc2626, 0x16a34a, 0xfacc15, 0x7c3aed, 0xf97316, 0x0891b2];
const SPECTATOR_ROWS_FILLED = 4;
const SPECTATORS_PER_ROW_TARGET = 12;
const SPECTATOR_SCALE = 0.095;
const SPECTATOR_FALLBACK_SCALE = 0.105;
const SPECTATOR_SEAT_Y = 0.03;
const SPECTATOR_SEAT_Z = 0.03;
const SEATED_CHARACTER_TEMPLATE_CACHE = new Map<string, Promise<THREE.Object3D>>();

const FIELD_W = 3.15;
const FIELD_H = 4.65;
const GOAL_W = 0.9;
const GOAL_H = 0.52;
const GOAL_D = 0.42;
const PLAYER_RADIUS = 0.12;
const BALL_RADIUS = 0.078;
const WALK_SPEED = 0.95;
const SPRINT_SPEED = 1.65;
const AI_SPEED = 1.1;
const GROUND_Y = 0;
const DT_MAX = 1 / 30;
const TMP = new THREE.Vector3();
const TMP2 = new THREE.Vector3();
const TMP3 = new THREE.Vector3();
const QTMP = new THREE.Quaternion();

function mat(color: number, roughness = 0.78, metalness = 0.02) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function shadow<T extends THREE.Object3D>(o: T) {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
    }
  });
  return o;
}

function clean(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findBones(model: THREE.Object3D): Bones {
  const b: Bones = {};
  model.traverse((o) => {
    const bone = o as THREE.Bone;
    if (!bone.isBone) return;
    const n = clean(bone.name);
    if (!b.hips && n.includes("hips")) b.hips = bone;
    if (!b.spine && n.includes("spine")) b.spine = bone;
    if (!b.rightUpLeg && (n.includes("rightupleg") || n.includes("rightthigh") || n.includes("rthigh"))) b.rightUpLeg = bone;
    if (!b.leftUpLeg && (n.includes("leftupleg") || n.includes("leftthigh") || n.includes("lthigh"))) b.leftUpLeg = bone;
    if (!b.rightLeg && !n.includes("foot") && !n.includes("upleg") && (n.includes("rightleg") || n.includes("rightcalf") || n.includes("rightshin"))) b.rightLeg = bone;
    if (!b.leftLeg && !n.includes("foot") && !n.includes("upleg") && (n.includes("leftleg") || n.includes("leftcalf") || n.includes("leftshin"))) b.leftLeg = bone;
    if (!b.rightFoot && n.includes("rightfoot")) b.rightFoot = bone;
    if (!b.leftFoot && n.includes("leftfoot")) b.leftFoot = bone;
  });
  return b;
}

function saveBind(model: THREE.Object3D) {
  const bind = new WeakMap<THREE.Bone, THREE.Quaternion>();
  model.traverse((o) => {
    const bone = o as THREE.Bone;
    if (bone.isBone) bind.set(bone, bone.quaternion.clone());
  });
  return bind;
}

function normalizeAnimatedHuman(model: THREE.Object3D, height = 0.92) {
  model.rotation.set(0, Math.PI, 0);
  model.scale.setScalar(1);
  model.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(model);
  const h = Math.max(0.001, box.max.y - box.min.y);
  model.scale.setScalar(height / h);
  model.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box.min.y;
  model.updateMatrixWorld(true);
}

function tintPlayer(model: THREE.Object3D, team: Team) {
  const tint = new THREE.Color(team === "blue" ? 0x1d69ff : 0xd92f2f);
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((raw) => {
      const material = raw as THREE.MeshStandardMaterial;
      if (material.color) material.color.lerp(tint, 0.32);
      material.needsUpdate = true;
    });
  });
}


function createSoccerBallTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 5;
  ctx.fillStyle = "#111827";
  for (let y = 34; y < 256; y += 64) {
    for (let x = (y / 64) % 2 ? 32 : 76; x < 512; x += 96) {
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
      ctx.stroke();
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * 20, y + Math.sin(a) * 20);
        ctx.lineTo(x + Math.cos(a) * 42, y + Math.sin(a) * 42);
        ctx.stroke();
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

function findBoneByHints(root: THREE.Object3D, hints: string[] = []) {
  let matched: THREE.Bone | null = null;
  root.traverse((obj) => {
    const bone = obj as THREE.Bone;
    if (matched || !bone.isBone) return;
    const name = String(bone.name || "").toLowerCase();
    if (name && hints.some((hint) => name.includes(hint))) matched = bone;
  });
  return matched;
}

function captureBoneRotation(bone: THREE.Bone | null | undefined) {
  return bone ? bone.rotation.clone() : new THREE.Euler();
}

function applyRotationOffset(bone: THREE.Bone | null | undefined, x = 0, y = 0, z = 0) {
  if (!bone) return;
  bone.rotation.x += x;
  bone.rotation.y += y;
  bone.rotation.z += z;
}

function normalizeCharacterPivot(characterRoot: THREE.Object3D) {
  characterRoot.scale.setScalar(1);
  characterRoot.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(characterRoot);
  if (box.isEmpty()) return;
  const h = Math.max(0.001, box.max.y - box.min.y);
  characterRoot.scale.setScalar(SPECTATOR_SCALE / h);
  characterRoot.updateMatrixWorld(true);
  const scaledBox = new THREE.Box3().setFromObject(characterRoot);
  const center = scaledBox.getCenter(new THREE.Vector3());
  characterRoot.position.x -= center.x;
  characterRoot.position.y -= scaledBox.min.y;
  characterRoot.position.z -= center.z;
}

function applyMurlanSeatedPose(instance: THREE.Object3D) {
  const bones = {
    hips: findBoneByHints(instance, ["hips", "pelvis", "pelvisjoint", "hip_joint"]),
    spine: findBoneByHints(instance, ["spine", "chest", "torso"]),
    head: findBoneByHints(instance, ["head", "neck", "headjoint", "head_joint"]),
    rightUpperArm: findBoneByHints(instance, ["rightarm", "arm.r", "r_upperarm", "rightshoulder", "armjointr", "arm_joint_r_1", "arm_joint_r", "shoulderr"]),
    rightForeArm: findBoneByHints(instance, ["rightforearm", "r_forearm", "rightlowerarm", "forearmr", "elbowr", "arm_joint_r_2", "arm_joint_r_3"]),
    rightHand: findBoneByHints(instance, ["righthand", "hand.r", "r_hand", "handjointr", "hand_joint_r"]),
    leftUpperArm: findBoneByHints(instance, ["leftarm", "arm.l", "l_upperarm", "leftshoulder", "armjointl", "arm_joint_l_1", "arm_joint_l", "shoulderl"]),
    leftForeArm: findBoneByHints(instance, ["leftforearm", "l_forearm", "leftlowerarm", "forearml", "elbowl", "arm_joint_l_2", "arm_joint_l_3"]),
    leftHand: findBoneByHints(instance, ["lefthand", "hand.l", "l_hand", "handjointl", "hand_joint_l"]),
    leftThigh: findBoneByHints(instance, ["leftupleg", "leftthigh", "l_thigh", "legjointl1", "leg_joint_l_1", "leg_joint_l"]),
    leftCalf: findBoneByHints(instance, ["leftleg", "leftcalf", "l_calf", "legjointl2", "leg_joint_l_2", "leg_joint_l_3"]),
    rightThigh: findBoneByHints(instance, ["rightupleg", "rightthigh", "r_thigh", "legjointr1", "leg_joint_r_1", "leg_joint_r"]),
    rightCalf: findBoneByHints(instance, ["rightleg", "rightcalf", "r_calf", "legjointr2", "leg_joint_r_2", "leg_joint_r_3"]),
  };
  applyRotationOffset(bones.hips, THREE.MathUtils.degToRad(-9), 0, 0);
  applyRotationOffset(bones.spine, THREE.MathUtils.degToRad(-3), 0, 0);
  applyRotationOffset(bones.head, THREE.MathUtils.degToRad(2), 0, 0);
  applyRotationOffset(bones.leftUpperArm, THREE.MathUtils.degToRad(-53), THREE.MathUtils.degToRad(-6), THREE.MathUtils.degToRad(-2));
  applyRotationOffset(bones.leftForeArm, THREE.MathUtils.degToRad(40), THREE.MathUtils.degToRad(-3), THREE.MathUtils.degToRad(-2));
  applyRotationOffset(bones.leftHand, THREE.MathUtils.degToRad(11), THREE.MathUtils.degToRad(-4), THREE.MathUtils.degToRad(-2));
  applyRotationOffset(bones.rightUpperArm, THREE.MathUtils.degToRad(-57), THREE.MathUtils.degToRad(6), THREE.MathUtils.degToRad(2));
  applyRotationOffset(bones.rightForeArm, THREE.MathUtils.degToRad(44), THREE.MathUtils.degToRad(3), THREE.MathUtils.degToRad(2));
  applyRotationOffset(bones.rightHand, THREE.MathUtils.degToRad(13), THREE.MathUtils.degToRad(4), THREE.MathUtils.degToRad(2));
  applyRotationOffset(bones.leftThigh, THREE.MathUtils.degToRad(-90.5), THREE.MathUtils.degToRad(9.2), THREE.MathUtils.degToRad(2.9));
  applyRotationOffset(bones.rightThigh, THREE.MathUtils.degToRad(-90.5), THREE.MathUtils.degToRad(1.7), THREE.MathUtils.degToRad(-1.1));
  applyRotationOffset(bones.leftCalf, THREE.MathUtils.degToRad(-95.1), THREE.MathUtils.degToRad(1.1), THREE.MathUtils.degToRad(0.6));
  applyRotationOffset(bones.rightCalf, THREE.MathUtils.degToRad(-95.1), THREE.MathUtils.degToRad(-1.1), THREE.MathUtils.degToRad(-0.6));
  return { bones, base: Object.fromEntries(Object.entries(bones).map(([key, bone]) => [key, captureBoneRotation(bone)])) };
}

function createSeatedFallbackSpectator(color: number) {
  const group = new THREE.Group();
  group.name = "murlan-seated-fallback";
  group.scale.setScalar(SPECTATOR_FALLBACK_SCALE);
  group.position.set(0, SPECTATOR_SEAT_Y, SPECTATOR_SEAT_Z);
  const shirt = mat(color, 0.72, 0.02);
  const skin = mat(0xf1d6bd, 0.7, 0.02);
  const dark = mat(0x171717, 0.68, 0.03);
  const sleeve = mat(0xe5e7eb, 0.68, 0.02);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.54, 8, 12), shirt);
  torso.position.set(0, 0.78, -0.05);
  torso.rotation.x = THREE.MathUtils.degToRad(-9);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 12), skin);
  head.position.set(0, 1.22, -0.1);
  const leftThigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.42, 6, 10), dark);
  const rightThigh = leftThigh.clone();
  leftThigh.position.set(-0.085, 0.45, 0.14);
  rightThigh.position.set(0.085, 0.45, 0.14);
  leftThigh.rotation.x = THREE.MathUtils.degToRad(88);
  rightThigh.rotation.x = THREE.MathUtils.degToRad(88);
  const leftCalf = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.46, 6, 10), dark);
  const rightCalf = leftCalf.clone();
  leftCalf.position.set(-0.085, 0.22, 0.34);
  rightCalf.position.set(0.085, 0.22, 0.34);
  leftCalf.rotation.x = THREE.MathUtils.degToRad(8);
  rightCalf.rotation.x = THREE.MathUtils.degToRad(8);
  const leftArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.4, 6, 10), sleeve);
  leftArm.name = "leftCheerArm";
  const rightArm = leftArm.clone();
  rightArm.name = "rightCheerArm";
  leftArm.position.set(-0.22, 0.72, 0.02);
  rightArm.position.set(0.22, 0.72, 0.02);
  leftArm.rotation.set(THREE.MathUtils.degToRad(-53), THREE.MathUtils.degToRad(-6), THREE.MathUtils.degToRad(-8));
  rightArm.rotation.set(THREE.MathUtils.degToRad(-57), THREE.MathUtils.degToRad(6), THREE.MathUtils.degToRad(8));
  group.add(shadow(torso), shadow(head), shadow(leftThigh), shadow(rightThigh), shadow(leftCalf), shadow(rightCalf), shadow(leftArm), shadow(rightArm));
  return group;
}

function loadSeatedCharacterTemplate(loader: GLTFLoader, modelUrl: string) {
  const cached = SEATED_CHARACTER_TEMPLATE_CACHE.get(modelUrl);
  if (cached) return cached;
  const promise = new Promise<THREE.Object3D>((resolve, reject) => {
    loader.setCrossOrigin("anonymous").load(modelUrl, (gltf) => resolve(gltf.scene), undefined, reject);
  });
  SEATED_CHARACTER_TEMPLATE_CACHE.set(modelUrl, promise);
  return promise;
}

function makeChair(color: number) {
  const chair = new THREE.Group();
  const shell = mat(color, 0.74, 0.03);
  const metal = mat(0x94a3b8, 0.44, 0.18);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.018, 0.13), shell);
  seat.position.set(0, 0.035, 0.02);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.11, 0.018), shell);
  back.position.set(0, 0.095, -0.045);
  back.rotation.x = THREE.MathUtils.degToRad(-8);
  [-0.055, 0.055].forEach((x) => [-0.035, 0.07].forEach((z) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.08, 8), metal);
    leg.position.set(x, -0.005, z);
    chair.add(shadow(leg));
  }));
  chair.add(shadow(seat), shadow(back));
  return chair;
}

function attachMurlanSeatedSpectator(chair: THREE.Group, loader: GLTFLoader, modelUrl: string, index: number, kitColor: number) {
  const root = new THREE.Group();
  root.name = "murlan-seated-spectator";
  root.position.set(0, SPECTATOR_SEAT_Y, SPECTATOR_SEAT_Z);
  root.rotation.y = Math.PI;
  const fallback = createSeatedFallbackSpectator(kitColor);
  fallback.rotation.y = Math.PI;
  const spectator: SeatedSpectator = { root, fallback, instance: null, bones: {}, base: {}, index };
  chair.add(root, fallback);
  loadSeatedCharacterTemplate(loader, modelUrl).then((template) => {
    const instance = cloneSkeleton(template);
    instance.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((raw) => {
        const matRef = raw as THREE.MeshStandardMaterial;
        if (matRef?.map) matRef.map.colorSpace = THREE.SRGBColorSpace;
        if (matRef) matRef.needsUpdate = true;
      });
    });
    normalizeCharacterPivot(instance);
    instance.position.y -= 0.01;
    const rig = applyMurlanSeatedPose(instance);
    spectator.instance = instance;
    spectator.bones = rig.bones;
    spectator.base = rig.base;
    root.add(instance);
    fallback.visible = false;
  }).catch(() => { fallback.visible = true; });
  return spectator;
}

function applySeatedSpectatorPose(spectator: SeatedSpectator, cheerTime = 0) {
  const cheer = cheerTime > 0;
  const phase = performance.now() * 0.008 + spectator.index * 0.73;
  const wave = Math.sin(phase);
  const standUp = cheer ? THREE.MathUtils.smoothstep(cheerTime, 0.34, 0.95) * THREE.MathUtils.smoothstep(3.0 - cheerTime, 0.12, 0.5) : 0;
  const bounce = Math.abs(wave) * (cheer ? 0.007 : 0.0025);
  spectator.root.position.y = SPECTATOR_SEAT_Y + standUp * 0.11 + bounce;
  spectator.root.position.z = SPECTATOR_SEAT_Z - standUp * 0.03;
  spectator.fallback.position.y = SPECTATOR_SEAT_Y + standUp * 0.11 + bounce;
  spectator.fallback.position.z = SPECTATOR_SEAT_Z - standUp * 0.03;
  spectator.fallback.scale.y = SPECTATOR_FALLBACK_SCALE * (1 + standUp * 0.18);
  const leftUpperArm = spectator.bones.leftUpperArm;
  const rightUpperArm = spectator.bones.rightUpperArm;
  const leftForeArm = spectator.bones.leftForeArm;
  const rightForeArm = spectator.bones.rightForeArm;
  if (leftUpperArm && spectator.base.leftUpperArm) {
    leftUpperArm.rotation.x = THREE.MathUtils.lerp(spectator.base.leftUpperArm.x, -2.75 + wave * 0.14, standUp);
    leftUpperArm.rotation.z = THREE.MathUtils.lerp(spectator.base.leftUpperArm.z - Math.abs(wave) * 0.18, -0.32 + wave * 0.16, standUp);
  }
  if (rightUpperArm && spectator.base.rightUpperArm) {
    rightUpperArm.rotation.x = THREE.MathUtils.lerp(spectator.base.rightUpperArm.x, -2.75 - wave * 0.14, standUp);
    rightUpperArm.rotation.z = THREE.MathUtils.lerp(spectator.base.rightUpperArm.z + Math.abs(wave) * 0.18, 0.32 + wave * 0.16, standUp);
  }
  if (leftForeArm && spectator.base.leftForeArm) leftForeArm.rotation.x = THREE.MathUtils.lerp(spectator.base.leftForeArm.x, -0.3 + wave * 0.22, standUp);
  if (rightForeArm && spectator.base.rightForeArm) rightForeArm.rotation.x = THREE.MathUtils.lerp(spectator.base.rightForeArm.x, -0.3 - wave * 0.22, standUp);
  spectator.fallback.children.forEach((child) => {
    if (child.name === "leftCheerArm") child.rotation.x = THREE.MathUtils.lerp(THREE.MathUtils.degToRad(-53), -2.55 + wave * 0.18, standUp);
    if (child.name === "rightCheerArm") child.rotation.x = THREE.MathUtils.lerp(THREE.MathUtils.degToRad(-57), -2.55 - wave * 0.18, standUp);
  });
}

function triggerCrowdCheer(stadium: StadiumRig) {
  stadium.cheerTime = 3.0;
}

function updateStadiumCrowd(stadium: StadiumRig, dt: number) {
  stadium.cheerTime = Math.max(0, stadium.cheerTime - dt);
  stadium.spectators.forEach((spectator) => applySeatedSpectatorPose(spectator, stadium.cheerTime));
}

function clampPlayerPosition(p: THREE.Vector3) {
  const x = FIELD_W / 2 - PLAYER_RADIUS - 0.08;
  const z = FIELD_H / 2 - PLAYER_RADIUS - 0.08;
  p.x = THREE.MathUtils.clamp(p.x, -x, x);
  p.z = THREE.MathUtils.clamp(p.z, -z, z);
  p.y = GROUND_Y;
}

function makeFallback(team: Team) {
  const g = new THREE.Group();
  const color = team === "blue" ? 0x1d69ff : 0xd92f2f;
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.35, 8, 14), mat(color));
  body.position.y = 0.55;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.07, 18, 12), mat(0xf1d6bd));
  head.position.y = 0.83;
  const legL = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.32, 6, 10), mat(0x202020));
  const legR = legL.clone();
  legL.position.set(-0.045, 0.22, 0);
  legR.position.set(0.045, 0.22, 0);
  g.add(shadow(body), shadow(head), shadow(legL), shadow(legR));
  return g;
}

function createPlayer(scene: THREE.Scene, loader: GLTFLoader, team: Team, start: THREE.Vector3, onLoaded: () => void): Player {
  const root = new THREE.Group();
  root.position.copy(start).setY(GROUND_Y);
  scene.add(root);

  const fallback = makeFallback(team);
  root.add(fallback);

  const p: Player = {
    team,
    root,
    model: null,
    fallback,
    mixer: null,
    actions: {},
    current: "Idle",
    bones: {},
    bind: new WeakMap(),
    pos: start.clone().setY(GROUND_Y),
    vel: new THREE.Vector3(),
    dir: team === "blue" ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 0, 1),
    targetDir: team === "blue" ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 0, 1),
    speed: 0,
    radius: PLAYER_RADIUS,
    kickTime: 0,
    kickQueued: false,
    kickFired: false,
    kickFoot: "right",
    queuedShotDir: null,
    queuedShotPower: 0,
    queuedShotLift: 0,
    tackleTime: 0,
    tackleQueued: false,
    tackleFired: false,
    fallTime: 0,
    fallDir: new THREE.Vector3(),
    loaded: false,
  };

  loader.setCrossOrigin("anonymous").load(
    HUMAN_URL,
    (gltf) => {
      const model = gltf.scene;
      normalizeAnimatedHuman(model, 0.92);
      tintPlayer(model, team);
      shadow(model);
      root.add(model);
      fallback.visible = false;
      p.model = model;
      p.bones = findBones(model);
      p.bind = saveBind(model);
      p.mixer = new THREE.AnimationMixer(model);

      const clipByName = new Map(gltf.animations.map((clip) => [clip.name.toLowerCase(), clip]));
      const aliases: Record<AnimName, string[]> = {
        Idle: ["idle"],
        Walk: ["walk", "walking"],
        Run: ["run", "running"],
      };

      (Object.keys(aliases) as AnimName[]).forEach((name) => {
        const clip = aliases[name].map((a) => clipByName.get(a)).find(Boolean);
        if (!clip || !p.mixer) return;
        const action = p.mixer.clipAction(clip);
        action.enabled = true;
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.clampWhenFinished = false;
        action.setEffectiveWeight(name === "Idle" ? 1 : 0);
        action.play();
        p.actions[name] = action;
      });

      p.loaded = true;
      onLoaded();
    },
    undefined,
    () => {
      p.loaded = false;
      fallback.visible = true;
      onLoaded();
    }
  );

  return p;
}

function setAction(p: Player, next: AnimName, blend = 0.18) {
  if (p.current === next || !p.actions[next]) return;
  const prev = p.actions[p.current];
  const nextAction = p.actions[next];
  if (prev && nextAction) {
    nextAction.enabled = true;
    nextAction.reset();
    nextAction.setEffectiveTimeScale(1);
    nextAction.setEffectiveWeight(1);
    prev.crossFadeTo(nextAction, blend, false);
    nextAction.play();
  }
  p.current = next;
}

function wantedAction(p: Player): AnimName {
  if (p.fallTime > 0 || p.kickTime > 0 || p.tackleTime > 0) return "Idle";
  if (p.speed > WALK_SPEED * 1.02) return "Run";
  if (p.speed > 0.07) return "Walk";
  return "Idle";
}

function tuneActionSpeed(p: Player) {
  const walk = p.actions.Walk;
  const run = p.actions.Run;
  if (walk) walk.timeScale = THREE.MathUtils.clamp(p.speed / WALK_SPEED, 0.7, 1.35);
  if (run) run.timeScale = THREE.MathUtils.clamp(p.speed / SPRINT_SPEED, 0.75, 1.28);
}

function applyKickOverlay(p: Player) {
  if (!p.model || p.kickTime <= 0) return;
  const t = 1 - p.kickTime / 0.48;
  const drawBack = Math.max(0, Math.sin(THREE.MathUtils.clamp(t / 0.42, 0, 1) * Math.PI));
  const strike = Math.max(0, Math.sin(THREE.MathUtils.clamp((t - 0.2) / 0.62, 0, 1) * Math.PI));
  const follow = Math.max(0, Math.sin(THREE.MathUtils.clamp((t - 0.52) / 0.48, 0, 1) * Math.PI));
  const kickUpLeg = p.kickFoot === "left" ? p.bones.leftUpLeg : p.bones.rightUpLeg;
  const kickLeg = p.kickFoot === "left" ? p.bones.leftLeg : p.bones.rightLeg;
  const kickFoot = p.kickFoot === "left" ? p.bones.leftFoot : p.bones.rightFoot;
  const plantUpLeg = p.kickFoot === "left" ? p.bones.rightUpLeg : p.bones.leftUpLeg;
  const plantLeg = p.kickFoot === "left" ? p.bones.rightLeg : p.bones.leftLeg;
  const mirror = p.kickFoot === "left" ? -1 : 1;

  if (p.bones.hips) {
    p.bones.hips.rotation.x += -0.04 * strike;
    p.bones.hips.rotation.z += mirror * 0.06 * strike;
  }
  if (p.bones.spine) {
    p.bones.spine.rotation.x += -0.06 * strike;
    p.bones.spine.rotation.z += -mirror * 0.05 * strike;
  }
  if (kickUpLeg) kickUpLeg.rotation.x += -0.86 * drawBack + 1.55 * strike + 0.45 * follow;
  if (kickLeg) kickLeg.rotation.x += 0.5 * drawBack - 0.94 * strike - 0.25 * follow;
  if (kickFoot) kickFoot.rotation.x += -0.58 * strike - 0.22 * follow;
  if (plantUpLeg) plantUpLeg.rotation.x += -0.18 * strike;
  if (plantLeg) plantLeg.rotation.x += 0.14 * strike;
}

function applyTackleOverlay(p: Player) {
  if (!p.model || p.tackleTime <= 0) return;
  const t = 1 - p.tackleTime / 0.56;
  const lunge = Math.sin(THREE.MathUtils.clamp(t, 0, 1) * Math.PI);
  const slide = THREE.MathUtils.smoothstep(t, 0.15, 0.9);
  if (p.bones.hips) {
    p.bones.hips.rotation.x += -0.48 * lunge;
    p.bones.hips.position.y -= 0.05 * lunge;
  }
  if (p.bones.spine) p.bones.spine.rotation.x += 0.42 * lunge;
  if (p.bones.rightUpLeg) p.bones.rightUpLeg.rotation.x += 1.15 * lunge;
  if (p.bones.rightLeg) p.bones.rightLeg.rotation.x += -0.35 * lunge;
  if (p.bones.leftUpLeg) p.bones.leftUpLeg.rotation.x += -0.82 * lunge;
  if (p.bones.leftLeg) p.bones.leftLeg.rotation.x += 0.72 * lunge;
  p.root.position.addScaledVector(p.dir, 0.035 * slide);
}

function applyFallPose(p: Player) {
  if (p.fallTime <= 0) return;
  const t = 1 - p.fallTime / 1.45;
  const down = THREE.MathUtils.smoothstep(t, 0.0, 0.45);
  const recover = THREE.MathUtils.smoothstep(t, 0.72, 1.0);
  const fallAmount = down * (1 - recover);
  p.root.rotation.x = -Math.PI * 0.5 * fallAmount;
  p.root.rotation.z = (p.fallDir.x >= 0 ? -1 : 1) * 0.25 * fallAmount;
  p.root.position.y = GROUND_Y + 0.03 * fallAmount;
  if (p.bones.hips) p.bones.hips.rotation.x += 0.35 * fallAmount;
  if (p.bones.spine) p.bones.spine.rotation.x += -0.28 * fallAmount;
  if (p.bones.rightUpLeg) p.bones.rightUpLeg.rotation.x += 0.6 * fallAmount;
  if (p.bones.leftUpLeg) p.bones.leftUpLeg.rotation.x += -0.35 * fallAmount;
}

function updateFallbackWalk(p: Player) {
  const legs = p.fallback.children.filter((o) => o instanceof THREE.Mesh).slice(-2) as THREE.Mesh[];
  const t = performance.now() * (p.speed > WALK_SPEED ? 0.013 : 0.009);
  const s = Math.sin(t);
  if (legs[0]) legs[0].rotation.x = s * p.speed * 0.62;
  if (legs[1]) legs[1].rotation.x = -s * p.speed * 0.62;
  if (p.fallTime > 0) p.fallback.rotation.x = -Math.PI * 0.48 * (1 - p.fallTime / 1.45);
  else p.fallback.rotation.x = 0;
}

function updatePlayerAnimation(p: Player, dt: number) {
  p.pos.y = GROUND_Y;
  p.root.position.copy(p.pos);
  p.root.rotation.x = 0;
  p.root.rotation.z = 0;

  if (p.fallTime <= 0 && p.targetDir.lengthSq() > 0.001) p.dir.lerp(p.targetDir, 1 - Math.pow(0.001, dt)).normalize();
  p.root.rotation.y = Math.atan2(p.dir.x, p.dir.z);

  const next = wantedAction(p);
  setAction(p, next);
  tuneActionSpeed(p);
  p.mixer?.update(dt);
  applyKickOverlay(p);
  applyTackleOverlay(p);
  applyFallPose(p);
  updateFallbackWalk(p);

  if (p.kickTime > 0) p.kickTime = Math.max(0, p.kickTime - dt);
  if (p.tackleTime > 0) p.tackleTime = Math.max(0, p.tackleTime - dt);
  if (p.fallTime > 0) p.fallTime = Math.max(0, p.fallTime - dt);
}

function getFootWorld(p: Player, footSide: KickFoot) {
  const foot = footSide === "left" ? p.bones.leftFoot : p.bones.rightFoot;
  if (foot) {
    foot.updateWorldMatrix(true, false);
    return foot.getWorldPosition(new THREE.Vector3());
  }
  const side = new THREE.Vector3(p.dir.z, 0, -p.dir.x).normalize().multiplyScalar(footSide === "left" ? -0.055 : 0.055);
  return p.pos.clone().addScaledVector(p.dir, 0.18).add(side).setY(0.08);
}

function chooseKickFoot(p: Player, ball: BallState, shotDir?: THREE.Vector3 | null): KickFoot {
  const left = getFootWorld(p, "left");
  const right = getFootWorld(p, "right");
  const ballPos = ball.object.position;
  const dLeft = left.distanceToSquared(ballPos);
  const dRight = right.distanceToSquared(ballPos);
  if (shotDir && shotDir.lengthSq() > 0.001 && Math.abs(dLeft - dRight) < 0.01) {
    const side = new THREE.Vector3(shotDir.z, 0, -shotDir.x).normalize();
    const rel = ballPos.clone().sub(p.pos).setY(0);
    return rel.dot(side) < 0 ? "left" : "right";
  }
  return dLeft <= dRight ? "left" : "right";
}

function makeNetPlane(width: number, height: number, rows: number, cols: number, color = 0xffffff) {
  const group = new THREE.Group();
  const lineMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55 });
  for (let i = 0; i <= cols; i++) {
    const x = -width / 2 + (i / cols) * width;
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, 0, 0), new THREE.Vector3(x, height, 0)]), lineMat));
  }
  for (let j = 0; j <= rows; j++) {
    const y = (j / rows) * height;
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-width / 2, y, 0), new THREE.Vector3(width / 2, y, 0)]), lineMat));
  }
  for (let i = -cols; i <= cols; i += 2) {
    const x1 = THREE.MathUtils.clamp(-width / 2 + i * (width / cols) * 0.5, -width / 2, width / 2);
    const x2 = THREE.MathUtils.clamp(x1 + width / 3, -width / 2, width / 2);
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x1, 0, 0), new THREE.Vector3(x2, height, 0)]), lineMat));
  }
  return group;
}

function makeSaggingNet(width: number, height: number, depth: number, dir: number) {
  const group = new THREE.Group();
  const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.52 });
  const cols = 12;
  const rows = 7;
  for (let i = 0; i <= cols; i++) {
    const x = -width / 2 + (i / cols) * width;
    const pts: THREE.Vector3[] = [];
    for (let j = 0; j <= rows; j++) {
      const v = j / rows;
      const sag = Math.sin(v * Math.PI) * 0.045;
      pts.push(new THREE.Vector3(x, v * height, dir * (depth + sag)));
    }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
  }
  for (let j = 0; j <= rows; j++) {
    const v = j / rows;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= cols; i++) {
      const u = i / cols;
      const x = -width / 2 + u * width;
      const sag = Math.sin(v * Math.PI) * 0.045;
      pts.push(new THREE.Vector3(x, v * height, dir * (depth + sag)));
    }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
  }
  return group;
}

function makeFencePanel(width: number, height: number) {
  const group = new THREE.Group();
  const lineMat = new THREE.LineBasicMaterial({ color: 0xb8c5c7, transparent: true, opacity: 0.42 });
  const cols = Math.max(6, Math.round(width / 0.16));
  for (let i = 0; i <= cols; i++) {
    const x = -width / 2 + (i / cols) * width;
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, 0, 0), new THREE.Vector3(x, height, 0)]), lineMat));
  }
  for (let j = 0; j <= 5; j++) {
    const y = (j / 5) * height;
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-width / 2, y, 0), new THREE.Vector3(width / 2, y, 0)]), lineMat));
  }
  return group;
}

function billboard(scene: THREE.Scene, text: string, x: number, z: number, rotY: number, color: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "white";
  ctx.font = "900 46px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 64);
  const tex = new THREE.CanvasTexture(canvas);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.21), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
  mesh.position.set(x, 0.24, z);
  mesh.rotation.y = rotY;
  scene.add(mesh);
}

function flag(scene: THREE.Scene, x: number, z: number) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.46, 10), mat(0xffffff, 0.55, 0.05));
  pole.position.set(x, 0.23, z);
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.09), new THREE.MeshStandardMaterial({ color: 0xfff200, side: THREE.DoubleSide }));
  cloth.position.set(x + (x > 0 ? -0.08 : 0.08), 0.4, z);
  cloth.rotation.y = x > 0 ? Math.PI / 2 : -Math.PI / 2;
  scene.add(shadow(pole), shadow(cloth));
}

function lamp(scene: THREE.Scene, x: number, z: number) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 1.9, 12), mat(0x50575d, 0.45, 0.35));
  pole.position.set(x, 0.95, z);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.12), mat(0x22282d, 0.45, 0.2));
  head.position.set(x, 1.9, z);
  const light = new THREE.PointLight(0xdbefff, 0.55, 3.2);
  light.position.set(x, 1.82, z);
  scene.add(shadow(pole), shadow(head), light);
}

function makeCylinderBetween(a: THREE.Vector3, b: THREE.Vector3, radius: number, matRef: THREE.Material) {
  const dir = b.clone().sub(a);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, Math.max(0.001, dir.length()), 18), matRef);
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return shadow(mesh);
}

function netPoint(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, u: number, v: number) {
  const bottom = a.clone().lerp(b, u);
  const top = d.clone().lerp(c, u);
  return bottom.lerp(top, v);
}

function makeFreeKickNetSurface(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, cols: number, rows: number) {
  const group = new THREE.Group();
  const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.58 });
  const add = (p1: THREE.Vector3, p2: THREE.Vector3) => group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([p1, p2]), lineMat));
  for (let i = 0; i <= cols; i++) {
    const u = i / cols;
    add(netPoint(a, b, c, d, u, 0), netPoint(a, b, c, d, u, 1));
  }
  for (let j = 0; j <= rows; j++) {
    const v = j / rows;
    add(netPoint(a, b, c, d, 0, v), netPoint(a, b, c, d, 1, v));
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const u0 = i / cols;
      const u1 = (i + 1) / cols;
      const v0 = j / rows;
      const v1 = (j + 1) / rows;
      add(netPoint(a, b, c, d, (u0 + u1) / 2, v0), netPoint(a, b, c, d, u1, (v0 + v1) / 2));
      add(netPoint(a, b, c, d, u1, (v0 + v1) / 2), netPoint(a, b, c, d, (u0 + u1) / 2, v1));
      add(netPoint(a, b, c, d, (u0 + u1) / 2, v1), netPoint(a, b, c, d, u0, (v0 + v1) / 2));
      add(netPoint(a, b, c, d, u0, (v0 + v1) / 2), netPoint(a, b, c, d, (u0 + u1) / 2, v0));
    }
  }
  return group;
}

function makeGoal(scene: THREE.Scene, z: number, dir: number) {
  const root = new THREE.Group();
  root.position.z = z;
  const white = mat(0xffffff, 0.4, 0.18);
  const rear = mat(0xcbd5e1, 0.46, 0.28);
  const postR = 0.034;
  const backScale = 0.82;
  const backW = GOAL_W * backScale;
  const backH = GOAL_H * backScale;
  const FL = new THREE.Vector3(-GOAL_W / 2, 0, 0);
  const FR = new THREE.Vector3(GOAL_W / 2, 0, 0);
  const FLT = new THREE.Vector3(-GOAL_W / 2, GOAL_H, 0);
  const FRT = new THREE.Vector3(GOAL_W / 2, GOAL_H, 0);
  const BL = new THREE.Vector3(-backW / 2, 0.03, dir * GOAL_D);
  const BR = new THREE.Vector3(backW / 2, 0.03, dir * GOAL_D);
  const BLT = new THREE.Vector3(-backW / 2, backH, dir * GOAL_D);
  const BRT = new THREE.Vector3(backW / 2, backH, dir * GOAL_D);
  root.add(
    makeCylinderBetween(FL, FLT, postR, white),
    makeCylinderBetween(FR, FRT, postR, white),
    makeCylinderBetween(FLT, FRT, postR, white),
    makeCylinderBetween(BL, BLT, postR * 0.48, rear),
    makeCylinderBetween(BR, BRT, postR * 0.48, rear),
    makeCylinderBetween(BLT, BRT, postR * 0.48, rear),
    makeCylinderBetween(FLT, BLT, postR * 0.42, rear),
    makeCylinderBetween(FRT, BRT, postR * 0.42, rear),
    makeCylinderBetween(FL, BL, postR * 0.36, rear),
    makeCylinderBetween(FR, BR, postR * 0.36, rear),
    makeFreeKickNetSurface(BL, BR, BRT, BLT, 18, 10),
    makeFreeKickNetSurface(FLT, FRT, BRT, BLT, 18, 8),
    makeFreeKickNetSurface(FL, BL, BLT, FLT, 8, 10),
    makeFreeKickNetSurface(FR, BR, BRT, FRT, 8, 10)
  );
  scene.add(root);
}

function makePitch(scene: THREE.Scene) {
  const grassA = mat(0x1d7d39, 0.95, 0);
  const grassB = mat(0x16692e, 0.95, 0);
  for (let i = 0; i < 8; i++) {
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(FIELD_W, FIELD_H / 8), i % 2 ? grassA : grassB);
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.z = -FIELD_H / 2 + FIELD_H / 16 + (i * FIELD_H) / 8;
    stripe.receiveShadow = true;
    scene.add(stripe);
  }

  const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
  const addLine = (pts: THREE.Vector3[]) => scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(p.x, 0.014, p.z))), lineMat));
  const w = FIELD_W / 2;
  const h = FIELD_H / 2;
  addLine([new THREE.Vector3(-w, 0, -h), new THREE.Vector3(w, 0, -h), new THREE.Vector3(w, 0, h), new THREE.Vector3(-w, 0, h), new THREE.Vector3(-w, 0, -h)]);
  addLine([new THREE.Vector3(-w, 0, 0), new THREE.Vector3(w, 0, 0)]);
  addLine(new THREE.EllipseCurve(0, 0, 0.42, 0.42, 0, Math.PI * 2).getPoints(72).map((p) => new THREE.Vector3(p.x, 0, p.y)));
  addLine([new THREE.Vector3(-0.55, 0, -h), new THREE.Vector3(-0.55, 0, -h + 0.5), new THREE.Vector3(0.55, 0, -h + 0.5), new THREE.Vector3(0.55, 0, -h)]);
  addLine([new THREE.Vector3(-0.55, 0, h), new THREE.Vector3(-0.55, 0, h - 0.5), new THREE.Vector3(0.55, 0, h - 0.5), new THREE.Vector3(0.55, 0, h)]);

  makeGoal(scene, -h - 0.01, -1);
  makeGoal(scene, h + 0.01, 1);

  const wallMat = mat(0x0e3f22, 0.82, 0.02);
  const north = new THREE.Mesh(new THREE.BoxGeometry(FIELD_W + 0.32, 0.1, 0.08), wallMat);
  const south = north.clone();
  const east = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, FIELD_H + 0.32), wallMat);
  const west = east.clone();
  north.position.set(0, 0.05, -h - 0.16);
  south.position.set(0, 0.05, h + 0.16);
  east.position.set(w + 0.16, 0.05, 0);
  west.position.set(-w - 0.16, 0.05, 0);
  scene.add(shadow(north), shadow(south), shadow(east), shadow(west));

  const fn = makeFencePanel(FIELD_W + 0.32, 0.82);
  const fs = makeFencePanel(FIELD_W + 0.32, 0.82);
  const fe = makeFencePanel(FIELD_H + 0.32, 0.82);
  const fw = makeFencePanel(FIELD_H + 0.32, 0.82);
  fn.position.set(0, 0.1, -h - 0.2);
  fs.position.set(0, 0.1, h + 0.2);
  fe.position.set(w + 0.2, 0.1, 0);
  fw.position.set(-w - 0.2, 0.1, 0);
  fe.rotation.y = Math.PI / 2;
  fw.rotation.y = Math.PI / 2;
  scene.add(fn, fs, fe, fw);

  const poleMat = mat(0x879196, 0.46, 0.34);
  [[-w - 0.2, -h - 0.2], [w + 0.2, -h - 0.2], [-w - 0.2, h + 0.2], [w + 0.2, h + 0.2], [0, -h - 0.2], [0, h + 0.2], [-w - 0.2, 0], [w + 0.2, 0]].forEach(([x, z]) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.98, 12), poleMat);
    pole.position.set(x, 0.49, z);
    scene.add(shadow(pole));
  });

  flag(scene, -w, -h); flag(scene, w, -h); flag(scene, -w, h); flag(scene, w, h);
  lamp(scene, -w - 0.34, -h - 0.34); lamp(scene, w + 0.34, -h - 0.34); lamp(scene, -w - 0.34, h + 0.34); lamp(scene, w + 0.34, h + 0.34);
  billboard(scene, "REAL WALK", -0.75, -h - 0.215, 0, 0x1d69ff);
  billboard(scene, "TACKLE", 0.2, -h - 0.215, 0, 0xd92f2f);
  billboard(scene, "BALL SPIN", 1.05, -h - 0.215, 0, 0x0f172a);
  billboard(scene, "SAG NETS", -0.45, h + 0.215, Math.PI, 0x166534);
  billboard(scene, "MOBILE 1V1", 0.55, h + 0.215, Math.PI, 0x7c2d12);
}

function makeGoalRushStadium(scene: THREE.Scene, loader: GLTFLoader): StadiumRig {
  const spectators: SeatedSpectator[] = [];
  const concrete = mat(0x64748b, 0.86, 0.04);
  const riserMat = mat(0x475569, 0.8, 0.04);
  const aisleMat = mat(0xf8fafc, 0.72, 0.01);
  const railMat = mat(0xdbe4ec, 0.42, 0.18);
  const chairColors = [0x1d4ed8, 0xffffff];
  const rows = 5;
  const rowDepth = 0.22;
  const rowRise = 0.11;
  const sides = [
    { name: "north", pos: new THREE.Vector3(0, 0, -FIELD_H / 2 - 0.72), rot: 0, width: FIELD_W + 1.1 },
    { name: "south", pos: new THREE.Vector3(0, 0, FIELD_H / 2 + 0.72), rot: Math.PI, width: FIELD_W + 1.1 },
    { name: "east", pos: new THREE.Vector3(FIELD_W / 2 + 0.72, 0, 0), rot: Math.PI / 2, width: FIELD_H + 0.8 },
    { name: "west", pos: new THREE.Vector3(-FIELD_W / 2 - 0.72, 0, 0), rot: -Math.PI / 2, width: FIELD_H + 0.8 },
  ];
  let characterIndex = 0;
  sides.forEach((side) => {
    const stands = new THREE.Group();
    stands.name = `goal-rush-${side.name}-free-kick-stands`;
    stands.position.copy(side.pos);
    stands.rotation.y = side.rot;
    const cols = Math.max(8, Math.floor(side.width / 0.22));
    const aisleCols = [Math.floor(cols * 0.28), Math.floor(cols * 0.72)];
    for (let row = 0; row < rows; row++) {
      const z = -row * rowDepth;
      const y = 0.14 + row * rowRise;
      const tread = new THREE.Mesh(new THREE.BoxGeometry(side.width, 0.06, rowDepth), concrete);
      tread.position.set(0, y, z);
      const riser = new THREE.Mesh(new THREE.BoxGeometry(side.width, rowRise, 0.035), riserMat);
      riser.position.set(0, y - 0.015, z + rowDepth * 0.46);
      stands.add(shadow(tread), shadow(riser));
    }
    for (let col = 0; col < cols; col++) {
      if (aisleCols.some((aisle) => Math.abs(col - aisle) <= 1)) continue;
      const x = (col - (cols - 1) / 2) * (side.width / cols);
      let rowSpectators = 0;
      for (let row = 0; row < rows; row++) {
        const chair = makeChair(chairColors[(row + col) % chairColors.length]);
        chair.position.set(x, 0.18 + row * rowRise, -row * rowDepth + 0.02);
        stands.add(chair);
        const shouldSeatHuman = row < SPECTATOR_ROWS_FILLED && rowSpectators < SPECTATORS_PER_ROW_TARGET && (col + row) % 2 === 0;
        if (shouldSeatHuman) {
          const kit = MURLAN_CHARACTER_COLORS[characterIndex % MURLAN_CHARACTER_COLORS.length];
          const url = MURLAN_CHARACTER_URLS[characterIndex % Math.max(1, MURLAN_CHARACTER_URLS.length)] ?? HUMAN_URL;
          spectators.push(attachMurlanSeatedSpectator(chair, loader, url, characterIndex, kit));
          characterIndex += 1;
          rowSpectators += 1;
        }
      }
    }
    aisleCols.forEach((aisle) => {
      const x = (aisle - (cols - 1) / 2) * (side.width / cols);
      for (let row = 0; row < rows; row++) {
        const stair = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.045, rowDepth * 0.76), aisleMat);
        stair.position.set(x, 0.22 + row * rowRise, -row * rowDepth + 0.02);
        stands.add(shadow(stair));
      }
      [-0.16, 0.16].forEach((offset) => {
        const rail = makeCylinderBetween(
          new THREE.Vector3(x + offset, 0.36, rowDepth * 0.28),
          new THREE.Vector3(x + offset, 0.36 + rows * rowRise, -(rows - 1) * rowDepth + rowDepth * 0.25),
          0.008,
          railMat
        );
        stands.add(rail);
      });
    });
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(side.width + 0.25, rows * rowRise + 0.38, 0.08), riserMat);
    backWall.position.set(0, 0.5 + rows * rowRise * 0.45, -(rows - 1) * rowDepth - 0.22);
    const frontRail = new THREE.Mesh(new THREE.BoxGeometry(side.width + 0.18, 0.035, 0.035), railMat);
    frontRail.position.set(0, 0.42, 0.24);
    stands.add(shadow(backWall), shadow(frontRail));
    scene.add(stands);
  });
  return { spectators, cheerTime: 0 };
}

function makeBall(scene: THREE.Scene): BallState {
  const object = new THREE.Group();
  const ballMat = new THREE.MeshStandardMaterial({ map: createSoccerBallTexture(), roughness: 0.42, metalness: 0.02 });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, 48, 32), ballMat);
  object.add(shadow(ball));
  object.position.set(0, BALL_RADIUS, 0);
  scene.add(object);
  return { object, vel: new THREE.Vector3(), spin: new THREE.Vector3(), lastSafe: object.position.clone(), stuckTimer: 0 };
}

function movePlayer(p: Player, inputDir: THREE.Vector3, speed: number, dt: number) {
  if (p.fallTime > 0) {
    p.vel.multiplyScalar(Math.pow(0.04, dt));
    p.speed = 0;
    return;
  }
  if (inputDir.lengthSq() > 0.001) {
    p.targetDir.copy(inputDir).normalize();
    p.vel.lerp(inputDir.clone().normalize().multiplyScalar(speed), 1 - Math.pow(0.005, dt));
  } else {
    p.vel.multiplyScalar(Math.pow(0.0008, dt));
  }
  if (p.tackleTime > 0) p.vel.addScaledVector(p.dir, 0.018);
  p.speed = p.vel.length();
  p.pos.addScaledVector(p.vel, dt);
  clampPlayerPosition(p.pos);
}

function separatePlayers(a: Player, b: Player) {
  if (a.fallTime > 0 || b.fallTime > 0) return;
  TMP.copy(a.pos).sub(b.pos);
  TMP.y = 0;
  const d = TMP.length();
  const minD = a.radius + b.radius;
  if (d > 0.0001 && d < minD) {
    TMP.normalize();
    const push = (minD - d) * 0.5;
    a.pos.addScaledVector(TMP, push);
    b.pos.addScaledVector(TMP, -push);
    clampPlayerPosition(a.pos);
    clampPlayerPosition(b.pos);
  }
}

function playerBallCollision(p: Player, ball: BallState) {
  TMP.set(ball.object.position.x - p.pos.x, 0, ball.object.position.z - p.pos.z);
  const d = TMP.length();
  const minD = p.radius + BALL_RADIUS;
  if (d > 0.0001 && d < minD) {
    TMP.normalize();
    ball.object.position.x = p.pos.x + TMP.x * minD;
    ball.object.position.z = p.pos.z + TMP.z * minD;
    const along = p.vel.dot(TMP);
    const push = Math.max(0.18, along * 0.65);
    ball.vel.x += TMP.x * push;
    ball.vel.z += TMP.z * push;
    ball.spin.z -= TMP.x * push * 8;
    ball.spin.x += TMP.z * push * 8;
  }
}

function tryKickAtFoot(p: Player, ball: BallState, fallbackPower: number) {
  const shotDir = p.queuedShotDir?.clone();
  p.kickFoot = chooseKickFoot(p, ball, shotDir);
  const foot = getFootWorld(p, p.kickFoot);
  TMP.copy(ball.object.position).sub(foot);
  TMP.y = 0;
  if (TMP.length() > BALL_RADIUS + 0.2) return false;
  const goalDir = p.team === "blue" ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 0, 1);
  const strikeDir = (shotDir && shotDir.lengthSq() > 0.001 ? shotDir : p.dir.clone().multiplyScalar(0.72).add(goalDir.multiplyScalar(0.62))).normalize();
  const power = Math.max(fallbackPower, p.queuedShotPower || 0);
  const lift = p.queuedShotLift || 0.28;
  ball.object.position.copy(foot).addScaledVector(strikeDir, BALL_RADIUS + 0.08);
  ball.object.position.y = BALL_RADIUS;
  ball.vel.copy(strikeDir).multiplyScalar(power);
  ball.vel.y = lift;
  ball.spin.set(strikeDir.z * power * 8.8, 0, -strikeDir.x * power * 8.8);
  p.queuedShotDir = null;
  p.queuedShotPower = 0;
  p.queuedShotLift = 0;
  return true;
}

function tryTackle(attacker: Player, defender: Player, ball: BallState) {
  if (attacker.tackleFired || attacker.tackleTime <= 0 || defender.fallTime > 0) return false;
  TMP.copy(defender.pos).sub(attacker.pos);
  TMP.y = 0;
  const dist = TMP.length();
  if (dist > 0.42 || dist < 0.001) return false;
  TMP.normalize();
  const facing = attacker.dir.dot(TMP);
  if (facing < 0.35) return false;

  attacker.tackleFired = true;
  defender.fallTime = 1.45;
  defender.fallDir.copy(TMP);
  defender.vel.addScaledVector(TMP, 0.95);
  defender.kickQueued = false;
  defender.kickFired = false;
  defender.kickTime = 0;
  defender.queuedShotDir = null;
  defender.queuedShotPower = 0;
  defender.queuedShotLift = 0;

  TMP2.set(ball.object.position.x - defender.pos.x, 0, ball.object.position.z - defender.pos.z);
  if (TMP2.length() < 0.55) {
    const loose = TMP.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.55, 0, (Math.random() - 0.5) * 0.55)).normalize();
    ball.vel.addScaledVector(loose, 1.7);
    ball.vel.y = 0.16;
    ball.spin.set(loose.z * 12, 0, -loose.x * 12);
  }
  return true;
}

function updateBall(ball: BallState, dt: number) {
  ball.vel.y -= 1.85 * dt;
  ball.object.position.addScaledVector(ball.vel, dt);

  if (ball.object.position.y < BALL_RADIUS) {
    ball.object.position.y = BALL_RADIUS;
    if (ball.vel.y < 0) ball.vel.y *= -0.24;
    ball.vel.x *= Math.pow(0.47, dt);
    ball.vel.z *= Math.pow(0.47, dt);
  } else {
    ball.vel.multiplyScalar(Math.pow(0.82, dt));
  }

  ball.spin.multiplyScalar(Math.pow(0.62, dt));
  const spinLen = ball.spin.length();
  if (spinLen > 0.0001) {
    QTMP.setFromAxisAngle(ball.spin.clone().normalize(), spinLen * dt);
    ball.object.quaternion.premultiply(QTMP);
  }
}

function clampBall(ball: BallState) {
  const p = ball.object.position;
  const xLimit = FIELD_W / 2 - BALL_RADIUS - 0.012;
  const zLimit = FIELD_H / 2 + GOAL_D - BALL_RADIUS;
  const goalMouth = Math.abs(p.x) < GOAL_W / 2;
  const before = p.clone();

  if (p.x < -xLimit || p.x > xLimit) {
    p.x = THREE.MathUtils.clamp(p.x, -xLimit, xLimit);
    ball.vel.x = Math.abs(ball.vel.x) < 0.08 ? -Math.sign(before.x || 1) * 0.22 : ball.vel.x * -0.68;
    ball.vel.z += (Math.random() - 0.5) * 0.06;
    ball.spin.z *= -0.55;
  }
  if (p.z < -zLimit || p.z > zLimit) {
    if (goalMouth) return;
    p.z = THREE.MathUtils.clamp(p.z, -zLimit, zLimit);
    ball.vel.z = Math.abs(ball.vel.z) < 0.08 ? -Math.sign(before.z || 1) * 0.22 : ball.vel.z * -0.62;
    ball.vel.x += (Math.random() - 0.5) * 0.06;
    ball.spin.x *= -0.55;
  }

  const nearSide = Math.abs(Math.abs(p.x) - xLimit) < 0.006 || Math.abs(Math.abs(p.z) - zLimit) < 0.006;
  if (nearSide && ball.vel.lengthSq() < 0.012) ball.stuckTimer += 1 / 60;
  else ball.stuckTimer = 0;
  if (ball.stuckTimer > 0.22) {
    TMP.copy(p).setY(0);
    if (TMP.lengthSq() < 0.001) TMP.set(0, 0, 1);
    TMP.multiplyScalar(-1).normalize();
    ball.vel.addScaledVector(TMP, 0.38);
    ball.object.position.addScaledVector(TMP, 0.025);
    ball.stuckTimer = 0;
  }

  if (Math.abs(p.x) < xLimit - 0.08 && Math.abs(p.z) < FIELD_H / 2 - 0.08) ball.lastSafe.copy(p);
}

function resetAfterGoal(ball: BallState, blue: Player, red: Player) {
  ball.object.position.set(0, BALL_RADIUS, 0);
  ball.vel.set(0, 0, 0);
  ball.spin.set(0, 0, 0);
  ball.lastSafe.copy(ball.object.position);
  ball.stuckTimer = 0;
  blue.pos.set(0, GROUND_Y, 1.45);
  red.pos.set(0, GROUND_Y, -1.45);
  blue.vel.set(0, 0, 0);
  red.vel.set(0, 0, 0);
  blue.dir.set(0, 0, -1);
  red.dir.set(0, 0, 1);
  blue.targetDir.copy(blue.dir);
  red.targetDir.copy(red.dir);
  blue.kickQueued = red.kickQueued = false;
  blue.kickFired = red.kickFired = false;
  blue.tackleQueued = red.tackleQueued = false;
  blue.tackleFired = red.tackleFired = false;
  blue.tackleTime = red.tackleTime = 0;
  blue.fallTime = red.fallTime = 0;
}

export default function GoalRush3DUpgrade() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const input = useRef<InputState>({ x: 0, y: 0, sprint: false, tackle: false });
  const swipe = useRef<SwipeState>({ pointerId: null, startX: 0, startY: 0, endX: 0, endY: 0, active: false });
  const pendingShot = useRef<SwipeShot | null>(null);
  const joyBase = useRef<HTMLDivElement | null>(null);
  const joyKnob = useRef<HTMLDivElement | null>(null);
  const touchId = useRef<number | null>(null);
  const [hud, setHud] = useState({ blue: 0, red: 0, status: "Loading animated GLTF players…" });

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setClearColor(0x07110b, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x07110b, 4.4, 10.5);

    const camera = new THREE.PerspectiveCamera(48, 1, 0.05, 40);
    camera.position.set(0, 3.2, 3.65);

    const controls = new OrbitControls(camera, canvas);
    controls.enabled = false;

    scene.add(new THREE.AmbientLight(0xffffff, 0.66));
    const sun = new THREE.DirectionalLight(0xffffff, 1.35);
    sun.position.set(2.5, 5, 2.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    scene.add(sun);

    const loader = new GLTFLoader();
    makePitch(scene);
    const stadium = makeGoalRushStadium(scene, loader);
    const ball = makeBall(scene);

    let loadedCount = 0;
    const onLoaded = () => {
      loadedCount += 1;
      if (loadedCount >= 2) setHud((h) => ({ ...h, status: "Swipe to shoot, auto left/right foot, Free Kick ball/goals/crowd" }));
    };

    const blue = createPlayer(scene, loader, "blue", new THREE.Vector3(0, GROUND_Y, 1.45), onLoaded);
    const red = createPlayer(scene, loader, "red", new THREE.Vector3(0, GROUND_Y, -1.45), onLoaded);

    let scoreBlue = 0;
    let scoreRed = 0;
    let goalCooldown = 0;
    let tackleLatch = false;
    let replayCooldown = 0;
    let replayFrames: ReplayFrame[] = [];
    let replayCursor = -1;
    let lastLook = new THREE.Vector3();
    let last = performance.now();
    let frame = 0;

    const resize = () => {
      const w = Math.max(1, host.clientWidth);
      const h = Math.max(1, host.clientHeight);
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener("resize", resize);

    const loop = () => {
      frame = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(DT_MAX, (now - last) / 1000);
      last = now;
      goalCooldown = Math.max(0, goalCooldown - dt);

      const joy = input.current;
      const camForward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      camForward.y = 0;
      camForward.normalize();
      const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      camRight.y = 0;
      camRight.normalize();
      const moveDir = camRight.clone().multiplyScalar(joy.x).addScaledVector(camForward, -joy.y);

      const shot = pendingShot.current;
      if (shot && blue.fallTime <= 0 && blue.kickTime <= 0 && replayCooldown <= 0) {
        pendingShot.current = null;
        TMP.set(ball.object.position.x - blue.pos.x, 0, ball.object.position.z - blue.pos.z);
        if (TMP.length() < 0.5) {
          const strikeDir = camRight.clone().multiplyScalar(shot.dir.x).addScaledVector(camForward, shot.dir.z).normalize();
          blue.targetDir.copy(strikeDir);
          blue.kickFoot = chooseKickFoot(blue, ball, strikeDir);
          blue.queuedShotDir = strikeDir;
          blue.queuedShotPower = shot.power;
          blue.queuedShotLift = shot.lift;
          blue.kickTime = 0.48;
          blue.kickQueued = true;
          blue.kickFired = false;
          setHud((h) => ({ ...h, status: `Swipe shot ${Math.round(shot.screenPower * 100)}% with ${blue.kickFoot} foot` }));
        } else {
          setHud((h) => ({ ...h, status: "Move closer to the ball, then swipe to shoot." }));
        }
      }

      movePlayer(blue, moveDir, joy.sprint ? SPRINT_SPEED : WALK_SPEED, dt);

      TMP.set(ball.object.position.x - red.pos.x, 0, ball.object.position.z - red.pos.z);
      const aiToBall = TMP.length();
      const defend = ball.object.position.z > -0.15 ? new THREE.Vector3(0, 0, -1.22).sub(red.pos) : TMP.clone();
      movePlayer(red, aiToBall < 0.92 || ball.object.position.z < 0.45 ? TMP.clone() : defend, AI_SPEED, dt);

      separatePlayers(blue, red);

      if (joy.tackle && !tackleLatch && blue.fallTime <= 0 && blue.tackleTime <= 0) {
        tackleLatch = true;
        blue.tackleTime = 0.56;
        blue.tackleQueued = true;
        blue.tackleFired = false;
      }
      if (!joy.tackle) tackleLatch = false;

      TMP.set(ball.object.position.x - red.pos.x, 0, ball.object.position.z - red.pos.z);
      if (TMP.length() < 0.38 && goalCooldown <= 0 && red.kickTime <= 0 && red.fallTime <= 0) {
        const aiGoalDir = new THREE.Vector3(0, 0, 1);
        red.kickFoot = chooseKickFoot(red, ball, aiGoalDir);
        red.queuedShotDir = red.dir.clone().multiplyScalar(0.55).add(aiGoalDir.multiplyScalar(0.72)).normalize();
        red.queuedShotPower = 3.05;
        red.queuedShotLift = 0.24;
        red.kickTime = 0.48;
        red.kickQueued = true;
        red.kickFired = false;
      }

      if (red.fallTime <= 0 && blue.fallTime <= 0) {
        TMP.copy(blue.pos).sub(red.pos).setY(0);
        if (TMP.length() < 0.44 && red.tackleTime <= 0 && Math.random() < 0.012) {
          red.tackleTime = 0.56;
          red.tackleQueued = true;
          red.tackleFired = false;
        }
      }

      updatePlayerAnimation(blue, dt);
      updatePlayerAnimation(red, dt);
      updateStadiumCrowd(stadium, dt);

      if (blue.tackleQueued && !blue.tackleFired && blue.tackleTime < 0.38) tryTackle(blue, red, ball);
      if (red.tackleQueued && !red.tackleFired && red.tackleTime < 0.38) tryTackle(red, blue, ball);
      if (blue.tackleTime <= 0) blue.tackleQueued = false;
      if (red.tackleTime <= 0) red.tackleQueued = false;

      if (blue.kickQueued && !blue.kickFired && blue.kickTime < 0.29) blue.kickFired = tryKickAtFoot(blue, ball, 3.25);
      if (red.kickQueued && !red.kickFired && red.kickTime < 0.29) red.kickFired = tryKickAtFoot(red, ball, 2.45);
      if (blue.kickTime <= 0) blue.kickQueued = false;
      if (red.kickTime <= 0) red.kickQueued = false;

      playerBallCollision(blue, ball);
      playerBallCollision(red, ball);
      updateBall(ball, dt);

      lastLook.copy(blue.pos).lerp(ball.object.position, 0.38).setY(0.17);
      if (replayCursor < 0) {
        replayFrames.push({
          ball: ball.object.position.clone(),
          ballQuat: ball.object.quaternion.clone(),
          blue: blue.root.position.clone(),
          blueRot: blue.root.rotation.clone(),
          red: red.root.position.clone(),
          redRot: red.root.rotation.clone(),
          cam: camera.position.clone(),
          look: lastLook.clone(),
        });
        if (replayFrames.length > 130) replayFrames.shift();
      }

      const goalZ = FIELD_H / 2 + GOAL_D - BALL_RADIUS * 0.5;
      const inGoal = Math.abs(ball.object.position.x) < GOAL_W / 2;
      if (Math.abs(ball.object.position.z) > goalZ && inGoal && goalCooldown <= 0) {
        if (ball.object.position.z < 0) scoreBlue += 1;
        else scoreRed += 1;
        goalCooldown = 2.25;
        replayCooldown = 1.35;
        replayCursor = Math.max(0, replayFrames.length - 78);
        triggerCrowdCheer(stadium);
        setHud({ blue: scoreBlue, red: scoreRed, status: ball.object.position.z < 0 ? "BLUE scored! Replay…" : "RED scored! Replay…" });
      } else {
        clampBall(ball);
      }

      if (replayCursor >= 0 && replayFrames[replayCursor]) {
        const r = replayFrames[replayCursor];
        ball.object.position.copy(r.ball);
        ball.object.quaternion.copy(r.ballQuat);
        blue.root.position.copy(r.blue);
        blue.root.rotation.copy(r.blueRot);
        red.root.position.copy(r.red);
        red.root.rotation.copy(r.redRot);
        camera.position.lerp(r.cam.clone().add(new THREE.Vector3(0, 0.18, 0.28)), 0.34);
        camera.lookAt(r.look);
        replayCursor += 2;
        replayCooldown = Math.max(0, replayCooldown - dt);
        if (replayCursor >= replayFrames.length || replayCooldown <= 0) {
          replayCursor = -1;
          replayFrames = [];
          resetAfterGoal(ball, blue, red);
          setHud({ blue: scoreBlue, red: scoreRed, status: "Swipe anywhere on the field to shoot. Left/right foot auto-selected." });
        }
      } else {
        TMP.copy(blue.pos).lerp(ball.object.position, 0.38);
        camera.position.lerp(new THREE.Vector3(TMP.x, 2.9, TMP.z + 3.05), 1 - Math.pow(0.002, dt));
        camera.lookAt(TMP.x, 0.17, TMP.z - 0.15);
      }
      renderer.render(scene, camera);
    };

    loop();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      controls.dispose();
      renderer.dispose();
    };
  }, []);

  const updateStick = (clientX: number, clientY: number) => {
    const base = joyBase.current;
    const knob = joyKnob.current;
    if (!base || !knob) return;
    const r = base.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const max = r.width * 0.36;
    const len = Math.min(max, Math.hypot(dx, dy));
    const a = Math.atan2(dy, dx);
    const x = Math.cos(a) * len;
    const y = Math.sin(a) * len;
    knob.style.transform = `translate(${x}px, ${y}px)`;
    input.current.x = x / max;
    input.current.y = y / max;
  };

  const endStick = () => {
    touchId.current = null;
    input.current.x = 0;
    input.current.y = 0;
    if (joyKnob.current) joyKnob.current.style.transform = "translate(0px,0px)";
  };

  const beginSwipe = (e: React.PointerEvent<HTMLDivElement>) => {
    if (touchId.current !== null) return;
    swipe.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, endX: e.clientX, endY: e.clientY, active: true };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const moveSwipe = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!swipe.current.active || swipe.current.pointerId !== e.pointerId) return;
    swipe.current.endX = e.clientX;
    swipe.current.endY = e.clientY;
  };

  const finishSwipe = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!swipe.current.active || swipe.current.pointerId !== e.pointerId) return;
    swipe.current.endX = e.clientX;
    swipe.current.endY = e.clientY;
    const dx = swipe.current.endX - swipe.current.startX;
    const dy = swipe.current.startY - swipe.current.endY;
    const distance = Math.hypot(dx, dy);
    swipe.current.active = false;
    swipe.current.pointerId = null;
    if (distance < 24) return;
    const screenPower = THREE.MathUtils.clamp(distance / 210, 0.28, 1.35);
    const lateral = THREE.MathUtils.clamp(dx / Math.max(1, distance), -0.9, 0.9);
    const forward = THREE.MathUtils.clamp(dy / Math.max(1, distance), -0.35, 1.0);
    const normalizedForward = forward > 0.08 ? forward : 0.24;
    pendingShot.current = {
      dir: new THREE.Vector3(lateral, 0, normalizedForward).normalize(),
      power: 3.7 + screenPower * 2.45,
      lift: THREE.MathUtils.clamp(0.18 + Math.max(0, dy) / 520 + screenPower * 0.18, 0.2, 0.86),
      screenPower,
    };
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#07110b", overflow: "hidden", touchAction: "none", userSelect: "none" }}>
      <div
        ref={hostRef}
        onPointerDown={beginSwipe}
        onPointerMove={moveSwipe}
        onPointerUp={finishSwipe}
        onPointerCancel={finishSwipe}
        style={{ position: "absolute", inset: 0 }}
      >
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
      </div>

      <div style={{ position: "fixed", left: 0, right: 0, top: 0, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", pointerEvents: "none", color: "white", fontFamily: "system-ui,sans-serif", textShadow: "0 2px 8px #000" }}>
        <div style={{ fontWeight: 900, fontSize: 18 }}>BLUE {hud.blue} - {hud.red} RED</div>
        <div style={{ fontSize: 11, maxWidth: 190, textAlign: "right", lineHeight: 1.25 }}>{hud.status}</div>
      </div>

      <div
        ref={joyBase}
        onPointerDown={(e) => { e.stopPropagation(); touchId.current = e.pointerId; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); updateStick(e.clientX, e.clientY); }}
        onPointerMove={(e) => { e.stopPropagation(); if (touchId.current === e.pointerId) updateStick(e.clientX, e.clientY); }}
        onPointerUp={(e) => { e.stopPropagation(); endStick(); }}
        onPointerCancel={(e) => { e.stopPropagation(); endStick(); }}
        style={{ position: "fixed", left: 22, bottom: 28, width: 126, height: 126, borderRadius: 999, background: "rgba(255,255,255,0.13)", border: "1px solid rgba(255,255,255,0.22)", pointerEvents: "auto", display: "grid", placeItems: "center", boxShadow: "0 18px 34px rgba(0,0,0,0.35)" }}
      >
        <div ref={joyKnob} style={{ width: 54, height: 54, borderRadius: 999, background: "rgba(255,255,255,0.86)", boxShadow: "0 8px 18px rgba(0,0,0,0.35)", transition: "transform 80ms linear" }} />
      </div>

      <div style={{ position: "fixed", right: 18, bottom: 24, display: "grid", gap: 10, pointerEvents: "auto" }}>
        <button
          onPointerDown={() => (input.current.sprint = true)}
          onPointerUp={() => (input.current.sprint = false)}
          onPointerCancel={() => (input.current.sprint = false)}
          style={buttonStyle}
        >Sprint</button>
        <button
          onPointerDown={() => (input.current.tackle = true)}
          onPointerUp={() => (input.current.tackle = false)}
          onPointerCancel={() => (input.current.tackle = false)}
          style={{ ...buttonStyle, background: "rgba(220,38,38,0.9)" }}
        >Tackle</button>
      </div>
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  width: 92,
  height: 52,
  border: "1px solid rgba(255,255,255,0.28)",
  borderRadius: 18,
  color: "white",
  background: "rgba(15,23,42,0.86)",
  fontWeight: 900,
  boxShadow: "0 12px 24px rgba(0,0,0,0.35)",
};
