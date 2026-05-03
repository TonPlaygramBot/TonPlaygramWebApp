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

type BowlingFrame = {
  rolls: number[];
  cumulative: number | null;
};

type ScorePlayer = {
  name: string;
  frames: BowlingFrame[];
  total: number;
};

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
const HDRI_URL = "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_09_1k.hdr";
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
        } else {
          running += base;
        }
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
    if (frame.rolls.length === 0) {
      frame.rolls.push(clamp(knocked, 0, 10));
    } else if (frame.rolls.length === 1) {
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

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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

function makeFallbackWoodMaterial() {return new THREE.MeshPhysicalMaterial({ color: 0xd3a365 });}

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

function makeFallbackHuman(color: number) { const g = new THREE.Group(); return g; }

function addHuman(scene: THREE.Scene, start: THREE.Vector3, accent: number): HumanRig {
  const root = new THREE.Group();
  const modelRoot = new THREE.Group();
  const fallback = makeFallbackHuman(accent);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.34, 32), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  modelRoot.position.copy(start);
  modelRoot.add(fallback);
  shadow.position.set(start.x, CFG.laneY + 0.01, start.z);
  scene.add(root, modelRoot, shadow);
  const rig: HumanRig = { root, modelRoot, fallback, shadow, model: null, pos: start.clone(), yaw: 0, action: "idle", approachT: 0, throwT: 0, recoverT: 0, walkCycle: 0, approachFrom: start.clone(), approachTo: start.clone() };
  new GLTFLoader().setCrossOrigin("anonymous").load(HUMAN_URL, (gltf) => { const model = gltf.scene; normalizeHuman(model, 1.82); enableShadow(model); rig.model = model; rig.fallback.visible = false; rig.modelRoot.add(model); }, undefined, () => { rig.fallback.visible = true; });
  return rig;
}

function syncHuman(rig: HumanRig) { rig.modelRoot.position.copy(rig.pos); rig.modelRoot.rotation.y = rig.yaw; rig.shadow.position.set(rig.pos.x, CFG.laneY + 0.01, rig.pos.z); }
function getHeldBallWorldPosition(rig: HumanRig) { return new THREE.Vector3(0.34, 0.94, 0.16).add(rig.pos); }
function makeBallMaterial(colors: [string, string, string]) { return new THREE.MeshPhysicalMaterial({ color: 0x2d88ff }); }
function createActiveBall() { const mesh = new THREE.Mesh(new THREE.SphereGeometry(CFG.ballR, 32, 32), makeBallMaterial(["#9ee7ff", "#2d88ff", "#0d1d50"])); const pos = new THREE.Vector3(0.4, CFG.laneY + 0.82, CFG.playerStartZ); mesh.position.copy(pos); return { mesh, pos, vel: new THREE.Vector3(), held: true, rolling: false, inGutter: false, hook: 0, returnState: "idle", returnT: 0 } as BallState; }
function createPinMesh() { return new THREE.Group(); }
function createPins(scene: THREE.Scene) { return [] as PinState[]; }
function resetPins(pins: PinState[]) {}
function createEnvironment(scene: THREE.Scene, loader: THREE.TextureLoader) { const monitorCanvas = document.createElement("canvas"); monitorCanvas.width = 1280; monitorCanvas.height = 576; const monitorCtx = monitorCanvas.getContext("2d")!; const monitorTex = new THREE.CanvasTexture(monitorCanvas); monitorTex.colorSpace = THREE.SRGBColorSpace; return { monitorCtx, monitorTex }; }
function drawMonitor() {}
function createFrameRollSymbols(frame: BowlingFrame, frameIndex: number) { return ["", ""]; }
function computeIntent(hostWidth: number, hostHeight: number, startX: number, startY: number, x: number, y: number): ThrowIntent { return { power: 0, releaseX: 0, targetX: 0, hook: 0, speed: 0 }; }
function startApproach(rig: HumanRig, intent: ThrowIntent) {}
function updateHuman(rig: HumanRig, ball: BallState, dt: number) {}
function releaseBall(ball: BallState, intent: ThrowIntent) {}
function updateAimVisual(line: THREE.Line, marker: THREE.Mesh, intent: ThrowIntent | null) {}
function updatePins(pins: PinState[], dt: number) { return false; }
function startBallReturn(ball: BallState) {}
function updateBallReturn(ball: BallState, dt: number) { return false; }
function updateBall(ball: BallState, pins: PinState[], dt: number) { return false; }
function updateCamera(camera: THREE.PerspectiveCamera, ball: BallState, player: HumanRig, dt: number) {}

function FrameBox({ frame, index }: { frame: BowlingFrame; index: number }) { return <div />; }

export default function MobileBowlingRealistic() { return <div />; }
