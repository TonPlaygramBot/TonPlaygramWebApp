"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";

type PlayerAction = "idle" | "approach" | "throw" | "recover";
type BallReturnState = "idle" | "toPit" | "hidden" | "returning";

type HudState = {
  power: number;
  status: string;
  activePlayer: number;
  p1: number;
  p2: number;
  frame: number;
  roll: number;
};

type ThrowIntent = {
  power: number;
  releaseX: number;
  targetX: number;
  hook: number;
  speed: number;
};

type ControlState = {
  active: boolean;
  pointerId: number | null;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  intent: ThrowIntent | null;
};

type BowlingFrame = { rolls: number[]; cumulative: number | null };
type ScorePlayer = { name: string; frames: BowlingFrame[]; total: number };

type HumanRig = {
  root: THREE.Group;
  modelRoot: THREE.Group;
  fallback: THREE.Group;
  shadow: THREE.Mesh;
  model: THREE.Object3D | null;
  pos: THREE.Vector3;
  yaw: number;
  action: PlayerAction;
  approachT: number;
  throwT: number;
  recoverT: number;
  walkCycle: number;
  approachFrom: THREE.Vector3;
  approachTo: THREE.Vector3;
};

type BallState = {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  held: boolean;
  rolling: boolean;
  inGutter: boolean;
  hook: number;
  returnState: BallReturnState;
  returnT: number;
};

type PinState = {
  root: THREE.Group;
  start: THREE.Vector3;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  tilt: number;
  tiltDir: THREE.Vector3;
  angularVel: number;
  standing: boolean;
  knocked: boolean;
};

const HUMAN_URL = "https://threejs.org/examples/models/gltf/readyplayer.me.glb";
const HDRI_OPTIONS = [
  { id: "studio_small_09", name: "Studio Small 09", url: "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_09_1k.hdr", thumb: "https://cdn.polyhaven.com/asset_img/thumbs/studio_small_09.png?height=160" },
  { id: "studio_small_03", name: "Studio Small 03", url: "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_03_1k.hdr", thumb: "https://cdn.polyhaven.com/asset_img/thumbs/studio_small_03.png?height=160" },
  { id: "photo_studio_01", name: "Photo Studio 01", url: "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/photo_studio_01_1k.hdr", thumb: "https://cdn.polyhaven.com/asset_img/thumbs/photo_studio_01.png?height=160" },
  { id: "brown_photostudio_02", name: "Brown Photostudio 02", url: "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/brown_photostudio_02_1k.hdr", thumb: "https://cdn.polyhaven.com/asset_img/thumbs/brown_photostudio_02.png?height=160" },
  { id: "empty_warehouse_01", name: "Empty Warehouse 01", url: "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/empty_warehouse_01_1k.hdr", thumb: "https://cdn.polyhaven.com/asset_img/thumbs/empty_warehouse_01.png?height=160" },
  { id: "industrial_workshop_foundry", name: "Industrial Workshop", url: "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/industrial_workshop_foundry_1k.hdr", thumb: "https://cdn.polyhaven.com/asset_img/thumbs/industrial_workshop_foundry.png?height=160" },
  { id: "abandoned_parking", name: "Abandoned Parking", url: "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/abandoned_parking_1k.hdr", thumb: "https://cdn.polyhaven.com/asset_img/thumbs/abandoned_parking.png?height=160" },
  { id: "aerodynamics_workshop", name: "Aerodynamics Workshop", url: "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/aerodynamics_workshop_1k.hdr", thumb: "https://cdn.polyhaven.com/asset_img/thumbs/aerodynamics_workshop.png?height=160" },
  { id: "lebombo", name: "Lebombo", url: "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/lebombo_1k.hdr", thumb: "https://cdn.polyhaven.com/asset_img/thumbs/lebombo.png?height=160" },
  { id: "skidpan", name: "Skidpan", url: "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/skidpan_1k.hdr", thumb: "https://cdn.polyhaven.com/asset_img/thumbs/skidpan.png?height=160" },
] as const;
const DEFAULT_HDRI_ID = "studio_small_09";
const OAK_BASE = "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/oak_veneer_01/";
const OAK = {
  diff: `${OAK_BASE}oak_veneer_01_diff_2k.jpg`,
  rough: `${OAK_BASE}oak_veneer_01_rough_2k.jpg`,
  normal: `${OAK_BASE}oak_veneer_01_nor_gl_2k.jpg`,
};

const UP = new THREE.Vector3(0, 1, 0);

