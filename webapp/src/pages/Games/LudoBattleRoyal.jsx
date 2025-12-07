import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import AvatarTimer from '../../components/AvatarTimer.jsx';
import { createArenaCarpetMaterial, createArenaWallMaterial } from '../../utils/arenaDecor.js';
import {
  createMurlanStyleTable,
  applyTableMaterials,
  TABLE_SHAPE_OPTIONS
} from '../../utils/murlanTable.js';
import { ARENA_CAMERA_DEFAULTS } from '../../utils/arenaCameraConfig.js';
import { applyRendererSRGB, applySRGBColorSpace } from '../../utils/colorSpace.js';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import {
  getTelegramFirstName,
  getTelegramUsername,
  getTelegramPhotoUrl
} from '../../utils/telegram.js';
import coinConfetti from '../../utils/coinConfetti';
import {
  dropSound,
  diceSound,
  bombSound,
  cheerSound
} from '../../assets/soundData.js';
import { getGameVolume } from '../../utils/sound.js';
import { FLAG_EMOJIS } from '../../utils/flagEmojis.js';
import { avatarToName } from '../../utils/avatarUtils.js';
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

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const ABG_MODEL_URLS = Object.freeze([
  'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/ABeautifulGame/glTF-Binary/ABeautifulGame.glb',
  'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/ABeautifulGame/glTF/ABeautifulGame.gltf'
]);
const ABG_TYPES = Object.freeze(['p', 'r', 'n', 'b', 'q', 'k']);
const ABG_TYPE_ALIASES = Object.freeze([
  ['p', /pawn/],
  ['r', /rook|castle/],
  ['n', /knight|horse/],
  ['b', /bishop/],
  ['q', /queen/],
  ['k', /king/]
]);
const TOKEN_STYLE_OPTIONS = Object.freeze([
  { id: 'sequence', label: 'Chess Mix', description: 'Kings, queens, bishops & friends', type: null },
  { id: 'king', label: 'Kings', description: 'Classic king finials', type: 'k' },
  { id: 'queen', label: 'Queens', description: 'Royal queen set', type: 'q' },
  { id: 'bishop', label: 'Bishops', description: 'Slender bishop curve', type: 'b' },
  { id: 'knight', label: 'Knights', description: 'Horsehead knights', type: 'n' },
  { id: 'rook', label: 'Rooks', description: 'Tower keeps', type: 'r' },
  { id: 'pawn', label: 'Pawns', description: 'Minimal pawns', type: 'p' }
]);
const ABG_COLOR_W = /\b(white|ivory|light|w)\b/i;
const ABG_COLOR_B = /\b(black|ebony|dark|b)\b/i;

const TOKEN_TYPE_SEQUENCE = ['k', 'q', 'b', 'n', 'r', 'p'];

const ARENA_SCALE = 0.85;
const MODEL_SCALE = 0.75 * ARENA_SCALE;
const ARENA_GROWTH = 1.45;
const TABLE_RADIUS = 3.4 * MODEL_SCALE;
const BASE_TABLE_HEIGHT = 1.08 * MODEL_SCALE;
const STOOL_SCALE = 1.5 * 1.3;
const SEAT_WIDTH = 0.9 * MODEL_SCALE * STOOL_SCALE;
const SEAT_DEPTH = 0.95 * MODEL_SCALE * STOOL_SCALE;
const SEAT_THICKNESS = 0.09 * MODEL_SCALE * STOOL_SCALE;
const BACK_HEIGHT = 0.68 * MODEL_SCALE * STOOL_SCALE;
const BACK_THICKNESS = 0.08 * MODEL_SCALE * STOOL_SCALE;
const ARM_THICKNESS = 0.125 * MODEL_SCALE * STOOL_SCALE;
const ARM_HEIGHT = 0.3 * MODEL_SCALE * STOOL_SCALE;
const ARM_DEPTH = SEAT_DEPTH * 0.75;
const BASE_COLUMN_HEIGHT = 0.5 * MODEL_SCALE * STOOL_SCALE;
const CARD_SCALE = 0.95;
const CARD_W = 0.4 * MODEL_SCALE * CARD_SCALE;
const HUMAN_SEAT_ROTATION_OFFSET = Math.PI / 8;
const AI_CHAIR_GAP = CARD_W * 0.4;
const CHAIR_BASE_HEIGHT = BASE_TABLE_HEIGHT - SEAT_THICKNESS * 0.85;
const STOOL_HEIGHT = CHAIR_BASE_HEIGHT + SEAT_THICKNESS;
const TABLE_HEIGHT_LIFT = 0.05 * MODEL_SCALE;
const TABLE_HEIGHT = STOOL_HEIGHT + TABLE_HEIGHT_LIFT;
const AI_CHAIR_RADIUS = TABLE_RADIUS + SEAT_DEPTH / 2 + AI_CHAIR_GAP;
const ARENA_WALL_HEIGHT = 3.6 * 1.3;
const ARENA_WALL_CENTER_Y = ARENA_WALL_HEIGHT / 2;

const DEFAULT_PLAYER_COUNT = 4;
const clampPlayerCount = (value) =>
  clamp(
    Number.isFinite(value) ? Math.floor(value) : DEFAULT_PLAYER_COUNT,
    1,
    DEFAULT_PLAYER_COUNT
  );
const CUSTOM_CHAIR_ANGLES = [
  THREE.MathUtils.degToRad(90),
  THREE.MathUtils.degToRad(315),
  THREE.MathUtils.degToRad(270),
  THREE.MathUtils.degToRad(225)
];
const AI_ROLL_DELAY_MS = 2000;
const AI_EXTRA_TURN_DELAY_MS = 1100;
const HUMAN_ROLL_DELAY_MS = 2000;
const AUTO_ROLL_DURATION_MS = 1100;
const DICE_RESULT_EXTRA_HOLD_MS = 3000;
const AVATAR_ANCHOR_HEIGHT = SEAT_THICKNESS / 2 + BACK_HEIGHT * 0.85;
const CHAIR_SIZE_SCALE = 1;
const CHAIR_MODEL_URLS = [
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/AntiqueChair/glTF-Binary/AntiqueChair.glb',
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/SheenChair/glTF-Binary/SheenChair.glb',
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/AntiqueChair/glTF-Binary/AntiqueChair.glb'
];
const TARGET_CHAIR_SIZE = new THREE.Vector3(1.3162499970197679, 1.9173749900311232, 1.7001562547683715).multiplyScalar(
  CHAIR_SIZE_SCALE
);
const TARGET_CHAIR_MIN_Y = -0.8570624993294478 * CHAIR_SIZE_SCALE;
const TARGET_CHAIR_CENTER_Z = -0.1553906416893005 * CHAIR_SIZE_SCALE;

const FALLBACK_SEAT_POSITIONS = [
  { left: '50%', top: '84%' },
  { left: '80%', top: '56%' },
  { left: '52%', top: '24%' },
  { left: '20%', top: '56%' }
];

const colorNumberToHex = (value) => `#${value.toString(16).padStart(6, '0')}`;

const CAMERA_FOV = ARENA_CAMERA_DEFAULTS.fov;
const CAMERA_NEAR = ARENA_CAMERA_DEFAULTS.near;
const CAMERA_FAR = ARENA_CAMERA_DEFAULTS.far;
const CAMERA_DOLLY_FACTOR = ARENA_CAMERA_DEFAULTS.wheelDeltaFactor;
const CAMERA_TARGET_LIFT = 0.04 * MODEL_SCALE;

const DEFAULT_STOOL_THEME = Object.freeze({ legColor: '#1f1f1f' });

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

const APPEARANCE_STORAGE_KEY = 'ludoBattleRoyalArenaAppearance';
const DEFAULT_APPEARANCE = {
  ...DEFAULT_TABLE_CUSTOMIZATION,
  chairColor: 0,
  tableShape: 0,
  tokenStyle: 0,
  tokenColors: [0, 0, 0, 0]
};

const TOKEN_COLOR_OPTIONS_BY_PLAYER = Object.freeze([
  [
    { id: 'rubyPulse', label: 'Ruby Pulse', colors: ['#ef4444', '#b91c1c', '#fecdd3'] },
    { id: 'garnetEdge', label: 'Garnet Edge', colors: ['#dc2626', '#7f1d1d', '#f97316'] },
    { id: 'emberGlass', label: 'Ember Glass', colors: ['#f97316', '#b91c1c', '#ffd9b3'] }
  ],
  [
    { id: 'sunstrike', label: 'Sunstrike Amber', colors: ['#fbbf24', '#f59e0b', '#854d0e'] },
    { id: 'citrine', label: 'Citrine Glow', colors: ['#fcd34d', '#f59e0b', '#fef3c7'] },
    { id: 'aurora', label: 'Aurora Saffron', colors: ['#eab308', '#d97706', '#451a03'] }
  ],
  [
    { id: 'cobaltIce', label: 'Cobalt Ice', colors: ['#2563eb', '#1e3a8a', '#bfdbfe'] },
    { id: 'midnightSurge', label: 'Midnight Surge', colors: ['#1d4ed8', '#0f172a', '#60a5fa'] },
    { id: 'glacier', label: 'Glacier Mist', colors: ['#0ea5e9', '#1d4ed8', '#e0f2fe'] }
  ],
  [
    { id: 'emeraldBloom', label: 'Emerald Bloom', colors: ['#22c55e', '#065f46', '#bbf7d0'] },
    { id: 'forestPulse', label: 'Forest Pulse', colors: ['#16a34a', '#052e16', '#34d399'] },
    { id: 'mintCircuit', label: 'Mint Circuit', colors: ['#10b981', '#064e3b', '#ccfbf1'] }
  ]
]);

const CUSTOMIZATION_SECTIONS = [
  { key: 'tableWood', label: 'Table Wood', options: TABLE_WOOD_OPTIONS },
  { key: 'tableCloth', label: 'Table Cloth', options: TABLE_CLOTH_OPTIONS },
  { key: 'chairColor', label: 'Chair Color', options: CHAIR_COLOR_OPTIONS },
  { key: 'tableBase', label: 'Table Base', options: TABLE_BASE_OPTIONS },
  { key: 'tableShape', label: 'Table Shape', options: TABLE_SHAPE_OPTIONS },
  { key: 'tokenStyle', label: 'Token Shape', options: TOKEN_STYLE_OPTIONS }
];

const DIAMOND_SHAPE_ID = 'diamondEdge';
const NON_DIAMOND_SHAPE_INDEX = (() => {
  const index = TABLE_SHAPE_OPTIONS.findIndex((option) => option.id !== DIAMOND_SHAPE_ID);
  return index >= 0 ? index : 0;
})();

function normalizeAppearance(value = {}) {
  const normalized = { ...DEFAULT_APPEARANCE };
  const entries = [
    ['tableWood', TABLE_WOOD_OPTIONS.length],
    ['tableCloth', TABLE_CLOTH_OPTIONS.length],
    ['tableBase', TABLE_BASE_OPTIONS.length],
    ['chairColor', CHAIR_COLOR_OPTIONS.length],
    ['tableShape', TABLE_SHAPE_OPTIONS.length],
    ['tokenStyle', TOKEN_STYLE_OPTIONS.length]
  ];
  entries.forEach(([key, max]) => {
    const raw = Number(value?.[key]);
    if (Number.isFinite(raw)) {
      const clamped = Math.min(Math.max(0, Math.round(raw)), max - 1);
      normalized[key] = clamped;
    }
  });
  const rawTokenColors = Array.isArray(value?.tokenColors) ? value.tokenColors : [];
  normalized.tokenColors = TOKEN_COLOR_OPTIONS_BY_PLAYER.map((family, idx) => {
    const raw = Number(rawTokenColors[idx]);
    if (!Number.isFinite(raw)) return 0;
    return Math.min(Math.max(0, Math.round(raw)), Math.max(0, (family?.length ?? 1) - 1));
  });
  return normalized;
}

function enforceShapeForPlayers(appearance, playerCount) {
  const safe = { ...appearance };
  const shapeOption = TABLE_SHAPE_OPTIONS[safe.tableShape];
  if (playerCount > 4 && shapeOption?.id === DIAMOND_SHAPE_ID) {
    safe.tableShape = NON_DIAMOND_SHAPE_INDEX;
  }
  return safe;
}

function selectTokenColorsForPlayer(playerIdx, selections) {
  const families = TOKEN_COLOR_OPTIONS_BY_PLAYER[playerIdx] ?? [];
  const maxIndex = Math.max(0, families.length - 1);
  const raw = Array.isArray(selections) ? selections[playerIdx] : null;
  const idx = Number.isFinite(Number(raw)) ? Math.min(Math.max(0, Math.round(raw)), maxIndex) : 0;
  const option = families[idx] ?? families[0];
  if (option?.colors?.length) {
    return { option, colors: option.colors };
  }
  return { option: null, colors: [colorNumberToHex(PLAYER_COLORS[playerIdx])] };
}

function getEffectiveShapeConfig(shapeIndex, playerCount) {
  const fallback = TABLE_SHAPE_OPTIONS[NON_DIAMOND_SHAPE_INDEX] ?? TABLE_SHAPE_OPTIONS[0];
  const requested = TABLE_SHAPE_OPTIONS[shapeIndex] ?? fallback;
  if (requested?.id === DIAMOND_SHAPE_ID && playerCount > 4) {
    return { option: fallback, rotationY: 0, forced: true };
  }
  const rotationY = requested?.id === DIAMOND_SHAPE_ID && playerCount <= 4 ? Math.PI / 4 : 0;
  return { option: requested ?? fallback, rotationY, forced: false };
}

function adjustHexColor(hex, amount) {
  const base = new THREE.Color(hex);
  const target = amount >= 0 ? new THREE.Color(0xffffff) : new THREE.Color(0x000000);
  base.lerp(target, Math.min(Math.abs(amount), 1));
  return `#${base.getHexString()}`;
}

function abgNodePath(node) {
  const names = [];
  let current = node;
  while (current) {
    if (current.name) names.push(current.name);
    current = current.parent;
  }
  return names.reverse().join('/');
}

function abgDetectType(path) {
  const lower = path.toLowerCase();
  for (const [t, re] of ABG_TYPE_ALIASES) {
    if (re.test(lower)) return t;
  }
  return undefined;
}

function abgDetectColor(path, luminanceHint = 0.6) {
  if (ABG_COLOR_W.test(path)) return 'w';
  if (ABG_COLOR_B.test(path)) return 'b';
  return luminanceHint >= 0.5 ? 'w' : 'b';
}

function abgAverageLuminance(root) {
  let sum = 0;
  let count = 0;
  root.traverse((node) => {
    if (!node.isMesh) return;
    const mats = Array.isArray(node.material) ? node.material : [node.material];
    mats.forEach((mat) => {
      if (mat?.color) {
        const c = mat.color;
        sum += 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
        count += 1;
      }
    });
  });
  return count ? sum / count : 0.5;
}

function abgCloneWithMats(src) {
  const clone = src.clone(true);
  clone.traverse((node) => {
    if (node.isMesh) {
      if (Array.isArray(node.material)) {
        node.material = node.material.map((m) => m?.clone?.() ?? m);
      } else if (node.material) {
        node.material = node.material.clone();
      }
      node.castShadow = true;
      node.receiveShadow = false;
    }
  });
  return clone;
}

function abgBbox(obj) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3();
  box.getSize(size);
  return { box, size };
}

function abgPreparePiece(src) {
  const clone = abgCloneWithMats(src);
  const { size } = abgBbox(clone);
  const footprint = Math.max(size.x, size.z) || 1;
  const target = LUDO_TILE * 0.7;
  const scale = target / footprint;
  clone.scale.setScalar(scale);
  const { box } = abgBbox(clone);
  const baseLift = -box.min.y + TOKEN_TRACK_HEIGHT;
  const group = new THREE.Group();
  group.add(clone);
  group.position.y = baseLift;
  group.traverse((node) => {
    if (node.isMesh) node.castShadow = true;
  });
  return group;
}

function abgApplyPalette(node, palette) {
  if (!Array.isArray(palette) || !palette.length) return;
  node.traverse((child) => {
    if (!child.isMesh) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    const next = mats.map((_, idx) => palette[idx % palette.length].clone());
    child.material = Array.isArray(child.material) ? next : next[0];
  });
}

