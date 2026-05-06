"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type AnimName = "Idle" | "Walk" | "Run";
type ShotState = "aim" | "runup" | "flight" | "var" | "replay" | "result";
type KickSpot = "left" | "center" | "right" | "near16";
type ActorKind = "kicker" | "keeper" | "wall";
type Decision = "GOAL" | "NO GOAL" | "SAVE" | "BLOCKED" | "MISS";

type Bones = {
  hips?: THREE.Bone;
  spine?: THREE.Bone;
  leftUpLeg?: THREE.Bone;
  leftLeg?: THREE.Bone;
  leftFoot?: THREE.Bone;
  rightUpLeg?: THREE.Bone;
  rightLeg?: THREE.Bone;
  rightFoot?: THREE.Bone;
  leftArm?: THREE.Bone;
  rightArm?: THREE.Bone;
};

type Actor = {
  kind: ActorKind;
  root: THREE.Group;
  model: THREE.Object3D | null;
  fallback: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  actions: Partial<Record<AnimName, THREE.AnimationAction>>;
  current: AnimName;
  bones: Bones;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  dir: THREE.Vector3;
  speed: number;
  kickTime: number;
  jumpTime: number;
  diveTime: number;
  diveDelay: number;
  diveDir: number;
  diveHeight: number;
  wallIndex: number;
  saveTargetX: number;
  loaded: boolean;
};

type BallState = {
  object: THREE.Group;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  knuckleSeed: number;
  flying: boolean;
  curve: number;
  shotAge: number;
  shotDuration: number;
  shotStart: THREE.Vector3;
  shotTarget: THREE.Vector3;
  lastPos: THREE.Vector3;
  prevPos: THREE.Vector3;
  lift: number;
  netCaught: boolean;
  netAge: number;
  netVel: THREE.Vector3;
  freeFlight: boolean;
  hitPost: boolean;
};

type SwipeState = {
  active: boolean;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

type NetRig = {
  lines: THREE.Line[];
  shake: number;
  impact: THREE.Vector3;
};

type ReplayFrame = {
  ball: THREE.Vector3;
  quat: THREE.Quaternion;
  cam: THREE.Vector3;
  look: THREE.Vector3;
  keeper: THREE.Vector3;
  keeperRot: THREE.Euler;
  kicker: THREE.Vector3;
  kickerRot: THREE.Euler;
};

const HUMAN_URL = "https://threejs.org/examples/models/gltf/Soldier.glb";
const GOAL_RUSH_SOUNDS = {
  crowd: "/assets/sounds/football-crowd-3-69245.mp3",
  whistle: "/assets/sounds/metal-whistle-6121.mp3",
  kick: "/assets/sounds/football-game-sound-effects-359284.mp3",
  net: "/assets/sounds/a-football-hits-the-net-goal-313216.mp3",
  post: "/assets/sounds/frying-pan-over-the-head-89303.mp3",
  victory: "/assets/sounds/11l-victory_sound_with_t-1749487412779-357604.mp3",
};

const FIELD_W = 22.0;
const HALF_H = 36.0;
const GOAL_W = 7.32;
const GOAL_H = 2.44;
const GOAL_D = 2.35;
const POST_R = 0.07;
const PENALTY_W = 16.5;
const PENALTY_D = 16.5;
const GOAL_AREA_W = 7.32 + 5.5 * 2;
const GOAL_AREA_D = 5.5;
const PENALTY_SPOT_D = 11.0;
const ARC_R = 9.15;
const WALL_DISTANCE = 9.15;
const BALL_R = 0.11;
const PLAYER_H = 1.82;
const GROUND_Y = 0;
const DT_MAX = 1 / 30;
const GOAL_LINE_Z = -HALF_H / 2;
const RUNUP_BACK_STEPS = 2.2;
const TMP = new THREE.Vector3();
const QTMP = new THREE.Quaternion();


const MURLAN_CHARACTER_KITS = [0x1d69ff, 0xdc2626, 0x16a34a, 0x7c3aed, 0xf97316, 0x0891b2, 0xfacc15];

function shuffledCharacterKits() {
  const kits = [...MURLAN_CHARACTER_KITS];
  for (let i = kits.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [kits[i], kits[j]] = [kits[j], kits[i]];
  }
  return kits;
}

function makeGoalRushAudio() {
  let enabled = true;
  let started = false;
  let pendingWhistle = true;
  const crowd = new Audio(GOAL_RUSH_SOUNDS.crowd);
  crowd.loop = true;
  crowd.volume = 0.5;

  const playOneShot = (src: string, volume = 1) => {
    if (!enabled || !started) return;
    const sound = new Audio(src);
    sound.volume = volume;
    sound.play().catch(() => {});
  };

  const start = () => {
    if (!enabled || started) return;
    started = true;
    crowd.play().catch(() => {});
    if (pendingWhistle) {
      pendingWhistle = false;
      playOneShot(GOAL_RUSH_SOUNDS.whistle, 0.9);
    }
  };

  return {
    start,
    whistle() {
      if (!enabled) return;
      if (!started) {
        pendingWhistle = true;
        return;
      }
      playOneShot(GOAL_RUSH_SOUNDS.whistle, 0.9);
    },
    kick() { playOneShot(GOAL_RUSH_SOUNDS.kick, 0.92); },
    net() { playOneShot(GOAL_RUSH_SOUNDS.net, 0.95); },
    save() { playOneShot(GOAL_RUSH_SOUNDS.post, 0.7); },
    goal() { playOneShot(GOAL_RUSH_SOUNDS.victory, 0.72); },
    dispose() {
      enabled = false;
      crowd.pause();
      crowd.src = "";
    },
  };
}

function material(color: number, roughness = 0.72, metalness = 0.03) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function shadow<T extends THREE.Object3D>(object: T) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
    }
  });
  return object;
}

function cleanName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findBones(model: THREE.Object3D): Bones {
  const bones: Bones = {};
  model.traverse((obj) => {
    const bone = obj as THREE.Bone;
    if (!bone.isBone) return;
    const n = cleanName(bone.name);
    if (!bones.hips && n.includes("hips")) bones.hips = bone;
    if (!bones.spine && n.includes("spine")) bones.spine = bone;
    if (!bones.leftUpLeg && (n.includes("leftupleg") || n.includes("leftthigh"))) bones.leftUpLeg = bone;
    if (!bones.leftLeg && !n.includes("foot") && !n.includes("upleg") && n.includes("leftleg")) bones.leftLeg = bone;
    if (!bones.leftFoot && n.includes("leftfoot")) bones.leftFoot = bone;
    if (!bones.rightUpLeg && (n.includes("rightupleg") || n.includes("rightthigh"))) bones.rightUpLeg = bone;
    if (!bones.rightLeg && !n.includes("foot") && !n.includes("upleg") && n.includes("rightleg")) bones.rightLeg = bone;
    if (!bones.rightFoot && n.includes("rightfoot")) bones.rightFoot = bone;
    if (!bones.leftArm && n.includes("leftarm")) bones.leftArm = bone;
    if (!bones.rightArm && n.includes("rightarm")) bones.rightArm = bone;
  });
  return bones;
}

function normalizeHuman(model: THREE.Object3D, height = PLAYER_H) {
  model.rotation.y = Math.PI;
  model.scale.setScalar(1);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const h = Math.max(0.001, box.max.y - box.min.y);
  model.scale.setScalar(height / h);
  model.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(model);
  const center = box2.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box2.min.y;
}

