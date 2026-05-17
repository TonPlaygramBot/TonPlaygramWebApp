"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { useLocation } from "react-router-dom";
import { MURLAN_CHARACTER_THEMES } from "../../config/murlanCharacterThemes.js";
import { BallController } from "./tennis/BallController";
import { CameraController } from "./tennis/CameraController";
import { CourtRules } from "./tennis/CourtRules";
import { AIController } from "./tennis/AIController";
import { AudioVFXManager } from "./tennis/AudioVFXManager";
import { PlayerController } from "./tennis/PlayerController";
import { ScoreManager } from "./tennis/ScoreManager";
import { ServeController } from "./tennis/ServeController";
import { ShotTargeting } from "./tennis/ShotTargeting";
import { UIOverlay } from "./tennis/UIOverlay";
import { gameConfig, TennisBallState } from "./tennis/gameConfig";

type PlayerSide = "near" | "far";
type PointReason = "winner" | "out" | "doubleBounce" | "net" | "serviceFault" | "doubleFault";
type StrokeAction = "ready" | "forehand" | "backhand" | "serve";

type BallState = {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  spin: number;
  lastHitBy: PlayerSide | null;
  bounceSide: PlayerSide | null;
  bounceCount: number;
  state: TennisBallState;
};

type ShotTechnique = "flat" | "topspin" | "slice" | "lob" | "drop" | "block";

type DesiredHit = { target: THREE.Vector3; power: number; technique?: ShotTechnique; swipeDir?: THREE.Vector2; serveSide?: "deuce" | "ad" };

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

type CharacterTheme = {
  id?: string;
  label?: string;
  url?: string;
  modelUrls?: string[];
  clothCombo?: string;
  hairColor?: number;
  eyeColor?: number;
  skinTone?: number;
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
  walkCycle: number;
  yawVelocity: number;
};

type HudState = { nearScore: number; farScore: number; nearLabel?: string; farLabel?: string; nearGames?: number; farGames?: number; status: string; power: number; server?: PlayerSide; serveSide?: "deuce" | "ad"; firstServe?: boolean; debug?: string };

type ControlState = {
  active: boolean;
  pointerId: number | null;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  startPlayer: THREE.Vector3;
  startTs: number;
  lastTs: number;
};

const HUMAN_URL = "https://threejs.org/examples/models/gltf/readyplayer.me.glb";
const COURT_ENVIRONMENT_ASSETS = [
  {
    name: "courtside-chair",
    source: "Khronos glTF Sample Assets Chair Damask Purplegold (CC BY 4.0)",
    url: "https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/ChairDamaskPurplegold/glTF-Binary/ChairDamaskPurplegold.glb",
    position: new THREE.Vector3(-1, 0, 0),
    rotationY: Math.PI / 2,
    scale: 1.15,
  },
  {
    name: "warmup-boombox",
    source: "Khronos glTF Sample Assets Boom Box (CC0)",
    url: "https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/BoomBox/glTF-Binary/BoomBox.glb",
    position: new THREE.Vector3(1, 0, 0),
    rotationY: -Math.PI / 2,
    scale: 0.0085,
  },
  {
    name: "potted-plant",
    source: "Khronos glTF Sample Assets Diffuse Transmission Plant (CC BY 4.0 / CC0 original)",
    url: "https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/DiffuseTransmissionPlant/glTF-Binary/DiffuseTransmissionPlant.glb",
    position: new THREE.Vector3(0, 0, -1),
    rotationY: -Math.PI / 5,
    scale: 0.72,
  },
] as const;
const UP = new THREE.Vector3(0, 1, 0);
const Y_AXIS = UP;

const CFG = gameConfig;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const clamp01 = (v: number) => clamp(v, 0, 1);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => t * t * (3 - 2 * t);
const sideOfZ = (z: number): PlayerSide => (z >= 0 ? "near" : "far");
const opposite = (side: PlayerSide): PlayerSide => (side === "near" ? "far" : "near");


function serviceSideFromPoints(nearScore: number, farScore: number): "deuce" | "ad" {
  return (nearScore + farScore) % 2 === 0 ? "deuce" : "ad";
}

function serveXForSide(player: PlayerSide, side: "deuce" | "ad") {
  const outsideSingles = CFG.courtW / 2 + 0.42;
  const laneMax = CFG.doublesW / 2 - 0.2;
  const xAbs = clamp(outsideSingles, CFG.courtW / 2 + 0.12, laneMax);
  const sign = side === "deuce" ? 1 : -1;
  return (player === "near" ? sign : -sign) * xAbs;
}


function serveLaneBoundsX(side: "deuce" | "ad", player: PlayerSide = "near") {
  const laneMinAbs = CFG.courtW / 2 + 0.12;
  const laneMaxAbs = CFG.doublesW / 2 - 0.12;
  const sign = side === "deuce" ? 1 : -1;
  const playerAdjusted = player === "near" ? sign : -sign;
  return playerAdjusted > 0 ? { min: laneMinAbs, max: laneMaxAbs } : { min: -laneMaxAbs, max: -laneMinAbs };
}

function serveTargetBoundsX(side: "deuce" | "ad", server: PlayerSide) {
  const sign = side === "deuce" ? (server === "near" ? 1 : -1) : (server === "near" ? -1 : 1);
  const minAbs = CFG.serviceBuffer;
  const maxAbs = CFG.courtW / 2 - 0.46;
  return sign > 0 ? { min: minAbs, max: maxAbs } : { min: -maxAbs, max: -minAbs };
}

function isInsideServiceBox(pos: THREE.Vector3, hitter: PlayerSide, side: "deuce" | "ad") {
  const targetSide = opposite(hitter);
  const targetRight = side === "deuce";
  const xOk = targetRight ? pos.x >= 0 + CFG.serviceBuffer : pos.x <= 0 - CFG.serviceBuffer;
  const xInCourt = Math.abs(pos.x) <= CFG.courtW / 2;
  const zOk = targetSide === "far" ? pos.z <= -CFG.serviceBuffer && pos.z >= -CFG.serviceLineZ : pos.z >= CFG.serviceBuffer && pos.z <= CFG.serviceLineZ;
  return xOk && xInCourt && zOk;
}
function material(color: number, roughness = 0.74, metalness = 0.02) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function transparentMaterial(color: number, opacity: number, roughness = 0.72) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02, transparent: true, opacity, depthWrite: false });
}


type TennisClothSlot = { material: keyof typeof POLYHAVEN_CLOTH_MATERIALS; tint: number; repeat: number };
type TennisClothCombo = { upper: TennisClothSlot; lower: TennisClothSlot; accent: TennisClothSlot };
type TennisClothTexture = {
  source: string;
  gltf: string;
  color: string;
  normal: string;
  roughness: string;
  tint: number;
  repeat: number;
};

const POLYHAVEN_CLOTH_MATERIALS = Object.freeze({
  denim: {
    source: "Poly Haven denim_fabric 1k glTF CC0",
    gltf: "https://dl.polyhaven.org/file/ph-assets/Textures/gltf/1k/denim_fabric/denim_fabric_1k.gltf",
    color: "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/denim_fabric/denim_fabric_diff_1k.jpg",
    normal: "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/denim_fabric/denim_fabric_nor_gl_1k.jpg",
    roughness: "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/denim_fabric/denim_fabric_rough_1k.jpg",
    tint: 0x314d86,
  },
  check: {
    source: "Poly Haven gingham_check 1k glTF CC0",
    gltf: "https://dl.polyhaven.org/file/ph-assets/Textures/gltf/1k/gingham_check/gingham_check_1k.gltf",
    color: "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/gingham_check/gingham_check_diff_1k.jpg",
    normal: "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/gingham_check/gingham_check_nor_gl_1k.jpg",
    roughness: "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/gingham_check/gingham_check_rough_1k.jpg",
    tint: 0x9f3651,
  },
  hessian: {
    source: "Poly Haven hessian_230 1k glTF CC0",
    gltf: "https://dl.polyhaven.org/file/ph-assets/Textures/gltf/1k/hessian_230/hessian_230_1k.gltf",
    color: "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/hessian_230/hessian_230_diff_1k.jpg",
    normal: "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/hessian_230/hessian_230_nor_gl_1k.jpg",
    roughness: "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/hessian_230/hessian_230_rough_1k.jpg",
    tint: 0xa27445,
  },
  floral: {
    source: "Poly Haven floral_jacquard 1k glTF CC0",
    gltf: "https://dl.polyhaven.org/file/ph-assets/Textures/gltf/1k/floral_jacquard/floral_jacquard_1k.gltf",
    color: "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/floral_jacquard/floral_jacquard_diff_1k.jpg",
    normal: "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/floral_jacquard/floral_jacquard_nor_gl_1k.jpg",
    roughness: "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/floral_jacquard/floral_jacquard_rough_1k.jpg",
    tint: 0x6d3f7f,
  },
  fleece: {
    source: "Poly Haven knitted_fleece 1k glTF CC0",
    gltf: "https://dl.polyhaven.org/file/ph-assets/Textures/gltf/1k/knitted_fleece/knitted_fleece_1k.gltf",
    color: "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/knitted_fleece/knitted_fleece_diff_1k.jpg",
    normal: "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/knitted_fleece/knitted_fleece_nor_gl_1k.jpg",
    roughness: "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/knitted_fleece/knitted_fleece_rough_1k.jpg",
    tint: 0x4b5563,
  },
  picnic: {
    source: "Poly Haven fabric_pattern_07 1k glTF CC0",
    gltf: "https://dl.polyhaven.org/file/ph-assets/Textures/gltf/1k/fabric_pattern_07/fabric_pattern_07_1k.gltf",
    color: "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/fabric_pattern_07/fabric_pattern_07_col_1_1k.jpg",
    normal: "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/fabric_pattern_07/fabric_pattern_07_nor_gl_1k.jpg",
    roughness: "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/fabric_pattern_07/fabric_pattern_07_rough_1k.jpg",
    tint: 0xc44f42,
  },
} as const);

const TENNIS_CHARACTER_CLOTH_COMBOS: Record<string, TennisClothCombo> = Object.freeze({
  royalDenim: {
    upper: { material: "denim", tint: 0x2f5f9f, repeat: 4.2 },
    lower: { material: "hessian", tint: 0x9b6b3f, repeat: 3.4 },
    accent: { material: "fleece", tint: 0xd8dee9, repeat: 5.0 },
  },
  casinoCheck: {
    upper: { material: "check", tint: 0xb7375d, repeat: 3.8 },
    lower: { material: "denim", tint: 0x243e70, repeat: 4.4 },
    accent: { material: "hessian", tint: 0xf4d7a1, repeat: 3.2 },
  },
  linenStreet: {
    upper: { material: "hessian", tint: 0xb68452, repeat: 3.6 },
    lower: { material: "fleece", tint: 0x374151, repeat: 5.2 },
    accent: { material: "denim", tint: 0x4a6fa4, repeat: 4.0 },
  },
  jacquardNight: {
    upper: { material: "floral", tint: 0x7c3f88, repeat: 3.2 },
    lower: { material: "denim", tint: 0x1f335f, repeat: 4.5 },
    accent: { material: "check", tint: 0xe3c16f, repeat: 4.0 },
  },
  softFleece: {
    upper: { material: "fleece", tint: 0x556070, repeat: 5.3 },
    lower: { material: "hessian", tint: 0x8b633f, repeat: 3.7 },
    accent: { material: "floral", tint: 0xb88ab8, repeat: 3.0 },
  },
  patternedRed: {
    upper: { material: "picnic", tint: 0xc44f42, repeat: 3.4 },
    lower: { material: "denim", tint: 0x263f73, repeat: 4.7 },
    accent: { material: "fleece", tint: 0xf1f5f9, repeat: 5.0 },
  },
  mixedDenim: {
    upper: { material: "denim", tint: 0x3b6ea8, repeat: 4.0 },
    lower: { material: "check", tint: 0x4f6f93, repeat: 4.2 },
    accent: { material: "hessian", tint: 0xd6a35f, repeat: 3.2 },
  },
});

const tennisTextureLoader = new THREE.TextureLoader();
tennisTextureLoader.setCrossOrigin("anonymous");
const TENNIS_CHARACTER_TEXTURE_CACHE = new Map<string, THREE.Texture>();

