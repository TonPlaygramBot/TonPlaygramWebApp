import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
// Snooker uses its own slimmer power slider
import { SnookerPowerSlider } from '../../../../snooker-power-slider.js';
import '../../../../snooker-power-slider.css';
import {
  getTelegramUsername,
  getTelegramPhotoUrl
} from '../../utils/telegram.js';
import { FLAG_EMOJIS } from '../../utils/flagEmojis.js';
import { SnookerRules } from '../../../../src/rules/SnookerRules.ts';
import { useAimCalibration } from '../../hooks/useAimCalibration.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';

// --------------------------------------------------
// Pocket jaws
// --------------------------------------------------
const JAW_H = 3.0;
const JAW_T = 1.25;
const JAW_INNER_SCALE = 0.04;
const JAW_CENTER_PULL_SCALE = 0.045;
const SECTOR_SWEEP = Math.PI * 0.6;
const SECTOR_START = -SECTOR_SWEEP;
const SECTOR_END = SECTOR_SWEEP;
const jawMat = new THREE.MeshPhysicalMaterial({
  color: 0x111111,
  roughness: 0.35,
  metalness: 0.1,
  clearcoat: 0.4
});
function makeJawSector(
  R = POCKET_VIS_R,
  T = JAW_T,
  start = SECTOR_START,
  end = SECTOR_END
) {
  const outer = R + T;
  const inner = R + Math.max(T * 0.25, R * JAW_INNER_SCALE);
  const chamfer = Math.min((end - start) * 0.35, Math.PI * 0.18);
  const innerStart = end - chamfer;
  const innerEnd = start + chamfer;
  const s = new THREE.Shape();
  s.absarc(0, 0, outer, start, end, false);
  const innerStartVec = new THREE.Vector2(
    inner * Math.cos(innerStart),
    inner * Math.sin(innerStart)
  );
  s.lineTo(innerStartVec.x, innerStartVec.y);
  s.absarc(0, 0, inner, innerStart, innerEnd, true);
  const outerStartVec = new THREE.Vector2(
    outer * Math.cos(start),
    outer * Math.sin(start)
  );
  s.lineTo(outerStartVec.x, outerStartVec.y);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: JAW_H,
    bevelEnabled: false
  });
  geo.rotateX(-Math.PI / 2);
  geo.rotateY(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}
function addPocketJaws(parent, playW, playH) {
  const HALF_PLAY_W = playW * 0.5;
  const HALF_PLAY_H = playH * 0.5;
  const POCKET_MAP = [
    { id: 'corner_tl', type: 'corner', pos: [-HALF_PLAY_W, -HALF_PLAY_H] },
    { id: 'corner_tr', type: 'corner', pos: [HALF_PLAY_W, -HALF_PLAY_H] },
    { id: 'corner_bl', type: 'corner', pos: [-HALF_PLAY_W, HALF_PLAY_H] },
    { id: 'corner_br', type: 'corner', pos: [HALF_PLAY_W, HALF_PLAY_H] },
    { id: 'side_top', type: 'side', pos: [0, -HALF_PLAY_H] },
    { id: 'side_bottom', type: 'side', pos: [0, HALF_PLAY_H] }
  ];
  const jaws = [];
  const jawGeo = makeJawSector();
  const centerOffset = POCKET_VIS_R * JAW_CENTER_PULL_SCALE;
  for (const entry of POCKET_MAP) {
    const p = new THREE.Vector2(entry.pos[0], entry.pos[1]);
    const towardCenter2 = p.clone().multiplyScalar(-1).normalize();
    const pShift = p.clone().add(towardCenter2.multiplyScalar(centerOffset));
    const geom = jawGeo.clone();
    const jaw = new THREE.Mesh(geom, jawMat);
    jaw.castShadow = true;
    jaw.receiveShadow = true;
    jaw.position.set(pShift.x, TABLE_Y + POCKET_JAW_LIP_HEIGHT, pShift.y);
    jaw.lookAt(new THREE.Vector3(0, TABLE_Y, 0));
    parent.add(jaw);
    jaws.push(jaw);
  }
  return jaws;
}

/**
 * NEW SNOOKER GAME — fresh build (keep ONLY Guret for balls)
 * Per kërkesën tënde:
 *  • Kamera rotullohet si një person te tavolina (orbit e butë), me kënd pak të ulët, pa rënë në nivelin e cloth.
 *  • 6 gropa të prera realisht në cloth (Shape.holes + Extrude) + kapje (capture radius) → guret bien brenda.
 *  • Power slider i RI: i madh, djathtas ekranit, me gjest **PULL** (tërhiq POSHTË sa fort do → fuqi), dhe **gjuan në release**.
 *  • Playable: aiming line + tick, përplasje, kapje në xhepa, logjikë bazë snooker (reds→colour, pastaj colours in order, fouls, in‑hand).
 */

// --------------------------------------------------
// Config
// --------------------------------------------------
// separate scales for table and balls
// Dimensions enlarged for a roomier snooker table but globally reduced by 30%
const SIZE_REDUCTION = 0.7;
const GLOBAL_SIZE_FACTOR = 0.85 * SIZE_REDUCTION; // apply uniform 30% shrink from previous tuning
// shrink the entire 3D world to ~70% of its previous footprint while preserving
// the HUD scale and gameplay math that rely on worldScaleFactor conversions
const WORLD_SCALE = 0.85 * GLOBAL_SIZE_FACTOR * 0.7;
const BALL_SCALE = 1;
const TABLE_SCALE = 1.3;
const TABLE = {
  W: 66 * TABLE_SCALE,
  H: 132 * TABLE_SCALE,
  THICK: 1.8 * TABLE_SCALE,
  WALL: 2.6 * TABLE_SCALE
};
const PLAY_W = TABLE.W - 2 * TABLE.WALL;
const PLAY_H = TABLE.H - 2 * TABLE.WALL;
const ACTION_CAMERA_START_BLEND = 0;
const ACTION_CAMERA_VERTICAL_MIN_SCALE = 0.82;
const ACTION_CAMERA_VERTICAL_CURVE = 0.65;
const ACTION_CAMERA_VERTICAL_MAX_SCALE = 1.08;
const ACTION_CAMERA_LONG_SIDE_SCALE = Math.min(
  1,
  Math.max(0.62, PLAY_W / PLAY_H)
);
const ACTION_CAMERA_LONG_SIDE_CURVE = 2;
const ACTION_CAMERA_CORNER_PULLBACK = 0.18;
const ACTION_CAMERA_CORNER_CURVE = 1.35;
const BALL_R = 2 * BALL_SCALE;
const POCKET_R = BALL_R * 2; // pockets twice the ball radius
// slightly larger visual radius so rails align with pocket rings
const POCKET_VIS_R = POCKET_R / 0.85;
const BALL_CENTER_Y = BALL_R * 1.06; // lift balls slightly so a thin contact strip remains visible
const BALL_SEGMENTS = Object.freeze({ width: 28, height: 18 });
const BALL_GEOMETRY = new THREE.SphereGeometry(
  BALL_R,
  BALL_SEGMENTS.width,
  BALL_SEGMENTS.height
);
const BALL_MATERIAL_CACHE = new Map();
// Slightly faster surface to keep balls rolling realistically on the snooker cloth
// Slightly reduce per-frame friction so rolls feel livelier on high refresh
// rate displays (e.g. 90 Hz) instead of drifting into slow motion.
const FRICTION = 0.999;
const CUSHION_RESTITUTION = 0.99;
const STOP_EPS = 0.02;
const TARGET_FPS = 90;
const TARGET_FRAME_TIME_MS = 1000 / TARGET_FPS;
const MAX_FRAME_TIME_MS = TARGET_FRAME_TIME_MS * 3; // allow up to 3 frames of catch-up
const MIN_FRAME_SCALE = 1e-6; // prevent zero-length frames from collapsing physics updates
const CAPTURE_R = POCKET_R; // pocket capture radius
const CLOTH_THICKNESS = TABLE.THICK * 0.12; // render a thinner cloth so the playing surface feels lighter
const POCKET_JAW_LIP_HEIGHT =
  -TABLE.THICK + 0.025; // raise pocket rims so they sit level with the cushions
const POCKET_RECESS_DEPTH =
  BALL_R * 0.24; // keep the pocket throat visible without sinking the rim
const POCKET_CLOTH_TOP_RADIUS = POCKET_VIS_R * 0.88;
const POCKET_CLOTH_BOTTOM_RADIUS = POCKET_CLOTH_TOP_RADIUS * 0.6;
const POCKET_CLOTH_DEPTH = POCKET_RECESS_DEPTH * 1.05;
const POCKET_CAM = Object.freeze({
  triggerDist: CAPTURE_R * 3.8,
  dotThreshold: 0.3,
  minOutside: TABLE.WALL + POCKET_VIS_R * 0.95,
  maxOutside: BALL_R * 32,
  heightOffset: BALL_R * 5.1
});
const SPIN_STRENGTH = BALL_R * 0.9;
const SPIN_DECAY = 0.9;
const SPIN_ROLL_STRENGTH = BALL_R * 0.06;
const SPIN_ROLL_DECAY = 0.982;
// Base shot speed tuned for livelier pace while keeping slider sensitivity manageable.
const SHOT_BASE_SPEED = 3.3;
const SHOT_MIN_FACTOR = 0.25;
const SHOT_POWER_RANGE = 0.75;
// Make the four round legs taller to lift the entire table
// Increase scale so the table sits roughly twice as high and legs reach the rug
const LEG_SCALE = 6.2;
const LEG_HEIGHT_MULTIPLIER = 2.25;
const TABLE_LIFT = 3.0;
const TABLE_H = 0.75 * LEG_SCALE; // physical height of table used for legs/skirt
// raise overall table position so the longer legs are visible and the playfield sits higher off the floor
const TABLE_Y = -2 + (TABLE_H - 0.75) + TABLE_H + TABLE_LIFT;
const CUE_TIP_GAP = BALL_R * 1.45; // pull cue stick slightly farther back for a more natural stance
const CUE_Y = BALL_CENTER_Y; // keep cue stick level with the cue ball center
const CUE_TIP_RADIUS = (BALL_R / 0.0525) * 0.006 * 1.5;
const CUE_MARKER_RADIUS = CUE_TIP_RADIUS;
const CUE_MARKER_DEPTH = CUE_TIP_RADIUS * 0.2;
const CUE_BUTT_LIFT = BALL_R * 0.3;
const MAX_BACKSPIN_TILT = THREE.MathUtils.degToRad(8.5);
const MAX_SPIN_CONTACT_OFFSET = BALL_R * 0.72;
const MAX_SPIN_FORWARD = BALL_R * 0.88;
const MAX_SPIN_SIDE = BALL_R * 0.62;
const MAX_SPIN_VERTICAL = BALL_R * 0.48;
const SPIN_CLEARANCE_MARGIN = BALL_R * 0.4;
const SPIN_TIP_MARGIN = CUE_TIP_RADIUS * 1.6;
// angle for cushion cuts guiding balls into pockets
const CUSHION_CUT_ANGLE = 29;
const CUSHION_BACK_TRIM = 0.8; // trim 20% off the cushion back that meets the rails
const CUSHION_FACE_INSET = TABLE.WALL * 0.075; // align physics with cushion noses and tuck cushions a touch further in

// shared UI reduction factor so overlays and controls shrink alongside the table
const UI_SCALE = SIZE_REDUCTION;

// Updated colors for dark cloth and standard balls
// includes separate tones for rails, base wood and cloth markings
const RAIL_WOOD_COLOR = 0x4a2c18;
const BASE_WOOD_COLOR = 0x2f1b11;
const COLORS = Object.freeze({
  cloth: 0x55dd66,
  rail: RAIL_WOOD_COLOR,
  base: BASE_WOOD_COLOR,
  markings: 0xffffff,
  cue: 0xffffff,
  red: 0xff0000,
  yellow: 0xffff00,
  green: 0x006400,
  brown: 0x8b4513,
  blue: 0x0000ff,
  pink: 0xff69b4,
  black: 0x000000
});

function spotPositions(baulkZ) {
  const halfH = PLAY_H / 2;
  return {
    yellow: [-PLAY_W * 0.22, baulkZ],
    green: [PLAY_W * 0.22, baulkZ],
    brown: [0, baulkZ],
    blue: [0, 0],
    pink: [0, PLAY_H * 0.25],
    black: [0, halfH - PLAY_H * 0.09]
  };
}

// Kamera: lejojmë kënd më të ulët ndaj tavolinës, por mos shko kurrë krejt në nivel (limit ~0.5rad)
const STANDING_VIEW_PHI = 1.04;
const CUE_SHOT_PHI = Math.PI / 2 - 0.26;
const STANDING_VIEW_MARGIN = 0.72;
const STANDING_VIEW_FOV = 62;
const CAMERA = {
  fov: STANDING_VIEW_FOV,
  near: 0.1,
  far: 4000,
  minR: 20 * TABLE_SCALE * GLOBAL_SIZE_FACTOR * 0.82,
  maxR: 260 * TABLE_SCALE * GLOBAL_SIZE_FACTOR,
  minPhi: STANDING_VIEW_PHI,
  // keep the camera slightly above the horizontal plane but allow a lower sweep
  maxPhi: CUE_SHOT_PHI
};
const STANDING_VIEW = Object.freeze({
  phi: STANDING_VIEW_PHI,
  margin: STANDING_VIEW_MARGIN
});
const DEFAULT_RAIL_LIMIT_X = PLAY_W / 2 - BALL_R - CUSHION_FACE_INSET;
const DEFAULT_RAIL_LIMIT_Y = PLAY_H / 2 - BALL_R - CUSHION_FACE_INSET;
let RAIL_LIMIT_X = DEFAULT_RAIL_LIMIT_X;
let RAIL_LIMIT_Y = DEFAULT_RAIL_LIMIT_Y;
const RAIL_LIMIT_PADDING = 0.1;
const BREAK_VIEW = Object.freeze({
  radius: 102 * TABLE_SCALE * GLOBAL_SIZE_FACTOR * 0.68,
  phi: CAMERA.maxPhi - 0.22
});
const ACTION_VIEW = Object.freeze({
  phiOffset: 0,
  lockedPhi: null,
  fitMargin: 1.03,
  followWeight: 0.25,
  maxOffset: PLAY_W * 0.14
});
const ACTION_CAMERA = Object.freeze({
  phiLift: 0.08,
  thetaLerp: 0.25,
  switchDelay: 280,
  minSwitchInterval: 260,
  focusBlend: 0.45,
  focusClampRatio: 0.18,
  railMargin: TABLE.WALL * 0.65,
  verticalLift: TABLE.THICK * 3.15,
  switchThreshold: 0.08
});
const ACTION_CAMERA_RADIUS_SCALE = 0.76;
const ACTION_CAMERA_MIN_RADIUS = CAMERA.minR;
const ACTION_CAMERA_MIN_PHI = Math.min(
  CAMERA.maxPhi - 0.02,
  STANDING_VIEW_PHI + 0.02
);
const POCKET_IDLE_SWITCH_MS = 0;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TMP_SPIN = new THREE.Vector2();
const TMP_SPH = new THREE.Spherical();
const TMP_VEC2_A = new THREE.Vector2();
const TMP_VEC2_B = new THREE.Vector2();
const TMP_VEC2_C = new THREE.Vector2();
const TMP_VEC2_D = new THREE.Vector2();
const TMP_VEC2_SPIN = new THREE.Vector2();
const TMP_VEC2_LIMIT = new THREE.Vector2();
const TMP_VEC2_AXIS = new THREE.Vector2();
const CORNER_SIGNS = [
  { sx: -1, sy: -1 },
  { sx: 1, sy: -1 },
  { sx: -1, sy: 1 },
  { sx: 1, sy: 1 }
];
const fitRadius = (camera, margin = 1.1) => {
  const a = camera.aspect,
    f = THREE.MathUtils.degToRad(camera.fov);
  const halfW = (TABLE.W / 2) * margin,
    halfH = (TABLE.H / 2) * margin;
  const dzH = halfH / Math.tan(f / 2);
  const dzW = halfW / (Math.tan(f / 2) * a);
  // Nudge camera closer so the table fills more of the view
  const r = Math.max(dzH, dzW) * 0.6 * GLOBAL_SIZE_FACTOR;
  return clamp(r, CAMERA.minR, CAMERA.maxR);
};

const verticalZoomForBlend = (blend = 1) => {
  const t = THREE.MathUtils.clamp(blend ?? 1, 0, 1);
  const eased = Math.pow(t, ACTION_CAMERA_VERTICAL_CURVE);
  return THREE.MathUtils.lerp(
    ACTION_CAMERA_VERTICAL_MIN_SCALE,
    ACTION_CAMERA_VERTICAL_MAX_SCALE,
    eased
  );
};

const orientationScaleForTheta = (theta = 0) => {
  const sin = Math.abs(Math.sin(theta ?? 0));
  const cos = Math.abs(Math.cos(theta ?? 0));
  const longSideBias = Math.pow(sin, ACTION_CAMERA_LONG_SIDE_CURVE);
  const base = THREE.MathUtils.lerp(1, ACTION_CAMERA_LONG_SIDE_SCALE, longSideBias);
  const cornerBias = Math.pow(sin * cos, ACTION_CAMERA_CORNER_CURVE);
  const cornerScale = 1 + ACTION_CAMERA_CORNER_PULLBACK * cornerBias;
  return base * cornerScale;
};


// --------------------------------------------------
// Utilities
// --------------------------------------------------
const DEFAULT_SPIN_LIMITS = Object.freeze({
  minX: -1,
  maxX: 1,
  minY: -1,
  maxY: 1
});
const clampSpinValue = (value) => clamp(value, -1, 1);

function distanceToTableEdge(pos, dir) {
  let minT = Infinity;
  if (Math.abs(dir.x) > 1e-6) {
    const boundX = dir.x > 0 ? RAIL_LIMIT_X : -RAIL_LIMIT_X;
    const tx = (boundX - pos.x) / dir.x;
    if (tx > 0) minT = Math.min(minT, tx);
  }
  if (Math.abs(dir.y) > 1e-6) {
    const boundY = dir.y > 0 ? RAIL_LIMIT_Y : -RAIL_LIMIT_Y;
    const ty = (boundY - pos.y) / dir.y;
    if (ty > 0) minT = Math.min(minT, ty);
  }
  return minT;
}