function tintModel(model: THREE.Object3D, kind: ActorKind, index = 0, kitColor?: number) {
  const color = kind === "keeper" ? new THREE.Color(0x111111) : new THREE.Color(kitColor ?? (kind === "kicker" ? 0x1d69ff : 0xfacc15));
  model.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((raw) => {
      const m = raw as THREE.MeshStandardMaterial;
      if (m.color) {
        m.color.lerp(color, 0.36);
        if (kind === "wall") m.color.lerp(new THREE.Color(index % 2 ? 0x174ea6 : 0xfacc15), 0.18);
      }
      m.needsUpdate = true;
    });
  });
}

function makeFallback(kind: ActorKind, index = 0, kitColor?: number) {
  const group = new THREE.Group();
  const kit = kind === "keeper" ? 0x111111 : kitColor ?? (kind === "kicker" ? 0x1d69ff : 0xfacc15);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.72, 8, 14), material(kit));
  torso.position.y = 1.05;
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.02), material(kind === "wall" ? 0x174ea6 : 0xffffff));
  stripe.position.set(0, 1.25, -0.16);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 12), material(0xf1d6bd));
  head.position.y = 1.62;
  const leftLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.64, 6, 10), material(0x202020));
  const rightLeg = leftLeg.clone();
  leftLeg.position.set(-0.09, 0.42, 0);
  rightLeg.position.set(0.09, 0.42, 0);
  group.add(shadow(torso), shadow(stripe), shadow(head), shadow(leftLeg), shadow(rightLeg));
  return group;
}

function createActor(scene: THREE.Scene, loader: GLTFLoader, kind: ActorKind, pos: THREE.Vector3, index = 0, kitColor?: number): Actor {
  const root = new THREE.Group();
  root.position.copy(pos).setY(GROUND_Y);
  scene.add(root);

  const fallback = makeFallback(kind, index, kitColor);
  root.add(fallback);

  const actor: Actor = {
    kind,
    root,
    model: null,
    fallback,
    mixer: null,
    actions: {},
    current: "Idle",
    bones: {},
    pos: pos.clone().setY(GROUND_Y),
    vel: new THREE.Vector3(),
    dir: new THREE.Vector3(0, 0, -1),
    speed: 0,
    kickTime: 0,
    jumpTime: 0,
    diveTime: 0,
    diveDelay: 0,
    diveDir: 0,
    diveHeight: 1.15,
    wallIndex: index,
    saveTargetX: 0,
    loaded: false,
  };

  loader.setCrossOrigin("anonymous").load(HUMAN_URL, (gltf) => {
    const model = gltf.scene;
    normalizeHuman(model, kind === "keeper" ? 1.9 : PLAYER_H);
    tintModel(model, kind, index, kitColor);
    shadow(model);
    root.add(model);
    fallback.visible = false;
    actor.model = model;
    actor.bones = findBones(model);
    actor.mixer = new THREE.AnimationMixer(model);

    const clips = new Map(gltf.animations.map((clip) => [clip.name.toLowerCase(), clip]));
    const aliases: Record<AnimName, string[]> = { Idle: ["idle"], Walk: ["walk"], Run: ["run"] };
    (Object.keys(aliases) as AnimName[]).forEach((name) => {
      const clip = aliases[name].map((key) => clips.get(key)).find(Boolean);
      if (!clip || !actor.mixer) return;
      const action = actor.mixer.clipAction(clip);
      action.enabled = true;
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.setEffectiveWeight(name === "Idle" ? 1 : 0);
      action.play();
      actor.actions[name] = action;
    });
    actor.loaded = true;
  });

  return actor;
}

function setAction(actor: Actor, next: AnimName) {
  if (actor.current === next || !actor.actions[next]) return;
  const prev = actor.actions[actor.current];
  const action = actor.actions[next];
  if (prev && action) {
    action.enabled = true;
    action.reset().setEffectiveWeight(1).play();
    prev.crossFadeTo(action, 0.16, false);
  }
  actor.current = next;
}

function updateActorBase(actor: Actor, dt: number) {
  actor.pos.y = GROUND_Y;
  actor.root.position.copy(actor.pos);
  actor.root.rotation.x = 0;
  actor.root.rotation.z = 0;
  if (actor.dir.lengthSq() > 0.001) actor.root.rotation.y = Math.atan2(actor.dir.x, actor.dir.z);
  const wanted: AnimName = actor.speed > 2.45 ? "Run" : actor.speed > 0.08 ? "Walk" : "Idle";
  setAction(actor, wanted);
  if (actor.actions.Walk) actor.actions.Walk.timeScale = THREE.MathUtils.clamp(actor.speed / 1.45, 0.95, 1.65);
  if (actor.actions.Run) actor.actions.Run.timeScale = THREE.MathUtils.clamp(actor.speed / 2.9, 0.9, 1.45);
  actor.mixer?.update(dt);
}

function applyKickerPose(kicker: Actor) {
  if (kicker.kickTime <= 0) return;

  const t = 1 - kicker.kickTime / 0.72;
  const plant = THREE.MathUtils.smoothstep(t, 0.18, 0.38);
  const backswing = Math.sin(THREE.MathUtils.clamp((t - 0.16) / 0.26, 0, 1) * Math.PI) * 0.72;
  const strike = Math.sin(THREE.MathUtils.clamp((t - 0.38) / 0.26, 0, 1) * Math.PI) * 2.45;
  const follow = Math.sin(THREE.MathUtils.clamp((t - 0.60) / 0.40, 0, 1) * Math.PI) * 0.9;
  const chestBalance = Math.sin(THREE.MathUtils.clamp((t - 0.20) / 0.55, 0, 1) * Math.PI);

  const upLeg = kicker.bones.rightUpLeg;
  const lowLeg = kicker.bones.rightLeg;
  const foot = kicker.bones.rightFoot;

  if (kicker.bones.hips) kicker.bones.hips.rotation.x += -0.045 * strike;
  if (kicker.bones.spine) {
    kicker.bones.spine.rotation.x += -0.035 * strike + 0.02 * chestBalance;
    kicker.bones.spine.rotation.y += 0.055 * chestBalance;
  }
  if (kicker.bones.leftArm) kicker.bones.leftArm.rotation.z += -0.22 * chestBalance;
  if (kicker.bones.rightArm) kicker.bones.rightArm.rotation.z += 0.20 * chestBalance;
  if (kicker.bones.leftUpLeg) kicker.bones.leftUpLeg.rotation.x += 0.18 * plant;
  if (kicker.bones.leftLeg) kicker.bones.leftLeg.rotation.x += -0.08 * plant;
  if (upLeg) upLeg.rotation.x += -backswing + strike + follow;
  if (lowLeg) lowLeg.rotation.x += backswing * 0.65 - strike * 0.88;
  if (foot) foot.rotation.x += -strike * 0.75 - follow * 0.25;
}

function applyWallPose(actor: Actor) {
  if (actor.jumpTime <= 0) return;
  const t = 1 - actor.jumpTime / 0.42;
  const jump = Math.sin(t * Math.PI);
  actor.root.position.y += jump * 0.45;
  if (actor.bones.leftArm) actor.bones.leftArm.rotation.x += -1.2;
  if (actor.bones.rightArm) actor.bones.rightArm.rotation.x += -1.2;
}

