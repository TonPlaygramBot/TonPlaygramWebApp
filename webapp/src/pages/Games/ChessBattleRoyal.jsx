import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  createArenaCarpetMaterial,
  createArenaWallMaterial
} from '../../utils/arenaDecor.js';
import { applyRendererSRGB } from '../../utils/colorSpace.js';
import {
  createMurlanStyleTable,
  applyTableMaterials,
  TABLE_SHAPE_OPTIONS
} from '../../utils/murlanTable.js';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import {
  getTelegramFirstName,
  getTelegramUsername,
  getTelegramPhotoUrl
} from '../../utils/telegram.js';
import { bombSound, timerBeep } from '../../assets/soundData.js';
import { getGameVolume } from '../../utils/sound.js';
import { ARENA_CAMERA_DEFAULTS } from '../../utils/arenaCameraConfig.js';
import {
  TABLE_WOOD_OPTIONS,
  TABLE_CLOTH_OPTIONS,
  TABLE_BASE_OPTIONS,
  DEFAULT_TABLE_CUSTOMIZATION,
  WOOD_PRESETS_BY_ID,
  WOOD_GRAIN_OPTIONS,
  WOOD_GRAIN_OPTIONS_BY_ID
} from '../../utils/tableCustomizationOptions.js';
import { hslToHexNumber, WOOD_FINISH_PRESETS } from '../../utils/woodMaterials.js';
import { FLAG_EMOJIS } from '../../utils/flagEmojis.js';
import { avatarToName } from '../../utils/avatarUtils.js';
import { getAIOpponentFlag } from '../../utils/aiOpponentFlag.js';
import { ipToFlag } from '../../utils/conflictMatchmaking.js';
import AvatarTimer from '../../components/AvatarTimer.jsx';

/**
 * CHESS 3D — Procedural, Modern Look (no external models)
 * -------------------------------------------------------
 * • Same technique as your projects: only primitives (Box/Cylinder/Cone/Sphere) + standard materials
 * • 8x8 board with coordinates, modern border, cinematic lighting
 * • Procedural low-poly pieces (king/queen/rook/bishop/knight/pawn)
 * • Full basic game: legal moves, white → black turns, captures, check, **checkmate/stalemate**, promotion to queen
 * • Minimal UI: status bar (turn, check, mate), reset
 * • Control: click to select a piece, click one of the highlighted targets to move it
 *
 * Note: for simplicity, this version omits en passant and castling. We can add them easily.
 */

// ========================= Config =========================
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clamp01 = (value, fallback = 0) => {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, value));
};

const BASE_BOARD_THEME = Object.freeze({
  light: '#f0f3ff',
  dark: '#1e2335',
  frameLight: '#2d3250',
  frameDark: '#0d101d',
  accent: '#c7a76a',
  highlight: '#4ce0c3',
  capture: '#ff7ba3',
  surfaceRoughness: 0.42,
  surfaceMetalness: 0.32,
  frameRoughness: 0.56,
  frameMetalness: 0.62
});

const BOARD_COLOR_OPTIONS = Object.freeze([
  {
    id: 'onyxMarble',
    label: 'Oniks & Mermer',
    light: '#f6f8ff',
    dark: '#202539',
    frameLight: '#2f3552',
    frameDark: '#0c0f1b',
    accent: '#c3a56a',
    highlight: '#5cf2d0',
    capture: '#ff7ba3',
    surfaceRoughness: 0.46,
    surfaceMetalness: 0.36,
    frameRoughness: 0.6,
    frameMetalness: 0.64
  },
  {
    id: 'arcticMarble',
    label: 'Mermer Arktik',
    light: '#f1f4f9',
    dark: '#6a88a6',
    frameLight: '#cbd5e1',
    frameDark: '#455468',
    accent: '#6fbdf2',
    highlight: '#76e5fc',
    capture: '#ff7b9b',
    surfaceRoughness: 0.42,
    surfaceMetalness: 0.24,
    frameRoughness: 0.58,
    frameMetalness: 0.32
  },
  {
    id: 'onyxGold',
    label: 'Oniks & Ar',
    light: '#f7d18b',
    dark: '#2a2521',
    frameLight: '#9f7a3c',
    frameDark: '#1a1411',
    accent: '#f2c57c',
    highlight: '#7ef9a1',
    capture: '#ff8975',
    surfaceRoughness: 0.55,
    surfaceMetalness: 0.4,
    frameRoughness: 0.48,
    frameMetalness: 0.52
  },
  {
    id: 'neonMatrix',
    label: 'Neon Futuristik',
    light: '#3ef8ff',
    dark: '#1b1d36',
    frameLight: '#2d2f5a',
    frameDark: '#0c0d18',
    accent: '#a855f7',
    highlight: '#59ffa5',
    capture: '#ff5f87',
    surfaceRoughness: 0.36,
    surfaceMetalness: 0.48,
    frameRoughness: 0.42,
    frameMetalness: 0.56
  }
]);

const PIECE_STYLE_OPTIONS = Object.freeze([
  {
    id: 'porcelainOnyx',
    label: 'Porcelanë & Oniks',
    white: {
      color: '#f6f7ff',
      roughness: 0.28,
      metalness: 0.22,
      sheen: 0.34,
      sheenColor: '#ffffff',
      clearcoat: 0.36,
      clearcoatRoughness: 0.28,
      specularIntensity: 0.7
    },
    black: {
      color: '#121622',
      roughness: 0.32,
      metalness: 0.58,
      sheen: 0.24,
      sheenColor: '#8899b8',
      clearcoat: 0.32,
      clearcoatRoughness: 0.36,
      specularIntensity: 0.72
    },
    accent: '#c4a166',
    whiteAccent: '#e8d6a4',
    blackAccent: '#d9b878'
  },
  {
    id: 'marbleGold',
    label: 'Mermer & Ar',
    white: {
      color: '#f3f1ff',
      roughness: 0.22,
      metalness: 0.28,
      sheen: 0.32,
      sheenColor: '#f8f6ff',
      clearcoat: 0.35,
      clearcoatRoughness: 0.22,
      specularIntensity: 0.7
    },
    black: {
      color: '#2c1f33',
      roughness: 0.24,
      metalness: 0.52,
      sheen: 0.18,
      sheenColor: '#cbb79e',
      clearcoat: 0.28,
      clearcoatRoughness: 0.36,
      specularIntensity: 0.68
    },
    accent: '#ffd36b',
    whiteAccent: '#ffeab5'
  },
  {
    id: 'carbonCeramic',
    label: 'Karbon Keramik',
    white: {
      color: '#dfe6ec',
      roughness: 0.3,
      metalness: 0.22,
      sheen: 0.2,
      sheenColor: '#ffffff',
      clearcoat: 0.18,
      clearcoatRoughness: 0.38,
      specularIntensity: 0.55
    },
    black: {
      color: '#1b1f23',
      roughness: 0.42,
      metalness: 0.28,
      sheen: 0.12,
      sheenColor: '#5e6670',
      clearcoat: 0.12,
      clearcoatRoughness: 0.44,
      specularIntensity: 0.5
    },
    accent: '#64d3ff',
    blackAccent: '#5dd0ff'
  },
  {
    id: 'aquaQuartz',
    label: 'Kuarc Akullt',
    white: {
      color: '#e6f9ff',
      roughness: 0.18,
      metalness: 0.25,
      sheen: 0.34,
      sheenColor: '#ffffff',
      clearcoat: 0.42,
      clearcoatRoughness: 0.24,
      specularIntensity: 0.72
    },
    black: {
      color: '#1c2835',
      roughness: 0.28,
      metalness: 0.46,
      sheen: 0.22,
      sheenColor: '#7ac0ff',
      clearcoat: 0.3,
      clearcoatRoughness: 0.3,
      specularIntensity: 0.66
    },
    accent: '#7ae1ff'
  }
]);

const MODEL_SCALE = 0.75;
const STOOL_SCALE = 1.5 * 1.3;
const CARD_SCALE = 0.95;

const BOARD = { N: 8, tile: 4.2, rim: 2.2, baseH: 0.8 };
const PIECE_Y = 1.2; // baseline height for meshes

const RAW_BOARD_SIZE = BOARD.N * BOARD.tile + BOARD.rim * 2;
const BOARD_SCALE = 0.06;
const BOARD_DISPLAY_SIZE = RAW_BOARD_SIZE * BOARD_SCALE;

const TABLE_RADIUS = 3.4 * MODEL_SCALE;
const SEAT_WIDTH = 0.9 * MODEL_SCALE * STOOL_SCALE;
const SEAT_DEPTH = 0.95 * MODEL_SCALE * STOOL_SCALE;
const SEAT_THICKNESS = 0.09 * MODEL_SCALE * STOOL_SCALE;
const BACK_HEIGHT = 0.68 * MODEL_SCALE * STOOL_SCALE;
const BACK_THICKNESS = 0.08 * MODEL_SCALE * STOOL_SCALE;
const ARM_THICKNESS = 0.125 * MODEL_SCALE * STOOL_SCALE;
const ARM_HEIGHT = 0.3 * MODEL_SCALE * STOOL_SCALE;
const ARM_DEPTH = SEAT_DEPTH * 0.75;
const BASE_COLUMN_HEIGHT = 0.5 * MODEL_SCALE * STOOL_SCALE;
const BASE_TABLE_HEIGHT = 1.08 * MODEL_SCALE;
const CHAIR_BASE_HEIGHT = BASE_TABLE_HEIGHT - SEAT_THICKNESS * 0.85;
const STOOL_HEIGHT = CHAIR_BASE_HEIGHT + SEAT_THICKNESS;
const TABLE_HEIGHT = STOOL_HEIGHT + 0.05 * MODEL_SCALE;
const AI_CHAIR_GAP = (0.4 * MODEL_SCALE * CARD_SCALE) * 0.4;
const CAMERA_TABLE_SPAN_FACTOR = 2.6;

const WALL_PROXIMITY_FACTOR = 0.5; // Bring arena walls 50% closer
const WALL_HEIGHT_MULTIPLIER = 2; // Double wall height
const CHAIR_SCALE = 1;
const CHAIR_CLEARANCE = AI_CHAIR_GAP;
const PLAYER_CHAIR_EXTRA_CLEARANCE = 0;
const CAMERA_PHI_OFFSET = 0;
const CAMERA_TOPDOWN_EXTRA = 0;
const CAMERA_INITIAL_PHI_EXTRA = 0;
const SEAT_LABEL_HEIGHT = 0.74;
const SEAT_LABEL_FORWARD_OFFSET = -0.32;

function cloneWithFreshMaterials(object) {
  const clone = object.clone(true);
  clone.traverse((child) => {
    if (child.isMesh) {
      if (Array.isArray(child.material)) {
        child.material = child.material.map((mat) => mat?.clone?.() || mat);
      } else if (child.material) {
        child.material = child.material.clone?.() || child.material;
      }
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return clone;
}

function applyPieceMaterialSet(object, materialSet) {
  object.traverse((child) => {
    if (!child.isMesh) return;
    const wantsAccent = child.userData?.__pieceMaterialRole === 'accent';
    const targetMaterial = wantsAccent && materialSet.accent ? materialSet.accent : materialSet.base;
    if (targetMaterial) child.material = targetMaterial;
    child.castShadow = true;
    child.receiveShadow = true;
  });
}

function prepareTemplateMesh(mesh, targetHeight) {
  const clone = cloneWithFreshMaterials(mesh);
  const box = new THREE.Box3().setFromObject(clone);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  clone.position.sub(center);
  if (targetHeight && size.y > 1e-4) {
    const scale = targetHeight / size.y;
    clone.scale.setScalar(scale);
  }
  return clone;
}

function buildInlineBoardTemplate(boardTheme = BASE_BOARD_THEME) {
  const tile = BOARD.tile;
  const N = BOARD.N;
  const half = (N * tile) / 2;
  const rim = BOARD.rim;
  const board = new THREE.Group();

  const frameDark = new THREE.MeshPhysicalMaterial({
    color: boardTheme.frameDark,
    roughness: boardTheme.frameRoughness,
    metalness: boardTheme.frameMetalness
  });
  const frameLight = new THREE.MeshPhysicalMaterial({
    color: boardTheme.frameLight,
    roughness: Math.max(0.2, boardTheme.frameRoughness - 0.12),
    metalness: Math.min(1, boardTheme.frameMetalness + 0.18)
  });
  const accentMat = new THREE.MeshPhysicalMaterial({
    color: boardTheme.accent,
    roughness: 0.36,
    metalness: Math.min(1, boardTheme.frameMetalness + 0.2),
    clearcoat: 0.5,
    clearcoatRoughness: 0.28
  });
  const lightTileMat = new THREE.MeshPhysicalMaterial({
    color: boardTheme.light,
    roughness: boardTheme.surfaceRoughness,
    metalness: boardTheme.surfaceMetalness,
    clearcoat: 0.38,
    clearcoatRoughness: 0.28
  });
  const darkTileMat = new THREE.MeshPhysicalMaterial({
    color: boardTheme.dark,
    roughness: Math.max(0.2, boardTheme.surfaceRoughness - 0.12),
    metalness: Math.min(1, boardTheme.surfaceMetalness + 0.16),
    clearcoat: 0.44,
    clearcoatRoughness: 0.24
  });

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(N * tile + rim * 2, BOARD.baseH, N * tile + rim * 2),
    frameDark
  );
  base.position.y = BOARD.baseH / 2;
  board.add(base);

  const bevel = new THREE.Mesh(
    new THREE.BoxGeometry(N * tile + rim * 1.6, 0.24, N * tile + rim * 1.6),
    frameLight
  );
  bevel.position.y = BOARD.baseH + 0.12;
  board.add(bevel);

  const accent = new THREE.Mesh(
    new THREE.BoxGeometry(N * tile + rim * 1.15, 0.12, N * tile + rim * 1.15),
    accentMat
  );
  accent.position.y = BOARD.baseH + 0.24;
  board.add(accent);

  const stage = new THREE.Mesh(
    new THREE.BoxGeometry(N * tile + 0.14, 0.16, N * tile + 0.14),
    frameLight
  );
  stage.position.y = BOARD.baseH + 0.32;
  board.add(stage);

  const tileGroup = new THREE.Group();
  const tileHeight = 0.06;
  const tileY = BOARD.baseH + 0.32 + tileHeight / 2;
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const isDark = (r + c) % 2 === 1;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(tile, tileHeight, tile),
        isDark ? darkTileMat : lightTileMat
      );
      mesh.position.set(c * tile - half + tile / 2, tileY, r * tile - half + tile / 2);
      tileGroup.add(mesh);
    }
  }
  board.add(tileGroup);

  const inset = new THREE.Mesh(
    new THREE.BoxGeometry(N * tile + rim * 0.8, 0.04, N * tile + rim * 0.8),
    accentMat
  );
  inset.position.y = BOARD.baseH + 0.4;
  board.add(inset);

  return board;
}

function buildInlinePieceTemplates(targetHeights = {}) {
  const placeholders = createPieceMaterials(PIECE_STYLE_OPTIONS[0]);
  const pieceTemplates = { white: {}, black: {} };

  Object.entries(BUILDERS).forEach(([key, builder]) => {
    const targetHeight = targetHeights[key];
    const whiteMesh = builder(placeholders.white);
    const blackMesh = builder(placeholders.black);
    pieceTemplates.white[key] = prepareTemplateMesh(whiteMesh, targetHeight);
    pieceTemplates.black[key] = prepareTemplateMesh(blackMesh, targetHeight);
  });

  return pieceTemplates;
}

function buildInlineChessTemplates(targetHeights = {}, boardTheme = BASE_BOARD_THEME) {
  const board = buildInlineBoardTemplate(boardTheme);
  const pieces = buildInlinePieceTemplates(targetHeights);
  return { board, pieces };
}

let cachedChessTemplates = null;
let chessTemplatePromise = null;

async function loadChessTemplates(targetHeights = {}, boardTheme = BASE_BOARD_THEME) {
  if (cachedChessTemplates) return cachedChessTemplates;
  if (!chessTemplatePromise) {
    chessTemplatePromise = Promise.resolve(
      buildInlineChessTemplates(targetHeights, boardTheme)
    ).then((templates) => {
      cachedChessTemplates = templates;
      return templates;
    });
  }
  return chessTemplatePromise;
}
const AVATAR_ANCHOR_HEIGHT = SEAT_THICKNESS / 2 + BACK_HEIGHT * 0.85;
const FALLBACK_SEAT_POSITIONS = [
  { left: '50%', top: '84%' },
  { left: '50%', top: '16%' }
];
const CAMERA_WHEEL_FACTOR = ARENA_CAMERA_DEFAULTS.wheelDeltaFactor;
const SAND_TIMER_RADIUS_FACTOR = 0.68;
const SAND_TIMER_SURFACE_OFFSET = 0.2;
const SAND_TIMER_SCALE = 0.36;

