import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import * as THREE from 'three';
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
const JAW_H = 2.1;
const JAW_T = 1.05;
const JAW_INNER_SCALE = 0.048;
const JAW_CENTER_PULL_SCALE = 0.028;
const SECTOR_SWEEP = Math.PI * 0.52;
const SIDE_SECTOR_SWEEP = Math.PI * 0.32;
const SECTOR_START = -SECTOR_SWEEP;
const SECTOR_END = SECTOR_SWEEP;
const jawMat = new THREE.MeshPhysicalMaterial({
  color: 0x1c1c1c,
  roughness: 0.42,
  metalness: 0.12,
  clearcoat: 0.45
});
const jawCapMat = new THREE.MeshPhysicalMaterial({
  color: 0x050505,
  roughness: 0.32,
  metalness: 0.65,
  clearcoat: 0.25,
  clearcoatRoughness: 0.32,
  envMapIntensity: 0.9
});
function makeJawSector(
  R = POCKET_VIS_R,
  T = JAW_T,
  start = SECTOR_START,
  end = SECTOR_END,
  depth = JAW_H
) {
  const outer = R + T;
  const inner = R + Math.max(T * 0.32, R * JAW_INNER_SCALE);
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
    depth,
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
    { id: 'side_left', type: 'side', pos: [-HALF_PLAY_W, 0] },
    { id: 'side_right', type: 'side', pos: [HALF_PLAY_W, 0] }
  ];
  const jaws = [];
  const jawTopLocal = POCKET_JAW_LIP_HEIGHT;
  const jawDepthTarget = CLOTH_THICKNESS;
  const capHeight = CLOTH_THICKNESS * 0.36;
  const capLift = CLOTH_THICKNESS * 0.012;
  const cornerJawGeo = makeJawSector();
  const sideJawGeo = makeJawSector(
    POCKET_VIS_R * 0.94,
    JAW_T * 0.72,
    -SIDE_SECTOR_SWEEP,
    SIDE_SECTOR_SWEEP
  );
  const cornerCapGeo = makeJawSector(
    POCKET_VIS_R,
    JAW_T,
    SECTOR_START,
    SECTOR_END,
    capHeight
  );
  const sideCapGeo = makeJawSector(
    POCKET_VIS_R,
    JAW_T * 0.82,
    -SIDE_SECTOR_SWEEP,
    SIDE_SECTOR_SWEEP,
    capHeight
  );
  for (const entry of POCKET_MAP) {
    const p = new THREE.Vector2(entry.pos[0], entry.pos[1]);
    const centerPull =
      entry.type === 'corner' ? POCKET_VIS_R * JAW_CENTER_PULL_SCALE : 0;
    const pullDir =
      entry.type === 'side'
        ? new THREE.Vector2(entry.pos[0] >= 0 ? -1 : 1, 0)
        : p.clone().multiplyScalar(-1);
    const pShift = p.clone();
    if (centerPull > 0 && pullDir.lengthSq() > 1e-6) {
      pullDir.normalize();
      pShift.add(pullDir.multiplyScalar(centerPull));
    }
    const geom = (entry.type === 'side' ? sideJawGeo : cornerJawGeo).clone();
    geom.computeBoundingBox();
    const bbox = geom.boundingBox;
    const topShift = bbox ? -bbox.max.y : 0;
    if (Math.abs(topShift) > 1e-6) {
      geom.translate(0, topShift, 0);
      geom.computeBoundingBox();
    }
    const adjustedBox = geom.boundingBox;
    const currentDepth = adjustedBox
      ? Math.abs(adjustedBox.min.y)
      : jawDepthTarget;
    if (currentDepth > 1e-6 && Math.abs(currentDepth - jawDepthTarget) > 1e-6) {
      const depthScale = jawDepthTarget / currentDepth;
      geom.scale(1, depthScale, 1);
    }
    geom.computeVertexNormals();
    geom.computeBoundingBox();
    geom.computeBoundingSphere();
    const jaw = new THREE.Mesh(geom, jawMat);
    jaw.castShadow = true;
    jaw.receiveShadow = true;
    jaw.position.set(pShift.x, jawTopLocal, pShift.y);
    const lookTarget = (() => {
      if (entry.type === 'side') {
        const dir = entry.pos[0] >= 0 ? -1 : 1;
        return new THREE.Vector3(
          jaw.position.x + dir * POCKET_VIS_R * 1.5,
          jaw.position.y - 0.05,
          jaw.position.z
        );
      }
      const towardCenter = new THREE.Vector3(
        pShift.x * 0.35,
        jaw.position.y - 0.08,
        pShift.y * 0.35
      );
      return towardCenter;
    })();
    jaw.lookAt(lookTarget);
    const capGeo =
      (entry.type === 'side' ? sideCapGeo : cornerCapGeo).clone();
    capGeo.computeBoundingBox();
    capGeo.computeBoundingSphere();
    const cap = new THREE.Mesh(capGeo, jawCapMat);
    cap.castShadow = false;
    cap.receiveShadow = true;
    cap.position.y = capLift;
    jaw.add(cap);
    jaw.userData = {
      ...(jaw.userData || {}),
      cap,
      capHeight,
      capLift
    };
    parent.add(jaw);
    jaws.push(jaw);
  }
  return jaws;
}

