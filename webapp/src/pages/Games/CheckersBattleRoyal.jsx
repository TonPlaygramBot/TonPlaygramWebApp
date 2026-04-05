import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { GroundedSkybox } from 'three/examples/jsm/objects/GroundedSkybox.js';
import {
  applyRendererSRGB,
  applySRGBColorSpace
} from '../../utils/colorSpace.js';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import {
  ensureAccountId,
  getTelegramFirstName,
  getTelegramPhotoUrl,
  getTelegramUsername
} from '../../utils/telegram.js';
import { ARENA_CAMERA_DEFAULTS } from '../../utils/arenaCameraConfig.js';
import {
  createMurlanStyleTable,
  applyTableMaterials,
  TABLE_SHAPE_OPTIONS
} from '../../utils/murlanTable.js';
import { TABLE_CLOTH_OPTIONS } from '../../utils/tableCustomizationOptions.js';
import AvatarTimer from '../../components/AvatarTimer.jsx';
import BottomLeftIcons from '../../components/BottomLeftIcons.jsx';
import GiftPopup from '../../components/GiftPopup.jsx';
import {
  CHESS_BATTLE_OPTION_LABELS,
  CHESS_BATTLE_OPTION_THUMBNAILS,
  CHESS_CHAIR_OPTIONS,
  CHESS_TABLE_OPTIONS
} from '../../config/chessBattleInventoryConfig.js';
import {
  POOL_ROYALE_DEFAULT_HDRI_ID,
  POOL_ROYALE_HDRI_VARIANTS,
  POOL_ROYALE_HDRI_VARIANT_MAP
} from '../../config/poolRoyaleInventoryConfig.js';
import { MURLAN_TABLE_FINISHES } from '../../config/murlanTableFinishes.js';
import { bombSound } from '../../assets/soundData.js';
import coinConfetti from '../../utils/coinConfetti';
import { getGameVolume } from '../../utils/sound.js';
import { giftSounds } from '../../utils/giftSounds.js';
import {
  chessBattleAccountId,
  getChessBattleInventory,
  isChessOptionUnlocked,
  setChessBattleEquippedOption
} from '../../utils/chessBattleInventory.js';
import { getCustomHdriVariantsForGame } from '../../utils/customHdriCatalog.js';
import { socket } from '../../utils/socket.js';

const SIZE = 8;
const CHECKERS_ARENA_SCALE = 0.48;
const MODEL_SCALE = 0.75 * CHECKERS_ARENA_SCALE;
const STOOL_SCALE = 0.92 * CHECKERS_ARENA_SCALE;
const TABLE_RADIUS = 3.0 * MODEL_SCALE;
const BASE_TABLE_HEIGHT = 0.98 * MODEL_SCALE;
const SEAT_THICKNESS = 0.09 * MODEL_SCALE * STOOL_SCALE;
const CHAIR_BASE_HEIGHT =
  BASE_TABLE_HEIGHT - SEAT_THICKNESS * 0.85 - 0.4 * MODEL_SCALE;
const CHAIR_HEIGHT = CHAIR_BASE_HEIGHT;
const STOOL_HEIGHT = CHAIR_BASE_HEIGHT + SEAT_THICKNESS;
const TABLE_HEIGHT = STOOL_HEIGHT + 0.05 * MODEL_SCALE;
const BOARD_SCALE = 0.055 * CHECKERS_ARENA_SCALE;
const BOARD_TILE_SIZE = ((SIZE * 4.2 + 3 * 2) * BOARD_SCALE) / SIZE;
const BOARD_MODEL_OUTER_TO_PLAYABLE_RATIO = 1.14;
// ABeautifulGame GLTF contains a wider decorative frame than the fallback board,
// so the playable checker squares need a tighter mapping ratio to keep pieces
// centered on the dark tiles across portrait/mobile camera angles.
// Tuned against the GLTF board in portrait 2D camera mode so starting chips
// sit exactly on the playable dark squares instead of drifting toward the
// decorative rim.
const CHECKERS_PLAYABLE_MAPPING_RATIO = 1.44;
// Portrait mobile framing tweak: push chairs visibly away from the table.
const CHAIR_OUTWARD_OFFSET = 0.11;
const CHAIR_DISTANCE =
  TABLE_RADIUS + 0.56 * CHECKERS_ARENA_SCALE + CHAIR_OUTWARD_OFFSET;
const SEAT_WIDTH = 0.9 * MODEL_SCALE * STOOL_SCALE;
const SEAT_DEPTH = 0.95 * MODEL_SCALE * STOOL_SCALE;
const SEAT_THICKNESS_SCALED = 0.09 * MODEL_SCALE * STOOL_SCALE;
const BACK_HEIGHT = 0.68 * MODEL_SCALE * STOOL_SCALE;
const BACK_THICKNESS = 0.08 * MODEL_SCALE * STOOL_SCALE;
const ARM_THICKNESS = 0.125 * MODEL_SCALE * STOOL_SCALE;
const ARM_HEIGHT = 0.3 * MODEL_SCALE * STOOL_SCALE;
const ARM_DEPTH = SEAT_DEPTH * 0.75;
const BASE_COLUMN_HEIGHT = 0.5 * MODEL_SCALE * STOOL_SCALE;
const DEFAULT_HDRI_RESOLUTIONS = Object.freeze(['4k']);
const DEFAULT_HDRI_CAMERA_HEIGHT_M = 1.5;
const HDRI_UNITS_PER_METER = 1;
const MIN_HDRI_CAMERA_HEIGHT_M = 0.9;
const MIN_HDRI_RADIUS = 28;
const DEFAULT_HDRI_RADIUS_MULTIPLIER = 6;
const DEFAULT_HDRI_GROUNDED_RESOLUTION = 256;
const CHECKERS_ROOM_HALF_SPAN = CHAIR_DISTANCE + SEAT_DEPTH;
const CHECKERS_TABLE_BASE_HEIGHT_SCALE = 0.5;
const CHECKERS_TABLE_BASE_RADIUS_SCALE = 0.56;
const CHECKERS_TABLE_TRIM_HEIGHT_SCALE = 0.66;
const CHECKERS_TABLE_TRIM_RADIUS_SCALE = 0.74;
const CHECKERS_CAMERA_FRAME_COMPENSATION = 1.08;
// Lower chairs toward the floor for stronger downward screen placement.
const CHECKERS_GRAPHICS_PROFILE_STORAGE_KEY =
  'checkersBattleRoyalGraphicsProfile';
const CHECKERS_DEFAULT_GRAPHICS_PROFILE_ID = 'hz90_2k';
const CHECKERS_GRAPHICS_PROFILES = Object.freeze([
  {
    id: 'hz60_fhd',
    label: '60Hz · Full HD',
    renderScale: 1,
    maxFps: 60,
    fpsHint: '50–60 FPS',
    preferredResolutions: ['1k'],
    fallbackResolution: '1k',
    hdriGroundResolution: 256,
    hdriRadiusMultiplier: 7.5,
    description:
      'Balanced visuals: Full HD target with stable 50–60 FPS at 60Hz.'
  },
  {
    id: 'hz90_2k',
    label: '90Hz · 2K',
    renderScale: 1.35,
    maxFps: 90,
    fpsHint: '60–90 FPS',
    preferredResolutions: ['2k', '1k'],
    fallbackResolution: '2k',
    hdriGroundResolution: 320,
    hdriRadiusMultiplier: 8.5,
    description: 'Sharper arena textures with smooth 60–90 FPS on 90Hz.'
  },
  {
    id: 'hz120_4k',
    label: '120Hz · 4K',
    renderScale: 1.85,
    maxFps: 120,
    fpsHint: '105–120 FPS',
    preferredResolutions: ['4k', '2k'],
    fallbackResolution: '4k',
    hdriGroundResolution: 448,
    hdriRadiusMultiplier: 9.5,
    description: 'Ultra quality mode targeting 4K detail and 105–120 FPS.'
  },
  {
    id: 'hz144_6k',
    label: '144Hz · 6K (auto 4K fallback)',
    renderScale: 2,
    maxFps: 144,
    fpsHint: '120–144 FPS',
    preferredResolutions: ['6k', '4k', '2k'],
    fallbackResolution: '4k',
    hdriGroundResolution: 512,
    hdriRadiusMultiplier: 10.5,
    description:
      'Maximum mode: tries 6K when supported and falls back to 4K automatically.'
  }
]);
const DRACO_DECODER_PATH =
  'https://www.gstatic.com/draco/versioned/decoders/1.5.7/';
const BASIS_TRANSCODER_PATH =
  'https://cdn.jsdelivr.net/npm/three@0.164.0/examples/jsm/libs/basis/';
const BEAUTIFUL_GAME_BOARD_URLS = Object.freeze([
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/ABeautifulGame/glTF/ABeautifulGame.gltf',
  'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/ABeautifulGame/glTF/ABeautifulGame.gltf',
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/ABeautifulGame/glTF/ABeautifulGame.gltf',
  'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/ABeautifulGame/glTF/ABeautifulGame.gltf'
]);

let sharedKtx2Loader = null;
let hasDetectedKtx2Support = false;
const resolveHdriVariant = (value) => {
  const customVariants = getCustomHdriVariantsForGame('checkersbattleroyal');
  const allVariants = [...POOL_ROYALE_HDRI_VARIANTS, ...customVariants];
  if (typeof value === 'string') {
    return (
      POOL_ROYALE_HDRI_VARIANT_MAP[value] ||
      allVariants.find((variant) => variant.id === value) ||
      allVariants.find(
        (variant) => variant.id === POOL_ROYALE_DEFAULT_HDRI_ID
      ) ||
      allVariants[0]
    );
  }
  const max = allVariants.length - 1;
  const idx = Number.isFinite(value)
    ? Math.max(0, Math.min(max, Math.round(value)))
    : Math.max(
        0,
        allVariants.findIndex(
          (variant) => variant.id === POOL_ROYALE_DEFAULT_HDRI_ID
        )
      );
  return allVariants[idx] || allVariants[0];
};
const CHECKERS_BOARD_THEMES = Object.freeze([
  {
    id: 'classic',
    preserveOriginalMaterials: true,
    light: '#e7e2d3',
    dark: '#776a5a',
    frameLight: '#d2b48c',
    frameDark: '#3a2d23'
  },
  {
    id: 'ivorySlate',
    light: '#ece5d6',
    dark: '#4b5563',
    frameLight: '#d6c8a9',
    frameDark: '#111827'
  },
  {
    id: 'forest',
    light: '#e7f6dc',
    dark: '#1f4d36',
    frameLight: '#9fbe8e',
    frameDark: '#163525'
  },
  {
    id: 'sand',
    light: '#f7dfbe',
    dark: '#8a5a3c',
    frameLight: '#d5a779',
    frameDark: '#422313'
  },
  {
    id: 'ocean',
    light: '#dceef6',
    dark: '#1e3a8a',
    frameLight: '#a6c8db',
    frameDark: '#172554'
  },
  {
    id: 'violet',
    light: '#efe8ff',
    dark: '#5b3a82',
    frameLight: '#c3a7ea',
    frameDark: '#312040'
  },
  {
    id: 'chrome',
    light: '#ecf2f8',
    dark: '#334155',
    frameLight: '#d1dae5',
    frameDark: '#0f172a'
  },
  {
    id: 'nebulaGlass',
    light: '#dbeafe',
    dark: '#1e1b4b',
    frameLight: '#a5b4fc',
    frameDark: '#111827'
  }
]);

const CHECKERS_BOARD_THEME_OPTIONS = Object.freeze(
  CHECKERS_BOARD_THEMES.map((theme) => ({
    ...theme,
    label: CHESS_BATTLE_OPTION_LABELS.boardTheme[theme.id] || theme.id,
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.boardTheme[theme.id]
  }))
);

const BOARD_MATERIAL_CACHE = new WeakMap();

const CHAIR_MODEL_URLS = [
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/AntiqueChair/glTF-Binary/AntiqueChair.glb',
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/SheenChair/glTF-Binary/SheenChair.glb',
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/AntiqueChair/glTF-Binary/AntiqueChair.glb'
];
const CHAIR_GROUND_SINK = 0.44;
// Visual tuning for portrait screens: make chairs 20% bigger.
const CHAIR_VISUAL_SCALE = 1.2;
const CHAIR_TARGET_SCALE_FACTOR = 0.8;
const TARGET_CHAIR_SIZE = new THREE.Vector3(
  1.3162499970197679 * CHAIR_TARGET_SCALE_FACTOR,
  1.9173749900311232 * CHAIR_TARGET_SCALE_FACTOR,
  1.7001562547683715 * CHAIR_TARGET_SCALE_FACTOR
);
const TARGET_CHAIR_MIN_Y = -CHAIR_BASE_HEIGHT;
const TARGET_CHAIR_CENTER_Z = -0.1553906416893005;
const CHAIR_GROUNDING_EPSILON = 0.012 * MODEL_SCALE;
const SHADOW_CATCHER_SIZE = CHECKERS_ROOM_HALF_SPAN * 2.9;
const SHADOW_CATCHER_OPACITY = 0.26;
const SHADOW_CATCHER_ELEVATION = 0.004;
const MOVE_SOUND_URL = '/assets/sounds/domino-pieces-1-32112 (mp3cut.net).mp3';
const TAP_MAX_DISTANCE_PX = 16;
const TAP_MAX_DURATION_MS = 340;
const TOUCH_TAP_MAX_DISTANCE_PX = 40;
const TOUCH_TAP_MAX_DURATION_MS = 360;
const MOUSE_PICK_RADIUS_IN_TILES = 0.58;
const TOUCH_PICK_RADIUS_IN_TILES = 0.74;
const CHECKER_PIECE_SCALE = 0.88;
// Keep chips seated directly on the board surface in portrait view.
const CHECKER_PIECE_SURFACE_OFFSET_MULTIPLIER = 0.01;
const CHECKER_BOARD_PIECE_BASE_HEIGHT_OFFSET = 0.055;
const CHECKERS_HIGHLIGHT_COLORS = Object.freeze({
  selection: '#ff8e6e',
  move: '#7ef9a1',
  capture: '#ff8e6e'
});
const CHECKERS_PROCEDURAL_TABLE_IDS = new Set([
  'murlan-default',
  'ovalTable',
  'diamondEdge',
  'hexagonTable'
]);
const CHECKERS_TABLE_SHAPE_BY_ID = Object.freeze({
  'murlan-default': 'classicOctagon',
  ovalTable: 'grandOval',
  diamondEdge: 'diamondEdge',
  hexagonTable: 'hexagonTable'
});