function applyKeeperPose(keeper: Actor) {
  if (keeper.diveTime <= 0) {
    if (keeper.bones.leftArm) keeper.bones.leftArm.rotation.z += -0.18;
    if (keeper.bones.rightArm) keeper.bones.rightArm.rotation.z += 0.18;
    return;
  }
  const t = 1 - keeper.diveTime / 0.9;
  const dive = THREE.MathUtils.smoothstep(t, 0.02, 0.64);
  const recover = THREE.MathUtils.smoothstep(t, 0.84, 1);
  const a = dive * (1 - recover);
  keeper.root.rotation.z = -keeper.diveDir * 1.32 * a;
  keeper.root.rotation.x = -0.34 * a;
  keeper.root.position.x += keeper.diveDir * 2.55 * a;
  keeper.root.position.y += keeper.diveHeight * 0.54 * Math.sin(t * Math.PI) * (1 - recover);
  if (keeper.bones.leftArm) keeper.bones.leftArm.rotation.z += -keeper.diveDir * 1.65 * a;
  if (keeper.bones.rightArm) keeper.bones.rightArm.rotation.z += -keeper.diveDir * 1.65 * a;
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

function makeBall(scene: THREE.Scene): BallState {
  const object = new THREE.Group();
  const ballMat = new THREE.MeshStandardMaterial({ map: createSoccerBallTexture(), roughness: 0.42, metalness: 0.02 });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 48, 32), ballMat);
  object.add(shadow(ball));
  scene.add(object);
  return {
    object,
    vel: new THREE.Vector3(),
    spin: new THREE.Vector3(),
    knuckleSeed: Math.random() * 99,
    flying: false,
    curve: 0,
    shotAge: 0,
    shotDuration: 1.05,
    shotStart: new THREE.Vector3(),
    shotTarget: new THREE.Vector3(),
    lastPos: new THREE.Vector3(),
    prevPos: new THREE.Vector3(),
    lift: 1,
    netCaught: false,
    netAge: 0,
    netVel: new THREE.Vector3(),
    freeFlight: false,
    hitPost: false,
  };
}

function netPoint(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, u: number, v: number) {
  const bottom = a.clone().lerp(b, u);
  const top = d.clone().lerp(c, u);
  return bottom.lerp(top, v);
}

function addNetLine(group: THREE.Group, rig: NetRig, p1: THREE.Vector3, p2: THREE.Vector3, lineMat: THREE.LineBasicMaterial) {
  const geometry = new THREE.BufferGeometry().setFromPoints([p1, p2]);
  const line = new THREE.Line(geometry, lineMat);
  line.userData.base = [p1.clone(), p2.clone()];
  rig.lines.push(line);
  group.add(line);
}

function makeNetSurface(rig: NetRig, a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, cols: number, rows: number) {
  const group = new THREE.Group();
  const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.58 });
  for (let i = 0; i <= cols; i++) {
    const u = i / cols;
    addNetLine(group, rig, netPoint(a, b, c, d, u, 0), netPoint(a, b, c, d, u, 1), lineMat);
  }
  for (let j = 0; j <= rows; j++) {
    const v = j / rows;
    addNetLine(group, rig, netPoint(a, b, c, d, 0, v), netPoint(a, b, c, d, 1, v), lineMat);
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const u0 = i / cols;
      const u1 = (i + 1) / cols;
      const v0 = j / rows;
      const v1 = (j + 1) / rows;
      addNetLine(group, rig, netPoint(a, b, c, d, (u0 + u1) / 2, v0), netPoint(a, b, c, d, u1, (v0 + v1) / 2), lineMat);
      addNetLine(group, rig, netPoint(a, b, c, d, u1, (v0 + v1) / 2), netPoint(a, b, c, d, (u0 + u1) / 2, v1), lineMat);
      addNetLine(group, rig, netPoint(a, b, c, d, (u0 + u1) / 2, v1), netPoint(a, b, c, d, u0, (v0 + v1) / 2), lineMat);
      addNetLine(group, rig, netPoint(a, b, c, d, u0, (v0 + v1) / 2), netPoint(a, b, c, d, (u0 + u1) / 2, v0), lineMat);
    }
  }
  return group;
}
function makeCylinderBetween(a: THREE.Vector3, b: THREE.Vector3, radius: number, matRef: THREE.Material) { const dir = b.clone().sub(a); const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, Math.max(0.001, dir.length()), 18), matRef); mesh.position.copy(a).addScaledVector(dir, 0.5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()); return shadow(mesh); }
function makeGoal(scene: THREE.Scene, netRig: NetRig) { const root = new THREE.Group(); root.position.z = GOAL_LINE_Z; const white = material(0xffffff, 0.4, 0.18); const rear = material(0xcbd5e1, 0.46, 0.28); const backScale = 0.82; const backW = GOAL_W * backScale; const backH = GOAL_H * backScale; const FL = new THREE.Vector3(-GOAL_W / 2, 0, 0); const FR = new THREE.Vector3(GOAL_W / 2, 0, 0); const FLT = new THREE.Vector3(-GOAL_W / 2, GOAL_H, 0); const FRT = new THREE.Vector3(GOAL_W / 2, GOAL_H, 0); const BL = new THREE.Vector3(-backW / 2, 0.03, -GOAL_D); const BR = new THREE.Vector3(backW / 2, 0.03, -GOAL_D); const BLT = new THREE.Vector3(-backW / 2, backH, -GOAL_D); const BRT = new THREE.Vector3(backW / 2, backH, -GOAL_D); root.add(makeCylinderBetween(FL, FLT, POST_R, white), makeCylinderBetween(FR, FRT, POST_R, white), makeCylinderBetween(FLT, FRT, POST_R, white), makeCylinderBetween(BL, BLT, POST_R * 0.48, rear), makeCylinderBetween(BR, BRT, POST_R * 0.48, rear), makeCylinderBetween(BLT, BRT, POST_R * 0.48, rear), makeCylinderBetween(FLT, BLT, POST_R * 0.42, rear), makeCylinderBetween(FRT, BRT, POST_R * 0.42, rear), makeCylinderBetween(FL, BL, POST_R * 0.36, rear), makeCylinderBetween(FR, BR, POST_R * 0.36, rear)); root.add(makeNetSurface(netRig, BL, BR, BRT, BLT, 18, 10)); root.add(makeNetSurface(netRig, FLT, FRT, BRT, BLT, 18, 8)); root.add(makeNetSurface(netRig, FL, BL, BLT, FLT, 8, 10)); root.add(makeNetSurface(netRig, FR, BR, BRT, FRT, 8, 10)); scene.add(root); }
function triggerNetShake(netRig: NetRig, impact: THREE.Vector3) { netRig.shake = 1.35; netRig.impact.copy(impact).sub(new THREE.Vector3(0, 0, GOAL_LINE_Z)); }
function updateNetShake(netRig: NetRig, dt: number) { if (netRig.shake <= 0) return; const time = performance.now() * 0.02; const strength = netRig.shake; netRig.lines.forEach((line, idx) => { const base = line.userData.base as THREE.Vector3[]; const attr = line.geometry.getAttribute("position") as THREE.BufferAttribute; for (let i = 0; i < 2; i++) { const p = base[i]; const distance = Math.max(0.28, p.distanceTo(netRig.impact)); const falloff = THREE.MathUtils.clamp(1.65 / distance, 0, 1.4); const wave = Math.sin(time + idx * 0.37 + i * 1.7) * 0.24 * strength * falloff; attr.setXYZ(i, p.x + wave * 0.36, p.y + Math.abs(wave) * 0.28, p.z - Math.abs(wave) * 1.45); } attr.needsUpdate = true; }); netRig.shake = Math.max(0, netRig.shake - dt * 1.65); }
function makeChair(color: number) {
  const chair = new THREE.Group();
  const plastic = material(color, 0.62, 0.02);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.4), plastic);
  seat.position.y = 0.28;
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.46, 0.08), plastic);
  back.position.set(0, 0.55, -0.16);
  const legMat = material(0x334155, 0.45, 0.18);
  const legs = [
    [-0.16, 0.13, -0.12], [0.16, 0.13, -0.12], [-0.16, 0.13, 0.14], [0.16, 0.13, 0.14],
  ].map(([x, y, z]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.28, 0.04), legMat);
    leg.position.set(x, y, z);
    return leg;
  });
  chair.add(shadow(seat), shadow(back), ...legs.map((leg) => shadow(leg)));
  return chair;
}