function abgTintPalette(palette, color) {
  const tint = new THREE.Color(color);
  return (palette || []).map((mat) => {
    const clone = mat?.clone?.() ?? mat;
    if (clone?.color) {
      clone.color.copy(tint);
    }
    if (clone?.emissive) {
      clone.emissive.set(0x000000);
    }
    return clone;
  });
}

function tintPaletteWithColors(palette, colors) {
  const tones = (colors || []).map((c) => new THREE.Color(c));
  const fallback = tones.length ? tones : [new THREE.Color('#ffffff')];
  const src = palette && palette.length ? palette : fallback.map((tone) => new THREE.MeshPhysicalMaterial({ color: tone }));
  return src.map((mat, idx) => {
    const clone = mat?.clone?.() ?? mat;
    const tone = fallback[idx % fallback.length];
    if (clone?.color) {
      clone.color.copy(tone);
    }
    if (clone?.emissive) {
      clone.emissive.set(0x000000);
    }
    return clone;
  });
}

function abgSnapshotBoardPalette(root) {
  const swatches = [];
  root.traverse((node) => {
    if (!node.isMesh) return;
    const mats = Array.isArray(node.material) ? node.material : [node.material];
    mats.forEach((mat) => {
      if (mat?.color) swatches.push(mat);
    });
  });
  if (!swatches.length) return { light: null, dark: null };
  const withLum = swatches.map((mat) => {
    const c = mat.color;
    const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    return { mat, lum };
  });
  withLum.sort((a, b) => b.lum - a.lum);
  return {
    light: withLum[0]?.mat?.clone?.() ?? null,
    dark: withLum[withLum.length - 1]?.mat?.clone?.() ?? null
  };
}

let abgAssetPromise = null;
async function getAbgAssets() {
  if (abgAssetPromise) return abgAssetPromise;
  abgAssetPromise = (async () => {
    const loader = new GLTFLoader();
    loader.setCrossOrigin('anonymous');
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
    loader.setDRACOLoader(draco);

    let root = null;
    for (const url of ABG_MODEL_URLS) {
      try {
        const gltf = await loader.loadAsync(url);
        root = gltf?.scene;
        if (root) break;
      } catch (error) {
        console.warn('ABG load failed', url, error);
      }
    }
    if (!root) return null;
    root.updateMatrixWorld(true);

    const proto = { w: {}, b: {} };
    const palettes = { w: [], b: [] };
    const boards = [];

    root.traverse((node) => {
      const path = abgNodePath(node);
      const type = abgDetectType(path);
      if (node.isMesh) {
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        let lum = 0;
        let cnt = 0;
        mats.forEach((mat) => {
          if (mat?.map) applySRGBColorSpace(mat.map);
          if (mat?.emissiveMap) applySRGBColorSpace(mat.emissiveMap);
          if (mat?.color) {
            const c = mat.color;
            lum += 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
            cnt += 1;
          }
        });
        const lumAvg = cnt ? lum / cnt : 0.6;
        const colorKey = abgDetectColor(path, lumAvg);
        mats.forEach((mat) => {
          if (mat?.isMaterial) palettes[colorKey].push(mat.clone());
        });
        if (/board|table|chessboard/i.test(node.name || '')) boards.push(node);
      }
      if (!type) return;
      const color = abgDetectColor(path, abgAverageLuminance(node));
      if (!proto[color][type]) {
        proto[color][type] = node;
      }
    });

    const boardNode = boards[0] || root;
    const boardPalette = abgSnapshotBoardPalette(boardNode);

    (['w', 'b']).forEach((color) => {
      ABG_TYPES.forEach((type) => {
        if (!proto[color][type]) {
          const other = color === 'w' ? 'b' : 'w';
          if (proto[other][type]) {
            const clone = abgCloneWithMats(proto[other][type]);
            abgApplyPalette(clone, palettes[color]);
            proto[color][type] = clone;
          }
        }
        if (proto[color][type]) {
          proto[color][type] = abgPreparePiece(proto[color][type]);
        }
      });
    });

    return { proto, palettes, boardPalette };
  })();
  return abgAssetPromise;
}

function cloneBoardMaterial(base, color) {
  const mat = base?.clone?.() ?? new THREE.MeshStandardMaterial({ color });
  if (mat.color) {
    mat.color.set(color);
  }
  if (mat.emissive) {
    mat.emissive.set(0x000000);
  }
  return mat;
}

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

function applyChairThemeMaterials(three, theme) {
  const mats = three?.chairMaterials;
  if (!mats) return;
  if (mats.seat?.color) {
    mats.seat.color.set(theme.seatColor);
    mats.seat.needsUpdate = true;
  }
  if (mats.leg?.color) {
    mats.leg.color.set(theme.legColor);
    mats.leg.needsUpdate = true;
  }
  (mats.upholstery ?? []).forEach((mat) => {
    if (mat?.color) {
      mat.color.set(theme.seatColor);
      mat.needsUpdate = true;
    }
  });
  (mats.metal ?? []).forEach((mat) => {
    if (mat?.color) {
      mat.color.set(theme.legColor);
      mat.needsUpdate = true;
    }
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

async function buildChairTemplate(theme) {
  try {
    const gltfChair = await loadGltfChair();
    applyChairThemeMaterials({ chairMaterials: gltfChair.materials }, theme);
    return gltfChair;
  } catch (error) {
    console.error('Falling back to procedural chair', error);
  }
  return createProceduralChair(theme);
}

function disposeChairAssets(chairTemplate, chairMaterials) {
  if (chairTemplate) {
    chairTemplate.traverse((obj) => {
      if (obj.isMesh) {
        obj.geometry?.dispose?.();
      }
    });
  }
  if (chairMaterials) {
    const mats = new Set([
      chairMaterials.seat,
      chairMaterials.leg,
      ...(chairMaterials.upholstery ?? []),
      ...(chairMaterials.metal ?? [])
    ]);
    mats.forEach((mat) => mat?.dispose?.());
  }
}

const LUDO_GRID = 15;
const LUDO_TILE = 0.075;
const RAW_BOARD_SIZE = LUDO_GRID * LUDO_TILE;
// Enlarge the Ludo board so each tile matches a single chess-square footprint rather than the full board.
const BOARD_SCALE = 3.15 * ARENA_SCALE;
const BOARD_DISPLAY_SIZE = RAW_BOARD_SIZE * BOARD_SCALE;
const BOARD_CLOTH_HALF = BOARD_DISPLAY_SIZE / 2;
const BOARD_RADIUS = BOARD_DISPLAY_SIZE / 2;
const PLAYFIELD_HEIGHT = 0.018;
const TILE_HALF_HEIGHT = PLAYFIELD_HEIGHT / 2;
const MARKER_SURFACE_OFFSET = 0.002;
const STAR_MARKER_SURFACE_INSET = 0.001;
const CENTER_HOME_BASE_OFFSET = -0.0045;
// Align the Ludo board quadrants with the token rails that sit on the table edges.
const BOARD_ROTATION_Y = -Math.PI / 2;
const CAMERA_BASE_RADIUS = Math.max(TABLE_RADIUS, BOARD_RADIUS);
const CAMERA_EXTRA_ZOOM_IN = 0.9;
const CAMERA_EXTRA_ZOOM_OUT = 1.1;
const CAM = {
  fov: CAMERA_FOV,
  near: CAMERA_NEAR,
  far: CAMERA_FAR,
  minR: CAMERA_BASE_RADIUS * ARENA_CAMERA_DEFAULTS.minRadiusFactor * CAMERA_EXTRA_ZOOM_IN,
  maxR: CAMERA_BASE_RADIUS * ARENA_CAMERA_DEFAULTS.maxRadiusFactor * CAMERA_EXTRA_ZOOM_OUT,
  phiMin: ARENA_CAMERA_DEFAULTS.phiMin,
  phiMax: ARENA_CAMERA_DEFAULTS.phiMax
};
const TRACK_COORDS = Object.freeze([
  [6, 1],
  [6, 2],
  [6, 3],
  [6, 4],
  [6, 5],
  [5, 6],
  [4, 6],
  [3, 6],
  [2, 6],
  [1, 6],
  [0, 6],
  [0, 7],
  [0, 8],
  [1, 8],
  [2, 8],
  [3, 8],
  [4, 8],
  [5, 8],
  [6, 9],
  [6, 10],
  [6, 11],
  [6, 12],
  [6, 13],
  [6, 14],
  [7, 14],
  [8, 14],
  [8, 13],
  [8, 12],
  [8, 11],
  [8, 10],
  [8, 9],
  [9, 8],
  [10, 8],
  [11, 8],
  [12, 8],
  [13, 8],
  [14, 8],
  [14, 7],
  [14, 6],
  [13, 6],
  [12, 6],
  [11, 6],
  [10, 6],
  [9, 6],
  [8, 5],
  [8, 4],
  [8, 3],
  [8, 2],
  [8, 1],
  [8, 0],
  [7, 0],
  [6, 0]
]);
const PLAYER_START_INDEX = Object.freeze([26, 13, 0, 39]);
const HOME_COLUMN_COORDS = Object.freeze([
  Object.freeze([
    [7, 13],
    [7, 12],
    [7, 11],
    [7, 10],
    [7, 9],
    [7, 8]
  ]),
  Object.freeze([
    [1, 7],
    [2, 7],
    [3, 7],
    [4, 7],
    [5, 7],
    [6, 7]
  ]),
  Object.freeze([
    [7, 1],
    [7, 2],
    [7, 3],
    [7, 4],
    [7, 5],
    [7, 6]
  ]),
  Object.freeze([
    [13, 7],
    [12, 7],
    [11, 7],
    [10, 7],
    [9, 7],
    [8, 7]
  ])
]);
const RING_STEPS = TRACK_COORDS.length;
const HOME_STEPS = HOME_COLUMN_COORDS[0].length;
const GOAL_PROGRESS = RING_STEPS + HOME_STEPS;
const COLOR_NAMES = ['Red', 'Yellow', 'Blue', 'Green'];
const BOARD_COLORS = Object.freeze([0xef4444, 0xfcd34d, 0x3b82f6, 0x22c55e]);
const PLAYER_COLOR_ORDER = Object.freeze([0, 1, 2, 3]);
const PLAYER_COLORS = Object.freeze(
  PLAYER_COLOR_ORDER.map((boardIndex) => BOARD_COLORS[boardIndex])
);
const TOKEN_TRACK_SURFACE_OFFSET = 0.002;
const TOKEN_HOME_SURFACE_OFFSET = 0.008;
const TOKEN_GOAL_SURFACE_OFFSET = 0.0065;
const TOKEN_TRACK_HEIGHT = PLAYFIELD_HEIGHT + TOKEN_TRACK_SURFACE_OFFSET;
const TOKEN_HOME_HEIGHT = PLAYFIELD_HEIGHT + TOKEN_HOME_SURFACE_OFFSET;
const TOKEN_GOAL_HEIGHT = PLAYFIELD_HEIGHT + TOKEN_GOAL_SURFACE_OFFSET;
const TOKEN_TRACK_LIFT = new THREE.Vector3(0, TOKEN_TRACK_HEIGHT, 0);
const TOKEN_GOAL_LIFT = new THREE.Vector3(0, TOKEN_GOAL_HEIGHT, 0);
const RAIL_TOKEN_FORWARD_SPACING = 0.05;
const RAIL_TOKEN_SIDE_SPACING = 0.06;
const TOKEN_HOME_HEIGHT_OFFSETS = Object.freeze([0, 0.0035, 0.0035, 0.0035]);
const TOKEN_RAIL_BASE_FORWARD_SHIFT = Object.freeze([0.012, 0, 0, 0]);
const TOKEN_RAIL_SIDE_MULTIPLIER = Object.freeze([1.12, 1.12, 1.12, 1.12]);
const TOKEN_RAIL_CENTER_PULL_DEFAULT = 0.048;
const TOKEN_RAIL_CENTER_PULL_PER_PLAYER = Object.freeze([
  0.056,
  0.052,
  0.056,
  0.052
]);
const TOKEN_RAIL_HEIGHT_LIFT = 0.0045;
const TOKEN_MOVE_SPEED = 1.35;
const keyFor = (r, c) => `${r},${c}`;
const TRACK_KEY_SET = new Set(TRACK_COORDS.map(([r, c]) => keyFor(r, c)));
const TRACK_INDEX_BY_KEY = new Map(
  TRACK_COORDS.map(([r, c], index) => [keyFor(r, c), index])
);
const START_KEY_TO_PLAYER = new Map(
  PLAYER_START_INDEX.map((index, player) => {
    const [r, c] = TRACK_COORDS[index];
    return [keyFor(r, c), player];
  })
);
const SAFE_TRACK_INDEXES = new Set(
  PLAYER_START_INDEX.flatMap((index) => [index, (index + 8) % RING_STEPS])
);
const SAFE_TRACK_KEY_SET = new Set(
  [...SAFE_TRACK_INDEXES].map((index) => {
    const [r, c] = TRACK_COORDS[index];
    return keyFor(r, c);
  })
);
const HOME_COLUMN_KEY_TO_PLAYER = new Map();
const HOME_COLUMN_KEY_TO_STEP = new Map();
HOME_COLUMN_COORDS.forEach((coords, player) => {
  coords.forEach(([r, c], step) => {
    const key = keyFor(r, c);
    HOME_COLUMN_KEY_TO_PLAYER.set(key, player);
    HOME_COLUMN_KEY_TO_STEP.set(key, step);
  });
});

function getPlayerHomeHeight(playerIndex) {
  const offset = TOKEN_HOME_HEIGHT_OFFSETS[playerIndex] ?? 0;
  return TOKEN_HOME_HEIGHT + offset;
}

function getTokenRailHeight(playerIndex) {
  return getPlayerHomeHeight(playerIndex) + TOKEN_RAIL_HEIGHT_LIFT;
}

const DICE_SIZE = 0.076;
const DICE_CORNER_RADIUS = DICE_SIZE * 0.17;
const DICE_PIP_RADIUS = DICE_SIZE * 0.093;
const DICE_PIP_DEPTH = DICE_SIZE * 0.018;
const DICE_PIP_SPREAD = DICE_SIZE * 0.3;
const DICE_FACE_INSET = DICE_SIZE * 0.064;
const DICE_BASE_HEIGHT = DICE_SIZE / 2 + 0.047;
const DICE_PIP_RIM_INNER = DICE_PIP_RADIUS * 0.78;
const DICE_PIP_RIM_OUTER = DICE_PIP_RADIUS * 1.08;
const DICE_PIP_RIM_OFFSET = DICE_SIZE * 0.0048;

function makeDice() {
  const dice = new THREE.Group();

  const dieMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0.25,
    roughness: 0.35,
    clearcoat: 1,
    clearcoatRoughness: 0.15,
    reflectivity: 0.75,
    envMapIntensity: 1.4
  });

  const pipMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x0a0a0a,
    roughness: 0.05,
    metalness: 0.6,
    clearcoat: 0.9,
    clearcoatRoughness: 0.04,
    envMapIntensity: 1.1
  });

  const pipRimMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffd700,
    emissive: 0x3a2a00,
    emissiveIntensity: 0.55,
    metalness: 1,
    roughness: 0.18,
    reflectivity: 1,
    envMapIntensity: 1.35,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1
  });

  const body = new THREE.Mesh(
    new RoundedBoxGeometry(DICE_SIZE, DICE_SIZE, DICE_SIZE, 6, DICE_CORNER_RADIUS),
    dieMaterial
  );
  body.castShadow = true;
  body.receiveShadow = true;
  dice.add(body);

  const pipGeo = new THREE.SphereGeometry(DICE_PIP_RADIUS, 36, 24, 0, Math.PI * 2, 0, Math.PI);
  pipGeo.rotateX(Math.PI);
  pipGeo.computeVertexNormals();
  const pipRimGeo = new THREE.RingGeometry(DICE_PIP_RIM_INNER, DICE_PIP_RIM_OUTER, 64);
  const half = DICE_SIZE / 2;
  const faceDepth = half - DICE_FACE_INSET * 0.6;
  const spread = DICE_PIP_SPREAD;

  const faces = [
    { normal: new THREE.Vector3(0, 1, 0), points: [[0, 0]] },
    {
      normal: new THREE.Vector3(0, 0, 1),
      points: [
        [-spread, -spread],
        [spread, spread]
      ]
    },
    {
      normal: new THREE.Vector3(1, 0, 0),
      points: [
        [-spread, -spread],
        [0, 0],
        [spread, spread]
      ]
    },
    {
      normal: new THREE.Vector3(-1, 0, 0),
      points: [
        [-spread, -spread],
        [-spread, spread],
        [spread, -spread],
        [spread, spread]
      ]
    },
    {
      normal: new THREE.Vector3(0, 0, -1),
      points: [
        [-spread, -spread],
        [-spread, spread],
        [0, 0],
        [spread, -spread],
        [spread, spread]
      ]
    },
    {
      normal: new THREE.Vector3(0, -1, 0),
      points: [
        [-spread, -spread],
        [-spread, 0],
        [-spread, spread],
        [spread, -spread],
        [spread, 0],
        [spread, spread]
      ]
    }
  ];

  faces.forEach(({ normal, points }) => {
    const n = normal.clone().normalize();
    const helper = Math.abs(n.y) > 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
    const xAxis = new THREE.Vector3().crossVectors(helper, n).normalize();
    const yAxis = new THREE.Vector3().crossVectors(n, xAxis).normalize();

    points.forEach(([gx, gy]) => {
      const base = new THREE.Vector3()
        .addScaledVector(xAxis, gx)
        .addScaledVector(yAxis, gy)
        .addScaledVector(n, faceDepth - DICE_PIP_DEPTH * 0.5);

      const pip = new THREE.Mesh(pipGeo, pipMaterial);
      pip.castShadow = true;
      pip.receiveShadow = true;
      pip.position.copy(base).addScaledVector(n, DICE_PIP_DEPTH);
      pip.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n));
      dice.add(pip);

      const rim = new THREE.Mesh(pipRimGeo, pipRimMaterial);
      rim.receiveShadow = true;
      rim.renderOrder = 6;
      rim.position.copy(base).addScaledVector(n, DICE_PIP_RIM_OFFSET);
      rim.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n));
      dice.add(rim);
    });
  });

  dice.userData.setValue = (val) => {
    dice.userData.currentValue = val;
    setDiceOrientation(dice, val);
  };
  dice.userData.currentValue = 1;
  return dice;
}

