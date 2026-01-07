import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import * as THREE from 'three';
import polygonClipping from 'polygon-clipping';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { GroundedSkybox } from 'three/examples/jsm/objects/GroundedSkybox.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { PoolRoyalePowerSlider } from '../../../../pool-royale-power-slider.js';
import '../../../../pool-royale-power-slider.css';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  isTelegramWebView,
  getTelegramUsername,
  getTelegramPhotoUrl,
  getTelegramId
} from '../../utils/telegram.js';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { addTransaction, getAccountBalance } from '../../utils/api.js';
import { FLAG_EMOJIS } from '../../utils/flagEmojis.js';
import { PoolRoyaleRules } from '../../../../src/rules/PoolRoyaleRules.ts';
import { useAimCalibration } from '../../hooks/useAimCalibration.js';
import { resolveTableSize } from '../../config/poolRoyaleTables.js';
import { resolveTableSize as resolveSnookerTableSize } from '../../config/snookerClubTables.js';
import { isGameMuted, getGameVolume } from '../../utils/sound.js';
import {
  createBallPreviewDataUrl,
  getBallMaterial as getBilliardBallMaterial
} from '../../utils/ballMaterialFactory.js';
import { selectShot as selectUkAiShot } from '../../../../lib/poolUkAdvancedAi.js';
import { createCueRackDisplay } from '../../utils/createCueRackDisplay.js';
import { socket } from '../../utils/socket.js';
import {
  WOOD_FINISH_PRESETS,
  WOOD_GRAIN_OPTIONS,
  WOOD_GRAIN_OPTIONS_BY_ID,
  DEFAULT_WOOD_GRAIN_ID,
  DEFAULT_WOOD_TEXTURE_SIZE,
  applyWoodTextures,
  disposeMaterialWithWood,
  setWoodTextureAnisotropyCap,
} from '../../utils/woodMaterials.js';
import {
  POOL_ROYALE_DEFAULT_HDRI_ID,
  POOL_ROYALE_DEFAULT_UNLOCKS,
  POOL_ROYALE_HDRI_VARIANTS,
  POOL_ROYALE_HDRI_VARIANT_MAP,
  POOL_ROYALE_BASE_VARIANTS,
  POOL_ROYALE_OPTION_LABELS
} from '../../config/poolRoyaleInventoryConfig.js';
import { POOL_ROYALE_CLOTH_VARIANTS } from '../../config/poolRoyaleClothPresets.js';
import {
  getCachedPoolRoyalInventory,
  getPoolRoyalInventory,
  isPoolOptionUnlocked,
  poolRoyalAccountId,
  addPoolRoyalUnlock
} from '../../utils/poolRoyalInventory.js';
import {
  describeTrainingLevel,
  getNextIncompleteLevel,
  loadTrainingProgress,
  persistTrainingProgress,
  resolvePlayableTrainingLevel
} from '../../utils/poolRoyaleTrainingProgress.js';
import { applyRendererSRGB, applySRGBColorSpace } from '../../utils/colorSpace.js';

const DRACO_DECODER_PATH = 'https://www.gstatic.com/draco/v1/decoders/';
const BASIS_TRANSCODER_PATH =
  'https://cdn.jsdelivr.net/npm/three@0.164.0/examples/jsm/libs/basis/';

function safePolygonUnion(...parts) {
  const valid = parts.filter(Boolean);
  if (!valid.length) return [];
  try {
    return polygonClipping.union(...valid);
  } catch (err) {
    console.error('Pool Royale polygon union failed', err);
    return valid[0];
  }
}

function safePolygonDifference(subject, ...clips) {
  const validSubject = subject || [];
  const validClips = clips.filter(Boolean);
  if (!validSubject?.length || !validClips.length) return validSubject;
  try {
    return polygonClipping.difference(validSubject, ...validClips);
  } catch (err) {
    console.error('Pool Royale polygon difference failed', err);
    return validSubject;
  }
}

function applyTablePhysicsSpec(meta) {
  const cushionAngle = Number.isFinite(meta?.cushionCutAngleDeg)
    ? meta.cushionCutAngleDeg
    : DEFAULT_CUSHION_CUT_ANGLE;
  CUSHION_CUT_ANGLE = cushionAngle;

  const sideCushionAngle = Number.isFinite(meta?.sideCushionCutAngleDeg)
    ? meta.sideCushionCutAngleDeg
    : Number.isFinite(meta?.cushionCutAngleDeg)
      ? meta.cushionCutAngleDeg
      : DEFAULT_SIDE_CUSHION_CUT_ANGLE;
  SIDE_CUSHION_CUT_ANGLE = sideCushionAngle;

  const restitution = Number.isFinite(meta?.cushionRestitution)
    ? meta.cushionRestitution
    : DEFAULT_CUSHION_RESTITUTION;
  CUSHION_RESTITUTION = restitution;
}

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

function detectLowRefreshDisplay() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  const queries = ['(max-refresh-rate: 59hz)', '(max-refresh-rate: 50hz)', '(prefers-reduced-motion: reduce)'];
  for (const query of queries) {
    try {
      if (window.matchMedia(query).matches) {
        return true;
      }
    } catch (err) {
      // ignore unsupported query
    }
  }
  return false;
}

function detectHighRefreshDisplay() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  const queries = ['(min-refresh-rate: 120hz)', '(min-refresh-rate: 90hz)'];
  for (const query of queries) {
    try {
      if (window.matchMedia(query).matches) {
        return true;
      }
    } catch (err) {
      // ignore unsupported query
    }
  }
  return false;
}

const randomPick = (list) => list[Math.floor(Math.random() * list.length)];

const wait = (ms = 0) =>
  new Promise((resolve) => {
    if (!Number.isFinite(ms) || ms <= 0) {
      resolve();
      return;
    }
    window.setTimeout(resolve, ms);
  });

function isWebGLAvailable() {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');
    return Boolean(gl);
  } catch (err) {
    console.warn('WebGL availability check failed', err);
    return false;
  }
}

let rendererAnisotropyCap = 16;
setWoodTextureAnisotropyCap(rendererAnisotropyCap);
const updateRendererAnisotropyCap = (renderer) => {
  if (renderer?.capabilities?.getMaxAnisotropy) {
    const max = renderer.capabilities.getMaxAnisotropy();
    if (Number.isFinite(max)) {
      rendererAnisotropyCap = Math.max(rendererAnisotropyCap, max);
    }
  }
  setWoodTextureAnisotropyCap(rendererAnisotropyCap);
};
const resolveTextureAnisotropy = (fallback = 1) =>
  Math.max(rendererAnisotropyCap, Number.isFinite(fallback) ? fallback : 1);

const POCKET_NET_LINE_THICKNESS_SCALE = 4.8;

const createPocketNetTexture = (size = 256, repeat = POCKET_NET_HEX_REPEAT) => {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.clearRect(0, 0, size, size);
  const lineWidth = Math.max(1, (size / 128) * POCKET_NET_LINE_THICKNESS_SCALE);
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = 'rgba(255,255,255,0.96)';
  const drawHex = (cx, cy, r) => {
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const angle = Math.PI / 3 * i;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  };
  const radius = Math.max(4, size * POCKET_NET_HEX_RADIUS_RATIO);
  const verticalStep = Math.sqrt(3) * radius;
  const horizontalStep = radius * 1.5;
  ctx.save();
  ctx.translate(size / 2, size / 2);
  for (let row = -Math.ceil(size / verticalStep); row <= Math.ceil(size / verticalStep); row += 1) {
    const y = row * verticalStep;
    const offset = row % 2 === 0 ? 0 : horizontalStep / 2;
    for (
      let col = -Math.ceil(size / horizontalStep);
      col <= Math.ceil(size / horizontalStep);
      col += 1
    ) {
      const x = col * horizontalStep + offset;
      drawHex(x, y, radius - lineWidth * 0.35);
    }
  }
  ctx.restore();
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.anisotropy = resolveTextureAnisotropy(texture.anisotropy ?? 1);
  texture.needsUpdate = true;
  return texture;
};

let cachedRendererString = null;
let rendererLookupAttempted = false;

function readGraphicsRendererString() {
  if (rendererLookupAttempted) {
    return cachedRendererString;
  }
  rendererLookupAttempted = true;
  if (typeof document === 'undefined') {
    return null;
  }
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl') ||
      canvas.getContext('webgl2');
    if (!gl) {
      return null;
    }
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) ?? '';
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) ?? '';
      cachedRendererString = `${vendor} ${renderer}`.trim();
    } else {
      const vendor = gl.getParameter(gl.VENDOR) ?? '';
      const renderer = gl.getParameter(gl.RENDERER) ?? '';
      cachedRendererString = `${vendor} ${renderer}`.trim();
    }
    return cachedRendererString;
  } catch (err) {
    return null;
  }
}

function classifyRendererTier(rendererString) {
  if (typeof rendererString !== 'string' || rendererString.length === 0) {
    return 'unknown';
  }
  const signature = rendererString.toLowerCase();
  if (
    signature.includes('mali') ||
    signature.includes('adreno') ||
    signature.includes('powervr') ||
    signature.includes('apple a') ||
    signature.includes('snapdragon') ||
    signature.includes('tegra x1')
  ) {
    return 'mobile';
  }
  if (
    signature.includes('geforce') ||
    signature.includes('nvidia') ||
    signature.includes('radeon') ||
    signature.includes('rx ') ||
    signature.includes('rtx') ||
    signature.includes('apple m') ||
    signature.includes('arc')
  ) {
    return 'desktopHigh';
  }
  if (signature.includes('intel') || signature.includes('iris') || signature.includes('uhd')) {
    return 'desktopMid';
  }
  return 'unknown';
}

function detectPreferredFrameRateId() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return DEFAULT_FRAME_RATE_ID;
  }
  const coarsePointer = detectCoarsePointer();
  const ua = navigator.userAgent ?? '';
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const maxTouchPoints = navigator.maxTouchPoints ?? 0;
  const isTouch = maxTouchPoints > 1;
  const deviceMemory = typeof navigator.deviceMemory === 'number' ? navigator.deviceMemory : null;
  const hardwareConcurrency = navigator.hardwareConcurrency ?? 4;
  const lowRefresh = detectLowRefreshDisplay();
  const highRefresh = detectHighRefreshDisplay();
  const rendererTier = classifyRendererTier(readGraphicsRendererString());

  if (lowRefresh) {
    return 'hd50';
  }

  if (isMobileUA || coarsePointer || isTouch || rendererTier === 'mobile') {
    if ((deviceMemory !== null && deviceMemory <= 4) || hardwareConcurrency <= 4) {
      return 'hd50';
    }
    if (highRefresh && hardwareConcurrency >= 8 && (deviceMemory == null || deviceMemory >= 6)) {
      return 'uhd120';
    }
    if (
      highRefresh ||
      hardwareConcurrency >= 6 ||
      (deviceMemory != null && deviceMemory >= 6)
    ) {
      return 'qhd90';
    }
    return 'fhd60';
  }

  if (rendererTier === 'desktopHigh' || hardwareConcurrency >= 8) {
    return 'uhd120';
  }

  if (rendererTier === 'desktopMid') {
    return 'qhd90';
  }

  return DEFAULT_FRAME_RATE_ID;
}

function resolveDefaultPixelRatioCap() {
  if (typeof window === 'undefined') {
    return 2;
  }
  return window.innerWidth <= 1366 ? 1.5 : 2;
}

function signedRingArea(ring) {
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    area += x1 * y2 - x2 * y1;
  }
  return area * 0.5;
}

function multiPolygonToShapes(mp) {
  const shapes = [];
  if (!Array.isArray(mp)) return shapes;
  mp.forEach((poly) => {
    if (!Array.isArray(poly) || !poly.length) return;
    const outerRing = poly[0];
    if (!Array.isArray(outerRing) || outerRing.length < 4) return;
    const outerPts = outerRing.slice(0, -1);
    if (!outerPts.length) return;
    const outerClockwise = signedRingArea(outerRing) < 0;
    const orderedOuter = outerClockwise
      ? outerPts.slice().reverse()
      : outerPts;
    const shape = new THREE.Shape();
    shape.moveTo(orderedOuter[0][0], orderedOuter[0][1]);
    for (let i = 1; i < orderedOuter.length; i++) {
      shape.lineTo(orderedOuter[i][0], orderedOuter[i][1]);
    }
    shape.closePath();

    for (let ringIndex = 1; ringIndex < poly.length; ringIndex++) {
      const holeRing = poly[ringIndex];
      if (!Array.isArray(holeRing) || holeRing.length < 4) continue;
      const holePts = holeRing.slice(0, -1);
      if (!holePts.length) continue;
      const holeClockwise = signedRingArea(holeRing) < 0;
      const orderedHole = holeClockwise
        ? holePts
        : holePts.slice().reverse();
      const hole = new THREE.Path();
      hole.moveTo(orderedHole[0][0], orderedHole[0][1]);
      for (let i = 1; i < orderedHole.length; i++) {
        hole.lineTo(orderedHole[i][0], orderedHole[i][1]);
      }
      hole.closePath();
      shape.holes.push(hole);
    }

    shapes.push(shape);
  });
  return shapes;
}

function centroidFromRing(ring) {
  if (!Array.isArray(ring) || !ring.length) {
    return { x: 0, y: 0 };
  }
  let sumX = 0;
  let sumY = 0;
  let count = 0;
  for (let i = 0; i < ring.length; i++) {
    const pt = ring[i];
    if (!Array.isArray(pt) || pt.length < 2) continue;
    sumX += pt[0];
    sumY += pt[1];
    count++;
  }
  if (!count) {
    return { x: 0, y: 0 };
  }
  return { x: sumX / count, y: sumY / count };
}

function scaleMultiPolygon(mp, scale) {
  if (!Array.isArray(mp) || typeof scale !== 'number') {
    return [];
  }
  const clampedScale = Math.max(0, scale);
  return mp
    .map((poly) => {
      if (!Array.isArray(poly) || !poly.length) return null;
      const outerRing = poly[0];
      const centroid = centroidFromRing(outerRing);
      const scaledPoly = poly
        .map((ring) => {
          if (!Array.isArray(ring) || !ring.length) return null;
          return ring
            .map((pt) => {
              if (!Array.isArray(pt) || pt.length < 2) return null;
              const dx = pt[0] - centroid.x;
              const dy = pt[1] - centroid.y;
              return [centroid.x + dx * clampedScale, centroid.y + dy * clampedScale];
            })
            .filter(Boolean);
        })
        .filter((ring) => Array.isArray(ring) && ring.length > 0);
      if (!scaledPoly.length) return null;
      return scaledPoly;
    })
    .filter((poly) => Array.isArray(poly) && poly.length > 0);
}

function adjustCornerNotchDepth(mp, centerZ, sz) {
  if (!Array.isArray(mp) || !Number.isFinite(centerZ) || !Number.isFinite(sz)) {
    return Array.isArray(mp) ? mp : [];
  }
  return mp.map((poly) =>
    Array.isArray(poly)
      ? poly.map((ring) =>
          Array.isArray(ring)
            ? ring.map((pt) => {
                if (!Array.isArray(pt) || pt.length < 2) return pt;
                const [x, z] = pt;
                const deltaZ = z - centerZ;
                const towardCenter = -sz * deltaZ;
                if (towardCenter <= 0) return [x, z];
                return [x, centerZ + deltaZ * CHROME_CORNER_NOTCH_CENTER_SCALE];
              })
            : ring
        )
      : poly
  );
}

function adjustSideNotchDepth(mp) {
  if (!Array.isArray(mp)) return Array.isArray(mp) ? mp : [];
  return mp.map((poly) =>
    Array.isArray(poly)
      ? poly.map((ring) =>
          Array.isArray(ring)
            ? ring.map((pt) => {
                if (!Array.isArray(pt) || pt.length < 2) return pt;
                const [x, z] = pt;
                const scaledZ = z * CHROME_SIDE_NOTCH_DEPTH_SCALE;
                const pullBase = Math.abs(z) * CHROME_SIDE_FIELD_PULL_SCALE;
                const maxPull = Math.min(Math.abs(scaledZ), pullBase);
                if (maxPull <= 0) {
                  return [x, scaledZ];
                }
                const dir = scaledZ === 0 ? 0 : scaledZ > 0 ? 1 : -1;
                return [x, scaledZ - dir * maxPull];
              })
            : ring
        )
      : poly
  );
}

const POCKET_VISUAL_EXPANSION = 1.034;
const CORNER_POCKET_INWARD_SCALE = 1.008; // ease the corner cuts back toward the rail so the mouth stays as wide as the bowl
const CORNER_POCKET_SCALE_BOOST = 0.998; // open the corner mouth fractionally to match the inner pocket radius
const CORNER_POCKET_EXTRA_SCALE = 1.028; // further relax the corner mouth while leaving side pockets unchanged
const CHROME_CORNER_POCKET_RADIUS_SCALE = 1.01;
const CHROME_CORNER_NOTCH_CENTER_SCALE = 1.08; // mirror snooker notch depth so the rounded chrome cut hugs the cloth identically
const CHROME_CORNER_EXPANSION_SCALE = 1.002; // trim back the fascia so it now finishes flush with the pocket jaw edge along the long rail
const CHROME_CORNER_SIDE_EXPANSION_SCALE = 1.002; // mirror the lighter reach so the chrome stops exactly where the jaw shoulder begins
const CHROME_CORNER_FIELD_TRIM_SCALE = -0.03; // remove the base trim so the fascia rides the cushion edge without a gap
const CHROME_CORNER_NOTCH_WEDGE_SCALE = 0;
const CHROME_CORNER_FIELD_CLIP_WIDTH_SCALE = 0.034; // extend the fascia slightly farther along the arc so the chrome starts flush with the pocket curve
const CHROME_CORNER_FIELD_CLIP_DEPTH_SCALE = 0.034; // mirror the extension along the second axis so the rounded arc ends stay covered
const CHROME_CORNER_FIELD_FILLET_SCALE = 0; // match the pocket radius exactly without additional rounding
const CHROME_CORNER_FIELD_EXTENSION_SCALE = 0; // keep fascia depth identical to snooker
const CHROME_CORNER_NOTCH_EXPANSION_SCALE = 1; // no scaling so the notch mirrors the pocket radius perfectly
const CHROME_CORNER_DIMENSION_SCALE = 1; // keep the fascia dimensions identical to the cushion span so both surfaces meet cleanly
const CHROME_CORNER_WIDTH_SCALE = 0.978; // shave the chrome plate slightly so it ends at the jaw line on the long rail
const CHROME_CORNER_HEIGHT_SCALE = 0.962; // mirror the trim on the short rail so the fascia meets the jaw corner without overlap
const CHROME_CORNER_CENTER_OUTSET_SCALE = -0.02; // align corner fascia offset with the snooker chrome plates
const CHROME_CORNER_SHORT_RAIL_SHIFT_SCALE = 0; // let the corner fascia terminate precisely where the cushion noses stop
const CHROME_CORNER_SHORT_RAIL_CENTER_PULL_SCALE = 0; // stop pulling the chrome off the short-rail centreline so the jaws stay flush
const CHROME_CORNER_EDGE_TRIM_SCALE = 0; // do not trim edges beyond the snooker baseline
const CHROME_SIDE_POCKET_RADIUS_SCALE =
  CORNER_POCKET_INWARD_SCALE *
  CHROME_CORNER_POCKET_RADIUS_SCALE; // match the middle chrome arches to the corner pocket radius
const WOOD_RAIL_CORNER_RADIUS_SCALE = 0.16; // subtly round the wooden rail edges so the frame corners are no longer sharp
const CHROME_SIDE_NOTCH_THROAT_SCALE = 0; // disable secondary throat so the side chrome uses a single arch
const CHROME_SIDE_NOTCH_HEIGHT_SCALE = 0.85; // reuse snooker notch height profile
const CHROME_SIDE_NOTCH_RADIUS_SCALE = 1;
const CHROME_SIDE_NOTCH_DEPTH_SCALE = 1; // keep the notch depth identical to the pocket cylinder so the chrome kisses the jaw edge
const CHROME_SIDE_FIELD_PULL_SCALE = 0;
const CHROME_PLATE_REFLECTION_SCALE = 0.28; // kill pocket-cut reflections by damping env-map intensity on fascia cuts
const CHROME_PLATE_ROUGHNESS_LIFT = 0.08; // lift roughness on fascia cuts so pocket arches stop casting hot spots on cloth
const CHROME_PLATE_THICKNESS_SCALE = 0.0306; // match diamond thickness on the wooden rails for fascia depth
const CHROME_SIDE_PLATE_THICKNESS_BOOST = 1.18; // thicken the middle fascia so its depth now matches the corner plates
const CHROME_PLATE_VERTICAL_LIFT_SCALE = 0; // keep fascia placement identical to snooker
const CHROME_PLATE_DOWNWARD_EXPANSION_SCALE = 0; // keep fascia depth identical to snooker
const CHROME_PLATE_RENDER_ORDER = 3.5; // ensure chrome fascias stay visually above the wood rails without z-fighting
const CHROME_SIDE_PLATE_POCKET_SPAN_SCALE = 2.2; // push the side fascia farther along the arch so it blankets the larger chrome reveal
const CHROME_SIDE_PLATE_HEIGHT_SCALE = 3.1; // extend fascia reach so the middle pocket cut gains a broader surround on the remaining three sides
const CHROME_SIDE_PLATE_CENTER_TRIM_SCALE = 0; // keep the middle fascia centred on the pocket without carving extra relief
const CHROME_SIDE_PLATE_WIDTH_EXPANSION_SCALE = 2.62; // trim fascia span further so the middle plates finish before intruding into the pocket zone while keeping the rounded edge intact
const CHROME_SIDE_PLATE_OUTER_EXTENSION_SCALE = 1.68; // widen the middle fascia outward so it blankets the exposed wood like the corner plates without altering the rounded cut
const CHROME_SIDE_PLATE_WIDTH_REDUCTION_SCALE = 0.986; // trim the middle fascia width a touch so both flanks stay inside the pocket reveal
const CHROME_SIDE_PLATE_CORNER_BIAS_SCALE = 1.092; // lean the added width further toward the corner pockets while keeping the curved pocket cut unchanged
const CHROME_SIDE_PLATE_CORNER_LIMIT_SCALE = 0.04;
const CHROME_SIDE_PLATE_OUTWARD_SHIFT_SCALE = 0.16; // push the side fascias farther outward so their outer edge follows the relocated middle pocket cuts
const CHROME_OUTER_FLUSH_TRIM_SCALE = 0; // allow the fascia to run the full distance from cushion edge to wood rail with no setback
const CHROME_CORNER_POCKET_CUT_SCALE = 1.02; // open the rounded chrome corner cut a little more so the chrome reveal reads larger at each corner
const CHROME_SIDE_POCKET_CUT_SCALE = CHROME_CORNER_POCKET_CUT_SCALE * 1.012; // open the rounded chrome cut slightly wider on the middle pockets only
const CHROME_SIDE_POCKET_CUT_CENTER_PULL_SCALE = 0.032; // pull the rounded chrome cutouts inward so they sit deeper into the fascia mass
const WOOD_RAIL_POCKET_RELIEF_SCALE = 0.9; // ease the wooden rail pocket relief so the rounded corner cuts expand a hair and keep pace with the broader chrome reveal
const WOOD_CORNER_RELIEF_INWARD_SCALE = 0.984; // ease the wooden corner relief fractionally less so chrome widening does not alter the wood cut
const WOOD_CORNER_RAIL_POCKET_RELIEF_SCALE =
  (1 / WOOD_RAIL_POCKET_RELIEF_SCALE) * WOOD_CORNER_RELIEF_INWARD_SCALE; // corner wood arches now sit a hair inside the chrome radius so the rounded cut creeps inward
const WOOD_SIDE_RAIL_POCKET_RELIEF_SCALE = 1.032; // push the middle rail rounded cuts slightly farther outward so they sit farther from the table centre while keeping their slim profile
const WOOD_SIDE_POCKET_CUT_CENTER_OUTSET_SCALE = -0.05; // offset the wood cutouts outward so the rounded relief tracks the shifted middle pocket line

function buildChromePlateGeometry({
  width,
  height,
  radius,
  thickness,
  corner = 'topLeft',
  notchMP = null,
  shapeSegments = 96,
  flat = false
}) {
  const shape = new THREE.Shape();
  const hw = width / 2;
  const hh = height / 2;
  const r = Math.min(radius, hw, hh);

  const TL = new THREE.Vector2(-hw, hh);
  const TR = new THREE.Vector2(hw, hh);
  const BR = new THREE.Vector2(hw, -hh);
  const BL = new THREE.Vector2(-hw, -hh);

  const isSidePlate =
    typeof corner === 'string' && corner.toLowerCase().startsWith('side');

  if (isSidePlate) {
    const rectRadius = Math.max(
      0,
      Math.min(r, Math.min(width, height) * CHROME_SIDE_PLATE_CORNER_LIMIT_SCALE)
    );
    const topStartX = -hw + rectRadius;
    shape.moveTo(topStartX, hh);
    shape.lineTo(hw - rectRadius, hh);
    if (rectRadius > MICRO_EPS) {
      shape.absarc(hw - rectRadius, hh - rectRadius, rectRadius, Math.PI / 2, 0, true);
      shape.lineTo(hw, -hh + rectRadius);
      shape.absarc(hw - rectRadius, -hh + rectRadius, rectRadius, 0, -Math.PI / 2, true);
      shape.lineTo(-hw + rectRadius, -hh);
      shape.absarc(-hw + rectRadius, -hh + rectRadius, rectRadius, -Math.PI / 2, -Math.PI, true);
      shape.lineTo(-hw, hh - rectRadius);
      shape.absarc(-hw + rectRadius, hh - rectRadius, rectRadius, Math.PI, Math.PI / 2, true);
    } else {
      shape.lineTo(hw, hh);
      shape.lineTo(hw, -hh);
      shape.lineTo(-hw, -hh);
      shape.lineTo(-hw, hh);
    }
    shape.lineTo(topStartX, hh);
  } else {
    const cornerKey = typeof corner === 'string' ? corner.toLowerCase() : '';
    switch (cornerKey) {
      case 'topleft': {
        if (r > MICRO_EPS) {
          shape.moveTo(-hw + r, hh);
          shape.lineTo(hw, hh);
          shape.lineTo(hw, -hh);
          shape.lineTo(-hw, -hh);
          shape.lineTo(-hw, hh - r);
          shape.absarc(-hw + r, hh - r, r, Math.PI, Math.PI / 2, true);
        } else {
          shape.moveTo(TL.x, TL.y);
          shape.lineTo(TR.x, TR.y);
          shape.lineTo(BR.x, BR.y);
          shape.lineTo(BL.x, BL.y);
          shape.lineTo(TL.x, TL.y);
        }
        break;
      }
      case 'topright': {
        if (r > MICRO_EPS) {
          shape.moveTo(-hw, hh);
          shape.lineTo(hw - r, hh);
          shape.absarc(hw - r, hh - r, r, Math.PI / 2, 0, true);
          shape.lineTo(hw, -hh);
          shape.lineTo(-hw, -hh);
          shape.lineTo(-hw, hh);
        } else {
          shape.moveTo(TL.x, TL.y);
          shape.lineTo(TR.x, TR.y);
          shape.lineTo(BR.x, BR.y);
          shape.lineTo(BL.x, BL.y);
          shape.lineTo(TL.x, TL.y);
        }
        break;
      }
      case 'bottomright': {
        if (r > MICRO_EPS) {
          shape.moveTo(-hw, hh);
          shape.lineTo(hw, hh);
          shape.lineTo(hw, -hh + r);
          shape.absarc(hw - r, -hh + r, r, 0, -Math.PI / 2, true);
          shape.lineTo(-hw, -hh);
          shape.lineTo(-hw, hh);
        } else {
          shape.moveTo(TL.x, TL.y);
          shape.lineTo(TR.x, TR.y);
          shape.lineTo(BR.x, BR.y);
          shape.lineTo(BL.x, BL.y);
          shape.lineTo(TL.x, TL.y);
        }
        break;
      }
      case 'bottomleft': {
        if (r > MICRO_EPS) {
          shape.moveTo(-hw, hh);
          shape.lineTo(hw, hh);
          shape.lineTo(hw, -hh);
          shape.lineTo(-hw + r, -hh);
          shape.absarc(-hw + r, -hh + r, r, -Math.PI / 2, -Math.PI, true);
          shape.lineTo(-hw, hh);
        } else {
          shape.moveTo(TL.x, TL.y);
          shape.lineTo(TR.x, TR.y);
          shape.lineTo(BR.x, BR.y);
          shape.lineTo(BL.x, BL.y);
          shape.lineTo(TL.x, TL.y);
        }
        break;
      }
      default: {
        if (r > MICRO_EPS) {
          shape.moveTo(-hw + r, hh);
          shape.lineTo(hw - r, hh);
          shape.absarc(hw - r, hh - r, r, Math.PI / 2, 0, true);
          shape.lineTo(hw, -hh + r);
          shape.absarc(hw - r, -hh + r, r, 0, -Math.PI / 2, true);
          shape.lineTo(-hw + r, -hh);
          shape.absarc(-hw + r, -hh + r, r, -Math.PI / 2, -Math.PI, true);
          shape.lineTo(-hw, hh - r);
          shape.absarc(-hw + r, hh - r, r, Math.PI, Math.PI / 2, true);
          shape.lineTo(-hw + r, hh);
        } else {
          shape.moveTo(TL.x, TL.y);
          shape.lineTo(TR.x, TR.y);
          shape.lineTo(BR.x, BR.y);
          shape.lineTo(BL.x, BL.y);
          shape.lineTo(TL.x, TL.y);
        }
      }
    }
  }

  shape.closePath();

  const bevelBase = Math.min(r * 0.22, Math.min(width, height) * 0.08);
  const bevelSize = isSidePlate
    ? Math.min(bevelBase * 0.6, Math.min(width, height) * 0.035)
    : Math.min(bevelBase * 0.45, Math.min(width, height) * 0.05);
  const bevelThickness = Math.min(
    thickness * (isSidePlate ? 0.35 : 0.28),
    bevelSize * 0.65
  );

  let shapesToExtrude = [shape];
  if (notchMP?.length) {
    const extracted = shape.extractPoints(shapeSegments);
    const basePts = extracted.shape;
    if (basePts?.length) {
      const baseRing = basePts.map((pt) => [pt.x, pt.y]);
      if (baseRing.length) {
        const first = baseRing[0];
        const last = baseRing[baseRing.length - 1];
        if (!first || !last || first[0] !== last[0] || first[1] !== last[1]) {
          baseRing.push([baseRing[0][0], baseRing[0][1]]);
        }
        const baseMP = [[baseRing]];
        const clipped = safePolygonDifference(baseMP, notchMP);
        const clippedShapes = multiPolygonToShapes(clipped);
        if (clippedShapes.length) {
          shapesToExtrude = clippedShapes;
        }
      }
    }
  }

  if (flat || thickness <= MICRO_EPS) {
    let geo = new THREE.ShapeGeometry(shapesToExtrude, Math.max(8, shapeSegments));
    geo.rotateX(-Math.PI / 2);
    geo.computeVertexNormals();
    return geo;
  }

  let geo = new THREE.ExtrudeGeometry(shapesToExtrude, {
    depth: thickness,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize,
    bevelThickness,
    curveSegments: 96
  });
  geo = softenOuterExtrudeEdges(geo, thickness, 0.55);
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

function applyChromePlateDamping(material) {
  if (!material) return null;
  const mat = material.clone();
  const baseEnv = typeof material.envMapIntensity === 'number' ? material.envMapIntensity : 1;
  mat.envMapIntensity = baseEnv * CHROME_PLATE_REFLECTION_SCALE;
  const baseRoughness = typeof material.roughness === 'number' ? material.roughness : 0;
  mat.roughness = THREE.MathUtils.clamp(
    baseRoughness + CHROME_PLATE_ROUGHNESS_LIFT,
    0,
    1
  );
  if (typeof mat.metalness === 'number') {
    mat.metalness = THREE.MathUtils.clamp(
      mat.metalness * (1 - CHROME_PLATE_REFLECTION_SCALE * 0.35),
      0,
      1
    );
  }
  mat.needsUpdate = true;
  return mat;
}
function addPocketCuts(
  parent,
  clothPlane,
  pocketPositions,
  clothEdgeMat,
  sideRadiusScale = 1,
  stopY = null
) {
  if (!parent || !Array.isArray(pocketPositions) || !clothEdgeMat) return [];
  const stripes = [];
  const stripeWidth = BALL_R * 0.32;
  const stripeLift = BALL_R * 0.06;
  pocketPositions.forEach((p, index) => {
    if (!p) return;
    const isSide = index >= 4;
    const baseRadius = isSide ? POCKET_HOLE_R * sideRadiusScale : POCKET_HOLE_R;
    const inner = Math.max(MICRO_EPS, baseRadius * POCKET_CUT_EXPANSION);
    const outer = inner + stripeWidth;
    const sleeveShape = new THREE.Shape();
    sleeveShape.absarc(0, 0, outer, 0, Math.PI * 2, false);
    const innerPath = new THREE.Path();
    innerPath.absarc(0, 0, inner, 0, Math.PI * 2, true);
    sleeveShape.holes.push(innerPath);
    const sleeveTopY = clothPlane - CLOTH_DROP + stripeLift;
    const baseStripeHeight = CLOTH_EXTENDED_DEPTH + BALL_R * 0.32;
    const targetHeight = Number.isFinite(stopY)
      ? sleeveTopY - stopY
      : baseStripeHeight;
    const stripeHeight = Math.max(MICRO_EPS, targetHeight);
    const geo = new THREE.ExtrudeGeometry(sleeveShape, {
      depth: stripeHeight,
      bevelEnabled: false,
      curveSegments: 64,
      steps: 1
    });
    geo.rotateX(Math.PI / 2);
    geo.translate(0, -stripeHeight, 0);
    const mesh = new THREE.Mesh(geo, clothEdgeMat);
    mesh.position.set(p.x, sleeveTopY, p.y);
    mesh.renderOrder = 3.1;
    mesh.receiveShadow = true;
    parent.add(mesh);
    stripes.push(mesh);
  });
  return stripes;
}

/**
 * NEW SNOOKER GAME — fresh build (keep ONLY Guret for balls)
 * As requested:
 *  • Camera orbits like a person at the table (smooth orbit) with a slightly low angle, without dropping to cloth level.
 *  • Six holes cut realistically into the cloth (Shape.holes + Extrude) with capture radius so the balls fall inside.
 *  • NEW power slider: large on the right side of the screen with a **PULL** gesture (drag DOWN as hard as you want for power) and fires on release.
 *  • Playable: aiming line + tick, collisions, pocket captures, basic snooker logic (reds→colour, then colours in order, fouls, in-hand).
 */

// --------------------------------------------------
// Config
// --------------------------------------------------
// separate scales for table and balls
// Dimensions tuned for an official 9ft pool table footprint while globally reduced
// to fit comfortably inside the existing mobile arena presentation.
const TABLE_SIZE_SHRINK = 0.85; // tighten the table footprint by ~8% to add breathing room without altering proportions
const TABLE_REDUCTION = 0.84 * TABLE_SIZE_SHRINK; // apply the legacy trim plus the tighter shrink so the arena stays compact without distorting proportions
const SIZE_REDUCTION = 0.7;
const GLOBAL_SIZE_FACTOR = 0.85 * SIZE_REDUCTION;
const TABLE_DISPLAY_SCALE = 0.88; // pull the entire table set ~12% closer so the arena feels more intimate without distorting proportions
const WORLD_SCALE = 0.85 * GLOBAL_SIZE_FACTOR * 0.7 * TABLE_DISPLAY_SCALE;
const TOUCH_UI_SCALE = SIZE_REDUCTION;
const POINTER_UI_SCALE = 1;
const CUE_STYLE_STORAGE_KEY = 'tonplayCueStyleIndex';
const TABLE_FINISH_STORAGE_KEY = 'poolRoyaleTableFinish';
const CLOTH_COLOR_STORAGE_KEY = 'poolRoyaleClothColor';
const TABLE_BASE_STORAGE_KEY = 'poolRoyaleTableBase';
const POCKET_LINER_STORAGE_KEY = 'poolPocketLiner';
const DEFAULT_TABLE_BASE_ID = POOL_ROYALE_BASE_VARIANTS[0]?.id || 'classicCylinders';
const ENABLE_CUE_GALLERY = false;
const ENABLE_TRIPOD_CAMERAS = false;
const SHOW_SHORT_RAIL_TRIPODS = false;
const LOCK_REPLAY_CAMERA = false;
  const TABLE_BASE_SCALE = 1.2;
  const TABLE_WIDTH_SCALE = 1.25;
  const TABLE_SCALE = TABLE_BASE_SCALE * TABLE_REDUCTION * TABLE_WIDTH_SCALE;
  const TABLE_LENGTH_SCALE = 0.8;
  const TABLE = {
    W: 72 * TABLE_SCALE,
    H: 132 * TABLE_SCALE * TABLE_LENGTH_SCALE,
    THICK: 1.8 * TABLE_SCALE,
    WALL: 2.6 * TABLE_SCALE
  };
const TABLE_OUTER_EXPANSION = TABLE.WALL * 0.18;
const RAIL_HEIGHT = TABLE.THICK * 1.82; // return rail height to the lower stance used previously so cushions no longer sit too tall
const POCKET_JAW_CORNER_OUTER_LIMIT_SCALE = 1.008; // push the corner jaws outward a touch so the fascia meets the chrome edge cleanly
const POCKET_JAW_SIDE_OUTER_LIMIT_SCALE =
  POCKET_JAW_CORNER_OUTER_LIMIT_SCALE; // keep the middle jaw clamp as wide as the corners so the fascia mass matches
const POCKET_JAW_CORNER_INNER_SCALE = 1.46; // pull the inner lip farther outward so the jaw profile runs longer and thins slightly while keeping the chrome-facing radius untouched
const POCKET_JAW_SIDE_INNER_SCALE = POCKET_JAW_CORNER_INNER_SCALE * 1.02; // round the middle jaws slightly more while keeping the corner match
const POCKET_JAW_CORNER_OUTER_SCALE = 1.84; // preserve the playable mouth while letting the corner fascia run longer and slimmer
const POCKET_JAW_SIDE_OUTER_SCALE =
  POCKET_JAW_CORNER_OUTER_SCALE * 1; // match the middle fascia thickness to the corners so the jaws read equally robust
const POCKET_JAW_CORNER_OUTER_EXPANSION = TABLE.THICK * 0.016; // flare the exterior jaw edge slightly so the chrome-facing finish broadens without widening the mouth
const SIDE_POCKET_JAW_OUTER_EXPANSION = POCKET_JAW_CORNER_OUTER_EXPANSION; // keep the outer fascia consistent with the corner jaws
const POCKET_JAW_DEPTH_SCALE = 1.08; // extend the jaw bodies so the underside reaches deeper below the cloth
const POCKET_JAW_VERTICAL_LIFT = TABLE.THICK * 0.114; // lower the visible rim so the pocket lips sit nearer the cloth plane
const POCKET_JAW_BOTTOM_CLEARANCE = TABLE.THICK * 0.03; // allow the jaw extrusion to extend farther down without lifting the top
const POCKET_JAW_FLOOR_CONTACT_LIFT = TABLE.THICK * 0.18; // keep the underside tight to the cloth depth instead of the deeper pocket floor
const POCKET_JAW_EDGE_FLUSH_START = 0.22; // hold the thicker centre section longer before easing toward the chrome trim
const POCKET_JAW_EDGE_FLUSH_END = 1; // ensure the jaw finish meets the chrome trim flush at the very ends
const POCKET_JAW_EDGE_TAPER_SCALE = 0.12; // thin the outer lips more aggressively while leaving the centre crown unchanged
const POCKET_JAW_CENTER_TAPER_HOLD = 0.28; // start easing earlier so the mass flows gradually from the centre toward the chrome plates
const POCKET_JAW_EDGE_TAPER_PROFILE_POWER = 1.25; // smooth the taper curve so thickness falls away progressively instead of dropping late
const POCKET_JAW_SIDE_CENTER_TAPER_HOLD = POCKET_JAW_CENTER_TAPER_HOLD; // keep the taper hold consistent so the middle jaw crown mirrors the corners
const POCKET_JAW_SIDE_EDGE_TAPER_SCALE = POCKET_JAW_EDGE_TAPER_SCALE; // reuse the corner taper scale so edge thickness matches exactly
const POCKET_JAW_SIDE_EDGE_TAPER_PROFILE_POWER = POCKET_JAW_EDGE_TAPER_PROFILE_POWER; // maintain the identical taper curve across all six jaws
const POCKET_JAW_CENTER_THICKNESS_MIN = 0.38; // let the inner arc sit leaner while preserving the curved silhouette across the pocket
const POCKET_JAW_CENTER_THICKNESS_MAX = 0.7; // keep a pronounced middle section while slimming the jaw before tapering toward the edges
const POCKET_JAW_OUTER_EXPONENT_MIN = 0.58; // controls arc falloff toward the chrome rim
const POCKET_JAW_OUTER_EXPONENT_MAX = 1.2;
const POCKET_JAW_INNER_EXPONENT_MIN = 0.78; // controls inner lip easing toward the cushion
const POCKET_JAW_INNER_EXPONENT_MAX = 1.34;
const POCKET_JAW_SEGMENT_MIN = 144; // higher tessellation for crisper high-res pocket jaws
const POCKET_JAW_CORNER_EDGE_FACTOR = 0.42; // widen the chamfer so the corner jaw shoulders carry the same mass as the photographed reference
const POCKET_JAW_SIDE_EDGE_FACTOR = POCKET_JAW_CORNER_EDGE_FACTOR; // keep the middle pocket chamfer identical to the corners
const POCKET_JAW_CORNER_MIDDLE_FACTOR = 0.97; // bias toward the new maximum thickness so the jaw crowns through the pocket centre
const POCKET_JAW_SIDE_MIDDLE_FACTOR = POCKET_JAW_CORNER_MIDDLE_FACTOR; // mirror the fuller centre section across middle pockets for consistency
const CORNER_POCKET_JAW_LATERAL_EXPANSION = 1.58; // extend the corner jaw reach so the entry width matches the visible bowl while stretching the fascia forward
const SIDE_POCKET_JAW_LATERAL_EXPANSION = 1.22; // push the middle jaw reach a touch wider so the openings read larger
const SIDE_POCKET_JAW_RADIUS_EXPANSION = 1.02; // trim the middle jaw arc radius so the side-pocket jaws read a touch tighter
const SIDE_POCKET_JAW_DEPTH_EXPANSION = 1.04; // add a hint of extra depth so the enlarged jaws stay balanced
const SIDE_POCKET_JAW_VERTICAL_TWEAK = TABLE.THICK * -0.016; // nudge the middle jaws down so their rims sit level with the cloth
const SIDE_POCKET_JAW_OUTWARD_SHIFT = TABLE.THICK * 0.072; // push the middle pocket jaws farther outward so the midpoint jaws open up away from centre
const SIDE_POCKET_JAW_EDGE_TRIM_START = POCKET_JAW_EDGE_FLUSH_START; // reuse the corner jaw shoulder timing
const SIDE_POCKET_JAW_EDGE_TRIM_SCALE = 0.86; // taper the middle jaw edges sooner so they finish where the rails stop
const SIDE_POCKET_JAW_EDGE_TRIM_CURVE = POCKET_JAW_EDGE_TAPER_PROFILE_POWER; // mirror the taper curve from the corner profile
const CORNER_JAW_ARC_DEG = 120; // base corner jaw span; lateral expansion yields 180° (50% circle) coverage
const SIDE_JAW_ARC_DEG = CORNER_JAW_ARC_DEG; // match the middle pocket jaw span to the corner profile
const POCKET_RIM_DEPTH_RATIO = 0; // remove the separate pocket rims so the chrome fascias meet the jaws directly
const SIDE_POCKET_RIM_DEPTH_RATIO = POCKET_RIM_DEPTH_RATIO; // keep the middle pocket rims identical to the jaw fascia depth
const POCKET_RIM_SURFACE_OFFSET_SCALE = 0.02; // lift the rim slightly so the taller parts avoid z-fighting while staying aligned
const POCKET_RIM_SURFACE_ABSOLUTE_LIFT = TABLE.THICK * 0.052; // ensure the rim clears the jaw top even when the rails compress
const SIDE_POCKET_RIM_SURFACE_OFFSET_SCALE = POCKET_RIM_SURFACE_OFFSET_SCALE; // reuse the corner elevation so the middle rims sit flush
const SIDE_POCKET_RIM_SURFACE_ABSOLUTE_LIFT = POCKET_RIM_SURFACE_ABSOLUTE_LIFT; // keep the middle pocket rims aligned to the same vertical gap
const FRAME_TOP_Y = -TABLE.THICK + 0.01; // mirror the snooker rail stackup so chrome + cushions line up identically
const TABLE_RAIL_TOP_Y = FRAME_TOP_Y + RAIL_HEIGHT;
  // Reuse the Pool Royale playfield and pocket metrics so pockets + balls line up exactly with that table
  // (WPA 9ft reference: 100" × 50", 2.25" balls)
  const WIDTH_REF = 2540;
  const HEIGHT_REF = 1270;
  const BALL_D_REF = 57.15;
  const BAULK_FROM_BAULK_REF = 737; // Baulk line distance from the baulk cushion (29")
  const D_RADIUS_REF = 292;
  const PINK_FROM_TOP_REF = 737;
  const BLACK_FROM_TOP_REF = 324; // Black spot distance from the top cushion (12.75")
  const CORNER_MOUTH_REF = 114.3; // 4.5" corner pocket mouth between cushion noses (Pool Royale match)
  const SIDE_MOUTH_REF = 127; // 5" side pocket mouth between cushion noses (Pool Royale match)
  const SIDE_RAIL_INNER_REDUCTION = 0.72; // nudge the rails further inward so the cloth footprint tightens slightly more
  const SIDE_RAIL_INNER_SCALE = 1 - SIDE_RAIL_INNER_REDUCTION;
  const SIDE_RAIL_INNER_THICKNESS = TABLE.WALL * SIDE_RAIL_INNER_SCALE;
  // Relax the aspect ratio so the table reads wider on screen while keeping the playfield height untouched
  // and preserving pocket proportions from the previous build.
  const TARGET_RATIO = 1.83;
const END_RAIL_INNER_SCALE =
  (TABLE.H - TARGET_RATIO * (TABLE.W - 2 * SIDE_RAIL_INNER_THICKNESS)) /
  (2 * TABLE.WALL);
const END_RAIL_INNER_REDUCTION = 1 - END_RAIL_INNER_SCALE;
const END_RAIL_INNER_THICKNESS = TABLE.WALL * END_RAIL_INNER_SCALE;
const PLAY_W = TABLE.W - 2 * SIDE_RAIL_INNER_THICKNESS;
const PLAY_H = TABLE.H - 2 * END_RAIL_INNER_THICKNESS;
const innerLong = Math.max(PLAY_W, PLAY_H);
const innerShort = Math.min(PLAY_W, PLAY_H);
const CURRENT_RATIO = innerLong / Math.max(1e-6, innerShort);
  console.assert(
    Math.abs(CURRENT_RATIO - TARGET_RATIO) < 1e-4,
    'Pool table inner ratio must match the widened 1.83:1 target after scaling.'
  );
const MM_TO_UNITS = innerLong / WIDTH_REF;
const BALL_SIZE_SCALE = 0.94248; // 5% larger than the last Pool Royale build (15.8% over the original baseline)
const BALL_DIAMETER = BALL_D_REF * MM_TO_UNITS * BALL_SIZE_SCALE;
const BALL_SCALE = BALL_DIAMETER / 4;
const BALL_R = BALL_DIAMETER / 2;
const ENABLE_BALL_FLOOR_SHADOWS = true;
const BALL_SHADOW_RADIUS_MULTIPLIER = 0.92;
const BALL_SHADOW_OPACITY = 0.25;
const BALL_SHADOW_LIFT = BALL_R * 0.02;
const SIDE_POCKET_EXTRA_SHIFT = 0; // align middle pocket centres flush with the reference layout
const SIDE_POCKET_OUTWARD_BIAS = TABLE.THICK * 0.02; // push the middle pocket centres and cloth cutouts slightly outward away from the table midpoint
const SIDE_POCKET_FIELD_PULL = TABLE.THICK * 0.026; // gently bias the middle pocket centres and cuts back toward the playfield
const SIDE_POCKET_CLOTH_INWARD_PULL = TABLE.THICK * 0.032; // pull only the middle pocket cloth cutouts slightly toward the playfield centre
const CHALK_TOP_COLOR = 0xd9c489;
const CHALK_SIDE_COLOR = 0x10141b;
const CHALK_SIDE_ACTIVE_COLOR = 0x1a2430;
const CHALK_BOTTOM_COLOR = 0x0b0e14;
const CHALK_ACTIVE_COLOR = 0xf3e3ae;
const CHALK_EMISSIVE_COLOR = 0x0d1018;
const CHALK_ACTIVE_EMISSIVE_COLOR = 0x1b2838;
const CHALK_PRECISION_SLOW_MULTIPLIER = 0.25;
const CHALK_AIM_LERP_SLOW = 0.08;
const CHALK_TARGET_RING_RADIUS = BALL_R * 2;
const CHALK_RING_OPACITY = 0.18;
const BAULK_FROM_BAULK = BAULK_FROM_BAULK_REF * MM_TO_UNITS;
const D_RADIUS = D_RADIUS_REF * MM_TO_UNITS;
const BLACK_FROM_TOP = BLACK_FROM_TOP_REF * MM_TO_UNITS;
const POCKET_CORNER_MOUTH_SCALE = CORNER_POCKET_SCALE_BOOST * CORNER_POCKET_EXTRA_SCALE;
const SIDE_POCKET_MOUTH_REDUCTION_SCALE = 0.958; // shrink the middle pocket mouth width a touch more so the radius tightens up further
const POCKET_SIDE_MOUTH_SCALE =
  (CORNER_MOUTH_REF / SIDE_MOUTH_REF) *
  POCKET_CORNER_MOUTH_SCALE *
  SIDE_POCKET_MOUTH_REDUCTION_SCALE; // keep the middle pocket mouth width identical to the corner pockets
const SIDE_POCKET_CUT_SCALE = 0.954; // trim the middle cloth/rail cutouts a bit more so the openings follow the tighter pocket radius
const POCKET_CORNER_MOUTH =
  CORNER_MOUTH_REF * MM_TO_UNITS * POCKET_CORNER_MOUTH_SCALE;
const POCKET_SIDE_MOUTH = SIDE_MOUTH_REF * MM_TO_UNITS * POCKET_SIDE_MOUTH_SCALE;
const POCKET_VIS_R = POCKET_CORNER_MOUTH / 2;
const POCKET_INTERIOR_TOP_SCALE = 1.012; // gently expand the interior diameter at the top of each pocket for a broader opening
const POCKET_R = POCKET_VIS_R * 0.985;
const CORNER_POCKET_CENTER_INSET =
  POCKET_VIS_R * 0.32 * POCKET_VISUAL_EXPANSION; // push the corner pocket centres and cuts a bit farther outward toward the rails
const SIDE_POCKET_RADIUS = POCKET_SIDE_MOUTH / 2;
const CORNER_CHROME_NOTCH_RADIUS =
  POCKET_VIS_R * POCKET_VISUAL_EXPANSION * CORNER_POCKET_INWARD_SCALE;
const SIDE_CHROME_NOTCH_RADIUS = SIDE_POCKET_RADIUS * POCKET_VISUAL_EXPANSION;
const CORNER_RAIL_NOTCH_INSET =
  POCKET_VIS_R * 0.078 * POCKET_VISUAL_EXPANSION; // let the rail and chrome cutouts follow the outward corner pocket shift
const POCKET_MOUTH_TOLERANCE = 0.5 * MM_TO_UNITS;
console.assert(
  Math.abs(POCKET_CORNER_MOUTH - POCKET_VIS_R * 2) <= POCKET_MOUTH_TOLERANCE,
  'Corner pocket mouth width mismatch.'
);
console.assert(
  Math.abs(POCKET_SIDE_MOUTH - SIDE_POCKET_RADIUS * 2) <= POCKET_MOUTH_TOLERANCE,
  'Side pocket mouth width mismatch.'
);
console.assert(
  Math.abs(BALL_DIAMETER - BALL_R * 2) <= 0.1 * MM_TO_UNITS,
  'Ball diameter mismatch after scaling.'
);
const CLOTH_LIFT = (() => {
  const ballR = BALL_R;
  const microEpsRatio = 0.022857142857142857;
  const eps = ballR * microEpsRatio;
  return Math.max(0, RAIL_HEIGHT - ballR - eps);
})();
const ACTION_CAMERA_START_BLEND = 1;
const CLOTH_DROP = BALL_R * 0.18; // lower the cloth surface slightly for added depth
const CLOTH_TOP_LOCAL = FRAME_TOP_Y + BALL_R * 0.09523809523809523;
const MICRO_EPS = BALL_R * 0.022857142857142857;
const POCKET_CUT_EXPANSION = POCKET_INTERIOR_TOP_SCALE; // align cloth apertures to the now-wider interior pocket diameter at the rim
const CLOTH_REFLECTION_LIMITS = Object.freeze({
  clearcoatMax: 0.028,
  clearcoatRoughnessMin: 0.48,
  envMapIntensityMax: 0
});
const POCKET_HOLE_R =
  POCKET_VIS_R * POCKET_CUT_EXPANSION * POCKET_VISUAL_EXPANSION; // cloth cutout radius now matches the interior pocket rim
const BALL_CENTER_Y =
  CLOTH_TOP_LOCAL + CLOTH_LIFT + BALL_R - CLOTH_DROP; // rest balls directly on the lowered cloth plane
const BALL_SHADOW_Y = BALL_CENTER_Y - BALL_R + BALL_SHADOW_LIFT + MICRO_EPS;
const BALL_SEGMENTS = Object.freeze({ width: 80, height: 60 });
const BALL_GEOMETRY = new THREE.SphereGeometry(
  BALL_R,
  BALL_SEGMENTS.width,
  BALL_SEGMENTS.height
);
const BALL_SHADOW_GEOMETRY = ENABLE_BALL_FLOOR_SHADOWS
  ? new THREE.CircleGeometry(BALL_R * BALL_SHADOW_RADIUS_MULTIPLIER, 32)
  : null;
if (BALL_SHADOW_GEOMETRY) BALL_SHADOW_GEOMETRY.rotateX(-Math.PI / 2);
const BALL_SHADOW_MATERIAL = ENABLE_BALL_FLOOR_SHADOWS
  ? new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: BALL_SHADOW_OPACITY,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  : null;
if (BALL_SHADOW_MATERIAL) {
  BALL_SHADOW_MATERIAL.polygonOffset = true;
  BALL_SHADOW_MATERIAL.polygonOffsetFactor = -0.5;
  BALL_SHADOW_MATERIAL.polygonOffsetUnits = -0.5;
}
// Match the snooker build so pace and rebound energy stay consistent between modes.
const FRICTION = 0.993;
const DEFAULT_CUSHION_RESTITUTION = 0.985;
let CUSHION_RESTITUTION = DEFAULT_CUSHION_RESTITUTION;
const STOP_EPS = 0.02;
const STOP_SOFTENING = 0.9; // ease balls into a stop instead of hard-braking at the speed threshold
const STOP_FINAL_EPS = STOP_EPS * 0.45;
const FRAME_TIME_CATCH_UP_MULTIPLIER = 3; // allow up to 3 frames of catch-up when recovering from slow frames
const MIN_FRAME_SCALE = 1e-6; // prevent zero-length frames from collapsing physics updates
const MAX_FRAME_SCALE = 2.4; // clamp slow-frame recovery so physics catch-up cannot stall the render loop
const MAX_PHYSICS_SUBSTEPS = 5; // keep catch-up updates smooth without exploding work per frame
const STUCK_SHOT_TIMEOUT_MS = 4500; // auto-resolve shots if motion stops but the turn never clears
const MAX_POWER_BOUNCE_THRESHOLD = 0.98;
const MAX_POWER_BOUNCE_IMPULSE = BALL_R * 1.9; // push full-power launches higher so cue-ball jumps read stronger
const MAX_POWER_BOUNCE_GRAVITY = BALL_R * 3.2;
const MAX_POWER_BOUNCE_DAMPING = 0.86;
const MAX_POWER_LANDING_SOUND_COOLDOWN_MS = 240;
const MAX_POWER_CAMERA_HOLD_MS = 2000;
const MAX_POWER_SPIN_LATERAL_THROW = BALL_R * 0.42; // let max-power jumps inherit a strong sideways release from active side spin
const MAX_POWER_SPIN_LIFT_BONUS = BALL_R * 0.28; // spin adds extra hop height when the cue ball is driven at full power
const POCKET_INTERIOR_CAPTURE_R =
  POCKET_VIS_R * POCKET_INTERIOR_TOP_SCALE * POCKET_VISUAL_EXPANSION; // match capture radius directly to the pocket bowl opening
const SIDE_POCKET_INTERIOR_CAPTURE_R =
  SIDE_POCKET_RADIUS * POCKET_INTERIOR_TOP_SCALE * POCKET_VISUAL_EXPANSION; // keep middle-pocket capture identical to its bowl radius
const CAPTURE_R = POCKET_INTERIOR_CAPTURE_R; // pocket capture radius aligned to the true bowl opening
const SIDE_CAPTURE_R = SIDE_POCKET_INTERIOR_CAPTURE_R; // middle pocket capture now mirrors the bowl radius
const POCKET_GUARD_RADIUS = Math.max(0, POCKET_INTERIOR_CAPTURE_R - BALL_R * 0.04); // align the rail guard to the playable capture bowl instead of the visual rim
const POCKET_GUARD_CLEARANCE = Math.max(0, POCKET_GUARD_RADIUS - BALL_R * 0.08); // keep a slim safety margin so clean entries aren't rejected
const CORNER_POCKET_DEPTH_LIMIT =
  POCKET_VIS_R * 1.58 * POCKET_VISUAL_EXPANSION; // clamp corner reflections to the actual pocket depth
const SIDE_POCKET_GUARD_RADIUS =
  SIDE_POCKET_INTERIOR_CAPTURE_R - BALL_R * 0.06; // use the middle-pocket bowl to gate reflections with a tighter inset
const SIDE_POCKET_GUARD_CLEARANCE = Math.max(
  0,
  SIDE_POCKET_GUARD_RADIUS - BALL_R * 0.08
);
const SIDE_POCKET_DEPTH_LIMIT =
  POCKET_VIS_R * 1.52 * POCKET_VISUAL_EXPANSION; // reduce the invisible pocket wall so rail-first cuts fall naturally
const SIDE_POCKET_SPAN =
  SIDE_POCKET_RADIUS * 0.9 * POCKET_VISUAL_EXPANSION + BALL_R * 0.52; // tune the middle lane to the real mouth width
const CLOTH_THICKNESS = TABLE.THICK * 0.12; // match snooker cloth profile so cushions blend seamlessly
const PLYWOOD_ENABLED = false; // fully disable any plywood underlay beneath the cloth
const PLYWOOD_THICKNESS = 0; // remove the plywood bed so no underlayment renders beneath the cloth
const PLYWOOD_GAP = 0;
const PLYWOOD_EXTRA_DROP = 0;
const PLYWOOD_SURFACE_COLOR = 0xd8c29b; // fallback plywood tone when a finish color is unavailable
const PLYWOOD_HOLE_SCALE = 1.05; // plywood pocket cutouts should be 5% larger than the pocket bowls for clearance
const PLYWOOD_HOLE_R = POCKET_VIS_R * PLYWOOD_HOLE_SCALE * POCKET_VISUAL_EXPANSION;
const CLOTH_EDGE_GAP_FILL = TABLE.THICK * 0.46; // drive the cloth sleeve deeper so it seals the exposed gap left by the removed plywood
const CLOTH_EXTENDED_DEPTH = CLOTH_THICKNESS + CLOTH_EDGE_GAP_FILL; // wrap enough felt to close the plywood gap while keeping the surface profile unchanged
const CLOTH_EDGE_TOP_RADIUS_SCALE = 0.986; // pinch the cloth sleeve opening slightly so the pocket lip picks up a soft round-over
const CLOTH_EDGE_BOTTOM_RADIUS_SCALE = 1.04; // flare the lower sleeve so the wrap hugs the pocket throat before meeting the drop
const CLOTH_EDGE_CURVE_INTENSITY = 0.012; // shallow easing that rounds the cloth sleeve as it transitions from lip to throat
const CLOTH_EDGE_TEXTURE_HEIGHT_SCALE = 1.2; // boost vertical tiling so the wrapped cloth reads with tighter, more realistic fibres
const CLOTH_EDGE_TINT = 0.18; // keep the pocket sleeves closer to the base felt tone so they don't glow around the cuts
const CLOTH_EDGE_EMISSIVE_MULTIPLIER = 0.02; // soften light spill on the sleeve walls while keeping reflections muted
const CLOTH_EDGE_EMISSIVE_INTENSITY = 0.24; // further dim emissive brightness so the cutouts stay consistent with the cloth plane
const CUSHION_OVERLAP = SIDE_RAIL_INNER_THICKNESS * 0.35; // overlap between cushions and rails to hide seams
const CUSHION_EXTRA_LIFT = -TABLE.THICK * 0.072; // lower the cushion base slightly so the lip sits closer to the cloth
const CUSHION_HEIGHT_DROP = TABLE.THICK * 0.226; // trim the cushion tops further so they sit a touch lower than before
const CUSHION_FIELD_CLIP_RATIO = 0.152; // trim the cushion extrusion right at the cloth plane so no geometry sinks underneath the surface
const SIDE_RAIL_EXTRA_DEPTH = TABLE.THICK * 1.12; // deepen side aprons so the lower edge flares out more prominently
const END_RAIL_EXTRA_DEPTH = SIDE_RAIL_EXTRA_DEPTH; // drop the end rails to match the side apron depth
const RAIL_OUTER_EDGE_RADIUS_RATIO = 0; // keep the exterior wooden rails straight with no rounding
const POCKET_RECESS_DEPTH =
  BALL_R * 0.24; // keep the pocket throat visible without sinking the rim
const POCKET_DROP_GRAVITY = 42; // steeper gravity for a natural fall into the leather cradle
const POCKET_DROP_ENTRY_VELOCITY = -0.6; // initial downward impulse before gravity takes over
const POCKET_DROP_REST_HOLD_MS = 360; // keep the ball visible on the strap briefly before hiding it
const POCKET_DROP_SPEED_REFERENCE = 1.4;
const POCKET_HOLDER_SLIDE = BALL_R * 1.2; // horizontal drift as the ball rolls toward the leather strap
const POCKET_HOLDER_TILT_RAD = THREE.MathUtils.degToRad(9); // slight angle so potted balls settle against the strap
const POCKET_LEATHER_TEXTURE_ID = 'fabric_leather_02';
const POCKET_LEATHER_TEXTURE_REPEAT = Object.freeze({ x: 0.15, y: 0.15 });
const POCKET_LEATHER_TEXTURE_ANISOTROPY = 8;
const POCKET_CLOTH_TOP_RADIUS = POCKET_VIS_R * 0.84 * POCKET_VISUAL_EXPANSION; // trim the cloth aperture to match the smaller chrome + rail cuts
const POCKET_CLOTH_BOTTOM_RADIUS = POCKET_CLOTH_TOP_RADIUS * 0.62;
const POCKET_CLOTH_DEPTH = POCKET_RECESS_DEPTH * 1.05;
const POCKET_TOP_R =
  POCKET_VIS_R * POCKET_INTERIOR_TOP_SCALE * POCKET_VISUAL_EXPANSION;
const POCKET_BOTTOM_R = POCKET_TOP_R * 0.7;
const POCKET_WALL_OPEN_TRIM = TABLE.THICK * 0.18;
const POCKET_WALL_HEIGHT = TABLE.THICK * 0.7 - POCKET_WALL_OPEN_TRIM;
const POCKET_NET_DEPTH = TABLE.THICK * 2.26;
const POCKET_NET_VERTICAL_LIFT = BALL_R * 0.26;
const POCKET_NET_SEGMENTS = 64;
const POCKET_DROP_DEPTH = POCKET_NET_DEPTH * 0.9; // drop nearly the full net depth so potted balls clear the rim
const POCKET_DROP_STRAP_DEPTH = POCKET_DROP_DEPTH * 0.74; // stop the fall slightly above the ring/strap junction
const POCKET_NET_RING_RADIUS_SCALE = 0.88; // widen the ring so balls pass cleanly through before rolling onto the holder rails
const POCKET_NET_RING_TUBE_RADIUS = BALL_R * 0.14; // thicker chrome to read as a connector between net and holder rails
const POCKET_NET_RING_VERTICAL_OFFSET = BALL_R * 0.14; // lift the ring so the holder assembly sits higher
const POCKET_NET_HEX_REPEAT = 3;
const POCKET_NET_HEX_RADIUS_RATIO = 0.085;
const POCKET_GUIDE_RADIUS = BALL_R * 0.075; // slimmer chrome rails so potted balls visibly ride the three thin holders
const POCKET_GUIDE_LENGTH = Math.max(POCKET_NET_DEPTH * 1.35, BALL_DIAMETER * 5.6); // stretch the holder run so it comfortably fits 5 balls
const POCKET_GUIDE_DROP = BALL_R * 0.12;
const POCKET_GUIDE_SPREAD = BALL_R * 0.48;
const POCKET_GUIDE_RING_CLEARANCE = BALL_R * 0.08; // start the chrome rails just outside the ring to keep the mouth open
const POCKET_GUIDE_RING_OVERLAP = POCKET_NET_RING_TUBE_RADIUS * 1.05; // allow the L-arms to peek past the ring without blocking the pocket mouth
const POCKET_GUIDE_STEM_DEPTH = BALL_DIAMETER * 1.1; // lengthen the elbow so each rail meets the ring with a ball-length guide
const POCKET_GUIDE_FLOOR_DROP = BALL_R * 0.14; // drop the centre rail to form the floor of the holder
const POCKET_GUIDE_VERTICAL_DROP = BALL_R * 0.06; // lift the chrome holder rails so the short L segments meet the ring
const POCKET_DROP_RING_HOLD_MS = 120; // brief pause on the ring so the fall looks natural before rolling along the holder
const POCKET_HOLDER_REST_SPACING = BALL_DIAMETER * 1.2; // wider spacing so potted balls line up without overlapping on the holder rails
const POCKET_HOLDER_REST_PULLBACK = BALL_R * 1.6; // stop the lead ball right against the leather strap without letting it bury the backstop
const POCKET_HOLDER_REST_DROP = BALL_R * 0.6; // lower the resting spot just enough for the balls to sit on the holder rails
const POCKET_HOLDER_RUN_SPEED_MIN = BALL_DIAMETER * 2.2; // base roll speed along the holder rails after clearing the ring
const POCKET_HOLDER_RUN_SPEED_MAX = BALL_DIAMETER * 5.6; // clamp the roll speed so balls don't overshoot the leather backstop
const POCKET_HOLDER_RUN_ENTRY_SCALE = BALL_DIAMETER * 0.9; // scale entry speed into a believable roll along the holders
const POCKET_MIDDLE_HOLDER_SWAY = 0.32; // add a slight diagonal so middle-pocket holders angle like the reference photos
const POCKET_EDGE_STOP_EXTRA_DROP = TABLE.THICK * 0.14; // push the cloth sleeve past the felt base so it meets the pocket walls cleanly
const POCKET_HOLDER_L_LEG = BALL_DIAMETER * 0.92; // extend the short L section so it reaches the ring and guides balls like the reference trays
const POCKET_HOLDER_L_SPAN = Math.max(POCKET_GUIDE_LENGTH * 0.42, BALL_DIAMETER * 5.2); // longer tray section that actually holds the balls
const POCKET_HOLDER_L_THICKNESS = POCKET_GUIDE_RADIUS * 3; // thickness shared by both L segments for a sturdy chrome look
const POCKET_STRAP_VERTICAL_LIFT = BALL_R * 0.22; // lift the leather strap so it meets the raised holder rails
const POCKET_BOARD_TOUCH_OFFSET = -CLOTH_EXTENDED_DEPTH + MICRO_EPS * 2; // raise the pocket bowls until they meet the cloth underside without leaving a gap
const POCKET_EDGE_SLEEVES_ENABLED = false; // remove the extra cloth sleeve around the pocket cuts
const SIDE_POCKET_PLYWOOD_LIFT = TABLE.THICK * 0.085; // raise the middle pocket bowls so they tuck directly beneath the cloth like the corner pockets
const POCKET_CAM_BASE_MIN_OUTSIDE =
  Math.max(SIDE_RAIL_INNER_THICKNESS, END_RAIL_INNER_THICKNESS) * 1.18 +
  POCKET_VIS_R * 2.25 +
  BALL_R * 1.6;
const POCKET_CAM_BASE_OUTWARD_OFFSET =
  Math.max(SIDE_RAIL_INNER_THICKNESS, END_RAIL_INNER_THICKNESS) * 1.34 +
  POCKET_VIS_R * 2.28 +
  BALL_R * 1.54;
const POCKET_CAM = Object.freeze({
  triggerDist: CAPTURE_R * 12,
  dotThreshold: 0.22,
  minOutside: POCKET_CAM_BASE_MIN_OUTSIDE,
  minOutsideShort: POCKET_CAM_BASE_MIN_OUTSIDE * 1.06,
  maxOutside: BALL_R * 30,
  heightOffset: BALL_R * 1.9,
  heightOffsetShortMultiplier: 0.96,
  outwardOffset: POCKET_CAM_BASE_OUTWARD_OFFSET,
  outwardOffsetShort: POCKET_CAM_BASE_OUTWARD_OFFSET * 1.04,
  heightDrop: BALL_R * 0.45,
  distanceScale: 0.96,
  heightScale: 1.06,
  focusBlend: 0.22,
  lateralFocusShift: POCKET_VIS_R * 0.32,
  railFocusLong: BALL_R * 8,
  railFocusShort: BALL_R * 5.4
});
const POCKET_CHAOS_MOVING_THRESHOLD = 3;
const POCKET_GUARANTEED_ALIGNMENT = 0.95;
const POCKET_INTENT_TIMEOUT_MS = 4200;
const ACTION_CAM = Object.freeze({
  pairMinDistance: BALL_R * 28,
  pairMaxDistance: BALL_R * 72,
  pairDistanceScale: 1.05,
  sideBias: 1.24,
  forwardBias: 0.1,
  shortRailBias: 0.52,
  followShortRailBias: 0.42,
  heightOffset: BALL_R * 9.2,
  smoothingTime: 0.32,
  followSmoothingTime: 0.24,
  followDistance: BALL_R * 54,
  followHeightOffset: BALL_R * 7.4,
  followHoldMs: 900
});
/**
 * Pool Camera Direction
 *
 * 0–2s (Opening Pan)
 * • Camera starts high with a diagonal angle over the table (~60°).
 * • Slow pan right → left showing the whole table.
 *
 * 2–4s (Focus on Cue Ball)
 * • Camera moves toward the cue ball and cue stick.
 * • Angle drops to 20–25° above the table directly behind the cue.
 * • Light zoom / tighter framing.
 *
 * 4–6s (Strike Tracking)
 * • At impact the camera shakes lightly.
 * • Then it follows the cue ball across the table, keeping it centered.
 *
 * 6–9s (Impact & Spread)
 * • When the balls collide, the camera rises gradually (toward top-down).
 * • The FOV widens to frame all balls.
 * • Executes a quick orbital move around the table (~30° rotation).
 *
 * 9–12s (Potting Shot)
 * • Camera performs a dolly-in to the pocket where the ball drops.
 * • Follows the ball inside the pocket for ~1 second.
 * • Then fades out or returns to the full view.
 *
 * 12s+ (Reset)
 * • Camera returns to the initial overview (45° above the table).
 * • Holds a very slow pan as an idle loop until the next shot.
 *
 * 🎮 Triggers
 * • Start of game → Opening Pan.
 * • When the player prepares → Focus on Cue Ball.
 * • Moment of the hit → Strike Tracking.
 * • When the balls collide → Impact & Spread.
 * • When a ball drops into a pocket → Potting Shot.
 * • After each round → Reset.
 */
const CAMERA_LATERAL_CLAMP = Object.freeze({
  short: PLAY_W * 0.4,
  side: PLAY_H * 0.45
});
const POCKET_VIEW_MIN_DURATION_MS = 560;
const POCKET_VIEW_ACTIVE_EXTENSION_MS = 300;
const POCKET_VIEW_POST_POT_HOLD_MS = 160;
const POCKET_VIEW_MAX_HOLD_MS = 3200;
const SPIN_STRENGTH = BALL_R * 0.0295 * 1.15;
const SPIN_DECAY = 0.9;
const SPIN_ROLL_STRENGTH = BALL_R * 0.0175 * 1.15;
const SPIN_ROLL_DECAY = 0.978;
const SPIN_AIR_DECAY = 0.997; // hold spin energy while the cue ball travels straight pre-impact
const LIFT_SPIN_AIR_DRIFT = SPIN_ROLL_STRENGTH * 1.6; // inject extra sideways carry while the cue ball is airborne
const RAIL_SPIN_THROW_SCALE = BALL_R * 0.24; // let cushion contacts inherit noticeable throw from active side spin
const RAIL_SPIN_THROW_REF_SPEED = BALL_R * 18;
const RAIL_SPIN_NORMAL_FLIP = 0.65; // invert spin along the impact normal to keep the cue ball rolling after rebounds
const SWERVE_THRESHOLD = 0.7; // outer 30% of the spin control activates swerve behaviour
const SWERVE_TRAVEL_MULTIPLIER = 0.86; // let swerve-driven roll carry more lateral energy while staying believable
const PRE_IMPACT_SPIN_DRIFT = 0.1; // reapply stored sideways swerve once the cue ball is rolling after impact
// Align shot strength to the legacy 2D tuning (3.3 * 0.3 * 1.65) while keeping overall power 25% softer than before.
// Apply an additional 20% reduction to soften every strike and keep mobile play comfortable.
// Pool Royale feedback: increase standard shots by 30% and amplify the break by 50% to open racks faster.
const SHOT_POWER_REDUCTION = 0.85;
const SHOT_FORCE_BOOST =
  1.5 * 0.75 * 0.85 * 0.8 * 1.3 * 0.85 * SHOT_POWER_REDUCTION * 1.15;
const SHOT_BREAK_MULTIPLIER = 1.5;
const SHOT_BASE_SPEED = 3.3 * 0.3 * 1.65 * SHOT_FORCE_BOOST * 1.15; // lift every stroke by 15% for a stronger launch
const SHOT_MIN_FACTOR = 0.25;
const SHOT_POWER_RANGE = 0.75;
const BALL_COLLISION_SOUND_REFERENCE_SPEED = SHOT_BASE_SPEED * 1.8;
const RAIL_HIT_SOUND_REFERENCE_SPEED = SHOT_BASE_SPEED * 1.2;
const RAIL_HIT_SOUND_COOLDOWN_MS = 140;
const CROWD_VOLUME_SCALE = 1;
const CUE_STRIKE_VOLUME_MULTIPLIER = 1; // normalize cue strikes to 100% loudness for clearer but balanced feedback
const CUE_STRIKE_MAX_GAIN = 9; // allow the louder cue strike to pass through without clipping to the previous cap
const POCKET_SOUND_TAIL = 1;
// Pool Royale now raises the stance; extend the legs so the playfield sits higher
const LEG_SCALE = 6.2;
const LEG_HEIGHT_FACTOR = 4;
const LEG_HEIGHT_MULTIPLIER = 4.5;
const BASE_TABLE_LIFT = 3.6;
const TABLE_DROP = 0.4;
const TABLE_HEIGHT_REDUCTION = 1;
const TABLE_HEIGHT_SCALE = 1.3;
const TABLE_H = 0.75 * LEG_SCALE * TABLE_HEIGHT_REDUCTION * TABLE_HEIGHT_SCALE;
const TABLE_LIFT =
  BASE_TABLE_LIFT + TABLE_H * (LEG_HEIGHT_FACTOR - 1);
const BASE_LEG_HEIGHT = TABLE.THICK * 2 * 3 * 1.15 * LEG_HEIGHT_MULTIPLIER;
const LEG_RADIUS_SCALE = 1.2; // 20% thicker cylindrical legs
const BASE_LEG_LENGTH_SCALE = 0.72; // previous leg extension factor used for baseline stance
const LEG_ELEVATION_SCALE = 0.96; // shorten the current leg extension to lower the playfield
const LEG_LENGTH_SHRINK = 0.7225; // shorten legs by an additional 15%
const LEG_LENGTH_SCALE = BASE_LEG_LENGTH_SCALE * LEG_ELEVATION_SCALE * LEG_LENGTH_SHRINK;
const LEG_HEIGHT_OFFSET = FRAME_TOP_Y - 0.3; // relationship between leg room and visible leg height
const LEG_ROOM_HEIGHT_RAW = BASE_LEG_HEIGHT + TABLE_LIFT;
const BASE_LEG_ROOM_HEIGHT =
  (LEG_ROOM_HEIGHT_RAW + LEG_HEIGHT_OFFSET) * BASE_LEG_LENGTH_SCALE - LEG_HEIGHT_OFFSET;
const LEG_ROOM_HEIGHT =
  (LEG_ROOM_HEIGHT_RAW + LEG_HEIGHT_OFFSET) * LEG_LENGTH_SCALE - LEG_HEIGHT_OFFSET;
const LEG_ELEVATION_DELTA = LEG_ROOM_HEIGHT - BASE_LEG_ROOM_HEIGHT;
const LEG_TOP_OVERLAP = TABLE.THICK * 0.25; // sink legs slightly into the apron so they appear connected
const LEG_POCKET_CLEARANCE = TABLE.WALL * 1.35; // pull the classic legs deeper toward the short-rail centres to clear pocket drops
const CLASSIC_SHORT_RAIL_CENTER_PULL = TABLE.WALL * 0.55; // additional inward shift so legs visually hug the middle of each short rail
const PORTAL_POCKET_CLEARANCE = TABLE.WALL * 1.1; // pull the open-portal uprights away from the pocket drop line
const PORTAL_LEG_CENTER_PULL = TABLE.WALL * 1.08; // slide open-portal legs further inward along the short rail
const PORTAL_SHORT_RAIL_CENTER_PULL = TABLE.WALL * 0.46; // pull portal uprights toward the visual centre of the short rail
const SKIRT_DROP_MULTIPLIER = 0; // remove the apron/skirt drop so the table body stays tight to the rails
const SKIRT_SIDE_OVERHANG = 0; // keep the lower base flush with the rail footprint (no horizontal flare)
const SKIRT_RAIL_GAP_FILL = TABLE.THICK * 0.072; // raise the apron further so it fully meets the lowered rails
const BASE_HEIGHT_FILL = 0.94; // grow bases upward so the stance stays consistent with the shorter skirt
// adjust overall table position so the shorter legs bring the playfield closer to floor level
const BASE_TABLE_Y = -2 + (TABLE_H - 0.75) + TABLE_H + TABLE_LIFT - TABLE_DROP;
const TABLE_Y = BASE_TABLE_Y + LEG_ELEVATION_DELTA;
const FLOOR_Y = TABLE_Y - TABLE.THICK - LEG_ROOM_HEIGHT + 0.3;
const ORBIT_FOCUS_BASE_Y = TABLE_Y + 0.05;
const CAMERA_CUE_SURFACE_MARGIN = BALL_R * 0.42; // keep orbit height aligned with the cue while leaving a safe buffer above
const CUE_TIP_CLEARANCE = BALL_R * 0.22; // widen the visible air gap so the blue tip never kisses the cue ball
const CUE_TIP_GAP = BALL_R * 1.08 + CUE_TIP_CLEARANCE; // pull the blue tip into the cue-ball centre line while leaving a safe buffer
const CUE_PULL_BASE = BALL_R * 10 * 0.95 * 2.05;
const CUE_PULL_MIN_VISUAL = BALL_R * 1.75; // guarantee a clear visible pull even when clearance is tight
const CUE_PULL_VISUAL_FUDGE = BALL_R * 2.5; // allow extra travel before obstructions cancel the pull
const CUE_PULL_VISUAL_MULTIPLIER = 1.7;
const CUE_PULL_SMOOTHING = 0.55;
const CUE_PULL_ALIGNMENT_BOOST = 0.32; // amplify visible pull when the camera looks straight down the cue, reducing foreshortening
const CUE_PULL_CUE_CAMERA_DAMPING = 0.08; // trim the pull depth slightly while keeping more of the stroke visible in cue view
const CUE_PULL_STANDING_CAMERA_BONUS = 0.2; // add extra draw for higher orbit angles so the stroke feels weightier
const CUE_PULL_MAX_VISUAL_BONUS = 0.38; // cap the compensation so the cue never overextends past the intended stroke
const CUE_PULL_GLOBAL_VISIBILITY_BOOST = 1.12; // ensure every stroke pulls slightly farther back for readability at all angles
const CUE_STROKE_MIN_MS = 95;
const CUE_STROKE_MAX_MS = 420;
const CUE_STROKE_SPEED_MIN = BALL_R * 18;
const CUE_STROKE_SPEED_MAX = BALL_R * 32;
const CUE_FOLLOW_MIN_MS = 180;
const CUE_FOLLOW_MAX_MS = 420;
const CUE_FOLLOW_SPEED_MIN = BALL_R * 12;
const CUE_FOLLOW_SPEED_MAX = BALL_R * 24;
const CUE_Y = BALL_CENTER_Y - BALL_R * 0.085; // rest the cue a touch lower so the tip lines up with the cue-ball centre on portrait screens
const CUE_TIP_RADIUS = (BALL_R / 0.0525) * 0.006 * 1.5;
const MAX_POWER_LIFT_HEIGHT = CUE_TIP_RADIUS * 9.6; // let full-power hops peak higher so max-strength jumps pop
const CUE_BUTT_LIFT = BALL_R * 0.52; // keep the butt elevated for clearance while keeping the tip level with the cue-ball centre
const CUE_LENGTH_MULTIPLIER = 1.35; // extend cue stick length so the rear section feels longer without moving the tip
const MAX_BACKSPIN_TILT = THREE.MathUtils.degToRad(6.25);
const CUE_FRONT_SECTION_RATIO = 0.28;
const CUE_OBSTRUCTION_CLEARANCE = BALL_R * 1.35;
const CUE_OBSTRUCTION_RANGE = BALL_R * 8;
const CUE_OBSTRUCTION_LIFT = BALL_R * 0.7;
const CUE_OBSTRUCTION_TILT = THREE.MathUtils.degToRad(8.5);
// Match the 2D aiming configuration for side spin while letting top/back spin reach the full cue-tip radius.
const MAX_SPIN_CONTACT_OFFSET = BALL_R * 0.85;
const MAX_SPIN_FORWARD = MAX_SPIN_CONTACT_OFFSET;
const MAX_SPIN_SIDE = BALL_R * 0.35;
const MAX_SPIN_VERTICAL = BALL_R * 0.6;
const MAX_SPIN_VISUAL_LIFT = BALL_R * 0.6; // cap vertical spin offsets so the cue stays just above the ball surface
const SPIN_RING_RATIO = THREE.MathUtils.clamp(SWERVE_THRESHOLD, 0, 1);
const SPIN_CLEARANCE_MARGIN = BALL_R * 0.4;
const SPIN_TIP_MARGIN = CUE_TIP_RADIUS * 1.6;
const SIDE_SPIN_MULTIPLIER = 1.25;
const BACKSPIN_MULTIPLIER = 1.7 * 1.25 * 1.5;
const TOPSPIN_MULTIPLIER = 1.3;
const CUE_CLEARANCE_PADDING = BALL_R * 0.05;
const SPIN_CONTROL_DIAMETER_PX = 96;
const SPIN_DOT_DIAMETER_PX = 10;
// angle for cushion cuts guiding balls into corner pockets (trimmed further to widen the entrance)
const DEFAULT_CUSHION_CUT_ANGLE = 32;
// middle pocket cushion cuts are sharpened to a 29° cut to align the side-rail cushions with the updated spec
const DEFAULT_SIDE_CUSHION_CUT_ANGLE = 34;
let CUSHION_CUT_ANGLE = DEFAULT_CUSHION_CUT_ANGLE;
let SIDE_CUSHION_CUT_ANGLE = DEFAULT_SIDE_CUSHION_CUT_ANGLE;
const CUSHION_BACK_TRIM = 0.8; // trim 20% off the cushion back that meets the rails
const CUSHION_FACE_INSET = SIDE_RAIL_INNER_THICKNESS * 0.12; // push the playable face and cushion nose further inward to match the expanded top surface

// shared UI reduction factor so overlays and controls shrink alongside the table

const CUE_WOOD_REPEAT = new THREE.Vector2(1, 5.5); // Mirror the cue butt wood repeat for table finishes
const CUE_WOOD_REPEAT_SCALE = 0.38; // enlarge cue grain 3x by reducing the repeat scale
const CUE_WOOD_TEXTURE_SIZE = 4096; // 4k cue textures for sharper cue wood finish
const TABLE_WOOD_REPEAT = new THREE.Vector2(0.08 / 3 * 0.7, 0.44 / 3 * 0.7); // enlarge grain 3× so rails, skirts, and legs read at table scale; push pattern larger for the new finish pass
const FIXED_WOOD_REPEAT_SCALE = 1; // restore the original per-texture scale without inflating the grain
const WOOD_REPEAT_SCALE_MIN = 0.5;
const WOOD_REPEAT_SCALE_MAX = 2;
const DEFAULT_WOOD_REPEAT_SCALE = FIXED_WOOD_REPEAT_SCALE;
const DEFAULT_POOL_VARIANT = 'american';
const UK_POOL_RED = 0xd12c2c;
const UK_POOL_YELLOW = 0xffd700;
const UK_POOL_BLACK = 0x000000;
const POOL_VARIANT_COLOR_SETS = Object.freeze({
  uk: {
    id: 'uk',
    label: '8-Ball UK',
    cueColor: 0xffffff,
    rackLayout: 'triangle',
    disableSnookerMarkings: true,
    objectColors: [
      UK_POOL_YELLOW,
      UK_POOL_YELLOW,
      UK_POOL_RED,
      UK_POOL_YELLOW,
      UK_POOL_BLACK,
      UK_POOL_RED,
      UK_POOL_RED,
      UK_POOL_YELLOW,
      UK_POOL_RED,
      UK_POOL_YELLOW,
      UK_POOL_RED,
      UK_POOL_YELLOW,
      UK_POOL_RED,
      UK_POOL_YELLOW,
      UK_POOL_RED
    ],
    objectNumbers: [
      null,
      null,
      null,
      null,
      8,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null
    ],
    objectPatterns: new Array(15).fill('solid')
  },
  american: {
    id: 'american',
    label: 'American 8-Ball',
    cueColor: 0xffffff,
    rackLayout: 'triangle',
    disableSnookerMarkings: true,
    objectColors: [
      0xffc52c,
      0x0a58ff,
      0xd32232,
      0x8f32d6,
      0xff7c1f,
      0x0faa60,
      0x651f28,
      0x111111,
      0xffc52c,
      0x0a58ff,
      0xd32232,
      0x8f32d6,
      0xff7c1f,
      0x0faa60,
      0x651f28
    ],
    objectNumbers: [
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      12,
      13,
      14,
      15
    ],
    objectPatterns: [
      'solid',
      'solid',
      'solid',
      'solid',
      'solid',
      'solid',
      'solid',
      'solid',
      'stripe',
      'stripe',
      'stripe',
      'stripe',
      'stripe',
      'stripe',
      'stripe'
    ]
  },
  '9ball': {
    id: '9ball',
    label: '9-Ball',
    cueColor: 0xffffff,
    rackLayout: 'diamond',
    disableSnookerMarkings: true,
    objectColors: [
      0xffc52c,
      0x0a58ff,
      0xd32232,
      0x8f32d6,
      0xff7c1f,
      0x0faa60,
      0x651f28,
      0x111111,
      0xffc52c
    ],
    objectNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    objectPatterns: [
      'solid',
      'solid',
      'solid',
      'solid',
      'solid',
      'solid',
      'solid',
      'solid',
      'stripe'
    ]
  }
});

function normalizeVariantKey(value) {
  if (typeof value !== 'string') return '';
  return value
    .toLowerCase()
    .replace(/[_\s-]+/g, '')
    .trim();
}

function normalizeBallSetKey(value) {
  const normalized = normalizeVariantKey(value);
  if (
    normalized === 'american' ||
    normalized === 'solidsstripes' ||
    normalized === 'solidsandstripes' ||
    normalized === 'solids' ||
    normalized === 'stripes'
  ) {
    return 'american';
  }
  if (normalized === 'uk' || normalized === 'redyellow') return 'uk';
  return normalized;
}

function resolvePoolVariant(variantId, ballSet = null) {
  const normalized = normalizeVariantKey(variantId);
  let key = normalized;
  if (normalized === '9' || normalized === 'nineball') {
    key = '9ball';
  } else if (
    normalized === '8balluk' ||
    normalized === 'eightballuk' ||
    normalized === '8pooluk' ||
    normalized === 'uk8'
  ) {
    key = 'uk';
  }
  const base =
    POOL_VARIANT_COLOR_SETS[key] || POOL_VARIANT_COLOR_SETS[DEFAULT_POOL_VARIANT];
  const ballSetKey = normalizeBallSetKey(ballSet);
  if (base.id === 'uk' && ballSetKey === 'american') {
    const american = POOL_VARIANT_COLOR_SETS.american;
    return {
      ...base,
      ballSet: 'american',
      objectColors: american.objectColors,
      objectNumbers: american.objectNumbers,
      objectPatterns: american.objectPatterns
    };
  }
  return base;
}

function deriveInHandFromFrame(frame) {
  const meta = frame && typeof frame === 'object' ? frame.meta : null;
  if (!meta || typeof meta !== 'object') return false;
  if (meta.variant === 'american' && meta.state) {
    return Boolean(meta.state.ballInHand);
  }
  if (meta.variant === '9ball' && meta.state) {
    return Boolean(meta.state.ballInHand);
  }
  if (meta.variant === 'uk' && meta.state) {
    return Boolean(meta.state.mustPlayFromBaulk);
  }
  return false;
}


function useResponsiveTableSize(option) {
  const [scale, setScale] = useState(() => option?.scale ?? 1);

  useEffect(() => {
    if (!option) {
      setScale(1);
      return;
    }
    const baseScale = option.scale ?? 1;
    const mobileScale = option.mobileScale ?? baseScale;
    const compactScale = option.compactScale ?? mobileScale;
    const updateScale = () => {
      if (typeof window === 'undefined') {
        setScale(baseScale);
        return;
      }
      const { innerWidth: width, innerHeight: height } = window;
      const isPortrait = height >= width;
      let next = baseScale;
      if (width <= 420 || height <= 720) {
        next = compactScale;
      } else if (width <= 1024 || isPortrait) {
        next = mobileScale;
      }
      setScale((prev) => (Math.abs(prev - next) > 1e-3 ? next : prev));
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    window.addEventListener('orientationchange', updateScale);
    return () => {
      window.removeEventListener('resize', updateScale);
      window.removeEventListener('orientationchange', updateScale);
    };
  }, [option]);

  return useMemo(() => {
    if (!option) {
      return { id: 'default', label: 'Default', baseScale: scale, scale };
    }
    return {
      ...option,
      baseScale: option.scale ?? 1,
      scale
    };
  }, [option, scale]);
}

function getPoolBallColor(variant, index) {
  const colors = variant?.objectColors || [];
  if (!colors.length) return 0xffffff;
  if (index < 0) return colors[0];
  const wrapped = index % colors.length;
  return colors[wrapped];
}

function getPoolBallNumber(variant, index) {
  const numbers = variant?.objectNumbers || [];
  if (!numbers.length || index < 0 || index >= numbers.length) {
    return null;
  }
  return numbers[index] ?? null;
}

function getPoolBallPattern(variant, index) {
  const patterns = variant?.objectPatterns || [];
  if (!patterns.length || index < 0 || index >= patterns.length) {
    return 'solid';
  }
  return patterns[index] || 'solid';
}

function getPoolBallId(variant, index) {
  if (!variant) return `ball_${index + 1}`;
  if (variant.id === 'uk') {
    if (variant.ballSet === 'american') {
      const pattern = getPoolBallPattern(variant, index);
      if (getPoolBallNumber(variant, index) === 8) return 'black_8';
      return pattern === 'stripe' ? `red_${index + 1}` : `yellow_${index + 1}`;
    }
    const color = getPoolBallColor(variant, index);
    if (color === UK_POOL_BLACK) return 'black_8';
    if (color === UK_POOL_YELLOW) return `yellow_${index + 1}`;
    return `red_${index + 1}`;
  }
  const number = getPoolBallNumber(variant, index);
  if (typeof number === 'number') {
    return `ball_${number}`;
  }
  return `ball_${index + 1}`;
}

function generateRackPositions(ballCount, layout, ballRadius, startZ) {
  const positions = [];
  if (ballCount <= 0 || !Number.isFinite(ballRadius) || !Number.isFinite(startZ)) {
    return positions;
  }
  const columnSpacing = ballRadius * 2 + 0.002 * (ballRadius / 0.0525);
  const rowSpacing = ballRadius * 1.9;
  if (layout === 'diamond') {
    const rows = [1, 2, 3, 2, 1];
    let index = 0;
    for (let r = 0; r < rows.length && index < ballCount; r++) {
      const count = rows[r];
      const centerOffset = (count - 1) / 2;
      for (let i = 0; i < count && index < ballCount; i++) {
        const x = (i - centerOffset) * columnSpacing;
        const z = startZ + r * rowSpacing;
        positions.push({ x, z });
        index++;
      }
    }
    return positions;
  }
  let row = 0;
  let placed = 0;
  while (placed < ballCount) {
    const count = row + 1;
    const centerOffset = row / 2;
    for (let i = 0; i < count && placed < ballCount; i++) {
      const x = (i - centerOffset) * columnSpacing;
      const z = startZ + row * rowSpacing;
      positions.push({ x, z });
      placed++;
    }
    row++;
  }
  return positions;
}

// Updated colors for dark cloth (ball colors overridden per variant at runtime)
const BASE_BALL_COLORS = Object.freeze({
  cue: 0xffffff,
  red: 0xd32232,
  yellow: 0xffc52c,
  green: 0x0a8f4b,
  brown: 0x7b451b,
  blue: 0x0a58ff,
  pink: 0xff7fc3,
  black: 0x111111
});
const CLOTH_TEXTURE_INTENSITY = 1.08;
const CLOTH_HAIR_INTENSITY = 0.78;
const CLOTH_BUMP_INTENSITY = 1.12;
const CLOTH_SOFT_BLEND = 0.42;

const CLOTH_QUALITY = (() => {
  const defaults = {
    textureSize: 4096,
    anisotropy: 72,
    generateMipmaps: true,
    bumpScaleMultiplier: 1.16,
    sheen: 0.95,
    sheenRoughness: 0.66
  };

  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      ...defaults,
      textureSize: 2048,
      anisotropy: 20,
      bumpScaleMultiplier: 1,
      sheen: 0.9,
      sheenRoughness: 0.72
    };
  }

  const dpr = window.devicePixelRatio ?? 1;
  const ua = navigator.userAgent ?? '';
  const maxTouchPoints = navigator.maxTouchPoints ?? 0;
  const isTouch = maxTouchPoints > 1;
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const deviceMemory = typeof navigator.deviceMemory === 'number' ? navigator.deviceMemory : null;
  const hardwareConcurrency = navigator.hardwareConcurrency ?? 4;
  const lowMemory = deviceMemory !== null && deviceMemory <= 4;
  const lowRefresh = detectLowRefreshDisplay();

  if (isMobileUA || isTouch || lowMemory || lowRefresh) {
    const highDensity = dpr >= 3;
    return {
      textureSize: highDensity ? 2048 : 1024,
      anisotropy: highDensity ? 22 : 18,
      generateMipmaps: true,
      bumpScaleMultiplier: highDensity ? 1.02 : 0.94,
      sheen: 0.78,
      sheenRoughness: 0.82
    };
  }

  if (hardwareConcurrency <= 6 || dpr < 1.75) {
    return {
      textureSize: 4096,
      anisotropy: 48,
      generateMipmaps: true,
      bumpScaleMultiplier: 1.12,
      sheen: 0.9,
      sheenRoughness: 0.7
    };
  }

  return defaults;
})();

const makeColorPalette = ({ cloth, rail, base, markings = 0xffffff, cushion }) => ({
  cloth,
  rail,
  base,
  cushion: cushion ?? cloth,
  markings,
  ...BASE_BALL_COLORS
});


const clampToUnit = (value) => Math.min(1, Math.max(0, value));

const mixHexColors = (fromHex, toHex, t) => {
  const amount = clampToUnit(typeof t === 'number' ? t : 0);
  const start = new THREE.Color(fromHex);
  const target = new THREE.Color(toHex);
  start.lerp(target, amount);
  return start.getHex();
};

const hexNumberToCss = (hex) => `#${hex.toString(16).padStart(6, '0')}`;


const SHARED_WOOD_REPEAT = Object.freeze({
  x: 1,
  y: 5.5
});
const SHARED_WOOD_SURFACE_PROPS = Object.freeze({
  roughnessBase: 0.18,
  roughnessVariance: 0.26,
  roughness: 0.62,
  metalness: 0.04,
  clearcoat: 0.18,
  clearcoatRoughness: 0.55,
  sheen: 0.06,
  sheenRoughness: 0.6,
  envMapIntensity: 0.4
});
const POLYHAVEN_WOOD_SURFACE_PROPS = Object.freeze({
  roughness: 0.68,
  metalness: 0,
  clearcoat: 0.08,
  clearcoatRoughness: 0.75,
  sheen: 0,
  sheenRoughness: 0.8,
  envMapIntensity: 0.32
});
const TABLE_FINISH_DULLING = Object.freeze({
  roughnessLift: 0.3,
  clearcoatScale: 0.4,
  clearcoatRoughnessLift: 0.36,
  envMapScale: 0.35,
  reflectivityScale: 0.5,
  sheenScale: 0.35,
  sheenRoughnessLift: 0.32
});
const TABLE_WOOD_VISIBILITY_TUNING = Object.freeze({
  roughnessMin: 0.45,
  metalnessMax: 0.2,
  clearcoatMax: 0.22,
  clearcoatRoughnessMin: 0.4,
  envMapIntensityMax: 0.35,
  normalScale: 0.5
});

const clampWoodRepeatScaleValue = (value = DEFAULT_WOOD_REPEAT_SCALE) => {
  const numeric = Number(value);
  const resolved = Number.isFinite(numeric) ? numeric : DEFAULT_WOOD_REPEAT_SCALE;
  return THREE.MathUtils.clamp(resolved, WOOD_REPEAT_SCALE_MIN, WOOD_REPEAT_SCALE_MAX);
};

function scaleWoodRepeatVector (repeatVec, scale) {
  const vec = repeatVec?.isVector2
    ? repeatVec.clone()
    : new THREE.Vector2(repeatVec?.x ?? 1, repeatVec?.y ?? 1)
  const divisor = scale <= 0 ? 1 : scale
  vec.x /= divisor
  vec.y /= divisor
  return vec
}

function applySharedWoodSurfaceProps(material) {
  if (!material) return;
  const mapUrl = material.userData?.__woodOptions?.mapUrl;
  const props = mapUrl && mapUrl.includes('polyhaven.org')
    ? POLYHAVEN_WOOD_SURFACE_PROPS
    : SHARED_WOOD_SURFACE_PROPS;
  if ('roughness' in material) {
    material.roughness = props.roughness;
  }
  if ('metalness' in material) {
    material.metalness = props.metalness;
  }
  if ('clearcoat' in material) {
    material.clearcoat = props.clearcoat;
  }
  if ('clearcoatRoughness' in material) {
    material.clearcoatRoughness = props.clearcoatRoughness;
  }
  if ('sheen' in material) {
    material.sheen = props.sheen;
  }
  if ('sheenRoughness' in material) {
    material.sheenRoughness = props.sheenRoughness;
  }
  if ('envMapIntensity' in material) {
    material.envMapIntensity = props.envMapIntensity;
  }
  material.needsUpdate = true;
}

function applyTableFinishDulling(material) {
  if (!material) return;
  const props = TABLE_FINISH_DULLING;
  if ('roughness' in material) {
    material.roughness = THREE.MathUtils.clamp(
      material.roughness + props.roughnessLift,
      0,
      1
    );
  }
  if ('clearcoat' in material) {
    material.clearcoat = THREE.MathUtils.clamp(
      material.clearcoat * props.clearcoatScale,
      0,
      1
    );
  }
  if ('clearcoatRoughness' in material) {
    material.clearcoatRoughness = THREE.MathUtils.clamp(
      material.clearcoatRoughness + props.clearcoatRoughnessLift,
      0,
      1
    );
  }
  if ('sheen' in material) {
    material.sheen = THREE.MathUtils.clamp(material.sheen * props.sheenScale, 0, 1);
  }
  if ('sheenRoughness' in material) {
    material.sheenRoughness = THREE.MathUtils.clamp(
      material.sheenRoughness + props.sheenRoughnessLift,
      0,
      1
    );
  }
  if ('envMapIntensity' in material) {
    material.envMapIntensity = Math.max(0, material.envMapIntensity * props.envMapScale);
  }
  if ('reflectivity' in material) {
    material.reflectivity = THREE.MathUtils.clamp(
      material.reflectivity * props.reflectivityScale,
      0,
      1
    );
  }
  material.needsUpdate = true;
}

function applyTableWoodVisibilityTuning(material) {
  if (!material) return;
  const props = TABLE_WOOD_VISIBILITY_TUNING;
  if ('roughness' in material) {
    material.roughness = Math.max(material.roughness ?? 0, props.roughnessMin);
  }
  if ('metalness' in material) {
    material.metalness = Math.min(material.metalness ?? 0, props.metalnessMax);
  }
  if ('clearcoat' in material) {
    material.clearcoat = Math.min(material.clearcoat ?? 0, props.clearcoatMax);
  }
  if ('clearcoatRoughness' in material) {
    material.clearcoatRoughness = Math.max(
      material.clearcoatRoughness ?? 0,
      props.clearcoatRoughnessMin
    );
  }
  if ('envMapIntensity' in material) {
    material.envMapIntensity = Math.min(
      material.envMapIntensity ?? 0,
      props.envMapIntensityMax
    );
  }
  if (material.normalMap) {
    material.normalScale = new THREE.Vector2(props.normalScale, props.normalScale);
  }
  material.needsUpdate = true;
}

const WOOD_PRESETS_BY_ID = Object.freeze(
  WOOD_FINISH_PRESETS.reduce((acc, preset) => {
    acc[preset.id] = preset;
    return acc;
  }, {})
);
const DEFAULT_WOOD_PRESET_ID = 'walnut';

// Pool Royale keeps wood grain textures enabled for the original table finishes.
const WOOD_TEXTURES_ENABLED = true;

const DEFAULT_TABLE_FINISH_ID =
  POOL_ROYALE_DEFAULT_UNLOCKS.tableFinish?.[0] ?? 'peelingPaintWeathered';

const POOL_ROYALE_WOOD_PRESET_FOR_FINISH = Object.freeze({});

const POOL_ROYALE_WOOD_REPEAT = Object.freeze({
  x: CUE_WOOD_REPEAT.x,
  y: CUE_WOOD_REPEAT.y
});

const POOL_ROYALE_WOOD_SURFACE_PROPS = Object.freeze({
  roughnessBase: 0.16,
  roughnessVariance: 0.22
});

const applySnookerStyleWoodPreset = (materials, finishId) => {
  if (!WOOD_TEXTURES_ENABLED) return;
  const presetId = POOL_ROYALE_WOOD_PRESET_FOR_FINISH[finishId];
  if (!presetId) return;
  const preset = WOOD_PRESETS_BY_ID[presetId];
  if (!preset) return;
  const options = {
    hue: preset.hue,
    sat: preset.sat,
    light: preset.light,
    contrast: preset.contrast,
    repeat: POOL_ROYALE_WOOD_REPEAT,
    sharedKey: `snooker-wood-${preset.id}`,
    ...POOL_ROYALE_WOOD_SURFACE_PROPS
  };
  const uniqueMaterials = new Set(
    [materials.frame, materials.rail, materials.leg].filter(Boolean)
  );
  uniqueMaterials.forEach((material) => {
    applyWoodTextures(material, options);
  });
};

const pocketLeatherTextureCache = new Map();
const pocketLeatherConsumers = new Map();

const registerPocketLeatherConsumer = (textureId, materials = []) => {
  if (!textureId) return;
  let set = pocketLeatherConsumers.get(textureId);
  if (!set) {
    set = new Set();
    pocketLeatherConsumers.set(textureId, set);
  }
  materials.forEach((material) => {
    if (material) {
      set.add(material);
    }
  });
};

const broadcastPocketLeatherTextures = (textureId) => {
  if (!textureId) return;
  const textures = pocketLeatherTextureCache.get(textureId);
  if (!textures) return;
  const consumers = pocketLeatherConsumers.get(textureId);
  if (!consumers?.size) return;
  consumers.forEach((material) => {
    if (!material) return;
    material.map = textures.map ?? null;
    material.normalMap = textures.normal ?? null;
    material.roughnessMap = textures.roughness ?? null;
    applyPocketLeatherTextureDefaults(material.map, { isColor: true });
    applyPocketLeatherTextureDefaults(material.normalMap);
    applyPocketLeatherTextureDefaults(material.roughnessMap);
    material.needsUpdate = true;
  });
};

const applyPocketLeatherTextureDefaults = (
  texture,
  { isColor = false, repeat = POCKET_LEATHER_TEXTURE_REPEAT } = {}
) => {
  if (!texture) return texture;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  const repeatX = repeat?.x ?? POCKET_LEATHER_TEXTURE_REPEAT.x;
  const repeatY = repeat?.y ?? POCKET_LEATHER_TEXTURE_REPEAT.y;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = resolveTextureAnisotropy(POCKET_LEATHER_TEXTURE_ANISOTROPY);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  if (isColor) {
    applySRGBColorSpace(texture);
  }
  texture.needsUpdate = true;
  return texture;
};

const ensurePocketLeatherTextures = (textureId = POCKET_LEATHER_TEXTURE_ID) => {
  const normalizedId = `${textureId || POCKET_LEATHER_TEXTURE_ID}`.trim();
  if (!pocketLeatherTextureCache.has(normalizedId)) {
    pocketLeatherTextureCache.set(normalizedId, {
      map: null,
      normal: null,
      roughness: null,
      loading: false,
      ready: false
    });
  }
  const cacheEntry = pocketLeatherTextureCache.get(normalizedId);
  if (cacheEntry.loading || cacheEntry.ready) {
    return cacheEntry;
  }
  cacheEntry.loading = true;
  if (typeof window === 'undefined') {
    cacheEntry.loading = false;
    return cacheEntry;
  }
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');
  const loadTextures = (urls) => {
    const map = urls.diffuse
      ? loader.load(
        urls.diffuse,
        (texture) => applyPocketLeatherTextureDefaults(texture, { isColor: true })
      )
      : null;
    const normal = urls.normal
      ? loader.load(
        urls.normal,
        (texture) => applyPocketLeatherTextureDefaults(texture)
      )
      : null;
    const roughness = urls.roughness
      ? loader.load(
        urls.roughness,
        (texture) => applyPocketLeatherTextureDefaults(texture)
      )
      : null;
    cacheEntry.map = map ? applyPocketLeatherTextureDefaults(map, { isColor: true }) : null;
    cacheEntry.normal = normal ? applyPocketLeatherTextureDefaults(normal) : null;
    cacheEntry.roughness = roughness ? applyPocketLeatherTextureDefaults(roughness) : null;
    cacheEntry.ready = true;
    cacheEntry.loading = false;
    broadcastPocketLeatherTextures(normalizedId);
  };
  const fallback4k = buildPolyHavenTextureUrls(normalizedId, '4k');
  const fallbackUrls = {
    diffuse: fallback4k?.diffuse ?? null,
    normal: fallback4k?.normal ?? null,
    roughness: fallback4k?.roughness ?? null
  };
  if (typeof fetch !== 'function') {
    loadTextures(fallbackUrls);
    return cacheEntry;
  }
  fetch(`https://api.polyhaven.com/files/${encodeURIComponent(normalizedId)}`)
    .then((response) => (response?.ok ? response.json() : null))
    .then((json) => {
      const urls = json ? pickPolyHavenTextureUrlsAtResolution(json, '4k') : {};
      loadTextures({
        diffuse: urls.diffuse ?? fallbackUrls.diffuse,
        normal: urls.normal ?? fallbackUrls.normal,
        roughness: urls.roughness ?? fallbackUrls.roughness
      });
    })
    .catch(() => {
      loadTextures(fallbackUrls);
    });
  return cacheEntry;
};

const createPocketMaterials = () => {
  const { jawMaterial, rimMaterial } = createPocketLinerMaterials(
    POCKET_LINER_OPTIONS[0] ?? null
  );
  return { pocketJaw: jawMaterial, pocketRim: rimMaterial };
};

const createStandardWoodFinish = ({
  id,
  label,
  cloth = 0x2d7f4b,
  rail,
  base,
  trim,
  accent,
  woodTextureId,
  woodRepeatScale
}) => ({
  id,
  label,
  colors: makeColorPalette({
    cloth,
    rail,
    base
  }),
  woodTextureId,
  woodRepeatScale,
  createMaterials: () => {
    const frameColor = new THREE.Color(base);
    const railColor = new THREE.Color(rail);
    const trimColor =
      trim != null
        ? new THREE.Color(trim)
        : railColor.clone().offsetHSL(0.02, 0.08, 0.18);
    const frame = new THREE.MeshPhysicalMaterial({
      color: frameColor,
      metalness: 0.1,
      roughness: 0.52,
      clearcoat: 0.28,
      clearcoatRoughness: 0.34,
      sheen: 0.16,
      sheenRoughness: 0.52,
      reflectivity: 0.26,
      envMapIntensity: 0.52
    });
    const railMat = new THREE.MeshPhysicalMaterial({
      color: railColor,
      metalness: 0.12,
      roughness: 0.48,
      clearcoat: 0.32,
      clearcoatRoughness: 0.32,
      sheen: 0.2,
      sheenRoughness: 0.52,
      reflectivity: 0.28,
      envMapIntensity: 0.56
    });
    const trimMat = new THREE.MeshPhysicalMaterial({
      color: trimColor,
      metalness: 0.18,
      roughness: 0.44,
      clearcoat: 0.34,
      clearcoatRoughness: 0.3,
      envMapIntensity: 0.6
    });
    const materials = {
      frame,
      rail: railMat,
      leg: frame,
      trim: trimMat,
      accent: null
    };
    if (accent != null) {
      materials.accent = new THREE.MeshPhysicalMaterial({
        color: accent,
        metalness: 0.32,
        roughness: 0.48,
        clearcoat: 0.22,
        clearcoatRoughness: 0.32,
        envMapIntensity: 0.72
      });
    }
    applySnookerStyleWoodPreset(materials, id);
    return { ...materials, ...createPocketMaterials() };
  }
});

const TABLE_FINISHES = Object.freeze({
  peelingPaintWeathered: createStandardWoodFinish({
    id: 'peelingPaintWeathered',
    label: 'Wood Peeling Paint Weathered',
    rail: 0xb8b3aa,
    base: 0xa89f95,
    trim: 0xd6d0c7,
    woodTextureId: 'wood_peeling_paint_weathered',
    woodRepeatScale: 1
  }),
  oakVeneer01: createStandardWoodFinish({
    id: 'oakVeneer01',
    label: 'Oak Veneer 01',
    rail: 0xc89a64,
    base: 0xb9854e,
    trim: 0xe0bb7a,
    woodTextureId: 'oak_veneer_01',
    woodRepeatScale: 1
  }),
  woodTable001: createStandardWoodFinish({
    id: 'woodTable001',
    label: 'Wood Table 001',
    rail: 0xa4724f,
    base: 0x8f6243,
    trim: 0xc89a64,
    woodTextureId: 'wood_table_001',
    woodRepeatScale: 1
  }),
  darkWood: createStandardWoodFinish({
    id: 'darkWood',
    label: 'Dark Wood',
    rail: 0x3d2f2a,
    base: 0x2f241f,
    trim: 0x6a5a52,
    woodTextureId: 'dark_wood',
    woodRepeatScale: 1
  }),
  rosewoodVeneer01: createStandardWoodFinish({
    id: 'rosewoodVeneer01',
    label: 'Rosewood Veneer 01',
    rail: 0x6f3a2f,
    base: 0x5b2f26,
    trim: 0x9b5a44,
    woodTextureId: 'rosewood_veneer_01',
    woodRepeatScale: 1
  })
});

const TABLE_FINISH_OPTIONS = Object.freeze(
  [
    TABLE_FINISHES.peelingPaintWeathered,
    TABLE_FINISHES.oakVeneer01,
    TABLE_FINISHES.woodTable001,
    TABLE_FINISHES.darkWood,
    TABLE_FINISHES.rosewoodVeneer01
  ].filter(Boolean)
);

const CUE_FINISH_OPTIONS = TABLE_FINISH_OPTIONS;
const CUE_FINISH_PALETTE = Object.freeze(
  CUE_FINISH_OPTIONS.map(
    (finish) => finish?.colors?.rail ?? finish?.colors?.base ?? 0xdeb887
  )
);
const DEFAULT_CUE_STYLE_ID =
  POOL_ROYALE_DEFAULT_UNLOCKS.tableFinish?.[0] ??
  POOL_ROYALE_DEFAULT_UNLOCKS.cueStyle?.[0] ??
  DEFAULT_TABLE_FINISH_ID;
const DEFAULT_CUE_STYLE_INDEX = Math.max(
  CUE_FINISH_OPTIONS.findIndex((finish) => finish.id === DEFAULT_CUE_STYLE_ID),
  0
);

const CHESS_BATTLE_DEFAULT_SET_URLS = Object.freeze([
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/ABeautifulGame/glTF/ABeautifulGame.gltf',
  'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/ABeautifulGame/glTF/ABeautifulGame.gltf',
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/ABeautifulGame/glTF/ABeautifulGame.gltf',
  'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/ABeautifulGame/glTF/ABeautifulGame.gltf'
]);

const DEFAULT_CHROME_COLOR_ID =
  POOL_ROYALE_DEFAULT_UNLOCKS.chromeColor?.[0] ?? 'gold';
const CHROME_COLOR_OPTIONS = Object.freeze([
  {
    id: 'chrome',
    label: 'Chrome',
    color: 0xd6d8dc,
    metalness: 0.95,
    roughness: 0.12,
    clearcoat: 0.5,
    clearcoatRoughness: 0.06,
    envMapIntensity: 0.72
  },
  {
    id: 'gold',
    label: 'Gold',
    color: 0xd4af37,
    metalness: 0.92,
    roughness: 0.16,
    clearcoat: 0.5,
    clearcoatRoughness: 0.06,
    envMapIntensity: 0.72
  }
]);

// Palettes derived from CC0 textile scans (ambientCG FabricWool series) and
// popular tournament felts so every option mirrors a real pool cloth.
const BASE_CLOTH_DETAIL = Object.freeze({
  bumpMultiplier: 1.18,
  sheen: 0.62,
  sheenRoughness: 0.46,
  emissiveIntensity: 0.32,
  envMapIntensity: 0.18
});

const makeClothDetail = (overrides = {}) => ({
  ...BASE_CLOTH_DETAIL,
  ...overrides
});

// Cloth library powered by curated presets defined in poolRoyaleClothPresets.
const CLOTH_LIBRARY = Object.freeze(
  POOL_ROYALE_CLOTH_VARIANTS.map((variant) =>
    Object.freeze({
      id: variant.id,
      label: variant.name,
      sourceId: variant.sourceId,
      palette: variant.palette,
      color: variant.baseColor,
      sparkle: variant.sparkle,
      stray: variant.stray,
      detail: makeClothDetail(variant.detail || {})
    })
  )
);

const CLOTH_TEXTURE_PRESETS = Object.freeze(
  CLOTH_LIBRARY.reduce((acc, cloth) => {
    acc[cloth.id] = Object.freeze({
      id: cloth.id,
      palette: cloth.palette,
      sparkle: cloth.sparkle,
      stray: cloth.stray,
      sourceId: cloth.sourceId
    });
    return acc;
  }, {})
);

const DEFAULT_CLOTH_TEXTURE_KEY =
  POOL_ROYALE_DEFAULT_UNLOCKS.clothColor?.[0] ?? CLOTH_LIBRARY[0].id;
const DEFAULT_CLOTH_COLOR_ID = DEFAULT_CLOTH_TEXTURE_KEY;
const CLOTH_COLOR_OPTIONS = Object.freeze(
  CLOTH_LIBRARY.map((cloth) => ({
    id: cloth.id,
    label: cloth.label,
    color: cloth.color,
    textureKey: cloth.id,
    detail: cloth.detail,
    sourceId: cloth.sourceId
  }))
);

const DEFAULT_RAIL_MARKER_SHAPE = 'diamond';
const RAIL_MARKER_SHAPE_OPTIONS = Object.freeze([
  { id: 'diamond', label: 'Diamonds' },
  { id: 'circle', label: 'Circles' }
]);
const RAIL_MARKER_THICKNESS = TABLE.THICK * 0.06;

const DEFAULT_RAIL_MARKER_COLOR_ID =
  POOL_ROYALE_DEFAULT_UNLOCKS.railMarkerColor?.[0] ?? 'gold';
const RAIL_MARKER_COLOR_OPTIONS = Object.freeze([
  {
    id: 'chrome',
    label: 'Chrome',
    color: 0xd2d8e2,
    metalness: 0.9,
    roughness: 0.22,
    clearcoat: 0.6,
    clearcoatRoughness: 0.18
  },
  {
    id: 'pearl',
    label: 'Pearl',
    color: 0xf3ede3,
    metalness: 0.42,
    roughness: 0.2,
    clearcoat: 0.64,
    clearcoatRoughness: 0.12,
    sheen: 0.28,
    sheenRoughness: 0.42
  },
  {
    id: 'gold',
    label: 'Gold',
    color: 0xd4af37,
    metalness: 0.88,
    roughness: 0.26,
    clearcoat: 0.58,
    clearcoatRoughness: 0.18,
    sheen: 0.32,
    sheenRoughness: 0.4
  }
]);

const resolveRailMarkerColorOption = (id) =>
  RAIL_MARKER_COLOR_OPTIONS.find((opt) => opt.id === id) ??
  RAIL_MARKER_COLOR_OPTIONS.find((opt) => opt.id === DEFAULT_RAIL_MARKER_COLOR_ID) ??
  RAIL_MARKER_COLOR_OPTIONS[0];

const DEFAULT_LIGHTING_ID = 'arena-prime';
const LIGHTING_STORAGE_KEY = 'poolLightingPreset';
const LIGHTING_OPTIONS = Object.freeze([
  {
    id: 'studio-soft',
    label: 'Studio Soft',
    description: 'Gentle TV studio fill with reduced contrast for practice.',
    settings: {
      keyColor: 0xf5f7fb,
      keyIntensity: 1,
      fillColor: 0xf5f7fb,
      fillIntensity: 0.56,
      washColor: 0xf8faff,
      washIntensity: 0.5,
      rimColor: 0xfafcff,
      rimIntensity: 0.38,
      ambientIntensity: 0.14
    }
  },
  {
    id: 'arena-prime',
    label: 'Arena Prime',
    description: 'Tour stadium key with crisp specular pickup.',
    settings: {
      keyColor: 0xf6f8ff,
      keyIntensity: 1.28,
      fillColor: 0xf6f8ff,
      fillIntensity: 0.62,
      washColor: 0xf8faff,
      washIntensity: 0.54,
      rimColor: 0xffffff,
      rimIntensity: 0.42,
      ambientIntensity: 0.15
    }
  },
  {
    id: 'proscenium-contrast',
    label: 'Proscenium Contrast',
    description: 'High-contrast stage look with tight rim control.',
    settings: {
      keyColor: 0xf2f5ff,
      keyIntensity: 1.32,
      fillColor: 0xf2f5ff,
      fillIntensity: 0.48,
      washColor: 0xf5f8ff,
      washIntensity: 0.58,
      rimColor: 0xf7fbff,
      rimIntensity: 0.56,
      ambientIntensity: 0.12
    }
  },
  {
    id: 'noir-telecast',
    label: 'Noir Telecast',
    description: 'Cool broadcast grade with soft rim and wider beam.',
    settings: {
      keyColor: 0xeaf1ff,
      keyIntensity: 1.12,
      fillColor: 0xeaf1ff,
      fillIntensity: 0.6,
      washColor: 0xf0f5ff,
      washIntensity: 0.52,
      rimColor: 0xf5f8ff,
      rimIntensity: 0.36,
      ambientIntensity: 0.13
    }
  }
]);
const LIGHTING_PRESET_MAP = Object.freeze(
  LIGHTING_OPTIONS.reduce((acc, preset) => {
    acc[preset.id] = preset;
    return acc;
  }, {})
);

const FRAME_RATE_STORAGE_KEY = 'snookerFrameRate';
const FRAME_RATE_OPTIONS = Object.freeze([
  {
    id: 'hd50',
    label: 'HD Performance (50 Hz)',
    fps: 50,
    renderScale: 1,
    pixelRatioCap: 1.35,
    resolution: 'HD render • DPR 1.35 cap',
    description: 'Low-power 50 Hz profile for battery saver and thermal relief.'
  },
  {
    id: 'fhd90',
    label: 'Full HD (90 Hz)',
    fps: 90,
    renderScale: 1.12,
    pixelRatioCap: 1.55,
    resolution: 'Full HD render • DPR 1.55 cap',
    description: '1080p-focused profile tuned for 90 Hz full-motion play.'
  },
  {
    id: 'qhd90',
    label: 'Quad HD (105 Hz)',
    fps: 105,
    renderScale: 1.22,
    pixelRatioCap: 1.72,
    resolution: 'QHD render • DPR 1.72 cap',
    description: 'Sharper 1440p render for capable 105 Hz mobile and desktop GPUs.'
  },
  {
    id: 'uhd120',
    label: 'Ultra HD (120 Hz cap)',
    fps: 120,
    renderScale: 1.28,
    pixelRatioCap: 1.85,
    resolution: 'Ultra HD render • DPR 1.85 cap',
    description: '4K-oriented profile tuned for smooth play up to 120 Hz.'
  }
]);
const DEFAULT_FRAME_RATE_ID = 'fhd90';

const BROADCAST_SYSTEM_STORAGE_KEY = 'poolBroadcastSystem';
const BROADCAST_SYSTEM_OPTIONS = Object.freeze([
  {
    id: 'rail-overhead',
    label: 'Rail Overhead',
    description:
      'Short-rail broadcast heads mounted above the table for the true TV feed.',
    method: 'Overhead rail mounts with fast post-shot cuts.',
    orbitBias: 0.68,
    railPush: BALL_R * 6,
    lateralDolly: BALL_R * 0.6,
    focusLift: BALL_R * 5.4,
    focusDepthBias: -BALL_R * 0.6,
    focusPan: 0,
    trackingBias: 0.52,
    smoothing: 0.14,
    avoidPocketCameras: false,
    forceActionActivation: true
  }
]);
const DEFAULT_BROADCAST_SYSTEM_ID = 'rail-overhead';
const resolveBroadcastSystem = (id) =>
  BROADCAST_SYSTEM_OPTIONS.find((opt) => opt.id === id) ??
  BROADCAST_SYSTEM_OPTIONS.find((opt) => opt.id === DEFAULT_BROADCAST_SYSTEM_ID) ??
  BROADCAST_SYSTEM_OPTIONS[0];

const POCKET_LINER_PRESETS = Object.freeze([
  Object.freeze({
    id: 'fabric_leather_02',
    label: 'Fabric Leather 02',
    textureId: 'fabric_leather_02'
  }),
  Object.freeze({
    id: 'fabric_leather_01',
    label: 'Fabric Leather 01',
    textureId: 'fabric_leather_01'
  }),
  Object.freeze({
    id: 'brown_leather',
    label: 'Brown Leather',
    textureId: 'brown_leather'
  }),
  Object.freeze({
    id: 'leather_red_02',
    label: 'Leather Red 02',
    textureId: 'leather_red_02'
  }),
  Object.freeze({
    id: 'leather_red_03',
    label: 'Leather Red 03',
    textureId: 'leather_red_03'
  }),
  Object.freeze({
    id: 'leather_white',
    label: 'Leather White',
    textureId: 'leather_white'
  })
]);

const DEFAULT_POCKET_LINER_OPTION_ID =
  POCKET_LINER_PRESETS.find((preset) => preset.id === 'fabric_leather_02')?.id ??
  POCKET_LINER_PRESETS[0]?.id ??
  'fabric_leather_02';

const POCKET_LINER_OPTIONS = Object.freeze(
  POCKET_LINER_PRESETS.map((config) =>
    Object.freeze({
      id: config.id,
      label: `${config.label} Pocket Jaws`,
      textureId: config.textureId ?? config.id,
      roughness: 0.86,
      metalness: 0.04,
      clearcoat: 0.14,
      clearcoatRoughness: 0.6,
      sheen: 0.42,
      sheenRoughness: 0.5,
      envMapIntensity: 0.32
    })
  )
);

function createPocketLinerMaterials(option) {
  const selection = option ?? POCKET_LINER_OPTIONS[0];
  const textureId = selection?.textureId ?? POCKET_LEATHER_TEXTURE_ID;
  const textures = ensurePocketLeatherTextures(textureId);
  const baseColor = new THREE.Color(0xffffff);
  const jawMaterial = new THREE.MeshPhysicalMaterial({
    color: baseColor,
    roughness: selection.roughness ?? 0.86,
    metalness: selection.metalness ?? 0.04,
    clearcoat: selection.clearcoat ?? 0.14,
    clearcoatRoughness: selection.clearcoatRoughness ?? 0.6,
    sheen: selection.sheen ?? 0.42,
    sheenRoughness: selection.sheenRoughness ?? 0.5,
    sheenColor: baseColor.clone(),
    envMapIntensity: selection.envMapIntensity ?? 0.32,
    map: textures.map ?? null,
    normalMap: textures.normal ?? null,
    roughnessMap: textures.roughness ?? null
  });
  const rimMaterial = jawMaterial.clone();
  rimMaterial.roughness = Math.min(1, (jawMaterial.roughness ?? 0.86) + 0.06);
  rimMaterial.clearcoat = Math.min(0.2, (jawMaterial.clearcoat ?? 0.14) * 0.8);
  rimMaterial.clearcoatRoughness = Math.min(
    1,
    (jawMaterial.clearcoatRoughness ?? 0.6) + 0.08
  );
  rimMaterial.sheen = Math.max(0.24, (jawMaterial.sheen ?? 0.42) * 0.7);
  rimMaterial.emissive = baseColor.clone().multiplyScalar(0.04);
  applyPocketLeatherTextureDefaults(jawMaterial.map, { isColor: true });
  applyPocketLeatherTextureDefaults(jawMaterial.normalMap);
  applyPocketLeatherTextureDefaults(jawMaterial.roughnessMap);
  applyPocketLeatherTextureDefaults(rimMaterial.map, { isColor: true });
  applyPocketLeatherTextureDefaults(rimMaterial.normalMap);
  applyPocketLeatherTextureDefaults(rimMaterial.roughnessMap);
  registerPocketLeatherConsumer(textureId, [jawMaterial, rimMaterial]);
  jawMaterial.needsUpdate = true;
  rimMaterial.needsUpdate = true;
  return { jawMaterial, rimMaterial };
}

const toHexColor = (value) => {
  if (typeof value === 'number') {
    return `#${value.toString(16).padStart(6, '0')}`;
  }
  return value ?? '#ffffff';
};

const ORIGINAL_RAIL_WIDTH = TABLE.WALL * 0.7;
const ORIGINAL_FRAME_WIDTH = ORIGINAL_RAIL_WIDTH * 2.5;
const ORIGINAL_PLAY_H = TABLE.H - 2 * TABLE.WALL;
const ORIGINAL_HALF_H = ORIGINAL_PLAY_H / 2;
const ORIGINAL_OUTER_HALF_H =
  ORIGINAL_HALF_H + ORIGINAL_RAIL_WIDTH * 2 + ORIGINAL_FRAME_WIDTH;

const CLOTH_TEXTURE_SIZE = CLOTH_QUALITY.textureSize;
const CLOTH_THREAD_PITCH = 12 * 1.48; // slightly denser thread spacing for a sharper weave
const CLOTH_THREADS_PER_TILE = CLOTH_TEXTURE_SIZE / CLOTH_THREAD_PITCH;
const CLOTH_PATTERN_SCALE = 0.76; // tighten the pattern footprint so the scan resolves more clearly
const CLOTH_TEXTURE_REPEAT_HINT = 1.52;
const POLYHAVEN_PATTERN_REPEAT_SCALE = 1 / 3;
const POLYHAVEN_ANISOTROPY_BOOST = 2.6;
const CLOTH_NORMAL_SCALE = new THREE.Vector2(1.55, 0.72);
const CLOTH_ROUGHNESS_BASE = 0.82;
const CLOTH_ROUGHNESS_TARGET = 0.78;
const CLOTH_BRIGHTNESS_LERP = 0.05;
const CLOTH_PATTERN_OVERRIDES = Object.freeze({
  polar_fleece: { repeatScale: 0.94 }, // 10% larger pattern to emphasize the fleece nap
  terry_cloth: { repeatScale: 3 } // counter Polyhaven repeat scale so terry cloth matches the standard thread density
});

const CLOTH_TEXTURE_KEYS_BY_SOURCE = CLOTH_LIBRARY.reduce((acc, cloth) => {
  if (!cloth?.sourceId) return acc;
  if (!acc[cloth.sourceId]) {
    acc[cloth.sourceId] = new Set();
  }
  acc[cloth.sourceId].add(cloth.id);
  return acc;
}, {});

const CLOTH_TEXTURE_CONSUMERS = new Map();
const CLOTH_CONSUMER_KEYS = new Map();

const resolveClothPatternOverride = (textureKey) => {
  const preset =
    CLOTH_TEXTURE_PRESETS[textureKey] ?? CLOTH_TEXTURE_PRESETS[DEFAULT_CLOTH_TEXTURE_KEY];
  const sourceKey = preset?.sourceId || preset?.id;
  return (
    (sourceKey && CLOTH_PATTERN_OVERRIDES[sourceKey]) ||
    CLOTH_PATTERN_OVERRIDES[textureKey] ||
    null
  );
};

function registerClothTextureConsumer(textureKey, finishInfo) {
  if (!textureKey || !finishInfo) return;
  const previousKey = CLOTH_CONSUMER_KEYS.get(finishInfo);
  if (previousKey && previousKey !== textureKey) {
    const prevSet = CLOTH_TEXTURE_CONSUMERS.get(previousKey);
    if (prevSet) {
      prevSet.delete(finishInfo);
      if (!prevSet.size) {
        CLOTH_TEXTURE_CONSUMERS.delete(previousKey);
      }
    }
  }
  let set = CLOTH_TEXTURE_CONSUMERS.get(textureKey);
  if (!set) {
    set = new Set();
    CLOTH_TEXTURE_CONSUMERS.set(textureKey, set);
  }
  set.add(finishInfo);
  CLOTH_CONSUMER_KEYS.set(finishInfo, textureKey);
}

function broadcastClothTextureReady(sourceId) {
  if (!sourceId) return;
  const textureKeys = CLOTH_TEXTURE_KEYS_BY_SOURCE[sourceId];
  if (!textureKeys) return;
  textureKeys.forEach((textureKey) => {
    const consumers = CLOTH_TEXTURE_CONSUMERS.get(textureKey);
    if (!consumers?.size) return;
    consumers.forEach((finishInfo) => updateClothTexturesForFinish(finishInfo, textureKey));
  });
}

const buildPolyHavenTextureUrls = (sourceId, resolution) => {
  if (!sourceId) return null;
  const normalized = String(sourceId).replace(/\s+/g, '_');
  const res = resolution.toUpperCase();
  const base = `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/${resolution}/${normalized}/${normalized}_${res}`;
  return {
    diffuse: `${base}_Color.jpg`,
    normal: `${base}_NormalGL.jpg`,
    roughness: `${base}_Roughness.jpg`
  };
};

const collectPolyHavenUrls = (apiJson) => {
  const urls = [];
  const walk = (v) => {
    if (!v) return;
    if (typeof v === 'string') {
      const lower = v.toLowerCase();
      if (
        v.startsWith('http') &&
        (lower.includes('.jpg') || lower.includes('.jpeg') || lower.includes('.png'))
      ) {
        urls.push(v);
      }
      return;
    }
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    if (typeof v === 'object') {
      Object.values(v).forEach(walk);
    }
  };
  walk(apiJson);
  return urls;
};

const pickPolyHavenTextureUrlsFromList = (urls) => {
  const scoreAndPick = (keywords) => {
    const scored = urls
      .filter((u) => keywords.some((kw) => u.toLowerCase().includes(kw)))
      .map((u) => {
        const lower = u.toLowerCase();
        let score = 0;
        if (lower.includes('4k')) score += 8;
        if (lower.includes('2k')) score += 6;
        if (lower.includes('1k')) score += 4;
        if (lower.includes('jpg')) score += 3;
        if (lower.includes('png')) score += 2;
        if (lower.includes('diff') || lower.includes('albedo') || lower.includes('basecolor')) score += 2;
        if (lower.includes('nor_gl') || lower.includes('normal_gl')) score += 2;
        if (lower.includes('nor') || lower.includes('normal')) score += 1;
        if (lower.includes('rough')) score += 1;
        if (lower.includes('preview')) score -= 6;
        return { url: u, score };
      })
      .sort((a, b) => b.score - a.score);
    return scored[0]?.url ?? null;
  };
  return {
    diffuse: scoreAndPick(['diff', 'diffuse', 'albedo', 'basecolor']),
    normal: scoreAndPick(['nor_gl', 'normal_gl', 'nor', 'normal']),
    roughness: scoreAndPick(['rough', 'roughness'])
  };
};

const pickPolyHavenTextureUrls = (apiJson) =>
  pickPolyHavenTextureUrlsFromList(collectPolyHavenUrls(apiJson));

const pickPolyHavenTextureUrlsAtResolution = (apiJson, resolution) => {
  const target = String(resolution || '').toLowerCase();
  if (!target) return pickPolyHavenTextureUrls(apiJson);
  const urls = collectPolyHavenUrls(apiJson).filter((url) => {
    const lower = url.toLowerCase();
    return lower.includes(`/${target}/`) || lower.includes(`_${target}`);
  });
  return pickPolyHavenTextureUrlsFromList(urls);
};

const upgradePolyHavenTextureUrlTo4k = (url) => {
  if (typeof url !== 'string' || url.length === 0) return url;
  if (!url.includes('/2k/') && !url.includes('_2k')) return url;
  return url.replace('/2k/', '/4k/').replace(/_2k(\.\w+)$/, '_4k$1');
};

const createClothTextures = (() => {
  const cache = new Map();
  const pendingLoads = new Map();
  const clamp255 = (value) => Math.max(0, Math.min(255, value));
  const cloneTexture = (texture) => {
    if (!texture) return null;
    const clone = texture.clone();
    clone.image = texture.image;
    clone.needsUpdate = true;
    return clone;
  };
  const toRgb = (hex) => {
    const color = new THREE.Color(hex ?? 0xffffff);
    return {
      r: Math.round(color.r * 255),
      g: Math.round(color.g * 255),
      b: Math.round(color.b * 255)
    };
  };

  const loadTexture = (loader, url, isColor) =>
    new Promise((resolve, reject) => {
      if (!url) {
        resolve(null);
        return;
      }
      loader.load(
        url,
        (texture) => {
          if (isColor) {
            applySRGBColorSpace(texture);
          }
          resolve(texture);
        },
        undefined,
        (err) => reject(err || new Error('Texture load failed'))
      );
    });

  const loadTextureWithFallbacks = async (loader, urls, isColor) => {
    for (const url of urls) {
      try {
        const texture = await loadTexture(loader, url, isColor);
        if (texture) return texture;
      } catch (error) {
        continue;
      }
    }
    return null;
  };

  const applyTextureDefaults = (texture, { isPolyHaven = false } = {}) => {
    if (!texture) return;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(CLOTH_TEXTURE_REPEAT_HINT, CLOTH_TEXTURE_REPEAT_HINT);
    const anisotropyBoost = isPolyHaven ? POLYHAVEN_ANISOTROPY_BOOST : 1;
    const requestedAnisotropy = CLOTH_QUALITY.anisotropy * anisotropyBoost;
    texture.anisotropy = resolveTextureAnisotropy(requestedAnisotropy);
    texture.generateMipmaps = CLOTH_QUALITY.generateMipmaps;
    texture.minFilter = CLOTH_QUALITY.generateMipmaps
      ? THREE.LinearMipmapLinearFilter
      : THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.userData = {
      ...(texture.userData || {}),
      clothSource: isPolyHaven ? 'polyhaven' : 'procedural'
    };
    texture.needsUpdate = true;
  };

  const neutralizePolyHavenColorMap = (texture) => {
    if (!texture || !texture.image || typeof document === 'undefined') return texture;
    const image = texture.image;
    const width = image.naturalWidth || image.videoWidth || image.width;
    const height = image.naturalHeight || image.videoHeight || image.height;
    if (!width || !height) return texture;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return texture;
    try {
      ctx.drawImage(image, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const luminance = Math.round(r * 0.2126 + g * 0.7152 + b * 0.0722);
        data[i] = luminance;
        data[i + 1] = luminance;
        data[i + 2] = luminance;
      }
      ctx.putImageData(imageData, 0, 0);
      texture.dispose();
      const neutralTexture = new THREE.CanvasTexture(canvas);
      applySRGBColorSpace(neutralTexture);
      return neutralTexture;
    } catch (err) {
      return texture;
    }
  };

  const generateProceduralClothTextures = (preset) => {
    if (typeof document === 'undefined') {
      return { map: null, bump: null };
    }
    const SIZE = CLOTH_TEXTURE_SIZE;
    const THREAD_PITCH = CLOTH_THREAD_PITCH / CLOTH_PATTERN_SCALE;
    const DIAG = Math.PI / 4;
    const COS = Math.cos(DIAG);
    const SIN = Math.sin(DIAG);
    const TAU = Math.PI * 2;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { map: null, bump: null };
    }

    const palette = preset.palette || CLOTH_TEXTURE_PRESETS[DEFAULT_CLOTH_TEXTURE_KEY].palette;
    const shadow = toRgb(palette.shadow);
    const base = toRgb(palette.base);
    const accent = toRgb(palette.accent);
    const highlight = toRgb(palette.highlight);
    const sparkleScale = Number.isFinite(preset.sparkle) ? preset.sparkle : 1;
    const strayScale = Number.isFinite(preset.stray) ? preset.stray : 1;

    const image = ctx.createImageData(SIZE, SIZE);
    const data = image.data;
    const hashNoise = (x, y, seedX, seedY, phase = 0) =>
      Math.sin((x * seedX + y * seedY + phase) * 0.02454369260617026) * 0.5 + 0.5;
    const fiberNoise = (x, y) =>
      hashNoise(x, y, 12.9898, 78.233, 1.5) * 0.7 +
      hashNoise(x, y, 32.654, 23.147, 15.73) * 0.2 +
      hashNoise(x, y, 63.726, 12.193, -9.21) * 0.1;
    const microNoise = (x, y) =>
      hashNoise(x, y, 41.12, 27.43, -4.5) * 0.5 +
      hashNoise(x, y, 19.71, 55.83, 23.91) * 0.5;
    const sparkleNoise = (x, y) =>
      hashNoise(x, y, 73.19, 11.17, 7.2) * 0.45 +
      hashNoise(x, y, 27.73, 61.91, -14.4) * 0.55;
    const strayWispNoise = (x, y) =>
      hashNoise(x, y, 91.27, 7.51, 3.3) * 0.6 +
      hashNoise(x, y, 14.91, 83.11, -5.7) * 0.4;
    const hairFiber = (x, y) => {
      const tuftSeed = hashNoise(x, y, 67.41, 3.73, -11.9);
      const straySeed = strayWispNoise(x + 13.7, y - 21.4);
      const dir = hashNoise(x, y, 5.19, 14.73, 8.2) * TAU;
      const wiggle = hashNoise(x, y, 51.11, 33.07, -6.9) * 2.5;
      const along = Math.sin(
        (x * Math.cos(dir) + y * Math.sin(dir)) * 0.042 + wiggle
      );
      const tuft = Math.pow(tuftSeed, 3.8);
      const stray = Math.pow(straySeed, 2.4);
      const filament = Math.pow(Math.abs(along), 1.6);
      const wisp = Math.pow(
        strayWispNoise(x * 0.82 - y * 0.63, y * 0.74 + x * 0.18),
        4.2
      );
      const crossNap = Math.pow(
        Math.abs(Math.cos((x - y) * 0.035 + wiggle * 0.42)),
        2.1
      );
      return THREE.MathUtils.clamp(
        tuft * 0.45 + stray * 0.22 + filament * 0.28 + wisp * 0.18 + crossNap * 0.25,
        0,
        1
      );
    };
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const u = ((x * COS + y * SIN) / THREAD_PITCH) * TAU;
        const v = ((x * COS - y * SIN) / THREAD_PITCH) * TAU;
        const warp = 0.5 + 0.5 * Math.cos(u);
        const weft = 0.5 + 0.5 * Math.cos(v);
        const weave = Math.pow((warp + weft) * 0.5, 1.68);
        const cross = Math.pow(warp * weft, 0.9);
        const diamond = Math.pow(Math.abs(Math.sin(u) * Math.sin(v)), 0.6);
        const fiber = fiberNoise(x, y);
        const micro = microNoise(x + 31.8, y + 17.3);
        const sparkleRaw = sparkleNoise(x * 0.6 + 11.8, y * 0.7 - 4.1);
        const sparkle = THREE.MathUtils.clamp(
          0.5 + (sparkleRaw - 0.5) * sparkleScale,
          0,
          1
        );
        const fuzz = Math.pow(fiber, 1.2);
        const hairRaw = hairFiber(x, y);
        const hair = THREE.MathUtils.clamp(0.5 + (hairRaw - 0.5) * strayScale, 0, 1);
        const tonal = THREE.MathUtils.clamp(
          0.56 +
            (weave - 0.5) * 0.6 * CLOTH_TEXTURE_INTENSITY +
            (cross - 0.5) * 0.48 * CLOTH_TEXTURE_INTENSITY +
            (diamond - 0.5) * 0.54 * CLOTH_TEXTURE_INTENSITY +
            (fiber - 0.5) * 0.26 * CLOTH_TEXTURE_INTENSITY +
            (fuzz - 0.5) * 0.2 * CLOTH_TEXTURE_INTENSITY +
            (micro - 0.5) * 0.18 * CLOTH_TEXTURE_INTENSITY +
            (sparkle - 0.5) * 0.24 * CLOTH_TEXTURE_INTENSITY,
          0,
          1
        );
        const softness = Math.pow(Math.abs(Math.sin(u * 0.5)) * Math.abs(Math.sin(v * 0.5)), 1.3);
        const hairWeave = Math.pow(hair, 1.6) * 0.42 + softness * CLOTH_SOFT_BLEND * 0.6;
        const warpBias = Math.pow(Math.abs(Math.cos(u)), 1.4);
        const weftBias = Math.pow(Math.abs(Math.sin(v)), 1.4);
        const bias = Math.pow((warpBias + weftBias) * 0.5, 1.18);
        const grain = Math.pow(
          Math.abs(Math.sin((x * COS + y * SIN) * 0.025)) *
            Math.abs(Math.cos((x * COS - y * SIN) * 0.025)),
          1.1
        );
        const sheen = THREE.MathUtils.clamp(
          0.42 +
            (sparkle - 0.5) * 0.4 +
            (hairWeave - 0.5) * CLOTH_HAIR_INTENSITY * 0.6 +
            (grain - 0.5) * 0.2,
          0,
          1
        );

        const shade = THREE.MathUtils.clamp(
          softness * 0.16 +
            sparkle * 0.22 +
            hairWeave * 0.2 +
            tonal * 0.28 +
            bias * 0.18,
          0,
          1
        );
        const baseMix = Math.pow(shade, 1.08);
        const accentMix = Math.pow(shade, 1.35);
        const highlightMix = Math.pow(shade, 1.5);
        const r =
          clamp255(shadow.r * (1 - baseMix) +
            base.r * baseMix * (1 - accentMix) +
            accent.r * accentMix * (1 - highlightMix) +
            highlight.r * highlightMix);
        const g =
          clamp255(shadow.g * (1 - baseMix) +
            base.g * baseMix * (1 - accentMix) +
            accent.g * accentMix * (1 - highlightMix) +
            highlight.g * highlightMix);
        const b =
          clamp255(shadow.b * (1 - baseMix) +
            base.b * baseMix * (1 - accentMix) +
            accent.b * accentMix * (1 - highlightMix) +
            highlight.b * highlightMix);
        const a = 255;

        const bump =
          shade * 0.5 * CLOTH_BUMP_INTENSITY +
          sparkle * 0.25 * CLOTH_BUMP_INTENSITY +
          hair * 0.15 * CLOTH_BUMP_INTENSITY +
          grain * 0.1 * CLOTH_BUMP_INTENSITY;
        const bumpValue = clamp255(128 + (bump - 0.5) * 64);

        const idx = (y * SIZE + x) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = a;
        data[idx + 4] = bumpValue;
        data[idx + 5] = bumpValue;
        data[idx + 6] = bumpValue;
        data[idx + 7] = a;
      }
    }

    const colorMap = new THREE.CanvasTexture(image);
    applySRGBColorSpace(colorMap);
    applyTextureDefaults(colorMap);

    const bumpMap = new THREE.DataTexture(image.data, SIZE, SIZE, THREE.RGBAFormat);
    applyTextureDefaults(bumpMap);

    return { map: colorMap, bump: bumpMap, mapSource: 'procedural' };
  };

  const ensurePolyHavenTextures = (preset, cacheKey) => {
    if (!preset?.sourceId) return;
    const cached = cache.get(cacheKey);
    if (cached?.ready) return;
    if (pendingLoads.has(cacheKey)) return;
    if (typeof window === 'undefined' || typeof fetch !== 'function') return;

    const promise = (async () => {
      try {
        let urls = {};
        try {
          const response = await fetch(`https://api.polyhaven.com/files/${encodeURIComponent(preset.sourceId)}`);
          if (response?.ok) {
            const json = await response.json();
            urls = pickPolyHavenTextureUrls(json);
          }
        } catch (error) {
          urls = {};
        }

        const fallback2k = buildPolyHavenTextureUrls(preset.sourceId, '2k');
        const fallback1k = buildPolyHavenTextureUrls(preset.sourceId, '1k');
        const loader = new THREE.TextureLoader();
        loader.setCrossOrigin('anonymous');

        const diffuseCandidates = [
          urls.diffuse,
          fallback2k?.diffuse,
          fallback1k?.diffuse
        ].filter(Boolean);
        const normalCandidates = [
          urls.normal,
          fallback2k?.normal,
          fallback1k?.normal
        ].filter(Boolean);
        const roughnessCandidates = [
          urls.roughness,
          fallback2k?.roughness,
          fallback1k?.roughness
        ].filter(Boolean);

        let map = null;
        let normal = null;
        let roughness = null;
        [map, normal, roughness] = await Promise.all([
          loadTextureWithFallbacks(loader, diffuseCandidates, true),
          loadTextureWithFallbacks(loader, normalCandidates, false),
          loadTextureWithFallbacks(loader, roughnessCandidates, false)
        ]);

        if (map) {
          map = neutralizePolyHavenColorMap(map);
        }

        [map, normal, roughness].forEach((tex) =>
          applyTextureDefaults(tex, { isPolyHaven: true })
        );

        const existing = cache.get(cacheKey) || {};
        cache.set(cacheKey, {
          ...existing,
          map: map ?? existing.map ?? null,
          bump: null,
          normal: normal ?? existing.normal ?? null,
          roughness: roughness ?? existing.roughness ?? null,
          presetId: preset.id,
          sourceId: preset.sourceId,
          mapSource: map ? 'polyhaven' : existing.mapSource ?? 'procedural',
          ready: Boolean(map || normal || roughness)
        });
        broadcastClothTextureReady(preset.sourceId);
      } catch (err) {
        console.warn('Failed to load Poly Haven cloth textures', preset?.sourceId, err);
      } finally {
        pendingLoads.delete(cacheKey);
      }
    })();
    pendingLoads.set(cacheKey, promise);
  };

  return (textureKey = DEFAULT_CLOTH_TEXTURE_KEY) => {
    const preset =
      CLOTH_TEXTURE_PRESETS[textureKey] ??
      CLOTH_TEXTURE_PRESETS[DEFAULT_CLOTH_TEXTURE_KEY];
    const cacheKey = preset.sourceId || preset.id;
    let entry = cache.get(cacheKey);
    if (!entry) {
      const procedural = generateProceduralClothTextures(preset);
      entry = {
        ...procedural,
        normal: null,
        roughness: null,
        presetId: preset.id,
        sourceId: preset.sourceId,
        mapSource: 'procedural',
        ready: false
      };
      cache.set(cacheKey, entry);
    }

    ensurePolyHavenTextures(preset, cacheKey);

    return {
      map: cloneTexture(entry.map),
      bump: cloneTexture(entry.bump),
      normal: cloneTexture(entry.normal),
      roughness: cloneTexture(entry.roughness),
      presetId: preset.id,
      sourceId: entry.sourceId,
      mapSource: entry.mapSource ?? 'procedural',
      ready: Boolean(entry.ready)
    };
  };
})();
function replaceMaterialTexture (
  material,
  prop,
  baseTexture,
  fallbackRepeat,
  { preserveExisting = false } = {}
) {
  if (!material) return;
  const prev = material[prop];
  if (!baseTexture) {
    if (preserveExisting && prev) {
      if (fallbackRepeat?.isVector2 && prev?.repeat?.isVector2) {
        prev.repeat.copy(fallbackRepeat);
        prev.needsUpdate = true;
      }
      return;
    }
    if (prev?.dispose) {
      prev.dispose();
    }
    material[prop] = null;
    material.needsUpdate = true;
    return;
  }
  if (prev?.dispose && prev !== baseTexture) {
    prev.dispose();
  }
  const next = baseTexture.clone();
  next.image = baseTexture.image;
  if (prev?.repeat?.isVector2) {
    next.repeat.copy(prev.repeat);
  } else if (fallbackRepeat?.isVector2) {
    next.repeat.copy(fallbackRepeat);
  } else if (fallbackRepeat && Number.isFinite(fallbackRepeat.x) && Number.isFinite(fallbackRepeat.y)) {
    next.repeat.set(fallbackRepeat.x, fallbackRepeat.y);
  }
  if (prev?.center?.isVector2) {
    next.center.copy(prev.center);
  } else {
    next.center.set(0.5, 0.5);
  }
  next.rotation = typeof prev?.rotation === 'number' ? prev.rotation : 0;
  next.needsUpdate = true;
  material[prop] = next;
  material.needsUpdate = true;
}

function updateClothTexturesForFinish (finishInfo, textureKey = DEFAULT_CLOTH_TEXTURE_KEY) {
  if (!finishInfo?.clothMat) return;
  registerClothTextureConsumer(textureKey, finishInfo);
  const textures = createClothTextures(textureKey);
  const textureScale = textures.mapSource === 'polyhaven' ? POLYHAVEN_PATTERN_REPEAT_SCALE : 1;
  const roughnessBase =
    finishInfo.clothBase?.roughness ?? finishInfo.clothMat.roughness ?? CLOTH_ROUGHNESS_BASE;
  const roughnessTarget =
    finishInfo.clothBase?.roughnessTarget ?? CLOTH_ROUGHNESS_TARGET;
  const baseRepeatRaw =
    finishInfo.clothMat.userData?.baseRepeatRaw ??
    finishInfo.clothBase?.baseRepeatRaw ??
    finishInfo.clothBase?.baseRepeat ??
    finishInfo.clothMat.userData?.baseRepeat ??
    1;
  const repeatRatioValue =
    finishInfo.clothMat.userData?.repeatRatio ?? finishInfo.clothBase?.repeatRatio ?? 1;
  const baseRepeatValue = baseRepeatRaw * textureScale;
  const fallbackRepeat = new THREE.Vector2(baseRepeatValue, baseRepeatValue * repeatRatioValue);
  replaceMaterialTexture(finishInfo.clothMat, 'map', textures.map, fallbackRepeat, {
    preserveExisting: true
  });
  replaceMaterialTexture(
    finishInfo.clothMat,
    'normalMap',
    textures.normal,
    fallbackRepeat,
    { preserveExisting: true }
  );
  replaceMaterialTexture(
    finishInfo.clothMat,
    'roughnessMap',
    textures.roughness,
    fallbackRepeat,
    { preserveExisting: true }
  );
  if (textures.normal) {
    finishInfo.clothMat.normalScale = CLOTH_NORMAL_SCALE.clone();
    replaceMaterialTexture(finishInfo.clothMat, 'bumpMap', null, fallbackRepeat);
  } else {
    replaceMaterialTexture(
      finishInfo.clothMat,
      'bumpMap',
      textures.bump,
      fallbackRepeat,
      { preserveExisting: true }
    );
  }
  if (textures.roughness) {
    finishInfo.clothMat.roughness = roughnessTarget;
  } else {
    finishInfo.clothMat.roughness = roughnessBase;
  }
  if (Number.isFinite(finishInfo.clothBase?.baseBumpScale)) {
    finishInfo.clothMat.bumpScale = finishInfo.clothBase.baseBumpScale;
  }
  if (finishInfo.clothMat.userData) {
    finishInfo.clothMat.userData.polyRepeatScale = textureScale;
    finishInfo.clothMat.userData.baseRepeat = baseRepeatValue;
    finishInfo.clothMat.userData.baseRepeatRaw = baseRepeatRaw;
    finishInfo.clothMat.userData.nearRepeat = baseRepeatValue * 1.12;
    finishInfo.clothMat.userData.farRepeat = baseRepeatValue * 0.44;
  }
  if (finishInfo.cushionMat) {
    replaceMaterialTexture(finishInfo.cushionMat, 'map', textures.map, fallbackRepeat, {
      preserveExisting: true
    });
    replaceMaterialTexture(
      finishInfo.cushionMat,
      'normalMap',
      textures.normal,
      fallbackRepeat,
      { preserveExisting: true }
    );
    replaceMaterialTexture(
      finishInfo.cushionMat,
      'roughnessMap',
      textures.roughness,
      fallbackRepeat,
      { preserveExisting: true }
    );
    if (textures.normal) {
      finishInfo.cushionMat.normalScale = CLOTH_NORMAL_SCALE.clone();
      replaceMaterialTexture(finishInfo.cushionMat, 'bumpMap', null, fallbackRepeat);
    } else {
      replaceMaterialTexture(
        finishInfo.cushionMat,
        'bumpMap',
        textures.bump,
        fallbackRepeat,
        { preserveExisting: true }
      );
    }
    if (textures.roughness) {
      finishInfo.cushionMat.roughness = roughnessTarget;
    } else {
      finishInfo.cushionMat.roughness = roughnessBase;
    }
    if (Number.isFinite(finishInfo.clothBase?.baseBumpScale)) {
      finishInfo.cushionMat.bumpScale = finishInfo.clothBase.baseBumpScale;
    }
  }
  if (finishInfo.clothEdgeMat) {
    const edgeColor = finishInfo.clothMat?.color
      ? finishInfo.clothMat.color.clone().lerp(new THREE.Color(0x000000), CLOTH_EDGE_TINT)
      : null;
    if (edgeColor) {
      finishInfo.clothEdgeMat.color.copy(edgeColor);
      finishInfo.clothEdgeMat.emissive.copy(
        edgeColor.clone().multiplyScalar(CLOTH_EDGE_EMISSIVE_MULTIPLIER)
      );
    }
    finishInfo.clothEdgeMat.map = null;
    finishInfo.clothEdgeMat.bumpMap = null;
    finishInfo.clothEdgeMat.normalMap = null;
    finishInfo.clothEdgeMat.roughnessMap = null;
    finishInfo.clothEdgeMat.bumpScale = 0;
    finishInfo.clothEdgeMat.roughness = 1;
    finishInfo.clothEdgeMat.clearcoat = 0;
    finishInfo.clothEdgeMat.clearcoatRoughness = 1;
    finishInfo.clothEdgeMat.envMapIntensity = 0;
    finishInfo.clothEdgeMat.sheen = 0;
    finishInfo.clothEdgeMat.emissiveIntensity = CLOTH_EDGE_EMISSIVE_INTENSITY;
    finishInfo.clothEdgeMat.metalness = 0;
    finishInfo.clothEdgeMat.reflectivity = 0;
    finishInfo.clothEdgeMat.needsUpdate = true;
  }
  finishInfo.parts?.underlayMeshes?.forEach((mesh) => {
    if (!mesh?.material) return;
    mesh.material.map = null;
    mesh.material.bumpMap = null;
    if (mesh.material.color && finishInfo.clothMat?.color) {
      mesh.material.color.copy(finishInfo.clothMat.color);
    }
    mesh.material.needsUpdate = true;
  });
  finishInfo.clothTextureKey = textureKey;
}

function resolveRepeatVector(settings, material) {
  if (!settings) {
    const stored = material?.userData?.woodRepeat;
    if (stored?.isVector2) {
      return stored.clone();
    }
    if (stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)) {
      return new THREE.Vector2(stored.x, stored.y);
    }
    return new THREE.Vector2(1, 1);
  }
  const value = settings?.repeat ?? settings;
  if (value?.isVector2) {
    return value.clone();
  }
  if (value && Number.isFinite(value.x) && Number.isFinite(value.y)) {
    return new THREE.Vector2(value.x, value.y);
  }
  const stored = material?.userData?.woodRepeat;
  if (stored?.isVector2) {
    return stored.clone();
  }
  if (stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)) {
    return new THREE.Vector2(stored.x, stored.y);
  }
  return new THREE.Vector2(1, 1);
}

function resolveRotation(settings, material) {
  if (settings && typeof settings.rotation === 'number') {
    return settings.rotation;
  }
  const existing = material?.userData?.__woodOptions?.rotation;
  if (typeof existing === 'number') {
    return existing;
  }
  const stored = material?.userData?.woodRotation;
  if (typeof stored === 'number') {
    return stored;
  }
  return 0;
}

function resolveTextureSize(settings, material) {
  if (settings && typeof settings.textureSize === 'number') {
    return settings.textureSize;
  }
  const existing = material?.userData?.__woodOptions?.textureSize;
  if (typeof existing === 'number') {
    return existing;
  }
  const stored = material?.userData?.woodTextureSize;
  if (typeof stored === 'number') {
    return stored;
  }
  return undefined;
}

function ensureMaterialWoodOptions(material, targetSettings) {
  if (!material) return null;
  const existing = material.userData?.__woodOptions;
  if (existing) {
    return existing;
  }
  const preset = WOOD_PRESETS_BY_ID[DEFAULT_WOOD_PRESET_ID];
  if (!preset) {
    return null;
  }
  const repeatVec = targetSettings?.repeat ?? new THREE.Vector2(1, 1);
  const rotation = targetSettings?.rotation ?? 0;
  const textureSize = targetSettings?.textureSize ?? DEFAULT_WOOD_TEXTURE_SIZE;
  const mapUrl =
    typeof targetSettings?.mapUrl === 'string' && targetSettings.mapUrl.trim().length > 0
      ? targetSettings.mapUrl.trim()
      : undefined;
  const roughnessMapUrl =
    typeof targetSettings?.roughnessMapUrl === 'string' &&
    targetSettings.roughnessMapUrl.trim().length > 0
      ? targetSettings.roughnessMapUrl.trim()
      : undefined;
  const normalMapUrl =
    typeof targetSettings?.normalMapUrl === 'string' &&
    targetSettings.normalMapUrl.trim().length > 0
      ? targetSettings.normalMapUrl.trim()
      : undefined;
  applyWoodTextures(material, {
    hue: preset.hue,
    sat: preset.sat,
    light: preset.light,
    contrast: preset.contrast,
    repeat: { x: repeatVec.x, y: repeatVec.y },
    rotation,
    textureSize,
    mapUrl,
    roughnessMapUrl,
    normalMapUrl,
    sharedKey: `pool-wood-${preset.id}`,
    ...SHARED_WOOD_SURFACE_PROPS
  });
  applySharedWoodSurfaceProps(material);
  return material.userData?.__woodOptions || null;
}

function applyWoodTextureToMaterial(material, repeat) {
  if (!material) return;
  const repeatVec = resolveRepeatVector(repeat, material);
  const rotation = resolveRotation(repeat, material);
  const textureSize = resolveTextureSize(repeat, material);
  const mapUrl =
    typeof repeat?.mapUrl === 'string' && repeat.mapUrl.trim().length > 0
      ? repeat.mapUrl.trim()
      : undefined;
  const roughnessMapUrl =
    typeof repeat?.roughnessMapUrl === 'string' && repeat.roughnessMapUrl.trim().length > 0
      ? repeat.roughnessMapUrl.trim()
      : undefined;
  const normalMapUrl =
    typeof repeat?.normalMapUrl === 'string' && repeat.normalMapUrl.trim().length > 0
      ? repeat.normalMapUrl.trim()
      : undefined;
  const repeatScale = clampWoodRepeatScaleValue(repeat?.woodRepeatScale ?? DEFAULT_WOOD_REPEAT_SCALE);
  const scaledRepeat = scaleWoodRepeatVector(repeatVec, repeatScale);
  const hadOptions = Boolean(material.userData?.__woodOptions);
  const options = ensureMaterialWoodOptions(material, {
    repeat: scaledRepeat,
    rotation,
    textureSize,
    mapUrl,
    roughnessMapUrl,
    normalMapUrl
  });
  if (options) {
    const repeatChanged =
      Math.abs((options.repeat?.x ?? 1) - scaledRepeat.x) > 1e-6 ||
      Math.abs((options.repeat?.y ?? 1) - scaledRepeat.y) > 1e-6;
    const rotationChanged =
      Math.abs((options.rotation ?? 0) - rotation) > 1e-6;
    const textureSizeChanged =
      typeof textureSize === 'number' &&
      Math.abs((options.textureSize ?? DEFAULT_WOOD_TEXTURE_SIZE) - textureSize) > 1e-6;
    const mapChanged =
      options.mapUrl !== mapUrl ||
      options.roughnessMapUrl !== roughnessMapUrl ||
      options.normalMapUrl !== normalMapUrl;
    if (hadOptions && (repeatChanged || rotationChanged || textureSizeChanged || mapChanged)) {
      applyWoodTextures(material, {
        ...options,
        repeat: { x: scaledRepeat.x, y: scaledRepeat.y },
        rotation,
        textureSize: textureSize ?? options.textureSize,
        mapUrl: mapUrl ?? options.mapUrl,
        roughnessMapUrl: roughnessMapUrl ?? options.roughnessMapUrl,
        normalMapUrl: normalMapUrl ?? options.normalMapUrl
      });
    }
  } else {
    if (material.map) {
      material.map = material.map.clone();
      material.map.repeat.copy(scaledRepeat);
      material.map.center.set(0.5, 0.5);
      material.map.rotation = rotation;
      material.map.needsUpdate = true;
    }
    if (material.roughnessMap) {
      material.roughnessMap = material.roughnessMap.clone();
      material.roughnessMap.repeat.copy(scaledRepeat);
      material.roughnessMap.center.set(0.5, 0.5);
      material.roughnessMap.rotation = rotation;
      material.roughnessMap.needsUpdate = true;
    }
    material.needsUpdate = true;
  }
  applySharedWoodSurfaceProps(material);
  material.userData = material.userData || {};
  if (material.userData.woodRepeat?.isVector2) {
    material.userData.woodRepeat.copy(scaledRepeat);
  } else {
    material.userData.woodRepeat = scaledRepeat.clone();
  }
  material.userData.woodRepeatScale = repeatScale;
  material.userData.woodRotation = rotation;
  if (typeof textureSize === 'number') {
    material.userData.woodTextureSize = textureSize;
  }
}

function toPlainWoodSurfaceConfig(settings) {
  if (!settings) {
    return null;
  }
  const repeatSource = settings.repeat ?? settings;
  let repeatX = null;
  let repeatY = null;
  let mapUrl = null;
  let roughnessMapUrl = null;
  let normalMapUrl = null;
  if (repeatSource?.isVector2) {
    repeatX = repeatSource.x;
    repeatY = repeatSource.y;
  } else if (
    repeatSource &&
    Number.isFinite(repeatSource.x) &&
    Number.isFinite(repeatSource.y)
  ) {
    repeatX = repeatSource.x;
    repeatY = repeatSource.y;
  }
  const rotation = typeof settings.rotation === 'number' ? settings.rotation : 0;
  const textureSize =
    typeof settings.textureSize === 'number' ? settings.textureSize : undefined;
  if (typeof settings.mapUrl === 'string' && settings.mapUrl.trim().length > 0) {
    mapUrl = settings.mapUrl.trim();
  }
  if (
    typeof settings.roughnessMapUrl === 'string' &&
    settings.roughnessMapUrl.trim().length > 0
  ) {
    roughnessMapUrl = settings.roughnessMapUrl.trim();
  }
  if (typeof settings.normalMapUrl === 'string' && settings.normalMapUrl.trim().length > 0) {
    normalMapUrl = settings.normalMapUrl.trim();
  }
  return {
    repeat: {
      x: Number.isFinite(repeatX) ? repeatX : 1,
      y: Number.isFinite(repeatY) ? repeatY : 1
    },
    rotation,
    textureSize,
    mapUrl,
    roughnessMapUrl,
    normalMapUrl
  };
}

function resolveWoodSurfaceConfig(option, fallback) {
  const base =
    toPlainWoodSurfaceConfig(fallback) ??
    toPlainWoodSurfaceConfig({ repeat: { x: 1, y: 1 }, rotation: 0 });
  const resolvedOption = toPlainWoodSurfaceConfig(option);
  return {
    repeat: {
      x: resolvedOption?.repeat?.x ?? base.repeat.x,
      y: resolvedOption?.repeat?.y ?? base.repeat.y
    },
    rotation: resolvedOption?.rotation ?? base.rotation,
    textureSize: resolvedOption?.textureSize ?? base.textureSize,
    mapUrl: resolvedOption?.mapUrl ?? base.mapUrl,
    roughnessMapUrl: resolvedOption?.roughnessMapUrl ?? base.roughnessMapUrl,
    normalMapUrl: resolvedOption?.normalMapUrl ?? base.normalMapUrl
  };
}

function cloneWoodSurfaceConfig(config) {
  if (!config) return null;
  return {
    repeat: {
      x: Number.isFinite(config.repeat?.x) ? config.repeat.x : 1,
      y: Number.isFinite(config.repeat?.y) ? config.repeat.y : 1
    },
    rotation: typeof config.rotation === 'number' ? config.rotation : 0,
    textureSize:
      typeof config.textureSize === 'number' ? config.textureSize : undefined,
    mapUrl: typeof config.mapUrl === 'string' ? config.mapUrl : undefined,
    roughnessMapUrl:
      typeof config.roughnessMapUrl === 'string' ? config.roughnessMapUrl : undefined,
    normalMapUrl: typeof config.normalMapUrl === 'string' ? config.normalMapUrl : undefined,
    woodRepeatScale: clampWoodRepeatScaleValue(config.woodRepeatScale)
  };
}

function orientRailWoodSurface(surface) {
  if (!surface) {
    return { repeat: { x: 1, y: 1 }, rotation: 0 };
  }
  // Preserve the incoming repeat and rotation so each rail can keep its own
  // grain direction. The UV projector will align the long rails independently
  // to avoid stretching a single strip around the full perimeter.
  return {
    repeat: {
      x: Number.isFinite(surface.repeat?.x) ? surface.repeat.x : 1,
      y: Number.isFinite(surface.repeat?.y) ? surface.repeat.y : 1
    },
    rotation: typeof surface.rotation === 'number' ? surface.rotation : 0,
    textureSize:
      typeof surface.textureSize === 'number' ? surface.textureSize : undefined,
    mapUrl: typeof surface.mapUrl === 'string' ? surface.mapUrl : undefined,
    roughnessMapUrl:
      typeof surface.roughnessMapUrl === 'string' ? surface.roughnessMapUrl : undefined,
    normalMapUrl:
      typeof surface.normalMapUrl === 'string' ? surface.normalMapUrl : undefined
  };
}

function projectRailUVs(geometry, bounds) {
  if (!geometry?.attributes?.position) return geometry;
  const { outerHalfW = 1, outerHalfH = 1, railH = 1 } = bounds ?? {};
  const target = geometry.index ? geometry.toNonIndexed() : geometry;
  const positions = target.attributes.position;
  const uv = new Float32Array(positions.count * 2);
  const extents = {
    x: Math.max(outerHalfW * 2, MICRO_EPS),
    y: Math.max(outerHalfH * 2, MICRO_EPS),
    z: Math.max(railH, MICRO_EPS)
  };

  const faceNormal = new THREE.Vector3();
  const edgeA = new THREE.Vector3();
  const edgeB = new THREE.Vector3();
  const center = new THREE.Vector3();

  for (let i = 0; i < positions.count; i += 3) {
    const verts = [0, 1, 2].map((offset) =>
      new THREE.Vector3().fromBufferAttribute(positions, i + offset)
    );
    edgeA.subVectors(verts[1], verts[0]);
    edgeB.subVectors(verts[2], verts[0]);
    faceNormal.crossVectors(edgeA, edgeB).normalize();
    center.set(0, 0, 0).add(verts[0]).add(verts[1]).add(verts[2]).multiplyScalar(1 / 3);

    const absX = Math.abs(faceNormal.x);
    const absY = Math.abs(faceNormal.y);
    const absZ = Math.abs(faceNormal.z);
    const dominantZ = absZ >= Math.max(absX, absY);
    const uAxis = dominantZ ? 'x' : absX >= absY ? 'y' : 'x';
    const vAxis = dominantZ ? 'y' : 'z';

    const matchedExtent = dominantZ ? extents[vAxis] : extents[uAxis];
    const vSharpness = dominantZ ? 1 : 1.12;

    verts.forEach((v, idx) => {
      const u = (v[uAxis] + extents[uAxis] / 2) / extents[uAxis];
      const vCoord =
        ((v[vAxis] + extents[vAxis] / 2) / matchedExtent) * vSharpness;
      const uvIndex = (i + idx) * 2;
      uv[uvIndex] = u;
      uv[uvIndex + 1] = vCoord;
    });
  }

  target.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return target;
}

function enhanceChromeMaterial(material) {
  if (!material) return;
  const ensure = (key, value, transform) => {
    if (typeof material[key] === 'number') {
      material[key] = transform(material[key], value);
    } else {
      material[key] = value;
    }
  };
  ensure('metalness', 0.9, (current, target) => Math.max(current, target));
  ensure('roughness', 0.1, (current, target) => Math.min(current, target));
  ensure('clearcoat', 0.72, (current, target) => Math.max(current, target));
  ensure('clearcoatRoughness', 0.16, (current, target) => Math.max(current, target));
  ensure('envMapIntensity', 1.02, (current, target) =>
    THREE.MathUtils.clamp(current, 0.92, target)
  );
  if (material.side !== THREE.DoubleSide) {
    material.side = THREE.DoubleSide;
  }
  material.shadowSide = THREE.DoubleSide;
  if ('reflectivity' in material) {
    material.reflectivity = THREE.MathUtils.clamp(
      material.reflectivity ?? 0.8,
      0.72,
      0.92
    );
  }
  if ('specularIntensity' in material) {
    material.specularIntensity = Math.max(1.02, material.specularIntensity ?? 1.02);
  }
  material.needsUpdate = true;
}

function softenOuterExtrudeEdges(geometry, depth, radiusRatio = 0.25, options = {}) {
  if (!geometry || typeof depth !== 'number' || depth <= 0) return geometry;
  const target = geometry.toNonIndexed ? geometry.toNonIndexed() : geometry;
  const position = target.attributes.position;
  const normal = target.attributes.normal;
  if (!position || !normal) return target;
  const depthSafe = depth <= 0 ? 1 : depth;
  const radius = Math.max(0, depthSafe * radiusRatio);
  const innerBounds = options?.innerBounds;
  const pos = new THREE.Vector3();
  const norm = new THREE.Vector3();
  const planarNormal = new THREE.Vector2();
  const planarPos = new THREE.Vector2();
  for (let i = 0; i < position.count; i++) {
    pos.set(position.getX(i), position.getY(i), position.getZ(i));
    norm.set(normal.getX(i), normal.getY(i), normal.getZ(i));
    if (!Number.isFinite(pos.z)) continue;
    planarNormal.set(norm.x, norm.y);
    if (planarNormal.lengthSq() < 1e-5) continue;
    planarPos.set(pos.x, pos.y);
    if (innerBounds) {
      const padding = Number.isFinite(innerBounds.padding)
        ? innerBounds.padding
        : 0;
      const limitX = Number.isFinite(innerBounds.halfWidth)
        ? innerBounds.halfWidth + padding
        : null;
      const limitY = Number.isFinite(innerBounds.halfHeight)
        ? innerBounds.halfHeight + padding
        : null;
      const insideX =
        limitX == null || Math.abs(planarPos.x) <= limitX + MICRO_EPS * 4;
      const insideY =
        limitY == null || Math.abs(planarPos.y) <= limitY + MICRO_EPS * 4;
      if (insideX && insideY) continue;
    }
    const dot = planarNormal.dot(planarPos);
    if (dot <= 0) continue;
    const heightT = THREE.MathUtils.clamp(pos.z / depthSafe, 0, 1);
    if (heightT <= 0) continue;
    const eased = Math.sin((heightT * Math.PI) / 2);
    const inset = radius * eased * eased;
    pos.x -= planarNormal.x * inset;
    pos.y -= planarNormal.y * inset;
    position.setXYZ(i, pos.x, pos.y, pos.z);
    const blend = eased * 0.85;
    const blended = new THREE.Vector3(
      THREE.MathUtils.lerp(norm.x, 0, blend),
      THREE.MathUtils.lerp(norm.y, 0, blend),
      THREE.MathUtils.lerp(norm.z, 1, blend)
    );
    blended.normalize();
    normal.setXYZ(i, blended.x, blended.y, blended.z);
  }
  position.needsUpdate = true;
  normal.needsUpdate = true;
  target.computeVertexNormals();
  return target;
}

const HDRI_STORAGE_KEY = 'poolHdriEnvironment';
const DEFAULT_HDRI_RESOLUTIONS = Object.freeze(['8k', '6k', '4k']);
const HDRI_RESOLUTION_STORAGE_KEY = 'poolHdriResolution';
const DEFAULT_HDRI_RESOLUTION_MODE = 'auto';
const HDRI_RESOLUTION_OPTIONS = Object.freeze([
  { id: 'auto', label: 'Match Table' },
  { id: '8k', label: '8K' },
  { id: '6k', label: '6K' },
  { id: '4k', label: '4K' },
  { id: '2k', label: '2K' }
]);
const HDRI_RESOLUTION_OPTION_MAP = Object.freeze(
  HDRI_RESOLUTION_OPTIONS.reduce((acc, option) => {
    acc[option.id] = option;
    return acc;
  }, {})
);
const DEFAULT_HDRI_CAMERA_HEIGHT_M = 1.5;
const MIN_HDRI_CAMERA_HEIGHT_M = 0.8;
const DEFAULT_HDRI_RADIUS_MULTIPLIER = 6;
const MIN_HDRI_RADIUS = 24;
const HDRI_GROUNDED_RESOLUTION = 96;

function resolveHdriResolutionForTable(tableSizeMeta) {
  const widthMm = tableSizeMeta?.playfield?.widthMm;
  if (Number.isFinite(widthMm) && widthMm >= 2540) {
    return '8k';
  }
  return '4k';
}

function pickPolyHavenHdriUrl(apiJson, preferredResolutions = []) {
  const urls = [];
  const walk = (value) => {
    if (!value) return;
    if (typeof value === 'string') {
      if (value.startsWith('http') && value.toLowerCase().includes('.hdr')) {
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
  const lower = urls.map((u) => u.toLowerCase());
  for (const res of preferredResolutions) {
    const match = lower.find((u) => u.includes(`_${res}.`));
    if (match) return urls[lower.indexOf(match)];
  }
  return urls[0] ?? null;
}

async function resolvePolyHavenHdriUrl(config = {}) {
  const preferred = Array.isArray(config?.preferredResolutions) && config.preferredResolutions.length
    ? config.preferredResolutions
    : DEFAULT_HDRI_RESOLUTIONS;
  const fallbackRes = config?.fallbackResolution || preferred[0] || '4k';
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

async function createFallbackHdriEnvironment(renderer) {
  if (!renderer) return null;
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const hemi = new THREE.HemisphereLight(0x94a3b8, 0x0f172a, 1.05);
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(6, 24),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.78, metalness: 0.05 })
  );
  floor.rotation.x = -Math.PI / 2;
  const tempScene = new THREE.Scene();
  tempScene.add(hemi);
  tempScene.add(floor);
  const { texture } = pmrem.fromScene(tempScene);
  texture.name = 'pool-royale-fallback-env';
  pmrem.dispose();
  floor.geometry.dispose();
  floor.material.dispose();
  return { envMap: texture, skyboxMap: null, url: null };
}

async function loadPolyHavenHdriEnvironment(renderer, config = {}) {
  if (!renderer) return null;
  const url = await resolvePolyHavenHdriUrl(config);
  const resolveFallback = async () => {
    try {
      return await createFallbackHdriEnvironment(renderer);
    } catch (error) {
      console.warn('Failed to build fallback HDRI environment', error);
      return null;
    }
  };
  const lowerUrl = `${url ?? ''}`.toLowerCase();
  const useExr = lowerUrl.endsWith('.exr');
  const loader = useExr ? new EXRLoader() : new RGBELoader();
  loader.setCrossOrigin?.('anonymous');
  return new Promise((resolve) => {
    if (!url) {
      resolveFallback().then(resolve);
      return;
    }
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
      async (error) => {
        console.warn('Failed to load Poly Haven HDRI', error);
        const fallbackEnv = await resolveFallback();
        resolve(fallbackEnv);
      }
    );
  });
}

function createBroadcastCameras({
  floorY,
  cameraHeight,
  shortRailZ,
  slideLimit,
  arenaHalfDepth = null
}) {
  const group = new THREE.Group();
  group.name = 'broadcastCameras';
  const cameras = {};

  const darkMetal = new THREE.MeshStandardMaterial({
    color: 0x1f2937,
    metalness: 0.65,
    roughness: 0.32
  });
  const lightMetal = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.58,
    roughness: 0.36
  });
  const plastic = new THREE.MeshStandardMaterial({
    color: 0x1b2533,
    metalness: 0.24,
    roughness: 0.42
  });
  const rubber = new THREE.MeshStandardMaterial({
    color: 0x080c14,
    metalness: 0.0,
    roughness: 0.94
  });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x97c6ff,
    metalness: 0.0,
    roughness: 0.08,
    transparent: true,
    opacity: 0.42,
    envMapIntensity: 1.1
  });

  const footRadius = Math.min(0.85, PLAY_W * 0.22);
  const headHeight = Math.max(1.45, cameraHeight - floorY);
  const hubHeight = Math.max(1.08, headHeight - 0.52);
  const columnHeight = Math.max(0.42, headHeight - hubHeight);
  const legLength = Math.sqrt(footRadius * footRadius + hubHeight * hubHeight);
  const legGeo = new THREE.CylinderGeometry(0.034, 0.022, legLength, 14);
  const footHeight = 0.045;
  const footGeo = new THREE.CylinderGeometry(0.07, 0.07, footHeight, 16);
  const columnGeo = new THREE.CylinderGeometry(0.052, 0.05, columnHeight, 16);
  const hubGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.08, 18);
  const headBaseGeo = new THREE.CylinderGeometry(0.11, 0.13, 0.05, 18);
  const panBarGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.32, 12);
  const gripGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.2, 12);

  const defaultFocus = new THREE.Vector3(
    0,
    TABLE_Y + TABLE.THICK + BALL_R * 2.5,
    0
  );

  const fallbackDepth = Math.max(
    shortRailZ + BALL_R * 12,
    PLAY_H / 2 + BALL_R * 14
  );
  const maxDepth = typeof arenaHalfDepth === 'number'
    ? Math.max(shortRailZ + BALL_R * 8, arenaHalfDepth)
    : fallbackDepth;
  const requestedZ = Math.abs(shortRailZ) || fallbackDepth;
  const cameraCenterZOffset = Math.min(Math.max(requestedZ, fallbackDepth), maxDepth);
  const cameraScale = 1.2;
  const cameraProximityScale = 0.6;

  const createShortRailUnit = (zSign) => {
    const direction = Math.sign(zSign) || 1;
    const base = new THREE.Group();
    const centeredZ = direction * cameraCenterZOffset * cameraProximityScale;
    base.position.set(0, floorY, centeredZ);
    const horizontalFocus = defaultFocus.clone();
    horizontalFocus.y = base.position.y;
    base.lookAt(horizontalFocus);
    base.rotation.x = 0;
    base.rotation.z = 0;
    group.add(base);

    const slider = new THREE.Group();
    slider.userData.slideLimit = Math.max(slideLimit ?? 0, 0);
    base.add(slider);
    slider.scale.setScalar(cameraScale);

    const headPivot = new THREE.Group();
    headPivot.position.y = headHeight + 0.02;
    slider.add(headPivot);

    const cameraAssembly = new THREE.Group();
    headPivot.add(cameraAssembly);

    if (SHOW_SHORT_RAIL_TRIPODS) {
      const tripod = new THREE.Group();
      slider.add(tripod);

      const top = new THREE.Vector3(0, hubHeight, 0);
      [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].forEach((angle) => {
        const foot = new THREE.Vector3(
          Math.cos(angle) * footRadius,
          0,
          Math.sin(angle) * footRadius
        );
        const mid = top.clone().add(foot).multiplyScalar(0.5);
        const up = top.clone().sub(foot).normalize();
        const leg = new THREE.Mesh(legGeo, darkMetal);
        leg.position.copy(mid);
        leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
        leg.castShadow = true;
        leg.receiveShadow = true;
        tripod.add(leg);

        const footPad = new THREE.Mesh(footGeo, rubber);
        footPad.position.set(foot.x, footHeight / 2, foot.z);
        footPad.receiveShadow = true;
        tripod.add(footPad);
      });

      const column = new THREE.Mesh(columnGeo, lightMetal);
      column.position.y = hubHeight + columnHeight / 2;
      column.castShadow = true;
      column.receiveShadow = true;
      slider.add(column);

      const hub = new THREE.Mesh(hubGeo, lightMetal);
      hub.position.y = hubHeight;
      hub.castShadow = true;
      hub.receiveShadow = true;
      slider.add(hub);

      const headBase = new THREE.Mesh(headBaseGeo, darkMetal);
      headBase.position.y = headHeight;
      headBase.castShadow = true;
      slider.add(headBase);

      const body = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.24, 0.22), plastic);
      body.castShadow = true;
      body.receiveShadow = true;
      cameraAssembly.add(body);

      const lensHousing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.065, 0.07, 0.18, 24),
        darkMetal
      );
      lensHousing.rotation.x = Math.PI / 2;
      lensHousing.position.set(0, 0, -0.2);
      lensHousing.castShadow = true;
      cameraAssembly.add(lensHousing);

      const hood = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.16), rubber);
      hood.position.set(0, 0, -0.32);
      hood.castShadow = true;
      cameraAssembly.add(hood);

      const lensGlass = new THREE.Mesh(new THREE.CircleGeometry(0.06, 24), glass);
      lensGlass.rotation.x = Math.PI / 2;
      lensGlass.position.set(0, 0, -0.29);
      cameraAssembly.add(lensGlass);

      const topHandle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.016, 0.016, 0.26, 12),
        rubber
      );
      topHandle.rotation.z = Math.PI / 2;
      topHandle.position.set(0, 0.16, 0);
      topHandle.castShadow = true;
      cameraAssembly.add(topHandle);

      const viewfinder = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.1, 0.08),
        lightMetal
      );
      viewfinder.position.set(-0.22, 0.06, 0.05);
      viewfinder.castShadow = true;
      cameraAssembly.add(viewfinder);

      const panBar = new THREE.Mesh(panBarGeo, lightMetal);
      panBar.rotation.z = Math.PI / 2.3;
      panBar.position.set(0.26, -0.08, 0);
      panBar.castShadow = true;
      headPivot.add(panBar);

      const grip = new THREE.Mesh(gripGeo, rubber);
      grip.rotation.z = Math.PI / 2.3;
      grip.position.set(0.37, -0.12, 0);
      grip.castShadow = true;
      headPivot.add(grip);
    }

    headPivot.lookAt(defaultFocus);
    headPivot.rotateY(Math.PI);

    return {
      base,
      slider,
      head: headPivot,
      assembly: cameraAssembly,
      direction,
      rail: direction >= 0 ? 'back' : 'front'
    };
  };

  cameras.front = createShortRailUnit(-1);
  cameras.back = createShortRailUnit(1);

  return { group, cameras, slideLimit, cameraHeight, defaultFocus };
}

const createTripodBroadcastCamera = (() => {
  const metalDark = new THREE.MeshStandardMaterial({
    color: 0x1f2937,
    metalness: 0.7,
    roughness: 0.35
  });
  const metalLite = new THREE.MeshStandardMaterial({
    color: 0x374151,
    metalness: 0.6,
    roughness: 0.4
  });
  const plastic = new THREE.MeshStandardMaterial({
    color: 0x0ea5e9,
    metalness: 0.1,
    roughness: 0.6
  });
  const rubber = new THREE.MeshStandardMaterial({
    color: 0x0b1220,
    metalness: 0.0,
    roughness: 0.95
  });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x9bd3ff,
    metalness: 0.0,
    roughness: 0.05,
    transparent: true,
    opacity: 0.35,
    envMapIntensity: 1.5
  });

  const hubGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.05, 16);
  const legGeo = new THREE.CylinderGeometry(0.03, 0.015, 1.2, 12);
  const footGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.02, 12);
  const braceGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.7, 8);
  const ballGeo = new THREE.SphereGeometry(0.07, 16, 16);
  const plateGeo = new THREE.BoxGeometry(0.22, 0.02, 0.14);
  const mountGeo = new THREE.BoxGeometry(0.2, 0.02, 0.12);
  const handleGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.35, 8);
  const gripGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.12, 10);
  const bodyGeo = new THREE.BoxGeometry(0.42, 0.22, 0.2);
  const lensTubeGeo = new THREE.CylinderGeometry(0.06, 0.065, 0.16, 24);
  const lensGlassGeo = new THREE.CircleGeometry(0.058, 24);
  const hoodGeo = new THREE.BoxGeometry(0.12, 0.09, 0.12);
  const vfGeo = new THREE.BoxGeometry(0.14, 0.08, 0.08);
  const topHandleGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.24, 12);

  const LEG_SPREAD = 0.45;
  const LEG_TILT = 0.38;
  const HUB_HEIGHT = 0.9;

  return () => {
    const group = new THREE.Group();
    group.name = 'shortRailTripodCamera';
    const base = new THREE.Group();
    group.add(base);

    const hub = new THREE.Mesh(hubGeo, metalLite);
    hub.position.y = HUB_HEIGHT;
    hub.castShadow = true;
    hub.receiveShadow = true;
    base.add(hub);

    const legAngles = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
    legAngles.forEach((angle) => {
      const leg = new THREE.Mesh(legGeo, metalDark);
      leg.castShadow = true;
      leg.receiveShadow = true;
      const baseX = Math.cos(angle) * LEG_SPREAD;
      const baseZ = Math.sin(angle) * LEG_SPREAD;
      const tiltAxis = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle)).normalize();
      leg.position.set(baseX * 0.2, HUB_HEIGHT - 0.6, baseZ * 0.2);
      leg.quaternion.setFromAxisAngle(tiltAxis, LEG_TILT);
      base.add(leg);

      const foot = new THREE.Mesh(footGeo, rubber);
      foot.position.set(Math.cos(angle) * 0.65, 0.01, Math.sin(angle) * 0.65);
      foot.receiveShadow = true;
      base.add(foot);

      const brace = new THREE.Mesh(braceGeo, metalLite);
      brace.castShadow = true;
      const from = new THREE.Vector3(0, HUB_HEIGHT, 0);
      const to = new THREE.Vector3(Math.cos(angle) * 0.65, 0.02, Math.sin(angle) * 0.65);
      const dirVec = new THREE.Vector3().subVectors(to, from);
      const len = dirVec.length();
      brace.scale.set(1, len / 0.7, 1);
      brace.position.copy(from.clone().add(to).multiplyScalar(0.5));
      brace.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirVec.clone().normalize());
      base.add(brace);
    });

    const headPivot = new THREE.Group();
    headPivot.position.set(0, HUB_HEIGHT, 0);
    base.add(headPivot);

    const cameraAssembly = new THREE.Group();
    cameraAssembly.rotation.y = Math.PI / 2;
    headPivot.add(cameraAssembly);

    const ball = new THREE.Mesh(ballGeo, metalDark);
    ball.position.set(0, 0.1, 0);
    ball.castShadow = true;
    ball.receiveShadow = true;
    cameraAssembly.add(ball);

    const plate = new THREE.Mesh(plateGeo, metalLite);
    plate.position.set(0, 0.2, 0);
    plate.castShadow = true;
    plate.receiveShadow = true;
    cameraAssembly.add(plate);

    const mount = new THREE.Mesh(mountGeo, metalDark);
    mount.position.set(0, 0.23, 0);
    mount.castShadow = true;
    mount.receiveShadow = true;
    cameraAssembly.add(mount);

    const handle = new THREE.Mesh(handleGeo, metalLite);
    handle.castShadow = true;
    handle.position.set(0.09, 0.16, 0);
    handle.rotation.z = Math.PI * -0.25;
    cameraAssembly.add(handle);

    const grip = new THREE.Mesh(gripGeo, rubber);
    grip.position.set(0.24, 0.07, -0.09);
    grip.rotation.z = Math.PI * -0.25;
    grip.castShadow = true;
    cameraAssembly.add(grip);

    const body = new THREE.Mesh(bodyGeo, plastic);
    body.position.set(0, 0.32, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    cameraAssembly.add(body);

    const lensTube = new THREE.Mesh(lensTubeGeo, metalDark);
    lensTube.rotation.z = Math.PI / 2;
    lensTube.position.set(0.25, 0.32, 0);
    lensTube.castShadow = true;
    cameraAssembly.add(lensTube);

    const lensGlass = new THREE.Mesh(lensGlassGeo, glass);
    lensGlass.rotation.y = Math.PI / 2;
    lensGlass.position.set(0.33, 0.32, 0);
    cameraAssembly.add(lensGlass);

    const hood = new THREE.Mesh(hoodGeo, rubber);
    hood.position.set(0.38, 0.32, 0);
    hood.castShadow = true;
    hood.receiveShadow = true;
    cameraAssembly.add(hood);

    const viewfinder = new THREE.Mesh(vfGeo, metalLite);
    viewfinder.position.set(-0.2, 0.36, 0.06);
    viewfinder.castShadow = true;
    cameraAssembly.add(viewfinder);

    const topHandle = new THREE.Mesh(topHandleGeo, rubber);
    topHandle.rotation.z = Math.PI / 2;
    topHandle.position.set(0, 0.43, 0);
    topHandle.castShadow = true;
    cameraAssembly.add(topHandle);

    const cableCurve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(-0.05, 0.4, 0.1),
      new THREE.Vector3(-0.1, 0.3, 0.2),
      new THREE.Vector3(-0.2, 0.1, 0.15),
      new THREE.Vector3(-0.25, 0.02, 0.0)
    );
    const cableGeo = new THREE.TubeGeometry(cableCurve, 20, 0.005, 6, false);
    const cable = new THREE.Mesh(cableGeo, rubber);
    cable.castShadow = true;
    cameraAssembly.add(cable);

    return { group, headPivot };
  };
})();

function spotPositions(baulkZ) {
  const halfH = PLAY_H / 2;
  const topCushion = halfH;
  const pinkZ = (topCushion + 0) / 2;
  const blackZ = topCushion - BLACK_FROM_TOP;
  return {
    yellow: [-D_RADIUS, baulkZ],
    green: [D_RADIUS, baulkZ],
    brown: [0, baulkZ],
    blue: [0, 0],
    pink: [0, pinkZ],
    black: [0, blackZ]
  };
}

function applySnookerScaling({
  tableInnerRect,
  cushions,
  pockets,
  balls,
  markings,
  camera,
  ui
}) {
  const width = tableInnerRect?.width ?? innerLong;
  const height = tableInnerRect?.height ?? innerShort;
  const center = tableInnerRect?.center ?? new THREE.Vector3();
  const mmToUnits = width / WIDTH_REF;
  const ratio = width / Math.max(height, 1e-6);
  console.assert(
    Math.abs(ratio - TARGET_RATIO) < 1e-4,
    'applySnookerScaling: table aspect ratio must remain 2:1.'
  );
  const expectedCornerMouth =
    CORNER_MOUTH_REF * mmToUnits * POCKET_CORNER_MOUTH_SCALE;
  const expectedSideMouth =
    SIDE_MOUTH_REF * mmToUnits * POCKET_SIDE_MOUTH_SCALE;
  const actualCornerMouth = POCKET_VIS_R * 2;
  const actualSideMouth = SIDE_POCKET_RADIUS * 2;
  console.assert(
    Math.abs(actualCornerMouth - expectedCornerMouth) <= POCKET_MOUTH_TOLERANCE,
    'applySnookerScaling: corner pocket mouth mismatch.'
  );
  console.assert(
    Math.abs(actualSideMouth - expectedSideMouth) <= POCKET_MOUTH_TOLERANCE,
    'applySnookerScaling: side pocket mouth mismatch.'
  );
  if (Array.isArray(pockets)) {
    pockets.forEach((pocket, index) => {
      if (pocket?.userData) {
        const capture = index >= 4 ? SIDE_CAPTURE_R : CAPTURE_R;
        pocket.userData.captureRadius = capture;
      }
    });
  }
  if (markings?.baulkLine) {
    const halfWidth = width / 2;
    const baulkZ = -halfWidth + BAULK_FROM_BAULK_REF * mmToUnits;
    const markingY = markings.baulkLine.position.y;
    markings.baulkLine.position.set(center.x, markingY, baulkZ);
    if (markings.dArc) {
      markings.dArc.position.set(center.x, markingY, baulkZ);
    }
    if (Array.isArray(markings.spots) && markings.spots.length >= 6) {
      const [yellow, brown, green, blue, pink, black] = markings.spots;
      const spotY = yellow?.position?.y ?? markingY;
      if (yellow) yellow.position.set(-D_RADIUS, spotY, baulkZ);
      if (brown) brown.position.set(0, spotY, baulkZ);
      if (green) green.position.set(D_RADIUS, spotY, baulkZ);
      if (blue) blue.position.set(0, spotY, center.z);
      const topCushion = halfWidth;
      const pinkZ = (topCushion + center.z) / 2;
      const blackZ = topCushion - BLACK_FROM_TOP_REF * mmToUnits;
      if (pink) pink.position.set(0, spotY, pinkZ);
      if (black) black.position.set(0, spotY, blackZ);
    }
  }
  if (Array.isArray(balls)) {
    const expectedRadius = BALL_D_REF * mmToUnits * BALL_SIZE_SCALE * 0.5;
    balls.forEach((ball) => {
      if (!ball) return;
      ball.colliderRadius = expectedRadius;
      const mesh = ball.mesh;
      if (!mesh) return;
      const baseRadius = mesh.geometry?.parameters?.radius;
      if (Number.isFinite(baseRadius) && baseRadius > 0) {
        const scale = expectedRadius / baseRadius;
        mesh.scale.setScalar(scale);
      }
    });
  }
  void cushions;
  void camera;
  void ui;
  return { mmToUnits };
}

// Camera: keep a comfortable angle that doesn’t dip below the cloth, but allow a bit more height when it rises
const STANDING_VIEW_PHI = 0.86; // raise the standing orbit a touch for a clearer overview
const CUE_SHOT_PHI = Math.PI / 2 - 0.26;
const STANDING_VIEW_MARGIN = 0.0012; // pull the standing frame closer so the table and balls fill more of the view
const STANDING_VIEW_FOV = 66;
const CAMERA_ABS_MIN_PHI = 0.1;
const CAMERA_LOWEST_PHI = CUE_SHOT_PHI - 0.14; // let the cue view drop to the same rail-hugging height used by AI shots while staying above the cue
const CAMERA_MIN_PHI = Math.max(CAMERA_ABS_MIN_PHI, STANDING_VIEW_PHI - 0.48);
const CAMERA_MAX_PHI = CAMERA_LOWEST_PHI; // halt the downward sweep right above the cue while still enabling the lower AI cue height for players
// Bring the cue camera in closer so the player view sits right against the rail on portrait screens.
const PLAYER_CAMERA_DISTANCE_FACTOR = 0.0165; // pull the player orbit nearer to the cloth while keeping the frame airy
const BROADCAST_RADIUS_LIMIT_MULTIPLIER = 1.14;
// Bring the standing/broadcast framing closer to the cloth so the table feels less distant while matching the rail proximity of the pocket cams
const BROADCAST_DISTANCE_MULTIPLIER = 0.06;
// Allow portrait/landscape standing camera framing to pull in closer without clipping the table
const STANDING_VIEW_MARGIN_LANDSCAPE = 1.0013;
const STANDING_VIEW_MARGIN_PORTRAIT = 1.0011;
const BROADCAST_RADIUS_PADDING = TABLE.THICK * 0.02;
const BROADCAST_PAIR_MARGIN = BALL_R * 5; // keep the cue/target pair safely framed within the broadcast crop
const BROADCAST_ORBIT_FOCUS_BIAS = 0.6; // prefer the orbit camera's subject framing when updating broadcast heads
const CAMERA_ZOOM_PROFILES = Object.freeze({
  default: Object.freeze({ cue: 0.86, broadcast: 0.9, margin: 0.97 }),
  nearLandscape: Object.freeze({ cue: 0.84, broadcast: 0.88, margin: 0.97 }),
  landscape: Object.freeze({ cue: 0.82, broadcast: 0.86, margin: 0.965 }),
  portrait: Object.freeze({ cue: 0.82, broadcast: 0.88, margin: 0.96 }),
  ultraPortrait: Object.freeze({ cue: 0.8, broadcast: 0.87, margin: 0.955 })
});
const resolveCameraZoomProfile = (aspect) => {
  if (!Number.isFinite(aspect)) {
    return CAMERA_ZOOM_PROFILES.default;
  }
  if (aspect >= 1.35) {
    return CAMERA_ZOOM_PROFILES.landscape;
  }
  if (aspect >= 1.1) {
    return CAMERA_ZOOM_PROFILES.nearLandscape;
  }
  if (aspect <= 0.7) {
    return CAMERA_ZOOM_PROFILES.ultraPortrait;
  }
  if (aspect <= 0.85) {
    return CAMERA_ZOOM_PROFILES.portrait;
  }
  return CAMERA_ZOOM_PROFILES.default;
};
const CAMERA = {
  fov: STANDING_VIEW_FOV,
  near: 0.04,
  far: 4000,
  minR: 18 * TABLE_SCALE * GLOBAL_SIZE_FACTOR * PLAYER_CAMERA_DISTANCE_FACTOR,
  maxR: 260 * TABLE_SCALE * GLOBAL_SIZE_FACTOR * BROADCAST_RADIUS_LIMIT_MULTIPLIER,
  minPhi: CAMERA_MIN_PHI,
  // keep the camera slightly above the horizontal plane but allow a lower sweep
  maxPhi: CAMERA_MAX_PHI
};
const CAMERA_CUSHION_CLEARANCE = TABLE.THICK * 0.6; // keep orbit height safely above cushion lip while hugging the rail
const AIM_LINE_MIN_Y = CUE_Y; // ensure the orbit never dips below the aiming line height
const CAMERA_AIM_LINE_MARGIN = BALL_R * 0.075; // keep extra clearance above the aim line for the tighter orbit distance
const AIM_LINE_WIDTH = Math.max(1, BALL_R * 0.12); // compensate for the 20% smaller cue ball when rendering the guide
const AIM_TICK_HALF_LENGTH = Math.max(0.6, BALL_R * 0.975); // keep the impact tick proportional to the cue ball
const AIM_DASH_SIZE = Math.max(0.45, BALL_R * 0.75);
const AIM_GAP_SIZE = Math.max(0.45, BALL_R * 0.5);
const STANDING_VIEW = Object.freeze({
  phi: STANDING_VIEW_PHI,
  margin: STANDING_VIEW_MARGIN
});
const STANDING_VIEW_COT = (() => {
  const sinPhi = Math.sin(STANDING_VIEW_PHI);
  return sinPhi > 1e-6 ? Math.cos(STANDING_VIEW_PHI) / sinPhi : 0;
})();
const DEFAULT_RAIL_LIMIT_X = PLAY_W / 2 - BALL_R - CUSHION_FACE_INSET;
const DEFAULT_RAIL_LIMIT_Y = PLAY_H / 2 - BALL_R - CUSHION_FACE_INSET;
let RAIL_LIMIT_X = DEFAULT_RAIL_LIMIT_X;
let RAIL_LIMIT_Y = DEFAULT_RAIL_LIMIT_Y;
const RAIL_LIMIT_PADDING = 0.1;
const BREAK_VIEW = Object.freeze({
  radius: CAMERA.minR, // start the intro framing closer to the table surface
  phi: CAMERA.maxPhi - 0.01
});
const CAMERA_RAIL_SAFETY = 0.006;
const TOP_VIEW_MARGIN = 1.15; // lift the top view slightly to keep both near pockets visible on portrait
const TOP_VIEW_MIN_RADIUS_SCALE = 1.08; // raise the camera a touch to ensure full end-rail coverage
const TOP_VIEW_PHI = Math.max(CAMERA_ABS_MIN_PHI * 0.45, CAMERA.minPhi * 0.22); // reduce angle toward a flatter overhead
const TOP_VIEW_RADIUS_SCALE = 1.26; // lift the 2D top view slightly higher so the overhead camera clears the rails on portrait
const TOP_VIEW_RESOLVED_PHI = Math.max(TOP_VIEW_PHI, CAMERA_ABS_MIN_PHI * 0.5);
const TOP_VIEW_SCREEN_OFFSET = Object.freeze({
  x: -PLAY_W * 0.015, // bias the top view so the table sits a touch higher on screen
  z: -PLAY_H * 0.012 // bias the top view so the table sits slightly more to the left
});
// Keep the rail overhead broadcast framing nearly identical to the 2D top view while
// leaving a small tilt for depth cues.
const RAIL_OVERHEAD_PHI = TOP_VIEW_RESOLVED_PHI; // align broadcast overhead with the 2D top-view angle
const BROADCAST_MARGIN_WIDTH = (PLAY_W / 2) * (TOP_VIEW_MARGIN - 1);
const BROADCAST_MARGIN_LENGTH = (PLAY_H / 2) * (TOP_VIEW_MARGIN - 1);
const computeTopViewBroadcastDistance = (aspect = 1, fov = STANDING_VIEW_FOV) => {
  const verticalFov = THREE.MathUtils.degToRad(fov || STANDING_VIEW_FOV);
  const halfVertical = Math.max(verticalFov / 2, 1e-3);
  const halfHorizontal = Math.max(Math.atan(Math.tan(halfVertical) * aspect), 1e-3);
  const halfWidth = PLAY_W / 2 + BROADCAST_MARGIN_WIDTH;
  const halfLength = PLAY_H / 2 + BROADCAST_MARGIN_LENGTH;
  const widthDistance = (halfWidth / Math.tan(halfHorizontal)) * TOP_VIEW_RADIUS_SCALE;
  const lengthDistance = (halfLength / Math.tan(halfVertical)) * TOP_VIEW_RADIUS_SCALE;
  return Math.max(widthDistance, lengthDistance);
};
const RAIL_OVERHEAD_DISTANCE_BIAS = 0.9; // pull the broadcast overhead camera closer to the table like the original framing
const SHORT_RAIL_CAMERA_DISTANCE =
  computeTopViewBroadcastDistance() * RAIL_OVERHEAD_DISTANCE_BIAS; // match the 2D top view framing distance for overhead rail cuts while keeping a touch of breathing room
const SIDE_RAIL_CAMERA_DISTANCE = SHORT_RAIL_CAMERA_DISTANCE; // keep side-rail framing aligned with the top view scale
const CUE_VIEW_RADIUS_RATIO = 0.024; // tighten cue camera distance so the cue ball and object ball appear larger
const CUE_VIEW_MIN_RADIUS = CAMERA.minR * 0.09;
const CUE_VIEW_MIN_PHI = Math.min(
  CAMERA.maxPhi - CAMERA_RAIL_SAFETY,
  STANDING_VIEW_PHI + 0.26
);
const CUE_VIEW_PHI_LIFT = 0.075; // nudge the cue camera lower so the stroke and cue pull stay in frame
const CUE_VIEW_TARGET_PHI = CUE_VIEW_MIN_PHI + CUE_VIEW_PHI_LIFT * 0.5;
const CAMERA_RAIL_APPROACH_PHI = Math.min(
  STANDING_VIEW_PHI + 0.32,
  CAMERA_LOWEST_PHI - 0.18
); // ensure rail clamp activates within the lowered camera tilt limit even with the deeper cue view
const CAMERA_MIN_HORIZONTAL =
  ((Math.max(PLAY_W, PLAY_H) / 2 + SIDE_RAIL_INNER_THICKNESS) * WORLD_SCALE) +
  CAMERA_RAIL_SAFETY;
const CAMERA_DOWNWARD_PULL = 1.9;
const CAMERA_DYNAMIC_PULL_RANGE = CAMERA.minR * 0.29;
const CAMERA_TILT_ZOOM = BALL_R * 1.5;
// Keep the orbit camera from slipping beneath the cue when dragged downwards.
const CAMERA_SURFACE_STOP_MARGIN = BALL_R * 1.3;
const IN_HAND_CAMERA_RADIUS_MULTIPLIER = 1.38; // pull the orbit back while the cue ball is in-hand for a wider placement view
// When pushing the camera below the cue height, translate forward instead of dipping beneath the cue.
const CUE_VIEW_FORWARD_SLIDE_MAX = CAMERA.minR * 0.22; // nudge forward slightly at the floor of the cue view, then stop
const CUE_VIEW_FORWARD_SLIDE_BLEND_FADE = 0.32;
const CUE_VIEW_FORWARD_SLIDE_RESET_BLEND = 0.45;
const CUE_VIEW_AIM_SLOW_FACTOR = 0.35; // slow pointer rotation while blended toward cue view for finer aiming
const CUE_VIEW_AIM_LINE_LERP = 0.1; // aiming line interpolation factor while the camera is near cue view
const STANDING_VIEW_AIM_LINE_LERP = 0.2; // aiming line interpolation factor while the camera is near standing view
const RAIL_OVERHEAD_AIM_ZOOM = 0.94; // gently pull the rail overhead view closer for middle-pocket aims
const RAIL_OVERHEAD_AIM_PHI_LIFT = 0.04; // add a touch more overhead bias while holding the rail angle
const BACKSPIN_DIRECTION_PREVIEW = 0.68; // lerp strength that pulls the cue-ball follow line toward a draw path
const AIM_SPIN_PREVIEW_SIDE = 0.22;
const AIM_SPIN_PREVIEW_FORWARD = 0.12;
const POCKET_VIEW_SMOOTH_TIME = 0.24; // seconds to ease pocket camera transitions
const POCKET_CAMERA_FOV = STANDING_VIEW_FOV;
const LONG_SHOT_DISTANCE = PLAY_H * 0.5;
const LONG_SHOT_ACTIVATION_DELAY_MS = 220;
const LONG_SHOT_ACTIVATION_TRAVEL = PLAY_H * 0.28;
const LONG_SHOT_SPEED_SWITCH_THRESHOLD =
  SHOT_BASE_SPEED * 0.82; // skip long-shot cam switch if cue ball launches faster
const LONG_SHOT_SHORT_RAIL_OFFSET = BALL_R * 18;
const GOOD_SHOT_REPLAY_DELAY_MS = 900;
const REPLAY_TRANSITION_LEAD_MS = 420;
const REPLAY_SLATE_DURATION_MS = 1200;
const REPLAY_TIMEOUT_GRACE_MS = 750;
const POWER_REPLAY_THRESHOLD = 0.78;
const SPIN_REPLAY_THRESHOLD = 0.32;
const AI_CUE_PULLBACK_DURATION_MS = 2500;
const AI_CUE_FORWARD_DURATION_MS = 2500;
const AI_STROKE_VISIBLE_DURATION_MS =
  AI_CUE_PULLBACK_DURATION_MS + AI_CUE_FORWARD_DURATION_MS;
const AI_CAMERA_POST_STROKE_HOLD_MS = 2000;
const AI_POST_SHOT_CAMERA_HOLD_MS = AI_STROKE_VISIBLE_DURATION_MS + AI_CAMERA_POST_STROKE_HOLD_MS;
const SHOT_CAMERA_HOLD_MS = 2000;
const REPLAY_BANNER_VARIANTS = {
  long: ['Long pot!', 'Full-table finish!', 'Cross-table clearance!'],
  bank: ['Banked clean!', 'Rail-first beauty!', 'Cushion wizardry!'],
  multi: ['Double pot!', 'Two for one!', 'What a combo!'],
  power: ['Power drive!', 'Thunder break!', 'Crushed it!'],
  spin: ['Swerve magic!', 'Spin control!', 'Curved in!'],
  default: ['Good shot!', 'Nice pot!', 'Great touch!']
};
const REPLAY_TRAIL_HEIGHT = BALL_CENTER_Y + BALL_R * 0.3;
const REPLAY_TRAIL_COLOR = 0xffffff;
const REPLAY_CUE_RETURN_WINDOW_MS = 260;
const RAIL_NEAR_BUFFER = BALL_R * 3.5;
const SHORT_SHOT_CAMERA_DISTANCE = BALL_R * 24; // keep camera in standing view for close shots
const SHORT_RAIL_POCKET_TRIGGER =
  RAIL_LIMIT_Y - POCKET_VIS_R * 0.45; // request pocket cams as soon as play reaches the short rail mouths
const SHORT_RAIL_POCKET_INTENT_COOLDOWN_MS = 280;
const AI_MIN_SHOT_TIME_MS = 5000;
const AI_MAX_SHOT_TIME_MS = 7000;
const AI_MIN_AIM_PREVIEW_MS = 900;
const AI_EARLY_SHOT_DIFFICULTY = 120;
const AI_EARLY_SHOT_CUE_DISTANCE = PLAY_H * 0.55;
const AI_EARLY_SHOT_DELAY_MS = AI_MIN_SHOT_TIME_MS; // never bypass the full telegraphed aim window
const AI_THINKING_BUDGET_MS =
  AI_MAX_SHOT_TIME_MS - AI_MIN_AIM_PREVIEW_MS; // leave room for the cue preview while keeping decisions under 7 seconds
const AI_CAMERA_DROP_DURATION_MS = 480;
const AI_CAMERA_SETTLE_MS = 320; // allow time for the cue view to settle before firing
const AI_CAMERA_DROP_LEAD_MS =
  AI_CAMERA_DROP_DURATION_MS + AI_CAMERA_SETTLE_MS; // start lowering into cue view early enough to finish before the stroke begins
const AI_CUE_VIEW_HOLD_MS = 0;
// Ease the AI camera just partway toward cue view (still above the stick) so the shot preview
// lingers in a mid-angle frame for a few seconds before firing.
const AI_CAMERA_DROP_BLEND = 0.65;
const AI_STROKE_TIME_SCALE = 1.35;
const AI_STROKE_PULLBACK_FACTOR = 1.05;
const AI_CUE_PULL_VISIBILITY_BOOST = 1.34;
const AI_WARMUP_PULL_RATIO = 0.62;
const PLAYER_CUE_PULL_VISIBILITY_BOOST = 1.32;
const PLAYER_WARMUP_PULL_RATIO = 0.72;
const PLAYER_STROKE_TIME_SCALE = 1.28;
const PLAYER_FORWARD_SLOWDOWN = 1.2;
const PLAYER_STROKE_PULLBACK_FACTOR = 0.68;
const PLAYER_PULLBACK_MIN_SCALE = 1.1;
const MIN_PULLBACK_GAP = BALL_R * 0.5;
const CAMERA_SWITCH_MIN_HOLD_MS = 220;
const PORTRAIT_HUD_HORIZONTAL_NUDGE_PX = 76;
const REPLAY_CAMERA_SWITCH_THRESHOLD = BALL_R * 0.35;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const signed = (value, fallback = 1) =>
  value > 0 ? 1 : value < 0 ? -1 : fallback;
const resolveShortRailBroadcastDirection = ({
  pocketCenter = null,
  approachDir = null,
  ballPos = null,
  ballVel = null,
  fallback = 1
} = {}) => {
  const resolveComponent = (value, alt) =>
    Number.isFinite(value) && Math.abs(value) > 1e-4 ? signed(value, alt) : null;
  const fromPocket = resolveComponent(pocketCenter?.y, fallback);
  if (fromPocket != null) return fromPocket;
  const fromApproach = resolveComponent(approachDir?.y, fallback);
  if (fromApproach != null) return fromApproach;
  const fromBallPos = resolveComponent(ballPos?.y, fallback);
  if (fromBallPos != null) return fromBallPos;
  const fromBallVel = resolveComponent(ballVel?.y, fallback);
  if (fromBallVel != null) return fromBallVel;
  return signed(fallback, 1);
};
const resolveOppositeShortRailCamera = ({ cueBall = null, fallback = 1 } = {}) => {
  if (!cueBall) {
    return -signed(fallback, 1);
  }
  const references = [
    Number.isFinite(cueBall.pos?.y) ? cueBall.pos.y : null,
    Number.isFinite(cueBall.launchDir?.y) ? cueBall.launchDir.y : null,
    Number.isFinite(cueBall.vel?.y) ? cueBall.vel.y : null
  ];
  const meaningful = references.find(
    (value) => Number.isFinite(value) && Math.abs(value) > BALL_R * 0.1
  );
  if (meaningful != null) {
    return -signed(meaningful, fallback);
  }
  return -signed(fallback, 1);
};
const computeStandingViewHeight = (
  targetHeight,
  horizontalDistance,
  minHeight = TABLE_Y + TABLE.THICK,
  targetPhi = STANDING_VIEW_PHI
) => {
  if (!Number.isFinite(horizontalDistance) || horizontalDistance <= 0) {
    return Math.max(minHeight, targetHeight);
  }
  const liftCot = (() => {
    if (Math.abs(targetPhi - STANDING_VIEW_PHI) < 1e-6) return STANDING_VIEW_COT;
    const sinPhi = Math.sin(targetPhi);
    return sinPhi > 1e-6 ? Math.cos(targetPhi) / sinPhi : 0;
  })();
  const lift = horizontalDistance * liftCot;
  const desiredHeight = targetHeight + lift;
  return Math.max(minHeight, desiredHeight);
};
const applyStandingViewElevation = (
  desired,
  focus,
  minHeight = TABLE_Y + TABLE.THICK,
  targetPhi = STANDING_VIEW_PHI
) => {
  if (!desired || !focus) return;
  const horizontalDistance = Math.hypot(
    desired.x - focus.x,
    desired.z - focus.z
  );
  const targetHeight = focus.y;
  const minStandingHeight = computeStandingViewHeight(
    targetHeight,
    horizontalDistance,
    minHeight,
    targetPhi
  );
  if (desired.y < minStandingHeight) {
    desired.y = minStandingHeight;
  }
};
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
const TMP_VEC2_VIEW = new THREE.Vector2();
const TMP_VEC3_A = new THREE.Vector3();
const TMP_VEC3_BUTT = new THREE.Vector3();
const TMP_VEC3_CHALK = new THREE.Vector3();
const TMP_VEC3_CHALK_DELTA = new THREE.Vector3();
const TMP_VEC3_TOP_VIEW = new THREE.Vector3();
const TMP_VEC3_CAM_DIR = new THREE.Vector3();
const TMP_VEC3_CUE_DIR = new THREE.Vector3();
const CORNER_SIGNS = [
  { sx: -1, sy: -1 },
  { sx: 1, sy: -1 },
  { sx: -1, sy: 1 },
  { sx: 1, sy: 1 }
];
const fitRadius = (camera, margin = 1.1, distanceScale = 0.65) => {
  const a = camera.aspect,
    f = THREE.MathUtils.degToRad(camera.fov);
  const halfW = (TABLE.W / 2) * margin,
    halfH = (TABLE.H / 2) * margin;
  const dzH = halfH / Math.tan(f / 2);
  const dzW = halfW / (Math.tan(f / 2) * a);
  // Lean the standing radius closer to the cloth while preserving enough headroom to keep
  // the cushion tops in frame across aspect ratios.
  const r = Math.max(dzH, dzW) * distanceScale * GLOBAL_SIZE_FACTOR;
  return clamp(r, CAMERA.minR, CAMERA.maxR);
};
const lerpAngle = (start = 0, end = 0, t = 0.5) => {
  const delta = Math.atan2(Math.sin(end - start), Math.cos(end - start));
  return start + delta * THREE.MathUtils.clamp(t ?? 0, 0, 1);
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
const SPIN_INPUT_DEAD_ZONE = 0.06;
const SPIN_CUSHION_EPS = BALL_R * 0.5;

const clampToUnitCircle = (x, y) => {
  const L = Math.hypot(x, y);
  if (!Number.isFinite(L) || L <= 1) {
    return { x, y };
  }
  const scale = L > 1e-6 ? 1 / L : 0;
  return { x: x * scale, y: y * scale };
};

const prepareSpinAxes = (aimDir) => {
  if (!aimDir) {
    return {
      axis: new THREE.Vector2(0, 1),
      perp: new THREE.Vector2(1, 0)
    };
  }
  const axis = new THREE.Vector2(aimDir.x ?? 0, aimDir.y ?? 0);
  if (axis.lengthSq() < 1e-8) axis.set(0, 1);
  else axis.normalize();
  const perp = new THREE.Vector2(-axis.y, axis.x);
  if (perp.lengthSq() < 1e-8) perp.set(1, 0);
  else perp.normalize();
  return { axis, perp };
};

const computeCueViewVector = (cueBall, camera) => {
  if (!cueBall?.pos || !camera?.position) return null;
  const cx = camera.position.x - cueBall.pos.x;
  const cz = camera.position.z - cueBall.pos.y;
  TMP_VEC2_VIEW.set(cx, cz);
  if (TMP_VEC2_VIEW.lengthSq() < 1e-8) return null;
  return TMP_VEC2_VIEW.clone().normalize();
};

const computeShortRailBroadcastDistance = (camera) => {
  if (!camera) return SHORT_RAIL_CAMERA_DISTANCE;
  const required = computeTopViewBroadcastDistance(camera.aspect, camera.fov);
  return Math.max(SHORT_RAIL_CAMERA_DISTANCE, required);
};

const computeShortRailPairFraming = (camera, cuePos, targetPos = null, margin = BROADCAST_PAIR_MARGIN) => {
  if (!camera || !cuePos) {
    return null;
  }
  const verticalFov = THREE.MathUtils.degToRad(camera.fov || STANDING_VIEW_FOV);
  const aspect = camera.aspect || 1;
  const halfVertical = Math.max(verticalFov / 2, 1e-3);
  const halfHorizontal = Math.max(Math.atan(Math.tan(halfVertical) * aspect), 1e-3);
  const centerX = targetPos ? (cuePos.x + targetPos.x) * 0.5 : cuePos.x;
  const centerZ = targetPos ? (cuePos.y + targetPos.y) * 0.5 : cuePos.y;
  const safeMargin = Math.max(margin, BALL_R);
  let halfWidth = safeMargin;
  let halfLength = safeMargin;
  const accumulate = (pt) => {
    if (!pt) return;
    const dx = Math.abs(pt.x - centerX);
    const dz = Math.abs(pt.y - centerZ);
    if (dx + safeMargin > halfWidth) halfWidth = dx + safeMargin;
    if (dz + safeMargin > halfLength) halfLength = dz + safeMargin;
  };
  accumulate(cuePos);
  accumulate(targetPos);
  const widthDistance = halfWidth / Math.tan(halfHorizontal);
  const lengthDistance = halfLength / Math.tan(halfVertical);
  return {
    centerX,
    centerZ,
    halfWidth,
    halfLength,
    halfHorizontal,
    halfVertical,
    requiredDistance: Math.max(widthDistance, lengthDistance)
  };
};

function checkSpinLegality2D(cueBall, spinVec, balls = [], options = {}) {
  if (!cueBall || !cueBall.pos) {
    return { blocked: false, reason: '' };
  }
  const sx = spinVec?.x ?? 0;
  const sy = spinVec?.y ?? 0;
  const magnitude = Math.hypot(sx, sy);
  if (magnitude < SPIN_INPUT_DEAD_ZONE) {
    return { blocked: false, reason: '' };
  }
  const axes = options.axes;
  TMP_VEC2_SPIN.set(0, 0);
  if (axes?.perp) TMP_VEC2_SPIN.addScaledVector(axes.perp, sx);
  if (axes?.axis) TMP_VEC2_SPIN.addScaledVector(axes.axis, sy);
  if (!axes) TMP_VEC2_SPIN.set(sx, sy);
  if (TMP_VEC2_SPIN.lengthSq() < 1e-8) {
    return { blocked: false, reason: '' };
  }
  TMP_VEC2_SPIN.normalize();
  const contact = cueBall.pos
    .clone()
    .add(TMP_VEC2_SPIN.clone().multiplyScalar(BALL_R));
  const cushionClearX = RAIL_LIMIT_X - SPIN_CUSHION_EPS;
  const cushionClearY = RAIL_LIMIT_Y - SPIN_CUSHION_EPS;
  if (
    Math.abs(contact.x) > cushionClearX ||
    Math.abs(contact.y) > cushionClearY
  ) {
    return { blocked: true, reason: 'Cushion blocks that strike point' };
  }
  const view = options.view;
  if (view) {
    TMP_VEC2_LIMIT.set(view.x ?? 0, view.y ?? 0);
    if (TMP_VEC2_LIMIT.lengthSq() > 1e-8) {
      TMP_VEC2_LIMIT.normalize();
      if (TMP_VEC2_SPIN.dot(TMP_VEC2_LIMIT) <= 0) {
        return { blocked: true, reason: 'Contact point not visible' };
      }
    }
  }
  const blockingRadius = BALL_R + CUE_TIP_RADIUS * 1.05;
  const blockingRadiusSq = blockingRadius * blockingRadius;
  const combinedRadius = BALL_R * 2 + 0.003;
  for (const other of balls) {
    if (!other || other === cueBall || !other.active) continue;
    const offset = other.pos.clone().sub(cueBall.pos);
    const dist = offset.length();
    if (dist >= combinedRadius) continue;
    const proj = offset.dot(TMP_VEC2_SPIN);
    if (!(proj > 0)) continue;
    const lateralSq = Math.max(offset.lengthSq() - proj * proj, 0);
    if (lateralSq < blockingRadiusSq) {
      return { blocked: true, reason: 'Another ball blocks that side' };
    }
  }
  return { blocked: false, reason: '' };
}

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

function applyAxisClearance(
  limits,
  key,
  positive,
  clearance,
  { margin = SPIN_TIP_MARGIN, soft = false } = {}
) {
  if (!Number.isFinite(clearance)) return;
  if (soft) {
    const total = MAX_SPIN_CONTACT_OFFSET + margin;
    if (total <= 0) return;
    if (clearance <= 0) {
      if (positive) {
        if (key === 'maxX') limits.maxX = Math.min(limits.maxX, 0);
        if (key === 'maxY') limits.maxY = Math.min(limits.maxY, 0);
      } else {
        if (key === 'minX') limits.minX = Math.max(limits.minX, 0);
        if (key === 'minY') limits.minY = Math.max(limits.minY, 0);
      }
      return;
    }
    const normalized = clamp(clearance / total, 0, 1);
    if (positive) {
      if (key === 'maxX') limits.maxX = Math.min(limits.maxX, normalized);
      if (key === 'maxY') limits.maxY = Math.min(limits.maxY, normalized);
    } else {
      const limit = -normalized;
      if (key === 'minX') limits.minX = Math.max(limits.minX, limit);
      if (key === 'minY') limits.minY = Math.max(limits.minY, limit);
    }
    return;
  }
  const safeClearance = clearance - margin;
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

function computeSpinLimits(cueBall, aimDir, balls = [], axesInput = null) {
  if (!cueBall || !aimDir) return { ...DEFAULT_SPIN_LIMITS };
  const spinAxes = axesInput || prepareSpinAxes(aimDir);
  const forward = spinAxes.axis;
  const lateral = spinAxes.perp;
  const axes = [
    { key: 'maxX', dir: lateral.clone(), positive: true },
    { key: 'minX', dir: lateral.clone().multiplyScalar(-1), positive: false },
    { key: 'minY', dir: forward.clone(), positive: false },
    { key: 'maxY', dir: forward.clone().multiplyScalar(-1), positive: true }
  ];
  const limits = { ...DEFAULT_SPIN_LIMITS };
  const cueCenter = new THREE.Vector2(cueBall.pos.x, cueBall.pos.y);
  const combinedRadius = BALL_R * 2 + CUE_TIP_RADIUS * 1.1;
  const combinedRadiusSq = combinedRadius * combinedRadius;

  for (const axis of axes) {
    const centerToEdge = distanceToTableEdge(cueBall.pos, axis.dir);
    if (centerToEdge !== Infinity) {
      const clearance = centerToEdge - BALL_R;
      applyAxisClearance(limits, axis.key, axis.positive, clearance, {
        soft: true,
        margin: SPIN_TIP_MARGIN * 0.75
      });
    }
    let nearest = Infinity;
    for (const other of balls) {
      if (!other || other === cueBall || !other.active) continue;
      const otherPos = new THREE.Vector2(other.pos.x, other.pos.y);
      const offset = otherPos.sub(cueCenter);
      const proj = offset.dot(axis.dir);
      if (!(proj > 0)) continue;
      const offsetSq = offset.lengthSq();
      const lateralSq = Math.max(offsetSq - proj * proj, 0);
      if (lateralSq >= combinedRadiusSq) continue;
      const penetration = Math.sqrt(Math.max(combinedRadiusSq - lateralSq, 0));
      const clearance = proj - penetration;
      if (clearance < nearest) nearest = clearance;
    }
    if (nearest !== Infinity) {
      applyAxisClearance(limits, axis.key, axis.positive, nearest);
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

const cornerPocketCenter = (sx, sz) =>
  new THREE.Vector2(
    sx * (PLAY_W / 2 - CORNER_POCKET_CENTER_INSET),
    sz * (PLAY_H / 2 - CORNER_POCKET_CENTER_INSET)
  );
let sidePocketShift = 0;
const pocketCenters = () => {
  const sidePocketCenterX = PLAY_W / 2 + sidePocketShift;
  return [
    cornerPocketCenter(-1, -1),
    cornerPocketCenter(1, -1),
    cornerPocketCenter(-1, 1),
    cornerPocketCenter(1, 1),
    new THREE.Vector2(-sidePocketCenterX, 0),
    new THREE.Vector2(sidePocketCenterX, 0)
  ];
};
const pocketEntranceCenters = () =>
  pocketCenters().map((center, index) => {
    const mouthRadius = index >= 4 ? SIDE_POCKET_RADIUS : POCKET_VIS_R;
    const towardField = center.clone().multiplyScalar(-1);
    if (towardField.lengthSq() < MICRO_EPS * MICRO_EPS) {
      return center.clone();
    }
    towardField.normalize();
    const entranceOffset = mouthRadius * 0.6;
    return center.clone().add(towardField.multiplyScalar(entranceOffset));
  });
const resolvePocketHolderDirection = (center, pocketId = null) => {
  const absX = Math.abs(center?.x ?? 0);
  const absZ = Math.abs(center?.y ?? 0);
  const isMiddlePocket = pocketId === 'TM' || pocketId === 'BM' || absZ < BALL_R * 0.6;
  if (isMiddlePocket) {
    // Turn the middle-pocket holders to run along the rail like the corner trays instead of jutting outward.
    const zDir =
      pocketId === 'TM'
        ? -1
        : pocketId === 'BM'
        ? 1
          : Math.sign(center?.y || 1) || 1;
    return new THREE.Vector3(0, 0, zDir);
  }
  const zDir = -Math.sign(center?.y || 1) || -1;
  const sidePull = Math.sign(center?.x || 1) * 0.2;
  const towardMiddlePocketSide = new THREE.Vector3(sidePull, 0, zDir);
  if (towardMiddlePocketSide.lengthSq() > MICRO_EPS * MICRO_EPS) {
    return towardMiddlePocketSide.normalize();
  }
  const outward = new THREE.Vector3(center?.x ?? 0, 0, center?.y ?? 0);
  if (outward.lengthSq() > MICRO_EPS * MICRO_EPS) {
    return outward.normalize();
  }
  if (absX >= absZ) {
    return new THREE.Vector3(Math.sign(center?.x || 1), 0, 0);
  }
  return new THREE.Vector3(0, 0, Math.sign(center?.y || 1));
};
const POCKET_IDS = ['TL', 'TR', 'BL', 'BR', 'TM', 'BM'];
const POCKET_LABELS = Object.freeze({
  TL: 'Top Left',
  TR: 'Top Right',
  BL: 'Bottom Left',
  BR: 'Bottom Right',
  TM: 'Top Middle',
  BM: 'Bottom Middle',
  SAFETY: 'Safety'
});
const formatPocketLabel = (id) => POCKET_LABELS[id] || id || '';
const BALL_LABELS = Object.freeze({
  RED: 'Red',
  YELLOW: 'Yellow',
  GREEN: 'Green',
  BROWN: 'Brown',
  BLUE: 'Blue',
  PINK: 'Pink',
  BLACK: 'Black',
  CUE: 'Cue'
});
const formatBallLabel = (colorId) => {
  if (!colorId) return '';
  return BALL_LABELS[colorId] || colorId.charAt(0) + colorId.slice(1).toLowerCase();
};
const getPocketCenterById = (id) => {
  switch (id) {
    case 'TL':
      return cornerPocketCenter(-1, -1);
    case 'TR':
      return cornerPocketCenter(1, -1);
    case 'BL':
      return cornerPocketCenter(-1, 1);
    case 'BR':
      return cornerPocketCenter(1, 1);
    case 'TM':
      return new THREE.Vector2(-(PLAY_W / 2 + sidePocketShift), 0);
    case 'BM':
      return new THREE.Vector2(PLAY_W / 2 + sidePocketShift, 0);
    default:
      return null;
  }
};
const POCKET_CAMERA_IDS = ['TL', 'TR', 'BL', 'BR'];
const POCKET_CAMERA_OUTWARD = Object.freeze({
  TL: new THREE.Vector2(-1, -1).normalize(),
  TR: new THREE.Vector2(1, -1).normalize(),
  BL: new THREE.Vector2(-0.72, 1).normalize(),
  BR: new THREE.Vector2(0.72, 1).normalize()
});
const getPocketCameraOutward = (id) =>
  POCKET_CAMERA_OUTWARD[id] ? POCKET_CAMERA_OUTWARD[id].clone() : null;
const resolvePocketCameraAnchor = (pocketId, center, approachDir, ballPos) => {
  if (!pocketId) return null;
  switch (pocketId) {
    case 'TL':
    case 'TR':
    case 'BL':
    case 'BR':
      return pocketId;
    case 'TM': {
      const ballY = ballPos?.y ?? 0;
      if (ballY > 0.01) return 'BL';
      if (ballY < -0.01) return 'TL';
      const dirY = approachDir?.y ?? 0;
      return dirY >= 0 ? 'BL' : 'TL';
    }
    case 'BM': {
      const ballY = ballPos?.y ?? 0;
      if (ballY > 0.01) return 'BR';
      if (ballY < -0.01) return 'TR';
      const dirY = approachDir?.y ?? 0;
      return dirY >= 0 ? 'BR' : 'TR';
    }
    default:
      return pocketId;
  }
};
const pocketIdFromCenter = (center) => {
  const epsilon = BALL_R * 0.2;
  if (Math.abs(center.y) < epsilon) {
    return center.x < 0 ? 'TM' : 'BM';
  }
  if (center.y < 0) {
    return center.x < 0 ? 'TL' : 'TR';
  }
  return center.x < 0 ? 'BL' : 'BR';
};
const allStopped = (balls) => balls.every((b) => b.vel.length() < STOP_EPS);

function makeClothTexture(
  palette = TABLE_FINISHES[DEFAULT_TABLE_FINISH_ID]?.colors
) {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const clothColor = new THREE.Color(palette?.cloth ?? 0x2b7e4f);
  const baseCloth = `#${clothColor.getHexString()}`;
  ctx.fillStyle = baseCloth;
  ctx.fillRect(0, 0, size, size);

  const diagonalShade = ctx.createLinearGradient(0, 0, size, size);
  diagonalShade.addColorStop(0, 'rgba(255,255,255,0.05)');
  diagonalShade.addColorStop(0.6, 'rgba(0,0,0,0.1)');
  diagonalShade.addColorStop(1, 'rgba(0,0,0,0.16)');
  ctx.fillStyle = diagonalShade;
  ctx.fillRect(0, 0, size, size);

  const threadStep = 4 * 1.3; // widen spacing so the thread pattern reads ~30% larger
  ctx.lineWidth = 0.78;
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  for (let x = -threadStep; x < size + threadStep; x += threadStep) {
    ctx.beginPath();
    ctx.moveTo(x + threadStep * 0.35, 0);
    ctx.lineTo(x + threadStep * 0.35, size);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.24)';
  for (let y = -threadStep; y < size + threadStep; y += threadStep) {
    ctx.beginPath();
    ctx.moveTo(0, y + threadStep * 0.6);
    ctx.lineTo(size, y + threadStep * 0.6);
    ctx.stroke();
  }

  const weaveSpacing = 2 * 1.3;
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  for (let y = 0; y < size; y += weaveSpacing) {
    const offset = (y / weaveSpacing) % 2 === 0 ? 0 : weaveSpacing * 0.5;
    for (let x = 0; x < size; x += weaveSpacing) {
      ctx.fillRect(x + offset, y, 0.9, 1.2);
    }
  }
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  for (let x = 0; x < size; x += weaveSpacing) {
    const offset = (x / weaveSpacing) % 2 === 0 ? 0 : weaveSpacing * 0.5;
    for (let y = 0; y < size; y += weaveSpacing) {
      ctx.fillRect(x, y + offset, 1.2, 0.9);
    }
  }

  ctx.lineWidth = 0.4;
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  for (let i = 0; i < 210000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const horizontal = Math.random() > 0.5;
    const length = Math.random() * 0.72 + 0.32;
    ctx.beginPath();
    if (horizontal) {
      ctx.moveTo(x - length / 2, y);
      ctx.lineTo(x + length / 2, y);
    } else {
      ctx.moveTo(x, y - length / 2);
      ctx.lineTo(x, y + length / 2);
    }
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.24)';
  for (let i = 0; i < 150000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const horizontal = Math.random() > 0.5;
    const length = Math.random() * 0.62 + 0.22;
    ctx.beginPath();
    if (horizontal) {
      ctx.moveTo(x - length / 2, y);
      ctx.lineTo(x + length / 2, y);
    } else {
      ctx.moveTo(x, y - length / 2);
      ctx.lineTo(x, y + length / 2);
    }
    ctx.stroke();
  }

  ctx.globalAlpha = 0.24;
  ctx.fillStyle = 'rgba(0,0,0,0.24)';
  for (let i = 0; i < 62000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.fillRect(x, y, 1.1, 1.1);
  }
  ctx.globalAlpha = 1;

  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 0.32;
  for (let i = 0; i < 48000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const length = Math.random() * 1.4 + 0.4;
    ctx.beginPath();
    ctx.moveTo(x - length * 0.3, y - length * 0.1);
    ctx.lineTo(x + length * 0.3, y + length * 0.1);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  const baseRepeat = 7.2;
  const repeatX = baseRepeat * (PLAY_W / TABLE.W);
  const repeatY = baseRepeat * (PLAY_H / TABLE.H);
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 48;
  applySRGBColorSpace(texture);
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
  applySRGBColorSpace(texture);
  texture.needsUpdate = true;
  return texture;
}
function reflectRails(ball) {
  const limX = RAIL_LIMIT_X;
  const limY = RAIL_LIMIT_Y;
  const cornerRad = THREE.MathUtils.degToRad(CUSHION_CUT_ANGLE);
  const cornerCos = Math.cos(cornerRad);
  const cornerSin = Math.sin(cornerRad);
  const pocketGuard = POCKET_GUARD_RADIUS;
  const guardClearance = POCKET_GUARD_CLEARANCE;
  const cornerDepthLimit = CORNER_POCKET_DEPTH_LIMIT;
  for (const { sx, sy } of CORNER_SIGNS) {
    TMP_VEC2_C.set(sx * limX, sy * limY);
    TMP_VEC2_B.set(-sx * cornerCos, -sy * cornerSin);
    TMP_VEC2_A.copy(ball.pos).sub(TMP_VEC2_C);
    const distNormal = TMP_VEC2_A.dot(TMP_VEC2_B);
    if (distNormal >= BALL_R) continue;
    TMP_VEC2_D.set(-TMP_VEC2_B.y, TMP_VEC2_B.x);
    const lateral = Math.abs(TMP_VEC2_A.dot(TMP_VEC2_D));
    if (lateral < guardClearance) continue;
    if (distNormal < -cornerDepthLimit) continue;
    const push = BALL_R - distNormal;
    ball.pos.addScaledVector(TMP_VEC2_B, push);
    const vn = ball.vel.dot(TMP_VEC2_B);
    if (vn < 0) {
      const restitution = CUSHION_RESTITUTION;
      ball.vel.addScaledVector(TMP_VEC2_B, -(1 + restitution) * vn);
      const vt = TMP_VEC2_D.copy(ball.vel).sub(
        TMP_VEC2_B.clone().multiplyScalar(ball.vel.dot(TMP_VEC2_B))
      );
      const tangentDamping = 0.96;
      ball.vel
        .sub(vt)
        .add(vt.multiplyScalar(tangentDamping));
    }
    if (ball.spin?.lengthSq() > 0) {
      applySpinImpulse(ball, 0.6);
    }
    const stamp =
      typeof performance !== 'undefined' && performance.now
        ? performance.now()
        : Date.now();
    ball.lastRailHitAt = stamp;
    ball.lastRailHitType = 'corner';
    return {
      type: 'corner',
      normal: TMP_VEC2_B.clone(),
      tangent: TMP_VEC2_D.clone()
    };
  }

  const sideSpan = SIDE_POCKET_SPAN;
  const sidePocketGuard = SIDE_POCKET_GUARD_RADIUS;
  const sideGuardClearance = SIDE_POCKET_GUARD_CLEARANCE;
  const sideDepthLimit = SIDE_POCKET_DEPTH_LIMIT;
  const sidePocketCenters = pocketCenters().slice(4);
  for (const center of sidePocketCenters) {
    TMP_VEC2_A.copy(ball.pos).sub(center);
    TMP_VEC2_C.copy(center).multiplyScalar(-1);
    if (TMP_VEC2_C.lengthSq() < MICRO_EPS * MICRO_EPS) {
      TMP_VEC2_C.set(center.x >= 0 ? -1 : 1, 0);
    }
    TMP_VEC2_C.normalize();
    const normal = TMP_VEC2_C;
    const tangent = TMP_VEC2_D.set(-normal.y, normal.x);
    const distNormal = TMP_VEC2_A.dot(normal);
    if (distNormal >= BALL_R) continue;
    const lateral = Math.abs(TMP_VEC2_A.dot(tangent));
    if (lateral < sideGuardClearance) continue;
    if (lateral <= sideSpan) continue;
    if (distNormal < -sideDepthLimit) continue;
    const push = BALL_R - distNormal;
    ball.pos.addScaledVector(normal, push);
    const vn = ball.vel.dot(normal);
    if (vn < 0) {
      const restitution = CUSHION_RESTITUTION;
      ball.vel.addScaledVector(normal, -(1 + restitution) * vn);
      TMP_VEC2_LIMIT.copy(normal).multiplyScalar(ball.vel.dot(normal));
      const vt = TMP_VEC2_B.copy(ball.vel).sub(
        TMP_VEC2_LIMIT
      );
      const tangentDamping = 0.96;
      ball.vel
        .sub(vt)
        .add(vt.multiplyScalar(tangentDamping));
    }
    if (ball.spin?.lengthSq() > 0) {
      applySpinImpulse(ball, 0.6);
    }
    const stamp =
      typeof performance !== 'undefined' && performance.now
        ? performance.now()
        : Date.now();
    ball.lastRailHitAt = stamp;
    ball.lastRailHitType = 'rail';
    return {
      type: 'rail',
      normal: normal.clone(),
      tangent: tangent.clone()
    };
  }

  // If the ball is entering a pocket capture zone, skip straight rail reflections
  const nearPocketRadius =
    Math.max(CAPTURE_R, SIDE_CAPTURE_R) + BALL_R * 0.22;
  const nearPocket = pocketCenters().some(
    (c) => ball.pos.distanceTo(c) < nearPocketRadius
  );
  if (nearPocket) return null;
  let collided = null;
  let collisionNormal = null;
  if (ball.pos.x < -limX && ball.vel.x < 0) {
    const overshoot = -limX - ball.pos.x;
    ball.pos.x = -limX + overshoot;
    ball.vel.x = Math.abs(ball.vel.x) * CUSHION_RESTITUTION;
    collided = 'rail';
    collisionNormal = new THREE.Vector2(1, 0);
  }
  if (ball.pos.x > limX && ball.vel.x > 0) {
    const overshoot = ball.pos.x - limX;
    ball.pos.x = limX - overshoot;
    ball.vel.x = -Math.abs(ball.vel.x) * CUSHION_RESTITUTION;
    collided = 'rail';
    collisionNormal = new THREE.Vector2(-1, 0);
  }
  if (ball.pos.y < -limY && ball.vel.y < 0) {
    const overshoot = -limY - ball.pos.y;
    ball.pos.y = -limY + overshoot;
    ball.vel.y = Math.abs(ball.vel.y) * CUSHION_RESTITUTION;
    collided = 'rail';
    collisionNormal = new THREE.Vector2(0, 1);
  }
  if (ball.pos.y > limY && ball.vel.y > 0) {
    const overshoot = ball.pos.y - limY;
    ball.pos.y = limY - overshoot;
    ball.vel.y = -Math.abs(ball.vel.y) * CUSHION_RESTITUTION;
    collided = 'rail';
    collisionNormal = new THREE.Vector2(0, -1);
  }
  if (collided) {
    const stamp =
      typeof performance !== 'undefined' && performance.now
        ? performance.now()
        : Date.now();
    ball.lastRailHitAt = stamp;
    ball.lastRailHitType = collided;
  }
  if (collided) {
    const normal = collisionNormal ?? new THREE.Vector2(0, 1);
    const tangent = new THREE.Vector2(-normal.y, normal.x);
    return { type: collided, normal, tangent };
  }
  return null;
}

function applySpinImpulse(ball, scale = 1) {
  if (!ball?.spin) return false;
  if (ball.spin.lengthSq() < 1e-6) return false;
  const speed = Math.max(ball.vel.length(), 0.25);
  const forward =
    speed > 1e-6
      ? TMP_VEC2_FORWARD.copy(ball.vel).normalize()
      : TMP_VEC2_FORWARD.set(0, 1);
  const lateral = TMP_VEC2_LATERAL.set(-forward.y, forward.x);
  const sideSpin = ball.spin.x || 0;
  const verticalSpin = ball.spin.y || 0;
  const swerveScale = 0.65 + Math.min(speed, 8) * 0.12;
  const liftScale = 0.35 + Math.min(speed, 6) * 0.08;
  const lateralKick = sideSpin * SPIN_STRENGTH * swerveScale * scale;
  const forwardKick = verticalSpin * SPIN_STRENGTH * liftScale * scale * 0.5;
  if (Math.abs(lateralKick) > 1e-8) {
    ball.vel.addScaledVector(lateral, lateralKick);
  }
  if (Math.abs(forwardKick) > 1e-8) {
    ball.vel.addScaledVector(forward, forwardKick);
  }
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

function applyRailSpinResponse(ball, impact) {
  if (!ball?.spin || ball.spin.lengthSq() < 1e-6 || !impact?.normal) return;
  const normal = impact.normal.clone().normalize();
  const tangent = impact.tangent?.clone() ?? new THREE.Vector2(-normal.y, normal.x);
  const speed = Math.max(ball.vel.length(), 0);
  const preImpactSpin = ball.spin.clone();
  const throwFactor = Math.max(
    0,
    Math.min(speed / Math.max(RAIL_SPIN_THROW_REF_SPEED, 1e-6), 1.4)
  );
  const spinAlongTangent = preImpactSpin.dot(tangent);
  if (Math.abs(spinAlongTangent) > 1e-6) {
    const throwStrength = spinAlongTangent * RAIL_SPIN_THROW_SCALE * (0.35 + throwFactor);
    ball.vel.addScaledVector(tangent, throwStrength);
  }
  ball.spin.copy(preImpactSpin);
  applySpinImpulse(ball, 0.6);
}

// calculate impact point and post-collision direction for aiming guide
function calcTarget(cue, dir, balls) {
  if (!cue) {
    return {
      impact: new THREE.Vector2(),
      targetDir: null,
      cueDir: null,
      targetBall: null,
      railNormal: null,
      tHit: 0
    };
  }
  const cuePos = cue.pos.clone();
  if (!dir || dir.lengthSq() < 1e-8) {
    return {
      impact: cuePos.clone(),
      targetDir: null,
      cueDir: null,
      targetBall: null,
      railNormal: null,
      tHit: 0
    };
  }
  const dirNorm = dir.clone().normalize();
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
  if (dirNorm.x < -1e-8)
    checkRail((-limX - cuePos.x) / dirNorm.x, new THREE.Vector2(1, 0));
  if (dirNorm.x > 1e-8)
    checkRail((limX - cuePos.x) / dirNorm.x, new THREE.Vector2(-1, 0));
  if (dirNorm.y < -1e-8)
    checkRail((-limY - cuePos.y) / dirNorm.y, new THREE.Vector2(0, 1));
  if (dirNorm.y > 1e-8)
    checkRail((limY - cuePos.y) / dirNorm.y, new THREE.Vector2(0, -1));

  const contactRadius = BALL_R * 2;
  const contactRadius2 = contactRadius * contactRadius;
  const ballList = Array.isArray(balls) ? balls : [];
  ballList.forEach((b) => {
    if (!b.active || b === cue) return;
    const v = b.pos.clone().sub(cuePos);
    const proj = v.dot(dirNorm);
    if (proj <= 0) return;
    const perp2 = v.lengthSq() - proj * proj;
    if (perp2 > contactRadius2) return;
    const thc = Math.sqrt(contactRadius2 - perp2);
    const t = proj - thc;
    if (t >= 0 && t < tHit) {
      tHit = t;
      targetBall = b;
      railNormal = null;
    }
  });

  const fallbackDistance = Math.sqrt(PLAY_W * PLAY_W + PLAY_H * PLAY_H);
  let travel = Number.isFinite(tHit) ? tHit : fallbackDistance;
  if (travel <= 0) {
    travel = fallbackDistance;
  }
  const impact = cuePos.clone().add(dirNorm.clone().multiplyScalar(travel));
  let targetDir = null;
  let cueDir = null;
  if (targetBall) {
    const contactNormal = targetBall.pos.clone().sub(impact);
    if (contactNormal.lengthSq() > 1e-8) contactNormal.normalize();
    else contactNormal.copy(dirNorm);
    targetDir = contactNormal.clone();
    const projected = dirNorm.dot(targetDir);
    cueDir = dirNorm.clone().sub(targetDir.clone().multiplyScalar(projected));
    if (cueDir.lengthSq() > 1e-8) cueDir.normalize();
    else cueDir = null;
  } else if (railNormal) {
    const n = railNormal.clone().normalize();
    cueDir = dirNorm
      .clone()
      .sub(n.clone().multiplyScalar(2 * dirNorm.dot(n)))
      .normalize();
  }
  return { impact, targetDir, cueDir, targetBall, railNormal, tHit: travel };
}

function Guret(parent, id, color, x, y, options = {}) {
  const pattern = options.pattern || (id === 'cue' ? 'cue' : 'solid');
  const number = options.number ?? null;
  const material = getBilliardBallMaterial({
    color,
    pattern,
    number,
    variantKey: 'pool'
  });
  const mesh = new THREE.Mesh(BALL_GEOMETRY, material);
  mesh.position.set(x, BALL_CENTER_Y, y);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  const shadow =
    ENABLE_BALL_FLOOR_SHADOWS && BALL_SHADOW_GEOMETRY && BALL_SHADOW_MATERIAL
      ? new THREE.Mesh(BALL_SHADOW_GEOMETRY, BALL_SHADOW_MATERIAL.clone())
      : null;
  if (shadow) {
    shadow.position.set(x, BALL_SHADOW_Y, y);
    shadow.renderOrder = (mesh.renderOrder ?? 0) - 0.5;
    shadow.matrixAutoUpdate = true;
    shadow.visible = true;
    shadow.userData = shadow.userData || {};
    shadow.userData.ballId = id;
  }
  mesh.traverse((node) => {
    node.userData = node.userData || {};
    node.userData.ballId = id;
  });
  parent.add(mesh);
  if (shadow) parent.add(shadow);
  return {
    id,
    color,
    mesh,
    shadow,
    pos: new THREE.Vector2(x, y),
    vel: new THREE.Vector2(),
    spin: new THREE.Vector2(),
    spinMode: 'standard',
    impacted: false,
    launchDir: null,
    pendingSpin: new THREE.Vector2(),
    lift: 0,
    liftVel: 0,
    active: true
  };
}

const toBallColorId = (id) => {
  if (id == null) return null;
  if (typeof id === 'number') {
    return `BALL_${id}`;
  }
  if (typeof id !== 'string') return null;
  const lower = id.toLowerCase();
  if (lower === 'cue' || lower === 'cue_ball') return 'CUE';
  if (lower.startsWith('ball_')) return lower.toUpperCase();
  if (lower.startsWith('red')) return 'RED';
  if (lower.startsWith('yellow')) return 'YELLOW';
  if (lower.startsWith('blue')) return 'BLUE';
  if (lower.startsWith('green')) return 'GREEN';
  if (lower.startsWith('brown')) return 'BROWN';
  if (lower.startsWith('pink')) return 'PINK';
  if (lower.startsWith('black')) return 'BLACK';
  if (lower.startsWith('stripe')) return 'STRIPE';
  if (lower.startsWith('solid')) return 'SOLID';
  return lower.toUpperCase();
};

function alignRailsToCushions(table, frame, railMeshes = null) {
  if (!frame || !table?.userData?.cushions?.length) return;
  table.updateMatrixWorld(true);
  const sampleCushion = table.userData.cushions[0];
  if (!sampleCushion) return;
  const cushionBox = new THREE.Box3().setFromObject(sampleCushion);

  const candidates = Array.isArray(railMeshes) && railMeshes.length ? railMeshes : [frame];
  const frameBox = new THREE.Box3();
  let hasBounds = false;
  for (const mesh of candidates) {
    if (!mesh) continue;
    frameBox.expandByObject(mesh);
    hasBounds = true;
  }
  if (!hasBounds) return;

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

function createAccentMesh(accent, dims) {
  if (!accent?.material || !dims) return null;
  const { outerHalfW, outerHalfH, railH, frameTopY } = dims;
  const thickness = Math.max(MICRO_EPS, (accent.thickness ?? 0.05) * TABLE.THICK);
  const height = Math.max(MICRO_EPS, (accent.height ?? 0.02) * TABLE.THICK);
  const inset = Math.max(0, (accent.inset ?? 0.05) * TABLE.THICK);
  const vertical = THREE.MathUtils.clamp(accent.verticalOffset ?? 0.75, 0, 1);
  const outerHalfWidth = Math.max(thickness, outerHalfW - inset);
  const outerHalfHeight = Math.max(thickness, outerHalfH - inset);
  const innerHalfWidth = Math.max(MICRO_EPS, outerHalfWidth - thickness);
  const innerHalfHeight = Math.max(MICRO_EPS, outerHalfHeight - thickness);
  if (innerHalfWidth <= MICRO_EPS || innerHalfHeight <= MICRO_EPS) return null;
  const shape = new THREE.Shape();
  shape.moveTo(-outerHalfWidth, -outerHalfHeight);
  shape.lineTo(outerHalfWidth, -outerHalfHeight);
  shape.lineTo(outerHalfWidth, outerHalfHeight);
  shape.lineTo(-outerHalfWidth, outerHalfHeight);
  shape.lineTo(-outerHalfWidth, -outerHalfHeight);
  const hole = new THREE.Path();
  hole.moveTo(-innerHalfWidth, -innerHalfHeight);
  hole.lineTo(innerHalfWidth, -innerHalfHeight);
  hole.lineTo(innerHalfWidth, innerHalfHeight);
  hole.lineTo(-innerHalfWidth, innerHalfHeight);
  hole.lineTo(-innerHalfWidth, -innerHalfHeight);
  shape.holes.push(hole);
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
    curveSegments: 72
  });
  const mesh = new THREE.Mesh(geom, accent.material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = frameTopY + railH * vertical - height / 2;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.name = 'tableAccent';
  return mesh;
}

function Table3D(
  parent,
  finish = TABLE_FINISHES[DEFAULT_TABLE_FINISH_ID],
  tableSpecMeta = null,
  railMarkerStyle = null,
  baseVariant = null,
  renderer = null
) {
  const tableSizeMeta =
    tableSpecMeta && typeof tableSpecMeta === 'object' ? tableSpecMeta : null;
  applyTablePhysicsSpec(tableSizeMeta);

  const table = new THREE.Group();
  table.userData = table.userData || {};
  table.userData.cushions = [];
  table.userData.componentPreset = tableSizeMeta?.componentPreset || 'pool';

  const finishParts = {
    frameMeshes: [],
    legMeshes: [],
    baseMeshes: [],
    railMeshes: [],
    trimMeshes: [],
    gapFillMeshes: [],
    pocketJawMeshes: [],
    pocketRimMeshes: [],
    pocketBaseMeshes: [],
    pocketNetMeshes: [],
    underlayMeshes: [],
    clothEdgeMeshes: [],
    accentParent: null,
    accentMesh: null,
    brandPlates: [],
    dimensions: null,
    baseVariantId: null,
    woodSurfaces: { frame: null, rail: null },
    woodTextureId: null
  };

  const halfW = PLAY_W / 2;
  const halfH = PLAY_H / 2;
  const baulkLineZ = -PLAY_H / 2 + BAULK_FROM_BAULK;
  const frameTopY = FRAME_TOP_Y;
  const clothPlaneLocal = CLOTH_TOP_LOCAL + CLOTH_LIFT;
  const clothSurfaceY = clothPlaneLocal - CLOTH_DROP;

  const resolvedFinish =
    (finish && typeof finish === 'object')
      ? finish
      : (typeof finish === 'string' && TABLE_FINISHES[finish]) ||
        (finish?.id && TABLE_FINISHES[finish.id]) ||
        TABLE_FINISHES[DEFAULT_TABLE_FINISH_ID];
  const woodRepeatScale = clampWoodRepeatScaleValue(
    resolvedFinish?.woodRepeatScale ?? DEFAULT_WOOD_REPEAT_SCALE
  );
  const clothTextureKey =
    resolvedFinish?.clothTextureKey ?? DEFAULT_CLOTH_TEXTURE_KEY;
  const palette = resolvedFinish?.colors ?? TABLE_FINISHES[DEFAULT_TABLE_FINISH_ID].colors;
  const defaultWoodOption =
    WOOD_GRAIN_OPTIONS_BY_ID[DEFAULT_WOOD_GRAIN_ID] ?? WOOD_GRAIN_OPTIONS[0];
  const resolvedWoodOption =
    resolvedFinish?.woodTexture ||
    (resolvedFinish?.woodTextureId &&
      WOOD_GRAIN_OPTIONS_BY_ID[resolvedFinish.woodTextureId]) ||
    defaultWoodOption;
  finishParts.woodTextureId = resolvedWoodOption?.id ?? DEFAULT_WOOD_GRAIN_ID;

  const createMaterialsFn =
    typeof resolvedFinish?.createMaterials === 'function'
      ? resolvedFinish.createMaterials
      : TABLE_FINISHES[DEFAULT_TABLE_FINISH_ID].createMaterials;
  const rawMaterials = createMaterialsFn();
  let fallbackMaterials = null;
  const getFallbackMaterial = (key) => {
    if (!fallbackMaterials) {
      fallbackMaterials = TABLE_FINISHES[DEFAULT_TABLE_FINISH_ID].createMaterials();
    }
    return fallbackMaterials[key];
  };
  const frameMat = rawMaterials.frame ?? getFallbackMaterial('frame');
  const railMat = rawMaterials.rail ?? getFallbackMaterial('rail');
  let legMat = rawMaterials.leg ?? frameMat;
  if (legMat === frameMat) {
    legMat = frameMat.clone();
  }
  const trimMat = rawMaterials.trim ?? getFallbackMaterial('trim');
  const pocketJawMat = rawMaterials.pocketJaw ?? getFallbackMaterial('pocketJaw');
  const pocketRimMat = rawMaterials.pocketRim ?? getFallbackMaterial('pocketRim');
  applyPocketLeatherTextureDefaults(pocketJawMat.map, { isColor: true });
  applyPocketLeatherTextureDefaults(pocketJawMat.normalMap);
  applyPocketLeatherTextureDefaults(pocketJawMat.roughnessMap);
  const gapStripeMat =
    rawMaterials.gapStripe ||
    new THREE.MeshPhysicalMaterial({
      color: 0xd1b45c,
      emissive: new THREE.Color(0x0),
      metalness: 0.86,
      roughness: 0.32,
      clearcoat: 0.38,
      clearcoatRoughness: 0.48,
      reflectivity: 0.74
    });
  const accentConfig = rawMaterials.accent ?? null;
  frameMat.needsUpdate = true;
  railMat.needsUpdate = true;
  legMat.needsUpdate = true;
  trimMat.needsUpdate = true;
  pocketJawMat.needsUpdate = true;
  pocketRimMat.needsUpdate = true;
  gapStripeMat.needsUpdate = true;
  enhanceChromeMaterial(trimMat);
  if (accentConfig?.material) {
    accentConfig.material.needsUpdate = true;
  }

  const initialFrameSurface = resolveWoodSurfaceConfig(
    resolvedWoodOption?.frame,
    resolvedWoodOption?.rail ?? defaultWoodOption.frame ?? defaultWoodOption.rail
  );
  const synchronizedRailSurface = {
    repeat: new THREE.Vector2(
      initialFrameSurface.repeat.x,
      initialFrameSurface.repeat.y
    ),
    rotation: initialFrameSurface.rotation,
    textureSize: initialFrameSurface.textureSize,
    mapUrl: initialFrameSurface.mapUrl,
    roughnessMapUrl: initialFrameSurface.roughnessMapUrl,
    normalMapUrl: initialFrameSurface.normalMapUrl,
    woodRepeatScale
  };
  const synchronizedFrameSurface = {
    repeat: new THREE.Vector2(
      initialFrameSurface.repeat.x,
      initialFrameSurface.repeat.y
    ),
    rotation: initialFrameSurface.rotation,
    textureSize: initialFrameSurface.textureSize,
    mapUrl: initialFrameSurface.mapUrl,
    roughnessMapUrl: initialFrameSurface.roughnessMapUrl,
    normalMapUrl: initialFrameSurface.normalMapUrl,
    woodRepeatScale
  };

  applyWoodTextureToMaterial(railMat, synchronizedRailSurface);
  applyWoodTextureToMaterial(frameMat, synchronizedFrameSurface);
  if (legMat !== frameMat) {
    applyWoodTextureToMaterial(legMat, {
      ...synchronizedFrameSurface
    });
  }
  [railMat, frameMat, legMat].forEach((mat) => {
    applyTableFinishDulling(mat);
    applyTableWoodVisibilityTuning(mat);
  });
  finishParts.woodSurfaces = {
    frame: cloneWoodSurfaceConfig(synchronizedFrameSurface),
    rail: cloneWoodSurfaceConfig(synchronizedRailSurface)
  };
  finishParts.woodRepeatScale = woodRepeatScale;

  const {
    map: clothMap,
    bump: clothBump,
    normal: clothNormal,
    roughness: clothRoughness,
    mapSource: clothMapSource
  } = createClothTextures(clothTextureKey);
  const isPolyHavenCloth = clothMapSource === 'polyhaven';
  const clothPrimary = new THREE.Color(palette.cloth);
  const cushionPrimary = new THREE.Color(palette.cushion ?? palette.cloth);
  const clothHighlight = new THREE.Color(0xedfff4);
  const brightnessLift = CLOTH_BRIGHTNESS_LERP;
  const clampClothColor = (baseColor) => {
    const hsl = { h: 0, s: 0, l: 0 };
    baseColor.getHSL(hsl);
    const baseSaturationBoost = isPolyHavenCloth ? 1.12 : 1.08;
    let hue = hsl.h;
    let saturationBoost = baseSaturationBoost;
    let lightnessBoost = 0;
    if (isPolyHavenCloth && hue >= 0.48 && hue <= 0.64) {
      const blueBias = THREE.MathUtils.clamp((hue - 0.48) / 0.16, 0, 1);
      hue = THREE.MathUtils.lerp(hue, 0.61, 0.4 + 0.18 * blueBias);
      saturationBoost = baseSaturationBoost + 0.08 * (0.5 + 0.5 * blueBias);
      lightnessBoost = 0.06 * (0.4 + 0.6 * blueBias);
    }
    const saturationFloor = isPolyHavenCloth ? 0.32 : 0.18;
    const minLightness = isPolyHavenCloth ? 0.3 : 0;
    const maxLightness = isPolyHavenCloth ? 0.68 : 0.86;
    const result = baseColor.clone();
    const baseSaturation = THREE.MathUtils.clamp(
      hsl.s * saturationBoost,
      saturationFloor,
      1
    );
    const clampedLightness = THREE.MathUtils.clamp(
      hsl.l + lightnessBoost,
      minLightness,
      maxLightness + (isPolyHavenCloth ? 0.04 : 0)
    );
    const balancedLightness = isPolyHavenCloth
      ? THREE.MathUtils.lerp(clampedLightness, 0.52, 0.16)
      : THREE.MathUtils.lerp(clampedLightness, 0.5, 0.08);
    result.setHSL(
      hue,
      baseSaturation,
      balancedLightness
    );
    return result;
  };
  const clothHighlightMix = THREE.MathUtils.clamp(
    (0.28 + brightnessLift) - (isPolyHavenCloth ? 0.02 : 0),
    0,
    1
  );
  const cushionHighlightMix = THREE.MathUtils.clamp(
    (0.18 + brightnessLift) - (isPolyHavenCloth ? 0.02 : 0),
    0,
    1
  );
  const clothColor = clampClothColor(
    clothPrimary.clone().lerp(clothHighlight, clothHighlightMix)
  );
  const cushionColor = clampClothColor(
    cushionPrimary.clone().lerp(clothHighlight, cushionHighlightMix)
  );
  const sheenColor = clothColor.clone().lerp(clothHighlight, 0.14 + brightnessLift * 0.35);
  const clothSheen = CLOTH_QUALITY.sheen * (isPolyHavenCloth ? 0.54 : 0.68);
  const clothSheenRoughness = Math.min(
    1,
    CLOTH_QUALITY.sheenRoughness * (isPolyHavenCloth ? 1.2 : 1.04)
  );
  const clothRoughnessBase = CLOTH_ROUGHNESS_BASE + (isPolyHavenCloth ? 0.1 : 0.02);
  const clothRoughnessTarget = CLOTH_ROUGHNESS_TARGET + (isPolyHavenCloth ? 0.08 : 0.02);
  const clothEmissiveIntensity = isPolyHavenCloth ? 0.16 : 0.32;
  const clothMat = new THREE.MeshPhysicalMaterial({
    color: clothColor,
    roughness: clothRoughnessBase,
    sheen: clothSheen,
    sheenColor,
    sheenRoughness: clothSheenRoughness,
    clearcoat: 0,
    clearcoatRoughness: 0.9,
    envMapIntensity: 0,
    emissive: clothColor.clone().multiplyScalar(0.045),
    emissiveIntensity: clothEmissiveIntensity,
    metalness: 0
  });
  clothMat.side = THREE.DoubleSide;
  const ballDiameter = BALL_R * 2;
  const ballsAcrossWidth = PLAY_W / ballDiameter;
  const threadsPerBallTarget = 12; // base density before global scaling adjustments
  const clothPatternUpscale = (1 / 1.3) * 0.5 * 1.25 * 1.5 * CLOTH_PATTERN_SCALE; // double the thread pattern size for a looser, woollier weave
  const patternOverride = resolveClothPatternOverride(clothTextureKey);
  const clothTextureScale =
    0.032 * 1.35 * 1.56 * 1.12 * clothPatternUpscale; // stretch the weave while keeping the cloth visibly taut
  let baseRepeat =
    ((threadsPerBallTarget * ballsAcrossWidth) / CLOTH_THREADS_PER_TILE) *
    clothTextureScale;
  const repeatScale =
    patternOverride?.repeatScale && patternOverride.repeatScale > 0
      ? patternOverride.repeatScale
      : 1;
  baseRepeat *= repeatScale;
  const repeatRatioScale =
    patternOverride?.repeatRatioScale && patternOverride.repeatRatioScale > 0
      ? patternOverride.repeatRatioScale
      : 1;
  const repeatRatio = 3.45 * repeatRatioScale;
  const polyRepeatScale =
    clothMapSource === 'polyhaven' ? POLYHAVEN_PATTERN_REPEAT_SCALE : 1;
  const baseRepeatApplied = baseRepeat * polyRepeatScale;
  const baseBumpScale =
    (0.64 * 1.52 * 1.34 * 1.26 * 1.18 * 1.12) * CLOTH_QUALITY.bumpScaleMultiplier;
  const flattenedBumpScale = baseBumpScale * 0.48;
  if (clothMap) {
    clothMat.map = clothMap;
    clothMat.map.repeat.set(baseRepeatApplied, baseRepeatApplied * repeatRatio);
    clothMat.map.needsUpdate = true;
  }
  if (clothNormal) {
    clothMat.normalMap = clothNormal;
    clothMat.normalMap.repeat.set(baseRepeatApplied, baseRepeatApplied * repeatRatio);
    clothMat.normalScale = CLOTH_NORMAL_SCALE.clone();
    clothMat.normalMap.needsUpdate = true;
    clothMat.bumpScale = flattenedBumpScale;
    clothMat.bumpMap = null;
  } else if (clothBump) {
    clothMat.bumpMap = clothBump;
    clothMat.bumpMap.repeat.set(baseRepeatApplied, baseRepeatApplied * repeatRatio);
    clothMat.bumpScale = flattenedBumpScale;
    clothMat.bumpMap.needsUpdate = true;
  } else {
    clothMat.bumpScale = flattenedBumpScale;
  }
  if (clothRoughness) {
    clothMat.roughnessMap = clothRoughness;
    clothMat.roughnessMap.repeat.set(baseRepeatApplied, baseRepeatApplied * repeatRatio);
    clothMat.roughness = CLOTH_ROUGHNESS_TARGET;
    clothMat.roughnessMap.needsUpdate = true;
  }
  clothMat.userData = {
    ...(clothMat.userData || {}),
    baseRepeatRaw: baseRepeat,
    baseRepeat: baseRepeatApplied,
    repeatRatio,
    polyRepeatScale,
    nearRepeat: baseRepeatApplied * 1.12,
    farRepeat: baseRepeatApplied * 0.44,
    bumpScale: clothMat.bumpScale,
    baseBumpScale: clothMat.bumpScale,
    quality: CLOTH_QUALITY
  };

  const cushionMat = clothMat.clone();
  cushionMat.color.copy(cushionColor);
  cushionMat.emissive.copy(cushionColor.clone().multiplyScalar(0.045));
  cushionMat.side = THREE.DoubleSide;
  const clothEdgeMat = clothMat.clone();
  clothEdgeMat.color.copy(clothColor);
  clothEdgeMat.emissive.set(0x000000);
  clothEdgeMat.map = null;
  clothEdgeMat.bumpMap = null;
  clothEdgeMat.normalMap = null;
  clothEdgeMat.roughnessMap = null;
  clothEdgeMat.bumpScale = 0;
  clothEdgeMat.side = THREE.DoubleSide;
  clothEdgeMat.envMapIntensity = 0;
  clothEdgeMat.emissiveIntensity = CLOTH_EDGE_EMISSIVE_INTENSITY;
  clothEdgeMat.metalness = 0;
  clothEdgeMat.roughness = 1;
  clothEdgeMat.clearcoat = 0;
  clothEdgeMat.clearcoatRoughness = 1;
  clothEdgeMat.sheen = 0;
  clothEdgeMat.reflectivity = 0;
  clothEdgeMat.needsUpdate = true;
  const clothBaseSettings = {
    roughnessTarget: clothRoughnessTarget,
    roughness: clothMat.roughness,
    sheen: clothMat.sheen,
    sheenRoughness: clothMat.sheenRoughness,
    clearcoat: clothMat.clearcoat,
    clearcoatRoughness: clothMat.clearcoatRoughness,
    envMapIntensity: clothMat.envMapIntensity,
    emissiveIntensity: clothMat.emissiveIntensity,
    bumpScale: clothMat.bumpScale,
    baseRepeat: baseRepeatApplied,
    baseRepeatRaw: baseRepeat,
    repeatRatio,
    baseBumpScale,
    polyRepeatScale,
    isPolyHavenCloth
  };
  const clothMaterials = [clothMat, cushionMat, clothEdgeMat];
  const applyClothDetail = (detail) => {
    const overrides = detail && typeof detail === 'object' ? detail : {};
    const bumpMultiplier = Number.isFinite(overrides.bumpMultiplier)
      ? overrides.bumpMultiplier
      : 1;
    const baseBump = clothBaseSettings.bumpScale;
    const targetBump = Number.isFinite(overrides.bumpScale)
      ? overrides.bumpScale
      : baseBump * (Number.isFinite(bumpMultiplier) ? bumpMultiplier : 1);
    clothMaterials.forEach((mat) => {
      if (!mat) return;
      mat.roughness = Number.isFinite(overrides.roughness)
        ? THREE.MathUtils.clamp(overrides.roughness, 0, 1)
        : clothBaseSettings.roughness;
      mat.sheen = Number.isFinite(overrides.sheen)
        ? THREE.MathUtils.clamp(overrides.sheen, 0, 1)
        : clothBaseSettings.sheen;
      mat.sheenRoughness = Number.isFinite(overrides.sheenRoughness)
        ? THREE.MathUtils.clamp(overrides.sheenRoughness, 0, 1)
        : clothBaseSettings.sheenRoughness;
      const targetClearcoat = Number.isFinite(overrides.clearcoat)
        ? overrides.clearcoat
        : clothBaseSettings.clearcoat;
      mat.clearcoat = THREE.MathUtils.clamp(
        targetClearcoat,
        0,
        CLOTH_REFLECTION_LIMITS.clearcoatMax
      );
      const targetClearcoatRoughness = Number.isFinite(overrides.clearcoatRoughness)
        ? overrides.clearcoatRoughness
        : clothBaseSettings.clearcoatRoughness;
      mat.clearcoatRoughness = THREE.MathUtils.clamp(
        targetClearcoatRoughness,
        CLOTH_REFLECTION_LIMITS.clearcoatRoughnessMin,
        1
      );
      if (typeof mat.emissiveIntensity === 'number') {
        mat.emissiveIntensity = Number.isFinite(overrides.emissiveIntensity)
          ? overrides.emissiveIntensity
          : clothBaseSettings.emissiveIntensity;
      }
      if ('envMapIntensity' in mat) {
        const targetEnvIntensity = Number.isFinite(overrides.envMapIntensity)
          ? overrides.envMapIntensity
          : clothBaseSettings.envMapIntensity;
        mat.envMapIntensity = THREE.MathUtils.clamp(
          targetEnvIntensity,
          0,
          CLOTH_REFLECTION_LIMITS.envMapIntensityMax
        );
      }
      if (Number.isFinite(targetBump)) {
        mat.bumpScale = targetBump;
      } else {
        mat.bumpScale = clothBaseSettings.bumpScale;
      }
      mat.needsUpdate = true;
    });
    const primary = clothMaterials[0];
    if (primary?.userData) {
      primary.userData.bumpScale = primary.bumpScale;
      primary.userData.baseBumpScale = clothBaseSettings.bumpScale;
      primary.userData.detailBumpMultiplier = Number.isFinite(bumpMultiplier)
        ? bumpMultiplier
        : 1;
    }
  };
  applyClothDetail(resolvedFinish?.clothDetail);
  clothEdgeMat.map = null;
  clothEdgeMat.bumpMap = null;
  clothEdgeMat.bumpScale = 0;
  clothEdgeMat.roughness = 1;
  clothEdgeMat.clearcoat = 0;
  clothEdgeMat.clearcoatRoughness = 1;
  clothEdgeMat.envMapIntensity = 0;
  clothEdgeMat.sheen = 0;
  clothEdgeMat.needsUpdate = true;
  const finishInfo = {
    id: resolvedFinish?.id ?? DEFAULT_TABLE_FINISH_ID,
    palette,
    materials: {
      frame: frameMat,
      rail: railMat,
      leg: legMat,
      trim: trimMat,
      pocketJaw: pocketJawMat,
      pocketRim: pocketRimMat,
      accent: accentConfig
    },
    clothMat,
    cushionMat,
    clothEdgeMat,
    parts: finishParts,
    clothDetail: resolvedFinish?.clothDetail ?? null,
    clothBase: clothBaseSettings,
    applyClothDetail,
    woodTextureId: finishParts.woodTextureId,
    clothTextureKey,
    woodRepeatScale
  };
  registerClothTextureConsumer(clothTextureKey, finishInfo);

  const clothExtendBase = Math.max(
    SIDE_RAIL_INNER_THICKNESS * 0.38,
    Math.min(PLAY_W, PLAY_H) * 0.0105
  );
  const clothExtend =
    clothExtendBase +
    Math.min(PLAY_W, PLAY_H) * 0.0042; // extend the cloth slightly more so rails meet the cloth with no gaps
  const halfWext = halfW + clothExtend;
  const halfHext = halfH + clothExtend;
  const sideInset = SIDE_POCKET_RADIUS * 0.84 * POCKET_VISUAL_EXPANSION;
  const desiredSidePocketShift = Math.max(0, halfWext - sideInset - halfW);
  const maxSidePocketShift = Math.max(0, halfWext - MICRO_EPS - halfW);
  const baseSidePocketShift = Math.min(desiredSidePocketShift, maxSidePocketShift);
  const extraSidePocketShift = Math.min(
    SIDE_POCKET_EXTRA_SHIFT,
    Math.max(0, maxSidePocketShift - baseSidePocketShift)
  );
  const fieldPull = Math.min(
    SIDE_POCKET_FIELD_PULL,
    baseSidePocketShift + extraSidePocketShift
  );
  const rawSidePocketShift = Math.max(
    0,
    baseSidePocketShift + extraSidePocketShift - fieldPull
  );
  sidePocketShift = Math.min(
    maxSidePocketShift,
    rawSidePocketShift + SIDE_POCKET_OUTWARD_BIAS
  );
  const sidePocketCenterX = halfW + sidePocketShift;
  const pocketPositions = pocketCenters();
  const clothPocketPositions = pocketPositions.map((center, index) => {
    if (index < 4 || !center) return center;
    const direction = Math.sign(center.x || 1);
    const pull = Math.min(Math.abs(center.x), SIDE_POCKET_CLOTH_INWARD_PULL) * direction;
    return center.clone().add(new THREE.Vector2(-pull, 0));
  });
  const sideRadiusScale =
    POCKET_VIS_R > MICRO_EPS ? (SIDE_POCKET_RADIUS / POCKET_VIS_R) * SIDE_POCKET_CUT_SCALE : 1;
  const buildSurfaceShape = (holeRadius, edgeInset = 0, centers = pocketPositions) => {
    const insetHalfW = Math.max(MICRO_EPS, halfWext - edgeInset);
    const insetHalfH = Math.max(MICRO_EPS, halfHext - edgeInset);

    const baseRing = [
      [-insetHalfW, -insetHalfH],
      [insetHalfW, -insetHalfH],
      [insetHalfW, insetHalfH],
      [-insetHalfW, insetHalfH],
      [-insetHalfW, -insetHalfH]
    ];
    const baseMP = [[baseRing]];

    const closeRing = (ring) => {
      if (!ring.length) {
        return ring;
      }
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        ring.push([first[0], first[1]]);
      }
      return ring;
    };

    const createPocketSector = (center, sweep, radius, segments, includeCenter = true) => {
      if (!center || !Number.isFinite(radius) || radius <= MICRO_EPS) {
        return null;
      }
      const inward = new THREE.Vector2(-center.x, -center.y);
      if (inward.lengthSq() <= MICRO_EPS * MICRO_EPS) {
        inward.set(center.x >= 0 ? -1 : 1, center.y >= 0 ? -1 : 1);
      }
      inward.normalize();
      const baseAngle = Math.atan2(inward.y, inward.x);
      const halfSweep = sweep / 2;
      const start = baseAngle - halfSweep;
      const end = baseAngle + halfSweep;
      const steps = Math.max(8, Math.ceil(segments));
      const arcPoints = [];
      for (let i = 0; i <= steps; i++) {
        const t = start + ((end - start) * i) / steps;
        const px = center.x + Math.cos(t) * radius;
        const py = center.y + Math.sin(t) * radius;
        arcPoints.push([px, py]);
      }
      if (includeCenter) {
        if (arcPoints.length < 2) {
          return null;
        }
      } else if (arcPoints.length < 3) {
        return null;
      }
      let ring = includeCenter
        ? [[center.x, center.y], ...arcPoints]
        : arcPoints.slice();
      const areaRing = closeRing(ring.slice());
      if (areaRing.length < 4) {
        return null;
      }
      const area = signedRingArea(areaRing);
      if (area < 0) {
        ring = ring.slice().reverse();
        if (includeCenter) {
          const centerIndex = ring.findIndex(
            (pt) => pt[0] === center.x && pt[1] === center.y
          );
          if (centerIndex > 0) {
            ring = ring
              .slice(centerIndex)
              .concat(ring.slice(0, centerIndex));
          }
        }
      }
      return [[closeRing(ring)]];
    };

    const pocketSectors = centers
      .map((center, index) => {
        const isSidePocket = index >= 4;
        const radius = isSidePocket ? holeRadius * sideRadiusScale : holeRadius;
        const sweep = Math.PI * 2;
        const baseSegments = isSidePocket ? 96 : 64;
        return createPocketSector(center, sweep, radius, baseSegments, false);
      })
      .filter(Boolean);

    let shapeMP = baseMP;
    if (pocketSectors.length) {
    shapeMP = safePolygonDifference(baseMP, ...pocketSectors);
    }
    const shapes = multiPolygonToShapes(shapeMP);
    if (shapes.length === 1) {
      return shapes[0];
    }
    if (shapes.length > 1) {
      return shapes;
    }

    const fallback = new THREE.Shape();
    fallback.moveTo(-insetHalfW, -insetHalfH);
    fallback.lineTo(insetHalfW, -insetHalfH);
    fallback.lineTo(insetHalfW, insetHalfH);
    fallback.lineTo(-insetHalfW, insetHalfH);
    fallback.lineTo(-insetHalfW, -insetHalfH);
    centers.forEach((p, index) => {
      const hole = new THREE.Path();
      const isSidePocket = index >= 4;
      const radius = isSidePocket ? holeRadius * sideRadiusScale : holeRadius;
      hole.absellipse(p.x, p.y, radius, radius, 0, Math.PI * 2, true);
      hole.autoClose = true;
      fallback.holes.push(hole);
    });
    return fallback;
  };

  const clothShape = buildSurfaceShape(POCKET_HOLE_R, 0, clothPocketPositions);
  const clothGeo = new THREE.ExtrudeGeometry(clothShape, {
    depth: CLOTH_EXTENDED_DEPTH,
    bevelEnabled: false,
    curveSegments: 96,
    steps: 1
  });
  clothGeo.translate(0, 0, -CLOTH_EXTENDED_DEPTH);
  const cloth = new THREE.Mesh(clothGeo, clothMat);
  cloth.rotation.x = -Math.PI / 2;
  cloth.position.y = clothPlaneLocal - CLOTH_DROP;
  cloth.renderOrder = 3;
  cloth.receiveShadow = true;
  table.add(cloth);
  const clothBottomY = cloth.position.y - CLOTH_EXTENDED_DEPTH;
  const plywoodTopY =
    clothBottomY - (PLYWOOD_ENABLED ? PLYWOOD_GAP + PLYWOOD_EXTRA_DROP : 0);
  const pocketTopY = clothBottomY - POCKET_BOARD_TOUCH_OFFSET;
  const pocketEdgeStopY =
    (PLYWOOD_ENABLED ? plywoodTopY : pocketTopY) - POCKET_EDGE_STOP_EXTRA_DROP;
  const pocketCutStripes = POCKET_EDGE_SLEEVES_ENABLED
    ? addPocketCuts(
        table,
        cloth.position.y,
        clothPocketPositions,
        clothEdgeMat,
        sideRadiusScale,
        pocketEdgeStopY
      )
    : [];
  finishParts.clothEdgeMeshes.push(...pocketCutStripes);
  // Leave the pocket apertures completely open so the pocket geometry remains visible.
  const clothEdgeTopY = cloth.position.y - MICRO_EPS;
  const clothEdgeBottomY = clothBottomY - MICRO_EPS;
  const clothEdgeHeight = clothEdgeTopY - clothEdgeBottomY;
  if (clothEdgeHeight > MICRO_EPS) {
    const planeWidth = Math.max(MICRO_EPS, halfWext * 2);
    const planeLength = Math.max(MICRO_EPS, halfHext * 2);
    const baseRepeatValue = clothMat.userData?.baseRepeat ?? clothMat.map?.repeat?.x ?? 1;
    const ratioValue = clothMat.userData?.repeatRatio ??
      (clothMat.map?.repeat?.x ? clothMat.map.repeat.y / clothMat.map.repeat.x : 1);
    const circumference = Math.max(MICRO_EPS, 2 * Math.PI * POCKET_HOLE_R);
    const repeatAround = baseRepeatValue * (circumference / planeWidth);
    const repeatHeight =
      baseRepeatValue *
      ratioValue *
      (clothEdgeHeight / planeLength) *
      CLOTH_EDGE_TEXTURE_HEIGHT_SCALE;
    if (clothEdgeMat.map) {
      clothEdgeMat.map.repeat.set(
        Math.max(repeatAround, 1),
        Math.max(repeatHeight, 0.5)
      );
      clothEdgeMat.map.center.set(0.5, 0.5);
      clothEdgeMat.map.rotation = clothMat.map?.rotation ?? clothEdgeMat.map.rotation ?? 0;
      clothEdgeMat.map.needsUpdate = true;
    }
    if (clothEdgeMat.bumpMap) {
      clothEdgeMat.bumpMap.repeat.set(
        Math.max(repeatAround, 1),
        Math.max(repeatHeight, 0.5)
      );
      clothEdgeMat.bumpMap.center.set(0.5, 0.5);
      clothEdgeMat.bumpMap.rotation = clothEdgeMat.map?.rotation ?? clothEdgeMat.bumpMap.rotation ?? 0;
      clothEdgeMat.bumpMap.needsUpdate = true;
    }
    clothEdgeMat.needsUpdate = true;
  }

  const markingsGroup = new THREE.Group();
  const markingMat = new THREE.MeshBasicMaterial({
    color: palette.markings,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide
  });
  const markingHeight = clothPlaneLocal - CLOTH_DROP + MICRO_EPS * 2;
  const lineThickness = Math.max(BALL_R * 0.08, 0.1);
  const baulkLineLength = PLAY_W - SIDE_RAIL_INNER_THICKNESS * 0.4;
  const baulkLineGeom = new THREE.PlaneGeometry(baulkLineLength, lineThickness);
  const baulkLine = new THREE.Mesh(baulkLineGeom, markingMat);
  baulkLine.rotation.x = -Math.PI / 2;
  baulkLine.position.set(0, markingHeight, baulkLineZ);
  markingsGroup.add(baulkLine);

  const dRadius = D_RADIUS;
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

  const spotRadius = BALL_R * 0.26;
  const spotMeshes = [];
  const addSpot = (x, z) => {
    const spotGeo = new THREE.CircleGeometry(spotRadius, 32);
    const spot = new THREE.Mesh(spotGeo, markingMat.clone());
    spot.rotation.x = -Math.PI / 2;
    spot.position.set(x, markingHeight, z);
    markingsGroup.add(spot);
    spotMeshes.push(spot);
  };
  addSpot(-D_RADIUS, baulkLineZ);
  addSpot(0, baulkLineZ);
  addSpot(D_RADIUS, baulkLineZ);
  addSpot(0, 0);
  const topCushionZ = PLAY_H / 2;
  addSpot(0, (topCushionZ + 0) / 2);
  addSpot(0, topCushionZ - BLACK_FROM_TOP);
  markingsGroup.traverse((child) => {
    if (child.isMesh) {
      child.renderOrder = cloth.renderOrder + 1;
      child.castShadow = false;
      child.receiveShadow = false;
    }
  });
  table.add(markingsGroup);
  table.userData.markings = {
    group: markingsGroup,
    baulkLine,
    dArc,
    spots: spotMeshes
  };
  const pocketGeo = new THREE.CylinderGeometry(
    POCKET_TOP_R,
    POCKET_BOTTOM_R,
    POCKET_WALL_HEIGHT,
    48,
    1,
    true
  );
  const pocketMat = new THREE.MeshStandardMaterial({
    color: 0x000000,
    metalness: 0.45,
    roughness: 0.6,
    side: THREE.BackSide
  });
  const pocketNetTexture = createPocketNetTexture();
  const pocketNetMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.08,
    roughness: 0.32,
    opacity: 0.96,
    transparent: true,
    alphaMap: pocketNetTexture || undefined,
    alphaTest: 0.22,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const pocketGuideRingRadius = POCKET_BOTTOM_R * POCKET_NET_RING_RADIUS_SCALE;
  const pocketNetProfile = [
    new THREE.Vector2(pocketGuideRingRadius, 0),
    new THREE.Vector2(POCKET_BOTTOM_R * 0.94, -POCKET_NET_DEPTH * 0.16),
    new THREE.Vector2(POCKET_BOTTOM_R * 0.82, -POCKET_NET_DEPTH * 0.45),
    new THREE.Vector2(POCKET_BOTTOM_R * 0.66, -POCKET_NET_DEPTH * 0.74),
    new THREE.Vector2(pocketGuideRingRadius, -POCKET_NET_DEPTH * 1.06)
  ];
  const pocketNetGeo = new THREE.LatheGeometry(pocketNetProfile, POCKET_NET_SEGMENTS);
  const pocketGuideMaterial = trimMat;
  const pocketStrapLength = Math.max(POCKET_GUIDE_LENGTH * 0.62, BALL_DIAMETER * 5.4);
  const pocketStrapWidth = BALL_R * 1.8;
  const pocketStrapThickness = BALL_R * 0.12;
  const pocketRingGeometry = new THREE.TorusGeometry(
    pocketGuideRingRadius,
    POCKET_NET_RING_TUBE_RADIUS,
    12,
    28
  );
  const pocketMeshes = [];
  const pocketDropAnchors = new Map();
  pocketCenters().forEach((p, index) => {
    const pocketId = POCKET_IDS[index] ?? null;
    const isMiddlePocket = index >= 4;
    const pocketLift = isMiddlePocket ? SIDE_POCKET_PLYWOOD_LIFT : 0;
    const pocket = new THREE.Mesh(pocketGeo, pocketMat);
    pocket.position.set(p.x, pocketTopY - POCKET_WALL_HEIGHT / 2 + pocketLift, p.y);
    pocket.renderOrder = cloth.renderOrder - 0.5; // render beneath the cloth to avoid z-fighting
    pocket.castShadow = false;
    pocket.receiveShadow = true;
    pocket.userData.verticalLift = pocketLift;
    table.add(pocket);
    pocketMeshes.push(pocket);
    const net = new THREE.Mesh(pocketNetGeo, pocketNetMaterial);
    net.position.set(
      p.x,
      pocketTopY - POCKET_WALL_HEIGHT - POCKET_WALL_OPEN_TRIM + pocketLift + POCKET_NET_VERTICAL_LIFT,
      p.y
    );
    net.castShadow = false;
    net.receiveShadow = true;
    net.renderOrder = pocket.renderOrder - 0.25;
    table.add(net);
    finishParts.pocketNetMeshes.push(net);

    // Add chrome cradle rails and holders beneath the pocket net to catch potted balls.
    const netBottomY = net.position.y - POCKET_NET_DEPTH * 1.06;
    const ringAnchor = new THREE.Vector3(
      p.x,
      netBottomY + POCKET_NET_RING_VERTICAL_OFFSET,
      p.y
    );
    const ring = new THREE.Mesh(pocketRingGeometry, pocketGuideMaterial);
    ring.position.copy(ringAnchor);
    ring.rotation.x = Math.PI / 2;
    ring.castShadow = true;
    ring.receiveShadow = true;
    table.add(ring);
    finishParts.pocketBaseMeshes.push(ring);

    const outwardDir = resolvePocketHolderDirection(p, pocketId);
    const sideDir = new THREE.Vector3().crossVectors(outwardDir, new THREE.Vector3(0, 1, 0)).normalize();
    const strapDir = outwardDir.clone().setY(-Math.tan(POCKET_HOLDER_TILT_RAD)).normalize();
    const railStartDistance = Math.max(
      MICRO_EPS,
      pocketGuideRingRadius + POCKET_GUIDE_RING_CLEARANCE + POCKET_GUIDE_RING_OVERLAP
    );
    const railStartOffset = -railStartDistance;
    const buildGuideSegment = (start, end) => {
      const delta = end.clone().sub(start);
      const length = delta.length();
      if (length <= MICRO_EPS) return null;
      const guideGeom = new THREE.CylinderGeometry(
        POCKET_GUIDE_RADIUS,
        POCKET_GUIDE_RADIUS,
        length,
        12
      );
      const guide = new THREE.Mesh(guideGeom, pocketGuideMaterial);
      guide.position.copy(start.clone().add(end).multiplyScalar(0.5));
      guide.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
      guide.castShadow = true;
      guide.receiveShadow = true;
      table.add(guide);
      finishParts.pocketBaseMeshes.push(guide);
      return guide;
    };
    let strapOrigin = null;
    let strapEnd = null;
    for (let i = 0; i < 3; i += 1) {
      const middleSway = isMiddlePocket ? POCKET_MIDDLE_HOLDER_SWAY * (pocketId === 'TM' ? -1 : 1) : 0;
      const lateralOffset = (i - 1) * POCKET_GUIDE_SPREAD + middleSway * (i - 1);
      const isCenterGuide = i === 1;
      const start = ringAnchor
        .clone()
        .addScaledVector(outwardDir, railStartOffset)
        .addScaledVector(sideDir, lateralOffset)
        .add(
          new THREE.Vector3(
            0,
            -POCKET_GUIDE_VERTICAL_DROP - (isCenterGuide ? POCKET_GUIDE_FLOOR_DROP : 0),
            0
          )
        );
      const stemEnd = start.clone().add(new THREE.Vector3(0, -POCKET_GUIDE_STEM_DEPTH, 0));
      const runEnd = stemEnd
        .clone()
        .addScaledVector(strapDir, POCKET_GUIDE_LENGTH)
        .add(new THREE.Vector3(0, -POCKET_GUIDE_DROP - (isCenterGuide ? POCKET_GUIDE_FLOOR_DROP * 0.35 : 0), 0));
      buildGuideSegment(start, stemEnd);
      buildGuideSegment(stemEnd, runEnd);

      if (isCenterGuide) {
        strapOrigin = stemEnd.clone();
        strapEnd = runEnd.clone();
      }
    }

    if (strapOrigin && strapEnd) {
      const strapHeight = Math.max(BALL_DIAMETER * 2.6, pocketStrapLength * 0.72);
      const strapGeom = new THREE.BoxGeometry(
        pocketStrapWidth,
        strapHeight,
        pocketStrapThickness
      );
      const strap = new THREE.Mesh(strapGeom, pocketJawMat);
      const strapBase = strapEnd.clone();
      const strapTopLimit = pocketTopY - TABLE.THICK * 0.08;
      const strapBaseY = Math.min(
        strapBase.y + POCKET_STRAP_VERTICAL_LIFT,
        strapTopLimit - strapHeight
      );
      const strapMid = strapBase.clone();
      strapMid.y = strapBaseY + strapHeight * 0.5;
      const flatDir = strapDir.clone().setY(0);
      const strapForward =
        flatDir.lengthSq() > MICRO_EPS ? flatDir.normalize() : new THREE.Vector3(0, 0, 1);
      strap.position.copy(strapMid);
      strap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), strapForward);
      strap.castShadow = true;
      strap.receiveShadow = true;
      table.add(strap);
      finishParts.pocketJawMeshes.push(strap);
    }
    const holderSurfaceY =
      ringAnchor.y - POCKET_GUIDE_VERTICAL_DROP - POCKET_GUIDE_FLOOR_DROP + POCKET_GUIDE_RADIUS + BALL_R;
    pocketDropAnchors.set(pocketId, { ringAnchor: ringAnchor.clone(), holderSurfaceY });
  });
  table.userData.pocketDropAnchors = pocketDropAnchors;

  const railH = RAIL_HEIGHT;
  const railsTopY = frameTopY + railH;
  const longRailW = ORIGINAL_RAIL_WIDTH; // keep the long rail caps as wide as the end rails so side pockets match visually
  const endRailW = ORIGINAL_RAIL_WIDTH;
  const frameExpansion = TABLE.WALL * 0.12 + TABLE_OUTER_EXPANSION;
  const frameWidthEnd =
    Math.max(0, ORIGINAL_OUTER_HALF_H - halfH - 2 * endRailW) + frameExpansion;
  const frameWidthLong = frameWidthEnd; // force side rails to carry the same exterior thickness as the short rails
  const outerHalfW = halfW + 2 * longRailW + frameWidthLong;
  const outerHalfH = halfH + 2 * endRailW + frameWidthEnd;
  finishParts.dimensions = { outerHalfW, outerHalfH, railH, frameTopY };
  // Force the table rails to reuse the exact cue butt wood scale so the grain
  // is just as visible as it is on the stick finish in cue view.
  const alignedRailSurface = resolveWoodSurfaceConfig(
    resolvedWoodOption?.frame,
    initialFrameSurface
  );
  applyWoodTextureToMaterial(railMat, {
    repeat: new THREE.Vector2(
      alignedRailSurface.repeat.x,
      alignedRailSurface.repeat.y
    ),
    rotation: alignedRailSurface.rotation,
    textureSize: alignedRailSurface.textureSize,
    mapUrl: alignedRailSurface.mapUrl,
    roughnessMapUrl: alignedRailSurface.roughnessMapUrl,
    normalMapUrl: alignedRailSurface.normalMapUrl,
    woodRepeatScale
  });
  finishParts.underlayMeshes.forEach((mesh) => {
    if (!mesh?.material || mesh.userData?.skipWoodTexture) return;
    const underlaySurface = initialFrameSurface;
    applyWoodTextureToMaterial(mesh.material, {
      repeat: new THREE.Vector2(
        underlaySurface.repeat.x,
        underlaySurface.repeat.y
      ),
      rotation: underlaySurface.rotation,
      textureSize: underlaySurface.textureSize,
      mapUrl: underlaySurface.mapUrl,
      roughnessMapUrl: underlaySurface.roughnessMapUrl,
      normalMapUrl: underlaySurface.normalMapUrl,
      woodRepeatScale
    });
    mesh.material.needsUpdate = true;
  });
  finishParts.woodSurfaces.rail = cloneWoodSurfaceConfig(alignedRailSurface);
  const CUSHION_RAIL_FLUSH = -TABLE.THICK * 0.07; // push the cushions further outward so they meet the wooden rails without a gap
  const CUSHION_SHORT_RAIL_CENTER_NUDGE = -TABLE.THICK * 0.01; // push the short-rail cushions slightly farther from center so their noses sit flush against the rails
  const CUSHION_LONG_RAIL_CENTER_NUDGE = TABLE.THICK * 0.004; // keep a subtle setback along the long rails to prevent overlap
  const CUSHION_CORNER_CLEARANCE_REDUCTION = TABLE.THICK * 0.26; // shorten the corner cushions more so the noses stay clear of the pocket openings
  const SIDE_CUSHION_POCKET_REACH_REDUCTION = TABLE.THICK * 0.14; // trim the cushion tips near middle pockets slightly further while keeping their cut angle intact
  const SIDE_CUSHION_RAIL_REACH = TABLE.THICK * 0.05; // press the side cushions firmly into the rails without creating overlap
  const SIDE_CUSHION_CORNER_SHIFT = BALL_R * 0.18; // slide the side cushions toward the middle pockets so each cushion end lines up flush with the pocket jaws
  const SHORT_CUSHION_HEIGHT_SCALE = 1; // keep short rail cushions flush with the new trimmed cushion profile
  const railsGroup = new THREE.Group();
  finishParts.accentParent = railsGroup;
  const outerCornerRadius =
    Math.min(Math.min(longRailW, endRailW) * 1.6, Math.min(outerHalfW, outerHalfH) * 0.2) *
    WOOD_RAIL_CORNER_RADIUS_SCALE;
  const hasRoundedRailCorners = outerCornerRadius > MICRO_EPS;

  const innerHalfW = halfWext;
  const innerHalfH = halfHext;
  const cornerPocketRadius = CORNER_CHROME_NOTCH_RADIUS;
  const cornerChamfer = POCKET_VIS_R * 0.34 * POCKET_VISUAL_EXPANSION;
  const cornerInset = innerHalfW - (halfW - CORNER_POCKET_CENTER_INSET);
  const sidePocketRadius = SIDE_POCKET_RADIUS * POCKET_VISUAL_EXPANSION;

  // Derive exact cushion extents from the chrome pocket arcs so the rails stop
  // precisely where each pocket begins.
  const cornerCenterX = innerHalfW - cornerInset;
  const cornerCenterZ = innerHalfH - cornerInset;
  const cornerLineX = halfW - CUSHION_RAIL_FLUSH - CUSHION_LONG_RAIL_CENTER_NUDGE;
  const cornerLineZ = halfH - CUSHION_RAIL_FLUSH - CUSHION_SHORT_RAIL_CENTER_NUDGE;
  const cornerDeltaX = cornerLineX - cornerCenterX;
  const cornerDeltaZ = cornerLineZ - cornerCenterZ;
  const cornerReachX = Math.sqrt(
    Math.max(cornerPocketRadius * cornerPocketRadius - cornerDeltaZ * cornerDeltaZ, 0)
  );
  const cornerReachZ = Math.sqrt(
    Math.max(cornerPocketRadius * cornerPocketRadius - cornerDeltaX * cornerDeltaX, 0)
  );
  const cornerIntersectionX = cornerCenterX - cornerReachX;
  const cornerIntersectionZ = cornerCenterZ - cornerReachZ;
  const cornerCushionClearanceX = Math.max(0, cornerLineX - cornerIntersectionX);
  const cornerCushionClearanceZ = Math.max(0, cornerLineZ - cornerIntersectionZ);
  const rawCornerCushionClearance = Math.max(
    cornerCushionClearanceX,
    cornerCushionClearanceZ
  );
  const cornerCushionClearance = Math.max(
    0,
    rawCornerCushionClearance - CUSHION_CORNER_CLEARANCE_REDUCTION
  );
  const horizontalCushionLength = Math.max(
    MICRO_EPS,
    PLAY_W - 2 * cornerCushionClearance
  );
  const sideLineX =
    halfW - CUSHION_RAIL_FLUSH - CUSHION_LONG_RAIL_CENTER_NUDGE + SIDE_CUSHION_RAIL_REACH;
  const sideDeltaX = sidePocketCenterX - sideLineX;
  const sidePocketReach = Math.sqrt(
    Math.max(sidePocketRadius * sidePocketRadius - sideDeltaX * sideDeltaX, 0)
  );
  const adjustedSidePocketReach = Math.max(
    0,
    sidePocketReach - SIDE_CUSHION_POCKET_REACH_REDUCTION
  );
  const verticalCushionLength = Math.max(
    MICRO_EPS,
    Math.max(0, cornerIntersectionZ - adjustedSidePocketReach)
  );
  const verticalCushionCenter =
    adjustedSidePocketReach +
    verticalCushionLength / 2 +
    SIDE_CUSHION_CORNER_SHIFT;

  const chromePlateThickness = railH * CHROME_PLATE_THICKNESS_SCALE; // mirror snooker fascia thickness using rail height as the driver
  const sideChromePlateThickness = chromePlateThickness * CHROME_SIDE_PLATE_THICKNESS_BOOST; // match middle-pocket fascia depth to snooker
  const chromePlateInset = TABLE.THICK * 0.02;
  const chromeCornerPlateTrim =
    TABLE.THICK * (0.03 + CHROME_CORNER_FIELD_TRIM_SCALE);
  const cushionInnerX = halfW - CUSHION_RAIL_FLUSH - CUSHION_LONG_RAIL_CENTER_NUDGE;
  const cushionInnerZ = halfH - CUSHION_RAIL_FLUSH - CUSHION_SHORT_RAIL_CENTER_NUDGE;
  const chromePlateInnerLimitX = Math.max(0, cushionInnerX);
  const chromePlateInnerLimitZ = Math.max(0, cushionInnerZ);
  const chromeCornerMeetX = Math.max(0, horizontalCushionLength / 2);
  const chromeCornerMeetZ = Math.max(0, cornerIntersectionZ);
  const sideChromeMeetZ = Math.max(0, adjustedSidePocketReach);
  const chromePlateExpansionX = Math.max(
    0,
    (chromePlateInnerLimitX - chromeCornerMeetX) * CHROME_CORNER_EXPANSION_SCALE
  );
  const chromePlateExpansionZ = Math.max(
    0,
    (chromePlateInnerLimitZ - chromeCornerMeetZ) * CHROME_CORNER_SIDE_EXPANSION_SCALE
  );
  const chromePlateBaseWidth = Math.max(
    MICRO_EPS,
    outerHalfW - chromePlateInset - chromePlateInnerLimitX + chromePlateExpansionX -
      chromeCornerPlateTrim
  );
  const chromePlateBaseHeight = Math.max(
    MICRO_EPS,
    outerHalfH - chromePlateInset - chromePlateInnerLimitZ + chromePlateExpansionZ -
      chromeCornerPlateTrim
  );
  const chromeCornerEdgeTrim = TABLE.THICK * CHROME_CORNER_EDGE_TRIM_SCALE;
  const chromeOuterFlushTrim = TABLE.THICK * CHROME_OUTER_FLUSH_TRIM_SCALE;
  const chromePlateWidth = Math.max(
    MICRO_EPS,
    chromePlateBaseWidth * CHROME_CORNER_WIDTH_SCALE -
      chromeCornerEdgeTrim -
      chromeOuterFlushTrim * 2
  );
  const chromeCornerFieldExtension =
    POCKET_VIS_R * CHROME_CORNER_FIELD_EXTENSION_SCALE * POCKET_VISUAL_EXPANSION;
  const chromePlateHeight = Math.max(
    MICRO_EPS,
    chromePlateBaseHeight * CHROME_CORNER_HEIGHT_SCALE -
      chromeCornerEdgeTrim +
      chromeCornerFieldExtension -
      chromeOuterFlushTrim * 2
  );
  const chromePlateRadius = Math.min(
    outerCornerRadius * 0.95,
    chromePlateWidth / 2,
    chromePlateHeight / 2
  );
  const chromePlateY =
    railsTopY - chromePlateThickness + MICRO_EPS * 2;
  const sideChromePlateY =
    railsTopY - sideChromePlateThickness + MICRO_EPS * 2;
  const chromeCornerCenterOutset =
    TABLE.THICK * CHROME_CORNER_CENTER_OUTSET_SCALE;
  const chromeCornerShortRailShift =
    TABLE.THICK * CHROME_CORNER_SHORT_RAIL_SHIFT_SCALE;
  const chromeCornerShortRailCenterPull =
    TABLE.THICK * CHROME_CORNER_SHORT_RAIL_CENTER_PULL_SCALE;

  const sidePlatePocketWidth = sidePocketRadius * 2 * CHROME_SIDE_PLATE_POCKET_SPAN_SCALE;
  const sidePlateMaxWidth = Math.max(
    MICRO_EPS,
    outerHalfW - chromePlateInset - chromePlateInnerLimitX - TABLE.THICK * 0.08
  );
  const sideChromePlateWidthExpansion = TABLE.THICK * CHROME_SIDE_PLATE_WIDTH_EXPANSION_SCALE;
  let sideChromePlateWidth = Math.max(
    MICRO_EPS,
    Math.min(sidePlatePocketWidth, sidePlateMaxWidth) -
      TABLE.THICK * CHROME_SIDE_PLATE_CENTER_TRIM_SCALE +
      sideChromePlateWidthExpansion -
      chromeOuterFlushTrim * 2
  );
  sideChromePlateWidth = Math.max(
    MICRO_EPS,
    sideChromePlateWidth * CHROME_SIDE_PLATE_WIDTH_REDUCTION_SCALE
  );
  const sideChromeOuterExtension =
    TABLE.THICK * CHROME_SIDE_PLATE_OUTER_EXTENSION_SCALE;
  const sidePlateHalfHeightLimit = Math.max(
    0,
    chromePlateInnerLimitZ - TABLE.THICK * 0.08
  );
  const sidePlateHeightByCushion = Math.max(
    MICRO_EPS,
    Math.min(sidePlateHalfHeightLimit, sideChromeMeetZ) * 2
  );
  const sideChromePlateHeight = Math.min(
    Math.max(MICRO_EPS, chromePlateHeight * CHROME_SIDE_PLATE_HEIGHT_SCALE - chromeOuterFlushTrim * 2),
    Math.max(MICRO_EPS, sidePlateHeightByCushion)
  );
  const sideChromePlateRadius = Math.min(
    chromePlateRadius * 0.3,
    Math.min(sideChromePlateWidth, sideChromePlateHeight) * CHROME_SIDE_PLATE_CORNER_LIMIT_SCALE
  );

  const circlePoly = (cx, cz, r, seg = 96) => {
    const pts = [];
    for (let i = 0; i < seg; i++) {
      const t = (i / seg) * Math.PI * 2;
      pts.push([cx + Math.cos(t) * r, cz + Math.sin(t) * r]);
    }
    pts.push(pts[0]);
    return [[pts]];
  };
  const rectPoly = (w, h) => [[[
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
    [-w / 2, -h / 2]
  ]]];
  const boxPoly = (minx, minz, maxx, maxz) => [[[
    [minx, minz],
    [maxx, minz],
    [maxx, maxz],
    [minx, maxz],
    [minx, minz]
  ]]];
  const roundedRectPoly = (
    cx,
    cz,
    width,
    height,
    radius,
    segments = 96
  ) => {
    const hw = width / 2;
    const hh = height / 2;
    if (hw <= MICRO_EPS || hh <= MICRO_EPS) {
      const pts = [
        [cx - hw, cz - hh],
        [cx + hw, cz - hh],
        [cx + hw, cz + hh],
        [cx - hw, cz + hh],
        [cx - hw, cz - hh]
      ];
      return [[pts]];
    }
    const r = Math.max(0, Math.min(radius, hw, hh));
    const pts = [];
    const cornerSegBase = Math.max(2, Math.floor(segments / 4));
    const addCorner = (centerX, centerZ, start, end, includeFirst = false) => {
      const sweep = end - start;
      const steps = Math.max(1, Math.ceil((Math.abs(sweep) / (Math.PI / 2)) * cornerSegBase));
      for (let i = 0; i <= steps; i++) {
        if (!includeFirst && i === 0) continue;
        const t = start + (sweep * i) / steps;
        const x = cx + centerX + Math.cos(t) * r;
        const z = cz + centerZ + Math.sin(t) * r;
        pts.push([x, z]);
      }
    };

    if (r <= MICRO_EPS) {
      pts.push([cx - hw, cz + hh]);
      pts.push([cx + hw, cz + hh]);
      pts.push([cx + hw, cz - hh]);
      pts.push([cx - hw, cz - hh]);
    } else {
      addCorner(-hw + r, hh - r, Math.PI, Math.PI / 2, true);
      addCorner(hw - r, hh - r, Math.PI / 2, 0);
      addCorner(hw - r, -hh + r, 0, -Math.PI / 2);
      addCorner(-hw + r, -hh + r, -Math.PI / 2, -Math.PI);
    }

    if (pts.length) {
      const first = pts[0];
      const last = pts[pts.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        pts.push([first[0], first[1]]);
      }
    }
    return [[pts]];
  };
  const cornerFieldFilletPoly = (cx, cz, sx, sz, radius, segments = 64) => {
    if (radius <= MICRO_EPS) {
      return null;
    }
    const axisXAngle = sx > 0 ? 0 : Math.PI;
    const axisZAngle = sz > 0 ? Math.PI / 2 : -Math.PI / 2;
    let startAngle = axisXAngle;
    let endAngle = axisZAngle;
    let sweep = endAngle - startAngle;
    if (sweep <= 0) {
      endAngle += Math.PI * 2;
      sweep = endAngle - startAngle;
    }
    if (sweep > Math.PI) {
      startAngle = axisZAngle;
      endAngle = axisXAngle;
      sweep = endAngle - startAngle;
      if (sweep <= 0) {
        endAngle += Math.PI * 2;
        sweep = endAngle - startAngle;
      }
    }
    if (sweep <= MICRO_EPS) {
      return null;
    }
    const steps = Math.max(2, Math.ceil((segments * Math.abs(sweep)) / (Math.PI / 2)));
    const pts = [[cx, cz]];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = startAngle + sweep * t;
      const x = cx + Math.cos(angle) * radius;
      const z = cz + Math.sin(angle) * radius;
      pts.push([x, z]);
    }
    pts.push([cx, cz]);
    return [[pts]];
  };
  const ringArea = (ring) => signedRingArea(ring);

  const cornerNotchMP = (sx, sz) => {
    const cx = sx * (innerHalfW - cornerInset);
    const cz = sz * (innerHalfH - cornerInset);
    const notchCircle = circlePoly(
      cx,
      cz,
      cornerPocketRadius * CHROME_CORNER_POCKET_RADIUS_SCALE
    );
    const x1 = cx;
    const x2 = cx + sx * cornerChamfer;
    const z1 = cz - sz * cornerChamfer;
    const z2 = cz + sz * cornerChamfer;
    const boxX = boxPoly(Math.min(x1, x2), Math.min(z1, z2), Math.max(x1, x2), Math.max(z1, z2));
    const x3 = cx - sx * cornerChamfer;
    const x4 = cx + sx * cornerChamfer;
    const z3 = cz;
    const z4 = cz + sz * cornerChamfer;
    const boxZ = boxPoly(Math.min(x3, x4), Math.min(z3, z4), Math.max(x3, x4), Math.max(z3, z4));
    const fieldClipWidth = cornerChamfer * CHROME_CORNER_FIELD_CLIP_WIDTH_SCALE;
    const fieldClipDepth = cornerChamfer * CHROME_CORNER_FIELD_CLIP_DEPTH_SCALE;
    const wedgeDepth = cornerChamfer * Math.max(0, CHROME_CORNER_NOTCH_WEDGE_SCALE);
    const unionParts = [notchCircle, boxX, boxZ];
    if (fieldClipWidth > MICRO_EPS && fieldClipDepth > MICRO_EPS) {
      const filletRadius =
        Math.min(fieldClipWidth, fieldClipDepth) * CHROME_CORNER_FIELD_FILLET_SCALE;
      const fillet = cornerFieldFilletPoly(cx, cz, sx, sz, filletRadius);
      if (fillet) {
        unionParts.push(fillet);
      } else {
        unionParts.push([
          [
            [cx, cz],
            [cx + sx * fieldClipWidth, cz],
            [cx, cz + sz * fieldClipDepth],
            [cx, cz]
          ]
        ]);
      }
    }
    if (wedgeDepth > MICRO_EPS) {
      unionParts.push([
        [
          [cx, cz],
          [cx - sx * wedgeDepth, cz],
          [cx, cz - sz * wedgeDepth],
          [cx, cz]
        ]
      ]);
    }
    const union = safePolygonUnion(...unionParts);
    const adjusted = adjustCornerNotchDepth(union, cz, sz);
    if (CHROME_CORNER_NOTCH_EXPANSION_SCALE === 1) {
      return adjusted;
    }
    return scaleMultiPolygon(adjusted, CHROME_CORNER_NOTCH_EXPANSION_SCALE);
  };

  const sideNotchMP = (sx) => {
    const cx = sx * sidePocketCenterX;
    const radius = sidePocketRadius * CHROME_SIDE_POCKET_RADIUS_SCALE;
    const throatLength = Math.max(0, radius * CHROME_SIDE_NOTCH_THROAT_SCALE);
    const throatHeight = Math.max(0, radius * 2.4 * CHROME_SIDE_NOTCH_HEIGHT_SCALE);
    const throatRadius = Math.max(
      0,
      Math.min(throatHeight / 2, radius * CHROME_SIDE_NOTCH_RADIUS_SCALE)
    );

    const circle = circlePoly(cx, 0, radius, 256);
    const useThroat =
      throatLength > MICRO_EPS && throatHeight > MICRO_EPS && throatRadius > MICRO_EPS;

    if (!useThroat) {
      return adjustSideNotchDepth(circle);
    }

    const throat = roundedRectPoly(
      cx + (sx * throatLength) / 2,
      0,
      Math.abs(throatLength),
      throatHeight,
      throatRadius,
      192
    );
    const union = safePolygonUnion(circle, throat);
    return adjustSideNotchDepth(union);
  };

  // Chrome plate cuts are the authoritative arcs; every other surface borrows them verbatim.
  const scalePocketCutMP = (mp, scale) => {
    if (!Array.isArray(mp)) {
      return mp;
    }
    if (scale === 1) {
      return mp;
    }
    const scaled = scaleMultiPolygon(mp, scale);
    return Array.isArray(scaled) && scaled.length ? scaled : mp;
  };

  const scaleChromeCornerPocketCut = (mp) =>
    scalePocketCutMP(mp, CHROME_CORNER_POCKET_CUT_SCALE);
  const scaleChromeSidePocketCut = (mp) =>
    scalePocketCutMP(mp, CHROME_SIDE_POCKET_CUT_SCALE);
  const translatePocketCutMP = (mp, sx, sz, offset) => {
    if (!Array.isArray(mp) || !mp.length) {
      return mp;
    }
    if (!Number.isFinite(offset) || Math.abs(offset) <= MICRO_EPS) {
      return mp;
    }
    const dx = -sx * offset;
    const dz = -sz * offset;
    if (!Number.isFinite(dx) || !Number.isFinite(dz)) {
      return mp;
    }
    if (Math.abs(dx) <= MICRO_EPS && Math.abs(dz) <= MICRO_EPS) {
      return mp;
    }
    return mp.map((poly) => {
      if (!Array.isArray(poly)) return poly;
      return poly.map((ring) => {
        if (!Array.isArray(ring)) return ring;
        return ring.map((pt) => {
          if (!Array.isArray(pt) || pt.length < 2) return pt;
          const [x, z] = pt;
          return [x + dx, z + dz];
        });
      });
    });
  };
  const scaleWoodRailCornerPocketCut = (mp) =>
    scalePocketCutMP(
      scaleChromeCornerPocketCut(mp),
      WOOD_RAIL_POCKET_RELIEF_SCALE * WOOD_CORNER_RAIL_POCKET_RELIEF_SCALE
    );
  const scaleWoodRailSidePocketCut = (mp, sx = 1) => {
    const scaled = scalePocketCutMP(
      scaleChromeSidePocketCut(mp),
      WOOD_RAIL_POCKET_RELIEF_SCALE * WOOD_SIDE_RAIL_POCKET_RELIEF_SCALE
    );
    const sideSign = Math.sign(sx) || 1;
    return translatePocketCutMP(
      scaled,
      sideSign,
      0,
      TABLE.THICK * WOOD_SIDE_POCKET_CUT_CENTER_OUTSET_SCALE
    );
  };

  const carbonFiberPatternCanvas = (() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#07090f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0c111a';
    ctx.fillRect(0, 0, canvas.width / 2, canvas.height / 2);
    ctx.fillRect(
      canvas.width / 2,
      canvas.height / 2,
      canvas.width / 2,
      canvas.height / 2
    );
    ctx.fillStyle = '#131926';
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width, 0);
    ctx.lineTo(0, canvas.height);
    ctx.lineTo(0, canvas.height / 2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(canvas.width, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let i = -canvas.width; i <= canvas.width; i += canvas.width / 4) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + canvas.width, canvas.height);
      ctx.stroke();
    }
    return canvas;
  })();

  const createCarbonLabelTexture = ({
    width = 2048,
    height = 512,
    lines = [],
    borderWidth = 22,
    padding = 64,
    studScale = 0.18
  } = {}) => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(64, Math.floor(width));
    canvas.height = Math.max(64, Math.floor(height));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const pattern = carbonFiberPatternCanvas
      ? ctx.createPattern(carbonFiberPatternCanvas, 'repeat')
      : null;
    ctx.fillStyle = pattern || '#0c1018';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (pattern) {
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    const gloss = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gloss.addColorStop(0, 'rgba(255,255,255,0.12)');
    gloss.addColorStop(0.45, 'rgba(255,255,255,0.05)');
    gloss.addColorStop(1, 'rgba(0,0,0,0.36)');
    ctx.fillStyle = gloss;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const borderGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    borderGrad.addColorStop(0, '#f7e5c0');
    borderGrad.addColorStop(0.45, '#d9b45c');
    borderGrad.addColorStop(1, '#f0deb0');
    ctx.lineWidth = borderWidth;
    ctx.strokeStyle = borderGrad;
    const inset = borderWidth / 2 + 6;
    ctx.strokeRect(inset, inset, canvas.width - inset * 2, canvas.height - inset * 2);

    const studRadius =
      Math.min(canvas.width, canvas.height) * Math.max(0, studScale) * 0.08;
    if (studRadius > 0) {
      const studGradient = (x, y) => {
        const g = ctx.createRadialGradient(
          x - studRadius * 0.32,
          y - studRadius * 0.34,
          studRadius * 0.14,
          x,
          y,
          studRadius * 1.12
        );
        g.addColorStop(0, '#fff9e6');
        g.addColorStop(0.3, '#f6e1ac');
        g.addColorStop(0.58, '#d5a634');
        g.addColorStop(1, '#6f5016');
        return g;
      };
      const studHighlight = (x, y) => {
        const h = ctx.createRadialGradient(
          x - studRadius * 0.18,
          y - studRadius * 0.3,
          0,
          x - studRadius * 0.18,
          y - studRadius * 0.3,
          studRadius * 0.55
        );
        h.addColorStop(0, 'rgba(255,255,255,0.95)');
        h.addColorStop(1, 'rgba(255,255,255,0)');
        return h;
      };
      const studRim = (x, y) => {
        const rim = ctx.createRadialGradient(
          x,
          y,
          studRadius * 0.6,
          x,
          y,
          studRadius * 1.08
        );
        rim.addColorStop(0, 'rgba(64,42,8,0.35)');
        rim.addColorStop(1, 'rgba(28,18,4,0.9)');
        return rim;
      };
      const studPadding = Math.max(padding * 0.5, studRadius * 2.4);
      const studs = [
        [studPadding, studPadding],
        [canvas.width - studPadding, studPadding],
        [canvas.width - studPadding, canvas.height - studPadding],
        [studPadding, canvas.height - studPadding]
      ];
      studs.forEach(([x, y]) => {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = studRadius * 0.6;
        ctx.shadowOffsetY = studRadius * 0.14;
        ctx.fillStyle = studGradient(x, y);
        ctx.beginPath();
        ctx.arc(x, y, studRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = studHighlight(x, y);
        ctx.beginPath();
        ctx.arc(x, y, studRadius * 0.62, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = Math.max(2, studRadius * 0.22);
        ctx.strokeStyle = studRim(x, y);
        ctx.stroke();
        ctx.restore();
      });
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const usableWidth = canvas.width - padding * 2;
    const measured = lines.map((line) => {
      const baseSize = Math.max(12, (line.size ?? 0.3) * canvas.height);
      let fontSize = baseSize;
      const weight = line.weight ?? '700';
      ctx.font = `${weight} ${fontSize}px "Inter", Arial`;
      const text = line.text ?? '';
      const textWidth = ctx.measureText(text).width;
      if (textWidth > usableWidth) {
        fontSize = (usableWidth / Math.max(textWidth, 1e-3)) * fontSize;
      }
      return { text, size: fontSize, weight };
    });
    const lineGap = canvas.height * 0.08;
    const totalHeight = measured.reduce(
      (sum, line, index) => sum + line.size + (index > 0 ? lineGap : 0),
      0
    );
    const startY = (canvas.height - totalHeight) / 2;
    const textGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    textGradient.addColorStop(0, '#fff3d0');
    textGradient.addColorStop(0.45, '#d3b15a');
    textGradient.addColorStop(1, '#f7e5ba');
    let cursorY = startY;
    measured.forEach((line) => {
      const y = cursorY + line.size / 2;
      ctx.font = `${line.weight} ${line.size}px "Inter", Arial`;
      ctx.fillStyle = textGradient;
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 18;
      ctx.fillText(line.text, canvas.width / 2, y);
      ctx.shadowBlur = 0;
      cursorY += line.size + lineGap;
    });

    const texture = new THREE.CanvasTexture(canvas);
    applySRGBColorSpace(texture);
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = resolveTextureAnisotropy(texture.anisotropy ?? 1);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    return texture;
  };

  const createBrandPlateLabelTexture = ({
    width = 2048,
    height = 512,
    lines = []
  } = {}) => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(64, Math.floor(width));
    canvas.height = Math.max(64, Math.floor(height));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const fontFamily = '"Inter", "Segoe UI", Arial, sans-serif';
    const textGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    textGradient.addColorStop(0, '#fff3d0');
    textGradient.addColorStop(0.45, '#d3b15a');
    textGradient.addColorStop(1, '#f7e5ba');
    const payload = Array.isArray(lines) && lines.length
      ? lines
      : [{ text: 'TonPlaygram', size: 0.34, weight: '800' }];
    payload.forEach((line, idx) => {
      const size = Math.max(12, (line.size ?? 0.34) * canvas.height);
      const weight = line.weight ?? '700';
      const y = canvas.height * (0.5 + (idx - (payload.length - 1) / 2) * 0.32);
      ctx.font = `${weight} ${size}px ${fontFamily}`;
      ctx.fillStyle = textGradient;
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = canvas.height * 0.02;
      ctx.fillText(line.text ?? '', canvas.width / 2, y);
      ctx.shadowBlur = 0;
    });
    const texture = new THREE.CanvasTexture(canvas);
    applySRGBColorSpace(texture);
    texture.needsUpdate = true;
    return texture;
  };

  const buildBrandPlateTopMaterial = (baseMaterial, labelTexture) => {
    if (!baseMaterial) return null;
    const mat = baseMaterial.clone();
    mat.color.set(0xffffff);
    mat.emissive = new THREE.Color(CHALK_EMISSIVE_COLOR);
    mat.emissiveIntensity = 0.18;
    mat.emissiveMap = labelTexture || null;
    mat.needsUpdate = true;
    return mat;
  };

  const chromePlates = new THREE.Group();
  const chromePlateShapeSegments = 128;
  const chromePlateMat = applyChromePlateDamping(trimMat) ?? trimMat;
  // Every chrome plate (corner and side) relies on the exact chrome-defined arcs without referencing woodwork.
  [
    { corner: 'topLeft', sx: -1, sz: -1 },
    { corner: 'topRight', sx: 1, sz: -1 },
    { corner: 'bottomRight', sx: 1, sz: 1 },
    { corner: 'bottomLeft', sx: -1, sz: 1 }
  ].forEach(({ corner, sx, sz }) => {
    const centerX =
      sx * (outerHalfW - chromePlateWidth / 2 - chromePlateInset + chromeCornerCenterOutset) -
      sx * chromeCornerShortRailCenterPull;
    const centerZ =
      sz * (outerHalfH - chromePlateHeight / 2 - chromePlateInset + chromeCornerCenterOutset) +
      sz * chromeCornerShortRailShift;
    // Chrome plates use their own rounded cuts as-is; nothing references the wooden rail arches.
    const notchMP = translatePocketCutMP(
      scaleChromeCornerPocketCut(cornerNotchMP(sx, sz)),
      sx,
      sz,
      CORNER_RAIL_NOTCH_INSET
    );
    const notchLocalMP = notchMP.map((poly) =>
      poly.map((ring) =>
        ring.map(([x, z]) => [x - centerX, -(z - centerZ)])
      )
    );
    const plate = new THREE.Mesh(
      buildChromePlateGeometry({
        width: chromePlateWidth,
        height: chromePlateHeight,
        radius: chromePlateRadius,
        thickness: chromePlateThickness,
        corner,
        notchMP: notchLocalMP,
        shapeSegments: chromePlateShapeSegments
      }),
      chromePlateMat
    );
    plate.userData.isChromePlate = true;
    plate.position.set(
      centerX,
      chromePlateY + chromePlateThickness,
      centerZ
    );
    plate.castShadow = false;
    plate.receiveShadow = false;
    plate.renderOrder = CHROME_PLATE_RENDER_ORDER;
    chromePlates.add(plate);
    finishParts.trimMeshes.push(plate);
  });

  const sideChromePlateOutwardShift =
    TABLE.THICK * CHROME_SIDE_PLATE_OUTWARD_SHIFT_SCALE;
  const sideChromeOuterEdgeLimit = Math.max(
    MICRO_EPS,
    outerHalfW - chromePlateInset + sideChromeOuterExtension
  );

  [
    { id: 'sideLeft', sx: -1 },
    { id: 'sideRight', sx: 1 }
  ].forEach(({ id, sx }) => {
    let plateWidth = sideChromePlateWidth + sideChromeOuterExtension;
    const baseCenterX =
      sx *
      (outerHalfW - sideChromePlateWidth / 2 - chromePlateInset + sideChromePlateOutwardShift +
        (sideChromePlateWidthExpansion * CHROME_SIDE_PLATE_CORNER_BIAS_SCALE) / 2);
    let centerX = baseCenterX + sx * (sideChromeOuterExtension / 2);
    const baseOuterEdge = Math.abs(centerX) + plateWidth / 2;
    if (baseOuterEdge > sideChromeOuterEdgeLimit) {
      const overrun = baseOuterEdge - sideChromeOuterEdgeLimit;
      plateWidth = Math.max(MICRO_EPS, plateWidth - overrun * 2);
      centerX = Math.sign(centerX) * Math.max(0, Math.abs(centerX) - overrun);
    }
    const centerZ = 0;
    const notchMP = scaleChromeSidePocketCut(sideNotchMP(sx));
    const sidePocketCutCenterPull =
      TABLE.THICK * CHROME_SIDE_POCKET_CUT_CENTER_PULL_SCALE;
    const notchLocalMP = notchMP.map((poly) =>
      poly.map((ring) =>
        ring.map(([x, z]) => [x - centerX - sx * sidePocketCutCenterPull, -(z - centerZ)])
      )
    );
    const plate = new THREE.Mesh(
      buildChromePlateGeometry({
        width: plateWidth,
        height: sideChromePlateHeight,
        radius: sideChromePlateRadius,
        thickness: sideChromePlateThickness,
        corner: id,
        notchMP: notchLocalMP,
        shapeSegments: chromePlateShapeSegments
      }),
      chromePlateMat
    );
    plate.userData.isChromePlate = true;
    plate.position.set(
      centerX,
      sideChromePlateY + sideChromePlateThickness,
      centerZ
    );
    plate.castShadow = false;
    plate.receiveShadow = false;
    plate.renderOrder = CHROME_PLATE_RENDER_ORDER;
    chromePlates.add(plate);
    finishParts.trimMeshes.push(plate);
  });
  railsGroup.add(chromePlates);

  const pocketJawGroup = new THREE.Group();

  const buildPocketJawShape = ({
    center,
    baseRadius,
    jawAngle,
    orientationAngle,
    innerScale,
    outerScale,
    steps,
    sideThinFactor,
    middleThinFactor,
    centerEase,
    clampOuter,
    outerExpansion = 0,
    taperHoldOverride,
    edgeTaperScaleOverride,
    edgeProfilePowerOverride,
    edgeTrim
  }) => {
    if (!(center instanceof THREE.Vector2)) {
      return null;
    }
    if (!Number.isFinite(baseRadius) || baseRadius <= MICRO_EPS) {
      return null;
    }
    if (!Number.isFinite(jawAngle) || jawAngle <= MICRO_EPS) {
      return null;
    }

    const halfAngle = jawAngle / 2;
    const startAngle = orientationAngle - halfAngle;
    const endAngle = orientationAngle + halfAngle;
    const innerBaseRadius = Math.max(MICRO_EPS, baseRadius * innerScale);
    let outerLimit = Math.max(innerBaseRadius + MICRO_EPS, baseRadius * outerScale);
    if (Number.isFinite(clampOuter) && clampOuter > innerBaseRadius + MICRO_EPS) {
      outerLimit = Math.min(outerLimit, clampOuter);
      outerLimit = Math.max(innerBaseRadius + MICRO_EPS, outerLimit);
    }
    const baseThickness = Math.max(MICRO_EPS, outerLimit - innerBaseRadius);
    const outerExpansionAmount = Number.isFinite(outerExpansion)
      ? Math.max(0, outerExpansion)
      : 0;

    const edgeTaperScale = Number.isFinite(edgeTaperScaleOverride)
      ? edgeTaperScaleOverride
      : POCKET_JAW_EDGE_TAPER_SCALE;
    const profilePower = THREE.MathUtils.clamp(
      Number.isFinite(edgeProfilePowerOverride)
        ? edgeProfilePowerOverride
        : POCKET_JAW_EDGE_TAPER_PROFILE_POWER,
      1,
      5
    );

    const edgeFactor = THREE.MathUtils.clamp(sideThinFactor ?? 0.32, 0.1, 0.9);
    const edgeThickness = Math.max(
      MICRO_EPS * 12,
      baseThickness * edgeFactor * edgeTaperScale
    );
    const edgeInnerRadius = Math.max(
      innerBaseRadius + MICRO_EPS * 6,
      outerLimit - edgeThickness
    );

    const middleFactor = THREE.MathUtils.clamp(middleThinFactor ?? 0.85, 0, 1);
    const centerThicknessRatio = THREE.MathUtils.lerp(
      POCKET_JAW_CENTER_THICKNESS_MIN,
      POCKET_JAW_CENTER_THICKNESS_MAX,
      middleFactor
    );
    let centerOuterRadius = innerBaseRadius + baseThickness * centerThicknessRatio;
    centerOuterRadius = Math.min(outerLimit - MICRO_EPS * 4, centerOuterRadius);
    centerOuterRadius = Math.max(innerBaseRadius + MICRO_EPS * 4, centerOuterRadius);

    const easeFactor = THREE.MathUtils.clamp(centerEase ?? 0.3, 0.1, 0.9);
    const easeT = THREE.MathUtils.clamp((easeFactor - 0.1) / 0.8, 0, 1);
    const outerPower = THREE.MathUtils.lerp(
      POCKET_JAW_OUTER_EXPONENT_MAX,
      POCKET_JAW_OUTER_EXPONENT_MIN,
      easeT
    );
    const innerPower = THREE.MathUtils.lerp(
      POCKET_JAW_INNER_EXPONENT_MAX,
      POCKET_JAW_INNER_EXPONENT_MIN,
      easeT
    );

    const requestedSteps =
      Number.isFinite(steps) && steps > 0 ? Math.floor(steps) : null;
    const segmentCount = requestedSteps
      ? Math.max(POCKET_JAW_SEGMENT_MIN, requestedSteps)
      : Math.max(POCKET_JAW_SEGMENT_MIN, Math.ceil((jawAngle / Math.PI) * 128));

    const midAngle = (startAngle + endAngle) / 2;
    const outerPts = [];
    const innerPts = [];

    const taperHold = THREE.MathUtils.clamp(
      Number.isFinite(taperHoldOverride) ? taperHoldOverride : POCKET_JAW_CENTER_TAPER_HOLD,
      0,
      0.6
    );

    for (let i = 0; i <= segmentCount; i++) {
      const t = i / segmentCount;
      const theta = startAngle + t * (endAngle - startAngle);
      const normalized = Math.abs(theta - midAngle) / halfAngle;
      const clamped = THREE.MathUtils.clamp(normalized, 0, 1);
      let taperNormalized = clamped;
      if (taperHold > MICRO_EPS) {
        if (taperNormalized <= taperHold) {
          taperNormalized = 0;
        } else {
          taperNormalized = THREE.MathUtils.clamp(
            (taperNormalized - taperHold) / (1 - taperHold),
            0,
            1
          );
        }
      }
      const taperProfile = taperNormalized <= 0
        ? 0
        : taperNormalized >= 1
          ? 1
          : Math.pow(taperNormalized, profilePower);
      const eased = taperProfile <= 0
        ? 0
        : taperProfile >= 1
          ? 1
          : THREE.MathUtils.smootherstep(taperProfile, 0, 1);
      const outerWeight = Math.pow(eased, outerPower);
      const innerWeight = Math.pow(eased, innerPower);

      let outerRadius = THREE.MathUtils.lerp(
        centerOuterRadius,
        outerLimit,
        outerWeight
      );
      if (Number.isFinite(clampOuter) && clampOuter > innerBaseRadius + MICRO_EPS) {
        const flushBlend = THREE.MathUtils.smootherstep(
          clamped,
          POCKET_JAW_EDGE_FLUSH_START,
          POCKET_JAW_EDGE_FLUSH_END
        );
        outerRadius = Math.min(
          clampOuter,
          THREE.MathUtils.lerp(outerRadius, clampOuter, flushBlend)
        );
      }
      outerRadius = Math.max(outerRadius, innerBaseRadius + MICRO_EPS * 4);
      if (outerExpansionAmount > MICRO_EPS) {
        const maxOuterRadius = Number.isFinite(clampOuter) && clampOuter > innerBaseRadius + MICRO_EPS
          ? clampOuter + outerExpansionAmount
          : outerLimit + outerExpansionAmount;
        outerRadius = Math.min(maxOuterRadius, outerRadius + outerExpansionAmount);
        outerRadius = Math.max(outerRadius, innerBaseRadius + MICRO_EPS * 4);
      }
      if (edgeTrim && edgeTrim.scale < 1) {
        const trimStart = THREE.MathUtils.clamp(edgeTrim.start ?? 0.6, 0, 0.95);
        if (trimStart < 1 - MICRO_EPS && clamped > trimStart) {
          const trimCurve = THREE.MathUtils.clamp(edgeTrim.curve ?? 1, 1, 4);
          const trimT = THREE.MathUtils.clamp(
            (clamped - trimStart) / (1 - trimStart),
            0,
            1
          );
          const trimWeight = Math.pow(trimT, trimCurve);
          const trimFactor = THREE.MathUtils.lerp(1, edgeTrim.scale, trimWeight);
          const trimmedOuterRadius = innerBaseRadius + (outerRadius - innerBaseRadius) * trimFactor;
          outerRadius = Math.min(outerRadius, trimmedOuterRadius);
        }
      }

      let innerRadius = THREE.MathUtils.lerp(
        innerBaseRadius,
        edgeInnerRadius,
        innerWeight
      );
      innerRadius = Math.min(innerRadius, outerRadius - MICRO_EPS * 6);
      innerRadius = Math.max(innerBaseRadius, innerRadius);

      const outerX = center.x + Math.cos(theta) * outerRadius;
      const outerZ = center.y + Math.sin(theta) * outerRadius;
      outerPts.push(new THREE.Vector2(outerX, outerZ));

      const innerX = center.x + Math.cos(theta) * innerRadius;
      const innerZ = center.y + Math.sin(theta) * innerRadius;
      innerPts.unshift(new THREE.Vector2(innerX, innerZ));
    }

    if (!outerPts.length || !innerPts.length) {
      return null;
    }

    const outline = [...outerPts, ...innerPts];
    const first = outline[0];
    const last = outline[outline.length - 1];
    if (!first.equals(last)) {
      outline.push(first.clone());
    }
    const shape = new THREE.Shape();
    shape.autoClose = true;
    shape.setFromPoints(outline);
    return shape;
  };

  const createPocketJawAssembly = ({
    center,
    baseRadius,
    jawAngle,
    orientationAngle,
    wide,
    isMiddle,
    clampOuter,
    outerExpansion
  }) => {
    const baseInnerScale = wide
      ? POCKET_JAW_SIDE_INNER_SCALE
      : POCKET_JAW_CORNER_INNER_SCALE;
    const baseOuterScale = wide
      ? POCKET_JAW_SIDE_OUTER_SCALE
      : POCKET_JAW_CORNER_OUTER_SCALE;
    let effectiveBaseRadius = baseRadius;
    let localClampOuter = clampOuter;
    let localJawAngle = jawAngle;
    let depthMultiplier = 1;
    let steps = wide ? 132 : 104;

    if (isMiddle) {
      localJawAngle *= SIDE_POCKET_JAW_LATERAL_EXPANSION;
      depthMultiplier = SIDE_POCKET_JAW_DEPTH_EXPANSION;
      steps = Math.max(steps, Math.ceil(steps * SIDE_POCKET_JAW_LATERAL_EXPANSION));
      if (Number.isFinite(localClampOuter) && localClampOuter > 0) {
        localClampOuter *= SIDE_POCKET_JAW_RADIUS_EXPANSION;
        effectiveBaseRadius = localClampOuter / baseOuterScale;
      } else {
        effectiveBaseRadius = baseRadius * SIDE_POCKET_JAW_RADIUS_EXPANSION;
      }
    } else {
      localJawAngle *= CORNER_POCKET_JAW_LATERAL_EXPANSION;
      steps = Math.max(
        steps,
        Math.ceil(steps * CORNER_POCKET_JAW_LATERAL_EXPANSION)
      );
    }

    const taperHoldOverride = isMiddle
      ? POCKET_JAW_SIDE_CENTER_TAPER_HOLD
      : POCKET_JAW_CENTER_TAPER_HOLD;
    const edgeTaperScaleOverride = isMiddle
      ? POCKET_JAW_SIDE_EDGE_TAPER_SCALE
      : POCKET_JAW_EDGE_TAPER_SCALE;
    const edgeProfilePowerOverride = isMiddle
      ? POCKET_JAW_SIDE_EDGE_TAPER_PROFILE_POWER
      : POCKET_JAW_EDGE_TAPER_PROFILE_POWER;

    const jawShape = buildPocketJawShape({
      center,
      baseRadius: effectiveBaseRadius,
      jawAngle: localJawAngle,
      orientationAngle,
      innerScale: baseInnerScale,
      outerScale: baseOuterScale,
      steps,
      sideThinFactor: wide ? POCKET_JAW_SIDE_EDGE_FACTOR : POCKET_JAW_CORNER_EDGE_FACTOR,
      middleThinFactor: wide ? POCKET_JAW_SIDE_MIDDLE_FACTOR : POCKET_JAW_CORNER_MIDDLE_FACTOR,
      centerEase: 0.36,
      clampOuter: localClampOuter,
      outerExpansion: outerExpansion,
      taperHoldOverride,
      edgeTaperScaleOverride,
      edgeProfilePowerOverride,
      edgeTrim:
        wide && SIDE_POCKET_JAW_EDGE_TRIM_SCALE < 1
          ? {
              start: SIDE_POCKET_JAW_EDGE_TRIM_START,
              scale: SIDE_POCKET_JAW_EDGE_TRIM_SCALE,
              curve: SIDE_POCKET_JAW_EDGE_TRIM_CURVE
            }
          : null
    });
    if (!jawShape) {
      return null;
    }
    const jawVerticalOffset = isMiddle ? SIDE_POCKET_JAW_VERTICAL_TWEAK : 0;
    const jawTopY = railsTopY + POCKET_JAW_VERTICAL_LIFT + jawVerticalOffset;
    let jawDepth = Math.max(
      MICRO_EPS,
      railH * POCKET_JAW_DEPTH_SCALE * depthMultiplier
    );
    const clearance = Math.max(0, POCKET_JAW_BOTTOM_CLEARANCE);
    const pocketFloorY =
      pocketTopY -
      TABLE.THICK +
      POCKET_JAW_FLOOR_CONTACT_LIFT +
      (isMiddle ? SIDE_POCKET_PLYWOOD_LIFT : 0);
    const safeBottomY = pocketFloorY + clearance;
    const maxJawDepth = jawTopY - safeBottomY;
    if (Number.isFinite(maxJawDepth)) {
      const limitedDepth = Math.max(MICRO_EPS, maxJawDepth - MICRO_EPS * 0.5);
      jawDepth = Math.min(jawDepth, limitedDepth);
    }
    const clothAlignedDepth = jawTopY - clothBottomY;
    if (Number.isFinite(clothAlignedDepth)) {
      jawDepth = Math.min(jawDepth, Math.max(MICRO_EPS, clothAlignedDepth));
    }
    const jawGeom = new THREE.ExtrudeGeometry(jawShape, {
      depth: jawDepth,
      bevelEnabled: false,
      curveSegments: Math.max(144, Math.ceil(localJawAngle / (Math.PI / 96))),
      steps: 1
    });
    jawGeom.rotateX(-Math.PI / 2);
    jawGeom.translate(0, -jawDepth, 0);
    jawGeom.computeVertexNormals();
    const jawMesh = new THREE.Mesh(jawGeom, pocketJawMat);
    jawMesh.position.y = jawTopY;
    jawMesh.castShadow = false;
    jawMesh.receiveShadow = true;

    const group = new THREE.Group();
    group.add(jawMesh);

    let rimMesh = null;
    const rimDepthRatio = isMiddle ? SIDE_POCKET_RIM_DEPTH_RATIO : POCKET_RIM_DEPTH_RATIO;
    if (rimDepthRatio > MICRO_EPS) {
      const rimShape = jawShape.clone();
      const rimDepth = Math.max(MICRO_EPS, jawDepth * rimDepthRatio);
      const rimGeom = new THREE.ExtrudeGeometry(rimShape, {
        depth: rimDepth,
        bevelEnabled: false,
        curveSegments: Math.max(128, Math.ceil(localJawAngle / (Math.PI / 112))),
        steps: 1
      });
      rimGeom.rotateX(-Math.PI / 2);
      rimGeom.translate(0, -rimDepth, 0);
      rimGeom.computeVertexNormals();
      rimMesh = new THREE.Mesh(rimGeom, pocketRimMat);
      const rimOffsetScale = isMiddle
        ? SIDE_POCKET_RIM_SURFACE_OFFSET_SCALE
        : POCKET_RIM_SURFACE_OFFSET_SCALE;
      const rimAbsoluteLift = isMiddle
        ? SIDE_POCKET_RIM_SURFACE_ABSOLUTE_LIFT
        : POCKET_RIM_SURFACE_ABSOLUTE_LIFT;
      const rimVerticalLift = Math.max(rimAbsoluteLift, railH * rimOffsetScale);
      rimMesh.position.y =
        railsTopY + POCKET_JAW_VERTICAL_LIFT + jawVerticalOffset + rimVerticalLift;
      rimMesh.castShadow = false;
      rimMesh.receiveShadow = false;
      group.add(rimMesh);
    }

    return { group, jawMesh, rimMesh };
  };

  const addPocketJaw = (config) => {
    const assembly = createPocketJawAssembly(config);
    if (!assembly) return;
    pocketJawGroup.add(assembly.group);
    finishParts.pocketJawMeshes.push(assembly.jawMesh);
    if (assembly.rimMesh) {
      finishParts.pocketRimMeshes.push(assembly.rimMesh);
    }
  };

  const CORNER_JAW_ANGLE = THREE.MathUtils.degToRad(CORNER_JAW_ARC_DEG);
  const SIDE_JAW_ANGLE = THREE.MathUtils.degToRad(SIDE_JAW_ARC_DEG);

  // Each pocket jaw must match 100% to the rounded chrome plate cuts—never the wooden rail arches.
  // Repeat: each pocket jaw must match 100% to the size of the rounded cuts on the chrome plates.
  const cornerJawOuterLimit =
    cornerPocketRadius *
    CHROME_CORNER_POCKET_RADIUS_SCALE *
    CHROME_CORNER_POCKET_CUT_SCALE *
    POCKET_JAW_CORNER_OUTER_LIMIT_SCALE;
  const sideJawOuterLimit =
    sidePocketRadius *
    CHROME_SIDE_POCKET_RADIUS_SCALE *
    CHROME_SIDE_POCKET_CUT_SCALE *
    POCKET_JAW_SIDE_OUTER_LIMIT_SCALE;

  const resolveBaseRadius = (outerLimit, outerScale) => {
    if (!Number.isFinite(outerLimit) || outerLimit <= MICRO_EPS) {
      return null;
    }
    if (!Number.isFinite(outerScale) || outerScale <= MICRO_EPS) {
      return null;
    }
    return outerLimit / outerScale;
  };

  const cornerBaseRadius = resolveBaseRadius(
    cornerJawOuterLimit,
    POCKET_JAW_CORNER_OUTER_SCALE
  );
  const sideBaseRadius = resolveBaseRadius(
    sideJawOuterLimit,
    POCKET_JAW_SIDE_OUTER_SCALE
  );

  const resolvePocketCenter = (mp, fallbackX, fallbackZ) => {
    if (Array.isArray(mp) && mp.length) {
      for (let i = 0; i < mp.length; i++) {
        const poly = mp[i];
        if (!Array.isArray(poly) || !poly.length) continue;
        const outerRing = poly[0];
        if (!Array.isArray(outerRing) || !outerRing.length) continue;
        const centroid = centroidFromRing(outerRing);
        if (centroid && Number.isFinite(centroid.x) && Number.isFinite(centroid.y)) {
          return new THREE.Vector2(centroid.x, centroid.y);
        }
      }
    }
    return new THREE.Vector2(fallbackX, fallbackZ);
  };

  if (cornerBaseRadius && cornerBaseRadius > MICRO_EPS) {
    [
      { sx: 1, sz: 1 },
      { sx: -1, sz: 1 },
      { sx: -1, sz: -1 },
      { sx: 1, sz: -1 }
    ].forEach(({ sx, sz }) => {
      const baseMP = cornerNotchMP(sx, sz);
      const fallbackCenter = new THREE.Vector2(
        sx * (innerHalfW - cornerInset),
        sz * (innerHalfH - cornerInset)
      );
      const center = resolvePocketCenter(baseMP, fallbackCenter.x, fallbackCenter.y);
      const orientationAngle = Math.atan2(sz, sx);
      addPocketJaw({
        center,
        baseRadius: cornerBaseRadius,
        jawAngle: CORNER_JAW_ANGLE,
        orientationAngle,
        wide: false,
        isMiddle: false,
        clampOuter: cornerJawOuterLimit,
        outerExpansion: POCKET_JAW_CORNER_OUTER_EXPANSION
      });
    });
  }

  if (sideBaseRadius && sideBaseRadius > MICRO_EPS) {
    [-1, 1].forEach((sx) => {
      const baseMP = sideNotchMP(sx);
      const fallbackCenter = new THREE.Vector2(sx * sidePocketCenterX, 0);
      const center = resolvePocketCenter(baseMP, fallbackCenter.x, fallbackCenter.y);
      center.x += sx * SIDE_POCKET_JAW_OUTWARD_SHIFT;
      const orientationAngle = Math.atan2(0, sx);
      addPocketJaw({
        center,
        baseRadius: sideBaseRadius,
        jawAngle: SIDE_JAW_ANGLE,
        orientationAngle,
        wide: true,
        isMiddle: true,
        clampOuter: sideJawOuterLimit,
        outerExpansion: SIDE_POCKET_JAW_OUTER_EXPANSION
      });
    });
  }

  if (pocketJawGroup.children.length) {
    railsGroup.add(pocketJawGroup);
  }

  if (accentConfig && finishParts.dimensions) {
    const accentMesh = createAccentMesh(accentConfig, finishParts.dimensions);
    if (accentMesh) {
      railsGroup.add(accentMesh);
      finishParts.accentMesh = accentMesh;
    }
  }

  // Rail openings simply reuse the chrome plate cuts; wood never dictates alternate pocket sizing.
  let openingMP = safePolygonUnion(
    rectPoly(innerHalfW * 2, innerHalfH * 2),
    ...scaleWoodRailSidePocketCut(sideNotchMP(-1), -1),
    ...scaleWoodRailSidePocketCut(sideNotchMP(1), 1)
  );
  openingMP = safePolygonUnion(
    openingMP,
    ...translatePocketCutMP(
      scaleWoodRailCornerPocketCut(cornerNotchMP(1, 1)),
      1,
      1,
      CORNER_RAIL_NOTCH_INSET
    ),
    ...translatePocketCutMP(
      scaleWoodRailCornerPocketCut(cornerNotchMP(-1, 1)),
      -1,
      1,
      CORNER_RAIL_NOTCH_INSET
    ),
    ...translatePocketCutMP(
      scaleWoodRailCornerPocketCut(cornerNotchMP(-1, -1)),
      -1,
      -1,
      CORNER_RAIL_NOTCH_INSET
    ),
    ...translatePocketCutMP(
      scaleWoodRailCornerPocketCut(cornerNotchMP(1, -1)),
      1,
      -1,
      CORNER_RAIL_NOTCH_INSET
    )
  );

  const railsOuter = new THREE.Shape();
  if (hasRoundedRailCorners) {
    railsOuter.moveTo(outerHalfW, -outerHalfH + outerCornerRadius);
    railsOuter.lineTo(outerHalfW, outerHalfH - outerCornerRadius);
    railsOuter.absarc(
      outerHalfW - outerCornerRadius,
      outerHalfH - outerCornerRadius,
      outerCornerRadius,
      0,
      Math.PI / 2,
      false
    );
    railsOuter.lineTo(-outerHalfW + outerCornerRadius, outerHalfH);
    railsOuter.absarc(
      -outerHalfW + outerCornerRadius,
      outerHalfH - outerCornerRadius,
      outerCornerRadius,
      Math.PI / 2,
      Math.PI,
      false
    );
    railsOuter.lineTo(-outerHalfW, -outerHalfH + outerCornerRadius);
    railsOuter.absarc(
      -outerHalfW + outerCornerRadius,
      -outerHalfH + outerCornerRadius,
      outerCornerRadius,
      Math.PI,
      1.5 * Math.PI,
      false
    );
    railsOuter.lineTo(outerHalfW - outerCornerRadius, -outerHalfH);
    railsOuter.absarc(
      outerHalfW - outerCornerRadius,
      -outerHalfH + outerCornerRadius,
      outerCornerRadius,
      -Math.PI / 2,
      0,
      false
    );
  } else {
    railsOuter.moveTo(outerHalfW, -outerHalfH);
    railsOuter.lineTo(outerHalfW, outerHalfH);
    railsOuter.lineTo(-outerHalfW, outerHalfH);
    railsOuter.lineTo(-outerHalfW, -outerHalfH);
    railsOuter.lineTo(outerHalfW, -outerHalfH);
  }

  openingMP.forEach((poly) => {
    if (!poly?.length) return;
    const ring = poly[0];
    if (!ring?.length) return;
    const pts = ring.slice(0, -1);
    if (!pts.length) return;
    const clockwise = ringArea(ring) < 0;
    const ordered = clockwise ? pts : pts.slice().reverse();
    const hole = new THREE.Path();
    hole.moveTo(ordered[0][0], ordered[0][1]);
    for (let i = 1; i < ordered.length; i++) {
      hole.lineTo(ordered[i][0], ordered[i][1]);
    }
    hole.closePath();
    railsOuter.holes.push(hole);
  });

  let railsGeom = new THREE.ExtrudeGeometry(railsOuter, {
    depth: railH,
    bevelEnabled: false,
    curveSegments: 128
  });
  railsGeom = softenOuterExtrudeEdges(railsGeom, railH, RAIL_OUTER_EDGE_RADIUS_RATIO, {
    innerBounds: {
      halfWidth: Math.max(cushionInnerX, 0),
      halfHeight: Math.max(cushionInnerZ, 0),
      padding: TABLE.THICK * 0.04
    }
  });
  railsGeom = projectRailUVs(railsGeom, { outerHalfW, outerHalfH, railH });
  const railsMesh = new THREE.Mesh(railsGeom, railMat);
  railsMesh.rotation.x = -Math.PI / 2;
  railsMesh.position.y = frameTopY;
  railsMesh.castShadow = true;
  railsMesh.receiveShadow = false;
  railsGroup.add(railsMesh);
  finishParts.railMeshes.push(railsMesh);

  const brandPlateTexture =
    createCarbonLabelTexture({
      width: 2048,
      height: 512,
      lines: [{ text: 'TonPlaygram', size: 0.34, weight: '800' }],
      borderWidth: Math.max(TABLE.THICK * 5.5, 20),
      padding: 140,
      studScale: 0.2
    }) || null;
  const brandPlateTopMaterial = brandPlateTexture
    ? new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        map: brandPlateTexture,
        metalness: 0.52,
        roughness: 0.3,
        clearcoat: 0.48,
        clearcoatRoughness: 0.2,
        sheen: 0.28,
        sheenRoughness: 0.5,
        emissive: new THREE.Color(CHALK_EMISSIVE_COLOR),
        emissiveIntensity: 0.14
      })
    : new THREE.MeshPhysicalMaterial({
        color: CHALK_TOP_COLOR,
        metalness: 0.42,
        roughness: 0.32,
        clearcoat: 0.32
      });
  const brandAccentColor = new THREE.Color(0xd4b163);
  const createBrandSideMaterial = () => {
    const mat = trimMat.clone();
    enhanceChromeMaterial(mat);
    mat.color.lerp(brandAccentColor, 0.42);
    mat.metalness = Math.min(1, (mat.metalness ?? 0) + 0.12);
    mat.roughness = Math.max(0.06, (mat.roughness ?? 0.4) * 0.74);
    mat.clearcoat = Math.max(mat.clearcoat ?? 0.28, 0.42);
    mat.clearcoatRoughness = Math.min(mat.clearcoatRoughness ?? 0.32, 0.32);
    mat.sheen = Math.max(mat.sheen ?? 0.12, 0.2);
    mat.sheenRoughness = Math.min(mat.sheenRoughness ?? 0.6, 0.6);
    return mat;
  };
  const brandPlateThickness = chromePlateThickness;
  const brandPlateDepth = Math.min(endRailW * 0.48, TABLE.THICK * 0.72);
  const brandPlateWidth = Math.min(PLAY_W * 0.4, Math.max(BALL_R * 12, PLAY_W * 0.32));
  const brandPlateY = railsTopY + brandPlateThickness * 0.5 + MICRO_EPS * 8;
  const shortRailCenterZ = halfH + endRailW * 0.5;
  const brandPlateOutwardShift = endRailW * 0.26;
  const brandPlateGeom = new THREE.BoxGeometry(
    brandPlateWidth,
    brandPlateThickness,
    brandPlateDepth
  );
  [-1, 1].forEach((dirZ) => {
    const materials = [
      createBrandSideMaterial(),
      createBrandSideMaterial(),
      brandPlateTopMaterial,
      createBrandSideMaterial(),
      createBrandSideMaterial(),
      createBrandSideMaterial()
    ];
    const plate = new THREE.Mesh(brandPlateGeom, materials);
    plate.position.set(0, brandPlateY, dirZ * (shortRailCenterZ + brandPlateOutwardShift));
    plate.castShadow = true;
    plate.receiveShadow = true;
    plate.renderOrder = CHROME_PLATE_RENDER_ORDER + 0.2;
    railsGroup.add(plate);
    const sideMaterials = Array.isArray(plate.material)
      ? plate.material.filter((_, index) => index !== 2)
      : [];
    finishParts.brandPlates.push({
      mesh: plate,
      sideMaterials,
      topMaterial: brandPlateTopMaterial
    });
  });

  let activeRailMarkerStyle =
    railMarkerStyle && typeof railMarkerStyle === 'object'
      ? {
          shape: railMarkerStyle.shape ?? DEFAULT_RAIL_MARKER_SHAPE,
          colorId: railMarkerStyle.colorId ?? DEFAULT_RAIL_MARKER_COLOR_ID
        }
      : { shape: DEFAULT_RAIL_MARKER_SHAPE, colorId: DEFAULT_RAIL_MARKER_COLOR_ID };
  const railMarkerOutset = longRailW * 0.62;
  const railMarkerGroup = new THREE.Group();
  const railMarkerThickness = RAIL_MARKER_THICKNESS;
  const railMarkerWidth = ORIGINAL_RAIL_WIDTH * 0.64;
  const railMarkerLength = railMarkerWidth * 0.62;
  const railMarkerShape = new THREE.Shape();
  railMarkerShape.moveTo(0, railMarkerLength / 2);
  railMarkerShape.lineTo(railMarkerWidth / 2, 0);
  railMarkerShape.lineTo(0, -railMarkerLength / 2);
  railMarkerShape.lineTo(-railMarkerWidth / 2, 0);
  railMarkerShape.closePath();
  const diamondGeometry = new THREE.ExtrudeGeometry(railMarkerShape, {
    depth: railMarkerThickness,
    bevelEnabled: true,
    bevelThickness: railMarkerThickness * 0.35,
    bevelSize: railMarkerThickness * 0.3,
    bevelSegments: 2
  });
  diamondGeometry.rotateX(-Math.PI / 2);
  const circleRadius = railMarkerWidth * 0.36;
  const circleShape = new THREE.Shape();
  circleShape.absarc(0, 0, circleRadius, 0, Math.PI * 2, false);
  const circleGeometry = new THREE.ExtrudeGeometry(circleShape, {
    depth: railMarkerThickness,
    bevelEnabled: true,
    bevelThickness: railMarkerThickness * 0.28,
    bevelSize: railMarkerThickness * 0.24,
    bevelSegments: 2,
    curveSegments: 48
  });
  circleGeometry.rotateX(-Math.PI / 2);
  const railMarkerGeometries = Object.freeze({
    diamond: diamondGeometry,
    circle: circleGeometry
  });
  const railMarkerMat = trimMat.clone();
  enhanceChromeMaterial(railMarkerMat);
  railMarkerMat.color.copy(trimMat.color);
  railMarkerMat.needsUpdate = true;
  const railMarkerLift = railsTopY + MICRO_EPS * 6;
  const railMarkerMeshes = [];
  const registerRailMarkerMesh = (mesh) => {
    railMarkerMeshes.push(mesh);
    finishParts.trimMeshes.push(mesh);
    railMarkerGroup.add(mesh);
  };
  const clearRailMarkerMeshes = () => {
    while (railMarkerMeshes.length) {
      const mesh = railMarkerMeshes.pop();
      const idx = finishParts.trimMeshes.indexOf(mesh);
      if (idx >= 0) {
        finishParts.trimMeshes.splice(idx, 1);
      }
      railMarkerGroup.remove(mesh);
    }
  };
  const applyRailMarkerStyleFn = (style = activeRailMarkerStyle, overrides = {}) => {
    const shapeId =
      railMarkerGeometries[style?.shape] && typeof style?.shape === 'string'
        ? style.shape
        : DEFAULT_RAIL_MARKER_SHAPE;
    const geometry =
      railMarkerGeometries[shapeId] ??
      railMarkerGeometries[DEFAULT_RAIL_MARKER_SHAPE];
    const colorOpt = resolveRailMarkerColorOption(style?.colorId);
    const baseTrim = overrides.trimMaterial ?? trimMat;
    railMarkerMat.copy(baseTrim);
    enhanceChromeMaterial(railMarkerMat);
    if (colorOpt?.color != null) {
      railMarkerMat.color.setHex(colorOpt.color);
    }
    if (typeof colorOpt?.metalness === 'number') {
      railMarkerMat.metalness = colorOpt.metalness;
    }
    if (typeof colorOpt?.roughness === 'number') {
      railMarkerMat.roughness = colorOpt.roughness;
    }
    if (typeof colorOpt?.clearcoat === 'number') {
      railMarkerMat.clearcoat = colorOpt.clearcoat;
    }
    if (typeof colorOpt?.clearcoatRoughness === 'number') {
      railMarkerMat.clearcoatRoughness = colorOpt.clearcoatRoughness;
    }
    if (typeof colorOpt?.sheen === 'number') {
      railMarkerMat.sheen = colorOpt.sheen;
    }
    if (typeof colorOpt?.sheenRoughness === 'number') {
      railMarkerMat.sheenRoughness = colorOpt.sheenRoughness;
    }
    railMarkerMat.needsUpdate = true;
    clearRailMarkerMeshes();
    const longDiamondSpacing = PLAY_H / 8;
    const shortDiamondSpacing = PLAY_W / 4;
    const longRailX = halfW + longRailW + railMarkerOutset;
    const shortRailZ = halfH + endRailW + railMarkerOutset;
    const addMarker = (x, z, rotation = 0) => {
      const mesh = new THREE.Mesh(geometry, railMarkerMat);
      mesh.position.set(x, railMarkerLift, z);
      mesh.rotation.y = rotation;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.renderOrder = CHROME_PLATE_RENDER_ORDER + 0.1;
      registerRailMarkerMesh(mesh);
    };
    [1, 2, 3, 5, 6, 7].forEach((step) => {
      const z = -PLAY_H / 2 + step * longDiamondSpacing;
      addMarker(longRailX, z, 0);
      addMarker(-longRailX, z, 0);
    });
    [1, 2, 3].forEach((step) => {
      const x = -PLAY_W / 2 + step * shortDiamondSpacing;
      addMarker(x, shortRailZ, Math.PI / 2);
      addMarker(x, -shortRailZ, Math.PI / 2);
    });
    activeRailMarkerStyle = { shape: shapeId, colorId: colorOpt.id };
  };
  applyRailMarkerStyleFn(activeRailMarkerStyle);
  railsGroup.add(railMarkerGroup);
  finishParts.railMarkerGroup = railMarkerGroup;
  table.userData.railMarkers = {
    applyStyle: (style, overrides) => applyRailMarkerStyleFn(style, overrides),
    updateBaseMaterial: (trimMaterial) =>
      applyRailMarkerStyleFn(activeRailMarkerStyle, { trimMaterial }),
    getStyle: () => ({ ...activeRailMarkerStyle })
  };

  table.add(railsGroup);

  const chalkTextures = (() => {
    const topTexture = createCarbonLabelTexture({
      width: 900,
      height: 900,
      lines: [
        { text: 'HIGH QUALITY', size: 0.18, weight: '800' },
        { text: 'TP', size: 0.36, weight: '900' },
        { text: 'CHALK', size: 0.2, weight: '800' }
      ],
      borderWidth: Math.max(TABLE.THICK * 5, 16),
      padding: 90,
      studScale: 0.12
    });
    const sideTexture = createCarbonLabelTexture({
      width: 900,
      height: 420,
      lines: [{ text: 'HIGH QUALITY TP CHALK', size: 0.26, weight: '800' }],
      borderWidth: Math.max(TABLE.THICK * 4, 14),
      padding: 80,
      studScale: 0.08
    });
    return { top: topTexture, side: sideTexture };
  })();

  const chalkGroup = new THREE.Group();
  const chalkScale = 0.5;
  const chalkSize = BALL_R * 1.92 * chalkScale;
  const chalkHeight = BALL_R * 1.35 * chalkScale;
  const chalkGeometry = new THREE.BoxGeometry(chalkSize, chalkHeight, chalkSize);
  const createChalkMaterials = () => {
    const top = new THREE.MeshPhysicalMaterial({
      color: chalkTextures.top ? 0xffffff : CHALK_TOP_COLOR,
      map: chalkTextures.top ?? null,
      roughness: 0.34,
      metalness: 0.5,
      clearcoat: 0.46,
      clearcoatRoughness: 0.18,
      sheen: 0.3,
      sheenRoughness: 0.5,
      emissive: new THREE.Color(CHALK_EMISSIVE_COLOR),
      emissiveIntensity: 0.2
    });
    const bottom = new THREE.MeshPhysicalMaterial({
      color: CHALK_BOTTOM_COLOR,
      roughness: 0.85,
      metalness: 0.08
    });
    const side = new THREE.MeshPhysicalMaterial({
      color: chalkTextures.side ? 0xffffff : CHALK_SIDE_COLOR,
      map: chalkTextures.side ?? null,
      roughness: 0.48,
      metalness: 0.32,
      clearcoat: 0.32,
      clearcoatRoughness: 0.22,
      emissive: new THREE.Color(CHALK_EMISSIVE_COLOR),
      emissiveIntensity: 0.16
    });
    return [
      side.clone(),
      side.clone(),
      top,
      bottom,
      side.clone(),
      side.clone()
    ];
  };
  const chalkBaseY = railsTopY + chalkHeight / 2;
  const sideRailCenterX = PLAY_W / 2 + longRailW * 0.5;
  const endRailCenterZ = PLAY_H / 2 + endRailW * 0.5;
  const chalkSideRailOffset = Math.min(
    longRailW * 0.32,
    Math.max(0, longRailW * 0.6 - chalkSize * 0.5)
  );
  const chalkEndRailOffset = Math.min(
    endRailW * 0.32,
    Math.max(0, endRailW * 0.6 - chalkSize * 0.5)
  );
  const chalkLongOffsetLimit = Math.max(0, PLAY_H / 2 - BALL_R * 3.5);
  const chalkShortOffsetLimit = Math.max(0, PLAY_W / 2 - BALL_R * 3.5);
  const chalkLongAxisOffset = Math.min(chalkLongOffsetLimit, PLAY_H * 0.32);
  const chalkShortAxisOffset = Math.min(chalkShortOffsetLimit, PLAY_W * 0.32);
  const chalkSlots = [
    {
      basePosition: new THREE.Vector3(-sideRailCenterX - chalkSideRailOffset, chalkBaseY, 0),
      tangent: new THREE.Vector3(0, 0, 1),
      defaultOffset: chalkLongAxisOffset,
      offsetLimits: { min: -chalkLongOffsetLimit, max: chalkLongOffsetLimit },
      rotationY: Math.PI / 2,
      rotationX: 0
    },
    {
      basePosition: new THREE.Vector3(-sideRailCenterX - chalkSideRailOffset, chalkBaseY, 0),
      tangent: new THREE.Vector3(0, 0, 1),
      defaultOffset: -chalkLongAxisOffset,
      offsetLimits: { min: -chalkLongOffsetLimit, max: chalkLongOffsetLimit },
      rotationY: Math.PI / 2,
      rotationX: 0
    },
    {
      basePosition: new THREE.Vector3(sideRailCenterX + chalkSideRailOffset, chalkBaseY, 0),
      tangent: new THREE.Vector3(0, 0, -1),
      defaultOffset: chalkLongAxisOffset,
      offsetLimits: { min: -chalkLongOffsetLimit, max: chalkLongOffsetLimit },
      rotationY: -Math.PI / 2,
      rotationX: 0
    },
    {
      basePosition: new THREE.Vector3(0, railsTopY + chalkSize / 2, -endRailCenterZ - chalkEndRailOffset),
      tangent: new THREE.Vector3(-1, 0, 0),
      defaultOffset: -chalkShortAxisOffset,
      offsetLimits: { min: -chalkShortOffsetLimit, max: chalkShortOffsetLimit },
      rotationY: 0,
      rotationX: Math.PI / 2
    },
    {
      basePosition: new THREE.Vector3(0, railsTopY + chalkSize / 2, endRailCenterZ + chalkEndRailOffset),
      tangent: new THREE.Vector3(1, 0, 0),
      defaultOffset: chalkShortAxisOffset,
      offsetLimits: { min: -chalkShortOffsetLimit, max: chalkShortOffsetLimit },
      rotationY: Math.PI,
      rotationX: Math.PI / 2
    }
  ];
  chalkSlots.forEach((slot, index) => {
    const mesh = new THREE.Mesh(chalkGeometry, createChalkMaterials());
    mesh.position
      .copy(slot.basePosition)
      .addScaledVector(slot.tangent, slot.defaultOffset ?? 0);
    mesh.rotation.set(slot.rotationX ?? 0, slot.rotationY ?? 0, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.visible = true;
    mesh.userData = {
      ...(mesh.userData || {}),
      isChalk: true,
      chalkIndex: index
    };
    chalkGroup.add(mesh);
    slot.position = mesh.position.clone();
    slot.currentOffset = slot.defaultOffset ?? 0;
  });
  table.add(chalkGroup);
  table.userData.chalks = chalkGroup.children.slice();
  table.userData.chalkSlots = chalkSlots;
  table.userData.chalkMeta = {
    slack: BALL_R * 0.35,
    sideReach: longRailW + chalkSideRailOffset + chalkSize * 0.5,
    endReach: endRailW + chalkEndRailOffset + chalkSize * 0.5,
    overlapThreshold: chalkSize * 0.6,
    nudgeDistance: chalkSize * 0.25
  };

  const FACE_SHRINK_LONG = 1;
  const FACE_SHRINK_SHORT = FACE_SHRINK_LONG;
  const NOSE_REDUCTION = 0.75;
  const CUSHION_UNDERCUT_BASE_LIFT = 0.44;
  const CUSHION_RAIL_BASE_LIFT = 0; // keep the cushion base flush with the cloth plane along the wooden rails
  const CUSHION_UNDERCUT_FRONT_REMOVAL = 0.42;
  const CUSHION_NOSE_FRONT_PULL_SCALE = 0.11; // extend only the exposed nose + undercut toward the playfield without moving the cushion base
  const CUSHION_FRONT_FIELD_EXPANSION = BALL_R * 0.5; // grow the exposed triangular faces toward the playfield without touching the rail side
  const cushionBaseY = CLOTH_TOP_LOCAL - MICRO_EPS + CUSHION_EXTRA_LIFT;
  const rawCushionHeight = Math.max(0, railsTopY - cushionBaseY);
  const cushionDrop = Math.min(CUSHION_HEIGHT_DROP, rawCushionHeight);
  const cushionHeightTarget = rawCushionHeight - cushionDrop;
  const cushionScaleBase = Math.max(0.001, cushionHeightTarget / railH);
  const GAP_STRIPES_ENABLED = false;
  const gapStripeThickness = Math.max(MICRO_EPS, TABLE.THICK * 0.02);
  const gapStripeHeight = Math.max(MICRO_EPS, cushionHeightTarget + TABLE.THICK * 0.06);
  const gapStripeLift = TABLE.THICK * 0.012;
  const gapStripePad = TABLE.THICK * 0.005;
  const gapStripeOutwardShift = TABLE.THICK * 0.03;

  function cushionProfileAdvanced(len, horizontal, cutAngles = {}) {
    const halfLen = len / 2;
    const thicknessScale = horizontal ? FACE_SHRINK_LONG : FACE_SHRINK_SHORT;
    const baseRailWidth = horizontal ? longRailW : endRailW;
    const baseThickness = baseRailWidth * thicknessScale;
    const backY = baseRailWidth / 2;
    const noseThickness = baseThickness * NOSE_REDUCTION;
    const frontY = backY - noseThickness;
    const defaultCutAngle = typeof cutAngles?.cutAngle === 'number' ? cutAngles.cutAngle : CUSHION_CUT_ANGLE;
    const leftCutAngle =
      typeof cutAngles?.leftCutAngle === 'number' ? cutAngles.leftCutAngle : defaultCutAngle;
    const rightCutAngle =
      typeof cutAngles?.rightCutAngle === 'number' ? cutAngles.rightCutAngle : defaultCutAngle;
    const minCutLength = baseThickness * 0.25;

    const computeCut = (angleDeg) => {
      const rad = THREE.MathUtils.degToRad(angleDeg);
      const tan = Math.tan(rad);
      const rawCut = tan > MICRO_EPS ? noseThickness / tan : minCutLength;
      return Math.max(minCutLength, rawCut);
    };

    let leftCut = computeCut(leftCutAngle);
    let rightCut = computeCut(rightCutAngle);
    const maxTotalCut = Math.max(MICRO_EPS, len - MICRO_EPS);
    const totalCut = leftCut + rightCut;
    if (totalCut > maxTotalCut) {
      const scale = maxTotalCut / totalCut;
      leftCut *= scale;
      rightCut *= scale;
    }

    const shape = new THREE.Shape();
    shape.moveTo(-halfLen, backY);
    shape.lineTo(halfLen, backY);
    shape.lineTo(halfLen - rightCut, frontY);
    shape.lineTo(-halfLen + leftCut, frontY);
    shape.lineTo(-halfLen, backY);

    const cushionBevel = Math.min(railH, baseThickness) * 0.12;
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: railH,
      bevelEnabled: true,
      bevelThickness: cushionBevel * 0.6,
      bevelSize: cushionBevel,
      bevelSegments: 4,
      curveSegments: 16
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
    const nosePull = baseThickness * CUSHION_NOSE_FRONT_PULL_SCALE;
    for (let i = 0; i < arr.length; i += 3) {
      const y = arr[i + 1];
      const z = arr[i + 2];
      const frontFactor = THREE.MathUtils.clamp((backY - y) / frontSpan, 0, 1);
      const taperedLift = CUSHION_UNDERCUT_FRONT_REMOVAL * frontFactor;
      const baseLiftBlend = THREE.MathUtils.lerp(
        CUSHION_RAIL_BASE_LIFT,
        CUSHION_UNDERCUT_BASE_LIFT,
        frontFactor
      );
      const lift = Math.min(baseLiftBlend + taperedLift, 0.94);
      const minAllowedZ = Math.max(0, minZ + depth * lift);
      if (z < minAllowedZ) arr[i + 2] = minAllowedZ;

      // Pull only the exposed nose toward the playfield so the top cushion profile
      // extends further inwards while the base that touches the rails/cloth stays put.
      const noseOffset = nosePull * frontFactor;
      if (noseOffset > 0) {
        const fieldExpansion = CUSHION_FRONT_FIELD_EXPANSION * frontFactor;
        arr[i + 1] = Math.min(arr[i + 1] - noseOffset - fieldExpansion, backY);
      }
    }
    const trimZ = Math.min(maxZ, minZ + depth * CUSHION_FIELD_CLIP_RATIO);
    if (trimZ > minZ) {
      for (let i = 0; i < arr.length; i += 3) {
        if (arr[i + 2] < trimZ) {
          arr[i + 2] = trimZ;
        }
      }
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }

  function addCushion(x, z, len, horizontal, flip = false) {
    const halfLen = len / 2;
    const orientationSign = flip ? -1 : 1;
    const worldZLeft = z + -halfLen * orientationSign;
    const worldZRight = z + halfLen * orientationSign;
    const leftCloserToCenter = Math.abs(worldZLeft) <= Math.abs(worldZRight);
    const side = horizontal ? (z >= 0 ? 1 : -1) : x >= 0 ? 1 : -1;
    const sidePocketCuts = !horizontal
      ? {
          leftCutAngle: leftCloserToCenter ? SIDE_CUSHION_CUT_ANGLE : CUSHION_CUT_ANGLE,
          rightCutAngle: leftCloserToCenter ? CUSHION_CUT_ANGLE : SIDE_CUSHION_CUT_ANGLE
        }
      : undefined;
    const geo = cushionProfileAdvanced(len, horizontal, sidePocketCuts);
    const mesh = new THREE.Mesh(geo, cushionMat);
    mesh.rotation.x = -Math.PI / 2;
    const orientationScale = horizontal ? SHORT_CUSHION_HEIGHT_SCALE : 1;
    const heightScale = Math.max(0.001, cushionScaleBase / orientationScale);
    mesh.scale.y = heightScale * orientationScale;
    mesh.renderOrder = 2;
    const group = new THREE.Group();
    group.add(mesh);
    group.position.set(x, cushionBaseY, z);
    if (!horizontal) group.rotation.y = Math.PI / 2;
    if (flip) group.rotation.y += Math.PI;

    if (horizontal) {
      group.position.z =
        side * (halfH - CUSHION_RAIL_FLUSH - CUSHION_SHORT_RAIL_CENTER_NUDGE);
    } else {
      const reach =
        halfW - CUSHION_RAIL_FLUSH - CUSHION_LONG_RAIL_CENTER_NUDGE + SIDE_CUSHION_RAIL_REACH;
      group.position.x = side * reach;
    }

    if (GAP_STRIPES_ENABLED) {
      const stripeShape = new THREE.Shape();
      stripeShape.moveTo(-halfLen, 0);
      stripeShape.lineTo(halfLen, 0);
      stripeShape.lineTo(halfLen, gapStripeHeight);
      stripeShape.lineTo(-halfLen, gapStripeHeight);
      stripeShape.lineTo(-halfLen, 0);
      const stripeGeom = new THREE.ExtrudeGeometry(stripeShape, {
        depth: gapStripeThickness,
        bevelEnabled: true,
        bevelThickness: gapStripeThickness * 0.45,
        bevelSize: gapStripeThickness * 0.45,
        bevelSegments: 3,
        curveSegments: 10,
        steps: 1
      });
      stripeGeom.translate(0, -gapStripeHeight / 2, -gapStripeThickness / 2);
      stripeGeom.computeVertexNormals();
      const stripe = new THREE.Mesh(stripeGeom, gapStripeMat);
      stripe.castShadow = false;
      stripe.receiveShadow = false;
      stripe.position.set(
        group.position.x,
        cushionBaseY + gapStripeHeight / 2 + gapStripeLift,
        group.position.z
      );
      if (!horizontal) {
        stripe.rotation.y = Math.PI / 2;
      }
      if (horizontal) {
        stripe.position.z += side * (gapStripeThickness / 2 + gapStripePad + gapStripeOutwardShift);
      } else {
        stripe.position.x += side * (gapStripeThickness / 2 + gapStripePad + gapStripeOutwardShift);
      }
      table.add(stripe);
      finishParts.gapFillMeshes.push(stripe);
    }

    group.userData = group.userData || {};
    group.userData.horizontal = horizontal;
    group.userData.side = side;
    table.add(group);
    table.userData.cushions.push(group);
  }

  const bottomZ = -halfH;
  const topZ = halfH;
  const leftX = -halfW;
  const rightX = halfW;

  addCushion(0, bottomZ, horizontalCushionLength, true, false);
  addCushion(0, topZ, horizontalCushionLength, true, true);

  addCushion(leftX, -verticalCushionCenter, verticalCushionLength, false, false);
  addCushion(leftX, verticalCushionCenter, verticalCushionLength, false, false);
  addCushion(rightX, -verticalCushionCenter, verticalCushionLength, false, true);
  addCushion(rightX, verticalCushionCenter, verticalCushionLength, false, true);

  const frameOuterX = outerHalfW;
  const frameOuterZ = outerHalfH;
  const frameExtensionDepth = Math.max(0, TABLE_H * 0.68 * SKIRT_DROP_MULTIPLIER * 1.5); // drop the wooden rail skirt 50% deeper for a taller frame
  const baseRailWidth = endRailW;
  if (frameExtensionDepth > MICRO_EPS) {
    const frameExtensionGeo = new THREE.ExtrudeGeometry(railsOuter, {
      depth: frameExtensionDepth,
      bevelEnabled: false,
      curveSegments: 128
    });
    projectRailUVs(frameExtensionGeo, {
      outerHalfW: frameOuterX,
      outerHalfH: frameOuterZ,
      railH: frameExtensionDepth
    });
    const frameExtension = new THREE.Mesh(frameExtensionGeo, frameMat);
    frameExtension.rotation.x = -Math.PI / 2;
    frameExtension.position.y = frameTopY - frameExtensionDepth + SKIRT_RAIL_GAP_FILL;
    frameExtension.castShadow = true;
    frameExtension.receiveShadow = true;
    table.add(frameExtension);
    finishParts.frameMeshes.push(frameExtension);
  }

  const legR = Math.min(TABLE.W, TABLE.H) * 0.055 * LEG_RADIUS_SCALE;
  const legTopLocal = frameTopY - TABLE.THICK;
  const legTopWorld = legTopLocal + TABLE_Y;
  const legBottomWorld = FLOOR_Y;
  const legReach = Math.max(legTopWorld - legBottomWorld, TABLE_H);
  const legH = legReach + LEG_TOP_OVERLAP;
  const legGeo = new THREE.CylinderGeometry(legR, legR, legH, 64);
  const legInset = baseRailWidth * 3.2;
  const legY = legTopLocal + LEG_TOP_OVERLAP - legH / 2;
  // Match the skirt/apron wood grain with the cue butt so the pattern reads
  // clearly from the player perspective.
  const baseFrameFallback = {
    repeat: TABLE_WOOD_REPEAT,
    rotation: 0,
    textureSize:
      resolvedWoodOption?.frame?.textureSize ?? resolvedWoodOption?.rail?.textureSize,
    mapUrl: resolvedWoodOption?.frame?.mapUrl ?? resolvedWoodOption?.rail?.mapUrl,
    roughnessMapUrl:
      resolvedWoodOption?.frame?.roughnessMapUrl ??
      resolvedWoodOption?.rail?.roughnessMapUrl,
    normalMapUrl:
      resolvedWoodOption?.frame?.normalMapUrl ?? resolvedWoodOption?.rail?.normalMapUrl
  };
  const woodFrameSurface = resolveWoodSurfaceConfig(
    resolvedWoodOption?.frame,
    resolvedWoodOption?.rail ?? baseFrameFallback
  );
  const synchronizedWoodSurface = {
    repeat: new THREE.Vector2(woodFrameSurface.repeat.x, woodFrameSurface.repeat.y),
    rotation: woodFrameSurface.rotation,
    textureSize: woodFrameSurface.textureSize,
    mapUrl: woodFrameSurface.mapUrl,
    roughnessMapUrl: woodFrameSurface.roughnessMapUrl,
    normalMapUrl: woodFrameSurface.normalMapUrl,
    woodRepeatScale
  };

  applyWoodTextureToMaterial(frameMat, synchronizedWoodSurface);
  if (legMat !== frameMat) {
    applyWoodTextureToMaterial(legMat, {
      ...synchronizedWoodSurface
    });
  }
  finishParts.woodSurfaces.frame = cloneWoodSurfaceConfig({
    ...woodFrameSurface,
    woodRepeatScale
  });

  // Force the rail grain direction and scale to match the skirt/apron below so
  // every side shares the exact same wood flow and texture density.
  const railSurfaceFromFrame = { ...synchronizedWoodSurface };

  applyWoodTextureToMaterial(railMat, railSurfaceFromFrame);

  finishParts.underlayMeshes.forEach((mesh) => {
    if (!mesh?.material || mesh.userData?.skipWoodTexture) return;
    const underlaySurface =
      mesh.userData?.baseMaterialKey === 'frame'
        ? synchronizedWoodSurface
        : railSurfaceFromFrame;
    applyWoodTextureToMaterial(mesh.material, underlaySurface);
    mesh.material.needsUpdate = true;
  });

  finishParts.woodSurfaces.rail = cloneWoodSurfaceConfig(railSurfaceFromFrame);
  [...finishParts.railMeshes, ...finishParts.frameMeshes].forEach((mesh) => {
    if (!mesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });

  const clearBaseMeshes = () => {
    finishParts.baseMeshes.forEach((mesh) => {
      table.remove(mesh);
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }
    });
    finishParts.baseMeshes = [];
    finishParts.legMeshes = finishParts.legMeshes.filter((mesh) => !mesh?.userData?.__basePart);
    finishParts.trimMeshes = finishParts.trimMeshes.filter((mesh) => !mesh?.userData?.__basePart);
    finishParts.frameMeshes = finishParts.frameMeshes.filter((mesh) => !mesh?.userData?.__basePart);
  };

  const baseContext = {
    frameOuterX,
    frameOuterZ,
    frameTopY,
    tableY: TABLE_Y,
    floorY: FLOOR_Y,
    renderer,
    legInset,
    legY,
    legR,
    legH,
    legGeo,
    legMat,
    railMat,
    frameMat,
    trimMat,
    halfW,
    halfH,
    skirtH: frameExtensionDepth,
    baseRailWidth
  };

  const addBaseMeshesToFinish = (parts = {}) => {
    const { meshes = [], legMeshes = [], trimMeshes = [], frameMeshes = [] } = parts;
    finishParts.baseMeshes = meshes;
    finishParts.legMeshes = finishParts.legMeshes
      .filter((mesh) => !mesh?.userData?.__basePart)
      .concat(legMeshes);
    finishParts.trimMeshes = finishParts.trimMeshes
      .filter((mesh) => !mesh?.userData?.__basePart)
      .concat(trimMeshes);
    finishParts.frameMeshes = finishParts.frameMeshes
      .filter((mesh) => !mesh?.userData?.__basePart)
      .concat(frameMeshes);
    meshes.forEach((mesh) => table.add(mesh));
  };

  const tagBasePart = (mesh, baseMaterialKey = null) => {
    if (!mesh) return mesh;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = {
      ...(mesh.userData || {}),
      __basePart: true,
      ...(baseMaterialKey ? { baseMaterialKey } : {})
    };
    return mesh;
  };

  const applyBaseMaterialToObject = (object, material, baseMaterialKey = null) => {
    if (!object || !material) return;
    object.traverse((child) => {
      if (!child?.isMesh) return;
      const nextMaterial = material.clone ? material.clone() : material;
      child.material = nextMaterial;
      tagBasePart(child, baseMaterialKey);
    });
    tagBasePart(object, baseMaterialKey);
  };

  const sharpenGltfTexture = (texture, { isColor = false } = {}) => {
    if (!texture) return;
    if (isColor) {
      applySRGBColorSpace(texture);
    }
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    const boostedAniso = resolveTextureAnisotropy((texture.anisotropy ?? 1) * 1.18);
    texture.anisotropy = boostedAniso;
    texture.needsUpdate = true;
  };

  const sharpenGltfMaterial = (material) => {
    if (!material) return material;
    const mat = material.clone ? material.clone() : material;
    const colorMaps = new Set(['map', 'emissiveMap']);
    ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap'].forEach((key) => {
      if (mat[key]) {
        sharpenGltfTexture(mat[key], { isColor: colorMaps.has(key) });
      }
    });
    mat.needsUpdate = true;
    return mat;
  };

  let polyhavenKtx2Loader = null;
  const polyhavenBaseTemplates = new Map();
  const polyhavenBasePromises = new Map();

  const ensurePolyhavenKtx2Loader = (renderer = null) => {
    if (!polyhavenKtx2Loader) {
      polyhavenKtx2Loader = new KTX2Loader();
      polyhavenKtx2Loader.setTranscoderPath(BASIS_TRANSCODER_PATH);
    }
    if (renderer) {
      try {
        polyhavenKtx2Loader.detectSupport(renderer);
      } catch (error) {
        console.warn('Pool Royale KTX2 support detection failed', error);
      }
    }
    return polyhavenKtx2Loader;
  };

  const createConfiguredGLTFLoader = (renderer = null) => {
    const loader = new GLTFLoader();
    loader.setCrossOrigin('anonymous');
    const draco = new DRACOLoader();
    draco.setDecoderPath(DRACO_DECODER_PATH);
    loader.setDRACOLoader(draco);
    const ktx2 = ensurePolyhavenKtx2Loader(renderer);
    loader.setKTX2Loader(ktx2);
    loader.setMeshoptDecoder?.(MeshoptDecoder);
    return loader;
  };

  const buildPolyhavenModelUrls = (assetId) => {
    if (!assetId) return [];
    const normalizedId = `${assetId}`.trim();
    return [
      `https://dl.polyhaven.org/file/ph-assets/Models/gltf/2k/${normalizedId}/${normalizedId}_2k.gltf`,
      `https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/${normalizedId}/${normalizedId}_1k.gltf`
    ];
  };

  const ensurePolyhavenBaseTemplate = (assetId, renderer = null) => {
    if (!assetId) {
      return Promise.reject(new Error('Missing Poly Haven asset id'));
    }
    if (polyhavenBaseTemplates.has(assetId)) {
      return Promise.resolve(polyhavenBaseTemplates.get(assetId));
    }
    if (polyhavenBasePromises.has(assetId)) {
      return polyhavenBasePromises.get(assetId);
    }
    const promise = (async () => {
      const loader = createConfiguredGLTFLoader(renderer);
      let lastError = null;
      const urls = buildPolyhavenModelUrls(assetId);
      for (const url of urls) {
        try {
          // eslint-disable-next-line no-await-in-loop
          const gltf = await loader.loadAsync(url);
          const scene = gltf?.scene || gltf?.scenes?.[0];
          if (!scene) throw new Error('Missing scene for Poly Haven base');
          polyhavenBaseTemplates.set(assetId, scene);
          return scene;
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError || new Error(`Failed to load Poly Haven model: ${assetId}`);
    })();
    polyhavenBasePromises.set(assetId, promise);
    promise.catch(() => polyhavenBasePromises.delete(assetId));
    return promise;
  };

  const clonePolyhavenBaseTemplate = (assetId) => {
    if (!assetId) return null;
    const template = polyhavenBaseTemplates.get(assetId);
    if (!template) return null;
    const clone = template.clone(true);
    clone.traverse((child) => {
      if (!child?.isMesh) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      const refreshed = materials.map((mat) => sharpenGltfMaterial(mat));
      child.material = Array.isArray(child.material) ? refreshed : refreshed[0] ?? child.material;
      child.castShadow = true;
      child.receiveShadow = true;
      tagBasePart(child);
    });
    tagBasePart(clone);
    return clone;
  };

  const createPolyhavenTableBaseBuilder = (
    assetId,
    {
      footprintScale = 1.08,
      footprintDepthScale = null,
      heightFill = 0.82,
      topInsetScale = 0.95,
      materialKey = null,
      matchTableFootprint = false
    } = {}
  ) => {
    return (ctx) => {
      const meshes = [];
      const legMeshes = [];
      const normalizeOptions = {
        topInset: ctx.skirtH * topInsetScale,
        fill: heightFill
      };
      const template = clonePolyhavenBaseTemplate(assetId);
      const asyncReady = template ? null : ensurePolyhavenBaseTemplate(assetId, ctx.renderer);
      const buildInstance = () => {
        const base = clonePolyhavenBaseTemplate(assetId);
        if (!base) return;
        const bounds = new THREE.Box3().setFromObject(base);
        const size = bounds.getSize(new THREE.Vector3());
        const targetWidth = ctx.frameOuterX * 2 * footprintScale;
        const targetDepth =
          ctx.frameOuterZ * 2 * (footprintDepthScale ?? footprintScale * 0.96);
        const widthScale = size.x > MICRO_EPS ? targetWidth / size.x : 1;
        const depthScale = size.z > MICRO_EPS ? targetDepth / size.z : 1;
        const uniformScale = Math.min(widthScale, depthScale);
        const scaleX = matchTableFootprint ? widthScale : uniformScale;
        const scaleZ = matchTableFootprint ? depthScale : uniformScale;
        if (
          Number.isFinite(scaleX) &&
          scaleX > 0 &&
          Number.isFinite(scaleZ) &&
          scaleZ > 0 &&
          Number.isFinite(uniformScale) &&
          uniformScale > 0
        ) {
          base.scale.set(scaleX, uniformScale, scaleZ);
        }
        base.updateMatrixWorld(true);
        const scaledBounds = new THREE.Box3().setFromObject(base);
        const offsetY = ctx.floorY - scaledBounds.min.y;
        base.position.set(0, offsetY, 0);
        base.updateMatrixWorld(true);
        const material =
          materialKey === 'rail'
            ? ctx.railMat
            : materialKey === 'trim'
              ? ctx.trimMat
              : null;
        if (material) {
          applyBaseMaterialToObject(base, material, materialKey);
        } else if (materialKey) {
          tagBasePart(base, materialKey);
        }
        meshes.push(base);
        base.traverse((child) => {
          if (child?.isMesh) {
            legMeshes.push(child);
          }
        });
      };
      if (template) {
        buildInstance();
      }
      return { meshes, legMeshes, normalizeOptions, asyncReady };
    };
  };

  const baseBuilders = {
    classicCylinders: (ctx) => {
      const pocketSafeInsetX = Math.min(ctx.frameOuterX, ctx.legInset + LEG_POCKET_CLEARANCE);
      const pocketSafeInsetZ = Math.min(
        ctx.frameOuterZ,
        ctx.legInset + LEG_POCKET_CLEARANCE * 0.72
      );
      const legZOffset = Math.max(
        0,
        ctx.frameOuterZ - pocketSafeInsetZ - CLASSIC_SHORT_RAIL_CENTER_PULL
      );
      const positions = [
        [-ctx.frameOuterX + pocketSafeInsetX, -legZOffset],
        [ctx.frameOuterX - pocketSafeInsetX, -legZOffset],
        [-ctx.frameOuterX + pocketSafeInsetX, legZOffset],
        [ctx.frameOuterX - pocketSafeInsetX, legZOffset]
      ];
      const legs = positions.map(([lx, lz]) => {
        const leg = new THREE.Mesh(ctx.legGeo, ctx.legMat);
        leg.position.set(lx, ctx.legY, lz);
        leg.castShadow = true;
        leg.receiveShadow = true;
        leg.userData = { ...(leg.userData || {}), __basePart: true };
        return leg;
      });
      return { meshes: legs, legMeshes: legs };
    },
    openPortal: (ctx) => {
      const meshes = [];
      const legMeshes = [];
      const frameWidth = ctx.frameOuterX * 0.9;
      const frameDepth = ctx.frameOuterZ * 0.26;
      const thickness = ctx.legR;
      const legWidth = thickness * 1.35;
      const legHeight = ctx.legH * 0.94;
      const legGeom = new THREE.BoxGeometry(legWidth, legHeight, frameDepth);
      const legOffsetX = Math.max(
        legWidth * 0.5,
        frameWidth - legWidth * 0.65 - PORTAL_LEG_CENTER_PULL
      );
      const legBaseY = ctx.floorY;
      const legY = legBaseY + legHeight / 2;
      const portalDepth = Math.max(0, ctx.frameOuterZ - (ctx.legInset + PORTAL_POCKET_CLEARANCE));
      const portalZ = Math.max(0, portalDepth * 0.88 - PORTAL_SHORT_RAIL_CENTER_PULL);
      const buildPortal = (signZ) => {
        const portal = new THREE.Group();
        [-1, 1].forEach((side) => {
          const leg = tagBasePart(new THREE.Mesh(legGeom, ctx.legMat));
          leg.position.set(side * legOffsetX, legY, 0);
          portal.add(leg);
          legMeshes.push(leg);
        });
        portal.position.set(0, 0, signZ * portalZ);
        portal.rotation.y = signZ < 0 ? 0 : Math.PI;
        meshes.push(portal);
      };
      [-1, 1].forEach((signZ) => buildPortal(signZ));
      return { meshes, legMeshes };
    },
    coffeeTableRound01: createPolyhavenTableBaseBuilder('coffee_table_round_01', {
      footprintScale: 0.98,
      footprintDepthScale: 1.06,
      heightFill: 0.8,
      topInsetScale: 0.96,
      materialKey: 'trim'
    }),
    gothicCoffeeTable: createPolyhavenTableBaseBuilder('gothic_coffee_table', {
      footprintScale: 1,
      footprintDepthScale: 1,
      heightFill: 0.94,
      topInsetScale: 0.98,
      materialKey: 'rail',
      matchTableFootprint: true
    }),
    woodenTable02Alt: createPolyhavenTableBaseBuilder('wooden_table_02', {
      footprintScale: 0.94,
      footprintDepthScale: 0.96,
      heightFill: 0.9,
      topInsetScale: 0.95,
      materialKey: 'rail',
      matchTableFootprint: true
    })
  };

  const normalizeBasePlacement = (meshes = [], options = {}) => {
    if (!Array.isArray(meshes) || meshes.length === 0) return;
    const topInset =
      Number.isFinite(options?.topInset) && options.topInset >= 0
        ? options.topInset
        : baseContext.skirtH * 0.1;
    const heightFill =
      Number.isFinite(options?.fill) && options.fill > 0 ? options.fill : BASE_HEIGHT_FILL;
    const bounds = new THREE.Box3();
    meshes.forEach((mesh) => {
      mesh.updateMatrixWorld(true);
      bounds.expandByObject(mesh);
    });
    if (bounds.isEmpty()) return;
    const availableBottom = baseContext.floorY + MICRO_EPS;
    const availableTop = baseContext.frameTopY - topInset;
    if (availableTop <= availableBottom) return;
    let height = Math.max(bounds.max.y - bounds.min.y, MICRO_EPS);
    const offsetToFloor = availableBottom - bounds.min.y;
    if (Math.abs(offsetToFloor) > 1e-6) {
      meshes.forEach((mesh) => {
        mesh.position.y += offsetToFloor;
        mesh.updateMatrixWorld(true);
      });
    }
    let adjustedTop = bounds.max.y + offsetToFloor;
    const availableSpan = availableTop - availableBottom;
    const targetHeight = availableSpan * heightFill;
    if (targetHeight > MICRO_EPS && height < targetHeight && availableSpan > 0) {
      const scaleY = targetHeight / height;
      meshes.forEach((mesh) => {
        mesh.scale.y *= scaleY;
        mesh.position.y = availableBottom + (mesh.position.y - availableBottom) * scaleY;
        mesh.updateMatrixWorld(true);
      });
      const grownBounds = new THREE.Box3();
      meshes.forEach((mesh) => grownBounds.expandByObject(mesh));
      height = Math.max(grownBounds.max.y - grownBounds.min.y, MICRO_EPS);
      adjustedTop = grownBounds.max.y;
    }
    if (adjustedTop > availableTop && availableTop > availableBottom) {
      const scaleY = Math.max(0.05, (availableTop - availableBottom) / height);
      meshes.forEach((mesh) => {
        mesh.scale.y *= scaleY;
        mesh.position.y = availableBottom + (mesh.position.y - availableBottom) * scaleY;
        mesh.updateMatrixWorld(true);
      });
      const finalBounds = new THREE.Box3();
      meshes.forEach((mesh) => finalBounds.expandByObject(mesh));
      const finalOffset = availableBottom - finalBounds.min.y;
      if (Math.abs(finalOffset) > 1e-6) {
        meshes.forEach((mesh) => {
          mesh.position.y += finalOffset;
          mesh.updateMatrixWorld(true);
        });
      }
    }
  };

  const resolveBaseVariantId = (variant) => {
    if (variant && typeof variant === 'object' && variant.id) return variant.id;
    if (typeof variant === 'string') return variant;
    return DEFAULT_TABLE_BASE_ID;
  };

  const applyBaseVariant = (variant) => {
    const variantId = resolveBaseVariantId(variant);
    const builder = baseBuilders[variantId] ?? baseBuilders[DEFAULT_TABLE_BASE_ID];
    clearBaseMeshes();
    const finishMaterials = table.userData?.finish?.materials || {};
    const built = builder({
      ...baseContext,
      legMat: finishMaterials.leg ?? baseContext.legMat,
      railMat: finishMaterials.rail ?? baseContext.railMat,
      frameMat: finishMaterials.frame ?? baseContext.frameMat,
      trimMat: finishMaterials.trim ?? baseContext.trimMat
    });
    normalizeBasePlacement(built.meshes, built.normalizeOptions);
    addBaseMeshesToFinish(built);
    if (built?.asyncReady?.then) {
      built.asyncReady
        .then(() => {
          if (table.userData.baseVariantId === variantId) {
            applyBaseVariant(variantId);
          }
        })
        .catch((err) =>
          console.warn('Pool Royale chess leg templates failed to load', err)
        );
    }
    finishParts.baseVariantId = variantId;
    table.userData.baseVariantId = variantId;
  };

  applyBaseVariant(baseVariant || DEFAULT_TABLE_BASE_ID);

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
  pocketCenters().forEach((p, index) => {
    const marker = new THREE.Object3D();
    marker.position.set(p.x, clothPlaneWorld - POCKET_VIS_R, p.y);
    marker.userData.captureRadius = index >= 4 ? SIDE_CAPTURE_R : CAPTURE_R;
    table.add(marker);
    table.userData.pockets.push(marker);
  });

  pocketMeshes.forEach((mesh) => {
    const lift = mesh?.userData?.verticalLift || 0;
    mesh.position.y = pocketTopY - TABLE.THICK / 2 + lift;
  });

  alignRailsToCushions(table, railsGroup, finishParts.railMeshes);
  table.updateMatrixWorld(true);
  updateRailLimitsFromTable(table);

  table.position.y = TABLE_Y;
  table.userData.cushionTopLocal = cushionTopLocal;
  table.userData.cushionTopWorld = cushionTopLocal + TABLE_Y;
  table.userData.cushionLipClearance = clothPlaneWorld;
  table.userData.clothPlaneLocal = clothPlaneLocal;
  table.userData.finish = finishInfo;
  parent.add(table);

  const baulkZ = baulkLineZ;

  return {
    centers: pocketCenters(),
    baulkZ,
    group: table,
    clothMat,
    cushionMat,
    railMarkers: table.userData.railMarkers,
    setBaseVariant: applyBaseVariant
  };
}

function applyTableFinishToTable(table, finish) {
  if (!table || !finish) return;
  const finishInfo = table.userData?.finish;
  if (!finishInfo?.parts) return;
  const resolvedFinish =
    (finish && typeof finish === 'object')
      ? finish
      : (typeof finish === 'string' && TABLE_FINISHES[finish]) ||
        (finish?.id && TABLE_FINISHES[finish.id]) ||
        TABLE_FINISHES[DEFAULT_TABLE_FINISH_ID];
  const createMaterialsFn =
    typeof resolvedFinish?.createMaterials === 'function'
      ? resolvedFinish.createMaterials
      : TABLE_FINISHES[DEFAULT_TABLE_FINISH_ID].createMaterials;
  const rawMaterials = createMaterialsFn();
  let fallbackMaterials = null;
  const getFallbackMaterial = (key) => {
    if (!fallbackMaterials) {
      fallbackMaterials = TABLE_FINISHES[DEFAULT_TABLE_FINISH_ID].createMaterials();
    }
    return fallbackMaterials[key];
  };
  const frameMat = rawMaterials.frame ?? getFallbackMaterial('frame');
  const railMat = rawMaterials.rail ?? getFallbackMaterial('rail');
  let legMat = rawMaterials.leg ?? frameMat;
  if (legMat === frameMat) {
    legMat = frameMat.clone();
  }
  const trimMat = rawMaterials.trim ?? getFallbackMaterial('trim');
  const pocketJawMat = rawMaterials.pocketJaw ?? getFallbackMaterial('pocketJaw');
  const pocketRimMat = rawMaterials.pocketRim ?? getFallbackMaterial('pocketRim');
  const accentConfig = rawMaterials.accent ?? null;
  frameMat.needsUpdate = true;
  railMat.needsUpdate = true;
  legMat.needsUpdate = true;
  trimMat.needsUpdate = true;
  pocketJawMat.needsUpdate = true;
  pocketRimMat.needsUpdate = true;
  enhanceChromeMaterial(trimMat);
  if (accentConfig?.material) {
    accentConfig.material.needsUpdate = true;
  }

  const disposed = new Set();
  const disposeMaterial = (material) => {
    if (!material || disposed.has(material)) return;
    disposeMaterialWithWood(material);
    disposed.add(material);
  };
  const stripWoodTextures = (material) => {
    if (!material) return;
    const textures = material.userData?.__woodTextures;
    if (textures) {
      Object.values(textures).forEach((texture) => {
        if (texture?.dispose) texture.dispose();
      });
    }
    if (material.userData) {
      delete material.userData.__woodTextures;
      delete material.userData.__woodOptions;
      delete material.userData.woodRepeat;
      delete material.userData.woodRepeatScale;
      delete material.userData.woodRotation;
      delete material.userData.woodTextureSize;
    }
    ['map', 'roughnessMap', 'normalMap', 'aoMap', 'metalnessMap', 'displacementMap', 'bumpMap'].forEach((key) => {
      if (material[key]) {
        if (material[key]?.dispose) material[key].dispose();
        material[key] = null;
      }
    });
    material.needsUpdate = true;
  };
  const resolveMaterialForMesh = (mesh, fallback) => {
    const baseKey = mesh?.userData?.baseMaterialKey;
    if (baseKey === 'rail') return railMat;
    if (baseKey === 'frame') return frameMat;
    if (baseKey === 'trim') return trimMat;
    if (baseKey === 'leg') return legMat;
    return fallback;
  };
  const swapMaterial = (mesh, material) => {
    if (!mesh || !material) return;
    const resolvedMaterial = resolveMaterialForMesh(mesh, material);
    if (!resolvedMaterial) return;
    const nextMaterial = mesh.userData?.isChromePlate
      ? applyChromePlateDamping(resolvedMaterial)
      : resolvedMaterial;
    if (mesh.material !== nextMaterial) {
      disposeMaterial(mesh.material);
      mesh.material = nextMaterial;
    }
  };

  finishInfo.parts.frameMeshes.forEach((mesh) => swapMaterial(mesh, frameMat));
  finishInfo.parts.legMeshes.forEach((mesh) => swapMaterial(mesh, legMat));
  finishInfo.parts.railMeshes.forEach((mesh) => swapMaterial(mesh, railMat));
  finishInfo.parts.trimMeshes.forEach((mesh) => swapMaterial(mesh, trimMat));
  finishInfo.parts.pocketJawMeshes.forEach((mesh) => swapMaterial(mesh, pocketJawMat));
  finishInfo.parts.pocketRimMeshes.forEach((mesh) => swapMaterial(mesh, pocketRimMat));
  if (Array.isArray(finishInfo.parts.brandPlates)) {
    const accentColor = new THREE.Color(0xd4b163);
    finishInfo.parts.brandPlates.forEach((entry) => {
      const sideMaterials = entry?.sideMaterials;
      if (!Array.isArray(sideMaterials)) return;
      sideMaterials.forEach((mat) => {
        if (!mat) return;
        mat.copy(trimMat);
        enhanceChromeMaterial(mat);
        mat.color.lerp(accentColor, 0.42);
        mat.metalness = Math.min(1, (mat.metalness ?? 0) + 0.1);
        mat.roughness = Math.max(0.04, (mat.roughness ?? 0.4) * 0.82);
        mat.clearcoat = Math.max(mat.clearcoat ?? 0.28, 0.42);
        mat.clearcoatRoughness = Math.min(mat.clearcoatRoughness ?? 0.32, 0.32);
        mat.needsUpdate = true;
      });
    });
  }
  if (table.userData?.railMarkers?.updateBaseMaterial) {
    table.userData.railMarkers.updateBaseMaterial(trimMat);
  }

  const woodTextureEnabled =
    resolvedFinish?.woodTextureEnabled ?? WOOD_TEXTURES_ENABLED;
  const woodSurfaces = finishInfo.parts.woodSurfaces ?? {
    frame: null,
    rail: null
  };
  finishInfo.parts.woodSurfaces = woodSurfaces;
  if (woodTextureEnabled) {
    const defaultWoodOption =
      WOOD_GRAIN_OPTIONS_BY_ID[DEFAULT_WOOD_GRAIN_ID] ?? WOOD_GRAIN_OPTIONS[0];
    const resolvedWoodOption =
      resolvedFinish?.woodTexture ||
      (resolvedFinish?.woodTextureId &&
        WOOD_GRAIN_OPTIONS_BY_ID[resolvedFinish.woodTextureId]) ||
      (finishInfo.woodTextureId &&
        WOOD_GRAIN_OPTIONS_BY_ID[finishInfo.woodTextureId]) ||
      defaultWoodOption;
    const nextFrameSurface = resolveWoodSurfaceConfig(
      resolvedWoodOption?.frame,
      woodSurfaces.frame ?? woodSurfaces.rail ?? resolvedWoodOption?.rail ?? {
        repeat: { x: 1, y: 1 },
        rotation: 0
      }
    );
    const woodRepeatScale = clampWoodRepeatScaleValue(
      resolvedFinish?.woodRepeatScale ?? finishInfo.woodRepeatScale ?? DEFAULT_WOOD_REPEAT_SCALE
    );
    const synchronizedRailSurface = {
      repeat: new THREE.Vector2(
        nextFrameSurface.repeat.x,
        nextFrameSurface.repeat.y
      ),
      rotation: nextFrameSurface.rotation,
      textureSize: nextFrameSurface.textureSize,
      mapUrl: nextFrameSurface.mapUrl,
      roughnessMapUrl: nextFrameSurface.roughnessMapUrl,
      normalMapUrl: nextFrameSurface.normalMapUrl,
      woodRepeatScale
    };
    const synchronizedFrameSurface = {
      repeat: new THREE.Vector2(nextFrameSurface.repeat.x, nextFrameSurface.repeat.y),
      rotation: nextFrameSurface.rotation,
      textureSize: nextFrameSurface.textureSize,
      mapUrl: nextFrameSurface.mapUrl,
      roughnessMapUrl: nextFrameSurface.roughnessMapUrl,
      normalMapUrl: nextFrameSurface.normalMapUrl,
      woodRepeatScale
    };

    applyWoodTextureToMaterial(railMat, synchronizedRailSurface);
    applyWoodTextureToMaterial(frameMat, synchronizedFrameSurface);
    applyTableFinishDulling(railMat);
    applyTableFinishDulling(frameMat);
    applyTableWoodVisibilityTuning(railMat);
    applyTableWoodVisibilityTuning(frameMat);
    finishInfo.parts.underlayMeshes.forEach((mesh) => {
      if (!mesh) return;
      const baseMaterialKey = mesh.userData?.baseMaterialKey === 'frame' ? 'frame' : 'rail';
      const sourceMaterial = baseMaterialKey === 'frame' ? frameMat : railMat;
      if (sourceMaterial) {
        const nextMaterial = sourceMaterial.clone();
        nextMaterial.side = mesh.material?.side ?? THREE.DoubleSide;
        nextMaterial.shadowSide = mesh.material?.shadowSide ?? THREE.DoubleSide;
        disposeMaterial(mesh.material);
        mesh.material = nextMaterial;
      }
      if (!mesh.material || mesh.userData?.skipWoodTexture) return;
      const underlaySurface =
        baseMaterialKey === 'frame' ? synchronizedFrameSurface : synchronizedRailSurface;
      applyWoodTextureToMaterial(mesh.material, underlaySurface);
      applyTableFinishDulling(mesh.material);
      applyTableWoodVisibilityTuning(mesh.material);
      if (mesh.material.color && sourceMaterial?.color) {
        mesh.material.color.copy(sourceMaterial.color);
      }
      mesh.material.needsUpdate = true;
    });
    if (legMat !== frameMat) {
      applyWoodTextureToMaterial(legMat, {
        ...synchronizedFrameSurface,
        rotation: synchronizedFrameSurface.rotation + Math.PI / 2
      });
    }
    applyTableFinishDulling(legMat);
    applyTableWoodVisibilityTuning(legMat);
    woodSurfaces.rail = cloneWoodSurfaceConfig(synchronizedRailSurface);
    woodSurfaces.frame = cloneWoodSurfaceConfig(synchronizedFrameSurface);
    finishInfo.woodTextureId = resolvedWoodOption?.id ?? DEFAULT_WOOD_GRAIN_ID;
    finishInfo.parts.woodTextureId = finishInfo.woodTextureId;
    finishInfo.woodRepeatScale = woodRepeatScale;
  } else {
    stripWoodTextures(railMat);
    stripWoodTextures(frameMat);
    stripWoodTextures(legMat);
    applyTableFinishDulling(railMat);
    applyTableFinishDulling(frameMat);
    applyTableFinishDulling(legMat);
    applyTableWoodVisibilityTuning(railMat);
    applyTableWoodVisibilityTuning(frameMat);
    applyTableWoodVisibilityTuning(legMat);
    finishInfo.parts.underlayMeshes.forEach((mesh) => {
      if (!mesh?.material) return;
      stripWoodTextures(mesh.material);
      applyTableFinishDulling(mesh.material);
      applyTableWoodVisibilityTuning(mesh.material);
      if (mesh.material.color && railMat.color) {
        mesh.material.color.copy(railMat.color);
      }
    });
    woodSurfaces.rail = null;
    woodSurfaces.frame = null;
    finishInfo.woodTextureId = null;
    finishInfo.parts.woodTextureId = null;
    finishInfo.woodRepeatScale = 1;
  }

  const clothTextureKey =
    resolvedFinish?.clothTextureKey ?? finishInfo.clothTextureKey ?? DEFAULT_CLOTH_TEXTURE_KEY;
  if (finishInfo.clothTextureKey !== clothTextureKey) {
    updateClothTexturesForFinish(finishInfo, clothTextureKey);
  }

  const { accentMesh, accentParent, dimensions } = finishInfo.parts;
  if (accentMesh) {
    if (accentMesh.parent) {
      accentMesh.parent.remove(accentMesh);
    }
    if (accentMesh.geometry) {
      accentMesh.geometry.dispose();
    }
    disposeMaterial(accentMesh.material);
    finishInfo.parts.accentMesh = null;
  }
  if (accentConfig && accentParent && dimensions) {
    const accentMeshNext = createAccentMesh(accentConfig, dimensions);
    if (accentMeshNext) {
      accentParent.add(accentMeshNext);
      finishInfo.parts.accentMesh = accentMeshNext;
    }
  }

  const clothColor = new THREE.Color(resolvedFinish.colors.cloth);
  const clothHighlight = new THREE.Color(0xf6fff9);
  const cushionColor = new THREE.Color(
    resolvedFinish.colors.cushion ?? resolvedFinish.colors.cloth
  );
  const clothSheenColor = clothColor.clone().lerp(clothHighlight, 0.18);
  const cushionSheenColor = cushionColor.clone().lerp(clothHighlight, 0.18);
  const emissiveColor = clothColor.clone().multiplyScalar(0.06);
  const cushionEmissive = cushionColor.clone().multiplyScalar(0.06);
  if (finishInfo.clothMat) {
    finishInfo.clothMat.color.copy(clothColor);
    if (finishInfo.clothMat.sheenColor) {
      finishInfo.clothMat.sheenColor.copy(clothSheenColor);
    }
    finishInfo.clothMat.emissive.copy(emissiveColor);
    finishInfo.clothMat.needsUpdate = true;
  }
  if (finishInfo.cushionMat) {
    finishInfo.cushionMat.color.copy(cushionColor);
    if (finishInfo.cushionMat.sheenColor) {
      finishInfo.cushionMat.sheenColor.copy(cushionSheenColor);
    }
    finishInfo.cushionMat.emissive.copy(cushionEmissive);
    finishInfo.cushionMat.needsUpdate = true;
  }
  if (finishInfo.clothEdgeMat) {
    const clothEdgeColor = clothColor.clone().lerp(new THREE.Color(0x000000), CLOTH_EDGE_TINT);
    finishInfo.clothEdgeMat.color.copy(clothEdgeColor);
    finishInfo.clothEdgeMat.map = null;
    finishInfo.clothEdgeMat.bumpMap = null;
    finishInfo.clothEdgeMat.bumpScale = 0;
    finishInfo.clothEdgeMat.roughness = 1;
    finishInfo.clothEdgeMat.clearcoat = 0;
    finishInfo.clothEdgeMat.clearcoatRoughness = 1;
    finishInfo.clothEdgeMat.envMapIntensity = 0;
    finishInfo.clothEdgeMat.sheen = 0;
    if (finishInfo.clothEdgeMat.sheenColor) {
      finishInfo.clothEdgeMat.sheenColor.copy(clothEdgeColor);
    }
    finishInfo.clothEdgeMat.emissive.copy(
      clothEdgeColor.clone().multiplyScalar(CLOTH_EDGE_EMISSIVE_MULTIPLIER)
    );
    finishInfo.clothEdgeMat.emissiveIntensity = CLOTH_EDGE_EMISSIVE_INTENSITY;
    finishInfo.clothEdgeMat.metalness = 0;
    finishInfo.clothEdgeMat.reflectivity = 0;
    finishInfo.clothEdgeMat.needsUpdate = true;
  }
  finishInfo.parts.underlayMeshes.forEach((mesh) => {
    if (!mesh?.material) return;
    const mat = mesh.material;
    if (mat.color) {
      mat.color.copy(clothColor);
    }
    if (mat.emissive) {
      mat.emissive.copy(emissiveColor);
    }
    mat.needsUpdate = true;
  });
  if (typeof finishInfo.applyClothDetail === 'function') {
    finishInfo.applyClothDetail(resolvedFinish?.clothDetail ?? null);
  }

  finishInfo.id = resolvedFinish.id;
  finishInfo.palette = resolvedFinish.colors;
  finishInfo.materials = {
    frame: frameMat,
    rail: railMat,
    leg: legMat,
    trim: trimMat,
    pocketJaw: pocketJawMat,
    pocketRim: pocketRimMat,
    accent: accentConfig
  };
  finishInfo.clothDetail = resolvedFinish?.clothDetail ?? null;
}

// --------------------------------------------------
// NEW Engine (no globals). Camera feels like standing at the side.
// --------------------------------------------------
function PoolRoyaleGame({
  variantKey,
  ballSetKey,
  tableSizeKey,
  playType = 'regular',
  mode = 'ai',
  trainingMode = 'solo',
  trainingRulesEnabled = true,
  accountId,
  tgId,
  playerName,
  playerAvatar,
  opponentName,
  opponentAvatar
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const mountRef = useRef(null);
  const rafRef = useRef(null);
  const worldRef = useRef(null);
  const rules = useMemo(() => new PoolRoyaleRules(variantKey), [variantKey]);
  const tournamentMode = playType === 'tournament';
  const tournamentPlayers = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const requested = parseInt(params.get('players') || '0', 10);
    return Number.isFinite(requested) && requested > 0 ? requested : 8;
  }, [location.search]);
  const tournamentKey = tgId || 'anon';
  const tournamentStateKey = useMemo(
    () => `poolRoyaleTournamentState_${tournamentKey}`,
    [tournamentKey]
  );
  const tournamentOppKey = useMemo(
    () => `poolRoyaleTournamentOpponent_${tournamentKey}`,
    [tournamentKey]
  );
  const tournamentLastResultKey = useMemo(
    () => `poolRoyaleLastResult_${tournamentKey}`,
    [tournamentKey]
  );
  const tournamentAiFlagStorageKey = useMemo(
    () => `poolRoyaleTournamentAiFlag_${tournamentKey}`,
    [tournamentKey]
  );
  const activeVariant = useMemo(
    () => resolvePoolVariant(variantKey, ballSetKey),
    [variantKey, ballSetKey]
  );
  const isUkAmericanSet = useMemo(
    () => activeVariant?.id === 'uk' && activeVariant?.ballSet === 'american',
    [activeVariant]
  );
  const activeTableSize = useMemo(
    () => resolveTableSize(tableSizeKey),
    [tableSizeKey]
  );
  const responsiveTableSize = useResponsiveTableSize(activeTableSize);
  const resolvedAccountId = useMemo(
    () => poolRoyalAccountId(accountId),
    [accountId]
  );
  const stakeAmount = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return Number(params.get('amount')) || 0;
  }, [location.search]);
  const stakeToken = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('token') || 'TPC';
  }, [location.search]);
  const [winnerOverlay, setWinnerOverlay] = useState(null);
  const coinStyleInjectedRef = useRef(false);
  const ensureCoinBurstStyles = useCallback(() => {
    if (coinStyleInjectedRef.current || typeof document === 'undefined') return;
    const style = document.createElement('style');
    style.id = 'pool-royale-coin-burst';
    style.textContent = `
      @keyframes prCoinBurst {
        0% { transform: translateY(-20px) scale(0.8); opacity: 1; }
        70% { opacity: 1; }
        100% { transform: translateY(120vh) scale(1.1); opacity: 0; }
      }
      .pr-coin-burst {
        position: fixed;
        top: -24px;
        width: 32px;
        height: 32px;
        pointer-events: none;
        z-index: 70;
        will-change: transform, opacity;
      }`;
    document.head.appendChild(style);
    coinStyleInjectedRef.current = true;
  }, []);
  const triggerCoinBurst = useCallback(
    (count = 20) => {
      if (typeof document === 'undefined') return;
      ensureCoinBurstStyles();
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.inset = '0';
      container.style.pointerEvents = 'none';
      container.style.zIndex = '70';
      document.body.appendChild(container);
      for (let i = 0; i < count; i += 1) {
        const img = document.createElement('img');
        img.src = '/assets/icons/ezgif-54c96d8a9b9236.webp';
        img.className = 'pr-coin-burst';
        const left = Math.random() * 100;
        const delay = Math.random() * 0.6;
        const duration = 1.6 + Math.random() * 0.8;
        img.style.left = `${left}vw`;
        img.style.animation = `prCoinBurst ${duration}s linear ${delay}s forwards`;
        container.appendChild(img);
      }
      window.setTimeout(() => {
        container.remove();
      }, 2600);
    },
    [ensureCoinBurstStyles]
  );
  const [poolInventory, setPoolInventory] = useState(() =>
    getCachedPoolRoyalInventory(resolvedAccountId)
  );
  useEffect(() => {
    let cancelled = false;
    setPoolInventory(getCachedPoolRoyalInventory(resolvedAccountId));
    getPoolRoyalInventory(resolvedAccountId)
      .then((inventory) => {
        if (!cancelled && inventory) {
          setPoolInventory(inventory);
        }
      })
      .catch((err) => {
        console.warn('Pool Royale inventory load failed', err);
      });
    return () => {
      cancelled = true;
    };
  }, [resolvedAccountId]);
  const isCueFinishUnlocked = useCallback(
    (finishId, inventory = poolInventory) =>
      isPoolOptionUnlocked('cueStyle', finishId, inventory) ||
      isPoolOptionUnlocked('tableFinish', finishId, inventory),
    [poolInventory]
  );
  const awardTournamentLoot = useCallback(async () => {
    if (!resolvedAccountId) return [];
    let currentInventory = poolInventory;
    try {
      const latest = await getPoolRoyalInventory(resolvedAccountId);
      if (latest) currentInventory = latest;
    } catch (err) {
      console.warn('Pool Royale loot fetch fallback to cache', err);
    }
    const selectReward = (type, options) => {
      const locked = options.filter((optionId) => !isPoolOptionUnlocked(type, optionId, currentInventory));
      const pool = locked.length ? locked : options;
      if (!pool.length) return null;
      return randomPick(pool);
    };
    const rewards = [];
    const finishId = selectReward(
      'tableFinish',
      TABLE_FINISH_OPTIONS.map((option) => option.id)
    );
    if (finishId) {
      try {
        currentInventory = await addPoolRoyalUnlock('tableFinish', finishId, resolvedAccountId);
      } catch (err) {
        console.warn('Pool Royale finish unlock failed', err);
      }
      rewards.push({
        type: 'tableFinish',
        optionId: finishId,
        label: POOL_ROYALE_OPTION_LABELS.tableFinish?.[finishId] || finishId
      });
    }
    const cueOptions = CUE_FINISH_OPTIONS.map((finish) => finish.id);
    const cueLocked = cueOptions.filter((optionId) =>
      !isCueFinishUnlocked(optionId, currentInventory)
    );
    const cueId = cueLocked.length
      ? randomPick(cueLocked)
      : cueOptions.length
        ? randomPick(cueOptions)
        : null;
    if (cueId) {
      try {
        currentInventory = await addPoolRoyalUnlock('cueStyle', cueId, resolvedAccountId);
      } catch (err) {
        console.warn('Pool Royale cue unlock failed', err);
      }
      rewards.push({
        type: 'cueStyle',
        optionId: cueId,
        label:
          POOL_ROYALE_OPTION_LABELS.tableFinish?.[cueId] ||
          POOL_ROYALE_OPTION_LABELS.cueStyle?.[cueId] ||
          cueId
      });
    }
    const clothId = selectReward(
      'clothColor',
      POOL_ROYALE_CLOTH_VARIANTS.map((variant) => variant.id)
    );
    if (clothId) {
      try {
        currentInventory = await addPoolRoyalUnlock('clothColor', clothId, resolvedAccountId);
      } catch (err) {
        console.warn('Pool Royale cloth unlock failed', err);
      }
      rewards.push({
        type: 'clothColor',
        optionId: clothId,
        label: POOL_ROYALE_OPTION_LABELS.clothColor?.[clothId] || clothId
      });
    }
    if (currentInventory) {
      setPoolInventory(currentInventory);
    }
    return rewards;
  }, [isCueFinishUnlocked, poolInventory, resolvedAccountId]);
  const resolveStoredSelection = useCallback(
    (type, storageKey, isValid, fallbackId) => {
      const inventory = poolInventory;
      if (typeof window !== 'undefined' && storageKey) {
        const stored = window.localStorage.getItem(storageKey);
        if (stored && isValid(stored) && isPoolOptionUnlocked(type, stored, inventory)) {
          return stored;
        }
      }
      if (isValid(fallbackId) && isPoolOptionUnlocked(type, fallbackId, inventory)) {
        return fallbackId;
      }
      const firstUnlocked = (inventory?.[type] || []).find((optionId) => isValid(optionId));
      if (firstUnlocked) return firstUnlocked;
      return fallbackId;
    },
    [poolInventory]
  );
  const [tableFinishId, setTableFinishId] = useState(() => {
    return resolveStoredSelection(
      'tableFinish',
      TABLE_FINISH_STORAGE_KEY,
      (id) => Boolean(TABLE_FINISHES[id]),
      DEFAULT_TABLE_FINISH_ID
    );
  });
  const [tableBaseId, setTableBaseId] = useState(() => {
    return resolveStoredSelection(
      'tableBase',
      TABLE_BASE_STORAGE_KEY,
      (id) => POOL_ROYALE_BASE_VARIANTS.some((variant) => variant.id === id),
      DEFAULT_TABLE_BASE_ID
    );
  });
  const [clothColorId, setClothColorId] = useState(() => {
    return resolveStoredSelection(
      'clothColor',
      CLOTH_COLOR_STORAGE_KEY,
      (id) => CLOTH_COLOR_OPTIONS.some((opt) => opt.id === id),
      DEFAULT_CLOTH_COLOR_ID
    );
  });
  const [pocketLinerId, setPocketLinerId] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(POCKET_LINER_STORAGE_KEY);
      if (stored && POCKET_LINER_OPTIONS.some((opt) => opt?.id === stored)) {
        return stored;
      }
    }
    return DEFAULT_POCKET_LINER_OPTION_ID;
  });
  const [railMarkerShapeId, setRailMarkerShapeId] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('poolRailMarkerShape');
      if (stored && RAIL_MARKER_SHAPE_OPTIONS.some((opt) => opt.id === stored)) {
        return stored;
      }
    }
    return DEFAULT_RAIL_MARKER_SHAPE;
  });
  const [railMarkerColorId, setRailMarkerColorId] = useState(() => {
    return resolveStoredSelection(
      'railMarkerColor',
      'poolRailMarkerColor',
      (id) => RAIL_MARKER_COLOR_OPTIONS.some((opt) => opt.id === id),
      DEFAULT_RAIL_MARKER_COLOR_ID
    );
  });
  const [environmentHdriId, setEnvironmentHdriId] = useState(() => {
    return resolveStoredSelection(
      'environmentHdri',
      HDRI_STORAGE_KEY,
      (id) => Boolean(POOL_ROYALE_HDRI_VARIANT_MAP[id]),
      POOL_ROYALE_DEFAULT_HDRI_ID
    );
  });
  const [hdriResolutionId, setHdriResolutionId] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(HDRI_RESOLUTION_STORAGE_KEY);
      if (stored && HDRI_RESOLUTION_OPTION_MAP[stored]) {
        return stored;
      }
    }
    return DEFAULT_HDRI_RESOLUTION_MODE;
  });
  const [lightingId, setLightingId] = useState(() => DEFAULT_LIGHTING_ID);
  const [chromeColorId, setChromeColorId] = useState(() => {
    return resolveStoredSelection(
      'chromeColor',
      'poolChromeColor',
      (id) => CHROME_COLOR_OPTIONS.some((opt) => opt.id === id),
      DEFAULT_CHROME_COLOR_ID
    );
  });
  const [frameRateId, setFrameRateId] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(FRAME_RATE_STORAGE_KEY);
      if (stored && FRAME_RATE_OPTIONS.some((opt) => opt.id === stored)) {
        return stored;
      }
      const detected = detectPreferredFrameRateId();
      if (detected && FRAME_RATE_OPTIONS.some((opt) => opt.id === detected)) {
        return detected;
      }
    }
    return DEFAULT_FRAME_RATE_ID;
  });
  const [broadcastSystemId, setBroadcastSystemId] = useState(() => DEFAULT_BROADCAST_SYSTEM_ID);
  const initialTableSlot = environmentHdriId === 'musicHall02' ? 1 : 0;
  const [activeTableSlot, setActiveTableSlot] = useState(initialTableSlot);
  const [tableSelectionOpen, setTableSelectionOpen] = useState(false);
  const [secondaryTableReady, setSecondaryTableReady] = useState(false);
  const activeTableSlotLabel = activeTableSlot === 0 ? 'near' : 'far';
  const activeFrameRateOption = useMemo(
    () =>
      FRAME_RATE_OPTIONS.find((opt) => opt.id === frameRateId) ??
      FRAME_RATE_OPTIONS[0],
    [frameRateId]
  );
  const activeHdriResolutionOption = useMemo(
    () =>
      HDRI_RESOLUTION_OPTION_MAP[hdriResolutionId] ??
      HDRI_RESOLUTION_OPTIONS[0],
    [hdriResolutionId]
  );
  const frameQualityProfile = useMemo(() => {
    const option = activeFrameRateOption ?? FRAME_RATE_OPTIONS[0];
    const fallback = FRAME_RATE_OPTIONS[0];
    const fps = Number.isFinite(option?.fps) && option.fps > 0
      ? option.fps
      : Number.isFinite(fallback?.fps) && fallback.fps > 0
        ? fallback.fps
        : 60;
    const renderScale =
      typeof option?.renderScale === 'number' && Number.isFinite(option.renderScale)
        ? THREE.MathUtils.clamp(option.renderScale, 1, 1.6)
        : 1;
    const pixelRatioCap =
      typeof option?.pixelRatioCap === 'number' && Number.isFinite(option.pixelRatioCap)
        ? Math.max(1, option.pixelRatioCap)
        : resolveDefaultPixelRatioCap();
    return {
      id: option?.id ?? DEFAULT_FRAME_RATE_ID,
      fps,
      renderScale,
      pixelRatioCap
    };
  }, [activeFrameRateOption]);
  const frameQualityRef = useRef(frameQualityProfile);
  useEffect(() => {
    frameQualityRef.current = frameQualityProfile;
  }, [frameQualityProfile]);
  const activeBroadcastSystem = useMemo(
    () => resolveBroadcastSystem(broadcastSystemId),
    [broadcastSystemId]
  );
  const availableTableFinishes = useMemo(
    () =>
      TABLE_FINISH_OPTIONS.filter((option) =>
        isPoolOptionUnlocked('tableFinish', option.id, poolInventory)
      ),
    [poolInventory]
  );
  const availableTableBases = useMemo(
    () =>
      POOL_ROYALE_BASE_VARIANTS.filter((variant) =>
        isPoolOptionUnlocked('tableBase', variant.id, poolInventory)
      ),
    [poolInventory]
  );
  const availableChromeOptions = useMemo(
    () =>
      CHROME_COLOR_OPTIONS.filter((option) =>
        isPoolOptionUnlocked('chromeColor', option.id, poolInventory)
      ),
    [poolInventory]
  );
  const availableRailMarkerColors = useMemo(
    () =>
      RAIL_MARKER_COLOR_OPTIONS.filter((option) =>
        isPoolOptionUnlocked('railMarkerColor', option.id, poolInventory)
      ),
    [poolInventory]
  );
  const availableClothOptions = useMemo(
    () =>
      CLOTH_COLOR_OPTIONS.filter((option) =>
        isPoolOptionUnlocked('clothColor', option.id, poolInventory)
      ),
    [poolInventory]
  );
  const availableEnvironmentHdris = useMemo(
    () =>
      POOL_ROYALE_HDRI_VARIANTS.filter((variant) =>
        isPoolOptionUnlocked('environmentHdri', variant.id, poolInventory)
      ),
    [poolInventory]
  );
  const availablePocketLiners = useMemo(
    () =>
      POCKET_LINER_OPTIONS.filter((option) =>
        isPoolOptionUnlocked('pocketLiner', option.id, poolInventory)
      ),
    [poolInventory]
  );
  const availableCueStyles = useMemo(
    () =>
      CUE_FINISH_OPTIONS.map((finish, index) => ({ preset: finish, index })).filter(({ preset }) =>
        isCueFinishUnlocked(preset.id, poolInventory)
      ),
    [isCueFinishUnlocked, poolInventory]
  );
  const activeChromeOption = useMemo(
    () =>
      availableChromeOptions.find((opt) => opt.id === chromeColorId) ??
      availableChromeOptions[0] ??
      CHROME_COLOR_OPTIONS[0],
    [availableChromeOptions, chromeColorId]
  );
  const activeClothOption = useMemo(
    () =>
      availableClothOptions.find((opt) => opt.id === clothColorId) ??
      availableClothOptions[0] ??
      CLOTH_COLOR_OPTIONS[0],
    [availableClothOptions, clothColorId]
  );
  const activeTableBase = useMemo(
    () =>
      availableTableBases.find((variant) => variant.id === tableBaseId) ??
      availableTableBases[0] ??
      POOL_ROYALE_BASE_VARIANTS[0],
    [availableTableBases, tableBaseId]
  );
  const resolvedHdriResolution = useMemo(() => {
    if (hdriResolutionId === 'auto') {
      return resolveHdriResolutionForTable(responsiveTableSize);
    }
    if (HDRI_RESOLUTION_OPTION_MAP[hdriResolutionId]) {
      return hdriResolutionId;
    }
    return resolveHdriResolutionForTable(responsiveTableSize);
  }, [hdriResolutionId, responsiveTableSize]);
  const activeEnvironmentHdri = useMemo(
    () => {
      const variant =
        POOL_ROYALE_HDRI_VARIANT_MAP[environmentHdriId] ??
        POOL_ROYALE_HDRI_VARIANT_MAP[POOL_ROYALE_DEFAULT_HDRI_ID] ??
        POOL_ROYALE_HDRI_VARIANTS[0];
      if (!variant) return null;
      const basePreferred =
        Array.isArray(variant.preferredResolutions) && variant.preferredResolutions.length
          ? variant.preferredResolutions
          : DEFAULT_HDRI_RESOLUTIONS;
      const resolved = resolvedHdriResolution ?? basePreferred[0];
      if (!resolved) return variant;
      const preferredResolutions = [
        resolved,
        ...basePreferred.filter((res) => res !== resolved)
      ];
      return {
        ...variant,
        preferredResolutions,
        fallbackResolution: resolved
      };
    },
    [environmentHdriId, resolvedHdriResolution]
  );
  const dualTablesEnabled = useMemo(
    () => environmentHdriId === 'musicHall02',
    [environmentHdriId]
  );
  const activePocketLinerOption = useMemo(
    () =>
      availablePocketLiners.find((opt) => opt?.id === pocketLinerId) ??
      availablePocketLiners[0] ??
      POCKET_LINER_OPTIONS[0],
    [availablePocketLiners, pocketLinerId]
  );
  useEffect(() => {
    if (!isPoolOptionUnlocked('tableFinish', tableFinishId, poolInventory)) {
      setTableFinishId(DEFAULT_TABLE_FINISH_ID);
    }
    if (!isPoolOptionUnlocked('tableBase', tableBaseId, poolInventory)) {
      setTableBaseId(DEFAULT_TABLE_BASE_ID);
    }
    if (!isPoolOptionUnlocked('clothColor', clothColorId, poolInventory)) {
      setClothColorId(DEFAULT_CLOTH_COLOR_ID);
    }
    if (!isPoolOptionUnlocked('chromeColor', chromeColorId, poolInventory)) {
      setChromeColorId(DEFAULT_CHROME_COLOR_ID);
    }
    if (!isPoolOptionUnlocked('railMarkerColor', railMarkerColorId, poolInventory)) {
      setRailMarkerColorId(DEFAULT_RAIL_MARKER_COLOR_ID);
    }
    if (!isPoolOptionUnlocked('pocketLiner', pocketLinerId, poolInventory)) {
      setPocketLinerId(DEFAULT_POCKET_LINER_OPTION_ID);
    }
    if (!isPoolOptionUnlocked('environmentHdri', environmentHdriId, poolInventory)) {
      setEnvironmentHdriId(POOL_ROYALE_DEFAULT_HDRI_ID);
    }
  }, [
    chromeColorId,
    clothColorId,
    environmentHdriId,
    pocketLinerId,
    poolInventory,
    railMarkerColorId,
    tableBaseId,
    tableFinishId
  ]);
  const isTraining = playType === 'training';
  const [trainingMenuOpen, setTrainingMenuOpen] = useState(false);
  const [trainingModeState, setTrainingModeState] = useState(
    trainingMode === 'ai' ? 'ai' : 'solo'
  );
  const [trainingRulesOn, setTrainingRulesOn] = useState(Boolean(trainingRulesEnabled));
  const trainingModeRef = useRef(trainingModeState);
  const trainingRulesRef = useRef(trainingRulesOn);
  useEffect(() => {
    trainingModeRef.current = trainingModeState;
  }, [trainingModeState]);
  useEffect(() => {
    trainingRulesRef.current = trainingRulesOn;
  }, [trainingRulesOn]);
  const [trainingProgress, setTrainingProgress] = useState({
    completed: [],
    lastLevel: 1
  });
  const [trainingLevel, setTrainingLevel] = useState(1);
  const trainingProgressRef = useRef(trainingProgress);
  const trainingLevelRef = useRef(trainingLevel);
  const trainingCompletionHandledRef = useRef(false);
  useEffect(() => {
    trainingProgressRef.current = trainingProgress;
  }, [trainingProgress]);
  useEffect(() => {
    trainingLevelRef.current = trainingLevel;
  }, [trainingLevel]);
  useEffect(() => {
    const stored = loadTrainingProgress();
    const playableLevel = resolvePlayableTrainingLevel(stored.lastLevel, stored);
    trainingProgressRef.current = stored;
    setTrainingProgress(stored);
    setTrainingLevel(playableLevel);
  }, []);
  const currentTrainingInfo = useMemo(
    () => describeTrainingLevel(trainingLevel),
    [trainingLevel]
  );
  const nextTrainingLevel = useMemo(() => {
    const next = getNextIncompleteLevel(trainingProgress?.completed || []);
    if (next != null) return next;
    if (Number.isFinite(trainingProgress?.lastLevel)) {
      return Math.min(50, Math.max(1, Number(trainingProgress.lastLevel) + 1));
    }
    return Math.min(50, trainingLevel + 1);
  }, [trainingProgress?.completed, trainingProgress?.lastLevel, trainingLevel]);
  const nextTrainingInfo = useMemo(
    () => describeTrainingLevel(nextTrainingLevel ?? trainingLevel),
    [nextTrainingLevel, trainingLevel]
  );
  const completedTrainingCount = useMemo(
    () => (Array.isArray(trainingProgress?.completed) ? trainingProgress.completed.length : 0),
    [trainingProgress]
  );
  useEffect(() => {
    const handleInventoryUpdate = (event) => {
      if (!event?.detail?.accountId || event.detail.accountId === resolvedAccountId) {
        const nextInventory = event?.detail?.inventory;
        if (nextInventory) {
          setPoolInventory(nextInventory);
        } else {
          setPoolInventory(getCachedPoolRoyalInventory(resolvedAccountId));
        }
      }
    };
    window.addEventListener('poolRoyalInventoryUpdate', handleInventoryUpdate);
    return () => window.removeEventListener('poolRoyalInventoryUpdate', handleInventoryUpdate);
  }, [resolvedAccountId]);
  const railMarkerStyleRef = useRef({
    shape: railMarkerShapeId,
    colorId: railMarkerColorId
  });
  const applyRailMarkerStyleRef = useRef(() => {});
  const resolvedFrameTiming = useMemo(() => {
    const fallbackFps =
      Number.isFinite(FRAME_RATE_OPTIONS[0]?.fps) && FRAME_RATE_OPTIONS[0].fps > 0
        ? FRAME_RATE_OPTIONS[0].fps
        : 60;
    const fps =
      Number.isFinite(frameQualityProfile?.fps) && frameQualityProfile.fps > 0
        ? frameQualityProfile.fps
        : fallbackFps;
    const targetMs = 1000 / fps;
    return {
      id: frameQualityProfile?.id ?? FRAME_RATE_OPTIONS[0]?.id ?? DEFAULT_FRAME_RATE_ID,
      fps,
      targetMs,
      maxMs: targetMs * FRAME_TIME_CATCH_UP_MULTIPLIER
    };
  }, [frameQualityProfile]);
  const frameTimingRef = useRef(resolvedFrameTiming);
  useEffect(() => {
    frameTimingRef.current = resolvedFrameTiming;
  }, [resolvedFrameTiming]);
  const broadcastSystemRef = useRef(activeBroadcastSystem);
  useEffect(() => {
    broadcastSystemRef.current = activeBroadcastSystem;
  }, [activeBroadcastSystem]);
  const [configOpen, setConfigOpen] = useState(false);
  const configPanelRef = useRef(null);
  const configButtonRef = useRef(null);
  const accountIdRef = useRef(accountId || '');
  const tgIdRef = useRef(tgId || '');
  const captureReplayCameraSnapshotRef = useRef(null);
  const remoteAimRef = useRef(null);
  const remoteShotActiveRef = useRef(false);
  const remoteShotUntilRef = useRef(0);
  const incomingRemoteShotRef = useRef(null);
  const pendingRemoteReplayRef = useRef(null);
  const cueFeePaidRef = useRef(false);
  const cueFeePendingRef = useRef(false);
  useEffect(() => {
    accountIdRef.current = accountId || '';
  }, [accountId]);
  useEffect(() => {
    tgIdRef.current = tgId || '';
  }, [tgId]);
  const ensureCueFeePaid = useCallback(async () => {
    if (cueFeePaidRef.current) return true;
    const id = accountIdRef.current;
    if (!id) {
      alert('Link your TPC account before switching cues.');
      return false;
    }
    if (cueFeePendingRef.current) return false;
    cueFeePendingRef.current = true;
    try {
      const balRes = await getAccountBalance(id);
      if ((balRes?.balance || 0) < 50) {
        alert('You need at least 50 TPC to change cues for this game.');
        return false;
      }
      const telegramId = tgIdRef.current || getTelegramId();
      await addTransaction(telegramId, -50, 'cue_fee', {
        game: 'poolroyale',
        reason: 'cue_switch',
        accountId: id
      });
      cueFeePaidRef.current = true;
      return true;
    } catch (err) {
      console.error('Failed to charge cue switch fee', err);
      alert('Unable to charge the cue switch fee. Please try again.');
      return false;
    } finally {
      cueFeePendingRef.current = false;
    }
  }, []);
  const chalkMeshesRef = useRef([]);
  const chalkAreaRef = useRef(null);
  const [uiScale, setUiScale] = useState(() =>
    detectCoarsePointer() ? TOUCH_UI_SCALE : POINTER_UI_SCALE
  );
  const chromeUiLiftPx = useMemo(() => {
    if (typeof window === 'undefined') return 0;
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const chromeLike = /Chrome\//.test(ua) && !/Edg\//.test(ua) && !/OPR\//.test(ua);
    const isTelegram = isTelegramWebView();
    return chromeLike && !isTelegram ? 10 : 0;
  }, []);
  const [isPortrait, setIsPortrait] = useState(
    () => (typeof window === 'undefined' ? true : window.innerHeight >= window.innerWidth)
  );
  const [isTopDownView, setIsTopDownView] = useState(false);
  const [isLookMode, setIsLookMode] = useState(false);
  const lookModeRef = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    const updateScale = () => {
      setUiScale(detectCoarsePointer() ? TOUCH_UI_SCALE : POINTER_UI_SCALE);
      setIsPortrait(window.innerHeight >= window.innerWidth);
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    let coarseQuery = null;
    if (typeof window.matchMedia === 'function') {
      try {
        coarseQuery = window.matchMedia('(pointer: coarse)');
        if (coarseQuery?.addEventListener) {
          coarseQuery.addEventListener('change', updateScale);
        } else if (coarseQuery?.addListener) {
          coarseQuery.addListener(updateScale);
        }
      } catch (err) {
        // ignore
      }
    }
    return () => {
      window.removeEventListener('resize', updateScale);
      if (!coarseQuery) return;
      if (coarseQuery.removeEventListener) {
        coarseQuery.removeEventListener('change', updateScale);
      } else if (coarseQuery.removeListener) {
        coarseQuery.removeListener(updateScale);
      }
    };
  }, []);

  useEffect(() => {
    lookModeRef.current = isLookMode;
    if (!isLookMode) {
      aimFocusRef.current = null;
    }
    cameraUpdateRef.current?.();
  }, [isLookMode]);

  useEffect(() => {
    if (isTopDownView) {
      topViewLockedRef.current = true;
      topViewControlsRef.current.enter?.();
    } else {
      topViewLockedRef.current = false;
      topViewControlsRef.current.exit?.();
    }
  }, [isTopDownView]);
  const [activeChalkIndex, setActiveChalkIndex] = useState(null);
  const activeChalkIndexRef = useRef(null);
  const chalkAssistEnabledRef = useRef(false);
  const chalkAssistTargetRef = useRef(false);
  const visibleChalkIndexRef = useRef(null);
  const resolveCueIndex = useCallback(() => {
    const paletteLength = CUE_FINISH_PALETTE.length || CUE_FINISH_OPTIONS.length || 1;
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(CUE_STYLE_STORAGE_KEY);
      if (stored != null) {
        const parsed = Number.parseInt(stored, 10);
        if (Number.isFinite(parsed)) {
          const normalized = ((parsed % paletteLength) + paletteLength) % paletteLength;
          const preset = CUE_FINISH_OPTIONS[normalized % CUE_FINISH_OPTIONS.length];
          if (preset && isCueFinishUnlocked(preset.id, poolInventory)) {
            return normalized;
          }
        }
      }
    }
    const defaultPreset = CUE_FINISH_OPTIONS[DEFAULT_CUE_STYLE_INDEX];
    if (
      defaultPreset &&
      isCueFinishUnlocked(defaultPreset.id, poolInventory)
    ) {
      return DEFAULT_CUE_STYLE_INDEX;
    }
    const firstUnlocked = CUE_FINISH_OPTIONS.findIndex((preset) =>
      isCueFinishUnlocked(preset.id, poolInventory)
    );
    if (firstUnlocked >= 0) return firstUnlocked;
    return DEFAULT_CUE_STYLE_INDEX;
  }, [isCueFinishUnlocked, poolInventory]);
  const [cueStyleIndex, setCueStyleIndex] = useState(() => resolveCueIndex());
  const cueStyleIndexRef = useRef(cueStyleIndex);
  const cueRackGroupsRef = useRef([]);
  const cueOptionGroupsRef = useRef([]);
  const cueRackMetaRef = useRef(new Map());
  const cueMaterialsRef = useRef({
    shaft: null,
    buttMaterial: null,
    buttRingMaterial: null,
    buttCapMaterial: null,
    styleIndex: null,
  });
  const cueGalleryStateRef = useRef({
    active: false,
    rackId: null,
    basePosition: new THREE.Vector3(),
    baseTarget: new THREE.Vector3(),
    position: new THREE.Vector3(),
    target: new THREE.Vector3(),
    right: new THREE.Vector3(),
    up: new THREE.Vector3(),
    maxLateral: 0,
    lateralOffset: 0,
    lateralFocusScale: 0.35,
    prev: null
  });
  const [cueGalleryActive, setCueGalleryActive] = useState(false);

  const getCueColorFromIndex = useCallback((index) => {
    if (!Array.isArray(CUE_FINISH_PALETTE) || CUE_FINISH_PALETTE.length === 0) {
      return 0xdeb887;
    }
    const paletteLength = CUE_FINISH_PALETTE.length;
    const normalized = ((index % paletteLength) + paletteLength) % paletteLength;
    return CUE_FINISH_PALETTE[normalized];
  }, []);

  const createCueStripeTexture = useCallback((hexColor) => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const base = new THREE.Color(hexColor ?? 0xffffff);
    const accent = base.clone().offsetHSL(0.04, 0.08, 0.12);
    const shadow = base.clone().lerp(new THREE.Color(0x111111), 0.4);
    const bandTop = canvas.height * 0.34;
    const bandBottom = canvas.height * 0.92;
    const fade = canvas.height * 0.06;

    const bandMask = ctx.createLinearGradient(0, bandTop - fade, 0, bandTop + fade);
    bandMask.addColorStop(0, 'rgba(0,0,0,0)');
    bandMask.addColorStop(0.5, 'rgba(0,0,0,1)');
    bandMask.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = bandMask;
    ctx.fillRect(0, bandTop - fade, canvas.width, fade * 2);

    const bandMaskBottom = ctx.createLinearGradient(0, bandBottom - fade, 0, bandBottom + fade);
    bandMaskBottom.addColorStop(0, 'rgba(0,0,0,1)');
    bandMaskBottom.addColorStop(0.5, 'rgba(0,0,0,1)');
    bandMaskBottom.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bandMaskBottom;
    ctx.fillRect(0, bandBottom - fade, canvas.width, fade * 2);

    ctx.fillStyle = '#000';
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillRect(0, bandTop, canvas.width, bandBottom - bandTop);
    ctx.globalCompositeOperation = 'source-over';

    const stripeCount = 18;
    const stripeWidth = canvas.width / stripeCount;
    for (let i = 0; i < stripeCount; i += 1) {
      const x = i * stripeWidth;
      const stripeGradient = ctx.createLinearGradient(x, bandTop, x + stripeWidth, bandBottom);
      const c1 = i % 2 === 0 ? accent : base;
      const c2 = i % 2 === 0 ? base : shadow;
      stripeGradient.addColorStop(0, c1.getStyle());
      stripeGradient.addColorStop(1, c2.getStyle());
      ctx.fillStyle = stripeGradient;
      ctx.fillRect(x, bandTop, stripeWidth * 0.9, bandBottom - bandTop);
    }

    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 42; i += 1) {
      const x = Math.random() * canvas.width;
      const y = bandTop + Math.random() * (bandBottom - bandTop);
      const w = stripeWidth * 0.25 + Math.random() * stripeWidth * 0.5;
      const h = Math.random() * fade * 0.8;
      ctx.beginPath();
      ctx.ellipse(x, y, w, h, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const texture = new THREE.CanvasTexture(canvas);
    applySRGBColorSpace(texture);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
    return texture;
  }, []);

  const updateCueStripeMaterial = useCallback(
    (index) => {
      const materials = cueMaterialsRef.current ?? {};
      const stripeMaterial = materials.stripe;
      if (!stripeMaterial) return;
      const color = getCueColorFromIndex(index);
      const nextTexture = createCueStripeTexture(color);
      const prevMap = stripeMaterial.map;
      stripeMaterial.map = nextTexture;
      stripeMaterial.color.set(0xffffff);
      stripeMaterial.roughness = 0.32;
      stripeMaterial.metalness = 0.1;
      stripeMaterial.clearcoat = 0.12;
      stripeMaterial.transparent = true;
      stripeMaterial.depthWrite = false;
      stripeMaterial.side = THREE.DoubleSide;
      stripeMaterial.needsUpdate = true;
      if (prevMap && prevMap.dispose) prevMap.dispose();
    },
    [createCueStripeTexture, getCueColorFromIndex]
  );

  const updateCueRackHighlights = useCallback(() => {
    const selectedIndex = cueStyleIndexRef.current ?? 0;
    const groups = cueOptionGroupsRef.current;
    if (!Array.isArray(groups)) return;
    groups.forEach((group) => {
      if (!group) return;
      const isSelected =
        group.userData?.cueOptionIndex === selectedIndex &&
        group.userData?.cueOptionIndex != null;
      group.traverse((node) => {
        if (!node?.isMesh) return;
        const materials = Array.isArray(node.material)
          ? node.material
          : [node.material];
        materials.forEach((material) => {
          if (!material?.userData?.isCueWood) return;
          if (!material.emissive) {
            material.emissive = new THREE.Color(0, 0, 0);
          }
          material.emissiveIntensity = isSelected ? 0.32 : 0.08;
          material.emissive.setHex(isSelected ? 0x442200 : 0x000000);
          material.needsUpdate = true;
        });
      });
    });
  }, []);

  const applySelectedCueStyle = useCallback(
    (index) => {
      const paletteLength = CUE_FINISH_PALETTE.length || CUE_FINISH_OPTIONS.length || 1;
      const normalized = ((index % paletteLength) + paletteLength) % paletteLength;
      const finish = CUE_FINISH_OPTIONS[normalized % CUE_FINISH_OPTIONS.length];
      const color = getCueColorFromIndex(normalized);
      cueStyleIndexRef.current = normalized;
      const materials = cueMaterialsRef.current ?? {};
      const shaftMaterial = materials.shaft;
      if (shaftMaterial && finish) {
        const defaultWoodOption =
          WOOD_GRAIN_OPTIONS_BY_ID[DEFAULT_WOOD_GRAIN_ID] ?? WOOD_GRAIN_OPTIONS[0];
        const resolvedWoodOption =
          finish?.woodTexture ||
          (finish?.woodTextureId && WOOD_GRAIN_OPTIONS_BY_ID[finish.woodTextureId]) ||
          defaultWoodOption;
        const cueSurface = resolveWoodSurfaceConfig(
          resolvedWoodOption?.rail,
          resolvedWoodOption?.frame ?? { repeat: { x: 1, y: 1 }, rotation: 0 }
        );
        const woodRepeatScale = clampWoodRepeatScaleValue(
          (finish?.woodRepeatScale ?? DEFAULT_WOOD_REPEAT_SCALE) * CUE_WOOD_REPEAT_SCALE
        );
        const cueTextureSize = Math.max(
          cueSurface.textureSize ?? DEFAULT_WOOD_TEXTURE_SIZE,
          CUE_WOOD_TEXTURE_SIZE
        );
        const cueSurfaceConfig = {
          repeat: cueSurface.repeat,
          rotation: cueSurface.rotation,
          textureSize: cueTextureSize,
          mapUrl: upgradePolyHavenTextureUrlTo4k(cueSurface.mapUrl),
          roughnessMapUrl: upgradePolyHavenTextureUrlTo4k(cueSurface.roughnessMapUrl),
          normalMapUrl: upgradePolyHavenTextureUrlTo4k(cueSurface.normalMapUrl),
          woodRepeatScale
        };
        [materials.shaft, materials.buttMaterial, materials.buttCapMaterial].forEach((mat) => {
          if (!mat) return;
          applyWoodTextureToMaterial(mat, cueSurfaceConfig);
          applySharedWoodSurfaceProps(mat);
          mat.color?.setHex(0xffffff);
          mat.needsUpdate = true;
        });
        const tintColor = new THREE.Color(color || 0xffffff);
        shaftMaterial.color.copy(tintColor).lerp(new THREE.Color(0xffffff), 0.35);
        shaftMaterial.roughness = 0.34;
        shaftMaterial.metalness = 0.0;
        shaftMaterial.clearcoat = 0.6;
        shaftMaterial.clearcoatRoughness = 0.22;
        shaftMaterial.sheen = SHARED_WOOD_SURFACE_PROPS.sheen;
        shaftMaterial.sheenRoughness = SHARED_WOOD_SURFACE_PROPS.sheenRoughness;
        shaftMaterial.envMapIntensity = SHARED_WOOD_SURFACE_PROPS.envMapIntensity;
        materials.styleIndex = normalized;
        shaftMaterial.userData = shaftMaterial.userData || {};
        shaftMaterial.userData.isCueWood = true;
        shaftMaterial.userData.cueOptionIndex = normalized;
        shaftMaterial.userData.cueOptionColor = color;
        shaftMaterial.needsUpdate = true;
      }
      updateCueRackHighlights();
      updateCueStripeMaterial(normalized);
    },
    [getCueColorFromIndex, updateCueRackHighlights, updateCueStripeMaterial]
  );

  useEffect(() => {
    const preset = CUE_FINISH_OPTIONS[cueStyleIndex];
    if (!preset || !isCueFinishUnlocked(preset.id, poolInventory)) {
      setCueStyleIndex(resolveCueIndex());
    }
  }, [cueStyleIndex, isCueFinishUnlocked, poolInventory, resolveCueIndex]);

  useEffect(() => {
    cueStyleIndexRef.current = cueStyleIndex;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        CUE_STYLE_STORAGE_KEY,
        String(cueStyleIndex)
      );
    }
    applySelectedCueStyle(cueStyleIndex);
  }, [cueStyleIndex, applySelectedCueStyle]);

  const highlightChalks = useCallback(
    (activeIndex, suggestedIndex = visibleChalkIndexRef.current) => {
      const meshes = chalkMeshesRef.current;
      if (!Array.isArray(meshes)) return;
      const applyChalkColor = (mat, hex) => {
        if (!mat) return;
        if (mat.map) {
          mat.color.setHex(0xffffff);
        } else {
          mat.color.setHex(hex);
        }
      };
      meshes.forEach((mesh) => {
        if (!mesh) return;
        const chalkIndex = mesh.userData?.chalkIndex;
        const materials = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        const isActive = chalkIndex === activeIndex;
        const isSuggested = chalkIndex === suggestedIndex && !isActive;
        materials.forEach((mat, matIndex) => {
          if (!mat || !mat.color) return;
          if (matIndex === 2) {
            applyChalkColor(mat, isActive ? CHALK_ACTIVE_COLOR : CHALK_TOP_COLOR);
          } else if (matIndex === 3) {
            applyChalkColor(mat, CHALK_BOTTOM_COLOR);
          } else {
            applyChalkColor(
              mat,
              isActive || isSuggested
                ? CHALK_SIDE_ACTIVE_COLOR
                : CHALK_SIDE_COLOR
            );
          }
          if (typeof mat.clearcoat === 'number') {
            mat.clearcoat = isActive
              ? Math.max(mat.clearcoat, 0.54)
              : Math.max(mat.clearcoat ?? 0.3, 0.32);
            mat.clearcoatRoughness = isActive
              ? Math.min(mat.clearcoatRoughness ?? 0.26, 0.28)
              : Math.max(mat.clearcoatRoughness ?? 0.24, 0.24);
          }
          if (mat.emissive) {
            if (isActive) {
              mat.emissive.setHex(CHALK_ACTIVE_EMISSIVE_COLOR);
              mat.emissiveIntensity = 0.46;
            } else {
              mat.emissive.setHex(CHALK_EMISSIVE_COLOR);
              mat.emissiveIntensity = isSuggested ? 0.28 : 0.18;
            }
          }
          mat.needsUpdate = true;
        });
      });
    },
    []
  );

  const updateChalkVisibility = useCallback(
    (index) => {
      const previous = visibleChalkIndexRef.current;
      if (previous === index) return;
      visibleChalkIndexRef.current = index;
      const meshes = chalkMeshesRef.current;
      if (Array.isArray(meshes)) {
        meshes.forEach((mesh) => {
          if (!mesh) return;
          mesh.visible = true;
        });
      }
      if (
        activeChalkIndexRef.current !== null &&
        activeChalkIndexRef.current !== index
      ) {
        setActiveChalkIndex(null);
      }
      highlightChalks(activeChalkIndexRef.current, index);
    },
    [highlightChalks, setActiveChalkIndex]
  );

  useEffect(() => {
    activeChalkIndexRef.current = activeChalkIndex;
    highlightChalks(activeChalkIndex, visibleChalkIndexRef.current);
    chalkAssistEnabledRef.current = activeChalkIndex !== null;
    if (activeChalkIndex === null) {
      chalkAssistTargetRef.current = false;
      const area = chalkAreaRef.current;
      if (area) area.visible = false;
    }
  }, [activeChalkIndex, highlightChalks]);

  const toggleChalkAssist = useCallback(
    (index = null, options = {}) => {
      void options;
      const targetIndex = index;
      activeChalkIndexRef.current = targetIndex;
      setActiveChalkIndex(targetIndex);
      chalkAssistEnabledRef.current = targetIndex !== null;
      chalkAssistTargetRef.current = targetIndex !== null;
      const area = chalkAreaRef.current;
      if (area) {
        area.visible = targetIndex !== null;
      }
      if (targetIndex !== null) {
        highlightChalks(targetIndex, visibleChalkIndexRef.current);
      }
    },
    [highlightChalks]
  );
  const tableSizeRef = useRef(responsiveTableSize);
  useEffect(() => {
    tableSizeRef.current = responsiveTableSize;
  }, [responsiveTableSize]);
  const applyWorldScaleRef = useRef(() => {});
  useEffect(() => {
    applyWorldScaleRef.current?.();
  }, [responsiveTableSize]);
  useEffect(() => {
    railMarkerStyleRef.current = {
      shape: railMarkerShapeId,
      colorId: railMarkerColorId
    };
  }, [railMarkerColorId, railMarkerShapeId]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('poolRailMarkerShape', railMarkerShapeId);
  }, [railMarkerShapeId]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('poolRailMarkerColor', railMarkerColorId);
  }, [railMarkerColorId]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(HDRI_STORAGE_KEY, environmentHdriId);
  }, [environmentHdriId]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(HDRI_RESOLUTION_STORAGE_KEY, hdriResolutionId);
  }, [hdriResolutionId]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(LIGHTING_STORAGE_KEY, lightingId);
  }, [lightingId]);
  useEffect(() => {
    applyRailMarkerStyleRef.current?.(railMarkerStyleRef.current);
  }, [railMarkerColorId, railMarkerShapeId]);
  useEffect(() => {
    environmentHdriRef.current = environmentHdriId;
    activeEnvironmentVariantRef.current = activeEnvironmentHdri;
  }, [activeEnvironmentHdri, environmentHdriId]);
  useEffect(() => {
    if (typeof updateEnvironmentRef.current === 'function') {
      updateEnvironmentRef.current(activeEnvironmentVariantRef.current);
    }
  }, [activeEnvironmentHdri, environmentHdriId]);
  useEffect(() => {
    activeTableSlotRef.current = activeTableSlot;
  }, [activeTableSlot]);
  useEffect(() => {
    applyTableSlotRef.current?.(activeTableSlotRef.current, dualTablesEnabled);
  }, [activeTableSlot, dualTablesEnabled]);
  useEffect(() => {
    if (dualTablesEnabled) {
      setActiveTableSlot(1);
      setTableSelectionOpen(false);
    } else {
      setTableSelectionOpen(false);
      setActiveTableSlot(0);
    }
  }, [dualTablesEnabled]);
  const tableFinish = useMemo(() => {
    const baseFinish =
      TABLE_FINISHES[tableFinishId] ?? TABLE_FINISHES[DEFAULT_TABLE_FINISH_ID];
    const baseCreateMaterials =
      typeof baseFinish?.createMaterials === 'function'
        ? baseFinish.createMaterials
        : TABLE_FINISHES[DEFAULT_TABLE_FINISH_ID].createMaterials;
    const chromeSelection = activeChromeOption;
    const clothSelection = activeClothOption;
    const linerSelection = activePocketLinerOption;
    const clothTextureKey = clothSelection.textureKey ?? clothSelection.id ?? DEFAULT_CLOTH_TEXTURE_KEY;
    return {
      ...baseFinish,
      clothDetail:
        clothSelection.detail ?? baseFinish?.clothDetail ?? null,
      clothTextureKey,
      colors: {
        ...baseFinish.colors,
        cloth: clothSelection.color,
        cushion: clothSelection.cushionColor ?? clothSelection.color
      },
      woodTexture: baseFinish?.woodTexture ?? null,
      woodTextureEnabled: baseFinish?.woodTextureEnabled ?? WOOD_TEXTURES_ENABLED,
      woodTextureId: baseFinish?.woodTextureId ?? null,
      woodRepeatScale: baseFinish?.woodRepeatScale ?? DEFAULT_WOOD_REPEAT_SCALE,
      createMaterials: () => {
        const baseMaterials = baseCreateMaterials();
        const materials = { ...baseMaterials };
        if (materials.trim) {
          materials.trim = materials.trim.clone();
        } else {
          materials.trim = new THREE.MeshPhysicalMaterial({
            color: chromeSelection.color,
            metalness: chromeSelection.metalness,
            roughness: chromeSelection.roughness,
            clearcoat: chromeSelection.clearcoat,
            clearcoatRoughness: chromeSelection.clearcoatRoughness
          });
        }
        materials.trim.color.set(chromeSelection.color);
        materials.trim.metalness = chromeSelection.metalness;
        materials.trim.roughness = chromeSelection.roughness;
        materials.trim.clearcoat = chromeSelection.clearcoat;
        materials.trim.clearcoatRoughness = chromeSelection.clearcoatRoughness;
        if (typeof chromeSelection.envMapIntensity === 'number') {
          materials.trim.envMapIntensity = chromeSelection.envMapIntensity;
        }
        if (materials.accent?.material) {
          materials.accent = {
            ...materials.accent,
            material: materials.accent.material.clone()
          };
        }
        const liners = createPocketLinerMaterials(linerSelection);
        materials.pocketJaw = liners.jawMaterial;
        materials.pocketRim = liners.rimMaterial;
        return materials;
      }
    };
  }, [tableFinishId, activeChromeOption, activeClothOption, activePocketLinerOption]);
  const tableFinishRef = useRef(tableFinish);
  useEffect(() => {
    tableFinishRef.current = tableFinish;
  }, [tableFinish]);
  const activeVariantRef = useRef(activeVariant);
  useEffect(() => {
    activeVariantRef.current = activeVariant;
  }, [activeVariant]);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(TABLE_FINISH_STORAGE_KEY, tableFinishId);
    }
  }, [tableFinishId]);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(TABLE_BASE_STORAGE_KEY, tableBaseId);
    }
  }, [tableBaseId]);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(CLOTH_COLOR_STORAGE_KEY, clothColorId);
    }
  }, [clothColorId]);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(POCKET_LINER_STORAGE_KEY, pocketLinerId);
    }
  }, [pocketLinerId]);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('poolChromeColor', chromeColorId);
    }
  }, [chromeColorId]);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(FRAME_RATE_STORAGE_KEY, frameRateId);
    }
  }, [frameRateId]);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(BROADCAST_SYSTEM_STORAGE_KEY, broadcastSystemId);
    }
  }, [broadcastSystemId]);
  useEffect(() => {
    if (!configOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setConfigOpen(false);
      }
    };
    const handlePointerDown = (event) => {
      const panel = configPanelRef.current;
      const button = configButtonRef.current;
      if (!panel) return;
      if (panel.contains(event.target)) return;
      if (button?.contains(event.target)) return;
      setConfigOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [configOpen]);
  const applyBaseRef = useRef(() => {});
  const applyFinishRef = useRef(() => {});
  const applyTableSlotRef = useRef(() => {});
  const updateDecorTablesRef = useRef(() => {});
  const clearDecorTablesRef = useRef(() => {});
  const updateHospitalityLayoutRef = useRef(() => {});
  const clearHospitalityLayoutRef = useRef(() => {});
  const decorativeTablesRef = useRef([]);
  const hospitalityGroupsRef = useRef([]);
  const hospitalityLayoutRunRef = useRef(null);
  const chessLoungeTemplateRef = useRef(null);
  const chessChairTemplateRef = useRef(null);
  const chessLoungeLoadRef = useRef(null);
  const hospitalityLoaderRef = useRef(null);
  const refreshSecondaryTableDecorRef = useRef(() => {});
  const clearSecondaryTableDecorRef = useRef(() => {});
  const secondaryTableDecorRef = useRef({ group: null, dispose: null });
  const secondaryTableRef = useRef(null);
  const secondaryBaseSetterRef = useRef(null);
  const activeTableSlotRef = useRef(initialTableSlot);
  const playerLabel = playerName || 'Player';
  const effectiveMode = isTraining ? trainingModeState : mode;
  const opponentLabel =
    effectiveMode === 'online' ? opponentName || 'Opponent' : opponentName || 'AI';
  const tableId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('tableId') || '';
  }, [location.search]);
  const localSeat = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('seat') === 'B' ? 'B' : 'A';
  }, [location.search]);
  const starterSeat = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('starter') === 'B' ? 'B' : 'A';
  }, [location.search]);
  const isOnlineMatch = mode === 'online';
  const aiOpponentEnabled = !isOnlineMatch;
  const framePlayerAName = localSeat === 'A' ? playerLabel : opponentLabel;
  const framePlayerBName = localSeat === 'A' ? opponentLabel : playerLabel;
  const initialFrame = useMemo(() => {
    const baseFrame = rules.getInitialFrame(framePlayerAName, framePlayerBName);
    const desiredStarter = starterSeat === 'B' ? 'B' : 'A';
    if (baseFrame.activePlayer === desiredStarter) return baseFrame;
    return { ...baseFrame, activePlayer: desiredStarter };
  }, [framePlayerAName, framePlayerBName, rules, starterSeat]);
  const [frameState, setFrameState] = useState(initialFrame);
  useEffect(() => {
    setFrameState(initialFrame);
  }, [initialFrame]);
  const frameRef = useRef(frameState);
  useEffect(() => {
    frameRef.current = frameState;
  }, [frameState]);
  const opponentProfile = useMemo(
    () => (localSeat === 'A' ? frameState?.players?.B : frameState?.players?.A),
    [frameState?.players, localSeat]
  );
  const opponentDisplayName = opponentProfile?.name || opponentLabel;
  const opponentDisplayAvatar = opponentProfile?.avatar || opponentAvatar || '/assets/icons/profile.svg';
  const [aiPlanning, setAiPlanning] = useState(null);
  const aiPlanRef = useRef(null);
  const aiPlanningRef = useRef(null);
  useEffect(() => {
    aiPlanningRef.current = aiPlanning;
  }, [aiPlanning]);
  const userSuggestionPlanRef = useRef(null);
  const shotContextRef = useRef({
    placedFromHand: false,
    contactMade: false,
    cushionAfterContact: false
  });
  const shotReplayRef = useRef(null);
  const replayPlaybackRef = useRef(null);
  const [replayBanner, setReplayBanner] = useState(null);
  const replayBannerTimeoutRef = useRef(null);
  const [replaySlate, setReplaySlate] = useState(null);
  const replaySlateTimeoutRef = useRef(null);
  const waitForActiveReplay = useCallback(
    (timeoutMs = 8000) =>
      new Promise((resolve) => {
        const start = performance.now();
        const tick = () => {
          const hasReplay =
            replayPlaybackRef.current ||
            replayBannerTimeoutRef.current ||
            replaySlateTimeoutRef.current;
          if (!hasReplay) {
            resolve();
            return;
          }
          if (performance.now() - start > timeoutMs) {
            resolve();
            return;
          }
          requestAnimationFrame(tick);
        };
        tick();
      }),
    []
  );
  const shotCameraHoldTimeoutRef = useRef(null);
  const [inHandPlacementMode, setInHandPlacementMode] = useState(false);
  useEffect(
    () => () => {
      if (replayBannerTimeoutRef.current) {
        clearTimeout(replayBannerTimeoutRef.current);
        replayBannerTimeoutRef.current = null;
      }
      if (replaySlateTimeoutRef.current) {
        clearTimeout(replaySlateTimeoutRef.current);
        replaySlateTimeoutRef.current = null;
      }
    },
    []
  );
  const inHandPlacementModeRef = useRef(inHandPlacementMode);
  const gameOverHandledRef = useRef(false);
  const userSuggestionRef = useRef(null);
  const startAiThinkingRef = useRef(() => {});
  const stopAiThinkingRef = useRef(() => {});
  const startUserSuggestionRef = useRef(() => {});
  const autoAimRequestRef = useRef(false);
  const aiTelemetryRef = useRef({ key: null, countdown: 0 });
  const inHandCameraRestoreRef = useRef(null);
const initialHudInHand = useMemo(
  () => deriveInHandFromFrame(initialFrame),
  [initialFrame]
);
const [hud, setHud] = useState({
  power: 0,
  A: 0,
  B: 0,
  turn: 0,
  phase: 'reds',
  next: 'red',
  inHand: initialHudInHand,
  over: false
});
const [turnCycle, setTurnCycle] = useState(0);
const [pottedBySeat, setPottedBySeat] = useState({ A: [], B: [] });
const lastPottedBySeatRef = useRef({ A: null, B: null });
const lastAssignmentsRef = useRef({ A: null, B: null });
const lastShotReminderRef = useRef({ A: 0, B: 0 });
const [ruleToast, setRuleToast] = useState(null);
const ruleToastTimeoutRef = useRef(null);
const [replayActive, setReplayActive] = useState(false);
const [hudInsets, setHudInsets] = useState({ left: '0px', right: '0px' });
const [bottomHudOffset, setBottomHudOffset] = useState(0);
const leftControlsRef = useRef(null);
const spinBoxRef = useRef(null);
const showRuleToast = useCallback((message) => {
  if (!message) return;
  if (ruleToastTimeoutRef.current) {
    clearTimeout(ruleToastTimeoutRef.current);
    ruleToastTimeoutRef.current = null;
  }
  setRuleToast(message);
  ruleToastTimeoutRef.current = window.setTimeout(() => {
    setRuleToast(null);
    ruleToastTimeoutRef.current = null;
  }, 3000);
}, []);
const powerRef = useRef(hud.power);
  const applyPower = useCallback((nextPower) => {
    const clampedPower = THREE.MathUtils.clamp(nextPower ?? 0, 0, 1);
    powerRef.current = clampedPower;
    setHud((prev) => ({ ...prev, power: clampedPower }));
  }, []);
  useEffect(() => {
    inHandPlacementModeRef.current = inHandPlacementMode;
  }, [inHandPlacementMode]);
  useEffect(() => {
    powerRef.current = hud.power;
  }, [hud.power]);
  const hudRef = useRef(hud);
  useEffect(() => {
    hudRef.current = hud;
  }, [hud]);
  useEffect(
    () => () => {
      if (ruleToastTimeoutRef.current) {
        clearTimeout(ruleToastTimeoutRef.current);
        ruleToastTimeoutRef.current = null;
      }
      if (shotCameraHoldTimeoutRef.current) {
        clearTimeout(shotCameraHoldTimeoutRef.current);
        shotCameraHoldTimeoutRef.current = null;
      }
    },
    []
  );
  const localSeatRef = useRef(localSeat);
  useEffect(() => {
    localSeatRef.current = localSeat;
  }, [localSeat]);
  useEffect(() => {
    const nextInHand = deriveInHandFromFrame(initialFrame);
    cueBallPlacedFromHandRef.current = !nextInHand;
    setPottedBySeat({ A: [], B: [] });
    lastAssignmentsRef.current = { A: null, B: null };
    lastShotReminderRef.current = { A: 0, B: 0 };
    setTurnCycle(0);
    setRuleToast(null);
    setHud((prev) => ({
      ...prev,
      A: 0,
      B: 0,
      turn: 0,
      phase: 'reds',
      next: 'red',
      inHand: nextInHand,
      over: false
    }));
  }, [initialFrame]);
  useEffect(() => {
    if (!isTraining) return;
    gameOverHandledRef.current = false;
    setFrameState((prev) => ({
      ...prev,
      activePlayer: trainingModeState === 'solo' ? 'A' : prev.activePlayer ?? 'A',
      foul: trainingRulesOn ? prev.foul : undefined,
      frameOver: trainingRulesOn ? prev.frameOver : false,
      winner: trainingRulesOn ? prev.winner : undefined
    }));
    setHud((prev) => ({
      ...prev,
      turn: trainingModeState === 'solo' ? 0 : prev.turn ?? 0,
      over: trainingRulesOn ? prev.over : false
    }));
  }, [isTraining, trainingModeState, trainingRulesOn, setFrameState]);
  useEffect(() => {
    if (!isTraining) {
      trainingCompletionHandledRef.current = false;
      return;
    }
    if (!frameState.frameOver) {
      trainingCompletionHandledRef.current = false;
      return;
    }
    if (trainingCompletionHandledRef.current) return;
    trainingCompletionHandledRef.current = true;
    const completedLevel = trainingLevelRef.current || 1;
    setTrainingProgress((prev) => {
      const completedSet = new Set(
        (prev?.completed || []).map((lvl) => Number(lvl)).filter((lvl) => Number.isFinite(lvl) && lvl > 0)
      );
      completedSet.add(completedLevel);
      const completed = Array.from(completedSet).sort((a, b) => a - b);
      const lastLevel = Math.max(prev?.lastLevel ?? 1, completedLevel);
      const updated = { completed, lastLevel };
      persistTrainingProgress(updated);
      const nextPlayable = resolvePlayableTrainingLevel(completedLevel + 1, updated);
      setTrainingLevel(nextPlayable);
      return updated;
    });
  }, [frameState.frameOver, isTraining, setTrainingProgress, setTrainingLevel]);
  const cueBallPlacedFromHandRef = useRef(false);
  useEffect(() => {
    const playerTurn = (hud.turn ?? 0) === 0;
    const placing = Boolean(hud.inHand && playerTurn);
    setInHandPlacementMode(placing);
    if (placing) {
      cueBallPlacedFromHandRef.current = false;
    }
  }, [hud.inHand, hud.turn]);
  const [shotActive, setShotActive] = useState(false);
  const shootingRef = useRef(shotActive);
  useEffect(() => {
    shootingRef.current = shotActive;
  }, [shotActive]);
  const sliderInstanceRef = useRef(null);
  const suggestionAimKeyRef = useRef(null);
  const aiEarlyShotIntentRef = useRef(null);
  const aiShotPreviewRef = useRef(false);
  const aiShotTimeoutRef = useRef(null);
  const aiShotCueDropTimeoutRef = useRef(null);
  const aiShotCueViewRef = useRef(false);
  const aiCueViewBlendRef = useRef(AI_CAMERA_DROP_BLEND);
  const aiRetryTimeoutRef = useRef(null);
  const aiShotWindowRef = useRef({ startedAt: 0, duration: AI_MIN_SHOT_TIME_MS });
  const [aiTakingShot, setAiTakingShot] = useState(false);
  const cameraBlendTweenRef = useRef(null);
  const cancelCameraBlendTween = useCallback(() => {
    if (cameraBlendTweenRef.current) {
      cancelAnimationFrame(cameraBlendTweenRef.current);
      cameraBlendTweenRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    if (aiRetryTimeoutRef.current) {
      clearTimeout(aiRetryTimeoutRef.current);
      aiRetryTimeoutRef.current = null;
    }
  }, []);
  const recomputeAiShotState = useCallback(() => {
    const hudState = hudRef.current;
    const aiTurn = aiOpponentEnabled && hudState?.turn === 1;
    const previewing = Boolean(aiShotPreviewRef.current);
    const cueViewActive = Boolean(aiShotCueViewRef.current);
    const shooting = Boolean(shootingRef.current);
    const active =
      (aiTurn && (previewing || cueViewActive || shooting)) ||
      previewing ||
      cueViewActive;
    setAiTakingShot(active);
  }, [aiOpponentEnabled]);
  const setAiShotPreviewActive = useCallback(
    (value) => {
      aiShotPreviewRef.current = value;
      recomputeAiShotState();
    },
    [recomputeAiShotState]
  );
  const setAiShotCueViewActive = useCallback(
    (value) => {
      aiShotCueViewRef.current = value;
      recomputeAiShotState();
    },
    [recomputeAiShotState]
  );
  const cancelAiShotPreview = useCallback(() => {
    if (aiShotTimeoutRef.current) {
      clearTimeout(aiShotTimeoutRef.current);
      aiShotTimeoutRef.current = null;
    }
    if (aiShotCueDropTimeoutRef.current) {
      clearTimeout(aiShotCueDropTimeoutRef.current);
      aiShotCueDropTimeoutRef.current = null;
    }
    cancelCameraBlendTween();
    aiCueViewBlendRef.current = AI_CAMERA_DROP_BLEND;
    setAiShotPreviewActive(false);
    setAiShotCueViewActive(false);
  }, [setAiShotPreviewActive, setAiShotCueViewActive, cancelCameraBlendTween]);
  const clearEarlyAiShot = useCallback(() => {
    const intent = aiEarlyShotIntentRef.current;
    if (intent?.timeout) {
      clearTimeout(intent.timeout);
    }
    aiEarlyShotIntentRef.current = null;
    cancelAiShotPreview();
  }, [activeVariant, cancelAiShotPreview]);
  useEffect(() => () => {
    clearEarlyAiShot();
    cancelAiShotPreview();
  }, [clearEarlyAiShot, cancelAiShotPreview]);
  useEffect(() => {
    if (hud.turn !== 1) {
      clearEarlyAiShot();
    }
  }, [hud.turn, clearEarlyAiShot]);
  useEffect(() => {
    recomputeAiShotState();
  }, [recomputeAiShotState, hud.turn, shotActive]);
  const applySliderLock = useCallback(() => {
    const slider = sliderInstanceRef.current;
    if (!slider) return;
    const hudState = hudRef.current;
    const shouldLock =
      hudState?.turn !== 0 || hudState?.over || shootingRef.current;
    if (shouldLock) slider.lock();
    else slider.unlock();
  }, []);
  useEffect(() => {
    applySliderLock();
  }, [applySliderLock, hud.turn, hud.over, shotActive]);

  const applyLightingPreset = useCallback(
    (presetId = lightingId) => {
      const rig = lightingRigRef.current;
      const world = worldRef.current;
      if (!rig || !world) return;
      const preset =
        LIGHTING_PRESET_MAP[presetId] ?? LIGHTING_PRESET_MAP[DEFAULT_LIGHTING_ID];
      const settings = preset?.settings ?? {};
      const {
        key,
        fill,
        rim,
        wash,
        ambient
      } = rig;

      if (settings.keyColor && key) key.color.set(settings.keyColor);
      if (settings.keyIntensity && key) key.intensity = settings.keyIntensity;
      if (settings.fillColor && fill) fill.color.set(settings.fillColor);
      if (settings.fillIntensity && fill) fill.intensity = settings.fillIntensity;
      if (settings.washColor && wash) wash.color.set(settings.washColor);
      if (settings.washIntensity && wash) wash.intensity = settings.washIntensity;
      if (settings.rimColor && rim) rim.color.set(settings.rimColor);
      if (settings.rimIntensity && rim) rim.intensity = settings.rimIntensity;
      if (settings.ambientIntensity && ambient)
        ambient.intensity = settings.ambientIntensity;
    },
    [lightingId]
  );

  useEffect(() => {
    applyLightingPreset(lightingId);
  }, [applyLightingPreset, lightingId]);
  const [err, setErr] = useState(null);
  const [renderResetKey, setRenderResetKey] = useState(0);
  const fireRef = useRef(() => {}); // set from effect so slider can trigger fire()
  const sceneRef = useRef(null);
  const updateEnvironmentRef = useRef(() => {});
  const disposeEnvironmentRef = useRef(null);
  const envTextureRef = useRef(null);
  const envSkyboxRef = useRef(null);
  const envSkyboxTextureRef = useRef(null);
  const environmentHdriRef = useRef(environmentHdriId);
  const activeEnvironmentVariantRef = useRef(activeEnvironmentHdri);
  const cameraRef = useRef(null);
  const sphRef = useRef(null);
  const initialOrbitRef = useRef(null);
  const aimFocusRef = useRef(null);
  const [pocketCameraActive, setPocketCameraActive] = useState(false);
  const pocketCameraStateRef = useRef(false);
  const pocketCamerasRef = useRef(new Map());
  const broadcastCamerasRef = useRef(null);
  const lightingRigRef = useRef(null);
  const activeRenderCameraRef = useRef(null);
  const pocketSwitchIntentRef = useRef(null);
  const lastPocketBallRef = useRef(null);
  const cameraBlendRef = useRef(ACTION_CAMERA_START_BLEND);
  const lowViewSlideRef = useRef(0);
  const initialCuePhi = THREE.MathUtils.clamp(
    CUE_VIEW_MIN_PHI + CUE_VIEW_PHI_LIFT * 0.5,
    CAMERA.minPhi,
    CAMERA.maxPhi
  );
  const initialCueRadius = Math.max(BREAK_VIEW.radius, CUE_VIEW_MIN_RADIUS);
  const cameraBoundsRef = useRef({
    cueShot: { phi: initialCuePhi, radius: initialCueRadius },
    standing: { phi: STANDING_VIEW.phi, radius: BREAK_VIEW.radius }
  });
  const rendererRef = useRef(null);
  const last3DRef = useRef({ phi: CAMERA.maxPhi, theta: Math.PI });
  const cushionHeightRef = useRef(TABLE.THICK + 0.4);
  const fitRef = useRef(() => {});
  const topViewRef = useRef(false);
  const topViewLockedRef = useRef(false);
  const overheadBroadcastVariantRef = useRef('top');
  const preShotTopViewRef = useRef(false);
  const preShotTopViewLockRef = useRef(false);
  const sidePocketAimRef = useRef(false);
  const aimDirRef = useRef(new THREE.Vector2(0, 1));
  const playerOffsetRef = useRef(0);
  const orbitFocusRef = useRef({
    target: new THREE.Vector3(0, ORBIT_FOCUS_BASE_Y, 0),
    ballId: null
  });
  const topViewControlsRef = useRef({ enter: () => {}, exit: () => {} });
  const cameraUpdateRef = useRef(() => {});
  const orbitRadiusLimitRef = useRef(null);
  const applyRendererQuality = useCallback(() => {
    const renderer = rendererRef.current;
    const host = mountRef.current;
    if (!renderer || !host) return;
    const quality = frameQualityRef.current;
    const timing = frameTimingRef.current;
    const targetMs =
      timing && Number.isFinite(timing.targetMs) ? timing.targetMs : 1000 / 60;
    const targetFps = targetMs > 0 ? 1000 / targetMs : 60;
    const highFpsBias =
      targetFps >= 144 ? 0.9 : targetFps >= 120 ? 0.92 : targetFps >= 90 ? 0.96 : 1;
    const dpr =
      typeof window !== 'undefined' && typeof window.devicePixelRatio === 'number'
        ? window.devicePixelRatio
        : 1;
    const pixelRatioCap =
      quality?.pixelRatioCap ??
      (typeof window !== 'undefined' ? resolveDefaultPixelRatioCap() : 2);
    const renderScaleBase =
      typeof quality?.renderScale === 'number' && Number.isFinite(quality.renderScale)
        ? THREE.MathUtils.clamp(quality.renderScale, 0.78, 1.15)
        : 1;
    const renderScale = THREE.MathUtils.clamp(
      renderScaleBase * highFpsBias,
      0.78,
      1.15
    );
    const cappedDpr = Math.min(pixelRatioCap, dpr);
    const performanceDpr =
      highFpsBias < 1 ? cappedDpr * (0.92 + highFpsBias * 0.08) : cappedDpr;
    const resolvedPixelRatio = Math.max(1, performanceDpr);
    renderer.setPixelRatio(resolvedPixelRatio);
    renderer.setSize(host.clientWidth * renderScale, host.clientHeight * renderScale, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
  }, []);
  useEffect(() => {
    applyRendererQuality();
  }, [applyRendererQuality, frameQualityProfile]);
  const [timer, setTimer] = useState(60);
  const timerRef = useRef(null);
  const timerWarnedRef = useRef(false);
  const timerValueRef = useRef(timer);
  useEffect(() => {
    timerValueRef.current = timer;
  }, [timer]);
  const spinRef = useRef({ x: 0, y: 0 });
  const spinRequestRef = useRef({ x: 0, y: 0 });
  const resetSpinRef = useRef(() => {});
  const tipGroupRef = useRef(null);
  const cueBodyRef = useRef(null);
  const spinRangeRef = useRef({
    side: 0,
    forward: 0,
    offsetSide: 0,
    offsetVertical: 0
  });
  const spinLimitsRef = useRef({ ...DEFAULT_SPIN_LIMITS });
  const spinAppliedRef = useRef({ x: 0, y: 0, mode: 'standard', magnitude: 0 });
  const spinDotElRef = useRef(null);
  const spinLegalityRef = useRef({ blocked: false, reason: '' });
  const cuePullTargetRef = useRef(0);
  const cuePullCurrentRef = useRef(0);
  const lastCameraTargetRef = useRef(new THREE.Vector3(0, ORBIT_FOCUS_BASE_Y, 0));
  const replayCameraRef = useRef(null);
  const replayFrameCameraRef = useRef(null);
  const updateSpinDotPosition = useCallback((value, blocked) => {
    if (!value) value = { x: 0, y: 0 };
    const dot = spinDotElRef.current;
    if (!dot) return;
    const x = clamp(value.x ?? 0, -1, 1);
    const y = clamp(value.y ?? 0, -1, 1);
    const ranges = spinRangeRef.current || {};
    const maxSide = Math.max(ranges.offsetSide ?? MAX_SPIN_CONTACT_OFFSET, 1e-6);
    const maxVertical = Math.max(ranges.offsetVertical ?? MAX_SPIN_VERTICAL, 1e-6);
    const largest = Math.max(maxSide, maxVertical);
    const scaledX = (x * maxSide) / largest;
    const scaledY = (y * maxVertical) / largest;
    dot.style.left = `${50 + scaledX * 50}%`;
    dot.style.top = `${50 + scaledY * 50}%`;
    const magnitude = Math.hypot(x, y);
    const showBlocked = blocked ?? spinLegalityRef.current?.blocked;
    dot.style.backgroundColor = showBlocked
      ? '#9ca3af'
      : magnitude >= SWERVE_THRESHOLD
        ? '#facc15'
        : '#dc2626';
    dot.dataset.blocked = showBlocked ? '1' : '0';
  }, []);
  const cueRef = useRef(null);
  const ballsRef = useRef([]);
  const pocketDropRef = useRef(new Map());
  const pocketRestIndexRef = useRef(new Map());
  const captureBallSnapshotRef = useRef(null);
  const applyBallSnapshotRef = useRef(null);
  const pendingLayoutRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioBuffersRef = useRef({
    cue: null,
    ball: null,
    pocket: null,
    knock: null,
    cheer: null,
    shock: null,
    chalk: null
  });
  const chessBoardTextureRef = useRef(null);
  const dartboardTextureRef = useRef(null);
  const activeCrowdSoundRef = useRef(null);
  const muteRef = useRef(isGameMuted());
  const volumeRef = useRef(getGameVolume());
  const railSoundTimeRef = useRef(new Map());
  const liftLandingTimeRef = useRef(new Map());
  const powerImpactHoldRef = useRef(0);
  const [player, setPlayer] = useState({ name: '', avatar: '' });
  const playerInfoRef = useRef(player);
  useEffect(() => {
    playerInfoRef.current = player;
  }, [player]);
  const panelsRef = useRef(null);
  const { mapDelta } = useAimCalibration();

  const goToLobby = useCallback(() => {
    const winnerId = frameRef.current?.winner ?? frameState.winner;
    const winnerParam = winnerId === 'A' ? '1' : winnerId === 'B' ? '0' : '';
    if (tournamentMode) {
      const search = location.search && location.search.length ? location.search : '';
      window.location.assign(`/pool-royale-bracket.html${search}`);
      return;
    }
    const lobbyUrl = winnerParam
      ? `/games/poolroyale/lobby?winner=${winnerParam}`
      : '/games/poolroyale/lobby';
    window.location.assign(lobbyUrl);
  }, [frameState.winner, location.search, tournamentMode]);
  const simulateRoundAI = useCallback((st, round) => {
    const next = st.rounds[round + 1];
    const userSeed = st.userSeed;
    st.rounds[round].forEach((pair, idx) => {
      if (pair.includes(userSeed)) return;
      if (next && next[Math.floor(idx / 2)][idx % 2]) return;
      const [s1, s2] = pair;
      const p1 = st.seedToPlayer[s1];
      const p2 = st.seedToPlayer[s2];
      let winnerSeed = s1;
      if (p1?.name === 'BYE') winnerSeed = s2;
      else if (p2?.name === 'BYE') winnerSeed = s1;
      else winnerSeed = Math.random() < 0.5 ? s1 : s2;
      if (next) next[Math.floor(idx / 2)][idx % 2] = winnerSeed;
      else {
        st.championSeed = winnerSeed;
        st.complete = true;
      }
    });
  }, []);
  const simulateRemaining = useCallback(
    (st, startRound = 0) => {
      for (let r = startRound; r < st.rounds.length; r += 1) {
        simulateRoundAI(st, r);
        if (st.complete) break;
      }
      st.currentRound = st.rounds.length - 1;
      st.complete = true;
    },
    [simulateRoundAI]
  );
  const handleTournamentResult = useCallback(
    async ({ winnerSeat, scores }) => {
      if (!tournamentMode) return { unlocks: [] };
      try {
        const raw = window.localStorage.getItem(tournamentStateKey);
        if (!raw) {
          window.location.assign(`/pool-royale-bracket.html${location.search}`);
          return { unlocks: [] };
        }
        const st = JSON.parse(raw);
        if (!st?.pendingMatch) {
          window.location.assign(`/pool-royale-bracket.html${location.search}`);
          return { unlocks: [] };
        }
        const r = st.pendingMatch.round;
        const m = st.pendingMatch.match;
        const userSeed = st.userSeed || 1;
        const oppSeed =
          st.pendingMatch.pair[0] === userSeed ? st.pendingMatch.pair[1] : st.pendingMatch.pair[0];
        const userSeat = localSeat === 'B' ? 'B' : 'A';
        const userWon = winnerSeat === userSeat;
        const winnerSeed = userWon ? userSeed : oppSeed;
        const next = st.rounds[r + 1];
        if (next) next[Math.floor(m / 2)][m % 2] = winnerSeed;
        else {
          st.championSeed = winnerSeed;
          st.complete = true;
        }
        if (winnerSeed !== userSeed) {
          simulateRemaining(st, r);
        } else {
          simulateRoundAI(st, r);
          if (next && st.rounds[r].every((pair, idx) => next[Math.floor(idx / 2)][idx % 2])) {
            st.currentRound = r + 1;
          }
        }
        const prizePot = Math.max(
          Number.isFinite(st.pot) ? st.pot : 0,
          Math.round(stakeAmount * (tournamentPlayers || st.N || 2))
        );
        st.pot = prizePot;
        window.localStorage.setItem(
          tournamentLastResultKey,
          JSON.stringify({ p1: scores?.A ?? 0, p2: scores?.B ?? 0 })
        );
        delete st.pendingMatch;
        window.localStorage.setItem(tournamentStateKey, JSON.stringify(st));
        window.localStorage.removeItem(tournamentOppKey);
        if (st.complete) {
          try {
            window.localStorage.removeItem(tournamentAiFlagStorageKey);
          } catch (err) {
            console.warn('Pool Royale tournament AI flag reset failed', err);
          }
          if (winnerSeed === userSeed) {
            const unlocks = await awardTournamentLoot();
            return { unlocks };
          }
        }
      } catch (err) {
        console.error('Pool Royale tournament result update failed', err);
      }
      return { unlocks: [] };
    },
    [
      awardTournamentLoot,
      localSeat,
      location.search,
      simulateRemaining,
      simulateRoundAI,
      stakeAmount,
      tournamentLastResultKey,
      tournamentAiFlagStorageKey,
      tournamentMode,
      tournamentOppKey,
      tournamentPlayers,
      tournamentStateKey
    ]
  );

  const stopActiveCrowdSound = useCallback(() => {
    const current = activeCrowdSoundRef.current;
    if (current) {
      try {
        current.stop();
      } catch {}
      activeCrowdSoundRef.current = null;
    }
  }, []);

  const selectCueStyleFromMenu = useCallback(
    async (index) => {
      const charged = await ensureCueFeePaid();
      if (!charged) return;
      const paletteLength = CUE_FINISH_PALETTE.length || 1;
      const normalized = ((index % paletteLength) + paletteLength) % paletteLength;
      const preset = CUE_FINISH_OPTIONS[normalized % CUE_FINISH_OPTIONS.length];
      if (!preset || !isCueFinishUnlocked(preset.id, poolInventory)) {
        setCueStyleIndex(resolveCueIndex());
        return;
      }
      applySelectedCueStyle(normalized);
      setCueStyleIndex(normalized);
    },
    [applySelectedCueStyle, ensureCueFeePaid, isCueFinishUnlocked, poolInventory, resolveCueIndex]
  );

  const routeAudioNode = useCallback((node) => {
    const ctx = audioContextRef.current;
    if (!ctx || !node) return;
    try {
      node.connect(ctx.destination);
    } catch {}
  }, []);

  const playCueHit = useCallback((vol = 1) => {
    const ctx = audioContextRef.current;
    const buffer = audioBuffersRef.current.cue;
    if (!ctx || !buffer || muteRef.current) return;
    const power = clamp(vol, 0, 1);
    const baseGain =
      volumeRef.current *
      1.2 *
      1.5 *
      1.5 *
      CUE_STRIKE_VOLUME_MULTIPLIER * // amplify cue strike playback for a clearer hit
      (0.35 + power * 0.75);
    const scaled = clamp(baseGain, 0, CUE_STRIKE_MAX_GAIN);
    if (scaled <= 0 || !Number.isFinite(buffer.duration)) return;
    ctx.resume().catch(() => {});
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = scaled;
    source.connect(gain);
    routeAudioNode(gain);
    const playbackDuration = Math.min(buffer.duration ?? 0, 4.5);
    if (playbackDuration > 0 && Number.isFinite(playbackDuration)) {
      source.start(0, 0, playbackDuration);
    }
  }, []);

  const playBallHit = useCallback((vol = 1) => {
    if (vol <= 0) return;
    const ctx = audioContextRef.current;
    const buffer = audioBuffersRef.current.ball;
    if (!ctx || !buffer || muteRef.current) return;
    const scaled = clamp(vol * volumeRef.current * 0.72, 0, 1);
    if (scaled <= 0) return;
    ctx.resume().catch(() => {});
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = scaled;
    source.connect(gain);
    routeAudioNode(gain);
    source.start(0);
  }, []);

  const playChalk = useCallback(() => {
    const ctx = audioContextRef.current;
    const buffer = audioBuffersRef.current.chalk;
    if (!ctx || !buffer || muteRef.current) return;
    const scaled = clamp(volumeRef.current, 0, 1);
    if (scaled <= 0) return;
    ctx.resume().catch(() => {});
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = scaled;
    source.connect(gain);
    routeAudioNode(gain);
    source.start(0);
  }, [routeAudioNode]);

  const playPocket = useCallback((vol = 1) => {
    if (vol <= 0) return;
    const ctx = audioContextRef.current;
    const buffer = audioBuffersRef.current.pocket;
    if (!ctx || !buffer || muteRef.current) return;
    const scaled = clamp(vol * volumeRef.current * 0.8, 0, 1);
    if (scaled <= 0) return;
    ctx.resume().catch(() => {});
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = scaled;
    source.connect(gain);
    routeAudioNode(gain);
    const duration = buffer.duration || 0;
    const offset = Math.max(0, duration - POCKET_SOUND_TAIL);
    const playbackDuration = duration > 0 ? Math.min(POCKET_SOUND_TAIL, duration) : undefined;
    if (playbackDuration != null) source.start(0, offset, playbackDuration);
    else source.start(0);
  }, []);

  const playTurnKnock = useCallback(() => {
    const ctx = audioContextRef.current;
    const buffer = audioBuffersRef.current.knock;
    if (!ctx || !buffer || muteRef.current) return;
    const scaled = clamp(volumeRef.current, 0, 1);
    if (scaled <= 0) return;
    ctx.resume().catch(() => {});
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = scaled;
    source.connect(gain);
    routeAudioNode(gain);
    source.start(0);
  }, []);

  const playCheer = useCallback(
    (vol = 1) => {
      const ctx = audioContextRef.current;
      const buffer = audioBuffersRef.current.cheer;
      if (!ctx || !buffer || muteRef.current) return;
      const scaled = clamp(vol * volumeRef.current * CROWD_VOLUME_SCALE, 0, 1);
      if (scaled <= 0) return;
      ctx.resume().catch(() => {});
      stopActiveCrowdSound();
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = scaled;
      source.connect(gain);
      routeAudioNode(gain);
      source.start(0);
      activeCrowdSoundRef.current = source;
      source.onended = () => {
        if (activeCrowdSoundRef.current === source) {
          activeCrowdSoundRef.current = null;
        }
      };
    },
    [stopActiveCrowdSound]
  );

  const playShock = useCallback(
    (vol = 1) => {
      const ctx = audioContextRef.current;
      const buffer = audioBuffersRef.current.shock;
      if (!ctx || !buffer || muteRef.current) return;
      const scaled = clamp(vol * volumeRef.current * CROWD_VOLUME_SCALE, 0, 1);
      if (scaled <= 0) return;
      ctx.resume().catch(() => {});
      stopActiveCrowdSound();
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = scaled;
      source.connect(gain);
      routeAudioNode(gain);
      source.start(0);
      activeCrowdSoundRef.current = source;
      source.onended = () => {
        if (activeCrowdSoundRef.current === source) {
          activeCrowdSoundRef.current = null;
        }
      };
    },
    [stopActiveCrowdSound]
  );
  useEffect(() => {
    document.title = 'Pool Royale 3D';
  }, []);
  useEffect(() => {
    const nextName = playerName || getTelegramUsername() || 'Player';
    const nextAvatar = playerAvatar || getTelegramPhotoUrl();
    setPlayer((prev) => {
      if (prev.name === nextName && prev.avatar === nextAvatar) return prev;
      return {
        name: nextName,
        avatar: nextAvatar
      };
    });
  }, [playerAvatar, playerName]);
  const resolvedPlayerAvatar = player.avatar || getTelegramPhotoUrl();
  const resolvedOpponentAvatar = isOnlineMatch ? opponentAvatar || '' : '';
  const framePlayersProfile = useMemo(
    () => ({
      A:
        localSeat === 'A'
          ? { name: player.name || 'Player', avatar: resolvedPlayerAvatar }
          : { name: opponentLabel, avatar: resolvedOpponentAvatar },
      B:
        localSeat === 'A'
          ? { name: opponentLabel, avatar: resolvedOpponentAvatar }
          : { name: player.name || 'Player', avatar: resolvedPlayerAvatar }
    }),
    [localSeat, opponentLabel, player.name, resolvedOpponentAvatar, resolvedPlayerAvatar]
  );
  useEffect(() => {
    setFrameState((prev) => {
      const nextPlayers = {
        A: { ...prev.players.A, name: framePlayersProfile.A.name, avatar: framePlayersProfile.A.avatar },
        B: { ...prev.players.B, name: framePlayersProfile.B.name, avatar: framePlayersProfile.B.avatar }
      };
      if (
        prev.players.A.name === nextPlayers.A.name &&
        prev.players.B.name === nextPlayers.B.name &&
        prev.players.A.avatar === nextPlayers.A.avatar &&
        prev.players.B.avatar === nextPlayers.B.avatar
      ) {
        return prev;
      }
      return {
        ...prev,
        players: nextPlayers
      };
    });
  }, [framePlayersProfile.A.avatar, framePlayersProfile.A.name, framePlayersProfile.B.avatar, framePlayersProfile.B.name]);
  useEffect(() => {
    muteRef.current = isGameMuted();
    volumeRef.current = getGameVolume();
    const handleMute = () => {
      muteRef.current = isGameMuted();
      if (muteRef.current) stopActiveCrowdSound();
    };
    const handleVolume = () => {
      volumeRef.current = getGameVolume();
    };
    window.addEventListener('gameMuteChanged', handleMute);
    window.addEventListener('gameVolumeChanged', handleVolume);
    return () => {
      window.removeEventListener('gameMuteChanged', handleMute);
      window.removeEventListener('gameVolumeChanged', handleVolume);
    };
  }, [stopActiveCrowdSound]);
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return undefined;
    const ctx = new AudioContextClass();
    audioContextRef.current = ctx;
    let cancelled = false;
    const decode = (arrayBuffer) =>
      new Promise((resolve, reject) => {
        ctx.decodeAudioData(arrayBuffer, resolve, reject);
      });
    const loadBuffer = async (path) => {
      const response = await fetch(encodeURI(path));
      if (!response.ok) throw new Error(`Failed to load ${path}`);
      const arr = await response.arrayBuffer();
      return await decode(arr);
    };
    (async () => {
      const entries = [
        [
          'cue',
          '/assets/sounds/cuehitsound.mp3'
        ],
        ['ball', '/assets/sounds/billiard-sound newhit.mp3'],
        ['pocket', '/assets/sounds/billiard-sound-6-288417.mp3'],
        ['knock', '/assets/sounds/wooden-door-knock-102902.mp3'],
        ['cheer', '/assets/sounds/crowd-cheering-383111.mp3'],
        ['shock', '/assets/sounds/crowd-shocked-reaction-352766.mp3'],
        ['chalk', '/assets/sounds/adding-chalk-to-a-snooker-cue-102468.mp3']
      ];
      const loaded = {};
      for (const [key, path] of entries) {
        try {
          const buffer = await loadBuffer(path);
          if (!cancelled) loaded[key] = buffer;
        } catch (err) {
          console.warn('Pool audio load failed:', key, err);
        }
      }
      if (!cancelled) {
        audioBuffersRef.current = { ...audioBuffersRef.current, ...loaded };
      }
    })();
    return () => {
      cancelled = true;
      stopActiveCrowdSound();
      audioBuffersRef.current = {
        cue: null,
        ball: null,
        pocket: null,
        knock: null,
        cheer: null,
        shock: null,
        chalk: null
      };
      audioContextRef.current = null;
      ctx.close().catch(() => {});
    };
  }, [stopActiveCrowdSound]);
  const formatBallOnLabel = useCallback(
    (rawList = []) => {
      const normalized = rawList
        .map((c) => (typeof c === 'string' ? c.toUpperCase() : String(c)))
        .filter(Boolean);
      if (!isUkAmericanSet) {
        return normalized.map((entry) => entry.toLowerCase());
      }
      return normalized.map((entry) => {
        if (entry === 'YELLOW' || entry === 'BLUE') return 'stripes';
        if (entry === 'RED') return 'solids';
        if (entry === 'BLACK') return '8';
        return entry.toLowerCase();
      });
    },
    [isUkAmericanSet]
  );
  useEffect(() => {
    const isSoloTraining = isTraining && trainingModeState === 'solo';
    setHud((prev) => {
      const hudMeta =
        frameState.meta && typeof frameState.meta === 'object'
          ? frameState.meta.hud
          : null;
      const metaInHand = deriveInHandFromFrame(frameState);
      const resolvedInHand = typeof metaInHand === 'boolean' ? metaInHand : prev.inHand;
      const nextTargets = formatBallOnLabel(frameState.ballOn);
      const nextLabel = hudMeta?.next
        ? hudMeta.next
        : nextTargets.length > 0
            ? nextTargets.join(' / ')
            : prev.next;
      const phaseLabel = hudMeta?.phase
        ? hudMeta.phase
        : frameState.phase === 'REDS_AND_COLORS'
          ? 'reds'
          : 'colors';
      const scoreA = hudMeta?.scores?.A ?? frameState.players.A.score;
      const scoreB = hudMeta?.scores?.B ?? frameState.players.B.score;
      const activeId = frameState.activePlayer === 'B' ? 'B' : 'A';
      const localId = localSeatRef.current === 'B' ? 'B' : 'A';
      const isPlayerTurn = activeId === localId;
      return {
        ...prev,
        A: scoreA,
        B: scoreB,
        turn: isSoloTraining ? 0 : isPlayerTurn ? 0 : 1,
        phase: phaseLabel,
        next: nextLabel,
        inHand: resolvedInHand,
        over: isTraining ? false : frameState.frameOver
      };
    });
  }, [formatBallOnLabel, frameState, isTraining, trainingModeState]);
  useEffect(() => {
    if (!frameState.frameOver) {
      gameOverHandledRef.current = false;
      return;
    }
    if (gameOverHandledRef.current) return;
    gameOverHandledRef.current = true;
    if (isTraining) {
      setHud((prev) => ({ ...prev, over: false }));
      return undefined;
    }
    setHud((prev) => ({ ...prev, over: true }));
    const currentFrame = frameRef.current || frameState;
    const winnerSeat = (currentFrame?.winner ?? frameState.winner) === 'B' ? 'B' : 'A';
    const finalScores = {
      A: currentFrame?.players?.A?.score ?? 0,
      B: currentFrame?.players?.B?.score ?? 0
    };
    let cancelled = false;
    const runMatchWrapUp = async () => {
      await waitForActiveReplay();
      const tournamentOutcome = await handleTournamentResult({
        winnerSeat,
        scores: finalScores
      });
      if (cancelled) return;
      const userSeat = localSeat === 'B' ? 'B' : 'A';
      const userWon = winnerSeat === userSeat;
      const prizeAmount =
        stakeAmount > 0
          ? Math.max(
              0,
              Math.round(stakeAmount * (tournamentMode ? tournamentPlayers || 2 : 2))
            )
          : 0;
      const overlayData = {
        name: userWon ? player.name || 'You' : opponentDisplayName || 'Opponent',
        avatar: userWon ? resolvedPlayerAvatar : opponentDisplayAvatar || '/assets/icons/profile.svg',
        prizeText: prizeAmount > 0 ? `+${prizeAmount} ${stakeToken}` : '',
        rewards: tournamentOutcome?.unlocks || [],
        userWon
      };
      setWinnerOverlay(overlayData);
      const burstCount = overlayData.prizeText || (overlayData.rewards && overlayData.rewards.length > 0)
        ? 28
        : 18;
      triggerCoinBurst(burstCount);
      await wait(2200);
      if (!cancelled) {
        goToLobby();
      }
    };
    runMatchWrapUp();
    return () => {
      cancelled = true;
    };
  }, [
    frameState.frameOver,
    frameState.winner,
    goToLobby,
    handleTournamentResult,
    isTraining,
    localSeat,
    opponentDisplayAvatar,
    opponentDisplayName,
    player.name,
    resolvedPlayerAvatar,
    stakeAmount,
    stakeToken,
    tournamentMode,
    tournamentPlayers,
    triggerCoinBurst,
    waitForActiveReplay
  ]);

  const applyRemoteState = useCallback(({ state, hud: incomingHud, layout }) => {
    if (state) {
      frameRef.current = state;
      setFrameState(state);
      setTurnCycle((value) => value + 1);
    }
    if (incomingHud) {
      setHud((prev) => ({ ...prev, ...incomingHud }));
    }
    if (Array.isArray(layout)) {
      const applySnapshot = applyBallSnapshotRef.current;
      if (applySnapshot) {
        applySnapshot(layout);
      } else {
        pendingLayoutRef.current = layout;
      }
    }
  }, []);

  const handleRemotePayload = useCallback(
    (payload = {}) => {
      if (!isOnlineMatch || !tableId) return;
      const senderId =
        payload.playerId ||
        payload.accountId ||
        payload.player ||
        null;
      const localId = accountIdRef.current || accountId || '';
      const isRemotePlayer = Boolean(senderId && senderId !== localId);
      const hasLayout = Array.isArray(payload.layout);
      const aimPayload = payload.aim;
      const now = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();

      if (
        isRemotePlayer &&
        aimPayload &&
        Number.isFinite(aimPayload?.dir?.x) &&
        Number.isFinite(aimPayload?.dir?.y)
      ) {
        const spinX = THREE.MathUtils.clamp(aimPayload?.spin?.x ?? 0, -1, 1);
        const spinY = THREE.MathUtils.clamp(aimPayload?.spin?.y ?? 0, -1, 1);
        remoteAimRef.current = {
          dir: { x: aimPayload.dir.x, y: aimPayload.dir.y },
          power: THREE.MathUtils.clamp(aimPayload.power ?? 0, 0, 1),
          spin: { x: spinX, y: spinY },
          cueBall: aimPayload.cueBall ?? null,
          updatedAt: now,
          playerId: senderId
        };
      }

      if (isRemotePlayer && hasLayout) {
        remoteShotActiveRef.current = true;
        remoteShotUntilRef.current = now + 1200;
        remoteAimRef.current = null;
        const baseTime = Number.isFinite(payload.frameTs) ? payload.frameTs : now;
        if (!incomingRemoteShotRef.current || incomingRemoteShotRef.current.playerId !== senderId) {
          const startState = captureBallSnapshotRef.current
            ? captureBallSnapshotRef.current()
            : null;
          incomingRemoteShotRef.current = {
            playerId: senderId,
            startState,
            startTime: baseTime,
            frames: [],
            cuePath: [],
            postState: null
          };
        }
        const rec = incomingRemoteShotRef.current;
        if (rec) {
          const frameTime = Number.isFinite(payload.frameTs) ? payload.frameTs : now;
          const rel = Math.max(0, frameTime - (rec.startTime ?? frameTime));
          rec.frames.push({
            t: rel,
            balls: payload.layout,
            camera: captureReplayCameraSnapshotRef.current
              ? captureReplayCameraSnapshotRef.current()
              : null
          });
          const cueEntry = payload.layout.find((entry) => String(entry.id) === 'cue');
          const cuePos = cueEntry?.mesh?.position || cueEntry?.pos;
          if (cuePos && Number.isFinite(cuePos.x) && Number.isFinite(cuePos.y)) {
            const trailPos = new THREE.Vector3(
              cuePos.x,
              REPLAY_TRAIL_HEIGHT,
              Number.isFinite(cuePos.z) ? cuePos.z : cuePos.y
            );
            const last = rec.cuePath[rec.cuePath.length - 1];
            if (!last || !last.pos || last.pos.distanceTo(trailPos) > 1e-3) {
              rec.cuePath.push({ t: rel, pos: trailPos });
            }
          }
          rec.startState = rec.startState || captureBallSnapshotRef.current?.() || null;
        }
      }

      const recording = incomingRemoteShotRef.current;
      const hasState = Boolean(payload.state);
      if (recording && (hasState || (payload.final && !hasLayout))) {
        recording.postState =
          payload.layout ??
          (captureBallSnapshotRef.current ? captureBallSnapshotRef.current() : recording.frames?.[recording.frames.length - 1]?.balls ?? null);
        recording.startState =
          recording.startState || recording.frames?.[0]?.balls || null;
        pendingRemoteReplayRef.current = { ...recording };
        incomingRemoteShotRef.current = null;
        remoteShotActiveRef.current = false;
        remoteShotUntilRef.current = 0;
      }
    },
    [accountId, isOnlineMatch, tableId]
  );

  useEffect(() => {
    if (!isOnlineMatch || !tableId) return undefined;
    const handlePoolState = (payload = {}) => {
      if (payload.tableId && payload.tableId !== tableId) return;
      handleRemotePayload(payload);
      applyRemoteState({ state: payload.state, hud: payload.hud, layout: payload.layout });
    };
    const handlePoolFrame = (payload = {}) => {
      if (payload.tableId && payload.tableId !== tableId) return;
      handleRemotePayload(payload);
      applyRemoteState({ state: payload.state, hud: payload.hud, layout: payload.layout });
    };

    socket.emit('register', { playerId: accountId });
    socket.emit('joinPoolTable', { tableId, accountId });
    socket.emit('poolSyncRequest', { tableId });
    socket.on('poolState', handlePoolState);
    socket.on('poolFrame', handlePoolFrame);

    return () => {
      socket.off('poolState', handlePoolState);
      socket.off('poolFrame', handlePoolFrame);
    };
  }, [accountId, applyRemoteState, handleRemotePayload, isOnlineMatch, tableId]);

  useEffect(() => {
    if (!isOnlineMatch || !tableId) return;
    const state = frameRef.current;
    if (!state) return;
    const layout = captureBallSnapshotRef.current
      ? captureBallSnapshotRef.current()
      : null;
    socket.emit('poolShot', { tableId, state, hud: hudRef.current, layout });
  }, [isOnlineMatch, tableId]);

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
  const resolveFlagLabel = useCallback((flagEmoji) => {
    if (!flagEmoji) return 'Flag';
    try {
      const codePoints = [...flagEmoji].map((c) => c.codePointAt(0));
      if (codePoints.length === 2) {
        const [a, b] = codePoints;
        const base = 0x1f1e6;
        const region = String.fromCharCode(a - base + 65, b - base + 65);
        if (typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function') {
          const display = new Intl.DisplayNames(['en'], { type: 'region' });
          return display.of(region) || region;
        }
        return region;
      }
    } catch (err) {
      console.warn('flag label resolve failed', err);
    }
    return flagEmoji;
  }, []);
  const playerFlag = useMemo(
    () => FLAG_EMOJIS[Math.floor(Math.random() * FLAG_EMOJIS.length)],
    []
  );
  const playerFlagLabel = useMemo(
    () => resolveFlagLabel(playerFlag),
    [playerFlag, resolveFlagLabel]
  );
  const aiFlag = useMemo(() => {
    const pickRandom = () => FLAG_EMOJIS[Math.floor(Math.random() * FLAG_EMOJIS.length)];
    if (tournamentMode && typeof window !== 'undefined') {
      try {
        const stored = window.localStorage.getItem(tournamentAiFlagStorageKey);
        if (stored && FLAG_EMOJIS.includes(stored)) {
          return stored;
        }
      } catch (err) {
        console.warn('Pool Royale tournament AI flag restore failed', err);
      }
    }
    const selected = pickRandom();
    if (tournamentMode && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(tournamentAiFlagStorageKey, selected);
      } catch (err) {
        console.warn('Pool Royale tournament AI flag save failed', err);
      }
    }
    return selected;
  }, [tournamentAiFlagStorageKey, tournamentMode]);
  const aiFlagLabel = useMemo(() => resolveFlagLabel(aiFlag), [aiFlag, resolveFlagLabel]);
  const aiShoot = useRef(() => {});

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
    const opponentHudName = aiOpponentEnabled ? aiFlagLabel : opponentDisplayName;
    const opponentHudAvatar = aiOpponentEnabled ? null : opponentDisplayAvatar;
    drawHudPanel(A.ctx, logo, playerImg, player.name, hud.A, timer);
    A.tex.needsUpdate = true;
    drawHudPanel(
      B.ctx,
      logo,
      opponentHudAvatar,
      opponentHudName,
      hud.B,
      timer,
      aiOpponentEnabled ? aiFlag : null
    );
    B.tex.needsUpdate = true;
    drawHudPanel(C.ctx, logo, playerImg, player.name, hud.A, timer);
    C.tex.needsUpdate = true;
    drawHudPanel(
      D.ctx,
      logo,
      opponentHudAvatar,
      opponentHudName,
      hud.B,
      timer,
      aiOpponentEnabled ? aiFlag : null
    );
    D.tex.needsUpdate = true;
  }, [
    aiFlag,
    aiFlagLabel,
    aiOpponentEnabled,
    hud.A,
    hud.B,
    opponentDisplayAvatar,
    opponentDisplayName,
    player.name,
    timer
  ]);

  useEffect(() => {
    updateHudPanels();
  }, [updateHudPanels]);

  useEffect(() => {
    const isSoloTraining = isTraining && trainingModeState === 'solo';
    if (hud.over || isSoloTraining) return undefined;
    if (!aiOpponentEnabled && hud.turn === 1) {
      // In online matches, the remote player drives turn changes; skip AI countdowns.
      return undefined;
    }
    const playerTurn = hud.turn;
    const duration = playerTurn === 0 ? 60 : 3;
    setTimer(duration);
    timerWarnedRef.current = false;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        const next = t <= 1 ? 0 : t - 1;
        if (
          !timerWarnedRef.current &&
          playerTurn === 0 &&
          next > 0 &&
          next <= 5
        ) {
          playTurnKnock();
          timerWarnedRef.current = true;
        }
        if (next === 0) {
          clearInterval(timerRef.current);
          if (playerTurn === 0) {
            setHud((s) => ({ ...s, turn: 1 - s.turn }));
          } else if (aiOpponentEnabled) {
            aiShoot.current();
          }
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [aiOpponentEnabled, hud.turn, hud.over, playTurnKnock, isTraining, trainingModeState, turnCycle]);

  useEffect(() => {
    if (hud.over) {
      stopAiThinkingRef.current?.();
      setAiPlanning(null);
      aiPlanRef.current = null;
      return;
    }
    if (hud.turn === 1 && aiOpponentEnabled) {
      userSuggestionRef.current = null;
      userSuggestionPlanRef.current = null;
      suggestionAimKeyRef.current = null;
      autoAimRequestRef.current = false;
      stopAiThinkingRef.current?.();
      startAiThinkingRef.current?.();
    } else {
      stopAiThinkingRef.current?.();
      setAiPlanning(null);
      aiPlanRef.current = null;
      suggestionAimKeyRef.current = null;
      autoAimRequestRef.current = true;
      startUserSuggestionRef.current?.();
    }
  }, [aiOpponentEnabled, hud.turn, hud.over]);

  useEffect(() => {
    if (hud.over) return;
    if (hud.turn === 0) {
      suggestionAimKeyRef.current = null;
      autoAimRequestRef.current = true;
      startUserSuggestionRef.current?.();
    }
  }, [frameState, hud.turn, hud.over]);

  useEffect(() => {
    if (hud.over) return;
    if (hud.turn === 1 && aiOpponentEnabled) {
      startAiThinkingRef.current?.();
    }
  }, [aiOpponentEnabled, frameState, hud.turn, hud.over]);

  useEffect(() => {
    const sph = sphRef.current;
    if (!sph || !cameraRef.current) return;
    const restore = inHandCameraRestoreRef.current;
    if (hud.inHand) {
      if (!restore) {
        inHandCameraRestoreRef.current = {
          radius: sph.radius,
          phi: sph.phi,
          theta: sph.theta,
          blend: cameraBlendRef.current ?? 0
        };
      }
      const radiusLimit = orbitRadiusLimitRef.current ?? CAMERA.maxR;
      const expandedRadius = Math.max(radiusLimit, CAMERA.maxR * 0.92);
      sph.radius = THREE.MathUtils.clamp(expandedRadius, CAMERA.minR, CAMERA.maxR);
      sph.phi = Math.max(sph.phi, STANDING_VIEW.phi);
      cameraBlendRef.current = 1;
      cameraUpdateRef.current?.();
    } else if (restore) {
      sph.radius = restore.radius;
      sph.phi = restore.phi;
      sph.theta = restore.theta;
      cameraBlendRef.current = restore.blend ?? cameraBlendRef.current;
      inHandCameraRestoreRef.current = null;
      cameraUpdateRef.current?.();
    }
  }, [hud.inHand]);

  useEffect(() => {
    const host = mountRef.current;
    if (!host) return;
    setErr(null);
    if (!isWebGLAvailable()) {
      setErr('WebGL is not available on this device. Enable hardware acceleration to play.');
      return;
    }
    const cueRackDisposers = [];
    let disposed = false;
    let contextLost = false;
    const triggerRendererReset = () => {
      if (disposed || contextLost) return;
      contextLost = true;
      setErr('Graphics renderer reset; restoring the table…');
      setRenderResetKey((value) => value + 1);
    };
    try {
      const updatePocketCameraState = (active) => {
        if (pocketCameraStateRef.current === active) return;
        pocketCameraStateRef.current = active;
        setPocketCameraActive(active);
      };
      updatePocketCameraState(false);
      screen.orientation?.lock?.('portrait').catch(() => {});
      // Renderer
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance'
      });
      renderer.useLegacyLights = false;
      applyRendererSRGB(renderer);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;
      renderer.sortObjects = true;
      renderer.shadowMap.enabled = false;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      rendererRef.current = renderer;
      updateRendererAnisotropyCap(renderer);
      applyRendererQuality();
      host.appendChild(renderer.domElement);
      const handleContextLost = (e) => {
        e.preventDefault();
        triggerRendererReset();
      };
      const handleContextRestored = () => {
        triggerRendererReset();
      };
      renderer.domElement.addEventListener('webglcontextlost', handleContextLost, false);
      renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored, false);
      renderer.domElement.style.transformOrigin = 'top left';

      // Scene & Camera
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x050505);
      sceneRef.current = scene;
      const world = new THREE.Group();
      scene.add(world);
      worldRef.current = world;
      const applyHdriEnvironment = async (variantConfig = activeEnvironmentVariantRef.current) => {
        const sceneInstance = sceneRef.current;
        if (!renderer || !sceneInstance) return;
        const activeVariant = variantConfig || activeEnvironmentVariantRef.current;
        const envResult = await loadPolyHavenHdriEnvironment(renderer, activeVariant);
        if (!envResult) return;
        const { envMap, skyboxMap } = envResult;
        if (!envMap) return;
        if (disposed) {
          envMap.dispose?.();
          skyboxMap?.dispose?.();
          return;
        }
        const prevDispose = disposeEnvironmentRef.current;
        const prevTexture = envTextureRef.current;
        const worldOffsetY = worldRef.current?.position?.y ?? 0;
        const tableScale = tableSizeRef.current?.scale ?? 1;
        const resolvedWorldScale = Number.isFinite(worldScaleFactor) && worldScaleFactor > 0
          ? worldScaleFactor
          : WORLD_SCALE * tableScale;
        const floorWorldY = FLOOR_Y * resolvedWorldScale + worldOffsetY;
        const unitsPerMeter = MM_TO_UNITS * 1000 * resolvedWorldScale;
        const cameraHeightMeters = Math.max(
          activeVariant?.cameraHeightM ?? DEFAULT_HDRI_CAMERA_HEIGHT_M,
          MIN_HDRI_CAMERA_HEIGHT_M
        );
        const skyboxHeight = cameraHeightMeters * unitsPerMeter;
        const groundRadiusMultiplier =
          typeof activeVariant?.groundRadiusMultiplier === 'number'
            ? activeVariant.groundRadiusMultiplier
            : DEFAULT_HDRI_RADIUS_MULTIPLIER;
        const baseRadius =
          Math.max(PLAY_W, PLAY_H) * resolvedWorldScale * groundRadiusMultiplier;
        const skyboxRadius = Math.max(baseRadius, skyboxHeight * 2.5, MIN_HDRI_RADIUS);
        const skyboxResolution = Math.max(
          16,
          Math.floor(activeVariant?.groundResolution ?? HDRI_GROUNDED_RESOLUTION)
        );
        const hdriRotationY = Number.isFinite(activeVariant?.rotationY)
          ? activeVariant.rotationY
          : 0;
        if ('backgroundRotation' in sceneInstance) {
          sceneInstance.backgroundRotation = new THREE.Euler(0, hdriRotationY, 0);
        }
        if ('environmentRotation' in sceneInstance) {
          sceneInstance.environmentRotation = new THREE.Euler(0, hdriRotationY, 0);
        }
        let skybox = null;
        if (skyboxMap && skyboxHeight > 0 && skyboxRadius > 0) {
          try {
            skybox = new GroundedSkybox(skyboxMap, skyboxHeight, skyboxRadius, skyboxResolution);
            skybox.position.y = floorWorldY + skyboxHeight;
            skybox.rotation.y = hdriRotationY;
            skybox.material.depthWrite = false;
            sceneInstance.background = null;
            sceneInstance.add(skybox);
            envSkyboxRef.current = skybox;
            envSkyboxTextureRef.current = skyboxMap;
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
          if (
            'backgroundIntensity' in sceneInstance &&
            typeof activeVariant?.backgroundIntensity === 'number'
          ) {
            sceneInstance.backgroundIntensity = activeVariant.backgroundIntensity;
          }
        }
        if (
          'environmentIntensity' in sceneInstance &&
          typeof activeVariant?.environmentIntensity === 'number'
        ) {
          sceneInstance.environmentIntensity = activeVariant.environmentIntensity;
        }
        renderer.toneMappingExposure = activeVariant?.exposure ?? renderer.toneMappingExposure;
        envTextureRef.current = envMap;
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
        if (prevDispose && prevTexture !== envMap) {
          prevDispose();
        }
      };
      updateEnvironmentRef.current = applyHdriEnvironment;
      void applyHdriEnvironment(activeEnvironmentVariantRef.current);
      let worldScaleFactor = WORLD_SCALE * (tableSizeRef.current?.scale ?? 1);
      let cue;
      let clothMat;
      let cushionMat;
      const tableSurfaceY = TABLE_Y - TABLE.THICK + 0.01;
      const baseSurfaceWorldY = tableSurfaceY * WORLD_SCALE;
      const getNow = () =>
        typeof performance !== 'undefined' && typeof performance.now === 'function'
          ? performance.now()
          : Date.now();
      let shooting = false; // track when a shot is in progress
      let shotStartedAt = 0;
      let shotRecording = null;
      let replayPlayback = null;
      let pausedPocketDrops = null;
      const tmpReplayQuat = new THREE.Quaternion();
      const tmpReplayQuatB = new THREE.Quaternion();
      const tmpReplayScale = new THREE.Vector3();
      const tmpReplayPos = new THREE.Vector3();
      const tmpReplayCueA = new THREE.Vector3();
      const tmpReplayCueB = new THREE.Vector3();
      const setShootingState = (value) => {
        if (shooting === value) return;
        shooting = value;
        shotStartedAt = shooting ? getNow() : 0;
        if (!shooting) {
          maxPowerLiftTriggered = false;
        }
        if (shotCameraHoldTimeoutRef.current) {
          clearTimeout(shotCameraHoldTimeoutRef.current);
          shotCameraHoldTimeoutRef.current = null;
        }
        if (shooting) {
          preShotTopViewRef.current = topViewRef.current;
          preShotTopViewLockRef.current = topViewLockedRef.current;
          shotCameraHoldTimeoutRef.current = window.setTimeout(() => {
            shotCameraHoldTimeoutRef.current = null;
            if (!shooting) return;
            topViewRef.current = true;
            topViewLockedRef.current = true;
            enterTopView(true);
          }, SHOT_CAMERA_HOLD_MS);
        } else if (!preShotTopViewRef.current) {
          exitTopView(true);
        } else {
          topViewLockedRef.current = preShotTopViewLockRef.current;
        }
        setShotActive(value);
      };
      const serializeVector3Snapshot = (vec, fallback = { x: 0, y: 0, z: 0 }) => ({
        x: Number.isFinite(vec?.x) ? vec.x : fallback.x ?? 0,
        y: Number.isFinite(vec?.y) ? vec.y : fallback.y ?? 0,
        z: Number.isFinite(vec?.z) ? vec.z : fallback.z ?? 0
      });
      const serializeQuaternionSnapshot = (quat) => ({
        x: Number.isFinite(quat?.x) ? quat.x : 0,
        y: Number.isFinite(quat?.y) ? quat.y : 0,
        z: Number.isFinite(quat?.z) ? quat.z : 0,
        w: Number.isFinite(quat?.w) ? quat.w : 1
      });
      const normalizeVector3Snapshot = (value, fallback = null) => {
        if (Array.isArray(value) && value.length >= 3) {
          const [x, y, z] = value;
          if ([x, y, z].every(Number.isFinite)) return { x, y, z };
        } else if (value && typeof value === 'object') {
          const { x, y, z } = value;
          if ([x, y, z].every(Number.isFinite)) return { x, y, z };
        }
        return fallback;
      };
      const normalizeQuaternionSnapshot = (value, fallback = null) => {
        if (Array.isArray(value) && value.length >= 4) {
          const [x, y, z, w] = value;
          if ([x, y, z, w].every(Number.isFinite)) return { x, y, z, w };
        } else if (value && typeof value === 'object') {
          const { x, y, z, w } = value;
          if ([x, y, z, w].every(Number.isFinite)) return { x, y, z, w };
        }
        return fallback;
      };
      let activeShotView = null;
      let suspendedActionView = null;
      let queuedPocketView = null;
      let shotPrediction = null;
      let lastShotPower = 0;
      let prevCollisions = new Set();
      let cueAnimating = false; // forward stroke animation state
      let maxPowerLiftTriggered = false;
      const DYNAMIC_TEXTURE_MIN_INTERVAL = 1 / 45;
      const dynamicTextureEntries = [];
      const registerDynamicTexture = (entry) => {
        if (!entry || !entry.texture || typeof entry.update !== 'function') {
          return null;
        }
        const minInterval =
          typeof entry.minInterval === 'number' && Number.isFinite(entry.minInterval)
            ? Math.max(0, entry.minInterval)
            : DYNAMIC_TEXTURE_MIN_INTERVAL;
        dynamicTextureEntries.push({
          texture: entry.texture,
          update: entry.update,
          accumulator: 0,
          minInterval
        });
        return entry.texture;
      };
      const coinTicker = (() => {
        const coins = [
          'BTC',
          'ETH',
          'BNB',
          'SOL',
          'XRP',
          'ADA',
          'DOGE',
          'AVAX',
          'DOT',
          'TRX'
        ];
        const prices = coins.map(() => 1000 + Math.random() * 45000);
        let accumulator = 0;
        return {
          update(delta) {
            accumulator += delta;
            const step = 0.25;
            while (accumulator >= step) {
              accumulator -= step;
              for (let i = 0; i < prices.length; i++) {
                const drift = (Math.random() - 0.5) * 120;
                prices[i] = Math.max(0, prices[i] + drift);
              }
            }
          },
          list() {
            return coins.map((symbol, index) => ({
              symbol,
              price: prices[index] ?? 0
            }));
          },
          text() {
            return this.list()
              .map(({ symbol, price }) => `${symbol}: $${price.toFixed(0)}`)
              .join('   ');
          }
        };
      })();
      const createTickerEntry = ({
        color = '#34d399',
        background = '#020617',
        fontSize = 88,
        speed = 220
      } = {}) => {
        const canvas = document.createElement('canvas');
        canvas.width = 2048;
        canvas.height = 320;
        const ctx = canvas.getContext('2d');
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.anisotropy = 4;
        applySRGBColorSpace(texture);
        let offset = 0;
        return {
          texture,
          minInterval: 1 / 45,
          update(delta) {
            if (!ctx) return;
            const text = coinTicker.text();
            const tileText = `${text}     `;
            ctx.fillStyle = background;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = color;
            ctx.font = `bold ${fontSize}px "Segoe UI", "Helvetica Neue", sans-serif`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            const tileWidth = Math.max(1, ctx.measureText(tileText).width);
            offset = (offset + speed * delta) % tileWidth;
            let x = -offset;
            const centerY = canvas.height / 2;
            while (x < canvas.width + tileWidth) {
              ctx.fillText(tileText, x, centerY);
              x += tileWidth;
            }
            texture.needsUpdate = true;
          }
        };
      };
      const createMatchTvEntry = () => {
        const baseWidth = 1024;
        const baseHeight = 512;
        const resolutionScale = 0.95;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(baseWidth * resolutionScale);
        canvas.height = Math.round(baseHeight * resolutionScale);
        const ctx = canvas.getContext('2d');
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.anisotropy = 8;
        applySRGBColorSpace(texture);
        let pulse = 0;
        const createAvatarStore = () => ({
          image: null,
          src: '',
          ready: false,
          failed: false,
          loading: false
        });
        const playerAvatarStore = createAvatarStore();
        const challengerAvatarStore = createAvatarStore();
        const updateAvatarStore = (store, src) => {
          const nextSrc = typeof src === 'string' ? src.trim() : '';
          if (!nextSrc) {
            store.image = null;
            store.src = '';
            store.ready = false;
            store.failed = false;
            store.loading = false;
            return;
          }
          if (store.src === nextSrc) {
            if (store.ready || store.loading || store.failed) {
              return;
            }
          }
          const image = new Image();
          store.image = image;
          store.src = nextSrc;
          store.ready = false;
          store.failed = false;
          store.loading = true;
          try {
            image.crossOrigin = 'anonymous';
          } catch {}
          image.onload = () => {
            if (store.image === image) {
              store.ready = true;
              store.failed = false;
              store.loading = false;
            }
          };
          image.onerror = () => {
            if (store.image === image) {
              store.ready = false;
              store.failed = true;
              store.loading = false;
            }
          };
          image.src = nextSrc;
        };
        return {
          texture,
          minInterval: 1 / 30,
          update(delta) {
            if (!ctx) return;
            const width = baseWidth;
            const height = baseHeight;
            ctx.setTransform(resolutionScale, 0, 0, resolutionScale, 0, 0);
            ctx.clearRect(0, 0, width, height);
            pulse += delta;
            const hudState = hudRef.current ?? {};
            const playerState = playerInfoRef.current ?? {};
            const frameStateCurrent = frameRef.current ?? {};
            const playerName =
              playerState.name || frameStateCurrent.players?.A?.name || 'Player';
            const aiName = frameStateCurrent.players?.B?.name || 'AI';
            const playerAvatarSrc =
              playerState.avatar || frameStateCurrent.players?.A?.avatar || '';
            const challengerAvatarSrc =
              frameStateCurrent.players?.B?.avatar || '';
            const timerValue = Math.max(
              0,
              Math.floor(timerValueRef.current ?? 0)
            );
            const minutes = Math.floor(timerValue / 60);
            const seconds = timerValue % 60;
            const timerText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            const highestBreakA =
              frameStateCurrent.players?.A?.highestBreak ?? 0;
            const highestBreakB =
              frameStateCurrent.players?.B?.highestBreak ?? 0;
            const currentBreak = frameStateCurrent.currentBreak ?? 0;
            ctx.fillStyle = '#050b18';
            ctx.fillRect(0, 0, width, height);
            const headerGrad = ctx.createLinearGradient(0, 0, width, 0);
            headerGrad.addColorStop(0, '#0f172a');
            headerGrad.addColorStop(1, '#1e293b');
            ctx.fillStyle = headerGrad;
            ctx.fillRect(0, 0, width, 120);
            ctx.fillStyle = '#f1f5f9';
            ctx.font = 'bold 42px "Segoe UI", "Helvetica Neue", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Pool Royale Match of the Day', width / 2, 60);
            const drawCompetitor = ({
              x,
              name,
              score,
              accent,
              tag,
              active,
              badge,
              stats = [],
              avatarSrc,
              avatarStore
            }) => {
              if (avatarStore) {
                updateAvatarStore(avatarStore, avatarSrc);
              }
              const scoreY = height * 0.3;
              ctx.font = 'bold 120px "Segoe UI", "Helvetica Neue", sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.shadowColor = active
                ? 'rgba(56,189,248,0.45)'
                : 'transparent';
              ctx.shadowBlur = active ? 24 : 0;
              ctx.fillStyle = active ? '#f8fafc' : '#e2e8f0';
              ctx.fillText(String(score ?? 0), x, scoreY);
              ctx.shadowBlur = 0;
              const avatarY = height * 0.55;
              const avatarRadius = 90;
              ctx.save();
              ctx.translate(x, avatarY);
              ctx.fillStyle = accent;
              ctx.globalAlpha = active ? 1 : 0.9;
              ctx.beginPath();
              ctx.arc(0, 0, avatarRadius, 0, Math.PI * 2);
              ctx.fill();
              ctx.globalAlpha = 1;
              const ringThickness = Math.max(10, avatarRadius * 0.18);
              const innerRadius = avatarRadius - ringThickness;
              if (avatarStore?.ready && avatarStore.image) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(0, 0, innerRadius, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(
                  avatarStore.image,
                  -innerRadius,
                  -innerRadius,
                  innerRadius * 2,
                  innerRadius * 2
                );
                ctx.restore();
              } else {
                ctx.fillStyle = '#0b1120';
                ctx.font = 'bold 52px "Segoe UI", "Helvetica Neue", sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(badge, 0, 0);
              }
              ctx.lineWidth = Math.max(4, ringThickness * 0.6);
              ctx.strokeStyle = 'rgba(15,23,42,0.55)';
              ctx.beginPath();
              ctx.arc(0, 0, innerRadius, 0, Math.PI * 2);
              ctx.stroke();
              ctx.restore();
              ctx.fillStyle = active ? '#f1f5f9' : '#cbd5f5';
              ctx.font = 'bold 56px "Segoe UI", "Helvetica Neue", sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'top';
              ctx.fillText(name, x, avatarY + avatarRadius + 12);
              ctx.fillStyle = '#94a3b8';
              ctx.font = '500 32px "Segoe UI", "Helvetica Neue", sans-serif';
              const tagY = avatarY + avatarRadius + 52;
              ctx.fillText(tag, x, tagY);
              const statsStartY = tagY + 36;
              stats.forEach(({ label, value }, index) => {
                const lineY = statsStartY + index * 30;
                ctx.fillStyle = '#7c8faa';
                ctx.font = '500 28px "Segoe UI", "Helvetica Neue", sans-serif';
                ctx.fillText(`${label}: ${value}`, x, lineY);
              });
            };
            const activeTurn = hudState.turn === 0 ? 'A' : 'B';
            const buildStats = (id, isActive) => {
              const highestBreak =
                id === 'A' ? highestBreakA : highestBreakB;
              const status = isActive
                ? `AT TABLE · BREAK ${Math.max(currentBreak, 0)}`
                : 'WAITING TURN';
              return [
                { label: 'HIGHEST BREAK', value: highestBreak },
                { label: 'STATUS', value: status }
              ];
            };
            drawCompetitor({
              x: width * 0.25,
              name: playerName,
              score: hudState.A ?? 0,
              accent: '#0ea5e9',
              tag: 'PLAYER ONE',
              active: activeTurn === 'A',
              badge:
                (playerName || 'P').trim().charAt(0).toUpperCase() || 'P',
              stats: buildStats('A', activeTurn === 'A'),
              avatarSrc: playerAvatarSrc,
              avatarStore: playerAvatarStore
            });
            drawCompetitor({
              x: width * 0.75,
              name: aiName,
              score: hudState.B ?? 0,
              accent: '#f97316',
              tag: 'CHALLENGER',
              active: activeTurn === 'B',
              badge: aiFlag || (aiName || 'A').charAt(0).toUpperCase(),
              stats: buildStats('B', activeTurn === 'B'),
              avatarSrc: challengerAvatarSrc,
              avatarStore: challengerAvatarStore
            });
            const timerY = height * 0.18;
            const warn = timerValue <= 5 && timerValue > 0;
            const timerColor = warn
              ? pulse % 0.4 < 0.2
                ? '#f87171'
                : '#facc15'
              : '#38bdf8';
            ctx.fillStyle = timerColor;
            ctx.font = 'bold 110px "Segoe UI", "Helvetica Neue", sans-serif';
            ctx.fillText(timerText, width / 2, timerY);
            ctx.fillStyle = '#cbd5f5';
            ctx.font = '600 32px "Segoe UI", "Helvetica Neue", sans-serif';
            ctx.fillText('SHOT CLOCK', width / 2, timerY + 70);
            texture.needsUpdate = true;
          }
        };
      };
      const legHeight = LEG_ROOM_HEIGHT;
      const floorY = FLOOR_Y;
      const arenaScale = Math.max(
        1,
        Number.isFinite(activeEnvironmentVariantRef.current?.arenaScale)
          ? activeEnvironmentVariantRef.current.arenaScale
          : 1
      );
      const roomDepth = TABLE.H * 3.05 * arenaScale;
      const sideClearance = roomDepth / 2 - TABLE.H / 2;
      const roomWidth = TABLE.W + sideClearance * 2;
      const arenaMargin = Math.max(TABLE.THICK * 2.2, BALL_R * 6);
      const arenaHalfDepth = Math.max(roomDepth / 2 - arenaMargin, PLAY_H / 2 + BALL_R * 6);
      const arenaHalfWidth = Math.max(roomWidth / 2 - arenaMargin, PLAY_W / 2 + BALL_R * 6);
      const frontInterior = -arenaHalfDepth;
      const backInterior = arenaHalfDepth;
      const leftInterior = -arenaHalfWidth;
      const rightInterior = arenaHalfWidth;

      cueRackGroupsRef.current = [];
      cueOptionGroupsRef.current = [];
      cueRackMetaRef.current = new Map();

      if (ENABLE_CUE_GALLERY) {
        const registerCueRack = (rack, dispose, dims) => {
          if (!rack) return;
          const rackId = `rack-${cueRackGroupsRef.current.length}`;
          rack.userData = rack.userData || {};
          rack.userData.rackId = rackId;
          cueRackGroupsRef.current.push(rack);
          cueRackMetaRef.current.set(rackId, {
            id: rackId,
            group: rack,
            dimensions: dims,
            dispose
          });
          rack.traverse((child) => {
            if (!child) return;
            child.userData = child.userData || {};
            child.userData.cueRackId = rackId;
            if (child.userData.isCueOption) {
              cueOptionGroupsRef.current.push(child);
            }
          });
        };

        const createRackEntry = () =>
          createCueRackDisplay({
            THREE,
            ballRadius: BALL_R,
            cueLengthMultiplier: CUE_LENGTH_MULTIPLIER,
            cueTipRadius: CUE_TIP_RADIUS
          });

        const baseRackEntry = createRackEntry();
        const cueRackDimensions = baseRackEntry.dimensions;
        const cueRackHalfWidth = cueRackDimensions.width / 2;
        const availableHalfDepth = arenaHalfDepth - cueRackHalfWidth - BALL_R * 2;
        const desiredOffset = cueRackHalfWidth + BALL_R * 8;
        const cueRackOffset = Math.max(
          cueRackHalfWidth,
          Math.min(availableHalfDepth, desiredOffset)
        );
        const cueRackGap = BALL_R * 3.2;
        const cueRackY = floorY + cueRackGap + cueRackDimensions.height / 2;
        const cueRackPlacements = [
          { x: leftInterior, z: cueRackOffset, rotationY: Math.PI / 2 },
          { x: rightInterior, z: -cueRackOffset, rotationY: -Math.PI / 2 }
        ];

        cueRackPlacements.forEach((placement, index) => {
          const entry = index === 0 ? baseRackEntry : createRackEntry();
          const rack = entry.group;
          if (!rack) return;
          rack.position.set(placement.x, cueRackY, placement.z);
          rack.rotation.y = placement.rotationY;
          world.add(rack);
          registerCueRack(rack, entry.dispose, entry.dimensions);
          if (typeof entry.dispose === 'function') {
            cueRackDisposers.push(entry.dispose);
          }
        });
        updateCueRackHighlights();
      }

      const resolveBroadcastDistance = () => {
        const hostAspect = host?.clientWidth && host?.clientHeight
          ? host.clientWidth / host.clientHeight
          : null;
        const aspect = Number.isFinite(hostAspect) ? hostAspect : 9 / 16; // fall back to worst-case portrait when unknown
        const tempCamera = new THREE.PerspectiveCamera(STANDING_VIEW_FOV, aspect);
        const topDownRadius = Math.max(
          fitRadius(tempCamera, TOP_VIEW_MARGIN) * TOP_VIEW_RADIUS_SCALE,
          CAMERA.minR * TOP_VIEW_MIN_RADIUS_SCALE
        );
        return topDownRadius;
      };
      const resolveTopDownCoords = () => {
        const radius = resolveBroadcastDistance();
        const phi = TOP_VIEW_RESOLVED_PHI;
        const focusY = ORBIT_FOCUS_BASE_Y * worldScaleFactor;
        const height = focusY + Math.cos(phi) * radius;
        const horizontal = Math.sin(phi) * radius;
        return { radius, height, horizontal };
      };
      const { height: topDownHeight, horizontal: topDownHorizontal } =
        resolveTopDownCoords();
      const broadcastClearance = arenaMargin * 0.3 + BALL_R * 4;
      const shortRailTarget = Math.max(
        topDownHorizontal,
        arenaHalfDepth - broadcastClearance
      );
      const shortRailSlideLimit = 0;
      const broadcastRig = createBroadcastCameras({
        floorY,
        cameraHeight: topDownHeight,
        shortRailZ: shortRailTarget,
        slideLimit: shortRailSlideLimit,
        arenaHalfDepth: Math.max(arenaHalfDepth - BALL_R * 4, BALL_R * 4)
      });
      world.add(broadcastRig.group);
      broadcastCamerasRef.current = broadcastRig;

      if (ENABLE_TRIPOD_CAMERAS) {
        const tripodHeightBoost = 1.04;
        const tripodScale =
          ((TABLE_Y + BALL_R * 6 - floorY) / 1.33) * tripodHeightBoost;
        const tripodTilt = THREE.MathUtils.degToRad(-12);
        const tripodProximityPull = BALL_R * 2.5;
        const tripodExtra = Math.max(BALL_R * 2, BALL_R * 6 - tripodProximityPull);
        const tripodDesiredZ =
          Math.max(PLAY_H / 2 + BALL_R * 12, shortRailTarget - BALL_R * 6) +
          tripodExtra;
        const tripodMaxZ = arenaHalfDepth - BALL_R * 4;
        const tripodZOffset = Math.min(tripodMaxZ, tripodDesiredZ);
        const tripodTarget = new THREE.Vector3(0, TABLE_Y + TABLE.THICK * 0.5, 0);
        const tripodPositions = [
          { x: 0, z: tripodZOffset },
          { x: 0, z: -tripodZOffset }
        ];
        tripodPositions.forEach(({ x, z }) => {
          const { group: tripodGroup, headPivot } = createTripodBroadcastCamera();
          tripodGroup.scale.setScalar(tripodScale);
          tripodGroup.position.set(x, floorY, z);
          const toTarget = new THREE.Vector3()
            .subVectors(tripodTarget, tripodGroup.position)
            .setY(0);
          if (toTarget.lengthSq() > 1e-6) {
            const yaw = Math.atan2(toTarget.z, toTarget.x);
            tripodGroup.rotation.y = yaw;
          }
          world.add(tripodGroup);
          tripodGroup.updateWorldMatrix(true, false);
          headPivot.up.set(0, 1, 0);
          headPivot.lookAt(tripodTarget);
          headPivot.rotateY(Math.PI);
          headPivot.rotateX(tripodTilt);
        });
      }

      const DARTBOARD_TEXTURE_URL =
        'https://dl.polyhaven.org/file/ph-assets/Models/jpg/2k/dartboard/dartboard_diff_2k.jpg';
      const hospitalityMats = {
        wood: new THREE.MeshStandardMaterial({
          color: 0x8b5e3c,
          roughness: 0.8
        }),
        fabric: new THREE.MeshStandardMaterial({
          color: 0x1f2a44,
          roughness: 0.9
        }),
        chrome: new THREE.MeshStandardMaterial({
          color: 0xbfc7d5,
          roughness: 0.44,
          metalness: 0.72,
          envMapIntensity: 0.6
        }),
        glass: new THREE.MeshStandardMaterial({
          color: 0x9bd3ff,
          roughness: 0.05,
          metalness: 0,
          transparent: true,
          opacity: 0.3,
          envMapIntensity: 1.5
        }),
        water: new THREE.MeshStandardMaterial({
          color: 0x4ea9ff,
          roughness: 0.1,
          metalness: 0,
          transparent: true,
          opacity: 0.55
        })
      };

      const hospitalityScale = (TABLE_H * 0.48) / 0.75;
      const hospitalityUpscale = 6;
      const furnitureScale = hospitalityScale * 1.18 * hospitalityUpscale;
      const hospitalitySizeMultiplier = 2.5;
      const toHospitalityUnits = (value = 0) => value * hospitalityScale;
      const hospitalityTableHeightScale = 0.6; // drop the bistro table height by 40% so it sits lower against the arena floor line
      const hospitalityChairGap =
        toHospitalityUnits(0.08) * hospitalityUpscale; // keep a slim clearance between each chair and table edge
      const hospitalityEdgePull =
        toHospitalityUnits(0.18) * hospitalityUpscale; // keep hospitality props inset from the arena bounds
      const CHESS_BATTLE_TABLE_HEIGHT_UNITS = 0.867;
      const CHESS_BATTLE_TABLE_SPAN_UNITS = 5.1;
      const CHESS_BATTLE_BOARD_SPAN_UNITS = 1.9008;
      const CHESS_BATTLE_CHAIR_MAX_DIM = 1.917;
      const chessBattleScale = TABLE_H / CHESS_BATTLE_TABLE_HEIGHT_UNITS;
      const chessBattleTargetSpan =
        CHESS_BATTLE_TABLE_SPAN_UNITS * chessBattleScale;
      const chessBattleTargetBoard =
        CHESS_BATTLE_BOARD_SPAN_UNITS * chessBattleScale;
      const chessBattleTargetChair =
        CHESS_BATTLE_CHAIR_MAX_DIM * chessBattleScale;
      const fitGroupToChessBattle = (group) => {
        if (!group) return;
        const box = new THREE.Box3().setFromObject(group);
        const size = box.getSize(new THREE.Vector3());
        const span = Math.max(size.x || 1, size.z || 1);
        const minSpan = Math.max(TABLE.W * TABLE_DISPLAY_SCALE * 0.4, arenaMargin * 0.8);
        const maxSpan = Math.max(TABLE.W, TABLE.H) * TABLE_DISPLAY_SCALE * 0.82;
        const targetSpan = THREE.MathUtils.clamp(chessBattleTargetSpan, minSpan, maxSpan);
        if (span > 1e-6) {
          group.scale.multiplyScalar(targetSpan / span);
        }
      };

      const createTableSet = () => {
        const set = new THREE.Group();

        const tableTop = new THREE.Mesh(
          new THREE.CylinderGeometry(0.35, 0.35, 0.03, 24),
          hospitalityMats.wood
        );
        tableTop.position.y = 0.75;
        tableTop.castShadow = true;
        tableTop.receiveShadow = true;
        set.add(tableTop);

        const tableStem = new THREE.Mesh(
          new THREE.CylinderGeometry(0.04, 0.06, 0.7, 16),
          hospitalityMats.chrome
        );
        tableStem.position.y = 0.75 - 0.35;
        tableStem.castShadow = true;
        tableStem.receiveShadow = true;
        set.add(tableStem);

        const tableBase = new THREE.Mesh(
          new THREE.CylinderGeometry(0.28, 0.28, 0.04, 24),
          hospitalityMats.chrome
        );
        tableBase.position.y = 0.02;
        tableBase.castShadow = true;
        tableBase.receiveShadow = true;
        set.add(tableBase);

        const bottle = new THREE.Group();
        bottle.position.set(0.05, 0.875, -0.08);
        set.add(bottle);

        const bottleBody = new THREE.Mesh(
          new THREE.CylinderGeometry(0.045, 0.05, 0.22, 16),
          hospitalityMats.glass
        );
        bottleBody.castShadow = true;
        bottleBody.receiveShadow = true;
        bottle.add(bottleBody);

        const bottleNeck = new THREE.Mesh(
          new THREE.CylinderGeometry(0.018, 0.022, 0.05, 12),
          hospitalityMats.glass
        );
        bottleNeck.position.y = 0.135;
        bottleNeck.castShadow = true;
        bottleNeck.receiveShadow = true;
        bottle.add(bottleNeck);

        const bottleCap = new THREE.Mesh(
          new THREE.CylinderGeometry(0.022, 0.022, 0.02, 12),
          hospitalityMats.chrome
        );
        bottleCap.position.y = 0.16;
        bottleCap.castShadow = true;
        bottleCap.receiveShadow = true;
        bottle.add(bottleCap);

        const bottleWater = new THREE.Mesh(
          new THREE.CylinderGeometry(0.043, 0.043, 0.12, 16),
          hospitalityMats.water
        );
        bottleWater.position.y = -0.05;
        bottleWater.castShadow = true;
        bottle.add(bottleWater);

        const glassOuter = new THREE.Mesh(
          new THREE.CylinderGeometry(0.036, 0.032, 0.1, 16, 1, true),
          hospitalityMats.glass
        );
        glassOuter.position.set(-0.12, 0.8, 0.05);
        glassOuter.castShadow = true;
        glassOuter.receiveShadow = true;
        set.add(glassOuter);

        const glassBottom = new THREE.Mesh(
          new THREE.CircleGeometry(0.032, 16),
          hospitalityMats.glass
        );
        glassBottom.rotation.x = -Math.PI / 2;
        glassBottom.position.set(-0.12, 0.75, 0.05);
        glassBottom.castShadow = true;
        glassBottom.receiveShadow = true;
        set.add(glassBottom);

        const glassWater = new THREE.Mesh(
          new THREE.CylinderGeometry(0.029, 0.029, 0.05, 16),
          hospitalityMats.water
        );
        glassWater.position.set(-0.12, 0.775, 0.05);
        glassWater.castShadow = true;
        set.add(glassWater);

        return set;
      };

      const createChair = () => {
        const chair = new THREE.Group();
        const legGeom = new THREE.CylinderGeometry(0.022, 0.022, 0.42, 10);
        [
          [-0.22, -0.22],
          [0.22, -0.22],
          [-0.2, 0.22],
          [0.2, 0.22]
        ].forEach(([x, z]) => {
          const leg = new THREE.Mesh(legGeom, hospitalityMats.chrome);
          leg.position.set(x, 0.21, z);
          leg.castShadow = true;
          leg.receiveShadow = true;
          chair.add(leg);
        });

        const seat = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 0.06, 0.46),
          hospitalityMats.fabric
        );
        seat.position.set(0, 0.46, 0);
        seat.castShadow = true;
        seat.receiveShadow = true;
        chair.add(seat);

        const back = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 0.5, 0.06),
          hospitalityMats.fabric
        );
        back.position.set(0, 0.71, 0.23);
        back.rotation.x = Math.PI * 0.05;
        back.castShadow = true;
        back.receiveShadow = true;
        chair.add(back);

        const armGeom = new THREE.BoxGeometry(0.08, 0.06, 0.46);
        const armL = new THREE.Mesh(armGeom, hospitalityMats.fabric);
        armL.position.set(-0.26, 0.56, 0);
        armL.castShadow = true;
        armL.receiveShadow = true;
        chair.add(armL);
        const armR = armL.clone();
        armR.position.x = 0.26;
        chair.add(armR);

        return chair;
      };

      const ensureHospitalityVisibility = (object) => {
        if (!object) return;
        object.traverse((child) => {
          child.visible = true;
          child.frustumCulled = false;
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
      };

      const resolveTextureAnisotropy = () => {
        const renderer = rendererRef.current;
        if (!renderer?.capabilities?.getMaxAnisotropy) return 4;
        return renderer.capabilities.getMaxAnisotropy();
      };

      const sharpenTexture = (texture, { wrapRepeat = true } = {}) => {
        if (!texture) return;
        applySRGBColorSpace(texture);
        const maxAniso = resolveTextureAnisotropy();
        if (Number.isFinite(maxAniso)) {
          texture.anisotropy = Math.max(texture.anisotropy || 1, maxAniso);
        }
        if (wrapRepeat) {
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
        }
        texture.needsUpdate = true;
      };

      const adjustHospitalityForEdge = (value) => {
        const direction = Math.sign(value);
        const magnitude = Math.max(Math.abs(value) - hospitalityEdgePull, 0);
        return direction * magnitude;
      };

      const decorateTableWithCheeseBoard = (tableSet) => {
        if (!tableSet) return;
        const cheeseBoard = new THREE.Mesh(
          new THREE.CylinderGeometry(0.18, 0.18, 0.02, 24),
          hospitalityMats.wood
        );
        cheeseBoard.position.set(0.06, 0.79, -0.02);
        cheeseBoard.castShadow = true;
        cheeseBoard.receiveShadow = true;

        const cheeseWedge = new THREE.Mesh(
          new THREE.CylinderGeometry(0.05, 0.14, 0.06, 16, 1, false, 0, Math.PI * 0.75),
          new THREE.MeshStandardMaterial({
            color: 0xffe59f,
            roughness: 0.28,
            metalness: 0.04
          })
        );
        cheeseWedge.position.set(0.02, 0.04, 0.03);
        cheeseWedge.rotation.x = Math.PI / 2;
        cheeseWedge.castShadow = true;
        cheeseWedge.receiveShadow = true;
        cheeseBoard.add(cheeseWedge);

        const garnish = new THREE.Mesh(
          new THREE.SphereGeometry(0.028, 14, 12),
          new THREE.MeshStandardMaterial({
            color: 0x6fbf73,
            roughness: 0.35
          })
        );
        garnish.position.set(-0.08, 0.02, -0.02);
        garnish.castShadow = true;
        garnish.receiveShadow = true;
        cheeseBoard.add(garnish);

        tableSet.add(cheeseBoard);
      };

      const createCheeseTableSet = () => {
        const tableSet = createTableSet();
        decorateTableWithCheeseBoard(tableSet);
        return tableSet;
      };

      const createCheeseServiceSet = ({
        chairOffsets,
        position = [0, 0],
        rotationY = 0
      } = {}) => {
        const group = new THREE.Group();
        const scaledFurniture = furnitureScale * hospitalitySizeMultiplier;

        const tableSet = createCheeseTableSet();
        tableSet.scale.set(
          scaledFurniture,
          scaledFurniture * hospitalityTableHeightScale,
          scaledFurniture
        );
        group.add(tableSet);

        const resolvedOffsets =
          Array.isArray(chairOffsets) && chairOffsets.length
            ? chairOffsets
            : [
                [
                  toHospitalityUnits(0.44) * hospitalityUpscale,
                  -toHospitalityUnits(0.62) * hospitalityUpscale
                ],
                [
                  -toHospitalityUnits(0.44) * hospitalityUpscale,
                  -toHospitalityUnits(0.62) * hospitalityUpscale
                ]
              ];
        resolvedOffsets.forEach(([x, z]) => {
          const chair = createChair();
          chair.scale.setScalar(scaledFurniture);
          chair.position.set(x, 0, z);
          const toCenter = new THREE.Vector2(x, z).multiplyScalar(-1);
          chair.rotation.y = Math.atan2(toCenter.x, toCenter.y);
          group.add(chair);
        });

        group.position.set(
          adjustHospitalityForEdge(position[0] ?? 0),
          floorY,
          adjustHospitalityForEdge(position[1] ?? 0)
        );
        group.rotation.y = rotationY;
        ensureHospitalityVisibility(group);
        return group;
      };

      const getChessBoardTexture = () => {
        if (chessBoardTextureRef.current) return chessBoardTextureRef.current;
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const light = '#EEE8D5';
        const dark = '#2B2F36';
        const tile = size / 8;
        ctx.fillStyle = light;
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = dark;
        for (let r = 0; r < 8; r += 1) {
          for (let c = 0; c < 8; c += 1) {
            if ((r + c) % 2 === 0) continue;
            ctx.fillRect(c * tile, r * tile, tile, tile);
          }
        }
        const border = '#141b2f';
        ctx.strokeStyle = border;
        ctx.lineWidth = tile * 0.12;
        ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, size - ctx.lineWidth, size - ctx.lineWidth);
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        sharpenTexture(texture);
        chessBoardTextureRef.current = texture;
        return texture;
      };

      const tagHospitalityMaterial = (material) => {
        if (!material) return material;
        material.userData = { ...(material.userData || {}), disposableHospitality: true };
        return material;
      };

      const createChessBoard = (boardSize = 0.9, boardThickness = 0.05) => {
        const group = new THREE.Group();
        const boardTexture = getChessBoardTexture();
        const boardMaterial = tagHospitalityMaterial(new THREE.MeshStandardMaterial({
          map: boardTexture,
          roughness: 0.44,
          metalness: 0.12
        }));
        const top = new THREE.Mesh(
          new THREE.BoxGeometry(boardSize, boardThickness, boardSize),
          boardMaterial
        );
        top.position.y = boardThickness / 2;
        top.castShadow = true;
        top.receiveShadow = true;
        group.add(top);
        const rimMaterial = tagHospitalityMaterial(new THREE.MeshStandardMaterial({
          color: 0x141b2f,
          roughness: 0.62,
          metalness: 0.18
        }));
        const rim = new THREE.Mesh(
          new THREE.BoxGeometry(boardSize * 1.08, boardThickness * 0.6, boardSize * 1.08),
          rimMaterial
        );
        rim.position.y = boardThickness * 0.3;
        rim.castShadow = true;
        rim.receiveShadow = true;
        group.add(rim);
        return { group, height: boardThickness };
      };

      const addFallbackChessPieces = (boardGroup, boardSize = 0.9, boardThickness = 0.05) => {
        if (!boardGroup) return;
        const tile = boardSize / 8;
        const pieceHeight = tile * 0.9;
        const pieceRadius = tile * 0.22;
        const headRadius = pieceRadius * 0.7;
        const bodyGeom = new THREE.CylinderGeometry(pieceRadius, pieceRadius * 0.85, pieceHeight, 14);
        const headGeom = new THREE.SphereGeometry(headRadius, 12, 12);
        const lightMaterial = tagHospitalityMaterial(new THREE.MeshStandardMaterial({
          color: 0xe7e2d3,
          roughness: 0.52,
          metalness: 0.12
        }));
        const darkMaterial = tagHospitalityMaterial(new THREE.MeshStandardMaterial({
          color: 0x2b314e,
          roughness: 0.48,
          metalness: 0.18
        }));
        const placePiece = (material, x, z) => {
          const piece = new THREE.Group();
          const body = new THREE.Mesh(bodyGeom, material);
          body.position.y = pieceHeight / 2;
          body.castShadow = true;
          body.receiveShadow = true;
          piece.add(body);
          const head = new THREE.Mesh(headGeom, material);
          head.position.y = pieceHeight + headRadius * 0.6;
          head.castShadow = true;
          head.receiveShadow = true;
          piece.add(head);
          piece.position.set(x, boardThickness + 0.01, z);
          piece.castShadow = true;
          piece.receiveShadow = true;
          return piece;
        };
        const piecesGroup = new THREE.Group();
        const origin = -boardSize / 2 + tile / 2;
        const rows = [
          { zIndex: 1, material: lightMaterial },
          { zIndex: 6, material: darkMaterial }
        ];
        rows.forEach(({ zIndex, material }) => {
          for (let c = 0; c < 8; c += 1) {
            const x = origin + c * tile;
            const z = origin + zIndex * tile;
            const pawn = placePiece(material, x, z);
            piecesGroup.add(pawn);
          }
        });
        piecesGroup.position.y = boardThickness * 0.5;
        boardGroup.add(piecesGroup);
      };

      const createChessChair = () => {
        const chair = new THREE.Group();
        const legMaterial = tagHospitalityMaterial(new THREE.MeshStandardMaterial({
          color: 0xcad1df,
          roughness: 0.32,
          metalness: 0.7
        }));
        const seatMaterial = tagHospitalityMaterial(new THREE.MeshStandardMaterial({
          color: 0x111827,
          roughness: 0.74
        }));
        const legGeom = new THREE.CylinderGeometry(0.022, 0.022, 0.42, 12);
        [
          [-0.22, -0.22],
          [0.22, -0.22],
          [-0.2, 0.22],
          [0.2, 0.22]
        ].forEach(([x, z]) => {
          const leg = new THREE.Mesh(legGeom, legMaterial);
          leg.position.set(x, 0.21, z);
          leg.castShadow = true;
          leg.receiveShadow = true;
          chair.add(leg);
        });

        const seat = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 0.06, 0.46),
          seatMaterial
        );
        seat.position.set(0, 0.46, 0);
        seat.castShadow = true;
        seat.receiveShadow = true;
        chair.add(seat);

        const back = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 0.5, 0.06),
          seatMaterial
        );
        back.position.set(0, 0.71, 0.23);
        back.rotation.x = Math.PI * 0.05;
        back.castShadow = true;
        back.receiveShadow = true;
        chair.add(back);

        const armGeom = new THREE.BoxGeometry(0.08, 0.06, 0.46);
        const armL = new THREE.Mesh(armGeom, seatMaterial);
        armL.position.set(-0.26, 0.56, 0);
        armL.castShadow = true;
        armL.receiveShadow = true;
        chair.add(armL);
        const armR = armL.clone();
        armR.position.x = 0.26;
        chair.add(armR);

        return chair;
      };

      const CHESS_LOUNGE_SET_URLS = [
        'https://raw.githubusercontent.com/cx20/gltf-test/master/sampleModels/Chess/glTF-Binary/Chess.glb',
        'https://cdn.jsdelivr.net/gh/cx20/gltf-test@master/sampleModels/Chess/glTF-Binary/Chess.glb',
        'https://raw.githubusercontent.com/quaterniusdev/ChessSet/master/Source/GLTF/ChessSet.glb',
        'https://cdn.jsdelivr.net/gh/quaterniusdev/ChessSet@master/Source/GLTF/ChessSet.glb'
      ];
      const CHESS_LOUNGE_CHAIR_URLS = [
        'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/AntiqueChair/glTF-Binary/AntiqueChair.glb',
        'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/SheenChair/glTF-Binary/SheenChair.glb',
        'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/AntiqueChair/glTF-Binary/AntiqueChair.glb'
      ];
      const cloneHospitalityMaterial = (mat) => {
        if (!mat) return mat;
        const material = mat.clone ? mat.clone() : mat;
        material.userData = { ...(material.userData || {}), disposableHospitality: true };
        applySRGBColorSpace(material.map);
        applySRGBColorSpace(material.emissiveMap);
        if (material.map) sharpenTexture(material.map);
        if (material.emissiveMap) sharpenTexture(material.emissiveMap);
        material.needsUpdate = true;
        return material;
      };
      const loadFirstAvailableGltf = async (urls = []) => {
        if (!hospitalityLoaderRef.current) {
          hospitalityLoaderRef.current = new GLTFLoader();
          hospitalityLoaderRef.current.setCrossOrigin('anonymous');
        }
        const loader = hospitalityLoaderRef.current;
        let lastError = null;
        for (const url of urls) {
          try {
            // eslint-disable-next-line no-await-in-loop
            return await loader.loadAsync(url);
          } catch (error) {
            lastError = error;
          }
        }
        throw lastError || new Error('Failed to load GLTF asset');
      };
      const markHospitalityMaterials = (root) => {
        if (!root) return;
        root.traverse((child) => {
          if (!child?.isMesh) return;
          const materials = Array.isArray(child.material)
            ? child.material
            : [child.material];
          child.castShadow = true;
          child.receiveShadow = true;
          child.material = materials.map((mat) => cloneHospitalityMaterial(mat));
        });
      };
      const ensureChessLoungeAssets = async () => {
        if (chessLoungeTemplateRef.current && chessChairTemplateRef.current) {
          return {
            lounge: chessLoungeTemplateRef.current,
            chair: chessChairTemplateRef.current
          };
        }
        if (chessLoungeLoadRef.current) {
          return chessLoungeLoadRef.current;
        }
        chessLoungeLoadRef.current = Promise.all([
          loadFirstAvailableGltf(CHESS_LOUNGE_SET_URLS),
          loadFirstAvailableGltf(CHESS_LOUNGE_CHAIR_URLS)
        ])
          .then(([loungeGltf, chairGltf]) => {
            const loungeModel = loungeGltf?.scene?.clone?.(true) ?? loungeGltf?.scene ?? null;
            const chairModel = chairGltf?.scene?.clone?.(true) ?? chairGltf?.scene ?? null;
            markHospitalityMaterials(loungeModel);
            markHospitalityMaterials(chairModel);
            chessLoungeTemplateRef.current = loungeModel;
            chessChairTemplateRef.current = chairModel;
            return { lounge: loungeModel, chair: chairModel };
          })
          .catch((error) => {
            console.warn('Failed to load chess lounge assets', error);
            return { lounge: null, chair: null };
          })
          .finally(() => {
            chessLoungeLoadRef.current = null;
          });
        return chessLoungeLoadRef.current;
      };
      const createFallbackChessLoungeSet = ({
        chairOffsets,
        position = [0, 0],
        rotationY = 0
      } = {}) => {
        const group = new THREE.Group();
        const tableHeight = 0.82;
        const table = new THREE.Group();
        const tableStemMaterial = tagHospitalityMaterial(
          new THREE.MeshStandardMaterial({
            color: 0x1b2435,
            roughness: 0.52,
            metalness: 0.16
          })
        );
        const tableStem = new THREE.Mesh(
          new THREE.CylinderGeometry(0.05, 0.07, tableHeight * 0.8, 18),
          tableStemMaterial
        );
        tableStem.position.y = tableHeight * 0.4;
        tableStem.castShadow = true;
        tableStem.receiveShadow = true;
        table.add(tableStem);
        const tableBaseMaterial = tagHospitalityMaterial(
          new THREE.MeshStandardMaterial({
            color: 0xcbd5e1,
            roughness: 0.34,
            metalness: 0.65
          })
        );
        const tableBase = new THREE.Mesh(
          new THREE.CylinderGeometry(0.32, 0.32, 0.06, 24),
          tableBaseMaterial
        );
        tableBase.position.y = 0.03;
        tableBase.castShadow = true;
        tableBase.receiveShadow = true;
        table.add(tableBase);
        const tabletopMaterial = tagHospitalityMaterial(new THREE.MeshStandardMaterial({
          color: 0x141b2f,
          roughness: 0.5,
          metalness: 0.14
        }));
        const tabletop = new THREE.Mesh(
          new THREE.CylinderGeometry(0.5, 0.52, 0.08, 32),
          tabletopMaterial
        );
        tabletop.position.y = tableHeight;
        tabletop.castShadow = true;
        tabletop.receiveShadow = true;
        table.add(tabletop);
        const board = createChessBoard(0.72, 0.045);
        const boardBox = new THREE.Box3().setFromObject(board.group);
        const boardSize = boardBox.getSize(new THREE.Vector3());
        const boardSpan = Math.max(boardSize.x || 1, boardSize.z || 1);
        const boardTarget = Math.min(
          chessBattleTargetBoard,
          chessBattleTargetSpan * 0.42
        );
        const boardScale =
          boardSpan > 1e-6 && Number.isFinite(boardTarget) && boardTarget > 0
            ? boardTarget / boardSpan
            : 1;
        board.group.scale.setScalar(boardScale);
        const scaledBoardHeight = board.height * boardScale;
        board.group.position.y = tableHeight + scaledBoardHeight * 0.5 + 0.01;
        addFallbackChessPieces(board.group, 0.72, 0.045);
        table.add(board.group);
        group.add(table);

        const resolvedOffsets =
          Array.isArray(chairOffsets) && chairOffsets.length
            ? chairOffsets
            : [
                [-toHospitalityUnits(0.44) * hospitalityUpscale, -toHospitalityUnits(0.62) * hospitalityUpscale],
                [toHospitalityUnits(0.44) * hospitalityUpscale, -toHospitalityUnits(0.62) * hospitalityUpscale]
              ];
        resolvedOffsets.forEach(([x, z]) => {
          const chair = createChessChair();
          const chairBox = new THREE.Box3().setFromObject(chair);
          const chairSize = chairBox.getSize(new THREE.Vector3());
          const maxSize = Math.max(chairSize.x || 1, chairSize.y || 1, chairSize.z || 1);
          const targetMax = Math.max(
            chessBattleTargetChair,
            toHospitalityUnits(0.92) * hospitalityUpscale
          );
          chair.scale.multiplyScalar(targetMax / maxSize);
          chair.position.set(x, 0, z);
          const toCenter = new THREE.Vector2(x, z).multiplyScalar(-1);
          chair.rotation.y = Math.atan2(toCenter.x, toCenter.y);
          group.add(chair);
        });

        group.position.set(
          adjustHospitalityForEdge(position[0] ?? 0),
          floorY,
          adjustHospitalityForEdge(position[1] ?? 0)
        );
        group.rotation.y = rotationY;
        fitGroupToChessBattle(group);
        ensureHospitalityVisibility(group);
        return group;
      };
      const createChessLoungeSet = async ({
        chairOffsets,
        position = [0, 0],
        rotationY = 0
      } = {}) => {
        const assets = await ensureChessLoungeAssets();
        const loungeTemplate = assets?.lounge;
        const chairTemplate = assets?.chair;
        if (!loungeTemplate) {
          return createFallbackChessLoungeSet({ chairOffsets, position, rotationY });
        }
        const lounge = loungeTemplate.clone(true);
        lounge.traverse((child) => {
          if (!child?.isMesh) return;
          const materials = Array.isArray(child.material)
            ? child.material
            : [child.material];
          const clonedMaterials = materials.map((mat) => cloneHospitalityMaterial(mat));
          child.material = Array.isArray(child.material) ? clonedMaterials : clonedMaterials[0];
          child.castShadow = true;
          child.receiveShadow = true;
        });

        fitGroupToChessBattle(lounge);
        lounge.position.set(0, floorY, 0);
        lounge.rotation.y = rotationY;
        ensureHospitalityVisibility(lounge);

        const resolvedOffsets =
          Array.isArray(chairOffsets) && chairOffsets.length
            ? chairOffsets
            : [
                [-toHospitalityUnits(0.52) * hospitalityUpscale, -toHospitalityUnits(0.78) * hospitalityUpscale],
                [toHospitalityUnits(0.52) * hospitalityUpscale, -toHospitalityUnits(0.78) * hospitalityUpscale]
              ];
        const group = new THREE.Group();
        group.add(lounge);
        resolvedOffsets.forEach(([x, z]) => {
          const chairModel = chairTemplate?.clone?.(true);
          if (!chairModel) return;
          const chairBox = new THREE.Box3().setFromObject(chairModel);
          const chairSize = chairBox.getSize(new THREE.Vector3());
          const maxSize = Math.max(chairSize.x || 1, chairSize.y || 1, chairSize.z || 1);
          const targetMax = Math.max(
            chessBattleTargetChair,
            toHospitalityUnits(0.92) * hospitalityUpscale
          );
          chairModel.scale.multiplyScalar(targetMax / maxSize);
          chairModel.traverse((child) => {
            if (!child?.isMesh) return;
            const materials = Array.isArray(child.material)
              ? child.material
              : [child.material];
            const clonedMaterials = materials.map((mat) => cloneHospitalityMaterial(mat));
            child.material = Array.isArray(child.material)
              ? clonedMaterials
              : clonedMaterials[0];
            child.castShadow = true;
            child.receiveShadow = true;
          });
          chairModel.position.set(x, 0, z);
          const toCenter = new THREE.Vector2(x, z).multiplyScalar(-1);
          chairModel.rotation.y = Math.atan2(toCenter.x, toCenter.y) + rotationY;
          group.add(chairModel);
        });

        group.position.set(
          adjustHospitalityForEdge(position[0] ?? 0),
          0,
          adjustHospitalityForEdge(position[1] ?? 0)
        );
        ensureHospitalityVisibility(group);
        return group;
      };

      const createChessBattleDefaultHospitality = async ({
        chairOffsets,
        position = [0, 0],
        rotationY = 0,
        scale = 1
      } = {}) => {
        const [battleSet, assets] = await Promise.all([
          loadFirstAvailableGltf(CHESS_BATTLE_DEFAULT_SET_URLS).catch(() => null),
          ensureChessLoungeAssets().catch(() => ({ lounge: null, chair: null }))
        ]);
        const group = new THREE.Group();
        const baseSet = battleSet?.scene?.clone?.(true) ?? battleSet?.scene ?? null;
        if (baseSet) {
          markHospitalityMaterials(baseSet);
          fitGroupToChessBattle(baseSet);
          const box = new THREE.Box3().setFromObject(baseSet);
          if (Number.isFinite(box.min?.y)) {
            baseSet.position.y = floorY - box.min.y;
          }
          ensureHospitalityVisibility(baseSet);
          group.add(baseSet);
        }

        const chairTemplate = assets?.chair;
        const resolvedOffsets =
          Array.isArray(chairOffsets) && chairOffsets.length
            ? chairOffsets
            : [
                [-toHospitalityUnits(0.52) * hospitalityUpscale, -toHospitalityUnits(0.78) * hospitalityUpscale],
                [toHospitalityUnits(0.52) * hospitalityUpscale, -toHospitalityUnits(0.78) * hospitalityUpscale]
              ];
        resolvedOffsets.forEach(([x, z]) => {
          const chairModel = chairTemplate?.clone?.(true);
          if (!chairModel) return;
          const chairBox = new THREE.Box3().setFromObject(chairModel);
          const chairSize = chairBox.getSize(new THREE.Vector3());
          const maxSize = Math.max(chairSize.x || 1, chairSize.y || 1, chairSize.z || 1);
          const targetMax = Math.max(
            chessBattleTargetChair,
            toHospitalityUnits(0.92) * hospitalityUpscale
          );
          if (maxSize > 1e-6) {
            chairModel.scale.multiplyScalar(targetMax / maxSize);
          }
          chairModel.traverse((child) => {
            if (!child?.isMesh) return;
            const materials = Array.isArray(child.material)
              ? child.material
              : [child.material];
            const clonedMaterials = materials.map((mat) => cloneHospitalityMaterial(mat));
            child.material = Array.isArray(child.material)
              ? clonedMaterials
              : clonedMaterials[0];
            child.castShadow = true;
            child.receiveShadow = true;
          });
          chairModel.position.set(x, 0, z);
          const toCenter = new THREE.Vector2(x, z).multiplyScalar(-1);
          chairModel.rotation.y = Math.atan2(toCenter.x, toCenter.y) + rotationY;
          group.add(chairModel);
        });

        group.position.set(
          adjustHospitalityForEdge(position[0] ?? 0),
          floorY,
          adjustHospitalityForEdge(position[1] ?? 0)
        );
        group.rotation.y = rotationY;
        group.scale.multiplyScalar(scale);
        ensureHospitalityVisibility(group);
        if (group.children.length === 0) return null;
        return group;
      };

      const createDartboard = ({
        position = [0, 0, 0],
        faceCenter = true
      } = {}) => {
        const dartGroup = new THREE.Group();
        const dartMat = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          roughness: 0.38,
          metalness: 0.08
        });
        dartMat.userData = { ...(dartMat.userData || {}), disposableHospitality: true };
        const dartGeom = new THREE.CircleGeometry(0.38, 48);
        const dartMesh = new THREE.Mesh(dartGeom, dartMat);
        dartMesh.castShadow = false;
        dartMesh.receiveShadow = false;
        dartGroup.add(dartMesh);

        const applyDartboardTexture = (texture) => {
          if (!texture) return;
          texture.colorSpace = THREE.SRGBColorSpace;
          dartMat.map = texture;
          dartMat.needsUpdate = true;
        };
        if (dartboardTextureRef.current) {
          applyDartboardTexture(dartboardTextureRef.current);
        } else {
          const loader = new THREE.TextureLoader();
          loader.load(
            DARTBOARD_TEXTURE_URL,
            (tex) => {
              dartboardTextureRef.current = tex;
              sharpenTexture(tex);
              applyDartboardTexture(tex);
            },
            undefined,
            () => {}
          );
        }

        const targetX = adjustHospitalityForEdge(position[0] ?? 0);
        const targetZ = adjustHospitalityForEdge(position[2] ?? 0);
        dartGroup.position.set(
          targetX,
          position[1] ?? floorY + 1.72,
          targetZ
        );
        const direction = faceCenter
          ? Math.atan2(-targetZ, -targetX || 1e-6)
          : 0;
        dartGroup.rotation.y = direction;
        ensureHospitalityVisibility(dartGroup);
        return dartGroup;
      };

      const createCornerHospitalitySet = ({ chairOffset, position, rotationY }) => {
        const group = new THREE.Group();
        const scaledFurniture = furnitureScale * hospitalitySizeMultiplier;

        const tableSet = createTableSet();
        tableSet.scale.set(
          scaledFurniture,
          scaledFurniture * hospitalityTableHeightScale,
          scaledFurniture
        );
        const chairVector = new THREE.Vector2(chairOffset[0], chairOffset[1]);
        const chairDistance = chairVector.length();
        if (chairDistance > 1e-6) {
          const maxPull = Math.max(chairDistance - hospitalityChairGap, 0);
          const tablePull = Math.min(
            maxPull,
            toHospitalityUnits(0.2) * hospitalityUpscale
          );
          const pullScale = tablePull / chairDistance;
          tableSet.position.set(
            chairVector.x * pullScale,
            0,
            chairVector.y * pullScale
          );
        } else {
          tableSet.position.set(0, 0, 0);
        }
        group.add(tableSet);

        const chair = createChair();
        chair.scale.setScalar(scaledFurniture);
        const chairClearanceMultiplier = 1.1;
        const chairPlacement = chairVector
          .clone()
          .multiplyScalar(chairClearanceMultiplier);
        chair.position.set(chairPlacement.x, 0, chairPlacement.y);
        const toCenter = chairPlacement.clone().multiplyScalar(-1);
        const baseAngle = Math.atan2(toCenter.x, toCenter.y);
        chair.rotation.y = baseAngle;
        group.add(chair);
        group.position.set(
          adjustHospitalityForEdge(position[0]),
          floorY,
          adjustHospitalityForEdge(position[1])
        );
        group.rotation.y = rotationY;
        ensureHospitalityVisibility(group);
        return group;
      };

      const showHospitalityFurniture = false;
      if (showHospitalityFurniture) {
        const rawCornerInset =
          toHospitalityUnits(0.58) * hospitalityUpscale + arenaMargin * 0.15;
        const cornerInsetX = Math.min(rawCornerInset, Math.abs(leftInterior) * 0.92);
        const cornerInsetFront = Math.min(
          rawCornerInset,
          Math.abs(frontInterior) * 0.92
        );
        const cornerInsetBack = Math.min(
          rawCornerInset,
          Math.abs(backInterior) * 0.92
        );
        const chairSideOffset = toHospitalityUnits(0.44) * hospitalityUpscale;
        const chairForwardOffset = toHospitalityUnits(0.62) * hospitalityUpscale;

        [
          {
            position: [leftInterior + cornerInsetX, frontInterior + cornerInsetFront],
            rotationY: Math.PI / 4,
            chairOffset: [chairSideOffset, -chairForwardOffset]
          },
          {
            position: [rightInterior - cornerInsetX, backInterior - cornerInsetBack],
            rotationY: -3 * Math.PI / 4,
            chairOffset: [-chairSideOffset, chairForwardOffset]
          }
        ].forEach((config) => {
          const hospitalitySet = createCornerHospitalitySet(config);
          world.add(hospitalitySet);
        });
      }

      const aspect = host.clientWidth / host.clientHeight;
      const camera = new THREE.PerspectiveCamera(
        CAMERA.fov,
        aspect,
        CAMERA.near,
        CAMERA.far
      );
      const zoomProfile = resolveCameraZoomProfile(aspect);
      const standingPhi = THREE.MathUtils.clamp(
        STANDING_VIEW.phi,
        CAMERA.minPhi,
        CAMERA.maxPhi
      );
      const standingRadius = clamp(
        fitRadius(camera, STANDING_VIEW.margin * zoomProfile.margin),
        CAMERA.minR,
        CAMERA.maxR
      );
      const initialCueBoundsRadius = Math.max(
        CUE_VIEW_MIN_RADIUS,
        initialCueRadius * zoomProfile.cue
      );
      const sph = new THREE.Spherical(
        standingRadius,
        standingPhi,
        Math.PI
      );
      cameraBoundsRef.current = {
        cueShot: { phi: initialCuePhi, radius: initialCueBoundsRadius },
        standing: { phi: standingPhi, radius: standingRadius }
      };

        const ensurePocketCamera = (id, center) => {
          if (!id) return null;
          let entry = pocketCamerasRef.current.get(id);
          if (!entry) {
            const pocketCamera = new THREE.PerspectiveCamera(
              POCKET_CAMERA_FOV,
              aspect,
              CAMERA.near,
              CAMERA.far
            );
            pocketCamera.up.set(0, 1, 0);
            entry = { camera: pocketCamera, center: center?.clone() ?? null };
            pocketCamerasRef.current.set(id, entry);
          } else if (entry.camera.aspect !== aspect) {
            entry.camera.aspect = aspect;
            entry.camera.updateProjectionMatrix();
          }
          if (entry.camera.fov !== POCKET_CAMERA_FOV) {
            entry.camera.fov = POCKET_CAMERA_FOV;
            entry.camera.updateProjectionMatrix();
          }
          if (center) {
            entry.center = center.clone();
          }
          return entry.camera;
        };

        POCKET_CAMERA_IDS.forEach((anchorId) => {
          const center = getPocketCenterById(anchorId);
          if (center) ensurePocketCamera(anchorId, center);
        });

        const getPocketCameraEntry = (anchorId) => {
          if (!anchorId) return null;
          return pocketCamerasRef.current.get(anchorId) ?? null;
        };

        const getDefaultOrbitTarget = () =>
          new THREE.Vector3(playerOffsetRef.current, ORBIT_FOCUS_BASE_Y, 0);

        activeRenderCameraRef.current = camera;

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

        const maybeForceShortRailPocketView = (ball) => {
          if (!ball?.active) return;
          const posY = ball.pos?.y;
          if (!Number.isFinite(posY)) return;
          if (Math.abs(posY) < SHORT_RAIL_POCKET_TRIGGER) return;
          TMP_VEC2_VIEW.set(ball.vel?.x ?? 0, ball.vel?.y ?? 0);
          if (TMP_VEC2_VIEW.lengthSq() < 1e-6 && ball.launchDir) {
            TMP_VEC2_VIEW.copy(ball.launchDir);
          }
          if (TMP_VEC2_VIEW.lengthSq() < 1e-6) return;
          const forward = TMP_VEC2_VIEW.y;
          if (!Number.isFinite(forward) || forward === 0) return;
          const travelSign = forward > 0 ? 1 : -1;
          const railSign = posY > 0 ? 1 : posY < 0 ? -1 : travelSign;
          if (travelSign !== railSign) return;
          const now = performance.now();
          const currentIntent = pocketSwitchIntentRef.current;
          if (currentIntent?.ballId === ball.id && currentIntent.forced) {
            if (
              currentIntent.createdAt &&
              now - currentIntent.createdAt < SHORT_RAIL_POCKET_INTENT_COOLDOWN_MS
            ) {
              return;
            }
          }
          pocketSwitchIntentRef.current = {
            ballId: ball.id,
            forced: true,
            allowEarly: true,
            createdAt: now
          };
        };

        const getMaxOrbitRadius = () =>
          topViewRef.current
            ? CAMERA.maxR
            : Math.min(CAMERA.maxR, orbitRadiusLimitRef.current ?? CAMERA.maxR);

        const clampOrbitRadius = (value, minRadius = CAMERA.minR) => {
          const maxRadius = getMaxOrbitRadius();
          const min = Math.min(minRadius, maxRadius);
          return clamp(value, min, maxRadius);
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
          const requestedBlend =
            nextBlend ?? cameraBlendRef.current ?? ACTION_CAMERA_START_BLEND;
          const blend = THREE.MathUtils.clamp(requestedBlend, 0, 1);
          const overshoot = Math.max(0, blend - requestedBlend);
          cameraBlendRef.current = blend;
          if (overshoot > 1e-6 && CUE_VIEW_FORWARD_SLIDE_MAX > 0) {
            const slideStore = lowViewSlideRef.current ?? 0;
            const increment = overshoot * CUE_VIEW_FORWARD_SLIDE_MAX;
            lowViewSlideRef.current = THREE.MathUtils.clamp(
              slideStore + increment,
              0,
              CUE_VIEW_FORWARD_SLIDE_MAX
            );
          } else if (blend >= CUE_VIEW_FORWARD_SLIDE_RESET_BLEND) {
            if (blend >= 0.95) {
              lowViewSlideRef.current = 0;
            } else if (lowViewSlideRef.current > 1e-6) {
              const decayBlend = Math.max(
                0,
                blend - CUE_VIEW_FORWARD_SLIDE_RESET_BLEND
              );
              if (decayBlend > 0 && CUE_VIEW_FORWARD_SLIDE_MAX > 0) {
                const decay = decayBlend * CUE_VIEW_FORWARD_SLIDE_MAX;
                lowViewSlideRef.current = Math.max(
                  0,
                  lowViewSlideRef.current - decay
                );
              }
            }
          }
          const cueMinRadius = THREE.MathUtils.lerp(
            CUE_VIEW_MIN_RADIUS,
            CAMERA.minR,
            blend
          );
          const rawPhi = THREE.MathUtils.lerp(cueShot.phi, standing.phi, blend);
          const baseRadius = THREE.MathUtils.lerp(
            cueShot.radius,
            standing.radius,
            blend
          );
          let radius = clampOrbitRadius(baseRadius, cueMinRadius);
          if (CAMERA_DOWNWARD_PULL > 0) {
            const pull = CAMERA_DOWNWARD_PULL * (1 - blend);
            if (pull > 0) {
              radius = clampOrbitRadius(radius - pull, cueMinRadius);
            }
          }
          const cushionHeight = cushionHeightRef.current ?? TABLE.THICK;
          const orbitTargetY =
            orbitFocusRef.current?.target?.y ?? ORBIT_FOCUS_BASE_Y;
          const cueClearance = Math.max(
            0,
            CUE_Y + CAMERA_CUE_SURFACE_MARGIN - orbitTargetY
          );
          const minHeightFromTarget = Math.max(
            TABLE.THICK,
            cushionHeight + CAMERA_CUSHION_CLEARANCE,
            cueClearance
          );
          const phiRailLimit = Math.acos(
            THREE.MathUtils.clamp(minHeightFromTarget / Math.max(radius, 1e-3), -1, 1)
          );
          const aimLineClearance = Math.max(0, AIM_LINE_MIN_Y + CAMERA_AIM_LINE_MARGIN - orbitTargetY);
          const aimLineLimit =
            aimLineClearance > 1e-6
              ? Math.acos(
                  THREE.MathUtils.clamp(
                    aimLineClearance / Math.max(radius, 1e-3),
                    -1,
                    1
                  )
                ) - CAMERA_RAIL_SAFETY
              : null;
          let safePhi = Math.min(rawPhi, phiRailLimit - CAMERA_RAIL_SAFETY);
          if (aimLineLimit != null) {
            safePhi = Math.min(safePhi, aimLineLimit);
          }
          const clampedPhi = clamp(safePhi, CAMERA.minPhi, CAMERA.maxPhi);
          let finalRadius = radius;
          let minRadiusForRails = null;
          if (clampedPhi >= CAMERA_RAIL_APPROACH_PHI) {
            const sinPhi = Math.sin(clampedPhi);
            if (sinPhi > 1e-4) {
              minRadiusForRails = clampOrbitRadius(
                CAMERA_MIN_HORIZONTAL / sinPhi,
                cueMinRadius
              );
              finalRadius = Math.max(finalRadius, minRadiusForRails);
            }
          }
          const phiSpan = standing.phi - cueShot.phi;
          let phiProgress = 0;
          if (Math.abs(phiSpan) > 1e-5) {
            phiProgress = THREE.MathUtils.clamp(
              (clampedPhi - cueShot.phi) / phiSpan,
              0,
              1
            );
          }
          const dynamicPull = CAMERA_DYNAMIC_PULL_RANGE * (1 - phiProgress);
          if (dynamicPull > 1e-5) {
            const adjusted = clampOrbitRadius(
              finalRadius - dynamicPull,
              cueMinRadius
            );
            finalRadius =
              minRadiusForRails != null
                ? Math.max(adjusted, minRadiusForRails)
                : adjusted;
          }
          const tiltZoom = CAMERA_TILT_ZOOM * (1 - phiProgress);
          if (tiltZoom > 1e-5) {
            const zoomed = clampOrbitRadius(
              finalRadius - tiltZoom,
              cueMinRadius
            );
            finalRadius =
              minRadiusForRails != null
                ? Math.max(zoomed, minRadiusForRails)
                : zoomed;
          }
          if (CUE_VIEW_FORWARD_SLIDE_MAX > 0) {
            const storedSlide = lowViewSlideRef.current ?? 0;
            if (storedSlide > 1e-6) {
              const fade =
                CUE_VIEW_FORWARD_SLIDE_BLEND_FADE > 1e-6
                  ? 1 -
                    THREE.MathUtils.clamp(
                      blend / CUE_VIEW_FORWARD_SLIDE_BLEND_FADE,
                      0,
                      1
                    )
                  : 1;
              const slideAmount = storedSlide * fade;
              if (slideAmount > 1e-6) {
                const slid = clampOrbitRadius(
                  finalRadius - slideAmount,
                  cueMinRadius
                );
                finalRadius =
                  minRadiusForRails != null
                    ? Math.max(slid, minRadiusForRails)
                    : slid;
              }
            }
          }
          sph.phi = clampedPhi;
          sph.radius = clampOrbitRadius(finalRadius, cueMinRadius);
          syncBlendToSpherical();
        };

        const sanitizeVector3 = (vec, fallback = null) => {
          if (!vec) return fallback;
          const { x, y, z } = vec;
          if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
            return fallback;
          }
          return vec;
        };


        const updateBroadcastCameras = ({
          railDir = 1,
          targetWorld = null,
          focusWorld = null,
          orbitWorld = null,
          lerp = null
        } = {}) => {
          const rig = broadcastCamerasRef.current;
          if (!rig || !rig.cameras) return;
          const safeTargetWorld = sanitizeVector3(targetWorld, null);
          const safeFocusWorld = sanitizeVector3(focusWorld, null);
          const safeOrbitWorld = sanitizeVector3(orbitWorld, null);
          const system =
            broadcastSystemRef.current ?? activeBroadcastSystem ?? BROADCAST_SYSTEM_OPTIONS[0];
          const smoothing = THREE.MathUtils.clamp(
            typeof lerp === 'number' ? lerp : system?.smoothing ?? 0.18,
            0,
            1
          );
          const baseFocus =
            safeFocusWorld ?? rig.defaultFocusWorld ?? rig.defaultFocus ?? null;
          const trackingTarget = safeTargetWorld ?? baseFocus;
          const bias = THREE.MathUtils.clamp(system?.trackingBias ?? 0, 0, 1);
          const orbitBias = THREE.MathUtils.clamp(
            system?.orbitBias ?? BROADCAST_ORBIT_FOCUS_BIAS,
            0,
            1
          );
          let focusTarget =
            baseFocus && trackingTarget
              ? baseFocus.clone().lerp(trackingTarget, bias)
              : baseFocus ?? trackingTarget;
          if (safeOrbitWorld) {
            focusTarget = focusTarget
              ? focusTarget.lerp(safeOrbitWorld, orbitBias)
              : safeOrbitWorld.clone();
          }
          rig.userData = rig.userData || {};
          if (!rig.userData.focus) {
            rig.userData.focus = focusTarget?.clone() ?? new THREE.Vector3();
          }
          if (focusTarget) {
            rig.userData.focus.lerp(focusTarget, smoothing);
          }
          const resolvedFocus = focusTarget ? rig.userData.focus.clone() : null;
          const applyPreset = (unit, direction) => {
            if (!unit) return;
            if (unit.slider) {
              const lateral = system?.lateralDolly ?? 0;
              const depth = system?.railPush ?? 0;
              unit.slider.position.x = lateral * direction;
              unit.slider.position.z = depth * direction;
            }
            if (unit.head && resolvedFocus) {
              const headTarget = resolvedFocus.clone();
              headTarget.y += system?.focusLift ?? 0;
              headTarget.x += (system?.focusPan ?? 0) * direction;
              headTarget.z += (system?.focusDepthBias ?? 0) * direction;
              unit.head.lookAt(headTarget);
            }
          };
          const useBack = railDir >= 0;
          applyPreset(useBack ? rig.cameras.back : rig.cameras.front, useBack ? 1 : -1);
          applyPreset(useBack ? rig.cameras.front : rig.cameras.back, useBack ? -1 : 1);
          rig.activeRail = useBack ? 'back' : 'front';
        };

        const resolveRailOverheadReplayCamera = ({
          focusOverride = null,
          minTargetY = null
        } = {}) => {
          const rig = broadcastCamerasRef.current;
          if (!rig?.cameras) return null;
          const activeRail =
            rig.activeRail === 'front'
              ? rig.cameras.front
              : rig.activeRail === 'back'
                ? rig.cameras.back
                : rig.cameras.back ?? rig.cameras.front;
          const head = activeRail?.head ?? null;
          if (!head) return null;
          const position = head.getWorldPosition(new THREE.Vector3());
          const target =
            focusOverride?.clone?.() ??
            rig.userData?.focus?.clone?.() ??
            rig.defaultFocusWorld?.clone?.() ??
            rig.defaultFocus?.clone?.() ??
            null;
          if (target && Number.isFinite(minTargetY)) {
            target.y = Math.max(target.y ?? minTargetY, minTargetY);
          }
          return { position, target, fov: STANDING_VIEW_FOV, minTargetY };
        };

        const hasReplayCameraChanged = (previous, next) => {
          if (!next) return false;
          if (!previous) return true;
          const dist = (a, b) => {
            if (a && b && typeof a.distanceTo === 'function') return a.distanceTo(b);
            if (a && b) {
              const ax = Number.isFinite(a.x) ? a.x : 0;
              const ay = Number.isFinite(a.y) ? a.y : 0;
              const az = Number.isFinite(a.z) ? a.z : 0;
              const bx = Number.isFinite(b.x) ? b.x : 0;
              const by = Number.isFinite(b.y) ? b.y : 0;
              const bz = Number.isFinite(b.z) ? b.z : 0;
              return Math.hypot(ax - bx, ay - by, az - bz);
            }
            return Infinity;
          };
          const positionShift = dist(previous.position, next.position);
          const targetShift = dist(previous.target, next.target);
          const fovShift =
            Number.isFinite(previous.fov) && Number.isFinite(next.fov)
              ? Math.abs(previous.fov - next.fov)
              : 0;
          return (
            positionShift > REPLAY_CAMERA_SWITCH_THRESHOLD ||
            targetShift > REPLAY_CAMERA_SWITCH_THRESHOLD ||
            fovShift > 1e-3
          );
        };

        const resolveReplayCameraView = (replayFrameCamera, storedReplayCamera) => {
          const scale = Number.isFinite(worldScaleFactor) ? worldScaleFactor : WORLD_SCALE;
          const minTargetY = Math.max(baseSurfaceWorldY, BALL_CENTER_Y * scale);
          const fallbackTarget = storedReplayCamera?.target?.clone() ??
            new THREE.Vector3(playerOffsetRef.current * scale, minTargetY, 0);
          const fallbackPosition = storedReplayCamera?.position?.clone() ?? camera.position.clone();
          const fallbackFov = Number.isFinite(storedReplayCamera?.fov)
            ? storedReplayCamera.fov
            : camera.fov;
          const lerpVector = (a, b, t) => {
            if (!a && !b) return null;
            const start = a ?? b;
            const end = b ?? a;
            const startVec = start?.clone?.() ?? start;
            const endVec = end?.clone?.() ?? end;
            if (!startVec || !endVec || typeof startVec.lerp !== 'function') {
              return start ?? end ?? null;
            }
            return startVec.lerp(endVec, t);
          };
          const cameraA = replayFrameCamera?.frameA ?? replayFrameCamera?.frameB ?? null;
          const cameraB = replayFrameCamera?.frameB ?? cameraA;
          const alpha = THREE.MathUtils.clamp(replayFrameCamera?.alpha ?? 0, 0, 1);
          const position = lerpVector(cameraA?.position, cameraB?.position, alpha) ?? fallbackPosition;
          const target = lerpVector(cameraA?.target, cameraB?.target, alpha) ?? fallbackTarget;
          const fovA = Number.isFinite(cameraA?.fov) ? cameraA.fov : null;
          const fovB = Number.isFinite(cameraB?.fov) ? cameraB.fov : fovA;
          const resolvedFov = Number.isFinite(fovA) || Number.isFinite(fovB)
            ? THREE.MathUtils.lerp(fovA ?? fovB, fovB ?? fovA, alpha)
            : fallbackFov;
          return { position, target, fov: resolvedFov, minTargetY };
        };

        const updateCamera = () => {
          const replayPlaybackActive = Boolean(replayPlaybackRef.current);
          let renderCamera = camera;
          let lookTarget = null;
          let broadcastArgs = {
            railDir: 1,
            targetWorld: null,
            focusWorld: broadcastCamerasRef.current?.defaultFocusWorld ?? null,
            lerp: 0.18
          };
          const broadcastSystem =
            broadcastSystemRef.current ?? activeBroadcastSystem ?? null;
          if (broadcastSystem?.smoothing != null) {
            broadcastArgs.lerp = broadcastSystem.smoothing;
          }
          const cameraHoldActive =
            shooting &&
            powerImpactHoldRef.current &&
            performance.now() < powerImpactHoldRef.current;
          const galleryState = cueGalleryStateRef.current;
          if (replayPlaybackActive) {
            const storedReplayCamera = replayCameraRef.current;
            const scale = Number.isFinite(worldScaleFactor) ? worldScaleFactor : WORLD_SCALE;
            const resolvedReplayCamera = resolveReplayCameraView(
              replayFrameCameraRef.current,
              storedReplayCamera
            );
            const minTargetY = Math.max(
              baseSurfaceWorldY,
              Number.isFinite(resolvedReplayCamera?.minTargetY)
                ? resolvedReplayCamera.minTargetY
                : BALL_CENTER_Y * scale
            );
            const focusTarget =
              resolvedReplayCamera?.target?.clone?.() ??
              storedReplayCamera?.target?.clone?.() ??
              lastCameraTargetRef.current?.clone?.() ??
              new THREE.Vector3(playerOffsetRef.current * scale, minTargetY, 0);
            focusTarget.y = Math.max(focusTarget.y ?? 0, minTargetY);
            const safePosition =
              resolvedReplayCamera?.position?.clone?.() ??
              storedReplayCamera?.position?.clone?.() ??
              camera.position.clone();
            if (safePosition.y < minTargetY + CAMERA_CUE_SURFACE_MARGIN * scale) {
              safePosition.y = minTargetY + CAMERA_CUE_SURFACE_MARGIN * scale;
            }
            const replayFov = Number.isFinite(resolvedReplayCamera?.fov)
              ? resolvedReplayCamera.fov
              : Number.isFinite(storedReplayCamera?.fov)
                ? storedReplayCamera.fov
                : camera.fov;
            if (Number.isFinite(replayFov) && camera.fov !== replayFov) {
              camera.fov = replayFov;
              camera.updateProjectionMatrix();
            }
            camera.position.copy(safePosition);
            camera.lookAt(focusTarget);
            renderCamera = camera;
            lookTarget = focusTarget;
            broadcastArgs.focusWorld = focusTarget.clone();
            broadcastArgs.targetWorld = focusTarget.clone();
            broadcastArgs.lerp = 0;
          } else if (galleryState?.active) {
            const basePosition =
              galleryState.basePosition ?? galleryState.position ?? null;
            const baseTarget =
              galleryState.baseTarget ?? galleryState.target ?? null;
            const resolvedPosition = basePosition
              ? basePosition.clone()
              : new THREE.Vector3();
            const resolvedTarget = baseTarget
              ? baseTarget.clone()
              : new THREE.Vector3();
            const maxLateral = Math.max(galleryState.maxLateral ?? 0, 0);
            if (maxLateral > 0) {
              const clamped = THREE.MathUtils.clamp(
                galleryState.lateralOffset ?? 0,
                -maxLateral,
                maxLateral
              );
              if (clamped !== galleryState.lateralOffset) {
                galleryState.lateralOffset = clamped;
              }
              const right = galleryState.right;
              if (right && right.lengthSq() > 1e-6 && Math.abs(clamped) > 1e-6) {
                const offset = right.clone().multiplyScalar(clamped);
                resolvedPosition.add(offset);
                const focusScale = galleryState.lateralFocusScale ?? 0.35;
                resolvedTarget.add(offset.clone().multiplyScalar(focusScale));
              }
            }
            galleryState.position.copy(resolvedPosition);
            galleryState.target.copy(resolvedTarget);
            camera.position.copy(resolvedPosition);
            camera.lookAt(resolvedTarget);
            renderCamera = camera;
            lookTarget = resolvedTarget;
            broadcastArgs.focusWorld = resolvedTarget.clone();
            broadcastArgs.targetWorld = resolvedTarget.clone();
            broadcastArgs.lerp = 0.08;
          } else if (!cameraHoldActive && activeShotView?.mode === 'action') {
            const ballsList = ballsRef.current || [];
            const cueBall = ballsList.find((b) => b.id === activeShotView.cueId);
            if (!cueBall?.active) {
              activeShotView = null;
            } else {
              const now = performance.now();
              const lastUpdate = activeShotView.lastUpdate ?? now;
              const dt = Math.min(0.25, Math.max(0, (now - lastUpdate) / 1000));
              activeShotView.lastUpdate = now;
              const smoothTime =
                activeShotView.stage === 'followCue'
                  ? ACTION_CAM.followSmoothingTime
                  : ACTION_CAM.smoothingTime;
              const lerpT =
                smoothTime > 0
                  ? THREE.MathUtils.clamp(1 - Math.exp(-dt / smoothTime), 0, 1)
                  : 1;
              const cuePos2 = new THREE.Vector2(cueBall.pos.x, cueBall.pos.y);
              const cueAnchor = shooting
                ? activeShotView.startCuePos ?? cuePos2
                : cuePos2;
              let focusTargetVec3 = null;
              let desiredPosition = null;
              const axis = activeShotView.axis ?? 'short';
              let railDir = activeShotView.railDir;
              if (!Number.isFinite(railDir) || railDir === 0) {
                railDir =
                  axis === 'side'
                    ? signed(
                        cueBall.pos.x ??
                          cueBall.launchDir?.x ??
                          activeShotView.railNormal?.x ??
                          1
                      )
                    : signed(
                        cueBall.pos.y ??
                          cueBall.launchDir?.y ??
                          activeShotView.railNormal?.y ??
                          1
                      );
                activeShotView.railDir = railDir;
              }
              if (!activeShotView.hasSwitchedRail) {
                const cueMoving = cueBall.vel.lengthSq() > STOP_EPS * STOP_EPS;
                if (shooting || cueMoving) {
                  const fallbackRailDir =
                    axis === 'side'
                      ? signed(
                          cueBall.pos.x ??
                            cueBall.launchDir?.x ??
                            activeShotView.railNormal?.x ??
                            1,
                          1
                        )
                      : signed(
                          cueBall.pos.y ??
                            cueBall.launchDir?.y ??
                            activeShotView.railNormal?.y ??
                            1,
                          1
                        );
                  const currentDir = signed(railDir, fallbackRailDir);
                  railDir = -currentDir;
                  activeShotView.railDir = railDir;
                  activeShotView.hasSwitchedRail = true;
                }
              }
              const heightBase = TABLE_Y + TABLE.THICK;
              const standingPhi = STANDING_VIEW_PHI;
              if (activeShotView.stage === 'pair') {
                const targetBall =
                  activeShotView.targetId != null
                    ? ballsList.find((b) => b.id === activeShotView.targetId)
                    : null;
                let targetPos2;
                if (targetBall?.active) {
                  targetPos2 = new THREE.Vector2(targetBall.pos.x, targetBall.pos.y);
                  if (!shooting) {
                    activeShotView.targetLastPos = targetPos2.clone();
                  }
                } else if (activeShotView.targetLastPos) {
                  targetPos2 = activeShotView.targetLastPos.clone();
                } else {
                  targetPos2 = cueAnchor.clone().add(new THREE.Vector2(0, BALL_R * 6));
                }
                const targetAnchor =
                  shooting && activeShotView.targetInitialPos
                    ? activeShotView.targetInitialPos.clone()
                    : targetPos2;
                const mid = cueAnchor.clone().add(targetAnchor).multiplyScalar(0.5);
                const span = Math.max(targetAnchor.distanceTo(cueAnchor), BALL_R * 4);
                const forward = targetAnchor.clone().sub(cueAnchor);
                if (forward.lengthSq() < 1e-6) forward.set(0, 1);
                forward.normalize();
                const side = new THREE.Vector2(-forward.y, forward.x);
                const distance = THREE.MathUtils.clamp(
                  span * ACTION_CAM.pairDistanceScale + BALL_R * 8,
                  ACTION_CAM.pairMinDistance,
                  ACTION_CAM.pairMaxDistance
                );
                const offsetSide = side.multiplyScalar(distance * ACTION_CAM.sideBias);
                const offsetBack = forward.multiplyScalar(
                  -distance * ACTION_CAM.forwardBias
                );
                const anchor = new THREE.Vector3(
                  mid.x,
                  BALL_CENTER_Y + BALL_R * 0.3,
                  mid.y
                );
                if (axis === 'short') {
                  const lateralClamp = CAMERA_LATERAL_CLAMP.short;
                  const cueOffsetX = THREE.MathUtils.clamp(
                    anchor.x + offsetSide.x * 0.6 + offsetBack.x * 0.25,
                    -lateralClamp,
                    lateralClamp
                  );
                  const longShotPullback =
                    activeShotView.longShot ? LONG_SHOT_SHORT_RAIL_OFFSET : 0;
                  const heightLift =
                    activeShotView.longShot ? BALL_R * 2.5 : 0;
                  const baseDistance = computeShortRailBroadcastDistance(camera);
                  const pairFraming = computeShortRailPairFraming(
                    camera,
                    cuePos2,
                    targetPos2
                  );
                  const desiredDistance = Math.max(
                    baseDistance + longShotPullback,
                    pairFraming ? pairFraming.requiredDistance : 0
                  );
                  const desired = new THREE.Vector3(
                    0,
                    heightBase + ACTION_CAM.heightOffset + heightLift,
                    railDir * desiredDistance
                  );
                  const lookAnchor = anchor.clone();
                  if (activeShotView.longShot) {
                    lookAnchor.x = THREE.MathUtils.lerp(
                      lookAnchor.x,
                      0,
                      0.35
                    );
                  }
                  lookAnchor.x = THREE.MathUtils.lerp(lookAnchor.x, 0, 0.7);
                  const focusShiftSign = signed(
                    cueOffsetX,
                    signed(anchor.x, 1)
                  );
                  lookAnchor.x +=
                    focusShiftSign * BALL_R * (activeShotView.longShot ? 1.8 : 2.5);
                  let clampedZTarget = -railDir * BALL_R * (activeShotView.longShot ? 6.5 : 4);
                  if (pairFraming) {
                    const horizontalAllowance = Math.max(
                      0,
                      Math.tan(pairFraming.halfHorizontal) * desiredDistance -
                        pairFraming.halfWidth
                    );
                    const depthAllowance = Math.max(
                      0,
                      Math.tan(pairFraming.halfVertical) * desiredDistance -
                        pairFraming.halfLength
                    );
                    const minX = pairFraming.centerX - horizontalAllowance;
                    const maxX = pairFraming.centerX + horizontalAllowance;
                    lookAnchor.x = THREE.MathUtils.clamp(lookAnchor.x, minX, maxX);
                    const minZ = pairFraming.centerZ - depthAllowance;
                    const maxZ = pairFraming.centerZ + depthAllowance;
                    clampedZTarget = THREE.MathUtils.clamp(
                      clampedZTarget,
                      minZ,
                      maxZ
                    );
                  }
                  lookAnchor.z = THREE.MathUtils.lerp(
                    lookAnchor.z,
                    clampedZTarget,
                    0.65
                  );
                  applyStandingViewElevation(
                    desired,
                    lookAnchor,
                    heightBase,
                    standingPhi
                  );
                  focusTargetVec3 = lookAnchor.multiplyScalar(worldScaleFactor);
                  desiredPosition = desired.multiplyScalar(worldScaleFactor);
                } else {
                  const lateralClamp = CAMERA_LATERAL_CLAMP.side;
                  const baseZ = THREE.MathUtils.clamp(
                    anchor.z + offsetSide.y * 0.6 + offsetBack.y * 0.25,
                    -lateralClamp,
                    lateralClamp
                  );
                  const desired = new THREE.Vector3(
                    railDir * SIDE_RAIL_CAMERA_DISTANCE,
                    heightBase + ACTION_CAM.heightOffset,
                    baseZ
                  );
                  const lookAnchor = anchor.clone();
                  lookAnchor.x = THREE.MathUtils.lerp(lookAnchor.x, 0, 0.65);
                  lookAnchor.x += -railDir * BALL_R * 4;
                  lookAnchor.z = THREE.MathUtils.lerp(lookAnchor.z, baseZ, 0.4);
                  applyStandingViewElevation(
                    desired,
                    lookAnchor,
                    heightBase,
                    standingPhi
                  );
                  focusTargetVec3 = lookAnchor.multiplyScalar(worldScaleFactor);
                  desiredPosition = desired.multiplyScalar(worldScaleFactor);
                }
              } else {
                const cueVel = cueBall.vel.clone();
                let dir = cueVel.clone();
                if (dir.lengthSq() > 1e-6) {
                  dir.normalize();
                  activeShotView.lastCueDir = dir.clone();
                } else if (activeShotView.lastCueDir) {
                  dir.copy(activeShotView.lastCueDir);
                } else if (cueBall.launchDir) {
                  dir.copy(cueBall.launchDir.clone().normalize());
                  activeShotView.lastCueDir = dir.clone();
                } else {
                  dir.set(0, 1);
                }
                const lookAhead = activeShotView.cueLookAhead ?? BALL_R * 6;
                const anchor = new THREE.Vector3(
                  cueBall.pos.x + dir.x * lookAhead,
                  BALL_CENTER_Y + BALL_R * 0.3,
                  cueBall.pos.y + dir.y * lookAhead
                );
                const perp = new THREE.Vector2(-dir.y, dir.x);
                const distance = THREE.MathUtils.clamp(
                  ACTION_CAM.followDistance,
                  ACTION_CAM.pairMinDistance,
                  ACTION_CAM.pairMaxDistance
                );
                const lateral = perp.multiplyScalar(BALL_R * 6);
                if (axis === 'short') {
                  const lateralClamp = CAMERA_LATERAL_CLAMP.short;
                  const cueOffsetX = THREE.MathUtils.clamp(
                    anchor.x - dir.x * BALL_R * 6 + lateral.x,
                    -lateralClamp,
                    lateralClamp
                  );
                  const longShotPullback =
                    activeShotView.longShot ? LONG_SHOT_SHORT_RAIL_OFFSET : 0;
                  const heightLift =
                    activeShotView.longShot ? BALL_R * 2.2 : 0;
                  const baseDistance = computeShortRailBroadcastDistance(camera);
                  const cueFraming = computeShortRailPairFraming(camera, cuePos2);
                  const desiredDistance = Math.max(
                    baseDistance + longShotPullback,
                    cueFraming ? cueFraming.requiredDistance : 0
                  );
                  const desired = new THREE.Vector3(
                    0,
                    heightBase + ACTION_CAM.followHeightOffset + heightLift,
                    railDir * desiredDistance
                  );
                  const lookAnchor = anchor.clone();
                  if (activeShotView.longShot) {
                    lookAnchor.x = THREE.MathUtils.lerp(
                      lookAnchor.x,
                      0,
                      0.35
                    );
                  }
                  lookAnchor.x = THREE.MathUtils.lerp(lookAnchor.x, 0, 0.7);
                  const focusShiftSign = signed(
                    cueOffsetX,
                    signed(anchor.x, 1)
                  );
                  lookAnchor.x +=
                    focusShiftSign * BALL_R * (activeShotView.longShot ? 1.8 : 2.5);
                  let clampedZTarget = -railDir * BALL_R * (activeShotView.longShot ? 7.5 : 5);
                  if (cueFraming) {
                    const horizontalAllowance = Math.max(
                      0,
                      Math.tan(cueFraming.halfHorizontal) * desiredDistance -
                        cueFraming.halfWidth
                    );
                    const depthAllowance = Math.max(
                      0,
                      Math.tan(cueFraming.halfVertical) * desiredDistance -
                        cueFraming.halfLength
                    );
                    const minX = cueFraming.centerX - horizontalAllowance;
                    const maxX = cueFraming.centerX + horizontalAllowance;
                    lookAnchor.x = THREE.MathUtils.clamp(lookAnchor.x, minX, maxX);
                    const minZ = cueFraming.centerZ - depthAllowance;
                    const maxZ = cueFraming.centerZ + depthAllowance;
                    clampedZTarget = THREE.MathUtils.clamp(
                      clampedZTarget,
                      minZ,
                      maxZ
                    );
                  }
                  lookAnchor.z = THREE.MathUtils.lerp(
                    lookAnchor.z,
                    clampedZTarget,
                    0.65
                  );
                  applyStandingViewElevation(
                    desired,
                    lookAnchor,
                    heightBase,
                    standingPhi
                  );
                  focusTargetVec3 = lookAnchor.multiplyScalar(worldScaleFactor);
                  desiredPosition = desired.multiplyScalar(worldScaleFactor);
                } else {
                  const lateralClamp = CAMERA_LATERAL_CLAMP.side;
                  const baseZ = THREE.MathUtils.clamp(
                    anchor.z - dir.y * distance + lateral.y,
                    -lateralClamp,
                    lateralClamp
                  );
                  const desired = new THREE.Vector3(
                    railDir * SIDE_RAIL_CAMERA_DISTANCE,
                    heightBase + ACTION_CAM.followHeightOffset,
                    baseZ
                  );
                  const lookAnchor = anchor.clone();
                  lookAnchor.x = THREE.MathUtils.lerp(lookAnchor.x, 0, 0.65);
                  lookAnchor.x += -railDir * BALL_R * 4;
                  lookAnchor.z = THREE.MathUtils.lerp(lookAnchor.z, baseZ, 0.4);
                  applyStandingViewElevation(
                    desired,
                    lookAnchor,
                    heightBase,
                    standingPhi
                  );
                  focusTargetVec3 = lookAnchor.multiplyScalar(worldScaleFactor);
                  desiredPosition = desired.multiplyScalar(worldScaleFactor);
                }
              }
              const broadcastRailDir =
                activeShotView.axis === 'short'
                  ? resolveOppositeShortRailCamera({
                      cueBall,
                      fallback: Number.isFinite(railDir) && railDir !== 0 ? railDir : 1
                    })
                  : activeShotView.broadcastRailDir ?? railDir;
              activeShotView.broadcastRailDir = broadcastRailDir;
              broadcastArgs = {
                railDir: broadcastRailDir,
                targetWorld: null,
                focusWorld: broadcastCamerasRef.current?.defaultFocusWorld ?? null,
                orbitWorld: broadcastCamerasRef.current?.defaultFocusWorld ?? null,
                lerp: lerpT
              };
              if (activeShotView.preferRailOverhead) {
                const railReplayCamera = resolveRailOverheadReplayCamera({
                  focusOverride: focusTargetVec3 ?? lookTarget ?? broadcastArgs.focusWorld,
                  minTargetY: focusTargetVec3?.y ?? baseSurfaceWorldY
                });
                if (railReplayCamera) {
                  broadcastArgs.focusWorld =
                    railReplayCamera.target?.clone?.() ??
                    broadcastArgs.focusWorld ??
                    null;
                  broadcastArgs.targetWorld =
                    railReplayCamera.target?.clone?.() ??
                    broadcastArgs.targetWorld ??
                    null;
                  broadcastArgs.orbitWorld =
                    railReplayCamera.position?.clone?.() ??
                    broadcastArgs.orbitWorld ??
                    null;
                } else {
                  const defaultFocus =
                    broadcastCamerasRef.current?.defaultFocusWorld ??
                    broadcastArgs.focusWorld ??
                    null;
                  broadcastArgs.focusWorld = defaultFocus;
                  broadcastArgs.orbitWorld = defaultFocus;
                }
              }
              if (focusTargetVec3 && desiredPosition) {
                if (!activeShotView.smoothedPos) {
                  activeShotView.smoothedPos = desiredPosition.clone();
                } else {
                  activeShotView.smoothedPos.lerp(desiredPosition, lerpT);
                }
                if (!activeShotView.smoothedTarget) {
                  activeShotView.smoothedTarget = focusTargetVec3.clone();
                } else {
                  activeShotView.smoothedTarget.lerp(focusTargetVec3, lerpT);
                }
                camera.position.copy(activeShotView.smoothedPos);
                camera.lookAt(activeShotView.smoothedTarget);
                lookTarget = activeShotView.smoothedTarget;
                renderCamera = camera;
              }
            }
          } else if (!cameraHoldActive && activeShotView?.mode === 'pocket') {
            const ballsList = ballsRef.current || [];
            const focusBall = ballsList.find(
              (b) => b.id === activeShotView.ballId
            );
            if (focusBall?.active) {
              activeShotView.lastBallPos.set(
                focusBall.pos.x,
                focusBall.pos.y
              );
            }
            const pocketCenter = activeShotView.pocketCenter;
            const anchorType =
              activeShotView.anchorType ??
              (activeShotView.isSidePocket ? 'side' : 'short');
            let railDir =
              activeShotView.railDir ??
              (anchorType === 'side'
                ? signed(pocketCenter.x, 1)
                : signed(pocketCenter.y, 1));
            if (!Number.isFinite(activeShotView.railDir) || activeShotView.railDir === 0) {
              activeShotView.railDir = railDir;
            } else {
              railDir = activeShotView.railDir;
            }
            let broadcastRailDir =
              activeShotView.broadcastRailDir ?? (anchorType === 'side' ? null : railDir);
            const fallbackBroadcast = signed(
              activeShotView.lastBallPos?.y ?? pocketCenter.y ?? 0,
              broadcastRailDir ?? railDir ?? 1
            );
            if (anchorType === 'side') {
              const resolvedBroadcastRailDir =
                resolveShortRailBroadcastDirection({
                  pocketCenter: pocketCenter2D,
                  approachDir,
                  ballPos: activeShotView.lastBallPos,
                  ballVel: focusBall?.vel,
                  fallback: fallbackBroadcast
                });
              if (Number.isFinite(resolvedBroadcastRailDir)) {
                broadcastRailDir = resolvedBroadcastRailDir;
              }
            } else {
              broadcastRailDir = railDir;
            }
            activeShotView.broadcastRailDir = broadcastRailDir;
            broadcastArgs = {
              railDir: broadcastRailDir ?? railDir,
              targetWorld: null,
              focusWorld: broadcastCamerasRef.current?.defaultFocusWorld ?? null,
              lerp: 0.25
            };
            const heightScale =
              activeShotView.heightScale ?? POCKET_CAM.heightScale ?? 1;
            let approachDir = activeShotView.approach
              ? activeShotView.approach.clone()
              : new THREE.Vector2(0, -railDir);
            if (approachDir.lengthSq() < 1e-6) {
              approachDir.set(0, -railDir);
            }
            approachDir.normalize();
            if (activeShotView.approach) {
              activeShotView.approach.copy(approachDir);
            } else {
              activeShotView.approach = approachDir.clone();
            }
            const resolvedAnchorId = resolvePocketCameraAnchor(
              activeShotView.pocketId ?? pocketIdFromCenter(pocketCenter),
              pocketCenter,
              approachDir,
              activeShotView.lastBallPos ?? pocketCenter
            );
            const anchorId =
              resolvedAnchorId ??
              activeShotView.anchorId ??
              pocketIdFromCenter(pocketCenter);
            if (anchorId !== activeShotView.anchorId) {
              activeShotView.anchorId = anchorId;
              const latestOutward = getPocketCameraOutward(anchorId);
              if (latestOutward) {
                activeShotView.anchorOutward = latestOutward;
              }
            }
            let pocketCamEntry = getPocketCameraEntry(anchorId);
            const anchorCenter = getPocketCenterById(anchorId);
            const pocketCamera = pocketCamEntry
              ? pocketCamEntry.camera
              : ensurePocketCamera(anchorId, anchorCenter);
            if (!pocketCamEntry) {
              pocketCamEntry = getPocketCameraEntry(anchorId) ?? null;
            }
            const pocketCenter2D = pocketCenter.clone();
            const outward = activeShotView.anchorOutward
              ? activeShotView.anchorOutward.clone()
              : getPocketCameraOutward(anchorId) ?? pocketCenter2D.clone();
            if (outward.lengthSq() < 1e-6) {
              outward.set(
                anchorType === 'side' ? railDir : 0,
                anchorType === 'side' ? 0 : railDir
              );
            }
            outward.normalize();
            if (!activeShotView.anchorOutward) {
              activeShotView.anchorOutward = outward.clone();
            }
            const cameraBounds = cameraBoundsRef.current ?? null;
            const cueBounds = cameraBounds?.cueShot ?? null;
            const standingBounds = cameraBounds?.standing ?? null;
            const focusHeightLocal = BALL_CENTER_Y + BALL_R * 0.12;
            const focusTarget = new THREE.Vector3(0, focusHeightLocal, 0);
            const cueBallForPocket = ballsList.find((b) => b.id === 'cue');
            if (cueBallForPocket && focusBall?.active) {
              focusTarget.set(
                (cueBallForPocket.pos.x + focusBall.pos.x) * 0.5,
                focusHeightLocal,
                (cueBallForPocket.pos.y + focusBall.pos.y) * 0.5
              );
            }
            focusTarget.multiplyScalar(worldScaleFactor);
            if (POCKET_CAM.focusBlend > 0 && pocketCenter2D) {
              const focusBlend = THREE.MathUtils.clamp(
                POCKET_CAM.focusBlend,
                0,
                1
              );
              if (focusBlend > 0) {
                const pocketFocus = new THREE.Vector3(
                  pocketCenter2D.x * worldScaleFactor,
                  focusHeightLocal,
                  pocketCenter2D.y * worldScaleFactor
                );
                focusTarget.lerp(pocketFocus, focusBlend);
              }
            }
            if (POCKET_CAM.lateralFocusShift) {
              const lateral2D = new THREE.Vector2(-outward.y, outward.x);
              if (lateral2D.lengthSq() > 1e-6) {
                lateral2D.normalize().multiplyScalar(
                  POCKET_CAM.lateralFocusShift * worldScaleFactor
                );
                focusTarget.add(
                  new THREE.Vector3(lateral2D.x, 0, lateral2D.y)
                );
              }
            }
            if (
              anchorType === 'short' &&
              (POCKET_CAM.railFocusLong || POCKET_CAM.railFocusShort)
            ) {
              const signX =
                pocketCenter2D.x !== 0
                  ? Math.sign(pocketCenter2D.x)
                  : Math.sign(outward.x);
              const signZ =
                pocketCenter2D.y !== 0
                  ? Math.sign(pocketCenter2D.y)
                  : Math.sign(outward.y);
              const offsetX =
                (POCKET_CAM.railFocusLong ?? 0) * (signX ? -signX : 0);
              const offsetZ =
                (POCKET_CAM.railFocusShort ?? 0) * (signZ ? -signZ : 0);
              if (offsetX || offsetZ) {
                TMP_VEC3_A.set(
                  offsetX * worldScaleFactor,
                  0,
                  offsetZ * worldScaleFactor
                );
                focusTarget.add(TMP_VEC3_A);
              }
            }
            const pocketDirection2D = pocketCenter2D.clone();
            if (pocketDirection2D.lengthSq() < 1e-6) {
              pocketDirection2D.copy(outward.lengthSq() > 1e-6 ? outward : new THREE.Vector2(0, -1));
            }
            const azimuth = Math.atan2(pocketDirection2D.x, pocketDirection2D.y);
            const preferredRadius =
              Number.isFinite(activeShotView.cameraDistance) &&
              activeShotView.cameraDistance > 0
                ? activeShotView.cameraDistance
                : null;
            const baseRadius = (() => {
              const fallback = clamp(
                fitRadius(camera, STANDING_VIEW.margin),
                CAMERA.minR,
                CAMERA.maxR
              );
              const standingRadius = standingBounds?.radius ?? fallback;
              const pocketRadius = pocketDirection2D.length();
              const minOutside =
                anchorType === 'short'
                  ? POCKET_CAM.minOutsideShort ?? POCKET_CAM.minOutside
                  : POCKET_CAM.minOutside;
              const defaultRadius = Math.max(
                standingRadius,
                pocketRadius + minOutside
              );
              if (preferredRadius == null) return defaultRadius;
              return Math.max(preferredRadius, pocketRadius + minOutside);
            })();
            const cuePhi = cueBounds?.phi ?? CUE_VIEW_TARGET_PHI;
            const spherical = new THREE.Spherical(
              baseRadius * worldScaleFactor,
              cuePhi,
              azimuth
            );
            const desiredPosition = focusTarget
              .clone()
              .add(new THREE.Vector3().setFromSpherical(spherical));
            const outwardOffsetMagnitude =
              anchorType === 'short'
                ? POCKET_CAM.outwardOffsetShort ?? POCKET_CAM.outwardOffset
                : POCKET_CAM.outwardOffset;
            if (outwardOffsetMagnitude) {
              const outwardOffset = new THREE.Vector3(outward.x, 0, outward.y);
              if (outwardOffset.lengthSq() > 1e-6) {
                outwardOffset
                  .normalize()
                  .multiplyScalar(outwardOffsetMagnitude * worldScaleFactor);
                desiredPosition.add(outwardOffset);
              }
            }
            const minHeightWorld =
              (TABLE_Y + TABLE.THICK + activeShotView.heightOffset * heightScale) *
              worldScaleFactor;
            const loweredY =
              desiredPosition.y -
              (POCKET_CAM.heightDrop ?? 0) * worldScaleFactor;
            desiredPosition.y =
              loweredY < minHeightWorld ? minHeightWorld : loweredY;
            const now = performance.now();
            if (focusBall?.active) {
              activeShotView.completed = false;
              const extendTo = now + POCKET_VIEW_ACTIVE_EXTENSION_MS;
              activeShotView.holdUntil =
                activeShotView.holdUntil != null
                  ? Math.max(activeShotView.holdUntil, extendTo)
                  : extendTo;
            }
            const lastUpdate = activeShotView.lastUpdate ?? now;
            const dt = Math.min(0.2, Math.max(0, (now - lastUpdate) / 1000));
            activeShotView.lastUpdate = now;
            const smooth =
              POCKET_VIEW_SMOOTH_TIME > 0
                ? 1 - Math.exp(-dt / POCKET_VIEW_SMOOTH_TIME)
                : 1;
            const lerpT = THREE.MathUtils.clamp(smooth, 0, 1);
            if (!activeShotView.smoothedPos) {
              activeShotView.smoothedPos = desiredPosition.clone();
            } else {
              activeShotView.smoothedPos.lerp(desiredPosition, lerpT);
            }
            if (!activeShotView.smoothedTarget) {
              activeShotView.smoothedTarget = focusTarget.clone();
            } else {
              activeShotView.smoothedTarget.lerp(focusTarget, lerpT);
            }
            if (pocketCamera) {
              pocketCamera.position.copy(activeShotView.smoothedPos);
              pocketCamera.lookAt(activeShotView.smoothedTarget);
              pocketCamera.updateMatrixWorld();
              renderCamera = pocketCamera;
            }
            lookTarget = activeShotView.smoothedTarget;
          } else {
            const aimFocus =
              !shooting && cue?.active ? aimFocusRef.current : null;
            let focusTarget;
            if (
              aimFocus &&
              Number.isFinite(aimFocus.x) &&
              Number.isFinite(aimFocus.y) &&
              Number.isFinite(aimFocus.z)
            ) {
              focusTarget = aimFocus.clone();
            } else if (cue?.active && !shooting) {
              aimFocusRef.current = null;
              focusTarget = new THREE.Vector3(
                cue.pos.x,
                BALL_CENTER_Y,
                cue.pos.y
              );
            } else {
              aimFocusRef.current = null;
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
        if (topViewRef.current) {
          const topFocusTarget = TMP_VEC3_TOP_VIEW.set(
            playerOffsetRef.current + TOP_VIEW_SCREEN_OFFSET.x,
            ORBIT_FOCUS_BASE_Y,
            TOP_VIEW_SCREEN_OFFSET.z
          ).multiplyScalar(worldScaleFactor);
          const overheadVariant = overheadBroadcastVariantRef.current ?? 'top';
          const scale = Number.isFinite(worldScaleFactor) ? worldScaleFactor : WORLD_SCALE;
          const minTargetY = Math.max(baseSurfaceWorldY, BALL_CENTER_Y * scale);
          let overheadApplied = false;
          if (overheadVariant === 'replay') {
            const overheadCamera = resolveRailOverheadReplayCamera({
              focusOverride: topFocusTarget,
              minTargetY
            });
            if (overheadCamera?.position) {
              const resolvedTarget = overheadCamera.target ?? topFocusTarget;
              camera.up.set(0, 1, 0);
              camera.position.copy(overheadCamera.position);
              if (Number.isFinite(overheadCamera.fov) && camera.fov !== overheadCamera.fov) {
                camera.fov = overheadCamera.fov;
                camera.updateProjectionMatrix();
              }
              camera.lookAt(resolvedTarget);
              renderCamera = camera;
              lookTarget = resolvedTarget;
              lastCameraTargetRef.current.copy(resolvedTarget);
              broadcastArgs.focusWorld = resolvedTarget.clone();
              broadcastArgs.targetWorld = resolvedTarget.clone();
              broadcastArgs.orbitWorld = overheadCamera.position.clone();
              if (broadcastCamerasRef.current) {
                broadcastCamerasRef.current.defaultFocusWorld = resolvedTarget.clone();
              }
              broadcastArgs.lerp = 0.12;
              overheadApplied = true;
            }
          }
          if (!overheadApplied) {
            const topRadiusBase = fitRadius(camera, TOP_VIEW_MARGIN) * TOP_VIEW_RADIUS_SCALE;
            const topRadius = clampOrbitRadius(
              Math.max(topRadiusBase, CAMERA.minR * TOP_VIEW_MIN_RADIUS_SCALE)
            );
            const topTheta = Math.PI;
            const topPhi = TOP_VIEW_RESOLVED_PHI;
            TMP_SPH.set(topRadius, topPhi, topTheta);
            camera.up.set(0, 1, 0);
            camera.position.setFromSpherical(TMP_SPH);
            camera.position.add(topFocusTarget);
            const resolvedTarget = topFocusTarget.clone();
            const resolvedPosition = camera.position.clone();
            lookTarget = resolvedTarget;
            lastCameraTargetRef.current.copy(resolvedTarget);
            camera.updateProjectionMatrix();
            camera.lookAt(resolvedTarget);
            renderCamera = camera;
            broadcastArgs.focusWorld = resolvedTarget.clone();
            broadcastArgs.targetWorld = resolvedTarget.clone();
            broadcastArgs.orbitWorld = resolvedPosition.clone();
            if (broadcastCamerasRef.current) {
              broadcastCamerasRef.current.defaultFocusWorld = resolvedTarget.clone();
            }
            broadcastArgs.lerp = 0.12;
          }
        } else {
          camera.up.set(0, 1, 0);
          TMP_SPH.copy(sph);
          if (sidePocketAimRef.current && !shooting && !replayActive) {
            TMP_SPH.radius = clampOrbitRadius(
              TMP_SPH.radius * RAIL_OVERHEAD_AIM_ZOOM
            );
            TMP_SPH.phi = THREE.MathUtils.clamp(
              TMP_SPH.phi + RAIL_OVERHEAD_AIM_PHI_LIFT,
              CAMERA.minPhi,
              CAMERA.maxPhi - CAMERA_RAIL_SAFETY
            );
          }
          if (IN_HAND_CAMERA_RADIUS_MULTIPLIER > 1 && !replayActive) {
            const hudState = hudRef.current ?? null;
            if (hudState?.inHand && !shooting) {
              TMP_SPH.radius = clampOrbitRadius(
                TMP_SPH.radius * IN_HAND_CAMERA_RADIUS_MULTIPLIER
              );
            }
          }
          const aimLineWorldY =
            (AIM_LINE_MIN_Y + CAMERA_AIM_LINE_MARGIN) * worldScaleFactor;
          const scaleFactor = Number.isFinite(worldScaleFactor)
            ? worldScaleFactor
            : WORLD_SCALE;
          const surfaceMarginWorld =
            Math.max(0, CAMERA_SURFACE_STOP_MARGIN) * scaleFactor;
          const cueLevelWorldY =
            (CUE_Y + CAMERA_CUE_SURFACE_MARGIN) * scaleFactor;
          const surfaceClampY = Math.max(
            baseSurfaceWorldY + surfaceMarginWorld,
            cueLevelWorldY,
            aimLineWorldY
          );
          if (TMP_SPH.radius > 1e-6) {
            const minPhiFromSurface = Math.acos(
              THREE.MathUtils.clamp(
                (surfaceClampY - lookTarget.y) / TMP_SPH.radius,
                -1,
                1
              )
            );
            const surfaceSafePhi = Math.min(CAMERA.maxPhi, minPhiFromSurface);
            if (TMP_SPH.phi > surfaceSafePhi) {
              const correctedPhi = Math.max(CAMERA.minPhi, surfaceSafePhi);
              TMP_SPH.phi = correctedPhi;
              sph.phi = correctedPhi;
              syncBlendToSpherical();
            }

            const aimOffset = aimLineWorldY - lookTarget.y;
            if (aimOffset > 0) {
              const normalized = aimOffset / TMP_SPH.radius;
              let clampedPhi = TMP_SPH.phi;
              if (normalized >= 1) {
                clampedPhi = CAMERA.minPhi;
              } else {
                const limitPhi = Math.acos(
                  THREE.MathUtils.clamp(normalized, -1, 1)
                );
                const safePhi = Math.min(CAMERA.maxPhi, limitPhi);
                if (clampedPhi > safePhi) {
                  clampedPhi = Math.max(safePhi, CAMERA.minPhi);
                }
              }
              if (clampedPhi !== TMP_SPH.phi) {
                TMP_SPH.phi = clampedPhi;
                sph.phi = clampedPhi;
                syncBlendToSpherical();
              }
            }
          }
          camera.position.setFromSpherical(TMP_SPH).add(lookTarget);
          if (camera.position.y < surfaceClampY) {
            camera.position.y = surfaceClampY;
            TMP_VEC3_A.copy(camera.position).sub(lookTarget);
            const limitedRadius = TMP_VEC3_A.length();
            if (limitedRadius > 1e-6) {
              const normalizedY = THREE.MathUtils.clamp(
                TMP_VEC3_A.y / limitedRadius,
                -1,
                1
              );
              const correctedPhi = Math.acos(normalizedY);
              sph.radius = clampOrbitRadius(limitedRadius);
              sph.phi = THREE.MathUtils.clamp(
                correctedPhi,
                CAMERA.minPhi,
                CAMERA.maxPhi
              );
              TMP_SPH.radius = sph.radius;
              TMP_SPH.phi = sph.phi;
              syncBlendToSpherical();
            }
          }
          camera.lookAt(lookTarget);
          renderCamera = camera;
          broadcastArgs.focusWorld =
            broadcastCamerasRef.current?.defaultFocusWorld ?? lookTarget;
          broadcastArgs.targetWorld = null;
          broadcastArgs.lerp = 0.22;
        }
          }
          if (lookTarget) {
            lastCameraTargetRef.current.copy(lookTarget);
          }
          if (lookTarget && !broadcastArgs.orbitWorld) {
            broadcastArgs.orbitWorld = lookTarget.clone();
          }
          if (clothMat) {
            const repeat =
              clothMat.userData?.baseRepeat ??
              clothMat.userData?.nearRepeat ??
              clothMat.map?.repeat?.x ??
              1;
            const ratio =
              clothMat.userData?.repeatRatio ??
              (clothMat.map?.repeat?.x
                ? clothMat.map.repeat.y / clothMat.map.repeat.x
                : 1);
            const targetRepeat = repeat;
            const targetRepeatY = targetRepeat * ratio;
            if (
              clothMat.map &&
              (clothMat.map.repeat.x !== targetRepeat ||
                clothMat.map.repeat.y !== targetRepeatY)
            ) {
              clothMat.map.repeat.set(targetRepeat, targetRepeatY);
              clothMat.map.needsUpdate = true;
            }
            if (
              clothMat.normalMap &&
              (clothMat.normalMap.repeat.x !== targetRepeat ||
                clothMat.normalMap.repeat.y !== targetRepeatY)
            ) {
              clothMat.normalMap.repeat.set(targetRepeat, targetRepeatY);
              clothMat.normalMap.needsUpdate = true;
            }
            if (
              clothMat.bumpMap &&
              (clothMat.bumpMap.repeat.x !== targetRepeat ||
                clothMat.bumpMap.repeat.y !== targetRepeatY)
            ) {
              clothMat.bumpMap.repeat.set(targetRepeat, targetRepeatY);
              clothMat.bumpMap.needsUpdate = true;
            }
            if (
              clothMat.roughnessMap &&
              (clothMat.roughnessMap.repeat.x !== targetRepeat ||
                clothMat.roughnessMap.repeat.y !== targetRepeatY)
            ) {
              clothMat.roughnessMap.repeat.set(targetRepeat, targetRepeatY);
              clothMat.roughnessMap.needsUpdate = true;
            }
            if (
              Number.isFinite(clothMat.userData?.bumpScale) &&
              clothMat.bumpScale !== clothMat.userData.bumpScale
            ) {
              clothMat.bumpScale = clothMat.userData.bumpScale;
            }
          }
          updateBroadcastCameras(broadcastArgs);
          activeRenderCameraRef.current = renderCamera;
          return renderCamera;
        };
        const tweenCameraBlend = (
          targetBlend = cameraBlendRef.current ?? ACTION_CAMERA_START_BLEND,
          duration = 320
        ) => {
          cancelCameraBlendTween();
          const startBlend = cameraBlendRef.current ?? ACTION_CAMERA_START_BLEND;
          const endBlend = THREE.MathUtils.clamp(targetBlend ?? startBlend, 0, 1);
          const startTime = performance.now();
          const ease = (k) => k * k * (3 - 2 * k);
          const step = (now) => {
            const t = Math.min(1, (now - startTime) / Math.max(duration, 1));
            const eased = ease(t);
            applyCameraBlend(THREE.MathUtils.lerp(startBlend, endBlend, eased));
            updateCamera();
            if (t < 1) {
              cameraBlendTweenRef.current = requestAnimationFrame(step);
            } else {
              cameraBlendTweenRef.current = null;
            }
          };
          cameraBlendTweenRef.current = requestAnimationFrame(step);
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
          const orbitTargetY =
            orbitFocusRef.current?.target?.y ?? ORBIT_FOCUS_BASE_Y;
          const cueClearance = Math.max(
            0,
            CUE_Y + CAMERA_CUE_SURFACE_MARGIN - orbitTargetY
          );
          const cushionLimit = Math.max(
            TABLE.THICK * 0.5,
            (cushionHeightRef.current ?? TABLE.THICK) + CAMERA_CUSHION_CLEARANCE,
            cueClearance
          );
          const phiCap = Math.acos(
            THREE.MathUtils.clamp(cushionLimit / radius, -1, 1)
          );
          const safePhi = Math.min(phi, phiCap);
          lowViewSlideRef.current = 0;
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
        const resumeAfterPocket = (pocketView, now) => {
          updatePocketCameraState(false);
          const resumeAction =
            pocketView?.resumeAction?.mode === 'action'
              ? pocketView.resumeAction
              : suspendedActionView?.mode === 'action'
                ? suspendedActionView
                : null;
          if (resumeAction) {
            resumeAction.stage = 'pair';
            resumeAction.lastUpdate = now;
            resumeAction.holdUntil = now + ACTION_CAM.followHoldMs;
            resumeAction.pendingActivation = false;
            resumeAction.activationDelay = null;
            resumeAction.activationTravel = 0;
            if (cameraRef.current) {
              resumeAction.smoothedPos = cameraRef.current.position.clone();
              const storedTarget = lastCameraTargetRef.current?.clone();
              if (storedTarget) {
                resumeAction.smoothedTarget = storedTarget;
              }
            }
            activeShotView = resumeAction;
            suspendedActionView = null;
          } else {
            activeShotView = null;
            restoreOrbitCamera(pocketView);
          }
        };
        const makeActionCameraView = (
          cueBall,
          targetId,
          followView,
          railNormal,
          { longShot = false, travelDistance = 0 } = {}
        ) => {
          if (!cueBall) return null;
          const ballsList = ballsRef.current || [];
          const targetBall =
            targetId != null
              ? ballsList.find((b) => b.id === targetId) || null
              : null;
          const orbitSnapshot = followView?.orbitSnapshot
            ? {
                radius: followView.orbitSnapshot.radius,
                phi: followView.orbitSnapshot.phi,
                theta: followView.orbitSnapshot.theta
              }
            : null;
          const nearRailThresholdX = RAIL_LIMIT_X - RAIL_NEAR_BUFFER;
          const nearRailThresholdY = RAIL_LIMIT_Y - RAIL_NEAR_BUFFER;
          const cueNearRail =
            Math.abs(cueBall.pos.x) > nearRailThresholdX ||
            Math.abs(cueBall.pos.y) > nearRailThresholdY;
          const targetNearRail = targetBall
            ? Math.abs(targetBall.pos.x) > nearRailThresholdX ||
              Math.abs(targetBall.pos.y) > nearRailThresholdY
            : false;
          const axis = 'short'; // force short-rail broadcast framing
          const shortRailDir = signed(
            cueBall.pos.y ?? cueBall.launchDir?.y ?? railNormal?.y ?? 1
          );
          const initialRailDir = resolveOppositeShortRailCamera({
            cueBall,
            fallback: shortRailDir
          });
          const preferRailOverhead = Boolean(railNormal);
          const now = performance.now();
          const activationDelay = longShot
            ? now + LONG_SHOT_ACTIVATION_DELAY_MS
            : null;
          const activationTravel = longShot
            ? Math.max(
                BALL_R * 12,
                Math.min(travelDistance * 0.5, LONG_SHOT_ACTIVATION_TRAVEL)
              )
            : 0;
          return {
            mode: 'action',
            cueId: cueBall.id,
            targetId: targetId ?? null,
            stage: 'pair',
            exitAfterHold: false,
            resume: followView ?? null,
            orbitSnapshot,
            lastUpdate: now,
            smoothedPos: null,
            smoothedTarget: null,
            targetLastPos: targetBall
              ? new THREE.Vector2(targetBall.pos.x, targetBall.pos.y)
              : null,
            holdUntil: null,
            hitConfirmed: false,
            lastCueDir: cueBall.vel.clone(),
            cueLookAhead: longShot ? BALL_R * 9 : BALL_R * 6,
            axis,
            railDir: initialRailDir,
            broadcastRailDir: initialRailDir,
            hasSwitchedRail: true,
            railNormal: railNormal ? railNormal.clone() : null,
            preferRailOverhead,
            longShot,
            travelDistance,
            activationDelay,
            activationTravel,
            pendingActivation: longShot,
            startCuePos: new THREE.Vector2(cueBall.pos.x, cueBall.pos.y),
            targetInitialPos: targetBall
              ? new THREE.Vector2(targetBall.pos.x, targetBall.pos.y)
              : null
          };
        };
        const makePocketCameraView = (ballId, followView, options = {}) => {
          if (!followView) return null;
          const { forceEarly = false } = options;
          if (shotPrediction?.railNormal) return null;
          if (forceEarly && shotPrediction?.ballId !== ballId) return null;
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
          const predictedAlignment =
            shotPrediction?.ballId === ballId && shotPrediction?.dir
              ? shotPrediction.dir.clone().normalize().dot(best.pocketDir)
              : null;
          const isGuaranteedPocket =
            shotPrediction?.ballId === ballId &&
            predictedAlignment != null &&
            predictedAlignment >= POCKET_GUARANTEED_ALIGNMENT;
          if (!isGuaranteedPocket) return null;
          const predictedTravelForBall =
            shotPrediction?.ballId === ballId
              ? shotPrediction?.travel ?? null
              : null;
          if (
            (predictedTravelForBall != null &&
              predictedTravelForBall < SHORT_SHOT_CAMERA_DISTANCE) ||
            best.dist < SHORT_SHOT_CAMERA_DISTANCE
          ) {
            return null;
          }
          const anchorPocketId = pocketIdFromCenter(best.center);
          const approachDir = best.pocketDir.clone();
          const anchorId = resolvePocketCameraAnchor(
            anchorPocketId,
            best.center,
            approachDir,
            pos
          );
          const anchorOutward = getPocketCameraOutward(anchorId);
          const isSidePocket = anchorPocketId === 'TM' || anchorPocketId === 'BM';
          const forcedEarly = forceEarly && shotPrediction?.ballId === ballId;
          if (best.dist > POCKET_CAM.triggerDist && !forcedEarly) return null;
          const baseHeightOffset = POCKET_CAM.heightOffset;
          const shortPocketHeightMultiplier =
            POCKET_CAM.heightOffsetShortMultiplier ?? 1;
          const heightOffset = isSidePocket
            ? baseHeightOffset * 0.92
            : baseHeightOffset * shortPocketHeightMultiplier;
          const railDir = isSidePocket
            ? signed(best.center.x, 1)
            : signed(best.center.y, 1);
          const lateralSign = isSidePocket
            ? signed(best.center.y, 1)
            : signed(best.center.x, 1);
          const fallbackOutward = isSidePocket
            ? new THREE.Vector2(-railDir, -lateralSign * 0.45).normalize()
            : new THREE.Vector2(-lateralSign * 0.45, -railDir).normalize();
          const resumeOrbit = followView?.orbitSnapshot
            ? {
                radius: followView.orbitSnapshot.radius,
                phi: followView.orbitSnapshot.phi,
                theta: followView.orbitSnapshot.theta
              }
            : null;
          const now = performance.now();
          const effectiveDist = forcedEarly
            ? Math.min(best.dist, POCKET_CAM.triggerDist)
            : best.dist;
          const minOutside = isSidePocket
            ? POCKET_CAM.minOutside
            : POCKET_CAM.minOutsideShort ?? POCKET_CAM.minOutside;
          const cameraDistance = THREE.MathUtils.clamp(
            effectiveDist * POCKET_CAM.distanceScale,
            minOutside,
            POCKET_CAM.maxOutside
          );
          const broadcastRailDir = isSidePocket
            ? resolveShortRailBroadcastDirection({
                pocketCenter: best.center,
                approachDir,
                ballPos: pos,
                ballVel: dir,
                fallback: signed(pos.y, 1)
              })
            : railDir;
          return {
            mode: 'pocket',
            ballId,
            pocketId: anchorPocketId,
            pocketCenter: best.center.clone(),
            approach: approachDir,
            heightOffset,
            heightScale: POCKET_CAM.heightScale,
            lastBallPos: pos.clone(),
            score: bestScore,
            resume: followView,
            resumeOrbit,
            startedAt: now,
            holdUntil: now + POCKET_VIEW_MIN_DURATION_MS,
            completed: false,
            isSidePocket,
            anchorType: isSidePocket ? 'side' : 'short',
            railDir,
            broadcastRailDir,
            anchorId: anchorId ?? anchorPocketId,
            anchorOutward:
              anchorOutward?.normalize() ?? fallbackOutward,
            cameraDistance,
            lastRailHitAt: targetBall.lastRailHitAt ?? null,
            lastRailHitType: targetBall.lastRailHitType ?? null,
            predictedAlignment,
            forcedEarly
          };
        };
        const fit = (m = STANDING_VIEW.margin) => {
          camera.aspect = host.clientWidth / host.clientHeight;
          const aspect = camera.aspect;
          const zoomProfile = resolveCameraZoomProfile(aspect);
          const standingRadiusRaw = fitRadius(
            camera,
            Math.max(m * zoomProfile.margin, 1e-4)
          );
          const cueBase = clampOrbitRadius(BREAK_VIEW.radius);
          const playerRadiusBase = Math.max(standingRadiusRaw, cueBase);
          const shouldApplyBroadcastPullIn = aspect >= 1;
          const broadcastBaseRadius = shouldApplyBroadcastPullIn
            ? Math.max(
                standingRadiusRaw,
                playerRadiusBase * BROADCAST_DISTANCE_MULTIPLIER
              )
            : playerRadiusBase;
          const baseBroadcastRadius =
            broadcastBaseRadius + BROADCAST_RADIUS_PADDING;
          const baseStandingRadius = Math.max(
            standingRadiusRaw,
            baseBroadcastRadius
          );
          const standingRadius = clamp(
            Math.max(
              standingRadiusRaw,
              baseStandingRadius * zoomProfile.broadcast
            ),
            CAMERA.minR,
            CAMERA.maxR
          );
          const standingPhi = THREE.MathUtils.clamp(
            STANDING_VIEW.phi,
            CAMERA.minPhi,
            CAMERA.maxPhi - CAMERA_RAIL_SAFETY
          );
          const cueRadiusBase = Math.max(
            playerRadiusBase * CUE_VIEW_RADIUS_RATIO,
            CUE_VIEW_MIN_RADIUS
          );
          const cueRadius = clampOrbitRadius(
            Math.max(CUE_VIEW_MIN_RADIUS, cueRadiusBase * zoomProfile.cue),
            CUE_VIEW_MIN_RADIUS
          );
          const cuePhi = THREE.MathUtils.clamp(
            CUE_VIEW_MIN_PHI + CUE_VIEW_PHI_LIFT * 0.5,
            CAMERA.minPhi,
            CAMERA.maxPhi - CAMERA_RAIL_SAFETY
          );
          cameraBoundsRef.current = {
            cueShot: { phi: cuePhi, radius: cueRadius },
            standing: { phi: standingPhi, radius: standingRadius }
          };
        applyCameraBlend();
        orbitRadiusLimitRef.current = standingRadius;
        const orbitTargetY =
          orbitFocusRef.current?.target?.y ?? ORBIT_FOCUS_BASE_Y;
          const cueClearance = Math.max(
            0,
            CUE_Y + CAMERA_CUE_SURFACE_MARGIN - orbitTargetY
          );
          const cushionLimit = Math.max(
            TABLE.THICK * 0.5,
            (cushionHeightRef.current ?? TABLE.THICK) + CAMERA_CUSHION_CLEARANCE,
            cueClearance
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
        topViewLockedRef.current = false;
        const margin = Math.max(
          STANDING_VIEW.margin,
          topViewRef.current
            ? TOP_VIEW_MARGIN
            : window.innerHeight > window.innerWidth
              ? STANDING_VIEW_MARGIN_PORTRAIT
              : STANDING_VIEW_MARGIN_LANDSCAPE
        );
        fit(margin);
        applyWorldScaleRef.current = () => {
          const changed = applyWorldScale();
          if (changed) {
            const nextMargin = Math.max(
              STANDING_VIEW.margin,
              topViewRef.current
                ? TOP_VIEW_MARGIN
                : window.innerHeight > window.innerWidth
                  ? STANDING_VIEW_MARGIN_PORTRAIT
                  : STANDING_VIEW_MARGIN_LANDSCAPE
            );
            fit(nextMargin);
            updateCamera();
          }
          return changed;
        };
        syncBlendToSpherical();
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
        let replayTrail;

        const captureBallSnapshot = () =>
          balls.map((ball) => ({
            id: ball.id,
            active: ball.active,
            pos: { x: ball.pos.x, y: ball.pos.y },
            mesh: ball.mesh
              ? {
                  position: serializeVector3Snapshot(ball.mesh.position, {
                    x: ball.pos.x,
                    y: BALL_CENTER_Y,
                    z: ball.pos.y
                  }),
                  quaternion: serializeQuaternionSnapshot(ball.mesh.quaternion),
                  scale: serializeVector3Snapshot(ball.mesh.scale, {
                    x: 1,
                    y: 1,
                    z: 1
                  }),
                  visible: ball.mesh.visible
                }
              : null
          }));

        const captureReplayCameraSnapshot = () => {
          const scale = Number.isFinite(worldScaleFactor) ? worldScaleFactor : WORLD_SCALE;
          const minTargetY = Math.max(baseSurfaceWorldY, BALL_CENTER_Y * scale);
          const fallbackCamera = activeRenderCameraRef.current ?? camera;
          const fovSnapshot = Number.isFinite(fallbackCamera?.fov)
            ? fallbackCamera.fov
            : camera.fov;
          const targetSnapshot = lastCameraTargetRef.current
            ? lastCameraTargetRef.current.clone()
            : broadcastCamerasRef.current?.defaultFocusWorld?.clone?.() ?? null;
          const overheadCamera = resolveRailOverheadReplayCamera({
            focusOverride: targetSnapshot,
            minTargetY
          });
          const resolvedPosition = overheadCamera?.position?.clone?.() ??
            fallbackCamera?.position?.clone?.() ?? null;
          const resolvedTarget = overheadCamera?.target?.clone?.() ?? targetSnapshot;
          const resolvedFov = Number.isFinite(overheadCamera?.fov)
            ? overheadCamera.fov
            : fovSnapshot;
          if (!resolvedPosition && !resolvedTarget) return null;
          const snapshot = {
            position: resolvedPosition,
            target: resolvedTarget,
            fov: resolvedFov
          };
          if (Number.isFinite(overheadCamera?.minTargetY)) {
            snapshot.minTargetY = overheadCamera.minTargetY;
          }
          return snapshot;
        };
        captureReplayCameraSnapshotRef.current = captureReplayCameraSnapshot;

        const applyBallSnapshot = (snapshot) => {
          if (!Array.isArray(snapshot)) return;
          const map = new Map(snapshot.map((entry) => [entry.id, entry]));
          balls.forEach((ball) => {
            const state = map.get(ball.id);
            if (!state) return;
            ball.active = state.active;
            if (ball.vel) ball.vel.set(0, 0);
            if (ball.spin) ball.spin.set(0, 0);
            if (ball.pendingSpin) ball.pendingSpin.set(0, 0);
            ball.impacted = false;
            ball.launchDir = null;
            ball.pos.set(state.pos.x, state.pos.y);
            const meshState = state.mesh;
            if (ball.mesh && meshState) {
              const position = normalizeVector3Snapshot(meshState.position);
              if (position) {
                ball.mesh.position.set(position.x, position.y, position.z);
              }
              const quaternion = normalizeQuaternionSnapshot(meshState.quaternion);
              if (quaternion) {
                ball.mesh.quaternion.set(
                  quaternion.x,
                  quaternion.y,
                  quaternion.z,
                  quaternion.w
                );
              }
              const scale = normalizeVector3Snapshot(meshState.scale);
              if (scale) {
                ball.mesh.scale.set(scale.x, scale.y, scale.z);
              }
              if (meshState.visible != null) ball.mesh.visible = meshState.visible;
            }
          });
        };

        captureBallSnapshotRef.current = captureBallSnapshot;
        applyBallSnapshotRef.current = (snapshot) => {
          applyBallSnapshot(snapshot);
        };
        if (pendingLayoutRef.current) {
          applyBallSnapshotRef.current(pendingLayoutRef.current);
          pendingLayoutRef.current = null;
        }

        const recordReplayFrame = (timestamp) => {
          if (!shotRecording) return;
          const start = shotRecording.startTime ?? timestamp;
          if (shotRecording.startTime == null) {
            shotRecording.startTime = timestamp;
          }
          const relative = Math.max(0, timestamp - start);
          const snapshot = captureBallSnapshot();
          const cameraSnapshot = captureReplayCameraSnapshot();
          shotRecording.frames.push({
            t: relative,
            balls: snapshot,
            camera: cameraSnapshot
          });
          const cueBall = balls.find((b) => b.id === 'cue');
          if (cueBall?.mesh) {
            const cuePos = cueBall.mesh.position.clone();
            cuePos.y = REPLAY_TRAIL_HEIGHT;
            const last = shotRecording.cuePath[shotRecording.cuePath.length - 1];
            if (!last || last.pos.distanceTo(cuePos) > 1e-3) {
              shotRecording.cuePath.push({ t: relative, pos: cuePos });
            }
          }
        };

        const applyReplayFrame = (frameA, frameB, alpha) => {
          if (!frameA) return;
          const aMap = new Map(frameA.balls.map((entry) => [entry.id, entry]));
          const bMap = frameB ? new Map(frameB.balls.map((entry) => [entry.id, entry])) : null;
          balls.forEach((ball) => {
            const aState = aMap.get(ball.id);
            if (!aState) return;
            const bState = bMap?.get(ball.id) ?? aState;
            const posA = aState.pos ?? { x: ball.pos.x, y: ball.pos.y };
            const posB = bState?.pos ?? posA;
            const posX = THREE.MathUtils.lerp(posA.x, posB.x, alpha);
            const posY = THREE.MathUtils.lerp(posA.y, posB.y, alpha);
            ball.pos.set(posX, posY);
            if (ball.vel) ball.vel.set(0, 0);
            if (ball.spin) ball.spin.set(0, 0);
            if (ball.pendingSpin) ball.pendingSpin.set(0, 0);
            ball.impacted = false;
            ball.launchDir = null;
            const meshA = aState.mesh ?? {};
            const meshB = bState?.mesh ?? meshA;
            if (ball.mesh) {
              const fallbackPos = { x: posX, y: REPLAY_TRAIL_HEIGHT, z: posY };
              const posA3 = normalizeVector3Snapshot(meshA.position, fallbackPos);
              const posB3 = normalizeVector3Snapshot(meshB.position, posA3 ?? fallbackPos);
              if (posA3 && posB3) {
                tmpReplayPos.set(
                  THREE.MathUtils.lerp(posA3.x, posB3.x, alpha),
                  THREE.MathUtils.lerp(posA3.y, posB3.y, alpha),
                  THREE.MathUtils.lerp(posA3.z, posB3.z, alpha)
                );
                ball.mesh.position.copy(tmpReplayPos);
              }
              const quatA = normalizeQuaternionSnapshot(meshA.quaternion);
              const quatB = normalizeQuaternionSnapshot(
                meshB.quaternion ?? meshA.quaternion,
                quatA
              );
              if (quatA && quatB) {
                tmpReplayQuat.set(quatA.x, quatA.y, quatA.z, quatA.w);
                tmpReplayQuatB.set(quatB.x, quatB.y, quatB.z, quatB.w);
                tmpReplayQuat.slerp(tmpReplayQuatB, alpha);
                ball.mesh.quaternion.copy(tmpReplayQuat);
              } else if (quatA) {
                ball.mesh.quaternion.set(quatA.x, quatA.y, quatA.z, quatA.w);
              }
              const scaleA = normalizeVector3Snapshot(meshA.scale);
              const scaleB = normalizeVector3Snapshot(
                meshB.scale ?? meshA.scale,
                scaleA
              );
              if (scaleA && scaleB) {
                tmpReplayScale.set(
                  THREE.MathUtils.lerp(scaleA.x, scaleB.x, alpha),
                  THREE.MathUtils.lerp(scaleA.y, scaleB.y, alpha),
                  THREE.MathUtils.lerp(scaleA.z, scaleB.z, alpha)
                );
                ball.mesh.scale.copy(tmpReplayScale);
              } else if (scaleA) {
                ball.mesh.scale.set(scaleA.x, scaleA.y, scaleA.z);
              }
              if (meshB.visible != null) {
                ball.mesh.visible = meshB.visible;
              }
            }
            if (ball.shadow) {
              ball.shadow.visible = ball.mesh?.visible ?? ball.shadow.visible;
              ball.shadow.position.set(posX, BALL_SHADOW_Y, posY);
              const shadowScale = ball.mesh?.scale?.x ?? 1;
              ball.shadow.scale.setScalar(shadowScale);
              if (ball.shadow.material) {
                ball.shadow.material.opacity = BALL_SHADOW_OPACITY;
              }
            }
          });
        };

        const applyReplayCueStroke = (playback, targetTime) => {
          const stroke = playback?.cueStroke;
          if (!stroke || !cueStick) {
            if (cueStick) cueStick.visible = false;
            cueAnimating = false;
            return;
          }
          const warmupSnap =
            normalizeVector3Snapshot(stroke.warmup, stroke.start) ??
            normalizeVector3Snapshot(stroke.start);
          const startSnap = normalizeVector3Snapshot(stroke.start, warmupSnap);
          const impactSnap = normalizeVector3Snapshot(stroke.impact, startSnap);
          const settleSnap = normalizeVector3Snapshot(stroke.settle, impactSnap);
          if (!warmupSnap || !startSnap || !impactSnap || !settleSnap) {
            cueStick.visible = false;
            cueAnimating = false;
            return;
          }
          const pullback = Math.max(0, stroke.pullback ?? stroke.pullbackDuration ?? 0);
          const forward = Math.max(1e-6, stroke.forward ?? stroke.forwardDuration ?? 0);
          const settleTime = Math.max(0, stroke.settleTime ?? stroke.settleDuration ?? 0);
          const startOffset = Math.max(0, stroke.startOffset ?? 0);
          const localTime = targetTime - startOffset;
          const pullEnd = pullback;
          const impactEnd = pullEnd + forward;
          const settleEnd = impactEnd + settleTime;
          tmpReplayCueA.set(warmupSnap.x, warmupSnap.y, warmupSnap.z);
          tmpReplayCueB.set(startSnap.x, startSnap.y, startSnap.z);
          cueStick.rotation.y = Number.isFinite(stroke.rotationY)
            ? stroke.rotationY
            : cueStick.rotation.y;
          cueStick.rotation.x = Number.isFinite(stroke.rotationX)
            ? stroke.rotationX
            : cueStick.rotation.x;
          cueStick.visible = true;
          cueAnimating = true;
          if (localTime <= 0) {
            cueStick.position.copy(tmpReplayCueA);
            return;
          }
          if (localTime <= pullEnd && pullback > 0) {
            const t = THREE.MathUtils.clamp(localTime / Math.max(pullback, 1e-6), 0, 1);
            cueStick.position.lerpVectors(tmpReplayCueA, tmpReplayCueB, t);
            return;
          }
          if (localTime <= impactEnd) {
            const t = THREE.MathUtils.clamp(
              (localTime - pullEnd) / Math.max(forward, 1e-6),
              0,
              1
            );
            tmpReplayCueA.copy(tmpReplayCueB);
            tmpReplayCueB.set(impactSnap.x, impactSnap.y, impactSnap.z);
            cueStick.position.lerpVectors(tmpReplayCueA, tmpReplayCueB, t);
            return;
          }
          if (localTime <= settleEnd && settleTime > 0) {
            const t = THREE.MathUtils.clamp(
              (localTime - impactEnd) / Math.max(settleTime, 1e-6),
              0,
              1
            );
            tmpReplayCueA.set(impactSnap.x, impactSnap.y, impactSnap.z);
            tmpReplayCueB.set(settleSnap.x, settleSnap.y, settleSnap.z);
            cueStick.visible = true;
            cueStick.position.lerpVectors(tmpReplayCueA, tmpReplayCueB, t);
            return;
          }
          cueStick.visible = false;
          cueAnimating = false;
        };

        const updateReplayTrail = (cuePath, targetTime) => {
          if (!cuePath || cuePath.length === 0) {
            replayTrail.visible = false;
            return;
          }
          const points = [];
          let previous = cuePath[0];
          for (let i = 0; i < cuePath.length; i++) {
            const entry = cuePath[i];
            if (entry.t > targetTime) {
              if (previous) {
                const span = Math.max(entry.t - previous.t, 1e-6);
                const t = THREE.MathUtils.clamp((targetTime - previous.t) / span, 0, 1);
                points.push(previous.pos.clone());
                points.push(previous.pos.clone().lerp(entry.pos, t));
              }
              break;
            }
            points.push(entry.pos.clone());
            previous = entry;
          }
          if (points.length < 2) {
            replayTrail.visible = false;
            return;
          }
          points.forEach((pt) => {
            pt.y = REPLAY_TRAIL_HEIGHT;
          });
          replayTrail.geometry.setFromPoints(points);
          replayTrail.visible = true;
        };

        const trimReplayRecording = (recording) => {
          const frames = recording?.frames ?? [];
          const cuePath = recording?.cuePath ?? [];
          const cueStrokeRaw = recording?.cueStroke ?? null;
          const normalizeStrokeVec = (value) =>
            normalizeVector3Snapshot(value, { x: 0, y: BALL_CENTER_Y, z: 0 });
          const cueStroke = cueStrokeRaw
            ? {
                warmup: normalizeStrokeVec(cueStrokeRaw.warmup),
                start: normalizeStrokeVec(cueStrokeRaw.start ?? cueStrokeRaw.warmup),
                impact: normalizeStrokeVec(cueStrokeRaw.impact ?? cueStrokeRaw.start),
                settle: normalizeStrokeVec(cueStrokeRaw.settle ?? cueStrokeRaw.impact),
                rotationX: Number.isFinite(cueStrokeRaw.rotationX) ? cueStrokeRaw.rotationX : 0,
                rotationY: Number.isFinite(cueStrokeRaw.rotationY) ? cueStrokeRaw.rotationY : 0,
                pullback: Math.max(0, cueStrokeRaw.pullbackDuration ?? cueStrokeRaw.pullback ?? 0),
                forward: Math.max(0, cueStrokeRaw.forwardDuration ?? cueStrokeRaw.forward ?? 0),
                settleTime: Math.max(
                  0,
                  cueStrokeRaw.settleDuration ?? cueStrokeRaw.settleTime ?? 0
                ),
                startOffset: Math.max(0, cueStrokeRaw.startOffset ?? 0)
              }
            : null;
          if (frames.length === 0) return { frames, cuePath, duration: 0, cueStroke };
          const duration = frames[frames.length - 1]?.t ?? 0;
          return { frames, cuePath, duration, cueStroke };
        };

        const storeReplayCameraFrame = () => {
          const activeCamera = activeRenderCameraRef.current ?? camera;
          const storedTarget =
            lastCameraTargetRef.current?.clone() ??
            new THREE.Vector3(playerOffsetRef.current, ORBIT_FOCUS_BASE_Y, 0);
          const scale = Number.isFinite(worldScaleFactor) ? worldScaleFactor : WORLD_SCALE;
          const minTargetY = Math.max(baseSurfaceWorldY, BALL_CENTER_Y * scale);
          storedTarget.y = Math.max(storedTarget.y ?? 0, minTargetY);
          const storedPosition = activeCamera?.position?.clone?.() ?? null;
          if (storedPosition && storedPosition.y < minTargetY) {
            storedPosition.y = minTargetY;
          }
          const storedFov = Number.isFinite(activeCamera?.fov)
            ? activeCamera.fov
            : camera.fov;
          replayCameraRef.current = {
            position: storedPosition,
            target: storedTarget,
            fov: storedFov,
            restoreFov: camera?.fov
          };
        };

        const resetCameraForReplay = () => {
          lookModeRef.current = false;
          topViewRef.current = false;
          topViewLockedRef.current = false;
          setIsTopDownView(false);
          setOrbitFocusToDefault();
          applyCameraBlend(1);
          syncBlendToSpherical();
          updateCamera();
        };

        const startShotReplay = (postShotSnapshot) => {
          if (replayPlaybackRef.current) return;
          if (!shotRecording || !shotRecording.frames?.length) return;
          const trimmed = trimReplayRecording(shotRecording);
          const duration = trimmed.duration;
          if (!Number.isFinite(duration) || duration <= 0) return;
          setReplayActive(true);
          storeReplayCameraFrame();
          resetCameraForReplay();
          replayPlayback = {
            frames: trimmed.frames,
            cuePath: trimmed.cuePath,
            cueStroke: trimmed.cueStroke ?? null,
            duration,
            startedAt: performance.now(),
            lastIndex: 0,
            postState: postShotSnapshot,
            pocketDrops: pausedPocketDrops ?? pocketDropRef.current
          };
          pausedPocketDrops = pocketDropRef.current;
          pocketDropRef.current = new Map();
          replayPlaybackRef.current = replayPlayback;
          lastReplayFrameAt = 0;
          shotReplayRef.current = shotRecording;
          applyBallSnapshot(shotRecording.startState ?? []);
          updateReplayTrail(replayPlayback.cuePath, 0);
          const path = replayPlayback.cuePath ?? [];
          if (!LOCK_REPLAY_CAMERA && path.length > 0) {
            const start = path[0]?.pos ?? null;
            const end = path[path.length - 1]?.pos ?? start;
            if (start && end) {
              const focus = new THREE.Vector3(
                (start.x + end.x) * 0.5,
                Math.max(baseSurfaceWorldY, BALL_CENTER_Y * (Number.isFinite(worldScaleFactor) ? worldScaleFactor : WORLD_SCALE)),
                (start.z + end.z) * 0.5
              );
              const cinematicReplayCamera = resolveRailOverheadReplayCamera({
                focusOverride: focus,
                minTargetY: focus.y
              });
              if (cinematicReplayCamera) {
                replayFrameCameraRef.current = {
                  frameA: cinematicReplayCamera,
                  frameB: cinematicReplayCamera,
                  alpha: 0
                };
              }
            }
          }
        };

        const waitMs = (ms = 0) =>
          new Promise((resolve) => window.setTimeout(resolve, Math.max(0, ms)));

        const waitForReplayToFinish = (timeoutMs = 6000) =>
          new Promise((resolve) => {
            const started = performance.now();
            const tick = () => {
              if (!replayPlaybackRef.current) {
                resolve();
                return;
              }
              if (performance.now() - started >= timeoutMs) {
                resolve();
                return;
              }
              requestAnimationFrame(tick);
            };
            tick();
          });

        const finishReplayPlayback = (playback) => {
          if (!playback) return;
          if (playback.postState) {
            applyBallSnapshot(playback.postState);
          }
          replayTrail.visible = false;
          const storedReplayCamera = replayCameraRef.current;
          const targetFov = Number.isFinite(storedReplayCamera?.restoreFov)
            ? storedReplayCamera.restoreFov
            : CAMERA.fov;
          if (Number.isFinite(targetFov) && camera.fov !== targetFov) {
            camera.fov = targetFov;
            camera.updateProjectionMatrix();
          }
          if (cueStick) {
            cueStick.visible = false;
          }
          cueAnimating = false;
          if (playback.pocketDrops) {
            const pocketDuration = Number.isFinite(playback.duration)
              ? playback.duration
              : 0;
            playback.pocketDrops.forEach((entry) => {
              entry.start += pocketDuration;
            });
            pocketDropRef.current = playback.pocketDrops;
          }
          pausedPocketDrops = null;
          replayPlayback = null;
          replayPlaybackRef.current = null;
          shotReplayRef.current = null;
          replayCameraRef.current = null;
          replayFrameCameraRef.current = null;
          setReplayActive(false);
        };

        const enterTopView = (immediate = false) => {
          topViewRef.current = true;
          topViewLockedRef.current = true;
          overheadBroadcastVariantRef.current = Math.random() < 0.5 ? 'top' : 'replay';
          const margin = TOP_VIEW_MARGIN;
          fit(margin);
          const topFocusTarget = TMP_VEC3_TOP_VIEW.set(
            playerOffsetRef.current + TOP_VIEW_SCREEN_OFFSET.x,
            ORBIT_FOCUS_BASE_Y,
            TOP_VIEW_SCREEN_OFFSET.z
          ).multiplyScalar(
            Number.isFinite(worldScaleFactor) ? worldScaleFactor : WORLD_SCALE
          );
          const targetRadiusBase = fitRadius(camera, TOP_VIEW_MARGIN) * TOP_VIEW_RADIUS_SCALE;
          const targetRadius = clampOrbitRadius(
            Math.max(targetRadiusBase, CAMERA.minR * TOP_VIEW_MIN_RADIUS_SCALE)
          );
          sph.radius = targetRadius;
          sph.phi = TOP_VIEW_RESOLVED_PHI;
          sph.theta = Math.PI;
          lastCameraTargetRef.current.copy(topFocusTarget);
          syncBlendToSpherical();
          if (immediate) {
            updateCamera();
          } else {
            requestAnimationFrame(() => {
              syncBlendToSpherical();
              updateCamera();
            });
          }
        };

        const exitTopView = (immediate = false, { preserveLock = false } = {}) => {
          if (!topViewRef.current) return;
          topViewRef.current = false;
          if (!preserveLock) {
            topViewLockedRef.current = false;
            setIsTopDownView(false);
          }
          const margin = Math.max(
            STANDING_VIEW.margin,
            window.innerHeight > window.innerWidth
              ? STANDING_VIEW_MARGIN_PORTRAIT
              : STANDING_VIEW_MARGIN_LANDSCAPE
          );
          fit(margin);
          if (immediate) {
            syncBlendToSpherical();
            updateCamera();
          } else {
            requestAnimationFrame(() => {
              syncBlendToSpherical();
              updateCamera();
            });
          }
        };
        topViewControlsRef.current = {
          enter: enterTopView,
          exit: (immediate = true) => exitTopView(immediate)
        };
        cameraUpdateRef.current = () => updateCamera();
        const clampSpinToLimits = () => {
          const limits = spinLimitsRef.current || DEFAULT_SPIN_LIMITS;
          const current = spinRef.current || { x: 0, y: 0 };
          const clamped = {
            x: clamp(current.x ?? 0, limits.minX, limits.maxX),
            y: clamp(current.y ?? 0, limits.minY, limits.maxY)
          };
          spinRef.current = clamped;
          return clamped;
        };
        const applySpinConstraints = (aimVec, updateUi = false) => {
          const cueBall = cueRef.current || cue;
          let legality = spinLegalityRef.current || { blocked: false, reason: '' };
          const ballsList = ballsRef.current?.length ? ballsRef.current : balls;
          if (cueBall && aimVec) {
            const axes = prepareSpinAxes(aimVec);
            const activeCamera = activeRenderCameraRef.current ?? camera;
            const viewVec = computeCueViewVector(cueBall, activeCamera);
            spinLimitsRef.current = computeSpinLimits(cueBall, aimVec, balls, axes);
            const requested = spinRequestRef.current || spinRef.current || {
              x: 0,
              y: 0
            };
            legality = checkSpinLegality2D(cueBall, requested, ballsList, {
              axes,
              view: viewVec
                ? { x: viewVec.x, y: viewVec.y }
                : null
            });
            spinLegalityRef.current = legality;
          }
          const applied = clampSpinToLimits();
          if (updateUi) {
            updateSpinDotPosition(applied, legality.blocked);
          }
          const result = legality.blocked ? { x: 0, y: 0 } : applied;
          const magnitude = Math.hypot(result.x ?? 0, result.y ?? 0);
          const mode = magnitude >= SWERVE_THRESHOLD ? 'swerve' : 'standard';
          spinAppliedRef.current = { ...result, magnitude, mode };
          return result;
        };
        const drag = { on: false, x: 0, y: 0, moved: false };
        const galleryDrag = {
          active: false,
          startX: 0,
          lastX: 0,
          moved: false,
          identifier: null
        };
        let lastInteraction = performance.now();
        const registerInteraction = () => {
          lastInteraction = performance.now();
        };
        const attemptChalkPress = (ev) => {
          const meshes = chalkMeshesRef.current;
          if (!meshes || meshes.length === 0) return false;
          if (ev.touches?.length && ev.touches.length > 1) return false;
          const rect = dom.getBoundingClientRect();
          const clientX = ev.clientX ?? ev.touches?.[0]?.clientX;
          const clientY = ev.clientY ?? ev.touches?.[0]?.clientY;
          if (clientX == null || clientY == null) return false;
          if (
            clientX < rect.left ||
            clientX > rect.right ||
            clientY < rect.top ||
            clientY > rect.bottom
          ) {
            return false;
          }
          const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
          const ny = -(((clientY - rect.top) / rect.height) * 2 - 1);
          pointer.set(nx, ny);
          const currentCamera = activeRenderCameraRef.current ?? camera;
          ray.setFromCamera(pointer, currentCamera);
          const intersects = ray.intersectObjects(meshes, true);
          if (intersects.length === 0) return false;
          let hit = intersects[0].object;
          while (hit && !hit.userData?.isChalk && hit.parent) {
            hit = hit.parent;
          }
          if (!hit?.userData?.isChalk) return false;
          playChalk();
          toggleChalkAssist(hit.userData?.chalkIndex ?? null);
          return true;
        };
        const down = (e) => {
          if (replayPlaybackRef.current) return;
          registerInteraction();
          const galleryState = cueGalleryStateRef.current;
          if (galleryState?.active) {
            const touch = e.changedTouches?.[0] ?? e.touches?.[0];
            const clientX = e.clientX ?? touch?.clientX ?? galleryDrag.lastX;
            galleryDrag.active = true;
            galleryDrag.moved = false;
            galleryDrag.startX = clientX ?? 0;
            galleryDrag.lastX = galleryDrag.startX;
            galleryDrag.identifier = touch?.identifier ?? null;
            return;
          }
          if (ENABLE_CUE_GALLERY && attemptCueGalleryPress(e)) return;
          if (attemptChalkPress(e)) return;
          const currentHud = hudRef.current;
          if (currentHud?.turn === 1 || currentHud?.inHand || shooting) return;
          if (e.touches?.length === 2) return;
          if (topViewRef.current && !topViewLockedRef.current)
            exitTopView(true, { preserveLock: true });
          drag.on = true;
          drag.moved = false;
          drag.x = e.clientX || e.touches?.[0]?.clientX || 0;
          drag.y = e.clientY || e.touches?.[0]?.clientY || 0;
        };
        const move = (e) => {
          if (replayPlaybackRef.current) return;
          const galleryState = cueGalleryStateRef.current;
          if (galleryState?.active) {
            if (!galleryDrag.active) return;
            let pointerX = e.clientX;
            const findTouch = (touchList) => {
              if (!touchList) return undefined;
              for (let i = 0; i < touchList.length; i += 1) {
                const touch = touchList[i];
                if (
                  galleryDrag.identifier != null &&
                  touch.identifier === galleryDrag.identifier
                ) {
                  return touch;
                }
              }
              return touchList[0];
            };
            if (pointerX == null) {
              const touch = findTouch(e.touches);
              if (touch) pointerX = touch.clientX;
            }
            if (pointerX == null) {
              const touch = findTouch(e.changedTouches);
              if (touch) pointerX = touch.clientX;
            }
          if (pointerX == null) pointerX = galleryDrag.lastX;
          const dx = (pointerX ?? galleryDrag.lastX) - galleryDrag.lastX;
          galleryDrag.lastX = pointerX ?? galleryDrag.lastX;
            if (
              !galleryDrag.moved &&
              Math.abs((pointerX ?? 0) - galleryDrag.startX) > 4
            ) {
              galleryDrag.moved = true;
            }
            const maxLateral = Math.max(galleryState.maxLateral ?? 0, 0);
            if (maxLateral > 0 && dx !== 0) {
              const rect = dom.getBoundingClientRect();
              const scale =
                rect.width > 0 ? maxLateral / rect.width : maxLateral / 240;
              const nextOffset = THREE.MathUtils.clamp(
                (galleryState.lateralOffset ?? 0) + dx * scale,
                -maxLateral,
                maxLateral
              );
              if (Math.abs(nextOffset - (galleryState.lateralOffset ?? 0)) > 1e-4) {
                galleryState.lateralOffset = nextOffset;
                updateCamera();
              }
            }
            registerInteraction();
            return;
          }
          if (topViewRef.current && topViewLockedRef.current) {
            if (!drag.on) return;
            const updated = updateTopViewAimFromPointer(e);
            if (updated) {
              drag.moved = true;
              autoAimRequestRef.current = false;
              suggestionAimKeyRef.current = null;
              registerInteraction();
            }
            return;
          }
          if (topViewRef.current && !topViewLockedRef.current) {
            exitTopView(true, { preserveLock: true });
            drag.on = false;
            drag.moved = false;
            return;
          }
          if (!drag.on) return;
          const currentHud = hudRef.current;
          if (currentHud?.turn === 1) return;
          const x = e.clientX || e.touches?.[0]?.clientX || drag.x;
          const y = e.clientY || e.touches?.[0]?.clientY || drag.y;
          const dx = x - drag.x;
          const dy = y - drag.y;
          if (!drag.moved && Math.hypot(dx, dy) > 4) drag.moved = true;
          if (drag.moved) {
            drag.x = x;
            drag.y = y;
            autoAimRequestRef.current = false;
            suggestionAimKeyRef.current = null;
            const blend = THREE.MathUtils.clamp(
              cameraBlendRef.current ?? 1,
              0,
              1
            );
            const basePrecisionScale = THREE.MathUtils.lerp(
              CUE_VIEW_AIM_SLOW_FACTOR * 0.78,
              0.9,
              blend
            );
            const slowScale =
              chalkAssistEnabledRef.current && chalkAssistTargetRef.current
                ? CHALK_PRECISION_SLOW_MULTIPLIER
                : 1;
            const precisionScale = basePrecisionScale * slowScale;
            sph.theta -= dx * 0.0026 * precisionScale;
            const phiRange = CAMERA.maxPhi - CAMERA.minPhi;
            const phiDelta = dy * 0.0019 * precisionScale;
            const blendDelta =
              phiRange > 1e-5 ? phiDelta / phiRange : 0;
            applyCameraBlend(cameraBlendRef.current - blendDelta);
            updateCamera();
            registerInteraction();
          }
        };
        const up = (e) => {
          if (replayPlaybackRef.current) return;
          registerInteraction();
          const galleryState = cueGalleryStateRef.current;
          if (galleryState?.active) {
            const wasMoved = galleryDrag.moved;
            galleryDrag.active = false;
            galleryDrag.moved = false;
            galleryDrag.identifier = null;
            galleryDrag.startX = galleryDrag.lastX;
            if (!wasMoved) {
              attemptCueSelection(e);
            }
            return;
          }
          const moved = drag.moved;
          drag.on = false;
          drag.moved = false;
          if (
            !moved &&
            !topViewRef.current &&
            !(hudRef.current?.inHand ?? false) &&
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
          if (topViewRef.current && !topViewLockedRef.current) {
            exitTopView(true, { preserveLock: true });
            return;
          }
          const currentHud = hudRef.current;
          if (currentHud?.turn === 1 || currentHud?.inHand || shooting) return;
          const baseStep = e.shiftKey ? 0.08 : 0.035;
          const slowScale =
            chalkAssistEnabledRef.current && chalkAssistTargetRef.current
              ? CHALK_PRECISION_SLOW_MULTIPLIER
              : 1;
          const step = baseStep * slowScale;
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
          registerInteraction();
          updateCamera();
        };
        window.addEventListener('keydown', keyRot);

      // Lights
      const addMobileLighting = () => {
        const useHdriOnly = true;
        if (useHdriOnly) {
          lightingRigRef.current = null;
          return;
        }
        const lightingRig = new THREE.Group();
        world.add(lightingRig);

        const lightSpreadBoost = 1.12; // tighten the overhead footprint while keeping enough coverage for mobile
        const previousLightRigHeight = tableSurfaceY + TABLE.THICK * 7.1; // baseline height used for the prior brightness target
        const lightRigHeight = tableSurfaceY + TABLE.THICK * 6.6; // lift the rig slightly higher so the fixtures sit further above the felt
        const brightnessCompensation =
          ((lightRigHeight ** 2) / (previousLightRigHeight ** 2)) * 1.02; // preserve on-cloth brightness after the height change while keeping intensity stable
        const lightOffsetX =
          Math.max(PLAY_W * 0.22, TABLE.THICK * 3.9) * lightSpreadBoost;
        const lightOffsetZ =
          Math.max(PLAY_H * 0.2, TABLE.THICK * 3.8) * lightSpreadBoost;
        const lightLineX = 0; // align fixtures down the center line instead of offsetting per side
        const lightSpacing = Math.max(lightOffsetZ * 0.36, TABLE.THICK * 2); // pull fixtures closer together while keeping even coverage
        const lightPositionsZ = [-1.1, -0.34, 0.34, 1.1].map((mult) => mult * lightSpacing);
        const lightBrightnessTrim = 0.8; // lower the rig intensity a touch for gentler cloth highlights
        const shadowHalfSpan =
          Math.max(roomWidth, roomDepth) * 0.82 + TABLE.THICK * 3.5;
        const targetY = tableSurfaceY + TABLE.THICK * 0.2;
        const shadowDepth =
          lightRigHeight + Math.abs(targetY - floorY) + TABLE.THICK * 12;

        const ambient = new THREE.AmbientLight(0xffffff, 0.3 * lightBrightnessTrim);
        lightingRig.add(ambient);

        const key = new THREE.DirectionalLight(
          0xffffff,
          1.68 * brightnessCompensation * lightBrightnessTrim
        );
        key.position.set(lightLineX, lightRigHeight, lightPositionsZ[0]);
        key.target.position.set(0, targetY, 0);
        key.castShadow = true;
        key.shadow.mapSize.set(2048, 2048);
        key.shadow.camera.near = 0.1;
        key.shadow.camera.far = shadowDepth;
        key.shadow.camera.left = -shadowHalfSpan;
        key.shadow.camera.right = shadowHalfSpan;
        key.shadow.camera.top = shadowHalfSpan;
        key.shadow.camera.bottom = -shadowHalfSpan;
        key.shadow.bias = -0.00006;
        key.shadow.normalBias = 0.0006;
        key.shadow.camera.updateProjectionMatrix();
        lightingRig.add(key);
        lightingRig.add(key.target);

        const fill = new THREE.DirectionalLight(
          0xffffff,
          0.84 * brightnessCompensation * lightBrightnessTrim
        );
        fill.position.set(-lightLineX, lightRigHeight * 1.01, lightPositionsZ[1]);
        fill.target.position.set(0, targetY, 0);
        lightingRig.add(fill);
        lightingRig.add(fill.target);

        const wash = new THREE.DirectionalLight(
          0xffffff,
          0.76 * brightnessCompensation * lightBrightnessTrim
        );
        wash.position.set(lightLineX, lightRigHeight * 1.02, lightPositionsZ[2]);
        wash.target.position.set(0, targetY, 0);
        lightingRig.add(wash);
        lightingRig.add(wash.target);

        const rim = new THREE.DirectionalLight(
          0xffffff,
          0.68 * brightnessCompensation * lightBrightnessTrim
        );
        rim.position.set(-lightLineX, lightRigHeight * 1.03, lightPositionsZ[3]);
        rim.target.position.set(0, targetY, 0);
        lightingRig.add(rim);
        lightingRig.add(rim.target);

        lightingRigRef.current = {
          group: lightingRig,
          key,
          fill,
          wash,
          rim,
          ambient
        };
        applyLightingPreset();
      };

      addMobileLighting();

      pocketRestIndexRef.current.clear();

      // Table
      const finishForScene = tableFinishRef.current;
      const tableSizeMeta = tableSizeRef.current;
      const {
        centers,
        baulkZ,
        group: table,
        clothMat: tableCloth,
        cushionMat: tableCushion,
        railMarkers,
        setBaseVariant
      } = Table3D(
        world,
        finishForScene,
        tableSizeMeta,
        railMarkerStyleRef.current,
        activeTableBase,
        rendererRef.current
      );
      const SPOTS = spotPositions(baulkZ);
      const longestSide = Math.max(PLAY_W, PLAY_H);
      const secondarySpacingBase =
        Math.max(longestSide * 2.4, Math.max(TABLE.W, TABLE.H) * 2.6) * TABLE_DISPLAY_SCALE;
      const resolveSecondarySpacing = (environmentId = environmentHdriRef.current) => {
        if (environmentId === 'musicHall02') {
          return secondarySpacingBase * 0.86; // pull the dual tables closer in the music hall to open up the short-rail edges
        }
        return secondarySpacingBase;
      };
      const secondaryTableEntry = Table3D(
        world,
        finishForScene,
        tableSizeMeta,
        railMarkerStyleRef.current,
        activeTableBase,
        rendererRef.current
      );
      secondaryTableRef.current = secondaryTableEntry?.group ?? null;
      secondaryBaseSetterRef.current = secondaryTableEntry?.setBaseVariant ?? null;
      const resolveSnookerScale = () => {
        const poolWidth = tableSizeMeta?.playfield?.widthMm ?? 2540;
        const snookerWidth = resolveSnookerTableSize()?.playfield?.widthMm ?? 3556;
        if (!poolWidth || poolWidth <= 0) return 1.2;
        return Math.max(1.15, snookerWidth / poolWidth);
      };
      const snookerDecorScale = resolveSnookerScale();
      const disposeSecondaryDecor = () => {
        const currentDecor = secondaryTableDecorRef.current;
        if (currentDecor?.group?.parent) {
          currentDecor.group.parent.remove(currentDecor.group);
        }
        if (typeof currentDecor?.dispose === 'function') {
          try {
            currentDecor.dispose();
          } catch {}
        }
        secondaryTableDecorRef.current = { group: null, dispose: null };
      };
      const buildDecorGroup = ({ table, variant = 'pool' } = {}) => {
        if (!table) return null;
        const decorGroup = new THREE.Group();
        decorGroup.name = `${variant}-table-decor`;
        const disposables = [];
        const registerDisposable = (item) => {
          if (item && typeof item.dispose === 'function') {
            disposables.push(item);
          }
        };
        const addDecorBall = (color, number, pattern, pos, variantKey = variant === 'pool' ? 'pool' : 'snooker') => {
          const material = getBilliardBallMaterial({
            color,
            pattern,
            number,
            variantKey
          });
          const mesh = new THREE.Mesh(BALL_GEOMETRY, material);
          mesh.position.set(pos.x ?? 0, BALL_CENTER_Y, pos.z ?? 0);
          mesh.castShadow = false;
          mesh.receiveShadow = true;
          mesh.userData = { ...(mesh.userData || {}), decorative: true };
          decorGroup.add(mesh);
        };
        const baseCueScale = BALL_R / 0.0525;
        const cueScale = baseCueScale * (variant === 'snooker' ? snookerDecorScale : 1);
        const cueLen = 1.5 * cueScale * CUE_LENGTH_MULTIPLIER;
        const cueBodyRadius = 0.025 * cueScale;
        const cueTipRadius = CUE_TIP_RADIUS * 0.82 * (variant === 'snooker' ? snookerDecorScale : 1);
        const cueGeometry = new THREE.CylinderGeometry(
          cueTipRadius,
          cueBodyRadius,
          cueLen,
          32
        );
        const cueMaterial = new THREE.MeshPhysicalMaterial({
          color: 0xe6c9a1,
          roughness: 0.4,
          metalness: 0.08,
          clearcoat: 0.28,
          clearcoatRoughness: 0.48
        });
        registerDisposable(cueGeometry);
        registerDisposable(cueMaterial);
        const addCueStick = (x, z, rotationY) => {
          const cueMesh = new THREE.Mesh(cueGeometry, cueMaterial);
          cueMesh.rotation.x = Math.PI / 2;
          cueMesh.rotation.y = rotationY;
          cueMesh.position.set(x, CUE_Y, z);
          cueMesh.castShadow = false;
          cueMesh.receiveShadow = true;
          cueMesh.userData = { ...(cueMesh.userData || {}), decorative: true };
          decorGroup.add(cueMesh);
        };
        if (variant === 'snooker') {
          const rackStartZ = SPOTS.pink[1] + BALL_R * 1.6;
          const rackPositions = generateRackPositions(15, 'triangle', BALL_R, rackStartZ);
          const snookerPalette = {
            red: 0xb1262c,
            yellow: 0xf7d000,
            green: 0x0d7f46,
            brown: 0x6a4126,
            blue: 0x1d5fb3,
            pink: 0xe24578,
            black: 0x101010,
            cue: 0xfafafa
          };
          rackPositions.forEach((pos, index) => {
            const placement = pos || rackPositions[rackPositions.length - 1] || { x: 0, z: rackStartZ + index * BALL_R * 1.6 };
            addDecorBall(snookerPalette.red, null, 'solid', placement, 'snooker');
          });
          [
            { color: snookerPalette.yellow, spot: SPOTS.yellow },
            { color: snookerPalette.green, spot: SPOTS.green },
            { color: snookerPalette.brown, spot: SPOTS.brown },
            { color: snookerPalette.blue, spot: SPOTS.blue },
            { color: snookerPalette.pink, spot: SPOTS.pink },
            { color: snookerPalette.black, spot: SPOTS.black }
          ].forEach(({ color, spot }) => {
            addDecorBall(color, null, 'solid', { x: spot[0], z: spot[1] }, 'snooker');
          });
          addDecorBall(snookerPalette.cue, null, 'solid', { x: -BALL_R * 3, z: baulkZ - BALL_R * 5 }, 'snooker');
          addCueStick(-PLAY_W * 0.2, rackStartZ + BALL_R * 4.2, -Math.PI * 0.04);
          addCueStick(PLAY_W * 0.22, baulkZ - BALL_R * 1.2, Math.PI * 0.06);
        } else {
          const rackColors = POOL_VARIANT_COLOR_SETS.american.objectColors || [];
          const rackNumbers = POOL_VARIANT_COLOR_SETS.american.objectNumbers || [];
          const rackPatterns = POOL_VARIANT_COLOR_SETS.american.objectPatterns || [];
          const rackStartZ = SPOTS.pink[1] + BALL_R * 2;
          const rackPositions = generateRackPositions(
            rackColors.length,
            'triangle',
            BALL_R,
            rackStartZ
          );
          rackColors.forEach((color, index) => {
            const pos =
              rackPositions[index] ||
              rackPositions[rackPositions.length - 1] || { x: 0, z: rackStartZ };
            addDecorBall(color, rackNumbers[index], rackPatterns[index], pos, 'pool');
          });
          addDecorBall(0xffffff, null, 'cue', { x: 0, z: baulkZ - BALL_R * 5.5 }, 'pool');
          addCueStick(-PLAY_W * 0.18, rackStartZ + BALL_R * 4.5, -Math.PI * 0.06);
          addCueStick(PLAY_W * 0.22, baulkZ - BALL_R * 1.5, Math.PI * 0.08);
        }
        table.add(decorGroup);
        return {
          group: decorGroup,
          dispose() {
            decorGroup.parent?.remove(decorGroup);
            disposables.forEach((item) => {
              try {
                item.dispose();
              } catch {}
            });
          }
        };
      };
      const buildSecondaryDecor = () => buildDecorGroup({ table: secondaryTableRef.current, variant: 'pool' });
      const refreshSecondaryDecor = () => {
        disposeSecondaryDecor();
        if (environmentHdriRef.current !== 'musicHall02') return;
        const decor = buildSecondaryDecor();
        if (decor?.group) {
          secondaryTableDecorRef.current = {
            group: decor.group,
            dispose: decor.dispose
          };
        }
      };
      refreshSecondaryTableDecorRef.current = refreshSecondaryDecor;
      clearSecondaryTableDecorRef.current = disposeSecondaryDecor;
      const applySecondarySlot = (slotIndex = 0, enabled = false) => {
        const secondary = secondaryTableRef.current;
        if (!secondary) return;
        secondary.visible = enabled;
        const spacing = resolveSecondarySpacing(environmentHdriRef.current);
        const targetZ = enabled ? (slotIndex === 0 ? -spacing : spacing) : 0;
        secondary.position.set(0, secondary.position.y, targetZ);
      };
      applyTableSlotRef.current = applySecondarySlot;
      applySecondarySlot(activeTableSlotRef.current, environmentHdriRef.current === 'musicHall02');
      refreshSecondaryDecor();
      const disposeDecorativeTables = () => {
        decorativeTablesRef.current.forEach((entry) => {
          entry?.decor?.dispose?.();
          if (entry?.group?.parent) {
            entry.group.parent.remove(entry.group);
          }
        });
        decorativeTablesRef.current = [];
      };
      const markDecorativeTable = (tableGroup) => {
        if (!tableGroup) return;
        tableGroup.userData = { ...(tableGroup.userData || {}), decorative: true };
        tableGroup.traverse((child) => {
          child.userData = { ...(child.userData || {}), decorative: true };
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
      };
      const createDecorativeTable = ({
        variant = 'pool',
        position = { x: 0, z: 0 },
        rotationY = 0,
        scale = null
      } = {}) => {
        const finishForLayout =
          tableFinishRef.current ||
          TABLE_FINISHES?.[DEFAULT_TABLE_FINISH_ID] ||
          DEFAULT_TABLE_FINISH_ID;
        const entry = Table3D(
          world,
          finishForLayout,
          tableSizeMeta,
          railMarkerStyleRef.current,
          activeTableBase,
          rendererRef.current
        );
        const tableGroup = entry?.group;
        if (!tableGroup) return null;
        if (scale) {
          const targetScale = {
            x: scale.x ?? scale,
            y: scale.y ?? scale,
            z: scale.z ?? scale
          };
          tableGroup.scale.set(
            targetScale.x ?? 1,
            targetScale.y ?? 1,
            targetScale.z ?? 1
          );
        }
        tableGroup.position.set(position.x ?? 0, tableGroup.position.y, position.z ?? 0);
        tableGroup.rotation.y = rotationY;
        markDecorativeTable(tableGroup);
        applyTableFinishToTable(tableGroup, finishForLayout);
        const decor = buildDecorGroup({ table: tableGroup, variant });
        decorativeTablesRef.current.push({
          group: tableGroup,
          setBaseVariant: entry?.setBaseVariant ?? null,
          decor,
          variant
        });
        return tableGroup;
      };
      const layoutDecorativeTables = (environmentId = environmentHdriRef.current) => {
        disposeDecorativeTables();
        const spacing = resolveSecondarySpacing(environmentId);
        const tableFootprint = Math.max(TABLE.W, TABLE.H) * TABLE_DISPLAY_SCALE;
        const placementMargin = Math.max(tableFootprint * 0.6, arenaMargin);
        const maxX = Math.max(0, arenaHalfWidth - placementMargin);
        const maxZ = Math.max(0, arenaHalfDepth - placementMargin);
        const clampX = (x = 0) => THREE.MathUtils.clamp(x, -maxX, maxX);
        const clampZ = (z = 0) => THREE.MathUtils.clamp(z, -maxZ, maxZ);
        const envRotationY = Number.isFinite(
          POOL_ROYALE_HDRI_VARIANT_MAP[environmentId]?.rotationY
        )
          ? POOL_ROYALE_HDRI_VARIANT_MAP[environmentId].rotationY
          : 0;
        const placeSideLayout = () => {
          const tableHalfWidth = (TABLE.W / 2) * TABLE_DISPLAY_SCALE;
          const snookerHalfWidth = tableHalfWidth * snookerDecorScale;
          const sideGap = Math.max(BALL_R * 8, spacing * 0.35);
          const leftOffset = clampX(-(tableHalfWidth + sideGap + tableHalfWidth));
          const rightOffset = clampX(tableHalfWidth + sideGap + snookerHalfWidth);
          createDecorativeTable({
            variant: 'pool',
            position: { x: leftOffset, z: 0 },
            rotationY: envRotationY
          });
          createDecorativeTable({
            variant: 'snooker',
            position: { x: rightOffset, z: 0 },
            rotationY: envRotationY,
            scale: { x: snookerDecorScale, y: 1, z: snookerDecorScale }
          });
        };
        if (
          environmentId === 'oldHall' ||
          environmentId === 'emptyPlayRoom'
        ) {
          placeSideLayout();
        } else if (environmentId === 'mirroredHall') {
          const lateralSpacing = clampX(spacing * 0.6);
          const depthSpacing = clampZ(spacing * 0.55);
          const rearSpacing = clampZ(spacing * 0.9);
          createDecorativeTable({
            variant: 'snooker',
            position: { x: -lateralSpacing, z: -depthSpacing }
          });
          createDecorativeTable({
            variant: 'snooker',
            position: { x: lateralSpacing, z: depthSpacing }
          });
          createDecorativeTable({
            variant: 'pool',
            position: { x: 0, z: rearSpacing }
          });
        }
      };
      updateDecorTablesRef.current = layoutDecorativeTables;
      clearDecorTablesRef.current = disposeDecorativeTables;
      layoutDecorativeTables(environmentHdriRef.current);
      const disposeHospitalityGroups = () => {
        hospitalityGroupsRef.current.forEach((group) => {
          if (group) {
            group.traverse((child) => {
              if (child?.isMesh) {
                child.geometry?.dispose?.();
                const materials = Array.isArray(child.material)
                  ? child.material
                  : [child.material];
                materials.forEach((mat) => {
                  if (!mat?.userData?.disposableHospitality) return;
                  mat.map?.dispose?.();
                  mat.lightMap?.dispose?.();
                  mat.aoMap?.dispose?.();
                  mat.normalMap?.dispose?.();
                  mat.roughnessMap?.dispose?.();
                  mat.metalnessMap?.dispose?.();
                  mat.dispose?.();
                });
              }
            });
            if (group.parent) {
              group.parent.remove(group);
            }
          }
        });
        hospitalityGroupsRef.current = [];
        hospitalityLayoutRunRef.current = null;
      };
      const addHospitalityGroup = (group) => {
        if (!group) return;
        hospitalityGroupsRef.current.push(group);
        world.add(group);
      };
      const layoutHospitalityGroups = (environmentId = environmentHdriRef.current) => {
        disposeHospitalityGroups();
        hospitalityLayoutRunRef.current = Symbol('hospitality-layout');
        const runToken = hospitalityLayoutRunRef.current;
        if (environmentId !== 'musicHall02') return;
        const spacing = resolveSecondarySpacing(environmentId);
        const tableHalfDepth = (TABLE.H / 2) * TABLE_DISPLAY_SCALE;
        const shortRailDirection = Math.sign(spacing || 1) || 1;
        const outerShortRailZ = shortRailDirection * (Math.abs(spacing) + tableHalfDepth);
        const availableOuterSpace = Math.max(0, arenaHalfDepth - outerShortRailZ);
        const serviceGap = Math.max(
          toHospitalityUnits(0.32) * hospitalityUpscale,
          BALL_R * 8
        );
        const farInteriorZ = arenaHalfDepth - hospitalityEdgePull;
        const chessPlacementZ =
          -shortRailDirection *
          Math.min(
            farInteriorZ,
            Math.abs(outerShortRailZ) + serviceGap * 1.6
          );
        const dartPlacementZ =
          shortRailDirection *
          Math.min(
            farInteriorZ,
            Math.abs(outerShortRailZ) + serviceGap * 1.6
          );
        const chairSpread = toHospitalityUnits(0.44) * hospitalityUpscale;
        const chairDepth = toHospitalityUnits(0.64) * hospitalityUpscale;
        const facingCenter = Math.atan2(0, -chessPlacementZ);
        createChessBattleDefaultHospitality({
          chairOffsets: [
            [-chairSpread, -chairDepth],
            [chairSpread, -chairDepth]
          ],
          position: [0, chessPlacementZ],
          rotationY: facingCenter,
          scale: 3.5
        })
          .then((group) => {
            if (hospitalityLayoutRunRef.current !== runToken) return;
            if (group) {
              addHospitalityGroup(group);
              return;
            }
            return createChessLoungeSet({
              chairOffsets: [
                [-chairSpread, -chairDepth],
                [chairSpread, -chairDepth]
              ],
              position: [0, chessPlacementZ],
              rotationY: facingCenter
            })
              .then((fallbackGroup) => {
                if (!fallbackGroup || hospitalityLayoutRunRef.current !== runToken) return;
                fallbackGroup.scale.multiplyScalar(3.5);
                addHospitalityGroup(fallbackGroup);
              })
              .catch((error) => {
                console.warn('Failed to add chess lounge hospitality set', error);
              });
          })
          .catch((error) => {
            console.warn('Failed to add chess lounge hospitality set', error);
          });
        const dartboardZ = Math.min(
          farInteriorZ,
          Math.max(
            dartPlacementZ + serviceGap * 0.35,
            spacing + tableHalfDepth + availableOuterSpace * 0.8
          )
        );
        const dartboardX = arenaHalfWidth - hospitalityEdgePull * 0.4;
        const dartboard = createDartboard({
          position: [dartboardX, floorY + 1.96, dartboardZ],
          faceCenter: true
        });
        if (dartboard) {
          addHospitalityGroup(dartboard);
        }
      };
      updateHospitalityLayoutRef.current = layoutHospitalityGroups;
      clearHospitalityLayoutRef.current = disposeHospitalityGroups;
      layoutHospitalityGroups(environmentHdriRef.current);
      setSecondaryTableReady(true);
      clothMat = tableCloth;
      cushionMat = tableCushion;
      chalkMeshesRef.current = Array.isArray(table?.userData?.chalks)
        ? table.userData.chalks
        : [];
      visibleChalkIndexRef.current = null;
      highlightChalks(activeChalkIndexRef.current);
      applyFinishRef.current = (nextFinish) => {
        if (table && nextFinish) {
          applyTableFinishToTable(table, nextFinish);
        }
        if (secondaryTableRef.current && nextFinish) {
          applyTableFinishToTable(secondaryTableRef.current, nextFinish);
        }
        decorativeTablesRef.current.forEach((entry) => {
          if (entry?.group && nextFinish) {
            applyTableFinishToTable(entry.group, nextFinish);
          }
        });
      };
      applyRailMarkerStyleRef.current = (style) => {
        if (table?.userData?.railMarkers?.applyStyle) {
          table.userData.railMarkers.applyStyle(style, {
            trimMaterial: table.userData.finish?.materials?.trim
          });
        }
        const secondaryRailMarkers = secondaryTableRef.current?.userData?.railMarkers;
        if (secondaryRailMarkers?.applyStyle) {
          secondaryRailMarkers.applyStyle(style, {
            trimMaterial: secondaryTableRef.current?.userData?.finish?.materials?.trim
          });
        }
        decorativeTablesRef.current.forEach((entry) => {
          const markers = entry?.group?.userData?.railMarkers;
          if (markers?.applyStyle) {
            markers.applyStyle(style, {
              trimMaterial: entry.group?.userData?.finish?.materials?.trim
            });
          }
        });
      };
      applyBaseRef.current = (variant) => {
        if (table && setBaseVariant) {
          setBaseVariant(variant);
        }
        if (secondaryBaseSetterRef.current) {
          secondaryBaseSetterRef.current(variant);
        }
        decorativeTablesRef.current.forEach((entry) => {
          if (entry?.setBaseVariant) {
            entry.setBaseVariant(variant);
          }
        });
      };
      if (railMarkers?.applyStyle) {
        railMarkers.applyStyle(railMarkerStyleRef.current, {
          trimMaterial: table.userData.finish?.materials?.trim
        });
      }
      if (table?.userData) {
        const cushionLip = table.userData.cushionTopLocal ?? TABLE.THICK;
        cushionHeightRef.current = Math.max(TABLE.THICK + 0.1, cushionLip - 0.02);
        if (tableSizeMeta) {
          table.userData.officialSpec = {
            id: tableSizeMeta.id,
            playfield: tableSizeMeta.playfield,
            ballDiameterMm: tableSizeMeta.ballDiameterMm,
            pocketMouthMm: tableSizeMeta.pocketMouthMm,
            cushionCutAngleDeg: tableSizeMeta.cushionCutAngleDeg,
            cushionPocketAnglesDeg: tableSizeMeta.cushionPocketAnglesDeg,
            cushionRestitution: tableSizeMeta.cushionRestitution,
            componentPreset: tableSizeMeta.componentPreset
          };
        }
      }
      // ensure the camera respects the configured zoom limits
      sph.radius = clampOrbitRadius(sph.radius);
      const applyWorldScale = () => {
        const tableScale = tableSizeRef.current?.scale ?? 1;
        const nextScale = WORLD_SCALE * tableScale;
        const changed = Math.abs(worldScaleFactor - nextScale) > 1e-4;
        worldScaleFactor = nextScale;
        world.scale.setScalar(nextScale);
        const surfaceOffset = baseSurfaceWorldY - tableSurfaceY * nextScale;
        world.position.y = surfaceOffset;
        const rig = broadcastCamerasRef.current;
        if (rig) {
          const focusWorld = rig.defaultFocus
            ? rig.defaultFocus.clone().multiplyScalar(nextScale)
            : new THREE.Vector3();
          rig.defaultFocusWorld = focusWorld;
          if (rig.cameras) {
            Object.values(rig.cameras).forEach((cam) => {
              cam?.head?.lookAt(focusWorld);
            });
          }
        }
        if (changed) {
          world.updateMatrixWorld(true);
        }
        return changed;
      };
      applyWorldScale();
      updateCamera();
      fit(
        topViewRef.current
          ? TOP_VIEW_MARGIN
          : window.innerHeight > window.innerWidth
            ? 1.6
            : 1.4
      );

      // Balls (ONLY Guret)
      const finishPalette = finishForScene?.colors ?? TABLE_FINISHES[DEFAULT_TABLE_FINISH_ID].colors;
      const variantConfig = activeVariantRef.current;
      const add = (id, color, x, z, extra = {}) => {
        const b = Guret(table, id, color, x, z, extra);
        balls.push(b);
        return b;
      };
      const cueColor = variantConfig?.cueColor ?? finishPalette.cue;
      cue = add('cue', cueColor, -BALL_R * 2, baulkZ);

      if (variantConfig?.disableSnookerMarkings && table?.userData?.markings) {
        const { dArc, spots } = table.userData.markings;
        if (dArc) dArc.visible = false;
        if (Array.isArray(spots)) {
          spots.forEach((spot) => {
            if (spot) spot.visible = false;
          });
        }
      }

      const placeTrainingLayout = (layout) => {
        if (!layout) return false;
        const limitX = PLAY_W / 2 - BALL_R * 2.5;
        const limitZ = PLAY_H / 2 - BALL_R * 2.5;
        const normalize = (val, limit) => Math.min(limit, Math.max(-limit, (val ?? 0) * limit));
        if (layout.cue) {
          cue.pos.set(normalize(layout.cue.x, limitX), normalize(layout.cue.z, limitZ));
        }
        const entries = Array.isArray(layout.balls) ? layout.balls : [];
        entries.forEach((ball, idx) => {
          const rid = Number.isFinite(ball?.rackIndex)
            ? Math.max(0, Math.floor(ball.rackIndex))
            : idx % (variantConfig?.objectColors?.length || 15);
          const color = getPoolBallColor(variantConfig, rid);
          const number = getPoolBallNumber(variantConfig, rid);
          const pattern = getPoolBallPattern(variantConfig, rid);
          const ballId = getPoolBallId(variantConfig, rid);
          const px = normalize(ball?.x, limitX);
          const pz = normalize(ball?.z, limitZ);
          add(ballId, color, px, pz, { number, pattern });
        });
        return entries.length > 0;
      };

      const appliedTraining = false;

      if (!appliedTraining) {
        const rackStartZ = SPOTS.pink[1] + BALL_R * 2;
        const rackLayout = variantConfig?.rackLayout || 'triangle';
        const rackColors = Array.isArray(variantConfig?.objectColors)
          ? variantConfig.objectColors
          : [];
        const rackPositions = generateRackPositions(
          rackColors.length,
          rackLayout,
          BALL_R,
          rackStartZ
        );
        for (let rid = 0; rid < rackColors.length; rid++) {
          const pos = rackPositions[rid] || rackPositions[rackPositions.length - 1] || {
            x: 0,
            z: rackStartZ + rid * BALL_R * 1.9
          };
          const color = getPoolBallColor(variantConfig, rid);
          const number = getPoolBallNumber(variantConfig, rid);
          const pattern = getPoolBallPattern(variantConfig, rid);
          const ballId = getPoolBallId(variantConfig, rid);
          add(ballId, color, pos.x, pos.z, { number, pattern });
        }
      }

      // colours
      const colors = variantConfig?.disableSnookerMarkings
        ? {}
        : Object.fromEntries(
            Object.entries(SPOTS).map(([k, [x, z]]) => [k, add(k, finishPalette[k], x, z)])
          );

      applySnookerScaling({
        tableInnerRect: {
          width: PLAY_H,
          height: PLAY_W,
          center: new THREE.Vector3(0, 0, 0)
        },
        cushions: table?.userData?.cushions ?? [],
        pockets: table?.userData?.pockets ?? [],
        balls,
        markings: table?.userData?.markings,
        camera,
        ui: null
      });

      cueRef.current = cue;
      ballsRef.current = balls;

      // Aiming visuals
      const aimMat = new THREE.LineBasicMaterial({
        color: 0x7ce7ff,
        linewidth: AIM_LINE_WIDTH,
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
      const cueAfterGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3()
      ]);
      const cueAfter = new THREE.Line(
        cueAfterGeom,
        new THREE.LineDashedMaterial({
          color: 0x7ce7ff,
          linewidth: AIM_LINE_WIDTH,
          dashSize: AIM_DASH_SIZE * 0.9,
          gapSize: AIM_GAP_SIZE,
          transparent: true,
          opacity: 0.45
        })
      );
      cueAfter.visible = false;
      table.add(cueAfter);
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
          color: 0xffd166,
          linewidth: AIM_LINE_WIDTH,
          dashSize: AIM_DASH_SIZE,
          gapSize: AIM_GAP_SIZE,
          transparent: true,
          opacity: 0.65
        })
      );
      target.visible = false;
      table.add(target);
      const replayTrailGeom = new THREE.BufferGeometry();
      replayTrail = new THREE.Line(
        replayTrailGeom,
        new THREE.LineBasicMaterial({
          color: REPLAY_TRAIL_COLOR,
          linewidth: 3,
          transparent: true,
          opacity: 0.9,
          depthTest: false
        })
      );
      replayTrail.visible = false;
      replayTrail.renderOrder = 5;
      table.add(replayTrail);
      const impactRingEnabled = false;
      const impactRing = new THREE.Mesh(
        new THREE.RingGeometry(BALL_R * 0.7, BALL_R * 1.02, 48),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.0,
          side: THREE.DoubleSide
        })
      );
      impactRing.rotation.x = -Math.PI / 2;
      impactRing.visible = false;
      table.add(impactRing);

      const chalkPrecisionArea = new THREE.Mesh(
        new THREE.CircleGeometry(CHALK_TARGET_RING_RADIUS, 48),
        new THREE.MeshBasicMaterial({
          color: CHALK_ACTIVE_COLOR,
          transparent: true,
          opacity: CHALK_RING_OPACITY,
          side: THREE.DoubleSide,
          depthWrite: false
        })
      );
      chalkPrecisionArea.rotation.x = -Math.PI / 2;
      chalkPrecisionArea.visible = false;
      chalkPrecisionArea.renderOrder = 2;
      table.add(chalkPrecisionArea);
      chalkAreaRef.current = chalkPrecisionArea;

      // Cue stick behind cueball
      const SCALE = BALL_R / 0.0525;
      const cueLen = 1.5 * SCALE * CUE_LENGTH_MULTIPLIER;
      const cueStick = new THREE.Group();
      const cueBody = new THREE.Group();
      cueStick.add(cueBody);
      cueStick.userData.body = cueBody;
      cueBodyRef.current = cueBody;
      const buttLift = Math.min(CUE_BUTT_LIFT, cueLen);
      const buttTilt = Math.asin(
        Math.min(1, buttLift / Math.max(cueLen, 1e-4))
      );
      const applyCueButtTilt = (group, extraTilt = 0, anchorY = null) => {
        if (!group) return;
        const info = group.userData?.buttTilt;
        const baseTilt = info?.angle ?? buttTilt;
        const len = info?.length ?? cueLen;
        const totalTilt = -(baseTilt + extraTilt);
        group.rotation.x = totalTilt;
        const tipComp = -Math.sin(totalTilt) * len * 0.5;
        const baseY = anchorY ?? group.position.y;
        group.position.y = baseY + tipComp;
        if (info) {
          info.baseAnchor = baseY;
          info.tipCompensation = tipComp;
          info.current = totalTilt;
          info.extra = extraTilt;
          info.buttHeightOffset = -Math.sin(totalTilt) * len;
        }
      };
      cueStick.userData.buttTilt = {
        angle: buttTilt,
        tipCompensation: -Math.sin(-buttTilt) * cueLen * 0.5,
        buttHeightOffset: -Math.sin(-buttTilt) * cueLen,
        length: cueLen
      };

      const paletteLength = CUE_FINISH_PALETTE.length || CUE_FINISH_OPTIONS.length || 1;
      const initialIndexRaw = cueStyleIndexRef.current ?? cueStyleIndex ?? 0;
      const initialIndex =
        ((initialIndexRaw % paletteLength) + paletteLength) % paletteLength;
      const shaftMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        map: null,
        normalMap: null,
        roughnessMap: null,
        bumpScale: 0.02 * SCALE,
        roughness: 0.4,
        metalness: 0.0,
        clearcoat: 0.48,
        clearcoatRoughness: 0.3
      });
      shaftMaterial.userData = shaftMaterial.userData || {};
      shaftMaterial.userData.isCueWood = true;
      shaftMaterial.userData.cueOptionIndex = initialIndex;
      shaftMaterial.userData.cueOptionColor = getCueColorFromIndex(initialIndex);
      cueMaterialsRef.current.shaft = shaftMaterial;
      cueMaterialsRef.current.buttMaterial = null;
      cueMaterialsRef.current.buttRingMaterial = null;
      cueMaterialsRef.current.buttCapMaterial = null;
      cueMaterialsRef.current.styleIndex = initialIndex;
      const frontLength = THREE.MathUtils.clamp(
        cueLen * CUE_FRONT_SECTION_RATIO,
        cueLen * 0.1,
        cueLen * 0.5
      );
      const rearLength = Math.max(cueLen - frontLength, 1e-4);
      const rearStart = -rearLength / 2 + frontLength / 2;
      const buttLength = Math.min(rearLength * 0.45, rearLength);
      const rearShaftLength = Math.max(rearLength - buttLength, 0);
      const tipShaftRadius = 0.008 * SCALE;
      const buttShaftRadius = 0.025 * SCALE;
      const joinRadius = THREE.MathUtils.lerp(
        tipShaftRadius,
        buttShaftRadius,
        THREE.MathUtils.clamp(frontLength / Math.max(cueLen, 1e-4), 0, 1)
      );

      if (rearShaftLength > 1e-4) {
        const rearShaft = new THREE.Mesh(
          new THREE.CylinderGeometry(joinRadius, buttShaftRadius, rearShaftLength, 32),
          shaftMaterial
        );
        rearShaft.rotation.x = -Math.PI / 2;
        rearShaft.position.z = rearStart + rearShaftLength / 2;
        cueBody.add(rearShaft);
      }

      // group for tip & front shaft so the whole thin end moves for spin
      const tipGroup = new THREE.Group();
      tipGroup.position.z = -cueLen / 2;
      cueBody.add(tipGroup);
      tipGroupRef.current = tipGroup;

      if (frontLength > 1e-4) {
        const frontShaft = new THREE.Mesh(
          new THREE.CylinderGeometry(tipShaftRadius, joinRadius, frontLength, 32),
          shaftMaterial
        );
        frontShaft.rotation.x = -Math.PI / 2;
        frontShaft.position.z = frontLength / 2;
        tipGroup.add(frontShaft);
      }

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
      const tipMaterial = new THREE.MeshStandardMaterial({
        color: 0x1f3f73,
        roughness: 1,
        metalness: 0,
        map: tipTex
      });
      const tip = new THREE.Group();
      const tipBodyLength = Math.max(0, tipLen - tipRadius);
      if (tipBodyLength > 0) {
        const tipBody = new THREE.Mesh(
          new THREE.CylinderGeometry(tipRadius, tipRadius, tipBodyLength, 20),
          tipMaterial
        );
        tipBody.rotation.x = -Math.PI / 2;
        tipBody.position.z = -(tipBodyLength / 2);
        tip.add(tipBody);
      }
      const tipCapGeometry = new THREE.SphereGeometry(tipRadius, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
      tipCapGeometry.rotateX(Math.PI / 2);
      const tipCap = new THREE.Mesh(tipCapGeometry, tipMaterial);
      tipCap.position.z = -tipBodyLength;
      tip.add(tipCap);
      tip.position.z = -connectorHeight;
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

      const buttMaterial = shaftMaterial;
      cueMaterialsRef.current.buttMaterial = buttMaterial;
      if (buttLength > 1e-4) {
        const butt = new THREE.Mesh(
          new THREE.CylinderGeometry(buttShaftRadius, buttShaftRadius, buttLength, 48),
          buttMaterial
        );
        butt.rotation.x = -Math.PI / 2;
        butt.position.z = rearStart + rearShaftLength + buttLength / 2;
        cueBody.add(butt);
      }

      const stripeLength = rearLength * 0.42;
      const stripeCenter = frontLength / 2 + rearLength * 0.32;

      const buttCap = new THREE.Mesh(
        new THREE.SphereGeometry(0.03 * SCALE, 32, 16),
        buttMaterial
      );
      buttCap.position.z = cueLen / 2;
      cueBody.add(buttCap);
      cueMaterialsRef.current.buttCapMaterial = buttCap.material;

      const stripeOverlay = new THREE.Mesh(
        new THREE.CylinderGeometry(
          buttShaftRadius * 1.001,
          buttShaftRadius * 1.001,
          stripeLength,
          64,
          1,
          true
        ),
        new THREE.MeshPhysicalMaterial({
          transparent: true,
          roughness: 0.32,
          metalness: 0.1,
          clearcoat: 0.12,
          depthWrite: false,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -0.5,
          polygonOffsetUnits: -0.5
        })
      );
      stripeOverlay.rotation.x = -Math.PI / 2;
      stripeOverlay.position.z = stripeCenter;
      stripeOverlay.userData.isCueStripe = true;
      cueMaterialsRef.current.stripe = stripeOverlay.material;
      cueBody.add(stripeOverlay);

      cueStick.position.set(cue.pos.x, CUE_Y, cue.pos.y + 1.2 * SCALE);
      applyCueButtTilt(cueStick, 0, CUE_Y);
      // thin side already faces the cue ball so no extra rotation
      cueStick.visible = false;
      table.add(cueStick);
      applySelectedCueStyle(cueStyleIndexRef.current ?? cueStyleIndex);

      const closeCueGallery = () => {
        if (!ENABLE_CUE_GALLERY) return;
        const state = cueGalleryStateRef.current;
        if (!state?.active) return;
        const prev = state.prev;
        state.active = false;
        setCueGalleryActive(false);
        state.rackId = null;
        state.lateralOffset = 0;
        state.maxLateral = 0;
        state.basePosition?.set(0, 0, 0);
        state.baseTarget?.set(0, 0, 0);
        state.position?.set(0, 0, 0);
        state.target?.set(0, 0, 0);
        state.right?.set(0, 0, 0);
        state.up?.set(0, 0, 0);
        state.prev = null;
        if (prev) {
          topViewRef.current = prev.topView ?? false;
          const focusStore = ensureOrbitFocus();
          if (prev.focus?.target) {
            focusStore.target.copy(prev.focus.target);
          }
          focusStore.ballId = prev.focus?.ballId ?? null;
          if (prev.spherical) {
            sph.radius = prev.spherical.radius ?? sph.radius;
            sph.phi = prev.spherical.phi ?? sph.phi;
            sph.theta = prev.spherical.theta ?? sph.theta;
          }
          applyCameraBlend(prev.blend ?? cameraBlendRef.current);
        }
        updateCamera();
      };

      const openCueGallery = (rackId) => {
        if (!ENABLE_CUE_GALLERY) return;
        if (!rackId) return;
        const meta = cueRackMetaRef.current.get(rackId);
        if (!meta?.group) return;
        const state = cueGalleryStateRef.current;
        const rack = meta.group;
        rack.updateMatrixWorld(true);
        const rackPos = new THREE.Vector3();
        rack.getWorldPosition(rackPos);
        const rackQuat = new THREE.Quaternion();
        rack.getWorldQuaternion(rackQuat);
        const forward = new THREE.Vector3(0, 0, 1)
          .applyQuaternion(rackQuat)
          .normalize();
        const upVec = new THREE.Vector3(0, 1, 0)
          .applyQuaternion(rackQuat)
          .normalize();
        const rightVec = new THREE.Vector3()
          .crossVectors(upVec, forward)
          .normalize();
        const dims = meta.dimensions ?? rack.userData?.cueRackDimensions ?? {};
        const width = (dims.width ?? 4) * worldScaleFactor;
        const height = (dims.height ?? 3) * worldScaleFactor;
        const depth = (dims.depth ?? 0.2) * worldScaleFactor;
        const distance = Math.max(
          depth * 12,
          width * 0.95,
          BALL_R * worldScaleFactor * 24
        );
        const position = rackPos
          .clone()
          .add(forward.clone().multiplyScalar(distance))
          .add(upVec.clone().multiplyScalar(height * 0.24));
        const target = rackPos.clone().add(
          upVec.clone().multiplyScalar(height * 0.12)
        );
        const focusStore = ensureOrbitFocus();
        state.active = true;
        state.rackId = rackId;
        state.prev = {
          topView: topViewRef.current,
          spherical: {
            radius: sph.radius,
            phi: sph.phi,
            theta: sph.theta
          },
          blend: cameraBlendRef.current,
          focus: {
            target: focusStore.target.clone(),
            ballId: focusStore.ballId
          }
        };
        state.basePosition.copy(position);
        state.baseTarget.copy(target);
        state.position.copy(position);
        state.target.copy(target);
        state.right.copy(rightVec);
        state.up.copy(upVec);
        const lateralAllowance = Math.max(
          width * 0.4,
          BALL_R * worldScaleFactor * 3.5
        );
        state.maxLateral = Number.isFinite(lateralAllowance) ? lateralAllowance : 0;
        state.lateralOffset = 0;
        state.lateralFocusScale = 0.5;
        topViewRef.current = false;
        topViewLockedRef.current = false;
        setIsTopDownView(false);
        applyCameraBlend(cameraBlendRef.current);
        updateCamera();
        setCueGalleryActive(true);
      };

      const attemptCueGalleryPress = (ev) => {
        if (!ENABLE_CUE_GALLERY) return false;
        if (cueGalleryStateRef.current.active) return false;
        const currentHud = hudRef.current;
        if (currentHud?.inHand || shooting) return false;
        if (ev.touches?.length && ev.touches.length > 1) return false;
        const racks = cueRackGroupsRef.current;
        if (!Array.isArray(racks) || racks.length === 0) return false;
        const rect = dom.getBoundingClientRect();
        const touch = ev.changedTouches?.[0] ?? ev.touches?.[0];
        const clientX = ev.clientX ?? touch?.clientX;
        const clientY = ev.clientY ?? touch?.clientY;
        if (clientX == null || clientY == null) return false;
        if (
          clientX < rect.left ||
          clientX > rect.right ||
          clientY < rect.top ||
          clientY > rect.bottom
        ) {
          return false;
        }
        const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
        const ny = -(((clientY - rect.top) / rect.height) * 2 - 1);
        pointer.set(nx, ny);
        const currentCamera = activeRenderCameraRef.current ?? camera;
        ray.setFromCamera(pointer, currentCamera);
        const intersects = ray.intersectObjects(racks, true);
        if (intersects.length === 0) return false;
        let hit = intersects[0].object;
        while (hit && !hit.userData?.isCueRack && !hit.userData?.cueRackId) {
          hit = hit.parent;
        }
        const rackId = hit?.userData?.cueRackId ?? hit?.userData?.rackId;
        if (!rackId) return false;
        openCueGallery(rackId);
        return true;
      };

      const attemptCueSelection = async (ev) => {
        if (!ENABLE_CUE_GALLERY) return false;
        const state = cueGalleryStateRef.current;
        if (!state?.active) return false;
        const rect = dom.getBoundingClientRect();
        const touch = ev.changedTouches?.[0] ?? ev.touches?.[0];
        const clientX = ev.clientX ?? touch?.clientX;
        const clientY = ev.clientY ?? touch?.clientY;
        if (clientX == null || clientY == null) return true;
        if (
          clientX < rect.left ||
          clientX > rect.right ||
          clientY < rect.top ||
          clientY > rect.bottom
        ) {
          return true;
        }
        const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
        const ny = -(((clientY - rect.top) / rect.height) * 2 - 1);
        pointer.set(nx, ny);
        const currentCamera = activeRenderCameraRef.current ?? camera;
        ray.setFromCamera(pointer, currentCamera);
        const groups = cueOptionGroupsRef.current;
        if (!Array.isArray(groups) || groups.length === 0) return true;
        const intersects = ray.intersectObjects(groups, true);
        if (intersects.length === 0) return true;
        let hit = intersects[0].object;
        while (hit && !hit.userData?.isCueOption) {
          hit = hit.parent;
        }
        if (!hit?.userData?.isCueOption) return true;
        const rackId = hit.userData?.cueRackId ?? hit.parent?.userData?.cueRackId;
        if (rackId && rackId !== state.rackId) {
          openCueGallery(rackId);
          return true;
        }
        const cueIndex = hit.userData?.cueOptionIndex;
        if (cueIndex == null) return true;
        const charged = await ensureCueFeePaid();
        if (!charged) return true;
        const paletteLength = CUE_FINISH_PALETTE.length || 1;
        const normalized =
          ((cueIndex % paletteLength) + paletteLength) % paletteLength;
        applySelectedCueStyle(normalized);
        setCueStyleIndex(normalized);
        closeCueGallery();
        return true;
      };

      spinRangeRef.current = {
        side: MAX_SPIN_SIDE,
        forward: MAX_SPIN_FORWARD,
        offsetSide: MAX_SPIN_CONTACT_OFFSET,
        offsetVertical: Math.min(MAX_SPIN_CONTACT_OFFSET, MAX_SPIN_VERTICAL)
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
        const activeCamera = activeRenderCameraRef.current ?? camera;
        ray.setFromCamera(pointer, activeCamera);
        const pt = new THREE.Vector3();
        ray.ray.intersectPlane(plane, pt);
        return new THREE.Vector2(
          pt.x / worldScaleFactor,
          pt.z / worldScaleFactor
        );
      };

      const updateTopViewAimFromPointer = (ev) => {
        const cueBall = cueRef.current || cue;
        if (!cueBall?.active) return false;
        const tablePoint = project(ev);
        if (!tablePoint) return false;
        const dir = tablePoint
          .clone()
          .sub(new THREE.Vector2(cueBall.pos.x, cueBall.pos.y));
        if (dir.lengthSq() < 1e-6) return false;
        dir.normalize();
        aimDirRef.current.copy(dir);
        cameraUpdateRef.current?.();
        return true;
      };

      const pickOrbitFocus = (ev) => {
        const currentHud = hudRef.current;
        if ((currentHud?.inHand ?? false) || shooting) return;
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
        const currentCamera = activeRenderCameraRef.current ?? camera;
        ray.setFromCamera(pointer, currentCamera);
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
      const variantId = () => activeVariantRef.current?.id ?? variantKey;

      const isBreakRestrictedInHand = () => {
        const frameSnapshot = frameRef.current ?? frameState;
        const meta = frameSnapshot?.meta;
        if (!meta || typeof meta !== 'object') return false;
        if (meta.variant === 'american' || meta.variant === '9ball') {
          return Boolean(meta.breakInProgress);
        }
        return false;
      };

      const allowFullTableInHand = () => {
        const id = variantId();
        if (id === 'uk') return false;
        if (id === 'american' || id === '9ball') {
          return !isBreakRestrictedInHand();
        }
        return false;
      };

      const isSpotFree = (point, clearanceMultiplier = 2.05) => {
        if (!point) return false;
        const clearance = BALL_R * clearanceMultiplier;
        for (const ball of balls) {
          if (!ball.active || ball === cue) continue;
          if (point.distanceTo(ball.pos) <= clearance) {
            return false;
          }
        }
        return true;
      };
      const clampInHandPosition = (point) => {
        if (!point) return null;
        const clamped = point.clone();
        const limitX = PLAY_W / 2 - BALL_R;
        clamped.x = THREE.MathUtils.clamp(clamped.x, -limitX, limitX);
        if (allowFullTableInHand()) {
          const limitZ = PLAY_H / 2 - BALL_R;
          clamped.y = THREE.MathUtils.clamp(clamped.y, -limitZ, limitZ);
        } else {
          const maxForward = baulkZ + BALL_R * 0.1;
          if (clamped.y > maxForward) clamped.y = maxForward;
          const deltaY = clamped.y - baulkZ;
          const maxRadius = Math.max(D_RADIUS - BALL_R * 0.25, BALL_R);
          const insideSq = clamped.x * clamped.x + deltaY * deltaY;
          if (insideSq > maxRadius * maxRadius) {
            const angle = Math.atan2(deltaY, clamped.x);
            clamped.x = Math.cos(angle) * maxRadius;
            clamped.y = baulkZ + Math.sin(angle) * maxRadius;
          }
        }
        return clamped;
      };
      const defaultInHandPosition = () =>
        clampInHandPosition(
          new THREE.Vector2(0, allowFullTableInHand() ? 0 : baulkZ)
        );
      const inHandDrag = {
        active: false,
        pointerId: null,
        lastPos: null
      };
      const updateCuePlacement = (pos) => {
        if (!cue || !pos) return;
        cue.mesh.visible = true;
        cue.pos.set(pos.x, pos.y);
        cue.mesh.position.set(pos.x, BALL_CENTER_Y, pos.y);
        cue.vel.set(0, 0);
        cue.spin?.set(0, 0);
        cue.pendingSpin?.set(0, 0);
        cue.spinMode = 'standard';
      };
      const tryUpdatePlacement = (raw, commit = false) => {
        const currentHud = hudRef.current;
        if (!(currentHud?.inHand)) return false;
        const clamped = clampInHandPosition(raw);
        if (!clamped) return false;
        if (!isSpotFree(clamped)) return false;
        cue.active = false;
        updateCuePlacement(clamped);
        inHandDrag.lastPos = clamped;
      if (commit) {
        cue.active = true;
        inHandDrag.lastPos = null;
        cueBallPlacedFromHandRef.current = true;
        if (hudRef.current?.inHand) {
          const nextHud = { ...hudRef.current, inHand: false };
          hudRef.current = nextHud;
          setHud(nextHud);
        }
      }
      return true;
    };
      const findAiInHandPlacement = () => {
        const radius = Math.max(D_RADIUS - BALL_R * 0.25, BALL_R);
        const forwardBias = Math.max(baulkZ - BALL_R * 0.6, -PLAY_H / 2 + BALL_R);
        const baseCandidates = [];
        baseCandidates.push(new THREE.Vector2(0, baulkZ));
        baseCandidates.push(new THREE.Vector2(0, forwardBias));
        if (allowFullTableInHand()) {
          baseCandidates.push(new THREE.Vector2(0, 0));
          baseCandidates.push(new THREE.Vector2(0, PLAY_H / 4));
          baseCandidates.push(new THREE.Vector2(0, -PLAY_H / 4));
        }
        const angles = [0, Math.PI / 8, -Math.PI / 8, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2];
        for (const angle of angles) {
          const candidate = new THREE.Vector2(
            Math.cos(angle) * radius,
            baulkZ + Math.sin(angle) * radius
          );
          baseCandidates.push(candidate);
        }
        const limitX = PLAY_W / 2 - BALL_R;
        const step = BALL_R * 2.1;
        for (let x = step; x <= limitX; x += step) {
          baseCandidates.push(new THREE.Vector2(x, forwardBias));
          baseCandidates.push(new THREE.Vector2(-x, forwardBias));
        }
        const ringCandidates = [];
        const denseSteps = 12;
        const radialSteps = 4;
        for (let rStep = radialSteps; rStep >= 1; rStep--) {
          const ringRadius = (radius * rStep) / radialSteps;
          for (let i = 0; i <= denseSteps; i++) {
            const t = -Math.PI / 2 + (Math.PI * i) / denseSteps;
            ringCandidates.push(
              new THREE.Vector2(
                Math.cos(t) * ringRadius,
                baulkZ + Math.sin(t) * ringRadius
              )
            );
          }
        }
        const gridCandidates = [];
        const gridCols = Math.max(8, Math.round((limitX * 2) / (BALL_R * 1.25)));
        const fullTable = allowFullTableInHand();
        const gridRows = fullTable ? 8 : 5;
        const gridStart = fullTable ? -PLAY_H / 2 + BALL_R : forwardBias;
        const gridEnd = fullTable ? PLAY_H / 2 - BALL_R : baulkZ;
        for (let row = 0; row <= gridRows; row++) {
          const z = THREE.MathUtils.lerp(gridStart, gridEnd, row / gridRows);
          for (let col = 0; col <= gridCols; col++) {
            const x = THREE.MathUtils.lerp(-limitX, limitX, col / gridCols);
            gridCandidates.push(new THREE.Vector2(x, z));
          }
        }
        const jitter = BALL_R * 0.5;
        const jitterCandidates = baseCandidates.flatMap((candidate) => [
          candidate.clone(),
          candidate.clone().add(new THREE.Vector2(jitter, 0)),
          candidate.clone().add(new THREE.Vector2(-jitter, 0)),
          candidate.clone().add(new THREE.Vector2(0, -jitter)),
          candidate.clone().add(new THREE.Vector2(0, jitter * 0.5))
        ]);
        const candidateGroups = [
          baseCandidates,
          ringCandidates,
          gridCandidates,
          jitterCandidates
        ];
        const clearanceLevels = [2.15, 2.1, 2.05, 2.02, 2.0];
        for (const clearance of clearanceLevels) {
          for (const group of candidateGroups) {
            for (const raw of group) {
              const clamped = clampInHandPosition(raw);
              if (!clamped) continue;
              if (!isSpotFree(clamped, clearance)) continue;
              return clamped;
            }
          }
        }
        let best = null;
        let bestGap = -Infinity;
        const combined = candidateGroups.flat();
        for (const raw of combined) {
          const clamped = clampInHandPosition(raw);
          if (!clamped) continue;
          let minDist = Infinity;
          for (const ball of balls) {
            if (!ball.active || ball === cue) continue;
            const dist = clamped.distanceTo(ball.pos);
            if (dist < minDist) minDist = dist;
          }
          if (minDist > bestGap) {
            bestGap = minDist;
            best = clamped;
          }
        }
        if (best) {
          if (bestGap < BALL_R * 2.02) {
            let nearest = null;
            let nearestDist = Infinity;
            for (const ball of balls) {
              if (!ball.active || ball === cue) continue;
              const dist = best.distanceTo(ball.pos);
              if (dist < nearestDist) {
                nearestDist = dist;
                nearest = ball;
              }
            }
            if (nearest) {
              const offset = best.clone().sub(nearest.pos);
              if (offset.lengthSq() < 1e-6) {
                offset.set(1, 0);
              }
              offset.setLength(BALL_R * 2.05);
              const nudged = clampInHandPosition(
                nearest.pos.clone().add(offset)
              );
              if (nudged && isSpotFree(nudged, 2.02)) {
                return nudged;
              }
            }
            const searchDirs = [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
              [Math.SQRT1_2, Math.SQRT1_2],
              [Math.SQRT1_2, -Math.SQRT1_2],
              [-Math.SQRT1_2, Math.SQRT1_2],
              [-Math.SQRT1_2, -Math.SQRT1_2]
            ];
            const stepSize = BALL_R * 0.45;
            const maxSteps = 10;
            for (const [dx, dz] of searchDirs) {
              for (let stepIdx = 1; stepIdx <= maxSteps; stepIdx++) {
                TMP_VEC2_A.copy(best);
                TMP_VEC2_A.x += dx * stepSize * stepIdx;
                TMP_VEC2_A.y += dz * stepSize * stepIdx;
                const candidate = clampInHandPosition(TMP_VEC2_A);
                if (!candidate) continue;
                if (isSpotFree(candidate, 2.02)) {
                  return candidate;
                }
              }
            }
          } else {
            return best;
          }
        }
        const fallback = allowFullTableInHand()
          ? defaultInHandPosition()
          : clampInHandPosition(new THREE.Vector2(0, forwardBias));
        if (fallback && isSpotFree(fallback, 2.0)) {
          return fallback;
        }
        const baulkCenter = defaultInHandPosition();
        if (baulkCenter && isSpotFree(baulkCenter, 2.0)) {
          return baulkCenter;
        }
        return null;
      };
      const autoPlaceAiCueBall = () => {
        const currentHud = hudRef.current;
        if (!currentHud) return false;
        if (currentHud.turn !== 1 || !currentHud.inHand) return false;
        if (!cue) return false;
        if (!allStopped(balls)) return false;
        const pos = findAiInHandPlacement();
        if (!pos) return false;
        cue.active = false;
        updateCuePlacement(pos);
        cue.active = true;
        cue.mesh.visible = true;
        cueBallPlacedFromHandRef.current = true;
        hudRef.current = { ...currentHud, inHand: false };
        setHud((prev) => ({ ...prev, inHand: false }));
        return true;
      };
      const handleInHandDown = (e) => {
        const currentHud = hudRef.current;
        if (!(currentHud?.inHand)) return;
        if (!inHandPlacementModeRef.current) return;
        if (shooting) return;
        if (e.button != null && e.button !== 0) return;
        const p = project(e);
        if (!p) return;
        if (!tryUpdatePlacement(p, false)) return;
        inHandDrag.active = true;
        inHandDrag.pointerId = e.pointerId ?? 'mouse';
        if (e.pointerId != null && dom.setPointerCapture) {
          try {
            dom.setPointerCapture(e.pointerId);
          } catch {}
        }
        e.preventDefault?.();
      };
      const handleInHandMove = (e) => {
        if (!inHandDrag.active) return;
        if (
          inHandDrag.pointerId != null &&
          e.pointerId != null &&
          e.pointerId !== inHandDrag.pointerId
        ) {
          return;
        }
        const p = project(e);
        if (p) tryUpdatePlacement(p, false);
        e.preventDefault?.();
      };
      const endInHandDrag = (e) => {
        if (!inHandDrag.active) return;
        if (
          inHandDrag.pointerId != null &&
          e.pointerId != null &&
          e.pointerId !== inHandDrag.pointerId
        ) {
          return;
        }
        if (e.pointerId != null && dom.releasePointerCapture) {
          try {
            dom.releasePointerCapture(e.pointerId);
          } catch {}
        }
        inHandDrag.active = false;
        const pos = inHandDrag.lastPos;
        if (pos) {
          tryUpdatePlacement(pos, true);
          setInHandPlacementMode(false);
          autoAimRequestRef.current = true;
        }
        e.preventDefault?.();
      };
      dom.addEventListener('pointerdown', handleInHandDown);
      dom.addEventListener('pointermove', handleInHandMove);
      window.addEventListener('pointerup', endInHandDrag);
      dom.addEventListener('pointercancel', endInHandDrag);
      window.addEventListener('pointercancel', endInHandDrag);
      if (hudRef.current?.inHand) {
        const startPos = defaultInHandPosition();
        if (startPos) {
          cue.active = false;
          updateCuePlacement(startPos);
          cue.active = true;
          cueBallPlacedFromHandRef.current = true;
        }
        if (allowFullTableInHand()) {
          const focusStore = ensureOrbitFocus();
          focusStore.target.set(0, BALL_CENTER_Y, 0);
          focusStore.ballId = null;
          const standingBounds = cameraBoundsRef.current?.standing;
          if (standingBounds) {
            sph.radius = clampOrbitRadius(standingBounds.radius);
            sph.phi = THREE.MathUtils.clamp(
              standingBounds.phi,
              CAMERA.minPhi,
              CAMERA.maxPhi
            );
            syncBlendToSpherical();
            updateCamera();
          }
        }
      }

      // Shot lifecycle
      let potted = [];
      let firstHit = null;

      const alignStandingCameraToAim = (cueBall, aimDir) => {
        if (!cueBall || !aimDir) return;
        const dir = aimDir.clone();
        if (dir.lengthSq() < 1e-6) return;
        dir.normalize();
        const sph = sphRef.current;
        if (!sph) return;
        const standingBounds = cameraBoundsRef.current?.standing;
        if (standingBounds) {
          sph.radius = clampOrbitRadius(standingBounds.radius);
          sph.phi = THREE.MathUtils.clamp(
            standingBounds.phi,
            CAMERA.minPhi,
            CAMERA.maxPhi
          );
        }
        const aimTheta = Math.atan2(dir.x, dir.y) + Math.PI;
        sph.theta = aimTheta;
        syncBlendToSpherical();
        const focusStore = ensureOrbitFocus();
        const focusDistance = Math.max(
          BALL_R * 28,
          Math.min(LONG_SHOT_DISTANCE, PLAY_H * 0.5)
        );
        const focusTarget = new THREE.Vector3(
          THREE.MathUtils.clamp(
            cueBall.pos.x + dir.x * focusDistance,
            -PLAY_W / 2,
            PLAY_W / 2
          ),
          BALL_CENTER_Y,
          THREE.MathUtils.clamp(
            cueBall.pos.y + dir.y * focusDistance,
            -PLAY_H / 2,
            PLAY_H / 2
          )
        );
        focusStore.ballId = cueBall.id ?? null;
        focusStore.target.copy(focusTarget);
        lastCameraTargetRef.current.copy(
          focusTarget.clone().multiplyScalar(worldScaleFactor)
        );
      };

      const computeCuePull = (
        pullTarget = 0,
        maxPull = CUE_PULL_BASE,
        { instant = false, preserveLarger = false } = {}
      ) => {
        const slider = sliderInstanceRef.current;
        const dragging = Boolean(slider?.dragging);
        const cappedMax = Number.isFinite(maxPull) ? Math.max(0, maxPull) : CUE_PULL_BASE;
        const effectiveMax = Math.max(cappedMax + CUE_PULL_VISUAL_FUDGE, CUE_PULL_MIN_VISUAL);
        const desiredTarget = preserveLarger
          ? Math.max(cuePullCurrentRef.current ?? 0, pullTarget ?? 0)
          : pullTarget ?? 0;
        const boostedTarget = desiredTarget * CUE_PULL_GLOBAL_VISIBILITY_BOOST;
        const clampedTarget = THREE.MathUtils.clamp(boostedTarget, 0, effectiveMax);
        const smoothing = instant || dragging ? 1 : CUE_PULL_SMOOTHING;
        const nextPull =
          smoothing >= 1
            ? clampedTarget
            : THREE.MathUtils.lerp(cuePullCurrentRef.current ?? 0, clampedTarget, smoothing);
        cuePullTargetRef.current = clampedTarget;
        cuePullCurrentRef.current = nextPull;
        return nextPull;
      };
      const applyVisualPullCompensation = (pullValue, dirVec3) => {
        const basePull = Math.max(pullValue ?? 0, 0);
        if (basePull <= 1e-6 || !dirVec3) return basePull;
        const cam =
          activeRenderCameraRef.current ??
          cameraRef.current ??
          camera;
        TMP_VEC3_CUE_DIR.set(dirVec3.x, 0, dirVec3.z);
        if (TMP_VEC3_CUE_DIR.lengthSq() > 1e-8) {
          TMP_VEC3_CUE_DIR.normalize();
        } else {
          TMP_VEC3_CUE_DIR.set(0, 0, 1);
        }
        let alignment = 0;
        if (cam?.getWorldDirection) {
          cam.getWorldDirection(TMP_VEC3_CAM_DIR);
          TMP_VEC3_CAM_DIR.y = 0;
          if (TMP_VEC3_CAM_DIR.lengthSq() > 1e-8) {
            TMP_VEC3_CAM_DIR.normalize();
            alignment = Math.abs(TMP_VEC3_CAM_DIR.dot(TMP_VEC3_CUE_DIR));
          }
        }
        const blend = THREE.MathUtils.clamp(cameraBlendRef.current ?? 1, 0, 1);
        const cameraPullScale = THREE.MathUtils.lerp(
          1 - CUE_PULL_CUE_CAMERA_DAMPING,
          1 + CUE_PULL_STANDING_CAMERA_BONUS,
          blend
        );
        const alignmentBoost = 1 + alignment * CUE_PULL_ALIGNMENT_BOOST;
        const compensated =
          basePull * alignmentBoost * cameraPullScale;
        const maxScale = 1 + CUE_PULL_MAX_VISUAL_BONUS;
        return Math.min(compensated, basePull * maxScale);
      };
      const computePullTargetFromPower = (power, maxPull = CUE_PULL_BASE) => {
        const ratio = THREE.MathUtils.clamp(power ?? 0, 0, 1);
        const effectiveMax = Number.isFinite(maxPull) ? Math.max(maxPull, 0) : CUE_PULL_BASE;
        const amplifiedMax = Math.max(effectiveMax, CUE_PULL_MIN_VISUAL);
        const visualMax = effectiveMax + CUE_PULL_VISUAL_FUDGE;
        const target = amplifiedMax * ratio * CUE_PULL_VISUAL_MULTIPLIER;
        return Math.min(target, visualMax);
      };
      const clampCueTipOffset = (vec, limit = BALL_R) => {
        if (!vec) return vec;
        const horiz = Math.hypot(vec.x ?? 0, vec.z ?? 0);
        const total = Math.hypot(horiz, vec.y ?? 0);
        if (total > limit && total > 1e-6) {
          vec.multiplyScalar(limit / total);
        }
        return vec;
      };
      const computeSpinOffsets = (spin, ranges) => {
        const offsetSide = ranges?.offsetSide ?? 0;
        const offsetVertical = ranges?.offsetVertical ?? 0;
        const magnitude = Math.hypot(spin?.x ?? 0, spin?.y ?? 0);
        const hasSpin = magnitude > 1e-4;
        let side = hasSpin ? spin.x * offsetSide : 0;
        let vert = hasSpin ? -spin.y * offsetVertical : 0;
        if (hasSpin) {
          vert = THREE.MathUtils.clamp(vert, -MAX_SPIN_VISUAL_LIFT, MAX_SPIN_VISUAL_LIFT);
        }
        const maxContactOffset = MAX_SPIN_CONTACT_OFFSET;
        if (hasSpin && maxContactOffset > 1e-6) {
          const combined = Math.hypot(side, vert);
          if (combined > maxContactOffset) {
            const scale = maxContactOffset / combined;
            side *= scale;
            vert *= scale;
          }
        }
        return { side, vert, hasSpin };
      };

      // Fire (slider triggers on release)
      const fire = () => {
        const currentHud = hudRef.current;
        const frameSnapshot = frameRef.current ?? frameState;
        const fullTableHandPlacement =
          allowFullTableInHand() && Boolean(frameSnapshot?.meta?.state?.ballInHand);
        const inHandPlacementActive = Boolean(
          currentHud?.inHand && !fullTableHandPlacement
        );
        if (
          !cue?.active ||
          (inHandPlacementActive && !cueBallPlacedFromHandRef.current) ||
          !allStopped(balls) ||
          currentHud?.over ||
          replayPlaybackRef.current
        )
          return;
        if (currentHud?.inHand && (fullTableHandPlacement || inHandPlacementActive)) {
          hudRef.current = { ...currentHud, inHand: false };
          setHud((prev) => ({ ...prev, inHand: false }));
        }
        const shotStartTime = performance.now();
        const forcedCueView = aiShotCueViewRef.current;
        setAiShotCueViewActive(false);
        setAiShotPreviewActive(false);
        alignStandingCameraToAim(cue, aimDirRef.current);
        cancelCameraBlendTween();
        const forcedCueBlend = aiCueViewBlendRef.current ?? AI_CAMERA_DROP_BLEND;
        applyCameraBlend(forcedCueView ? forcedCueBlend : 1);
        updateCamera();
        let placedFromHand = false;
        const meta = frameSnapshot?.meta;
        if (meta && typeof meta === 'object') {
          if (meta.variant === 'american' && meta.state) {
            placedFromHand = Boolean(meta.state.ballInHand);
          } else if (meta.variant === '9ball' && meta.state) {
            placedFromHand = Boolean(meta.state.ballInHand);
          } else if (meta.variant === 'uk' && meta.state) {
            placedFromHand = Boolean(meta.state.mustPlayFromBaulk);
          }
        }
        shotContextRef.current = {
          placedFromHand,
          contactMade: false,
          cushionAfterContact: false
        };
        setShootingState(true);
        powerImpactHoldRef.current = Math.max(
          powerImpactHoldRef.current || 0,
          shotStartTime + CAMERA_SWITCH_MIN_HOLD_MS
        );
        activeShotView = null;
        queuedPocketView = null;
        aimFocusRef.current = null;
        potted = [];
        firstHit = null;
        clearInterval(timerRef.current);
        const aimDir = aimDirRef.current.clone();
        const prediction = calcTarget(cue, aimDir.clone(), balls);
        const predictedTravelRaw = prediction.targetBall
          ? cue.pos.distanceTo(prediction.targetBall.pos)
          : prediction.tHit;
        const predictedTravel = Number.isFinite(predictedTravelRaw)
          ? predictedTravelRaw
          : 0;
        const isShortShot =
          predictedTravel > 0 &&
          predictedTravel < SHORT_SHOT_CAMERA_DISTANCE;
        const isLongShot = predictedTravel > LONG_SHOT_DISTANCE;
        const replayTags = new Set();
        if (isLongShot) replayTags.add('long');
        shotPrediction = {
          ballId: prediction.targetBall?.id ?? null,
          dir: prediction.targetDir ? prediction.targetDir.clone() : null,
          impact: prediction.impact
            ? new THREE.Vector2(prediction.impact.x, prediction.impact.y)
            : null,
          railNormal: prediction.railNormal
            ? prediction.railNormal.clone()
            : null,
          travel: predictedTravel,
          longShot: isLongShot,
          targetInitialPos: prediction.targetBall
            ? prediction.targetBall.pos.clone()
            : null
        };
        if (shotPrediction.railNormal) replayTags.add('bank');
          const intentTimestamp = performance.now();
          if (shotPrediction.ballId && !isShortShot) {
            const isDirectHit =
              shotPrediction.railNormal === null || shotPrediction.railNormal === undefined;
            pocketSwitchIntentRef.current = {
              ballId: shotPrediction.ballId,
              allowEarly: isDirectHit,
              forced: isDirectHit,
              createdAt: intentTimestamp
            };
          } else {
            pocketSwitchIntentRef.current = null;
          }
          lastPocketBallRef.current = null;
          const clampedPower = THREE.MathUtils.clamp(powerRef.current, 0, 1);
          lastShotPower = clampedPower;
          const isMaxPowerShot = clampedPower >= MAX_POWER_BOUNCE_THRESHOLD;
          powerImpactHoldRef.current = isMaxPowerShot
            ? performance.now() + MAX_POWER_CAMERA_HOLD_MS
            : 0;
          if (aiOpponentEnabled && hudRef.current?.turn === 1) {
            powerImpactHoldRef.current = Math.max(
              powerImpactHoldRef.current || 0,
              performance.now() + AI_POST_SHOT_CAMERA_HOLD_MS
            );
          }
          const spinMagnitude = Math.hypot(
            spinRef.current?.x ?? 0,
            spinRef.current?.y ?? 0
          );
          const isPowerShot = clampedPower >= POWER_REPLAY_THRESHOLD;
          if (isPowerShot) replayTags.add('power');
          if (spinMagnitude >= SPIN_REPLAY_THRESHOLD) replayTags.add('spin');
          const shouldRecordReplay = true;
          const preferZoomReplay =
            replayTags.size > 0 && !replayTags.has('long') && !replayTags.has('bank');
          const frameStateCurrent = frameRef.current ?? null;
          const isBreakShot = (frameStateCurrent?.currentBreak ?? 0) === 0;
          const powerScale = SHOT_MIN_FACTOR + SHOT_POWER_RANGE * clampedPower;
          const speedBase = SHOT_BASE_SPEED * (isBreakShot ? SHOT_BREAK_MULTIPLIER : 1);
          const base = aimDir
            .clone()
            .multiplyScalar(speedBase * powerScale);
          const predictedCueSpeed = base.length();
          shotPrediction.speed = predictedCueSpeed;
          if (shouldRecordReplay) {
            shotRecording = {
              longShot: replayTags.has('long'),
              startTime: performance.now(),
              startState: captureBallSnapshot(),
              frames: [],
              cuePath: [],
              replayTags: Array.from(replayTags),
              zoomOnly: preferZoomReplay
            };
            shotReplayRef.current = shotRecording;
            recordReplayFrame(shotRecording.startTime);
          } else {
            shotRecording = null;
            shotReplayRef.current = null;
          }
          const allowLongShotCameraSwitch =
            !isShortShot &&
            (!isLongShot || predictedCueSpeed <= LONG_SHOT_SPEED_SWITCH_THRESHOLD);
          const broadcastSystem =
            broadcastSystemRef.current ?? activeBroadcastSystem ?? null;
          const suppressPocketCameras = broadcastSystem?.avoidPocketCameras;
          const forceActionActivation = broadcastSystem?.forceActionActivation;
          const orbitSnapshot = sphRef.current
            ? {
                radius: sphRef.current.radius,
                phi: sphRef.current.phi,
                theta: sphRef.current.theta
              }
            : null;
          const standingBounds = cameraBoundsRef.current?.standing;
          const followView = standingBounds
            ? {
                orbitSnapshot: {
                  radius: clampOrbitRadius(
                    standingBounds.radius ?? sphRef.current?.radius ?? BREAK_VIEW.radius
                  ),
                  phi: THREE.MathUtils.clamp(
                    standingBounds.phi,
                    CAMERA.minPhi,
                    CAMERA.maxPhi
                  ),
                  theta: sphRef.current?.theta ?? 0
                }
              }
            : orbitSnapshot
              ? { orbitSnapshot }
              : null;
          const actionView = allowLongShotCameraSwitch
            ? makeActionCameraView(
                cue,
                shotPrediction.ballId,
                followView,
                shotPrediction.railNormal,
                {
                  longShot: isLongShot,
                  travelDistance: predictedTravel
                }
              )
            : null;
          const earlyPocketView =
            !suppressPocketCameras && shotPrediction.ballId && followView
              ? makePocketCameraView(shotPrediction.ballId, followView, {
                  forceEarly: true
                })
              : null;
          if (actionView && cameraRef.current) {
            actionView.smoothedPos = cameraRef.current.position.clone();
            const storedTarget = lastCameraTargetRef.current?.clone();
            if (storedTarget) actionView.smoothedTarget = storedTarget;
          }
          let pocketViewActivated = false;
          if (earlyPocketView && !isMaxPowerShot) {
            const now = performance.now();
            earlyPocketView.lastUpdate = now;
            if (cameraRef.current) {
              const cam = cameraRef.current;
              earlyPocketView.smoothedPos = cam.position.clone();
              const storedTarget = lastCameraTargetRef.current?.clone();
              if (storedTarget) {
                earlyPocketView.smoothedTarget = storedTarget;
              }
            }
            if (actionView) {
              earlyPocketView.resumeAction = actionView;
              suspendedActionView = actionView;
            } else {
              suspendedActionView = null;
            }
            const holdUntil = powerImpactHoldRef.current || 0;
            const holdActive = holdUntil > performance.now();
            if (holdUntil > 0) {
              const baseDelay = earlyPocketView.activationDelay ?? 0;
              earlyPocketView.activationDelay = Math.max(baseDelay, holdUntil);
            }
            earlyPocketView.pendingActivation = holdActive;
            if (holdActive) {
              queuedPocketView = earlyPocketView;
              pocketViewActivated = true;
            } else {
              queuedPocketView = null;
              updatePocketCameraState(true);
              activeShotView = earlyPocketView;
              pocketViewActivated = true;
            }
          }
          if (!pocketViewActivated && actionView) {
            const shouldActivateActionView =
              (!isLongShot || forceActionActivation) && !isMaxPowerShot;
            const holdUntil = powerImpactHoldRef.current || 0;
            const holdActive = holdUntil > performance.now();
            if (shouldActivateActionView && !holdActive) {
              suspendedActionView = null;
              activeShotView = actionView;
              updateCamera();
            } else {
              actionView.pendingActivation = true;
              const baseDelay = actionView.activationDelay ?? null;
              const delayed = Math.max(baseDelay ?? 0, holdUntil ?? 0);
              actionView.activationDelay = delayed > 0 ? delayed : null;
              const baseTravel = actionView.activationTravel ?? 0;
              actionView.activationTravel = Math.max(
                baseTravel,
                isMaxPowerShot ? BALL_R * 6 : 0
              );
              suspendedActionView = actionView;
            }
          }
          const appliedSpin = applySpinConstraints(aimDir, true);
          const ranges = spinRangeRef.current || {};
          const powerSpinScale = powerScale;
          const baseSide = appliedSpin.x * (ranges.side ?? 0);
          let spinSide = baseSide * SIDE_SPIN_MULTIPLIER * powerSpinScale;
          let spinTop = -appliedSpin.y * (ranges.forward ?? 0) * powerSpinScale;
          if (appliedSpin.y > 0) {
            spinTop *= BACKSPIN_MULTIPLIER;
          } else if (appliedSpin.y < 0) {
            spinTop *= TOPSPIN_MULTIPLIER;
          }
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
          maxPowerLiftTriggered = false;
          cue.lift = 0;
          cue.liftVel = 0;
          playCueHit(clampedPower * 0.6);

          if (cameraRef.current && sphRef.current) {
            topViewRef.current = false;
            topViewLockedRef.current = false;
            setIsTopDownView(false);
            const sph = sphRef.current;
            const bounds = cameraBoundsRef.current;
            const standingView = bounds?.standing;
            if (standingView) {
              sph.radius = clampOrbitRadius(standingView.radius);
              sph.phi = THREE.MathUtils.clamp(
                standingView.phi,
                CAMERA.minPhi,
                CAMERA.maxPhi
              );
              syncBlendToSpherical();
            }
            updateCamera();
          }

          // animate cue stick forward
          const dir = new THREE.Vector3(aimDir.x, 0, aimDir.y);
          if (dir.lengthSq() < 1e-8) dir.set(0, 0, 1);
          dir.normalize();
          const backInfo = calcTarget(
            cue,
            aimDir.clone().multiplyScalar(-1),
            balls
          );
          const rawMaxPull = Math.max(0, backInfo.tHit - cueLen - CUE_TIP_GAP);
          const maxPull = Number.isFinite(rawMaxPull) ? rawMaxPull : CUE_PULL_BASE;
          const isAiStroke = aiOpponentEnabled && hudRef.current?.turn === 1;
          const pullVisibilityBoost = isAiStroke
            ? AI_CUE_PULL_VISIBILITY_BOOST
            : PLAYER_CUE_PULL_VISIBILITY_BOOST;
          const pullTarget = computePullTargetFromPower(clampedPower, maxPull) * pullVisibilityBoost;
          const pull = computeCuePull(pullTarget, maxPull, {
            instant: true,
            preserveLarger: true
          });
          const visualPull = applyVisualPullCompensation(pull, dir);
          cuePullCurrentRef.current = pull;
          cuePullTargetRef.current = pull;
          const cuePerp = new THREE.Vector3(-dir.z, 0, dir.x);
          if (cuePerp.lengthSq() > 1e-8) cuePerp.normalize();
          const { side: contactSide, vert: contactVert, hasSpin } = computeSpinOffsets(
            appliedSpin,
            ranges
          );
          const spinWorld = new THREE.Vector3(
            cuePerp.x * contactSide,
            contactVert,
            cuePerp.z * contactSide
          );
          clampCueTipOffset(spinWorld);
          const obstructionStrength = resolveCueObstruction(dir, pull);
          const obstructionTilt = obstructionStrength * CUE_OBSTRUCTION_TILT;
          const obstructionLift = obstructionStrength * CUE_OBSTRUCTION_LIFT;
          const obstructionTiltFromLift =
            obstructionLift > 0 ? Math.atan2(obstructionLift, cueLen) : 0;
          const buildCuePosition = (pullAmount = visualPull) =>
            new THREE.Vector3(
              cue.pos.x - dir.x * (cueLen / 2 + pullAmount + CUE_TIP_GAP) + spinWorld.x,
              CUE_Y + spinWorld.y,
              cue.pos.y - dir.z * (cueLen / 2 + pullAmount + CUE_TIP_GAP) + spinWorld.z
            );
          const warmupRatio = isAiStroke ? AI_WARMUP_PULL_RATIO : PLAYER_WARMUP_PULL_RATIO;
          const minVisibleGap = Math.max(MIN_PULLBACK_GAP, visualPull * 0.08);
          const warmupPull = Math.max(
            0,
            Math.min(visualPull - minVisibleGap, visualPull * warmupRatio)
          );
          const startPos = buildCuePosition(visualPull);
          const warmupPos = buildCuePosition(warmupPull);
          const tiltAmount = hasSpin ? Math.abs(appliedSpin.y || 0) : 0;
          const extraTilt = MAX_BACKSPIN_TILT * tiltAmount;
          applyCueButtTilt(
            cueStick,
            extraTilt + obstructionTilt + obstructionTiltFromLift,
            CUE_Y + spinWorld.y + obstructionLift * 0.25
          );
          cueStick.rotation.y = Math.atan2(dir.x, dir.z) + Math.PI;
          if (tipGroupRef.current) {
            tipGroupRef.current.position.set(0, 0, -cueLen / 2);
          }
          cueStick.position.copy(warmupPos);
          cueAnimating = true;
          const topSpinWeight = Math.max(0, -(appliedSpin.y || 0));
          const backSpinWeight = Math.max(0, appliedSpin.y || 0);
          const strokeDistance = Math.max(visualPull, CUE_PULL_MIN_VISUAL);
          const topSpinFollowThrough =
            BALL_R * (1 + 3 * clampedPower) * topSpinWeight;
          const backSpinRetreat =
            BALL_R * (1 + 2.25 * clampedPower) * backSpinWeight;
          const forwardDistance = strokeDistance + topSpinFollowThrough;
          const impactPos = startPos
            .clone()
            .add(dir.clone().multiplyScalar(Math.max(forwardDistance, 0)));
          const retreatDistance = Math.max(
            BALL_R * 1.5,
            Math.min(strokeDistance, BALL_R * 8)
          );
          const totalRetreat = retreatDistance + backSpinRetreat;
          const settlePos = impactPos
            .clone()
            .sub(dir.clone().multiplyScalar(totalRetreat));
          cueStick.visible = true;
          cueStick.position.copy(warmupPos);
          const forwardSpeed = THREE.MathUtils.lerp(
            CUE_STROKE_SPEED_MIN,
            CUE_STROKE_SPEED_MAX,
            clampedPower
          );
          const forwardDurationBase = THREE.MathUtils.clamp(
            (forwardDistance / Math.max(forwardSpeed, 1e-4)) * 1000,
            CUE_STROKE_MIN_MS,
            CUE_STROKE_MAX_MS
          );
          const settleSpeed = THREE.MathUtils.lerp(
            CUE_FOLLOW_SPEED_MIN,
            CUE_FOLLOW_SPEED_MAX,
            clampedPower
          );
          const settleDurationBase = THREE.MathUtils.clamp(
            (totalRetreat / Math.max(settleSpeed, 1e-4)) * 1000 * (backSpinWeight > 0 ? 0.82 : 1),
            CUE_FOLLOW_MIN_MS,
            CUE_FOLLOW_MAX_MS
          );
          const aiStrokeScale =
            aiOpponentEnabled && hudRef.current?.turn === 1 ? AI_STROKE_TIME_SCALE : 1;
          const playerStrokeScale = isAiStroke ? 1 : PLAYER_STROKE_TIME_SCALE;
          const playerForwardScale = isAiStroke ? 1 : PLAYER_FORWARD_SLOWDOWN;
          const forwardDuration = isAiStroke
            ? AI_CUE_FORWARD_DURATION_MS
            : forwardDurationBase * aiStrokeScale * playerStrokeScale * playerForwardScale;
          const settleDuration = isAiStroke
            ? 0
            : settleDurationBase * aiStrokeScale * playerStrokeScale;
          const pullbackDuration = isAiStroke
            ? AI_CUE_PULLBACK_DURATION_MS
            : Math.max(
                CUE_STROKE_MIN_MS * PLAYER_PULLBACK_MIN_SCALE,
                forwardDuration * PLAYER_STROKE_PULLBACK_FACTOR
              );
          const startTime = performance.now();
          const pullEndTime = startTime + pullbackDuration;
          const impactTime = pullEndTime + forwardDuration;
          const settleTime = impactTime + settleDuration;
          const forwardPreviewHold =
            impactTime +
            Math.min(
              settleDuration,
              Math.max(180, forwardDuration * 0.9)
            );
          powerImpactHoldRef.current = Math.max(
            powerImpactHoldRef.current || 0,
            forwardPreviewHold
          );
          const holdUntil = powerImpactHoldRef.current || 0;
          const holdActive = holdUntil > performance.now();
          if (holdActive) {
            if (activeShotView?.mode === 'pocket') {
              queuedPocketView = activeShotView;
              queuedPocketView.pendingActivation = true;
              queuedPocketView.activationDelay = Math.max(
                queuedPocketView.activationDelay ?? 0,
                holdUntil
              );
              activeShotView = null;
              updatePocketCameraState(false);
            } else if (queuedPocketView) {
              queuedPocketView.pendingActivation = true;
              queuedPocketView.activationDelay = Math.max(
                queuedPocketView.activationDelay ?? 0,
                holdUntil
              );
            }
            if (activeShotView?.mode === 'action') {
              suspendedActionView = activeShotView;
              activeShotView = null;
            }
            if (suspendedActionView?.mode === 'action') {
              suspendedActionView.pendingActivation = true;
              const baseDelay = suspendedActionView.activationDelay ?? 0;
              suspendedActionView.activationDelay = Math.max(baseDelay, holdUntil);
            }
          }
          if (shotRecording) {
            const strokeStartOffset = Math.max(0, startTime - (shotRecording.startTime ?? startTime));
            shotRecording.cueStroke = {
              warmup: serializeVector3Snapshot(warmupPos),
              start: serializeVector3Snapshot(startPos),
              impact: serializeVector3Snapshot(impactPos),
              settle: serializeVector3Snapshot(settlePos),
              rotationX: cueStick.rotation.x,
              rotationY: cueStick.rotation.y,
              pullbackDuration,
              forwardDuration,
              settleDuration,
              startOffset: strokeStartOffset
            };
          }
          const animateStroke = (now) => {
            if (now <= pullEndTime && pullbackDuration > 0) {
              const t = pullbackDuration > 0 ? THREE.MathUtils.clamp((now - startTime) / pullbackDuration, 0, 1) : 1;
              cueStick.position.lerpVectors(warmupPos, startPos, t);
            } else if (now <= impactTime) {
              const t = forwardDuration > 0 ? THREE.MathUtils.clamp((now - pullEndTime) / forwardDuration, 0, 1) : 1;
              cueStick.position.lerpVectors(startPos, impactPos, t);
            } else if (now <= settleTime) {
              const t = settleDuration > 0 ? THREE.MathUtils.clamp((now - impactTime) / settleDuration, 0, 1) : 1;
              cueStick.position.lerpVectors(impactPos, settlePos, t);
            } else {
              cueStick.visible = false;
              cueAnimating = false;
              cuePullCurrentRef.current = 0;
              cuePullTargetRef.current = 0;
              if (cameraRef.current && sphRef.current) {
                topViewRef.current = false;
                topViewLockedRef.current = false;
                setIsTopDownView(false);
                const sph = sphRef.current;
                sph.theta = Math.atan2(aimDir.x, aimDir.y) + Math.PI;
                updateCamera();
              }
              return;
            }
            requestAnimationFrame(animateStroke);
          };
          requestAnimationFrame(animateStroke);
        };
        let aiThinkingHandle = null;
        const planKey = (plan) =>
          plan
            ? `${plan.type}:${plan.target ?? ''}:${plan.pocketId ?? 'SAFETY'}`
            : 'none';
        const summarizePlan = (plan) => {
          if (!plan) return null;
          return {
            key: planKey(plan),
            type: plan.type,
            target: plan.target,
            pocketId: plan.pocketId ?? 'SAFETY',
            power: plan.power,
            spin: {
              x: Number.isFinite(plan.spin?.x) ? plan.spin.x : 0,
              y: Number.isFinite(plan.spin?.y) ? plan.spin.y : 0
            },
            difficulty: plan.difficulty ?? 0
          };
        };
        const resolveAiPreviewDelay = () => {
          const now = performance.now();
          const startedAt = aiShotWindowRef.current?.startedAt ?? now;
          const duration = aiShotWindowRef.current?.duration ?? AI_MIN_SHOT_TIME_MS;
          const elapsed = Math.max(0, now - startedAt);
          const maxRemaining = Math.max(0, AI_MAX_SHOT_TIME_MS - elapsed);
          const targetRemaining = duration - elapsed;
          const desiredWindow = Math.max(AI_MIN_AIM_PREVIEW_MS, targetRemaining);
          return Math.min(maxRemaining, desiredWindow);
        };
        const scheduleEarlyAiShot = (plan) => {
          if (!plan || plan.type !== 'pot') {
            clearEarlyAiShot();
            return;
          }
          const easyPot =
            (plan.difficulty ?? Infinity) <= AI_EARLY_SHOT_DIFFICULTY &&
            (plan.cueToTarget ?? Infinity) <= AI_EARLY_SHOT_CUE_DISTANCE;
          if (!easyPot) {
            clearEarlyAiShot();
            return;
          }
          const key = planKey(plan);
          const currentIntent = aiEarlyShotIntentRef.current;
          if (currentIntent?.key === key) return;
          clearEarlyAiShot();
          const previewDelay = resolveAiPreviewDelay();
          const timeout = window.setTimeout(() => {
            aiEarlyShotIntentRef.current = null;
            if (
              hudRef.current?.turn === 1 &&
              !shooting &&
              aiPlanRef.current &&
              planKey(aiPlanRef.current) === key
            ) {
              aiShoot.current();
            }
          }, Math.max(AI_EARLY_SHOT_DELAY_MS, previewDelay));
          aiEarlyShotIntentRef.current = { key, timeout };
        };
        const MAX_ROUTE_DISTANCE =
          Math.hypot(PLAY_W, PLAY_H) + Math.max(PLAY_W, PLAY_H);
        const computePowerFromDistance = (dist) => {
          const n = THREE.MathUtils.clamp(dist / MAX_ROUTE_DISTANCE, 0, 1);
          return THREE.MathUtils.lerp(0.35, 0.9, n);
        };
        const computePlanSpin = (plan, stateSnapshot) => {
          const fallback = { x: 0, y: -0.1 };
          if (!plan || plan.type !== 'pot') return fallback;
          const colorId = plan.target;
          if (!colorId) return fallback;
          try {
            const events = [
              {
                type: 'HIT',
                firstContact: colorId,
                ballId: plan.targetBall?.id ?? null
              },
              {
                type: 'POTTED',
                ball: colorId,
                pocket: plan.pocketId ?? 'TL',
                ballId: plan.targetBall?.id ?? null
              }
            ];
            const simContext = {
              placedFromHand: false,
              cueBallPotted: false,
              contactMade: true,
              cushionAfterContact: true,
              noCushionAfterContact: false,
              variant: activeVariantRef.current?.id ?? variantKey,
              simulated: true
            };
            const nextState = rules.applyShot(stateSnapshot, events, simContext);
            const nextTargetsRaw = Array.isArray(nextState?.ballOn)
              ? nextState.ballOn.map((entry) =>
                  typeof entry === 'string' ? entry.toUpperCase() : entry
                )
              : [];
            const nextTargets = new Set(nextTargetsRaw);
            let nextBall = null;
            if (nextTargets.size > 0) {
              nextBall = balls.find(
                (b) =>
                  b.active &&
                  b !== plan.targetBall &&
                  nextTargets.has(toBallColorId(b.id))
              );
            }
            if (!nextBall && nextTargets.has('RED')) {
              nextBall = balls.find(
                (b) => b.active && toBallColorId(b.id) === 'RED'
              );
            }
            if (!nextBall) return fallback;
            const aimDir = plan.aimDir.clone();
            if (aimDir.lengthSq() < 1e-6) return fallback;
            aimDir.normalize();
            const nextDir = nextBall.pos.clone().sub(plan.targetBall.pos);
            if (nextDir.lengthSq() < 1e-6) return fallback;
            nextDir.normalize();
            const perp = new THREE.Vector2(-aimDir.y, aimDir.x);
            const lateral = THREE.MathUtils.clamp(perp.dot(nextDir), -1, 1);
            const forward = THREE.MathUtils.clamp(aimDir.dot(nextDir), -1, 1);
            const spinX = THREE.MathUtils.clamp(lateral * 0.45, -0.6, 0.6);
            const spinY = THREE.MathUtils.clamp(
              -forward * (MAX_SPIN_FORWARD / BALL_R),
              -1,
              1
            );
            return { x: spinX, y: spinY };
          } catch (err) {
            console.warn('spin prediction failed', err);
            return fallback;
          }
        };
        const normalizeTargetId = (value) => {
          if (typeof value === 'string') return value.toUpperCase();
          return null;
        };
        const isBallTargetId = (id) =>
          typeof id === 'string' &&
          (/^BALL_(\d+)/.test(id) ||
            [
              'RED',
              'YELLOW',
              'BLUE',
              'BLACK',
              'PINK',
              'GREEN',
              'BROWN',
              'STRIPE',
              'SOLID'
            ].includes(id));
        const parseBallNumber = (id) => {
          if (typeof id !== 'string') return null;
          const match = /^BALL_(\d+)/.exec(id);
          return match ? parseInt(match[1], 10) : null;
        };
        const mapAssignmentToTargets = (assignment, variantId) => {
          if (!assignment) return [];
          const normalized = normalizeTargetId(assignment);
          if (normalized === 'RED') return ['RED'];
          if (normalized === 'BLUE' || normalized === 'YELLOW') {
            return variantId === 'american' ? ['SOLID'] : ['YELLOW', 'BLUE'];
          }
          if (normalized === 'BLACK') return ['BLACK', 'BALL_8'];
          if (normalized === 'SOLID' || normalized === 'SOLIDS') return ['SOLID'];
          if (normalized === 'STRIPE' || normalized === 'STRIPES') return ['STRIPE'];
          return [];
        };
        const mapNumberToGroup = (id) => {
          const num = parseBallNumber(id);
          if (num == null) return null;
          if (num === 8) return 'BLACK';
          if (num >= 9) return 'STRIPE';
          return 'SOLID';
        };
        const matchesTargetId = (ball, targetId) => {
          if (!ball || !targetId) return false;
          const normalizedTarget = normalizeTargetId(targetId);
          if (!normalizedTarget) return false;
          const colorId = toBallColorId(ball.id);
          if (!colorId) return false;
          const numericGroup = mapNumberToGroup(colorId);
          if (normalizedTarget === 'BLACK') {
            return colorId === 'BLACK' || numericGroup === 'BLACK';
          }
          if (normalizedTarget === 'SOLID') {
            return colorId === 'SOLID' || numericGroup === 'SOLID';
          }
          if (normalizedTarget === 'STRIPE') {
            return colorId === 'STRIPE' || numericGroup === 'STRIPE';
          }
          if (normalizedTarget === 'YELLOW' || normalizedTarget === 'BLUE') {
            return colorId === 'YELLOW' || colorId === 'BLUE';
          }
          return colorId === normalizedTarget;
        };
        const resolveTargetPriorities = (frameSnapshot, activeVariantId, activeBalls) => {
          const order = [];
          const pushTargetId = (id) => {
            const normalized = normalizeTargetId(id);
            if (!normalized || !isBallTargetId(normalized)) return;
            if (!order.includes(normalized)) order.push(normalized);
          };
          const metaState = frameSnapshot?.meta?.state ?? null;
          const shooterSeat = frameSnapshot?.activePlayer === 'B' ? 'B' : 'A';
          const assignments = metaState?.assignments ?? {};
          const assignmentTargets = mapAssignmentToTargets(
            shooterSeat ? assignments[shooterSeat] : null,
            activeVariantId
          );
          assignmentTargets.forEach((id) => pushTargetId(id));
          const legalTargetsRaw = frameSnapshot?.ballOn ?? [];
          if (Array.isArray(legalTargetsRaw)) {
            legalTargetsRaw.forEach((entry) => {
              const normalized = normalizeTargetId(entry);
              if (normalized) {
                pushTargetId(normalized);
                const numericGroup = mapNumberToGroup(normalized);
                if (numericGroup) pushTargetId(numericGroup);
              }
            });
          }
          const shooterSeatRef = shooterSeat && lastPottedBySeatRef.current
            ? lastPottedBySeatRef.current[shooterSeat]
            : null;
          const lastPotId = normalizeTargetId(
            shooterSeatRef?.id ? toBallColorId(shooterSeatRef.id) : shooterSeatRef?.color
          );
          if (lastPotId) {
            pushTargetId(lastPotId);
            const numericGroup = mapNumberToGroup(lastPotId);
            if (numericGroup) pushTargetId(numericGroup);
          }
          if (
            assignmentTargets.length > 0 &&
            !activeBalls.some((ball) =>
              assignmentTargets.some((target) => matchesTargetId(ball, target))
            )
          ) {
            pushTargetId('BLACK');
          }
          const hasAnyNonBlackTargets = activeBalls.some(
            (ball) => !matchesTargetId(ball, 'BLACK')
          );
          if (!hasAnyNonBlackTargets && activeBalls.some((ball) => matchesTargetId(ball, 'BLACK'))) {
            pushTargetId('BLACK');
          }
          return order;
        };
        const pocketCentersCached = pocketEntranceCenters();
        const scoreBallForAim = (ball, cuePos) => {
          if (!ball || !cuePos) return -Infinity;
          const cueDist = cuePos.distanceTo(ball.pos);
          const nearestPocket = pocketCentersCached.reduce(
            (min, pocket) => Math.min(min, ball.pos.distanceTo(pocket)),
            Infinity
          );
          const pocketEase = Math.max(0, 1 - nearestPocket / Math.max(PLAY_W, PLAY_H));
          const cueEase = Math.max(0, 1 - cueDist / Math.max(PLAY_W, PLAY_H));
          return pocketEase * 0.65 + cueEase * 0.35;
        };
        const pickPreferredBall = (targets, candidateBalls, cuePos) => {
          for (const targetId of targets) {
            const matches = candidateBalls.filter((ball) => matchesTargetId(ball, targetId));
            if (matches.length > 0) {
              return matches.reduce((best, ball) => {
                if (!best) return ball;
                const bestScore =
                  scoreBallForAim(best, cuePos) *
                  (isDirectLaneOpen(best) ? 1 : 0.35);
                const score =
                  scoreBallForAim(ball, cuePos) *
                  (isDirectLaneOpen(ball) ? 1 : 0.35);
                return score > bestScore ? ball : best;
              }, null);
            }
          }
          return null;
        };

        const evaluateShotOptionsBaseline = () => {
          if (!cue?.active) return { bestPot: null, bestSafety: null };
          const state = frameRef.current ?? frameState;
          const activeVariantId = activeVariantRef.current?.id ?? variantKey;
          const activeBalls = balls.filter((b) => b.active);
          const targetOrder = resolveTargetPriorities(state, activeVariantId, activeBalls);
          const legalTargetsRaw =
            targetOrder.length > 0
              ? targetOrder
              : Array.isArray(state?.ballOn)
                ? state.ballOn
                : ['RED'];
          const legalTargets = new Set(
            legalTargetsRaw
              .map((entry) => normalizeTargetId(entry))
              .filter((entry) => entry && isBallTargetId(entry))
          );
          if (legalTargets.size === 0) {
            if (activeVariantId === 'american' || activeVariantId === '9ball') {
              const lowestActive = activeBalls
                .filter((b) => b.id !== 0)
                .reduce(
                  (best, ball) => (best == null || ball.id < best.id ? ball : best),
                  null
                );
              const mapped = lowestActive ? toBallColorId(lowestActive.id) : null;
              if (mapped) legalTargets.add(mapped);
            }
            if (legalTargets.size === 0) legalTargets.add('RED');
          }
          const cuePos = cue.pos.clone();
          const clearance = BALL_R * (activeVariantId === 'uk' ? 1.4 : 1.65);
          const clearanceSq = clearance * clearance;
          const ballDiameter = BALL_R * 2;
          const safetyAnchor = new THREE.Vector2(0, baulkZ - D_RADIUS * 0.5);
          const halfW = PLAY_W / 2;
          const halfH = PLAY_H / 2;
          const cushionMargin = BALL_R * 1.4;
          const isPathClear = (start, end, ignoreIds = new Set()) => {
            const delta = end.clone().sub(start);
            const lenSq = delta.lengthSq();
            if (lenSq < 1e-6) return true;
            const len = Math.sqrt(lenSq);
            const dir = delta.clone().divideScalar(len);
            for (const ball of activeBalls) {
              if (!ball.active || ignoreIds.has(ball.id)) continue;
              const rel = ball.pos.clone().sub(start);
              const proj = THREE.MathUtils.clamp(rel.dot(dir), 0, len);
              const closest = start.clone().add(dir.clone().multiplyScalar(proj));
              const distSq = ball.pos.distanceToSquared(closest);
              if (distSq < clearanceSq) return false;
            }
            return true;
          };
          const detectScratchRisk = (plan) => {
            if (!plan?.aimDir || !cuePos) return false;
            const dir = plan.aimDir.clone().normalize();
            const maxTravel =
              Number.isFinite(plan?.cueToTarget) && plan.cueToTarget > BALL_R * 2
                ? plan.cueToTarget
                : Math.max(PLAY_W, PLAY_H);
            const scratchRadiusSq = (BALL_R * 1.05) * (BALL_R * 1.05);
            return centers.some((pocket) => {
              const toPocket = pocket.clone().sub(cuePos);
              const proj = toPocket.dot(dir);
              if (proj <= 0 || proj >= maxTravel) return false;
              const closest = cuePos.clone().add(dir.clone().multiplyScalar(proj));
              return pocket.distanceToSquared(closest) < scratchRadiusSq;
            });
          };
          const isAimLaneBlocked = (plan) => {
            if (!plan?.aimDir || !plan?.cueToTarget) return false;
            if (plan.viaCushion) return false;
            const aimTarget = cuePos.clone().add(
              plan.aimDir.clone().normalize().multiplyScalar(plan.cueToTarget)
            );
            const ignore = new Set([cue.id]);
            if (plan.targetBall?.id != null) ignore.add(plan.targetBall.id);
            return !isPathClear(cuePos, aimTarget, ignore);
          };
          const measureLaneClearance = (plan) => {
            if (!plan?.aimDir || !plan?.cueToTarget || !cuePos) return 1;
            const aimTarget = cuePos.clone().add(
              plan.aimDir.clone().normalize().multiplyScalar(plan.cueToTarget)
            );
            const ignore = new Set([cue.id]);
            if (plan.targetBall?.id != null) ignore.add(plan.targetBall.id);
            let minClearanceSq = Infinity;
            activeBalls.forEach((ball) => {
              if (!ball.active || ignore.has(ball.id)) return;
              const rel = ball.pos.clone().sub(cuePos);
              const delta = aimTarget.clone().sub(cuePos);
              const lenSq = delta.lengthSq();
              if (lenSq < 1e-6) return;
              const t = THREE.MathUtils.clamp(rel.dot(delta) / lenSq, 0, 1);
              const closest = cuePos.clone().add(delta.multiplyScalar(t));
              const dSq = ball.pos.distanceToSquared(closest);
              if (dSq < minClearanceSq) minClearanceSq = dSq;
            });
            if (!Number.isFinite(minClearanceSq)) {
              plan.laneClearance = 1;
              return 1;
            }
            const clearance = Math.sqrt(minClearanceSq) / Math.max(BALL_R * 2, 1e-6);
            const normalized = THREE.MathUtils.clamp(clearance, 0, 2);
            plan.laneClearance = normalized;
            return normalized;
          };
          const isPlayablePlan = (plan, { allowCushion = true } = {}) => {
            if (!plan) return false;
            const qualityOk = (plan.quality ?? 0) >= 0.12;
            if (!qualityOk) return false;
            if (!allowCushion && plan.viaCushion) return false;
            if (isAimLaneBlocked(plan)) return false;
            if (measureLaneClearance(plan) < 0.6) return false;
            if (detectScratchRisk(plan)) return false;
            return true;
          };
          const tryCushionRoute = (start, target, ignoreIds = new Set()) => {
            const walls = [
              { axis: 'x', wall: halfW - cushionMargin, normal: new THREE.Vector2(-1, 0) },
              { axis: 'x', wall: -halfW + cushionMargin, normal: new THREE.Vector2(1, 0) },
              { axis: 'y', wall: halfH - cushionMargin, normal: new THREE.Vector2(0, -1) },
              { axis: 'y', wall: -halfH + cushionMargin, normal: new THREE.Vector2(0, 1) }
            ];
            const routes = [];
            walls.forEach((entry) => {
              const mirrored = target.clone();
              if (entry.axis === 'x') {
                mirrored.x = entry.wall + (entry.wall - target.x);
              } else {
                mirrored.y = entry.wall + (entry.wall - target.y);
              }
              const dir = mirrored.clone().sub(start);
              if (dir.lengthSq() < 1e-6) return;
              const t =
                entry.axis === 'x'
                  ? (entry.wall - start.x) / dir.x
                  : (entry.wall - start.y) / dir.y;
              if (t <= 0 || t >= 1) return;
              const cushionPoint = start.clone().add(dir.clone().multiplyScalar(t));
              if (
                Math.abs(cushionPoint.x) > halfW - cushionMargin ||
                Math.abs(cushionPoint.y) > halfH - cushionMargin
              ) {
                return;
              }
              if (
                !isPathClear(start, cushionPoint, ignoreIds) ||
                !isPathClear(cushionPoint, target, ignoreIds)
              ) {
                return;
              }
              const totalDist =
                cushionPoint.distanceTo(start) + cushionPoint.distanceTo(target);
              routes.push({
                totalDist,
                cushionPoint,
                railNormal: entry.normal.clone()
              });
            });
            if (routes.length === 0) return null;
            routes.sort((a, b) => a.totalDist - b.totalDist);
            return routes[0];
          };
          const centers = pocketEntranceCenters();
          const potShots = [];
          const safetyShots = [];
          let fallbackPlan = null;
          activeBalls.forEach((targetBall) => {
            if (targetBall === cue) return;
            const colorId = toBallColorId(targetBall.id);
            const targetAllowed =
              legalTargets.size > 0 &&
              Array.from(legalTargets).some((id) => matchesTargetId(targetBall, id));
            if (!colorId || !targetAllowed) return;
            const ignore = new Set([cue.id, targetBall.id]);
            const directClear = isPathClear(cuePos, targetBall.pos, ignore);
            for (let i = 0; i < centers.length; i++) {
              const pocketCenter = centers[i];
              const toPocket = pocketCenter.clone().sub(targetBall.pos);
              const toPocketLenSq = toPocket.lengthSq();
              if (toPocketLenSq < ballDiameter * ballDiameter * 0.25) continue;
              const toPocketLen = Math.sqrt(toPocketLenSq);
              const toPocketDir = toPocket.clone().divideScalar(toPocketLen);
              if (!isPathClear(targetBall.pos, pocketCenter, ignore)) continue;
              const pocketMouth = i >= 4 ? POCKET_SIDE_MOUTH : POCKET_CORNER_MOUTH;
              const idealEntryDir = pocketCenter.clone().normalize().multiplyScalar(-1);
              const entryAlignment = Math.max(
                0.1,
                toPocketDir.clone().normalize().dot(idealEntryDir)
              );
              const entranceFavor = THREE.MathUtils.clamp(
                entryAlignment * (pocketMouth / POCKET_CORNER_MOUTH),
                0.2,
                2.8
              );
              const ghost = targetBall.pos
                .clone()
                .sub(toPocketDir.clone().multiplyScalar(ballDiameter));
              const directGhostClear = isPathClear(cuePos, ghost, ignore);
              let cueVec = ghost.clone().sub(cuePos);
              let cueDist = cueVec.length();
              let cushionAid = null;
              if (!directGhostClear) {
                cushionAid = tryCushionRoute(cuePos, ghost, ignore);
                if (cushionAid) {
                  cueVec = cushionAid.cushionPoint.clone().sub(cuePos);
                  cueDist = cueVec.length();
                } else if (!directClear) {
                  continue;
                } else {
                  continue;
                }
              }
              if (cueDist < 1e-6) continue;
              const aimDir = cueVec.clone().normalize();
              const impactNormal = targetBall.pos.clone().sub(ghost).normalize();
              const cutCos = THREE.MathUtils.clamp(
                impactNormal.dot(aimDir),
                -1,
                1
              );
              const cutAngle = Math.acos(Math.abs(cutCos));
              const totalDist = cueDist + toPocketLen;
              const cushionTax = cushionAid ? BALL_R * 30 + cushionAid.totalDist * 0.08 : 0;
              const baseDifficulty =
                cueDist + toPocketLen * 1.15 + cutAngle * BALL_R * 40 + cushionTax;
              const plan = {
                type: 'pot',
                aimDir,
                power: computePowerFromDistance(totalDist + cushionTax),
                target: colorId,
                targetBall,
                pocketId: POCKET_IDS[i],
                pocketCenter: pocketCenter.clone(),
                difficulty: baseDifficulty / entranceFavor,
                cueToTarget: cueDist,
                targetToPocket: toPocketLen,
                railNormal: cushionAid?.railNormal ?? null,
                viaCushion: Boolean(cushionAid)
              };
              const leaveProbe = targetBall.pos
                .clone()
                .add(aimDir.clone().multiplyScalar(ballDiameter * 2.5));
              const nearestAfter = activeBalls
                .filter((other) => other.active && other !== targetBall && other !== cue)
                .reduce((min, other) => Math.min(min, leaveProbe.distanceTo(other.pos)), Infinity);
              const openLaneScore = THREE.MathUtils.clamp(
                nearestAfter / (BALL_R * 4),
                0,
                3
              );
              plan.difficulty = plan.difficulty / (1 + openLaneScore * 0.2);
              const viewAngle = Math.atan2(ballDiameter, toPocketLen);
              const viewScore = Math.min(viewAngle / (Math.PI / 2), 1);
              const openLaneNorm = THREE.MathUtils.clamp(openLaneScore / 3, 0, 1);
              const cutSeverity = Math.min(cutAngle / (Math.PI / 2), 1);
              const travelPenalty = Math.min(
                (cueDist + toPocketLen) / Math.max(PLAY_W, PLAY_H, BALL_R),
                1
              );
              const cushionPenalty = cushionAid ? 0.18 : 0;
              plan.quality = THREE.MathUtils.clamp(
                0.32 * entryAlignment +
                  0.24 * (1 - cutSeverity) +
                  0.16 * openLaneNorm +
                  0.14 * (1 - travelPenalty) +
                  0.14 * viewScore -
                  cushionPenalty,
                0,
                1
              );
              plan.spin = computePlanSpin(plan, state);
              potShots.push(plan);
            }
            const cueToBall = targetBall.pos.clone().sub(cuePos);
            if (cueToBall.lengthSq() < 1e-6) return;
            const cueDist = cueToBall.length();
            const safetyDist = targetBall.pos.distanceTo(safetyAnchor);
            if (!directClear) {
              const blockedPlan = {
                type: 'safety',
                aimDir: cueToBall.clone().normalize(),
                power: computePowerFromDistance((cueDist + safetyDist) * 0.6),
                target: colorId,
                targetBall,
                pocketId: 'SAFETY',
                difficulty: cueDist + safetyDist * 2 + 400,
                cueToTarget: cueDist,
                targetToPocket: safetyDist,
                spin: { x: 0, y: -0.05 },
                quality: Math.max(
                  0,
                  1 - (cueDist + safetyDist * 2) / (PLAY_W + PLAY_H)
                )
              };
              if (!fallbackPlan || blockedPlan.difficulty < fallbackPlan.difficulty) {
                fallbackPlan = blockedPlan;
              }
              return;
            }
              const safetyPlan = {
                type: 'safety',
                aimDir: cueToBall.clone().normalize(),
                power: computePowerFromDistance((cueDist + safetyDist) * 0.85),
                target: colorId,
              targetBall,
              pocketId: 'SAFETY',
                difficulty: cueDist + safetyDist * 1.2,
                cueToTarget: cueDist,
                targetToPocket: safetyDist,
                spin: { x: 0, y: -0.2 },
                quality: Math.max(
                  0,
                  1 - (cueDist + safetyDist * 1.2) / (PLAY_W + PLAY_H)
                )
              };
            safetyShots.push(safetyPlan);
          });
          if (!potShots.length && (activeVariantId === 'american' || activeVariantId === '9ball')) {
            const targetBall = activeBalls
              .filter((b) => b.id !== cue.id)
              .sort((a, b) => a.id - b.id)[0];
            if (targetBall) {
              const pocketCenter = centers
                .slice()
                .sort(
                  (a, b) =>
                    targetBall.pos.distanceToSquared(a) - targetBall.pos.distanceToSquared(b)
                )[0];
              if (pocketCenter) {
                const toPocketDir = pocketCenter.clone().sub(targetBall.pos).normalize();
                const ghost = targetBall.pos
                  .clone()
                  .sub(toPocketDir.clone().multiplyScalar(ballDiameter));
                const cueVec = ghost.clone().sub(cuePos);
                if (cueVec.lengthSq() < 1e-6) cueVec.set(0, 1);
                const aimDir = cueVec.clone().normalize();
                const cueDist = cueVec.length();
                const toPocket = targetBall.pos.distanceTo(pocketCenter);
                const power = computePowerFromDistance(cueDist + toPocket);
                const entryAlignment = Math.max(
                  0,
                  toPocketDir
                    .clone()
                    .normalize()
                    .dot(pocketCenter.clone().normalize().multiplyScalar(-1))
                );
                const cutCos = THREE.MathUtils.clamp(
                  targetBall.pos.clone().sub(ghost).normalize().dot(aimDir),
                  -1,
                  1
                );
                const cutAngle = Math.acos(Math.abs(cutCos));
                const cutSeverity = Math.min(cutAngle / (Math.PI / 2), 1);
                const travelPenalty = Math.min(
                  (cueDist + toPocket) / Math.max(PLAY_W, PLAY_H, BALL_R),
                  1
                );
                const viewAngle = Math.atan2(ballDiameter, toPocket);
                const viewScore = Math.min(viewAngle / (Math.PI / 2), 1);
                const quality = THREE.MathUtils.clamp(
                  0.32 * entryAlignment +
                    0.24 * (1 - cutSeverity) +
                    0.18 * (1 - travelPenalty) +
                    0.14 * viewScore +
                    0.12,
                  0,
                  1
                );
                potShots.push({
                  type: 'pot',
                  aimDir,
                  power,
                  target: toBallColorId(targetBall.id),
                  targetBall,
                  pocketId: POCKET_IDS[centers.indexOf(pocketCenter)] ?? 'TM',
                  pocketCenter: pocketCenter.clone(),
                  difficulty: cueDist + toPocket,
                  cueToTarget: cueDist,
                  targetToPocket: toPocket,
                  railNormal: null,
                  viaCushion: false,
                  quality,
                  spin: computePlanSpin(
                    {
                      type: 'pot',
                      aimDir,
                      power,
                      target: toBallColorId(targetBall.id),
                      targetBall,
                      pocketId: POCKET_IDS[centers.indexOf(pocketCenter)] ?? 'TM',
                      pocketCenter: pocketCenter.clone(),
                      difficulty: cueDist + toPocket,
                      cueToTarget: cueDist,
                      targetToPocket: toPocket,
                      railNormal: null,
                      viaCushion: false,
                      quality
                    },
                    state
                  )
                });
              }
            }
          }
          if (!potShots.length && !safetyShots.length && fallbackPlan) {
            if (fallbackPlan.quality == null) {
              fallbackPlan.quality = Math.max(
                0,
                1 - fallbackPlan.difficulty / (PLAY_W + PLAY_H)
              );
            }
            safetyShots.push(fallbackPlan);
          }
          const scorePotPlan = (plan) => {
            if (!plan) return -Infinity;
            if (detectScratchRisk(plan)) return -Infinity;
            if (isAimLaneBlocked(plan)) return -Infinity;
            const laneClearance = measureLaneClearance(plan);
            if (laneClearance < 0.5) return -Infinity;
            const difficultyNorm = Math.max(1, PLAY_W + PLAY_H);
            const difficulty = Number.isFinite(plan.difficulty)
              ? plan.difficulty
              : difficultyNorm;
            const difficultyEase = 1 - Math.min(difficulty / difficultyNorm, 1);
            const targetToPocket = Number.isFinite(plan.targetToPocket)
              ? plan.targetToPocket
              : Math.max(PLAY_W, PLAY_H);
            const cueToTarget = Number.isFinite(plan.cueToTarget)
              ? plan.cueToTarget
              : Math.max(PLAY_W, PLAY_H);
            const pocketEase = Math.max(
              0,
              1 - targetToPocket / Math.max(BALL_R * 24, 1e-3)
            );
            const cueEase = Math.max(0, 1 - cueToTarget / Math.max(PLAY_W, PLAY_H, BALL_R));
            const quality = plan.quality ?? 0;
            const routeEase = Math.max(
              0,
              1 - (cueToTarget + targetToPocket) / Math.max(PLAY_W, PLAY_H, BALL_R * 2)
            );
            const priorityIndex = targetOrder.findIndex((target) =>
              matchesTargetId(plan.targetBall, target)
            );
            const priorityBonus =
              priorityIndex >= 0 ? 1 - Math.min(priorityIndex * 0.18, 0.72) : 0;
            const cushionPenalty = plan.viaCushion ? 0.18 : 0;
            const finishBonus =
              activeBalls.filter((ball) => ball.active && matchesTargetId(ball, plan.target))
                .length <= 2
                ? 0.06
                : 0;
            const laneBonus = Math.max(0, Math.min((laneClearance - 0.6) / 0.8, 1));
            return (
              quality * 0.48 +
              difficultyEase * 0.18 +
              pocketEase * 0.1 +
              cueEase * 0.08 +
              priorityBonus * 0.1 +
              routeEase * 0.06 +
              laneBonus * 0.08 +
              finishBonus -
              cushionPenalty
            );
          };
          const scoredPots = potShots
            .map((plan) => ({ plan, score: scorePotPlan(plan) }))
            .sort(
              (a, b) =>
                b.score - a.score ||
                (a.plan?.difficulty ?? 0) - (b.plan?.difficulty ?? 0)
            );
          safetyShots.sort(
            (a, b) =>
              (b.quality ?? 0) - (a.quality ?? 0) ||
              a.difficulty - b.difficulty
          );
          const playableDirectPots = scoredPots.filter(
            (entry) => entry.plan && isPlayablePlan(entry.plan, { allowCushion: false })
          );
          const playableCushionPots = scoredPots.filter(
            (entry) => entry.plan && isPlayablePlan(entry.plan, { allowCushion: true })
          );
          const bestDirectPot = playableDirectPots[0]?.plan ?? null;
          const bestCushionPot =
            playableCushionPots.find((entry) => entry.plan?.viaCushion)?.plan ?? null;
          const bestPot = bestDirectPot ?? bestCushionPot ?? playableCushionPots[0]?.plan ?? null;
          const bestSafetyCandidate =
            safetyShots.find((plan) => isPlayablePlan(plan, { allowCushion: true })) ?? null;
          const bestSafety =
            activeVariantId === 'uk' && bestPot ? null : bestSafetyCandidate;
          return {
            bestPot,
            bestSafety
          };
        };

        const mapBallIdToUkAiColour = (colorId) => {
          if (!colorId) return null;
          const upper = colorId.toUpperCase();
          if (upper === 'CUE') return 'cue';
          if (upper.startsWith('YELLOW') || upper.startsWith('BLUE')) return 'blue';
          if (upper.startsWith('RED')) return 'red';
          if (upper.startsWith('BLACK')) return 'black';
          return null;
        };

        const resolveUkBallOnColour = (frameSnapshot, metaState) => {
          if (!metaState || metaState.isOpenTable) return null;
          const assignments = metaState.assignments ?? {};
          const current = metaState.currentPlayer ?? 'A';
          const assigned = assignments[current];
          if (assigned === 'blue' || assigned === 'yellow') return 'blue';
          if (assigned === 'red') return 'red';
          if (assigned === 'black') return 'black';
          const raw = Array.isArray(frameSnapshot?.ballOn)
            ? frameSnapshot.ballOn
            : [];
          const normalized = raw
            .map((entry) => (typeof entry === 'string' ? entry.toUpperCase() : ''))
            .filter(Boolean);
          if (normalized.includes('BLACK')) return 'black';
          if (normalized.some((entry) => entry === 'YELLOW' || entry === 'BLUE')) {
            return 'blue';
          }
          if (normalized.includes('RED')) return 'red';
          return null;
        };

        const mapLocalPocketToAi = (id) => {
          if (id === 'TM') return 'ML';
          if (id === 'BM') return 'MR';
          return id;
        };

        const mapAiPocketToLocal = (name) => {
          if (!name) return null;
          if (name === 'ML') return 'TM';
          if (name === 'MR') return 'BM';
          return POCKET_IDS.includes(name) ? name : null;
        };

        const mapAiColourToTargetId = (colour) => {
          if (!colour) return null;
          switch (colour) {
            case 'blue':
              return 'YELLOW';
            case 'red':
              return 'RED';
            case 'black':
              return 'BLACK';
            default:
              return colour.toUpperCase();
          }
        };

        const mapSpeedPresetScale = (speed) => {
          switch (speed) {
            case 'soft':
              return 0.78;
            case 'firm':
              return 1.18;
            case 'med':
            default:
              return 1;
          }
        };

        const mapSpinPreset = (preset) => {
          switch (preset) {
            case 'followS':
              return { x: 0, y: -0.18 };
            case 'followL':
              return { x: 0, y: -0.32 };
            case 'drawS':
              return { x: 0, y: 0.22 };
            case 'drawL':
              return { x: 0, y: 0.42 };
            case 'sideL':
              return { x: -0.35, y: -0.06 };
            case 'sideR':
              return { x: 0.35, y: -0.06 };
            default:
              return { x: 0, y: 0 };
          }
        };

        const computeUkAdvancedPlan = (allBalls, cueBall, frameSnapshot) => {
          if (!cueBall?.active) return null;
          const variantId = activeVariantRef.current?.id ?? variantKey;
          if (variantId !== 'uk') return null;
          const meta = frameSnapshot?.meta;
          if (!meta || meta.variant !== 'uk' || !meta.state) return null;
          const snapshot = meta.state;
          const width = PLAY_W;
          const height = PLAY_H;
          const toAi = (vec) => ({ x: vec.x + width / 2, y: vec.y + height / 2 });
          const pocketPositions = pocketEntranceCenters();
          const pockets = pocketPositions.map((center, idx) => {
            const aiPos = toAi(center);
            const localId = POCKET_IDS[idx] ?? `P${idx}`;
            return { x: aiPos.x, y: aiPos.y, name: mapLocalPocketToAi(localId) };
          });
          const aiBalls = [];
          allBalls.forEach((ball) => {
            const colourId = toBallColorId(ball.id);
            const aiColour = mapBallIdToUkAiColour(colourId);
            if (!aiColour) return;
            const pos = toAi(ball.pos);
            aiBalls.push({
              id: ball.id,
              colour: aiColour,
              x: pos.x,
              y: pos.y,
              pocketed: !ball.active
            });
          });
          if (!aiBalls.some((ball) => ball.colour === 'cue' && !ball.pocketed)) {
            return null;
          }
          const ballOnColour = resolveUkBallOnColour(frameSnapshot, snapshot);
          const baulkLineLocal =
            typeof baulkZ === 'number' ? baulkZ : -PLAY_H / 2 + BAULK_FROM_BAULK;
          const aiState = {
            balls: aiBalls,
            pockets,
            width,
            height,
            ballRadius: BALL_R,
            ballOn: ballOnColour,
            isOpenTable: snapshot.isOpenTable,
            shotsRemaining: snapshot.shotsRemaining,
            mustPlayFromBaulk: snapshot.mustPlayFromBaulk,
            baulkLineX: baulkLineLocal + height / 2
          };
          try {
            const plan = selectUkAiShot(aiState, {});
            if (!plan) return null;
            const aimPointRaw = plan.aimPoint;
            if (
              !aimPointRaw ||
              !Number.isFinite(aimPointRaw.x) ||
              !Number.isFinite(aimPointRaw.y)
            ) {
              return null;
            }
            const aimPoint = new THREE.Vector2(
              aimPointRaw.x - width / 2,
              aimPointRaw.y - height / 2
            );
            const aimDir = aimPoint.clone().sub(cueBall.pos);
            if (aimDir.lengthSq() < 1e-6) aimDir.set(0, 1);
            aimDir.normalize();
            const targetBall =
              allBalls.find(
                (b) => String(b.id) === String(plan.targetId)
              ) ||
              allBalls.find(
                (b) =>
                  b.active &&
                  mapBallIdToUkAiColour(toBallColorId(b.id)) === plan.targetBall
              ) ||
              null;
            const targetColor = mapAiColourToTargetId(plan.targetBall);
            const localPocketId = mapAiPocketToLocal(plan.pocket);
            const pocketIndex =
              localPocketId != null ? POCKET_IDS.indexOf(localPocketId) : -1;
            const pocketCenter =
              pocketIndex >= 0 ? pocketPositions[pocketIndex].clone() : null;
            const cueToAim = cueBall.pos.distanceTo(aimPoint);
            const pocketDistance =
              targetBall && pocketCenter
                ? targetBall.pos.distanceTo(pocketCenter)
                : 0;
            const basePower = computePowerFromDistance(cueToAim + pocketDistance);
            const power = THREE.MathUtils.clamp(
              basePower * mapSpeedPresetScale(plan.cueParams?.speed),
              0.3,
              0.95
            );
            const spin = mapSpinPreset(plan.cueParams?.spin);
            return {
              type: plan.actionType === 'pot' ? 'pot' : 'safety',
              aimDir,
              power,
              target: targetColor ?? 'SAFETY',
              targetBall,
              pocketId: localPocketId ?? 'SAFETY',
              pocketCenter: pocketCenter ? pocketCenter.clone() : null,
              difficulty:
                typeof plan.EV === 'number' ? (1 - plan.EV) * 1000 : undefined,
              cueToTarget: targetBall
                ? cueBall.pos.distanceTo(targetBall.pos)
                : cueToAim,
              targetToPocket: pocketDistance,
              spin,
              aiMeta: {
                EV: plan.EV ?? null,
                notes: plan.notes ?? null,
                source: 'advanced'
              }
            };
          } catch (err) {
            console.warn('advanced UK AI planning failed', err);
            return null;
          }
        };

        const evaluateShotOptions = () => {
          try {
            const baseline = evaluateShotOptionsBaseline();
            const variantId = activeVariantRef.current?.id ?? variantKey;
            if (variantId !== 'uk' || !cue?.active) return baseline;
            const stateSnapshot = frameRef.current ?? frameState;
            const advancedPlan = computeUkAdvancedPlan(balls, cue, stateSnapshot);
            if (!advancedPlan) return baseline;
            const result = { ...baseline };
            if (advancedPlan.type === 'pot') {
              result.bestPot = advancedPlan;
              if (!result.bestSafety) result.bestSafety = baseline.bestSafety;
            } else {
              result.bestSafety = advancedPlan;
              if (!result.bestPot) result.bestPot = baseline.bestPot;
            }
            return result;
          } catch (err) {
            console.warn('AI evaluation fallback', err);
            return evaluateShotOptionsBaseline();
          }
        };
        const updateAiPlanningState = (plan, options, countdownSeconds) => {
          const summary = summarizePlan(plan);
          const potSummary = summarizePlan(options?.bestPot ?? null);
          const safetySummary = summarizePlan(options?.bestSafety ?? null);
          const rounded = Math.ceil(Math.max(countdownSeconds, 0));
          const key = summary?.key ?? 'none';
          const last = aiTelemetryRef.current;
          if (!last || last.key !== key || last.rounded !== rounded) {
            aiTelemetryRef.current = {
              key,
              rounded,
              countdown: countdownSeconds
            };
            setAiPlanning({
              countdown: countdownSeconds,
              selected: summary,
              bestPot: potSummary,
              bestSafety: safetySummary
            });
          }
        };
        const stopAiThinking = () => {
          if (aiThinkingHandle) {
            cancelAnimationFrame(aiThinkingHandle);
            aiThinkingHandle = null;
          }
          clearEarlyAiShot();
        };
        const startAiThinking = () => {
          stopAiThinking();
          if (!cue?.active) {
            setAiPlanning(null);
            return;
          }
          const started = performance.now();
          const windowDuration = THREE.MathUtils.randInt(
            AI_MIN_SHOT_TIME_MS,
            AI_MAX_SHOT_TIME_MS
          );
          aiShotWindowRef.current = {
            startedAt: started,
            duration: windowDuration
          };
          const thinkingBudget = Math.min(
            AI_THINKING_BUDGET_MS,
            Math.max(AI_MIN_AIM_PREVIEW_MS, windowDuration - AI_MIN_AIM_PREVIEW_MS)
          );
          const deadline = started + thinkingBudget;
          const think = () => {
            if (shooting || hudRef.current?.turn !== 1) {
              setAiPlanning(null);
              aiPlanRef.current = null;
              aiThinkingHandle = null;
              clearEarlyAiShot();
              return;
            }
            const now = performance.now();
            const remaining = Math.max(0, deadline - now);
            const options = evaluateShotOptions();
            const plan = options.bestPot ?? options.bestSafety ?? null;
            if (plan) {
              aiPlanRef.current = plan;
              aimDirRef.current.copy(plan.aimDir);
              alignStandingCameraToAim(cue, plan.aimDir);
            } else {
              aiPlanRef.current = null;
              const fallbackDir = resolveAutoAimDirection();
              if (fallbackDir) {
                aimDirRef.current.copy(fallbackDir);
                alignStandingCameraToAim(cue, fallbackDir);
              }
            }
            updateAiPlanningState(plan, options, remaining / 1000);
            scheduleEarlyAiShot(plan);
            if (remaining > 0) {
              aiThinkingHandle = requestAnimationFrame(think);
            } else {
              aiThinkingHandle = null;
              if (!shooting) {
                aiShoot.current();
              }
            }
          };
          think();
        };
        const resolveAutoAimDirection = () => {
          if (!cue?.active) return null;
          const ballsList =
            ballsRef.current?.length > 0 ? ballsRef.current : balls;
          if (!Array.isArray(ballsList) || ballsList.length === 0) return null;
          const frameSnapshot = frameRef.current ?? frameState;
          const cuePos = cue?.pos
            ? new THREE.Vector2(cue.pos.x, cue.pos.y)
            : null;
          if (!cuePos) return null;

          const activeBalls = ballsList.filter(
            (ball) => ball.active && String(ball.id) !== 'cue'
          );
          if (activeBalls.length === 0) return null;
          const clearance = BALL_R * 1.5;
          const isDirectLaneOpen = (target) => {
            if (!target) return false;
            const dir = target.pos.clone().sub(cuePos);
            const lenSq = dir.lengthSq();
            if (lenSq < 1e-6) return false;
            const len = Math.sqrt(lenSq);
            const unit = dir.clone().divideScalar(len);
            for (const ball of activeBalls) {
              if (!ball.active) continue;
              if (ball.id === target.id || String(ball.id) === 'cue') continue;
              const rel = ball.pos.clone().sub(cuePos);
              const proj = THREE.MathUtils.clamp(rel.dot(unit), 0, len);
              const closest = cuePos.clone().add(unit.clone().multiplyScalar(proj));
              if (ball.pos.distanceToSquared(closest) < clearance * clearance) {
                return false;
              }
            }
            return true;
          };

          const activeVariantId =
            frameSnapshot?.meta?.variant ?? activeVariantRef.current?.id ?? variantKey;
          const targetOrder = resolveTargetPriorities(
            frameSnapshot,
            activeVariantId,
            activeBalls
          );
          const legalTargetsRaw = Array.isArray(frameSnapshot?.ballOn)
            ? frameSnapshot.ballOn
            : [];
          const combinedTargets = [...targetOrder];
          legalTargetsRaw
            .map((entry) => normalizeTargetId(entry))
            .filter((entry) => entry && isBallTargetId(entry))
            .forEach((entry) => {
              if (!combinedTargets.includes(entry)) combinedTargets.push(entry);
            });
          const pickFallbackBall = () =>
            activeBalls.reduce((best, ball) => {
              if (!best) return ball;
              const bestScore =
                scoreBallForAim(best, cuePos) *
                (isDirectLaneOpen(best) ? 1 : 0.35);
              const score =
                scoreBallForAim(ball, cuePos) *
                (isDirectLaneOpen(ball) ? 1 : 0.35);
              return score > bestScore ? ball : best;
            }, null);
          const pickDirectPreferredBall = (targets) => {
            for (const targetId of targets) {
              const matches = activeBalls.filter(
                (ball) => matchesTargetId(ball, targetId) && isDirectLaneOpen(ball)
              );
              if (matches.length > 0) {
                return matches.reduce((best, ball) => {
                  if (!best) return ball;
                  const bestScore = scoreBallForAim(best, cuePos);
                  const score = scoreBallForAim(ball, cuePos);
                  return score > bestScore ? ball : best;
                }, null);
              }
            }
            return null;
          };
          const findRackApex = () =>
            activeBalls.reduce((best, ball) => {
              if (!best) return ball;
              if (ball.pos.y > best.pos.y + 1e-6) return ball;
              if (
                Math.abs(ball.pos.y - best.pos.y) < 1e-6 &&
                Math.abs(ball.pos.x) < Math.abs(best.pos.x)
              ) {
                return ball;
              }
              return best;
            }, null);

          let targetBall = null;
          if ((frameSnapshot?.currentBreak ?? 0) === 0) {
            targetBall = findRackApex();
          }

          if (!targetBall && combinedTargets.length > 0) {
            targetBall =
              pickDirectPreferredBall(combinedTargets) ||
              pickPreferredBall(combinedTargets, activeBalls, cuePos);
          }

          if (!targetBall && activeVariantId === 'uk') {
            const metaState = frameSnapshot?.meta?.state ?? null;
            const shooterId = metaState?.currentPlayer ?? null;
            const assignments = metaState?.assignments ?? {};
            const assignedColour = shooterId ? assignments[shooterId] : null;
            const preferredColours = [];
            if (assignedColour === 'red') preferredColours.push('RED');
            if (assignedColour === 'blue' || assignedColour === 'yellow') {
              preferredColours.push('YELLOW', 'BLUE');
            }
            if (preferredColours.length > 0) {
              targetBall =
                pickDirectPreferredBall(preferredColours) ||
                pickPreferredBall(preferredColours, activeBalls, cuePos);
            }
          }

          if (!targetBall) {
            targetBall = pickPreferredBall(['BLACK'], activeBalls, cuePos);
          }

          if (!targetBall) {
            targetBall = pickPreferredBall(
              activeBalls
                .map((ball) => toBallColorId(ball.id))
                .filter((entry) => entry && isBallTargetId(entry)),
              activeBalls,
              cuePos
            );
          }

          if (!targetBall && activeBalls.length > 0) {
            targetBall = pickFallbackBall();
          }

          if (targetBall && !isDirectLaneOpen(targetBall)) {
            const rerouted =
              pickDirectPreferredBall(combinedTargets) ||
              pickPreferredBall(combinedTargets, activeBalls, cuePos) ||
              pickFallbackBall();
            if (rerouted) targetBall = rerouted;
          }

          if (!targetBall) return null;
          const dir = new THREE.Vector2(
            targetBall.pos.x - cuePos.x,
            targetBall.pos.y - cuePos.y
          );
          if (dir.lengthSq() < 1e-6) return null;
          return dir.normalize();
        };

        const updateUserSuggestion = () => {
          const options = evaluateShotOptions();
          const plan = options.bestPot ?? null;
          userSuggestionPlanRef.current = plan;
          const summary = summarizePlan(plan);
          userSuggestionRef.current = summary;
          const applyAimDirection = (dir, key = null) => {
            if (!dir || typeof dir.lengthSq !== 'function' || dir.lengthSq() <= 1e-6) {
              return false;
            }
            const normalized = dir.clone().normalize();
            aimDirRef.current.copy(normalized);
            alignStandingCameraToAim(cue, normalized);
            autoAimRequestRef.current = false;
            suggestionAimKeyRef.current = key;
            return true;
          };
          const applyAutoAimFallback = () => {
            suggestionAimKeyRef.current = null;
            const autoDir = resolveAutoAimDirection();
            if (applyAimDirection(autoDir, null)) return true;
            const ballsList = ballsRef.current?.length > 0 ? ballsRef.current : balls;
            const cuePos = cue?.pos
              ? new THREE.Vector2(cue.pos.x, cue.pos.y)
              : null;
            if (!cuePos || !Array.isArray(ballsList)) return false;
            const nearestBall = ballsList
              .filter((b) => b?.active && String(b.id) !== 'cue')
              .reduce((best, ball) => {
                if (!ball?.pos) return best;
                if (!best) return ball;
                const bestDist = cuePos.distanceToSquared(best.pos);
                const dist = cuePos.distanceToSquared(ball.pos);
                return dist < bestDist ? ball : best;
              }, null);
            if (!nearestBall) return false;
            const dir = new THREE.Vector2(
              nearestBall.pos.x - cuePos.x,
              nearestBall.pos.y - cuePos.y
            );
            return applyAimDirection(dir, null);
          };
          const preferAutoAim = autoAimRequestRef.current;
          if (preferAutoAim) {
            let autoDir = resolveAutoAimDirection();
            if (!autoDir && plan?.targetBall && cue?.pos) {
              const manualDir = new THREE.Vector2(
                plan.targetBall.pos.x - cue.pos.x,
                plan.targetBall.pos.y - cue.pos.y
              );
              if (manualDir.lengthSq() > 1e-6) {
                autoDir = manualDir.normalize();
              }
            }
            suggestionAimKeyRef.current = null;
            if (applyAimDirection(autoDir, null)) {
              return;
            }
          }
          if (plan?.targetBall && plan?.viaCushion && cue?.pos) {
            const directDir = new THREE.Vector2(
              plan.targetBall.pos.x - cue.pos.x,
              plan.targetBall.pos.y - cue.pos.y
            );
            if (applyAimDirection(directDir, null)) {
              return;
            }
          }
          if (plan?.aimDir && !plan.viaCushion) {
            const dir = plan.aimDir.clone();
            if (applyAimDirection(dir, summary?.key ?? null)) return;
            suggestionAimKeyRef.current = null;
          } else {
            suggestionAimKeyRef.current = null;
          }
          applyAutoAimFallback();
        };
        stopAiThinkingRef.current = stopAiThinking;
        startAiThinkingRef.current = startAiThinking;
        startUserSuggestionRef.current = updateUserSuggestion;

        aiShoot.current = () => {
          if (!aiOpponentEnabled) return;
          if (aiRetryTimeoutRef.current) {
            clearTimeout(aiRetryTimeoutRef.current);
            aiRetryTimeoutRef.current = null;
          }
          let currentHud = hudRef.current;
          if (currentHud?.turn === 1 && currentHud?.inHand) {
            autoPlaceAiCueBall();
            currentHud = hudRef.current;
            if (currentHud?.inHand) {
              aiRetryTimeoutRef.current = window.setTimeout(() => {
                aiRetryTimeoutRef.current = null;
                aiShoot.current();
              }, 250);
              return;
            }
          }
          if (currentHud?.over || currentHud?.inHand || shooting) return;
          try {
            cancelAiShotPreview();
            aiCueViewBlendRef.current = AI_CAMERA_DROP_BLEND;
            const options = evaluateShotOptions();
            let plan = options.bestPot ?? options.bestSafety ?? null;
            if (!plan) {
              const cuePos = cue?.pos ? cue.pos.clone() : null;
              if (!cuePos) return;
              let fallbackDir = resolveAutoAimDirection();
              if (!fallbackDir) {
                fallbackDir = new THREE.Vector2(-cuePos.x, -cuePos.y);
                if (fallbackDir.lengthSq() < 1e-6) fallbackDir.set(0, 1);
                fallbackDir.normalize();
              }
              plan = {
                type: 'safety',
                aimDir: fallbackDir,
                power: computePowerFromDistance(BALL_R * 18),
                target: 'fallback',
                spin: { x: 0, y: 0 }
              };
            }
            aiPlanRef.current = plan;
            clearEarlyAiShot();
            stopAiThinking();
            setAiPlanning(null);
            const dir = plan.aimDir.clone().normalize();
            aimDirRef.current.copy(dir);
            topViewRef.current = false;
            topViewLockedRef.current = false;
            setIsTopDownView(false);
            alignStandingCameraToAim(cue, dir);
            setAiShotCueViewActive(false);
            setAiShotPreviewActive(true);
            cancelCameraBlendTween();
            applyCameraBlend(1);
            updateCamera();
            // Reset the cue pull so AI strokes visibly wind up before firing.
            cuePullCurrentRef.current = 0;
            cuePullTargetRef.current = 0;
            powerRef.current = plan.power;
            setHud((s) => ({ ...s, power: plan.power }));
            const spinToApply = plan.spin ?? { x: 0, y: 0 };
            spinRef.current = { ...spinToApply };
            spinRequestRef.current = { ...spinToApply };
            resetSpinRef.current?.();
            if (aiShotTimeoutRef.current) {
              clearTimeout(aiShotTimeoutRef.current);
              aiShotTimeoutRef.current = null;
            }
            if (aiShotCueDropTimeoutRef.current) {
              clearTimeout(aiShotCueDropTimeoutRef.current);
              aiShotCueDropTimeoutRef.current = null;
            }
            const previewDelayMs = resolveAiPreviewDelay();
            const dropDelay = Math.max(0, previewDelayMs - AI_CAMERA_DROP_LEAD_MS);
            const shotDelay = Math.max(
              previewDelayMs,
              dropDelay + AI_CAMERA_SETTLE_MS + AI_CUE_VIEW_HOLD_MS
            );
            const beginCueView = () => {
              setAiShotCueViewActive(true);
              setAiShotPreviewActive(false);
              aiCueViewBlendRef.current = AI_CAMERA_DROP_BLEND;
              tweenCameraBlend(aiCueViewBlendRef.current, AI_CAMERA_DROP_DURATION_MS);
              if (aiShotTimeoutRef.current) {
                clearTimeout(aiShotTimeoutRef.current);
              }
              const remaining = Math.max(0, shotDelay - dropDelay);
              aiShotTimeoutRef.current = window.setTimeout(() => {
                aiShotTimeoutRef.current = null;
                applyCameraBlend(aiCueViewBlendRef.current ?? AI_CAMERA_DROP_BLEND);
                updateCamera();
                fire();
              }, remaining);
            };
            if (dropDelay <= 0) {
              beginCueView();
            } else {
              aiShotCueDropTimeoutRef.current = window.setTimeout(() => {
                aiShotCueDropTimeoutRef.current = null;
                beginCueView();
              }, dropDelay);
            }
          } catch (err) {
            console.error('Pool Royale AI shot failed:', err);
            stopAiThinking();
            setAiPlanning(null);
            aiPlanRef.current = null;
            setHud((s) => ({ ...s, turn: 0, inHand: true }));
            setFrameState((prev) => ({ ...prev, activePlayer: 'A' }));
            setInHandPlacementMode(true);
          }
        };

        fireRef.current = fire;

        const selectReplayBanner = (tag = 'default') => {
          const pool = REPLAY_BANNER_VARIANTS[tag] ?? REPLAY_BANNER_VARIANTS.default;
          if (!Array.isArray(pool) || pool.length === 0) return 'Good shot!';
          const index = Math.floor(Math.random() * pool.length);
          return pool[Math.max(0, Math.min(index, pool.length - 1))] ?? 'Good shot!';
        };

        const triggerReplaySlate = (label = 'Replay', { accent = 'default' } = {}) => {
          setReplaySlate({ label, accent, startedAt: performance.now() });
          if (replaySlateTimeoutRef.current) {
            clearTimeout(replaySlateTimeoutRef.current);
          }
          replaySlateTimeoutRef.current = window.setTimeout(() => {
            setReplaySlate(null);
            replaySlateTimeoutRef.current = null;
          }, REPLAY_SLATE_DURATION_MS);
          return REPLAY_TRANSITION_LEAD_MS;
        };

        const resolveReplayDecision = ({
          recording,
          hadObjectPot,
          pottedBalls,
          shotContext
        }) => {
          if (!recording || !hadObjectPot) return null;
          const tags = new Set(recording.replayTags ?? []);
          if (hadObjectPot) tags.add('pot');
          const potCount = pottedBalls.filter((entry) => entry.id !== 'cue').length;
          if (potCount > 1) tags.add('multi');
          if (shotContext?.cushionAfterContact) tags.add('bank');
          if (lastShotPower >= POWER_REPLAY_THRESHOLD) tags.add('power');
          if (tags.size === 0) return null;
          const priority = ['multi', 'bank', 'long', 'power', 'spin'];
          const primary = priority.find((tag) => tags.has(tag)) ?? 'default';
          const zoomOnly = recording.zoomOnly && !tags.has('long') && !tags.has('bank');
          return {
            shouldReplay: hadObjectPot || tags.size > 0,
            banner: selectReplayBanner(primary),
            zoomOnly,
            tags: Array.from(tags),
            primaryTag: primary
          };
        };

        // Resolve shot
        function resolve() {
          const variantId = activeVariantRef.current?.id ?? 'american';
          const shotEvents = [];
          const firstContactColor = toBallColorId(firstHit);
          const hadObjectPot = potted.some((entry) => entry.id !== 'cue');
          const replayDecision = resolveReplayDecision({
            recording: shotRecording,
            hadObjectPot,
            pottedBalls: potted,
            shotContext: shotContextRef.current
          });
          if (replayDecision && shotRecording) {
            shotRecording.replayTags = replayDecision.tags;
            shotRecording.zoomOnly = replayDecision.zoomOnly;
          }
          const shouldStartReplay =
            Boolean(replayDecision?.shouldReplay) &&
            (shotRecording?.frames?.length ?? 0) > 1;
          const replayBannerText = replayDecision?.banner ?? selectReplayBanner('default');
          const replayAccent = replayDecision?.primaryTag ?? 'default';
          let postShotSnapshot = null;
        if (firstContactColor || firstHit) {
          shotEvents.push({
            type: 'HIT',
            firstContact: firstContactColor,
            ballId: firstHit ?? null
          });
        }
        potted.forEach((entry) => {
          const pocket = entry.pocket ?? 'TM';
          shotEvents.push({
            type: 'POTTED',
            ball: entry.color,
            pocket,
            ballId: entry.id
          });
        });
        const currentState = frameRef.current ?? frameState;
        const cueBallPotted =
          potted.some((entry) => entry.color === 'CUE') || !cue.active;
        const noCushionAfterContact =
          shotContextRef.current.contactMade &&
          !shotContextRef.current.cushionAfterContact &&
          potted.every((entry) => entry.id !== 'cue');
        const shotContext = {
          placedFromHand: shotContextRef.current.placedFromHand,
          cueBallPotted,
          contactMade: shotContextRef.current.contactMade,
          cushionAfterContact: shotContextRef.current.cushionAfterContact,
          noCushionAfterContact,
          variant: variantId
        };
        let safeState = currentState;
        let shotResolved = false;
        try {
          const resolved = rules.applyShot(currentState, shotEvents, shotContext);
          if (resolved && typeof resolved === 'object') {
            safeState = resolved;
          }
          shotResolved = true;
        } catch (err) {
          console.error('Pool Royale shot resolution failed:', err);
        }
        if (isTraining) {
          if (!trainingRulesRef.current) {
            safeState = {
              ...safeState,
              foul: undefined,
              frameOver: false,
              winner: undefined
            };
          }
          if (trainingModeRef.current === 'solo') {
            safeState = { ...safeState, activePlayer: 'A' };
          }
        }
        const shooterSeat = currentState?.activePlayer === 'B' ? 'B' : 'A';
        if (potted.length) {
          const newPots = potted.filter(
            (entry) => entry && entry.color && entry.color !== 'CUE'
          );
          if (newPots.length) {
            lastPottedBySeatRef.current = {
              ...lastPottedBySeatRef.current,
              [shooterSeat]: newPots[newPots.length - 1] ?? null
            };
            setPottedBySeat((prev) => {
              const next = {
                ...prev,
                [shooterSeat]: [...(prev[shooterSeat] || [])]
              };
              const existing = new Set(
                next[shooterSeat].map((entry) => String(entry.id ?? entry.color))
              );
              newPots.forEach((entry) => {
                const key = String(entry.id ?? entry.color);
                if (existing.has(key)) return;
                existing.add(key);
                next[shooterSeat].push({
                  id: entry.id ?? key,
                  color: entry.color,
                  pocket: entry.pocket
                });
              });
              return next;
            });
          } else {
            lastPottedBySeatRef.current = {
              ...lastPottedBySeatRef.current,
              [shooterSeat]: null
            };
          }
        } else {
          lastPottedBySeatRef.current = {
            ...lastPottedBySeatRef.current,
            [shooterSeat]: null
          };
        }
        const metaState =
          safeState && typeof safeState.meta === 'object' ? safeState.meta.state : null;
        if (safeState?.foul) {
          showRuleToast('Foul');
        }
        if (metaState && typeof metaState === 'object') {
          const assignments = metaState.assignments || null;
          if (assignments) {
            ['A', 'B'].forEach((seat) => {
              const nextAssign = assignments[seat] ?? null;
              const prevAssign = lastAssignmentsRef.current?.[seat] ?? null;
              if (nextAssign && nextAssign !== prevAssign) {
                const seatLabel =
                  seat === localSeatRef.current
                    ? player.name || 'You'
                    : isOnlineMatch
                      ? opponentDisplayName
                      : 'AI';
                const assignmentLabel = (() => {
                  if (nextAssign === 'blue') {
                    return isUkAmericanSet ? 'Solids' : 'Yellows';
                  }
                  if (nextAssign === 'red') {
                    return isUkAmericanSet ? 'Stripes' : 'Reds';
                  }
                  return nextAssign.charAt(0).toUpperCase() + nextAssign.slice(1);
                })();
                showRuleToast(`${seatLabel} is ${assignmentLabel}`);
              }
            });
            lastAssignmentsRef.current = {
              ...lastAssignmentsRef.current,
              ...assignments
            };
          }
          const shotsForPlayer = metaState.currentPlayer === 'B' ? 'B' : 'A';
          const remainingShots = metaState.shotsRemaining;
          if (Number.isFinite(remainingShots) && remainingShots > 1) {
            if (lastShotReminderRef.current[shotsForPlayer] !== remainingShots) {
              const shooterLabel =
                shotsForPlayer === localSeatRef.current
                  ? player.name || 'You'
                  : isOnlineMatch
                    ? opponentDisplayName
                    : 'AI';
              const verb = shooterLabel === 'You' ? 'have' : 'has';
              showRuleToast(`${shooterLabel} ${verb} ${remainingShots} shots`);
              lastShotReminderRef.current[shotsForPlayer] = remainingShots;
            }
          } else if (shotsForPlayer) {
            lastShotReminderRef.current[shotsForPlayer] =
              Number.isFinite(remainingShots) && remainingShots > 0 ? remainingShots : 0;
          }
        }
        shotContextRef.current = {
          placedFromHand: false,
          contactMade: false,
          cushionAfterContact: false
        };
        let nextInHand = cueBallPotted;
        try {
          if (shotResolved) {
            if (safeState.foul) {
              const foulPoints = safeState.foul.points ?? 4;
              const foulVol = clamp(foulPoints / 7, 0, 1);
              playShock(Math.max(0.4, foulVol));
            } else {
              const deltaA =
                (safeState.players?.A?.score ?? 0) -
                (currentState.players?.A?.score ?? 0);
              const deltaB =
                (safeState.players?.B?.score ?? 0) -
                (currentState.players?.B?.score ?? 0);
              const scored = Math.max(deltaA, deltaB);
              if (scored > 0) {
                const cheerVol = clamp(scored / 7, 0, 1);
                playCheer(Math.max(0.35, cheerVol));
              } else if (safeState.frameOver) {
                playCheer(1);
              }
            }
            const colourNames = ['yellow', 'green', 'brown', 'blue', 'pink', 'black'];
            colourNames.forEach((name) => {
              const simBall = colors[name];
              const stateBall = safeState.balls.find(
                (b) => b.color === name.toUpperCase()
              );
              if (!simBall || !stateBall) return;
              if (stateBall.onTable) {
                if (!simBall.active) {
                  pocketDropRef.current.delete(simBall.id);
                  simBall.mesh.scale.set(1, 1, 1);
                  const [sx, sy] = SPOTS[name];
                  simBall.active = true;
                  simBall.mesh.visible = true;
                  simBall.pos.set(sx, sy);
                  simBall.mesh.position.set(sx, BALL_CENTER_Y, sy);
                  simBall.vel.set(0, 0);
                  simBall.spin?.set(0, 0);
                  simBall.pendingSpin?.set(0, 0);
                  simBall.spinMode = 'standard';
                }
              } else {
                simBall.active = false;
                pocketDropRef.current.delete(simBall.id);
                simBall.mesh.visible = false;
              }
            });
            if (isTraining) {
              const remainingObjectBalls = balls.filter(
                (ball) => ball && ball.active && String(ball.id).toLowerCase() !== 'cue'
              );
              if (remainingObjectBalls.length === 0) {
                const meta =
                  safeState && typeof safeState.meta === 'object' ? { ...safeState.meta } : {};
                const hudMeta = meta && typeof meta.hud === 'object' ? meta.hud : null;
                const hud = hudMeta
                  ? { ...hudMeta, next: 'task complete', phase: 'complete' }
                  : undefined;
                safeState = {
                  ...safeState,
                  ballOn: [],
                  frameOver: true,
                  winner: 'A',
                  meta: hud ? { ...meta, hud } : meta
                };
              }
            }
            if (cueBallPotted) {
              cue.active = false;
              pocketDropRef.current.delete(cue.id);
              const fallback = defaultInHandPosition();
              if (fallback) {
                updateCuePlacement(fallback);
              } else {
                cue.mesh.visible = true;
              }
              cue.active = true;
              cue.vel.set(0, 0);
              cue.spin?.set(0, 0);
              cue.pendingSpin?.set(0, 0);
              cue.spinMode = 'standard';
              cue.impacted = false;
              cue.launchDir = null;
            }
            if (shouldStartReplay) {
              postShotSnapshot = captureBallSnapshot();
            }
            const nextMeta = safeState.meta;
            if (nextMeta && typeof nextMeta === 'object') {
              if (nextMeta.variant === 'american' && nextMeta.state) {
                nextInHand = Boolean(nextMeta.state.ballInHand);
              } else if (nextMeta.variant === '9ball' && nextMeta.state) {
                nextInHand = Boolean(nextMeta.state.ballInHand);
              } else if (nextMeta.variant === 'uk' && nextMeta.state) {
                nextInHand = Boolean(nextMeta.state.mustPlayFromBaulk);
              }
            }
          }
        } catch (err) {
          console.error('Pool Royale post-resolution update failed:', err);
        } finally {
          frameRef.current = safeState;
          setFrameState(safeState);
          setTurnCycle((value) => value + 1);
          setHud((prev) => ({ ...prev, inHand: nextInHand }));
          if (isOnlineMatch && tableId) {
            const layout = captureBallSnapshot();
            socket.emit('poolShot', {
              tableId,
              state: safeState,
              hud: hudRef.current,
              layout
            });
          }
          setShootingState(false);
          spinRef.current = { x: 0, y: 0 };
          spinRequestRef.current = { x: 0, y: 0 };
          spinAppliedRef.current = { x: 0, y: 0, magnitude: 0, mode: 'standard' };
          resetSpinRef.current?.();
          powerImpactHoldRef.current = 0;
          shotPrediction = null;
          activeShotView = null;
          suspendedActionView = null;
          queuedPocketView = null;
          pocketSwitchIntentRef.current = null;
          lastPocketBallRef.current = null;
          updatePocketCameraState(false);
          if (shouldStartReplay && postShotSnapshot) {
            const recordingForReplay = shotRecording;
            const launchReplay = () => {
              replayBannerTimeoutRef.current = null;
              setReplayBanner(null);
              const slateLead = triggerReplaySlate(replayBannerText, { accent: replayAccent });
              const beginReplay = () => {
                shotRecording = recordingForReplay;
                if (recordingForReplay) {
                  startShotReplay(postShotSnapshot);
                } else {
                  shotReplayRef.current = null;
                }
                shotRecording = null;
              };
              if (slateLead > 0) {
                window.setTimeout(beginReplay, slateLead);
              } else {
                beginReplay();
              }
            };
            if (replayBannerTimeoutRef.current) {
              clearTimeout(replayBannerTimeoutRef.current);
              replayBannerTimeoutRef.current = null;
            }
            setReplayBanner(replayBannerText);
            replayBannerTimeoutRef.current = window.setTimeout(
              launchReplay,
              GOOD_SHOT_REPLAY_DELAY_MS
            );
          } else {
            shotReplayRef.current = null;
            shotRecording = null;
          }
          aiPlanRef.current = null;
          setAiPlanning(null);
          window.setTimeout(() => {
            const hudState = hudRef.current;
            if (hudState?.turn === 0 && !hudState.over) {
              autoAimRequestRef.current = true;
              suggestionAimKeyRef.current = null;
              startUserSuggestionRef.current?.();
            }
          }, 0);
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
          firstHit = null;
      lastShotPower = 0;
    }
  }

  // Loop
  let lastStepTime = performance.now();
  let lastReplayFrameAt = 0;
  let lastLiveSyncSentAt = 0;
  let lastLiveAimSentAt = 0;
  const step = (now) => {
    if (disposed) return;
    try {
      const playback = replayPlaybackRef.current;
        if (playback) {
          const frameTiming = frameTimingRef.current;
          const targetReplayFrameTime =
            frameTiming && Number.isFinite(frameTiming.targetMs)
              ? frameTiming.targetMs
              : 1000 / 60;
          if (lastReplayFrameAt && now - lastReplayFrameAt < targetReplayFrameTime) {
            rafRef.current = requestAnimationFrame(step);
            return;
          }
          lastReplayFrameAt = now;
          const scheduleNext = () => {
            if (disposed) return;
            rafRef.current = requestAnimationFrame(step);
          };
          const frames = playback.frames || [];
          const duration = Number.isFinite(playback.duration) ? playback.duration : 0;
          const elapsed = now - playback.startedAt;
          if (frames.length === 0) {
            finishReplayPlayback(playback);
            scheduleNext();
            return;
          }
          try {
            const targetTime = Math.min(elapsed, duration);
            let frameIndex = playback.lastIndex ?? 0;
            while (frameIndex < frames.length - 1 && frames[frameIndex + 1].t <= targetTime) {
              frameIndex += 1;
            }
            playback.lastIndex = frameIndex;
            const frameA = frames[frameIndex];
            const frameB = frames[Math.min(frameIndex + 1, frames.length - 1)] ?? null;
            const span = frameB ? Math.max(frameB.t - frameA.t, 1e-6) : 1;
            const alpha = frameB
              ? THREE.MathUtils.clamp((targetTime - frameA.t) / span, 0, 1)
              : 0;
            applyReplayFrame(frameA, frameB, alpha);
            applyReplayCueStroke(playback, targetTime);
            updateReplayTrail(playback.cuePath, targetTime);
            if (!LOCK_REPLAY_CAMERA) {
              const nextFrameCamera = frameB?.camera ?? frameA?.camera ?? null;
              const previousFrameCamera =
                replayFrameCameraRef.current?.frameB ??
                replayFrameCameraRef.current?.frameA ??
                null;
              if (
                nextFrameCamera &&
                (!replayFrameCameraRef.current ||
                  hasReplayCameraChanged(previousFrameCamera, nextFrameCamera))
              ) {
                replayFrameCameraRef.current = {
                  frameA: nextFrameCamera,
                  frameB: nextFrameCamera,
                  alpha: 0
                };
              }
            } else {
              replayFrameCameraRef.current = null;
            }
            const frameCamera = updateCamera();
            renderer.render(scene, frameCamera ?? camera);
            const finished = elapsed >= duration || elapsed - duration >= REPLAY_TIMEOUT_GRACE_MS;
            if (finished) {
              finishReplayPlayback(playback);
            }
          } catch (err) {
            console.error('Pool Royale replay playback failed; skipping.', err);
            finishReplayPlayback(playback);
          }
          scheduleNext();
          return;
        }
        const nowMs = now;
        if (remoteShotActiveRef.current && remoteShotUntilRef.current > 0 && nowMs > remoteShotUntilRef.current) {
          remoteShotActiveRef.current = false;
        }
        if (
          remoteAimRef.current &&
          Number.isFinite(remoteAimRef.current.updatedAt) &&
          nowMs - remoteAimRef.current.updatedAt > 3500
        ) {
          remoteAimRef.current = null;
        }
        if (!shooting && !shotRecording && !replayPlaybackRef.current && pendingRemoteReplayRef.current) {
          const pending = pendingRemoteReplayRef.current;
          pendingRemoteReplayRef.current = null;
          if (pending?.frames?.length > 1) {
            shotRecording = {
              ...pending,
              startTime: pending.startTime ?? nowMs,
              startState: pending.startState ?? captureBallSnapshot(),
              zoomOnly: pending.zoomOnly ?? false,
              replayTags: pending.replayTags ?? ['remote']
            };
            shotReplayRef.current = shotRecording;
            const postState = pending.postState ?? captureBallSnapshot();
            startShotReplay(postState);
          }
        }
        const frameTiming = frameTimingRef.current;
        const targetFrameTime =
          frameTiming && Number.isFinite(frameTiming.targetMs)
            ? frameTiming.targetMs
            : 1000 / 60;
        const maxFrameTime =
          frameTiming && Number.isFinite(frameTiming.maxMs)
            ? frameTiming.maxMs
            : targetFrameTime * FRAME_TIME_CATCH_UP_MULTIPLIER;
        const rawDelta = Math.max(now - lastStepTime, 0);
        const deltaMs = Math.min(rawDelta, maxFrameTime);
        const appliedDeltaMs = deltaMs;
        const deltaSeconds = appliedDeltaMs / 1000;
        coinTicker.update(deltaSeconds);
        dynamicTextureEntries.forEach((entry) => {
          entry.accumulator += deltaSeconds;
          if (entry.accumulator < entry.minInterval) {
            return;
          }
          const elapsed = entry.accumulator;
          entry.accumulator = 0;
          entry.update(elapsed);
        });
        const frameScaleBase =
          targetFrameTime > 0 ? appliedDeltaMs / targetFrameTime : 1;
        const frameScale = Math.min(
          MAX_FRAME_SCALE,
          Math.max(frameScaleBase, MIN_FRAME_SCALE)
        );
        const physicsSubsteps = Math.min(
          MAX_PHYSICS_SUBSTEPS,
          Math.max(1, Math.ceil(frameScale))
        );
        const subStepScale = frameScale / physicsSubsteps;
        lastStepTime = now;
        if (topViewRef.current && topViewLockedRef.current) {
          const fallbackAim = aimDirRef.current.clone();
          if (fallbackAim.lengthSq() < 1e-6) fallbackAim.set(0, 1);
          tmpAim.copy(fallbackAim.normalize());
        } else {
          camera.getWorldDirection(camFwd);
          tmpAim.set(camFwd.x, camFwd.z).normalize();
        }
        const cameraBlend = THREE.MathUtils.clamp(
          cameraBlendRef.current ?? 1,
          0,
          1
        );
        const baseAimLerp = THREE.MathUtils.lerp(
          CUE_VIEW_AIM_LINE_LERP,
          STANDING_VIEW_AIM_LINE_LERP,
          cameraBlend
        );
        const aimLerpFactor = chalkAssistTargetRef.current
          ? Math.min(baseAimLerp, CHALK_AIM_LERP_SLOW)
          : baseAimLerp;
        if (!lookModeRef.current) {
          aimDir.lerp(tmpAim, aimLerpFactor);
        }
        const appliedSpin = applySpinConstraints(aimDir, true);
        const ranges = spinRangeRef.current || {};
        const newCollisions = new Set();
        let shouldSlowAim = false;
        // Aiming vizual
        const currentHud = hudRef.current;
        const isPlayerTurn = currentHud?.turn === 0;
        const isAiTurn = aiOpponentEnabled && currentHud?.turn === 1;
        const previewingAiShot = aiShotPreviewRef.current;
        const aiCueViewActive = aiShotCueViewRef.current;
        const remoteShotActive =
          currentHud?.turn === 1 && remoteShotActiveRef.current;
        const remoteAimState = remoteAimRef.current;
        if (isAiTurn) {
          autoPlaceAiCueBall();
        }
        const activeAiPlan = isAiTurn ? aiPlanRef.current : null;
        const canShowCue =
          allStopped(balls) &&
          cue?.active &&
          !(currentHud?.over) &&
          !(inHandPlacementModeRef.current) &&
          (!(currentHud?.inHand) || cueBallPlacedFromHandRef.current) &&
          !remoteShotActive &&
          (isPlayerTurn || previewingAiShot || aiCueViewActive);
        const remoteAimFresh =
          remoteAimState &&
          Number.isFinite(remoteAimState.updatedAt) &&
          now - remoteAimState.updatedAt <= 3200;
        const showingRemoteAim =
          canShowCue &&
          !aiOpponentEnabled &&
          isOnlineMatch &&
          currentHud?.turn === 1 &&
          remoteAimFresh;
        function resolveCueObstruction(dirVec3, pullDistance = cuePullTargetRef.current ?? 0) {
          if (!cue?.pos || !dirVec3) return 0;
          const backward = new THREE.Vector2(-dirVec3.x, -dirVec3.z);
          if (backward.lengthSq() < 1e-8) return 0;
          backward.normalize();
          const origin = new THREE.Vector2(cue.pos.x, cue.pos.y);
          const reach = Math.max(
            CUE_OBSTRUCTION_RANGE,
            cueLen + pullDistance + CUE_TIP_GAP
          );
          const clearanceSq = CUE_OBSTRUCTION_CLEARANCE * CUE_OBSTRUCTION_CLEARANCE;
          let strength = 0;
          balls.forEach((b) => {
            if (!b?.active || b === cue) return;
            const delta = b.pos.clone().sub(origin);
            const along = delta.dot(backward);
            if (along < BALL_R * 0.25 || along > reach) return;
            const lateralSq = delta.lengthSq() - along * along;
            if (lateralSq > clearanceSq) return;
            const lateral = Math.sqrt(Math.max(lateralSq, 0));
            const proximity = THREE.MathUtils.clamp(
              1 - lateral / CUE_OBSTRUCTION_CLEARANCE,
              0,
              1
            );
            const depth = THREE.MathUtils.clamp(1 - along / reach, 0, 1);
            const influence = Math.max(proximity, 0.6 * proximity + 0.4 * depth);
            strength = Math.max(strength, influence);
          });
          return strength;
        }

        sidePocketAimRef.current = false;
        if (canShowCue && (isPlayerTurn || previewingAiShot)) {
          const baseAimDir = new THREE.Vector3(aimDir.x, 0, aimDir.y);
          if (baseAimDir.lengthSq() < 1e-8) baseAimDir.set(0, 0, 1);
          else baseAimDir.normalize();
          const basePerp = new THREE.Vector3(-baseAimDir.z, 0, baseAimDir.x);
          if (basePerp.lengthSq() > 1e-8) basePerp.normalize();
          const powerStrength = THREE.MathUtils.clamp(
            powerRef.current ?? 0,
            0,
            1
          );
          const aimDir2D = new THREE.Vector2(baseAimDir.x, baseAimDir.z);
          const { impact, targetDir, cueDir, targetBall, railNormal } = calcTarget(
            cue,
            aimDir2D,
            balls
          );
          const start = new THREE.Vector3(cue.pos.x, BALL_CENTER_Y, cue.pos.y);
          let end = new THREE.Vector3(impact.x, BALL_CENTER_Y, impact.y);
          const dir = baseAimDir.clone();
          if (start.distanceTo(end) < 1e-4) {
            end = start.clone().add(dir.clone().multiplyScalar(BALL_R));
          }
          aimGeom.setFromPoints([start, end]);
          aim.visible = true;
          const slowAssistEnabled = chalkAssistEnabledRef.current;
          const hasTarget = slowAssistEnabled && (targetBall || railNormal);
          shouldSlowAim = hasTarget;
          const precisionArea = chalkAreaRef.current;
          if (precisionArea) {
            precisionArea.visible = hasTarget;
            if (hasTarget) {
              precisionArea.position.set(
                end.x,
                tableSurfaceY + 0.005,
                end.z
              );
              precisionArea.material.color.setHex(
                targetBall ? CHALK_ACTIVE_COLOR : CHALK_SIDE_ACTIVE_COLOR
              );
              precisionArea.material.needsUpdate = true;
            }
          }
          const targetBallColor = targetBall ? toBallColorId(targetBall.id) : null;
          const legalTargetsRaw =
            frameRef.current?.ballOn ?? frameState.ballOn ?? [];
          const legalTargets = Array.isArray(legalTargetsRaw)
            ? legalTargetsRaw
                .map((entry) =>
                  typeof entry === 'string' ? entry.toUpperCase() : entry
                )
                .filter(Boolean)
            : [];
          const suggestionPlan = userSuggestionPlanRef.current;
          const suggestionMatchesTarget =
            suggestionPlan?.targetBall &&
            targetBall &&
            String(suggestionPlan.targetBall.id) === String(targetBall.id);
          if (
            suggestionMatchesTarget &&
            (suggestionPlan.pocketId === 'TM' || suggestionPlan.pocketId === 'BM')
          ) {
            sidePocketAimRef.current = true;
          }
          const aimingWrong =
            targetBall &&
            !railNormal &&
            targetBallColor &&
            legalTargets.length > 0 &&
            !legalTargets.includes(targetBallColor);
          const primaryColor = aimingWrong
            ? 0xff3333
            : targetBall && !railNormal
              ? 0xffd166
              : 0x7ce7ff;
          aim.material.color.set(primaryColor);
          aim.material.opacity = 0.55 + 0.35 * powerStrength;
          const perp = new THREE.Vector3(-dir.z, 0, dir.x);
          if (perp.lengthSq() > 1e-8) perp.normalize();
          tickGeom.setFromPoints([
            end.clone().add(perp.clone().multiplyScalar(AIM_TICK_HALF_LENGTH)),
            end.clone().add(perp.clone().multiplyScalar(-AIM_TICK_HALF_LENGTH))
          ]);
          tick.visible = true;
          if (lookModeRef.current) {
            const lookFocus = targetBall
              ? new THREE.Vector3(targetBall.pos.x, BALL_CENTER_Y, targetBall.pos.y)
              : end.clone();
            aimFocusRef.current = lookFocus;
          } else {
            aimFocusRef.current = null;
          }
          const cueFollowDir = cueDir
            ? new THREE.Vector3(cueDir.x, 0, cueDir.y).normalize()
            : dir.clone();
          const spinSideInfluence = (appliedSpin.x || 0) * (0.4 + 0.42 * powerStrength);
          const spinVerticalInfluence = (appliedSpin.y || 0) * (0.68 + 0.45 * powerStrength);
          const cueFollowDirSpinAdjusted = cueFollowDir
            .clone()
            .add(perp.clone().multiplyScalar(spinSideInfluence))
            .add(dir.clone().multiplyScalar(spinVerticalInfluence * 0.16));
          if (cueFollowDirSpinAdjusted.lengthSq() > 1e-8) {
            cueFollowDirSpinAdjusted.normalize();
          }
          const backSpinWeight = Math.max(0, appliedSpin.y || 0);
          if (backSpinWeight > 1e-8) {
            const drawLerp = Math.min(1, backSpinWeight * BACKSPIN_DIRECTION_PREVIEW);
            const drawDir = dir.clone().negate();
            cueFollowDirSpinAdjusted.lerp(drawDir, drawLerp);
            if (cueFollowDirSpinAdjusted.lengthSq() > 1e-8) {
              cueFollowDirSpinAdjusted.normalize();
            }
          }
          const cueFollowLength =
            BALL_R * (12 + powerStrength * 18) * (1 + spinVerticalInfluence * 0.4);
          const followEnd = end
            .clone()
            .add(cueFollowDirSpinAdjusted.clone().multiplyScalar(cueFollowLength));
          cueAfterGeom.setFromPoints([end, followEnd]);
          cueAfter.visible = true;
          cueAfter.material.opacity = 0.35 + 0.35 * powerStrength;
          cueAfter.computeLineDistances();
          if (impactRingEnabled) {
            impactRing.visible = true;
            impactRing.position.set(end.x, tableSurfaceY + 0.002, end.z);
            const impactScale = 0.9 + powerStrength * 0.45;
            impactRing.scale.set(impactScale, impactScale, impactScale);
            if (impactRing.material) {
              impactRing.material.opacity = THREE.MathUtils.lerp(0.35, 0.85, powerStrength);
              impactRing.material.needsUpdate = true;
            }
          } else {
            impactRing.visible = false;
          }
          const backInfo = calcTarget(
            cue,
            aimDir2D.clone().multiplyScalar(-1),
            balls
          );
          const maxPull = Math.max(0, backInfo.tHit - cueLen - CUE_TIP_GAP);
          const desiredPull = computePullTargetFromPower(
            powerRef.current,
            maxPull
          );
          const pull = computeCuePull(desiredPull, maxPull, {
            instant: Boolean(sliderInstanceRef.current?.dragging)
          });
          const visualPull = applyVisualPullCompensation(pull, dir);
          const { side, vert, hasSpin } = computeSpinOffsets(appliedSpin, ranges);
          const spinWorld = new THREE.Vector3(perp.x * side, vert, perp.z * side);
          clampCueTipOffset(spinWorld);
          const obstructionStrength = resolveCueObstruction(dir, pull);
          const obstructionTilt = obstructionStrength * CUE_OBSTRUCTION_TILT;
          const obstructionLift = obstructionStrength * CUE_OBSTRUCTION_LIFT;
          const obstructionTiltFromLift =
            obstructionLift > 0 ? Math.atan2(obstructionLift, cueLen) : 0;
          cueStick.position.set(
            cue.pos.x - dir.x * (cueLen / 2 + visualPull + CUE_TIP_GAP) + spinWorld.x,
            CUE_Y + spinWorld.y,
            cue.pos.y - dir.z * (cueLen / 2 + visualPull + CUE_TIP_GAP) + spinWorld.z
          );
          const tiltAmount = hasSpin ? Math.abs(appliedSpin.y || 0) : 0;
          const extraTilt = MAX_BACKSPIN_TILT * tiltAmount;
          applyCueButtTilt(
            cueStick,
            extraTilt + obstructionTilt + obstructionTiltFromLift,
            CUE_Y + spinWorld.y + obstructionLift * 0.25
          );
          cueStick.rotation.y = Math.atan2(dir.x, dir.z) + Math.PI;
          if (tipGroupRef.current) {
            tipGroupRef.current.position.set(0, 0, -cueLen / 2);
          }
          const buttTiltInfo = cueStick.userData?.buttTilt;
          const buttHeightOffset = buttTiltInfo?.buttHeightOffset ?? 0;
          TMP_VEC3_BUTT.set(
            cue.pos.x - dir.x * (cueLen + visualPull + CUE_TIP_GAP) + spinWorld.x,
            CUE_Y + spinWorld.y + buttHeightOffset,
            cue.pos.y - dir.z * (cueLen + visualPull + CUE_TIP_GAP) + spinWorld.z
          );
          let visibleChalkIndex = null;
          const chalkMeta = table.userData?.chalkMeta;
          if (chalkMeta) {
            const slack = chalkMeta.slack ?? 0;
            const leftDistance = Math.abs(TMP_VEC3_BUTT.x + PLAY_W / 2);
            const rightDistance = Math.abs(TMP_VEC3_BUTT.x - PLAY_W / 2);
            const topDistance = Math.abs(TMP_VEC3_BUTT.z + PLAY_H / 2);
            const bottomDistance = Math.abs(TMP_VEC3_BUTT.z - PLAY_H / 2);
            let bestSide = null;
            let bestValue = Infinity;
            const considerSide = (side, value, limit) => {
              if (value > limit + slack) return;
              if (value < bestValue) {
                bestValue = value;
                bestSide = side;
              }
            };
            considerSide('left', leftDistance, chalkMeta.sideReach);
            considerSide('right', rightDistance, chalkMeta.sideReach);
            considerSide('top', topDistance, chalkMeta.endReach);
            considerSide('bottom', bottomDistance, chalkMeta.endReach);
            if (bestSide) {
              switch (bestSide) {
                case 'left':
                  visibleChalkIndex = 0;
                  break;
                case 'right':
                  visibleChalkIndex = 1;
                  break;
                case 'top':
                  visibleChalkIndex = 2;
                  break;
                case 'bottom':
                  visibleChalkIndex = 3;
                  break;
                default:
                  visibleChalkIndex = null;
              }
            }
          }
          const chalkSlotsData = table.userData?.chalkSlots;
          const chalkMeshesData = table.userData?.chalks;
          if (Array.isArray(chalkSlotsData) && Array.isArray(chalkMeshesData)) {
            chalkSlotsData.forEach((slot, slotIndex) => {
              const mesh = chalkMeshesData[slotIndex];
              if (!mesh || !slot?.basePosition || !slot?.tangent) return;
              const defaultOffset = slot.defaultOffset ?? 0;
              const limits = slot.offsetLimits ?? null;
              let targetOffset = defaultOffset;
              if (
                slotIndex === visibleChalkIndex &&
                chalkMeta?.overlapThreshold > 0 &&
                chalkMeta?.nudgeDistance > 0
              ) {
                TMP_VEC3_CHALK.copy(slot.basePosition).addScaledVector(
                  slot.tangent,
                  defaultOffset
                );
                TMP_VEC3_CHALK_DELTA.copy(TMP_VEC3_BUTT).sub(TMP_VEC3_CHALK);
                const along = TMP_VEC3_CHALK_DELTA.dot(slot.tangent);
                if (Math.abs(along) < chalkMeta.overlapThreshold) {
                  const dir = along >= 0 ? -1 : 1;
                  targetOffset += dir * chalkMeta.nudgeDistance;
                }
              }
              if (limits) {
                targetOffset = clamp(
                  targetOffset,
                  limits.min ?? targetOffset,
                  limits.max ?? targetOffset
                );
              }
              if (slot.currentOffset !== targetOffset) {
                mesh.position
                  .copy(slot.basePosition)
                  .addScaledVector(slot.tangent, targetOffset);
                if (slot.position) {
                  slot.position
                    .copy(slot.basePosition)
                    .addScaledVector(slot.tangent, targetOffset);
                }
                slot.currentOffset = targetOffset;
              } else if (slot.position) {
                slot.position
                  .copy(slot.basePosition)
                  .addScaledVector(slot.tangent, targetOffset);
              }
            });
          }
          updateChalkVisibility(visibleChalkIndex);
          cueStick.visible = true;
          if (targetDir && targetBall) {
            const travelScale = BALL_R * (14 + powerStrength * 22);
            const tDir = new THREE.Vector3(targetDir.x, 0, targetDir.y);
            if (tDir.lengthSq() > 1e-8) {
              tDir.normalize();
            } else {
              tDir.copy(dir);
            }
            const targetStart = new THREE.Vector3(
              targetBall.pos.x,
              BALL_CENTER_Y,
              targetBall.pos.y
            );
            const distanceScale = travelScale;
            const tEnd = targetStart
              .clone()
              .add(tDir.clone().multiplyScalar(distanceScale));
            targetGeom.setFromPoints([targetStart, tEnd]);
            target.material.color.setHex(0xffd166);
            target.material.opacity = 0.65 + 0.3 * powerStrength;
            target.visible = true;
            target.computeLineDistances();
          } else if (railNormal && cueDir) {
            const bounceDir = new THREE.Vector3(cueDir.x, 0, cueDir.y).normalize();
            const bounceLength = BALL_R * (12 + powerStrength * 18);
            const bounceEnd = end
              .clone()
              .add(bounceDir.clone().multiplyScalar(bounceLength));
            targetGeom.setFromPoints([end, bounceEnd]);
            target.material.color.setHex(0x7ce7ff);
            target.material.opacity = 0.35 + 0.25 * powerStrength;
            target.visible = true;
            target.computeLineDistances();
          } else {
            target.visible = false;
          }
        } else if (showingRemoteAim) {
          aimFocusRef.current = null;
          const remoteAimDir = new THREE.Vector2(
            remoteAimState?.dir?.x ?? 0,
            remoteAimState?.dir?.y ?? 0
          );
          if (remoteAimDir.lengthSq() < 1e-6) {
            remoteAimDir.set(0, 1);
          } else {
            remoteAimDir.normalize();
          }
          const baseDir = new THREE.Vector3(remoteAimDir.x, 0, remoteAimDir.y);
          const perp = new THREE.Vector3(-baseDir.z, 0, baseDir.x);
          if (perp.lengthSq() > 1e-8) perp.normalize();
          const powerStrength = THREE.MathUtils.clamp(remoteAimState?.power ?? 0, 0, 1);
          const { impact, targetDir, cueDir, targetBall, railNormal } = calcTarget(
            cue,
            remoteAimDir,
            balls
          );
          const start = new THREE.Vector3(cue.pos.x, BALL_CENTER_Y, cue.pos.y);
          let end = new THREE.Vector3(impact.x, BALL_CENTER_Y, impact.y);
          if (start.distanceTo(end) < 1e-4) {
            end = start.clone().add(baseDir.clone().multiplyScalar(BALL_R));
          }
          aimGeom.setFromPoints([start, end]);
          aim.material.color.set(0x7ce7ff);
          aim.material.opacity = 0.55 + 0.35 * powerStrength;
          aim.visible = true;
          tickGeom.setFromPoints([
            end.clone().add(perp.clone().multiplyScalar(AIM_TICK_HALF_LENGTH)),
            end.clone().add(perp.clone().multiplyScalar(-AIM_TICK_HALF_LENGTH))
          ]);
          tick.visible = true;
          const cueFollowDir = cueDir
            ? new THREE.Vector3(cueDir.x, 0, cueDir.y).normalize()
            : baseDir.clone();
          const cueFollowLength = BALL_R * (12 + powerStrength * 18);
          const followEnd = end
            .clone()
            .add(cueFollowDir.clone().multiplyScalar(cueFollowLength));
          cueAfterGeom.setFromPoints([end, followEnd]);
          cueAfter.visible = true;
          cueAfter.material.opacity = 0.35 + 0.35 * powerStrength;
          cueAfter.computeLineDistances();
          impactRing.visible = false;
          const backInfo = calcTarget(
            cue,
            remoteAimDir.clone().multiplyScalar(-1),
            balls
          );
          const maxPull = Math.max(0, backInfo.tHit - cueLen - CUE_TIP_GAP);
          const desiredPull = computePullTargetFromPower(powerStrength, maxPull);
          const pull = computeCuePull(desiredPull, maxPull);
          const visualPull = applyVisualPullCompensation(pull, baseDir);
          const spinX = THREE.MathUtils.clamp(remoteAimState?.spin?.x ?? 0, -1, 1);
          const spinY = THREE.MathUtils.clamp(remoteAimState?.spin?.y ?? 0, -1, 1);
          const { side, vert, hasSpin } = computeSpinOffsets(
            { x: spinX, y: spinY },
            ranges
          );
          const spinWorld = new THREE.Vector3(perp.x * side, vert, perp.z * side);
          clampCueTipOffset(spinWorld);
          const obstructionStrength = resolveCueObstruction(baseDir, pull);
          const obstructionTilt = obstructionStrength * CUE_OBSTRUCTION_TILT;
          const obstructionLift = obstructionStrength * CUE_OBSTRUCTION_LIFT;
          const obstructionTiltFromLift =
            obstructionLift > 0 ? Math.atan2(obstructionLift, cueLen) : 0;
          cueStick.position.set(
            cue.pos.x - baseDir.x * (cueLen / 2 + visualPull + CUE_TIP_GAP) + spinWorld.x,
            CUE_Y + spinWorld.y,
            cue.pos.y - baseDir.z * (cueLen / 2 + visualPull + CUE_TIP_GAP) + spinWorld.z
          );
          const tiltAmount = hasSpin ? Math.abs(spinY) : 0;
          const extraTilt = MAX_BACKSPIN_TILT * Math.min(tiltAmount, 1);
          applyCueButtTilt(
            cueStick,
            extraTilt + obstructionTilt + obstructionTiltFromLift,
            CUE_Y + spinWorld.y + obstructionLift * 0.25
          );
          cueStick.rotation.y = Math.atan2(baseDir.x, baseDir.z) + Math.PI;
          if (tipGroupRef.current) {
            tipGroupRef.current.position.set(0, 0, -cueLen / 2);
          }
          cueStick.visible = true;
          updateChalkVisibility(null);
          if (targetDir && targetBall) {
            const travelScale = BALL_R * (14 + powerStrength * 22);
            const tDir = new THREE.Vector3(targetDir.x, 0, targetDir.y);
            if (tDir.lengthSq() > 1e-8) {
              tDir.normalize();
            } else {
              tDir.copy(baseDir);
            }
            const targetStart = new THREE.Vector3(
              targetBall.pos.x,
              BALL_CENTER_Y,
              targetBall.pos.y
            );
            const distanceScale = travelScale;
            const tEnd = targetStart
              .clone()
              .add(tDir.clone().multiplyScalar(distanceScale));
            targetGeom.setFromPoints([targetStart, tEnd]);
            target.material.color.setHex(0xffd166);
            target.material.opacity = 0.65 + 0.3 * powerStrength;
            target.visible = true;
            target.computeLineDistances();
          } else if (railNormal && cueDir) {
            const bounceDir = new THREE.Vector3(cueDir.x, 0, cueDir.y).normalize();
            const bounceLength = BALL_R * (12 + powerStrength * 18);
            const bounceEnd = end
              .clone()
              .add(bounceDir.clone().multiplyScalar(bounceLength));
            targetGeom.setFromPoints([end, bounceEnd]);
            target.material.color.setHex(0x7ce7ff);
            target.material.opacity = 0.35 + 0.25 * powerStrength;
            target.visible = true;
            target.computeLineDistances();
          } else {
            target.visible = false;
          }
        } else if (canShowCue && activeAiPlan && !previewingAiShot) {
          aim.visible = false;
          tick.visible = false;
          target.visible = false;
          cueAfter.visible = false;
          impactRing.visible = false;
          updateChalkVisibility(null);
          const planDir = activeAiPlan.aimDir
            ? activeAiPlan.aimDir.clone()
            : aimDir.clone();
          if (planDir.lengthSq() < 1e-6) {
            planDir.set(0, 1);
          } else {
            planDir.normalize();
          }
          const dir = new THREE.Vector3(planDir.x, 0, planDir.y).normalize();
          const perp = new THREE.Vector3(-dir.z, 0, dir.x);
          if (perp.lengthSq() > 1e-8) perp.normalize();
          const powerTarget = THREE.MathUtils.clamp(activeAiPlan.power ?? powerRef.current ?? 0, 0, 1);
          const backInfo = calcTarget(
            cue,
            planDir.clone().multiplyScalar(-1),
            balls
          );
          const rawMaxPull = Math.max(0, backInfo.tHit - cueLen - CUE_TIP_GAP);
          const maxPull = Number.isFinite(rawMaxPull) ? rawMaxPull : CUE_PULL_BASE;
          const pullVisibilityBoost =
            aiOpponentEnabled && hudRef.current?.turn === 1
              ? AI_CUE_PULL_VISIBILITY_BOOST
              : PLAYER_CUE_PULL_VISIBILITY_BOOST;
          const desiredPull = computePullTargetFromPower(powerTarget, maxPull) * pullVisibilityBoost;
          const pull = computeCuePull(desiredPull, maxPull, { preserveLarger: true });
          const visualPull = applyVisualPullCompensation(pull, dir);
          const planSpin = activeAiPlan.spin ?? spinRef.current ?? { x: 0, y: 0 };
          const spinX = THREE.MathUtils.clamp(planSpin.x ?? 0, -1, 1);
          const spinY = THREE.MathUtils.clamp(planSpin.y ?? 0, -1, 1);
          const { side, vert, hasSpin } = computeSpinOffsets(
            { x: spinX, y: spinY },
            ranges
          );
          const spinWorld = new THREE.Vector3(perp.x * side, vert, perp.z * side);
          clampCueTipOffset(spinWorld);
          const obstructionStrength = resolveCueObstruction(dir, pull);
          const obstructionTilt = obstructionStrength * CUE_OBSTRUCTION_TILT;
          const obstructionLift = obstructionStrength * CUE_OBSTRUCTION_LIFT;
          const obstructionTiltFromLift =
            obstructionLift > 0 ? Math.atan2(obstructionLift, cueLen) : 0;
          cueStick.position.set(
            cue.pos.x - dir.x * (cueLen / 2 + visualPull + CUE_TIP_GAP) + spinWorld.x,
            CUE_Y + spinWorld.y,
            cue.pos.y - dir.z * (cueLen / 2 + visualPull + CUE_TIP_GAP) + spinWorld.z
          );
          const tiltAmount = hasSpin ? Math.abs(spinY) : 0;
          const extraTilt = MAX_BACKSPIN_TILT * Math.min(tiltAmount, 1);
          applyCueButtTilt(
            cueStick,
            extraTilt + obstructionTilt + obstructionTiltFromLift,
            CUE_Y + spinWorld.y
          );
          cueStick.rotation.y = Math.atan2(dir.x, dir.z) + Math.PI;
          if (tipGroupRef.current) {
            tipGroupRef.current.position.set(0, 0, -cueLen / 2);
          }
          cueStick.visible = true;
        } else {
          aimFocusRef.current = null;
          aim.visible = false;
          tick.visible = false;
          target.visible = false;
          cueAfter.visible = false;
          impactRing.visible = false;
          computeCuePull(0, CUE_PULL_BASE);
          if (tipGroupRef.current) {
            tipGroupRef.current.position.set(0, 0, -cueLen / 2);
          }
          if (!cueAnimating) cueStick.visible = false;
          updateChalkVisibility(null);
        }

        if (!shouldSlowAim) {
          const precisionArea = chalkAreaRef.current;
          if (precisionArea) precisionArea.visible = false;
        }
        chalkAssistTargetRef.current = shouldSlowAim;

        // Fizika
        balls.forEach((ball) => {
          if (!ball) return;
          const dropEntry = pocketDropRef.current.get(ball.id);
          const dropping = Boolean(dropEntry);
          if (ball.active && dropEntry) {
            pocketDropRef.current.delete(ball.id);
            ball.mesh.visible = true;
            if (ball.shadow) ball.shadow.visible = true;
          }
          if (!ball.active) {
            if (dropEntry) {
              ball.mesh.visible = true;
              if (ball.shadow) ball.shadow.visible = false;
            } else {
              ball.mesh.visible = false;
              if (ball.shadow) ball.shadow.visible = false;
            }
          }
        });
          for (let stepIndex = 0; stepIndex < physicsSubsteps; stepIndex++) {
          const stepScale = subStepScale;
          balls.forEach((b) => {
            if (!b.active) return;
            const isCue = b.id === 'cue';
            const hasSpin = b.spin?.lengthSq() > 1e-6;
            const hasLift = (b.lift ?? 0) > 1e-6 || Math.abs(b.liftVel ?? 0) > 1e-6;
            if (hasLift) {
              const dampedVel = (b.liftVel ?? 0) * Math.pow(MAX_POWER_BOUNCE_DAMPING, stepScale);
              const nextLift = Math.max(0, (b.lift ?? 0) + dampedVel * stepScale);
              const nextVel = dampedVel - MAX_POWER_BOUNCE_GRAVITY * stepScale;
              const landingNow =
                isCue && (b.lift ?? 0) > 1e-6 && nextLift <= 1e-4 && dampedVel < 0;
              if (landingNow) {
                const lastLanding = liftLandingTimeRef.current.get(b.id) ?? 0;
                const nowLanding = performance.now();
                if (nowLanding - lastLanding > MAX_POWER_LANDING_SOUND_COOLDOWN_MS) {
                  const landingVol = clamp(
                  Math.abs(dampedVel) / MAX_POWER_BOUNCE_IMPULSE,
                  0,
                  1
                );
                  const landingHitVol = Math.max(0.45, landingVol * 0.95);
                  playBallHit(landingHitVol);
                  liftLandingTimeRef.current.set(b.id, nowLanding);
                }
              }
            b.lift = nextLift;
            b.liftVel = Math.abs(nextLift) > 1e-6 ? nextVel : 0;
              if (nextLift <= 1e-4 && Math.abs(nextVel) <= 1e-4) {
                b.lift = 0;
                b.liftVel = 0;
              }
              if (hasSpin && (b.lift ?? 0) > 0) {
                const airborneSpin = TMP_VEC2_LIMIT.copy(b.spin ?? TMP_VEC2_LIMIT.set(0, 0));
                const spinMag = airborneSpin.length();
                if (spinMag > 1e-6) {
                  const liftRatio = THREE.MathUtils.clamp(
                    (b.lift ?? 0) / MAX_POWER_LIFT_HEIGHT,
                    0,
                    1.2
                  );
                  const driftScale = LIFT_SPIN_AIR_DRIFT * liftRatio * stepScale;
                  airborneSpin.normalize().multiplyScalar(driftScale);
                  b.vel.add(airborneSpin);
                }
              }
            }
            if (hasSpin) {
              const swerveTravel = isCue && b.spinMode === 'swerve' && !b.impacted;
              const allowRoll = !isCue || b.impacted || swerveTravel;
              const preImpact = isCue && !b.impacted;
              if (allowRoll) {
                const rollMultiplier = swerveTravel ? SWERVE_TRAVEL_MULTIPLIER : 1;
                TMP_VEC2_SPIN.copy(b.spin).multiplyScalar(
                  SPIN_ROLL_STRENGTH * rollMultiplier * stepScale
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
                const rollDecay = Math.pow(SPIN_ROLL_DECAY, stepScale);
                b.spin.multiplyScalar(rollDecay);
              } else {
                const airDecay = Math.pow(SPIN_AIR_DECAY, stepScale);
                b.spin.multiplyScalar(airDecay);
              }
              if (b.spin.lengthSq() < 1e-6) {
                b.spin.set(0, 0);
                if (b.pendingSpin) b.pendingSpin.set(0, 0);
                if (isCue) b.spinMode = 'standard';
              }
            }
            b.pos.addScaledVector(b.vel, stepScale);
            b.vel.multiplyScalar(Math.pow(FRICTION, stepScale));
            let speed = b.vel.length();
            let scaledSpeed = speed * stepScale;
            if (scaledSpeed < STOP_EPS) {
              b.vel.multiplyScalar(Math.pow(STOP_SOFTENING, stepScale));
              speed = b.vel.length();
              scaledSpeed = speed * stepScale;
            }
            const hasSpinAfter = b.spin?.lengthSq() > 1e-6;
            if (scaledSpeed < STOP_FINAL_EPS) {
              b.vel.set(0, 0);
              if (!hasSpinAfter && b.spin) b.spin.set(0, 0);
              if (!hasSpinAfter && b.pendingSpin) b.pendingSpin.set(0, 0);
              if (isCue && !hasSpinAfter) {
                b.impacted = false;
                b.spinMode = 'standard';
              }
              b.launchDir = null;
            }
            const railImpact = reflectRails(b);
            if (railImpact && b.id === 'cue') b.impacted = true;
            if (railImpact && shotContextRef.current.contactMade) {
              shotContextRef.current.cushionAfterContact = true;
            }
            if (railImpact && b.spin?.lengthSq() > 0) {
              applyRailSpinResponse(b, railImpact);
            }
            if (railImpact) {
              const nowRail = performance.now();
              const lastPlayed = railSoundTimeRef.current.get(b.id) ?? 0;
              if (nowRail - lastPlayed > RAIL_HIT_SOUND_COOLDOWN_MS) {
                // Cushion contacts stay silent so only ball collisions trigger audio.
                railSoundTimeRef.current.set(b.id, nowRail);
              }
            }
            const liftAmount = b.lift ?? 0;
            b.mesh.position.set(b.pos.x, BALL_CENTER_Y + liftAmount, b.pos.y);
            if (scaledSpeed > 0) {
              const axis = new THREE.Vector3(b.vel.y, 0, -b.vel.x).normalize();
              const angle = scaledSpeed / BALL_R;
              b.mesh.rotateOnWorldAxis(axis, angle);
            }
            if (b.shadow) {
              const droppingShadow = pocketDropRef.current.has(b.id);
              const shadowVisible = b.mesh.visible && !droppingShadow;
              b.shadow.visible = shadowVisible;
              if (shadowVisible) {
                b.shadow.position.set(b.pos.x, BALL_SHADOW_Y, b.pos.y);
                const liftInfluence = THREE.MathUtils.clamp(
                  liftAmount / (BALL_R * 1.4),
                  0,
                  1
                );
                const spread = 1 +
                  THREE.MathUtils.clamp(speed * 0.08, 0, 0.35) +
                  liftInfluence * 0.25;
                b.shadow.scale.setScalar(spread);
                b.shadow.material.opacity = THREE.MathUtils.clamp(
                  BALL_SHADOW_OPACITY + 0.12 - liftInfluence * 0.4,
                  0,
                  1
                );
              }
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
                const pairKey =
                  (a.id ?? i) < (b.id ?? j)
                    ? `${a.id ?? i}:${b.id ?? j}`
                    : `${b.id ?? j}:${a.id ?? i}`;
                const firstPairCollision = !newCollisions.has(pairKey);
                newCollisions.add(pairKey);
                const wasColliding = prevCollisions.has(pairKey);
                const isNewImpact = firstPairCollision && !wasColliding;
                a.pos.x -= nx * overlap;
                a.pos.y -= ny * overlap;
                b.pos.x += nx * overlap;
                b.pos.y += ny * overlap;
                const avn = a.vel.x * nx + a.vel.y * ny;
                const bvn = b.vel.x * nx + b.vel.y * ny;
                const impulse = Math.abs(bvn - avn);
                const at = a.vel
                  .clone()
                  .sub(new THREE.Vector2(nx, ny).multiplyScalar(avn));
                const bt = b.vel
                  .clone()
                  .sub(new THREE.Vector2(nx, ny).multiplyScalar(bvn));
                a.vel.copy(at.add(new THREE.Vector2(nx, ny).multiplyScalar(bvn)));
                b.vel.copy(bt.add(new THREE.Vector2(nx, ny).multiplyScalar(avn)));
                if (isNewImpact) {
                  const shotScale = 0.4 + 0.6 * lastShotPower;
                  const volume = clamp(
                    (impulse / BALL_COLLISION_SOUND_REFERENCE_SPEED) * shotScale,
                    0,
                    1
                  );
                  if (volume > 0) playBallHit(volume);
                }
                const cueBall = a.id === 'cue' ? a : b.id === 'cue' ? b : null;
                if (!firstHit) {
                  if (a.id === 'cue' && b.id !== 'cue') firstHit = b.id;
                  else if (b.id === 'cue' && a.id !== 'cue') firstHit = a.id;
                }
                if (
                  !shotContextRef.current.contactMade &&
                  (a.id === 'cue' || b.id === 'cue')
                ) {
                  shotContextRef.current.contactMade = true;
                }
                const hitBallId =
                  a.id === 'cue' && b.id !== 'cue'
                    ? b.id
                    : b.id === 'cue' && a.id !== 'cue'
                      ? a.id
                      : null;
                const targetImpactId = shotPrediction?.ballId ?? null;
                const isTargetImpact =
                  !targetImpactId || (hitBallId && String(hitBallId) === String(targetImpactId));
                if (
                  cueBall &&
                  hitBallId &&
                  isTargetImpact &&
                  isNewImpact &&
                  lastShotPower >= MAX_POWER_BOUNCE_THRESHOLD &&
                  !maxPowerLiftTriggered
                ) {
                  const bounceStrength = THREE.MathUtils.clamp(lastShotPower, 0, 1);
                  const liftBoost = 1.2;
                  maxPowerLiftTriggered = true;
                  const liftSoundVol = Math.max(0.7, bounceStrength * 0.95);
                  playCueHit(liftSoundVol);
                  const spinEnergy = cueBall.spin?.length() ?? 0;
                  const spinHeightBonus = spinEnergy * MAX_POWER_SPIN_LIFT_BONUS;
                  const liftCeiling = Math.min(
                    MAX_POWER_LIFT_HEIGHT * liftBoost + spinHeightBonus,
                    MAX_POWER_BOUNCE_IMPULSE * 0.9
                  );
                  cueBall.lift = Math.max(
                    cueBall.lift ?? 0,
                    liftCeiling
                  );
                  const launchCeiling = Math.min(
                    MAX_POWER_BOUNCE_IMPULSE * bounceStrength * liftBoost + spinHeightBonus,
                    MAX_POWER_BOUNCE_IMPULSE * 0.95
                  );
                  cueBall.liftVel = Math.max(
                    cueBall.liftVel ?? 0,
                    launchCeiling
                  );
                  if (spinEnergy > 1e-6) {
                    const spinThrow = Math.min(
                      spinEnergy * MAX_POWER_SPIN_LATERAL_THROW,
                      MAX_POWER_BOUNCE_IMPULSE * 0.4
                    );
                    if (spinThrow > 0 && cueBall.spin) {
                      const spinDir = TMP_VEC2_SPIN.copy(cueBall.spin).normalize();
                      cueBall.vel.add(spinDir.multiplyScalar(spinThrow));
                    }
                  }
                }
                if (
                  hitBallId &&
                  activeShotView?.mode === 'action' &&
                  activeShotView.targetId === hitBallId
                ) {
                  activeShotView.hitConfirmed = true;
                }
                if (cueBall && cueBall.spin?.lengthSq() > 0) {
                  cueBall.impacted = true;
                  applySpinImpulse(cueBall, 1.1);
                }
              }
            }
        }
        if (
          !activeShotView &&
          suspendedActionView?.mode === 'action' &&
          suspendedActionView.pendingActivation
        ) {
          const cueBall = balls.find((b) => b.id === suspendedActionView.cueId);
          if (cueBall?.active) {
            const cuePos = new THREE.Vector2(cueBall.pos.x, cueBall.pos.y);
            const travelStart =
              suspendedActionView.startCuePos || cuePos.clone();
            const travel = cuePos.distanceTo(travelStart);
            const now = performance.now();
            const travelReady =
              travel >= (suspendedActionView.activationTravel ?? 0);
            const delayReady =
              !suspendedActionView.activationDelay ||
              now >= suspendedActionView.activationDelay;
            const holdReady =
              !powerImpactHoldRef.current || now >= powerImpactHoldRef.current;
            if (travelReady && delayReady && holdReady) {
              const pending = suspendedActionView;
              pending.pendingActivation = false;
              pending.activationDelay = null;
              pending.activationTravel = 0;
              pending.lastUpdate = now;
              if (cameraRef.current) {
                pending.smoothedPos = cameraRef.current.position.clone();
                const storedTarget = lastCameraTargetRef.current?.clone();
                if (storedTarget) pending.smoothedTarget = storedTarget;
              }
              activeShotView = pending;
              suspendedActionView = null;
              updateCamera();
            }
          }
        }
        if (activeShotView?.mode === 'action') {
          const now = performance.now();
          const cueBall = balls.find((b) => b.id === activeShotView.cueId);
          if (!cueBall?.active) {
            const restoreView = activeShotView;
            activeShotView = null;
            suspendedActionView = null;
            restoreOrbitCamera(restoreView);
          } else {
            if (activeShotView.axis === 'short') {
              maybeForceShortRailPocketView(cueBall);
            }
            if (cueBall.vel.lengthSq() > 1e-6) {
              activeShotView.lastCueDir = cueBall.vel.clone().normalize();
            }
            if (activeShotView.stage === 'pair') {
              const targetBall =
                activeShotView.targetId != null
                  ? balls.find((b) => b.id === activeShotView.targetId)
                  : null;
              if (activeShotView.axis === 'short' && targetBall) {
                maybeForceShortRailPocketView(targetBall);
              }
              if (!targetBall?.active) {
                activeShotView.exitAfterHold = true;
                activeShotView.holdUntil = Math.max(
                  activeShotView.holdUntil ?? 0,
                  now + ACTION_CAM.followHoldMs
                );
              } else if (activeShotView.hitConfirmed) {
                const targetSpeed = targetBall.vel.length() * frameScale;
                if (targetSpeed <= STOP_EPS) {
                  activeShotView.exitAfterHold = true;
                  activeShotView.holdUntil = Math.max(
                    activeShotView.holdUntil ?? 0,
                    now + ACTION_CAM.followHoldMs
                  );
                }
              }
            }
            if (activeShotView.exitAfterHold) {
              const cueSpeed = cueBall.vel.length() * frameScale;
              if (cueSpeed > STOP_EPS) {
                activeShotView.holdUntil = now + ACTION_CAM.followHoldMs;
              } else if (
                activeShotView.holdUntil != null &&
                now >= activeShotView.holdUntil
              ) {
                const restoreView = activeShotView;
                activeShotView = null;
                suspendedActionView = null;
                restoreOrbitCamera(restoreView);
              }
            }
          }
        }
        const suppressPocketCameras =
          (broadcastSystemRef.current ?? activeBroadcastSystem ?? null)
            ?.avoidPocketCameras;
        const pocketHoldActive =
          powerImpactHoldRef.current &&
          performance.now() < powerImpactHoldRef.current;
        if (pocketHoldActive && activeShotView?.mode === 'pocket') {
          queuedPocketView = activeShotView;
          queuedPocketView.pendingActivation = true;
          activeShotView = null;
          updatePocketCameraState(false);
        }
        if (
          !suppressPocketCameras &&
          shooting &&
          !topViewRef.current
        ) {
          if (!pocketHoldActive && queuedPocketView) {
            const view = queuedPocketView;
            queuedPocketView = null;
            view.pendingActivation = false;
            view.activationDelay = null;
            view.lastUpdate = performance.now();
            if (cameraRef.current) {
              const cam = cameraRef.current;
              view.smoothedPos = cam.position.clone();
              const storedTarget = lastCameraTargetRef.current?.clone();
              if (storedTarget) {
                view.smoothedTarget = storedTarget;
              }
            }
            updatePocketCameraState(true);
            activeShotView = view;
          } else if (!pocketHoldActive && (activeShotView?.mode !== 'pocket' || !activeShotView)) {
            const ballsList = ballsRef.current?.length > 0 ? ballsRef.current : balls;
            const sph = sphRef.current;
            const orbitSnapshot = sph
              ? { radius: sph.radius, phi: sph.phi, theta: sph.theta }
              : null;
            const actionResume =
              activeShotView?.mode === 'action'
                ? activeShotView
                : suspendedActionView?.mode === 'action'
                  ? suspendedActionView
                  : null;
            const now = performance.now();
            let pocketIntent = pocketSwitchIntentRef.current;
            if (pocketIntent && now - pocketIntent.createdAt > POCKET_INTENT_TIMEOUT_MS) {
              pocketIntent = null;
              pocketSwitchIntentRef.current = null;
            }
            const movingBalls = ballsList.filter(
              (b) => b.active && b.vel.length() * frameScale >= STOP_EPS
            );
            const movingCount = movingBalls.length;
            const lastPocketBall = lastPocketBallRef.current;
            let bestPocketView = null;
            for (const ball of ballsList) {
              if (!ball.active) continue;
              const resumeView = orbitSnapshot ? { orbitSnapshot } : null;
              const matchesIntent = pocketIntent?.ballId === ball.id;
              const candidate = makePocketCameraView(ball.id, resumeView, {
                forceEarly: matchesIntent && pocketIntent?.allowEarly
              });
              if (!candidate) continue;
              const matchesPrediction = shotPrediction?.ballId === ball.id;
              const predictedAlignment = candidate.predictedAlignment ?? candidate.score ?? 0;
              const isDirectPrediction =
                matchesPrediction &&
                (shotPrediction?.railNormal === null ||
                  shotPrediction?.railNormal === undefined);
              const qualifiesAsGuaranteed =
                isDirectPrediction && predictedAlignment >= POCKET_GUARANTEED_ALIGNMENT;
              const allowDuringChaos =
                movingCount <= POCKET_CHAOS_MOVING_THRESHOLD ||
                matchesIntent ||
                qualifiesAsGuaranteed ||
                (lastPocketBall && lastPocketBall === ball.id);
              if (!allowDuringChaos) continue;
              if (
                movingCount > POCKET_CHAOS_MOVING_THRESHOLD &&
                !matchesIntent &&
                !qualifiesAsGuaranteed &&
                lastPocketBall &&
                lastPocketBall !== ball.id
              ) {
                continue;
              }
              const baseScore = candidate.score ?? 0;
              let priority = baseScore;
              if (matchesIntent && (pocketIntent?.forced ?? false)) priority += 1.2;
              else if (matchesIntent) priority += 0.6;
              if (qualifiesAsGuaranteed) priority += 0.4;
              if (candidate.forcedEarly) priority += 0.3;
              candidate.priority = priority;
              candidate.intentMatched = matchesIntent;
              candidate.guaranteed = qualifiesAsGuaranteed;
              if (
                !bestPocketView ||
                (candidate.priority ?? baseScore) >
                  (bestPocketView.priority ?? bestPocketView.score ?? 0)
              ) {
                bestPocketView = candidate;
              }
            }
            if (bestPocketView) {
              if (bestPocketView.intentMatched) {
                pocketSwitchIntentRef.current = null;
              }
              lastPocketBallRef.current = bestPocketView.ballId;
              bestPocketView.lastUpdate = performance.now();
              if (cameraRef.current) {
                const cam = cameraRef.current;
                bestPocketView.smoothedPos = cam.position.clone();
                const storedTarget = lastCameraTargetRef.current?.clone();
                if (storedTarget) {
                  bestPocketView.smoothedTarget = storedTarget;
                }
              }
              if (actionResume) {
                suspendedActionView = actionResume;
                bestPocketView.resumeAction = actionResume;
              } else {
                suspendedActionView = null;
              }
              updatePocketCameraState(true);
              activeShotView = bestPocketView;
            }
          }
        }
        // Pocket capture
        const pocketMarkers =
          table?.userData?.pockets && Array.isArray(table.userData.pockets)
            ? table.userData.pockets
            : [];
        const captureCenters =
          pocketMarkers.length > 0
            ? pocketMarkers.map(
                (marker) => new THREE.Vector2(marker.position.x, marker.position.z)
              )
            : centers;
        const captureRadii =
          pocketMarkers.length > 0
            ? pocketMarkers.map((marker, idx) =>
                typeof marker?.userData?.captureRadius === 'number'
                  ? marker.userData.captureRadius
                  : idx >= 4
                    ? SIDE_CAPTURE_R
                    : CAPTURE_R
              )
            : centers.map((_, idx) => (idx >= 4 ? SIDE_CAPTURE_R : CAPTURE_R));
        balls.forEach((b) => {
          if (!b.active) return;
          for (let pocketIndex = 0; pocketIndex < captureCenters.length; pocketIndex++) {
            const c = captureCenters[pocketIndex];
            const captureRadius = captureRadii[pocketIndex] ?? CAPTURE_R;
            if (b.pos.distanceTo(c) < captureRadius) {
              const entrySpeed = b.vel.length();
              const pocketVolume = THREE.MathUtils.clamp(
                entrySpeed / POCKET_DROP_SPEED_REFERENCE,
                0,
                1
              );
              if (shotRecording) {
                recordReplayFrame(performance.now());
              }
              playPocket(pocketVolume);
              b.active = false;
              b.vel.set(0, 0);
              if (b.spin) b.spin.set(0, 0);
              if (b.pendingSpin) b.pendingSpin.set(0, 0);
              b.spinMode = 'standard';
              b.launchDir = null;
              if (b.id === 'cue') b.impacted = false;
              const pocketId = POCKET_IDS[pocketIndex] ?? 'TM';
              const dropStart = performance.now();
              const holderDir = resolvePocketHolderDirection(c, pocketId);
              const pocketRestIndex =
                pocketRestIndexRef.current.get(pocketId) ?? 0;
              const pocketDropAnchor = table?.userData?.pocketDropAnchors?.get(pocketId) ?? null;
              const ringAnchor = pocketDropAnchor?.ringAnchor?.clone()
                ?? new THREE.Vector3(c.x, BALL_CENTER_Y - POCKET_DROP_DEPTH * 0.5, c.y);
              const holderSurfaceY = Number.isFinite(pocketDropAnchor?.holderSurfaceY)
                ? pocketDropAnchor.holderSurfaceY
                : BALL_CENTER_Y - POCKET_DROP_DEPTH;
              const holderSpacing = POCKET_HOLDER_REST_SPACING;
              const railStartDistance =
                POCKET_NET_RING_RADIUS_SCALE * POCKET_BOTTOM_R +
                POCKET_GUIDE_RING_CLEARANCE +
                POCKET_GUIDE_RING_OVERLAP;
              const railStartOffset = -railStartDistance;
              const restDistanceBase = Math.max(
                railStartDistance + POCKET_GUIDE_LENGTH - POCKET_HOLDER_REST_PULLBACK,
                railStartDistance + holderSpacing
              );
              const minRestDistance = Math.max(
                railStartDistance + holderSpacing * 0.5,
                railStartDistance + BALL_R * 0.6
              );
              const clampedRestIndex = Math.max(0, pocketRestIndex);
              const restDistance = Math.max(
                minRestDistance,
                restDistanceBase - clampedRestIndex * holderSpacing
              );
              pocketRestIndexRef.current.set(pocketId, pocketRestIndex + 1);
              const tiltDrop = Math.tan(POCKET_HOLDER_TILT_RAD) * restDistance;
              const restTarget = new THREE.Vector3(c.x, 0, c.y).addScaledVector(
                holderDir,
                restDistance
              );
              const targetX = restTarget.x;
              const targetZ = restTarget.z;
              const railRunStart = ringAnchor
                .clone()
                .addScaledVector(holderDir, railStartOffset)
                .add(
                  new THREE.Vector3(
                    0,
                    -POCKET_GUIDE_VERTICAL_DROP - POCKET_GUIDE_FLOOR_DROP,
                    0
                  )
                );
              const dropStartY = ringAnchor.y + BALL_R * 0.65;
              const dropEntry = {
                start: dropStart,
                fromY: dropStartY,
                currentY: dropStartY,
                targetY: holderSurfaceY - POCKET_HOLDER_REST_DROP - tiltDrop,
                fromX: ringAnchor.x,
                fromZ: ringAnchor.z,
                toX: targetX,
                toZ: targetZ,
                runFromX: railRunStart.x,
                runFromZ: railRunStart.z,
                mesh: b.mesh,
                entrySpeed,
                velocityY:
                  -Math.max(Math.abs(POCKET_DROP_ENTRY_VELOCITY), entrySpeed * 0.08),
                runSpeed: THREE.MathUtils.clamp(
                  entrySpeed * 0.8 + POCKET_HOLDER_RUN_ENTRY_SCALE,
                  POCKET_HOLDER_RUN_SPEED_MIN,
                  POCKET_HOLDER_RUN_SPEED_MAX
                ),
                holderDir,
                restDistance,
                settledAt: null,
                rollStartAt: null,
                rollProgress: 0,
                pocketId,
                resting: false
              };
              b.mesh.visible = true;
              b.mesh.scale.set(1, 1, 1);
              b.mesh.position.set(ringAnchor.x, dropStartY, ringAnchor.z);
              pocketDropRef.current.set(b.id, dropEntry);
              const mappedColor = toBallColorId(b.id);
              const colorId =
                mappedColor ?? (typeof b.id === 'string' ? b.id.toUpperCase() : 'UNKNOWN');
              potted.push({ id: b.id, color: colorId, pocket: pocketId });
              if (
                activeShotView?.mode === 'pocket' &&
                activeShotView.ballId === b.id
              ) {
                const pocketView = activeShotView;
                pocketView.completed = true;
                const now = performance.now();
                pocketView.holdUntil = Math.max(
                  pocketView.holdUntil ?? now,
                  now + POCKET_VIEW_POST_POT_HOLD_MS
                );
                pocketView.lastBallPos.set(
                  pocketView.pocketCenter.x,
                  pocketView.pocketCenter.y
                );
              }
              break;
            }
          }
        });
        if (activeShotView?.mode === 'pocket') {
          const pocketView = activeShotView;
          const focusBall = balls.find((b) => b.id === pocketView.ballId);
          const now = performance.now();
          const maxHoldReached =
            pocketView.startedAt != null && now - pocketView.startedAt >= POCKET_VIEW_MAX_HOLD_MS;
          if (!focusBall?.active) {
            if (pocketView.holdUntil == null) {
              pocketView.holdUntil = now + POCKET_VIEW_POST_POT_HOLD_MS;
            }
            if (now >= pocketView.holdUntil) {
              resumeAfterPocket(pocketView, now);
            }
          } else {
            const newRailHit =
              focusBall.lastRailHitAt != null &&
              (pocketView.lastRailHitAt == null ||
                focusBall.lastRailHitAt > pocketView.lastRailHitAt);
            if (newRailHit) {
              pocketView.lastRailHitAt = focusBall.lastRailHitAt;
              pocketView.lastRailHitType =
                focusBall.lastRailHitType ?? pocketView.lastRailHitType ?? 'rail';
              const extendTo = now + POCKET_VIEW_ACTIVE_EXTENSION_MS;
              pocketView.holdUntil =
                pocketView.holdUntil != null
                  ? Math.max(pocketView.holdUntil, extendTo)
                  : extendTo;
            } else {
              const toPocket = pocketView.pocketCenter.clone().sub(focusBall.pos);
              const dist = toPocket.length();
              if (dist > 1e-4) {
                const approachDir = toPocket.clone().normalize();
                pocketView.approach.copy(approachDir);
              }
              const speed = focusBall.vel.length() * frameScale;
              if (speed > STOP_EPS) {
                const extendTo = now + POCKET_VIEW_ACTIVE_EXTENSION_MS;
                pocketView.holdUntil =
                  pocketView.holdUntil != null
                    ? Math.max(pocketView.holdUntil, extendTo)
                    : extendTo;
              } else if (maxHoldReached) {
                resumeAfterPocket(pocketView, now);
              } else {
                const holdTarget = Math.max(
                  pocketView.holdUntil ?? now,
                  now + POCKET_VIEW_POST_POT_HOLD_MS
                );
                pocketView.holdUntil = holdTarget;
                if (now >= holdTarget) {
                  resumeAfterPocket(pocketView, now);
                }
              }
            }
          }
        }
        // Fund i goditjes
          if (shotRecording && shooting) {
            recordReplayFrame(now);
          }
          if (shooting) {
            const any = balls.some(
              (b) => b.active && b.vel.length() * frameScale >= STOP_EPS
            );
            if (!any) {
              resolve();
            } else if (shotStartedAt > 0 && now - shotStartedAt >= STUCK_SHOT_TIMEOUT_MS) {
              console.warn('Shot timeout reached; forcing resolve to prevent a stuck frame.');
              balls.forEach((ball) => {
                if (!ball) return;
                if (ball.vel) ball.vel.set(0, 0);
                if (ball.spin) ball.spin.set(0, 0);
                if (ball.pendingSpin) ball.pendingSpin.set(0, 0);
                ball.launchDir = null;
                ball.impacted = false;
              });
              resolve();
            }
          }
          if (pocketDropRef.current.size > 0) {
            pocketDropRef.current.forEach((entry, key) => {
              const { mesh } = entry;
              if (!mesh) {
                pocketDropRef.current.delete(key);
                return;
              }
              const targetY = entry.targetY ?? BALL_CENTER_Y - POCKET_DROP_STRAP_DEPTH;
              const fromY = entry.fromY ?? BALL_CENTER_Y;
              const fallDistance = Math.max(fromY - targetY, MICRO_EPS);
              const runFromX = entry.runFromX ?? entry.fromX;
              const runFromZ = entry.runFromZ ?? entry.fromZ;
              if (entry.resting) {
                mesh.visible = true;
                mesh.position.set(entry.toX ?? runFromX, targetY, entry.toZ ?? runFromZ);
                mesh.scale.set(1, 1, 1);
                return;
              }
              entry.velocityY =
                (entry.velocityY ?? POCKET_DROP_ENTRY_VELOCITY) -
                POCKET_DROP_GRAVITY * deltaSeconds;
              entry.currentY =
                (entry.currentY ?? fromY) + (entry.velocityY ?? 0) * deltaSeconds;
              const reachedStrap = entry.currentY <= targetY;
              if (reachedStrap) {
                entry.currentY = targetY;
                entry.velocityY = 0;
                entry.settledAt = entry.settledAt ?? now;
                entry.rollStartAt = entry.rollStartAt ?? now + POCKET_DROP_RING_HOLD_MS;
              }
              const xDrop = entry.fromX;
              const zDrop = entry.fromZ;
              let posX = xDrop;
              let posZ = zDrop;
              mesh.visible = true;
              mesh.scale.set(1, 1, 1);
              if (entry.rollStartAt && now >= entry.rollStartAt) {
                const runSpeed = Math.max(MICRO_EPS, entry.runSpeed ?? POCKET_HOLDER_RUN_SPEED_MIN);
                const rollDuration = Math.max(MICRO_EPS, (entry.restDistance ?? 0) / runSpeed);
                const rollElapsed = now - entry.rollStartAt;
                const rollProgress = THREE.MathUtils.clamp(rollElapsed / rollDuration, 0, 1);
                entry.rollProgress = rollProgress;
                posX = THREE.MathUtils.lerp(runFromX, entry.toX ?? runFromX, rollProgress);
                posZ = THREE.MathUtils.lerp(runFromZ, entry.toZ ?? runFromZ, rollProgress);
                if (rollProgress >= 1 && entry.settledAt && now - entry.settledAt >= POCKET_DROP_REST_HOLD_MS) {
                  entry.resting = true;
                }
              }
              mesh.position.set(posX, entry.currentY, posZ);
            });
          }
          prevCollisions = newCollisions;
          const fit = fitRef.current;
          if (fit && cue?.active && !shooting) {
            const limX =
              PLAY_W / 2 - BALL_R - SIDE_RAIL_INNER_THICKNESS;
            const limY =
              PLAY_H / 2 - BALL_R - SIDE_RAIL_INNER_THICKNESS;
            const edgeX = Math.max(0, Math.abs(cue.pos.x) - (limX - 5));
            const edgeY = Math.max(0, Math.abs(cue.pos.y) - (limY - 5));
            const edge = Math.min(1, Math.max(edgeX, edgeY) / 5);
            fit(1 + edge * 0.08);
          }
          const frameCamera = updateCamera();
          renderer.render(scene, frameCamera ?? camera);
          const shouldStreamAim =
            isOnlineMatch &&
            tableId &&
            !shooting &&
            hudRef.current?.turn === 0 &&
            !(hudRef.current?.over);
          if (shouldStreamAim) {
            const intervalTarget = frameTiming?.targetMs ?? 1000 / 60;
            const minInterval = Math.max(30, intervalTarget * 1.5);
            if (!lastLiveAimSentAt || now - lastLiveAimSentAt >= minInterval) {
              const aimVec = aimDirRef.current;
              socket.emit('poolFrame', {
                tableId,
                hud: hudRef.current,
                frameTs: now,
                playerId: accountIdRef.current || accountId || '',
                aim: {
                  dir: { x: aimVec.x ?? 0, y: aimVec.y ?? 0 },
                  power: powerRef.current ?? 0,
                  spin: spinRef.current ?? { x: 0, y: 0 },
                  cueBall: cue?.pos ? { x: cue.pos.x, y: cue.pos.y } : null
                }
              });
              lastLiveAimSentAt = now;
            }
          }
          const shouldStreamLayout =
            isOnlineMatch &&
            tableId &&
            shooting &&
            typeof captureBallSnapshot === 'function';
          if (shouldStreamLayout) {
            const intervalTarget = frameTiming?.targetMs ?? 1000 / 60;
            const minInterval = Math.max(4, intervalTarget * 0.9);
            if (!lastLiveSyncSentAt || now - lastLiveSyncSentAt >= minInterval) {
              const layout = captureBallSnapshot();
              socket.emit('poolFrame', {
                tableId,
                layout,
                hud: hudRef.current,
                frameTs: now,
                playerId: accountIdRef.current || accountId || ''
              });
              lastLiveSyncSentAt = now;
            }
          }
          if (!disposed) {
            rafRef.current = requestAnimationFrame(step);
          }
        } catch (error) {
          console.error('Pool Royale render loop failed; attempting recovery.', error);
          if (!disposed) {
            rafRef.current = requestAnimationFrame(step);
          }
        }
      };
      step(performance.now());

      // Resize
      const onResize = () => {
        if (disposed || !host) return;
        renderer.setSize(host.clientWidth, host.clientHeight);
        // Update canvas dimensions when the window size changes so the table
        // remains fully visible.
        const scaleChanged = applyWorldScaleRef.current?.() ?? false;
        if (!scaleChanged) {
          const margin = Math.max(
            STANDING_VIEW.margin,
            topViewRef.current
              ? TOP_VIEW_MARGIN
              : window.innerHeight > window.innerWidth
                ? STANDING_VIEW_MARGIN_PORTRAIT
                : STANDING_VIEW_MARGIN_LANDSCAPE
          );
          fit(margin);
        }
        const resizeAspect = host.clientWidth / host.clientHeight;
        pocketCamerasRef.current.forEach((entry) => {
          if (!entry?.camera) return;
          entry.camera.aspect = resizeAspect;
          entry.camera.updateProjectionMatrix();
        });
      };
      window.addEventListener('resize', onResize);

      return () => {
        disposed = true;
        cancelCameraBlendTween();
        applyWorldScaleRef.current = () => {};
        topViewControlsRef.current = { enter: () => {}, exit: () => {} };
        cameraUpdateRef.current = () => {};
        cancelAnimationFrame(rafRef.current);
        window.removeEventListener('resize', onResize);
        updatePocketCameraState(false);
        pocketCamerasRef.current.clear();
        pocketDropRef.current.clear();
        pocketRestIndexRef.current.clear();
        captureBallSnapshotRef.current = null;
        applyBallSnapshotRef.current = null;
        pendingLayoutRef.current = null;
        captureReplayCameraSnapshotRef.current = null;
        pendingRemoteReplayRef.current = null;
        incomingRemoteShotRef.current = null;
        remoteShotActiveRef.current = false;
        remoteShotUntilRef.current = 0;
        remoteAimRef.current = null;
        lightingRigRef.current = null;
        worldRef.current = null;
        activeRenderCameraRef.current = null;
        cueBodyRef.current = null;
        tipGroupRef.current = null;
        try {
          host.removeChild(renderer.domElement);
        } catch {}
        if (renderer?.domElement) {
          renderer.domElement.removeEventListener('webglcontextlost', handleContextLost, false);
          renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored, false);
        }
        dom.removeEventListener('mousedown', down);
        dom.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
        dom.removeEventListener('touchstart', down);
        dom.removeEventListener('touchmove', move);
        window.removeEventListener('touchend', up);
        window.removeEventListener('keydown', keyRot);
        dom.removeEventListener('pointerdown', handleInHandDown);
        dom.removeEventListener('pointermove', handleInHandMove);
        window.removeEventListener('pointerup', endInHandDrag);
        dom.removeEventListener('pointercancel', endInHandDrag);
        window.removeEventListener('pointercancel', endInHandDrag);
        applyBaseRef.current = () => {};
        applyFinishRef.current = () => {};
        applyTableSlotRef.current = () => {};
        clearSecondaryTableDecorRef.current?.();
        refreshSecondaryTableDecorRef.current = () => {};
        clearSecondaryTableDecorRef.current = () => {};
        secondaryTableDecorRef.current = { group: null, dispose: null };
        clearDecorTablesRef.current?.();
        decorativeTablesRef.current = [];
        updateDecorTablesRef.current = () => {};
        clearDecorTablesRef.current = () => {};
        clearHospitalityLayoutRef.current?.();
        hospitalityGroupsRef.current = [];
        updateHospitalityLayoutRef.current = () => {};
        clearHospitalityLayoutRef.current = () => {};
        chessBoardTextureRef.current?.dispose?.();
        dartboardTextureRef.current?.dispose?.();
        chessBoardTextureRef.current = null;
        dartboardTextureRef.current = null;
        applyRailMarkerStyleRef.current = () => {};
        secondaryTableRef.current = null;
        secondaryBaseSetterRef.current = null;
        chalkMeshesRef.current = [];
        chalkAreaRef.current = null;
        visibleChalkIndexRef.current = null;
        chalkAssistTargetRef.current = false;
        while (cueRackDisposers.length) {
          const dispose = cueRackDisposers.pop();
          try {
            dispose?.();
          } catch {}
        }
        cueRackGroupsRef.current = [];
        cueOptionGroupsRef.current = [];
        cueRackMetaRef.current = new Map();
        if (cueMaterialsRef.current?.shaft) {
          const textures = cueMaterialsRef.current.shaft.userData?.textures;
          if (textures) {
            Object.values(textures).forEach((tex) => tex?.dispose?.());
          }
          disposeMaterialWithWood(cueMaterialsRef.current.shaft);
        }
        if (cueMaterialsRef.current?.buttMaterial) {
          cueMaterialsRef.current.buttMaterial.dispose?.();
        }
        if (cueMaterialsRef.current?.buttRingMaterial) {
          cueMaterialsRef.current.buttRingMaterial.dispose?.();
        }
        if (cueMaterialsRef.current?.buttCapMaterial) {
          cueMaterialsRef.current.buttCapMaterial.dispose?.();
        }
        cueMaterialsRef.current.shaft = null;
        cueMaterialsRef.current.buttMaterial = null;
        cueMaterialsRef.current.buttRingMaterial = null;
        cueMaterialsRef.current.buttCapMaterial = null;
        cueMaterialsRef.current.styleIndex = null;
        disposeEnvironmentRef.current?.();
        disposeEnvironmentRef.current = null;
        envTextureRef.current = null;
        envSkyboxRef.current = null;
        envSkyboxTextureRef.current = null;
        cueGalleryStateRef.current.active = false;
        cueGalleryStateRef.current.rackId = null;
        cueGalleryStateRef.current.prev = null;
        cueGalleryStateRef.current.position?.set(0, 0, 0);
        cueGalleryStateRef.current.target?.set(0, 0, 0);
        sceneRef.current = null;
      };
      } catch (e) {
      console.error(e);
      setErr(e?.message || String(e));
      }
  }, [renderResetKey]);

  useEffect(() => {
    applyFinishRef.current?.(tableFinish);
    applyRailMarkerStyleRef.current?.(railMarkerStyleRef.current);
  }, [tableFinish]);
  useEffect(() => {
    applyBaseRef.current?.(activeTableBase);
  }, [activeTableBase]);
  useEffect(() => {
    if (!secondaryTableReady) return;
    if (environmentHdriId === 'musicHall02') {
      refreshSecondaryTableDecorRef.current?.();
    } else {
      clearSecondaryTableDecorRef.current?.();
    }
  }, [environmentHdriId, secondaryTableReady]);
  useEffect(() => {
    updateDecorTablesRef.current?.(environmentHdriId);
    updateHospitalityLayoutRef.current?.(environmentHdriId);
  }, [environmentHdriId]);

  useLayoutEffect(() => {
    const computeInsets = () => {
      if (!isPortrait) {
      const left = uiScale * 150;
      const right = uiScale * (SPIN_CONTROL_DIAMETER_PX + 150);
      setHudInsets({
        left: `${left}px`,
        right: `${right}px`
      });
      setBottomHudOffset(0);
      return;
      }
      const leftBox = leftControlsRef.current?.getBoundingClientRect();
      const spinBox = spinBoxRef.current?.getBoundingClientRect();
      const viewportWidth =
      typeof window !== 'undefined'
        ? window.innerWidth || document.documentElement?.clientWidth || 0
        : 0;
      const fallbackLeftWidth = uiScale * 120;
      const fallbackSpinWidth = uiScale * (SPIN_CONTROL_DIAMETER_PX + 64);
      const leftInset = (leftBox?.width ?? fallbackLeftWidth) + 12;
      const rightInset =
      (spinBox?.width ?? fallbackSpinWidth) +
      uiScale * 32 +
      12;
      setHudInsets({
      left: `${leftInset}px`,
      right: `${rightInset}px`
      });
      if (viewportWidth > 0) {
      const sideMargin = 16;
      const leftCenter =
        (leftBox ? leftBox.left + leftBox.width / 2 : leftInset / 2 + sideMargin);
      const spinWidth = spinBox?.width ?? fallbackSpinWidth;
      const spinLeft = spinBox?.left ?? viewportWidth - (spinWidth + sideMargin);
      const spinCenter = spinLeft + spinWidth / 2;
      const desiredCenter = (leftCenter + spinCenter) / 2;
      const screenCenter = viewportWidth / 2;
      setBottomHudOffset(desiredCenter - screenCenter - PORTRAIT_HUD_HORIZONTAL_NUDGE_PX);
      } else {
      setBottomHudOffset(0);
      }
    };
    computeInsets();
    window.addEventListener('resize', computeInsets);
    return () => window.removeEventListener('resize', computeInsets);
  }, [isPortrait, uiScale]);

  // --------------------------------------------------
  // NEW Big Pull Slider (right side): drag DOWN to set power, releases → fire()
  // --------------------------------------------------
  const sliderRef = useRef(null);
  const showPowerSlider = !hud.over && !replayActive;
  useEffect(() => {
    if (!showPowerSlider) {
      return undefined;
    }
    const mount = sliderRef.current;
    if (!mount) return undefined;
    const slider = new PoolRoyalePowerSlider({
      mount,
      value: powerRef.current * 100,
      cueSrc: '/assets/snooker/cue.webp',
      labels: true,
      onChange: (v) => applyPower(v / 100),
      onCommit: () => {
      fireRef.current?.();
      requestAnimationFrame(() => {
        slider.set(slider.min, { animate: true });
        applyPower(0);
      });
      }
    });
    sliderInstanceRef.current = slider;
    applySliderLock();
    return () => {
      sliderInstanceRef.current = null;
      slider.destroy();
    };
  }, [applySliderLock, showPowerSlider]);
  useEffect(() => {
    if (shotActive || hud.over || hud.turn !== 0) return;
    const slider = sliderInstanceRef.current;
    if (slider) {
      slider.set(slider.min, { animate: true });
    }
    applyPower(0);
    cuePullCurrentRef.current = 0;
    cuePullTargetRef.current = 0;
  }, [applyPower, hud.over, hud.turn, shotActive]);

  const isPlayerTurn = hud.turn === 0;
  const isOpponentTurn = hud.turn === 1;
  const showPlayerControls = isPlayerTurn && !hud.over && !replayActive;
  const showSpinController =
    !hud.over && !replayActive && (isPlayerTurn || aiTakingShot);

  // Spin controller interactions
  useEffect(() => {
    if (!showSpinController) {
      spinDotElRef.current = null;
      resetSpinRef.current = () => {};
      spinRequestRef.current = { x: 0, y: 0 };
      spinLegalityRef.current = { blocked: false, reason: '' };
      return;
    }

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
      const normalized = clampToUnitCircle(nx, ny);
      spinRequestRef.current = normalized;
      const limited = clampToLimits(normalized.x, normalized.y);
      spinRef.current = limited;
      const cueBall = cueRef.current;
      const ballsList = ballsRef.current?.length
        ? ballsRef.current
        : undefined;
      const aimVec = aimDirRef.current;
      const axes = aimVec ? prepareSpinAxes(aimVec) : null;
      const activeCamera = activeRenderCameraRef.current ?? cameraRef.current;
      const viewVec = cueBall && activeCamera
        ? computeCueViewVector(cueBall, activeCamera)
        : null;
      const legality = checkSpinLegality2D(
        cueBall,
        normalized,
        ballsList || [],
        {
          axes,
          view: viewVec ? { x: viewVec.x, y: viewVec.y } : null
        }
      );
      spinLegalityRef.current = legality;
      updateSpinDotPosition(limited, legality.blocked);
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
      setSpin(nx, ny);
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

    if (showPlayerControls) {
      box.addEventListener('pointerdown', handlePointerDown);
      box.addEventListener('pointermove', handlePointerMove);
      box.addEventListener('pointerup', handlePointerUp);
      box.addEventListener('pointercancel', handlePointerCancel);
    }

    return () => {
      spinDotElRef.current = null;
      releasePointer();
      clearTimer();
      resetSpinRef.current = () => {};
      spinRequestRef.current = { x: 0, y: 0 };
      spinLegalityRef.current = { blocked: false, reason: '' };
      box.removeEventListener('pointerdown', handlePointerDown);
      box.removeEventListener('pointermove', handlePointerMove);
      box.removeEventListener('pointerup', handlePointerUp);
      box.removeEventListener('pointercancel', handlePointerCancel);
    };
  }, [showPlayerControls, showSpinController, updateSpinDotPosition]);

  const americanBallSwatches = useMemo(() => {
    const colors = POOL_VARIANT_COLOR_SETS.american.objectColors || [];
    return colors.reduce((acc, hex, idx) => {
      acc[idx + 1] = `#${hex.toString(16).padStart(6, '0')}`;
      return acc;
    }, {});
  }, []);
  const ballPreviewCache = useRef(new Map());
  const ballSwatches = useMemo(
    () => ({
      RED: '#d12c2c',
      YELLOW: '#ffd700',
      BLUE: '#3b82f6',
      BLACK: '#0b0b0b',
      GREEN: '#22c55e',
      BROWN: '#8b5a2b',
      PINK: '#ff6ca1',
      STRIPE: '#fef9c3',
      SOLID: '#e5e7eb',
      CUE: '#f8fafc'
    }),
    []
  );
  const darkenHex = useCallback((hex, factor = 0.82) => {
    const normalized = hex.startsWith('#') ? hex.slice(1) : hex;
    const num = parseInt(normalized, 16);
    if (Number.isNaN(num) || normalized.length > 6) return hex;
    const r = Math.max(0, Math.min(255, Math.round(((num >> 16) & 0xff) * factor)));
    const g = Math.max(0, Math.min(255, Math.round(((num >> 8) & 0xff) * factor)));
    const b = Math.max(0, Math.min(255, Math.round((num & 0xff) * factor)));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  }, []);
  const getBallPreview = useCallback(
    ({ colorHex, pattern, number }) => {
      if (!colorHex) return null;
      const cacheKey = `${pattern}|${number ?? 'none'}|${colorHex}`;
      const cache = ballPreviewCache.current;
      if (cache.has(cacheKey)) return cache.get(cacheKey);
      const preview = createBallPreviewDataUrl({
        color: colorHex,
        pattern,
        number,
        variantKey: 'pool',
        size: 128
      });
      cache.set(cacheKey, preview || null);
      return preview;
    },
    [ballPreviewCache]
  );
  const pottedTokenSize = isPortrait ? 18 : 20;
  const pottedGap = isPortrait ? 6 : 8;
  const renderPottedRow = useCallback(
    (entries = []) => {
      if (!entries.length) {
        return (
          <div
            className="flex items-center opacity-70"
            style={{ gap: `${Math.max(2, pottedGap * 0.5)}px` }}
          >
            {Array.from({ length: 4 }).map((_, idx) => (
              <span
                key={`ghost-${idx}`}
                className="flex-shrink-0 rounded-full border border-white/25 bg-white/10 shadow-inner"
                style={{ width: pottedTokenSize, height: pottedTokenSize }}
              />
            ))}
          </div>
        );
      }
      return (
        <div
          className="flex items-center overflow-hidden whitespace-nowrap"
          style={{ gap: `${pottedGap}px` }}
        >
          {entries.map((entry, index) => {
            const colorKey = String(entry.color || '').toUpperCase();
            const idMatch =
              typeof entry.id === 'string'
                ? /(\d+)/.exec(entry.id)
                : colorKey.startsWith('BALL_')
                  ? /BALL_(\d+)/.exec(colorKey)
                  : null;
            const ballNumber = idMatch ? parseInt(idMatch[1], 10) : null;
            const isStripe =
              (isUkAmericanSet && ballNumber != null && ballNumber >= 9) ||
              colorKey === 'STRIPE';
            const isSolid =
              (isUkAmericanSet && ballNumber != null && ballNumber > 0 && ballNumber < 9) ||
              colorKey === 'SOLID';
            let colorHex =
              (isUkAmericanSet && ballNumber != null
                ? americanBallSwatches[ballNumber]
                : null) ||
              ballSwatches[colorKey] ||
              (ballNumber != null ? americanBallSwatches[ballNumber] : null) ||
              (colorKey.startsWith('BALL_') ? '#f5f5f4' : '#e5e7eb');
            const label =
              ballNumber != null
                ? ballNumber
                : colorKey === 'BLACK'
                  ? '8'
                  : isStripe
                    ? 'ST'
                    : isSolid
                      ? 'SO'
                      : colorKey.charAt(0);
            const textColor = colorKey === 'BLACK' ? '#f8fafc' : '#0f172a';
            const shade = darkenHex(colorHex, 0.6);
            const gloss = isStripe
              ? `linear-gradient(90deg, transparent 28%, rgba(255,255,255,0.9) 28%, rgba(255,255,255,0.9) 72%, transparent 72%), `
              : '';
            const background = `${gloss}radial-gradient(circle at 30% 30%, rgba(255,255,255,0.82) 0, rgba(255,255,255,0.58) 36%, ${colorHex} 62%, ${shade} 94%)`;
            const previewUrl = getBallPreview({
              colorHex,
              pattern: isStripe ? 'stripe' : 'solid',
              number: ballNumber ?? (colorKey === 'BLACK' ? 8 : null)
            });
            const altLabel = `Pocketed ${label}`;
            return (
              <span
                key={`${entry.id ?? colorKey}-${index}`}
                className="relative flex flex-shrink-0 items-center justify-center"
                style={{ width: pottedTokenSize, height: pottedTokenSize }}
                title={altLabel}
              >
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={altLabel}
                    className="h-full w-full rounded-full border border-white/40 shadow-[0_2px_6px_rgba(0,0,0,0.35)]"
                  />
                ) : (
                  <span
                    className="flex h-full w-full items-center justify-center rounded-full border border-white/40 text-[9px] font-bold leading-none shadow-[0_2px_6px_rgba(0,0,0,0.35)]"
                    style={{ background, color: textColor }}
                  >
                    <span className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]">{label}</span>
                  </span>
                )}
              </span>
            );
          })}
        </div>
      );
    },
    [americanBallSwatches, ballSwatches, darkenHex, getBallPreview, isUkAmericanSet, pottedGap, pottedTokenSize]
  );
  const playerSeatId = localSeat === 'A' ? 'A' : 'B';
  const opponentSeatId = playerSeatId === 'A' ? 'B' : 'A';
  const playerPotted = pottedBySeat[playerSeatId] || [];
  const opponentPotted = pottedBySeat[opponentSeatId] || [];
  const bottomHudVisible = hud.turn != null && !hud.over && !shotActive && !replayActive;
  const bottomHudScale = isPortrait ? uiScale * 0.95 : uiScale * 1.02;
  const avatarSizeClass = isPortrait ? 'h-8 w-8' : 'h-12 w-12';
  const nameWidthClass = isPortrait ? 'max-w-[6.5rem]' : 'max-w-[8.75rem]';
  const nameTextClass = isPortrait ? 'text-xs' : 'text-sm';
  const hudGapClass = isPortrait ? 'gap-3' : 'gap-5';
  const bottomHudLayoutClass = isPortrait ? 'justify-center px-4 w-full' : 'justify-center';
  const playerPanelClass = isPortrait
    ? `flex min-w-0 items-center gap-2.5 rounded-full ${isPlayerTurn ? 'text-white' : 'text-white/80'}`
    : `flex min-w-0 items-center ${isPortrait ? 'gap-3' : 'gap-4'} rounded-full transition-all ${
        isPlayerTurn
          ? 'bg-emerald-400/20 pl-4 pr-3 text-white ring-2 ring-emerald-300/70'
          : 'pl-3.5 pr-3 text-white/80'
      }`;
  const opponentPanelClass = isPortrait
    ? `flex min-w-0 items-center gap-2.5 rounded-full ${isOpponentTurn ? 'text-white' : 'text-white/80'}`
    : `flex min-w-0 items-center ${isPortrait ? 'gap-3' : 'gap-4'} rounded-full transition-all ${
        isOpponentTurn
          ? 'bg-emerald-400/20 pl-3 pr-4 text-white ring-2 ring-emerald-300/70'
          : 'pl-3 pr-3.5 text-white/80'
      }`;
  const playerPanelStyle = isPortrait
    ? {
        boxShadow: isPlayerTurn
          ? '0 0 18px rgba(16,185,129,0.32), -10px 0 18px rgba(16,185,129,0.18)'
          : '0 6px 14px rgba(0,0,0,0.35)'
      }
    : {
        boxShadow: isPlayerTurn
          ? '0 0 18px rgba(16,185,129,0.35), -14px 0 22px rgba(16,185,129,0.28)'
          : '0 6px 14px rgba(0,0,0,0.35)'
      };
  const opponentPanelStyle = isPortrait
    ? {
        boxShadow: isOpponentTurn
          ? '0 0 18px rgba(16,185,129,0.32), 10px 0 18px rgba(16,185,129,0.18)'
          : '0 6px 14px rgba(0,0,0,0.35)'
      }
    : {
        boxShadow: isOpponentTurn
          ? '0 0 18px rgba(16,185,129,0.35), 14px 0 22px rgba(16,185,129,0.28)'
          : '0 6px 14px rgba(0,0,0,0.35)'
      };
  const renderFlagAvatar = useCallback(
    (flagEmoji, label, isActive) => (
      <span
        className={`${avatarSizeClass} flex items-center justify-center rounded-full border-2 text-xl font-semibold shadow-[0_4px_12px_rgba(0,0,0,0.45)] ${
          isActive ? 'border-emerald-200 bg-emerald-400/20' : 'border-white/60 bg-white/10'
        }`}
        role="img"
        aria-label={`${label} flag`}
      >
        <span className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">{flagEmoji || '🏳️'}</span>
      </span>
    ),
    [avatarSizeClass]
  );

  return (
    <div className="w-full h-[100vh] bg-black text-white overflow-hidden select-none">
      {/* Canvas host now stretches full width so table reaches the slider */}
      <div ref={mountRef} className="absolute inset-0" />

      {replayBanner && (
        <div className="pointer-events-none absolute top-4 right-4 z-50">
          <div
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-300 to-cyan-300 px-5 py-2 text-xs font-bold uppercase tracking-[0.28em] text-slate-900 shadow-[0_12px_32px_rgba(0,0,0,0.45)] ring-2 ring-white/30"
            aria-live="polite"
          >
            <span className="drop-shadow-[0_1px_2px_rgba(255,255,255,0.35)]">
              {replayBanner}
            </span>
          </div>
        </div>
      )}
      {ruleToast && (
        <div className="pointer-events-none absolute left-1/2 top-6 z-50 -translate-x-1/2 px-3 text-center">
          <span className="text-sm font-bold uppercase tracking-[0.24em] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)]">
            {ruleToast}
          </span>
        </div>
      )}
      {winnerOverlay && (
        <div className="pointer-events-none absolute inset-0 z-[120] flex items-center justify-center bg-black/70 px-4">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="relative">
              <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-amber-300 bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 shadow-[0_0_32px_rgba(250,204,21,0.55)]">
                {winnerOverlay.avatar ? (
                  <img
                    src={winnerOverlay.avatar}
                    alt={`${winnerOverlay.name} avatar`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-4xl">🏆</span>
                )}
              </div>
              <div className="absolute inset-0 rounded-full border-4 border-amber-300/40 blur-sm" />
              <div className="absolute inset-0 animate-ping rounded-full border-4 border-amber-200/60" />
            </div>
            <div className="text-3xl font-black uppercase tracking-[0.3em] text-amber-200 drop-shadow-[0_6px_18px_rgba(0,0,0,0.7)]">
              Winner
            </div>
            <div className="text-lg font-semibold text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]">
              {winnerOverlay.name}
            </div>
            {winnerOverlay.prizeText ? (
              <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-emerald-300 px-4 py-2 text-sm font-bold uppercase tracking-[0.22em] text-black shadow-[0_0_18px_rgba(16,185,129,0.65)]">
                <img src="/assets/icons/ezgif-54c96d8a9b9236.webp" alt="TPC prize" className="h-6 w-6" />
                <span>{winnerOverlay.prizeText}</span>
              </div>
            ) : null}
            {winnerOverlay.rewards?.length ? (
              <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-amber-200/50 bg-white/10 px-4 py-3 text-sm text-white shadow-[0_0_22px_rgba(0,0,0,0.45)] backdrop-blur">
                <div className="text-xs font-semibold uppercase tracking-[0.26em] text-amber-100">
                  New unlocks
                </div>
                <ul className="mt-2 space-y-1 text-sm">
                  {winnerOverlay.rewards.map((reward) => (
                    <li key={`${reward.type}-${reward.optionId}`} className="flex items-center gap-2">
                      <span className="text-amber-200">★</span>
                      <span className="font-semibold">
                        {reward.label || reward.optionId}
                        <span className="text-xs uppercase tracking-[0.16em] text-white/70">
                          {' '}
                          ({reward.type})
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      )}
      {dualTablesEnabled && tableSelectionOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-emerald-300/60 bg-slate-900/95 p-5 shadow-[0_18px_46px_rgba(0,0,0,0.55)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-emerald-200">
                  Choose your table
                </p>
                <p className="mt-1 text-sm text-slate-100">
                  Music Hall 02 lines both tables along the long side. Pick your spot to start;
                  the chooser hides after you decide.
                </p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.26em] text-emerald-200/80">
                  Current pick: {activeTableSlotLabel} table
                </p>
              </div>
              <button
                type="button"
                aria-label="Close table chooser"
                onClick={() => setTableSelectionOpen(false)}
                className="rounded-full border border-white/20 bg-white/10 px-2 py-1 text-xs font-semibold text-white hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
              >
                ✕
              </button>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTableSlot(0);
                  setTableSelectionOpen(false);
                }}
                className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold uppercase tracking-[0.22em] transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${
                  activeTableSlot === 0
                    ? 'border-emerald-300 bg-emerald-300 text-black shadow-[0_0_18px_rgba(16,185,129,0.55)]'
                    : 'border-white/20 bg-white/10 text-white/85 hover:bg-white/15'
                }`}
              >
                Play on near table
                <span className="ml-2" aria-hidden="true">⬆️</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTableSlot(1);
                  setTableSelectionOpen(false);
                }}
                className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold uppercase tracking-[0.22em] transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${
                  activeTableSlot === 1
                    ? 'border-emerald-300 bg-emerald-300 text-black shadow-[0_0_18px_rgba(16,185,129,0.55)]'
                    : 'border-white/20 bg-white/10 text-white/85 hover:bg-white/15'
                }`}
              >
                Play on far table
                <span className="ml-2" aria-hidden="true">⬇️</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {ENABLE_CUE_GALLERY && cueGalleryActive && (
        <div className="pointer-events-none absolute top-6 left-1/2 z-50 -translate-x-1/2 px-4 py-2 text-center text-xs font-semibold uppercase tracking-[0.28em] text-white/80">
          Scroll and click to change the cue
        </div>
      )}

      {replayActive && (
        <div className="pointer-events-none absolute inset-0 z-40">
          <div className="absolute inset-0 rounded-[28px] border border-white/12 shadow-[0_0_32px_rgba(0,0,0,0.55),0_0_0_8px_rgba(0,0,0,0.45)]" />
          <div className="absolute inset-0 rounded-[28px] bg-gradient-to-b from-black/55 via-transparent to-black/55" />
          <div className="absolute inset-x-10 top-6 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
          <div className="absolute inset-x-10 bottom-6 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
        </div>
      )}
      {replayActive && (
        <div className="pointer-events-none absolute top-4 right-4 z-50 flex justify-end">
          <div className="rounded-full border border-white/25 bg-black/70 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.34em] text-white shadow-[0_12px_32px_rgba(0,0,0,0.45)]">
            Replay
          </div>
        </div>
      )}

      <div
        className={`absolute top-4 left-4 z-50 flex flex-col items-start gap-2 transition-opacity duration-200 ${replayActive ? 'opacity-0' : 'opacity-100'}`}
      >
        <button
          ref={configButtonRef}
          type="button"
          onClick={() => setConfigOpen((prev) => !prev)}
          aria-expanded={configOpen}
          aria-controls="snooker-config-panel"
          className={`pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border border-emerald-400/60 bg-black/70 text-white shadow-[0_12px_32px_rgba(0,0,0,0.45)] backdrop-blur transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${
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
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m19.4 13.5-.44 1.74a1 1 0 0 1-1.07.75l-1.33-.14a7.03 7.03 0 0 1-1.01.59l-.2 1.32a1 1 0 0 1-.98.84h-1.9a1 1 0 0 1-.98-.84l-.2-1.32a7.03 7.03 0 0 1-1.01-.59l-1.33.14a1 1 0 0 1-1.07-.75L4.6 13.5a1 1 0 0 1 .24 -.96l1-.98a6.97 6.97 0 0 1 0-1.12l-1-.98a1 1 0 0 1-.24 -.96l.44-1.74a1 1 0 0 1 1.07-.75l1.33.14c.32-.23.66-.43 1.01-.6l.2-1.31a1 1 0 0 1 .98-.84h1.9a1 1 0 0 1 .98.84l.2 1.31c.35.17.69.37 1.01.6l1.33-.14a1 1 0 0 1 1.07.75l.44 1.74a1 1 0 0 1-.24.96l-1 .98c.03.37.03.75 0 1.12l1 .98a1 1 0 0 1 .24.96z"
            />
          </svg>
          <span className="sr-only">Toggle table setup</span>
        </button>
        {configOpen && (
          <div
            id="snooker-config-panel"
            ref={configPanelRef}
            className="pointer-events-auto mt-2 w-72 max-w-[80vw] rounded-2xl border border-emerald-400/40 bg-black/85 p-4 text-xs text-white shadow-[0_24px_48px_rgba(0,0,0,0.6)] backdrop-blur"
          >
            <div className="flex items-center justify-between gap-4">
              <span className="text-[10px] uppercase tracking-[0.45em] text-emerald-200/70">
                Table Setup
              </span>
              <button
                type="button"
                onClick={() => setConfigOpen(false)}
                className="rounded-full p-1 text-white/70 transition-colors duration-150 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                aria-label="Close setup"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-4 w-4"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <div className="mt-4 max-h-72 space-y-4 overflow-y-auto pr-1">
              <div>
                <h3 className="text-[10px] uppercase tracking-[0.35em] text-emerald-100/70">
                  Table Finish
                </h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {availableTableFinishes.map((option) => {
                    const active = option.id === tableFinishId;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setTableFinishId(option.id)}
                        aria-pressed={active}
                        className={`flex-1 min-w-[9rem] rounded-full px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${
                          active
                            ? 'bg-emerald-400 text-black shadow-[0_0_18px_rgba(16,185,129,0.65)]'
                            : 'bg-white/10 text-white/80 hover:bg-white/20'
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <h3 className="text-[10px] uppercase tracking-[0.35em] text-emerald-100/70">
                  Table Base
                </h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {availableTableBases.map((option) => {
                    const active = option.id === tableBaseId;
                    const swatchA = option.swatches?.[0] ?? '#0f172a';
                    const swatchB = option.swatches?.[1] ?? '#1f2937';
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setTableBaseId(option.id)}
                        aria-pressed={active}
                        className={`flex min-w-[9rem] flex-1 items-center justify-between gap-3 rounded-full px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${
                          active
                            ? 'bg-emerald-400 text-black shadow-[0_0_18px_rgba(16,185,129,0.65)]'
                            : 'bg-white/10 text-white/80 hover:bg-white/20'
                        }`}
                      >
                        <span className="truncate">{option.name}</span>
                        <span
                          className="h-5 w-8 rounded-lg border border-white/25"
                          aria-hidden="true"
                          style={{
                            background: `linear-gradient(135deg, ${swatchA}, ${swatchB})`
                          }}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <h3 className="text-[10px] uppercase tracking-[0.35em] text-emerald-100/70">
                  HDR Environment
                </h3>
                <div className="mt-2 grid grid-cols-1 gap-2">
                  {availableEnvironmentHdris.map((variant) => {
                    const active = variant.id === environmentHdriId;
                    const swatchA = variant.swatches?.[0] ?? '#0ea5e9';
                    const swatchB = variant.swatches?.[1] ?? '#111827';
                    return (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => setEnvironmentHdriId(variant.id)}
                        aria-pressed={active}
                        className={`flex items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.2em] transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${
                          active
                            ? 'border-emerald-300 bg-emerald-300 text-black shadow-[0_0_18px_rgba(16,185,129,0.55)]'
                            : 'border-white/20 bg-white/10 text-white/80 hover:bg-white/20'
                        }`}
                      >
                        <span>{variant.name}</span>
                        <span
                          className="h-6 w-10 rounded-lg border border-white/30"
                          aria-hidden="true"
                          style={{
                            background: `linear-gradient(135deg, ${swatchA}, ${swatchB})`
                          }}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <h3 className="text-[10px] uppercase tracking-[0.35em] text-emerald-100/70">
                  Chrome Plates
                </h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {availableChromeOptions.map((option) => {
                    const active = option.id === chromeColorId;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setChromeColorId(option.id)}
                        aria-pressed={active}
                        className={`flex-1 min-w-[8.5rem] rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${
                          active
                            ? 'border-emerald-300 bg-emerald-300 text-black shadow-[0_0_16px_rgba(16,185,129,0.55)]'
                            : 'border-white/20 bg-white/10 text-white/80 hover:bg-white/20'
                        }`}
                      >
                        <span className="flex items-center justify-center gap-2">
                          <span
                            className="h-3.5 w-3.5 rounded-full border border-white/40"
                            style={{ backgroundColor: toHexColor(option.color) }}
                            aria-hidden="true"
                          />
                          {option.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <h3 className="text-[10px] uppercase tracking-[0.35em] text-emerald-100/70">
                  Cue Styles
                </h3>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {availableCueStyles.map(({ preset, index }) => {
                    const active = cueStyleIndex === index;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => selectCueStyleFromMenu(index)}
                        aria-pressed={active}
                        className={`rounded-xl px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.2em] transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${
                          active
                            ? 'bg-emerald-400 text-black shadow-[0_0_18px_rgba(16,185,129,0.55)]'
                            : 'bg-white/10 text-white/80 hover:bg-white/20'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {availableClothOptions.length > 0 ? (
                <div>
                  <h3 className="text-[10px] uppercase tracking-[0.35em] text-emerald-100/70">
                    Cloth Color
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {availableClothOptions.map((option) => {
                      const active = option.id === clothColorId;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setClothColorId(option.id)}
                          aria-pressed={active}
                          className={`flex-1 min-w-[8.5rem] rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${
                            active
                              ? 'border-emerald-300 bg-emerald-300 text-black shadow-[0_0_16px_rgba(16,185,129,0.55)]'
                              : 'border-white/20 bg-white/10 text-white/80 hover:bg-white/20'
                          }`}
                        >
                          <span className="flex items-center justify-center gap-2">
                            <span
                              className="h-3.5 w-3.5 rounded-full border border-white/40"
                              style={{ backgroundColor: toHexColor(option.color) }}
                              aria-hidden="true"
                            />
                            {option.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              {availablePocketLiners.length > 0 ? (
                <div>
                  <h3 className="text-[10px] uppercase tracking-[0.35em] text-emerald-100/70">
                    Pocket Jaws
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {availablePocketLiners.map((option) => {
                      const active = option.id === pocketLinerId;
                      const swatchColor =
                        option.jawColor ?? option.rimColor ?? option.sheenColor ?? option.color;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setPocketLinerId(option.id)}
                          aria-pressed={active}
                          className={`flex-1 min-w-[9rem] rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${
                            active
                              ? 'border-emerald-300 bg-emerald-300 text-black shadow-[0_0_16px_rgba(16,185,129,0.55)]'
                              : 'border-white/20 bg-white/10 text-white/80 hover:bg-white/20'
                          }`}
                        >
                          <span className="flex items-center justify-center gap-2">
                            <span
                              className="h-3.5 w-3.5 rounded-full border border-white/40"
                              style={{ backgroundColor: toHexColor(swatchColor) }}
                              aria-hidden="true"
                            />
                            {option.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              <div>
                <h3 className="text-[10px] uppercase tracking-[0.35em] text-emerald-100/70">
                  Rail Markers
                </h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {RAIL_MARKER_SHAPE_OPTIONS.map((option) => {
                    const active = option.id === railMarkerShapeId;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setRailMarkerShapeId(option.id)}
                        aria-pressed={active}
                        className={`flex-1 min-w-[7rem] rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${
                          active
                            ? 'border-emerald-300 bg-emerald-300 text-black shadow-[0_0_16px_rgba(16,185,129,0.55)]'
                            : 'border-white/20 bg-white/10 text-white/80 hover:bg-white/20'
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {availableRailMarkerColors.map((option) => {
                    const active = option.id === railMarkerColorId;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setRailMarkerColorId(option.id)}
                        aria-pressed={active}
                        className={`flex-1 min-w-[8.5rem] rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${
                          active
                            ? 'border-emerald-300 bg-emerald-300 text-black shadow-[0_0_16px_rgba(16,185,129,0.55)]'
                            : 'border-white/20 bg-white/10 text-white/80 hover:bg-white/20'
                        }`}
                      >
                        <span className="flex items-center justify-center gap-2">
                          <span
                            className="h-3.5 w-3.5 rounded-full border border-white/40"
                            style={{ backgroundColor: toHexColor(option.color) }}
                            aria-hidden="true"
                          />
                          {option.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <h3 className="text-[10px] uppercase tracking-[0.35em] text-emerald-100/70">
                  Graphics
                </h3>
                <p className="mt-1 text-[0.7rem] text-white/70">
                  Match the Murlan Royale quality presets for identical FPS and clarity choices.
                </p>
                <div className="mt-3">
                  <h4 className="text-[10px] uppercase tracking-[0.32em] text-emerald-100/70">
                    HDRI Resolution
                  </h4>
                  <p className="mt-1 text-[0.7rem] text-white/60">
                    Active: {resolvedHdriResolution?.toUpperCase() || activeHdriResolutionOption.label}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {HDRI_RESOLUTION_OPTIONS.map((option) => {
                      const active = option.id === hdriResolutionId;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setHdriResolutionId(option.id)}
                          aria-pressed={active}
                          className={`flex-1 min-w-[7.5rem] rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${
                            active
                              ? 'border-emerald-300 bg-emerald-300 text-black shadow-[0_0_16px_rgba(16,185,129,0.55)]'
                              : 'border-white/20 bg-white/10 text-white/80 hover:bg-white/20'
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-2 grid gap-2">
                  {FRAME_RATE_OPTIONS.map((option) => {
                    const active = option.id === frameRateId;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setFrameRateId(option.id)}
                        aria-pressed={active}
                        className={`w-full rounded-2xl border px-4 py-2 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${
                          active
                            ? 'border-emerald-300 bg-emerald-300/90 text-black shadow-[0_0_16px_rgba(16,185,129,0.55)]'
                            : 'border-white/20 bg-white/10 text-white/80 hover:bg-white/20'
                        }`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.28em]">
                            {option.label}
                          </span>
                          <span className="text-xs font-semibold tracking-wide">
                            {option.resolution
                              ? `${option.resolution} • ${option.fps} FPS`
                              : `${option.fps} FPS`}
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
              <div>
                <h3 className="text-[10px] uppercase tracking-[0.35em] text-emerald-100/70">
                  Broadcast Modes
                </h3>
                <div className="mt-2 grid gap-2">
                  {BROADCAST_SYSTEM_OPTIONS.map((option) => {
                    const active = option.id === broadcastSystemId;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setBroadcastSystemId(option.id)}
                        aria-pressed={active}
                        className={`w-full rounded-2xl border px-4 py-2 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${
                          active
                            ? 'border-emerald-300 bg-emerald-300/90 text-black shadow-[0_0_16px_rgba(16,185,129,0.55)]'
                            : 'border-white/20 bg-white/10 text-white/80 hover:bg-white/20'
                        }`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.28em]">
                            {option.label}
                          </span>
                          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100/80">
                            {option.method}
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
            </div>
          </div>
        )}
      </div>

      {isTraining && !replayActive && (
        <div className="absolute right-3 top-3 z-50 flex flex-col items-end gap-2">
          <div className="pointer-events-auto w-64 rounded-2xl border border-emerald-400/50 bg-black/80 p-4 text-sm text-white shadow-[0_24px_48px_rgba(0,0,0,0.6)] backdrop-blur">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-emerald-200">Training level</p>
                <p className="text-lg font-semibold leading-tight">Level {currentTrainingInfo.level}</p>
                <p className="text-xs text-white/70">{currentTrainingInfo.title}</p>
              </div>
              <div className="text-right text-[11px] uppercase tracking-[0.2em] text-white/70">
                <div className="text-emerald-200">{completedTrainingCount} completed</div>
                <div>Next L{nextTrainingInfo.level}</div>
              </div>
            </div>
            <p className="mt-2 text-xs text-white/80">Objective: {currentTrainingInfo.objective}</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-emerald-200">
              Reward: {currentTrainingInfo.reward}
            </p>
            <p className="mt-1 text-[11px] text-white/60">Next up: {nextTrainingInfo.objective}</p>
          </div>
          <button
            type="button"
            onClick={() => setTrainingMenuOpen((open) => !open)}
            aria-expanded={trainingMenuOpen}
            aria-label="Toggle training menu"
            className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-emerald-400/60 bg-black/70 text-white shadow-[0_12px_32px_rgba(0,0,0,0.45)] backdrop-blur transition hover:bg-black/60"
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
            {trainingMenuOpen && (
            <div className="pointer-events-auto w-64 rounded-2xl border border-emerald-400/50 bg-black/85 p-4 text-sm text-white shadow-[0_24px_48px_rgba(0,0,0,0.6)] backdrop-blur">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] uppercase tracking-[0.3em] text-emerald-200">Training menu</span>
                <button
                  type="button"
                  onClick={() => setTrainingMenuOpen(false)}
                  className="rounded-full p-1 text-white/70 transition hover:text-white"
                  aria-label="Close training menu"
                >
                  ×
                </button>
              </div>
              <div className="mt-3 space-y-3">
                <div className="rounded-xl border border-emerald-400/40 bg-white/5 p-3">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-emerald-200">Progress</p>
                  <p className="text-sm font-semibold text-white">Level {currentTrainingInfo.level}: {currentTrainingInfo.title}</p>
                  <p className="mt-1 text-xs text-white/80">Objective: {currentTrainingInfo.objective}</p>
                  <p className="mt-1 text-[11px] text-white/60">Completed: {completedTrainingCount || 'None yet'}</p>
                  <p className="mt-1 text-[11px] text-emerald-200">
                    Next: Level {nextTrainingInfo.level} — {nextTrainingInfo.objective}
                  </p>
                  <p className="mt-1 text-[11px] text-white/60">Reward: {currentTrainingInfo.reward}</p>
                </div>
                <div>
                  <p className="font-semibold">Opponent</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[{ id: 'solo', label: 'Solo practice' }, { id: 'ai', label: 'Vs AI' }].map(({ id, label }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setTrainingModeState(id)}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                          trainingModeState === id
                            ? 'border-emerald-300 bg-emerald-400/20 text-emerald-100'
                            : 'border-white/30 bg-white/10 text-white/80 hover:bg-white/20'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="font-semibold">Rules</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[{ id: true, label: 'With rules' }, { id: false, label: 'No rules' }].map(({ id, label }) => (
                      <button
                        key={String(id)}
                        type="button"
                        onClick={() => setTrainingRulesOn(Boolean(id))}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                          trainingRulesOn === Boolean(id)
                            ? 'border-emerald-300 bg-emerald-400/20 text-emerald-100'
                            : 'border-white/30 bg-white/10 text-white/80 hover:bg-white/20'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-white/70">Practice with every ball on the table and switch options anytime.</p>
              </div>
            </div>
          )}
        </div>
      )}

      <div
        ref={leftControlsRef}
        className={`pointer-events-none absolute left-4 z-50 flex flex-col gap-2 ${replayActive ? 'opacity-0' : 'opacity-100'} transition-opacity duration-200`}
        style={{
          bottom: `${16 + chromeUiLiftPx}px`,
          transform: `scale(${uiScale})`,
          transformOrigin: 'bottom left'
        }}
      >
        <button
          type="button"
          aria-pressed={isLookMode}
          onClick={() => setIsLookMode((prev) => !prev)}
          className={`pointer-events-auto flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold shadow-[0_12px_32px_rgba(0,0,0,0.45)] backdrop-blur transition ${
            isLookMode
              ? 'border-emerald-300 bg-emerald-300/20 text-emerald-100'
              : 'border-white/30 bg-black/70 text-white hover:bg-black/60'
          }`}
        >
          <span className="text-base">👁️</span>
          <span>Look</span>
        </button>
        <button
          type="button"
          aria-pressed={isTopDownView}
          onClick={() => setIsTopDownView((prev) => !prev)}
          className={`pointer-events-auto flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold shadow-[0_12px_32px_rgba(0,0,0,0.45)] backdrop-blur transition ${
            isTopDownView
              ? 'border-emerald-300 bg-emerald-300/20 text-emerald-100'
              : 'border-white/30 bg-black/70 text-white hover:bg-black/60'
          }`}
        >
          <span className="text-base">🧭</span>
          <span>{isTopDownView ? '3D' : '2D'}</span>
        </button>
      </div>

      {bottomHudVisible && (
        <div
          className={`absolute flex ${bottomHudLayoutClass} pointer-events-none z-50 transition-opacity duration-200 ${pocketCameraActive || replayActive ? 'opacity-0' : 'opacity-100'}`}
          aria-hidden={pocketCameraActive || replayActive}
          style={{
            bottom: `${16 + chromeUiLiftPx}px`,
            left: hudInsets.left,
            right: hudInsets.right,
            transform: isPortrait ? `translateX(${bottomHudOffset}px)` : undefined
          }}
        >
          <div
            className={`pointer-events-auto flex min-h-[3rem] max-w-full items-center justify-center ${hudGapClass} rounded-full border border-emerald-400/40 bg-black/70 ${isPortrait ? 'px-5 py-2' : 'px-6 py-2.5'} text-white shadow-[0_12px_32px_rgba(0,0,0,0.45)] backdrop-blur`}
            style={{
              transform: `scale(${bottomHudScale})`,
              transformOrigin: 'bottom center',
              maxWidth: isPortrait ? 'min(28rem, 100%)' : 'min(34rem, 100%)'
            }}
          >
            <div
              className={playerPanelClass}
              style={playerPanelStyle}
            >
              {isOnlineMatch ? (
                <img
                  src={player.avatar || '/assets/icons/profile.svg'}
                  alt="player avatar"
                  className={`${avatarSizeClass} rounded-full border-2 object-cover transition-all duration-150 ${
                    isPlayerTurn
                      ? 'border-emerald-200 shadow-[0_0_16px_rgba(16,185,129,0.55)]'
                      : 'border-white/50 shadow-[0_4px_10px_rgba(0,0,0,0.45)]'
                  }`}
                />
              ) : (
                <img
                  src={resolvedPlayerAvatar || '/assets/icons/profile.svg'}
                  alt="player avatar"
                  className={`${avatarSizeClass} rounded-full border-2 object-cover transition-all duration-150 ${
                    isPlayerTurn
                      ? 'border-emerald-200 shadow-[0_0_16px_rgba(16,185,129,0.55)]'
                      : 'border-white/50 shadow-[0_4px_10px_rgba(0,0,0,0.45)]'
                  }`}
                />
              )}
              <div className="flex min-w-0 flex-col">
                <span className={`${nameWidthClass} truncate ${nameTextClass} font-semibold tracking-wide`}>
                  {player.name}
                </span>
                <div className="mt-1">{renderPottedRow(playerPotted)}</div>
              </div>
            </div>
            <div
              className={`flex items-center gap-2 ${isPortrait ? 'text-sm' : 'text-base'} font-semibold`}
            >
              <span className="text-amber-300">{hud.A}</span>
              <span className="text-white/50">-</span>
              <span>{hud.B}</span>
            </div>
            <div
              className={`${opponentPanelClass} ${isPortrait ? 'text-xs' : 'text-sm'}`}
              style={opponentPanelStyle}
            >
              {isOnlineMatch ? (
                <>
                  <img
                    src={opponentDisplayAvatar}
                    alt="opponent avatar"
                    className={`${avatarSizeClass} rounded-full border-2 object-cover transition-all duration-150 ${
                      isOpponentTurn
                        ? 'border-emerald-200 shadow-[0_0_16px_rgba(16,185,129,0.55)]'
                        : 'border-white/50 shadow-[0_4px_10px_rgba(0,0,0,0.45)]'
                    }`}
                  />
                  <div className="flex min-w-0 flex-col">
                    <span className={`${nameWidthClass} truncate ${nameTextClass} font-semibold tracking-wide`}>
                      {opponentDisplayName}
                    </span>
                    <div className="mt-1">{renderPottedRow(opponentPotted)}</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <img
                      src={opponentDisplayAvatar || '/assets/icons/profile.svg'}
                      alt="opponent avatar"
                      className={`${avatarSizeClass} rounded-full border-2 object-cover transition-all duration-150 ${
                        isOpponentTurn
                          ? 'border-emerald-200 shadow-[0_0_16px_rgba(16,185,129,0.55)]'
                          : 'border-white/50 shadow-[0_4px_10px_rgba(0,0,0,0.45)]'
                      }`}
                    />
                    <div className="flex min-w-0 flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.32em]">
                          {aiFlagLabel}
                        </span>
                      </div>
                      <div className="mt-1">{renderPottedRow(opponentPotted)}</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {err && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-50 -translate-x-1/2 px-4">
          <div className="pointer-events-auto flex max-w-xl items-center gap-2 rounded-2xl border border-red-400/50 bg-red-900/85 px-4 py-3 text-xs font-semibold text-white shadow-[0_16px_34px_rgba(0,0,0,0.5)] backdrop-blur">
            <span className="text-red-200">Init issue:</span>
            <span className="text-white/90">{String(err)}</span>
          </div>
        </div>
      )}
      {hud?.inHand && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-40 flex -translate-x-1/2 flex-col items-center gap-2 px-3 text-center text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.55)]">
          <div className="flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-gray-900 shadow-lg ring-1 ring-white/60">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">BIH</span>
            <span className="text-left leading-tight">
              Drag the cue ball {['american', '9ball'].includes(variantKey) ? 'anywhere on the table' : 'inside the baulk semicircle'}
            </span>
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/85">
            Tap and hold, then slide to place
          </span>
        </div>
      )}
      {/* Power Slider */}
      {showPowerSlider && !replayActive && (
        <div
          className="absolute right-3 top-[56%] -translate-y-1/2"
          data-ai-taking-shot={aiTakingShot ? 'true' : 'false'}
          data-player-turn={isPlayerTurn ? 'true' : 'false'}
        >
          <div
            ref={sliderRef}
            style={{
              transform: `scale(${uiScale})`,
              transformOrigin: 'top right'
            }}
          />
        </div>
      )}

      {/* Spin controller */}
      {showSpinController && !replayActive && (
        <div
          ref={spinBoxRef}
          className={`absolute right-4 ${showPlayerControls ? '' : 'pointer-events-none'}`}
          style={{
            bottom: `${16 + chromeUiLiftPx}px`,
            transform: `scale(${uiScale})`,
            transformOrigin: 'bottom right'
          }}
        >
          <div
            id="spinBox"
            className={`relative rounded-full shadow-lg border border-white/70 overflow-hidden ${showPlayerControls ? 'pointer-events-auto' : 'pointer-events-none opacity-80'}`}
            style={{
              width: `${SPIN_CONTROL_DIAMETER_PX}px`,
              height: `${SPIN_CONTROL_DIAMETER_PX}px`,
              background: '#f9fafb'
            }}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                background: `radial-gradient(circle, transparent ${SWERVE_THRESHOLD * 100}%, rgba(250, 204, 21, 0.28) ${
                  SWERVE_THRESHOLD * 100
                }%, rgba(250, 204, 21, 0.32) 100%)`
              }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute rounded-full"
              style={{
                border: '2px solid #facc15',
                width: `${SWERVE_THRESHOLD * 100}%`,
                height: `${SWERVE_THRESHOLD * 100}%`,
                left: `${(1 - SWERVE_THRESHOLD) * 50}%`,
                top: `${(1 - SWERVE_THRESHOLD) * 50}%`,
                boxShadow: '0 0 0 6px rgba(250, 204, 21, 0.2)'
              }}
            />
            <div
              aria-hidden="true"
              className="absolute rounded-full border-2 border-red-500 pointer-events-none"
              style={{
                width: `${SPIN_RING_RATIO * 100}%`,
                height: `${SPIN_RING_RATIO * 100}%`,
                left: `${(1 - SPIN_RING_RATIO) * 50}%`,
                top: `${(1 - SPIN_RING_RATIO) * 50}%`
              }}
            />
            <div
              id="spinDot"
              className="absolute rounded-full bg-red-600 -translate-x-1/2 -translate-y-1/2"
              style={{
                width: `${SPIN_DOT_DIAMETER_PX}px`,
                height: `${SPIN_DOT_DIAMETER_PX}px`,
                left: '50%',
                top: '50%'
              }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PoolRoyale() {
  const navigate = useNavigate();
  const location = useLocation();
  const variantKey = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const requested = params.get('variant');
    return resolvePoolVariant(requested).id;
  }, [location.search]);
  const ballSetKey = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const requested = params.get('ballSet');
    const normalized = normalizeBallSetKey(requested);
    return normalized || null;
  }, [location.search]);
  const tableSizeKey = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const requested = params.get('tableSize');
    return resolveTableSize(requested).id;
  }, [location.search]);
  const playType = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const requested = params.get('type');
    if (requested === 'training') return 'training';
    if (requested === 'tournament') return 'tournament';
    return 'regular';
  }, [location.search]);
  const mode = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const requested = params.get('mode');
    if (requested === 'online') return 'online';
    if (requested === 'local') return 'local';
    return 'ai';
  }, [location.search]);
  const trainingMode = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const requested = params.get('mode');
    return requested === 'solo' ? 'solo' : 'ai';
  }, [location.search]);
  const trainingRulesEnabled = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('rules') !== 'off';
  }, [location.search]);
  const accountId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('accountId') || '';
  }, [location.search]);
  const tgId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('tgId') || '';
  }, [location.search]);
  const playerName = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return (
      params.get('name') ||
      getTelegramUsername() ||
      getTelegramId() ||
      'Player'
    );
  }, [location.search]);
  const playerAvatar = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('avatar') || '';
  }, [location.search]);
  const stakeAmount = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return Number(params.get('amount')) || 0;
  }, [location.search]);
  const stakeToken = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('token') || 'TPC';
  }, [location.search]);
  const exitMessage = useMemo(
    () =>
      stakeAmount > 0
        ? `Are you sure you want to exit? Your ${stakeAmount} ${stakeToken} stake will be lost.`
        : 'Are you sure you want to exit the match?',
    [stakeAmount, stakeToken]
  );
  const confirmExit = useCallback(() => {
    return new Promise((resolve) => {
      const tg = window?.Telegram?.WebApp;
      if (tg?.showPopup) {
        tg.showPopup(
          {
            title: 'Exit game?',
            message: exitMessage,
            buttons: [
              { id: 'yes', type: 'destructive', text: 'Yes' },
              { id: 'no', type: 'default', text: 'No' }
            ]
          },
          (buttonId) => resolve(buttonId === 'yes')
        );
        return;
      }

      resolve(window.confirm(exitMessage));
    });
  }, [exitMessage]);
  useTelegramBackButton(() => {
    confirmExit().then((confirmed) => {
      if (confirmed) {
        navigate('/games/poolroyale/lobby');
      }
    });
  });
  useEffect(() => {
    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = exitMessage;
      return exitMessage;
    };
    const handlePopState = () => {
      confirmExit().then((confirmed) => {
        if (!confirmed) {
          window.history.pushState(null, '', window.location.href);
        } else {
          navigate('/games/poolroyale/lobby');
        }
      });
    };
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [confirmExit, exitMessage, navigate]);
  const opponentName = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('opponent') || '';
  }, [location.search]);
  const opponentAvatar = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('opponentAvatar') || '';
  }, [location.search]);
  return (
    <PoolRoyaleGame
      variantKey={variantKey}
      ballSetKey={ballSetKey}
      tableSizeKey={tableSizeKey}
      playType={playType}
      mode={mode}
      trainingMode={trainingMode}
      trainingRulesEnabled={trainingRulesEnabled}
      accountId={accountId}
      tgId={tgId}
      playerName={playerName}
      playerAvatar={playerAvatar}
      opponentName={opponentName}
      opponentAvatar={opponentAvatar}
    />
  );
}
