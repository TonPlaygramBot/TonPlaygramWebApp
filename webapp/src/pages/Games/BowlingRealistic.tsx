"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { BOWLING_DOMINO_CHARACTER_TEXTURES, BOWLING_DOMINO_CLOTH_MATERIALS, BOWLING_HDRI_VARIANTS, BOWLING_HUMAN_CHARACTER_OPTIONS } from "../../config/bowlingInventoryConfig.js";
import { POOL_ROYALE_DEFAULT_UNLOCKS, POOL_ROYALE_OPTION_LABELS, POOL_ROYALE_STORE_ITEMS } from "../../config/poolRoyaleInventoryConfig.js";
import { getCachedPoolRoyalInventory } from "../../utils/poolRoyalInventory.js";
import { createMurlanStyleTable } from "../../utils/murlanTable.js";

type PlayerAction = "idle" | "seated" | "standingUp" | "approach" | "throw" | "recover" | "celebrate" | "toSeat" | "toRack" | "pickBall" | "toApproach" | "replay";
type BallReturnState = "idle" | "toPit" | "hidden" | "returning";
type PinResetPhase = "idle" | "lowering" | "sweeping" | "lifting";

type HudState = {
  power: number;
  status: string;
  compliment: string;
  activePlayer: number;
  p1: number;
  p2: number;
  frame: number;
  roll: number;
  rule: string;
  lane: string;
};

