import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import {
  createArenaCarpetMaterial,
  createArenaWallMaterial
} from '../../utils/arenaDecor.js';
import { applyRendererSRGB, applySRGBColorSpace } from '../../utils/colorSpace.js';
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
  light: '#e7e2d3',
  dark: '#776a5a',
  frameLight: '#d2b48c',
  frameDark: '#3a2d23',
  accent: '#00e5ff',
  highlight: '#6ee7b7',
  capture: '#f87171',
  surfaceRoughness: 0.74,
  surfaceMetalness: 0.18,
  frameRoughness: 0.82,
  frameMetalness: 0.12
});

const BOARD_COLOR_BASE_OPTIONS = Object.freeze([
  {
    id: 'royaleNight',
    label: 'Royale Nightfall',
    light: '#f0d9b5',
    dark: '#8b5a2b',
    frameLight: '#1b243b',
    frameDark: '#0b1220',
    accent: '#22c55e',
    highlight: '#22c55e',
    capture: '#f97316',
    surfaceRoughness: 0.58,
    surfaceMetalness: 0.22,
    frameRoughness: 0.76,
    frameMetalness: 0.24
  },
  {
    id: 'classicWalnut',
    label: 'Dru Klasik',
    light: '#f3dfc1',
    dark: '#9a6636',
    frameLight: '#bb8451',
    frameDark: '#4c2e18',
    accent: '#d8b280',
    highlight: '#4ce0c3',
    capture: '#ff6f78',
    surfaceRoughness: 0.72,
    surfaceMetalness: 0.16,
    frameRoughness: 0.84,
    frameMetalness: 0.18
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
  },
  {
    id: 'stoneMarbleJade',
    label: 'Stone & Jade',
    light: '#e4e3dd',
    dark: '#60605b',
    frameLight: '#9ea09b',
    frameDark: '#4a4d51',
    accent: '#7ed3a0',
    highlight: '#7ed3a0',
    capture: '#dc5c5c',
    surfaceRoughness: 0.52,
    surfaceMetalness: 0.16,
    frameRoughness: 0.64,
    frameMetalness: 0.2
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
const CHAIR_SCALE = 1.2;
const CHAIR_CLEARANCE = AI_CHAIR_GAP;
const PLAYER_CHAIR_EXTRA_CLEARANCE = 0;
const CAMERA_PHI_OFFSET = 0;
const CAMERA_TOPDOWN_EXTRA = 0;
const CAMERA_INITIAL_PHI_EXTRA = 0;
const CAMERA_TOPDOWN_LOCK = THREE.MathUtils.degToRad(4);
const SEAT_LABEL_HEIGHT = 0.74;
const SEAT_LABEL_FORWARD_OFFSET = -0.32;
const AVATAR_ANCHOR_HEIGHT = SEAT_THICKNESS / 2 + BACK_HEIGHT * 0.85;
const FALLBACK_SEAT_POSITIONS = [
  { left: '50%', top: '84%' },
  { left: '50%', top: '16%' }
];
const CAMERA_WHEEL_FACTOR = ARENA_CAMERA_DEFAULTS.wheelDeltaFactor;
const CAMERA_PULL_FORWARD_MIN = THREE.MathUtils.degToRad(15);
const SAND_TIMER_RADIUS_FACTOR = 0.68;
const SAND_TIMER_SURFACE_OFFSET = 0.2;
const SAND_TIMER_SCALE = 0.36;

const BEAUTIFUL_GAME_URLS = [
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/ABeautifulGame/glTF-Binary/ABeautifulGame.glb',
  'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/ABeautifulGame/glTF-Binary/ABeautifulGame.glb',
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/ABeautifulGame/glTF-Binary/ABeautifulGame.glb',
  'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/ABeautifulGame/glTF-Binary/ABeautifulGame.glb',
  'https://fastly.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/ABeautifulGame/glTF-Binary/ABeautifulGame.glb'
];

const STAUNTON_SET_URLS = [
  'https://raw.githubusercontent.com/cx20/gltf-test/master/sampleModels/Chess/glTF-Binary/Chess.glb',
  'https://cdn.jsdelivr.net/gh/cx20/gltf-test@master/sampleModels/Chess/glTF-Binary/Chess.glb'
];

const KENNEY_SET_URLS = [
  'https://raw.githubusercontent.com/KenneyNL/boardgame-kit/main/Models/GLTF/boardgame-kit.glb',
  'https://cdn.jsdelivr.net/gh/KenneyNL/boardgame-kit@main/Models/GLTF/boardgame-kit.glb'
];

const POLYGONAL_SET_URLS = [
  'https://raw.githubusercontent.com/quaterniusdev/ChessSet/master/Source/GLTF/ChessSet.glb',
  'https://cdn.jsdelivr.net/gh/quaterniusdev/ChessSet@master/Source/GLTF/ChessSet.glb'
];

const CHAIR_MODEL_URLS = [
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/AntiqueChair/glTF-Binary/AntiqueChair.glb',
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/SheenChair/glTF-Binary/SheenChair.glb',
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/AntiqueChair/glTF-Binary/AntiqueChair.glb'
];
const TARGET_CHAIR_SIZE = new THREE.Vector3(1.3162499970197679, 1.9173749900311232, 1.7001562547683715);
const TARGET_CHAIR_MIN_Y = -0.8570624993294478;
const TARGET_CHAIR_CENTER_Z = -0.1553906416893005;

const MOVE_SOUND_URL =
  'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard/Move.mp3';
const CHECK_SOUND_URL =
  'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard/Check.mp3';
const CHECKMATE_SOUND_URL =
  'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard/End.mp3';

const BEAUTIFUL_GAME_THEME = Object.freeze(
  buildBoardTheme({
    ...(BOARD_COLOR_BASE_OPTIONS.find((option) => option.id === 'stoneMarbleJade') ?? {}),
    light: '#f0d9b5',
    dark: '#8b5a2b',
    frameLight: '#b88a55',
    frameDark: '#3d2a1c',
    accent: '#caa472',
    highlight: '#7ef9a1',
    capture: '#ff8975',
    surfaceRoughness: 0.62,
    surfaceMetalness: 0.22,
    frameRoughness: 0.78,
    frameMetalness: 0.18
  })
);

const BEAUTIFUL_GAME_BOARD_OPTION = Object.freeze({
  id: 'beautifulGameBoard',
  label: 'A Beautiful Game Board',
  ...BEAUTIFUL_GAME_THEME
});

const BOARD_COLOR_OPTIONS = Object.freeze([
  BEAUTIFUL_GAME_BOARD_OPTION,
  ...BOARD_COLOR_BASE_OPTIONS
]);

const SCULPTED_DRAG_STYLE = Object.freeze({
  id: 'sculptedDrag',
  label: 'Ivory & Onyx Sculpted',
  white: {
    color: '#f6f1e6',
    roughness: 0.45,
    metalness: 0.05,
    clearcoat: 0.4,
    clearcoatRoughness: 0.6,
    sheen: 1,
    sheenRoughness: 0.85
  },
  black: {
    color: '#0f1217',
    roughness: 0.32,
    metalness: 0.5,
    clearcoat: 0.5,
    clearcoatRoughness: 0.4,
    sheen: 1,
    sheenRoughness: 0.9
  },
  accent: '#60a5fa'
});

const DEFAULT_PIECE_STYLE = SCULPTED_DRAG_STYLE;
const DEFAULT_PIECE_SET_ID = 'sculptedDrag';

const BEAUTIFUL_GAME_PIECE_STYLE = Object.freeze({
  id: 'beautifulGameAuthentic',
  label: 'A Beautiful Game',
  white: {
    color: '#f6f7fb',
    roughness: 0.3,
    metalness: 0.28,
    sheen: 0.28,
    sheenColor: '#ffffff',
    clearcoat: 0.3,
    clearcoatRoughness: 0.22,
    specularIntensity: 0.72
  },
  black: {
    color: '#0f131f',
    roughness: 0.24,
    metalness: 0.38,
    sheen: 0.22,
    sheenColor: '#5f799c',
    clearcoat: 0.26,
    clearcoatRoughness: 0.34,
    specularIntensity: 0.72,
    emissive: '#0b1220',
    emissiveIntensity: 0.24
  },
  accent: '#caa472',
  blackAccent: '#b58f4f'
});

// Sized to the physical ABeautifulGame set while fitting the playable footprint
const BEAUTIFUL_GAME_ASSET_SCALE = 0.94;

const STAUNTON_CLASSIC_STYLE = Object.freeze({
  id: 'stauntonClassic',
  label: 'Staunton Classics',
  white: { color: '#f3ede0', roughness: 0.38, metalness: 0.18, sheen: 0.24 },
  black: {
    color: '#1c1b1f',
    roughness: 0.32,
    metalness: 0.26,
    sheen: 0.18,
    emissive: '#0a0a0f',
    emissiveIntensity: 0.18
  },
  accent: '#d8b07a',
  blackAccent: '#b98950'
});

const STAUNTON_ASSET_SCALE = 1.02;
const STAUNTON_TEXTURED_ASSET_SCALE = 1.02;

const TEXTURE_CACHE = new Map();

function createGraniteTexture(color = '#d9d7d1', seed = 1, repeat = 2.4) {
  if (typeof document === 'undefined') return null;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);

  let s = seed;
  const rand = () => {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return ((s < 0 ? ~s + 1 : s) % 1000) / 1000;
  };

  for (let i = 0; i < 26000; i += 1) {
    const x = rand() * size;
    const y = rand() * size;
    const alpha = 0.06 + rand() * 0.22;
    const shade = 30 + Math.floor(rand() * 90);
    ctx.fillStyle = `rgba(${shade},${shade},${shade},${alpha})`;
    const radius = 0.5 + rand() * 1.6;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  applySRGBColorSpace(texture);
  return texture;
}

function loadTexture(url) {
  const cached = TEXTURE_CACHE.get(url);
  if (cached) return cached;
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');
  const promise = new Promise((resolve, reject) => {
    loader.load(url, (texture) => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      resolve(texture);
    }, undefined, reject);
  });
  TEXTURE_CACHE.set(url, promise);
  return promise;
}

const MAPLE_WOOD_TEXTURES = Object.freeze({
  colorMap: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/Wood067/Wood067_2K_Color.jpg',
  roughnessMap: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/Wood067/Wood067_2K_Roughness.jpg',
  normalMap: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/Wood067/Wood067_2K_NormalGL.jpg',
  repeat: 2.2
});

const WALNUT_WOOD_TEXTURES = Object.freeze({
  colorMap: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/Wood049/Wood049_2K_Color.jpg',
  roughnessMap: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/Wood049/Wood049_2K_Roughness.jpg',
  normalMap: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/Wood049/Wood049_2K_NormalGL.jpg',
  repeat: 2
});

const MARBLE_WHITE_TEXTURES = Object.freeze({
  colorMap: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/Marble020/Marble020_2K_Color.jpg',
  roughnessMap: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/Marble020/Marble020_2K_Roughness.jpg',
  normalMap: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/Marble020/Marble020_2K_NormalGL.jpg',
  repeat: 1.4
});

const MARBLE_BLACK_TEXTURES = Object.freeze({
  colorMap: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/Marble008/Marble008_2K_Color.jpg',
  roughnessMap: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/Marble008/Marble008_2K_Roughness.jpg',
  normalMap: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/Marble008/Marble008_2K_NormalGL.jpg',
  repeat: 1.3
});

const EBONY_POLISH_TEXTURES = Object.freeze({
  colorMap: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/Wood059/Wood059_2K_Color.jpg',
  roughnessMap: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/Wood059/Wood059_2K_Roughness.jpg',
  normalMap: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/Wood059/Wood059_2K_NormalGL.jpg',
  repeat: 1.8
});

const HERITAGE_WALNUT_STYLE = Object.freeze({
  id: 'heritageWalnut',
  label: 'Heritage Walnut Staunton',
  white: { color: '#f2e8d8', roughness: 0.32, metalness: 0.08, sheen: 0.18 },
  black: { color: '#2b1b10', roughness: 0.42, metalness: 0.06, sheen: 0.16 },
  accent: '#c49b6b'
});

const MARBLE_ONYX_STYLE = Object.freeze({
  id: 'marbleOnyx',
  label: 'Marble & Onyx Tournament',
  white: { color: '#f3f3f3', roughness: 0.18, metalness: 0.08, clearcoat: 0.24 },
  black: { color: '#0f1012', roughness: 0.22, metalness: 0.1, clearcoat: 0.28 },
  accent: '#b1c4cf'
});

const KENNEY_WOOD_STYLE = Object.freeze({
  id: 'kenneyWood',
  label: 'Kenney Woodcut',
  white: { color: '#f2e0c5', roughness: 0.48, metalness: 0.08, clearcoat: 0.12 },
  black: { color: '#2c2016', roughness: 0.56, metalness: 0.12, clearcoat: 0.12 },
  accent: '#d7b07a',
  blackAccent: '#b98a52'
});

const POLYGONAL_GRAPHITE_STYLE = Object.freeze({
  id: 'polygonalGraphite',
  label: 'Polygonal Graphite',
  white: { color: '#e7e8ef', roughness: 0.34, metalness: 0.24, sheen: 0.12 },
  black: { color: '#1c2430', roughness: 0.3, metalness: 0.32, sheen: 0.16 },
  accent: '#7ce3ff',
  blackAccent: '#50b8d8'
});

const PIECE_STYLE_OPTIONS = Object.freeze([
  {
    id: DEFAULT_PIECE_SET_ID,
    label: 'Ivory & Onyx Sculpted',
    style: SCULPTED_DRAG_STYLE,
    loader: (targetBoardSize) =>
      buildSculptedAssets(targetBoardSize, SCULPTED_DRAG_STYLE, DEFAULT_PIECE_SET_ID)
  },
  {
    id: 'heritageWalnut',
    label: 'Heritage Walnut Staunton',
    style: HERITAGE_WALNUT_STYLE,
    loader: (targetBoardSize) => loadWalnutStauntonAssets(targetBoardSize)
  },
  {
    id: 'marbleOnyx',
    label: 'Marble & Onyx Tournament',
    style: MARBLE_ONYX_STYLE,
    loader: (targetBoardSize) => loadMarbleOnyxStauntonAssets(targetBoardSize)
  },
  {
    id: 'kenneyWood',
    label: 'Kenney Woodcut Low-Poly',
    style: KENNEY_WOOD_STYLE,
    preserveMaterials: true,
    loader: (targetBoardSize) => loadKenneyAssets(targetBoardSize)
  },
  {
    id: 'polygonalGraphite',
    label: 'Polygonal Graphite Low-Poly',
    style: POLYGONAL_GRAPHITE_STYLE,
    loader: (targetBoardSize) => loadPolygonalAssets(targetBoardSize)
  },
  {
    id: 'beautifulGameTouch',
    label: 'A Beautiful Game (Touch Edition)',
    style: BEAUTIFUL_GAME_PIECE_STYLE,
    preserveMaterials: true,
    loader: (targetBoardSize) => resolveBeautifulGameTouchAssets(targetBoardSize)
  }
]);

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
const CAMERA_DEFAULT_PHI = clamp(
  THREE.MathUtils.lerp(cameraPhiMin, cameraPhiMax, ARENA_CAMERA_DEFAULTS.initialPhiLerp) +
    CAMERA_INITIAL_PHI_EXTRA,
  CAMERA_PULL_FORWARD_MIN,
  cameraPhiMax
);
const cameraPhiHardMax = Math.min(cameraPhiMax, Math.PI - 0.45);
const CAMERA_SAFE_MAX_RADIUS = CAMERA_BASE_RADIUS * 2.2;
const CAMERA_TOPDOWN_MIN_RADIUS = CAMERA_BASE_RADIUS * 1.05;
const CAMERA_TOPDOWN_MAX_RADIUS = CAMERA_BASE_RADIUS * 1.65;
const CAM = {
  fov: ARENA_CAMERA_DEFAULTS.fov,
  near: ARENA_CAMERA_DEFAULTS.near,
  far: ARENA_CAMERA_DEFAULTS.far,
  minR: CAMERA_BASE_RADIUS * ARENA_CAMERA_DEFAULTS.minRadiusFactor,
  maxR: CAMERA_BASE_RADIUS * ARENA_CAMERA_DEFAULTS.maxRadiusFactor,
  phiMin: cameraPhiMin,
  phiMax: cameraPhiHardMax
};

const PLAYER_FLAG_STORAGE_KEY = 'chessBattleRoyalPlayerFlag';
const FALLBACK_FLAG = '🇺🇸';
const DEFAULT_APPEARANCE = {
  ...DEFAULT_TABLE_CUSTOMIZATION,
  chairColor: 0,
  tableShape: 0,
  boardColor: 0,
  pieceStyle: 0
};
const APPEARANCE_STORAGE_KEY = 'chessBattleRoyalAppearance';
const MOVE_MODE_STORAGE_KEY = 'chessBattleRoyalMoveMode';
const MOVE_MODE_OPTIONS = [
  { id: 'click', label: 'Click to move' },
  { id: 'drag', label: 'Drag & drop' }
];

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

const PRESERVE_NATIVE_PIECE_IDS = new Set(
  PIECE_STYLE_OPTIONS.filter((option) => option?.preserveMaterials).map((option) => option.id)
);

const CUSTOMIZATION_SECTIONS = [
  { key: 'boardColor', label: 'Board Colors', options: BOARD_COLOR_OPTIONS },
  { key: 'pieceStyle', label: 'Chess Pieces', options: PIECE_STYLE_OPTIONS },
  { key: 'tableWood', label: 'Table Wood', options: TABLE_WOOD_OPTIONS },
  { key: 'tableCloth', label: 'Table Cloth', options: TABLE_CLOTH_OPTIONS },
  { key: 'tableBase', label: 'Table Base', options: TABLE_BASE_OPTIONS },
  { key: 'chairColor', label: 'Chairs', options: CHAIR_COLOR_OPTIONS },
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
    ['boardColor', BOARD_COLOR_OPTIONS.length],
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

function fitChairModelToFootprint(model) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const targetMax = Math.max(TARGET_CHAIR_SIZE.x, TARGET_CHAIR_SIZE.y, TARGET_CHAIR_SIZE.z);
  const currentMax = Math.max(size.x, size.y, size.z);
  if (currentMax > 0) {
    const scale = targetMax / currentMax;
    model.scale.multiplyScalar(scale);
  }

  const scaledBox = new THREE.Box3().setFromObject(model);
  const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
  const offset = new THREE.Vector3(
    -scaledCenter.x,
    TARGET_CHAIR_MIN_Y - scaledBox.min.y,
    TARGET_CHAIR_CENTER_Z - scaledCenter.z
  );
  model.position.add(offset);
}

function extractChairMaterials(model) {
  const upholstery = new Set();
  const metal = new Set();
  model.traverse((obj) => {
    if (obj.isMesh) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((mat) => {
        if (!mat) return;
        if (mat.map) applySRGBColorSpace(mat.map);
        if (mat.emissiveMap) applySRGBColorSpace(mat.emissiveMap);
        const bucket = (mat.metalness ?? 0) > 0.35 ? metal : upholstery;
        bucket.add(mat);
      });
    }
  });
  const upholsteryArr = Array.from(upholstery);
  const metalArr = Array.from(metal);
  return {
    seat: upholsteryArr[0] ?? metalArr[0] ?? null,
    leg: metalArr[0] ?? upholsteryArr[0] ?? null,
    upholstery: upholsteryArr,
    metal: metalArr
  };
}

function applyChairThemeMaterials(chairAssets, theme) {
  const mats = chairAssets?.chairMaterials;
  if (!mats) return;
  const seatColor = theme.seatColor ?? '#2b314e';
  const legColor = theme.legColor ?? DEFAULT_CHAIR_THEME.legColor;
  mats.chairId = theme.chairId ?? 'default';
  if (mats.seat?.color) {
    mats.seat.color.set(seatColor);
    mats.seat.userData = { ...(mats.seat.userData || {}), chairId: mats.chairId };
    mats.seat.needsUpdate = true;
  }
  if (mats.leg?.color) {
    mats.leg.color.set(legColor);
    mats.leg.userData = { ...(mats.leg.userData || {}), chairId: mats.chairId };
    mats.leg.needsUpdate = true;
  }
  (mats.upholstery ?? []).forEach((mat) => {
    if (!mat?.color) return;
    mat.color.set(seatColor);
    mat.userData = { ...(mat.userData || {}), chairId: mats.chairId };
    mat.needsUpdate = true;
  });
  (mats.metal ?? []).forEach((mat) => {
    if (!mat?.color) return;
    mat.color.set(legColor);
    mat.userData = { ...(mat.userData || {}), chairId: mats.chairId };
    mat.needsUpdate = true;
  });
}

async function loadGltfChair() {
  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
  loader.setDRACOLoader(draco);

  let gltf = null;
  let lastError = null;
  for (const url of CHAIR_MODEL_URLS) {
    try {
      gltf = await loader.loadAsync(url);
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!gltf) {
    throw lastError || new Error('Failed to load chair model');
  }

  const model = gltf.scene || gltf.scenes?.[0];
  if (!model) {
    throw new Error('Chair model missing scene');
  }

  model.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((mat) => {
        if (mat?.map) applySRGBColorSpace(mat.map);
        if (mat?.emissiveMap) applySRGBColorSpace(mat.emissiveMap);
      });
    }
  });

  fitChairModelToFootprint(model);

  return {
    chairTemplate: model,
    materials: extractChairMaterials(model)
  };
}

