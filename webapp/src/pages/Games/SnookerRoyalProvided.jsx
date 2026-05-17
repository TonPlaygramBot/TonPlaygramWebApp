import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { GroundedSkybox } from 'three/examples/jsm/objects/GroundedSkybox.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { PoolRoyalePowerSlider } from '../../../../pool-royale-power-slider.js';
import '../../../../pool-royale-power-slider.css';
import {
  POOL_ROYALE_HDRI_VARIANTS,
  POOL_ROYALE_DEFAULT_HDRI_ID
} from '../../config/poolRoyaleInventoryConfig.js';
import { POOL_ROYALE_CLOTH_VARIANTS } from '../../config/poolRoyaleClothPresets.js';
import { WOOD_FINISH_PRESETS, applyWoodTextures } from '../../utils/woodMaterials.js';
import { getTelegramUsername, getTelegramPhotoUrl, getTelegramId } from '../../utils/telegram.js';
import { isGameMuted, getGameVolume } from '../../utils/sound.js';
import BottomLeftIcons from '../../components/BottomLeftIcons.jsx';
import QuickMessagePopup from '../../components/QuickMessagePopup.jsx';
import GiftPopup from '../../components/GiftPopup.jsx';
import { getBallMaterial as getBilliardBallMaterial } from '../../utils/ballMaterialFactory.js';
import {
  clampToUnitCircle,
  computeQuantizedOffsetScaled,
  mapSpinForPhysics,
  normalizeSpinInput,
  smoothDamp
} from './snookerRoyalSpinUtils.js';
import {
  TABLE_MODEL_OPENSOURCE_GLB_URL,
  resolveSnookerGlbFitTransform
} from './snookerTableModel.js';

const HUMAN_URL = 'https://threejs.org/examples/models/gltf/readyplayer.me.glb';

const SNOOKER_CHAMPION_TABLE_GLB_URL = TABLE_MODEL_OPENSOURCE_GLB_URL;
const SNOOKER_CHAMPION_TABLE_FALLBACK_GLB_URL = 'https://raw.githubusercontent.com/ekiefl/pooltool/main/pooltool/models/table/snooker.glb';
const FRAME_RATE_OPTIONS = Object.freeze([
  { id: 'fhd60', label: 'Performance (60 Hz)', fps: 60, pixelRatioCap: 1.4, resolution: '2K texture pack', description: 'Snooker Royal performance preset for stable battery-friendly play.' },
  { id: 'qhd90', label: 'Smooth (90 Hz)', fps: 90, pixelRatioCap: 1.55, resolution: '4K texture pack', description: 'Snooker Royal smooth preset for sharper textures and 90 FPS timing.' },
  { id: 'uhd120', label: 'Ultra (120 Hz)', fps: 120, pixelRatioCap: 1.85, resolution: 'Desktop 8K / Mobile 4K', description: 'Snooker Royal ultra preset with the highest pixel cap available on this device.' }
]);
const CAMERA_MODE_OPTIONS = Object.freeze([
  { id: 'rail-overhead', label: 'Rail Overhead', description: 'Snooker Royal locked broadcast rail camera.' },
  { id: 'top-2d', label: '2D Overhead', description: 'Snooker Royal straight-down tactical camera.' },
  { id: 'cue-follow', label: 'Cue Follow', description: 'Low cue-side player camera while lining up the shot.' },
  { id: 'tv-broadcast', label: 'TV Broadcast', description: 'Alternates cue view, rail overhead, and pocket-style action framing.' },
  { id: 'corner-pocket-left', label: 'Left Pocket Cam', description: 'Snooker Royal corner-pocket broadcast camera on the left short rail.' },
  { id: 'corner-pocket-right', label: 'Right Pocket Cam', description: 'Snooker Royal corner-pocket broadcast camera on the right short rail.' }
]);
const BROADCAST_SYSTEM_OPTIONS = Object.freeze([
  {
    id: 'rail-overhead',
    label: 'Rail Overhead',
    method: 'Overhead rail mounts with fast post-shot cuts.',
    description: 'Snooker Royal broadcast package: short-rail TV heads above the table with the same framing logic.'
  }
]);
const DEFAULT_BROADCAST_SYSTEM_ID = 'rail-overhead';

const SNOOKER_ROYAL_PARITY_MENU_THUMBNAILS = Object.freeze([
  {
    id: 'table-map',
    label: 'GLB table map',
    image: '/assets/icons/snooker-royale.svg',
    description: 'Royal snooker.glb chassis, cushion jaws, pocket throats, and cloth material mapping.'
  },
  {
    id: 'balls-spin',
    label: 'Balls + spin',
    image: '/assets/icons/snooker-regular.svg',
    description: 'Royal ball rack, official spots, strike power, rolling friction, and spin transfer.'
  },
  {
    id: 'broadcast-camera',
    label: 'Broadcast cameras',
    image: '/assets/icons/snooker-tournament.svg',
    description: 'Royal cue follow, rail overhead, TV broadcast, replay, and pocket cut camera positions.'
  }
]);
const SNOOKER_TEXTURE_OPTIONS = Object.freeze([
  { id: 'showood', label: 'Showood Walnut', rail: 0x4d2f1f, trim: 0xd4af37 },
  { id: 'carbon', label: 'LT Carbon Black', rail: 0x090b10, trim: 0x8fb3ff },
  { id: 'rosewood', label: 'Rosewood Gloss', rail: 0x5a1f16, trim: 0xf4c76b },
  { id: 'oak', label: 'Oak Tournament', rail: 0x76512f, trim: 0xd9dde7 }
]);
const DEFAULT_CLOTH_ID = 'snooker-green';
const WORLD_SCALE = 3.5;
const SNOOKER_CHAMPION_STORAGE_PREFIX = 'snookerChampion:';
const SNOOKER_BALL_VALUES = Object.freeze({ red: 1, yellow: 2, green: 3, brown: 4, blue: 5, pink: 6, black: 7 });
const SNOOKER_COLOR_LABELS = Object.freeze({ yellow: 'Yellow', green: 'Green', brown: 'Brown', blue: 'Blue', pink: 'Pink', black: 'Black' });
const SNOOKER_COLOR_ORDER = Object.freeze(['yellow', 'green', 'brown', 'blue', 'pink', 'black']);
const SPIN_CONTROL_DIAMETER_PX = 124;
const SPIN_DOT_DIAMETER_PX = 16;
const POOL_ROYALE_BOTTOM_HUD_LEFT_INSET_PX = 150;
const POOL_ROYALE_BOTTOM_HUD_RIGHT_INSET_PX = SPIN_CONTROL_DIAMETER_PX + 150;
const POOL_ROYALE_BOTTOM_OFFSET_PX = 12;
const POOL_ROYALE_STANDING_VIEW_FOV = 66;
const POOL_ROYALE_RAIL_OVERHEAD_PHI = Math.PI / 2 - 0.26 + 0.18;
const POOL_ROYALE_STANDING_VIEW_PHI = 0.92;
const POOL_ROYALE_STANDING_VIEW_MARGIN = 0.001;
const POOL_ROYALE_STANDING_VIEW_DISTANCE_SCALE = 0.36;
const POOL_ROYALE_CUE_VIEW_RADIUS_RATIO = 0.0088;
const POOL_ROYALE_CUE_VIEW_PHI_LIFT = 0.06;
const SNOOKER_HDRI_CAMERA_HEIGHT_M = 1.5;
const SNOOKER_HDRI_MIN_CAMERA_HEIGHT_M = 0.8;
const SNOOKER_HDRI_RADIUS_MULTIPLIER = 6;
const SNOOKER_HDRI_GROUNDED_RESOLUTION = 256;
const SNOOKER_HDRI_SHADOW_OPACITY = 0.38;
const SNOOKER_CUE_CAMERA_ABS_MIN_PHI = 0.08;
const SNOOKER_CUE_CAMERA_STANDING_PHI = POOL_ROYALE_STANDING_VIEW_PHI - 0.045;
const SNOOKER_CUE_CAMERA_SHOT_PHI = Math.PI / 2 - 0.26;
const SNOOKER_CUE_CAMERA_MIN_PHI = Math.max(SNOOKER_CUE_CAMERA_ABS_MIN_PHI, SNOOKER_CUE_CAMERA_STANDING_PHI - 0.54);
const SNOOKER_CUE_CAMERA_MAX_PHI = SNOOKER_CUE_CAMERA_SHOT_PHI - 0.1;
const SNOOKER_CUE_CAMERA_RAIL_SAFETY = 0.006;
const SNOOKER_CUE_CAMERA_MIN_RADIUS = 18 * WORLD_SCALE * 0.0126 * 0.05;
const SNOOKER_CUE_CAMERA_MAX_RADIUS = 260 * WORLD_SCALE * 1.14;
const SNOOKER_CUE_VIEW_RADIUS_RATIO = POOL_ROYALE_CUE_VIEW_RADIUS_RATIO;
const SNOOKER_CUE_CAMERA_DISTANCE_MULTIPLIER = 1.12;
const SNOOKER_CUE_VIEW_MIN_PHI = Math.min(
  SNOOKER_CUE_CAMERA_MAX_PHI - SNOOKER_CUE_CAMERA_RAIL_SAFETY,
  SNOOKER_CUE_CAMERA_STANDING_PHI + 0.26
);
const SNOOKER_CUE_VIEW_PHI_LIFT = POOL_ROYALE_CUE_VIEW_PHI_LIFT;
const SNOOKER_CUE_SURFACE_MARGIN = 0.045 * WORLD_SCALE * 0.42;
const SNOOKER_BALL_MATERIAL_VARIANT = 'pool';
const BALL_VISUAL_LIFT = 0;
const SNOOKER_TABLE_MARKING_LIFT = 0.012 * WORLD_SCALE;
const SNOOKER_TABLE_MARKING_RADIUS = 0.0065 * WORLD_SCALE;
const OFFICIAL_SNOOKER_PLAYFIELD_WIDTH_M = 1.778;
const OFFICIAL_SNOOKER_PLAYFIELD_LENGTH_M = 3.569;
const OFFICIAL_SNOOKER_BALL_DIAMETER_M = 0.0525;
const OFFICIAL_SNOOKER_BAULK_LINE_FROM_CUSHION_M = 0.737;
const OFFICIAL_SNOOKER_D_RADIUS_M = 0.292;
const OFFICIAL_SNOOKER_BLACK_FROM_TOP_CUSHION_M = 0.324;
const OFFICIAL_SNOOKER_POCKET_CORNER_MOUTH_M = 0.086;
const OFFICIAL_SNOOKER_POCKET_MIDDLE_MOUTH_M = 0.095;
const SNOOKER_TABLE_VISUAL_LENGTH_TRIM = 1.18; // larger GLB cabinet framing so the imported snooker table wraps the official mapped cushion rectangle
const SNOOKER_PLAYFIELD_SCALE = (2.75 * WORLD_SCALE) / OFFICIAL_SNOOKER_PLAYFIELD_WIDTH_M;
const SNOOKER_OFFICIAL_PLAYFIELD_W = OFFICIAL_SNOOKER_PLAYFIELD_WIDTH_M * SNOOKER_PLAYFIELD_SCALE;
const SNOOKER_OFFICIAL_PLAYFIELD_L = OFFICIAL_SNOOKER_PLAYFIELD_LENGTH_M * SNOOKER_PLAYFIELD_SCALE;
const SNOOKER_OFFICIAL_BALL_R = (OFFICIAL_SNOOKER_BALL_DIAMETER_M * SNOOKER_PLAYFIELD_SCALE) / 2;
const SNOOKER_BALL_CENTER_Y = SNOOKER_OFFICIAL_BALL_R;
const SNOOKER_OFFICIAL_BAULK_FROM_CUSHION = OFFICIAL_SNOOKER_BAULK_LINE_FROM_CUSHION_M * SNOOKER_PLAYFIELD_SCALE;
const SNOOKER_OFFICIAL_D_RADIUS = OFFICIAL_SNOOKER_D_RADIUS_M * SNOOKER_PLAYFIELD_SCALE;
const SNOOKER_OFFICIAL_BLACK_FROM_TOP_CUSHION = OFFICIAL_SNOOKER_BLACK_FROM_TOP_CUSHION_M * SNOOKER_PLAYFIELD_SCALE;
const SNOOKER_OFFICIAL_CORNER_POCKET_RADIUS = (OFFICIAL_SNOOKER_POCKET_CORNER_MOUTH_M * SNOOKER_PLAYFIELD_SCALE) / 2;
const SNOOKER_OFFICIAL_MIDDLE_POCKET_RADIUS = (OFFICIAL_SNOOKER_POCKET_MIDDLE_MOUTH_M * SNOOKER_PLAYFIELD_SCALE) / 2;
const SNOOKER_CORNER_JAW_SETBACK = SNOOKER_OFFICIAL_CORNER_POCKET_RADIUS * 0.72;
const SNOOKER_MIDDLE_JAW_SETBACK = SNOOKER_OFFICIAL_MIDDLE_POCKET_RADIUS * 0.68;
const SNOOKER_SHOT_POWER_BOOST = 0.455; // Snooker Royal full-size strike output, shared by Champion through the common table/physics core
const SNOOKER_SHOT_MIN_FACTOR = 0.25;
const SNOOKER_SHOT_POWER_RANGE = 0.75;
const SNOOKER_SHOT_FULL_SPEED = 12 * WORLD_SCALE * SNOOKER_SHOT_POWER_BOOST;
const SNOOKER_BALL_MASS = 0.17;
const SNOOKER_SHOT_SPIN_SCALE = 0.115;
const SNOOKER_SPIN_GLOBAL_SCALE = 0.32; // keep cue-ball natural-follow input subtle so center-ball shots do not over-rotate
const SNOOKER_SPIN_GLOBAL_BOOST_MULTIPLIER = 1.2;
const SNOOKER_TOPSPIN_MULTIPLIER = 1.34 * SNOOKER_SPIN_GLOBAL_BOOST_MULTIPLIER;
const SNOOKER_CUE_CENTER_ROLL_OMEGA_FACTOR = 0.32;
const SNOOKER_CUE_SPIN_OMEGA_MULTIPLIER = 10;
const SNOOKER_BALL_INERTIA = (2 / 5) * SNOOKER_BALL_MASS * SNOOKER_OFFICIAL_BALL_R * SNOOKER_OFFICIAL_BALL_R;
const SNOOKER_SPIN_FIXED_DT = 1 / 120;
const SNOOKER_SPIN_SLIDE_EPS = 0.02;
const SNOOKER_SPIN_KINETIC_FRICTION = 0.22;
const SNOOKER_SPIN_ROLL_DAMPING = 0.1;
const SNOOKER_SPIN_ANGULAR_DAMPING = 0.18;
const SNOOKER_SPIN_GRAVITY = 9.81;
const SNOOKER_ROLLING_RESISTANCE = 0.011;
const SNOOKER_BALL_BALL_FRICTION = 0.105;
const SNOOKER_RAIL_FRICTION = 0.16;
const SNOOKER_STOP_EPS = 0.0074;
const SNOOKER_STOP_SOFTENING = 0.96;
const SNOOKER_STOP_FINAL_EPS = SNOOKER_STOP_EPS * 0.35;
const SNOOKER_CUSHION_NOSE_CONTACT_INSET = Math.max(0, (SNOOKER_OFFICIAL_BALL_R * 2 - SNOOKER_OFFICIAL_CORNER_POCKET_RADIUS) * 0.5);
const SNOOKER_CUSHION_COLLISION_SAFETY_INSET = SNOOKER_OFFICIAL_BALL_R * 0.12;
const SNOOKER_PHYSICS_MAX_STEP = 1 / 480;
const SNOOKER_AIMING_CAMERA_HEIGHT_THRESHOLD = -0.08;
const SNOOKER_CAMERA_HEIGHT_STEP = 0.075;
const SNOOKER_CAMERA_HEIGHT_MIN = -0.34;
const SNOOKER_CAMERA_HEIGHT_MAX = 0.44;
const SNOOKER_CHAMPION_WOOD_TEXTURE_DEFAULT = Object.freeze({
  hue: 24,
  sat: 0.4,
  light: 0.44,
  contrast: 0.64
});
const SNOOKER_CHAMPION_GLTF_WOOD_PATTERN = /wood|walnut|oak|mahogany|rosewood|veneer|frame|rail|body|cabinet|leg|side|apron|trim|brown|black|carved|table/i;
const SNOOKER_CHAMPION_GLTF_NON_WOOD_PATTERN = /cloth|felt|slate|bed|baize|cushion|rubber|pocket|net|leather|metal|brass|gold|chrome/i;
const SNOOKER_AIM_LINE_WIDTH = Math.max(1.25, SNOOKER_OFFICIAL_BALL_R * 0.15) * 1.2;
const SNOOKER_AIM_TICK_HALF_LENGTH = SNOOKER_OFFICIAL_BALL_R; // full target tick spans one actual snooker-ball diameter
const SNOOKER_REPLAY_MAX_MS = 5200;
const SNOOKER_REPLAY_SAMPLE_MS = 33;
const SNOOKER_REPLAY_CAMERA_SEQUENCE = Object.freeze(['cue-follow', 'rail-overhead', 'corner-pocket-left', 'corner-pocket-right']);
const POOL_ROYALE_HUD_DESKTOP = Object.freeze({
  spinRight: 28,
  spinBottom: POOL_ROYALE_BOTTOM_OFFSET_PX,
  sliderRight: 12,
  sliderTop: '56%',
  sideControlsLeft: 0,
  sideControlsBottom: 96,
  bottomHudLeft: POOL_ROYALE_BOTTOM_HUD_LEFT_INSET_PX,
  bottomHudRight: POOL_ROYALE_BOTTOM_HUD_RIGHT_INSET_PX
});
const loadStoredOption = (key, fallback, validIds) => {
  if (typeof window === 'undefined') return fallback;
  try {
    const stored = window.localStorage.getItem(`${SNOOKER_CHAMPION_STORAGE_PREFIX}${key}`);
    return stored && (!validIds || validIds.includes(stored)) ? stored : fallback;
  } catch {
    return fallback;
  }
};
const storeOption = (key, value) => {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(`${SNOOKER_CHAMPION_STORAGE_PREFIX}${key}`, value); } catch {}
};
function resolveSnookerChampionTextureOption(textureId) {
  const builtIn = SNOOKER_TEXTURE_OPTIONS.find((item) => item.id === textureId);
  if (builtIn) return builtIn;
  const woodIndex = WOOD_FINISH_PRESETS?.findIndex?.((item) => item.id === textureId) ?? -1;
  if (woodIndex >= 0) {
    const preset = WOOD_FINISH_PRESETS[woodIndex];
    const base = SNOOKER_TEXTURE_OPTIONS[woodIndex % SNOOKER_TEXTURE_OPTIONS.length];
    return {
      ...preset,
      id: preset.id || `wood-${woodIndex}`,
      label: preset.label || preset.name || `Wood ${woodIndex + 1}`,
      rail: base.rail,
      trim: base.trim
    };
  }
  return SNOOKER_TEXTURE_OPTIONS[0];
}
const SNOOKER_CHAMPION_TEXTURE_IDS = Object.freeze([
  ...SNOOKER_TEXTURE_OPTIONS.map((item) => item.id),
  ...(WOOD_FINISH_PRESETS?.map?.((item, idx) => item.id || `wood-${idx}`) ?? [])
]);
const CFG = {
  scale: WORLD_SCALE,
  tableTopY: 0.84 * WORLD_SCALE,
  tableW: SNOOKER_OFFICIAL_PLAYFIELD_W,
  tableL: SNOOKER_OFFICIAL_PLAYFIELD_L,
  tableVisualMultiplier: 1.08 * SNOOKER_TABLE_VISUAL_LENGTH_TRIM,
  railH: 0.08 * WORLD_SCALE,
  ballR: SNOOKER_OFFICIAL_BALL_R,
  friction: 1.18,
  restitution: 0.92,
  minSpeed2: 0.00045 * WORLD_SCALE * WORLD_SCALE,
  idleGap: 0.012 * WORLD_SCALE,
  contactGap: 0.0012 * WORLD_SCALE,
  pullRange: 0.42 * WORLD_SCALE,
  strikeTime: 0.12,
  holdTime: 0.05,
  cueLength: 1.78 * WORLD_SCALE,
  bridgeDist: 0.28 * WORLD_SCALE,
  edgeMargin: 0.5 * WORLD_SCALE,
  desiredShootDistance: 0.98 * WORLD_SCALE,
  humanAimLineSideOffset: 0.12 * WORLD_SCALE,
  poseLambda: 9,
  moveLambda: 5.6,
  rotLambda: 8.5,
  humanScale: 1.2 * 1.78 * WORLD_SCALE,
  humanVisualYawFix: Math.PI,
  stanceWidth: 0.52 * WORLD_SCALE,
  bridgePalmTableLift: 0.006 * WORLD_SCALE,
  bridgeCueLift: 0.018 * WORLD_SCALE,
  bridgeHandBackFromBall: 0.235 * WORLD_SCALE,
  bridgeHandSide: -0.115 * WORLD_SCALE,
  bridgeVGrooveForward: 0.026 * WORLD_SCALE,
  bridgeVGrooveSide: -0.032 * WORLD_SCALE,
  bridgePalmUnderCueDrop: 0.052 * WORLD_SCALE,
  chinToCueHeight: 0.11 * WORLD_SCALE,
  footGroundY: 0.035 * WORLD_SCALE,
  footLockStrength: 1,
  kneeBendShot: 0.16 * WORLD_SCALE,
  rightElbowShotRise: 0.18 * WORLD_SCALE,
  rightElbowShotSide: -0.46 * WORLD_SCALE,
  rightElbowShotBack: -0.78 * WORLD_SCALE,
  rightForearmOutward: 0.36 * WORLD_SCALE,
  rightForearmBack: 0.44 * WORLD_SCALE,
  rightForearmDown: 0.48 * WORLD_SCALE,
  rightForearmLength: 0.34 * WORLD_SCALE,
  rightStrokePull: 0.30 * WORLD_SCALE,
  rightStrokePush: 0.24 * WORLD_SCALE,
  rightHandShotLift: -0.30 * WORLD_SCALE,
  shootCueGripFromBack: 0.58 * WORLD_SCALE,
  idleRightHandY: 0.8 * WORLD_SCALE,
  idleRightHandX: 0.31 * WORLD_SCALE,
  idleRightHandZ: -0.015 * WORLD_SCALE,
  idleCueGripFromBack: 0.24 * WORLD_SCALE,
  idleCueDir: new THREE.Vector3(0.055, 0.965, -0.13),
  rightHandRollIdle: -2.2,
  rightHandRollShoot: -2.05,
  rightHandDownPose: 0.42,
  rightHandCueSocketLocal: new THREE.Vector3(-0.004, -0.014, 0.092).multiplyScalar(WORLD_SCALE)
};
const UP = new THREE.Vector3(0, 1, 0);
const Y_AXIS = UP;
const BASIS_MAT = new THREE.Matrix4();
const SNOOKER_TMP_VEC3_A = new THREE.Vector3();
const SNOOKER_TMP_VEC3_B = new THREE.Vector3();
const SNOOKER_TMP_VEC3_C = new THREE.Vector3();
const SNOOKER_TMP_VEC3_D = new THREE.Vector3();
const SNOOKER_TMP_VEC3_E = new THREE.Vector3();
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const clamp01 = (v) => clamp(v, 0, 1);
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => t * t * (3 - 2 * t);
const dampScalar = (current, target, lambda, dt) => THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));
const dampVector = (current, target, lambda, dt) => current.lerp(target, 1 - Math.exp(-lambda * dt));
const yawFromForward = (forward) => Math.atan2(-forward.x, -forward.z);
const cleanName = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