type ThrowIntent = {
  power: number;
  releaseX: number;
  targetX: number;
  hook: number;
  speed: number;
  spin: number;
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

type CameraLookState = {
  active: boolean;
  pointerId: number | null;
  startX: number;
  startY: number;
  yaw: number;
  pitch: number;
  targetYaw: number;
  targetPitch: number;
};

type BowlingFrame = { rolls: number[]; cumulative: number | null };
type RollDecision = { frameIndex: number; rollIndex: number; frameEnded: boolean; resetPins: boolean; gameFinished: boolean };
type ScorePlayer = { name: string; frames: BowlingFrame[]; total: number };

type HumanRig = {
  root: THREE.Group;
  modelRoot: THREE.Group;
  fallback: THREE.Group;
  shadow: THREE.Mesh;
  model: THREE.Object3D | null;
  pos: THREE.Vector3;
  yaw: number;
  targetYaw: number;
  yawVelocity: number;
  action: PlayerAction;
  approachT: number;
  throwT: number;
  recoverT: number;
  celebrateT: number;
  celebrateNext: boolean;
  returnWalkT: number;
  pickT: number;
  walkCycle: number;
  approachFrom: THREE.Vector3;
  approachTo: THREE.Vector3;
  seatPos: THREE.Vector3;
  seatYaw: number;
  standPos: THREE.Vector3;
  seatT: number;
};

type BallVariant = { label: string; radius: number; massFactor: number; colors: [string,string,string] };
type HumanCharacterOption = { id: string; label: string; modelUrls: string[]; thumbnail?: string; accent?: string; clothCombo?: string };

type BallState = {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  held: boolean;
  rolling: boolean;
  laneCenter: number;
  inGutter: boolean;
  hook: number;
  returnState: BallReturnState;
  returnT: number;
  variant: BallVariant;
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
const DEFAULT_HUMAN_CHARACTER_ID = BOWLING_HUMAN_CHARACTER_OPTIONS[0]?.id || "rpm-current-domino";
const HUMAN_CHARACTER_OPTIONS = BOWLING_HUMAN_CHARACTER_OPTIONS as HumanCharacterOption[];
const HUMAN_INITIAL_SCALE = 1.26;
const HDRI_OPTIONS = BOWLING_HDRI_VARIANTS.map((h) => ({
  id: h.id,
  name: h.name,
  thumb: h.thumbnailUrl || h.thumbnail,
  hdriUrl: h.hdriUrl,
  assetId: h.assetId,
  assetUrls: h.assetUrls,
  preferredResolutions: h.preferredResolutions,
  rotationY: h.rotationY,
  cameraHeightM: h.cameraHeightM,
  arenaScale: h.arenaScale,
}));
const DEFAULT_HDRI_ID = HDRI_OPTIONS[0]?.id || "studio_small_09";
const TABLE_FINISH_ITEMS = POOL_ROYALE_STORE_ITEMS.filter((item) => item.type === "tableFinish");
const CHROME_ITEMS = POOL_ROYALE_STORE_ITEMS.filter((item) => item.type === "chromeColor");
const PORTRAIT_CAMERA_SIDE_OFFSET = 0.42;
const PORTRAIT_CAMERA_HEIGHT_OFFSET = 0.18;
const BOWLING_HDRI_WALL_ALIGNMENT_Y = Math.PI / 2;
const BALL_VARIANTS: BallVariant[] = [
  { label: "10", radius: 0.165, massFactor: 0.92, colors:["#93c5fd","#2563eb","#0b1b4a"] },
  { label: "12", radius: 0.176, massFactor: 1.0, colors:["#fda4af","#e11d48","#4a0416"] },
  { label: "14", radius: 0.188, massFactor: 1.08, colors:["#fde68a","#f59e0b","#4a2900"] },
  { label: "16", radius: 0.2, massFactor: 1.16, colors:["#a7f3d0","#059669","#032d22"] },
];
const OAK_BASE = "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/oak_veneer_01/";
const OAK = {
  diff: `${OAK_BASE}oak_veneer_01_diff_2k.jpg`,
  rough: `${OAK_BASE}oak_veneer_01_rough_2k.jpg`,
  normal: `${OAK_BASE}oak_veneer_01_nor_gl_2k.jpg`,
};

const UP = new THREE.Vector3(0, 1, 0);

const STRIKE_DANCE_LINES = ["Perfect strike!", "Unstoppable!", "Ten down, wow!", "Pure power!"];
const RESULT_COMPLIMENTS = { strike:["STRIKE! Beautiful release.","Clean pocket hit!","That was elite timing."], spare:["Great spare conversion!","Clutch second ball!"], open:["Nice try—adjust and fire again.","Good pace, keep rhythm."] } as const;

const CFG = {
  laneY: -0.86,
  laneHalfW: 1.36,
  gutterHalfW: 1.72,
  laneCenterOffset: 1.82,
  playerStartZ: 7.62,
  rackEdgeX: 1.38,
  rackStopZ: 6.58,
  approachStopZ: 4.98,
  foulZ: 4.55,
  arrowsZ: 0.78,
  pinDeckZ: -13.55,
  backStopZ: -16.08,
  ballR: 0.18,
  pinR: 0.17,
  pinToppleThreshold: 0.58,
  pinSpotSpacing: 0.56,
  approachDuration: 0.72,
  throwDuration: 1.08,
  replayDuration: 3.2,
  recoverDuration: 0.28,
  celebrateDuration: 0.68,
  seatWalkDuration: 0.95,
  standDuration: 0.42,
  returnWalkDuration: 1.08,
  pickDuration: 0.52,
  releaseT: 0.56,
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const clamp01 = (v: number) => clamp(v, 0, 1);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => t * t * (3 - 2 * t);
const HDRI_RES_LADDER = ["8k", "4k", "2k", "1k"] as const;
const BOWLING_RULE_SUMMARY = "Ten-pin rules: 10 frames · strike resets the rack · spare earns next-ball bonus · 10th frame allows bonus balls.";
const LANE_BOARD_COUNT = 39;
const BOARD_WIDTH = (CFG.laneHalfW * 2) / LANE_BOARD_COUNT;
const BOWLING_MURLAN_CHAIR_URLS = [
  "https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/dining_chair_02/dining_chair_02_1k.gltf",
  "https://dl.polyhaven.org/file/ph-assets/Models/gltf/2k/dining_chair_02/dining_chair_02_2k.gltf",
  "https://dl.polyhaven.org/file/ph-assets/Models/gltf/4k/dining_chair_02/dining_chair_02_4k.gltf",
];
const LANE_CENTERS = [-CFG.laneCenterOffset, CFG.laneCenterOffset] as const;
const laneCenterForPlayer = (playerIndex: number) => LANE_CENTERS[playerIndex === 1 ? 1 : 0];
const BOWLING_LOUNGE_CENTER = new THREE.Vector3(0, CFG.laneY, 8.18);
const BOWLING_TABLE_CENTERS = [
  new THREE.Vector3(-4.04, CFG.laneY, 7.92),
  new THREE.Vector3(4.04, CFG.laneY, 7.92),
] as const;
type NavigationObstacle = { x: number; z: number; rx: number; rz: number };
const HUMAN_NAV_OBSTACLES: NavigationObstacle[] = [
  { x: 0, z: 6.34, rx: 1.1, rz: 2.02 },
  ...BOWLING_TABLE_CENTERS.map((center) => ({ x: center.x, z: center.z, rx: 1.46, rz: 1.1 })),
  { x: -2.72, z: 6.42, rx: 0.62, rz: 0.5 },
  { x: 2.72, z: 6.42, rx: 0.62, rz: 0.5 },
];
const HUMAN_CLEARANCE = 0.34;
const PLAYER_READY_POINT = new THREE.Vector3(laneCenterForPlayer(0), CFG.laneY, CFG.playerStartZ);
const PLAYER_SEATS = [
  { pos: new THREE.Vector3(-4.74, CFG.laneY, 6.52), yaw: Math.PI / 2, stand: PLAYER_READY_POINT.clone() },
  { pos: new THREE.Vector3(4.74, CFG.laneY, 9.34), yaw: -Math.PI / 2, stand: new THREE.Vector3(laneCenterForPlayer(1), CFG.laneY, CFG.playerStartZ) },
];
const BOWLING_LOUNGE_CHAIRS = BOWLING_TABLE_CENTERS.flatMap((center) => {
  const side = center.x < 0 ? -1 : 1;
  return [
    { pos: new THREE.Vector3(center.x - side * 0.66, CFG.laneY, center.z), yaw: side < 0 ? Math.PI / 2 : -Math.PI / 2 },
    { pos: new THREE.Vector3(center.x + side * 0.66, CFG.laneY, center.z), yaw: side < 0 ? -Math.PI / 2 : Math.PI / 2 },
  ];
}) as { pos: THREE.Vector3; yaw: number }[];

function keepHumanInBowlingWalkableArea(pos: THREE.Vector3, preferredSide = -1) {
  // Keep bowlers off ball returns, furniture, lane caps, and other props with a light-weight ellipse navmesh.
  pos.z = clamp(pos.z, CFG.foulZ + 0.2, 9.82);
  const maxLoungeX = 5.9;
  const minLoungeX = -5.9;
  pos.x = clamp(pos.x, minLoungeX, maxLoungeX);
  for (let pass = 0; pass < 2; pass++) {
    for (const obstacle of HUMAN_NAV_OBSTACLES) {
      const rx = obstacle.rx + HUMAN_CLEARANCE;
      const rz = obstacle.rz + HUMAN_CLEARANCE;
      const dx = pos.x - obstacle.x;
      const dz = pos.z - obstacle.z;
      const dist = (dx * dx) / (rx * rx) + (dz * dz) / (rz * rz);
      if (dist >= 1) continue;
      const angle = Math.atan2(dz / rz, dx / rx);
      pos.x = obstacle.x + Math.cos(angle || preferredSide * Math.PI) * rx;
      pos.z = obstacle.z + Math.sin(angle || -0.35) * rz;
    }
  }
  if (Math.abs(pos.x) < CFG.gutterHalfW + 0.58 && pos.z < CFG.foulZ + 1.2) {
    pos.z = CFG.foulZ + 1.2;
  }
  pos.y = CFG.laneY;
  return pos;
}

function returnSafeWaypointForRig(rig: HumanRig) {
  const side = rig.standPos.x < 0 ? -1 : 1;
  return new THREE.Vector3(side * 0.96, CFG.laneY, 5.86);
}

function returnPickupPointForRig(rig: HumanRig) {
  const side = rig.standPos.x < 0 ? -1 : 1;
  return new THREE.Vector3(side * 0.92, CFG.laneY, 7.34);
}

function keepPlayersSeparated(rigs: HumanRig[], minDistance = 0.58) {
  for (let i = 0; i < rigs.length; i++) {
    for (let j = i + 1; j < rigs.length; j++) {
      const a = rigs[i].pos;
      const b = rigs[j].pos;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      if (d <= 0.0001 || d >= minDistance) continue;
      const push = (minDistance - d) * 0.5;
      const nx = dx / d;
      const nz = dz / d;
      a.x -= nx * push; a.z -= nz * push;
      b.x += nx * push; b.z += nz * push;
      keepHumanInBowlingWalkableArea(a, -1);
      keepHumanInBowlingWalkableArea(b, 1);
      syncHuman(rigs[i]);
      syncHuman(rigs[j]);
    }
  }
}

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

function addRollToPlayer(player: ScorePlayer, knocked: number): RollDecision {
  const frameIndex = currentFrameIndex(player);
  const frame = player.frames[frameIndex];
  const rollIndex = frame.rolls.length;

  if (frameIndex < 9) {
    if (rollIndex === 0) frame.rolls.push(clamp(knocked, 0, 10));
    else if (rollIndex === 1) frame.rolls.push(clamp(knocked, 0, 10 - frame.rolls[0]));
  } else {
    if (rollIndex === 0) frame.rolls.push(clamp(knocked, 0, 10));
    else if (rollIndex === 1) {
      const max = frame.rolls[0] === 10 ? 10 : 10 - frame.rolls[0];
      frame.rolls.push(clamp(knocked, 0, max));
    } else if (rollIndex === 2) {
      let max = 10;
      if (frame.rolls[0] === 10 && frame.rolls[1] !== 10) max = 10 - frame.rolls[1];
      frame.rolls.push(clamp(knocked, 0, max));
    }
  }

  recomputePlayerTotals(player);
  const frameEnded = frameComplete(frame, frameIndex);
  return {
    frameIndex,
    rollIndex,
    frameEnded,
    resetPins: shouldResetPinsForNextRoll(frame, frameIndex, rollIndex, knocked, frameEnded),
    gameFinished: playerFinished(player),
  };
}

function shouldResetPinsForNextRoll(frame: BowlingFrame, frameIndex: number, rollIndex: number, knocked: number, frameEnded: boolean) {
  if (frameEnded) return true;
  if (frameIndex < 9) return knocked === 10;
  if (rollIndex === 0) return knocked === 10;
  if (rollIndex === 1) return frame.rolls[0] === 10 || frame.rolls[0] + frame.rolls[1] === 10;
  return false;
}

function describeRollResult(player: ScorePlayer, result: RollDecision, knocked: number) {
  const frame = player.frames[result.frameIndex];
  const isStrike = knocked === 10 && (result.rollIndex === 0 || result.frameIndex === 9);
  const isSpare = !isStrike && result.rollIndex > 0 && frame.rolls[result.rollIndex - 1] + knocked === 10;
  const pocket = knocked >= 8 ? "Pocket hit" : knocked >= 5 ? "Brooklyn leaves" : "Light hit";
  return {
    isStrike,
    isSpare,
    rule: isStrike ? "Strike: rack resets and next two rolls are bonuses" : isSpare ? "Spare: next roll scores as bonus" : result.frameEnded ? "Open frame: switch players" : "Second ball: convert the spare",
    lane: `${pocket} · ${Math.max(0, 10 - knocked)} pin${10 - knocked === 1 ? "" : "s"} left`,
  };
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
    roughness: 0.28,
    metalness: 0.012,
    clearcoat: 0.72,
    clearcoatRoughness: 0.12,
    reflectivity: 0.62,
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
  return new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.3, metalness: 0.012, clearcoat: 0.68, clearcoatRoughness: 0.13, reflectivity: 0.58 });
}

function normalizeHuman(model: THREE.Object3D, targetHeight: number) {
  model.rotation.set(0, 0, 0);
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

function makeFallbackHuman(_color: number) {
  // GLTF-only humans: keep an empty placeholder so animation code has a stable root,
  // but never render procedural capsule/body parts while remote characters load.
  const g = new THREE.Group();
  g.visible = false;
  return g;
}

function parseHexColor(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const normalized = value.replace("#", "");
  const parsed = Number.parseInt(normalized, 16);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getCharacterById(id: string | undefined) {
  return HUMAN_CHARACTER_OPTIONS.find((option) => option.id === id) || HUMAN_CHARACTER_OPTIONS[0];
}

function pickRandomAiCharacter(playerCharacterId: string) {
  const pool = HUMAN_CHARACTER_OPTIONS.filter((option) => option.id !== playerCharacterId);
  return pool[Math.floor(Math.random() * pool.length)] || HUMAN_CHARACTER_OPTIONS[0];
}


const dominoHumanTextureLoader = new THREE.TextureLoader();
const dominoHumanTextureCache = new Map<string, THREE.Texture>();

function loadDominoHumanTexture(url: string | undefined, isColor = false, repeat = 3) {
  if (!url) return null;
  const key = `${url}|${isColor ? "srgb" : "linear"}|${repeat}`;
  const cached = dominoHumanTextureCache.get(key);
  if (cached) return cached;
  const tex = dominoHumanTextureLoader.load(url);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  dominoHumanTextureCache.set(key, tex);
  return tex;
}

function isNearlyWhiteMaterial(mat: any) {
  if (!mat?.color) return false;
  return mat.color.r > 0.82 && mat.color.g > 0.82 && mat.color.b > 0.82 && !mat.map;
}

function isLowSaturationLightMaterial(mat: any) {
  if (!mat?.color || mat.map) return false;
  const max = Math.max(mat.color.r, mat.color.g, mat.color.b);
  const min = Math.min(mat.color.r, mat.color.g, mat.color.b);
  return max > 0.72 && max - min < 0.18;
}

function classifyDominoHumanSurface(obj: THREE.Object3D, mat: any) {
  const name = `${obj?.name || ""} ${mat?.name || ""}`.toLowerCase();
  if (/eye|iris|pupil|cornea|wolf3d_eyes/.test(name)) return "eye";
  if (/hair|brow|beard|mustache|moustache|lash|wolf3d_hair|wolf3d_beard|wolf3d_eyebrow/.test(name)) return "hair";
  if (/teeth|tooth|tongue|mouth|gum/.test(name)) return "mouth";
  if (/shoe|boot|sole|sneaker|footwear|wolf3d_outfit_footwear/.test(name)) return "shoe";
  if (/skin|head|face|neck|hand|finger|wolf3d_head|wolf3d_body|bodymesh/.test(name) && !/outfit|shirt|pants|trouser|shoe|sock|cloth|jacket|hood|dress|skirt|uniform|suit/.test(name)) return "skin";
  if (/shirt|top|torso|chest|jacket|hood|dress|skirt|sleeve|upper|outfit_top|wolf3d_outfit_top/.test(name)) return "upperCloth";
  if (/pants|trouser|jean|short|legging|bottom|outfit_bottom|wolf3d_outfit_bottom/.test(name)) return "lowerCloth";
  if (/tie|scarf|belt|strap|bag|hat|cap|glove|sock|accessory|accent/.test(name)) return "accentCloth";
  if (/cloth|clothing|uniform|outfit|suit/.test(name)) return "upperCloth";
  if (isNearlyWhiteMaterial(mat) && /torso|chest|spine|pelvis|hip|leg|arm|body|mesh/.test(name)) return "upperCloth";
  return "other";
}

function resolveDominoCloth(character: HumanCharacterOption, slot: "upper" | "lower" | "accent") {
  const combo = (BOWLING_DOMINO_CHARACTER_TEXTURES as any)[character?.clothCombo || "royalDenim"] || (BOWLING_DOMINO_CHARACTER_TEXTURES as any).royalDenim;
  const slotConfig = combo?.[slot] || combo?.upper || { material: "denim" };
  const material = (BOWLING_DOMINO_CLOTH_MATERIALS as any)[slotConfig.material] || (BOWLING_DOMINO_CLOTH_MATERIALS as any).denim;
  return { ...material, tint: slotConfig.tint ?? material.tint ?? 0xffffff, repeat: slotConfig.repeat ?? 3.5 };
}

function applyDominoClothMaterial(mat: any, cloth: any) {
  mat.map = loadDominoHumanTexture(cloth.color, true, cloth.repeat);
  mat.normalMap = loadDominoHumanTexture(cloth.normal, false, cloth.repeat);
  mat.roughnessMap = loadDominoHumanTexture(cloth.roughness, false, cloth.repeat);
  mat.color = new THREE.Color(cloth.tint ?? 0xffffff);
  mat.normalScale = new THREE.Vector2(0.28, 0.28);
  mat.roughness = 0.86;
  mat.metalness = 0.015;
}

function enhanceBowlingHumanLikeDomino(model: THREE.Object3D, character: HumanCharacterOption) {
  const combo = (BOWLING_DOMINO_CHARACTER_TEXTURES as any)[character?.clothCombo || "royalDenim"] || (BOWLING_DOMINO_CHARACTER_TEXTURES as any).royalDenim;
  const clothSlots: Record<string, any> = {
    upperCloth: resolveDominoCloth(character, "upper"),
    lowerCloth: resolveDominoCloth(character, "lower"),
    accentCloth: resolveDominoCloth(character, "accent"),
  };
  const skinColor = new THREE.Color(combo.skinTone ?? 0xd2a07c);
  const hairColor = new THREE.Color(combo.hairColor ?? 0x21150f);
  const eyeColor = new THREE.Color(combo.eyeColor ?? 0x3f5f75);
  model.traverse((obj: any) => {
    if (!obj?.isMesh) return;
    const sourceMaterials = Array.isArray(obj.material) ? obj.material : [obj.material];
    const enhanced = sourceMaterials.map((sourceMat: any) => {
      if (!sourceMat) return sourceMat;
      const mat = sourceMat.clone ? sourceMat.clone() : new THREE.MeshStandardMaterial();
      const surface = classifyDominoHumanSurface(obj, mat);
      if (clothSlots[surface]) applyDominoClothMaterial(mat, clothSlots[surface]);
      else if (surface === "hair") { mat.map = null; mat.color = hairColor.clone(); mat.roughness = 0.56; mat.metalness = 0.02; mat.envMapIntensity = 0.28; }
      else if (surface === "eye") { mat.map = null; mat.color = eyeColor.clone(); mat.roughness = 0.18; mat.metalness = 0; mat.envMapIntensity = 1.1; }
      else if (surface === "skin") { if (isLowSaturationLightMaterial(mat)) mat.color = skinColor.clone(); mat.roughness = Math.min(mat.roughness ?? 0.62, 0.62); mat.metalness = 0; }
      else if (surface === "shoe") { if (isLowSaturationLightMaterial(mat)) mat.color = new THREE.Color(0x111827); mat.roughness = 0.78; mat.metalness = 0.02; }
      else if (surface === "mouth") { if (isNearlyWhiteMaterial(mat)) mat.color = new THREE.Color(0xf8fafc); mat.roughness = 0.32; mat.metalness = 0; }
      else if (isNearlyWhiteMaterial(mat)) { mat.color = skinColor.clone(); mat.roughness = 0.58; mat.metalness = 0; }
      mat.needsUpdate = true;
      return mat;
    });
    obj.material = Array.isArray(obj.material) ? enhanced : enhanced[0];
  });
}

function addHuman(scene: THREE.Scene, start: THREE.Vector3, character: HumanCharacterOption, seatPos = start.clone(), seatYaw = 0): HumanRig {
  const root = new THREE.Group();
  const modelRoot = new THREE.Group();
  const fallback = makeFallbackHuman(parseHexColor(character?.accent, 0xff7a2f));
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.34, 32),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  modelRoot.position.copy(start);
  fallback.visible = false;
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
    targetYaw: 0,
    yawVelocity: 0,
    action: "idle",
    approachT: 0,
    throwT: 0,
    recoverT: 0,
    celebrateT: 0,
    celebrateNext: false,
    returnWalkT: 0,
    pickT: 0,
    walkCycle: 0,
    approachFrom: start.clone(),
    approachTo: start.clone(),
    seatPos: seatPos.clone(),
    seatYaw,
    standPos: start.clone(),
    seatT: 0,
  };

  loadHumanCharacter(rig, character);

  return rig;
}

function loadHumanCharacter(rig: HumanRig, character: HumanCharacterOption | undefined) {
  const selected = character || HUMAN_CHARACTER_OPTIONS[0];
  const urls = selected?.modelUrls?.length ? selected.modelUrls : [HUMAN_URL];
  const loader = new GLTFLoader().setCrossOrigin("anonymous");
  if (rig.model) {
    rig.modelRoot.remove(rig.model);
    rig.model = null;
  }
  rig.fallback.visible = false;
  let cancelled = false;
  const tryLoad = (index: number) => {
    if (cancelled) return;
    if (index >= urls.length) {
      rig.fallback.visible = false;
      return;
    }
    loader.load(
      urls[index],
      (gltf) => {
        if (cancelled) return;
        const model = gltf.scene;
        normalizeHuman(model, 1.82);
        model.scale.multiplyScalar(HUMAN_INITIAL_SCALE);
        enhanceBowlingHumanLikeDomino(model, selected);
        lockHumanToLaneGround(model);
        enableShadow(model);
        if (rig.model) rig.modelRoot.remove(rig.model);
        rig.model = model;
        rig.fallback.visible = false;
        rig.modelRoot.add(model);
      },
      undefined,
      () => tryLoad(index + 1)
    );
  };
  tryLoad(0);
  return () => { cancelled = true; };
}

function lockHumanToLaneGround(model: THREE.Object3D) {
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const groundOffset = CFG.laneY - bounds.min.y;
  model.position.y += groundOffset;
}

function syncHuman(rig: HumanRig) {
  rig.modelRoot.position.copy(rig.pos);
  rig.modelRoot.rotation.y = rig.yaw;
  rig.shadow.position.set(rig.pos.x, CFG.laneY + 0.01, rig.pos.z);
}

function smoothFacing(rig: HumanRig, nextPos: THREE.Vector3, dt: number) {
  const move = nextPos.clone().sub(rig.pos);
  if (move.lengthSq() > 0.0005) rig.targetYaw = Math.atan2(move.x, move.z);
  let delta = rig.targetYaw - rig.yaw;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  const yawStep = delta * (1 - Math.pow(0.0008, dt));
  rig.yaw += yawStep;
  rig.yawVelocity = yawStep / Math.max(0.0001, dt);
}


function findRightHand(modelRoot: THREE.Object3D | null) {
  if (!modelRoot) return null;
  let hand: THREE.Object3D | null = null;
  modelRoot.traverse((obj) => {
    const n = obj.name.toLowerCase();
    if (!hand && (n.includes('righthand') || n.includes('hand_r') || n.includes('right_hand'))) hand = obj;
  });
  return hand;
}


function applyStandingPose(rig: HumanRig) {
  rig.modelRoot.visible = true;
  rig.shadow.visible = true;
  if (rig.model) {
    rig.model.position.set(0.02, 0, 0.02);
    rig.model.rotation.set(0.03, 0.02, -0.025);
  }
  rig.shadow.scale.set(0.82, 0.64, 1);
}

function applySeatedPose(rig: HumanRig) {
  rig.modelRoot.visible = true;
  rig.shadow.visible = true;
  rig.pos.copy(rig.seatPos);
  rig.yaw = rig.seatYaw;
  rig.targetYaw = rig.seatYaw;
  rig.action = "seated";
  if (rig.model) {
    rig.model.position.set(0, -0.42, -0.08);
    rig.model.rotation.set(-0.18, 0, 0.02);
  }
  syncHuman(rig);
  rig.shadow.scale.set(0.92, 0.72, 1);
}

function standRigForTurn(rig: HumanRig) {
  rig.action = "standingUp";
  rig.seatT = 0.001;
  rig.approachT = 0;
  rig.throwT = 0;
  rig.recoverT = 0;
  rig.returnWalkT = 0;
  rig.walkCycle = 0;
  rig.approachFrom.copy(rig.seatPos);
  rig.approachTo.copy(rig.standPos);
}

function seatRigAfterTurn(rig: HumanRig) {
  rig.action = "toSeat";
  rig.seatT = 0.001;
  rig.returnWalkT = 0;
  rig.approachFrom.copy(rig.pos);
  rig.approachTo.copy(rig.seatPos);
}

function loadFirstAvailableGltf(urls: string[], onLoad: (gltf: any) => void, onError?: () => void) {
  const loader = new GLTFLoader().setCrossOrigin("anonymous");
  const tryLoad = (index: number) => {
    if (index >= urls.length) {
      onError?.();
      return;
    }
    loader.load(urls[index], onLoad, undefined, () => tryLoad(index + 1));
  };
  tryLoad(0);
}


function animateFallbackHuman(rig: HumanRig, mode: "walk" | "bowl" | "seat" | "celebrate" | "idle", t: number) {
  const leftArm = rig.fallback.getObjectByName("leftArm") as THREE.Object3D | undefined;
  const rightArm = rig.fallback.getObjectByName("rightArm") as THREE.Object3D | undefined;
  const leftLeg = rig.fallback.getObjectByName("leftLeg") as THREE.Object3D | undefined;
  const rightLeg = rig.fallback.getObjectByName("rightLeg") as THREE.Object3D | undefined;
  const torso = rig.fallback.getObjectByName("torso") as THREE.Object3D | undefined;
  const reset = () => {
    if (leftArm) leftArm.rotation.set(0, 0, 0.22);
    if (rightArm) rightArm.rotation.set(0, 0, -0.18);
    if (leftLeg) leftLeg.rotation.set(0, 0, 0);
    if (rightLeg) rightLeg.rotation.set(0, 0, 0);
    if (torso) torso.rotation.set(0, 0, 0);
  };
  reset();
  if (mode === "walk") {
    const s = Math.sin(t);
    if (leftArm) leftArm.rotation.x = -s * 0.52;
    if (rightArm) rightArm.rotation.x = s * 0.52;
    if (leftLeg) leftLeg.rotation.x = s * 0.38;
    if (rightLeg) rightLeg.rotation.x = -s * 0.38;
  } else if (mode === "bowl") {
    const k = clamp01(t);
    if (rightArm) rightArm.rotation.x = k < CFG.releaseT ? lerp(-0.35, -1.9, k / CFG.releaseT) : lerp(-1.9, 0.9, (k - CFG.releaseT) / (1 - CFG.releaseT));
    if (leftArm) leftArm.rotation.x = lerp(0.35, -0.45, k);
    if (leftLeg) leftLeg.rotation.x = lerp(0.1, -0.58, k);
    if (rightLeg) rightLeg.rotation.x = lerp(-0.1, 0.46, k);
    if (torso) torso.rotation.x = lerp(0, 0.22, Math.sin(k * Math.PI));
  } else if (mode === "seat") {
    if (leftLeg) leftLeg.rotation.x = -0.95;
    if (rightLeg) rightLeg.rotation.x = -0.95;
    if (torso) torso.rotation.x = -0.12;
  } else if (mode === "celebrate") {
    const wave = Math.sin(t * 8);
    if (leftArm) leftArm.rotation.x = -1.9 + wave * 0.18;
    if (rightArm) rightArm.rotation.x = -1.8 - wave * 0.18;
    if (torso) torso.rotation.z = wave * 0.06;
  }
}

function getHeldBallWorldPosition(rig: HumanRig) {
  const handNode = findRightHand(rig.model) as THREE.Object3D | null;
  const handAnchor = handNode ? handNode.getWorldPosition(new THREE.Vector3()) : null;
  let local = new THREE.Vector3(0.36, 0.76, 0.16);
  if (rig.action === "approach") {
    const s = Math.sin(rig.walkCycle);
    local = new THREE.Vector3(0.4, 0.76 + Math.abs(s) * 0.04, 0.16 + s * 0.08);
  } else if (rig.action === "throw") {
    const t = clamp01(rig.throwT);
    if (t < 0.3) {
      const k = easeInOut(t / 0.3);
      local = new THREE.Vector3(lerp(0.34, 0.48, k), lerp(0.88, 0.72, k), lerp(0.14, -0.78, k));
    } else if (t < CFG.releaseT) {
      const k = easeInOut((t - 0.3) / (CFG.releaseT - 0.3));
      local = new THREE.Vector3(lerp(0.48, 0.18, k), lerp(0.72, 0.34, k), lerp(-0.78, 1.36, k));
    } else {
      const k = easeOutCubic((t - CFG.releaseT) / (1 - CFG.releaseT));
      local = new THREE.Vector3(lerp(0.18, 0.08, k), lerp(0.34, 1.5, k), lerp(1.36, 0.36, k));
    }
  } else if (rig.action === "recover") {
    const k = clamp01(rig.recoverT);
    local = new THREE.Vector3(0.24, lerp(1.18, 0.96, k), lerp(0.44, 0.18, k));
  } else if (rig.action === "pickBall" || rig.action === "toRack") {
    const pickLift = rig.action === "pickBall" ? easeInOut(clamp01(rig.pickT)) : 0;
    local = new THREE.Vector3(0.3, lerp(0.56, 0.98, pickLift), lerp(0.24, 0.08, pickLift));
  }
  const fallbackWorld = local.applyAxisAngle(UP, rig.yaw).add(rig.pos);
  if (!handAnchor) return fallbackWorld;
  return handAnchor.add(new THREE.Vector3(0.02, -0.03, 0.015).applyAxisAngle(UP, rig.yaw));
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

function createActiveBall(variant: BallVariant, laneCenter = laneCenterForPlayer(0)) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(variant.radius, 80, 64), makeBallMaterial(variant.colors));
  enableShadow(mesh);
  const pos = new THREE.Vector3(laneCenter, CFG.laneY + 0.52, 6.34);
  mesh.position.copy(pos);
  mesh.visible = false;
  return { mesh, pos, vel: new THREE.Vector3(), held: false, rolling: false, laneCenter, inGutter: false, hook: 0, returnState: "idle", returnT: 0, variant } as BallState;
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

function createPins(scene: THREE.Scene, laneCenter = 0) {
  const pins: PinState[] = [];
  const s = CFG.pinSpotSpacing;
  const positions = [
    [0, 0],
    [-s * 0.57, -s], [s * 0.57, -s],
    [-s * 1.14, -s * 2], [0, -s * 2], [s * 1.14, -s * 2],
    [-s * 1.71, -s * 3], [-s * 0.57, -s * 3], [s * 0.57, -s * 3], [s * 1.71, -s * 3],
  ];
  for (const [x, dz] of positions) {
    const root = createPinMesh();
    const start = new THREE.Vector3(laneCenter + x, CFG.laneY + 0.006, CFG.pinDeckZ + dz);
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

function clearFallenPins(pins: PinState[]) {
  for (const pin of pins) {
    const fallen = !pin.standing || pin.tilt >= CFG.pinToppleThreshold || pin.knocked;
    if (!fallen) continue;
    pin.root.visible = false;
    pin.vel.set(0, 0, 0);
    pin.angularVel = 0;
  }
}

function isFallenPin(pin: PinState) {
  return !pin.root.visible || !pin.standing || pin.tilt >= CFG.pinToppleThreshold || pin.knocked;
}

function makePinResetState(): PinResetState {
  return { phase: "idle", t: 0, fallenPins: [], standingPins: [], removed: false };
}

function beginPinReset(state: PinResetState, pins: PinState[], decor: BowlingArenaDecor) {
  if (state.phase !== "idle") return;
  state.phase = "lowering";
  state.t = 0;
  state.removed = false;
  state.fallenPins = pins.filter(isFallenPin);
  state.standingPins = pins.filter((pin) => !isFallenPin(pin));
  decor.resetMachine.visible = true;
  const sourcePin = state.standingPins[0] || state.fallenPins[0];
  const resetCenter = sourcePin ? laneCenterForPlayer(sourcePin.start.x > 0 ? 1 : 0) : 0;
  decor.resetMachine.position.x = resetCenter;
  decor.resetMachine.position.y = CFG.laneY + 1.16;
  decor.resetMachine.position.z = CFG.pinDeckZ - 0.82;
  for (const pin of pins) {
    pin.vel.set(0, 0, 0);
    pin.angularVel = 0;
    if (!state.fallenPins.includes(pin)) {
      pin.standing = true;
      pin.knocked = false;
      pin.tilt = 0;
      pin.pos.copy(pin.start);
      pin.root.visible = true;
      pin.root.rotation.set(0, 0, 0);
    }
  }
}

function updatePinReset(state: PinResetState, decor: BowlingArenaDecor, dt: number) {
  if (state.phase === "idle") return null;
  state.t = clamp01(state.t + dt / 1.9);
  state.phase = state.t < 0.34 ? "lowering" : state.t < 0.76 ? "sweeping" : "lifting";
  const lower = state.t < 0.34 ? easeInOut(state.t / 0.34) : state.t > 0.76 ? 1 - easeInOut((state.t - 0.76) / 0.24) : 1;
  const sweep = clamp01((state.t - 0.34) / 0.34);
  const lift = state.t < 0.48 ? 0 : state.t < 0.76 ? Math.sin(((state.t - 0.48) / 0.28) * Math.PI) * 0.14 : 0;
  decor.resetMachine.position.y = CFG.laneY + lerp(1.16, 0.43, lower);
  decor.resetMachine.position.z = CFG.pinDeckZ - 0.92 + sweep * 1.12;

  for (const pin of state.standingPins) {
    pin.pos.copy(pin.start);
    pin.pos.y = pin.start.y + lift;
    pin.root.visible = true;
    pin.root.position.copy(pin.pos);
    pin.root.rotation.set(0, 0, 0);
  }

  for (const pin of state.fallenPins) {
    if (!pin.root.visible) continue;
    const carry = clamp01((state.t - 0.38) / 0.26);
    pin.root.position.z = pin.pos.z - carry * 1.55;
    pin.root.position.y = Math.max(CFG.laneY + 0.02, pin.pos.y - carry * 0.1);
  }

  if (!state.removed && state.t >= 0.64) {
    clearFallenPins(state.fallenPins);
    state.removed = true;
  }

  if (state.t >= 1) {
    const standing = state.standingPins.length;
    for (const pin of state.standingPins) {
      pin.pos.copy(pin.start);
      pin.root.position.copy(pin.pos);
      pin.root.rotation.set(0, 0, 0);
    }
    state.phase = "idle";
    state.t = 0;
    state.fallenPins = [];
    state.standingPins = [];
    state.removed = false;
    decor.resetMachine.visible = false;
    return standing;
  }
  return null;
}



type BowlingArenaDecor = {
  returnBalls: THREE.Mesh[];
  scoreboardPanels: THREE.Mesh[];
  pinfallPanels: THREE.Mesh[];
  crowdPulseLights: THREE.PointLight[];
  resetMachine: THREE.Group;
};

type PinResetState = {
  phase: PinResetPhase;
  t: number;
  fallenPins: PinState[];
  standingPins: PinState[];
  removed: boolean;
};

type BowlingCrowdMember = {
  rig: HumanRig;
  behavior: "talking" | "clapping" | "phone" | "drinking" | "spectating" | "celebrating";
  phase: number;
  baseYaw: number;
  seated: boolean;
};

function makeCanvasTextMaterial(text: string, options: { width?: number; height?: number; bg?: string; fg?: string; accent?: string } = {}) {
  const width = options.width || 512;
  const height = options.height || 160;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const bg = options.bg || "rgba(3, 7, 18, 0.92)";
  const fg = options.fg || "#f8fafc";
  const accent = options.accent || "#38bdf8";
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  const grad = ctx.createLinearGradient(0, 0, width, 0);
  grad.addColorStop(0, "rgba(56,189,248,0.8)");
  grad.addColorStop(0.5, "rgba(244,114,182,0.85)");
  grad.addColorStop(1, "rgba(250,204,21,0.75)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, 10);
  ctx.fillRect(0, height - 10, width, 10);
  ctx.fillStyle = accent;
  ctx.font = `900 ${Math.round(height * 0.22)}px system-ui, sans-serif`;
  ctx.fillText("TON PLAYGRAM", 28, Math.round(height * 0.36));
  ctx.fillStyle = fg;
  ctx.font = `900 ${Math.round(height * 0.36)}px system-ui, sans-serif`;
  ctx.fillText(text, 28, Math.round(height * 0.76));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false });
}

function setBoardCanvasText(panel: THREE.Mesh, text: string, options: { width?: number; height?: number; bg?: string; fg?: string; accent?: string } = {}) {
  const previous = panel.material as THREE.Material | THREE.Material[];
  panel.material = makeCanvasTextMaterial(text, options);
  if (Array.isArray(previous)) previous.forEach((mat) => mat.dispose());
  else previous?.dispose?.();
}

function updatePinfallBoards(decor: BowlingArenaDecor, laneIndex: number, knocked: number, afterStanding: number, label: string) {
  const text = knocked === 10 ? `${label} STRIKE` : `${label} ${knocked} DOWN`;
  decor.pinfallPanels.forEach((panel, index) => {
    const active = index === laneIndex;
    const message = active ? `${text} · ${afterStanding} LEFT` : `LANE ${index + 1} READY`;
    setBoardCanvasText(panel, message, {
      width: 1024,
      height: 256,
      bg: active ? 'rgba(1,6,14,0.98)' : 'rgba(2,6,12,0.9)',
      fg: active ? '#f8fafc' : '#cbd5e1',
      accent: active ? '#facc15' : index === 0 ? '#38bdf8' : '#f97316',
    });
    panel.userData.flashUntil = performance.now() + 1800;
    panel.userData.baseScale = active ? 1.08 : 1;
  });
}

function makeDrink(mat: THREE.Material) {
  const g = new THREE.Group();
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.16, 16), mat);
  cup.position.y = 0.08;
  g.add(cup);
  const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45 }));
  straw.position.set(0.025, 0.21, 0.01);
  straw.rotation.z = 0.25;
  g.add(straw);
  return g;
}

