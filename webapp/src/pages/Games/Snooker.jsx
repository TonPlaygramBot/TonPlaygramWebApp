import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import * as THREE from 'three';
import polygonClipping from 'polygon-clipping';
// Snooker uses its own slimmer power slider
import { SnookerPowerSlider } from '../../../../snooker-power-slider.js';
import '../../../../snooker-power-slider.css';
import {
  getTelegramUsername,
  getTelegramPhotoUrl
} from '../../utils/telegram.js';
import { FLAG_EMOJIS } from '../../utils/flagEmojis.js';
import { UnitySnookerRules } from '../../../../src/rules/UnitySnookerRules.ts';
import { useAimCalibration } from '../../hooks/useAimCalibration.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import { isGameMuted, getGameVolume } from '../../utils/sound.js';
import { getBallMaterial as getBilliardBallMaterial } from '../../utils/ballMaterialFactory.js';
import { createCueRackDisplay } from '../../utils/createCueRackDisplay.js';
import { CUE_RACK_PALETTE, CUE_STYLE_PRESETS } from '../../config/cueStyles.js';
import {
  WOOD_FINISH_PRESETS,
  WOOD_GRAIN_OPTIONS,
  WOOD_GRAIN_OPTIONS_BY_ID,
  DEFAULT_WOOD_GRAIN_ID,
  DEFAULT_WOOD_TEXTURE_SIZE,
  applyWoodTextures
} from '../../utils/woodMaterials.js';
import { applyRendererSRGB, applySRGBColorSpace } from '../../utils/colorSpace.js';

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

function scaleMultiPolygonBy(mp, scale) {
  if (!Array.isArray(mp)) {
    return [];
  }
  if (!Number.isFinite(scale) || Math.abs(scale - 1) < 1e-6) {
    return mp;
  }
  return scaleMultiPolygon(mp, scale);
}

function translatePocketCutMP(mp, sx, sz, offset) {
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

function createDefaultPocketJawMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: 0x101215,
    metalness: 0.08,
    roughness: 0.62,
    clearcoat: 0.22,
    clearcoatRoughness: 0.46,
    sheen: 0.58,
    sheenColor: new THREE.Color(0x1d1f25),
    sheenRoughness: 0.5,
    envMapIntensity: 0.34
  });
}

const POCKET_VISUAL_EXPANSION = 1.018;
const CHROME_CORNER_POCKET_RADIUS_SCALE = 1.01;
const CHROME_CORNER_NOTCH_CENTER_SCALE = 1.08; // pull corner reliefs further into the rail
const CHROME_CORNER_EXPANSION_SCALE = 1.002;
const CHROME_CORNER_SIDE_EXPANSION_SCALE = 1.002;
const CHROME_CORNER_FIELD_TRIM_SCALE = -0.03;
const CHROME_CORNER_NOTCH_WEDGE_SCALE = 0;
const CHROME_CORNER_FIELD_CLIP_WIDTH_SCALE = 0.034; // align chrome fascia trim with Pool Royale geometry
const CHROME_CORNER_FIELD_CLIP_DEPTH_SCALE = 0.034;
const CHROME_CORNER_NOTCH_EXPANSION_SCALE = 1;
const CHROME_CORNER_WIDTH_SCALE = 0.982;
const CHROME_CORNER_HEIGHT_SCALE = 0.962;
const CHROME_CORNER_FIELD_FILLET_SCALE = 0;
const CHROME_CORNER_FIELD_EXTENSION_SCALE = 0;
const CHROME_CORNER_DIMENSION_SCALE = 1; // keep fascia proportions aligned with Pool Royale plates
const CHROME_CORNER_CENTER_OUTSET_SCALE = -0.02;
const CHROME_CORNER_SHORT_RAIL_SHIFT_SCALE = 0;
const CHROME_CORNER_SHORT_RAIL_CENTER_PULL_SCALE = 0;
const CHROME_CORNER_EDGE_TRIM_SCALE = 0;
const CHROME_OUTER_FLUSH_TRIM_SCALE = 0;
const CHROME_SIDE_POCKET_RADIUS_SCALE = 1.01; // tighten the middle pocket arches and pull their curve inward
const CHROME_SIDE_NOTCH_THROAT_SCALE = 0;
const CHROME_SIDE_NOTCH_HEIGHT_SCALE = 0.85;
const CHROME_SIDE_NOTCH_DEPTH_SCALE = 1;
const CHROME_SIDE_NOTCH_RADIUS_SCALE = 1;
const CHROME_SIDE_FIELD_PULL_SCALE = 0;
const CHROME_PLATE_THICKNESS_SCALE = 0.034;
const CHROME_SIDE_PLATE_THICKNESS_BOOST = 1.24;
const CHROME_PLATE_RENDER_ORDER = 3.5;
const CHROME_SIDE_PLATE_POCKET_SPAN_SCALE = 1.58;
const CHROME_SIDE_PLATE_HEIGHT_SCALE = 1.52;
const CHROME_SIDE_PLATE_CENTER_TRIM_SCALE = 0;
const CHROME_SIDE_PLATE_WIDTH_EXPANSION_SCALE = 0.56;
const CHROME_SIDE_PLATE_CORNER_LIMIT_SCALE = 0.04;
const CHROME_SIDE_PLATE_THREE_SIDE_EXPANSION = 0.34;
const CHROME_SIDE_POCKET_CUT_CENTER_PULL_SCALE = 0.052; // pull the chrome arches closer to centre so the middle pocket jaws tuck in
const WOOD_CORNER_CUT_SCALE = 0.976; // pull wood reliefs inward so the rounded cuts tuck toward centre
const WOOD_SIDE_CUT_SCALE = 0.986; // slightly shrink side rail apertures so the rounded cuts sit tighter to centre
const WOOD_SIDE_POCKET_CUT_CENTER_OUTSET_SCALE = 0.107; // pull the middle pocket wood cuts further inward toward centre
const POCKET_JAW_CORNER_OUTER_LIMIT_SCALE = 1.004;
const POCKET_JAW_SIDE_OUTER_LIMIT_SCALE = POCKET_JAW_CORNER_OUTER_LIMIT_SCALE;
const POCKET_JAW_CORNER_INNER_SCALE = 1.472;
const POCKET_JAW_SIDE_INNER_SCALE = POCKET_JAW_CORNER_INNER_SCALE;
const POCKET_JAW_CORNER_OUTER_SCALE = 1.76;
const POCKET_JAW_SIDE_OUTER_SCALE = POCKET_JAW_CORNER_OUTER_SCALE;
const POCKET_JAW_DEPTH_SCALE = 0.52;
const POCKET_JAW_EDGE_FLUSH_START = 0.22;
const POCKET_JAW_EDGE_FLUSH_END = 1;
const POCKET_JAW_EDGE_TAPER_SCALE = 0.16;
const POCKET_JAW_CENTER_THICKNESS_MIN = 0.42;
const POCKET_JAW_CENTER_THICKNESS_MAX = 0.66;
const POCKET_JAW_OUTER_EXPONENT_MIN = 0.58;
const POCKET_JAW_OUTER_EXPONENT_MAX = 1.2;
const POCKET_JAW_INNER_EXPONENT_MIN = 0.78;
const POCKET_JAW_INNER_EXPONENT_MAX = 1.34;
const POCKET_JAW_SEGMENT_MIN = 144;
const SIDE_POCKET_JAW_LATERAL_EXPANSION = 1.66;
const SIDE_POCKET_JAW_RADIUS_EXPANSION = 0.986;
const SIDE_POCKET_JAW_DEPTH_EXPANSION = 0.9;
const SIDE_POCKET_JAW_SIDE_TRIM_SCALE = 0.82;
const SIDE_POCKET_JAW_MIDDLE_TRIM_SCALE = 0.86;
const CORNER_POCKET_JAW_LATERAL_EXPANSION = 1.592;
const CORNER_JAW_ARC_DEG = 120;
const SIDE_JAW_ARC_DEG = 120;