function makeBasisQuaternion(side, up, forward) {
  BASIS_MAT.makeBasis(side.clone().normalize(), up.clone().normalize(), forward.clone().normalize());
  return new THREE.Quaternion().setFromRotationMatrix(BASIS_MAT);
}
const HDRI_URL_CACHE = new Map();
const DEFAULT_HDRI_RESOLUTIONS = Object.freeze(['4k', '2k', '1k']);
function pickPolyHavenHdriUrl(files, preferred = DEFAULT_HDRI_RESOLUTIONS) {
  const hdriFiles = files?.hdri || files?.hdr || files?.exr || null;
  if (!hdriFiles || typeof hdriFiles !== 'object') return null;
  for (const res of preferred) {
    const entry = hdriFiles[res];
    if (typeof entry?.url === 'string') return entry.url;
    if (Array.isArray(entry) && typeof entry[0]?.url === 'string') return entry[0].url;
  }
  const first = Object.values(hdriFiles).find(Boolean);
  if (typeof first?.url === 'string') return first.url;
  if (Array.isArray(first) && typeof first[0]?.url === 'string') return first[0].url;
  return null;
}
async function resolveChampionHdriUrl(config = {}) {
  const cacheKey = `${config?.assetId ?? 'fallback'}|${(config?.preferredResolutions || []).join(',')}|${config?.fallbackResolution ?? ''}`;
  if (HDRI_URL_CACHE.has(cacheKey)) return HDRI_URL_CACHE.get(cacheKey);
  const preferred = Array.isArray(config?.preferredResolutions) && config.preferredResolutions.length
    ? config.preferredResolutions
    : DEFAULT_HDRI_RESOLUTIONS;
  const fallbackRes = config?.fallbackResolution || preferred[0] || '4k';
  const fallbackUrl = config?.fallbackUrl || `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/${fallbackRes}/${config?.assetId ?? 'neon_photostudio'}_${fallbackRes}.hdr`;
  if (typeof config?.assetUrl === 'string' && config.assetUrl.length) {
    HDRI_URL_CACHE.set(cacheKey, config.assetUrl);
    return config.assetUrl;
  }
  if (!config?.assetId || typeof fetch !== 'function') {
    HDRI_URL_CACHE.set(cacheKey, fallbackUrl);
    return fallbackUrl;
  }
  try {
    const response = await fetch(`https://api.polyhaven.com/files/${encodeURIComponent(config.assetId)}`);
    const json = response?.ok ? await response.json() : null;
    const picked = pickPolyHavenHdriUrl(json, preferred) || fallbackUrl;
    HDRI_URL_CACHE.set(cacheKey, picked);
    return picked;
  } catch {
    HDRI_URL_CACHE.set(cacheKey, fallbackUrl);
    return fallbackUrl;
  }
}
async function loadChampionHdriEnvironment(renderer, config = {}) {
  if (!renderer) return null;
  const url = await resolveChampionHdriUrl(config);
  const lowerUrl = `${url ?? ''}`.toLowerCase();
  const loader = lowerUrl.endsWith('.exr') ? new EXRLoader() : new RGBELoader();
  loader.setCrossOrigin?.('anonymous');
  return new Promise((resolve) => {
    loader.load(
      url,
      (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        texture.name = `${config?.assetId ?? 'snooker-champion'}-skybox`;
        texture.needsUpdate = true;
        const pmrem = new THREE.PMREMGenerator(renderer);
        pmrem.compileEquirectangularShader();
        const envMap = pmrem.fromEquirectangular(texture).texture;
        envMap.mapping = THREE.CubeUVReflectionMapping;
        envMap.name = `${config?.assetId ?? 'snooker-champion'}-env`;
        pmrem.dispose();
        resolve({ envMap, skyboxMap: texture, url });
      },
      undefined,
      () => resolve(null)
    );
  });
}
function createMaterial(color, roughness = 0.72, metalness = 0.03) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function resolveSnookerChampionWoodTextureOption(option = {}) {
  return {
    ...SNOOKER_CHAMPION_WOOD_TEXTURE_DEFAULT,
    ...option,
    hue: option.hue ?? SNOOKER_CHAMPION_WOOD_TEXTURE_DEFAULT.hue,
    sat: option.sat ?? SNOOKER_CHAMPION_WOOD_TEXTURE_DEFAULT.sat,
    light: option.light ?? SNOOKER_CHAMPION_WOOD_TEXTURE_DEFAULT.light,
    contrast: option.contrast ?? SNOOKER_CHAMPION_WOOD_TEXTURE_DEFAULT.contrast
  };
}
function applySnookerChampionWoodMaterial(material, textureOption = {}, role = 'wood') {
  if (!material) return material;
  const mat = material.clone ? material.clone() : material;
  const woodOption = resolveSnookerChampionWoodTextureOption(textureOption);
  const repeat = role === 'rail' ? { x: 0.08, y: 1.35 } : { x: 0.11, y: 1.1 };
  applyWoodTextures(mat, {
    ...woodOption,
    repeat: textureOption.repeat ?? repeat,
    sharedKey: `snooker-champion-${role}-${woodOption.id ?? 'wood'}`
  });
  mat.roughness = Math.min(Math.max(mat.roughness ?? 0.42, 0.32), 0.68);
  mat.metalness = Math.min(mat.metalness ?? 0.04, 0.08);
  mat.envMapIntensity = Math.max(mat.envMapIntensity ?? 0.45, 0.7);
  mat.needsUpdate = true;
  return mat;
}
function isSnookerChampionGlbWoodMesh(child) {
  const materials = Array.isArray(child?.material) ? child.material : [child?.material];
  const label = [
    child?.name,
    child?.parent?.name,
    ...materials.map((mat) => mat?.name)
  ].filter(Boolean).join(' ');
  return SNOOKER_CHAMPION_GLTF_WOOD_PATTERN.test(label) && !SNOOKER_CHAMPION_GLTF_NON_WOOD_PATTERN.test(label);
}
function resolveClothColor(cloth = null) {
  return cloth?.baseColor ?? cloth?.color ?? cloth?.palette?.base ?? 0x0f6f45;
}
function createPoolRoyaleClothTexture(cloth = null, fallbackColor = 0x0f6f45) {
  const color = new THREE.Color(resolveClothColor(cloth) ?? fallbackColor);
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  const base = `#${color.getHexString()}`;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const highlight = color.clone().lerp(new THREE.Color(0xffffff), 0.22);
  const shadow = color.clone().lerp(new THREE.Color(0x000000), 0.28);
  for (let y = 0; y < canvas.height; y += 2) {
    ctx.fillStyle = y % 4 === 0 ? `#${highlight.getHexString()}12` : `#${shadow.getHexString()}10`;
    ctx.fillRect(0, y, canvas.width, 1);
  }
  for (let x = 0; x < canvas.width; x += 3) {
    ctx.fillStyle = x % 6 === 0 ? `#${highlight.getHexString()}0d` : `#${shadow.getHexString()}0d`;
    ctx.fillRect(x, 0, 1, canvas.height);
  }
  for (let i = 0; i < 26000; i += 1) {
    const alpha = 0.018 + Math.random() * 0.05;
    ctx.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
    ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 1 + Math.random() * 2, 1);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(7, 13);
  tex.anisotropy = 16;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}
function applyClothMaterialMapping(material, cloth = null, fallbackColor = 0x0f6f45) {
  if (!material) return material;
  const mat = material.clone ? material.clone() : material;
  mat.color = new THREE.Color(resolveClothColor(cloth) ?? fallbackColor);
  mat.map = createPoolRoyaleClothTexture(cloth, fallbackColor);
  mat.roughness = Math.max(mat.roughness ?? 0.84, 0.9);
  mat.metalness = 0;
  mat.envMapIntensity = Math.min(mat.envMapIntensity ?? 0.18, 0.22);
  mat.needsUpdate = true;
  return mat;
}
function enableShadow(obj) {
  obj.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      child.frustumCulled = false;
    }
  });
  return obj;
}
function createUnitCylinder(color) {
  return new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 18), createMaterial(color, 0.7, 0.03));
}
function setSegment(mesh, a, b, radius) {
  const dir = b.clone().sub(a);
  const len = Math.max(0.0001, dir.length());
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
  mesh.scale.set(radius, len, radius);
}
function createLine(color, opacity = 0.9) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  return new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
}
function setLinePoints(line, a, b) {
  const pos = line.geometry.getAttribute('position');
  pos.setXYZ(0, a.x, a.y, a.z);
  pos.setXYZ(1, b.x, b.y, b.z);
  pos.needsUpdate = true;
  line.geometry.computeBoundingSphere();
}
function createCue() {
  const group = new THREE.Group();
  const SCALE = CFG.ballR / (OFFICIAL_SNOOKER_BALL_DIAMETER_M / 2 * SNOOKER_PLAYFIELD_SCALE);
  const shaftMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xd8b17d,
    roughness: 0.34,
    metalness: 0,
    clearcoat: 0.56,
    clearcoatRoughness: 0.24
  });
  const ferruleMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xf8fafc,
    roughness: 0.22,
    metalness: 0.04,
    clearcoat: 0.5,
    clearcoatRoughness: 0.18
  });
  const tipMaterial = new THREE.MeshStandardMaterial({ color: 0x1f3f73, roughness: 0.95, metalness: 0 });
  const bandMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x111827,
    roughness: 0.32,
    metalness: 0.08,
    clearcoat: 0.18,
    clearcoatRoughness: 0.2
  });
  const ringMaterial = new THREE.MeshPhysicalMaterial({ color: 0xc07a2d, roughness: 0.38, metalness: 0.62 });
  const makeSegment = (name, material, radialSegments = 40) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, radialSegments), material);
    mesh.name = `snooker-royal-cue-${name}`;
    enableShadow(mesh);
    group.add(mesh);
    return mesh;
  };
  const rearShaft = makeSegment('rear-tapered-shaft', shaftMaterial, 48);
  const frontShaft = makeSegment('front-tapered-shaft', shaftMaterial, 48);
  const butt = makeSegment('rounded-butt', shaftMaterial, 56);
  const stripe = makeSegment('butt-stripe-wrap', bandMaterial, 64);
  const ring = makeSegment('brass-ring', ringMaterial, 48);
  const ferrule = makeSegment('ferrule', ferruleMaterial, 40);
  const tip = makeSegment('blue-leather-tip', tipMaterial, 32);
  const buttCap = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), shaftMaterial);
  buttCap.name = 'snooker-royal-cue-rounded-butt-cap';
  enableShadow(buttCap);
  group.add(buttCap);
  return { group, rearShaft, frontShaft, butt, stripe, ring, ferrule, tip, buttCap, scale: SCALE };
}
function setSegmentTaper(mesh, a, b, radiusTop, radiusBottom = radiusTop) {
  const dir = b.clone().sub(a);
  const len = Math.max(0.0001, dir.length());
  const geomKey = `${radiusTop.toFixed(5)}:${radiusBottom.toFixed(5)}:${len.toFixed(5)}`;
  if (mesh.userData?.geomKey !== geomKey) {
    mesh.geometry?.dispose?.();
    mesh.geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, len, 48);
    mesh.userData = { ...(mesh.userData || {}), geomKey };
  }
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
  mesh.scale.set(1, 1, 1);
}
function setCuePose(cue, back, tip) {
  const dir = tip.clone().sub(back).normalize();
  const totalLength = tip.distanceTo(back);
  const rearLength = totalLength * 0.62;
  const frontLength = totalLength - rearLength;
  const tipRadius = 0.008 * CFG.scale;
  const joinRadius = 0.0165 * CFG.scale;
  const buttRadius = 0.026 * CFG.scale;
  const buttLength = Math.min(rearLength * 0.36, 0.52 * CFG.scale);
  const stripeLength = Math.min(rearLength * 0.34, 0.48 * CFG.scale);
  const ferruleLength = 0.038 * CFG.scale;
  const tipLength = 0.024 * CFG.scale;
  const p0 = back.clone();
  const buttEnd = p0.clone().addScaledVector(dir, buttLength);
  const rearEnd = back.clone().addScaledVector(dir, rearLength);
  const ferruleBack = tip.clone().addScaledVector(dir, -(ferruleLength + tipLength));
  const tipBack = tip.clone().addScaledVector(dir, -tipLength);
  setSegmentTaper(cue.butt, p0, buttEnd, buttRadius, buttRadius * 1.04);
  setSegmentTaper(cue.rearShaft, buttEnd, rearEnd, joinRadius, buttRadius * 0.92);
  setSegmentTaper(cue.frontShaft, rearEnd, ferruleBack, tipRadius, joinRadius);
  setSegmentTaper(cue.ferrule, ferruleBack, tipBack, tipRadius * 1.08, tipRadius * 1.18);
  setSegmentTaper(cue.tip, tipBack, tip, tipRadius * 1.05, tipRadius * 1.05);
  const stripeStart = back.clone().addScaledVector(dir, Math.max(buttLength * 0.28, rearLength * 0.18));
  const stripeEnd = stripeStart.clone().addScaledVector(dir, stripeLength);
  setSegmentTaper(cue.stripe, stripeStart, stripeEnd, buttRadius * 1.012, buttRadius * 1.012);
  const ringStart = rearEnd.clone().addScaledVector(dir, -0.022 * CFG.scale);
  setSegmentTaper(cue.ring, ringStart, rearEnd, joinRadius * 1.08, joinRadius * 1.12);
  cue.buttCap.position.copy(back);
  cue.buttCap.scale.setScalar(buttRadius * 1.08);
}
function cuePoseFromGrip(grip, dir, gripFromBack, length = CFG.cueLength) {
  const n = dir.clone().normalize();
  return { back: grip.clone().addScaledVector(n, -gripFromBack), tip: grip.clone().addScaledVector(n, length - gripFromBack) };
}
function createBall(number, color, isCue = false, kind = 'red', value = 1, spot = null) {
  const material = getBilliardBallMaterial({
    color,
    pattern: isCue ? 'cue' : 'solid',
    number: null,
    variantKey: SNOOKER_BALL_MATERIAL_VARIANT
  });
  material.depthTest = true;
  material.depthWrite = true;
  material.roughness = Math.min(material.roughness ?? 0.48, 0.34);
  material.metalness = Math.max(material.metalness ?? 0, 0.02);
  material.envMapIntensity = Math.max(material.envMapIntensity ?? 0.45, 0.9);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(CFG.ballR, 64, 64), material);
  mesh.renderOrder = 20;
  mesh.userData.snookerChampionBall = true;
  enableShadow(mesh);
  return {
    mesh,
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    spin: new THREE.Vector2(),
    omega: new THREE.Vector3(),
    impacted: false,
    launchDir: null,
    isCue,
    number,
    kind,
    value,
    spot: spot ? spot.clone() : null,
    potted: false,
    radius: CFG.ballR
  };
}

function getOfficialSnookerSpots(ballY = SNOOKER_BALL_CENTER_Y) {
  const halfL = CFG.tableL / 2;
  const baulkZ = halfL - SNOOKER_OFFICIAL_BAULK_FROM_CUSHION;
  const topCushionZ = -halfL;
  const blueZ = 0;
  const pinkZ = (blueZ + topCushionZ) / 2;
  const blackZ = topCushionZ + SNOOKER_OFFICIAL_BLACK_FROM_TOP_CUSHION;
  const redApexZ = pinkZ - CFG.ballR * 2.04;
  return {
    cue: new THREE.Vector3(-SNOOKER_OFFICIAL_D_RADIUS * 0.58, ballY, baulkZ),
    yellow: new THREE.Vector3(-SNOOKER_OFFICIAL_D_RADIUS, ballY, baulkZ),
    green: new THREE.Vector3(SNOOKER_OFFICIAL_D_RADIUS, ballY, baulkZ),
    brown: new THREE.Vector3(0, ballY, baulkZ),
    blue: new THREE.Vector3(0, ballY, blueZ),
    pink: new THREE.Vector3(0, ballY, pinkZ),
    black: new THREE.Vector3(0, ballY, blackZ),
    redApex: new THREE.Vector3(0, ballY, redApexZ),
    baulkZ
  };
}

function snookerRackPositions() {
  const ballY = SNOOKER_BALL_CENTER_Y;
  const spots = getOfficialSnookerSpots(ballY);
  const out = [{ n: 0, c: 0xf8fafc, p: spots.cue, cue: true, kind: 'cue', value: 0 }];
  let idx = 1;
  for (let row = 0; row < 5; row += 1) {
    for (let i = 0; i <= row; i += 1) {
      out.push({
        n: idx++,
        c: 0xdc2626,
        p: new THREE.Vector3((i - row / 2) * CFG.ballR * 2.04, ballY, spots.redApex.z - row * CFG.ballR * 1.78),
        kind: 'red',
        value: SNOOKER_BALL_VALUES.red
      });
    }
  }
  out.push(
    { n: 16, c: 0xfacc15, p: spots.yellow, kind: 'yellow', value: SNOOKER_BALL_VALUES.yellow, spot: spots.yellow },
    { n: 17, c: 0x16a34a, p: spots.green, kind: 'green', value: SNOOKER_BALL_VALUES.green, spot: spots.green },
    { n: 18, c: 0x7c2d12, p: spots.brown, kind: 'brown', value: SNOOKER_BALL_VALUES.brown, spot: spots.brown },
    { n: 19, c: 0x2563eb, p: spots.blue, kind: 'blue', value: SNOOKER_BALL_VALUES.blue, spot: spots.blue },
    { n: 20, c: 0xf472b6, p: spots.pink, kind: 'pink', value: SNOOKER_BALL_VALUES.pink, spot: spots.pink },
    { n: 21, c: 0x111827, p: spots.black, kind: 'black', value: SNOOKER_BALL_VALUES.black, spot: spots.black }
  );
  return out;
}
function addBalls(tableGroup) {
  const balls = snookerRackPositions().map((item) => {
    const ball = createBall(item.n, item.c, Boolean(item.cue), item.kind, item.value, item.spot);
    ball.pos.copy(item.p);
    ball.mesh.position.copy(ball.pos).setY(ball.pos.y + CFG.ballR * BALL_VISUAL_LIFT);
    tableGroup.add(ball.mesh);
    return ball;
  });
  return { balls, cueBall: balls.find((b) => b.isCue) || balls[0] };
}
function resolveSnookerChampionGlbUpperBounds(model, fullBounds) {
  const sourceSize = fullBounds.getSize(new THREE.Vector3());
  const upperCutoff = fullBounds.min.y + sourceSize.y * 0.45;
  const upperBounds = new THREE.Box3();
  model.traverse((node) => {
    if (!node?.isMesh) return;
    const nodeBox = new THREE.Box3().setFromObject(node);
    if (nodeBox.isEmpty()) return;
    const centerY = nodeBox.getCenter(new THREE.Vector3()).y;
    const label = `${node.name || ''} ${node.material?.name || ''}`.toLowerCase();
    const isOriginalBaseLike = /leg|stand|base|foot|pedestal|support/.test(label);
    if (isOriginalBaseLike) return;
    if (centerY >= upperCutoff || /cloth|felt|slate|bed|rail|cushion|frame/.test(label)) {
      upperBounds.union(nodeBox);
    }
  });
  return upperBounds.isEmpty() ? fullBounds.clone() : upperBounds;
}

function resolveSnookerChampionGlbBedBounds(model) {
  const bedBounds = new THREE.Box3();
  model.traverse((node) => {
    if (!node?.isMesh) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    const label = [node.name, node.parent?.name, ...materials.map((mat) => mat?.name)].filter(Boolean).join(' ').toLowerCase();
    if (!/cloth|felt|baize|slate|bed|playfield|surface/.test(label) || /rail|cushion|pocket|net|leather|wood|frame/.test(label)) return;
    const nodeBox = new THREE.Box3().setFromObject(node);
    if (!nodeBox.isEmpty()) bedBounds.union(nodeBox);
  });
  return bedBounds.isEmpty() ? null : bedBounds;
}