const CFG = {
  laneY: 0.08,
  laneHalfW: 1.56,
  gutterHalfW: 2.08,
  playerStartZ: 7.15,
  approachStopZ: 4.95,
  foulZ: 4.55,
  arrowsZ: 0.95,
  pinDeckZ: -10.75,
  backStopZ: -13.15,
  ballR: 0.18,
  pinR: 0.17,
  pinToppleThreshold: 0.58,
  approachDuration: 0.56,
  throwDuration: 0.9,
  recoverDuration: 0.28,
  releaseT: 0.56,
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const clamp01 = (v: number) => clamp(v, 0, 1);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => t * t * (3 - 2 * t);

function makeEmptyPlayers(): ScorePlayer[] {
  const makeFrames = () => Array.from({ length: 10 }, () => ({ rolls: [] as number[], cumulative: null }));
  return [
    { name: "PLAYER 1", frames: makeFrames(), total: 0 },
    { name: "PLAYER 2", frames: makeFrames(), total: 0 },
  ];
}

function clonePlayers(players: ScorePlayer[]) {
  return players.map((p) => ({ ...p, frames: p.frames.map((f) => ({ rolls: [...f.rolls], cumulative: f.cumulative })) }));
}

function frameComplete(frame: BowlingFrame, index: number) {
  const r = frame.rolls;
  if (index < 9) return r[0] === 10 || r.length >= 2;
  if (r.length < 2) return false;
  if (r[0] === 10 || r[0] + r[1] === 10) return r.length >= 3;
  return r.length >= 2;
}

function currentFrameIndex(player: ScorePlayer) {
  const idx = player.frames.findIndex((f, i) => !frameComplete(f, i));
  return idx === -1 ? 9 : idx;
}

function playerFinished(player: ScorePlayer) {
  return player.frames.every((f, i) => frameComplete(f, i));
}

function recomputePlayerTotals(player: ScorePlayer) {
  const flat = player.frames.flatMap((f) => f.rolls);
  let rollIndex = 0;
  let running = 0;

  for (let frame = 0; frame < 10; frame++) {
    const out = player.frames[frame];
    out.cumulative = null;

    if (frame < 9) {
      const a = flat[rollIndex];
      if (a == null) break;
      if (a === 10) {
        const b = flat[rollIndex + 1];
        const c = flat[rollIndex + 2];
        if (b == null || c == null) break;
        running += 10 + b + c;
        out.cumulative = running;
        rollIndex += 1;
      } else {
        const b = flat[rollIndex + 1];
        if (b == null) break;
        const base = a + b;
        if (base === 10) {
          const c = flat[rollIndex + 2];
          if (c == null) break;
          running += 10 + c;
        } else running += base;
        out.cumulative = running;
        rollIndex += 2;
      }
    } else {
      if (!frameComplete(out, frame)) break;
      running += out.rolls.reduce((s, v) => s + v, 0);
      out.cumulative = running;
    }
  }

  player.total = running;
}

function addRollToPlayer(player: ScorePlayer, knocked: number) {
  const frameIndex = currentFrameIndex(player);
  const frame = player.frames[frameIndex];

  if (frameIndex < 9) {
    if (frame.rolls.length === 0) frame.rolls.push(clamp(knocked, 0, 10));
    else if (frame.rolls.length === 1) frame.rolls.push(clamp(knocked, 0, 10 - frame.rolls[0]));
  } else {
    if (frame.rolls.length === 0) frame.rolls.push(clamp(knocked, 0, 10));
    else if (frame.rolls.length === 1) {
      const max = frame.rolls[0] === 10 ? 10 : 10 - frame.rolls[0];
      frame.rolls.push(clamp(knocked, 0, max));
    } else if (frame.rolls.length === 2) {
      let max = 10;
      if (frame.rolls[0] === 10 && frame.rolls[1] !== 10) max = 10 - frame.rolls[1];
      frame.rolls.push(clamp(knocked, 0, max));
    }
  }

  recomputePlayerTotals(player);
  return { frameIndex, frameEnded: frameComplete(frame, frameIndex), gameFinished: playerFinished(player) };
}

function standingPinsCount(pins: PinState[]) {
  return pins.filter((p) => p.root.visible && p.standing && p.tilt < CFG.pinToppleThreshold).length;
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

function setTexRepeat(tex: THREE.Texture, rx: number, ry: number) {
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(rx, ry);
  tex.anisotropy = 8;
}

function loadOakMaterial(loader: THREE.TextureLoader, repeatX: number, repeatY: number) {
  const diff = loader.load(OAK.diff);
  const rough = loader.load(OAK.rough);
  const normal = loader.load(OAK.normal);
  diff.colorSpace = THREE.SRGBColorSpace;
  setTexRepeat(diff, repeatX, repeatY);
  setTexRepeat(rough, repeatX, repeatY);
  setTexRepeat(normal, repeatX, repeatY);
  return new THREE.MeshPhysicalMaterial({
    map: diff,
    roughnessMap: rough,
    normalMap: normal,
    roughness: 0.22,
    metalness: 0.02,
    clearcoat: 1,
    clearcoatRoughness: 0.055,
    reflectivity: 0.92,
  });
}

function makeFallbackWoodMaterial() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#d3a365";
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = i % 2 ? "rgba(110,65,28,0.12)" : "rgba(255,255,255,0.07)";
    ctx.fillRect(0, Math.random() * 512, 512, 1 + Math.random() * 3);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.1, 8.2);
  return new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.24, metalness: 0.02, clearcoat: 1, clearcoatRoughness: 0.08 });
}

function normalizeHuman(model: THREE.Object3D, targetHeight: number) {
  model.rotation.set(0, Math.PI, 0);
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

function makeFallbackHuman(color: number) {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xecc5a2, roughness: 0.82 });
  const shirt = new THREE.MeshStandardMaterial({ color, roughness: 0.72 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x1f232c, roughness: 0.84 });
  const shoes = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.56 });

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 18), skin);
  head.position.y = 1.62;
  g.add(head);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.54, 6, 14), shirt);
  torso.position.y = 1.05;
  g.add(torso);
  const leftLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.52, 4, 10), pants);
  leftLeg.position.set(-0.12, 0.35, 0);
  g.add(leftLeg);
  const rightLeg = leftLeg.clone();
  rightLeg.position.x = 0.12;
  g.add(rightLeg);
  const leftArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.42, 4, 10), skin);
  leftArm.position.set(-0.32, 1.16, 0);
  leftArm.rotation.z = 0.22;
  g.add(leftArm);
  const rightArm = leftArm.clone();
  rightArm.position.set(0.32, 1.16, 0.06);
  rightArm.rotation.z = -0.18;
  g.add(rightArm);
  const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.28), shoes);
  shoeL.position.set(-0.12, 0.03, -0.02);
  g.add(shoeL);
  const shoeR = shoeL.clone();
  shoeR.position.x = 0.12;
  g.add(shoeR);
  enableShadow(g);
  return g;
}

function addHuman(scene: THREE.Scene, start: THREE.Vector3, accent: number): HumanRig {
  const root = new THREE.Group();
  const modelRoot = new THREE.Group();
  const fallback = makeFallbackHuman(accent);
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.34, 32),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  modelRoot.position.copy(start);
  modelRoot.add(fallback);
  shadow.position.set(start.x, CFG.laneY + 0.01, start.z);
  scene.add(root, modelRoot, shadow);

  const rig: HumanRig = {
    root,
    modelRoot,
    fallback,
    shadow,
    model: null,
    pos: start.clone(),
    yaw: 0,
    action: "idle",
    approachT: 0,
    throwT: 0,
    recoverT: 0,
    walkCycle: 0,
    approachFrom: start.clone(),
    approachTo: start.clone(),
  };

  new GLTFLoader().setCrossOrigin("anonymous").load(
    HUMAN_URL,
    (gltf) => {
      const model = gltf.scene;
      normalizeHuman(model, 1.82);
      enableShadow(model);
      rig.model = model;
      rig.fallback.visible = false;
      rig.modelRoot.add(model);
    },
    undefined,
    () => {
      rig.fallback.visible = true;
    }
  );

  return rig;
}

function syncHuman(rig: HumanRig) {
  rig.modelRoot.position.copy(rig.pos);
  rig.modelRoot.rotation.y = rig.yaw;
  rig.shadow.position.set(rig.pos.x, CFG.laneY + 0.01, rig.pos.z);
}

function getHeldBallWorldPosition(rig: HumanRig) {
  let local = new THREE.Vector3(0.34, 0.94, 0.16);
  if (rig.action === "approach") {
    const s = Math.sin(rig.walkCycle);
    local = new THREE.Vector3(0.36, 0.82 + Math.abs(s) * 0.05, 0.14 + s * 0.09);
  } else if (rig.action === "throw") {
    const t = clamp01(rig.throwT);
    if (t < 0.38) {
      const k = easeInOut(t / 0.38);
      local = new THREE.Vector3(lerp(0.34, 0.44, k), lerp(0.86, 0.55, k), lerp(0.16, -0.68, k));
    } else if (t < CFG.releaseT) {
      const k = easeInOut((t - 0.38) / (CFG.releaseT - 0.38));
      local = new THREE.Vector3(lerp(0.44, 0.22, k), lerp(0.55, 0.42, k), lerp(-0.68, 1.24, k));
    } else {
      const k = easeOutCubic((t - CFG.releaseT) / (1 - CFG.releaseT));
      local = new THREE.Vector3(lerp(0.22, 0.16, k), lerp(0.42, 1.42, k), lerp(1.24, 0.48, k));
    }
  } else if (rig.action === "recover") {
    const k = clamp01(rig.recoverT);
    local = new THREE.Vector3(0.24, lerp(1.18, 0.96, k), lerp(0.44, 0.18, k));
  }
  return local.applyAxisAngle(UP, rig.yaw).add(rig.pos);
}