const markerTextureCache = new Map();
const starMarkerTextureCache = new Map();
const homeLabelTextureCache = new Map();

function resolveColorStyle(input) {
  if (input == null) {
    return null;
  }
  const color = new THREE.Color(input);
  return color.getStyle();
}

function getMarkerTexture({
  label,
  color,
  arrow = false,
  backgroundColor,
  textColor,
  arrowColor
}) {
  const key = `${label}-${color}-${arrow}-${backgroundColor ?? ''}-${textColor ?? ''}-${arrowColor ?? ''}`;
  if (markerTextureCache.has(key)) {
    return markerTextureCache.get(key);
  }
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }
  const baseColor = new THREE.Color(color);
  const skipBackground = backgroundColor === 'transparent' || backgroundColor === 'none';
  const bgColor =
    skipBackground || !backgroundColor
      ? baseColor.clone().lerp(new THREE.Color(0x000000), 0.68).getStyle()
      : backgroundColor;
  const accentColor =
    resolveColorStyle(arrowColor) || baseColor.clone().lerp(new THREE.Color(0xffffff), 0.18).getStyle();
  const labelColor =
    textColor || baseColor.clone().lerp(new THREE.Color(0x1f2937), 0.2).getStyle();

  if (!skipBackground) {
    ctx.fillStyle = bgColor;
    ctx.globalAlpha = 0.92;
    ctx.fillRect(0, 0, size, size);
    ctx.globalAlpha = 1;
  } else {
    ctx.clearRect(0, 0, size, size);
  }

  ctx.translate(size / 2, size / 2);
  if (arrow) {
    ctx.fillStyle = accentColor;
    const arrowHeight = size * 0.36;
    const arrowWidth = size * 0.22;
    ctx.beginPath();
    ctx.moveTo(0, -arrowHeight * 0.75);
    ctx.lineTo(arrowWidth, arrowHeight * 0.05);
    ctx.lineTo(arrowWidth * 0.38, arrowHeight * 0.05);
    ctx.lineTo(arrowWidth * 0.38, arrowHeight * 0.55);
    ctx.lineTo(-arrowWidth * 0.38, arrowHeight * 0.55);
    ctx.lineTo(-arrowWidth * 0.38, arrowHeight * 0.05);
    ctx.lineTo(-arrowWidth, arrowHeight * 0.05);
    ctx.closePath();
    ctx.fill();
  }

  if (label) {
    ctx.fillStyle = labelColor;
    ctx.font = `bold ${size * 0.26}px Inter, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label.toUpperCase(), 0, size * 0.28);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  markerTextureCache.set(key, texture);
  return texture;
}

const MARKER_HEIGHT_OFFSET = TILE_HALF_HEIGHT + MARKER_SURFACE_OFFSET;
const STAR_MARKER_HEIGHT_OFFSET = TILE_HALF_HEIGHT - STAR_MARKER_SURFACE_INSET;

function createMarkerMesh({
  label,
  color,
  position,
  angle = 0,
  size = LUDO_TILE * 0.92,
  arrow = false,
  backgroundColor,
  textColor,
  arrowColor
}) {
  const texture = getMarkerTexture({ label, color, arrow, backgroundColor, textColor, arrowColor });
  if (!texture) return null;
  const geometry = new THREE.PlaneGeometry(size, size);
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  mesh.position.y += MARKER_HEIGHT_OFFSET;
  mesh.quaternion.setFromEuler(new THREE.Euler(-Math.PI / 2, angle, 0, 'YXZ'));
  mesh.renderOrder = 12;
  return mesh;
}

function getStarMarkerTexture(color) {
  const key = color;
  if (starMarkerTextureCache.has(key)) {
    return starMarkerTextureCache.get(key);
  }
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }

  ctx.fillStyle = '#fef9ef';
  ctx.globalAlpha = 0.62;
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = 1;

  ctx.strokeStyle = '#d1a15d';
  ctx.lineWidth = size * 0.06;
  ctx.strokeRect(size * 0.08, size * 0.08, size * 0.84, size * 0.84);

  const outerRadius = size * 0.32;
  const innerRadius = outerRadius * 0.45;
  const cx = size / 2;
  const cy = size / 2;
  const points = 5;
  ctx.fillStyle = new THREE.Color(color).getStyle();
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const angle = (Math.PI / points) * i - Math.PI / 2;
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  if ('colorSpace' in texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }
  starMarkerTextureCache.set(key, texture);
  return texture;
}

function createStarMarkerMesh({ color, position, size = LUDO_TILE * 0.82 }) {
  const texture = getStarMarkerTexture(color);
  if (!texture) return null;
  const geometry = new THREE.PlaneGeometry(size, size);
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  mesh.position.y += STAR_MARKER_HEIGHT_OFFSET;
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 13;
  return mesh;
}

function getHomeLabelTexture() {
  if (homeLabelTextureCache.has('home')) {
    return homeLabelTextureCache.get('home');
  }
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = '#b45309';
  ctx.lineWidth = size * 0.08;
  ctx.strokeRect(size * 0.08, size * 0.08, size * 0.84, size * 0.84);

  ctx.fillStyle = '#b91c1c';
  ctx.font = `bold ${size * 0.24}px Inter, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('HOME', size / 2, size / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  if ('colorSpace' in texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }
  homeLabelTextureCache.set('home', texture);
  return texture;
}

function createHomeLabelMesh(size) {
  const texture = getHomeLabelTexture();
  if (!texture) return null;
  const geometry = new THREE.PlaneGeometry(size, size);
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 14;
  return mesh;
}

function addCenterHome(scene) {
  const size = LUDO_TILE * 3;
  const half = size / 2;
  const baseHeight = PLAYFIELD_HEIGHT + CENTER_HOME_BASE_OFFSET;

  const base = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78 })
  );
  base.rotation.x = -Math.PI / 2;
  base.position.set(0, baseHeight, 0);
  base.receiveShadow = true;
  scene.add(base);

  const triangleDefs = [
    {
      color: BOARD_COLORS[0],
      vertices: new Float32Array([
        -half,
        0,
        -half,
        -half,
        0,
        half,
        0,
        0,
        0
      ])
    },
    {
      color: BOARD_COLORS[1],
      vertices: new Float32Array([
        -half,
        0,
        -half,
        half,
        0,
        -half,
        0,
        0,
        0
      ])
    },
    {
      color: BOARD_COLORS[2],
      vertices: new Float32Array([
        half,
        0,
        -half,
        half,
        0,
        half,
        0,
        0,
        0
      ])
    },
    {
      color: BOARD_COLORS[3],
      vertices: new Float32Array([
        -half,
        0,
        half,
        half,
        0,
        half,
        0,
        0,
        0
      ])
    }
  ];

  triangleDefs.forEach(({ color, vertices }) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.74,
      metalness: 0.06,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = baseHeight + 0.0006;
    mesh.receiveShadow = true;
    scene.add(mesh);
  });

  const homeLabel = createHomeLabelMesh(LUDO_TILE * 1.2);
  if (homeLabel) {
    homeLabel.position.set(0, baseHeight + 0.001, 0);
    scene.add(homeLabel);
  }
}

function getArrowAngle(dx, dz) {
  if (dx === 0 && dz === 0) {
    return 0;
  }
  return Math.atan2(dx, -dz);
}

function getTrackDirectionAngle(index) {
  const current = TRACK_COORDS[index];
  const next = TRACK_COORDS[(index + 1) % RING_STEPS];
  const dx = next[1] - current[1];
  const dz = next[0] - current[0];
  return getArrowAngle(dx, dz);
}

function addBoardMarkers(scene, cellToWorld) {
  if (typeof document === 'undefined') return;
  const group = new THREE.Group();
  scene.add(group);

  const safeKeyToPlayer = new Map();
  PLAYER_START_INDEX.forEach((startIndex, playerIdx) => {
    const [startR, startC] = TRACK_COORDS[startIndex];
    safeKeyToPlayer.set(keyFor(startR, startC), playerIdx);
    const safeIndex = (startIndex + 8) % RING_STEPS;
    const [safeR, safeC] = TRACK_COORDS[safeIndex];
    safeKeyToPlayer.set(keyFor(safeR, safeC), playerIdx);
  });

  TRACK_COORDS.forEach(([r, c], index) => {
    const key = keyFor(r, c);
    const startOwner = START_KEY_TO_PLAYER.get(key);
    const safeOwner = safeKeyToPlayer.get(key);
    const position = cellToWorld(r, c).clone();
    const angle = getTrackDirectionAngle(index);
    const baseColor =
      startOwner != null
        ? PLAYER_COLORS[startOwner]
        : safeOwner != null
        ? PLAYER_COLORS[safeOwner]
        : '#0f172a';
    const isStartTile = startOwner != null;
    if (!isStartTile) {
      return;
    }
    const marker = createMarkerMesh({
      label: 'GO',
      color: baseColor,
      position,
      angle,
      size: LUDO_TILE * 0.98,
      arrow: true,
      backgroundColor: '#ffffff',
      textColor: resolveColorStyle(baseColor),
      arrowColor: baseColor
    });
    if (marker) group.add(marker);
  });

  PLAYER_START_INDEX.forEach((startIndex, playerIdx) => {
    const safeIndex = (startIndex + 8) % RING_STEPS;
    const [safeR, safeC] = TRACK_COORDS[safeIndex];
    const safePosition = cellToWorld(safeR, safeC).clone();
    const star = createStarMarkerMesh({
      color: PLAYER_COLORS[playerIdx],
      position: safePosition,
      size: LUDO_TILE * 0.88
    });
    if (star) group.add(star);

  });

  HOME_COLUMN_COORDS.forEach((coords, playerIdx) => {
    const isHorizontal = coords.every(([row]) => row === coords[0][0]);
    coords.forEach(([homeR, homeC]) => {
      const homePos = cellToWorld(homeR, homeC).clone();
      let arrowAngle = getArrowAngle(-homePos.x, -homePos.z);
      if (isHorizontal) {
        arrowAngle = -arrowAngle;
      }
      const arrowMarker = createMarkerMesh({
        label: '',
        color: PLAYER_COLORS[playerIdx],
        position: homePos,
        angle: arrowAngle,
        size: LUDO_TILE * 0.88,
        arrow: true,
        backgroundColor: 'transparent',
        arrowColor: PLAYER_COLORS[playerIdx]
      });
      if (arrowMarker) group.add(arrowMarker);
    });
  });
}

function setDiceOrientation(dice, val) {
  const q = new THREE.Quaternion();
  const eulers = {
    1: new THREE.Euler(0, 0, 0),
    2: new THREE.Euler(-Math.PI / 2, 0, 0),
    3: new THREE.Euler(0, 0, -Math.PI / 2),
    4: new THREE.Euler(0, 0, Math.PI / 2),
    5: new THREE.Euler(Math.PI / 2, 0, 0),
    6: new THREE.Euler(Math.PI, 0, 0)
  };
  const e = eulers[val] || eulers[1];
  q.setFromEuler(e);
  dice.setRotationFromQuaternion(q);
}

function spinDice(
  dice,
  { duration = 900, targetPosition = new THREE.Vector3(), bounceHeight = 0.06 } = {}
) {
  return new Promise((resolve) => {
    const start = performance.now();
    const startPos = dice.position.clone();
    const endPos = targetPosition.clone();
    const spinVec = new THREE.Vector3(
      1.2 + Math.random() * 0.7,
      1.35 + Math.random() * 0.65,
      1.05 + Math.random() * 0.75
    );
    const wobble = new THREE.Vector3((Math.random() - 0.5) * 0.16, 0, (Math.random() - 0.5) * 0.16);
    const targetValue = 1 + Math.floor(Math.random() * 6);

    const step = () => {
      const now = performance.now();
      const t = Math.min(1, (now - start) / Math.max(1, duration));
      const eased = easeOutCubic(t);
      const position = startPos.clone().lerp(endPos, eased);
      const wobbleStrength = Math.sin(eased * Math.PI);
      position.addScaledVector(wobble, wobbleStrength * 0.45);
      const bounce = Math.sin(Math.min(1, eased * 1.25) * Math.PI) * bounceHeight * (1 - eased * 0.45);
      position.y = THREE.MathUtils.lerp(startPos.y, endPos.y, eased) + bounce;
      dice.position.copy(position);

      const spinFactor = 1 - eased * 0.28;
      dice.rotation.x += spinVec.x * spinFactor * 0.22;
      dice.rotation.y += spinVec.y * spinFactor * 0.22;
      dice.rotation.z += spinVec.z * spinFactor * 0.22;

      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        if (typeof dice.userData?.setValue === 'function') {
          dice.userData.setValue(targetValue);
        } else {
          setDiceOrientation(dice, targetValue);
        }
        dice.position.copy(endPos);
        resolve(targetValue);
      }
    };

    requestAnimationFrame(step);
  });
}

const tokenTextureCache = new Map();

function createTokenCountLabel() {
  if (typeof document === 'undefined') return null;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  if ('colorSpace' in texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.045, 0.045, 0.045);
  sprite.position.set(0, 0.08, 0);
  sprite.renderOrder = 30;
  sprite.visible = false;
  sprite.userData.countLabel = {
    canvas,
    ctx,
    texture,
    value: 0
  };
  return sprite;
}

function updateTokenCountLabel(sprite, count, baseColor) {
  if (!sprite) return;
  const data = sprite.userData?.countLabel;
  if (!data) return;
  if (data.value === count) return;
  const { canvas, ctx, texture } = data;
  const size = canvas.width;
  ctx.clearRect(0, 0, size, size);

  const color = baseColor
    ? new THREE.Color(baseColor).lerp(new THREE.Color(0xffffff), 0.18)
    : new THREE.Color('#1f2937');
  const rim = color.clone().lerp(new THREE.Color(0x000000), 0.35);

  ctx.fillStyle = `#${color.getHexString()}`;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.42, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = size * 0.08;
  ctx.strokeStyle = `#${rim.getHexString()}`;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${size * 0.56}px Inter, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(count), size / 2, size / 2);

  texture.needsUpdate = true;
  data.value = count;
}