function makeBillboardsAndStands(scene: THREE.Scene) {
  const boardGroup = new THREE.Group();
  const zBoard = GOAL_LINE_Z - GOAL_D - 0.75;
  const boardColors = [0x2563eb, 0xef4444, 0x16a34a, 0xfacc15, 0x7c3aed, 0x0ea5e9];
  for (let i = 0; i < 6; i++) {
    const x = (i - 2.5) * 3.15;
    const board = new THREE.Mesh(new THREE.BoxGeometry(2.95, 0.82, 0.08), material(boardColors[i], 0.5, 0.02));
    board.position.set(x, 0.55, zBoard);
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.95, 0.08, 0.1), material(0xffffff, 0.55, 0.02));
    top.position.set(x, 1.0, zBoard + 0.01);
    const textBar = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 0.105), material(0xffffff, 0.55, 0.02));
    textBar.position.set(x, 0.55, zBoard + 0.015);
    boardGroup.add(shadow(board), shadow(top), shadow(textBar));
  }
  scene.add(boardGroup);

  const stands = new THREE.Group();
  stands.position.z = GOAL_LINE_Z - GOAL_D - 2.0;
  const concrete = material(0x94a3b8, 0.88, 0.02);
  const aisleMat = material(0xe2e8f0, 0.76, 0.02);
  const railMat = material(0xf8fafc, 0.38, 0.2);
  const rows = 5;
  const rowDepth = 0.92;
  const rowRise = 0.38;
  const width = FIELD_W + 4.4;

  for (let row = 0; row < rows; row++) {
    const terrace = new THREE.Mesh(new THREE.BoxGeometry(width, 0.22, rowDepth), concrete);
    terrace.position.set(0, 0.18 + row * rowRise, -row * rowDepth);
    stands.add(shadow(terrace));

    const stepLip = new THREE.Mesh(new THREE.BoxGeometry(width, 0.08, 0.08), railMat);
    stepLip.position.set(0, 0.33 + row * rowRise, -row * rowDepth + rowDepth * 0.44);
    stands.add(shadow(stepLip));
  }

  const stairXs = [-5.7, 0, 5.7];
  stairXs.forEach((x) => {
    const stair = new THREE.Mesh(new THREE.BoxGeometry(0.72, rows * rowRise + 0.28, rows * rowDepth + 0.55), aisleMat);
    stair.position.set(x, 0.54 + (rows * rowRise) / 2, -((rows - 1) * rowDepth) / 2);
    stands.add(shadow(stair));
  });

  const chairColors = [0x1d4ed8, 0xef4444, 0xfacc15, 0x16a34a, 0xffffff];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < 24; col++) {
      const x = (col - 11.5) * 0.86;
      if (stairXs.some((aisleX) => Math.abs(x - aisleX) < 0.54)) continue;
      const chair = makeChair(chairColors[(row + col) % chairColors.length]);
      chair.position.set(x, 0.38 + row * rowRise, -row * rowDepth + 0.06);
      chair.rotation.y = Math.PI;
      stands.add(chair);
    }
  }

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(width + 0.8, rows * rowRise + 0.9, 0.28), material(0x475569, 0.72, 0.06));
  backWall.position.set(0, 1.0 + rows * rowRise, -(rows - 1) * rowDepth - 0.58);
  stands.add(shadow(backWall));

  const rail = new THREE.Mesh(new THREE.BoxGeometry(width + 0.4, 0.08, 0.08), railMat);
  rail.position.set(0, 1.12, 0.62);
  stands.add(shadow(rail));
  scene.add(stands);
}