function makeBallTexture(colors: [string, string, string]) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 1024;
  const ctx = c.getContext("2d")!;
  const grad = ctx.createRadialGradient(320, 260, 30, 512, 512, 560);
  grad.addColorStop(0, colors[0]);
  grad.addColorStop(0.44, colors[1]);
  grad.addColorStop(1, colors[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 1024);
  ctx.globalAlpha = 0.13;
  for (let i = 0; i < 110; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#ffffff" : colors[1];
    ctx.beginPath();
    ctx.arc(Math.random() * 1024, Math.random() * 1024, 14 + Math.random() * 70, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 0.18;
  for (let i = 0; i < 38; i++) {
    ctx.strokeStyle = i % 2 ? colors[0] : "rgba(0,0,0,0.8)";
    ctx.lineWidth = 8 + Math.random() * 18;
    ctx.beginPath();
    ctx.moveTo(Math.random() * 1024, Math.random() * 1024);
    for (let j = 0; j < 5; j++) ctx.lineTo(Math.random() * 1024, Math.random() * 1024);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.beginPath();
  ctx.arc(420, 380, 28, 0, Math.PI * 2);
  ctx.arc(495, 430, 28, 0, Math.PI * 2);
  ctx.arc(395, 492, 26, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeBallMaterial(colors: [string, string, string]) {
  return new THREE.MeshPhysicalMaterial({
    map: makeBallTexture(colors),
    roughness: 0.08,
    metalness: 0.01,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    reflectivity: 1,
    envMapIntensity: 1.4,
  });
}

function createActiveBall() {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(CFG.ballR, 80, 64), makeBallMaterial(["#9ee7ff", "#2d88ff", "#0d1d50"]));
  enableShadow(mesh);
  const pos = new THREE.Vector3(0.4, CFG.laneY + 0.82, CFG.playerStartZ);
  mesh.position.copy(pos);
  return { mesh, pos, vel: new THREE.Vector3(), held: true, rolling: false, inGutter: false, hook: 0, returnState: "idle", returnT: 0 } as BallState;
}

function createPinMesh() {
  const root = new THREE.Group();
  const white = new THREE.MeshPhysicalMaterial({ color: 0xf8f5ef, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 });
  const red = new THREE.MeshPhysicalMaterial({ color: 0xcc2b2b, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.1 });
  const points = [
    new THREE.Vector2(0.045, 0),
    new THREE.Vector2(0.09, 0.06),
    new THREE.Vector2(0.085, 0.2),
    new THREE.Vector2(0.16, 0.36),
    new THREE.Vector2(0.14, 0.5),
    new THREE.Vector2(0.068, 0.62),
    new THREE.Vector2(0.076, 0.7),
    new THREE.Vector2(0.038, 0.74),
    new THREE.Vector2(0, 0.74),
  ];
  root.add(new THREE.Mesh(new THREE.LatheGeometry(points, 42), white));
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.072, 0.035, 40), red);
  stripe.position.y = 0.615;
  root.add(stripe);
  enableShadow(root);
  return root;
}

function createPins(scene: THREE.Scene) {
  const pins: PinState[] = [];
  const positions = [
    [0, 0],
    [-0.32, -0.56], [0.32, -0.56],
    [-0.64, -1.12], [0, -1.12], [0.64, -1.12],
    [-0.96, -1.68], [-0.32, -1.68], [0.32, -1.68], [0.96, -1.68],
  ];
  for (const [x, dz] of positions) {
    const root = createPinMesh();
    const start = new THREE.Vector3(x, CFG.laneY + 0.09, CFG.pinDeckZ + dz);
    root.position.copy(start);
    scene.add(root);
    pins.push({ root, start: start.clone(), pos: start.clone(), vel: new THREE.Vector3(), tilt: 0, tiltDir: new THREE.Vector3(0, 0, -1), angularVel: 0, standing: true, knocked: false });
  }
  return pins;
}

function resetPins(pins: PinState[]) {
  for (const pin of pins) {
    pin.pos.copy(pin.start);
    pin.vel.set(0, 0, 0);
    pin.tilt = 0;
    pin.tiltDir.set(0, 0, -1);
    pin.angularVel = 0;
    pin.standing = true;
    pin.knocked = false;
    pin.root.visible = true;
    pin.root.position.copy(pin.pos);
    pin.root.rotation.set(0, 0, 0);
  }
}

function createEnvironment(scene: THREE.Scene, loader: THREE.TextureLoader) {
  const group = new THREE.Group();
  scene.add(group);
  let laneMat: THREE.Material;
  let woodMat: THREE.Material;
  try {
    laneMat = loadOakMaterial(loader, 1.05, 8.5);
    woodMat = loadOakMaterial(loader, 0.72, 3.2);
  } catch {
    laneMat = makeFallbackWoodMaterial();
    woodMat = makeFallbackWoodMaterial();
  }

  const gutterMat = new THREE.MeshStandardMaterial({ color: 0x262f3a, roughness: 0.38, metalness: 0.2 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x4a5462, roughness: 0.34, metalness: 0.74 });
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x101216, roughness: 0.84 });

  // Arena removed: no walls, no ceiling, and no extra room floor.
  // The bowling game objects below are kept exactly as the playable lane setup.

  const approach = new THREE.Mesh(new THREE.PlaneGeometry(4.9, 4.25, 20, 20), woodMat);
  approach.rotation.x = -Math.PI / 2;
  approach.position.set(0, CFG.laneY - 0.005, 7.35);
  group.add(approach);
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(CFG.laneHalfW * 2, 18.72, 80, 320), laneMat);
  lane.rotation.x = -Math.PI / 2;
  lane.position.set(0, CFG.laneY, -4.2);
  lane.receiveShadow = true;
  group.add(lane);
  const oil = new THREE.Mesh(
    new THREE.PlaneGeometry(CFG.laneHalfW * 2 - 0.06, 13.4),
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, reflectivity: 1 })
  );
  oil.rotation.x = -Math.PI / 2;
  oil.position.set(0, CFG.laneY + 0.002, -2.7);
  group.add(oil);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(CFG.laneHalfW * 2 + 0.5, 0.13, 2.52), woodMat);
  deck.position.set(0, CFG.laneY + 0.02, CFG.pinDeckZ - 0.75);
  group.add(deck);
  const gutterL = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.14, 19.1), gutterMat);
  gutterL.position.set(-1.94, CFG.laneY, -4.2);
  group.add(gutterL);
  const gutterR = gutterL.clone();
  gutterR.position.x = 1.94;
  group.add(gutterR);
  const capL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.24, 19.5), woodMat);
  capL.position.set(-2.24, CFG.laneY + 0.07, -4.2);
  group.add(capL);
  const capR = capL.clone();
  capR.position.x = 2.24;
  group.add(capR);
  const foulLine = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.018, 0.055), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42 }));
  foulLine.position.set(0, CFG.laneY + 0.012, CFG.foulZ);
  group.add(foulLine);
  const arrowMat = new THREE.MeshStandardMaterial({ color: 0x2d4f80, roughness: 0.44 });
  for (let i = -2; i <= 2; i++) {
    const tri = new THREE.Shape();
    tri.moveTo(0, 0.22);
    tri.lineTo(-0.11, -0.16);
    tri.lineTo(0.11, -0.16);
    tri.lineTo(0, 0.22);
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(tri), arrowMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(i * 0.46, CFG.laneY + 0.012, CFG.arrowsZ);
    group.add(mesh);
  }
  const pinsetter = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.8, 1.25), metalMat);
  pinsetter.position.set(0, 0.32, CFG.backStopZ + 0.18);
  group.add(pinsetter);

  const tableTop = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.08, 1.72), woodMat);
  tableTop.position.set(2.02, 0.76, 6.35);
  group.add(tableTop);
  const legGeom = new THREE.BoxGeometry(0.1, 0.7, 0.1);
  for (const sx of [-0.68, 0.68]) {
    for (const sz of [-0.7, 0.7]) {
      const leg = new THREE.Mesh(legGeom, blackMat);
      leg.position.set(2.02 + sx, 0.37, 6.35 + sz);
      group.add(leg);
    }
  }
  const returnBase = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.4, 1.55), woodMat);
  returnBase.position.set(1.67, 0.2, 5.92);
  group.add(returnBase);
  const returnCover = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.84, 28, 1, false, 0, Math.PI), metalMat);
  returnCover.rotation.z = Math.PI / 2;
  returnCover.position.set(1.67, 0.52, 5.92);
  group.add(returnCover);
  const sideChannel = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.18, 9.9), metalMat);
  sideChannel.position.set(1.86, 0.16, 1.05);
  group.add(sideChannel);

  const rackColors: [string, string, string][] = [
    ["#ffa3bf", "#cf245d", "#4f0822"],
    ["#9ee7ff", "#2d88ff", "#0d1d50"],
    ["#ffe59b", "#f57e09", "#5a2c00"],
  ];
  for (let i = 0; i < 3; i++) {
    const rb = new THREE.Mesh(new THREE.SphereGeometry(CFG.ballR, 56, 42), makeBallMaterial(rackColors[i]));
    rb.position.set(2.02, 0.96, 5.82 + i * 0.44);
    enableShadow(rb);
    group.add(rb);
  }

  // 3D overhead monitor already removed so it no longer blocks or distracts the camera.
  enableShadow(group);
}