function addOfficialSnookerMarkings(tableGroup) {
  const markY = SNOOKER_BALL_CENTER_Y - CFG.ballR + SNOOKER_TABLE_MARKING_LIFT;
  const lineMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.94,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
  });
  const spotMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3
  });
  const spots = getOfficialSnookerSpots(markY);
  const addRaisedMarking = (points, name) => {
    const path = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    const geometry = new THREE.TubeGeometry(path, Math.max(2, points.length * 2), SNOOKER_TABLE_MARKING_RADIUS, 8, false);
    const mesh = new THREE.Mesh(geometry, lineMat);
    mesh.name = name;
    mesh.renderOrder = 28;
    mesh.userData.snookerChampionMarking = true;
    tableGroup.add(mesh);
    return mesh;
  };
  addRaisedMarking([
    new THREE.Vector3(-CFG.tableW / 2, markY, spots.baulkZ),
    new THREE.Vector3(CFG.tableW / 2, markY, spots.baulkZ)
  ], 'official-snooker-baulk-line-visible');
  const arcPoints = [];
  for (let i = 0; i <= 96; i += 1) {
    const theta = (i / 96) * Math.PI;
    arcPoints.push(new THREE.Vector3(
      Math.cos(theta) * SNOOKER_OFFICIAL_D_RADIUS,
      markY,
      spots.baulkZ + Math.sin(theta) * SNOOKER_OFFICIAL_D_RADIUS
    ));
  }
  addRaisedMarking(arcPoints, 'official-snooker-d-semicircle-visible');
  ['yellow', 'green', 'brown', 'blue', 'pink', 'black'].forEach((id) => {
    const spot = spots[id];
    const marker = new THREE.Mesh(new THREE.CircleGeometry(Math.max(CFG.ballR * 0.2, 0.018 * CFG.scale), 36), spotMat);
    marker.name = `official-snooker-${id}-spot-visible`;
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(spot.x, markY + 0.002 * CFG.scale, spot.z);
    marker.renderOrder = 29;
    marker.userData.snookerChampionMarking = true;
    tableGroup.add(marker);
  });
}

function addTable(scene, renderer, options = {}) {
  const tableGroup = new THREE.Group();
  tableGroup.position.y = CFG.tableTopY;
  scene.add(tableGroup);
  const clothColor = options.clothColor ?? 0x0f6f45;
  const clothOption = options.clothOption ?? null;
  const textureOption = resolveSnookerChampionTextureOption(options.textureId);
  const pocketY = CFG.ballR + 0.006 * CFG.scale;
  const pocketPositions = [
    [-CFG.tableW / 2 + SNOOKER_CORNER_JAW_SETBACK, pocketY, -CFG.tableL / 2 + SNOOKER_CORNER_JAW_SETBACK, SNOOKER_OFFICIAL_CORNER_POCKET_RADIUS],
    [CFG.tableW / 2 - SNOOKER_CORNER_JAW_SETBACK, pocketY, -CFG.tableL / 2 + SNOOKER_CORNER_JAW_SETBACK, SNOOKER_OFFICIAL_CORNER_POCKET_RADIUS],
    [-CFG.tableW / 2 + SNOOKER_CORNER_JAW_SETBACK, pocketY, CFG.tableL / 2 - SNOOKER_CORNER_JAW_SETBACK, SNOOKER_OFFICIAL_CORNER_POCKET_RADIUS],
    [CFG.tableW / 2 - SNOOKER_CORNER_JAW_SETBACK, pocketY, CFG.tableL / 2 - SNOOKER_CORNER_JAW_SETBACK, SNOOKER_OFFICIAL_CORNER_POCKET_RADIUS],
    [-CFG.tableW / 2 + SNOOKER_MIDDLE_JAW_SETBACK, pocketY, 0, SNOOKER_OFFICIAL_MIDDLE_POCKET_RADIUS],
    [CFG.tableW / 2 - SNOOKER_MIDDLE_JAW_SETBACK, pocketY, 0, SNOOKER_OFFICIAL_MIDDLE_POCKET_RADIUS]
  ].map(([x, y, z, radius]) => {
    const pocket = new THREE.Vector3(x, y, z);
    pocket.userData = { radius };
    return pocket;
  });
  addOfficialSnookerMarkings(tableGroup);
  let disposed = false;
  const gltfTools = createUniversalGLTFLoader(renderer);
  (async () => {
    let gltf = null;
    let sourceUrl = SNOOKER_CHAMPION_TABLE_GLB_URL;
    for (const url of [SNOOKER_CHAMPION_TABLE_GLB_URL, SNOOKER_CHAMPION_TABLE_FALLBACK_GLB_URL]) {
      try {
        // eslint-disable-next-line no-await-in-loop
        gltf = await gltfTools.loader.loadAsync(url);
        sourceUrl = url;
        break;
      } catch {
        gltf = null;
      }
    }
    if (disposed) return;
    const model = gltf?.scene || gltf?.scenes?.[0];
    if (!model) {
      if (typeof options.onStatus === 'function') {
        options.onStatus('GLB snooker table failed to load; procedural table disabled');
      }
      return;
    }
    enableShadow(model);
    model.updateMatrixWorld(true);
    const targetCenter = new THREE.Vector3(0, 0, 0);
    const targetSize = new THREE.Vector3(CFG.tableW, CFG.railH || CFG.ballR, CFG.tableL);
    const fullSourceBounds = new THREE.Box3().setFromObject(model);
    const sourceBedBounds = resolveSnookerChampionGlbBedBounds(model);
    const sourceFitBounds = sourceBedBounds ?? resolveSnookerChampionGlbUpperBounds(model, fullSourceBounds);
    const sourceFitSize = sourceFitBounds.getSize(new THREE.Vector3());
    const fit = resolveSnookerGlbFitTransform(
      { x: sourceFitSize.x, y: sourceFitSize.y, z: sourceFitSize.z },
      { x: targetSize.x, y: targetSize.y, z: targetSize.z }
    );
    const horizontalScale = Math.min(fit.scale.x, fit.scale.z);
    fit.scale.y = horizontalScale;
    model.scale.set(fit.scale.x, fit.scale.y, fit.scale.z);
    model.updateMatrixWorld(true);
    const scaledFullBounds = new THREE.Box3().setFromObject(model);
    const scaledBedBounds = resolveSnookerChampionGlbBedBounds(model);
    const scaledFitBounds = scaledBedBounds ?? resolveSnookerChampionGlbUpperBounds(model, scaledFullBounds);
    const scaledFitCenter = scaledFitBounds.getCenter(new THREE.Vector3());
    const desiredBedTopY = CFG.ballR - SNOOKER_TABLE_MARKING_LIFT * 0.35;
    model.position.set(
      targetCenter.x - scaledFitCenter.x,
      desiredBedTopY - scaledFitBounds.max.y,
      targetCenter.z - scaledFitCenter.z
    );
    model.updateMatrixWorld(true);
    model.name = 'snooker-champion-snooker-royal-arena-table-glb';
    model.userData.loadedBySnookerChampion = true;
    model.userData.sourceUrl = sourceUrl;
    model.userData.mapping = 'glb-bed-to-game-playfield';
    model.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      child.renderOrder = 1;
      const matName = `${child.material.name || child.name || ''}`.toLowerCase();
      if (matName.includes('cloth') || matName.includes('felt') || matName.includes('slate') || matName.includes('bed')) {
        child.receiveShadow = true;
        child.castShadow = false;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        const clothMaterials = materials.map((material) => applyClothMaterialMapping(material, clothOption, clothColor));
        child.material = Array.isArray(child.material) ? clothMaterials : clothMaterials[0] ?? child.material;
      } else if (matName.includes('cushion')) {
        child.material = applyClothMaterialMapping(child.material, clothOption, clothColor);
        child.material.roughness = Math.max(child.material.roughness ?? 0.8, 0.86);
      } else if (isSnookerChampionGlbWoodMesh(child)) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        const textured = materials.map((material) =>
          applySnookerChampionWoodMaterial(material, textureOption, 'glb-wood')
        );
        child.material = Array.isArray(child.material) ? textured : textured[0] ?? child.material;
      }
    });
    tableGroup.add(model);
    if (typeof options.onStatus === 'function') {
      options.onStatus('Snooker GLB table loaded; game playfield mapped directly to the GLB bed');
    }
  })();
  if (options.shadowCatcher !== false) {
    const shadowCatcher = new THREE.Mesh(
      new THREE.PlaneGeometry(48 * CFG.scale, 48 * CFG.scale),
      new THREE.ShadowMaterial({
        color: 0x000000,
        opacity: SNOOKER_HDRI_SHADOW_OPACITY,
        transparent: true,
        depthWrite: false
      })
    );
    shadowCatcher.name = 'SnookerChampion_HdriFloorShadowCatcher';
    shadowCatcher.rotation.x = -Math.PI / 2;
    shadowCatcher.receiveShadow = true;
    shadowCatcher.castShadow = false;
    shadowCatcher.renderOrder = -4;
    scene.add(shadowCatcher);
  }
  return { tableGroup, pocketPositions, disposeTableLoader: () => { disposed = true; gltfTools.dispose(); } };
}
function createUniversalGLTFLoader(renderer) {
  const manager = new THREE.LoadingManager();
  const loader = new GLTFLoader(manager);
  loader.setCrossOrigin('anonymous');
  const draco = new DRACOLoader(manager);
  draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
  loader.setDRACOLoader(draco);
  const ktx2 = new KTX2Loader(manager);
  ktx2.setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/basis/');
  ktx2.detectSupport(renderer);
  loader.setKTX2Loader(ktx2);
  loader.setMeshoptDecoder(MeshoptDecoder);
  return { loader, dispose: () => { draco.dispose(); ktx2.dispose(); } };
}
function findBone(all, aliases) {
  const list = all.map((bone) => ({ bone, name: cleanName(bone.name) }));
  const names = aliases.map(cleanName);
  for (const alias of names) {
    const exact = list.find((x) => x.name === alias || x.name.endsWith(alias));
    if (exact) return exact.bone;
  }
  for (const alias of names) {
    const loose = list.find((x) => x.name.includes(alias));
    if (loose) return loose.bone;
  }
  return undefined;
}
function buildAvatarBones(model) {
  const all = [];
  model.traverse((obj) => { if (obj.isBone) all.push(obj); });
  const f = (...names) => findBone(all, names);
  return {
    hips: f('hips', 'pelvis', 'mixamorigHips'), spine: f('spine', 'spine01', 'mixamorigSpine'), chest: f('spine2', 'chest', 'upperchest', 'mixamorigSpine2', 'mixamorigSpine1'), neck: f('neck', 'mixamorigNeck'), head: f('head', 'mixamorigHead'),
    leftUpperArm: f('leftupperarm', 'leftarm', 'upperarml', 'mixamorigLeftArm'), leftLowerArm: f('leftforearm', 'leftlowerarm', 'forearml', 'mixamorigLeftForeArm'), leftHand: f('lefthand', 'handl', 'mixamorigLeftHand'),
    rightUpperArm: f('rightupperarm', 'rightarm', 'upperarmr', 'mixamorigRightArm'), rightLowerArm: f('rightforearm', 'rightlowerarm', 'forearmr', 'mixamorigRightForeArm'), rightHand: f('righthand', 'handr', 'mixamorigRightHand'),
    leftUpperLeg: f('leftupleg', 'leftupperleg', 'leftthigh', 'mixamorigLeftUpLeg'), leftLowerLeg: f('leftleg', 'leftlowerleg', 'leftcalf', 'mixamorigLeftLeg'), leftFoot: f('leftfoot', 'footl', 'mixamorigLeftFoot'),
    rightUpperLeg: f('rightupleg', 'rightupperleg', 'rightthigh', 'mixamorigRightUpLeg'), rightLowerLeg: f('rightleg', 'rightlowerleg', 'rightcalf', 'mixamorigRightLeg'), rightFoot: f('rightfoot', 'footr', 'mixamorigRightFoot')
  };
}
function collectFingerBones(hand) {
  const out = [];
  hand?.traverse((obj) => {
    if (!obj.isBone || obj === hand) return;
    const n = cleanName(obj.name);
    if (['thumb', 'index', 'middle', 'ring', 'pinky', 'little', 'finger'].some((s) => n.includes(s))) out.push(obj);
  });
  return out;
}
function normalizeHuman(model) {
  model.rotation.set(0, CFG.humanVisualYawFix, 0);
  model.position.set(0, 0, 0);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const height = Math.max(box.max.y - box.min.y, 0.0001);
  model.scale.multiplyScalar(CFG.humanScale / height);
  model.updateMatrixWorld(true);
  const scaledBox = new THREE.Box3().setFromObject(model);
  const center = scaledBox.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -scaledBox.min.y, -center.z);
}
function addHuman(scene, renderer, setStatus) {
  const human = { root: new THREE.Group(), modelRoot: new THREE.Group(), model: null, bones: {}, leftFingers: [], rightFingers: [], restQuats: new Map(), activeGlb: false, poseT: 0, walkT: 0, yaw: 0, breathT: 0, settleT: 0, strikeRoot: new THREE.Vector3(), strikeYaw: 0, strikeClock: 0 };
  human.root.visible = false;
  human.modelRoot.visible = false;
  scene.add(human.root, human.modelRoot);
  const { loader } = createUniversalGLTFLoader(renderer);
  setStatus('Loading ReadyPlayer GLTF human…');
  loader.load(HUMAN_URL, (gltf) => {
    const model = gltf.scene;
    normalizeHuman(model);
    model.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.castShadow = true;
      obj.receiveShadow = true;
      obj.frustumCulled = false;
      const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
      mats.forEach((m) => { if (m.map) { m.map.colorSpace = THREE.SRGBColorSpace; m.map.flipY = false; m.map.needsUpdate = true; } m.needsUpdate = true; });
    });
    human.bones = buildAvatarBones(model);
    human.leftFingers = collectFingerBones(human.bones.leftHand);
    human.rightFingers = collectFingerBones(human.bones.rightHand);
    [...Object.values(human.bones), ...human.leftFingers, ...human.rightFingers].forEach((bone) => bone && human.restQuats.set(bone, bone.quaternion.clone()));
    human.activeGlb = Boolean(human.bones.hips && human.bones.spine && human.bones.head && human.bones.rightUpperArm && human.bones.rightLowerArm && human.bones.rightHand);
    human.model = model;
    human.modelRoot.add(model);
    human.modelRoot.visible = human.activeGlb;
    setStatus(human.activeGlb ? 'ReadyPlayer GLTF human active' : 'ReadyPlayer loaded but skeleton aliases incomplete');
  }, undefined, () => setStatus('ReadyPlayer GLTF human failed'));
  return human;
}
function setBoneWorldQuaternion(bone, q) {
  if (!bone || !q) return;
  const parentQ = new THREE.Quaternion();
  bone.parent?.getWorldQuaternion(parentQ);
  bone.quaternion.copy(parentQ.invert().multiply(q));
  bone.updateMatrixWorld(true);
}
function firstBoneChild(bone) { return bone?.children.find((child) => child.isBone); }
function rotateBoneToward(bone, target, strength = 1, fallbackDir = UP) {
  if (!bone || strength <= 0) return;
  const bonePos = bone.getWorldPosition(new THREE.Vector3());
  const childPos = firstBoneChild(bone)?.getWorldPosition(new THREE.Vector3()) || bonePos.clone().addScaledVector(fallbackDir.clone().normalize(), 0.25 * CFG.scale);
  const current = childPos.sub(bonePos).normalize();
  const desired = target.clone().sub(bonePos);
  if (desired.lengthSq() < 1e-6 || current.lengthSq() < 1e-6) return;
  const delta = new THREE.Quaternion().slerpQuaternions(new THREE.Quaternion(), new THREE.Quaternion().setFromUnitVectors(current, desired.normalize()), clamp01(strength));
  setBoneWorldQuaternion(bone, delta.multiply(bone.getWorldQuaternion(new THREE.Quaternion())));
}
function twistBone(bone, axis, amount) {
  if (!bone || Math.abs(amount) < 1e-5) return;
  setBoneWorldQuaternion(bone, new THREE.Quaternion().setFromAxisAngle(axis.clone().normalize(), amount).multiply(bone.getWorldQuaternion(new THREE.Quaternion())));
}
function aimTwoBone(upper, lower, elbow, hand, pole, upperStrength = 0.96, lowerStrength = 0.98) {
  for (let i = 0; i < 4; i += 1) {
    rotateBoneToward(upper, elbow, upperStrength, pole);
    rotateBoneToward(lower, hand, lowerStrength, pole);
  }
}
function setHandBasis(bone, side, up, forward, roll = 0, strength = 1) {
  if (!bone || strength <= 0) return;
  const q = makeBasisQuaternion(side, up, forward);
  if (Math.abs(roll) > 1e-4) q.multiply(new THREE.Quaternion().setFromAxisAngle(forward.clone().normalize(), roll));
  setBoneWorldQuaternion(bone, bone.getWorldQuaternion(new THREE.Quaternion()).slerp(q, clamp01(strength)));
}
function cueSocketOffsetWorld(side, up, forward, roll, socketLocal = CFG.rightHandCueSocketLocal) {
  const q = makeBasisQuaternion(side, up, forward);
  if (Math.abs(roll) > 1e-5) q.multiply(new THREE.Quaternion().setFromAxisAngle(forward.clone().normalize(), roll));
  return socketLocal.clone().applyQuaternion(q);
}
function poseFingers(fingers, mode, weight) {
  const w = clamp01(weight);
  fingers.forEach((finger, i) => {
    const n = cleanName(finger.name);
    const thumb = n.includes('thumb'), index = n.includes('index'), middle = n.includes('middle'), ring = n.includes('ring'), pinky = n.includes('pinky') || n.includes('little');
    const base = !(n.includes('2') || n.includes('3') || n.includes('intermediate') || n.includes('distal'));
    const mid = n.includes('2') || n.includes('intermediate');
    const tip = n.includes('3') || n.includes('distal');
    if (mode === 'idle') { finger.rotation.x += 0.018 * w; finger.rotation.z += 0.01 * w * (i % 2 ? -1 : 1); return; }
    if (mode === 'grip') {
      if (thumb) { finger.rotation.x += 0.48 * w; finger.rotation.y += -0.82 * w; finger.rotation.z += 0.54 * w; return; }
      const curl = index ? (base ? 0.58 : mid ? 0.9 : 0.68) : middle ? (base ? 0.76 : mid ? 1.02 : 0.76) : ring ? (base ? 0.72 : mid ? 0.92 : 0.7) : pinky ? (base ? 0.62 : mid ? 0.82 : 0.62) : 0;
      finger.rotation.x += curl * w;
      finger.rotation.y += (index ? -0.12 : middle ? -0.03 : ring ? 0.04 : pinky ? 0.08 : 0) * w;
      finger.rotation.z += (index ? -0.08 : middle ? -0.02 : ring ? 0.06 : pinky ? 0.12 : 0) * w;
      return;
    }
    // Open snooker bridge: stable fingertips on the cloth with the thumb pressed
    // into the index knuckle to form a precise V-groove for the cue to ride through.
    if (thumb) { finger.rotation.x += -0.12 * w; finger.rotation.y += 1.1 * w; finger.rotation.z += -1.08 * w; }
    else if (index) { finger.rotation.x += (base ? 0.18 : mid ? 0.28 : 0.18) * w; finger.rotation.y += -0.58 * w; finger.rotation.z += -0.5 * w; }
    else if (middle) { finger.rotation.x += (base ? 0.12 : mid ? 0.24 : 0.16) * w; finger.rotation.y += -0.18 * w; finger.rotation.z += -0.16 * w; }
    else if (ring || pinky) { finger.rotation.x += (base ? (ring ? 0.06 : 0.04) : mid ? (ring ? 0.14 : 0.12) : tip ? (ring ? 0.1 : 0.08) : 0.08) * w; finger.rotation.y += (ring ? 0.14 : 0.28) * w; finger.rotation.z += (ring ? 0.24 : 0.42) * w; }
  });
}
function driveHuman(human, frame) {
  if (!human.activeGlb || !human.model) return;
  human.modelRoot.visible = true;
  human.modelRoot.position.copy(frame.rootWorld);
  human.modelRoot.rotation.y = human.yaw;
  human.modelRoot.updateMatrixWorld(true);
  human.restQuats.forEach((q, bone) => bone.quaternion.copy(q));
  human.modelRoot.updateMatrixWorld(true);
  const b = human.bones;
  const ik = easeInOut(clamp01(frame.t));
  const idle = 1 - ik;
  const cueDir = frame.cueTipWorld.clone().sub(frame.cueBackWorld).normalize();
  const standingCueDir = CFG.idleCueDir.clone().applyAxisAngle(Y_AXIS, human.yaw).normalize();
  const shotQ = makeBasisQuaternion(frame.side, UP, frame.forward);
  if (frame.walkAmount * idle > 0.001) {
    const s = Math.sin(human.walkT * 6.2), c = Math.cos(human.walkT * 6.2), w = frame.walkAmount * idle;
    if (b.leftUpperLeg) b.leftUpperLeg.rotation.x += s * 0.22 * w;
    if (b.rightUpperLeg) b.rightUpperLeg.rotation.x -= s * 0.22 * w;
    if (b.leftLowerLeg) b.leftLowerLeg.rotation.x += Math.max(0, -s) * 0.18 * w;
    if (b.rightLowerLeg) b.rightLowerLeg.rotation.x += Math.max(0, s) * 0.18 * w;
    if (b.leftUpperArm) b.leftUpperArm.rotation.x -= s * 0.2 * w;
    if (b.rightUpperArm) b.rightUpperArm.rotation.x += s * 0.2 * w;
    if (b.spine) b.spine.rotation.z += c * 0.02 * w;
    if (b.hips) b.hips.rotation.z -= c * 0.014 * w;
  }
  if (ik >= 0.025) {
    rotateBoneToward(b.hips, frame.torsoCenterWorld, (0.12 + 0.35 * ik) * ik, frame.forward);
    twistBone(b.hips, frame.side, -0.045 * ik);
    twistBone(b.spine, frame.side, -0.2 * ik);
    rotateBoneToward(b.spine, frame.chestCenterWorld, (0.34 + 0.34 * ik) * ik, frame.forward);
    rotateBoneToward(b.chest, frame.neckWorld, (0.5 + 0.28 * ik) * ik, frame.forward);
    twistBone(b.chest, frame.side, -0.32 * ik);
    rotateBoneToward(b.neck, frame.headCenterWorld, 0.64 * ik, frame.forward);
    setBoneWorldQuaternion(b.head, b.head ? b.head.getWorldQuaternion(new THREE.Quaternion()).slerp(shotQ.clone().multiply(new THREE.Quaternion().setFromAxisAngle(frame.side, -0.12 * ik)), 0.74 * ik) : shotQ);
    human.modelRoot.updateMatrixWorld(true);
  }
  const rightGrip = frame.rightHandWorld.clone();
  const rightIdleElbow = rightGrip.clone().addScaledVector(UP, 0.04 * CFG.scale + 0.14 * CFG.scale * ik).addScaledVector(frame.side, -0.2 * CFG.scale).addScaledVector(frame.forward, -0.03 * CFG.scale * idle);
  const rightElbow = frame.rightElbow.clone().lerp(rightIdleElbow, idle * 0.5);
  aimTwoBone(b.rightUpperArm, b.rightLowerArm, rightElbow, rightGrip, frame.side.clone().multiplyScalar(-1).addScaledVector(UP, 0.32).addScaledVector(frame.forward, -0.55).normalize(), 0.9 + 0.1 * ik, 1);
  const standingHandSide = frame.side.clone().multiplyScalar(-1).addScaledVector(UP, -0.55).addScaledVector(frame.forward, 0.16).normalize();
  const standingHandUp = UP.clone().multiplyScalar(-1).addScaledVector(frame.side, -0.64).addScaledVector(frame.forward, 0.2).normalize();
  setHandBasis(b.rightHand, standingHandSide, standingHandUp, ik >= 0.025 ? cueDir : standingCueDir, ik >= 0.025 ? CFG.rightHandRollShoot : CFG.rightHandRollIdle, 1);
  poseFingers(human.rightFingers, 'grip', 0.95);
  if (ik < 0.025) { poseFingers(human.leftFingers, 'idle', 1); return; }
  aimTwoBone(b.leftUpperArm, b.leftLowerArm, frame.leftElbow, frame.leftHandWorld, frame.side.clone().multiplyScalar(-1).addScaledVector(UP, 0.1).normalize(), 0.98 * ik, ik);
  setHandBasis(b.leftHand, frame.side.clone().multiplyScalar(-1).addScaledVector(frame.forward, -0.52).normalize(), UP.clone().multiplyScalar(0.78).addScaledVector(frame.forward, -0.28).addScaledVector(frame.side, -0.16).normalize(), cueDir, -0.68 * ik, ik);
  poseFingers(human.leftFingers, 'bridge', ik);
  aimTwoBone(b.leftUpperLeg, b.leftLowerLeg, frame.leftKnee, frame.leftFootWorld, frame.forward.clone().addScaledVector(UP, 0.18).normalize(), 0.9 * ik, ik);
  aimTwoBone(b.rightUpperLeg, b.rightLowerLeg, frame.rightKnee, frame.rightFootWorld, frame.forward.clone().multiplyScalar(-1).addScaledVector(UP, 0.18).normalize(), 0.9 * ik, ik);
}
function chooseHumanEdgePosition(cueBallWorld, aimForward) {
  const aimSide = new THREE.Vector3(aimForward.z, 0, -aimForward.x).normalize();
  const desired = cueBallWorld.clone()
    .addScaledVector(aimForward, -CFG.desiredShootDistance)
    .addScaledVector(aimSide, CFG.humanAimLineSideOffset);
  const xEdge = CFG.tableW / 2 + CFG.edgeMargin;
  const zEdge = CFG.tableL / 2 + CFG.edgeMargin;
  const candidates = [new THREE.Vector3(-xEdge, 0, clamp(desired.z, -zEdge, zEdge)), new THREE.Vector3(xEdge, 0, clamp(desired.z, -zEdge, zEdge)), new THREE.Vector3(clamp(desired.x, -xEdge, xEdge), 0, -zEdge), new THREE.Vector3(clamp(desired.x, -xEdge, xEdge), 0, zEdge)];
  return candidates.sort((a, b) => a.distanceToSquared(desired) - b.distanceToSquared(desired))[0].clone();
}
function constrainHumanPerimeterStep(current, target) {
  const xEdge = CFG.tableW / 2 + CFG.edgeMargin;
  const zEdge = CFG.tableL / 2 + CFG.edgeMargin;
  const project = (point) => {
    const dx = Math.abs(Math.abs(point.x) - xEdge);
    const dz = Math.abs(Math.abs(point.z) - zEdge);
    if (dx < dz) return new THREE.Vector3(Math.sign(point.x || target.x || 1) * xEdge, 0, clamp(point.z, -zEdge, zEdge));
    return new THREE.Vector3(clamp(point.x, -xEdge, xEdge), 0, Math.sign(point.z || target.z || 1) * zEdge);
  };
  const cur = current.lengthSq() > 1e-6 ? project(current) : project(target);
  const goal = project(target);
  const curOnX = Math.abs(Math.abs(cur.x) - xEdge) < Math.abs(Math.abs(cur.z) - zEdge);
  const goalOnX = Math.abs(Math.abs(goal.x) - xEdge) < Math.abs(Math.abs(goal.z) - zEdge);
  if (curOnX === goalOnX && (curOnX ? Math.sign(cur.x) === Math.sign(goal.x) : Math.sign(cur.z) === Math.sign(goal.z))) return goal;
  return curOnX
    ? new THREE.Vector3(cur.x, 0, Math.sign(goal.z || cur.z || 1) * zEdge)
    : new THREE.Vector3(Math.sign(goal.x || cur.x || 1) * xEdge, 0, cur.z);
}

