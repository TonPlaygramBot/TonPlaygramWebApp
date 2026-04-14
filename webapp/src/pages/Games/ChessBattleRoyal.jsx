import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { GroundedSkybox } from 'three/examples/jsm/objects/GroundedSkybox.js';
import { applyRendererSRGB, applySRGBColorSpace } from '../../utils/colorSpace.js';
import {
  createMurlanStyleTable,
  applyTableMaterials,
  TABLE_SHAPE_OPTIONS
} from '../../utils/murlanTable.js';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import {
  ensureAccountId,
  getTelegramFirstName,
  getTelegramUsername,
  getTelegramPhotoUrl
} from '../../utils/telegram.js';
import { bombSound, chatBeep, timerBeep } from '../../assets/soundData.js';
import { getGameVolume, isGameMuted } from '../../utils/sound.js';
import {
  buildChessCommentaryLine,
  CHESS_BATTLE_SPEAKERS,
  createChessMatchCommentaryScript
} from '../../utils/chessBattleCommentary.js';
import {
  getSpeechSupport,
  getSpeechSynthesis,
  onSpeechSupportChange,
  primeSpeechSynthesis,
  speakCommentaryLines
} from '../../utils/textToSpeech.js';
import { ARENA_CAMERA_DEFAULTS } from '../../utils/arenaCameraConfig.js';
import { TABLE_WOOD_OPTIONS, TABLE_CLOTH_OPTIONS, TABLE_BASE_OPTIONS } from '../../utils/tableCustomizationOptions.js';
import {
  POOL_ROYALE_DEFAULT_HDRI_ID,
  POOL_ROYALE_HDRI_VARIANTS,
  POOL_ROYALE_HDRI_VARIANT_MAP
} from '../../config/poolRoyaleInventoryConfig.js';
import {
  CHESS_CHAIR_OPTIONS,
  CHESS_BATTLE_TABLE_OPTIONS,
  CHESS_BATTLE_OPTION_THUMBNAILS,
  CHESS_TABLE_FINISH_OPTIONS
} from '../../config/chessBattleInventoryConfig.js';
import {
  chessBattleAccountId,
  getChessBattleInventory,
  isChessOptionUnlocked
} from '../../utils/chessBattleInventory.js';
import { FLAG_EMOJIS } from '../../utils/flagEmojis.js';
import { avatarToName } from '../../utils/avatarUtils.js';
import { getAIOpponentFlag } from '../../utils/aiOpponentFlag.js';
import { ipToFlag } from '../../utils/conflictMatchmaking.js';
import AvatarTimer from '../../components/AvatarTimer.jsx';
import BottomLeftIcons from '../../components/BottomLeftIcons.jsx';
import GiftPopup from '../../components/GiftPopup.jsx';
import InfoPopup from '../../components/InfoPopup.jsx';
import QuickMessagePopup from '../../components/QuickMessagePopup.jsx';
import { socket } from '../../utils/socket.js';
import { giftSounds } from '../../utils/giftSounds.js';

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
 * Note: for simplicity, this version omits en passant. We can add it easily.
 */

// ========================= Config =========================
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clamp01 = (value, fallback = 0) => {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, value));
};
const smoothEase = (t) => t * t * (3 - 2 * t);
const FORWARD = new THREE.Vector3(1, 0, 0);
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const LUDO_CAPTURE_MISSILE_TRAVEL_TIME = 2.52;
const LUDO_CAPTURE_EXPLOSION_TIME = 2.6;
const LUDO_CAPTURE_TOTAL_TIME = LUDO_CAPTURE_MISSILE_TRAVEL_TIME + LUDO_CAPTURE_EXPLOSION_TIME;
const CAPTURE_DRONE_LIFT_TIME = 0.144;
const CAPTURE_DRONE_CRUISE_TIME = 2.24;
const CAPTURE_DRONE_DIVE_TIME = 0.94;
const CAPTURE_DRONE_TOTAL = CAPTURE_DRONE_LIFT_TIME + CAPTURE_DRONE_CRUISE_TIME + CAPTURE_DRONE_DIVE_TIME;
const CAPTURE_JET_SPEED_FACTOR = 4.9 / CAPTURE_DRONE_TOTAL; // slower than prior tuning for clearer portrait tracking
const PROFILE_VIEW_ROTATION_TYPES = new Set(['K', 'N']);
const PROFILE_VIEW_ROTATION_RADIANS = Math.PI / 2;
const CAPTURE_JET_TOTAL = 11.1; // slower cinematic pass so the full fly path is clearly visible on portrait screens
const CAPTURE_JET_MISSILE_TRAVEL = Math.max(0.28, CAPTURE_JET_TOTAL * (0.96 - 0.56) - 0.1);
const CAPTURE_HELICOPTER_TOTAL = CAPTURE_JET_TOTAL; // force helicopter to use the exact same timeline length as jet
const CAPTURE_HELICOPTER_SPEED_FACTOR = CAPTURE_HELICOPTER_TOTAL / CAPTURE_JET_TOTAL; // keep helicopter path pacing identical to jet
const CAPTURE_HELICOPTER_MISSILE_TRAVEL = Math.max(0.28, CAPTURE_HELICOPTER_TOTAL * (0.96 - 0.56) - 0.1);
const CAPTURE_JET_MISSILE_RELEASE_RATIO = 0.62;
const CAPTURE_JET_MISSILE_ENTRY_RELEASE_RATIO = 0.56; // release while entering the enemy-side U-turn
const CAPTURE_JET_TRIMMED_START_RATIO = 0; // keep takeoff visible from the live piece location
const CAPTURE_GROUND_FIRE_TIME = 0;
const CAPTURE_GROUND_TRAVEL_TIME = 2.8; // keep drone in the air a bit longer before strike
const CAPTURE_GROUND_TOTAL = CAPTURE_GROUND_FIRE_TIME + CAPTURE_GROUND_TRAVEL_TIME;
const CAPTURE_DRONE_SCALE = 0.0432; // 20% smaller baseline drone
const CAPTURE_JET_SCALE = CAPTURE_DRONE_SCALE * 1.12; // trim jet size slightly so it reads cleaner in portrait view
const CAPTURE_HELICOPTER_SCALE = CAPTURE_DRONE_SCALE * 1.2; // keep helicopter larger than drone while respecting 20% downsize
const CAPTURE_DRONE_ALTITUDE = 1.2; // lower flight profile so aircraft sit closer to the board in portrait view
const CAPTURE_FLIGHT_ALTITUDE = CAPTURE_DRONE_ALTITUDE;
const CAPTURE_DRONE_REFERENCE_BOARD_ALTITUDE = CAPTURE_FLIGHT_ALTITUDE * 0.56; // cruise height the drone visually keeps above board
const CAPTURE_AIR_STRIKE_BOARD_CLEARANCE = 0; // measure air-strike altitude strictly from board plane
const CAPTURE_AIR_STRIKE_ALTITUDE_MULTIPLIER = 1; // align jet/helicopter flight height with drone altitude
const CAPTURE_JET_ALTITUDE = CAPTURE_DRONE_REFERENCE_BOARD_ALTITUDE * CAPTURE_AIR_STRIKE_ALTITUDE_MULTIPLIER;
const CAPTURE_HELICOPTER_ALTITUDE_BOOST = 0; // keep helicopter and jet at the same flight altitude
const CAPTURE_AIR_STRIKE_PATH_RADIUS_FACTOR = 0.34; // trim loop width so flybys stay inside portrait framing
const CAPTURE_AIR_STRIKE_PATH_EDGE_MARGIN_TILES = 1.6; // pull entry/turn points farther in from board edges
const CAPTURE_AIR_STRIKE_BOTTOM_PLAYER_BIAS_TILES = 0.02; // reduce portrait bottom bias so aircraft stay nearer center
const CAPTURE_MISSILE_SCALE = 0.068;
const CAPTURE_JAVELIN_MISSILE_SCALE = CAPTURE_MISSILE_SCALE * 1.48; // make javelin missile bigger
const CAPTURE_PAWN_JAVELIN_SCALE = CAPTURE_JAVELIN_MISSILE_SCALE * 0.72;
const CAPTURE_ROOK_JAVELIN_SCALE = CAPTURE_JAVELIN_MISSILE_SCALE * 1.04; // make rook javelin read as a heavy drone-sized strike
const CAPTURE_EXPLOSION_SCALE = 0.132; // smaller capture explosion
const CAPTURE_EDGE_PATH_FACTOR = 0.52;
const DRACO_DECODER_PATH = 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/';
const BASIS_TRANSCODER_PATH = 'https://cdn.jsdelivr.net/npm/three@0.164.0/examples/jsm/libs/basis/';
const CAPTURE_MODEL_URLS = Object.freeze({
  drone: [
    'https://cdn.jsdelivr.net/gh/srcejon/sdrangel-3d-models@main/drone.glb',
    'https://raw.githubusercontent.com/srcejon/sdrangel-3d-models/main/drone.glb',
    'https://cdn.statically.io/gh/srcejon/sdrangel-3d-models/main/drone.glb'
  ],
  helicopter: [
    'https://cdn.jsdelivr.net/gh/srcejon/sdrangel-3d-models@main/helicopter.glb',
    'https://raw.githubusercontent.com/srcejon/sdrangel-3d-models/main/helicopter.glb',
    'https://cdn.statically.io/gh/srcejon/sdrangel-3d-models/main/helicopter.glb'
  ],
  fighter: [
    'https://cdn.jsdelivr.net/gh/srcejon/sdrangel-3d-models@main/f15.glb',
    'https://raw.githubusercontent.com/srcejon/sdrangel-3d-models/main/f15.glb',
    'https://cdn.statically.io/gh/srcejon/sdrangel-3d-models/main/f15.glb'
  ]
});
const CAPTURE_VEHICLE_TEXTURE_CACHE = new Map();
const CAPTURE_POLYHAVEN_TEXTURE_CACHE = new Map();
const CAPTURE_POLYHAVEN_TEXTURE_SETS = new Map();
const CAPTURE_POLYHAVEN_TEXTURE_ASSETS = Object.freeze({
  drone: 'rusty_metal_sheet',
  fighter: 'green_metal_rust',
  helicopter: 'green_metal_rust',
  missile: 'green_metal_rust'
});

const BASE_BOARD_THEME = Object.freeze({
  light: '#e7e2d3',
  dark: '#776a5a',
  frameLight: '#d2b48c',
  frameDark: '#3a2d23',
  accent: '#00e5ff',
  highlight: '#6ee7b7',
  capture: '#f87171',
  surfaceRoughness: 0.74,
  surfaceMetalness: 0.04,
  frameRoughness: 0.86,
  frameMetalness: 0.05
});

const BOARD_COLOR_BASE_OPTIONS = Object.freeze([
  {
    id: 'frostedSteel',
    label: 'Frosted Steel',
    light: '#e4f0ff',
    dark: '#1c2738',
    frameLight: '#c8d5e8',
    frameDark: '#101827',
    accent: '#7dd3fc',
    highlight: '#7cf4c4',
    capture: '#ff8ba7',
    surfaceRoughness: 0.44,
    surfaceMetalness: 0.28,
    frameRoughness: 0.6,
    frameMetalness: 0.32
  },
  {
    id: 'desertCopper',
    label: 'Desert Copper',
    light: '#f4e3c3',
    dark: '#4b2e1b',
    frameLight: '#d29d6a',
    frameDark: '#2a1b10',
    accent: '#e38b29',
    highlight: '#fcd34d',
    capture: '#f97316',
    surfaceRoughness: 0.62,
    surfaceMetalness: 0.22,
    frameRoughness: 0.78,
    frameMetalness: 0.18
  },
  {
    id: 'nebulaGlass',
    label: 'Nebula Glass',
    light: '#e0f2fe',
    dark: '#0b1024',
    frameLight: '#a5b4fc',
    frameDark: '#0a0d14',
    accent: '#8b5cf6',
    highlight: '#34d399',
    capture: '#fb7185',
    surfaceRoughness: 0.34,
    surfaceMetalness: 0.52,
    frameRoughness: 0.42,
    frameMetalness: 0.56
  },
  {
    id: 'harborMist',
    label: 'Harbor Mist',
    light: '#dbeafe',
    dark: '#1f2937',
    frameLight: '#94a3b8',
    frameDark: '#0f172a',
    accent: '#38bdf8',
    highlight: '#7ef9a1',
    capture: '#f43f5e',
    surfaceRoughness: 0.5,
    surfaceMetalness: 0.18,
    frameRoughness: 0.64,
    frameMetalness: 0.22
  },
  {
    id: 'emberRose',
    label: 'Ember Rose',
    light: '#ffe4e6',
    dark: '#311424',
    frameLight: '#f9c5d5',
    frameDark: '#1b0d17',
    accent: '#f43f5e',
    highlight: '#fda4af',
    capture: '#fb7185',
    surfaceRoughness: 0.56,
    surfaceMetalness: 0.26,
    frameRoughness: 0.7,
    frameMetalness: 0.24
  },
  {
    id: 'slateJade',
    label: 'Slate & Jade',
    light: '#e0f2f1',
    dark: '#1c2625',
    frameLight: '#9bc8b3',
    frameDark: '#15201e',
    accent: '#34d399',
    highlight: '#67e8f9',
    capture: '#dc5c5c',
    surfaceRoughness: 0.54,
    surfaceMetalness: 0.16,
    frameRoughness: 0.66,
    frameMetalness: 0.18
  }
]);

const DEFAULT_HDRI_RESOLUTIONS = Object.freeze(['4k']);
const CHESS_HDRI_OPTIONS = POOL_ROYALE_HDRI_VARIANTS.map((variant) => ({
  ...variant,
  label: `${variant.name} HDRI`
}));
const DEFAULT_HDRI_CAMERA_HEIGHT_M = 1.5;
const MIN_HDRI_CAMERA_HEIGHT_M = 0.9;
const DEFAULT_HDRI_RADIUS_MULTIPLIER = 6;
const MIN_HDRI_RADIUS = 24;
const HDRI_GROUNDED_RESOLUTION = 256;
const HDRI_UNITS_PER_METER = 1;
const DEFAULT_HDRI_INDEX = Math.max(
  0,
  CHESS_HDRI_OPTIONS.findIndex((variant) => variant.id === POOL_ROYALE_DEFAULT_HDRI_ID)
);
const DEFAULT_HDRI_VARIANT =
  CHESS_HDRI_OPTIONS[DEFAULT_HDRI_INDEX] ?? CHESS_HDRI_OPTIONS[0] ?? null;
const resolveHdriVariant = (value) => {
  if (typeof value === 'string') {
    return (
      POOL_ROYALE_HDRI_VARIANT_MAP[value] ??
      CHESS_HDRI_OPTIONS.find((variant) => variant.id === value) ??
      CHESS_HDRI_OPTIONS[DEFAULT_HDRI_INDEX] ??
      CHESS_HDRI_OPTIONS[0]
    );
  }
  const max = CHESS_HDRI_OPTIONS.length - 1;
  const idx = Number.isFinite(value) ? clamp(Math.round(value), 0, max) : DEFAULT_HDRI_INDEX;
  return CHESS_HDRI_OPTIONS[idx] ?? CHESS_HDRI_OPTIONS[DEFAULT_HDRI_INDEX] ?? CHESS_HDRI_OPTIONS[0];
};

const MODEL_SCALE = 0.55;
const STOOL_SCALE = 1.5 * 1.05;
const CARD_SCALE = 0.95;

const BOARD = { N: 8, tile: 4.2, rim: 3, baseH: 0.8 };
const PIECE_Y = 1.2; // baseline height for meshes
const PIECE_PLACEMENT_Y_OFFSET = 0.24; // Lower tokens slightly so they stay grounded on the board after shrinking.
const LAYOUT_SCALE_FACTOR = 0.7225;
const TABLE_LAYOUT_SCALE_FACTOR = 0.85; // Keep the same table/board/chair proportions, but 15% smaller than current.
const PIECE_SCALE_FACTOR = 0.79 * LAYOUT_SCALE_FACTOR * 1.5 * 0.85; // Shrink tokens by 15% while preserving the existing style proportions.
const PIECE_FOOTPRINT_RATIO = 0.86;
const BOARD_GROUP_Y_OFFSET = 0.035;
const BOARD_MODEL_Y_OFFSET = -0.12;
const BOARD_VISUAL_Y_OFFSET = -0.03;
const BOARD_SURFACE_DROP = 0.05;

const RAW_BOARD_SIZE = BOARD.N * BOARD.tile + BOARD.rim * 2;
const BOARD_SCALE = 0.0359 * LAYOUT_SCALE_FACTOR * TABLE_LAYOUT_SCALE_FACTOR;
const BOARD_DISPLAY_SIZE = RAW_BOARD_SIZE * BOARD_SCALE;
const BOARD_MODEL_SPAN_BIAS = 1.18;
const HIGHLIGHT_VERTICAL_OFFSET = 0.18;
const PIECE_SELECTION_LIFT = 0.18;

const TABLE_SIZE_FACTOR = 0.94 * LAYOUT_SCALE_FACTOR * TABLE_LAYOUT_SCALE_FACTOR;
const CHAIR_SIZE_FACTOR = 0.9 * LAYOUT_SCALE_FACTOR * TABLE_LAYOUT_SCALE_FACTOR;
const TABLE_RADIUS = 2.74 * MODEL_SCALE * TABLE_SIZE_FACTOR;
const SEAT_WIDTH = 0.9 * MODEL_SCALE * STOOL_SCALE * CHAIR_SIZE_FACTOR;
const SEAT_DEPTH = 0.95 * MODEL_SCALE * STOOL_SCALE * CHAIR_SIZE_FACTOR;
const SEAT_THICKNESS = 0.09 * MODEL_SCALE * STOOL_SCALE * CHAIR_SIZE_FACTOR;
const BACK_HEIGHT = 0.68 * MODEL_SCALE * STOOL_SCALE * CHAIR_SIZE_FACTOR;
const BACK_THICKNESS = 0.08 * MODEL_SCALE * STOOL_SCALE * CHAIR_SIZE_FACTOR;
const ARM_THICKNESS = 0.125 * MODEL_SCALE * STOOL_SCALE * CHAIR_SIZE_FACTOR;
const ARM_HEIGHT = 0.3 * MODEL_SCALE * STOOL_SCALE * CHAIR_SIZE_FACTOR;
const ARM_DEPTH = SEAT_DEPTH * 0.75;
const BASE_COLUMN_HEIGHT = 0.5 * MODEL_SCALE * STOOL_SCALE * CHAIR_SIZE_FACTOR;
const BASE_TABLE_HEIGHT = 1.08 * MODEL_SCALE;
const CHAIR_BASE_HEIGHT = BASE_TABLE_HEIGHT - SEAT_THICKNESS * 0.85;
const STOOL_HEIGHT = CHAIR_BASE_HEIGHT + SEAT_THICKNESS;
const TABLE_HEIGHT = STOOL_HEIGHT + 0.05 * MODEL_SCALE;
const TABLE_MODEL_TARGET_DIAMETER = TABLE_RADIUS * 2;
const TABLE_MODEL_TARGET_HEIGHT = TABLE_HEIGHT;
const AI_CHAIR_GAP = (0.4 * MODEL_SCALE * CARD_SCALE) * 0.4;
const CAMERA_TABLE_SPAN_FACTOR = 2.6;

const WALL_PROXIMITY_FACTOR = 0.5; // Bring arena walls 50% closer
const WALL_HEIGHT_MULTIPLIER = 2; // Double wall height
const CHAIR_SCALE = 0.88 * LAYOUT_SCALE_FACTOR * TABLE_LAYOUT_SCALE_FACTOR;
const CHAIR_VERTICAL_OFFSET = -0.065 * MODEL_SCALE;
const CHAIR_CLEARANCE = AI_CHAIR_GAP;
const PLAYER_CHAIR_EXTRA_CLEARANCE = -0.14 * MODEL_SCALE;
const CAMERA_PHI_OFFSET = 0;
const CAMERA_TOPDOWN_EXTRA = 0;
const CAMERA_INITIAL_PHI_EXTRA = 0;
const CAMERA_TOPDOWN_LOCK = THREE.MathUtils.degToRad(2.0);
const DEFAULT_TARGET_FPS = 120;
const MIN_TARGET_FPS = 50;
const MAX_TARGET_FPS = 144;
const DEFAULT_RENDER_PIXEL_RATIO_CAP = 1.25;
const RENDER_PIXEL_RATIO_SCALE = 1.0;
const MIN_RENDER_PIXEL_RATIO = 0.85;
const SEAT_LABEL_HEIGHT = 0.74;
const SEAT_LABEL_FORWARD_OFFSET = -0.32;
const AVATAR_ANCHOR_HEIGHT = SEAT_THICKNESS / 2 + BACK_HEIGHT * 0.85;
const FALLBACK_SEAT_POSITIONS = [
  { left: '50%', top: '85%' },
  { left: '50%', top: '12%' }
];
const CAMERA_WHEEL_FACTOR = ARENA_CAMERA_DEFAULTS.wheelDeltaFactor;
const CAMERA_PULL_FORWARD_MIN = THREE.MathUtils.degToRad(15);
const SAND_TIMER_RADIUS_FACTOR = 0.68;
const SAND_TIMER_SURFACE_OFFSET = 0.2;
const SAND_TIMER_SCALE = 0.36;

function detectCoarsePointer() {
  if (typeof window === 'undefined') {
    return false;
  }
  if (typeof window.matchMedia === 'function') {
    try {
      const coarseQuery = window.matchMedia('(pointer: coarse)');
      if (typeof coarseQuery?.matches === 'boolean') {
        return coarseQuery.matches;
      }
    } catch (err) {
      // ignore
    }
  }
  try {
    if ('ontouchstart' in window) {
      return true;
    }
    const nav = window.navigator;
    if (nav && typeof nav.maxTouchPoints === 'number') {
      return nav.maxTouchPoints > 0;
    }
  } catch (err) {
    // ignore
  }
  return false;
}

function getDisplayMetrics() {
  if (typeof window === 'undefined') {
    return { width: 1920, height: 1080, dpr: 1 };
  }
  const fallbackWidth = window.screen?.width || 1920;
  const fallbackHeight = window.screen?.height || 1080;
  const width = Math.max(window.innerWidth || 0, fallbackWidth);
  const height = Math.max(window.innerHeight || 0, fallbackHeight);
  const dpr = typeof window.devicePixelRatio === 'number' ? window.devicePixelRatio : 1;

  return {
    width: width || 1920,
    height: height || 1080,
    dpr: dpr || 1
  };
}

function detectRefreshRateHint() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null;
  }
  const queries = [
    { query: '(min-refresh-rate: 143hz)', fps: 144 },
    { query: '(min-refresh-rate: 119hz)', fps: 120 },
    { query: '(min-refresh-rate: 89hz)', fps: 90 },
    { query: '(max-refresh-rate: 59hz)', fps: 60 },
    { query: '(max-refresh-rate: 50hz)', fps: 50 },
    { query: '(prefers-reduced-motion: reduce)', fps: 50 }
  ];
  for (const { query, fps } of queries) {
    try {
      if (window.matchMedia(query).matches) {
        return fps;
      }
    } catch (err) {
      // ignore unsupported query
    }
  }
  return null;
}

const GRAPHICS_STORAGE_KEY = 'chessBattleRoyalGraphics';
const COMMENTARY_PRESET_STORAGE_KEY = 'chessBattleRoyalCommentaryPreset';
const COMMENTARY_MUTE_STORAGE_KEY = 'chessBattleRoyalCommentaryMute';
const COMMENTARY_QUEUE_LIMIT = 4;
const COMMENTARY_MIN_INTERVAL_MS = 1200;
const GRAPHICS_OPTIONS = Object.freeze([
  {
    id: 'hd50',
    label: 'HD Performance (50 Hz)',
    fps: 50,
    renderScale: 1,
    pixelRatioCap: 1.4,
    pixelRatioScale: 1,
    resolution: 'HD render • DPR 1.4 cap',
    description: 'Minimum HD output for battery saver and 50–60 Hz displays.'
  },
  {
    id: 'fhd60',
    label: 'Full HD (60 Hz)',
    fps: 60,
    renderScale: 1.1,
    pixelRatioCap: 1.5,
    pixelRatioScale: 1,
    resolution: 'Full HD render • DPR 1.5 cap',
    description: '1080p-focused profile that mirrors the Snooker frame pacing.'
  },
  {
    id: 'qhd90',
    label: 'Quad HD (90 Hz)',
    fps: 90,
    renderScale: 1.25,
    pixelRatioCap: 1.7,
    pixelRatioScale: 1,
    resolution: 'QHD render • DPR 1.7 cap',
    description: 'Sharper 1440p render for capable 90 Hz mobile and desktop GPUs.'
  },
  {
    id: 'uhd120',
    label: 'Ultra HD (120 Hz)',
    fps: 120,
    renderScale: 1.35,
    pixelRatioCap: 2,
    pixelRatioScale: 1,
    resolution: 'Ultra HD render • DPR 2.0 cap',
    description: '4K-oriented profile for 120 Hz flagships and desktops.'
  },
  {
    id: 'ultra144',
    label: 'Ultra HD+ (144 Hz)',
    fps: 144,
    renderScale: 1.5,
    pixelRatioCap: 2.2,
    pixelRatioScale: 1,
    resolution: 'Ultra HD+ render • DPR 2.2 cap',
    description: 'Maximum clarity preset that prioritizes UHD detail at 144 Hz.'
  }
]);
const DEFAULT_GRAPHICS_ID = 'uhd120';
const CHESS_BATTLE_COMMENTARY_PRESETS = Object.freeze([
  {
    id: 'english',
    label: 'English',
    description: 'Mixed voices, classic English',
    language: 'en',
    voiceHints: {
      [CHESS_BATTLE_SPEAKERS.lead]: ['en-US', 'English', 'male', 'David', 'Guy', 'Daniel', 'Alex'],
      [CHESS_BATTLE_SPEAKERS.analyst]: ['en-GB', 'English', 'female', 'Sonia', 'Hazel', 'Kate', 'Emma']
    },
    speakerSettings: {
      [CHESS_BATTLE_SPEAKERS.lead]: { rate: 1, pitch: 0.96, volume: 1 },
      [CHESS_BATTLE_SPEAKERS.analyst]: { rate: 1.04, pitch: 1.06, volume: 1 }
    }
  },
  {
    id: 'saffron-table',
    label: 'Indian Table',
    description: 'Hindi commentary with lively pacing',
    language: 'hi',
    voiceHints: {
      [CHESS_BATTLE_SPEAKERS.lead]: ['hi-IN', 'hi', 'Hindi', 'male', 'Raj', 'Amit', 'Arjun'],
      [CHESS_BATTLE_SPEAKERS.analyst]: ['hi-IN', 'hi', 'Hindi', 'female', 'Asha', 'Priya', 'Neha']
    },
    speakerSettings: {
      [CHESS_BATTLE_SPEAKERS.lead]: { rate: 1.06, pitch: 1.02, volume: 1 },
      [CHESS_BATTLE_SPEAKERS.analyst]: { rate: 1.08, pitch: 1.08, volume: 1 }
    }
  },
  {
    id: 'moscow-mics',
    label: 'Russian Booth',
    description: 'Russian commentary with steady cadence',
    language: 'ru',
    voiceHints: {
      [CHESS_BATTLE_SPEAKERS.lead]: ['ru-RU', 'ru', 'Russian', 'male', 'Dmitri', 'Ivan', 'Sergey', 'Alexey'],
      [CHESS_BATTLE_SPEAKERS.analyst]: ['ru-RU', 'ru', 'Russian', 'female', 'Anna', 'Svetlana', 'Irina', 'Olga']
    },
    speakerSettings: {
      [CHESS_BATTLE_SPEAKERS.lead]: { rate: 1, pitch: 0.95, volume: 1 },
      [CHESS_BATTLE_SPEAKERS.analyst]: { rate: 1.03, pitch: 1.02, volume: 1 }
    }
  },
  {
    id: 'latin-pulse',
    label: 'Latin Pulse',
    description: 'Spanish play-by-play with lively color',
    language: 'es',
    voiceHints: {
      [CHESS_BATTLE_SPEAKERS.lead]: ['es-ES', 'es-MX', 'Spanish', 'male', 'Jorge', 'Carlos', 'Miguel'],
      [CHESS_BATTLE_SPEAKERS.analyst]: ['es-ES', 'es-MX', 'Spanish', 'female', 'Isabella', 'Lucia', 'Camila']
    },
    speakerSettings: {
      [CHESS_BATTLE_SPEAKERS.lead]: { rate: 1.05, pitch: 1, volume: 1 },
      [CHESS_BATTLE_SPEAKERS.analyst]: { rate: 1.08, pitch: 1.1, volume: 1 }
    }
  },
  {
    id: 'francophone-booth',
    label: 'Francophone Booth',
    description: 'French broadcast pairing',
    language: 'fr',
    voiceHints: {
      [CHESS_BATTLE_SPEAKERS.lead]: ['fr-FR', 'French', 'male', 'Henri', 'Louis', 'Paul'],
      [CHESS_BATTLE_SPEAKERS.analyst]: ['fr-FR', 'French', 'female', 'Amelie', 'Marie', 'Charlotte']
    },
    speakerSettings: {
      [CHESS_BATTLE_SPEAKERS.lead]: { rate: 0.98, pitch: 0.96, volume: 1 },
      [CHESS_BATTLE_SPEAKERS.analyst]: { rate: 1.04, pitch: 1.06, volume: 1 }
    }
  }
]);
const DEFAULT_COMMENTARY_PRESET_ID = CHESS_BATTLE_COMMENTARY_PRESETS[0]?.id || 'english';
const PIECE_LABELS = Object.freeze({
  P: 'pawn',
  N: 'knight',
  B: 'bishop',
  R: 'rook',
  Q: 'queen',
  K: 'king'
});
const FILE_LABELS = 'abcdefgh';
const resolveChessSquare = (r, c) => `${FILE_LABELS[c] || '?'}${8 - r}`;

function resolveDefaultGraphicsId() {
  const hint = detectRefreshRateHint();
  if (hint >= 144) return 'ultra144';
  if (hint >= 120) return 'uhd120';
  if (hint >= 90) return 'qhd90';
  if (hint && hint <= 50) return 'hd50';
  return DEFAULT_GRAPHICS_ID;
}

function selectPerformanceProfile(overrideOption = null) {
  const refreshHint = detectRefreshRateHint();
  const deviceMemory = typeof navigator !== 'undefined' ? navigator.deviceMemory : null;
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : null;
  const coarsePointer = detectCoarsePointer();
  const connection =
    typeof navigator !== 'undefined'
      ? navigator.connection || navigator.mozConnection || navigator.webkitConnection
      : null;
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    (() => {
      try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      } catch (err) {
        return false;
      }
    })();
  const saveDataMode = Boolean(connection?.saveData);
  const { width, height, dpr } = getDisplayMetrics();
  const screenMegapixels = (Math.max(width, 1) * Math.max(height, 1) * Math.max(dpr, 1) ** 2) / 1_000_000;

  const lowEndMemory = typeof deviceMemory === 'number' && deviceMemory > 0 && deviceMemory < 4;
  const lowEndCores = typeof cores === 'number' && cores > 0 && cores <= 4;
  const highEndMemory = typeof deviceMemory === 'number' && deviceMemory >= 8;
  const highEndCores = typeof cores === 'number' && cores >= 8;

  const lowEndDevice = coarsePointer || lowEndMemory || lowEndCores;
  const highEndDevice = !coarsePointer && (highEndMemory || highEndCores);

  const renderBudgetMp = lowEndDevice || saveDataMode ? 2.8 : highEndDevice ? 6.0 : 4.2;

  let targetFps = clamp(refreshHint ?? DEFAULT_TARGET_FPS, MIN_TARGET_FPS, MAX_TARGET_FPS);
  let resolutionScale = clamp(Math.sqrt(renderBudgetMp / Math.max(screenMegapixels, 0.1)), 0.72, 1.05);
  resolutionScale = Math.min(resolutionScale, 1);
  let pixelRatioScale = RENDER_PIXEL_RATIO_SCALE;
  let pixelRatioCap = Math.min(
    DEFAULT_RENDER_PIXEL_RATIO_CAP,
    lowEndDevice || saveDataMode ? 1.08 : highEndDevice ? 1.35 : 1.2
  );

  if (screenMegapixels > renderBudgetMp * 1.1) {
    const downscale = clamp(Math.sqrt(renderBudgetMp / screenMegapixels), 0.7, 1);
    resolutionScale = Math.min(resolutionScale, downscale);
    pixelRatioScale = Math.min(pixelRatioScale, 0.95);
    pixelRatioCap = Math.min(pixelRatioCap, lowEndDevice || saveDataMode ? 1.02 : 1.15);
  } else if (highEndDevice && screenMegapixels < renderBudgetMp * 0.5) {
    resolutionScale = Math.min(1, Math.max(resolutionScale, 0.98));
  }

  if (prefersReducedMotion) {
    targetFps = Math.min(targetFps, 50);
    resolutionScale = Math.min(resolutionScale, 0.9);
    pixelRatioScale = Math.min(pixelRatioScale, 0.9);
    pixelRatioCap = Math.min(pixelRatioCap, 1.05);
  }

  if (lowEndDevice || saveDataMode) {
    targetFps = Math.min(targetFps, 60);
    resolutionScale = Math.min(resolutionScale, 0.9);
    pixelRatioScale = Math.min(pixelRatioScale, 0.92);
    pixelRatioCap = Math.min(pixelRatioCap, 1.1);
  } else if (highEndDevice) {
    targetFps = Math.max(targetFps, 120);
    pixelRatioScale = Math.max(pixelRatioScale, 1.05);
    pixelRatioCap = Math.max(pixelRatioCap, 1.3);
  }

  const profile = {
    targetFps: clamp(targetFps, MIN_TARGET_FPS, MAX_TARGET_FPS),
    resolutionScale,
    pixelRatioScale,
    pixelRatioCap
  };

  if (overrideOption) {
    profile.targetFps = clamp(overrideOption.fps ?? profile.targetFps, MIN_TARGET_FPS, MAX_TARGET_FPS);
    profile.resolutionScale = overrideOption.renderScale ?? profile.resolutionScale;
    profile.pixelRatioCap = overrideOption.pixelRatioCap ?? profile.pixelRatioCap;
    profile.pixelRatioScale = overrideOption.pixelRatioScale ?? profile.pixelRatioScale;
  }

  return profile;
}

const BEAUTIFUL_GAME_URLS = [
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/ABeautifulGame/glTF/ABeautifulGame.gltf',
  'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/ABeautifulGame/glTF/ABeautifulGame.gltf',
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/ABeautifulGame/glTF/ABeautifulGame.gltf',
  'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/ABeautifulGame/glTF/ABeautifulGame.gltf'
];

const BEAUTIFUL_GAME_TOUCH_URLS = [
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/ABeautifulGame/glTF/ABeautifulGame.gltf',
  'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/ABeautifulGame/glTF/ABeautifulGame.gltf'
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
const POLYHAVEN_MODEL_CACHE = new Map();

function extractAllHttpUrls(value) {
  const urls = [];
  const walk = (node) => {
    if (!node) return;
    if (typeof node === 'string') {
      if (/^https?:\/\//i.test(node)) urls.push(node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node === 'object') {
      Object.values(node).forEach(walk);
    }
  };
  walk(value);
  return urls;
}

function buildPolyhavenModelUrls(assetId) {
  if (!assetId) return [];
  return [
    `https://dl.polyhaven.org/file/ph-assets/Models/gltf/2k/${assetId}/${assetId}_2k.gltf`,
    `https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/${assetId}/${assetId}_1k.gltf`,
    `https://dl.polyhaven.org/file/ph-assets/Models/GLB/${assetId}/${assetId}.glb`,
    `https://dl.polyhaven.org/file/ph-assets/Models/GLB/${assetId}.glb`
  ];
}

function pickBestModelUrl(urls = []) {
  const preferred = urls.filter((u) => u.endsWith('.glb') || u.endsWith('.gltf'));
  return preferred[0] || urls[0] || null;
}

const PREFERRED_POLYHAVEN_TEXTURE_SIZES = Object.freeze(['4k', '2k', '1k']);

function pickBestTextureUrls(apiJson, preferredSizes = PREFERRED_POLYHAVEN_TEXTURE_SIZES) {
  if (!apiJson || typeof apiJson !== 'object') {
    return { diffuse: null, normal: null, roughness: null };
  }

  const urls = [];

  const walk = (value) => {
    if (!value) {
      return;
    }
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (value.startsWith('http') && (lower.includes('.jpg') || lower.includes('.png'))) {
        urls.push(value);
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (typeof value === 'object') {
      Object.values(value).forEach(walk);
    }
  };

  walk(apiJson);

  const pick = (keywords) => {
    const scored = urls
      .filter((url) => keywords.some((kw) => url.toLowerCase().includes(kw)))
      .map((url) => {
        const lower = url.toLowerCase();
        let score = 0;
        preferredSizes.forEach((size, index) => {
          if (lower.includes(size)) {
            score += (preferredSizes.length - index) * 10;
          }
        });
        if (lower.includes('jpg')) score += 6;
        if (lower.includes('png')) score += 3;
        if (lower.includes('preview') || lower.includes('thumb')) score -= 50;
        if (lower.includes('.exr')) score -= 100;
        return { url, score };
      })
      .sort((a, b) => b.score - a.score);
    return scored[0]?.url;
  };

  return {
    diffuse: pick(['diff', 'diffuse', 'albedo', 'basecolor']),
    normal: pick(['nor_gl', 'normal_gl', 'nor', 'normal']),
    roughness: pick(['rough', 'roughness'])
  };
}

function prepareLoadedModel(root) {
  if (!root) return;
  root.traverse((obj) => {
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
}

function disposeObjectResources(object) {
  if (!object) return;
  const materials = new Set();
  object.traverse((obj) => {
    if (!obj.isMesh) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach((mat) => mat && materials.add(mat));
    obj.geometry?.dispose?.();
  });
  materials.forEach((mat) => {
    if (mat?.map) mat.map.dispose?.();
    if (mat?.emissiveMap) mat.emissiveMap.dispose?.();
    mat?.dispose?.();
  });
}

function fitTableModelToArena(model) {
  if (!model) return { surfaceY: TABLE_MODEL_TARGET_HEIGHT, radius: TABLE_RADIUS };
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const maxXZ = Math.max(size.x, size.z);
  const targetHeight = TABLE_MODEL_TARGET_HEIGHT;
  const targetDiameter = TABLE_MODEL_TARGET_DIAMETER;
  const targetRadius = targetDiameter / 2;
  const scaleY = size.y > 0 ? targetHeight / size.y : 1;
  const scaleXZ = maxXZ > 0 ? targetDiameter / maxXZ : 1;
  if (scaleY !== 1 || scaleXZ !== 1) {
    model.scale.set(
      model.scale.x * scaleXZ,
      model.scale.y * scaleY,
      model.scale.z * scaleXZ
    );
  }
  const scaledBox = new THREE.Box3().setFromObject(model);
  const center = scaledBox.getCenter(new THREE.Vector3());
  model.position.add(new THREE.Vector3(-center.x, -scaledBox.min.y, -center.z));
  const recenteredBox = new THREE.Box3().setFromObject(model);
  const radius = Math.max(
    Math.abs(recenteredBox.max.x),
    Math.abs(recenteredBox.min.x),
    Math.abs(recenteredBox.max.z),
    Math.abs(recenteredBox.min.z),
    targetRadius
  );
  return {
    surfaceY: targetHeight,
    radius
  };
}

async function loadPolyhavenModel(assetId, renderer = null) {
  if (!assetId) throw new Error('Missing Poly Haven asset id');
  const normalizedId = assetId.toLowerCase();
  const cacheKey = normalizedId;
  if (POLYHAVEN_MODEL_CACHE.has(cacheKey)) {
    return POLYHAVEN_MODEL_CACHE.get(cacheKey);
  }

  const promise = (async () => {
    const modelCandidates = new Set(buildPolyhavenModelUrls(assetId));
    try {
      const filesJson = await fetch(`https://api.polyhaven.com/files/${encodeURIComponent(assetId)}`).then((r) => r.json());
      const allUrls = extractAllHttpUrls(filesJson);
      const apiModelUrl = pickBestModelUrl(allUrls);
      if (apiModelUrl) modelCandidates.add(apiModelUrl);
    } catch (error) {
      console.warn('Chess Battle Royal: Poly Haven file lookup failed, falling back to direct URLs', error);
    }

    const loader = createConfiguredGLTFLoader(renderer);
    let lastError = null;
    for (const modelUrl of modelCandidates) {
      try {
        const resolvedUrl = new URL(modelUrl, typeof window !== 'undefined' ? window.location?.href : modelUrl).href;
        const resourcePath = resolvedUrl.substring(0, resolvedUrl.lastIndexOf('/') + 1);
        loader.setResourcePath?.(resourcePath);
        loader.setPath?.('');
        // eslint-disable-next-line no-await-in-loop
        const gltf = await loader.loadAsync(resolvedUrl);
        const root = gltf.scene || gltf.scenes?.[0] || gltf;
        if (!root) continue;
        return root;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error(`Failed to load Poly Haven model for ${assetId}`);
  })();

  POLYHAVEN_MODEL_CACHE.set(cacheKey, promise);
  promise.catch(() => POLYHAVEN_MODEL_CACHE.delete(cacheKey));
  return promise;
}

function normalizePbrTexture(texture, maxAnisotropy = 1) {
  if (!texture) return;
  texture.flipY = false;
  texture.wrapS = texture.wrapS ?? THREE.RepeatWrapping;
  texture.wrapT = texture.wrapT ?? THREE.RepeatWrapping;
  texture.anisotropy = Math.max(texture.anisotropy ?? 1, maxAnisotropy);
  texture.needsUpdate = true;
}

async function loadPolyhavenTextureSet(assetId, textureLoader, maxAnisotropy = 1, cache = null) {
  if (!assetId || !textureLoader) return null;
  const key = `${assetId.toLowerCase()}|${maxAnisotropy}`;
  if (cache?.has(key)) {
    return cache.get(key);
  }

  const promise = (async () => {
    try {
      const response = await fetch(`https://api.polyhaven.com/files/${encodeURIComponent(assetId)}`);
      if (!response.ok) {
        return null;
      }
      const json = await response.json();
      const urls = pickBestTextureUrls(json, PREFERRED_POLYHAVEN_TEXTURE_SIZES);
      if (!urls.diffuse) {
        return null;
      }

      const loadTextureFromLoader = (url, isColor = false) =>
        new Promise((resolve, reject) => {
          textureLoader.load(
            url,
            (texture) => {
              if (isColor) applySRGBColorSpace(texture);
              normalizePbrTexture(texture, maxAnisotropy);
              resolve(texture);
            },
            undefined,
            () => reject(new Error('texture load failed'))
          );
        });

      const [diffuse, normal, roughness] = await Promise.all([
        loadTextureFromLoader(urls.diffuse, true),
        urls.normal ? loadTextureFromLoader(urls.normal, false) : null,
        urls.roughness ? loadTextureFromLoader(urls.roughness, false) : null
      ]);

      [diffuse, normal, roughness].filter(Boolean).forEach((tex) => normalizePbrTexture(tex, maxAnisotropy));

      return { diffuse, normal, roughness };
    } catch (error) {
      return null;
    }
  })();

  if (cache) {
    cache.set(key, promise);
    promise.catch(() => cache.delete(key));
  }
  return promise;
}

function applyTextureSetToModel(model, textureSet, fallbackTexture, maxAnisotropy = 1) {
  const normalizeTexture = (texture, isColor = false) => {
    if (!texture) return null;
    if (isColor) applySRGBColorSpace(texture);
    normalizePbrTexture(texture, maxAnisotropy);
    return texture;
  };

  const applyToMaterial = (material) => {
    if (!material) return;
    material.roughness = Math.max(material.roughness ?? 0.4, 0.4);
    material.metalness = Math.min(material.metalness ?? 0.4, 0.4);

    if (material.map) {
      normalizeTexture(material.map, true);
    } else if (textureSet?.diffuse) {
      material.map = normalizeTexture(textureSet.diffuse, true);
      material.needsUpdate = true;
    } else if (fallbackTexture) {
      material.map = normalizeTexture(fallbackTexture, true);
      material.needsUpdate = true;
    }

    if (material.emissiveMap) {
      normalizeTexture(material.emissiveMap, true);
    }

    if (!material.normalMap && textureSet?.normal) {
      material.normalMap = textureSet.normal;
      material.needsUpdate = true;
    }

    if (!material.roughnessMap && textureSet?.roughness) {
      material.roughnessMap = textureSet.roughness;
      material.needsUpdate = true;
    }
  };

  model?.traverse((obj) => {
    if (!obj.isMesh) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach(applyToMaterial);
  });
}

async function createPolyhavenInstance(assetId, rotationY = 0, renderer = null, textureOptions = {}) {
  const root = await loadPolyhavenModel(assetId, renderer);
  const model = root.clone ? root.clone(true) : root;
  prepareLoadedModel(model);
  const {
    textureLoader = null,
    maxAnisotropy = 1,
    fallbackTexture = null,
    textureCache = null,
    textureSet = null
  } = textureOptions || {};
  if (textureLoader) {
    try {
      const textures =
        textureSet ?? (await loadPolyhavenTextureSet(assetId, textureLoader, maxAnisotropy, textureCache));
      if (textures || fallbackTexture) {
        applyTextureSetToModel(model, textures, fallbackTexture, maxAnisotropy);
      }
    } catch (error) {
      if (fallbackTexture) {
        applyTextureSetToModel(model, null, fallbackTexture, maxAnisotropy);
      }
    }
  }
  if (rotationY) model.rotation.y += rotationY;
  return model;
}
const TARGET_CHAIR_SIZE = new THREE.Vector3(1.3162499970197679, 1.9173749900311232, 1.7001562547683715);
const TARGET_CHAIR_MIN_Y = -0.8570624993294478;
const TARGET_CHAIR_CENTER_Z = -0.1553906416893005;

const MOVE_SOUND_URL =
  'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard/Move.mp3';
const CHECK_SOUND_URL =
  'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard/Check.mp3';
const CHECKMATE_SOUND_URL =
  'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard/End.mp3';
const LAUGH_SOUND_URL = '/assets/sounds/Haha.mp3';
const DRONE_FLY_SOUND_URL = '/assets/sounds/kimsa-kimsa-big-motorcycle-sound-394700.mp3';
const HELICOPTER_FLY_SOUND_URL = '/assets/sounds/dragon-studio-helicopter-sound-8d-372463.mp3';
const JET_FLY_SOUND_URL = '/assets/sounds/race-care-151963.mp3';
const BAZOOKA_FIRE_SOUND_URL = '/assets/sounds/launch-85216.mp3';
const MISSILE_IMPACT_SOUND_URL = '/assets/sounds/080998_bullet-hit-39870.mp3';

const BEAUTIFUL_GAME_THEME_CONFIGS = Object.freeze([
  {
    id: 'beautifulGameAuroraMetal',
    name: 'Classic',
    piece: { white: '#ffffff', black: '#ffffff', accent: '#ffffff' },
    board: { light: '#EEE8D5', dark: '#2B2F36', accent: '#ffffff' }
  },
  {
    id: 'beautifulGameMono',
    name: 'Mono',
    piece: { white: '#111827', black: '#111827', accent: '#111827' },
    board: { light: '#E5E7EB', dark: '#111827', accent: '#111827' }
  },
  {
    id: 'beautifulGameBlue',
    name: 'Blue',
    piece: { white: '#3b82f6', black: '#3b82f6', accent: '#3b82f6' },
    board: { light: '#93C5FD', dark: '#1E293B', accent: '#3b82f6' }
  },
  {
    id: 'beautifulGameAmber',
    name: 'Amber',
    piece: { white: '#f59e0b', black: '#f59e0b', accent: '#f59e0b' },
    board: { light: '#FDE68A', dark: '#1F2937', accent: '#f59e0b' }
  },
  {
    id: 'beautifulGameMint',
    name: 'Mint',
    piece: { white: '#10b981', black: '#10b981', accent: '#10b981' },
    board: { light: '#A7F3D0', dark: '#065F46', accent: '#10b981' }
  },
  {
    id: 'beautifulGamePink',
    name: 'Pink',
    piece: { white: '#ef4444', black: '#ef4444', accent: '#ef4444' },
    board: { light: '#FBCFE8', dark: '#312E81', accent: '#ef4444' }
  },
  {
    id: 'beautifulGameTeal',
    name: 'Teal',
    piece: { white: '#8b5cf6', black: '#8b5cf6', accent: '#8b5cf6' },
    board: { light: '#99F6E4', dark: '#0F172A', accent: '#8b5cf6' }
  }
]);

const BEAUTIFUL_GAME_THEME_NAMES = BEAUTIFUL_GAME_THEME_CONFIGS.map((config) => config.name);

const BEAUTIFUL_GAME_THEME = Object.freeze(
  buildBoardTheme({
    ...(BOARD_COLOR_BASE_OPTIONS.find((option) => option.id === 'slateJade') ?? {}),
    id: 'beautifulGameAuthenticBoard',
    label: 'Aurora Metal',
    light: BEAUTIFUL_GAME_THEME_CONFIGS[0].board.light,
    dark: BEAUTIFUL_GAME_THEME_CONFIGS[0].board.dark,
    frameLight: '#c5d8ff',
    frameDark: '#141b2f',
    accent: BEAUTIFUL_GAME_THEME_CONFIGS[0].board.accent ?? '#7dd3fc',
    highlight: '#7ef9a1',
    capture: '#ff8e6e',
    surfaceRoughness: 0.62,
    surfaceMetalness: 0.12,
    frameRoughness: 0.74,
    frameMetalness: 0.14,
    preserveOriginalMaterials: true
  })
);

const BEAUTIFUL_GAME_BOARD_OPTIONS = Object.freeze(
  BEAUTIFUL_GAME_THEME_CONFIGS.map((config) =>
    buildBoardTheme({
      // Board palettes lifted directly from the ABeautifulGame presets (no extra colors)
      id: `${config.id}Board`,
      label: config.name,
      light: config.board?.light ?? BEAUTIFUL_GAME_THEME.light,
      dark: config.board?.dark ?? BEAUTIFUL_GAME_THEME.dark,
      frameLight: BEAUTIFUL_GAME_THEME.frameLight,
      frameDark: BEAUTIFUL_GAME_THEME.frameDark,
      surfaceRoughness: BEAUTIFUL_GAME_THEME.surfaceRoughness,
      surfaceMetalness: BEAUTIFUL_GAME_THEME.surfaceMetalness,
      frameRoughness: BEAUTIFUL_GAME_THEME.frameRoughness,
      frameMetalness: BEAUTIFUL_GAME_THEME.frameMetalness,
      accent: BEAUTIFUL_GAME_THEME.accent,
      highlight: BEAUTIFUL_GAME_THEME.highlight,
      capture: BEAUTIFUL_GAME_THEME.capture,
      preserveOriginalMaterials: Boolean(config.board?.preserveOriginal)
    })
  )
);

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

const BEAUTIFUL_GAME_PIECE_STYLE = Object.freeze({
  id: 'beautifulGameAuroraMetal',
  label: 'Classic',
  keepTextures: true,
  white: {
    color: '#ffffff',
    roughness: 0.22,
    metalness: 0.42,
    sheen: 0.32,
    sheenColor: '#f7fbff',
    clearcoat: 0.4,
    clearcoatRoughness: 0.18,
    specularIntensity: 0.78
  },
  black: {
    color: '#111827',
    roughness: 0.24,
    metalness: 0.44,
    sheen: 0.28,
    sheenColor: '#b8c6ff',
    clearcoat: 0.42,
    clearcoatRoughness: 0.2,
    specularIntensity: 0.78,
    emissive: '#0a1020',
    emissiveIntensity: 0.18
  },
  accent: '#ffffff',
  goldAccent: '#d4af37',
  whiteAccent: { color: '#ffffff' },
  blackAccent: '#ffffff'
});

const BEAUTIFUL_GAME_AUTHENTIC_ID = 'beautifulGameAuroraMetal';
const BEAUTIFUL_GAME_SET_ID = 'beautifulGameAuroraMetalSet';

const BASE_PIECE_STYLE = BEAUTIFUL_GAME_PIECE_STYLE;

const BEAUTIFUL_GAME_COLOR_VARIANTS = Object.freeze(
  BEAUTIFUL_GAME_THEME_CONFIGS.map((config) => {
    const preserveOriginal = Boolean(config.piece?.preserveOriginal);
    const pieceStyle = preserveOriginal
      ? { ...BASE_PIECE_STYLE, preserveOriginalMaterials: true, keepTextures: true }
      : {
          ...BASE_PIECE_STYLE,
          preserveOriginalMaterials: false,
          keepTextures: true,
          white: { ...BASE_PIECE_STYLE.white, color: config.piece?.white ?? BASE_PIECE_STYLE.white.color },
          black: { ...BASE_PIECE_STYLE.black, color: config.piece?.black ?? BASE_PIECE_STYLE.black.color },
          accent: config.piece?.accent ?? BASE_PIECE_STYLE.accent,
          goldAccent: config.piece?.goldAccent ?? BASE_PIECE_STYLE.goldAccent,
          whiteAccent: config.piece?.whiteAccent ?? BASE_PIECE_STYLE.whiteAccent,
          blackAccent: config.piece?.blackAccent ?? BASE_PIECE_STYLE.blackAccent
        };
    return {
      id: config.id,
      label: `ABeautifulGame (${config.name})`,
      style: pieceStyle
    };
  })
);

const pieceStyleSignature = (style) => `${style?.white?.color ?? ''}|${style?.black?.color ?? ''}`;

const DEFAULT_PIECE_STYLE = { ...BASE_PIECE_STYLE };
const BEAUTIFUL_GAME_SWAP_SET_ID = 'beautifulGameSwapRanks';
const DEFAULT_PIECE_SET_ID = BEAUTIFUL_GAME_SWAP_SET_ID;

// Sized to the physical ABeautifulGame set while fitting the playable footprint
const BEAUTIFUL_GAME_ASSET_SCALE = 1.08;
const BEAUTIFUL_GAME_BOARD_SCALE_BIAS = 1.2;
const BEAUTIFUL_GAME_FOOTPRINT_RATIO = 0.7;

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

function createFallbackTexture(color = '#888888') {
  const size = 2;
  const data = new Uint8Array(size * size * 3);
  const col = new THREE.Color(color);
  for (let i = 0; i < size * size; i += 1) {
    const idx = i * 3;
    data[idx] = Math.round(col.r * 255);
    data[idx + 1] = Math.round(col.g * 255);
    data[idx + 2] = Math.round(col.b * 255);
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  applySRGBColorSpace(texture);
  return texture;
}

function colorSeed(hex = '#ffffff') {
  const normalized = hex.toString().toLowerCase();
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash % 97) + 1;
}

function buildVeinedMaterial(colorHex, { roughness, metalness, repeat = 2.5, normalScale = 0.34 } = {}) {
  const texture = createGraniteTexture(colorHex, colorSeed(colorHex), repeat);
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(colorHex),
    roughness: clamp01(roughness ?? 0.4),
    metalness: clamp01(metalness ?? 0.22),
    clearcoat: 0.32,
    clearcoatRoughness: 0.2,
    reflectivity: 0.42
  });
  if (texture) {
    material.map = texture;
    material.normalMap = texture;
    material.normalScale = new THREE.Vector2(normalScale, normalScale);
  }
  return material;
}

function loadTexture(url, fallbackColor = '#888888') {
  const cached = TEXTURE_CACHE.get(url);
  if (cached) return cached;
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');
  const promise = new Promise((resolve) => {
    loader.load(url, (texture) => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      resolve(texture);
    }, undefined, (error) => {
      console.warn(`Chess Battle Royal: failed to load texture ${url}, using fallback`, error);
      resolve(createFallbackTexture(fallbackColor));
    });
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

const BEAUTIFUL_GAME_PIECE_PRESETS = [
  { id: 'beautifulGameClassic', label: 'Classic (Ivory)', color: '#ffffff' },
  { id: 'beautifulGameMono', label: 'Mono (Onyx)', color: '#111827' },
  { id: 'beautifulGameAmber', label: 'Amber', color: '#f59e0b' },
  { id: 'beautifulGameMint', label: 'Mint', color: '#10b981' },
  { id: 'beautifulGameBlue', label: 'Blue', color: '#3b82f6' },
  { id: 'beautifulGamePink', label: 'Pink', color: '#ef4444' },
  { id: 'beautifulGameTeal', label: 'Teal', color: '#8b5cf6' }
];

const PIECE_STYLE_OPTIONS = Object.freeze([
  ...BEAUTIFUL_GAME_PIECE_PRESETS.map((preset) => ({
    ...preset,
    style: {
      ...BASE_PIECE_STYLE,
      preserveOriginalMaterials: false,
      keepTextures: true,
      white: { ...BASE_PIECE_STYLE.white, color: preset.color },
      black: { ...BASE_PIECE_STYLE.black, color: preset.color },
      accent: BASE_PIECE_STYLE.accent,
      goldAccent: BASE_PIECE_STYLE.goldAccent,
      whiteAccent: BASE_PIECE_STYLE.whiteAccent,
      blackAccent: BASE_PIECE_STYLE.blackAccent
    },
    loader: (targetBoardSize) => resolveBeautifulGameAssets(targetBoardSize)
  })),
  {
    id: STAUNTON_CLASSIC_STYLE.id,
    label: STAUNTON_CLASSIC_STYLE.label,
    style: STAUNTON_CLASSIC_STYLE,
    loader: (targetBoardSize) => loadPieceSetFromUrls(STAUNTON_SET_URLS, {
      targetBoardSize,
      styleId: STAUNTON_CLASSIC_STYLE.id,
      pieceStyle: STAUNTON_CLASSIC_STYLE,
      assetScale: STAUNTON_ASSET_SCALE,
      fallbackBuilder: buildStauntonFallbackAssets
    })
  },
  {
    id: HERITAGE_WALNUT_STYLE.id,
    label: HERITAGE_WALNUT_STYLE.label,
    style: HERITAGE_WALNUT_STYLE,
    loader: (targetBoardSize) => loadWalnutStauntonAssets(targetBoardSize)
  },
  {
    id: MARBLE_ONYX_STYLE.id,
    label: MARBLE_ONYX_STYLE.label,
    style: MARBLE_ONYX_STYLE,
    loader: (targetBoardSize) => loadMarbleOnyxStauntonAssets(targetBoardSize)
  },
  {
    id: KENNEY_WOOD_STYLE.id,
    label: KENNEY_WOOD_STYLE.label,
    style: KENNEY_WOOD_STYLE,
    loader: (targetBoardSize) => loadKenneyAssets(targetBoardSize)
  },
  {
    id: POLYGONAL_GRAPHITE_STYLE.id,
    label: POLYGONAL_GRAPHITE_STYLE.label,
    style: POLYGONAL_GRAPHITE_STYLE,
    loader: (targetBoardSize) => loadPolygonalAssets(targetBoardSize)
  }
]);

const BEAUTIFUL_GAME_PIECE_INDEX = Math.max(
  0,
  PIECE_STYLE_OPTIONS.findIndex((option) => option.id === DEFAULT_PIECE_SET_ID)
);

const HEAD_PRESET_OPTIONS = Object.freeze([
  {
    id: 'headGlass',
    label: 'Glass',
    preset: {
      color: '#ffffff',
      metalness: 0,
      roughness: 0.05,
      transmission: 0.95,
      ior: 1.5,
      thickness: 0.5
    }
  },
  {
    id: 'headRuby',
    label: 'Ruby',
    preset: {
      color: '#9b111e',
      metalness: 0.05,
      roughness: 0.08,
      transmission: 0.92,
      ior: 2.4,
      thickness: 0.6
    }
  },
  {
    id: 'headPearl',
    label: 'Pearl',
    preset: {
      color: '#f5f5f5',
      metalness: 0.05,
      roughness: 0.25,
      transmission: 0,
      ior: 1.3,
      thickness: 0.2
    }
  },
  {
    id: 'headSapphire',
    label: 'Sapphire',
    preset: {
      color: '#0f52ba',
      metalness: 0.05,
      roughness: 0.08,
      transmission: 0.9,
      ior: 1.8,
      thickness: 0.7
    }
  },
  {
    id: 'headEmerald',
    label: 'Emerald',
    preset: {
      color: '#046a38',
      metalness: 0.05,
      roughness: 0.08,
      transmission: 0.9,
      ior: 1.8,
      thickness: 0.7
    }
  },
  {
    id: 'headDiamond',
    label: 'Diamond',
    preset: {
      color: '#ffffff',
      metalness: 0,
      roughness: 0.03,
      transmission: 0.98,
      ior: 2.4,
      thickness: 0.8
    }
  },
  {
    id: 'headChrome',
    label: 'Chrome',
    preset: {
      color: '#d6d8dc',
      metalness: 0.95,
      roughness: 0.12,
      transmission: 0.1,
      ior: 2.1,
      thickness: 0.22
    }
  },
  {
    id: 'headGold',
    label: 'Gold',
    preset: {
      color: '#d4af37',
      metalness: 0.92,
      roughness: 0.16,
      transmission: 0.06,
      ior: 1.85,
      thickness: 0.28
    }
  }
]);

const QUICK_SIDE_COLORS = [
  { id: 'marble', hex: 0xffffff, label: 'Marble', thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.sideColor.marble },
  {
    id: 'darkForest',
    hex: 0xffffff,
    label: 'Dark Forest',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.sideColor.darkForest
  },
  {
    id: 'amberGlow',
    hex: 0xf59e0b,
    label: 'Amber Glow',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.sideColor.amberGlow
  },
  {
    id: 'mintVale',
    hex: 0x10b981,
    label: 'Mint Vale',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.sideColor.mintVale
  },
  {
    id: 'royalWave',
    hex: 0x3b82f6,
    label: 'Royal Wave',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.sideColor.royalWave
  },
  {
    id: 'roseMist',
    hex: 0xef4444,
    label: 'Rose Mist',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.sideColor.roseMist
  },
  {
    id: 'amethyst',
    hex: 0x8b5cf6,
    label: 'Amethyst',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.sideColor.amethyst
  },
  {
    id: 'cinderBlaze',
    hex: 0xff6b35,
    label: 'Cinder Blaze',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.sideColor.cinderBlaze
  },
  {
    id: 'arcticDrift',
    hex: 0xbcd7ff,
    label: 'Arctic Drift',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.sideColor.arcticDrift
  }
];

const QUICK_HEAD_PRESETS = [
  { id: 'current', label: 'Current', thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.headStyle.current },
  { id: 'headRuby', label: 'Ruby', thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.headStyle.headRuby },
  {
    id: 'headSapphire',
    label: 'Sapphire',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.headStyle.headSapphire
  },
  { id: 'headChrome', label: 'Chrome', thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.headStyle.headChrome },
  { id: 'headGold', label: 'Gold', thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.headStyle.headGold }
];

const QUICK_BOARD_THEMES = [
  {
    id: 'classic',
    name: 'Classic',
    light: 0xeee8d5,
    dark: 0x2b2f36,
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.boardTheme.classic
  },
  {
    id: 'ivorySlate',
    name: 'Ivory/Slate',
    light: 0xe5e7eb,
    dark: 0x111827,
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.boardTheme.ivorySlate
  },
  {
    id: 'forest',
    name: 'Forest',
    light: 0xa7f3d0,
    dark: 0x065f46,
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.boardTheme.forest
  },
  {
    id: 'sand',
    name: 'Sand/Brown',
    light: 0xddd0b8,
    dark: 0x6b4f3a,
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.boardTheme.sand
  },
  {
    id: 'ocean',
    name: 'Ocean',
    light: 0xa4c8e1,
    dark: 0x1e3a5f,
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.boardTheme.ocean
  },
  {
    id: 'violet',
    name: 'Violet',
    light: 0xddd6fe,
    dark: 0x3b2a6e,
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.boardTheme.violet
  },
  {
    id: 'chrome',
    name: 'Chrome',
    light: 0xb0b0b0,
    dark: 0x6e6e6e,
    special: 'chrome',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.boardTheme.chrome
  },
  {
    id: 'nebulaGlass',
    name: 'Nebula Glass',
    light: 0xe0f2fe,
    dark: 0x0b1024,
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.boardTheme.nebulaGlass
  }
];

const CHESS_ROOM_HALF_SPAN = TABLE_RADIUS + CHAIR_CLEARANCE + SEAT_DEPTH;

const pickPolyHavenHdriUrl = (json, preferred = DEFAULT_HDRI_RESOLUTIONS) => {
  if (!json || typeof json !== 'object') return null;
  const resolutions = Array.isArray(preferred) && preferred.length ? preferred : DEFAULT_HDRI_RESOLUTIONS;
  for (const res of resolutions) {
    const entry = json[res];
    if (entry?.hdr) return entry.hdr;
    if (entry?.exr) return entry.exr;
  }
  const fallback = Object.values(json).find((value) => value?.hdr || value?.exr);
  if (!fallback) return null;
  return fallback.hdr || fallback.exr || null;
};

async function resolvePolyHavenHdriUrl(config = {}) {
  const preferred = Array.isArray(config?.preferredResolutions) && config.preferredResolutions.length
    ? config.preferredResolutions
    : DEFAULT_HDRI_RESOLUTIONS;
  const fallbackRes = config?.fallbackResolution || preferred[0] || '8k';
  const fallbackUrl =
    config?.fallbackUrl ||
    `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/${fallbackRes}/${config?.assetId ?? 'neon_photostudio'}_${fallbackRes}.hdr`;
  if (config?.assetUrls && typeof config.assetUrls === 'object') {
    for (const res of preferred) {
      if (config.assetUrls[res]) return config.assetUrls[res];
    }
    const manual = Object.values(config.assetUrls).find((value) => typeof value === 'string' && value.length);
    if (manual) return manual;
  }
  if (typeof config?.assetUrl === 'string' && config.assetUrl.length) return config.assetUrl;
  if (!config?.assetId || typeof fetch !== 'function') return fallbackUrl;
  try {
    const response = await fetch(`https://api.polyhaven.com/files/${encodeURIComponent(config.assetId)}`);
    if (!response?.ok) return fallbackUrl;
    const json = await response.json();
    const picked = pickPolyHavenHdriUrl(json, preferred);
    return picked || fallbackUrl;
  } catch (error) {
    console.warn('Failed to resolve Poly Haven HDRI url', error);
    return fallbackUrl;
  }
}

async function loadPolyHavenHdriEnvironment(renderer, config = {}) {
  if (!renderer) return null;
  const url = await resolvePolyHavenHdriUrl(config);
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
        envMap.name = `${config?.assetId ?? 'polyhaven'}-env`;
        const skyboxMap = texture;
        skyboxMap.name = `${config?.assetId ?? 'polyhaven'}-skybox`;
        skyboxMap.mapping = THREE.EquirectangularReflectionMapping;
        skyboxMap.needsUpdate = true;
        pmrem.dispose();
        resolve({ envMap, skyboxMap, url });
      },
      undefined,
      (error) => {
        console.warn('Failed to load Poly Haven HDRI', error);
        resolve(null);
      }
    );
  });
}

function computeGroupFloorY(objects = []) {
  const box = new THREE.Box3();
  let hasObject = false;
  objects.forEach((obj) => {
    if (!obj) return;
    box.expandByObject(obj);
    hasObject = true;
  });
  if (!hasObject) return 0;
  return box.min.y;
}

function alignGroupToFloorY(group, floorY = 0) {
  if (!group) return 0;
  const box = new THREE.Box3().setFromObject(group);
  if (!Number.isFinite(box.min.y)) return 0;
  const offset = floorY - box.min.y;
  if (Math.abs(offset) > 1e-4) {
    group.position.y += offset;
  }
  return offset;
}

function alignBoardGroupToTableSurface(boardGroup, tableInfo) {
  if (!boardGroup) return 0;
  const surfaceY = Number.isFinite(tableInfo?.surfaceY)
    ? tableInfo.surfaceY
    : TABLE_HEIGHT;
  const surfaceOffset =
    BOARD_SURFACE_OFFSETS_BY_SHAPE[tableInfo?.shapeId] ??
    BOARD_SURFACE_OFFSETS_BY_SHAPE[tableInfo?.themeId] ??
    0;
  return alignGroupToFloorY(boardGroup, surfaceY + BOARD_GROUP_Y_OFFSET + surfaceOffset);
}

function alignArenaContentsToRoom(groups = [], roomHalfWidth, roomHalfDepth) {
  const box = new THREE.Box3();
  let hasObject = false;
  groups.forEach((obj) => {
    if (!obj) return;
    box.expandByObject(obj);
    hasObject = true;
  });
  if (!hasObject) return new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getCenter(center);
  const minShiftX = -roomHalfWidth - box.min.x;
  const maxShiftX = roomHalfWidth - box.max.x;
  const minShiftZ = -roomHalfDepth - box.min.z;
  const maxShiftZ = roomHalfDepth - box.max.z;
  const shiftX = clamp(-center.x, minShiftX, maxShiftX);
  const shiftZ = clamp(-center.z, minShiftZ, maxShiftZ);
  if (Math.abs(shiftX) > 1e-4 || Math.abs(shiftZ) > 1e-4) {
    groups.forEach((obj) => {
      if (!obj) return;
      obj.position.x += shiftX;
      obj.position.z += shiftZ;
    });
  }
  return new THREE.Vector3(shiftX, 0, shiftZ);
}

function groundArenaGroups(groups = [], floorY = 0) {
  const currentFloor = computeGroupFloorY(groups);
  const offset = floorY - currentFloor;
  if (!Number.isFinite(offset) || Math.abs(offset) <= 1e-4) return offset;
  groups.forEach((group) => {
    if (!group) return;
    group.position.y += offset;
  });
  return offset;
}

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
const CAMERA_TOPDOWN_MAX_RADIUS = CAMERA_BASE_RADIUS * 1.9;
const CAMERA_3D_MIN_RADIUS = CAMERA_SAFE_MAX_RADIUS * 0.65;
const CAMERA_3D_MAX_RADIUS = CAMERA_SAFE_MAX_RADIUS * 1.35;
const CAMERA_2D_RADIUS = CAMERA_TOPDOWN_MAX_RADIUS * 1.14;
const CAMERA_2D_MIN_RADIUS = CAMERA_2D_RADIUS * 0.8;
const CAMERA_2D_MAX_RADIUS = CAMERA_2D_RADIUS * 1.4;
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
  chairColor: 0,
  tables: 0,
  tableFinish: 0,
  tableCloth: 0,
  boardColor: 0,
  whitePieceStyle: 0,
  blackPieceStyle: 1,
  headStyle: 0,
  environmentHdri: DEFAULT_HDRI_INDEX
};
const APPEARANCE_STORAGE_KEY = 'chessBattleRoyalAppearance';
const CHAIR_COLOR_OPTIONS = Object.freeze([...CHESS_CHAIR_OPTIONS]);
const TABLE_THEME_OPTIONS = Object.freeze([...CHESS_BATTLE_TABLE_OPTIONS]);

const TABLE_FINISH_OPTIONS = Object.freeze([...CHESS_TABLE_FINISH_OPTIONS]);
const DEFAULT_TABLE_FINISH = TABLE_FINISH_OPTIONS[0];
const DEFAULT_WOOD_OPTION = DEFAULT_TABLE_FINISH?.woodOption ?? TABLE_WOOD_OPTIONS[0];
const DEFAULT_CLOTH_OPTION = TABLE_CLOTH_OPTIONS[0];
const DEFAULT_BASE_OPTION = TABLE_BASE_OPTIONS[0];
const DEFAULT_TABLE_SHAPE_OPTION =
  TABLE_SHAPE_OPTIONS.find((option) => option.id !== 'diamondEdge') || TABLE_SHAPE_OPTIONS[0];

const PRESERVE_NATIVE_PIECE_IDS = new Set([BEAUTIFUL_GAME_SWAP_SET_ID]);

const CUSTOMIZATION_SECTIONS = [
  { key: 'tables', label: 'Table Model', options: TABLE_THEME_OPTIONS },
  { key: 'tableCloth', label: 'Table Cloth', options: TABLE_CLOTH_OPTIONS },
  { key: 'tableFinish', label: 'Table Finish', options: TABLE_FINISH_OPTIONS },
  { key: 'chairColor', label: 'Chairs', options: CHAIR_COLOR_OPTIONS },
  { key: 'environmentHdri', label: 'HDR Environment', options: CHESS_HDRI_OPTIONS }
];

const SHAPE_CUSTOMIZATION_TABLE_IDS = new Set(['hexagonTable', 'murlan-default', 'grandOval']);
const BOARD_SURFACE_OFFSETS_BY_SHAPE = Object.freeze({
  classicOctagon: -0.065,
  hexagonTable: -0.065,
  grandOval: -0.065,
  diamondEdge: -0.07
});

function normalizeAppearance(value = {}) {
  const normalized = { ...DEFAULT_APPEARANCE };
  const fallbackPieceStyleIndex = Number.isFinite(value?.pieceStyle)
    ? Math.min(Math.max(0, Math.round(value.pieceStyle)), PIECE_STYLE_OPTIONS.length - 1)
    : null;
  const entries = [
    ['tables', TABLE_THEME_OPTIONS.length],
    ['tableCloth', TABLE_CLOTH_OPTIONS.length],
    ['tableFinish', TABLE_FINISH_OPTIONS.length],
    ['chairColor', CHAIR_COLOR_OPTIONS.length],
    ['environmentHdri', CHESS_HDRI_OPTIONS.length]
  ];
  entries.forEach(([key, max]) => {
    const raw = Number(value?.[key]);
    const source = Number.isFinite(raw) ? raw : fallbackPieceStyleIndex;
    if (!Number.isFinite(source)) return;
    const clamped = Math.min(Math.max(0, Math.round(source)), max - 1);
    normalized[key] = clamped;
  });
  normalized.boardColor = DEFAULT_APPEARANCE.boardColor;
  normalized.whitePieceStyle = DEFAULT_APPEARANCE.whitePieceStyle;
  normalized.blackPieceStyle = DEFAULT_APPEARANCE.blackPieceStyle;
  normalized.headStyle = DEFAULT_APPEARANCE.headStyle;
  return normalized;
}

function getEffectiveShapeConfigForTableTheme(tableTheme) {
  const fallback = DEFAULT_TABLE_SHAPE_OPTION ?? TABLE_SHAPE_OPTIONS[0];
  const requestedShapeId = tableTheme?.proceduralShapeId;
  if (!requestedShapeId) return { option: fallback, rotationY: 0, forced: false };
  const requested = TABLE_SHAPE_OPTIONS.find((option) => option.id === requestedShapeId) ?? fallback;
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
  if (theme?.preserveMaterials) {
    mats.chairId = theme.chairId ?? 'default';
    return;
  }
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
    chairId: chairOption?.id ?? 'default',
    preserveMaterials: chairOption?.preserveMaterials
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
    if (theme?.source === 'polyhaven' && theme?.assetId) {
      const root = await loadPolyhavenModel(theme.assetId);
      const model = root.clone(true);
      prepareLoadedModel(model);
      fitChairModelToFootprint(model);
      const materials = extractChairMaterials(model);
      applyChairThemeMaterials({ chairMaterials: materials }, theme);
      return { chairTemplate: model, materials };
    }
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

async function buildTableFromTheme(theme, options = {}) {
  const {
    arena,
    renderer = null,
    tableRadius = TABLE_RADIUS,
    tableHeight = TABLE_HEIGHT,
    woodOption = TABLE_WOOD_OPTIONS[0],
    clothOption = TABLE_CLOTH_OPTIONS[0],
    baseOption = TABLE_BASE_OPTIONS[0],
    shapeOption = TABLE_SHAPE_OPTIONS[0],
    rotationY = 0,
    textureLoader = null,
    maxAnisotropy = 1,
    textureCache = null,
    fallbackTexture = null
  } = options;
  if (!arena) throw new Error('buildTableFromTheme requires an arena group');
  const selectedTheme = theme || TABLE_THEME_OPTIONS[0];
  let tableInfo = null;

  if (selectedTheme?.source === 'polyhaven' && selectedTheme?.assetId) {
    try {
      const model = await createPolyhavenInstance(selectedTheme.assetId, 0, renderer, {
        textureLoader,
        maxAnisotropy,
        textureCache,
        fallbackTexture
      });
      const fitted = fitTableModelToArena(model);
      if (selectedTheme.rotationY || rotationY) {
        model.rotation.y += (selectedTheme.rotationY ?? 0) + (rotationY ?? 0);
      }
      const group = new THREE.Group();
      group.add(model);
      arena.add(group);
      tableInfo = {
        group,
        surfaceY: fitted.surfaceY,
        radius: fitted.radius,
        dispose: () => {
          disposeObjectResources(group);
          group.removeFromParent();
        },
        materials: null,
        shapeId: shapeOption?.id,
        rotationY: rotationY ?? 0,
        themeId: selectedTheme.id
      };
    } catch (error) {
      console.warn('Chess Battle Royal: failed to load Poly Haven table', error);
    }
  }

  if (!tableInfo) {
    const fallback = createMurlanStyleTable({
      arena,
      renderer,
      tableRadius,
      tableHeight,
      woodOption,
      clothOption,
      baseOption,
      shapeOption,
      rotationY,
      textureLoader,
      maxAnisotropy,
      textureCache,
      fallbackTexture
    });
    tableInfo = { ...fallback, themeId: selectedTheme?.id || fallback.shapeId };
  }

  return tableInfo;
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
    id: source.id,
    label: source.label ?? source.name,
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
    frameMetalness: clamp01(source.frameMetalness, BASE_BOARD_THEME.frameMetalness),
    preserveOriginalMaterials: Boolean(
      source.preserveOriginalMaterials ?? source.preserveOriginal
    )
  };
}

const BOARD_MATERIAL_CACHE = new WeakMap();

function snapshotBoardMaterials(boardModel) {
  if (BOARD_MATERIAL_CACHE.has(boardModel)) return;
  const cache = new Map();
  boardModel.traverse((node) => {
    if (!node?.isMesh) return;
    const materials = Array.isArray(node.material)
      ? node.material.map((mat) => (mat?.clone ? mat.clone() : mat))
      : [node.material?.clone ? node.material.clone() : node.material];
    cache.set(node.uuid, materials);
  });
  BOARD_MATERIAL_CACHE.set(boardModel, cache);
}

function restoreBoardMaterials(boardModel) {
  const cache = BOARD_MATERIAL_CACHE.get(boardModel);
  if (!cache) return;
  boardModel.traverse((node) => {
    if (!node?.isMesh) return;
    const saved = cache.get(node.uuid);
    if (!saved) return;
    const cloned = saved.map((mat) => (mat?.clone ? mat.clone() : mat));
    node.material = Array.isArray(node.material) ? cloned : cloned[0];
    node.castShadow = true;
    node.receiveShadow = true;
  });
}

function applyBeautifulGameBoardTheme(boardModel, boardTheme = BEAUTIFUL_GAME_THEME) {
  if (!boardModel) return;

  snapshotBoardMaterials(boardModel);
  restoreBoardMaterials(boardModel);

  const theme = buildBoardTheme(boardTheme);
  if (theme.preserveOriginalMaterials) {
    return;
  }

  const luminance = (color) => 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
  const toArray = (value) => (Array.isArray(value) ? value : [value]);

  const applyMaterial = (mesh, updater) => {
    if (!mesh?.isMesh) return;
    const materials = toArray(mesh.material);
    materials.forEach((mat) => {
      if (!mat) return;
      updater(mat);
      mat.needsUpdate = true;
    });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  };

  const applyFrame = (mesh, color) =>
    applyMaterial(mesh, (mat) => {
      if (mat?.color?.set) mat.color.set(color);
      if (Number.isFinite(theme.frameRoughness)) mat.roughness = clamp01(theme.frameRoughness);
      if (Number.isFinite(theme.frameMetalness)) mat.metalness = clamp01(theme.frameMetalness);
      if ('clearcoat' in mat) mat.clearcoat = 0;
      if ('clearcoatRoughness' in mat) mat.clearcoatRoughness = clamp01(mat.clearcoatRoughness ?? 0.2);
      if ('reflectivity' in mat) mat.reflectivity = 0;
      if (mat?.emissive?.set) mat.emissive.set(0x000000);
    });

  const applySurface = (mesh, color) =>
    applyMaterial(mesh, (mat) => {
      if (mat?.color?.set) mat.color.set(color);
      if (Number.isFinite(theme.surfaceRoughness)) mat.roughness = clamp01(theme.surfaceRoughness);
      if (Number.isFinite(theme.surfaceMetalness)) mat.metalness = clamp01(theme.surfaceMetalness);
      if ('clearcoat' in mat) mat.clearcoat = 0;
      if ('clearcoatRoughness' in mat) mat.clearcoatRoughness = clamp01(mat.clearcoatRoughness ?? 0.16);
      if ('reflectivity' in mat) mat.reflectivity = 0;
      if (mat?.emissive?.set) mat.emissive.set(0x000000);
    });

  const frameNames = ['boardframe', 'frame', 'rim', 'border'];
  const topHints = ['boardtop', 'top', 'cover'];
  const tileHints = ['tile', 'square', 'cell', 'floor'];

  boardModel.traverse((node) => {
    if (!node?.isMesh) return;
    const name = (node.name ?? '').toLowerCase();
    const materials = toArray(node.material);
    let avgLum = 0;
    let count = 0;
    materials.forEach((mat) => {
      if (mat?.color) {
        avgLum += luminance(mat.color);
        count += 1;
      }
    });
    const lightness = count > 0 ? avgLum / count : 0.5;

    if (frameNames.some((hint) => name.includes(hint))) {
      applyFrame(node, lightness >= 0.55 ? theme.frameLight : theme.frameDark);
      return;
    }

    if (topHints.some((hint) => name.includes(hint))) {
      applyFrame(node, theme.frameLight);
      return;
    }

    const isTile = tileHints.some((hint) => name.includes(hint)) || name.startsWith('tile_');
    const targetColor = isTile
      ? lightness >= 0.5
        ? theme.light
        : theme.dark
      : lightness >= 0.55
        ? theme.frameLight
        : theme.frameDark;
    applySurface(node, targetColor);
  });
}

function normalizeBoardModelToDisplaySize(boardModel, targetSize = RAW_BOARD_SIZE) {
  if (!boardModel) return { span: 0, top: 0 };

  const safeTarget = Math.max(targetSize || RAW_BOARD_SIZE, 0.001);
  const box = new THREE.Box3().setFromObject(boardModel);
  const size = box.getSize(new THREE.Vector3());
  const largest = Math.max(size.x || 0.001, size.z || 0.001);
  const scaledTarget = safeTarget * BOARD_MODEL_SPAN_BIAS;
  const scale = scaledTarget / largest;
  if (Number.isFinite(scale) && scale > 0) {
    boardModel.scale.multiplyScalar(scale);
  }

  const scaledBox = new THREE.Box3().setFromObject(boardModel);
  const center = scaledBox.getCenter(new THREE.Vector3());
  boardModel.position.set(
    -center.x,
    -scaledBox.min.y + (BOARD.baseH + 0.02 + BOARD_MODEL_Y_OFFSET + BOARD_VISUAL_Y_OFFSET),
    -center.z
  );

  const normalizedBox = new THREE.Box3().setFromObject(boardModel);
  const topBeforeDrop = normalizedBox.max.y;
  boardModel.position.y -= BOARD_SURFACE_DROP;
  normalizedBox.translate(new THREE.Vector3(0, -BOARD_SURFACE_DROP, 0));
  const span = Math.max(
    normalizedBox.max.x - normalizedBox.min.x,
    normalizedBox.max.z - normalizedBox.min.z
  );
  const top = topBeforeDrop;

  return { span, top };
}

function mergePieceStylesByColor(whiteStyle = DEFAULT_PIECE_STYLE, blackStyle = DEFAULT_PIECE_STYLE) {
  const white = whiteStyle.white ?? DEFAULT_PIECE_STYLE.white;
  const black = blackStyle.black ?? DEFAULT_PIECE_STYLE.black;
  const accent = whiteStyle.accent ?? blackStyle.accent ?? DEFAULT_PIECE_STYLE.accent;
  return {
    white,
    black,
    accent,
    whiteAccent: whiteStyle.whiteAccent,
    blackAccent: blackStyle.blackAccent,
    goldAccent: whiteStyle.goldAccent ?? blackStyle.goldAccent ?? DEFAULT_PIECE_STYLE.goldAccent,
    preserveOriginalMaterials: Boolean(
      whiteStyle.preserveOriginalMaterials && blackStyle.preserveOriginalMaterials
    ),
    keepTextures: Boolean(
      whiteStyle.keepTextures ||
        blackStyle.keepTextures ||
        whiteStyle.preserveOriginalMaterials ||
        blackStyle.preserveOriginalMaterials
    ),
    roughness: whiteStyle.roughness ?? blackStyle.roughness,
    metalness: whiteStyle.metalness ?? blackStyle.metalness,
    clearcoat: whiteStyle.clearcoat ?? blackStyle.clearcoat,
    clearcoatRoughness: whiteStyle.clearcoatRoughness ?? blackStyle.clearcoatRoughness,
    sheen: whiteStyle.sheen ?? blackStyle.sheen,
    sheenColor: whiteStyle.sheenColor ?? blackStyle.sheenColor,
    specularIntensity: whiteStyle.specularIntensity ?? blackStyle.specularIntensity
  };
}

function createChessPalette(appearance = DEFAULT_APPEARANCE) {
  const normalized = normalizeAppearance(appearance);
  const whitePieceOption =
    PIECE_STYLE_OPTIONS[normalized.whitePieceStyle]?.style ?? DEFAULT_PIECE_STYLE;
  const blackPieceOption =
    PIECE_STYLE_OPTIONS[normalized.blackPieceStyle]?.style ?? DEFAULT_PIECE_STYLE;
  const pieceOption = mergePieceStylesByColor(whitePieceOption, blackPieceOption);
  const boardOption = BEAUTIFUL_GAME_BOARD_OPTIONS[normalized.boardColor] ?? BEAUTIFUL_GAME_THEME;
  const boardTheme = buildBoardTheme(boardOption);
  const headOption = HEAD_PRESET_OPTIONS[normalized.headStyle]?.preset ?? HEAD_PRESET_OPTIONS[0].preset;
  return {
    board: boardTheme,
    pieces: pieceOption,
    head: headOption,
    highlight: boardTheme.highlight,
    capture: boardTheme.capture,
    accent: boardTheme.accent,
    pieceSetId: PIECE_STYLE_OPTIONS[normalized.whitePieceStyle]?.id ?? DEFAULT_PIECE_SET_ID
  };
}

let sharedKTX2Loader = null;
const GLB_MAGIC = 0x46546c67;
const GLB_VERSION = 2;
const GLB_JSON_CHUNK = 0x4e4f534a;
const GLB_BIN_CHUNK = 0x004e4942;

function createConfiguredGLTFLoader(renderer = null) {
  const loader = new GLTFLoader();
  loader.setCrossOrigin('anonymous');
  const draco = new DRACOLoader();
  draco.setDecoderPath(DRACO_DECODER_PATH);
  loader.setDRACOLoader(draco);
  loader.setMeshoptDecoder(MeshoptDecoder);

  if (!sharedKTX2Loader) {
    sharedKTX2Loader = new KTX2Loader();
    sharedKTX2Loader.setTranscoderPath(BASIS_TRANSCODER_PATH);
    const supportRenderer = renderer || (typeof document !== 'undefined'
      ? new THREE.WebGLRenderer({ antialias: false, alpha: true })
      : null);
    if (supportRenderer) {
      sharedKTX2Loader.detectSupport(supportRenderer);
      if (!renderer) supportRenderer.dispose();
    }
  }

  loader.setKTX2Loader(sharedKTX2Loader);
  return loader;
}

function normalizeModel(object, targetSize) {
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  object.scale.multiplyScalar(targetSize / maxDim);
  const normalized = new THREE.Box3().setFromObject(object);
  const center = new THREE.Vector3();
  normalized.getCenter(center);
  object.position.x -= center.x;
  object.position.z -= center.z;
  object.position.y -= normalized.min.y;
}

function prepareCaptureModel(root) {
  root.traverse((child) => {
    if (!child?.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      if (material?.map) applySRGBColorSpace(material.map);
      if (material?.emissiveMap) {
        applySRGBColorSpace(material.emissiveMap);
      }
      if (material && 'envMapIntensity' in material) {
        material.envMapIntensity = 1.1;
        material.needsUpdate = true;
      }
    });
  });
}

function inferRotorSpinAxis(node, fallbackAxis = 'y') {
  if (!node) return new THREE.Vector3(0, 1, 0);
  const bounds = new THREE.Box3().setFromObject(node);
  if (bounds.isEmpty()) {
    if (fallbackAxis === 'x') return new THREE.Vector3(1, 0, 0);
    if (fallbackAxis === 'z') return new THREE.Vector3(0, 0, 1);
    return new THREE.Vector3(0, 1, 0);
  }
  const size = new THREE.Vector3();
  bounds.getSize(size);
  const dims = [
    { axis: 'x', value: Math.abs(size.x) },
    { axis: 'y', value: Math.abs(size.y) },
    { axis: 'z', value: Math.abs(size.z) }
  ].sort((a, b) => a.value - b.value);
  const chosen = dims[0]?.axis || fallbackAxis;
  if (chosen === 'x') return new THREE.Vector3(1, 0, 0);
  if (chosen === 'z') return new THREE.Vector3(0, 0, 1);
  return new THREE.Vector3(0, 1, 0);
}

function applyMilitaryHelicopterLook(model, topRotor = null, tailRotor = null, toneSeed = null, skin = null) {
  if (!model) return;
  applyCaptureTextureToOpaqueMeshes(model, 'helicopter', toneSeed);
  if (skin) {
    applyVehicleSkinToModel(model, skin, (node) => {
      const name = `${node.name || ''}`.toLowerCase();
      return /window|cockpit|glass|canopy|rotor|propell|blade|fan/.test(name);
    });
  }
  model.traverse((node) => {
    if (!node?.isMesh) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    const name = `${node.name || ''}`.toLowerCase();
    materials.forEach((mat) => {
      if (!mat?.color) return;
      if (/window|cockpit|glass|canopy/.test(name)) {
        mat.color.setHex(0x0c1016);
        if ('metalness' in mat) mat.metalness = 0.38;
        if ('roughness' in mat) mat.roughness = 0.2;
        if ('opacity' in mat) mat.opacity = 0.95;
        if ('transparent' in mat) mat.transparent = true;
      } else if ((topRotor && node === topRotor) || (tailRotor && node === tailRotor) || /rotor|propell|blade|fan/.test(name)) {
        mat.color.set('#d4af37');
        if ('metalness' in mat) mat.metalness = 0.95;
        if ('roughness' in mat) mat.roughness = 0.18;
      } else {
        mat.color.offsetHSL(0.02, -0.14, -0.16);
        if ('metalness' in mat) mat.metalness = Math.min(0.58, (mat.metalness ?? 0.3) + 0.08);
        if ('roughness' in mat) mat.roughness = Math.max(0.36, (mat.roughness ?? 0.6) - 0.12);
      }
      mat.needsUpdate = true;
    });
  });
}

function getCaptureVehicleTexture(kind = 'generic', toneSeed = null) {
  const seedKey = toneSeed
    ? `${toneSeed.base || ''}|${toneSeed.mid || ''}|${toneSeed.dark || ''}|${toneSeed.grid || ''}`
    : '';
  const cacheKey = `${kind}:${seedKey}`;
  if (CAPTURE_VEHICLE_TEXTURE_CACHE.has(cacheKey)) return CAPTURE_VEHICLE_TEXTURE_CACHE.get(cacheKey);
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const fallback = new THREE.CanvasTexture(canvas);
    CAPTURE_VEHICLE_TEXTURE_CACHE.set(cacheKey, fallback);
    return fallback;
  }
  const palettes = {
    fighter: ['#555f66', '#7f8c94', '#353d43', '#9caab2'],
    helicopter: ['#5f6871', '#848f99', '#343c42', '#a5b1ba'],
    drone: ['#6a737d', '#8f98a1', '#3e464d', '#b4bec7'],
    missile: ['#8f98a1', '#c4ccd4', '#66707a', '#dce3ea'],
    generic: ['#55606a', '#74818b', '#313940', '#99a6af']
  };
  const baseTone = palettes[kind] ?? palettes.generic;
  const tone = toneSeed
    ? [toneSeed.base || baseTone[0], toneSeed.mid || baseTone[1], toneSeed.dark || baseTone[2], toneSeed.grid || baseTone[3]]
    : baseTone;
  ctx.fillStyle = tone[0];
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i += 1) {
    const w = 24 + ((i * 11) % 70);
    const h = 10 + ((i * 7) % 36);
    const x = (i * 37) % 256;
    const y = (i * 53) % 256;
    ctx.fillStyle = tone[(i % (tone.length - 1)) + 1];
    ctx.globalAlpha = 0.42 + ((i % 4) * 0.12);
    ctx.fillRect(x, y, w, h);
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  for (let y = 0; y <= 256; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.4, 2.4);
  texture.anisotropy = 4;
  CAPTURE_VEHICLE_TEXTURE_CACHE.set(cacheKey, texture);
  return texture;
}

function createCaptureVehicleMaterial(kind, options = {}) {
  const { toneSeed = null, ...materialOptions } = options;
  const textureSet = CAPTURE_POLYHAVEN_TEXTURE_SETS.get(kind) || null;
  return new THREE.MeshStandardMaterial({
    map: textureSet?.diffuse || getCaptureVehicleTexture(kind, toneSeed),
    normalMap: textureSet?.normal || null,
    roughnessMap: textureSet?.roughness || null,
    ...materialOptions
  });
}

async function primeCaptureVehicleTextureSets(maxAnisotropy = 1) {
  const textureLoader = new THREE.TextureLoader();
  const entries = Object.entries(CAPTURE_POLYHAVEN_TEXTURE_ASSETS);
  await Promise.all(
    entries.map(async ([kind, assetId]) => {
      if (!assetId || CAPTURE_POLYHAVEN_TEXTURE_SETS.has(kind)) return;
      const set = await loadPolyhavenTextureSet(assetId, textureLoader, maxAnisotropy, CAPTURE_POLYHAVEN_TEXTURE_CACHE);
      if (set) CAPTURE_POLYHAVEN_TEXTURE_SETS.set(kind, set);
    })
  );
}

function applyCaptureTextureToOpaqueMeshes(root, kind, toneSeed = null) {
  root.traverse((obj) => {
    if (!obj?.isMesh) return;
    const mat = obj.material;
    if (!mat || Array.isArray(mat) || mat.transparent || mat.opacity < 1) return;
    obj.material = createCaptureVehicleMaterial(kind, {
      toneSeed,
      color: mat.color ?? '#ffffff',
      roughness: typeof mat.roughness === 'number' ? mat.roughness : 0.58,
      metalness: typeof mat.metalness === 'number' ? mat.metalness : 0.2
    });
    obj.castShadow = true;
    obj.receiveShadow = true;
  });
}

function extractVehicleSkinFromPiece(pieceMesh) {
  if (!pieceMesh) return null;
  let sampledMaterial = null;
  pieceMesh.traverse((node) => {
    if (sampledMaterial || !node?.isMesh) return;
    const name = `${node.name || ''}`.toLowerCase();
    if (/head|top|cap|crown|finial|ball/.test(name)) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    sampledMaterial = materials.find((mat) => mat?.color) || sampledMaterial;
  });
  if (!sampledMaterial) return null;
  return {
    map: sampledMaterial.map || null,
    color: sampledMaterial.color ? sampledMaterial.color.clone() : new THREE.Color('#6c737b'),
    roughness: typeof sampledMaterial.roughness === 'number' ? sampledMaterial.roughness : 0.5,
    metalness: typeof sampledMaterial.metalness === 'number' ? sampledMaterial.metalness : 0.35
  };
}

function applyVehicleSkinToModel(model, skin, exclude = () => false) {
  if (!model || !skin) return;
  model.traverse((node) => {
    if (!node?.isMesh || exclude(node)) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    const skinned = materials.map((mat) => {
      if (!mat) return mat;
      const next = mat.clone();
      if (skin.map) next.map = skin.map;
      if (next.color) next.color.copy(skin.color);
      if ('roughness' in next) next.roughness = skin.roughness;
      if ('metalness' in next) next.metalness = skin.metalness;
      next.needsUpdate = true;
      return next;
    });
    node.material = Array.isArray(node.material) ? skinned : skinned[0];
  });
}

function applyMilitaryJetLook(model, toneSeed = null, skin = null) {
  if (!model) return;
  applyCaptureTextureToOpaqueMeshes(model, 'fighter', toneSeed);
  if (skin) {
    applyVehicleSkinToModel(model, skin, (node) =>
      /cockpit|canopy|window|glass|missile|rocket|store|pod|engine|exhaust|nozzle|thruster|afterburn/.test(
        `${node.name || ''}`.toLowerCase()
      )
    );
  }
  model.traverse((node) => {
    if (!node?.isMesh) return;
    const name = `${node.name || ''}`.toLowerCase();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.forEach((mat) => {
      if (!mat?.color) return;
      if (/cockpit|canopy|window|glass/.test(name)) {
        mat.color.set('#06080c');
        if ('metalness' in mat) mat.metalness = 0.55;
        if ('roughness' in mat) mat.roughness = 0.16;
        if ('transparent' in mat) mat.transparent = true;
        if ('opacity' in mat) mat.opacity = 0.94;
      } else if (/missile|rocket|store|pod/.test(name)) {
        mat.color.set('#d8dde3');
        if ('metalness' in mat) mat.metalness = 0.88;
        if ('roughness' in mat) mat.roughness = 0.24;
      } else {
        mat.color.offsetHSL(-0.03, -0.18, -0.12);
        if ('metalness' in mat) mat.metalness = Math.min(0.75, (mat.metalness ?? 0.25) + 0.2);
        if ('roughness' in mat) mat.roughness = Math.max(0.32, (mat.roughness ?? 0.6) - 0.14);
      }
      mat.needsUpdate = true;
    });
  });
}

function applyMilitaryDroneLook(model, propeller = null, toneSeed = null) {
  if (!model) return;
  applyCaptureTextureToOpaqueMeshes(model, 'drone', toneSeed);
  model.traverse((node) => {
    if (!node?.isMesh) return;
    const name = `${node.name || ''}`.toLowerCase();
    const isPropellerMesh =
      node === propeller ||
      node.parent === propeller ||
      /propell|rotor|blade|fan|motor/.test(name);
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.forEach((mat) => {
      if (!mat?.color) return;
      if (isPropellerMesh || /engine|exhaust|rear|tail/.test(name)) {
        mat.color.setHex(0x11151a);
        if ('metalness' in mat) mat.metalness = 0.72;
        if ('roughness' in mat) mat.roughness = 0.28;
      } else {
        mat.color.set('#556b2f');
        if ('metalness' in mat) mat.metalness = 0.84;
        if ('roughness' in mat) mat.roughness = 0.34;
      }
      mat.needsUpdate = true;
    });
  });
}

function isDataUri(uri) {
  return typeof uri === 'string' && uri.startsWith('data:');
}

function isAbsoluteUrl(uri) {
  return /^https?:\/\//i.test(uri) || uri.startsWith('blob:');
}

function uniqueStrings(values) {
  return Array.from(new Set(values));
}

function buildImageCandidates(imageUri, sourceUrl, modelUrls) {
  if (isAbsoluteUrl(imageUri)) return uniqueStrings([imageUri]);
  return uniqueStrings([
    imageUri,
    new URL(imageUri, sourceUrl).href,
    ...modelUrls.map((modelUrl) => new URL(imageUri, modelUrl).href)
  ]);
}

function decodeGlb(buffer) {
  const view = new DataView(buffer);
  if (view.byteLength < 20) throw new Error('GLB too small to parse');
  if (view.getUint32(0, true) !== GLB_MAGIC) throw new Error('Asset is not a GLB file');
  if (view.getUint32(4, true) !== GLB_VERSION) throw new Error('Unsupported GLB version');

  const totalLength = view.getUint32(8, true);
  const bytes = new Uint8Array(buffer, 0, totalLength);
  const decoder = new TextDecoder();

  let offset = 12;
  let json = null;
  let binChunk = null;

  while (offset + 8 <= totalLength) {
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    offset += 8;
    const chunkBytes = bytes.slice(offset, offset + chunkLength);
    offset += chunkLength;
    if (chunkType === GLB_JSON_CHUNK) {
      json = JSON.parse(decoder.decode(chunkBytes).trim());
    } else if (chunkType === GLB_BIN_CHUNK) {
      binChunk = chunkBytes;
    }
  }

  if (!json) throw new Error('GLB missing JSON chunk');
  return { json, binChunk };
}

function createMinimalGlbBuffer(json, binChunk) {
  const encoder = new TextEncoder();
  const rawJson = encoder.encode(JSON.stringify(json));
  const jsonPadding = (4 - (rawJson.length % 4)) % 4;
  const paddedJson = new Uint8Array(rawJson.length + jsonPadding);
  paddedJson.set(rawJson);
  paddedJson.fill(0x20, rawJson.length);

  let paddedBin = null;
  if (binChunk) {
    const binPadding = (4 - (binChunk.length % 4)) % 4;
    paddedBin = new Uint8Array(binChunk.length + binPadding);
    paddedBin.set(binChunk);
  }

  const totalLength = 12 + 8 + paddedJson.length + (paddedBin ? 8 + paddedBin.length : 0);
  const buffer = new ArrayBuffer(totalLength);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, GLB_VERSION, true);
  view.setUint32(8, totalLength, true);

  let offset = 12;
  view.setUint32(offset, paddedJson.length, true);
  view.setUint32(offset + 4, GLB_JSON_CHUNK, true);
  offset += 8;
  bytes.set(paddedJson, offset);
  offset += paddedJson.length;

  if (paddedBin) {
    view.setUint32(offset, paddedBin.length, true);
    view.setUint32(offset + 4, GLB_BIN_CHUNK, true);
    offset += 8;
    bytes.set(paddedBin, offset);
  }

  return buffer;
}

function extractBufferViewBytes(json, binChunk, bufferViewIndex) {
  if (!binChunk) return null;
  const bufferViews = Array.isArray(json?.bufferViews) ? json.bufferViews : [];
  const view = bufferViews[bufferViewIndex];
  if (!view) return null;
  const byteOffset = typeof view.byteOffset === 'number' ? view.byteOffset : 0;
  const byteLength = typeof view.byteLength === 'number' ? view.byteLength : 0;
  if (byteLength <= 0) return null;
  return binChunk.slice(byteOffset, byteOffset + byteLength);
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function bytesToDataUri(bytes, mimeType) {
  return `data:${mimeType};base64,${bytesToBase64(bytes)}`;
}

async function fetchBuffer(url) {
  const response = await fetch(url, { mode: 'cors' });
  if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
  return response.arrayBuffer();
}

async function fetchBlob(url) {
  const response = await fetch(url, { mode: 'cors' });
  if (!response.ok) throw new Error(`Fetch blob failed: ${response.status}`);
  return response.blob();
}

function parseObjectFromBuffer(loader, buffer) {
  return new Promise((resolve, reject) => {
    loader.parse(
      buffer,
      '',
      (gltf) => resolve(gltf?.scene || gltf?.scenes?.[0] || null),
      (error) => reject(error)
    );
  });
}

async function blobToDataUri(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Failed to convert blob to data URI'));
    reader.readAsDataURL(blob);
  });
}

function makePlaceholderTextureDataUri(primary, secondary) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return 'data:image/png;base64,';
  ctx.fillStyle = primary;
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = secondary;
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillRect(32, 32, 32, 32);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 62, 62);
  return canvas.toDataURL('image/png');
}

async function resolveExternalImageToDataUri(imageUri, kind, sourceUrl, modelUrls, cache) {
  if (isDataUri(imageUri)) return imageUri;
  const placeholderColors = {
    drone: ['#7c8791', '#4f5861'],
    helicopter: ['#6f7763', '#4f5648'],
    fighter: ['#98a1a9', '#646d76']
  };
  const [primary, secondary] = placeholderColors[kind] ?? ['#6e7681', '#4f5861'];
  const placeholderDataUri = makePlaceholderTextureDataUri(primary, secondary);
  const candidates = buildImageCandidates(imageUri, sourceUrl, modelUrls);
  for (const candidate of candidates) {
    if (!isAbsoluteUrl(candidate)) continue;
    const cached = cache.get(candidate);
    if (cached) return cached;
    try {
      // eslint-disable-next-line no-await-in-loop
      const blob = await fetchBlob(candidate);
      // eslint-disable-next-line no-await-in-loop
      const dataUri = await blobToDataUri(blob);
      if (dataUri) {
        cache.set(candidate, dataUri);
        return dataUri;
      }
    } catch {
      // ignore candidate
    }
  }
  return placeholderDataUri;
}

async function patchGlbImagesToDataUris(buffer, kind, sourceUrl, modelUrls, cache) {
  const { json, binChunk } = decodeGlb(buffer);
  const cloned = JSON.parse(JSON.stringify(json));
  const images = Array.isArray(cloned.images) ? cloned.images : [];
  if (!images.length) return buffer;

  for (let i = 0; i < images.length; i += 1) {
    const image = images[i];
    if (typeof image.uri === 'string') {
      // eslint-disable-next-line no-await-in-loop
      image.uri = await resolveExternalImageToDataUri(image.uri, kind, sourceUrl, modelUrls, cache);
      delete image.bufferView;
      image.mimeType = image.mimeType ?? 'image/png';
      continue;
    }
    if (typeof image.bufferView === 'number') {
      const bytes = extractBufferViewBytes(cloned, binChunk, image.bufferView);
      if (bytes?.length) {
        const mimeType = typeof image.mimeType === 'string' ? image.mimeType : 'image/png';
        image.uri = bytesToDataUri(bytes, mimeType);
        delete image.bufferView;
        image.mimeType = mimeType;
      }
    }
  }

  return createMinimalGlbBuffer(cloned, binChunk);
}

async function loadBeautifulGameSet(urls = BEAUTIFUL_GAME_URLS) {
  const loader = createConfiguredGLTFLoader();
  let lastError = null;
  for (const url of urls) {
    try {
      const isLocal = url.startsWith('/') || url.startsWith('./');
      const resolvedUrl = new URL(url, window.location.href).href;
      const resourcePath = resolvedUrl.substring(0, resolvedUrl.lastIndexOf('/') + 1);
      const isAbsolute = /^https?:\/\//i.test(resolvedUrl);
      loader.setResourcePath(resourcePath);
      loader.setPath(isAbsolute ? '' : resourcePath);
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

async function loadBeautifulGameTouchSet() {
  return loadBeautifulGameSet([...BEAUTIFUL_GAME_TOUCH_URLS, ...BEAUTIFUL_GAME_URLS]);
}

async function loadPieceSetFromUrlsStrict(urls = [], options = {}) {
  const assets = await loadPieceSetFromUrls(urls, options);
  if (assets?.piecePrototypes) return assets;
  throw new Error(`${options?.name ?? 'Chess set'} failed to load`);
}

async function loadPieceSetFromUrls(urls = [], options = {}) {
  const loader = createConfiguredGLTFLoader();
  let lastError = null;
  for (const url of urls) {
    try {
      const resolvedUrl = new URL(url, window.location.href).href;
      const resourcePath = resolvedUrl.substring(0, resolvedUrl.lastIndexOf('/') + 1);
      const isAbsolute = /^https?:\/\//i.test(resolvedUrl);
      loader.setResourcePath(resourcePath);
      loader.setPath(isAbsolute ? '' : resourcePath);
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
  if (assets?.userData?.proceduralAssets) return assets;
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

function stripMaterialTextures(material) {
  if (!material) return;
  ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap'].forEach((key) => {
    if (material[key]) {
      material[key] = null;
    }
  });
}

function applyLocalBeautifulGameMaterials(assets) {
  if (!assets) return assets;
  const { boardModel, piecePrototypes } = assets;
  if (typeof document === 'undefined') return assets;

  harmonizeBeautifulGamePieces(piecePrototypes);

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
    BEAUTIFUL_GAME_PIECE_STYLE.whiteAccent?.color ?? BEAUTIFUL_GAME_PIECE_STYLE.accent ?? '#caa472'
  );
  applyPieces(
    piecePrototypes?.black,
    BEAUTIFUL_GAME_PIECE_STYLE.black?.color ?? '#0f131f',
    BEAUTIFUL_GAME_PIECE_STYLE.blackAccent ?? BEAUTIFUL_GAME_PIECE_STYLE.accent ?? '#b58f4f'
  );

  return assets;
}

const BEAUTIFUL_GAME_GOLD_SIGNATURES = new Set();
const BEAUTIFUL_GAME_GOLD_HEIGHT_BANDS = new Map();

function meshSignature(node, pieceType = '') {
  const names = [];
  let current = node;
  while (current) {
    if (current.name) names.push(current.name.toLowerCase());
    if (current.userData?.__pieceType) break;
    current = current.parent;
  }
  return `${pieceType}:${names.reverse().join('/')}`;
}

function isGoldCandidateMaterial(material) {
  if (!material) return false;
  const name = `${material.name || ''}`.toLowerCase();
  if (/gold|crown|ring|band|trim/.test(name)) return true;
  const metalness = Number.isFinite(material.metalness) ? material.metalness : 0;
  const roughness = Number.isFinite(material.roughness) ? material.roughness : 1;
  const color = material.color;
  if (!color) return false;
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  const warmGoldHue = hsl.h >= 0.09 && hsl.h <= 0.18;
  return warmGoldHue && hsl.s >= 0.2 && metalness >= 0.35 && roughness <= 0.65;
}

function captureBeautifulGameGoldSignatures(piecePrototypes) {
  const normalizePieceType = (pieceType) => `${pieceType || ''}`.toLowerCase();
  const updatePieceBands = (pieceType, band) => {
    const normalizedPieceType = normalizePieceType(pieceType);
    if (!normalizedPieceType || !band) return;
    const current = BEAUTIFUL_GAME_GOLD_HEIGHT_BANDS.get(normalizedPieceType) || [];
    const shouldMerge = (a, b) => Math.min(a.max, b.max) - Math.max(a.min, b.min) >= -0.05;
    let merged = false;
    for (let i = 0; i < current.length; i += 1) {
      if (!shouldMerge(current[i], band)) continue;
      current[i] = {
        min: Math.min(current[i].min, band.min),
        max: Math.max(current[i].max, band.max)
      };
      merged = true;
      break;
    }
    if (!merged) current.push(band);
    BEAUTIFUL_GAME_GOLD_HEIGHT_BANDS.set(normalizedPieceType, current);
  };

  ['white', 'black'].forEach((side) => {
    Object.entries(piecePrototypes?.[side] || {}).forEach(([pieceType, piece]) => {
      const pieceBox = new THREE.Box3().setFromObject(piece);
      const pieceHeight = Math.max(1e-6, pieceBox.max.y - pieceBox.min.y);
      piece?.traverse?.((child) => {
        if (!child?.isMesh) return;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        if (!materials.some((mat) => isGoldCandidateMaterial(mat))) return;
        BEAUTIFUL_GAME_GOLD_SIGNATURES.add(meshSignature(child, pieceType));
        const box = new THREE.Box3().setFromObject(child);
        const band = {
          min: clamp01((box.min.y - pieceBox.min.y) / pieceHeight, 0),
          max: clamp01((box.max.y - pieceBox.min.y) / pieceHeight, 1)
        };
        updatePieceBands(pieceType, band);
      });
    });
  });
}

function isInsideReferenceGoldBand(child, piece, pieceType) {
  if (!piece || !pieceType) return false;
  const bands = BEAUTIFUL_GAME_GOLD_HEIGHT_BANDS.get(`${pieceType}`.toLowerCase());
  if (!Array.isArray(bands) || !bands.length) return false;
  const pieceBox = new THREE.Box3().setFromObject(piece);
  const pieceHeight = Math.max(1e-6, pieceBox.max.y - pieceBox.min.y);
  const box = new THREE.Box3().setFromObject(child);
  const testBand = {
    min: clamp01((box.min.y - pieceBox.min.y) / pieceHeight, 0),
    max: clamp01((box.max.y - pieceBox.min.y) / pieceHeight, 1)
  };
  return bands.some((band) => Math.min(band.max, testBand.max) - Math.max(band.min, testBand.min) >= 0.02);
}

function forceBeautifulGameGoldParts(mesh, colorKey = 'white', pieceStyle = BEAUTIFUL_GAME_PIECE_STYLE) {
  if (!mesh) return;
  const goldAccent = pieceStyle?.goldAccent || '#d4af37';
  const accentFallback =
    colorKey === 'black'
      ? pieceStyle?.blackAccent?.color || pieceStyle?.blackAccent || pieceStyle?.accent
      : pieceStyle?.whiteAccent?.color || pieceStyle?.whiteAccent || pieceStyle?.accent;
  const accentColor = goldAccent || accentFallback || '#d4af37';
  const pieceType =
    (mesh?.userData?.__pieceType || mesh?.userData?.t || mesh?.userData?.type || '').toString().toUpperCase() || '';
  mesh.traverse((child) => {
    if (!child?.isMesh) return;
    const name = child.name?.toLowerCase?.() ?? '';
    const referenceBandMatch = isInsideReferenceGoldBand(child, mesh, pieceType);
    const shouldAccent =
      child.userData?.__abgGold ||
      referenceBandMatch ||
      name.includes('collar') ||
      name.includes('crown') ||
      name.includes('ring') ||
      name.includes('cross') ||
      name.includes('band') ||
      name.includes('rim');
    if (!shouldAccent) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    mats.forEach((mat) => {
      if (!mat) return;
      if (mat.color?.set) {
        mat.color.set(accentColor);
      } else {
        mat.color = new THREE.Color(accentColor);
      }
      mat.metalness = clamp01((mat.metalness ?? 0.35) + 0.22);
      mat.roughness = clamp01((mat.roughness ?? 0.34) * 0.7);
      if (Number.isFinite(mat.clearcoat)) mat.clearcoat = clamp01(Math.max(mat.clearcoat, 0.42));
      if (Number.isFinite(mat.clearcoatRoughness)) {
        mat.clearcoatRoughness = clamp01(Math.min(mat.clearcoatRoughness, 0.2));
      }
    });
  });
}

function markBeautifulGameGoldMeshes(piecePrototypes) {
  ['white', 'black'].forEach((side) => {
    Object.entries(piecePrototypes?.[side] || {}).forEach(([pieceType, piece]) => {
      piece?.traverse?.((child) => {
        if (!child?.isMesh) return;
        const nameHint = /(gold|crown|ring|band|trim)/i.test(child.name || '');
        const matchesReference = BEAUTIFUL_GAME_GOLD_SIGNATURES.has(meshSignature(child, pieceType));
        if (!nameHint && !matchesReference) return;
        child.userData = { ...(child.userData || {}), __abgGold: true };
      });
    });
  });
}

function harmonizeBeautifulGamePieces(piecePrototypes, pieceStyle = BEAUTIFUL_GAME_PIECE_STYLE) {
  if (!piecePrototypes) return;
  if (pieceStyle?.preserveOriginalMaterials) {
    ['white', 'black'].forEach((colorKey) => {
      Object.values(piecePrototypes[colorKey] || {}).forEach((piece) => {
        piece?.traverse?.((child) => {
          if (child?.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        forceBeautifulGameGoldParts(piece, colorKey, pieceStyle);
      });
    });
    return;
  }
  const lightColor = pieceStyle.white?.color ?? BEAUTIFUL_GAME_THEME.light;
  const darkColor = pieceStyle.black?.color ?? BEAUTIFUL_GAME_THEME.dark;
  const accentLight = pieceStyle.whiteAccent?.color ?? pieceStyle.accent ?? BEAUTIFUL_GAME_THEME.accent;
  const darkAccent = pieceStyle.blackAccent ?? pieceStyle.accent ?? accentLight;
  const goldAccent = pieceStyle.goldAccent || '#d7b24a';
  const shouldStripTextures = !pieceStyle.keepTextures;

  const applySurface = (material, config) => {
    if (!material) return;
    if (Number.isFinite(config.roughness)) material.roughness = clamp01(config.roughness);
    if (Number.isFinite(config.metalness)) material.metalness = clamp01(config.metalness);
    if (Number.isFinite(config.clearcoat)) material.clearcoat = clamp01(config.clearcoat);
    if (Number.isFinite(config.clearcoatRoughness)) material.clearcoatRoughness = clamp01(config.clearcoatRoughness);
    if (Number.isFinite(config.sheen)) material.sheen = clamp01(config.sheen);
    if (config.sheenColor) material.sheenColor = new THREE.Color(config.sheenColor);
    if (Number.isFinite(config.specularIntensity)) material.specularIntensity = clamp01(config.specularIntensity);
  };

  const applyColor = (piece, colorHex) => {
    if (!piece) return;
    piece.traverse((child) => {
      if (!child?.isMesh) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((mat, idx) => {
        if (!mat) return;
        const applied = mat.clone ? mat.clone() : mat;
        if (shouldStripTextures) {
          stripMaterialTextures(applied);
        }
        applied.color = new THREE.Color(colorHex);
        applied.emissive?.set?.(0x000000);
        applySurface(applied, colorHex === lightColor ? pieceStyle.white : pieceStyle.black);
        if (Array.isArray(child.material)) {
          child.material[idx] = applied;
        } else {
          child.material = applied;
        }
        child.castShadow = true;
        child.receiveShadow = true;
      });
    });
  };

  ['white', 'black'].forEach((colorKey) => {
    const targetColor = colorKey === 'white' ? lightColor : darkColor;
    Object.values(piecePrototypes[colorKey] || {}).forEach((piece) => applyColor(piece, targetColor));
  });

  const accentize = (piece, colorKey, pieceType) => {
    if (!piece) return;
    const shouldStripTextures = !pieceStyle.keepTextures;
    piece.traverse((child) => {
      if (!child?.isMesh) return;
      const name = child.name?.toLowerCase?.() ?? '';
      const referenceBandMatch = isInsideReferenceGoldBand(child, piece, pieceType);
      const shouldAccent =
        child.userData?.__abgGold ||
        referenceBandMatch ||
        name.includes('collar') ||
        name.includes('crown') ||
        name.includes('ring') ||
        name.includes('cross') ||
        name.includes('band') ||
        name.includes('rim');
      if (!shouldAccent) return;
      if (referenceBandMatch) {
        child.userData = { ...(child.userData || {}), __abgGold: true };
      }
      const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((mat, idx) => {
          if (!mat) return;
          const applied = mat.clone ? mat.clone() : mat;
          if (shouldStripTextures) {
            stripMaterialTextures(applied);
          }
          const accentColor = goldAccent || (colorKey === 'black' ? darkAccent : accentLight);
          applied.color = new THREE.Color(accentColor || darkAccent || accentLight);
        applied.metalness = clamp01((applied.metalness ?? 0.35) + 0.2);
        applied.roughness = clamp01((applied.roughness ?? 0.3) * 0.7);
        applySurface(
          applied,
          colorKey === 'white'
            ? pieceStyle.whiteAccent || pieceStyle.white
            : pieceStyle.blackAccent || pieceStyle.black
        );
        if (Array.isArray(child.material)) {
          child.material[idx] = applied;
        } else {
          child.material = applied;
        }
      });
    });
  };

  ['white', 'black'].forEach((colorKey) => {
    Object.entries(piecePrototypes[colorKey] || {}).forEach(([pieceType, piece]) =>
      accentize(piece, colorKey, pieceType)
    );
  });
  ['white', 'black'].forEach((colorKey) => {
    Object.values(piecePrototypes[colorKey] || {}).forEach((piece) =>
      forceBeautifulGameGoldParts(piece, colorKey, pieceStyle)
    );
  });
}

function applyBeautifulGameStyleToMeshes(meshes, pieceStyle = BEAUTIFUL_GAME_PIECE_STYLE) {
  if (!meshes) return;
  const list = Array.isArray(meshes) ? meshes : [meshes];
  if (pieceStyle?.preserveOriginalMaterials) {
    list.forEach((mesh) => {
      mesh?.traverse?.((child) => {
        if (child?.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      const colorKey = mesh?.userData?.__pieceColor === 'black' ? 'black' : 'white';
      forceBeautifulGameGoldParts(mesh, colorKey, pieceStyle);
    });
    return;
  }
  const lightColor = pieceStyle.white?.color ?? BEAUTIFUL_GAME_THEME.light;
  const darkColor = pieceStyle.black?.color ?? BEAUTIFUL_GAME_THEME.dark;
  const accentLight = pieceStyle.whiteAccent?.color ?? pieceStyle.accent ?? BEAUTIFUL_GAME_THEME.accent;
  const darkAccent = pieceStyle.blackAccent ?? pieceStyle.accent ?? accentLight;
  const goldAccent = pieceStyle.goldAccent || '#d7b24a';
  const shouldStripTextures = !pieceStyle.keepTextures;

  const applySurface = (material, config) => {
    if (!material) return;
    if (Number.isFinite(config.roughness)) material.roughness = clamp01(config.roughness);
    if (Number.isFinite(config.metalness)) material.metalness = clamp01(config.metalness);
    if (Number.isFinite(config.clearcoat)) material.clearcoat = clamp01(config.clearcoat);
    if (Number.isFinite(config.clearcoatRoughness)) material.clearcoatRoughness = clamp01(config.clearcoatRoughness);
    if (Number.isFinite(config.sheen)) material.sheen = clamp01(config.sheen);
    if (config.sheenColor) material.sheenColor = new THREE.Color(config.sheenColor);
    if (Number.isFinite(config.specularIntensity)) material.specularIntensity = clamp01(config.specularIntensity);
    if (config.emissive) {
      material.emissive = new THREE.Color(config.emissive);
      if (Number.isFinite(config.emissiveIntensity)) {
        material.emissiveIntensity = clamp01(config.emissiveIntensity);
      }
    }
  };

  const recolorMesh = (mesh, colorKey) => {
    const targetColor = colorKey === 'black' ? darkColor : lightColor;
    mesh.traverse((child) => {
      if (!child?.isMesh) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((mat) => {
        if (!mat) return;
        if (shouldStripTextures) {
          stripMaterialTextures(mat);
        }
        if (mat.color?.set) {
          mat.color.set(targetColor);
        } else {
          mat.color = new THREE.Color(targetColor);
        }
        applySurface(mat, colorKey === 'white' ? pieceStyle.white || {} : pieceStyle.black || {});
        child.castShadow = true;
        child.receiveShadow = true;
      });
    });
  };

  const accentize = (mesh, colorKey) => {
    const pieceType =
      (mesh?.userData?.__pieceType || mesh?.userData?.t || mesh?.userData?.type || '').toString().toUpperCase() || '';
    const accentColor = goldAccent || (colorKey === 'black' ? darkAccent : accentLight);
    mesh.traverse((child) => {
      if (!child?.isMesh) return;
      const name = child.name?.toLowerCase?.() ?? '';
      const referenceBandMatch = isInsideReferenceGoldBand(child, mesh, pieceType);
      const shouldAccent =
        child.userData?.__abgGold ||
        referenceBandMatch ||
        name.includes('collar') ||
        name.includes('crown') ||
        name.includes('ring') ||
        name.includes('cross') ||
        name.includes('band') ||
        name.includes('rim');
      if (!shouldAccent) return;
      if (referenceBandMatch) {
        child.userData = { ...(child.userData || {}), __abgGold: true };
      }
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((mat) => {
        if (!mat) return;
        if (shouldStripTextures) {
          stripMaterialTextures(mat);
        }
        if (mat.color?.set) {
          mat.color.set(accentColor || darkAccent || accentLight);
        } else {
          mat.color = new THREE.Color(accentColor || darkAccent || accentLight);
        }
        mat.metalness = clamp01((mat.metalness ?? 0.35) + 0.2);
        mat.roughness = clamp01((mat.roughness ?? 0.3) * 0.7);
        applySurface(
          mat,
          colorKey === 'white'
            ? pieceStyle.whiteAccent || pieceStyle.white || {}
            : pieceStyle.blackAccent || pieceStyle.black || {}
        );
      });
    });
  };

  list.forEach((mesh) => {
    if (!mesh) return;
    const colorKey = mesh.userData?.__pieceColor === 'black' ? 'black' : 'white';
    recolorMesh(mesh, colorKey);
    accentize(mesh, colorKey);
    forceBeautifulGameGoldParts(mesh, colorKey, pieceStyle);
  });
}

function makeHeadMaterial(preset) {
  if (!preset) return null;
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(preset.color ?? '#ffffff'),
    metalness: clamp01(preset.metalness ?? 0),
    roughness: clamp01(preset.roughness ?? 0.1),
    transparent: (preset.transmission ?? 0) > 0,
    transmission: clamp01(preset.transmission ?? 0),
    ior: preset.ior ?? 1.5,
    thickness: preset.thickness ?? 0.4,
    clearcoat: 0.5,
    clearcoatRoughness: 0.06
  });
}

function collectHeadMeshes(piece) {
  const targets = [];
  if (!piece) return targets;
  const pbox = new THREE.Box3().setFromObject(piece);
  const height = pbox.max.y - pbox.min.y;
  const cutoff = pbox.max.y - height * 0.22;
  piece.traverse((node) => {
    if (!node?.isMesh) return;
    const mbox = new THREE.Box3().setFromObject(node);
    const size = new THREE.Vector3();
    mbox.getSize(size);
    const nearTop = mbox.max.y >= cutoff;
    const notFullBody = size.y <= height * 0.45;
    const name = node.name?.toLowerCase?.() ?? '';
    const nameHint = /(head|top|cap|finial|ball)/.test(name);
    if ((nearTop && notFullBody) || nameHint) {
      targets.push(node);
    }
  });
  return targets;
}

function applyHeadPresetToMeshes(meshes, preset) {
  if (!meshes || !preset) return;
  const list = Array.isArray(meshes) ? meshes : [meshes];
  const baseMaterial = makeHeadMaterial(preset);
  if (!baseMaterial) return;
  list.forEach((mesh) => {
    const type = (mesh?.userData?.__pieceType || mesh?.userData?.t || mesh?.userData?.type || '')
      .toString()
      .toUpperCase();
    if (type !== 'P' && type !== 'B') return;
    const heads = collectHeadMeshes(mesh);
    heads.forEach((head) => {
      const mats = Array.isArray(head.material) ? head.material : [head.material];
      mats.forEach((mat) => {
        if (!mat) return;
        if (mat.color?.set) {
          mat.color.set(baseMaterial.color);
        }
        if ('metalness' in mat) mat.metalness = clamp01(baseMaterial.metalness ?? 0);
        if ('roughness' in mat) mat.roughness = clamp01(baseMaterial.roughness ?? 0.1);
        mat.transparent = baseMaterial.transparent;
        mat.transmission = clamp01(baseMaterial.transmission ?? 0);
        mat.ior = baseMaterial.ior ?? 1.5;
        mat.thickness = baseMaterial.thickness ?? 0.4;
        if ('clearcoat' in mat) mat.clearcoat = 0.5;
        if ('clearcoatRoughness' in mat) mat.clearcoatRoughness = 0.06;
        mat.needsUpdate = true;
      });
      head.castShadow = true;
      head.receiveShadow = true;
    });
  });
}

function applyHeadPresetToPrototypes(piecePrototypes, preset) {
  if (!piecePrototypes || !preset) return;
  const list = [];
  ['white', 'black'].forEach((colorKey) => {
    Object.values(piecePrototypes[colorKey] || {}).forEach((proto) => list.push(proto));
  });
  applyHeadPresetToMeshes(list, preset);
}

function adornPiecePrototypes(piecePrototypes, tileSize = BOARD.tile) {
  if (!piecePrototypes) return;

  const markShadowed = (proto) => {
    if (!proto || proto.userData?.__ornamented) return;
    proto.traverse((child) => {
      if (!child?.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = true;
    });
    proto.userData = { ...(proto.userData || {}), __ornamented: true };
  };

  ['white', 'black'].forEach((colorKey) => {
    Object.values(piecePrototypes[colorKey] || {}).forEach((proto) => markShadowed(proto, colorKey));
  });
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

async function resolveBeautifulGameBoardStrict(targetBoardSize) {
  const gltf = await loadBeautifulGameSet();
  if (!gltf?.scene) throw new Error('A Beautiful Game board failed to load');
  return extractBeautifulGameAssets(gltf.scene, targetBoardSize, {
    source: 'remote',
    assetScale: 1
  });
}

async function loadKenneyAssets(targetBoardSize = RAW_BOARD_SIZE) {
  const [kenneyPieces, beautifulBoard] = await Promise.all([
    loadPieceSetFromUrlsStrict(KENNEY_SET_URLS, {
      targetBoardSize,
      styleId: 'kenneyWood',
      pieceStyle: KENNEY_WOOD_STYLE,
      assetScale: 1,
      name: 'Kenney chess set'
    }),
    resolveBeautifulGameBoardStrict(targetBoardSize)
  ]);

  const boardModel = beautifulBoard?.boardModel || null;
  if (!boardModel) throw new Error('A Beautiful Game board failed to load');

  const piecePrototypes = kenneyPieces?.piecePrototypes || null;
  if (!piecePrototypes) throw new Error('Kenney chess pieces failed to load');

  return { boardModel, piecePrototypes };
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

function detectColorFromMaterialNames(node) {
  const MATERIAL_W = /(\b|_)(ivory)(\b|_)/i;
  const MATERIAL_B = /(\b|_)(dark\s*ebony|ebony)(\b|_)/i;
  let detected = null;

  node.traverse((child) => {
    if (detected || !child?.isMesh) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const mat of materials) {
      const matName = (mat?.name || '').toString();
      if (MATERIAL_W.test(matName)) {
        detected = 'white';
        break;
      }
      if (MATERIAL_B.test(matName)) {
        detected = 'black';
        break;
      }
    }
  });

  return detected;
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
      clearcoat: 0,
      reflectivity: 0
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
      clearcoat: 0,
      reflectivity: 0
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
        clearcoat: 0,
        reflectivity: 0,
        specularIntensity: 0.18
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
  const accentLight = BEAUTIFUL_GAME_PIECE_STYLE.whiteAccent?.color ?? BEAUTIFUL_GAME_PIECE_STYLE.accent ?? '#d4af78';
  const accentDark = BEAUTIFUL_GAME_PIECE_STYLE.blackAccent ?? BEAUTIFUL_GAME_PIECE_STYLE.accent ?? accentLight;
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

  Object.entries(piecePrototypes).forEach(([, byColor]) => {
    Object.entries(byColor).forEach(([type, proto]) => {
      proto.userData = { ...(proto.userData || {}), __pieceStyleId: 'beautifulGame', __pieceType: type };
      proto.traverse((child) => {
        if (!child.isMesh) return;
        child.castShadow = true;
        child.receiveShadow = true;
        child.userData = { ...(child.userData || {}), __pieceStyleId: 'beautifulGame', __pieceType: type };
      });
    });
  });

  const boardBox = new THREE.Box3().setFromObject(boardModel);
  const boardTop = boardBox.max.y;

  return { boardModel, piecePrototypes, tileSize: tile, pieceYOffset: boardTop + 0.02 };
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
  const accentLight = pieceStyle.whiteAccent?.color ?? pieceStyle.accent ?? '#60a5fa';
  const accentDark = pieceStyle.blackAccent ?? pieceStyle.accent ?? accentLight;

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
  const accentLight = pieceStyle.whiteAccent?.color ?? pieceStyle.accent ?? '#d8b07a';
  const accentDark = pieceStyle.blackAccent ?? pieceStyle.accent ?? accentLight;

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
  const accentLight = pieceStyle.whiteAccent?.color ?? pieceStyle.accent ?? '#d0a472';
  const accentDark = pieceStyle.blackAccent ?? pieceStyle.accent ?? accentLight;
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
  const accentLight = pieceStyle.whiteAccent?.color ?? pieceStyle.accent ?? '#7ce3ff';
  const accentDark = pieceStyle.blackAccent ?? pieceStyle.accent ?? accentLight;
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

function buildBattleRoyalProceduralAssets(targetBoardSize = RAW_BOARD_SIZE) {
  const tile = Math.max(0.001, (targetBoardSize || RAW_BOARD_SIZE) / 8);
  const boardSize = tile * 8;
  const half = boardSize / 2;
  const boardGroup = new THREE.Group();
  const visualGroup = new THREE.Group();
  visualGroup.position.y = BOARD_VISUAL_Y_OFFSET;
  boardGroup.add(visualGroup);

  const light = new THREE.MeshStandardMaterial({ color: 0xc7b299, metalness: 0.1, roughness: 0.7 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x5e4529, metalness: 0.2, roughness: 0.6 });
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const isLight = (r + c) % 2 === 0;
      const tileMesh = new THREE.Mesh(new THREE.PlaneGeometry(tile, tile), isLight ? light : dark);
      tileMesh.rotation.x = -Math.PI / 2;
      tileMesh.position.set(-half + c * tile + tile / 2, 0.001, -half + r * tile + tile / 2);
      tileMesh.name = `tile_${r}_${c}`;
      tileMesh.userData = { r, c };
      tileMesh.receiveShadow = true;
      visualGroup.add(tileMesh);
    }
  }

  const border = new THREE.Mesh(
    new THREE.BoxGeometry(boardSize + tile * 0.2, tile * 0.08, boardSize + tile * 0.2),
    new THREE.MeshStandardMaterial({ color: 0x3a2f1f, metalness: 0.2, roughness: 0.7 })
  );
  border.position.y = -tile * 0.04;
  border.name = 'frame';
  border.receiveShadow = true;
  visualGroup.add(border);

  boardGroup.userData = { ...(boardGroup.userData || {}), proceduralAssets: true, styleId: 'proceduralBattle' };

  return {
    boardModel: boardGroup,
    piecePrototypes: { white: {}, black: {} },
    tileSize: tile,
    pieceYOffset: BOARD.baseH + PIECE_PLACEMENT_Y_OFFSET,
    userData: { proceduralAssets: true, styleId: 'proceduralBattle' }
  };
}

function normalizeBeautifulGamePiece(object, targetFootprint = BOARD.tile * PIECE_FOOTPRINT_RATIO) {
  const clone = cloneWithMaterials(object);
  clone.traverse((child) => {
    if (child?.isMesh) {
      child.castShadow = true;
      child.receiveShadow = false;
    }
  });
  const initialBox = new THREE.Box3().setFromObject(clone);
  const size = initialBox.getSize(new THREE.Vector3());
  const footprint = Math.max(size.x, size.z) || 1;
  const scale = targetFootprint / footprint;
  clone.scale.multiplyScalar(scale);
  const finalBox = new THREE.Box3().setFromObject(clone);
  clone.position.y -= finalBox.min.y;
  clone.userData = { ...(clone.userData || {}), __pieceStyleId: BEAUTIFUL_GAME_SWAP_SET_ID };
  return clone;
}

function buildBeautifulGameSwapPrototypes(scene, targetBoardSize) {
  const root = scene.clone(true);
  root.updateMatrixWorld(true);

  const tileSize = Math.max(0.001, (targetBoardSize || RAW_BOARD_SIZE) / 8);
  const targetFootprint = tileSize * PIECE_FOOTPRINT_RATIO;
  const prototypes = { white: {}, black: {} };

  const nodePath = (node) => {
    const names = [];
    let current = node;
    while (current) {
      if (current.name) names.push(current.name);
      current = current.parent;
    }
    return names.reverse().join('/');
  };

  const detectTypeFromPath = (path = '') => {
    const hints = [
      ['P', /(pawn)/i],
      ['R', /(rook|castle)/i],
      ['N', /(knight|horse)/i],
      ['B', /(bishop)/i],
      ['Q', /(queen)/i],
      ['K', /(king)/i]
    ];
    const target = path.toLowerCase();
    const hit = hints.find(([, regex]) => regex.test(target));
    return hit ? hit[0] : null;
  };

  const promoteToPieceRoot = (node, type) => {
    let current = node;
    while (current?.parent && detectTypeFromPath(nodePath(current.parent)) === type) {
      current = current.parent;
    }
    return current || node;
  };

  const buckets = {
    P: { w: [], b: [], any: [] },
    R: { w: [], b: [], any: [] },
    N: { w: [], b: [], any: [] },
    B: { w: [], b: [], any: [] },
    Q: { w: [], b: [], any: [] },
    K: { w: [], b: [], any: [] }
  };
  const NAME_W = /(^|[\W_])(white|ivory|light)([\W_]|$)/i;
  const NAME_B = /(^|[\W_])(black|ebony|dark)([\W_]|$)/i;
  const visited = new Set();

  root.traverse((node) => {
    const type = detectTypeFromPath(nodePath(node));
    if (!type) return;
    const ascended = promoteToPieceRoot(node, type);
    if (visited.has(ascended.uuid)) return;
    visited.add(ascended.uuid);
    const path = nodePath(ascended).toLowerCase();
    const bucket = buckets[type];
    const asWhite = NAME_W.test(path);
    const asBlack = NAME_B.test(path);
    const entry = { root: ascended };
    if (asWhite) bucket.w.push(entry);
    if (asBlack) bucket.b.push(entry);
    if (!asWhite && !asBlack) bucket.any.push(entry);
  });

  ['P', 'R', 'N', 'B', 'Q', 'K'].forEach((type) => {
    const bucket = buckets[type];
    const whiteSource = bucket.w[0]?.root || bucket.any[0]?.root || bucket.b[0]?.root;
    const blackSource = bucket.b[0]?.root || bucket.any[bucket.any.length - 1]?.root || bucket.w[0]?.root;
    if (whiteSource) prototypes.white[type] = normalizeBeautifulGamePiece(whiteSource, targetFootprint);
    if (blackSource) prototypes.black[type] = normalizeBeautifulGamePiece(blackSource, targetFootprint);
    if (!prototypes.white[type] && prototypes.black[type]) {
      prototypes.white[type] = normalizeBeautifulGamePiece(prototypes.black[type], targetFootprint);
    }
    if (!prototypes.black[type] && prototypes.white[type]) {
      prototypes.black[type] = normalizeBeautifulGamePiece(prototypes.white[type], targetFootprint);
    }
  });
  captureBeautifulGameGoldSignatures(prototypes);
  markBeautifulGameGoldMeshes(prototypes);

  return {
    boardModel: null,
    piecePrototypes: prototypes,
    tileSize,
    pieceYOffset: PIECE_PLACEMENT_Y_OFFSET,
    userData: { styleId: BEAUTIFUL_GAME_SWAP_SET_ID, preserveOriginalMaterials: true }
  };
}

async function loadGltfResilient(url, loader) {
  try {
    return await loader.loadAsync(url);
  } catch (primaryError) {
    try {
      const response = await fetch(url, { mode: 'cors' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = await response.arrayBuffer();
      return await new Promise((resolve, reject) => {
        loader.parse(buffer, url.substring(0, url.lastIndexOf('/') + 1), resolve, reject);
      });
    } catch (fallbackError) {
      throw primaryError || fallbackError;
    }
  }
}

async function loadBeautifulGamePiecesOnly(targetBoardSize) {
  const loader = createConfiguredGLTFLoader();
  const tried = new Set();
  let lastError = null;
  const urls = [...BEAUTIFUL_GAME_URLS, ...BEAUTIFUL_GAME_TOUCH_URLS];

  for (const raw of urls) {
    const resolved = new URL(raw, window.location.href).href;
    if (tried.has(resolved)) continue;
    tried.add(resolved);
    try {
      const gltf = await loadGltfResilient(resolved, loader);
      if (gltf?.scene) {
        return buildBeautifulGameSwapPrototypes(gltf.scene, targetBoardSize);
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) throw lastError;
  throw new Error('ABeautifulGame pieces unavailable');
}

async function resolveBeautifulGameAssets(targetBoardSize) {
  let boardAssets = null;
  try {
    boardAssets = await resolveBeautifulGameBoardStrict(targetBoardSize);
  } catch (error) {
    console.warn('Chess Battle Royal: GLTF board failed, trying swap pieces', error);
  }

  try {
    const swapAssets = await loadBeautifulGamePiecesOnly(targetBoardSize);
    if (boardAssets) {
      const { userData: boardUserData, tileSize, pieceYOffset, ...rest } = boardAssets;
      return {
        ...rest,
        boardModel: boardAssets.boardModel,
        tileSize: swapAssets?.tileSize ?? tileSize,
        pieceYOffset: pieceYOffset ?? swapAssets?.pieceYOffset,
        piecePrototypes: swapAssets?.piecePrototypes ?? boardAssets.piecePrototypes,
        userData: { ...(boardUserData || {}), ...(swapAssets?.userData || {}) }
      };
    }
    return swapAssets;
  } catch (error) {
    console.warn('Chess Battle Royal: GLTF swap pieces failed', error);
  }

  if (boardAssets) return boardAssets;

  throw new Error('Chess Battle Royal: failed to load ABeautifulGame assets');
}

async function resolveBeautifulGameTouchAssets(targetBoardSize) {
  const timeoutMs = 15000;
  const withTimeout = (promise) =>
    Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('ABeautifulGame touch load timed out')), timeoutMs)
      )
    ]);

  const gltf = await withTimeout(loadBeautifulGameTouchSet());
  if (!gltf?.scene) {
    throw new Error('ABeautifulGame touch edition failed to load');
  }

  const source = gltf.scene.userData?.beautifulGameSource;
  return extractBeautifulGameTouchAssets(gltf.scene, targetBoardSize, { source });
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

function cloneWithMaterials(object) {
  const clone = object.clone(true);
  clone.traverse((child) => {
    if (!child.isMesh) return;
    if (Array.isArray(child.material)) {
      child.material = child.material.map((mat) => (mat?.clone ? mat.clone() : mat));
    } else if (child.material?.clone) {
      child.material = child.material.clone();
    }
    child.castShadow = true;
    child.receiveShadow = false;
  });
  return clone;
}

function averageLuminance(root) {
  let sum = 0;
  let count = 0;
  root.traverse((node) => {
    if (!node.isMesh) return;
    const mats = Array.isArray(node.material) ? node.material : [node.material];
    mats.forEach((mat) => {
      if (!mat?.color) return;
      const { r, g, b } = mat.color;
      sum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
      count += 1;
    });
  });
  return count > 0 ? sum / count : 0.5;
}

function recolorObject(root, hex) {
  const color = new THREE.Color(hex);
  root.traverse((node) => {
    if (!node.isMesh) return;
    const mats = Array.isArray(node.material) ? node.material : [node.material];
    mats.forEach((mat) => {
      if (mat?.color) mat.color.copy(color);
      if (mat?.emissive) mat.emissive.set(0x000000);
    });
  });
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
    styleId = 'customPieces',
    assetScale = 1,
    name = 'ChessSet',
    pieceFootprintRatio,
    pieceYOffset
  } = options;
  if (!scene) return { boardModel: null, piecePrototypes: null };

  const root = scene.clone(true);
  root.traverse(applyMaterialSettingsWithSRGB);
  root.updateMatrixWorld(true);

  const TYPES = ['P', 'R', 'N', 'B', 'Q', 'K'];
  const TYPE_ALIASES = [
    ['p', /pawn/],
    ['r', /rook|castle/],
    ['n', /knight|horse/],
    ['b', /bishop/],
    ['q', /queen/],
    ['k', /king/]
  ];
  const COLOR_W = /(\b|_)(white|ivory|light)(\b|_)/i;
  const COLOR_B = /(\b|_)(black|ebony|dark)(\b|_)/i;

  const nodePath = (node) => {
    const names = [];
    let current = node;
    while (current) {
      if (current.name) names.push(current.name);
      current = current.parent;
    }
    return names.reverse().join('/');
  };

  const detectTypeFromPath = (path) => {
    const lower = (path || '').toLowerCase();
    for (const [t, regex] of TYPE_ALIASES) {
      if (regex.test(lower)) return t.toUpperCase();
    }
    return pieceTypeFromName(path) || null;
  };

  const detectColorFromPath = (path, node) => {
    const explicit = detectPieceColor(node);
    if (explicit) return explicit;
    const matTagged = detectColorFromMaterialNames(node);
    if (matTagged) return matTagged;
    if (COLOR_W.test(path)) return 'white';
    if (COLOR_B.test(path)) return 'black';
    const L = averageLuminance(node);
    return L >= 0.45 ? 'white' : 'black';
  };

  const promotePieceRoot = (node, type) => {
    let current = node;
    let parent = current?.parent;
    while (parent) {
      const parentType = detectTypeFromPath(nodePath(parent));
      if (parentType === type) {
        current = parent;
        parent = current.parent;
      } else {
        break;
      }
    }
    return current;
  };

  const proto = { white: {}, black: {} };
  const visited = new Set();

  root.traverse((node) => {
    if (!node) return;
    const type = detectTypeFromPath(nodePath(node));
    if (!type) return;
    const color = detectColorFromPath(nodePath(node), node);
    if (!color || proto[color][type]) return;
    const promoted = promotePieceRoot(node, type);
    if (visited.has(promoted.uuid)) return;
    visited.add(promoted.uuid);
    proto[color][type] = promoted;
  });

  TYPES.forEach((type) => {
    const w = proto.white[type];
    const b = proto.black[type];
    if (!w && b) proto.white[type] = b;
    if (!b && w) proto.black[type] = w;
  });

  const boards = [];
  root.traverse((node) => {
    const n = (node?.name || '').toLowerCase();
    if (/board|chessboard|table/.test(n)) boards.push(node);
  });
  const boardNode = boards[0] || root;
  const boardModel = cloneWithMaterials(boardNode);
  boardModel.name = name;
  boardModel.traverse((node) => {
    if (node.isMesh) {
      node.receiveShadow = true;
      node.castShadow = false;
    }
    const path = nodePath(node);
    if (detectTypeFromPath(path)) node.visible = false;
  });
  boardModel.updateMatrixWorld(true);

  const boardSizeBox = new THREE.Box3().setFromObject(boardModel);
  const boardSize = boardSizeBox.getSize(new THREE.Vector3());
  const largest = Math.max(boardSize.x || 1, boardSize.z || 1);
  const targetSize = Math.max(targetBoardSize || RAW_BOARD_SIZE, 0.001);
  const totalScale = (targetSize / largest) * assetScale;
  boardModel.scale.setScalar(totalScale);
  const scaledBox = new THREE.Box3().setFromObject(boardModel);
  const boardCenter = new THREE.Vector3();
  scaledBox.getCenter(boardCenter);
  boardModel.position.set(
    -boardCenter.x,
    -scaledBox.min.y + (BOARD.baseH + 0.02 + BOARD_MODEL_Y_OFFSET),
    -boardCenter.z
  );

  const boardBox = new THREE.Box3().setFromObject(boardModel);
  const boardTop = boardBox.max.y;
  const tileSize = Math.max(0.001, targetSize / 8);
  const footprintRatio = Number.isFinite(pieceFootprintRatio)
    ? pieceFootprintRatio
    : PIECE_FOOTPRINT_RATIO;
  const preferredPieceYOffset = Number.isFinite(pieceYOffset)
    ? pieceYOffset
    : Math.max(boardTop + PIECE_PLACEMENT_Y_OFFSET, PIECE_PLACEMENT_Y_OFFSET);

  const normalizeAndSeatClone = (source) => {
    const clone = source.clone(true);
    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = false;
      }
    });
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const footprint = Math.max(size.x, size.z) || 1;
    const targetFootprint = tileSize * footprintRatio;
    const scale = targetFootprint / footprint;
    clone.scale.multiplyScalar(scale);
    const scaledBox = new THREE.Box3().setFromObject(clone);
    const lift = -scaledBox.min.y;
    clone.position.y += lift;
    const holder = new THREE.Group();
    holder.add(clone);
    holder.position.y = preferredPieceYOffset;
    return holder;
  };

  const piecePrototypes = { white: {}, black: {} };
  TYPES.forEach((type) => {
    const srcW = proto.white[type];
    const srcB = proto.black[type];
    if (srcW) {
      const holder = normalizeAndSeatClone(srcW);
      holder.userData = {
        ...(holder.userData || {}),
        __pieceStyleId: styleId,
        __pieceType: type,
        __pieceColor: 'white'
      };
      piecePrototypes.white[type] = holder;
    }
    if (srcB) {
      const holder = normalizeAndSeatClone(srcB);
      holder.userData = {
        ...(holder.userData || {}),
        __pieceStyleId: styleId,
        __pieceType: type,
        __pieceColor: 'black'
      };
      piecePrototypes.black[type] = holder;
    }
  });

  return { boardModel, piecePrototypes, tileSize, pieceYOffset: preferredPieceYOffset };
}

function extractBeautifulGameAssets(scene, targetBoardSize, options = {}) {
  const assetScale = options?.assetScale ?? BEAUTIFUL_GAME_ASSET_SCALE;
  const authenticStyle =
    BEAUTIFUL_GAME_COLOR_VARIANTS.find((variant) => variant.id === BEAUTIFUL_GAME_AUTHENTIC_ID)?.style ||
    BEAUTIFUL_GAME_PIECE_STYLE;
  const assets = extractChessSetAssets(scene, {
    targetBoardSize,
    pieceStyle: authenticStyle,
    styleId: 'beautifulGame',
    assetScale,
    name: 'ABeautifulGame',
    pieceFootprintRatio: BEAUTIFUL_GAME_FOOTPRINT_RATIO
  });
  captureBeautifulGameGoldSignatures(assets?.piecePrototypes);
  markBeautifulGameGoldMeshes(assets?.piecePrototypes);
  if (assets.boardModel) {
    assets.boardModel.scale.multiplyScalar(BEAUTIFUL_GAME_BOARD_SCALE_BIAS);
    let finalBox = new THREE.Box3().setFromObject(assets.boardModel);
    const boardCenter = new THREE.Vector3();
    finalBox.getCenter(boardCenter);
    assets.boardModel.position.set(
      -boardCenter.x,
      -finalBox.min.y + (BOARD.baseH + 0.02 + BOARD_MODEL_Y_OFFSET),
      -boardCenter.z
    );
    finalBox = new THREE.Box3().setFromObject(assets.boardModel);
    const boardTop = finalBox.max.y;
    assets.pieceYOffset = Math.max(boardTop + 0.04, PIECE_PLACEMENT_Y_OFFSET);
  }
  harmonizeBeautifulGamePieces(assets.piecePrototypes, authenticStyle);
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
  const tileSize = Math.max(0.001, targetSize / 8);
  const totalScale = targetSize / largest;
  boardModel.scale.multiplyScalar(totalScale * BEAUTIFUL_GAME_BOARD_SCALE_BIAS);
  const scaledBox = new THREE.Box3().setFromObject(boardModel);
  const boardCenter = new THREE.Vector3();
  scaledBox.getCenter(boardCenter);
  boardModel.position.set(
    -boardCenter.x,
    -scaledBox.min.y + (BOARD.baseH + 0.02 + BOARD_MODEL_Y_OFFSET),
    -boardCenter.z
  );
  boardModel.name = 'ABeautifulGameTouch';
  const finalBox = new THREE.Box3().setFromObject(boardModel);
  const boardTop = finalBox.max.y;

  const piecePrototypes = { white: {}, black: {} };
  const fallbackTile = Math.max(0.001, targetSize / 8);
  const buildPrototype = (colorKey, type) => {
    const source = colorKey === 'black' ? pool.black[type] : pool.white[type];
    const opposite = colorKey === 'black' ? pool.white[type] : pool.black[type];
    const anyFromColor = Object.values(colorKey === 'black' ? pool.black : pool.white).find(Boolean);
    const anyFromOther = Object.values(colorKey === 'black' ? pool.white : pool.black).find(Boolean);
    const base = source || opposite || anyFromColor || anyFromOther;
    if (base) {
      const proto = cloneWithMaterials(base);
      proto.traverse(applyMaterialSettingsWithSRGB);
      if (!source && opposite) {
        recolorObject(proto, colorKey === 'black' ? 0x1a1c21 : 0xe9ebef);
      }
      proto.scale.multiplyScalar(totalScale);
      const protoBox = new THREE.Box3().setFromObject(proto);
      const protoCenter = protoBox.getCenter(new THREE.Vector3());
      proto.position.sub(protoCenter);
      proto.position.y -= protoBox.min.y;
      proto.userData = {
        ...(proto.userData || {}),
        __pieceStyleId: DEFAULT_PIECE_SET_ID,
        __pieceColor: colorKey,
        __pieceType: type
      };
      return proto;
    }
    const fallback = buildBeautifulGamePiece(
      type,
      colorKey === 'black' ? '#1a1c21' : '#e9ebef',
      colorKey === 'black' ? '#caa472' : '#caa472',
      fallbackTile / 0.9
    );
    fallback.userData = {
      ...(fallback.userData || {}),
      __pieceStyleId: DEFAULT_PIECE_SET_ID,
      __pieceColor: colorKey,
      __pieceType: type
    };
    return fallback;
  };

  ['P', 'R', 'N', 'B', 'Q', 'K'].forEach((type) => {
    piecePrototypes.white[type] = buildPrototype('white', type);
    piecePrototypes.black[type] = buildPrototype('black', type);
  });

  const assets = {
    boardModel,
    piecePrototypes,
    tileSize,
    pieceYOffset: boardTop + 0.02
  };
  harmonizeBeautifulGamePieces(assets.piecePrototypes);
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
  const whiteConfig = { ...(option.white || {}) };
  const blackConfig = { ...(option.black || {}) };

  const whiteAccentColor = option.whiteAccent?.color ?? option.accent ?? whiteConfig.color;
  const blackAccentColor = option.blackAccent?.color ?? option.accent ?? blackConfig.color;

  const whiteBase = createPhysicalPieceMaterial(whiteConfig, '#f5f5f7');
  const whiteAccent = whiteAccentColor && whiteAccentColor !== whiteConfig.color
    ? createPhysicalPieceMaterial({ ...whiteConfig, ...option.whiteAccent, color: whiteAccentColor }, whiteConfig.color)
    : whiteBase;

  const blackBase = createPhysicalPieceMaterial(blackConfig, '#3c4044');
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
// Standard starting position with black at the top and white at the bottom.
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
        row.push({ t: ch.toUpperCase(), w: isWhite, hasMoved: false });
      }
      i++;
    }
    board.push(row);
  }
  return board;
}

function boardToFEN(board, whiteToMove = true) {
  const rows = [];
  for (let r = 0; r < 8; r += 1) {
    let row = '';
    let empty = 0;
    for (let c = 0; c < 8; c += 1) {
      const piece = board?.[r]?.[c];
      if (!piece) {
        empty += 1;
        continue;
      }
      if (empty) {
        row += String(empty);
        empty = 0;
      }
      const symbol = piece.t || 'P';
      row += piece.w ? symbol.toUpperCase() : symbol.toLowerCase();
    }
    if (empty) row += String(empty);
    rows.push(row || '8');
  }
  return `${rows.join('/')}${whiteToMove ? ' w' : ' b'} - - 0 1`;
}

function cloneBoard(b) {
  return b.map((r) => r.map((c) => (c ? { t: c.t, w: c.w, hasMoved: Boolean(c.hasMoved) } : null)));
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
  if (piece && typeof piece.hasMoved !== 'boolean') piece.hasMoved = false;
  const captured = board[toR][toC];
  const isCastling = piece && piece.t === 'K' && Math.abs(toC - fromC) === 2;
  let castleSnapshot = null;
  const previousMovedFlag = piece?.hasMoved;

  const moveRookForCastle = (rookFromC, rookToC) => {
    const rookPiece = board[fromR][rookFromC];
    if (!rookPiece) return;
    if (typeof rookPiece.hasMoved !== 'boolean') rookPiece.hasMoved = false;
    castleSnapshot = {
      rookFromC,
      rookToC,
      rookPiece,
      rookMovedFlag: rookPiece.hasMoved
    };
    board[fromR][rookToC] = rookPiece;
    board[fromR][rookFromC] = null;
    rookPiece.hasMoved = true;
  };

  if (isCastling) {
    if (toC > fromC) moveRookForCastle(7, 5);
    else moveRookForCastle(0, 3);
  }

  board[toR][toC] = piece;
  board[fromR][fromC] = null;
  if (piece) piece.hasMoved = true;
  let promoted = false;
  let previousType = piece ? piece.t : null;
  if (piece && piece.t === 'P' && (toR === 0 || toR === 7)) {
    piece.t = 'Q';
    promoted = true;
  }
  return { captured, promoted, previousType, castle: castleSnapshot, pieceMovedFlag: previousMovedFlag };
}

function revertMove(board, fromR, fromC, toR, toC, snapshot) {
  const piece = board[toR][toC];
  if (snapshot?.castle?.rookPiece) {
    const { rookFromC, rookToC, rookPiece, rookMovedFlag } = snapshot.castle;
    board[fromR][rookFromC] = rookPiece;
    board[fromR][rookToC] = null;
    if (rookPiece) rookPiece.hasMoved = rookMovedFlag;
  }
  board[fromR][fromC] = piece;
  board[toR][toC] = snapshot.captured ?? null;
  if (snapshot.promoted && piece) {
    piece.t = snapshot.previousType;
  }
  if (piece) piece.hasMoved = snapshot.pieceMovedFlag ?? piece.hasMoved;
}

function isPlayerInCheck(board, whiteTurn) {
  const king = findKing(board, whiteTurn);
  if (!king) return false;
  return isSquareAttacked(board, king[0], king[1], !whiteTurn);
}

function getCastlingTargets(board, r, c, isWhiteTurn) {
  const piece = board[r][c];
  if (!piece || piece.t !== 'K' || piece.w !== isWhiteTurn) return [];
  if (piece.hasMoved) return [];
  const homeRow = isWhiteTurn ? 7 : 0;
  if (r !== homeRow || c !== 4) return [];
  if (isSquareAttacked(board, r, c, !isWhiteTurn)) return [];

  const results = [];
  const checkSide = (rookCol, emptyCols, transitCols, destCol) => {
    const rook = board[homeRow][rookCol];
    if (!rook || rook.t !== 'R' || rook.w !== isWhiteTurn || rook.hasMoved) return;
    if (emptyCols.some((col) => board[homeRow][col])) return;
    if (transitCols.some((col) => isSquareAttacked(board, homeRow, col, !isWhiteTurn))) return;
    results.push([homeRow, destCol]);
  };

  checkSide(7, [5, 6], [5, 6], 6);
  checkSide(0, [1, 2, 3], [3, 2], 2);
  return results;
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
      if (!onlyCaptures && piece.t === 'K') {
        pseudo.push(...getCastlingTargets(board, r, c, whiteTurn));
      }
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

function bestAIMove(board, aiPlaysWhite, depth = 4) {
  const moves = generateMoves(board, aiPlaysWhite);
  if (!moves.length) return null;
  orderMoves(moves);
  const searchDepth = moves.length <= 10 ? depth + 1 : depth;
  let bestMove = null;
  let bestScore = aiPlaysWhite ? -Infinity : Infinity;
  for (const move of moves) {
    const snapshot = applyMove(board, move.fromR, move.fromC, move.toR, move.toC);
    const score = minimax(board, searchDepth - 1, !aiPlaysWhite, -Infinity, Infinity, 1);
    revertMove(board, move.fromR, move.fromC, move.toR, move.toC, snapshot);
    if (aiPlaysWhite ? score > bestScore : score < bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }
  return bestMove;
}

const formatTime = (t) =>
  `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;

// ======================= Main Component =======================
function Chess3D({
  avatar,
  username,
  initialFlag,
  initialAiFlag,
  accountId,
  initialTableId,
  initialSide,
  initialOpponent
}) {
  const wrapRef = useRef(null);
  const normalizedInitialSide = initialSide === 'black' ? 'black' : 'white';
  const aiPlaysWhite = normalizedInitialSide === 'black';
  const onlineRef = useRef({
    enabled: Boolean(accountId && initialTableId),
    tableId: null,
    side: normalizedInitialSide,
    synced: false,
    opponent: null,
    emitMove: () => {},
    requestSync: () => {},
    status: 'connecting'
  });
  onlineRef.current.enabled = Boolean(accountId && initialTableId);
  const rafRef = useRef(0);
  const timerRef = useRef(null);
  const bombSoundRef = useRef(null);
  const timerSoundRef = useRef(null);
  const moveSoundRef = useRef(null);
  const checkSoundRef = useRef(null);
  const mateSoundRef = useRef(null);
  const laughSoundRef = useRef(null);
  const swordSoundRef = useRef(null);
  const droneSoundRef = useRef(null);
  const helicopterSoundRef = useRef(null);
  const missileLaunchSoundRef = useRef(null);
  const missileImpactSoundRef = useRef(null);
  const audioStopTimeoutsRef = useRef(new Map());
  const lastBeepRef = useRef({ white: null, black: null });
  const suppressTimerBeepUntilRef = useRef(0);
  const controlsRef = useRef(null);
  const fitRef = useRef(() => {});
  const arenaRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const envTextureRef = useRef(null);
  const envSkyboxRef = useRef(null);
  const envSkyboxTextureRef = useRef(null);
  const disposeEnvironmentRef = useRef(null);
  const baseCameraRadiusRef = useRef(1);
  const baseSkyboxScaleRef = useRef(1);
  const lastCameraRadiusRef = useRef(null);
  const updateEnvironmentRef = useRef(() => {});
  const hdriVariantRef = useRef(DEFAULT_HDRI_VARIANT);
  const environmentFloorRef = useRef(0);
  const environmentShadowCatcherRef = useRef(null);
  const clearHighlightsRef = useRef(() => {});
  const cameraViewRef = useRef(null);
  const viewModeRef = useRef('2d');
  const cameraTweenRef = useRef(0);
  const initial2dViewRef = useRef(null);
  const settingsRef = useRef({ showHighlights: true, soundEnabled: true, moveMode: 'click' });
  const renderSettingsRef = useRef({
    targetFrameIntervalMs: 1000 / DEFAULT_TARGET_FPS,
    renderResolutionScale: 1,
    pixelRatioCap: DEFAULT_RENDER_PIXEL_RATIO_CAP,
    pixelRatioScale: RENDER_PIXEL_RATIO_SCALE
  });
  const aiMovingRef = useRef(false);
  const boardMaterialCacheRef = useRef({ gltf: new Map(), procedural: null });
  const pawnHeadMaterialCacheRef = useRef(new Map());
  const rankSwapAppliedRef = useRef(false);
  const [appearance, setAppearance] = useState(() => {
    if (typeof window === 'undefined') return { ...DEFAULT_APPEARANCE };
    try {
      const stored = window.localStorage?.getItem(APPEARANCE_STORAGE_KEY);
      if (stored) {
        const normalized = normalizeAppearance(JSON.parse(stored));
        return normalized;
      }
    } catch {}
    return { ...DEFAULT_APPEARANCE };
  });
  const appearanceRef = useRef(appearance);
  const paletteRef = useRef(createChessPalette(appearance));
  const [activeCustomizationKey, setActiveCustomizationKey] = useState(
    CUSTOMIZATION_SECTIONS[0]?.key ?? 'tables'
  );
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
  const [onlineStatus, setOnlineStatus] = useState(
    onlineRef.current.enabled ? 'connecting' : 'offline'
  );
  useEffect(() => {
    if (accountId) {
      setOnlineStatus((prev) => (prev === 'offline' ? 'connecting' : prev));
    }
  }, [accountId]);
  useEffect(() => {
    const handler = () => setIsMuted(isGameMuted());
    window.addEventListener('gameMuteChanged', handler);
    return () => window.removeEventListener('gameMuteChanged', handler);
  }, []);
  const [tableId, setTableId] = useState('');
  const [opponent, setOpponent] = useState(null);
  useEffect(() => {
    const enabled = Boolean(accountId && (tableId || initialTableId));
    onlineRef.current.enabled = enabled;
    if (!enabled && onlineStatus !== 'offline') {
      setOnlineStatus('offline');
    }
  }, [accountId, initialTableId, onlineStatus, tableId]);
  useEffect(() => {
    if (initialOpponent) {
      setOpponent(initialOpponent);
      onlineRef.current.opponent = initialOpponent;
    }
  }, [initialOpponent]);
  const resolvedAccountId = useMemo(() => chessBattleAccountId(accountId), [accountId]);
  const [inventoryVersion, setInventoryVersion] = useState(0);
  const chessInventory = useMemo(
    () => getChessBattleInventory(resolvedAccountId),
    [resolvedAccountId, inventoryVersion]
  );
  useEffect(() => {
    const handler = (event) => {
      if (!event?.detail?.accountId || event.detail.accountId === resolvedAccountId) {
        setInventoryVersion((value) => value + 1);
      }
    };
    window.addEventListener('chessBattleInventoryUpdate', handler);
    return () => window.removeEventListener('chessBattleInventoryUpdate', handler);
  }, [resolvedAccountId]);
  const [p1QuickIdx, setP1QuickIdx] = useState(2);
  const [p2QuickIdx, setP2QuickIdx] = useState(3);
  const [headQuickIdx, setHeadQuickIdx] = useState(0);
  const [boardQuickIdx, setBoardQuickIdx] = useState(0);
  const [whiteTime, setWhiteTime] = useState(60);
  const [blackTime, setBlackTime] = useState(5);
  const whiteTimeRef = useRef(whiteTime);
  const blackTimeRef = useRef(blackTime);
  const initialWhiteTimeRef = useRef(60);
  const initialBlackTimeRef = useRef(5);
  const [configOpen, setConfigOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [commentaryPresetId, setCommentaryPresetId] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_COMMENTARY_PRESET_ID;
    try {
      const stored = window.localStorage?.getItem(COMMENTARY_PRESET_STORAGE_KEY);
      if (stored && CHESS_BATTLE_COMMENTARY_PRESETS.some((preset) => preset.id === stored)) {
        return stored;
      }
    } catch {}
    return DEFAULT_COMMENTARY_PRESET_ID;
  });
  const [commentaryMuted, setCommentaryMuted] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage?.getItem(COMMENTARY_MUTE_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [isMuted, setIsMuted] = useState(() => isGameMuted());
  const effectiveSoundEnabled = soundEnabled && !isMuted;
  const [commentarySupported, setCommentarySupported] = useState(() => getSpeechSupport());
  const commentaryMutedRef = useRef(commentaryMuted);
  const commentaryReadyRef = useRef(false);
  const commentaryQueueRef = useRef([]);
  const commentarySpeakingRef = useRef(false);
  const commentaryLastEventAtRef = useRef(0);
  const pendingCommentaryLinesRef = useRef(null);
  const commentaryIntroPlayedRef = useRef(false);
  const commentaryOutroPlayedRef = useRef(false);
  const commentarySpeakerIndexRef = useRef(0);
  const commentaryPresetRef = useRef(null);
  const playersRef = useRef([]);
  const moveCountRef = useRef(0);
  const [showHighlights, setShowHighlights] = useState(true);
  const [graphicsId, setGraphicsId] = useState(() => {
    const fallback = resolveDefaultGraphicsId();
    if (typeof window === 'undefined') return fallback;
    try {
      const stored = window.localStorage?.getItem(GRAPHICS_STORAGE_KEY);
      if (stored && GRAPHICS_OPTIONS.some((opt) => opt.id === stored)) return stored;
    } catch {}
    return fallback;
  });
  const [moveMode, setMoveMode] = useState('click');
  const [seatAnchors, setSeatAnchors] = useState([]);
  const [viewMode, setViewMode] = useState('2d');
  const [canReplay, setCanReplay] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showGift, setShowGift] = useState(false);
  const [chatBubbles, setChatBubbles] = useState([]);
  const [ui, setUi] = useState({
    turnWhite: true,
    status: 'White to move',
    promoting: null,
    winner: null
  });
  const uiRef = useRef(ui);
  const lastMoveRef = useRef(null);
  const replayLastMoveRef = useRef(() => {});
  const isReplayingRef = useRef(false);
  const activeGraphicsOption = useMemo(
    () =>
      GRAPHICS_OPTIONS.find((opt) => opt.id === graphicsId) ||
      GRAPHICS_OPTIONS.find((opt) => opt.id === DEFAULT_GRAPHICS_ID) ||
      GRAPHICS_OPTIONS[0],
    [graphicsId]
  );
  const activeCommentaryPreset = useMemo(
    () =>
      CHESS_BATTLE_COMMENTARY_PRESETS.find((preset) => preset.id === commentaryPresetId) ||
      CHESS_BATTLE_COMMENTARY_PRESETS[0],
    [commentaryPresetId]
  );
  useEffect(() => {
    const updateSupport = () => setCommentarySupported(getSpeechSupport());
    updateSupport();
    const unsubscribe = onSpeechSupportChange((supported) => setCommentarySupported(Boolean(supported)));
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    uiRef.current = ui;
  }, [ui]);

  useEffect(() => {
    commentaryMutedRef.current = commentaryMuted;
    if (commentaryMuted) {
      commentaryQueueRef.current = [];
      commentarySpeakingRef.current = false;
      pendingCommentaryLinesRef.current = null;
    }
  }, [commentaryMuted]);

  useEffect(() => {
    commentaryPresetRef.current = activeCommentaryPreset;
  }, [activeCommentaryPreset]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage?.setItem(COMMENTARY_PRESET_STORAGE_KEY, commentaryPresetId);
    } catch {}
  }, [commentaryPresetId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage?.setItem(COMMENTARY_MUTE_STORAGE_KEY, commentaryMuted ? '1' : '0');
    } catch {}
  }, [commentaryMuted]);

  useEffect(() => {
    if (!onlineRef.current.enabled || !accountId) {
      setOnlineStatus('offline');
      return undefined;
    }
    let active = true;
    const cleanups = [];
    const tableJoin = { current: initialTableId || '' };
    onlineRef.current.side = normalizedInitialSide;

    const handleChessState = (payload = {}) => {
      if (!active) return;
      if (payload.tableId && tableJoin.current && payload.tableId !== tableJoin.current)
        return;
      onlineRef.current.synced = true;
      if (onlineRef.current.status !== 'started') onlineRef.current.status = 'in-progress';
      setOnlineStatus('in-game');
      onlineRef.current.applyRemoteMove?.(payload);
    };

    const handleGameStart = ({ tableId: startedId, players = [] } = {}) => {
      if (!startedId || startedId !== tableJoin.current) return;
      const meIndex = players.findIndex((p) => String(p.id) === String(accountId));
      const opp = players.find((p) => String(p.id) !== String(accountId));
      if (opp) setOpponent(opp);
      const mySide =
        players.find((p) => String(p.id) === String(accountId))?.side ||
        (meIndex === 0 ? 'white' : 'black');
      onlineRef.current.side = mySide;
      onlineRef.current.status = 'started';
      setOnlineStatus('starting');
      socket.emit('joinChessRoom', { tableId: startedId, accountId });
      onlineRef.current.requestSync?.();
    };

    onlineRef.current.emitMove = ({ tableId: tid, move }) => {
      const target = tid || onlineRef.current.tableId;
      if (!target || !move) return;
      socket.emit('chessMove', { tableId: target, move });
    };
    onlineRef.current.requestSync = () => {
      const target = onlineRef.current.tableId;
      if (!target) return;
      socket.emit('chessSyncRequest', { tableId: target });
    };

    socket.on('gameStart', handleGameStart);
    socket.on('chessState', handleChessState);
    socket.on('chessMove', handleChessState);

    cleanups.push(() => {
      socket.off('gameStart', handleGameStart);
      socket.off('chessState', handleChessState);
      socket.off('chessMove', handleChessState);
      if (tableJoin.current)
        socket.emit('leaveLobby', { accountId, tableId: tableJoin.current });
    });

    const joinExistingTable = (tableIdToJoin) => {
      setTableId(tableIdToJoin);
      tableJoin.current = tableIdToJoin;
      onlineRef.current.tableId = tableIdToJoin;
      setOnlineStatus('starting');
      socket.emit('joinChessRoom', { tableId: tableIdToJoin, accountId });
      onlineRef.current.requestSync?.();
    };

    socket.emit('register', { playerId: accountId });

    if (initialTableId) {
      joinExistingTable(initialTableId);
    } else {
      socket.emit(
        'seatTable',
        {
          accountId,
          gameType: 'chess',
          stake: 0,
          maxPlayers: 2,
          playerName: username,
          avatar,
          preferredSide: preferredSideParam
        },
        (res) => {
          if (!active) return;
          if (res?.tableId) {
            joinExistingTable(res.tableId);
            setOnlineStatus('matched');
            socket.emit('confirmReady', { accountId, tableId: res.tableId });
          }
        }
      );
    }

    return () => {
      active = false;
      cleanups.forEach((fn) => fn());
    };
  }, [accountId, avatar, initialTableId, normalizedInitialSide, username]);

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

  useEffect(() => {
    setMoveMode('click');
  }, [viewMode]);

  const customizationSections = useMemo(
    () => {
      const selectedTableTheme = TABLE_THEME_OPTIONS[appearance.tables] ?? TABLE_THEME_OPTIONS[0];
      const showTableMaterialOptions = SHAPE_CUSTOMIZATION_TABLE_IDS.has(selectedTableTheme?.id);
      return CUSTOMIZATION_SECTIONS
        .filter((section) => {
          if (section.key === 'tableCloth' || section.key === 'tableFinish') {
            return showTableMaterialOptions;
          }
          return true;
        })
        .map((section) => ({
          ...section,
          options: section.options
            .map((option, idx) => ({ ...option, idx }))
            .filter((option) => {
              if (section.key === 'tables') return isChessOptionUnlocked(section.key, option.id, chessInventory);
              if (section.key === 'tableCloth') return true;
              return isChessOptionUnlocked(section.key, option.id, chessInventory);
            })
        }))
        .filter((section) => section.options.length > 0);
    },
    [appearance.tables, chessInventory]
  );

  const quickSideOptions = useMemo(
    () =>
      QUICK_SIDE_COLORS.map((option, idx) => ({ ...option, idx })).filter(({ id }) =>
        isChessOptionUnlocked('sideColor', id, chessInventory)
      ),
    [chessInventory]
  );

  const quickBoardOptions = useMemo(
    () =>
      QUICK_BOARD_THEMES.map((option, idx) => ({ ...option, idx })).filter(({ id }) =>
        isChessOptionUnlocked('boardTheme', id, chessInventory)
      ),
    [chessInventory]
  );

  const quickHeadOptions = useMemo(
    () =>
      QUICK_HEAD_PRESETS.map((option, idx) => ({ ...option, idx })).filter(({ id }) =>
        isChessOptionUnlocked('headStyle', id, chessInventory)
      ),
    [chessInventory]
  );

  const clampQuickSelection = useCallback((currentIdx, list, fallback = 0) => {
    if (list.some((entry) => entry.idx === currentIdx)) return currentIdx;
    return list[0]?.idx ?? fallback;
  }, []);

  useEffect(() => {
    setP1QuickIdx((prev) => clampQuickSelection(prev, quickSideOptions));
    setP2QuickIdx((prev) => clampQuickSelection(prev, quickSideOptions, quickSideOptions[1]?.idx ?? 0));
    setHeadQuickIdx((prev) => clampQuickSelection(prev, quickHeadOptions));
    setBoardQuickIdx((prev) => clampQuickSelection(prev, quickBoardOptions));
  }, [clampQuickSelection, quickBoardOptions, quickHeadOptions, quickSideOptions]);

  const ensureAppearanceUnlocked = useCallback(
    (value = DEFAULT_APPEARANCE) => {
      const normalized = normalizeAppearance(value);
      const map = {
        tables: TABLE_THEME_OPTIONS,
        tableCloth: TABLE_CLOTH_OPTIONS,
        tableFinish: TABLE_FINISH_OPTIONS,
        chairColor: CHAIR_COLOR_OPTIONS,
        environmentHdri: CHESS_HDRI_OPTIONS
      };
      let changed = false;
      const next = { ...normalized };
      Object.entries(map).forEach(([key, options]) => {
        const idx = Number.isFinite(next[key]) ? next[key] : 0;
        const option = options[idx];
        const isUnlocked = (opt) => {
          if (!opt) return false;
          if (key === 'tables') return isChessOptionUnlocked(key, opt.id, chessInventory);
          if (key === 'tableCloth') return true;
          return isChessOptionUnlocked(key, opt.id, chessInventory);
        };
        if (!option || !isUnlocked(option)) {
          const fallbackIdx = options.findIndex((opt) => isUnlocked(opt));
          const safeIdx = fallbackIdx >= 0 ? fallbackIdx : 0;
          if (safeIdx !== idx) {
            next[key] = safeIdx;
            changed = true;
          }
        }
      });
      return changed ? next : normalized;
    },
    [chessInventory]
  );

  useEffect(() => {
    setAppearance((prev) => ensureAppearanceUnlocked(prev));
  }, [ensureAppearanceUnlocked]);

  const renderCustomizationPreview = useCallback((key, option) => {
    if (!option) return null;
    const baseClass =
      'relative h-16 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950/60';
    const overlay =
      'absolute inset-0 bg-gradient-to-tr from-white/5 via-transparent to-black/50';
    if (key === 'tables') {
      return (
        <div className={baseClass}>
          {option.thumbnail ? (
            <img
              src={option.thumbnail}
              alt={option.label || 'Table model'}
              className="absolute inset-0 h-full w-full object-cover opacity-85"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-[0.65rem] font-semibold text-white/80">
              {option.label || 'Table'}
            </div>
          )}
          <div className={overlay} />
        </div>
      );
    }
    if (key === 'tableFinish') {
      const swatches = Array.isArray(option.swatches) && option.swatches.length >= 2
        ? option.swatches
        : [option.swatches?.[0] || '#7c5e45', option.swatches?.[1] || '#3f2e23'];
      return (
        <div className={baseClass}>
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(135deg, ${swatches[0]}, ${swatches[1]})` }}
          />
          <div className={overlay} />
        </div>
      );
    }
    if (key === 'tableCloth') {
      const top = option.feltTop || '#0f6a2f';
      const bottom = option.feltBottom || top;
      return (
        <div className={baseClass}>
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(140deg, ${top}, ${bottom})` }}
          />
          <div className={overlay} />
        </div>
      );
    }
    if (key === 'chairColor') {
      const primary = option.primary || '#1f2937';
      const accent = option.accent || option.highlight || '#38bdf8';
      return (
        <div className={baseClass}>
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(135deg, ${primary} 40%, ${accent})` }}
          />
          <div className={overlay} />
        </div>
      );
    }
    if (key === 'environmentHdri') {
      const swatches = Array.isArray(option.swatches) && option.swatches.length >= 2
        ? option.swatches
        : [option.swatches?.[0] || '#0ea5e9', '#0f172a'];
      return (
        <div className={baseClass}>
          {option.thumbnail ? (
            <img
              src={option.thumbnail}
              alt={option.label || 'HDR environment'}
              className="absolute inset-0 h-full w-full object-cover opacity-85"
              loading="lazy"
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{ background: `linear-gradient(135deg, ${swatches[0]}, ${swatches[1]})` }}
            />
          )}
          <div className={overlay} />
        </div>
      );
    }
    return (
      <div className={baseClass}>
        <div className="absolute inset-0 flex items-center justify-center text-[0.65rem] font-semibold text-white/80">
          {option.label || 'Option'}
        </div>
        <div className={overlay} />
      </div>
    );
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

  useEffect(() => {
    if (!customizationSections.some((section) => section.key === activeCustomizationKey)) {
      setActiveCustomizationKey(customizationSections[0]?.key ?? 'tables');
    }
  }, [activeCustomizationKey, customizationSections]);

  const activeCustomizationSection =
    customizationSections.find(({ key }) => key === activeCustomizationKey) ?? customizationSections[0];

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
    const onlineRivalName = opponent?.name || 'Waiting for opponent…';
    const onlineRivalPhoto = opponent?.avatar || onlineRivalName || '⏳';
    const isOnlineGame = onlineRef.current.enabled;

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
        photoUrl: isOnlineGame ? onlineRivalPhoto : effectiveAiFlag || '🏁',
        name: isOnlineGame ? onlineRivalName : aiName,
        color: accentColor,
        isTurn: !ui.turnWhite
      }
    ];
  }, [aiFlag, appearance, avatar, opponent, playerFlag, resolvedInitialFlag, ui.turnWhite, username]);
  const giftPlayers = useMemo(
    () =>
      players.map((player) => ({
        ...player,
        id:
          player.index === 0
            ? resolvedAccountId || `chess-player-${player.index}`
            : opponent?.id || `chess-opponent-${player.index}`,
        name: player.name
      })),
    [players, opponent, resolvedAccountId]
  );

  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  const resolveChessSideName = useCallback((isWhite) => {
    const [whitePlayer, blackPlayer] = playersRef.current || [];
    return isWhite ? whitePlayer?.name || 'White' : blackPlayer?.name || 'Black';
  }, []);

  const resolveCommentarySpeaker = useCallback(() => {
    const speakers = [CHESS_BATTLE_SPEAKERS.lead, CHESS_BATTLE_SPEAKERS.analyst];
    const idx = commentarySpeakerIndexRef.current;
    commentarySpeakerIndexRef.current = idx + 1;
    return speakers[idx % speakers.length] || CHESS_BATTLE_SPEAKERS.lead;
  }, []);

  const playNextCommentary = useCallback(async () => {
    if (commentarySpeakingRef.current) return;
    const next = commentaryQueueRef.current.shift();
    if (!next) return;
    const synth = getSpeechSynthesis();
    if (!synth) return;
    commentarySpeakingRef.current = true;
    try {
      synth.cancel();
    } catch {}
    await speakCommentaryLines(next.lines, {
      speakerSettings: next.preset?.speakerSettings,
      voiceHints: next.preset?.voiceHints
    });
    commentarySpeakingRef.current = false;
    if (commentaryQueueRef.current.length) {
      playNextCommentary();
    }
  }, []);

  const enqueueChessCommentary = useCallback(
    (lines, { priority = false, preset = commentaryPresetRef.current } = {}) => {
      if (!Array.isArray(lines) || lines.length === 0) return;
      if (commentaryMutedRef.current || isGameMuted()) return;
      if (!commentaryReadyRef.current) {
        pendingCommentaryLinesRef.current = { lines, priority, preset };
        return;
      }
      const now = performance.now();
      if (!priority && now - commentaryLastEventAtRef.current < COMMENTARY_MIN_INTERVAL_MS) return;
      if (!priority && commentaryQueueRef.current.length >= COMMENTARY_QUEUE_LIMIT) return;
      if (priority) {
        commentaryQueueRef.current.unshift({ lines, preset });
      } else {
        commentaryQueueRef.current.push({ lines, preset });
      }
      if (!commentarySpeakingRef.current) {
        playNextCommentary();
      }
      commentaryLastEventAtRef.current = now;
    },
    [playNextCommentary]
  );

  const enqueueChessCommentaryEvent = useCallback(
    (event, context = {}, options = {}) => {
      const speaker = options.speaker ?? resolveCommentarySpeaker();
      const text = buildChessCommentaryLine({
        event,
        speaker,
        language: commentaryPresetRef.current?.language ?? commentaryPresetId,
        context: {
          arena: 'Chess Battle Royal arena',
          ...context
        }
      });
      enqueueChessCommentary([{ speaker, text }], options);
    },
    [commentaryPresetId, enqueueChessCommentary, resolveCommentarySpeaker]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (!commentarySupported) return undefined;
    const unlockCommentary = () => {
      if (commentaryReadyRef.current) return;
      primeSpeechSynthesis();
      const synth = getSpeechSynthesis();
      synth?.getVoices?.();
      commentaryReadyRef.current = true;
      const pending = pendingCommentaryLinesRef.current;
      if (pending) {
        pendingCommentaryLinesRef.current = null;
        enqueueChessCommentary(pending.lines, pending);
      }
    };
    if (navigator?.userActivation?.hasBeenActive) {
      unlockCommentary();
    }
    window.addEventListener('pointerdown', unlockCommentary);
    window.addEventListener('click', unlockCommentary);
    window.addEventListener('touchstart', unlockCommentary);
    window.addEventListener('keydown', unlockCommentary);
    return () => {
      window.removeEventListener('pointerdown', unlockCommentary);
      window.removeEventListener('click', unlockCommentary);
      window.removeEventListener('touchstart', unlockCommentary);
      window.removeEventListener('keydown', unlockCommentary);
    };
  }, [commentarySupported, enqueueChessCommentary]);

  useEffect(() => {
    if (commentaryIntroPlayedRef.current) return;
    if (!commentarySupported || commentaryMutedRef.current || isGameMuted()) return;
    const [whitePlayer, blackPlayer] = players || [];
    if (!whitePlayer || !blackPlayer) return;
    commentaryIntroPlayedRef.current = true;
    const script = createChessMatchCommentaryScript({
      players: { white: whitePlayer.name, black: blackPlayer.name },
      commentators: [CHESS_BATTLE_SPEAKERS.lead, CHESS_BATTLE_SPEAKERS.analyst],
      language: commentaryPresetRef.current?.language ?? commentaryPresetId,
      arena: 'Chess Battle Royal arena'
    });
    enqueueChessCommentary(script, { priority: true });
  }, [commentaryPresetId, commentarySupported, enqueueChessCommentary, players]);

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
    hdriVariantRef.current = resolveHdriVariant(appearance.environmentHdri);
    if (typeof updateEnvironmentRef.current === 'function') {
      updateEnvironmentRef.current(hdriVariantRef.current);
    }
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
    try {
      window.localStorage?.setItem(GRAPHICS_STORAGE_KEY, graphicsId);
    } catch {}
  }, [graphicsId]);

  useEffect(() => {
    const profile = selectPerformanceProfile(activeGraphicsOption);
    renderSettingsRef.current = {
      targetFrameIntervalMs: 1000 / profile.targetFps,
      renderResolutionScale: profile.resolutionScale,
      pixelRatioCap: profile.pixelRatioCap ?? DEFAULT_RENDER_PIXEL_RATIO_CAP,
      pixelRatioScale: profile.pixelRatioScale ?? RENDER_PIXEL_RATIO_SCALE
    };
    const arena = arenaRef.current;
    if (!arena?.renderer || typeof window === 'undefined') return;
    const devicePixelRatio = window.devicePixelRatio || 1;
    const scaledPixelRatio = devicePixelRatio * renderSettingsRef.current.pixelRatioScale;
    const pixelRatio = Math.max(
      MIN_RENDER_PIXEL_RATIO,
      Math.min(renderSettingsRef.current.pixelRatioCap, scaledPixelRatio)
    );
    arena.renderer.setPixelRatio(pixelRatio);
    fitRef.current?.();
  }, [activeGraphicsOption]);

  useEffect(() => {
    settingsRef.current.moveMode = moveMode;
  }, [moveMode]);

  useEffect(() => {
    settingsRef.current.soundEnabled = effectiveSoundEnabled;
    const volume = getGameVolume();
    if (bombSoundRef.current) {
      bombSoundRef.current.volume = effectiveSoundEnabled ? volume : 0;
      if (!effectiveSoundEnabled) {
        try {
          bombSoundRef.current.pause();
          bombSoundRef.current.currentTime = 0;
        } catch {}
      }
    }
    if (timerSoundRef.current) {
      timerSoundRef.current.volume = effectiveSoundEnabled ? volume : 0;
      if (!effectiveSoundEnabled) {
        try {
          timerSoundRef.current.pause();
          timerSoundRef.current.currentTime = 0;
        } catch {}
      }
    }
    if (moveSoundRef.current) {
      moveSoundRef.current.volume = effectiveSoundEnabled ? volume : 0;
      if (!effectiveSoundEnabled) {
        try {
          moveSoundRef.current.pause();
          moveSoundRef.current.currentTime = 0;
        } catch {}
      }
    }
    if (checkSoundRef.current) {
      checkSoundRef.current.volume = effectiveSoundEnabled ? volume : 0;
      if (!effectiveSoundEnabled) {
        try {
          checkSoundRef.current.pause();
          checkSoundRef.current.currentTime = 0;
        } catch {}
      }
    }
    if (mateSoundRef.current) {
      mateSoundRef.current.volume = effectiveSoundEnabled ? volume : 0;
      if (!effectiveSoundEnabled) {
        try {
          mateSoundRef.current.pause();
          mateSoundRef.current.currentTime = 0;
        } catch {}
      }
    }
    if (laughSoundRef.current) {
      laughSoundRef.current.volume = effectiveSoundEnabled ? volume : 0;
      if (!effectiveSoundEnabled) {
        try {
          laughSoundRef.current.pause();
          laughSoundRef.current.currentTime = 0;
        } catch {}
      }
    }
    [swordSoundRef, droneSoundRef, helicopterSoundRef, missileLaunchSoundRef, missileImpactSoundRef].forEach((ref) => {
      if (!ref.current) return;
      ref.current.volume = effectiveSoundEnabled ? volume : 0;
      if (!effectiveSoundEnabled) {
        try {
          ref.current.pause();
          ref.current.currentTime = 0;
        } catch {}
      }
    });
    if (!effectiveSoundEnabled) {
      audioStopTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
      audioStopTimeoutsRef.current.clear();
    }
  }, [effectiveSoundEnabled]);

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
      if (laughSoundRef.current) {
        laughSoundRef.current.volume = settingsRef.current.soundEnabled ? volume : 0;
      }
      [swordSoundRef, droneSoundRef, helicopterSoundRef, missileLaunchSoundRef, missileImpactSoundRef].forEach((ref) => {
        if (!ref.current) return;
        ref.current.volume = settingsRef.current.soundEnabled ? volume : 0;
      });
    };
    window.addEventListener('gameVolumeChanged', handleVolumeChange);
    return () => {
      window.removeEventListener('gameVolumeChanged', handleVolumeChange);
    };
  }, []);

  useEffect(() => {
    const apply = arenaRef.current?.applySideColorHex;
    if (apply) apply('white', QUICK_SIDE_COLORS[p1QuickIdx % QUICK_SIDE_COLORS.length]?.hex);
  }, [p1QuickIdx]);

  useEffect(() => {
    const apply = arenaRef.current?.applySideColorHex;
    if (apply) apply('black', QUICK_SIDE_COLORS[p2QuickIdx % QUICK_SIDE_COLORS.length]?.hex);
  }, [p2QuickIdx]);

  useEffect(() => {
    const apply = arenaRef.current?.applyPawnHeadPreset;
    const presetId = QUICK_HEAD_PRESETS[headQuickIdx % QUICK_HEAD_PRESETS.length]?.id ?? 'current';
    if (apply) apply(presetId);
  }, [headQuickIdx]);

  useEffect(() => {
    const apply = arenaRef.current?.applyBoardThemePreset;
    if (apply) apply(boardQuickIdx);
  }, [boardQuickIdx]);

  useEffect(() => {
    const arena = arenaRef.current;
    if (!arena) return;

    const normalized = normalizeAppearance(appearance);
    const previousAppearance = arena.lastAppliedAppearance ?? normalized;
    const tableOrSeatAppearanceChanged =
      previousAppearance.tables !== normalized.tables ||
      previousAppearance.tableFinish !== normalized.tableFinish ||
      previousAppearance.tableCloth !== normalized.tableCloth ||
      previousAppearance.chairColor !== normalized.chairColor;
    const boardOrPieceAppearanceChanged =
      previousAppearance.boardColor !== normalized.boardColor ||
      previousAppearance.whitePieceStyle !== normalized.whitePieceStyle ||
      previousAppearance.blackPieceStyle !== normalized.blackPieceStyle ||
      previousAppearance.headStyle !== normalized.headStyle;
    const palette = createChessPalette(normalized);
    paletteRef.current = palette;
    arena.palette = palette;
    if (arenaRef.current) {
      arenaRef.current.palette = palette;
      arenaRef.current.boardMaterials = arena.boardMaterials;
    }
    const pieceSetOption =
      PIECE_STYLE_OPTIONS[normalized.whitePieceStyle] ?? PIECE_STYLE_OPTIONS[0];
    const nextPieceSetId = BEAUTIFUL_GAME_SWAP_SET_ID;
    const isBeautifulGameSet = (arena.activePieceSetId || nextPieceSetId || '').startsWith('beautifulGame');
    const tableFinish = TABLE_FINISH_OPTIONS[normalized.tableFinish] ?? DEFAULT_TABLE_FINISH;
    const woodOption = tableFinish?.woodOption ?? DEFAULT_WOOD_OPTION;
    const clothOption = TABLE_CLOTH_OPTIONS[normalized.tableCloth] ?? DEFAULT_CLOTH_OPTION;
    const baseOption = DEFAULT_BASE_OPTION;
    const chairOption = CHAIR_COLOR_OPTIONS[normalized.chairColor] ?? CHAIR_COLOR_OPTIONS[0];
    const tableTheme = TABLE_THEME_OPTIONS[normalized.tables] ?? TABLE_THEME_OPTIONS[0];
    const { option: shapeOption, rotationY } = getEffectiveShapeConfigForTableTheme(tableTheme);
    const boardTheme = palette.board ?? BEAUTIFUL_GAME_THEME;
    const pieceStyleOption = palette.pieces ?? DEFAULT_PIECE_STYLE;
    const headPreset = palette.head ?? HEAD_PRESET_OPTIONS[0].preset;
    const pieceSetLoader = (size) => resolveBeautifulGameAssets(size);
    const loadPieceSet = (size = RAW_BOARD_SIZE) => Promise.resolve().then(() => pieceSetLoader(size));

    if (shapeOption || tableTheme) {
      const shapeChanged = shapeOption?.id !== arena.tableShapeId;
      const themeChanged = tableTheme?.id !== arena.tableThemeId;
      const rotationChanged = Math.abs((arena.tableInfo?.rotationY ?? 0) - rotationY) > 1e-3;

      const rebuildTable = async () => {
        const { boardGroup } = arena;
        if (boardGroup && arena.tableInfo?.group) {
          arena.tableInfo.group.remove(boardGroup);
        }
        const nextTable = await buildTableFromTheme(tableTheme, {
          arena: arena.arenaGroup,
          renderer: arena.renderer,
          tableRadius: TABLE_RADIUS,
          tableHeight: TABLE_HEIGHT,
          woodOption,
          clothOption,
          baseOption,
          shapeOption,
          rotationY,
          textureLoader: arena.textureLoader,
          maxAnisotropy: arena.maxAnisotropy,
          textureCache: arena.textureCache,
          fallbackTexture: arena.fallbackTexture
        });
        if (!arenaRef.current) {
          nextTable?.dispose?.();
          return;
        }
        if (nextTable?.materials) {
          applyTableMaterials(nextTable.materials, { woodOption, clothOption, baseOption }, arena.renderer);
        }
        const arenaFloorY = Number.isFinite(arena.environmentFloorY) ? arena.environmentFloorY : 0;
        const tableFloorOffset = alignGroupToFloorY(nextTable?.group, arenaFloorY);
        if (nextTable?.surfaceY != null) {
          nextTable.surfaceY += tableFloorOffset;
        }
        if (boardGroup && nextTable?.group) {
          nextTable.group.add(boardGroup);
          alignBoardGroupToTableSurface(boardGroup, nextTable);
        }
        arena.tableInfo?.dispose?.();
        arena.tableInfo = nextTable;
        arena.tableShapeId = nextTable?.shapeId;
        arena.tableThemeId = tableTheme?.id;
        if (arena.boardLookTarget) {
          const targetY = boardGroup
            ? boardGroup.position.y + (BOARD.baseH + 0.12) * BOARD_SCALE
            : (nextTable?.surfaceY ?? TABLE_HEIGHT) + (BOARD.baseH + 0.12) * BOARD_SCALE;
          arena.boardLookTarget.set(0, targetY, 0);
        }
        (arena.chairs || []).forEach((chair) => alignGroupToFloorY(chair.group, arenaFloorY));
        const roomHalfWidth = arena.roomHalfWidth ?? CHESS_ROOM_HALF_SPAN;
        const roomHalfDepth = arena.roomHalfDepth ?? CHESS_ROOM_HALF_SPAN;
        const prevPlacement = arena.tablePlacementOffset ?? new THREE.Vector3();
        const placementOffset = alignArenaContentsToRoom(
          [nextTable?.group, ...(arena.chairs || []).map((chair) => chair.group)],
          roomHalfWidth,
          roomHalfDepth
        );
        const placementDelta = placementOffset.clone().sub(prevPlacement);
        arena.tablePlacementOffset = placementOffset.clone();
        if (arena.boardLookTarget) {
          arena.boardLookTarget.x = placementOffset.x;
          arena.boardLookTarget.z = placementOffset.z;
        }
        if (arena.camera && (Math.abs(placementDelta.x) > 1e-4 || Math.abs(placementDelta.z) > 1e-4)) {
          arena.camera.position.x += placementDelta.x;
          arena.camera.position.z += placementDelta.z;
        }
        arena.studioCameras?.forEach((cam) => {
          if (!cam) return;
          cam.position.x += placementDelta.x;
          cam.position.z += placementDelta.z;
        });
        const arenaGroups = [nextTable?.group, ...(arena.chairs || []).map((chair) => chair.group)];
        groundArenaGroups(arenaGroups, arenaFloorY);
        const updatedFloorY = computeGroupFloorY(arenaGroups);
        environmentFloorRef.current = updatedFloorY;
        arena.environmentFloorY = updatedFloorY;
        updateEnvironmentRef.current?.(hdriVariantRef.current);
        arena.studioCameras?.forEach((cam) => cam?.lookAt?.(arena.boardLookTarget ?? new THREE.Vector3()));
        arena.controls?.target.copy(arena.boardLookTarget ?? new THREE.Vector3());
        arena.controls?.update();
        fitRef.current?.();
      };

      if (themeChanged || shapeChanged || rotationChanged || !arena.tableInfo) {
        void rebuildTable();
      } else if (arena.tableInfo?.materials && tableTheme?.source !== 'polyhaven') {
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

    const shouldRefreshBoardPieces = !tableOrSeatAppearanceChanged || boardOrPieceAppearanceChanged;
    if (shouldRefreshBoardPieces && arena.piecePrototypes) {
      harmonizeBeautifulGamePieces(arena.piecePrototypes, pieceStyleOption);
      applyHeadPresetToPrototypes(arena.piecePrototypes, headPreset);
    }
    if (shouldRefreshBoardPieces && arena.allPieceMeshes) {
      applyBeautifulGameStyleToMeshes(arena.allPieceMeshes, pieceStyleOption);
      applyHeadPresetToMeshes(arena.allPieceMeshes, headPreset);
    }

    if (shouldRefreshBoardPieces && arena.boardModel) {
      applyBeautifulGameBoardTheme(arena.boardModel, boardTheme);
      arena.boardModel.visible = true;
      arena.setProceduralBoardVisible?.(false);
    }

    const shouldSwapPieces =
      shouldRefreshBoardPieces &&
      (!arena.activePieceSetId || nextPieceSetId !== arena.activePieceSetId);
    if (shouldSwapPieces) {
      loadPieceSet(RAW_BOARD_SIZE)
        .then((assets) => {
          if (!arenaRef.current) return;
          arenaRef.current.applyPieceSetAssets?.(assets, nextPieceSetId, pieceStyleOption);
        })
        .catch((error) => {
          console.warn('Chess Battle Royal: failed to swap piece set', error);
        });
    }
    arena.lastAppliedAppearance = normalized;

    if (arena.boardMaterials && (!arena.boardModel || arena.usingProceduralBoard)) {
      const usingExternalBoard = Boolean(arena.boardModel && !arena.usingProceduralBoard);
      const { base: baseMat, top: topMat, coord: coordMat, tiles } = arena.boardMaterials;
      baseMat?.color?.set?.(boardTheme.frameDark);
      baseMat.roughness = boardTheme.frameRoughness;
      baseMat.metalness = boardTheme.frameMetalness;
      if ('clearcoat' in baseMat) baseMat.clearcoat = 0;
      if ('reflectivity' in baseMat) baseMat.reflectivity = 0;
      baseMat.transparent = usingExternalBoard;
      baseMat.opacity = usingExternalBoard ? Math.min(baseMat.opacity ?? 0.02, 0.08) : 1;
      baseMat.depthWrite = !usingExternalBoard;
      topMat?.color?.set?.(boardTheme.frameLight);
      topMat.roughness = boardTheme.surfaceRoughness;
      topMat.metalness = boardTheme.surfaceMetalness;
      if ('clearcoat' in topMat) topMat.clearcoat = 0;
      if ('reflectivity' in topMat) topMat.reflectivity = 0;
      topMat.transparent = usingExternalBoard;
      topMat.opacity = usingExternalBoard ? Math.min(topMat.opacity ?? 0.02, 0.08) : 1;
      topMat.depthWrite = !usingExternalBoard;
      coordMat?.color?.set?.(palette.accent);
      tiles?.forEach((tileMesh) => {
        const isDark = (tileMesh.userData?.r + tileMesh.userData?.c) % 2 === 1;
        tileMesh.material.color.set(isDark ? boardTheme.dark : boardTheme.light);
        tileMesh.material.roughness = boardTheme.surfaceRoughness;
        tileMesh.material.metalness = boardTheme.surfaceMetalness;
        if ('clearcoat' in tileMesh.material) tileMesh.material.clearcoat = 0;
        if ('reflectivity' in tileMesh.material) tileMesh.material.reflectivity = 0;
        tileMesh.material.transparent = usingExternalBoard;
        tileMesh.material.opacity = usingExternalBoard ? Math.min(tileMesh.material.opacity ?? 0.08, 0.12) : 1;
        tileMesh.material.depthWrite = !usingExternalBoard;
      });
    }

    if (isBeautifulGameSet && arena.piecePrototypes) {
      harmonizeBeautifulGamePieces(arena.piecePrototypes, pieceStyleOption);
    }

    if (arena.allPieceMeshes) {
      if (isBeautifulGameSet) {
        applyBeautifulGameStyleToMeshes(arena.allPieceMeshes, pieceStyleOption);
        disposePieceMaterials(arena.pieceMaterials);
        arena.pieceMaterials = null;
      } else {
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
      applyHeadPresetToMeshes(arena.allPieceMeshes, headPreset);
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
    laughSoundRef.current = new Audio(LAUGH_SOUND_URL);
    laughSoundRef.current.volume = baseVolume;
    swordSoundRef.current = new Audio('/assets/sounds/punch-03-352040.mp3');
    swordSoundRef.current.volume = baseVolume;
    droneSoundRef.current = new Audio(DRONE_FLY_SOUND_URL);
    droneSoundRef.current.volume = baseVolume;
    helicopterSoundRef.current = new Audio(HELICOPTER_FLY_SOUND_URL);
    helicopterSoundRef.current.volume = baseVolume;
    missileLaunchSoundRef.current = new Audio(BAZOOKA_FIRE_SOUND_URL);
    missileLaunchSoundRef.current.volume = baseVolume;
    missileImpactSoundRef.current = new Audio(MISSILE_IMPACT_SOUND_URL);
    missileImpactSoundRef.current.volume = baseVolume;
    const jetFlySound = new Audio(JET_FLY_SOUND_URL);
    jetFlySound.volume = baseVolume;

    let stopCameraTween = () => {};
    let onResize = null;
    let onClick = null;

    const clearAudioStopTimeout = (audioRef = null) => {
      if (!audioRef?.current) return;
      const timeoutId = audioStopTimeoutsRef.current.get(audioRef.current);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      audioStopTimeoutsRef.current.delete(audioRef.current);
    };

    const clearAllAudioStopTimeouts = () => {
      audioStopTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
      audioStopTimeoutsRef.current.clear();
    };

    const setup = async () => {
      const performanceProfile = selectPerformanceProfile(activeGraphicsOption);
      const renderSettings = {
        targetFrameIntervalMs: 1000 / performanceProfile.targetFps,
        renderResolutionScale: performanceProfile.resolutionScale,
        pixelRatioCap: performanceProfile.pixelRatioCap ?? DEFAULT_RENDER_PIXEL_RATIO_CAP,
        pixelRatioScale: performanceProfile.pixelRatioScale ?? RENDER_PIXEL_RATIO_SCALE
      };
      renderSettingsRef.current = renderSettings;
      const { targetFrameIntervalMs, renderResolutionScale, pixelRatioCap, pixelRatioScale } = renderSettings;

      const normalizedAppearance = normalizeAppearance(appearanceRef.current);
      const palette = createChessPalette(normalizedAppearance);
      paletteRef.current = palette;
      const environmentOption = resolveHdriVariant(normalizedAppearance.environmentHdri);
      hdriVariantRef.current = environmentOption;
      const boardTheme = palette.board ?? BEAUTIFUL_GAME_THEME;
      const pieceStyleOption = palette.pieces ?? DEFAULT_PIECE_STYLE;
      const pieceSetOption =
        PIECE_STYLE_OPTIONS[normalizedAppearance.whitePieceStyle] ?? PIECE_STYLE_OPTIONS[0];
      const initialPieceSetId = BEAUTIFUL_GAME_SWAP_SET_ID;
      const pieceSetLoader = (size) => resolveBeautifulGameAssets(size);
      const loadPieceSet = (size = RAW_BOARD_SIZE) => Promise.resolve().then(() => pieceSetLoader(size));
      const initialPlayerFlag =
        playerFlag ||
        resolvedInitialFlag ||
        (FLAG_EMOJIS.length > 0 ? FLAG_EMOJIS[0] : FALLBACK_FLAG);
      const initialAiFlagValue =
        aiFlag || initialAiFlag || getAIOpponentFlag(initialPlayerFlag || FALLBACK_FLAG);
      const tableFinish =
        TABLE_FINISH_OPTIONS[normalizedAppearance.tableFinish] ?? DEFAULT_TABLE_FINISH;
      const woodOption = tableFinish?.woodOption ?? DEFAULT_WOOD_OPTION;
      const clothOption = TABLE_CLOTH_OPTIONS[normalizedAppearance.tableCloth] ?? DEFAULT_CLOTH_OPTION;
      const baseOption = DEFAULT_BASE_OPTION;
      const chairOption = CHAIR_COLOR_OPTIONS[normalizedAppearance.chairColor] ?? CHAIR_COLOR_OPTIONS[0];
      const tableTheme = TABLE_THEME_OPTIONS[normalizedAppearance.tables] ?? TABLE_THEME_OPTIONS[0];
      const { option: shapeOption, rotationY } = getEffectiveShapeConfigForTableTheme(tableTheme);
      const pieceMaterials = createPieceMaterials(pieceStyleOption);
      disposers.push(() => {
        disposePieceMaterials(pieceMaterials);
      });
      const pieceSetPromise = loadPieceSet(RAW_BOARD_SIZE);
      const playAudio = (audioRef, options = {}) => {
        if (!audioRef?.current || !settingsRef.current.soundEnabled) return;
        const { maxDurationMs = null } = options;
        try {
          audioRef.current.currentTime = 0;
          const playPromise = audioRef.current.play();
          if (maxDurationMs && Number.isFinite(maxDurationMs)) {
            clearAudioStopTimeout(audioRef);
            const timeoutId = setTimeout(() => {
              try {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
              } catch {}
              audioStopTimeoutsRef.current.delete(audioRef.current);
            }, maxDurationMs);
            audioStopTimeoutsRef.current.set(audioRef.current, timeoutId);
          }
          playPromise?.catch(() => {});
        } catch {}
      };
      const playMoveSound = () => playAudio(moveSoundRef);
      const playCheckSound = () => playAudio(checkSoundRef);
      const playMateSound = () => playAudio(mateSoundRef);
      const playLaughSound = () => playAudio(laughSoundRef, { maxDurationMs: 6000 });
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
    renderer.useLegacyLights = false;
    renderer.physicallyCorrectLights = true;
    if (sharedKTX2Loader) {
      try {
        sharedKTX2Loader.detectSupport(renderer);
      } catch (error) {
        console.warn('Chess Battle Royal: KTX2 support detection failed', error);
      }
    }
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.85;
    const devicePixelRatio = window.devicePixelRatio || 1;
    const scaledPixelRatio = devicePixelRatio * pixelRatioScale;
    const pixelRatio = Math.max(MIN_RENDER_PIXEL_RATIO, Math.min(pixelRatioCap, scaledPixelRatio));
    renderer.setPixelRatio(pixelRatio);
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
    rendererRef.current = renderer;

    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin?.('anonymous');
    const textureCache = new Map();
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy?.() ?? 1;
    const fallbackTexture = textureLoader.load(
      'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r150/examples/textures/uv_grid_opengl.jpg'
    );
    applySRGBColorSpace(fallbackTexture);
    fallbackTexture.wrapS = THREE.RepeatWrapping;
    fallbackTexture.wrapT = THREE.RepeatWrapping;
    fallbackTexture.repeat?.set?.(1.6, 1.6);
    fallbackTexture.anisotropy = maxAnisotropy;
    fallbackTexture.needsUpdate = true;
    disposers.push(() => {
      fallbackTexture?.dispose?.();
      textureCache.clear?.();
    });

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f16);
    sceneRef.current = scene;
    const arena = new THREE.Group();
    scene.add(arena);
    const shadowSun = new THREE.DirectionalLight(0xffffff, 1.0);
    shadowSun.position.set(8, 15, 7);
    shadowSun.castShadow = true;
    shadowSun.shadow.mapSize.set(2048, 2048);
    shadowSun.shadow.radius = 4;
    shadowSun.shadow.bias = -0.00018;
    shadowSun.shadow.normalBias = 0.02;
    shadowSun.shadow.camera.near = 0.5;
    shadowSun.shadow.camera.far = 50;
    shadowSun.shadow.camera.left = -12;
    shadowSun.shadow.camera.right = 12;
    shadowSun.shadow.camera.top = 12;
    shadowSun.shadow.camera.bottom = -12;
    shadowSun.target.position.set(0, 0, 0);
    scene.add(shadowSun);
    scene.add(shadowSun.target);
    const shadowFill = new THREE.HemisphereLight(0xdbeafe, 0x1f2937, 0.26);
    scene.add(shadowFill);
    const shadowCatcher = new THREE.Mesh(
      new THREE.PlaneGeometry(CHESS_ROOM_HALF_SPAN * 2.7, CHESS_ROOM_HALF_SPAN * 2.7),
      new THREE.ShadowMaterial({ opacity: 0.28 })
    );
    shadowCatcher.rotation.x = -Math.PI / 2;
    shadowCatcher.position.y = environmentFloorRef.current ?? 0;
    shadowCatcher.receiveShadow = true;
    shadowCatcher.renderOrder = -1;
    scene.add(shadowCatcher);
    environmentShadowCatcherRef.current = shadowCatcher;
    disposers.push(() => {
      shadowCatcher.parent?.remove(shadowCatcher);
      shadowCatcher.geometry?.dispose?.();
      shadowCatcher.material?.dispose?.();
      if (environmentShadowCatcherRef.current === shadowCatcher) {
        environmentShadowCatcherRef.current = null;
      }
    });
    arena.textureLoader = textureLoader;
    arena.textureCache = textureCache;
    arena.maxAnisotropy = maxAnisotropy;
    arena.fallbackTexture = fallbackTexture;

    const roomHalfWidth = CHESS_ROOM_HALF_SPAN;
    const roomHalfDepth = CHESS_ROOM_HALF_SPAN;
    const roomWidth = roomHalfWidth * 2;
    const roomDepth = roomHalfDepth * 2;
    arena.roomHalfWidth = roomHalfWidth;
    arena.roomHalfDepth = roomHalfDepth;

    let syncSkyboxToCamera = () => {};

    const applyHdriEnvironment = async (variantConfig = hdriVariantRef.current || DEFAULT_HDRI_VARIANT) => {
      const sceneInstance = sceneRef.current;
      if (!renderer || !sceneInstance) return;
      const activeVariant = variantConfig || hdriVariantRef.current || DEFAULT_HDRI_VARIANT;
      const envResult = await loadPolyHavenHdriEnvironment(renderer, activeVariant);
      if (!envResult) return;
      const { envMap, skyboxMap } = envResult;
      if (!envMap) return;
      if (cancelled) {
        envMap.dispose?.();
        skyboxMap?.dispose?.();
        return;
      }
      const prevDispose = disposeEnvironmentRef.current;
      const prevTexture = envTextureRef.current;
      const prevSkybox = envSkyboxRef.current;
      const floorY = environmentFloorRef.current ?? 0;
      if (environmentShadowCatcherRef.current) {
        environmentShadowCatcherRef.current.position.y = floorY + 0.002;
      }
      const cameraHeight =
        Math.max(activeVariant?.cameraHeightM ?? DEFAULT_HDRI_CAMERA_HEIGHT_M, MIN_HDRI_CAMERA_HEIGHT_M) *
        HDRI_UNITS_PER_METER;
      const radiusMultiplier =
        typeof activeVariant?.groundRadiusMultiplier === 'number'
          ? activeVariant.groundRadiusMultiplier
          : DEFAULT_HDRI_RADIUS_MULTIPLIER;
      const sceneSpan = Math.max(roomHalfWidth, roomHalfDepth);
      const groundRadius = Math.max(sceneSpan * radiusMultiplier, MIN_HDRI_RADIUS);
      const skyboxResolution = Math.max(
        16,
        Math.floor(activeVariant?.groundResolution ?? HDRI_GROUNDED_RESOLUTION)
      );
      const skyboxRadius = Math.max(groundRadius, cameraHeight * 2.5, MIN_HDRI_RADIUS);
      let skybox = null;
      if (skyboxMap && skyboxRadius > 0 && cameraHeight > 0) {
        try {
          skybox = new GroundedSkybox(skyboxMap, cameraHeight, skyboxRadius, skyboxResolution);
          skybox.position.y = floorY + cameraHeight;
          skybox.material.depthWrite = false;
          sceneInstance.background = null;
          sceneInstance.add(skybox);
          envSkyboxRef.current = skybox;
          envSkyboxTextureRef.current = skyboxMap;
          baseSkyboxScaleRef.current = skybox.scale?.x ?? 1;
        } catch (error) {
          console.warn('Failed to create grounded HDRI skybox', error);
          skybox = null;
        }
      }
      sceneInstance.environment = envMap;
      if (!skybox) {
        sceneInstance.background = envMap;
        envSkyboxRef.current = null;
        envSkyboxTextureRef.current = null;
        if ('backgroundIntensity' in sceneInstance && typeof activeVariant?.backgroundIntensity === 'number') {
          sceneInstance.backgroundIntensity = activeVariant.backgroundIntensity;
        }
      }
      if (typeof activeVariant?.environmentIntensity === 'number') {
        sceneInstance.environmentIntensity = activeVariant.environmentIntensity;
      }
      renderer.toneMappingExposure = activeVariant?.exposure ?? renderer.toneMappingExposure;
      envTextureRef.current = envMap;
      syncSkyboxToCamera();
      disposeEnvironmentRef.current = () => {
        if (sceneRef.current?.environment === envMap) {
          sceneRef.current.environment = null;
        }
        if (!skybox && sceneRef.current?.background === envMap) {
          sceneRef.current.background = null;
        }
        envMap.dispose?.();
        if (skybox) {
          skybox.parent?.remove(skybox);
          skybox.geometry?.dispose?.();
          skybox.material?.dispose?.();
          if (envSkyboxRef.current === skybox) {
            envSkyboxRef.current = null;
          }
        }
        if (skyboxMap) {
          skyboxMap.dispose?.();
          if (envSkyboxTextureRef.current === skyboxMap) {
            envSkyboxTextureRef.current = null;
          }
        }
      };
      if (prevDispose && (prevTexture !== envMap || prevSkybox !== skybox)) {
        prevDispose();
      }
    };
    updateEnvironmentRef.current = applyHdriEnvironment;
    disposers.push(() => {
      disposeEnvironmentRef.current?.();
      envTextureRef.current = null;
      envSkyboxRef.current = null;
      envSkyboxTextureRef.current = null;
    });

    const tableInfo = await buildTableFromTheme(tableTheme, {
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
    if (tableInfo?.materials) {
      applyTableMaterials(tableInfo.materials, { woodOption, clothOption, baseOption }, renderer);
    }
    const initialArenaFloorY = Number.isFinite(environmentFloorRef.current) ? environmentFloorRef.current : 0;
    const tableFloorOffset = alignGroupToFloorY(tableInfo?.group, initialArenaFloorY);
    if (tableInfo?.surfaceY != null) {
      tableInfo.surfaceY += tableFloorOffset;
    }
    if (tableInfo?.dispose) {
      disposers.push(() => {
        try {
          tableInfo.dispose();
        } catch (error) {
          console.warn('Failed to dispose chess table', error);
        }
      });
    }
    arena.tableThemeId = tableTheme.id;

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
    chairA.group.position.set(
      0,
      CHAIR_BASE_HEIGHT + CHAIR_VERTICAL_OFFSET,
      chairDistance + PLAYER_CHAIR_EXTRA_CLEARANCE
    );
    chairA.group.rotation.y = Math.PI;
    arena.add(chairA.group);
    alignGroupToFloorY(chairA.group, initialArenaFloorY);
    chairs.push(chairA);
    const chairB = makeChair(1);
    chairB.group.position.set(0, CHAIR_BASE_HEIGHT + CHAIR_VERTICAL_OFFSET, -chairDistance);
    arena.add(chairB.group);
    alignGroupToFloorY(chairB.group, initialArenaFloorY);
    chairs.push(chairB);

    const tablePlacementOffset = alignArenaContentsToRoom(
      [tableInfo?.group, chairA.group, chairB.group],
      roomHalfWidth,
      roomHalfDepth
    );
    arena.tablePlacementOffset = tablePlacementOffset.clone();

    groundArenaGroups([tableInfo?.group, chairA.group, chairB.group], initialArenaFloorY);
    const environmentFloorY = computeGroupFloorY([tableInfo?.group, chairA.group, chairB.group]);
    environmentFloorRef.current = environmentFloorY;
    arena.environmentFloorY = environmentFloorY;
    void applyHdriEnvironment(hdriVariantRef.current || DEFAULT_HDRI_VARIANT);

    const sandTimer = null;

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
    studioCamA.position.set(
      -cameraRigOffsetX + tablePlacementOffset.x,
      0,
      -cameraRigOffsetZ + tablePlacementOffset.z
    );
    arena.add(studioCamA);
    const studioCamB = makeStudioCamera();
    studioCamB.position.set(
      cameraRigOffsetX + tablePlacementOffset.x,
      0,
      cameraRigOffsetZ + tablePlacementOffset.z
    );
    arena.add(studioCamB);

    const tableSurfaceY = tableInfo?.surfaceY ?? TABLE_HEIGHT;
    const boardGroup = new THREE.Group();
    boardGroup.scale.setScalar(BOARD_SCALE);
    tableInfo.group.add(boardGroup);
    alignBoardGroupToTableSurface(boardGroup, tableInfo);
    const boardVisualGroup = new THREE.Group();
    boardVisualGroup.position.y = BOARD_VISUAL_Y_OFFSET;
    boardGroup.add(boardVisualGroup);
    const boardLookTarget = new THREE.Vector3(
      tablePlacementOffset.x,
      boardGroup.position.y + (BOARD.baseH + 0.12) * BOARD_SCALE,
      tablePlacementOffset.z
    );
    studioCamA.lookAt(boardLookTarget);
    studioCamB.lookAt(boardLookTarget);

    // Camera orbit via OrbitControls
    camera = new THREE.PerspectiveCamera(CAM.fov, 1, CAM.near, CAM.far);
    const isPortrait = host.clientHeight > host.clientWidth;
    const cameraSeatAngle = Math.PI / 2;
    const cameraBackOffset = (isPortrait ? 2.55 : 1.78) + 0.35;
    const cameraForwardOffset = isPortrait ? 0.08 : 0.2;
    const cameraHeightOffset = isPortrait ? 1.72 : 1.34;
    const cameraRadius = chairDistance + cameraBackOffset - cameraForwardOffset;
    camera.position.set(
      Math.cos(cameraSeatAngle) * cameraRadius + tablePlacementOffset.x,
      tableSurfaceY + cameraHeightOffset,
      Math.sin(cameraSeatAngle) * cameraRadius + tablePlacementOffset.z
    );
    camera.lookAt(boardLookTarget);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.enableZoom = true;
    controls.minDistance = CAMERA_3D_MIN_RADIUS;
    controls.maxDistance = CAMERA_3D_MAX_RADIUS;
    controls.minPolarAngle = CAMERA_PULL_FORWARD_MIN;
    controls.maxPolarAngle = CAM.phiMax;
    controls.rotateSpeed = 0.85;
    controls.zoomSpeed = 0.7;
    controls.panSpeed = 0.6;
    controls.target.copy(boardLookTarget);
    controls.update();
    controlsRef.current = controls;
    syncSkyboxToCamera = () => {
      if (!camera || !boardLookTarget) return;
      const skybox = envSkyboxRef.current;
      if (!skybox) return;
      const radius = camera.position.distanceTo(boardLookTarget);
      const baseRadius = baseCameraRadiusRef.current || radius || 1;
      const baseScale = baseSkyboxScaleRef.current || 1;
      const scale = clamp(radius / baseRadius, 0.35, 3.5);
      skybox.scale.setScalar(baseScale * scale);
      lastCameraRadiusRef.current = radius;
    };
    controls.addEventListener('change', syncSkyboxToCamera);
    disposers.push(() => controls?.removeEventListener('change', syncSkyboxToCamera));

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

      const initialRadius = CAMERA_3D_MAX_RADIUS;
      const default3d = new THREE.Spherical(initialRadius, CAMERA_DEFAULT_PHI, theta);

      if (mode === '2d') {
        cameraMemory.last3d = current;
        controls.target.copy(boardLookTarget);
        controls.enabled = true;
        controls.enableRotate = false;
        controls.enablePan = false;
        controls.enableZoom = true;
        controls.minPolarAngle = CAMERA_TOPDOWN_LOCK;
        controls.maxPolarAngle = CAMERA_TOPDOWN_LOCK;
        controls.minDistance = CAMERA_2D_MIN_RADIUS;
        controls.maxDistance = CAMERA_2D_MAX_RADIUS;
        const targetRadius = clamp(CAMERA_2D_MAX_RADIUS, CAMERA_2D_MIN_RADIUS, CAMERA_2D_MAX_RADIUS);
        if (!initial2dViewRef.current) {
          initial2dViewRef.current = new THREE.Spherical(targetRadius, CAMERA_TOPDOWN_LOCK, 0);
        }
        const target = initial2dViewRef.current;
        animateCameraTo(target, 360);
      } else {
        controls.enabled = true;
        controls.enableRotate = true;
        controls.enablePan = true;
        controls.enableZoom = true;
        controls.minPolarAngle = CAMERA_PULL_FORWARD_MIN;
        controls.maxPolarAngle = CAM.phiMax;
        controls.minDistance = CAMERA_3D_MIN_RADIUS;
        controls.maxDistance = CAMERA_3D_MAX_RADIUS;
        const restore = cameraMemory.last3d || default3d;
        const target = new THREE.Spherical(
          clamp(CAMERA_3D_MAX_RADIUS, CAMERA_3D_MIN_RADIUS, CAMERA_3D_MAX_RADIUS),
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
      const renderScale = renderSettingsRef.current.renderResolutionScale || renderResolutionScale;
      const renderW = Math.max(1, Math.round(w * renderScale));
      const renderH = Math.max(1, Math.round(h * renderScale));
      renderer.setSize(renderW, renderH, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const minDistance = viewModeRef.current === '2d' ? CAMERA_2D_MIN_RADIUS : CAMERA_3D_MIN_RADIUS;
      const maxDistance = viewModeRef.current === '2d' ? CAMERA_2D_MAX_RADIUS : CAMERA_3D_MAX_RADIUS;
      if (viewModeRef.current === '2d') {
        controls.target.copy(boardLookTarget);
      }
      const currentRadius = camera.position.distanceTo(boardLookTarget);
      const radius = clamp(currentRadius || CAMERA_SAFE_MAX_RADIUS, minDistance, maxDistance);
      const dir = camera.position.clone().sub(boardLookTarget).normalize();
      camera.position.copy(boardLookTarget).addScaledVector(dir, radius);
      controls.update();
    };
    fitRef.current = fit;
    fit();
    baseCameraRadiusRef.current = camera.position.distanceTo(boardLookTarget);
    baseSkyboxScaleRef.current =
      envSkyboxRef.current?.scale?.x ?? baseSkyboxScaleRef.current ?? 1;
    syncSkyboxToCamera();

    const captureFxGroup = new THREE.Group();
    scene.add(captureFxGroup);
    const activeCaptureFx = [];
    let board = null;
    let pieceMeshes = null;
    const parkedAirUnits = [];
    const parkedAirUnitPools = {
      white: { jet: [], helicopter: [] },
      black: { jet: [], helicopter: [] }
    };
    const sideVehicleSkinCache = new Map();
    const captureDir = new THREE.Vector3();
    const captureUnitTemplates = {
      drone: null,
      helicopter: null,
      fighter: null
    };
    const captureUnitLoads = {};

    const loadCaptureUnitTemplate = async (key, targetSize) => {
      if (captureUnitTemplates[key]) return captureUnitTemplates[key];
      if (captureUnitLoads[key]) return captureUnitLoads[key];
      const urls = CAPTURE_MODEL_URLS[key] || [];
      const loader = createConfiguredGLTFLoader(renderer);
      const imageCache = new Map();
      const task = (async () => {
        for (const url of urls) {
          try {
            const resolvedUrl = new URL(url, window.location.href).href;
            const resourcePath = resolvedUrl.substring(0, resolvedUrl.lastIndexOf('/') + 1);
            loader.setResourcePath(resourcePath);
            loader.setPath('');
            let model = null;
            try {
              // eslint-disable-next-line no-await-in-loop
              const rawBuffer = await fetchBuffer(resolvedUrl);
              // eslint-disable-next-line no-await-in-loop
              const patchedBuffer = await patchGlbImagesToDataUris(rawBuffer, key, resolvedUrl, urls, imageCache);
              // eslint-disable-next-line no-await-in-loop
              model = await parseObjectFromBuffer(loader, patchedBuffer);
            } catch {
              // Fallback to default GLTF load flow.
            }
            if (!model) {
              // eslint-disable-next-line no-await-in-loop
              const gltf = await new Promise((resolve, reject) => {
                loader.load(resolvedUrl, resolve, undefined, reject);
              });
              model = gltf.scene || gltf.scenes?.[0] || null;
            }
            if (!model) continue;
            model = model.clone?.(true) ?? model;
            prepareCaptureModel(model);
            normalizeModel(model, targetSize);
            captureUnitTemplates[key] = model;
            return model;
          } catch (error) {
            // Try fallback URL.
          }
        }
        return null;
      })();
      captureUnitLoads[key] = task;
      return task;
    };

    const cloneCaptureUnitTemplate = (key) => {
      const template = captureUnitTemplates[key];
      if (!template) return null;
      const clone = cloneSkinned(template);
      prepareCaptureModel(clone);
      return clone;
    };

    void loadCaptureUnitTemplate('drone', 3.7);
    void loadCaptureUnitTemplate('helicopter', 5.2);
    void loadCaptureUnitTemplate('fighter', 5.8);
    void primeCaptureVehicleTextureSets(renderer?.capabilities?.getMaxAnisotropy?.() || 1);

    const addFxBox = (group, size, position, color, roughness = 0.7, metalness = 0.2) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(size[0], size[1], size[2]),
        new THREE.MeshStandardMaterial({ color, roughness, metalness })
      );
      mesh.position.set(position[0], position[1], position[2]);
      mesh.castShadow = true;
      group.add(mesh);
      return mesh;
    };
    const addFxCylinder = (group, rt, rb, h, position, rotation, color, radialSegments = 16, roughness = 0.62, metalness = 0.28) => {
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(rt, rb, h, radialSegments),
        new THREE.MeshStandardMaterial({ color, roughness, metalness })
      );
      mesh.position.set(position[0], position[1], position[2]);
      mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
      mesh.castShadow = true;
      group.add(mesh);
      return mesh;
    };
    const addFxSphere = (group, radius, position, color, roughness = 0.45, metalness = 0.25, transparent = false, opacity = 1) => {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 16, 16),
        new THREE.MeshStandardMaterial({ color, roughness, metalness, transparent, opacity })
      );
      mesh.position.set(position[0], position[1], position[2]);
      mesh.castShadow = true;
      group.add(mesh);
      return mesh;
    };
    const createFxPolygon = (points, depth, color, roughness = 0.62, metalness = 0.18) => {
      const shape = new THREE.Shape();
      shape.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i += 1) shape.lineTo(points[i][0], points[i][1]);
      shape.closePath();
      const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 });
      geometry.translate(0, 0, -depth / 2);
      geometry.rotateX(Math.PI / 2);
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({ color, roughness, metalness })
      );
      mesh.castShadow = true;
      return mesh;
    };
    const findCaptureRotor = (model, role = 'main') => {
      if (!model) return null;
      const modelBounds = new THREE.Box3().setFromObject(model);
      const modelSize = new THREE.Vector3();
      modelBounds.getSize(modelSize);
      const maxModelDim = Math.max(modelSize.x, modelSize.y, modelSize.z) || 1;
      const modelCenter = modelBounds.getCenter(new THREE.Vector3());
      const roleMatchers =
        role === 'tail'
          ? [/tail/i, /back/i, /rear/i]
          : [/main/i, /top/i, /upper/i];
      let best = null;
      let bestScore = Number.NEGATIVE_INFINITY;
      model.traverse((node) => {
        if (!node || node === model) return;
        const name = `${node.name || ''}`.toLowerCase();
        if (!/rotor|propell|blade|fan/.test(name)) return;
        const bounds = new THREE.Box3().setFromObject(node);
        const size = new THREE.Vector3();
        bounds.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z) || 0;
        const minDim = Math.min(size.x || 0, size.y || 0, size.z || 0);
        if (!Number.isFinite(maxDim) || maxDim <= 0 || maxDim > maxModelDim * (role === 'main' ? 0.9 : 0.45)) return;
        if (!Number.isFinite(minDim) || minDim > maxModelDim * 0.18) return;
        const center = bounds.getCenter(new THREE.Vector3());
        const roleMatch = roleMatchers.some((matcher) => matcher.test(name));
        const spanBias = maxDim / Math.max(minDim, 1e-3);
        const sizeBias = role === 'main' ? maxDim * 0.35 : -maxDim * 0.12;
        const verticalBias = role === 'main' ? (center.y - modelCenter.y) * 2.2 : 0;
        const tailXBias = role === 'tail' ? (modelCenter.x - center.x) * 1.7 : 0;
        const score = (roleMatch ? 3 : 0) + spanBias * 0.08 + sizeBias + verticalBias + tailXBias;
        if (score > bestScore) {
          bestScore = score;
          best = node;
        }
      });
      return best;
    };
    const findJetExhaustAnchor = (model) => {
      if (!model) return new THREE.Vector3(-1.9, 0, 0);
      const candidates = [];
      model.traverse((node) => {
        if (!node?.isMesh) return;
        const name = `${node.name || ''}`.toLowerCase();
        if (!/engine|exhaust|nozzle|thruster|afterburn|jet/.test(name)) return;
        const box = new THREE.Box3().setFromObject(node);
        if (box.isEmpty()) return;
        const center = new THREE.Vector3();
        box.getCenter(center);
        const size = new THREE.Vector3();
        box.getSize(size);
        const score = (box.min.x * -1) + Math.max(size.y, size.z) * 0.2;
        candidates.push({ center, score });
      });
      if (!candidates.length) return new THREE.Vector3(-1.9, 0, 0);
      candidates.sort((a, b) => b.score - a.score);
      const anchor = candidates[0].center.clone();
      model.worldToLocal(anchor);
      return anchor;
    };
    const createJetExhaustClouds = (root, count = 6, start = [-1.95, 0, 0], stepX = 0.2) => {
      const clouds = [];
      for (let i = 0; i < count; i += 1) {
        clouds.push(
          addFxSphere(
            root,
            0.12 + i * 0.035,
            [start[0] - i * stepX, start[1], start[2]],
            i < 2 ? '#f7a94b' : '#8b949b',
            i < 2 ? 0.22 : 1,
            0,
            true,
            i < 2 ? 0.85 - i * 0.18 : 0.28 - (i - 2) * 0.045
          )
        );
      }
      return clouds;
    };
    const toHexColor = (value, fallback) => {
      const color = new THREE.Color(value || fallback);
      return `#${color.getHexString()}`;
    };
    const getCaptureToneSeed = (kind = 'generic') => {
      const boardTheme = paletteRef.current?.board ?? BASE_BOARD_THEME;
      return {
        base: toHexColor(boardTheme.dark, '#313940'),
        mid: toHexColor(boardTheme.frameDark, '#74818b'),
        dark: toHexColor(boardTheme.frameLight, '#2f353b'),
        grid: toHexColor(boardTheme.light, '#a9b3bc'),
        kind
      };
    };
    const resolveSideVehicleSkin = (isWhiteSide) => {
      const cacheKey = isWhiteSide ? 'white' : 'black';
      if (sideVehicleSkinCache.has(cacheKey)) return sideVehicleSkinCache.get(cacheKey);
      for (let r = 0; r < 8; r += 1) {
        for (let c = 0; c < 8; c += 1) {
          const boardPiece = board?.[r]?.[c];
          if (!boardPiece || boardPiece.w !== isWhiteSide || boardPiece.t !== 'P') continue;
          const skin = extractVehicleSkinFromPiece(pieceMeshes?.[r]?.[c]);
          if (skin) {
            sideVehicleSkinCache.set(cacheKey, skin);
            return skin;
          }
        }
      }
      const fallbackPiece = isWhiteSide
        ? pieceMeshes?.[6]?.[0] || pieceMeshes?.[7]?.[0]
        : pieceMeshes?.[1]?.[0] || pieceMeshes?.[0]?.[0];
      const fallbackSkin = extractVehicleSkinFromPiece(fallbackPiece);
      sideVehicleSkinCache.set(cacheKey, fallbackSkin || null);
      return fallbackSkin || null;
    };
    const createAvatarBadgeTexture = (label = '🙂') => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(64, 64, 60, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 8;
      ctx.strokeStyle = '#f8fafc';
      ctx.stroke();
      ctx.font = '700 58px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(`${label}`.slice(0, 2), 64, 68);
      const texture = new THREE.CanvasTexture(canvas);
      applySRGBColorSpace(texture);
      return texture;
    };
    const resolveBadgeLabel = (value, fallback = '🙂') => {
      if (!value) return fallback;
      if (typeof value === 'string' && /^https?:\/\//i.test(value)) {
        return fallback;
      }
      return `${value}`.trim().slice(0, 2) || fallback;
    };
    const attachVehicleAvatarBadge = (root, label = '🙂', sideSign = 1) => {
      if (!root) return null;
      const texture = createAvatarBadgeTexture(resolveBadgeLabel(label));
      if (!texture) return null;
      const badge = new THREE.Mesh(
        new THREE.CircleGeometry(0.16, 28),
        new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide })
      );
      badge.position.set(0.1, 0.2, sideSign >= 0 ? 0.22 : -0.22);
      badge.rotation.y = sideSign >= 0 ? Math.PI / 2 : -Math.PI / 2;
      root.add(badge);
      return badge;
    };
    const createFxDrone = ({ forceProcedural = false } = {}) => {
      const model = forceProcedural ? null : cloneCaptureUnitTemplate('drone');
      if (model) {
        const root = new THREE.Group();
        root.add(model);
        const propeller =
          model.getObjectByName('propeller') ||
          model.getObjectByName('Propeller') ||
          model.getObjectByName('Rotor') ||
          model;
        applyMilitaryDroneLook(model, propeller, getCaptureToneSeed('drone'));
        return { root, propeller, exhaustClouds: [] };
      }
      const root = new THREE.Group();
      root.scale.setScalar(0.3);
      addFxCylinder(root, 0.14, 0.19, 2.75, [0, 0, 0], [0, 0, Math.PI / 2], '#cfd3d6', 20);
      const nose = new THREE.Mesh(
        new THREE.ConeGeometry(0.18, 0.72, 20),
        new THREE.MeshStandardMaterial({ color: '#d9dde0', roughness: 0.5, metalness: 0.18 })
      );
      nose.position.set(1.7, 0, 0);
      nose.rotation.z = -Math.PI / 2;
      nose.castShadow = true;
      root.add(nose);
      addFxCylinder(root, 0.18, 0.14, 0.48, [-1.58, 0, 0], [0, 0, Math.PI / 2], '#879095', 14);
      const deltaWing = createFxPolygon(
        [
          [-1.2, -2.05],
          [1.0, 0],
          [-1.2, 2.05]
        ],
        0.08,
        '#556b2f',
        0.82,
        0.08
      );
      deltaWing.position.set(-0.15, -0.06, 0);
      root.add(deltaWing);
      const spine = createFxPolygon(
        [
          [-0.55, -0.18],
          [0.9, 0],
          [-0.55, 0.18]
        ],
        0.06,
        '#7d858a',
        0.55,
        0.22
      );
      spine.position.set(0.15, 0.03, 0);
      root.add(spine);
      addFxSphere(root, 0.09, [1.05, 0, 0], '#1f2428', 0.22, 0.35);
      const propeller = new THREE.Group();
      propeller.position.set(-1.95, 0, 0);
      addFxBox(propeller, [0.05, 1.0, 0.08], [0, 0, 0], '#191d20', 0.6, 0.12);
      const blade2 = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 1.0, 0.08),
        new THREE.MeshStandardMaterial({ color: '#191d20', roughness: 0.6 })
      );
      blade2.rotation.x = Math.PI / 2;
      blade2.castShadow = true;
      propeller.add(blade2);
      addFxSphere(propeller, 0.07, [0, 0, 0], '#41484d', 0.45, 0.25);
      root.add(propeller);

      const exhaustClouds = [];
      for (let i = 0; i < 5; i += 1) {
        exhaustClouds.push(
          addFxSphere(
            root,
            0.12 + i * 0.03,
            [-0.84 - i * 0.19, 0, 0],
            i < 2 ? '#f6af4b' : '#8f989d',
            i < 2 ? 0.2 : 1,
            0,
            true,
            i < 2 ? 0.8 - i * 0.15 : 0.26 - (i - 2) * 0.04
          )
        );
      }
      return { root, propeller, exhaustClouds };
    };
    const createFxHelicopter = () => {
      const model = cloneCaptureUnitTemplate('helicopter');
      if (model) {
        const root = new THREE.Group();
        model.rotation.set(0, 0, 0);
        root.add(model);
        const tailRotor = findCaptureRotor(model, 'tail');
        let topRotor = findCaptureRotor(model, 'main');
        if (!topRotor) {
          model.traverse((node) => {
            if (topRotor || !node?.isMesh || node === tailRotor) return;
            const name = `${node.name || ''}`.toLowerCase();
            if (/rotor|propell|blade|fan/.test(name)) {
              topRotor = node;
            }
          });
        }
        applyMilitaryHelicopterLook(model, topRotor, tailRotor, getCaptureToneSeed('helicopter'));
        const topRotorAxis = inferRotorSpinAxis(topRotor, 'y');
        const tailRotorAxis = inferRotorSpinAxis(tailRotor, 'x');
        return { root, topRotor, tailRotor, topRotorAxis, tailRotorAxis, exhaustClouds: [] };
      }
      const root = new THREE.Group();
      addFxCylinder(root, 0.2, 0.24, 2.5, [0.05, 0, 0], [0, 0, Math.PI / 2], '#96a0a8', 20);
      const cockpit = addFxSphere(root, 0.26, [0.75, 0.08, 0], '#304351', 0.24, 0.35);
      cockpit.scale.set(1.35, 0.72, 0.9);
      addFxBox(root, [1.4, 0.07, 0.2], [-0.12, 0.05, 0], '#8c959d', 0.58, 0.2);
      addFxBox(root, [0.62, 0.12, 0.12], [-1.18, 0.08, 0], '#8b949b', 0.58, 0.18);
      addFxCylinder(root, 0.05, 0.05, 0.68, [-1.65, 0.11, 0], [0, 0, Math.PI / 2], '#7a848d', 14);
      addFxBox(root, [0.95, 0.03, 0.03], [0.05, -0.34, -0.2], '#616a72', 0.7, 0.1);
      addFxBox(root, [0.95, 0.03, 0.03], [0.05, -0.34, 0.2], '#616a72', 0.7, 0.1);
      const topRotor = new THREE.Group();
      topRotor.position.set(0.02, 0.34, 0);
      addFxBox(topRotor, [0.1, 0.05, 0.1], [0, 0, 0], '#3a434a', 0.5, 0.22);
      addFxBox(topRotor, [0.08, 0.02, 1.35], [0, 0, 0], '#1f252a', 0.55, 0.08);
      addFxBox(topRotor, [1.35, 0.02, 0.08], [0, 0, 0], '#1f252a', 0.55, 0.08);
      root.add(topRotor);
      const tailRotor = new THREE.Group();
      tailRotor.position.set(-1.66, 0.11, 0);
      addFxBox(tailRotor, [0.03, 0.38, 0.03], [0, 0, 0], '#21272d', 0.55, 0.08);
      addFxBox(tailRotor, [0.03, 0.03, 0.38], [0, 0, 0], '#21272d', 0.55, 0.08);
      root.add(tailRotor);
      const exhaustClouds = [];
      for (let i = 0; i < 6; i += 1) {
        exhaustClouds.push(
          addFxSphere(root, 0.1 + i * 0.024, [-1.05 - i * 0.18, 0, 0], '#8b949b', 1, 0, true, 0.26 - i * 0.03)
        );
      }
      return {
        root,
        topRotor,
        tailRotor,
        topRotorAxis: new THREE.Vector3(0, 1, 0),
        tailRotorAxis: new THREE.Vector3(1, 0, 0),
        exhaustClouds
      };
    };
    const createFxJet = () => {
      const model = cloneCaptureUnitTemplate('fighter');
      if (model) {
        const root = new THREE.Group();
        model.rotation.set(0, 0, 0);
        root.add(model);
        applyMilitaryJetLook(model, getCaptureToneSeed('fighter'));
        const cockpit =
          model.getObjectByName('cockpit') ||
          model.getObjectByName('Cockpit') ||
          model;
        const detectedExhaustAnchor = findJetExhaustAnchor(model);
        const exhaustAnchor = detectedExhaustAnchor.lerp(new THREE.Vector3(-1.95, 0, 0), 0.9);
        const exhaustClouds = createJetExhaustClouds(
          root,
          6,
          [exhaustAnchor.x, exhaustAnchor.y, exhaustAnchor.z],
          0.22
        );
        return { root, cockpit, leftStore: null, rightStore: null, exhaustClouds, exhaustAnchor };
      }
      const root = new THREE.Group();
      addFxCylinder(root, 0.16, 0.22, 3.1, [0, 0, 0], [0, 0, Math.PI / 2], '#b8bec5', 24);
      const nose = new THREE.Mesh(
        new THREE.ConeGeometry(0.17, 0.96, 24),
        new THREE.MeshStandardMaterial({ color: '#d7dbe0', roughness: 0.45, metalness: 0.2 })
      );
      nose.position.set(2.0, 0, 0);
      nose.rotation.z = -Math.PI / 2;
      nose.castShadow = true;
      root.add(nose);
      const cockpit = addFxSphere(root, 0.2, [0.62, 0.15, 0], '#2d3945', 0.18, 0.3);
      cockpit.scale.set(1.2, 0.58, 0.64);
      const wing = createFxPolygon([[-1.52, -2.32], [0.75, 0], [-0.35, 2.32]], 0.1, '#9fa7ae', 0.68, 0.16);
      wing.position.set(-0.2, -0.05, 0);
      root.add(wing);
      const tailWing = createFxPolygon([[-0.92, -1.1], [0.3, 0], [-0.35, 1.1]], 0.08, '#959ea5', 0.65, 0.18);
      tailWing.position.set(-1.35, 0.04, 0);
      root.add(tailWing);
      const fin = createFxPolygon([[-0.52, 0], [0.22, 0], [-0.1, 0.95]], 0.05, '#8e979f', 0.6, 0.18);
      fin.rotation.z = Math.PI / 2;
      fin.position.set(-1.1, 0.55, 0);
      root.add(fin);
      const engineLeft = addFxCylinder(root, 0.12, 0.1, 0.78, [-1.95, -0.08, -0.2], [0, 0, Math.PI / 2], '#727b83', 16);
      const engineRight = engineLeft.clone();
      engineRight.position.z = 0.2;
      root.add(engineRight);
      const leftStore = new THREE.Group();
      addFxCylinder(leftStore, 0.04, 0.05, 0.55, [0, 0, 0], [0, 0, Math.PI / 2], '#d9dde2', 12, 0.22, 0.84);
      const leftStoreNose = new THREE.Mesh(
        new THREE.ConeGeometry(0.05, 0.14, 12),
        new THREE.MeshStandardMaterial({ color: '#eef1f5', roughness: 0.18, metalness: 0.86 })
      );
      leftStoreNose.position.set(0.34, 0, 0);
      leftStoreNose.rotation.z = -Math.PI / 2;
      leftStore.add(leftStoreNose);
      leftStore.position.set(0.25, -0.25, -1.15);
      root.add(leftStore);
      const rightStore = leftStore.clone();
      rightStore.position.z = 1.15;
      root.add(rightStore);
      const exhaustAnchor = new THREE.Vector3(-1.95, 0, 0);
      const exhaustClouds = createJetExhaustClouds(root, 8, [exhaustAnchor.x, exhaustAnchor.y, exhaustAnchor.z], 0.26);
      return { root, cockpit, leftStore, rightStore, exhaustClouds, exhaustAnchor };
    };
    const getAirPadAnchor = (isWhiteSide, kind = 'jet', slotIndex = 0) => {
      const sideInset = tile * 0.62;
      const sideX = isWhiteSide ? -(half - sideInset) : half - sideInset;
      const zBase = kind === 'jet' ? tile * 1.32 : -tile * 1.32;
      const laneSpacing = tile * 0.9;
      const zOffset = zBase + (slotIndex - 0.5) * laneSpacing;
      return new THREE.Vector3(sideX, currentPieceYOffset + 0.12, zOffset);
    };
    const createFxMissile = () => {
      const missileTone = getCaptureToneSeed('missile');
      const root = new THREE.Group();
      const body = addFxCylinder(root, 0.05, 0.06, 0.72, [0, 0, 0], [0, 0, Math.PI / 2], '#d9dde2', 14, 0.2, 0.86);
      body.material = createCaptureVehicleMaterial('missile', { toneSeed: missileTone, color: '#d9dde2', roughness: 0.2, metalness: 0.86 });
      const nose = new THREE.Mesh(
        new THREE.ConeGeometry(0.055, 0.18, 14),
        createCaptureVehicleMaterial('missile', { toneSeed: missileTone, color: '#eef2f6', roughness: 0.16, metalness: 0.9 })
      );
      nose.position.set(0.45, 0, 0);
      nose.rotation.z = -Math.PI / 2;
      root.add(nose);
      addFxBox(root, [0.1, 0.02, 0.16], [-0.18, 0, 0], '#8f979e', 0.28, 0.72);
      addFxBox(root, [0.1, 0.16, 0.02], [-0.18, 0, 0], '#8f979e', 0.28, 0.72);
      addFxCylinder(root, 0.055, 0.055, 0.14, [-0.42, 0, 0], [0, 0, Math.PI / 2], '#12161b', 14, 0.34, 0.58);
      const trail = [];
      for (let i = 0; i < 4; i += 1) {
        trail.push(addFxSphere(root, 0.08 + i * 0.02, [-0.5 - i * 0.14, 0, 0], '#90989d', 1, 0, true, 0.22 - i * 0.03));
      }
      return { root, trail };
    };
    const createFxGroundMissile = () => {
      const missileTone = getCaptureToneSeed('missile');
      const root = new THREE.Group();
      const body = addFxCylinder(root, 0.07, 0.08, 1.02, [0, 0, 0], [0, 0, Math.PI / 2], '#556b2f', 16, 0.24, 0.82);
      body.material = createCaptureVehicleMaterial('missile', { toneSeed: missileTone, color: '#556b2f', roughness: 0.24, metalness: 0.82 });
      const nose = new THREE.Mesh(
        new THREE.ConeGeometry(0.08, 0.24, 16),
        createCaptureVehicleMaterial('missile', { toneSeed: missileTone, color: '#7a8f45', roughness: 0.2, metalness: 0.86 })
      );
      nose.position.set(0.63, 0, 0);
      nose.rotation.z = -Math.PI / 2;
      root.add(nose);
      addFxBox(root, [0.14, 0.02, 0.28], [-0.15, 0, 0], '#6b7f3d', 0.24, 0.76);
      addFxBox(root, [0.14, 0.28, 0.02], [-0.15, 0, 0], '#6b7f3d', 0.24, 0.76);
      addFxBox(root, [0.1, 0.02, 0.18], [-0.36, 0, 0], '#5e7035', 0.28, 0.72);
      addFxBox(root, [0.1, 0.18, 0.02], [-0.36, 0, 0], '#5e7035', 0.28, 0.72);
      addFxCylinder(root, 0.075, 0.075, 0.16, [-0.55, 0, 0], [0, 0, Math.PI / 2], '#101419', 16, 0.34, 0.62);
      const rotor = new THREE.Group();
      rotor.position.set(-0.48, 0, 0);
      addFxBox(rotor, [0.03, 0.54, 0.04], [0, 0, 0], '#090b0d', 0.5, 0.35);
      const rotorCross = addFxBox(rotor, [0.03, 0.04, 0.54], [0, 0, 0], '#090b0d', 0.5, 0.35);
      rotorCross.rotation.x = Math.PI / 2;
      root.add(rotor);
      const trail = [];
      for (let i = 0; i < 5; i += 1) {
        trail.push(
          addFxSphere(
            root,
            0.1 + i * 0.025,
            [-0.7 - i * 0.16, 0, 0],
            i < 2 ? '#f6af4b' : '#8f989d',
            i < 2 ? 0.2 : 1,
            0,
            true,
            i < 2 ? 0.8 - i * 0.15 : 0.26 - (i - 2) * 0.04
          )
        );
      }
      return { root, trail, rotor };
    };
    const createFxExplosion = (position) => {
      const root = new THREE.Group();
      root.position.copy(position);
      root.scale.setScalar(CAPTURE_EXPLOSION_SCALE);
      const flash = addFxSphere(root, 0.18, [0, 0.25, 0], '#ffe59a', 0.08, 0, true, 1);
      const fire = [];
      const smoke = [];
      const firePalette = ['#ffd166', '#ff8c1a', '#ff4d3d', '#d7263d', '#ff8fab', '#ffe45e'];
      for (let i = 0; i < 6; i += 1) {
        fire.push(
          addFxSphere(
            root,
            0.21 + i * 0.05,
            [0, 0.2 + i * 0.045, 0],
            firePalette[i % firePalette.length],
            0.2,
            0,
            true,
            0.98 - i * 0.1
          )
        );
      }
      for (let i = 0; i < 6; i += 1) {
        smoke.push(
          addFxSphere(
            root,
            0.17 + i * 0.037,
            [0, 0.165 + i * 0.067, 0],
            '#646b72',
            1,
            0,
            true,
            0.34 - i * 0.035
          )
        );
      }
      return { root, flash, fire, smoke };
    };
    const launchExplosion = (position) => {
      const explosion = createFxExplosion(position);
      captureFxGroup.add(explosion.root);
      playAudio(bombSoundRef, { maxDurationMs: 520 });
      playAudio(missileImpactSoundRef);
      activeCaptureFx.push({ type: 'explosion', t: 0, duration: LUDO_CAPTURE_EXPLOSION_TIME, explosion });
    };
    const qBezier = (a, b, c, t) => {
      const ab = new THREE.Vector3().copy(a).lerp(b, t);
      const bc = new THREE.Vector3().copy(b).lerp(c, t);
      return ab.lerp(bc, t);
    };
    const constrainInsideBoardPerimeter = (vector, marginTiles = 0.42) => {
      const margin = BOARD.tile * marginTiles;
      const boardHalf = (BOARD.N * BOARD.tile) / 2 - margin;
      vector.x = THREE.MathUtils.clamp(vector.x, -boardHalf, boardHalf);
      vector.z = THREE.MathUtils.clamp(vector.z, -boardHalf, boardHalf);
      return vector;
    };
    const getLiveLaunchPosition = (fallback, movingMesh = null, lift = 0.08) => {
      const launchPos = fallback.clone();
      if (movingMesh?.parent) {
        movingMesh.getWorldPosition(launchPos);
      }
      launchPos.y += lift;
      return launchPos;
    };
    const getCaptureOrbitPose = ({
      from,
      to,
      progress,
      launchHeight = 0.2,
      orbitRadiusMul = 0.74,
      minOrbitCycles = 0.28,
      liftSplit = 0.18,
      strikeSplit = 0.76
    }) => {
      const launchPos = from.clone().add(new THREE.Vector3(0, launchHeight, 0));
      const impactPos = to.clone();
      const travel = impactPos.clone().sub(launchPos);
      const planarTravel = new THREE.Vector3(travel.x, 0, travel.z);
      const travelLen = Math.max(0.001, planarTravel.length());
      planarTravel.normalize();
      const sideVec = new THREE.Vector3(-planarTravel.z, 0, planarTravel.x);
      const orbitRadius = THREE.MathUtils.clamp(travelLen * orbitRadiusMul * 0.32, tile * 0.38, tile * 1.12);
      const liftEnd = launchPos.clone().add(new THREE.Vector3(0.26, CAPTURE_FLIGHT_ALTITUDE * 0.66, -0.12));
      const orbitExit = launchPos
        .clone()
        .addScaledVector(planarTravel, travelLen * (0.62 + minOrbitCycles * 0.16))
        .addScaledVector(sideVec, orbitRadius);
      const u = clamp01(progress);
      let pos;
      let next;
      if (u < liftSplit) {
        const liftU = smoothEase(u / liftSplit);
        pos = new THREE.Vector3().copy(launchPos).lerp(liftEnd, liftU);
        pos.y += Math.sin(liftU * Math.PI * 1.6) * 0.04;
        next = new THREE.Vector3().copy(launchPos).lerp(liftEnd, clamp01(liftU + 0.04));
      } else if (u < strikeSplit) {
        const orbitU = smoothEase((u - liftSplit) / (strikeSplit - liftSplit));
        const forwardNow = THREE.MathUtils.lerp(travelLen * 0.06, travelLen * 0.62, orbitU);
        const forwardNext = THREE.MathUtils.lerp(
          travelLen * 0.06,
          travelLen * 0.62,
          clamp01(orbitU + 0.03)
        );
        const sideNow = Math.sin(orbitU * Math.PI) * orbitRadius;
        const sideNext = Math.sin(clamp01(orbitU + 0.03) * Math.PI) * orbitRadius;
        pos = launchPos.clone().addScaledVector(planarTravel, forwardNow).addScaledVector(sideVec, sideNow);
        next = launchPos.clone().addScaledVector(planarTravel, forwardNext).addScaledVector(sideVec, sideNext);
        pos.y = CAPTURE_FLIGHT_ALTITUDE * 0.56 + Math.sin(orbitU * Math.PI * 2) * 0.04;
        next.y = CAPTURE_FLIGHT_ALTITUDE * 0.56 + Math.sin(clamp01(orbitU + 0.03) * Math.PI * 2) * 0.04;
      } else {
        const strikeU = smoothEase((u - strikeSplit) / (1 - strikeSplit));
        pos = new THREE.Vector3().copy(orbitExit).lerp(impactPos, strikeU);
        next = new THREE.Vector3().copy(orbitExit).lerp(impactPos, clamp01(strikeU + 0.05));
      }
      return { pos, next };
    };
    const getCaptureRingOrbitPose = ({
      from,
      to,
      progress,
      launchHeight = 0.12,
      orbitHeight = CAPTURE_FLIGHT_ALTITUDE * 0.3,
      orbitRadiusMul = 0.72,
      minOrbitCycles = 0.25,
      orbitSplit = 0.74
    }) => {
      const launchPos = from.clone().add(new THREE.Vector3(0, launchHeight, 0));
      const impactPos = to.clone();
      const travel = impactPos.clone().sub(launchPos);
      const planarTravel = new THREE.Vector3(travel.x, 0, travel.z);
      const travelLen = Math.max(0.001, planarTravel.length());
      planarTravel.normalize();
      const sideVec = new THREE.Vector3(-planarTravel.z, 0, planarTravel.x);
      const orbitRadius = THREE.MathUtils.clamp(travelLen * orbitRadiusMul * 0.26, tile * 0.28, tile * 0.95);
      const orbitExit = launchPos
        .clone()
        .addScaledVector(planarTravel, travelLen * (0.6 + minOrbitCycles * 0.1))
        .addScaledVector(sideVec, orbitRadius);
      const u = clamp01(progress);
      if (u < orbitSplit) {
        const orbitU = smoothEase(u / orbitSplit);
        const forwardNow = THREE.MathUtils.lerp(travelLen * 0.04, travelLen * 0.6, orbitU);
        const forwardNext = THREE.MathUtils.lerp(
          travelLen * 0.04,
          travelLen * 0.6,
          clamp01(orbitU + 0.02)
        );
        const sideNow = Math.sin(orbitU * Math.PI) * orbitRadius;
        const sideNext = Math.sin(clamp01(orbitU + 0.02) * Math.PI) * orbitRadius;
        const pos = launchPos.clone().addScaledVector(planarTravel, forwardNow).addScaledVector(sideVec, sideNow);
        const next = launchPos
          .clone()
          .addScaledVector(planarTravel, forwardNext)
          .addScaledVector(sideVec, sideNext);
        pos.y = THREE.MathUtils.lerp(launchPos.y, orbitHeight, orbitU) + Math.sin(orbitU * Math.PI * 2) * 0.03;
        next.y =
          THREE.MathUtils.lerp(launchPos.y, orbitHeight, clamp01(orbitU + 0.02)) +
          Math.sin(clamp01(orbitU + 0.02) * Math.PI * 2) * 0.03;
        return { pos: constrainInsideBoardPerimeter(pos), next: constrainInsideBoardPerimeter(next) };
      }
      const strikeU = smoothEase((u - orbitSplit) / (1 - orbitSplit));
      const pos = orbitExit.clone().lerp(impactPos, strikeU);
      const next = orbitExit.clone().lerp(impactPos, clamp01(strikeU + 0.05));
      return { pos, next };
    };
    const getCaptureLoopPose = ({
      from,
      to,
      progress,
      launchHeight = 0.08,
      orbitHeight = CAPTURE_FLIGHT_ALTITUDE * 0.62,
      orbitRadiusMul = 0.9,
      minOrbitCycles = 0.34,
      orbitSplit = 0.82,
      returnToOrigin = false,
      returnSplit = 0.78,
      sideSign = 1
    }) => {
      const clampIfNeeded = (value) => constrainInsideBoardPerimeter(value);
      const launchPos = from.clone().add(new THREE.Vector3(0, launchHeight, 0));
      const impactPos = to.clone();
      const travel = impactPos.clone().sub(launchPos);
      const planarTravel = new THREE.Vector3(travel.x, 0, travel.z);
      const travelLen = Math.max(0.001, planarTravel.length());
      planarTravel.normalize();
      const sideVec = new THREE.Vector3(-planarTravel.z, 0, planarTravel.x).multiplyScalar(sideSign >= 0 ? 1 : -1);
      const orbitRadius = THREE.MathUtils.clamp(travelLen * orbitRadiusMul * 0.28, tile * 0.32, tile * 1.06);
      const orbitExit = launchPos
        .clone()
        .addScaledVector(planarTravel, travelLen * (0.62 + minOrbitCycles * 0.12))
        .addScaledVector(sideVec, orbitRadius);
      const u = clamp01(progress);
      if (u < orbitSplit) {
        const orbitU = smoothEase(u / orbitSplit);
        const forwardNow = THREE.MathUtils.lerp(travelLen * 0.04, travelLen * 0.62, orbitU);
        const forwardNext = THREE.MathUtils.lerp(
          travelLen * 0.04,
          travelLen * 0.62,
          clamp01(orbitU + 0.02)
        );
        const sideNow = Math.sin(orbitU * Math.PI) * orbitRadius;
        const sideNext = Math.sin(clamp01(orbitU + 0.02) * Math.PI) * orbitRadius;
        const pos = launchPos.clone().addScaledVector(planarTravel, forwardNow).addScaledVector(sideVec, sideNow);
        const next = launchPos
          .clone()
          .addScaledVector(planarTravel, forwardNext)
          .addScaledVector(sideVec, sideNext);
        pos.y = THREE.MathUtils.lerp(launchPos.y, orbitHeight, orbitU) + Math.sin(orbitU * Math.PI * 2) * 0.04;
        next.y =
          THREE.MathUtils.lerp(launchPos.y, orbitHeight, clamp01(orbitU + 0.02)) +
          Math.sin(clamp01(orbitU + 0.02) * Math.PI * 2) * 0.04;
        return { pos: clampIfNeeded(pos), next: clampIfNeeded(next) };
      }
      if (returnToOrigin) {
        const returnU = smoothEase((u - orbitSplit) / Math.max(0.001, 1 - orbitSplit));
        const returnTarget = launchPos.clone();
        returnTarget.y = Math.max(returnTarget.y, orbitHeight * 0.9);
        const returnPos = orbitExit.clone().lerp(returnTarget, returnU);
        const returnNext = orbitExit.clone().lerp(returnTarget, clamp01(returnU + 0.05));
        return { pos: clampIfNeeded(returnPos), next: clampIfNeeded(returnNext) };
      }
      const strikeU = smoothEase((u - orbitSplit) / (1 - orbitSplit));
      const dropStart = new THREE.Vector3(impactPos.x, Math.max(orbitHeight * 0.95, impactPos.y + 0.44), impactPos.z);
      const pos =
        strikeU < returnSplit
          ? orbitExit.clone().lerp(dropStart, strikeU / returnSplit)
          : dropStart.clone().lerp(impactPos, (strikeU - returnSplit) / Math.max(0.001, 1 - returnSplit));
      const next =
        strikeU < returnSplit
          ? orbitExit.clone().lerp(dropStart, clamp01(strikeU / returnSplit + 0.04))
          : dropStart.clone().lerp(impactPos, clamp01((strikeU - returnSplit) / Math.max(0.001, 1 - returnSplit) + 0.06));
      if (strikeU >= returnSplit) {
        next.x = pos.x;
        next.z = pos.z;
      }
      return { pos: clampIfNeeded(pos), next: clampIfNeeded(next) };
    };

    const playCaptureAnimation = ({
      fromPos,
      targetPos,
      movingType,
      movingMesh = null,
      distance,
      deltaR = 0,
      deltaC = 0
    }) => {
      const pieceType = (movingType || '').toUpperCase();
      if (pieceType === 'R') {
        suppressTimerBeepUntilRef.current = performance.now() + CAPTURE_GROUND_TOTAL * 1000;
        const missileFx = createFxGroundMissile();
        missileFx.root.scale.setScalar(CAPTURE_ROOK_JAVELIN_SCALE);
        const launchBase = fromPos.clone();
        missileFx.root.position.copy(launchBase.clone().add(new THREE.Vector3(0, 0.03, 0)));
        captureFxGroup.add(missileFx.root);
        playAudio(missileLaunchSoundRef);
        activeCaptureFx.push({
          type: 'javelin',
          t: 0,
          duration: CAPTURE_GROUND_TOTAL,
          from: fromPos.clone(),
          to: targetPos.clone(),
          launchPos: launchBase.add(new THREE.Vector3(0, 0.03, 0)),
          movingMesh,
          missileFx,
          directPath: false
        });
        return {
          moveDelayMs: CAPTURE_GROUND_TOTAL * 1000,
          captureResolveDelayMs: CAPTURE_GROUND_TOTAL * 1000
        };
      }
      if (pieceType === 'N' || pieceType === 'P') {
        if (pieceType === 'N') {
          suppressTimerBeepUntilRef.current = performance.now() + CAPTURE_GROUND_TOTAL * 1000;
          const droneFx = createFxDrone({ forceProcedural: true });
          droneFx.root.scale.setScalar(CAPTURE_DRONE_SCALE);
          const launchBase = fromPos.clone();
          droneFx.root.position.copy(launchBase.clone().add(new THREE.Vector3(0, 0.08, 0)));
          captureFxGroup.add(droneFx.root);
          playAudio(droneSoundRef, { maxDurationMs: CAPTURE_GROUND_TOTAL * 1000 });
          activeCaptureFx.push({
            type: 'drone',
            t: 0,
            duration: CAPTURE_GROUND_TOTAL,
            from: fromPos.clone(),
            to: targetPos.clone(),
            launchPos: launchBase.add(new THREE.Vector3(0, 0.08, 0)),
            movingMesh,
            droneFx
          });
          return {
            moveDelayMs: CAPTURE_GROUND_TOTAL * 1000,
            captureResolveDelayMs: CAPTURE_GROUND_TOTAL * 1000
          };
        }
        suppressTimerBeepUntilRef.current = performance.now() + CAPTURE_GROUND_TOTAL * 1000;
        const missileFx = createFxGroundMissile();
        missileFx.root.scale.setScalar(CAPTURE_PAWN_JAVELIN_SCALE);
        const launchBase = fromPos.clone();
        missileFx.root.position.copy(launchBase.clone().add(new THREE.Vector3(0, 0.03, 0)));
        captureFxGroup.add(missileFx.root);
        playAudio(missileLaunchSoundRef);
        activeCaptureFx.push({
          type: 'javelin',
          t: 0,
          duration: CAPTURE_GROUND_TOTAL,
          from: fromPos.clone(),
          to: targetPos.clone(),
          launchPos: launchBase.add(new THREE.Vector3(0, 0.03, 0)),
          movingMesh,
          missileFx,
          directPath: false,
          verticalStrike: true
        });
        return {
          moveDelayMs: CAPTURE_GROUND_TOTAL * 1000,
          captureResolveDelayMs: CAPTURE_GROUND_TOTAL * 1000
        };
      }
      if (pieceType === 'K') {
        suppressTimerBeepUntilRef.current = performance.now() + CAPTURE_JET_TOTAL * 1000;
        const isWhiteSide = Boolean(movingMesh?.userData?.w);
        const parkedJet = acquireParkedAirUnit(isWhiteSide, 'jet');
        const jetFx = parkedJet || createFxJet();
        const launchBase = parkedJet?.parkPosition?.clone?.() || getAirPadAnchor(isWhiteSide, 'jet');
        jetFx.root.scale.setScalar(CAPTURE_JET_SCALE * 0.72);
        jetFx.root.position.copy(launchBase.clone().add(new THREE.Vector3(0, 0.08, 0)));
        jetFx.root.visible = true;
        if (!parkedJet) {
          const sideSkin = resolveSideVehicleSkin(isWhiteSide);
          if (sideSkin) applyVehicleSkinToModel(jetFx.root, sideSkin);
          attachVehicleAvatarBadge(
            jetFx.root,
            isWhiteSide
              ? avatar || username || playerFlag || '🙂'
              : (onlineRef.current.enabled ? opponent?.avatar || opponent?.name : null) || opponent?.name || aiFlag || '🤖',
            isWhiteSide ? 1 : -1
          );
          captureFxGroup.add(jetFx.root);
        }
        const missileFx = [createFxGroundMissile(), createFxGroundMissile()];
        missileFx.forEach((missile) => {
          missile.root.scale.setScalar(CAPTURE_MISSILE_SCALE);
          missile.root.visible = false;
          captureFxGroup.add(missile.root);
        });
        activeCaptureFx.push({
          type: 'jet',
          t: 0,
          duration: CAPTURE_JET_TOTAL,
          from: fromPos.clone(),
          to: targetPos.clone(),
          launchPos: launchBase.add(new THREE.Vector3(0, 0.08, 0)),
          movingMesh,
          returnToOrigin: true,
          parkedUnit: parkedJet,
          missileReleaseTime: CAPTURE_JET_TOTAL * CAPTURE_JET_MISSILE_ENTRY_RELEASE_RATIO,
          jetFx,
          missileFx
        });
        const jetImpactDelayMs = CAPTURE_JET_TOTAL * 0.96 * 1000;
        return {
          moveDelayMs: jetImpactDelayMs,
          captureResolveDelayMs: jetImpactDelayMs
        };
      }
      if (pieceType === 'B') {
        suppressTimerBeepUntilRef.current = performance.now() + CAPTURE_HELICOPTER_TOTAL * 1000;
        const isWhiteSide = Boolean(movingMesh?.userData?.w);
        const parkedHelicopter = acquireParkedAirUnit(isWhiteSide, 'helicopter');
        const helicopterFx = parkedHelicopter || createFxHelicopter();
        const launchBase =
          parkedHelicopter?.parkPosition?.clone?.() || getAirPadAnchor(isWhiteSide, 'helicopter');
        helicopterFx.root.scale.setScalar(CAPTURE_HELICOPTER_SCALE * 0.74);
        helicopterFx.root.position.copy(launchBase.clone().add(new THREE.Vector3(0, 0.08, 0)));
        helicopterFx.root.visible = true;
        if (!parkedHelicopter) {
          const sideSkin = resolveSideVehicleSkin(isWhiteSide);
          if (sideSkin) {
            applyVehicleSkinToModel(helicopterFx.root, sideSkin, (node) =>
              /rotor|propell|blade|fan|window|cockpit|glass|canopy/.test(`${node.name || ''}`.toLowerCase())
            );
          }
          attachVehicleAvatarBadge(
            helicopterFx.root,
            isWhiteSide
              ? avatar || username || playerFlag || '🙂'
              : (onlineRef.current.enabled ? opponent?.avatar || opponent?.name : null) || opponent?.name || aiFlag || '🤖',
            isWhiteSide ? 1 : -1
          );
          captureFxGroup.add(helicopterFx.root);
        }
        const missileFx = [createFxGroundMissile(), createFxGroundMissile()];
        missileFx.forEach((missile) => {
          missile.root.scale.setScalar(CAPTURE_MISSILE_SCALE);
          missile.root.visible = false;
          captureFxGroup.add(missile.root);
        });
        playAudio(helicopterSoundRef, { maxDurationMs: CAPTURE_HELICOPTER_TOTAL * 1000 });
        activeCaptureFx.push({
          type: 'helicopter',
          t: 0,
          duration: CAPTURE_HELICOPTER_TOTAL,
          from: fromPos.clone(),
          to: targetPos.clone(),
          launchPos: launchBase.add(new THREE.Vector3(0, 0.08, 0)),
          movingMesh,
          returnToOrigin: true,
          parkedUnit: parkedHelicopter,
          missileReleaseTime: CAPTURE_HELICOPTER_TOTAL * CAPTURE_JET_MISSILE_ENTRY_RELEASE_RATIO,
          helicopterFx,
          missileFx
        });
        const helicopterImpactDelayMs = CAPTURE_HELICOPTER_TOTAL * 0.96 * 1000;
        return {
          moveDelayMs: helicopterImpactDelayMs,
          captureResolveDelayMs: helicopterImpactDelayMs
        };
      }
      if (pieceType === 'Q') {
        suppressTimerBeepUntilRef.current = performance.now() + CAPTURE_JET_TOTAL * 1000;
        const isWhiteSide = Boolean(movingMesh?.userData?.w);
        const parkedJet = acquireParkedAirUnit(isWhiteSide, 'jet');
        const jetFx = parkedJet || createFxJet();
        const launchBase = parkedJet?.parkPosition?.clone?.() || getAirPadAnchor(isWhiteSide, 'jet');
        jetFx.root.scale.setScalar(CAPTURE_JET_SCALE * 0.72);
        jetFx.root.position.copy(launchBase.clone().add(new THREE.Vector3(0, 0.08, 0)));
        jetFx.root.visible = true;
        if (!parkedJet) {
          const sideSkin = resolveSideVehicleSkin(isWhiteSide);
          if (sideSkin) applyVehicleSkinToModel(jetFx.root, sideSkin);
          attachVehicleAvatarBadge(
            jetFx.root,
            isWhiteSide
              ? avatar || username || playerFlag || '🙂'
              : (onlineRef.current.enabled ? opponent?.avatar || opponent?.name : null) || opponent?.name || aiFlag || '🤖',
            isWhiteSide ? 1 : -1
          );
          captureFxGroup.add(jetFx.root);
        }
        const missileFx = [createFxGroundMissile(), createFxGroundMissile()];
        missileFx.forEach((missile) => {
          missile.root.scale.setScalar(CAPTURE_MISSILE_SCALE);
          missile.root.visible = false;
          captureFxGroup.add(missile.root);
        });
        activeCaptureFx.push({
          type: 'jet',
          t: 0,
          duration: CAPTURE_JET_TOTAL,
          from: fromPos.clone(),
          to: targetPos.clone(),
          launchPos: launchBase.add(new THREE.Vector3(0, 0.08, 0)),
          movingMesh,
          returnToOrigin: true,
          parkedUnit: parkedJet,
          missileReleaseTime: CAPTURE_JET_TOTAL * CAPTURE_JET_MISSILE_ENTRY_RELEASE_RATIO,
          jetFx,
          missileFx
        });
        const jetImpactDelayMs = CAPTURE_JET_TOTAL * 0.96 * 1000;
        return {
          moveDelayMs: jetImpactDelayMs,
          captureResolveDelayMs: jetImpactDelayMs
        };
      }
      if (distance <= 1.5) {
        playAudio(swordSoundRef);
        setTimeout(() => playAudio(swordSoundRef), 120);
        setTimeout(() => playAudio(missileImpactSoundRef), 200);
        return { moveDelayMs: 280 };
      }
      if (distance >= 2) {
        playAudio(missileLaunchSoundRef);
        const missileFx = createFxMissile();
        missileFx.root.scale.setScalar(CAPTURE_MISSILE_SCALE);
        captureFxGroup.add(missileFx.root);
        activeCaptureFx.push({ type: 'missile', t: 0, duration: LUDO_CAPTURE_MISSILE_TRAVEL_TIME, from: fromPos.clone(), to: targetPos.clone(), missileFx });
        return { moveDelayMs: LUDO_CAPTURE_TOTAL_TIME * 1000 };
      }
      launchExplosion(targetPos.clone());
      return { moveDelayMs: 280 };
    };

    // Board base + rim
    const tile = BOARD.tile;
    const N = 8;
    const half = (N * tile) / 2;
    let currentBoardModel = null;
    let currentPiecePrototypes = null;
    let currentPieceYOffset = PIECE_PLACEMENT_Y_OFFSET;
    let currentTileSize = tile;
    let currentPieceSetId = initialPieceSetId;
    let currentBoardCleanup = null;
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(N * tile + BOARD.rim * 2, BOARD.baseH, N * tile + BOARD.rim * 2),
      buildVeinedMaterial(boardTheme.frameDark, {
        roughness: boardTheme.frameRoughness,
        metalness: boardTheme.frameMetalness,
        repeat: 2.1,
        normalScale: 0.28
      })
    );
    base.position.set(0, BOARD.baseH / 2, 0);
    boardVisualGroup.add(base);
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(N * tile, 0.12, N * tile),
      buildVeinedMaterial(boardTheme.frameLight, {
        roughness: boardTheme.surfaceRoughness * 0.92,
        metalness: boardTheme.surfaceMetalness,
        repeat: 2.8,
        normalScale: 0.26
      })
    );
    top.position.set(0, BOARD.baseH + 0.06, 0);
    boardVisualGroup.add(top);

    const inlay = new THREE.Mesh(
      new THREE.BoxGeometry(N * tile + BOARD.rim * 1.08, 0.02, N * tile + BOARD.rim * 1.08),
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(boardTheme.accent),
        roughness: 0.22,
        metalness: 0.74,
        clearcoat: 0.32,
        clearcoatRoughness: 0.18
      })
    );
    inlay.position.set(0, BOARD.baseH + 0.11, 0);
    boardVisualGroup.add(inlay);

    const airPadGroup = new THREE.Group();
    boardVisualGroup.add(airPadGroup);
    const addAirPadMarker = (position, label = 'J') => {
      const marker = new THREE.Group();
      marker.position.copy(position);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(tile * 0.28, tile * 0.03, 10, 36),
        new THREE.MeshStandardMaterial({ color: '#ef4444', metalness: 0.45, roughness: 0.34 })
      );
      ring.rotation.x = Math.PI / 2;
      marker.add(ring);
      const plate = new THREE.Mesh(
        new THREE.CircleGeometry(tile * 0.24, 24),
        new THREE.MeshStandardMaterial({ color: '#0b1020', metalness: 0.18, roughness: 0.65 })
      );
      plate.rotation.x = -Math.PI / 2;
      marker.add(plate);
      const spriteCanvas = document.createElement('canvas');
      spriteCanvas.width = 128;
      spriteCanvas.height = 128;
      const ctx = spriteCanvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, 128, 128);
        ctx.fillStyle = '#facc15';
        ctx.font = '900 92px "JetBrains Mono","Arial Black",sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, 64, 68);
      }
      const spriteTexture = new THREE.CanvasTexture(spriteCanvas);
      applySRGBColorSpace(spriteTexture);
      const text = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: spriteTexture, transparent: true, depthWrite: false })
      );
      text.scale.set(tile * 0.5, tile * 0.5, 1);
      text.position.set(0, tile * 0.02, 0);
      marker.add(text);
      airPadGroup.add(marker);
    };
    [0, 1].forEach((slot) => {
      addAirPadMarker(getAirPadAnchor(true, 'jet', slot), `J${slot + 1}`);
      addAirPadMarker(getAirPadAnchor(true, 'helicopter', slot), `H${slot + 1}`);
      addAirPadMarker(getAirPadAnchor(false, 'jet', slot), `J${slot + 1}`);
      addAirPadMarker(getAirPadAnchor(false, 'helicopter', slot), `H${slot + 1}`);
    });

    // Tiles
    const tiles = [];
    const tileGroup = new THREE.Group();
    boardVisualGroup.add(tileGroup);
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const isDark = (r + c) % 2 === 1;
        const m = buildVeinedMaterial(isDark ? boardTheme.dark : boardTheme.light, {
          metalness: boardTheme.surfaceMetalness + 0.04,
          roughness: boardTheme.surfaceRoughness * 0.94,
          repeat: 3.4,
          normalScale: 0.3
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
        boardVisualGroup.add(mSmall);
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
        boardVisualGroup.add(nSmall);
      }

    let proceduralBoardVisible = false;
    const setProceduralBoardVisible = () => {
      proceduralBoardVisible = false;
      base.visible = false;
      top.visible = false;
      inlay.visible = false;
      coordMat.visible = false;
      tileGroup.visible = true;
      tiles.forEach((tileMesh) => {
        tileMesh.visible = true;
        if (tileMesh.material) {
          tileMesh.material.transparent = true;
          tileMesh.material.opacity = 0;
          tileMesh.material.depthWrite = false;
        }
      });
      arena.usingProceduralBoard = false;
      if (arenaRef.current) {
        arenaRef.current.usingProceduralBoard = false;
      }
    };

    arena.setProceduralBoardVisible = setProceduralBoardVisible;
    setProceduralBoardVisible();

    arena.boardMaterials = {
      base: base.material,
      top: top.material,
      coord: coordMat,
      tiles,
      tileMaterials: tiles.map((tileMesh) => tileMesh.material)
    };

    const isGoldLikeMaterial = (material) => {
      const name = (material?.name || '').toLowerCase();
      if (/gold|crown|ring|band/.test(name)) return true;
      const { metalness, roughness } = material || {};
      return typeof metalness === 'number' && typeof roughness === 'number' && metalness >= 0.6 && roughness <= 0.4;
    };

    const ensureIsolatedMaterial = (mesh) => {
      if (!mesh?.isMesh) return;
      const flag = mesh.userData?.__isolatedMat;
      if (flag) return;
      const src = mesh.material;
      const clone = Array.isArray(src)
        ? src.map((mat) => (mat?.clone ? mat.clone() : mat))
        : src?.clone
          ? src.clone()
          : src;
      mesh.material = clone;
      mesh.userData = { ...(mesh.userData || {}), __isolatedMat: true };
    };

    const collectMeshes = (root) => {
      const out = [];
      root?.traverse?.((node) => {
        if (node?.isMesh) out.push(node);
      });
      return out;
    };

    const snapshotMaterialsByOrder = (root) =>
      collectMeshes(root).map((mesh) => {
        const src = mesh.material;
        return Array.isArray(src)
          ? src.map((mat) => (mat?.clone ? mat.clone() : mat))
          : src?.clone
            ? src.clone()
            : src;
      });

    const applyMaterialsByOrder = (root, snapshot) => {
      const meshes = collectMeshes(root);
      const limit = Math.min(meshes.length, snapshot.length);
      for (let i = 0; i < limit; i += 1) {
        const saved = snapshot[i];
        meshes[i].material = Array.isArray(saved)
          ? saved.map((mat) => (mat?.clone ? mat.clone() : mat))
          : saved?.clone
            ? saved.clone()
            : saved;
      }
    };

    const swapMaterialsBetweenMeshes = (meshA, meshB) => {
      if (!meshA || !meshB) return;
      const snapA = snapshotMaterialsByOrder(meshA);
      const snapB = snapshotMaterialsByOrder(meshB);
      applyMaterialsByOrder(meshA, snapB);
      applyMaterialsByOrder(meshB, snapA);
    };

    const applySideColorHex = (sideKey = 'white', hex = QUICK_SIDE_COLORS[0]?.hex ?? 0xffffff) => {
      const meshes = arenaRef.current?.allPieceMeshes || [];
      const target = new THREE.Color(hex);
      meshes.forEach((piece) => {
        const isWhite = piece?.userData?.w ?? piece?.userData?.__pieceColor === 'white';
        const matches = sideKey === 'white' ? isWhite : !isWhite;
        if (!matches) return;
        piece.traverse((node) => {
          if (!node?.isMesh) return;
          ensureIsolatedMaterial(node);
          const materials = Array.isArray(node.material) ? node.material : [node.material];
          materials.forEach((mat) => {
            if (!mat || isGoldLikeMaterial(mat)) return;
            mat?.color?.copy(target);
            mat?.emissive?.set(0x000000);
          });
        });
      });
    };

    const collectPawnHeadMeshes = (holder) => {
      if (!holder) return [];
      const box = new THREE.Box3().setFromObject(holder);
      const size = box.getSize(new THREE.Vector3());
      const height = size.y || 1;
      const cutoff = box.max.y - height * 0.22;
      const heads = [];
      holder.traverse((node) => {
        if (!node?.isMesh) return;
        const bb = new THREE.Box3().setFromObject(node);
        const sz = bb.getSize(new THREE.Vector3());
        const nearTop = bb.max.y >= cutoff;
        const shortEnough = sz.y <= height * 0.45;
        const name = (node.name || '').toLowerCase();
        const hinted = /(head|top|cap|crown|finial|ball)/.test(name);
        const gold = /(gold|ring|band)/.test(name);
        if (((nearTop && shortEnough) || hinted) && !gold) heads.push(node);
      });
      return heads;
    };

    const applyPawnHeadPreset = (presetId = 'current') => {
      const meshes = arenaRef.current?.allPieceMeshes || [];
      const preset = HEAD_PRESET_OPTIONS.find((opt) => opt.id === presetId)?.preset;
      const restore = !preset || presetId === 'current';
      meshes.forEach((piece) => {
        const isPawn = (piece?.userData?.t || '').toUpperCase() === 'P';
        if (!isPawn) return;
        const targets = collectPawnHeadMeshes(piece);
        targets.forEach((node) => {
          if (restore) {
            const original = pawnHeadMaterialCacheRef.current.get(node.uuid);
            if (original) {
              node.material = Array.isArray(original)
                ? original.map((mat) => (mat?.clone ? mat.clone() : mat))
                : original?.clone
                  ? original.clone()
                  : original;
            }
            return;
          }
          if (!pawnHeadMaterialCacheRef.current.has(node.uuid)) {
            const src = node.material;
            pawnHeadMaterialCacheRef.current.set(
              node.uuid,
              Array.isArray(src)
                ? src.map((mat) => (mat?.clone ? mat.clone() : mat))
                : src?.clone
                  ? src.clone()
                  : src
            );
          }
          ensureIsolatedMaterial(node);
          const headMat = new THREE.MeshPhysicalMaterial({
            color: preset.color,
            metalness: preset.metalness,
            roughness: preset.roughness,
            transmission: preset.transmission,
            ior: preset.ior,
            thickness: preset.thickness,
            clearcoat: 0.5,
            clearcoatRoughness: 0.06,
            transparent: preset.transmission > 0
          });
          node.material = Array.isArray(node.material)
            ? node.material.map(() => headMat.clone())
            : headMat;
        });
      });
    };

    const snapshotBoardMaterials = (root) => {
      const cache = new Map();
      root?.traverse?.((node) => {
        if (!node?.isMesh) return;
        const src = node.material;
        cache.set(
          node.uuid,
          Array.isArray(src)
            ? src.map((mat) => (mat?.clone ? mat.clone() : mat))
            : src?.clone
              ? src.clone()
              : src
        );
      });
      return cache;
    };

    const applyBoardThemePreset = (themeIndex = 0) => {
      const theme = QUICK_BOARD_THEMES[(themeIndex + QUICK_BOARD_THEMES.length) % QUICK_BOARD_THEMES.length];
      const arenaState = arenaRef.current;
      if (!arenaState) return;
      const boardModel = arenaState.boardModel;
      if (boardModel) {
        if (!boardMaterialCacheRef.current.gltf.size) {
          boardMaterialCacheRef.current.gltf = snapshotBoardMaterials(boardModel);
        }
        boardModel.traverse((node) => {
          if (!node?.isMesh) return;
          const cache = boardMaterialCacheRef.current.gltf.get(node.uuid);
          if (!cache) return;
          const base = Array.isArray(cache) ? cache[0] : cache;
          const mat = base?.clone ? base.clone() : base;
          if (!mat) return;
          if (theme.special === 'chrome') {
            if (mat.metalness !== undefined) mat.metalness = 0.95;
            if (mat.roughness !== undefined) mat.roughness = 0.15;
            mat.color?.setHex(theme.light);
          } else {
            if (isGoldLikeMaterial(mat)) {
              node.material = mat;
              return;
            }
            const color = mat.color ? mat.color.clone() : new THREE.Color(1, 1, 1);
            const luminance = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
            const target = new THREE.Color(luminance >= 0.5 ? theme.light : theme.dark);
            mat.color?.copy(target);
          }
          mat.emissive?.set(0x000000);
          node.material = mat;
        });
      } else if (arenaState.boardMaterials?.tiles?.length) {
        const { tiles, base: baseMat, top: topMat, coord, tileMaterials } = arenaState.boardMaterials;
        if (!boardMaterialCacheRef.current.procedural) {
          boardMaterialCacheRef.current.procedural = {
            base: baseMat?.clone ? baseMat.clone() : baseMat,
            top: topMat?.clone ? topMat.clone() : topMat,
            coord: coord?.clone ? coord.clone() : coord,
            tileMaterials: tileMaterials?.map((mat) => (mat?.clone ? mat.clone() : mat))
          };
        }
        tiles.forEach((tileMesh) => {
          const { r = 0, c = 0 } = tileMesh.userData || {};
          ensureIsolatedMaterial(tileMesh);
          const isLight = (r + c) % 2 === 0;
          const target = isLight ? theme.light : theme.dark;
          const mat = Array.isArray(tileMesh.material) ? tileMesh.material[0] : tileMesh.material;
          mat?.color?.setHex(target);
          mat?.emissive?.set(0x000000);
        });
        if (topMat?.color) topMat.color.setHex(theme.light);
        if (baseMat?.color) baseMat.color.setHex(theme.dark);
        coord?.color?.setHex(theme.special === 'chrome' ? 0xffffff : theme.dark);
      }
    };

    const applyHomeRankMaterialSwap = () => {
      if (rankSwapAppliedRef.current) return;
      for (let c = 0; c < 8; c += 1) {
        const whiteBackRank = pieceMeshes[7][c];
        const blackBackRank = pieceMeshes[0][c];
        if (whiteBackRank && blackBackRank) {
          swapMaterialsBetweenMeshes(whiteBackRank, blackBackRank);
        }
      }
      rankSwapAppliedRef.current = true;
    };

    // Pieces — meshes + state
    board = parseFEN(START_FEN);
    pieceMeshes = Array.from({ length: 8 }, () => Array(8).fill(null));
    const allPieceMeshes = [];
    const rebuildParkedAirUnits = () => {
      parkedAirUnits.forEach((unit) => {
        if (unit?.root?.parent) unit.root.parent.remove(unit.root);
        disposeObject3D(unit?.root);
      });
      parkedAirUnits.length = 0;
      parkedAirUnitPools.white.jet = [];
      parkedAirUnitPools.white.helicopter = [];
      parkedAirUnitPools.black.jet = [];
      parkedAirUnitPools.black.helicopter = [];
      sideVehicleSkinCache.clear();
      const sides = [
        { isWhite: true, badge: avatar || username || playerFlag || '🙂' },
        {
          isWhite: false,
          badge:
            (onlineRef.current.enabled ? opponent?.avatar || opponent?.name : null) ||
            opponent?.avatar ||
            opponent?.name ||
            aiFlag ||
            '🤖'
        }
      ];
      sides.forEach(({ isWhite, badge }) => {
        const sideKey = isWhite ? 'white' : 'black';
        const skin = resolveSideVehicleSkin(isWhite);
        [0, 1].forEach((slotIndex) => {
          const jet = createFxJet();
          jet.root.scale.setScalar(CAPTURE_JET_SCALE * 0.72);
          if (skin) applyVehicleSkinToModel(jet.root, skin);
          attachVehicleAvatarBadge(jet.root, badge, isWhite ? 1 : -1);
          const jetPad = getAirPadAnchor(isWhite, 'jet', slotIndex);
          const jetParkRotation = isWhite ? -Math.PI * 0.1 : Math.PI * 1.1;
          jet.root.position.copy(jetPad);
          jet.root.rotation.y = jetParkRotation;
          airPadGroup.add(jet.root);
          const jetUnit = {
            kind: 'jet',
            ...jet,
            root: jet.root,
            slotIndex,
            inFlight: false,
            parkPosition: jetPad.clone(),
            parkRotationY: jetParkRotation
          };
          parkedAirUnits.push(jetUnit);
          parkedAirUnitPools[sideKey].jet.push(jetUnit);

          const helicopter = createFxHelicopter();
          helicopter.root.scale.setScalar(CAPTURE_HELICOPTER_SCALE * 0.74);
          if (skin) {
            applyVehicleSkinToModel(helicopter.root, skin, (node) =>
              /rotor|propell|blade|fan|window|cockpit|glass|canopy/.test(`${node.name || ''}`.toLowerCase())
            );
          }
          attachVehicleAvatarBadge(helicopter.root, badge, isWhite ? 1 : -1);
          const heliPad = getAirPadAnchor(isWhite, 'helicopter', slotIndex);
          const heliParkRotation = isWhite ? -Math.PI * 0.08 : Math.PI * 1.08;
          helicopter.root.position.copy(heliPad);
          helicopter.root.rotation.y = heliParkRotation;
          airPadGroup.add(helicopter.root);
          const helicopterUnit = {
            kind: 'helicopter',
            ...helicopter,
            root: helicopter.root,
            slotIndex,
            inFlight: false,
            parkPosition: heliPad.clone(),
            parkRotationY: heliParkRotation
          };
          parkedAirUnits.push(helicopterUnit);
          parkedAirUnitPools[sideKey].helicopter.push(helicopterUnit);
        });
      });
    };

    const acquireParkedAirUnit = (isWhiteSide, kind = 'jet') => {
      const sideKey = isWhiteSide ? 'white' : 'black';
      const pool = parkedAirUnitPools?.[sideKey]?.[kind] || [];
      const available = pool.find((unit) => !unit.inFlight) || pool[0] || null;
      if (!available) return null;
      available.inFlight = true;
      return available;
    };

    const releaseParkedAirUnit = (unit) => {
      if (!unit?.root) return;
      unit.inFlight = false;
      if (unit.parkPosition) {
        unit.root.position.copy(unit.parkPosition);
      }
      if (Number.isFinite(unit.parkRotationY)) {
        unit.root.rotation.y = unit.parkRotationY;
      }
      unit.root.visible = true;
    };

    const syncBoardFromState = (payload = {}) => {
      const { fen, turnWhite = true, lastMove } = payload;
      if (!fen) return;
      try {
        board = parseFEN(fen.split(' ')[0]);
        paintPiecesFromPrototypes(currentPiecePrototypes);
        applyStatus(turnWhite, turnWhite ? 'White to move' : 'Black to move', null);
        if (lastMove?.from && lastMove?.to) {
          const { from, to } = lastMove;
          lastMoveRef.current = {
            from,
            to,
            pieceMesh: pieceMeshes?.[to.r]?.[to.c],
            selectionColor: paletteRef.current?.capture,
            highlightColor: paletteRef.current?.highlight
          };
          highlightSelection(from.r, from.c, paletteRef.current?.capture);
          highlightMoves([[to.r, to.c]], paletteRef.current?.highlight);
        }
      } catch (error) {
        console.warn('Chess Battle Royal: failed to sync remote board', error);
      }
    };
    onlineRef.current.applyRemoteMove = syncBoardFromState;

    const paintPiecesFromPrototypes = (prototypes, styleId = currentPieceSetId) => {
      if (!prototypes) return;
      const colorKey = (p) => (p.w ? 'white' : 'black');
      const build = (p) => prototypes[colorKey(p)]?.[p.t] ?? null;
      const applyProfileViewRotation = (pieceMesh, pieceType) => {
        if (!pieceMesh || !PROFILE_VIEW_ROTATION_TYPES.has(pieceType)) return;
        pieceMesh.rotation.y += PROFILE_VIEW_ROTATION_RADIANS;
      };
      const yOffset = currentPieceYOffset;

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
          clone.scale.multiplyScalar(PIECE_SCALE_FACTOR);
          applyProfileViewRotation(clone, p.t);
          clone.position.set(
            c * tile - half + tile / 2,
            yOffset,
            r * tile - half + tile / 2
          );
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
      applyHomeRankMaterialSwap();
      if (arenaRef.current) {
        arenaRef.current.allPieceMeshes = allPieceMeshes;
        arenaRef.current.piecePrototypes = prototypes;
        arenaRef.current.activePieceSetId = styleId;
      }
      rebuildParkedAirUnits();
    };

    const applyPieceSetAssets = (
      assets,
      setId = currentPieceSetId,
      pieceStyleOption = paletteRef.current?.pieces
    ) => {
      const { boardModel, piecePrototypes } = assets || {};
      const resolvedSetId = assets?.userData?.styleId || setId || currentPieceSetId;
      currentPieceSetId = resolvedSetId;
      currentPieceYOffset = Number.isFinite(assets?.pieceYOffset)
        ? assets.pieceYOffset
        : PIECE_PLACEMENT_Y_OFFSET;
      currentTileSize = assets?.tileSize ?? tile;
      const headPreset = paletteRef.current?.head ?? HEAD_PRESET_OPTIONS[0].preset;
      const preserveOriginalMaterials = Boolean(
        pieceStyleOption?.preserveOriginalMaterials ||
          assets?.userData?.preserveOriginalMaterials ||
          PRESERVE_NATIVE_PIECE_IDS.has(resolvedSetId)
      );
      rankSwapAppliedRef.current = false;
      pawnHeadMaterialCacheRef.current.clear();
      boardMaterialCacheRef.current = { gltf: new Map(), procedural: null };
      if (currentBoardCleanup) {
        currentBoardCleanup();
        currentBoardCleanup = null;
      }
      if (boardModel) {
        boardModel.visible = true;
        const { top: boardTop } = normalizeBoardModelToDisplaySize(boardModel, RAW_BOARD_SIZE);
        const preferredYOffset = Math.max(
          boardTop + PIECE_PLACEMENT_Y_OFFSET,
          currentPieceYOffset
        );
        currentPieceYOffset = preferredYOffset;
        boardGroup.add(boardModel);
        applyBeautifulGameBoardTheme(boardModel, paletteRef.current?.board ?? BEAUTIFUL_GAME_THEME);
        setProceduralBoardVisible(false);
        currentBoardModel = boardModel;
        currentBoardCleanup = () => {
          try {
            boardGroup.remove(boardModel);
          } catch {}
          disposeObject3D(boardModel);
        };
      } else {
        setProceduralBoardVisible();
        currentBoardModel = null;
      }
      alignBoardGroupToTableSurface(boardGroup, arenaRef.current?.tableInfo ?? tableInfo);
      if (piecePrototypes) {
        currentPiecePrototypes = piecePrototypes;
        if (!preserveOriginalMaterials) {
          if ((resolvedSetId || '').startsWith('beautifulGame')) {
            harmonizeBeautifulGamePieces(
              currentPiecePrototypes,
              pieceStyleOption || BEAUTIFUL_GAME_PIECE_STYLE
            );
          }
          applyHeadPresetToPrototypes(currentPiecePrototypes, headPreset);
          adornPiecePrototypes(currentPiecePrototypes, currentTileSize);
        }
        paintPiecesFromPrototypes(piecePrototypes, resolvedSetId);
        if (!preserveOriginalMaterials) {
          applyHeadPresetToMeshes(allPieceMeshes, headPreset);
        }
      }
      applySideColorHex('white', QUICK_SIDE_COLORS[p1QuickIdx % QUICK_SIDE_COLORS.length]?.hex);
      applySideColorHex('black', QUICK_SIDE_COLORS[p2QuickIdx % QUICK_SIDE_COLORS.length]?.hex);
      const headTarget = QUICK_HEAD_PRESETS[headQuickIdx % QUICK_HEAD_PRESETS.length]?.id ?? 'current';
      applyPawnHeadPreset(headTarget);
      applyBoardThemePreset(boardQuickIdx);
      if (arenaRef.current) {
        arenaRef.current.boardModel = currentBoardModel;
        arenaRef.current.piecePrototypes = currentPiecePrototypes;
        arenaRef.current.activePieceSetId = currentPieceSetId;
        arenaRef.current.allPieceMeshes = allPieceMeshes;
        arenaRef.current.applyPieceSetAssets = applyPieceSetAssets;
        arenaRef.current.setProceduralBoardVisible = setProceduralBoardVisible;
        arenaRef.current.applySideColorHex = applySideColorHex;
        arenaRef.current.applyPawnHeadPreset = applyPawnHeadPreset;
        arenaRef.current.applyBoardThemePreset = applyBoardThemePreset;
      }

      if (typeof window !== 'undefined') {
        window.__CHESS_DEBUG__ = {
          renderer,
          scene,
          camera,
          controls,
          boardModel: currentBoardModel,
          piecePrototypes: currentPiecePrototypes,
          usingProceduralBoard: proceduralBoardVisible,
          pieceCount: allPieceMeshes.length
        };
        if (import.meta?.env?.DEV) {
          console.info('Chess Battle Royal: applied piece set', {
            boardModel: Boolean(currentBoardModel),
            piecePrototypes: Boolean(currentPiecePrototypes),
            pieceCount: allPieceMeshes.length,
            setId: currentPieceSetId
          });
        }
      }
    };

    disposers.push(() => {
      if (currentBoardCleanup) currentBoardCleanup();
    });

    pieceSetPromise
      .then((assets) => {
        if (cancelled) return;
        applyPieceSetAssets(assets, initialPieceSetId, pieceStyleOption);
      })
      .catch((error) => {
        console.error('Chess Battle Royal: failed to resolve chess set', error);
      });

    if (typeof window !== 'undefined' && import.meta?.env?.DEV) {
      window.__CHESS_DEBUG__ = { renderer, scene, camera, controls };
    }

      arenaRef.current = {
        renderer,
        scene,
        camera,
        controls,
        syncSkyboxToCamera,
        arenaGroup: arena,
        tableInfo,
        tableShapeId: tableInfo.shapeId,
        boardGroup,
        boardLookTarget,
        chairMaterials,
        chairs,
        seatAnchors: chairs.map((chair) => chair.anchor),
        sandTimer,
        environmentFloorY,
        studioCameras: [studioCamA, studioCamB],
        boardMaterials: arena.boardMaterials,
        pieceMaterials,
        allPieceMeshes,
        textureLoader,
        textureCache,
        maxAnisotropy,
        fallbackTexture,
        capturedByWhite,
        capturedByBlack,
        palette,
        playerFlag: initialPlayerFlag,
        aiFlag: initialAiFlagValue,
        boardModel: currentBoardModel,
        piecePrototypes: currentPiecePrototypes,
        activePieceSetId: currentPieceSetId,
        lastAppliedAppearance: normalizedAppearance,
        applyPieceSetAssets,
        setProceduralBoardVisible,
        usingProceduralBoard: proceduralBoardVisible
      };
      arenaRef.current.sandTimer = sandTimer;
      arenaRef.current.palette = palette;
      arenaRef.current.environmentFloorY = environmentFloorY;

      arena.sandTimer = sandTimer;
      arena.palette = palette;
      arena.playerFlag = initialPlayerFlag;
      arena.aiFlag = initialAiFlagValue;
      arena.environmentFloorY = environmentFloorY;
      arena.textureLoader = textureLoader;
      arena.textureCache = textureCache;
      arena.maxAnisotropy = maxAnisotropy;
      arena.fallbackTexture = fallbackTexture;

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
    let selectedMesh = null;
    const activePieceAnimations = [];

    const resetSelectedMeshElevation = () => {
      if (!selectedMesh) return;
      const { r, c } = selectedMesh.userData || {};
      const baseY = Number.isInteger(r) && Number.isInteger(c)
        ? piecePosition(r, c, currentPieceYOffset).y
        : currentPieceYOffset;
      const activeAnim = activePieceAnimations.find((anim) => anim.mesh === selectedMesh);
      if (activeAnim) {
        activeAnim.target.y = baseY;
      } else {
        selectedMesh.position.y = baseY;
      }
      selectedMesh = null;
    };

    const liftSelectedMesh = (mesh) => {
      if (!mesh) return;
      cancelPieceAnimation(mesh);
      const liftedY = currentPieceYOffset + PIECE_SELECTION_LIFT;
      mesh.position.y = Math.max(mesh.position.y, liftedY);
      selectedMesh = mesh;
    };

    const highlightSelection = (r, c, color) => {
      const highlightColor = color ?? paletteRef.current?.capture ?? '#ef4444';
      const highlightHeight = Math.max(0.08, tile * 0.03);
      const mesh = pieceMeshes[r]?.[c];
      const base = mesh?.position ?? piecePosition(r, c, currentPieceYOffset);
      const h = new THREE.Mesh(
        new THREE.CylinderGeometry(tile * 0.26, tile * 0.26, highlightHeight, 20),
        new THREE.MeshStandardMaterial({
          color: highlightColor,
          transparent: true,
          opacity: 0.7,
          metalness: 0.2,
          depthTest: false,
          depthWrite: false
        })
      );
      const baseY = Math.max(
        base.y + highlightHeight * 0.5,
        currentPieceYOffset - highlightHeight * 0.5 + HIGHLIGHT_VERTICAL_OFFSET
      );
      h.position.copy(base).setY(baseY + highlightHeight * 0.5);
      h.renderOrder = 6;
      h.userData.__highlight = true;
      boardGroup.add(h);
    };

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

    const shouldTriggerAiMove = (turnWhiteValue) =>
      !onlineRef.current.enabled &&
      ((aiPlaysWhite && turnWhiteValue) || (!aiPlaysWhite && !turnWhiteValue));

    function applyStatus(nextWhite, status, winner) {
      setUi((s) => ({ ...s, turnWhite: nextWhite, status, winner }));
      if (winner) {
        clearInterval(timerRef.current);
        return;
      }
      startTimer(nextWhite);
      if (shouldTriggerAiMove(nextWhite)) {
        const delay = Math.max(200, getMoveLockRemainingMs() + 30);
        setTimeout(aiMove, delay);
      }
    }

    const maybePlayCountdownSound = (seconds, isWhiteTurn) => {
      const activeTurn = uiRef.current?.turnWhite;
      if (activeTurn !== isWhiteTurn) {
        return;
      }
      if (performance.now() < suppressTimerBeepUntilRef.current) {
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
      const highlightHeight = Math.max(0.08, tile * 0.03);
      list.forEach(([rr, cc]) => {
        const mesh = tiles.find(
          (t) => t.userData.r === rr && t.userData.c === cc
        );
        if (!mesh) return;
        const h = new THREE.Mesh(
          new THREE.CylinderGeometry(tile * 0.28, tile * 0.28, highlightHeight, 20),
          new THREE.MeshStandardMaterial({
            color: highlightColor,
            transparent: true,
            opacity: 0.55,
            metalness: 0.2,
            depthTest: false,
            depthWrite: false
          })
        );
        const baseY = Math.max(
          mesh.position.y + highlightHeight * 0.5,
          currentPieceYOffset - highlightHeight * 0.5 + HIGHLIGHT_VERTICAL_OFFSET
        );
        h.position.copy(mesh.position).setY(baseY + highlightHeight * 0.5);
        h.renderOrder = 5;
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

    const isPlayerPiece = (piece) => {
      if (!piece) return false;
      if (onlineRef.current.enabled) {
        const playerSide = onlineRef.current.side;
        if (!playerSide) return false;
        return playerSide === 'white' ? piece.w : !piece.w;
      }
      // Offline games only allow the human to control white; AI plays black
      return piece.w;
    };

    const canInteractWithPiece = (piece) => {
      if (isMoveInteractionLocked()) return false;
      if (!isPlayerPiece(piece)) return false;
      if (!uiRef.current.turnWhite && piece.w) return false;
      if (uiRef.current.turnWhite && !piece.w) return false;
      if (onlineRef.current.enabled) {
        if (!onlineRef.current.synced) return false;
        if (
          onlineRef.current.status !== 'started' &&
          onlineRef.current.status !== 'in-progress'
        )
          return false;
      }
      return true;
    };

    function selectAt(r, c, options = {}) {
      const { force = false, selectionColor } = options;
      if (isReplayingRef.current) return;
      if (!force && isMoveInteractionLocked()) return;
      const p = board[r][c];
      if (!p) {
        resetSelectedMeshElevation();
        return ((sel = null), clearHighlights());
      }
      if (!force && !canInteractWithPiece(p)) return;

      resetSelectedMeshElevation();
      sel = { r, c, p };
      liftSelectedMesh(pieceMeshes[r]?.[c]);
      legal = legalMoves(board, r, c);
      clearHighlights();
      highlightSelection(r, c, selectionColor);
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

    function moveSelTo(rr, cc, options = {}) {
      const { byAi = false } = options;
      const finalizeAiMove = () => {
        if (byAi) aiMovingRef.current = false;
      };
      if (isReplayingRef.current) {
        finalizeAiMove();
        return;
      }
      if (!byAi && isMoveInteractionLocked()) {
        finalizeAiMove();
        return;
      }
      if (!sel) {
        finalizeAiMove();
        return;
      }
      if (!legal.some(([r, c]) => r === rr && c === cc)) {
        finalizeAiMove();
        return;
      }
      if (onlineRef.current.enabled) {
        const myTurnIsWhite = onlineRef.current.side === 'white';
        if (!onlineRef.current.synced) {
          finalizeAiMove();
          return;
        }
        if (
          onlineRef.current.status !== 'started' &&
          onlineRef.current.status !== 'in-progress'
        ) {
          finalizeAiMove();
          return;
        }
        if (uiRef.current.turnWhite !== myTurnIsWhite) {
          finalizeAiMove();
          return;
        }
      } else if (!isPlayerPiece(sel.p) && !byAi) {
        finalizeAiMove();
        return;
      }
      const movingPiece = board[sel.r][sel.c];
      const capturedPiece = board[rr][cc];
      const movingPieceLabel = PIECE_LABELS[movingPiece?.t] || 'piece';
      const capturedPieceLabel = capturedPiece ? PIECE_LABELS[capturedPiece.t] || 'piece' : null;
      const fromSquare = resolveChessSquare(sel.r, sel.c);
      const toSquare = resolveChessSquare(rr, cc);
      const fromWorldPos = piecePosition(sel.r, sel.c, currentPieceYOffset);
      const toWorldPos = piecePosition(rr, cc, currentPieceYOffset);
      let moveDelayMs = 0;
      let captureResolveDelayMs = 0;
      // capture mesh if any
      const targetMesh = pieceMeshes[rr][cc];
      if (targetMesh) {
        const worldPos = new THREE.Vector3();
        targetMesh.getWorldPosition(worldPos);
        const captureFx = playCaptureAnimation({
          fromPos: fromWorldPos,
          targetPos: worldPos,
          movingType: movingPiece?.t,
          movingMesh: pieceMeshes[sel.r][sel.c],
          distance: Math.hypot(rr - sel.r, cc - sel.c),
          deltaR: rr - sel.r,
          deltaC: cc - sel.c
        });
        moveDelayMs = Math.max(0, captureFx?.moveDelayMs ?? 0);
        captureResolveDelayMs = Math.max(0, captureFx?.captureResolveDelayMs ?? 0);
        if (moveDelayMs > 0 && captureResolveDelayMs <= 0) {
          captureResolveDelayMs = moveDelayMs;
        }
        if (captureResolveDelayMs > 0) {
          moveDelayMs = Math.max(moveDelayMs, captureResolveDelayMs);
        }
        const moveCapturedPieceToZone = () => {
          const capturingWhite = board[rr][cc]?.w ?? board[sel.r][sel.c].w;
          const zone = capturingWhite ? capturedByWhite : capturedByBlack;
          const idx = zone.push(targetMesh) - 1;
          const row = Math.floor(idx / 8);
          const col = idx % 8;
          const captureSpacing = tile * 0.68;
          const captureRowSpacing = tile * 0.9;
          const captureY = currentPieceYOffset;
          const capX = (col - 3.5) * captureSpacing;
          const capZ = capturingWhite
            ? half + BOARD.rim + 1 + row * captureRowSpacing
            : -half - BOARD.rim - 1 - row * captureRowSpacing;
          cancelPieceAnimation(targetMesh);
          targetMesh.position.y = captureY;
          animatePieceTo(
            targetMesh,
            new THREE.Vector3(capX, captureY, capZ),
            0.35
          );
        };
        if (captureResolveDelayMs > 0) {
          setTimeout(() => moveCapturedPieceToZone(), captureResolveDelayMs);
        } else {
          moveCapturedPieceToZone();
        }
        pieceMeshes[rr][cc] = null;
      }
      // move board
      const movedPiece = movingPiece;
      if (movedPiece && typeof movedPiece.hasMoved !== 'boolean') movedPiece.hasMoved = false;
      const movedFromPawn = movedPiece?.t === 'P';
      const isCastlingMove =
        movedPiece?.t === 'K' &&
        sel.r === rr &&
        Math.abs(cc - sel.c) === 2 &&
        legal.some(([r, c]) => r === rr && c === cc && Math.abs(c - sel.c) === 2);
      const rookFromC = isCastlingMove ? (cc > sel.c ? 7 : 0) : null;
      const rookToC = isCastlingMove ? (cc > sel.c ? 5 : 3) : null;
      const rookPiece =
        isCastlingMove && Number.isInteger(rookFromC) ? board[sel.r][rookFromC] : null;
      if (rookPiece && typeof rookPiece.hasMoved !== 'boolean') rookPiece.hasMoved = false;
      const rookMesh =
        isCastlingMove && Number.isInteger(rookFromC) ? pieceMeshes[sel.r][rookFromC] : null;
      board[rr][cc] = movedPiece;
      board[sel.r][sel.c] = null;
      if (isCastlingMove && rookPiece) {
        board[rr][rookToC] = rookPiece;
        board[sel.r][rookFromC] = null;
        rookPiece.hasMoved = true;
      }
      if (movedPiece) movedPiece.hasMoved = true;
      // promotion (auto to Queen)
      const promoted = movedFromPawn && (rr === 0 || rr === 7);
      if (promoted) {
        board[rr][cc].t = 'Q';
      }
      // move mesh
      let m = pieceMeshes[sel.r][sel.c];
      pieceMeshes[sel.r][sel.c] = null;
      const syncMovedPieceMesh = () => {
        pieceMeshes[rr][cc] = m;
        m.userData.r = rr;
        m.userData.c = cc;
        m.userData.t = board[rr][cc].t;
      };
      syncMovedPieceMesh();
      cancelPieceAnimation(m);
      const targetPosition = toWorldPos;
      if (moveDelayMs > 0) {
        setTimeout(() => {
          syncMovedPieceMesh();
          cancelPieceAnimation(m);
          animatePieceTo(m, targetPosition, 0.32);
          playMoveSound();
        }, moveDelayMs);
      } else {
        animatePieceTo(m, targetPosition, 0.32);
        playMoveSound();
      }
      highlightMovingMesh(m, Math.max(900, moveDelayMs + 420));
      lockMoveInteraction(Math.max(420, moveDelayMs + 360));
      if (isCastlingMove && Number.isInteger(rookFromC)) {
        pieceMeshes[sel.r][rookFromC] = null;
      }
      if (isCastlingMove && rookMesh) {
        pieceMeshes[rr][rookToC] = rookMesh;
        rookMesh.userData.r = rr;
        rookMesh.userData.c = rookToC;
        cancelPieceAnimation(rookMesh);
        const rookTarget = piecePosition(rr, rookToC, currentPieceYOffset);
        animatePieceTo(rookMesh, rookTarget, 0.32);
      }
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
          const activeAnim = activePieceAnimations.find((anim) => anim.mesh === m);
          if (activeAnim) {
            activeAnim.mesh = replacement;
          }
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

      lastMoveRef.current = {
        from: { r: sel.r, c: sel.c },
        to: { r: rr, c: cc },
        pieceMesh: m,
        selectionColor: paletteRef.current?.capture,
        highlightColor: paletteRef.current?.highlight
      };
      setCanReplay(true);

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
          playLaughSound();
        } else {
          status = 'Stalemate';
        }
      } else if (inCheck) {
        status = (nextWhite ? 'White' : 'Black') + ' in check';
        playCheckSound();
        playLaughSound();
      }

      applyStatus(nextWhite, status, winner);

      const moverIsWhite = movedPiece?.w ?? true;
      const playerName = resolveChessSideName(moverIsWhite);
      const opponentName = resolveChessSideName(!moverIsWhite);
      const winnerName =
        winner === 'White'
          ? resolveChessSideName(true)
          : winner === 'Black'
            ? resolveChessSideName(false)
            : playerName;
      moveCountRef.current += 1;
      const pieceCount = board.flat().filter(Boolean).length;
      const context = {
        player: playerName,
        opponent: opponentName,
        piece: movingPieceLabel,
        fromSquare,
        toSquare,
        capturedPiece: capturedPieceLabel,
        castleSide: isCastlingMove ? (cc > sel.c ? 'king-side' : 'queen-side') : 'king-side',
        winner: winnerName
      };
      let event = 'move';
      if (!hasMove) {
        event = inCheck ? 'checkmate' : 'stalemate';
      } else if (inCheck) {
        event = 'check';
      } else if (promoted) {
        event = 'promotion';
      } else if (isCastlingMove) {
        event = 'castle';
      } else if (capturedPieceLabel) {
        event = 'capture';
      } else if (moveCountRef.current <= 4) {
        event = 'opening';
      } else if (pieceCount <= 10) {
        event = 'endgame';
      }
      const priority = event === 'checkmate' || event === 'stalemate';
      enqueueChessCommentaryEvent(event, context, { priority });
      if (priority && !commentaryOutroPlayedRef.current) {
        commentaryOutroPlayedRef.current = true;
        enqueueChessCommentaryEvent('outro', context, { priority: true });
      }

      if (onlineRef.current.enabled && onlineRef.current.tableId) {
        const movePayload = {
          lastMove: { from: { r: sel.r, c: sel.c }, to: { r: rr, c: cc } },
          fen: boardToFEN(board, nextWhite),
          turnWhite: nextWhite
        };
        onlineRef.current.emitMove?.({ tableId: onlineRef.current.tableId, move: movePayload });
      }
      sel = null;
      resetSelectedMeshElevation();
      clearHighlights();
      finalizeAiMove();
    }

    const dragState = {
      active: false,
      mesh: null,
      from: null
    };
    let moveLockUntilMs = 0;
    const moveHighlight = new THREE.Mesh(
      new THREE.TorusGeometry(tile * 0.22, Math.max(0.05, tile * 0.02), 12, 42),
      new THREE.MeshStandardMaterial({
        color: paletteRef.current?.capture ?? '#ef4444',
        emissive: new THREE.Color('#ffffff'),
        emissiveIntensity: 0.18,
        transparent: true,
        opacity: 0.82,
        depthTest: false,
        depthWrite: false
      })
    );
    moveHighlight.rotation.x = Math.PI / 2;
    moveHighlight.visible = false;
    moveHighlight.renderOrder = 7;
    boardGroup.add(moveHighlight);
    let moveHighlightMesh = null;
    let moveHighlightEndMs = 0;
    const getMoveLockRemainingMs = () => Math.max(0, moveLockUntilMs - performance.now());
    const isMoveInteractionLocked = () => getMoveLockRemainingMs() > 0;
    const lockMoveInteraction = (durationMs) => {
      const nowMs = performance.now();
      moveLockUntilMs = Math.max(moveLockUntilMs, nowMs + Math.max(0, durationMs));
    };
    const highlightMovingMesh = (mesh, durationMs = 800) => {
      if (!mesh) return;
      moveHighlightMesh = mesh;
      moveHighlight.material.color.set(paletteRef.current?.capture ?? '#ef4444');
      moveHighlight.visible = true;
      moveHighlightEndMs = performance.now() + Math.max(260, durationMs);
    };

    const piecePosition = (r, c, y = currentPieceYOffset) =>
      new THREE.Vector3(c * tile - half + tile / 2, y, r * tile - half + tile / 2);

    const animatePieceTo = (mesh, target, duration = 0.28, onComplete) => {
      if (!mesh) return;
      const anim = {
        mesh,
        start: mesh.position.clone(),
        target: target.clone(),
        duration: Math.max(0.05, duration),
        elapsed: 0,
        onComplete
      };
      activePieceAnimations.push(anim);
    };

    const cancelPieceAnimation = (mesh) => {
      if (!mesh) return;
      for (let i = activePieceAnimations.length - 1; i >= 0; i -= 1) {
        if (activePieceAnimations[i].mesh === mesh) {
          activePieceAnimations.splice(i, 1);
        }
      }
    };

    replayLastMoveRef.current = () => {
      const last = lastMoveRef.current;
      if (!last?.pieceMesh) return;
      if (isReplayingRef.current) return;
      const { from, to, pieceMesh, selectionColor, highlightColor } = last;
      const fromPos = piecePosition(from.r, from.c, currentPieceYOffset);
      const toPos = piecePosition(to.r, to.c, currentPieceYOffset);
      cancelPieceAnimation(pieceMesh);
      isReplayingRef.current = true;
      clearHighlights();
      highlightSelection(from.r, from.c, selectionColor);
      highlightMoves([[to.r, to.c]], highlightColor);
      pieceMesh.position.copy(fromPos);
      animatePieceTo(pieceMesh, toPos, 0.45, () => {
        pieceMesh.position.copy(toPos);
        isReplayingRef.current = false;
      });
    };

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
      if (isReplayingRef.current) return;
      if (isMoveInteractionLocked()) return;
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
        cancelPieceAnimation(dragState.mesh);
        dragState.mesh.position.y = Math.max(
          dragState.mesh.position.y,
          currentPieceYOffset + 0.18
        );
      }
      if (controls) controls.enabled = false;
    };

    const onPointerMove = (event) => {
      if (isReplayingRef.current) return;
      if (isMoveInteractionLocked()) return;
      if (!dragState.active || !dragState.mesh) return;
      const tileHit = pickTileFromPointer(event);
      if (!tileHit) return;
      const target = piecePosition(tileHit.r, tileHit.c, currentPieceYOffset + 0.18);
      dragState.mesh.position.lerp(target, 0.35);
    };

    const onPointerUp = (event) => {
      if (isReplayingRef.current) return;
      if (isMoveInteractionLocked()) return;
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
        cancelPieceAnimation(mesh);
        mesh.position.copy(piecePosition(from.r, from.c));
        selectAt(from.r, from.c);
        return;
      }
      clearHighlights();
      sel = null;
    };

    function aiMove() {
      if (isReplayingRef.current) return;
      if (isMoveInteractionLocked()) {
        setTimeout(aiMove, Math.max(180, getMoveLockRemainingMs() + 20));
        return;
      }
      const activeTurnWhite = uiRef.current?.turnWhite ?? true;
      if (!shouldTriggerAiMove(activeTurnWhite)) return;
      aiMovingRef.current = true;
      const mv = bestAIMove(board, activeTurnWhite, 4);
      if (!mv) {
        aiMovingRef.current = false;
        return;
      }
      selectAt(mv.fromR, mv.fromC, { force: true, selectionColor: paletteRef.current?.capture });
      setTimeout(() => moveSelTo(mv.toR, mv.toC, { byAi: true }), 300);
    }

    onClick = function onClick(e) {
      if (isReplayingRef.current) return;
      if (isMoveInteractionLocked()) return;
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
    let lastRender = lastTime;
    const step = () => {
      const now = performance.now();
      const rawDt = Math.max(0, (now - lastTime) / 1000);
      const dt = Math.min(0.1, rawDt);
      const animDt = Math.min(0.5, rawDt);
      lastTime = now;
      const arenaState = arenaRef.current;
      if (camera && boardLookTarget) {
        const radius = camera.position.distanceTo(boardLookTarget);
        if (
          lastCameraRadiusRef.current == null ||
          Math.abs(radius - lastCameraRadiusRef.current) > 1e-4
        ) {
          lastCameraRadiusRef.current = radius;
          syncSkyboxToCamera();
        }
      }
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

      parkedAirUnits.forEach((unit) => {
        if (!unit?.root) return;
        if (unit.topRotor && unit.topRotorAxis) {
          unit.topRotor.rotateOnAxis(unit.topRotorAxis, dt * 22);
        }
        if (unit.tailRotor && unit.tailRotorAxis) {
          unit.tailRotor.rotateOnAxis(unit.tailRotorAxis, dt * 24);
        }
      });

      if (activePieceAnimations.length) {
        for (let i = activePieceAnimations.length - 1; i >= 0; i -= 1) {
          const anim = activePieceAnimations[i];
          anim.elapsed += animDt;
          const t = clamp01(anim.elapsed / anim.duration);
          const eased = 1 - (1 - t) * (1 - t);
          anim.mesh.position.lerpVectors(anim.start, anim.target, eased);
          if (t >= 1) {
            anim.mesh.position.copy(anim.target);
            activePieceAnimations.splice(i, 1);
            if (typeof anim.onComplete === 'function') {
              try {
                anim.onComplete();
              } catch (error) {
                console.warn('Chess Battle Royal: animation callback failed', error);
              }
            }
          }
        }
      }

      if (activeCaptureFx.length) {
        for (let i = activeCaptureFx.length - 1; i >= 0; i -= 1) {
          const fx = activeCaptureFx[i];
          fx.t += dt;
          const u = clamp01(fx.t / fx.duration);
          if (fx.type === 'drone') {
            const impactTime = CAPTURE_GROUND_FIRE_TIME + CAPTURE_GROUND_TRAVEL_TIME;
            const launchPos = fx.returnToOrigin
              ? fx.launchPos.clone()
              : getLiveLaunchPosition(fx.launchPos, fx.movingMesh, 0);
            if (!fx.returnToOrigin) fx.launchPos.copy(launchPos);
            fx.droneFx.root.scale.setScalar(CAPTURE_DRONE_SCALE);
            let pose = null;
            if (fx.t < CAPTURE_GROUND_FIRE_TIME) {
              pose = { pos: launchPos.clone(), next: launchPos.clone().add(new THREE.Vector3(0.05, 0, 0)) };
            } else if (fx.t < impactTime) {
              const mu = smoothEase((fx.t - CAPTURE_GROUND_FIRE_TIME) / CAPTURE_GROUND_TRAVEL_TIME);
              pose = getCaptureLoopPose({
                from: launchPos,
                to: fx.to,
                progress: mu,
                launchHeight: 0.08,
                orbitHeight: CAPTURE_FLIGHT_ALTITUDE * 0.48,
                orbitRadiusMul: 0.9,
                minOrbitCycles: 0.34,
                orbitSplit: 0.88,
                returnSplit: 0.72
              });
            }
            if (!pose) {
              fx.droneFx.root.visible = false;
            } else {
              fx.droneFx.root.visible = true;
              const { pos, next } = pose;
              fx.droneFx.root.position.copy(constrainInsideBoardPerimeter(pos));
              captureDir.copy(next).sub(pos).normalize();
              fx.droneFx.root.quaternion.setFromUnitVectors(FORWARD, captureDir);
            }
            fx.droneFx.propeller.rotation.x += dt * 40;
            fx.droneFx.exhaustClouds?.forEach((puff, idx) => {
              puff.position.set(-0.55 - idx * 0.16, Math.sin(fx.t * 8.2 + idx) * 0.02, 0);
              const s = 0.85 + idx * 0.16 + ((fx.t * 1.55 + idx * 0.18) % 1) * 0.52;
              puff.scale.setScalar(s);
            });
            if (fx.t >= impactTime) {
              launchExplosion(fx.to);
              captureFxGroup.remove(fx.droneFx.root);
              activeCaptureFx.splice(i, 1);
            }
          } else if (fx.type === 'jet') {
            const jetTimelineU = clamp01(fx.t / CAPTURE_JET_TOTAL);
            const jetU = THREE.MathUtils.lerp(CAPTURE_JET_TRIMMED_START_RATIO, 1, jetTimelineU);
            fx.jetFx.root.scale.setScalar(CAPTURE_JET_SCALE);
            const launchPos = getLiveLaunchPosition(fx.launchPos, fx.movingMesh, 0);
            fx.launchPos.copy(launchPos);
            const { pos: jetPos, next: jetNext } = getCaptureLoopPose({
              from: launchPos,
              to: fx.to,
              progress: jetU,
              launchHeight: 0.08,
              orbitHeight: CAPTURE_FLIGHT_ALTITUDE * 0.56,
              orbitRadiusMul: CAPTURE_AIR_STRIKE_PATH_RADIUS_FACTOR,
              minOrbitCycles: 0.34,
              orbitSplit: 0.74,
              returnToOrigin: Boolean(fx.returnToOrigin),
              sideSign: fx.to.x - launchPos.x >= 0 ? 1 : -1
            });
            fx.jetFx.root.position.copy(constrainInsideBoardPerimeter(jetPos));
            captureDir.copy(jetNext).sub(jetPos).normalize();
            const jetForward = captureDir.clone();
            fx.jetFx.root.quaternion.setFromUnitVectors(FORWARD, captureDir);
            const jetExhaustAnchor = fx.jetFx.exhaustAnchor || new THREE.Vector3(-1.95, 0, 0);
            fx.jetFx.exhaustClouds?.forEach((puff, idx) => {
              puff.position.set(
                jetExhaustAnchor.x - idx * 0.2,
                jetExhaustAnchor.y + Math.sin(fx.t * 8.4 + idx * 0.4) * 0.02,
                jetExhaustAnchor.z + Math.sin(fx.t * 5.8 + idx * 0.3) * 0.008
              );
              const s = 0.84 + idx * 0.12 + ((fx.t * 1.65 + idx * 0.11) % 1) * 0.52;
              puff.scale.setScalar(s);
            });

            const jetMissiles = Array.isArray(fx.missileFx) ? fx.missileFx : [fx.missileFx].filter(Boolean);
            const releaseStart = CAPTURE_JET_TOTAL * 0.42;
            const releaseEnd = CAPTURE_JET_TOTAL * 0.62;
            const missileTravel = Math.max(0.28, releaseEnd - releaseStart - 0.1);
            const topStrikeHeight = Math.max(tile * 2.2, 0.42);
            const hitTop = fx.to.clone().add(new THREE.Vector3(0, Math.max(topStrikeHeight * 0.8, 0.38), 0));
            let anyMissileVisible = false;
            jetMissiles.forEach((missile, idx) => {
              const releaseTime = releaseStart + idx * 0.14;
              if (fx.t < releaseTime) {
                missile.root.visible = false;
                return;
              }
              const missileU = clamp01((fx.t - releaseTime) / missileTravel);
              if (missileU <= 0 || missileU >= 1) {
                missile.root.visible = false;
                return;
              }
              anyMissileVisible = true;
              if (!missile.didPlayLaunchSound) {
                missile.didPlayLaunchSound = true;
                playAudio(missileLaunchSoundRef);
              }
              const sideOffset = idx === 0 ? -0.045 : 0.045;
              const right = jetForward.clone().cross(WORLD_UP);
              if (right.lengthSq() < 1e-6) {
                right.set(0, 0, idx === 0 ? -1 : 1);
              } else {
                right.normalize();
              }
              const launchPos = jetPos.clone().add(right.multiplyScalar(sideOffset));
              const missileEntry = launchPos.clone().lerp(hitTop, 0.72);
              missileEntry.y += topStrikeHeight * 0.12;
              const verticalDropStart = new THREE.Vector3(
                fx.to.x,
                Math.max(hitTop.y, fx.to.y + topStrikeHeight * 0.88),
                fx.to.z
              );
              const missilePos =
                missileU < 0.78
                  ? launchPos.clone().lerp(missileEntry, missileU / 0.78)
                  : verticalDropStart.clone().lerp(fx.to, (missileU - 0.78) / 0.22);
              const missileNext =
                missileU < 0.78
                  ? qBezier(launchPos, missileEntry, verticalDropStart, clamp01(missileU + 0.03))
                  : verticalDropStart.clone().lerp(fx.to, clamp01((missileU - 0.78) / 0.22 + 0.06));
              if (missileU >= 0.78) {
                missileNext.x = missilePos.x;
                missileNext.z = missilePos.z;
              }
              captureDir.copy(missileNext).sub(missilePos).normalize();
              missile.root.visible = true;
              missile.root.position.copy(constrainInsideBoardPerimeter(missilePos));
              missile.root.quaternion.setFromUnitVectors(FORWARD, captureDir);
            });
            if (!anyMissileVisible && fx.t > releaseEnd + missileTravel) {
              jetMissiles.forEach((missile) => {
                missile.root.visible = false;
              });
              if (!fx.hasExploded) {
                fx.hasExploded = true;
                launchExplosion(fx.to);
              }
            }

            if (u >= 1) {
              if (fx.parkedUnit) {
                releaseParkedAirUnit(fx.parkedUnit);
              } else {
                captureFxGroup.remove(fx.jetFx.root);
              }
              jetMissiles.forEach((missile) => {
                captureFxGroup.remove(missile.root);
              });
              activeCaptureFx.splice(i, 1);
            }
          } else if (fx.type === 'helicopter') {
            const heliTimelineU = clamp01(fx.t / CAPTURE_HELICOPTER_TOTAL);
            const heliU = THREE.MathUtils.lerp(CAPTURE_JET_TRIMMED_START_RATIO, 1, heliTimelineU);
            fx.helicopterFx.root.scale.setScalar(CAPTURE_HELICOPTER_SCALE);
            const launchPos = fx.returnToOrigin
              ? fx.launchPos.clone()
              : getLiveLaunchPosition(fx.launchPos, fx.movingMesh, 0);
            if (!fx.returnToOrigin) fx.launchPos.copy(launchPos);
            const { pos: heliPos, next: heliNext } = getCaptureLoopPose({
              from: launchPos,
              to: fx.to,
              progress: heliU,
              launchHeight: 0.08,
              orbitHeight: CAPTURE_FLIGHT_ALTITUDE * 0.56,
              orbitRadiusMul: CAPTURE_AIR_STRIKE_PATH_RADIUS_FACTOR,
              minOrbitCycles: 0.34,
              orbitSplit: 0.74,
              returnToOrigin: Boolean(fx.returnToOrigin),
              sideSign: fx.to.x - launchPos.x >= 0 ? 1 : -1
            });
            fx.helicopterFx.root.position.copy(constrainInsideBoardPerimeter(heliPos));
            captureDir.copy(heliNext).sub(heliPos).normalize();
            const heliForward = captureDir.clone();
            fx.helicopterFx.root.quaternion.setFromUnitVectors(FORWARD, captureDir);
            if (fx.helicopterFx.topRotor && fx.helicopterFx.topRotorAxis) {
              fx.helicopterFx.topRotor.rotateOnAxis(fx.helicopterFx.topRotorAxis, dt * 35);
            }
            if (fx.helicopterFx.tailRotor && fx.helicopterFx.tailRotorAxis) {
              fx.helicopterFx.tailRotor.rotateOnAxis(fx.helicopterFx.tailRotorAxis, dt * 35);
            }
            fx.helicopterFx.exhaustClouds?.forEach((puff, idx) => {
              puff.position.set(-1 - idx * 0.2, Math.sin(fx.t * 6.2 + idx * 0.4) * 0.03, 0);
            });

            const heliMissiles = Array.isArray(fx.missileFx) ? fx.missileFx : [fx.missileFx].filter(Boolean);
            const releaseStart = CAPTURE_HELICOPTER_TOTAL * 0.42;
            const releaseEnd = CAPTURE_HELICOPTER_TOTAL * 0.62;
            const missileTravel = Math.max(0.28, releaseEnd - releaseStart - 0.1);
            const topStrikeHeight = Math.max(tile * 2.2, 0.42);
            const hitTop = fx.to.clone().add(new THREE.Vector3(0, Math.max(topStrikeHeight * 0.8, 0.38), 0));
            let anyMissileVisible = false;
            heliMissiles.forEach((missile, idx) => {
              const releaseTime = releaseStart + idx * 0.14;
              if (fx.t < releaseTime) {
                missile.root.visible = false;
                return;
              }
              const missileU = clamp01((fx.t - releaseTime) / missileTravel);
              if (missileU <= 0 || missileU >= 1) {
                missile.root.visible = false;
                return;
              }
              anyMissileVisible = true;
              if (!missile.didPlayLaunchSound) {
                missile.didPlayLaunchSound = true;
                playAudio(missileLaunchSoundRef);
              }
              const sideOffset = idx === 0 ? -0.045 : 0.045;
              const right = heliForward.clone().cross(WORLD_UP);
              if (right.lengthSq() < 1e-6) {
                right.set(0, 0, idx === 0 ? -1 : 1);
              } else {
                right.normalize();
              }
              const launchPos = heliPos.clone().add(right.multiplyScalar(sideOffset));
              const missileEntry = launchPos.clone().lerp(hitTop, 0.72);
              missileEntry.y += topStrikeHeight * 0.12;
              const verticalDropStart = new THREE.Vector3(
                fx.to.x,
                Math.max(hitTop.y, fx.to.y + topStrikeHeight * 0.88),
                fx.to.z
              );
              const missilePos =
                missileU < 0.78
                  ? launchPos.clone().lerp(missileEntry, missileU / 0.78)
                  : verticalDropStart.clone().lerp(fx.to, (missileU - 0.78) / 0.22);
              const missileNext =
                missileU < 0.78
                  ? qBezier(launchPos, missileEntry, verticalDropStart, clamp01(missileU + 0.03))
                  : verticalDropStart.clone().lerp(fx.to, clamp01((missileU - 0.78) / 0.22 + 0.06));
              if (missileU >= 0.78) {
                missileNext.x = missilePos.x;
                missileNext.z = missilePos.z;
              }
              captureDir.copy(missileNext).sub(missilePos).normalize();
              missile.root.visible = true;
              missile.root.position.copy(constrainInsideBoardPerimeter(missilePos));
              missile.root.quaternion.setFromUnitVectors(FORWARD, captureDir);
            });
            if (!anyMissileVisible && fx.t > releaseEnd + missileTravel) {
              heliMissiles.forEach((missile) => {
                missile.root.visible = false;
              });
              if (!fx.hasExploded) {
                fx.hasExploded = true;
                launchExplosion(fx.to);
              }
            }
            if (u >= 1) {
              if (fx.parkedUnit) {
                releaseParkedAirUnit(fx.parkedUnit);
              } else {
                captureFxGroup.remove(fx.helicopterFx.root);
              }
              heliMissiles.forEach((missile) => {
                captureFxGroup.remove(missile.root);
              });
              activeCaptureFx.splice(i, 1);
            }
          } else if (fx.type === 'javelin') {
            const launchPos = getLiveLaunchPosition(fx.launchPos, fx.movingMesh, 0);
            fx.launchPos.copy(launchPos);
            const impactTime = CAPTURE_GROUND_FIRE_TIME + CAPTURE_GROUND_TRAVEL_TIME;
            if (fx.t < CAPTURE_GROUND_FIRE_TIME) {
              fx.missileFx.root.visible = true;
              fx.missileFx.root.position.copy(launchPos);
            } else if (fx.t < impactTime) {
              const mu = smoothEase((fx.t - CAPTURE_GROUND_FIRE_TIME) / CAPTURE_GROUND_TRAVEL_TIME);
              const control = launchPos.clone().lerp(fx.to, 0.5);
              control.y += fx.verticalStrike ? 0.62 : fx.directPath ? 0.18 : 0.42;
              const missilePos = fx.directPath
                ? launchPos.clone().lerp(fx.to, mu)
                : qBezier(launchPos, control, fx.to, mu);
              const missileNext = fx.directPath
                ? launchPos.clone().lerp(fx.to, clamp01(mu + 0.035))
                : qBezier(launchPos, control, fx.to, clamp01(mu + 0.035));
              if (fx.verticalStrike && mu > 0.72) {
                missileNext.x = missilePos.x;
                missileNext.z = missilePos.z;
              }

              fx.missileFx.root.visible = true;
              fx.missileFx.root.position.copy(constrainInsideBoardPerimeter(missilePos));
              if (fx.missileFx.rotor) {
                fx.missileFx.rotor.rotation.x += dt * 48;
              }
              captureDir.copy(missileNext).sub(missilePos).normalize();
              fx.missileFx.root.quaternion.setFromUnitVectors(FORWARD, captureDir);
              fx.missileFx.trail?.forEach((puff, idx) => {
                puff.position.set(-0.55 - idx * 0.16, Math.sin(fx.t * 8.2 + idx) * 0.02, 0);
                const s = 0.85 + idx * 0.16 + ((fx.t * 1.55 + idx * 0.18) % 1) * 0.52;
                puff.scale.setScalar(s);
              });
            } else {
              fx.missileFx.root.visible = false;
            }
            if (fx.t >= impactTime) {
              launchExplosion(fx.to);
              captureFxGroup.remove(fx.missileFx.root);
              activeCaptureFx.splice(i, 1);
            }
          } else if (fx.type === 'missile') {
            const control = fx.from.clone().lerp(fx.to, 0.5);
            control.y += 1.2;
            const missilePos = qBezier(fx.from, control, fx.to, u);
            const missileNext = qBezier(fx.from, control, fx.to, clamp01(u + 0.03));
            fx.missileFx.root.position.copy(missilePos);
            captureDir.copy(missileNext).sub(missilePos).normalize();
            fx.missileFx.root.quaternion.setFromUnitVectors(FORWARD, captureDir);
            fx.missileFx.trail?.forEach((puff, idx) => {
              puff.position.set(-0.5 - idx * 0.14, Math.sin(fx.t * 10 + idx) * 0.015, 0);
            });
            if (u >= 1) {
              launchExplosion(fx.to);
              captureFxGroup.remove(fx.missileFx.root);
              activeCaptureFx.splice(i, 1);
            }
          } else if (fx.type === 'explosion') {
            const lifeSec = fx.t;
            const fireLife = clamp01(1 - lifeSec / 0.88);
            const smokeLife = clamp01(1 - lifeSec / LUDO_CAPTURE_EXPLOSION_TIME);
            const fireGrow = 0.72 + lifeSec * 1.55;
            const smokeGrow = 0.72 + lifeSec * 0.88;
            fx.explosion.flash.scale.setScalar(0.44 + lifeSec * 1.15);
            fx.explosion.flash.material.opacity = fireLife;
            fx.explosion.fire.forEach((mesh, idx) => {
              const angle = lifeSec * 5 + idx * 1.35;
              mesh.position.set(
                Math.cos(angle) * (0.06 + lifeSec * 0.14),
                0.11 + lifeSec * 0.24 + idx * 0.03,
                Math.sin(angle) * (0.06 + lifeSec * 0.13)
              );
              mesh.scale.setScalar(fireGrow * (0.78 + idx * 0.13));
              mesh.material.opacity = fireLife * (0.98 - idx * 0.08);
            });
            fx.explosion.smoke?.forEach((mesh, idx) => {
              const angle = idx * 1.1 + lifeSec * 1.8;
              mesh.position.set(
                Math.cos(angle) * (0.06 + idx * 0.024),
                0.12 + lifeSec * (0.16 + idx * 0.036),
                Math.sin(angle) * (0.06 + idx * 0.024)
              );
              mesh.scale.setScalar(smokeGrow * (0.66 + idx * 0.12));
              mesh.material.opacity = smokeLife * (0.45 - idx * 0.04);
            });
            if (fx.t >= LUDO_CAPTURE_EXPLOSION_TIME) {
              captureFxGroup.remove(fx.explosion.root);
              activeCaptureFx.splice(i, 1);
            }
          }
        }
      }

      if (moveHighlightMesh?.parent && performance.now() <= moveHighlightEndMs) {
        const pulse = 0.72 + Math.sin(now * 0.012) * 0.2;
        moveHighlight.material.opacity = pulse;
        moveHighlight.position.copy(moveHighlightMesh.position);
        moveHighlight.position.y = Math.max(
          currentPieceYOffset + HIGHLIGHT_VERTICAL_OFFSET * 0.7,
          moveHighlightMesh.position.y - PIECE_SELECTION_LIFT * 0.15
        );
        moveHighlight.visible = true;
      } else {
        moveHighlight.visible = false;
      }

      controls?.update();
      const targetInterval = renderSettingsRef.current.targetFrameIntervalMs || targetFrameIntervalMs;
      if (now - lastRender >= targetInterval) {
        renderer.render(scene, camera);
        lastRender = now;
      }
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
    if (shouldTriggerAiMove(true)) {
      setTimeout(aiMove, 220);
    }
  };

    setup().catch((error) => {
      console.error('Chess Battle Royal: scene setup failed', error);
    });

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
      updateEnvironmentRef.current = () => {};
      disposeEnvironmentRef.current = null;
      envTextureRef.current = null;
      envSkyboxRef.current = null;
      envSkyboxTextureRef.current = null;
      environmentFloorRef.current = 0;
      sceneRef.current = null;
      rendererRef.current = null;
      isReplayingRef.current = false;
      lastMoveRef.current = null;
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
      laughSoundRef.current?.pause();
      swordSoundRef.current?.pause();
      droneSoundRef.current?.pause();
      helicopterSoundRef.current?.pause();
      jetFlySound?.pause?.();
      missileLaunchSoundRef.current?.pause();
      missileImpactSoundRef.current?.pause();
      activeCaptureFx.splice(0, activeCaptureFx.length);
      captureFxGroup.clear();
      scene.remove(captureFxGroup);
      clearAllAudioStopTimeouts();
    };
  }, []);

  const chatGiftOverlayClass =
    'fixed inset-0 z-50 flex items-center justify-center bg-black/70';
  const chatGiftPanelClass =
    'w-[min(340px,88vw)] rounded-2xl border border-[#233050] bg-[#0b1220] p-4 text-white shadow-[0_18px_40px_rgba(0,0,0,0.5)]';
  const chatGiftHeaderClass = 'flex items-center justify-between gap-2';
  const chatGiftTitleClass = 'text-sm font-semibold tracking-[0.04em] text-white';
  const chatGiftCloseButtonClass =
    'flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/80 hover:bg-white/20';
  const chatGiftOptionClass =
    'text-[11px] font-semibold border border-white/15 rounded-[10px] px-2 py-1 bg-[#0f172a]/60 text-white/85';
  const chatGiftOptionActiveClass = 'border-emerald-400/80 bg-emerald-400/20 text-emerald-50';
  const chatGiftActionButtonClass =
    'w-full rounded-[12px] border border-emerald-400/70 bg-gradient-to-br from-emerald-400/95 to-emerald-500/85 px-3 py-2 text-sm font-extrabold uppercase tracking-[0.18em] text-[#04210f] shadow-[0_12px_24px_rgba(16,185,129,0.3)]';
  const playerPhotoUrl = avatar || '/assets/icons/profile.svg';

  return (
    <div ref={wrapRef} className="fixed inset-0 bg-[#0c1020] text-white touch-none select-none">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-4 z-20 flex flex-col items-start gap-3 pointer-events-none">
          <button
            type="button"
            onClick={() => setConfigOpen((open) => !open)}
            aria-expanded={configOpen}
            aria-label={configOpen ? 'Close game menu' : 'Open game menu'}
            className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-gray-100 shadow-[0_6px_18px_rgba(2,6,23,0.45)] transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <span className="text-base leading-none" aria-hidden="true">☰</span>
            <span className="leading-none">Menu</span>
          </button>
          {onlineStatus !== 'offline' && (
            <div className="pointer-events-none rounded border border-emerald-300/40 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-100/90 shadow-lg backdrop-blur">
              <div className="font-semibold uppercase tracking-wide text-[10px]">Online Match</div>
              <div className="text-emerald-50/80">
                {onlineStatus === 'in-game'
                  ? `Synced${opponent ? ` vs ${avatarToName(opponent.avatar) || opponent.name || opponent.id}` : ''}`
                  : `Status: ${onlineStatus}`}
              </div>
              {tableId && (
                <div className="text-[10px] text-emerald-50/70">Table {tableId.slice(0, 8)}</div>
              )}
            </div>
          )}
        </div>
        <div className="absolute top-20 right-4 z-20 flex flex-col items-end gap-3 pointer-events-none">
          <div className="pointer-events-auto flex flex-col items-end gap-3">
            <BottomLeftIcons
              showInfo={false}
              showChat={false}
              showGift={false}
              className="flex flex-col"
              buttonClassName="icon-only-button pointer-events-auto flex h-10 w-10 items-center justify-center text-white/90 transition-opacity duration-200 hover:text-white focus:outline-none"
              iconClassName="text-[1.5rem] leading-none"
              labelClassName="sr-only"
              muteIconOn="🔇"
              muteIconOff="🔊"
              order={['mute']}
            />
            <button
              type="button"
              onClick={() => replayLastMoveRef.current?.()}
              disabled={!canReplay}
              className={`icon-only-button flex h-10 w-10 items-center justify-center text-white/90 transition-opacity duration-200 focus:outline-none ${
                canReplay ? 'hover:text-white' : 'cursor-not-allowed text-white/40'
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
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 7.5 4 3m0 0h4m-4 0 4.5 4.5a7.5 7.5 0 1 1-2 11.5"
                />
              </svg>
              <span className="sr-only">Replay last move</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode((mode) => (mode === '3d' ? '2d' : '3d'))}
              className="icon-only-button flex h-10 w-10 items-center justify-center text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-white/90 transition-opacity duration-200 hover:text-white focus:outline-none"
            >
              {viewMode === '3d' ? '2D' : '3D'}
            </button>
          </div>
          {configOpen && (
            <div className="pointer-events-auto mt-2 w-72 max-w-[80vw] rounded-2xl border border-white/15 bg-black/80 p-4 text-xs text-white shadow-2xl backdrop-blur max-h-[80vh] overflow-y-auto pr-1">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.4em] text-sky-200/80">Chess Settings</p>
                    <p className="mt-1 text-[0.7rem] text-white/70">
                      Personalize the chairs and table finish.
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
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.35em] text-white/70">Personalize Arena</p>
                      <p className="mt-1 text-[0.7rem] text-white/60">Table cloth, chairs, and table details.</p>
                    </div>
                    <button
                      type="button"
                      onClick={resetAppearance}
                      className="rounded-lg border border-white/15 px-2 py-1 text-[0.65rem] font-semibold text-white/80 transition hover:border-white/30 hover:text-white"
                    >
                      Reset
                    </button>
                  </div>
                  <div className="mt-3 max-h-72 space-y-3">
                    <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 px-1">
                      {customizationSections.map(({ key, label }) => {
                        const selectedSection = key === activeCustomizationKey;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setActiveCustomizationKey(key)}
                            className={`whitespace-nowrap rounded-full border px-3 py-2 text-[0.7rem] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                              selectedSection
                                ? 'border-sky-400/70 bg-sky-500/10 text-white shadow-[0_0_12px_rgba(56,189,248,0.35)]'
                                : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:text-white'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    {activeCustomizationSection && (
                      <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                        <p className="text-[10px] uppercase tracking-[0.3em] text-white/60">
                          {activeCustomizationSection.label}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {activeCustomizationSection.options.map((option) => {
                            const selected = appearance[activeCustomizationSection.key] === option.idx;
                            return (
                              <button
                                key={option.id}
                                type="button"
                                onClick={() =>
                                  setAppearance((prev) =>
                                    ({
                                      ...prev,
                                      [activeCustomizationSection.key]: option.idx
                                    })
                                  )
                                }
                                aria-pressed={selected}
                                className={`flex flex-col items-center rounded-2xl border p-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                                  selected
                                    ? 'border-sky-400/80 bg-sky-400/10 shadow-[0_0_12px_rgba(56,189,248,0.35)]'
                                    : 'border-white/10 bg-white/5 hover:border-white/20'
                                }`}
                              >
                                {renderCustomizationPreview(activeCustomizationSection.key, option)}
                                <span className="mt-1 text-center text-[0.6rem] font-semibold text-gray-100">
                                  {option.label}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-3 space-y-3 rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-white/60">Quick look swaps</p>
                  <div className="space-y-2">
                    <div>
                      <p className="text-[0.7rem] text-white/70">Pieces P1</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {quickSideOptions.map((color) => (
                          <button
                            key={`p1-${color.id}`}
                            type="button"
                            onClick={() => setP1QuickIdx(color.idx)}
                            className={`flex w-20 flex-col items-center gap-1 rounded-xl border p-2 text-[0.6rem] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                              p1QuickIdx === color.idx
                                ? 'border-white/70 bg-white/10 shadow-[0_0_0_2px_rgba(255,255,255,0.4)] text-white'
                                : 'border-white/20 bg-white/5 text-white/80 hover:border-white/40'
                            }`}
                            aria-label={`Set player one color ${color.label}`}
                            title={color.label}
                          >
                            <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-white/30 bg-white/5">
                              {color.thumbnail ? (
                                <img
                                  src={color.thumbnail}
                                  alt={`${color.label} pieces thumbnail`}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <span
                                  className="h-full w-full"
                                  style={{ backgroundColor: `#${color.hex.toString(16).padStart(6, '0')}` }}
                                />
                              )}
                            </span>
                            <span className="text-center leading-tight">{color.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[0.7rem] text-white/70">Pieces P2</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {quickSideOptions.map((color) => (
                          <button
                            key={`p2-${color.id}`}
                            type="button"
                            onClick={() => setP2QuickIdx(color.idx)}
                            className={`flex w-20 flex-col items-center gap-1 rounded-xl border p-2 text-[0.6rem] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                              p2QuickIdx === color.idx
                                ? 'border-white/70 bg-white/10 shadow-[0_0_0_2px_rgba(255,255,255,0.4)] text-white'
                                : 'border-white/20 bg-white/5 text-white/80 hover:border-white/40'
                            }`}
                            aria-label={`Set player two color ${color.label}`}
                            title={color.label}
                          >
                            <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-white/30 bg-white/5">
                              {color.thumbnail ? (
                                <img
                                  src={color.thumbnail}
                                  alt={`${color.label} pieces thumbnail`}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <span
                                  className="h-full w-full"
                                  style={{ backgroundColor: `#${color.hex.toString(16).padStart(6, '0')}` }}
                                />
                              )}
                            </span>
                            <span className="text-center leading-tight">{color.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[0.7rem] text-white/70">Pawn heads</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {quickHeadOptions.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => setHeadQuickIdx(preset.idx)}
                            className={`flex w-20 flex-col items-center gap-1 rounded-xl border p-2 text-[0.6rem] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                              headQuickIdx === preset.idx
                                ? 'border-white/70 bg-white/10 text-white'
                                : 'border-white/20 bg-white/5 text-white/70 hover:border-white/40 hover:text-white'
                            }`}
                          >
                            <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-white/30 bg-white/5">
                              {preset.thumbnail ? (
                                <img
                                  src={preset.thumbnail}
                                  alt={`${preset.label} pawn head thumbnail`}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <span className="h-full w-full bg-white/20" />
                              )}
                            </span>
                            <span className="text-center leading-tight">{preset.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[0.7rem] text-white/70">Board theme</p>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        {quickBoardOptions.map((theme) => (
                          <button
                            key={theme.id}
                            type="button"
                            onClick={() => setBoardQuickIdx(theme.idx)}
                            className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-[0.6rem] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                              boardQuickIdx === theme.idx
                                ? 'border-white/70 bg-white/10 text-white'
                                : 'border-white/15 bg-white/5 text-white/70 hover:border-white/30 hover:text-white'
                            }`}
                          >
                            <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-white/30 bg-white/5">
                              {theme.thumbnail ? (
                                <img
                                  src={theme.thumbnail}
                                  alt={`${theme.name} board thumbnail`}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <span
                                  className="h-full w-full"
                                  style={{
                                    background: `linear-gradient(135deg, #${theme.light
                                      .toString(16)
                                      .padStart(6, '0')} 50%, #${theme.dark
                                      .toString(16)
                                      .padStart(6, '0')} 50%)`
                                  }}
                                />
                              )}
                            </span>
                            <span className="text-center leading-tight">{theme.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.35em] text-white/70">Graphics</p>
                    <p className="mt-1 text-[0.7rem] text-white/60">Match the Murlan Royale quality presets.</p>
                  </div>
                  <div className="mt-2 grid gap-2">
                    {GRAPHICS_OPTIONS.map((option) => {
                      const active = option.id === graphicsId;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setGraphicsId(option.id)}
                          aria-pressed={active}
                          className={`w-full rounded-2xl border px-3 py-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                            active
                              ? 'border-sky-300 bg-sky-300/15 shadow-[0_0_12px_rgba(125,211,252,0.35)]'
                              : 'border-white/10 bg-white/5 hover:border-white/20 text-white/80'
                          }`}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.26em] text-white">
                              {option.label}
                            </span>
                            <span className="text-[11px] font-semibold tracking-wide text-sky-100">
                              {option.resolution ? `${option.resolution} • ${option.fps} FPS` : `${option.fps} FPS`}
                            </span>
                          </span>
                          {option.description ? (
                            <span className="mt-1 block text-[10px] uppercase tracking-[0.2em] text-white/60">
                              {option.description}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-[0.35em] text-white/70">Commentary</p>
                  <div className="mt-2 grid gap-2">
                    {CHESS_BATTLE_COMMENTARY_PRESETS.map((preset) => {
                      const active = preset.id === commentaryPresetId;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setCommentaryPresetId(preset.id)}
                          aria-pressed={active}
                          disabled={!commentarySupported}
                          className={`w-full rounded-2xl border px-3 py-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                            active
                              ? 'border-sky-300 bg-sky-300/15 shadow-[0_0_12px_rgba(125,211,252,0.35)]'
                              : 'border-white/10 bg-white/5 hover:border-white/20 text-white/80'
                          } ${commentarySupported ? '' : 'cursor-not-allowed opacity-60'}`}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.26em] text-white">{preset.label}</span>
                            {active && (
                              <span className="rounded-full border border-sky-200/70 px-2 py-0.5 text-[9px] tracking-[0.3em] text-sky-100">
                                Active
                              </span>
                            )}
                          </span>
                          <span className="mt-1 block text-[10px] uppercase tracking-[0.2em] text-white/60">
                            {preset.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => setCommentaryMuted((prev) => !prev)}
                    aria-pressed={commentaryMuted}
                    disabled={!commentarySupported}
                    className={`mt-2 flex w-full items-center justify-between gap-3 rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                      commentaryMuted
                        ? 'bg-emerald-400 text-black shadow-[0_0_18px_rgba(16,185,129,0.65)]'
                        : 'bg-white/10 text-white/80 hover:bg-white/20'
                    } ${commentarySupported ? '' : 'cursor-not-allowed opacity-60'}`}
                  >
                    <span>Mute commentary</span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] tracking-[0.3em] ${
                        commentaryMuted
                          ? 'border-black/30 text-black/70'
                          : 'border-white/30 text-white/70'
                      }`}
                    >
                      {commentaryMuted ? 'On' : 'Off'}
                    </span>
                  </button>
                  {!commentarySupported && (
                    <p className="mt-2 text-[0.65rem] text-white/60">
                      Voice commentary requires Web Speech support.
                    </p>
                  )}
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
            buttonClassName="icon-only-button pointer-events-auto flex h-11 w-11 items-center justify-center text-white/90 transition-opacity duration-200 hover:text-white focus:outline-none"
            iconClassName="text-[1.65rem] leading-none"
            labelClassName="sr-only"
            giftIcon="🎁"
            order={['gift']}
          />
          <BottomLeftIcons
            onChat={() => setShowChat(true)}
            showInfo={false}
            showGift={false}
            showMute={false}
            className="fixed left-3 bottom-28 z-50 flex flex-col"
            buttonClassName="icon-only-button pointer-events-auto flex h-11 w-11 items-center justify-center text-white/90 transition-opacity duration-200 hover:text-white focus:outline-none"
            iconClassName="text-[1.65rem] leading-none"
            labelClassName="sr-only"
            chatIcon="💬"
            order={['chat']}
          />
        </div>
        <div className="absolute inset-0 z-10 pointer-events-none">
          {players.map((player) => {
            const anchor = viewMode === '3d' ? seatAnchorMap.get(player.index) : null;
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
                data-player-index={player.index}
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
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="px-5 py-2 rounded-full bg-[rgba(7,10,18,0.65)] border border-[rgba(255,215,0,0.25)] text-sm font-semibold backdrop-blur">
            {ui.winner ? `${ui.winner} Wins` : ui.status}
          </div>
        </div>
      </div>
      {chatBubbles.map((bubble) => (
        <div key={bubble.id} className="chat-bubble chess-battle-chat-bubble">
          <span>{bubble.text}</span>
          <img src={bubble.photoUrl} alt="avatar" className="w-5 h-5 rounded-full" />
        </div>
      ))}
      <div className="pointer-events-auto">
        <InfoPopup
          open={showInfo}
          onClose={() => setShowInfo(false)}
          title="Chess Battle Royal"
          info="Deliver checkmate by trapping the king. Tap a piece to see legal moves, then tap a highlighted square to move."
        />
      </div>
      <div className="pointer-events-auto">
        <QuickMessagePopup
          open={showChat}
          onClose={() => setShowChat(false)}
          title="Quick Chat"
          headerClassName={chatGiftHeaderClass}
          titleClassName={chatGiftTitleClass}
          closeButtonClassName={chatGiftCloseButtonClass}
          showCloseButton
          overlayClassName={chatGiftOverlayClass}
          panelClassName={chatGiftPanelClass}
          messageGridClassName="grid grid-cols-2 gap-[0.45rem] max-h-48 overflow-y-auto"
          messageButtonClassName={chatGiftOptionClass}
          messageButtonActiveClassName={chatGiftOptionActiveClass}
          sendButtonClassName={chatGiftActionButtonClass}
          onSend={(text) => {
            const id = Date.now();
            setChatBubbles((bubbles) => [
              ...bubbles,
              { id, text, photoUrl: playerPhotoUrl }
            ]);
            if (effectiveSoundEnabled) {
              const audio = new Audio(chatBeep);
              audio.volume = getGameVolume();
              audio.play().catch(() => {});
            }
            setTimeout(
              () => setChatBubbles((bubbles) => bubbles.filter((bubble) => bubble.id !== id)),
              3000
            );
          }}
        />
      </div>
      <div className="pointer-events-auto">
        <GiftPopup
          open={showGift}
          onClose={() => setShowGift(false)}
          players={giftPlayers}
          senderIndex={0}
          overlayClassName={chatGiftOverlayClass}
          panelClassName={chatGiftPanelClass}
          title="Send Gift"
          headerClassName={chatGiftHeaderClass}
          titleClassName={chatGiftTitleClass}
          closeButtonClassName={chatGiftCloseButtonClass}
          showCloseButton
          playerListClassName="flex flex-col gap-[0.4rem] max-h-[8.5rem] overflow-y-auto"
          tierGroupClassName="flex flex-col gap-[0.35rem]"
          giftGridClassName="grid grid-cols-2 gap-[0.4rem]"
          playerButtonClassName={`${chatGiftOptionClass} flex items-center gap-2 text-left`}
          playerButtonActiveClassName={chatGiftOptionActiveClass}
          tierTitleClassName="text-[11px] uppercase tracking-[0.18em] text-white/70"
          giftButtonClassName={`${chatGiftOptionClass} flex items-center justify-center gap-2`}
          giftButtonActiveClassName={chatGiftOptionActiveClass}
          costClassName="text-[11px] uppercase tracking-[0.18em] text-white/70 mt-2 flex items-center justify-center gap-2"
          sendButtonClassName={chatGiftActionButtonClass}
          noteClassName="text-[10px] uppercase tracking-[0.18em] text-white/60 text-center"
          onGiftSent={({ from, to, gift }) => {
            const start = document.querySelector(`[data-player-index="${from}"]`);
            const end = document.querySelector(`[data-player-index="${to}"]`);
            if (!start || !end) return;
            const s = start.getBoundingClientRect();
            const e = end.getBoundingClientRect();
            const cx = window.innerWidth / 2;
            const cy = window.innerHeight / 2;
            let icon;
            if (typeof gift.icon === 'string' && gift.icon.match(/\.(png|jpg|jpeg|webp|svg)$/)) {
              icon = document.createElement('img');
              icon.src = gift.icon;
              icon.className = 'w-5 h-5';
            } else {
              icon = document.createElement('div');
              icon.textContent = gift.icon;
              icon.style.fontSize = '24px';
            }
            icon.style.position = 'fixed';
            icon.style.left = '0px';
            icon.style.top = '0px';
            icon.style.pointerEvents = 'none';
            icon.style.transform = `translate(${s.left + s.width / 2}px, ${s.top + s.height / 2}px) scale(1)`;
            icon.style.zIndex = '9999';
            document.body.appendChild(icon);
            const giftSound = giftSounds[gift.id];
            if (giftSound && effectiveSoundEnabled) {
              const audio = new Audio(giftSound);
              audio.volume = getGameVolume();
              if (gift.id === 'coffee_boost') {
                audio.currentTime = 4;
                audio.play().catch(() => {});
                setTimeout(() => {
                  audio.pause();
                }, 4000);
              } else if (gift.id === 'magic_trick') {
                audio.play().catch(() => {});
                setTimeout(() => {
                  audio.pause();
                }, 4000);
              } else if (gift.id === 'fireworks') {
                audio.play().catch(() => {});
                setTimeout(() => {
                  audio.pause();
                }, 6000);
              } else if (gift.id === 'surprise_box') {
                audio.play().catch(() => {});
                setTimeout(() => {
                  audio.pause();
                }, 5000);
              } else if (gift.id === 'bullseye') {
                setTimeout(() => {
                  audio.play().catch(() => {});
                }, 2500);
              } else {
                audio.play().catch(() => {});
              }
            }
            const animation = icon.animate(
              [
                { transform: `translate(${s.left + s.width / 2}px, ${s.top + s.height / 2}px) scale(1)` },
                { transform: `translate(${cx}px, ${cy}px) scale(3)`, offset: 0.5 },
                { transform: `translate(${e.left + e.width / 2}px, ${e.top + e.height / 2}px) scale(1)` },
              ],
              { duration: 3500, easing: 'linear' },
            );
            animation.onfinish = () => icon.remove();
          }}
        />
      </div>
    </div>
  );
}

export default function ChessBattleRoyal() {
  useTelegramBackButton();
  const navigate = useNavigate();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const avatar = params.get('avatar') || getTelegramPhotoUrl();
  let username =
    params.get('username') ||
    params.get('name') ||
    getTelegramFirstName() ||
    getTelegramUsername();
  const initialAccountId = params.get('accountId') || '';
  const mode = params.get('mode') || 'ai';
  const initialTableId = params.get('tableId') || '';
  const preferredSideParam = params.get('preferredSide');
  const [accountId, setAccountId] = useState(initialAccountId);
  const [redirecting, setRedirecting] = useState(false);
  const flagParam = params.get('flag') || params.get('playerFlag');
  const initialFlag =
    flagParam && FLAG_EMOJIS.includes(flagParam) ? flagParam : '';
  const aiFlagParam = params.get('aiFlag') || (params.get('aiFlags') || '').split(',')[0];
  const initialAiFlag =
    aiFlagParam && FLAG_EMOJIS.includes(aiFlagParam) ? aiFlagParam : '';
  const initialSide =
    params.get('side') === 'black'
      ? 'black'
      : params.get('side') === 'white'
      ? 'white'
      : preferredSideParam === 'black'
      ? 'black'
      : 'white';
  const opponentName = params.get('opponentName') || '';
  const opponentAvatar = params.get('opponentAvatar') || '';
  const initialOpponent =
    opponentName || opponentAvatar
      ? { name: opponentName || 'Opponent', avatar: opponentAvatar }
      : null;

  useEffect(() => {
    let cancelled = false;
    if (mode === 'online' && !initialTableId) {
      setRedirecting(true);
      navigate('/games/chessbattleroyal/lobby', { replace: true });
      return () => {
        cancelled = true;
      };
    }
    if (mode === 'online' && !initialAccountId) {
      ensureAccountId()
        .then((id) => {
          if (!cancelled && id) setAccountId(id);
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [initialAccountId, initialTableId, mode, navigate]);

  if (mode === 'online' && !initialTableId && redirecting) {
    return (
      <div className="p-4 text-center text-sm text-subtext">
        Syncing with the lobby…
      </div>
    );
  }
  return (
    <Chess3D
      avatar={avatar}
      username={username}
      initialFlag={initialFlag}
      initialAiFlag={initialAiFlag}
      accountId={accountId}
      initialTableId={initialTableId}
      initialSide={initialSide}
      initialOpponent={initialOpponent}
    />
  );
}