function createFrameRollSymbols(frame: BowlingFrame, frameIndex: number) {
  const r = frame.rolls;
  if (frameIndex < 9) {
    if (r[0] === 10) return ["", "X"];
    const first = r[0] == null ? "" : r[0] === 0 ? "-" : String(r[0]);
    const second = r[1] == null ? "" : r[0] + r[1] === 10 ? "/" : r[1] === 0 ? "-" : String(r[1]);
    return [first, second];
  }
  const a = r[0] == null ? "" : r[0] === 10 ? "X" : r[0] === 0 ? "-" : String(r[0]);
  const b = r[1] == null ? "" : r[0] === 10 && r[1] === 10 ? "X" : r[0] !== 10 && r[0] + r[1] === 10 ? "/" : r[1] === 0 ? "-" : String(r[1]);
  const c = r[2] == null ? "" : r[2] === 10 ? "X" : r[1] != null && r[1] < 10 && r[1] + r[2] === 10 && r[0] === 10 ? "/" : r[2] === 0 ? "-" : String(r[2]);
  return [a, b, c];
}

function computeIntent(hostWidth: number, hostHeight: number, startX: number, startY: number, x: number, y: number): ThrowIntent {
  const vertical = clamp((startY - y) / Math.max(180, hostHeight * 0.38), 0, 1);
  const screenX = clamp((x / hostWidth) * 2 - 1, -1, 1);
  const dragX = clamp((x - startX) / Math.max(90, hostWidth * 0.18), -1, 1);
  const releaseX = clamp(screenX * 1.0, -1.16, 1.16);
  const targetX = clamp(screenX * 1.22, -1.38, 1.38);
  const power = vertical;
  const speed = lerp(6.2, 16.4, easeOutCubic(power));
  const hook = dragX * lerp(0.06, 0.64, power);
  return { power, releaseX, targetX, hook, speed };
}

function startApproach(rig: HumanRig, intent: ThrowIntent) {
  rig.action = "approach";
  rig.approachT = 0;
  rig.throwT = 0;
  rig.recoverT = 0;
  rig.walkCycle = 0;
  rig.approachFrom.copy(rig.pos);
  rig.approachTo.set(clamp(intent.releaseX * 0.4, -0.52, 0.52), CFG.laneY, CFG.approachStopZ);
}

function updateHuman(rig: HumanRig, ball: BallState, dt: number) {
  if (rig.action === "approach") {
    rig.approachT = clamp01(rig.approachT + dt / CFG.approachDuration);
    rig.walkCycle += dt * 16.8;
    rig.pos.lerpVectors(rig.approachFrom, rig.approachTo, easeInOut(rig.approachT));
    if (rig.model) {
      rig.model.position.y = Math.abs(Math.sin(rig.walkCycle)) * 0.046;
      rig.model.rotation.x = 0.035;
      rig.model.rotation.z = Math.sin(rig.walkCycle) * 0.02;
    }
    if (rig.approachT >= 1) {
      rig.action = "throw";
      rig.throwT = 0.001;
    }
  } else if (rig.action === "throw") {
    rig.throwT += dt / CFG.throwDuration;
    if (rig.model) {
      const t = clamp01(rig.throwT);
      rig.model.position.y = 0;
      rig.model.rotation.x = t < 0.55 ? lerp(0, 0.18, t / 0.55) : lerp(0.18, -0.05, (t - 0.55) / 0.45);
      rig.model.rotation.z = t < 0.45 ? lerp(0, -0.04, t / 0.45) : lerp(-0.04, 0.02, (t - 0.45) / 0.55);
    }
    if (rig.throwT >= 1) {
      rig.action = "recover";
      rig.recoverT = 0.001;
      rig.throwT = 0;
    }
  } else if (rig.action === "recover") {
    rig.recoverT += dt / CFG.recoverDuration;
    if (rig.model) {
      rig.model.rotation.x = lerp(-0.05, 0, clamp01(rig.recoverT));
      rig.model.rotation.z *= 0.82;
    }
    if (rig.recoverT >= 1) {
      rig.recoverT = 0;
      rig.action = "idle";
    }
  } else if (rig.model) {
    rig.model.position.y *= 0.82;
    rig.model.rotation.x *= 0.82;
    rig.model.rotation.z *= 0.82;
  }
  rig.yaw = 0;
  syncHuman(rig);
  if (ball.held) {
    ball.pos.copy(getHeldBallWorldPosition(rig));
    ball.mesh.position.copy(ball.pos);
  }
}