function buildChromePlateGeometry({
  width,
  height,
  radius,
  thickness,
  corner = 'topLeft',
  notchMP = null,
  shapeSegments = 96
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
      Math.min(r * 0.5, Math.min(width, height) * 0.06)
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
        const clipped = polygonClipping.difference(baseMP, notchMP);
        const clippedShapes = multiPolygonToShapes(clipped);
        if (clippedShapes.length) {
          shapesToExtrude = clippedShapes;
        }
      }
    }
  }

  let geo = new THREE.ExtrudeGeometry(shapesToExtrude, {
    depth: thickness,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize,
    bevelThickness,
    curveSegments: 64
  });
  geo = softenOuterExtrudeEdges(geo, thickness, 0.55);
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}
function addPocketCuts(parent, clothPlane) {
  // Pocket cut overlay meshes have been intentionally disabled for Snooker.
  // Gameplay geometry that defines the pocket cuts remains unchanged.
  return [];
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
// Match the Pool Royale arena footprint so pockets, rails, and ball sizing align 1:1
const TABLE_SIZE_SHRINK = 0.78;
const TABLE_REDUCTION = 0.84 * TABLE_SIZE_SHRINK;
const OFFICIAL_TABLE_SCALE = 3569 / 2540; // scale up to the official snooker dimensions while keeping ball/pocket sizing intact
const SIZE_REDUCTION = 0.7;
const GLOBAL_SIZE_FACTOR = 0.85 * SIZE_REDUCTION;
const TABLE_DISPLAY_SCALE = 0.88;
const WORLD_SCALE = 0.85 * GLOBAL_SIZE_FACTOR * 0.7 * TABLE_DISPLAY_SCALE;
const TABLE_GROWTH_MULTIPLIER = 1.5;
const TABLE_GROWTH_DURATION_MS = 1200;
const CUE_STYLE_STORAGE_KEY = 'tonplayCueStyleIndex';
const TABLE_BASE_SCALE = 1.17;
const TABLE_SCALE = TABLE_BASE_SCALE * TABLE_REDUCTION * OFFICIAL_TABLE_SCALE;
const TABLE = {
  W: 66 * TABLE_SCALE,
  H: 132 * TABLE_SCALE,
  THICK: 1.8 * TABLE_SCALE,
  WALL: 2.6 * TABLE_SCALE
};
const RAIL_HEIGHT = TABLE.THICK * 1.96; // match Pool Royale rail stack height
const FRAME_TOP_Y = -TABLE.THICK + 0.01;
const TABLE_RAIL_TOP_Y = FRAME_TOP_Y + RAIL_HEIGHT;
// reuse Pool Royale rail inset so cushion noses share the same spacing
const WIDTH_REF = 3569;
const HEIGHT_REF = 1778;
const BALL_D_REF = 57.15;
const BALL_SIZE_SCALE = 0.94248;
const BAULK_FROM_BAULK_REF = 558.8;
const D_RADIUS_REF = 292;
const BLACK_FROM_TOP_REF = 558.8;
const CORNER_MOUTH_REF = 114.3;
const SIDE_MOUTH_REF = 127;
const CORNER_POCKET_SCALE_BOOST = 0.994;
const SIDE_POCKET_MOUTH_REDUCTION_SCALE = 0.996;
const SIDE_RAIL_INNER_REDUCTION = 0.72;
const SIDE_RAIL_INNER_SCALE = 1 - SIDE_RAIL_INNER_REDUCTION;
const SIDE_RAIL_INNER_THICKNESS = TABLE.WALL * SIDE_RAIL_INNER_SCALE;
const TARGET_RATIO = WIDTH_REF / HEIGHT_REF;
const END_RAIL_INNER_SCALE =
  (TABLE.H - TARGET_RATIO * (TABLE.W - 2 * SIDE_RAIL_INNER_THICKNESS)) /
  (2 * TABLE.WALL);
const END_RAIL_INNER_REDUCTION = 1 - END_RAIL_INNER_SCALE;
const END_RAIL_INNER_THICKNESS = TABLE.WALL * END_RAIL_INNER_SCALE;
const ORIGINAL_PLAY_W = TABLE.W - 2 * TABLE.WALL;
const ORIGINAL_HALF_W = ORIGINAL_PLAY_W / 2;
const PLAY_W = TABLE.W - 2 * SIDE_RAIL_INNER_THICKNESS;
const PLAY_H = TABLE.H - 2 * END_RAIL_INNER_THICKNESS;
const innerLong = Math.max(PLAY_W, PLAY_H);
const innerShort = Math.min(PLAY_W, PLAY_H);
const CURRENT_RATIO = innerLong / Math.max(1e-6, innerShort);
console.assert(
  Math.abs(CURRENT_RATIO - TARGET_RATIO) < 1e-4,
  'Snooker table inner ratio must match the official 3569:1778 footprint.'
);
const MM_TO_UNITS = innerLong / WIDTH_REF;
const BALL_DIAMETER = BALL_D_REF * MM_TO_UNITS * BALL_SIZE_SCALE;
const BALL_SCALE = BALL_DIAMETER / 4;
const BALL_R = BALL_DIAMETER / 2;
const CHALK_TOP_COLOR = 0x1f6d86;
const CHALK_SIDE_COLOR = 0x162b36;
const CHALK_SIDE_ACTIVE_COLOR = 0x1f4b5d;
const CHALK_BOTTOM_COLOR = 0x0b1118;
const CHALK_ACTIVE_COLOR = 0x4bd4ff;
const CHALK_EMISSIVE_COLOR = 0x071b26;
const CHALK_ACTIVE_EMISSIVE_COLOR = 0x0d3b5d;
const CHALK_PRECISION_SLOW_MULTIPLIER = 0.25;
const CHALK_AIM_LERP_SLOW = 0.08;
const CHALK_TARGET_RING_RADIUS = BALL_R * 2;
const CHALK_RING_OPACITY = 0.18;
const BAULK_FROM_BAULK = BAULK_FROM_BAULK_REF * MM_TO_UNITS;
const D_RADIUS = D_RADIUS_REF * MM_TO_UNITS;
const BLACK_FROM_TOP = BLACK_FROM_TOP_REF * MM_TO_UNITS;
const POCKET_CORNER_MOUTH_SCALE = CORNER_POCKET_SCALE_BOOST;
const POCKET_SIDE_MOUTH_SCALE =
  (CORNER_MOUTH_REF / SIDE_MOUTH_REF) *
  POCKET_CORNER_MOUTH_SCALE *
  SIDE_POCKET_MOUTH_REDUCTION_SCALE;
const POCKET_CORNER_MOUTH =
  CORNER_MOUTH_REF * MM_TO_UNITS * POCKET_CORNER_MOUTH_SCALE;
const POCKET_SIDE_MOUTH =
  SIDE_MOUTH_REF * MM_TO_UNITS * POCKET_SIDE_MOUTH_SCALE;
const POCKET_VIS_R = POCKET_CORNER_MOUTH / 2;
const POCKET_R = POCKET_VIS_R * 0.985;
const POCKET_INTERIOR_TOP_SCALE = 0.92;
const CORNER_POCKET_CENTER_INSET =
  POCKET_VIS_R * 0.3 * POCKET_VISUAL_EXPANSION; // match Pool Royale corner pocket offset so the cuts sit farther toward each pocket mouth
const CORNER_RAIL_CUT_INSET =
  POCKET_VIS_R * 0.52 * POCKET_VISUAL_EXPANSION; // preserve the existing chrome/wood cut positioning for jaws and fascia
const MIDDLE_POCKET_LONGITUDINAL_OFFSET = POCKET_VIS_R * 0.082; // push middle pockets and rail cuts farther from the table centre
const SIDE_POCKET_RADIUS = POCKET_SIDE_MOUTH / 2;
const MIDDLE_POCKET_LATERAL_INSET =
  SIDE_POCKET_RADIUS * 0.92 * POCKET_VISUAL_EXPANSION; // pull middle pockets further off the rails toward centre
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
const POCKET_CUT_EXPANSION = POCKET_INTERIOR_TOP_SCALE; // align cloth apertures with Pool Royale pocket interior
const CLOTH_REFLECTION_LIMITS = Object.freeze({
  clearcoatMax: 0.028,
  clearcoatRoughnessMin: 0.48,
  envMapIntensityMax: 0.22
});
const POCKET_HOLE_R =
  POCKET_VIS_R * POCKET_CUT_EXPANSION * POCKET_VISUAL_EXPANSION; // cloth cutout radius for pocket openings
const BALL_CENTER_Y =
  CLOTH_TOP_LOCAL + CLOTH_LIFT + BALL_R - CLOTH_DROP; // rest balls directly on the lowered cloth plane
const BALL_SEGMENTS = Object.freeze({ width: 80, height: 60 });
const BALL_GEOMETRY = new THREE.SphereGeometry(
  BALL_R,
  BALL_SEGMENTS.width,
  BALL_SEGMENTS.height
);
// Slightly faster surface to keep balls rolling realistically on the snooker cloth
// Slightly reduce per-frame friction so rolls feel livelier on high refresh
// rate displays (e.g. 90 Hz) instead of drifting into slow motion.
const FRICTION = 0.993;
const CUSHION_RESTITUTION = 1;
const STOP_EPS = 0.02;
const TARGET_FPS = 90;
const TARGET_FRAME_TIME_MS = 1000 / TARGET_FPS;
const MAX_FRAME_TIME_MS = TARGET_FRAME_TIME_MS * 3; // allow up to 3 frames of catch-up
const MIN_FRAME_SCALE = 1e-6; // prevent zero-length frames from collapsing physics updates
const MAX_PHYSICS_SUBSTEPS = 5; // keep catch-up updates smooth without exploding work per frame
const CAPTURE_R = POCKET_R; // pocket capture radius
const CLOTH_THICKNESS = TABLE.THICK * 0.12; // render a thinner cloth so the playing surface feels lighter
const CLOTH_UNDERLAY_THICKNESS = TABLE.THICK * 0.24; // hidden plywood deck to catch shadows before they reach the carpet
const CLOTH_UNDERLAY_GAP = TABLE.THICK * 0.02; // leave a thin air gap between the cloth and plywood
const CLOTH_UNDERLAY_EDGE_INSET = 0; // match the playable field footprint while remaining hidden via colorWrite=false
const CLOTH_UNDERLAY_HOLE_SCALE = 1; // align underlay apertures with Pool Royale pocket layout
const CUSHION_OVERLAP = SIDE_RAIL_INNER_THICKNESS * 0.35; // overlap between cushions and rails to hide seams
const CUSHION_EXTRA_LIFT = 0; // keep cushion bases resting directly on the cloth plane
const SIDE_RAIL_EXTRA_DEPTH = TABLE.THICK * 1.12; // deepen side aprons so the lower edge flares out more prominently
const END_RAIL_EXTRA_DEPTH = SIDE_RAIL_EXTRA_DEPTH; // drop the end rails to match the side apron depth
const RAIL_OUTER_EDGE_RADIUS_RATIO = 0.18; // soften the exterior rail corners with a shallow curve
const POCKET_RECESS_DEPTH =
  BALL_R * 0.24; // keep the pocket throat visible without sinking the rim
const POCKET_DROP_ANIMATION_MS = 420;
const POCKET_DROP_MIN_MS = Math.round(POCKET_DROP_ANIMATION_MS * 0.57);
const POCKET_DROP_MAX_MS = Math.round(POCKET_DROP_ANIMATION_MS * 1.285);
const POCKET_DROP_SPEED_REFERENCE = 1.4;
const POCKET_DROP_DEPTH = TABLE.THICK * 0.9;
const POCKET_DROP_SCALE = 0.55;
const POCKET_CLOTH_TOP_RADIUS = POCKET_VIS_R * 0.8 * POCKET_VISUAL_EXPANSION;
const POCKET_CLOTH_BOTTOM_RADIUS = POCKET_CLOTH_TOP_RADIUS * 0.62;
const POCKET_DROP_TOP_SCALE = 0.82;
const POCKET_DROP_BOTTOM_SCALE = 0.48;
const POCKET_CLOTH_DEPTH = POCKET_RECESS_DEPTH * 1.05;
const POCKET_CAM_BASE_MIN_OUTSIDE =
  Math.max(SIDE_RAIL_INNER_THICKNESS, END_RAIL_INNER_THICKNESS) * 2.85 +
  POCKET_VIS_R * 4.7 +
  BALL_R * 4.1;
const POCKET_CAM_BASE_OUTWARD_OFFSET =
  Math.max(SIDE_RAIL_INNER_THICKNESS, END_RAIL_INNER_THICKNESS) * 3.4 +
  POCKET_VIS_R * 5.2 +
  BALL_R * 3.7;
const POCKET_CAM = Object.freeze({
  triggerDist: CAPTURE_R * 9.5,
  dotThreshold: 0.3,
  minOutside: POCKET_CAM_BASE_MIN_OUTSIDE,
  minOutsideShort: POCKET_CAM_BASE_MIN_OUTSIDE * 1.12,
  maxOutside: BALL_R * 30,
  heightOffset: BALL_R * 12.6,
  heightOffsetShortMultiplier: 1.05,
  outwardOffset: POCKET_CAM_BASE_OUTWARD_OFFSET,
  outwardOffsetShort: POCKET_CAM_BASE_OUTWARD_OFFSET * 1.15,
  heightDrop: BALL_R * 1.6,
  distanceScale: 1.22,
  heightScale: 1.34,
  focusBlend: 0.32,
  lateralFocusShift: POCKET_VIS_R * 0.5,
  railFocusLong: BALL_R * 9,
  railFocusShort: BALL_R * 6
});
const POCKET_CHAOS_MOVING_THRESHOLD = 3;
const POCKET_GUARANTEED_ALIGNMENT = 0.82;
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
 * Regji Kamera Snooker
 *
 * 0–2s (Opening Pan)
 * • Kamera nis nga lart, kënd diagonal mbi tavolinë (rreth 60°).
 * • Pan i ngadaltë djathtas → majtas që tregon gjithë tavolinën.
 *
 * 2–4s (Focus on Cue Ball)
 * • Kamera afrohet tek topi i bardhë dhe shkopi.
 * • Këndi ulet në 20–25° mbi tavolinë, direkt pas shkopit.
 * • Zoom i lehtë / shtrëngim i kornizës.
 *
 * 4–6s (Strike Tracking)
 * • Në momentin e goditjes kamera dridhet lehtë për impakt.
 * • Pastaj ndjek topin e bardhë përgjatë tavolinës duke e mbajtur në qendër.
 *
 * 6–9s (Impact & Spread)
 * • Kur topat përplasen, kamera ngrihet gradualisht (top-down).
 * • Hapet FOV që të futen të gjithë topat në kornizë.
 * • Bën lëvizje orbitale të shpejtë rreth tavolinës (rreth 30° rrotullim).
 *
 * 9–12s (Potting Shot)
 * • Kamera bën një dolly-in tek xhepi ku bie topi.
 * • Ndjek topin brenda xhepit për ~1 sekondë.
 * • Pastaj fade-out ose rikthim tek pamja e plotë.
 *
 * 12s+ (Reset)
 * • Kamera kthehet në overview fillestar (45° mbi tavolinë).
 * • Mban pan shumë të ngadaltë si looping idle derisa të ndodhë goditja tjetër.
 *
 * 🎮 Triggers
 * • Fillim loje → Opening Pan.
 * • Kur lojtari përgatitet → Focus on Cue Ball.
 * • Moment goditjeje → Strike Tracking.
 * • Kur topat përplasen → Impact & Spread.
 * • Kur një top bie në xhep → Potting Shot.
 * • Pas çdo raundi → Reset.
 */
const SHORT_RAIL_CAMERA_DISTANCE = PLAY_H / 2 + BALL_R * 22; // mirror Pool Royale framing so the table fill matches broadcast coverage
const SIDE_RAIL_CAMERA_DISTANCE = SHORT_RAIL_CAMERA_DISTANCE; // match short-rail framing so broadcast shots feel consistent
const CAMERA_LATERAL_CLAMP = Object.freeze({
  short: PLAY_W * 0.4,
  side: PLAY_H * 0.45
});
const POCKET_VIEW_MIN_DURATION_MS = 560;
const POCKET_VIEW_ACTIVE_EXTENSION_MS = 300;
const POCKET_VIEW_POST_POT_HOLD_MS = 160;
const SPIN_STRENGTH = BALL_R * 0.03125;
const SPIN_DECAY = 0.88;
const SPIN_ROLL_STRENGTH = BALL_R * 0.0175;
const SPIN_ROLL_DECAY = 0.978;
const SPIN_AIR_DECAY = 0.997; // hold spin energy while the cue ball travels straight pre-impact
const SWERVE_THRESHOLD = 0.85; // outer 15% of the spin control activates swerve behaviour
const SWERVE_TRAVEL_MULTIPLIER = 0.55; // dampen sideways drift while swerve is active so it stays believable
const PRE_IMPACT_SPIN_DRIFT = 0.06; // reapply stored sideways swerve once the cue ball is rolling after impact
// Mirror Pool Royale's tuned shot power and lift it by 30% for a livelier snooker break.
const SHOT_POWER_REDUCTION = 0.85;
const POOL_ROYALE_SHOT_FORCE = 1.5 * 0.75 * 0.85 * 0.8 * 1.3 * 0.85 * SHOT_POWER_REDUCTION;
const SHOT_FORCE_BOOST = POOL_ROYALE_SHOT_FORCE * 1.3;
const SHOT_BASE_SPEED = 3.3 * 0.3 * 1.65 * SHOT_FORCE_BOOST;
const SHOT_MIN_FACTOR = 0.25;
const SHOT_POWER_RANGE = 0.75;
const BALL_COLLISION_SOUND_REFERENCE_SPEED = SHOT_BASE_SPEED * 1.8;
const RAIL_HIT_SOUND_REFERENCE_SPEED = SHOT_BASE_SPEED * 1.2;
const RAIL_HIT_SOUND_COOLDOWN_MS = 140;
const CROWD_VOLUME_SCALE = 1;
const POCKET_SOUND_TAIL = 1;
// Make the four round legs dramatically taller so the table surface rides higher
const LEG_SCALE = 6.2;
const LEG_HEIGHT_FACTOR = 4;
const LEG_HEIGHT_MULTIPLIER = 2.25;
const BASE_TABLE_LIFT = 3.6;
const TABLE_DROP = 0.4;
const LEG_HEIGHT_BOOST = 1.15; // lift the playfield by extending the legs 15%
const TABLE_H = 0.75 * LEG_SCALE; // physical height of table used for legs/skirt
const TABLE_LIFT_BASE =
  BASE_TABLE_LIFT + TABLE_H * (LEG_HEIGHT_FACTOR - 1);
const BASE_LEG_HEIGHT = TABLE.THICK * 2 * 3 * 1.15 * LEG_HEIGHT_MULTIPLIER;
const LEG_RADIUS_SCALE = 1.2; // 20% thicker cylindrical legs
const LEG_LENGTH_SCALE = 0.72; // lengthen the visible legs by 20% to elevate the table stance
const LEG_HEIGHT_OFFSET = FRAME_TOP_Y - 0.3; // relationship between leg room and visible leg height
const LEG_ROOM_HEIGHT_RAW_BASE = BASE_LEG_HEIGHT + TABLE_LIFT_BASE;
const LEG_ROOM_HEIGHT_BASE =
  (LEG_ROOM_HEIGHT_RAW_BASE + LEG_HEIGHT_OFFSET) * LEG_LENGTH_SCALE - LEG_HEIGHT_OFFSET;
const LEG_ROOM_HEIGHT = LEG_ROOM_HEIGHT_BASE * LEG_HEIGHT_BOOST;
const TABLE_LIFT = TABLE_LIFT_BASE + (LEG_ROOM_HEIGHT - LEG_ROOM_HEIGHT_BASE);
// raise overall table position so the longer legs are visible and the playfield sits higher off the floor
const TABLE_Y = -2 + (TABLE_H - 0.75) + TABLE_H + TABLE_LIFT - TABLE_DROP;
const LEG_TOP_OVERLAP = TABLE.THICK * 0.25; // sink legs slightly into the apron so they appear connected
const SKIRT_DROP_MULTIPLIER = 3.2; // double the apron drop so the base reads much deeper beneath the rails
const SKIRT_SIDE_OVERHANG = 0; // keep the lower base flush with the rail footprint (no horizontal flare)
const SKIRT_RAIL_GAP_FILL = TABLE.THICK * 0.04; // lift the apron to close the gap beneath the rails
const FLOOR_Y = TABLE_Y - TABLE.THICK - LEG_ROOM_HEIGHT + 0.3;
const ORBIT_FOCUS_BASE_Y = TABLE_Y + 0.05;
const CAMERA_CUE_SURFACE_MARGIN = BALL_R * 0.32; // keep orbit height aligned with the cue while leaving a safe buffer above
const CUE_TIP_GAP = BALL_R * 1.45; // pull cue stick slightly farther back for a more natural stance
const CUE_PULL_BASE = BALL_R * 10 * 0.65 * 1.2;
const CUE_Y = BALL_CENTER_Y - BALL_R * 0.05; // drop cue height slightly so the tip lines up with the cue ball centre
const CUE_TIP_RADIUS = (BALL_R / 0.0525) * 0.006 * 1.5;
const CUE_MARKER_RADIUS = CUE_TIP_RADIUS * 0.85; // shrink cue ball dots by 15%
const CUE_MARKER_DEPTH = CUE_MARKER_RADIUS * 0.2;
const CUE_BUTT_LIFT = BALL_R * 0.62; // raise the butt a little more so the rear clears rails while the tip stays aligned
const CUE_LENGTH_MULTIPLIER = 1.35; // extend cue stick length so the rear section feels longer without moving the tip
const MAX_BACKSPIN_TILT = THREE.MathUtils.degToRad(8.5);
const CUE_FRONT_SECTION_RATIO = 0.28;
const MAX_SPIN_CONTACT_OFFSET = Math.max(0, BALL_R - CUE_TIP_RADIUS);
const MAX_SPIN_FORWARD = BALL_R * 0.88;
const MAX_SPIN_SIDE = BALL_R * 0.62;
const MAX_SPIN_VERTICAL = Math.min(BALL_R * 0.48, MAX_SPIN_CONTACT_OFFSET);
const SPIN_BOX_FILL_RATIO =
  BALL_R > 0
    ? THREE.MathUtils.clamp(
        MAX_SPIN_CONTACT_OFFSET / BALL_R,
        0,
        1
      )
    : 1;
const SPIN_CLEARANCE_MARGIN = BALL_R * 0.4;
const SPIN_TIP_MARGIN = CUE_TIP_RADIUS * 1.6;
const SIDE_SPIN_MULTIPLIER = 1.25;
const BACKSPIN_MULTIPLIER = 1.7 * 1.25 * 1.5;
const TOPSPIN_MULTIPLIER = 1.3;
// angle for cushion cuts guiding balls into pockets
const CUSHION_CUT_ANGLE = 35;
const CUSHION_BACK_TRIM = 0.8; // trim 20% off the cushion back that meets the rails
const CUSHION_FACE_INSET = SIDE_RAIL_INNER_THICKNESS * 0.16; // mirror Pool Royale cushion placement

// shared UI reduction factor so overlays and controls shrink alongside the table
const UI_SCALE = SIZE_REDUCTION;

// Updated colors for dark cloth and standard balls
const BASE_BALL_COLORS = Object.freeze({
  cue: 0xffffff,
  red: 0xd12c2c,
  yellow: 0xffd700,
  green: 0x0fa35a,
  brown: 0x8b4513,
  blue: 0x1e50ff,
  pink: 0xff69b4,
  black: 0x000000
});
const CLOTH_TEXTURE_INTENSITY = 0.48;
const CLOTH_HAIR_INTENSITY = 0.26;
const CLOTH_BUMP_INTENSITY = 0.42;
const CLOTH_SOFT_BLEND = 0.52;

const makeColorPalette = ({ cloth, rail, base, markings = 0xffffff }) => ({
  cloth,
  rail,
  base,
  markings,
  ...BASE_BALL_COLORS
});

const CUE_WOOD_REPEAT = new THREE.Vector2(1, 5.5);
const TABLE_WOOD_TEXTURE_SCALE = 0.12; // enlarge grain scale on rails and skirts to match the legs
const WOOD_PRESETS_BY_ID = Object.freeze(
  WOOD_FINISH_PRESETS.reduce((acc, preset) => {
    acc[preset.id] = preset;
    return acc;
  }, {})
);
const DEFAULT_WOOD_PRESET_ID = 'walnut';
const SNOOKER_WOOD_PRESET_FOR_FINISH = Object.freeze({
  rusticSplit: 'walnut',
  charredTimber: 'wenge',
  plankStudio: 'oak',
  weatheredGrey: 'smokedOak',
  jetBlackCarbon: 'ebony',
  classicWood: 'walnut',
  goldenMaple: 'maple',
  nordicBirch: 'birch',
  matteGraphite: 'smokedOak',
  matteGraphiteNeon: 'smokedOak',
  twoToneHybrid: 'teak',
  royalWalnut: 'walnut',
  royalObsidian: 'smokedOak'
});
const SNOOKER_WOOD_REPEAT = Object.freeze({
  x: CUE_WOOD_REPEAT.x,
  y: CUE_WOOD_REPEAT.y
});
const SNOOKER_WOOD_SURFACE_PROPS = Object.freeze({
  roughnessBase: 0.16,
  roughnessVariance: 0.22
});

const DEFAULT_TABLE_FINISH_ID = 'rusticSplit';

const applySnookerWoodPreset = (materials, finishId) => {
  const presetId = SNOOKER_WOOD_PRESET_FOR_FINISH[finishId];
  if (!presetId) return;
  const preset = WOOD_PRESETS_BY_ID[presetId];
  if (!preset) return;
  const options = {
    hue: preset.hue,
    sat: preset.sat,
    light: preset.light,
    contrast: preset.contrast,
    repeat: SNOOKER_WOOD_REPEAT,
    sharedKey: `snooker-wood-${preset.id}`,
    ...SNOOKER_WOOD_SURFACE_PROPS
  };
  const uniqueMaterials = new Set(
    [materials.frame, materials.rail, materials.leg].filter(Boolean)
  );
  uniqueMaterials.forEach((material) => {
    applyWoodTextures(material, options);
  });
};

const createPocketMaterials = () => ({
  pocketJaw: new THREE.MeshPhysicalMaterial({
    color: 0x6d7177,
    metalness: 0.18,
    roughness: 0.42,
    clearcoat: 0.12,
    clearcoatRoughness: 0.22,
    envMapIntensity: 0.64
  }),
  pocketInner: new THREE.MeshPhysicalMaterial({
    color: 0x3c4148,
    metalness: 0.18,
    roughness: 0.52,
    clearcoat: 0.1,
    clearcoatRoughness: 0.22,
    envMapIntensity: 0.44
  }),
  pocketRing: new THREE.MeshPhysicalMaterial({
    color: 0x2b2f36,
    metalness: 0.22,
    roughness: 0.38,
    clearcoat: 0.42,
    clearcoatRoughness: 0.22,
    sheen: 0.12,
    sheenRoughness: 0.44,
    envMapIntensity: 0.82
  }),
  pocketNet: new THREE.MeshStandardMaterial({
    color: 0x9d8f7e,
    emissive: 0x000000,
    emissiveIntensity: 0.18,
    metalness: 0.12,
    roughness: 0.78,
    envMapIntensity: 0.42
  })
});

const TABLE_FINISHES = Object.freeze({
  rusticSplit: {
    id: 'rusticSplit',
    label: 'Pearl Cream',
    colors: makeColorPalette({
      cloth: 0x2d7f4b,
      rail: 0xf2eadf,
      base: 0xefe5d6
    }),
    woodTextureId: 'frameRusticSplit',
    createMaterials: () => {
      const frameColor = new THREE.Color('#efe5d6');
      const railColor = new THREE.Color('#f2eadf');
      const frame = new THREE.MeshPhysicalMaterial({
        color: frameColor,
        metalness: 0.28,
        roughness: 0.26,
        clearcoat: 0.46,
        clearcoatRoughness: 0.18,
        sheen: 0.18,
        sheenRoughness: 0.46,
        reflectivity: 0.56,
        envMapIntensity: 0.94
      });
      const rail = new THREE.MeshPhysicalMaterial({
        color: railColor,
        metalness: 0.3,
        roughness: 0.28,
        clearcoat: 0.5,
        clearcoatRoughness: 0.16,
        sheen: 0.2,
        sheenRoughness: 0.44,
        reflectivity: 0.6,
        envMapIntensity: 1.02
      });
      const trim = new THREE.MeshPhysicalMaterial({
        color: 0xf7f4ea,
        metalness: 0.72,
        roughness: 0.28,
        clearcoat: 0.52,
        clearcoatRoughness: 0.18,
        envMapIntensity: 1.08
      });
      const materials = {
        frame,
        rail,
        leg: frame,
        trim,
        accent: null
      };
      applySnookerWoodPreset(materials, 'rusticSplit');
      return { ...materials, ...createPocketMaterials() };
    }
  },
  charredTimber: {
    id: 'charredTimber',
    label: 'Charred Timber',
    colors: makeColorPalette({
      cloth: 0x2d7f4b,
      rail: 0x3c2c22,
      base: 0x302118
    }),
    woodTextureId: 'frameCharred',
    createMaterials: () => {
      const frameColor = new THREE.Color('#302118');
      const railColor = new THREE.Color('#3c2c22');
      const frame = new THREE.MeshPhysicalMaterial({
        color: frameColor,
        metalness: 0.22,
        roughness: 0.38,
        clearcoat: 0.3,
        clearcoatRoughness: 0.22,
        sheen: 0.12,
        sheenRoughness: 0.52,
        reflectivity: 0.4,
        envMapIntensity: 0.74
      });
      const rail = new THREE.MeshPhysicalMaterial({
        color: railColor,
        metalness: 0.26,
        roughness: 0.36,
        clearcoat: 0.34,
        clearcoatRoughness: 0.2,
        sheen: 0.16,
        sheenRoughness: 0.48,
        reflectivity: 0.46,
        envMapIntensity: 0.8
      });
      const leg = new THREE.MeshPhysicalMaterial({
        color: frameColor.clone().offsetHSL(0.01, 0.06, 0.1),
        metalness: 0.24,
        roughness: 0.46,
        clearcoat: 0.26,
        clearcoatRoughness: 0.3
      });
      const trim = new THREE.MeshPhysicalMaterial({
        color: 0xb88f5f,
        metalness: 0.62,
        roughness: 0.36,
        clearcoat: 0.38,
        clearcoatRoughness: 0.24,
        envMapIntensity: 0.9
      });
      const materials = {
        frame,
        rail,
        leg,
        trim,
        accent: null
      };
      applySnookerWoodPreset(materials, 'charredTimber');
      return { ...materials, ...createPocketMaterials() };
    }
  },
  plankStudio: {
    id: 'plankStudio',
    label: 'Plank Studio',
    colors: makeColorPalette({
      cloth: 0x2d7f4b,
      rail: 0xb88452,
      base: 0xae7a46
    }),
    woodTextureId: 'framePlank',
    createMaterials: () => {
      const frameColor = new THREE.Color('#ae7a46');
      const railColor = new THREE.Color('#b88452');
      const frame = new THREE.MeshPhysicalMaterial({
        color: frameColor,
        metalness: 0.18,
        roughness: 0.3,
        clearcoat: 0.36,
        clearcoatRoughness: 0.18,
        sheen: 0.16,
        sheenRoughness: 0.46,
        reflectivity: 0.48,
        envMapIntensity: 0.86
      });
      const rail = new THREE.MeshPhysicalMaterial({
        color: railColor,
        metalness: 0.22,
        roughness: 0.32,
        clearcoat: 0.38,
        clearcoatRoughness: 0.2,
        sheen: 0.18,
        sheenRoughness: 0.48,
        reflectivity: 0.5,
        envMapIntensity: 0.92
      });
      const trim = new THREE.MeshPhysicalMaterial({
        color: 0xe5c185,
        metalness: 0.7,
        roughness: 0.32,
        clearcoat: 0.46,
        clearcoatRoughness: 0.22,
        envMapIntensity: 1
      });
      const materials = {
        frame,
        rail,
        leg: frame,
        trim,
        accent: null
      };
      applySnookerWoodPreset(materials, 'plankStudio');
      return { ...materials, ...createPocketMaterials() };
    }
  },
  weatheredGrey: {
    id: 'weatheredGrey',
    label: 'Weathered Grey',
    colors: makeColorPalette({
      cloth: 0x2d7f4b,
      rail: 0x5f5750,
      base: 0x4e463f
    }),
    woodTextureId: 'frameWeathered',
    createMaterials: () => {
      const frameColor = new THREE.Color('#4e463f');
      const railColor = new THREE.Color('#5f5750');
      const frame = new THREE.MeshPhysicalMaterial({
        color: frameColor,
        metalness: 0.18,
        roughness: 0.44,
        clearcoat: 0.24,
        clearcoatRoughness: 0.28,
        sheen: 0.12,
        sheenRoughness: 0.56,
        reflectivity: 0.38,
        envMapIntensity: 0.72
      });
      const rail = new THREE.MeshPhysicalMaterial({
        color: railColor,
        metalness: 0.22,
        roughness: 0.4,
        clearcoat: 0.26,
        clearcoatRoughness: 0.26,
        sheen: 0.14,
        sheenRoughness: 0.54,
        reflectivity: 0.42,
        envMapIntensity: 0.78
      });
      const leg = new THREE.MeshPhysicalMaterial({
        color: frameColor.clone().offsetHSL(0.01, 0.02, 0.06),
        metalness: 0.2,
        roughness: 0.5,
        clearcoat: 0.2,
        clearcoatRoughness: 0.32
      });
      const trim = new THREE.MeshPhysicalMaterial({
        color: 0xc0b8aa,
        metalness: 0.64,
        roughness: 0.34,
        clearcoat: 0.36,
        clearcoatRoughness: 0.24,
        envMapIntensity: 0.92
      });
      const materials = {
        frame,
        rail,
        leg,
        trim,
        accent: null
      };
      applySnookerWoodPreset(materials, 'weatheredGrey');
      return { ...materials, ...createPocketMaterials() };
    }
  },
  jetBlackCarbon: {
    id: 'jetBlackCarbon',
    label: 'Jet Black Matte Carbon Fibre',
    colors: makeColorPalette({
      cloth: 0x1a1a1c,
      rail: 0x16181c,
      base: 0x0d0f12
    }),
    woodTextureId: null,
    createMaterials: () => {
      const frameColor = new THREE.Color('#0d0f12');
      const railColor = new THREE.Color('#16181c');
      const fiberSheen = new THREE.Color('#2d323a');
      const frame = new THREE.MeshPhysicalMaterial({
        color: frameColor,
        metalness: 0.36,
        roughness: 0.68,
        clearcoat: 0.08,
        clearcoatRoughness: 0.42,
        sheen: 0.3,
        sheenColor: fiberSheen,
        sheenRoughness: 0.65,
        envMapIntensity: 0.62
      });
      const rail = new THREE.MeshPhysicalMaterial({
        color: railColor,
        metalness: 0.32,
        roughness: 0.6,
        clearcoat: 0.12,
        clearcoatRoughness: 0.4,
        sheen: 0.34,
        sheenColor: fiberSheen,
        sheenRoughness: 0.62,
        envMapIntensity: 0.7
      });
      const trim = new THREE.MeshPhysicalMaterial({
        color: 0x2e3138,
        metalness: 0.72,
        roughness: 0.32,
        clearcoat: 0.28,
        clearcoatRoughness: 0.36,
        envMapIntensity: 0.9
      });
      const accent = new THREE.MeshPhysicalMaterial({
        color: 0x111319,
        metalness: 0.28,
        roughness: 0.54,
        clearcoat: 0.18,
        clearcoatRoughness: 0.46,
        envMapIntensity: 0.58
      });
      const materials = {
        frame,
        rail,
        leg: frame,
        trim,
        accent
      };
      applySnookerWoodPreset(materials, 'jetBlackCarbon');
      return { ...materials, ...createPocketMaterials() };
    }
  },
  royalWalnut: {
    id: 'royalWalnut',
    label: 'Royal Walnut',
    colors: makeColorPalette({
      cloth: 0x33b277,
      rail: 0x4c2e1d,
      base: 0x3b2213,
      markings: 0xfbead4
    }),
    createMaterials: () => {
      const frameColor = new THREE.Color('#4b2f1d');
      const frame = new THREE.MeshPhysicalMaterial({
        color: frameColor,
        metalness: 0.2,
        roughness: 0.35,
        clearcoat: 0.32,
        clearcoatRoughness: 0.2,
        sheen: 0.16,
        sheenRoughness: 0.48,
        reflectivity: 0.48,
        envMapIntensity: 0.8
      });
      const rail = new THREE.MeshPhysicalMaterial({
        color: frameColor.clone().offsetHSL(0.01, 0.06, 0.12),
        metalness: 0.24,
        roughness: 0.34,
        clearcoat: 0.34,
        clearcoatRoughness: 0.22,
        sheen: 0.18,
        sheenRoughness: 0.5,
        reflectivity: 0.54,
        envMapIntensity: 0.86
      });
      const leg = frame.clone();
      const trim = new THREE.MeshPhysicalMaterial({
        color: 0xe0be83,
        metalness: 0.78,
        roughness: 0.34,
        clearcoat: 0.4,
        clearcoatRoughness: 0.24,
        envMapIntensity: 1.04
      });
      const materials = {
        frame,
        rail,
        leg,
        trim,
        accent: null
      };
      applySnookerWoodPreset(materials, 'royalWalnut');
      return materials;
    }
  },
  royalObsidian: {
    id: 'royalObsidian',
    label: 'Royal Obsidian',
    colors: makeColorPalette({
      cloth: 0x2ebd74,
      rail: 0x1c222c,
      base: 0x12161d,
      markings: 0x8bd3ff
    }),
    createMaterials: () => {
      const frame = new THREE.MeshPhysicalMaterial({
        color: 0x141820,
        metalness: 0.4,
        roughness: 0.4,
        clearcoat: 0.28,
        clearcoatRoughness: 0.26,
        sheen: 0.08,
        sheenRoughness: 0.48,
        reflectivity: 0.52,
        envMapIntensity: 0.94
      });
      const rail = new THREE.MeshPhysicalMaterial({
        color: 0x1c222c,
        metalness: 0.58,
        roughness: 0.32,
        clearcoat: 0.32,
        clearcoatRoughness: 0.24,
        sheen: 0.06,
        sheenRoughness: 0.42,
        reflectivity: 0.6,
        envMapIntensity: 1.02
      });
      const leg = new THREE.MeshPhysicalMaterial({
        color: 0x0d1116,
        metalness: 0.42,
        roughness: 0.38,
        clearcoat: 0.24,
        clearcoatRoughness: 0.3,
        sheen: 0.06,
        sheenRoughness: 0.5
      });
      const trim = new THREE.MeshPhysicalMaterial({
        color: 0x202a36,
        metalness: 0.86,
        roughness: 0.3,
        clearcoat: 0.36,
        clearcoatRoughness: 0.26,
        envMapIntensity: 1.18
      });
      const neon = new THREE.Color('#00d7ff');
      const accentMaterial = new THREE.MeshStandardMaterial({
        color: neon,
        emissive: neon.clone().multiplyScalar(0.7),
        emissiveIntensity: 1.5,
        metalness: 0.34,
        roughness: 0.28
      });
      const materials = {
        frame,
        rail,
        leg,
        trim,
        accent: {
          material: accentMaterial,
          thickness: 0.05,
          height: 0.024,
          inset: 0.058,
          verticalOffset: 0.76
        }
      };
      applySnookerWoodPreset(materials, 'royalObsidian');
      return materials;
    }
  },
  classicWood: {
    id: 'classicWood',
    label: 'Classic Wood',
    colors: makeColorPalette({
      cloth: 0x33a86a,
      rail: 0x5e3d24,
      base: 0x5e3d24
    }),
    createMaterials: () => {
      const frameColor = new THREE.Color('#5e3d24');
      const frame = new THREE.MeshPhysicalMaterial({
        color: frameColor,
        metalness: 0.18,
        roughness: 0.32,
        clearcoat: 0.28,
        clearcoatRoughness: 0.18,
        sheen: 0.12,
        sheenRoughness: 0.52,
        reflectivity: 0.42,
        envMapIntensity: 0.7
      });
      const rail = new THREE.MeshPhysicalMaterial({
        color: frameColor.clone().offsetHSL(0, 0.02, 0.08),
        metalness: 0.2,
        roughness: 0.34,
        clearcoat: 0.3,
        clearcoatRoughness: 0.22,
        sheen: 0.14,
        sheenRoughness: 0.5,
        reflectivity: 0.45,
        envMapIntensity: 0.74
      });
      const trim = new THREE.MeshPhysicalMaterial({
        color: 0xcda87b,
        metalness: 0.65,
        roughness: 0.38,
        clearcoat: 0.42,
        clearcoatRoughness: 0.28,
        envMapIntensity: 0.9
      });
      const materials = {
        frame,
        rail,
        leg: frame,
        trim,
        accent: null
      };
      applySnookerWoodPreset(materials, 'classicWood');
      return materials;
    }
  },
  goldenMaple: {
    id: 'goldenMaple',
    label: 'Golden Maple',
    colors: makeColorPalette({
      cloth: 0x33a86a,
      rail: 0xc98738,
      base: 0xc27a2f
    }),
    createMaterials: () => {
      const frameColor = new THREE.Color('#c98738');
      const frame = new THREE.MeshPhysicalMaterial({
        color: frameColor,
        metalness: 0.16,
        roughness: 0.28,
        clearcoat: 0.36,
        clearcoatRoughness: 0.16,
        sheen: 0.14,
        sheenRoughness: 0.48,
        reflectivity: 0.46,
        envMapIntensity: 0.82
      });
      const rail = new THREE.MeshPhysicalMaterial({
        color: frameColor.clone().offsetHSL(0.01, 0.06, 0.12),
        metalness: 0.2,
        roughness: 0.3,
        clearcoat: 0.38,
        clearcoatRoughness: 0.18,
        sheen: 0.16,
        sheenRoughness: 0.46,
        reflectivity: 0.52,
        envMapIntensity: 0.88
      });
      const trim = new THREE.MeshPhysicalMaterial({
        color: 0xe8c387,
        metalness: 0.68,
        roughness: 0.34,
        clearcoat: 0.44,
        clearcoatRoughness: 0.24,
        envMapIntensity: 1
      });
      const materials = {
        frame,
        rail,
        leg: frame,
        trim,
        accent: null
      };
      applySnookerWoodPreset(materials, 'goldenMaple');
      return materials;
    }
  },
  nordicBirch: {
    id: 'nordicBirch',
    label: 'Nordic Birch',
    colors: makeColorPalette({
      cloth: 0x33a86a,
      rail: 0xd8b47c,
      base: 0xd2a86a
    }),
    createMaterials: () => {
      const frameColor = new THREE.Color('#d8b47c');
      const frame = new THREE.MeshPhysicalMaterial({
        color: frameColor,
        metalness: 0.12,
        roughness: 0.26,
        clearcoat: 0.4,
        clearcoatRoughness: 0.14,
        sheen: 0.18,
        sheenRoughness: 0.44,
        reflectivity: 0.48,
        envMapIntensity: 0.9
      });
      const rail = new THREE.MeshPhysicalMaterial({
        color: frameColor.clone().offsetHSL(0.02, 0.04, 0.1),
        metalness: 0.16,
        roughness: 0.28,
        clearcoat: 0.42,
        clearcoatRoughness: 0.18,
        sheen: 0.2,
        sheenRoughness: 0.4,
        reflectivity: 0.5,
        envMapIntensity: 0.95
      });
      const trim = new THREE.MeshPhysicalMaterial({
        color: 0xf4e0b8,
        metalness: 0.6,
        roughness: 0.32,
        clearcoat: 0.46,
        clearcoatRoughness: 0.22,
        envMapIntensity: 1.05
      });
      const materials = {
        frame,
        rail,
        leg: frame,
        trim,
        accent: null
      };
      applySnookerWoodPreset(materials, 'nordicBirch');
      return materials;
    }
  },
  matteGraphite: {
    id: 'matteGraphite',
    label: 'Matte Graphite',
    colors: makeColorPalette({
      cloth: 0x33a86a,
      rail: 0x2f2f2f,
      base: 0x2b2b2b
    }),
    createMaterials: () => {
      const frame = new THREE.MeshPhysicalMaterial({
        color: 0x2b2b2b,
        metalness: 0.22,
        roughness: 0.6,
        clearcoat: 0.08,
        clearcoatRoughness: 0.46,
        sheen: 0.05,
        sheenRoughness: 0.72
      });
      const rail = new THREE.MeshPhysicalMaterial({
        color: 0x303030,
        metalness: 0.28,
        roughness: 0.54,
        clearcoat: 0.12,
        clearcoatRoughness: 0.4,
        sheen: 0.04,
        sheenRoughness: 0.64
      });
      const leg = new THREE.MeshPhysicalMaterial({
        color: 0x232323,
        metalness: 0.26,
        roughness: 0.58,
        clearcoat: 0.08,
        clearcoatRoughness: 0.44
      });
      const trim = new THREE.MeshPhysicalMaterial({
        color: 0x2a2f34,
        metalness: 0.82,
        roughness: 0.34,
        clearcoat: 0.24,
        clearcoatRoughness: 0.32,
        envMapIntensity: 1.1
      });
      const materials = {
        frame,
        rail,
        leg,
        trim,
        accent: null
      };
      applySnookerWoodPreset(materials, 'matteGraphite');
      return materials;
    }
  },
  matteGraphiteNeon: {
    id: 'matteGraphiteNeon',
    label: 'Matte Graphite Neon',
    colors: makeColorPalette({
      cloth: 0x33a86a,
      rail: 0x2f2f2f,
      base: 0x2b2b2b
    }),
    createMaterials: () => {
      const frame = new THREE.MeshPhysicalMaterial({
        color: 0x2b2b2b,
        metalness: 0.22,
        roughness: 0.6,
        clearcoat: 0.08,
        clearcoatRoughness: 0.46,
        sheen: 0.05,
        sheenRoughness: 0.72
      });
      const rail = new THREE.MeshPhysicalMaterial({
        color: 0x303030,
        metalness: 0.28,
        roughness: 0.54,
        clearcoat: 0.12,
        clearcoatRoughness: 0.4,
        sheen: 0.04,
        sheenRoughness: 0.64
      });
      const leg = new THREE.MeshPhysicalMaterial({
        color: 0x232323,
        metalness: 0.26,
        roughness: 0.58,
        clearcoat: 0.08,
        clearcoatRoughness: 0.44
      });
      const trim = new THREE.MeshPhysicalMaterial({
        color: 0x11161c,
        metalness: 0.78,
        roughness: 0.32,
        clearcoat: 0.22,
        clearcoatRoughness: 0.34,
        envMapIntensity: 1.1
      });
      const neon = new THREE.Color('#00c8ff');
      const accentMaterial = new THREE.MeshStandardMaterial({
        color: neon,
        emissive: neon.clone().multiplyScalar(0.55),
        emissiveIntensity: 1.4,
        metalness: 0.32,
        roughness: 0.34
      });
      const materials = {
        frame,
        rail,
        leg,
        trim,
        accent: {
          material: accentMaterial,
          thickness: 0.055,
          height: 0.028,
          inset: 0.045,
          verticalOffset: 0.82
        }
      };
      applySnookerWoodPreset(materials, 'matteGraphiteNeon');
      return materials;
    }
  },
  twoToneHybrid: {
    id: 'twoToneHybrid',
    label: 'Two-Tone Hybrid',
    colors: makeColorPalette({
      cloth: 0x33a86a,
      rail: 0x151a1f,
      base: 0x1c2026
    }),
    createMaterials: () => {
      const frame = new THREE.MeshPhysicalMaterial({
        color: 0x1c2026,
        metalness: 0.58,
        roughness: 0.38,
        clearcoat: 0.26,
        clearcoatRoughness: 0.32,
        sheen: 0.08,
        sheenRoughness: 0.52
      });
      const rail = new THREE.MeshPhysicalMaterial({
        color: 0x13171d,
        metalness: 0.72,
        roughness: 0.32,
        clearcoat: 0.3,
        clearcoatRoughness: 0.28,
        sheen: 0.06,
        sheenRoughness: 0.46
      });
      const leg = new THREE.MeshPhysicalMaterial({
        color: 0x302218,
        metalness: 0.22,
        roughness: 0.52,
        clearcoat: 0.18,
        clearcoatRoughness: 0.42
      });
      const trim = new THREE.MeshPhysicalMaterial({
        color: 0xc9a65c,
        metalness: 0.86,
        roughness: 0.26,
        clearcoat: 0.4,
        clearcoatRoughness: 0.24,
        envMapIntensity: 1.18
      });
      const accentMaterial = new THREE.MeshStandardMaterial({
        color: 0xffd369,
        emissive: new THREE.Color(0xffd369).multiplyScalar(0.22),
        emissiveIntensity: 0.9,
        metalness: 0.48,
        roughness: 0.38
      });
      const materials = {
        frame,
        rail,
        leg,
        trim,
        accent: {
          material: accentMaterial,
          thickness: 0.05,
          height: 0.024,
          inset: 0.06,
          verticalOffset: 0.74
        }
      };
      applySnookerWoodPreset(materials, 'twoToneHybrid');
      return materials;
    }
  }
});

const TABLE_FINISH_OPTIONS = Object.freeze([
  TABLE_FINISHES.rusticSplit,
  TABLE_FINISHES.charredTimber,
  TABLE_FINISHES.plankStudio,
  TABLE_FINISHES.weatheredGrey,
  TABLE_FINISHES.jetBlackCarbon
].filter(Boolean));

const DEFAULT_CHROME_COLOR_ID = 'chrome';
const CHROME_COLOR_OPTIONS = Object.freeze([
  {
    id: 'chrome',
    label: 'Chrome',
    color: 0xc0c9d5,
    metalness: 0.76,
    roughness: 0.42,
    clearcoat: 0.26,
    clearcoatRoughness: 0.3,
    envMapIntensity: 0.58
  },
  {
    id: 'gold',
    label: 'Gold',
    color: 0xd4af37,
    metalness: 0.88,
    roughness: 0.35,
    clearcoat: 0.26,
    clearcoatRoughness: 0.2
  }
]);

const DEFAULT_CLOTH_COLOR_ID = 'freshGreen';
const CLOTH_COLOR_OPTIONS = Object.freeze([
  {
    id: 'freshGreen',
    label: 'Tour Green',
    color: 0x6bdd9d,
    textureKey: 'freshGreen',
    detail: {
      bumpMultiplier: 1,
      sheen: 0.58,
      sheenRoughness: 0.42,
      emissiveIntensity: 0.52
    }
  },
  {
    id: 'graphite',
    label: 'Arcadia Graphite',
    color: 0x4a5566,
    textureKey: 'graphite',
    detail: {
      bumpMultiplier: 0.92,
      roughness: 0.72,
      envMapIntensity: 0.16
    }
  },
  {
    id: 'arcticBlue',
    label: 'Arctic Blue',
    color: 0x7ac6f5,
    textureKey: 'arcticBlue',
    detail: {
      sheen: 0.72,
      sheenRoughness: 0.4,
      envMapIntensity: 0.22
    }
  }
]);

const toHexColor = (value) => {
  if (typeof value === 'number') {
    return `#${value.toString(16).padStart(6, '0')}`;
  }
  return value ?? '#ffffff';
};

const ORIGINAL_RAIL_WIDTH = TABLE.WALL * 0.7;
const ORIGINAL_FRAME_WIDTH = ORIGINAL_RAIL_WIDTH * 2.5;
const ORIGINAL_OUTER_HALF_W =
  ORIGINAL_HALF_W + ORIGINAL_RAIL_WIDTH * 2 + ORIGINAL_FRAME_WIDTH;
const ORIGINAL_PLAY_H = TABLE.H - 2 * TABLE.WALL;
const ORIGINAL_HALF_H = ORIGINAL_PLAY_H / 2;
const ORIGINAL_OUTER_HALF_H =
  ORIGINAL_HALF_H + ORIGINAL_RAIL_WIDTH * 2 + ORIGINAL_FRAME_WIDTH;

const CLOTH_TEXTURE_SIZE = 4096;
const CLOTH_THREAD_PITCH = 12 * 0.8;
const CLOTH_THREADS_PER_TILE = CLOTH_TEXTURE_SIZE / CLOTH_THREAD_PITCH;

const createClothTextures = (() => {
  let cache = null;
  const clamp255 = (value) => Math.max(0, Math.min(255, value));
  return () => {
    if (cache) return cache;
    if (typeof document === 'undefined') {
      cache = { map: null, bump: null };
      return cache;
    }

    const SIZE = CLOTH_TEXTURE_SIZE;
    const THREAD_PITCH = CLOTH_THREAD_PITCH;
    const DIAG = Math.PI / 4;
    const COS = Math.cos(DIAG);
    const SIN = Math.sin(DIAG);
    const TAU = Math.PI * 2;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      cache = { map: null, bump: null };
      return cache;
    }

    const image = ctx.createImageData(SIZE, SIZE);
    const data = image.data;
    const shadow = { r: 0x1a, g: 0x64, b: 0x39 };
    const base = { r: 0x2f, g: 0x97, b: 0x53 };
    const accent = { r: 0x41, g: 0xb4, b: 0x67 };
    const highlight = { r: 0x62, g: 0xd8, b: 0x8b };
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
      const wisp = Math.pow(strayWispNoise(x * 0.82 - y * 0.63, y * 0.74 + x * 0.18), 4.2);
      return THREE.MathUtils.clamp(
        tuft * 0.55 + stray * 0.25 + filament * 0.3 + wisp * 0.2,
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
        const sparkle = sparkleNoise(x * 0.6 + 11.8, y * 0.7 - 4.1);
        const fuzz = Math.pow(fiber, 1.2);
        const hair = hairFiber(x, y);
        const tonal = THREE.MathUtils.clamp(
          0.56 +
            (weave - 0.5) * 0.6 * CLOTH_TEXTURE_INTENSITY +
            (cross - 0.5) * 0.48 * CLOTH_TEXTURE_INTENSITY +
            (diamond - 0.5) * 0.54 * CLOTH_TEXTURE_INTENSITY +
            (fiber - 0.5) * 0.32 * CLOTH_TEXTURE_INTENSITY +
            (fuzz - 0.5) * 0.24 * CLOTH_TEXTURE_INTENSITY +
            (micro - 0.5) * 0.18 * CLOTH_TEXTURE_INTENSITY +
            (hair - 0.5) * 0.3 * CLOTH_HAIR_INTENSITY,
          0,
          1
        );
        const tonalEnhanced = THREE.MathUtils.clamp(
          0.5 +
            (tonal - 0.5) * (1 + (1.56 - 1) * CLOTH_TEXTURE_INTENSITY) +
            (hair - 0.5) * 0.16 * CLOTH_HAIR_INTENSITY,
          0,
          1
        );
        const highlightMix = THREE.MathUtils.clamp(
          0.34 +
            (cross - 0.5) * 0.44 * CLOTH_TEXTURE_INTENSITY +
            (diamond - 0.5) * 0.66 * CLOTH_TEXTURE_INTENSITY +
            (sparkle - 0.5) * 0.38 * CLOTH_TEXTURE_INTENSITY +
            (hair - 0.5) * 0.22 * CLOTH_HAIR_INTENSITY,
          0,
          1
        );
        const accentMix = THREE.MathUtils.clamp(
          0.48 +
            (diamond - 0.5) * 1.12 * CLOTH_TEXTURE_INTENSITY +
            (fuzz - 0.5) * 0.3 * CLOTH_TEXTURE_INTENSITY +
            (hair - 0.5) * 0.26 * CLOTH_HAIR_INTENSITY,
          0,
          1
        );
        const highlightEnhanced = THREE.MathUtils.clamp(
          0.38 +
            (highlightMix - 0.5) * (1 + (1.68 - 1) * CLOTH_TEXTURE_INTENSITY) +
            (hair - 0.5) * 0.18 * CLOTH_HAIR_INTENSITY,
          0,
          1
        );
        const baseR = shadow.r + (base.r - shadow.r) * tonalEnhanced;
        const baseG = shadow.g + (base.g - shadow.g) * tonalEnhanced;
        const baseB = shadow.b + (base.b - shadow.b) * tonalEnhanced;
        const accentR = baseR + (accent.r - baseR) * accentMix;
        const accentG = baseG + (accent.g - baseG) * accentMix;
        const accentB = baseB + (accent.b - baseB) * accentMix;
        const r = accentR + (highlight.r - accentR) * highlightEnhanced;
        const g = accentG + (highlight.g - accentG) * highlightEnhanced;
        const b = accentB + (highlight.b - accentB) * highlightEnhanced;
        const softR = baseR + (r - baseR) * CLOTH_SOFT_BLEND;
        const softG = baseG + (g - baseG) * CLOTH_SOFT_BLEND;
        const softB = baseB + (b - baseB) * CLOTH_SOFT_BLEND;
        const i = (y * SIZE + x) * 4;
        data[i + 0] = clamp255(softR);
        data[i + 1] = clamp255(softG);
        data[i + 2] = clamp255(softB);
        data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);

    const colorMap = new THREE.CanvasTexture(canvas);
    colorMap.wrapS = colorMap.wrapT = THREE.RepeatWrapping;
    colorMap.repeat.set(16, 64);
    colorMap.anisotropy = 64;
    colorMap.generateMipmaps = true;
    colorMap.minFilter = THREE.LinearMipmapLinearFilter;
    colorMap.magFilter = THREE.LinearFilter;
    applySRGBColorSpace(colorMap);
    colorMap.needsUpdate = true;

    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = bumpCanvas.height = SIZE;
    const bumpCtx = bumpCanvas.getContext('2d');
    if (!bumpCtx) {
      cache = { map: colorMap, bump: null };
      return cache;
    }
    const bumpImage = bumpCtx.createImageData(SIZE, SIZE);
    const bumpData = bumpImage.data;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const u = ((x * COS + y * SIN) / THREAD_PITCH) * TAU;
        const v = ((x * COS - y * SIN) / THREAD_PITCH) * TAU;
        const warp = 0.5 + 0.5 * Math.cos(u);
        const weft = 0.5 + 0.5 * Math.cos(v);
        const weave = Math.pow((warp + weft) * 0.5, 1.58);
        const cross = Math.pow(warp * weft, 0.94);
        const diamond = Math.pow(Math.abs(Math.sin(u) * Math.sin(v)), 0.68);
        const fiber = fiberNoise(x, y);
        const micro = microNoise(x + 31.8, y + 17.3);
        const fuzz = Math.pow(fiber, 1.22);
        const hair = hairFiber(x, y);
        const bump = THREE.MathUtils.clamp(
          0.56 +
            (weave - 0.5) * 0.9 * CLOTH_BUMP_INTENSITY +
            (cross - 0.5) * 0.46 * CLOTH_BUMP_INTENSITY +
            (diamond - 0.5) * 0.58 * CLOTH_BUMP_INTENSITY +
            (fiber - 0.5) * 0.36 * CLOTH_BUMP_INTENSITY +
            (fuzz - 0.5) * 0.24 * CLOTH_BUMP_INTENSITY +
            (micro - 0.5) * 0.26 * CLOTH_BUMP_INTENSITY +
            (hair - 0.5) * 0.4 * CLOTH_HAIR_INTENSITY,
          0,
          1
        );
        const value = clamp255(140 + (bump - 0.5) * 180 + (hair - 0.5) * 36);
        const i = (y * SIZE + x) * 4;
        bumpData[i + 0] = value;
        bumpData[i + 1] = value;
        bumpData[i + 2] = value;
        bumpData[i + 3] = 255;
      }
    }
    bumpCtx.putImageData(bumpImage, 0, 0);

    const bumpMap = new THREE.CanvasTexture(bumpCanvas);
    bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
    bumpMap.repeat.copy(colorMap.repeat);
    bumpMap.anisotropy = colorMap.anisotropy;
    bumpMap.generateMipmaps = true;
    bumpMap.minFilter = THREE.LinearMipmapLinearFilter;
    bumpMap.magFilter = THREE.LinearFilter;

    cache = { map: colorMap, bump: bumpMap };
    return cache;
  };
})();