const SNOOKER_TABLE_SCALE = 1.3;
const SNOOKER_TABLE_W = 66 * SNOOKER_TABLE_SCALE;
const SNOOKER_TABLE_H = 132 * SNOOKER_TABLE_SCALE;
const SNOOKER_ROOM_DEPTH = SNOOKER_TABLE_H * 3.6;
const SNOOKER_SIDE_CLEARANCE = SNOOKER_ROOM_DEPTH / 2 - SNOOKER_TABLE_H / 2;
const SNOOKER_ROOM_WIDTH = SNOOKER_TABLE_W + SNOOKER_SIDE_CLEARANCE * 2;
const SNOOKER_SIZE_REDUCTION = 0.7;
const SNOOKER_GLOBAL_SIZE_FACTOR = 0.85 * SNOOKER_SIZE_REDUCTION;
const SNOOKER_WORLD_SCALE = 0.85 * SNOOKER_GLOBAL_SIZE_FACTOR * 0.7;
// Match half of the scaled snooker arena footprint
const CHESS_ARENA = Object.freeze({
  width: (SNOOKER_ROOM_WIDTH * SNOOKER_WORLD_SCALE) / 2,
  depth: (SNOOKER_ROOM_DEPTH * SNOOKER_WORLD_SCALE) / 2
});

const CAMERA_BASE_RADIUS = Math.max(TABLE_RADIUS, BOARD_DISPLAY_SIZE / 2);
const cameraPhiMin = clamp(
  ARENA_CAMERA_DEFAULTS.phiMin + CAMERA_PHI_OFFSET - CAMERA_TOPDOWN_EXTRA,
  ARENA_CAMERA_DEFAULTS.phiMin,
  Math.PI - 0.2
);
const cameraPhiMax = clamp(
  ARENA_CAMERA_DEFAULTS.phiMax + CAMERA_PHI_OFFSET,
  cameraPhiMin + 0.05,
  Math.PI - 0.001
);
const cameraPhiHardMax = Math.min(cameraPhiMax, Math.PI - 0.45);
const CAM = {
  fov: ARENA_CAMERA_DEFAULTS.fov,
  near: ARENA_CAMERA_DEFAULTS.near,
  far: ARENA_CAMERA_DEFAULTS.far,
  minR: CAMERA_BASE_RADIUS * ARENA_CAMERA_DEFAULTS.minRadiusFactor,
  maxR: CAMERA_BASE_RADIUS * ARENA_CAMERA_DEFAULTS.maxRadiusFactor,
  phiMin: cameraPhiMin,
  phiMax: cameraPhiHardMax
};

const APPEARANCE_STORAGE_KEY = 'chessBattleRoyalAppearance';
const PLAYER_FLAG_STORAGE_KEY = 'chessBattleRoyalPlayerFlag';
const FALLBACK_FLAG = '🇺🇸';
const DEFAULT_APPEARANCE = {
  ...DEFAULT_TABLE_CUSTOMIZATION,
  chairColor: 0,
  tableShape: 0,
  boardPalette: 0,
  pieceStyle: 0
};

const CHAIR_COLOR_OPTIONS = Object.freeze([
  {
    id: 'crimsonVelvet',
    label: 'Crimson Velvet',
    primary: '#8b1538',
    accent: '#5c0f26',
    highlight: '#d35a7a',
    legColor: '#1f1f1f'
  },
  {
    id: 'midnightNavy',
    label: 'Midnight Blue',
    primary: '#153a8b',
    accent: '#0c214f',
    highlight: '#4d74d8',
    legColor: '#10131c'
  },
  {
    id: 'emeraldWave',
    label: 'Emerald Wave',
    primary: '#0f6a2f',
    accent: '#063d1b',
    highlight: '#48b26a',
    legColor: '#142318'
  },
  {
    id: 'onyxShadow',
    label: 'Onyx Shadow',
    primary: '#202020',
    accent: '#101010',
    highlight: '#6f6f6f',
    legColor: '#080808'
  },
  {
    id: 'royalPlum',
    label: 'Royal Chestnut',
    primary: '#3f1f5b',
    accent: '#2c1340',
    highlight: '#7c4ae0',
    legColor: '#140a24'
  }
]);

const DIAMOND_SHAPE_ID = 'diamondEdge';
const TABLE_SHAPE_MENU_OPTIONS = TABLE_SHAPE_OPTIONS.filter((option) => option.id !== DIAMOND_SHAPE_ID);

const CUSTOMIZATION_SECTIONS = [
  { key: 'tableWood', label: 'Table Wood', options: TABLE_WOOD_OPTIONS },
  { key: 'tableCloth', label: 'Table Cloth', options: TABLE_CLOTH_OPTIONS },
  { key: 'boardPalette', label: 'Board Colors', options: BOARD_COLOR_OPTIONS },
  { key: 'pieceStyle', label: 'Piece Style', options: PIECE_STYLE_OPTIONS },
  { key: 'chairColor', label: 'Chair Color', options: CHAIR_COLOR_OPTIONS },
  { key: 'tableBase', label: 'Table Base', options: TABLE_BASE_OPTIONS },
  { key: 'tableShape', label: 'Table Shape', options: TABLE_SHAPE_MENU_OPTIONS }
];

function normalizeAppearance(value = {}) {
  const normalized = { ...DEFAULT_APPEARANCE };
  const entries = [
    ['tableWood', TABLE_WOOD_OPTIONS.length],
    ['tableCloth', TABLE_CLOTH_OPTIONS.length],
    ['tableBase', TABLE_BASE_OPTIONS.length],
    ['chairColor', CHAIR_COLOR_OPTIONS.length],
    ['tableShape', TABLE_SHAPE_MENU_OPTIONS.length],
    ['boardPalette', BOARD_COLOR_OPTIONS.length],
    ['pieceStyle', PIECE_STYLE_OPTIONS.length]
  ];
  entries.forEach(([key, max]) => {
    const raw = Number(value?.[key]);
    if (Number.isFinite(raw)) {
      const clamped = Math.min(Math.max(0, Math.round(raw)), max - 1);
      normalized[key] = clamped;
    }
  });
  return normalized;
}

function getEffectiveShapeConfig(shapeIndex) {
  const fallback = TABLE_SHAPE_MENU_OPTIONS[0] ?? TABLE_SHAPE_OPTIONS[0];
  const requested = TABLE_SHAPE_MENU_OPTIONS[shapeIndex] ?? fallback;
  return { option: requested ?? fallback, rotationY: 0, forced: false };
}

const DEFAULT_CHAIR_THEME = Object.freeze({ legColor: '#1f1f1f' });

function createChessChairMaterials(chairOption) {
  const fabricColor = new THREE.Color(chairOption?.primary ?? '#2b314e');
  const accent = new THREE.Color(chairOption?.highlight ?? '#465086');
  const fabricMaterial = new THREE.MeshStandardMaterial({
    color: fabricColor,
    roughness: 0.6,
    metalness: 0.15,
    emissive: accent.clone().multiplyScalar(0.05)
  });
  fabricMaterial.userData = { chairId: chairOption?.id ?? 'default' };

  const legMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(chairOption?.legColor ?? DEFAULT_CHAIR_THEME.legColor),
    roughness: 0.68,
    metalness: 0.22
  });
  legMaterial.userData = { chairId: chairOption?.id ?? 'default' };

  return { fabricMaterial, legMaterial };
}

function createStraightArmrest(side, material) {
  const sideSign = side === 'right' ? 1 : -1;
  const group = new THREE.Group();

  const baseHeight = SEAT_THICKNESS / 2;
  const supportHeight = ARM_HEIGHT + SEAT_THICKNESS * 0.65;
  const topLength = ARM_DEPTH * 1.1;
  const topThickness = ARM_THICKNESS * 0.65;

  const top = new THREE.Mesh(new THREE.BoxGeometry(ARM_THICKNESS * 0.95, topThickness, topLength), material);
  top.position.set(0, baseHeight + supportHeight, -SEAT_DEPTH * 0.05);
  top.castShadow = true;
  top.receiveShadow = true;
  group.add(top);

  const createSupport = (zOffset) => {
    const support = new THREE.Mesh(
      new THREE.BoxGeometry(ARM_THICKNESS * 0.6, supportHeight, ARM_THICKNESS * 0.7),
      material
    );
    support.position.set(0, baseHeight + supportHeight / 2, top.position.z + zOffset);
    support.castShadow = true;
    support.receiveShadow = true;
    return support;
  };

  const frontSupport = createSupport(ARM_DEPTH * 0.4);
  const rearSupport = createSupport(-ARM_DEPTH * 0.4);
  group.add(frontSupport, rearSupport);

  const sidePanel = new THREE.Mesh(
    new THREE.BoxGeometry(ARM_THICKNESS * 0.45, supportHeight * 0.92, ARM_DEPTH * 0.85),
    material
  );
  sidePanel.position.set(0, baseHeight + supportHeight * 0.46, top.position.z - ARM_DEPTH * 0.02);
  sidePanel.castShadow = true;
  sidePanel.receiveShadow = true;
  group.add(sidePanel);

  const handRest = new THREE.Mesh(
    new THREE.BoxGeometry(ARM_THICKNESS * 0.7, topThickness * 0.7, topLength * 0.8),
    material
  );
  handRest.position.set(0, top.position.y + topThickness * 0.45, top.position.z);
  handRest.castShadow = true;
  handRest.receiveShadow = true;
  group.add(handRest);

  group.position.set(sideSign * (SEAT_WIDTH / 2 + ARM_THICKNESS * 0.7), 0, 0);

  return { group, meshes: [top, frontSupport, rearSupport, sidePanel, handRest] };
}

function disposeChessChairMaterials(materials) {
  if (!materials) return;
  materials.fabricMaterial?.dispose?.();
  materials.legMaterial?.dispose?.();
}

function createSandTimer(accentColor = '#f4b400') {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  body.scale.setScalar(SAND_TIMER_SCALE);

  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.52,
    roughness: 0.28
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(accentColor),
    emissive: new THREE.Color(accentColor).multiplyScalar(0.35),
    metalness: 0.26,
    roughness: 0.4
  });
  const goldSand = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    emissive: 0x8a6f1f,
    emissiveIntensity: 0.42,
    metalness: 0.72,
    roughness: 0.32
  });
  const silverSand = new THREE.MeshStandardMaterial({
    color: 0xc0c0c0,
    emissive: 0x5a5a5a,
    emissiveIntensity: 0.34,
    metalness: 0.7,
    roughness: 0.28
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transmission: 0.9,
    opacity: 0.38,
    transparent: true,
    roughness: 0.08,
    metalness: 0.08,
    thickness: 0.12,
    envMapIntensity: 0.65
  });

  const capGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.08, 32);
  const topCap = new THREE.Mesh(capGeo, frameMat);
  topCap.position.y = 0.38;
  const bottomCap = new THREE.Mesh(capGeo, frameMat);
  bottomCap.position.y = -0.38;
  body.add(topCap, bottomCap);

  const pillarGeo = new THREE.CylinderGeometry(0.038, 0.038, 0.72, 12);
  const pillarA = new THREE.Mesh(pillarGeo, frameMat);
  pillarA.position.set(0.22, 0, 0.22);
  const pillarB = pillarA.clone();
  pillarB.position.set(-0.22, 0, 0.22);
  const pillarC = pillarA.clone();
  pillarC.position.set(0.22, 0, -0.22);
  const pillarD = pillarA.clone();
  pillarD.position.set(-0.22, 0, -0.22);
  body.add(pillarA, pillarB, pillarC, pillarD);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 16), frameMat);
  body.add(neck);

  const glassTop = new THREE.Mesh(new THREE.ConeGeometry(0.21, 0.42, 26), glassMat);
  glassTop.position.y = 0.16;
  glassTop.rotation.x = Math.PI;
  const glassBottom = new THREE.Mesh(new THREE.ConeGeometry(0.21, 0.42, 26), glassMat);
  glassBottom.position.y = -0.16;
  body.add(glassTop, glassBottom);

  const sandTop = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.26, 26), goldSand);
  sandTop.position.y = 0.11;
  sandTop.rotation.x = Math.PI;
  const sandBottom = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 26), silverSand);
  sandBottom.position.y = -0.16;
  const sandStream = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.008, 0.24, 16),
    new THREE.MeshStandardMaterial({
      color: 0xf6d6a8,
      transparent: true,
      opacity: 0.4,
      emissive: 0xf0cba2,
      emissiveIntensity: 0.22,
      roughness: 0.48,
      metalness: 0.08
    })
  );
  sandStream.position.y = -0.02;
  sandStream.visible = false;
  body.add(sandTop, sandBottom, sandStream);

  const shimmer = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, 0.22, 14),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.62,
      transparent: true,
      opacity: 0.9
    })
  );
  shimmer.position.y = -0.02;
  body.add(shimmer);

  const sandDropsGeo = new THREE.SphereGeometry(0.014, 10, 10);
  const sandDropsMat = new THREE.MeshStandardMaterial({
    color: 0xf2d3a1,
    emissive: 0xf2c38c,
    emissiveIntensity: 0.38,
    transparent: true,
    opacity: 0.86,
    roughness: 0.34,
    metalness: 0.08
  });
  const dropCount = 32;
  const sandDrops = new THREE.InstancedMesh(sandDropsGeo, sandDropsMat, dropCount);
  body.add(sandDrops);
  const dropStates = Array.from({ length: dropCount }, () => ({
    x: (Math.random() - 0.5) * 0.04,
    z: (Math.random() - 0.5) * 0.04,
    y: Math.random() * 0.12,
    speed: 0.12 + Math.random() * 0.16
  }));
  const resetDrop = (i) => {
    dropStates[i].x = (Math.random() - 0.5) * 0.05;
    dropStates[i].z = (Math.random() - 0.5) * 0.05;
    dropStates[i].y = 0.12 + Math.random() * 0.04;
    dropStates[i].speed = 0.12 + Math.random() * 0.16;
  };

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const timeTexture = new THREE.CanvasTexture(canvas);
  timeTexture.colorSpace = THREE.SRGBColorSpace;
  const timeMaterial = new THREE.MeshStandardMaterial({
    map: timeTexture,
    transparent: true,
    metalness: 0.16,
    roughness: 0.34,
    emissiveIntensity: 0.08,
    side: THREE.DoubleSide
  });
  const timeFace = new THREE.Mesh(new THREE.CircleGeometry(0.26, 64), timeMaterial);
  timeFace.rotation.x = -Math.PI / 2;
  timeFace.position.set(0, 0.42, 0);
  const timeBezel = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.026, 16, 64), accentMat);
  timeBezel.rotation.x = -Math.PI / 2;
  timeBezel.position.set(0, 0.422, 0);
  body.add(timeFace, timeBezel);

  const drawTime = (seconds) => {
    const timeString = formatTime(Math.max(0, Math.round(seconds)));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = canvas.width * 0.44;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();
    const gradient = ctx.createRadialGradient(cx, cy, radius * 0.25, cx, cy, radius);
    gradient.addColorStop(0, 'rgba(12, 16, 26, 0.95)');
    gradient.addColorStop(0.7, 'rgba(12, 16, 26, 0.92)');
    gradient.addColorStop(1, 'rgba(8, 12, 20, 0.92)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 26;
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#f5f8ff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 132px "JetBrains Mono", "Roboto Mono", monospace';
    ctx.fillText(timeString, cx, cy + 8);
    ctx.restore();
    timeTexture.needsUpdate = true;
  };

  let lastDisplay = null;
  let currentTurnWhite = true;
  let lastFill = 1;
  let targetLean = 0;
  let targetSlide = 0;
  let wobbleIntensity = 0;
  const indicatorRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.012, 12, 44),
    new THREE.MeshBasicMaterial({
      color: accentMat.color.clone(),
      transparent: true,
      opacity: 0.54,
      blending: THREE.AdditiveBlending
    })
  );
  indicatorRing.rotation.x = -Math.PI / 2;
  indicatorRing.position.y = 0.41;
  body.add(indicatorRing);

  const applyTurnColor = () => {
    const base = new THREE.Color(currentTurnWhite ? '#ffe4b8' : '#b5c6ff');
    const combined = base.lerp(accentMat.color, 0.4);
    indicatorRing.material.color.copy(combined);
    indicatorRing.material.opacity = currentTurnWhite ? 0.58 : 0.52;
    frameMat.emissive = combined.clone().multiplyScalar(0.42);
    accentMat.emissive = combined.clone().multiplyScalar(0.45);
    timeMaterial.emissive = combined.clone().multiplyScalar(0.26);
  };

  applyTurnColor();

  const tickSandDrops = (dt) => {
    const flow = clamp01(1 - lastFill);
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < dropCount; i += 1) {
      const state = dropStates[i];
      if (flow < 0.04) {
        state.y = -0.16;
      } else {
        state.y -= state.speed * dt * (0.8 + flow * 0.6);
        if (state.y < -0.16) resetDrop(i);
      }
      matrix.compose(
        new THREE.Vector3(state.x, state.y, state.z),
        new THREE.Quaternion(),
        new THREE.Vector3(1, 1, 1)
      );
      sandDrops.setMatrixAt(i, matrix);
    }
    sandDrops.instanceMatrix.needsUpdate = true;
    sandDrops.count = flow < 0.02 ? 0 : dropCount;
  };

  return {
    group: root,
    parts: { sandTop, sandBottom, sandStream },
    updateAccent: (color) => {
      accentMat.color.set(color);
      applyTurnColor();
    },
    setFill: (value) => {
      const pct = clamp01(value, 1);
      const eased = Math.pow(pct, 0.92);
      lastFill = pct;
      sandTop.scale.set(1, Math.max(0.2, eased), 1);
      sandTop.position.y = 0.11 + (eased - 1) * 0.05;
      const bottomScale = Math.max(0.26, 1.12 - eased * 0.9);
      sandBottom.scale.set(1 + (1 - eased) * 0.35, bottomScale, 1 + (1 - eased) * 0.35);
      sandBottom.position.y = -0.16 + (1 - eased) * 0.04;
      sandStream.visible = eased < 0.995;
      sandStream.scale.y = clamp01(1 - eased) * 1.1;
      sandStream.material.opacity = 0.35 + (1 - eased) * 0.38;
      sandStream.position.y = -0.02 - sandStream.scale.y * 0.08;
    },
    setTime: (seconds) => {
      if (seconds === lastDisplay) return;
      lastDisplay = seconds;
      drawTime(seconds);
    },
    setTurn: (isWhiteTurn) => {
      currentTurnWhite = !!isWhiteTurn;
      targetLean = currentTurnWhite ? -0.22 : 0.22;
      targetSlide = currentTurnWhite ? -0.08 : 0.08;
      wobbleIntensity = 1.2;
      applyTurnColor();
    },
    tick: (dt, elapsed) => {
      body.position.x = THREE.MathUtils.damp(body.position.x, targetSlide, 6, dt);
      body.position.y = Math.sin(elapsed * 2.4) * 0.02;
      const lean = THREE.MathUtils.damp(body.rotation.z, targetLean, 7, dt);
      const wobble = Math.sin(elapsed * 8.2) * wobbleIntensity * 0.08;
      body.rotation.z = lean + wobble + Math.sin(elapsed * 2.1) * 0.02;
      body.rotation.x = Math.sin(elapsed * 1.8) * 0.03;
      wobbleIntensity = Math.max(0, wobbleIntensity - dt * 0.8);
      tickSandDrops(dt);
    },
    dispose: () => {
      capGeo.dispose();
      pillarGeo.dispose();
      glassTop.geometry.dispose();
      glassBottom.geometry.dispose();
      sandTop.geometry.dispose();
      sandBottom.geometry.dispose();
      sandStream.geometry.dispose();
      sandDropsGeo.dispose();
      shimmer.geometry.dispose();
      frameMat.dispose();
      accentMat.dispose();
      glassMat.dispose();
      goldSand.dispose();
      silverSand.dispose();
      sandStream.material.dispose();
      sandDropsMat.dispose();
      shimmer.material.dispose();
      timeFace.geometry.dispose();
      timeBezel.geometry.dispose();
      indicatorRing.geometry.dispose();
      indicatorRing.material.dispose();
      timeMaterial.dispose();
      timeTexture.dispose();
    }
  };
}