const CHECKERS_CHIP_SET_BY_ID = Object.freeze({
  marble: { id: 'marble', light: '#f5f5f5', dark: '#6b7280' },
  darkForest: { id: 'darkForest', light: '#4ade80', dark: '#14532d' },
  amberGlow: { id: 'amberGlow', light: '#f59e0b', dark: '#78350f' },
  mintVale: { id: 'mintVale', light: '#2dd4bf', dark: '#0f766e' },
  royalWave: { id: 'royalWave', light: '#60a5fa', dark: '#1d4ed8' },
  roseMist: { id: 'roseMist', light: '#f472b6', dark: '#9d174d' },
  amethyst: { id: 'amethyst', light: '#a78bfa', dark: '#581c87' },
  cinderBlaze: { id: 'cinderBlaze', light: '#fb923c', dark: '#7c2d12' },
  arcticDrift: { id: 'arcticDrift', light: '#e2e8f0', dark: '#0f172a' },
  obsidianGold: { id: 'obsidianGold', light: '#facc15', dark: '#111827' },
  coralBloom: { id: 'coralBloom', light: '#fb7185', dark: '#0ea5e9' },
  neonPulse: { id: 'neonPulse', light: '#a3e635', dark: '#4c1d95' }
});

const FALLBACK_SEAT_POSITIONS = [
  { left: '50%', top: '18%' },
  { left: '50%', top: '82%' }
];
const RULE_SUMMARY =
  'Forced captures are ON. Chain captures are mandatory. Reach the far rank to crown a king.';
const HUMAN_SIDE = 'light';
const AI_SIDE = 'dark';
const AI_SEARCH_DEPTH = 6;
const CAPTURE_STRIP_OFFSET_ROWS = 1.15;
const CAPTURE_STRIP_PIECE_GAP = 0.82;
const ONLINE_SOCKET_CONNECT_TIMEOUT_MS = 6000;

async function ensureOnlineSocketConnected(timeoutMs = ONLINE_SOCKET_CONNECT_TIMEOUT_MS) {
  if (socket.connected) return true;

  return new Promise((resolve) => {
    let settled = false;

    const cleanup = () => {
      socket.off('connect', handleConnect);
      socket.off('connect_error', handleError);
      socket.off('error', handleError);
    };

    const finish = (ok) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      resolve(ok);
    };

    const handleConnect = () => finish(true);
    const handleError = () => finish(false);

    const timer = window.setTimeout(() => finish(Boolean(socket.connected)), timeoutMs);
    socket.once('connect', handleConnect);
    socket.once('connect_error', handleError);
    socket.once('error', handleError);
    socket.connect?.();
  });
}

const createCheckerMesh = ({
  tile,
  side,
  king,
  chipSet,
  checkerHeadPreset
}) => {
  const pieceGroup = new THREE.Group();
  const baseMaterial = createCheckerMaterial(
    side === 'light' ? chipSet.light : chipSet.dark,
    checkerHeadPreset
  );
  const chip = new THREE.Mesh(
    new THREE.CylinderGeometry(
      tile * 0.352 * CHECKER_PIECE_SCALE,
      tile * 0.332 * CHECKER_PIECE_SCALE,
      tile * 0.176 * CHECKER_PIECE_SCALE,
      56,
      1,
      false
    ),
    baseMaterial
  );
  chip.castShadow = true;
  chip.receiveShadow = true;
  pieceGroup.add(chip);

  const topCap = new THREE.Mesh(
    new THREE.CylinderGeometry(
      tile * 0.264 * CHECKER_PIECE_SCALE,
      tile * 0.292 * CHECKER_PIECE_SCALE,
      tile * 0.064 * CHECKER_PIECE_SCALE,
      48
    ),
    baseMaterial.clone()
  );
  topCap.position.y = tile * 0.106 * CHECKER_PIECE_SCALE;
  topCap.castShadow = true;
  topCap.receiveShadow = true;
  pieceGroup.add(topCap);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(
      tile * 0.242 * CHECKER_PIECE_SCALE,
      tile * 0.019 * CHECKER_PIECE_SCALE,
      16,
      64
    ),
    new THREE.MeshStandardMaterial({
      color: '#f8fafc',
      metalness: 0.88,
      roughness: 0.25,
      transparent: true,
      opacity: 0.85
    })
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = tile * 0.118 * CHECKER_PIECE_SCALE;
  pieceGroup.add(rim);

  if (king) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(
        tile * 0.16 * CHECKER_PIECE_SCALE,
        tile * 0.038 * CHECKER_PIECE_SCALE,
        12,
        32
      ),
      new THREE.MeshStandardMaterial({
        color: '#facc15',
        metalness: 0.94,
        roughness: 0.14,
        emissive: '#9a6c00',
        emissiveIntensity: 0.2
      })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = tile * 0.13 * CHECKER_PIECE_SCALE;
    pieceGroup.add(ring);
  }

  return pieceGroup;
};

const disposeGroupMeshes = (group) => {
  if (!group) return;
  group.traverse((child) => {
    if (!child?.isMesh) return;
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) {
      child.material.forEach((mat) => mat?.dispose?.());
      return;
    }
    child.material?.dispose?.();
  });
};

const createInitial = () => {
  const board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  for (let r = 0; r < 3; r += 1)
    for (let c = 0; c < SIZE; c += 1)
      if ((r + c) % 2 === 1) board[r][c] = { side: 'dark', king: false };
  for (let r = 5; r < SIZE; r += 1)
    for (let c = 0; c < SIZE; c += 1)
      if ((r + c) % 2 === 1) board[r][c] = { side: 'light', king: false };
  return board;
};

const inBounds = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;
const copyBoard = (board) =>
  board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));

const getPieceDirs = (piece) => {
  if (piece.king)
    return [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1]
    ];
  return piece.side === 'light'
    ? [
        [-1, 1],
        [-1, -1]
      ]
    : [
        [1, 1],
        [1, -1]
      ];
};

const getMoves = (board, r, c) => {
  const piece = board[r][c];
  if (!piece) return [];
  const dirs = getPieceDirs(piece);
  const captures = [];
  const normals = [];
  dirs.forEach(([dr, dc]) => {
    const nr = r + dr;
    const nc = c + dc;
    if (!inBounds(nr, nc)) return;
    if (!board[nr][nc]) normals.push({ r: nr, c: nc });
    else if (board[nr][nc].side !== piece.side) {
      const jr = nr + dr;
      const jc = nc + dc;
      if (inBounds(jr, jc) && !board[jr][jc])
        captures.push({ r: jr, c: jc, capture: [nr, nc] });
    }
  });
  return captures.length ? captures : normals;
};

const getMovesForSide = (board, side) => {
  const captures = [];
  const normals = [];
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      const piece = board[r][c];
      if (!piece || piece.side !== side) continue;
      getMoves(board, r, c).forEach((move) => {
        const payload = { from: { r, c }, ...move };
        if (move.capture) captures.push(payload);
        else normals.push(payload);
      });
    }
  }
  return captures.length ? captures : normals;
};

const applyMoveToBoard = (board, move) => {
  const next = copyBoard(board);
  const moving = next[move.from.r][move.from.c];
  if (!moving) return null;
  next[move.from.r][move.from.c] = null;
  if (move.capture) next[move.capture[0]][move.capture[1]] = null;
  const movedPiece = { ...moving };
  if (movedPiece.side === 'light' && move.r === 0) movedPiece.king = true;
  if (movedPiece.side === 'dark' && move.r === SIZE - 1) movedPiece.king = true;
  next[move.r][move.c] = movedPiece;
  return {
    board: next,
    piece: movedPiece,
    chainCaptures: move.capture
      ? getMoves(next, move.r, move.c).filter((m) => m.capture)
      : []
  };
};

const evaluateBoard = (board, side) => {
  let score = 0;
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      const piece = board[r][c];
      if (!piece) continue;
      const centerBonus = 3.5 - Math.abs(c - 3.5);
      const advancement = piece.side === 'dark' ? r : SIZE - 1 - r;
      const value =
        (piece.king ? 180 : 100) + advancement * 6 + centerBonus * 3;
      score += piece.side === side ? value : -value;
    }
  }
  score +=
    (getMovesForSide(board, side).length -
      getMovesForSide(board, side === 'dark' ? 'light' : 'dark').length) *
    4;
  return score;
};

const searchBestMove = (
  board,
  side,
  depth,
  alpha = -Infinity,
  beta = Infinity
) => {
  const moves = getMovesForSide(board, side);
  const enemy = side === 'dark' ? 'light' : 'dark';
  if (!moves.length) return { score: -99999 + depth, move: null };
  if (depth <= 0) return { score: evaluateBoard(board, AI_SIDE), move: null };

  let bestMove = null;
  const ordered = [...moves].sort(
    (a, b) => Number(Boolean(b.capture)) - Number(Boolean(a.capture))
  );

  if (side === AI_SIDE) {
    let bestScore = -Infinity;
    for (const move of ordered) {
      const applied = applyMoveToBoard(board, move);
      if (!applied) continue;
      let score;
      if (move.capture && applied.chainCaptures.length) {
        const chained = applied.chainCaptures.map((m) => ({
          from: { r: move.r, c: move.c },
          ...m
        }));
        let chainBest = -Infinity;
        for (const cm of chained) {
          const nextApplied = applyMoveToBoard(applied.board, cm);
          if (!nextApplied) continue;
          const branch = searchBestMove(
            nextApplied.board,
            nextApplied.chainCaptures.length ? side : enemy,
            depth - 1,
            alpha,
            beta
          );
          chainBest = Math.max(chainBest, branch.score);
        }
        score = chainBest;
      } else {
        score = searchBestMove(
          applied.board,
          enemy,
          depth - 1,
          alpha,
          beta
        ).score;
      }
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
      alpha = Math.max(alpha, score);
      if (beta <= alpha) break;
    }
    return { score: bestScore, move: bestMove };
  }

  let bestScore = Infinity;
  for (const move of ordered) {
    const applied = applyMoveToBoard(board, move);
    if (!applied) continue;
    const score = searchBestMove(
      applied.board,
      enemy,
      depth - 1,
      alpha,
      beta
    ).score;
    if (score < bestScore) {
      bestScore = score;
      bestMove = move;
    }
    beta = Math.min(beta, score);
    if (beta <= alpha) break;
  }
  return { score: bestScore, move: bestMove };
};

function buildFallbackCheckersBoardModel() {
  const targetBoardSize = BOARD_TILE_SIZE * SIZE;
  const boardModel = new THREE.Group();
  boardModel.name = 'ChessBattleRoyalBoard';
  const boardBaseY = TABLE_HEIGHT - 0.2;

  const frameSize = targetBoardSize * 1.14;
  const frameHeight = 0.14;
  const topHeight = 0.04;
  const tileSize = targetBoardSize / SIZE;

  const frameDarkMat = new THREE.MeshStandardMaterial({
    color: '#3a2d23',
    roughness: 0.78,
    metalness: 0.2
  });
  const frameLightMat = new THREE.MeshStandardMaterial({
    color: '#d2b48c',
    roughness: 0.7,
    metalness: 0.15
  });
  const lightMat = new THREE.MeshStandardMaterial({
    color: '#e7e2d3',
    roughness: 0.36,
    metalness: 0.16
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: '#776a5a',
    roughness: 0.4,
    metalness: 0.2
  });

  const frameBase = new THREE.Mesh(
    new THREE.BoxGeometry(frameSize, frameHeight, frameSize),
    frameDarkMat
  );
  frameBase.userData = {
    ...(frameBase.userData || {}),
    boardPart: 'frameDark'
  };
  frameBase.position.y = boardBaseY + frameHeight / 2;
  frameBase.castShadow = true;
  frameBase.receiveShadow = true;
  boardModel.add(frameBase);

  const frameTop = new THREE.Mesh(
    new THREE.BoxGeometry(
      targetBoardSize * 1.04,
      topHeight,
      targetBoardSize * 1.04
    ),
    frameLightMat
  );
  frameTop.userData = { ...(frameTop.userData || {}), boardPart: 'frameLight' };
  frameTop.position.y = boardBaseY + frameHeight + topHeight / 2;
  frameTop.castShadow = true;
  frameTop.receiveShadow = true;
  boardModel.add(frameTop);

  const tileGroup = new THREE.Group();
  tileGroup.position.y = boardBaseY + frameHeight + topHeight;
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      const isDark = (r + c) % 2 === 1;
      const tileMesh = new THREE.Mesh(
        new THREE.BoxGeometry(tileSize, 0.04, tileSize),
        isDark ? darkMat : lightMat
      );
      tileMesh.userData = {
        ...(tileMesh.userData || {}),
        boardPart: isDark ? 'tileDark' : 'tileLight'
      };
      tileMesh.position.set(
        (c - (SIZE - 1) / 2) * tileSize,
        0.02,
        (r - (SIZE - 1) / 2) * tileSize
      );
      tileMesh.castShadow = true;
      tileMesh.receiveShadow = true;
      tileGroup.add(tileMesh);
    }
  }
  boardModel.add(tileGroup);
  return boardModel;
}