function applyCueWoodGloss(material) {
  if (!material) return;
  const ensure = (key, value) => {
    if (typeof material[key] === 'number') {
      material[key] = value;
    } else {
      material[key] = value;
    }
  };
  ensure('metalness', 0.22);
  ensure('roughness', 0.22);
  ensure('clearcoat', 0.85);
  ensure('clearcoatRoughness', 0.08);
  ensure('sheen', 0.32);
  ensure('sheenRoughness', 0.36);
  ensure('envMapIntensity', 1.55);
  ensure('reflectivity', 0.92);
  material.needsUpdate = true;
}

function resolveRepeatVector(settings, material) {
  if (!settings) {
    const stored = material?.userData?.woodRepeat;
    if (stored?.isVector2) return stored.clone();
    if (stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)) {
      return new THREE.Vector2(stored.x, stored.y);
    }
    return CUE_WOOD_REPEAT.clone().multiplyScalar(TABLE_WOOD_TEXTURE_SCALE);
  }
  const value = settings?.repeat ?? settings;
  if (value?.isVector2) {
    return value.clone();
  }
  if (value && Number.isFinite(value.x) && Number.isFinite(value.y)) {
    return new THREE.Vector2(value.x, value.y);
  }
  const stored = material?.userData?.woodRepeat;
  if (stored?.isVector2) return stored.clone();
  if (stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)) {
    return new THREE.Vector2(stored.x, stored.y);
  }
  return CUE_WOOD_REPEAT.clone().multiplyScalar(TABLE_WOOD_TEXTURE_SCALE);
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
  const fallback = WOOD_PRESETS_BY_ID[DEFAULT_WOOD_PRESET_ID];
  if (!fallback) return null;
  const repeatVec =
    targetSettings?.repeat ??
    CUE_WOOD_REPEAT.clone().multiplyScalar(TABLE_WOOD_TEXTURE_SCALE);
  const rotation = targetSettings?.rotation ?? 0;
  const textureSize = targetSettings?.textureSize ?? DEFAULT_WOOD_TEXTURE_SIZE;
  applyWoodTextures(material, {
    hue: fallback.hue,
    sat: fallback.sat,
    light: fallback.light,
    contrast: fallback.contrast,
    repeat: { x: repeatVec.x, y: repeatVec.y },
    rotation,
    textureSize,
    sharedKey: `snooker-wood-${fallback.id}`,
    ...SNOOKER_WOOD_SURFACE_PROPS
  });
  return material.userData?.__woodOptions || null;
}

function applyWoodTextureToMaterial(material, repeat) {
  if (!material) return;
  const repeatVec = resolveRepeatVector(repeat, material);
  const rotation = resolveRotation(repeat, material);
  const textureSize = resolveTextureSize(repeat, material);
  const hadOptions = Boolean(material.userData?.__woodOptions);
  const options = ensureMaterialWoodOptions(material, {
    repeat: repeatVec,
    rotation,
    textureSize
  });
  if (options) {
    const repeatChanged =
      Math.abs((options.repeat?.x ?? 1) - repeatVec.x) > 1e-6 ||
      Math.abs((options.repeat?.y ?? 1) - repeatVec.y) > 1e-6;
    const rotationChanged =
      Math.abs((options.rotation ?? 0) - rotation) > 1e-6;
    const textureSizeChanged =
      typeof textureSize === 'number' &&
      Math.abs((options.textureSize ?? DEFAULT_WOOD_TEXTURE_SIZE) - textureSize) > 1e-6;
    if (hadOptions && (repeatChanged || rotationChanged || textureSizeChanged)) {
      applyWoodTextures(material, {
        ...options,
        repeat: { x: repeatVec.x, y: repeatVec.y },
        rotation,
        textureSize: textureSize ?? options.textureSize
      });
    }
  } else {
    if (material.map) {
      material.map = material.map.clone();
      material.map.repeat.copy(repeatVec);
      material.map.center.set(0.5, 0.5);
      material.map.rotation = rotation;
      material.map.needsUpdate = true;
    }
    if (material.roughnessMap) {
      material.roughnessMap = material.roughnessMap.clone();
      material.roughnessMap.repeat.copy(repeatVec);
      material.roughnessMap.center.set(0.5, 0.5);
      material.roughnessMap.rotation = rotation;
      material.roughnessMap.needsUpdate = true;
    }
    material.needsUpdate = true;
  }
  material.userData = material.userData || {};
  if (material.userData.woodRepeat?.isVector2) {
    material.userData.woodRepeat.copy(repeatVec);
  } else {
    material.userData.woodRepeat = repeatVec.clone();
  }
  material.userData.woodRotation = rotation;
  if (typeof textureSize === 'number') {
    material.userData.woodTextureSize = textureSize;
  }
  applyCueWoodGloss(material);
}

function toPlainWoodSurfaceConfig(settings) {
  if (!settings) {
    return null;
  }
  const repeatSource = settings.repeat ?? settings;
  let repeatX = null;
  let repeatY = null;
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
  return {
    repeat: {
      x: Number.isFinite(repeatX) ? repeatX : 1,
      y: Number.isFinite(repeatY) ? repeatY : 1
    },
    rotation,
    textureSize
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
    textureSize: resolvedOption?.textureSize ?? base.textureSize
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
      typeof config.textureSize === 'number' ? config.textureSize : undefined
  };
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
  ensure('metalness', 0.88, (current, target) => Math.max(current, target));
  ensure('roughness', 0.18, (current, target) => Math.min(current, target));
  ensure('clearcoat', 0.5, (current, target) => Math.max(current, target));
  ensure('clearcoatRoughness', 0.12, (current, target) => Math.min(current, target));
  ensure('envMapIntensity', 1.45, (current, target) => Math.max(current, target));
  if ('reflectivity' in material) {
    material.reflectivity = Math.max(0.7, material.reflectivity ?? 0.7);
  }
  if ('specularIntensity' in material) {
    material.specularIntensity = Math.max(1.05, material.specularIntensity ?? 1.05);
  }
  material.needsUpdate = true;
}