function mapChairOptionToTheme(chairOption) {
  return {
    seatColor: chairOption?.primary ?? '#2b314e',
    legColor: chairOption?.legColor ?? DEFAULT_CHAIR_THEME.legColor,
    chairId: chairOption?.id ?? 'default'
  };
}

function createProceduralChair(theme) {
  const seatMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(theme?.seatColor || '#7c3aed'),
    roughness: 0.42,
    metalness: 0.18
  });
  const legMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(theme?.legColor || '#111827'),
    roughness: 0.55,
    metalness: 0.38
  });

  const chair = new THREE.Group();

  const seatMesh = new THREE.Mesh(new THREE.BoxGeometry(SEAT_WIDTH, SEAT_THICKNESS, SEAT_DEPTH), seatMaterial);
  seatMesh.position.y = SEAT_THICKNESS / 2;
  seatMesh.castShadow = true;
  seatMesh.receiveShadow = true;
  chair.add(seatMesh);

  const backMesh = new THREE.Mesh(
    new THREE.BoxGeometry(SEAT_WIDTH * 0.96, BACK_HEIGHT, BACK_THICKNESS),
    seatMaterial
  );
  backMesh.position.set(0, SEAT_THICKNESS / 2 + BACK_HEIGHT / 2, -SEAT_DEPTH / 2 + BACK_THICKNESS / 2);
  backMesh.castShadow = true;
  backMesh.receiveShadow = true;
  chair.add(backMesh);

  const armGeometry = new THREE.BoxGeometry(ARM_THICKNESS, ARM_HEIGHT, ARM_DEPTH);
  const armOffsetX = SEAT_WIDTH / 2 - ARM_THICKNESS / 2;
  const armOffsetY = SEAT_THICKNESS / 2 + ARM_HEIGHT / 2;
  const armOffsetZ = -ARM_DEPTH / 2 + ARM_THICKNESS * 0.2;
  const leftArm = new THREE.Mesh(armGeometry, seatMaterial);
  leftArm.position.set(-armOffsetX, armOffsetY, armOffsetZ);
  leftArm.castShadow = true;
  leftArm.receiveShadow = true;
  chair.add(leftArm);
  const rightArm = new THREE.Mesh(armGeometry, seatMaterial);
  rightArm.position.set(armOffsetX, armOffsetY, armOffsetZ);
  rightArm.castShadow = true;
  rightArm.receiveShadow = true;
  chair.add(rightArm);

  const legMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16 * MODEL_SCALE * STOOL_SCALE, 0.2 * MODEL_SCALE * STOOL_SCALE, BASE_COLUMN_HEIGHT, 18),
    legMaterial
  );
  legMesh.position.y = -SEAT_THICKNESS / 2 - BASE_COLUMN_HEIGHT / 2;
  legMesh.castShadow = true;
  legMesh.receiveShadow = true;
  chair.add(legMesh);

  const foot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32 * MODEL_SCALE * STOOL_SCALE, 0.32 * MODEL_SCALE * STOOL_SCALE, 0.08 * MODEL_SCALE, 24),
    legMaterial
  );
  foot.position.y = legMesh.position.y - BASE_COLUMN_HEIGHT / 2 - 0.04 * MODEL_SCALE;
  foot.castShadow = true;
  foot.receiveShadow = true;
  chair.add(foot);

  return {
    chairTemplate: chair,
    materials: {
      seat: seatMaterial,
      leg: legMaterial,
      upholstery: [seatMaterial],
    metal: [legMaterial]
    }
  };
}

async function buildChessChairTemplate(theme) {
  try {
    const gltfChair = await loadGltfChair();
    applyChairThemeMaterials({ chairMaterials: gltfChair.materials }, theme);
    gltfChair.materials.chairId = theme.chairId ?? 'default';
    return gltfChair;
  } catch (error) {
    console.error('Falling back to procedural chair', error);
  }
  const fallback = createProceduralChair(theme);
  fallback.materials.chairId = theme.chairId ?? 'default';
  return fallback;
}

function disposeChessChairMaterials(materials) {
  if (!materials) return;
  const handled = new Set();
  const disposeMat = (mat) => {
    if (!mat || handled.has(mat)) return;
    handled.add(mat);
    mat.dispose?.();
  };
  disposeMat(materials.seat);
  disposeMat(materials.leg);
  (materials.upholstery ?? []).forEach(disposeMat);
  (materials.metal ?? []).forEach(disposeMat);
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
  const pieceOption = PIECE_STYLE_OPTIONS[normalized.pieceStyle]?.style ?? DEFAULT_PIECE_STYLE;
  const boardOption = BOARD_COLOR_OPTIONS[normalized.boardColor] ?? BEAUTIFUL_GAME_THEME;
  const boardTheme = buildBoardTheme(boardOption);
  return {
    board: boardTheme,
    pieces: pieceOption,
    highlight: boardTheme.highlight,
    capture: boardTheme.capture,
    accent: boardTheme.accent,
    pieceSetId: PIECE_STYLE_OPTIONS[normalized.pieceStyle]?.id ?? DEFAULT_PIECE_SET_ID
  };
}

function createConfiguredGLTFLoader() {
  const loader = new GLTFLoader();
  loader.setCrossOrigin('anonymous');
  const draco = new DRACOLoader();
  draco.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
  loader.setDRACOLoader(draco);
  return loader;
}

async function loadBeautifulGameSet() {
  const loader = createConfiguredGLTFLoader();
  let lastError = null;
  for (const url of BEAUTIFUL_GAME_URLS) {
    try {
      const isLocal = url.startsWith('/') || url.startsWith('./');
      const resolvedUrl = new URL(url, window.location.href).href;
      const resourcePath = resolvedUrl.substring(0, resolvedUrl.lastIndexOf('/') + 1);
      loader.setPath(resourcePath);
      loader.setResourcePath(resourcePath);
      // eslint-disable-next-line no-await-in-loop
      const gltf = await new Promise((resolve, reject) => {
        loader.load(resolvedUrl, resolve, undefined, reject);
      });
      if (gltf?.scene) {
        gltf.userData = { ...(gltf.userData || {}), beautifulGameSource: isLocal ? 'local' : 'remote' };
        gltf.scene.userData = { ...(gltf.scene.userData || {}), beautifulGameSource: gltf.userData.beautifulGameSource };
      }
      return gltf;
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) throw lastError;
  throw new Error('ABeautifulGame model failed to load');
}

async function loadPieceSetFromUrls(urls = [], options = {}) {
  const loader = createConfiguredGLTFLoader();
  let lastError = null;
  for (const url of urls) {
    try {
      const resolvedUrl = new URL(url, window.location.href).href;
      const resourcePath = resolvedUrl.substring(0, resolvedUrl.lastIndexOf('/') + 1);
      loader.setPath(resourcePath);
      loader.setResourcePath(resourcePath);
      // eslint-disable-next-line no-await-in-loop
      const gltf = await new Promise((resolve, reject) => {
        loader.load(resolvedUrl, resolve, undefined, reject);
      });
      if (gltf?.scene) {
        return extractChessSetAssets(gltf.scene, options);
      }
    } catch (error) {
      lastError = error;
    }
  }
  if (options?.fallbackBuilder) {
    return options.fallbackBuilder(options.targetBoardSize || RAW_BOARD_SIZE, options.pieceStyle);
  }
  if (lastError) throw lastError;
  throw new Error('Chess set model failed to load');
}

async function resolveTextureSet(definition = {}) {
  const [map, roughnessMap, normalMap] = await Promise.all([
    definition.colorMap ? loadTexture(definition.colorMap) : Promise.resolve(null),
    definition.roughnessMap ? loadTexture(definition.roughnessMap) : Promise.resolve(null),
    definition.normalMap ? loadTexture(definition.normalMap) : Promise.resolve(null)
  ]);
  return {
    map,
    roughnessMap,
    normalMap,
    repeat: definition.repeat ?? 1
  };
}

function applyTextureSetToMaterial(baseMaterial, textureSet, { tint, roughness, metalness } = {}) {
  const material = baseMaterial?.clone ? baseMaterial.clone() : new THREE.MeshPhysicalMaterial();
  if (textureSet.map) {
    material.map = textureSet.map;
    material.map.repeat.set(textureSet.repeat, textureSet.repeat);
    material.map.needsUpdate = true;
  }
  if (textureSet.roughnessMap) {
    material.roughnessMap = textureSet.roughnessMap;
    material.roughnessMap.repeat.set(textureSet.repeat, textureSet.repeat);
    material.roughnessMap.needsUpdate = true;
  }
  if (textureSet.normalMap) {
    material.normalMap = textureSet.normalMap;
    material.normalScale = new THREE.Vector2(0.65, 0.65);
    material.normalMap.repeat.set(textureSet.repeat, textureSet.repeat);
    material.normalMap.needsUpdate = true;
  }
  if (Number.isFinite(roughness)) material.roughness = clamp01(roughness);
  if (Number.isFinite(metalness)) material.metalness = clamp01(metalness);
  if (tint) material.color = new THREE.Color(tint);
  material.needsUpdate = true;
  return material;
}

async function applyTextureProfileToAssets(assets, profile) {
  if (!assets?.piecePrototypes) return assets;
  const [whiteTextures, blackTextures] = await Promise.all([
    resolveTextureSet(profile.white),
    resolveTextureSet(profile.black)
  ]);

  const applyToPiece = (piece, textureSet, tintColor) => {
    if (!piece) return;
    piece.traverse((child) => {
      if (!child.isMesh) return;
      if (Array.isArray(child.material)) {
        child.material = child.material.map((mat) =>
          applyTextureSetToMaterial(mat, textureSet, { tint: tintColor })
        );
      } else {
        child.material = applyTextureSetToMaterial(child.material, textureSet, { tint: tintColor });
      }
      child.castShadow = true;
      child.receiveShadow = true;
    });
  };

  Object.values(assets.piecePrototypes.white || {}).forEach((piece) =>
    applyToPiece(piece, whiteTextures, profile.whiteTint || null)
  );
  Object.values(assets.piecePrototypes.black || {}).forEach((piece) =>
    applyToPiece(piece, blackTextures, profile.blackTint || null)
  );

  return assets;
}

function applyLocalBeautifulGameMaterials(assets) {
  if (!assets) return assets;
  const { boardModel, piecePrototypes } = assets;
  if (typeof document === 'undefined') return assets;

  const graniteLight = createGraniteTexture('#d9d7d1', 17, 2.1);
  const graniteDark = createGraniteTexture('#6c6963', 29, 2.1);
  const graniteEdge = createGraniteTexture('#2b2a32', 47, 1.6);

  const makeGlassMaterial = (colorHex) =>
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(colorHex),
      roughness: 0.08,
      metalness: 0.08,
      transparent: true,
      opacity: 1,
      transmission: 0.94,
      thickness: 0.65,
      attenuationColor: new THREE.Color(colorHex),
      attenuationDistance: 0.5,
      ior: 1.52,
      clearcoat: 0.82,
      clearcoatRoughness: 0.1,
      reflectivity: 0.82
    });

  const makeAccentMaterial = (colorHex) =>
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(colorHex),
      roughness: 0.2,
      metalness: 0.52,
      clearcoat: 0.48,
      clearcoatRoughness: 0.14,
      sheen: 0.24,
      sheenColor: new THREE.Color('#fdf6e3'),
      specularIntensity: 0.76
    });

  if (boardModel) {
    const frameMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#111118'),
      roughness: 0.42,
      metalness: 0.16,
      clearcoat: 0.34,
      clearcoatRoughness: 0.2,
      map: graniteEdge,
      normalMap: graniteEdge,
      normalScale: new THREE.Vector2(0.46, 0.46)
    });
    const topMat = frameMat.clone();
    topMat.color = new THREE.Color('#1c1c23');
    topMat.roughness = 0.32;
    topMat.metalness = 0.12;
    topMat.clearcoatRoughness = 0.16;

    boardModel.traverse((node) => {
      if (!node?.isMesh) return;
      if (node.name === 'BoardFrame') {
        node.material = frameMat.clone();
      } else if (node.name === 'BoardTop') {
        node.material = topMat.clone();
      } else if (node.name?.startsWith?.('Tile_')) {
        const [, r, c] = node.name.split('_');
        const isDark = (Number(r) + Number(c)) % 2 === 1;
        const tileMat = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(isDark ? '#5b5a5e' : '#f2efe8'),
          roughness: 0.32,
          metalness: 0.18,
          clearcoat: 0.22,
          clearcoatRoughness: 0.12,
          sheen: 0.18,
          sheenColor: new THREE.Color('#ffffff'),
          specularIntensity: 0.56,
          map: isDark ? graniteDark : graniteLight,
          normalMap: isDark ? graniteDark : graniteLight,
          normalScale: new THREE.Vector2(0.34, 0.34)
        });
        node.material = tileMat;
      }
      node.castShadow = true;
      node.receiveShadow = true;
    });
  }

  const applyPieces = (group, baseColor, accentColor) => {
    Object.values(group || {}).forEach((piece) => {
      if (!piece) return;
      piece.traverse((child) => {
        if (!child?.isMesh) return;
        const name = child.name?.toLowerCase?.() ?? '';
        const useAccent =
          name.includes('collar') || name.includes('crown') || name.includes('cross') || name.includes('ring');
        child.material = (useAccent ? makeAccentMaterial(accentColor) : makeGlassMaterial(baseColor)).clone();
        child.castShadow = true;
        child.receiveShadow = true;
      });
    });
  };

  applyPieces(
    piecePrototypes?.white,
    BEAUTIFUL_GAME_PIECE_STYLE.white?.color ?? '#f6f7fb',
    BEAUTIFUL_GAME_PIECE_STYLE.accent ?? '#caa472'
  );
  applyPieces(
    piecePrototypes?.black,
    BEAUTIFUL_GAME_PIECE_STYLE.black?.color ?? '#0f131f',
    BEAUTIFUL_GAME_PIECE_STYLE.blackAccent ?? BEAUTIFUL_GAME_PIECE_STYLE.accent ?? '#b58f4f'
  );

  return assets;
}