function makePickupPromptSprite() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const grad = ctx.createLinearGradient(0, 0, 512, 192);
  grad.addColorStop(0, "rgba(6,11,21,0.92)");
  grad.addColorStop(1, "rgba(14,165,233,0.76)");
  ctx.fillStyle = grad;
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 6;
  const r = 44;
  ctx.beginPath();
  ctx.moveTo(r, 10);
  ctx.lineTo(512 - r, 10);
  ctx.quadraticCurveTo(502, 10, 502, r);
  ctx.lineTo(502, 192 - r);
  ctx.quadraticCurveTo(502, 182, 512 - r, 182);
  ctx.lineTo(r, 182);
  ctx.quadraticCurveTo(10, 182, 10, 192 - r);
  ctx.lineTo(10, r);
  ctx.quadraticCurveTo(10, 10, r, 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 54px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("PICK UP", 256, 78);
  ctx.font = "800 26px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillStyle = "#dff7ff";
  ctx.fillText("tap a ball weight", 256, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.95, depthTest: false }));
  sprite.scale.set(1.26, 0.47, 1);
  sprite.position.set(0, CFG.laneY + 1.52, 7.42);
  sprite.visible = false;
  sprite.renderOrder = 80;
  return sprite;
}

function makeBowlingBallRack(colors: [string, string, string][], matFactory: (colors: [string, string, string]) => THREE.MeshPhysicalMaterial) {
  const rack = new THREE.Group();
  const railMat = new THREE.MeshPhysicalMaterial({ color: 0x07090d, roughness: 0.88, metalness: 0.18, clearcoat: 0.16, clearcoatRoughness: 0.62 });
  const rubberMat = new THREE.MeshStandardMaterial({ color: 0x020305, roughness: 0.96, metalness: 0.02 });
  const railGeom = new THREE.CylinderGeometry(0.045, 0.045, 1.86, 24);
  for (const [y, z] of [[0.34, -0.34], [0.58, 0.08]]) {
    const rail = new THREE.Mesh(railGeom, railMat);
    rail.rotation.z = Math.PI / 2;
    rail.position.set(0, y as number, z as number);
    rack.add(rail);
  }
  for (const [x, z] of [[-0.98, -0.16], [0.98, -0.16]]) {
    const side = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.64, 8, 18), railMat);
    side.position.set(x as number, 0.36, z as number);
    rack.add(side);
  }
  for (const [x, z] of [[-0.84, -0.48], [0.84, -0.48], [-0.84, 0.2], [0.84, 0.2]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.56, 18), railMat);
    leg.position.set(x as number, 0.28, z as number);
    rack.add(leg);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.02, 24), rubberMat);
    foot.position.set(x as number, 0.012, z as number);
    rack.add(foot);
  }
  const displayed = colors.slice(0, 5);
  const ballSlots = [
    [-0.62, 0.31, -0.34], [-0.18, 0.31, -0.34], [0.26, 0.31, -0.34], [0.7, 0.31, -0.34],
    [-0.4, 0.55, 0.08], [0.16, 0.55, 0.08],
  ];
  displayed.forEach((colorset, i) => {
    const radius = CFG.ballR * 0.98;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 32), matFactory(colorset));
    const [x, y, z] = ballSlots[i];
    ball.position.set(x, y + radius * 0.28, z);
    ball.rotation.set(i * 0.37, i * 0.61, 0);
    rack.add(ball);
    const holeMat = new THREE.MeshBasicMaterial({ color: 0x020617, transparent: true, opacity: 0.82 });
    for (const [hx, hy] of [[-0.035, 0.12], [0.045, 0.11], [0.006, 0.045]]) {
      const hole = new THREE.Mesh(new THREE.CircleGeometry(0.017, 14), holeMat);
      hole.position.set(ball.position.x + hx, ball.position.y + hy, ball.position.z + radius * 0.84);
      hole.rotation.y = Math.PI;
      rack.add(hole);
    }
  });
  enableShadow(rack);
  return rack;
}