function applyAxisClearance(limits, key, positive, clearance) {
  if (!Number.isFinite(clearance)) return;
  const safeClearance = clearance - SPIN_TIP_MARGIN;
  if (safeClearance <= 0) {
    if (positive) {
      if (key === 'maxX') limits.maxX = Math.min(limits.maxX, 0);
      if (key === 'maxY') limits.maxY = Math.min(limits.maxY, 0);
    } else {
      if (key === 'minX') limits.minX = Math.max(limits.minX, 0);
      if (key === 'minY') limits.minY = Math.max(limits.minY, 0);
    }
    return;
  }
  const normalized = clamp(safeClearance / MAX_SPIN_CONTACT_OFFSET, 0, 1);
  if (positive) {
    if (key === 'maxX') limits.maxX = Math.min(limits.maxX, normalized);
    if (key === 'maxY') limits.maxY = Math.min(limits.maxY, normalized);
  } else {
    const limit = -normalized;
    if (key === 'minX') limits.minX = Math.max(limits.minX, limit);
    if (key === 'minY') limits.minY = Math.max(limits.minY, limit);
  }
}

function computeSpinLimits(cueBall, aimDir, balls = []) {
  if (!cueBall || !aimDir) return { ...DEFAULT_SPIN_LIMITS };
  TMP_VEC2_AXIS.set(aimDir.x, aimDir.y);
  if (TMP_VEC2_AXIS.lengthSq() < 1e-8) TMP_VEC2_AXIS.set(0, 1);
  else TMP_VEC2_AXIS.normalize();
  TMP_VEC2_LIMIT.set(-TMP_VEC2_AXIS.y, TMP_VEC2_AXIS.x);
  if (TMP_VEC2_LIMIT.lengthSq() < 1e-8) TMP_VEC2_LIMIT.set(1, 0);
  else TMP_VEC2_LIMIT.normalize();
  const axes = [
    { key: 'maxX', dir: TMP_VEC2_LIMIT.clone(), positive: true },
    { key: 'minX', dir: TMP_VEC2_LIMIT.clone().multiplyScalar(-1), positive: false },
    { key: 'minY', dir: TMP_VEC2_AXIS.clone(), positive: false },
    { key: 'maxY', dir: TMP_VEC2_AXIS.clone().multiplyScalar(-1), positive: true }
  ];
  const limits = { ...DEFAULT_SPIN_LIMITS };

  for (const axis of axes) {
    const centerToEdge = distanceToTableEdge(cueBall.pos, axis.dir);
    if (centerToEdge !== Infinity) {
      const clearance = centerToEdge - BALL_R;
      applyAxisClearance(limits, axis.key, axis.positive, clearance);
    }
  }

  for (const ball of balls) {
    if (!ball || ball === cueBall) continue;
    if (ball.active === false) continue;
    TMP_VEC2_SPIN.copy(ball.pos).sub(cueBall.pos);
    const distSq = TMP_VEC2_SPIN.lengthSq();
    if (distSq < 1e-6) continue;
    const dist = Math.sqrt(distSq);
    for (const axis of axes) {
      const along = TMP_VEC2_SPIN.dot(axis.dir);
      if (along <= 0) continue;
      const lateralSq = distSq - along * along;
      const lateral = Math.sqrt(Math.max(lateralSq, 0));
      if (lateral >= BALL_R + SPIN_CLEARANCE_MARGIN) continue;
      const clearance = along - BALL_R * 2;
      applyAxisClearance(limits, axis.key, axis.positive, clearance);
    }
  }

  limits.minX = clampSpinValue(limits.minX);
  limits.maxX = clampSpinValue(limits.maxX);
  limits.minY = clampSpinValue(limits.minY);
  limits.maxY = clampSpinValue(limits.maxY);
  if (limits.minX > limits.maxX) limits.minX = limits.maxX = 0;
  if (limits.minY > limits.maxY) limits.minY = limits.maxY = 0;
  return limits;
}

const pocketCenters = () => [
  new THREE.Vector2(-PLAY_W / 2, -PLAY_H / 2),
  new THREE.Vector2(PLAY_W / 2, -PLAY_H / 2),
  new THREE.Vector2(-PLAY_W / 2, PLAY_H / 2),
  new THREE.Vector2(PLAY_W / 2, PLAY_H / 2),
  new THREE.Vector2(-PLAY_W / 2, 0),
  new THREE.Vector2(PLAY_W / 2, 0)
];
const allStopped = (balls) => balls.every((b) => b.vel.length() < STOP_EPS);