async function loadWalnutStauntonAssets(targetBoardSize = RAW_BOARD_SIZE) {
  const assets = await loadPieceSetFromUrls(STAUNTON_SET_URLS, {
    targetBoardSize,
    styleId: 'heritageWalnut',
    pieceStyle: HERITAGE_WALNUT_STYLE,
    assetScale: STAUNTON_TEXTURED_ASSET_SCALE,
    fallbackBuilder: buildStauntonFallbackAssets
  });
  return applyTextureProfileToAssets(assets, {
    white: MAPLE_WOOD_TEXTURES,
    black: WALNUT_WOOD_TEXTURES,
    whiteTint: '#f4ebd8',
    blackTint: '#2b1b10'
  });
}

async function loadMarbleOnyxStauntonAssets(targetBoardSize = RAW_BOARD_SIZE) {
  const assets = await loadPieceSetFromUrls(STAUNTON_SET_URLS, {
    targetBoardSize,
    styleId: 'marbleOnyx',
    pieceStyle: MARBLE_ONYX_STYLE,
    assetScale: STAUNTON_TEXTURED_ASSET_SCALE,
    fallbackBuilder: buildStauntonFallbackAssets
  });
  return applyTextureProfileToAssets(assets, {
    white: MARBLE_WHITE_TEXTURES,
    black: EBONY_POLISH_TEXTURES,
    whiteTint: '#f5f5f5',
    blackTint: '#0f1012'
  });
}

async function loadKenneyAssets(targetBoardSize = RAW_BOARD_SIZE) {
  return loadPieceSetFromUrls(KENNEY_SET_URLS, {
    targetBoardSize,
    styleId: 'kenneyWood',
    pieceStyle: KENNEY_WOOD_STYLE,
    assetScale: 0.9,
    fallbackBuilder: buildKenneyFallbackAssets
  });
}

async function loadPolygonalAssets(targetBoardSize = RAW_BOARD_SIZE) {
  return loadPieceSetFromUrls(POLYGONAL_SET_URLS, {
    targetBoardSize,
    styleId: 'polygonalGraphite',
    pieceStyle: POLYGONAL_GRAPHITE_STYLE,
    assetScale: 0.98,
    fallbackBuilder: buildPolygonalFallbackAssets
  });
}

function buildLathe(profile, segments = 32) {
  return new THREE.LatheGeometry(profile, segments);
}

function makeSmoothMaterial(color, options = {}) {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color),
    roughness: clamp01(options.roughness ?? 0.32),
    metalness: clamp01(options.metalness ?? 0.18),
    clearcoat: clamp01(options.clearcoat ?? 0.32),
    clearcoatRoughness: clamp01(options.clearcoatRoughness ?? 0.22),
    sheen: clamp01(options.sheen ?? 0.35),
    sheenColor: new THREE.Color(options.sheenColor ?? '#ffffff'),
    specularIntensity: clamp01(options.specularIntensity ?? 0.62)
  });
}

function makePieceMaterialFromStyle(style = {}, { color, flatShading = false } = {}) {
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color ?? style.color ?? '#ffffff'),
    roughness: clamp01(style.roughness ?? 0.35),
    metalness: clamp01(style.metalness ?? 0.2),
    sheen: clamp01(style.sheen ?? 0),
    sheenColor: new THREE.Color(style.sheenColor ?? style.color ?? '#ffffff'),
    clearcoat: clamp01(style.clearcoat ?? 0),
    clearcoatRoughness: clamp01(style.clearcoatRoughness ?? 0.35),
    specularIntensity: clamp01(style.specularIntensity ?? 0.6),
    flatShading
  });
  return material;
}

function pieceTypeFromName(name = '') {
  const lower = name.toLowerCase();
  if (lower.includes('king')) return 'K';
  if (lower.includes('queen')) return 'Q';
  if (lower.includes('rook')) return 'R';
  if (lower.includes('bishop')) return 'B';
  if (lower.includes('knight')) return 'N';
  if (lower.includes('pawn')) return 'P';
  return null;
}

function ascendWhile(node, predicate) {
  let current = node;
  while (current?.parent && predicate(current.parent)) {
    current = current.parent;
  }
  return current;
}

function detectPieceColor(node) {
  let current = node;
  for (let i = 0; i < 4 && current; i += 1) {
    const name = current.name?.toLowerCase?.() ?? '';
    if (name.includes('white')) return 'white';
    if (name.includes('black')) return 'black';
    current = current.parent;
  }
  return null;
}

function buildBeautifulGamePiece(type, colorHex, accentHex, scale = 1) {
  const baseRadius = 0.38 * scale;
  const baseHeight = 0.18 * scale;
  const collarRadius = 0.26 * scale;
  const collarHeight = 0.16 * scale;
  const bodyRadius = 0.3 * scale;
  const bodyHeight = 0.82 * scale;
  const crownRadius = 0.22 * scale;
  const g = new THREE.Group();
  g.name = `${colorHex}-${type}`;
  const base = new THREE.Mesh(
    buildLathe([
      new THREE.Vector2(0, 0),
      new THREE.Vector2(baseRadius, 0),
      new THREE.Vector2(baseRadius * 1.05, baseHeight * 0.4),
      new THREE.Vector2(baseRadius * 0.9, baseHeight),
      new THREE.Vector2(baseRadius * 0.15, baseHeight * 1.02),
      new THREE.Vector2(0, baseHeight * 1.05)
    ]),
    makeSmoothMaterial(colorHex, { metalness: 0.22, roughness: 0.28 })
  );
  g.add(base);

  const buildBody = (radius, height, roughness = 0.25) =>
    new THREE.Mesh(
      buildLathe([
        new THREE.Vector2(radius * 0.55, 0),
        new THREE.Vector2(radius, height * 0.12),
        new THREE.Vector2(radius * 0.68, height * 0.5),
        new THREE.Vector2(radius * 0.9, height * 0.78),
        new THREE.Vector2(radius * 0.5, height)
      ]),
      makeSmoothMaterial(colorHex, { roughness, metalness: 0.2 })
    );

  const collar = new THREE.Mesh(
    buildLathe([
      new THREE.Vector2(0, 0),
      new THREE.Vector2(collarRadius * 1.1, 0),
      new THREE.Vector2(collarRadius * 1.2, collarHeight * 0.4),
      new THREE.Vector2(collarRadius * 0.65, collarHeight * 0.7),
      new THREE.Vector2(collarRadius * 0.4, collarHeight)
    ]),
    makeSmoothMaterial(accentHex ?? colorHex, { roughness: 0.24, metalness: 0.22 })
  );

  if (type === 'P') {
    const body = buildBody(bodyRadius * 0.82, bodyHeight * 0.65, 0.3);
    body.position.y = baseHeight;
    g.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.18 * scale, 24, 16),
      makeSmoothMaterial(colorHex, { roughness: 0.26, metalness: 0.24 })
    );
    head.position.y = baseHeight + bodyHeight * 0.68;
    g.add(head);
  } else if (type === 'R') {
    const body = buildBody(bodyRadius * 0.9, bodyHeight * 0.7, 0.26);
    body.position.y = baseHeight;
    g.add(body);
    const crenel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26 * scale, 0.28 * scale, 0.22 * scale, 32, 1, false),
      makeSmoothMaterial(accentHex ?? colorHex, { roughness: 0.24, metalness: 0.26 })
    );
    crenel.position.y = baseHeight + bodyHeight * 0.72 + 0.1 * scale;
    g.add(crenel);
  } else if (type === 'N') {
    const body = buildBody(bodyRadius * 0.88, bodyHeight * 0.7, 0.28);
    body.position.y = baseHeight;
    g.add(body);
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(0.05 * scale, 0.1 * scale, -0.02 * scale, 0.22 * scale);
    shape.quadraticCurveTo(-0.08 * scale, 0.35 * scale, 0.05 * scale, 0.48 * scale);
    shape.quadraticCurveTo(0.25 * scale, 0.72 * scale, 0.12 * scale, 0.9 * scale);
    shape.quadraticCurveTo(0.02 * scale, 1.05 * scale, -0.06 * scale, 0.88 * scale);
    shape.quadraticCurveTo(-0.18 * scale, 0.65 * scale, -0.12 * scale, 0.35 * scale);
    shape.quadraticCurveTo(-0.2 * scale, 0.1 * scale, 0, 0);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.22 * scale,
      bevelEnabled: true,
      bevelThickness: 0.04 * scale,
      bevelSize: 0.05 * scale,
      bevelSegments: 4
    });
    geo.translate(-0.12 * scale, 0, -0.1 * scale);
    const head = new THREE.Mesh(geo, makeSmoothMaterial(colorHex, { roughness: 0.3, metalness: 0.26 }));
    head.rotation.y = Math.PI / 2;
    head.position.y = baseHeight + bodyHeight * 0.55;
    g.add(head);
  } else if (type === 'B') {
    const body = buildBody(bodyRadius * 0.92, bodyHeight * 0.78, 0.24);
    body.position.y = baseHeight;
    g.add(body);
    collar.position.y = baseHeight + bodyHeight * 0.8;
    g.add(collar);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.18 * scale, 24, 16),
      makeSmoothMaterial(colorHex, { roughness: 0.24, metalness: 0.24 })
    );
    dome.position.y = collar.position.y + 0.22 * scale;
    g.add(dome);
  } else if (type === 'Q') {
    const body = buildBody(bodyRadius * 1.02, bodyHeight * 0.88, 0.22);
    body.position.y = baseHeight;
    g.add(body);
    collar.position.y = baseHeight + bodyHeight * 0.9;
    g.add(collar);
    const crown = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(crownRadius, 0.05 * scale, 12, 32),
      makeSmoothMaterial(accentHex ?? colorHex, { roughness: 0.22, metalness: 0.24 })
    );
    ring.rotation.x = Math.PI / 2;
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.1 * scale, 24, 16),
      makeSmoothMaterial(accentHex ?? colorHex, { roughness: 0.18, metalness: 0.26 })
    );
    orb.position.y = 0.16 * scale;
    crown.add(ring, orb);
    crown.position.y = collar.position.y + 0.28 * scale;
    g.add(crown);
  } else if (type === 'K') {
    const body = buildBody(bodyRadius * 1.08, bodyHeight * 0.95, 0.2);
    body.position.y = baseHeight;
    g.add(body);
    collar.position.y = baseHeight + bodyHeight * 0.98;
    g.add(collar);
    const crown = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(crownRadius * 1.05, 0.048 * scale, 12, 32),
      makeSmoothMaterial(accentHex ?? colorHex, { roughness: 0.2, metalness: 0.26 })
    );
    ring.rotation.x = Math.PI / 2;
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.11 * scale, 24, 16),
      makeSmoothMaterial(accentHex ?? colorHex, { roughness: 0.16, metalness: 0.28 })
    );
    orb.position.y = 0.18 * scale;
    const crossVert = new THREE.Mesh(
      new THREE.BoxGeometry(0.08 * scale, 0.36 * scale, 0.08 * scale),
      makeSmoothMaterial(accentHex ?? colorHex, { roughness: 0.18, metalness: 0.3 })
    );
    crossVert.position.y = 0.25 * scale;
    const crossHoriz = new THREE.Mesh(
      new THREE.BoxGeometry(0.32 * scale, 0.08 * scale, 0.08 * scale),
      makeSmoothMaterial(accentHex ?? colorHex, { roughness: 0.18, metalness: 0.3 })
    );
    crossHoriz.position.y = 0.35 * scale;
    crown.add(ring, orb, crossVert, crossHoriz);
    crown.position.y = collar.position.y + 0.32 * scale;
    g.add(crown);
  }

  g.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  const box = new THREE.Box3().setFromObject(g);
  const center = new THREE.Vector3();
  box.getCenter(center);
  g.position.sub(center);
  g.position.y -= box.min.y;
  return g;
}

