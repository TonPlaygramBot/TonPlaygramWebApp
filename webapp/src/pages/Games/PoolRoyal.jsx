"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

const TABLE_MODEL_URL =
  "https://cdn.jsdelivr.net/gh/ekiefl/pooltool@main/pooltool/models/table/seven_foot_showood/seven_foot_showood.glb";
const DRACO_DECODER_PATH = "https://www.gstatic.com/draco/versioned/decoders/1.5.7/";
const BASIS_TRANSCODER_PATH = "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/basis/";
const CUSHION_SHADOW_GREY = "#666a72";

type TablePart =
  | "cloth"
  | "cushion"
  | "topWoodRail"
  | "sideWoodApron"
  | "pocketCup"
  | "cornerPocketPlate"
  | "middlePocketPlate"
  | "verticalCornerRim"
  | "baseCornerBlock"
  | "leg"
  | "baseFoot"
  | "lowerTrim"
  | "railSight"
  | "underside";

type ControlPart = "cloth" | "cushion" | "metalAccent" | "jaws" | "topWoodRail" | "legBase";
type ChoiceKey = "a" | "b";
type Palette = Record<ControlPart, ChoiceKey>;
type WorkingMaterial = THREE.MeshPhysicalMaterial;
type MaterialBuckets = Record<TablePart, WorkingMaterial[]>;

type Counts = Record<TablePart, number> & {
  sourceMeshes: number;
  sourceSlots: number;
  sourceTextures: number;
  triangleGroups: number;
};

type ColorOption = {
  label: string;
  color: string;
  metalness: number;
  roughness: number;
  envMapIntensity: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
};

type MaterialSnapshot = {
  color: THREE.Color;
  emissive: THREE.Color;
  metalness: number;
  roughness: number;
  envMapIntensity: number;
  clearcoat: number;
  clearcoatRoughness: number;
  map: THREE.Texture | null;
  normalMap: THREE.Texture | null;
  bumpMap: THREE.Texture | null;
  roughnessMap: THREE.Texture | null;
  metalnessMap: THREE.Texture | null;
  aoMap: THREE.Texture | null;
  emissiveMap: THREE.Texture | null;
  lightMap: THREE.Texture | null;
  alphaMap: THREE.Texture | null;
  transparent: boolean;
  opacity: number;
};

type TriangleRecord = {
  a: number;
  b: number;
  c: number;
  sourceMaterialIndex: number;
  sourceSlot: string;
  part: TablePart;
  cushionShadow: boolean;
};

type MeshBuildData = {
  mesh: THREE.Mesh;
  sourceGeometry: THREE.BufferGeometry;
  sourceMaterials: WorkingMaterial[];
  triangles: TriangleRecord[];
};

type SlotStat = {
  total: number;
  dominantPart: TablePart;
  dominantRatio: number;
  parts: Partial<Record<TablePart, number>>;
};

type PickInfo = {
  part: TablePart;
  meshName: string;
  materialName: string;
  sourceSlot: string;
  point: string;
};

const TABLE_PARTS: TablePart[] = [
  "cloth",
  "cushion",
  "topWoodRail",
  "sideWoodApron",
  "pocketCup",
  "cornerPocketPlate",
  "middlePocketPlate",
  "verticalCornerRim",
  "baseCornerBlock",
  "leg",
  "baseFoot",
  "lowerTrim",
  "railSight",
  "underside",
];

const CONTROL_PARTS: ControlPart[] = ["cloth", "cushion", "metalAccent", "jaws", "topWoodRail", "legBase"];

const CONTROL_META: Record<ControlPart, { label: string; description: string }> = {
  cloth: { label: "Field cloth", description: "Only the flat playfield surface." },
  cushion: {
    label: "Cushions",
    description: "Uses the same cushion mapping/texture behavior as the reference code: Matched green or Black rubber, source cushion texture preserved.",
  },
  metalAccent: {
    label: "Rail sights + side strip + feet",
    description: "One gold/chrome control for rail sights, side apron strip, vertical rims, trims, plates, and feet.",
  },
  jaws: { label: "Jaws", description: "Pocket jaws / cups: black or brown." },
  topWoodRail: { label: "Top rail frame", description: "Main top wood rail frame." },
  legBase: { label: "Legs + base", description: "Legs and lower base blocks together, separate from metal accents." },
};

const CONTROL_OPTIONS: Record<ControlPart, Record<ChoiceKey, ColorOption>> = {
  cloth: {
    a: { label: "Green field", color: "#0a7b33", metalness: 0, roughness: 1, envMapIntensity: 0.16 },
    b: { label: "Blue field", color: "#0d4fb8", metalness: 0, roughness: 1, envMapIntensity: 0.16 },
  },
  cushion: {
    a: { label: "Matched green", color: "#064f22", metalness: 0, roughness: 0.88, envMapIntensity: 0.55 },
    b: { label: "Black rubber", color: "#050505", metalness: 0, roughness: 0.86, envMapIntensity: 0.55 },
  },
  metalAccent: {
    a: { label: "Gold", color: "#d8b23d", metalness: 0.98, roughness: 0.06, envMapIntensity: 6.8, clearcoat: 1, clearcoatRoughness: 0.03 },
    b: { label: "Chrome", color: "#d7dde7", metalness: 1, roughness: 0.055, envMapIntensity: 7.2, clearcoat: 1, clearcoatRoughness: 0.025 },
  },
  jaws: {
    a: { label: "Black jaws", color: "#020202", metalness: 0, roughness: 0.96, envMapIntensity: 0.14 },
    b: { label: "Brown jaws", color: "#2a1207", metalness: 0, roughness: 0.88, envMapIntensity: 0.26 },
  },
  topWoodRail: {
    a: { label: "Walnut frame", color: "#5a2608", metalness: 0.02, roughness: 0.38, envMapIntensity: 1.35, clearcoat: 0.42, clearcoatRoughness: 0.18 },
    b: { label: "Black frame", color: "#070605", metalness: 0.04, roughness: 0.28, envMapIntensity: 1.75, clearcoat: 0.7, clearcoatRoughness: 0.1 },
  },
  legBase: {
    a: { label: "Brown legs/base", color: "#3d1706", metalness: 0.02, roughness: 0.52, envMapIntensity: 1, clearcoat: 0.2, clearcoatRoughness: 0.36 },
    b: { label: "Black legs/base", color: "#070504", metalness: 0.04, roughness: 0.4, envMapIntensity: 1.22, clearcoat: 0.32, clearcoatRoughness: 0.26 },
  },
};