function loadTennisCharacterTexture(url: string, { isColor = false, repeat = 3 } = {}) {
  const cacheKey = `${url}|${isColor ? "srgb" : "linear"}|${repeat}`;
  const cached = TENNIS_CHARACTER_TEXTURE_CACHE.get(cacheKey);
  if (cached) return cached;
  const texture = tennisTextureLoader.load(
    url,
    (loaded) => {
      loaded.wrapS = THREE.RepeatWrapping;
      loaded.wrapT = THREE.RepeatWrapping;
      loaded.repeat.set(repeat, repeat);
      loaded.anisotropy = 8;
      loaded.generateMipmaps = true;
      loaded.minFilter = THREE.LinearMipmapLinearFilter;
      loaded.magFilter = THREE.LinearFilter;
      if (isColor) loaded.colorSpace = THREE.SRGBColorSpace;
      loaded.needsUpdate = true;
    },
    undefined,
    () => TENNIS_CHARACTER_TEXTURE_CACHE.delete(cacheKey)
  );
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.anisotropy = 8;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  if (isColor) texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  TENNIS_CHARACTER_TEXTURE_CACHE.set(cacheKey, texture);
  return texture;
}

function isNearlyWhiteCharacterMaterial(mat: THREE.MeshStandardMaterial) {
  if (!mat.color) return false;
  return mat.color.r > 0.82 && mat.color.g > 0.82 && mat.color.b > 0.82 && !mat.map;
}

function isLowSaturationLightCharacterMaterial(mat: THREE.MeshStandardMaterial) {
  if (!mat.color || mat.map) return false;
  const max = Math.max(mat.color.r, mat.color.g, mat.color.b);
  const min = Math.min(mat.color.r, mat.color.g, mat.color.b);
  return max > 0.72 && max - min < 0.18;
}

function classifyTennisHumanSurface(obj: THREE.Object3D, mat: THREE.MeshStandardMaterial) {
  const name = `${obj.name || ""} ${mat.name || ""}`.toLowerCase();
  if (/eye|iris|pupil|cornea|wolf3d_eyes/.test(name)) return "eye";
  if (/hair|brow|beard|mustache|moustache|lash|wolf3d_hair|wolf3d_beard|wolf3d_eyebrow/.test(name)) return "hair";
  if (/teeth|tooth|tongue|mouth|gum/.test(name)) return "mouth";
  if (/shoe|boot|sole|sneaker|footwear|wolf3d_outfit_footwear/.test(name)) return "shoe";
  if (/skin|head|face|neck|hand|finger|wolf3d_head|wolf3d_body|bodymesh/.test(name) && !/outfit|shirt|pants|trouser|shoe|sock|cloth|jacket|hood|dress|skirt|uniform|suit/.test(name)) return "skin";
  if (/shirt|top|torso|chest|jacket|hood|dress|skirt|sleeve|upper|outfit_top|wolf3d_outfit_top/.test(name)) return "upperCloth";
  if (/pants|trouser|jean|short|legging|bottom|outfit_bottom|wolf3d_outfit_bottom/.test(name)) return "lowerCloth";
  if (/tie|scarf|belt|strap|bag|hat|cap|glove|sock|accessory|accent/.test(name)) return "accentCloth";
  if (/cloth|clothing|uniform|outfit|suit/.test(name)) return "upperCloth";
  if (isNearlyWhiteCharacterMaterial(mat) && /torso|chest|spine|pelvis|hip|leg|arm|body|mesh/.test(name)) return "upperCloth";
  return "other";
}

function resolveTennisClothSlot(theme: CharacterTheme | undefined, slot: "upper" | "lower" | "accent", side: PlayerSide): TennisClothTexture {
  const combo = TENNIS_CHARACTER_CLOTH_COMBOS[theme?.clothCombo || ""] || TENNIS_CHARACTER_CLOTH_COMBOS.royalDenim;
  const slotConfig = combo[slot] || combo.upper;
  const source = POLYHAVEN_CLOTH_MATERIALS[slotConfig.material] || POLYHAVEN_CLOTH_MATERIALS.denim;
  return {
    ...source,
    tint: slotConfig.tint ?? source.tint,
    repeat: slotConfig.repeat + (side === "near" ? 0.55 : 0),
  };
}

function applyTennisClothMaterial(mat: THREE.MeshStandardMaterial, cloth: TennisClothTexture) {
  mat.map = loadTennisCharacterTexture(cloth.color, { isColor: true, repeat: cloth.repeat });
  mat.normalMap = loadTennisCharacterTexture(cloth.normal, { repeat: cloth.repeat });
  mat.roughnessMap = loadTennisCharacterTexture(cloth.roughness, { repeat: cloth.repeat });
  mat.color = new THREE.Color(cloth.tint ?? 0xffffff);
  mat.normalScale = new THREE.Vector2(0.28, 0.28);
  mat.roughness = 0.86;
  mat.metalness = 0.015;
  mat.userData = { ...(mat.userData || {}), polyhavenCloth: cloth.source, polyhavenGltf: cloth.gltf };
}

function normalizeTennisMaterialTextures(mat: THREE.MeshStandardMaterial) {
  [mat.map, mat.normalMap, mat.roughnessMap, mat.metalnessMap, mat.aoMap, mat.emissiveMap].forEach((tex) => {
    if (!tex) return;
    tex.anisotropy = Math.max(tex.anisotropy ?? 1, 8);
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
  });
  if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
}

function enhanceTennisCharacterMaterials(instance: THREE.Object3D, theme: CharacterTheme | undefined, side: PlayerSide) {
  const clothSlots = {
    upperCloth: resolveTennisClothSlot(theme, "upper", side),
    lowerCloth: resolveTennisClothSlot(theme, "lower", side),
    accentCloth: resolveTennisClothSlot(theme, "accent", side),
  } as const;
  const skinColor = new THREE.Color(theme?.skinTone ?? 0xd2a07c);
  const hairColor = new THREE.Color(theme?.hairColor ?? 0x21150f);
  const eyeColor = new THREE.Color(theme?.eyeColor ?? 0x3f5f75);

  instance.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const enhancedMaterials = sourceMaterials.map((sourceMat) => {
      const mat = (sourceMat as THREE.MeshStandardMaterial).clone
        ? (sourceMat as THREE.MeshStandardMaterial).clone()
        : new THREE.MeshStandardMaterial();
      const surface = classifyTennisHumanSurface(obj, mat);
      if (surface === "upperCloth" || surface === "lowerCloth" || surface === "accentCloth") {
        applyTennisClothMaterial(mat, clothSlots[surface]);
      } else if (surface === "hair") {
        mat.map = null;
        mat.color = hairColor.clone();
        mat.roughness = 0.56;
        mat.metalness = 0.02;
        mat.envMapIntensity = 0.28;
      } else if (surface === "eye") {
        mat.map = null;
        mat.color = eyeColor.clone();
        mat.roughness = 0.18;
        mat.metalness = 0;
        mat.envMapIntensity = 1.1;
      } else if (surface === "skin") {
        if (isLowSaturationLightCharacterMaterial(mat)) mat.color = skinColor.clone();
        mat.roughness = Math.min(mat.roughness ?? 0.62, 0.62);
        mat.metalness = 0;
      } else if (surface === "shoe") {
        if (isLowSaturationLightCharacterMaterial(mat)) mat.color = new THREE.Color(0x111827);
        mat.roughness = 0.78;
        mat.metalness = 0.02;
      } else if (surface === "mouth") {
        if (isNearlyWhiteCharacterMaterial(mat)) mat.color = new THREE.Color(0xf8fafc);
        mat.roughness = 0.32;
        mat.metalness = 0;
      } else if (isNearlyWhiteCharacterMaterial(mat)) {
        mat.color = skinColor.clone();
        mat.roughness = 0.58;
        mat.metalness = 0;
      }
      normalizeTennisMaterialTextures(mat);
      mat.needsUpdate = true;
      return mat;
    });
    mesh.material = Array.isArray(mesh.material) ? enhancedMaterials : enhancedMaterials[0];
  });
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


function createCourtAcrylicTexture(base = "#396f86", lineNoise = 22000) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < lineNoise; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const shade = 145 + Math.floor(Math.random() * 70);
    ctx.fillStyle = `rgba(${shade},${shade + 8},${shade + 10},${0.035 + Math.random() * 0.055})`;
    ctx.fillRect(x, y, 1 + Math.random() * 2.8, 1 + Math.random() * 1.4);
  }
  for (let i = 0; i < 46; i++) {
    ctx.strokeStyle = `rgba(255,255,255,${0.035 + Math.random() * 0.05})`;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    const y = Math.random() * 512;
    ctx.moveTo(Math.random() * 80, y);
    ctx.bezierCurveTo(150, y + (Math.random() - 0.5) * 18, 340, y + (Math.random() - 0.5) * 22, 512, y + (Math.random() - 0.5) * 14);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2.2, 5.2);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 6;
  return tex;
}