function buildBeautifulGameFallback(targetBoardSize, boardTheme = BEAUTIFUL_GAME_THEME) {
  const boardModel = new THREE.Group();
  boardModel.name = 'ABeautifulGameLocal';
  const tile = BOARD.tile;
  const N = BOARD.N;
  const half = (N * tile) / 2;
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(
      targetBoardSize || N * tile + BOARD.rim * 2,
      BOARD.baseH * 1.05,
      targetBoardSize || N * tile + BOARD.rim * 2
    ),
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(boardTheme.frameDark ?? BASE_BOARD_THEME.frameDark),
      roughness: clamp01(boardTheme.frameRoughness ?? BASE_BOARD_THEME.frameRoughness),
      metalness: clamp01(boardTheme.frameMetalness ?? BASE_BOARD_THEME.frameMetalness),
      clearcoat: 0.32
    })
  );
  base.position.y = BOARD.baseH * 0.5;
  boardModel.add(base);
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(N * tile + BOARD.rim * 1.2, 0.14, N * tile + BOARD.rim * 1.2),
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(boardTheme.frameLight ?? BASE_BOARD_THEME.frameLight),
      roughness: clamp01(boardTheme.surfaceRoughness ?? BASE_BOARD_THEME.surfaceRoughness),
      metalness: clamp01(boardTheme.surfaceMetalness ?? BASE_BOARD_THEME.surfaceMetalness),
      clearcoat: 0.22
    })
  );
  top.position.y = BOARD.baseH + 0.07;
  boardModel.add(top);

  const tiles = new THREE.Group();
  boardModel.add(tiles);
  for (let r = 0; r < N; r += 1) {
    for (let c = 0; c < N; c += 1) {
      const isDark = (r + c) % 2 === 1;
      const mat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(isDark ? boardTheme.dark : boardTheme.light),
        roughness: clamp01(boardTheme.surfaceRoughness ?? BASE_BOARD_THEME.surfaceRoughness),
        metalness: clamp01(boardTheme.surfaceMetalness ?? BASE_BOARD_THEME.surfaceMetalness),
        clearcoat: 0.08,
        specularIntensity: 0.32
      });
      const tileMesh = new THREE.Mesh(new THREE.BoxGeometry(tile, 0.06, tile), mat);
      tileMesh.position.set(c * tile - half + tile / 2, BOARD.baseH + 0.12, r * tile - half + tile / 2);
      tiles.add(tileMesh);
    }
  }

  const piecePrototypes = { white: {}, black: {} };
  const scale = (tile / 0.9) * BEAUTIFUL_GAME_ASSET_SCALE;
  const authenticWhite = BEAUTIFUL_GAME_PIECE_STYLE.white?.color ?? '#f6f7fb';
  const authenticBlack = BEAUTIFUL_GAME_PIECE_STYLE.black?.color ?? '#0f131f';
  const accentLight = BEAUTIFUL_GAME_PIECE_STYLE.accent ?? '#d4af78';
  const accentDark = BEAUTIFUL_GAME_PIECE_STYLE.blackAccent ?? accentLight;
  piecePrototypes.white.P = buildBeautifulGamePiece('P', authenticWhite, accentLight, scale);
  piecePrototypes.white.R = buildBeautifulGamePiece('R', authenticWhite, accentLight, scale);
  piecePrototypes.white.N = buildBeautifulGamePiece('N', authenticWhite, accentLight, scale);
  piecePrototypes.white.B = buildBeautifulGamePiece('B', authenticWhite, accentLight, scale);
  piecePrototypes.white.Q = buildBeautifulGamePiece('Q', authenticWhite, accentLight, scale);
  piecePrototypes.white.K = buildBeautifulGamePiece('K', authenticWhite, accentLight, scale);
  piecePrototypes.black.P = buildBeautifulGamePiece('P', authenticBlack, accentDark, scale);
  piecePrototypes.black.R = buildBeautifulGamePiece('R', authenticBlack, accentDark, scale);
  piecePrototypes.black.N = buildBeautifulGamePiece('N', authenticBlack, accentDark, scale);
  piecePrototypes.black.B = buildBeautifulGamePiece('B', authenticBlack, accentDark, scale);
  piecePrototypes.black.Q = buildBeautifulGamePiece('Q', authenticBlack, accentDark, scale);
  piecePrototypes.black.K = buildBeautifulGamePiece('K', authenticBlack, accentDark, scale);

  Object.values(piecePrototypes).forEach((byColor) => {
    Object.values(byColor).forEach((proto) => {
      proto.userData = { ...(proto.userData || {}), __pieceStyleId: 'beautifulGame' };
      proto.traverse((child) => {
        if (!child.isMesh) return;
        child.castShadow = true;
        child.receiveShadow = true;
        child.userData = { ...(child.userData || {}), __pieceStyleId: 'beautifulGame' };
      });
    });
  });

  return { boardModel, piecePrototypes };
}

function finalizePrototype(group, scale = 1, styleId = 'customPieces') {
  const box = new THREE.Box3().setFromObject(group);
  const center = new THREE.Vector3();
  box.getCenter(center);
  group.position.sub(center);
  group.position.y -= box.min.y;
  group.scale.multiplyScalar(scale);
  group.userData = { ...(group.userData || {}), __pieceStyleId: styleId };
  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      child.userData = { ...(child.userData || {}), __pieceStyleId: styleId };
    }
  });
  return group;
}

function sculptProfile(points = []) {
  return points.map(([x, y]) => new THREE.Vector2(x, y));
}

function sculptLathe(points = [], segments = 96) {
  return new THREE.LatheGeometry(points, segments);
}

function buildSculptedPiece(type, materials = {}, scale = 1, styleId = DEFAULT_PIECE_SET_ID) {
  const baseMat = materials.base;
  const accentMat = materials.accent ?? baseMat;
  const g = new THREE.Group();

  const addMesh = (geometry, material = baseMat, position = null, rotation = null) => {
    const mesh = new THREE.Mesh(geometry, material);
    if (position) mesh.position.copy(position);
    if (rotation) mesh.rotation.set(rotation.x, rotation.y, rotation.z);
    g.add(mesh);
    return mesh;
  };

  if (type === 'P') {
    const profile = sculptProfile([
      [0.0, 0.0],
      [0.36, 0.0],
      [0.44, 0.06],
      [0.52, 0.12],
      [0.58, 0.18],
      [0.54, 0.24],
      [0.46, 0.32],
      [0.36, 0.46],
      [0.3, 0.62],
      [0.28, 0.74],
      [0.0, 0.74]
    ]);
    addMesh(sculptLathe(profile, 96), baseMat);
    addMesh(new THREE.SphereGeometry(0.26, 28, 24), accentMat, new THREE.Vector3(0, 1.02, 0));
  } else if (type === 'R') {
    const profile = sculptProfile([
      [0, 0],
      [0.58, 0],
      [0.62, 0.06],
      [0.62, 0.1],
      [0.54, 0.2],
      [0.46, 0.3],
      [0.42, 0.54],
      [0.46, 0.74],
      [0.56, 0.86],
      [0.6, 0.94],
      [0, 0.94]
    ]);
    addMesh(sculptLathe(profile, 96), baseMat);
    addMesh(new THREE.CylinderGeometry(0.54, 0.54, 0.08, 28), accentMat, new THREE.Vector3(0, 1.02, 0));
    addMesh(new THREE.CylinderGeometry(0.62, 0.62, 0.1, 20, 1, true), accentMat, new THREE.Vector3(0, 1.1, 0));
  } else if (type === 'N') {
    const profile = sculptProfile([
      [0, 0],
      [0.58, 0],
      [0.62, 0.06],
      [0.62, 0.1],
      [0.52, 0.18],
      [0.48, 0.28],
      [0.4, 0.42],
      [0.34, 0.56],
      [0, 0.56]
    ]);
    addMesh(sculptLathe(profile, 96), baseMat);
    const shape = new THREE.Shape();
    const pts = [
      [-0.3, 0.0],
      [-0.08, 0.06],
      [0.1, 0.38],
      [0.26, 0.5],
      [0.38, 0.64],
      [0.22, 0.7],
      [0.1, 0.66],
      [0.02, 0.8],
      [0.1, 1.0],
      [0.02, 1.06],
      [-0.08, 0.92],
      [-0.22, 0.82],
      [-0.28, 0.66],
      [-0.36, 0.54],
      [-0.34, 0.42],
      [-0.24, 0.34],
      [-0.28, 0.2],
      [-0.36, 0.1]
    ];
    shape.moveTo(pts[0][0], pts[0][1]);
    pts.slice(1).forEach(([x, y]) => shape.lineTo(x, y));
    shape.lineTo(-0.3, 0.0);
    const extrude = new THREE.ExtrudeGeometry(shape, {
      depth: 0.3,
      bevelEnabled: true,
      bevelSize: 0.02,
      bevelThickness: 0.02
    });
    extrude.rotateY(Math.PI / 2);
    extrude.translate(0, 0.92, 0);
    addMesh(extrude, baseMat);
  } else if (type === 'B') {
    const profile = sculptProfile([
      [0, 0],
      [0.58, 0],
      [0.62, 0.06],
      [0.62, 0.1],
      [0.52, 0.2],
      [0.42, 0.36],
      [0.34, 0.72],
      [0.3, 0.98],
      [0.24, 1.1],
      [0, 1.1]
    ]);
    addMesh(sculptLathe(profile, 96), baseMat);
    addMesh(new THREE.SphereGeometry(0.22, 28, 22), accentMat, new THREE.Vector3(0, 1.28, 0));
  } else if (type === 'Q') {
    const profile = sculptProfile([
      [0, 0],
      [0.62, 0],
      [0.66, 0.06],
      [0.68, 0.1],
      [0.58, 0.22],
      [0.48, 0.36],
      [0.42, 0.76],
      [0.38, 1.0],
      [0.34, 1.16],
      [0.3, 1.26],
      [0, 1.26]
    ]);
    addMesh(sculptLathe(profile, 96), baseMat);
    const crown = addMesh(new THREE.TorusGeometry(0.34, 0.05, 12, 36), accentMat);
    crown.rotation.x = Math.PI / 2;
    crown.position.y = 1.34;
    addMesh(new THREE.SphereGeometry(0.18, 24, 20), accentMat, new THREE.Vector3(0, 1.52, 0));
  } else if (type === 'K') {
    const profile = sculptProfile([
      [0, 0],
      [0.64, 0],
      [0.7, 0.06],
      [0.72, 0.1],
      [0.6, 0.22],
      [0.5, 0.38],
      [0.44, 0.82],
      [0.42, 1.08],
      [0.38, 1.26],
      [0.36, 1.38],
      [0, 1.38]
    ]);
    addMesh(sculptLathe(profile, 96), baseMat);
    const rim = addMesh(new THREE.TorusGeometry(0.36, 0.05, 12, 36), accentMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 1.44;
    addMesh(new THREE.BoxGeometry(0.06, 0.32, 0.06), accentMat, new THREE.Vector3(0, 1.66, 0));
    addMesh(new THREE.BoxGeometry(0.22, 0.06, 0.06), accentMat, new THREE.Vector3(0, 1.66, 0));
  }

  return finalizePrototype(g, scale, styleId);
}

function buildSculptedAssets(
  targetBoardSize = RAW_BOARD_SIZE,
  pieceStyle = SCULPTED_DRAG_STYLE,
  styleId = DEFAULT_PIECE_SET_ID
) {
  const tile = Math.max(0.001, (targetBoardSize || RAW_BOARD_SIZE) / 8);
  const scale = tile / 1.6;
  const accentLight = pieceStyle.accent ?? '#60a5fa';
  const accentDark = pieceStyle.blackAccent ?? accentLight;

  const piecePrototypes = { white: {}, black: {} };

  const buildForColor = (colorKey, accentHex) => {
    const colorStyle = pieceStyle[colorKey] ?? {};
    const materials = {
      base: makePieceMaterialFromStyle(colorStyle),
      accent: makePieceMaterialFromStyle(colorStyle, { color: accentHex })
    };
    piecePrototypes[colorKey].P = buildSculptedPiece('P', materials, scale, styleId);
    piecePrototypes[colorKey].R = buildSculptedPiece('R', materials, scale, styleId);
    piecePrototypes[colorKey].N = buildSculptedPiece('N', materials, scale, styleId);
    piecePrototypes[colorKey].B = buildSculptedPiece('B', materials, scale, styleId);
    piecePrototypes[colorKey].Q = buildSculptedPiece('Q', materials, scale, styleId);
    piecePrototypes[colorKey].K = buildSculptedPiece('K', materials, scale, styleId);
  };

  buildForColor('white', accentLight);
  buildForColor('black', accentDark);

  return { boardModel: null, piecePrototypes };
}

function buildStauntonPiece(type, materials = {}, scale = 1, styleId = 'stauntonClassic') {
  const baseMat = materials.base;
  const accentMat = materials.accent ?? baseMat;
  const g = new THREE.Group();
  const base = new THREE.Mesh(
    buildLathe(
      [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(0.52, 0),
        new THREE.Vector2(0.55, 0.12),
        new THREE.Vector2(0.48, 0.22),
        new THREE.Vector2(0.6, 0.28),
        new THREE.Vector2(0.5, 0.34),
        new THREE.Vector2(0.46, 0.38),
        new THREE.Vector2(0.2, 0.4),
        new THREE.Vector2(0, 0.42)
      ],
      42
    ),
    baseMat
  );
  g.add(base);

  const body = new THREE.Mesh(
    buildLathe(
      [
        new THREE.Vector2(0.24, 0),
        new THREE.Vector2(0.55, 0.12),
        new THREE.Vector2(0.6, 0.4),
        new THREE.Vector2(0.4, 0.9),
        new THREE.Vector2(0.32, 1.25),
        new THREE.Vector2(0.28, 1.5)
      ],
      42
    ),
    baseMat
  );
  body.position.y = 0.42;

  if (type === 'P') {
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 28, 24), accentMat);
    head.position.y = 1.72;
    g.add(head);
  } else if (type === 'R') {
    g.add(body);
    const crenel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.36, 0.28, 36, 1, false),
      accentMat
    );
    crenel.position.y = 1.75;
    const grooves = new THREE.Group();
    for (let i = 0; i < 4; i += 1) {
      const notch = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.26, 0.18), baseMat);
      const angle = (i * Math.PI) / 2;
      notch.position.set(Math.cos(angle) * 0.28, 1.9, Math.sin(angle) * 0.28);
      grooves.add(notch);
    }
    g.add(crenel, grooves);
  } else if (type === 'N') {
    const torso = body.clone();
    torso.scale.set(1.05, 0.9, 1.05);
    g.add(torso);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 0.26, 24), baseMat);
    neck.position.y = 1.6;
    const headShape = new THREE.Shape();
    headShape.moveTo(0, 0);
    headShape.quadraticCurveTo(0.12, 0.36, -0.04, 0.52);
    headShape.quadraticCurveTo(-0.18, 0.8, 0.16, 1.0);
    headShape.quadraticCurveTo(0.36, 1.18, 0.2, 1.32);
    headShape.quadraticCurveTo(-0.08, 1.2, -0.18, 0.88);
    headShape.quadraticCurveTo(-0.28, 0.54, -0.08, 0.2);
    const head = new THREE.Mesh(
      new THREE.ExtrudeGeometry(headShape, {
        depth: 0.36,
        bevelEnabled: true,
        bevelThickness: 0.06,
        bevelSize: 0.05,
        bevelSegments: 3
      }),
      baseMat
    );
    head.rotation.y = Math.PI / 2;
    head.position.set(-0.12, 1.68, -0.18);
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.16, 12), accentMat);
    ear.position.set(-0.02, 2.05, 0.0);
    g.add(torso, neck, head, ear);
  } else if (type === 'B') {
    const mid = body.clone();
    mid.scale.set(0.96, 1.08, 0.96);
    g.add(mid);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.06, 14, 32), accentMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 1.58;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.26, 26, 22), baseMat);
    cap.position.y = 1.78;
    const slit = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.38, 0.12), accentMat);
    slit.position.y = 1.9;
    g.add(mid, collar, cap, slit);
  } else if (type === 'Q') {
    const tall = body.clone();
    tall.scale.set(1.08, 1.2, 1.08);
    g.add(tall);
    const crownRing = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.06, 12, 28), accentMat);
    crownRing.rotation.x = Math.PI / 2;
    crownRing.position.y = 1.9;
    const spikes = new THREE.Group();
    for (let i = 0; i < 6; i += 1) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.32, 10), accentMat);
      const angle = (i * Math.PI * 2) / 6;
      spike.position.set(Math.cos(angle) * 0.38, 2.06, Math.sin(angle) * 0.38);
      spikes.add(spike);
    }
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 18, 14), accentMat);
    orb.position.y = 2.25;
    g.add(tall, crownRing, spikes, orb);
  } else if (type === 'K') {
    const pillar = body.clone();
    pillar.scale.set(1.12, 1.25, 1.12);
    g.add(pillar);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.06, 16, 32), accentMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 1.9;
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 16), accentMat);
    orb.position.y = 2.18;
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 0.08), accentMat);
    crossV.position.y = 2.42;
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.08), accentMat);
    crossH.position.y = 2.42;
    g.add(pillar, collar, orb, crossV, crossH);
  }

  return finalizePrototype(g, scale, styleId);
}