function addPocketCuts(parent, clothPlane) {
  const cuts = [];
  const cornerDepth = POCKET_VIS_R * 1.35;
  const cornerCurve = cornerDepth * 0.45;
  const sideDepth = POCKET_VIS_R * 1.12;
  const sideHalfWidth = POCKET_VIS_R * 0.92;
  const mat = new THREE.MeshStandardMaterial({
    color: 0x060606,
    roughness: 0.78,
    metalness: 0.12,
    emissive: new THREE.Color(0x090909),
    emissiveIntensity: 0.35,
    side: THREE.DoubleSide
  });
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = -1;
  mat.polygonOffsetUnits = -6;
  mat.depthWrite = false;
  mat.depthTest = true;
  const cornerShape = (() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(cornerDepth, 0);
    s.quadraticCurveTo(
      cornerDepth + cornerCurve * 0.2,
      cornerCurve * 0.25,
      cornerDepth * 0.92,
      cornerDepth * 0.7
    );
    s.lineTo(cornerDepth * 0.35, cornerDepth);
    s.lineTo(0, cornerDepth);
    s.closePath();
    return s;
  })();
  const sideShape = (() => {
    const s = new THREE.Shape();
    s.moveTo(-sideHalfWidth, 0);
    s.lineTo(sideHalfWidth, 0);
    s.lineTo(sideHalfWidth * 0.82, sideDepth);
    s.quadraticCurveTo(0, sideDepth * 1.18, -sideHalfWidth * 0.82, sideDepth);
    s.closePath();
    return s;
  })();
  const cornerGeo = new THREE.ShapeGeometry(cornerShape);
  const sideGeo = new THREE.ShapeGeometry(sideShape);
  pocketCenters().forEach((p) => {
    const isCorner =
      Math.abs(Math.abs(p.x) - PLAY_W / 2) < 1e-3 &&
      Math.abs(Math.abs(p.y) - PLAY_H / 2) < 1e-3;
    const geom = isCorner ? cornerGeo.clone() : sideGeo.clone();
    const mesh = new THREE.Mesh(geom, mat.clone());
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(p.x, clothPlane + POCKET_RIM_LIFT, p.y);
    mesh.renderOrder = 6;
    if (isCorner) {
      const sx = Math.sign(p.x) || 1;
      const sy = Math.sign(p.y) || 1;
      mesh.scale.x = sx >= 0 ? -1 : 1;
      mesh.scale.z = sy >= 0 ? -1 : 1;
    } else {
      const sy = Math.sign(p.y) || 1;
      mesh.scale.z = sy >= 0 ? -1 : 1;
    }
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    parent.add(mesh);
    cuts.push(mesh);
  });
  return cuts;
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
const FRAME_TOP_Y = -TABLE.THICK + 0.01;
const CLOTH_LIFT = (() => {
  const ballR = 2 * BALL_SCALE;
  const microEpsRatio = 0.022857142857142857;
  const eps = ballR * microEpsRatio;
  const railH = TABLE.THICK * 1.82;
  return Math.max(0, railH - ballR - eps);
})();
const PLAY_W = TABLE.W - 2 * TABLE.WALL;
const PLAY_H = TABLE.H - 2 * TABLE.WALL;
const ACTION_CAMERA_START_BLEND = 0;
const ACTION_CAMERA_VERTICAL_MIN_SCALE = 0.78;
const ACTION_CAMERA_VERTICAL_CURVE = 0.65;
const ACTION_CAMERA_LONG_SIDE_SCALE = Math.min(
  1,
  Math.max(0.62, PLAY_W / PLAY_H)
);
const ACTION_CAMERA_LONG_SIDE_CURVE = 2;
const ACTION_CAMERA_CORNER_PULLBACK = 0.18;
const ACTION_CAMERA_CORNER_CURVE = 1.35;
const BALL_R = 2 * BALL_SCALE;
const CLOTH_TOP_LOCAL = FRAME_TOP_Y + BALL_R * 0.09523809523809523;
const MICRO_EPS = BALL_R * 0.022857142857142857;
const POCKET_R = BALL_R * 2; // pockets twice the ball radius
// slightly larger visual radius so rails align with pocket rings
const POCKET_VIS_R = POCKET_R / 0.97;
const POCKET_HOLE_R = POCKET_VIS_R * 1.3; // cloth cutout radius for pocket openings
const BALL_CENTER_Y = CLOTH_TOP_LOCAL + CLOTH_LIFT + BALL_R; // rest balls directly on the cloth plane
const BALL_SEGMENTS = Object.freeze({ width: 64, height: 48 });
const BALL_GEOMETRY = new THREE.SphereGeometry(
  BALL_R,
  BALL_SEGMENTS.width,
  BALL_SEGMENTS.height
);
const BALL_MATERIAL_CACHE = new Map();
// Slightly faster surface to keep balls rolling realistically on the snooker cloth
// Slightly reduce per-frame friction so rolls feel livelier on high refresh
// rate displays (e.g. 90 Hz) instead of drifting into slow motion.
const FRICTION = 0.993;
const CUSHION_RESTITUTION = 0.99;
const STOP_EPS = 0.02;
const TARGET_FPS = 90;
const TARGET_FRAME_TIME_MS = 1000 / TARGET_FPS;
const MAX_FRAME_TIME_MS = TARGET_FRAME_TIME_MS * 3; // allow up to 3 frames of catch-up
const MIN_FRAME_SCALE = 1e-6; // prevent zero-length frames from collapsing physics updates
const CAPTURE_R = POCKET_R; // pocket capture radius
const CLOTH_THICKNESS = TABLE.THICK * 0.12; // render a thinner cloth so the playing surface feels lighter
const POCKET_JAW_LIP_HEIGHT =
  CLOTH_TOP_LOCAL + CLOTH_LIFT; // keep the pocket rims in contact with the cloth surface
const CUSHION_OVERLAP = TABLE.WALL * 0.35; // overlap between cushions and rails to hide seams
const POCKET_RIM_LIFT = CLOTH_THICKNESS * 0.2; // subtle lift so pocket rims sit just above the cloth surface
const POCKET_RECESS_DEPTH =
  BALL_R * 0.24; // keep the pocket throat visible without sinking the rim