function updateHumanPose(human, dt, state, rootTarget, aimForward, bridgeTarget, idleRight, idleLeft, cueBack, cueTip, power) {
  human.poseT = dampScalar(human.poseT, state === 'idle' ? 0 : 1, CFG.poseLambda, dt);
  human.breathT += dt * (state === 'idle' ? 1.05 : 0.5);
  human.settleT = dampScalar(human.settleT, state === 'dragging' ? 1 : 0, 5.5, dt);
  if (state === 'striking') {
    if (human.strikeClock === 0) { human.strikeRoot.copy(human.root.position.lengthSq() > 0.001 ? human.root.position : rootTarget); human.strikeYaw = human.yaw; }
    human.strikeClock += dt;
  } else human.strikeClock = 0;
  const rootGoal = state === 'striking' ? human.strikeRoot : constrainHumanPerimeterStep(human.root.position, rootTarget);
  dampVector(human.root.position, rootGoal, state === 'striking' ? 12 : CFG.moveLambda, dt);
  const moveAmountRaw = human.root.position.distanceTo(rootGoal);
  human.walkT += dt * (2 + Math.min(7, moveAmountRaw * 10 / CFG.scale));
  human.yaw = dampScalar(human.yaw, state === 'striking' ? human.strikeYaw : yawFromForward(aimForward), CFG.rotLambda, dt);
  const t = easeInOut(human.poseT), idle = 1 - t;
  const breath = Math.sin(human.breathT * Math.PI * 2) * ((0.006 + idle * 0.004) * CFG.scale);
  const walk = Math.sin(human.walkT * 6.2) * Math.min(1, moveAmountRaw * 12 / CFG.scale);
  const walkAmount = clamp01(moveAmountRaw * 18 / CFG.scale) * idle;
  const dragStroke = state === 'dragging' ? Math.sin(performance.now() * 0.011) * (0.25 + power * 0.75) : 0;
  const strikeFollow = state === 'striking' ? Math.sin(clamp01(human.strikeClock / (CFG.strikeTime + CFG.holdTime)) * Math.PI) : 0;
  const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(Y_AXIS, human.yaw).normalize();
  const side = new THREE.Vector3(forward.z, 0, -forward.x).normalize();
  const local = (v) => v.clone().applyAxisAngle(Y_AXIS, human.yaw).add(human.root.position);
  const powerLean = power * t;
  const rootWorld = human.root.position.clone().addScaledVector(forward, (0.018 * powerLean + 0.026 * strikeFollow) * CFG.scale);
  rootWorld.y = 0;
  const torso = local(new THREE.Vector3(0, lerp(1.3, 1.14, t) * CFG.scale + breath, (lerp(0.02, -0.16, t) - 0.014 * powerLean) * CFG.scale));
  const chest = local(new THREE.Vector3(0, lerp(1.52, 1.24, t) * CFG.scale + breath, (lerp(0.02, -0.42, t) - 0.024 * powerLean) * CFG.scale));
  const neck = local(new THREE.Vector3(0, lerp(1.68, 1.28, t) * CFG.scale + breath, (lerp(0.02, -0.61, t) - 0.028 * powerLean) * CFG.scale));
  const head = local(new THREE.Vector3(0, lerp(1.84, 1.37, t) * CFG.scale + breath - CFG.chinToCueHeight * 0.16 * t, (lerp(0.04, -0.72, t) - 0.028 * powerLean) * CFG.scale));
  const leftShoulder = local(new THREE.Vector3(-0.23 * CFG.scale, lerp(1.58, 1.36, t) * CFG.scale + breath, (lerp(0, -0.46, t) - 0.018 * human.settleT) * CFG.scale));
  const rightShoulder = local(new THREE.Vector3(0.23 * CFG.scale, lerp(1.58, 1.36, t) * CFG.scale + breath, (lerp(0, -0.34, t) - 0.018 * human.settleT) * CFG.scale));
  const leftHip = local(new THREE.Vector3(-0.13 * CFG.scale, 0.92 * CFG.scale, 0.02 * CFG.scale));
  const rightHip = local(new THREE.Vector3(0.13 * CFG.scale, 0.92 * CFG.scale, 0.02 * CFG.scale));
  const leftFoot = local(new THREE.Vector3(-0.13 * CFG.scale, CFG.footGroundY, 0.03 * CFG.scale + walk * 0.018 * CFG.scale).lerp(new THREE.Vector3(-CFG.stanceWidth * 0.42, CFG.footGroundY, -0.34 * CFG.scale), t));
  const rightFoot = local(new THREE.Vector3(0.13 * CFG.scale, CFG.footGroundY, -0.03 * CFG.scale - walk * 0.018 * CFG.scale).lerp(new THREE.Vector3(CFG.stanceWidth * 0.5, CFG.footGroundY, 0.34 * CFG.scale), t));
  const bridgePalmTarget = bridgeTarget.clone()
    .addScaledVector(forward, -0.006 * CFG.scale * t)
    .addScaledVector(side, -0.012 * CFG.scale * t)
    .setY(CFG.tableTopY + CFG.bridgePalmTableLift)
    .addScaledVector(UP, -CFG.bridgePalmUnderCueDrop * t)
    .addScaledVector(UP, -0.01 * CFG.scale * human.settleT);
  const leftHand = idleLeft.clone().lerp(bridgePalmTarget, t);
  const cueDirForHand = cueTip.clone().sub(cueBack).normalize();
  const handIk = easeInOut(clamp01(t));
  const idleGripSide = side.clone().multiplyScalar(-1).addScaledVector(UP, -0.55).addScaledVector(forward, 0.16).normalize();
  const idleGripUp = UP.clone().multiplyScalar(-1).addScaledVector(side, -0.64).addScaledVector(forward, 0.2).normalize();
  const liveGripSide = side.clone().multiplyScalar(-1).addScaledVector(UP, lerp(-0.55, -0.62, handIk)).addScaledVector(side, 0.5 * handIk).addScaledVector(forward, lerp(0.16, -0.08, handIk)).normalize();
  const liveGripUp = UP.clone().multiplyScalar(lerp(-1, 0.12, handIk)).addScaledVector(side, lerp(-0.64, -0.04, handIk)).addScaledVector(forward, lerp(0.2, -0.48, handIk)).normalize();
  const lockedRightElbow = rightShoulder.clone().addScaledVector(UP, lerp(0.04 * CFG.scale, CFG.rightElbowShotRise, t)).addScaledVector(side, lerp(-0.18 * CFG.scale, CFG.rightElbowShotSide, t)).addScaledVector(forward, lerp(-0.04 * CFG.scale, CFG.rightElbowShotBack, t));
  const forearmStroke = (state === 'dragging' ? -CFG.rightStrokePull * easeOutCubic(power) : 0) + (state === 'striking' ? CFG.rightStrokePush * strikeFollow : 0) + (state === 'dragging' ? dragStroke * 0.035 * CFG.scale : 0);
  const forearmBase = lockedRightElbow.clone().addScaledVector(side, CFG.rightForearmOutward * t).addScaledVector(UP, -CFG.rightForearmDown * t).addScaledVector(UP, CFG.rightHandShotLift * t).addScaledVector(forward, -CFG.rightForearmBack * t).addScaledVector(cueDirForHand, CFG.rightForearmLength);
  const liveCueGripPoint = forearmBase.clone().addScaledVector(cueDirForHand, forearmStroke);
  const idleWristTarget = idleRight.clone().sub(cueSocketOffsetWorld(idleGripSide, idleGripUp, cueDirForHand, CFG.rightHandRollIdle));
  const liveWristTarget = liveCueGripPoint.clone().sub(cueSocketOffsetWorld(liveGripSide, liveGripUp, cueDirForHand, lerp(CFG.rightHandRollIdle, CFG.rightHandRollShoot - CFG.rightHandDownPose, handIk)));
  const rightHand = idleWristTarget.clone().lerp(liveWristTarget, t);
  const leftElbow = leftShoulder.clone().lerp(leftHand, 0.62).addScaledVector(UP, 0.006 * CFG.scale * t).addScaledVector(side, -0.044 * CFG.scale * t).addScaledVector(forward, 0.065 * CFG.scale * t);
  const leftKnee = leftHip.clone().lerp(leftFoot, 0.53).addScaledVector(UP, lerp(0.2 * CFG.scale, CFG.kneeBendShot, t)).addScaledVector(forward, 0.04 * CFG.scale * t).addScaledVector(side, -0.012 * CFG.scale * t);
  const rightKnee = rightHip.clone().lerp(rightFoot, 0.52).addScaledVector(UP, lerp(0.2 * CFG.scale, CFG.kneeBendShot * 0.88, t)).addScaledVector(forward, -0.03 * CFG.scale * t).addScaledVector(side, 0.014 * CFG.scale * t);
  driveHuman(human, { t, stroke: forearmStroke / CFG.scale, follow: strikeFollow, walkAmount, forward, side, up: UP, rootWorld, torsoCenterWorld: torso, chestCenterWorld: chest, neckWorld: neck, headCenterWorld: head, leftElbow, rightElbow: lockedRightElbow, leftHandWorld: leftHand, rightHandWorld: rightHand, leftKnee, rightKnee, leftFootWorld: leftFoot, rightFootWorld: rightFoot, cueBackWorld: cueBack, cueTipWorld: cueTip });
}
function applyCueShot(cueBall, power, yaw, out, spinInput = { x: 0, y: 0 }) {
  const p = clamp01(power);
  const dir = out.set(0, 0, -1).applyAxisAngle(Y_AXIS, yaw).normalize();
  const spinMappedRaw = mapSpinForPhysics(normalizeSpinInput(spinInput));
  const spinMapped = {
    x: (spinMappedRaw.x ?? 0) * SNOOKER_SPIN_GLOBAL_SCALE,
    y: (spinMappedRaw.y ?? 0) * SNOOKER_SPIN_GLOBAL_SCALE
  };
  const powerSpinScale = 0.55 + p * 0.45;
  const rawTopSpin = Math.max(0, spinMapped.y ?? 0) * SNOOKER_SHOT_SPIN_SCALE * powerSpinScale;
  const spin = {
    x: 0,
    y: rawTopSpin * SNOOKER_TOPSPIN_MULTIPLIER
  };
  const powerScale = SNOOKER_SHOT_MIN_FACTOR + SNOOKER_SHOT_POWER_RANGE * p;
  const speed = SNOOKER_SHOT_FULL_SPEED * powerScale;
  cueBall.vel.copy(dir.multiplyScalar(speed));
  // Side/draw spin is disabled for Snooker Champion; shots keep only natural forward roll.
  cueBall.spin.set(spin.x ?? 0, spin.y ?? 0);
  cueBall.omega?.set(0, 0, 0);
  const launchSpeed = cueBall.vel.length();
  if (launchSpeed > 1e-6 && cueBall.omega) {
    const rollingAxis = new THREE.Vector3(cueBall.vel.z, 0, -cueBall.vel.x).normalize();
    cueBall.omega.addScaledVector(rollingAxis, (launchSpeed / CFG.ballR) * SNOOKER_CUE_CENTER_ROLL_OMEGA_FACTOR);
    cueBall.omega.x += -(spin.y ?? 0) * p * SNOOKER_CUE_SPIN_OMEGA_MULTIPLIER;
    cueBall.omega.z += -(spin.x ?? 0) * p * SNOOKER_CUE_SPIN_OMEGA_MULTIPLIER;
  }
  cueBall.launchDir = cueBall.vel.lengthSq() > 1e-8 ? cueBall.vel.clone().normalize() : null;
  cueBall.impacted = false;
  cueBall.lastShotSpin = { x: spin.x ?? 0, y: spin.y ?? 0 };
}
function getSnookerRedsRemaining(balls) {
  return balls.filter((item) => item.kind === 'red' && !item.potted).length;
}
function getSnookerFinalColourTargetKind(balls) {
  return SNOOKER_COLOR_ORDER.find((kind) => balls.some((item) => item.kind === kind && !item.potted)) ?? null;
}
function getSnookerTargetValue(targetKind) {
  if (targetKind === 'colour') return SNOOKER_BALL_VALUES.black;
  return SNOOKER_BALL_VALUES[targetKind] ?? SNOOKER_BALL_VALUES.red;
}
function formatSnookerTarget(targetKind) {
  if (targetKind === 'red') return 'Red';
  if (targetKind === 'colour') return 'Colour';
  if (!targetKind) return 'Frame complete';
  return SNOOKER_COLOR_LABELS[targetKind] ?? targetKind;
}
function createSnookerRulesState() {
  return {
    scores: [0, 0],
    score: 0,
    activePlayer: 0,
    targetKind: 'red',
    target: 'Red',
    foul: '',
    shotActive: false,
    shotPotCount: 0,
    shotFoul: ''
  };
}
function beginSnookerShotRules(rulesState) {
  if (!rulesState) return;
  rulesState.shotActive = true;
  rulesState.startingTargetKind = rulesState.targetKind || 'red';
  rulesState.firstContactKind = null;
  rulesState.firstContactValue = 0;
  rulesState.pottedBalls = [];
  rulesState.shotPotCount = 0;
  rulesState.shotFoul = '';
  rulesState.foulReasons = [];
  rulesState.foulValue = 0;
  rulesState.railAfterContact = false;
  rulesState.foul = '';
}
function registerSnookerFoul(rulesState, reason, value = 4) {
  if (!rulesState) return;
  const foulValue = Math.max(4, value || 0, rulesState.foulValue || 0);
  rulesState.foulValue = foulValue;
  if (reason && !rulesState.foulReasons?.includes(reason)) {
    rulesState.foulReasons = [...(rulesState.foulReasons ?? []), reason];
  }
  rulesState.shotFoul = `${reason || 'Foul'} (${foulValue})`;
}
function isSnookerBallOn(kind, targetKind) {
  if (targetKind === 'red') return kind === 'red';
  if (targetKind === 'colour') return kind !== 'red' && kind !== 'cue';
  return kind === targetKind;
}
function recordSnookerFirstContact(ball, rulesState) {
  if (!rulesState?.shotActive || rulesState.firstContactKind || !ball || ball.isCue) return;
  rulesState.firstContactKind = ball.kind;
  rulesState.firstContactValue = ball.value ?? 0;
}
function respotColorBall(ball, balls) {
  if (!ball?.spot) return;
  const occupied = (spot) => balls.some((other) => !other.potted && other !== ball && other.pos.distanceToSquared(spot) < (CFG.ballR * 2.2) ** 2);
  const candidate = ball.spot.clone();
  if (occupied(candidate)) {
    let found = false;
    for (let ring = 1; ring <= 7 && !found; ring += 1) {
      for (let i = 0; i < 16; i += 1) {
        const a = (i / 16) * Math.PI * 2;
        candidate.copy(ball.spot).add(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(CFG.ballR * 2.25 * ring));
        if (!occupied(candidate)) { found = true; break; }
      }
    }
  }
  ball.pos.copy(candidate);
  ball.vel.set(0, 0, 0);
  ball.spin.set(0, 0);
  ball.omega?.set(0, 0, 0);
  ball.potted = false;
  ball.mesh.visible = true;
  ball.mesh.position.copy(ball.pos).setY(ball.pos.y + CFG.ballR * BALL_VISUAL_LIFT);
}
function recordSnookerPot(ball, rulesState) {
  if (!rulesState || ball.isCue) return;
  rulesState.shotPotCount = (rulesState.shotPotCount ?? 0) + 1;
  rulesState.pottedBalls = [...(rulesState.pottedBalls ?? []), ball];
  if (!isSnookerBallOn(ball.kind, rulesState.startingTargetKind || rulesState.targetKind)) {
    registerSnookerFoul(rulesState, `${SNOOKER_COLOR_LABELS[ball.kind] ?? ball.kind} potted when ${formatSnookerTarget(rulesState.startingTargetKind || rulesState.targetKind)} was on`, ball.value ?? 4);
  }
}
function finalizeSnookerShotRules(balls, rulesState) {
  if (!rulesState?.shotActive) return false;
  const targetKind = rulesState.startingTargetKind || rulesState.targetKind || 'red';
  const pottedBalls = rulesState.pottedBalls ?? [];
  const pottedColours = pottedBalls.filter((ball) => ball.kind !== 'red');
  const pottedReds = pottedBalls.filter((ball) => ball.kind === 'red');
  if (!rulesState.firstContactKind) {
    registerSnookerFoul(rulesState, `No ball contacted; ${formatSnookerTarget(targetKind)} was on`, getSnookerTargetValue(targetKind));
  } else if (!isSnookerBallOn(rulesState.firstContactKind, targetKind)) {
    registerSnookerFoul(
      rulesState,
      `Wrong first contact: ${formatSnookerTarget(rulesState.firstContactKind)} hit before ${formatSnookerTarget(targetKind)}`,
      Math.max(rulesState.firstContactValue ?? 0, getSnookerTargetValue(targetKind))
    );
  }
  if (targetKind === 'red' && pottedColours.length) {
    registerSnookerFoul(rulesState, 'Colour potted while reds were on', Math.max(...pottedColours.map((ball) => ball.value ?? 4), 4));
  } else if (targetKind === 'colour') {
    if (pottedReds.length) registerSnookerFoul(rulesState, 'Red potted while a colour was on', 4);
    if (pottedColours.length > 1) registerSnookerFoul(rulesState, 'More than one colour potted on a colour turn', Math.max(...pottedColours.map((ball) => ball.value ?? 4), 4));
  } else if (targetKind && targetKind !== 'red') {
    const wrongPots = pottedBalls.filter((ball) => ball.kind !== targetKind);
    if (wrongPots.length || pottedBalls.length > 1) {
      registerSnookerFoul(rulesState, `${formatSnookerTarget(targetKind)} was the only ball on`, Math.max(...pottedBalls.map((ball) => ball.value ?? 4), getSnookerTargetValue(targetKind)));
    }
  }
  const isFoul = Boolean(rulesState.foulValue);
  const active = rulesState.activePlayer ?? 0;
  const opponent = active === 0 ? 1 : 0;
  if (isFoul) {
    rulesState.scores[opponent] = (rulesState.scores[opponent] ?? 0) + Math.max(4, rulesState.foulValue || 4);
    rulesState.activePlayer = opponent;
    rulesState.foul = `${rulesState.foulReasons?.[0] || 'Foul'} — ${Math.max(4, rulesState.foulValue || 4)} points`;
    pottedColours.forEach((ball) => respotColorBall(ball, balls));
  } else {
    const shotPoints = pottedBalls.reduce((sum, ball) => sum + (ball.value ?? 0), 0);
    rulesState.scores[active] = (rulesState.scores[active] ?? 0) + shotPoints;
    rulesState.foul = '';
    if (!pottedBalls.length) rulesState.activePlayer = opponent;
    if (targetKind === 'colour' && pottedColours.length && getSnookerRedsRemaining(balls) > 0) {
      pottedColours.forEach((ball) => respotColorBall(ball, balls));
    }
  }
  const redsRemaining = getSnookerRedsRemaining(balls);
  if (redsRemaining > 0) {
    const legalPot = !isFoul && pottedBalls.length > 0;
    rulesState.targetKind = legalPot && targetKind === 'red' ? 'colour' : 'red';
  } else {
    rulesState.targetKind = getSnookerFinalColourTargetKind(balls);
  }
  rulesState.target = formatSnookerTarget(rulesState.targetKind);
  rulesState.score = rulesState.scores[0] ?? 0;
  rulesState.shotActive = false;
  rulesState.shotPotCount = pottedBalls.length;
  rulesState.shotFoul = isFoul ? rulesState.foul : '';
  return true;
}