const PART_TO_CONTROL: Record<TablePart, ControlPart> = {
  cloth: "cloth",
  cushion: "cushion",
  topWoodRail: "topWoodRail",
  sideWoodApron: "metalAccent",
  pocketCup: "jaws",
  cornerPocketPlate: "metalAccent",
  middlePocketPlate: "metalAccent",
  verticalCornerRim: "metalAccent",
  baseCornerBlock: "legBase",
  leg: "legBase",
  baseFoot: "metalAccent",
  lowerTrim: "metalAccent",
  railSight: "metalAccent",
  underside: "legBase",
};

const KEEP_TEXTURE_PARTS = new Set<TablePart>(["cushion", "topWoodRail", "leg", "baseCornerBlock", "underside"]);
const FINE_PARTS = new Set<TablePart>([
  "pocketCup",
  "cornerPocketPlate",
  "middlePocketPlate",
  "verticalCornerRim",
  "baseCornerBlock",
  "lowerTrim",
  "railSight",
  "underside",
]);

const DEFAULT_PALETTE: Palette = {
  cloth: "a",
  cushion: "a",
  metalAccent: "a",
  jaws: "a",
  topWoodRail: "a",
  legBase: "b",
};

const EMPTY_COUNTS: Counts = {
  cloth: 0,
  cushion: 0,
  topWoodRail: 0,
  sideWoodApron: 0,
  pocketCup: 0,
  cornerPocketPlate: 0,
  middlePocketPlate: 0,
  verticalCornerRim: 0,
  baseCornerBlock: 0,
  leg: 0,
  baseFoot: 0,
  lowerTrim: 0,
  railSight: 0,
  underside: 0,
  sourceMeshes: 0,
  sourceSlots: 0,
  sourceTextures: 0,
  triangleGroups: 0,
};

const createBuckets = (): MaterialBuckets =>
  TABLE_PARTS.reduce((acc, part) => {
    acc[part] = [];
    return acc;
  }, {} as MaterialBuckets);

const cleanName = (value?: string | null) => (value || "unnamed").replace(/\s+/g, "_").toLowerCase();

const makeSlotKey = (mesh: THREE.Mesh, sourceMaterialIndex: number, material: THREE.Material) =>
  `${cleanName(mesh.name)}::slot_${sourceMaterialIndex}::${cleanName(material.name)}`;

const optionForPart = (part: TablePart, palette: Palette) =>
  CONTROL_OPTIONS[PART_TO_CONTROL[part]][palette[PART_TO_CONTROL[part]]];

function patchTexture(texture?: THREE.Texture | null, isColorTexture = false) {
  if (!texture) return;
  if (isColorTexture) texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  texture.needsUpdate = true;
}

function patchMaterial(material: THREE.Material) {
  const mat = material as WorkingMaterial;
  [mat.map, mat.emissiveMap, mat.lightMap].forEach((texture) => patchTexture(texture, true));
  [mat.normalMap, mat.bumpMap, mat.roughnessMap, mat.metalnessMap, mat.aoMap, mat.alphaMap].forEach((texture) => patchTexture(texture));
  mat.side = THREE.DoubleSide;
  mat.needsUpdate = true;
}

function snapshotMaterial(material: WorkingMaterial): MaterialSnapshot {
  return {
    color: material.color.clone(),
    emissive: material.emissive.clone(),
    metalness: material.metalness,
    roughness: material.roughness,
    envMapIntensity: material.envMapIntensity,
    clearcoat: material.clearcoat ?? 0,
    clearcoatRoughness: material.clearcoatRoughness ?? 0,
    map: material.map ?? null,
    normalMap: material.normalMap ?? null,
    bumpMap: material.bumpMap ?? null,
    roughnessMap: material.roughnessMap ?? null,
    metalnessMap: material.metalnessMap ?? null,
    aoMap: material.aoMap ?? null,
    emissiveMap: material.emissiveMap ?? null,
    lightMap: material.lightMap ?? null,
    alphaMap: material.alphaMap ?? null,
    transparent: material.transparent,
    opacity: material.opacity,
  };
}

function restoreMaterial(material: WorkingMaterial) {
  const snap = material.userData.originalSnapshot as MaterialSnapshot | undefined;
  if (!snap) return;
  material.color.copy(snap.color);
  material.emissive.copy(snap.emissive);
  material.metalness = snap.metalness;
  material.roughness = snap.roughness;
  material.envMapIntensity = snap.envMapIntensity;
  material.clearcoat = snap.clearcoat;
  material.clearcoatRoughness = snap.clearcoatRoughness;
  material.map = snap.map;
  material.normalMap = snap.normalMap;
  material.bumpMap = snap.bumpMap;
  material.roughnessMap = snap.roughnessMap;
  material.metalnessMap = snap.metalnessMap;
  material.aoMap = snap.aoMap;
  material.emissiveMap = snap.emissiveMap;
  material.lightMap = snap.lightMap;
  material.alphaMap = snap.alphaMap;
  material.transparent = snap.transparent;
  material.opacity = snap.opacity;
  material.depthWrite = true;
}

function clearMaps(material: WorkingMaterial) {
  material.map = null;
  material.normalMap = null;
  material.bumpMap = null;
  material.roughnessMap = null;
  material.metalnessMap = null;
  material.aoMap = null;
  material.emissiveMap = null;
  material.lightMap = null;
  material.alphaMap = null;
}