function releaseBall(ball: BallState, intent: ThrowIntent) {
  const releasePos = new THREE.Vector3(intent.releaseX, CFG.laneY + CFG.ballR + 0.02, CFG.foulZ - 0.16);
  const target = new THREE.Vector3(intent.targetX, CFG.laneY + CFG.ballR + 0.02, CFG.pinDeckZ + 0.4);
  const dir = target.clone().sub(releasePos).normalize();
  ball.held = false;
  ball.rolling = true;
  ball.inGutter = false;
  ball.hook = intent.hook;
  ball.pos.copy(releasePos);
  ball.vel.copy(dir.multiplyScalar(intent.speed));
  ball.vel.y = 0;
  ball.mesh.position.copy(ball.pos);
}

function updateAimVisual(line: THREE.Line, marker: THREE.Mesh, intent: ThrowIntent | null) {
  line.visible = !!intent;
  marker.visible = !!intent;
  if (!intent) return;
  const from = new THREE.Vector3(intent.releaseX, CFG.laneY + 0.1, CFG.foulZ - 0.18);
  const to = new THREE.Vector3(intent.targetX, CFG.laneY + 0.1, CFG.arrowsZ + lerp(2.4, -0.4, intent.power));
  const pos = line.geometry.getAttribute("position") as THREE.BufferAttribute;
  pos.setXYZ(0, from.x, from.y, from.z);
  pos.setXYZ(1, to.x, to.y, to.z);
  pos.needsUpdate = true;
  marker.position.set(to.x, CFG.laneY + 0.11, to.z);
}

function collideBallWithPins(ball: BallState, pins: PinState[]) {
  if (!ball.rolling || Math.abs(ball.pos.x) > CFG.laneHalfW + 0.08) return;
  for (const pin of pins) {
    if (!pin.root.visible) continue;
    const dx = pin.pos.x - ball.pos.x;
    const dz = pin.pos.z - ball.pos.z;
    const dist = Math.hypot(dx, dz);
    const minDist = CFG.ballR + CFG.pinR;
    if (dist > minDist || dist < 0.001) continue;
    const n = new THREE.Vector3(dx / dist, 0, dz / dist);
    const speed = Math.hypot(ball.vel.x, ball.vel.z);
    const impulse = Math.max(1.0, speed * 0.78);
    pin.vel.addScaledVector(n, impulse);
    pin.vel.z += ball.vel.z * 0.18;
    pin.angularVel += impulse * 1.8;
    pin.tiltDir.copy(n).normalize();
    pin.standing = false;
    pin.knocked = true;
    ball.vel.addScaledVector(n, -0.6);
    ball.vel.multiplyScalar(0.92);
  }
}

function collidePins(pins: PinState[]) {
  for (let i = 0; i < pins.length; i++) {
    for (let j = i + 1; j < pins.length; j++) {
      const a = pins[i];
      const b = pins[j];
      if (!a.root.visible || !b.root.visible) continue;
      const dx = b.pos.x - a.pos.x;
      const dz = b.pos.z - a.pos.z;
      const dist = Math.hypot(dx, dz);
      const minDist = CFG.pinR * 1.8;
      if (dist > minDist || dist < 0.001) continue;
      const n = new THREE.Vector3(dx / dist, 0, dz / dist);
      const impulse = 0.45;
      a.vel.addScaledVector(n, -impulse);
      b.vel.addScaledVector(n, impulse);
      a.standing = false;
      b.standing = false;
      a.knocked = true;
      b.knocked = true;
      a.angularVel += 0.7;
      b.angularVel += 0.7;
      a.tiltDir.copy(n).multiplyScalar(-1);
      b.tiltDir.copy(n);
    }
  }
}

function updatePins(pins: PinState[], dt: number) {
  collidePins(pins);
  let moving = false;
  for (const pin of pins) {
    if (!pin.root.visible) continue;
    const speed = Math.hypot(pin.vel.x, pin.vel.z);
    if (speed > 0.015 || Math.abs(pin.angularVel) > 0.015) moving = true;
    pin.pos.addScaledVector(pin.vel, dt);
    pin.vel.multiplyScalar(Math.exp(-2.05 * dt));
    if (!pin.standing || speed > 0.28) {
      pin.standing = false;
      pin.knocked = true;
      pin.tilt = clamp(pin.tilt + (pin.angularVel + speed * 1.18) * dt, 0, 1.46);
      pin.angularVel *= Math.exp(-1.55 * dt);
    }
    if (Math.abs(pin.pos.x) > 2.35 || pin.pos.z < CFG.backStopZ - 0.25 || pin.pos.z > CFG.pinDeckZ + 1.15) {
      pin.knocked = true;
      pin.root.visible = false;
    }
    pin.root.position.copy(pin.pos);
    if (pin.standing) {
      pin.root.rotation.x *= 0.88;
      pin.root.rotation.z *= 0.88;
    } else {
      const d = pin.tiltDir.lengthSq() > 0.001 ? pin.tiltDir.clone().normalize() : new THREE.Vector3(0, 0, -1);
      pin.root.rotation.x = d.z * pin.tilt;
      pin.root.rotation.z = -d.x * pin.tilt;
    }
  }
  return moving;
}

function startBallReturn(ball: BallState) {
  if (ball.returnState !== "idle") return;
  ball.returnState = "toPit";
  ball.returnT = 0;
  ball.rolling = false;
  ball.vel.set(0, 0, 0);
}

function updateBallReturn(ball: BallState, dt: number) {
  if (ball.returnState === "idle") return false;
  if (ball.returnState === "toPit") {
    ball.returnT += dt / 0.48;
    ball.mesh.position.lerp(new THREE.Vector3(0, 0.16, CFG.backStopZ + 0.1), 1 - Math.exp(-8 * dt));
    if (ball.returnT >= 1) {
      ball.returnState = "hidden";
      ball.returnT = 0;
      ball.mesh.visible = false;
    }
    return false;
  }
  if (ball.returnState === "hidden") {
    ball.returnT += dt / 0.95;
    if (ball.returnT >= 1) {
      ball.returnState = "returning";
      ball.returnT = 0;
      ball.mesh.visible = true;
      ball.pos.set(1.86, 0.27, 1.1);
      ball.mesh.position.copy(ball.pos);
    }
    return false;
  }
  if (ball.returnState === "returning") {
    ball.returnT += dt / 1.5;
    const t = easeOutCubic(clamp01(ball.returnT));
    ball.pos.set(1.71, 0.9, lerp(1.1, 5.92, t));
    ball.mesh.position.copy(ball.pos);
    ball.mesh.rotateZ(0.16);
    ball.mesh.rotateX(0.23);
    if (ball.returnT >= 1) {
      ball.returnState = "idle";
      ball.returnT = 0;
      ball.held = true;
      ball.rolling = false;
      ball.inGutter = false;
      return true;
    }
  }
  return false;
}