function buildStauntonFallbackAssets(
  targetBoardSize = RAW_BOARD_SIZE,
  pieceStyle = STAUNTON_CLASSIC_STYLE,
  styleId = 'stauntonClassic'
) {
  const tile = Math.max(0.001, (targetBoardSize || RAW_BOARD_SIZE) / 8);
  const scale = tile / 1.08;
  const accentLight = pieceStyle.accent ?? '#d8b07a';
  const accentDark = pieceStyle.blackAccent ?? accentLight;

  const piecePrototypes = { white: {}, black: {} };

  const buildForColor = (colorKey, accentHex) => {
    const colorStyle = pieceStyle[colorKey] ?? {};
    const materials = {
      base: makePieceMaterialFromStyle(colorStyle),
      accent: makePieceMaterialFromStyle(colorStyle, { color: accentHex })
    };
    piecePrototypes[colorKey].P = buildStauntonPiece('P', materials, scale, styleId);
    piecePrototypes[colorKey].R = buildStauntonPiece('R', materials, scale, styleId);
    piecePrototypes[colorKey].N = buildStauntonPiece('N', materials, scale, styleId);
    piecePrototypes[colorKey].B = buildStauntonPiece('B', materials, scale, styleId);
    piecePrototypes[colorKey].Q = buildStauntonPiece('Q', materials, scale, styleId);
    piecePrototypes[colorKey].K = buildStauntonPiece('K', materials, scale, styleId);
  };

  buildForColor('white', accentLight);
  buildForColor('black', accentDark);

  return { boardModel: null, piecePrototypes };
}

function buildKenneyPiece(type, materials = {}, scale = 1, styleId = 'kenneyWood') {
  const baseMat = materials.base;
  const accentMat = materials.accent ?? baseMat;
  const g = new THREE.Group();
  const slab = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.28, 1.25), baseMat);
  slab.position.y = 0.14;
  g.add(slab);

  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.52, 1.15, 14, 1), baseMat);
  pillar.position.y = 0.86;

  if (type === 'P') {
    g.add(pillar);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), accentMat);
    head.position.y = 1.52;
    g.add(head);
  } else if (type === 'R') {
    g.add(pillar);
    const crown = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.36, 0.9), accentMat);
    crown.position.y = 1.54;
    const teeth = new THREE.Group();
    for (let i = 0; i < 4; i += 1) {
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.2), baseMat);
      const angle = (i * Math.PI) / 2;
      tooth.position.set(Math.cos(angle) * 0.32, 1.74, Math.sin(angle) * 0.32);
      teeth.add(tooth);
    }
    g.add(crown, teeth);
  } else if (type === 'N') {
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.38, 6, 12), baseMat);
    body.position.set(0, 1.25, 0);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.26, 0.66), accentMat);
    jaw.position.set(-0.1, 1.62, 0.1);
    jaw.rotation.y = Math.PI / 8;
    const mane = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.72, 0.22), baseMat);
    mane.position.set(-0.28, 1.36, 0);
    g.add(pillar, body, jaw, mane);
  } else if (type === 'B') {
    const taper = new THREE.Mesh(new THREE.ConeGeometry(0.52, 1.18, 16), baseMat);
    taper.position.y = 1.1;
    const cut = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 0.16), accentMat);
    cut.position.y = 1.56;
    g.add(pillar, taper, cut);
  } else if (type === 'Q') {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.62, 1.35, 18), baseMat);
    body.position.y = 1.16;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.08, 10, 18), accentMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.72;
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), accentMat);
    orb.position.y = 2.04;
    g.add(body, ring, orb);
  } else if (type === 'K') {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.66, 1.45, 16), baseMat);
    tower.position.y = 1.22;
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.62, 0.14), accentMat);
    crossV.position.y = 2.04;
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.14), accentMat);
    crossH.position.y = 2.04;
    g.add(tower, crossV, crossH);
  }

  return finalizePrototype(g, scale, styleId);
}

function buildKenneyFallbackAssets(
  targetBoardSize = RAW_BOARD_SIZE,
  pieceStyle = KENNEY_WOOD_STYLE,
  styleId = 'kenneyWood'
) {
  const tile = Math.max(0.001, (targetBoardSize || RAW_BOARD_SIZE) / 8);
  const scale = tile / 1.22;
  const accentLight = pieceStyle.accent ?? '#d0a472';
  const accentDark = pieceStyle.blackAccent ?? accentLight;
  const piecePrototypes = { white: {}, black: {} };

  const buildForColor = (colorKey, accentHex) => {
    const colorStyle = pieceStyle[colorKey] ?? {};
    const materials = {
      base: makePieceMaterialFromStyle(colorStyle, { flatShading: true }),
      accent: makePieceMaterialFromStyle(colorStyle, { color: accentHex, flatShading: true })
    };
    piecePrototypes[colorKey].P = buildKenneyPiece('P', materials, scale, styleId);
    piecePrototypes[colorKey].R = buildKenneyPiece('R', materials, scale, styleId);
    piecePrototypes[colorKey].N = buildKenneyPiece('N', materials, scale, styleId);
    piecePrototypes[colorKey].B = buildKenneyPiece('B', materials, scale, styleId);
    piecePrototypes[colorKey].Q = buildKenneyPiece('Q', materials, scale, styleId);
    piecePrototypes[colorKey].K = buildKenneyPiece('K', materials, scale, styleId);
  };

  buildForColor('white', accentLight);
  buildForColor('black', accentDark);

  return { boardModel: null, piecePrototypes };
}

function buildPolygonalPiece(type, materials = {}, scale = 1, styleId = 'polygonalGraphite') {
  const baseMat = materials.base;
  const accentMat = materials.accent ?? baseMat;
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.72, 0.32, 10), baseMat);
  base.position.y = 0.16;
  g.add(base);

  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.48, 0.98, 9), baseMat);
  stalk.position.y = 0.98;

  if (type === 'P') {
    g.add(stalk);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), accentMat);
    cap.position.y = 1.42;
    g.add(cap);
  } else if (type === 'R') {
    g.add(stalk);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.62, 0.26, 8), accentMat);
    rim.position.y = 1.44;
    g.add(rim);
  } else if (type === 'N') {
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.4, 6, 10), baseMat);
    body.position.y = 1.22;
    body.rotation.z = -0.18;
    const crest = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.44, 8), accentMat);
    crest.position.set(-0.06, 1.6, 0);
    g.add(stalk, body, crest);
  } else if (type === 'B') {
    const taper = new THREE.Mesh(new THREE.ConeGeometry(0.48, 1.2, 9), baseMat);
    taper.position.y = 1.08;
    const slit = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.32, 0.12), accentMat);
    slit.position.y = 1.42;
    g.add(stalk, taper, slit);
  } else if (type === 'Q') {
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.66, 1.24, 10), baseMat);
    column.position.y = 1.08;
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.08, 8, 16), accentMat);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 1.6;
    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), accentMat);
    orb.position.y = 1.92;
    g.add(column, halo, orb);
  } else if (type === 'K') {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.7, 1.32, 10), baseMat);
    tower.position.y = 1.12;
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.46, 0.12), accentMat);
    crossV.position.y = 1.86;
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.12), accentMat);
    crossH.position.y = 1.86;
    g.add(tower, crossV, crossH);
  }

  return finalizePrototype(g, scale, styleId);
}

function buildPolygonalFallbackAssets(
  targetBoardSize = RAW_BOARD_SIZE,
  pieceStyle = POLYGONAL_GRAPHITE_STYLE,
  styleId = 'polygonalGraphite'
) {
  const tile = Math.max(0.001, (targetBoardSize || RAW_BOARD_SIZE) / 8);
  const scale = tile / 1.18;
  const accentLight = pieceStyle.accent ?? '#7ce3ff';
  const accentDark = pieceStyle.blackAccent ?? accentLight;
  const piecePrototypes = { white: {}, black: {} };

  const buildForColor = (colorKey, accentHex) => {
    const colorStyle = pieceStyle[colorKey] ?? {};
    const materials = {
      base: makePieceMaterialFromStyle({ ...colorStyle, flatShading: true }, { flatShading: true }),
      accent: makePieceMaterialFromStyle({ ...colorStyle, flatShading: true }, {
        color: accentHex,
        flatShading: true
      })
    };
    piecePrototypes[colorKey].P = buildPolygonalPiece('P', materials, scale, styleId);
    piecePrototypes[colorKey].R = buildPolygonalPiece('R', materials, scale, styleId);
    piecePrototypes[colorKey].N = buildPolygonalPiece('N', materials, scale, styleId);
    piecePrototypes[colorKey].B = buildPolygonalPiece('B', materials, scale, styleId);
    piecePrototypes[colorKey].Q = buildPolygonalPiece('Q', materials, scale, styleId);
    piecePrototypes[colorKey].K = buildPolygonalPiece('K', materials, scale, styleId);
  };

  buildForColor('white', accentLight);
  buildForColor('black', accentDark);

  return { boardModel: null, piecePrototypes };
}

async function resolveBeautifulGameAssets(targetBoardSize, extractor = extractBeautifulGameAssets) {
  const timeoutMs = 15000;
  const withTimeout = (promise) =>
    Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('ABeautifulGame load timed out')), timeoutMs)
      )
    ]);
  try {
    const gltf = await withTimeout(loadBeautifulGameSet());
    if (gltf?.scene) {
      const extractorFn = extractor || extractBeautifulGameAssets;
      const source = gltf.scene.userData?.beautifulGameSource;
      return extractorFn(gltf.scene, targetBoardSize, { source });
    }
  } catch (error) {
    console.warn('Chess Battle Royal: remote ABeautifulGame set failed, using textured fallbacks', error);
  }

  try {
    return applyLocalBeautifulGameMaterials(
      buildBeautifulGameFallback(targetBoardSize, BEAUTIFUL_GAME_THEME)
    );
  } catch (error) {
    console.warn('Chess Battle Royal: local ABeautifulGame fallback failed', error);
  }

  const fallbackOptions = {
    targetBoardSize,
    pieceStyle: BEAUTIFUL_GAME_PIECE_STYLE,
    assetScale: 1
  };

  const texturedFallbacks = [
    { urls: STAUNTON_SET_URLS, name: 'Staunton', styleId: 'stauntonFallback' },
    { urls: KENNEY_SET_URLS, name: 'BoardGameKit', styleId: 'kenneyFallback' },
    { urls: POLYGONAL_SET_URLS, name: 'Polygonal', styleId: 'polygonalFallback' }
  ];

  for (const set of texturedFallbacks) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await loadPieceSetFromUrls(set.urls, {
        ...fallbackOptions,
        styleId: set.styleId,
        name: set.name
      });
    } catch (error) {
      console.warn(`Chess Battle Royal: ${set.name} fallback failed`, error);
    }
  }

  throw new Error('No textured chess set could be loaded');
}

async function resolveBeautifulGameTouchAssets(targetBoardSize) {
  return resolveBeautifulGameAssets(
    targetBoardSize,
    (scene, size, options) => extractBeautifulGameTouchAssets(scene, size, options)
  );
}

function cloneWithShadows(object) {
  const clone = object.clone(true);
  clone.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return clone;
}

function applyMaterialSettingsWithSRGB(node) {
  if (!node?.isMesh) return;
  node.castShadow = true;
  node.receiveShadow = true;
  const materials = Array.isArray(node.material) ? node.material : [node.material];
  materials.forEach((mat, index) => {
    if (!mat) return;
    const cloned = mat.clone ? mat.clone() : mat;
    if (Array.isArray(node.material)) {
      node.material[index] = cloned;
    } else {
      node.material = cloned;
    }
    if (cloned.map) applySRGBColorSpace(cloned.map);
    if (cloned.emissiveMap) applySRGBColorSpace(cloned.emissiveMap);
  });
}

function extractChessSetAssets(scene, options = {}) {
  const {
    targetBoardSize,
    pieceStyle = BEAUTIFUL_GAME_PIECE_STYLE,
    styleId = 'customPieces',
    assetScale = 1,
    name = 'ChessSet'
  } = options;
  if (!scene) return { boardModel: null, piecePrototypes: null };
  const root = scene.clone(true);
  root.traverse(applyMaterialSettingsWithSRGB);
  root.updateMatrixWorld(true);

  const piecePrototypes = { white: {}, black: {} };
  const typeRegex = {
    K: /king/i,
    Q: /queen/i,
    R: /rook/i,
    B: /bishop/i,
    N: /knight/i,
    P: /pawn/i
  };

  const pickMaterialColor = (node) => {
    let color = null;
    node.traverse((child) => {
      if (color || !child.isMesh) return;
      const mat = Array.isArray(child.material) ? child.material[0] : child.material;
      if (mat?.color instanceof THREE.Color) {
        color = mat.color;
      }
    });
    return color;
  };

  const detectColor = (node) => {
    const named = detectPieceColor(node);
    if (named) return named;

    const color = pickMaterialColor(node);
    if (color) {
      const luminance = (color.r + color.g + color.b) / 3;
      return luminance >= 0.45 ? 'white' : 'black';
    }

    const worldPos = new THREE.Vector3();
    try {
      node.getWorldPosition?.(worldPos);
      return worldPos.z >= 0 ? 'white' : 'black';
    } catch (error) {
      console.warn('Chess Battle Royal: fallback color detection failed', error);
    }
    return null;
  };

  const detectType = (node) => {
    let current = node;
    while (current) {
      const name = current.name || '';
      for (const [key, regex] of Object.entries(typeRegex)) {
        if (regex.test(name)) return key;
      }
      const fromSimpleName = pieceTypeFromName(name);
      if (fromSimpleName) return fromSimpleName;
      current = current.parent;
    }
    return null;
  };

  const setPrototype = (node, color, type) => {
    if (!color || !type || piecePrototypes[color][type]) return;
    node.userData = { ...(node.userData || {}), __beautifulGameSourcePiece: true };
    const clone = cloneWithShadows(node);
    piecePrototypes[color][type] = clone;
  };

  const registerPrototype = (node) => {
    const roughType = pieceTypeFromName(node.name);
    if (!roughType) return;
    const color = detectColor(node);
    const type = detectType(node) || roughType;
    if (!color || !type) return;
    const ascended = ascendWhile(node, (parent) => pieceTypeFromName(parent.name) === type);
    setPrototype(ascended || node, color, type);
  };

  const meshEntries = [];
  root.traverse((node) => {
    if (!node) return;
    if (node.isMesh) {
      const bounds = new THREE.Box3().setFromObject(node);
      const size = new THREE.Vector3();
      bounds.getSize(size);
      const center = new THREE.Vector3();
      bounds.getCenter(center);
      meshEntries.push({ node, bounds, size, center });
    }
    registerPrototype(node);
  });

  const missingTypes = () =>
    ['white', 'black'].flatMap((color) =>
      Object.keys(typeRegex)
        .filter((type) => !piecePrototypes[color][type])
        .map((type) => `${color}-${type}`)
    );

  if (missingTypes().length > 0 && meshEntries.length > 0) {
    const minX = Math.min(...meshEntries.map((m) => m.center.x));
    const maxX = Math.max(...meshEntries.map((m) => m.center.x));
    const minZ = Math.min(...meshEntries.map((m) => m.center.z));
    const maxZ = Math.max(...meshEntries.map((m) => m.center.z));
    const spanX = Math.max(0.001, maxX - minX);
    const spanZ = Math.max(0.001, maxZ - minZ);
    const tileX = spanX / 7;
    const tileZ = spanZ / 7;
    const tile = (tileX + tileZ) / 2;
    const sizeThreshold = Math.max(tile * 2.5, Math.max(spanX, spanZ) * 0.15);

    const fenBoard = parseFEN(START_FEN);
    const expectAt = new Map();
    for (let r = 0; r < 8; r += 1) {
      for (let c = 0; c < 8; c += 1) {
        const p = fenBoard[r][c];
        if (!p) continue;
        expectAt.set(`${r}-${c}`, { color: p.w ? 'white' : 'black', type: p.t });
      }
    }

    const toGrid = (pos) => {
      const c = clamp(Math.round((pos.x - minX) / tileX), 0, 7);
      const r = clamp(Math.round((pos.z - minZ) / tileZ), 0, 7);
      return { r, c };
    };

    meshEntries.forEach(({ node, size, center }) => {
      const largest = Math.max(size.x, size.y, size.z);
      if (largest > sizeThreshold) return;
      const { r, c } = toGrid(center);
      const expected = expectAt.get(`${r}-${c}`);
      if (!expected) return;
      setPrototype(node, expected.color, expected.type);
    });
  }

  const boardModel = cloneWithShadows(root);
  boardModel.name = name;
  const nodesToCull = [];
  boardModel.traverse((node) => {
    if (!node) return;
    const flaggedAsPiece = node.userData?.__beautifulGameSourcePiece;
    const type = detectType(node) || pieceTypeFromName(node.name);
    if (flaggedAsPiece || type) {
      nodesToCull.push(node);
    }
  });
  nodesToCull.forEach((node) => {
    if (node?.parent) node.parent.remove(node);
  });

  const size = new THREE.Vector3();
  const box = new THREE.Box3().setFromObject(boardModel);
  box.getSize(size);
  const largest = Math.max(size.x || 1, size.z || 1);
  const baseScale = targetBoardSize > 0 ? targetBoardSize / largest : 1;
  const totalScale = baseScale * assetScale;
  boardModel.scale.setScalar(totalScale);
  const centeredBox = new THREE.Box3().setFromObject(boardModel);
  const center = new THREE.Vector3();
  centeredBox.getCenter(center);
  boardModel.position.set(-center.x, -centeredBox.min.y + (BOARD.baseH + 0.02), -center.z);

  const fallbackTile = Math.max(0.001, (targetBoardSize || RAW_BOARD_SIZE) / 8);
  const fallbackAccent = pieceStyle.accent ?? '#caa472';
  const buildMissingPrototype = (colorKey, type) => {
    const pieceColor = pieceStyle[colorKey]?.color ?? '#ffffff';
    const accent =
      colorKey === 'black' ? pieceStyle.blackAccent ?? fallbackAccent : fallbackAccent;
    const proto = buildBeautifulGamePiece(type, pieceColor, accent, fallbackTile / 0.9);
    proto.userData = { ...(proto.userData || {}), __beautifulGameSourcePiece: true };
    proto.traverse((child) => {
      if (!child.isMesh) return;
      child.userData = { ...(child.userData || {}), __beautifulGameSourcePiece: true };
    });
    piecePrototypes[colorKey][type] = proto;
  };

  ['white', 'black'].forEach((colorKey) => {
    Object.keys(typeRegex).forEach((type) => {
      if (!piecePrototypes[colorKey][type]) {
        buildMissingPrototype(colorKey, type);
      }
    });
  });

  Object.values(piecePrototypes).forEach((byColor) => {
    Object.keys(byColor).forEach((key) => {
      const proto = byColor[key];
      const protoBox = new THREE.Box3().setFromObject(proto);
      const protoCenter = new THREE.Vector3();
      protoBox.getCenter(protoCenter);
      proto.position.sub(protoCenter);
      proto.position.y -= protoBox.min.y;
      proto.scale.multiplyScalar(totalScale);
      proto.userData = { ...(proto.userData || {}), __pieceStyleId: styleId };
    });
  });

  return { boardModel, piecePrototypes };
}