function cloneWorking(raw: THREE.Material): WorkingMaterial {
  const source = raw as Partial<WorkingMaterial>;
  const material = new THREE.MeshPhysicalMaterial({
    name: raw.name || "source_material",
    color: source.color ? source.color.clone() : new THREE.Color("#ffffff"),
    emissive: source.emissive ? source.emissive.clone() : new THREE.Color("#000000"),
    map: source.map ?? null,
    normalMap: source.normalMap ?? null,
    bumpMap: source.bumpMap ?? null,
    roughnessMap: source.roughnessMap ?? null,
    metalnessMap: source.metalnessMap ?? null,
    aoMap: source.aoMap ?? null,
    emissiveMap: source.emissiveMap ?? null,
    lightMap: source.lightMap ?? null,
    alphaMap: source.alphaMap ?? null,
    roughness: typeof source.roughness === "number" ? source.roughness : 0.55,
    metalness: typeof source.metalness === "number" ? source.metalness : 0,
    transparent: raw.transparent,
    opacity: raw.opacity,
  });
  material.clearcoat = typeof source.clearcoat === "number" ? source.clearcoat : 0;
  material.clearcoatRoughness = typeof source.clearcoatRoughness === "number" ? source.clearcoatRoughness : 0.18;
  material.userData.originalSnapshot = snapshotMaterial(material);
  patchMaterial(material);
  return material;
}

function colorFlags(material: WorkingMaterial) {
  const color = material.color instanceof THREE.Color ? material.color : new THREE.Color("#ffffff");
  return {
    green: color.g > color.r * 1.14 && color.g > color.b * 1.08 && color.g > 0.11,
    black: color.r < 0.11 && color.g < 0.11 && color.b < 0.11,
    brown: color.r > color.b * 1.12 && color.g > color.b * 0.48 && color.r > 0.07 && color.g < color.r * 0.9,
    gold: color.r > 0.42 && color.g > 0.29 && color.b < 0.25 && color.r >= color.g * 0.88,
    light: color.r > 0.72 && color.g > 0.72 && color.b > 0.62,
  };
}

function materialIndexAtOffset(geometry: THREE.BufferGeometry, offset: number) {
  if (!geometry.groups.length) return 0;
  return geometry.groups.find((item) => offset >= item.start && offset < item.start + item.count)?.materialIndex ?? 0;
}

function triangleWorld(mesh: THREE.Mesh, geometry: THREE.BufferGeometry, aIndex: number, bIndex: number, cIndex: number) {
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const a = new THREE.Vector3().fromBufferAttribute(position, aIndex).applyMatrix4(mesh.matrixWorld);
  const b = new THREE.Vector3().fromBufferAttribute(position, bIndex).applyMatrix4(mesh.matrixWorld);
  const c = new THREE.Vector3().fromBufferAttribute(position, cIndex).applyMatrix4(mesh.matrixWorld);
  const center = new THREE.Vector3().addVectors(a, b).add(c).multiplyScalar(1 / 3);
  const normal = new THREE.Vector3()
    .crossVectors(new THREE.Vector3().subVectors(b, a), new THREE.Vector3().subVectors(c, a))
    .normalize()
    .transformDirection(mesh.matrixWorld);
  return { center, normal };
}

function spatialContext(
  mesh: THREE.Mesh,
  geometry: THREE.BufferGeometry,
  aIndex: number,
  bIndex: number,
  cIndex: number,
  tableBox: THREE.Box3,
  tableCenter: THREE.Vector3,
  tableSize: THREE.Vector3
) {
  const { center, normal } = triangleWorld(mesh, geometry, aIndex, bIndex, cIndex);
  const relX = Math.abs(center.x - tableCenter.x) / Math.max(tableSize.x * 0.5, 0.001);
  const relZ = Math.abs(center.z - tableCenter.z) / Math.max(tableSize.z * 0.5, 0.001);
  const relY = (center.y - tableBox.min.y) / Math.max(tableSize.y, 0.001);
  const xIsLongAxis = tableSize.x >= tableSize.z;
  const longN = xIsLongAxis ? relX : relZ;
  const shortN = xIsLongAxis ? relZ : relX;
  const upFace = normal.y > 0.33;
  const sideFace = Math.abs(normal.x) > 0.25 || Math.abs(normal.z) > 0.25;
  const downFace = normal.y < -0.33;
  return { relY, longN, shortN, upFace, sideFace, downFace };
}

