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

type ChoiceKey = "a" | "b";
type Palette = Record<TablePart, ChoiceKey>;
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

type PartMeta = {
  label: string;
  description: string;
  keepSourceTexture: boolean;
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
  spatialPart: TablePart;
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

const CONTROL_PARTS: TablePart[] = [
  "cloth",
  "cushion",
  "topWoodRail",
  "railSight",
  "pocketCup",
  "verticalCornerRim",
  "baseCornerBlock",
  "leg",
];

const ALWAYS_SPATIAL_PARTS = new Set<TablePart>([
  "pocketCup",
  "cornerPocketPlate",
  "middlePocketPlate",
  "verticalCornerRim",
  "baseCornerBlock",
  "lowerTrim",
  "railSight",
  "underside",
]);

const LINKED_TO_RAIL_SIGHT = new Set<TablePart>(["sideWoodApron", "railSight"]);
const LINKED_TO_CORNER_RIM = new Set<TablePart>(["baseFoot", "verticalCornerRim"]);

const PART_META: Record<TablePart, PartMeta> = {
  cloth: {
    label: "Field cloth",
    description: "Uses original table slots first, then keeps a geometry split only when the cloth/cushion slot is mixed.",
    keepSourceTexture: false,
  },
  cushion: {
    label: "Cushions",
    description: "Raised inner rail bands separated from the flat field cloth. Cushion underside shadows stay grey.",
    keepSourceTexture: false,
  },
  topWoodRail: {
    label: "Top rails",
    description: "Horizontal wood rail tops.",
    keepSourceTexture: true,
  },
  sideWoodApron: {
    label: "Side apron",
    description: "Linked to the Side apron + rail sights option.",
    keepSourceTexture: false,
  },
  pocketCup: {
    label: "Pocket cups",
    description: "Dark pocket holes and cup interiors.",
    keepSourceTexture: true,
  },
  cornerPocketPlate: {
    label: "Corner plates",
    description: "Hidden option, internal default only.",
    keepSourceTexture: false,
  },
  middlePocketPlate: {
    label: "Side plates",
    description: "Hidden option, internal default only.",
    keepSourceTexture: false,
  },
  verticalCornerRim: {
    label: "Corner rims + rounded feet",
    description: "Controls the original 4 outside vertical base-corner rim strips and the rounded feet below the actual feet.",
    keepSourceTexture: false,
  },
  baseCornerBlock: {
    label: "Base corners",
    description: "Corner/base pieces under the apron. Default black and editable.",
    keepSourceTexture: false,
  },
  leg: {
    label: "Legs",
    description: "Vertical wooden supports.",
    keepSourceTexture: true,
  },
  baseFoot: {
    label: "Rounded feet",
    description: "Hidden row. Controlled by Corner rims + rounded feet.",
    keepSourceTexture: false,
  },
  lowerTrim: {
    label: "Lower trim",
    description: "Hidden option, internal default only.",
    keepSourceTexture: false,
  },
  railSight: {
    label: "Side apron + rail sights",
    description: "Linked option for the side apron and rail sight dots.",
    keepSourceTexture: false,
  },
  underside: {
    label: "Underside",
    description: "Hidden option, internal default only.",
    keepSourceTexture: true,
  },
};

const PART_OPTIONS: Record<TablePart, Record<ChoiceKey, ColorOption>> = {
  cloth: {
    a: { label: "Clean green field", color: "#0a7b33", metalness: 0, roughness: 1, envMapIntensity: 0.16 },
    b: { label: "Clean blue field", color: "#0d4fb8", metalness: 0, roughness: 1, envMapIntensity: 0.16 },
  },
  cushion: {
    a: { label: "Green cushions", color: "#064f23", metalness: 0, roughness: 0.94, envMapIntensity: 0.24 },
    b: { label: "Black cushions", color: "#050505", metalness: 0, roughness: 0.88, envMapIntensity: 0.38 },
  },
  topWoodRail: {
    a: { label: "Walnut rails", color: "#5a2608", metalness: 0.02, roughness: 0.38, envMapIntensity: 1.35, clearcoat: 0.42, clearcoatRoughness: 0.18 },
    b: { label: "Black rails", color: "#070605", metalness: 0.04, roughness: 0.28, envMapIntensity: 1.75, clearcoat: 0.7, clearcoatRoughness: 0.1 },
  },
  sideWoodApron: {
    a: { label: "Gold side apron", color: "#d8a928", metalness: 0.9, roughness: 0.11, envMapIntensity: 5.9, clearcoat: 1, clearcoatRoughness: 0.045 },
    b: { label: "Black side apron", color: "#050505", metalness: 0.82, roughness: 0.17, envMapIntensity: 3.15, clearcoat: 1, clearcoatRoughness: 0.07 },
  },
  pocketCup: {
    a: { label: "Black cups", color: "#000000", metalness: 0, roughness: 0.98, envMapIntensity: 0.12 },
    b: { label: "Dark leather cups", color: "#1b0c04", metalness: 0, roughness: 0.9, envMapIntensity: 0.26 },
  },
  cornerPocketPlate: {
    a: { label: "Gold corners", color: "#f7c943", metalness: 1, roughness: 0.045, envMapIntensity: 8.4, clearcoat: 1, clearcoatRoughness: 0.025 },
    b: { label: "Black corners", color: "#050505", metalness: 0.9, roughness: 0.11, envMapIntensity: 4.2, clearcoat: 1, clearcoatRoughness: 0.045 },
  },
  middlePocketPlate: {
    a: { label: "Black side plates", color: "#050505", metalness: 0.88, roughness: 0.12, envMapIntensity: 4, clearcoat: 1, clearcoatRoughness: 0.05 },
    b: { label: "Gold side plates", color: "#f7c943", metalness: 1, roughness: 0.045, envMapIntensity: 8.4, clearcoat: 1, clearcoatRoughness: 0.025 },
  },
  verticalCornerRim: {
    a: { label: "Gold rims + feet", color: "#d8b23d", metalness: 0.98, roughness: 0.06, envMapIntensity: 6.8, clearcoat: 1, clearcoatRoughness: 0.03 },
    b: { label: "Chrome rims + feet", color: "#d7dde7", metalness: 1, roughness: 0.055, envMapIntensity: 7.2, clearcoat: 1, clearcoatRoughness: 0.025 },
  },
  baseCornerBlock: {
    a: { label: "Walnut corners", color: "#7b2d11", metalness: 0.02, roughness: 0.48, envMapIntensity: 1.1, clearcoat: 0.22, clearcoatRoughness: 0.33 },
    b: { label: "Black corners", color: "#080605", metalness: 0.03, roughness: 0.38, envMapIntensity: 1.34, clearcoat: 0.34, clearcoatRoughness: 0.22 },
  },
  leg: {
    a: { label: "Walnut legs", color: "#3d1706", metalness: 0.02, roughness: 0.52, envMapIntensity: 1, clearcoat: 0.2, clearcoatRoughness: 0.36 },
    b: { label: "Black legs", color: "#070504", metalness: 0.04, roughness: 0.4, envMapIntensity: 1.22, clearcoat: 0.32, clearcoatRoughness: 0.26 },
  },
  baseFoot: {
    a: { label: "Gold rounded feet", color: "#d8b23d", metalness: 1, roughness: 0.065, envMapIntensity: 6.8, clearcoat: 1, clearcoatRoughness: 0.03 },
    b: { label: "Chrome rounded feet", color: "#d7dde7", metalness: 1, roughness: 0.055, envMapIntensity: 7.2, clearcoat: 1, clearcoatRoughness: 0.025 },
  },
  lowerTrim: {
    a: { label: "Gold trim", color: "#d8b23d", metalness: 0.94, roughness: 0.085, envMapIntensity: 5.8, clearcoat: 1, clearcoatRoughness: 0.04 },
    b: { label: "Black trim", color: "#070707", metalness: 0.82, roughness: 0.15, envMapIntensity: 3.2, clearcoat: 1, clearcoatRoughness: 0.07 },
  },
  railSight: {
    a: { label: "Gold apron + gold sights", color: "#f5d978", metalness: 1, roughness: 0.065, envMapIntensity: 6.7, clearcoat: 1, clearcoatRoughness: 0.035 },
    b: { label: "Black apron + black sights", color: "#050505", metalness: 0.82, roughness: 0.16, envMapIntensity: 3, clearcoat: 1, clearcoatRoughness: 0.07 },
  },
  underside: {
    a: { label: "Dark underside", color: "#1e130b", metalness: 0.01, roughness: 0.72, envMapIntensity: 0.58 },
    b: { label: "Black underside", color: "#050505", metalness: 0.02, roughness: 0.62, envMapIntensity: 0.82 },
  },
};

const DEFAULT_PALETTE: Palette = TABLE_PARTS.reduce((acc, part) => {
  acc[part] = "a";
  return acc;
}, {} as Palette);

DEFAULT_PALETTE.baseCornerBlock = "b";
DEFAULT_PALETTE.verticalCornerRim = "a";
DEFAULT_PALETTE.baseFoot = "a";

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

function createMaterialBuckets(): MaterialBuckets {
  return TABLE_PARTS.reduce((acc, part) => {
    acc[part] = [];
    return acc;
  }, {} as MaterialBuckets);
}

function cleanName(value?: string | null) {
  return (value || "unnamed").replace(/\s+/g, "_").toLowerCase();
}

function makeSlotKey(mesh: THREE.Mesh, sourceMaterialIndex: number, material: THREE.Material) {
  return `${cleanName(mesh.name)}::slot_${sourceMaterialIndex}::${cleanName(material.name)}`;
}

function choiceForPart(part: TablePart, palette: Palette): ChoiceKey {
  if (LINKED_TO_RAIL_SIGHT.has(part)) return palette.railSight;
  if (LINKED_TO_CORNER_RIM.has(part)) return palette.verticalCornerRim;
  return palette[part];
}

function optionForPart(part: TablePart, palette: Palette): ColorOption {
  return PART_OPTIONS[part][choiceForPart(part, palette)];
}

function patchTexture(texture?: THREE.Texture | null, isColorTexture = false) {
  if (!texture) return;
  if (isColorTexture) texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  texture.needsUpdate = true;
}

function patchMaterial(material: THREE.Material) {
  const mat = material as WorkingMaterial;
  patchTexture(mat.map, true);
  patchTexture(mat.emissiveMap, true);
  patchTexture(mat.lightMap, true);
  patchTexture(mat.normalMap);
  patchTexture(mat.roughnessMap);
  patchTexture(mat.metalnessMap);
  patchTexture(mat.aoMap);
  patchTexture(mat.bumpMap);
  patchTexture(mat.alphaMap);
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

function restoreOriginalMaterial(material: WorkingMaterial) {
  const snapshot = material.userData.originalSnapshot as MaterialSnapshot | undefined;
  if (!snapshot) return;
  material.color.copy(snapshot.color);
  material.emissive.copy(snapshot.emissive);
  material.metalness = snapshot.metalness;
  material.roughness = snapshot.roughness;
  material.envMapIntensity = snapshot.envMapIntensity;
  material.clearcoat = snapshot.clearcoat;
  material.clearcoatRoughness = snapshot.clearcoatRoughness;
  material.map = snapshot.map;
  material.normalMap = snapshot.normalMap;
  material.bumpMap = snapshot.bumpMap;
  material.roughnessMap = snapshot.roughnessMap;
  material.metalnessMap = snapshot.metalnessMap;
  material.aoMap = snapshot.aoMap;
  material.emissiveMap = snapshot.emissiveMap;
  material.lightMap = snapshot.lightMap;
  material.alphaMap = snapshot.alphaMap;
  material.transparent = snapshot.transparent;
  material.opacity = snapshot.opacity;
  material.depthWrite = true;
}

function cloneToWorkingMaterial(raw: THREE.Material): WorkingMaterial {
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

function getMaterialColor(material: WorkingMaterial) {
  return material.color instanceof THREE.Color ? material.color.clone() : new THREE.Color("#ffffff");
}

function colorFlags(material: WorkingMaterial) {
  const c = getMaterialColor(material);
  return {
    green: c.g > c.r * 1.14 && c.g > c.b * 1.08 && c.g > 0.11,
    black: c.r < 0.11 && c.g < 0.11 && c.b < 0.11,
    brown: c.r > c.b * 1.12 && c.g > c.b * 0.48 && c.r > 0.07 && c.g < c.r * 0.9,
    gold: c.r > 0.42 && c.g > 0.29 && c.b < 0.25 && c.r >= c.g * 0.88,
    light: c.r > 0.72 && c.g > 0.72 && c.b > 0.62,
  };
}

function materialIndexAtOffset(geometry: THREE.BufferGeometry, offset: number) {
  if (!geometry.groups.length) return 0;
  const group = geometry.groups.find((item) => offset >= item.start && offset < item.start + item.count);
  return group?.materialIndex ?? 0;
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

function spatialContext(mesh: THREE.Mesh, geometry: THREE.BufferGeometry, aIndex: number, bIndex: number, cIndex: number, tableBox: THREE.Box3, tableCenter: THREE.Vector3, tableSize: THREE.Vector3) {
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

  const centralCloth = high && s.upFace && !anyPocketZone && s.longN < 0.74 && s.shortN < 0.59;
  const cushionBand =
    high &&
    !anyPocketZone &&
    ((s.upFace && s.longN >= 0.70 && s.longN < 0.88 && s.shortN < 0.68) ||
      (s.upFace && s.shortN >= 0.54 && s.shortN < 0.78 && s.longN < 0.88) ||
      (s.sideFace && s.relY > 0.58 && (s.longN > 0.66 || s.shortN > 0.50)) ||
      (s.downFace && s.relY > 0.46 && s.relY < 0.84 && ((s.longN > 0.62 && s.longN < 0.94) || (s.shortN > 0.44 && s.shortN < 0.86))));

  const topRailBand = high && (s.longN > 0.58 || s.shortN > 0.535);
  const topRailNonPocket = topRailBand && !anyPocketZone;
  const outsideBaseCornerRimZone = s.sideFace && s.relY > 0.08 && s.relY < 0.78 && s.longN > 0.72 && s.shortN > 0.54;
  const outerMostVerticalCorner = s.sideFace && s.relY > 0.10 && s.relY < 0.80 && s.longN > 0.80 && s.shortN > 0.68;
  const sideLowerTrimZone = s.sideFace && s.relY > 0.18 && s.relY < 0.44 && (s.longN > 0.54 || s.shortN > 0.54) && !outsideBaseCornerRimZone;
  const innerBaseCornerZone =
    s.sideFace &&
    s.relY > 0.12 &&
    s.relY < 0.68 &&
    ((s.longN > 0.10 && s.longN < 0.54 && s.shortN < 0.36) || (s.longN > 0.58 && s.shortN > 0.56));
  const hardwareCandidate = namedHardware || metalish || ((flags.black || flags.gold || flags.light) && !flags.green && !flags.brown && !namedWood);
  const pocketInteriorCandidate = namedPocket || (flags.black && anyPocketZone && (s.downFace || s.sideFace || s.relY < 0.79) && !hardwareCandidate);

  if (pocketInteriorCandidate) return "pocketCup";
  if (namedPocket && hardwareCandidate && sideMiddlePocketZone) return "middlePocketPlate";
  if (namedPocket && hardwareCandidate && cornerPocketZone) return "cornerPocketPlate";
  if (hardwareCandidate && sideMiddlePocketZone && !flags.green && !flags.brown) return "middlePocketPlate";
  if (hardwareCandidate && cornerPocketZone && !flags.green && !flags.brown) return "cornerPocketPlate";
  if (namedSight && high) return "railSight";
  if (namedCloth && centralCloth) return "cloth";
  if ((flags.green || namedCloth) && centralCloth) return "cloth";
  if (namedCushion && !centralCloth) return "cushion";
  if ((flags.green || namedCushion) && cushionBand) return "cushion";
  if ((outsideBaseCornerRimZone || outerMostVerticalCorner) && !flags.green && !s.upFace) return "verticalCornerRim";
  if (hardwareCandidate && topRailNonPocket && s.upFace && !flags.brown && !flags.green) return "railSight";
  if (hardwareCandidate && sideLowerTrimZone && !flags.green) return "lowerTrim";
  if (low) return "baseFoot";
  if (s.downFace && s.relY < 0.5) return "underside";
  if ((flags.brown || namedWood) && innerBaseCornerZone) return "baseCornerBlock";
  if (outsideBaseCornerRimZone && (flags.brown || namedWood) && !outerMostVerticalCorner) return "baseCornerBlock";
  if (s.longN > 0.64 && s.shortN > 0.64 && midBody) return "baseCornerBlock";
  if (midBody && s.sideFace && !(s.longN > 0.64 && s.shortN > 0.64)) return "leg";
  if (veryTop && (s.upFace || topRailBand) && !flags.green) return "topWoodRail";
  if (high && s.sideFace && !flags.green && !anyPocketZone) return "sideWoodApron";
  return "sideWoodApron";
}

function isCushionShadowTriangle(mesh: THREE.Mesh, geometry: THREE.BufferGeometry, aIndex: number, bIndex: number, cIndex: number, tableBox: THREE.Box3, tableCenter: THREE.Vector3, tableSize: THREE.Vector3) {
  const s = spatialContext(mesh, geometry, aIndex, bIndex, cIndex, tableBox, tableCenter, tableSize);
  return s.downFace && s.relY > 0.46 && s.relY < 0.84 && ((s.longN > 0.62 && s.longN < 0.94) || (s.shortN > 0.44 && s.shortN < 0.86));
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
  stat.dominantPart = TABLE_PARTS.reduce((best, item) => ((stat.parts[item] || 0) > (stat.parts[best] || 0) ? item : best), stat.dominantPart);
  stat.dominantRatio = stat.total > 0 ? (stat.parts[stat.dominantPart] || 0) / stat.total : 1;
  stats.set(sourceSlot, stat);
}

function isMixedClothCushionSlot(stat?: SlotStat | null) {
  return Boolean(stat && (stat.parts.cloth || 0) > 0 && (stat.parts.cushion || 0) > 0);
}

function resolvePart(triangle: TriangleRecord, slotStats: Map<string, SlotStat>) {
  const stat = slotStats.get(triangle.sourceSlot);
  if (!stat) return triangle.spatialPart;
  if (ALWAYS_SPATIAL_PARTS.has(triangle.spatialPart) && triangle.spatialPart !== stat.dominantPart) return triangle.spatialPart;
  if (isMixedClothCushionSlot(stat) && (triangle.spatialPart === "cloth" || triangle.spatialPart === "cushion")) return triangle.spatialPart;
  if ((triangle.spatialPart === "cloth" || triangle.spatialPart === "cushion") && stat.dominantRatio >= 0.88) return stat.dominantPart;
  return stat.dominantRatio >= 0.965 ? stat.dominantPart : triangle.spatialPart;
}

function clearTextureMaps(material: WorkingMaterial) {
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

function applyCustomMaterial(material: WorkingMaterial, part: TablePart, option: ColorOption, cushionShadow = false) {
  restoreOriginalMaterial(material);
  if (part === "cushion" && cushionShadow) {
    material.color.set(CUSHION_SHADOW_GREY);
    material.metalness = 0;
    material.roughness = 0.96;
    material.envMapIntensity = 0.22;
    material.clearcoat = 0;
    material.clearcoatRoughness = 0;
    clearTextureMaps(material);
  } else {
    material.color.set(option.color);
    material.metalness = option.metalness;
    material.roughness = option.roughness;
    material.envMapIntensity = option.envMapIntensity;
    material.clearcoat = option.clearcoat ?? 0;
    material.clearcoatRoughness = option.clearcoatRoughness ?? 0;
    if (!PART_META[part].keepSourceTexture) clearTextureMaps(material);
  }
  material.transparent = false;
  material.opacity = 1;
  material.depthWrite = true;
  material.userData.part = part;
  material.userData.cushionShadow = cushionShadow;
  patchMaterial(material);
}

function makePartMaterial(source: WorkingMaterial, part: TablePart, palette: Palette, buckets: MaterialBuckets, sourceSlot: string, meshName: string, materialName: string, cushionShadow = false) {
  const material = source.clone() as WorkingMaterial;
  material.name = `${source.name || "source"}__${part}${cushionShadow ? "__shadow" : ""}`;
  material.userData.originalSnapshot = snapshotMaterial(source);
  material.userData.part = part;
  material.userData.sourceSlot = sourceSlot;
  material.userData.meshName = meshName;
  material.userData.materialName = materialName;
  material.userData.cushionShadow = cushionShadow;
  applyCustomMaterial(material, part, optionForPart(part, palette), cushionShadow);
  buckets[part].push(material);
  return material;
}

function applyPaletteToBuckets(buckets: MaterialBuckets, palette: Palette) {
  TABLE_PARTS.forEach((part) => {
    buckets[part].forEach((material) => applyCustomMaterial(material, part, optionForPart(part, palette), Boolean(material.userData.cushionShadow)));
  });
}

function countTextures(materials: WorkingMaterial[]) {
  const textures = new Set<THREE.Texture>();
  materials.forEach((material) => {
    [material.map, material.normalMap, material.bumpMap, material.roughnessMap, material.metalnessMap, material.aoMap, material.emissiveMap, material.lightMap, material.alphaMap].forEach((texture) => {
      if (texture) textures.add(texture);
    });
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
    const sourceMaterials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((material) => cloneToWorkingMaterial(material));
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
      const spatialPart = classifyTriangle(mesh, sourceGeometry, sourceMaterial, a, b, c, tableBox, tableCenter, tableSize);
      const cushionShadow = spatialPart === "cushion" && isCushionShadowTriangle(mesh, sourceGeometry, a, b, c, tableBox, tableCenter, tableSize);
      triangles.push({ a, b, c, sourceMaterialIndex, sourceSlot, spatialPart, cushionShadow });
      updateSlotStat(slotStats, sourceSlot, spatialPart);
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

    const getFinalMaterialIndex = (sourceMaterialIndex: number, sourceSlot: string, part: TablePart, cushionShadow = false) => {
      const key = `${sourceSlot}::${part}::${cushionShadow ? "shadow" : "main"}`;
      const existing = materialLookup.get(key);
      if (existing !== undefined) return existing;
      const source = sourceMaterials[Math.max(0, Math.min(sourceMaterialIndex, sourceMaterials.length - 1))];
      const material = makePartMaterial(source, part, palette, buckets, sourceSlot, mesh.name || "unnamed mesh", source.name || "unnamed material", cushionShadow);
      const index = finalMaterials.length;
      finalMaterials.push(material);
      materialLookup.set(key, index);
      return index;
    };

    triangles.forEach((triangle) => {
      const part = resolvePart(triangle, slotStats);
      const cushionShadow = part === "cushion" && triangle.cushionShadow;
      const materialIndex = getFinalMaterialIndex(triangle.sourceMaterialIndex, triangle.sourceSlot, part, cushionShadow);
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

function createStandalonePartMaterial(part: TablePart, palette: Palette, buckets: MaterialBuckets, name: string) {
  const material = new THREE.MeshPhysicalMaterial({ name, color: "#ffffff", roughness: 0.5, metalness: 0 });
  material.userData.originalSnapshot = snapshotMaterial(material);
  material.userData.part = part;
  material.userData.sourceSlot = name;
  material.userData.meshName = name;
  material.userData.materialName = name;
  applyCustomMaterial(material, part, optionForPart(part, palette));
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
  const quadrants = { lt: [] as THREE.Vector3[], rt: [] as THREE.Vector3[], lb: [] as THREE.Vector3[], rb: [] as THREE.Vector3[] };

  table.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry as THREE.BufferGeometry;
    const position = geometry.attributes.position as THREE.BufferAttribute | undefined;
    const index = geometry.index;
    if (!position) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const groups = geometry.groups.length ? geometry.groups : [{ start: 0, count: index ? index.count : position.count, materialIndex: 0 }];

    groups.forEach((group) => {
      const material = materials[Math.max(0, Math.min(group.materialIndex, materials.length - 1))] as WorkingMaterial;
      if ((material?.userData?.part as TablePart | undefined) !== "baseFoot") return;
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

  const anchors = [quadrants.lt, quadrants.rt, quadrants.lb, quadrants.rb].map((points) => (points.length ? averagePoints(points) : null)).filter(Boolean) as THREE.Vector3[];
  if (anchors.length === 4) {
    anchors.forEach((anchor) => {
      anchor.y = tableBox.min.y;
    });
    return anchors;
  }

  const size = tableBox.getSize(new THREE.Vector3());
  const x = size.x * 0.24;
  const z = size.z * 0.2;
  const y = tableBox.min.y;
  return [new THREE.Vector3(tableCenter.x - x, y, tableCenter.z - z), new THREE.Vector3(tableCenter.x + x, y, tableCenter.z - z), new THREE.Vector3(tableCenter.x - x, y, tableCenter.z + z), new THREE.Vector3(tableCenter.x + x, y, tableCenter.z + z)];
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
  return <span style={{ padding: "4px 7px", borderRadius: 999, background: "rgba(59,130,246,0.2)", color: "#bfdbfe", fontSize: 10.5, fontWeight: 850 }}>{children}</span>;
}

function ColorButton({ active, option, onClick }: { active: boolean; option: ColorOption; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 6, border: active ? "1px solid rgba(255,255,255,0.78)" : "1px solid rgba(255,255,255,0.18)", background: active ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.06)", color: "white", borderRadius: 999, padding: "6px 8px", fontSize: 10.5, fontWeight: 850, cursor: "pointer", whiteSpace: "nowrap" }}>
      <span style={{ width: 13, height: 13, borderRadius: 999, background: option.color, border: "1px solid rgba(255,255,255,0.38)", display: "inline-block", flex: "0 0 auto" }} />
      {option.label}
    </button>
  );
}

export default function PoolTableCustomOptionsPreview() {
  const hostRef = useRef<HTMLDivElement>(null);
  const bucketsRef = useRef<MaterialBuckets>(createMaterialBuckets());
  const paletteRef = useRef<Palette>(DEFAULT_PALETTE);
  const [palette, setPalette] = useState<Palette>(DEFAULT_PALETTE);
  const [status, setStatus] = useState("loading table...");
  const [counts, setCounts] = useState<Counts>({ ...EMPTY_COUNTS });
  const [pickInfo, setPickInfo] = useState<PickInfo | null>(null);

  useEffect(() => {
    paletteRef.current = palette;
    applyPaletteToBuckets(bucketsRef.current, palette);
  }, [palette]);

  const optionRows = useMemo(
    () =>
      CONTROL_PARTS.map((part) => {
        const count = part === "railSight" ? counts.sideWoodApron + counts.railSight : part === "verticalCornerRim" ? counts.verticalCornerRim + 4 : counts[part];
        return { part, label: PART_META[part].label, description: PART_META[part].description, count, selected: choiceForPart(part, palette), options: PART_OPTIONS[part] };
      }),
    [counts, palette]
  );

  const setPartChoice = (part: TablePart, choice: ChoiceKey) => {
    setPalette((current) => {
      const next = { ...current, [part]: choice };
      if (part === "railSight") next.sideWoodApron = choice;
      if (part === "sideWoodApron") next.railSight = choice;
      if (part === "verticalCornerRim") next.baseFoot = choice;
      if (part === "baseFoot") next.verticalCornerRim = choice;
      return next;
    });
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
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: "#101010", roughness: 0.86, metalness: 0.02 }));
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
        bucketsRef.current = createMaterialBuckets();
        const resultCounts = splitTableIntoMappedParts(table, paletteRef.current, bucketsRef.current);
        const displayGroup = new THREE.Group();
        displayGroup.name = "mapped_pool_table_with_precise_rounded_feet";
        displayGroup.add(table);
        displayGroup.add(createRoundedFootCaps(table, paletteRef.current, bucketsRef.current));
        tableObject = displayGroup;
        scene.add(displayGroup);
        setCounts(resultCounts);
        setStatus("ready: cushion shadows fixed grey; four side-panel vertical corner rims default gold");
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
      const dist = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
      const age = performance.now() - pointerDown.t;
      if (dist < 8 && age < 380) pick(event.clientX, event.clientY);
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
          <div style={{ fontSize: 13.5, fontWeight: 950 }}>Seven Foot Pool Table — Custom Options</div>
          <div style={{ marginTop: 5, fontSize: 11.5, color: "#cbd5e1", lineHeight: 1.35 }}>{status}</div>
          <div style={{ marginTop: 7, display: "flex", flexWrap: "wrap", gap: 5 }}>
            <Pill>slots {counts.sourceSlots}</Pill>
            <Pill>cloth {counts.cloth}</Pill>
            <Pill>cushions {counts.cushion}</Pill>
            <Pill>gold rims {counts.verticalCornerRim}</Pill>
            <Pill>rounded feet 4</Pill>
            <Pill>base corners {counts.baseCornerBlock}</Pill>
          </div>
          {pickInfo && (
            <div style={{ marginTop: 7, padding: "7px 8px", borderRadius: 12, background: "rgba(15,23,42,0.78)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div style={{ fontSize: 11.5, fontWeight: 950, color: "#f8fafc" }}>Tapped: {PART_META[pickInfo.part].label}</div>
              <div style={{ marginTop: 3, fontSize: 10.2, color: "#cbd5e1", lineHeight: 1.25 }}>mesh: {pickInfo.meshName} · material: {pickInfo.materialName}</div>
            </div>
          )}
        </div>
      </div>
      <div style={{ position: "fixed", left: 10, right: 10, bottom: 10, maxHeight: "54vh", overflow: "auto", color: "white", fontFamily: "system-ui, sans-serif", pointerEvents: "auto" }}>
        <div style={{ maxWidth: 1040, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(0,0,0,0.72)", backdropFilter: "blur(10px)", borderRadius: 18, padding: 11, boxShadow: "0 18px 40px rgba(0,0,0,0.35)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 950 }}>Custom material options</div>
              <div style={{ marginTop: 2, fontSize: 10.5, color: "#94a3b8" }}>Only cushion shadows and cushion colors were adjusted. Vertical rims on the four side-panel corners default to gold.</div>
            </div>
            <button onClick={() => setPalette(DEFAULT_PALETTE)} style={{ border: "1px solid rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.08)", color: "white", borderRadius: 999, padding: "7px 10px", fontSize: 11, fontWeight: 900, cursor: "pointer", flex: "0 0 auto" }}>Reset</button>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {optionRows.map((row) => (
              <div key={row.part} style={{ display: "grid", gridTemplateColumns: "minmax(116px, 172px) 1fr", gap: 8, alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 11.3, fontWeight: 950, color: "#e5e7eb" }}>{row.label} <span style={{ color: "#94a3b8" }}>({row.count})</span></div>
                  <div style={{ fontSize: 9.4, color: "#94a3b8", lineHeight: 1.2 }}>{row.description}</div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {(["a", "b"] as ChoiceKey[]).map((choice) => <ColorButton key={`${row.part}-${choice}`} active={row.selected === choice} option={row.options[choice]} onClick={() => setPartChoice(row.part, choice)} />)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