function createSkyGradientTexture() {
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  const grad = ctx.createLinearGradient(0, 0, 0, c.height);
  grad.addColorStop(0, "#102035");
  grad.addColorStop(0.42, "#304d62");
  grad.addColorStop(1, "#d2b68d");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, c.width, c.height);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function addCourt(scene: THREE.Scene, options: { hideFloor?: boolean } = {}) {
  const group = new THREE.Group();
  scene.add(group);

  const hideFloor = !!options.hideFloor;
  const apronTex = createCourtAcrylicTexture("#4d8460", 18000);
  const courtTex = createCourtAcrylicTexture("#2f6f88", 26000);
  const serviceTex = createCourtAcrylicTexture("#367d93", 24000);
  const outerMat = new THREE.MeshStandardMaterial({ map: apronTex, roughness: 0.88, metalness: 0, color: new THREE.Color(0x6b8f57) });
  const courtMat = new THREE.MeshStandardMaterial({ map: courtTex, roughness: 0.82, metalness: 0.01, color: new THREE.Color(0x4f93a7) });
  const serviceMat = new THREE.MeshStandardMaterial({ map: serviceTex, roughness: 0.8, metalness: 0.01, color: new THREE.Color(0x5ea7ba) });
  const lineMat = material(0xf8fbf7, 0.36, 0.0);
  const netTexture = new THREE.CanvasTexture(makeCourtNetTexture());
  netTexture.colorSpace = THREE.SRGBColorSpace;
  netTexture.anisotropy = 8;
  const netMat = new THREE.MeshStandardMaterial({
    map: netTexture,
    transparent: true,
    opacity: 0.9,
    roughness: 0.5,
    metalness: 0.02,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const netWhite = material(0xf7f7f7, 0.44, 0.0);
  const postMat = material(0x2a2f33, 0.32, 0.28);

  if (!hideFloor) {
    addBox(group, [CFG.doublesW + 13.4 * CFG.worldScale, 0.035, CFG.courtL + 14.2 * CFG.worldScale], [0, -0.015, 0], outerMat);
    addBox(group, [CFG.courtW, 0.04, CFG.courtL], [0, 0.004, 0], courtMat);
    addBox(group, [CFG.courtW - 0.2, 0.043, CFG.serviceLineZ * 2], [0, 0.012, 0], serviceMat);
    addTrainingCourtSurrounds(group);
  }

  const y = 0.045 * CFG.worldScale;
  const thick = 0.045 * CFG.worldScale;
  const halfW = CFG.courtW / 2;
  const halfL = CFG.courtL / 2;

  addBox(group, [CFG.courtW + thick, thick, thick], [0, y, -halfL], lineMat);
  addBox(group, [CFG.courtW + thick, thick, thick], [0, y, halfL], lineMat);
  addBox(group, [thick, thick, CFG.courtL + thick], [-halfW, y, 0], lineMat);
  addBox(group, [thick, thick, CFG.courtL + thick], [halfW, y, 0], lineMat);
  addBox(group, [CFG.courtW, thick, thick], [0, y, -CFG.serviceLineZ], lineMat);
  addBox(group, [CFG.courtW, thick, thick], [0, y, CFG.serviceLineZ], lineMat);
  addBox(group, [thick, thick, CFG.serviceLineZ * 2], [0, y, 0], lineMat);
  addBox(group, [thick, thick, 0.38 * CFG.worldScale], [0, y, -halfL + 0.18 * CFG.worldScale], lineMat);
  addBox(group, [thick, thick, 0.38 * CFG.worldScale], [0, y, halfL - 0.18 * CFG.worldScale], lineMat);
  addBox(group, [thick, thick, CFG.courtL + thick], [-CFG.doublesW / 2, y, 0], transparentMaterial(0xffffff, 0.34));
  addBox(group, [thick, thick, CFG.courtL + thick], [CFG.doublesW / 2, y, 0], transparentMaterial(0xffffff, 0.34));

  const netBody = new THREE.Mesh(new THREE.PlaneGeometry(CFG.doublesW + 0.42 * CFG.worldScale, CFG.netH), netMat);
  netBody.position.set(0, CFG.netH / 2, 0);
  enableShadow(netBody);
  group.add(netBody);
  addBox(group, [CFG.doublesW + 0.75 * CFG.worldScale, 0.085 * CFG.worldScale, 0.09 * CFG.worldScale], [0, CFG.netH + 0.03 * CFG.worldScale, 0], netWhite);
  addBox(group, [CFG.doublesW + 0.55 * CFG.worldScale, 0.065 * CFG.worldScale, 0.07 * CFG.worldScale], [0, 0.06 * CFG.worldScale, 0], netWhite);
  addBox(group, [0.09 * CFG.worldScale, CFG.netH + 0.12 * CFG.worldScale, 0.085 * CFG.worldScale], [-(CFG.doublesW / 2 + 0.28 * CFG.worldScale), CFG.netH / 2, 0], netWhite);
  addBox(group, [0.09 * CFG.worldScale, CFG.netH + 0.12 * CFG.worldScale, 0.085 * CFG.worldScale], [CFG.doublesW / 2 + 0.28 * CFG.worldScale, CFG.netH / 2, 0], netWhite);
  const postHeight = CFG.netH + 0.36 * CFG.worldScale;
  addCylinder(group, 0.045 * CFG.worldScale, 0.052 * CFG.worldScale, postHeight, [-(CFG.doublesW / 2 + 0.22 * CFG.worldScale), postHeight / 2, 0], postMat, 22);
  addCylinder(group, 0.045 * CFG.worldScale, 0.052 * CFG.worldScale, postHeight, [CFG.doublesW / 2 + 0.22 * CFG.worldScale, postHeight / 2, 0], postMat, 22);

  return { group, netBody };
}


function addTrainingCourtSurrounds(group: THREE.Group) {
  const fenceMat = transparentMaterial(0x243238, 0.46, 0.64);
  const poleMat = material(0x28323a, 0.42, 0.34);
  const fenceY = 1.65 * CFG.worldScale;
  const sideX = CFG.doublesW / 2 + 5.4 * CFG.worldScale;
  const endZ = CFG.courtL / 2 + 5.35 * CFG.worldScale;
  const sideFenceDepth = CFG.courtL + 10.7 * CFG.worldScale;
  const endFenceWidth = CFG.doublesW + 10.8 * CFG.worldScale;

  addBox(group, [0.035, fenceY, sideFenceDepth], [-sideX, fenceY / 2, 0], fenceMat);
  addBox(group, [0.035, fenceY, sideFenceDepth], [sideX, fenceY / 2, 0], fenceMat);
  addBox(group, [endFenceWidth, fenceY, 0.035], [0, fenceY / 2, -endZ], fenceMat);
  addBox(group, [endFenceWidth, fenceY, 0.035], [0, fenceY / 2, endZ], fenceMat);

  for (let i = -4; i <= 4; i++) {
    const z = (i / 4) * (sideFenceDepth / 2);
    addCylinder(group, 0.028, 0.028, fenceY + 0.18, [-sideX, (fenceY + 0.18) / 2, z], poleMat, 12);
    addCylinder(group, 0.028, 0.028, fenceY + 0.18, [sideX, (fenceY + 0.18) / 2, z], poleMat, 12);
  }
  for (let i = -2; i <= 2; i++) {
    const x = (i / 2) * (endFenceWidth / 2);
    addCylinder(group, 0.028, 0.028, fenceY + 0.18, [x, (fenceY + 0.18) / 2, -endZ], poleMat, 12);
    addCylinder(group, 0.028, 0.028, fenceY + 0.18, [x, (fenceY + 0.18) / 2, endZ], poleMat, 12);
  }

  addRealisticCourtYardDetails(group, { sideX, endZ, endFenceWidth });
}


function makeCourtSignTexture(text: string, bg = "#164f3a", fg = "#f8fff4") {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
  grad.addColorStop(0, bg);
  grad.addColorStop(1, "#0d2430");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "rgba(255,255,255,.28)";
  ctx.lineWidth = 10;
  ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
  ctx.fillStyle = fg;
  ctx.font = "800 46px Inter, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function addCourtSign(group: THREE.Group, text: string, position: [number, number, number], rotationY: number) {
  const mat = new THREE.MeshStandardMaterial({ map: makeCourtSignTexture(text), roughness: 0.58, metalness: 0.02 });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.35 * CFG.worldScale, 0.72 * CFG.worldScale), mat);
  sign.position.set(...position);
  sign.rotation.y = rotationY;
  enableShadow(sign);
  group.add(sign);
  return sign;
}

function addBallTube(group: THREE.Group, x: number, z: number, rotationY = 0) {
  const tubeMat = transparentMaterial(0x2b3d3b, 0.38, 0.42);
  const rimMat = material(0xb7c4bb, 0.36, 0.24);
  const ballMat = material(0xcde943, 0.62, 0.0);
  const h = 0.82 * CFG.worldScale;
  const tube = addCylinder(group, 0.22 * CFG.worldScale, 0.2 * CFG.worldScale, h, [x, h / 2, z], tubeMat, 24);
  tube.rotation.y = rotationY;
  addCylinder(group, 0.235 * CFG.worldScale, 0.235 * CFG.worldScale, 0.035 * CFG.worldScale, [x, h + 0.03 * CFG.worldScale, z], rimMat, 24);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const r = 0.1 * CFG.worldScale;
    addCylinder(group, 0.045 * CFG.worldScale, 0.045 * CFG.worldScale, 0.09 * CFG.worldScale, [x + Math.cos(a) * r, h + 0.08 * CFG.worldScale + (i % 2) * 0.045 * CFG.worldScale, z + Math.sin(a) * r], ballMat, 18);
  }
}

function addUmpireChair(group: THREE.Group, x: number, z: number, side = 1) {
  const metalMat = material(0xdde5e8, 0.34, 0.38);
  const seatMat = material(0x315a44, 0.62, 0.03);
  const ladderMat = material(0xa9b2b6, 0.42, 0.3);
  const y = 1.18 * CFG.worldScale;
  addBox(group, [0.72 * CFG.worldScale, 0.12 * CFG.worldScale, 0.72 * CFG.worldScale], [x, y, z], seatMat);
  addBox(group, [0.76 * CFG.worldScale, 0.8 * CFG.worldScale, 0.1 * CFG.worldScale], [x, y + 0.38 * CFG.worldScale, z - side * 0.34 * CFG.worldScale], seatMat);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = addCylinder(group, 0.025 * CFG.worldScale, 0.032 * CFG.worldScale, y, [x + sx * 0.28 * CFG.worldScale, y / 2, z + sz * 0.28 * CFG.worldScale], metalMat, 10);
      leg.rotation.z = sx * 0.04;
    }
  }
  for (let i = 0; i < 4; i++) {
    addBox(group, [0.64 * CFG.worldScale, 0.032 * CFG.worldScale, 0.04 * CFG.worldScale], [x, 0.34 * CFG.worldScale + i * 0.22 * CFG.worldScale, z + side * 0.42 * CFG.worldScale], ladderMat);
  }
  addBox(group, [1.05 * CFG.worldScale, 0.08 * CFG.worldScale, 0.42 * CFG.worldScale], [x, 0.9 * CFG.worldScale, z + side * 0.52 * CFG.worldScale], ladderMat);
}

function addBenchWithGear(group: THREE.Group, x: number, z: number, rotationY: number) {
  const benchMat = material(0x8b5a2b, 0.5, 0.08);
  const metalMat = material(0x2c3438, 0.44, 0.24);
  const bagMat = material(0x20242d, 0.68, 0.04);
  const towelMat = material(0xf3f0df, 0.82, 0.0);
  const bench = new THREE.Group();
  bench.position.set(x, 0, z);
  bench.rotation.y = rotationY;
  group.add(bench);
  addBox(bench, [2.25 * CFG.worldScale, 0.12 * CFG.worldScale, 0.42 * CFG.worldScale], [0, 0.34 * CFG.worldScale, 0], benchMat);
  addBox(bench, [2.1 * CFG.worldScale, 0.48 * CFG.worldScale, 0.12 * CFG.worldScale], [0, 0.64 * CFG.worldScale, -0.22 * CFG.worldScale], benchMat);
  for (const lx of [-0.82, 0.82]) addBox(bench, [0.1 * CFG.worldScale, 0.34 * CFG.worldScale, 0.34 * CFG.worldScale], [lx * CFG.worldScale, 0.16 * CFG.worldScale, 0.04 * CFG.worldScale], metalMat);
  addBox(bench, [0.58 * CFG.worldScale, 0.34 * CFG.worldScale, 0.36 * CFG.worldScale], [-1.18 * CFG.worldScale, 0.2 * CFG.worldScale, 0.4 * CFG.worldScale], bagMat);
  addBox(bench, [0.54 * CFG.worldScale, 0.045 * CFG.worldScale, 0.32 * CFG.worldScale], [0.46 * CFG.worldScale, 0.43 * CFG.worldScale, 0.04 * CFG.worldScale], towelMat);
}

function addRacketProp(group: THREE.Group, x: number, z: number, rotationY: number) {
  const racket = new THREE.Group();
  racket.position.set(x, 0.09 * CFG.worldScale, z);
  racket.rotation.set(-Math.PI / 2.15, rotationY, 0.08);
  group.add(racket);
  const frameMat = material(0xfff6d2, 0.4, 0.22);
  const gripMat = material(0x1f2428, 0.78, 0.02);
  const stringsMat = transparentMaterial(0xffffff, 0.34, 0.5);
  const head = new THREE.Mesh(new THREE.TorusGeometry(0.27 * CFG.worldScale, 0.018 * CFG.worldScale, 10, 36), frameMat);
  head.scale.x = 0.72;
  enableShadow(head);
  racket.add(head);
  addBox(racket, [0.035 * CFG.worldScale, 0.035 * CFG.worldScale, 0.68 * CFG.worldScale], [0, 0, 0.54 * CFG.worldScale], gripMat);
  for (let i = -2; i <= 2; i++) addBox(racket, [0.006 * CFG.worldScale, 0.006 * CFG.worldScale, 0.42 * CFG.worldScale], [i * 0.07 * CFG.worldScale, 0, 0], stringsMat);
  for (let i = -2; i <= 2; i++) addBox(racket, [0.34 * CFG.worldScale, 0.006 * CFG.worldScale, 0.006 * CFG.worldScale], [0, 0, i * 0.07 * CFG.worldScale], stringsMat);
}