function updateBall(ball: BallState, pins: PinState[], dt: number) {
  if (!ball.rolling) return false;
  const flatSpeed = Math.hypot(ball.vel.x, ball.vel.z);
  ball.inGutter = Math.abs(ball.pos.x) > CFG.laneHalfW;
  if (!ball.inGutter && flatSpeed > 0.85 && ball.pos.z < 2.6) {
    const hookPhase = clamp01((2.4 - ball.pos.z) / 8.4);
    ball.vel.x += ball.hook * hookPhase * dt;
  }
  const drag = ball.inGutter ? 1.24 : 0.4;
  ball.vel.multiplyScalar(Math.exp(-drag * dt));
  ball.pos.addScaledVector(ball.vel, dt);
  if (Math.abs(ball.pos.x) > CFG.gutterHalfW) {
    ball.pos.x = clamp(ball.pos.x, -CFG.gutterHalfW, CFG.gutterHalfW);
    ball.vel.x *= -0.22;
  }
  ball.pos.y = CFG.laneY + CFG.ballR + (ball.inGutter ? -0.08 : 0.02);
  ball.mesh.position.copy(ball.pos);
  const speed = Math.hypot(ball.vel.x, ball.vel.z);
  if (speed > 0.02) {
    const rollAxis = new THREE.Vector3(ball.vel.z, 0, -ball.vel.x).normalize();
    if (rollAxis.lengthSq() > 0.001) ball.mesh.rotateOnWorldAxis(rollAxis, (speed / CFG.ballR) * dt);
  }
  collideBallWithPins(ball, pins);
  if (ball.pos.z <= CFG.backStopZ + 0.45 || speed < 0.12) startBallReturn(ball);
  return true;
}

function updateCamera(camera: THREE.PerspectiveCamera, ball: BallState, player: HumanRig, dt: number) {
  let desired: THREE.Vector3;
  let look: THREE.Vector3;
  if (ball.rolling) {
    const lead = ball.vel.clone().setY(0);
    if (lead.lengthSq() < 0.001) lead.set(0, 0, -1);
    lead.normalize();
    desired = ball.pos.clone().addScaledVector(lead, -4.85).add(new THREE.Vector3(0, 2.45, 0.82));
    look = ball.pos.clone().addScaledVector(lead, 2.15).add(new THREE.Vector3(0, 0.34, 0));
  } else if (player.action === "approach" || player.action === "throw" || player.action === "recover") {
    desired = player.pos.clone().add(new THREE.Vector3(0, 2.55, 3.72));
    look = player.pos.clone().add(new THREE.Vector3(0, 0.85, -1.7));
  } else {
    desired = new THREE.Vector3(0, 2.9, 10.8);
    look = new THREE.Vector3(0, CFG.laneY + 0.74, -2.6);
  }
  camera.position.lerp(desired, 1 - Math.exp(-5.1 * dt));
  const currentLook = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).multiplyScalar(8).add(camera.position);
  currentLook.lerp(look, 1 - Math.exp(-7 * dt));
  camera.lookAt(currentLook);
}