async function loadCheckersBoardModel(renderer = null) {
  const loader = createConfiguredGLTFLoader(renderer);
  let lastError = null;

  const isChessPieceNode = (node) => {
    const pieceTypePattern =
      /(king|queen|rook|bishop|knight|pawn|castle|tower|tour)/i;
    let current = node;
    for (let depth = 0; current && depth < 6; depth += 1) {
      if (pieceTypePattern.test(`${current.name || ''}`)) return true;
      current = current.parent;
    }
    return false;
  };

  const findPieceRoot = (node) => {
    let current = node;
    while (current?.parent && isChessPieceNode(current.parent)) {
      current = current.parent;
    }
    return current;
  };

  for (const url of BEAUTIFUL_GAME_BOARD_URLS) {
    try {
      const resolvedUrl = new URL(url, window.location.href).href;
      const resourcePath = resolvedUrl.substring(
        0,
        resolvedUrl.lastIndexOf('/') + 1
      );
      loader.setResourcePath(resourcePath);
      loader.setPath('');
      // eslint-disable-next-line no-await-in-loop
      const gltf = await loader.loadAsync(resolvedUrl);
      const source = gltf?.scene || gltf?.scenes?.[0];
      if (!source) continue;

      const boardModel = source.clone(true);
      boardModel.name = 'ABeautifulGameBoard';
      boardModel.userData = {
        ...(boardModel.userData || {}),
        forceOriginalTextures: true
      };

      const prune = new Set();
      boardModel.traverse((node) => {
        if (!node?.isObject3D) return;
        if (isChessPieceNode(node)) {
          prune.add(findPieceRoot(node));
        }
        if (!node?.isMesh) return;
        node.castShadow = true;
        node.receiveShadow = true;
        const mats = Array.isArray(node.material)
          ? node.material
          : [node.material];
        mats.forEach((mat) => {
          if (mat?.map) applySRGBColorSpace(mat.map);
          if (mat?.emissiveMap) applySRGBColorSpace(mat.emissiveMap);
          mat.needsUpdate = true;
        });
      });
      prune.forEach((node) => node?.parent?.remove(node));

      const box = new THREE.Box3().setFromObject(boardModel);
      const size = box.getSize(new THREE.Vector3());
      const largest = Math.max(size.x, size.z, 0.001);
      const targetSize =
        BOARD_TILE_SIZE * SIZE * BOARD_MODEL_OUTER_TO_PLAYABLE_RATIO;
      const scale = targetSize / largest;
      boardModel.scale.multiplyScalar(scale);

      const scaledBox = new THREE.Box3().setFromObject(boardModel);
      const center = scaledBox.getCenter(new THREE.Vector3());
      boardModel.position.set(
        -center.x,
        TABLE_HEIGHT + 0.01 - scaledBox.min.y,
        -center.z
      );
      return boardModel;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    console.warn(
      'Checkers Battle Royal: failed to load chess board GLTF, using fallback.',
      lastError
    );
  }
  return buildFallbackCheckersBoardModel();
}

function snapshotBoardMaterials(boardModel) {
  if (!boardModel || BOARD_MATERIAL_CACHE.has(boardModel)) return;
  const cache = new Map();
  boardModel.traverse((node) => {
    if (!node?.isMesh) return;
    const mats = Array.isArray(node.material)
      ? node.material.map((mat) => (mat?.clone ? mat.clone() : mat))
      : [node.material?.clone ? node.material.clone() : node.material];
    cache.set(node.uuid, mats);
  });
  BOARD_MATERIAL_CACHE.set(boardModel, cache);
}

function restoreBoardMaterials(boardModel) {
  const cache = BOARD_MATERIAL_CACHE.get(boardModel);
  if (!boardModel || !cache) return;
  boardModel.traverse((node) => {
    if (!node?.isMesh) return;
    const mats = cache.get(node.uuid);
    if (!mats) return;
    const cloned = mats.map((mat) => (mat?.clone ? mat.clone() : mat));
    node.material = Array.isArray(node.material) ? cloned : cloned[0];
    node.castShadow = true;
    node.receiveShadow = true;
  });
}

function applyCheckersBoardTheme(
  boardModel,
  option = CHECKERS_BOARD_THEME_OPTIONS[0]
) {
  if (!boardModel) return;
  snapshotBoardMaterials(boardModel);
  restoreBoardMaterials(boardModel);

  if (option?.preserveOriginalMaterials) return;

  const frameLight = new THREE.Color(option?.frameLight || '#d2b48c');
  const frameDark = new THREE.Color(option?.frameDark || '#3a2d23');
  const light = new THREE.Color(option?.light || '#e7e2d3');
  const dark = new THREE.Color(option?.dark || '#776a5a');

  const luminance = (color) =>
    0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
  const toArray = (value) => (Array.isArray(value) ? value : [value]);

  boardModel.traverse((node) => {
    if (!node?.isMesh) return;
    const name = `${node.name || ''} ${node.parent?.name || ''}`.toLowerCase();
    const mats = toArray(node.material);

    const taggedPart = node.userData?.boardPart;
    if (taggedPart) {
      const taggedColor =
        taggedPart === 'frameDark'
          ? frameDark
          : taggedPart === 'frameLight'
            ? frameLight
            : taggedPart === 'tileDark'
              ? dark
              : light;
      mats.forEach((mat) => {
        if (!mat) return;
        if (mat?.color?.copy) mat.color.copy(taggedColor);
        if ('roughness' in mat)
          mat.roughness = /frame/.test(taggedPart) ? 0.78 : 0.4;
        if ('metalness' in mat)
          mat.metalness = /frame/.test(taggedPart) ? 0.18 : 0.2;
        mat.needsUpdate = true;
      });
      node.castShadow = true;
      node.receiveShadow = true;
      return;
    }

    let avgLum = 0;
    let count = 0;
    mats.forEach((mat) => {
      if (!mat?.color) return;
      avgLum += luminance(mat.color);
      count += 1;
    });
    const baseIsLight = count ? avgLum / count >= 0.5 : true;

    const isFrame = /frame|border|rim|base|stand/.test(name);
    const targetColor = isFrame
      ? baseIsLight
        ? frameLight
        : frameDark
      : baseIsLight
        ? light
        : dark;

    mats.forEach((mat) => {
      if (!mat) return;
      if (mat?.color?.copy) mat.color.copy(targetColor);
      if ('roughness' in mat) mat.roughness = isFrame ? 0.92 : 0.86;
      if ('metalness' in mat) mat.metalness = isFrame ? 0.02 : 0.01;
      if ('reflectivity' in mat) mat.reflectivity = 0;
      mat.needsUpdate = true;
    });
    node.castShadow = true;
    node.receiveShadow = true;
  });
}

function resolveCheckersPlayableTileSize(boardModel) {
  if (!boardModel) return BOARD_TILE_SIZE;
  const bounds = new THREE.Box3().setFromObject(boardModel);
  const span = Math.max(
    bounds.max.x - bounds.min.x,
    bounds.max.z - bounds.min.z
  );
  if (!Number.isFinite(span) || span <= 0) return BOARD_TILE_SIZE;
  const ratio =
    boardModel?.name === 'ChessBattleRoyalBoard'
      ? BOARD_MODEL_OUTER_TO_PLAYABLE_RATIO
      : CHECKERS_PLAYABLE_MAPPING_RATIO;
  return span / ratio / SIZE;
}

function createCheckerMaterial(sideColor, headPreset) {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(sideColor),
    roughness: Math.max(0.3, headPreset?.roughness ?? 0.38),
    metalness: Math.min(0.14, headPreset?.metalness ?? 0.08),
    transmission: 0,
    ior: 1.45,
    thickness: 0,
    clearcoat: 0.08,
    clearcoatRoughness: 0.42,
    specularIntensity: 0.28
  });
}
function ensureKtx2SupportDetection(renderer = null) {
  if (!sharedKtx2Loader || hasDetectedKtx2Support || !renderer) return;
  try {
    sharedKtx2Loader.detectSupport(renderer);
    hasDetectedKtx2Support = true;
  } catch (error) {
    console.warn('Checkers Battle Royal: KTX2 support detection failed', error);
  }
}

function createConfiguredGLTFLoader(renderer = null) {
  const loader = new GLTFLoader();
  loader.setCrossOrigin('anonymous');
  const draco = new DRACOLoader();
  draco.setDecoderPath(DRACO_DECODER_PATH);
  loader.setDRACOLoader(draco);
  loader.setMeshoptDecoder(MeshoptDecoder);

  if (!sharedKtx2Loader) {
    sharedKtx2Loader = new KTX2Loader();
    sharedKtx2Loader.setTranscoderPath(BASIS_TRANSCODER_PATH);
    const supportRenderer =
      renderer ||
      (typeof document !== 'undefined'
        ? new THREE.WebGLRenderer({ antialias: false, alpha: true })
        : null);
    if (supportRenderer) {
      sharedKtx2Loader.detectSupport(supportRenderer);
      if (!renderer) supportRenderer.dispose();
      hasDetectedKtx2Support = true;
    }
  }

  ensureKtx2SupportDetection(renderer);
  loader.setKTX2Loader(sharedKtx2Loader);
  return loader;
}

function fitChairModelToFootprint(model) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const targetMax = Math.max(
    TARGET_CHAIR_SIZE.x,
    TARGET_CHAIR_SIZE.y,
    TARGET_CHAIR_SIZE.z
  );
  const currentMax = Math.max(size.x, size.y, size.z);
  if (currentMax > 0) {
    model.scale.multiplyScalar(targetMax / currentMax);
  }
  const scaledBox = new THREE.Box3().setFromObject(model);
  const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
  model.position.add(
    new THREE.Vector3(
      -scaledCenter.x,
      TARGET_CHAIR_MIN_Y - scaledBox.min.y,
      TARGET_CHAIR_CENTER_Z - scaledCenter.z
    )
  );
}

async function buildChessMappedChairTemplate() {
  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath(DRACO_DECODER_PATH);
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
  if (!gltf) throw lastError || new Error('Failed to load mapped chair');
  const model = gltf.scene || gltf.scenes?.[0];
  if (!model) throw new Error('Missing chair model scene');
  model.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach((mat) => {
      if (mat?.map) applySRGBColorSpace(mat.map);
      if (mat?.emissiveMap) applySRGBColorSpace(mat.emissiveMap);
    });
  });
  fitChairModelToFootprint(model);
  return model;
}

function createProceduralChairFallback(chairColor, legColor) {
  const seatMaterial = new THREE.MeshStandardMaterial({
    color: chairColor,
    roughness: 0.42,
    metalness: 0.18
  });
  const legMaterial = new THREE.MeshStandardMaterial({
    color: legColor,
    roughness: 0.55,
    metalness: 0.38
  });
  const chair = new THREE.Group();
  const seatMesh = new THREE.Mesh(
    new THREE.BoxGeometry(SEAT_WIDTH, SEAT_THICKNESS_SCALED, SEAT_DEPTH),
    seatMaterial
  );
  seatMesh.position.y = SEAT_THICKNESS_SCALED / 2;
  const backMesh = new THREE.Mesh(
    new THREE.BoxGeometry(SEAT_WIDTH * 0.96, BACK_HEIGHT, BACK_THICKNESS),
    seatMaterial
  );
  backMesh.position.set(
    0,
    SEAT_THICKNESS_SCALED / 2 + BACK_HEIGHT / 2,
    -SEAT_DEPTH / 2 + BACK_THICKNESS / 2
  );
  const armGeometry = new THREE.BoxGeometry(
    ARM_THICKNESS,
    ARM_HEIGHT,
    ARM_DEPTH
  );
  const armOffsetX = SEAT_WIDTH / 2 - ARM_THICKNESS / 2;
  const armOffsetY = SEAT_THICKNESS_SCALED / 2 + ARM_HEIGHT / 2;
  const armOffsetZ = -ARM_DEPTH / 2 + ARM_THICKNESS * 0.2;
  const leftArm = new THREE.Mesh(armGeometry, seatMaterial);
  leftArm.position.set(-armOffsetX, armOffsetY, armOffsetZ);
  const rightArm = new THREE.Mesh(armGeometry, seatMaterial);
  rightArm.position.set(armOffsetX, armOffsetY, armOffsetZ);
  const legMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.16 * MODEL_SCALE * STOOL_SCALE,
      0.2 * MODEL_SCALE * STOOL_SCALE,
      BASE_COLUMN_HEIGHT,
      18
    ),
    legMaterial
  );
  legMesh.position.y = -SEAT_THICKNESS_SCALED / 2 - BASE_COLUMN_HEIGHT / 2;
  const foot = new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.32 * MODEL_SCALE * STOOL_SCALE,
      0.32 * MODEL_SCALE * STOOL_SCALE,
      0.08 * MODEL_SCALE,
      24
    ),
    legMaterial
  );
  foot.position.y =
    legMesh.position.y - BASE_COLUMN_HEIGHT / 2 - 0.04 * MODEL_SCALE;
  [seatMesh, backMesh, leftArm, rightArm, legMesh, foot].forEach((mesh) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    chair.add(mesh);
  });
  return chair;
}

function groundGroupToFloor(group, floorY = 0) {
  if (!group) return;
  const box = new THREE.Box3().setFromObject(group);
  if (!Number.isFinite(box.min.y)) return;
  group.position.y += floorY - box.min.y;
}

function resolveArenaFloorY(...groups) {
  const box = new THREE.Box3();
  let hasObject = false;
  groups.forEach((group) => {
    if (!group) return;
    box.expandByObject(group);
    hasObject = true;
  });
  return hasObject && Number.isFinite(box.min.y) ? box.min.y : 0;
}

function alignArenaGroundArtifacts({ shadowCatcher, skybox, table, board, chairs }) {
  const floorY = resolveArenaFloorY(
    table?.group,
    board,
    ...((chairs || []).filter(Boolean))
  );
  if (shadowCatcher) {
    shadowCatcher.position.y = floorY + SHADOW_CATCHER_ELEVATION;
  }
  if (skybox?.userData?.cameraHeight) {
    skybox.position.y = floorY + skybox.userData.cameraHeight;
  }
  return floorY;
}

function reduceCheckersTableBase(tableGroup) {
  if (!tableGroup) return;
  tableGroup.traverse((node) => {
    if (!node?.isMesh || node.geometry?.type !== 'CylinderGeometry') return;
    const isBelowTop = node.position.y < TABLE_HEIGHT - 0.06;
    if (!isBelowTop) return;
    const radiusTop = Number(node.geometry?.parameters?.radiusTop) || 0;
    const radiusBottom = Number(node.geometry?.parameters?.radiusBottom) || 0;
    const height = Number(node.geometry?.parameters?.height) || 0;
    const avgRadius = (radiusTop + radiusBottom) / 2;
    const isTrimRing = avgRadius > TABLE_RADIUS * 0.7;
    const beforeBox = new THREE.Box3().setFromObject(node);
    const heightScale = isTrimRing
      ? CHECKERS_TABLE_TRIM_HEIGHT_SCALE
      : CHECKERS_TABLE_BASE_HEIGHT_SCALE;
    const radiusScale = isTrimRing
      ? CHECKERS_TABLE_TRIM_RADIUS_SCALE
      : CHECKERS_TABLE_BASE_RADIUS_SCALE;
    node.scale.set(
      node.scale.x * radiusScale,
      node.scale.y * heightScale,
      node.scale.z * radiusScale
    );
    node.updateMatrixWorld(true);
    const afterBox = new THREE.Box3().setFromObject(node);
    if (
      Number.isFinite(beforeBox.min.y) &&
      Number.isFinite(afterBox.min.y) &&
      Math.abs(beforeBox.min.y - afterBox.min.y) > 1e-5
    ) {
      node.position.y += beforeBox.min.y - afterBox.min.y;
      node.updateMatrixWorld(true);
    }
    if (!isTrimRing) {
      const leveledBox = new THREE.Box3().setFromObject(node);
      if (Number.isFinite(leveledBox.max.y) && leveledBox.max.y > 1e-5) {
        const chairLegTarget = CHAIR_BASE_HEIGHT;
        const levelScale = THREE.MathUtils.clamp(
          chairLegTarget / leveledBox.max.y,
          0.65,
          1.45
        );
        node.scale.y *= levelScale;
        node.updateMatrixWorld(true);
        const realignedBox = new THREE.Box3().setFromObject(node);
        if (
          Number.isFinite(realignedBox.min.y) &&
          Number.isFinite(beforeBox.min.y)
        ) {
          node.position.y += beforeBox.min.y - realignedBox.min.y;
          node.updateMatrixWorld(true);
        }
      }
    }
    if (height < 0.001) {
      node.visible = false;
    }
  });
}