function addRealisticCourtYardDetails(group: THREE.Group, bounds: { sideX: number; endZ: number; endFenceWidth: number }) {
  const wallPadMat = material(0x174b34, 0.74, 0.02);
  const clayDustMat = transparentMaterial(0xd9bc7f, 0.28, 0.9);
  const serviceBoxMat = transparentMaterial(0xffffff, 0.12, 0.8);
  const halfW = CFG.doublesW / 2;
  const sideWalkX = halfW + 2.15 * CFG.worldScale;
  const baselineZ = CFG.courtL / 2 + 1.95 * CFG.worldScale;

  addBox(group, [bounds.endFenceWidth, 0.62 * CFG.worldScale, 0.09 * CFG.worldScale], [0, 0.31 * CFG.worldScale, -bounds.endZ + 0.08 * CFG.worldScale], wallPadMat);
  addBox(group, [bounds.endFenceWidth, 0.62 * CFG.worldScale, 0.09 * CFG.worldScale], [0, 0.31 * CFG.worldScale, bounds.endZ - 0.08 * CFG.worldScale], wallPadMat);
  addCourtSign(group, "TONPLAYGRAM OPEN", [0, 1.16 * CFG.worldScale, -bounds.endZ + 0.12 * CFG.worldScale], 0);
  addCourtSign(group, "TRAINING COURT", [0, 1.16 * CFG.worldScale, bounds.endZ - 0.12 * CFG.worldScale], Math.PI);
  [-1, 1].forEach((side) => {
    addCourtSign(group, side < 0 ? "PLAY REAL" : "TENNIS PRO", [side * (bounds.sideX - 0.08 * CFG.worldScale), 1.2 * CFG.worldScale, -0.18 * CFG.courtL], side < 0 ? Math.PI / 2 : -Math.PI / 2);
    addBox(group, [0.1 * CFG.worldScale, 0.62 * CFG.worldScale, CFG.courtL * 0.42], [side * (bounds.sideX - 0.04 * CFG.worldScale), 0.31 * CFG.worldScale, CFG.courtL * 0.22], wallPadMat);
    addBenchWithGear(group, side * sideWalkX, CFG.courtL * 0.24, side < 0 ? Math.PI / 2 : -Math.PI / 2);
    addBallTube(group, side * (halfW + 1.05 * CFG.worldScale), -CFG.courtL * 0.28, side * 0.12);
  });

  addUmpireChair(group, -(halfW + 0.95 * CFG.worldScale), 0, -1);
  addRacketProp(group, halfW + 1.55 * CFG.worldScale, -0.5 * CFG.worldScale, -0.25);
  addRacketProp(group, -(halfW + 2.55 * CFG.worldScale), CFG.courtL * 0.32, 0.4);
  addBox(group, [CFG.courtW * 0.8, 0.012 * CFG.worldScale, 0.55 * CFG.worldScale], [0, 0.066 * CFG.worldScale, baselineZ], clayDustMat);
  addBox(group, [CFG.courtW * 0.8, 0.012 * CFG.worldScale, 0.55 * CFG.worldScale], [0, 0.066 * CFG.worldScale, -baselineZ], clayDustMat);
  addBox(group, [CFG.courtW - 0.4 * CFG.worldScale, 0.012 * CFG.worldScale, CFG.serviceLineZ * 1.94], [0, 0.07 * CFG.worldScale, 0], serviceBoxMat);
}

function addTrainingCourtLighting(scene: THREE.Scene) {
  scene.background = createSkyGradientTexture();
  scene.environment = null;
  scene.add(new THREE.AmbientLight(0xfff8ec, 0.82));
  scene.add(new THREE.HemisphereLight(0xf0f8ff, 0x6f835f, 0.98));

  const keySun = new THREE.DirectionalLight(0xfff5d8, 1.32);
  keySun.position.set(-6.5, 9.5, 6.2);
  keySun.castShadow = true;
  keySun.shadow.mapSize.width = 2048;
  keySun.shadow.mapSize.height = 2048;
  keySun.shadow.camera.near = 0.5;
  keySun.shadow.camera.far = Math.max(25, CFG.courtL * 1.45);
  const shadowHalfW = CFG.doublesW / 2 + 5.2 * CFG.worldScale;
  const shadowHalfL = CFG.courtL / 2 + 5.8 * CFG.worldScale;
  keySun.shadow.camera.left = -shadowHalfW;
  keySun.shadow.camera.right = shadowHalfW;
  keySun.shadow.camera.top = shadowHalfL;
  keySun.shadow.camera.bottom = -shadowHalfL;
  scene.add(keySun);

  const poleMat = material(0x222b33, 0.36, 0.34);
  const headMat = material(0x1d252c, 0.32, 0.22);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xfff0c4, transparent: true, opacity: 0.72 });
  const poleX = CFG.doublesW / 2 + 3.05 * CFG.worldScale;
  const poleZs = [-0.36, 0.36].map((n) => n * CFG.courtL);
  const poleH = 3.9 * CFG.worldScale;

  poleZs.forEach((z) => {
    [-1, 1].forEach((side) => {
      const x = side * poleX;
      addCylinder(scene, 0.045 * CFG.worldScale, 0.058 * CFG.worldScale, poleH, [x, poleH / 2, z], poleMat, 16);
      const arm = addBox(scene, [0.9 * CFG.worldScale, 0.045 * CFG.worldScale, 0.055 * CFG.worldScale], [x - side * 0.34 * CFG.worldScale, poleH - 0.15 * CFG.worldScale, z], poleMat);
      arm.rotation.z = side * 0.12;
      for (let i = 0; i < 2; i++) {
        const head = addBox(scene, [0.46 * CFG.worldScale, 0.2 * CFG.worldScale, 0.16 * CFG.worldScale], [x - side * (0.78 + i * 0.34) * CFG.worldScale, poleH - 0.2 * CFG.worldScale, z + (i - 0.5) * 0.18 * CFG.worldScale], headMat);
        head.lookAt(0, 0.25 * CFG.worldScale, z * 0.35);
        const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.42 * CFG.worldScale, 0.16 * CFG.worldScale), glowMat.clone());
        glow.position.copy(head.position);
        glow.lookAt(0, 0.5 * CFG.worldScale, z * 0.2);
        scene.add(glow);
      }
      const spot = new THREE.SpotLight(0xfff6df, 2.22, CFG.courtL * 1.25, Math.PI / 5.4, 0.52, 0.95);
      spot.position.set(x - side * 0.95 * CFG.worldScale, poleH - 0.28 * CFG.worldScale, z);
      spot.target.position.set(0, 0.05, z * 0.14);
      spot.castShadow = true;
      spot.shadow.mapSize.width = 1024;
      spot.shadow.mapSize.height = 1024;
      scene.add(spot, spot.target);

      const fill = new THREE.PointLight(0xfff7df, 0.66, CFG.courtL * 0.72, 1.4);
      fill.position.set(x - side * 0.72 * CFG.worldScale, poleH - 0.34 * CFG.worldScale, z);
      scene.add(fill);
    });
  });
}

function addOnlineCourtEnvironmentAssets(scene: THREE.Scene) {
  const group = new THREE.Group();
  group.name = "online-tennis-court-environment-assets";
  scene.add(group);

  const loader = new GLTFLoader().setCrossOrigin("anonymous");
  const placements = [
    new THREE.Vector3(-(CFG.doublesW / 2 + 2.75 * CFG.worldScale), 0.08 * CFG.worldScale, CFG.courtL * 0.16),
    new THREE.Vector3(CFG.doublesW / 2 + 2.65 * CFG.worldScale, 0.08 * CFG.worldScale, CFG.courtL * 0.1),
    new THREE.Vector3(-(CFG.doublesW / 2 + 2.85 * CFG.worldScale), 0.08 * CFG.worldScale, -CFG.courtL * 0.24),
  ];

  COURT_ENVIRONMENT_ASSETS.forEach((asset, idx) => {
    loader.load(
      asset.url,
      (gltf) => {
        const root = gltf.scene;
        root.name = asset.name;
        root.userData.source = asset.source;
        root.position.copy(placements[idx] || asset.position);
        root.rotation.y = asset.rotationY;
        root.scale.setScalar(1);
        root.updateMatrixWorld(true);

        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const maxAxis = Math.max(size.x, size.y, size.z, 0.001);
        root.scale.setScalar((asset.scale * CFG.worldScale) / maxAxis);
        root.updateMatrixWorld(true);
        const scaledBox = new THREE.Box3().setFromObject(root);
        root.position.y += 0.08 * CFG.worldScale - scaledBox.min.y;

        root.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (!mesh.isMesh) return;
          enableShadow(mesh);
          if (mesh.material instanceof THREE.MeshStandardMaterial) {
            mesh.material.roughness = Math.max(mesh.material.roughness ?? 0, 0.48);
          }
        });
        group.add(root);
      },
      undefined,
      () => {
        const fallbackMat = material(idx === 0 ? 0x8c5a38 : idx === 1 ? 0x2f3540 : 0x2f6f44, 0.56, 0.05);
        const fallback = addBox(group, [0.6 * CFG.worldScale, 0.42 * CFG.worldScale, 0.42 * CFG.worldScale], placements[idx]?.toArray() || asset.position.toArray(), fallbackMat);
        fallback.name = `${asset.name}-fallback`;
      }
    );
  });

  return group;
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
  const leftFoot = addBox(g, [0.23, 0.055, 0.34], [-0.13, 0.035, -0.04], shoe);
  const rightFoot = addBox(g, [0.23, 0.055, 0.34], [0.13, 0.035, -0.04], shoe);
  g.userData.goalRushFallbackParts = { body: torso, head, leftFoot, rightFoot };
  enableShadow(g);
  return g;
}