function classifyTriangle(
  mesh: THREE.Mesh,
  geometry: THREE.BufferGeometry,
  material: WorkingMaterial,
  aIndex: number,
  bIndex: number,
  cIndex: number,
  tableBox: THREE.Box3,
  tableCenter: THREE.Vector3,
  tableSize: THREE.Vector3
): TablePart {
  const name = `${mesh.name || ""} ${material.name || ""}`.toLowerCase();
  const s = spatialContext(mesh, geometry, aIndex, bIndex, cIndex, tableBox, tableCenter, tableSize);
  const flags = colorFlags(material);

  const namedCloth = /cloth|felt|fabric|surface|bed|slate/i.test(name);
  const namedCushion = /cushion|rubber|bumper|railrubber/i.test(name);
  const namedPocket = /pocket|hole|drop|net|liner|leather|cup/i.test(name);
  const namedHardware = /trim|bezel|ring|metal|chrome|brass|gold|plate|cap|rim|guard|insert|hardware|bolt|screw/i.test(name);
  const namedSight = /sight|diamond|marker|dot|inlay/i.test(name);
  const namedWood = /wood|walnut|rail|apron|leg|base|frame|cabinet|corner|showood|support/i.test(name);
  const metalish = material.metalness > 0.16 || material.clearcoat > 0.58 || flags.gold;

  const high = s.relY > 0.54;
  const veryTop = s.relY > 0.65;
  const midBody = s.relY > 0.16 && s.relY <= 0.62;
  const low = s.relY <= 0.16;

  const sideMiddlePocketZone = high && s.longN < 0.255 && s.shortN > 0.69;
  const cornerPocketZone = high && s.longN > 0.68 && s.shortN > 0.66;
  const anyPocketZone = sideMiddlePocketZone || cornerPocketZone;

  const centralCloth = high && s.upFace && s.longN < 0.61 && s.shortN < 0.53;

  // Cushion mapping intentionally mirrors the reference code supplied by the user.
  // Do not expand this into rail/apron/rim zones; all other parts keep the existing mapping below.
  const cushionBand = high && (s.longN > 0.52 || s.shortN > 0.49) && (s.longN < 0.9 || s.shortN < 0.9);

  const topRailBand = high && (s.longN > 0.58 || s.shortN > 0.535);
  const topRailNonPocket = topRailBand && !anyPocketZone;

  const topRailSideVerticalRimZone =
    s.sideFace && !s.upFace && s.relY > 0.46 && s.relY < 0.96 && s.longN > 0.6 && s.shortN > 0.58;

  const underRailSightCornerRimZone =
    s.sideFace && !s.upFace && s.relY > 0.36 && s.relY < 0.76 && s.longN > 0.67 && s.shortN > 0.52;

  const outsideBaseCornerRimZone =
    s.sideFace && s.relY > 0.08 && s.relY < 0.78 && s.longN > 0.72 && s.shortN > 0.54;

  const outerMostVerticalCorner =
    s.sideFace && s.relY > 0.1 && s.relY < 0.8 && s.longN > 0.8 && s.shortN > 0.68;

  const baseCornerZone =
    s.sideFace &&
    s.relY > 0.12 &&
    s.relY < 0.64 &&
    ((s.longN > 0.1 && s.longN < 0.56 && s.shortN < 0.36) ||
      (s.longN > 0.58 && s.shortN > 0.56)) &&
    !(underRailSightCornerRimZone || topRailSideVerticalRimZone);

  const legZone = s.sideFace && s.relY > 0.14 && s.relY < 0.62 && s.longN < 0.62 && s.shortN < 0.58;

  const railSightDownBand =
    s.sideFace &&
    !s.upFace &&
    !anyPocketZone &&
    s.relY > 0.44 &&
    s.relY < 0.72 &&
    (s.longN > 0.54 || s.shortN > 0.48) &&
    !(topRailSideVerticalRimZone || underRailSightCornerRimZone || outsideBaseCornerRimZone || outerMostVerticalCorner || baseCornerZone || legZone);

  const sideLowerTrimZone =
    s.sideFace && s.relY > 0.18 && s.relY < 0.44 && (s.longN > 0.54 || s.shortN > 0.54);

  const hardwareCandidate =
    namedHardware ||
    metalish ||
    ((flags.black || flags.gold || flags.light) && !flags.green && !flags.brown && !namedWood);

  const pocketInteriorCandidate =
    namedPocket ||
    (flags.black && anyPocketZone && (s.downFace || s.sideFace || s.relY < 0.79) && !hardwareCandidate);

  // Reference cushion routes first.
  if (namedCloth) return "cloth";
  if (namedCushion) return "cushion";
  if (namedSight && high) return "railSight";

  if (pocketInteriorCandidate) return "pocketCup";
  if (namedPocket && hardwareCandidate && sideMiddlePocketZone) return "middlePocketPlate";
  if (namedPocket && hardwareCandidate && cornerPocketZone) return "cornerPocketPlate";
  if (hardwareCandidate && sideMiddlePocketZone && !flags.green && !flags.brown) return "middlePocketPlate";
  if (hardwareCandidate && cornerPocketZone && !flags.green && !flags.brown) return "cornerPocketPlate";

  if (flags.green && centralCloth) return "cloth";
  if (flags.green && cushionBand) return "cushion";

  if (topRailSideVerticalRimZone || underRailSightCornerRimZone || outsideBaseCornerRimZone || outerMostVerticalCorner) {
    return "verticalCornerRim";
  }

  if (hardwareCandidate && topRailNonPocket && s.upFace && !flags.brown && !flags.green) return "railSight";

  if (low) return "baseFoot";
  if (s.downFace && s.relY < 0.5) return "underside";
  if ((flags.brown || namedWood) && baseCornerZone) return "baseCornerBlock";
  if (baseCornerZone) return "baseCornerBlock";
  if (legZone && (flags.brown || namedWood || !hardwareCandidate)) return "leg";
  if (hardwareCandidate && sideLowerTrimZone && !flags.green) return "lowerTrim";
  if (railSightDownBand && !flags.green) return "sideWoodApron";
  if (veryTop && (s.upFace || topRailBand) && !flags.green) return "topWoodRail";
  if (high && s.sideFace && !flags.green && !anyPocketZone) return "sideWoodApron";

  return "sideWoodApron";
}

function isCushionShadowTriangle(
  mesh: THREE.Mesh,
  geometry: THREE.BufferGeometry,
  aIndex: number,
  bIndex: number,
  cIndex: number,
  tableBox: THREE.Box3,
  tableCenter: THREE.Vector3,
  tableSize: THREE.Vector3
) {
  const s = spatialContext(mesh, geometry, aIndex, bIndex, cIndex, tableBox, tableCenter, tableSize);
  return (
    s.downFace &&
    s.relY > 0.46 &&
    s.relY < 0.84 &&
    ((s.longN > 0.6 && s.longN < 0.95) || (s.shortN > 0.42 && s.shortN < 0.88))
  );
}

function createSlotStat(): SlotStat {
  return {
    total: 0,
    dominantPart: "sideWoodApron",
    dominantRatio: 1,
    parts: TABLE_PARTS.reduce((acc, part) => {
      acc[part] = 0;
      return acc;
    }, {} as Partial<Record<TablePart, number>>),
  };
}