const pickPolyHavenHdriUrl = (json, preferred = DEFAULT_HDRI_RESOLUTIONS) => {
  if (!json || typeof json !== 'object') return null;
  const resolutions =
    Array.isArray(preferred) && preferred.length
      ? preferred
      : DEFAULT_HDRI_RESOLUTIONS;
  for (const res of resolutions) {
    const entry = json[res];
    if (entry?.hdr) return entry.hdr;
    if (entry?.exr) return entry.exr;
  }
  const fallback = Object.values(json).find(
    (value) => value?.hdr || value?.exr
  );
  if (!fallback) return null;
  return fallback.hdr || fallback.exr || null;
};

async function resolveHdriUrl(variant) {
  const preferred =
    Array.isArray(variant?.preferredResolutions) &&
    variant.preferredResolutions.length
      ? variant.preferredResolutions
      : DEFAULT_HDRI_RESOLUTIONS;
  const fallbackRes = variant?.fallbackResolution || preferred[0] || '4k';
  const fallback = `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/${fallbackRes}/${variant?.assetId || 'colorful_studio'}_${fallbackRes}.hdr`;
  if (!variant?.assetId || typeof fetch !== 'function') return fallback;
  try {
    const res = await fetch(
      `https://api.polyhaven.com/files/${encodeURIComponent(variant.assetId)}`
    );
    if (!res.ok) return fallback;
    const data = await res.json();
    return pickPolyHavenHdriUrl(data, preferred) || fallback;
  } catch {
    return fallback;
  }
}

function supportsSixKhdr(renderer) {
  const maxTextureSize = renderer?.capabilities?.maxTextureSize ?? 0;
  return Number.isFinite(maxTextureSize) && maxTextureSize >= 6144;
}

function resolveGraphicsHdriVariant(baseVariant, profile, renderer) {
  const fallbackProfile =
    CHECKERS_GRAPHICS_PROFILES.find(
      (item) => item.id === CHECKERS_DEFAULT_GRAPHICS_PROFILE_ID
    ) || CHECKERS_GRAPHICS_PROFILES[0];
  const activeProfile = profile || fallbackProfile;
  const supports6k = supportsSixKhdr(renderer);
  const preferred = Array.isArray(activeProfile.preferredResolutions)
    ? activeProfile.preferredResolutions
    : [];
  const safePreferred = preferred.filter((res) => supports6k || res !== '6k');
  const preferredResolutions = safePreferred.length
    ? safePreferred
    : ['4k', '2k'];
  const fallbackResolution =
    !supports6k && activeProfile.fallbackResolution === '6k'
      ? '4k'
      : activeProfile.fallbackResolution || preferredResolutions[0] || '4k';
  return {
    ...(baseVariant || {}),
    preferredResolutions,
    fallbackResolution,
    groundResolution:
      activeProfile.hdriGroundResolution ??
      baseVariant?.groundResolution ??
      DEFAULT_HDRI_GROUNDED_RESOLUTION,
    groundRadiusMultiplier:
      activeProfile.hdriRadiusMultiplier ??
      baseVariant?.groundRadiusMultiplier ??
      DEFAULT_HDRI_RADIUS_MULTIPLIER
  };
}

async function loadPolyHavenHdriEnvironment(renderer, variant = {}) {
  if (!renderer) return null;
  const url = await resolveHdriUrl(variant);
  const lowerUrl = `${url ?? ''}`.toLowerCase();
  const useExr = lowerUrl.endsWith('.exr');
  const loader = useExr ? new EXRLoader() : new RGBELoader();
  loader.setCrossOrigin?.('anonymous');
  return new Promise((resolve) => {
    loader.load(
      url,
      (texture) => {
        const pmrem = new THREE.PMREMGenerator(renderer);
        pmrem.compileEquirectangularShader();
        const envMap = pmrem.fromEquirectangular(texture).texture;
        const skyboxMap = texture;
        skyboxMap.mapping = THREE.EquirectangularReflectionMapping;
        skyboxMap.needsUpdate = true;
        pmrem.dispose();
        resolve({ envMap, skyboxMap });
      },
      undefined,
      () => resolve(null)
    );
  });
}