function softenOuterExtrudeEdges(geometry, depth, radiusRatio = 0.25) {
  if (!geometry || typeof depth !== 'number' || depth <= 0) return geometry;
  const target = geometry.toNonIndexed ? geometry.toNonIndexed() : geometry;
  const position = target.attributes.position;
  const normal = target.attributes.normal;
  if (!position || !normal) return target;
  const depthSafe = depth <= 0 ? 1 : depth;
  const radius = Math.max(0, depthSafe * radiusRatio);
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

const createCarpetTextures = (() => {
  let cache = null;
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const prng = (seed) => {
    let value = seed;
    return () => {
      value = (value * 1664525 + 1013904223) % 4294967296;
      return value / 4294967296;
    };
  };
  const drawRoundedRect = (ctx, x, y, w, h, r) => {
    const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  };
  return () => {
    if (cache) return cache;
    if (typeof document === 'undefined') {
      cache = { map: null, bump: null };
      return cache;
    }

    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');

    // rich crimson textile base to restore the original lounge character
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#7c242f');
    gradient.addColorStop(1, '#9d3642');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const rand = prng(987654321);
    const image = ctx.getImageData(0, 0, size, size);
    const data = image.data;
    const baseColor = { r: 112, g: 28, b: 34 };
    const highlightColor = { r: 196, g: 72, b: 82 };
    const toChannel = (component) =>
      Math.round(clamp01(component / 255) * 255);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const fiber = (Math.sin((x / size) * Math.PI * 14) +
          Math.cos((y / size) * Math.PI * 16)) * 0.08;
        const grain = (rand() - 0.5) * 0.12;
        const shade = clamp01(0.55 + fiber * 0.75 + grain * 0.6);
        const r =
          baseColor.r + (highlightColor.r - baseColor.r) * shade;
        const g =
          baseColor.g + (highlightColor.g - baseColor.g) * shade;
        const b =
          baseColor.b + (highlightColor.b - baseColor.b) * shade;
        data[idx] = toChannel(r);
        data[idx + 1] = toChannel(g);
        data[idx + 2] = toChannel(b);
      }
    }
    ctx.putImageData(image, 0, 0);

    // subtle horizontal ribbing for textile feel
    ctx.globalAlpha = 0.04;
    ctx.fillStyle = '#4f1119';
    for (let row = 0; row < size; row += 3) {
      ctx.fillRect(0, row, size, 1);
    }
    ctx.globalAlpha = 1;

    // thin continuous pale stripe with rounded corners
    const insetRatio = 0.055;
    const stripeInset = size * insetRatio;
    const stripeRadius = size * 0.08;
    const stripeWidth = size * 0.012;
    ctx.lineWidth = stripeWidth;
    ctx.strokeStyle = '#f2b7b4';
    ctx.shadowColor = 'rgba(80,20,30,0.18)';
    ctx.shadowBlur = stripeWidth * 0.8;
    drawRoundedRect(
      ctx,
      stripeInset,
      stripeInset,
      size - stripeInset * 2,
      size - stripeInset * 2,
      stripeRadius
    );
    ctx.stroke();
    ctx.shadowBlur = 0;

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = 8;
    texture.minFilter = THREE.LinearMipMapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    applySRGBColorSpace(texture);

    // bump map: derive from red base with extra fiber noise
    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = bumpCanvas.height = size;
    const bumpCtx = bumpCanvas.getContext('2d');
    bumpCtx.drawImage(canvas, 0, 0);
    const bumpImage = bumpCtx.getImageData(0, 0, size, size);
    const bumpData = bumpImage.data;
    const bumpRand = prng(246813579);
    for (let i = 0; i < bumpData.length; i += 4) {
      const r = bumpData[i];
      const g = bumpData[i + 1];
      const b = bumpData[i + 2];
      const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
      const noise = (bumpRand() - 0.5) * 0.16;
      const v = clamp01(0.62 + lum * 0.28 + noise);
      const value = Math.floor(v * 255);
      bumpData[i] = bumpData[i + 1] = bumpData[i + 2] = value;
    }
    bumpCtx.putImageData(bumpImage, 0, 0);

    const bump = new THREE.CanvasTexture(bumpCanvas);
    bump.wrapS = bump.wrapT = THREE.ClampToEdgeWrapping;
    bump.anisotropy = 6;
    bump.minFilter = THREE.LinearMipMapLinearFilter;
    bump.magFilter = THREE.LinearFilter;
    bump.generateMipmaps = true;

    cache = { map: texture, bump };
    return cache;
  };
})();

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

  const createShortRailUnit = (zSign) => {
    const direction = Math.sign(zSign) || 1;
    const base = new THREE.Group();
    base.position.set(0, floorY, direction * cameraCenterZOffset);
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

    const headPivot = new THREE.Group();
    headPivot.position.y = headHeight + 0.02;
    slider.add(headPivot);

    const cameraAssembly = new THREE.Group();
    headPivot.add(cameraAssembly);

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
    'applySnookerScaling: table aspect ratio must remain 3569:1778.'
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
    pockets.forEach((pocket) => {
      if (pocket?.userData) {
        pocket.userData.captureRadius = POCKET_R;
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
    const expectedRadius = BALL_D_REF * mmToUnits * 0.5;
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

// Kamera: ruaj kënd komod që mos shtrihet poshtë cloth-it, por lejo pak më shumë lartësi kur ngrihet
const STANDING_VIEW_PHI = 0.95; // lower the standing orbit closer to the cloth while keeping clearance
const CUE_SHOT_PHI = Math.PI / 2 - 0.26;
const STANDING_VIEW_MARGIN = 0.0018;
const STANDING_VIEW_FOV = 66;
const CAMERA_ABS_MIN_PHI = 0.22;
const CAMERA_MIN_PHI = Math.max(CAMERA_ABS_MIN_PHI, STANDING_VIEW_PHI - 0.48);
const CAMERA_MAX_PHI = CUE_SHOT_PHI - 0.14; // allow a lower sweep so the player camera sits nearer the rail
// Bring the cue camera in closer so the player view sits right against the rail on portrait screens.
const PLAYER_CAMERA_DISTANCE_FACTOR = 0.015; // pull the orbit camera closer to the rail without clipping
const BROADCAST_RADIUS_LIMIT_MULTIPLIER = 1.14;
// Bring the standing/broadcast framing closer to the cloth so the table feels less distant while matching the rail proximity of the pocket cams
const BROADCAST_DISTANCE_MULTIPLIER = 0.06;
// Allow portrait/landscape standing camera framing to pull in closer without clipping the table
const STANDING_VIEW_MARGIN_LANDSCAPE = 1.0018;
const STANDING_VIEW_MARGIN_PORTRAIT = 1.0014;
const BROADCAST_RADIUS_PADDING = TABLE.THICK * 0.02;
const BROADCAST_MARGIN_WIDTH = BALL_R * 10;
const BROADCAST_MARGIN_LENGTH = BALL_R * 10;
const CAMERA_ZOOM_PROFILES = Object.freeze({
  default: Object.freeze({ cue: 0.96, broadcast: 0.98, margin: 0.99 }),
  nearLandscape: Object.freeze({ cue: 0.94, broadcast: 0.97, margin: 0.99 }),
  portrait: Object.freeze({ cue: 0.92, broadcast: 0.95, margin: 0.98 }),
  ultraPortrait: Object.freeze({ cue: 0.9, broadcast: 0.94, margin: 0.97 })
});
const resolveCameraZoomProfile = (aspect) => {
  if (!Number.isFinite(aspect)) {
    return CAMERA_ZOOM_PROFILES.default;
  }
  if (aspect <= 0.7) {
    return CAMERA_ZOOM_PROFILES.ultraPortrait;
  }
  if (aspect <= 0.85) {
    return CAMERA_ZOOM_PROFILES.portrait;
  }
  if (aspect < 1.1) {
    return CAMERA_ZOOM_PROFILES.nearLandscape;
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
const CAMERA_AIM_LINE_MARGIN = BALL_R * 0.075; // match Pool Royale aim-line headroom
const CAMERA_SURFACE_STOP_MARGIN = BALL_R * 0.9;
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
const CUE_VIEW_RADIUS_RATIO = 0.04;
const CUE_VIEW_MIN_RADIUS = CAMERA.minR * 0.16;
const CUE_VIEW_MIN_PHI = Math.min(
  CAMERA.maxPhi - CAMERA_RAIL_SAFETY,
  STANDING_VIEW_PHI + 0.1
);
const CUE_VIEW_PHI_LIFT = 0.11;
const CUE_VIEW_TARGET_PHI = CUE_VIEW_MIN_PHI + CUE_VIEW_PHI_LIFT * 0.5;
const CAMERA_RAIL_APPROACH_PHI = Math.min(
  STANDING_VIEW_PHI + 0.32,
  CAMERA_MAX_PHI - 0.02
); // ensure rail clamp activates within the lowered camera tilt limit
const CAMERA_MIN_HORIZONTAL =
  ((Math.max(PLAY_W, PLAY_H) / 2 + SIDE_RAIL_INNER_THICKNESS) * WORLD_SCALE) +
  CAMERA_RAIL_SAFETY;
const CAMERA_DOWNWARD_PULL = 1.9;
const CAMERA_DYNAMIC_PULL_RANGE = CAMERA.minR * 0.29;
const IN_HAND_CAMERA_PULLBACK = 1.38;
const TOP_VIEW_MARGIN = 0.54; // scaled to the snooker footprint so the overhead view hugs the rails
const TOP_VIEW_RADIUS_SCALE = 0.44;
const TOP_VIEW_MIN_RADIUS_SCALE = 0.92;
const TOP_VIEW_PHI = Math.max(CAMERA_ABS_MIN_PHI + 0.04, CAMERA.minPhi * 0.64);
const CAMERA_TILT_ZOOM = BALL_R * 1.5;
const CUE_VIEW_AIM_SLOW_FACTOR = 0.35; // slow pointer rotation while blended toward cue view for finer aiming
const POCKET_VIEW_SMOOTH_TIME = 0.24; // seconds to ease pocket camera transitions
const POCKET_CAMERA_FOV = STANDING_VIEW_FOV;
const LONG_SHOT_DISTANCE = PLAY_H * 0.5;
const LONG_SHOT_ACTIVATION_DELAY_MS = 220;
const LONG_SHOT_ACTIVATION_TRAVEL = PLAY_H * 0.28;
const LONG_SHOT_SPEED_SWITCH_THRESHOLD =
  SHOT_BASE_SPEED * 0.82; // skip long-shot cam switch if cue ball launches faster
const LONG_SHOT_SHORT_RAIL_OFFSET = BALL_R * 18;
const RAIL_NEAR_BUFFER = BALL_R * 3.5;
const SHORT_SHOT_CAMERA_DISTANCE = BALL_R * 24; // keep camera in standing view for close shots
const AI_EARLY_SHOT_DIFFICULTY = 120;
const AI_EARLY_SHOT_CUE_DISTANCE = PLAY_H * 0.55;
const AI_EARLY_SHOT_DELAY_MS = 3500;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const signed = (value, fallback = 1) =>
  value > 0 ? 1 : value < 0 ? -1 : fallback;
const computeStandingViewHeight = (
  targetHeight,
  horizontalDistance,
  minHeight = TABLE_Y + TABLE.THICK
) => {
  if (!Number.isFinite(horizontalDistance) || horizontalDistance <= 0) {
    return Math.max(minHeight, targetHeight);
  }
  const lift = horizontalDistance * STANDING_VIEW_COT;
  const desiredHeight = targetHeight + lift;
  return Math.max(minHeight, desiredHeight);
};
const applyStandingViewElevation = (
  desired,
  focus,
  minHeight = TABLE_Y + TABLE.THICK
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
    minHeight
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
  // Keep a little more distance so rails remain visible while fitting the table
  const r = Math.max(dzH, dzW) * 0.58 * GLOBAL_SIZE_FACTOR;
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
  const verticalFov = THREE.MathUtils.degToRad(camera.fov || STANDING_VIEW_FOV);
  const aspect = camera.aspect || 1;
  const halfVertical = Math.max(verticalFov / 2, 1e-3);
  const halfHorizontal = Math.max(
    Math.atan(Math.tan(halfVertical) * aspect),
    1e-3
  );
  const halfWidth = PLAY_W / 2 + BROADCAST_MARGIN_WIDTH;
  const halfLength = PLAY_H / 2 + BROADCAST_MARGIN_LENGTH;
  const widthDistance = halfWidth / Math.tan(halfHorizontal);
  const lengthDistance = halfLength / Math.tan(halfVertical);
  const required = Math.max(widthDistance, lengthDistance);
  return Math.max(SHORT_RAIL_CAMERA_DISTANCE, required);
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

const pocketCenters = () => [
  new THREE.Vector2(
    -PLAY_W / 2 + CORNER_POCKET_CENTER_INSET,
    -PLAY_H / 2 + CORNER_POCKET_CENTER_INSET
  ),
  new THREE.Vector2(
    PLAY_W / 2 - CORNER_POCKET_CENTER_INSET,
    -PLAY_H / 2 + CORNER_POCKET_CENTER_INSET
  ),
  new THREE.Vector2(
    -PLAY_W / 2 + CORNER_POCKET_CENTER_INSET,
    PLAY_H / 2 - CORNER_POCKET_CENTER_INSET
  ),
  new THREE.Vector2(
    PLAY_W / 2 - CORNER_POCKET_CENTER_INSET,
    PLAY_H / 2 - CORNER_POCKET_CENTER_INSET
  ),
  new THREE.Vector2(
    -PLAY_W / 2 + MIDDLE_POCKET_LATERAL_INSET,
    -MIDDLE_POCKET_LONGITUDINAL_OFFSET
  ),
  new THREE.Vector2(
    PLAY_W / 2 - MIDDLE_POCKET_LATERAL_INSET,
    MIDDLE_POCKET_LONGITUDINAL_OFFSET
  )
];
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
      return new THREE.Vector2(-PLAY_W / 2, -PLAY_H / 2);
    case 'TR':
      return new THREE.Vector2(PLAY_W / 2, -PLAY_H / 2);
    case 'BL':
      return new THREE.Vector2(-PLAY_W / 2, PLAY_H / 2);
    case 'BR':
      return new THREE.Vector2(PLAY_W / 2, PLAY_H / 2);
    case 'TM':
      return new THREE.Vector2(-PLAY_W / 2, 0);
    case 'BM':
      return new THREE.Vector2(PLAY_W / 2, 0);
    default:
      return null;
  }
};
const POCKET_CAMERA_IDS = ['TL', 'TR', 'BL', 'BR'];
const POCKET_CAMERA_OUTWARD = Object.freeze({
  TL: new THREE.Vector2(-1, -1).normalize(),
  TR: new THREE.Vector2(1, -1).normalize(),
  BL: new THREE.Vector2(-1, 1).normalize(),
  BR: new THREE.Vector2(1, 1).normalize()
});
const getPocketCameraOutward = (id) =>
  POCKET_CAMERA_OUTWARD[id] ? POCKET_CAMERA_OUTWARD[id].clone() : null;
const SIDE_POCKET_SWITCH_THRESHOLD = BALL_R * 12;
const oppositeShortRailAnchor = (id) => {
  switch (id) {
    case 'TL':
      return 'BL';
    case 'BL':
      return 'TL';
    case 'TR':
      return 'BR';
    case 'BR':
      return 'TR';
    default:
      return id;
  }
};
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

  const threadStep = 4; // emphasise the primary warp/weft directions
  ctx.lineWidth = 0.7;
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

  const weaveSpacing = 2;
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  for (let y = 0; y < size; y += weaveSpacing) {
    const offset = (y / weaveSpacing) % 2 === 0 ? 0 : weaveSpacing * 0.5;
    for (let x = 0; x < size; x += weaveSpacing) {
      ctx.fillRect(x + offset, y, 0.7, 1);
    }
  }
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let x = 0; x < size; x += weaveSpacing) {
    const offset = (x / weaveSpacing) % 2 === 0 ? 0 : weaveSpacing * 0.5;
    for (let y = 0; y < size; y += weaveSpacing) {
      ctx.fillRect(x, y + offset, 1, 0.7);
    }
  }

  ctx.lineWidth = 0.35;
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  for (let i = 0; i < 180000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const horizontal = Math.random() > 0.5;
    const length = Math.random() * 0.6 + 0.25;
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

  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  for (let i = 0; i < 120000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const horizontal = Math.random() > 0.5;
    const length = Math.random() * 0.5 + 0.15;
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

  ctx.globalAlpha = 0.2;
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  for (let i = 0; i < 48000; i++) {
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
  const rad = THREE.MathUtils.degToRad(CUSHION_CUT_ANGLE);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const pocketGuard = POCKET_VIS_R * 0.85 * POCKET_VISUAL_EXPANSION;
  const cornerDepthLimit = POCKET_VIS_R * 1.45 * POCKET_VISUAL_EXPANSION;
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
      const restitution = CUSHION_RESTITUTION;
      ball.vel.addScaledVector(TMP_VEC2_B, -(1 + restitution) * vn);
      // No tangential damping: preserve the tangential component.
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
  if (collided) {
    const stamp =
      typeof performance !== 'undefined' && performance.now
        ? performance.now()
        : Date.now();
    ball.lastRailHitAt = stamp;
    ball.lastRailHitType = collided;
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
  if (!cue) {
    return {
      impact: new THREE.Vector2(),
      afterDir: null,
      targetBall: null,
      railNormal: null,
      tHit: 0
    };
  }
  const cuePos = cue.pos.clone();
  if (!dir || dir.lengthSq() < 1e-8) {
    return {
      impact: cuePos.clone(),
      afterDir: null,
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

  const diam = BALL_R * 2;
  const diam2 = diam * diam;
  const ballList = Array.isArray(balls) ? balls : [];
  ballList.forEach((b) => {
    if (!b.active || b === cue) return;
    const v = b.pos.clone().sub(cuePos);
    const proj = v.dot(dirNorm);
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

  const fallbackDistance = Math.sqrt(PLAY_W * PLAY_W + PLAY_H * PLAY_H);
  let travel = Number.isFinite(tHit) ? tHit : fallbackDistance;
  if (travel <= 0) {
    travel = fallbackDistance;
  }
  const impact = cuePos.clone().add(dirNorm.clone().multiplyScalar(travel));
  let afterDir = null;
  if (targetBall) {
    afterDir = targetBall.pos.clone().sub(impact).normalize();
  } else if (railNormal) {
    const n = railNormal.clone().normalize();
    afterDir = dirNorm
      .clone()
      .sub(n.clone().multiplyScalar(2 * dirNorm.dot(n)))
      .normalize();
  }
  return { impact, afterDir, targetBall, railNormal, tHit: travel };
}

// --------------------------------------------------
// ONLY kept component: Guret (balls factory)
// --------------------------------------------------
function Guret(parent, id, color, x, y) {
  const material = getBilliardBallMaterial({
    color,
    pattern: 'solid',
    number: null,
    variantKey: 'snooker'
  });
  const mesh = new THREE.Mesh(BALL_GEOMETRY, material);
  mesh.position.set(x, BALL_CENTER_Y, y);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (id === 'cue') {
    const markerGeom = new THREE.CylinderGeometry(
      CUE_MARKER_RADIUS,
      CUE_MARKER_RADIUS,
      CUE_MARKER_DEPTH,
      48
    );
    const markerMat = new THREE.MeshStandardMaterial({
      color: 0xff2f2f,
      emissive: 0x550000,
      emissiveIntensity: 0.4,
      roughness: 0.25,
      metalness: 0.08
    });
    markerMat.depthWrite = false;
    markerMat.needsUpdate = true;
    markerMat.toneMapped = false;
    markerMat.polygonOffset = true;
    markerMat.polygonOffsetFactor = -0.5;
    markerMat.polygonOffsetUnits = -0.5;
    const markerOffset = BALL_R - CUE_MARKER_DEPTH * 0.5 + 0.001;
    const localUp = new THREE.Vector3(0, 1, 0);
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
      marker.quaternion.setFromUnitVectors(localUp, normal);
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

const toBallColorId = (id) => {
  if (!id) return null;
  if (id === 'cue' || id === 'CUE') return 'CUE';
  if (typeof id === 'string' && id.toLowerCase().startsWith('red')) return 'RED';
  return typeof id === 'string' ? id.toUpperCase() : null;
};

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
    curveSegments: 48
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
  finish = TABLE_FINISHES[DEFAULT_TABLE_FINISH_ID]
) {
  const table = new THREE.Group();
  table.userData = table.userData || {};
  table.userData.cushions = [];

  const finishParts = {
    frameMeshes: [],
    legMeshes: [],
    railMeshes: [],
    trimMeshes: [],
    pocketJawMeshes: [],
    pocketRimMeshes: [],
    accentParent: null,
    accentMesh: null,
    dimensions: null,
    woodSurfaces: { frame: null, rail: null },
    woodTextureId: null
  };

  const halfW = PLAY_W / 2;
  const halfH = PLAY_H / 2;
  const baulkLineZ = -PLAY_H / 2 + BAULK_FROM_BAULK;
  const frameTopY = FRAME_TOP_Y;
  const clothPlaneLocal = CLOTH_TOP_LOCAL + CLOTH_LIFT;

  const resolvedFinish =
    (finish && typeof finish === 'object')
      ? finish
      : (typeof finish === 'string' && TABLE_FINISHES[finish]) ||
        (finish?.id && TABLE_FINISHES[finish.id]) ||
        TABLE_FINISHES[DEFAULT_TABLE_FINISH_ID];
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
      const baseFallback = TABLE_FINISHES[DEFAULT_TABLE_FINISH_ID].createMaterials();
      fallbackMaterials = { ...baseFallback };
    }
    if (key === 'pocketJaw' && !fallbackMaterials.pocketJaw) {
      fallbackMaterials.pocketJaw = createDefaultPocketJawMaterial();
    }
    return fallbackMaterials[key];
  };
  const frameMat = rawMaterials.frame ?? getFallbackMaterial('frame');
  const railMat = rawMaterials.rail ?? getFallbackMaterial('rail');
  const legMat = rawMaterials.leg ?? frameMat;
  const trimMat = rawMaterials.trim ?? getFallbackMaterial('trim');
  const pocketJawMat =
    rawMaterials.pocketJaw ?? getFallbackMaterial('pocketJaw') ?? createDefaultPocketJawMaterial();
  const accentConfig = rawMaterials.accent ?? null;
  frameMat.needsUpdate = true;
  railMat.needsUpdate = true;
  legMat.needsUpdate = true;
  trimMat.needsUpdate = true;
  pocketJawMat.needsUpdate = true;
  enhanceChromeMaterial(trimMat);
  if (accentConfig?.material) {
    accentConfig.material.needsUpdate = true;
  }

  const { map: clothMap, bump: clothBump } = createClothTextures();
  const clothPrimary = new THREE.Color(palette.cloth);
  const clothHighlight = new THREE.Color(0xffffff);
  const clothColor = clothPrimary.clone().lerp(clothHighlight, 0.24);
  const sheenColor = clothColor.clone().lerp(clothHighlight, 0.16);
  const clothMat = new THREE.MeshPhysicalMaterial({
    color: clothColor,
    roughness: 0.82,
    sheen: 0.92,
    sheenColor,
    sheenRoughness: 0.52,
    clearcoat: 0.015,
    clearcoatRoughness: 0.62,
    envMapIntensity: 0.18,
    emissive: clothColor.clone().multiplyScalar(0.08),
    emissiveIntensity: 0.58
  });
  const ballDiameter = BALL_R * 2;
  const ballsAcrossWidth = PLAY_W / ballDiameter;
  const threadsPerBallTarget = 10; // tighten the weave slightly while keeping detail visible
  const clothTextureScale = 0.032 * 1.35 * 0.85 * 3; // make the cloth weave 3x smaller for finer pattern detail
  const baseRepeat =
    ((threadsPerBallTarget * ballsAcrossWidth) / CLOTH_THREADS_PER_TILE) *
    clothTextureScale;
  const repeatRatio = 3.25;
  const baseBumpScale = 0.64 * 1.35;
  if (clothMap) {
    clothMat.map = clothMap;
    clothMat.map.repeat.set(baseRepeat, baseRepeat * repeatRatio);
    clothMat.map.needsUpdate = true;
  }
  if (clothBump) {
    clothMat.bumpMap = clothBump;
    clothMat.bumpMap.repeat.set(baseRepeat, baseRepeat * repeatRatio);
    clothMat.bumpScale = baseBumpScale;
    clothMat.bumpMap.needsUpdate = true;
  } else {
    clothMat.bumpScale = baseBumpScale;
  }
  clothMat.userData = {
    ...(clothMat.userData || {}),
    baseRepeat,
    repeatRatio,
    nearRepeat: baseRepeat * 1.18,
    farRepeat: baseRepeat * 0.5,
    bumpScale: clothMat.bumpScale,
    baseBumpScale: clothMat.bumpScale
  };

  const cushionMat = clothMat.clone();
  const clothBaseSettings = {
    roughness: clothMat.roughness,
    sheen: clothMat.sheen,
    sheenRoughness: clothMat.sheenRoughness,
    clearcoat: clothMat.clearcoat,
    clearcoatRoughness: clothMat.clearcoatRoughness,
    envMapIntensity: clothMat.envMapIntensity,
    emissiveIntensity: clothMat.emissiveIntensity,
    bumpScale: clothMat.bumpScale
  };
  const clothMaterials = [clothMat, cushionMat];
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
  const finishInfo = {
    id: resolvedFinish?.id ?? DEFAULT_TABLE_FINISH_ID,
    palette,
    materials: {
      frame: frameMat,
      rail: railMat,
      leg: legMat,
      trim: trimMat,
      pocketJaw: pocketJawMat,
      accent: accentConfig
    },
    clothMat,
    cushionMat,
    parts: finishParts,
    clothDetail: resolvedFinish?.clothDetail ?? null,
    clothBase: clothBaseSettings,
    applyClothDetail,
    woodTextureId: finishParts.woodTextureId
  };

  const clothExtendBase = Math.max(
    SIDE_RAIL_INNER_THICKNESS * 0.34,
    Math.min(PLAY_W, PLAY_H) * 0.009
  );
  const clothExtend =
    clothExtendBase +
    Math.min(PLAY_W, PLAY_H) * 0.0032; // extend the cloth slightly more so rails meet the cloth with no gaps
  const halfWext = halfW + clothExtend;
  const halfHext = halfH + clothExtend;
  const pocketPositions = pocketCenters();
  const sideRadiusScale =
    POCKET_VIS_R > MICRO_EPS ? SIDE_POCKET_RADIUS / POCKET_VIS_R : 1;
  const buildSurfaceShape = (holeRadius, edgeInset = 0) => {
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

    const createPocketSector = (center, sweep, radius, segments) => {
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
      const ring = [];
      ring.push([center.x, center.y]);
      for (let i = 0; i <= steps; i++) {
        const t = start + ((end - start) * i) / steps;
        const px = center.x + Math.cos(t) * radius;
        const py = center.y + Math.sin(t) * radius;
        ring.push([px, py]);
      }
      ring.push([center.x, center.y]);
      if (ring.length < 4) {
        return null;
      }
      const area = signedRingArea(ring);
      if (area < 0) {
        ring.reverse();
      }
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        ring.push([first[0], first[1]]);
      }
      return [[ring]];
    };

    const pocketSectors = pocketPositions
      .map((center, index) => {
        const isSidePocket = index >= 4;
        const radius = isSidePocket
          ? holeRadius * sideRadiusScale
          : holeRadius;
        const sweep = isSidePocket ? Math.PI : Math.PI / 2;
        const baseSegments = isSidePocket ? 64 : 48;
        return createPocketSector(center, sweep, radius, baseSegments);
      })
      .filter(Boolean);

    let shapeMP = baseMP;
    if (pocketSectors.length) {
      shapeMP = polygonClipping.difference(baseMP, ...pocketSectors);
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
    return fallback;
  };

  const clothShape = buildSurfaceShape(POCKET_HOLE_R);
  const clothGeo = new THREE.ExtrudeGeometry(clothShape, {
    depth: CLOTH_THICKNESS,
    bevelEnabled: false,
    curveSegments: 64,
    steps: 1
  });
  clothGeo.translate(0, 0, -CLOTH_THICKNESS);
  const cloth = new THREE.Mesh(clothGeo, clothMat);
  cloth.rotation.x = -Math.PI / 2;
  cloth.position.y = clothPlaneLocal - CLOTH_DROP;
  cloth.renderOrder = 3;
  cloth.receiveShadow = true;
  table.add(cloth);

  const underlayShape = buildSurfaceShape(
    POCKET_HOLE_R * CLOTH_UNDERLAY_HOLE_SCALE,
    CLOTH_UNDERLAY_EDGE_INSET
  );
  const underlayGeo = new THREE.ExtrudeGeometry(underlayShape, {
    depth: CLOTH_UNDERLAY_THICKNESS,
    bevelEnabled: false,
    curveSegments: 48,
    steps: 1
  });
  underlayGeo.translate(0, 0, -CLOTH_UNDERLAY_THICKNESS);
  const underlayMat = new THREE.MeshStandardMaterial({
    color: 0x8b6f4a,
    roughness: 0.68,
    metalness: 0.05,
    side: THREE.DoubleSide
  });
  underlayMat.transparent = true;
  underlayMat.opacity = 0;
  underlayMat.depthWrite = true;
  underlayMat.colorWrite = false; // remain invisible while still blocking light for full table shadows
  const clothUnderlay = new THREE.Mesh(underlayGeo, underlayMat);
  clothUnderlay.rotation.x = -Math.PI / 2;
  clothUnderlay.position.y =
    cloth.position.y - CLOTH_THICKNESS - CLOTH_UNDERLAY_GAP;
  clothUnderlay.castShadow = true;
  clothUnderlay.receiveShadow = true;
  clothUnderlay.renderOrder = cloth.renderOrder - 1;
  table.add(clothUnderlay);

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

  const POCKET_TOP_R = POCKET_VIS_R * 0.96 * POCKET_VISUAL_EXPANSION;
  const POCKET_BOTTOM_R = POCKET_TOP_R * 0.7;
  const pocketSurfaceOffset = TABLE.THICK * 0.06;
  const pocketGeo = new THREE.CylinderGeometry(
    POCKET_TOP_R,
    POCKET_BOTTOM_R,
    TABLE.THICK,
    48
  );
  const pocketMat = new THREE.MeshStandardMaterial({
    color: 0x000000,
    metalness: 0.45,
    roughness: 0.6
  });
  const pocketMeshes = [];
  pocketCenters().forEach((p) => {
    const pocket = new THREE.Mesh(pocketGeo, pocketMat);
    pocket.position.set(
      p.x,
      clothPlaneLocal - TABLE.THICK / 2 - pocketSurfaceOffset,
      p.y
    );
    pocket.receiveShadow = true;
    table.add(pocket);
    pocketMeshes.push(pocket);
  });

  const railH = RAIL_HEIGHT;
  const railsTopY = frameTopY + railH;
  const longRailW = ORIGINAL_RAIL_WIDTH; // keep the long rail caps as wide as the end rails so side pockets match visually
  const endRailW = ORIGINAL_RAIL_WIDTH;
  const frameExpansion = TABLE.WALL * 0.08;
  const frameWidthLong =
    Math.max(0, ORIGINAL_OUTER_HALF_W - halfW - 2 * longRailW) + frameExpansion;
  const frameWidthEnd =
    Math.max(0, ORIGINAL_OUTER_HALF_H - halfH - 2 * endRailW) + frameExpansion;
  const outerHalfW = halfW + 2 * longRailW + frameWidthLong;
  const outerHalfH = halfH + 2 * endRailW + frameWidthEnd;
  finishParts.dimensions = { outerHalfW, outerHalfH, railH, frameTopY };
  finishParts.woodSurfaces.rail = null;
  const CUSHION_RAIL_FLUSH = 0; // let cushions sit directly against the rail edge without a visible seam
  const CUSHION_CENTER_NUDGE = 0; // keep cushions flush with the rails so no extra lip appears behind them
  const SHORT_CUSHION_HEIGHT_SCALE = 1.085; // raise short rail cushions to match the remaining four rails
  const railsGroup = new THREE.Group();
  finishParts.accentParent = railsGroup;
  const outerCornerRadius = Math.min(
    Math.min(longRailW, endRailW) * 1.6,
    Math.min(outerHalfW, outerHalfH) * 0.2
  );

  const POCKET_GAP =
    POCKET_VIS_R * 0.88 * POCKET_VISUAL_EXPANSION; // pull the cushions a touch closer so they land right at the pocket arcs
  const SHORT_CUSHION_EXTENSION =
    POCKET_VIS_R * 0.065 * POCKET_VISUAL_EXPANSION; // pull short rail cushions further back so they stay clear of the pocket mouths
  const LONG_CUSHION_TRIM =
    POCKET_VIS_R * 0.28 * POCKET_VISUAL_EXPANSION; // extend the long cushions so they stop right where the pocket arcs begin
  const LONG_CUSHION_CORNER_EXTENSION =
    POCKET_VIS_R * 0.06 * POCKET_VISUAL_EXPANSION; // push the long cushions a touch further toward the corner pockets
  const SIDE_CUSHION_POCKET_CLEARANCE =
    POCKET_VIS_R * 0.045 * POCKET_VISUAL_EXPANSION; // extend side cushions so they meet the pocket openings cleanly
  const SIDE_CUSHION_CENTER_PULL =
    POCKET_VIS_R * 0.18 * POCKET_VISUAL_EXPANSION; // push long rail cushions a touch closer to the middle pockets
  const SIDE_CUSHION_CORNER_TRIM =
    POCKET_VIS_R * 0.005 * POCKET_VISUAL_EXPANSION; // extend side cushions toward the corner pockets for longer green rails
  const horizLen =
    PLAY_W -
    2 * (POCKET_GAP - SHORT_CUSHION_EXTENSION - LONG_CUSHION_CORNER_EXTENSION) -
    LONG_CUSHION_TRIM;
  const vertSeg =
    PLAY_H / 2 - 2 * (POCKET_GAP + SIDE_CUSHION_POCKET_CLEARANCE);
  const sideCushionOffset =
    POCKET_GAP + SIDE_CUSHION_POCKET_CLEARANCE + SIDE_CUSHION_CENTER_PULL;
  const trimmedVertSeg = Math.max(
    vertSeg - SIDE_CUSHION_CORNER_TRIM,
    vertSeg * 0.6
  );
  const cornerShift = (vertSeg - trimmedVertSeg) * 0.5;

  const chromePlateThickness = railH * CHROME_PLATE_THICKNESS_SCALE; // mirror Pool Royale fascia depth
  const sideChromePlateThickness = chromePlateThickness * CHROME_SIDE_PLATE_THICKNESS_BOOST; // match middle pocket fascia depth
  const chromePlateInset = TABLE.THICK * 0.02;
  const chromeCornerPlateTrim =
    TABLE.THICK * (0.03 + CHROME_CORNER_FIELD_TRIM_SCALE);
  const cushionInnerX = halfW - CUSHION_RAIL_FLUSH - CUSHION_CENTER_NUDGE;
  const cushionInnerZ = halfH - CUSHION_RAIL_FLUSH - CUSHION_CENTER_NUDGE;
  const chromePlateInnerLimitX = Math.max(0, cushionInnerX);
  const chromePlateInnerLimitZ = Math.max(0, cushionInnerZ);
  const chromeCornerMeetX = Math.max(0, horizLen / 2);
  const bottomVerticalCenterZ =
    -halfH + sideCushionOffset + vertSeg / 2 + cornerShift;
  const chromeCornerMeetZ = Math.max(
    0,
    Math.abs(bottomVerticalCenterZ - trimmedVertSeg / 2)
  );
  const sideChromeMeetZ = Math.max(
    0,
    Math.abs(bottomVerticalCenterZ + trimmedVertSeg / 2)
  );
  const chromePlateExpansionX = Math.max(
    0,
    (chromePlateInnerLimitX - chromeCornerMeetX) * CHROME_CORNER_EXPANSION_SCALE
  );
  const chromePlateExpansionZ = Math.max(
    0,
    (chromePlateInnerLimitZ - chromeCornerMeetZ) * CHROME_CORNER_SIDE_EXPANSION_SCALE
  );
  const chromeCornerEdgeTrim = TABLE.THICK * CHROME_CORNER_EDGE_TRIM_SCALE;
  const chromeOuterFlushTrim = TABLE.THICK * CHROME_OUTER_FLUSH_TRIM_SCALE;
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
  const chromePlateWidth = Math.max(
    MICRO_EPS,
    chromePlateBaseWidth * CHROME_CORNER_WIDTH_SCALE * CHROME_CORNER_DIMENSION_SCALE -
      chromeCornerEdgeTrim -
      chromeOuterFlushTrim * 2
  );
  const chromeCornerFieldExtension =
    POCKET_VIS_R * CHROME_CORNER_FIELD_EXTENSION_SCALE * POCKET_VISUAL_EXPANSION;
  const chromePlateHeight = Math.max(
    MICRO_EPS,
    chromePlateBaseHeight * CHROME_CORNER_HEIGHT_SCALE * CHROME_CORNER_DIMENSION_SCALE -
      chromeCornerEdgeTrim +
      chromeCornerFieldExtension -
      chromeOuterFlushTrim * 2
  );
  const chromePlateRadius = Math.min(
    outerCornerRadius * 0.95,
    chromePlateWidth / 2,
    chromePlateHeight / 2
  );
  const chromePlateY = railsTopY - chromePlateThickness + MICRO_EPS * 2;
  const sideChromePlateY = railsTopY - sideChromePlateThickness + MICRO_EPS * 2;
  const chromeCornerCenterOutset =
    TABLE.THICK * CHROME_CORNER_CENTER_OUTSET_SCALE;
  const chromeCornerShortRailShift =
    TABLE.THICK * CHROME_CORNER_SHORT_RAIL_SHIFT_SCALE;
  const chromeCornerShortRailCenterPull =
    TABLE.THICK * CHROME_CORNER_SHORT_RAIL_CENTER_PULL_SCALE;

  const sidePocketRadius = SIDE_POCKET_RADIUS * POCKET_VISUAL_EXPANSION;
  const sidePlatePocketWidth = sidePocketRadius * 2 * CHROME_SIDE_PLATE_POCKET_SPAN_SCALE;
  const sidePlateMaxWidth = Math.max(
    MICRO_EPS,
    outerHalfW - chromePlateInset - chromePlateInnerLimitX - TABLE.THICK * 0.08
  );
  const sideChromePlateWidthBase = Math.max(
    MICRO_EPS,
    Math.min(sidePlatePocketWidth, sidePlateMaxWidth) -
      TABLE.THICK * CHROME_SIDE_PLATE_CENTER_TRIM_SCALE +
      TABLE.THICK * CHROME_SIDE_PLATE_WIDTH_EXPANSION_SCALE -
      chromeOuterFlushTrim * 2
  );
  const sidePlateHalfHeightLimit = Math.max(
    0,
    chromePlateInnerLimitZ - TABLE.THICK * 0.08
  );
  const sidePlateHeightByCushion = Math.max(
    MICRO_EPS,
    Math.min(sidePlateHalfHeightLimit, sideChromeMeetZ) * 2
  );
  const sideChromePlateHeightBase = Math.min(
    Math.max(
      MICRO_EPS,
      chromePlateHeight * CHROME_SIDE_PLATE_HEIGHT_SCALE - chromeOuterFlushTrim * 2
    ),
    Math.max(MICRO_EPS, sidePlateHeightByCushion)
  );
  const sideChromeExpansionFactor = 1 + CHROME_SIDE_PLATE_THREE_SIDE_EXPANSION;
  const sideChromePlateWidth = sideChromePlateWidthBase * sideChromeExpansionFactor;
  const sideChromePlateHeight = sideChromePlateHeightBase * sideChromeExpansionFactor;
  const sideChromePlateRadius = Math.min(
    chromePlateRadius * 0.3,
    Math.min(sideChromePlateWidth, sideChromePlateHeight) * CHROME_SIDE_PLATE_CORNER_LIMIT_SCALE
  );
  const sideChromeWidthDelta = sideChromePlateWidth - sideChromePlateWidthBase;

  const innerHalfW = halfWext;
  const innerHalfH = halfHext;
  const cornerPocketRadius = POCKET_VIS_R * 1.1 * POCKET_VISUAL_EXPANSION;
  const cornerChamfer = POCKET_VIS_R * 0.34 * POCKET_VISUAL_EXPANSION;
  const cornerCutInset = CORNER_RAIL_CUT_INSET;
  const sideInset = MIDDLE_POCKET_LATERAL_INSET;

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
  const ringArea = (ring) => signedRingArea(ring);

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
    const pts = [];
    const steps = Math.max(3, Math.ceil((segments * sweep) / (Math.PI * 2)));
    for (let i = 0; i <= steps; i++) {
      const t = startAngle + (sweep * i) / steps;
      const x = cx + radius * Math.cos(t);
      const z = cz + radius * Math.sin(t);
      pts.push([x, z]);
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

  const cornerNotchMP = (sx, sz) => {
    const cx = sx * (innerHalfW - cornerCutInset);
    const cz = sz * (innerHalfH - cornerCutInset);
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
    const wedgeDepth = cornerChamfer * Math.max(0, CHROME_CORNER_NOTCH_WEDGE_SCALE);
    const fieldClipWidth = cornerChamfer * CHROME_CORNER_FIELD_CLIP_WIDTH_SCALE;
    const fieldClipDepth = cornerChamfer * CHROME_CORNER_FIELD_CLIP_DEPTH_SCALE;
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
    const union = polygonClipping.union(...unionParts);
    const adjusted = adjustCornerNotchDepth(union, cz, sz);
    if (CHROME_CORNER_NOTCH_EXPANSION_SCALE === 1) {
      return adjusted;
    }
    return scaleMultiPolygon(adjusted, CHROME_CORNER_NOTCH_EXPANSION_SCALE);
  };

  const sideNotchMP = (sx) => {
    const cx = sx * (innerHalfW - sideInset);
    const radius = sidePocketRadius * CHROME_SIDE_POCKET_RADIUS_SCALE;
    const throatLength = Math.max(
      MICRO_EPS,
      radius * CHROME_SIDE_NOTCH_THROAT_SCALE
    );
    const throatHeight = Math.max(
      MICRO_EPS,
      radius * 2.4 * CHROME_SIDE_NOTCH_HEIGHT_SCALE
    );
    const throatRadius = Math.max(
      MICRO_EPS,
      Math.min(throatHeight / 2, radius * CHROME_SIDE_NOTCH_RADIUS_SCALE)
    );

    const circle = circlePoly(cx, 0, radius, 256);
    const throat = roundedRectPoly(
      cx + (sx * throatLength) / 2,
      0,
      Math.abs(throatLength),
      throatHeight,
      throatRadius,
      192
    );

    const union = polygonClipping.union(circle, throat);
    return adjustSideNotchDepth(union);
  };

  const chromePlates = new THREE.Group();
  const chromePlateShapeSegments = 128;
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
    const notchLocalMP = cornerNotchMP(sx, sz).map((poly) =>
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
      trimMat
    );
    plate.position.set(centerX, chromePlateY + chromePlateThickness, centerZ);
    plate.castShadow = false;
    plate.receiveShadow = false;
    plate.renderOrder = CHROME_PLATE_RENDER_ORDER;
    chromePlates.add(plate);
    finishParts.trimMeshes.push(plate);
  });

  [
    { id: 'sideLeft', sx: -1 },
    { id: 'sideRight', sx: 1 }
  ].forEach(({ id, sx }) => {
    const centerX =
      sx * (outerHalfW - sideChromePlateWidth / 2 - chromePlateInset) +
      sx * sideChromeWidthDelta;
    const centerZ = sx * MIDDLE_POCKET_LONGITUDINAL_OFFSET;
    const notchMP = sideNotchMP(sx);
    const sidePocketCutCenterPull =
      TABLE.THICK * CHROME_SIDE_POCKET_CUT_CENTER_PULL_SCALE;
    const notchLocalMP = notchMP.map((poly) =>
      poly.map((ring) =>
        ring.map(([x, z]) => [x - centerX - sx * sidePocketCutCenterPull, -(z - centerZ)])
      )
    );
    const plate = new THREE.Mesh(
      buildChromePlateGeometry({
        width: sideChromePlateWidth,
        height: sideChromePlateHeight,
        radius: sideChromePlateRadius,
        thickness: sideChromePlateThickness,
        corner: id,
        notchMP: notchLocalMP,
        shapeSegments: chromePlateShapeSegments
      }),
      trimMat
    );
    plate.position.set(centerX, sideChromePlateY + sideChromePlateThickness, centerZ);
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
    clampOuter
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

    const edgeFactor = THREE.MathUtils.clamp(sideThinFactor ?? 0.32, 0.1, 0.9);
    const edgeThickness = Math.max(
      MICRO_EPS * 12,
      baseThickness * edgeFactor * POCKET_JAW_EDGE_TAPER_SCALE
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

    for (let i = 0; i <= segmentCount; i++) {
      const t = i / segmentCount;
      const theta = startAngle + t * (endAngle - startAngle);
      const normalized = Math.abs(theta - midAngle) / halfAngle;
      const clamped = THREE.MathUtils.clamp(normalized, 0, 1);
      const eased = clamped <= 0
        ? 0
        : clamped >= 1
          ? 1
          : THREE.MathUtils.smootherstep(clamped, 0, 1);
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
    clampOuter
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
    let steps = wide ? 88 : 68;

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

    let sideThinFactor = wide ? 0.3 : 0.36;
    let middleThinFactor = wide ? 0.82 : 0.92;
    if (isMiddle && wide) {
      sideThinFactor *= SIDE_POCKET_JAW_SIDE_TRIM_SCALE;
      middleThinFactor *= SIDE_POCKET_JAW_MIDDLE_TRIM_SCALE;
    }

    const jawShape = buildPocketJawShape({
      center,
      baseRadius: effectiveBaseRadius,
      jawAngle: localJawAngle,
      orientationAngle,
      innerScale: baseInnerScale,
      outerScale: baseOuterScale,
      steps,
      sideThinFactor,
      middleThinFactor,
      centerEase: wide ? 0.28 : 0.36,
      clampOuter: localClampOuter
    });
    if (!jawShape) {
      return null;
    }
    const jawDepth = Math.max(
      MICRO_EPS,
      railH * POCKET_JAW_DEPTH_SCALE * depthMultiplier
    );
    const jawGeom = new THREE.ExtrudeGeometry(jawShape, {
      depth: jawDepth,
      bevelEnabled: false,
      curveSegments: Math.max(64, Math.ceil(localJawAngle / (Math.PI / 48))),
      steps: 1
    });
    jawGeom.rotateX(-Math.PI / 2);
    jawGeom.translate(0, -jawDepth, 0);
    jawGeom.computeVertexNormals();
    const jawMesh = new THREE.Mesh(jawGeom, pocketJawMat);
    jawMesh.position.y = railsTopY;
    jawMesh.castShadow = false;
    jawMesh.receiveShadow = true;

    const group = new THREE.Group();
    group.add(jawMesh);
    return { group, jawMesh, rimMesh: null };
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
    CHROME_CORNER_NOTCH_EXPANSION_SCALE *
    POCKET_JAW_CORNER_OUTER_LIMIT_SCALE;
  const sideJawOuterLimit =
    sidePocketRadius *
    CHROME_SIDE_POCKET_RADIUS_SCALE *
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
        sx * (innerHalfW - cornerCutInset),
        sz * (innerHalfH - cornerCutInset)
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
        clampOuter: cornerJawOuterLimit
      });
    });
  }

  if (sideBaseRadius && sideBaseRadius > MICRO_EPS) {
    const SIDE_POCKET_JAW_OUTWARD_SHIFT = TABLE.THICK * 0.26;
    [-1, 1].forEach((sx) => {
      const baseMP = sideNotchMP(sx);
      const fallbackCenter = new THREE.Vector2(sx * (innerHalfW - sideInset), 0);
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
        clampOuter: sideJawOuterLimit
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

  const woodSideCutCenterOutset = TABLE.THICK * WOOD_SIDE_POCKET_CUT_CENTER_OUTSET_SCALE;
  const woodSideNotches = [-1, 1]
    .map((sx) =>
      translatePocketCutMP(
        translatePocketCutMP(
          scaleMultiPolygonBy(sideNotchMP(sx), WOOD_SIDE_CUT_SCALE),
          sx,
          0,
          woodSideCutCenterOutset
        ),
        0,
        sx,
        MIDDLE_POCKET_LONGITUDINAL_OFFSET
      )
    )
    .filter((mp) => Array.isArray(mp) && mp.length);
  let openingMP = polygonClipping.union(
    rectPoly(innerHalfW * 2, innerHalfH * 2),
    ...woodSideNotches.flat()
  );
  openingMP = polygonClipping.union(
    openingMP,
    ...scaleMultiPolygonBy(cornerNotchMP(1, 1), WOOD_CORNER_CUT_SCALE),
    ...scaleMultiPolygonBy(cornerNotchMP(-1, 1), WOOD_CORNER_CUT_SCALE),
    ...scaleMultiPolygonBy(cornerNotchMP(-1, -1), WOOD_CORNER_CUT_SCALE),
    ...scaleMultiPolygonBy(cornerNotchMP(1, -1), WOOD_CORNER_CUT_SCALE)
  );

  const railsOuter = new THREE.Shape();
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
    curveSegments: 96
  });
  railsGeom = softenOuterExtrudeEdges(railsGeom, railH, RAIL_OUTER_EDGE_RADIUS_RATIO);
  const railsMesh = new THREE.Mesh(railsGeom, railMat);
  railsMesh.rotation.x = -Math.PI / 2;
  railsMesh.position.y = frameTopY;
  railsMesh.castShadow = true;
  railsMesh.receiveShadow = true;
  railsGroup.add(railsMesh);
  finishParts.railMeshes.push(railsMesh);

  table.add(railsGroup);

  const chalkGroup = new THREE.Group();
  const chalkScale = 0.5;
  const chalkSize = BALL_R * 1.92 * chalkScale;
  const chalkHeight = BALL_R * 1.35 * chalkScale;
  const chalkGeometry = new THREE.BoxGeometry(chalkSize, chalkHeight, chalkSize);
  const createChalkMaterials = () => {
    const top = new THREE.MeshPhysicalMaterial({
      color: CHALK_TOP_COLOR,
      roughness: 0.42,
      metalness: 0.08,
      sheen: 0.2,
      sheenRoughness: 0.55,
      emissive: new THREE.Color(CHALK_EMISSIVE_COLOR),
      emissiveIntensity: 0.2
    });
    const bottom = new THREE.MeshPhysicalMaterial({
      color: CHALK_BOTTOM_COLOR,
      roughness: 0.85,
      metalness: 0.02
    });
    const side = new THREE.MeshPhysicalMaterial({
      color: CHALK_SIDE_COLOR,
      roughness: 0.68,
      metalness: 0.05,
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
  const chalkSideRailOffset = Math.min(longRailW * 0.18, Math.max(0, longRailW * 0.45 - chalkSize * 0.5));
  const chalkEndRailOffset = Math.min(endRailW * 0.18, Math.max(0, endRailW * 0.45 - chalkSize * 0.5));
  const chalkLongOffsetLimit = Math.max(0, PLAY_H / 2 - BALL_R * 3.5);
  const chalkShortOffsetLimit = Math.max(0, PLAY_W / 2 - BALL_R * 3.5);
  const chalkLongAxisOffset = Math.min(chalkLongOffsetLimit, PLAY_H * 0.22);
  const chalkShortAxisOffset = Math.min(chalkShortOffsetLimit, PLAY_W * 0.22);
  const chalkSlots = [
    {
      position: new THREE.Vector3(-sideRailCenterX - chalkSideRailOffset, chalkBaseY, 0).add(
        new THREE.Vector3(0, 0, 1).multiplyScalar(chalkLongAxisOffset)
      ),
      rotationY: Math.PI / 2
    },
    {
      position: new THREE.Vector3(sideRailCenterX + chalkSideRailOffset, chalkBaseY, 0).add(
        new THREE.Vector3(0, 0, -1).multiplyScalar(chalkLongAxisOffset)
      ),
      rotationY: -Math.PI / 2
    },
    {
      position: new THREE.Vector3(0, chalkBaseY, -endRailCenterZ - chalkEndRailOffset).add(
        new THREE.Vector3(-1, 0, 0).multiplyScalar(chalkShortAxisOffset)
      ),
      rotationY: 0
    },
    {
      position: new THREE.Vector3(0, chalkBaseY, endRailCenterZ + chalkEndRailOffset).add(
        new THREE.Vector3(1, 0, 0).multiplyScalar(chalkShortAxisOffset)
      ),
      rotationY: Math.PI
    }
  ];
  chalkSlots.forEach(({ position, rotationY }) => {
    const mesh = new THREE.Mesh(chalkGeometry, createChalkMaterials());
    mesh.position.copy(position);
    mesh.rotation.y = rotationY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.visible = true;
    chalkGroup.add(mesh);
  });
  table.add(chalkGroup);

  const FACE_SHRINK_LONG = 1;
  const FACE_SHRINK_SHORT = FACE_SHRINK_LONG;
  const NOSE_REDUCTION = 0.75;
  const CUSHION_UNDERCUT_BASE_LIFT = 0.38;
  const CUSHION_UNDERCUT_FRONT_REMOVAL = 0.66;
  const cushionBaseY = CLOTH_TOP_LOCAL - MICRO_EPS + CUSHION_EXTRA_LIFT;
  const cushionHeightTarget = railsTopY - cushionBaseY;
  const cushionScaleY = Math.max(0.001, cushionHeightTarget / railH);

  function cushionProfileAdvanced(len, horizontal) {
    const halfLen = len / 2;
    const thicknessScale = horizontal ? FACE_SHRINK_LONG : FACE_SHRINK_SHORT;
    const baseRailWidth = horizontal ? longRailW : endRailW;
    const baseThickness = baseRailWidth * thicknessScale;
    const backY = baseRailWidth / 2;
    const noseThickness = baseThickness * NOSE_REDUCTION;
    const frontY = backY - noseThickness;
    const rad = THREE.MathUtils.degToRad(CUSHION_CUT_ANGLE);
    const straightCut = Math.max(
      baseThickness * 0.25,
      noseThickness / Math.tan(rad)
    );

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

  function addCushion(x, z, len, horizontal, flip = false) {
    const geo = cushionProfileAdvanced(len, horizontal);
    const mesh = new THREE.Mesh(geo, cushionMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.y = cushionScaleY * (horizontal ? SHORT_CUSHION_HEIGHT_SCALE : 1);
    mesh.renderOrder = 2;
    const group = new THREE.Group();
    group.add(mesh);
    group.position.set(x, cushionBaseY, z);
    if (!horizontal) group.rotation.y = Math.PI / 2;
    if (flip) group.rotation.y += Math.PI;

    if (horizontal) {
      const side = z >= 0 ? 1 : -1;
      group.position.z =
        side * (halfH - CUSHION_RAIL_FLUSH - CUSHION_CENTER_NUDGE);
    } else {
      const side = x >= 0 ? 1 : -1;
      group.position.x =
        side * (halfW - CUSHION_RAIL_FLUSH - CUSHION_CENTER_NUDGE);
    }

    group.userData = group.userData || {};
    group.userData.horizontal = horizontal;
    group.userData.side = horizontal ? (z >= 0 ? 1 : -1) : x >= 0 ? 1 : -1;
    table.add(group);
    table.userData.cushions.push(group);
  }

  const bottomZ = -halfH;
  const topZ = halfH;
  const leftX = -halfW;
  const rightX = halfW;

  addCushion(0, bottomZ, horizLen, true, false);
  addCushion(0, topZ, horizLen, true, true);

  addCushion(
    leftX,
    -halfH + sideCushionOffset + vertSeg / 2 + cornerShift,
    trimmedVertSeg,
    false,
    false
  );
  addCushion(
    leftX,
    halfH - sideCushionOffset - vertSeg / 2 - cornerShift,
    trimmedVertSeg,
    false,
    false
  );
  addCushion(
    rightX,
    -halfH + sideCushionOffset + vertSeg / 2 + cornerShift,
    trimmedVertSeg,
    false,
    true
  );
  addCushion(
    rightX,
    halfH - sideCushionOffset - vertSeg / 2 - cornerShift,
    trimmedVertSeg,
    false,
    true
  );

  const frameOuterX = outerHalfW;
  const frameOuterZ = outerHalfH;
  const skirtH = TABLE_H * 0.68 * SKIRT_DROP_MULTIPLIER;
  const baseRailWidth = endRailW;
  const baseOverhang = baseRailWidth * SKIRT_SIDE_OVERHANG;
  const skirtShape = new THREE.Shape();
  const outW = frameOuterX + baseOverhang;
  const outZ = frameOuterZ + baseOverhang;
  const skirtOuterRadius = Math.min(
    outerCornerRadius + baseOverhang * 0.4,
    Math.min(outW, outZ)
  );
  skirtShape.moveTo(outW, -outZ + skirtOuterRadius);
  skirtShape.lineTo(outW, outZ - skirtOuterRadius);
  skirtShape.absarc(
    outW - skirtOuterRadius,
    outZ - skirtOuterRadius,
    skirtOuterRadius,
    0,
    Math.PI / 2,
    false
  );
  skirtShape.lineTo(-outW + skirtOuterRadius, outZ);
  skirtShape.absarc(
    -outW + skirtOuterRadius,
    outZ - skirtOuterRadius,
    skirtOuterRadius,
    Math.PI / 2,
    Math.PI,
    false
  );
  skirtShape.lineTo(-outW, -outZ + skirtOuterRadius);
  skirtShape.absarc(
    -outW + skirtOuterRadius,
    -outZ + skirtOuterRadius,
    skirtOuterRadius,
    Math.PI,
    1.5 * Math.PI,
    false
  );
  skirtShape.lineTo(outW - skirtOuterRadius, -outZ);
  skirtShape.absarc(
    outW - skirtOuterRadius,
    -outZ + skirtOuterRadius,
    skirtOuterRadius,
    -Math.PI / 2,
    0,
    false
  );
  const inner = new THREE.Path();
  const skirtInnerRadius = Math.max(outerCornerRadius - baseOverhang, 0);
  if (skirtInnerRadius > 1e-4) {
    inner.moveTo(frameOuterX, -frameOuterZ + skirtInnerRadius);
    inner.lineTo(frameOuterX, frameOuterZ - skirtInnerRadius);
    inner.absarc(
      frameOuterX - skirtInnerRadius,
      frameOuterZ - skirtInnerRadius,
      skirtInnerRadius,
      0,
      Math.PI / 2,
      false
    );
    inner.lineTo(-frameOuterX + skirtInnerRadius, frameOuterZ);
    inner.absarc(
      -frameOuterX + skirtInnerRadius,
      frameOuterZ - skirtInnerRadius,
      skirtInnerRadius,
      Math.PI / 2,
      Math.PI,
      false
    );
    inner.lineTo(-frameOuterX, -frameOuterZ + skirtInnerRadius);
    inner.absarc(
      -frameOuterX + skirtInnerRadius,
      -frameOuterZ + skirtInnerRadius,
      skirtInnerRadius,
      Math.PI,
      1.5 * Math.PI,
      false
    );
    inner.lineTo(frameOuterX - skirtInnerRadius, -frameOuterZ);
    inner.absarc(
      frameOuterX - skirtInnerRadius,
      -frameOuterZ + skirtInnerRadius,
      skirtInnerRadius,
      -Math.PI / 2,
      0,
      false
    );
  } else {
    inner.moveTo(frameOuterX, -frameOuterZ);
    inner.lineTo(frameOuterX, frameOuterZ);
    inner.lineTo(-frameOuterX, frameOuterZ);
    inner.lineTo(-frameOuterX, -frameOuterZ);
    inner.lineTo(frameOuterX, -frameOuterZ);
  }
  skirtShape.holes.push(inner);
  const skirtGeo = new THREE.ExtrudeGeometry(skirtShape, {
    depth: skirtH,
    bevelEnabled: false
  });
  const skirt = new THREE.Mesh(skirtGeo, frameMat);
  skirt.rotation.x = -Math.PI / 2;
  skirt.position.y = frameTopY - skirtH + SKIRT_RAIL_GAP_FILL + MICRO_EPS * 0.5;
  skirt.castShadow = true;
  skirt.receiveShadow = true;
  table.add(skirt);
  finishParts.frameMeshes.push(skirt);

  const legR = Math.min(TABLE.W, TABLE.H) * 0.055 * LEG_RADIUS_SCALE;
  const legTopLocal = frameTopY - TABLE.THICK;
  const legTopWorld = legTopLocal + TABLE_Y;
  const legBottomWorld = FLOOR_Y;
  const legReach = Math.max(legTopWorld - legBottomWorld, TABLE_H);
  const legH = legReach + LEG_TOP_OVERLAP;
  const legGeo = new THREE.CylinderGeometry(legR, legR, legH, 64);
  const legInset = baseRailWidth * 2.2;
  const legPositions = [
    [-frameOuterX + legInset, -frameOuterZ + legInset],
    [frameOuterX - legInset, -frameOuterZ + legInset],
    [-frameOuterX + legInset, 0],
    [frameOuterX - legInset, 0],
    [-frameOuterX + legInset, frameOuterZ - legInset],
    [frameOuterX - legInset, frameOuterZ - legInset]
  ];
  const legY = legTopLocal + LEG_TOP_OVERLAP - legH / 2;
  finishParts.woodSurfaces.frame = null;
  legPositions.forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(lx, legY, lz);
    leg.castShadow = true;
    leg.receiveShadow = true;
    table.add(leg);
    finishParts.legMeshes.push(leg);
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
    mesh.position.y = clothPlaneLocal - TABLE.THICK / 2 - pocketSurfaceOffset;
  });

  alignRailsToCushions(table, railsGroup);
  table.updateMatrixWorld(true);
  updateRailLimitsFromTable(table);

  table.position.y = TABLE_Y;
  table.userData.cushionTopLocal = cushionTopLocal;
  table.userData.cushionTopWorld = cushionTopLocal + TABLE_Y;
  table.userData.cushionLipClearance = clothPlaneWorld;
  table.userData.finish = finishInfo;
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
      const baseFallback = TABLE_FINISHES[DEFAULT_TABLE_FINISH_ID].createMaterials();
      fallbackMaterials = { ...baseFallback };
    }
    if (key === 'pocketJaw' && !fallbackMaterials.pocketJaw) {
      fallbackMaterials.pocketJaw = createDefaultPocketJawMaterial();
    }
    return fallbackMaterials[key];
  };
  const frameMat = rawMaterials.frame ?? getFallbackMaterial('frame');
  const railMat = rawMaterials.rail ?? getFallbackMaterial('rail');
  const legMat = rawMaterials.leg ?? frameMat;
  const trimMat = rawMaterials.trim ?? getFallbackMaterial('trim');
  const pocketJawMat =
    rawMaterials.pocketJaw ?? getFallbackMaterial('pocketJaw') ?? createDefaultPocketJawMaterial();
  const accentConfig = rawMaterials.accent ?? null;
  frameMat.needsUpdate = true;
  railMat.needsUpdate = true;
  legMat.needsUpdate = true;
  trimMat.needsUpdate = true;
  pocketJawMat.needsUpdate = true;
  enhanceChromeMaterial(trimMat);
  if (accentConfig?.material) {
    accentConfig.material.needsUpdate = true;
  }

  const disposed = new Set();
  const swapMaterial = (mesh, material) => {
    if (!mesh || !material) return;
    if (mesh.material !== material) {
      const current = mesh.material;
      if (current?.dispose && !disposed.has(current)) {
        current.dispose();
        disposed.add(current);
      }
      mesh.material = material;
    }
  };

  finishInfo.parts.frameMeshes.forEach((mesh) => swapMaterial(mesh, frameMat));
  finishInfo.parts.legMeshes.forEach((mesh) => swapMaterial(mesh, legMat));
  finishInfo.parts.railMeshes.forEach((mesh) => swapMaterial(mesh, railMat));
  finishInfo.parts.trimMeshes.forEach((mesh) => swapMaterial(mesh, trimMat));
  finishInfo.parts.pocketJawMeshes.forEach((mesh) => swapMaterial(mesh, pocketJawMat));

  const stripWoodTexture = (material) => {
    if (!material) return;
    ['map', 'normalMap', 'roughnessMap', 'bumpMap', 'metalnessMap'].forEach((prop) => {
      if (material[prop]) {
        material[prop] = null;
      }
    });
    material.needsUpdate = true;
  };
  stripWoodTexture(frameMat);
  stripWoodTexture(railMat);
  if (legMat !== frameMat) {
    stripWoodTexture(legMat);
  }
  finishInfo.parts.woodSurfaces = { frame: null, rail: null };
  finishInfo.woodTextureId = null;
  finishInfo.parts.woodTextureId = null;

  const { accentMesh, accentParent, dimensions } = finishInfo.parts;
  if (accentMesh) {
    if (accentMesh.parent) {
      accentMesh.parent.remove(accentMesh);
    }
    if (accentMesh.geometry) {
      accentMesh.geometry.dispose();
    }
    const accentMaterial = accentMesh.material;
    if (accentMaterial?.dispose && !disposed.has(accentMaterial)) {
      accentMaterial.dispose();
      disposed.add(accentMaterial);
    }
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
  const emissiveColor = clothColor.clone().multiplyScalar(0.06);
  if (finishInfo.clothMat) {
    finishInfo.clothMat.color.copy(clothColor);
    finishInfo.clothMat.emissive.copy(emissiveColor);
    finishInfo.clothMat.needsUpdate = true;
  }
  if (finishInfo.cushionMat) {
    finishInfo.cushionMat.color.copy(clothColor);
    finishInfo.cushionMat.emissive.copy(emissiveColor);
    finishInfo.cushionMat.needsUpdate = true;
  }
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
    accent: accentConfig
  };
  finishInfo.clothDetail = resolvedFinish?.clothDetail ?? null;
}

// --------------------------------------------------
// NEW Engine (no globals). Camera feels like standing at the side.
// --------------------------------------------------
function SnookerGame() {
  const mountRef = useRef(null);
  const rafRef = useRef(null);
  const rules = useMemo(() => new UnitySnookerRules(), []);
  const [tableFinishId, setTableFinishId] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        const requested = params.get('finish');
        if (requested && TABLE_FINISHES[requested]) {
          return requested;
        }
      } catch {}
      try {
        const stored = window.localStorage.getItem('snookerTableFinish');
        if (stored && TABLE_FINISHES[stored]) {
          return stored;
        }
      } catch {}
    }
    return DEFAULT_TABLE_FINISH_ID;
  });
  const [woodTextureId] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('snookerWoodTexture');
      if (stored && WOOD_GRAIN_OPTIONS_BY_ID[stored]) {
        return stored;
      }
    }
    return DEFAULT_WOOD_GRAIN_ID;
  });
  const [chromeColorId, setChromeColorId] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('snookerChromeColor');
      if (stored && CHROME_COLOR_OPTIONS.some((opt) => opt.id === stored)) {
        return stored;
      }
    }
    return DEFAULT_CHROME_COLOR_ID;
  });
  const [clothColorId, setClothColorId] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('snookerClothColor');
      if (stored && CLOTH_COLOR_OPTIONS.some((opt) => opt.id === stored)) {
        return stored;
      }
    }
    return DEFAULT_CLOTH_COLOR_ID;
  });
  const activeChromeOption = useMemo(
    () => CHROME_COLOR_OPTIONS.find((opt) => opt.id === chromeColorId) ?? CHROME_COLOR_OPTIONS[0],
    [chromeColorId]
  );
  const activeClothOption = useMemo(
    () => CLOTH_COLOR_OPTIONS.find((opt) => opt.id === clothColorId) ?? CLOTH_COLOR_OPTIONS[0],
    [clothColorId]
  );
  const activeWoodTexture = useMemo(
    () =>
      WOOD_GRAIN_OPTIONS_BY_ID[woodTextureId] ??
      WOOD_GRAIN_OPTIONS_BY_ID[DEFAULT_WOOD_GRAIN_ID] ??
      WOOD_GRAIN_OPTIONS[0],
    [woodTextureId]
  );
  const [configOpen, setConfigOpen] = useState(false);
  const configPanelRef = useRef(null);
  const configButtonRef = useRef(null);
  const chalkMeshesRef = useRef([]);
  const chalkAreaRef = useRef(null);
  const [activeChalkIndex, setActiveChalkIndex] = useState(null);
  const activeChalkIndexRef = useRef(null);
  const chalkAssistEnabledRef = useRef(false);
  const chalkAssistTargetRef = useRef(false);
  const visibleChalkIndexRef = useRef(null);
  const [cueStyleIndex, setCueStyleIndex] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(CUE_STYLE_STORAGE_KEY);
      if (stored != null) {
        const parsed = Number.parseInt(stored, 10);
        if (Number.isFinite(parsed) && parsed >= 0) {
          return parsed % CUE_RACK_PALETTE.length;
        }
      }
    }
    return 0;
  });
  const cueStyleIndexRef = useRef(cueStyleIndex);
  const cueRackGroupsRef = useRef([]);
  const cueOptionGroupsRef = useRef([]);
  const cueRackMetaRef = useRef(new Map());
  const cueMaterialsRef = useRef({ shaft: null });
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
    if (!Array.isArray(CUE_RACK_PALETTE) || CUE_RACK_PALETTE.length === 0) {
      return 0xdeb887;
    }
    const paletteLength = CUE_RACK_PALETTE.length;
    const normalized = ((index % paletteLength) + paletteLength) % paletteLength;
    return CUE_RACK_PALETTE[normalized];
  }, []);

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
      const color = getCueColorFromIndex(index);
      cueStyleIndexRef.current = index;
      const shaftMaterial = cueMaterialsRef.current?.shaft;
      if (shaftMaterial && typeof color === 'number') {
        shaftMaterial.color.setHex(color);
        shaftMaterial.needsUpdate = true;
      }
      updateCueRackHighlights();
    },
    [getCueColorFromIndex, updateCueRackHighlights]
  );

  const selectCueStyleFromMenu = useCallback(
    (index) => {
      const paletteLength = CUE_RACK_PALETTE.length || 1;
      const normalized = ((index % paletteLength) + paletteLength) % paletteLength;
      applySelectedCueStyle(normalized);
      setCueStyleIndex(normalized);
    },
    [applySelectedCueStyle]
  );

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
            mat.color.setHex(isActive ? CHALK_ACTIVE_COLOR : CHALK_TOP_COLOR);
          } else if (matIndex === 3) {
            mat.color.setHex(CHALK_BOTTOM_COLOR);
          } else {
            mat.color.setHex(
              isActive || isSuggested
                ? CHALK_SIDE_ACTIVE_COLOR
                : CHALK_SIDE_COLOR
            );
          }
          if (mat.emissive) {
            if (isActive) {
              mat.emissive.setHex(CHALK_ACTIVE_EMISSIVE_COLOR);
              mat.emissiveIntensity = 0.42;
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

  const toggleChalkAssist = useCallback(() => {
    setActiveChalkIndex(null);
  }, []);
  const tableFinish = useMemo(() => {
    const baseFinish =
      TABLE_FINISHES[tableFinishId] ?? TABLE_FINISHES[DEFAULT_TABLE_FINISH_ID];
    const baseCreateMaterials =
      typeof baseFinish?.createMaterials === 'function'
        ? baseFinish.createMaterials
        : TABLE_FINISHES[DEFAULT_TABLE_FINISH_ID].createMaterials;
    const chromeSelection = activeChromeOption;
    const clothSelection = activeClothOption;
    const woodSelection = activeWoodTexture;
    return {
      ...baseFinish,
      clothDetail:
        clothSelection.detail ?? baseFinish?.clothDetail ?? null,
      colors: {
        ...baseFinish.colors,
        cloth: clothSelection.color
      },
      woodTexture: woodSelection,
      woodTextureId: woodSelection?.id ?? DEFAULT_WOOD_GRAIN_ID,
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
        return materials;
      }
    };
  }, [tableFinishId, activeChromeOption, activeClothOption, activeWoodTexture]);
  const tableFinishRef = useRef(tableFinish);
  const applyFinishRef = useRef(() => {});
  useEffect(() => {
    tableFinishRef.current = tableFinish;
    applyFinishRef.current?.(tableFinish);
  }, [tableFinish]);
  useEffect(() => {
    const nextFinish = tableFinishRef.current;
    if (nextFinish) {
      applyFinishRef.current?.(nextFinish);
    }
  }, [activeChromeOption, activeClothOption, activeWoodTexture]);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('snookerTableFinish', tableFinishId);
    }
  }, [tableFinishId]);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('snookerChromeColor', chromeColorId);
    }
  }, [chromeColorId]);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('snookerClothColor', clothColorId);
    }
  }, [clothColorId]);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('snookerWoodTexture', woodTextureId);
    }
  }, [woodTextureId]);
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
  const [frameState, setFrameState] = useState(() =>
    rules.getInitialFrame('Player', 'AI')
  );
  const frameRef = useRef(frameState);
  useEffect(() => {
    frameRef.current = frameState;
  }, [frameState]);
  const [aiPlanning, setAiPlanning] = useState(null);
  const aiPlanRef = useRef(null);
  const aiPlanningRef = useRef(null);
  useEffect(() => {
    aiPlanningRef.current = aiPlanning;
  }, [aiPlanning]);
  const userSuggestionPlanRef = useRef(null);
  const userSuggestionRef = useRef(null);
  const startAiThinkingRef = useRef(() => {});
  const stopAiThinkingRef = useRef(() => {});
  const startUserSuggestionRef = useRef(() => {});
  const autoAimRequestRef = useRef(false);
  const aiTelemetryRef = useRef({ key: null, countdown: 0 });
  const [hud, setHud] = useState({
    power: 0.65,
    A: 0,
    B: 0,
    turn: 0,
    phase: 'reds',
    next: 'red',
    inHand: true,
    over: false
  });
  const powerRef = useRef(hud.power);
  useEffect(() => {
    powerRef.current = hud.power;
  }, [hud.power]);
  const hudRef = useRef(hud);
  useEffect(() => {
    hudRef.current = hud;
  }, [hud]);
  useEffect(() => {
    const sph = sphRef.current;
    const bounds = cameraBoundsRef.current;
    if (!sph || !bounds) return;
    const standingRadius = bounds.standing?.radius ?? sph.radius;
    const targetRadius = THREE.MathUtils.clamp(
      standingRadius * (hud.inHand ? IN_HAND_CAMERA_PULLBACK : 1),
      CAMERA.minR,
      CAMERA.maxR
    );
    orbitRadiusLimitRef.current = targetRadius;
    const nextRadius = hud.inHand
      ? Math.max(sph.radius, targetRadius)
      : THREE.MathUtils.clamp(sph.radius, CAMERA.minR, targetRadius);
    if (Math.abs(nextRadius - sph.radius) > 1e-4) {
      sph.radius = nextRadius;
      updateCameraRef.current?.();
    }
  }, [hud.inHand]);
  const [shotActive, setShotActive] = useState(false);
  const shootingRef = useRef(shotActive);
  useEffect(() => {
    shootingRef.current = shotActive;
  }, [shotActive]);
  const sliderInstanceRef = useRef(null);
  const suggestionAimKeyRef = useRef(null);
  const aiEarlyShotIntentRef = useRef(null);
  const clearEarlyAiShot = useCallback(() => {
    const intent = aiEarlyShotIntentRef.current;
    if (intent?.timeout) {
      clearTimeout(intent.timeout);
    }
    aiEarlyShotIntentRef.current = null;
  }, []);
  useEffect(() => () => clearEarlyAiShot(), [clearEarlyAiShot]);
  useEffect(() => {
    if (hud.turn !== 1) {
      clearEarlyAiShot();
    }
  }, [hud.turn, clearEarlyAiShot]);
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
  const [err, setErr] = useState(null);
  const fireRef = useRef(() => {}); // set from effect so slider can trigger fire()
  const cameraRef = useRef(null);
  const sphRef = useRef(null);
  const initialOrbitRef = useRef(null);
  const aimFocusRef = useRef(null);
  const [pocketCameraActive, setPocketCameraActive] = useState(false);
  const pocketCameraStateRef = useRef(false);
  const pocketCamerasRef = useRef(new Map());
  const broadcastCamerasRef = useRef(null);
  const activeRenderCameraRef = useRef(null);
  const pocketSwitchIntentRef = useRef(null);
  const lastPocketBallRef = useRef(null);
  const cameraBlendRef = useRef(ACTION_CAMERA_START_BLEND);
  const updateCameraRef = useRef(() => {});
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
  const [topView, setTopView] = useState(false);
  const [isLookMode, setIsLookMode] = useState(false);
  const lookModeRef = useRef(false);
  const aimDirRef = useRef(new THREE.Vector2(0, 1));
  const playerOffsetRef = useRef(0);
  const orbitFocusRef = useRef({
    target: new THREE.Vector3(0, ORBIT_FOCUS_BASE_Y, 0),
    ballId: null
  });
  useEffect(() => {
    lookModeRef.current = isLookMode;
    if (!isLookMode) {
      aimFocusRef.current = null;
    }
    updateCameraRef.current?.();
  }, [isLookMode]);
  const orbitRadiusLimitRef = useRef(null);
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
  const lastCameraTargetRef = useRef(new THREE.Vector3(0, ORBIT_FOCUS_BASE_Y, 0));
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
  const audioContextRef = useRef(null);
  const audioBuffersRef = useRef({
    cue: null,
    ball: null,
    pocket: null,
    knock: null,
    cheer: null,
    shock: null
  });
  const activeCrowdSoundRef = useRef(null);
  const muteRef = useRef(isGameMuted());
  const volumeRef = useRef(getGameVolume());
  const railSoundTimeRef = useRef(new Map());
  const [player, setPlayer] = useState({ name: '', avatar: '' });
  const playerInfoRef = useRef(player);
  useEffect(() => {
    playerInfoRef.current = player;
  }, [player]);
  const panelsRef = useRef(null);
  const { mapDelta } = useAimCalibration();

  const stopActiveCrowdSound = useCallback(() => {
    const current = activeCrowdSoundRef.current;
    if (current) {
      try {
        current.stop();
      } catch {}
      activeCrowdSoundRef.current = null;
    }
  }, []);

  const playCueHit = useCallback((vol = 1) => {
    const ctx = audioContextRef.current;
    const buffer = audioBuffersRef.current.cue;
    if (!ctx || !buffer || muteRef.current) return;
    const scaled = clamp(vol * volumeRef.current, 0, 1);
    if (scaled <= 0) return;
    ctx.resume().catch(() => {});
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = scaled;
    source.connect(gain).connect(ctx.destination);
    source.start(0, 0, 0.5);
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
    source.connect(gain).connect(ctx.destination);
    source.start(0);
  }, []);

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
    source.connect(gain).connect(ctx.destination);
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
    source.connect(gain).connect(ctx.destination);
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
      source.connect(gain).connect(ctx.destination);
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
      source.connect(gain).connect(ctx.destination);
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
    document.title = '3D Snooker';
  }, []);
  useEffect(() => {
    setPlayer({
      name: getTelegramUsername() || 'Player',
      avatar: getTelegramPhotoUrl()
    });
  }, []);
  useEffect(() => {
    setFrameState((prev) => {
      const nextName = player.name || 'Player';
      if (prev.players.A.name === nextName) return prev;
      return {
        ...prev,
        players: {
          ...prev.players,
          A: { ...prev.players.A, name: nextName }
        }
      };
    });
  }, [player.name]);
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
        ['cue', '/assets/sounds/billiard-pool-hit-371618.mp3'],
        ['ball', '/assets/sounds/billiard-sound newhit.mp3'],
        ['pocket', '/assets/sounds/billiard-sound-6-288417.mp3'],
        ['knock', '/assets/sounds/wooden-door-knock-102902.mp3'],
        ['cheer', '/assets/sounds/crowd-cheering-383111.mp3'],
        ['shock', '/assets/sounds/crowd-shocked-reaction-352766.mp3']
      ];
      const loaded = {};
      for (const [key, path] of entries) {
        try {
          const buffer = await loadBuffer(path);
          if (!cancelled) loaded[key] = buffer;
        } catch (err) {
          console.warn('Snooker audio load failed:', key, err);
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
        shock: null
      };
      audioContextRef.current = null;
      ctx.close().catch(() => {});
    };
  }, [stopActiveCrowdSound]);
  useEffect(() => {
    setHud((prev) => {
      const nextTargets = frameState.ballOn.map((c) => c.toLowerCase());
      let nextLabel = prev.next;
      if (nextTargets.length === 1) {
        nextLabel = nextTargets[0];
      } else if (nextTargets.length > 1) {
        nextLabel = nextTargets.includes('red')
          ? 'red'
          : nextTargets[0];
      } else if (frameState.phase === 'COLORS_ORDER') {
        nextLabel = 'yellow';
      }
      return {
        ...prev,
        A: frameState.players.A.score,
        B: frameState.players.B.score,
        turn: frameState.activePlayer === 'A' ? 0 : 1,
        phase:
          frameState.phase === 'REDS_AND_COLORS' ? 'reds' : 'colors',
        next: nextLabel,
        over: frameState.frameOver
      };
    });
  }, [frameState]);
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
    if (!last3DRef.current) {
      last3DRef.current = { phi: sph.phi, theta: sph.theta };
    }
    const aspect = cam.aspect || cam.parent?.clientWidth / cam.parent?.clientHeight || 1;
    const zoomProfile = resolveCameraZoomProfile(aspect);
    const standingMargin = window.innerHeight > window.innerWidth
      ? STANDING_VIEW_MARGIN_PORTRAIT
      : STANDING_VIEW_MARGIN_LANDSCAPE;
    const targetMargin = Math.max(
      STANDING_VIEW.margin,
      (next ? TOP_VIEW_MARGIN : standingMargin) * (zoomProfile?.margin ?? 1)
    );
    const focusTarget = new THREE.Vector3(
      playerOffsetRef.current,
      ORBIT_FOCUS_BASE_Y,
      0
    ).multiplyScalar(worldScaleFactor);
    const fittedRadius = fitRadius(cam, targetMargin);
    const targetRadius = next
      ? Math.max(
          clampOrbitRadius(fittedRadius) * TOP_VIEW_RADIUS_SCALE,
          CAMERA.minR * TOP_VIEW_MIN_RADIUS_SCALE
        )
      : clampOrbitRadius(fittedRadius);
    const targetPhi = next ? Math.max(TOP_VIEW_PHI, CAMERA.minPhi) : last3DRef.current.phi;
    const targetTheta = next ? sph.theta : last3DRef.current.theta;
    const duration = 520;
    const t0 = performance.now();
    function anim(t) {
      const k = Math.min(1, (t - t0) / duration);
      const ease = k * (2 - k);
      sph.radius = start.radius + (targetRadius - start.radius) * ease;
      sph.phi = start.phi + (targetPhi - start.phi) * ease;
      sph.theta = start.theta + (targetTheta - start.theta) * ease;
      const tmpSphAnim = sph.clone
        ? sph.clone()
        : new THREE.Spherical(sph.radius, sph.phi, sph.theta);
      cam.position.setFromSpherical(tmpSphAnim).add(focusTarget);
      cam.lookAt(focusTarget);
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
    const duration = playerTurn === 0 ? 60 : 15;
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
          } else {
            aiShoot.current();
          }
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [hud.turn, hud.over, playTurnKnock]);

  useEffect(() => {
    if (hud.over) {
      stopAiThinkingRef.current?.();
      setAiPlanning(null);
      aiPlanRef.current = null;
      return;
    }
    if (hud.turn === 1) {
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
  }, [hud.turn, hud.over]);

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
    if (hud.turn === 1) {
      startAiThinkingRef.current?.();
    }
  }, [frameState, hud.turn, hud.over]);

  useEffect(() => {
    const host = mountRef.current;
    if (!host) return;
    const cueRackDisposers = [];
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
      const applyWorldScale = (scale) => {
        worldScaleFactor = scale;
        baseSurfaceWorldY = tableSurfaceY * scale;
        world.scale.setScalar(scale);
        if (broadcastCamerasRef.current) {
          const rig = broadcastCamerasRef.current;
          const focusWorld = rig.defaultFocus
            ? rig.defaultFocus.clone().multiplyScalar(scale)
            : new THREE.Vector3();
          rig.defaultFocusWorld = focusWorld;
          if (rig.cameras) {
            Object.values(rig.cameras).forEach((cam) => {
              cam?.head?.lookAt(focusWorld);
            });
          }
        }
        world.updateMatrixWorld(true);
      };
      let cue;
      let clothMat;
      let cushionMat;
      const tableSurfaceY = TABLE_Y - TABLE.THICK + 0.01;
      let baseSurfaceWorldY = tableSurfaceY * WORLD_SCALE;
      let shooting = false; // track when a shot is in progress
      const setShootingState = (value) => {
        if (shooting === value) return;
        shooting = value;
        setShotActive(value);
      };
      let activeShotView = null;
      let suspendedActionView = null;
      let shotPrediction = null;
      let lastShotPower = 0;
      let prevCollisions = new Set();
      let cueAnimating = false; // forward stroke animation state
      const dynamicTextureEntries = [];
      const registerDynamicTexture = (entry) => {
        if (!entry || !entry.texture || typeof entry.update !== 'function') {
          return null;
        }
        dynamicTextureEntries.push(entry);
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
        const resolutionScale = 1;
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
            ctx.fillText('Snooker Match of the Day', width / 2, 60);
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
      const roomDepth = TABLE.H * 3.6;
      const sideClearance = roomDepth / 2 - TABLE.H / 2;
      const roomWidth = TABLE.W + sideClearance * 2;
      const wallThickness = 1.2;
      const wallHeightBase = legHeight + TABLE.THICK + 40;
      const wallHeight = wallHeightBase * 1.3 * 1.3; // raise arena walls by an additional 30%
      const carpetThickness = 1.2;
      const carpetInset = wallThickness * 0.02;
      const carpetWidth = roomWidth - wallThickness + carpetInset;
      const carpetDepth = roomDepth - wallThickness + carpetInset;
      const carpetTextures = createCarpetTextures();
      const carpetMat = new THREE.MeshStandardMaterial({
        color: 0x8c2a2e,
        roughness: 0.9,
        metalness: 0.025
      });
      if (carpetTextures.map) {
        carpetMat.map = carpetTextures.map;
        carpetMat.map.repeat.set(1, 1);
        carpetMat.map.needsUpdate = true;
      }
      if (carpetTextures.bump) {
        carpetMat.bumpMap = carpetTextures.bump;
        carpetMat.bumpMap.repeat.set(1, 1);
        carpetMat.bumpScale = 0.18;
        carpetMat.bumpMap.needsUpdate = true;
      }
      const carpet = new THREE.Mesh(
        new THREE.BoxGeometry(carpetWidth, carpetThickness, carpetDepth),
        carpetMat
      );
      carpet.castShadow = false;
      carpet.receiveShadow = true;
      carpet.position.set(0, floorY - carpetThickness / 2, 0);
      world.add(carpet);

      const wallMat = new THREE.MeshStandardMaterial({
        color: 0xb9ddff,
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

      const billboardTexture = registerDynamicTexture(createTickerEntry());
      const signageFrameMat = new THREE.MeshStandardMaterial({
        color: 0x1f2937,
        roughness: 0.5,
        metalness: 0.6
      });
      const signageScale = 3;
      const billboardScale = 0.8;
      const signageDepth = 0.8 * signageScale * billboardScale;
      const signageWidth =
        Math.min(roomWidth * 0.58, 52) * signageScale * billboardScale;
      const signageHeight =
        Math.min(wallHeight * 0.28, 12) * signageScale * billboardScale;
      const makeScreenMaterial = (texture) => {
        const material = new THREE.MeshBasicMaterial({ toneMapped: false });
        if (texture) {
          material.map = texture;
        } else {
          material.color = new THREE.Color(0x0f172a);
        }
        return material;
      };
      const createBillboardAssembly = () => {
        const assembly = new THREE.Group();
        const frame = new THREE.Mesh(
          new THREE.BoxGeometry(signageWidth, signageHeight, signageDepth),
          signageFrameMat
        );
        frame.castShadow = false;
        frame.receiveShadow = true;
        assembly.add(frame);
        const billboardScreen = new THREE.Mesh(
          new THREE.PlaneGeometry(signageWidth * 0.94, signageHeight * 0.82),
          makeScreenMaterial(billboardTexture)
        );
        billboardScreen.position.z = signageDepth / 2 + 0.03;
        assembly.add(billboardScreen);
        return assembly;
      };
      const signageY = floorY + wallHeight * 0.58;
      const wallInset = wallThickness / 2 + 0.2;
      const frontInterior = -roomDepth / 2 + wallInset;
      const backInterior = roomDepth / 2 - wallInset;
      const leftInterior = -roomWidth / 2 + wallInset;
      const rightInterior = roomWidth / 2 - wallInset;
      [
        {
          position: [leftInterior, signageY, 0],
          rotationY: Math.PI / 2
        },
        {
          position: [rightInterior, signageY, 0],
          rotationY: -Math.PI / 2
        }
      ].forEach(({ position, rotationY }) => {
        const signage = createBillboardAssembly();
        signage.position.set(position[0], position[1], position[2]);
        signage.rotation.y = rotationY;
        world.add(signage);
      });

      cueRackGroupsRef.current = [];
      cueOptionGroupsRef.current = [];
      cueRackMetaRef.current = new Map();

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
      const availableHalfDepth =
        roomDepth / 2 - wallThickness - cueRackHalfWidth - BALL_R * 2;
      const desiredOffset = signageWidth / 2 + cueRackHalfWidth + BALL_R * 4;
      const cueRackOffset = Math.max(
        cueRackHalfWidth,
        Math.min(availableHalfDepth, desiredOffset)
      );
      const cueRackY = signageY;
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

      const broadcastClearance = wallThickness * 1.1 + BALL_R * 4;
      const shortRailTarget = Math.max(
        PLAY_H / 2 + BALL_R * 8, // keep a modest clearance so the broadcast cameras sit closer to the table
        roomDepth / 2 - wallThickness - broadcastClearance
      );
      const shortRailSlideLimit = CAMERA_LATERAL_CLAMP.short * 0.92;
      const broadcastRig = createBroadcastCameras({
        floorY,
        cameraHeight: TABLE_Y + TABLE.THICK + BALL_R * 9.2,
        shortRailZ: shortRailTarget,
        slideLimit: shortRailSlideLimit,
        arenaHalfWidth: roomWidth / 2 - wallThickness - BALL_R * 4,
        arenaHalfDepth: roomDepth / 2 - wallThickness - BALL_R * 4
      });
      world.add(broadcastRig.group);
      broadcastCamerasRef.current = broadcastRig;

      const tripodHeightBoost = 1.04;
      const tripodScale =
        ((TABLE_Y + BALL_R * 6 - floorY) / 1.33) * tripodHeightBoost;
      const tripodTilt = THREE.MathUtils.degToRad(-12);
      const tripodProximityPull = BALL_R * 2.5;
      const tripodExtra = Math.max(BALL_R * 2, BALL_R * 6 - tripodProximityPull);
      const tripodDesiredZ =
        Math.max(PLAY_H / 2 + BALL_R * 12, shortRailTarget - BALL_R * 6) +
        tripodExtra;
      const tripodMaxZ = roomDepth / 2 - wallThickness - BALL_R * 4;
      const tripodZOffset = Math.min(tripodMaxZ, tripodDesiredZ);
      const tripodSideTuck = BALL_R * 1.5;
      const tripodDesiredX =
        TABLE.W / 2 + BALL_R * 12 + tripodExtra - tripodSideTuck;
      const tripodMaxX = roomWidth / 2 - wallThickness - 0.6;
      const tripodXOffset = Math.min(tripodMaxX, tripodDesiredX);
      const tripodTarget = new THREE.Vector3(0, TABLE_Y + TABLE.THICK * 0.5, 0);
      const tripodPositions = [
        { x: tripodXOffset, z: tripodZOffset },
        { x: -tripodXOffset, z: tripodZOffset },
        { x: tripodXOffset, z: -tripodZOffset },
        { x: -tripodXOffset, z: -tripodZOffset }
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

      const createCornerHospitalitySet = ({ chairOffset, position, rotationY }) => {
        const group = new THREE.Group();
        const scaledFurniture = furnitureScale * hospitalitySizeMultiplier;

        const tableSet = createTableSet();
        tableSet.scale.setScalar(scaledFurniture);
        const chairVector = new THREE.Vector2(chairOffset[0], chairOffset[1]);
        const chairDistance = chairVector.length();
        if (chairDistance > 1e-6) {
          const tablePull = Math.min(
            chairDistance * 0.35,
            toHospitalityUnits(0.12) * hospitalityUpscale
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

        group.position.set(position[0], floorY, position[1]);
        group.rotation.y = rotationY;
        ensureHospitalityVisibility(group);
        return group;
      };

      const showHospitalityFurniture = false;
      if (showHospitalityFurniture) {
        const rawCornerInset =
          toHospitalityUnits(0.58) * hospitalityUpscale + wallThickness * 0.5;
        const cornerInsetX = Math.min(rawCornerInset, Math.abs(leftInterior) * 0.92);
        const cornerInsetFront = Math.min(
          rawCornerInset,
          Math.abs(frontInterior) * 0.92
        );
        const cornerInsetBack = Math.min(
          rawCornerInset,
          Math.abs(backInterior) * 0.92
        );
        const chairSideOffset = toHospitalityUnits(0.56) * hospitalityUpscale;
        const chairForwardOffset = toHospitalityUnits(0.74) * hospitalityUpscale;

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
          const blend = THREE.MathUtils.clamp(
            nextBlend ?? cameraBlendRef.current,
            0,
            1
          );
          cameraBlendRef.current = blend;
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
          const safePhi = Math.min(rawPhi, phiRailLimit - CAMERA_RAIL_SAFETY);
          const topViewMinPhi = topViewRef.current ? 0.0001 : CAMERA.minPhi;
          const topViewMaxPhi = topViewRef.current
            ? Math.max(CAMERA.maxPhi, Math.PI / 2)
            : CAMERA.maxPhi;
          const clampedPhi = clamp(safePhi, topViewMinPhi, topViewMaxPhi);
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
          sph.phi = clampedPhi;
          sph.radius = clampOrbitRadius(finalRadius, cueMinRadius);
          syncBlendToSpherical();
        };


        const updateBroadcastCameras = ({
          railDir = 1,
          targetWorld = null,
          focusWorld = null,
          lerp = 1
        } = {}) => {
          const rig = broadcastCamerasRef.current;
          if (!rig || !rig.cameras) return;
          const lerpFactor = THREE.MathUtils.clamp(lerp ?? 0, 0, 1);
          const focusTarget =
            focusWorld ??
            targetWorld ??
            rig.defaultFocusWorld ??
            rig.defaultFocus ??
            null;
          const applyFocus = (unit, lookAt, t) => {
            if (!unit) return;
            if (unit.slider) {
              const settle = Math.max(THREE.MathUtils.clamp(t ?? 0, 0, 1), 0.5);
              const limit = Math.max(
                unit.slider.userData?.slideLimit ?? rig.slideLimit ?? 0,
                0
              );
              const targetX = lookAt
                ? THREE.MathUtils.clamp(lookAt.x * 0.25, -limit, limit)
                : 0;
              unit.slider.position.x = THREE.MathUtils.lerp(
                unit.slider.position.x,
                targetX,
                settle
              );
              unit.slider.position.z = THREE.MathUtils.lerp(
                unit.slider.position.z,
                0,
                settle
              );
            }
            if (lookAt && unit.head) {
              unit.head.lookAt(lookAt);
            }
          };
          const frontUnits = [rig.cameras.front].filter(Boolean);
          const backUnits = [rig.cameras.back].filter(Boolean);
          const activeUnits = railDir >= 0 ? backUnits : frontUnits;
          const idleUnits = railDir >= 0 ? frontUnits : backUnits;
          activeUnits.forEach((unit) =>
            applyFocus(unit, focusTarget, lerpFactor)
          );
          const idleFocus = rig.defaultFocusWorld ?? focusTarget;
          idleUnits.forEach((unit) =>
            applyFocus(unit, idleFocus, Math.min(1, lerpFactor * 0.6))
          );
        };

        const updateCamera = () => {
          let renderCamera = camera;
          let lookTarget = null;
          let broadcastArgs = {
            railDir: 1,
            targetWorld: null,
            focusWorld: broadcastCamerasRef.current?.defaultFocusWorld ?? null,
            lerp: 0.18
          };
          const galleryState = cueGalleryStateRef.current;
          if (galleryState?.active) {
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
          } else if (topViewRef.current) {
            lookTarget = getDefaultOrbitTarget().multiplyScalar(
              worldScaleFactor
            );
            camera.position.set(lookTarget.x, sph.radius, lookTarget.z);
            camera.lookAt(lookTarget);
            renderCamera = camera;
            broadcastArgs.focusWorld =
              broadcastCamerasRef.current?.defaultFocusWorld ?? lookTarget;
            broadcastArgs.targetWorld = null;
          } else if (activeShotView?.mode === 'action') {
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
              if (activeShotView.stage === 'pair') {
                const targetBall =
                  activeShotView.targetId != null
                    ? ballsList.find((b) => b.id === activeShotView.targetId)
                    : null;
                let targetPos2;
                if (targetBall?.active) {
                  targetPos2 = new THREE.Vector2(targetBall.pos.x, targetBall.pos.y);
                  activeShotView.targetLastPos = targetPos2.clone();
                } else if (activeShotView.targetLastPos) {
                  targetPos2 = activeShotView.targetLastPos.clone();
                } else {
                  targetPos2 = cuePos2.clone().add(new THREE.Vector2(0, BALL_R * 6));
                }
                const mid = cuePos2.clone().add(targetPos2).multiplyScalar(0.5);
                const span = Math.max(targetPos2.distanceTo(cuePos2), BALL_R * 4);
                const forward = targetPos2.clone().sub(cuePos2);
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
                  const desiredDistance = baseDistance + longShotPullback;
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
                  lookAnchor.z = THREE.MathUtils.lerp(
                    lookAnchor.z,
                    -railDir * BALL_R * (activeShotView.longShot ? 6.5 : 4),
                    0.65
                  );
                  applyStandingViewElevation(desired, lookAnchor, heightBase);
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
                  applyStandingViewElevation(desired, lookAnchor, heightBase);
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
                  const desiredDistance = baseDistance + longShotPullback;
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
                  lookAnchor.z = THREE.MathUtils.lerp(
                    lookAnchor.z,
                    -railDir * BALL_R * (activeShotView.longShot ? 7.5 : 5),
                    0.65
                  );
                  applyStandingViewElevation(desired, lookAnchor, heightBase);
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
                  applyStandingViewElevation(desired, lookAnchor, heightBase);
                  focusTargetVec3 = lookAnchor.multiplyScalar(worldScaleFactor);
                  desiredPosition = desired.multiplyScalar(worldScaleFactor);
                }
              }
              broadcastArgs = {
                railDir,
                targetWorld: desiredPosition ?? null,
                focusWorld: focusTargetVec3 ?? null,
                lerp: lerpT
              };
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
          } else if (activeShotView?.mode === 'pocket') {
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
              activeShotView.anchorType ?? 'short';
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
            broadcastArgs = {
              railDir,
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
            const focusHeightLocal = BALL_CENTER_Y + BALL_R * 0.25;
            const focusTarget = new THREE.Vector3(
              0,
              focusHeightLocal,
              0
            ).multiplyScalar(worldScaleFactor);
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
              return Math.max(standingRadius, pocketRadius + minOutside);
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
            const aimFocus = !shooting && cue?.active ? aimFocusRef.current : null;
            let focusTarget;
            if (
              aimFocus &&
              Number.isFinite(aimFocus.x) &&
              Number.isFinite(aimFocus.y) &&
              Number.isFinite(aimFocus.z)
            ) {
              focusTarget = aimFocus.clone();
            } else if (cue?.active && !shooting) {
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
          TMP_SPH.copy(sph);
          if (TMP_SPH.radius > 1e-6) {
            const aimLineWorldY =
              (AIM_LINE_MIN_Y + CAMERA_AIM_LINE_MARGIN) * worldScaleFactor;
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
          const surfaceMarginWorld = Math.max(0, CAMERA_SURFACE_STOP_MARGIN) *
            (Number.isFinite(worldScaleFactor) ? worldScaleFactor : WORLD_SCALE);
          const surfaceClampY = baseSurfaceWorldY + surfaceMarginWorld;
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
                topViewMinPhi,
                topViewMaxPhi
              );
              TMP_SPH.radius = sph.radius;
              TMP_SPH.phi = sph.phi;
            }
          }
          camera.lookAt(lookTarget);
          renderCamera = camera;
          broadcastArgs.focusWorld =
            broadcastCamerasRef.current?.defaultFocusWorld ?? lookTarget;
          broadcastArgs.targetWorld = null;
          broadcastArgs.lerp = 0.22;
          }
          if (lookTarget) {
            lastCameraTargetRef.current.copy(lookTarget);
          }
          if (clothMat && lookTarget) {
            const dist = renderCamera.position.distanceTo(lookTarget);
            const fade = THREE.MathUtils.clamp((120 - dist) / 45, 0, 1);
            const nearRepeat = clothMat.userData?.nearRepeat ?? 32;
            const farRepeat = clothMat.userData?.farRepeat ?? 18;
            const ratio = clothMat.userData?.repeatRatio ?? 1;
            const targetRepeat = THREE.MathUtils.lerp(farRepeat, nearRepeat, fade);
            const targetRepeatY = targetRepeat * ratio;
            if (clothMat.map) {
              clothMat.map.repeat.set(targetRepeat, targetRepeatY);
            }
            if (clothMat.bumpMap) {
              clothMat.bumpMap.repeat.set(targetRepeat, targetRepeatY);
            }
            if (Number.isFinite(clothMat.userData?.bumpScale)) {
              const base = clothMat.userData.bumpScale;
              clothMat.bumpScale = THREE.MathUtils.lerp(base * 0.55, base * 1.4, fade);
            }
          }
          updateBroadcastCameras(broadcastArgs);
          activeRenderCameraRef.current = renderCamera;
          return renderCamera;
        };
        updateCameraRef.current = updateCamera;
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

        const animateWorldScale = (
          fromScale,
          toScale,
          duration = TABLE_GROWTH_DURATION_MS
        ) => {
          const startTime = performance.now();
          const easedStep = (now) => {
            const t = Math.min(1, (now - startTime) / Math.max(1, duration));
            const eased = t * t * (3 - 2 * t);
            const nextScale = THREE.MathUtils.lerp(fromScale, toScale, eased);
            applyWorldScale(nextScale);
            updateCamera();
            if (t < 1) {
              requestAnimationFrame(easedStep);
            }
          };
          applyWorldScale(fromScale);
          requestAnimationFrame(easedStep);
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
            resumeAction.stage = 'followCue';
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
          const initialRailDir =
            axis === 'side'
              ? signed(
                  railNormal?.x ?? cueBall.pos.x ?? cueBall.launchDir?.x ?? 1
                )
              : signed(
                  cueBall.pos.y ??
                    cueBall.launchDir?.y ??
                    railNormal?.y ??
                    1
                );
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
            stage: targetId ? 'pair' : 'followCue',
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
            hasSwitchedRail: false,
            railNormal: railNormal ? railNormal.clone() : null,
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
          let anchorId =
            resolvePocketCameraAnchor(
              anchorPocketId,
              best.center,
              approachDir,
              pos
            ) ?? anchorPocketId;
          let anchorOutward = getPocketCameraOutward(anchorId);
          const isSidePocket = anchorPocketId === 'TM' || anchorPocketId === 'BM';
          let anchorSwapped = false;
          if (isSidePocket) {
            const anchorCenter = getPocketCenterById(anchorId);
            if (anchorCenter) {
              const distanceToAnchor = Math.abs(pos.y - anchorCenter.y);
              if (distanceToAnchor < SIDE_POCKET_SWITCH_THRESHOLD) {
                const opposite = oppositeShortRailAnchor(anchorId);
                if (opposite && opposite !== anchorId) {
                  anchorId = opposite;
                  anchorOutward =
                    getPocketCameraOutward(opposite) ?? anchorOutward;
                  anchorSwapped = true;
                }
              }
            }
          }
          const forcedEarly = forceEarly && shotPrediction?.ballId === ballId;
          if (best.dist > POCKET_CAM.triggerDist && !forcedEarly) return null;
          const baseHeightOffset = POCKET_CAM.heightOffset;
          const shortPocketHeightMultiplier =
            POCKET_CAM.heightOffsetShortMultiplier ?? 1;
          const heightOffset = isSidePocket
            ? baseHeightOffset * 0.92
            : baseHeightOffset * shortPocketHeightMultiplier;
          const railDir = signed(best.center.y, 1);
          const lateralSign = signed(best.center.x, 1);
          const fallbackOutward = isSidePocket
            ? new THREE.Vector2(-lateralSign * 0.35, -railDir).normalize()
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
          const predictedAlignment =
            shotPrediction?.ballId === ballId && shotPrediction?.dir
              ? shotPrediction.dir.clone().normalize().dot(best.pocketDir)
              : null;
          const minOutside = isSidePocket
            ? POCKET_CAM.minOutside
            : POCKET_CAM.minOutsideShort ?? POCKET_CAM.minOutside;
          let cameraDistance = THREE.MathUtils.clamp(
            effectiveDist * POCKET_CAM.distanceScale,
            minOutside,
            POCKET_CAM.maxOutside
          );
          if (isSidePocket) {
            const zoomFactor = anchorSwapped ? 0.85 : 0.9;
            cameraDistance = Math.max(minOutside, cameraDistance * zoomFactor);
          }
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
            anchorType: 'short',
            railDir,
            anchorId,
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
        setTopView(false);
        setTopView(false);
        const margin = Math.max(
          STANDING_VIEW.margin,
          topViewRef.current
            ? 1.05
            : window.innerHeight > window.innerWidth
              ? STANDING_VIEW_MARGIN_PORTRAIT
              : STANDING_VIEW_MARGIN_LANDSCAPE
        );
        fit(margin);
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
          toggleChalkAssist(hit.userData?.chalkIndex ?? null);
          return true;
        };
        const down = (e) => {
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
          if (attemptCueGalleryPress(e)) return;
          if (attemptChalkPress(e)) return;
          const currentHud = hudRef.current;
          if (currentHud?.turn === 1 || currentHud?.inHand || shooting) return;
          if (e.touches?.length === 2) return;
          if (topViewRef.current) return;
          drag.on = true;
          drag.moved = false;
          drag.x = e.clientX || e.touches?.[0]?.clientX || 0;
          drag.y = e.clientY || e.touches?.[0]?.clientY || 0;
        };
        const move = (e) => {
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
          if (topViewRef.current || !drag.on) return;
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
              CUE_VIEW_AIM_SLOW_FACTOR,
              1,
              blend
            );
            const slowScale =
              chalkAssistEnabledRef.current && chalkAssistTargetRef.current
                ? CHALK_PRECISION_SLOW_MULTIPLIER
                : 1;
            const precisionScale = basePrecisionScale * slowScale;
            sph.theta -= dx * 0.0035 * precisionScale;
            const phiRange = CAMERA.maxPhi - CAMERA.minPhi;
            const phiDelta = dy * 0.0025 * precisionScale;
            const blendDelta =
              phiRange > 1e-5 ? phiDelta / phiRange : 0;
            applyCameraBlend(cameraBlendRef.current - blendDelta);
            updateCamera();
            registerInteraction();
          }
        };
        const up = (e) => {
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
          if (topViewRef.current) return;
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
      // Adopt the lighting rig from the standalone snooker demo and scale all
      // authored coordinates so they sit correctly over the larger table.
      const addMobileLighting = () => {
        const lightingRig = new THREE.Group();
        world.add(lightingRig);

        const SAMPLE_PLAY_W = 1.216;
        const SAMPLE_PLAY_H = 2.536;
        const SAMPLE_TABLE_HEIGHT = 0.75;

        const LIGHT_DIMENSION_SCALE = 0.8; // reduce fixture footprint by 20%
        const LIGHT_HEIGHT_SCALE = 1.4; // lift the rig further above the table
        const LIGHT_HEIGHT_LIFT_MULTIPLIER = 5.8; // bring fixtures closer so the spot highlight reads on the balls
        const LIGHT_LATERAL_SCALE = 0.45; // pull shadow-casting lights nearer the table centre

        const baseWidthScale = (PLAY_W / SAMPLE_PLAY_W) * LIGHT_DIMENSION_SCALE;
        const baseLengthScale = (PLAY_H / SAMPLE_PLAY_H) * LIGHT_DIMENSION_SCALE;
        const fixtureScale = Math.max(baseWidthScale, baseLengthScale);
        const heightScale = Math.max(0.001, TABLE_H / SAMPLE_TABLE_HEIGHT);
        const scaledHeight = heightScale * LIGHT_HEIGHT_SCALE;

        const hemisphere = new THREE.HemisphereLight(0xdde7ff, 0x0b1020, 0.758625);
        const lightHeightLift = scaledHeight * LIGHT_HEIGHT_LIFT_MULTIPLIER; // lift the lighting rig higher above the table
        const triangleHeight = tableSurfaceY + 6.6 * scaledHeight + lightHeightLift;
        const triangleRadius = fixtureScale * 0.98;
        const lightRetreatOffset = scaledHeight * 0.24;
        const lightReflectionGuard = scaledHeight * 0.32;
        hemisphere.position.set(0, triangleHeight, -triangleRadius * 0.6);
        lightingRig.add(hemisphere);

        const hemisphereRig = new THREE.HemisphereLight(0xdde7ff, 0x0b1020, 0.4284);
        hemisphereRig.position.set(0, triangleHeight, 0);
        lightingRig.add(hemisphereRig);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1.176);
        dirLight.position.set(
          -triangleRadius * LIGHT_LATERAL_SCALE,
          triangleHeight,
          triangleRadius * LIGHT_LATERAL_SCALE * 0.4
        );
        dirLight.target.position.set(0, tableSurfaceY + BALL_R * 0.05, 0);
        lightingRig.add(dirLight);
        lightingRig.add(dirLight.target);

        const spot = new THREE.SpotLight(
          0xffffff,
          12.289725,
          0,
          Math.PI * 0.36,
          0.42,
          1
        );
        spot.position.set(
          triangleRadius * LIGHT_LATERAL_SCALE,
          triangleHeight + lightRetreatOffset + lightReflectionGuard,
          triangleRadius * LIGHT_LATERAL_SCALE * (0.35 + LIGHT_LATERAL_SCALE * 0.12)
        );
        spot.target.position.set(0, tableSurfaceY + TABLE_H * 0.18, 0);
        spot.decay = 1.0;
        spot.castShadow = true;
        spot.shadow.mapSize.set(2048, 2048);
        spot.shadow.bias = -0.00004;
        spot.shadow.normalBias = 0.006;
        lightingRig.add(spot);
        lightingRig.add(spot.target);

        const ambient = new THREE.AmbientLight(0xffffff, 0.0223125);
        ambient.position.set(
          0,
          tableSurfaceY +
            scaledHeight * 1.95 +
            lightHeightLift +
            lightRetreatOffset +
            lightReflectionGuard,
          triangleRadius * LIGHT_LATERAL_SCALE * 0.12
        );
        lightingRig.add(ambient);
      };

      addMobileLighting();

      // Table
      const finishForScene = tableFinishRef.current;
      const {
        centers,
        baulkZ,
        group: table,
        clothMat: tableCloth,
        cushionMat: tableCushion
      } = Table3D(world, finishForScene);
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
      };
      if (table?.userData) {
        const cushionLip = table.userData.cushionTopLocal ?? TABLE.THICK;
        cushionHeightRef.current = Math.max(TABLE.THICK + 0.1, cushionLip - 0.02);
      }
      // ensure the camera respects the configured zoom limits
      sph.radius = clampOrbitRadius(sph.radius);
      const growthStartScale = WORLD_SCALE;
      const growthTargetScale = WORLD_SCALE * TABLE_GROWTH_MULTIPLIER;
      applyWorldScale(growthStartScale);
      updateCamera();
      fit(
        topViewRef.current
          ? 1.05
          : window.innerHeight > window.innerWidth
            ? 1.6
            : 1.4
      );
      animateWorldScale(growthStartScale, growthTargetScale);

      // Balls (ONLY Guret)
      const finishPalette = finishForScene?.colors ?? TABLE_FINISHES[DEFAULT_TABLE_FINISH_ID].colors;
      const add = (id, color, x, z) => {
        const b = Guret(table, id, color, x, z);
        balls.push(b);
        return b;
      };
      cue = add('cue', finishPalette.cue, -BALL_R * 2, baulkZ);
      const SPOTS = spotPositions(baulkZ);

      // 15 red balls arranged in triangle behind the pink
      const startZ = SPOTS.pink[1] + BALL_R * 2;
      let rid = 0;
      for (let row = 0; row < 5; row++) {
        for (let i = 0; i <= row; i++) {
          if (rid >= 15) break;
          const x = (i - row / 2) * (BALL_R * 2 + 0.002 * (BALL_R / 0.0525));
          const z = startZ + row * (BALL_R * 1.9);
          add(`red_${rid++}`, finishPalette.red, x, z);
        }
      }

      // colours
      const colors = Object.fromEntries(
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
        if (info) {
          info.tipCompensation = tipComp;
          info.current = totalTilt;
          info.extra = extraTilt;
        }
      };
      cueStick.userData.buttTilt = {
        angle: buttTilt,
        tipCompensation: buttTipComp,
        length: cueLen
      };

      const shaftMaterial = new THREE.MeshPhysicalMaterial({ color: 0xffffff });
      applyWoodTextureToMaterial(shaftMaterial, CUE_WOOD_REPEAT);
      cueMaterialsRef.current.shaft = shaftMaterial;
      const frontLength = THREE.MathUtils.clamp(
        cueLen * CUE_FRONT_SECTION_RATIO,
        cueLen * 0.1,
        cueLen * 0.5
      );
      const rearLength = Math.max(cueLen - frontLength, 1e-4);
      const tipShaftRadius = 0.008 * SCALE;
      const buttShaftRadius = 0.025 * SCALE;
      const joinRadius = THREE.MathUtils.lerp(
        tipShaftRadius,
        buttShaftRadius,
        THREE.MathUtils.clamp(frontLength / Math.max(cueLen, 1e-4), 0, 1)
      );

      const rearShaft = new THREE.Mesh(
        new THREE.CylinderGeometry(joinRadius, buttShaftRadius, rearLength, 32),
        shaftMaterial
      );
      rearShaft.rotation.x = -Math.PI / 2;
      rearShaft.position.z = frontLength / 2;
      cueBody.add(rearShaft);

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
      cueBody.add(buttCap);

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
        cueBody.add(stripe);
      }

      cueStick.position.set(cue.pos.x, CUE_Y, cue.pos.y + 1.2 * SCALE);
      applyCueButtTilt(cueStick);
      // thin side already faces the cue ball so no extra rotation
      cueStick.visible = false;
      table.add(cueStick);
      applySelectedCueStyle(cueStyleIndexRef.current ?? cueStyleIndex);

      const closeCueGallery = () => {
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
        applyCameraBlend(cameraBlendRef.current);
        updateCamera();
        setCueGalleryActive(true);
      };

      const attemptCueGalleryPress = (ev) => {
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

      const attemptCueSelection = (ev) => {
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
        const paletteLength = CUE_RACK_PALETTE.length || 1;
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
      const free = (x, z) =>
        balls.every(
          (b) =>
            !b.active ||
            b === cue ||
            new THREE.Vector2(x, z).distanceTo(b.pos) > BALL_R * 2.1
        );
      const clampInHandPosition = (point) => {
        if (!point) return null;
        const clamped = point.clone();
        const limitX = PLAY_W / 2 - BALL_R;
        clamped.x = THREE.MathUtils.clamp(clamped.x, -limitX, limitX);
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
        return clamped;
      };
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
        if (!free(clamped.x, clamped.y)) return false;
        cue.active = false;
        updateCuePlacement(clamped);
        inHandDrag.lastPos = clamped;
        if (commit) {
          cue.active = true;
          inHandDrag.lastPos = null;
          setHud((s) => ({ ...s, inHand: false }));
        }
        return true;
      };
      const handleInHandDown = (e) => {
        const currentHud = hudRef.current;
        if (!(currentHud?.inHand)) return;
        if (shooting) return;
        if (e.button != null && e.button !== 0) return;
        const p = project(e);
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
        }
        e.preventDefault?.();
      };
      dom.addEventListener('pointerdown', handleInHandDown);
      dom.addEventListener('pointermove', handleInHandMove);
      window.addEventListener('pointerup', endInHandDrag);
      dom.addEventListener('pointercancel', endInHandDrag);
      window.addEventListener('pointercancel', endInHandDrag);
      if (hudRef.current?.inHand) {
        const startPos = clampInHandPosition(new THREE.Vector2(0, baulkZ));
        if (startPos) {
          cue.active = false;
          updateCuePlacement(startPos);
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

      // Fire (slider e thërret në release)
      const fire = () => {
        const currentHud = hudRef.current;
        if (
          !cue?.active ||
          currentHud?.inHand ||
          !allStopped(balls) ||
          currentHud?.over
        )
          return;
        alignStandingCameraToAim(cue, aimDirRef.current);
        applyCameraBlend(1);
        updateCamera();
        setShootingState(true);
          activeShotView = null;
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
          shotPrediction = {
            ballId: prediction.targetBall?.id ?? null,
            dir: prediction.afterDir ? prediction.afterDir.clone() : null,
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
          playCueHit(clampedPower * 0.6);
          const powerScale = SHOT_MIN_FACTOR + SHOT_POWER_RANGE * clampedPower;
          const base = aimDir
            .clone()
            .multiplyScalar(SHOT_BASE_SPEED * powerScale);
          const predictedCueSpeed = base.length();
          shotPrediction.speed = predictedCueSpeed;
          const allowLongShotCameraSwitch =
            !isShortShot &&
            (!isLongShot || predictedCueSpeed <= LONG_SHOT_SPEED_SWITCH_THRESHOLD);
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
            shotPrediction.ballId && followView
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
          if (earlyPocketView) {
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
            updatePocketCameraState(true);
            activeShotView = earlyPocketView;
            pocketViewActivated = true;
          }
          if (!pocketViewActivated && actionView) {
            if (isLongShot) {
              suspendedActionView = actionView;
            } else {
              suspendedActionView = null;
              activeShotView = actionView;
              updateCamera();
            }
          }
          const appliedSpin = applySpinConstraints(aimDir, true);
          const ranges = spinRangeRef.current || {};
          const baseSide = appliedSpin.x * (ranges.side ?? 0);
          let spinSide = baseSide * SIDE_SPIN_MULTIPLIER;
          let spinTop = -appliedSpin.y * (ranges.forward ?? 0);
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

          if (cameraRef.current && sphRef.current) {
            topViewRef.current = false;
            setTopView(false);
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
          const dir = new THREE.Vector3(aimDir.x, 0, aimDir.y).normalize();
          const backInfo = calcTarget(
            cue,
            aimDir.clone().multiplyScalar(-1),
            balls
          );
          const rawMaxPull = Math.max(0, backInfo.tHit - cueLen - CUE_TIP_GAP);
          const maxPull = Number.isFinite(rawMaxPull) ? rawMaxPull : CUE_PULL_BASE;
          const pull = Math.min(maxPull, CUE_PULL_BASE) * clampedPower;
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
                    setTopView(false);
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
          }, AI_EARLY_SHOT_DELAY_MS);
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
          if (!plan || plan.type !== 'pot') {
            if (plan) {
              plan.positioningScore = 0;
              plan.positioningTarget = null;
            }
            return fallback;
          }
          const colorId = plan.target;
          if (!colorId) return fallback;
          try {
            const events = [
              { type: 'HIT', firstContact: colorId },
              { type: 'POTTED', ball: colorId, pocket: plan.pocketId ?? 'TL' }
            ];
            const nextState = rules.applyShot(stateSnapshot, events);
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
            const spinY = THREE.MathUtils.clamp(-forward * 0.35, -0.6, 0.6);
            const nextSeparation = nextBall.pos.distanceTo(plan.targetBall.pos);
            const alignmentScore = Math.max(0, forward) * 120;
            const coverageScore = Math.max(0, 1 - Math.abs(lateral)) * 60;
            const distancePenalty = Math.min(nextSeparation * 0.18, 90);
            plan.positioningScore = Math.max(0, alignmentScore + coverageScore - distancePenalty);
            plan.positioningTarget = nextBall.id;
            return { x: spinX, y: spinY };
          } catch (err) {
            console.warn('spin prediction failed', err);
            if (plan) {
              plan.positioningScore = 0;
              plan.positioningTarget = null;
            }
            return fallback;
          }
        };
        const evaluateShotOptions = () => {
          if (!cue?.active)
            return { bestPot: null, bestSafety: null, bestEscape: null, snookered: false };
          const state = frameRef.current ?? frameState;
          const legalTargetsRaw = Array.isArray(state?.ballOn)
            ? state.ballOn
            : ['RED'];
          const legalTargets = new Set(
            legalTargetsRaw
              .map((entry) =>
                typeof entry === 'string' ? entry.toUpperCase() : entry
              )
              .filter(Boolean)
          );
          if (legalTargets.size === 0) legalTargets.add('RED');
          const activeBalls = balls.filter((b) => b.active);
          const cuePos = cue.pos.clone();
          const clearance = BALL_R * 1.85;
          const clearanceSq = clearance * clearance;
          const ballDiameter = BALL_R * 2;
          const safetyAnchor = new THREE.Vector2(0, baulkZ - D_RADIUS * 0.5);
          const cushionSpecs = [
            { axis: 'x', value: -RAIL_LIMIT_X, id: 'LX' },
            { axis: 'x', value: RAIL_LIMIT_X, id: 'RX' },
            { axis: 'y', value: -RAIL_LIMIT_Y, id: 'TY' },
            { axis: 'y', value: RAIL_LIMIT_Y, id: 'BY' }
          ];
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
          const potShots = [];
          const safetyShots = [];
          const escapeShots = [];
          let snookered = true;
          let fallbackPlan = null;
          const tryAddHideSafety = (basePlan, targetBall) => {
            const blockers = activeBalls.filter(
              (ball) =>
                ball !== cue &&
                ball !== targetBall &&
                ball.active &&
                ball.pos.distanceToSquared(targetBall.pos) <= Math.pow(PLAY_W, 2)
            );
            blockers.forEach((blocker) => {
              const blockerOffset = blocker.pos.clone().sub(targetBall.pos);
              const blockerDist = blockerOffset.length();
              if (blockerDist < BALL_R * 3 || blockerDist > BALL_R * 14) return;
              const hideDir = blockerOffset.clone().normalize();
              const hidePoint = blocker.pos.clone().add(hideDir.clone().multiplyScalar(BALL_R * 1.6));
              const ignoreAfter = new Set([targetBall.id, blocker.id]);
              if (!isPathClear(targetBall.pos, hidePoint, ignoreAfter)) return;
              const spinLat = THREE.MathUtils.clamp(-hideDir.y * 0.55, -0.65, 0.65);
              const spinLng = THREE.MathUtils.clamp(-hideDir.x * 0.55, -0.65, 0.65);
              const plan = {
                ...basePlan,
                difficulty: basePlan.difficulty * 0.85 + blockerDist * 0.3,
                hideBehind: blocker.id,
                pocketId: `SAFETY-${blocker.id}`,
                spin: {
                  x: THREE.MathUtils.clamp(basePlan.spin?.x ?? 0 + spinLat, -0.7, 0.7),
                  y: THREE.MathUtils.clamp(basePlan.spin?.y ?? 0 - 0.35, -0.75, 0.75)
                }
              };
              safetyShots.push(plan);
            });
          };
          const addCushionEscape = (targetBall, colorId) => {
            cushionSpecs.forEach((cushion) => {
              const mirror = targetBall.pos.clone();
              if (cushion.axis === 'x') {
                mirror.x = cushion.value * 2 - mirror.x;
              } else {
                mirror.y = cushion.value * 2 - mirror.y;
              }
              const dir = mirror.clone().sub(cuePos);
              const lenSq = dir.lengthSq();
              if (lenSq < 1e-6) return;
              const len = Math.sqrt(lenSq);
              const norm = dir.clone().divideScalar(len);
              const denom = cushion.axis === 'x' ? norm.x : norm.y;
              if (Math.abs(denom) < 1e-5) return;
              const t =
                cushion.axis === 'x'
                  ? (cushion.value - cuePos.x) / dir.x
                  : (cushion.value - cuePos.y) / dir.y;
              if (!Number.isFinite(t) || t <= 0 || t >= 1) return;
              const impact = cuePos.clone().add(dir.clone().multiplyScalar(t));
              if (
                (cushion.axis === 'x' && Math.abs(impact.y) > RAIL_LIMIT_Y + BALL_R * 0.5) ||
                (cushion.axis === 'y' && Math.abs(impact.x) > RAIL_LIMIT_X + BALL_R * 0.5)
              ) {
                return;
              }
              const ignoreImpact = new Set([cue.id, targetBall.id]);
              if (!isPathClear(cuePos, impact, ignoreImpact)) return;
              if (!isPathClear(impact, targetBall.pos, ignoreImpact)) return;
              const travelA = cuePos.distanceTo(impact);
              const travelB = impact.distanceTo(targetBall.pos);
              const total = travelA + travelB;
              const aimDir = impact.clone().sub(cuePos).normalize();
              escapeShots.push({
                type: 'escape',
                aimDir,
                power: computePowerFromDistance(total * 1.1),
                target: colorId,
                targetBall,
                pocketId: `ESCAPE-${cushion.id}`,
                difficulty: total * 1.5 + 320,
                cueToTarget: travelA,
                targetToPocket: travelB,
                spin: { x: 0, y: -0.05 },
                cushion: cushion.id,
                impactPoint: impact.clone()
              });
            });
          };
          activeBalls.forEach((targetBall) => {
            if (targetBall === cue) return;
            const colorId = toBallColorId(targetBall.id);
            if (!colorId || !legalTargets.has(colorId)) return;
            const ignore = new Set([cue.id, targetBall.id]);
            const directClear = isPathClear(cuePos, targetBall.pos, ignore);
            if (directClear) snookered = false;
            else addCushionEscape(targetBall, colorId);
            for (let i = 0; i < centers.length; i++) {
              const pocketCenter = centers[i];
              const toPocket = pocketCenter.clone().sub(targetBall.pos);
              const toPocketLenSq = toPocket.lengthSq();
              if (toPocketLenSq < ballDiameter * ballDiameter * 0.25) continue;
              const toPocketLen = Math.sqrt(toPocketLenSq);
              const toPocketDir = toPocket.clone().divideScalar(toPocketLen);
              if (!isPathClear(targetBall.pos, pocketCenter, ignore)) continue;
              const ghost = targetBall.pos
                .clone()
                .sub(toPocketDir.clone().multiplyScalar(ballDiameter));
              if (!isPathClear(cuePos, ghost, ignore)) continue;
              const cueVec = ghost.clone().sub(cuePos);
              const cueDist = cueVec.length();
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
              const plan = {
                type: 'pot',
                aimDir,
                power: computePowerFromDistance(totalDist),
                target: colorId,
                targetBall,
                pocketId: POCKET_IDS[i],
                pocketCenter: pocketCenter.clone(),
                difficulty:
                  cueDist + toPocketLen * 1.15 + cutAngle * BALL_R * 40,
                cueToTarget: cueDist,
                targetToPocket: toPocketLen
              };
              plan.spin = computePlanSpin(plan, state);
              if (Number.isFinite(plan.positioningScore)) {
                plan.difficulty -= plan.positioningScore;
              }
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
                spin: { x: 0, y: -0.05 }
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
              spin: { x: 0, y: -0.2 }
            };
            safetyShots.push(safetyPlan);
            tryAddHideSafety(safetyPlan, targetBall);
          });
          potShots.sort((a, b) => a.difficulty - b.difficulty);
          safetyShots.sort((a, b) => a.difficulty - b.difficulty);
          escapeShots.sort((a, b) => a.difficulty - b.difficulty);
          if (!potShots.length && !safetyShots.length && fallbackPlan) {
            safetyShots.push(fallbackPlan);
          }
          return {
            bestPot: potShots[0] ?? null,
            bestSafety: safetyShots[0] ?? null,
            bestEscape: escapeShots[0] ?? null,
            snookered
          };
        };
        const updateAiPlanningState = (plan, options, countdownSeconds) => {
          const summary = summarizePlan(plan);
          const potSummary = summarizePlan(options?.bestPot ?? null);
          const safetySummary = summarizePlan(options?.bestSafety ?? null);
          const escapeSummary = summarizePlan(options?.bestEscape ?? null);
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
              bestSafety: safetySummary,
              bestEscape: escapeSummary,
              snookered: options?.snookered ?? false
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
          const think = () => {
            if (shooting || hudRef.current?.turn !== 1) {
              setAiPlanning(null);
              aiPlanRef.current = null;
              aiThinkingHandle = null;
              clearEarlyAiShot();
              return;
            }
            const now = performance.now();
            const elapsed = now - started;
            const remaining = Math.max(0, 15000 - elapsed);
            const options = evaluateShotOptions();
            const plan =
              options.bestPot ?? options.bestSafety ?? options.bestEscape ?? null;
            if (plan) {
              aiPlanRef.current = plan;
              aimDirRef.current.copy(plan.aimDir);
              alignStandingCameraToAim(cue, plan.aimDir);
            } else {
              aiPlanRef.current = null;
            }
            updateAiPlanningState(plan, options, remaining / 1000);
            scheduleEarlyAiShot(plan);
            if (remaining > 0) {
              aiThinkingHandle = requestAnimationFrame(think);
            } else {
              aiThinkingHandle = null;
            }
          };
          think();
        };
        const updateUserSuggestion = () => {
          const options = evaluateShotOptions();
          const plan = options.bestPot ?? options.bestEscape ?? null;
          userSuggestionPlanRef.current = plan;
          const summary = summarizePlan(plan);
          userSuggestionRef.current = summary;
          if (plan?.aimDir) {
            const dir = plan.aimDir.clone();
            if (dir.lengthSq() > 1e-6) {
              dir.normalize();
              aimDirRef.current.copy(dir);
              alignStandingCameraToAim(cue, dir);
              autoAimRequestRef.current = false;
              suggestionAimKeyRef.current = summary?.key ?? null;
            } else {
              suggestionAimKeyRef.current = null;
            }
          } else {
            suggestionAimKeyRef.current = null;
          }
        };
        const computeAiShot = () => {
          const options = evaluateShotOptions();
          return options.bestPot ?? options.bestSafety ?? options.bestEscape ?? null;
        };
        stopAiThinkingRef.current = stopAiThinking;
        startAiThinkingRef.current = startAiThinking;
        startUserSuggestionRef.current = updateUserSuggestion;

        aiShoot.current = () => {
          const currentHud = hudRef.current;
          if (currentHud?.over || currentHud?.inHand || shooting) return;
          let plan = aiPlanRef.current ?? computeAiShot();
          if (!plan) {
            const cuePos = cue?.pos ? cue.pos.clone() : null;
            if (!cuePos) return;
            const fallbackDir = new THREE.Vector2(-cuePos.x, -cuePos.y);
            if (fallbackDir.lengthSq() < 1e-6) fallbackDir.set(0, 1);
            fallbackDir.normalize();
            plan = {
              type: 'safety',
              aimDir: fallbackDir,
              power: computePowerFromDistance(BALL_R * 18),
              target: 'fallback',
              spin: { x: 0, y: 0 }
            };
          }
          clearEarlyAiShot();
          stopAiThinking();
          setAiPlanning(null);
          const dir = plan.aimDir.clone().normalize();
          aimDirRef.current.copy(dir);
          topViewRef.current = false;
          setTopView(false);
          alignStandingCameraToAim(cue, dir);
          powerRef.current = plan.power;
          setHud((s) => ({ ...s, power: plan.power }));
          const spinToApply = plan.spin ?? { x: 0, y: 0 };
          spinRef.current = { ...spinToApply };
          spinRequestRef.current = { ...spinToApply };
          resetSpinRef.current?.();
          fire();
        };

        fireRef.current = fire;

      // Resolve shot
      function resolve() {
        const shotEvents = [];
        const firstContactColor = toBallColorId(firstHit);
        shotEvents.push({ type: 'HIT', firstContact: firstContactColor });
        potted.forEach((entry) => {
          const pocket = entry.pocket ?? 'TM';
          shotEvents.push({
            type: 'POTTED',
            ball: entry.color,
            pocket
          });
        });
        const currentState = frameRef.current ?? frameState;
        const nextState = rules.applyShot(currentState, shotEvents);
        if (nextState.foul) {
          const foulPoints = nextState.foul.points ?? 4;
          const foulVol = clamp(foulPoints / 7, 0, 1);
          playShock(Math.max(0.4, foulVol));
        } else {
          const deltaA =
            (nextState.players?.A?.score ?? 0) - (currentState.players?.A?.score ?? 0);
          const deltaB =
            (nextState.players?.B?.score ?? 0) - (currentState.players?.B?.score ?? 0);
          const scored = Math.max(deltaA, deltaB);
          if (scored > 0) {
            const cheerVol = clamp(scored / 7, 0, 1);
            playCheer(Math.max(0.35, cheerVol));
          } else if (nextState.frameOver) {
            playCheer(1);
          }
        }
        frameRef.current = nextState;
        setFrameState(nextState);
        const cueBallPotted =
          potted.some((entry) => entry.color === 'CUE') || !cue.active;
        const foulInHand = Boolean(nextState.foul);
        const awardInHand = cueBallPotted || foulInHand;
        const colourNames = ['yellow', 'green', 'brown', 'blue', 'pink', 'black'];
        colourNames.forEach((name) => {
          const simBall = colors[name];
          const stateBall = nextState.balls.find(
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
        if (awardInHand) {
          cue.active = false;
          pocketDropRef.current.delete(cue.id);
          const fallback = clampInHandPosition(new THREE.Vector2(0, baulkZ));
          if (fallback) {
            updateCuePlacement(fallback);
          } else {
            cue.mesh.visible = true;
          }
          cue.vel.set(0, 0);
          cue.spin?.set(0, 0);
          cue.pendingSpin?.set(0, 0);
          cue.spinMode = 'standard';
          cue.impacted = false;
          cue.launchDir = null;
        }
        setHud((prev) => ({ ...prev, inHand: awardInHand }));
        setShootingState(false);
        shotPrediction = null;
        activeShotView = null;
        suspendedActionView = null;
        pocketSwitchIntentRef.current = null;
        lastPocketBallRef.current = null;
        updatePocketCameraState(false);
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

      // Loop
      let lastStepTime = performance.now();
      const step = (now) => {
        const rawDelta = Math.max(now - lastStepTime, 0);
        const deltaMs = Math.min(rawDelta, MAX_FRAME_TIME_MS);
        const deltaSeconds = deltaMs / 1000;
        coinTicker.update(deltaSeconds);
        dynamicTextureEntries.forEach((entry) => entry.update(deltaSeconds));
        const frameScaleBase = deltaMs / TARGET_FRAME_TIME_MS;
        const frameScale = Math.max(frameScaleBase, MIN_FRAME_SCALE);
        const physicsSubsteps = Math.min(
          MAX_PHYSICS_SUBSTEPS,
          Math.max(1, Math.ceil(frameScale))
        );
        const subStepScale = frameScale / physicsSubsteps;
        lastStepTime = now;
        camera.getWorldDirection(camFwd);
        tmpAim.set(camFwd.x, camFwd.z).normalize();
        const aimLerpFactor = chalkAssistTargetRef.current
          ? CHALK_AIM_LERP_SLOW
          : 0.2;
        if (!lookModeRef.current) {
          aimDir.lerp(tmpAim, aimLerpFactor);
        }
        const appliedSpin = applySpinConstraints(aimDir, true);
        const ranges = spinRangeRef.current || {};
        const newCollisions = new Set();
        let shouldSlowAim = false;
        // Aiming vizual
        const currentHud = hudRef.current;
        if (
          allStopped(balls) &&
          currentHud?.turn === 0 &&
          !(currentHud?.inHand) &&
          cue?.active &&
          !(currentHud?.over)
        ) {
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
          const aimingWrong =
            targetBall &&
            !railNormal &&
            targetBallColor &&
            legalTargets.length > 0 &&
            !legalTargets.includes(targetBallColor);
          aim.material.color.set(
            aimingWrong
              ? 0xff3333
              : targetBall && !railNormal
                ? 0xffff00
                : 0xffffff
          );
          const perp = new THREE.Vector3(-dir.z, 0, dir.x);
          if (perp.lengthSq() > 1e-8) perp.normalize();
          tickGeom.setFromPoints([
            end.clone().add(perp.clone().multiplyScalar(1.4)),
            end.clone().add(perp.clone().multiplyScalar(-1.4))
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
          const desiredPull = powerRef.current * BALL_R * 10 * 0.65 * 1.2;
          const backInfo = calcTarget(
            cue,
            aimDir.clone().multiplyScalar(-1),
            balls
          );
          const maxPull = Math.max(0, backInfo.tHit - cueLen - CUE_TIP_GAP);
          const pull = Math.min(desiredPull, maxPull);
          const offsetSide = ranges.offsetSide ?? 0;
          const offsetVertical = ranges.offsetVertical ?? 0;
          let side = appliedSpin.x * offsetSide;
          let vert = -appliedSpin.y * offsetVertical;
          const maxContactOffset = MAX_SPIN_CONTACT_OFFSET;
          if (maxContactOffset > 1e-6) {
            const combined = Math.hypot(side, vert);
            if (combined > maxContactOffset) {
              const scale = maxContactOffset / combined;
              side *= scale;
              vert *= scale;
            }
            if (
              spinLegalityRef.current?.blocked &&
              Math.hypot(side, vert) < 1e-6
            ) {
              vert = Math.min(maxContactOffset * 0.25, CUE_TIP_RADIUS * 0.35);
            }
          }
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
          TMP_VEC3_BUTT.set(
            cue.pos.x - dir.x * (cueLen + pull + CUE_TIP_GAP) + spinWorld.x,
            CUE_Y + spinWorld.y,
            cue.pos.y - dir.z * (cueLen + pull + CUE_TIP_GAP) + spinWorld.z
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
          aimFocusRef.current = null;
          aim.visible = false;
          tick.visible = false;
          target.visible = false;
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
        for (let stepIndex = 0; stepIndex < physicsSubsteps; stepIndex++) {
          const stepScale = subStepScale;
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
            const speed = b.vel.length();
            const scaledSpeed = speed * stepScale;
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
            if (hitRail) {
              const nowRail = performance.now();
              const lastPlayed = railSoundTimeRef.current.get(b.id) ?? 0;
              if (nowRail - lastPlayed > RAIL_HIT_SOUND_COOLDOWN_MS) {
                const shotScale = 0.35 + 0.65 * lastShotPower;
                const baseVol = speed / RAIL_HIT_SOUND_REFERENCE_SPEED;
                const railVolume = clamp(baseVol * shotScale, 0, 1);
                if (railVolume > 0) {
                  // Previously cushion contacts reused the ball impact sound which
                  // made every rail touch sound like a ball collision. The sound
                  // should only play for ball-on-ball impacts, so we avoid playing
                  // audio here while keeping the cooldown bookkeeping intact.
                }
                railSoundTimeRef.current.set(b.id, nowRail);
              }
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
                const hitBallId =
                  a.id === 'cue' && b.id !== 'cue'
                    ? b.id
                    : b.id === 'cue' && a.id !== 'cue'
                      ? a.id
                      : null;
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
            if (travelReady && delayReady) {
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
            if (cueBall.vel.lengthSq() > 1e-6) {
              activeShotView.lastCueDir = cueBall.vel.clone().normalize();
            }
            if (activeShotView.stage === 'pair') {
              const targetBall =
                activeShotView.targetId != null
                  ? balls.find((b) => b.id === activeShotView.targetId)
                  : null;
              if (!targetBall?.active) {
                activeShotView.stage = 'followCue';
                activeShotView.holdUntil = now + ACTION_CAM.followHoldMs;
              } else if (activeShotView.hitConfirmed) {
                const targetSpeed = targetBall.vel.length() * frameScale;
                if (targetSpeed <= STOP_EPS) {
                  activeShotView.stage = 'followCue';
                  activeShotView.holdUntil = now + ACTION_CAM.followHoldMs;
                }
              }
            } else if (activeShotView.stage === 'followCue') {
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
        if (
          shooting &&
          !topViewRef.current &&
          (activeShotView?.mode !== 'pocket' || !activeShotView)
        ) {
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
        // Kapje në xhepa
        balls.forEach((b) => {
          if (!b.active) return;
          for (let pocketIndex = 0; pocketIndex < centers.length; pocketIndex++) {
            const c = centers[pocketIndex];
            if (b.pos.distanceTo(c) < CAPTURE_R) {
              const entrySpeed = b.vel.length();
              const pocketVolume = THREE.MathUtils.clamp(
                entrySpeed / POCKET_DROP_SPEED_REFERENCE,
                0,
                1
              );
              playPocket(pocketVolume);
              b.active = false;
              b.vel.set(0, 0);
              if (b.spin) b.spin.set(0, 0);
              if (b.pendingSpin) b.pendingSpin.set(0, 0);
              b.spinMode = 'standard';
              b.launchDir = null;
              if (b.id === 'cue') b.impacted = false;
              const dropStart = performance.now();
              const fromX = b.pos.x;
              const fromZ = b.pos.y;
              const speedFactor = THREE.MathUtils.clamp(
                entrySpeed / POCKET_DROP_SPEED_REFERENCE,
                0,
                1
              );
              const dropDuration = THREE.MathUtils.lerp(
                POCKET_DROP_MAX_MS,
                POCKET_DROP_MIN_MS,
                speedFactor
              );
              const dropEntry = {
                start: dropStart,
                duration: dropDuration,
                fromY: BALL_CENTER_Y,
                toY: BALL_CENTER_Y - POCKET_DROP_DEPTH,
                fromX,
                fromZ,
                toX: c.x,
                toZ: c.y,
                mesh: b.mesh,
                endScale: POCKET_DROP_SCALE,
                entrySpeed
              };
              b.mesh.visible = true;
              b.mesh.scale.set(1, 1, 1);
              b.mesh.position.set(fromX, BALL_CENTER_Y, fromZ);
              pocketDropRef.current.set(b.id, dropEntry);
              const pocketId = POCKET_IDS[pocketIndex] ?? 'TM';
              const colorId = b.id === 'cue'
                ? 'CUE'
                : b.id.startsWith('red')
                  ? 'RED'
                  : b.id.toUpperCase();
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
          if (shooting) {
            const any = balls.some(
              (b) => b.active && b.vel.length() * frameScale >= STOP_EPS
            );
            if (!any) resolve();
          }
          if (pocketDropRef.current.size > 0) {
            pocketDropRef.current.forEach((entry, key) => {
              const { mesh } = entry;
              if (!mesh) {
                pocketDropRef.current.delete(key);
                return;
              }
              const elapsed = now - entry.start;
              const duration = entry.duration > 0 ? entry.duration : 1;
              const t = THREE.MathUtils.clamp(elapsed / duration, 0, 1);
              const speedFactor = THREE.MathUtils.clamp(
                (entry.entrySpeed ?? 0) / POCKET_DROP_SPEED_REFERENCE,
                0,
                1
              );
              const gravityEase = THREE.MathUtils.lerp(t * t, t, speedFactor * 0.25);
              const fall = THREE.MathUtils.clamp(gravityEase, 0, 1);
              const y = THREE.MathUtils.lerp(entry.fromY, entry.toY, fall);
              const lateralT = THREE.MathUtils.clamp(t, 0, 1);
              const x = THREE.MathUtils.lerp(entry.fromX, entry.toX, lateralT);
              const z = THREE.MathUtils.lerp(entry.fromZ, entry.toZ, lateralT);
              mesh.position.set(x, y, z);
              const scale = THREE.MathUtils.lerp(1, entry.endScale ?? 1, fall);
              mesh.scale.set(scale, scale, scale);
              if (t >= 1) {
                mesh.visible = false;
                mesh.scale.set(1, 1, 1);
                mesh.position.set(entry.toX, BALL_CENTER_Y, entry.toZ);
                pocketDropRef.current.delete(key);
              }
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
          const resizeAspect = host.clientWidth / host.clientHeight;
          pocketCamerasRef.current.forEach((entry) => {
            if (!entry?.camera) return;
            entry.camera.aspect = resizeAspect;
            entry.camera.updateProjectionMatrix();
          });
        };
      window.addEventListener('resize', onResize);

        return () => {
          cancelAnimationFrame(rafRef.current);
          window.removeEventListener('resize', onResize);
          updatePocketCameraState(false);
          pocketCamerasRef.current.clear();
          pocketDropRef.current.clear();
          activeRenderCameraRef.current = null;
          cueBodyRef.current = null;
          tipGroupRef.current = null;
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
          dom.removeEventListener('pointerdown', handleInHandDown);
          dom.removeEventListener('pointermove', handleInHandMove);
          window.removeEventListener('pointerup', endInHandDrag);
          dom.removeEventListener('pointercancel', endInHandDrag);
          window.removeEventListener('pointercancel', endInHandDrag);
          applyFinishRef.current = () => {};
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
          cueMaterialsRef.current.shaft = null;
          cueGalleryStateRef.current.active = false;
          cueGalleryStateRef.current.rackId = null;
          cueGalleryStateRef.current.prev = null;
          cueGalleryStateRef.current.position?.set(0, 0, 0);
          cueGalleryStateRef.current.target?.set(0, 0, 0);
        };
      } catch (e) {
        console.error(e);
        setErr(e?.message || String(e));
      }
  }, []);

  useEffect(() => {
    applyFinishRef.current?.(tableFinish);
  }, [tableFinish]);

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
    sliderInstanceRef.current = slider;
    applySliderLock();
    return () => {
      sliderInstanceRef.current = null;
      slider.destroy();
    };
  }, [applySliderLock]);

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

    box.addEventListener('pointerdown', handlePointerDown);
    box.addEventListener('pointermove', handlePointerMove);
    box.addEventListener('pointerup', handlePointerUp);
    box.addEventListener('pointercancel', handlePointerCancel);

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
  }, [updateSpinDotPosition]);

  const bottomHudVisible = hud.turn != null && !hud.over && !shotActive;
  const isPlayerTurn = hud.turn === 0;
  const isOpponentTurn = hud.turn === 1;

  return (
    <div className="w-full h-[100vh] bg-black text-white overflow-hidden select-none">
      {/* Canvas host now stretches full width so table reaches the slider */}
      <div ref={mountRef} className="absolute inset-0" />

      {cueGalleryActive && (
        <div className="pointer-events-none absolute top-6 left-1/2 z-50 -translate-x-1/2 px-4 py-2 text-center text-xs font-semibold uppercase tracking-[0.28em] text-white/80">
          Scroll and click to change the cue
        </div>
      )}

      <div className="absolute bottom-4 left-4 z-50 flex flex-col items-start gap-2">
        <div
          className="pointer-events-none flex flex-col gap-2"
          style={{ transform: `scale(${UI_SCALE})`, transformOrigin: 'bottom left' }}
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
            aria-pressed={topView}
            onClick={toggleView}
            className={`pointer-events-auto flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold shadow-[0_12px_32px_rgba(0,0,0,0.45)] backdrop-blur transition ${
              topView
                ? 'border-emerald-300 bg-emerald-300/20 text-emerald-100'
                : 'border-white/30 bg-black/70 text-white hover:bg-black/60'
            }`}
          >
            <span className="text-base">🧭</span>
            <span>{topView ? '3D' : '2D'}</span>
          </button>
        </div>
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
                  {TABLE_FINISH_OPTIONS.map((option) => {
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
                  Chrome Plates
                </h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {CHROME_COLOR_OPTIONS.map((option) => {
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
                  {CUE_STYLE_PRESETS.map((preset, index) => {
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
              {CLOTH_COLOR_OPTIONS.length > 1 ? (
                <div>
                  <h3 className="text-[10px] uppercase tracking-[0.35em] text-emerald-100/70">
                    Cloth Color
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {CLOTH_COLOR_OPTIONS.map((option) => {
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
            </div>
          </div>
        )}
      </div>

      {bottomHudVisible && (
        <div
          className={`absolute bottom-4 flex justify-center pointer-events-none z-50 transition-opacity duration-200 ${pocketCameraActive ? 'opacity-0' : 'opacity-100'}`}
          aria-hidden={pocketCameraActive}
          style={{
            left: 'max(4.5rem, 11vw)',
            right: 'max(8.5rem, 18vw)'
          }}
        >
          <div
            className="pointer-events-auto flex h-12 max-w-full items-center justify-center gap-4 rounded-full border border-emerald-400/40 bg-black/70 px-5 text-white shadow-[0_12px_32px_rgba(0,0,0,0.45)] backdrop-blur"
            style={{
              transform: `scale(${UI_SCALE})`,
              transformOrigin: 'bottom center',
              maxWidth: 'min(26rem, 100%)'
            }}
          >
            <div
              className={`flex h-full min-w-0 items-center gap-3 rounded-full px-3 transition-all ${
                isPlayerTurn
                  ? 'bg-emerald-400/20 text-white shadow-[0_0_18px_rgba(16,185,129,0.35)]'
                  : 'text-white/80'
              }`}
            >
              <img
                src={player.avatar || '/assets/icons/profile.svg'}
                alt="player avatar"
                className={`h-9 w-9 rounded-full border object-cover transition-shadow ${
                  isPlayerTurn
                    ? 'border-emerald-300/80 shadow-[0_0_12px_rgba(16,185,129,0.45)]'
                    : 'border-white/40'
                }`}
              />
              <span className="max-w-[9rem] truncate text-sm font-semibold tracking-wide">
                {player.name}
              </span>
            </div>
            <div className="flex h-full items-center gap-2 text-base font-semibold">
              <span className="text-amber-300">{hud.A}</span>
              <span className="text-white/50">-</span>
              <span>{hud.B}</span>
            </div>
            <div
              className={`flex h-full items-center gap-2 rounded-full px-3 text-sm transition-all ${
                isOpponentTurn
                  ? 'bg-emerald-400/20 text-white shadow-[0_0_18px_rgba(16,185,129,0.35)]'
                  : 'text-white/80'
              }`}
            >
              <span className="text-xl leading-none">{aiFlag}</span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.32em]">
                AI
              </span>
            </div>
          </div>
        </div>
      )}

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
            background: `radial-gradient(circle, #ffffff 0%, #ffffff ${
              SPIN_BOX_FILL_RATIO * 100
            }%, #facc15 ${SPIN_BOX_FILL_RATIO * 100}%, #facc15 100%)`
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
  const [allowDesktop, setAllowDesktop] = useState(isMobileOrTablet);

  useEffect(() => {
    if (isMobileOrTablet) {
      setAllowDesktop(true);
    }
  }, [isMobileOrTablet]);

  if (!isMobileOrTablet && !allowDesktop) {
    return (
      <div className="flex items-center justify-center w-full h-full p-4 text-center">
        <div className="flex flex-col items-center gap-4">
          <p>This game is available on mobile phones and tablets only.</p>
          <button
            type="button"
            className="rounded-full bg-amber-400 px-6 py-2 text-sm font-semibold uppercase text-gray-900 shadow-md transition hover:scale-[1.02] hover:bg-amber-300"
            onClick={() => setAllowDesktop(true)}
          >
            Continue anyway
          </button>
        </div>
      </div>
    );
  }

  return <SnookerGame />;
}