function findSnookerPocketCapture(ball, pocketPositions = []) {
  return pocketPositions.find((pocket) => {
    const radius = pocket.userData?.radius ?? SNOOKER_OFFICIAL_CORNER_POCKET_RADIUS;
    const captureRadius = Math.max(radius + CFG.ballR * 0.28, CFG.ballR * 1.08);
    return ball.pos.distanceToSquared(pocket) < captureRadius * captureRadius;
  });
}

function isInSnookerPocketMouth(ball, axis, sign, pocketPositions = []) {
  const nearPocket = pocketPositions.some((pocket) => {
    const radius = pocket.userData?.radius ?? SNOOKER_OFFICIAL_CORNER_POCKET_RADIUS;
    const mouth = Math.max(radius + CFG.ballR * 0.52, CFG.ballR * 1.24);
    if (axis === 'x') {
      return Math.sign(pocket.x || sign) === sign && Math.abs(ball.pos.z - pocket.z) <= mouth;
    }
    return Math.sign(pocket.z || sign) === sign && Math.abs(ball.pos.x - pocket.x) <= mouth;
  });
  return nearPocket;
}

function isInsideSnookerPocketThroat(ball, axis, sign, pocketPositions = []) {
  // Keep the rail open only at the real GLB pocket throat/capture circle. Near-mouth misses
  // now collide with the cushion/jaw instead of sliding outside the physical table perimeter.
  if (!isInSnookerPocketMouth(ball, axis, sign, pocketPositions)) return false;
  return Boolean(findSnookerPocketCapture(ball, pocketPositions));
}

function getSnookerCushionCenterLimit(axis) {
  const half = axis === 'x' ? CFG.tableW / 2 : CFG.tableL / 2;
  return half - CFG.ballR - SNOOKER_CUSHION_NOSE_CONTACT_INSET - SNOOKER_CUSHION_COLLISION_SAFETY_INSET;
}

function clampSnookerAimImpactToPerimeter(point) {
  const railX = getSnookerCushionCenterLimit('x');
  const railZ = getSnookerCushionCenterLimit('z');
  return new THREE.Vector2(
    clamp(point.x, -railX, railX),
    clamp(point.y, -railZ, railZ)
  );
}

function snookerGuideEndFrom(start, dir, distance, y) {
  const bounded = clampSnookerAimImpactToPerimeter(new THREE.Vector2(
    start.x + dir.x * distance,
    start.z + dir.z * distance
  ));
  return new THREE.Vector3(bounded.x, y, bounded.y);
}

function decaySnookerSpin(ball, stepScale) {
  if (!ball?.spin || ball.spin.lengthSq() < 1e-6) return false;
  ball.spin.multiplyScalar(Math.exp(-2.0 * Math.max(stepScale, 0)));
  if (ball.spin.lengthSq() < 1e-6) ball.spin.set(0, 0);
  return true;
}

function applySnookerSpinController(ball, stepScale) {
  if (!ball?.spin || ball.spin.lengthSq() < 1e-6) return false;
  if (ball.isCue && !ball.impacted) {
    return decaySnookerSpin(ball, stepScale);
  }
  const speed = Math.max(ball.vel.length(), 0);
  if (speed > 1e-6) {
    const forward = SNOOKER_TMP_VEC3_A.copy(ball.vel).setY(0).normalize();
    let forwardSpin = ball.spin.y || 0;
    const speedScale = clamp(speed / Math.max(CFG.scale * 8, 1e-6), 0.35, 1.25);
    let rollAccel = 0.11 * CFG.scale * speedScale * stepScale;
    if (forwardSpin < 0 && ball.isCue && ball.impacted) rollAccel *= 3.4;
    if (Math.abs(forwardSpin) > 1e-8) {
      ball.vel.addScaledVector(forward, forwardSpin * rollAccel);
      if (forwardSpin > 0) {
        const naturalRollSpeed = Math.max(CFG.ballR * 2.2, speed * 0.84);
        const settling = clamp(speed / Math.max(naturalRollSpeed, 1e-6), 0, 1);
        const transfer = Math.min(forwardSpin, rollAccel * 0.62 * (0.28 + settling * 0.72));
        let remainingSpin = Math.max(0, forwardSpin - transfer);
        if (speed >= naturalRollSpeed * 0.98) {
          remainingSpin *= Math.exp(-0.84 * stepScale * 1.25);
        }
        ball.spin.y = remainingSpin * Math.exp(-0.84 * stepScale * (0.35 + 0.65 * settling));
      }
    }
  }
  return decaySnookerSpin(ball, stepScale);
}

function applySnookerRailImpulse(ball, normal) {
  if (!ball?.omega || !normal) return;
  const n = SNOOKER_TMP_VEC3_A.copy(normal).setY(0);
  if (n.lengthSq() < 1e-8) return;
  n.normalize();
  const radius = SNOOKER_TMP_VEC3_B.copy(n).multiplyScalar(CFG.ballR);
  const linear = SNOOKER_TMP_VEC3_C.set(ball.vel.x, 0, ball.vel.z);
  const contactVel = SNOOKER_TMP_VEC3_D.copy(ball.omega).cross(radius).add(linear);
  const relNormal = contactVel.dot(n);
  if (relNormal >= 0) return;
  const normalImpulseMag = -(1 + CFG.restitution) * relNormal * SNOOKER_BALL_MASS;
  const normalImpulse = SNOOKER_TMP_VEC3_E.copy(n).multiplyScalar(normalImpulseMag);
  linear.addScaledVector(normalImpulse, 1 / SNOOKER_BALL_MASS);
  ball.omega.addScaledVector(SNOOKER_TMP_VEC3_D.copy(radius).cross(normalImpulse), 1 / SNOOKER_BALL_INERTIA);
  const postContactVel = SNOOKER_TMP_VEC3_D.copy(ball.omega).cross(radius).add(linear);
  const tangentVel = postContactVel.addScaledVector(n, -postContactVel.dot(n));
  const tangentSpeed = tangentVel.length();
  if (tangentSpeed > 1e-8) {
    tangentVel.multiplyScalar(1 / tangentSpeed);
    const rCrossT = SNOOKER_TMP_VEC3_E.copy(radius).cross(tangentVel).lengthSq();
    const denom = 1 / SNOOKER_BALL_MASS + rCrossT / SNOOKER_BALL_INERTIA;
    const jt = -tangentSpeed / Math.max(denom, 1e-6);
    const maxFriction = SNOOKER_RAIL_FRICTION * Math.abs(normalImpulseMag);
    const tangentImpulse = tangentVel.multiplyScalar(clamp(jt, -maxFriction, maxFriction));
    linear.addScaledVector(tangentImpulse, 1 / SNOOKER_BALL_MASS);
    ball.omega.addScaledVector(SNOOKER_TMP_VEC3_D.copy(radius).cross(tangentImpulse), 1 / SNOOKER_BALL_INERTIA);
  }
  ball.vel.set(linear.x, 0, linear.z);
}

function updateSnookerRollingBall(ball, stepScale) {
  applySnookerSpinController(ball, stepScale);
  const dt = SNOOKER_SPIN_FIXED_DT * stepScale;
  if (ball.omega) {
    const linear = SNOOKER_TMP_VEC3_A.set(ball.vel.x, 0, ball.vel.z);
    const radius = SNOOKER_TMP_VEC3_B.set(0, -CFG.ballR, 0);
    const angular = SNOOKER_TMP_VEC3_C.copy(ball.omega);
    const slip = SNOOKER_TMP_VEC3_D.copy(angular).cross(radius).add(linear);
    const slipSpeed = slip.length();
    if (slipSpeed > SNOOKER_SPIN_SLIDE_EPS) {
      const friction = SNOOKER_TMP_VEC3_E.copy(slip).multiplyScalar((-SNOOKER_SPIN_KINETIC_FRICTION * SNOOKER_BALL_MASS * SNOOKER_SPIN_GRAVITY) / slipSpeed);
      linear.addScaledVector(friction, dt / SNOOKER_BALL_MASS);
      angular.addScaledVector(SNOOKER_TMP_VEC3_D.copy(radius).cross(friction), dt / SNOOKER_BALL_INERTIA);
    } else {
      linear.multiplyScalar(Math.max(0, 1 - SNOOKER_SPIN_ROLL_DAMPING * dt));
      angular.multiplyScalar(Math.max(0, 1 - SNOOKER_SPIN_ANGULAR_DAMPING * dt));
    }
    ball.vel.set(linear.x, 0, linear.z);
    ball.omega.copy(angular);
  }
  const rollingSpeed = ball.vel.length();
  if (rollingSpeed > 1e-6) {
    const nextSpeed = Math.max(0, rollingSpeed - SNOOKER_ROLLING_RESISTANCE * SNOOKER_SPIN_GRAVITY * dt);
    if (nextSpeed < rollingSpeed) ball.vel.multiplyScalar(nextSpeed / rollingSpeed);
  }
}

function updateBalls(balls, dt, tmpA, tmpB, pocketPositions = [], rulesState = null, sounds = {}) {
  const railX = getSnookerCushionCenterLimit('x');
  const railZ = getSnookerCushionCenterLimit('z');
  const subSteps = Math.max(1, Math.ceil(Math.max(dt, 0) / SNOOKER_PHYSICS_MAX_STEP));
  const subDt = dt / subSteps;
  for (let subStep = 0; subStep < subSteps; subStep += 1) {
    const stepScale = Math.max(subDt / (1 / 60), 1e-6);
    for (const ball of balls) {
    if (ball.potted) continue;
    updateSnookerRollingBall(ball, stepScale);
    ball.pos.addScaledVector(ball.vel, subDt);
    let railNormal = null;
    const pocket = findSnookerPocketCapture(ball, pocketPositions);
    if (!pocket) {
      if (ball.pos.x < -railX && !isInsideSnookerPocketThroat(ball, 'x', -1, pocketPositions)) {
        ball.pos.x = -railX;
        if (ball.vel.x < 0) railNormal = new THREE.Vector3(1, 0, 0);
      } else if (ball.pos.x > railX && !isInsideSnookerPocketThroat(ball, 'x', 1, pocketPositions)) {
        ball.pos.x = railX;
        if (ball.vel.x > 0) railNormal = new THREE.Vector3(-1, 0, 0);
      }
      if (ball.pos.z < -railZ && !isInsideSnookerPocketThroat(ball, 'z', -1, pocketPositions)) {
        ball.pos.z = -railZ;
        if (ball.vel.z < 0) railNormal = new THREE.Vector3(0, 0, 1);
      } else if (ball.pos.z > railZ && !isInsideSnookerPocketThroat(ball, 'z', 1, pocketPositions)) {
        ball.pos.z = railZ;
        if (ball.vel.z > 0) railNormal = new THREE.Vector3(0, 0, -1);
      }
    }
    if (railNormal) {
      if (rulesState?.shotActive && rulesState.firstContactKind) rulesState.railAfterContact = true;
      applySnookerRailImpulse(ball, railNormal);
      if (ball.spin) ball.spin.x *= -0.65;
    }
    let speed = ball.vel.length();
    let scaledSpeed = speed * stepScale;
    if (scaledSpeed < SNOOKER_STOP_EPS) {
      ball.vel.multiplyScalar(Math.pow(SNOOKER_STOP_SOFTENING, stepScale));
      speed = ball.vel.length();
      scaledSpeed = speed * stepScale;
    }
    if (scaledSpeed < SNOOKER_STOP_FINAL_EPS) {
      ball.vel.set(0, 0, 0);
      ball.omega?.set(0, 0, 0);
      ball.spin?.set(0, 0);
      ball.launchDir = null;
    }
    const capture = pocket ?? findSnookerPocketCapture(ball, pocketPositions);
    if (capture) {
      sounds.playPocket?.(clamp(ball.vel.length() / Math.max(CFG.scale * 5, 1e-6), 0, 1));
      if (ball.isCue) {
        ball.pos.copy(getOfficialSnookerSpots(SNOOKER_BALL_CENTER_Y).cue);
        ball.vel.set(0, 0, 0);
        ball.spin?.set(0, 0);
        ball.omega?.set(0, 0, 0);
        ball.launchDir = null;
        if (rulesState) {
          rulesState.foul = 'Cue ball in-off: foul, ball in hand inside the D.';
          rulesState.shotFoul = rulesState.foul;
          registerSnookerFoul(rulesState, 'Cue ball in-off: ball in hand inside the D', 4);
        }
      } else {
        ball.potted = true;
        ball.vel.set(0, 0, 0);
        ball.spin?.set(0, 0);
        ball.omega?.set(0, 0, 0);
        ball.mesh.visible = false;
        recordSnookerPot(ball, rulesState);
      }
    }
  }
  for (let i = 0; i < balls.length; i += 1) for (let j = i + 1; j < balls.length; j += 1) {
    const a = balls[i], b = balls[j];
    if (a.potted || b.potted) continue;
    const delta = tmpA.copy(b.pos).sub(a.pos);
    const dist = delta.length();
    const minDist = CFG.ballR * 2;
    if (dist > 0 && dist < minDist) {
      const n = delta.multiplyScalar(1 / dist);
      const overlap = minDist - dist;
      a.pos.addScaledVector(n, -overlap * 0.5);
      b.pos.addScaledVector(n, overlap * 0.5);
      const normal = SNOOKER_TMP_VEC3_A.copy(n).setY(0).normalize();
      const ra = SNOOKER_TMP_VEC3_B.copy(normal).multiplyScalar(CFG.ballR);
      const rb = SNOOKER_TMP_VEC3_C.copy(normal).multiplyScalar(-CFG.ballR);
      const va = SNOOKER_TMP_VEC3_D.set(a.vel.x, 0, a.vel.z);
      const vb = SNOOKER_TMP_VEC3_E.set(b.vel.x, 0, b.vel.z);
      const omegaA = a.omega ?? new THREE.Vector3();
      const omegaB = b.omega ?? new THREE.Vector3();
      const contactA = omegaA.clone().cross(ra).add(va);
      const contactB = omegaB.clone().cross(rb).add(vb);
      const relative = contactB.sub(contactA);
      const relNormal = relative.dot(normal);
      if (relNormal < 0) {
        const impactSpeed = Math.abs(relNormal);
        const normalImpulseMag = (-(1 + CFG.restitution) * relNormal * SNOOKER_BALL_MASS) / 2;
        const impulse = normal.clone().multiplyScalar(normalImpulseMag);
        va.addScaledVector(impulse, -1 / SNOOKER_BALL_MASS);
        vb.addScaledVector(impulse, 1 / SNOOKER_BALL_MASS);
        const tangentVel = relative.addScaledVector(normal, -relNormal);
        const tangentSpeed = tangentVel.length();
        if (tangentSpeed > 1e-8) {
          tangentVel.multiplyScalar(1 / tangentSpeed);
          const raCrossT = ra.clone().cross(tangentVel).lengthSq();
          const rbCrossT = rb.clone().cross(tangentVel).lengthSq();
          const denom = 2 / SNOOKER_BALL_MASS + (raCrossT + rbCrossT) / SNOOKER_BALL_INERTIA;
          const jt = -tangentSpeed / Math.max(denom, 1e-6);
          const tangentImpulse = tangentVel.multiplyScalar(clamp(jt, -SNOOKER_BALL_BALL_FRICTION * Math.abs(normalImpulseMag), SNOOKER_BALL_BALL_FRICTION * Math.abs(normalImpulseMag)));
          va.addScaledVector(tangentImpulse, -1 / SNOOKER_BALL_MASS);
          vb.addScaledVector(tangentImpulse, 1 / SNOOKER_BALL_MASS);
          a.omega?.addScaledVector(ra.clone().cross(tangentImpulse), -1 / SNOOKER_BALL_INERTIA);
          b.omega?.addScaledVector(rb.clone().cross(tangentImpulse), 1 / SNOOKER_BALL_INERTIA);
        }
        a.vel.set(va.x, 0, va.z);
        b.vel.set(vb.x, 0, vb.z);
        sounds.playBallHit?.(clamp(impactSpeed / Math.max(CFG.scale * 4, 1e-6), 0, 1));
        if (a.isCue || b.isCue) {
          const objectBall = a.isCue ? b : a;
          recordSnookerFirstContact(objectBall, rulesState);
          a.impacted = a.impacted || a.isCue;
          b.impacted = b.impacted || b.isCue;
        }
      }
    }
  }
    for (const ball of balls) {
      if (ball.potted) continue;
      ball.mesh.position.copy(ball.pos).setY(ball.pos.y + CFG.ballR * BALL_VISUAL_LIFT);
      const travelDistance = ball.vel.length() * subDt;
      if (travelDistance > 0) {
        const axis = SNOOKER_TMP_VEC3_A.set(ball.vel.z, 0, -ball.vel.x).normalize();
        ball.mesh.rotateOnWorldAxis(axis, travelDistance / CFG.ballR);
      }
    }
  }
}

function calcSnookerAimTarget(cueBall, aimDir, balls, pocketPositions = []) {
  const cuePos = new THREE.Vector2(cueBall.pos.x, cueBall.pos.z);
  const dir = new THREE.Vector2(aimDir.x, aimDir.z);
  if (dir.lengthSq() < 1e-8) dir.set(0, -1);
  dir.normalize();
  let tHit = Infinity;
  let targetBall = null;
  let railNormal = null;
  const checkRail = (t, normal) => {
    if (t >= 0 && t < tHit) {
      tHit = t;
      railNormal = normal;
      targetBall = null;
    }
  };
  const railX = CFG.tableW / 2 - CFG.ballR;
  const railZ = CFG.tableL / 2 - CFG.ballR;
  const mouthClear = (axis, sign, impact) => {
    const probe = { pos: new THREE.Vector3(impact.x, CFG.ballR, impact.y) };
    return isInsideSnookerPocketThroat(probe, axis, sign, pocketPositions);
  };
  if (dir.x < -1e-8) {
    const t = (-railX - cuePos.x) / dir.x;
    const impact = cuePos.clone().add(dir.clone().multiplyScalar(t));
    if (!mouthClear('x', -1, impact)) checkRail(t, new THREE.Vector2(1, 0));
  }
  if (dir.x > 1e-8) {
    const t = (railX - cuePos.x) / dir.x;
    const impact = cuePos.clone().add(dir.clone().multiplyScalar(t));
    if (!mouthClear('x', 1, impact)) checkRail(t, new THREE.Vector2(-1, 0));
  }
  if (dir.y < -1e-8) {
    const t = (-railZ - cuePos.y) / dir.y;
    const impact = cuePos.clone().add(dir.clone().multiplyScalar(t));
    if (!mouthClear('z', -1, impact)) checkRail(t, new THREE.Vector2(0, 1));
  }
  if (dir.y > 1e-8) {
    const t = (railZ - cuePos.y) / dir.y;
    const impact = cuePos.clone().add(dir.clone().multiplyScalar(t));
    if (!mouthClear('z', 1, impact)) checkRail(t, new THREE.Vector2(0, -1));
  }
  const contactRadius = CFG.ballR * 2;
  const contactRadius2 = contactRadius * contactRadius;
  balls.forEach((ball) => {
    if (!ball || ball === cueBall || ball.potted) return;
    const v = new THREE.Vector2(ball.pos.x - cuePos.x, ball.pos.z - cuePos.y);
    const proj = v.dot(dir);
    if (proj <= 0) return;
    const perp2 = v.lengthSq() - proj * proj;
    if (perp2 > contactRadius2) return;
    const t = proj - Math.sqrt(contactRadius2 - perp2);
    if (t >= 0 && t < tHit) {
      tHit = t;
      targetBall = ball;
      railNormal = null;
    }
  });
  const fallbackDistance = Math.sqrt(CFG.tableW * CFG.tableW + CFG.tableL * CFG.tableL);
  const travel = Number.isFinite(tHit) ? Math.max(tHit, CFG.ballR) : fallbackDistance;
  const impact = cuePos.clone().add(dir.clone().multiplyScalar(travel));
  let targetDir = null;
  let cueDir = null;
  if (targetBall) {
    targetDir = new THREE.Vector2(targetBall.pos.x - impact.x, targetBall.pos.z - impact.y);
    if (targetDir.lengthSq() > 1e-8) targetDir.normalize();
    else targetDir.copy(dir);
    const projected = dir.dot(targetDir);
    cueDir = dir.clone().sub(targetDir.clone().multiplyScalar(projected));
    if (cueDir.lengthSq() > 1e-8) cueDir.normalize();
    else cueDir = null;
  } else if (railNormal) {
    cueDir = dir.clone().sub(railNormal.clone().multiplyScalar(2 * dir.dot(railNormal))).normalize();
  }
  return { impact, targetDir, cueDir, targetBall, railNormal };
}
function setGuideLine(line, a, b, visible = true) {
  setLinePoints(line, a, b);
  line.visible = visible;
}
function createGuideLine(color, opacity = 0.72) {
  const line = createLine(color, opacity);
  line.material.depthTest = false;
  line.material.depthWrite = false;
  line.material.linewidth = SNOOKER_AIM_LINE_WIDTH;
  line.renderOrder = 30;
  line.frustumCulled = false;
  line.visible = false;
  return line;
}
function createReplaySnapshot(balls) {
  return balls.map((ball) => ({
    p: ball.pos.clone(),
    v: ball.mesh.visible,
    potted: Boolean(ball.potted)
  }));
}
function applyReplaySnapshot(balls, snapshot) {
  snapshot?.forEach((item, index) => {
    const ball = balls[index];
    if (!ball || !item?.p) return;
    ball.pos.copy(item.p);
    ball.mesh.visible = item.v && !item.potted;
    ball.mesh.position.copy(ball.pos).setY(ball.pos.y + CFG.ballR * BALL_VISUAL_LIFT);
  });
}