function createEnvironment(scene: THREE.Scene, loader: THREE.TextureLoader, tableFinishId: string, chromeColorId: string): BowlingArenaDecor {
  const group = new THREE.Group();
  const decor: BowlingArenaDecor = { returnBalls: [], scoreboardPanels: [], pinfallPanels: [], crowdPulseLights: [], resetMachine: new THREE.Group() };
  scene.add(group);
  let laneMat: THREE.Material;
  let woodMat: THREE.Material;
  try {
    laneMat = loadOakMaterial(loader, 1.05, 10.8);
    woodMat = loadOakMaterial(loader, 0.72, 3.2);
  } catch {
    laneMat = makeFallbackWoodMaterial();
    woodMat = makeFallbackWoodMaterial();
  }

  const gutterMat = new THREE.MeshStandardMaterial({ color: 0x262f3a, roughness: 0.38, metalness: 0.2 });
  const metalMat = new THREE.MeshPhysicalMaterial({ color: 0xcfd7e2, roughness: 0.11, metalness: 1, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.6 });
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x101216, roughness: 0.84 });
  if (chromeColorId === 'gold') metalMat.color.set('#d4af37');
  if (tableFinishId.includes('dark') || tableFinishId.includes('carbon')) (woodMat as THREE.MeshStandardMaterial).color.set('#3a2b23');
  if (tableFinishId.includes('rosewood')) (woodMat as THREE.MeshStandardMaterial).color.set('#6f3a2f');
  if ((laneMat as THREE.MeshStandardMaterial).color) (laneMat as THREE.MeshStandardMaterial).color.multiplyScalar(1.18);

  // Clean, open HDRI-driven venue shell: keep only floor, lane, lounge furniture, and gameplay mechanisms.
  const carpetMat = new THREE.MeshStandardMaterial({ color: 0x23182f, roughness: 0.9, metalness: 0.01 });
  const sideFloorMat = new THREE.MeshStandardMaterial({ color: 0x171417, roughness: 0.78, metalness: 0.02 });
  const rubberMat = new THREE.MeshStandardMaterial({ color: 0x05070a, roughness: 0.86, metalness: 0.01 });
  const ledCyan = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.38, toneMapped: false });
  const ledAmber = new THREE.MeshBasicMaterial({ color: 0xffb86b, transparent: true, opacity: 0.42, toneMapped: false });

  const sideFloor = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 27.8), sideFloorMat);
  sideFloor.rotation.x = -Math.PI / 2;
  sideFloor.position.set(0, CFG.laneY - 0.024, -3.72);
  group.add(sideFloor);
  const loungeCarpet = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 4.95), carpetMat);
  loungeCarpet.rotation.x = -Math.PI / 2;
  loungeCarpet.position.set(BOWLING_LOUNGE_CENTER.x, CFG.laneY - 0.014, BOWLING_LOUNGE_CENTER.z);
  group.add(loungeCarpet);


  const pairHalfW = CFG.laneCenterOffset + CFG.gutterHalfW + 0.32;
  const approach = new THREE.Mesh(new THREE.PlaneGeometry(pairHalfW * 2, 5.05, 44, 28), woodMat);
  approach.rotation.x = -Math.PI / 2;
  approach.position.set(0, CFG.laneY - 0.005, 7.18);
  group.add(approach);

  const centerDividerMat = new THREE.MeshStandardMaterial({ color: 0x0b0f15, roughness: 0.58, metalness: 0.18 });
  const centerDivider = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.09, 23.75), centerDividerMat);
  centerDivider.position.set(0, CFG.laneY + 0.035, -5.98);
  group.add(centerDivider);
  const centerGutter = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.12, 23.55), gutterMat);
  centerGutter.position.set(0, CFG.laneY - 0.006, -5.98);
  group.add(centerGutter);

  const boardLineMat = new THREE.MeshBasicMaterial({ color: 0x4b2e18, transparent: true, opacity: 0.18, depthWrite: false });
  const boardNumberMat = new THREE.MeshBasicMaterial({ color: 0x1b365d, transparent: true, opacity: 0.38, depthWrite: false });
  const reflectionMat = new THREE.MeshBasicMaterial({ color: 0xf8fbff, transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending });
  const wearMat = new THREE.MeshBasicMaterial({ color: 0x2b1608, transparent: true, opacity: 0.075, depthWrite: false });
  const arrowMat = new THREE.MeshStandardMaterial({ color: 0x2d4f80, roughness: 0.44 });
  const spotMat = new THREE.MeshBasicMaterial({ color: 0x7f1d1d, transparent: true, opacity: 0.45, depthWrite: false });
  const laneLabelMat = (label: string) => makeCanvasTextMaterial(label, { width: 512, height: 128, accent: '#38bdf8', bg: 'rgba(2,6,12,0.72)' });

  for (const [laneIndex, laneCenter] of LANE_CENTERS.entries()) {
    const lane = new THREE.Mesh(new THREE.PlaneGeometry(CFG.laneHalfW * 2, 23.55, 72, 360), laneMat);
    lane.rotation.x = -Math.PI / 2;
    lane.position.set(laneCenter, CFG.laneY, -5.98);
    lane.receiveShadow = true;
    group.add(lane);

    for (let b = 1; b < LANE_BOARD_COUNT; b++) {
      const x = laneCenter - CFG.laneHalfW + b * BOARD_WIDTH;
      const board = new THREE.Mesh(new THREE.PlaneGeometry(0.005, 23.2), boardLineMat);
      board.rotation.x = -Math.PI / 2;
      board.position.set(x, CFG.laneY + 0.004, -5.98);
      group.add(board);
    }
    for (const board of [5, 10, 15, 20, 25, 30, 35]) {
      const x = laneCenter - CFG.laneHalfW + (board - 0.5) * BOARD_WIDTH;
      const dot = new THREE.Mesh(new THREE.CircleGeometry(board === 20 ? 0.035 : 0.026, 18), boardNumberMat);
      dot.rotation.x = -Math.PI / 2;
      dot.position.set(x, CFG.laneY + 0.014, CFG.foulZ - 0.72);
      group.add(dot);
    }
    const oil = new THREE.Mesh(
      new THREE.PlaneGeometry(CFG.laneHalfW * 2 - 0.08, 18.1),
      new THREE.MeshPhysicalMaterial({ color: 0xcfefff, transparent: true, opacity: 0.045, roughness: 0.2, metalness: 0, clearcoat: 0.32, clearcoatRoughness: 0.24, reflectivity: 0.36 })
    );
    oil.rotation.x = -Math.PI / 2;
    oil.position.set(laneCenter, CFG.laneY + 0.002, -4.76);
    group.add(oil);
    for (const [x, z, w, d] of [[-0.52, -2.6, 0.14, 10.8], [0.42, -5.8, 0.12, 13.6], [0.02, -10.6, 0.18, 4.8]]) {
      const streak = new THREE.Mesh(new THREE.PlaneGeometry(w as number, d as number), reflectionMat.clone());
      streak.rotation.x = -Math.PI / 2;
      streak.position.set(laneCenter + (x as number), CFG.laneY + 0.007, z as number);
      group.add(streak);
    }
    for (let i = 0; i < 22; i++) {
      const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.012 + (i % 4) * 0.006, 1.1 + (i % 5) * 0.28), wearMat);
      mark.rotation.x = -Math.PI / 2;
      mark.position.set(laneCenter + lerp(-CFG.laneHalfW * 0.82, CFG.laneHalfW * 0.82, (i % 11) / 10), CFG.laneY + 0.006, lerp(3.2, -11.6, i / 21));
      group.add(mark);
    }
    const deck = new THREE.Mesh(new THREE.BoxGeometry(CFG.laneHalfW * 2 + 0.56, 0.13, 3.18), woodMat);
    deck.position.set(laneCenter, CFG.laneY + 0.02, CFG.pinDeckZ - 0.75);
    group.add(deck);
    for (const side of [-1, 1]) {
      const gutter = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 23.55), gutterMat);
      gutter.position.set(laneCenter + side * (CFG.laneHalfW + 0.25), CFG.laneY, -5.98);
      group.add(gutter);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 23.75), woodMat);
      cap.position.set(laneCenter + side * (CFG.laneHalfW + 0.5), CFG.laneY + 0.07, -5.98);
      group.add(cap);
    }
    const foulLine = new THREE.Mesh(new THREE.BoxGeometry(CFG.laneHalfW * 2 + 0.08, 0.018, 0.055), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42 }));
    foulLine.position.set(laneCenter, CFG.laneY + 0.012, CFG.foulZ);
    group.add(foulLine);
    for (let i = -2; i <= 2; i++) {
      const tri = new THREE.Shape();
      tri.moveTo(0, 0.22);
      tri.lineTo(-0.11, -0.16);
      tri.lineTo(0.11, -0.16);
      tri.lineTo(0, 0.22);
      const mesh = new THREE.Mesh(new THREE.ShapeGeometry(tri), arrowMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(laneCenter + i * 0.34, CFG.laneY + 0.012, CFG.arrowsZ);
      group.add(mesh);
    }
    const pinS = CFG.pinSpotSpacing;
    for (const [x, dz] of [[0,0],[-pinS * 0.57,-pinS],[pinS * 0.57,-pinS],[-pinS * 1.14,-pinS * 2],[0,-pinS * 2],[pinS * 1.14,-pinS * 2],[-pinS * 1.71,-pinS * 3],[-pinS * 0.57,-pinS * 3],[pinS * 0.57,-pinS * 3],[pinS * 1.71,-pinS * 3]]) {
      const spot = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.105, 24), spotMat);
      spot.rotation.x = -Math.PI / 2;
      spot.position.set(laneCenter + (x as number), CFG.laneY + 0.018, CFG.pinDeckZ + (dz as number));
      group.add(spot);
    }
    const laneNumber = new THREE.Mesh(new THREE.PlaneGeometry(1.08, 0.26), laneLabelMat(`LANE ${laneIndex + 1}`));
    laneNumber.rotation.x = -Math.PI / 2;
    laneNumber.position.set(laneCenter, CFG.laneY + 0.02, CFG.foulZ + 0.62);
    group.add(laneNumber);
  }

  // Grounded black pinsetter wall restored behind the pins, with animated lane screens above each rack.
  const backBoardMat = new THREE.MeshStandardMaterial({ color: 0x03050a, roughness: 0.78, metalness: 0.18 });
  const backBoard = new THREE.Mesh(new THREE.BoxGeometry(pairHalfW * 2 + 0.86, 1.34, 0.14), backBoardMat);
  backBoard.position.set(0, CFG.laneY + 0.74, CFG.backStopZ + 0.88);
  group.add(backBoard);
  const lowerBoard = new THREE.Mesh(new THREE.BoxGeometry(pairHalfW * 2 + 0.7, 0.58, 0.12), new THREE.MeshStandardMaterial({ color: 0x05070d, roughness: 0.84, metalness: 0.12 }));
  lowerBoard.position.set(0, CFG.laneY + 0.34, CFG.backStopZ + 1.12);
  group.add(lowerBoard);
  for (const [laneIndex, laneCenter] of LANE_CENTERS.entries()) {
    const pinFocus = new THREE.Mesh(new THREE.BoxGeometry(CFG.laneHalfW * 2 + 0.38, 0.1, 0.08), new THREE.MeshBasicMaterial({ color: 0x92e7ff, transparent: true, opacity: 0.46, toneMapped: false }));
    pinFocus.position.set(laneCenter, CFG.laneY + 0.94, CFG.backStopZ + 0.82);
    group.add(pinFocus);
    const pinfallScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(2.52, 0.62),
      makeCanvasTextMaterial(`LANE ${laneIndex + 1} READY`, { width: 1024, height: 256, accent: laneIndex === 0 ? '#38bdf8' : '#f97316' })
    );
    pinfallScreen.position.set(laneCenter, CFG.laneY + 1.3, CFG.backStopZ + 1.2);
    pinfallScreen.userData.baseScale = 1;
    group.add(pinfallScreen);
    decor.pinfallPanels.push(pinfallScreen);
    for (const x of [-1, 1]) {
      const kickback = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.86, 4.2), woodMat);
      kickback.position.set(laneCenter + x * (CFG.laneHalfW + 0.52), CFG.laneY + 0.42, CFG.pinDeckZ - 1.02);
      group.add(kickback);
      const shadowPocket = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.52, 3.55), rubberMat);
      shadowPocket.position.set(laneCenter + x * (CFG.laneHalfW + 0.42), CFG.laneY + 0.36, CFG.pinDeckZ - 1.04);
      group.add(shadowPocket);
    }
  }
  decor.resetMachine.position.set(laneCenterForPlayer(0), CFG.laneY + 1.16, CFG.pinDeckZ - 0.92);
  decor.resetMachine.visible = false;
  const resetHeadMat = new THREE.MeshStandardMaterial({ color: 0x121a26, roughness: 0.58, metalness: 0.32 });
  const resetHead = new THREE.Mesh(new THREE.BoxGeometry(CFG.laneHalfW * 2 + 0.5, 0.16, 0.58), resetHeadMat);
  resetHead.position.set(0, 0, 0);
  decor.resetMachine.add(resetHead);
  const sweepBlade = new THREE.Mesh(new THREE.BoxGeometry(CFG.laneHalfW * 2 + 0.34, 0.12, 0.18), metalMat);
  sweepBlade.position.set(0, -0.3, 0.18);
  decor.resetMachine.add(sweepBlade);
  for (const x of [-0.94, -0.32, 0.32, 0.94]) {
    const pinCup = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.18, 18), resetHeadMat);
    pinCup.position.set(x, -0.22, -0.18);
    pinCup.rotation.x = Math.PI / 2;
    decor.resetMachine.add(pinCup);
  }
  const resetRail = new THREE.Mesh(new THREE.BoxGeometry(CFG.laneHalfW * 2 + 0.48, 0.045, 0.05), ledCyan);
  resetRail.position.set(0, -0.1, 0.32);
  decor.resetMachine.add(resetRail);
  group.add(decor.resetMachine);
  const machineryHousing = new THREE.Group();
  const housingMat = new THREE.MeshStandardMaterial({ color: 0x101827, roughness: 0.72, metalness: 0.18 });
  const hood = new THREE.Mesh(new THREE.BoxGeometry(pairHalfW * 2 + 0.9, 1.78, 1.72), housingMat);
  hood.position.set(0, 1.42, CFG.backStopZ + 0.05);
  machineryHousing.add(hood);
  const fascia = new THREE.Mesh(new THREE.BoxGeometry(pairHalfW * 2 + 0.72, 0.34, 0.06), new THREE.MeshStandardMaterial({ color: 0x070b12, roughness: 0.7, metalness: 0.2 }));
  fascia.position.set(0, 2.05, CFG.backStopZ + 0.82);
  machineryHousing.add(fascia);
  for (const [i, laneCenter] of LANE_CENTERS.entries()) {
    const slimScore = new THREE.Mesh(new THREE.PlaneGeometry(2.25, 0.46), makeCanvasTextMaterial(`LANE ${i + 1}`, { width: 768, height: 96, accent: i === 0 ? '#38bdf8' : '#f97316' }));
    slimScore.position.set(laneCenter, 2.07, CFG.backStopZ + 0.86);
    machineryHousing.add(slimScore);
    decor.scoreboardPanels.push(slimScore);
  }
  for (const x of [-3.2, -1.05, 1.05, 3.2]) {
    const servicePanel = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.52, 0.04), new THREE.MeshStandardMaterial({ color: 0x283242, roughness: 0.66, metalness: 0.24 }));
    servicePanel.position.set(x, 1.32, CFG.backStopZ + 0.84);
    machineryHousing.add(servicePanel);
  }
  group.add(machineryHousing);

  const snackMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.58 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x7dd3fc, roughness: 0.08, metalness: 0, transmission: 0.2, transparent: true, opacity: 0.72, clearcoat: 1 });
  const tabletMat = new THREE.MeshBasicMaterial({ color: 0x0ea5e9, transparent: true, opacity: 0.86, toneMapped: false });
  BOWLING_TABLE_CENTERS.forEach((center, tableIndex) => {
    const lounge = new THREE.Group();
    lounge.position.copy(center);
    try {
      createMurlanStyleTable({
        THREE,
        arena: lounge,
        tableRadius: 0.98,
        tableHeight: 0.74,
        pedestalHeightScale: 0.82,
        includeBase: true,
        rotationY: tableIndex % 2 ? Math.PI / 8 : -Math.PI / 8,
      });
    } catch {
      // Emergency placeholder only: the real scene uses the shared Murlan Royale table builder above.
      const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(0.96, 0.96, 0.08, 8), woodMat);
      tableTop.position.set(0, 0.74, 0);
      tableTop.rotation.y = Math.PI / 8;
      lounge.add(tableTop);
      const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.7, 16), blackMat);
      pedestal.position.y = 0.36;
      lounge.add(pedestal);
    }

    for (const [x, z, rot] of [[-0.26, -0.18, -0.18], [0.32, 0.2, 0.28]]) {
      const drink = makeDrink(glassMat);
      drink.position.set(x as number, 0.8, z as number);
      drink.rotation.y = rot as number;
      lounge.add(drink);
    }
    for (const [x, z] of [[-0.12, 0.32], [0.16, 0.34], [0.24, -0.28]]) {
      const snack = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.035, 0.09), snackMat);
      snack.position.set(x as number, 0.815, z as number);
      snack.rotation.y = (x as number) * 2.4;
      lounge.add(snack);
    }
    const tablet = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.025, 0.34), tabletMat);
    tablet.position.set(0.08, 0.82, -0.02);
    tablet.rotation.y = tableIndex % 2 ? 0.36 : -0.36;
    lounge.add(tablet);
    group.add(lounge);

    const loungeBoundary = new THREE.Mesh(
      new THREE.RingGeometry(1.36, 1.44, 48),
      new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.16, depthWrite: false })
    );
    loungeBoundary.rotation.x = -Math.PI / 2;
    loungeBoundary.position.set(center.x, CFG.laneY + 0.006, center.z);
    group.add(loungeBoundary);
  });

  // The old sofa/procedural lounge has been removed so the seating reads as Murlan tables with paired chairs.


  for (const x of [-2.72]) {
    const consoleGroup = new THREE.Group();
    const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.72, 0.34), new THREE.MeshStandardMaterial({ color: 0x0b1220, roughness: 0.68, metalness: 0.18 }));
    pedestal.position.y = 0.36;
    consoleGroup.add(pedestal);
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.06, 0.38), new THREE.MeshBasicMaterial({ color: 0x075985, transparent: true, opacity: 0.92, toneMapped: false }));
    screen.position.set(0, 0.82, -0.08);
    screen.rotation.x = -0.42;
    consoleGroup.add(screen);
    const cupTray = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.035, 24), blackMat);
    cupTray.position.set(0.34 * Math.sign(x), 0.74, 0.16);
    consoleGroup.add(cupTray);
    consoleGroup.position.set(x, CFG.laneY, 6.42);
    consoleGroup.rotation.y = Math.PI / 2;
    group.add(consoleGroup);
  }
  for (const [x, z] of [[-4.34, 5.82], [-3.28, 9.72]]) {
    const drinkStation = new THREE.Group();
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.72, 20), new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.62, metalness: 0.28 }));
    barrel.position.y = 0.36;
    drinkStation.add(barrel);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.012, 8, 24), ledAmber);
    halo.position.y = 0.75;
    halo.rotation.x = Math.PI / 2;
    drinkStation.add(halo);
    drinkStation.position.set(x as number, CFG.laneY, z as number);
    group.add(drinkStation);
  }

  const chairFallbackMat = new THREE.MeshPhysicalMaterial({ color: 0x5f3d26, roughness: 0.42, metalness: 0.05, clearcoat: 0.35 });
  for (const seat of BOWLING_LOUNGE_CHAIRS) {
    const chair = new THREE.Group();
    chair.position.copy(seat.pos);
    chair.rotation.y = seat.yaw + Math.PI;
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.13, 0.82), chairFallbackMat);
    pad.position.y = 0.43;
    chair.add(pad);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.92, 0.13), chairFallbackMat);
    back.position.set(0, 0.88, 0.33);
    chair.add(back);
    for (const sx of [-0.27, 0.27]) for (const sz of [-0.24, 0.24]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.44, 12), chairFallbackMat);
      leg.position.set(sx, 0.21, sz);
      chair.add(leg);
    }
    group.add(chair);
    loadFirstAvailableGltf(BOWLING_MURLAN_CHAIR_URLS, (gltf) => {
      if (!group.parent) return;
      const model = gltf.scene.clone(true);
      enableShadow(model);
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model);
      const span = Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z) || 1;
      model.scale.setScalar(1.18 / span);
      model.updateMatrixWorld(true);
      const box2 = new THREE.Box3().setFromObject(model);
      model.position.set(seat.pos.x - (box2.min.x + box2.max.x) / 2, CFG.laneY - box2.min.y, seat.pos.z - (box2.min.z + box2.max.z) / 2);
      model.rotation.y = seat.yaw + Math.PI;
      group.add(model);
      chair.visible = false;
    });
  }
  const returnShellMat = new THREE.MeshPhysicalMaterial({ color: 0x050609, roughness: 0.91, metalness: 0.05, clearcoat: 0.18, clearcoatRoughness: 0.58 });
  const returnTrimMat = new THREE.MeshPhysicalMaterial({ color: 0x111827, roughness: 0.66, metalness: 0.48, clearcoat: 0.18, envMapIntensity: 0.68 });
  const returnRubberMat = new THREE.MeshStandardMaterial({ color: 0x020304, roughness: 0.94, metalness: 0.01 });
  const returnBase = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.18, 2.7), returnShellMat);
  returnBase.position.set(0, CFG.laneY + 0.11, 6.34);
  group.add(returnBase);
  const returnCover = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 2.68, 48, 1, false, 0, Math.PI), returnShellMat);
  // The ball-return hood should run down-lane with the field instead of across the approach.
  // CylinderGeometry's height axis starts on local Y; map it to world Z and keep the
  // half-cylinder arch rising on world Y so the cover matches the lane direction.
  returnCover.rotation.set(Math.PI / 2, 0, 0);
  returnCover.position.set(0, CFG.laneY + 0.34, 6.34);
  returnCover.scale.y = 1.02;
  group.add(returnCover);
  const returnMouth = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.055, 32, 1, false, Math.PI * 0.08, Math.PI * 0.84), new THREE.MeshBasicMaterial({ color: 0x010204, transparent: true, opacity: 0.9 }));
  returnMouth.rotation.x = Math.PI / 2;
  returnMouth.position.set(0, CFG.laneY + 0.37, 7.32);
  group.add(returnMouth);
  for (const x of [-0.52, 0.52]) {
    const sideRubber = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.13, 2.24), returnRubberMat);
    sideRubber.position.set(x, CFG.laneY + 0.31, 6.34);
    group.add(sideRubber);
    const trim = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 2.18, 16), returnTrimMat);
    trim.rotation.x = Math.PI / 2;
    trim.position.set(x, CFG.laneY + 0.43, 6.34);
    group.add(trim);
  }
  const channel = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.09, 12.9), returnShellMat);
  channel.position.set(0, CFG.laneY + 0.065, 0.12);
  group.add(channel);
  for (const x of [-0.32, 0.32]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.075, 12.96), returnTrimMat);
    rail.position.set(x, CFG.laneY + 0.18, 0.12);
    group.add(rail);
  }
  for (const z of [4.92, 6.86]) {
    const returnLed = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.026, 0.04), ledCyan);
    returnLed.position.set(0, CFG.laneY + 0.43, z);
    group.add(returnLed);
  }
  const ballLift = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.45, 1.04, 44), returnTrimMat);
  ballLift.position.set(0, CFG.laneY + 0.22, 7.12);
  // Align the lift drum with the return lane (world Z). A Z rotation turns the
  // cylinder sideways across the approach, which made the rack/return assembly
  // look misplaced from the player camera.
  ballLift.rotation.x = Math.PI / 2;
  group.add(ballLift);
  for (const [x, z] of [[-0.44, 5.24], [0.44, 5.24], [-0.44, 7.02], [0.44, 7.02]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.34, 16), returnTrimMat);
    leg.position.set(x as number, CFG.laneY + 0.13, z as number);
    group.add(leg);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.018, 24), returnRubberMat);
    foot.position.set(x as number, CFG.laneY + 0.012, z as number);
    group.add(foot);
  }
  const animatedReturnColors: [string, string, string][] = [
    ["#a7f3d0", "#059669", "#032d22"],
    ["#93c5fd", "#2563eb", "#0b1b4a"],
    ["#ffe59b", "#f57e09", "#5a2c00"],
  ];
  animatedReturnColors.forEach((colors, i) => {
    const rb = new THREE.Mesh(new THREE.SphereGeometry(CFG.ballR * 0.98, 44, 32), makeBallMaterial(colors));
    rb.position.set(-0.28 + i * 0.28, CFG.laneY + 0.31, 5.14 + i * 0.5);
    rb.userData.returnPhase = i * 0.34;
    decor.returnBalls.push(rb);
    group.add(rb);
  });
  const commercialRack = makeBowlingBallRack([
    ["#93c5fd", "#2563eb", "#0b1b4a"],
    ["#fda4af", "#e11d48", "#4a0416"],
    ["#fde68a", "#f59e0b", "#4a2900"],
    ["#a7f3d0", "#059669", "#032d22"],
    ["#ddd6fe", "#7c3aed", "#2e1065"],
  ], makeBallMaterial);
  commercialRack.position.set(0, CFG.laneY, 7.64);
  commercialRack.rotation.y = Math.PI / 2;
  group.add(commercialRack);

  for (const [x, z, color] of [[-4.35, 7.6, 0x38bdf8], [0, CFG.pinDeckZ - 0.4, 0xffb86b]]) {
    const pulse = new THREE.PointLight(color as number, 0.42, 5.4, 2.1);
    pulse.position.set(x as number, 1.35, z as number);
    group.add(pulse);
    decor.crowdPulseLights.push(pulse);
  }

  // 3D overhead monitor already removed so it no longer blocks or distracts the camera.
  enableShadow(group);
  return decor;
}


function createDominoBowlingCrowd(scene: THREE.Scene, playerCharacterId: string): BowlingCrowdMember[] {
  const members: BowlingCrowdMember[] = [];
  const behaviors: BowlingCrowdMember["behavior"][] = ["talking", "clapping", "phone", "drinking", "spectating", "celebrating"];
  const spots = BOWLING_LOUNGE_CHAIRS.map((chair) => ({
    pos: [chair.pos.x, 0, chair.pos.z],
    yaw: chair.yaw,
    seated: true,
  })).concat([
    { pos: [-3.12, 0, 6.08], yaw: Math.PI * 0.78, seated: false },
    { pos: [3.12, 0, 6.08], yaw: -Math.PI * 0.78, seated: false },
  ]);
  const roster = HUMAN_CHARACTER_OPTIONS.filter((option) => option.id !== playerCharacterId);
  spots.forEach((spot, i) => {
    const option = roster[i % Math.max(1, roster.length)] || HUMAN_CHARACTER_OPTIONS[0];
    const pos = new THREE.Vector3(spot.pos[0], CFG.laneY, spot.pos[2]);
    const rig = addHuman(scene, pos.clone(), option, pos.clone(), spot.yaw);
    rig.yaw = spot.yaw;
    rig.targetYaw = spot.yaw;
    rig.standPos.copy(pos);
    if (spot.seated) applySeatedPose(rig);
    else {
      rig.action = "idle";
      syncHuman(rig);
    }
    members.push({ rig, behavior: behaviors[i % behaviors.length], phase: i * 0.73, baseYaw: spot.yaw, seated: spot.seated });
  });
  return members;
}