function createTokenTexture(color) {
  if (typeof document === 'undefined') return null;
  const key = typeof color === 'number' ? color.toString(16) : color.getHexString?.() ?? `${color}`;
  if (tokenTextureCache.has(key)) return tokenTextureCache.get(key);

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const base = new THREE.Color(color);
  const highlight = base.clone().lerp(new THREE.Color(0xffffff), 0.35);
  const mid = base.clone().lerp(new THREE.Color(0xffffff), 0.08);
  const shadow = base.clone().lerp(new THREE.Color(0x000000), 0.32);
  const rim = base.clone().lerp(new THREE.Color(0x000000), 0.55);

  ctx.fillStyle = `#${rim.getHexString()}`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const gradient = ctx.createRadialGradient(
    canvas.width * 0.32,
    canvas.height * 0.3,
    canvas.width * 0.1,
    canvas.width * 0.55,
    canvas.height * 0.55,
    canvas.width * 0.55
  );
  gradient.addColorStop(0, `#${highlight.getHexString()}`);
  gradient.addColorStop(0.45, `#${mid.getHexString()}`);
  gradient.addColorStop(1, `#${shadow.getHexString()}`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(canvas.width * 0.34, canvas.height * 0.3, canvas.width * 0.12, canvas.height * 0.18, -0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  if ('colorSpace' in texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }

  tokenTextureCache.set(key, texture);
  return texture;
}

function makeTokenMaterial(color) {
  const tone = new THREE.Color(color);
  const texture = createTokenTexture(tone);
  const material = new THREE.MeshPhysicalMaterial({
    color: tone,
    map: texture ?? null,
    roughness: 0.32,
    metalness: 0.18,
    clearcoat: 0.65,
    clearcoatRoughness: 0.18,
    sheen: 0.35,
    sheenColor: tone.clone().lerp(new THREE.Color(0xffffff), 0.18),
    envMapIntensity: 0.9
  });
  if (texture) {
    material.map = texture;
  }
  return material;
}

function makeRook(mat) {
  const g = new THREE.Group();
  const accent = mat.clone();
  if (accent.color) {
    accent.color = accent.color.clone().lerp(new THREE.Color(0xffffff), 0.28);
  }
  accent.metalness = Math.min(0.55, (accent.metalness ?? 0) + 0.2);
  accent.roughness = Math.max(0.18, (accent.roughness ?? 0.32) - 0.12);
  accent.clearcoat = Math.min(0.95, (accent.clearcoat ?? 0.65) + 0.1);
  accent.clearcoatRoughness = Math.max(0.12, (accent.clearcoatRoughness ?? 0.18) * 0.65);

  const baseHeight = 0.018;
  const bodyHeight = 0.034;
  const crownHeight = 0.015;
  const crownRadius = 0.013;
  const finialRadius = 0.0065;

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.032, baseHeight, 48), mat);
  base.position.y = baseHeight / 2;
  base.castShadow = true;
  base.receiveShadow = true;

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, bodyHeight, 48), mat);
  body.position.y = baseHeight + bodyHeight / 2;
  body.castShadow = true;
  body.receiveShadow = true;

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.019, 0.0032, 18, 48), accent);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = baseHeight + bodyHeight;
  collar.castShadow = true;
  collar.receiveShadow = true;

  const crownBase = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.02, crownHeight, 48), accent);
  crownBase.position.y = baseHeight + bodyHeight + crownHeight / 2;
  crownBase.castShadow = true;
  crownBase.receiveShadow = true;

  const crownTop = new THREE.Mesh(new THREE.SphereGeometry(crownRadius, 32, 24), accent);
  crownTop.position.y = baseHeight + bodyHeight + crownHeight + crownRadius;
  crownTop.castShadow = true;
  crownTop.receiveShadow = true;

  const finialMaterial = accent.clone();
  finialMaterial.metalness = Math.min(0.7, finialMaterial.metalness + 0.1);
  finialMaterial.roughness = Math.max(0.12, finialMaterial.roughness - 0.08);
  const finial = new THREE.Mesh(new THREE.SphereGeometry(finialRadius, 24, 18), finialMaterial);
  finial.position.y = crownTop.position.y + crownRadius * 0.7;
  finial.castShadow = true;
  finial.receiveShadow = true;

  const label = createTokenCountLabel();
  if (label) {
    g.add(label);
    g.userData.countLabel = label;
  }

  const tokenColorHex = mat?.color?.getHexString?.();
  if (tokenColorHex) {
    g.userData.tokenColor = `#${tokenColorHex}`;
  }

  g.add(base, body, collar, crownBase, crownTop, finial);
  return g;
}