function buildBoardTheme(option) {
  const source = option || {};
  return {
    light: source.light ?? BASE_BOARD_THEME.light,
    dark: source.dark ?? BASE_BOARD_THEME.dark,
    frameLight: source.frameLight ?? BASE_BOARD_THEME.frameLight,
    frameDark: source.frameDark ?? BASE_BOARD_THEME.frameDark,
    accent: source.accent ?? BASE_BOARD_THEME.accent,
    highlight: source.highlight ?? BASE_BOARD_THEME.highlight,
    capture: source.capture ?? BASE_BOARD_THEME.capture,
    surfaceRoughness: clamp01(source.surfaceRoughness, BASE_BOARD_THEME.surfaceRoughness),
    surfaceMetalness: clamp01(source.surfaceMetalness, BASE_BOARD_THEME.surfaceMetalness),
    frameRoughness: clamp01(source.frameRoughness, BASE_BOARD_THEME.frameRoughness),
    frameMetalness: clamp01(source.frameMetalness, BASE_BOARD_THEME.frameMetalness)
  };
}

function createChessPalette(appearance = DEFAULT_APPEARANCE) {
  const normalized = normalizeAppearance(appearance);
  const boardOption = BOARD_COLOR_OPTIONS[normalized.boardPalette] ?? BOARD_COLOR_OPTIONS[0];
  const pieceOption = PIECE_STYLE_OPTIONS[normalized.pieceStyle] ?? PIECE_STYLE_OPTIONS[0];
  const boardTheme = buildBoardTheme(boardOption);
  return {
    board: boardTheme,
    pieces: pieceOption,
    highlight: boardTheme.highlight,
    capture: boardTheme.capture,
    accent: boardTheme.accent
  };
}

function createPhysicalPieceMaterial(config = {}, fallbackColor) {
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(config.color ?? fallbackColor ?? '#ffffff'),
    roughness: clamp01(config.roughness ?? 0.4),
    metalness: clamp01(config.metalness ?? 0.2),
    clearcoat: clamp01(config.clearcoat ?? 0.12),
    clearcoatRoughness: clamp01(config.clearcoatRoughness ?? 0.3),
    specularIntensity: clamp01(config.specularIntensity ?? 0.55)
  });
  if (Number.isFinite(config.sheen) && config.sheen > 0) {
    material.sheen = clamp01(config.sheen);
    material.sheenColor = new THREE.Color(config.sheenColor ?? '#ffffff');
  }
  if (config.emissive) {
    material.emissive = new THREE.Color(config.emissive);
    material.emissiveIntensity = clamp01(config.emissiveIntensity ?? 0.45);
  }
  if (Number.isFinite(config.reflectivity)) {
    material.reflectivity = clamp01(config.reflectivity);
  }
  return material;
}

function createPieceMaterials(styleOption = PIECE_STYLE_OPTIONS[0]) {
  const option = styleOption || PIECE_STYLE_OPTIONS[0] || {};
  const whiteConfig = option.white || {};
  const blackConfig = option.black || {};

  const whiteBase = createPhysicalPieceMaterial(whiteConfig, '#f5f5f7');
  const whiteAccentColor = option.whiteAccent?.color ?? option.accent ?? whiteConfig.color;
  const whiteAccent = whiteAccentColor && whiteAccentColor !== whiteConfig.color
    ? createPhysicalPieceMaterial({ ...whiteConfig, ...option.whiteAccent, color: whiteAccentColor }, whiteConfig.color)
    : whiteBase;

  const blackBase = createPhysicalPieceMaterial(blackConfig, '#3c4044');
  const blackAccentColor = option.blackAccent?.color ?? option.accent ?? blackConfig.color;
  const blackAccent = blackAccentColor && blackAccentColor !== blackConfig.color
    ? createPhysicalPieceMaterial({ ...blackConfig, ...option.blackAccent, color: blackAccentColor }, blackConfig.color)
    : blackBase;

  return {
    white: { base: whiteBase, accent: whiteAccent },
    black: { base: blackBase, accent: blackAccent }
  };
}

function disposePieceMaterials(materials) {
  if (!materials) return;
  ['white', 'black'].forEach((key) => {
    const set = materials[key];
    if (!set) return;
    set.base?.dispose?.();
    if (set.accent && set.accent !== set.base) {
      set.accent.dispose?.();
    }
  });
}

// =============== Materials & simple builders ===============
function ensureMaterial(input, defaults = {}) {
  if (input instanceof THREE.Material) return input;
  const { roughness = 0.82, metalness = 0.12 } = defaults;
  return new THREE.MeshStandardMaterial({ color: input, roughness, metalness });
}
const box = (w, h, d, material, opts = {}) =>
  new THREE.Mesh(new THREE.BoxGeometry(w, h, d), ensureMaterial(material, opts));
const cyl = (rt, rb, h, material, seg = 24, opts = {}) =>
  new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), ensureMaterial(material, opts));
const sph = (r, material, seg = 20, opts = {}) =>
  new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg), ensureMaterial(material, { roughness: opts.roughness ?? 0.6, metalness: opts.metalness ?? 0.05 }));
const cone = (r, h, material, seg = 24, opts = {}) =>
  new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), ensureMaterial(material, opts));

function tagPieceMesh(mesh, role = 'base') {
  if (!mesh) return mesh;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { ...(mesh.userData || {}), __pieceMaterialRole: role };
  return mesh;
}

// ======================= Piece shapes =======================
function buildPawn(materials = {}) {
  const baseMat = materials.base;
  const accentMat = materials.accent ?? baseMat;
  const g = new THREE.Group();
  const plinth = tagPieceMesh(cyl(1.45, 1.7, 0.5, baseMat));
  plinth.position.y = PIECE_Y + 0.2;
  g.add(plinth);

  const waist = tagPieceMesh(cyl(1.15, 1.3, 0.9, baseMat));
  waist.position.y = PIECE_Y + 0.9;
  g.add(waist);

  const collar = tagPieceMesh(cyl(1, 1.1, 0.22, accentMat), 'accent');
  collar.position.y = PIECE_Y + 1.42;
  g.add(collar);

  const neck = tagPieceMesh(cyl(0.9, 0.9, 0.55, baseMat));
  neck.position.y = PIECE_Y + 1.7;
  g.add(neck);

  const head = tagPieceMesh(sph(0.92, baseMat));
  head.position.y = PIECE_Y + 2.4;
  g.add(head);

  const jewel = tagPieceMesh(sph(0.35, accentMat), 'accent');
  jewel.position.y = PIECE_Y + 3.05;
  g.add(jewel);
  return g;
}

function buildRook(materials = {}) {
  const baseMat = materials.base;
  const accentMat = materials.accent ?? baseMat;
  const g = new THREE.Group();
  const base = tagPieceMesh(cyl(1.6, 1.9, 0.6, baseMat));
  base.position.y = PIECE_Y;
  g.add(base);

  const lower = tagPieceMesh(cyl(1.35, 1.5, 0.55, baseMat));
  lower.position.y = PIECE_Y + 0.6;
  g.add(lower);

  const body = tagPieceMesh(cyl(1.25, 1.25, 2.35, baseMat));
  body.position.y = PIECE_Y + 1.8;
  g.add(body);

  const band = tagPieceMesh(cyl(1.35, 1.35, 0.2, accentMat), 'accent');
  band.position.y = PIECE_Y + 2.4;
  g.add(band);

  const crown = new THREE.Group();
  const crenelations = 6;
  const radius = 1.05;
  for (let i = 0; i < crenelations; i++) {
    const tooth = tagPieceMesh(box(0.55, 0.5, 0.35, accentMat), 'accent');
    tooth.position.set(
      radius * Math.cos((i * Math.PI * 2) / crenelations),
      PIECE_Y + 3.15,
      radius * Math.sin((i * Math.PI * 2) / crenelations)
    );
    crown.add(tooth);
  }
  g.add(crown);
  return g;
}

function buildKnight(materials = {}) {
  const baseMat = materials.base;
  const accentMat = materials.accent ?? baseMat;
  const g = new THREE.Group();
  const base = tagPieceMesh(cyl(1.5, 1.7, 0.6, baseMat));
  base.position.y = PIECE_Y;
  g.add(base);

  const collar = tagPieceMesh(cyl(1.3, 1.4, 0.45, accentMat), 'accent');
  collar.position.y = PIECE_Y + 0.6;
  g.add(collar);

  const body = tagPieceMesh(cyl(1.2, 1.05, 1.5, baseMat));
  body.position.y = PIECE_Y + 1.5;
  g.add(body);

  const neck = tagPieceMesh(cyl(0.95, 0.9, 0.6, baseMat));
  neck.position.set(0.05, PIECE_Y + 2.4, -0.1);
  neck.rotation.y = -Math.PI / 10;
  g.add(neck);

  const head = tagPieceMesh(box(1, 1.4, 1.3, baseMat));
  head.position.set(0.18, PIECE_Y + 3.2, 0.18);
  head.rotation.y = -Math.PI / 8;
  g.add(head);

  const mane = tagPieceMesh(box(0.35, 1.3, 1.05, accentMat), 'accent');
  mane.position.set(-0.3, PIECE_Y + 3.1, -0.1);
  mane.rotation.y = -Math.PI / 12;
  g.add(mane);
  return g;
}

function buildBishop(materials = {}) {
  const baseMat = materials.base;
  const accentMat = materials.accent ?? baseMat;
  const g = new THREE.Group();
  const base = tagPieceMesh(cyl(1.35, 1.6, 0.55, baseMat));
  base.position.y = PIECE_Y;
  g.add(base);

  const waist = tagPieceMesh(cyl(1.1, 1.25, 0.9, baseMat));
  waist.position.y = PIECE_Y + 0.85;
  g.add(waist);

  const sash = tagPieceMesh(cyl(1.05, 1.15, 0.2, accentMat), 'accent');
  sash.position.y = PIECE_Y + 1.4;
  g.add(sash);

  const body = tagPieceMesh(cyl(0.95, 1.05, 1.6, baseMat));
  body.position.y = PIECE_Y + 2.1;
  g.add(body);

  const head = tagPieceMesh(cone(0.95, 1.6, 16, baseMat));
  head.position.y = PIECE_Y + 3.05;
  g.add(head);

  const gem = tagPieceMesh(sph(0.42, accentMat), 'accent');
  gem.position.y = PIECE_Y + 4;
  g.add(gem);
  return g;
}

function buildQueen(materials = {}) {
  const baseMat = materials.base;
  const accentMat = materials.accent ?? baseMat;
  const g = new THREE.Group();
  const base = tagPieceMesh(cyl(1.55, 1.85, 0.6, baseMat));
  base.position.y = PIECE_Y;
  g.add(base);

  const mid = tagPieceMesh(cyl(1.25, 1.4, 1, baseMat));
  mid.position.y = PIECE_Y + 0.9;
  g.add(mid);

  const waist = tagPieceMesh(cyl(1.05, 1.05, 0.35, accentMat), 'accent');
  waist.position.y = PIECE_Y + 1.55;
  g.add(waist);

  const body = tagPieceMesh(cyl(1.05, 1.2, 1.4, baseMat));
  body.position.y = PIECE_Y + 2.3;
  g.add(body);

  const collar = tagPieceMesh(cyl(0.95, 1.1, 0.25, accentMat), 'accent');
  collar.position.y = PIECE_Y + 3.1;
  g.add(collar);

  const crown = new THREE.Group();
  const spikes = 7;
  for (let i = 0; i < spikes; i++) {
    const spike = tagPieceMesh(cone(0.2, 0.65, accentMat), 'accent');
    const angle = i * ((Math.PI * 2) / spikes);
    spike.position.set(Math.cos(angle) * 0.95, PIECE_Y + 3.75, Math.sin(angle) * 0.95);
    spike.rotation.x = -Math.PI / 2;
    crown.add(spike);
  }
  const jewel = tagPieceMesh(sph(0.32, accentMat), 'accent');
  jewel.position.y = PIECE_Y + 4.4;
  crown.add(jewel);
  g.add(crown);
  return g;
}

function buildKing(materials = {}) {
  const baseMat = materials.base;
  const accentMat = materials.accent ?? baseMat;
  const g = new THREE.Group();
  const base = tagPieceMesh(cyl(1.55, 1.95, 0.6, baseMat));
  base.position.y = PIECE_Y;
  g.add(base);

  const stage = tagPieceMesh(cyl(1.25, 1.45, 1, baseMat));
  stage.position.y = PIECE_Y + 0.95;
  g.add(stage);

  const waist = tagPieceMesh(cyl(1.1, 1.1, 0.45, accentMat), 'accent');
  waist.position.y = PIECE_Y + 1.55;
  g.add(waist);

  const body = tagPieceMesh(cyl(1.1, 1.2, 1.6, baseMat));
  body.position.y = PIECE_Y + 2.35;
  g.add(body);

  const collar = tagPieceMesh(cyl(1, 1, 0.35, accentMat), 'accent');
  collar.position.y = PIECE_Y + 3.2;
  g.add(collar);

  const orb = tagPieceMesh(sph(0.55, accentMat), 'accent');
  orb.position.y = PIECE_Y + 3.8;
  g.add(orb);

  const crossV = tagPieceMesh(box(0.22, 0.95, 0.22, accentMat), 'accent');
  crossV.position.y = PIECE_Y + 4.5;
  g.add(crossV);

  const crossH = tagPieceMesh(box(0.9, 0.22, 0.22, accentMat), 'accent');
  crossH.position.y = PIECE_Y + 4.5;
  g.add(crossH);
  return g;
}

// Map to builder
const BUILDERS = {
  P: buildPawn,
  R: buildRook,
  N: buildKnight,
  B: buildBishop,
  Q: buildQueen,
  K: buildKing
};

// ======================= Game logic ========================
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';