function updateDominoBowlingCrowd(crowd: BowlingCrowdMember[], dt: number, criticalPulse: boolean) {
  const now = performance.now() * 0.001;
  for (const member of crowd) {
    const { rig } = member;
    member.phase += dt * (criticalPulse ? 1.65 : 1);
    const wave = Math.sin(now * 1.4 + member.phase);
    rig.yaw = member.baseYaw + Math.sin(now * 0.55 + member.phase) * 0.11;
    rig.targetYaw = rig.yaw;
    rig.pos.copy(member.seated ? rig.seatPos : rig.standPos);
    if (member.seated) {
      rig.action = "seated";
      const cheerStand = criticalPulse ? Math.abs(Math.sin(now * 5.4 + member.phase)) : 0;
      const bounce = Math.abs(wave) * (criticalPulse ? 0.035 : 0.012);
      if (rig.model) {
        // Free Kick Arena-style seated celebration over the same Murlan seated base pose.
        rig.model.position.set(0, -0.42 + bounce + cheerStand * 0.2, -0.08 - cheerStand * 0.08);
        rig.model.rotation.set(-0.18 + cheerStand * 0.16 + (member.behavior === "clapping" ? Math.abs(wave) * 0.08 : 0), 0, 0.02 + wave * (criticalPulse ? 0.06 : 0.015));
        const rightHand = findRightHand(rig.model) as THREE.Object3D | null;
        if (rightHand && criticalPulse) {
          rightHand.rotation.x = -1.55 + wave * 0.24;
          rightHand.rotation.z = 0.32 + wave * 0.18;
        }
      }
      animateFallbackHuman(rig, criticalPulse ? "celebrate" : "seat", member.phase);
    } else {
      rig.action = "idle";
      if (rig.model) {
        rig.model.position.y = Math.abs(wave) * 0.018;
        rig.model.rotation.x = member.behavior === "phone" ? 0.16 : criticalPulse || member.behavior === "celebrating" ? Math.abs(wave) * 0.14 : 0;
        rig.model.rotation.z = member.behavior === "clapping" ? Math.sin(now * 6 + member.phase) * 0.08 : wave * 0.025;
      }
      animateFallbackHuman(rig, criticalPulse || member.behavior === "celebrating" ? "celebrate" : "idle", member.phase);
    }
    syncHuman(rig);
  }
}