function makeRacketHexStringTexture() {
  const size = 512;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  const center = size / 2;
  const radius = size * 0.46;
  const hexRadius = size * 0.048;
  const hexHeight = Math.sqrt(3) * hexRadius;
  const stepX = hexRadius * 1.5;
  const stepY = hexHeight;

  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = "rgba(255,255,255,0.74)";
  ctx.lineWidth = 4.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (let y = center - radius - stepY; y <= center + radius + stepY; y += stepY) {
    const row = Math.round((y - (center - radius - stepY)) / stepY);
    const offsetX = row % 2 === 0 ? 0 : stepX / 2;
    for (let x = center - radius - stepX; x <= center + radius + stepX; x += stepX) {
      const cx = x + offsetX;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = Math.PI / 6 + (Math.PI / 3) * i;
        const px = cx + Math.cos(angle) * hexRadius;
        const py = y + Math.sin(angle) * hexRadius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }

  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.lineWidth = 5.5;
  ctx.beginPath();
  ctx.arc(center, center, radius - 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  return c;
}

function makeCourtNetTexture(width = 1024, height = 256) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d")!;
  const hexRadius = 17;
  const stepX = hexRadius * 1.5;
  const stepY = Math.sqrt(3) * hexRadius;

  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = "rgba(245,248,244,0.86)";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (let y = -stepY; y <= height + stepY; y += stepY) {
    const row = Math.round((y + stepY) / stepY);
    const offsetX = row % 2 === 0 ? 0 : stepX / 2;
    for (let x = -stepX; x <= width + stepX; x += stepX) {
      const cx = x + offsetX;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = Math.PI / 6 + (Math.PI / 3) * i;
        const px = cx + Math.cos(angle) * hexRadius;
        const py = y + Math.sin(angle) * hexRadius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
  return c;
}

function createRacket(color: number) {
  const g = new THREE.Group();
  const handleMat = material(0x1d1d1f, 0.55, 0.1);
  const frameMat = material(color, 0.36, 0.45);

  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.42, 16), handleMat);
  handle.position.y = -0.11;
  enableShadow(handle);
  g.add(handle);

  const throatA = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.29, 12), frameMat);
  throatA.position.set(-0.052, 0.24, -0.026);
  throatA.rotation.z = 0.24;
  enableShadow(throatA);
  g.add(throatA);
  const throatB = throatA.clone();
  throatB.position.x *= -1;
  throatB.rotation.z *= -1;
  g.add(throatB);

  const headRadius = 0.205;
  const frameTubeRadius = 0.019;
  const headScaleY = 1.34;
  const innerHeadRadius = headRadius - frameTubeRadius;
  const head = new THREE.Mesh(new THREE.TorusGeometry(headRadius, frameTubeRadius, 12, 52), frameMat);
  head.scale.y = headScaleY;
  head.position.y = 0.56;
  enableShadow(head);
  g.add(head);

  const stringTexture = new THREE.CanvasTexture(makeRacketHexStringTexture());
  stringTexture.colorSpace = THREE.SRGBColorSpace;
  stringTexture.anisotropy = 4;
  const stringMat = new THREE.MeshStandardMaterial({
    map: stringTexture,
    transparent: true,
    opacity: 0.82,
    roughness: 0.42,
    metalness: 0.02,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const stringPlane = new THREE.Mesh(new THREE.CircleGeometry(innerHeadRadius, 72), stringMat);
  stringPlane.scale.y = headScaleY;
  stringPlane.position.set(0, 0.56, 0.007);
  g.add(stringPlane);
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


type TennisLocomotionMode = "idle" | "forward" | "backpedal" | "shuffle";

function tennisPoseBone(model: THREE.Object3D, key: string) {
  const hints: Record<string, string[]> = {
    hips: ["hips", "pelvis", "pelvisjoint", "hipjoint"],
    spine: ["spine", "chest", "torso"],
    leftUpperArm: ["leftarm", "leftupperarm", "lupperarm", "shoulderl"],
    leftForeArm: ["leftforearm", "leftlowerarm", "lforearm", "elbowl"],
    rightUpperArm: ["rightarm", "rightupperarm", "rupperarm", "shoulderr"],
    rightForeArm: ["rightforearm", "rightlowerarm", "rforearm", "elbowr"],
    leftThigh: ["leftupleg", "leftthigh", "lthigh", "legjointl1"],
    leftCalf: ["leftleg", "leftcalf", "lcalf", "legjointl2"],
    leftFoot: ["leftfoot", "lfoot", "footl", "lefttoe", "lefttoebase"],
    rightThigh: ["rightupleg", "rightthigh", "rthigh", "legjointr1"],
    rightCalf: ["rightleg", "rightcalf", "rcalf", "legjointr2"],
    rightFoot: ["rightfoot", "rfoot", "footr", "righttoe", "righttoebase"],
  };
  return findFirstBone(model, hints[key] || []);
}

function captureTennisLocomotionDefaultPose(model: THREE.Object3D) {
  if (model.userData.tennisLocomotionDefaultPose) return;
  const bones = [
    "hips",
    "spine",
    "leftUpperArm",
    "leftForeArm",
    "rightUpperArm",
    "rightForeArm",
    "leftThigh",
    "leftCalf",
    "leftFoot",
    "rightThigh",
    "rightCalf",
    "rightFoot",
  ] as const;
  const pose: Record<string, THREE.Euler> = {};
  for (const key of bones) {
    const bone = tennisPoseBone(model, key);
    if (bone) pose[key] = bone.rotation.clone();
  }
  model.userData.tennisLocomotionDefaultPose = pose;
}

function resetTennisLocomotionPose(model: THREE.Object3D | null) {
  const pose = model?.userData?.tennisLocomotionDefaultPose as Record<string, THREE.Euler> | undefined;
  if (!model || !pose) return;
  Object.entries(pose).forEach(([key, rotation]) => {
    const bone = tennisPoseBone(model, key);
    if (bone) bone.rotation.copy(rotation);
  });
}

function applyTennisRotationOffset(bone: THREE.Object3D | undefined, x = 0, y = 0, z = 0) {
  if (!bone) return;
  bone.rotation.x += x;
  bone.rotation.y += y;
  bone.rotation.z += z;
}

function applyGoalRushStyleTennisWalk(player: HumanRig, mode: TennisLocomotionMode, runAmount: number, sideDot: number) {
  const isWalking = mode !== "idle" && runAmount > 0.08;
  const fallbackParts = player.fallback.userData.goalRushFallbackParts as
    | { body?: THREE.Object3D; head?: THREE.Object3D; leftFoot?: THREE.Object3D; rightFoot?: THREE.Object3D }
    | undefined;

  if (player.model) {
    captureTennisLocomotionDefaultPose(player.model);
    resetTennisLocomotionPose(player.model);
    player.model.position.set(0, 0, 0);
    player.model.rotation.set(0, CFG.playerVisualYawFix, 0);
  }
  if (fallbackParts) {
    fallbackParts.leftFoot?.rotation.set(0, 0, 0);
    fallbackParts.rightFoot?.rotation.set(0, 0, 0);
    fallbackParts.body?.rotation.set(0, 0, 0);
    fallbackParts.head?.rotation.set(0, 0, 0);
    player.fallback.position.y = 0;
  }

  if (!isWalking) return;

  // Match GoalRush3DUpgrade's human fallback footwork exactly: the same
  // performance.now cadence, walk/run speed threshold, and opposite foot swing.
  const speedRatio = clamp01(runAmount);
  const stride = Math.sin(performance.now() * (speedRatio > 0.72 ? 0.018 : 0.012)) * speedRatio;
  const bodyRoll = -sideDot * speedRatio * 0.035;

  if (fallbackParts) {
    if (fallbackParts.leftFoot) fallbackParts.leftFoot.rotation.x = stride * 0.8;
    if (fallbackParts.rightFoot) fallbackParts.rightFoot.rotation.x = -stride * 0.8;
    if (fallbackParts.body) fallbackParts.body.rotation.z = bodyRoll;
    if (fallbackParts.head) fallbackParts.head.rotation.x = 0;
  }

  if (!player.model) return;

  const leftFoot = tennisPoseBone(player.model, "leftFoot");
  const rightFoot = tennisPoseBone(player.model, "rightFoot");
  const leftThigh = tennisPoseBone(player.model, "leftThigh");
  const rightThigh = tennisPoseBone(player.model, "rightThigh");
  const leftCalf = tennisPoseBone(player.model, "leftCalf");
  const rightCalf = tennisPoseBone(player.model, "rightCalf");

  applyTennisRotationOffset(leftFoot, stride * 0.8, 0, 0);
  applyTennisRotationOffset(rightFoot, -stride * 0.8, 0, 0);
  applyTennisRotationOffset(leftThigh, stride * 0.42, 0, 0);
  applyTennisRotationOffset(rightThigh, -stride * 0.42, 0, 0);
  applyTennisRotationOffset(leftCalf, Math.max(0, -stride) * 0.26, 0, 0);
  applyTennisRotationOffset(rightCalf, Math.max(0, stride) * 0.26, 0, 0);
  player.model.rotation.z = bodyRoll;
}


function addHuman(scene: THREE.Scene, side: PlayerSide, start: THREE.Vector3, accent: number, theme?: CharacterTheme): HumanRig {
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
    walkCycle: 0,
    yawVelocity: 0,
  };

  modelRoot.rotation.y = rig.yaw;
  modelRoot.scale.setScalar(1);
  fallback.scale.setScalar(CFG.playerHeight / 1.82);
  racket.scale.setScalar(CFG.worldScale * 1.18);
  racket.visible = false;

  const modelUrl = theme?.modelUrls?.[0] || theme?.url || HUMAN_URL;
  new GLTFLoader().setCrossOrigin("anonymous").load(
    modelUrl,
    (gltf) => {
      const model = gltf.scene;
      normalizeHuman(model, CFG.playerHeight);
      enhanceTennisCharacterMaterials(model, theme, side);
      enableShadow(model);
      rig.model = model;
      rig.bones = findHumanBones(model);
      rig.rest = captureRestPose(rig.bones);
      captureTennisLocomotionDefaultPose(model);
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
    state: TennisBallState.ServeReady,
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
  const poseScale = CFG.worldScale;
  const base = player.pos.clone();
  const rightShoulder = base.clone().addScaledVector(right, 0.31 * poseScale).addScaledVector(forward, -0.02 * poseScale).setY(1.43 * poseScale);
  const leftShoulder = base.clone().addScaledVector(right, -0.31 * poseScale).addScaledVector(forward, -0.02 * poseScale).setY(1.43 * poseScale);

  let rightElbow = rightShoulder.clone().addScaledVector(right, 0.24 * poseScale).addScaledVector(forward, -0.15 * poseScale).setY(1.08 * poseScale);
  let rightHand = rightShoulder.clone().addScaledVector(right, 0.47 * poseScale).addScaledVector(forward, 0.04 * poseScale).setY(0.88 * poseScale);
  let leftElbow = leftShoulder.clone().addScaledVector(right, -0.18 * poseScale).addScaledVector(forward, 0.0).setY(1.05 * poseScale);
  let leftHand = leftShoulder.clone().addScaledVector(right, -0.25 * poseScale).addScaledVector(forward, 0.18 * poseScale).setY(0.82 * poseScale);
  let racketHead = rightHand.clone().addScaledVector(right, 0.1 * poseScale).setY(1.45 * poseScale);
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

    rightElbow = rightShoulder.clone().addScaledVector(right, lerp(0.34, 0.18, drop) * poseScale).addScaledVector(forward, lerp(-0.28, -0.02, contact) * poseScale).setY((lerp(0.96, 1.55, trophy) - 0.18 * drop + 0.22 * contact) * poseScale);
    rightHand = rightShoulder.clone().addScaledVector(right, lerp(0.48, 0.24, contact) * poseScale).addScaledVector(forward, lerp(-0.32, 0.46, contact) * poseScale).setY((lerp(0.82, 1.76, trophy) - 0.56 * drop + 0.78 * contact) * poseScale);
    racketHead = rightHand.clone().addScaledVector(right, lerp(0.1, -0.2, follow) * poseScale).addScaledVector(forward, (lerp(-0.12, 0.52, contact) - 0.22 * follow) * poseScale).setY((lerp(1.34, 2.38, contact) - 0.95 * follow) * poseScale);

    leftElbow = leftShoulder.clone().addScaledVector(right, -0.12 * poseScale).addScaledVector(forward, 0.12 * poseScale).setY((lerp(1.0, 1.7, toss) - 0.68 * contact) * poseScale);
    leftHand = leftShoulder.clone().addScaledVector(right, -0.16 * poseScale).addScaledVector(forward, 0.28 * poseScale).setY((lerp(0.86, 2.02, toss) - 1.1 * contact) * poseScale);

    if (follow > 0) {
      rightHand.lerp(base.clone().addScaledVector(right, -0.34 * poseScale).addScaledVector(forward, 0.38 * poseScale).setY(1.07 * poseScale), easeOutCubic(follow));
      rightElbow.lerp(base.clone().addScaledVector(right, -0.08 * poseScale).addScaledVector(forward, 0.2 * poseScale).setY(1.18 * poseScale), follow);
      racketHead.lerp(base.clone().addScaledVector(right, -0.58 * poseScale).addScaledVector(forward, 0.18 * poseScale).setY(0.78 * poseScale), easeOutCubic(follow));
    }
    wristPronation = 1.2 * contact - 0.55 * follow;
  } else {
    const prep = clamp01(tRaw / 0.28);
    const slot = clamp01((tRaw - 0.18) / 0.26);
    const contact = clamp01((tRaw - 0.42) / 0.18);
    const follow = clamp01((tRaw - 0.58) / 0.42);
    const ballSide = clamp((ball.pos.x - player.pos.x) * 0.9, -0.4 * poseScale, 0.4 * poseScale);

    torsoYaw = -0.52 * prep + 0.88 * contact - 0.25 * follow;
    torsoLean = -0.1 * prep + 0.08 * contact;
    shoulderLift = 0.12 * contact;

    const prepHand = rightShoulder.clone().addScaledVector(right, 0.62 * poseScale + ballSide).addScaledVector(forward, -0.35 * poseScale).setY(1.05 * poseScale);
    const slotHand = rightShoulder.clone().addScaledVector(right, 0.54 * poseScale + ballSide).addScaledVector(forward, -0.05 * poseScale).setY(0.82 * poseScale);
    const contactHand = player.pos.clone().addScaledVector(right, 0.38 * poseScale + ballSide * 0.45).addScaledVector(forward, 0.72 * poseScale).setY(clamp(ball.pos.y, 0.72 * poseScale, 1.24 * poseScale));
    const followHand = player.pos.clone().addScaledVector(right, -0.42 * poseScale).addScaledVector(forward, 0.34 * poseScale).setY(1.38 * poseScale);

    rightHand.copy(prepHand).lerp(slotHand, slot).lerp(contactHand, contact).lerp(followHand, follow);
    rightElbow = rightShoulder.clone().lerp(rightHand, 0.52).addScaledVector(right, 0.1 * poseScale * (1 - follow)).setY((rightShoulder.y + rightHand.y) * 0.5 + 0.12 * poseScale);

    const lagHead = rightHand.clone().addScaledVector(right, 0.35 * poseScale).addScaledVector(forward, -0.26 * poseScale).setY(1.25 * poseScale);
    const contactHead = ball.pos.clone().addScaledVector(forward, 0.02 * poseScale).setY(clamp(ball.pos.y, 0.74 * poseScale, 1.3 * poseScale));
    const followHead = player.pos.clone().addScaledVector(right, -0.68 * poseScale).addScaledVector(forward, 0.22 * poseScale).setY(1.56 * poseScale);
    racketHead.copy(lagHead).lerp(contactHead, contact).lerp(followHead, follow);

    leftElbow = leftShoulder.clone().addScaledVector(right, -0.23 * poseScale).addScaledVector(forward, 0.08 * poseScale).setY((1.08 + 0.12 * follow) * poseScale);
    leftHand = leftShoulder.clone().addScaledVector(right, (-0.42 + 0.34 * follow) * poseScale).addScaledVector(forward, 0.15 * poseScale).setY((0.92 + 0.46 * follow) * poseScale);
    wristPronation = 1.15 * contact + 0.25 * follow;
  }

  return { rightShoulder, rightElbow, rightHand, leftShoulder, leftElbow, leftHand, racketGrip: rightHand.clone(), racketHead, torsoYaw, torsoLean, shoulderLift, wristPronation };
}

function serveTossPosition(player: HumanRig, tRaw: number) {
  const { forward, right } = baseVectors(player);
  const arc = easeOutCubic(clamp01(tRaw / 0.36));
  return player.pos.clone().addScaledVector(right, -0.18 * CFG.worldScale).addScaledVector(forward, lerp(0.22, 0.46, arc) * CFG.worldScale).setY(lerp(0.96, 2.36, arc) * CFG.worldScale);
}

function serveContactPosition(player: HumanRig) {
  const { forward, right } = baseVectors(player);
  return player.pos.clone().addScaledVector(right, 0.16 * CFG.worldScale).addScaledVector(forward, 0.52 * CFG.worldScale).setY(2.22 * CFG.worldScale);
}

function serveReadyBallPosition(player: HumanRig) {
  const { forward, right } = baseVectors(player);
  return player.pos.clone().addScaledVector(right, -0.14 * CFG.worldScale).addScaledVector(forward, 0.26 * CFG.worldScale).setY(1.12 * CFG.worldScale);
}

function resetBallForServe(ball: BallState, serverPlayer: HumanRig, serveSide: "deuce" | "ad") {
  const serveZ = serverPlayer.side === "near" ? CFG.serveNearBaselineZ : -CFG.serveNearBaselineZ;
  serverPlayer.pos.x = serveXForSide(serverPlayer.side, serveSide);
  serverPlayer.target.x = serverPlayer.pos.x;
  serverPlayer.pos.z = serveZ;
  serverPlayer.target.z = serveZ;
  serverPlayer.root.position.copy(serverPlayer.pos);
  serverPlayer.modelRoot.position.copy(serverPlayer.pos);
  ball.pos.copy(serveReadyBallPosition(serverPlayer));
  ball.vel.set(0, 0, 0);
  ball.spin = 0;
  ball.lastHitBy = null;
  ball.bounceSide = null;
  ball.bounceCount = 0;
  ball.state = TennisBallState.ServeReady;
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
  const speedScale = CFG.worldScale * 1.54;
  const shotPowerTrim = serve ? 0.9 : 0.84;
  const matchPower = power * CFG.matchPowerMultiplier;
  const baseSpeed = (serve ? 23.8 + power * 14.8 : 17.2 + power * 12.6) * speedScale * shotPowerTrim * CFG.matchPowerMultiplier;
  const flight = clamp(flatDist / baseSpeed, serve ? 0.38 : 0.5, serve ? 0.88 : 1.16);
  const velocity = new THREE.Vector3(
    (target.x - from.x) / flight,
    (target.y - from.y + 0.5 * CFG.gravity * flight * flight) / flight,
    (target.z - from.z) / flight
  );

  const crossesNet = (from.z > 0 && target.z < 0) || (from.z < 0 && target.z > 0);
  if (crossesNet && Math.abs(target.z - from.z) > 0.001) {
    const tToNet = (-from.z / (target.z - from.z)) * flight;
    if (tToNet > 0 && tToNet < flight) {
      const yAtNet = from.y + velocity.y * tToNet - 0.5 * CFG.gravity * tToNet * tToNet;
      const desiredClearance = CFG.netH + CFG.ballR * (serve ? 2.45 : 2.05) + matchPower * 0.22 * CFG.worldScale;
      if (yAtNet < desiredClearance) {
        velocity.y += (desiredClearance - yAtNet) / tToNet;
      }
    }
  }

  return velocity;
}

function makeUserTargetFromSwipe(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  durationMs: number,
  isServe: boolean,
  serveSide: "deuce" | "ad",
  viewportW = 390,
  viewportH = 720
) {
  const dx = endX - startX;
  const dy = endY - startY;
  const dist = Math.hypot(dx, dy);
  const duration = Math.max(durationMs, 16);
  const shortAxis = Math.max(1, Math.min(viewportW, viewportH));
  const longAxis = Math.max(1, Math.max(viewportW, viewportH));

  // Aim is intentionally deterministic: horizontal swipe controls court width,
  // upward swipe controls depth, and release distance/speed controls power.
  const lateral = clamp(dx / (shortAxis * 0.42), -1, 1);
  const forward = clamp((-dy) / (longAxis * 0.44), 0, 1);
  const travelPower = clamp01(dist / (shortAxis * 0.58));
  const speedPower = clamp01(((dist / duration) * 1000 - 180) / 1180);
  const intentPower = clamp01(travelPower * 0.78 + speedPower * 0.22);
  const power = clamp(
    lerp(isServe ? CFG.servePower.min : CFG.shotPower.min, isServe ? CFG.servePower.max : CFG.shotPower.max, intentPower),
    isServe ? CFG.servePower.min : CFG.shotPower.min,
    isServe ? CFG.servePower.max : CFG.shotPower.max
  );

  let aimX: number;
  let targetZ: number;
  if (isServe) {
    const serveBounds = serveTargetBoundsX(serveSide, "near");
    const minX = Math.min(serveBounds.min, serveBounds.max);
    const maxX = Math.max(serveBounds.min, serveBounds.max);
    const centerX = (minX + maxX) * 0.5;
    const halfRange = (maxX - minX) * 0.5;
    aimX = clamp(centerX + lateral * halfRange, minX, maxX);
    targetZ = lerp(-CFG.serviceLineZ + 0.72 * CFG.worldScale, -CFG.serviceBuffer - 0.48 * CFG.worldScale, forward);
  } else {
    aimX = clamp(lateral * (CFG.courtW / 2 - 0.52 * CFG.worldScale), -CFG.courtW / 2 + 0.52 * CFG.worldScale, CFG.courtW / 2 - 0.52 * CFG.worldScale);
    const minimumDepth = lerp(-0.9 * CFG.worldScale, -CFG.serviceLineZ * 0.55, intentPower);
    const maximumDepth = -CFG.courtL / 2 + 0.78 * CFG.worldScale;
    targetZ = lerp(minimumDepth, maximumDepth, forward);
  }

  return {
    target: ShotTargeting.clampTarget(new THREE.Vector3(aimX, CFG.ballR, targetZ), "near", isServe),
    power,
    technique: ShotTargeting.techniqueFromSwipe(dx, dy),
    serveSide: isServe ? serveSide : undefined,
  };
}

function makeAiTarget(near: HumanRig, ball: BallState): DesiredHit {
  const pressure = clamp01((Math.abs(ball.pos.z) - 1.0 * CFG.worldScale) / (CFG.courtL / 2 - 1.0 * CFG.worldScale));
  const x = clamp(
    near.pos.x * 0.62 + (Math.random() - 0.5) * 1.15 * CFG.worldScale,
    -CFG.courtW / 2 + 0.45 * CFG.worldScale,
    CFG.courtW / 2 - 0.45 * CFG.worldScale
  );
  const z = lerp(1.35 * CFG.worldScale, CFG.courtL / 2 - 1.0 * CFG.worldScale, 0.35 + pressure * 0.55);
  const power = clamp(0.48 + pressure * 0.38 + Math.random() * 0.12, CFG.shotPower.min, CFG.shotPower.max);
  return { target: new THREE.Vector3(x, CFG.ballR, z), power, technique: "flat" };
}

function performHit(player: HumanRig, ball: BallState, hit: DesiredHit, serve = false) {
  const target = hit.target.clone();
  if (serve) {
    const serveBounds = serveTargetBoundsX(hit.serveSide || "deuce", player.side);
    target.x = clamp(target.x, Math.min(serveBounds.min, serveBounds.max), Math.max(serveBounds.min, serveBounds.max));
    target.z = player.side === "near"
      ? clamp(target.z, -CFG.serviceLineZ + 0.55 * CFG.worldScale, -CFG.serviceBuffer - 0.45 * CFG.worldScale)
      : clamp(target.z, CFG.serviceBuffer + 0.45 * CFG.worldScale, CFG.serviceLineZ - 0.55 * CFG.worldScale);
  } else {
    target.x = clamp(target.x, -CFG.courtW / 2 + 0.45, CFG.courtW / 2 - 0.45);
    target.z = player.side === "near" ? clamp(target.z, -CFG.courtL / 2 + 0.85, -0.8) : clamp(target.z, 0.8, CFG.courtL / 2 - 0.85);
  }

  if (serve) ball.pos.copy(serveContactPosition(player));
  else ball.pos.y = clamp(ball.pos.y, 0.58, 1.25);

  ball.vel.copy(ballisticVelocity(ball.pos, target, hit.power, serve));
  const technique = hit.technique || "flat";
  if (technique === "lob") {
    ball.vel.y += (1.85 + hit.power * CFG.matchPowerMultiplier * 0.86) * CFG.worldScale;
    ball.vel.multiplyScalar(0.86);
    ball.spin = 0.8 + hit.power * 0.7;
  } else if (technique === "drop") {
    ball.vel.multiplyScalar(0.58);
    ball.vel.y += 0.25;
    ball.spin = -0.7;
  } else if (technique === "block") {
    ball.vel.multiplyScalar(0.72);
    ball.spin = 0.25;
  } else if (technique === "topspin") {
    ball.vel.y += (0.38 + hit.power * CFG.matchPowerMultiplier * 0.34) * CFG.worldScale;
    ball.spin = 1.05 + hit.power * CFG.matchPowerMultiplier * 1.1;
  } else if (technique === "slice") {
    ball.vel.y -= 0.12;
    ball.spin = -1.15 - hit.power * CFG.matchPowerMultiplier * 0.62;
  } else {
    ball.spin = serve ? 0.95 + hit.power * CFG.matchPowerMultiplier * 0.9 : 0.6 + hit.power * CFG.matchPowerMultiplier * 1.25;
  }
  ball.lastHitBy = player.side;
  ball.state = serve ? TennisBallState.ServeHit : (player.side === "near" ? TennisBallState.RacketHitPlayer : TennisBallState.RacketHitAI);
  ball.bounceSide = null;
  ball.bounceCount = 0;
  player.cooldown = serve ? 0.42 : 0.28;
  player.hitThisSwing = true;
}

function canReachBall(player: HumanRig, ball: BallState) {
  if (player.cooldown > 0) return false;
  if (sideOfZ(ball.pos.z) !== player.side && ball.lastHitBy !== null) return false;
  if (ball.pos.y < 0.16 * CFG.worldScale || ball.pos.y > 1.62 * CFG.playerHeight / 1.82) return false;
  const pose = strokePose(player, ball);
  const dx = ball.pos.x - pose.racketHead.x;
  const dy = ball.pos.y - pose.racketHead.y;
  const dz = ball.pos.z - pose.racketHead.z;
  const racketRadius = 0.48 * CFG.playerHeight / 1.82;
  const racketNear = dx * dx + dy * dy * 0.45 + dz * dz < racketRadius * racketRadius;
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
  const previousPos = player.pos.clone();
  const to = player.target.clone().sub(player.pos);
  const dist = to.length();
  const maxStep = player.speed * dt;
  if (dist > 0.0001) player.pos.addScaledVector(to.normalize(), Math.min(maxStep, dist));

  PlayerController.clampMovement(player.pos, player.side);
  const actualStep = player.pos.distanceTo(previousPos);
  const actualSpeed = actualStep / Math.max(0.0001, dt);

  let face: THREE.Vector3;
  if (ball.lastHitBy === null && player.side === "near") face = new THREE.Vector3(0.22, 0, -1).normalize();
  else face = ball.pos.clone().sub(player.pos).setY(0);
  if (face.lengthSq() < 0.02) face.set(0, 0, player.side === "near" ? -1 : 1);
  face.normalize();

  const targetYaw = yawFromForward(face);
  let delta = targetYaw - player.yaw;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  const yawStep = delta * (1 - Math.exp(-8 * dt));
  player.yaw += yawStep;
  player.yawVelocity = yawStep / Math.max(0.0001, dt);

  player.root.position.copy(player.pos);
  player.modelRoot.position.copy(player.pos);
  player.modelRoot.rotation.y = player.yaw;

  const runAmount = clamp01(actualSpeed / Math.max(0.0001, player.speed));
  const moveDir = actualStep > 0.0001 ? player.pos.clone().sub(previousPos).normalize() : new THREE.Vector3();
  const localForward = forwardFromYaw(player.yaw);
  const localRight = rightFromForward(localForward);
  const forwardDot = moveDir.dot(localForward);
  const sideDot = moveDir.dot(localRight);
  const footwork = PlayerController.footworkFromDelta(player.pos.x - previousPos.x, player.pos.z - previousPos.z, player.side, player.action === "ready" ? null : player.action);
  const canUseLocomotion = ball.lastHitBy !== null && player.action === "ready" && actualStep > 0.001 * CFG.worldScale;
  const mode: TennisLocomotionMode = !canUseLocomotion
    ? "idle"
    : Math.abs(sideDot) > Math.abs(forwardDot) * 0.72 || footwork === "MoveLeft" || footwork === "MoveRight"
      ? "shuffle"
      : forwardDot < -0.2 || footwork === "MoveBack"
        ? "backpedal"
        : "forward";
  applyGoalRushStyleTennisWalk(player, mode, canUseLocomotion ? runAmount : 0, sideDot);

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
  let spin = ball.spin;
  const dt = 1 / 45;
  for (let i = 0; i < 95; i++) {
    v.y -= CFG.gravity * (1 + Math.max(0, spin) * 0.12) * dt;
    v.multiplyScalar(Math.exp(-CFG.airDrag * dt));
    spin *= Math.exp(-1.25 * dt);
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
  const [selectedHumanCharacterId, setSelectedHumanCharacterId] = useState(() => localStorage.getItem("tennisSelectedHumanCharacter") || MURLAN_CHARACTER_THEMES[0]?.id || "rpm-current");
  const tennisPoint = (score: number) => ["0", "15", "30", "40", "Ad"][Math.min(score, 4)];
  const hudRef = useRef(hud);
  const controlRef = useRef<ControlState>({ active: false, pointerId: null, startX: 0, startY: 0, lastX: 0, lastY: 0, startPlayer: new THREE.Vector3(), startTs: 0, lastTs: 0 });

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
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.38;
    const scene = new THREE.Scene();
    scene.fog = null;

    const camera = new THREE.PerspectiveCamera(42, 1, 0.05, Math.max(70, CFG.courtL * 1.8));
    const cameraTarget = new THREE.Vector3(0, 1.64 * CFG.cameraViewScale, -2.4 * CFG.cameraViewScale);
    const cameraOffset = new THREE.Vector3(0, 10.35 * CFG.cameraViewScale, 17.15 * CFG.cameraViewScale);
    const cameraPosTarget = new THREE.Vector3();

    addTrainingCourtLighting(scene);
    const courtVisual = addCourt(scene, { hideFloor: false });
    addOnlineCourtEnvironmentAssets(scene);
    const updateBillboards = () => {};

    const nearHuman = MURLAN_CHARACTER_THEMES.find((c) => c.id === selectedHumanCharacterId) || MURLAN_CHARACTER_THEMES[0];
    const aiPool = MURLAN_CHARACTER_THEMES.filter((c) => c.id !== nearHuman?.id);
    const aiHuman = (aiPool.length ? aiPool : MURLAN_CHARACTER_THEMES)[Math.floor(Math.random() * (aiPool.length ? aiPool.length : MURLAN_CHARACTER_THEMES.length))];
    const nearPlayer = addHuman(scene, "near", new THREE.Vector3(0, 0, CFG.courtL / 2 - 1.04), 0xff7a2f, nearHuman);
    const farPlayer = addHuman(scene, "far", new THREE.Vector3(0, 0, -CFG.courtL / 2 + 1.04), 0x62d2ff, aiHuman);
    const ball = createBall();
    scene.add(ball.mesh);
    const courtRules = new CourtRules();
    const ballController = new BallController(courtRules);
    const scoreManager = new ScoreManager();
    const serveController = new ServeController();
    const aiController = new AIController();
    const cameraController = new CameraController();
    const audioVfx = new AudioVFXManager();
    let currentServeSide: "deuce" | "ad" = scoreManager.snapshot().serveSide;
    let firstServeAttempt = true;
    let awaitingServeResult = false;
    let lastShotLabel = "";
    resetBallForServe(ball, nearPlayer, currentServeSide);
    serveController.start("near", currentServeSide);
    let netShakeT = 0;

    const ghost = new THREE.Mesh(
      new THREE.RingGeometry(0.25, 0.32, 36),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.42, side: THREE.DoubleSide })
    );
    ghost.rotation.x = -Math.PI / 2;
    ghost.position.copy(nearPlayer.target).setY(0.07);
    scene.add(ghost);

    const landingMarker = new THREE.Mesh(
      new THREE.RingGeometry(0.18, 0.24, 40),
      new THREE.MeshBasicMaterial({ color: 0xd7ff35, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
    );
    landingMarker.rotation.x = -Math.PI / 2;
    landingMarker.position.set(0, 0.075, 0);
    scene.add(landingMarker);

    let frameId = 0;
    let last = performance.now();
    let pointLock = false;
    let pointLockT = 0;
    let replayText = "";
    let replayT = 0;

    const setHudSafe = (patch: Partial<HudState>) => setHud((prev) => ({ ...prev, ...patch }));
    setHudSafe({ nearLabel: "0", farLabel: "0", nearGames: 0, farGames: 0, server: "near", serveSide: currentServeSide, firstServe: true });

    const awardPoint = (winner: PlayerSide, reason: PointReason) => {
      if (pointLock) return;
      pointLock = true;
      pointLockT = 0.9;
      ball.state = TennisBallState.PointEnded;
      awaitingServeResult = false;
      const score = scoreManager.awardPoint(winner);
      currentServeSide = score.serveSide;
      firstServeAttempt = true;
      serveController.start(score.server, currentServeSide);
      const reasonText = reason === "doubleFault" ? "Double Fault" : reason === "serviceFault" ? "Service fault" : reason === "out" ? "Out" : reason === "doubleBounce" ? "Double bounce" : reason === "net" ? "Net" : "Point";
      const gameText = score.gameWonBy ? ` · Game ${score.gameWonBy === "near" ? "You" : "AI"}` : "";
      replayText = `Replay: ${reasonText} — ${winner === "near" ? "You" : "AI"} scores${gameText}`;
      replayT = 1.7;
      audioVfx.play("point");
      setHud({
        ...hudRef.current,
        nearScore: score.points.near,
        farScore: score.points.far,
        nearLabel: score.label.near,
        farLabel: score.label.far,
        nearGames: score.games.near,
        farGames: score.games.far,
        server: score.server,
        serveSide: score.serveSide,
        firstServe: true,
        status: `${reasonText}: ${winner === "near" ? "You" : "AI"} scores${gameText}`,
        power: 0,
      });
    };

    const resize = () => {
      const w = Math.max(1, host.clientWidth);
      const h = Math.max(1, host.clientHeight);
      renderer.setSize(w, h, false);
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      camera.aspect = w / h;
      camera.fov = camera.aspect < 0.72 ? 52 : 46;
      if (camera.aspect < 0.72) cameraOffset.set(0, 8.85 * CFG.cameraViewScale, 14.25 * CFG.cameraViewScale);
      else cameraOffset.set(0, 8.25 * CFG.cameraViewScale, 13.15 * CFG.cameraViewScale);
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
        startTs: performance.now(),
        lastTs: performance.now(),
      };
      setHudSafe({ status: ball.lastHitBy === null ? "Hold, aim serve, release" : "Drag to move, release to swing", power: 0 });
    };

    const onPointerMove = (e: PointerEvent) => {
      const control = controlRef.current;
      if (!control.active || control.pointerId !== e.pointerId) return;
      control.lastX = e.clientX;
      control.lastY = e.clientY;
      control.lastTs = performance.now();
      const dx = e.clientX - control.startX;
      const dy = e.clientY - control.startY;
      nearPlayer.target.x = clamp(control.startPlayer.x + dx * 0.012, -CFG.courtW / 2 + 0.35, CFG.courtW / 2 - 0.35);
      const minZ = ball.lastHitBy === null ? CFG.serveNearBaselineZ : 0.76;
      if (ball.lastHitBy === null) {
        const lane = serveLaneBoundsX(currentServeSide, "near");
        nearPlayer.target.x = clamp(control.startPlayer.x + dx * 0.012, Math.min(lane.min, lane.max), Math.max(lane.min, lane.max));
      }
      nearPlayer.target.z = clamp(control.startPlayer.z + dy * 0.012, minZ, CFG.courtL / 2 - 0.42);
      setHudSafe({ power: clamp01(Math.hypot(dx, dy) / 185) });
    };

    const onPointerUp = (e: PointerEvent) => {
      const control = controlRef.current;
      if (!control.active || control.pointerId !== e.pointerId) return;
      try { canvas.releasePointerCapture(e.pointerId); } catch {}
      control.active = false;
      control.pointerId = null;
      const isServe = ball.lastHitBy === null && scoreManager.snapshot().server === "near";
      if (ball.lastHitBy === null && scoreManager.snapshot().server !== "near") return;
      const endTs = performance.now();
      const hit = makeUserTargetFromSwipe(control.startX, control.startY, e.clientX, e.clientY, Math.max(16, endTs - control.startTs), isServe, currentServeSide, canvas.clientWidth, canvas.clientHeight);
      startSwing(nearPlayer, hit, isServe ? "serve" : "forehand");
      setHudSafe({ status: isServe ? "Serve motion" : "Forehand swing", power: 0 });
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("resize", resize);
    resize();

    function currentServerPlayer() {
      return scoreManager.snapshot().server === "near" ? nearPlayer : farPlayer;
    }

    function updateServeTossLock() {
      if (ball.lastHitBy !== null) return false;
      const serverPlayer = currentServerPlayer();
      const preparingServe = serverPlayer.action === "ready" || serverPlayer.swingT <= 0;
      if (preparingServe) {
        ball.pos.copy(serveReadyBallPosition(serverPlayer));
        ball.vel.set(0, 0, 0);
        ball.spin = 0;
        ball.mesh.position.copy(ball.pos);
        return true;
      }
      const serving = serverPlayer.action === "serve" && serverPlayer.swingT > 0 && !serverPlayer.hitThisSwing;
      if (!serving) return false;
      if (serverPlayer.swingT < CFG.serveContactT) {
        ball.pos.copy(serveTossPosition(serverPlayer, serverPlayer.swingT));
        ball.vel.set(0, 0, 0);
        ball.spin = 0;
        ball.mesh.position.copy(ball.pos);
        return true;
      }
      return false;
    }

    function updateBall(dt: number) {
      const prevZ = ball.pos.z;
      const spinDip = Math.max(0, ball.spin) * 0.11;
      const spinLift = Math.max(0, -ball.spin) * 0.035;
      ball.vel.y -= CFG.gravity * (1 + spinDip - spinLift) * dt;
      if (ball.lastHitBy && Math.abs(ball.vel.z) > 0.001) {
        const forwardSign = ball.lastHitBy === "near" ? -1 : 1;
        ball.vel.z += forwardSign * ball.spin * 0.14 * CFG.worldScale * dt;
        ball.vel.x += Math.sin(ball.spin * 0.65) * 0.022 * CFG.worldScale * dt;
      }
      ball.vel.multiplyScalar(Math.exp(-CFG.airDrag * dt));
      ball.pos.addScaledVector(ball.vel, dt);
      ball.spin *= Math.exp(-1.25 * dt);

      if (ball.vel.length() > 0.02) {
        const rollAxis = new THREE.Vector3(ball.vel.z, 0, -ball.vel.x);
        if (rollAxis.lengthSq() > 0.0001) ball.mesh.rotateOnWorldAxis(rollAxis.normalize(), (ball.vel.length() / CFG.ballR) * dt);
      }

      const crossesNet = (prevZ > 0 && ball.pos.z <= 0) || (prevZ < 0 && ball.pos.z >= 0) || Math.abs(ball.pos.z) < 0.055;
      if (crossesNet && Math.abs(ball.pos.x) <= CFG.doublesW / 2 + 0.1 && ball.pos.y < CFG.netH + CFG.ballR * 0.6 && ball.lastHitBy) {
        const incoming = ball.vel.clone();
        const outgoing = incoming.multiplyScalar(0.2); // 80% power loss on net impact
        outgoing.z = Math.sign(outgoing.z || (ball.lastHitBy === "near" ? -1 : 1)) * Math.max(0.4, Math.abs(outgoing.z));
        outgoing.y = Math.max(0.45, Math.abs(outgoing.y) + 0.2);
        ball.vel.copy(outgoing);
        ball.pos.z = ball.lastHitBy === "near" ? -0.12 : 0.12;
        netShakeT = 0.45;
        audioVfx.play("net");
        awardPoint(opposite(ball.lastHitBy), "net");
      }

      if (ball.pos.y <= CFG.ballR) {
        ball.pos.y = CFG.ballR;
        if (ball.vel.y < 0) {
          const incomingZ = ball.vel.z;
          const forwardSign = ball.lastHitBy === "near" ? -1 : ball.lastHitBy === "far" ? 1 : Math.sign(ball.vel.z || 1);
          ball.vel.y = -ball.vel.y * CFG.bounceRestitution;
          ball.vel.x *= CFG.groundFriction;
          ball.vel.z *= CFG.groundFriction;
          ball.vel.z += forwardSign * ball.spin * 0.25 * CFG.worldScale;
          ball.vel.x += Math.sign(ball.vel.x || Math.sin(ball.spin)) * Math.abs(ball.spin) * 0.038 * CFG.worldScale;
          ball.vel.y *= clamp(1 - Math.max(0, ball.spin) * 0.045, 0.8, 1.06);
          if (Math.sign(incomingZ) !== Math.sign(ball.vel.z) && Math.abs(incomingZ) > 0.01) ball.vel.z *= 0.65;
          ball.spin *= -0.32;
          const bounceSide = sideOfZ(ball.pos.z);
          audioVfx.play("bounce");
          if (ball.bounceSide === bounceSide) ball.bounceCount += 1;
          else {
            ball.bounceSide = bounceSide;
            ball.bounceCount = 1;
          }
          const isServeBall = awaitingServeResult && ball.lastHitBy !== null && ball.bounceCount === 1;
          const serveHitter = isServeBall ? ball.lastHitBy : null;
          if (serveHitter && !courtRules.isInsideServiceBox(ball.pos, serveHitter, currentServeSide)) {
            if (firstServeAttempt) {
              firstServeAttempt = false;
              pointLock = false;
              pointLockT = 0;
              serveController.markFault();
              setHudSafe({ status: "Fault. Second serve", firstServe: false });
              nearPlayer.action = "ready";
              farPlayer.action = "ready";
              resetBallForServe(ball, serveHitter === "near" ? nearPlayer : farPlayer, currentServeSide);
              return;
            } else {
              serveController.markFault();
              awardPoint(opposite(serveHitter), "doubleFault");
              return;
            }
          }
          if (isServeBall) {
            awaitingServeResult = false;
            serveController.markValid();
            setHudSafe({ status: "Serve in. Rally!", firstServe: true });
          }
          const outsideX = Math.abs(ball.pos.x) > CFG.courtW / 2;
          const outsideZ = Math.abs(ball.pos.z) > CFG.courtL / 2;
          if (!isServeBall && (outsideX || outsideZ) && ball.lastHitBy) awardPoint(opposite(ball.lastHitBy), "out");
          else if (!isServeBall && ball.bounceCount > 1) awardPoint(opposite(bounceSide), "doubleBounce");
        }
      }

      if ((Math.abs(ball.pos.x) > CFG.courtW / 2 + 3.2 * CFG.worldScale || Math.abs(ball.pos.z) > CFG.courtL / 2 + 3.2 * CFG.worldScale || ball.pos.y < -1.2) && ball.lastHitBy) awardPoint(opposite(ball.lastHitBy), "out");
      if (ball.vel.length() < CFG.minBallSpeed && ball.pos.y <= CFG.ballR + 0.002 && ball.lastHitBy) awardPoint(opposite(sideOfZ(ball.pos.z)), "doubleBounce");
      ball.mesh.position.copy(ball.pos);
    }

    function updateNearAutoChase(landing: THREE.Vector3, dt: number) {
      if (!CFG.playerAutoChase.enabled || controlRef.current.active || pointLock) return;
      if (ball.lastHitBy === null) return;
      if (nearPlayer.swingT > 0) return;

      const ballComingToHuman = ball.lastHitBy === "far" && (ball.pos.z > -0.35 * CFG.worldScale || landing.z > 0);
      if (!ballComingToHuman) {
        const home = new THREE.Vector3(0, 0, CFG.courtL / 2 - 1.18 * CFG.worldScale);
        nearPlayer.target.lerp(home, 1 - Math.exp(-1.45 * dt));
        PlayerController.clampMovement(nearPlayer.target, "near");
        return;
      }

      const autoTarget = landing.clone();
      autoTarget.x = clamp(autoTarget.x, -CFG.courtW / 2 + 0.35 * CFG.worldScale, CFG.courtW / 2 - 0.35 * CFG.worldScale);
      autoTarget.z = clamp(
        autoTarget.z + CFG.playerAutoChase.anticipation * CFG.worldScale,
        0.82 * CFG.worldScale,
        CFG.courtL / 2 - 0.58 * CFG.worldScale
      );
      nearPlayer.target.lerp(autoTarget, 1 - Math.exp(-CFG.playerAutoChase.maxBlendPerSecond * dt));
      PlayerController.clampMovement(nearPlayer.target, "near");
    }

    function updateAi() {
      const landing = predictLanding(ball);
      const aiHomeZ = scoreManager.snapshot().server === "far" && ball.lastHitBy === null ? -CFG.serveNearBaselineZ : -CFG.courtL / 2 + 1.2 * CFG.worldScale;
      const home = new THREE.Vector3(0, 0, aiHomeZ);

      if (ball.lastHitBy === null && scoreManager.snapshot().server === "far") {
        farPlayer.target.copy(home);
        if (farPlayer.swingT === 0 && farPlayer.cooldown <= 0) {
          startSwing(farPlayer, { ...aiController.chooseServeTarget(currentServeSide, "far"), serveSide: currentServeSide }, "serve");
          setHudSafe({ status: "AI serve" });
        }
        return;
      }

      const ballComingToAi = ball.lastHitBy === "near" && (ball.pos.z < 0.65 * CFG.worldScale || landing.z < 0);
      if (ballComingToAi) {
        farPlayer.target.x = clamp(landing.x, -CFG.courtW / 2 + 0.35 * CFG.worldScale, CFG.courtW / 2 - 0.35 * CFG.worldScale);
        farPlayer.target.z = clamp(
          Math.min(-0.95 * CFG.worldScale, landing.z + 0.22 * CFG.worldScale),
          -CFG.courtL / 2 + 0.7 * CFG.worldScale,
          -0.82 * CFG.worldScale
        );
      } else {
        farPlayer.target.lerp(home, 0.035);
      }

      if (ballComingToAi && canReachBall(farPlayer, ball) && farPlayer.swingT === 0) {
        startSwing(farPlayer, makeAiTarget(nearPlayer, ball), "forehand");
      }
    }

    function checkSwingHits() {
      for (const player of [nearPlayer, farPlayer]) {
        if (player.swingT <= 0 || player.hitThisSwing || !player.desiredHit) continue;
        if (player.action === "serve") {
          if (player.swingT >= CFG.serveContactT) {
            performHit(player, ball, player.desiredHit, true);
            awaitingServeResult = true;
            serveController.markContact();
            audioVfx.play("racket");
            setHudSafe({ status: "Serve!", firstServe: firstServeAttempt });
          }
          continue;
        }
        const isAi = player.side === "far";
        const hitStart = isAi ? Math.max(0.3, CFG.timingWindow.start - 0.12) : CFG.timingWindow.start;
        const hitEnd = isAi ? Math.min(0.88, CFG.timingWindow.end + 0.14) : CFG.timingWindow.end;
        if (player.swingT < hitStart || player.swingT > hitEnd) continue;
        if (canReachBall(player, ball)) {
          performHit(player, ball, player.desiredHit, false);
          audioVfx.play("racket");
          const sideLabel = ball.pos.x < player.pos.x ? "Backhand" : "Forehand";
          lastShotLabel = `${sideLabel} ${player.desiredHit.technique || "flat"}`;
          setHudSafe({ status: player.side === "near" ? `${lastShotLabel} return` : `AI ${lastShotLabel}` });
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
          currentServeSide = scoreManager.snapshot().serveSide;
          const serverPlayer = scoreManager.snapshot().server === "near" ? nearPlayer : farPlayer;
          resetBallForServe(ball, serverPlayer, currentServeSide);
          serveController.start(scoreManager.snapshot().server, currentServeSide);
          setHudSafe({ status: scoreManager.snapshot().server === "near" ? (firstServeAttempt ? "Swipe up to serve from behind the baseline" : "Second serve") : "AI preparing serve", power: 0, serveSide: currentServeSide, firstServe: firstServeAttempt, server: scoreManager.snapshot().server });
        }
      } else {
        ballController.accumulator = Math.min(ballController.accumulator + dt, CFG.fixedTimeStep * CFG.maxPhysicsSteps);
        let steps = 0;
        while (ballController.accumulator >= CFG.fixedTimeStep && steps < CFG.maxPhysicsSteps) {
          updateAi();
          const ballLockedByServe = updateServeTossLock();
          checkSwingHits();
          if (!ballLockedByServe || ball.lastHitBy !== null) updateBall(CFG.fixedTimeStep);
          ballController.accumulator -= CFG.fixedTimeStep;
          steps += 1;
        }
      }

      const predictedLanding = predictLanding(ball);
      updateNearAutoChase(predictedLanding, dt);

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

      const landingUseful = ball.lastHitBy !== null && ball.vel.lengthSq() > 0.25 && predictedLanding.y <= CFG.ballR + 0.05 && Math.abs(predictedLanding.x) <= CFG.courtW / 2 + 0.6 && Math.abs(predictedLanding.z) <= CFG.courtL / 2 + 0.8;
      landingMarker.position.set(clamp(predictedLanding.x, -CFG.courtW / 2, CFG.courtW / 2), 0.078, clamp(predictedLanding.z, -CFG.courtL / 2, CFG.courtL / 2));
      (landingMarker.material as THREE.MeshBasicMaterial).opacity += ((landingUseful ? 0.55 : 0) - (landingMarker.material as THREE.MeshBasicMaterial).opacity) * (1 - Math.exp(-10 * dt));

      const preServe = ball.lastHitBy === null;
      cameraController.update(camera, cameraTarget, cameraPosTarget, nearPlayer.target, ball.pos, cameraOffset, preServe, dt, {
        incomingSide: ball.lastHitBy === "far" ? "near" : ball.lastHitBy === "near" ? "far" : null,
        predictedLanding,
      });
      updateBillboards();
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
  }, [selectedHumanCharacterId]);

  useEffect(() => {
    localStorage.setItem("tennisSelectedHumanCharacter", selectedHumanCharacterId);
  }, [selectedHumanCharacterId]);


  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#07100c", touchAction: "none", userSelect: "none" }}>
      <div ref={hostRef} style={{ position: "absolute", inset: 0 }}>
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }} />
      </div>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif" }}>
        <UIOverlay hud={hud} playerName={playerName} rivalName={rivalName} playerAvatar={playerAvatar} onMenu={() => setMenuOpen((v) => !v)} />

        {menuOpen && (
          <div style={{ position: "absolute", right: 10, top: 108, width: 230, maxHeight: 330, overflow: "auto", background: "rgba(8,16,24,0.94)", border: "1px solid rgba(255,255,255,0.22)", borderRadius: 12, padding: 8, pointerEvents: "auto" }}>
            <div style={{ color: "#fff", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Domino Royal Characters</div>
            <div style={{ color: "rgba(255,255,255,.7)", fontSize: 10, marginBottom: 8 }}>HDRIs removed: training court uses built-in lights, sky, fence, Poly Haven mapped cloth textures and model-native hair/eyes styling.</div>
            {MURLAN_CHARACTER_THEMES.slice(0, 7).map((opt) => (
              <button key={opt.id} type="button" onClick={() => setSelectedHumanCharacterId(opt.id)} style={{ width: "100%", display: "flex", gap: 8, alignItems: "center", marginBottom: 6, borderRadius: 10, border: selectedHumanCharacterId === opt.id ? "1px solid #7dd3fc" : "1px solid rgba(255,255,255,.18)", background: "rgba(255,255,255,0.08)", padding: 6, color: "#fff" }}>
                <span style={{ width: 42, height: 24, borderRadius: 6, background: `linear-gradient(135deg,#${(opt.hairColor ?? 0x24150f).toString(16).padStart(6, "0")},#${(opt.eyeColor ?? 0x2f5d7c).toString(16).padStart(6, "0")})`, border: "1px solid rgba(255,255,255,.2)" }} />
                <span style={{ fontSize: 11, textAlign: "left" }}>{opt.label}</span>
              </button>
            ))}
          </div>
        )}
  
      </div>
    </div>
  );
}