const POCKET_CLOTH_TOP_RADIUS = POCKET_VIS_R * 0.84;
const POCKET_CLOTH_BOTTOM_RADIUS = POCKET_CLOTH_TOP_RADIUS * 0.62;
const POCKET_DROP_TOP_SCALE = 0.82;
const POCKET_DROP_BOTTOM_SCALE = 0.48;
const POCKET_CLOTH_DEPTH = POCKET_RECESS_DEPTH * 1.05;
const POCKET_CAM = Object.freeze({
  triggerDist: CAPTURE_R * 3.8,
  dotThreshold: 0.3,
  minOutside: TABLE.WALL + POCKET_VIS_R * 0.95,
  maxOutside: BALL_R * 32,
  heightOffset: BALL_R * 5.1
});
const SPIN_STRENGTH = BALL_R * 0.5;
const SPIN_DECAY = 0.88;
const SPIN_ROLL_STRENGTH = BALL_R * 0.035;
const SPIN_ROLL_DECAY = 0.978;
const SPIN_AIR_DECAY = 0.997; // hold spin energy while the cue ball travels straight pre-impact
const SWERVE_THRESHOLD = 0.85; // outer 15% of the spin control activates swerve behaviour
const SWERVE_TRAVEL_MULTIPLIER = 0.55; // dampen sideways drift while swerve is active so it stays believable
const PRE_IMPACT_SPIN_DRIFT = 0.12; // reapply stored sideways swerve once the cue ball is rolling after impact
// Base shot speed tuned for livelier pace while keeping slider sensitivity manageable.
const SHOT_FORCE_BOOST = 1.4; // boost cue strike strength by 40%
const SHOT_BASE_SPEED = 3.3 * 0.3 * 1.65 * SHOT_FORCE_BOOST;
const SHOT_MIN_FACTOR = 0.25;
const SHOT_POWER_RANGE = 0.75;
// Make the four round legs dramatically taller so the table surface rides higher
const LEG_SCALE = 6.2;
const LEG_HEIGHT_FACTOR = 4;
const LEG_HEIGHT_MULTIPLIER = 2.25;
const BASE_TABLE_LIFT = 3.0;
const TABLE_DROP = 0.4;
const TABLE_H = 0.75 * LEG_SCALE; // physical height of table used for legs/skirt
const TABLE_LIFT =
  BASE_TABLE_LIFT + TABLE_H * (LEG_HEIGHT_FACTOR - 1);
// raise overall table position so the longer legs are visible and the playfield sits higher off the floor
const TABLE_Y = -2 + (TABLE_H - 0.75) + TABLE_H + TABLE_LIFT - TABLE_DROP;
const BASE_LEG_HEIGHT = TABLE.THICK * 2 * 3 * 1.15 * LEG_HEIGHT_MULTIPLIER;
const LEG_RADIUS_SCALE = 1.2; // 20% thicker cylindrical legs
const LEG_LENGTH_SCALE = 0.6; // 40% shorter legs relative to the previous build
const LEG_HEIGHT_OFFSET = FRAME_TOP_Y - 0.3; // relationship between leg room and visible leg height
const LEG_ROOM_HEIGHT_RAW = BASE_LEG_HEIGHT + TABLE_LIFT;
const LEG_ROOM_HEIGHT =
  (LEG_ROOM_HEIGHT_RAW + LEG_HEIGHT_OFFSET) * LEG_LENGTH_SCALE - LEG_HEIGHT_OFFSET;
const FLOOR_Y = TABLE_Y - TABLE.THICK - LEG_ROOM_HEIGHT + 0.3;
const CUE_TIP_GAP = BALL_R * 1.45; // pull cue stick slightly farther back for a more natural stance
const CUE_Y = BALL_CENTER_Y; // keep cue stick level with the cue ball center
const CUE_TIP_RADIUS = (BALL_R / 0.0525) * 0.006 * 1.5;
const CUE_MARKER_RADIUS = CUE_TIP_RADIUS; // cue ball dots match the cue tip footprint
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
const CUSHION_CUT_ANGLE = 32;
const CUSHION_BACK_TRIM = 0.8; // trim 20% off the cushion back that meets the rails
const CUSHION_FACE_INSET = TABLE.WALL * 0.09; // pull cushions slightly closer to centre for a tighter pocket entry

// shared UI reduction factor so overlays and controls shrink alongside the table
const UI_SCALE = SIZE_REDUCTION;