export default function CheckersBattleRoyal() {
  useTelegramBackButton();
  const navigate = useNavigate();
  const { search } = useLocation();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const mode = params.get('mode') || 'ai';
  const initialTableId = params.get('tableId') || '';
  const initialAccountId = params.get('accountId') || '';
  const preferredSideParam = params.get('preferredSide');
  const initialSideParam = params.get('side');
  const initialOpponentName = params.get('opponentName') || '';
  const initialOpponentAvatar = params.get('opponentAvatar') || '';
  const [accountId, setAccountId] = useState(initialAccountId);
  const [tableId] = useState(initialTableId);
  const [onlineStatus, setOnlineStatus] = useState(
    mode === 'online' ? 'connecting' : 'offline'
  );
  const [onlineOpponent, setOnlineOpponent] = useState(
    initialOpponentName || initialOpponentAvatar
      ? { name: initialOpponentName || 'Opponent', avatar: initialOpponentAvatar }
      : null
  );
  const [redirecting, setRedirecting] = useState(false);
  const onlineRef = useRef({
    enabled: mode === 'online',
    tableId: initialTableId || null,
    accountId: initialAccountId || null,
    side:
      initialSideParam === 'dark' || initialSideParam === 'black'
        ? 'dark'
        : initialSideParam === 'light' || initialSideParam === 'white'
        ? 'light'
        : preferredSideParam === 'black'
        ? 'dark'
        : 'light',
    synced: mode !== 'online',
    status: mode === 'online' ? 'connecting' : 'offline',
    opponent: null
  });
  const mountRef = useRef(null);

  const boardRef = useRef(createInitial());
  const selectedRef = useRef(null);
  const piecesGroupRef = useRef(null);
  const capturedPiecesGroupRef = useRef(null);
  const boardOriginRef = useRef({ x: 0, y: 0.75, z: 0, tile: 2.65 });
  const replayStateRef = useRef(null);
  const highlightGroupRef = useRef(null);
  const moveSoundRef = useRef(null);
  const captureSoundRef = useRef(null);
  const pointerDownRef = useRef(null);
  const pendingMoveRef = useRef(null);

  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const tableRef = useRef(null);
  const chairsRef = useRef([]);
  const keyLightRef = useRef(null);
  const shadowCatcherRef = useRef(null);
  const envRef = useRef({ map: null, skybox: null });
  const boardThemeRef = useRef(CHECKERS_BOARD_THEME_OPTIONS[0]);
  const gltfBoardRef = useRef(null);
  const proceduralBoardRef = useRef({ lightMat: null, darkMat: null });

  const [turn, setTurn] = useState('light');
  const [status, setStatus] = useState(`Loading arena… ${RULE_SUMMARY}`);
  const [configOpen, setConfigOpen] = useState(false);
  const [viewMode, setViewMode] = useState('3d');
  const [graphicsProfileId, setGraphicsProfileId] = useState(() => {
    if (typeof window === 'undefined') return CHECKERS_DEFAULT_GRAPHICS_PROFILE_ID;
    const saved = window.localStorage.getItem(
      CHECKERS_GRAPHICS_PROFILE_STORAGE_KEY
    );
    return (
      CHECKERS_GRAPHICS_PROFILES.find((profile) => profile.id === saved)?.id ||
      CHECKERS_DEFAULT_GRAPHICS_PROFILE_ID
    );
  });
  const [showGift, setShowGift] = useState(false);
  const [canReplay, setCanReplay] = useState(false);
  const [gameOver, setGameOver] = useState(null);
  const [capturedBySide, setCapturedBySide] = useState({
    light: [],
    dark: []
  });
  useEffect(() => {
    if (mode !== 'online') return;
    if (!initialTableId) {
      setRedirecting(true);
      navigate('/games/checkersbattleroyal/lobby', { replace: true });
      return;
    }
    if (!initialAccountId) {
      ensureAccountId()
        .then((id) => {
          if (!id) return;
          setAccountId(id);
          onlineRef.current.accountId = id;
        })
        .catch(() => {});
    }
  }, [initialAccountId, initialTableId, mode, navigate]);

  const aiBusyRef = useRef(false);
  const resolvedAccountId = useMemo(() => chessBattleAccountId(), []);
  const [inventory, setInventory] = useState(() =>
    getChessBattleInventory(resolvedAccountId)
  );

  useEffect(() => {
    const syncInventory = (event) => {
      const nextAccountId = event?.detail?.accountId;
      if (nextAccountId && nextAccountId !== resolvedAccountId) return;
      setInventory(getChessBattleInventory(resolvedAccountId));
    };
    window.addEventListener('chessBattleInventoryUpdate', syncInventory);
    return () =>
      window.removeEventListener('chessBattleInventoryUpdate', syncInventory);
  }, [resolvedAccountId]);

  const unlockedTableOptions = useMemo(
    () => {
      const baseUnlocked = CHESS_TABLE_OPTIONS.filter((opt) =>
        isChessOptionUnlocked('tables', opt.id, inventory)
      );
      const specialProcedural = [
        {
          id: 'ovalTable',
          label: 'Oval Table',
          thumbnail:
            TABLE_SHAPE_OPTIONS.find((option) => option.id === 'grandOval')
              ?.thumbnail
        },
        {
          id: 'diamondEdge',
          label: 'Diamond Edge Table',
          thumbnail:
            TABLE_SHAPE_OPTIONS.find((option) => option.id === 'diamondEdge')
              ?.thumbnail
        },
        {
          id: 'hexagonTable',
          label: 'Hexagon Table',
          thumbnail:
            TABLE_SHAPE_OPTIONS.find((option) => option.id === 'hexagonTable')
              ?.thumbnail
        }
      ].filter((opt) => isChessOptionUnlocked('tables', opt.id, inventory));
      const deduped = new Map(
        [...baseUnlocked, ...specialProcedural].map((opt) => [opt.id, opt])
      );
      return Array.from(deduped.values());
    },
    [inventory]
  );
  const unlockedChairOptions = useMemo(
    () =>
      CHESS_CHAIR_OPTIONS.filter((opt) =>
        isChessOptionUnlocked('chairColor', opt.id, inventory)
      ),
    [inventory]
  );
  const unlockedTableFinishes = useMemo(
    () =>
      MURLAN_TABLE_FINISHES.filter((opt) =>
        isChessOptionUnlocked('tableFinish', opt.id, inventory)
      ),
    [inventory]
  );
  const unlockedTableCloths = useMemo(
    () => {
      const unlocked = TABLE_CLOTH_OPTIONS.filter((opt) =>
        isChessOptionUnlocked('tableCloth', opt.id, inventory)
      );
      return unlocked.length ? unlocked : [TABLE_CLOTH_OPTIONS[0]];
    },
    [inventory]
  );
  const unlockedBoardThemes = useMemo(
    () =>
      CHECKERS_BOARD_THEME_OPTIONS.filter((opt) =>
        isChessOptionUnlocked('boardTheme', opt.id, inventory)
      ),
    [inventory]
  );
  const unlockedHdriOptions = useMemo(
    () => {
      const customVariants = getCustomHdriVariantsForGame(
        'checkersbattleroyal',
        resolvedAccountId
      );
      return [...POOL_ROYALE_HDRI_VARIANTS, ...customVariants].filter((opt) =>
        isChessOptionUnlocked('environmentHdri', opt.id, inventory)
      );
    },
    [inventory, resolvedAccountId]
  );

  const inv = useMemo(
    () => ({
      tableId: inventory.tables?.[0] || CHESS_TABLE_OPTIONS[0]?.id,
      chairId: inventory.chairColor?.[0] || CHESS_CHAIR_OPTIONS[0]?.id,
      tableFinish: inventory.tableFinish?.[0] || MURLAN_TABLE_FINISHES[0]?.id,
      tableCloth: inventory.tableCloth?.[0] || TABLE_CLOTH_OPTIONS[0]?.id,
      hdriId: inventory.environmentHdri?.[0] || POOL_ROYALE_DEFAULT_HDRI_ID,
      boardTheme:
        inventory.boardTheme?.[0] || CHECKERS_BOARD_THEME_OPTIONS[0]?.id,
      headStyle: inventory.headStyle?.[0] || 'current'
    }),
    [inventory]
  );

  const [appearance, setAppearance] = useState(inv);
  const showTableSurfaceOptions = CHECKERS_PROCEDURAL_TABLE_IDS.has(
    appearance.tableId
  );
  const unlockedPieceStyleIds = useMemo(
    () =>
      Object.keys(CHECKERS_CHIP_SET_BY_ID).filter((id) =>
        isChessOptionUnlocked('sideColor', id, inventory)
      ),
    [inventory]
  );
  const defaultP1PieceStyleId = unlockedPieceStyleIds[0] || 'amberGlow';
  const defaultP2PieceStyleId =
    unlockedPieceStyleIds.find((id) => id !== defaultP1PieceStyleId) ||
    defaultP1PieceStyleId;
  const [p1PieceStyleId, setP1PieceStyleId] = useState(defaultP1PieceStyleId);
  const [p2PieceStyleId, setP2PieceStyleId] = useState(defaultP2PieceStyleId);
  const piecePalette = useMemo(() => {
    const lightPieceStyle =
      CHECKERS_CHIP_SET_BY_ID[p1PieceStyleId] ||
      CHECKERS_CHIP_SET_BY_ID[defaultP1PieceStyleId] ||
      CHECKERS_CHIP_SET_BY_ID.amberGlow;
    const darkPieceStyle =
      CHECKERS_CHIP_SET_BY_ID[p2PieceStyleId] ||
      CHECKERS_CHIP_SET_BY_ID[defaultP2PieceStyleId] ||
      CHECKERS_CHIP_SET_BY_ID.mintVale;
    return {
      light: lightPieceStyle.light,
      dark: darkPieceStyle.dark
    };
  }, [
    defaultP1PieceStyleId,
    defaultP2PieceStyleId,
    p1PieceStyleId,
    p2PieceStyleId
  ]);
  const unlockedPieceStyles = useMemo(
    () =>
      unlockedPieceStyleIds
        .map((id) => CHECKERS_CHIP_SET_BY_ID[id])
        .filter(Boolean),
    [unlockedPieceStyleIds]
  );
  const checkerHeadPreset = useMemo(() => {
    const headId = inv?.headStyle || 'current';
    if (headId === 'headChrome') {
      return {
        roughness: 0.12,
        metalness: 0.95,
        transmission: 0.1,
        ior: 2.1,
        thickness: 0.22
      };
    }
    if (headId === 'headGold') {
      return {
        roughness: 0.16,
        metalness: 0.92,
        transmission: 0.06,
        ior: 1.85,
        thickness: 0.28
      };
    }
    if (headId === 'headSapphire') {
      return {
        roughness: 0.08,
        metalness: 0.05,
        transmission: 0.9,
        ior: 1.8,
        thickness: 0.7
      };
    }
    if (headId === 'headRuby') {
      return {
        roughness: 0.08,
        metalness: 0.05,
        transmission: 0.92,
        ior: 2.4,
        thickness: 0.6
      };
    }
    return {
      roughness: 0.18,
      metalness: 0.35,
      transmission: 0.18,
      ior: 1.6,
      thickness: 0.44
    };
  }, [inv?.headStyle]);
  const graphicsProfile = useMemo(
    () =>
      CHECKERS_GRAPHICS_PROFILES.find(
        (profile) => profile.id === graphicsProfileId
      ) ||
      CHECKERS_GRAPHICS_PROFILES.find(
        (profile) => profile.id === CHECKERS_DEFAULT_GRAPHICS_PROFILE_ID
      ) ||
      CHECKERS_GRAPHICS_PROFILES[0],
    [graphicsProfileId]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      CHECKERS_GRAPHICS_PROFILE_STORAGE_KEY,
      graphicsProfileId
    );
  }, [graphicsProfileId]);


  useEffect(() => {
    setAppearance((prev) => ({
      ...prev,
      tableId:
        unlockedTableOptions.find((opt) => opt.id === prev.tableId)?.id ||
        unlockedTableOptions[0]?.id ||
        CHESS_TABLE_OPTIONS[0]?.id,
      chairId:
        unlockedChairOptions.find((opt) => opt.id === prev.chairId)?.id ||
        unlockedChairOptions[0]?.id ||
        CHESS_CHAIR_OPTIONS[0]?.id,
      tableFinish:
        unlockedTableFinishes.find((opt) => opt.id === prev.tableFinish)?.id ||
        unlockedTableFinishes[0]?.id ||
        MURLAN_TABLE_FINISHES[0]?.id,
      tableCloth:
        unlockedTableCloths.find((opt) => opt.id === prev.tableCloth)?.id ||
        unlockedTableCloths[0]?.id ||
        TABLE_CLOTH_OPTIONS[0]?.id,
      boardTheme:
        unlockedBoardThemes.find((opt) => opt.id === prev.boardTheme)?.id ||
        unlockedBoardThemes[0]?.id ||
        CHECKERS_BOARD_THEME_OPTIONS[0]?.id,
      hdriId:
        unlockedHdriOptions.find((opt) => opt.id === prev.hdriId)?.id ||
        unlockedHdriOptions[0]?.id ||
        POOL_ROYALE_DEFAULT_HDRI_ID
    }));
  }, [
    unlockedBoardThemes,
    unlockedChairOptions,
    unlockedHdriOptions,
    unlockedTableCloths,
    unlockedTableFinishes,
    unlockedTableOptions
  ]);

  useEffect(() => {
    if (appearance.tableId)
      setChessBattleEquippedOption('tables', appearance.tableId, resolvedAccountId);
    if (appearance.chairId)
      setChessBattleEquippedOption('chairColor', appearance.chairId, resolvedAccountId);
    if (appearance.tableFinish)
      setChessBattleEquippedOption(
        'tableFinish',
        appearance.tableFinish,
        resolvedAccountId
      );
    if (appearance.tableCloth)
      setChessBattleEquippedOption(
        'tableCloth',
        appearance.tableCloth,
        resolvedAccountId
      );
    if (appearance.boardTheme)
      setChessBattleEquippedOption('boardTheme', appearance.boardTheme, resolvedAccountId);
    if (appearance.hdriId)
      setChessBattleEquippedOption(
        'environmentHdri',
        appearance.hdriId,
        resolvedAccountId
      );
  }, [
    appearance.boardTheme,
    appearance.chairId,
    appearance.hdriId,
    appearance.tableCloth,
    appearance.tableFinish,
    appearance.tableId,
    resolvedAccountId
  ]);
  const playerName =
    getTelegramFirstName() || getTelegramUsername() || 'Player';
  const playerPhotoUrl = getTelegramPhotoUrl() || '/assets/icons/profile.svg';
  const rivalName = onlineOpponent?.name || 'Rival';
  const rivalPhoto = onlineOpponent?.avatar || '/assets/icons/profile.svg';

  const players = [
    {
      index: 0,
      name: rivalName,
      photoUrl: rivalPhoto,
      color: '#f43f5e',
      isTurn: turn === 'dark'
    },
    {
      index: 1,
      name: playerName,
      photoUrl: playerPhotoUrl,
      color: '#38bdf8',
      isTurn: turn === 'light'
    }
  ];

  const renderPieces = useMemo(
    () => () => {
      const group = piecesGroupRef.current;
      if (!group) return;
      disposeGroupMeshes(group);
      group.clear();
      const board = boardRef.current;
      const { x, y, z, tile } = boardOriginRef.current;
      for (let r = 0; r < SIZE; r += 1) {
        for (let c = 0; c < SIZE; c += 1) {
          const piece = board[r][c];
          if (!piece) continue;
          const pieceGroup = createCheckerMesh({
            tile,
            side: piece.side,
            king: piece.king,
            chipSet: piecePalette,
            checkerHeadPreset
          });

          pieceGroup.position.set(
            x + (c - 3.5) * tile,
            y + tile * CHECKER_PIECE_SURFACE_OFFSET_MULTIPLIER,
            z + (r - 3.5) * tile
          );
          pieceGroup.userData = { r, c, side: piece.side };
          group.add(pieceGroup);
        }
      }
    },
    [checkerHeadPreset, piecePalette.dark, piecePalette.light]
  );

  const renderCapturedPieces = useMemo(
    () => () => {
      const group = capturedPiecesGroupRef.current;
      if (!group) return;
      disposeGroupMeshes(group);
      group.clear();
      const { x, y, z, tile } = boardOriginRef.current;
      const maxPerRow = 12;

      const placeCapturedForSide = (side, edge) => {
        const captured = capturedBySide[side] || [];
        captured.forEach((piece, idx) => {
          const row = Math.floor(idx / maxPerRow);
          const col = idx % maxPerRow;
          const centered =
            col -
            (Math.min(captured.length - row * maxPerRow, maxPerRow) - 1) / 2;
          const checker = createCheckerMesh({
            tile,
            side: piece.side,
            king: piece.king,
            chipSet: piecePalette,
            checkerHeadPreset
          });
          checker.position.set(
            x + centered * tile * CAPTURE_STRIP_PIECE_GAP,
            y + tile * CHECKER_PIECE_SURFACE_OFFSET_MULTIPLIER,
            z + edge * (3.5 + CAPTURE_STRIP_OFFSET_ROWS + row * 0.74) * tile
          );
          group.add(checker);
        });
      };

      placeCapturedForSide('dark', -1);
      placeCapturedForSide('light', 1);
    },
    [capturedBySide, checkerHeadPreset, piecePalette]
  );

  useEffect(() => {
    renderPieces();
  }, [renderPieces, turn]);

  useEffect(() => {
    renderCapturedPieces();
  }, [renderCapturedPieces]);

  const renderHighlights = useMemo(
    () => () => {
      const group = highlightGroupRef.current;
      if (!group) return;
      disposeGroupMeshes(group);
      group.clear();
      const selected = selectedRef.current;
      if (!selected) return;
      const board = boardRef.current;
      const { x, y, z, tile } = boardOriginRef.current;
      const toPosition = (r, c) =>
        new THREE.Vector3(
          x + (c - 3.5) * tile,
          y + tile * 0.02,
          z + (r - 3.5) * tile
        );
      const selection = new THREE.Mesh(
        new THREE.CylinderGeometry(
          tile * 0.3,
          tile * 0.3,
          Math.max(0.07, tile * 0.03),
          20
        ),
        new THREE.MeshBasicMaterial({
          color: CHECKERS_HIGHLIGHT_COLORS.selection,
          transparent: true,
          opacity: 0.9
        })
      );
      selection.position.copy(toPosition(selected.r, selected.c));
      group.add(selection);
      const sideMoves = getMovesForSide(board, turn);
      const forcedCaptures = sideMoves.filter((move) => move.capture);
      const allowedMoves = forcedCaptures.length
        ? forcedCaptures
            .filter(
              (move) => move.from.r === selected.r && move.from.c === selected.c
            )
            .map(({ r, c, capture }) => ({ r, c, capture }))
        : getMoves(board, selected.r, selected.c);
      allowedMoves.forEach((move) => {
        const isCapture = Array.isArray(move.capture);
        const marker = new THREE.Mesh(
          new THREE.CylinderGeometry(
            tile * 0.26,
            tile * 0.26,
            Math.max(0.06, tile * 0.03),
            20
          ),
          new THREE.MeshBasicMaterial({
            color: isCapture
              ? CHECKERS_HIGHLIGHT_COLORS.capture
              : CHECKERS_HIGHLIGHT_COLORS.move,
            transparent: true,
            opacity: 0.9
          })
        );
        marker.position.copy(toPosition(move.r, move.c));
        group.add(marker);
      });
    },
    [turn]
  );

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0b1220');
    sceneRef.current = scene;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    rendererRef.current = renderer;
    const applyRendererQualityProfile = () => {
      const dpr = window.devicePixelRatio || 1;
      const renderScale = Math.max(0.8, graphicsProfile?.renderScale || 1);
      renderer.setPixelRatio(Math.min(dpr * renderScale, 2.5));
    };
    applyRendererQualityProfile();
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    applyRendererSRGB(renderer);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(
      ARENA_CAMERA_DEFAULTS.fov,
      mount.clientWidth / mount.clientHeight,
      ARENA_CAMERA_DEFAULTS.near,
      ARENA_CAMERA_DEFAULTS.far
    );
    cameraRef.current = camera;

    const isPortrait = mount.clientHeight > mount.clientWidth;
    const cameraSeatAngle = Math.PI / 2;
    const cameraBackOffset =
      ((isPortrait ? 2.55 : 1.78) + 0.35) * CHECKERS_ARENA_SCALE;
    const cameraForwardOffset =
      (isPortrait ? 0.08 : 0.2) *
      CHECKERS_ARENA_SCALE *
      CHECKERS_CAMERA_FRAME_COMPENSATION;
    const cameraHeightOffset =
      (isPortrait ? 1.72 : 1.34) *
      CHECKERS_ARENA_SCALE *
      CHECKERS_CAMERA_FRAME_COMPENSATION;
    const cameraRadius =
      CHAIR_DISTANCE +
      cameraBackOffset * CHECKERS_CAMERA_FRAME_COMPENSATION -
      cameraForwardOffset;
    camera.position.set(
      Math.cos(cameraSeatAngle) * cameraRadius,
      TABLE_HEIGHT + cameraHeightOffset,
      Math.sin(cameraSeatAngle) * cameraRadius
    );

    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, TABLE_HEIGHT, 0);
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.enableZoom = true;
    controls.minDistance = TABLE_RADIUS * 1.85;
    controls.maxDistance = TABLE_RADIUS * 4.9;
    controls.minPolarAngle = THREE.MathUtils.degToRad(28);
    controls.maxPolarAngle = ARENA_CAMERA_DEFAULTS.phiMax;
    controls.rotateSpeed = 0.85;
    controls.zoomSpeed = 0.7;
    controls.panSpeed = 0.6;

    scene.add(new THREE.AmbientLight('#ffffff', 0.5));
    const key = new THREE.DirectionalLight('#ffffff', 1.08);
    key.position.set(18, 26, 12);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.00008;
    key.shadow.normalBias = 0.03;
    key.shadow.radius = 2.8;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 120;
    key.shadow.camera.left = -16;
    key.shadow.camera.right = 16;
    key.shadow.camera.top = 16;
    key.shadow.camera.bottom = -16;
    keyLightRef.current = key;
    scene.add(key);
    const shadowCatcher = new THREE.Mesh(
      new THREE.CircleGeometry(SHADOW_CATCHER_SIZE, 72),
      new THREE.ShadowMaterial({
        color: '#000000',
        transparent: true,
        opacity: SHADOW_CATCHER_OPACITY
      })
    );
    shadowCatcher.rotation.x = -Math.PI / 2;
    shadowCatcher.receiveShadow = true;
    shadowCatcher.position.y = SHADOW_CATCHER_ELEVATION;
    shadowCatcher.renderOrder = 1;
    shadowCatcherRef.current = shadowCatcher;
    scene.add(shadowCatcher);

    const piecesGroup = new THREE.Group();
    piecesGroupRef.current = piecesGroup;
    scene.add(piecesGroup);
    const capturedPiecesGroup = new THREE.Group();
    capturedPiecesGroupRef.current = capturedPiecesGroup;
    scene.add(capturedPiecesGroup);
    const highlightGroup = new THREE.Group();
    highlightGroupRef.current = highlightGroup;
    scene.add(highlightGroup);

    moveSoundRef.current = new Audio(MOVE_SOUND_URL);
    moveSoundRef.current.volume = getGameVolume();
    captureSoundRef.current = new Audio(bombSound);
    captureSoundRef.current.volume = getGameVolume();

    const pickTiles = [];
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const applyMove = (r, c) => {
      const isOnlineGame = onlineRef.current.enabled;
      if (isOnlineGame && !onlineRef.current.synced) return;
      if (isOnlineGame && turn !== onlineRef.current.side) {
        setStatus('Waiting for opponent move…');
        return;
      }
      const board = boardRef.current;
      const selected = selectedRef.current;
      const sideMoves = getMovesForSide(board, turn);
      if (!sideMoves.length) {
        const winnerSide = turn === HUMAN_SIDE ? AI_SIDE : HUMAN_SIDE;
        setStatus(
          `${turn === HUMAN_SIDE ? 'You' : 'AI'} has no legal moves. ${winnerSide === HUMAN_SIDE ? 'You' : 'AI'} win.`
        );
        setGameOver(winnerSide);
        return;
      }

      const piece = board[r][c];
      if (piece && piece.side === turn) {
        if (turn === AI_SIDE) return;
        const forcedCaptures = sideMoves.filter((move) => move.capture);
        if (
          forcedCaptures.length &&
          !forcedCaptures.some((move) => move.from.r === r && move.from.c === c)
        ) {
          setStatus(
            'Capture is mandatory. Choose a highlighted capturing piece.'
          );
          return;
        }
        selectedRef.current = { r, c };
        renderHighlights();
        return;
      }
      if (!selected) return;
      const forcedCaptures = sideMoves.filter((move) => move.capture);
      const legalMoves = forcedCaptures.length
        ? forcedCaptures.filter(
            (move) => move.from.r === selected.r && move.from.c === selected.c
          )
        : sideMoves.filter(
            (move) => move.from.r === selected.r && move.from.c === selected.c
          );
      const move = legalMoves.find((m) => m.r === r && m.c === c);
      if (!move) return;
      if (isOnlineGame && onlineRef.current.tableId) {
        const clientMoveId = `${onlineRef.current.accountId || 'guest'}-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`;
        pendingMoveRef.current = clientMoveId;
        socket.emit('checkersMove', {
          tableId: onlineRef.current.tableId,
          move: {
            from: { ...selected },
            to: { r, c },
            clientMoveId
          }
        });
        selectedRef.current = null;
        renderHighlights();
        setStatus('Move submitted…');
        return;
      }

      const beforeBoard = copyBoard(board);
      const applied = applyMoveToBoard(board, {
        from: { ...selected },
        ...move
      });
      if (!applied) return;

      if (Array.isArray(move.capture)) {
        const [captureR, captureC] = move.capture;
        const capturedPiece = beforeBoard[captureR]?.[captureC];
        if (capturedPiece?.side) {
          setCapturedBySide((prev) => ({
            ...prev,
            [turn]: [...prev[turn], capturedPiece]
          }));
        }
      }

      boardRef.current = applied.board;
      const moveAudio = move.capture
        ? captureSoundRef.current
        : moveSoundRef.current;
      if (moveAudio) moveAudio.currentTime = 0;
      moveAudio?.play().catch(() => {});
      renderPieces();

      if (move.capture && applied.chainCaptures.length) {
        selectedRef.current = { r, c };
        replayStateRef.current = {
          beforeBoard,
          afterBoard: copyBoard(applied.board),
          beforeTurn: turn,
          afterTurn: turn
        };
        setCanReplay(true);
        setStatus(
          turn === HUMAN_SIDE
            ? 'Chain capture required. Continue capturing.'
            : 'Chain capture required. Continue capturing.'
        );
        renderHighlights();
        return;
      }

      selectedRef.current = null;
      const nextTurn = turn === HUMAN_SIDE ? AI_SIDE : HUMAN_SIDE;
      replayStateRef.current = {
        beforeBoard,
        afterBoard: copyBoard(applied.board),
        beforeTurn: turn,
        afterTurn: nextTurn
      };
      setCanReplay(true);
      const nextMoves = getMovesForSide(applied.board, nextTurn);
      if (!nextMoves.length) {
        const winnerSide = turn;
        setGameOver(winnerSide);
        setTurn(nextTurn);
        setStatus(
          `${nextTurn === HUMAN_SIDE ? 'You' : 'AI'} has no legal moves. ${winnerSide === HUMAN_SIDE ? 'You' : 'AI'} win!`
        );
      } else {
        setTurn(nextTurn);
        setStatus(
          nextTurn === HUMAN_SIDE
            ? 'Your turn. Forced captures are enabled.'
            : isOnlineGame
            ? 'Opponent is thinking…'
            : 'AI is thinking…'
        );
      }
      renderHighlights();
    };

    const resolveBoardCellFromEvent = (event, isTouchPointer) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const boardOrigin = boardOriginRef.current;
      if (boardOrigin) {
        const boardPlane = new THREE.Plane(
          new THREE.Vector3(0, 1, 0),
          -boardOrigin.y
        );
        const worldPoint = new THREE.Vector3();
        const hitOnPlane = raycaster.ray.intersectPlane(boardPlane, worldPoint);
        if (hitOnPlane) {
          const localC =
            (worldPoint.x - boardOrigin.x) / boardOrigin.tile + 3.5;
          const localR =
            (worldPoint.z - boardOrigin.z) / boardOrigin.tile + 3.5;
          const nearestC = Math.round(localC);
          const nearestR = Math.round(localR);
          const pickRadius = isTouchPointer
            ? TOUCH_PICK_RADIUS_IN_TILES
            : MOUSE_PICK_RADIUS_IN_TILES;
          if (
            nearestR >= 0 &&
            nearestR < SIZE &&
            nearestC >= 0 &&
            nearestC < SIZE &&
            Math.abs(localR - nearestR) <= pickRadius &&
            Math.abs(localC - nearestC) <= pickRadius
          ) {
            return { r: nearestR, c: nearestC };
          }
        }
      }

      const hit = raycaster.intersectObjects(pickTiles, false)[0];
      if (hit?.object?.userData) {
        return { r: hit.object.userData.r, c: hit.object.userData.c };
      }
      return null;
    };

    const onPointerDown = (event) => {
      if (!event.isPrimary) return;
      const isTouchPointer =
        event.pointerType === 'touch' || event.pointerType === 'pen';
      pointerDownRef.current = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        at: performance.now(),
        pointerType: event.pointerType || 'mouse',
        handledOnDown: false
      };
      renderer.domElement.setPointerCapture?.(event.pointerId);

      if (isTouchPointer) {
        const cell = resolveBoardCellFromEvent(event, true);
        if (cell) {
          applyMove(cell.r, cell.c);
          pointerDownRef.current.handledOnDown = true;
        }
      }
    };

    const onPointerCancel = (event) => {
      const pointerDown = pointerDownRef.current;
      if (!pointerDown || pointerDown.id !== event.pointerId) return;
      pointerDownRef.current = null;
    };

    const onPointerUp = (event) => {
      const pointerDown = pointerDownRef.current;
      pointerDownRef.current = null;
      if (!pointerDown || pointerDown.id !== event.pointerId) return;
      if (pointerDown.handledOnDown) {
        renderer.domElement.releasePointerCapture?.(event.pointerId);
        return;
      }

      renderer.domElement.releasePointerCapture?.(event.pointerId);

      const isTouchPointer =
        pointerDown.pointerType === 'touch' ||
        pointerDown.pointerType === 'pen';
      const maxDuration = isTouchPointer
        ? TOUCH_TAP_MAX_DURATION_MS
        : TAP_MAX_DURATION_MS;
      const maxDistance = isTouchPointer
        ? TOUCH_TAP_MAX_DISTANCE_PX
        : TAP_MAX_DISTANCE_PX;

      if (pointerDown) {
        const dt = performance.now() - pointerDown.at;
        const dx = event.clientX - pointerDown.x;
        const dy = event.clientY - pointerDown.y;
        const dist = Math.hypot(dx, dy);
        if (dt > maxDuration || dist > maxDistance) return;
      }
      const cell = resolveBoardCellFromEvent(event, isTouchPointer);
      if (cell) applyMove(cell.r, cell.c);
    };

    const buildSceneAssets = async () => {
      const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });
      const setupPickTiles = () => {
        const { x, y, z, tile } = boardOriginRef.current;
        if (pickTiles.length) return;
        for (let r = 0; r < SIZE; r += 1) {
          for (let c = 0; c < SIZE; c += 1) {
            const pick = new THREE.Mesh(
              new THREE.BoxGeometry(tile * 0.94, 0.25, tile * 0.94),
              pickMaterial
            );
            pick.position.set(
              x + (c - 3.5) * tile,
              y + 0.16,
              z + (r - 3.5) * tile
            );
            pick.userData = { r, c };
            pickTiles.push(pick);
            scene.add(pick);
          }
        }
      };

      try {
        const desiredShapeId =
          CHECKERS_TABLE_SHAPE_BY_ID[appearance.tableId] || 'classicOctagon';
        const desiredShape =
          TABLE_SHAPE_OPTIONS.find((shape) => shape.id === desiredShapeId) ||
          TABLE_SHAPE_OPTIONS[0];
        const table = createMurlanStyleTable({
          arena: scene,
          renderer,
          tableRadius: TABLE_RADIUS,
          tableHeight: TABLE_HEIGHT,
          shapeOption: desiredShape
        });
        table.userData = { selectedTableId: appearance.tableId };
        const finish =
          MURLAN_TABLE_FINISHES.find((f) => f.id === appearance.tableFinish) ||
          MURLAN_TABLE_FINISHES[0];
        const cloth =
          TABLE_CLOTH_OPTIONS.find((clothOpt) => clothOpt.id === appearance.tableCloth) ||
          TABLE_CLOTH_OPTIONS[0];
        applyTableMaterials(
          table.materials,
          {
            woodOption: finish?.woodOption,
            clothOption: cloth
          },
          renderer
        );
        reduceCheckersTableBase(table.group);
        tableRef.current = table;
      } catch (error) {
        console.error('Checkers table load failed:', error);
      }

      try {
        const chairOption =
          CHESS_CHAIR_OPTIONS.find((c) => c.id === appearance.chairId) ||
          CHESS_CHAIR_OPTIONS[0];
        const chairColor =
          chairOption?.primary || chairOption?.seatColor || '#8b0000';
        const chairTemplate = await buildChessMappedChairTemplate();
        const makeChair = (z, ry) => {
          const g = chairTemplate.clone(true);
          g.traverse((obj) => {
            if (!obj.isMesh) return;
            const mats = Array.isArray(obj.material)
              ? obj.material
              : [obj.material];
            mats.forEach((mat) => {
              if (mat?.color) mat.color.set(chairColor);
              mat.needsUpdate = true;
            });
          });
          g.scale.setScalar(CHAIR_VISUAL_SCALE);
          g.position.set(0, CHAIR_HEIGHT, z);
          g.rotation.y = ry;
          groundGroupToFloor(
            g,
            -CHAIR_GROUNDING_EPSILON - CHAIR_GROUND_SINK
          );
          scene.add(g);
          return g;
        };
        chairsRef.current = [
          makeChair(CHAIR_DISTANCE, Math.PI),
          makeChair(-CHAIR_DISTANCE, 0)
        ];
      } catch (error) {
        console.error('Checkers chairs load failed, using fallback:', error);
        const chairOption =
          CHESS_CHAIR_OPTIONS.find((c) => c.id === appearance.chairId) ||
          CHESS_CHAIR_OPTIONS[0];
        const chairColor =
          chairOption?.primary || chairOption?.seatColor || '#8b0000';
        const legColor = chairOption?.legColor || '#111827';
        const makeFallback = (z, ry) => {
          const g = createProceduralChairFallback(chairColor, legColor);
          g.scale.setScalar(CHAIR_VISUAL_SCALE);
          g.position.set(0, CHAIR_HEIGHT, z);
          g.rotation.y = ry;
          groundGroupToFloor(
            g,
            -CHAIR_GROUNDING_EPSILON - CHAIR_GROUND_SINK
          );
          scene.add(g);
          return g;
        };
        chairsRef.current = [
          makeFallback(CHAIR_DISTANCE, Math.PI),
          makeFallback(-CHAIR_DISTANCE, 0)
        ];
      }

      const addVisibleBoardBase = () => {
        const boardBase = new THREE.Group();
        const boardTheme =
          CHECKERS_BOARD_THEME_OPTIONS.find(
            (theme) => theme.id === appearance.boardTheme
          ) || CHECKERS_BOARD_THEME_OPTIONS[0];
        boardThemeRef.current = boardTheme;
        const lightMat = new THREE.MeshStandardMaterial({
          color: boardTheme.light,
          roughness: 0.34,
          metalness: 0.22
        });
        const darkMat = new THREE.MeshStandardMaterial({
          color: boardTheme.dark,
          roughness: 0.4,
          metalness: 0.28
        });
        proceduralBoardRef.current = { lightMat, darkMat };
        for (let r = 0; r < SIZE; r += 1) {
          for (let c = 0; c < SIZE; c += 1) {
            const sq = new THREE.Mesh(
              new THREE.BoxGeometry(BOARD_TILE_SIZE, 0.06, BOARD_TILE_SIZE),
              (r + c) % 2 ? darkMat : lightMat
            );
            sq.position.set(
              (c - 3.5) * BOARD_TILE_SIZE,
              TABLE_HEIGHT + 0.02,
              (r - 3.5) * BOARD_TILE_SIZE
            );
            sq.receiveShadow = true;
            boardBase.add(sq);
          }
        }
        scene.add(boardBase);
        return boardBase;
      };

      const proceduralBoard = addVisibleBoardBase();

      try {
        const boardRoot = await loadCheckersBoardModel(renderer);
        scene.add(boardRoot);
        gltfBoardRef.current = boardRoot;
        applyCheckersBoardTheme(boardRoot, boardThemeRef.current);
        proceduralBoard.visible = false;
      } catch {
        proceduralBoard.visible = true;
      }

      boardOriginRef.current = {
        x: 0,
        y: TABLE_HEIGHT + CHECKER_BOARD_PIECE_BASE_HEIGHT_OFFSET,
        z: 0,
        tile: resolveCheckersPlayableTileSize(
          gltfBoardRef.current || proceduralBoard
        )
      };

      alignArenaGroundArtifacts({
        shadowCatcher: shadowCatcherRef.current,
        skybox: envRef.current?.skybox,
        table: tableRef.current,
        board: gltfBoardRef.current || proceduralBoard,
        chairs: chairsRef.current
      });

      setupPickTiles();
      renderPieces();
      renderCapturedPieces();
      renderHighlights();
      setStatus(
        `Tap your piece, then a highlighted square to move. ${RULE_SUMMARY}`
      );
    };

    void buildSceneAssets();

    const onResize = () => {
      if (!mount) return;
      applyRendererQualityProfile();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
    };

    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.addEventListener('pointerdown', onPointerDown, {
      passive: true
    });
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerCancel);
    window.addEventListener('resize', onResize);

    let raf = 0;
    let previousFrameAt = performance.now();
    const loop = (now = performance.now()) => {
      raf = requestAnimationFrame(loop);
      const maxFps = Math.max(30, graphicsProfile?.maxFps || 60);
      const minFrameMs = 1000 / maxFps;
      if (now - previousFrameAt < minFrameMs) return;
      previousFrameAt = now;
      controls.update();
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerCancel);
      disposeGroupMeshes(piecesGroupRef.current);
      piecesGroupRef.current?.clear?.();
      disposeGroupMeshes(capturedPiecesGroupRef.current);
      capturedPiecesGroupRef.current?.clear?.();
      disposeGroupMeshes(highlightGroupRef.current);
      highlightGroupRef.current?.clear?.();
      renderer.dispose();
      rendererRef.current = null;
      moveSoundRef.current?.pause();
      moveSoundRef.current = null;
      captureSoundRef.current?.pause();
      captureSoundRef.current = null;
      if (mount.contains(renderer.domElement))
        mount.removeChild(renderer.domElement);
      cameraRef.current = null;
      controlsRef.current = null;
    };
  }, [graphicsProfile]);

  useEffect(() => {
    const isOnlineGame = mode === 'online';
    onlineRef.current.enabled = isOnlineGame;
    if (!isOnlineGame) return;
    if (!tableId || !accountId) return;

    onlineRef.current.tableId = tableId;
    onlineRef.current.accountId = accountId;
    onlineRef.current.synced = false;
    setOnlineStatus('connecting');
    setStatus('Connecting to online table…');

    const handleGameStart = ({ tableId: startedId, players: remotePlayers = [] } = {}) => {
      if (!startedId || startedId !== tableId) return;
      const me = remotePlayers.find((player) => String(player.id) === String(accountId));
      const opp = remotePlayers.find((player) => String(player.id) !== String(accountId));
      const mySide =
        me?.side === 'black' || me?.side === 'dark'
          ? 'dark'
          : me?.side === 'white' || me?.side === 'light'
          ? 'light'
          : onlineRef.current.side;
      onlineRef.current.side = mySide;
      onlineRef.current.opponent = opp || null;
      setOnlineOpponent(
        opp ? { name: opp.name || 'Opponent', avatar: opp.avatar || '' } : null
      );
      setOnlineStatus('in-game');
      setStatus(mySide === 'light' ? 'Your turn. Forced captures are enabled.' : 'Waiting for opponent move…');
    };

    const handleCheckersState = ({ tableId: eventTableId, board, turn: remoteTurn } = {}) => {
      if (!eventTableId || eventTableId !== tableId) return;
      if (!Array.isArray(board)) return;
      boardRef.current = copyBoard(board);
      selectedRef.current = null;
      setTurn(remoteTurn === 'dark' ? 'dark' : 'light');
      setCanReplay(false);
      setGameOver(null);
      setCapturedBySide({ light: [], dark: [] });
      renderPieces();
      renderHighlights();
      onlineRef.current.synced = true;
      setOnlineStatus('in-game');
      const myTurn = (remoteTurn === 'dark' ? 'dark' : 'light') === onlineRef.current.side;
      setStatus(myTurn ? 'Your turn. Forced captures are enabled.' : 'Waiting for opponent move…');
    };
    const handleMoveAccepted = ({ tableId: eventTableId, clientMoveId, chainCapture } = {}) => {
      if (!eventTableId || eventTableId !== tableId) return;
      if (pendingMoveRef.current && clientMoveId && pendingMoveRef.current !== clientMoveId) return;
      pendingMoveRef.current = null;
      if (chainCapture) {
        setStatus('Chain capture required.');
      }
    };
    const handleMoveRejected = ({ tableId: eventTableId, clientMoveId, error } = {}) => {
      if (!eventTableId || eventTableId !== tableId) return;
      if (pendingMoveRef.current && clientMoveId && pendingMoveRef.current !== clientMoveId) return;
      pendingMoveRef.current = null;
      const msg =
        error === 'move_rate_limited'
          ? 'Too fast. Wait a moment and retry.'
          : error === 'not_your_turn'
          ? 'Not your turn.'
          : error === 'duplicate_move'
          ? 'Duplicate move ignored.'
          : error === 'chain_capture_required_piece'
          ? 'You must continue with the same piece for chain capture.'
          : 'Move rejected. Syncing board…';
      setStatus(msg);
      socket.emit('checkersSyncRequest', { tableId });
    };
    const handleMatchEnded = ({ tableId: eventTableId, winnerId } = {}) => {
      if (!eventTableId || eventTableId !== tableId) return;
      pendingMoveRef.current = null;
      const meWon = winnerId && String(winnerId) === String(accountId);
      setGameOver(meWon ? HUMAN_SIDE : AI_SIDE);
      setStatus(meWon ? 'You won the match!' : 'You lost the match.');
    };
    const handleSettlementConfirmed = ({ tableId: eventTableId, payoutAmount, winnerId, status: settlementStatus } = {}) => {
      if (!eventTableId || eventTableId !== tableId) return;
      if (String(winnerId || '') !== String(accountId || '')) return;
      if (settlementStatus === 'settled' && Number(payoutAmount) > 0) {
        setStatus(`Match settled. +${Number(payoutAmount)} TPC paid.`);
      }
    };
    const handleSocketDisconnect = () => {
      setOnlineStatus('reconnecting');
      setStatus('Connection lost. Reconnecting to table…');
    };
    const handleSocketReconnect = () => {
      socket.emit('register', { playerId: accountId });
      socket.emit('joinCheckersRoom', { tableId, accountId });
      socket.emit('checkersSyncRequest', { tableId });
    };

    let cancelled = false;
    socket.on('gameStart', handleGameStart);
    socket.on('checkersState', handleCheckersState);
    socket.on('checkersMoveAccepted', handleMoveAccepted);
    socket.on('checkersMoveRejected', handleMoveRejected);
    socket.on('matchEnded', handleMatchEnded);
    socket.on('settlementConfirmed', handleSettlementConfirmed);
    socket.on('disconnect', handleSocketDisconnect);
    socket.on('reconnect', handleSocketReconnect);

    const joinOnlineTable = async () => {
      const connected = await ensureOnlineSocketConnected();
      if (cancelled) return;
      if (!connected) {
        setOnlineStatus('error');
        setStatus('Online connection failed. Return to lobby and retry.');
        return;
      }
      socket.emit('register', { playerId: accountId });
      socket.emit('joinCheckersRoom', { tableId, accountId });
      socket.emit('checkersSyncRequest', { tableId });
    };

    void joinOnlineTable();

    return () => {
      cancelled = true;
      socket.off('gameStart', handleGameStart);
      socket.off('checkersState', handleCheckersState);
      socket.off('checkersMoveAccepted', handleMoveAccepted);
      socket.off('checkersMoveRejected', handleMoveRejected);
      socket.off('matchEnded', handleMatchEnded);
      socket.off('settlementConfirmed', handleSettlementConfirmed);
      socket.off('disconnect', handleSocketDisconnect);
      socket.off('reconnect', handleSocketReconnect);
      socket.emit('leaveLobby', { accountId, tableId });
    };
  }, [accountId, mode, renderHighlights, renderPieces, tableId]);

  useEffect(() => {
    if (onlineRef.current.enabled) return;
    if (turn !== AI_SIDE || aiBusyRef.current || gameOver) return;
    aiBusyRef.current = true;
    setStatus('AI is thinking…');
    const timer = window.setTimeout(() => {
      const board = boardRef.current;
      const sideMoves = getMovesForSide(board, AI_SIDE);
      if (!sideMoves.length) {
        setStatus('AI has no legal moves. You win!');
        setGameOver(HUMAN_SIDE);
        aiBusyRef.current = false;
        return;
      }
      const chosen =
        searchBestMove(board, AI_SIDE, AI_SEARCH_DEPTH).move || sideMoves[0];
      const applied = applyMoveToBoard(board, chosen);
      if (!applied) {
        aiBusyRef.current = false;
        return;
      }
      const beforeBoard = copyBoard(board);
      if (Array.isArray(chosen.capture)) {
        const [captureR, captureC] = chosen.capture;
        const capturedPiece = beforeBoard[captureR]?.[captureC];
        if (capturedPiece?.side) {
          setCapturedBySide((prev) => ({
            ...prev,
            [AI_SIDE]: [...prev[AI_SIDE], capturedPiece]
          }));
        }
      }
      boardRef.current = applied.board;
      const moveAudio = chosen.capture
        ? captureSoundRef.current
        : moveSoundRef.current;
      if (moveAudio) moveAudio.currentTime = 0;
      moveAudio?.play().catch(() => {});
      renderPieces();

      if (chosen.capture && applied.chainCaptures.length) {
        let chainBoard = applied.board;
        let chainBefore = beforeBoard;
        let chainCaptureMoves = applied.chainCaptures;
        let currentFrom = { r: chosen.r, c: chosen.c };
        while (chainCaptureMoves.length) {
          const bestChain = searchBestMove(
            chainBoard,
            AI_SIDE,
            Math.max(2, AI_SEARCH_DEPTH - 2)
          ).move;
          const forced = chainCaptureMoves.map((m) => ({
            from: { ...currentFrom },
            ...m
          }));
          const selectedChainMove =
            forced.find(
              (m) => bestChain && m.r === bestChain.r && m.c === bestChain.c
            ) || forced[0];
          if (Array.isArray(selectedChainMove.capture)) {
            const [captureR, captureC] = selectedChainMove.capture;
            const capturedPiece = chainBoard[captureR]?.[captureC];
            if (capturedPiece?.side) {
              setCapturedBySide((prev) => ({
                ...prev,
                [AI_SIDE]: [...prev[AI_SIDE], capturedPiece]
              }));
            }
          }
          const nextChain = applyMoveToBoard(chainBoard, selectedChainMove);
          if (!nextChain) break;
          chainBoard = nextChain.board;
          currentFrom = { r: selectedChainMove.r, c: selectedChainMove.c };
          chainCaptureMoves = nextChain.chainCaptures;
        }
        boardRef.current = chainBoard;
        renderPieces();
        replayStateRef.current = {
          beforeBoard: chainBefore,
          afterBoard: copyBoard(chainBoard),
          beforeTurn: AI_SIDE,
          afterTurn: HUMAN_SIDE
        };
      } else {
        replayStateRef.current = {
          beforeBoard,
          afterBoard: copyBoard(applied.board),
          beforeTurn: AI_SIDE,
          afterTurn: HUMAN_SIDE
        };
      }

      setCanReplay(true);
      selectedRef.current = null;
      setTurn(HUMAN_SIDE);
      setStatus('Your turn. Forced captures are enabled.');
      renderHighlights();
      aiBusyRef.current = false;
    }, 420);

    return () => {
      window.clearTimeout(timer);
      aiBusyRef.current = false;
    };
  }, [turn, renderHighlights, renderPieces, gameOver]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const desiredShapeId =
      CHECKERS_TABLE_SHAPE_BY_ID[appearance.tableId] || 'classicOctagon';
    const currentShapeId = tableRef.current?.shapeId || 'classicOctagon';
    if (tableRef.current && currentShapeId !== desiredShapeId) {
      const currentTable = tableRef.current;
      currentTable.dispose?.();
      const shapeOption =
        TABLE_SHAPE_OPTIONS.find((shape) => shape.id === desiredShapeId) ||
        TABLE_SHAPE_OPTIONS[0];
      const rebuilt = createMurlanStyleTable({
        arena: scene,
        renderer: rendererRef.current,
        tableRadius: TABLE_RADIUS,
        tableHeight: TABLE_HEIGHT,
        shapeOption
      });
      rebuilt.userData = { selectedTableId: appearance.tableId };
      reduceCheckersTableBase(rebuilt.group);
      tableRef.current = rebuilt;
    }
    const finish =
      MURLAN_TABLE_FINISHES.find((f) => f.id === appearance.tableFinish) ||
      MURLAN_TABLE_FINISHES[0];
    const cloth =
      TABLE_CLOTH_OPTIONS.find((clothOpt) => clothOpt.id === appearance.tableCloth) ||
      TABLE_CLOTH_OPTIONS[0];
    if (tableRef.current?.materials) {
      applyTableMaterials(
        tableRef.current.materials,
        {
          woodOption: finish?.woodOption,
          clothOption: cloth
        },
        rendererRef.current
      );
    }

    const chairOption =
      CHESS_CHAIR_OPTIONS.find((c) => c.id === appearance.chairId) ||
      CHESS_CHAIR_OPTIONS[0];
    const nextChairColor = new THREE.Color(
      chairOption?.primary || chairOption?.seatColor || '#8b0000'
    );
    chairsRef.current.forEach((chairGroup) => {
      chairGroup?.traverse?.((child) => {
        if (child?.isMesh && child.material?.color) {
          child.material.color.copy(nextChairColor);
          child.material.needsUpdate = true;
        }
      });
    });

    const boardTheme =
      CHECKERS_BOARD_THEME_OPTIONS.find(
        (theme) => theme.id === appearance.boardTheme
      ) || CHECKERS_BOARD_THEME_OPTIONS[0];
    boardThemeRef.current = boardTheme;
    const boardMats = proceduralBoardRef.current;
    if (boardMats.lightMat?.color)
      boardMats.lightMat.color.set(boardTheme.light);
    if (boardMats.darkMat?.color) boardMats.darkMat.color.set(boardTheme.dark);
    if (gltfBoardRef.current)
      applyCheckersBoardTheme(gltfBoardRef.current, boardTheme);

    if (envRef.current?.hdriId === appearance.hdriId) return;

    const applyHdri = async () => {
      try {
        const variant = resolveGraphicsHdriVariant(
          resolveHdriVariant(appearance.hdriId),
          graphicsProfile,
          rendererRef.current
        );
        const envResult = await loadPolyHavenHdriEnvironment(
          rendererRef.current,
          variant
        );
        if (!envResult?.envMap) return;
        const { envMap, skyboxMap } = envResult;
        scene.environment = envMap;
        scene.background = null;
        if (typeof variant?.environmentIntensity === 'number') {
          scene.environmentIntensity = variant.environmentIntensity;
        }
        if (typeof variant?.exposure === 'number' && rendererRef.current) {
          rendererRef.current.toneMappingExposure = variant.exposure;
        }
        if (envRef.current?.skybox) scene.remove(envRef.current.skybox);
        const cameraHeight =
          Math.max(
            variant?.cameraHeightM ?? DEFAULT_HDRI_CAMERA_HEIGHT_M,
            MIN_HDRI_CAMERA_HEIGHT_M
          ) * HDRI_UNITS_PER_METER;
        const radiusMultiplier =
          typeof variant?.groundRadiusMultiplier === 'number'
            ? variant.groundRadiusMultiplier
            : DEFAULT_HDRI_RADIUS_MULTIPLIER;
        const sceneSpan = CHECKERS_ROOM_HALF_SPAN;
        const groundRadius = Math.max(
          sceneSpan * radiusMultiplier * HDRI_UNITS_PER_METER,
          MIN_HDRI_RADIUS
        );
        const skyboxResolution = Math.max(
          16,
          Math.floor(
            variant?.groundResolution ?? DEFAULT_HDRI_GROUNDED_RESOLUTION
          )
        );
        const skybox = new GroundedSkybox(
          skyboxMap || envMap,
          cameraHeight,
          groundRadius,
          skyboxResolution
        );
        skybox.userData.cameraHeight = cameraHeight;
        if (typeof variant?.rotationY === 'number')
          skybox.rotation.y = variant.rotationY;
        scene.add(skybox);
        alignArenaGroundArtifacts({
          shadowCatcher: shadowCatcherRef.current,
          skybox,
          table: tableRef.current,
          board: gltfBoardRef.current,
          chairs: chairsRef.current
        });
        const keyLight = keyLightRef.current;
        if (keyLight) {
          const lightAngle =
            (typeof variant?.rotationY === 'number' ? variant.rotationY : 0) +
            Math.PI * 0.28;
          keyLight.position.set(
            Math.cos(lightAngle) * 18,
            25,
            Math.sin(lightAngle) * 18
          );
          keyLight.intensity = THREE.MathUtils.clamp(
            (variant?.environmentIntensity ?? 1.06) * 0.92,
            0.72,
            1.2
          );
        }
        envRef.current = { map: envMap, skybox, hdriId: appearance.hdriId };
      } catch (error) {
        console.error('Checkers HDRI swap failed:', error);
      }
    };

    void applyHdri();
  }, [appearance, graphicsProfile]);

  useEffect(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    const target = new THREE.Vector3(0, TABLE_HEIGHT, 0);
    if (viewMode === '2d') {
      camera.position.set(
        0,
        TABLE_HEIGHT + 9.2 * CHECKERS_ARENA_SCALE,
        0.001
      );
      controls.enableRotate = false;
      controls.minPolarAngle = 0;
      controls.maxPolarAngle = 0;
    } else {
      const cameraSeatAngle = Math.PI / 2;
      const cameraRadius =
        CHAIR_DISTANCE +
        2.7 * CHECKERS_ARENA_SCALE * CHECKERS_CAMERA_FRAME_COMPENSATION;
      camera.position.set(
        Math.cos(cameraSeatAngle) * cameraRadius,
        TABLE_HEIGHT +
          1.72 * CHECKERS_ARENA_SCALE * CHECKERS_CAMERA_FRAME_COMPENSATION,
        Math.sin(cameraSeatAngle) * cameraRadius
      );
      controls.enableRotate = true;
      controls.minPolarAngle = THREE.MathUtils.degToRad(28);
      controls.maxPolarAngle = ARENA_CAMERA_DEFAULTS.phiMax;
    }
    controls.target.copy(target);
    controls.update();
  }, [viewMode]);

  const restartGame = () => {
    if (onlineRef.current.enabled && onlineRef.current.tableId) {
      socket.emit('checkersSyncRequest', { tableId: onlineRef.current.tableId });
      return;
    }
    boardRef.current = createInitial();
    selectedRef.current = null;
    replayStateRef.current = null;
    setCanReplay(false);
    setGameOver(null);
    setCapturedBySide({ light: [], dark: [] });
    setTurn(HUMAN_SIDE);
    setStatus(
      `Tap your piece, then a highlighted square to move. ${RULE_SUMMARY}`
    );
    renderPieces();
    renderHighlights();
  };

  useEffect(() => {
    if (!gameOver) return;
    const winnerAvatar =
      gameOver === HUMAN_SIDE ? playerPhotoUrl : '/assets/icons/profile.svg';
    coinConfetti(60, winnerAvatar);
  }, [gameOver, playerPhotoUrl]);

  const replayLastMove = () => {
    if (!replayStateRef.current) return;
    const replay = replayStateRef.current;
    boardRef.current = copyBoard(replay.beforeBoard);
    setTurn(replay.beforeTurn);
    renderPieces();
    setTimeout(() => {
      boardRef.current = copyBoard(replay.afterBoard);
      setTurn(replay.afterTurn);
      renderPieces();
    }, 700);
  };

  const optionButton = (active) =>
    `rounded-lg border px-2 py-1 text-[11px] ${active ? 'border-cyan-300 bg-cyan-500/20 text-cyan-100' : 'border-white/15 bg-white/5 text-white/70'}`;

  if (mode === 'online' && redirecting) {
    return (
      <div className="p-4 text-center text-sm text-subtext">
        Syncing with the lobby…
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#050814] text-white">
      <div ref={mountRef} className="h-full w-full" />
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-4 z-20 flex flex-col items-start gap-3 pointer-events-none">
          <button
            type="button"
            onClick={() => setConfigOpen((open) => !open)}
            className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-gray-100"
          >
            <span className="text-base leading-none">☰</span>
            <span className="leading-none">Menu</span>
          </button>
        </div>

        <div className="absolute top-20 right-4 z-20 flex flex-col items-end gap-3 pointer-events-none">
          <div className="pointer-events-auto flex flex-col items-end gap-3">
            <button
              type="button"
              onClick={replayLastMove}
              disabled={!canReplay}
              className={`icon-only-button flex h-10 w-10 items-center justify-center text-[1.4rem] ${canReplay ? 'text-white/90' : 'text-white/40'}`}
            >
              ↺
            </button>
            <button
              type="button"
              onClick={() =>
                setViewMode((mode) => (mode === '3d' ? '2d' : '3d'))
              }
              className="icon-only-button flex h-10 w-10 items-center justify-center text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-white/90"
            >
              {viewMode === '3d' ? '2D' : '3D'}
            </button>
          </div>
          {configOpen && (
            <div className="pointer-events-auto mt-2 w-72 max-w-[80vw] rounded-2xl border border-white/15 bg-black/80 p-4 text-xs text-white shadow-2xl backdrop-blur max-h-[80vh] overflow-y-auto pr-1">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-white/80">
                Checkers Battle Royal
              </div>
              <button
                type="button"
                onClick={() =>
                  setViewMode((mode) => (mode === '3d' ? '2d' : '3d'))
                }
                className="w-full rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/90"
              >
                {viewMode === '3d' ? '2D View' : '3D View'}
              </button>
              <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-white/70">
                  Tables
                </div>
                <div className="mb-3 grid max-h-40 grid-cols-2 gap-2 overflow-auto">
                  {unlockedTableOptions.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() =>
                        setAppearance((prev) => ({ ...prev, tableId: opt.id }))
                      }
                      className={`rounded-xl border px-2 py-2 text-[11px] ${appearance.tableId === opt.id ? 'border-cyan-300 bg-cyan-500/20 text-cyan-100' : 'border-white/15 bg-white/5 text-white/70'}`}
                    >
                      {opt.thumbnail ? (
                        <img
                          src={opt.thumbnail}
                          alt={`${opt.label} thumbnail`}
                          className="mb-1 h-10 w-full rounded object-cover"
                        />
                      ) : null}
                      {opt.label}
                    </button>
                  ))}
                </div>

                {showTableSurfaceOptions ? (
                  <>
                    <div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-white/70">
                      Table Finish
                    </div>
                    <div className="mb-3 grid max-h-40 grid-cols-2 gap-2 overflow-auto">
                      {unlockedTableFinishes.map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() =>
                            setAppearance((prev) => ({
                              ...prev,
                              tableFinish: opt.id
                            }))
                          }
                          className={`rounded-xl border px-2 py-2 text-[11px] ${appearance.tableFinish === opt.id ? 'border-cyan-300 bg-cyan-500/20 text-cyan-100' : 'border-white/15 bg-white/5 text-white/70'}`}
                        >
                          {opt.thumbnail ? (
                            <img
                              src={opt.thumbnail}
                              alt={`${opt.label} thumbnail`}
                              className="mb-1 h-10 w-full rounded object-cover"
                            />
                          ) : null}
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-white/70">
                      Table Cloth
                    </div>
                    <div className="mb-3 grid max-h-40 grid-cols-2 gap-2 overflow-auto">
                      {unlockedTableCloths.map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() =>
                            setAppearance((prev) => ({
                              ...prev,
                              tableCloth: opt.id
                            }))
                          }
                          className={`rounded-xl border px-2 py-2 text-[11px] ${appearance.tableCloth === opt.id ? 'border-cyan-300 bg-cyan-500/20 text-cyan-100' : 'border-white/15 bg-white/5 text-white/70'}`}
                        >
                          {opt.thumbnail ? (
                            <img
                              src={opt.thumbnail}
                              alt={`${opt.label} thumbnail`}
                              className="mb-1 h-10 w-full rounded object-cover"
                            />
                          ) : null}
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}

                <div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-white/70">
                  Board
                </div>
                <div className="mb-3 grid max-h-40 grid-cols-2 gap-2 overflow-auto">
                  {unlockedBoardThemes.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() =>
                        setAppearance((prev) => ({
                          ...prev,
                          boardTheme: opt.id
                        }))
                      }
                      className={`rounded-xl border px-2 py-2 text-[11px] ${appearance.boardTheme === opt.id ? 'border-cyan-300 bg-cyan-500/20 text-cyan-100' : 'border-white/15 bg-white/5 text-white/70'}`}
                    >
                      {opt.thumbnail ? (
                        <img
                          src={opt.thumbnail}
                          alt={`${opt.label} thumbnail`}
                          className="mb-1 h-10 w-full rounded object-cover"
                        />
                      ) : null}
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-white/70">
                  Chairs
                </div>
                <div className="mb-3 grid max-h-40 grid-cols-2 gap-2 overflow-auto">
                  {unlockedChairOptions.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() =>
                        setAppearance((prev) => ({ ...prev, chairId: opt.id }))
                      }
                      className={`rounded-xl border px-2 py-2 text-[11px] ${appearance.chairId === opt.id ? 'border-cyan-300 bg-cyan-500/20 text-cyan-100' : 'border-white/15 bg-white/5 text-white/70'}`}
                    >
                      {opt.thumbnail ? (
                        <img
                          src={opt.thumbnail}
                          alt={`${opt.label} thumbnail`}
                          className="mb-1 h-10 w-full rounded object-cover"
                        />
                      ) : null}
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="mb-2 text-[11px] text-white/70">HDRI</div>
                <div className="mb-3 flex max-h-24 flex-wrap gap-2 overflow-auto">
                  {unlockedHdriOptions.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() =>
                        setAppearance((prev) => ({ ...prev, hdriId: opt.id }))
                      }
                      className={optionButton(appearance.hdriId === opt.id)}
                    >
                      {opt.name}
                    </button>
                  ))}
                </div>
                <div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-white/70">
                  Graphics & FPS
                </div>
                <div className="mb-3 grid gap-2">
                  {CHECKERS_GRAPHICS_PROFILES.map((profile) => (
                    <button
                      key={profile.id}
                      onClick={() => setGraphicsProfileId(profile.id)}
                      className={`rounded-xl border px-2 py-2 text-left text-[11px] ${
                        graphicsProfileId === profile.id
                          ? 'border-cyan-300 bg-cyan-500/20 text-cyan-100'
                          : 'border-white/15 bg-white/5 text-white/70'
                      }`}
                    >
                      <div className="font-semibold">{profile.label}</div>
                      <div className="mt-0.5 text-[10px] text-white/65">
                        {profile.description}
                      </div>
                      <div className="mt-1 text-[10px] text-white/55">
                        Target: {profile.fpsHint}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mb-2 text-[11px] text-white/70">Pieces P1</div>
                <div className="mb-3 grid max-h-32 grid-cols-2 gap-2 overflow-auto">
                  {unlockedPieceStyles.map((set) => (
                    <button
                      key={set.id}
                      onClick={() => setP1PieceStyleId(set.id)}
                      className={optionButton(p1PieceStyleId === set.id)}
                    >
                      {CHESS_BATTLE_OPTION_LABELS.sideColor?.[set.id] || set.id}
                    </button>
                  ))}
                </div>
                <div className="mb-2 text-[11px] text-white/70">Pieces P2</div>
                <div className="grid max-h-32 grid-cols-2 gap-2 overflow-auto">
                  {unlockedPieceStyles.map((set) => (
                    <button
                      key={`p2-${set.id}`}
                      onClick={() => setP2PieceStyleId(set.id)}
                      className={optionButton(p2PieceStyleId === set.id)}
                    >
                      {CHESS_BATTLE_OPTION_LABELS.sideColor?.[set.id] || set.id}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="pointer-events-auto">
          <BottomLeftIcons
            onGift={() => setShowGift(true)}
            showInfo={false}
            showChat={false}
            showMute={false}
            className="fixed right-3 bottom-28 z-50 flex flex-col gap-4"
            buttonClassName="icon-only-button pointer-events-auto flex h-11 w-11 items-center justify-center text-white/90"
            iconClassName="text-[1.65rem] leading-none"
            labelClassName="sr-only"
            giftIcon="🎁"
            order={['gift']}
          />
        </div>

        <div className="absolute inset-0 z-10 pointer-events-none">
          {players.map((player) => (
            <div
              key={`checkers-seat-${player.index}`}
              className="absolute pointer-events-auto flex flex-col items-center"
              data-player-index={player.index}
              data-self-player={player.index === 1 ? 'true' : 'false'}
              data-is-user={player.index === 1 ? 'true' : 'false'}
              aria-label={player.index === 1 ? 'You' : player.name}
              style={{
                left: FALLBACK_SEAT_POSITIONS[player.index].left,
                top: FALLBACK_SEAT_POSITIONS[player.index].top,
                transform: 'translate(-50%, -50%)'
              }}
            >
              <AvatarTimer
                index={player.index}
                photoUrl={player.photoUrl}
                active={player.isTurn}
                isTurn={player.isTurn}
                timerPct={1}
                name={player.name}
                color={player.color}
                size={1}
              />
              <span className="mt-1 text-[0.65rem] font-semibold text-white">
                {player.name}
              </span>
            </div>
          ))}
        </div>

        <div className="absolute top-4 left-1/2 z-30 -translate-x-1/2 pointer-events-none px-4">
          <div
            className="mx-auto w-full max-w-[88vw] rounded-2xl border border-white/20 bg-[linear-gradient(135deg,rgba(10,16,28,0.78),rgba(27,42,67,0.64))] px-4 py-2 text-center shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur"
            style={{
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              display: '-webkit-box',
              overflow: 'hidden'
            }}
          >
            <p className="text-[11px] font-semibold leading-4 tracking-[0.02em] text-white/95">
              {status} • Turn: {turn}
              {mode === 'online'
                ? ` • Online: ${onlineStatus}${tableId ? ` • Table ${tableId.slice(0, 8)}` : ''}`
                : ''}
            </p>
          </div>
        </div>

        {gameOver ? (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/65 p-4">
            <div className="w-full max-w-xs rounded-2xl border border-yellow-300/40 bg-slate-950/90 p-4 text-center shadow-2xl">
              <p className="text-xs uppercase tracking-[0.2em] text-yellow-300">
                Winner
              </p>
              <img
                src={
                  gameOver === HUMAN_SIDE
                    ? playerPhotoUrl
                    : '/assets/icons/profile.svg'
                }
                alt="winner avatar"
                className="mx-auto mt-3 h-20 w-20 rounded-full border-4 border-yellow-300/70 object-cover"
              />
              <p className="mt-2 text-lg font-bold text-white">
                {gameOver === HUMAN_SIDE ? playerName : 'Rival'}
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={restartGame}
                  className="flex-1 rounded-xl border border-cyan-300/60 bg-cyan-500/20 px-3 py-2 text-sm font-semibold text-cyan-100"
                >
                  Play Again
                </button>
                <button
                  onClick={() => navigate('/games/checkersbattleroyal/lobby')}
                  className="flex-1 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white"
                >
                  Return Lobby
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="pointer-events-auto">
        <GiftPopup
          open={showGift}
          onClose={() => setShowGift(false)}
          onGiftSent={({ gift }) => {
            const giftSound = giftSounds[gift.id];
            if (!giftSound) return;
            const audio = new Audio(giftSound);
            audio.volume = getGameVolume();
            audio.play().catch(() => {});
          }}
        />
      </div>
    </div>
  );
}