function FrameBox({ frame, index }: { frame: BowlingFrame; index: number }) {
  const rolls = createFrameRollSymbols(frame, index);
  const smallCols = index === 9 ? 3 : 2;
  return (
    <div style={{ minWidth: index === 9 ? 44 : 34, border: "1px solid rgba(255,255,255,0.18)", borderRadius: 6, overflow: "hidden", background: "rgba(255,255,255,0.04)" }}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${smallCols}, 1fr)`, borderBottom: "1px solid rgba(255,255,255,0.14)", minHeight: 18, fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.96)" }}>
        {rolls.map((r, i) => (
          <div key={i} style={{ textAlign: "center", padding: "2px 0", borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.12)" : "none" }}>{r}</div>
        ))}
      </div>
      <div style={{ textAlign: "center", padding: "4px 2px", minHeight: 18, fontSize: 11, fontWeight: 900, color: "#7fd6ff" }}>{frame.cumulative ?? ""}</div>
    </div>
  );
}

export default function MobileBowlingRealistic() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hud, setHud] = useState<HudState>({ power: 0, status: "Swipe up to bowl", activePlayer: 0, p1: 0, p2: 0, frame: 1, roll: 1 });
  const [scores, setScores] = useState<ScorePlayer[]>(() => makeEmptyPlayers());
  const [menuOpen, setMenuOpen] = useState(false);
  const [graphicsQuality, setGraphicsQuality] = useState<"performance"|"balanced"|"ultra">("balanced");
  const [selectedHdriId, setSelectedHdriId] = useState<string>(() => localStorage.getItem("bowling.hdri") || DEFAULT_HDRI_ID);
  const scoresMemo = useMemo(() => scores, [scores]);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.14;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x11161f, 36, 86);

    const camera = new THREE.PerspectiveCamera(48, 1, 0.05, 80);
    camera.position.set(0, 2.9, 10.8);

    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    let envTex: THREE.Texture | null = null;
    const applyHdri = (id: string) => {
      const selected = HDRI_OPTIONS.find((h) => h.id === id) || HDRI_OPTIONS[0];
      new RGBELoader().setCrossOrigin("anonymous").load(
      selected.url,
      (hdr) => {
        envTex = pmrem.fromEquirectangular(hdr).texture;
        scene.environment = envTex;
        scene.background = envTex;
        scene.backgroundBlurriness = 0.2;
        scene.backgroundIntensity = 0.92;
        hdr.dispose();
      },
      undefined,
      () => {}
    );
    };
    applyHdri(selectedHdriId);

    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    scene.add(new THREE.HemisphereLight(0xd7e8ff, 0x24160b, 0.72));
    const key = new THREE.DirectionalLight(0xffffff, 1.58);
    key.position.set(-4.2, 7.8, 7.6);
    key.castShadow = true;
    key.shadow.mapSize.width = 2048;
    key.shadow.mapSize.height = 2048;
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 36;
    key.shadow.camera.left = -8;
    key.shadow.camera.right = 8;
    key.shadow.camera.top = 12;
    key.shadow.camera.bottom = -14;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xb8d4ff, 0.35);
    fill.position.set(4.4, 4.8, 6.3);
    scene.add(fill);
    for (let i = 0; i < 6; i++) {
      const z = lerp(6.5, -11.7, i / 5);
      const light = new THREE.PointLight(0xffefdc, 0.5, 10.8, 1.9);
      light.position.set(i % 2 === 0 ? -1.12 : 1.12, 2.8, z);
      scene.add(light);
    }

    const texLoader = new THREE.TextureLoader();
    createEnvironment(scene, texLoader);
    const pins = createPins(scene);
    const player = addHuman(scene, new THREE.Vector3(0, CFG.laneY, CFG.playerStartZ), 0xff7a2f);
    const ball = createActiveBall();
    scene.add(ball.mesh);

    let localScores = makeEmptyPlayers();
    let activePlayer = 0;
    let lastShotStandingBefore = 10;
    let pinsWereMoving = false;
    let settleTimer = 0;
    let waitingForBallReturn = false;
    let pendingIntent: ThrowIntent | null = null;
    let shotResolved = false;
    let nextAction: "samePlayer" | "nextPlayer" | "gameOver" = "samePlayer";

    const currentFrameRoll = () => {
      const p = localScores[activePlayer];
      const f = currentFrameIndex(p);
      const rolls = p.frames[f].rolls.length;
      return { frame: Math.min(10, f + 1), roll: Math.min(3, rolls + 1) };
    };

    const syncReactScores = () => {
      setScores(clonePlayers(localScores));
      const turn = currentFrameRoll();
      setHud((prev) => ({ ...prev, activePlayer, p1: localScores[0].total, p2: localScores[1].total, frame: turn.frame, roll: turn.roll }));
    };
    syncReactScores();

    const aimGeom = new THREE.BufferGeometry();
    aimGeom.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    const aimLine = new THREE.Line(aimGeom, new THREE.LineBasicMaterial({ color: 0x8bd7ff, transparent: true, opacity: 0.85 }));
    aimLine.visible = false;
    scene.add(aimLine);
    const aimMarker = new THREE.Mesh(new THREE.RingGeometry(0.24, 0.31, 36), new THREE.MeshBasicMaterial({ color: 0x8bd7ff, transparent: true, opacity: 0.72, side: THREE.DoubleSide }));
    aimMarker.rotation.x = -Math.PI / 2;
    aimMarker.visible = false;
    scene.add(aimMarker);
    const ballShadow = new THREE.Mesh(new THREE.CircleGeometry(0.24, 32), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
    ballShadow.rotation.x = -Math.PI / 2;
    scene.add(ballShadow);

    const control: ControlState = { active: false, pointerId: null, startX: 0, startY: 0, lastX: 0, lastY: 0, intent: null };

    const resetPlayerPoseForNextBall = () => {
      player.action = "idle";
      player.approachT = 0;
      player.throwT = 0;
      player.recoverT = 0;
      player.walkCycle = 0;
      player.pos.set(0, CFG.laneY, CFG.playerStartZ);
      player.approachFrom.copy(player.pos);
      player.approachTo.copy(player.pos);
      syncHuman(player);
      ball.held = true;
      ball.rolling = false;
      ball.inGutter = false;
      ball.vel.set(0, 0, 0);
      ball.mesh.visible = true;
    };

    const prepareNextTurnAfterReturn = () => {
      waitingForBallReturn = false;
      shotResolved = false;
      pinsWereMoving = false;
      settleTimer = 0;
      pendingIntent = null;
      resetPlayerPoseForNextBall();
      if (nextAction === "nextPlayer") resetPins(pins);
      syncReactScores();
      const playerName = localScores[activePlayer].name;
      setHud((prev) => ({ ...prev, status: nextAction === "gameOver" ? "Game over" : `${playerName} swipe up to bowl` }));
    };

    const finalizeShot = () => {
      const afterStanding = standingPinsCount(pins);
      const knocked = clamp(lastShotStandingBefore - afterStanding, 0, 10);
      const playerBefore = localScores[activePlayer];
      const result = addRollToPlayer(playerBefore, knocked);
      let status = `${playerBefore.name} knocked ${knocked} pin${knocked === 1 ? "" : "s"}`;
      if (result.frameIndex < 9 && playerBefore.frames[result.frameIndex].rolls[0] === 10) status = `${playerBefore.name} STRIKE!`;
      if (result.frameIndex < 9 && playerBefore.frames[result.frameIndex].rolls.length === 2 && playerBefore.frames[result.frameIndex].rolls[0] + playerBefore.frames[result.frameIndex].rolls[1] === 10 && playerBefore.frames[result.frameIndex].rolls[0] !== 10) status = `${playerBefore.name} SPARE!`;
      const allDone = localScores.every((p) => playerFinished(p));
      if (allDone) nextAction = "gameOver";
      else if (result.frameEnded) {
        activePlayer = (activePlayer + 1) % 2;
        nextAction = "nextPlayer";
      } else nextAction = "samePlayer";
      syncReactScores();
      setHud((prev) => ({ ...prev, status }));
      shotResolved = true;
      waitingForBallReturn = true;
      if (ball.returnState === "idle") startBallReturn(ball);
    };

    let frameId = 0;
    let last = performance.now();

    const resize = () => {
      const w = Math.max(1, host.clientWidth);
      const h = Math.max(1, host.clientHeight);
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.fov = camera.aspect < 0.72 ? 52 : 46;
      camera.updateProjectionMatrix();
    };

    const onPointerDown = (e: PointerEvent) => {
      if (nextAction === "gameOver") return;
      if (control.active || ball.rolling || waitingForBallReturn) return;
      if (player.action === "approach" || player.action === "throw" || player.action === "recover") return;
      canvas.setPointerCapture(e.pointerId);
      control.active = true;
      control.pointerId = e.pointerId;
      control.startX = e.clientX;
      control.startY = e.clientY;
      control.lastX = e.clientX;
      control.lastY = e.clientY;
      control.intent = computeIntent(host.clientWidth, host.clientHeight, e.clientX, e.clientY, e.clientX, e.clientY);
      pendingIntent = control.intent;
      updateAimVisual(aimLine, aimMarker, control.intent);
      setHud((prev) => ({ ...prev, power: 0, status: "Swipe up. Slide left/right to aim." }));
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!control.active || control.pointerId !== e.pointerId) return;
      control.lastX = e.clientX;
      control.lastY = e.clientY;
      control.intent = computeIntent(host.clientWidth, host.clientHeight, control.startX, control.startY, e.clientX, e.clientY);
      pendingIntent = control.intent;
      updateAimVisual(aimLine, aimMarker, control.intent);
      setHud((prev) => ({ ...prev, power: control.intent!.power }));
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!control.active || control.pointerId !== e.pointerId) return;
      try { canvas.releasePointerCapture(e.pointerId); } catch {}
      control.active = false;
      control.pointerId = null;
      aimLine.visible = false;
      aimMarker.visible = false;
      const intent = computeIntent(host.clientWidth, host.clientHeight, control.startX, control.startY, e.clientX, e.clientY);
      if (intent.power < 0.05) {
        pendingIntent = null;
        setHud((prev) => ({ ...prev, power: 0, status: "Swipe higher for power" }));
        return;
      }
      pendingIntent = intent;
      startApproach(player, intent);
      setHud((prev) => ({ ...prev, power: 0, status: "Fast approach to the line" }));
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("resize", resize);
    resize();

    function animate() {
      frameId = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      updateHuman(player, ball, dt);
      if (player.action === "throw" && pendingIntent && player.throwT >= CFG.releaseT && ball.held) {
        lastShotStandingBefore = standingPinsCount(pins);
        releaseBall(ball, pendingIntent);
        pendingIntent = null;
        setHud((prev) => ({ ...prev, status: "Ball rolling" }));
      }
      updateBall(ball, pins, dt);
      const pinsMoving = updatePins(pins, dt);
      if (pinsMoving) pinsWereMoving = true;
      if (!shotResolved && !ball.rolling && pinsWereMoving && !pinsMoving) {
        settleTimer += dt;
        if (settleTimer > 0.72) finalizeShot();
      } else if (pinsMoving) settleTimer = 0;
      if (ball.returnState !== "idle") {
        const finished = updateBallReturn(ball, dt);
        if (finished && waitingForBallReturn) prepareNextTurnAfterReturn();
      }
      ballShadow.visible = ball.mesh.visible;
      ballShadow.position.set(ball.pos.x, CFG.laneY + 0.01, ball.pos.z);
      ballShadow.scale.setScalar(ball.held ? 0.72 : ball.inGutter ? 0.9 : 1.04);
      if (control.active) updateAimVisual(aimLine, aimMarker, control.intent);
      updateCamera(camera, ball, player, dt);
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
      pmrem.dispose();
      envTex?.dispose();
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
  }, [graphicsQuality, selectedHdriId]);

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#090b11", touchAction: "none", userSelect: "none" }}>
      <div ref={hostRef} style={{ position: "absolute", inset: 0 }}>
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }} />
      </div>

      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif" }}>
        <div style={{ position: "absolute", left: 8, right: 8, top: 8, color: "white", background: "rgba(5,8,14,0.72)", border: "1px solid rgba(255,255,255,0.16)", borderRadius: 16, padding: "8px 8px 10px", boxShadow: "0 14px 30px rgba(0,0,0,0.28)", backdropFilter: "blur(10px)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: 0.2 }}>REAL BOWLING SCOREBOARD</div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#7fd6ff" }}>FRAME {hud.frame} · ROLL {hud.roll} · P{hud.activePlayer + 1}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "56px repeat(10, minmax(28px, 1fr))", gap: 4, alignItems: "center" }}>
            <div style={{ fontSize: 10, fontWeight: 800, opacity: 0.72, textAlign: "center" }}></div>
            {Array.from({ length: 10 }, (_, i) => <div key={i} style={{ textAlign: "center", fontSize: 10, fontWeight: 800, opacity: 0.7 }}>{i + 1}</div>)}
            {scoresMemo.map((p, row) => (
              <React.Fragment key={p.name}>
                <div style={{ paddingLeft: 2, fontSize: 11, fontWeight: 900, color: row === hud.activePlayer ? "#7fd6ff" : "#ffffff" }}>{row === 0 ? `P1 ${p.total}` : `P2 ${p.total}`}</div>
                {p.frames.map((f, i) => <FrameBox key={`${row}-${i}`} frame={f} index={i} />)}
              </React.Fragment>
            ))}
          </div>
          <div style={{ marginTop: 7, textAlign: "center", fontSize: 11, fontWeight: 700, opacity: 0.9 }}>{hud.status}</div>
        </div>

        <button onClick={() => setMenuOpen((v)=>!v)} style={{ position:"absolute", top: 132, left: 8, width: 40, height:40, borderRadius: 10, border:"1px solid rgba(255,255,255,0.28)", background:"rgba(5,8,14,0.72)", color:"#fff", fontSize:22, fontWeight:900, pointerEvents:"auto" }}>☰</button>
        {menuOpen ? <div style={{ position:"absolute", top: 178, left: 8, right: 8, maxHeight:"48vh", overflow:"auto", borderRadius: 14, padding: 10, background:"rgba(5,8,14,0.88)", border:"1px solid rgba(255,255,255,0.18)", pointerEvents:"auto" }}>
          <div style={{fontSize:12,fontWeight:800,marginBottom:8}}>Graphics (Pool Royal style)</div>
          {["performance","balanced","ultra"].map((q)=> <button key={q} onClick={()=>setGraphicsQuality(q as any)} style={{marginRight:6, marginBottom:6, padding:"6px 9px", borderRadius:8, border:"1px solid rgba(255,255,255,0.2)", background: graphicsQuality===q?"#7fd6ff":"rgba(255,255,255,0.08)", color: graphicsQuality===q?"#001018":"#fff"}}>{q}</button>)}
          <div style={{fontSize:12,fontWeight:800,margin:"10px 0 6px"}}>HDRI inventory</div>
          <div style={{display:"grid", gridTemplateColumns:"repeat(2,minmax(0,1fr))", gap:8}}>
            {HDRI_OPTIONS.map((h,idx)=><button key={h.id} onClick={()=>{setSelectedHdriId(h.id); localStorage.setItem("bowling.hdri",h.id);}} style={{textAlign:"left", border:"1px solid rgba(255,255,255,0.2)", borderRadius:10, padding:6, background:selectedHdriId===h.id?"rgba(127,214,255,0.2)":"rgba(255,255,255,0.05)", color:"#fff"}}><img src={h.thumb} alt={h.name} style={{width:"100%",borderRadius:8,marginBottom:6}} /><div style={{fontSize:11,fontWeight:700}}>{h.name}</div><div style={{fontSize:10,opacity:0.75}}>{idx===0?"Default owned":"Store item"}</div></button>)}
          </div>
        </div> : null}

        <div style={{ position: "absolute", left: 10, bottom: 18, color: "white", background: "rgba(5,8,14,0.54)", border: "1px solid rgba(255,255,255,0.14)", padding: "10px 11px", borderRadius: 16, fontSize: 12, lineHeight: 1.38, maxWidth: 265, boxShadow: "0 14px 30px rgba(0,0,0,0.22)", backdropFilter: "blur(10px)" }}>
          Swipe visually upward to bowl.<br />Slide left or right to aim on the lane (precision boosted).<br />HDRI now renders as full arena background lighting.
        </div>

        <div style={{ position: "absolute", right: 12, bottom: 24, width: 52, height: 166, borderRadius: 999, background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.26)", overflow: "hidden", boxShadow: "0 12px 30px rgba(0,0,0,0.24)", backdropFilter: "blur(8px)" }}>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: `${Math.round(hud.power * 100)}%`, background: "rgba(139,215,255,0.9)", transition: hud.power === 0 ? "height 150ms ease-out" : "none" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(0,0,0,0.8)", fontSize: 11, fontWeight: 950, writingMode: "vertical-rl", transform: "rotate(180deg)" }}>POWER</div>
        </div>
      </div>
    </div>
  );
}