function parseFEN(fen) {
  const rows = fen.split('/');
  const board = [];
  for (let r = 0; r < 8; r++) {
    const row = [];
    let i = 0;
    for (const ch of rows[r]) {
      if (/[1-8]/.test(ch)) {
        const n = parseInt(ch, 10);
        for (let k = 0; k < n; k++) row.push(null);
      } else {
        const isWhite = ch === ch.toUpperCase();
        row.push({ t: ch.toUpperCase(), w: isWhite });
      }
      i++;
    }
    board.push(row);
  }
  return board;
}

function cloneBoard(b) {
  return b.map((r) => r.map((c) => (c ? { t: c.t, w: c.w } : null)));
}

// Offsets
const DIRS = {
  N: [-1, 0],
  S: [1, 0],
  E: [0, 1],
  W: [0, -1],
  NE: [-1, 1],
  NW: [-1, -1],
  SE: [1, 1],
  SW: [1, -1]
};
const KN = [
  [-2, -1],
  [-2, 1],
  [-1, -2],
  [-1, 2],
  [1, -2],
  [1, 2],
  [2, -1],
  [2, 1]
];

function inBoard(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function genMoves(board, r, c) {
  const piece = board[r][c];
  if (!piece) return [];
  const { t, w } = piece;
  const moves = [];
  const push = (rr, cc) => {
    if (!inBoard(rr, cc)) return;
    const dst = board[rr][cc];
    if (!dst || dst.w !== w) moves.push([rr, cc]);
  };

  if (t === 'P') {
    const dir = w ? -1 : 1;
    const start = w ? 6 : 1;
    const f1 = [r + dir, c];
    if (inBoard(...f1) && !board[f1[0]][f1[1]]) {
      moves.push(f1);
      const f2 = [r + dir * 2, c];
      if (r === start && !board[f2[0]][f2[1]]) moves.push(f2);
    }
    for (const dc of [-1, 1]) {
      const rr = r + dir,
        cc = c + dc;
      if (inBoard(rr, cc) && board[rr][cc] && board[rr][cc].w !== w)
        moves.push([rr, cc]);
    }
    // (no en passant here)
  } else if (t === 'N') {
    for (const [dr, dc] of KN) {
      const rr = r + dr,
        cc = c + dc;
      push(rr, cc);
    }
  } else if (t === 'B' || t === 'R' || t === 'Q') {
    const dirs = [];
    if (t === 'B' || t === 'Q') dirs.push(DIRS.NE, DIRS.NW, DIRS.SE, DIRS.SW);
    if (t === 'R' || t === 'Q') dirs.push(DIRS.N, DIRS.S, DIRS.E, DIRS.W);
    for (const [dr, dc] of dirs) {
      let rr = r + dr,
        cc = c + dc;
      while (inBoard(rr, cc)) {
        if (board[rr][cc]) {
          if (board[rr][cc].w !== w) moves.push([rr, cc]);
          break;
        }
        moves.push([rr, cc]);
        rr += dr;
        cc += dc;
      }
    }
  } else if (t === 'K') {
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (dr || dc) push(r + dr, c + dc);
      }
    // (no castling here)
  }
  return moves;
}

function findKing(board, w) {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.t === 'K' && p.w === w) return [r, c];
    }
  return null;
}

function isSquareAttacked(board, r, c, byWhite) {
  // generate opponent pseudo-moves and see if any hits (r,c)
  for (let rr = 0; rr < 8; rr++) {
    for (let cc = 0; cc < 8; cc++) {
      const p = board[rr][cc];
      if (!p || p.w !== byWhite) continue;
      const mv = genMoves(board, rr, cc);
      if (mv.some(([r2, c2]) => r2 === r && c2 === c)) return true;
    }
  }
  return false;
}

function applyMove(board, fromR, fromC, toR, toC) {
  const piece = board[fromR][fromC];
  const captured = board[toR][toC];
  board[toR][toC] = piece;
  board[fromR][fromC] = null;
  let promoted = false;
  let previousType = piece ? piece.t : null;
  if (piece && piece.t === 'P' && (toR === 0 || toR === 7)) {
    piece.t = 'Q';
    promoted = true;
  }
  return { captured, promoted, previousType };
}

function revertMove(board, fromR, fromC, toR, toC, snapshot) {
  const piece = board[toR][toC];
  board[fromR][fromC] = piece;
  board[toR][toC] = snapshot.captured ?? null;
  if (snapshot.promoted && piece) {
    piece.t = snapshot.previousType;
  }
}

function isPlayerInCheck(board, whiteTurn) {
  const king = findKing(board, whiteTurn);
  if (!king) return false;
  return isSquareAttacked(board, king[0], king[1], !whiteTurn);
}

function generateMoves(board, whiteTurn, options = {}) {
  const { fromR = null, fromC = null, onlyCaptures = false, limit = Infinity } = options;
  const moves = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece || piece.w !== whiteTurn) continue;
      if (fromR !== null && (r !== fromR || c !== fromC)) continue;
      const pseudo = genMoves(board, r, c);
      for (const [rr, cc] of pseudo) {
        const target = board[rr][cc];
        const promotion = piece.t === 'P' && (rr === 0 || rr === 7);
        if (onlyCaptures && !target && !promotion) continue;
        const snapshot = applyMove(board, r, c, rr, cc);
        const kingSafe = !isPlayerInCheck(board, whiteTurn);
        revertMove(board, r, c, rr, cc, snapshot);
        if (!kingSafe) continue;
        moves.push({
          fromR: r,
          fromC: c,
          toR: rr,
          toC: cc,
          piece: piece.t,
          captured: target ? target.t : null,
          promotion,
          isWhite: whiteTurn
        });
        if (moves.length >= limit) return moves;
      }
    }
  }
  return moves;
}

function legalMoves(board, r, c) {
  const piece = board[r][c];
  if (!piece) return [];
  return generateMoves(board, piece.w, { fromR: r, fromC: c }).map((move) => [move.toR, move.toC]);
}

function anyLegal(board, whiteTurn) {
  return generateMoves(board, whiteTurn, { limit: 1 }).length > 0;
}

// --------- Advanced evaluation & AI for black ---------
const PIECE_VALUE = { P: 100, N: 320, B: 330, R: 500, Q: 950, K: 0 };
const MG_PIECE_VALUE = { P: 82, N: 337, B: 365, R: 477, Q: 1025, K: 0 };
const EG_PIECE_VALUE = { P: 94, N: 281, B: 297, R: 512, Q: 936, K: 0 };
const PIECE_PHASE = { P: 0, N: 1, B: 1, R: 2, Q: 4, K: 0 };
const TOTAL_PHASE = PIECE_PHASE.N * 4 + PIECE_PHASE.B * 4 + PIECE_PHASE.R * 4 + PIECE_PHASE.Q * 2;

const PIECE_SQUARE_TABLES = Object.freeze({
  P: {
    opening: [
      0, 0, 0, 0, 0, 0, 0, 0,
      98, 134, 61, 95, 68, 126, 34, -11,
      -6, 7, 26, 31, 65, 56, 25, -20,
      -14, 13, 6, 21, 23, 12, 17, -23,
      -27, -2, -5, 12, 17, 6, 10, -25,
      -26, -4, -4, -10, 3, 3, 33, -12,
      -35, -1, -20, -23, -15, 24, 38, -22,
      0, 0, 0, 0, 0, 0, 0, 0
    ],
    endgame: [
      0, 0, 0, 0, 0, 0, 0, 0,
      178, 173, 158, 134, 147, 132, 165, 187,
      94, 100, 85, 67, 56, 53, 82, 84,
      32, 24, 13, 5, -2, 4, 17, 17,
      13, 9, -3, -7, -7, -8, 3, -1,
      4, 7, -6, 1, 0, -5, -1, -8,
      13, 8, 8, 10, 13, 0, 2, -7,
      0, 0, 0, 0, 0, 0, 0, 0
    ]
  },
  N: {
    opening: [
      -167, -89, -34, -49, 61, -97, -15, -107,
      -73, -41, 72, 36, 23, 62, 7, -17,
      -47, 60, 37, 65, 84, 129, 73, 44,
      -9, 17, 19, 53, 37, 69, 18, 22,
      -13, 4, 16, 13, 28, 19, 21, -8,
      -23, -9, 12, 10, 19, 17, 25, -16,
      -29, -53, -12, -3, -1, 18, -14, -19,
      -105, -21, -58, -33, -17, -28, -19, -23
    ],
    endgame: [
      -58, -38, -13, -28, -31, -27, -63, -99,
      -25, -8, -25, -2, -9, -25, -24, -52,
      -24, -20, 10, 9, -1, -9, -19, -41,
      -17, 3, 22, 22, 22, 11, 8, -18,
      -18, -6, 16, 25, 16, 17, 4, -18,
      -23, -3, -1, 15, 10, -3, -20, -22,
      -42, -20, -10, -5, -2, -20, -23, -44,
      -29, -51, -23, -15, -22, -18, -50, -64
    ]
  },
  B: {
    opening: [
      -29, 4, -82, -37, -25, -42, 7, -8,
      -26, 16, -18, -13, 30, 59, 18, -47,
      -16, 37, 43, 40, 35, 50, 37, -2,
      -4, 5, 19, 50, 37, 37, 7, -2,
      -6, 13, 13, 26, 34, 12, 10, 4,
      0, 13, 14, 27, 25, 15, 10, 0,
      14, 25, 24, 15, 8, 25, 20, 15,
      -13, 0, -13, -17, -43, -7, -9, -21
    ],
    endgame: [
      -14, -21, -11, -8, -7, -9, -17, -24,
      -8, -4, 7, -12, -3, -13, -4, -14,
      2, -8, 0, -1, -2, 6, 0, 4,
      -3, 9, 12, 9, 14, 10, 3, 2,
      -6, 3, 13, 19, 7, 10, -3, -9,
      -12, -3, 8, 10, 13, 3, -7, -15,
      -14, -18, -7, -1, 4, -9, -15, -27,
      -23, -9, -23, -5, -9, -16, -5, -17
    ]
  },
  R: {
    opening: [
      32, 42, 32, 51, 63, 9, 31, 43,
      27, 32, 58, 62, 80, 67, 26, 44,
      -5, 19, 26, 36, 17, 45, 61, 16,
      -24, -11, 7, 26, 24, 35, 38, -22,
      -36, -26, -12, -1, 9, -7, 6, -23,
      -45, -25, -16, -17, 3, 0, -5, -33,
      -44, -16, -20, -9, -1, 11, -6, -71,
      -19, -13, 1, 17, 16, 7, -37, -26
    ],
    endgame: [
      13, 10, 18, 15, 12, 12, 8, 5,
      11, 13, 13, 11, -3, 3, 8, 3,
      7, 7, 7, 5, 4, -3, -5, -3,
      4, 3, 13, 1, 2, 1, -1, 2,
      3, 5, 8, 4, -5, -6, -8, -11,
      -4, 0, -5, -1, -7, -12, -8, -16,
      -6, -6, 0, 2, -9, -9, -11, -3,
      -9, 2, 3, -1, -5, -13, 4, -20
    ]
  },
  Q: {
    opening: [
      -28, 0, 29, 12, 59, 44, 43, 45,
      -24, -39, -5, 1, -16, 57, 28, 54,
      -13, -17, 7, 8, 29, 56, 47, 57,
      -27, -27, -16, -16, -1, 17, -2, 1,
      -9, -26, -9, -10, -2, -4, 3, -3,
      -14, 2, -11, -2, -5, 2, 14, 5,
      -35, -8, 11, 2, 8, 15, -3, 1,
      -1, -18, -9, 10, -15, -25, -31, -50
    ],
    endgame: [
      -9, 22, 22, 27, 27, 19, 10, 20,
      -17, 20, 32, 41, 58, 25, 30, 0,
      -20, 6, 9, 49, 47, 35, 19, 9,
      3, 22, 24, 45, 57, 40, 57, 36,
      -18, 28, 19, 47, 31, 34, 39, 23,
      -16, -27, 15, 6, 9, 17, 10, 5,
      -22, -23, -30, -16, -16, -23, -36, -32,
      -33, -28, -22, -43, -5, -32, -20, -41
    ]
  },
  K: {
    opening: [
      -65, 23, 16, -15, -56, -34, 2, 13,
      29, -1, -20, -7, -8, -4, -38, -29,
      -9, 24, 2, -16, -20, 6, 22, -22,
      -17, -20, -12, -27, -30, -25, -14, -36,
      -49, -1, -27, -39, -46, -44, -33, -51,
      -14, -14, -22, -46, -44, -30, -15, -27,
      1, 7, -8, -64, -43, -16, 9, 8,
      -15, 36, 12, -54, 8, -28, 24, 14
    ],
    endgame: [
      -74, -35, -18, -18, -11, 15, 4, -17,
      -12, 17, 14, 17, 17, 38, 23, 11,
      10, 17, 23, 15, 20, 45, 44, 13,
      -8, 22, 24, 27, 26, 33, 26, 3,
      -18, -4, 21, 24, 27, 23, 9, -11,
      -19, -3, 11, 21, 23, 16, 7, -9,
      -27, -11, 4, 13, 14, 4, -5, -17,
      -53, -34, -21, -11, -28, -14, -24, -43
    ]
  }
});

const MATE_SCORE = 100000;
const TRANSPOSITION_LIMIT = 120000;
const MAX_QUIESCENCE_DEPTH = 4;
const transpositionTable = new Map();

function boardToKey(board, whiteTurn) {
  let key = '';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      key += p ? (p.w ? p.t : p.t.toLowerCase()) : '.';
    }
  }
  return key + (whiteTurn ? 'w' : 'b');
}

function scoreMove(move) {
  let score = 0;
  if (move.captured) {
    score += 1000 + (PIECE_VALUE[move.captured] ?? 0) * 10 - (PIECE_VALUE[move.piece] ?? 0);
  }
  if (move.promotion) score += 900;
  const tables = PIECE_SQUARE_TABLES[move.piece];
  if (tables) {
    const table = tables.opening || [];
    const fromIdx = move.isWhite
      ? move.fromR * 8 + move.fromC
      : (7 - move.fromR) * 8 + move.fromC;
    const toIdx = move.isWhite
      ? move.toR * 8 + move.toC
      : (7 - move.toR) * 8 + move.toC;
    score += (table[toIdx] ?? 0) - (table[fromIdx] ?? 0);
  }
  if (!move.captured && !move.promotion && move.piece === 'P') {
    score += 10 - Math.abs(3.5 - move.toC) * 2;
  }
  return score;
}

function orderMoves(moves) {
  moves.forEach((move) => {
    move.orderScore = scoreMove(move);
  });
  moves.sort((a, b) => (b.orderScore ?? 0) - (a.orderScore ?? 0));
}

function quiescence(board, alpha, beta, whiteTurn, depth = 0) {
  const standPat = evaluate(board, whiteTurn);
  if (whiteTurn) {
    if (standPat >= beta) return standPat;
    if (standPat > alpha) alpha = standPat;
  } else {
    if (standPat <= alpha) return standPat;
    if (standPat < beta) beta = standPat;
  }
  if (depth >= MAX_QUIESCENCE_DEPTH) return standPat;
  const captures = generateMoves(board, whiteTurn, { onlyCaptures: true });
  if (!captures.length) return standPat;
  orderMoves(captures);
  if (whiteTurn) {
    let value = alpha;
    for (const move of captures) {
      const snapshot = applyMove(board, move.fromR, move.fromC, move.toR, move.toC);
      const score = quiescence(board, value, beta, false, depth + 1);
      revertMove(board, move.fromR, move.fromC, move.toR, move.toC, snapshot);
      if (score > value) value = score;
      if (value >= beta) return value;
    }
    return value;
  }
  let value = beta;
  for (const move of captures) {
    const snapshot = applyMove(board, move.fromR, move.fromC, move.toR, move.toC);
    const score = quiescence(board, alpha, value, true, depth + 1);
    revertMove(board, move.fromR, move.fromC, move.toR, move.toC, snapshot);
    if (score < value) value = score;
    if (value <= alpha) return value;
  }
  return value;
}