function updateArenaDecor(decor: BowlingArenaDecor, elapsed: number, criticalPulse: boolean) {
  decor.returnBalls.forEach((ball, i) => {
    const phase = (elapsed * 0.22 + (ball.userData.returnPhase || 0)) % 1;
    ball.position.z = lerp(4.18, 6.98, phase);
    ball.position.x = Math.sin(phase * Math.PI * 2 + i) * 0.055;
    ball.position.y = CFG.laneY + lerp(0.24, 0.4, easeOutCubic(phase));
    ball.rotation.x -= 0.1;
    ball.rotation.z += 0.055;
    ball.visible = phase < 0.92;
  });
  decor.scoreboardPanels.forEach((panel, i) => {
    panel.scale.setScalar(1 + Math.sin(elapsed * 2.2 + i) * (criticalPulse ? 0.018 : 0.006));
  });
  decor.pinfallPanels.forEach((panel, i) => {
    const flashActive = (panel.userData.flashUntil || 0) > performance.now();
    const baseScale = panel.userData.baseScale || 1;
    const pulse = flashActive ? Math.sin(elapsed * 14 + i) * 0.045 : Math.sin(elapsed * 2.8 + i) * 0.01;
    panel.scale.setScalar(baseScale + pulse);
    const mat = panel.material as THREE.MeshBasicMaterial;
    if (mat?.opacity != null) mat.opacity = flashActive ? 0.92 + Math.sin(elapsed * 18 + i) * 0.06 : 1;
  });
  decor.crowdPulseLights.forEach((light, i) => {
    light.intensity = (criticalPulse ? 1.2 : 0.42) + Math.sin(elapsed * 3 + i) * 0.12;
  });
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

function computeIntent(hostWidth: number, hostHeight: number, startX: number, startY: number, x: number, y: number, spin: number): ThrowIntent {
  const vertical = clamp((startY - y) / Math.max(170, hostHeight * 0.34), 0, 1);
  const releaseScreenX = clamp((startX / hostWidth) * 2 - 1, -1, 1);
  const targetScreenX = clamp((x / hostWidth) * 2 - 1, -1, 1);
  const dragX = clamp((x - startX) / Math.max(70, hostWidth * 0.16), -1, 1);
  // Map the finger positions directly to lane boards: where the swipe starts is
  // the release board, and where it ends is the down-lane target board.
  const releaseX = clamp(releaseScreenX * 0.96, -0.98, 0.98);
  const targetX = clamp(targetScreenX * 1.12, -1.16, 1.16);
  const power = vertical;
  const speed = lerp(6.6, 18.4, easeOutCubic(power));
  const spinCurve = spin * lerp(0.28, 1.18, power);
  const swipeCurve = dragX * lerp(0.06, 0.46, power);
  const hook = clamp(spinCurve + swipeCurve, -1.35, 1.35);
  return { power, releaseX, targetX, hook, speed, spin };
}

function startApproach(rig: HumanRig, intent: ThrowIntent, laneCenter = 0) {
  rig.action = "approach";
  rig.approachT = 0;
  rig.throwT = 0;
  rig.recoverT = 0;
  rig.walkCycle = 0;
  rig.approachFrom.copy(rig.pos);
  rig.approachTo.set(laneCenter + clamp(intent.releaseX * 0.34, -0.34, 0.34), CFG.laneY, CFG.approachStopZ);
  rig.yaw = Math.PI;
  rig.targetYaw = Math.PI;
}

function updateHuman(rig: HumanRig, ball: BallState, dt: number, canStartReturnCycle: boolean) {
  if (rig.action === "seated") {
    const breath = Math.sin(performance.now() * 0.002) * 0.008;
    rig.pos.copy(rig.seatPos);
    rig.yaw = rig.seatYaw;
    rig.targetYaw = rig.seatYaw;
    if (rig.model) {
      rig.model.position.set(0, -0.42 + breath, -0.08);
      rig.model.rotation.set(-0.18, 0, 0.02);
    }
    animateFallbackHuman(rig, "seat", rig.walkCycle);
  } else if (rig.action === "standingUp") {
    rig.seatT = clamp01(rig.seatT + dt / CFG.standDuration);
    const k = easeInOut(rig.seatT);
    rig.pos.lerpVectors(rig.seatPos, rig.standPos, k);
    rig.yaw = lerp(rig.seatYaw, Math.PI, k);
    rig.targetYaw = rig.yaw;
    if (rig.model) {
      rig.model.position.set(0, lerp(-0.42, 0, k), lerp(-0.08, 0, k));
      rig.model.rotation.x = lerp(-0.18, 0, k);
      rig.model.rotation.z = lerp(0.02, 0, k);
    }
    if (rig.seatT >= 1) {
      rig.action = "idle";
      rig.pos.copy(rig.standPos);
      rig.yaw = Math.PI;
      rig.targetYaw = Math.PI;
    }
  } else if (rig.action === "toSeat") {
    rig.seatT = clamp01(rig.seatT + dt / CFG.seatWalkDuration);
    rig.walkCycle += dt * 8.8;
    const nextPos = new THREE.Vector3().lerpVectors(rig.approachFrom, rig.seatPos, easeInOut(rig.seatT));
    smoothFacing(rig, nextPos, dt);
    rig.pos.copy(keepHumanInBowlingWalkableArea(nextPos, rig.standPos.x < 0 ? -1 : 1));
    if (rig.model) {
      rig.model.position.y = Math.abs(Math.sin(rig.walkCycle)) * 0.035;
      rig.model.rotation.z = Math.sin(rig.walkCycle) * 0.035;
    }
    if (rig.seatT >= 1) applySeatedPose(rig);
  } else if (rig.action === "approach") {
    rig.approachT = clamp01(rig.approachT + dt / CFG.approachDuration);
    rig.walkCycle += dt * 16.8;
    const nextPos = new THREE.Vector3().lerpVectors(rig.approachFrom, rig.approachTo, easeInOut(rig.approachT));
    smoothFacing(rig, nextPos, dt);
    rig.pos.copy(nextPos);
    if (rig.model) {
      rig.model.position.y = Math.abs(Math.sin(rig.walkCycle)) * 0.046;
      rig.model.rotation.x = 0.035;
      const turnLean = clamp(rig.yawVelocity * 0.0032, -0.12, 0.12);
      rig.model.rotation.z = Math.sin(rig.walkCycle) * 0.02 - turnLean;
    }
    animateFallbackHuman(rig, "walk", rig.walkCycle);
    if (rig.approachT >= 1) {
      rig.action = "throw";
      rig.throwT = 0.001;
    }
  } else if (rig.action === "throw") {
    rig.throwT += dt / CFG.throwDuration;
    animateFallbackHuman(rig, "bowl", clamp01(rig.throwT));
    if (rig.model) {
      const t = clamp01(rig.throwT);
      // right-handed delivery with anticipation, shoulder/hip separation, slide, and follow-through.
      const windup = clamp01(t / 0.32);
      const drive = clamp01((t - 0.26) / (CFG.releaseT - 0.26));
      const follow = clamp01((t - CFG.releaseT) / (1 - CFG.releaseT));
      const releaseSnap = Math.exp(-Math.pow((t - CFG.releaseT) / 0.075, 2));
      const slideDrag = t < CFG.releaseT ? Math.sin(drive * Math.PI) * 0.035 : Math.exp(-follow * 5) * 0.025;

      rig.model.position.y = -Math.sin(drive * Math.PI) * 0.025;
      rig.model.rotation.x = lerp(0, 0.18, windup) + Math.sin(drive * Math.PI) * 0.2 - follow * 0.14;
      rig.model.rotation.z = lerp(0.06, -0.2, drive) + follow * 0.26 + releaseSnap * 0.045;
      rig.model.rotation.y = lerp(-0.18, 0.28, drive) - follow * 0.18;
      rig.model.position.x = lerp(0.04, -0.12, drive) + follow * 0.08;
      rig.model.position.z = lerp(0.07, -0.18, drive) + follow * 0.12 + slideDrag;
      const rightHand = findRightHand(rig.model) as THREE.Object3D | null;
      if (rightHand) {
        if (t < 0.3) {
          const k = easeInOut(t / 0.3);
          rightHand.rotation.x = lerp(0.08, 0.82, k);
          rightHand.rotation.z = lerp(0, -0.2, k);
        } else if (t < CFG.releaseT) {
          const k = easeInOut((t - 0.3) / (CFG.releaseT - 0.3));
          rightHand.rotation.x = lerp(0.82, -2.04, k);
          rightHand.rotation.z = lerp(-0.2, 0.12, k);
        } else {
          const k = easeOutCubic(follow);
          rightHand.rotation.x = lerp(-2.04, 1.12, k);
          rightHand.rotation.z = lerp(0.12, 0.34, k);
        }
      }
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
      rig.returnWalkT = 0;
    }
  } else if (rig.action === "toRack") {
    rig.returnWalkT = clamp01(rig.returnWalkT + dt / CFG.returnWalkDuration);
    rig.walkCycle += dt * 9.2;
    const k = easeInOut(rig.returnWalkT);
    const safeWaypoint = returnSafeWaypointForRig(rig);
    const pickupPoint = returnPickupPointForRig(rig);
    const nextPos = k < 0.55
      ? new THREE.Vector3().lerpVectors(rig.approachTo, safeWaypoint, easeInOut(k / 0.55))
      : new THREE.Vector3().lerpVectors(safeWaypoint, pickupPoint, easeInOut((k - 0.55) / 0.45));
    smoothFacing(rig, nextPos, dt);
    rig.pos.copy(keepHumanInBowlingWalkableArea(nextPos, -1));
    if (rig.model) {
      const swing = Math.sin(rig.walkCycle) * 0.18;
      const turnLean = clamp(rig.yawVelocity * 0.003, -0.1, 0.1);
      rig.model.rotation.y = swing * 0.22;
      rig.model.rotation.z = swing * 0.08 - turnLean;
      rig.model.position.y = Math.abs(Math.sin(rig.walkCycle)) * 0.05;
    }
    animateFallbackHuman(rig, "walk", rig.walkCycle);
    if (rig.returnWalkT >= 1) { rig.action = "pickBall"; rig.pickT = 0.001; }
  } else if (rig.action === "pickBall") {
    rig.pickT = clamp01(rig.pickT + dt / CFG.pickDuration);
    if (rig.model) {
      const k = easeInOut(rig.pickT);
      const reach = Math.sin(clamp01(rig.pickT) * Math.PI);
      rig.model.position.y = lerp(-0.12, 0.02, k);
      rig.model.position.z = lerp(0.08, -0.03, k);
      rig.model.rotation.x = lerp(0.28, -0.08, k);
      rig.model.rotation.z = lerp(-0.08, 0.025, k);
      const rightHand = findRightHand(rig.model) as THREE.Object3D | null;
      if (rightHand) {
        rightHand.rotation.x = lerp(0.42, -1.16, reach);
        rightHand.rotation.z = lerp(-0.22, 0.16, k);
      }
    }
    if (rig.pickT >= 1 && canStartReturnCycle) { rig.action = "toApproach"; rig.returnWalkT = 0.001; }
  } else if (rig.action === "toApproach") {
    rig.returnWalkT = clamp01(rig.returnWalkT + dt / CFG.returnWalkDuration);
    rig.walkCycle += dt * 9.2;
    const k = easeInOut(rig.returnWalkT);
    const safeWaypoint = returnSafeWaypointForRig(rig);
    const pickupPoint = returnPickupPointForRig(rig);
    const nextPos = k < 0.45
      ? new THREE.Vector3().lerpVectors(pickupPoint, safeWaypoint, easeInOut(k / 0.45))
      : new THREE.Vector3().lerpVectors(safeWaypoint, rig.standPos, easeInOut((k - 0.45) / 0.55));
    smoothFacing(rig, nextPos, dt);
    rig.pos.copy(keepHumanInBowlingWalkableArea(nextPos, -1));
    if (rig.model) {
      const swing = Math.sin(rig.walkCycle) * 0.18;
      const turnLean = clamp(rig.yawVelocity * 0.003, -0.1, 0.1);
      rig.model.rotation.y = swing * 0.18;
      rig.model.rotation.z = -swing * 0.06 - turnLean;
      rig.model.position.y = Math.abs(Math.sin(rig.walkCycle)) * 0.05;
    }
    animateFallbackHuman(rig, "walk", rig.walkCycle);
    if (rig.returnWalkT >= 1) rig.action = "idle";
  } else if (rig.action === "idle") {
    rig.walkCycle += dt * 1.25;
    const breath = Math.sin(rig.walkCycle) * 0.012;
    const weight = Math.sin(rig.walkCycle * 0.63) * 0.018;
    if (rig.model) {
      rig.model.position.set(0.02 + weight, breath, 0.02);
      rig.model.rotation.x = 0.025 + breath * 0.6;
      rig.model.rotation.y = weight * 0.25;
      rig.model.rotation.z = -0.025 + weight * 0.9;
    }
    animateFallbackHuman(rig, "idle", rig.walkCycle);
  } else if (rig.model) {
    rig.model.position.y *= 0.82;
    rig.model.rotation.x *= 0.82;
    rig.model.rotation.z *= 0.82;
  }
  if (rig.action === "throw" || rig.action === "recover") {
    rig.targetYaw = Math.PI;
    rig.yaw = lerp(rig.yaw, Math.PI, 1 - Math.pow(0.0008, dt));
    rig.yawVelocity = 0;
  }
  if (rig.action === "idle") {
    rig.targetYaw = Math.PI;
    rig.yaw = lerp(rig.yaw, Math.PI, 1 - Math.pow(0.0008, dt));
    rig.yawVelocity = 0;
  }
  syncHuman(rig);
  if (ball.held && canStartReturnCycle) {
    ball.pos.copy(getHeldBallWorldPosition(rig));
    ball.mesh.position.copy(ball.pos);
  }
}

function syncHeldBallToHuman(ball: BallState, rig: HumanRig) {
  ball.pos.copy(getHeldBallWorldPosition(rig));
  ball.mesh.position.copy(ball.pos);
  ball.mesh.visible = true;
}

function releaseBall(ball: BallState, intent: ThrowIntent, laneCenter = ball.laneCenter) {
  ball.laneCenter = laneCenter;
  const releasePos = new THREE.Vector3(laneCenter + intent.releaseX, CFG.laneY + ball.variant.radius + 0.02, CFG.foulZ - 0.16);
  const target = new THREE.Vector3(laneCenter + intent.targetX, CFG.laneY + ball.variant.radius + 0.02, CFG.pinDeckZ + 0.4);
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

function updateAimVisual(line: THREE.Line, marker: THREE.Mesh, intent: ThrowIntent | null, laneCenter = 0) {
  line.visible = !!intent;
  marker.visible = !!intent;
  if (!intent) return;
  const from = new THREE.Vector3(laneCenter + intent.releaseX, CFG.laneY + 0.1, CFG.foulZ - 0.18);
  const to = new THREE.Vector3(laneCenter + intent.targetX, CFG.laneY + 0.1, CFG.arrowsZ + lerp(2.4, -0.4, intent.power));
  const pos = line.geometry.getAttribute("position") as THREE.BufferAttribute;
  pos.setXYZ(0, from.x, from.y, from.z);
  pos.setXYZ(1, to.x, to.y, to.z);
  pos.needsUpdate = true;
  marker.position.set(to.x, CFG.laneY + 0.11, to.z);
}

function collideBallWithPins(ball: BallState, pins: PinState[]) {
  if (!ball.rolling || Math.abs(ball.pos.x - ball.laneCenter) > CFG.laneHalfW + 0.08) return;
  for (const pin of pins) {
    if (!pin.root.visible) continue;
    const dx = pin.pos.x - ball.pos.x;
    const dz = pin.pos.z - ball.pos.z;
    const dist = Math.hypot(dx, dz);
    const minDist = CFG.ballR + CFG.pinR;
    if (dist > minDist || dist < 0.001) continue;
    const n = new THREE.Vector3(dx / dist, 0, dz / dist);
    const speed = Math.hypot(ball.vel.x, ball.vel.z);
    const impulse = Math.max(0.9, speed * 0.92 * ball.variant.massFactor);
    const tangential = ball.hook * clamp(speed / 14, 0.08, 0.62);
    pin.vel.addScaledVector(n, impulse);
    pin.vel.z += ball.vel.z * 0.24;
    pin.vel.x += tangential;
    pin.angularVel += impulse * 2.2 + Math.abs(tangential) * 1.8;
    pin.tiltDir.copy(n).add(new THREE.Vector3(tangential * 0.25, 0, 0)).normalize();
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
      const rel = a.vel.clone().sub(b.vel);
      const along = Math.abs(rel.dot(n));
      const impulse = clamp(0.25 + along * 0.18, 0.2, 0.9);
      a.vel.addScaledVector(n, -impulse);
      b.vel.addScaledVector(n, impulse);
      a.standing = false;
      b.standing = false;
      a.knocked = true;
      b.knocked = true;
      a.angularVel += 0.42 + impulse * 0.92;
      b.angularVel += 0.42 + impulse * 0.92;
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
    pin.vel.multiplyScalar(Math.exp(-1.65 * dt));
    if (!pin.standing || speed > 0.28) {
      pin.standing = false;
      pin.knocked = true;
      pin.tilt = clamp(pin.tilt + (pin.angularVel + speed * 1.32) * dt, 0, 1.52);
      pin.angularVel *= Math.exp(-1.28 * dt);
    }
    if (Math.abs(pin.pos.x - pin.start.x) > 2.35 || pin.pos.z < CFG.backStopZ - 0.25 || pin.pos.z > CFG.pinDeckZ + 1.15) {
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
    ball.mesh.position.lerp(new THREE.Vector3(ball.laneCenter, 0.16, CFG.backStopZ + 0.1), 1 - Math.exp(-8 * dt));
    if (ball.returnT >= 1) {
      ball.returnState = "hidden";
      ball.returnT = 0;
      ball.mesh.visible = false;
    }
    return false;
  }
  if (ball.returnState === "hidden") {
    ball.returnT += dt / 1.05;
    if (ball.returnT >= 1) {
      ball.returnState = "returning";
      ball.returnT = 0;
      ball.mesh.visible = true;
      ball.pos.set(0, CFG.laneY + 0.24, -0.4);
      ball.mesh.position.copy(ball.pos);
    }
    return false;
  }
  if (ball.returnState === "returning") {
    ball.returnT += dt / 1.75;
    const t = easeOutCubic(clamp01(ball.returnT));
    ball.pos.set(0, CFG.laneY + lerp(0.24, 0.42, t), lerp(-0.4, 6.72, t));
    ball.mesh.position.copy(ball.pos);
    ball.mesh.rotateZ(0.18);
    ball.mesh.rotateX(0.26);
    if (ball.returnT >= 1) {
      ball.returnState = "idle";
      ball.returnT = 0;
      ball.held = false;
      ball.rolling = false;
      ball.inGutter = false;
      ball.mesh.visible = false;
      return true;
    }
  }
  return false;
}


function oilRatioAt(z: number) {
  // House-shot style: slick through the heads, tapering to dry boards near the pin deck.
  return clamp01((z - (CFG.pinDeckZ + 1.4)) / (CFG.foulZ - (CFG.pinDeckZ + 1.4)));
}

function boardNumberFromX(x: number) {
  return clamp(Math.round(((x + CFG.laneHalfW) / (CFG.laneHalfW * 2)) * LANE_BOARD_COUNT), 1, LANE_BOARD_COUNT);
}

function updateBall(ball: BallState, pins: PinState[], dt: number) {
  if (!ball.rolling) return false;
  const flatSpeed = Math.hypot(ball.vel.x, ball.vel.z);
  const localX = ball.pos.x - ball.laneCenter;
  ball.inGutter = Math.abs(localX) > CFG.laneHalfW;
  if (!ball.inGutter && flatSpeed > 0.85) {
    const oil = oilRatioAt(ball.pos.z);
    const dryBoards = clamp01((Math.abs(localX) - CFG.laneHalfW * 0.34) / (CFG.laneHalfW * 0.55));
    const downLane = 1 - oil;
    const hookPhase = clamp01(downLane * 0.78 + dryBoards * 0.42);
    const hookGain = lerp(0.42, 1.62, clamp01(flatSpeed / 16)) * (0.55 + dryBoards * 0.72);
    ball.vel.x += ball.hook * hookPhase * hookGain * dt;
  }
  const oil = ball.inGutter ? 0 : oilRatioAt(ball.pos.z);
  const dryDrag = clamp01((Math.abs(localX) - CFG.laneHalfW * 0.46) / (CFG.laneHalfW * 0.5));
  const drag = ball.inGutter ? 1.28 : lerp(0.22, 0.58, 1 - oil) + dryDrag * 0.2;
  ball.vel.multiplyScalar(Math.exp(-drag * dt));
  ball.pos.addScaledVector(ball.vel, dt);
  if (Math.abs(ball.pos.x - ball.laneCenter) > CFG.gutterHalfW) {
    ball.pos.x = ball.laneCenter + clamp(ball.pos.x - ball.laneCenter, -CFG.gutterHalfW, CFG.gutterHalfW);
    ball.vel.x *= -0.22;
  }
  ball.pos.y = CFG.laneY + ball.variant.radius + (ball.inGutter ? -0.08 : 0.02);
  ball.mesh.position.copy(ball.pos);
  const speed = Math.hypot(ball.vel.x, ball.vel.z);
  if (speed > 0.02) {
    const rollAxis = new THREE.Vector3(ball.vel.z, 0, -ball.vel.x).normalize();
    if (rollAxis.lengthSq() > 0.001) ball.mesh.rotateOnWorldAxis(rollAxis, (speed / ball.variant.radius) * dt);
  }
  collideBallWithPins(ball, pins);
  if (ball.pos.z <= CFG.backStopZ + 0.45 || speed < 0.12) startBallReturn(ball);
  return true;
}


function getPlayerPerspectiveCameraPose(player: HumanRig, ball: BallState, dt: number) {
  const laneCenter = ball.laneCenter || player.standPos.x;
  const aimCenter = laneCenter + clamp(ball.pos.x - laneCenter, -0.42, 0.42) * 0.32;
  const faceSide = player.standPos.x < 0 ? -0.035 : 0.035;
  const progress = player.action === "approach" ? player.approachT : player.action === "throw" ? Math.min(1, player.throwT) : 0;
  const releaseMomentum = player.action === "throw" ? easeOutCubic(clamp01((player.throwT - 0.18) / 0.62)) * 0.7 : 0;
  const faceForward = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
  if (faceForward.lengthSq() < 0.001) faceForward.set(0, 0, -1);
  faceForward.normalize();
  const faceRight = new THREE.Vector3(faceForward.z, 0, -faceForward.x).normalize();
  const face = player.pos.clone()
    .addScaledVector(faceForward, 0.28 + releaseMomentum * 0.08)
    .addScaledVector(faceRight, faceSide)
    .add(new THREE.Vector3(0, 1.62 + lerp(0.04, -0.05, progress), 0));
  face.z = Math.max(face.z, CFG.foulZ + 0.1);
  const desired = face;
  const ballFocus = ball.held
    ? ball.pos.clone().add(new THREE.Vector3(0, 0.18, -1.2))
    : ball.pos.clone().add(new THREE.Vector3(0, 0.16, -0.7));
  const pinFocus = new THREE.Vector3(laneCenter, CFG.laneY + 0.56, CFG.pinDeckZ - 0.68);
  const look = ball.rolling
    ? ballFocus.lerp(pinFocus, clamp01((CFG.foulZ - ball.pos.z) / (CFG.foulZ - CFG.pinDeckZ)))
    : new THREE.Vector3(aimCenter, CFG.laneY + 0.55, lerp(CFG.arrowsZ, CFG.pinDeckZ - 0.2, 0.48 + progress * 0.22));
  return { desired, look };
}

function applyCameraLookOffset(position: THREE.Vector3, look: THREE.Vector3, lookState?: CameraLookState | null) {
  if (!lookState) return look;
  const forward = look.clone().sub(position);
  const distance = Math.max(1, forward.length());
  forward.normalize();
  const yawQuat = new THREE.Quaternion().setFromAxisAngle(UP, lookState.yaw);
  forward.applyQuaternion(yawQuat);
  const right = new THREE.Vector3().crossVectors(forward, UP).normalize();
  if (right.lengthSq() < 0.001) right.set(1, 0, 0);
  const pitchQuat = new THREE.Quaternion().setFromAxisAngle(right, lookState.pitch);
  forward.applyQuaternion(pitchQuat).normalize();
  return position.clone().addScaledVector(forward, distance);
}

function updateCamera(camera: THREE.PerspectiveCamera, ball: BallState, player: HumanRig, dt: number, usePlayerPerspective: boolean, lookState?: CameraLookState | null) {
  let desired: THREE.Vector3;
  let look: THREE.Vector3;
  const isActiveGameplay = ["idle", "approach", "throw", "recover"].includes(player.action) && player !== undefined;
  if (!usePlayerPerspective) {
    const laneCenter = ball.laneCenter || player.standPos.x;
    desired = new THREE.Vector3(laneCenter * 0.22, 2.24, 12.3);
    look = new THREE.Vector3(laneCenter * 0.58, CFG.laneY + 0.58, -6.8);
    if (ball.rolling) {
      const speed01 = clamp01(Math.hypot(ball.vel.x, ball.vel.z) / 16);
      desired.x = lerp(desired.x, laneCenter * 0.45, 0.38);
      desired.y += speed01 * 0.22;
      look.lerp(ball.pos.clone().add(new THREE.Vector3(0, 0.22, -2.0)), 0.42);
      if (ball.pos.z < CFG.pinDeckZ + 2.4) look.lerp(new THREE.Vector3(laneCenter, CFG.laneY + 0.52, CFG.pinDeckZ - 0.7), 0.5);
    }
  } else if (ball.rolling) {
    const laneCenter = ball.laneCenter;
    const lead = ball.vel.clone().setY(0);
    if (lead.lengthSq() < 0.001) lead.set(0, 0, -1);
    lead.normalize();
    const speed01 = clamp01(Math.hypot(ball.vel.x, ball.vel.z) / 16);
    const chase = getPlayerPerspectiveCameraPose(player, ball, dt);
    const laneChase = ball.pos.clone().addScaledVector(lead, -3.85).add(new THREE.Vector3(0, lerp(1.34, 1.15, speed01), 0.92));
    laneChase.x = lerp(laneChase.x, laneCenter, 0.44);
    desired = chase.desired.lerp(laneChase, clamp01((CFG.foulZ - ball.pos.z) / 7.2));
    look = ball.pos.clone().addScaledVector(lead, lerp(3.2, 5.0, speed01)).add(new THREE.Vector3(0, 0.24, 0));
    if (ball.pos.z < CFG.pinDeckZ + 2.4) look.lerp(new THREE.Vector3(laneCenter, CFG.laneY + 0.52, CFG.pinDeckZ - 0.7), 0.45);
  } else if (player.action === "pickBall") {
    desired = player.pos.clone().add(new THREE.Vector3(-0.56, 1.72, 2.7));
    look = new THREE.Vector3(0, CFG.laneY + 0.55, 6.68);
  } else if (isActiveGameplay) {
    const pose = getPlayerPerspectiveCameraPose(player, ball, dt);
    desired = pose.desired;
    look = pose.look;
  } else if (player.action === "toRack" || player.action === "toApproach" || player.action === "standingUp") {
    desired = player.pos.clone().add(new THREE.Vector3(-0.58, 1.68, 3.1));
    look = player.pos.clone().add(new THREE.Vector3(0, 0.64, -1.95));
  } else {
    desired = new THREE.Vector3(player.standPos.x * 0.28, 2.24, 12.3);
    look = new THREE.Vector3(player.standPos.x * 0.72, CFG.laneY + 0.58, -6.8);
  }
  const now = performance.now();
  const pinsProximity = ball.rolling ? clamp01((ball.pos.z - (CFG.pinDeckZ + 1.65)) / 1.6) : 0;
  let shake = camera.userData.impactShake || 0;
  if (ball.rolling && ball.pos.z < CFG.pinDeckZ + 1.4 && !camera.userData.impactShakeTriggered) {
    shake = 1;
    camera.userData.impactShakeTriggered = true;
  }
  if (!ball.rolling) camera.userData.impactShakeTriggered = false;
  shake = Math.max(0, shake - dt * 2.2);
  camera.userData.impactShake = shake;
  const shakeVec = new THREE.Vector3(Math.sin(now * 0.047) * 0.028 * shake, Math.cos(now * 0.039) * 0.018 * shake, Math.sin(now * 0.051) * 0.012 * shake);
  const naturalHeadMotion = new THREE.Vector3(Math.sin(now * 0.001) * 0.01, Math.sin(now * 0.0017) * 0.008, 0);
  const isPortraitCamera = camera.aspect < 0.72;
  if (isPortraitCamera) {
    desired.add(new THREE.Vector3(
      desired.x < 0 ? -PORTRAIT_CAMERA_SIDE_OFFSET : PORTRAIT_CAMERA_SIDE_OFFSET,
      PORTRAIT_CAMERA_HEIGHT_OFFSET,
      -0.08,
    ));
    look.x = lerp(look.x, BOWLING_LOUNGE_CENTER.x * 0.38, 0.16);
    look.z += 0.82;
  }
  if (lookState) {
    lookState.yaw = lerp(lookState.yaw, lookState.targetYaw, 1 - Math.exp(-7.5 * dt));
    lookState.pitch = lerp(lookState.pitch, lookState.targetPitch, 1 - Math.exp(-7.5 * dt));
  }
  const baseFov = isPortraitCamera ? 48 : 42;
  const speedFov = ball.rolling ? clamp01(Math.hypot(ball.vel.x, ball.vel.z) / 16) * 3.5 : 0;
  camera.fov = lerp(camera.fov, baseFov + speedFov + pinsProximity * 1.6, 1 - Math.exp(-3.6 * dt));
  camera.updateProjectionMatrix();
  camera.position.lerp(desired.add(naturalHeadMotion).add(shakeVec), 1 - Math.exp(-5.8 * dt));
  const adjustedLook = applyCameraLookOffset(camera.position, look, lookState);
  const currentLook = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).multiplyScalar(8).add(camera.position);
  currentLook.lerp(adjustedLook, 1 - Math.exp(-8.6 * dt));
  camera.lookAt(currentLook);
}

function FrameBox({ frame, index }: { frame: BowlingFrame; index: number }) {
  const rolls = createFrameRollSymbols(frame, index);
  const smallCols = index === 9 ? 3 : 2;
  return (
    <div style={{ minWidth: index === 9 ? 34 : 26, border: "1px solid rgba(255,255,255,0.16)", borderRadius: 5, overflow: "hidden", background: "rgba(255,255,255,0.035)" }}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${smallCols}, 1fr)`, borderBottom: "1px solid rgba(255,255,255,0.12)", minHeight: 14, fontSize: 8, fontWeight: 800, color: "rgba(255,255,255,0.96)" }}>
        {rolls.map((r, i) => (
          <div key={i} style={{ textAlign: "center", padding: "2px 0", borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.12)" : "none" }}>{r}</div>
        ))}
      </div>
      <div style={{ textAlign: "center", padding: "2px 1px", minHeight: 14, fontSize: 9, fontWeight: 900, color: "#7fd6ff" }}>{frame.cumulative ?? ""}</div>
    </div>
  );
}

export default function MobileBowlingRealistic() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const joystickRef = useRef({ active: false, x: 0, z: 0 });
  const cameraLookInputRef = useRef({ active: false, pointerId: null as number | null, startX: 0, startY: 0, targetYaw: 0, targetPitch: 0 });
  const ballPickRequestRef = useRef<string | null>(null);
  const spinControlRef = useRef(0);
  const [joystickKnob, setJoystickKnob] = useState({ x: 0, y: 0 });
  const [spinKnob, setSpinKnob] = useState(0);
  const [hud, setHud] = useState<HudState>({ power: 0, status: "Move to the rack, pick up a ball, then swipe at the approach line", compliment: "", activePlayer: 0, p1: 0, p2: 0, frame: 1, roll: 1, rule: BOWLING_RULE_SUMMARY, lane: "Board 20 · house shot" });
  const [scores, setScores] = useState<ScorePlayer[]>(() => makeEmptyPlayers());
  const [menuOpen, setMenuOpen] = useState(false);
  const [graphicsQuality, setGraphicsQuality] = useState<"performance"|"balanced"|"ultra">("balanced");
  const [selectedHdriId, setSelectedHdriId] = useState<string>(() => localStorage.getItem("bowling.hdri") || DEFAULT_HDRI_ID);
  const [ownedPoolInventory, setOwnedPoolInventory] = useState<any>(() => getCachedPoolRoyalInventory());
  const [selectedTableFinish, setSelectedTableFinish] = useState<string>(() => localStorage.getItem("bowling.tableFinish") || POOL_ROYALE_DEFAULT_UNLOCKS.tableFinish[0]);
  const [selectedChromeColor, setSelectedChromeColor] = useState<string>(() => localStorage.getItem("bowling.chromeColor") || POOL_ROYALE_DEFAULT_UNLOCKS.chromeColor[0]);
  const [selectedBallWeight, setSelectedBallWeight] = useState<string>(() => localStorage.getItem("bowling.ballWeight") || "12");
  const [selectedHumanCharacterId, setSelectedHumanCharacterId] = useState<string>(() => localStorage.getItem("bowling.humanCharacter") || DEFAULT_HUMAN_CHARACTER_ID);
  const [skipReplays, setSkipReplays] = useState<boolean>(() => localStorage.getItem("bowling.skipReplays") === "1");
  const [replayActive, setReplayActive] = useState(false);
  const [pickupUiVisible, setPickupUiVisible] = useState(false);
  const scoresMemo = useMemo(() => scores, [scores]);

  const setJoystickFromPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const max = rect.width * 0.36;
    const dx = clamp(e.clientX - cx, -max, max);
    const dy = clamp(e.clientY - cy, -max, max);
    joystickRef.current = { active: true, x: dx / max, z: dy / max };
    setJoystickKnob({ x: dx, y: dy });
  };

  const stopJoystick = () => {
    joystickRef.current = { active: false, x: 0, z: 0 };
    setJoystickKnob({ x: 0, y: 0 });
  };

  const setSpinFromPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const max = rect.width * 0.36;
    const dx = clamp(e.clientX - cx, -max, max);
    const value = clamp(dx / max, -1, 1);
    spinControlRef.current = value;
    setSpinKnob(dx);
  };

  const requestManualBallPickup = (label: string) => {
    ballPickRequestRef.current = label;
    setHud((prev) => ({ ...prev, status: `Pickup requested: ${label} lb. Stand at the rack to collect it.` }));
  };


  useEffect(() => {
    const refresh = () => setOwnedPoolInventory(getCachedPoolRoyalInventory());
    refresh();
    window.addEventListener("poolRoyalInventoryUpdate", refresh as EventListener);
    return () => window.removeEventListener("poolRoyalInventoryUpdate", refresh as EventListener);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setClearColor(0x090b11, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = graphicsQuality === "ultra" ? 0.92 : graphicsQuality === "performance" ? 0.78 : 0.86;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070a12);
    scene.fog = new THREE.FogExp2(0x080a10, 0.026);

    const camera = new THREE.PerspectiveCamera(44, 1, 0.05, 80);
    camera.position.set(-0.62, 3.22, 12.65);

    const playerCharacter = getCharacterById(selectedHumanCharacterId);
    const aiCharacter = pickRandomAiCharacter(playerCharacter?.id || DEFAULT_HUMAN_CHARACTER_ID);

    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    let envTex: THREE.Texture | null = null;
    let bgTex: THREE.Texture | null = null;
    const applyHdri = (id: string) => {
      const selected = HDRI_OPTIONS.find((h) => h.id === id) || HDRI_OPTIONS[0];
      const menuPreferred = graphicsQuality === "performance" ? ["2k", "1k"] : graphicsQuality === "ultra" ? ["8k", "4k", "2k"] : ["4k", "2k"];
      const preferred = Array.isArray(selected?.preferredResolutions) ? [...menuPreferred, ...selected.preferredResolutions] : menuPreferred;
      const candidates = [
        ...(Object.values(selected?.assetUrls || {}) as string[]),
        selected?.hdriUrl,
        ...HDRI_RES_LADDER.map((r) => `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/${r}/${selected?.assetId || "studio_small_09"}_${r}.hdr`)
      ].filter(Boolean) as string[];
      const ordered = [...new Set([...preferred.flatMap((res) => candidates.filter((u) => u.includes(`_${res}.`))), ...candidates])];
      const tryLoad = (idx: number) => {
        if (idx >= ordered.length) {
          scene.environment = null;
          scene.background = new THREE.Color(0x090b11);
          return;
        }
        new RGBELoader().setCrossOrigin("anonymous").load(
          ordered[idx],
          (hdr) => {
            envTex?.dispose();
            bgTex?.dispose();
            hdr.mapping = THREE.EquirectangularReflectionMapping;
            bgTex = hdr;
            envTex = pmrem.fromEquirectangular(hdr).texture;
            scene.environment = envTex;
            scene.background = bgTex;
            const selectedRotation = (Number.isFinite(selected?.rotationY) ? selected.rotationY : 0) + BOWLING_HDRI_WALL_ALIGNMENT_Y;
            if ("backgroundRotation" in scene) scene.backgroundRotation.set(0, selectedRotation, 0);
            if ("environmentRotation" in scene) scene.environmentRotation.set(0, selectedRotation, 0);
            if ("backgroundBlurriness" in scene) scene.backgroundBlurriness = 0;
            if ("backgroundIntensity" in scene) scene.backgroundIntensity = graphicsQuality === "ultra" ? 0.42 : graphicsQuality === "performance" ? 0.32 : 0.36;
            if ("environmentIntensity" in scene) scene.environmentIntensity = graphicsQuality === "performance" ? 0.34 : graphicsQuality === "ultra" ? 0.52 : 0.42;
          },
          undefined,
          () => tryLoad(idx + 1)
        );
      };
      tryLoad(0);
    };
    applyHdri(selectedHdriId);

    scene.add(new THREE.AmbientLight(0x8fa6d9, 0.035));
    scene.add(new THREE.HemisphereLight(0xffecd6, 0x08070b, 0.18));
    const key = new THREE.DirectionalLight(0xffefd8, 2.65);
    key.position.set(-4.8, 8.2, 6.6);
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
    const fill = new THREE.DirectionalLight(0x7dd3fc, 0.08);
    fill.position.set(4.4, 4.8, 6.3);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xff9a4f, 1.72);
    rim.position.set(3.8, 4.6, -12.4);
    scene.add(rim);
    for (let i = 0; i < 8; i++) {
      const z = lerp(6.7, -13.6, i / 7);
      const light = new THREE.PointLight(0xffd8a6, i > 5 ? 0.95 : 0.54, 8.4, 2.15);
      light.position.set(i % 2 === 0 ? -1.18 : 1.18, 2.72, z);
      scene.add(light);
    }
    const pinSpot = new THREE.SpotLight(0xfff0c8, 3.2, 12, Math.PI / 7.5, 0.42, 1.35);
    pinSpot.position.set(0, 3.36, CFG.pinDeckZ + 1.6);
    pinSpot.target.position.set(0, CFG.laneY + 0.22, CFG.pinDeckZ - 0.62);
    scene.add(pinSpot, pinSpot.target);
    const laneSpot = new THREE.SpotLight(0x9fe8ff, 1.15, 18, Math.PI / 8, 0.54, 1.2);
    laneSpot.position.set(-1.2, 2.7, 5.4);
    laneSpot.target.position.set(0, CFG.laneY + 0.08, -5.8);
    scene.add(laneSpot, laneSpot.target);

    const texLoader = new THREE.TextureLoader();
    const arenaDecor = createEnvironment(scene, texLoader, selectedTableFinish, selectedChromeColor);
    const pickupPrompt = makePickupPromptSprite();
    scene.add(pickupPrompt);
    const lanePins = LANE_CENTERS.map((center) => createPins(scene, center));
    const activePins = () => lanePins[activePlayer];
    const activeLaneCenter = () => laneCenterForPlayer(activePlayer);
    const playerRigs = [
      addHuman(scene, PLAYER_SEATS[0].stand.clone(), playerCharacter, PLAYER_SEATS[0].pos, PLAYER_SEATS[0].yaw),
      addHuman(scene, PLAYER_SEATS[1].pos.clone(), aiCharacter, PLAYER_SEATS[1].pos, PLAYER_SEATS[1].yaw),
    ];
    const crowdMembers = createDominoBowlingCrowd(scene, playerCharacter?.id || DEFAULT_HUMAN_CHARACTER_ID);
    playerRigs[0].standPos.copy(PLAYER_SEATS[0].stand);
    playerRigs[1].standPos.copy(PLAYER_SEATS[1].stand);
    applyStandingPose(playerRigs[0]);
    applySeatedPose(playerRigs[1]);
    let player = playerRigs[0];
    const ballVariant = BALL_VARIANTS.find((v) => v.label === selectedBallWeight) || BALL_VARIANTS[1];
    const ball = createActiveBall(ballVariant);
    scene.add(ball.mesh);

    let localScores = makeEmptyPlayers();
    let activePlayer = 0;
    let lastShotStandingBefore = 10;
    let pinsWereMoving = false;
    let settleTimer = 0;
    const pinReset = makePinResetState();
    let waitingForBallReturn = false;
    let pendingIntent: ThrowIntent | null = null;
    let shotResolved = false;
    let nextAction: "samePlayer" | "nextPlayer" | "gameOver" = "samePlayer";
    let shouldResetRackBeforeNextRoll = false;
    let rackResetLane = 0;
    let replayTimer = 0;

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
    const cameraLook: CameraLookState = { active: false, pointerId: null, startX: 0, startY: 0, yaw: 0, pitch: 0, targetYaw: 0, targetPitch: 0 };

    const startCameraLook = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      cameraLook.active = true;
      cameraLook.pointerId = e.pointerId;
      cameraLook.startX = e.clientX;
      cameraLook.startY = e.clientY;
    };

    const resetPlayerPoseForNextBall = () => {
      player.action = "idle";
      player.approachT = 0;
      player.throwT = 0;
      player.recoverT = 0;
      player.walkCycle = 0;
      player.pos.copy(player.standPos);
      player.yaw = Math.PI;
      player.targetYaw = Math.PI;
      player.approachFrom.copy(player.pos);
      player.approachTo.copy(player.pos);
      applyStandingPose(player);
      syncHuman(player);
      ball.held = activePlayer === 1;
      ball.rolling = false;
      ball.inGutter = false;
      ball.vel.set(0, 0, 0);
      ball.mesh.visible = ball.held;
      if (ball.held) syncHeldBallToHuman(ball, player);
    };

    const prepareNextTurnAfterReturn = () => {
      waitingForBallReturn = false;
      shotResolved = false;
      pinsWereMoving = false;
      settleTimer = 0;
      pendingIntent = null;
      if (shouldResetRackBeforeNextRoll) resetPins(lanePins[rackResetLane]);
      shouldResetRackBeforeNextRoll = false;
      const previousPlayer = player;
      player = playerRigs[activePlayer];
      ball.laneCenter = activeLaneCenter();
      if (previousPlayer !== player) seatRigAfterTurn(previousPlayer);
      resetPlayerPoseForNextBall();
      if (previousPlayer !== player) standRigForTurn(player);
      syncReactScores();
      aiTurnDelay = activePlayer === 1 ? 0.85 + Math.random() * 0.5 : 0.85;
      const playerName = localScores[activePlayer].name;
      setHud((prev) => ({ ...prev, status: nextAction === "gameOver" ? "Game over" : activePlayer === 1 ? `${playerName} is choosing a line…` : `${playerName}: walk near the rack until PICK UP appears, tap a ball, then swipe at the line` }));
    };

    const finalizeShot = (afterStanding: number) => {
      const knocked = clamp(lastShotStandingBefore - afterStanding, 0, 10);
      const scoringPlayerIndex = activePlayer;
      const playerBefore = localScores[scoringPlayerIndex];
      const result = addRollToPlayer(playerBefore, knocked);
      const rollRead = describeRollResult(playerBefore, result, knocked);
      let status = `${playerBefore.name} knocked ${knocked} pin${knocked === 1 ? "" : "s"}`;
      let compliment: string = RESULT_COMPLIMENTS.open[Math.floor(Math.random()*RESULT_COMPLIMENTS.open.length)];
      const strike = rollRead.isStrike;
      const spare = rollRead.isSpare;
      shouldResetRackBeforeNextRoll = result.resetPins;
      rackResetLane = activePlayer;
      if (strike) { status = `${playerBefore.name} STRIKE!`; compliment = RESULT_COMPLIMENTS.strike[Math.floor(Math.random()*RESULT_COMPLIMENTS.strike.length)] + " " + STRIKE_DANCE_LINES[Math.floor(Math.random()*STRIKE_DANCE_LINES.length)]; }
      if (spare) { status = `${playerBefore.name} SPARE!`; compliment = RESULT_COMPLIMENTS.spare[Math.floor(Math.random()*RESULT_COMPLIMENTS.spare.length)]; }
      player.celebrateNext = strike || spare;
      const allDone = localScores.every((p) => playerFinished(p));
      if (allDone) nextAction = "gameOver";
      else if (result.frameEnded) {
        activePlayer = (activePlayer + 1) % 2;
        nextAction = "nextPlayer";
      } else nextAction = "samePlayer";
      syncReactScores();
      updatePinfallBoards(arenaDecor, scoringPlayerIndex, knocked, afterStanding, playerBefore.name.toUpperCase());
      setHud((prev) => ({ ...prev, status, compliment, rule: rollRead.rule, lane: rollRead.lane }));
      shotResolved = true;
      waitingForBallReturn = true;
      if (!skipReplays && (strike || spare)) {
        replayTimer = CFG.replayDuration;
        setReplayActive(true);
      }
      if (ball.returnState === "idle") startBallReturn(ball);
    };

    let aiTurnDelay = 0.85;
    const makeAiIntent = (): ThrowIntent => {
      const frame = currentFrameIndex(localScores[1]);
      const roll = localScores[1].frames[frame]?.rolls.length || 0;
      const targetJitter = (Math.random() - 0.5) * (roll ? 0.7 : 0.42);
      const releaseJitter = (Math.random() - 0.5) * 0.5;
      const power = clamp(0.72 + Math.random() * 0.22, 0, 1);
      const targetX = clamp(targetJitter, -1.1, 1.1);
      const releaseX = clamp(releaseJitter * 0.55, -0.72, 0.72);
      return { power, releaseX, targetX, hook: (Math.random() - 0.5) * 0.32, speed: lerp(10.8, 15.4, power), spin: (Math.random() - 0.5) * 0.28 };
    };

    const manualMovePlayer = (dt: number) => {
      if (activePlayer !== 0 || ball.rolling || waitingForBallReturn || control.active || replayActive) return;
      if (player.action !== "idle") return;
      const joy = joystickRef.current;
      if (Math.hypot(joy.x, joy.z) < 0.06) return;
      const next = player.pos.clone().add(new THREE.Vector3(joy.x, 0, joy.z).multiplyScalar(2.35 * dt));
      keepHumanInBowlingWalkableArea(next, joy.x < 0 ? -1 : 1);
      smoothFacing(player, next, dt);
      player.pos.copy(next);
      player.walkCycle += dt * 12.5;
      if (player.model) {
        player.model.position.y = Math.abs(Math.sin(player.walkCycle)) * 0.045;
        player.model.rotation.z = Math.sin(player.walkCycle) * 0.035;
      }
      animateFallbackHuman(player, "walk", player.walkCycle);
      syncHuman(player);
      if (ball.held) syncHeldBallToHuman(ball, player);
    };

    const tryManualBallPickup = () => {
      const request = ballPickRequestRef.current;
      if (!request || activePlayer !== 0 || ball.rolling || waitingForBallReturn || player.action !== "idle") return;
      const rackDistance = Math.hypot(player.pos.x - 0, player.pos.z - 7.64);
      if (rackDistance > 1.75) {
        setHud((prev) => ({ ...prev, status: "Move in front of the ball rack first, then tap the ball." }));
        return;
      }
      if (request !== selectedBallWeight) {
        setSelectedBallWeight(request);
        localStorage.setItem("bowling.ballWeight", request);
        setHud((prev) => ({ ...prev, status: `Preparing ${request} lb ball from the rack…` }));
        return;
      }
      ballPickRequestRef.current = null;
      ball.held = true;
      ball.rolling = false;
      ball.returnState = "idle";
      ball.mesh.visible = true;
      player.action = "pickBall";
      player.pickT = 0.001;
      player.returnWalkT = 0;
      player.targetYaw = Math.PI;
      syncHeldBallToHuman(ball, player);
      setHud((prev) => ({ ...prev, status: `${request} lb ball collected. Hand pickup animation started—walk to the approach line and swipe to shoot.`, lane: "Manual pickup ready" }));
    };

    let frameId = 0;
    let last = performance.now();

    const resize = () => {
      const w = Math.max(1, host.clientWidth);
      const h = Math.max(1, host.clientHeight);
      const qualityMaxPixelRatio = graphicsQuality === "performance" ? 1.25 : graphicsQuality === "balanced" ? 1.8 : 2.25;
      renderer.setPixelRatio(Math.min(qualityMaxPixelRatio, window.devicePixelRatio || 1));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.fov = camera.aspect < 0.72 ? 50 : 44;
      camera.updateProjectionMatrix();
    };

    const onPointerDown = (e: PointerEvent) => {
      if (control.active || cameraLook.active) return;
      const canStartThrow = nextAction !== "gameOver"
        && !ball.rolling
        && !waitingForBallReturn
        && !replayActive
        && activePlayer === 0
        && player === playerRigs[0]
        && player.action === "idle"
        && ball.held
        && player.pos.z <= CFG.foulZ + 1.85;
      if (!canStartThrow) {
        startCameraLook(e);
        if (activePlayer === 0 && !ball.held && !ball.rolling && !waitingForBallReturn) {
          setHud((prev) => ({ ...prev, status: "Drag the view to look around, or walk to the rack and tap a ball." }));
        } else if (activePlayer === 0 && player.pos.z > CFG.foulZ + 1.85 && !ball.rolling && !waitingForBallReturn) {
          setHud((prev) => ({ ...prev, status: "Drag the view to look around. Move to the approach line before swiping to shoot." }));
        }
        return;
      }
      canvas.setPointerCapture(e.pointerId);
      control.active = true;
      control.pointerId = e.pointerId;
      control.startX = e.clientX;
      control.startY = e.clientY;
      control.lastX = e.clientX;
      control.lastY = e.clientY;
      control.intent = computeIntent(host.clientWidth, host.clientHeight, e.clientX, e.clientY, e.clientX, e.clientY, spinControlRef.current);
      pendingIntent = control.intent;
      updateAimVisual(aimLine, aimMarker, control.intent, activeLaneCenter());
      setHud((prev) => ({ ...prev, power: 0, status: "Swipe up. Slide left/right to aim." }));
    };

    const onPointerMove = (e: PointerEvent) => {
      if (cameraLook.active && cameraLook.pointerId === e.pointerId) {
        const dx = (e.clientX - cameraLook.startX) / Math.max(1, host.clientWidth);
        const dy = (e.clientY - cameraLook.startY) / Math.max(1, host.clientHeight);
        cameraLook.targetYaw = clamp(cameraLook.targetYaw - dx * 1.45, -0.82, 0.82);
        cameraLook.targetPitch = clamp(cameraLook.targetPitch - dy * 1.05, -0.42, 0.48);
        cameraLookInputRef.current.targetYaw = cameraLook.targetYaw;
        cameraLookInputRef.current.targetPitch = cameraLook.targetPitch;
        cameraLook.startX = e.clientX;
        cameraLook.startY = e.clientY;
        return;
      }
      if (!control.active || control.pointerId !== e.pointerId) return;
      control.lastX = e.clientX;
      control.lastY = e.clientY;
      control.intent = computeIntent(host.clientWidth, host.clientHeight, control.startX, control.startY, e.clientX, e.clientY, spinControlRef.current);
      pendingIntent = control.intent;
      updateAimVisual(aimLine, aimMarker, control.intent, activeLaneCenter());
      setHud((prev) => ({ ...prev, power: control.intent!.power, lane: `Aim board ${boardNumberFromX(control.intent!.targetX)} · ${Math.round(control.intent!.power * 100)}% · spin ${control.intent!.spin >= 0 ? "+" : ""}${control.intent!.spin.toFixed(2)}` }));
    };

    const onPointerUp = (e: PointerEvent) => {
      if (cameraLook.active && cameraLook.pointerId === e.pointerId) {
        try { canvas.releasePointerCapture(e.pointerId); } catch {}
        cameraLook.active = false;
        cameraLook.pointerId = null;
        cameraLookInputRef.current.targetYaw = cameraLook.targetYaw;
        cameraLookInputRef.current.targetPitch = cameraLook.targetPitch;
        return;
      }
      if (!control.active || control.pointerId !== e.pointerId) return;
      try { canvas.releasePointerCapture(e.pointerId); } catch {}
      control.active = false;
      control.pointerId = null;
      aimLine.visible = false;
      aimMarker.visible = false;
      const intent = computeIntent(host.clientWidth, host.clientHeight, control.startX, control.startY, e.clientX, e.clientY, spinControlRef.current);
      if (intent.power < 0.05) {
        pendingIntent = null;
        setHud((prev) => ({ ...prev, power: 0, status: "Swipe higher for power" }));
        return;
      }
      pendingIntent = intent;
      startApproach(player, intent, activeLaneCenter());
      setHud((prev) => ({ ...prev, power: 0, status: "Four-step approach · release before foul line", rule: "Release must stay behind the foul line", lane: `Target board ${boardNumberFromX(intent.targetX)} · hook ${intent.hook >= 0 ? "right" : "left"} · spin ${intent.spin >= 0 ? "+" : ""}${intent.spin.toFixed(2)}` }));
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
      if (replayTimer > 0) {
        replayTimer = Math.max(0, replayTimer - dt);
        if (replayTimer <= 0) setReplayActive(false);
      }
      if (activePlayer === 1 && !control.active && !ball.rolling && !waitingForBallReturn && !replayActive && player.action === "idle" && nextAction !== "gameOver") {
        aiTurnDelay = Math.max(0, aiTurnDelay - dt);
        if (aiTurnDelay <= 0) {
          if (!ball.held) {
            ball.held = true;
            syncHeldBallToHuman(ball, player);
          }
          pendingIntent = makeAiIntent();
          startApproach(player, pendingIntent, activeLaneCenter());
          aiTurnDelay = 0.85 + Math.random() * 0.5;
          setHud((prev) => ({ ...prev, status: "PLAYER 2 AI is bowling" }));
        }
      }
      tryManualBallPickup();
      const rackDistanceForPrompt = Math.hypot(playerRigs[0].pos.x, playerRigs[0].pos.z - 7.64);
      pickupPrompt.visible = activePlayer === 0 && !ball.held && !ball.rolling && !waitingForBallReturn && playerRigs[0].action === "idle" && rackDistanceForPrompt <= 1.85;
      setPickupUiVisible((visible) => visible === pickupPrompt.visible ? visible : pickupPrompt.visible);
      pickupPrompt.position.y = CFG.laneY + 1.52 + Math.sin(now * 0.004) * 0.045;
      manualMovePlayer(dt);
      const criticalPulse = replayTimer > 0 || player.celebrateNext;
      for (const rig of playerRigs) updateHuman(rig, ball, dt, rig === player);
      keepPlayersSeparated(playerRigs, 0.62);
      updateDominoBowlingCrowd(crowdMembers, dt, criticalPulse);
      updateArenaDecor(arenaDecor, now * 0.001, criticalPulse);
      if (player.action === "throw" && pendingIntent && player.throwT >= CFG.releaseT && ball.held) {
        lastShotStandingBefore = standingPinsCount(activePins());
        releaseBall(ball, pendingIntent, activeLaneCenter());
        pendingIntent = null;
        setHud((prev) => ({ ...prev, status: "Ball rolling" }));
      }
      updateBall(ball, activePins(), dt);
      const pinsMoving = lanePins.map((pins) => updatePins(pins, dt)).some(Boolean);
      const mechanismBusy = ball.returnState !== "idle" || ball.rolling || pinsMoving || pinReset.phase !== "idle";
      if ((player.action === "pickBall" || player.action === "toApproach") && mechanismBusy) {
        player.action = "pickBall";
      }
      if (pinsMoving) pinsWereMoving = true;
      const resetCompleteStanding = updatePinReset(pinReset, arenaDecor, dt);
      if (resetCompleteStanding != null && !shotResolved) finalizeShot(resetCompleteStanding);
      if (!shotResolved && pinReset.phase === "idle" && !ball.rolling && (!pinsWereMoving || !pinsMoving)) {
        settleTimer += dt;
        const noPinContactReady = !pinsWereMoving && ball.returnState !== "idle" && settleTimer > 0.35;
        const pinContactReady = pinsWereMoving && settleTimer > 0.72;
        if (noPinContactReady || pinContactReady) beginPinReset(pinReset, activePins(), arenaDecor);
      } else if (pinsMoving) settleTimer = 0;
      if (ball.returnState !== "idle") {
        const finished = updateBallReturn(ball, dt);
        if (finished && waitingForBallReturn) prepareNextTurnAfterReturn();
      }
      ballShadow.visible = ball.mesh.visible;
      ballShadow.position.set(ball.pos.x, CFG.laneY + 0.01, ball.pos.z);
      ballShadow.scale.setScalar(ball.held ? 0.72 : ball.inGutter ? 0.9 : 1.04);
      if (!cameraLook.active) {
        cameraLook.targetYaw = cameraLookInputRef.current.targetYaw;
        cameraLook.targetPitch = cameraLookInputRef.current.targetPitch;
      }
      if (control.active) updateAimVisual(aimLine, aimMarker, control.intent, activeLaneCenter());
      updateCamera(camera, ball, player, dt, activePlayer === 0, cameraLook);
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
  }, [graphicsQuality, selectedHdriId, selectedBallWeight, selectedTableFinish, selectedChromeColor, selectedHumanCharacterId, replayActive, skipReplays]);

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#090b11", touchAction: "none", userSelect: "none" }}>
      <div ref={hostRef} style={{ position: "absolute", inset: 0 }}>
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }} />
      </div>

      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif" }}>
        <div style={{ position: "absolute", left: 18, right: 18, top: 6, color: "white", background: "rgba(5,8,14,0.66)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 14, padding: "6px 6px 8px", boxShadow: "0 10px 24px rgba(0,0,0,0.24)", backdropFilter: "blur(10px)", transform: "scale(0.78)", transformOrigin: "top center" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 0.2 }}>REAL BOWLING SCOREBOARD</div>
            <div style={{ fontSize: 9, fontWeight: 800, color: "#7fd6ff" }}>FRAME {hud.frame} · ROLL {hud.roll} · P{hud.activePlayer + 1}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "38px repeat(10, minmax(19px, 1fr))", gap: 3, alignItems: "center" }}>
            <div style={{ fontSize: 10, fontWeight: 800, opacity: 0.72, textAlign: "center" }}></div>
            {Array.from({ length: 10 }, (_, i) => <div key={i} style={{ textAlign: "center", fontSize: 10, fontWeight: 800, opacity: 0.7 }}>{i + 1}</div>)}
            {scoresMemo.map((p, row) => (
              <React.Fragment key={p.name}>
                <div style={{ paddingLeft: 1, fontSize: 9, fontWeight: 900, color: row === hud.activePlayer ? "#7fd6ff" : "#ffffff" }}>{row === 0 ? `P1 ${p.total}` : `P2 ${p.total}`}</div>
                {p.frames.map((f, i) => <FrameBox key={`${row}-${i}`} frame={f} index={i} />)}
              </React.Fragment>
            ))}
          </div>
          <div style={{ marginTop: 5, textAlign: "center", fontSize: 10, fontWeight: 700, opacity: 0.9 }}>{hud.status}</div>
          <div style={{ marginTop: 4, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, fontSize: 8, fontWeight: 800 }}>
            <div style={{ padding: "4px 5px", borderRadius: 7, background: "rgba(14,165,233,0.16)", border: "1px solid rgba(125,211,252,0.18)" }}>{hud.lane}</div>
            <div style={{ padding: "4px 5px", borderRadius: 7, background: "rgba(34,197,94,0.14)", border: "1px solid rgba(134,239,172,0.18)" }}>{hud.rule}</div>
          </div>
          {hud.compliment ? <div style={{ marginTop: 4, textAlign: "center", fontSize: 10, fontWeight: 800, color: "#86efac" }}>{hud.compliment}</div> : null}
        </div>

        <button onClick={() => setMenuOpen((v)=>!v)} style={{ position:"absolute", top: 102, left: 8, width: 40, height:40, borderRadius: 10, border:"1px solid rgba(255,255,255,0.28)", background:"rgba(5,8,14,0.72)", color:"#fff", fontSize:22, fontWeight:900, pointerEvents:"auto" }}>☰</button>
        {menuOpen ? <div style={{ position:"absolute", top: 148, left: 8, right: 8, maxHeight:"48vh", overflow:"auto", borderRadius: 14, padding: 10, background:"rgba(5,8,14,0.88)", border:"1px solid rgba(255,255,255,0.18)", pointerEvents:"auto" }}>
          <div style={{fontSize:12,fontWeight:800,marginBottom:8}}>Graphics (Pool Royal style)</div>
          {["performance","balanced","ultra"].map((q)=> <button key={q} onClick={()=>setGraphicsQuality(q as any)} style={{marginRight:6, marginBottom:6, padding:"6px 9px", borderRadius:8, border:"1px solid rgba(255,255,255,0.2)", background: graphicsQuality===q?"#7fd6ff":"rgba(255,255,255,0.08)", color: graphicsQuality===q?"#001018":"#fff"}}>{q}</button>)}

          <div style={{fontSize:12,fontWeight:800,margin:"10px 0 6px"}}>Ball weight</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
            {BALL_VARIANTS.map((v)=> <button key={v.label} onClick={()=>{setSelectedBallWeight(v.label); localStorage.setItem("bowling.ballWeight",v.label);}} style={{padding:"6px 10px", borderRadius:8, border:"1px solid rgba(255,255,255,0.2)", background:selectedBallWeight===v.label?"#7fd6ff":"rgba(255,255,255,0.08)", color:selectedBallWeight===v.label?"#001018":"#fff", fontWeight:800}}>{v.label} lb</button>)}
          </div>
          <div style={{fontSize:12,fontWeight:800,margin:"10px 0 6px"}}>Human character inventory</div>
          <div style={{display:"grid", gridTemplateColumns:"repeat(2,minmax(0,1fr))", gap:8}}>
            {HUMAN_CHARACTER_OPTIONS.filter((item)=> item.id === DEFAULT_HUMAN_CHARACTER_ID || (ownedPoolInventory?.humanCharacter||[]).includes(item.id)).map((item)=><button key={item.id} onClick={()=>{setSelectedHumanCharacterId(item.id); localStorage.setItem("bowling.humanCharacter",item.id);}} style={{textAlign:"left", border:"1px solid rgba(255,255,255,0.2)", borderRadius:10, padding:6, background:selectedHumanCharacterId===item.id?"rgba(127,214,255,0.2)":"rgba(255,255,255,0.05)", color:"#fff"}}>{item.thumbnail ? <img src={item.thumbnail} alt={item.label} style={{width:"100%",borderRadius:8,marginBottom:6}} /> : null}<div style={{fontSize:11,fontWeight:700}}>{item.label}</div><div style={{fontSize:10,opacity:0.75}}>Owned · AI randomizes from this set</div></button>)}
          </div>

          <div style={{fontSize:12,fontWeight:800,margin:"10px 0 6px"}}>HDRI inventory</div>
          <div style={{display:"grid", gridTemplateColumns:"repeat(2,minmax(0,1fr))", gap:8}}>
            {HDRI_OPTIONS.filter((h)=> (ownedPoolInventory?.environmentHdri||[]).includes(h.id)).map((h)=><button key={h.id} onClick={()=>{setSelectedHdriId(h.id); localStorage.setItem("bowling.hdri",h.id);}} style={{textAlign:"left", border:"1px solid rgba(255,255,255,0.2)", borderRadius:10, padding:6, background:selectedHdriId===h.id?"rgba(127,214,255,0.2)":"rgba(255,255,255,0.05)", color:"#fff"}}><img src={h.thumb} alt={h.name} style={{width:"100%",borderRadius:8,marginBottom:6}} /><div style={{fontSize:11,fontWeight:700}}>{h.name}</div><div style={{fontSize:10,opacity:0.75}}>Owned</div></button>)}
          </div>
          <div style={{fontSize:12,fontWeight:800,margin:"10px 0 6px"}}>Table finish inventory</div>
          <div style={{display:"grid", gridTemplateColumns:"repeat(2,minmax(0,1fr))", gap:8}}>
            {TABLE_FINISH_ITEMS.filter((item)=> (ownedPoolInventory?.tableFinish||[]).includes(item.optionId)).map((item)=><button key={item.id} onClick={()=>{setSelectedTableFinish(item.optionId); localStorage.setItem("bowling.tableFinish",item.optionId);}} style={{textAlign:"left", border:"1px solid rgba(255,255,255,0.2)", borderRadius:10, padding:6, background:selectedTableFinish===item.optionId?"rgba(127,214,255,0.2)":"rgba(255,255,255,0.05)", color:"#fff"}}><div style={{fontSize:11,fontWeight:700}}>{item.name}</div></button>)}
          </div>
          <div style={{fontSize:12,fontWeight:800,margin:"10px 0 6px"}}>Chrome plates</div>
          <div style={{display:"grid", gridTemplateColumns:"repeat(2,minmax(0,1fr))", gap:8}}>
            {CHROME_ITEMS.filter((item)=> (ownedPoolInventory?.chromeColor||[]).includes(item.optionId)).map((item)=><button key={item.id} onClick={()=>{setSelectedChromeColor(item.optionId); localStorage.setItem("bowling.chromeColor",item.optionId);}} style={{textAlign:"left", border:"1px solid rgba(255,255,255,0.2)", borderRadius:10, padding:6, background:selectedChromeColor===item.optionId?"rgba(127,214,255,0.2)":"rgba(255,255,255,0.05)", color:"#fff"}}><div style={{fontSize:11,fontWeight:700}}>{POOL_ROYALE_OPTION_LABELS.chromeColor[item.optionId] || item.name}</div></button>)}
          </div>
          <label style={{display:"flex",alignItems:"center",gap:8,marginTop:10,fontSize:12}}>
            <input type="checkbox" checked={skipReplays} onChange={(e)=>{setSkipReplays(e.target.checked); localStorage.setItem("bowling.skipReplays", e.target.checked ? "1":"0");}} />
            Skip strike/spare replays
          </label>
        </div> : null}
        <div
          onPointerDown={(e)=>{ e.currentTarget.setPointerCapture(e.pointerId); setJoystickFromPointer(e); }}
          onPointerMove={(e)=>{ if (joystickRef.current.active) setJoystickFromPointer(e); }}
          onPointerUp={(e)=>{ try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {} stopJoystick(); }}
          onPointerCancel={stopJoystick}
          style={{ position:"absolute", left: 18, bottom: 74, width: 118, height: 118, borderRadius:"50%", background:"radial-gradient(circle at 50% 50%, rgba(125,211,252,0.2), rgba(15,23,42,0.78))", border:"1px solid rgba(125,211,252,0.42)", boxShadow:"0 12px 30px rgba(0,0,0,0.32)", pointerEvents:"auto", touchAction:"none" }}
        >
          <div style={{ position:"absolute", left:"50%", top:"50%", width: 54, height: 54, borderRadius:"50%", transform:`translate(calc(-50% + ${joystickKnob.x}px), calc(-50% + ${joystickKnob.y}px))`, background:"linear-gradient(135deg, #7dd3fc, #2563eb)", border:"2px solid rgba(255,255,255,0.72)", boxShadow:"0 8px 18px rgba(0,0,0,0.34)" }} />
          <div style={{ position:"absolute", left:0, right:0, bottom:-20, textAlign:"center", color:"#dff7ff", fontSize:10, fontWeight:900 }}>MOVE</div>
        </div>

        {pickupUiVisible ? <div style={{ position:"absolute", right: 12, bottom: 148, padding: 8, borderRadius: 16, display:"grid", gridTemplateColumns:"repeat(2, 46px)", gap: 8, pointerEvents:"auto", background:"rgba(5,8,14,0.72)", border:"1px solid rgba(125,211,252,0.36)", boxShadow:"0 12px 30px rgba(0,0,0,0.32)" }}>
          {BALL_VARIANTS.map((v)=><button key={`pickup-${v.label}`} onClick={()=>requestManualBallPickup(v.label)} style={{ width:46, height:46, borderRadius:"50%", border:selectedBallWeight===v.label?"2px solid #fff":"1px solid rgba(255,255,255,0.42)", background:`radial-gradient(circle at 32% 26%, ${v.colors[0]}, ${v.colors[1]} 52%, ${v.colors[2]})`, color:"#fff", fontSize:12, fontWeight:950, textShadow:"0 1px 3px rgba(0,0,0,0.8)", boxShadow:"0 8px 18px rgba(0,0,0,0.32)" }}>{v.label}</button>)}
          <div style={{ gridColumn:"1 / -1", textAlign:"center", color:"#dff7ff", fontSize:10, fontWeight:900 }}>PICK UP</div>
        </div> : null}

        <div
          onPointerDown={(e)=>{ e.currentTarget.setPointerCapture(e.pointerId); setSpinFromPointer(e); }}
          onPointerMove={(e)=>setSpinFromPointer(e)}
          onPointerUp={(e)=>{ try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {} }}
          onPointerCancel={(e)=>{ try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {} }}
          style={{ position:"absolute", right: 18, bottom: 74, width: 126, height: 64, borderRadius: 18, background:"linear-gradient(135deg, rgba(5,8,14,0.78), rgba(14,165,233,0.2))", border:"1px solid rgba(125,211,252,0.42)", boxShadow:"0 12px 30px rgba(0,0,0,0.28)", pointerEvents:"auto", touchAction:"none", padding: 10 }}
        >
          <div style={{ position:"absolute", left: 14, right: 14, top: 30, height: 5, borderRadius: 999, background:"linear-gradient(90deg, #f97316, #e5e7eb, #38bdf8)" }} />
          <div style={{ position:"absolute", left:"50%", top: 22, width: 34, height: 34, borderRadius:"50%", transform:`translateX(calc(-50% + ${spinKnob}px))`, background:"linear-gradient(135deg, #f8fafc, #38bdf8)", border:"2px solid rgba(255,255,255,0.82)", boxShadow:"0 8px 18px rgba(0,0,0,0.3)" }} />
          <div style={{ position:"absolute", left:0, right:0, bottom:-20, textAlign:"center", color:"#dff7ff", fontSize:10, fontWeight:900 }}>SPIN {spinControlRef.current >= 0 ? "+" : ""}{spinControlRef.current.toFixed(2)}</div>
        </div>

        <div style={{ position:"absolute", left: 12, right: 12, bottom: 16, padding:"9px 12px", borderRadius: 16, background:"linear-gradient(90deg, rgba(5,8,14,0.78), rgba(15,23,42,0.62))", border:"1px solid rgba(255,255,255,0.16)", color:"#fff", fontSize: 11, fontWeight: 800, pointerEvents:"none", display:"flex", justifyContent:"space-between", gap: 10 }}>
          <span>🕹 Move</span><span>👆 Drag screen to look</span><span>↕ Swipe at line</span><span>🌀 Spin</span>
        </div>
        {replayActive ? <button onClick={()=>setReplayActive(false)} style={{ position:"absolute", top: 132, right: 8, padding:"8px 10px", borderRadius: 10, border:"1px solid rgba(255,255,255,0.28)", background:"rgba(190,20,20,0.75)", color:"#fff", fontWeight:900, pointerEvents:"auto" }}>Skip replay</button> : null}

      </div>
    </div>
  );
}