function ease(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

const TOKEN_SELECTION_SCALE = 1.08;

function setTokenHighlight(token, active) {
  if (!token) return;
  if (!token.userData) token.userData = {};
  if (!token.userData.baseScale) {
    token.userData.baseScale = token.scale.clone();
  }
  const baseScale = token.userData.baseScale;
  if (active) {
    token.scale.set(
      baseScale.x * TOKEN_SELECTION_SCALE,
      baseScale.y * TOKEN_SELECTION_SCALE,
      baseScale.z * TOKEN_SELECTION_SCALE
    );
  } else if (baseScale) {
    token.scale.copy(baseScale);
  }

  const tokenColor = token.userData?.tokenColor ? new THREE.Color(token.userData.tokenColor) : null;
  const highlightColor = tokenColor ? tokenColor.clone().lerp(new THREE.Color(0xffffff), 0.2) : null;

  token.traverse((child) => {
    if (!child?.isMesh) return;
    if (!child.userData) child.userData = {};
    const { material } = child;
    if (!material) return;
    if (material.emissive && !child.userData.baseEmissive) {
      child.userData.baseEmissive = material.emissive.clone();
    }
    if (material.emissiveIntensity != null && child.userData.baseEmissiveIntensity == null) {
      child.userData.baseEmissiveIntensity = material.emissiveIntensity;
    }
    if (active) {
      if (material.emissive) {
        if (highlightColor) {
          material.emissive.copy(highlightColor);
        } else {
          material.emissive.setRGB(0.85, 0.85, 0.85);
        }
      }
      if (material.emissiveIntensity != null) {
        const base = child.userData.baseEmissiveIntensity ?? 0.7;
        material.emissiveIntensity = Math.max(base, 1.25);
      }
    } else {
      if (material.emissive && child.userData.baseEmissive) {
        material.emissive.copy(child.userData.baseEmissive);
      }
      if (material.emissiveIntensity != null && child.userData.baseEmissiveIntensity != null) {
        material.emissiveIntensity = child.userData.baseEmissiveIntensity;
      }
    }
  });

  token.userData.isSelectable = !!active;
}

function clearTokenHighlight(token) {
  setTokenHighlight(token, false);
}

function Ludo3D({ avatar, username, aiFlagOverrides, playerCount, aiCount }) {
  const wrapRef = useRef(null);
  const rafRef = useRef(0);
  const zoomRef = useRef({});
  const controlsRef = useRef(null);
  const diceRef = useRef(null);
  const diceTransitionRef = useRef(null);
  const rollDiceRef = useRef(() => {});
  const turnIndicatorRef = useRef(null);
  const stateRef = useRef(null);
  const uiRef = useRef(null);
  const moveSoundRef = useRef(null);
  const captureSoundRef = useRef(null);
  const cheerSoundRef = useRef(null);
  const diceSoundRef = useRef(null);
  const aiTimeoutRef = useRef(null);
  const diceClearTimeoutRef = useRef(null);
  const humanRollTimeoutRef = useRef(null);
  const turnAdvanceTimeoutRef = useRef(null);
  const humanSelectionRef = useRef(null);
  const fitRef = useRef(() => {});
  const activePlayerCount = useMemo(() => clampPlayerCount(playerCount), [playerCount]);
  const aiSlots = Math.max(0, activePlayerCount - 1);
  const aiOpponentCount = useMemo(
    () => clamp(Math.floor(aiCount ?? aiSlots), 0, aiSlots),
    [aiCount, aiSlots]
  );
  const [configOpen, setConfigOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const settingsRef = useRef({ soundEnabled: true });
  const [appearance, setAppearance] = useState(() => {
    if (typeof window === 'undefined') return { ...DEFAULT_APPEARANCE };
    try {
      const stored = window.localStorage?.getItem(APPEARANCE_STORAGE_KEY);
      if (!stored) return { ...DEFAULT_APPEARANCE };
      const parsed = JSON.parse(stored);
      return normalizeAppearance(parsed);
    } catch (error) {
      console.warn('Failed to load Ludo appearance', error);
      return { ...DEFAULT_APPEARANCE };
    }
  });
  const appearanceRef = useRef(appearance);
  const arenaRef = useRef(null);
  const [seatAnchors, setSeatAnchors] = useState([]);
  const seatPositionsRef = useRef([]);
  const [ui, setUi] = useState({
    turn: 0,
    status: 'Your turn — dice rolling soon',
    dice: null,
    winner: null,
    turnCycle: 0
  });

  const playerColorsHex = useMemo(
    () => PLAYER_COLORS.slice(0, activePlayerCount).map((value) => colorNumberToHex(value)),
    [activePlayerCount]
  );

  const aiFlags = useMemo(() => {
    const base = Array.isArray(aiFlagOverrides) ? aiFlagOverrides.filter(Boolean) : [];
    const pool = [...base];
    while (pool.length < aiOpponentCount) {
      pool.push(FLAG_EMOJIS[Math.floor(Math.random() * FLAG_EMOJIS.length)]);
    }
    return pool.slice(0, aiOpponentCount);
  }, [aiFlagOverrides, aiOpponentCount]);

  const players = useMemo(() => {
    return Array.from({ length: activePlayerCount }, (_, index) => {
      if (index === 0) {
        return {
          index,
          photoUrl: avatar || '🙂',
          name: username || 'You',
          color: playerColorsHex[index] ?? '#ffffff',
          isAI: false
        };
      }
      const flag = aiFlags[index - 1] || '🏁';
      const name = avatarToName(flag) || 'AI Player';
      return {
        index,
        photoUrl: flag,
        name,
        color: playerColorsHex[index] ?? '#ffffff',
        isAI: true
      };
    });
  }, [activePlayerCount, aiFlags, avatar, username, playerColorsHex]);

  useEffect(() => {
    uiRef.current = ui;
  }, [ui]);

  const seatAnchorMap = useMemo(() => {
    const map = new Map();
    seatAnchors.forEach((anchor) => {
      if (anchor && typeof anchor.index === 'number') {
        map.set(anchor.index, anchor);
      }
    });
    return map;
  }, [seatAnchors]);

  useEffect(() => {
    appearanceRef.current = appearance;
  }, [activePlayerCount, appearance]);

  const clearHumanRollTimeout = useCallback(() => {
    if (humanRollTimeoutRef.current) {
      clearTimeout(humanRollTimeoutRef.current);
      humanRollTimeoutRef.current = null;
    }
  }, [activePlayerCount]);

  const clearTurnAdvanceTimeout = useCallback(() => {
    if (turnAdvanceTimeoutRef.current) {
      clearTimeout(turnAdvanceTimeoutRef.current);
      turnAdvanceTimeoutRef.current = null;
    }
  }, [activePlayerCount, players]);

  const clearHumanSelection = useCallback(() => {
    const selection = humanSelectionRef.current;
    const state = stateRef.current;
    if (selection && state?.tokens?.[0]) {
      selection.options.forEach((option) => {
        const token = state.tokens[0][option.token];
        clearTokenHighlight(token);
      });
    }
    humanSelectionRef.current = null;
  }, []);

  const beginHumanSelection = useCallback(
    (roll, options) => {
      const state = stateRef.current;
      if (!state || !Array.isArray(options) || !options.length) return;
      clearHumanSelection();
      const normalized = options.map((option) => ({ token: option.token, entering: option.entering }));
      humanSelectionRef.current = { roll, options: normalized };
      normalized.forEach((option) => {
        const token = state.tokens?.[0]?.[option.token];
        if (token) {
          setTokenHighlight(token, true);
        }
      });
      setUi((s) => ({
        ...s,
        status: `Tap a token to move (rolled ${roll})`
      }));
    },
    [clearHumanSelection, setUi]
  );

  const scheduleHumanAutoRoll = useCallback(() => {
    const state = stateRef.current;
    if (!state || state.winner || state.turn !== 0 || state.animation) return;
    if (humanSelectionRef.current) return;
    const diceObj = diceRef.current;
    if (!diceObj || diceObj.userData?.isRolling) return;
    if (humanRollTimeoutRef.current) return;
    humanRollTimeoutRef.current = window.setTimeout(() => {
      humanRollTimeoutRef.current = null;
      rollDiceRef.current?.();
    }, HUMAN_ROLL_DELAY_MS);
  }, []);

  const setTileHighlight = useCallback((tile, active) => {
    if (!tile || !tile.material) return;
    const data = tile.userData?.boardTile;
    if (!data) return;
    if (active) {
      if (tile.material.emissive && data.highlightEmissive) {
        tile.material.emissive.copy(data.highlightEmissive);
      }
      tile.material.emissiveIntensity = data.highlightIntensity;
      data.isHighlighted = true;
    } else {
      if (tile.material.emissive && data.baseEmissive) {
        tile.material.emissive.copy(data.baseEmissive);
      }
      tile.material.emissiveIntensity = data.baseIntensity;
      data.isHighlighted = false;
    }
  }, []);

  const findTileForProgress = useCallback((player, progress) => {
    const state = stateRef.current;
    if (!state) return null;
    if (progress < 0) return null;
    if (progress < RING_STEPS) {
      const trackIndex = (PLAYER_START_INDEX[player] + progress) % RING_STEPS;
      return state.trackTiles?.[trackIndex] ?? null;
    }
    if (progress < RING_STEPS + HOME_STEPS) {
      const step = progress - RING_STEPS;
      return state.homeColumnTiles?.[player]?.[step] ?? null;
    }
    return null;
  }, []);

  const updateAnimationHighlight = useCallback(
    (anim, nextIndex) => {
      if (!anim || !Array.isArray(anim.highlightTiles)) return;
      if (anim.highlightIndex != null && anim.highlightIndex >= 0) {
        const previous = anim.highlightTiles[anim.highlightIndex];
        setTileHighlight(previous, false);
      }
      if (nextIndex != null && nextIndex >= 0 && nextIndex < anim.highlightTiles.length) {
        const nextTile = anim.highlightTiles[nextIndex];
        setTileHighlight(nextTile, true);
        anim.highlightIndex = nextIndex;
      } else {
        anim.highlightIndex = -1;
      }
    },
    [setTileHighlight]
  );

  const updateTokenStacks = useCallback(() => {
    const state = stateRef.current;
    if (!state) return;
    const counts = new Map();
    for (let player = 0; player < activePlayerCount; player += 1) {
      for (let tokenIndex = 0; tokenIndex < 4; tokenIndex += 1) {
        const progress = state.progress?.[player]?.[tokenIndex];
        const token = state.tokens?.[player]?.[tokenIndex];
        if (!token) continue;
        const label = token.userData?.countLabel;
        if (label) {
          label.visible = false;
        }
        if (!Number.isFinite(progress) || progress < 0 || progress > GOAL_PROGRESS) {
          continue;
        }
        const key = `${player}-${progress}`;
        if (!counts.has(key)) counts.set(key, []);
        counts.get(key).push(token);
      }
    }

    counts.forEach((tokens) => {
      if (!Array.isArray(tokens) || tokens.length < 2) return;
      tokens.forEach((token) => {
        const label = token.userData?.countLabel;
        if (!label) return;
        const tokenColor = token.userData?.tokenColor;
        updateTokenCountLabel(label, tokens.length, tokenColor);
        label.visible = true;
      });
    });
  }, []);

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
                className="h-10 w-24 rounded-full border border-white/10"
                style={{
                  background: `linear-gradient(135deg, ${option.baseColor}, ${option.trimColor ?? option.baseColor})`,
                  boxShadow: 'inset 0 0 10px rgba(0,0,0,0.35)'
                }}
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-tr from-white/5 via-transparent to-black/40" />
          </div>
        );
      case 'tableShape': {
        const previewStyle = option.preview || {};
        return (
          <div className="relative h-14 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950/40">
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="h-12 w-24 bg-gradient-to-br from-slate-300/70 via-slate-100/90 to-slate-400/60 shadow-inner"
                style={{
                  borderRadius: previewStyle.borderRadius ?? '999px',
                  clipPath: previewStyle.clipPath,
                  WebkitClipPath: previewStyle.clipPath
                }}
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-tr from-white/5 via-transparent to-black/40" />
          </div>
        );
      }
      case 'tokenStyle':
        return (
          <div className="relative h-14 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950/40">
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-3 text-center text-[0.7rem] font-semibold text-gray-100">
              <span className="rounded-full bg-white/10 px-2 py-1 text-[0.65rem] uppercase tracking-wide text-sky-100/90">
                {option.label}
              </span>
              <span className="text-[0.6rem] font-normal text-white/70">{option.description}</span>
            </div>
            <div className="absolute inset-0 bg-gradient-to-tr from-white/5 via-transparent to-black/40" />
          </div>
        );
      case 'tokenColor': {
        const swatches = option.colors?.slice(0, 4) ?? [];
        return (
          <div className="relative h-14 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950/40">
            <div className="absolute inset-0 flex items-center justify-center gap-1">
              {swatches.map((c, idx) => (
                <span
                  key={`${c}-${idx}`}
                  className="h-8 w-8 rounded-full shadow-inner shadow-black/60"
                  style={{ background: c }}
                  aria-hidden="true"
                />
              ))}
            </div>
            <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-black/40" />
          </div>
        );
      }
      default:
        return null;
    }
  }, []);

  const stopDiceTransition = () => {
    if (diceTransitionRef.current?.cancel) {
      try {
        diceTransitionRef.current.cancel();
      } catch (error) {
        console.warn('Failed to cancel dice transition', error);
      }
    }
    diceTransitionRef.current = null;
  };

  const animateDicePosition = (dice, destination, { duration = 450, lift = 0.04 } = {}) => {
    if (!dice || !destination) return;
    const target = destination.clone ? destination.clone() : new THREE.Vector3().copy(destination);
    stopDiceTransition();
    const startPos = dice.position.clone();
    const started = performance.now();
    const state = { cancelled: false };
    const handle = {
      cancel: () => {
        state.cancelled = true;
      }
    };
    diceTransitionRef.current = handle;
    const step = () => {
      if (state.cancelled) return;
      const now = performance.now();
      const t = Math.min(1, (now - started) / Math.max(1, duration));
      const eased = easeOutCubic(t);
      const pos = startPos.clone().lerp(target, eased);
      if (lift > 0) {
        const arc = Math.sin(Math.PI * eased) * lift * (1 - eased * 0.35);
        pos.y = THREE.MathUtils.lerp(startPos.y, target.y, eased) + arc;
      }
      dice.position.copy(pos);
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        dice.position.copy(target);
        if (diceTransitionRef.current === handle) {
          diceTransitionRef.current = null;
        }
      }
    };
    requestAnimationFrame(step);
  };

  const moveDiceToRail = (player, immediate = false) => {
    const dice = diceRef.current;
    if (!dice) return;
    const rails = dice.userData?.railPositions;
    if (!rails || !rails[player]) return;
    const target = rails[player].clone ? rails[player].clone() : new THREE.Vector3().copy(rails[player]);
    if (immediate) {
      stopDiceTransition();
      dice.position.copy(target);
      return;
    }
    animateDicePosition(dice, target, { duration: 520, lift: 0.05 });
  };

  const updateTurnIndicator = (player, immediate = false) => {
    const indicator = turnIndicatorRef.current;
    if (!indicator) return;
    const material = Array.isArray(indicator.material)
      ? indicator.material[0]
      : indicator.material;
    if (!material) return;
    const color = new THREE.Color(PLAYER_COLORS[player]);
    material.color.set(color);
    if (material.emissive) {
      material.emissive.set(color.clone().multiplyScalar(0.3));
    }
    moveDiceToRail(player, immediate);
  };

  const applyRailLayout = useCallback(() => {
    const dice = diceRef.current;
    const state = stateRef.current;
    if (!dice || !state) return;
    const layouts = dice.userData?.tokenRails;
    if (!Array.isArray(layouts) || layouts.length < activePlayerCount) return;

    const padMeshes = Array.isArray(dice.userData?.railPads) ? dice.userData.railPads : [];
    const updatedPads =
      Array.isArray(state.startPads) && state.startPads.length >= activePlayerCount
        ? state.startPads.slice()
        : Array.from({ length: activePlayerCount }, () =>
            Array.from({ length: 4 }, () => new THREE.Vector3())
          );

    layouts.forEach((layout, player) => {
      if (!layout) {
        if (padMeshes[player]) padMeshes[player].visible = false;
        return;
      }
      const base = layout.base?.clone?.() ? layout.base.clone() : null;
      const forward = layout.forward?.clone?.() ? layout.forward.clone() : null;
      const right = layout.right?.clone?.() ? layout.right.clone() : null;
      if (!base || !forward || !right) {
        if (padMeshes[player]) padMeshes[player].visible = false;
        return;
      }
      forward.setY(0);
      right.setY(0);
      if (forward.lengthSq() < 1e-6) {
        forward.set(0, 0, 1);
      } else {
        forward.normalize();
      }
      if (right.lengthSq() < 1e-6) {
        right.set(-forward.z, 0, forward.x);
      } else {
        right.normalize();
      }

      const centerPull =
        TOKEN_RAIL_CENTER_PULL_PER_PLAYER[player] ?? TOKEN_RAIL_CENTER_PULL_DEFAULT;
      if (centerPull > 0) {
        base.add(forward.clone().multiplyScalar(-centerPull));
      }

      const baseForwardShift = TOKEN_RAIL_BASE_FORWARD_SHIFT[player] ?? 0;
      if (baseForwardShift !== 0) {
        base.add(forward.clone().multiplyScalar(baseForwardShift));
      }

      const forwardOffset = forward.clone().multiplyScalar(RAIL_TOKEN_FORWARD_SPACING);
      const backwardOffset = forwardOffset.clone().multiplyScalar(-1);
      const sideMultiplier = TOKEN_RAIL_SIDE_MULTIPLIER[player] ?? 1;
      const rightOffset = right
        .clone()
        .multiplyScalar(RAIL_TOKEN_SIDE_SPACING * sideMultiplier);
      const leftOffset = rightOffset.clone().multiplyScalar(-1);

      const homeHeight = getTokenRailHeight(player);

      const playerPads = [
        base.clone().add(backwardOffset).add(leftOffset),
        base.clone().add(backwardOffset).add(rightOffset),
        base.clone().add(forwardOffset).add(leftOffset),
        base.clone().add(forwardOffset).add(rightOffset)
      ].map((vec) => {
        vec.y = 0;
        return vec;
      });

      updatedPads[player] = playerPads;

      const mesh = padMeshes[player];
      if (mesh) {
        mesh.visible = true;
        mesh.position.copy(base);
        mesh.position.y = 0;
        mesh.rotation.x = -Math.PI / 2;
        const angle = Math.atan2(forward.x, forward.z);
        mesh.rotation.y = angle;
      }

      for (let tokenIndex = 0; tokenIndex < 4; tokenIndex += 1) {
        if (!state.progress?.[player] || state.progress[player][tokenIndex] == null) continue;
        if (state.progress[player][tokenIndex] >= 0) continue;
        const token = state.tokens?.[player]?.[tokenIndex];
        if (!token) continue;
        const home = playerPads[tokenIndex];
        const target = home.clone();
        target.y = homeHeight;
        token.position.copy(target);
        token.rotation.set(0, 0, 0);
      }
    });

    padMeshes.forEach((mesh, index) => {
      if (!layouts[index] && mesh) {
        mesh.visible = false;
      }
    });

    state.startPads = updatedPads;
  }, [activePlayerCount]);

  const configureDiceAnchors = useCallback(
    ({ dice, boardGroup, chairs, tableInfo } = {}) => {
      const diceObj = dice ?? diceRef.current;
      const arena = arenaRef.current;
      const group = boardGroup ?? arena?.boardGroup;
      const chairList = chairs ?? arena?.chairs;
      const table = tableInfo ?? arena?.tableInfo;
      if (!diceObj || !group) return;

      const centerWorld = new THREE.Vector3();
      const scaleWorld = new THREE.Vector3();
      const centerXZ = new THREE.Vector3();
      group.getWorldPosition(centerWorld);
      group.getWorldScale(scaleWorld);
      centerXZ.set(centerWorld.x, 0, centerWorld.z);

      const heightLocal =
        diceObj.userData?.railHeight ?? diceObj.userData?.baseHeight ?? DICE_BASE_HEIGHT;
      const heightWorld = heightLocal * scaleWorld.y;

      const fallbackDirs = [
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(0, 0, -1),
        new THREE.Vector3(-1, 0, 0)
      ];

      const rails = [];
      const rolls = [];
      const layouts = [];
      const up = new THREE.Vector3(0, 1, 0);
      const centerLocal = new THREE.Vector3();
      centerLocal.copy(centerWorld);
      group.worldToLocal(centerLocal);
      const seatWorldPos = new THREE.Vector3();

      for (let i = 0; i < activePlayerCount; i += 1) {
        const seatDir = new THREE.Vector3();
        const chairGroup = chairList?.[i]?.group;
        if (chairGroup) {
          chairGroup.getWorldPosition(seatDir);
          seatDir.setY(0);
          seatDir.sub(centerXZ);
        } else {
          seatDir.copy(fallbackDirs[i % fallbackDirs.length]);
        }

        if (seatDir.lengthSq() < 1e-6) {
          seatDir.copy(fallbackDirs[i % fallbackDirs.length]);
        }
        seatDir.setY(0);
        if (seatDir.lengthSq() < 1e-6) {
          seatDir.set(0, 0, 1);
        }
        seatDir.normalize();

        let restRadius = BOARD_RADIUS + 0.36;
        if (chairGroup) {
          chairGroup.getWorldPosition(seatWorldPos);
          seatWorldPos.setY(0);
          const seatDistance = seatWorldPos.distanceTo(centerXZ);
          if (Number.isFinite(seatDistance) && seatDistance > 0.2) {
            restRadius = Math.max(restRadius, seatDistance - 0.32);
          }
        }
        if (table?.getInnerRadius) {
          const inner = table.getInnerRadius(seatDir);
          if (Number.isFinite(inner) && inner > 0) {
            const outer = table.getOuterRadius?.(seatDir) ?? inner;
            const rimInner = Math.min(inner, outer);
            const rimOuter = Math.max(inner, outer);
            const rimMid = rimInner + (rimOuter - rimInner) * 0.35;
            restRadius = Math.max(restRadius, THREE.MathUtils.clamp(rimMid, rimInner + 0.05, rimOuter - 0.08));
            restRadius = Math.max(restRadius, BOARD_RADIUS + 0.24);
            if (Number.isFinite(rimOuter)) {
              restRadius = Math.min(restRadius, rimOuter - 0.12);
            }
          }
        }
        if (table?.getOuterRadius) {
          const outer = table.getOuterRadius(seatDir);
          if (Number.isFinite(outer) && outer > 0) {
            restRadius = Math.min(restRadius, outer - 0.14);
          }
        }
        restRadius = Math.max(restRadius, BOARD_RADIUS + 0.24);

        const restWorld = seatDir.clone().multiplyScalar(restRadius).add(centerXZ);
        restWorld.y = centerWorld.y + heightWorld;
        const rollWorld = restWorld.clone();

        const restLocal = restWorld.clone();
        const rollLocal = rollWorld.clone();
        group.worldToLocal(restLocal);
        group.worldToLocal(rollLocal);
        restLocal.y = heightLocal;
        rollLocal.y = heightLocal;

        rails.push(restLocal);
        rolls.push(rollLocal);

        const seatWorldPoint = centerWorld.clone().add(seatDir);
        const seatLocalPoint = seatWorldPoint.clone();
        group.worldToLocal(seatLocalPoint);
        const forwardLocal = seatLocalPoint.sub(centerLocal).setY(0);
        if (forwardLocal.lengthSq() < 1e-6) {
          forwardLocal.set(0, 0, 1);
        } else {
          forwardLocal.normalize();
        }
        const rightLocal = new THREE.Vector3().crossVectors(up, forwardLocal).setY(0);
        if (rightLocal.lengthSq() < 1e-6) {
          rightLocal.set(-forwardLocal.z, 0, forwardLocal.x);
        } else {
          rightLocal.normalize();
        }
        const base = restLocal.clone();
        base.y = 0;
        layouts.push({ base, forward: forwardLocal.clone(), right: rightLocal.clone() });
      }

      diceObj.userData.railPositions = rails;
      const preferredLanding = Array.isArray(diceObj.userData?.homeLandingTargets)
        ? diceObj.userData.homeLandingTargets.map((vec) => vec.clone())
        : rolls.map((vec) => vec.clone());
      diceObj.userData.rollTargets = preferredLanding;
      diceObj.userData.tokenRails = layouts;
      applyRailLayout();
    }, [activePlayerCount, applyRailLayout]);

  useEffect(() => {
    const applyVolume = (baseVolume) => {
      const level = settingsRef.current.soundEnabled ? baseVolume : 0;
      [moveSoundRef, captureSoundRef, cheerSoundRef, diceSoundRef].forEach((ref) => {
        if (ref.current) {
          ref.current.volume = level;
          if (!settingsRef.current.soundEnabled) {
            try {
              ref.current.pause();
              ref.current.currentTime = 0;
            } catch {}
          }
        }
      });
    };
    const vol = getGameVolume();
    moveSoundRef.current = new Audio(dropSound);
    captureSoundRef.current = new Audio(bombSound);
    cheerSoundRef.current = new Audio(cheerSound);
    diceSoundRef.current = new Audio(diceSound);
    applyVolume(vol);
    const onVolChange = () => {
      applyVolume(getGameVolume());
    };
    window.addEventListener('gameVolumeChanged', onVolChange);
    return () => {
      window.removeEventListener('gameVolumeChanged', onVolChange);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (diceClearTimeoutRef.current) {
        clearTimeout(diceClearTimeoutRef.current);
        diceClearTimeoutRef.current = null;
      }
      if (humanRollTimeoutRef.current) {
        clearTimeout(humanRollTimeoutRef.current);
        humanRollTimeoutRef.current = null;
      }
      if (turnAdvanceTimeoutRef.current) {
        clearTimeout(turnAdvanceTimeoutRef.current);
        turnAdvanceTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage?.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(appearance));
      } catch (error) {
        console.warn('Failed to persist Ludo appearance', error);
      }
    }

    const arena = arenaRef.current;
    if (!arena) return;

    const normalized = normalizeAppearance(appearance);
    const safe = enforceShapeForPlayers(normalized, activePlayerCount);
    const woodOption = TABLE_WOOD_OPTIONS[safe.tableWood] ?? TABLE_WOOD_OPTIONS[0];
    const clothOption = TABLE_CLOTH_OPTIONS[safe.tableCloth] ?? TABLE_CLOTH_OPTIONS[0];
    const baseOption = TABLE_BASE_OPTIONS[safe.tableBase] ?? TABLE_BASE_OPTIONS[0];
    const chairOption = CHAIR_COLOR_OPTIONS[safe.chairColor] ?? CHAIR_COLOR_OPTIONS[0];
    const { option: shapeOption, rotationY } = getEffectiveShapeConfig(safe.tableShape, activePlayerCount);

    if (shapeOption) {
      const shapeChanged = shapeOption.id !== arena.tableShapeId;
      const rotationChanged = Math.abs((arena.tableInfo?.rotationY ?? 0) - rotationY) > 1e-3;
      if (shapeChanged || rotationChanged) {
        const boardGroup = arena.boardGroup;
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
          arena.boardLookTarget.set(0, nextTable.surfaceY + CAMERA_TARGET_LIFT, 0);
          arena.defaultLookTarget = arena.boardLookTarget.clone();
        }
        arena.controls?.target.copy(arena.boardLookTarget ?? new THREE.Vector3());
        arena.controls?.update();
        fitRef.current?.();
        configureDiceAnchors({ tableInfo: nextTable, boardGroup, chairs: arena.chairs });
        const currentTurn = stateRef.current?.turn ?? 0;
        moveDiceToRail(currentTurn, true);
      } else if (arena.tableInfo?.materials) {
        applyTableMaterials(arena.tableInfo.materials, { woodOption, clothOption, baseOption }, arena.renderer);
      }
    }

    if (chairOption) {
      const chairTheme = {
        seatColor: chairOption.primary,
        legColor: chairOption.legColor ?? DEFAULT_STOOL_THEME.legColor
      };
      applyChairThemeMaterials(arena, chairTheme);
    }
  }, [appearance]);

  useEffect(() => {
    settingsRef.current.soundEnabled = soundEnabled;
    const baseVolume = getGameVolume();
    const level = soundEnabled ? baseVolume : 0;
    [moveSoundRef, captureSoundRef, cheerSoundRef, diceSoundRef].forEach((ref) => {
      if (ref.current) {
        ref.current.volume = level;
        if (!soundEnabled) {
          try {
            ref.current.pause();
            ref.current.currentTime = 0;
          } catch {}
        }
      }
    });
  }, [soundEnabled]);

  useEffect(() => {
    const host = wrapRef.current;
    if (!host) return;

    let scene = null;
    let camera = null;
    let renderer = null;
    let controls = null;
    let animationId = 0;
    const pointer = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();

    let cancelled = false;
    let onPointerDown = null;
    let onPointerUp = null;
    let onResize = null;

    const setupScene = async () => {

      const baseVolume = settingsRef.current.soundEnabled ? getGameVolume() : 0;
      [moveSoundRef, captureSoundRef, cheerSoundRef, diceSoundRef].forEach((ref) => {
        if (ref.current) {
          ref.current.volume = baseVolume;
        }
      });

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
      renderer.localClippingEnabled = true;
      renderer.shadowMap.enabled = true;
      applyRendererSRGB(renderer);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
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
      scene.background = new THREE.Color('#030712');

      camera = new THREE.PerspectiveCamera(CAM.fov, 1, CAM.near, CAM.far);
      const isPortrait = host.clientHeight > host.clientWidth;
      const cameraSeatAngle = Math.PI / 2;
      const cameraBackOffset = isPortrait ? 2.05 : 1.45;
      const cameraForwardOffset = isPortrait ? 0.12 : 0.25;
      const cameraHeightOffset = isPortrait ? 1.6 : 1.26;
      const chairRadius = AI_CHAIR_RADIUS;
      const cameraRadius = chairRadius + cameraBackOffset - cameraForwardOffset;
      camera.position.set(
        Math.cos(cameraSeatAngle) * cameraRadius,
        TABLE_HEIGHT + cameraHeightOffset,
        Math.sin(cameraSeatAngle) * cameraRadius
      );

      const ambient = new THREE.AmbientLight(0xffffff, 1.08);
      scene.add(ambient);
      const spot = new THREE.SpotLight(0xffffff, 4.8384, TABLE_RADIUS * 10, Math.PI / 3, 0.35, 1);
      spot.position.set(3, 7, 3);
      spot.castShadow = true;
      scene.add(spot);
      const rim = new THREE.PointLight(0x33ccff, 1.728);
      rim.position.set(-4, 3, -4);
      scene.add(rim);

      const arenaGroup = new THREE.Group();
      scene.add(arenaGroup);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(TABLE_RADIUS * ARENA_GROWTH * 3.2, 64),
      new THREE.MeshStandardMaterial({ color: 0x0b1120, roughness: 0.9, metalness: 0.1 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    arenaGroup.add(floor);

    const carpet = new THREE.Mesh(
      new THREE.CircleGeometry(TABLE_RADIUS * ARENA_GROWTH * 2.2, 64),
      createArenaCarpetMaterial(new THREE.Color('#0f172a'), new THREE.Color('#1e3a8a'))
    );
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.y = 0.01;
    carpet.receiveShadow = true;
    arenaGroup.add(carpet);

    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(
        TABLE_RADIUS * ARENA_GROWTH * 2.4,
        TABLE_RADIUS * ARENA_GROWTH * 2.6,
        ARENA_WALL_HEIGHT,
        32,
        1,
        true
      ),
      createArenaWallMaterial('#0b1120', '#1e293b')
    );
    wall.position.y = ARENA_WALL_CENTER_Y;
    arenaGroup.add(wall);

    const initialAppearanceRaw = normalizeAppearance(appearanceRef.current);
    const initialAppearance = enforceShapeForPlayers(initialAppearanceRaw, activePlayerCount);
    const woodOption = TABLE_WOOD_OPTIONS[initialAppearance.tableWood] ?? TABLE_WOOD_OPTIONS[0];
    const clothOption = TABLE_CLOTH_OPTIONS[initialAppearance.tableCloth] ?? TABLE_CLOTH_OPTIONS[0];
    const baseOption = TABLE_BASE_OPTIONS[initialAppearance.tableBase] ?? TABLE_BASE_OPTIONS[0];
    const chairOption = CHAIR_COLOR_OPTIONS[initialAppearance.chairColor] ?? CHAIR_COLOR_OPTIONS[0];
    const { option: shapeOption, rotationY } = getEffectiveShapeConfig(
      initialAppearance.tableShape,
      activePlayerCount
    );

    const tableInfo = createMurlanStyleTable({
      arena: arenaGroup,
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

    const boardGroup = new THREE.Group();
    boardGroup.position.set(0, tableInfo.surfaceY + 0.004, 0);
    boardGroup.scale.setScalar(BOARD_SCALE);
    boardGroup.rotation.y = BOARD_ROTATION_Y;
    tableInfo.group.add(boardGroup);

    const boardLookTarget = new THREE.Vector3(
      0,
      tableInfo.surfaceY + CAMERA_TARGET_LIFT + 0.12 * MODEL_SCALE,
      0
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
    controlsRef.current = controls;

    const fit = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const tableSpan = TABLE_RADIUS * 2.6;
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

    const dollyScale = 1 + CAMERA_DOLLY_FACTOR;
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

    const chairTheme = {
      seatColor: chairOption.primary,
      legColor: chairOption.legColor ?? DEFAULT_STOOL_THEME.legColor
    };
    const chairBuild = await buildChairTemplate(chairTheme);
    if (cancelled || !chairBuild) return;
    const chairTemplate = chairBuild.chairTemplate;
    const chairMaterials = chairBuild.materials;
    applyChairThemeMaterials({ chairMaterials }, chairTheme);

    const chairs = [];
    for (let i = 0; i < activePlayerCount; i += 1) {
      const fallbackAngle = Math.PI / 2 - HUMAN_SEAT_ROTATION_OFFSET - (i / activePlayerCount) * Math.PI * 2;
      const angle = CUSTOM_CHAIR_ANGLES[i] ?? fallbackAngle;
      const forward = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
      const seatPos = forward.clone().multiplyScalar(AI_CHAIR_RADIUS);
      seatPos.y = CHAIR_BASE_HEIGHT;
      const group = new THREE.Group();
      group.position.copy(seatPos);
      group.lookAt(new THREE.Vector3(0, seatPos.y, 0));

      const chairModel = chairTemplate.clone(true);
      chairModel.traverse((obj) => {
        if (obj.isMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
        }
      });
      group.add(chairModel);

      const avatarAnchor = new THREE.Object3D();
      avatarAnchor.position.set(0, AVATAR_ANCHOR_HEIGHT, 0);
      group.add(avatarAnchor);

      arenaGroup.add(group);
      chairs.push({ group, anchor: avatarAnchor });
    }

    const tokenPreferences = {
      styleIndex: initialAppearance.tokenStyle,
      colorSelections: initialAppearance.tokenColors
    };

    const boardData = await buildLudoBoard(boardGroup, activePlayerCount, tokenPreferences);
    diceRef.current = boardData.dice;
    turnIndicatorRef.current = boardData.turnIndicator;
    configureDiceAnchors({ dice: boardData.dice, boardGroup, chairs, tableInfo });
    moveDiceToRail(0, true);
    updateTurnIndicator(0, true);

    stateRef.current = {
      paths: boardData.paths,
      startPads: boardData.startPads,
      homeColumns: boardData.homeColumns,
      goalSlots: boardData.goalSlots,
      tokens: boardData.tokens,
      turnIndicator: boardData.turnIndicator,
      trackTiles: boardData.trackTiles,
      homeColumnTiles: boardData.homeColumnTiles,
      progress: Array.from({ length: activePlayerCount }, () => Array(4).fill(-1)),
      turn: 0,
      winner: null,
      animation: null
    };

    updateTokenStacks();

    applyRailLayout();

    scheduleHumanAutoRoll();

    arenaRef.current = {
      renderer,
      scene,
      camera,
      controls,
      arenaGroup,
      tableInfo,
      tableShapeId: tableInfo.shapeId,
      boardGroup,
      boardLookTarget,
      defaultLookTarget: boardLookTarget.clone(),
      chairTemplate,
      chairMaterials,
      chairs,
      seatAnchors: chairs.map((chair) => chair.anchor)
    };

    const attemptDiceRoll = (clientX, clientY) => {
      const dice = diceRef.current;
      const rollFn = rollDiceRef.current;
      const state = stateRef.current;
      if (
        !dice ||
        !rollFn ||
        !state ||
        state.turn !== 0 ||
        state.winner ||
        state.animation ||
        dice.userData?.isRolling ||
        humanSelectionRef.current
      ) {
        return false;
      }
      const rect = renderer.domElement.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((clientY - rect.top) / rect.height) * 2 + 1;
      pointer.set(x, y);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObject(dice, true);
      if (hit.length) {
        rollFn();
        return true;
      }
      return false;
    };

    const attemptHumanSelection = (clientX, clientY) => {
      const state = stateRef.current;
      const selection = humanSelectionRef.current;
      if (
        !state ||
        state.turn !== 0 ||
        !selection ||
        !Array.isArray(selection.options) ||
        !selection.options.length
      ) {
        return false;
      }
      const rect = renderer.domElement.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((clientY - rect.top) / rect.height) * 2 + 1;
      pointer.set(x, y);
      raycaster.setFromCamera(pointer, camera);
      const tokens = selection.options
        .map((option) => state.tokens?.[0]?.[option.token])
        .filter(Boolean);
      if (!tokens.length) return false;
      const hits = raycaster.intersectObjects(tokens, true);
      if (!hits.length) return false;
      let targetToken = null;
      for (const hit of hits) {
        const group = hit.object?.userData?.tokenGroup;
        if (group && tokens.includes(group)) {
          targetToken = group;
          break;
        }
      }
      if (!targetToken) return false;
      const option = selection.options.find(
        (opt) => state.tokens?.[0]?.[opt.token] === targetToken
      );
      if (!option) return false;
      clearHumanSelection();
      moveToken(0, option.token, selection.roll);
      return true;
    };
    let pointerLocked = false;
    onPointerDown = (event) => {
      const { clientX, clientY } = event;
      if (clientX == null || clientY == null) return;
      let handled = attemptHumanSelection(clientX, clientY);
      if (!handled) {
        handled = attemptDiceRoll(clientX, clientY);
      }
      if (handled) {
        pointerLocked = true;
        if (controls) controls.enabled = false;
        event.preventDefault();
      }
    };
    onPointerUp = () => {
      if (!pointerLocked) return;
      pointerLocked = false;
      if (controls) controls.enabled = true;
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown, { passive: false });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointercancel', onPointerUp, { passive: true });

    let lastFrameTime = performance.now();
    const animTemp = new THREE.Vector3();
    const animDir = new THREE.Vector3();
    const animLook = new THREE.Vector3();
    const seatWorld = new THREE.Vector3();
    const seatNdc = new THREE.Vector3();

    const step = () => {
      const now = performance.now();
      const delta = Math.min(0.12, (now - lastFrameTime) / 1000);
      lastFrameTime = now;

      const state = stateRef.current;
      if (state?.animation?.active) {
        const anim = state.animation;
        const seg = anim.segments?.[anim.segment];
        if (anim.highlightIndex !== anim.segment) {
          updateAnimationHighlight(anim, anim.segment);
        }
        if (!seg) {
          const done = anim.onComplete;
          if (anim.token) {
            setCameraFocus({
              target: anim.token.position.clone(),
              follow: false,
              ttl: 1.4,
              priority: 2,
              offset: CAMERA_TARGET_LIFT + 0.02,
              force: true
            });
          }
          updateAnimationHighlight(anim, -1);
          state.animation = null;
          if (typeof done === 'function') done();
          updateTokenStacks();
        } else {
          anim.elapsed += delta;
          const duration = Math.max(seg.duration, 1e-4);
          const t = Math.min(1, anim.elapsed / duration);
          animTemp.copy(seg.from).lerp(seg.to, t);
          const lift = Math.sin(t * Math.PI) * 0.01;
          animTemp.y = THREE.MathUtils.lerp(seg.from.y, seg.to.y, t) + lift;
          anim.token.position.copy(animTemp);
          animDir.copy(seg.to).sub(seg.from);
          animDir.y = 0;
          if (animDir.lengthSq() > 1e-6) {
            animDir.normalize();
            animLook.copy(anim.token.position).add(animDir);
            anim.token.lookAt(animLook);
          }
          if (t >= 0.999) {
            anim.segment += 1;
            anim.elapsed = 0;
            if (anim.segment >= anim.segments.length) {
              const done = anim.onComplete;
              if (anim.token) {
                setCameraFocus({
                  target: anim.token.position.clone(),
                  follow: false,
                  ttl: 1.5,
                  priority: 2,
                  offset: CAMERA_TARGET_LIFT + 0.02,
                  force: true
                });
              }
              updateAnimationHighlight(anim, -1);
              state.animation = null;
              if (typeof done === 'function') done();
              updateTokenStacks();
            }
          }
        }
      }

      if (diceRef.current) {
        const lights = diceRef.current.userData?.lights;
        if (lights?.accent) {
          const pos = diceRef.current.getWorldPosition(new THREE.Vector3());
          lights.accent.position.copy(pos).add(lights.accent.userData.offset);
          lights.fill.position.copy(pos).add(lights.fill.userData.offset);
          lights.target.position.copy(pos);
        }
      }

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
      controls?.update();
      renderer.render(scene, camera);
      animationId = requestAnimationFrame(step);
    };
    animationId = requestAnimationFrame(step);

    onResize = () => fit();
    window.addEventListener('resize', onResize);

    };

    setupScene();

    return () => {
      cancelled = true;
      clearHumanSelection();
      cancelAnimationFrame(animationId);
      if (aiTimeoutRef.current) {
        clearTimeout(aiTimeoutRef.current);
        aiTimeoutRef.current = null;
      }
      seatPositionsRef.current = [];
      setSeatAnchors([]);
      stateRef.current = null;
      turnIndicatorRef.current = null;
      if (onResize) {
        window.removeEventListener('resize', onResize);
      }
      if (renderer?.domElement && onPointerDown) {
        renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      }
      if (onPointerUp) {
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
      }
      controlsRef.current = null;
      controls?.dispose();
      controls = null;
      stopDiceTransition();
      diceRef.current = null;
      const arena = arenaRef.current;
      if (arena) {
        arena.chairs?.forEach((chair) => {
          if (chair.group.parent) {
            chair.group.parent.remove(chair.group);
          }
        });
        disposeChairAssets(arena.chairTemplate, arena.chairMaterials);
        arena.tableInfo?.dispose?.();
      }
      arenaRef.current = null;
      renderer?.dispose?.();
      if (renderer?.domElement?.parentElement === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, []);

  const playMove = () => {
    if (!settingsRef.current.soundEnabled) return;
    if (moveSoundRef.current) {
      moveSoundRef.current.currentTime = 0;
      moveSoundRef.current.play().catch(() => {});
    }
  };

  const playCapture = () => {
    if (!settingsRef.current.soundEnabled) return;
    if (captureSoundRef.current) {
      captureSoundRef.current.currentTime = 0;
      captureSoundRef.current.play().catch(() => {});
    }
  };

  const playCheer = () => {
    if (!settingsRef.current.soundEnabled) return;
    if (cheerSoundRef.current) {
      cheerSoundRef.current.currentTime = 0;
      cheerSoundRef.current.play().catch(() => {});
    }
  };

  const playDiceSound = () => {
    if (!settingsRef.current.soundEnabled) return;
    if (diceSoundRef.current) {
      diceSoundRef.current.currentTime = 0;
      diceSoundRef.current.play().catch(() => {});
    }
  };

  const setCameraFocus = useCallback(() => {}, []);

  const getWorldForProgress = (player, progress, tokenIndex) => {
    const state = stateRef.current;
    if (!state) return new THREE.Vector3();
    if (progress < 0) {
      const base = state.startPads[player][tokenIndex].clone();
      base.y = getTokenRailHeight(player);
      return base;
    }
    if (progress < RING_STEPS) {
      const idx = (PLAYER_START_INDEX[player] + progress) % RING_STEPS;
      return state.paths[idx].clone().add(TOKEN_TRACK_LIFT.clone());
    }
    if (progress < RING_STEPS + HOME_STEPS) {
      const homeStep = progress - RING_STEPS;
      return state.homeColumns[player][homeStep].clone().add(TOKEN_TRACK_LIFT.clone());
    }
    return state.goalSlots[player][tokenIndex].clone().add(TOKEN_GOAL_LIFT.clone());
  };

  const scheduleMove = (player, tokenIndex, targetProgress, onComplete) => {
    const state = stateRef.current;
    if (!state) return;
    const fromProgress = state.progress[player][tokenIndex];
    const path = [];
    if (fromProgress < 0) {
      path.push({ position: getWorldForProgress(player, -1, tokenIndex), progress: fromProgress });
      path.push({ position: getWorldForProgress(player, 0, tokenIndex), progress: 0 });
    } else {
      path.push({
        position: getWorldForProgress(player, fromProgress, tokenIndex),
        progress: fromProgress
      });
      for (let p = fromProgress + 1; p <= targetProgress; p++) {
        path.push({ position: getWorldForProgress(player, p, tokenIndex), progress: p });
      }
    }
    const token = state.tokens[player][tokenIndex];
    const segments = [];
    const highlightTiles = [];
    for (let i = 0; i < path.length - 1; i++) {
      const from = path[i].position;
      const to = path[i + 1].position;
      const distance = from.distanceTo(to);
      const duration = Math.max(0.12, distance / TOKEN_MOVE_SPEED);
      segments.push({ from, to, distance, duration, progress: path[i + 1].progress });
      const tile = findTileForProgress(player, path[i + 1].progress);
      highlightTiles.push(tile ?? null);
    }
    if (!segments.length) {
      if (token) {
        setCameraFocus({
          target: token.position.clone(),
          follow: false,
          ttl: 1.2,
          priority: 2,
          offset: CAMERA_TARGET_LIFT + 0.02,
          force: true
        });
      }
      state.animation = null;
      if (typeof onComplete === 'function') onComplete();
      return;
    }
      if (token) {
        setCameraFocus({
          object: token,
          follow: true,
          priority: 6,
          offset: CAMERA_TARGET_LIFT + 0.02
        });
      }
    state.animation = {
      active: true,
      token,
      segments,
      segment: 0,
      elapsed: 0,
      onComplete,
      player,
      tokenIndex,
      highlightTiles,
      highlightIndex: -1
    };
  };

  const getTrackIndexForProgress = (player, progress) => {
    if (progress < 0 || progress >= RING_STEPS) return null;
    return (PLAYER_START_INDEX[player] + progress) % RING_STEPS;
  };

  const countCapturesForTarget = (state, player, targetProgress) => {
    if (targetProgress < 0 || targetProgress >= RING_STEPS) return 0;
    const landingIdx = getTrackIndexForProgress(player, targetProgress);
    if (landingIdx == null || SAFE_TRACK_INDEXES.has(landingIdx)) return 0;
    let captures = 0;
    for (let opponent = 0; opponent < activePlayerCount; opponent += 1) {
      if (opponent === player) continue;
      for (let t = 0; t < 4; t += 1) {
        const prog = state.progress[opponent][t];
        if (prog < 0 || prog >= RING_STEPS) continue;
        const idx = getTrackIndexForProgress(opponent, prog);
        if (idx === landingIdx) captures += 1;
      }
    }
    return captures;
  };

  const countOwnStacking = (state, player, targetProgress, ignoreToken) => {
    if (targetProgress < 0 || targetProgress >= RING_STEPS) return 0;
    const landingIdx = getTrackIndexForProgress(player, targetProgress);
    if (landingIdx == null) return 0;
    let stack = 0;
    for (let i = 0; i < 4; i += 1) {
      if (i === ignoreToken) continue;
      const prog = state.progress[player][i];
      if (prog < 0 || prog >= RING_STEPS) continue;
      const idx = getTrackIndexForProgress(player, prog);
      if (idx === landingIdx) stack += 1;
    }
    return stack;
  };

  const countThreatsAgainst = (state, player, targetProgress) => {
    if (!state || targetProgress < 0 || targetProgress >= RING_STEPS) return 0;
    const landingIdx = getTrackIndexForProgress(player, targetProgress);
    if (landingIdx == null || SAFE_TRACK_INDEXES.has(landingIdx)) return 0;
    let threat = 0;
    for (let opponent = 0; opponent < activePlayerCount; opponent += 1) {
      if (opponent === player) continue;
      for (let t = 0; t < 4; t += 1) {
        const prog = state.progress[opponent][t];
        if (prog < 0 || prog >= RING_STEPS) continue;
        const oppIdx = getTrackIndexForProgress(opponent, prog);
        if (oppIdx == null) continue;
        const distance = (landingIdx - oppIdx + RING_STEPS) % RING_STEPS;
        if (distance > 0 && distance <= 6) {
          threat = Math.max(threat, 7 - distance);
        }
      }
    }
    return threat;
  };

  const evaluateMoveOption = (state, player, option, roll) => {
    if (!state) return -Infinity;
    const current = state.progress[player][option.token];
    const target = option.entering ? 0 : current + roll;
    if (target > GOAL_PROGRESS) return -Infinity;
    if (target >= GOAL_PROGRESS) {
      return 10000 + roll * 10;
    }
    let score = 0;
    if (option.entering) {
      score += 180;
      if (state.progress[player].every((p) => p < 0)) {
        score += 50;
      }
    }
    if (target >= RING_STEPS) {
      const stepsIntoHome = target - RING_STEPS + 1;
      score += 600 + stepsIntoHome * 45;
      return score + Math.random() * 0.01;
    }
    const captureCount = countCapturesForTarget(state, player, target);
    if (captureCount > 0) {
      score += 450 + captureCount * 60;
    }
    const landingIdx = getTrackIndexForProgress(player, target);
    let ownStack = 0;
    if (landingIdx != null) {
      if (SAFE_TRACK_INDEXES.has(landingIdx)) {
        score += 80;
      }
      ownStack = countOwnStacking(state, player, target, option.token);
      if (ownStack > 0) {
        score += 60 + ownStack * 25;
      }
    }
    if (!option.entering && current >= 0 && current < RING_STEPS) {
      const fromIdx = getTrackIndexForProgress(player, current);
      if (
        fromIdx != null &&
        SAFE_TRACK_INDEXES.has(fromIdx) &&
        !(landingIdx != null && SAFE_TRACK_INDEXES.has(landingIdx))
      ) {
        score -= 40;
      }
    }
    if (
      landingIdx != null &&
      !SAFE_TRACK_INDEXES.has(landingIdx) &&
      ownStack === 0 &&
      target < RING_STEPS
    ) {
      const threat = countThreatsAgainst(state, player, target);
      if (threat > 0) {
        score -= 45 + threat * 25;
      }
    }
    score += target * 6;
    score += Math.max(0, (RING_STEPS - target) * 0.4);
    return score + Math.random() * 0.01;
  };

  const chooseMoveOption = (state, player, roll, options) => {
    if (!state || !options.length) return null;
    let best = null;
    let bestScore = -Infinity;
    for (const option of options) {
      const score = evaluateMoveOption(state, player, option, roll);
      if (score > bestScore) {
        bestScore = score;
        best = option;
      }
    }
    return best ?? options[0] ?? null;
  };

  const queueAiRoll = useCallback(
    (delay = AI_ROLL_DELAY_MS) => {
      if (aiTimeoutRef.current) {
        clearTimeout(aiTimeoutRef.current);
      }
      aiTimeoutRef.current = window.setTimeout(() => {
        aiTimeoutRef.current = null;
        const nextState = stateRef.current;
        if (!nextState || nextState.winner) return;
        if (nextState.turn === 0) return;
        if (nextState.animation) {
          queueAiRoll(Math.min(400, delay));
          return;
        }
        const diceObj = diceRef.current;
        if (diceObj?.userData?.isRolling) {
          queueAiRoll(Math.min(400, delay));
          return;
        }
        rollDiceRef.current?.();
      }, delay);
    },
    []
  );

  const scheduleDiceClear = useCallback(() => {
    if (diceClearTimeoutRef.current) {
      clearTimeout(diceClearTimeoutRef.current);
    }
    diceClearTimeoutRef.current = window.setTimeout(() => {
      diceClearTimeoutRef.current = null;
      setUi((s) => {
        if (s.dice == null) return s;
        return { ...s, dice: null };
      });
    }, 2000 + DICE_RESULT_EXTRA_HOLD_MS);
  }, [setUi]);

  const advanceTurn = (extraTurn) => {
    clearTurnAdvanceTimeout();
    clearHumanSelection();
    let nextTurn = 0;
    let updated = false;
    setUi((s) => {
      if (s.winner) return s;
      const playerCycle = Math.max(1, activePlayerCount);
      nextTurn = extraTurn ? s.turn : (s.turn + playerCycle - 1) % playerCycle;
      const state = stateRef.current;
      if (state) state.turn = nextTurn;
      updateTurnIndicator(nextTurn);
      updated = true;
      const status =
        nextTurn === 0
          ? extraTurn
            ? 'You rolled a 6 — rolling again'
            : 'Your turn — dice rolling soon'
          : extraTurn
          ? `${COLOR_NAMES[nextTurn]} rolled a 6 — rolling again`
          : `${COLOR_NAMES[nextTurn]} to roll`;
      return {
        ...s,
        turn: nextTurn,
        turnCycle: (s.turnCycle ?? 0) + 1,
        status
      };
    });
    if (!updated) {
      if (aiTimeoutRef.current) {
        clearTimeout(aiTimeoutRef.current);
        aiTimeoutRef.current = null;
      }
      clearHumanRollTimeout();
      return;
    }
    scheduleDiceClear();
    if (nextTurn === 0) {
      clearHumanRollTimeout();
      scheduleHumanAutoRoll();
      if (aiTimeoutRef.current) {
        clearTimeout(aiTimeoutRef.current);
        aiTimeoutRef.current = null;
      }
    } else {
      clearHumanRollTimeout();
      const delay = extraTurn ? AI_EXTRA_TURN_DELAY_MS : AI_ROLL_DELAY_MS;
      queueAiRoll(delay);
    }
  };

  const handleCaptures = (player, tokenIndex) => {
    const state = stateRef.current;
    if (!state) return;
    const prog = state.progress[player][tokenIndex];
    if (prog < 0 || prog >= RING_STEPS) return;
    const landingIdx = (PLAYER_START_INDEX[player] + prog) % RING_STEPS;
    if (SAFE_TRACK_INDEXES.has(landingIdx)) return;
    for (let p = 0; p < activePlayerCount; p++) {
      if (p === player) continue;
      for (let t = 0; t < 4; t++) {
        if (state.progress[p][t] < 0 || state.progress[p][t] >= RING_STEPS) continue;
        const idx = (PLAYER_START_INDEX[p] + state.progress[p][t]) % RING_STEPS;
        if (idx === landingIdx) {
          state.progress[p][t] = -1;
          const token = state.tokens[p][t];
          const pos = state.startPads[p][t].clone();
          pos.y = getTokenRailHeight(p);
          token.position.copy(pos);
          token.rotation.set(0, 0, 0);
          playCapture();
        }
      }
    }
  };

  const checkWin = (player) => {
    const state = stateRef.current;
    if (!state) return false;
    const allHome = state.progress[player].every((p) => p >= GOAL_PROGRESS);
    if (allHome) {
      state.winner = player;
      clearHumanSelection();
      setUi((s) => ({
        ...s,
        winner: COLOR_NAMES[player],
        status: `${COLOR_NAMES[player]} wins!`
      }));
      clearHumanRollTimeout();
      playCheer();
      coinConfetti();
      return true;
    }
    return false;
  };

  const moveToken = (player, tokenIndex, roll) => {
    const state = stateRef.current;
    if (!state) return;
    const current = state.progress[player][tokenIndex];
    const entering = current < 0;
    const target = entering ? 0 : current + roll;
    if (target > GOAL_PROGRESS) return advanceTurn(false);
    const applyResult = () => {
      state.progress[player][tokenIndex] = target;
      const finalPos = getWorldForProgress(player, target, tokenIndex);
      state.tokens[player][tokenIndex].position.copy(finalPos);
      state.tokens[player][tokenIndex].rotation.set(0, 0, 0);
      playMove();
      handleCaptures(player, tokenIndex);
      updateTokenStacks();
      const winner = checkWin(player);
      advanceTurn(!winner && roll === 6);
    };
    if (entering || target !== current) {
      scheduleMove(player, tokenIndex, target, applyResult);
    } else {
      applyResult();
    }
  };

  const getMovableTokens = (player, roll) => {
    const state = stateRef.current;
    if (!state) return [];
    const list = [];
    for (let i = 0; i < 4; i++) {
      const prog = state.progress[player][i];
      if (prog < 0) {
        if (roll === 6) list.push({ token: i, entering: true });
        continue;
      }
      const target = prog + roll;
      if (target <= GOAL_PROGRESS) list.push({ token: i, entering: false });
    }
    return list;
  };

  const rollDice = async () => {
    const state = stateRef.current;
    clearHumanRollTimeout();
    clearTurnAdvanceTimeout();
    clearHumanSelection();
    if (!state || state.winner) return;
    if (state.animation) return;
    const dice = diceRef.current;
    if (!dice || dice.userData?.isRolling) return;
    const player = state.turn;
    const baseHeight = dice.userData?.baseHeight ?? DICE_BASE_HEIGHT;
    const rollTargets = dice.userData?.rollTargets;
    const clothLimit = dice.userData?.clothLimit ?? BOARD_CLOTH_HALF - 0.12;
    const baseTarget = rollTargets?.[player]?.clone() ?? new THREE.Vector3(0, baseHeight, 0);
    baseTarget.x = THREE.MathUtils.clamp(baseTarget.x, -clothLimit, clothLimit);
    baseTarget.z = THREE.MathUtils.clamp(baseTarget.z, -clothLimit, clothLimit);
    baseTarget.y = baseHeight;
    stopDiceTransition();
    dice.userData.isRolling = true;
    setCameraFocus({
      object: dice,
      follow: true,
      priority: 4,
      offset: CAMERA_TARGET_LIFT + 0.04
    });
    playDiceSound();
    const landingFocus = baseTarget.clone();
    const value = await spinDice(dice, {
      duration: AUTO_ROLL_DURATION_MS,
      targetPosition: baseTarget,
      bounceHeight: dice.userData?.bounceHeight ?? 0.06
    });
    dice.userData.isRolling = false;
    setCameraFocus({
      target: landingFocus,
      follow: false,
      ttl: 1.6 + DICE_RESULT_EXTRA_HOLD_MS / 1000,
      priority: 3,
      offset: CAMERA_TARGET_LIFT + 0.03,
      force: true
    });
    setUi((s) => ({
      ...s,
      dice: value,
      status: player === 0 ? `You rolled ${value}` : `${COLOR_NAMES[player]} rolled ${value}`
    }));
    scheduleDiceClear();
    const options = getMovableTokens(player, value);
    if (!options.length) {
      clearTurnAdvanceTimeout();
      turnAdvanceTimeoutRef.current = window.setTimeout(() => {
        turnAdvanceTimeoutRef.current = null;
        advanceTurn(value === 6);
      }, DICE_RESULT_EXTRA_HOLD_MS);
      return;
    }
    if (player === 0) {
      beginHumanSelection(value, options);
      return;
    }
    const choice = chooseMoveOption(state, player, value, options);
    if (!choice) {
      clearTurnAdvanceTimeout();
      turnAdvanceTimeoutRef.current = window.setTimeout(() => {
        turnAdvanceTimeoutRef.current = null;
        advanceTurn(value === 6);
      }, DICE_RESULT_EXTRA_HOLD_MS);
      return;
    }
    moveToken(player, choice.token, value);
  };

  rollDiceRef.current = rollDice;

  useEffect(() => {
    const state = stateRef.current;
    if (ui.winner) return undefined;
    if (!state) return undefined;
    if (ui.turn === 0) return undefined;
    if (state.turn !== ui.turn) return undefined;
    if (state.animation) return undefined;
    if (!aiTimeoutRef.current) {
      queueAiRoll();
    }

    return () => {
      if (aiTimeoutRef.current) {
        clearTimeout(aiTimeoutRef.current);
        aiTimeoutRef.current = null;
      }
    };
  }, [ui.turn, ui.turnCycle, ui.winner, queueAiRoll]);

  return (
    <div
      ref={wrapRef}
      className="fixed inset-0 bg-[#0c1020] text-white touch-none select-none"
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-4 left-4 z-20 flex flex-col items-start gap-3 pointer-events-none">
          <div className="pointer-events-none rounded bg-white/10 px-3 py-2 text-xs">
            <div className="font-semibold">{ui.status}</div>
            {ui.dice != null && (
              <div className="mt-1 text-[10px]">Rolled: {ui.dice}</div>
            )}
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
                        const disabled =
                          key === 'tableShape' && option.id === DIAMOND_SHAPE_ID && DEFAULT_PLAYER_COUNT > 4;
                        return (
                          <button
                            key={option.id ?? idx}
                            type="button"
                            onClick={() => {
                              if (disabled) return;
                              setAppearance((prev) => ({ ...prev, [key]: idx }));
                            }}
                            aria-pressed={selected}
                            disabled={disabled}
                            className={`flex flex-col items-center rounded-2xl border p-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                              selected
                                ? 'border-sky-400/80 bg-sky-400/10 shadow-[0_0_12px_rgba(56,189,248,0.35)]'
                                : 'border-white/10 bg-white/5 hover:border-white/20'
                            } ${disabled ? 'cursor-not-allowed opacity-50 hover:border-white/10' : ''}`}
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
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-[0.35em] text-white/60">Token Colors</p>
                  <div className="space-y-3">
                    {TOKEN_COLOR_OPTIONS_BY_PLAYER.map((options, playerIdx) => (
                      <div key={`token-colors-${playerIdx}`} className="space-y-2">
                        <p className="text-[0.65rem] font-semibold text-gray-300">
                          {COLOR_NAMES[playerIdx]} Tokens
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {options.map((option, idx) => {
                            const selected = (appearance.tokenColors?.[playerIdx] ?? 0) === idx;
                            return (
                              <button
                                key={option.id}
                                type="button"
                                onClick={() => {
                                  setAppearance((prev) => {
                                    const next = Array.isArray(prev.tokenColors)
                                      ? [...prev.tokenColors]
                                      : [0, 0, 0, 0];
                                    next[playerIdx] = idx;
                                    return { ...prev, tokenColors: next };
                                  });
                                }}
                                aria-pressed={selected}
                                className={`flex flex-col items-center rounded-2xl border p-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                                  selected
                                    ? 'border-emerald-400/80 bg-emerald-400/10 shadow-[0_0_12px_rgba(52,211,153,0.35)]'
                                    : 'border-white/10 bg-white/5 hover:border-white/20'
                                }`}
                              >
                                {renderPreview('tokenColor', option)}
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
                  Restart game
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
            const isTurn = ui.turn === player.index;
            return (
              <div
                key={`ludo-seat-${player.index}`}
                className="absolute pointer-events-auto flex flex-col items-center"
                style={positionStyle}
              >
                <AvatarTimer
                  index={player.index}
                  photoUrl={player.photoUrl}
                  active={isTurn}
                  isTurn={isTurn}
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
            {avatar && (
              <img src={avatar} alt="avatar" className="h-7 w-7 rounded-full object-cover" />
            )}
            <span>{username || 'Guest'}</span>
          </div>
        </div>
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="px-5 py-2 rounded-full bg-[rgba(7,10,18,0.65)] border border-[rgba(255,215,0,0.25)] text-sm font-semibold backdrop-blur">
            {ui.winner
              ? `${ui.winner} Wins`
              : ui.turn === 0
              ? 'Your turn — dice rolling soon'
              : ui.status}
          </div>
        </div>
        <div className="absolute right-3 bottom-3 flex flex-col space-y-2">
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

async function buildLudoBoard(boardGroup, playerCount = DEFAULT_PLAYER_COUNT, tokenPreferences = {}) {
  const scene = boardGroup;

  const abgAssets = await getAbgAssets();
  const boardPalette = abgAssets?.boardPalette ?? { light: null, dark: null };
  const lightBoardMat = cloneBoardMaterial(boardPalette.light, 0xfef9ef);
  const darkBoardMat = cloneBoardMaterial(boardPalette.dark ?? boardPalette.light, 0xdccfb0);
  const playerTokenSelections = PLAYER_COLORS.map((_, idx) =>
    selectTokenColorsForPlayer(idx, tokenPreferences.colorSelections)
  );
  const playerPalettes = PLAYER_COLORS.map((color, idx) => {
    const src = idx % 2 === 0 ? abgAssets?.palettes?.w : abgAssets?.palettes?.b;
    const tones = playerTokenSelections[idx]?.colors ?? [colorNumberToHex(color)];
    return tintPaletteWithColors(src, tones);
  });
  const tokenPrimaryColors = playerTokenSelections.map(
    (selection, idx) => selection?.colors?.[0] ?? colorNumberToHex(PLAYER_COLORS[idx])
  );

  const trackTileMeshes = new Array(RING_STEPS).fill(null);
  const homeColumnTiles = Array.from({ length: playerCount }, () =>
    new Array(HOME_STEPS).fill(null)
  );

  const registerTile = (mesh) => {
    if (!mesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const mat = mesh.material;
    const baseEmissive = mat?.emissive?.clone?.() ?? new THREE.Color(0x000000);
    const baseIntensity = mat?.emissiveIntensity ?? 0;
    const baseColor = mat?.color?.clone?.() ?? new THREE.Color(0xffffff);
    const highlightEmissive = baseColor.clone().lerp(new THREE.Color(0xffffff), 0.6);
    mesh.userData = {
      ...mesh.userData,
      boardTile: {
        baseEmissive,
        baseIntensity,
        highlightEmissive,
        highlightIntensity: Math.max(baseIntensity + 0.7, 0.75)
      }
    };
  };

  const half = (LUDO_GRID * LUDO_TILE) / 2;
  const cellToWorld = (r, c) => {
    const x = -half + (c + 0.5) * LUDO_TILE;
    const z = -half + (r + 0.5) * LUDO_TILE;
    return new THREE.Vector3(x, TILE_HALF_HEIGHT, z);
  };

  const startPads = getHomeStartPads(half, playerCount);
  const goalSlots = getGoalSlots(half, playerCount);
  const ringPath = buildRingFromGrid(cellToWorld);
  const homeColumnPositions = HOME_COLUMN_COORDS.slice(0, playerCount).map((coords) =>
    coords.map(([r, c]) => cellToWorld(r, c))
  );
  const diceRollTargets = startPads.map((pads) => {
    if (!Array.isArray(pads) || !pads.length) {
      return new THREE.Vector3(0, DICE_BASE_HEIGHT, 0);
    }
    const center = pads.reduce(
      (acc, pad) => acc.add(pad.clone()),
      new THREE.Vector3()
    );
    center.multiplyScalar(1 / pads.length);
    center.y = DICE_BASE_HEIGHT;
    return center;
  });

  const tileSize = LUDO_TILE * 0.92;
  const tileGeo = new THREE.BoxGeometry(tileSize, PLAYFIELD_HEIGHT, tileSize);
  for (let r = 0; r < LUDO_GRID; r++) {
    for (let c = 0; c < LUDO_GRID; c++) {
      const pos = cellToWorld(r, c);
      const key = `${r},${c}`;
      const homeIndex = getHomeIndex(r, c);
      const columnIndex = getHomeColumnIndex(r, c);
      const inCenter = r >= 6 && r <= 8 && c >= 6 && c <= 8;
      const inCross = (r >= 6 && r <= 8) || (c >= 6 && c <= 8);
      const inTrimmedOuter = r < 2 || r > LUDO_GRID - 3 || c < 2 || c > LUDO_GRID - 3;
      if (homeIndex !== -1) {
        continue;
      }
      if (inCenter) {
        continue;
      }
      if (columnIndex !== -1 && columnIndex < playerCount) {
        const baseColor = PLAYER_COLORS[columnIndex];
        const mesh = new THREE.Mesh(tileGeo, cloneBoardMaterial(darkBoardMat, baseColor));
        mesh.position.copy(pos);
        registerTile(mesh);
        const stepIndex = HOME_COLUMN_KEY_TO_STEP.get(key);
        if (stepIndex != null && homeColumnTiles[columnIndex]) {
          homeColumnTiles[columnIndex][stepIndex] = mesh;
        }
        scene.add(mesh);
        continue;
      }
      if (TRACK_KEY_SET.has(key)) {
        const isSafe = SAFE_TRACK_KEY_SET.has(key);
        const baseColor = isSafe ? 0xf4e3bd : 0xfef9ef;
        const mesh = new THREE.Mesh(tileGeo, cloneBoardMaterial(isSafe ? darkBoardMat : lightBoardMat, baseColor));
        mesh.position.copy(pos);
        registerTile(mesh);
        const trackIndex = TRACK_INDEX_BY_KEY.get(key);
        if (trackIndex != null) {
          trackTileMeshes[trackIndex] = mesh;
        }
        scene.add(mesh);
        continue;
      }
      if (inTrimmedOuter || inCross) {
        continue;
      }
    }
  }

  addCenterHome(scene);
  addBoardMarkers(scene, cellToWorld);

  const tokenStyleOption = TOKEN_STYLE_OPTIONS[tokenPreferences.styleIndex] ?? TOKEN_STYLE_OPTIONS[0];
  const tokens = tokenPrimaryColors.slice(0, playerCount).map((color, playerIdx) => {
    const palette = playerPalettes[playerIdx] ?? [];
    return Array.from({ length: 4 }, (_, i) => {
      const type =
        tokenStyleOption?.type ?? TOKEN_TYPE_SEQUENCE[i % TOKEN_TYPE_SEQUENCE.length];
      const baseProto =
        abgAssets?.proto?.w?.[type] ||
        abgAssets?.proto?.b?.[type] ||
        null;
      const token = baseProto ? baseProto.clone(true) : makeRook(makeTokenMaterial(color));
      if (baseProto && palette.length) {
        abgApplyPalette(token, palette);
      }
      const label = createTokenCountLabel();
      if (label) {
        token.add(label);
        token.userData.countLabel = label;
      }
      if (!token.userData) token.userData = {};
      token.userData.tokenColor = typeof color === 'string' ? color : colorNumberToHex(color);
      token.userData.tokenType = type;
      token.userData.playerIndex = playerIdx;
      token.userData.tokenIndex = i;
      token.traverse((node) => {
        if (!node.userData) node.userData = {};
        node.userData.tokenGroup = token;
        node.userData.playerIndex = playerIdx;
        node.userData.tokenIndex = i;
      });
      const homePos = startPads[playerIdx][i].clone();
      homePos.y = getTokenRailHeight(playerIdx);
      token.position.copy(homePos);
      scene.add(token);
      return token;
    });
  });

  const dice = makeDice();
  dice.userData.homeLandingTargets = diceRollTargets.map((target) => target.clone());
  dice.userData.rollTargets = diceRollTargets.map((target) => target.clone());
  const clothHalf = BOARD_CLOTH_HALF;
  const railHeight = DICE_BASE_HEIGHT;
  const diceAnchor = new THREE.Vector3(0, railHeight, 0);
  const railPositions = Array.from({ length: playerCount }, () => diceAnchor.clone());
  dice.position.copy(diceAnchor);
  dice.userData.railPositions = railPositions.map((pos) => pos.clone());
  dice.userData.baseHeight = DICE_BASE_HEIGHT;
  dice.userData.railHeight = railHeight;
  dice.userData.bounceHeight = 0.07;
  dice.userData.clothLimit = clothHalf - 0.12;
  dice.userData.isRolling = false;
  dice.userData.railPads = Array.from({ length: playerCount }, () => null);
  scene.add(dice);

  const diceLightTarget = new THREE.Object3D();
  scene.add(diceLightTarget);

  const diceAccent = new THREE.SpotLight(0xffffff, 2.1, 3.4, Math.PI / 5, 0.42, 1.25);
  diceAccent.userData.offset = new THREE.Vector3(0.45, 1.55, 1.05);
  diceAccent.target = diceLightTarget;
  scene.add(diceAccent);

  const diceFill = new THREE.PointLight(0xfff8e1, 1.05, 2.6, 2.2);
  diceFill.userData.offset = new THREE.Vector3(-0.65, 1.25, -0.75);
  scene.add(diceFill);

  dice.userData.lights = {
    accent: diceAccent,
    fill: diceFill,
    target: diceLightTarget
  };

  const indicatorMat = new THREE.MeshStandardMaterial({
    color: PLAYER_COLORS[0],
    emissive: new THREE.Color(PLAYER_COLORS[0]).multiplyScalar(0.3),
    emissiveIntensity: 0.9,
    metalness: 0.45,
    roughness: 0.35,
    side: THREE.DoubleSide
  });
  const turnIndicator = new THREE.Mesh(
    new THREE.RingGeometry(0.05, 0.075, 48),
    indicatorMat
  );
  turnIndicator.rotation.x = -Math.PI / 2;
  turnIndicator.position.set(0, 0.006, 0);
  scene.add(turnIndicator);

  return {
    paths: ringPath,
    startPads,
    homeColumns: homeColumnPositions,
    goalSlots,
    tokens,
    dice,
    turnIndicator,
    trackTiles: trackTileMeshes,
    homeColumnTiles
  };
}

function getHomeIndex(r, c) {
  if (r < 6 && c < 6) return 0;
  if (r < 6 && c > 8) return 1;
  if (r > 8 && c < 6) return 3;
  if (r > 8 && c > 8) return 2;
  return -1;
}

function getHomeColumnIndex(r, c) {
  const value = HOME_COLUMN_KEY_TO_PLAYER.get(keyFor(r, c));
  return value == null ? -1 : value;
}

function buildRingFromGrid(cellToWorld) {
  return TRACK_COORDS.map(([r, c]) => cellToWorld(r, c));
}

function getHomeStartPads(half, playerCount = DEFAULT_PLAYER_COUNT) {
  const count = clampPlayerCount(playerCount);
  const TILE = LUDO_TILE;
  const off = half - TILE * 3;
  const inwardPull = TILE * 0.45;
  const lateralSpread = TILE * 0.92;
  const depthSpread = TILE * 0.64;
  const layout = [
    [1, 1],
    [1, -1],
    [-1, -1],
    [-1, 1]
  ];
  return layout.slice(0, count).map(([sx, sz]) => {
    const cx = sx * off - sx * inwardPull;
    const cz = sz * off - sz * inwardPull;
    return [
      new THREE.Vector3(cx - lateralSpread, 0, cz - depthSpread),
      new THREE.Vector3(cx + lateralSpread, 0, cz - depthSpread),
      new THREE.Vector3(cx - lateralSpread, 0, cz + depthSpread),
      new THREE.Vector3(cx + lateralSpread, 0, cz + depthSpread)
    ];
  });
}

function getGoalSlots(half, playerCount = DEFAULT_PLAYER_COUNT) {
  const TILE = LUDO_TILE;
  const offsets = [
    [-TILE * 0.3, -TILE * 0.3],
    [TILE * 0.3, -TILE * 0.3],
    [-TILE * 0.3, TILE * 0.3],
    [TILE * 0.3, TILE * 0.3]
  ];
  const count = clampPlayerCount(playerCount);
  return Array.from({ length: count }, () =>
    offsets.map(([ox, oz]) => new THREE.Vector3(ox, PLAYFIELD_HEIGHT, oz))
  );
}

export default function LudoBattleRoyal() {
  useTelegramBackButton();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const avatar = params.get('avatar') || getTelegramPhotoUrl();
  const username =
    params.get('username') ||
    params.get('name') ||
    getTelegramFirstName() ||
    getTelegramUsername();
  const tableId = params.get('table') || 'royale';
  const capacityParam = parseInt(params.get('capacity') ?? '', 10);
  const aiParam = parseInt(params.get('ai') ?? '', 10);
  const parsedCapacity = clampPlayerCount(capacityParam);
  const requestedAiCount = clamp(Math.max(0, aiParam || 0), 0, DEFAULT_PLAYER_COUNT - 1);
  const playerCount = tableId === 'practice'
    ? clampPlayerCount(1 + requestedAiCount)
    : parsedCapacity;
  const flagsParam = params.get('flags');
  const aiFlagOverrides = useMemo(() => {
    if (!flagsParam) return null;
    const indices = flagsParam
      .split(',')
      .map((value) => parseInt(value, 10))
      .filter((idx) => Number.isFinite(idx) && idx >= 0 && idx < FLAG_EMOJIS.length);
    if (!indices.length) return null;
    return indices.map((idx) => FLAG_EMOJIS[idx]);
  }, [flagsParam]);
  return (
    <Ludo3D
      avatar={avatar}
      username={username}
      aiFlagOverrides={aiFlagOverrides}
      playerCount={playerCount}
      aiCount={tableId === 'practice' ? requestedAiCount : playerCount - 1}
    />
  );
}