function extractBeautifulGameAssets(scene, targetBoardSize, options = {}) {
  const assets = extractChessSetAssets(scene, {
    targetBoardSize,
    pieceStyle: BEAUTIFUL_GAME_PIECE_STYLE,
    styleId: 'beautifulGame',
    assetScale: BEAUTIFUL_GAME_ASSET_SCALE,
    name: 'ABeautifulGame'
  });
  if (options?.source === 'local') {
    return applyLocalBeautifulGameMaterials(assets);
  }
  return assets;
}

function extractBeautifulGameTouchAssets(scene, targetBoardSize, options = {}) {
  if (!scene) return { boardModel: null, piecePrototypes: null };

  const root = scene.clone(true);
  root.traverse(applyMaterialSettingsWithSRGB);

  const pool = {
    white: { P: null, R: null, N: null, B: null, Q: null, K: null },
    black: { P: null, R: null, N: null, B: null, Q: null, K: null }
  };

  root.traverse((node) => {
    const type = pieceTypeFromName(node.name);
    if (!type) return;
    const color = detectPieceColor(node);
    if (!color) return;
    const ascended = ascendWhile(node, (parent) => pieceTypeFromName(parent.name) === type);
    const bucket = color === 'black' ? pool.black : pool.white;
    if (!bucket[type]) {
      bucket[type] = ascended;
    }
  });

  const boardModel = root.clone(true);
  boardModel.traverse(applyMaterialSettingsWithSRGB);
  const nodesToCull = [];
  boardModel.traverse((node) => {
    if (pieceTypeFromName(node.name)) {
      nodesToCull.push(node);
    }
  });
  nodesToCull.forEach((node) => {
    if (node?.parent) node.parent.remove(node);
  });

  const boardBox = new THREE.Box3().setFromObject(boardModel);
  const boardSize = boardBox.getSize(new THREE.Vector3());
  const largest = Math.max(boardSize.x || 1, boardSize.z || 1);
  const targetSize = Math.max(targetBoardSize || RAW_BOARD_SIZE, 0.001);
  const totalScale = targetSize / largest;
  boardModel.scale.multiplyScalar(totalScale);
  const scaledBox = new THREE.Box3().setFromObject(boardModel);
  const boardCenter = new THREE.Vector3();
  scaledBox.getCenter(boardCenter);
  boardModel.position.set(-boardCenter.x, -scaledBox.min.y + (BOARD.baseH + 0.02), -boardCenter.z);
  boardModel.name = 'ABeautifulGameTouch';

  const piecePrototypes = { white: {}, black: {} };
  const fallbackTile = Math.max(0.001, targetSize / 8);
  const buildPrototype = (colorKey, type) => {
    const source = colorKey === 'black' ? pool.black[type] : pool.white[type];
    if (source) {
      const proto = source.clone(true);
      proto.traverse(applyMaterialSettingsWithSRGB);
      proto.scale.multiplyScalar(totalScale);
      const protoBox = new THREE.Box3().setFromObject(proto);
      const protoCenter = protoBox.getCenter(new THREE.Vector3());
      proto.position.sub(protoCenter);
      proto.position.y -= protoBox.min.y;
      proto.userData = { ...(proto.userData || {}), __pieceStyleId: 'beautifulGameTouch', __pieceColor: colorKey };
      return proto;
    }
    const pieceStyle = BEAUTIFUL_GAME_PIECE_STYLE[colorKey] || BEAUTIFUL_GAME_PIECE_STYLE.white;
    const accent =
      colorKey === 'black'
        ? BEAUTIFUL_GAME_PIECE_STYLE.blackAccent || BEAUTIFUL_GAME_PIECE_STYLE.accent
        : BEAUTIFUL_GAME_PIECE_STYLE.accent;
    const fallback = buildBeautifulGamePiece(type, pieceStyle.color, accent, fallbackTile / 0.9);
    fallback.userData = { ...(fallback.userData || {}), __pieceStyleId: 'beautifulGameTouch', __pieceColor: colorKey };
    return fallback;
  };

  ['P', 'R', 'N', 'B', 'Q', 'K'].forEach((type) => {
    piecePrototypes.white[type] = buildPrototype('white', type);
    piecePrototypes.black[type] = buildPrototype('black', type);
  });

  const assets = { boardModel, piecePrototypes };
  if (options?.source === 'local') {
    return applyLocalBeautifulGameMaterials(assets);
  }
  return assets;
}