function evaluate(board, whiteTurn) {
  let mgScore = 0;
  let egScore = 0;
  let phase = 0;
  let whiteBishops = 0;
  let blackBishops = 0;
  let mobilityWhite = 0;
  let mobilityBlack = 0;

  const whitePawnFiles = Array(8).fill(0);
  const blackPawnFiles = Array(8).fill(0);
  const whitePawnRows = Array.from({ length: 8 }, () => []);
  const blackPawnRows = Array.from({ length: 8 }, () => []);
  const whitePawns = [];
  const blackPawns = [];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;
      const idx = r * 8 + c;
      const mirror = (7 - r) * 8 + c;
      const tables = PIECE_SQUARE_TABLES[piece.t] || {};
      const mgTable = tables.opening || [];
      const egTable = tables.endgame || mgTable;
      const mgVal = MG_PIECE_VALUE[piece.t] ?? 0;
      const egVal = EG_PIECE_VALUE[piece.t] ?? mgVal;

      const mobility = genMoves(board, r, c).length;
      if (piece.w) {
        mgScore += mgVal + (mgTable[idx] ?? 0);
        egScore += egVal + (egTable[idx] ?? 0);
        mobilityWhite += mobility;
        if (piece.t === 'B') whiteBishops++;
        if (piece.t === 'P') {
          whitePawnFiles[c] += 1;
          whitePawnRows[c].push(r);
          whitePawns.push({ r, c });
        }
      } else {
        mgScore -= mgVal + (mgTable[mirror] ?? 0);
        egScore -= egVal + (egTable[mirror] ?? 0);
        mobilityBlack += mobility;
        if (piece.t === 'B') blackBishops++;
        if (piece.t === 'P') {
          blackPawnFiles[c] += 1;
          blackPawnRows[c].push(r);
          blackPawns.push({ r, c });
        }
      }
      phase += PIECE_PHASE[piece.t] ?? 0;
    }
  }

  if (whiteBishops >= 2) {
    mgScore += 30;
    egScore += 50;
  }
  if (blackBishops >= 2) {
    mgScore -= 30;
    egScore -= 50;
  }

  const mobilityDelta = mobilityWhite - mobilityBlack;
  mgScore += mobilityDelta * 4;
  egScore += mobilityDelta * 2;

  for (let file = 0; file < 8; file++) {
    if (whitePawnFiles[file] > 1) {
      const penalty = 18 * (whitePawnFiles[file] - 1);
      mgScore -= penalty;
      egScore -= penalty / 2;
    }
    if (blackPawnFiles[file] > 1) {
      const penalty = 18 * (blackPawnFiles[file] - 1);
      mgScore += penalty;
      egScore += penalty / 2;
    }
    whitePawnRows[file].sort((a, b) => a - b);
    blackPawnRows[file].sort((a, b) => a - b);
  }

  const hasWhitePawnOnFile = (file) => file >= 0 && file < 8 && whitePawnFiles[file] > 0;
  const hasBlackPawnOnFile = (file) => file >= 0 && file < 8 && blackPawnFiles[file] > 0;

  whitePawns.forEach(({ r, c }) => {
    if (!hasWhitePawnOnFile(c - 1) && !hasWhitePawnOnFile(c + 1)) {
      mgScore -= 15;
      egScore -= 25;
    }
    let blocked = false;
    for (let file = c - 1; file <= c + 1; file++) {
      if (file < 0 || file > 7) continue;
      if (blackPawnRows[file].some((row) => row < r)) {
        blocked = true;
        break;
      }
    }
    if (!blocked) {
      const advance = 7 - r;
      mgScore += 15 + advance * 6;
      egScore += 30 + advance * 10;
    }
  });

  blackPawns.forEach(({ r, c }) => {
    if (!hasBlackPawnOnFile(c - 1) && !hasBlackPawnOnFile(c + 1)) {
      mgScore += 15;
      egScore += 25;
    }
    let blocked = false;
    for (let file = c - 1; file <= c + 1; file++) {
      if (file < 0 || file > 7) continue;
      if (whitePawnRows[file].some((row) => row > r)) {
        blocked = true;
        break;
      }
    }
    if (!blocked) {
      const advance = r;
      mgScore -= 15 + advance * 6;
      egScore -= 30 + advance * 10;
    }
  });

  const phaseScore = Math.min(phase, TOTAL_PHASE);
  const openingWeight = phaseScore / TOTAL_PHASE;
  const endgameWeight = 1 - openingWeight;
  const blended = mgScore * openingWeight + egScore * endgameWeight;
  const tempo = whiteTurn ? 12 : -12;
  return Math.round(blended + tempo);
}

function minimax(board, depth, whiteTurn, alpha, beta, ply = 0) {
  const alphaOrig = alpha;
  const betaOrig = beta;
  const key = boardToKey(board, whiteTurn);
  const entry = transpositionTable.get(key);
  if (entry && entry.depth >= depth) {
    if (entry.flag === 'exact') return entry.value;
    if (entry.flag === 'lower' && entry.value > alpha) alpha = entry.value;
    else if (entry.flag === 'upper' && entry.value < beta) beta = entry.value;
    if (alpha >= beta) return entry.value;
  }

  if (depth === 0) {
    return quiescence(board, alpha, beta, whiteTurn);
  }

  const moves = generateMoves(board, whiteTurn);
  if (!moves.length) {
    return isPlayerInCheck(board, whiteTurn)
      ? whiteTurn
        ? -MATE_SCORE + ply
        : MATE_SCORE - ply
      : 0;
  }

  orderMoves(moves);
  let value = whiteTurn ? -Infinity : Infinity;
  for (const move of moves) {
    const snapshot = applyMove(board, move.fromR, move.fromC, move.toR, move.toC);
    const score = minimax(board, depth - 1, !whiteTurn, alpha, beta, ply + 1);
    revertMove(board, move.fromR, move.fromC, move.toR, move.toC, snapshot);

    if (whiteTurn) {
      if (score > value) value = score;
      if (value > alpha) alpha = value;
    } else {
      if (score < value) value = score;
      if (value < beta) beta = value;
    }

    if (alpha >= beta) break;
  }

  let flag = 'exact';
  if (value <= alphaOrig) flag = 'upper';
  else if (value >= betaOrig) flag = 'lower';

  if (transpositionTable.size > TRANSPOSITION_LIMIT) {
    transpositionTable.clear();
  }
  transpositionTable.set(key, { depth, value, flag });
  return value;
}