function updateSlotStat(stats: Map<string, SlotStat>, sourceSlot: string, part: TablePart) {
  const stat = stats.get(sourceSlot) ?? createSlotStat();
  stat.total += 1;
  stat.parts[part] = (stat.parts[part] || 0) + 1;
  stat.dominantPart = TABLE_PARTS.reduce(
    (best, item) => ((stat.parts[item] || 0) > (stat.parts[best] || 0) ? item : best),
    stat.dominantPart
  );
  stat.dominantRatio = stat.total > 0 ? (stat.parts[stat.dominantPart] || 0) / stat.total : 1;
  stats.set(sourceSlot, stat);
}

function isMixedClothCushionSlot(stat?: SlotStat | null) {
  return Boolean(stat && (stat.parts.cloth || 0) > 0 && (stat.parts.cushion || 0) > 0);
}

function resolvePart(triangle: TriangleRecord, slotStats: Map<string, SlotStat>) {
  const stat = slotStats.get(triangle.sourceSlot);
  if (!stat) return triangle.part;
  if (FINE_PARTS.has(triangle.part) && triangle.part !== stat.dominantPart) return triangle.part;
  if (isMixedClothCushionSlot(stat) && (triangle.part === "cloth" || triangle.part === "cushion")) {
    return triangle.part;
  }
  if ((triangle.part === "cloth" || triangle.part === "cushion") && stat.dominantRatio >= 0.88) {
    return stat.dominantPart;
  }
  return stat.dominantRatio >= 0.965 ? stat.dominantPart : triangle.part;
}

function applyMaterial(
  material: WorkingMaterial,
  part: TablePart,
  option: ColorOption,
  cushionShadow = false
) {
  restoreMaterial(material);

  if (part === "cushion" && cushionShadow) {
    material.color.set(CUSHION_SHADOW_GREY);
    material.metalness = 0;
    material.roughness = 0.96;
    material.envMapIntensity = 0.22;
    material.clearcoat = 0;
    material.clearcoatRoughness = 0;
    clearMaps(material);
  } else {
    material.color.set(option.color);
    material.metalness = option.metalness;
    material.roughness = option.roughness;
    material.envMapIntensity = option.envMapIntensity;
    material.clearcoat = option.clearcoat ?? 0;
    material.clearcoatRoughness = option.clearcoatRoughness ?? 0;

    if (!KEEP_TEXTURE_PARTS.has(part)) clearMaps(material);
  }

  material.transparent = false;
  material.opacity = 1;
  material.depthWrite = true;
  material.userData.part = part;
  material.userData.cushionShadow = cushionShadow;
  patchMaterial(material);
}

function makePartMaterial(
  source: WorkingMaterial,
  part: TablePart,
  palette: Palette,
  buckets: MaterialBuckets,
  sourceSlot: string,
  meshName: string,
  materialName: string,
  cushionShadow = false
) {
  const material = source.clone() as WorkingMaterial;
  material.name = `${source.name || "source"}__${part}${cushionShadow ? "__shadow" : ""}`;
  material.userData.originalSnapshot = snapshotMaterial(source);
  material.userData.part = part;
  material.userData.sourceSlot = sourceSlot;
  material.userData.meshName = meshName;
  material.userData.materialName = materialName;
  material.userData.cushionShadow = cushionShadow;
  applyMaterial(material, part, optionForPart(part, palette), cushionShadow);
  buckets[part].push(material);
  return material;
}

function applyPaletteToBuckets(buckets: MaterialBuckets, palette: Palette) {
  TABLE_PARTS.forEach((part) => {
    buckets[part].forEach((material) =>
      applyMaterial(material, part, optionForPart(part, palette), Boolean(material.userData.cushionShadow))
    );
  });
}

function countTextures(materials: WorkingMaterial[]) {
  const textures = new Set<THREE.Texture>();
  materials.forEach((material) => {
    [
      material.map,
      material.normalMap,
      material.bumpMap,
      material.roughnessMap,
      material.metalnessMap,
      material.aoMap,
      material.emissiveMap,
      material.lightMap,
      material.alphaMap,
    ].forEach((texture) => texture && textures.add(texture));
  });
  return textures.size;
}