function computeSnookerTopViewDistance(aspect = 1, fov = POOL_ROYALE_STANDING_VIEW_FOV, margin = 1.18) {
  const verticalFov = THREE.MathUtils.degToRad(fov || POOL_ROYALE_STANDING_VIEW_FOV);
  const halfVertical = Math.max(verticalFov / 2, 1e-3);
  const halfHorizontal = Math.max(Math.atan(Math.tan(halfVertical) * Math.max(aspect, 0.45)), 1e-3);
  const halfWidth = (CFG.tableW * CFG.tableVisualMultiplier * margin) / 2;
  const halfLength = (CFG.tableL * CFG.tableVisualMultiplier * margin) / 2;
  return Math.max(halfWidth / Math.tan(halfHorizontal), halfLength / Math.tan(halfVertical));
}
function snookerPocketToWorld(pocket) {
  return (pocket ?? new THREE.Vector3(0, CFG.ballR, -CFG.tableL / 2)).clone().add(new THREE.Vector3(0, CFG.tableTopY, 0));
}

function resolveSnookerCueCameraPose(cueBallWorld, aimForward, activePower, aspect = 1, heightOffset = 0) {
  const portraitT = clamp01((1 / Math.max(aspect, 0.45) - 1) / 0.78);
  const clampedPower = clamp01(activePower);
  const target = cueBallWorld.clone()
    .addScaledVector(aimForward, CFG.tableL * 0.14)
    .setY(CFG.tableTopY + CFG.ballR * 1.05);
  const playerRadiusBase = Math.max(CFG.tableW, CFG.tableL);
  const standingRadius = computeSnookerTopViewDistance(aspect, POOL_ROYALE_STANDING_VIEW_FOV, POOL_ROYALE_STANDING_VIEW_MARGIN);
  const cueRadius = Math.max(
    playerRadiusBase * SNOOKER_CUE_VIEW_RADIUS_RATIO,
    CFG.tableL * (0.48 + clampedPower * 0.12),
    SNOOKER_CUE_CAMERA_MIN_RADIUS
  ) * SNOOKER_CUE_CAMERA_DISTANCE_MULTIPLIER;
  const radius = clamp(lerp(standingRadius, cueRadius, 0.22 + clampedPower * 0.52), SNOOKER_CUE_CAMERA_MIN_RADIUS, SNOOKER_CUE_CAMERA_MAX_RADIUS);
  const heightLift = THREE.MathUtils.clamp(heightOffset, SNOOKER_CAMERA_HEIGHT_MIN, SNOOKER_CAMERA_HEIGHT_MAX);
  const cuePhi = THREE.MathUtils.clamp(
    SNOOKER_CUE_VIEW_MIN_PHI + SNOOKER_CUE_VIEW_PHI_LIFT * (0.5 + portraitT * 0.15) - heightLift * 0.24,
    SNOOKER_CUE_CAMERA_MIN_PHI,
    SNOOKER_CUE_CAMERA_MAX_PHI - SNOOKER_CUE_CAMERA_RAIL_SAFETY
  );
  const phi = THREE.MathUtils.clamp(
    lerp(SNOOKER_CUE_CAMERA_STANDING_PHI, cuePhi, 0.35 + clampedPower * 0.65),
    SNOOKER_CUE_CAMERA_MIN_PHI,
    SNOOKER_CUE_CAMERA_MAX_PHI - SNOOKER_CUE_CAMERA_RAIL_SAFETY
  );
  const horizontal = Math.sin(phi) * radius;
  const vertical = Math.cos(phi) * radius;
  const minY = CFG.tableTopY + CFG.ballR + SNOOKER_CUE_SURFACE_MARGIN;
  const pos = cueBallWorld.clone()
    .addScaledVector(aimForward, -horizontal)
    .setY(Math.max(minY, target.y + vertical + heightLift * CFG.tableL * 0.12));
  return { pos, target, fov: 56 };
}

function updateCamera(camera, mode, broadcastMode, cueBallWorld, aimForward, activePower, now, pocketPositions = [], options = {}) {
  const aspect = Math.max(0.45, camera.aspect || 1);
  const portraitT = clamp01((1 / aspect - 1) / 0.78);
  const railSide = options.railSide === 'front' ? -1 : 1;
  const tableCenter = new THREE.Vector3(0, CFG.tableTopY + CFG.ballR * 1.05, 0);
  const tableDistance = computeSnookerTopViewDistance(aspect, POOL_ROYALE_STANDING_VIEW_FOV, mode === 'top-2d' ? 1.16 : 1.22);
  const heightOffset = THREE.MathUtils.clamp(options.heightOffset ?? 0, SNOOKER_CAMERA_HEIGHT_MIN, SNOOKER_CAMERA_HEIGHT_MAX);
  const railPhi = Math.max(0.18, POOL_ROYALE_RAIL_OVERHEAD_PHI - Math.PI / 2);
  let pos;
  let target = cueBallWorld.clone().lerp(tableCenter, 0.28);
  let fov = POOL_ROYALE_STANDING_VIEW_FOV;
  if (mode === 'rail-overhead' || (mode === 'tv-broadcast' && broadcastMode === DEFAULT_BROADCAST_SYSTEM_ID)) {
    const radius = tableDistance * (0.95 + portraitT * 0.05);
    const y = tableCenter.y + Math.cos(railPhi) * radius + CFG.ballR * 2.6 + heightOffset * CFG.tableL * 0.16;
    const z = railSide * Math.sin(railPhi) * radius;
    pos = new THREE.Vector3(0, y, z);
    target = tableCenter.clone().add(new THREE.Vector3(0, 0, -railSide * CFG.tableL * 0.035));
    fov = 62 + portraitT * 4;
  } else if (mode === 'top-2d') {
    pos = new THREE.Vector3(0, tableCenter.y + tableDistance * (1.03 + portraitT * 0.06) + heightOffset * CFG.tableL * 0.16, 0.001);
    target = tableCenter.clone();
    fov = 54 + portraitT * 4;
  } else if (mode === 'corner-pocket-left' || mode === 'corner-pocket-right') {
    const sign = mode === 'corner-pocket-left' ? -1 : 1;
    const localPocket = pocketPositions[sign < 0 ? 0 : 1] ?? new THREE.Vector3(sign * CFG.tableW / 2, CFG.ballR, -CFG.tableL / 2);
    const pocket = snookerPocketToWorld(localPocket);
    pos = pocket.clone().add(new THREE.Vector3(sign * CFG.tableW * 0.26, CFG.ballR * (8.6 + portraitT) + heightOffset * CFG.tableL * 0.12, -CFG.tableL * 0.22));
    target = cueBallWorld.clone().lerp(pocket, 0.34).setY(CFG.tableTopY + CFG.ballR * 1.35);
    fov = 61;
  } else if (mode === 'tv-broadcast' && broadcastMode === 'pocket-cuts' && activePower > 0.35) {
    const idx = Math.floor((now / 1600) % Math.max(1, pocketPositions.length));
    const pocket = snookerPocketToWorld(pocketPositions[idx]);
    const xSign = Math.sign(pocket.x || 1);
    const zSign = Math.sign(pocket.z || 1);
    pos = pocket.clone().add(new THREE.Vector3(xSign * CFG.tableW * 0.22, CFG.ballR * (8.8 + portraitT) + heightOffset * CFG.tableL * 0.12, zSign * CFG.tableL * 0.18));
    target = cueBallWorld.clone().lerp(pocket, 0.38).setY(CFG.tableTopY + CFG.ballR * 1.3);
    fov = 62;
  } else if (mode === 'tv-broadcast' && broadcastMode === 'cinematic') {
    const side = new THREE.Vector3(aimForward.z, 0, -aimForward.x).normalize();
    pos = cueBallWorld.clone().addScaledVector(aimForward, -CFG.tableL * 0.46).addScaledVector(side, CFG.tableW * 0.22).setY(CFG.tableTopY + CFG.ballR * 8.2 + heightOffset * CFG.tableL * 0.12);
    target = cueBallWorld.clone().addScaledVector(aimForward, CFG.tableL * 0.16).setY(CFG.tableTopY + CFG.ballR * 1.4);
    fov = 58;
  } else {
    const cueCamera = resolveSnookerCueCameraPose(cueBallWorld, aimForward, activePower, aspect, heightOffset);
    pos = cueCamera.pos;
    target = cueCamera.target;
    fov = cueCamera.fov;
  }
  camera.fov += (fov - camera.fov) * 0.12;
  camera.position.lerp(pos, 0.14);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
}