function bestBlackMove(board, depth = 4) {
  const moves = generateMoves(board, false);
  if (!moves.length) return null;
  orderMoves(moves);
  const searchDepth = moves.length <= 10 ? depth + 1 : depth;
  let bestMove = null;
  let bestScore = Infinity;
  for (const move of moves) {
    const snapshot = applyMove(board, move.fromR, move.fromC, move.toR, move.toC);
    const score = minimax(board, searchDepth - 1, true, -Infinity, Infinity, 1);
    revertMove(board, move.fromR, move.fromC, move.toR, move.toC, snapshot);
    if (score < bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }
  return bestMove;
}

const formatTime = (t) =>
  `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;

// ======================= Main Component =======================
function Chess3D({ avatar, username, initialFlag, initialAiFlag }) {
  const wrapRef = useRef(null);
  const rafRef = useRef(0);
  const timerRef = useRef(null);
  const bombSoundRef = useRef(null);
  const timerSoundRef = useRef(null);
  const lastBeepRef = useRef({ white: null, black: null });
  const zoomRef = useRef({});
  const controlsRef = useRef(null);
  const fitRef = useRef(() => {});
  const arenaRef = useRef(null);
  const clearHighlightsRef = useRef(() => {});
  const settingsRef = useRef({ showHighlights: true, soundEnabled: true });
  const [appearance, setAppearance] = useState(() => {
    if (typeof window === 'undefined') return { ...DEFAULT_APPEARANCE };
    try {
      const stored = window.localStorage?.getItem(APPEARANCE_STORAGE_KEY);
      if (!stored) return { ...DEFAULT_APPEARANCE };
      const parsed = JSON.parse(stored);
      return normalizeAppearance(parsed);
    } catch (error) {
      console.warn('Failed to load Chess appearance', error);
      return { ...DEFAULT_APPEARANCE };
    }
  });
  const appearanceRef = useRef(appearance);
  const paletteRef = useRef(createChessPalette(appearance));
  const seatPositionsRef = useRef([]);
  const resolvedInitialFlag = useMemo(() => {
    if (initialFlag && FLAG_EMOJIS.includes(initialFlag)) {
      return initialFlag;
    }
    if (typeof window !== 'undefined') {
      try {
        const stored = window.localStorage?.getItem(PLAYER_FLAG_STORAGE_KEY);
        if (stored && FLAG_EMOJIS.includes(stored)) {
          return stored;
        }
      } catch (error) {
        console.warn('Failed to load Chess flag', error);
      }
    }
    return '';
  }, [initialFlag]);
  const [playerFlag, setPlayerFlag] = useState(resolvedInitialFlag);
  const [aiFlag, setAiFlag] = useState(() => {
    const preferred =
      initialAiFlag && FLAG_EMOJIS.includes(initialAiFlag) ? initialAiFlag : null;
    if (preferred) return preferred;
    if (typeof window !== 'undefined') {
      try {
        const stored = window.localStorage?.getItem('chessBattleRoyalAiFlag');
        if (stored && FLAG_EMOJIS.includes(stored)) return stored;
      } catch {}
    }
    const fallbackChoice =
      FLAG_EMOJIS.length > 0
        ? FLAG_EMOJIS[Math.floor(Math.random() * FLAG_EMOJIS.length)]
        : FALLBACK_FLAG;
    const baseFlag = resolvedInitialFlag || fallbackChoice || FALLBACK_FLAG;
    return getAIOpponentFlag(baseFlag);
  });
  const [whiteTime, setWhiteTime] = useState(60);
  const [blackTime, setBlackTime] = useState(5);
  const whiteTimeRef = useRef(whiteTime);
  const blackTimeRef = useRef(blackTime);
  const initialWhiteTimeRef = useRef(60);
  const initialBlackTimeRef = useRef(5);
  const [configOpen, setConfigOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showHighlights, setShowHighlights] = useState(true);
  const [seatAnchors, setSeatAnchors] = useState([]);
  const [ui, setUi] = useState({
    turnWhite: true,
    status: 'White to move',
    promoting: null,
    winner: null
  });
  const uiRef = useRef(ui);
  useEffect(() => {
    uiRef.current = ui;
  }, [ui]);

  useEffect(() => {
    whiteTimeRef.current = whiteTime;
  }, [whiteTime]);

  useEffect(() => {
    blackTimeRef.current = blackTime;
  }, [blackTime]);

  const seatAnchorMap = useMemo(() => {
    const map = new Map();
    seatAnchors.forEach((anchor) => {
      if (anchor && typeof anchor.index === 'number') {
        map.set(anchor.index, anchor);
      }
    });
    return map;
  }, [seatAnchors]);

  const updateSandTimerPlacement = useCallback(
    (_turnWhiteValue = uiRef.current?.turnWhite ?? true) => {
      const arena = arenaRef.current;
      if (!arena?.sandTimer) return;
      const surfaceY = arena.tableInfo?.surfaceY ?? TABLE_HEIGHT;
      const radius = (arena.tableInfo?.radius ?? TABLE_RADIUS) * SAND_TIMER_RADIUS_FACTOR;
      const targetZ = (_turnWhiteValue ? 1 : -1) * radius;
      const targetRot = _turnWhiteValue ? Math.PI : 0;
      arena.sandTimer.group.position.set(0, surfaceY + SAND_TIMER_SURFACE_OFFSET, targetZ);
      arena.sandTimer.group.rotation.y = targetRot;
    },
    []
  );

  const players = useMemo(() => {
    const accentColor = paletteRef.current?.accent ?? '#4ce0c3';
    const effectivePlayerFlag =
      playerFlag || resolvedInitialFlag || (FLAG_EMOJIS.length > 0 ? FLAG_EMOJIS[0] : FALLBACK_FLAG);
    const playerName =
      avatarToName(effectivePlayerFlag) || username || avatarToName(avatar) || 'Player';
    const playerPhoto = avatar || effectivePlayerFlag || '🙂';

    const effectiveAiFlag = aiFlag || getAIOpponentFlag(effectivePlayerFlag || FALLBACK_FLAG);
    const aiName = avatarToName(effectiveAiFlag) || 'AI Rival';

    return [
      {
        index: 0,
        photoUrl: playerPhoto,
        name: playerName,
        color: accentColor,
        isTurn: ui.turnWhite
      },
      {
        index: 1,
        photoUrl: effectiveAiFlag || '🏁',
        name: aiName,
        color: accentColor,
        isTurn: !ui.turnWhite
      }
    ];
  }, [aiFlag, appearance, avatar, playerFlag, resolvedInitialFlag, ui.turnWhite, username]);

  useEffect(() => {
    updateSandTimerPlacement(ui.turnWhite);
  }, [ui.turnWhite, updateSandTimerPlacement]);

  useEffect(() => {
    const arena = arenaRef.current;
    arena?.sandTimer?.setTurn?.(ui.turnWhite);
  }, [ui.turnWhite]);

  useEffect(() => {
    if (aiFlag && FLAG_EMOJIS.includes(aiFlag)) {
      try {
        window.localStorage?.setItem('chessBattleRoyalAiFlag', aiFlag);
      } catch {}
    }
  }, [aiFlag]);

  const renderPreview = useCallback((type, option) => {
    switch (type) {
      case 'tableWood': {
        const preset = option?.presetId ? WOOD_PRESETS_BY_ID[option.presetId] : undefined;
        const grain = option?.grainId ? WOOD_GRAIN_OPTIONS_BY_ID[option.grainId] : undefined;
        const presetRef = preset || WOOD_FINISH_PRESETS?.[0];
        const baseHex = presetRef
          ? `#${hslToHexNumber(presetRef.hue, presetRef.sat, presetRef.light)
              .toString(16)
              .padStart(6, '0')}`
          : '#8b5a2b';
        const accentHex = presetRef
          ? `#${hslToHexNumber(
              presetRef.hue,
              Math.min(1, presetRef.sat + 0.12),
              Math.max(0, presetRef.light - 0.18)
            )
              .toString(16)
              .padStart(6, '0')}`
          : '#5a3820';
        const grainLabel = grain?.label ?? WOOD_GRAIN_OPTIONS?.[0]?.label ?? '';
        return (
          <div className="relative h-14 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950/40">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `repeating-linear-gradient(135deg, ${baseHex}, ${baseHex} 12%, ${accentHex} 12%, ${accentHex} 20%)`
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/40" />
            <div className="absolute bottom-1 right-1 rounded-full bg-black/60 px-2 py-0.5 text-[0.55rem] font-semibold uppercase tracking-wide text-emerald-100/80">
              {grainLabel.slice(0, 12)}
            </div>
          </div>
        );
      }
      case 'tableCloth':
        return (
          <div className="relative h-14 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950/40">
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="h-12 w-20 rounded-[999px] border border-white/10"
                style={{ background: `radial-gradient(circle at 35% 30%, ${option.feltTop}, ${option.feltBottom})` }}
              />
            </div>
            <div className="absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-black/50 to-transparent" />
          </div>
        );
      case 'chairColor':
        return (
          <div className="relative h-14 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950/40">
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="h-12 w-20 rounded-3xl border border-white/10"
                style={{
                  background: `linear-gradient(135deg, ${option.primary}, ${option.accent})`,
                  boxShadow: 'inset 0 0 12px rgba(0,0,0,0.35)'
                }}
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-black/40" />
          </div>
        );
      case 'tableBase':
        return (
          <div className="relative h-14 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950/40">
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="h-12 w-20 rounded-3xl border border-white/10"
                style={{
                  background: `linear-gradient(135deg, ${option.baseColor}, ${option.trimColor ?? option.baseColor})`,
                  boxShadow: 'inset 0 0 10px rgba(0,0,0,0.4)'
                }}
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/40" />
          </div>
        );
      case 'tableShape':
        return (
          <div className="relative h-14 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950/40">
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="h-12 w-20 bg-white/10"
                style={{
                  borderRadius: option.preview?.borderRadius ?? '18%',
                  clipPath: option.preview?.clipPath
                }}
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/40" />
          </div>
        );
      default:
        return null;
    }
  }, []);

  useEffect(() => {
    appearanceRef.current = appearance;
  }, [appearance]);

  useEffect(() => {
    if (!playerFlag && resolvedInitialFlag) {
      setPlayerFlag(resolvedInitialFlag);
    }
  }, [playerFlag, resolvedInitialFlag]);

  useEffect(() => {
    let cancelled = false;
    if (playerFlag) return () => {};
    (async () => {
      try {
        const resolved = await ipToFlag();
        if (!cancelled && resolved) {
          setPlayerFlag(resolved);
        }
      } catch (error) {
        console.warn('Failed to resolve Chess player flag', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [playerFlag]);

  useEffect(() => {
    if (!playerFlag) return;
    if (typeof window === 'undefined') return;
    try {
      window.localStorage?.setItem(PLAYER_FLAG_STORAGE_KEY, playerFlag);
    } catch (error) {
      console.warn('Failed to persist Chess player flag', error);
    }
  }, [playerFlag]);

  useEffect(() => {
    if (!playerFlag) return;
    setAiFlag(getAIOpponentFlag(playerFlag));
  }, [playerFlag]);

  useEffect(() => {
    settingsRef.current.showHighlights = showHighlights;
    if (!showHighlights && typeof clearHighlightsRef.current === 'function') {
      clearHighlightsRef.current();
    }
  }, [showHighlights]);

  useEffect(() => {
    settingsRef.current.soundEnabled = soundEnabled;
    const volume = getGameVolume();
    if (bombSoundRef.current) {
      bombSoundRef.current.volume = soundEnabled ? volume : 0;
      if (!soundEnabled) {
        try {
          bombSoundRef.current.pause();
          bombSoundRef.current.currentTime = 0;
        } catch {}
      }
    }
    if (timerSoundRef.current) {
      timerSoundRef.current.volume = soundEnabled ? volume : 0;
      if (!soundEnabled) {
        try {
          timerSoundRef.current.pause();
          timerSoundRef.current.currentTime = 0;
        } catch {}
      }
    }
  }, [soundEnabled]);

  useEffect(() => {
    const handleVolumeChange = () => {
      const volume = getGameVolume();
      if (bombSoundRef.current) {
        bombSoundRef.current.volume = settingsRef.current.soundEnabled ? volume : 0;
      }
      if (timerSoundRef.current) {
        timerSoundRef.current.volume = settingsRef.current.soundEnabled ? volume : 0;
      }
    };
    window.addEventListener('gameVolumeChanged', handleVolumeChange);
    return () => {
      window.removeEventListener('gameVolumeChanged', handleVolumeChange);
    };
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage?.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(appearance));
      } catch (error) {
        console.warn('Failed to persist Chess appearance', error);
      }
    }

    const arena = arenaRef.current;
    if (!arena) return;

    const normalized = normalizeAppearance(appearance);
    const palette = createChessPalette(normalized);
    paletteRef.current = palette;
    arena.palette = palette;
    if (arenaRef.current) {
      arenaRef.current.palette = palette;
      arenaRef.current.boardMaterials = arena.boardMaterials;
    }
    const woodOption = TABLE_WOOD_OPTIONS[normalized.tableWood] ?? TABLE_WOOD_OPTIONS[0];
    const clothOption = TABLE_CLOTH_OPTIONS[normalized.tableCloth] ?? TABLE_CLOTH_OPTIONS[0];
    const baseOption = TABLE_BASE_OPTIONS[normalized.tableBase] ?? TABLE_BASE_OPTIONS[0];
    const chairOption = CHAIR_COLOR_OPTIONS[normalized.chairColor] ?? CHAIR_COLOR_OPTIONS[0];
    const { option: shapeOption, rotationY } = getEffectiveShapeConfig(normalized.tableShape);
    const boardTheme = palette.board;
    const pieceStyleOption = palette.pieces;

    if (shapeOption) {
      const shapeChanged = shapeOption.id !== arena.tableShapeId;
      const rotationChanged = Math.abs((arena.tableInfo?.rotationY ?? 0) - rotationY) > 1e-3;
      if (shapeChanged || rotationChanged) {
        const { boardGroup } = arena;
        if (boardGroup && arena.tableInfo?.group) {
          arena.tableInfo.group.remove(boardGroup);
        }
        const nextTable = createMurlanStyleTable({
          arena: arena.arenaGroup,
          renderer: arena.renderer,
          tableRadius: TABLE_RADIUS,
          tableHeight: TABLE_HEIGHT,
          woodOption,
          clothOption,
          baseOption,
          shapeOption,
          rotationY
        });
        applyTableMaterials(nextTable.materials, { woodOption, clothOption, baseOption }, arena.renderer);
        if (boardGroup) {
          boardGroup.position.set(0, nextTable.surfaceY + 0.004, 0);
          nextTable.group.add(boardGroup);
        }
        arena.tableInfo?.dispose?.();
        arena.tableInfo = nextTable;
        arena.tableShapeId = nextTable.shapeId;
        if (arena.boardLookTarget) {
          const targetY = boardGroup
            ? boardGroup.position.y + (BOARD.baseH + 0.12) * BOARD_SCALE
            : nextTable.surfaceY + (BOARD.baseH + 0.12) * BOARD_SCALE;
          arena.boardLookTarget.set(0, targetY, 0);
        }
        arena.spotTarget?.position.copy(arena.boardLookTarget ?? new THREE.Vector3());
        arena.spotLight?.target?.updateMatrixWorld?.();
        arena.studioCameras?.forEach((cam) => cam?.lookAt?.(arena.boardLookTarget ?? new THREE.Vector3()));
        arena.controls?.target.copy(arena.boardLookTarget ?? new THREE.Vector3());
        arena.controls?.update();
        fitRef.current?.();
      } else if (arena.tableInfo?.materials) {
        applyTableMaterials(arena.tableInfo.materials, { woodOption, clothOption, baseOption }, arena.renderer);
      }
    }

    if (chairOption) {
      const currentMaterials = arena.chairMaterials;
      const currentId = currentMaterials?.fabricMaterial?.userData?.chairId ?? 'default';
      const nextId = chairOption.id ?? 'default';
      if (currentId !== nextId) {
        const nextMaterials = createChessChairMaterials(chairOption);
        arena.chairs?.forEach((chair) => {
          chair.seatMeshes.forEach((mesh) => {
            mesh.material = nextMaterials.fabricMaterial;
          });
          chair.legMeshes.forEach((mesh) => {
            mesh.material = nextMaterials.legMaterial;
          });
        });
        disposeChessChairMaterials(currentMaterials);
        arena.chairMaterials = nextMaterials;
      }
    }

    if (arena.boardMaterials) {
      const { base: baseMat, top: topMat, coord: coordMat, tiles } = arena.boardMaterials;
      baseMat?.color?.set?.(boardTheme.frameDark);
      baseMat.roughness = boardTheme.frameRoughness;
      baseMat.metalness = boardTheme.frameMetalness;
      topMat?.color?.set?.(boardTheme.frameLight);
      topMat.roughness = boardTheme.surfaceRoughness;
      topMat.metalness = boardTheme.surfaceMetalness;
      coordMat?.color?.set?.(palette.accent);
      tiles?.forEach((tileMesh) => {
        const isDark = (tileMesh.userData?.r + tileMesh.userData?.c) % 2 === 1;
        tileMesh.material.color.set(isDark ? boardTheme.dark : boardTheme.light);
        tileMesh.material.roughness = boardTheme.surfaceRoughness;
        tileMesh.material.metalness = boardTheme.surfaceMetalness;
      });
    }

    if (arena.allPieceMeshes) {
      const nextPieceMaterials = createPieceMaterials(pieceStyleOption);
      arena.allPieceMeshes.forEach((group) => {
        const colorKey = group.userData?.__pieceColor === 'black' ? 'black' : 'white';
        const materialSet = nextPieceMaterials[colorKey];
        if (!materialSet) return;
        group.traverse((child) => {
          if (!child.isMesh) return;
          const role = child.userData?.__pieceMaterialRole === 'accent' ? 'accent' : 'base';
          const mat = role === 'accent' && materialSet.accent ? materialSet.accent : materialSet.base;
          if (mat) child.material = mat;
        });
      });
      disposePieceMaterials(arena.pieceMaterials);
      arena.pieceMaterials = nextPieceMaterials;
    }

    const accentColor = palette.accent ?? '#4ce0c3';
    const effectivePlayerFlag =
      playerFlag ||
      arena.playerFlag ||
      resolvedInitialFlag ||
      (FLAG_EMOJIS.length > 0 ? FLAG_EMOJIS[0] : FALLBACK_FLAG);
    const effectiveAiFlag =
      aiFlag ||
      arena.aiFlag ||
      getAIOpponentFlag(effectivePlayerFlag || FALLBACK_FLAG);
    arena.playerFlag = effectivePlayerFlag;
    arena.aiFlag = effectiveAiFlag;
    arena.sandTimer?.updateAccent?.(accentColor);
    updateSandTimerPlacement(uiRef.current?.turnWhite ?? ui.turnWhite);
    if (arenaRef.current) {
      arenaRef.current.playerFlag = effectivePlayerFlag;
      arenaRef.current.aiFlag = effectiveAiFlag;
      arenaRef.current.sandTimer = arena.sandTimer;
    }
  }, [appearance]);

  useEffect(() => {
    const host = wrapRef.current;
    if (!host) return;
    let scene = null;
    let camera = null;
    let renderer = null;
    let controls = null;
    let ray = null;
    let cancelled = false;
    const seatWorld = new THREE.Vector3();
    const seatNdc = new THREE.Vector3();
    const capturedByWhite = [];
    const capturedByBlack = [];

    const disposers = [];
    const baseVolume = settingsRef.current.soundEnabled ? getGameVolume() : 0;
    bombSoundRef.current = new Audio(bombSound);
    bombSoundRef.current.volume = baseVolume;
    timerSoundRef.current = new Audio(timerBeep);
    timerSoundRef.current.volume = baseVolume;

    const normalizedAppearance = normalizeAppearance(appearanceRef.current);
    const palette = createChessPalette(normalizedAppearance);
    paletteRef.current = palette;
    const boardTheme = palette.board;
    const pieceStyleOption = palette.pieces;
    const initialPlayerFlag =
      playerFlag ||
      resolvedInitialFlag ||
      (FLAG_EMOJIS.length > 0 ? FLAG_EMOJIS[0] : FALLBACK_FLAG);
    const initialAiFlagValue =
      aiFlag || initialAiFlag || getAIOpponentFlag(initialPlayerFlag || FALLBACK_FLAG);
    const woodOption = TABLE_WOOD_OPTIONS[normalizedAppearance.tableWood] ?? TABLE_WOOD_OPTIONS[0];
    const clothOption = TABLE_CLOTH_OPTIONS[normalizedAppearance.tableCloth] ?? TABLE_CLOTH_OPTIONS[0];
    const baseOption = TABLE_BASE_OPTIONS[normalizedAppearance.tableBase] ?? TABLE_BASE_OPTIONS[0];
    const chairOption = CHAIR_COLOR_OPTIONS[normalizedAppearance.chairColor] ?? CHAIR_COLOR_OPTIONS[0];
    const { option: shapeOption, rotationY } = getEffectiveShapeConfig(normalizedAppearance.tableShape);
    const pieceMaterials = createPieceMaterials(pieceStyleOption);
    disposers.push(() => {
      disposePieceMaterials(pieceMaterials);
    });

    // ----- Build scene -----
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    applyRendererSRGB(renderer);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    // Ensure the canvas covers the entire host element so the board is centered
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.zIndex = '0';
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.cursor = 'grab';
    host.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c1020);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x1a1f2b, 0.95);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.0);
    key.position.set(1.8, 2.6, 1.6);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.55);
    fill.position.set(-1.4, 2.2, -2.0);
    scene.add(fill);
    const rim = new THREE.PointLight(0xff7373, 0.4, 12, 2.0);
    rim.position.set(0, 2.1, 0);
    scene.add(rim);
    const spot = new THREE.SpotLight(0xffffff, 1.05, 0, Math.PI / 4, 0.35, 1.1);
    spot.position.set(0, 4.2, 4.6);
    scene.add(spot);
    const spotTarget = new THREE.Object3D();
    scene.add(spotTarget);
    spot.target = spotTarget;

    const arena = new THREE.Group();
    scene.add(arena);

    const arenaHalfWidth = CHESS_ARENA.width / 2;
    const arenaHalfDepth = CHESS_ARENA.depth / 2;
    const wallInset = 0.5;
    const halfRoomX = (arenaHalfWidth - wallInset) * WALL_PROXIMITY_FACTOR;
    const halfRoomZ = (arenaHalfDepth - wallInset) * WALL_PROXIMITY_FACTOR;
    const roomHalfWidth = halfRoomX + wallInset;
    const roomHalfDepth = halfRoomZ + wallInset;

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(roomHalfWidth * 2, roomHalfDepth * 2),
      new THREE.MeshStandardMaterial({
        color: 0x0f1222,
        roughness: 0.95,
        metalness: 0.05
      })
    );
    floor.rotation.x = -Math.PI / 2;
    arena.add(floor);

    const carpetMat = createArenaCarpetMaterial();
    const carpet = new THREE.Mesh(
      new THREE.PlaneGeometry(roomHalfWidth * 1.2, roomHalfDepth * 1.2),
      carpetMat
    );
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.y = 0.002;
    arena.add(carpet);

    const wallH = 3 * WALL_HEIGHT_MULTIPLIER;
    const wallT = 0.1;
    const wallMat = createArenaWallMaterial();
    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(halfRoomX * 2, wallH, wallT),
      wallMat
    );
    backWall.position.set(0, wallH / 2, halfRoomZ);
    arena.add(backWall);
    const frontWall = new THREE.Mesh(
      new THREE.BoxGeometry(halfRoomX * 2, wallH, wallT),
      wallMat
    );
    frontWall.position.set(0, wallH / 2, -halfRoomZ);
    arena.add(frontWall);
    const leftWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallT, wallH, halfRoomZ * 2),
      wallMat
    );
    leftWall.position.set(-halfRoomX, wallH / 2, 0);
    arena.add(leftWall);
    const rightWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallT, wallH, halfRoomZ * 2),
      wallMat
    );
    rightWall.position.set(halfRoomX, wallH / 2, 0);
    arena.add(rightWall);

    const ceilTrim = new THREE.Mesh(
      new THREE.BoxGeometry(halfRoomX * 2, 0.02, halfRoomZ * 2),
      new THREE.MeshStandardMaterial({
        color: 0x1a233f,
        roughness: 0.9,
        metalness: 0.02,
        side: THREE.DoubleSide
      })
    );
    ceilTrim.position.set(0, wallH - 0.02, 0);
    arena.add(ceilTrim);

    const ledMat = new THREE.MeshStandardMaterial({
      color: 0x00f7ff,
      emissive: 0x0099aa,
      emissiveIntensity: 0.4,
      roughness: 0.6,
      metalness: 0.2,
      side: THREE.DoubleSide
    });
    const stripBack = new THREE.Mesh(
      new THREE.BoxGeometry(halfRoomX * 2, 0.02, 0.01),
      ledMat
    );
    stripBack.position.set(0, 0.05, halfRoomZ - wallT / 2);
    arena.add(stripBack);
    const stripFront = stripBack.clone();
    stripFront.position.set(0, 0.05, -halfRoomZ + wallT / 2);
    arena.add(stripFront);
    const stripLeft = new THREE.Mesh(
      new THREE.BoxGeometry(0.01, 0.02, halfRoomZ * 2),
      ledMat
    );
    stripLeft.position.set(-halfRoomX + wallT / 2, 0.05, 0);
    arena.add(stripLeft);
    const stripRight = stripLeft.clone();
    stripRight.position.set(halfRoomX - wallT / 2, 0.05, 0);
    arena.add(stripRight);

    const tableInfo = createMurlanStyleTable({
      arena,
      renderer,
      tableRadius: TABLE_RADIUS,
      tableHeight: TABLE_HEIGHT,
      woodOption,
      clothOption,
      baseOption,
      shapeOption,
      rotationY
    });
    applyTableMaterials(tableInfo.materials, { woodOption, clothOption, baseOption }, renderer);
    if (tableInfo?.dispose) {
      disposers.push(() => {
        try {
          tableInfo.dispose();
        } catch (error) {
          console.warn('Failed to dispose chess table', error);
        }
      });
    }

    const chairMaterials = createChessChairMaterials(chairOption);
    disposers.push(() => {
      disposeChessChairMaterials(chairMaterials);
    });

    function makeChair(index) {
      const g = new THREE.Group();
      const seat = new THREE.Mesh(
        new THREE.BoxGeometry(SEAT_WIDTH, SEAT_THICKNESS, SEAT_DEPTH),
        chairMaterials.fabricMaterial
      );
      seat.position.y = SEAT_THICKNESS / 2;
      seat.castShadow = true;
      seat.receiveShadow = true;
      g.add(seat);

      const back = new THREE.Mesh(
        new THREE.BoxGeometry(SEAT_WIDTH, BACK_HEIGHT, BACK_THICKNESS),
        chairMaterials.fabricMaterial
      );
      back.position.set(0, SEAT_THICKNESS / 2 + BACK_HEIGHT / 2, -SEAT_DEPTH / 2 + BACK_THICKNESS / 2);
      back.castShadow = true;
      back.receiveShadow = true;
      g.add(back);

      const armLeft = createStraightArmrest('left', chairMaterials.fabricMaterial);
      g.add(armLeft.group);
      const armRight = createStraightArmrest('right', chairMaterials.fabricMaterial);
      g.add(armRight.group);

      const legBase = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16 * MODEL_SCALE * STOOL_SCALE, 0.2 * MODEL_SCALE * STOOL_SCALE, BASE_COLUMN_HEIGHT, 16),
        chairMaterials.legMaterial
      );
      legBase.position.y = -SEAT_THICKNESS / 2 - BASE_COLUMN_HEIGHT / 2;
      legBase.castShadow = true;
      legBase.receiveShadow = true;
      g.add(legBase);

      const avatarAnchor = new THREE.Object3D();
      avatarAnchor.position.set(0, AVATAR_ANCHOR_HEIGHT, 0);
      avatarAnchor.userData = { index };
      g.add(avatarAnchor);

      g.scale.setScalar(CHAIR_SCALE);
      return {
        group: g,
        seatMeshes: [seat, back, ...armLeft.meshes, ...armRight.meshes],
        legMeshes: [legBase],
        anchor: avatarAnchor
      };
    }

    const chairDistance =
      (tableInfo?.radius ?? TABLE_RADIUS) + SEAT_DEPTH / 2 + CHAIR_CLEARANCE;

    const chairs = [];
    const chairA = makeChair(0);
    chairA.group.position.set(0, CHAIR_BASE_HEIGHT, chairDistance + PLAYER_CHAIR_EXTRA_CLEARANCE);
    chairA.group.rotation.y = Math.PI;
    arena.add(chairA.group);
    chairs.push(chairA);
    const chairB = makeChair(1);
    chairB.group.position.set(0, CHAIR_BASE_HEIGHT, -chairDistance);
    arena.add(chairB.group);
    chairs.push(chairB);

    const sandTimer = createSandTimer(palette.accent ?? '#4ce0c3');
    const sandTimerRadius = (tableInfo?.radius ?? TABLE_RADIUS) * SAND_TIMER_RADIUS_FACTOR;
    const sandTimerSurfaceY = (tableInfo?.surfaceY ?? TABLE_HEIGHT) + SAND_TIMER_SURFACE_OFFSET;
    sandTimer.setFill?.(1);
    sandTimer.setTurn?.(uiRef.current?.turnWhite ?? true);
    sandTimer.group.position.set(0, sandTimerSurfaceY, sandTimerRadius);
    sandTimer.group.rotation.y = Math.PI;
    arena.add(sandTimer.group);
    disposers.push(() => {
      try {
        arena.remove(sandTimer.group);
      } catch {}
      sandTimer.dispose();
    });

    function makeStudioCamera() {
      const cam = new THREE.Group();
      const legLen = 1.2;
      const legRad = 0.025;
      const legG = new THREE.CylinderGeometry(legRad, legRad, legLen, 10);
      const legM = new THREE.MeshStandardMaterial({
        color: 0x333333,
        roughness: 0.5,
        metalness: 0.3
      });
      const l1 = new THREE.Mesh(legG, legM);
      l1.position.set(-0.28, legLen / 2, 0);
      l1.rotation.z = THREE.MathUtils.degToRad(18);
      const l2 = l1.clone();
      l2.position.set(0.18, legLen / 2, 0.24);
      const l3 = l1.clone();
      l3.position.set(0.18, legLen / 2, -0.24);
      cam.add(l1, l2, l3);
      const head = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.1, 0.08, 16),
        new THREE.MeshStandardMaterial({
          color: 0x2e2e2e,
          roughness: 0.6,
          metalness: 0.2
        })
      );
      head.position.set(0, legLen + 0.04, 0);
      cam.add(head);
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.22, 0.22),
        new THREE.MeshStandardMaterial({
          color: 0x151515,
          roughness: 0.5,
          metalness: 0.4
        })
      );
      body.position.set(0, legLen + 0.2, 0);
      cam.add(body);
      const lens = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 0.22, 16),
        new THREE.MeshStandardMaterial({
          color: 0x202020,
          roughness: 0.4,
          metalness: 0.5
        })
      );
      lens.rotation.z = Math.PI / 2;
      lens.position.set(0.22, legLen + 0.2, 0);
      cam.add(lens);
      const handle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.01, 0.01, 0.3, 10),
        new THREE.MeshStandardMaterial({
          color: 0x444444,
          roughness: 0.6
        })
      );
      handle.rotation.z = THREE.MathUtils.degToRad(30);
      handle.position.set(-0.16, legLen + 0.16, -0.1);
      cam.add(handle);
      return cam;
    }

    const cameraRigOffsetX = (tableInfo?.radius ?? TABLE_RADIUS) + 1.4;
    const cameraRigOffsetZ = (tableInfo?.radius ?? TABLE_RADIUS) + 1.2;
    const studioCamA = makeStudioCamera();
    studioCamA.position.set(-cameraRigOffsetX, 0, -cameraRigOffsetZ);
    arena.add(studioCamA);
    const studioCamB = makeStudioCamera();
    studioCamB.position.set(cameraRigOffsetX, 0, cameraRigOffsetZ);
    arena.add(studioCamB);

    const tableSurfaceY = tableInfo?.surfaceY ?? TABLE_HEIGHT;
    const boardGroup = new THREE.Group();
    boardGroup.position.set(0, tableSurfaceY + 0.004, 0);
    boardGroup.scale.setScalar(BOARD_SCALE);
    tableInfo.group.add(boardGroup);
    const boardLookTarget = new THREE.Vector3(
      0,
      boardGroup.position.y + (BOARD.baseH + 0.12) * BOARD_SCALE,
      0
    );
    spotTarget.position.copy(boardLookTarget);
    spot.target.updateMatrixWorld();
    studioCamA.lookAt(boardLookTarget);
    studioCamB.lookAt(boardLookTarget);

    // Camera orbit via OrbitControls
    camera = new THREE.PerspectiveCamera(CAM.fov, 1, CAM.near, CAM.far);
    const isPortrait = host.clientHeight > host.clientWidth;
    const cameraSeatAngle = Math.PI / 2;
    const cameraBackOffset = isPortrait ? 1.65 : 1.05;
    const cameraForwardOffset = isPortrait ? 0.18 : 0.35;
    const cameraHeightOffset = isPortrait ? 1.46 : 1.12;
    const cameraRadius = chairDistance + cameraBackOffset - cameraForwardOffset;
    camera.position.set(
      Math.cos(cameraSeatAngle) * cameraRadius,
      tableSurfaceY + cameraHeightOffset,
      Math.sin(cameraSeatAngle) * cameraRadius
    );
    camera.lookAt(boardLookTarget);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.minDistance = CAM.minR;
    controls.maxDistance = CAM.maxR;
    controls.minPolarAngle = CAM.phiMin;
    controls.maxPolarAngle = CAM.phiMax;
    controls.target.copy(boardLookTarget);
    controls.update();
    controlsRef.current = controls;

    const fit = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const tableSpan = (tableInfo?.radius ?? TABLE_RADIUS) * CAMERA_TABLE_SPAN_FACTOR;
      const boardSpan = RAW_BOARD_SIZE * BOARD_SCALE * 1.6;
      const span = Math.max(tableSpan, boardSpan);
      const needed = span / (2 * Math.tan(THREE.MathUtils.degToRad(CAM.fov) / 2));
      const currentRadius = camera.position.distanceTo(boardLookTarget);
      const radius = clamp(Math.max(needed, currentRadius), CAM.minR, CAM.maxR);
      const dir = camera.position.clone().sub(boardLookTarget).normalize();
      camera.position.copy(boardLookTarget).addScaledVector(dir, radius);
      controls.update();
    };
    fitRef.current = fit;
    fit();

    const dollyScale = 1 + CAMERA_WHEEL_FACTOR;
    zoomRef.current = {
      zoomIn: () => {
        if (!controls) return;
        controls.dollyIn(dollyScale);
        controls.update();
      },
      zoomOut: () => {
        if (!controls) return;
        controls.dollyOut(dollyScale);
        controls.update();
      }
    };

    const createExplosion = (pos) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const v = pos.clone().project(camera);
      const x = rect.left + ((v.x + 1) / 2) * rect.width;
      const y = rect.top + ((-v.y + 1) / 2) * rect.height;
      const el = document.createElement('div');
      el.textContent = '💨';
      el.className = 'bomb-explosion';
      el.style.position = 'fixed';
      el.style.transform = 'translate(-50%, -50%) scale(1)';
      el.style.fontSize = '64px';
      el.style.pointerEvents = 'none';
      el.style.zIndex = '200';
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1000);
    };

    // Board base + rim
    const tile = BOARD.tile;
    const N = 8;
    const half = (N * tile) / 2;
    const base = box(
      N * tile + BOARD.rim * 2,
      BOARD.baseH,
      N * tile + BOARD.rim * 2,
      boardTheme.frameDark,
      { roughness: boardTheme.frameRoughness, metalness: boardTheme.frameMetalness }
    );
    base.position.set(0, BOARD.baseH / 2, 0);
    boardGroup.add(base);
    const top = box(
      N * tile,
      0.12,
      N * tile,
      boardTheme.frameLight,
      { roughness: boardTheme.surfaceRoughness, metalness: boardTheme.surfaceMetalness }
    );
    top.position.set(0, BOARD.baseH + 0.06, 0);
    boardGroup.add(top);

    // Tiles
    const tiles = [];
    const tileGroup = new THREE.Group();
    boardGroup.add(tileGroup);
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const isDark = (r + c) % 2 === 1;
        const m = new THREE.MeshStandardMaterial({
          color: isDark ? boardTheme.dark : boardTheme.light,
          metalness: boardTheme.surfaceMetalness,
          roughness: boardTheme.surfaceRoughness
        });
        const g = new THREE.BoxGeometry(tile, 0.1, tile);
        const mesh = new THREE.Mesh(g, m);
        mesh.position.set(
          c * tile - half + tile / 2,
          BOARD.baseH + 0.12,
          r * tile - half + tile / 2
        );
        mesh.userData = { r, c, type: 'tile' };
        tileGroup.add(mesh);
        tiles.push(mesh);
      }
    }

    // Coordinates (optional minimal markers)
    const coordMat = new THREE.MeshBasicMaterial({ color: palette.accent });
    for (let i = 0; i < N; i++) {
      const mSmall = new THREE.Mesh(
        new THREE.PlaneGeometry(0.08, 0.8),
        coordMat
      );
      mSmall.rotation.x = -Math.PI / 2;
      mSmall.position.set(
        i * tile - half + tile / 2,
        BOARD.baseH + 0.13,
        -half - 0.6
      );
      boardGroup.add(mSmall);
      const nSmall = new THREE.Mesh(
        new THREE.PlaneGeometry(0.8, 0.08),
        coordMat
      );
      nSmall.rotation.x = -Math.PI / 2;
      nSmall.position.set(
        -half - 0.6,
        BOARD.baseH + 0.13,
        i * tile - half + tile / 2
      );
      boardGroup.add(nSmall);
    }

    arena.boardMaterials = {
      base: base.material,
      top: top.material,
      coord: coordMat,
      tiles,
      tileMaterials: tiles.map((tileMesh) => tileMesh.material)
    };

    // Pieces — meshes + state
    let board = parseFEN(START_FEN);
    const pieceMeshes = Array.from({ length: 8 }, () => Array(8).fill(null));
    const allPieceMeshes = [];

    function placePieceMesh(r, c, p) {
      const materialSet = p.w ? pieceMaterials.white : pieceMaterials.black;
      const b = BUILDERS[p.t](materialSet);
      b.position.set(c * tile - half + tile / 2, 0, r * tile - half + tile / 2);
      const styleId = pieceStyleOption?.id ?? 'default';
      b.userData = {
        r,
        c,
        w: p.w,
        t: p.t,
        type: 'piece',
        __pieceColor: p.w ? 'white' : 'black',
        __pieceStyleId: styleId
      };
      b.traverse((child) => {
        if (child.isMesh) {
          child.userData = {
            ...(child.userData || {}),
            __pieceColor: p.w ? 'white' : 'black',
            __pieceStyleId: styleId
          };
        }
      });
      boardGroup.add(b);
      pieceMeshes[r][c] = b;
      allPieceMeshes.push(b);
    }

    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p) placePieceMesh(r, c, p);
      }

    const pieceReferenceHeights = {};
    const sizeVec = new THREE.Vector3();
    const boxHelper = new THREE.Box3();
    allPieceMeshes.forEach((mesh) => {
      const type = mesh?.userData?.t;
      if (!type || pieceReferenceHeights[type]) return;
      const size = boxHelper.setFromObject(mesh).getSize(sizeVec);
      pieceReferenceHeights[type] = size.y / BOARD_SCALE;
    });

    loadChessTemplates(pieceReferenceHeights, boardTheme)
      .then((templates) => {
        if (cancelled || !templates) return;
        if (templates.board) {
          const boardModel = cloneWithFreshMaterials(templates.board);
          const boardBox = new THREE.Box3().setFromObject(boardModel);
          const targetTop = BOARD.baseH + 0.12;
          boardModel.position.y = targetTop - boardBox.max.y;
          boardGroup.add(boardModel);
          base.visible = false;
          top.visible = false;
          tiles.forEach((tileMesh) => {
            tileMesh.material.transparent = true;
            tileMesh.material.opacity = 0.0001;
            tileMesh.material.depthWrite = false;
          });
        }

        const templatesByColor = templates.pieces || {};
        const updatedMeshes = [];
        for (let r = 0; r < 8; r += 1) {
          for (let c = 0; c < 8; c += 1) {
            const piece = board[r][c];
            const currentMesh = pieceMeshes[r][c];
            if (!piece || !currentMesh) continue;
            const template = templatesByColor[piece.w ? 'white' : 'black']?.[piece.t];
            if (!template) continue;
            const replacement = cloneWithFreshMaterials(template);
            applyPieceMaterialSet(replacement, piece.w ? pieceMaterials.white : pieceMaterials.black);
            replacement.userData = { ...(currentMesh.userData || {}), type: 'piece' };
            replacement.position.copy(currentMesh.position);
            replacement.rotation.copy(currentMesh.rotation);
            boardGroup.add(replacement);
            boardGroup.remove(currentMesh);
            pieceMeshes[r][c] = replacement;
            updatedMeshes.push(replacement);
          }
        }
        if (updatedMeshes.length) {
          allPieceMeshes.splice(0, allPieceMeshes.length, ...updatedMeshes);
        }
      })
      .catch((error) => console.warn('Falling back to procedural chess set', error));

      arenaRef.current = {
        renderer,
        scene,
        camera,
        controls,
        arenaGroup: arena,
        tableInfo,
        tableShapeId: tableInfo.shapeId,
        boardGroup,
        boardLookTarget,
        chairMaterials,
        chairs,
        seatAnchors: chairs.map((chair) => chair.anchor),
        sandTimer,
        spotLight: spot,
        spotTarget,
        studioCameras: [studioCamA, studioCamB],
        boardMaterials: arena.boardMaterials,
        pieceMaterials,
        allPieceMeshes,
        capturedByWhite,
        capturedByBlack,
        palette,
        playerFlag: initialPlayerFlag,
        aiFlag: initialAiFlagValue
      };
      arenaRef.current.sandTimer = sandTimer;
      arenaRef.current.palette = palette;

      arena.sandTimer = sandTimer;
      arena.palette = palette;
      arena.playerFlag = initialPlayerFlag;
      arena.aiFlag = initialAiFlagValue;

    // Raycaster for picking
    ray = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const setPointer = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const cx =
        e.clientX ??
        e.touches?.[0]?.clientX ??
        e.changedTouches?.[0]?.clientX ??
        0;
      const cy =
        e.clientY ??
        e.touches?.[0]?.clientY ??
        e.changedTouches?.[0]?.clientY ??
        0;
      pointer.x = ((cx - rect.left) / rect.width) * 2 - 1;
      pointer.y = -(((cy - rect.top) / rect.height) * 2 - 1);
    };

    // Selection
    let sel = null;
    let legal = [];

    function startTimer(isWhite) {
      clearInterval(timerRef.current);
      try {
        timerSoundRef.current?.pause();
      } catch {}
      if (isWhite) {
        initialWhiteTimeRef.current = 60;
        whiteTimeRef.current = 60;
        setWhiteTime(60);
        lastBeepRef.current.white = null;
        timerRef.current = setInterval(() => {
          setWhiteTime((t) => {
            const next = Math.max(0, t - 1);
            if (t <= 1) {
              clearInterval(timerRef.current);
              setUi((s) => ({ ...s, status: 'White ran out of time', winner: 'Black' }));
              return 0;
            }
            maybePlayCountdownSound(next, true);
            return next;
          });
        }, 1000);
      } else {
        initialBlackTimeRef.current = 5;
        blackTimeRef.current = 5;
        setBlackTime(5);
        lastBeepRef.current.black = null;
        timerRef.current = setInterval(() => {
          setBlackTime((t) => {
            const next = Math.max(0, t - 1);
            if (t <= 1) {
              clearInterval(timerRef.current);
              setUi((s) => ({ ...s, status: 'Black ran out of time', winner: 'White' }));
              return 0;
            }
            maybePlayCountdownSound(next, false);
            return next;
          });
        }, 1000);
      }
    }

    function applyStatus(nextWhite, status, winner) {
      setUi((s) => ({ ...s, turnWhite: nextWhite, status, winner }));
      if (winner) {
        clearInterval(timerRef.current);
        return;
      }
      startTimer(nextWhite);
      if (!nextWhite) setTimeout(aiMove, 200);
    }

    const maybePlayCountdownSound = (seconds, isWhiteTurn) => {
      const activeTurn = uiRef.current?.turnWhite;
      if (activeTurn !== isWhiteTurn) {
        return;
      }
      const key = isWhiteTurn ? 'white' : 'black';
      const last = lastBeepRef.current[key];
      if (
        timerSoundRef.current &&
        settingsRef.current.soundEnabled &&
        seconds > 0 &&
        seconds <= 15 &&
        seconds !== last
      ) {
        lastBeepRef.current[key] = seconds;
        try {
          timerSoundRef.current.currentTime = 0;
          timerSoundRef.current.play().catch(() => {});
        } catch {}
      }
      if (seconds > 15 && last != null) {
        lastBeepRef.current[key] = null;
        try {
          timerSoundRef.current.pause();
        } catch {}
      }
      if (seconds <= 0 && timerSoundRef.current) {
        try {
          timerSoundRef.current.pause();
        } catch {}
      }
    };

    function highlightMoves(list, color) {
      if (!settingsRef.current.showHighlights) return;
      const palette = paletteRef.current;
      const highlightColor = color ?? palette?.highlight ?? '#6ee7b7';
      list.forEach(([rr, cc]) => {
        const mesh = tiles.find(
          (t) => t.userData.r === rr && t.userData.c === cc
        );
        if (!mesh) return;
        const h = new THREE.Mesh(
          new THREE.CylinderGeometry(tile * 0.28, tile * 0.28, 0.06, 20),
          new THREE.MeshStandardMaterial({
            color: highlightColor,
            transparent: true,
            opacity: 0.55,
            metalness: 0.2
          })
        );
        h.position.copy(mesh.position).add(new THREE.Vector3(0, 0.06, 0));
        h.userData.__highlight = true;
        boardGroup.add(h);
      });
    }
    function clearHighlights() {
      const toKill = [];
      boardGroup.traverse((o) => {
        if (o.userData && o.userData.__highlight) toKill.push(o);
      });
      toKill.forEach((o) => boardGroup.remove(o));
    }
    clearHighlightsRef.current = clearHighlights;

    function selectAt(r, c) {
      const p = board[r][c];
      if (!p) return ((sel = null), clearHighlights());
      if (p.w !== uiRef.current.turnWhite) return; // not your turn
      sel = { r, c, p };
      legal = legalMoves(board, r, c);
      clearHighlights();
      const palette = paletteRef.current;
      const captureSquares = [];
      const quietSquares = [];
      legal.forEach(([rr, cc]) => {
        const target = board[rr][cc];
        if (target && target.w !== p.w) captureSquares.push([rr, cc]);
        else quietSquares.push([rr, cc]);
      });
      highlightMoves(quietSquares, palette?.highlight);
      if (captureSquares.length) highlightMoves(captureSquares, palette?.capture);
    }

    function moveSelTo(rr, cc) {
      if (!sel) return;
      if (!legal.some(([r, c]) => r === rr && c === cc)) return;
      // capture mesh if any
      const targetMesh = pieceMeshes[rr][cc];
      if (targetMesh) {
        const worldPos = new THREE.Vector3();
        targetMesh.getWorldPosition(worldPos);
        const capturingWhite = board[sel.r][sel.c].w;
        const zone = capturingWhite ? capturedByWhite : capturedByBlack;
        const idx = zone.push(targetMesh) - 1;
        const row = Math.floor(idx / 8);
        const col = idx % 8;
        const capX = (col - 3.5) * (tile * 0.5);
        const capZ = capturingWhite
          ? half + BOARD.rim + 1 + row * (tile * 0.5)
          : -half - BOARD.rim - 1 - row * (tile * 0.5);
        targetMesh.position.set(capX, 0, capZ);
        targetMesh.scale.set(0.8, 0.8, 0.8);
        createExplosion(worldPos);
        if (bombSoundRef.current && settingsRef.current.soundEnabled) {
          bombSoundRef.current.currentTime = 0;
          bombSoundRef.current.play().catch(() => {});
        }
        pieceMeshes[rr][cc] = null;
      }
      // move board
      board[rr][cc] = board[sel.r][sel.c];
      board[sel.r][sel.c] = null;
      // promotion (auto to Queen)
      if (board[rr][cc].t === 'P' && (rr === 0 || rr === 7)) {
        board[rr][cc].t = 'Q';
      }
      // move mesh
      const m = pieceMeshes[sel.r][sel.c];
      pieceMeshes[sel.r][sel.c] = null;
      pieceMeshes[rr][cc] = m;
      m.userData.r = rr;
      m.userData.c = cc;
      m.position.set(
        cc * tile - half + tile / 2,
        0,
        rr * tile - half + tile / 2
      );

      // turn switch & status
      const nextWhite = !uiRef.current.turnWhite;
      const king = findKing(board, nextWhite);
      const inCheck =
        king && isSquareAttacked(board, king[0], king[1], !nextWhite);
      const hasMove = anyLegal(board, nextWhite);
      let status = nextWhite ? 'White to move' : 'Black to move';
      let winner = null;
      if (!hasMove) {
        if (inCheck) {
          winner = nextWhite ? 'Black' : 'White';
          status = `Checkmate — ${winner} wins`;
        } else {
          status = 'Stalemate';
        }
      } else if (inCheck) {
        status = (nextWhite ? 'White' : 'Black') + ' in check';
      }

      applyStatus(nextWhite, status, winner);
      sel = null;
      clearHighlights();
    }

    function aiMove() {
      const mv = bestBlackMove(board, 4);
      if (!mv) return;
      sel = { r: mv.fromR, c: mv.fromC };
      legal = legalMoves(board, mv.fromR, mv.fromC);
      moveSelTo(mv.toR, mv.toC);
    }

    function onClick(e) {
      setPointer(e);
      ray.setFromCamera(pointer, camera);
      const intersects = ray.intersectObjects(boardGroup.children, true);
      let obj = null;
      for (const i of intersects) {
        let o = i.object;
        while (o) {
          if (
            o.userData &&
            (o.userData.type === 'piece' || o.userData.type === 'tile')
          ) {
            obj = o;
            break;
          }
          o = o.parent;
        }
        if (obj) break;
      }
      if (!obj) return;
      const ud = obj.userData;
      const targetPiece = board[ud.r]?.[ud.c] || null;
      if (
        sel &&
        ud.type === 'piece' &&
        targetPiece &&
        targetPiece.w !== board[sel.r][sel.c]?.w
      ) {
        moveSelTo(ud.r, ud.c);
        return;
      }
      if (ud.type === 'piece') selectAt(ud.r, ud.c);
      else if (ud.type === 'tile' && sel) {
        moveSelTo(ud.r, ud.c);
      }
    }

    renderer.domElement.addEventListener('click', onClick);
    renderer.domElement.addEventListener('touchend', onClick);

    // Loop
    let lastTime = performance.now();
    const step = () => {
      const now = performance.now();
      const dt = Math.min(0.1, Math.max(0, (now - lastTime) / 1000));
      lastTime = now;
      const arenaState = arenaRef.current;
      if (arenaState?.seatAnchors?.length && camera) {
        const positions = arenaState.seatAnchors.map((anchor, index) => {
          anchor.getWorldPosition(seatWorld);
          seatNdc.copy(seatWorld).project(camera);
          const x = clamp((seatNdc.x * 0.5 + 0.5) * 100, -25, 125);
          const y = clamp((0.5 - seatNdc.y * 0.5) * 100, -25, 125);
          const depth = camera.position.distanceTo(seatWorld);
          return { index, x, y, depth };
        });
        let changed = positions.length !== seatPositionsRef.current.length;
        if (!changed) {
          for (let i = 0; i < positions.length; i += 1) {
            const prev = seatPositionsRef.current[i];
            const curr = positions[i];
            if (
              !prev ||
              Math.abs(prev.x - curr.x) > 0.2 ||
              Math.abs(prev.y - curr.y) > 0.2 ||
              Math.abs((prev.depth ?? 0) - curr.depth) > 0.02
            ) {
              changed = true;
              break;
            }
          }
        }
        if (changed) {
          seatPositionsRef.current = positions;
          setSeatAnchors(positions);
        }
      } else if (seatPositionsRef.current.length) {
        seatPositionsRef.current = [];
        setSeatAnchors([]);
      }

      if (arenaState?.sandTimer) {
        const activeTotal = uiRef.current.turnWhite
          ? initialWhiteTimeRef.current || 1
          : initialBlackTimeRef.current || 1;
        const activeLeft = uiRef.current.turnWhite ? whiteTimeRef.current : blackTimeRef.current;
        const pct = clamp01(activeLeft / Math.max(1, activeTotal));
        arenaState.sandTimer.setFill?.(pct);
        arenaState.sandTimer.setTime?.(activeLeft);
        arenaState.sandTimer.tick?.(dt, now * 0.001);
      }

      controls?.update();
      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(step);
    };
    step();

    // Resize
    const onResize = () => {
      fit();
    };
    window.addEventListener('resize', onResize);

    // Start timer for the human player
    startTimer(true);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
      clearInterval(timerRef.current);
      disposers.forEach((fn) => {
        try {
          fn();
        } catch (error) {
          console.warn('Failed during chess cleanup', error);
        }
      });
      try {
        host.removeChild(renderer.domElement);
      } catch {}
      renderer.domElement.removeEventListener('click', onClick);
      renderer.domElement.removeEventListener('touchend', onClick);
      controlsRef.current = null;
      controls?.dispose();
      controls = null;
      const arenaState = arenaRef.current;
      if (arenaState) {
        disposeChessChairMaterials(arenaState.chairMaterials);
        arenaState.tableInfo?.dispose?.();
      }
      arenaRef.current = null;
      seatPositionsRef.current = [];
      setSeatAnchors([]);
      bombSoundRef.current?.pause();
      timerSoundRef.current?.pause();
    };
  }, []);

  return (
    <div ref={wrapRef} className="fixed inset-0 bg-[#0c1020] text-white touch-none select-none">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-4 left-4 z-20 flex flex-col items-start gap-3 pointer-events-none">
          <div className="pointer-events-none rounded bg-white/10 px-3 py-2 text-xs">
            <div className="font-semibold">{ui.status}</div>
          </div>
          <button
            type="button"
            onClick={() => setConfigOpen((prev) => !prev)}
            aria-expanded={configOpen}
            className={`pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white shadow-lg backdrop-blur transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
              configOpen ? 'bg-black/60' : 'hover:bg-black/60'
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-6 w-6"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m19.4 13.5-.44 1.74a1 1 0 0 1-1.07.75l-1.33-.14a7.03 7.03 0 0 1-1.01.59l-.2 1.32a1 1 0 0 1-.98.84h-1.9a1 1 0 0 1-.98-.84l-.2-1.32a7.03 7.03 0 0 1-1.01-.59l-1.33.14a1 1 0 0 1-1.07-.75L4.6 13.5a1 1 0 0 1 .24-.96l1-.98a6.97 6.97 0 0 1 0-1.12l-1-.98a1 1 0 0 1-.24-.96l.44-1.74a1 1 0 0 1 1.07-.75l1.33.14c.32-.23.66-.43 1.01-.6l.2-1.31a1 1 0 0 1 .98-.84h1.9a1 1 0 0 1 .98.84l.2 1.31c.35.17.69.37 1.01.6l1.33-.14a1 1 0 0 1 1.07.75l.44 1.74a1 1 0 0 1-.24.96l-1 .98c.03.37.03.75 0 1.12l1 .98a1 1 0 0 1 .24.96z"
              />
            </svg>
            <span className="sr-only">Open table customization</span>
          </button>
          {configOpen && (
            <div className="pointer-events-auto mt-2 w-72 max-w-[80vw] rounded-2xl border border-white/15 bg-black/80 p-4 text-xs text-white shadow-2xl backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] uppercase tracking-[0.4em] text-sky-200/80">Table Setup</span>
                <button
                  type="button"
                  onClick={() => setConfigOpen(false)}
                  className="rounded-full p-1 text-white/70 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                  aria-label="Close customization"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m6 6 12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>
              <div className="mt-4 max-h-72 space-y-4 overflow-y-auto pr-1">
                {CUSTOMIZATION_SECTIONS.map(({ key, label, options }) => (
                  <div key={key} className="space-y-2">
                    <p className="text-[10px] uppercase tracking-[0.35em] text-white/60">{label}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {options.map((option, idx) => {
                        const selected = appearance[key] === idx;
                        return (
                          <button
                            key={option.id ?? idx}
                            type="button"
                            onClick={() => setAppearance((prev) => ({ ...prev, [key]: idx }))}
                            aria-pressed={selected}
                            className={`flex flex-col items-center rounded-2xl border p-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                              selected
                                ? 'border-sky-400/80 bg-sky-400/10 shadow-[0_0_12px_rgba(56,189,248,0.35)]'
                                : 'border-white/10 bg-white/5 hover:border-white/20'
                            }`}
                          >
                            {renderPreview(key, option)}
                            <span className="mt-2 text-center text-[0.65rem] font-semibold text-gray-200">
                              {option.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-3">
                <label className="flex items-center justify-between text-[0.7rem] text-gray-200">
                  <span>Sound effects</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border border-emerald-400/40 bg-transparent text-emerald-400 focus:ring-emerald-500"
                    checked={soundEnabled}
                    onChange={(event) => setSoundEnabled(event.target.checked)}
                  />
                </label>
                <label className="flex items-center justify-between text-[0.7rem] text-gray-200">
                  <span>Show legal moves</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border border-emerald-400/40 bg-transparent text-emerald-400 focus:ring-emerald-500"
                    checked={showHighlights}
                    onChange={(event) => setShowHighlights(event.target.checked)}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    fitRef.current?.();
                    setConfigOpen(false);
                  }}
                  className="w-full rounded-lg bg-white/10 py-2 text-center text-[0.7rem] font-semibold text-white transition hover:bg-white/20"
                >
                  Center camera
                </button>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="w-full rounded-lg bg-emerald-500/20 py-2 text-center text-[0.7rem] font-semibold text-emerald-200 transition hover:bg-emerald-500/30"
                >
                  Restart match
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="absolute inset-0 z-10 pointer-events-none">
          {players.map((player) => {
            const anchor = seatAnchorMap.get(player.index);
            const fallback =
              FALLBACK_SEAT_POSITIONS[player.index] ||
              FALLBACK_SEAT_POSITIONS[FALLBACK_SEAT_POSITIONS.length - 1];
            const positionStyle = anchor
              ? {
                  position: 'absolute',
                  left: `${anchor.x}%`,
                  top: `${anchor.y}%`,
                  transform: 'translate(-50%, -50%)'
                }
              : {
                  position: 'absolute',
                  left: fallback.left,
                  top: fallback.top,
                  transform: 'translate(-50%, -50%)'
                };
            const depth = anchor?.depth ?? 3;
            const avatarSize = anchor ? clamp(1.32 - (depth - 2.6) * 0.22, 0.86, 1.2) : 1;
            return (
              <div
                key={`chess-seat-${player.index}`}
                className="absolute pointer-events-auto flex flex-col items-center"
                style={positionStyle}
              >
                <AvatarTimer
                  index={player.index}
                  photoUrl={player.photoUrl}
                  active={player.isTurn}
                  isTurn={player.isTurn}
                  timerPct={1}
                  name={player.name}
                  color={player.color}
                  size={avatarSize}
                />
                <span className="mt-1 text-[0.65rem] font-semibold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">
                  {player.name}
                </span>
              </div>
            );
          })}
        </div>
        <div className="absolute top-3 right-3 flex items-center space-x-3 pointer-events-auto">
          <div className="flex items-center space-x-2 rounded-full bg-white/10 px-3 py-1 text-xs">
            {avatar && <img src={avatar} alt="avatar" className="h-7 w-7 rounded-full object-cover" />}
            <span>{username || 'Guest'}</span>
          </div>
        </div>
        <div className="absolute top-2 left-0 right-0 flex justify-center z-10 pointer-events-none">
          <div className={`px-3 py-1 text-sm rounded ${ui.turnWhite ? 'opacity-60' : 'bg-white/20'}`}>
            Black {formatTime(blackTime)}
          </div>
        </div>
        <div className="absolute bottom-2 left-0 right-0 flex justify-center z-10 pointer-events-none">
          <div className={`px-3 py-1 text-sm rounded ${ui.turnWhite ? 'bg-white/20' : 'opacity-60'}`}>
            White {formatTime(whiteTime)}
          </div>
        </div>
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="px-5 py-2 rounded-full bg-[rgba(7,10,18,0.65)] border border-[rgba(255,215,0,0.25)] text-sm font-semibold backdrop-blur">
            {ui.winner ? `${ui.winner} Wins` : ui.status}
          </div>
        </div>
        <div className="absolute right-3 bottom-3 flex flex-col space-y-2 pointer-events-auto">
          <button
            onClick={() => zoomRef.current.zoomIn?.()}
            className="text-xl bg-white/10 hover:bg-white/20 rounded px-2 py-1"
          >
            +
          </button>
          <button
            onClick={() => zoomRef.current.zoomOut?.()}
            className="text-xl bg-white/10 hover:bg-white/20 rounded px-2 py-1"
          >
            -
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ChessBattleRoyal() {
  useTelegramBackButton();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const avatar = params.get('avatar') || getTelegramPhotoUrl();
  let username =
    params.get('username') ||
    params.get('name') ||
    getTelegramFirstName() ||
    getTelegramUsername();
  const flagParam = params.get('flag') || params.get('playerFlag');
  const initialFlag =
    flagParam && FLAG_EMOJIS.includes(flagParam) ? flagParam : '';
  const aiFlagParam = params.get('aiFlag') || (params.get('aiFlags') || '').split(',')[0];
  const initialAiFlag =
    aiFlagParam && FLAG_EMOJIS.includes(aiFlagParam) ? aiFlagParam : '';
  return (
    <Chess3D
      avatar={avatar}
      username={username}
      initialFlag={initialFlag}
      initialAiFlag={initialAiFlag}
    />
  );
}