function splitTableIntoMappedParts(root: THREE.Object3D, palette: Palette, buckets: MaterialBuckets) {
  root.updateMatrixWorld(true);
  const tableBox = new THREE.Box3().setFromObject(root);
  const tableCenter = tableBox.getCenter(new THREE.Vector3());
  const tableSize = tableBox.getSize(new THREE.Vector3());

  const counts: Counts = { ...EMPTY_COUNTS };
  const slotStats = new Map<string, SlotStat>();
  const buildData: MeshBuildData[] = [];
  const textureMaterials: WorkingMaterial[] = [];

  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;

    const sourceGeometry = mesh.geometry.clone();
    const sourceMaterials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((material) =>
      cloneWorking(material)
    );
    const position = sourceGeometry.attributes.position as THREE.BufferAttribute | undefined;
    if (!position) return;

    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;

    counts.sourceMeshes += 1;
    textureMaterials.push(...sourceMaterials);

    const oldIndex = sourceGeometry.index;
    const totalIndices = oldIndex ? oldIndex.count : position.count;
    const triangles: TriangleRecord[] = [];

    for (let i = 0; i + 2 < totalIndices; i += 3) {
      const a = oldIndex ? oldIndex.getX(i) : i;
      const b = oldIndex ? oldIndex.getX(i + 1) : i + 1;
      const c = oldIndex ? oldIndex.getX(i + 2) : i + 2;
      const sourceMaterialIndex = Math.min(materialIndexAtOffset(sourceGeometry, i), sourceMaterials.length - 1);
      const sourceMaterial = sourceMaterials[Math.max(0, sourceMaterialIndex)];
      const sourceSlot = makeSlotKey(mesh, sourceMaterialIndex, sourceMaterial);

      const part = classifyTriangle(mesh, sourceGeometry, sourceMaterial, a, b, c, tableBox, tableCenter, tableSize);

      const cushionShadow =
        part === "cushion" &&
        isCushionShadowTriangle(mesh, sourceGeometry, a, b, c, tableBox, tableCenter, tableSize);

      triangles.push({ a, b, c, sourceMaterialIndex, sourceSlot, part, cushionShadow });
      updateSlotStat(slotStats, sourceSlot, part);
    }

    buildData.push({ mesh, sourceGeometry, sourceMaterials, triangles });
  });

  counts.sourceSlots = slotStats.size;
  counts.sourceTextures = countTextures(textureMaterials);

  buildData.forEach(({ mesh, sourceGeometry, sourceMaterials, triangles }) => {
    const finalGeometry = sourceGeometry.clone();
    const finalMaterials: WorkingMaterial[] = [];
    const materialLookup = new Map<string, number>();
    const finalIndex: number[] = [];
    finalGeometry.clearGroups();

    const getMaterialIndex = (
      sourceMaterialIndex: number,
      sourceSlot: string,
      part: TablePart,
      cushionShadow = false
    ) => {
      const key = `${sourceSlot}::${part}::${cushionShadow ? "shadow" : "main"}`;
      const existing = materialLookup.get(key);
      if (existing !== undefined) return existing;

      const source = sourceMaterials[Math.max(0, Math.min(sourceMaterialIndex, sourceMaterials.length - 1))];
      const material = makePartMaterial(
        source,
        part,
        palette,
        buckets,
        sourceSlot,
        mesh.name || "unnamed mesh",
        source.name || "unnamed material",
        cushionShadow
      );
      const index = finalMaterials.length;
      finalMaterials.push(material);
      materialLookup.set(key, index);
      return index;
    };

    triangles.forEach((triangle) => {
      const part = resolvePart(triangle, slotStats);
      const cushionShadow = part === "cushion" && triangle.cushionShadow;
      const materialIndex = getMaterialIndex(triangle.sourceMaterialIndex, triangle.sourceSlot, part, cushionShadow);
      const start = finalIndex.length;
      finalIndex.push(triangle.a, triangle.b, triangle.c);
      finalGeometry.addGroup(start, 3, materialIndex);
      counts[part] += 1;
      counts.triangleGroups += 1;
    });

    finalGeometry.setIndex(finalIndex);
    finalGeometry.computeBoundingBox();
    finalGeometry.computeBoundingSphere();

    mesh.geometry.dispose();
    mesh.geometry = finalGeometry;
    mesh.material = finalMaterials.length > 1 ? finalMaterials : finalMaterials[0];
  });

  return counts;
}

function createStandalonePartMaterial(
  part: TablePart,
  palette: Palette,
  buckets: MaterialBuckets,
  name: string
) {
  const material = new THREE.MeshPhysicalMaterial({
    name,
    color: "#ffffff",
    roughness: 0.5,
    metalness: 0,
  });
  material.userData.originalSnapshot = snapshotMaterial(material);
  material.userData.part = part;
  material.userData.sourceSlot = name;
  material.userData.meshName = name;
  material.userData.materialName = name;
  applyMaterial(material, part, optionForPart(part, palette));
  buckets[part].push(material);
  return material;
}

function averagePoints(points: THREE.Vector3[]) {
  const out = new THREE.Vector3();
  if (!points.length) return out;
  points.forEach((point) => out.add(point));
  return out.multiplyScalar(1 / points.length);
}

function collectBaseFootAnchorsFromMappedTable(table: THREE.Object3D) {
  table.updateMatrixWorld(true);
  const tableBox = new THREE.Box3().setFromObject(table);
  const tableCenter = tableBox.getCenter(new THREE.Vector3());

  const quadrants = {
    lt: [] as THREE.Vector3[],
    rt: [] as THREE.Vector3[],
    lb: [] as THREE.Vector3[],
    rb: [] as THREE.Vector3[],
  };

  table.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry as THREE.BufferGeometry;
    const position = geometry.attributes.position as THREE.BufferAttribute | undefined;
    const index = geometry.index;
    if (!position) return;

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const groups = geometry.groups.length
      ? geometry.groups
      : [{ start: 0, count: index ? index.count : position.count, materialIndex: 0 }];

    groups.forEach((group) => {
      const material = materials[Math.max(0, Math.min(group.materialIndex, materials.length - 1))] as WorkingMaterial;
      if ((material.userData.part as TablePart | undefined) !== "baseFoot") return;

      for (let i = group.start; i + 2 < group.start + group.count; i += 3) {
        const ai = index ? index.getX(i) : i;
        const bi = index ? index.getX(i + 1) : i + 1;
        const ci = index ? index.getX(i + 2) : i + 2;

        const a = new THREE.Vector3().fromBufferAttribute(position, ai).applyMatrix4(mesh.matrixWorld);
        const b = new THREE.Vector3().fromBufferAttribute(position, bi).applyMatrix4(mesh.matrixWorld);
        const c = new THREE.Vector3().fromBufferAttribute(position, ci).applyMatrix4(mesh.matrixWorld);
        const p = new THREE.Vector3().addVectors(a, b).add(c).multiplyScalar(1 / 3);

        const left = p.x < tableCenter.x;
        const back = p.z < tableCenter.z;

        if (left && back) quadrants.lt.push(p);
        else if (!left && back) quadrants.rt.push(p);
        else if (left && !back) quadrants.lb.push(p);
        else quadrants.rb.push(p);
      }
    });
  });

  const anchors = [quadrants.lt, quadrants.rt, quadrants.lb, quadrants.rb]
    .map((points) => (points.length ? averagePoints(points) : null))
    .filter(Boolean) as THREE.Vector3[];

  if (anchors.length === 4) {
    anchors.forEach((anchor) => (anchor.y = tableBox.min.y));
    return anchors;
  }

  const size = tableBox.getSize(new THREE.Vector3());
  const x = size.x * 0.24;
  const z = size.z * 0.2;
  const y = tableBox.min.y;

  return [
    new THREE.Vector3(tableCenter.x - x, y, tableCenter.z - z),
    new THREE.Vector3(tableCenter.x + x, y, tableCenter.z - z),
    new THREE.Vector3(tableCenter.x - x, y, tableCenter.z + z),
    new THREE.Vector3(tableCenter.x + x, y, tableCenter.z + z),
  ];
}