function disposeObject3D(object) {
  if (!object) return;
  object.traverse((node) => {
    if (node.isMesh) {
      node.geometry?.dispose?.();
      if (Array.isArray(node.material)) {
        node.material.forEach((m) => m?.dispose?.());
      } else {
        node.material?.dispose?.();
      }
    }
  });
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

function createPieceMaterials(styleOption = BEAUTIFUL_GAME_PIECE_STYLE) {
  const option = styleOption || BEAUTIFUL_GAME_PIECE_STYLE || {};
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
const torus = (r, tube, material, arc = Math.PI * 2, opts = {}) =>
  new THREE.Mesh(new THREE.TorusGeometry(r, tube, 12, 28, arc), ensureMaterial(material, opts));

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
  const g = new THREE.Group();
  const foot = tagPieceMesh(cyl(1.35, 1.55, 0.45, baseMat));
  foot.position.y = PIECE_Y;
  g.add(foot);
  const shank = tagPieceMesh(cyl(1.15, 0.95, 1.2, baseMat));
  shank.position.y = PIECE_Y + 0.95;
  g.add(shank);
  const collar = tagPieceMesh(torus(0.95, 0.13, baseMat));
  collar.rotation.x = Math.PI / 2;
  collar.position.y = PIECE_Y + 1.75;
  g.add(collar);
  const head = tagPieceMesh(sph(0.72, baseMat));
  head.position.y = PIECE_Y + 2.35;
  g.add(head);
  return g;
}

function buildRook(materials = {}) {
  const baseMat = materials.base;
  const g = new THREE.Group();
  const foot = tagPieceMesh(cyl(1.35, 1.7, 0.55, baseMat));
  foot.position.y = PIECE_Y;
  g.add(foot);
  const body = tagPieceMesh(cyl(1.2, 1.3, 2.15, baseMat));
  body.position.y = PIECE_Y + 1.42;
  g.add(body);
  const belt = tagPieceMesh(torus(1.05, 0.12, baseMat));
  belt.rotation.x = Math.PI / 2;
  belt.position.y = PIECE_Y + 1.95;
  g.add(belt);
  const crown = new THREE.Group();
  const ring = tagPieceMesh(cyl(1.25, 1.1, 0.35, baseMat));
  ring.position.y = PIECE_Y + 2.6;
  crown.add(ring);
  const crenels = 4;
  for (let i = 0; i < crenels; i++) {
    const chunk = tagPieceMesh(box(0.5, 0.55, 0.5, baseMat));
    const angle = i * ((Math.PI * 2) / crenels);
    chunk.position.set(Math.cos(angle) * 0.8, PIECE_Y + 2.95, Math.sin(angle) * 0.8);
    crown.add(chunk);
  }
  g.add(crown);
  return g;
}

function buildKnight(materials = {}) {
  const baseMat = materials.base;
  const g = new THREE.Group();
  const foot = tagPieceMesh(cyl(1.35, 1.65, 0.55, baseMat));
  foot.position.y = PIECE_Y;
  g.add(foot);
  const body = tagPieceMesh(cyl(1.0, 1.25, 1.65, baseMat));
  body.position.y = PIECE_Y + 1.15;
  g.add(body);
  const head = new THREE.Group();
  const neck = tagPieceMesh(cyl(0.75, 0.95, 0.9, baseMat));
  neck.rotation.z = 0.18;
  neck.position.set(0.05, PIECE_Y + 2.05, 0.25);
  head.add(neck);
  const face = tagPieceMesh(box(1.05, 1.15, 0.7, baseMat));
  face.position.set(0.15, PIECE_Y + 2.75, 0.35);
  head.add(face);
  const muzzle = tagPieceMesh(box(0.7, 0.45, 0.7, baseMat));
  muzzle.position.set(0.35, PIECE_Y + 3.05, 0.4);
  head.add(muzzle);
  const ear1 = tagPieceMesh(cone(0.22, 0.45, baseMat));
  ear1.position.set(0.4, PIECE_Y + 3.25, 0.05);
  head.add(ear1);
  const ear2 = tagPieceMesh(cone(0.22, 0.45, baseMat));
  ear2.position.set(-0.05, PIECE_Y + 3.2, 0.05);
  head.add(ear2);
  const mane = tagPieceMesh(box(0.25, 1.3, 0.95, baseMat));
  mane.position.set(-0.35, PIECE_Y + 2.55, -0.05);
  head.add(mane);
  g.add(head);
  return g;
}

function buildBishop(materials = {}) {
  const baseMat = materials.base;
  const accentMat = materials.accent ?? baseMat;
  const g = new THREE.Group();
  const foot = tagPieceMesh(cyl(1.25, 1.7, 0.55, baseMat));
  foot.position.y = PIECE_Y;
  g.add(foot);
  const body = tagPieceMesh(cyl(0.95, 1.15, 2.2, baseMat));
  body.position.y = PIECE_Y + 1.35;
  g.add(body);
  const collar = tagPieceMesh(torus(0.9, 0.12, baseMat));
  collar.rotation.x = Math.PI / 2;
  collar.position.y = PIECE_Y + 2.1;
  g.add(collar);
  const mitre = tagPieceMesh(cone(0.95, 1.35, baseMat));
  mitre.position.y = PIECE_Y + 2.5;
  g.add(mitre);
  const slit = tagPieceMesh(box(0.12, 0.9, 0.28, accentMat), 'accent');
  slit.position.y = PIECE_Y + 2.55;
  g.add(slit);
  return g;
}

function buildQueen(materials = {}) {
  const baseMat = materials.base;
  const accentMat = materials.accent ?? baseMat;
  const g = new THREE.Group();
  const base = tagPieceMesh(cyl(1.45, 1.9, 0.6, baseMat));
  base.position.y = PIECE_Y;
  g.add(base);
  const midBase = tagPieceMesh(cyl(1.35, 1.55, 0.45, baseMat));
  midBase.position.y = PIECE_Y + 0.6;
  g.add(midBase);
  const body = tagPieceMesh(cyl(1.08, 1.28, 2.45, baseMat));
  body.position.y = PIECE_Y + 1.8;
  g.add(body);
  const crown = new THREE.Group();
  const ring = tagPieceMesh(cyl(1.25, 1.15, 0.32, accentMat), 'accent');
  ring.position.y = PIECE_Y + 3.15;
  crown.add(ring);
  const spikes = 8;
  for (let i = 0; i < spikes; i++) {
    const spike = tagPieceMesh(cone(0.16, 0.65, accentMat), 'accent');
    const angle = i * ((Math.PI * 2) / spikes);
    spike.position.set(Math.cos(angle) * 0.95, PIECE_Y + 3.65, Math.sin(angle) * 0.95);
    spike.rotation.x = -Math.PI / 2;
    crown.add(spike);
  }
  const orb = tagPieceMesh(sph(0.28, accentMat), 'accent');
  orb.position.y = PIECE_Y + 4.05;
  crown.add(orb);
  g.add(crown);
  return g;
}

function buildKing(materials = {}) {
  const baseMat = materials.base;
  const accentMat = materials.accent ?? baseMat;
  const g = new THREE.Group();
  const base = tagPieceMesh(cyl(1.45, 1.95, 0.6, baseMat));
  base.position.y = PIECE_Y;
  g.add(base);
  const body = tagPieceMesh(cyl(1.12, 1.32, 2.85, baseMat));
  body.position.y = PIECE_Y + 1.9;
  g.add(body);
  const collar = tagPieceMesh(torus(1.05, 0.12, baseMat));
  collar.rotation.x = Math.PI / 2;
  collar.position.y = PIECE_Y + 2.6;
  g.add(collar);
  const orb = tagPieceMesh(sph(0.58, accentMat), 'accent');
  orb.position.y = PIECE_Y + 3.25;
  g.add(orb);
  const crossV = tagPieceMesh(box(0.22, 0.95, 0.22, accentMat), 'accent');
  crossV.position.y = PIECE_Y + 3.95;
  g.add(crossV);
  const crossH = tagPieceMesh(box(0.95, 0.22, 0.22, accentMat), 'accent');
  crossH.position.y = PIECE_Y + 3.95;
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
  const moveSoundRef = useRef(null);
  const checkSoundRef = useRef(null);
  const mateSoundRef = useRef(null);
  const lastBeepRef = useRef({ white: null, black: null });
  const zoomRef = useRef({});
  const controlsRef = useRef(null);
  const fitRef = useRef(() => {});
  const arenaRef = useRef(null);
  const clearHighlightsRef = useRef(() => {});
  const cameraViewRef = useRef(null);
  const viewModeRef = useRef('2d');
  const cameraTweenRef = useRef(0);
  const settingsRef = useRef({ showHighlights: true, soundEnabled: true, moveMode: 'click' });
  const [appearance, setAppearance] = useState(() => {
    if (typeof window === 'undefined') return { ...DEFAULT_APPEARANCE };
    try {
      const stored = window.localStorage?.getItem(APPEARANCE_STORAGE_KEY);
      if (stored) {
        return normalizeAppearance(JSON.parse(stored));
      }
    } catch {}
    return { ...DEFAULT_APPEARANCE };
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
  const [moveMode, setMoveMode] = useState(() => {
    if (typeof window === 'undefined') return 'click';
    try {
      const stored = window.localStorage?.getItem(MOVE_MODE_STORAGE_KEY);
      if (stored === 'drag' || stored === 'click') return stored;
    } catch {}
    return 'click';
  });
  const [seatAnchors, setSeatAnchors] = useState([]);
  const [viewMode, setViewMode] = useState('2d');
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

  useEffect(() => {
    viewModeRef.current = viewMode;
    cameraViewRef.current?.setMode(viewMode);
  }, [viewMode]);

  const renderCustomizationPreview = useCallback((key, option) => {
    if (!option) return null;
    if (key === 'boardColor') {
      return (
        <div className="w-full overflow-hidden rounded-lg border border-white/10">
          <div className="grid grid-cols-2" style={{ backgroundColor: option.frameDark }}>
            {[0, 1, 2, 3].map((idx) => (
              // eslint-disable-next-line react/no-array-index-key
              <div key={idx} className="h-8" style={{ background: idx % 2 === 0 ? option.light : option.dark }} />
            ))}
          </div>
        </div>
      );
    }
    if (key === 'pieceStyle') {
      return (
        <div className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/5 p-2">
          <span
            className="h-6 w-6 rounded-full border border-white/20 shadow"
            style={{ background: option.white?.color || '#f5f5f7' }}
          />
          <span
            className="h-6 w-6 rounded-full border border-white/20 shadow"
            style={{ background: option.black?.color || '#111827' }}
          />
          <span
            className="h-3 w-8 rounded-full border border-white/10"
            style={{ background: option.accent || option.blackAccent?.color || '#caa472' }}
          />
        </div>
      );
    }
    if (key === 'tableWood') {
      const preset = WOOD_PRESETS_BY_ID[option.presetId] ?? WOOD_FINISH_PRESETS[0];
      const color = `#${hslToHexNumber(preset.hue, preset.sat, preset.light).toString(16).padStart(6, '0')}`;
      return <div className="h-10 w-full rounded-lg border border-white/10" style={{ background: color }} />;
    }
    if (key === 'tableCloth') {
      return (
        <div
          className="h-10 w-full rounded-lg border border-white/10"
          style={{ background: `linear-gradient(180deg, ${option.feltTop}, ${option.feltBottom})` }}
        />
      );
    }
    if (key === 'tableBase') {
      return (
        <div
          className="h-10 w-full rounded-lg border border-white/10"
          style={{ background: `linear-gradient(135deg, ${option.baseColor}, ${option.trimColor})` }}
        />
      );
    }
    if (key === 'chairColor') {
      return (
        <div
          className="flex h-10 w-full items-center justify-between rounded-lg border border-white/10 px-2"
          style={{ background: option.primary }}
        >
          <span className="h-6 w-6 rounded-full border border-white/30" style={{ background: option.accent }} />
          <span className="h-4 w-8 rounded-full border border-white/20" style={{ background: option.legColor }} />
        </div>
      );
    }
    if (key === 'tableShape') {
      return (
        <div className="flex h-10 w-full items-center justify-center rounded-lg border border-white/10 bg-white/5">
          <div
            className="h-7 w-14 bg-sky-300/60"
            style={{ ...(option.preview || {}), border: '1px solid rgba(255,255,255,0.35)' }}
          />
        </div>
      );
    }
    return null;
  }, []);

  const resetAppearance = useCallback(() => {
    setAppearance({ ...DEFAULT_APPEARANCE });
    if (typeof window !== 'undefined') {
      try {
        window.localStorage?.removeItem(APPEARANCE_STORAGE_KEY);
      } catch {}
    }
  }, []);

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

  useEffect(() => {
    appearanceRef.current = appearance;
    if (typeof window !== 'undefined') {
      try {
        window.localStorage?.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(appearance));
      } catch {}
    }
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
    settingsRef.current.moveMode = moveMode;
    if (typeof window === 'undefined') return;
    try {
      window.localStorage?.setItem(MOVE_MODE_STORAGE_KEY, moveMode);
    } catch {}
  }, [moveMode]);

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
    if (moveSoundRef.current) {
      moveSoundRef.current.volume = soundEnabled ? volume : 0;
      if (!soundEnabled) {
        try {
          moveSoundRef.current.pause();
          moveSoundRef.current.currentTime = 0;
        } catch {}
      }
    }
    if (checkSoundRef.current) {
      checkSoundRef.current.volume = soundEnabled ? volume : 0;
      if (!soundEnabled) {
        try {
          checkSoundRef.current.pause();
          checkSoundRef.current.currentTime = 0;
        } catch {}
      }
    }
    if (mateSoundRef.current) {
      mateSoundRef.current.volume = soundEnabled ? volume : 0;
      if (!soundEnabled) {
        try {
          mateSoundRef.current.pause();
          mateSoundRef.current.currentTime = 0;
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
      if (moveSoundRef.current) {
        moveSoundRef.current.volume = settingsRef.current.soundEnabled ? volume : 0;
      }
      if (checkSoundRef.current) {
        checkSoundRef.current.volume = settingsRef.current.soundEnabled ? volume : 0;
      }
      if (mateSoundRef.current) {
        mateSoundRef.current.volume = settingsRef.current.soundEnabled ? volume : 0;
      }
    };
    window.addEventListener('gameVolumeChanged', handleVolumeChange);
    return () => {
      window.removeEventListener('gameVolumeChanged', handleVolumeChange);
    };
  }, []);

  useEffect(() => {
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
    if (arena.boardModel) {
      arena.boardModel.visible = false;
      arena.setProceduralBoardVisible?.(true);
    }
    const pieceSetOption = PIECE_STYLE_OPTIONS[normalized.pieceStyle] ?? PIECE_STYLE_OPTIONS[0];
    const nextPieceSetId = pieceSetOption?.id ?? palette.pieceSetId ?? DEFAULT_PIECE_SET_ID;
    const woodOption = TABLE_WOOD_OPTIONS[normalized.tableWood] ?? TABLE_WOOD_OPTIONS[0];
    const clothOption = TABLE_CLOTH_OPTIONS[normalized.tableCloth] ?? TABLE_CLOTH_OPTIONS[0];
    const baseOption = TABLE_BASE_OPTIONS[normalized.tableBase] ?? TABLE_BASE_OPTIONS[0];
    const chairOption = CHAIR_COLOR_OPTIONS[normalized.chairColor] ?? CHAIR_COLOR_OPTIONS[0];
    const { option: shapeOption, rotationY } = getEffectiveShapeConfig(normalized.tableShape);
    const boardTheme = palette.board ?? BEAUTIFUL_GAME_THEME;
    const pieceStyleOption = palette.pieces ?? DEFAULT_PIECE_STYLE;
    const pieceSetLoader =
      pieceSetOption?.loader ??
      ((size) => buildSculptedAssets(size, SCULPTED_DRAG_STYLE, DEFAULT_PIECE_SET_ID));

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
      const chairTheme = mapChairOptionToTheme(chairOption);
      const currentId = arena.chairMaterials?.chairId ?? 'default';
      const nextId = chairTheme.chairId;
      if (currentId !== nextId) {
        applyChairThemeMaterials(arena, chairTheme);
      }
    }

    const shouldSwapPieces = !arena.activePieceSetId || nextPieceSetId !== arena.activePieceSetId;
    if (shouldSwapPieces) {
      pieceSetLoader(RAW_BOARD_SIZE)
        .then((assets) => {
          if (!arenaRef.current) return;
          arenaRef.current.applyPieceSetAssets?.(assets, nextPieceSetId);
        })
        .catch((error) => {
          console.warn('Chess Battle Royal: failed to swap piece set', error);
        });
    }

    if (arena.boardMaterials) {
      const usingExternalBoard = Boolean(arena.boardModel && !arena.usingProceduralBoard);
      const { base: baseMat, top: topMat, coord: coordMat, tiles } = arena.boardMaterials;
      baseMat?.color?.set?.(boardTheme.frameDark);
      baseMat.roughness = boardTheme.frameRoughness;
      baseMat.metalness = boardTheme.frameMetalness;
      baseMat.transparent = usingExternalBoard;
      baseMat.opacity = usingExternalBoard ? Math.min(baseMat.opacity ?? 0.02, 0.08) : 1;
      baseMat.depthWrite = !usingExternalBoard;
      topMat?.color?.set?.(boardTheme.frameLight);
      topMat.roughness = boardTheme.surfaceRoughness;
      topMat.metalness = boardTheme.surfaceMetalness;
      topMat.transparent = usingExternalBoard;
      topMat.opacity = usingExternalBoard ? Math.min(topMat.opacity ?? 0.02, 0.08) : 1;
      topMat.depthWrite = !usingExternalBoard;
      coordMat?.color?.set?.(palette.accent);
      tiles?.forEach((tileMesh) => {
        const isDark = (tileMesh.userData?.r + tileMesh.userData?.c) % 2 === 1;
        tileMesh.material.color.set(isDark ? boardTheme.dark : boardTheme.light);
        tileMesh.material.roughness = boardTheme.surfaceRoughness;
        tileMesh.material.metalness = boardTheme.surfaceMetalness;
        tileMesh.material.transparent = usingExternalBoard;
        tileMesh.material.opacity = usingExternalBoard ? Math.min(tileMesh.material.opacity ?? 0.08, 0.12) : 1;
        tileMesh.material.depthWrite = !usingExternalBoard;
      });
    }

    if (arena.allPieceMeshes) {
      const nextPieceMaterials = createPieceMaterials(pieceStyleOption);
      arena.allPieceMeshes.forEach((group) => {
        const meshStyleId = group.userData?.__pieceStyleId;
        if (meshStyleId && PRESERVE_NATIVE_PIECE_IDS.has(meshStyleId)) return;
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
    let cancelled = false;
    let scene = null;
    let camera = null;
    let renderer = null;
    let controls = null;
    let ray = null;
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
    moveSoundRef.current = new Audio(MOVE_SOUND_URL);
    moveSoundRef.current.volume = baseVolume;
    checkSoundRef.current = new Audio(CHECK_SOUND_URL);
    checkSoundRef.current.volume = baseVolume;
    mateSoundRef.current = new Audio(CHECKMATE_SOUND_URL);
    mateSoundRef.current.volume = baseVolume;

    let stopCameraTween = () => {};
    let onResize = null;
    let onClick = null;

    const setup = async () => {

    const normalizedAppearance = normalizeAppearance(appearanceRef.current);
    const palette = createChessPalette(normalizedAppearance);
    paletteRef.current = palette;
    const boardTheme = palette.board ?? BEAUTIFUL_GAME_THEME;
    const pieceStyleOption = palette.pieces ?? DEFAULT_PIECE_STYLE;
    const pieceSetOption = PIECE_STYLE_OPTIONS[normalizedAppearance.pieceStyle] ?? PIECE_STYLE_OPTIONS[0];
    const initialPieceSetId = pieceSetOption?.id ?? DEFAULT_PIECE_SET_ID;
    const pieceSetLoader =
      pieceSetOption?.loader ??
      ((size) => buildSculptedAssets(size, SCULPTED_DRAG_STYLE, DEFAULT_PIECE_SET_ID));
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
    const pieceSetPromise = pieceSetLoader(RAW_BOARD_SIZE);
    const playAudio = (audioRef) => {
      if (!audioRef?.current || !settingsRef.current.soundEnabled) return;
      try {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      } catch {}
    };
    const playMoveSound = () => playAudio(moveSoundRef);
    const playCheckSound = () => playAudio(checkSoundRef);
    const playMateSound = () => playAudio(mateSoundRef);
    const chairTheme = mapChairOptionToTheme(chairOption);
    const chairBuild = await buildChessChairTemplate(chairTheme);
    if (cancelled) return;
    const chairTemplate = chairBuild?.chairTemplate ?? null;
    const chairMaterials = chairBuild?.materials ?? null;
    applyChairThemeMaterials({ chairMaterials }, chairTheme);
    disposers.push(() => {
      disposeChessChairMaterials(chairMaterials);
    });

    // ----- Build scene -----
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    applyRendererSRGB(renderer);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.85;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
    scene.background = new THREE.Color(0x0b0f16);

    const ambient = new THREE.AmbientLight(0xffffff, 0.35);
    scene.add(ambient);

    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(6, 8, 5);
    key.castShadow = true;
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xffffff, 0.65);
    fill.position.set(-5, 5.5, 3);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffffff, 0.9);
    rim.position.set(0, 6, -6);
    scene.add(rim);

    const spot = new THREE.SpotLight(0xffffff, 0.8, 0, Math.PI / 4, 0.35, 1.1);
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

    function makeChair(index) {
      const g = new THREE.Group();
      if (chairTemplate) {
        const chairModel = chairTemplate.clone(true);
        g.add(chairModel);
      }

      const avatarAnchor = new THREE.Object3D();
      avatarAnchor.position.set(0, AVATAR_ANCHOR_HEIGHT, 0);
      avatarAnchor.userData = { index };
      g.add(avatarAnchor);

      g.scale.setScalar(CHAIR_SCALE);
      return {
        group: g,
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
    const cameraBackOffset = isPortrait ? 2.55 : 1.78;
    const cameraForwardOffset = isPortrait ? 0.08 : 0.2;
    const cameraHeightOffset = isPortrait ? 1.72 : 1.34;
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
    controls.maxDistance = CAMERA_SAFE_MAX_RADIUS;
    controls.minPolarAngle = CAMERA_PULL_FORWARD_MIN;
    controls.maxPolarAngle = CAM.phiMax;
    controls.target.copy(boardLookTarget);
    controls.update();
    controlsRef.current = controls;

    stopCameraTween = () => {
      if (cameraTweenRef.current) {
        cancelAnimationFrame(cameraTweenRef.current);
        cameraTweenRef.current = 0;
      }
    };

    const applyCameraSpherical = (spherical) => {
      const pos = new THREE.Vector3().setFromSpherical(spherical);
      camera.position.copy(boardLookTarget).add(pos);
      camera.lookAt(boardLookTarget);
      controls.update();
    };

    const animateCameraTo = (targetSpherical, duration = 420) => {
      stopCameraTween();
      const start = performance.now();
      const from = new THREE.Spherical().setFromVector3(
        camera.position.clone().sub(boardLookTarget)
      );
      const tick = (now) => {
        const t = clamp01((now - start) / duration);
        const eased = t * t * (3 - 2 * t);
        const current = new THREE.Spherical(
          THREE.MathUtils.lerp(from.radius, targetSpherical.radius, eased),
          THREE.MathUtils.lerp(from.phi, targetSpherical.phi, eased),
          THREE.MathUtils.lerp(from.theta, targetSpherical.theta, eased)
        );
        applyCameraSpherical(current);
        if (t < 1) {
          cameraTweenRef.current = requestAnimationFrame(tick);
        } else {
          cameraTweenRef.current = 0;
        }
      };
      cameraTweenRef.current = requestAnimationFrame(tick);
    };

    const cameraMemory = { last3d: null };

    const setViewModeInternal = (mode) => {
      if (!controls) return;
      const current = new THREE.Spherical().setFromVector3(
        camera.position.clone().sub(boardLookTarget)
      );
      const theta = Number.isFinite(current.theta) ? current.theta : -Math.PI / 4;

      const initialRadius = clamp(
        CAMERA_BASE_RADIUS * ARENA_CAMERA_DEFAULTS.initialRadiusFactor * 1.24,
        CAM.minR,
        CAMERA_SAFE_MAX_RADIUS
      );
      const default3d = new THREE.Spherical(initialRadius, CAMERA_DEFAULT_PHI, theta);

      if (mode === '2d') {
        cameraMemory.last3d = current;
        controls.enableRotate = false;
        controls.minPolarAngle = CAMERA_TOPDOWN_LOCK;
        controls.maxPolarAngle = CAMERA_TOPDOWN_LOCK;
        controls.minDistance = CAMERA_TOPDOWN_MIN_RADIUS;
        controls.maxDistance = CAMERA_TOPDOWN_MAX_RADIUS;
        const aspect = (host?.clientWidth ?? 1) / (host?.clientHeight ?? 1) || 1;
        const boardSpan = RAW_BOARD_SIZE * BOARD_SCALE;
        const desiredSpan = boardSpan * 1.18;
        const halfFov = THREE.MathUtils.degToRad(CAM.fov) / 2;
        const verticalRadius = desiredSpan / (2 * Math.tan(halfFov));
        const horizontalRadius = verticalRadius / Math.max(aspect, 0.5);
        const radius = clamp(
          Math.max(
            verticalRadius,
            horizontalRadius,
            CAMERA_TOPDOWN_MIN_RADIUS,
            CAM.minR * 1.1
          ),
          CAMERA_TOPDOWN_MIN_RADIUS,
          CAMERA_TOPDOWN_MAX_RADIUS
        );
        const target = new THREE.Spherical(radius, CAMERA_TOPDOWN_LOCK, 0);
        animateCameraTo(target, 360);
      } else {
        controls.enableRotate = true;
        controls.minPolarAngle = CAMERA_PULL_FORWARD_MIN;
        controls.maxPolarAngle = CAM.phiMax;
        controls.minDistance = CAM.minR;
        controls.maxDistance = CAMERA_SAFE_MAX_RADIUS;
        const restore = cameraMemory.last3d || default3d;
        const target = new THREE.Spherical(
          clamp(restore.radius, CAM.minR, CAMERA_SAFE_MAX_RADIUS),
          clamp(restore.phi, CAMERA_PULL_FORWARD_MIN, CAM.phiMax),
          Number.isFinite(restore.theta) ? restore.theta : default3d.theta
        );
        animateCameraTo(target, 420);
      }
    };

    cameraViewRef.current = { setMode: setViewModeInternal };
    setViewModeInternal(viewModeRef.current);

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
      const radius = clamp(
        Math.max(needed, currentRadius),
        CAM.minR,
        CAMERA_SAFE_MAX_RADIUS
      );
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
    let currentBoardModel = null;
    let currentPiecePrototypes = null;
    let currentPieceSetId = initialPieceSetId;
    let currentBoardCleanup = null;
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

    let proceduralBoardVisible = true;
    const setProceduralBoardVisible = (visible) => {
      proceduralBoardVisible = visible;
      base.visible = visible;
      top.visible = visible;
      tileGroup.visible = visible;
      coordMat.visible = visible;
      tiles.forEach((tileMesh) => {
        tileMesh.visible = visible;
      });
      arena.usingProceduralBoard = visible;
      if (arenaRef.current) {
        arenaRef.current.usingProceduralBoard = visible;
      }
    };

    arena.setProceduralBoardVisible = setProceduralBoardVisible;

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

    const paintPiecesFromPrototypes = (prototypes, styleId = currentPieceSetId) => {
      if (!prototypes) return;
      const colorKey = (p) => (p.w ? 'white' : 'black');
      const build = (p) => prototypes[colorKey(p)]?.[p.t] ?? null;

      allPieceMeshes.splice(0, allPieceMeshes.length).forEach((m) => {
        try {
          boardGroup.remove(m);
        } catch {}
        disposeObject3D(m);
      });
      for (let r = 0; r < 8; r += 1) {
        for (let c = 0; c < 8; c += 1) {
          const p = board[r][c];
          if (!p) {
            pieceMeshes[r][c] = null;
            continue;
          }
          const proto = build(p);
          if (!proto) continue;
          const clone = cloneWithShadows(proto);
          clone.position.set(c * tile - half + tile / 2, 0, r * tile - half + tile / 2);
          clone.userData = {
            r,
            c,
            w: p.w,
            t: p.t,
            type: 'piece',
            __pieceColor: colorKey(p),
            __pieceStyleId: styleId
          };
          clone.traverse((child) => {
            if (!child.isMesh) return;
            child.userData = {
              ...(child.userData || {}),
              __pieceColor: colorKey(p),
              __pieceStyleId: styleId
            };
          });
          boardGroup.add(clone);
          pieceMeshes[r][c] = clone;
          allPieceMeshes.push(clone);
        }
      }
      if (arenaRef.current) {
        arenaRef.current.allPieceMeshes = allPieceMeshes;
        arenaRef.current.piecePrototypes = prototypes;
        arenaRef.current.activePieceSetId = styleId;
      }
    };

    const applyPieceSetAssets = (assets, setId = currentPieceSetId) => {
      const { boardModel, piecePrototypes } = assets || {};
      currentPieceSetId = setId;
      if (currentBoardCleanup) {
        currentBoardCleanup();
        currentBoardCleanup = null;
      }
      if (boardModel) {
        boardModel.visible = true;
        boardGroup.add(boardModel);
        setProceduralBoardVisible(false);
        currentBoardModel = boardModel;
        currentBoardCleanup = () => {
          try {
            boardGroup.remove(boardModel);
          } catch {}
          disposeObject3D(boardModel);
        };
      } else {
        setProceduralBoardVisible(true);
        currentBoardModel = null;
      }
      if (piecePrototypes) {
        currentPiecePrototypes = piecePrototypes;
        paintPiecesFromPrototypes(piecePrototypes, setId);
      }
      if (arenaRef.current) {
        arenaRef.current.boardModel = currentBoardModel;
        arenaRef.current.piecePrototypes = currentPiecePrototypes;
        arenaRef.current.activePieceSetId = currentPieceSetId;
        arenaRef.current.allPieceMeshes = allPieceMeshes;
        arenaRef.current.applyPieceSetAssets = applyPieceSetAssets;
        arenaRef.current.setProceduralBoardVisible = setProceduralBoardVisible;
      }
    };

    disposers.push(() => {
      if (currentBoardCleanup) currentBoardCleanup();
    });

    pieceSetPromise
      .then((assets) => {
        if (cancelled) return;
        applyPieceSetAssets(assets, initialPieceSetId);
      })
      .catch((error) => {
        console.error('Chess Battle Royal: failed to resolve chess set', error);
      });

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
        aiFlag: initialAiFlagValue,
        boardModel: currentBoardModel,
        piecePrototypes: currentPiecePrototypes,
        activePieceSetId: currentPieceSetId,
        applyPieceSetAssets,
        setProceduralBoardVisible,
        usingProceduralBoard: proceduralBoardVisible
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
      const movedPiece = board[sel.r][sel.c];
      const movedFromPawn = movedPiece?.t === 'P';
      board[rr][cc] = movedPiece;
      board[sel.r][sel.c] = null;
      // promotion (auto to Queen)
      const promoted = movedFromPawn && (rr === 0 || rr === 7);
      if (promoted) {
        board[rr][cc].t = 'Q';
      }
      // move mesh
      let m = pieceMeshes[sel.r][sel.c];
      pieceMeshes[sel.r][sel.c] = null;
      pieceMeshes[rr][cc] = m;
      m.userData.r = rr;
      m.userData.c = cc;
      m.userData.t = board[rr][cc].t;
      m.position.set(
        cc * tile - half + tile / 2,
        0,
        rr * tile - half + tile / 2
      );
      if (promoted && currentPiecePrototypes) {
        const color = board[rr][cc].w ? 'white' : 'black';
        const queenProto = currentPiecePrototypes[color]?.Q;
        if (queenProto) {
          const replacement = cloneWithShadows(queenProto);
          replacement.position.copy(m.position);
          replacement.userData = {
            ...m.userData,
            t: 'Q',
            __pieceStyleId: currentPieceSetId
          };
          replacement.traverse((child) => {
            if (!child.isMesh) return;
            child.userData = {
              ...(child.userData || {}),
              __pieceColor: color,
              __pieceStyleId: currentPieceSetId
            };
          });
          pieceMeshes[rr][cc] = replacement;
          const index = allPieceMeshes.indexOf(m);
          if (index >= 0) allPieceMeshes[index] = replacement;
          else allPieceMeshes.push(replacement);
          boardGroup.add(replacement);
          try {
            boardGroup.remove(m);
          } catch {}
          disposeObject3D(m);
          m = replacement;
        }
      }

      playMoveSound();

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
          playMateSound();
        } else {
          status = 'Stalemate';
        }
      } else if (inCheck) {
        status = (nextWhite ? 'White' : 'Black') + ' in check';
        playCheckSound();
      }

      applyStatus(nextWhite, status, winner);
      sel = null;
      clearHighlights();
    }

    const dragState = {
      active: false,
      mesh: null,
      from: null
    };

    const piecePosition = (r, c, y = 0) =>
      new THREE.Vector3(c * tile - half + tile / 2, y, r * tile - half + tile / 2);

    const pickTileFromPointer = (event) => {
      setPointer(event);
      ray.setFromCamera(pointer, camera);
      const hit = ray.intersectObjects(tiles, false)[0];
      if (!hit) return null;
      const { r, c } = hit.object.userData || {};
      if (r == null || c == null) return null;
      return { r, c };
    };

    const pickBoardObject = (event) => {
      setPointer(event);
      ray.setFromCamera(pointer, camera);
      const intersects = ray.intersectObjects(boardGroup.children, true);
      for (const i of intersects) {
        let o = i.object;
        while (o) {
          if (o.userData && (o.userData.type === 'piece' || o.userData.type === 'tile')) {
            return { object: o, point: i.point };
          }
          o = o.parent;
        }
      }
      return null;
    };

    const onPointerDown = (event) => {
      if (settingsRef.current.moveMode !== 'drag') return;
      const hit = pickBoardObject(event);
      if (!hit || hit.object.userData.type !== 'piece') return;
      const { r, c } = hit.object.userData;
      selectAt(r, c);
      if (!sel) return;
      dragState.active = true;
      dragState.mesh = pieceMeshes[r][c];
      dragState.from = { r, c };
      if (dragState.mesh) {
        dragState.mesh.position.y = Math.max(dragState.mesh.position.y, 0.18);
      }
      if (controls) controls.enabled = false;
    };

    const onPointerMove = (event) => {
      if (!dragState.active || !dragState.mesh) return;
      const tileHit = pickTileFromPointer(event);
      if (!tileHit) return;
      const target = piecePosition(tileHit.r, tileHit.c, 0.18);
      dragState.mesh.position.lerp(target, 0.35);
    };

    const onPointerUp = (event) => {
      if (!dragState.active) return;
      const tileHit = pickTileFromPointer(event);
      const mesh = dragState.mesh;
      const from = dragState.from;
      dragState.active = false;
      dragState.mesh = null;
      dragState.from = null;
      if (controls) controls.enabled = true;
      if (tileHit && sel && legal.some(([r, c]) => r === tileHit.r && c === tileHit.c)) {
        moveSelTo(tileHit.r, tileHit.c);
        return;
      }
      if (mesh && from) {
        mesh.position.copy(piecePosition(from.r, from.c, 0));
        selectAt(from.r, from.c);
        return;
      }
      clearHighlights();
      sel = null;
    };

    function aiMove() {
      const mv = bestBlackMove(board, 4);
      if (!mv) return;
      sel = { r: mv.fromR, c: mv.fromC };
      legal = legalMoves(board, mv.fromR, mv.fromC);
      moveSelTo(mv.toR, mv.toC);
    }

    onClick = function onClick(e) {
      if (settingsRef.current.moveMode !== 'click') return;
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
    };

    renderer.domElement.addEventListener('click', onClick);
    renderer.domElement.addEventListener('touchend', onClick);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

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
    onResize = () => {
      fit();
    };
    window.addEventListener('resize', onResize);

    // Start timer for the human player
    startTimer(true);
  };

    setup();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      stopCameraTween();
      if (onResize) {
        window.removeEventListener('resize', onResize);
      }
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
      if (renderer?.domElement && onClick) {
        renderer.domElement.removeEventListener('click', onClick);
        renderer.domElement.removeEventListener('touchend', onClick);
        renderer.domElement.removeEventListener('pointerdown', onPointerDown);
        renderer.domElement.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
      }
      cameraViewRef.current = null;
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
      moveSoundRef.current?.pause();
      checkSoundRef.current?.pause();
      mateSoundRef.current?.pause();
    };
  }, []);

  return (
    <div ref={wrapRef} className="fixed inset-0 bg-[#0c1020] text-white touch-none select-none">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-4 left-4 z-20 flex flex-col items-start gap-3 pointer-events-none">
          <div className="pointer-events-none rounded bg-white/10 px-3 py-2 text-xs">
            <div className="font-semibold">{ui.status}</div>
          </div>
          <div className="pointer-events-auto flex gap-2">
            <button
              type="button"
              onClick={() => setConfigOpen((open) => !open)}
              aria-expanded={configOpen}
              className={`flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white shadow-lg backdrop-blur transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
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
              <span className="sr-only">Open chess settings</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode((mode) => (mode === '3d' ? '2d' : '3d'))}
              className="h-12 rounded-full border border-white/20 bg-black/70 px-4 text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-white shadow-lg backdrop-blur transition-colors duration-200 hover:bg-black/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            >
              {viewMode === '3d' ? '2D view' : '3D view'}
            </button>
          </div>
          {configOpen && (
            <div className="pointer-events-auto mt-2 w-72 max-w-[80vw] rounded-2xl border border-white/15 bg-black/80 p-4 text-xs text-white shadow-2xl backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.4em] text-sky-200/80">Chess Settings</p>
                    <p className="mt-1 text-[0.7rem] text-white/70">
                    Personalize the board, pieces, chairs, and table finish.
                    </p>
                  </div>
                <button
                  type="button"
                  onClick={() => setConfigOpen(false)}
                  className="rounded-full p-1 text-white/70 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                  aria-label="Close settings"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m6 6 12 12M18 6 6 18" />
                  </svg>
                </button>
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
                <div className="space-y-2 text-[0.7rem] text-gray-200">
                  <p>Piece control</p>
                  <div className="grid grid-cols-2 gap-2">
                    {MOVE_MODE_OPTIONS.map((option) => {
                      const active = moveMode === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setMoveMode(option.id)}
                          className={`rounded-lg border px-2 py-2 text-left font-semibold transition ${
                            active
                              ? 'border-emerald-300/50 bg-emerald-500/20 text-emerald-100'
                              : 'border-white/10 bg-white/5 text-white/80 hover:border-white/30'
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
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
                <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.35em] text-white/70">Personalize Arena</p>
                      <p className="mt-1 text-[0.7rem] text-white/60">Table cloth, chairs, board palette, and chess pieces.</p>
                    </div>
                    <button
                      type="button"
                      onClick={resetAppearance}
                      className="rounded-lg border border-white/15 px-2 py-1 text-[0.65rem] font-semibold text-white/80 transition hover:border-white/30 hover:text-white"
                    >
                      Reset
                    </button>
                  </div>
                  <div className="mt-3 max-h-72 space-y-3 overflow-y-auto pr-1">
                    {CUSTOMIZATION_SECTIONS.map(({ key, label, options }) => (
                      <div key={key} className="space-y-2">
                        <p className="text-[10px] uppercase tracking-[0.3em] text-white/60">{label}</p>
                        <div className="grid grid-cols-2 gap-2">
                          {options.map((option, idx) => {
                            const selected = appearance[key] === idx;
                            return (
                              <button
                                key={option.id}
                                type="button"
                                onClick={() =>
                                  setAppearance((prev) =>
                                    normalizeAppearance({
                                      ...prev,
                                      [key]: idx
                                    })
                                  )
                                }
                                aria-pressed={selected}
                                className={`flex flex-col items-center rounded-2xl border p-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                                  selected
                                    ? 'border-sky-400/80 bg-sky-400/10 shadow-[0_0_12px_rgba(56,189,248,0.35)]'
                                    : 'border-white/10 bg-white/5 hover:border-white/20'
                                }`}
                              >
                                {renderCustomizationPreview(key, option)}
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
                </div>
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