export default function SnookerRoyalProvided({ gameTitle = 'Snooker Royal Provided' } = {}) {
  const hostRef = useRef(null);
  const canvasRef = useRef(null);
  const sliderMountRef = useRef(null);
  const spinPadRef = useRef(null);
  const spinDotRef = useRef(null);
  const [power, setPower] = useState(0);
  const [shotState, setShotState] = useState('idle');
  const [tableStatus, setTableStatus] = useState('Loading Pooltool snooker table GLB…');
  const [humanStatus, setHumanStatus] = useState('Preparing ReadyPlayer human…');
  const [score, setScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [activePlayer, setActivePlayer] = useState(0);
  const [target, setTarget] = useState('Red');
  const [foul, setFoul] = useState('');
  const [hasReplay, setHasReplay] = useState(false);
  const [replayActive, setReplayActive] = useState(false);
  const [replaySkipAll, setReplaySkipAll] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showGift, setShowGift] = useState(false);
  const [lastQuickMessage, setLastQuickMessage] = useState('');
  const [frameRateId, setFrameRateId] = useState(() => loadStoredOption('graphics', 'qhd90', FRAME_RATE_OPTIONS.map((item) => item.id)));
  const [cameraMode, setCameraMode] = useState(() => loadStoredOption('cameraMode', 'rail-overhead', CAMERA_MODE_OPTIONS.map((item) => item.id)));
  const [broadcastSystemId, setBroadcastSystemId] = useState(() => loadStoredOption('broadcastSystem', DEFAULT_BROADCAST_SYSTEM_ID, BROADCAST_SYSTEM_OPTIONS.map((item) => item.id)));
  const [environmentHdriId, setEnvironmentHdriId] = useState(() => loadStoredOption('hdri', POOL_ROYALE_DEFAULT_HDRI_ID, POOL_ROYALE_HDRI_VARIANTS.map((item) => item.id)));
  const [clothId, setClothId] = useState(() => loadStoredOption('cloth', DEFAULT_CLOTH_ID, POOL_ROYALE_CLOTH_VARIANTS.map((item) => item.id)));
  const [textureId, setTextureId] = useState(() => loadStoredOption('texture', SNOOKER_TEXTURE_OPTIONS[0].id, SNOOKER_CHAMPION_TEXTURE_IDS));
  const [spin, setSpin] = useState({ x: 0, y: 0 });
  const powerRef = useRef(0);
  const shotPowerRef = useRef(0);
  const shotStateRef = useRef('idle');
  const draggingSliderRef = useRef(false);
  const aimYawRef = useRef(0);
  const spinRef = useRef({ x: 0, y: 0 });
  const cameraModeRef = useRef(cameraMode);
  const broadcastSystemRef = useRef(broadcastSystemId);
  const railOverheadSideRef = useRef('back');
  const replayFramesRef = useRef([]);
  const cameraHeightOffsetRef = useRef(0);
  const replayModeRef = useRef(false);
  const replayStartedAtRef = useRef(0);
  const replaySkipAllRef = useRef(false);
  const audioContextRef = useRef(null);
  const audioBuffersRef = useRef({ cue: null, ball: null, pocket: null });
  const muteRef = useRef(isGameMuted());
  const volumeRef = useRef(getGameVolume());
  const lastSoundAtRef = useRef(new Map());
  const rulesRef = useRef(createSnookerRulesState());
  const activeFrameRate = FRAME_RATE_OPTIONS.find((item) => item.id === frameRateId) ?? FRAME_RATE_OPTIONS[1];
  const activeHdri = POOL_ROYALE_HDRI_VARIANTS.find((item) => item.id === environmentHdriId) ?? POOL_ROYALE_HDRI_VARIANTS[0];
  const activeCloth = POOL_ROYALE_CLOTH_VARIANTS.find((item) => item.id === clothId) ?? POOL_ROYALE_CLOTH_VARIANTS[0];
  const activeTexture = resolveSnookerChampionTextureOption(textureId);
  const activeClothColor = resolveClothColor(activeCloth);
  const playerName = getTelegramUsername() || 'Player';
  const playerAvatar = getTelegramPhotoUrl() || '/assets/icons/profile.svg';
  const opponentName = 'Snooker AI';
  const opponentAvatar = '/assets/icons/snooker-regular.svg';
  const playerAccountId = getTelegramId?.() || 'snooker-champion-player';
  const giftPlayers = useMemo(() => [
    { id: playerAccountId, index: 0, name: playerName, avatar: playerAvatar },
    { id: 'snooker-champion-ai', index: 1, name: opponentName, avatar: opponentAvatar }
  ], [opponentAvatar, opponentName, playerAccountId, playerAvatar, playerName]);
  const [isPortraitHud, setIsPortraitHud] = useState(() => (typeof window !== 'undefined' ? window.innerHeight > window.innerWidth : false));
  const [railOverheadSide, setRailOverheadSide] = useState('back');
  const uiScale = isPortraitHud ? 0.82 : 1;
  const sharedHudLiftPx = isPortraitHud ? 18 : 0;
  const avatarSizeClass = isPortraitHud ? 'h-[2.9rem] w-[2.9rem]' : 'h-[3.7rem] w-[3.7rem]';
  const nameWidthClass = 'max-w-[9.5rem]';
  const nameTextClass = 'text-sm';
  const hdriOptions = useMemo(() => POOL_ROYALE_HDRI_VARIANTS.slice(0, 12), []);
  const clothOptions = useMemo(() => {
    const snookerFirst = POOL_ROYALE_CLOTH_VARIANTS.filter((item) => /green|blue|red|black|gold/i.test(`${item.id} ${item.label}`));
    return (snookerFirst.length ? snookerFirst : POOL_ROYALE_CLOTH_VARIANTS).slice(0, 10);
  }, []);
  const textureOptions = useMemo(() => {
    const woodOptions = WOOD_FINISH_PRESETS?.map?.((item, idx) => ({
      ...item,
      id: item.id || `wood-${idx}`,
      label: item.label || item.name || `Wood ${idx + 1}`,
      rail: SNOOKER_TEXTURE_OPTIONS[idx % SNOOKER_TEXTURE_OPTIONS.length].rail,
      trim: SNOOKER_TEXTURE_OPTIONS[idx % SNOOKER_TEXTURE_OPTIONS.length].trim
    })) ?? [];
    return [...SNOOKER_TEXTURE_OPTIONS, ...woodOptions];
  }, []);

  useEffect(() => { powerRef.current = power; }, [power]);
  useEffect(() => { shotStateRef.current = shotState; }, [shotState]);
  useEffect(() => { spinRef.current = spin; }, [spin]);
  useEffect(() => { cameraModeRef.current = cameraMode; }, [cameraMode]);
  useEffect(() => { broadcastSystemRef.current = broadcastSystemId; }, [broadcastSystemId]);
  useEffect(() => { railOverheadSideRef.current = railOverheadSide === 'front' ? 'front' : 'back'; }, [railOverheadSide]);
  useEffect(() => { replayModeRef.current = replayActive; }, [replayActive]);
  useEffect(() => { replaySkipAllRef.current = replaySkipAll; }, [replaySkipAll]);
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const update = () => setIsPortraitHud(window.innerHeight > window.innerWidth);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  useEffect(() => { storeOption('graphics', frameRateId); }, [frameRateId]);
  useEffect(() => { storeOption('cameraMode', cameraMode); }, [cameraMode]);
  useEffect(() => { storeOption('broadcastSystem', broadcastSystemId); }, [broadcastSystemId]);
  useEffect(() => { storeOption('hdri', environmentHdriId); }, [environmentHdriId]);
  useEffect(() => { storeOption('cloth', clothId); }, [clothId]);
  useEffect(() => { storeOption('texture', textureId); }, [textureId]);

  const routeAudioNode = useCallback((node) => {
    const ctx = audioContextRef.current;
    if (!ctx || !node) return;
    try {
      node.connect(ctx.destination);
    } catch {}
  }, []);

  const playSnookerRoyalBuffer = useCallback((key, vol = 1, options = {}) => {
    if (vol <= 0 || muteRef.current) return;
    const ctx = audioContextRef.current;
    const buffer = audioBuffersRef.current[key];
    if (!ctx || !buffer) return;
    const now = performance.now();
    const cooldownMs = options.cooldownMs ?? 0;
    const lastKey = options.cooldownKey ?? key;
    const lastAt = lastSoundAtRef.current.get(lastKey) ?? 0;
    if (cooldownMs > 0 && now - lastAt < cooldownMs) return;
    lastSoundAtRef.current.set(lastKey, now);
    const scaled = clamp(vol * volumeRef.current * (options.gain ?? 1), 0, options.maxGain ?? 1);
    if (scaled <= 0) return;
    ctx.resume().catch(() => {});
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = scaled;
    source.connect(gain);
    routeAudioNode(gain);
    if (options.tailSeconds && Number.isFinite(buffer.duration)) {
      const offset = Math.max(0, buffer.duration - options.tailSeconds);
      source.start(0, offset, Math.min(options.tailSeconds, buffer.duration));
    } else {
      source.start(0);
    }
  }, [routeAudioNode]);

  const playCueHit = useCallback((vol = 1) => {
    const powerGain = 0.35 + clamp01(vol) * 0.75;
    playSnookerRoyalBuffer('cue', powerGain, { gain: 1.2, maxGain: 1, cooldownMs: 45, cooldownKey: 'cue' });
  }, [playSnookerRoyalBuffer]);

  const playBallHit = useCallback((vol = 1) => {
    playSnookerRoyalBuffer('ball', vol, { gain: 0.72, maxGain: 1, cooldownMs: 38, cooldownKey: 'ball' });
  }, [playSnookerRoyalBuffer]);

  const playPocket = useCallback((vol = 1) => {
    playSnookerRoyalBuffer('pocket', Math.max(0.22, vol), { gain: 0.8, maxGain: 1, tailSeconds: 1.3, cooldownMs: 90, cooldownKey: 'pocket' });
  }, [playSnookerRoyalBuffer]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const updateMute = () => { muteRef.current = isGameMuted(); };
    const updateVolume = () => { volumeRef.current = getGameVolume(); };
    window.addEventListener('gameMuteChanged', updateMute);
    window.addEventListener('gameVolumeChanged', updateVolume);
    return () => {
      window.removeEventListener('gameMuteChanged', updateMute);
      window.removeEventListener('gameVolumeChanged', updateVolume);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return undefined;
    const ctx = new AudioContextClass();
    audioContextRef.current = ctx;
    let cancelled = false;
    const loadBuffer = async (path) => {
      const response = await fetch(encodeURI(path));
      if (!response.ok) throw new Error(`Failed to load ${path}`);
      const arrayBuffer = await response.arrayBuffer();
      return await new Promise((resolve, reject) => ctx.decodeAudioData(arrayBuffer, resolve, reject));
    };
    (async () => {
      const entries = [
        ['cue', '/assets/sounds/cuehitsound.mp3'],
        ['ball', '/assets/sounds/billiard-sound newhit.mp3'],
        ['pocket', '/assets/sounds/billiard-sound-6-288417.mp3']
      ];
      const loaded = {};
      for (const [key, path] of entries) {
        try {
          loaded[key] = await loadBuffer(path);
        } catch (error) {
          console.warn('Snooker Champion audio load failed:', key, error);
        }
      }
      if (!cancelled) audioBuffersRef.current = { ...audioBuffersRef.current, ...loaded };
    })();
    return () => {
      cancelled = true;
      audioBuffersRef.current = { cue: null, ball: null, pocket: null };
      audioContextRef.current = null;
      ctx.close().catch(() => {});
    };
  }, []);

  useEffect(() => {
    const mount = sliderMountRef.current;
    if (!mount) return undefined;
    mount.innerHTML = '';
    const slider = new PoolRoyalePowerSlider({
      mount,
      value: 0,
      min: 0,
      max: 100,
      step: 1,
      cueSrc: '/assets/snooker/cue.webp',
      labels: true,
      onStart: () => {
        draggingSliderRef.current = true;
        setShotState('dragging');
      },
      onChange: (value) => {
        const normalized = clamp01(value / 100);
        setPower(normalized);
        if (draggingSliderRef.current) shotPowerRef.current = normalized;
      },
      onCommit: (value) => {
        const normalized = clamp01(value / 100);
        shotPowerRef.current = normalized;
        draggingSliderRef.current = false;
        setShotState(normalized > 0.02 ? 'striking' : 'idle');
        slider.animateToMin({ duration: 180 });
      }
    });
    return () => slider.destroy();
  }, []);

  useEffect(() => {
    const pad = spinPadRef.current;
    const dot = spinDotRef.current;
    if (!pad || !dot) return undefined;

    pad.style.transition = 'transform 0.18s ease';
    pad.style.transformOrigin = '50% 50%';
    pad.style.touchAction = 'none';

    let activePointer = null;
    let revertTimer = null;
    let rafId = null;
    let lastTime = null;
    let moved = false;
    const spinState = {
      current: { x: 0, y: 0 },
      target: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 }
    };
    const SMOOTH_TIME = 0.085;
    const MAX_SPEED = 6;
    const MAX_STEP_SECONDS = 0.04;
    const SETTLE_EPS = 0.0015;

    const applySpin = (nx, ny) => {
      const clamped = clampToUnitCircle(nx, ny);
      const normalized = normalizeSpinInput(clamped);
      setSpin(normalized);
      spinRef.current = normalized;
      dot.style.left = `${50 + normalized.x * 42}%`;
      dot.style.top = `${50 - normalized.y * 42}%`;
    };

    const clearTimer = () => {
      if (revertTimer) {
        clearTimeout(revertTimer);
        revertTimer = null;
      }
    };
    const releasePointer = () => {
      if (activePointer !== null) {
        try { pad.releasePointerCapture(activePointer); } catch {}
        activePointer = null;
      }
    };
    const scalePad = (value) => {
      pad.style.transform = `scale(${value})`;
    };
    function stepSpring(timestamp) {
      if (!lastTime) lastTime = timestamp;
      const dt = Math.min((timestamp - lastTime) / 1000, MAX_STEP_SECONDS);
      lastTime = timestamp;
      const nextX = smoothDamp(
        spinState.current.x,
        spinState.target.x,
        spinState.velocity.x,
        SMOOTH_TIME,
        MAX_SPEED,
        dt
      );
      const nextY = smoothDamp(
        spinState.current.y,
        spinState.target.y,
        spinState.velocity.y,
        SMOOTH_TIME,
        MAX_SPEED,
        dt
      );
      spinState.current.x = nextX.value;
      spinState.current.y = nextY.value;
      spinState.velocity.x = nextX.velocity;
      spinState.velocity.y = nextY.velocity;
      applySpin(spinState.current.x, spinState.current.y);
      const dx = spinState.target.x - spinState.current.x;
      const dy = spinState.target.y - spinState.current.y;
      const settled =
        Math.abs(dx) < SETTLE_EPS &&
        Math.abs(dy) < SETTLE_EPS &&
        Math.hypot(spinState.velocity.x, spinState.velocity.y) < SETTLE_EPS;
      if (settled) {
        spinState.current = { ...spinState.target };
        spinState.velocity = { x: 0, y: 0 };
      }
      if (activePointer !== null || !settled) {
        rafId = requestAnimationFrame(stepSpring);
      } else {
        rafId = null;
        lastTime = null;
      }
    }
    const startSpring = () => {
      if (!rafId) rafId = requestAnimationFrame(stepSpring);
    };
    const updateSpin = (clientX, clientY) => {
      const rect = pad.getBoundingClientRect();
      const rawX = ((clientX - rect.left) / rect.width - 0.5) * 2;
      const rawY = (0.5 - (clientY - rect.top) / rect.height) * 2;
      const clamped = normalizeSpinInput(clampToUnitCircle(rawX, rawY));
      spinState.target = clamped;
      startSpring();
    };
    const snapTarget = () => {
      const snapped = computeQuantizedOffsetScaled(spinState.target.x, spinState.target.y);
      spinState.target = normalizeSpinInput(clampToUnitCircle(snapped.x, snapped.y));
      startSpring();
    };
    const onPointerDown = (e) => {
      releasePointer();
      activePointer = e.pointerId;
      moved = false;
      clearTimer();
      scalePad(1.35);
      updateSpin(e.clientX, e.clientY);
      pad.setPointerCapture(activePointer);
      revertTimer = window.setTimeout(() => {
        if (!moved) scalePad(1);
      }, 1500);
    };
    const onPointerMove = (e) => {
      if (activePointer !== e.pointerId || (e.pointerType === 'mouse' && e.buttons === 0)) return;
      moved = true;
      updateSpin(e.clientX, e.clientY);
    };
    const onPointerUp = (e) => {
      if (activePointer !== e.pointerId) return;
      releasePointer();
      clearTimer();
      snapTarget();
      revertTimer = window.setTimeout(() => scalePad(1), 50);
    };
    const onPointerCancel = (e) => {
      if (activePointer !== e.pointerId) return;
      releasePointer();
      clearTimer();
      snapTarget();
      scalePad(1);
    };
    applySpin(0, 0);
    scalePad(1);
    pad.addEventListener('pointerdown', onPointerDown);
    pad.addEventListener('pointermove', onPointerMove);
    pad.addEventListener('pointerup', onPointerUp);
    pad.addEventListener('pointercancel', onPointerCancel);
    return () => {
      releasePointer();
      clearTimer();
      if (rafId) cancelAnimationFrame(rafId);
      pad.removeEventListener('pointerdown', onPointerDown);
      pad.removeEventListener('pointermove', onPointerMove);
      pad.removeEventListener('pointerup', onPointerUp);
      pad.removeEventListener('pointercancel', onPointerCancel);
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return undefined;
    setTableStatus('Loading Pooltool snooker table GLB…');
    rulesRef.current = createSnookerRulesState();
    setScore(0);
    setOpponentScore(0);
    setActivePlayer(0);
    setTarget('Red');
    setFoul('');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setClearColor(activeHdri?.swatches?.[0] ? new THREE.Color(activeHdri.swatches[0]) : new THREE.Color(0x0b0b0b), 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = activeHdri?.exposure ?? 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(renderer.getClearColor(new THREE.Color()), 18 * CFG.scale, 42 * CFG.scale);
    const camera = new THREE.PerspectiveCamera(POOL_ROYALE_STANDING_VIEW_FOV, 1, 0.05 * CFG.scale, 80 * CFG.scale);
    camera.position.set(1.85 * CFG.scale, 2.45 * CFG.scale, 7.85 * CFG.scale);
    camera.lookAt(0, 1.05 * CFG.scale, 0);
    scene.add(new THREE.AmbientLight(0xffffff, 0.18 + ((activeHdri?.environmentIntensity ?? 1) * 0.06)));
    scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 0.12));
    const sun = new THREE.DirectionalLight(0xffffff, 0.22 + ((activeHdri?.backgroundIntensity ?? 1) * 0.08));
    sun.position.set(3.5 * CFG.scale, 7 * CFG.scale, 5 * CFG.scale);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.00018;
    sun.shadow.normalBias = 0.012;
    sun.shadow.camera.left = -CFG.tableW * 0.9;
    sun.shadow.camera.right = CFG.tableW * 0.9;
    sun.shadow.camera.top = CFG.tableL * 0.7;
    sun.shadow.camera.bottom = -CFG.tableL * 0.7;
    sun.shadow.camera.near = 0.5 * CFG.scale;
    sun.shadow.camera.far = 14 * CFG.scale;
    scene.add(sun);
    let activeSkyboxMap = null;
    let activeEnvMap = null;
    let activeGroundedSkybox = null;
    let disposed = false;
    loadChampionHdriEnvironment(renderer, activeHdri).then((env) => {
      if (disposed || !env) return;
      activeEnvMap = env.envMap;
      scene.environment = env.envMap;
      const hdriRotationY = activeHdri?.rotationY ?? 0;
      if ('environmentRotation' in scene) scene.environmentRotation = new THREE.Euler(0, hdriRotationY, 0);
      if ('backgroundRotation' in scene) scene.backgroundRotation = new THREE.Euler(0, hdriRotationY, 0);
      if ('environmentIntensity' in scene) scene.environmentIntensity = activeHdri?.environmentIntensity ?? 1;
      if ('backgroundIntensity' in scene) scene.backgroundIntensity = activeHdri?.backgroundIntensity ?? 1;
      if (env.skyboxMap) {
        activeSkyboxMap = env.skyboxMap;
        const cameraHeightMeters = Math.max(
          activeHdri?.cameraHeightM ?? SNOOKER_HDRI_CAMERA_HEIGHT_M,
          SNOOKER_HDRI_MIN_CAMERA_HEIGHT_M
        );
        const skyboxHeight = cameraHeightMeters * CFG.scale;
        const groundRadiusMultiplier = typeof activeHdri?.groundRadiusMultiplier === 'number'
          ? activeHdri.groundRadiusMultiplier
          : SNOOKER_HDRI_RADIUS_MULTIPLIER;
        const skyboxRadius = Math.max(
          Math.max(CFG.tableW, CFG.tableL) * groundRadiusMultiplier,
          skyboxHeight * 2.5
        );
        const skyboxResolution = Math.max(
          16,
          Math.floor(activeHdri?.groundResolution ?? SNOOKER_HDRI_GROUNDED_RESOLUTION)
        );
        try {
          activeGroundedSkybox = new GroundedSkybox(env.skyboxMap, skyboxHeight, skyboxRadius, skyboxResolution);
          activeGroundedSkybox.name = 'SnookerChampion_GroundedHdriFloor';
          activeGroundedSkybox.position.y = skyboxHeight;
          activeGroundedSkybox.rotation.y = hdriRotationY;
          activeGroundedSkybox.material.depthWrite = false;
          scene.background = null;
          scene.add(activeGroundedSkybox);
        } catch (error) {
          console.warn('Failed to create grounded snooker HDRI skybox', error);
          activeGroundedSkybox = null;
          scene.background = env.skyboxMap;
        }
      }
    });
    const { tableGroup, pocketPositions, disposeTableLoader } = addTable(scene, renderer, {
      clothColor: activeClothColor,
      clothOption: activeCloth,
      textureId,
      floorColor: activeHdri?.swatches?.[1] ? new THREE.Color(activeHdri.swatches[1]).getHex() : 0x1d232a,
      onStatus: setTableStatus
    });
    const { balls, cueBall } = addBalls(tableGroup);
    const cue = createCue();
    scene.add(cue.group);
    const human = addHuman(scene, renderer, setHumanStatus);
    const cueLine = createGuideLine(0xffffff, 0.9);
    const aimLine = createGuideLine(0xe8f6ff, 0.68);
    const cueAfterLine = createGuideLine(0x7ce7ff, 0.7);
    const targetLine = createGuideLine(0xffd166, 0.75);
    const impactTick = createGuideLine(0xffffff, 0.9);
    scene.add(cueLine, aimLine, cueAfterLine, targetLine, impactTick);
    const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3();
    let strikeT = 0, didHit = false, frameId = 0, last = performance.now(), isAiming = false, lastAimX = 0, lastAimY = 0;
    let recordingReplay = false, replayStartedAt = 0, lastReplaySampleAt = 0;
    let lastScore = rulesRef.current.score;
    let lastOpponentScore = rulesRef.current.scores?.[1] ?? 0;
    let lastActivePlayer = rulesRef.current.activePlayer ?? 0;
    let lastTarget = rulesRef.current.target;
    let lastFoul = rulesRef.current.foul;
    const resize = () => {
      const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
      renderer.setSize(w, h, false);
      renderer.setPixelRatio(Math.min(activeFrameRate.pixelRatioCap, window.devicePixelRatio || 1));
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const onCanvasDown = (e) => { if (!draggingSliderRef.current) { isAiming = true; lastAimX = e.clientX; lastAimY = e.clientY; } };
    const onCanvasMove = (e) => {
      if (!isAiming || draggingSliderRef.current) return;
      aimYawRef.current -= (e.clientX - lastAimX) * 0.006;
      const verticalDrag = lastAimY - e.clientY;
      cameraHeightOffsetRef.current = THREE.MathUtils.clamp(
        cameraHeightOffsetRef.current + verticalDrag * 0.0025,
        SNOOKER_CAMERA_HEIGHT_MIN,
        SNOOKER_CAMERA_HEIGHT_MAX
      );
      lastAimX = e.clientX;
      lastAimY = e.clientY;
    };
    const onCanvasWheel = (e) => {
      e.preventDefault();
      cameraHeightOffsetRef.current = THREE.MathUtils.clamp(
        cameraHeightOffsetRef.current - Math.sign(e.deltaY || 0) * SNOOKER_CAMERA_HEIGHT_STEP,
        SNOOKER_CAMERA_HEIGHT_MIN,
        SNOOKER_CAMERA_HEIGHT_MAX
      );
    };
    const onCanvasUp = () => { isAiming = false; };
    canvas.addEventListener('pointerdown', onCanvasDown);
    canvas.addEventListener('pointermove', onCanvasMove);
    canvas.addEventListener('pointerup', onCanvasUp);
    canvas.addEventListener('pointercancel', onCanvasUp);
    canvas.addEventListener('wheel', onCanvasWheel, { passive: false });
    window.addEventListener('resize', resize);
    resize();
    function animate() {
      frameId = requestAnimationFrame(animate);
      const now = performance.now();
      const targetFrameSeconds = 1 / Math.max(activeFrameRate.fps, 30);
      const dt = Math.min(0.033, Math.max(targetFrameSeconds * 0.5, (now - last) / 1000));
      last = now;
      const state = shotStateRef.current;
      const activePower = state === 'dragging' ? powerRef.current : shotPowerRef.current;
      const cueBallWorld = cueBall.mesh.getWorldPosition(new THREE.Vector3());
      const aimForward = tmpA.set(0, 0, -1).applyAxisAngle(Y_AXIS, aimYawRef.current).normalize().clone();
      const aimSide = tmpB.set(aimForward.z, 0, -aimForward.x).normalize().clone();
      const humanRootTarget = chooseHumanEdgePosition(cueBallWorld, aimForward);
      const bridgeHandTarget = cueBallWorld.clone()
        .addScaledVector(aimForward, -CFG.bridgeHandBackFromBall)
        .addScaledVector(aimSide, CFG.bridgeHandSide)
        .setY(CFG.tableTopY + CFG.bridgePalmTableLift);
      const bridgeCuePoint = bridgeHandTarget.clone()
        .addScaledVector(aimForward, CFG.bridgeVGrooveForward)
        .addScaledVector(aimSide, CFG.bridgeVGrooveSide)
        .add(new THREE.Vector3(0, CFG.bridgeCueLift, 0));
      const pull = CFG.pullRange * easeOutCubic(activePower);
      const practiceStroke = state === 'dragging' ? Math.sin(now * 0.012) * 0.035 * CFG.scale * (0.25 + activePower * 0.75) : 0;
      const strikeNorm = clamp01(strikeT / CFG.strikeTime);
      let gap = CFG.idleGap;
      const spinOffset = mapSpinForPhysics(spinRef.current);
      if (state === 'dragging') gap += pull + practiceStroke;
      if (state === 'striking') gap = lerp(CFG.idleGap + pull, CFG.contactGap, easeOutCubic(strikeNorm));
      const cueTipShoot = cueBallWorld.clone()
        .addScaledVector(aimForward, -(CFG.ballR + gap))
        .addScaledVector(aimSide, (spinOffset.x ?? 0) * CFG.ballR * 0.52)
        .add(new THREE.Vector3(0, (spinOffset.y ?? 0) * CFG.ballR * 0.44, 0));
      const cueBackShoot = bridgeCuePoint.clone().addScaledVector(aimForward, -(CFG.cueLength - CFG.bridgeDist - CFG.ballR - gap)).add(new THREE.Vector3(0, 0.024 * CFG.scale, 0));
      const standingYaw = yawFromForward(aimForward);
      const idleRightHandTarget = humanRootTarget.clone().add(new THREE.Vector3(CFG.idleRightHandX, CFG.idleRightHandY, CFG.idleRightHandZ).applyAxisAngle(Y_AXIS, standingYaw));
      const idleLeftHandTarget = humanRootTarget.clone().add(new THREE.Vector3(-0.18 * CFG.scale, 1.08 * CFG.scale, 0.03 * CFG.scale).applyAxisAngle(Y_AXIS, standingYaw));
      const idleDir = CFG.idleCueDir.clone().applyAxisAngle(Y_AXIS, standingYaw).normalize();
      const idleCue = cuePoseFromGrip(idleRightHandTarget, idleDir, CFG.idleCueGripFromBack, CFG.cueLength);
      if (state === 'idle') { strikeT = 0; didHit = false; }
      else if (state === 'dragging') { strikeT = 0; didHit = false; }
      else {
        strikeT += dt;
        if (!didHit && strikeNorm > 0.88) {
          didHit = true;
          beginSnookerShotRules(rulesRef.current);
          applyCueShot(cueBall, shotPowerRef.current, aimYawRef.current, tmpC, spinRef.current);
          playCueHit(shotPowerRef.current);
          if (!replaySkipAllRef.current) {
            recordingReplay = true;
            replayStartedAt = now;
            lastReplaySampleAt = 0;
            replayFramesRef.current = [{ t: 0, balls: createReplaySnapshot(balls), cameraMode: 'cue-follow' }];
            setHasReplay(false);
          }
        }
        if (strikeT >= CFG.strikeTime + CFG.holdTime) { strikeT = 0; didHit = false; setShotState('idle'); }
      }
      const loweredShootingView = cameraModeRef.current === 'cue-follow' && cameraHeightOffsetRef.current <= SNOOKER_AIMING_CAMERA_HEIGHT_THRESHOLD;
      const visualState = state === 'idle' && loweredShootingView ? 'aiming' : state;
      const activeCueBack = visualState === 'idle' ? idleCue.back : cueBackShoot;
      const activeCueTip = visualState === 'idle' ? idleCue.tip : cueTipShoot;
      setCuePose(cue, activeCueBack, activeCueTip);
      if (replayModeRef.current && replayFramesRef.current.length > 1) {
        const frames = replayFramesRef.current;
        const elapsed = now - replayStartedAtRef.current;
        const finalT = frames[frames.length - 1].t;
        const replayT = Math.min(elapsed, finalT);
        let frameIndex = frames.findIndex((frame) => frame.t >= replayT);
        if (frameIndex < 0) frameIndex = frames.length - 1;
        applyReplaySnapshot(balls, frames[frameIndex].balls);
        const replayCueWorld = cueBall.mesh.getWorldPosition(new THREE.Vector3());
        const cameraMode = SNOOKER_REPLAY_CAMERA_SEQUENCE[Math.floor((elapsed / 1300) % SNOOKER_REPLAY_CAMERA_SEQUENCE.length)] ?? 'rail-overhead';
        updateCamera(camera, cameraMode, DEFAULT_BROADCAST_SYSTEM_ID, replayCueWorld, aimForward, 1, now, pocketPositions, { railSide: railOverheadSideRef.current, heightOffset: cameraHeightOffsetRef.current });
        if (elapsed >= finalT) setReplayActive(false);
        renderer.render(scene, camera);
        return;
      }
      updateBalls(balls, dt, tmpB, tmpC, pocketPositions, rulesRef.current, { playBallHit, playPocket });
      const ballsMoving = balls.some((ball) => !ball.potted && ball.vel.lengthSq() > CFG.minSpeed2);
      if (recordingReplay && now - lastReplaySampleAt >= SNOOKER_REPLAY_SAMPLE_MS) {
        lastReplaySampleAt = now;
        replayFramesRef.current.push({ t: now - replayStartedAt, balls: createReplaySnapshot(balls), cameraMode: cameraModeRef.current });
        if (!ballsMoving || now - replayStartedAt >= SNOOKER_REPLAY_MAX_MS) {
          recordingReplay = false;
          const replayReady = replayFramesRef.current.length > 2;
          setHasReplay(replayReady);
          const shouldAutoReplay = replayReady && !replaySkipAllRef.current && ((rulesRef.current.shotPotCount ?? 0) > 0 || Boolean(rulesRef.current.shotFoul));
          if (shouldAutoReplay) {
            replayStartedAtRef.current = performance.now();
            setReplayActive(true);
          }
        }
      }
      if (!ballsMoving && rulesRef.current.shotActive) finalizeSnookerShotRules(balls, rulesRef.current);
      if (rulesRef.current.score !== lastScore) { lastScore = rulesRef.current.score; setScore(lastScore); }
      if ((rulesRef.current.scores?.[1] ?? 0) !== lastOpponentScore) { lastOpponentScore = rulesRef.current.scores?.[1] ?? 0; setOpponentScore(lastOpponentScore); }
      if ((rulesRef.current.activePlayer ?? 0) !== lastActivePlayer) { lastActivePlayer = rulesRef.current.activePlayer ?? 0; setActivePlayer(lastActivePlayer); }
      if (rulesRef.current.target !== lastTarget) { lastTarget = rulesRef.current.target; setTarget(lastTarget); }
      if (rulesRef.current.foul !== lastFoul) { lastFoul = rulesRef.current.foul; setFoul(lastFoul); }
      updateHumanPose(human, dt, visualState, humanRootTarget, aimForward, bridgeHandTarget, idleRightHandTarget, idleLeftHandTarget, activeCueBack, activeCueTip, activePower);
      setGuideLine(cueLine, activeCueBack, cueBallWorld, true);
      const prediction = calcSnookerAimTarget(cueBall, aimForward, balls, pocketPositions);
      const aimY = cueBallWorld.y;
      const aimStart = cueBallWorld.clone().setY(aimY);
      const boundedImpact = clampSnookerAimImpactToPerimeter(prediction.impact);
      const aimEnd = new THREE.Vector3(boundedImpact.x, aimY, boundedImpact.y);
      setGuideLine(aimLine, aimStart, aimEnd, true);
      const guideDir = aimEnd.clone().sub(aimStart).setY(0).normalize();
      const tickPerp = new THREE.Vector3(-guideDir.z, 0, guideDir.x).normalize();
      setGuideLine(impactTick, aimEnd.clone().addScaledVector(tickPerp, SNOOKER_AIM_TICK_HALF_LENGTH), aimEnd.clone().addScaledVector(tickPerp, -SNOOKER_AIM_TICK_HALF_LENGTH), true);
      const followDir2 = prediction.cueDir ?? new THREE.Vector2(aimForward.x, aimForward.z);
      const followDir3 = new THREE.Vector3(followDir2.x, 0, followDir2.y).normalize();
      setGuideLine(cueAfterLine, aimEnd, snookerGuideEndFrom(aimEnd, followDir3, CFG.ballR * (7 + activePower * 12), aimY), true);
      if (prediction.targetBall && prediction.targetDir) {
        const targetStart = prediction.targetBall.mesh.getWorldPosition(new THREE.Vector3()).setY(aimY);
        const targetDir3 = new THREE.Vector3(prediction.targetDir.x, 0, prediction.targetDir.y).normalize();
        setGuideLine(targetLine, targetStart, snookerGuideEndFrom(targetStart, targetDir3, CFG.ballR * 2, aimY), true);
        targetLine.material.color.setHex(0xffd166);
      } else if (prediction.railNormal && prediction.cueDir) {
        setGuideLine(targetLine, aimEnd, snookerGuideEndFrom(aimEnd, followDir3, CFG.ballR * 2, aimY), true);
        targetLine.material.color.setHex(0x7ce7ff);
      } else {
        setGuideLine(targetLine, aimEnd, snookerGuideEndFrom(aimEnd, guideDir, CFG.ballR * 2, aimY), true);
        targetLine.material.color.setHex(0x9fd8ff);
      }
      const liveCameraMode = ballsMoving && cameraModeRef.current === 'rail-overhead' ? 'tv-broadcast' : cameraModeRef.current;
      const liveBroadcastMode = DEFAULT_BROADCAST_SYSTEM_ID;
      updateCamera(camera, liveCameraMode, liveBroadcastMode, cueBallWorld, aimForward, activePower, now, pocketPositions, { railSide: railOverheadSideRef.current, heightOffset: cameraHeightOffsetRef.current });
      renderer.render(scene, camera);
    }
    animate();
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', onCanvasDown);
      canvas.removeEventListener('pointermove', onCanvasMove);
      canvas.removeEventListener('pointerup', onCanvasUp);
      canvas.removeEventListener('pointercancel', onCanvasUp);
      canvas.removeEventListener('wheel', onCanvasWheel);
      disposed = true;
      disposeTableLoader();
      if (activeGroundedSkybox) {
        activeGroundedSkybox.parent?.remove(activeGroundedSkybox);
        activeGroundedSkybox.geometry?.dispose?.();
        activeGroundedSkybox.material?.dispose?.();
        activeGroundedSkybox = null;
      }
      if (scene.background === activeSkyboxMap) scene.background = null;
      if (scene.environment === activeEnvMap) scene.environment = null;
      activeSkyboxMap?.dispose?.();
      activeEnvMap?.dispose?.();
      renderer.dispose();
    };
  }, [activeCloth, activeClothColor, activeFrameRate.fps, activeFrameRate.pixelRatioCap, activeHdri, playBallHit, playCueHit, playPocket, textureId]);

  const resetSpin = () => {
    setSpin({ x: 0, y: 0 });
    if (spinDotRef.current) {
      spinDotRef.current.style.left = '50%';
      spinDotRef.current.style.top = '50%';
    }
  };
  const hudButton = 'pointer-events-auto rounded-full border border-white/15 bg-black/60 px-3 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-gray-100 shadow-[0_6px_18px_rgba(2,6,23,0.45)] transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70';
  const optionButtonClass = (active) => `w-full rounded-2xl border px-4 py-2 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${active ? 'border-emerald-300 bg-emerald-300/90 text-black shadow-[0_0_16px_rgba(16,185,129,0.55)]' : 'border-white/20 bg-white/10 text-white/80 hover:bg-white/20'}`;

  return (
    <div className="fixed inset-0 bg-[#0b0b0b] text-white">
      <div ref={hostRef} className="absolute inset-0">
        <canvas ref={canvasRef} className="block h-full w-full touch-none" />
      </div>
      <div className="pointer-events-none fixed inset-0 font-sans">
        <BottomLeftIcons
          onChat={() => setShowChat(true)}
          onGift={() => setShowGift(true)}
          className="fixed left-0 z-50 flex flex-col gap-2.5 -translate-x-2"
          style={{ bottom: `${POOL_ROYALE_HUD_DESKTOP.sideControlsBottom + sharedHudLiftPx}px` }}
          buttonClassName="pointer-events-auto flex h-[3.15rem] w-[3.15rem] flex-col items-center justify-center gap-1 rounded-[14px] border-none bg-transparent p-0 text-white shadow-none"
          iconClassName="text-[1.1rem] leading-none"
          labelClassName="text-[0.6rem] font-extrabold uppercase tracking-[0.08em]"
          chatIcon="💬"
          giftIcon="🎁"
          showInfo={false}
          showMute={false}
          order={isPortraitHud ? ['gift', 'chat'] : ['chat', 'gift']}
          actionOffsets={{ chat: 10, gift: 6 }}
        />

        <div
          className="pointer-events-none absolute z-50 flex flex-col gap-2.5 transition-opacity duration-200"
          style={{
            left: `${POOL_ROYALE_HUD_DESKTOP.sideControlsLeft}px`,
            bottom: `${POOL_ROYALE_HUD_DESKTOP.sideControlsBottom + sharedHudLiftPx + 118}px`,
            transform: `scale(${uiScale * 1.08})`,
            transformOrigin: 'bottom left'
          }}
        >
          <div className="pointer-events-auto mt-1 flex flex-col gap-2">
            <button
              type="button"
              aria-pressed={cameraMode === 'cue-follow' || cameraMode === 'tv-broadcast'}
              onClick={() => setCameraMode('cue-follow')}
              className={`flex h-12 w-12 items-center justify-center rounded-full border text-[11px] font-semibold uppercase tracking-[0.2em] shadow-[0_12px_32px_rgba(0,0,0,0.45)] backdrop-blur transition ${
                cameraMode === 'cue-follow' || cameraMode === 'tv-broadcast'
                  ? 'border-emerald-300 bg-emerald-300/20 text-emerald-100'
                  : 'border-white/30 bg-black/70 text-white hover:bg-black/60'
              }`}
              aria-label="Switch to 3D cue view"
            >
              <span aria-hidden="true">3D</span>
            </button>
            <button
              type="button"
              aria-pressed={cameraMode === 'top-2d'}
              onClick={() => setCameraMode('top-2d')}
              className={`flex h-12 w-12 items-center justify-center rounded-full border text-[11px] font-semibold uppercase tracking-[0.2em] shadow-[0_12px_32px_rgba(0,0,0,0.45)] backdrop-blur transition ${
                cameraMode === 'top-2d'
                  ? 'border-emerald-300 bg-emerald-300/20 text-emerald-100'
                  : 'border-white/30 bg-black/70 text-white hover:bg-black/60'
              }`}
              aria-label="Switch to 2D view"
            >
              <span aria-hidden="true">2D</span>
            </button>
            <button
              type="button"
              aria-pressed={cameraMode === 'rail-overhead'}
              onClick={() => {
                const isActiveRailView = cameraMode === 'rail-overhead';
                setCameraMode('rail-overhead');
                setRailOverheadSide((prev) => (isActiveRailView ? (prev === 'back' ? 'front' : 'back') : 'back'));
              }}
              className={`flex h-12 w-12 items-center justify-center rounded-full border text-[13px] font-semibold shadow-[0_12px_32px_rgba(0,0,0,0.45)] backdrop-blur transition ${
                cameraMode === 'rail-overhead'
                  ? 'border-emerald-300 bg-emerald-300/20 text-emerald-100'
                  : 'border-white/30 bg-black/70 text-white hover:bg-black/60'
              }`}
              aria-label="Switch rail overhead side"
            >
              <span aria-hidden="true" className="flex flex-col items-center leading-[0.8]">
                <span className={railOverheadSide === 'back' ? 'text-emerald-100' : 'text-white/65'}>▲</span>
                <span className={railOverheadSide === 'front' ? 'text-emerald-100' : 'text-white/65'}>▼</span>
              </span>
            </button>
            <button
              type="button"
              disabled={!hasReplay}
              onClick={() => {
                if (!hasReplay) return;
                replayStartedAtRef.current = performance.now();
                setReplayActive(true);
              }}
              className={`flex h-12 w-12 items-center justify-center rounded-full border text-[15px] font-semibold shadow-[0_12px_32px_rgba(0,0,0,0.45)] backdrop-blur transition ${
                replayActive
                  ? 'border-amber-200 bg-amber-300/25 text-amber-100'
                  : hasReplay
                    ? 'border-white/30 bg-black/70 text-white hover:bg-black/60'
                    : 'border-white/10 bg-black/45 text-white/35'
              }`}
              aria-label="Replay last snooker shot"
            >
              <span aria-hidden="true">↻</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setReplaySkipAll((prev) => {
                  const next = !prev;
                  replaySkipAllRef.current = next;
                  if (next) setReplayActive(false);
                  return next;
                });
              }}
              className={`flex h-12 w-12 items-center justify-center rounded-full border text-[10px] font-black uppercase tracking-[0.08em] shadow-[0_12px_32px_rgba(0,0,0,0.45)] backdrop-blur transition ${
                replaySkipAll
                  ? 'border-rose-300 bg-rose-500/25 text-rose-100'
                  : 'border-white/30 bg-black/70 text-white hover:bg-black/60'
              }`}
              aria-label="Skip all replays"
            >
              Skip
            </button>
          </div>
        </div>

        <div className="absolute left-1/2 top-4 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => setConfigOpen((prev) => !prev)}
            aria-expanded={configOpen}
            aria-controls="snooker-champion-config-panel"
            className={hudButton}
            aria-label={configOpen ? 'Close game settings menu' : 'Open game settings menu'}
          >
            <span className="text-lg leading-none" aria-hidden="true">☰</span> Menu
          </button>
          {configOpen ? (
            <div id="snooker-champion-config-panel" className="pointer-events-auto mt-2 max-h-[72vh] w-[min(92vw,26rem)] overflow-y-auto rounded-3xl border border-emerald-400/45 bg-slate-950/92 p-4 text-xs shadow-[0_24px_58px_rgba(0,0,0,0.68)] backdrop-blur">
              <div className="flex items-center justify-between gap-4">
                <span className="text-[10px] uppercase tracking-[0.45em] text-emerald-200/80">Snooker Champion Menu</span>
                <button type="button" onClick={() => setConfigOpen(false)} className="rounded-full p-1 text-white/70 transition hover:text-white" aria-label="Close setup">✕</button>
              </div>
              <div className="mt-3 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-[11px] font-semibold leading-relaxed text-emerald-50/85">
                Mirrors the Snooker Royal match package: the same GLB table, cushion/jaw mapping, cloth finish, balls, cameras, broadcast style, power slider, and spin controller.
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2" aria-label="Snooker Royal parity thumbnails">
                {SNOOKER_ROYAL_PARITY_MENU_THUMBNAILS.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-center">
                    <div className="mx-auto flex h-16 w-full items-center justify-center overflow-hidden rounded-xl border border-emerald-300/20 bg-gradient-to-br from-emerald-400/20 via-slate-900/70 to-black/80">
                      <img src={item.image} alt="" className="h-12 w-12 object-contain drop-shadow-[0_8px_18px_rgba(16,185,129,0.35)]" aria-hidden="true" />
                    </div>
                    <p className="mt-2 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-100">{item.label}</p>
                    <p className="mt-1 text-[9px] leading-snug text-white/55">{item.description}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-4">
                <div>
                  <h3 className="text-[10px] uppercase tracking-[0.35em] text-emerald-100/70">Replay broadcast</h3>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button type="button" disabled={!hasReplay} onClick={() => { if (hasReplay) { replayStartedAtRef.current = performance.now(); setReplayActive(true); } }} className={optionButtonClass(replayActive)}>
                      <span className="font-black uppercase tracking-[0.2em]">Replay shot</span>
                      <span className="mt-1 block text-[10px] uppercase tracking-[0.16em] opacity-70">Uses cue, rail, and pocket broadcast cameras.</span>
                    </button>
                    <button type="button" onClick={() => { setReplaySkipAll((prev) => { const next = !prev; replaySkipAllRef.current = next; if (next) setReplayActive(false); return next; }); setConfigOpen(false); }} className={optionButtonClass(replaySkipAll)}>
                      <span className="font-black uppercase tracking-[0.2em]">Replay off</span>
                      <span className="mt-1 block text-[10px] uppercase tracking-[0.16em] opacity-70">Turns off automatic Snooker Royal-style pot/foul replays.</span>
                    </button>
                  </div>
                </div>
                <div>
                  <h3 className="text-[10px] uppercase tracking-[0.35em] text-emerald-100/70">Graphics</h3>
                  <div className="mt-2 grid gap-2">
                    {FRAME_RATE_OPTIONS.map((option) => (
                      <button key={option.id} type="button" onClick={() => setFrameRateId(option.id)} aria-pressed={option.id === frameRateId} className={optionButtonClass(option.id === frameRateId)}>
                        <span className="flex items-center justify-between gap-2"><span className="font-black uppercase tracking-[0.2em]">{option.label}</span><span>{option.resolution}</span></span>
                        <span className="mt-1 block text-[10px] uppercase tracking-[0.16em] opacity-70">{option.description}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-[10px] uppercase tracking-[0.35em] text-emerald-100/70">HDRI Rooms</h3>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {hdriOptions.map((option) => (
                      <button key={option.id} type="button" onClick={() => setEnvironmentHdriId(option.id)} aria-pressed={option.id === environmentHdriId} className={optionButtonClass(option.id === environmentHdriId)}>
                        <span className="font-bold">{option.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-[10px] uppercase tracking-[0.35em] text-emerald-100/70">Cloth</h3>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {clothOptions.map((option) => (
                      <button key={option.id} type="button" onClick={() => setClothId(option.id)} aria-pressed={option.id === clothId} className={optionButtonClass(option.id === clothId)}>
                        <span className="inline-flex items-center gap-2"><span className="h-4 w-4 rounded-full border border-white/30" style={{ backgroundColor: `#${new THREE.Color(resolveClothColor(option)).getHexString()}` }} />{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-[10px] uppercase tracking-[0.35em] text-emerald-100/70">Table Textures</h3>
                  <div className="mt-2 grid gap-2">
                    {textureOptions.map((option) => (
                      <button key={option.id} type="button" onClick={() => setTextureId(option.id)} aria-pressed={option.id === textureId} className={optionButtonClass(option.id === textureId)}>
                        <span className="font-bold">{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-[10px] uppercase tracking-[0.35em] text-emerald-100/70">Cameras</h3>
                  <div className="mt-2 grid gap-2">
                    {CAMERA_MODE_OPTIONS.map((option) => (
                      <button key={option.id} type="button" onClick={() => setCameraMode(option.id)} aria-pressed={option.id === cameraMode} className={optionButtonClass(option.id === cameraMode)}>
                        <span className="font-bold">{option.label}</span><span className="mt-1 block opacity-70">{option.description}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-[10px] uppercase tracking-[0.35em] text-emerald-100/70">Broadcast Modes</h3>
                  <div className="mt-2 grid gap-2">
                    {BROADCAST_SYSTEM_OPTIONS.map((option) => (
                      <button key={option.id} type="button" onClick={() => setBroadcastSystemId(option.id)} aria-pressed={option.id === broadcastSystemId} className={optionButtonClass(option.id === broadcastSystemId)}>
                        <span className="flex items-center justify-between gap-2"><span className="font-bold">{option.label}</span><span className="text-[10px] opacity-70">{option.method}</span></span>
                        <span className="mt-1 block opacity-70">{option.description}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div
          className="absolute z-50 flex pointer-events-none justify-center"
          style={{
            left: isPortraitHud ? '1rem' : `${POOL_ROYALE_HUD_DESKTOP.bottomHudLeft}px`,
            right: isPortraitHud ? '1rem' : `${POOL_ROYALE_HUD_DESKTOP.bottomHudRight}px`,
            bottom: `${12 + sharedHudLiftPx}px`
          }}
        >
          <div style={{ transform: `scale(${uiScale})`, transformOrigin: 'bottom center' }} className="pointer-events-auto flex min-h-[3.35rem] max-w-[min(40rem,100%)] items-center justify-center gap-5 rounded-full border border-emerald-400/40 bg-black/70 py-3 pl-8 pr-10 text-white shadow-[0_12px_32px_rgba(0,0,0,0.45)] backdrop-blur">
            <div className="flex min-w-0 flex-col" data-player-index="0">
              <div className="flex min-w-0 items-center gap-2.5">
                <img
                  src={playerAvatar}
                  alt="player avatar"
                  className={`${avatarSizeClass} rounded-full object-cover transition-all duration-150 ${activePlayer === 0 ? 'ring-2 ring-emerald-200 shadow-[0_0_16px_rgba(16,185,129,0.55)]' : 'opacity-80'}`}
                />
                <span className={`${nameWidthClass} truncate ${nameTextClass} font-semibold tracking-wide`}>{playerName}</span>
              </div>
              <div className="mt-1 flex items-center gap-1 pl-1">
                {Array.from({ length: 5 }).map((_, index) => <span key={`player-red-${index}`} className="h-2 w-2 rounded-full bg-red-600/85" />)}
                <span className="h-2 w-2 rounded-full bg-yellow-300" />
                <span className="h-2 w-2 rounded-full bg-green-500" />
                <span className="h-2 w-2 rounded-full bg-blue-500" />
              </div>
            </div>
            <div className="flex items-center gap-2 text-base font-semibold">
              <span className="text-amber-300">{score}</span>
              <span className="text-white/50">-</span>
              <span>{opponentScore}</span>
            </div>
            <div className="flex min-w-0 flex-col text-sm" data-player-index="1">
              <div className="flex min-w-0 items-center gap-2.5">
                <img
                  src={opponentAvatar}
                  alt="opponent avatar"
                  className={`${avatarSizeClass} rounded-full object-cover transition-all duration-150 ${activePlayer === 1 ? 'ring-2 ring-emerald-200 shadow-[0_0_16px_rgba(16,185,129,0.55)]' : 'opacity-80'}`}
                />
                <span className={`${nameWidthClass} truncate ${nameTextClass} font-semibold tracking-wide`}>{opponentName}</span>
              </div>
              <div className="mt-1 flex items-center gap-1 pl-1">
                {Array.from({ length: 5 }).map((_, index) => <span key={`opponent-red-${index}`} className="h-2 w-2 rounded-full bg-red-900/70" />)}
                <span className="h-2 w-2 rounded-full bg-yellow-900/70" />
                <span className="h-2 w-2 rounded-full bg-green-900/70" />
                <span className="h-2 w-2 rounded-full bg-blue-900/70" />
              </div>
            </div>
          </div>
        </div>

        <div className="absolute left-3 top-3 max-w-[min(76vw,28rem)] rounded-2xl border border-emerald-300/20 bg-black/45 p-2 text-[11px] leading-relaxed text-white/75 shadow-xl backdrop-blur">
          <strong className="text-emerald-100">{gameTitle}</strong> • At table: <span className="font-black text-emerald-200">{activePlayer === 0 ? playerName : opponentName}</span> • Target: <span className="font-black text-emerald-200">{target}</span>
          {foul ? <><br /><span className="font-bold text-red-200">{foul}</span></> : null}
          <br />{tableStatus} • {humanStatus}
        </div>

        <div
          className="pointer-events-auto absolute z-40 h-[320px] w-[70px] touch-none select-none"
          style={{
            right: `${POOL_ROYALE_HUD_DESKTOP.sliderRight}px`,
            top: POOL_ROYALE_HUD_DESKTOP.sliderTop,
            transform: `translateY(-50%) scale(${uiScale})`,
            transformOrigin: 'top right'
          }}
          ref={sliderMountRef}
        />

        <div
          className="absolute pointer-events-auto z-40"
          style={{
            right: `${POOL_ROYALE_HUD_DESKTOP.spinRight}px`,
            bottom: `${POOL_ROYALE_HUD_DESKTOP.spinBottom + sharedHudLiftPx}px`,
            transform: `scale(${uiScale * 0.88})`,
            transformOrigin: 'bottom right'
          }}
        >
          <div
            id="spinBox"
            ref={spinPadRef}
            className="relative rounded-full border border-white/70 bg-white shadow-[0_18px_34px_rgba(0,0,0,0.45)] touch-none"
            style={{ width: `${SPIN_CONTROL_DIAMETER_PX}px`, height: `${SPIN_CONTROL_DIAMETER_PX}px` }}
            aria-label="Snooker Royal style spin controller"
          >
            <div
              id="spinDot"
              ref={spinDotRef}
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-600"
              style={{
                width: `${SPIN_DOT_DIAMETER_PX}px`,
                height: `${SPIN_DOT_DIAMETER_PX}px`,
                left: '50%',
                top: '50%'
              }}
            />
          </div>
        </div>
        {lastQuickMessage ? (
          <div className="pointer-events-none absolute left-1/2 top-24 z-40 -translate-x-1/2 rounded-full border border-white/15 bg-black/70 px-4 py-2 text-sm font-semibold text-white shadow-xl backdrop-blur">
            {lastQuickMessage}
          </div>
        ) : null}
        <QuickMessagePopup
          open={showChat}
          onClose={() => setShowChat(false)}
          onSend={(message) => {
            setLastQuickMessage(message);
            window.setTimeout(() => setLastQuickMessage(''), 2400);
          }}
          title="Quick chat"
          showCloseButton
          panelClassName="w-72 rounded-3xl border border-emerald-400/40 bg-slate-950/95 p-4 text-white shadow-2xl backdrop-blur"
          messageGridClassName="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto"
          messageButtonClassName="rounded-2xl border border-white/15 bg-white/10 px-2 py-1 text-xs text-white/85"
          messageButtonActiveClassName="border-emerald-300 bg-emerald-300/90 text-black"
          sendButtonClassName="mt-3 w-full rounded-full bg-emerald-300 px-3 py-2 text-sm font-black uppercase tracking-[0.2em] text-black"
        />
        <GiftPopup
          open={showGift}
          onClose={() => setShowGift(false)}
          players={giftPlayers}
          senderIndex={0}
          title="Send Gift"
          showCloseButton
          panelClassName="w-80 rounded-3xl border border-emerald-400/40 bg-slate-950/95 p-4 text-white shadow-2xl backdrop-blur"
          playerButtonClassName="flex w-full items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-2 py-1 text-sm text-white/85"
          playerButtonActiveClassName="border-emerald-300 bg-emerald-300/90 text-black"
          giftButtonClassName="flex items-center justify-center gap-1 rounded-2xl border border-white/15 bg-white/10 px-2 py-1 text-xs text-white/85"
        />
      </div>
    </div>
  );
}