function createRoundedFootCaps(table: THREE.Object3D, palette: Palette, buckets: MaterialBuckets) {
  table.updateMatrixWorld(true);
  const group = new THREE.Group();
  group.name = "rounded_gold_chrome_foot_caps";

  const anchors = collectBaseFootAnchorsFromMappedTable(table);
  const material = createStandalonePartMaterial("baseFoot", palette, buckets, "rounded_metal_feet_material");
  const geometry = new THREE.CylinderGeometry(0.13, 0.18, 0.055, 48, 1, false);

  anchors.forEach((anchor, index) => {
    const cap = new THREE.Mesh(geometry.clone(), material);
    cap.name = `rounded_metal_foot_${index + 1}`;
    cap.position.set(anchor.x, anchor.y + 0.028, anchor.z);
    cap.scale.set(1.1, 1, 1.1);
    cap.castShadow = true;
    cap.receiveShadow = true;
    group.add(cap);
  });

  return group;
}

function fitTable(table: THREE.Object3D) {
  table.rotation.y = Math.PI;
  const box = new THREE.Box3().setFromObject(table);
  const size = box.getSize(new THREE.Vector3());
  table.scale.setScalar(8.4 / Math.max(size.x, size.z, 0.001));
  table.updateMatrixWorld(true);

  const fitBox = new THREE.Box3().setFromObject(table);
  const center = fitBox.getCenter(new THREE.Vector3());
  table.position.x -= center.x;
  table.position.z -= center.z;
  table.position.y -= fitBox.min.y;
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => material.dispose());
  });
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        padding: "4px 7px",
        borderRadius: 999,
        background: "rgba(59,130,246,0.2)",
        color: "#bfdbfe",
        fontSize: 10.5,
        fontWeight: 850,
      }}
    >
      {children}
    </span>
  );
}

function ColorButton({ active, option, onClick }: { active: boolean; option: ColorOption; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        border: active ? "1px solid rgba(255,255,255,0.78)" : "1px solid rgba(255,255,255,0.18)",
        background: active ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.06)",
        color: "white",
        borderRadius: 999,
        padding: "6px 8px",
        fontSize: 10.5,
        fontWeight: 850,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 13,
          height: 13,
          borderRadius: 999,
          background: option.color,
          border: "1px solid rgba(255,255,255,0.38)",
          display: "inline-block",
          flex: "0 0 auto",
        }}
      />
      {option.label}
    </button>
  );
}