function addLine(scene: THREE.Scene, points: THREE.Vector3[], color = 0xffffff, opacity = 0.9) { const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map((p) => new THREE.Vector3(p.x, 0.018, p.z))), new THREE.LineBasicMaterial({ color, transparent: true, opacity })); scene.add(line); return line; }
function addRect(scene: THREE.Scene, left: number, right: number, frontZ: number, backZ: number) { addLine(scene, [new THREE.Vector3(left, 0, frontZ), new THREE.Vector3(left, 0, backZ), new THREE.Vector3(right, 0, backZ), new THREE.Vector3(right, 0, frontZ)]); }
function makeHalfField(scene: THREE.Scene, netRig: NetRig) { const grassA = material(0x1d7d39, 0.95, 0); const grassB = material(0x16692e, 0.95, 0); for (let i = 0; i < 10; i++) { const stripe = new THREE.Mesh(new THREE.PlaneGeometry(FIELD_W, HALF_H / 10), i % 2 ? grassA : grassB); stripe.rotation.x = -Math.PI / 2; stripe.position.z = -HALF_H / 2 + HALF_H / 20 + (i * HALF_H) / 10; stripe.receiveShadow = true; scene.add(stripe); } const w = FIELD_W / 2; const h = HALF_H / 2; addLine(scene, [new THREE.Vector3(-w, 0, -h), new THREE.Vector3(w, 0, -h), new THREE.Vector3(w, 0, h), new THREE.Vector3(-w, 0, h), new THREE.Vector3(-w, 0, -h)]); addLine(scene, [new THREE.Vector3(-w, 0, h), new THREE.Vector3(w, 0, h)]); addRect(scene, -PENALTY_W / 2, PENALTY_W / 2, -h, -h + PENALTY_D); addRect(scene, -GOAL_AREA_W / 2, GOAL_AREA_W / 2, -h, -h + GOAL_AREA_D); const penaltySpot = new THREE.Mesh(new THREE.CircleGeometry(0.08, 28), new THREE.MeshBasicMaterial({ color: 0xffffff })); penaltySpot.rotation.x = -Math.PI / 2; penaltySpot.position.set(0, 0.022, -h + PENALTY_SPOT_D); scene.add(penaltySpot); const boxTopZ = -h + PENALTY_D; const spotZ = -h + PENALTY_SPOT_D; const theta = Math.acos((boxTopZ - spotZ) / ARC_R); const arcPts = new THREE.EllipseCurve(0, spotZ, ARC_R, ARC_R, theta, Math.PI - theta).getPoints(96).map((p) => new THREE.Vector3(p.x, 0, p.y)); addLine(scene, arcPts); makeGoal(scene, netRig); makeBillboardsAndStands(scene); }
function makeAimLine(scene: THREE.Scene) { const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(34 * 3), 3)); const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xfff200, transparent: true, opacity: 0.95 })); scene.add(line); return line; }
function shotPoint(start: THREE.Vector3, target: THREE.Vector3, curve: number, lift: number, t: number) { const p = start.clone().lerp(target, t); p.x += curve * Math.sin(t * Math.PI); p.y = BALL_R + lift * Math.sin(t * Math.PI) + (target.y - BALL_R) * t; return p; }
function swipeToShot(ballPos: THREE.Vector3, swipe: SwipeState) { const dx = swipe.endX - swipe.startX; const dy = swipe.startY - swipe.endY; const targetX = THREE.MathUtils.clamp(dx / 34, -GOAL_W / 2 + 0.2, GOAL_W / 2 - 0.2); const targetY = THREE.MathUtils.clamp(0.45 + dy / 82, 0.22, GOAL_H + 1.3); const target = new THREE.Vector3(targetX, targetY, GOAL_LINE_Z - GOAL_D - 0.55); const curve = THREE.MathUtils.clamp(dx / 58, -6.0, 6.0); const lift = THREE.MathUtils.clamp(dy / 65, 0.35, GOAL_H + 2.4); const power = THREE.MathUtils.clamp(Math.hypot(dx, dy) / 123, 0.48, 1.72); const distance = ballPos.distanceTo(target); const duration = THREE.MathUtils.clamp(distance / (18.7 + power * 10.4), 0.82, 1.48); return { target, curve, lift, power, duration }; }
function setAimCurve(line: THREE.Line, ballPos: THREE.Vector3, swipe: SwipeState) { const attr = (line.geometry as THREE.BufferGeometry).getAttribute("position") as THREE.BufferAttribute; const shot = swipeToShot(ballPos, swipe); for (let i = 0; i < attr.count; i++) { const t = i / (attr.count - 1); const p = shotPoint(ballPos, shot.target, shot.curve, shot.lift, t); attr.setXYZ(i, p.x, p.y + 0.08, p.z); } attr.needsUpdate = true; line.geometry.computeBoundingSphere(); }
function hideAimLine(line: THREE.Line) { const attr = (line.geometry as THREE.BufferGeometry).getAttribute("position") as THREE.BufferAttribute; for (let i = 0; i < attr.count; i++) attr.setXYZ(i, 99, 99, 99); attr.needsUpdate = true; }
function freeKickPosition(spot: KickSpot) { if (spot === "left") return new THREE.Vector3(-4.6, BALL_R, GOAL_LINE_Z + 24.5); if (spot === "right") return new THREE.Vector3(4.6, BALL_R, GOAL_LINE_Z + 24.5); if (spot === "near16") return new THREE.Vector3(0.7, BALL_R, GOAL_LINE_Z + 18.8); return new THREE.Vector3(0, BALL_R, GOAL_LINE_Z + 23.0); }
function wallCountForSpot(spot: KickSpot) { if (spot === "left" || spot === "right") return 3; if (spot === "near16") return 5; return 4; }
function wallCenterForBall(ballPos: THREE.Vector3) { const goalCenter = new THREE.Vector3(0, 0, GOAL_LINE_Z); const toGoal = goalCenter.sub(ballPos).setY(0).normalize(); return ballPos.clone().addScaledVector(toGoal, WALL_DISTANCE).setY(0); }
function placeWall(wall: Actor[], spot: KickSpot, ballPos: THREE.Vector3) { const count = wallCountForSpot(spot); const center = wallCenterForBall(ballPos); const toBall = ballPos.clone().sub(center).setY(0).normalize(); const side = new THREE.Vector3(toBall.z, 0, -toBall.x).normalize(); wall.forEach((actor, i) => { actor.root.visible = i < count; const offset = i - (count - 1) / 2; actor.pos.copy(center).addScaledVector(side, offset * 0.62).setY(0); actor.dir.copy(ballPos.clone().sub(actor.pos).setY(0).normalize()); actor.vel.set(0, 0, 0); actor.speed = 0; actor.jumpTime = 0; }); }
function resetShot(ball: BallState, kicker: Actor, keeper: Actor, wall: Actor[], spot: KickSpot) { const ballPos = freeKickPosition(spot); ball.object.position.copy(ballPos); ball.vel.set(0, 0, 0); ball.spin.set(0, 0, 0); ball.curve = 0; ball.shotAge = 0; ball.shotDuration = 1.05; ball.lift = 1; ball.flying = false; ball.netCaught = false; ball.freeFlight = false; ball.hitPost = false; ball.netAge = 0; ball.netVel.set(0, 0, 0); ball.shotStart.copy(ballPos); ball.shotTarget.set(0, BALL_R, GOAL_LINE_Z - GOAL_D - 0.55); ball.lastPos.copy(ballPos); ball.prevPos.copy(ballPos); ball.knuckleSeed = Math.random() * 100; const toGoal = new THREE.Vector3(0, 0, GOAL_LINE_Z).sub(ballPos).setY(0).normalize(); const runupStart = ballPos.clone().addScaledVector(toGoal, -RUNUP_BACK_STEPS).add(new THREE.Vector3(-0.42, -BALL_R, 0)).setY(0); kicker.pos.copy(runupStart); kicker.dir.copy(ballPos.clone().sub(kicker.pos).setY(0).normalize()); kicker.vel.set(0, 0, 0); kicker.speed = 0; kicker.kickTime = 0; keeper.pos.set(0, 0, GOAL_LINE_Z + 0.36); keeper.dir.set(0, 0, 1); keeper.vel.set(0, 0, 0); keeper.speed = 0; keeper.diveTime = 0; keeper.diveDelay = 0; keeper.diveDir = 0; keeper.diveHeight = 1.15; keeper.saveTargetX = 0; placeWall(wall, spot, ballPos); }
function predictShotResult(ballPos: THREE.Vector3, swipe: SwipeState) { const shot = swipeToShot(ballPos, swipe); const final = shotPoint(ballPos, shot.target, shot.curve, shot.lift, 1); return { shot, final }; }
function sampleShotAtZ(ballPos: THREE.Vector3, swipe: SwipeState, z: number) { const { shot } = predictShotResult(ballPos, swipe); let best = shotPoint(ballPos, shot.target, shot.curve, shot.lift, 1); let bestDistance = Math.abs(best.z - z); for (let i = 0; i <= 48; i++) { const t = i / 48; const p = shotPoint(ballPos, shot.target, shot.curve, shot.lift, t); const d = Math.abs(p.z - z); if (d < bestDistance) { best = p; bestDistance = d; } } return best; }
function beginRunup(kicker: Actor, wall: Actor[], keeper: Actor, ball: BallState, swipe: SwipeState) { kicker.kickTime = 0.72; wall.forEach((w) => (w.jumpTime = 0.42)); const targetAtKeeper = sampleShotAtZ(ball.object.position, swipe, GOAL_LINE_Z + 0.42); const targetSide = targetAtKeeper.x < -0.18 ? -1 : targetAtKeeper.x > 0.18 ? 1 : 0; const targetHeight = THREE.MathUtils.clamp(targetAtKeeper.y, 0.38, GOAL_H + 0.2); const quality = Math.random(); keeper.diveDir = quality < 0.12 ? -targetSide || (Math.random() > 0.5 ? 1 : -1) : targetSide; keeper.diveHeight = targetHeight; keeper.saveTargetX = THREE.MathUtils.clamp(targetAtKeeper.x, -GOAL_W / 2 + 0.25, GOAL_W / 2 - 0.25); keeper.diveDelay = quality > 0.74 ? 0.05 : quality > 0.34 ? 0.1 : 0.16; keeper.diveTime = 0; }
function shootBall(ball: BallState, swipe: SwipeState) { const shot = swipeToShot(ball.object.position, swipe); ball.curve = shot.curve; ball.lift = shot.lift; ball.shotAge = 0; ball.shotDuration = shot.duration; ball.shotStart.copy(ball.object.position); ball.shotTarget.copy(shot.target); ball.lastPos.copy(ball.object.position); ball.prevPos.copy(ball.object.position); ball.netCaught = false; ball.freeFlight = false; ball.hitPost = false; ball.netAge = 0; ball.netVel.set(0, 0, 0); ball.spin.set(shot.curve * 0.2, shot.curve * 22.0, -shot.curve * 12.0); ball.flying = true; }
function applyBallRoll(ball: BallState, from: THREE.Vector3, to: THREE.Vector3, dt: number) { const move = to.clone().sub(from); const dist = move.length(); if (dist > 0.0001) { const rollAxis = new THREE.Vector3(move.z, 0, -move.x).normalize(); QTMP.setFromAxisAngle(rollAxis, dist / BALL_R); ball.object.quaternion.premultiply(QTMP); } const curveSpin = Math.abs(ball.curve) * 0.08 + 0.04; QTMP.setFromAxisAngle(new THREE.Vector3(0, Math.sign(ball.curve || 1), 0), curveSpin * Math.max(0.35, dt * 60)); ball.object.quaternion.premultiply(QTMP); }
function updateFreeBall(ball: BallState, dt: number) { ball.prevPos.copy(ball.object.position); ball.vel.y -= 6.4 * dt; ball.vel.multiplyScalar(Math.pow(0.988, dt * 60)); const next = ball.object.position.clone().addScaledVector(ball.vel, dt); if (next.y < BALL_R) { next.y = BALL_R; ball.vel.y = Math.abs(ball.vel.y) * 0.38; ball.vel.x *= 0.74; ball.vel.z *= 0.74; } applyBallRoll(ball, ball.object.position, next, dt); ball.object.position.copy(next); ball.lastPos.copy(next); if (ball.object.position.z < GOAL_LINE_Z - GOAL_D - 2.4 || ball.object.position.z > GOAL_LINE_Z + 8 || Math.abs(ball.object.position.x) > FIELD_W * 0.68 || (ball.vel.length() < 0.25 && ball.object.position.y <= BALL_R + 0.01)) ball.flying = false; }
function updateBall(ball: BallState, dt: number) { if (ball.netCaught) { ball.netAge += dt; ball.netVel.y -= 1.2 * dt; ball.netVel.multiplyScalar(Math.pow(0.82, dt * 60)); ball.object.position.addScaledVector(ball.netVel, dt); ball.object.position.z = THREE.MathUtils.clamp(ball.object.position.z, GOAL_LINE_Z - GOAL_D + 0.18, GOAL_LINE_Z - 0.18); ball.object.position.y = Math.max(BALL_R, ball.object.position.y); const spinLen = ball.netVel.length() / BALL_R; if (spinLen > 0.001) { QTMP.setFromAxisAngle(new THREE.Vector3(1, 0.2, 0).normalize(), spinLen * dt); ball.object.quaternion.premultiply(QTMP); } ball.prevPos.copy(ball.lastPos); ball.lastPos.copy(ball.object.position); if (ball.netAge > 1.15 || ball.netVel.length() < 0.04) ball.flying = false; return; } if (!ball.flying) return; if (ball.freeFlight) { updateFreeBall(ball, dt); return; } ball.shotAge += dt; const t = THREE.MathUtils.clamp(ball.shotAge / ball.shotDuration, 0, 1); const eased = 1 - Math.pow(1 - t, 1.25); const next = shotPoint(ball.shotStart, ball.shotTarget, ball.curve, ball.lift, eased); const prev = ball.lastPos.clone(); ball.vel.copy(next).sub(prev).divideScalar(Math.max(0.0001, dt)); applyBallRoll(ball, prev, next, dt); ball.object.position.copy(next); ball.prevPos.copy(prev); ball.lastPos.copy(next); if (t >= 1) ball.flying = false; }
function deflectSavedBall(keeper: Actor, ball: BallState) { const away = new THREE.Vector3(ball.object.position.x - keeper.pos.x, 0.22, 1.0).normalize(); ball.freeFlight = true; ball.netCaught = false; ball.vel.copy(away.multiplyScalar(7.4)); ball.vel.y = Math.max(1.2, ball.vel.y + 1.2); }
function keeperSaveCheck(keeper: Actor, ball: BallState, dt: number) { if (!ball.flying || ball.netCaught || ball.hitPost) return false; if (keeper.diveDelay > 0) { keeper.diveDelay = Math.max(0, keeper.diveDelay - dt); if (keeper.diveDelay <= 0) keeper.diveTime = 0.9; } const ready = Math.max(0, 1 - keeper.diveDelay * 5.5); const lateralTarget = THREE.MathUtils.clamp(keeper.saveTargetX, -GOAL_W / 2 + 0.24, GOAL_W / 2 - 0.24); keeper.pos.x = THREE.MathUtils.lerp(keeper.pos.x, lateralTarget, 0.12 + ready * 0.1); const nearGoal = ball.object.position.z < GOAL_LINE_Z + 1.35 && ball.object.position.z > GOAL_LINE_Z - 0.55; if (!nearGoal) return false; const bodyCenter = keeper.pos.clone().setY(1.08); const handCenter = keeper.pos.clone().add(new THREE.Vector3((keeper.saveTargetX - keeper.pos.x) * 0.85 + keeper.diveDir * 0.52, keeper.diveHeight, 0)); const bodyDx = Math.abs(ball.object.position.x - bodyCenter.x) / 0.55; const bodyDy = Math.abs(ball.object.position.y - bodyCenter.y) / 0.95; const handDx = Math.abs(ball.object.position.x - handCenter.x) / (keeper.diveDir === 0 ? 0.88 : 1.15); const handDy = Math.abs(ball.object.position.y - handCenter.y) / 0.62; if (bodyDx * bodyDx + bodyDy * bodyDy < 1 || handDx * handDx + handDy * handDy < 1) { deflectSavedBall(keeper, ball); return true; } return false; }
function postHitCheck(ball: BallState) { if (!ball.flying || ball.netCaught || ball.freeFlight || ball.hitPost) return false; const prev = ball.prevPos; const curr = ball.object.position; if (!(prev.z > GOAL_LINE_Z && curr.z <= GOAL_LINE_Z)) return false; const alpha = THREE.MathUtils.clamp((prev.z - GOAL_LINE_Z) / Math.max(0.0001, prev.z - curr.z), 0, 1); const cross = prev.clone().lerp(curr, alpha); const postX = GOAL_W / 2; const nearLeftPost = Math.abs(cross.x + postX) <= POST_R + BALL_R * 1.15 && cross.y <= GOAL_H + BALL_R; const nearRightPost = Math.abs(cross.x - postX) <= POST_R + BALL_R * 1.15 && cross.y <= GOAL_H + BALL_R; const nearBar = Math.abs(cross.y - GOAL_H) <= POST_R + BALL_R * 1.2 && Math.abs(cross.x) <= postX + BALL_R; if (!nearLeftPost && !nearRightPost && !nearBar) return false; ball.hitPost = true; ball.freeFlight = true; ball.object.position.copy(cross); if (nearBar) ball.vel.y = -Math.abs(ball.vel.y) * 0.52 - 1.2; if (nearLeftPost || nearRightPost) ball.vel.x = (nearLeftPost ? 1 : -1) * Math.max(2.6, Math.abs(ball.vel.x) * 0.8 + 2.4); ball.vel.z = Math.abs(ball.vel.z) * 0.32 + 1.4; ball.vel.multiplyScalar(0.72); ball.lastPos.copy(cross); return true; }
function wallBlockCheck(wall: Actor[], ball: BallState) { if (!ball.flying || ball.netCaught) return false; for (const actor of wall) { if (!actor.root.visible) continue; const chest = actor.pos.clone().setY(actor.jumpTime > 0 ? 1.55 : 1.15); if (chest.distanceTo(ball.object.position) < 0.55) { ball.freeFlight = true; ball.vel.set((ball.object.position.x - actor.pos.x) * 2.8, 1.4, 5.2); return true; } } return false; }
function isGoalPosition(p: THREE.Vector3) { const crossedLine = p.z <= GOAL_LINE_Z - 0.05; const insidePosts = Math.abs(p.x) <= GOAL_W / 2 - BALL_R; const underBar = p.y >= BALL_R && p.y <= GOAL_H - BALL_R * 0.25; return crossedLine && insidePosts && underBar; }
function isBackNetImpact(p: THREE.Vector3) { return p.z <= GOAL_LINE_Z - GOAL_D + 0.28 && Math.abs(p.x) <= GOAL_W / 2 - BALL_R && p.y >= BALL_R && p.y <= GOAL_H - BALL_R * 0.2; }
function decideShot(ball: BallState, blocked: boolean, saved: boolean): Decision { if (blocked) return "BLOCKED"; if (saved) return "SAVE"; if (ball.hitPost) return "NO GOAL"; return isGoalPosition(ball.object.position) || ball.netCaught ? "GOAL" : "NO GOAL"; }
function catchBallInNet(ball: BallState, netRig: NetRig) { ball.netCaught = true; ball.freeFlight = false; ball.netAge = 0; ball.flying = true; ball.netVel.copy(ball.vel).multiplyScalar(0.12); ball.netVel.z = Math.min(ball.netVel.z, -0.45); ball.netVel.y *= 0.18; triggerNetShake(netRig, ball.object.position.clone()); }