function makeClothTexture() {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#55dd66';
  ctx.fillRect(0, 0, size, size);

  const spacing = 1;
  for (let y = 0; y < size; y += spacing) {
    for (let x = 0; x < size; x += spacing) {
      ctx.fillStyle = (x + y) % (spacing * 2) === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.arc(x, y, 0.25, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  for (let i = 0; i < 600000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const angle = Math.random() * Math.PI * 2;
    const length = Math.random() * 0.6 + 0.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  const baseRepeat = 8;
  const repeatX = baseRepeat * (PLAY_W / TABLE.W);
  const repeatY = baseRepeat * (PLAY_H / TABLE.H);
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 32;
  if ('colorSpace' in texture) texture.colorSpace = THREE.SRGBColorSpace;
  else texture.encoding = THREE.sRGBEncoding;
  texture.minFilter = THREE.LinearMipMapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function makeWoodTexture({
  base = '#2d1a0f',
  mid = '#4b2c16',
  highlight = '#7a4a24',
  repeatX = 3,
  repeatY = 1.5
} = {}) {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const horizontal = ctx.createLinearGradient(0, 0, size, 0);
  horizontal.addColorStop(0, base);
  horizontal.addColorStop(0.5, mid);
  horizontal.addColorStop(1, base);
  ctx.fillStyle = horizontal;
  ctx.fillRect(0, 0, size, size);

  ctx.globalAlpha = 0.28;
  ctx.fillStyle = highlight;
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = 1;

  const tint = ctx.createLinearGradient(0, 0, 0, size);
  tint.addColorStop(0, 'rgba(255,255,255,0.08)');
  tint.addColorStop(1, 'rgba(0,0,0,0.32)');
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, size, size);

  ctx.lineWidth = size / 320;
  for (let y = 0; y < size; y += size / 64) {
    const wave = Math.sin(y * 0.045) * size * 0.012;
    const secondary = Math.cos(y * 0.11) * size * 0.008;
    ctx.strokeStyle = 'rgba(145, 95, 52, 0.28)';
    ctx.beginPath();
    ctx.moveTo(-wave, y + secondary);
    ctx.bezierCurveTo(
      size * 0.3,
      y + wave,
      size * 0.7,
      y - wave,
      size + wave,
      y + secondary
    );
    ctx.stroke();

    ctx.strokeStyle = 'rgba(35, 20, 10, 0.22)';
    ctx.beginPath();
    ctx.moveTo(-wave * 0.5, y + size / 128 + secondary * 0.5);
    ctx.bezierCurveTo(
      size * 0.3,
      y + wave * 0.5,
      size * 0.7,
      y - wave * 0.5,
      size + wave * 0.5,
      y + size / 128 + secondary * 0.5
    );
    ctx.stroke();
  }

  const pseudoRandom = (seed) => {
    const x = Math.sin(seed) * 43758.5453;
    return x - Math.floor(x);
  };

  for (let i = 0; i < 16; i++) {
    const cx = pseudoRandom(i * 12.9898) * size;
    const cy = pseudoRandom(i * 78.233) * size;
    const r = size * (0.015 + pseudoRandom(i * 3.7) * 0.035);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, 'rgba(70, 40, 20, 0.55)');
    grad.addColorStop(0.65, 'rgba(70, 40, 20, 0.26)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 8;
  if ('colorSpace' in texture) texture.colorSpace = THREE.SRGBColorSpace;
  else texture.encoding = THREE.sRGBEncoding;
  texture.needsUpdate = true;
  return texture;
}
function reflectRails(ball) {
  const limX = RAIL_LIMIT_X;
  const limY = RAIL_LIMIT_Y;
  const rad = THREE.MathUtils.degToRad(CUSHION_CUT_ANGLE);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const pocketGuard = POCKET_VIS_R * 0.85;
  const cornerDepthLimit = POCKET_VIS_R * 1.45;
  for (const { sx, sy } of CORNER_SIGNS) {
    TMP_VEC2_C.set(sx * limX, sy * limY);
    TMP_VEC2_B.set(-sx * cos, -sy * sin);
    TMP_VEC2_A.copy(ball.pos).sub(TMP_VEC2_C);
    const distNormal = TMP_VEC2_A.dot(TMP_VEC2_B);
    if (distNormal >= BALL_R) continue;
    TMP_VEC2_D.set(-TMP_VEC2_B.y, TMP_VEC2_B.x);
    const lateral = Math.abs(TMP_VEC2_A.dot(TMP_VEC2_D));
    if (lateral < pocketGuard) continue;
    if (distNormal < -cornerDepthLimit) continue;
    const push = BALL_R - distNormal;
    ball.pos.addScaledVector(TMP_VEC2_B, push);
    const vn = ball.vel.dot(TMP_VEC2_B);
    if (vn < 0) {
      ball.vel.addScaledVector(TMP_VEC2_B, -2 * vn);
    }
    ball.vel.multiplyScalar(0.2);
    if (ball.spin?.lengthSq() > 0) {
      applySpinImpulse(ball, 0.6);
    }
    return 'corner';
  }

  // If the ball is entering a pocket capture zone, skip straight rail reflections
  const nearPocket = pocketCenters().some(
    (c) => ball.pos.distanceTo(c) < POCKET_VIS_R + BALL_R * 0.5
  );
  if (nearPocket) return null;
  let collided = null;
  if (ball.pos.x < -limX && ball.vel.x < 0) {
    const overshoot = -limX - ball.pos.x;
    ball.pos.x = -limX + overshoot;
    ball.vel.x = Math.abs(ball.vel.x) * CUSHION_RESTITUTION;
    collided = 'rail';
  }
  if (ball.pos.x > limX && ball.vel.x > 0) {
    const overshoot = ball.pos.x - limX;
    ball.pos.x = limX - overshoot;
    ball.vel.x = -Math.abs(ball.vel.x) * CUSHION_RESTITUTION;
    collided = 'rail';
  }
  if (ball.pos.y < -limY && ball.vel.y < 0) {
    const overshoot = -limY - ball.pos.y;
    ball.pos.y = -limY + overshoot;
    ball.vel.y = Math.abs(ball.vel.y) * CUSHION_RESTITUTION;
    collided = 'rail';
  }
  if (ball.pos.y > limY && ball.vel.y > 0) {
    const overshoot = ball.pos.y - limY;
    ball.pos.y = limY - overshoot;
    ball.vel.y = -Math.abs(ball.vel.y) * CUSHION_RESTITUTION;
    collided = 'rail';
  }
  return collided;
}

function applySpinImpulse(ball, scale = 1) {
  if (!ball?.spin) return false;
  if (ball.spin.lengthSq() < 1e-6) return false;
  TMP_SPIN.copy(ball.spin).multiplyScalar(SPIN_STRENGTH * scale);
  ball.vel.add(TMP_SPIN);
  const decayFactor = Math.pow(SPIN_DECAY, Math.max(scale, 0.5));
  ball.spin.multiplyScalar(decayFactor);
  if (ball.spin.lengthSq() < 1e-6) {
    ball.spin.set(0, 0);
  }
  return true;
}

// calculate impact point and post-collision direction for aiming guide
function calcTarget(cue, dir, balls) {
  const cuePos = cue.pos.clone();
  let tHit = Infinity;
  let targetBall = null;
  let railNormal = null;

  const limX = RAIL_LIMIT_X;
  const limY = RAIL_LIMIT_Y;
  const checkRail = (t, normal) => {
    if (t >= 0 && t < tHit) {
      tHit = t;
      railNormal = normal;
      targetBall = null;
    }
  };
  if (dir.x < 0) checkRail((-limX - cuePos.x) / dir.x, new THREE.Vector2(1, 0));
  if (dir.x > 0) checkRail((limX - cuePos.x) / dir.x, new THREE.Vector2(-1, 0));
  if (dir.y < 0) checkRail((-limY - cuePos.y) / dir.y, new THREE.Vector2(0, 1));
  if (dir.y > 0) checkRail((limY - cuePos.y) / dir.y, new THREE.Vector2(0, -1));

  const diam = BALL_R * 2;
  const diam2 = diam * diam;
  balls.forEach((b) => {
    if (!b.active || b === cue) return;
    const v = b.pos.clone().sub(cuePos);
    const proj = v.dot(dir);
    if (proj <= 0) return;
    const perp2 = v.lengthSq() - proj * proj;
    if (perp2 > diam2) return;
    const thc = Math.sqrt(diam2 - perp2);
    const t = proj - thc;
    if (t >= 0 && t < tHit) {
      tHit = t;
      targetBall = b;
      railNormal = null;
    }
  });

  const impact = cuePos.clone().add(dir.clone().multiplyScalar(tHit));
  let afterDir = null;
  if (targetBall) {
    afterDir = targetBall.pos.clone().sub(impact).normalize();
  } else if (railNormal) {
    const n = railNormal.clone().normalize();
    afterDir = dir
      .clone()
      .sub(n.clone().multiplyScalar(2 * dir.dot(n)))
      .normalize();
  }
  return { impact, afterDir, targetBall, railNormal, tHit };
}

// --------------------------------------------------
// ONLY kept component: Guret (balls factory)
// --------------------------------------------------
function Guret(parent, id, color, x, y) {
  if (!BALL_MATERIAL_CACHE.has(color)) {
    BALL_MATERIAL_CACHE.set(
      color,
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.28,
        metalness: 0.35,
        envMapIntensity: 0.6
      })
    );
  }
  const material = BALL_MATERIAL_CACHE.get(color);
  const mesh = new THREE.Mesh(BALL_GEOMETRY, material);
  mesh.position.set(x, BALL_CENTER_Y, y);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (id === 'cue') {
    const markerGeom = new THREE.CircleGeometry(CUE_MARKER_RADIUS, 48);
    const markerMat = new THREE.MeshStandardMaterial({
      color: 0xff2f2f,
      emissive: 0x550000,
      roughness: 0.28,
      metalness: 0.05,
      side: THREE.DoubleSide
    });
    markerMat.depthWrite = false;
    markerMat.needsUpdate = true;
    const markerOffset = BALL_R - CUE_MARKER_DEPTH * 0.5;
    const localForward = new THREE.Vector3(0, 0, 1);
    [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, -1)
    ].forEach((normal) => {
      const marker = new THREE.Mesh(markerGeom, markerMat);
      marker.position.copy(normal).multiplyScalar(markerOffset);
      marker.quaternion.setFromUnitVectors(localForward, normal);
      marker.castShadow = false;
      marker.receiveShadow = false;
      marker.renderOrder = 2;
      mesh.add(marker);
    });
  }
  mesh.traverse((node) => {
    node.userData = node.userData || {};
    node.userData.ballId = id;
  });
  parent.add(mesh);
  return {
    id,
    color,
    mesh,
    pos: new THREE.Vector2(x, y),
    vel: new THREE.Vector2(),
    spin: new THREE.Vector2(),
    impacted: false,
    active: true
  };
}

function alignRailsToCushions(table, frame) {
  if (!frame || !table?.userData?.cushions?.length) return;
  table.updateMatrixWorld(true);
  const sampleCushion = table.userData.cushions[0];
  if (!sampleCushion) return;
  const cushionBox = new THREE.Box3().setFromObject(sampleCushion);
  const frameBox = new THREE.Box3().setFromObject(frame);
  const diff = frameBox.max.y - cushionBox.max.y;
  if (diff > 0.001) {
    frame.position.y -= diff;
  }
}

function updateRailLimitsFromTable(table) {
  if (!table?.userData?.cushions?.length) return;
  table.updateMatrixWorld(true);
  let minAbsX = Infinity;
  let minAbsZ = Infinity;
  for (const cushion of table.userData.cushions) {
    const data = cushion.userData || {};
    if (typeof data.horizontal !== 'boolean' || !data.side) continue;
    const box = new THREE.Box3().setFromObject(cushion);
    if (data.horizontal) {
      const inner = data.side < 0 ? box.max.z : box.min.z;
      minAbsZ = Math.min(minAbsZ, Math.abs(inner));
    } else {
      const inner = data.side < 0 ? box.max.x : box.min.x;
      minAbsX = Math.min(minAbsX, Math.abs(inner));
    }
  }
  if (minAbsX !== Infinity) {
    const computedX = Math.max(0, minAbsX - BALL_R - RAIL_LIMIT_PADDING);
    if (computedX > 0) {
      RAIL_LIMIT_X = Math.min(DEFAULT_RAIL_LIMIT_X, computedX);
    }
  }
  if (minAbsZ !== Infinity) {
    const computedZ = Math.max(0, minAbsZ - BALL_R - RAIL_LIMIT_PADDING);
    if (computedZ > 0) {
      RAIL_LIMIT_Y = Math.min(DEFAULT_RAIL_LIMIT_Y, computedZ);
    }
  }
}

// --------------------------------------------------
// Table with CUT pockets + markings (fresh)
// --------------------------------------------------

function Table3D(parent) {
  const table = new THREE.Group();
  const clothBevel = CLOTH_THICKNESS * 0.45;
  const halfW = PLAY_W / 2 + clothBevel;
  const halfH = PLAY_H / 2 + clothBevel;

  const clothMat = new THREE.MeshStandardMaterial({
    color: COLORS.cloth,
    roughness: 0.68,
    metalness: 0.06,
    envMapIntensity: 0.35,
    emissive: new THREE.Color(COLORS.cloth).multiplyScalar(0.09),
    emissiveIntensity: 0.94
  });
  const clothTexture = makeClothTexture();
  if (clothTexture) {
    clothMat.map = clothTexture;
    clothMat.bumpMap = clothTexture;
    clothMat.bumpScale = 0.12;
    clothMat.needsUpdate = true;
  }
  const cushionMat = clothMat.clone();
  if (clothTexture) {
    cushionMat.map = clothTexture;
    cushionMat.bumpMap = clothTexture;
    cushionMat.bumpScale = clothMat.bumpScale * 1.4;
    cushionMat.needsUpdate = true;
  }
  cushionMat.color = new THREE.Color(COLORS.cloth).multiplyScalar(1.05);
  cushionMat.roughness = Math.min(1, clothMat.roughness * 1.05);
  cushionMat.metalness = Math.max(0.04, clothMat.metalness * 0.75);
  const clothCutMat = new THREE.MeshStandardMaterial({
    color: 0x040404,
    roughness: Math.min(1, clothMat.roughness * 1.15),
    metalness: Math.max(0.04, clothMat.metalness * 0.4),
    side: THREE.DoubleSide
  });
  const railWoodMat = new THREE.MeshStandardMaterial({
    color: COLORS.rail,
    metalness: 0.25,
    roughness: 0.55
  });
  const woodMat = new THREE.MeshStandardMaterial({
    color: COLORS.base,
    metalness: 0.2,
    roughness: 0.8
  });

  const railWoodTexture = makeWoodTexture({
    base: '#3b2212',
    mid: '#553218',
    highlight: '#8d5a2d',
    repeatX: 4,
    repeatY: 1.6
  });
  if (railWoodTexture) {
    railWoodMat.map = railWoodTexture;
    railWoodMat.roughness = 0.48;
    railWoodMat.metalness = 0.2;
    railWoodMat.needsUpdate = true;
  }
  const baseWoodTexture = makeWoodTexture({
    base: '#1d1007',
    mid: '#3f2211',
    highlight: '#8a562a',
    repeatX: 2.4,
    repeatY: 1.35
  });
  if (baseWoodTexture) {
    woodMat.map = baseWoodTexture;
    woodMat.bumpMap = baseWoodTexture;
    woodMat.bumpScale = 0.32;
    woodMat.roughness = 0.56;
    woodMat.metalness = 0.17;
    woodMat.needsUpdate = true;
  }

  const shape = new THREE.Shape();
  shape.moveTo(-halfW, -halfH);
  shape.lineTo(halfW, -halfH);
  shape.lineTo(halfW, halfH);
  shape.lineTo(-halfW, halfH);
  shape.lineTo(-halfW, -halfH);
  pocketCenters().forEach((p) => {
    const h = new THREE.Path();
    h.absellipse(p.x, p.y, POCKET_CLOTH_TOP_RADIUS, POCKET_CLOTH_TOP_RADIUS, 0, Math.PI * 2);
    shape.holes.push(h);
  });
  const clothGeo = new THREE.ExtrudeGeometry(shape, {
    depth: CLOTH_THICKNESS,
    bevelEnabled: true,
    bevelThickness: clothBevel,
    bevelSize: clothBevel,
    bevelSegments: 3
  });
  clothGeo.translate(0, 0, TABLE.THICK - CLOTH_THICKNESS);
  const cloth = new THREE.Mesh(clothGeo, [clothMat, clothCutMat]);
  cloth.rotation.x = -Math.PI / 2;
  cloth.position.y = -TABLE.THICK;
  cloth.renderOrder = 0;
  table.add(cloth);

  const pocketApronMat = clothMat.clone();
  pocketApronMat.color = new THREE.Color(COLORS.cloth).multiplyScalar(1.12);
  pocketApronMat.roughness = Math.min(1, clothMat.roughness * 0.9);
  pocketApronMat.metalness = clothMat.metalness;
  pocketApronMat.envMapIntensity = clothMat.envMapIntensity;
  pocketApronMat.side = THREE.DoubleSide;
  pocketApronMat.needsUpdate = true;

  const pocketLipMat = new THREE.MeshStandardMaterial({
    color: 0x050505,
    roughness: Math.min(1, clothMat.roughness * 1.1),
    metalness: 0.08,
    side: THREE.DoubleSide
  });
  pocketLipMat.needsUpdate = true;
  const pocketInteriorMat = new THREE.MeshStandardMaterial({
    color: 0x050505,
    roughness: 0.92,
    metalness: 0.08,
    side: THREE.DoubleSide
  });
  pocketInteriorMat.needsUpdate = true;
  pocketCenters().forEach((p) => {
    const baseY = POCKET_JAW_LIP_HEIGHT;
    const lipDepth = CLOTH_THICKNESS * 0.6;
    const sleeveDepth = Math.max(POCKET_CLOTH_DEPTH - lipDepth, 0);
    const lipGeo = new THREE.CylinderGeometry(
      POCKET_CLOTH_TOP_RADIUS,
      POCKET_CLOTH_TOP_RADIUS * 0.94,
      lipDepth,
      48,
      1,
      true
    );
    lipGeo.translate(0, -lipDepth / 2, 0);
    const lip = new THREE.Mesh(lipGeo, pocketLipMat);
    lip.position.set(p.x, baseY, p.y);
    lip.castShadow = false;
    lip.receiveShadow = true;
    table.add(lip);

    if (sleeveDepth > 0.001) {
      const sleeveGeo = new THREE.CylinderGeometry(
        POCKET_CLOTH_TOP_RADIUS * 0.94,
        POCKET_CLOTH_BOTTOM_RADIUS,
        sleeveDepth,
        48,
        1,
        true
      );
      sleeveGeo.translate(0, -(lipDepth + sleeveDepth / 2), 0);
      const sleeve = new THREE.Mesh(sleeveGeo, pocketInteriorMat);
      sleeve.position.set(p.x, baseY, p.y);
      sleeve.castShadow = false;
      sleeve.receiveShadow = true;
      table.add(sleeve);
    }

    const dropDepth = POCKET_CLOTH_DEPTH * 2.2;
    const dropGeo = new THREE.CylinderGeometry(
      POCKET_CLOTH_TOP_RADIUS * 0.7,
      POCKET_CLOTH_BOTTOM_RADIUS * 0.4,
      dropDepth,
      40,
      1,
      true
    );
    dropGeo.translate(0, -(lipDepth + sleeveDepth + dropDepth / 2), 0);
    const drop = new THREE.Mesh(dropGeo, pocketInteriorMat);
    drop.position.set(p.x, baseY, p.y);
    drop.castShadow = false;
    drop.receiveShadow = true;
    table.add(drop);

    const dropCap = new THREE.Mesh(
      new THREE.CircleGeometry(POCKET_CLOTH_BOTTOM_RADIUS * 0.5, 40),
      pocketInteriorMat
    );
    dropCap.rotation.x = -Math.PI / 2;
    dropCap.position.set(
      p.x,
      baseY - (lipDepth + sleeveDepth + dropDepth),
      p.y
    );
    dropCap.renderOrder = 1;
    table.add(dropCap);

    const apronHeight = CLOTH_THICKNESS * 0.65;
    const dir = new THREE.Vector2(-p.x, -p.y);
    if (dir.lengthSq() < 1e-6) dir.set(0, 1);
    const apronAngle = dir.angle();
    const apronSweep = Math.PI * 0.78;
    const apronStart = apronAngle - apronSweep / 2;
    const apronGeo = new THREE.CylinderGeometry(
      POCKET_CLOTH_TOP_RADIUS * 1.02,
      POCKET_CLOTH_TOP_RADIUS * 0.92,
      apronHeight,
      48,
      1,
      true,
      apronStart,
      apronSweep
    );
    apronGeo.translate(0, -apronHeight / 2, 0);
    const apron = new THREE.Mesh(apronGeo, pocketApronMat);
    apron.position.set(p.x, baseY + CLOTH_THICKNESS * 0.02, p.y);
    apron.castShadow = false;
    apron.receiveShadow = true;
    apron.renderOrder = 4;
    table.add(apron);

    const clothMask = new THREE.Mesh(
      new THREE.CircleGeometry(POCKET_CLOTH_TOP_RADIUS * 0.99, 64),
      new THREE.MeshBasicMaterial({
        color: 0x020202,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 1,
        depthWrite: false
      })
    );
    clothMask.rotation.x = -Math.PI / 2;
    clothMask.position.set(p.x, baseY + CLOTH_THICKNESS * 0.02, p.y);
    clothMask.renderOrder = 5;
    clothMask.material.depthTest = true;
    clothMask.material.polygonOffset = true;
    clothMask.material.polygonOffsetFactor = -1;
    clothMask.material.polygonOffsetUnits = -6;
    table.add(clothMask);
  });

  const toneCanvas = document.createElement('canvas');
  toneCanvas.width = 1024;
  toneCanvas.height = 2048;
  const toneCtx = toneCanvas.getContext('2d');
  if (toneCtx) {
    toneCtx.clearRect(0, 0, toneCanvas.width, toneCanvas.height);

    const edgeFalloffX = toneCanvas.width * 0.08;
    const edgeFalloffY = toneCanvas.height * 0.05;
    const deepShadow = 'rgba(0, 0, 0, 0.32)';
    const fade = 'rgba(0, 0, 0, 0)';

    let grad = toneCtx.createLinearGradient(0, 0, edgeFalloffX, 0);
    grad.addColorStop(0, deepShadow);
    grad.addColorStop(1, fade);
    toneCtx.fillStyle = grad;
    toneCtx.fillRect(0, 0, edgeFalloffX, toneCanvas.height);

    grad = toneCtx.createLinearGradient(
      toneCanvas.width,
      0,
      toneCanvas.width - edgeFalloffX,
      0
    );
    grad.addColorStop(0, deepShadow);
    grad.addColorStop(1, fade);
    toneCtx.fillStyle = grad;
    toneCtx.fillRect(
      toneCanvas.width - edgeFalloffX,
      0,
      edgeFalloffX,
      toneCanvas.height
    );

    grad = toneCtx.createLinearGradient(0, 0, 0, edgeFalloffY);
    grad.addColorStop(0, deepShadow);
    grad.addColorStop(1, fade);
    toneCtx.fillStyle = grad;
    toneCtx.fillRect(0, 0, toneCanvas.width, edgeFalloffY);

    grad = toneCtx.createLinearGradient(
      0,
      toneCanvas.height,
      0,
      toneCanvas.height - edgeFalloffY
    );
    grad.addColorStop(0, deepShadow);
    grad.addColorStop(1, fade);
    toneCtx.fillStyle = grad;
    toneCtx.fillRect(0, toneCanvas.height - edgeFalloffY, toneCanvas.width, edgeFalloffY);

    const highlightX = edgeFalloffX * 0.35;
    const highlightY = edgeFalloffY * 0.35;
    const highlightTint = 'rgba(255, 255, 255, 0.08)';

    grad = toneCtx.createLinearGradient(edgeFalloffX, 0, edgeFalloffX + highlightX, 0);
    grad.addColorStop(0, highlightTint);
    grad.addColorStop(1, fade);
    toneCtx.fillStyle = grad;
    toneCtx.fillRect(edgeFalloffX, 0, highlightX, toneCanvas.height);

    grad = toneCtx.createLinearGradient(
      toneCanvas.width - edgeFalloffX,
      0,
      toneCanvas.width - edgeFalloffX - highlightX,
      0
    );
    grad.addColorStop(0, highlightTint);
    grad.addColorStop(1, fade);
    toneCtx.fillStyle = grad;
    toneCtx.fillRect(
      toneCanvas.width - edgeFalloffX - highlightX,
      0,
      highlightX,
      toneCanvas.height
    );

    grad = toneCtx.createLinearGradient(0, edgeFalloffY, 0, edgeFalloffY + highlightY);
    grad.addColorStop(0, highlightTint);
    grad.addColorStop(1, fade);
    toneCtx.fillStyle = grad;
    toneCtx.fillRect(0, edgeFalloffY, toneCanvas.width, highlightY);

    grad = toneCtx.createLinearGradient(
      0,
      toneCanvas.height - edgeFalloffY,
      0,
      toneCanvas.height - edgeFalloffY - highlightY
    );
    grad.addColorStop(0, highlightTint);
    grad.addColorStop(1, fade);
    toneCtx.fillStyle = grad;
    toneCtx.fillRect(
      0,
      toneCanvas.height - edgeFalloffY - highlightY,
      toneCanvas.width,
      highlightY
    );

    // Subtle inward bend tone where the cloth rolls into the cushions
    const bendDepth = toneCanvas.height * 0.032;
    const bendTint = 'rgba(18, 64, 38, 0.18)';
    const bendHighlight = 'rgba(70, 200, 120, 0.12)';
    const edges = [
      { x: 0, y: 0, w: toneCanvas.width, h: bendDepth },
      { x: 0, y: toneCanvas.height - bendDepth, w: toneCanvas.width, h: bendDepth },
      { x: 0, y: 0, w: bendDepth, h: toneCanvas.height },
      {
        x: toneCanvas.width - bendDepth,
        y: 0,
        w: bendDepth,
        h: toneCanvas.height
      }
    ];
    toneCtx.fillStyle = bendTint;
    edges.forEach((edge) => {
      toneCtx.fillRect(edge.x, edge.y, edge.w, edge.h);
    });
    toneCtx.globalCompositeOperation = 'screen';
    toneCtx.fillStyle = bendHighlight;
    edges.forEach((edge) => {
      toneCtx.fillRect(edge.x, edge.y, edge.w, edge.h);
    });
    toneCtx.globalCompositeOperation = 'source-over';

    const curveShade = 'rgba(6, 20, 12, 0.24)';
    const curveFade = 'rgba(0, 0, 0, 0)';
    const horizontalThickness = toneCanvas.height * 0.028;
    const horizontalDepth = horizontalThickness * 0.35;
    const verticalThickness = toneCanvas.width * 0.028;
    const verticalDepth = verticalThickness * 0.35;

    const drawHorizontalVCurve = (offset, flip = false) => {
      toneCtx.save();
      if (flip) {
        toneCtx.translate(0, toneCanvas.height);
        toneCtx.scale(1, -1);
      }
      toneCtx.translate(0, offset);
      const grad = toneCtx.createLinearGradient(0, 0, 0, horizontalThickness);
      grad.addColorStop(0, curveShade);
      grad.addColorStop(1, curveFade);
      toneCtx.fillStyle = grad;
      toneCtx.beginPath();
      toneCtx.moveTo(0, 0);
      toneCtx.quadraticCurveTo(
        toneCanvas.width / 2,
        horizontalDepth,
        toneCanvas.width,
        0
      );
      toneCtx.lineTo(toneCanvas.width, horizontalThickness);
      toneCtx.quadraticCurveTo(
        toneCanvas.width / 2,
        horizontalThickness + horizontalDepth * 0.4,
        0,
        horizontalThickness
      );
      toneCtx.closePath();
      toneCtx.fill();
      toneCtx.restore();
    };

    const drawVerticalVCurve = (offset, flip = false) => {
      toneCtx.save();
      if (flip) {
        toneCtx.translate(toneCanvas.width, 0);
        toneCtx.scale(-1, 1);
      }
      toneCtx.translate(offset, 0);
      const grad = toneCtx.createLinearGradient(0, 0, verticalThickness, 0);
      grad.addColorStop(0, curveShade);
      grad.addColorStop(1, curveFade);
      toneCtx.fillStyle = grad;
      toneCtx.beginPath();
      toneCtx.moveTo(0, 0);
      toneCtx.quadraticCurveTo(
        verticalDepth,
        toneCanvas.height / 2,
        0,
        toneCanvas.height
      );
      toneCtx.lineTo(verticalThickness, toneCanvas.height);
      toneCtx.quadraticCurveTo(
        verticalThickness + verticalDepth * 0.4,
        toneCanvas.height / 2,
        verticalThickness,
        0
      );
      toneCtx.closePath();
      toneCtx.fill();
      toneCtx.restore();
    };

    drawHorizontalVCurve(edgeFalloffY * 0.35);
    drawHorizontalVCurve(edgeFalloffY * 0.35, true);
    drawVerticalVCurve(edgeFalloffX * 0.35);
    drawVerticalVCurve(edgeFalloffX * 0.35, true);

    // Brand-new strip tucked below the cushions that never sees play
    const stripDepth = toneCanvas.height * 0.022;
    const stripTint = 'rgba(50, 150, 90, 0.16)';
    toneCtx.fillStyle = stripTint;
    toneCtx.fillRect(0, stripDepth, toneCanvas.width, stripDepth * 0.65);
    toneCtx.fillRect(
      0,
      toneCanvas.height - stripDepth * 1.65,
      toneCanvas.width,
      stripDepth * 0.65
    );
    toneCtx.fillRect(stripDepth, 0, stripDepth * 0.65, toneCanvas.height);
    toneCtx.fillRect(
      toneCanvas.width - stripDepth * 1.65,
      0,
      stripDepth * 0.65,
      toneCanvas.height
    );

    const toCanvas = (p) => ({
      x: ((p.x + halfW) / (halfW * 2)) * toneCanvas.width,
      y: ((p.y + halfH) / (halfH * 2)) * toneCanvas.height
    });
    const pocketRadius = Math.max(toneCanvas.width, toneCanvas.height) * 0.06;
    const pocketCore = pocketRadius * 0.3;
    pocketCenters().forEach((p) => {
      const { x, y } = toCanvas(p);
    const pocketGrad = toneCtx.createRadialGradient(
      x,
      y,
      pocketCore,
      x,
      y,
      pocketRadius
    );
    pocketGrad.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
    pocketGrad.addColorStop(0.55, 'rgba(0, 0, 0, 0.32)');
    pocketGrad.addColorStop(0.86, 'rgba(0, 0, 0, 0.12)');
    pocketGrad.addColorStop(1, fade);
    toneCtx.fillStyle = pocketGrad;
    toneCtx.beginPath();
    toneCtx.arc(x, y, pocketRadius, 0, Math.PI * 2);
    toneCtx.closePath();
    toneCtx.fill();

    toneCtx.save();
    toneCtx.translate(x, y);
    const dirX = -p.x;
    const dirY = -p.y;
    const angle = Math.atan2(dirY, dirX);
    toneCtx.rotate(angle);
    const highlightWidth = pocketRadius * 0.42;
    const highlightLength = pocketRadius * 0.92;
    const highlightGrad = toneCtx.createLinearGradient(
      0,
      -highlightWidth / 2,
      0,
      highlightWidth / 2
    );
    highlightGrad.addColorStop(0, 'rgba(80, 210, 130, 0)');
    highlightGrad.addColorStop(0.5, 'rgba(90, 220, 140, 0.25)');
    highlightGrad.addColorStop(1, 'rgba(80, 210, 130, 0)');
    toneCtx.fillStyle = highlightGrad;
    toneCtx.beginPath();
    toneCtx.moveTo(0, -highlightWidth / 2);
    toneCtx.quadraticCurveTo(
      highlightLength * 0.55,
      -highlightWidth * 0.35,
      highlightLength,
      -highlightWidth * 0.1
    );
    toneCtx.lineTo(highlightLength, highlightWidth * 0.1);
    toneCtx.quadraticCurveTo(
      highlightLength * 0.55,
      highlightWidth * 0.35,
      0,
      highlightWidth / 2
    );
    toneCtx.closePath();
    toneCtx.fill();
    toneCtx.restore();
  });
  }

  const toneTexture = new THREE.CanvasTexture(toneCanvas);
  toneTexture.needsUpdate = true;
  toneTexture.encoding = THREE.sRGBEncoding;
  toneTexture.wrapS = THREE.ClampToEdgeWrapping;
  toneTexture.wrapT = THREE.ClampToEdgeWrapping;

  const toneMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    map: toneTexture,
    depthWrite: false
  });

  const toneMesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), toneMat);
  toneMesh.rotation.x = -Math.PI / 2;
  toneMesh.position.y = cloth.position.y + TABLE.THICK + 0.02;
  toneMesh.renderOrder = 1;
  toneMesh.castShadow = false;
  toneMesh.receiveShadow = false;
  table.add(toneMesh);

  const baulkZ = -PLAY_H / 4;
  const lineThickness = 0.42;
  const markingMat = new THREE.MeshBasicMaterial({
    color: COLORS.markings,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    opacity: 0.98
  });
  markingMat.depthTest = true;
  markingMat.polygonOffset = true;
  markingMat.polygonOffsetFactor = -1;
  markingMat.polygonOffsetUnits = -3;
  const markingY = CLOTH_THICKNESS * 0.16;
  const baulkPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(halfW * 2, lineThickness),
    markingMat
  );
  baulkPlane.rotation.x = -Math.PI / 2;
  baulkPlane.position.set(0, markingY, baulkZ);
  baulkPlane.renderOrder = 3;
  table.add(baulkPlane);
  const dRadius = PLAY_W * 0.15;
  const dThickness = lineThickness * 0.92;
  const dGeom = new THREE.RingGeometry(
    dRadius - dThickness / 2,
    dRadius + dThickness / 2,
    128,
    1,
    Math.PI,
    Math.PI
  );
  const dMesh = new THREE.Mesh(dGeom, markingMat.clone());
  dMesh.rotation.x = -Math.PI / 2;
  dMesh.position.set(0, markingY, baulkZ);
  dMesh.renderOrder = 3;
  table.add(dMesh);

  function addSpot(x, z) {
    const spotGeo = new THREE.CircleGeometry(0.75, 32);
    const spotMat = new THREE.MeshBasicMaterial({
      color: COLORS.markings,
      transparent: true,
      opacity: 0.95
    });
    spotMat.depthTest = true;
    spotMat.polygonOffset = true;
    spotMat.polygonOffsetFactor = -1;
    spotMat.polygonOffsetUnits = -3;
    const spot = new THREE.Mesh(spotGeo, spotMat);
    spot.rotation.x = -Math.PI / 2;
    spot.position.set(x, markingY, z);
    table.add(spot);
  }
  addSpot(0, baulkZ);
  addSpot(-PLAY_W * 0.25, baulkZ);
  addSpot(PLAY_W * 0.25, baulkZ);
  addSpot(0, 0);
  addSpot(0, PLAY_H * 0.25);
  addSpot(0, PLAY_H * 0.5 - PLAY_H * 0.05);

  const pocketRingMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  pocketRingMat.depthTest = true;
  pocketRingMat.polygonOffset = true;
  pocketRingMat.polygonOffsetFactor = -1;
  pocketRingMat.polygonOffsetUnits = -2;
  pocketCenters().forEach((p) => {
    const inner = POCKET_CLOTH_TOP_RADIUS * 0.78;
    const outer = POCKET_CLOTH_TOP_RADIUS * 0.94;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(inner, outer, 64, 1),
      pocketRingMat
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(p.x, markingY, p.y);
    ring.renderOrder = 2;
    table.add(ring);
  });

  const railH = TABLE.THICK * 2.0;
  const railW = TABLE.WALL * 0.9 * 0.5;
  const FRAME_W = railW * 2.5;
  const baseOuterHalfW = halfW + 2 * railW + FRAME_W;
  const baseOuterHalfH = halfH + 2 * railW + FRAME_W;
  const SIDE_RAIL_EXPAND_X = railW * 1.05; // pull the wooden side rails slightly farther from the cushions
  const END_RAIL_EXPAND_Z = railW * 0.25;
  const outerHalfW = baseOuterHalfW + SIDE_RAIL_EXPAND_X;
  const outerHalfH = baseOuterHalfH + END_RAIL_EXPAND_Z;

  const frameShape = new THREE.Shape();
  frameShape.moveTo(-outerHalfW, -outerHalfH);
  frameShape.lineTo(outerHalfW, -outerHalfH);
  frameShape.lineTo(outerHalfW, outerHalfH);
  frameShape.lineTo(-outerHalfW, outerHalfH);
  frameShape.lineTo(-outerHalfW, -outerHalfH);
  const innerRect = new THREE.Path();
  innerRect.moveTo(-halfW - railW, -halfH - railW);
  innerRect.lineTo(halfW + railW, -halfH - railW);
  innerRect.lineTo(halfW + railW, halfH + railW);
  innerRect.lineTo(-halfW - railW, halfH + railW);
  innerRect.lineTo(-halfW - railW, -halfH - railW);
  frameShape.holes.push(innerRect);
  // extend the side rails downward without altering the top surface
  const frameDepth = railH * 3.4;
  const bevelSpan = Math.min(railW, railH) * 0.18;
  const frameGeo = new THREE.ExtrudeGeometry(frameShape, {
    depth: frameDepth,
    bevelEnabled: true,
    bevelThickness: bevelSpan * 0.6,
    bevelSize: bevelSpan,
    bevelSegments: 3,
    curveSegments: 6
  });
  const frame = new THREE.Mesh(frameGeo, railWoodMat);
  frame.rotation.x = -Math.PI / 2;
  // lower the frame so the top remains aligned with the play field
  frame.position.y = -TABLE.THICK + 0.01 - railH * 2;
  table.add(frame);

  // simple wooden skirt beneath the play surface
  const skirtGeo = new THREE.BoxGeometry(
    baseOuterHalfW * 2,
    TABLE_H * 0.2,
    baseOuterHalfH * 2
  );
  const skirt = new THREE.Mesh(skirtGeo, woodMat);
  skirt.position.y = -TABLE.THICK - TABLE_H * 0.1;
  table.add(skirt);

  // wooden table legs at the four corners, now thinner and taller
  const pocketRadius = 6.2 * 0.5; // radius used for pocket holes
  const pocketHeight = railH * 3.0 * 1.15; // height of pocket cylinders
  const legRadius = pocketRadius * 3 * 0.5; // 50% thinner legs
  const baseLegHeight = pocketHeight * LEG_HEIGHT_MULTIPLIER;
  const legHeight = baseLegHeight + TABLE_LIFT; // extend legs further so the table sits higher
  const legGeo = new THREE.CylinderGeometry(
    legRadius,
    legRadius,
    legHeight,
    12
  );
  const legY = -TABLE.THICK - legHeight / 2;
  [
    [baseOuterHalfW - 6, baseOuterHalfH - 6],
    [-baseOuterHalfW + 6, baseOuterHalfH - 6],
    [baseOuterHalfW - 6, -baseOuterHalfH + 6],
    [-baseOuterHalfW + 6, -baseOuterHalfH + 6]
  ].forEach(([x, z]) => {
    const leg = new THREE.Mesh(legGeo, woodMat);
    leg.position.set(x, legY, z);
    table.add(leg);
  });

  const cushionRaiseY = -TABLE.THICK + 0.02;
  const cushionW = TABLE.WALL * 0.9 * 1.08;
  const cushionExtend = 6 * 0.85;
  const cushionInward = TABLE.WALL * 0.15;
  const LONG_CUSHION_TRIM = 6.1; // trim the long rails further so the corner pieces stop short of the pocket throat
  const CUSHION_POCKET_GAP = POCKET_VIS_R * 0.1; // trim the side-pocket noses so they no longer crowd the pocket lips
  const LONG_RAIL_EXTRA_CLEARANCE = POCKET_VIS_R * 0.3; // shorten long cushions so they stop before the pocket throat
  const END_RAIL_EXTRA_CLEARANCE = POCKET_VIS_R * 0.18; // mirror the pocket clearance on the four short cushions
  const LONG_RAIL_CENTER_PULL = TABLE.WALL * 0.06; // tug long cushions toward the playfield so they meet the rails cleanly
  const END_RAIL_CENTER_PULL = TABLE.WALL * 0.045; // pull the short-end cushions into line with the pockets
  const LONG_CUSHION_FACE_SHRINK = 0.955; // trim the long cushions a touch more so the tops appear slightly slimmer
  const SHORT_CUSHION_FACE_SHRINK = 0.97; // match the cut profile of the long cushions on the short ends
  const CUSHION_NOSE_REDUCTION = 0.75; // allow a slightly fuller nose so the rail projects a bit more into the cloth
  const CUSHION_UNDERCUT_BASE_LIFT = 0.32; // pull the lower edge upward so the cushion sits higher off the cloth
  const CUSHION_UNDERCUT_FRONT_REMOVAL = 0.54; // taper the underside more aggressively to form a clear triangular pocket beneath the rail
  function cushionProfile(len, horizontal) {
    const L = len + cushionExtend + 6;
    const half = L / 2;
    const thicknessScale = horizontal ? LONG_CUSHION_FACE_SHRINK : SHORT_CUSHION_FACE_SHRINK;
    const baseThickness = (cushionW + cushionInward) * thicknessScale;
    const originalBackY = cushionW / 2;
    const rawFrontY = originalBackY - baseThickness;
    const trimmedThickness = baseThickness * CUSHION_BACK_TRIM;
    const backY = rawFrontY + trimmedThickness;
    const noseThickness = trimmedThickness * CUSHION_NOSE_REDUCTION;
    const frontY = backY - noseThickness;
    const rad = THREE.MathUtils.degToRad(CUSHION_CUT_ANGLE);
    const straightCut = noseThickness / Math.tan(rad); // enforce a true 29° chamfer with no additional tapering
    const tipLeft = -half + straightCut;
    const tipRight = half - straightCut;
    const s = new THREE.Shape();
    s.moveTo(-half, backY);
    s.lineTo(tipLeft, frontY);
    s.lineTo(tipRight, frontY);
    s.lineTo(half, backY);
    s.lineTo(-half, backY);
    const cushionBevel = Math.min(railH, baseThickness) * 0.12;
    const geo = new THREE.ExtrudeGeometry(s, {
      depth: railH,
      bevelEnabled: true,
      bevelThickness: cushionBevel * 0.6,
      bevelSize: cushionBevel,
      bevelSegments: 2,
      curveSegments: 6
    });
    const positions = geo.attributes.position;
    const arr = positions.array;
    const stride = 3;
    let maxZ = -Infinity;
    let minZ = Infinity;
    for (let i = 0; i < arr.length; i += stride) {
      const z = arr[i + 2];
      if (z > maxZ) maxZ = z;
      if (z < minZ) minZ = z;
    }
    const depth = Math.max(maxZ - minZ, 1e-6);
    const frontSpan = Math.max(backY - frontY, 1e-6);
    for (let i = 0; i < arr.length; i += stride) {
      const y = arr[i + 1];
      const z = arr[i + 2];
      const frontFactor = THREE.MathUtils.clamp((backY - y) / frontSpan, 0, 1);
      if (frontFactor <= 0) continue;
      const taperedLift = CUSHION_UNDERCUT_FRONT_REMOVAL * frontFactor;
      const lift = Math.min(CUSHION_UNDERCUT_BASE_LIFT + taperedLift, 0.94);
      const minAllowedZ = minZ + depth * lift;
      if (z < minAllowedZ) {
        arr[i + 2] = minAllowedZ;
      }
    }
    positions.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    return geo;
  }
  function addCushion(x, z, len, horizontal) {
    const geo = cushionProfile(len, horizontal);
    const mesh = new THREE.Mesh(geo, cushionMat);
    mesh.rotation.x = -Math.PI / 2;
    const g = new THREE.Group();
    g.add(mesh);
    g.position.set(x, cushionRaiseY, z);
    const centerNudge = CUSHION_FACE_INSET;
    const side = horizontal ? Math.sign(z) || -1 : Math.sign(x) || 1;
    if (!horizontal) {
      g.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      g.position.x += -side * centerNudge;
      g.position.x -= side * END_RAIL_CENTER_PULL;
    } else {
      g.rotation.y = side > 0 ? Math.PI : 0;
      g.position.z += -side * centerNudge;
      g.position.z -= side * LONG_RAIL_CENTER_PULL;
    }
    g.userData = g.userData || {};
    g.userData.horizontal = horizontal;
    g.userData.side = side >= 0 ? 1 : -1;
    table.add(g);
    if (!table.userData.cushions) table.userData.cushions = [];
    table.userData.cushions.push(g);
  }
  const horizontalLen =
    PLAY_W -
    (cushionExtend + 6) -
    LONG_CUSHION_TRIM -
    CUSHION_POCKET_GAP * 2 -
    LONG_RAIL_EXTRA_CLEARANCE * 2;
  const horizontalHalfSpan = (horizontalLen + (cushionExtend + 6)) / 2;
  // Match the corner clearance of the vertical cushions to the adjoining horizontals
  // so the angled cuts stop before the pocket rings instead of overlapping them.
  const cornerClearance = Math.max(0, PLAY_W / 2 - horizontalHalfSpan);
  const verticalTopTip = -halfH + cornerClearance;
  const verticalBottomTip = -CUSHION_POCKET_GAP - END_RAIL_EXTRA_CLEARANCE;
  const verticalHalfSpan = (verticalBottomTip - verticalTopTip) / 2;
  const verticalLen = Math.max(
    0,
    verticalHalfSpan * 2 - (cushionExtend + 6)
  );
  const verticalCenterTop = (verticalTopTip + verticalBottomTip) / 2;
  const vertSeg = Math.max(0, 2 * (verticalCenterTop + halfH - 6));
  const bottomZ = -halfH - (TABLE.WALL * 0.5) / 2;
  const topZ = halfH + (TABLE.WALL * 0.5) / 2;
  const leftX = -halfW - (TABLE.WALL * 0.5) / 2;
  const rightX = halfW + (TABLE.WALL * 0.5) / 2;
  addCushion(0, bottomZ, horizontalLen, true);
  addCushion(leftX, -halfH + 6 + vertSeg / 2, verticalLen, false);
  addCushion(rightX, halfH - 6 - vertSeg / 2, verticalLen, false);
  addCushion(0, topZ, horizontalLen, true);
  addCushion(leftX, halfH - 6 - vertSeg / 2, verticalLen, false);
  addCushion(rightX, -halfH + 6 + vertSeg / 2, verticalLen, false);

  table.updateMatrixWorld(true);
  let cushionTopLocal = TABLE.THICK;
  if (table.userData.cushions?.length) {
    const cushionBox = new THREE.Box3();
    for (const cushion of table.userData.cushions) {
      cushionBox.setFromObject(cushion);
      cushionTopLocal = Math.max(cushionTopLocal, cushionBox.max.y);
    }
  }
  table.userData.cushionTopLocal = cushionTopLocal;

  if (!table.userData.pockets) table.userData.pockets = [];
  const clothPlane = cushionTopLocal - CLOTH_THICKNESS;
  pocketCenters().forEach((p) => {
    const cutHeight = railH * 3.0;
    const scaleY = 1.15;
    const half = (cutHeight * scaleY) / 2;
    const pocketMarker = new THREE.Object3D();
    pocketMarker.position.set(p.x, clothPlane - half, p.y);
    pocketMarker.scale.set(0.5, scaleY, 0.5);
    pocketMarker.userData.captureRadius = CAPTURE_R;
    table.add(pocketMarker);
    table.userData.pockets.push(pocketMarker);
  });

  alignRailsToCushions(table, frame);
  table.updateMatrixWorld(true);
  updateRailLimitsFromTable(table);

  table.position.y = TABLE_Y;
  table.userData.cushionTopWorld = cushionTopLocal + TABLE_Y;
  table.userData.cushionLipClearance = clothPlane;
  parent.add(table);
  return {
    centers: pocketCenters(),
    baulkZ,
    group: table,
    clothMat,
    cushionMat
  };
}
// --------------------------------------------------
// NEW Engine (no globals). Camera feels like standing at the side.
// --------------------------------------------------
function SnookerGame() {
  const mountRef = useRef(null);
  const rafRef = useRef(null);
  const rules = useMemo(() => new SnookerRules(), []);
  const [hud, setHud] = useState({
    power: 0.65,
    A: 0,
    B: 0,
    turn: 0,
    phase: 'reds',
    next: 'red',
    inHand: false,
    over: false
  });
  const powerRef = useRef(hud.power);
  useEffect(() => {
    powerRef.current = hud.power;
  }, [hud.power]);
  const [err, setErr] = useState(null);
  const fireRef = useRef(() => {}); // set from effect so slider can trigger fire()
  const cameraRef = useRef(null);
  const sphRef = useRef(null);
  const initialOrbitRef = useRef(null);
  const followViewRef = useRef(null);
  const cameraBlendRef = useRef(ACTION_CAMERA_START_BLEND);
  const cameraBoundsRef = useRef({
    cueShot: { phi: CAMERA.maxPhi, radius: BREAK_VIEW.radius },
    standing: { phi: CAMERA.minPhi, radius: BREAK_VIEW.radius }
  });
  const rendererRef = useRef(null);
  const last3DRef = useRef({ phi: CAMERA.maxPhi, theta: Math.PI });
  const cushionHeightRef = useRef(TABLE.THICK + 0.4);
  const fitRef = useRef(() => {});
  const topViewRef = useRef(false);
  const [topView, setTopView] = useState(false);
  const aimDirRef = useRef(new THREE.Vector2(0, 1));
  const playerOffsetRef = useRef(0);
  const orbitFocusRef = useRef({
    target: new THREE.Vector3(0, TABLE_Y + 0.05, 0),
    ballId: null
  });
  const orbitRadiusLimitRef = useRef(null);
  const [timer, setTimer] = useState(60);
  const timerRef = useRef(null);
  const spinRef = useRef({ x: 0, y: 0 });
  const resetSpinRef = useRef(() => {});
  const tipGroupRef = useRef(null);
  const spinRangeRef = useRef({
    side: 0,
    forward: 0,
    offsetSide: 0,
    offsetVertical: 0
  });
  const spinLimitsRef = useRef({ ...DEFAULT_SPIN_LIMITS });
  const spinAppliedRef = useRef({ x: 0, y: 0 });
  const spinDotElRef = useRef(null);
  const updateSpinDotPosition = useCallback((value) => {
    if (!value) value = { x: 0, y: 0 };
    const dot = spinDotElRef.current;
    if (!dot) return;
    const x = clamp(value.x ?? 0, -1, 1);
    const y = clamp(value.y ?? 0, -1, 1);
    dot.style.left = `${50 + x * 50}%`;
    dot.style.top = `${50 + y * 50}%`;
  }, []);
  const cueRef = useRef(null);
  const ballsRef = useRef([]);
  const [player, setPlayer] = useState({ name: '', avatar: '' });
  const panelsRef = useRef(null);
  const { mapDelta } = useAimCalibration();
  useEffect(() => {
    document.title = '3D Snooker';
  }, []);
  useEffect(() => {
    setPlayer({
      name: getTelegramUsername() || 'Player',
      avatar: getTelegramPhotoUrl()
    });
  }, []);
  useEffect(() => {
    let wakeLock;
    const request = async () => {
      try {
        wakeLock = await navigator.wakeLock?.request('screen');
      } catch (e) {
        console.warn('wakeLock request failed', e);
      }
    };
    request();
    const handleVis = () => {
      if (document.visibilityState === 'visible') request();
    };
    document.addEventListener('visibilitychange', handleVis);
    return () => {
      document.removeEventListener('visibilitychange', handleVis);
      try {
        wakeLock?.release();
      } catch {}
    };
  }, []);
  const aiFlag = useMemo(
    () => FLAG_EMOJIS[Math.floor(Math.random() * FLAG_EMOJIS.length)],
    []
  );
  const aiShoot = useRef(() => {
    aimDirRef.current.set(Math.random() - 0.5, Math.random() - 0.5).normalize();
    powerRef.current = 0.5;
    setHud((s) => ({ ...s, power: 0.5 }));
    fireRef.current?.();
  });

  // determine which sides of the cue ball are blocked by nearby balls or rails
  const getBlockedSides = () => {
    const cue = cueRef.current;
    const balls = ballsRef.current;
    const sides = { left: false, right: false, up: false, down: false };
    if (!cue) return sides;
    const thresh = BALL_R * 2 + CUE_TIP_GAP;
    for (const b of balls) {
      if (!b.active || b === cue) continue;
      const dx = b.pos.x - cue.pos.x;
      const dz = b.pos.y - cue.pos.y;
      if (Math.hypot(dx, dz) < thresh) {
        if (dx > 0) sides.right = true;
        if (dx < 0) sides.left = true;
        if (dz > 0) sides.up = true;
        if (dz < 0) sides.down = true;
      }
    }
    const halfW = PLAY_W / 2 - CUSHION_FACE_INSET;
    const halfH = PLAY_H / 2 - CUSHION_FACE_INSET;
    if (cue.pos.x + BALL_R >= halfW) sides.right = true;
    if (cue.pos.x - BALL_R <= -halfW) sides.left = true;
    if (cue.pos.y + BALL_R >= halfH) sides.up = true;
    if (cue.pos.y - BALL_R <= -halfH) sides.down = true;
    return sides;
  };

  const drawHudPanel = (ctx, logo, avatarImg, name, score, t, emoji) => {
    const c = ctx.canvas;
    const w = c.width;
    const h = c.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 10;
    ctx.strokeRect(0, 0, w, h);
    if (logo && logo.complete) ctx.drawImage(logo, w / 2 - 64, 5, 128, 64);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = '28px sans-serif';
    if (avatarImg && avatarImg.complete)
      ctx.drawImage(avatarImg, 20, 100, 64, 64);
    else if (emoji) {
      ctx.font = '48px serif';
      ctx.fillText(emoji, 52, 150);
    }
    ctx.textAlign = 'left';
    ctx.font = '24px sans-serif';
    ctx.fillText(name, 100, 120);
    ctx.fillText(`Score: ${score}`, 100, 160);
    ctx.fillText(`Time: ${t}`, 100, 200);
  };

  const updateHudPanels = useCallback(() => {
    const panels = panelsRef.current;
    if (!panels) return;
    const { A, B, C, D, logo, playerImg } = panels;
    drawHudPanel(A.ctx, logo, playerImg, player.name, hud.A, timer);
    A.tex.needsUpdate = true;
    drawHudPanel(B.ctx, logo, null, 'AI', hud.B, timer, aiFlag);
    B.tex.needsUpdate = true;
    drawHudPanel(C.ctx, logo, playerImg, player.name, hud.A, timer);
    C.tex.needsUpdate = true;
    drawHudPanel(D.ctx, logo, null, 'AI', hud.B, timer, aiFlag);
    D.tex.needsUpdate = true;
  }, [hud.A, hud.B, timer, player.name, aiFlag]);

  useEffect(() => {
    updateHudPanels();
  }, [updateHudPanels]);

  // Removed camera rotation helpers previously triggered by UI buttons

  const toggleView = () => {
    const cam = cameraRef.current;
    const sph = sphRef.current;
    const fit = fitRef.current;
    if (!cam || !sph || !fit) return;
    const next = !topViewRef.current;
    const start = {
      radius: sph.radius,
      phi: sph.phi,
      theta: sph.theta
    };
    if (next) last3DRef.current = { phi: sph.phi, theta: sph.theta };
      const targetMargin = next
        ? 1.05
        : window.innerHeight > window.innerWidth
          ? 1.6
          : 1.4;
    const targetRadius = fitRadius(cam, targetMargin);
    const target = {
      radius: next ? targetRadius : clampOrbitRadius(targetRadius),
      phi: next ? 0.0001 : last3DRef.current.phi,
      theta: next ? sph.theta : last3DRef.current.theta
    };
    const duration = 600;
    const t0 = performance.now();
    function anim(t) {
      const k = Math.min(1, (t - t0) / duration);
      const ease = k * (2 - k);
      sph.radius = start.radius + (target.radius - start.radius) * ease;
      sph.phi = start.phi + (target.phi - start.phi) * ease;
      sph.theta = start.theta + (target.theta - start.theta) * ease;
      const targetPos = new THREE.Vector3(
        playerOffsetRef.current,
        TABLE_Y + 0.05,
        0
      ).multiplyScalar(worldScaleFactor);
      cam.position.setFromSpherical(sph).add(targetPos);
      cam.lookAt(targetPos);
      if (k < 1) requestAnimationFrame(anim);
      else {
        topViewRef.current = next;
        setTopView(next);
        if (rendererRef.current) {
          rendererRef.current.domElement.style.transform = next
            ? 'scale(0.9)'
            : 'scale(1)';
        }
        fit(targetMargin);
      }
    }
    requestAnimationFrame(anim);
  };

  useEffect(() => {
    if (hud.over) return;
    const playerTurn = hud.turn;
    const duration = playerTurn === 0 ? 60 : 5;
    setTimer(duration);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          if (playerTurn === 0) {
            setHud((s) => ({ ...s, turn: 1 - s.turn }));
          } else {
            aiShoot.current();
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [hud.turn, hud.over]);

  useEffect(() => {
    const host = mountRef.current;
    if (!host) return;
    try {
      screen.orientation?.lock?.('portrait').catch(() => {});
      // Renderer
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance'
      });
      renderer.useLegacyLights = false;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;
      const devicePixelRatio = window.devicePixelRatio || 1;
      const mobilePixelCap = window.innerWidth <= 1366 ? 1.5 : 2;
      renderer.setPixelRatio(Math.min(mobilePixelCap, devicePixelRatio));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      // Ensure the canvas fills the host element so the table is centered and
      // scaled correctly on all view modes.
      renderer.setSize(host.clientWidth, host.clientHeight);
      host.appendChild(renderer.domElement);
      renderer.domElement.addEventListener('webglcontextlost', (e) =>
        e.preventDefault()
      );
      rendererRef.current = renderer;
      renderer.domElement.style.transformOrigin = 'top left';

      // Scene & Camera
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x050505);
      const world = new THREE.Group();
      scene.add(world);
      let worldScaleFactor = 1;
      RectAreaLightUniformsLib.init();
      let cue;
      let clothMat;
      let cushionMat;
      let shooting = false; // track when a shot is in progress
      let activeShotView = null;
      let shotPrediction = null;
      let cueAnimating = false; // forward stroke animation state
      const baseLegHeight =
        TABLE.THICK * 2 * 3 * 1.15 * LEG_HEIGHT_MULTIPLIER;
      const legHeight = baseLegHeight + TABLE_LIFT;
      const floorY = TABLE_Y - TABLE.THICK - legHeight + 0.3;
      const roomDepth = TABLE.H * 3.6;
      const sideClearance = roomDepth / 2 - TABLE.H / 2;
      const roomWidth = TABLE.W + sideClearance * 2;
      const wallThickness = 1.2;
      const wallHeight = legHeight + TABLE.THICK + 40;
      const carpetThickness = 1.2;
      const carpetInset = wallThickness * 0.02;
      const carpetWidth = roomWidth - wallThickness + carpetInset;
      const carpetDepth = roomDepth - wallThickness + carpetInset;
      const carpet = new THREE.Mesh(
        new THREE.BoxGeometry(carpetWidth, carpetThickness, carpetDepth),
        new THREE.MeshStandardMaterial({
          color: 0x8c2f2f,
          roughness: 0.9,
          metalness: 0.05
        })
      );
      carpet.castShadow = false;
      carpet.receiveShadow = true;
      carpet.position.set(0, floorY - carpetThickness / 2, 0);
      world.add(carpet);

      const wallMat = new THREE.MeshStandardMaterial({
        color: 0xeeeeee,
        roughness: 0.88,
        metalness: 0.06
      });

      const makeWall = (width, height, depth) => {
        const wall = new THREE.Mesh(
          new THREE.BoxGeometry(width, height, depth),
          wallMat
        );
        wall.castShadow = false;
        wall.receiveShadow = true;
        wall.position.y = floorY + height / 2;
        world.add(wall);
        return wall;
      };

      const backWall = makeWall(roomWidth, wallHeight, wallThickness);
      backWall.position.z = roomDepth / 2;

      const frontWall = makeWall(roomWidth, wallHeight, wallThickness);
      frontWall.position.z = -roomDepth / 2;

      const leftWall = makeWall(wallThickness, wallHeight, roomDepth);
      leftWall.position.x = -roomWidth / 2;

      const rightWall = makeWall(wallThickness, wallHeight, roomDepth);
      rightWall.position.x = roomWidth / 2;
        const camera = new THREE.PerspectiveCamera(
          CAMERA.fov,
          host.clientWidth / host.clientHeight,
          CAMERA.near,
          CAMERA.far
        );
        // Start behind baulk colours
        const sph = new THREE.Spherical(
          BREAK_VIEW.radius,
          BREAK_VIEW.phi, // keep the break view a touch higher for clearer break alignment
          Math.PI
        );

        const getDefaultOrbitTarget = () =>
          new THREE.Vector3(playerOffsetRef.current, TABLE_Y + 0.05, 0);

        const ensureOrbitFocus = () => {
          const store = orbitFocusRef.current;
          if (store?.target) return store;
          const target = getDefaultOrbitTarget();
          orbitFocusRef.current = { ballId: null, target };
          return orbitFocusRef.current;
        };

        const setOrbitFocusToDefault = () => {
          const store = ensureOrbitFocus();
          store.ballId = null;
          store.target.copy(getDefaultOrbitTarget());
        };

        const setOrbitFocusToBall = (ball) => {
          if (!ball) {
            setOrbitFocusToDefault();
            return;
          }
          const store = ensureOrbitFocus();
          store.ballId = ball.id;
          store.target.set(ball.pos.x, BALL_CENTER_Y, ball.pos.y);
        };

        const getMaxOrbitRadius = () =>
          topViewRef.current
            ? CAMERA.maxR
            : Math.min(CAMERA.maxR, orbitRadiusLimitRef.current ?? CAMERA.maxR);

        const clampOrbitRadius = (value) =>
          clamp(value, CAMERA.minR, getMaxOrbitRadius());

        const getDynamicOrbitRadius = (
          baseRadius,
          theta,
          blend,
          minRadius = CAMERA.minR
        ) => {
          const orientation = orientationScaleForTheta(theta);
          const vertical = verticalZoomForBlend(blend);
          const scaled = baseRadius * orientation * vertical;
          const min = Math.max(minRadius, CAMERA.minR);
          return clampOrbitRadius(Math.max(scaled, min));
        };

        const syncBlendToSpherical = () => {
          const bounds = cameraBoundsRef.current;
          if (!bounds) return;
          const { standing, cueShot } = bounds;
          const phiRange = standing.phi - cueShot.phi;
          if (Math.abs(phiRange) > 1e-5) {
            const normalized = (sph.phi - cueShot.phi) / phiRange;
            cameraBlendRef.current = THREE.MathUtils.clamp(
              normalized,
              0,
              1
            );
          } else {
            cameraBlendRef.current = 0;
          }
        };

        const applyCameraBlend = (nextBlend) => {
          const bounds = cameraBoundsRef.current;
          if (!bounds) return;
          const { standing, cueShot } = bounds;
          const blend = THREE.MathUtils.clamp(
            nextBlend ?? cameraBlendRef.current,
            0,
            1
          );
          cameraBlendRef.current = blend;
          const phi = THREE.MathUtils.lerp(cueShot.phi, standing.phi, blend);
          const radius = THREE.MathUtils.lerp(
            cueShot.radius,
            standing.radius,
            blend
          );
          sph.phi = clamp(phi, CAMERA.minPhi, CAMERA.maxPhi);
          sph.radius = clampOrbitRadius(radius);
          syncBlendToSpherical();
        };

        const updateCamera = () => {
          let lookTarget = null;
          if (topViewRef.current) {
            lookTarget = getDefaultOrbitTarget().multiplyScalar(
              worldScaleFactor
            );
            camera.position.set(lookTarget.x, sph.radius, lookTarget.z);
            camera.lookAt(lookTarget);
          } else if (shooting && activeShotView?.mode === 'action') {
            const view = activeShotView;
            const ballsList =
              ballsRef.current?.length > 0 ? ballsRef.current : balls;
            const cueBall = ballsList.find((b) => b.id === 'cue');
            if (cueBall) {
              const cuePos2 =
                view.lastBallPos ?? (view.lastBallPos = new THREE.Vector2());
              cuePos2.set(cueBall.pos.x, cueBall.pos.y);
            }
            const now = performance.now();
            const engaged =
              now - (view.startedAt ?? now) >= ACTION_CAMERA.switchDelay;
            if (!engaged || !cueBall) {
              const store = ensureOrbitFocus();
              const fallback = store.target
                .clone()
                .multiplyScalar(worldScaleFactor);
              lookTarget = fallback;
              const dynamicRadius = getDynamicOrbitRadius(
                sph.radius,
                sph.theta,
                cameraBlendRef.current
              );
              TMP_SPH.copy(sph);
              TMP_SPH.radius = dynamicRadius;
              camera.position.setFromSpherical(TMP_SPH).add(lookTarget);
              camera.lookAt(lookTarget);
            } else {
              let targetBall = null;
              if (view.targetId) {
                targetBall = ballsList.find((b) => b.id === view.targetId);
                if (targetBall && !targetBall.active) targetBall = null;
              }
              const aimVec2 = (view.aimDir
                ? view.aimDir.clone()
                : aimDirRef.current.clone()
              ).normalize();
              view.aimDir = view.aimDir || aimVec2.clone();
              let targetVec2 = null;
              if (targetBall) {
                targetVec2 = new THREE.Vector2(
                  targetBall.pos.x,
                  targetBall.pos.y
                );
              } else if (view.predictedDir && cueBall) {
                const dir = view.predictedDir.clone();
                if (dir.lengthSq() < 1e-6) dir.copy(aimVec2);
                dir.normalize();
                targetVec2 = new THREE.Vector2(
                  cueBall.pos.x + dir.x * BALL_R * 12,
                  cueBall.pos.y + dir.y * BALL_R * 12
                );
              }
              const scaledRadius = sph.radius * ACTION_CAMERA_RADIUS_SCALE;
              const orbitRadius = clampOrbitRadius(
                Math.max(scaledRadius, ACTION_CAMERA_MIN_RADIUS)
              );
              const clampedPhi = clamp(
                sph.phi,
                ACTION_CAMERA_MIN_PHI,
                CAMERA.maxPhi
              );
              const orbitTheta = sph.theta;
              const tableFocus = new THREE.Vector3(
                playerOffsetRef.current,
                TABLE_Y + 0.05,
                PLAY_H * 0.12
              );
              const worldFocus = tableFocus
                .clone()
                .multiplyScalar(worldScaleFactor);
              const fullTableRadius = clampOrbitRadius(
                Math.max(orbitRadius, fitRadius(camera, 1.12))
              );
              view.cameraOrbit =
                view.cameraOrbit ||
                new THREE.Spherical(fullTableRadius, clampedPhi, orbitTheta);
              view.cameraOrbit.radius = fullTableRadius;
              view.cameraOrbit.phi = clampedPhi;
              view.cameraOrbit.theta = orbitTheta;
              view.focusPoint = tableFocus.clone();
              view.currentCameraId = null;
              lookTarget = worldFocus;
              const adjustedRadius = fullTableRadius;
              view.cameraOrbit.radius = adjustedRadius;
              TMP_SPH.copy(view.cameraOrbit);
              TMP_SPH.radius = adjustedRadius;
              camera.position.setFromSpherical(TMP_SPH).add(worldFocus);
              camera.lookAt(worldFocus);
            }
          } else if (shooting && activeShotView?.mode === 'pocket') {
            const ballsList = ballsRef.current || [];
            const focusBall = ballsList.find(
              (b) => b.id === activeShotView.ballId
            );
            let ballPos2D = activeShotView.lastBallPos;
            if (focusBall?.active) {
              ballPos2D = activeShotView.lastBallPos.set(
                focusBall.pos.x,
                focusBall.pos.y
              );
            }
            const pocketCenter = activeShotView.pocketCenter;
            const toPocket = pocketCenter.clone().sub(ballPos2D);
            const distToPocket = toPocket.length();
            const approachDir = activeShotView.approach;
            if (distToPocket > 1e-4) {
              toPocket.multiplyScalar(1 / distToPocket);
              approachDir.copy(toPocket);
            }
            const minOutside =
              activeShotView.minOutside ?? POCKET_CAM.minOutside;
            const maxOutside =
              activeShotView.maxOutside ?? POCKET_CAM.maxOutside;
            const dynamicOffset = THREE.MathUtils.clamp(
              distToPocket + BALL_R * 2.4,
              minOutside,
              maxOutside
            );
            activeShotView.outsideOffset = dynamicOffset;
            const offsetVec = approachDir
              .clone()
              .multiplyScalar(dynamicOffset);
            const basePoint = pocketCenter.clone().add(offsetVec);
            const camHeight =
              (TABLE_Y + TABLE.THICK + activeShotView.heightOffset) *
              worldScaleFactor;
            camera.position.set(
              basePoint.x * worldScaleFactor,
              camHeight,
              basePoint.y * worldScaleFactor
            );
            const focusTarget = focusBall?.active
              ? new THREE.Vector3(
                  focusBall.pos.x,
                  BALL_CENTER_Y,
                  focusBall.pos.y
                )
              : new THREE.Vector3(
                  activeShotView.lastBallPos.x,
                  BALL_CENTER_Y,
                  activeShotView.lastBallPos.y
                );
            focusTarget.multiplyScalar(worldScaleFactor);
            camera.lookAt(focusTarget);
            lookTarget = focusTarget;
          } else {
            const followCue = cue?.mesh && cue.active && !shooting;
            let focusTarget;
            if (shooting && followViewRef.current?.lastBallPos) {
              const last = followViewRef.current.lastBallPos;
              focusTarget = new THREE.Vector3(last.x, BALL_CENTER_Y, last.y);
            } else if (followCue) {
              focusTarget = new THREE.Vector3(cue.pos.x, BALL_CENTER_Y, cue.pos.y);
            } else {
              const store = ensureOrbitFocus();
              if (store.ballId) {
                const ballsList =
                  ballsRef.current?.length > 0 ? ballsRef.current : balls;
                const focusBall = ballsList.find((b) => b.id === store.ballId);
                if (focusBall?.active) {
                  store.target.set(
                    focusBall.pos.x,
                    BALL_CENTER_Y,
                    focusBall.pos.y
                  );
                } else {
                  setOrbitFocusToDefault();
                }
              }
              focusTarget = store.target.clone();
            }
            focusTarget.multiplyScalar(worldScaleFactor);
            lookTarget = focusTarget;
            const scaledOrbitBase = clampOrbitRadius(
              Math.max(
                sph.radius * ACTION_CAMERA_RADIUS_SCALE,
                ACTION_CAMERA_MIN_RADIUS
              )
            );
            const dynamicRadius = getDynamicOrbitRadius(
              scaledOrbitBase,
              sph.theta,
              cameraBlendRef.current,
              ACTION_CAMERA_MIN_RADIUS
            );
            TMP_SPH.copy(sph);
            TMP_SPH.radius = dynamicRadius;
            camera.position.setFromSpherical(TMP_SPH).add(lookTarget);
            camera.lookAt(lookTarget);
          }
          if (clothMat && lookTarget) {
            const dist = camera.position.distanceTo(lookTarget);
            // Subtle detail up close, fade quicker in orbit view
            const fade = THREE.MathUtils.clamp((130 - dist) / 55, 0, 1);
            const rep = THREE.MathUtils.lerp(18, 36, fade);
            clothMat.map?.repeat.set(rep, rep);
          }
        };
        const lerpAngle = (a, b, t) => {
          const delta =
            THREE.MathUtils.euclideanModulo(b - a + Math.PI, Math.PI * 2) -
            Math.PI;
          return a + delta * t;
        };
        const animateCamera = ({
          radius,
          phi,
          theta,
          duration = 600
        } = {}) => {
          if (radius !== undefined) {
            radius = clampOrbitRadius(radius);
          }
          const start = {
            radius: sph.radius,
            phi: sph.phi,
            theta: sph.theta
          };
          const startTime = performance.now();
          const ease = (k) => k * k * (3 - 2 * k);
          const step = (now) => {
            const t = Math.min(1, (now - startTime) / duration);
            const eased = ease(t);
            if (radius !== undefined) {
              sph.radius = THREE.MathUtils.lerp(start.radius, radius, eased);
            }
            if (phi !== undefined) {
              sph.phi = THREE.MathUtils.lerp(start.phi, phi, eased);
            }
            if (theta !== undefined) {
              sph.theta = lerpAngle(start.theta, theta, eased);
            }
            syncBlendToSpherical();
            updateCamera();
            if (t < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        };
        const restoreOrbitCamera = (view, immediate = false) => {
          if (!view) return;
          const sph = sphRef.current;
          if (!sph) return;
          const orbit =
            view.resumeOrbit ??
            view.orbitSnapshot ??
            initialOrbitRef.current ??
            (cameraBoundsRef.current?.standing
              ? {
                  radius: cameraBoundsRef.current.standing.radius,
                  phi: cameraBoundsRef.current.standing.phi,
                  theta: sph.theta
                }
              : {
                  radius: sph.radius,
                  phi: sph.phi,
                  theta: sph.theta
                });
          const radius = clampOrbitRadius(orbit.radius ?? sph.radius);
          const phi = clamp(
            orbit.phi ?? sph.phi,
            CAMERA.minPhi,
            CAMERA.maxPhi
          );
          const theta = orbit.theta ?? sph.theta;
          const cushionLimit = Math.max(
            TABLE.THICK * 0.5,
            cushionHeightRef.current
          );
          const phiCap = Math.acos(
            THREE.MathUtils.clamp(cushionLimit / radius, -1, 1)
          );
          const safePhi = Math.min(phi, phiCap);
          if (immediate) {
            sph.radius = radius;
            sph.phi = Math.max(CAMERA.minPhi, safePhi);
            sph.theta = theta;
            syncBlendToSpherical();
            updateCamera();
          } else {
            animateCamera({
              radius,
              phi: Math.max(CAMERA.minPhi, safePhi),
              theta,
              duration: 500
            });
          }
        };
        const makePocketCameraView = (ballId, followView) => {
          if (!followView) return null;
          const ballsList = ballsRef.current || [];
          const targetBall = ballsList.find((b) => b.id === ballId);
          if (!targetBall) return null;
          const dir = targetBall.vel.clone();
          if (dir.lengthSq() < 1e-6 && shotPrediction?.ballId === ballId) {
            dir.copy(shotPrediction.dir ?? new THREE.Vector2());
          }
          if (dir.lengthSq() < 1e-6) return null;
          dir.normalize();
          const centers = pocketCenters();
          const pos = targetBall.pos.clone();
          let best = null;
          let bestScore = -Infinity;
          for (const center of centers) {
            const toPocket = center.clone().sub(pos);
            const dist = toPocket.length();
            if (dist < BALL_R * 1.5) continue;
            const pocketDir = toPocket.clone().normalize();
            const score = pocketDir.dot(dir);
            if (score > bestScore) {
              bestScore = score;
              best = { center, dist, pocketDir };
            }
          }
          if (!best || bestScore < POCKET_CAM.dotThreshold) return null;
          if (best.dist > POCKET_CAM.triggerDist) return null;
          const outsideOffset = THREE.MathUtils.clamp(
            best.dist * 0.65 + POCKET_VIS_R + BALL_R * 0.4,
            POCKET_CAM.minOutside,
            POCKET_CAM.maxOutside
          );
          const heightOffset = POCKET_CAM.heightOffset;
          const resumeOrbit = followView?.orbitSnapshot
            ? {
                radius: followView.orbitSnapshot.radius,
                phi: followView.orbitSnapshot.phi,
                theta: followView.orbitSnapshot.theta
              }
            : null;
          return {
            mode: 'pocket',
            ballId,
            pocketCenter: best.center.clone(),
            approach: best.pocketDir.clone(),
            outsideOffset,
            minOutside: POCKET_CAM.minOutside,
            maxOutside: POCKET_CAM.maxOutside,
            heightOffset,
            lastBallPos: pos.clone(),
            resume: followView,
            resumeOrbit
          };
        };
        const fit = (m = STANDING_VIEW.margin) => {
          camera.aspect = host.clientWidth / host.clientHeight;
          const standingRadiusRaw = fitRadius(camera, m);
          const cueRadius = clampOrbitRadius(BREAK_VIEW.radius);
          const standingRadius = clampOrbitRadius(
            Math.max(standingRadiusRaw, cueRadius)
          );
          cameraBoundsRef.current = {
            cueShot: { phi: CAMERA.maxPhi, radius: cueRadius },
            standing: { phi: CAMERA.minPhi, radius: standingRadius }
          };
          applyCameraBlend();
          const cushionLimit = Math.max(
            TABLE.THICK * 0.5,
            cushionHeightRef.current
          );
          const phiCap = Math.acos(
            THREE.MathUtils.clamp(cushionLimit / sph.radius, -1, 1)
          );
          if (sph.phi > phiCap) {
            sph.phi = Math.max(CAMERA.minPhi, phiCap);
            syncBlendToSpherical();
          }
          updateCamera();
          camera.updateProjectionMatrix();
        };
        cameraRef.current = camera;
        sphRef.current = sph;
        fitRef.current = fit;
        topViewRef.current = false;
        setTopView(false);
        const margin = Math.max(
          STANDING_VIEW.margin,
          topViewRef.current
            ? 1.05
            : window.innerHeight > window.innerWidth
              ? 1.6
              : 1.4
        );
        const shouldPrimeActionView = !initialOrbitRef.current;
        fit(margin);
        if (shouldPrimeActionView) {
          const bounds = cameraBoundsRef.current;
          if (bounds) {
            const { cueShot, standing } = bounds;
            const baseRadius = Math.min(cueShot.radius, standing.radius);
            const preferredRadius = clampOrbitRadius(
              Math.max(
                baseRadius * ACTION_CAMERA_RADIUS_SCALE,
                ACTION_CAMERA_MIN_RADIUS
              )
            );
            const preferredPhi = clamp(
              ACTION_CAMERA_MIN_PHI + ACTION_CAMERA.phiLift * 0.5,
              CAMERA.minPhi,
              CAMERA.maxPhi
            );
            sph.radius = preferredRadius;
            sph.phi = preferredPhi;
            syncBlendToSpherical();
            updateCamera();
          }
        }
        setOrbitFocusToDefault();
        orbitRadiusLimitRef.current = sph.radius;
        if (!initialOrbitRef.current) {
          initialOrbitRef.current = {
            radius: sph.radius,
            phi: sph.phi,
            theta: sph.theta
          };
        }
        const dom = renderer.domElement;
        dom.style.touchAction = 'none';
        const balls = [];
        let project;
        const clampSpinToLimits = (updateUi = false) => {
          const limits = spinLimitsRef.current || DEFAULT_SPIN_LIMITS;
          const current = spinRef.current || { x: 0, y: 0 };
          const clamped = {
            x: clamp(current.x ?? 0, limits.minX, limits.maxX),
            y: clamp(current.y ?? 0, limits.minY, limits.maxY)
          };
          if (clamped.x !== current.x || clamped.y !== current.y) {
            spinRef.current = clamped;
            if (updateUi) updateSpinDotPosition(clamped);
          } else if (updateUi) {
            updateSpinDotPosition(clamped);
          }
          return spinRef.current;
        };
        const applySpinConstraints = (aimVec, updateUi = false) => {
          const cueBall = cueRef.current || cue;
          if (cueBall && aimVec) {
            spinLimitsRef.current = computeSpinLimits(cueBall, aimVec, balls);
          }
          const applied = clampSpinToLimits(updateUi);
          spinAppliedRef.current = applied;
          return applied;
        };
        const drag = { on: false, x: 0, y: 0, moved: false };
        let lastInteraction = performance.now();
        const registerInteraction = (didAdjust = false) => {
          const now = performance.now();
          lastInteraction = now;
          if (
            shooting &&
            activeShotView &&
            (activeShotView.mode === 'followCue' ||
              activeShotView.mode === 'action')
          ) {
            activeShotView.lastInteraction = now;
            if (didAdjust) {
              activeShotView.userAdjusted = true;
            }
          }
        };
        const down = (e) => {
          registerInteraction();
          if (e.touches?.length === 2) return;
          if (topViewRef.current) return;
          drag.on = true;
          drag.moved = false;
          drag.x = e.clientX || e.touches?.[0]?.clientX || 0;
          drag.y = e.clientY || e.touches?.[0]?.clientY || 0;
        };
        const move = (e) => {
          if (topViewRef.current || !drag.on) return;
          const x = e.clientX || e.touches?.[0]?.clientX || drag.x;
          const y = e.clientY || e.touches?.[0]?.clientY || drag.y;
          const dx = x - drag.x;
          const dy = y - drag.y;
          if (!drag.moved && Math.hypot(dx, dy) > 4) drag.moved = true;
          if (drag.moved) {
            drag.x = x;
            drag.y = y;
            sph.theta -= dx * 0.0035;
            const phiRange = CAMERA.maxPhi - CAMERA.minPhi;
            const phiDelta = dy * 0.0025;
            const blendDelta =
              phiRange > 1e-5 ? phiDelta / phiRange : 0;
            applyCameraBlend(cameraBlendRef.current - blendDelta);
            updateCamera();
            registerInteraction(true);
          }
        };
        const up = (e) => {
          registerInteraction();
          const moved = drag.moved;
          drag.on = false;
          drag.moved = false;
          if (
            !moved &&
            !topViewRef.current &&
            !hud.inHand &&
            !shooting
          ) {
            if (e?.button !== undefined && e.button !== 0) return;
            pickOrbitFocus(e);
          }
        };
        dom.addEventListener('mousedown', down);
        dom.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
        dom.addEventListener('touchstart', down, { passive: true });
        dom.addEventListener('touchmove', move, { passive: true });
        window.addEventListener('touchend', up);
        const keyRot = (e) => {
          if (topViewRef.current) return;
          const step = e.shiftKey ? 0.08 : 0.035;
          if (e.code === 'ArrowLeft') {
            sph.theta += step;
          } else if (e.code === 'ArrowRight') {
            sph.theta -= step;
          } else if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
            const phiRange = CAMERA.maxPhi - CAMERA.minPhi;
            const dir = e.code === 'ArrowUp' ? -1 : 1;
            const blendDelta =
              phiRange > 1e-5 ? (step * dir) / phiRange : 0;
            applyCameraBlend(cameraBlendRef.current - blendDelta);
          } else return;
          registerInteraction(true);
          updateCamera();
        };
        window.addEventListener('keydown', keyRot);

      // Lights
      // Pull the pot lights higher and farther apart so they feel less harsh over the cloth
      const lightHeight = TABLE_Y + 140; // raise spotlights further from the table
      const rectSizeBase = 24;
      const rectSize = rectSizeBase * 0.85 * 0.5; // shrink to 50% footprint for softer, tighter beams
      const baseRectIntensity = 31.68;
      const lightIntensity = baseRectIntensity * 0.82 * 3; // compensate for removing the third fixture

      const makeLight = (x, z) => {
        const rect = new THREE.RectAreaLight(
          0xffffff,
          lightIntensity,
          rectSize,
          rectSize
        );
        rect.position.set(x, lightHeight, z);
        rect.lookAt(x, TABLE_Y, z);
        world.add(rect);
      };

      // evenly space the ceiling lights along the table centre line
      const spotlightSpread = 0.46;
      const lightPositions = [-TABLE.H * spotlightSpread, TABLE.H * spotlightSpread];
      for (const z of lightPositions) {
        makeLight(0, z);
      }

      const ambientWallDistanceX =
        TABLE.W / 2 + sideClearance * 0.55 - wallThickness * 0.5;
      const ambientWallDistanceZ =
        TABLE.H / 2 + sideClearance * 0.55 - wallThickness * 0.5;
      const ambientHeight = TABLE_Y + TABLE.THICK * 1.25;
      const ambientIntensity = 1.45;
      const ambientDistance = Math.max(roomWidth, roomDepth) * 0.65;
      const ambientAngle = Math.PI * 0.6;
      const ambientPenumbra = 0.42;
      const ambientColor = 0xf8f1e2;

      const ambientBoost = new THREE.AmbientLight(ambientColor, 0.35);
      world.add(ambientBoost);

      const cushionFill = new THREE.HemisphereLight(
        0xf4f1e7,
        0x1a2218,
        0.22
      );
      cushionFill.position.set(0, TABLE_Y + TABLE.THICK * 0.5, 0);
      world.add(cushionFill);

      const addAmbientFill = (x, z) => {
        const light = new THREE.SpotLight(
          ambientColor,
          ambientIntensity,
          ambientDistance,
          ambientAngle,
          ambientPenumbra,
          1
        );
        light.position.set(x, ambientHeight, z);
        light.target.position.set(0, TABLE_Y - TABLE.THICK * 0.75, 0);
        light.castShadow = false;
        world.add(light);
        world.add(light.target);
      };

      addAmbientFill(ambientWallDistanceX, 0);
      addAmbientFill(-ambientWallDistanceX, 0);
      addAmbientFill(0, ambientWallDistanceZ);
      addAmbientFill(0, -ambientWallDistanceZ);

      // Table
      const {
        centers,
        baulkZ,
        group: table,
        clothMat: tableCloth,
        cushionMat: tableCushion
      } = Table3D(world);
      clothMat = tableCloth;
      cushionMat = tableCushion;
      if (table?.userData) {
        const cushionLip = table.userData.cushionTopLocal ?? TABLE.THICK;
        cushionHeightRef.current = Math.max(TABLE.THICK + 0.1, cushionLip - 0.02);
      }
      // ensure the camera respects the configured zoom limits
      sph.radius = clampOrbitRadius(sph.radius);
      worldScaleFactor = WORLD_SCALE;
      world.scale.setScalar(worldScaleFactor);
      world.updateMatrixWorld(true);
      updateCamera();
      fit(
        topViewRef.current
          ? 1.05
          : window.innerHeight > window.innerWidth
            ? 1.6
            : 1.4
      );

      // Balls (ONLY Guret)
      const add = (id, color, x, z) => {
        const b = Guret(table, id, color, x, z);
        balls.push(b);
        return b;
      };
      cue = add('cue', COLORS.cue, -BALL_R * 2, baulkZ);
      const SPOTS = spotPositions(baulkZ);

      // 15 red balls arranged in triangle behind the pink
      const startZ = SPOTS.pink[1] + BALL_R * 2;
      let rid = 0;
      for (let row = 0; row < 5; row++) {
        for (let i = 0; i <= row; i++) {
          if (rid >= 15) break;
          const x = (i - row / 2) * (BALL_R * 2 + 0.002 * (BALL_R / 0.0525));
          const z = startZ + row * (BALL_R * 1.9);
          add(`red_${rid++}`, COLORS.red, x, z);
        }
      }

      // colours
      const colors = Object.fromEntries(
        Object.entries(SPOTS).map(([k, [x, z]]) => [k, add(k, COLORS[k], x, z)])
      );

      cueRef.current = cue;
      ballsRef.current = balls;

      // Aiming visuals
      const aimMat = new THREE.LineBasicMaterial({
        color: 0xffffff,
        linewidth: 2,
        transparent: true,
        opacity: 0.9
      });
      const aimGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3()
      ]);
      const aim = new THREE.Line(aimGeom, aimMat);
      aim.visible = false;
      table.add(aim);
      const tickGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3()
      ]);
      const tick = new THREE.Line(
        tickGeom,
        new THREE.LineBasicMaterial({ color: 0xffffff })
      );
      tick.visible = false;
      table.add(tick);

      const targetGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3()
      ]);
      const target = new THREE.Line(
        targetGeom,
        new THREE.LineDashedMaterial({
          color: 0xffffff,
          dashSize: 1,
          gapSize: 1,
          transparent: true,
          opacity: 0.5
        })
      );
      target.visible = false;
      table.add(target);

      // Cue stick behind cueball
      const SCALE = BALL_R / 0.0525;
      const cueLen = 1.5 * SCALE;
      const cueStick = new THREE.Group();
      const buttLift = Math.min(CUE_BUTT_LIFT, cueLen);
      const buttTilt = Math.asin(
        Math.min(1, buttLift / Math.max(cueLen, 1e-4))
      );
      const buttTipComp = Math.sin(buttTilt) * cueLen * 0.5;
      const applyCueButtTilt = (group, extraTilt = 0) => {
        if (!group) return;
        const info = group.userData?.buttTilt;
        const baseTilt = info?.angle ?? buttTilt;
        const len = info?.length ?? cueLen;
        const totalTilt = baseTilt + extraTilt;
        group.rotation.x = totalTilt;
        const tipComp = Math.sin(totalTilt) * len * 0.5;
        group.position.y += tipComp;
      };
      cueStick.userData.buttTilt = {
        angle: buttTilt,
        tipCompensation: buttTipComp,
        length: cueLen
      };

      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008 * SCALE, 0.025 * SCALE, cueLen, 32),
        new THREE.MeshPhysicalMaterial({ color: 0xdeb887, roughness: 0.6 })
      );
      shaft.rotation.x = -Math.PI / 2;
      cueStick.add(shaft);

      // group for tip & connector so only the thin end moves for spin
      const tipGroup = new THREE.Group();
      tipGroup.position.z = -cueLen / 2;
      cueStick.add(tipGroup);
      tipGroupRef.current = tipGroup;

      // subtle leather-like texture for the tip
      const tipCanvas = document.createElement('canvas');
      tipCanvas.width = tipCanvas.height = 64;
      const tipCtx = tipCanvas.getContext('2d');
      tipCtx.fillStyle = '#1b3f75';
      tipCtx.fillRect(0, 0, 64, 64);
      tipCtx.strokeStyle = 'rgba(255,255,255,0.08)';
      tipCtx.lineWidth = 2;
      for (let i = 0; i < 64; i += 8) {
        tipCtx.beginPath();
        tipCtx.moveTo(i, 0);
        tipCtx.lineTo(i, 64);
        tipCtx.stroke();
      }
      tipCtx.globalAlpha = 0.2;
      tipCtx.fillStyle = 'rgba(12, 24, 60, 0.65)';
      for (let i = 0; i < 80; i++) {
        const x = Math.random() * 64;
        const y = Math.random() * 64;
        const w = 6 + Math.random() * 10;
        const h = 2 + Math.random() * 4;
        tipCtx.beginPath();
        tipCtx.ellipse(x, y, w, h, Math.random() * Math.PI, 0, Math.PI * 2);
        tipCtx.fill();
      }
      tipCtx.globalAlpha = 1;
      const tipTex = new THREE.CanvasTexture(tipCanvas);

      const connectorHeight = 0.015 * SCALE;
      const tipRadius = CUE_TIP_RADIUS;
      const tipLen = 0.015 * SCALE * 1.5;
      const tipCylinderLen = Math.max(0, tipLen - tipRadius * 2);
      const tip = new THREE.Mesh(
        tipCylinderLen > 0
          ? new THREE.CapsuleGeometry(tipRadius, tipCylinderLen, 8, 16)
          : new THREE.SphereGeometry(tipRadius, 16, 16),
        new THREE.MeshStandardMaterial({
          color: 0x1f3f73,
          roughness: 1,
          metalness: 0,
          map: tipTex
        })
      );
      tip.rotation.x = -Math.PI / 2;
      tip.position.z = -(tipCylinderLen / 2 + tipRadius + connectorHeight);
      tipGroup.add(tip);

      const connector = new THREE.Mesh(
        new THREE.CylinderGeometry(
          tipRadius,
          0.008 * SCALE,
          connectorHeight,
          32
        ),
        new THREE.MeshPhysicalMaterial({
          color: 0xcd7f32,
          metalness: 0.8,
          roughness: 0.5
        })
      );
      connector.rotation.x = -Math.PI / 2;
      connector.position.z = -connectorHeight / 2;
      tipGroup.add(connector);

      const buttCap = new THREE.Mesh(
        new THREE.SphereGeometry(0.03 * SCALE, 32, 16),
        new THREE.MeshPhysicalMaterial({ color: 0x111111, roughness: 0.5 })
      );
      buttCap.position.z = cueLen / 2;
      cueStick.add(buttCap);

      const stripeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
      for (let i = 0; i < 12; i++) {
        const stripe = new THREE.Mesh(
          new THREE.BoxGeometry(0.01 * SCALE, 0.001 * SCALE, 0.35 * SCALE),
          stripeMat
        );
        const angle = (i / 12) * Math.PI * 2;
        stripe.position.x = Math.cos(angle) * 0.02 * SCALE;
        stripe.position.y = Math.sin(angle) * 0.02 * SCALE;
        stripe.position.z = 0.55 * SCALE;
        stripe.rotation.z = angle;
        cueStick.add(stripe);
      }

      cueStick.position.set(cue.pos.x, CUE_Y, cue.pos.y + 1.2 * SCALE);
      applyCueButtTilt(cueStick);
      // thin side already faces the cue ball so no extra rotation
      cueStick.visible = false;
      table.add(cueStick);

      spinRangeRef.current = {
        side: MAX_SPIN_SIDE,
        forward: MAX_SPIN_FORWARD,
        offsetSide: MAX_SPIN_CONTACT_OFFSET,
        offsetVertical: MAX_SPIN_VERTICAL
      };

      // Pointer → XZ plane
      const pointer = new THREE.Vector2();
      const ray = new THREE.Raycaster();
      const plane = new THREE.Plane(
        new THREE.Vector3(0, 1, 0),
        -TABLE_Y * worldScaleFactor
      );
      project = (ev) => {
        const r = dom.getBoundingClientRect();
        const cx =
          (((ev.clientX ?? ev.touches?.[0]?.clientX ?? 0) - r.left) / r.width) *
            2 -
          1;
        const cy = -(
          (((ev.clientY ?? ev.touches?.[0]?.clientY ?? 0) - r.top) / r.height) *
            2 -
          1
        );
        pointer.set(cx, cy);
        ray.setFromCamera(pointer, camera);
        const pt = new THREE.Vector3();
        ray.ray.intersectPlane(plane, pt);
        return new THREE.Vector2(
          pt.x / worldScaleFactor,
          pt.z / worldScaleFactor
        );
      };

      const pickOrbitFocus = (ev) => {
        if (hud.inHand || shooting) return;
        const rect = dom.getBoundingClientRect();
        const clientX =
          ev?.clientX ?? ev?.changedTouches?.[0]?.clientX ?? drag.x;
        const clientY =
          ev?.clientY ?? ev?.changedTouches?.[0]?.clientY ?? drag.y;
        if (clientX == null || clientY == null) return;
        if (
          clientX < rect.left ||
          clientX > rect.right ||
          clientY < rect.top ||
          clientY > rect.bottom
        ) {
          return;
        }
        const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
        const ny = -(((clientY - rect.top) / rect.height) * 2 - 1);
        pointer.set(nx, ny);
        ray.setFromCamera(pointer, camera);
        const ballsList =
          ballsRef.current?.length > 0 ? ballsRef.current : balls;
        const intersects = ray.intersectObjects(
          ballsList.map((b) => b.mesh),
          true
        );
        if (intersects.length > 0) {
          let obj = intersects[0].object;
          let ballId = obj.userData?.ballId;
          while (!ballId && obj.parent) {
            obj = obj.parent;
            ballId = obj.userData?.ballId;
          }
          if (ballId) {
            const ball = ballsList.find((b) => b.id === ballId);
            if (ball) {
              setOrbitFocusToBall(ball);
              return;
            }
          }
        }
        setOrbitFocusToDefault();
      };

      const aimDir = aimDirRef.current;
      const camFwd = new THREE.Vector3();
      const shotSph = new THREE.Spherical();
      const tmpAim = new THREE.Vector2();

      // In-hand placement
      const free = (x, z) =>
        balls.every(
          (b) =>
            !b.active ||
            b === cue ||
            new THREE.Vector2(x, z).distanceTo(b.pos) > BALL_R * 2.1
        );
      const onPlace = (e) => {
        if (!hud.inHand) return;
        const p = project(e);
        if (
          p.y <= baulkZ &&
          Math.abs(p.x) <= PLAY_W / 2 - BALL_R * 2 &&
          free(p.x, p.y)
        ) {
          cue.active = true;
          cue.mesh.visible = true;
          cue.pos.set(p.x, p.y);
          cue.mesh.position.set(p.x, BALL_CENTER_Y, p.y);
          setHud((s) => ({ ...s, inHand: false }));
        }
      };
      dom.addEventListener('pointerdown', onPlace);

      // Shot lifecycle
      let potted = [];
      let foul = false;
      let firstHit = null;
      const legalTarget = () =>
        hud.phase === 'reds'
          ? hud.next === 'red'
            ? 'red'
            : 'colour'
          : hud.next;
      const isRedId = (id) => id.startsWith('red');
      const values = rules.getBallValues();
      const val = (id) =>
        isRedId(id) ? values.RED : values[id.toUpperCase()] || 0;

        // Fire (slider e thërret në release)
        const fire = () => {
          if (!cue?.active || hud.inHand || !allStopped(balls) || hud.over)
            return;
          applyCameraBlend(1);
          updateCamera();
          shooting = true;
          potted = [];
          foul = false;
          firstHit = null;
          clearInterval(timerRef.current);
          const aimDir = aimDirRef.current.clone();
          const prediction = calcTarget(cue, aimDir.clone(), balls);
          shotPrediction = {
            ballId: prediction.targetBall?.id ?? null,
            dir: prediction.afterDir ? prediction.afterDir.clone() : null
          };
          const clampedPower = THREE.MathUtils.clamp(powerRef.current, 0, 1);
          const powerScale =
            SHOT_MIN_FACTOR + SHOT_POWER_RANGE * clampedPower;
          const base = aimDir
            .clone()
            .multiplyScalar(SHOT_BASE_SPEED * powerScale);
          const appliedSpin = applySpinConstraints(aimDir, true);
          const ranges = spinRangeRef.current || {};
          const spinSide = appliedSpin.x * (ranges.side ?? 0);
          const spinTop = -appliedSpin.y * (ranges.forward ?? 0);
          const perp = new THREE.Vector2(-aimDir.y, aimDir.x);
          cue.vel.copy(base);
          if (cue.spin) {
            cue.spin.set(
              perp.x * spinSide + aimDir.x * spinTop,
              perp.y * spinSide + aimDir.y * spinTop
            );
          }
          resetSpinRef.current?.();
          cue.impacted = false;

          if (cameraRef.current && sphRef.current) {
            topViewRef.current = false;
            const sph = sphRef.current;
            const baseOrbit =
              initialOrbitRef.current ?? {
                radius: sph.radius,
                phi: sph.phi,
                theta: sph.theta
              };
            const orbitSnapshot = {
              radius: sph.radius,
              phi: sph.phi,
              theta: sph.theta
            };
            const followTheta = Math.atan2(aimDir.x, aimDir.y) + Math.PI;
            const bounds = cameraBoundsRef.current;
            const standingView = bounds?.standing;
            const followPhi = standingView?.phi ?? CAMERA.minPhi;
            const followRadius = clampOrbitRadius(
              standingView?.radius ?? baseOrbit.radius
            );
            const shotStart = performance.now();
            lastInteraction = shotStart;
            const actionRadius = clampOrbitRadius(
              standingView?.radius ?? followRadius
            );
            const actionPhi = clamp(
              standingView?.phi ?? followPhi,
              CAMERA.minPhi,
              CAMERA.maxPhi
            );
            activeShotView = {
              mode: 'action',
              radius: followRadius,
              phi: followPhi,
              theta: followTheta,
              baseTarget: new THREE.Vector2(playerOffsetRef.current, 0),
              offset: new THREE.Vector2(),
              followWeight: ACTION_VIEW.followWeight,
              maxOffset: ACTION_VIEW.maxOffset,
              lastBallPos: new THREE.Vector2(cue.pos.x, cue.pos.y),
              orbitSnapshot,
              pendingPocket: null,
              lastInteraction: shotStart,
              startedAt: shotStart,
              userAdjusted: false,
              freeOrbit: false,
              targetId: shotPrediction?.ballId ?? null,
              predictedDir: shotPrediction?.dir
                ? shotPrediction.dir.clone()
                : aimDir.clone(),
              aimDir: aimDir.clone(),
              currentCameraId: null,
              lastCameraSwitch: shotStart,
              focusPoint: null,
              cameraOrbit: new THREE.Spherical(
                actionRadius,
                actionPhi,
                followTheta
              )
            };
            followViewRef.current = activeShotView;
            sph.theta = followTheta;
            applyCameraBlend(1);
            updateCamera();
          }

          // animate cue stick forward
          const dir = new THREE.Vector3(aimDir.x, 0, aimDir.y).normalize();
          const backInfo = calcTarget(
            cue,
            aimDir.clone().multiplyScalar(-1),
            balls
          );
          const desiredPull = powerRef.current * BALL_R * 10 * 0.65 * 1.2;
          const maxPull = Math.max(0, backInfo.tHit - cueLen - CUE_TIP_GAP);
          const pull = Math.min(desiredPull, maxPull);
          cueAnimating = true;
          const startPos = cueStick.position.clone();
          const endPos = startPos.clone().add(dir.clone().multiplyScalar(pull));
          let animFrame = 0;
          const animSteps = 5;
          const animateCue = () => {
            animFrame++;
            cueStick.position.lerpVectors(
              startPos,
              endPos,
              animFrame / animSteps
            );
            if (animFrame < animSteps) {
              requestAnimationFrame(animateCue);
            } else {
              let backFrame = 0;
              const animateBack = () => {
                backFrame++;
                cueStick.position.lerpVectors(
                  endPos,
                  startPos,
                  backFrame / animSteps
                );
                if (backFrame < animSteps) requestAnimationFrame(animateBack);
                else {
                  cueStick.visible = false;
                  cueAnimating = false;
                  if (cameraRef.current && sphRef.current) {
                    topViewRef.current = false;
                    const sph = sphRef.current;
                    sph.theta = Math.atan2(aimDir.x, aimDir.y) + Math.PI;
                    updateCamera();
                  }
                }
              };
              requestAnimationFrame(animateBack);
            }
          };
          animateCue();
        };
        fireRef.current = fire;

      // Resolve shot
      function resolve() {
        const me = hud.turn === 0 ? 'A' : 'B',
          op = hud.turn === 0 ? 'B' : 'A';
        let gain = 0;
        let swap = true;
        if (!cue.active) foul = true;
        const target = legalTarget();
        if (firstHit) {
          if (target === 'red' && !isRedId(firstHit)) foul = true;
          else if (target === 'colour' && isRedId(firstHit)) foul = true;
          else if (
            target !== 'red' &&
            target !== 'colour' &&
            firstHit !== target
          )
            foul = true;
        } else {
          foul = true;
        }
        const reds = potted.filter(isRedId),
          cols = potted.filter((id) => !isRedId(id));
        if (hud.phase === 'reds') {
          if (hud.next === 'red') {
            if (cols.length > 0) foul = true;
            gain += reds.length;
            if (reds.length > 0 && !foul) {
              setHud((s) => ({ ...s, next: 'colour' }));
              swap = false;
            }
          } else {
            if (reds.length > 0) foul = true;
            if (cols.length > 0 && !foul) {
              cols.forEach((id) => {
                gain += val(id);
                const b = colors[id];
                if (b) {
                  const [sx, sy] = SPOTS[id];
                  b.active = true;
                  b.mesh.visible = true;
                  b.pos.set(sx, sy);
                  b.mesh.position.set(sx, BALL_CENTER_Y, sy);
                }
              });
              setHud((s) => ({ ...s, next: 'red' }));
              swap = false;
            }
          }
          const redsLeft = balls.some((b) => b.active && isRedId(b.id));
          if (!redsLeft)
            setHud((s) => ({ ...s, phase: 'colors', next: 'yellow' }));
        } else {
          if (
            cols.length === 1 &&
            reds.length === 0 &&
            cols[0] === hud.next &&
            !foul
          ) {
            gain += val(hud.next);
            const order = ['yellow', 'green', 'brown', 'blue', 'pink', 'black'];
            const idx = order.indexOf(hud.next);
            const nxt = order[idx + 1];
            if (nxt) {
              setHud((s) => ({ ...s, next: nxt }));
              swap = false;
            } else {
              setHud((s) => ({ ...s, over: true }));
            }
          } else if (cols.length > 0 || reds.length > 0) {
            foul = true;
          }
        }
        if (foul) {
          const foulPts = Math.max(
            4,
            ...potted.map((id) => val(id)),
            cue.active ? 0 : 4
          );
          setHud((s) => ({
            ...s,
            [op]: s[op] + foulPts,
            inHand: true,
            next: s.phase === 'reds' ? 'red' : s.next
          }));
          cue.active = false;
          cue.mesh.visible = false;
          cue.vel.set(0, 0);
          cue.spin?.set(0, 0);
          cue.impacted = false;
        } else if (gain > 0) {
          setHud((s) => ({ ...s, [me]: s[me] + gain }));
        }
        if (swap || foul) setHud((s) => ({ ...s, turn: 1 - s.turn }));
          shooting = false;
          shotPrediction = null;
          activeShotView = null;
          followViewRef.current = null;
          if (cameraRef.current && sphRef.current) {
            const cuePos = cue?.pos
              ? new THREE.Vector2(cue.pos.x, cue.pos.y)
              : new THREE.Vector2();
            const toCenter = new THREE.Vector2(-cuePos.x, -cuePos.y);
            if (toCenter.lengthSq() < 1e-4) toCenter.set(0, 1);
            else toCenter.normalize();
            const behindTheta = Math.atan2(toCenter.x, toCenter.y) + Math.PI;
            const standingView = cameraBoundsRef.current?.standing;
            const behindPhi = clamp(
              standingView?.phi ?? CAMERA.minPhi,
              CAMERA.minPhi,
              CAMERA.maxPhi
            );
            const behindRadius = clampOrbitRadius(
              standingView?.radius ?? BREAK_VIEW.radius
            );
            applyCameraBlend(1);
            animateCamera({
              radius: behindRadius,
              phi: behindPhi,
              theta: behindTheta,
              duration: 600
            });
          }
          potted = [];
          foul = false;
          firstHit = null;
        }

      // Loop
      let lastStepTime = performance.now();
      const step = (now) => {
        const rawDelta = Math.max(now - lastStepTime, 0);
        const deltaMs = Math.min(rawDelta, MAX_FRAME_TIME_MS);
        const frameScaleBase = deltaMs / TARGET_FRAME_TIME_MS || 1;
        const frameScale = Math.max(frameScaleBase, MIN_FRAME_SCALE);
        lastStepTime = now;
        camera.getWorldDirection(camFwd);
        tmpAim.set(camFwd.x, camFwd.z).normalize();
        aimDir.lerp(tmpAim, 0.2);
        const appliedSpin = applySpinConstraints(aimDir, true);
        const ranges = spinRangeRef.current || {};
        // Aiming vizual
        if (allStopped(balls) && !hud.inHand && cue?.active && !hud.over) {
          const { impact, afterDir, targetBall, railNormal } = calcTarget(
            cue,
            aimDir,
            balls
          );
          const start = new THREE.Vector3(cue.pos.x, BALL_CENTER_Y, cue.pos.y);
          let end = new THREE.Vector3(impact.x, BALL_CENTER_Y, impact.y);
          const dir = new THREE.Vector3(aimDir.x, 0, aimDir.y).normalize();
          if (start.distanceTo(end) < 1e-4) {
            end = start.clone().add(dir.clone().multiplyScalar(BALL_R));
          }
          aimGeom.setFromPoints([start, end]);
          aim.visible = true;
          aim.material.color.set(
            targetBall && !railNormal ? 0xffff00 : 0xffffff
          );
          const perp = new THREE.Vector3(-dir.z, 0, dir.x);
          tickGeom.setFromPoints([
            end.clone().add(perp.clone().multiplyScalar(1.4)),
            end.clone().add(perp.clone().multiplyScalar(-1.4))
          ]);
          tick.visible = true;
          const desiredPull = powerRef.current * BALL_R * 10 * 0.65 * 1.2;
          const backInfo = calcTarget(
            cue,
            aimDir.clone().multiplyScalar(-1),
            balls
          );
          const maxPull = Math.max(0, backInfo.tHit - cueLen - CUE_TIP_GAP);
          const pull = Math.min(desiredPull, maxPull);
          const side = appliedSpin.x * (ranges.offsetSide ?? 0);
          const vert = -appliedSpin.y * (ranges.offsetVertical ?? 0);
          const spinWorld = new THREE.Vector3(
            perp.x * side,
            vert,
            perp.z * side
          );
          cueStick.position.set(
            cue.pos.x - dir.x * (cueLen / 2 + pull + CUE_TIP_GAP) + spinWorld.x,
            CUE_Y + spinWorld.y,
            cue.pos.y - dir.z * (cueLen / 2 + pull + CUE_TIP_GAP) + spinWorld.z
          );
          const tiltAmount = Math.abs(appliedSpin.y || 0);
          const extraTilt = MAX_BACKSPIN_TILT * tiltAmount;
          applyCueButtTilt(cueStick, extraTilt);
          cueStick.rotation.y = Math.atan2(dir.x, dir.z) + Math.PI;
          if (tipGroupRef.current) {
            tipGroupRef.current.position.set(0, 0, -cueLen / 2);
          }
          cueStick.visible = true;
          if (afterDir) {
            const tEnd = new THREE.Vector3(
              end.x + afterDir.x * 30,
              BALL_R,
              end.z + afterDir.y * 30
            );
            targetGeom.setFromPoints([end, tEnd]);
            target.visible = true;
            target.computeLineDistances();
          } else {
            target.visible = false;
          }
        } else {
          aim.visible = false;
          tick.visible = false;
          target.visible = false;
          if (!cueAnimating) cueStick.visible = false;
        }

        // Fizika
        balls.forEach((b) => {
          if (!b.active) return;
          if (b.spin?.lengthSq() > 1e-6) {
            TMP_VEC2_SPIN.copy(b.spin).multiplyScalar(
              SPIN_ROLL_STRENGTH * frameScale
            );
            b.vel.add(TMP_VEC2_SPIN);
            const rollDecay = Math.pow(SPIN_ROLL_DECAY, frameScale);
            b.spin.multiplyScalar(rollDecay);
            if (b.spin.lengthSq() < 1e-6) {
              b.spin.set(0, 0);
            }
          }
          b.pos.addScaledVector(b.vel, frameScale);
          b.vel.multiplyScalar(Math.pow(FRICTION, frameScale));
          const speed = b.vel.length();
          const scaledSpeed = speed * frameScale;
          const hasSpin = b.spin?.lengthSq() > 1e-6;
          if (scaledSpeed < STOP_EPS) {
            b.vel.set(0, 0);
            if (!hasSpin && b.spin) b.spin.set(0, 0);
            if (b.id === 'cue' && !hasSpin) b.impacted = false;
          }
          const hitRail = reflectRails(b);
          if (hitRail && b.id === 'cue') b.impacted = true;
          if (hitRail === 'rail' && b.spin?.lengthSq() > 0) {
            applySpinImpulse(b, 1);
          }
          b.mesh.position.set(b.pos.x, BALL_CENTER_Y, b.pos.y);
          if (scaledSpeed > 0) {
            const axis = new THREE.Vector3(b.vel.y, 0, -b.vel.x).normalize();
            const angle = scaledSpeed / BALL_R;
            b.mesh.rotateOnWorldAxis(axis, angle);
          }
        });
        // Kolizione + regjistro firstHit
        for (let i = 0; i < balls.length; i++)
          for (let j = i + 1; j < balls.length; j++) {
            const a = balls[i],
              b = balls[j];
            if (!a.active || !b.active) continue;
            const dx = b.pos.x - a.pos.x,
              dy = b.pos.y - a.pos.y;
            const d2 = dx * dx + dy * dy;
            const min = (BALL_R * 2) ** 2;
            if (d2 > 0 && d2 < min) {
              const d = Math.sqrt(d2) || 1e-4;
              const nx = dx / d,
                ny = dy / d;
              const overlap = (BALL_R * 2 - d) / 2;
              a.pos.x -= nx * overlap;
              a.pos.y -= ny * overlap;
              b.pos.x += nx * overlap;
              b.pos.y += ny * overlap;
              const avn = a.vel.x * nx + a.vel.y * ny;
              const bvn = b.vel.x * nx + b.vel.y * ny;
              const at = a.vel
                .clone()
                .sub(new THREE.Vector2(nx, ny).multiplyScalar(avn));
              const bt = b.vel
                .clone()
                .sub(new THREE.Vector2(nx, ny).multiplyScalar(bvn));
              a.vel.copy(at.add(new THREE.Vector2(nx, ny).multiplyScalar(bvn)));
              b.vel.copy(bt.add(new THREE.Vector2(nx, ny).multiplyScalar(avn)));
              const cueBall = a.id === 'cue' ? a : b.id === 'cue' ? b : null;
              if (!firstHit) {
                if (a.id === 'cue' && b.id !== 'cue') firstHit = b.id;
                else if (b.id === 'cue' && a.id !== 'cue') firstHit = a.id;
              }
              const hitBallId =
                a.id === 'cue' && b.id !== 'cue'
                  ? b.id
                  : b.id === 'cue' && a.id !== 'cue'
                    ? a.id
                    : null;
              if (
                hitBallId &&
                shooting &&
                activeShotView?.mode === 'action'
              ) {
                activeShotView.targetId = hitBallId;
                activeShotView.lockedTarget = true;
              }
              if (cueBall && cueBall.spin?.lengthSq() > 0) {
                cueBall.impacted = true;
                applySpinImpulse(cueBall, 1.1);
              }
            }
          }
        if (
          shooting &&
          activeShotView &&
          (activeShotView.mode === 'followCue' ||
            activeShotView.mode === 'action')
        ) {
          const followView = activeShotView;
          if (!followView.pendingPocket && firstHit) {
            const pocketView = makePocketCameraView(firstHit, followView);
            if (pocketView) {
              followView.pendingPocket = pocketView;
            }
          }
          if (followView.pendingPocket && !followView.userAdjusted) {
            const now = performance.now();
            const idleOrigin =
              followView.lastInteraction ?? followView.startedAt ?? lastInteraction;
            const idleFor = now - idleOrigin;
            if (
              !drag.on &&
              (POCKET_IDLE_SWITCH_MS <= 0 || idleFor >= POCKET_IDLE_SWITCH_MS)
            ) {
              const pocketView = followView.pendingPocket;
              followView.pendingPocket = null;
              activeShotView = pocketView;
              if (pocketView.resume) {
                followViewRef.current = pocketView.resume;
              }
            }
          }
        }
        // Kapje në xhepa
        balls.forEach((b) => {
          if (!b.active) return;
          for (const c of centers) {
            if (b.pos.distanceTo(c) < CAPTURE_R) {
              b.active = false;
              b.mesh.visible = false;
              b.vel.set(0, 0);
              if (b.spin) b.spin.set(0, 0);
              if (b.id === 'cue') b.impacted = false;
              if (b !== cue) potted.push(b.id.startsWith('red') ? 'red' : b.id);
              if (
                activeShotView?.mode === 'pocket' &&
                activeShotView.ballId === b.id
              ) {
                const pocketView = activeShotView;
                activeShotView = null;
                followViewRef.current = null;
                restoreOrbitCamera(pocketView);
              }
              break;
            }
          }
        });
        if (activeShotView?.mode === 'pocket') {
          const pocketView = activeShotView;
          const focusBall = balls.find((b) => b.id === pocketView.ballId);
          if (!focusBall?.active) {
            activeShotView = null;
            followViewRef.current = null;
            restoreOrbitCamera(pocketView);
          } else {
            const toPocket = pocketView.pocketCenter.clone().sub(focusBall.pos);
            const dist = toPocket.length();
            if (dist > 1e-4) {
              const approachDir = toPocket.clone().normalize();
              pocketView.approach.copy(approachDir);
              const speedAlong = focusBall.vel.dot(approachDir);
              if (speedAlong * frameScale < -STOP_EPS) {
                activeShotView = null;
                followViewRef.current = null;
                restoreOrbitCamera(pocketView);
              }
            }
          }
        }
        // Fund i goditjes
          if (shooting) {
            const any = balls.some(
              (b) => b.active && b.vel.length() * frameScale >= STOP_EPS
            );
            if (!any) resolve();
          }
          const fit = fitRef.current;
          if (fit && cue?.active && !shooting) {
            const limX = PLAY_W / 2 - BALL_R - TABLE.WALL;
            const limY = PLAY_H / 2 - BALL_R - TABLE.WALL;
            const edgeX = Math.max(0, Math.abs(cue.pos.x) - (limX - 5));
            const edgeY = Math.max(0, Math.abs(cue.pos.y) - (limY - 5));
            const edge = Math.min(1, Math.max(edgeX, edgeY) / 5);
            fit(1 + edge * 0.08);
          }
          updateCamera();
          renderer.render(scene, camera);
          rafRef.current = requestAnimationFrame(step);
        };
        step(performance.now());

      // Resize
      const onResize = () => {
        // Update canvas dimensions when the window size changes so the table
        // remains fully visible.
        renderer.setSize(host.clientWidth, host.clientHeight);
        const margin = Math.max(
          STANDING_VIEW.margin,
          topViewRef.current
            ? 1.05
            : window.innerHeight > window.innerWidth
              ? 1.6
              : 1.4
        );
        fit(margin);
      };
      window.addEventListener('resize', onResize);

      return () => {
        cancelAnimationFrame(rafRef.current);
        window.removeEventListener('resize', onResize);
        try {
          host.removeChild(renderer.domElement);
        } catch {}
        dom.removeEventListener('mousedown', down);
        dom.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
        dom.removeEventListener('touchstart', down);
        dom.removeEventListener('touchmove', move);
        window.removeEventListener('touchend', up);
        window.removeEventListener('keydown', keyRot);
        dom.removeEventListener('pointerdown', onPlace);
      };
    } catch (e) {
      console.error(e);
      setErr(e?.message || String(e));
    }
  }, [hud.inHand, hud.over]);

  // --------------------------------------------------
  // NEW Big Pull Slider (right side): drag DOWN to set power, releases → fire()
  // --------------------------------------------------
  const sliderRef = useRef(null);
  useEffect(() => {
    const mount = sliderRef.current;
    if (!mount) return;
    const slider = new SnookerPowerSlider({
      mount,
      value: powerRef.current * 100,
      cueSrc: '/assets/snooker/cue.webp',
      labels: true,
      onChange: (v) => setHud((s) => ({ ...s, power: v / 100 })),
      onCommit: () => fireRef.current?.()
    });
    return () => {
      slider.destroy();
    };
  }, []);

  // Spin controller interactions
  useEffect(() => {
    const box = document.getElementById('spinBox');
    const dot = document.getElementById('spinDot');
    if (!box || !dot) return;
    spinDotElRef.current = dot;

    box.style.transition = 'transform 0.18s ease';
    box.style.transformOrigin = '50% 50%';
    box.style.touchAction = 'none';

    let revertTimer = null;
    let activePointer = null;
    let moved = false;

    const clampToLimits = (nx, ny) => {
      const limits = spinLimitsRef.current || DEFAULT_SPIN_LIMITS;
      return {
        x: clamp(nx, limits.minX, limits.maxX),
        y: clamp(ny, limits.minY, limits.maxY)
      };
    };

    const setSpin = (nx, ny) => {
      const limited = clampToLimits(nx, ny);
      spinRef.current = limited;
      updateSpinDotPosition(limited);
    };
    const resetSpin = () => setSpin(0, 0);
    resetSpin();
    resetSpinRef.current = resetSpin;

    const updateSpin = (clientX, clientY) => {
      const rect = box.getBoundingClientRect();
      const cx = clientX ?? rect.left + rect.width / 2;
      const cy = clientY ?? rect.top + rect.height / 2;
      let nx = ((cx - rect.left) / rect.width) * 2 - 1;
      let ny = ((cy - rect.top) / rect.height) * 2 - 1;
      const L = Math.hypot(nx, ny) || 1;
      if (L > 1) {
        nx /= L;
        ny /= L;
      }
      const limited = clampToLimits(nx, ny);
      setSpin(limited.x, limited.y);
    };

    const scaleBox = (value) => {
      box.style.transform = `scale(${value})`;
    };
    scaleBox(1);

    const clearTimer = () => {
      if (revertTimer) {
        clearTimeout(revertTimer);
        revertTimer = null;
      }
    };

    const releasePointer = () => {
      if (activePointer !== null) {
        try {
          box.releasePointerCapture(activePointer);
        } catch {}
        activePointer = null;
      }
    };

    const handlePointerDown = (e) => {
      if (activePointer !== null) releasePointer();
      activePointer = e.pointerId;
      moved = false;
      clearTimer();
      scaleBox(1.35);
      updateSpin(e.clientX, e.clientY);
      box.setPointerCapture(activePointer);
      revertTimer = window.setTimeout(() => {
        if (!moved) scaleBox(1);
      }, 1500);
    };

    const handlePointerMove = (e) => {
      if (activePointer !== e.pointerId) return;
      if (e.pointerType === 'mouse' && e.buttons === 0) return;
      updateSpin(e.clientX, e.clientY);
      moved = true;
    };

    const finishInteraction = (restoreDelay = 60) => {
      releasePointer();
      clearTimer();
      revertTimer = window.setTimeout(() => scaleBox(1), restoreDelay);
    };

    const handlePointerUp = (e) => {
      if (activePointer !== e.pointerId) return;
      finishInteraction(50);
    };

    const handlePointerCancel = (e) => {
      if (activePointer !== e.pointerId) return;
      releasePointer();
      clearTimer();
      scaleBox(1);
    };

    box.addEventListener('pointerdown', handlePointerDown);
    box.addEventListener('pointermove', handlePointerMove);
    box.addEventListener('pointerup', handlePointerUp);
    box.addEventListener('pointercancel', handlePointerCancel);

    return () => {
      spinDotElRef.current = null;
      releasePointer();
      clearTimer();
      resetSpinRef.current = () => {};
      box.removeEventListener('pointerdown', handlePointerDown);
      box.removeEventListener('pointermove', handlePointerMove);
      box.removeEventListener('pointerup', handlePointerUp);
      box.removeEventListener('pointercancel', handlePointerCancel);
    };
  }, [updateSpinDotPosition]);

  return (
    <div className="w-full h-[100vh] bg-black text-white overflow-hidden select-none">
      {/* Canvas host now stretches full width so table reaches the slider */}
      <div ref={mountRef} className="absolute inset-0" />

      {/* Top HUD */}
      <div className="absolute top-0 left-0 right-0 flex justify-center pointer-events-none z-50">
        <div
          className="bg-gray-800 px-4 py-2 rounded-b flex flex-col items-center text-white"
          style={{
            transform: `scale(${UI_SCALE})`,
            transformOrigin: 'top center'
          }}
        >
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <img
                src={player.avatar || '/assets/icons/profile.svg'}
                alt="player"
                className="w-10 h-10 rounded-full object-cover border-2 border-yellow-400"
              />
              <span className={hud.turn === 0 ? 'text-yellow-400' : ''}>
                {player.name}
              </span>
            </div>
            <div className="text-xl font-bold">
              {hud.A} - {hud.B}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full border-2 border-yellow-400 flex items-center justify-center">
                <span className="text-3xl leading-none">{aiFlag}</span>
              </div>
              <span className={hud.turn === 1 ? 'text-yellow-400' : ''}>
                AI
              </span>
            </div>
          </div>
          <div className="mt-1 text-sm">Time: {timer}</div>
        </div>
      </div>

      {err && (
        <div className="absolute inset-0 bg-black/80 text-white text-xs flex items-center justify-center p-4 z-50">
          Init error: {String(err)}
        </div>
      )}
      {/* Power Slider */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2">
        <div
          ref={sliderRef}
          style={{
            transform: `scale(${UI_SCALE})`,
            transformOrigin: 'top right'
          }}
        />
      </div>

      {/* Spin controller */}
      <div
        className="absolute bottom-4 right-4"
        style={{
          transform: `scale(${UI_SCALE})`,
          transformOrigin: 'bottom right'
        }}
      >
        <div
          id="spinBox"
          className="relative w-32 h-32 rounded-full bg-white shadow-lg"
        >
          <div
            id="spinDot"
            className="absolute w-3 h-3 rounded-full bg-red-600 -translate-x-1/2 -translate-y-1/2"
            style={{ left: '50%', top: '50%' }}
          ></div>
        </div>
      </div>
    </div>
  );
}

export default function NewSnookerGame() {
  const isMobileOrTablet = useIsMobile(1366);

  if (!isMobileOrTablet) {
    return (
      <div className="flex items-center justify-center w-full h-full p-4 text-center">
        <p>This game is available on mobile phones and tablets only.</p>
      </div>
    );
  }

  return <SnookerGame />;
}