export default function PoolTableCustomOptionsPreview() {
  const hostRef = useRef<HTMLDivElement>(null);
  const bucketsRef = useRef<MaterialBuckets>(createBuckets());
  const paletteRef = useRef<Palette>(DEFAULT_PALETTE);
  const [palette, setPalette] = useState<Palette>(DEFAULT_PALETTE);
  const [status, setStatus] = useState("loading table...");
  const [counts, setCounts] = useState<Counts>({ ...EMPTY_COUNTS });
  const [pickInfo, setPickInfo] = useState<PickInfo | null>(null);

  useEffect(() => {
    paletteRef.current = palette;
    applyPaletteToBuckets(bucketsRef.current, palette);
  }, [palette]);

  const rows = useMemo(
    () =>
      CONTROL_PARTS.map((control) => {
        const mappedParts = TABLE_PARTS.filter((part) => PART_TO_CONTROL[part] === control);
        const count = mappedParts.reduce((sum, part) => sum + counts[part], 0);
        return { control, ...CONTROL_META[control], count, selected: palette[control], options: CONTROL_OPTIONS[control] };
      }),
    [counts, palette]
  );

  const setControlChoice = (control: ControlPart, choice: ChoiceKey) => {
    setPalette((current) => ({ ...current, [control]: choice }));
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#050505");
    scene.fog = new THREE.Fog(0x050505, 24, 70);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.48;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 120);
    camera.position.set(6.2, 4.2, 7.0);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = true;
    controls.minDistance = 3;
    controls.maxDistance = 24;
    controls.target.set(0, 1.05, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 1.08));

    const key = new THREE.DirectionalLight(0xffffff, 3.25);
    key.position.set(6, 10, 7);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    scene.add(key);

    scene.add(new THREE.HemisphereLight(0xdbeafe, 0x241307, 1.18));

    const warm = new THREE.PointLight(0xffd08a, 2.0, 28);
    warm.position.set(0, 4, 0);
    scene.add(warm);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshStandardMaterial({ color: "#101010", roughness: 0.86, metalness: 0.02 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const manager = new THREE.LoadingManager();
    manager.onStart = () => setStatus("loading original table...");
    manager.onProgress = (url, loaded, total) => setStatus(`loading ${loaded}/${total}: ${url.split("/").pop() || "asset"}`);
    manager.onError = (url) => setStatus(`asset failed: ${url.split("/").pop() || url}`);

    const draco = new DRACOLoader(manager);
    draco.setDecoderPath(DRACO_DECODER_PATH);
    draco.setDecoderConfig({ type: "js" });
    draco.preload();

    const ktx2 = new KTX2Loader(manager);
    ktx2.setTranscoderPath(BASIS_TRANSCODER_PATH);
    ktx2.detectSupport(renderer);

    const loader = new GLTFLoader(manager);
    loader.setDRACOLoader(draco);
    loader.setKTX2Loader(ktx2);
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.setCrossOrigin("anonymous");

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let frame = 0;
    let tableObject: THREE.Object3D | null = null;
    let mounted = true;
    let pointerDown: { x: number; y: number; t: number } | null = null;

    loader.load(
      TABLE_MODEL_URL,
      (gltf) => {
        if (!mounted) return;
        const table = gltf.scene;
        fitTable(table);
        bucketsRef.current = createBuckets();
        const resultCounts = splitTableIntoMappedParts(table, paletteRef.current, bucketsRef.current);
        const displayGroup = new THREE.Group();
        displayGroup.name = "mapped_pool_table_simplified_options";
        displayGroup.add(table);
        displayGroup.add(createRoundedFootCaps(table, paletteRef.current, bucketsRef.current));
        tableObject = displayGroup;
        scene.add(displayGroup);
        setCounts(resultCounts);
        setStatus("ready: cushions now use the reference mapping and texture only; everything else unchanged");
      },
      (event) => {
        if (!event.total) return;
        setStatus(`loading table ${Math.round((event.loaded / event.total) * 100)}%`);
      },
      (error) => {
        console.error(error);
        setStatus("failed to load the table model");
      }
    );

    const pick = (clientX: number, clientY: number) => {
      if (!tableObject) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObject(tableObject, true)[0];
      if (!hit || !hit.face) return;
      const mesh = hit.object as THREE.Mesh;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const material = materials[Math.max(0, Math.min(hit.face.materialIndex ?? 0, materials.length - 1))] as WorkingMaterial;
      setPickInfo({
        part: (material.userData.part as TablePart) || "sideWoodApron",
        meshName: String(material.userData.meshName || mesh.name || "unknown mesh"),
        materialName: String(material.userData.materialName || material.name || "unknown material"),
        sourceSlot: String(material.userData.sourceSlot || "unknown slot"),
        point: `${hit.point.x.toFixed(2)}, ${hit.point.y.toFixed(2)}, ${hit.point.z.toFixed(2)}`,
      });
    };

    const onPointerDown = (event: PointerEvent) => {
      pointerDown = { x: event.clientX, y: event.clientY, t: performance.now() };
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!pointerDown) return;
      if (Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) < 8 && performance.now() - pointerDown.t < 380) {
        pick(event.clientX, event.clientY);
      }
      pointerDown = null;
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

    const animate = () => {
      frame = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const resize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    };
    window.addEventListener("resize", resize);

    return () => {
      mounted = false;
      window.removeEventListener("resize", resize);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      cancelAnimationFrame(frame);
      controls.dispose();
      if (tableObject) disposeObject(tableObject);
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      envTexture.dispose();
      pmrem.dispose();
      ktx2.dispose();
      draco.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div ref={hostRef} style={{ position: "fixed", inset: 0, background: "#050505", overflow: "hidden", touchAction: "none" }}>
      <div style={{ position: "fixed", left: 10, top: 10, right: 10, color: "white", fontFamily: "system-ui, sans-serif", pointerEvents: "none" }}>
        <div style={{ maxWidth: 920, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(0,0,0,0.62)", backdropFilter: "blur(10px)", borderRadius: 16, padding: "9px 10px", boxShadow: "0 18px 40px rgba(0,0,0,0.35)" }}>
          <div style={{ fontSize: 13.5, fontWeight: 950 }}>Seven Foot Pool Table — Simplified Options</div>
          <div style={{ marginTop: 5, fontSize: 11.5, color: "#cbd5e1", lineHeight: 1.35 }}>{status}</div>
          <div style={{ marginTop: 7, display: "flex", flexWrap: "wrap", gap: 5 }}>
            <Pill>slots {counts.sourceSlots}</Pill>
            <Pill>cloth {counts.cloth}</Pill>
            <Pill>cushions {counts.cushion}</Pill>
            <Pill>accents {counts.railSight + counts.sideWoodApron + counts.verticalCornerRim + counts.baseFoot + counts.lowerTrim}</Pill>
            <Pill>jaws {counts.pocketCup}</Pill>
            <Pill>legs/base {counts.leg + counts.baseCornerBlock}</Pill>
          </div>

          {pickInfo && (
            <div style={{ marginTop: 7, padding: "7px 8px", borderRadius: 12, background: "rgba(15,23,42,0.78)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div style={{ fontSize: 11.5, fontWeight: 950, color: "#f8fafc" }}>
                Tapped: {CONTROL_META[PART_TO_CONTROL[pickInfo.part]].label}
              </div>
              <div style={{ marginTop: 3, fontSize: 10.2, color: "#cbd5e1", lineHeight: 1.25 }}>
                mesh: {pickInfo.meshName} · material: {pickInfo.materialName}
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ position: "fixed", left: 10, right: 10, bottom: 10, maxHeight: "54vh", overflow: "auto", color: "white", fontFamily: "system-ui, sans-serif", pointerEvents: "auto" }}>
        <div style={{ maxWidth: 1040, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(0,0,0,0.72)", backdropFilter: "blur(10px)", borderRadius: 18, padding: 11, boxShadow: "0 18px 40px rgba(0,0,0,0.35)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 950 }}>Easy material options</div>
              <div style={{ marginTop: 2, fontSize: 10.5, color: "#94a3b8" }}>
                Cloth and cushions now both use green/blue choices. Legs/base stay separate from the metal accents.
              </div>
            </div>
            <button onClick={() => setPalette(DEFAULT_PALETTE)} style={{ border: "1px solid rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.08)", color: "white", borderRadius: 999, padding: "7px 10px", fontSize: 11, fontWeight: 900, cursor: "pointer", flex: "0 0 auto" }}>
              Reset
            </button>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {rows.map((row) => (
              <div key={row.control} style={{ display: "grid", gridTemplateColumns: "minmax(116px, 172px) 1fr", gap: 8, alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 11.3, fontWeight: 950, color: "#e5e7eb" }}>
                    {row.label} <span style={{ color: "#94a3b8" }}>({row.count})</span>
                  </div>
                  <div style={{ fontSize: 9.4, color: "#94a3b8", lineHeight: 1.2 }}>{row.description}</div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {(["a", "b"] as ChoiceKey[]).map((choice) => (
                    <ColorButton key={`${row.control}-${choice}`} active={row.selected === choice} option={row.options[choice]} onClick={() => setControlChoice(row.control, choice)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