// Updated colors for dark cloth and standard balls
// includes separate tones for rails, base wood and cloth markings
const RAIL_WOOD_COLOR = 0x4a2c18;
const BASE_WOOD_COLOR = 0x2f1b11;
const COLORS = Object.freeze({
  cloth: 0x1f8a3d,
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

const createClothTextures = (() => {
  let cache = null;
  const baseColor = new THREE.Color(COLORS.cloth);
  const srgbBase = baseColor.clone().convertLinearToSRGB();
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const noise = (x, y) => {
    const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return value - Math.floor(value);
  };
  return () => {
    if (cache) return cache;
    if (typeof document === 'undefined') {
      cache = { map: null, bump: null };
      return cache;
    }
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const n = noise(x, y) * 0.24 - 0.12;
        const weave = Math.sin((x / size) * Math.PI * 28) * 0.055;
        const cross = Math.sin((y / size) * Math.PI * 22) * 0.045;
        const diag = Math.sin(((x + y) / size) * Math.PI * 20) * 0.035;
        const variation = clamp01(
          srgbBase.r + n * 0.65 + weave + cross * 0.6 + diag * 0.35
        );
        const tint = clamp01(
          srgbBase.g + n * 0.75 + weave * 0.55 + diag * 0.4
        );
        const depth = clamp01(
          srgbBase.b + n * 0.6 + cross * 0.5 + diag * 0.35
        );
        image.data[idx] = variation * 255;
        image.data[idx + 1] = tint * 255;
        image.data[idx + 2] = depth * 255;
        image.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 10;

    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = bumpCanvas.height = size;
    const bumpCtx = bumpCanvas.getContext('2d');
    const bumpImage = bumpCtx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const n = noise(x + 17.31, y + 91.27) * 0.6 - 0.3;
        const fiberX = Math.sin((x / size) * Math.PI * 26) * 0.35;
        const fiberY = Math.sin((y / size) * Math.PI * 24) * 0.28;
        const shade = clamp01(0.55 + n + fiberX + fiberY * 0.85);
        const value = shade * 255;
        bumpImage.data[idx] = value;
        bumpImage.data[idx + 1] = value;
        bumpImage.data[idx + 2] = value;
        bumpImage.data[idx + 3] = 255;
      }
    }
    bumpCtx.putImageData(bumpImage, 0, 0);
    const bump = new THREE.CanvasTexture(bumpCanvas);
    bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
    bump.anisotropy = 6;

    cache = { map: texture, bump };
    return cache;
  };
})();

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
const CUE_SHOT_PHI = Math.PI / 2 - 0.3;
const STANDING_VIEW_MARGIN = 0.72;
const STANDING_VIEW_FOV = 62;
const CAMERA_MIN_PHI = STANDING_VIEW_PHI + 0.01;
const CAMERA_MAX_PHI = CUE_SHOT_PHI - 0.02;
const CAMERA = {
  fov: STANDING_VIEW_FOV,
  near: 0.1,
  far: 4000,
  minR: 20 * TABLE_SCALE * GLOBAL_SIZE_FACTOR * 0.9,
  maxR: 260 * TABLE_SCALE * GLOBAL_SIZE_FACTOR,
  minPhi: CAMERA_MIN_PHI,
  // keep the camera slightly above the horizontal plane but allow a lower sweep
  maxPhi: CAMERA_MAX_PHI
};
const CAMERA_CUSHION_CLEARANCE = BALL_R * 0.55;
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
  radius: 102 * TABLE_SCALE * GLOBAL_SIZE_FACTOR * 0.76,
  phi: CAMERA.maxPhi - 0.14
});
const CAMERA_ZOOM_RANGE = Object.freeze({
  near: 0.9,
  far: 1.05
});
const CAMERA_RAIL_SAFETY = 0.015;
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
  CAMERA.minPhi + 0.02
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
const TMP_VEC2_FORWARD = new THREE.Vector2();
const TMP_VEC2_LATERAL = new THREE.Vector2();
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
  return THREE.MathUtils.lerp(ACTION_CAMERA_VERTICAL_MIN_SCALE, 1, eased);
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

  const clothColor = new THREE.Color(COLORS.cloth);
  const baseCloth = `#${clothColor.getHexString()}`;
  ctx.fillStyle = baseCloth;
  ctx.fillRect(0, 0, size, size);

  const diagonalShade = ctx.createLinearGradient(0, 0, size, size);
  diagonalShade.addColorStop(0, 'rgba(255,255,255,0.08)');
  diagonalShade.addColorStop(0.55, 'rgba(0,0,0,0.12)');
  diagonalShade.addColorStop(1, 'rgba(0,0,0,0.2)');
  ctx.fillStyle = diagonalShade;
  ctx.fillRect(0, 0, size, size);

  const threadStep = 4; // emphasise the primary warp/weft directions
  ctx.lineWidth = 0.6;
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  for (let x = -threadStep; x < size + threadStep; x += threadStep) {
    ctx.beginPath();
    ctx.moveTo(x + threadStep * 0.35, 0);
    ctx.lineTo(x + threadStep * 0.35, size);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  for (let y = -threadStep; y < size + threadStep; y += threadStep) {
    ctx.beginPath();
    ctx.moveTo(0, y + threadStep * 0.6);
    ctx.lineTo(size, y + threadStep * 0.6);
    ctx.stroke();
  }

  const spacing = 1;
  for (let y = 0; y < size; y += spacing) {
    for (let x = 0; x < size; x += spacing) {
      ctx.fillStyle = (x + y) % (spacing * 2) === 0
        ? 'rgba(255,255,255,0.22)'
        : 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.arc(x, y, 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.lineWidth = 0.48;
  ctx.strokeStyle = 'rgba(0,0,0,0.32)';
  for (let i = 0; i < 450000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const angle = Math.random() * Math.PI * 2;
    const length = Math.random() * 0.6 + 0.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.26)';
  for (let i = 0; i < 220000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const angle = Math.random() * Math.PI * 2;
    const length = Math.random() * 0.45 + 0.15;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    ctx.stroke();
  }

  ctx.globalAlpha = 0.24;
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  for (let i = 0; i < 36000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  const baseRepeat = 7.2;
  const repeatX = baseRepeat * (PLAY_W / TABLE.W);
  const repeatY = baseRepeat * (PLAY_H / TABLE.H);
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 48;
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
  if (ball.id === 'cue' && ball.spinMode === 'swerve') {
    ball.spinMode = 'standard';
  }
  const decayFactor = Math.pow(SPIN_DECAY, Math.max(scale, 0.5));
  ball.spin.multiplyScalar(decayFactor);
  if (ball.spin.lengthSq() < 1e-6) {
    ball.spin.set(0, 0);
    if (ball.pendingSpin) ball.pendingSpin.set(0, 0);
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
      new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.18,
        clearcoat: 1,
        clearcoatRoughness: 0.12
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
    spinMode: 'standard',
    impacted: false,
    launchDir: null,
    pendingSpin: new THREE.Vector2(),
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
  const tolerance = 1e-3;
  if (Math.abs(diff) > tolerance) {
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
  const halfW = PLAY_W / 2;
  const halfH = PLAY_H / 2;
  const baulkLineZ = -PLAY_H / 4;

  const clothMat = new THREE.MeshPhysicalMaterial({
    color: COLORS.cloth,
    roughness: 0.7,
    metalness: 0.05,
    sheen: 1.0,
    sheenRoughness: 0.52
  });
  const clothTextures = createClothTextures();
  const baseRepeat = 18;
  if (clothTextures.map) {
    clothMat.map = clothTextures.map;
    clothMat.map.repeat.set(baseRepeat, baseRepeat);
    clothMat.map.needsUpdate = true;
  }
  if (clothTextures.bump) {
    clothMat.bumpMap = clothTextures.bump;
    clothMat.bumpMap.repeat.set(baseRepeat, baseRepeat);
    clothMat.bumpScale = 0.16;
    clothMat.bumpMap.needsUpdate = true;
  }
  clothMat.userData = {
    ...(clothMat.userData || {}),
    baseRepeat,
    nearRepeat: baseRepeat * 1.25,
    farRepeat: baseRepeat * 0.6,
    bumpScale: clothMat.bumpScale
  };
  const cushionMat = clothMat.clone();
  const woodMat = new THREE.MeshStandardMaterial({
    color: COLORS.base,
    metalness: 0.2,
    roughness: 0.8
  });
  const railWoodMat = new THREE.MeshStandardMaterial({
    color: COLORS.rail,
    metalness: 0.3,
    roughness: 0.8
  });

  const frameTopY = FRAME_TOP_Y;
  const clothPlaneLocal = CLOTH_TOP_LOCAL + CLOTH_LIFT;

  const POCKET_TOP_R = POCKET_VIS_R * 1.05;
  const POCKET_BOTTOM_R = POCKET_VIS_R * 0.7;
  const clothShape = new THREE.Shape();
  const clothExtend = Math.max(
    TABLE.WALL * 0.18,
    Math.min(PLAY_W, PLAY_H) * 0.0055
  );
  const halfWext = halfW + clothExtend;
  const halfHext = halfH + clothExtend;
  clothShape.moveTo(-halfWext, -halfHext);
  clothShape.lineTo(halfWext, -halfHext);
  clothShape.lineTo(halfWext, halfHext);
  clothShape.lineTo(-halfWext, halfHext);
  clothShape.lineTo(-halfWext, -halfHext);
  pocketCenters().forEach((p) => {
    const hole = new THREE.Path();
    hole.absellipse(p.x, p.y, POCKET_TOP_R * 0.98, POCKET_TOP_R * 0.98, 0, Math.PI * 2);
    clothShape.holes.push(hole);
  });
  const clothGeo = new THREE.ShapeGeometry(clothShape, 64);
  const cloth = new THREE.Mesh(clothGeo, clothMat);
  cloth.rotation.x = -Math.PI / 2;
  cloth.position.y = clothPlaneLocal;
  cloth.renderOrder = 3;
  table.add(cloth);

  const markingsGroup = new THREE.Group();
  const markingMat = new THREE.MeshBasicMaterial({
    color: COLORS.markings,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide
  });
  const markingHeight = clothPlaneLocal + MICRO_EPS * 2;
  const lineThickness = Math.max(BALL_R * 0.08, 0.1);
  const baulkLineLength = PLAY_W - TABLE.WALL * 0.4;
  const baulkLineGeom = new THREE.PlaneGeometry(baulkLineLength, lineThickness);
  const baulkLine = new THREE.Mesh(baulkLineGeom, markingMat);
  baulkLine.rotation.x = -Math.PI / 2;
  baulkLine.position.set(0, markingHeight, baulkLineZ);
  markingsGroup.add(baulkLine);

  const dRadius = PLAY_W * 0.164;
  const dThickness = Math.max(lineThickness * 0.75, BALL_R * 0.07);
  const dGeom = new THREE.RingGeometry(
    Math.max(0.001, dRadius - dThickness),
    dRadius,
    64,
    1,
    0,
    Math.PI
  );
  const dArc = new THREE.Mesh(dGeom, markingMat.clone());
  dArc.rotation.x = -Math.PI / 2;
  dArc.position.set(0, markingHeight, baulkLineZ);
  markingsGroup.add(dArc);

  const spotRadius = Math.max(BALL_R * 0.14, 0.22);
  const spotGeom = new THREE.CircleGeometry(spotRadius, 48);
  const spotMat = markingMat.clone();
  spotMat.opacity = 0.95;
  const spotMap = spotPositions(baulkLineZ);
  Object.values(spotMap).forEach(([sx, sz]) => {
    const spot = new THREE.Mesh(spotGeom, spotMat);
    spot.rotation.x = -Math.PI / 2;
    spot.position.set(sx, markingHeight, sz);
    markingsGroup.add(spot);
  });

  markingsGroup.traverse((child) => {
    if (child.isMesh) {
      child.renderOrder = cloth.renderOrder + 1;
      child.castShadow = false;
      child.receiveShadow = false;
    }
  });
  table.add(markingsGroup);

  const ringGeo = new THREE.RingGeometry(
    POCKET_TOP_R * 0.68,
    POCKET_TOP_R * 1.02,
    64
  );
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x000000,
    side: THREE.DoubleSide,
    metalness: 0.4,
    roughness: 0.5
  });
  const ringLift = BALL_R * 0.007619047619047619;

  const pocketGeo = new THREE.CylinderGeometry(
    POCKET_TOP_R,
    POCKET_BOTTOM_R,
    TABLE.THICK,
    32
  );
  const pocketMat = new THREE.MeshStandardMaterial({
    color: 0x000000,
    metalness: 0.6,
    roughness: 0.4
  });
  const pocketMeshes = [];
  pocketCenters().forEach((p) => {
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(p.x, clothPlaneLocal + ringLift, p.y);
    ring.receiveShadow = false;
    ring.castShadow = false;
    table.add(ring);

    const pocket = new THREE.Mesh(pocketGeo, pocketMat);
    pocket.position.set(p.x, clothPlaneLocal - TABLE.THICK / 2, p.y);
    pocket.receiveShadow = true;
    table.add(pocket);
    pocketMeshes.push(pocket);
  });

  const railW = TABLE.WALL * 0.7;
  const railH = TABLE.THICK * 1.82;
  const frameWidth = railW * 0.5; // slimmer top rail overhang
  const outerHalfW = halfW + 2 * railW + frameWidth;
  const outerHalfH = halfH + 2 * railW + frameWidth;
  const cushionBack = railW * 0.5;
  const railsGroup = new THREE.Group();

  function buildSideRail(sign) {
    const xIn = (sign < 0 ? -1 : 1) * (halfW + cushionBack - MICRO_EPS);
    const xOut = (sign < 0 ? -1 : 1) * outerHalfW;
    const shape = new THREE.Shape();
    shape.moveTo(xOut, -outerHalfH);
    shape.lineTo(xOut, outerHalfH);
    shape.lineTo(xIn, outerHalfH);
    shape.lineTo(xIn, -outerHalfH);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: railH,
      bevelEnabled: false
    });
    const mesh = new THREE.Mesh(geo, railWoodMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = frameTopY;
    railsGroup.add(mesh);
  }

  function buildEndRail(sign) {
    const zIn = (sign < 0 ? -1 : 1) * (halfH + cushionBack - MICRO_EPS);
    const zOut = sign < 0 ? -outerHalfH : outerHalfH;
    const shape = new THREE.Shape();
    shape.moveTo(-outerHalfW, zOut);
    shape.lineTo(outerHalfW, zOut);
    shape.lineTo(outerHalfW, zIn);
    shape.lineTo(-outerHalfW, zIn);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: railH,
      bevelEnabled: false
    });
    const mesh = new THREE.Mesh(geo, railWoodMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = frameTopY;
    railsGroup.add(mesh);
  }

  buildSideRail(-1);
  buildSideRail(1);
  buildEndRail(-1);
  buildEndRail(1);
  table.add(railsGroup);

  const FACE_SHRINK_LONG = 0.955;
  const FACE_SHRINK_SHORT = 0.97;
  const NOSE_REDUCTION = 0.75;
  const CUSHION_UNDERCUT_BASE_LIFT = 0.32;
  const CUSHION_UNDERCUT_FRONT_REMOVAL = 0.54;
  const cushionRaiseY = CLOTH_TOP_LOCAL - MICRO_EPS;

  function cushionProfileAdvanced(len, horizontal) {
    const halfLen = len / 2;
    const thicknessScale = horizontal ? FACE_SHRINK_LONG : FACE_SHRINK_SHORT;
    const baseThickness = TABLE.WALL * 0.7 * thicknessScale;
    const backY = (TABLE.WALL * 0.7) / 2;
    const noseThickness = baseThickness * NOSE_REDUCTION;
    const frontY = backY - noseThickness;
    const rad = THREE.MathUtils.degToRad(CUSHION_CUT_ANGLE);
    const straightCut = Math.max(baseThickness * 0.25, noseThickness / Math.tan(rad));

    const shape = new THREE.Shape();
    shape.moveTo(-halfLen, backY);
    shape.lineTo(halfLen, backY);
    shape.lineTo(halfLen - straightCut, frontY);
    shape.lineTo(-halfLen + straightCut, frontY);
    shape.lineTo(-halfLen, backY);

    const cushionBevel = Math.min(railH, baseThickness) * 0.12;
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: railH,
      bevelEnabled: true,
      bevelThickness: cushionBevel * 0.6,
      bevelSize: cushionBevel,
      bevelSegments: 2,
      curveSegments: 8
    });

    const pos = geo.attributes.position;
    const arr = pos.array;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < arr.length; i += 3) {
      const z = arr[i + 2];
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    const depth = maxZ - minZ;
    const frontSpan = backY - frontY;
    for (let i = 0; i < arr.length; i += 3) {
      const y = arr[i + 1];
      const z = arr[i + 2];
      const frontFactor = THREE.MathUtils.clamp((backY - y) / frontSpan, 0, 1);
      if (frontFactor <= 0) continue;
      const taperedLift = CUSHION_UNDERCUT_FRONT_REMOVAL * frontFactor;
      const lift = Math.min(CUSHION_UNDERCUT_BASE_LIFT + taperedLift, 0.94);
      const minAllowedZ = minZ + depth * lift;
      if (z < minAllowedZ) arr[i + 2] = minAllowedZ;
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }

  table.userData.cushions = [];

  function addCushion(x, z, len, horizontal, flip = false) {
    const geo = cushionProfileAdvanced(len, horizontal);
    const mesh = new THREE.Mesh(geo, cushionMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 2;
    const group = new THREE.Group();
    group.add(mesh);
    group.position.set(x, cushionRaiseY, z);
    if (!horizontal) group.rotation.y = Math.PI / 2;
    if (flip) group.rotation.y += Math.PI;

    const EDGE_BIAS_LONG = MICRO_EPS;
    const EDGE_BIAS_SHORT = 0;
    if (horizontal) {
      group.position.z = z > 0 ? halfH + EDGE_BIAS_SHORT : -halfH - EDGE_BIAS_SHORT;
    } else {
      group.position.x = x > 0 ? halfW + EDGE_BIAS_LONG : -halfW - EDGE_BIAS_LONG;
    }

    group.userData = group.userData || {};
    group.userData.horizontal = horizontal;
    group.userData.side = horizontal ? (z >= 0 ? 1 : -1) : x >= 0 ? 1 : -1;
    table.add(group);
    table.userData.cushions.push(group);
  }

  const POCKET_GAP = POCKET_VIS_R * 0.72;
  const horizLen = PLAY_W - 2 * POCKET_GAP;
  const vertSeg = PLAY_H / 2 - 2 * POCKET_GAP;
  const bottomZ = -halfH;
  const topZ = halfH;
  const leftX = -halfW;
  const rightX = halfW;

  addCushion(0, bottomZ, horizLen, true, false);
  addCushion(0, topZ, horizLen, true, true);
  addCushion(leftX, -halfH + POCKET_GAP + vertSeg / 2, vertSeg, false, false);
  addCushion(leftX, halfH - POCKET_GAP - vertSeg / 2, vertSeg, false, false);
  addCushion(rightX, -halfH + POCKET_GAP + vertSeg / 2, vertSeg, false, true);
  addCushion(rightX, halfH - POCKET_GAP - vertSeg / 2, vertSeg, false, true);

  const baseExtentW = halfW + 2 * railW + frameWidth;
  const baseExtentH = halfH + 2 * railW + frameWidth;
  const legR = Math.min(TABLE.W, TABLE.H) * 0.055 * LEG_RADIUS_SCALE;
  const legTopLocal = frameTopY - TABLE.THICK;
  const legTopWorld = legTopLocal + TABLE_Y;
  const legBottomWorld = FLOOR_Y;
  const legH = Math.max(legTopWorld - legBottomWorld, TABLE_H);
  const legGeo = new THREE.CylinderGeometry(legR, legR, legH, 64);
  const baseX = baseExtentW;
  const baseZ = baseExtentH;
  const LEG_INSET = (TABLE.WALL * 0.7) * 1.0;
  const legPositions = [
    [-(baseX) + LEG_INSET, -(baseZ) + LEG_INSET],
    [baseX - LEG_INSET, -(baseZ) + LEG_INSET],
    [-(baseX) + LEG_INSET, baseZ - LEG_INSET],
    [baseX - LEG_INSET, baseZ - LEG_INSET]
  ];
  legPositions.forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(legGeo, woodMat);
    leg.position.set(lx, legTopLocal - legH / 2, lz);
    leg.castShadow = true;
    leg.receiveShadow = true;
    table.add(leg);
  });

  table.updateMatrixWorld(true);
  let cushionTopLocal = frameTopY;
  if (table.userData.cushions.length) {
    const box = new THREE.Box3();
    table.userData.cushions.forEach((cushion) => {
      box.setFromObject(cushion);
      cushionTopLocal = Math.max(cushionTopLocal, box.max.y);
    });
  }
  const clothPlaneWorld = cloth.position.y;

  table.userData.pockets = [];
  pocketCenters().forEach((p) => {
    const marker = new THREE.Object3D();
    marker.position.set(p.x, clothPlaneWorld - POCKET_VIS_R, p.y);
    marker.userData.captureRadius = CAPTURE_R;
    table.add(marker);
    table.userData.pockets.push(marker);
  });

  pocketMeshes.forEach((mesh) => {
    mesh.position.y = clothPlaneWorld - TABLE.THICK / 2;
  });

  alignRailsToCushions(table, railsGroup);
  table.updateMatrixWorld(true);
  updateRailLimitsFromTable(table);

  table.position.y = TABLE_Y;
  table.userData.cushionTopLocal = cushionTopLocal;
  table.userData.cushionTopWorld = cushionTopLocal + TABLE_Y;
  table.userData.cushionLipClearance = clothPlaneWorld;
  parent.add(table);

  const baulkZ = baulkLineZ;

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
  const spinAppliedRef = useRef({ x: 0, y: 0, mode: 'standard', magnitude: 0 });
  const spinDotElRef = useRef(null);
  const updateSpinDotPosition = useCallback((value) => {
    if (!value) value = { x: 0, y: 0 };
    const dot = spinDotElRef.current;
    if (!dot) return;
    const x = clamp(value.x ?? 0, -1, 1);
    const y = clamp(value.y ?? 0, -1, 1);
    dot.style.left = `${50 + x * 50}%`;
    dot.style.top = `${50 + y * 50}%`;
    const magnitude = Math.hypot(x, y);
    dot.style.backgroundColor =
      magnitude >= SWERVE_THRESHOLD ? '#facc15' : '#dc2626';
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
      let cue;
      let clothMat;
      let cushionMat;
      let shooting = false; // track when a shot is in progress
      let activeShotView = null;
      let shotPrediction = null;
      let cueAnimating = false; // forward stroke animation state
      const legHeight = LEG_ROOM_HEIGHT;
      const floorY = FLOOR_Y;
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
          const rawPhi = THREE.MathUtils.lerp(cueShot.phi, standing.phi, blend);
          const baseRadius = THREE.MathUtils.lerp(
            cueShot.radius,
            standing.radius,
            blend
          );
          const zoomFactor = THREE.MathUtils.lerp(
            CAMERA_ZOOM_RANGE.near,
            CAMERA_ZOOM_RANGE.far,
            blend
          );
          const radius = clampOrbitRadius(baseRadius * zoomFactor);
          const cushionHeight = cushionHeightRef.current ?? TABLE.THICK;
          const minHeightFromTarget = Math.max(
            TABLE.THICK - 0.05,
            cushionHeight + CAMERA_CUSHION_CLEARANCE
          );
          const phiRailLimit = Math.acos(
            THREE.MathUtils.clamp(minHeightFromTarget / Math.max(radius, 1e-3), -1, 1)
          );
          const safePhi = Math.min(rawPhi, phiRailLimit - CAMERA_RAIL_SAFETY);
          sph.phi = clamp(safePhi, CAMERA.minPhi, CAMERA.maxPhi);
          sph.radius = radius;
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
            const fade = THREE.MathUtils.clamp((120 - dist) / 45, 0, 1);
            const nearRepeat = clothMat.userData?.nearRepeat ?? 32;
            const farRepeat = clothMat.userData?.farRepeat ?? 18;
            const targetRepeat = THREE.MathUtils.lerp(farRepeat, nearRepeat, fade);
            if (clothMat.map) {
              clothMat.map.repeat.set(targetRepeat, targetRepeat);
            }
            if (clothMat.bumpMap) {
              clothMat.bumpMap.repeat.set(targetRepeat, targetRepeat);
            }
            if (Number.isFinite(clothMat.userData?.bumpScale)) {
              const base = clothMat.userData.bumpScale;
              clothMat.bumpScale = THREE.MathUtils.lerp(base * 0.55, base * 1.4, fade);
            }
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
            (cushionHeightRef.current ?? TABLE.THICK) + CAMERA_CUSHION_CLEARANCE
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
            (cushionHeightRef.current ?? TABLE.THICK) + CAMERA_CUSHION_CLEARANCE
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
          const magnitude = Math.hypot(applied.x ?? 0, applied.y ?? 0);
          const mode = magnitude >= SWERVE_THRESHOLD ? 'swerve' : 'standard';
          spinAppliedRef.current = { ...applied, magnitude, mode };
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
      // Adopt the lighting rig from the standalone snooker demo and scale all
      // authored coordinates so they sit correctly over the larger table.
      const addMobileLighting = () => {
        const lightingRig = new THREE.Group();
        world.add(lightingRig);

        const tableSurfaceY = TABLE_Y - TABLE.THICK + 0.01;
        const SAMPLE_PLAY_W = 1.216;
        const SAMPLE_PLAY_H = 2.536;
        const SAMPLE_TABLE_HEIGHT = 0.75;

        const LIGHT_DIMENSION_SCALE = 0.8; // reduce fixture footprint by 20%
        const LIGHT_HEIGHT_SCALE = 1.4; // lift the rig further above the table
        const LIGHT_HEIGHT_LIFT_MULTIPLIER = 7.5; // raise fixtures higher for stronger reflections

        const baseWidthScale = (PLAY_W / SAMPLE_PLAY_W) * LIGHT_DIMENSION_SCALE;
        const baseLengthScale = (PLAY_H / SAMPLE_PLAY_H) * LIGHT_DIMENSION_SCALE;
        const fixtureScale = Math.max(baseWidthScale, baseLengthScale);
        const heightScale = Math.max(0.001, TABLE_H / SAMPLE_TABLE_HEIGHT);
        const scaledHeight = heightScale * LIGHT_HEIGHT_SCALE;

        const hemisphere = new THREE.HemisphereLight(0xdde7ff, 0x0b1020, 0.95);
        const lightHeightLift = scaledHeight * LIGHT_HEIGHT_LIFT_MULTIPLIER; // lift the lighting rig higher above the table
        hemisphere.position.set(
          0,
          tableSurfaceY + scaledHeight * 1.4 + lightHeightLift,
          0
        );
        lightingRig.add(hemisphere);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1.15);
        dirLight.position.set(
          -1.25 * fixtureScale,
          tableSurfaceY + 6.6 * scaledHeight + lightHeightLift,
          0.95 * fixtureScale
        );
        dirLight.target.position.set(0, tableSurfaceY, 0);
        lightingRig.add(dirLight);
        lightingRig.add(dirLight.target);

        const spot = new THREE.SpotLight(
          0xffffff,
          2.0,
          0,
          Math.PI * 0.22,
          0.28,
          1
        );
        const spotOffsetX = 1.6 * fixtureScale;
        const spotOffsetZ = 0.95 * fixtureScale;
        const spotHeight = tableSurfaceY + 6.8 * scaledHeight + lightHeightLift;
        spot.position.set(spotOffsetX, spotHeight, spotOffsetZ);
        spot.target.position.set(0, tableSurfaceY + TABLE_H * 0.12, 0);
        spot.decay = 1.0;
        spot.castShadow = true;
        spot.shadow.mapSize.set(2048, 2048);
        spot.shadow.bias = -0.00012;
        lightingRig.add(spot);
        lightingRig.add(spot.target);

        const ambient = new THREE.AmbientLight(0xffffff, 0.08);
        ambient.position.set(
          0,
          tableSurfaceY + scaledHeight * 1.95 + lightHeightLift,
          0
        );
        lightingRig.add(ambient);
      };

      addMobileLighting();

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
          if (cue.pendingSpin) cue.pendingSpin.set(0, 0);
          cue.spinMode =
            spinAppliedRef.current?.mode === 'swerve' ? 'swerve' : 'standard';
          resetSpinRef.current?.();
          cue.impacted = false;
          cue.launchDir = aimDir.clone().normalize();

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
                  if (b.spin) b.spin.set(0, 0);
                  if (b.pendingSpin) b.pendingSpin.set(0, 0);
                  b.spinMode = 'standard';
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
          cue.spinMode = 'standard';
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
          const isCue = b.id === 'cue';
          const hasSpin = b.spin?.lengthSq() > 1e-6;
          if (hasSpin) {
            const swerveTravel = isCue && b.spinMode === 'swerve' && !b.impacted;
            const allowRoll = !isCue || b.impacted || swerveTravel;
            const preImpact = isCue && !b.impacted;
            if (allowRoll) {
              const rollMultiplier = swerveTravel ? SWERVE_TRAVEL_MULTIPLIER : 1;
              TMP_VEC2_SPIN.copy(b.spin).multiplyScalar(
                SPIN_ROLL_STRENGTH * rollMultiplier * frameScale
              );
              if (preImpact && b.launchDir && b.launchDir.lengthSq() > 1e-8) {
                const launchDir = TMP_VEC2_FORWARD.copy(b.launchDir).normalize();
                const forwardMag = TMP_VEC2_SPIN.dot(launchDir);
                TMP_VEC2_AXIS.copy(launchDir).multiplyScalar(forwardMag);
                b.vel.add(TMP_VEC2_AXIS);
                TMP_VEC2_LATERAL.copy(TMP_VEC2_SPIN).sub(TMP_VEC2_AXIS);
                if (b.spinMode === 'swerve' && b.pendingSpin) {
                  b.pendingSpin.add(TMP_VEC2_LATERAL);
                }
                const alignedSpeed = b.vel.dot(launchDir);
                TMP_VEC2_AXIS.copy(launchDir).multiplyScalar(alignedSpeed);
                b.vel.copy(TMP_VEC2_AXIS);
              } else {
                b.vel.add(TMP_VEC2_SPIN);
                if (
                  isCue &&
                  b.spinMode === 'swerve' &&
                  b.pendingSpin &&
                  b.pendingSpin.lengthSq() > 0
                ) {
                  b.vel.addScaledVector(b.pendingSpin, PRE_IMPACT_SPIN_DRIFT);
                  b.pendingSpin.multiplyScalar(0);
                }
              }
              const rollDecay = Math.pow(SPIN_ROLL_DECAY, frameScale);
              b.spin.multiplyScalar(rollDecay);
            } else {
              const airDecay = Math.pow(SPIN_AIR_DECAY, frameScale);
              b.spin.multiplyScalar(airDecay);
            }
            if (b.spin.lengthSq() < 1e-6) {
              b.spin.set(0, 0);
              if (b.pendingSpin) b.pendingSpin.set(0, 0);
              if (isCue) b.spinMode = 'standard';
            }
          }
          b.pos.addScaledVector(b.vel, frameScale);
          b.vel.multiplyScalar(Math.pow(FRICTION, frameScale));
          const speed = b.vel.length();
          const scaledSpeed = speed * frameScale;
          const hasSpinAfter = b.spin?.lengthSq() > 1e-6;
          if (scaledSpeed < STOP_EPS) {
            b.vel.set(0, 0);
            if (!hasSpinAfter && b.spin) b.spin.set(0, 0);
            if (!hasSpinAfter && b.pendingSpin) b.pendingSpin.set(0, 0);
            if (isCue && !hasSpinAfter) {
              b.impacted = false;
              b.spinMode = 'standard';
            }
            b.launchDir = null;
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
              if (b.pendingSpin) b.pendingSpin.set(0, 0);
              b.spinMode = 'standard';
              b.launchDir = null;
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
      onCommit: () => {
        fireRef.current?.();
        requestAnimationFrame(() => {
          slider.set(slider.min, { animate: true });
        });
      }
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
          className="relative w-32 h-32 rounded-full shadow-lg border border-white/70"
          style={{
            background:
              'radial-gradient(circle, #ffffff 0%, #ffffff 85%, #facc15 85%, #facc15 100%)'
          }}
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
