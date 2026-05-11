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
const HUMAN_INITIAL_SCALE = 0.96;
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
const PORTRAIT_AIM_ASSIST = 0.62;
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
  laneY: 0,
  laneHalfW: 1.82,
  gutterHalfW: 2.42,
  playerStartZ: 7.32,
  rackEdgeX: 1.06,
  rackStopZ: 6.66,
  approachStopZ: 4.82,
  foulZ: 4.55,
  arrowsZ: 0.95,
  pinDeckZ: -10.75,
  backStopZ: -13.15,
  ballR: 0.18,
  pinR: 0.17,
  pinToppleThreshold: 0.58,
  pinSpotSpacing: 0.56,
  approachDuration: 0.56,
  throwDuration: 0.9,
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
const BOWLING_LOUNGE_CENTER = new THREE.Vector3(-3.72, CFG.laneY, 7.52);
const RETURN_SAFE_WAYPOINT = new THREE.Vector3(1.46, CFG.laneY, 5.28);
const RETURN_PICKUP_POINT = new THREE.Vector3(CFG.rackEdgeX, CFG.laneY, CFG.rackStopZ);
const PLAYER_READY_POINT = new THREE.Vector3(1.18, CFG.laneY, CFG.playerStartZ);
const PLAYER_SEATS = [
  { pos: new THREE.Vector3(-3.82, CFG.laneY, 6.86), yaw: 0, stand: PLAYER_READY_POINT.clone() },
  { pos: new THREE.Vector3(-2.58, CFG.laneY, 6.86), yaw: 0, stand: new THREE.Vector3(-1.02, CFG.laneY, CFG.playerStartZ) },
];

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
    roughness: 0.34,
    metalness: 0.01,
    clearcoat: 0.42,
    clearcoatRoughness: 0.18,
    reflectivity: 0.48,
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
  return new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.38, metalness: 0.01, clearcoat: 0.35, clearcoatRoughness: 0.18 });
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

function makeFallbackHuman(color: number) {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xecc5a2, roughness: 0.82 });
  const shirt = new THREE.MeshStandardMaterial({ color, roughness: 0.72 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x1f232c, roughness: 0.84 });
  const shoes = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.56 });

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 18), skin);
  head.name = "head";
  head.position.y = 1.62;
  g.add(head);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.54, 6, 14), shirt);
  torso.name = "torso";
  torso.position.y = 1.05;
  g.add(torso);
  const leftLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.52, 4, 10), pants);
  leftLeg.name = "leftLeg";
  leftLeg.position.set(-0.12, 0.35, 0);
  g.add(leftLeg);
  const rightLeg = leftLeg.clone();
  rightLeg.name = "rightLeg";
  rightLeg.position.x = 0.12;
  g.add(rightLeg);
  const leftArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.42, 4, 10), skin);
  leftArm.name = "leftArm";
  leftArm.position.set(-0.32, 1.16, 0);
  leftArm.rotation.z = 0.22;
  g.add(leftArm);
  const rightArm = leftArm.clone();
  rightArm.name = "rightArm";
  rightArm.position.set(0.32, 1.16, 0.06);
  rightArm.rotation.z = -0.18;
  g.add(rightArm);
  const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.28), shoes);
  shoeL.name = "leftShoe";
  shoeL.position.set(-0.12, 0.03, -0.02);
  g.add(shoeL);
  const shoeR = shoeL.clone();
  shoeR.name = "rightShoe";
  shoeR.position.x = 0.12;
  g.add(shoeR);
  enableShadow(g);
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
  rig.fallback.visible = true;
  let cancelled = false;
  const tryLoad = (index: number) => {
    if (cancelled) return;
    if (index >= urls.length) {
      rig.fallback.visible = true;
      return;
    }
    loader.load(
      urls[index],
      (gltf) => {
        if (cancelled) return;
        const model = gltf.scene;
        normalizeHuman(model, 1.68);
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
    rig.model.position.x *= 0.3;
    rig.model.position.z *= 0.3;
    rig.model.rotation.x *= 0.65;
    rig.model.rotation.z *= 0.65;
  }
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
  let local = new THREE.Vector3(0.28, 0.72, 0.16);
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

function createActiveBall(variant: BallVariant) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(variant.radius, 80, 64), makeBallMaterial(variant.colors));
  enableShadow(mesh);
  const pos = new THREE.Vector3(0.38, CFG.laneY + 0.5, 6.48);
  mesh.position.copy(pos);
  return { mesh, pos, vel: new THREE.Vector3(), held: true, rolling: false, inGutter: false, hook: 0, returnState: "idle", returnT: 0, variant } as BallState;
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
  const s = CFG.pinSpotSpacing;
  const positions = [
    [0, 0],
    [-s * 0.57, -s], [s * 0.57, -s],
    [-s * 1.14, -s * 2], [0, -s * 2], [s * 1.14, -s * 2],
    [-s * 1.71, -s * 3], [-s * 0.57, -s * 3], [s * 0.57, -s * 3], [s * 1.71, -s * 3],
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

function clearFallenPins(pins: PinState[]) {
  for (const pin of pins) {
    const fallen = !pin.standing || pin.tilt >= CFG.pinToppleThreshold || pin.knocked;
    if (!fallen) continue;
    pin.root.visible = false;
    pin.vel.set(0, 0, 0);
    pin.angularVel = 0;
  }
}



type BowlingArenaDecor = {
  returnBalls: THREE.Mesh[];
  scoreboardPanels: THREE.Mesh[];
  crowdPulseLights: THREE.PointLight[];
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

function makeBowlingBallRack(colors: [string, string, string][], matFactory: (colors: [string, string, string]) => THREE.MeshPhysicalMaterial) {
  const rack = new THREE.Group();
  const railMat = new THREE.MeshPhysicalMaterial({ color: 0x101722, roughness: 0.48, metalness: 0.45, clearcoat: 0.55 });
  for (const y of [0.32, 0.62]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.06, 0.08), railMat);
    rail.position.set(0, y, -0.18);
    rack.add(rail);
  }
  for (const x of [-0.82, 0.82]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.72, 0.36), railMat);
    side.position.set(x, 0.36, -0.18);
    rack.add(side);
  }
  colors.forEach((colorset, i) => {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(CFG.ballR * (0.92 + (i % 3) * 0.04), 40, 30), matFactory(colorset));
    ball.position.set(-0.66 + i * 0.33 + Math.sin(i * 3.1) * 0.025, i % 2 ? 0.66 : 0.36, -0.2 + Math.cos(i * 1.7) * 0.025);
    ball.rotation.set(i * 0.37, i * 0.61, 0);
    rack.add(ball);
    const holeMat = new THREE.MeshBasicMaterial({ color: 0x020617, transparent: true, opacity: 0.82 });
    for (const [hx, hy] of [[-0.035, 0.12], [0.045, 0.11], [0.006, 0.045]]) {
      const hole = new THREE.Mesh(new THREE.CircleGeometry(0.018, 12), holeMat);
      hole.position.set(ball.position.x + hx, ball.position.y + hy, ball.position.z + CFG.ballR * 0.86);
      hole.rotation.y = Math.PI;
      rack.add(hole);
    }
  });
  enableShadow(rack);
  return rack;
}