export default function FreeKickGame() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const swipeRef = useRef<SwipeState>({ active: false, startX: 0, startY: 0, endX: 0, endY: 0 });
  const [hud, setHud] = useState({ goals: 0, saves: 0, spot: "center" as KickSpot, state: "Swipe to aim and shoot" });
  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setClearColor(0x07110b, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x07110b, 18, 58);
    const camera = new THREE.PerspectiveCamera(62, 1, 0.05, 140);
    scene.add(new THREE.AmbientLight(0xffffff, 0.68));
    const sun = new THREE.DirectionalLight(0xffffff, 1.35);
    sun.position.set(8, 16, 10); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); scene.add(sun);
    const netRig: NetRig = { lines: [], shake: 0, impact: new THREE.Vector3() };
    makeHalfField(scene, netRig);
    const aimLine = makeAimLine(scene);
    hideAimLine(aimLine);
    const ball = makeBall(scene);
    const audio = makeGoalRushAudio();
    const loader = new GLTFLoader();
    const characterKits = shuffledCharacterKits();
    const actorKit = (index: number) => characterKits[index % characterKits.length];
    const kicker = createActor(scene, loader, "kicker", new THREE.Vector3(0, 0, 6), 0, actorKit(0));
    const keeper = createActor(scene, loader, "keeper", new THREE.Vector3(0, 0, GOAL_LINE_Z + 0.36), 0, actorKit(1));
    const wall = Array.from({ length: 5 }, (_, i) => createActor(scene, loader, "wall", new THREE.Vector3(0, 0, 0), i, actorKit(i + 2)));
    let spot: KickSpot = "center"; let state: ShotState = "aim"; let resultTimer = 0; let varTimer = 0; let replayIndex = 0; let replayClock = 0; let pendingDecision: Decision = "NO GOAL"; let shotBlocked = false; let shotSaved = false; let shotFinalized = false; let netTriggered = false; const replayFrames: ReplayFrame[] = []; let score = { goals: 0, saves: 0 }; resetShot(ball, kicker, keeper, wall, spot);
    const resize = () => { const w = Math.max(1, host.clientWidth); const h = Math.max(1, host.clientHeight); renderer.setSize(w, h, false); renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    resize(); window.addEventListener("resize", resize);
    const onDown = (e: PointerEvent) => { if (state !== "aim") return; audio.start(); swipeRef.current = { active: true, startX: e.clientX, startY: e.clientY, endX: e.clientX, endY: e.clientY }; setAimCurve(aimLine, ball.object.position, swipeRef.current); };
    const onMove = (e: PointerEvent) => { if (!swipeRef.current.active || state !== "aim") return; swipeRef.current.endX = e.clientX; swipeRef.current.endY = e.clientY; setAimCurve(aimLine, ball.object.position, swipeRef.current); };
    const onUp = (e: PointerEvent) => { if (!swipeRef.current.active || state !== "aim") return; swipeRef.current.endX = e.clientX; swipeRef.current.endY = e.clientY; swipeRef.current.active = false; hideAimLine(aimLine); beginRunup(kicker, wall, keeper, ball, swipeRef.current); shotBlocked = false; shotSaved = false; shotFinalized = false; netTriggered = false; replayFrames.length = 0; state = "runup"; setHud((h) => ({ ...h, state: "2-step run-up..." })); };
    canvas.addEventListener("pointerdown", onDown); canvas.addEventListener("pointermove", onMove); canvas.addEventListener("pointerup", onUp); canvas.addEventListener("pointercancel", onUp);
    const recordReplayFrame = (look: THREE.Vector3) => { if (replayFrames.length > 220) replayFrames.shift(); replayFrames.push({ ball: ball.object.position.clone(), quat: ball.object.quaternion.clone(), cam: camera.position.clone(), look: look.clone(), keeper: keeper.root.position.clone(), keeperRot: keeper.root.rotation.clone(), kicker: kicker.root.position.clone(), kickerRot: kicker.root.rotation.clone() }); };
    let last = performance.now(); let frame = 0;
    const loop = () => {
      frame = requestAnimationFrame(loop);
      const now = performance.now(); const dt = Math.min(DT_MAX, (now - last) / 1000); last = now;
      if (state === "aim" && swipeRef.current.active) setAimCurve(aimLine, ball.object.position, swipeRef.current);
      if (state === "runup") {
        const strikeSpot = ball.object.position.clone().add(new THREE.Vector3(-0.24, -BALL_R, 0.42)).setY(0);
        TMP.copy(strikeSpot).sub(kicker.pos).setY(0);
        if (TMP.length() > 0.055) { kicker.dir.copy(TMP.clone().normalize()); kicker.vel.copy(kicker.dir).multiplyScalar(4.05); kicker.pos.addScaledVector(kicker.vel, dt); kicker.speed = kicker.vel.length(); } else { kicker.speed = 0; }
        if (kicker.kickTime < 0.34 && !ball.flying) { replayFrames.length = 0; recordReplayFrame(new THREE.Vector3(0, 1.22, GOAL_LINE_Z + 0.25)); shootBall(ball, swipeRef.current); audio.kick(); state = "flight"; setHud((h) => ({ ...h, state: "Right-foot strike · recording replay" })); }
      } else { kicker.speed = 0; }
      updateBall(ball, dt); updateNetShake(netRig, dt);
      if (state === "flight") {
        if (!shotBlocked && wallBlockCheck(wall, ball)) { shotBlocked = true; audio.save(); }
        if (!shotSaved && keeperSaveCheck(keeper, ball, dt)) { shotSaved = true; audio.save(); }
        if (postHitCheck(ball)) { audio.save(); setHud((h) => ({ ...h, state: "Ball hits the post · still live" })); }
        if (!netTriggered && !shotBlocked && !shotSaved && isBackNetImpact(ball.object.position)) { netTriggered = true; catchBallInNet(ball, netRig); audio.net(); setHud((h) => ({ ...h, state: "Ball reaches the net · checking VAR" })); }
        if (!ball.flying && !shotFinalized) { shotFinalized = true; pendingDecision = decideShot(ball, shotBlocked, shotSaved); varTimer = pendingDecision === "GOAL" || pendingDecision === "NO GOAL" ? 1.15 : 0.65; state = "var"; setHud((h) => ({ ...h, state: pendingDecision === "GOAL" ? "VAR CHECK: ball crossed line" : `VAR CHECK: ${pendingDecision}` })); }
      }
      if (state === "var") { varTimer -= dt; if (varTimer <= 0) { state = "replay"; replayIndex = 0; replayClock = 0; setHud((h) => ({ ...h, state: `SLOW REPLAY: ${pendingDecision}` })); } }
      if (state === "replay") {
        replayClock += dt * 0.48; replayIndex = Math.floor(replayClock * 30);
        const frameData = replayFrames[Math.min(replayFrames.length - 1, replayIndex)];
        if (frameData) {
          ball.object.position.copy(frameData.ball); ball.object.quaternion.copy(frameData.quat); keeper.root.position.copy(frameData.keeper); keeper.root.rotation.copy(frameData.keeperRot); kicker.root.position.copy(frameData.kicker); kicker.root.rotation.copy(frameData.kickerRot);
          const orbitPhase = replayIndex * 0.045;
          const dynamicOffset = new THREE.Vector3(Math.sin(orbitPhase) * 0.85, 0.25 + Math.sin(orbitPhase * 0.7) * 0.18, Math.cos(orbitPhase) * 0.65);
          const replayCam = frameData.cam.clone().lerp(frameData.ball.clone().add(new THREE.Vector3(0, 1.25, 3.9)).add(dynamicOffset), 0.42);
          const replayLook = frameData.look.clone().lerp(frameData.ball.clone().add(new THREE.Vector3(0, 0.28, 0)), 0.52);
          camera.position.copy(replayCam); camera.lookAt(replayLook);
        }
        if (replayIndex >= replayFrames.length - 1 || replayFrames.length === 0) { state = "result"; resultTimer = pendingDecision === "GOAL" ? 1.25 : 1.05; if (pendingDecision === "GOAL") { audio.goal(); score.goals += 1; setHud((h) => ({ ...h, goals: score.goals, state: "VAR: GOAL confirmed" })); } else { score.saves += 1; setHud((h) => ({ ...h, saves: score.saves, state: `VAR: ${pendingDecision}` })); } }
      }
      if (state === "result") { resultTimer -= dt; if (resultTimer <= 0) { state = "aim"; shotBlocked = false; shotSaved = false; shotFinalized = false; netTriggered = false; replayFrames.length = 0; resetShot(ball, kicker, keeper, wall, spot); setHud((h) => ({ ...h, state: "Swipe to aim and shoot" })); } }
      if (state !== "replay") {
        updateActorBase(kicker, dt); applyKickerPose(kicker); updateActorBase(keeper, dt); applyKeeperPose(keeper);
        wall.forEach((w) => { updateActorBase(w, dt); applyWallPose(w); if (w.jumpTime > 0) w.jumpTime = Math.max(0, w.jumpTime - dt); });
        if (kicker.kickTime > 0) kicker.kickTime = Math.max(0, kicker.kickTime - dt);
        if (keeper.diveTime > 0) keeper.diveTime = Math.max(0, keeper.diveTime - dt);
      }
      let lookPoint = new THREE.Vector3(0, 1.22, GOAL_LINE_Z + 0.25);
      if (state !== "replay") {
        if (ball.flying || state === "var") { const toGoal = new THREE.Vector3(0, 0, GOAL_LINE_Z).sub(ball.object.position).setY(0).normalize(); const followPos = ball.object.position.clone().addScaledVector(toGoal, -4.3).add(new THREE.Vector3(0, 1.55, 0)); camera.position.lerp(followPos, 0.11); lookPoint = ball.object.position.clone().addScaledVector(toGoal, 6.0).add(new THREE.Vector3(0, 0.55, 0)); camera.lookAt(lookPoint); } else { const behind = new THREE.Vector3(kicker.pos.x * 0.45, 1.22, kicker.pos.z + 2.85); camera.position.lerp(behind, 0.18); lookPoint.set(0, 1.22, GOAL_LINE_Z + 0.25); camera.lookAt(lookPoint); }
        if (state === "flight" || state === "var") recordReplayFrame(lookPoint);
      }
      renderer.render(scene, camera);
    };
    loop();
    (window as any).__setFreeKickSpot = (next: KickSpot) => { audio.whistle(); spot = next; state = "aim"; hideAimLine(aimLine); replayFrames.length = 0; resetShot(ball, kicker, keeper, wall, spot); setHud((h) => ({ ...h, spot, state: `Free kick ${next}: wall ${wallCountForSpot(next)} at 9.15m` })); };
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", resize); canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointermove", onMove); canvas.removeEventListener("pointerup", onUp); canvas.removeEventListener("pointercancel", onUp); audio.dispose(); renderer.dispose(); };
  }, []);

  const setSpot = (spot: KickSpot) => {
    (window as any).__setFreeKickSpot?.(spot);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#07110b", overflow: "hidden", touchAction: "none", userSelect: "none" }}>
      <div ref={hostRef} style={{ position: "absolute", inset: 0 }}>
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }} />
      </div>
      <div style={{ position: "fixed", left: 0, right: 0, top: 0, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", pointerEvents: "none", color: "white", fontFamily: "system-ui,sans-serif", textShadow: "0 2px 8px #000" }}>
        <div style={{ fontWeight: 900, fontSize: 18 }}>GOALS {hud.goals} · SAVES {hud.saves}</div>
        <div style={{ fontSize: 11, maxWidth: 220, textAlign: "right", lineHeight: 1.25 }}>{hud.state}</div>
      </div>
      <div style={{ position: "fixed", left: 12, bottom: 14, right: 12, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, pointerEvents: "auto" }}>
        <button onClick={() => setSpot("left")} style={buttonStyle}>Left<br />3 wall</button>
        <button onClick={() => setSpot("center")} style={buttonStyle}>Center<br />4 wall</button>
        <button onClick={() => setSpot("right")} style={buttonStyle}>Right<br />3 wall</button>
        <button onClick={() => setSpot("near16")} style={buttonStyle}>Near 16<br />5 wall</button>
      </div>
      <div style={{ position: "fixed", left: 14, top: 54, color: "white", fontFamily: "system-ui,sans-serif", fontSize: 11, lineHeight: 1.3, maxWidth: 300, pointerEvents: "none", textShadow: "0 2px 8px #000" }}>
        Natural shoulder movement, slower replay from the strike, and dynamic replay camera.
      </div>
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  minHeight: 48,
  border: "1px solid rgba(255,255,255,0.28)",
  borderRadius: 14,
  color: "white",
  background: "rgba(15,23,42,0.86)",
  fontWeight: 900,
  fontSize: 11,
  boxShadow: "0 12px 24px rgba(0,0,0,0.35)",
};