function createEnvironment(scene: THREE.Scene, loader: THREE.TextureLoader, tableFinishId: string, chromeColorId: string): BowlingArenaDecor {
  const group = new THREE.Group();
  const decor: BowlingArenaDecor = { returnBalls: [], scoreboardPanels: [], crowdPulseLights: [] };
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
  const metalMat = new THREE.MeshPhysicalMaterial({ color: 0xcfd7e2, roughness: 0.11, metalness: 1, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.6 });
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x101216, roughness: 0.84 });
  if (chromeColorId === 'gold') metalMat.color.set('#d4af37');
  if (tableFinishId.includes('dark') || tableFinishId.includes('carbon')) (woodMat as THREE.MeshStandardMaterial).color.set('#3a2b23');
  if (tableFinishId.includes('rosewood')) (woodMat as THREE.MeshStandardMaterial).color.set('#6f3a2f');

  // Rebuild a believable indoor bowling shell while keeping HDRI visible through open architectural gaps.
  const carpetMat = new THREE.MeshStandardMaterial({ color: 0x20162c, roughness: 0.92, metalness: 0.01 });
  const aisleMat = new THREE.MeshStandardMaterial({ color: 0x151a24, roughness: 0.86, metalness: 0.02 });
  const architectureMat = new THREE.MeshStandardMaterial({ color: 0x151a23, roughness: 0.72, metalness: 0.06 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x222939, roughness: 0.82, metalness: 0.02 });
  const acousticMat = new THREE.MeshStandardMaterial({ color: 0x080b12, roughness: 0.9, metalness: 0.03 });
  const rubberMat = new THREE.MeshStandardMaterial({ color: 0x06070a, roughness: 0.88, metalness: 0.01 });
  const ledCyan = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.78, toneMapped: false });
  const ledAmber = new THREE.MeshBasicMaterial({ color: 0xffb86b, transparent: true, opacity: 0.68, toneMapped: false });

  const loungeCarpet = new THREE.Mesh(new THREE.PlaneGeometry(5.1, 4.8), carpetMat);
  loungeCarpet.rotation.x = -Math.PI / 2;
  loungeCarpet.position.set(BOWLING_LOUNGE_CENTER.x, CFG.laneY - 0.012, BOWLING_LOUNGE_CENTER.z);
  group.add(loungeCarpet);
  const rightCarpet = loungeCarpet.clone();
  rightCarpet.position.x = 4.55;
  group.add(rightCarpet);

  for (const x of [-6.15, 6.15]) {
    for (let i = 0; i < 6; i++) {
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 2.3), i % 2 ? ledAmber : ledCyan);
      led.position.set(x, 1.15 + (i % 3) * 0.42, 7.6 - i * 3.55);
      group.add(led);
    }
  }
  for (const x of [-4.95, 4.95]) {
    const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.7, 22.6), wallMat);
    sideWall.position.set(x, 1.22, -2.1);
    group.add(sideWall);
    const wainscot = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.52, 21.4), architectureMat);
    wainscot.position.set(x * 0.995, 0.28, -2.1);
    group.add(wainscot);
  }
  for (const x of [-3.15, 3.15]) {
    const neighborLane = new THREE.Mesh(new THREE.PlaneGeometry(CFG.laneHalfW * 1.72, 18.2, 24, 120), laneMat);
    neighborLane.rotation.x = -Math.PI / 2;
    neighborLane.position.set(x, CFG.laneY - 0.018, -4.08);
    neighborLane.receiveShadow = true;
    group.add(neighborLane);
    const neighborOil = new THREE.Mesh(
      new THREE.PlaneGeometry(CFG.laneHalfW * 1.52, 12.6),
      new THREE.MeshPhysicalMaterial({ color: 0xfff2d2, transparent: true, opacity: 0.022, roughness: 0.36, metalness: 0, clearcoat: 0.16, depthWrite: false })
    );
    neighborOil.rotation.x = -Math.PI / 2;
    neighborOil.position.set(x, CFG.laneY + 0.002, -2.9);
    group.add(neighborOil);
  }
  const backAisle = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 4.5), aisleMat);
  backAisle.rotation.x = -Math.PI / 2;
  backAisle.position.set(0, CFG.laneY - 0.026, 7.5);
  group.add(backAisle);
  const pinBackWall = new THREE.Mesh(new THREE.BoxGeometry(8.8, 2.65, 0.18), wallMat);
  pinBackWall.position.set(0, 1.3, CFG.backStopZ - 1.0);
  group.add(pinBackWall);
  const pinBackGlow = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.08, 0.05), ledCyan);
  pinBackGlow.position.set(0, 1.88, CFG.backStopZ - 0.86);
  group.add(pinBackGlow);
  for (const x of [-4.05, -2.05, 2.05, 4.05]) {
    const column = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.9, 0.28), architectureMat);
    column.position.set(x, 1.36, -2.05);
    group.add(column);
  }
  for (const z of [7.6, 4.4, 1.2, -2.0, -5.2, -8.4, -11.2]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(9.45, 0.12, 0.2), acousticMat);
    beam.position.set(0, 2.88, z);
    group.add(beam);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.035, 0.045), z % 2 ? ledAmber : ledCyan);
    strip.position.set(0, 2.78, z + 0.05);
    group.add(strip);
  }

  const approach = new THREE.Mesh(new THREE.PlaneGeometry(5.35, 4.55, 24, 24), woodMat);
  approach.rotation.x = -Math.PI / 2;
  approach.position.set(0, CFG.laneY - 0.006, 7.18);
  group.add(approach);
  const approachApron = new THREE.Mesh(new THREE.BoxGeometry(5.38, 0.035, 0.18), rubberMat);
  approachApron.position.set(0, CFG.laneY + 0.018, CFG.foulZ + 0.24);
  group.add(approachApron);
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(CFG.laneHalfW * 2, 19.55, 96, 360), laneMat);
  lane.rotation.x = -Math.PI / 2;
  lane.position.set(0, CFG.laneY, -4.52);
  lane.receiveShadow = true;
  group.add(lane);

  const boardLineMat = new THREE.MeshBasicMaterial({ color: 0x4b2e18, transparent: true, opacity: 0.18, depthWrite: false });
  for (let b = 1; b < LANE_BOARD_COUNT; b++) {
    const x = -CFG.laneHalfW + b * BOARD_WIDTH;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(0.005, 19.35), boardLineMat);
    board.rotation.x = -Math.PI / 2;
    board.position.set(x, CFG.laneY + 0.004, -4.52);
    group.add(board);
  }
  const boardNumberMat = new THREE.MeshBasicMaterial({ color: 0x1b365d, transparent: true, opacity: 0.38, depthWrite: false });
  for (const board of [5, 10, 15, 20, 25, 30, 35]) {
    const x = -CFG.laneHalfW + (board - 0.5) * BOARD_WIDTH;
    const dot = new THREE.Mesh(new THREE.CircleGeometry(board === 20 ? 0.035 : 0.026, 18), boardNumberMat);
    dot.rotation.x = -Math.PI / 2;
    dot.position.set(x, CFG.laneY + 0.014, CFG.foulZ - 0.72);
    group.add(dot);
  }
  const oil = new THREE.Mesh(
    new THREE.PlaneGeometry(CFG.laneHalfW * 2 - 0.12, 14.15),
    new THREE.MeshPhysicalMaterial({ color: 0xfff2d6, transparent: true, opacity: 0.045, roughness: 0.28, metalness: 0, clearcoat: 0.24, clearcoatRoughness: 0.32, reflectivity: 0.22, depthWrite: false })
  );
  oil.rotation.x = -Math.PI / 2;
  oil.position.set(0, CFG.laneY + 0.002, -3.05);
  group.add(oil);
  const scuffMat = new THREE.MeshBasicMaterial({ color: 0x2a160c, transparent: true, opacity: 0.12, depthWrite: false });
  for (let i = 0; i < 18; i++) {
    const scuff = new THREE.Mesh(new THREE.PlaneGeometry(0.018 + (i % 4) * 0.01, 0.42 + (i % 5) * 0.18), scuffMat);
    scuff.rotation.x = -Math.PI / 2;
    scuff.rotation.z = (i % 3 - 1) * 0.035;
    scuff.position.set(((i * 37) % 100 / 100 - 0.5) * CFG.laneHalfW * 1.55, CFG.laneY + 0.006, 2.9 - i * 0.58);
    group.add(scuff);
  }
  const deck = new THREE.Mesh(new THREE.BoxGeometry(CFG.laneHalfW * 2 + 0.7, 0.13, 2.75), woodMat);
  deck.position.set(0, CFG.laneY + 0.02, CFG.pinDeckZ - 0.75);
  group.add(deck);
  const gutterW = 0.44;
  const gutterX = CFG.laneHalfW + gutterW / 2 + 0.08;
  const gutterL = new THREE.Mesh(new THREE.BoxGeometry(gutterW, 0.12, 19.85), gutterMat);
  gutterL.position.set(-gutterX, CFG.laneY - 0.01, -4.52);
  group.add(gutterL);
  const gutterR = gutterL.clone();
  gutterR.position.x = gutterX;
  group.add(gutterR);
  const capL = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.2, 20.05), woodMat);
  capL.position.set(-CFG.gutterHalfW, CFG.laneY + 0.055, -4.52);
  group.add(capL);
  const capR = capL.clone();
  capR.position.x = CFG.gutterHalfW;
  group.add(capR);
  for (const x of [-CFG.gutterHalfW - 0.42, CFG.gutterHalfW + 0.42]) {
    const divider = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 18.6), rubberMat);
    divider.position.set(x, CFG.laneY + 0.055, -4.35);
    group.add(divider);
  }
  const foulLine = new THREE.Mesh(new THREE.BoxGeometry(CFG.laneHalfW * 2 + 0.14, 0.018, 0.055), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42 }));
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
  const spotMat = new THREE.MeshBasicMaterial({ color: 0x7f1d1d, transparent: true, opacity: 0.45, depthWrite: false });
  const pinS = CFG.pinSpotSpacing;
  for (const [x, dz] of [[0,0],[-pinS * 0.57,-pinS],[pinS * 0.57,-pinS],[-pinS * 1.14,-pinS * 2],[0,-pinS * 2],[pinS * 1.14,-pinS * 2],[-pinS * 1.71,-pinS * 3],[-pinS * 0.57,-pinS * 3],[pinS * 0.57,-pinS * 3],[pinS * 1.71,-pinS * 3]]) {
    const spot = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.105, 24), spotMat);
    spot.rotation.x = -Math.PI / 2;
    spot.position.set(x, CFG.laneY + 0.018, CFG.pinDeckZ + dz);
    group.add(spot);
  }
  const pinsetter = new THREE.Mesh(new THREE.BoxGeometry(4.9, 0.76, 1.42), metalMat);
  pinsetter.position.set(0, 0.36, CFG.backStopZ + 0.18);
  group.add(pinsetter);
  const maskingGlow = new THREE.Mesh(new THREE.BoxGeometry(4.58, 0.09, 0.08), new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.5 }));
  maskingGlow.position.set(0, 0.84, CFG.backStopZ + 0.88);
  group.add(maskingGlow);
  const pitCurtain = new THREE.Mesh(new THREE.BoxGeometry(4.72, 1.42, 0.1), new THREE.MeshStandardMaterial({ color: 0x05070c, roughness: 0.96, metalness: 0.04 }));
  pitCurtain.position.set(0, CFG.laneY + 0.5, CFG.backStopZ - 0.38);
  group.add(pitCurtain);
  const pitFloor = new THREE.Mesh(new THREE.BoxGeometry(4.86, 0.1, 1.05), rubberMat);
  pitFloor.position.set(0, CFG.laneY - 0.02, CFG.backStopZ + 0.18);
  group.add(pitFloor);
  const sweepBar = new THREE.Mesh(new THREE.BoxGeometry(3.86, 0.12, 0.16), metalMat);
  sweepBar.position.set(0, CFG.laneY + 0.42, CFG.pinDeckZ + 0.74);
  group.add(sweepBar);
  for (const x of [-2.52, 2.52]) {
    const kickback = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.72, 3.85), woodMat);
    kickback.position.set(x, CFG.laneY + 0.34, CFG.pinDeckZ - 0.96);
    group.add(kickback);
  }
  const machineryHousing = new THREE.Group();
  const housingMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.62, metalness: 0.25 });
  const hood = new THREE.Mesh(new THREE.BoxGeometry(5.75, 1.58, 1.45), housingMat);
  hood.position.set(0, 1.24, CFG.backStopZ + 0.06);
  machineryHousing.add(hood);
  const hoodLip = new THREE.Mesh(new THREE.BoxGeometry(5.9, 0.16, 0.18), rubberMat);
  hoodLip.position.set(0, 0.52, CFG.backStopZ + 0.83);
  machineryHousing.add(hoodLip);
  const upperMask = new THREE.Mesh(new THREE.BoxGeometry(5.92, 0.48, 0.16), acousticMat);
  upperMask.position.set(0, 2.24, CFG.backStopZ + 0.76);
  machineryHousing.add(upperMask);
  for (const x of [-1.7, 0, 1.7]) {
    const servicePanel = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.42, 0.035), new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.5, metalness: 0.45 }));
    servicePanel.position.set(x, 1.18, CFG.backStopZ + 0.67);
    machineryHousing.add(servicePanel);
  }
  group.add(machineryHousing);
  const laneFocusSign = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 0.42), makeCanvasTextMaterial("LUXE LANES", { width: 512, height: 96, accent: "#38bdf8" }));
  laneFocusSign.position.set(0, 2.5, CFG.backStopZ + 0.86);
  group.add(laneFocusSign);
  decor.scoreboardPanels.push(laneFocusSign);
  // Replaced the oversized title boards with a compact high mask/sign that frames pins without blocking gameplay.

  const lounge = new THREE.Group();
  lounge.position.copy(BOWLING_LOUNGE_CENTER);
  try {
    createMurlanStyleTable({
      THREE,
      arena: lounge,
      tableRadius: 0.82,
      tableHeight: 0.74,
      pedestalHeightScale: 0.86,
      includeBase: true,
    });
  } catch {
    const tableTop = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.08, 1.72), woodMat);
    tableTop.position.set(0, 0.76, 0);
    lounge.add(tableTop);
    const legGeom = new THREE.BoxGeometry(0.1, 0.7, 0.1);
    for (const sx of [-0.68, 0.68]) {
      for (const sz of [-0.7, 0.7]) {
        const leg = new THREE.Mesh(legGeom, blackMat);
        leg.position.set(sx, 0.37, sz);
        lounge.add(leg);
      }
    }
  }
  const snackMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.58 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x7dd3fc, roughness: 0.08, metalness: 0, transmission: 0.2, transparent: true, opacity: 0.72, clearcoat: 1 });
  const tabletMat = new THREE.MeshBasicMaterial({ color: 0x0ea5e9, transparent: true, opacity: 0.86, toneMapped: false });
  for (const [x, z, rot] of [[-0.34, -0.18, -0.18], [0.42, 0.22, 0.28]]) {
    const drink = makeDrink(glassMat);
    drink.position.set(x as number, 0.82, z as number);
    drink.rotation.y = rot as number;
    lounge.add(drink);
  }
  for (const [x, z] of [[-0.12, 0.34], [0.12, 0.38], [0.27, -0.32]]) {
    const snack = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.035, 0.09), snackMat);
    snack.position.set(x as number, 0.83, z as number);
    snack.rotation.y = (x as number) * 2.4;
    lounge.add(snack);
  }
  const tablet = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.025, 0.36), tabletMat);
  tablet.position.set(0.1, 0.835, -0.02);
  tablet.rotation.y = -0.36;
  lounge.add(tablet);
  const towel = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.018, 0.22), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.88 }));
  towel.position.set(-0.43, 0.835, 0.26);
  towel.rotation.y = 0.42;
  lounge.add(towel);

  const couchMat = new THREE.MeshPhysicalMaterial({ color: 0x172033, roughness: 0.5, metalness: 0.02, clearcoat: 0.25 });
  for (const [x, z, yaw] of [[-4.45, 7.2, Math.PI / 2], [4.45, 7.2, -Math.PI / 2], [-3.45, 8.95, 0], [3.45, 8.95, 0], [-2.35, 6.15, Math.PI * 0.08], [2.35, 6.15, -Math.PI * 0.08]]) {
    const couch = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.25, 0.66), couchMat);
    base.position.y = 0.38;
    couch.add(base);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.72, 0.16), couchMat);
    back.position.set(0, 0.76, 0.32);
    couch.add(back);
    const chrome = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.055, 0.08), metalMat);
    chrome.position.set(0, 0.18, -0.26);
    couch.add(chrome);
    couch.position.set(x as number, CFG.laneY, z as number);
    couch.rotation.y = yaw as number;
    group.add(couch);
  }

  const consoleMat = new THREE.MeshPhysicalMaterial({ color: 0x0b1220, roughness: 0.52, metalness: 0.18, clearcoat: 0.18 });
  const screenMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.72, toneMapped: false });
  for (const x of [-1.45, 1.45]) {
    const console = new THREE.Group();
    const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.72, 0.36), consoleMat);
    pedestal.position.y = 0.36;
    console.add(pedestal);
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.34, 0.05), screenMat);
    screen.position.set(0, 0.86, -0.12);
    screen.rotation.x = -0.22;
    console.add(screen);
    console.position.set(x, CFG.laneY, 5.84);
    console.rotation.y = x < 0 ? 0.18 : -0.18;
    group.add(console);
  }
  for (const [x, z] of [[-3.1, 7.6], [3.1, 7.6], [-4.18, 8.35], [4.18, 8.35]]) {
    const sideTable = new THREE.Group();
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.055, 28), woodMat);
    top.position.y = 0.58;
    sideTable.add(top);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.055, 0.55, 16), metalMat);
    stem.position.y = 0.3;
    sideTable.add(stem);
    const drink = makeDrink(new THREE.MeshPhysicalMaterial({ color: 0xf59e0b, roughness: 0.2, transparent: true, opacity: 0.75, clearcoat: 0.3 }));
    drink.position.set(0.08, 0.62, 0.02);
    sideTable.add(drink);
    sideTable.position.set(x as number, CFG.laneY, z as number);
    group.add(sideTable);
  }

  const chairFallbackMat = new THREE.MeshPhysicalMaterial({ color: 0x5f3d26, roughness: 0.42, metalness: 0.05, clearcoat: 0.35 });
  for (const seat of PLAYER_SEATS) {
    const chair = new THREE.Group();
    chair.position.copy(seat.pos);
    chair.rotation.y = seat.yaw + Math.PI;
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.12, 0.72), chairFallbackMat);
    pad.position.y = 0.43;
    chair.add(pad);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.86, 0.12), chairFallbackMat);
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
      model.scale.setScalar(1.05 / span);
      model.updateMatrixWorld(true);
      const box2 = new THREE.Box3().setFromObject(model);
      model.position.set(seat.pos.x - (box2.min.x + box2.max.x) / 2, CFG.laneY - box2.min.y, seat.pos.z - (box2.min.z + box2.max.z) / 2);
      model.rotation.y = seat.yaw + Math.PI;
      group.add(model);
      chair.visible = false;
    });
  }
  group.add(lounge);
  const loungeBoundary = new THREE.Mesh(
    new THREE.RingGeometry(1.46, 1.54, 48),
    new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.18, depthWrite: false })
  );
  loungeBoundary.rotation.x = -Math.PI / 2;
  loungeBoundary.position.set(BOWLING_LOUNGE_CENTER.x, CFG.laneY + 0.006, BOWLING_LOUNGE_CENTER.z);
  group.add(loungeBoundary);

  const returnShellMat = new THREE.MeshPhysicalMaterial({ color: 0x090b10, roughness: 0.82, metalness: 0.04, clearcoat: 0.08, clearcoatRoughness: 0.62 });
  const returnTrimMat = new THREE.MeshPhysicalMaterial({ color: 0x94a3b8, roughness: 0.36, metalness: 0.72, clearcoat: 0.22, envMapIntensity: 0.62 });
  const returnBase = new THREE.Mesh(new THREE.BoxGeometry(2.26, 0.25, 2.46), returnShellMat);
  returnBase.position.set(0, 0.125, 6.28);
  group.add(returnBase);
  const returnCover = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 2.14, 42, 1, false, 0, Math.PI), returnShellMat);
  returnCover.rotation.z = Math.PI / 2;
  returnCover.position.set(0, 0.36, 6.28);
  group.add(returnCover);
  const centerSlot = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.04, 1.88), new THREE.MeshBasicMaterial({ color: 0x020617, transparent: true, opacity: 0.84 }));
  centerSlot.position.set(0, CFG.laneY + 0.49, 6.22);
  group.add(centerSlot);
  for (const x of [-0.94, 0.94]) {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.13, 2.26), returnTrimMat);
    trim.position.set(x, CFG.laneY + 0.39, 6.28);
    group.add(trim);
  }
  const returnFloorPlate = new THREE.Mesh(new THREE.BoxGeometry(2.56, 0.035, 2.76), rubberMat);
  returnFloorPlate.position.set(0, CFG.laneY + 0.014, 6.28);
  group.add(returnFloorPlate);
  const channel = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.13, 10.45), returnShellMat);
  channel.position.set(0, 0.075, 1.12);
  group.add(channel);
  for (const x of [-0.33, 0.33]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.085, 10.45), returnTrimMat);
    rail.position.set(x, CFG.laneY + 0.22, 1.12);
    group.add(rail);
  }
  const returnLed = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.026, 0.04), ledCyan);
  returnLed.position.set(0, CFG.laneY + 0.54, 5.18);
  group.add(returnLed);
  const ballLift = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.38, 0.86, 42), returnTrimMat);
  ballLift.position.set(0, CFG.laneY + 0.22, 7.0);
  ballLift.rotation.z = Math.PI / 2;
  group.add(ballLift);
  const animatedReturnColors: [string, string, string][] = [
    ["#a7f3d0", "#059669", "#032d22"],
    ["#93c5fd", "#2563eb", "#0b1b4a"],
  ];
  animatedReturnColors.forEach((colors, i) => {
    const rb = new THREE.Mesh(new THREE.SphereGeometry(CFG.ballR * 0.92, 40, 30), makeBallMaterial(colors));
    rb.position.set(i ? 0.28 : -0.24, 0.36, 4.9 + i * 0.64);
    rb.userData.returnPhase = i * 0.5;
    decor.returnBalls.push(rb);
    group.add(rb);
  });

  const rackColors: [string, string, string][] = [
    ["#ffa3bf", "#cf245d", "#4f0822"],
    ["#9ee7ff", "#2d88ff", "#0d1d50"],
    ["#ffe59b", "#f57e09", "#5a2c00"],
    ["#c4b5fd", "#7c3aed", "#21104f"],
    ["#a7f3d0", "#059669", "#032d22"],
  ];
  const leftRack = makeBowlingBallRack(rackColors, makeBallMaterial);
  leftRack.position.set(-5.85, CFG.laneY, 6.18);
  leftRack.rotation.y = Math.PI / 2;
  group.add(leftRack);
  const rightRack = makeBowlingBallRack([...rackColors].reverse() as [string, string, string][], makeBallMaterial);
  rightRack.position.set(5.85, CFG.laneY, 6.18);
  rightRack.rotation.y = -Math.PI / 2;
  group.add(rightRack);
  for (const [x, z, color] of [[-4.9, 7.6, 0x38bdf8], [4.9, 7.6, 0xf472b6], [0, -10.9, 0xffb86b]]) {
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
  const spots = [
    { pos: [-4.45, 0, 7.18], yaw: Math.PI / 2, seated: true },
    { pos: [-3.45, 0, 8.92], yaw: 0, seated: true },
    { pos: [3.45, 0, 8.92], yaw: 0, seated: true },
    { pos: [4.45, 0, 7.18], yaw: -Math.PI / 2, seated: true },
    { pos: [-2.35, 0, 6.12], yaw: Math.PI * 0.08, seated: true },
    { pos: [2.35, 0, 6.12], yaw: -Math.PI * 0.08, seated: true },
    { pos: [-3.72, 0, 5.46], yaw: Math.PI * 0.82, seated: false },
    { pos: [-2.72, 0, 5.28], yaw: Math.PI * 0.92, seated: false },
    { pos: [2.95, 0, 5.34], yaw: -Math.PI * 0.92, seated: false },
    { pos: [3.82, 0, 5.52], yaw: -Math.PI * 0.82, seated: false },
    { pos: [-4.55, 0, 2.6], yaw: Math.PI * 0.62, seated: false },
    { pos: [4.55, 0, 2.52], yaw: -Math.PI * 0.62, seated: false },
  ];
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
      if (rig.model) {
        rig.model.position.set(0, -0.42 + wave * 0.008, -0.08);
        rig.model.rotation.set(-0.18 + (member.behavior === "clapping" ? Math.abs(wave) * 0.08 : 0), 0, 0.02 + wave * 0.015);
      }
      animateFallbackHuman(rig, "seat", member.phase);
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
    const phase = (elapsed * 0.26 + (ball.userData.returnPhase || 0)) % 1;
    ball.position.z = lerp(4.72, 6.38, phase);
    ball.position.x = lerp(-0.18, 0.42, phase) + Math.sin(phase * Math.PI * 2 + i) * 0.035;
    ball.rotation.x -= 0.08;
    ball.rotation.z += 0.045;
    ball.visible = phase < 0.88;
  });
  decor.scoreboardPanels.forEach((panel, i) => {
    panel.scale.setScalar(1 + Math.sin(elapsed * 2.2 + i) * (criticalPulse ? 0.018 : 0.006));
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

function computeIntent(hostWidth: number, hostHeight: number, startX: number, startY: number, x: number, y: number): ThrowIntent {
  const vertical = clamp((startY - y) / Math.max(180, hostHeight * 0.38), 0, 1);
  const startScreenX = clamp((startX / hostWidth) * 2 - 1, -1, 1);
  const dragX = clamp((x - startX) / Math.max(90, hostWidth * 0.18), -1, 1);
  const guidedX = clamp(startScreenX + dragX * PORTRAIT_AIM_ASSIST, -1, 1);
  const releaseX = clamp(guidedX * 0.92, -1.02, 1.02);
  const targetX = clamp(guidedX * 1.18, -1.26, 1.26);
  const power = vertical;
  const speed = lerp(6.2, 16.4, easeOutCubic(power));
  const hook = dragX * lerp(0.08, 0.68, power);
  return { power, releaseX, targetX, hook, speed };
}

function startApproach(rig: HumanRig, intent: ThrowIntent) {
  rig.action = "approach";
  rig.approachT = 0;
  rig.throwT = 0;
  rig.recoverT = 0;
  rig.walkCycle = 0;
  rig.approachFrom.copy(rig.pos);
  rig.approachTo.set(clamp(intent.releaseX * 0.34, -0.4, 0.4), CFG.laneY, CFG.approachStopZ);
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
    rig.pos.copy(nextPos);
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
      // right-handed form: left leg forward, right leg trail, left arm counter-balance

      rig.model.position.y = 0;
      rig.model.rotation.x = t < 0.55 ? lerp(0, 0.32, t / 0.55) : lerp(0.32, -0.1, (t - 0.55) / 0.45);
      rig.model.rotation.z = t < 0.45 ? lerp(0, -0.16, t / 0.45) : lerp(-0.16, 0.08, (t - 0.45) / 0.55);
      rig.model.rotation.y = t < 0.7 ? lerp(0, 0.22, t / 0.7) : lerp(0.22, 0.08, (t - 0.7) / 0.3);
      // left slide foot forward, right trail leg back (visual posture only).
      rig.model.position.x = t < CFG.releaseT ? lerp(0, -0.08, t / CFG.releaseT) : lerp(-0.08, -0.02, (t - CFG.releaseT) / (1 - CFG.releaseT));
      rig.model.position.z = t < CFG.releaseT ? lerp(0, -0.11, t / CFG.releaseT) : lerp(-0.11, -0.03, (t - CFG.releaseT) / (1 - CFG.releaseT));
      const rightHand = findRightHand(rig.model) as THREE.Object3D | null;
      if (rightHand) {
        if (t < CFG.releaseT) {
          const k = easeInOut(t / CFG.releaseT);
          rightHand.rotation.x = lerp(0.18, -1.8, k);
        } else {
          const k = easeOutCubic((t - CFG.releaseT) / (1 - CFG.releaseT));
          rightHand.rotation.x = lerp(-1.8, 0.72, k);
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
      rig.action = "toRack";
      rig.returnWalkT = 0.001;
    }
  } else if (rig.action === "toRack") {
    rig.returnWalkT = clamp01(rig.returnWalkT + dt / CFG.returnWalkDuration);
    rig.walkCycle += dt * 9.2;
    const k = easeInOut(rig.returnWalkT);
    const nextPos = k < 0.55
      ? new THREE.Vector3().lerpVectors(rig.approachTo, RETURN_SAFE_WAYPOINT, easeInOut(k / 0.55))
      : new THREE.Vector3().lerpVectors(RETURN_SAFE_WAYPOINT, RETURN_PICKUP_POINT, easeInOut((k - 0.55) / 0.45));
    smoothFacing(rig, nextPos, dt);
    rig.pos.copy(nextPos);
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
      rig.model.position.y = lerp(0, -0.14, 1 - k);
      rig.model.rotation.x = lerp(0.22, -0.08, k);
      rig.model.rotation.z = lerp(-0.06, 0.02, k);
    }
    if (rig.pickT >= 1 && canStartReturnCycle) { rig.action = "toApproach"; rig.returnWalkT = 0.001; }
  } else if (rig.action === "toApproach") {
    rig.returnWalkT = clamp01(rig.returnWalkT + dt / CFG.returnWalkDuration);
    rig.walkCycle += dt * 9.2;
    const k = easeInOut(rig.returnWalkT);
    const nextPos = k < 0.45
      ? new THREE.Vector3().lerpVectors(RETURN_PICKUP_POINT, RETURN_SAFE_WAYPOINT, easeInOut(k / 0.45))
      : new THREE.Vector3().lerpVectors(RETURN_SAFE_WAYPOINT, PLAYER_READY_POINT, easeInOut((k - 0.45) / 0.55));
    smoothFacing(rig, nextPos, dt);
    rig.pos.copy(nextPos);
    if (rig.model) {
      const swing = Math.sin(rig.walkCycle) * 0.18;
      const turnLean = clamp(rig.yawVelocity * 0.003, -0.1, 0.1);
      rig.model.rotation.y = swing * 0.18;
      rig.model.rotation.z = -swing * 0.06 - turnLean;
      rig.model.position.y = Math.abs(Math.sin(rig.walkCycle)) * 0.05;
    }
    animateFallbackHuman(rig, "walk", rig.walkCycle);
    if (rig.returnWalkT >= 1) rig.action = "idle";
  } else if (rig.model) {
    const idleWave = Math.sin(performance.now() * 0.0018 + rig.pos.x) * 0.5 + 0.5;
    rig.model.position.y = lerp(rig.model.position.y || 0, 0.012 + idleWave * 0.012, 0.08);
    rig.model.rotation.x *= 0.82;
    rig.model.rotation.z = lerp(rig.model.rotation.z, (idleWave - 0.5) * 0.035, 0.06);
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

function releaseBall(ball: BallState, intent: ThrowIntent) {
  const releasePos = new THREE.Vector3(intent.releaseX, CFG.laneY + ball.variant.radius + 0.02, CFG.foulZ - 0.16);
  const target = new THREE.Vector3(intent.targetX, CFG.laneY + ball.variant.radius + 0.02, CFG.pinDeckZ + 0.4);
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
      ball.pos.set(0, CFG.laneY + 0.23, 1.1);
      ball.mesh.position.copy(ball.pos);
    }
    return false;
  }
  if (ball.returnState === "returning") {
    ball.returnT += dt / 1.5;
    const t = easeOutCubic(clamp01(ball.returnT));
    ball.pos.set(lerp(0, 0.38, t), CFG.laneY + lerp(0.23, 0.5, t), lerp(1.1, 6.48, t));
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
  ball.inGutter = Math.abs(ball.pos.x) > CFG.laneHalfW;
  if (!ball.inGutter && flatSpeed > 0.85) {
    const oil = oilRatioAt(ball.pos.z);
    const dryBoards = clamp01((Math.abs(ball.pos.x) - CFG.laneHalfW * 0.34) / (CFG.laneHalfW * 0.55));
    const downLane = 1 - oil;
    const hookPhase = clamp01(downLane * 0.78 + dryBoards * 0.42);
    const hookGain = lerp(0.42, 1.62, clamp01(flatSpeed / 16)) * (0.55 + dryBoards * 0.72);
    ball.vel.x += ball.hook * hookPhase * hookGain * dt;
  }
  const oil = ball.inGutter ? 0 : oilRatioAt(ball.pos.z);
  const dryDrag = clamp01((Math.abs(ball.pos.x) - CFG.laneHalfW * 0.46) / (CFG.laneHalfW * 0.5));
  const drag = ball.inGutter ? 1.28 : lerp(0.22, 0.58, 1 - oil) + dryDrag * 0.2;
  ball.vel.multiplyScalar(Math.exp(-drag * dt));
  ball.pos.addScaledVector(ball.vel, dt);
  if (Math.abs(ball.pos.x) > CFG.gutterHalfW) {
    ball.pos.x = clamp(ball.pos.x, -CFG.gutterHalfW, CFG.gutterHalfW);
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


function getHumanFaceCameraPose(player: HumanRig) {
  const shoulderOffset = new THREE.Vector3(0.72, 2.06, 4.75);
  const laneLook = new THREE.Vector3(clamp(player.pos.x * 0.16, -0.32, 0.32), CFG.laneY + 0.58, CFG.pinDeckZ - 0.48);
  return {
    desired: player.pos.clone().add(shoulderOffset),
    look: laneLook,
  };
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
  } else if (player.action === "pickBall") {
    desired = player.pos.clone().add(new THREE.Vector3(0, 2.7, 5.6));
    look = player.pos.clone().add(new THREE.Vector3(0, 0.96, -0.8));
  } else if (player.action === "approach" || player.action === "throw" || player.action === "recover") {
    const facePose = getHumanFaceCameraPose(player);
    desired = facePose.desired;
    look = facePose.look;
  } else if (player.action === "toRack" || player.action === "toApproach" || player.action === "standingUp") {
    desired = player.pos.clone().add(new THREE.Vector3(0, 2.2, 3.2));
    look = player.pos.clone().add(new THREE.Vector3(0, 0.78, -1.6));
  } else {
    const sway = Math.sin(performance.now() * 0.0007) * 0.045;
    desired = new THREE.Vector3(0.14 + sway, 2.66, 11.85);
    look = new THREE.Vector3(0, CFG.laneY + 0.56, -4.65);
  }
  camera.position.lerp(desired, 1 - Math.exp(-4.4 * dt));
  const currentLook = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).multiplyScalar(8).add(camera.position);
  currentLook.lerp(look, 1 - Math.exp(-6.2 * dt));
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
  const [hud, setHud] = useState<HudState>({ power: 0, status: "Swipe up to bowl", compliment: "", activePlayer: 0, p1: 0, p2: 0, frame: 1, roll: 1, rule: BOWLING_RULE_SUMMARY, lane: "Board 20 · house shot" });
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
  const scoresMemo = useMemo(() => scores, [scores]);


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
    renderer.toneMappingExposure = graphicsQuality === "ultra" ? 0.96 : graphicsQuality === "performance" ? 0.84 : 0.9;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070a12);
    scene.fog = new THREE.FogExp2(0x090b11, 0.026);

    const camera = new THREE.PerspectiveCamera(51, 1, 0.05, 80);
    camera.position.set(0, 2.9, 10.8);

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
            const selectedRotation = Number.isFinite(selected?.rotationY) ? selected.rotationY : 0;
            if ("backgroundRotation" in scene) scene.backgroundRotation.set(0, selectedRotation, 0);
            if ("environmentRotation" in scene) scene.environmentRotation.set(0, selectedRotation, 0);
            if ("backgroundBlurriness" in scene) scene.backgroundBlurriness = 0;
            if ("backgroundIntensity" in scene) scene.backgroundIntensity = graphicsQuality === "ultra" ? 0.82 : graphicsQuality === "performance" ? 0.62 : 0.72;
            if ("environmentIntensity" in scene) scene.environmentIntensity = graphicsQuality === "performance" ? 0.58 : graphicsQuality === "ultra" ? 0.86 : 0.72;
          },
          undefined,
          () => tryLoad(idx + 1)
        );
      };
      tryLoad(0);
    };
    applyHdri(selectedHdriId);

    scene.add(new THREE.AmbientLight(0x788db6, 0.08));
    scene.add(new THREE.HemisphereLight(0xffe0bb, 0x15192a, 0.28));
    const key = new THREE.DirectionalLight(0xffecd6, 2.25);
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
    const fill = new THREE.DirectionalLight(0x7dd3fc, 0.18);
    fill.position.set(4.4, 4.8, 6.3);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xff9a45, 1.24);
    rim.position.set(3.8, 4.6, -12.4);
    scene.add(rim);
    for (let i = 0; i < 6; i++) {
      const z = lerp(6.5, -11.7, i / 5);
      const light = new THREE.PointLight(0xffefdc, 0.5, 10.8, 1.9);
      light.position.set(i % 2 === 0 ? -1.12 : 1.12, 2.8, z);
      scene.add(light);
    }

    const texLoader = new THREE.TextureLoader();
    const arenaDecor = createEnvironment(scene, texLoader, selectedTableFinish, selectedChromeColor);
    const pins = createPins(scene);
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
    let waitingForBallReturn = false;
    let pendingIntent: ThrowIntent | null = null;
    let shotResolved = false;
    let nextAction: "samePlayer" | "nextPlayer" | "gameOver" = "samePlayer";
    let shouldResetRackBeforeNextRoll = false;
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
      if (shouldResetRackBeforeNextRoll || nextAction === "nextPlayer") resetPins(pins);
      shouldResetRackBeforeNextRoll = false;
      const previousPlayer = player;
      player = playerRigs[activePlayer];
      if (previousPlayer !== player) seatRigAfterTurn(previousPlayer);
      resetPlayerPoseForNextBall();
      if (previousPlayer !== player) standRigForTurn(player);
      syncReactScores();
      aiTurnDelay = activePlayer === 1 ? 0.85 + Math.random() * 0.5 : 0.85;
      const playerName = localScores[activePlayer].name;
      setHud((prev) => ({ ...prev, status: nextAction === "gameOver" ? "Game over" : activePlayer === 1 ? `${playerName} is choosing a line…` : `${playerName} swipe up to bowl` }));
    };

    const finalizeShot = () => {
      clearFallenPins(pins);
      const afterStanding = standingPinsCount(pins);
      const knocked = clamp(lastShotStandingBefore - afterStanding, 0, 10);
      const playerBefore = localScores[activePlayer];
      const result = addRollToPlayer(playerBefore, knocked);
      const rollRead = describeRollResult(playerBefore, result, knocked);
      let status = `${playerBefore.name} knocked ${knocked} pin${knocked === 1 ? "" : "s"}`;
      let compliment: string = RESULT_COMPLIMENTS.open[Math.floor(Math.random()*RESULT_COMPLIMENTS.open.length)];
      const strike = rollRead.isStrike;
      const spare = rollRead.isSpare;
      shouldResetRackBeforeNextRoll = result.resetPins;
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
      return { power, releaseX, targetX, hook: (Math.random() - 0.5) * 0.32, speed: lerp(10.8, 15.4, power) };
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
      camera.fov = camera.aspect < 0.72 ? 52 : 46;
      camera.updateProjectionMatrix();
    };

    const onPointerDown = (e: PointerEvent) => {
      if (nextAction === "gameOver") return;
      if (control.active || ball.rolling || waitingForBallReturn || replayActive) return;
      if (activePlayer !== 0 || player !== playerRigs[0]) return;
      if (player.action !== "idle") return;
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
      setHud((prev) => ({ ...prev, power: control.intent!.power, lane: `Aim board ${boardNumberFromX(control.intent!.targetX)} · ${Math.round(control.intent!.power * 100)}% power` }));
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
      setHud((prev) => ({ ...prev, power: 0, status: "Four-step approach · release before foul line", rule: "Release must stay behind the foul line", lane: `Target board ${boardNumberFromX(intent.targetX)} · hook ${intent.hook >= 0 ? "right" : "left"}` }));
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
          pendingIntent = makeAiIntent();
          startApproach(player, pendingIntent);
          aiTurnDelay = 0.85 + Math.random() * 0.5;
          setHud((prev) => ({ ...prev, status: "PLAYER 2 AI is bowling" }));
        }
      }
      const criticalPulse = replayTimer > 0 || player.celebrateNext;
      for (const rig of playerRigs) updateHuman(rig, ball, dt, rig === player);
      updateDominoBowlingCrowd(crowdMembers, dt, criticalPulse);
      updateArenaDecor(arenaDecor, now * 0.001, criticalPulse);
      if (player.action === "throw" && pendingIntent && player.throwT >= CFG.releaseT && ball.held) {
        lastShotStandingBefore = standingPinsCount(pins);
        releaseBall(ball, pendingIntent);
        pendingIntent = null;
        setHud((prev) => ({ ...prev, status: "Ball rolling" }));
      }
      updateBall(ball, pins, dt);
      const pinsMoving = updatePins(pins, dt);
      const mechanismBusy = ball.returnState !== "idle" || ball.rolling || pinsMoving;
      if ((player.action === "pickBall" || player.action === "toApproach") && mechanismBusy) {
        player.action = "pickBall";
      }
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
  }, [graphicsQuality, selectedHdriId, selectedBallWeight, selectedTableFinish, selectedChromeColor, selectedHumanCharacterId, replayActive, skipReplays]);

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#090b11", touchAction: "none", userSelect: "none" }}>
      <div ref={hostRef} style={{ position: "absolute", inset: 0 }}>
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }} />
      </div>

      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif" }}>
        <div style={{ position: "absolute", left: 20, right: 20, top: 6, color: "white", background: "rgba(5,8,14,0.58)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 13, padding: "5px 6px 7px", boxShadow: "0 8px 20px rgba(0,0,0,0.22)", backdropFilter: "blur(10px)", transform: "scale(0.82)", transformOrigin: "top center" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 0.2 }}>REAL BOWLING SCOREBOARD</div>
            <div style={{ fontSize: 9, fontWeight: 800, color: "#7fd6ff" }}>FRAME {hud.frame} · ROLL {hud.roll} · P{hud.activePlayer + 1}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "44px repeat(10, minmax(22px, 1fr))", gap: 3, alignItems: "center" }}>
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
          <div style={{ marginTop: 4, display: "grid", gridTemplateColumns: "0.75fr 1.25fr", gap: 5, fontSize: 7, fontWeight: 800 }}>
            <div style={{ padding: "3px 5px", borderRadius: 7, background: "rgba(14,165,233,0.13)", border: "1px solid rgba(125,211,252,0.16)" }}>{hud.lane}</div>
            <div style={{ padding: "3px 5px", borderRadius: 7, background: "rgba(34,197,94,0.11)", border: "1px solid rgba(134,239,172,0.16)" }}>{hud.rule}</div>
          </div>
          {hud.compliment ? <div style={{ marginTop: 4, textAlign: "center", fontSize: 10, fontWeight: 800, color: "#86efac" }}>{hud.compliment}</div> : null}
        </div>

        <button onClick={() => setMenuOpen((v)=>!v)} style={{ position:"absolute", top: 96, left: 8, width: 40, height:40, borderRadius: 10, border:"1px solid rgba(255,255,255,0.28)", background:"rgba(5,8,14,0.72)", color:"#fff", fontSize:22, fontWeight:900, pointerEvents:"auto" }}>☰</button>
        {menuOpen ? <div style={{ position:"absolute", top: 142, left: 8, right: 8, maxHeight:"48vh", overflow:"auto", borderRadius: 14, padding: 10, background:"rgba(5,8,14,0.88)", border:"1px solid rgba(255,255,255,0.18)", pointerEvents:"auto" }}>
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
        <div style={{ position:"absolute", left: 12, right: 12, bottom: 16, padding:"9px 12px", borderRadius: 16, background:"linear-gradient(90deg, rgba(5,8,14,0.78), rgba(15,23,42,0.62))", border:"1px solid rgba(255,255,255,0.16)", color:"#fff", fontSize: 11, fontWeight: 800, pointerEvents:"none", display:"flex", justifyContent:"space-between", gap: 10 }}>
          <span>↕ Swipe power</span><span>↔ Aim boards</span><span>🎳 Follow-through</span>
        </div>
        {replayActive ? <button onClick={()=>setReplayActive(false)} style={{ position:"absolute", top: 132, right: 8, padding:"8px 10px", borderRadius: 10, border:"1px solid rgba(255,255,255,0.28)", background:"rgba(190,20,20,0.75)", color:"#fff", fontWeight:900, pointerEvents:"auto" }}>Skip replay</button> : null}

      </div>
    </div>
  );
}
