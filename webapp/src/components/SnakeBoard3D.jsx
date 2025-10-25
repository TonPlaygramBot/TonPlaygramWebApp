import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

import { createArenaCarpetMaterial, createArenaWallMaterial } from '../utils/arenaDecor.js';
import {
  createMurlanStyleTable,
  applyTableMaterials,
  TABLE_SHAPE_OPTIONS
} from '../utils/murlanTable.js';
import { ARENA_CAMERA_DEFAULTS } from '../utils/arenaCameraConfig.js';
import {
  TABLE_WOOD_OPTIONS,
  TABLE_CLOTH_OPTIONS,
  TABLE_BASE_OPTIONS,
  DEFAULT_TABLE_CUSTOMIZATION
} from '../utils/tableCustomizationOptions.js';
import { applyRendererSRGB } from '../utils/colorSpace.js';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const MODEL_SCALE = 0.75;
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
const CUSTOM_CHAIR_ANGLES = [
  THREE.MathUtils.degToRad(90),
  THREE.MathUtils.degToRad(315),
  THREE.MathUtils.degToRad(270),
  THREE.MathUtils.degToRad(225)
];

const DEFAULT_CHAIR_OPTION = Object.freeze({
  id: 'crimsonVelvet',
  primary: '#8b1538',
  accent: '#5c0f26',
  highlight: '#d35a7a',
  legColor: '#1f1f1f'
});
const DEFAULT_STOOL_THEME = Object.freeze({ legColor: '#1f1f1f' });

const PYRAMID_LEVELS = [11, 9, 6, 3];
const LEVEL_TILE_COUNTS = PYRAMID_LEVELS.map((size) => (size <= 1 ? 1 : size * 4 - 4));
const BASE_LEVEL_TILES = PYRAMID_LEVELS[0];
const TOTAL_BOARD_TILES = LEVEL_TILE_COUNTS.reduce((sum, count) => sum + count, 0);
const RAW_BOARD_SIZE = 1.125;
const BOARD_SCALE = 2.7 * 0.68 * 1.15; // enlarge board footprint by an additional 15%
const BOARD_DISPLAY_SIZE = RAW_BOARD_SIZE * BOARD_SCALE;
const BOARD_RADIUS = BOARD_DISPLAY_SIZE / 2;

const TILE_GAP = 0.015;
const TILE_SIZE = RAW_BOARD_SIZE / BASE_LEVEL_TILES;
const MAX_DICE = 2;
const DICE_SIZE = TILE_SIZE * 0.675 * 1.3;
const DICE_CORNER_RADIUS = DICE_SIZE * 0.18;
const DICE_PIP_RADIUS = DICE_SIZE * 0.093;
const DICE_PIP_DEPTH = DICE_SIZE * 0.018;
const DICE_PIP_RIM_INNER = DICE_PIP_RADIUS * 0.78;
const DICE_PIP_RIM_OUTER = DICE_PIP_RADIUS * 1.08;
const DICE_PIP_RIM_OFFSET = DICE_SIZE * 0.0048;
const DICE_PIP_SPREAD = DICE_SIZE * 0.3;
const DICE_FACE_INSET = DICE_SIZE * 0.064;
const DICE_ROLL_DURATION = 900;
const DICE_SETTLE_DURATION = 320;
const DICE_BOUNCE_HEIGHT = DICE_SIZE * 0.6;
const DICE_THROW_LANDING_MARGIN = TILE_SIZE * 1.8;
const DICE_THROW_START_EXTRA = TILE_SIZE * 3.6;
const DICE_THROW_HEIGHT = DICE_SIZE * 1.25;
const BOARD_EDGE_BUFFER = TILE_SIZE * 0.2;
const DICE_RETREAT_EXTRA = DICE_SIZE * 0.95;
const BOARD_BASE_EXTRA = RAW_BOARD_SIZE * (0.36 / 3.4);
const BOARD_BASE_HEIGHT = RAW_BOARD_SIZE * (0.24 / 3.4);
const WORLD_UP = new THREE.Vector3(0, 1, 0);

const CAMERA_FOV = ARENA_CAMERA_DEFAULTS.fov;
const CAMERA_NEAR = ARENA_CAMERA_DEFAULTS.near;
const CAMERA_FAR = ARENA_CAMERA_DEFAULTS.far;
const CAMERA_TARGET_LIFT = 0.04 * MODEL_SCALE;
const CAMERA_BASE_RADIUS = Math.max(TABLE_RADIUS, BOARD_RADIUS);
const CAM = {
  fov: CAMERA_FOV,
  near: CAMERA_NEAR,
  far: CAMERA_FAR,
  minR: CAMERA_BASE_RADIUS * ARENA_CAMERA_DEFAULTS.minRadiusFactor,
  maxR: CAMERA_BASE_RADIUS * ARENA_CAMERA_DEFAULTS.maxRadiusFactor,
  phiMin: ARENA_CAMERA_DEFAULTS.phiMin,
  phiMax: ARENA_CAMERA_DEFAULTS.phiMax
};

const TILE_COLOR_A = new THREE.Color(0xe7e2d3);
const TILE_COLOR_B = new THREE.Color(0x776a5a);
const HIGHLIGHT_COLORS = {
  normal: new THREE.Color(0xf59e0b),
  snake: new THREE.Color(0xdc2626),
  ladder: new THREE.Color(0x22c55e)
};

const PYRAMID_CONCRETE_LIGHT = new THREE.Color('#e7e5e4');
const PYRAMID_CONCRETE_SHADOW = new THREE.Color('#a8a29e');
const PYRAMID_CONCRETE_ACCENT = new THREE.Color('#f4f4f5');

const PYRAMID_PLATFORM_THICKNESS = TILE_SIZE * 0.48;
const PYRAMID_LEVEL_GAP = TILE_SIZE * 0.12;

const CAMERA_FOLLOW_MIN_TILE = Infinity;

const TOKEN_CAMERA_FOLLOW_IN_DURATION = 480;
const TOKEN_CAMERA_FOLLOW_HOLD_DURATION = 820;
const TOKEN_CAMERA_FOLLOW_OUT_DURATION = 480;
const TOKEN_CAMERA_FOLLOW_DISTANCE = TILE_SIZE * 2.6;
const TOKEN_CAMERA_HEIGHT_OFFSET = TILE_SIZE * 1.9;
const TOKEN_CAMERA_LATERAL_OFFSET = TILE_SIZE * 0.55;

const BOARD_TILE_HEIGHT = TILE_SIZE * 0.14;
const TILE_SIDE_COLOR = new THREE.Color(0x8b5e34);
const TILE_BOTTOM_COLOR = new THREE.Color(0x3d2514);
const TILE_SIDE_EMISSIVE_SCALE = 0.25;
const TILE_BOTTOM_EMISSIVE_SCALE = 0.1;

const BENTONITE_EXTRA_SHRINK = [0.85, 0.92];
const TILE_100_SUPPORT_RADIUS = TILE_SIZE * 0.58;
const TILE_100_SUPPORT_HEIGHT_EXTRA = TILE_SIZE * 0.25;

const TOKEN_RADIUS = TILE_SIZE * 0.3;
const TOKEN_HEIGHT = TILE_SIZE * 0.48;
const TOKEN_ACCENT_TARGET = new THREE.Color('#f8fafc');
const TILE_LABEL_OFFSET = TILE_SIZE * 0.0004;

const EDGE_TILE_OUTWARD_OFFSET = TILE_SIZE * 0.3;
const TILE_EDGE_INSET = TILE_SIZE * 0.22;
const BASE_PLATFORM_EXTRA_MULTIPLIER = 1.72;
const FIRST_LEVEL_PLATFORM_EXTRA = TILE_SIZE * 0.9;
const HOME_TOKEN_FORWARD_LIFT = TILE_SIZE * 1.05;
const HOME_TOKEN_OUTWARD_EXTRA = TILE_SIZE * 0.9;
// Extra distance so side-seat tokens rest closer to their players than the board edge.
const SIDE_HOME_EXTRA_DISTANCE = TILE_SIZE * 2.4;
const BACK_HOME_EXTRA_DISTANCE = TILE_SIZE * 2.8;
const TOKEN_MULTI_OCCUPANT_RADIUS = TILE_SIZE * 0.24;
const DICE_PLAYER_EXTRA_OFFSET = TILE_SIZE * 1.8;
const TOP_TILE_EXTRA_LEVELS = 1;

const PAVEMENT_EXTRA_SCALE = 1.18;
const PAVEMENT_THICKNESS = TILE_SIZE * 0.4;
const RAIL_HEIGHT = TILE_SIZE * 0.6;
const RAIL_GAP_WIDTH = TILE_SIZE * 1.4;
const RAIL_RADIUS = TILE_SIZE * 0.03;
const RAIL_WALKWAY_DEPTH = TILE_SIZE * 0.85;
const LEVEL_START_INDICES = LEVEL_TILE_COUNTS.reduce((starts, count, index) => {
  if (index === 0) {
    starts.push(1);
  } else {
    starts.push(starts[index - 1] + LEVEL_TILE_COUNTS[index - 1]);
  }
  return starts;
}, []);
const STAIR_CONNECTIONS = LEVEL_START_INDICES.slice(0, -1).map((start, index) => ({
  from: start + LEVEL_TILE_COUNTS[index] - 1,
  to: LEVEL_START_INDICES[index + 1]
}));
const STAIR_STEP_COUNT = 5;
const STAIR_COLOR = 0x111111;
const STAIR_WIDTH = TILE_SIZE * 0.72;
const STAIR_DEPTH_MIN = TILE_SIZE * 0.22;
const STAIR_OUTWARD_OFFSET = TILE_SIZE * 0.35;
const COIN_SPIN_SPEED = Math.PI / 7;
const COIN_RAISE = TILE_SIZE * 0.24;
const COIN_LOCAL_LIFT = TILE_SIZE * 0.05;

const AVATAR_ANCHOR_HEIGHT = SEAT_THICKNESS / 2 + BACK_HEIGHT * 0.85;

const TEMP_SEAT_VECTOR = new THREE.Vector3();
const TEMP_NDC_VECTOR = new THREE.Vector3();
const DICE_CENTER_VECTOR = new THREE.Vector3();
const BOARD_FRONT_VECTOR = new THREE.Vector3(0, 0, 1);
const BOARD_SIDE_VECTOR = new THREE.Vector3(1, 0, 0);

const SIDE_SEAT_THROW_START_EXTRA = TILE_SIZE * 2.4;
const SIDE_SEAT_THROW_BOUNCE_EXTRA = TILE_SIZE * 1.65;
const SIDE_SEAT_THROW_SETTLE_EXTRA = TILE_SIZE * 1.45;

const DICE_SEAT_ADJUSTMENTS = [
  {
    forward: {
      start: TILE_SIZE * 0.12,
      bounce: TILE_SIZE * 0.1,
      base: TILE_SIZE * 0.18
    }
  },
  {
    forward: {
      start: TILE_SIZE * 0.24,
      bounce: TILE_SIZE * 0.28,
      base: TILE_SIZE * 0.42
    },
    front: {
      start: TILE_SIZE * 0.64,
      bounce: TILE_SIZE * 0.98,
      base: TILE_SIZE * 1.36
    },
    side: {
      start: TILE_SIZE * 0.4,
      bounce: TILE_SIZE * 0.48,
      base: TILE_SIZE * 0.6
    }
  },
  {
    forward: {
      start: TILE_SIZE * 0.12,
      bounce: TILE_SIZE * 0.1,
      base: TILE_SIZE * 0.18
    }
  },
  {
    forward: {
      start: TILE_SIZE * 0.24,
      bounce: TILE_SIZE * 0.28,
      base: TILE_SIZE * 0.42
    },
    front: {
      start: TILE_SIZE * 0.64,
      bounce: TILE_SIZE * 0.98,
      base: TILE_SIZE * 1.36
    },
    side: {
      start: -TILE_SIZE * 0.4,
      bounce: -TILE_SIZE * 0.48,
      base: -TILE_SIZE * 0.6
    }
  }
];

const DEFAULT_COLORS = ['#f97316', '#22d3ee', '#22c55e', '#a855f7'];

const LADDER_BASE_LIFT = TILE_SIZE * 0.26;
const LADDER_ARCH_BASE = TILE_SIZE * 0.78;
const LADDER_ARCH_SCALE = TILE_SIZE * 0.01;
const LADDER_SWAY_BASE = TILE_SIZE * 0.16;
const LADDER_SWAY_SCALE = TILE_SIZE * 0.0075;
const LADDER_INNER_LIFT_RATIO = 0.72;
const LADDER_OUTER_LIFT_RATIO = 0.72;
const SNAKE_BASE_LIFT = TILE_SIZE * 0.2;
const SNAKE_ARCH_BASE = TILE_SIZE * 0.45;
const SNAKE_ARCH_SCALE = TILE_SIZE * 0.0045;
const SNAKE_LATERAL_BASE = TILE_SIZE * 0.12;
const SNAKE_LATERAL_SCALE = TILE_SIZE * 0.0038;

function pullPointTowardCenter(point, amount = TILE_EDGE_INSET) {
  if (!point) return point;
  const planar = new THREE.Vector3(point.x, 0, point.z);
  const distance = planar.length();
  if (distance < 1e-6) {
    return point;
  }
  const pull = Math.min(amount, distance * 0.45);
  planar.normalize().multiplyScalar(pull);
  point.addScaledVector(planar, -1);
  return point;
}

function adjustHexColor(hex, amount) {
  const base = new THREE.Color(hex);
  const target = amount >= 0 ? new THREE.Color(0xffffff) : new THREE.Color(0x000000);
  base.lerp(target, Math.min(Math.abs(amount), 1));
  return `#${base.getHexString()}`;
}

function buildPerimeterSequence(size) {
  if (size <= 1) {
    return [{ row: 0, col: 0 }];
  }
  const sequence = [];
  for (let col = 0; col < size; col += 1) {
    sequence.push({ row: 0, col });
  }
  for (let row = 1; row < size; row += 1) {
    sequence.push({ row, col: size - 1 });
  }
  for (let col = size - 2; col >= 0; col -= 1) {
    sequence.push({ row: size - 1, col });
  }
  for (let row = size - 2; row >= 1; row -= 1) {
    sequence.push({ row, col: 0 });
  }
  return sequence;
}

function addPavementLayer(parent, size, thickness, bottomY, meshes) {
  const pavementMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#6b7280'),
    roughness: 0.88,
    metalness: 0.35,
    envMapIntensity: 0.6
  });
  const pavement = new THREE.Mesh(new THREE.BoxGeometry(size, thickness, size), pavementMaterial);
  pavement.position.y = bottomY - thickness / 2;
  pavement.receiveShadow = true;
  parent.add(pavement);
  if (meshes) meshes.push(pavement);
  return pavement;
}

function addChromeRailings(
  parent,
  {
    halfSize,
    topY,
    railHeight,
    gapWidth,
    gapCenter = 0,
    entrySide = 'front',
    addNet = false
  },
  meshes
) {
  const created = [];
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xf3f4f6,
    metalness: 1,
    roughness: 0.18,
    clearcoat: 0.35,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1.1
  });
  const walkwayDepth = Math.min(halfSize, RAIL_WALKWAY_DEPTH);
  const lowerY = topY + TILE_SIZE * 0.05;
  const upperY = lowerY + railHeight;

  const entryAxis = entrySide === 'front' || entrySide === 'back' ? 'x' : 'z';
  const axisMin = -halfSize;
  const axisMax = halfSize;
  const gapHalf = Math.min(halfSize * 0.92, gapWidth / 2);
  let entryCenter = clamp(gapCenter, axisMin, axisMax);
  let entryMin = entryCenter - gapHalf;
  let entryMax = entryCenter + gapHalf;
  if (entryMin < axisMin) {
    const shift = axisMin - entryMin;
    entryMin += shift;
    entryMax += shift;
  }
  if (entryMax > axisMax) {
    const shift = entryMax - axisMax;
    entryMin -= shift;
    entryMax -= shift;
  }
  const minGap = TILE_SIZE * 0.35;
  if (entryMax - entryMin < minGap) {
    const center = (entryMin + entryMax) / 2;
    entryMin = clamp(center - minGap / 2, axisMin, axisMax);
    entryMax = clamp(center + minGap / 2, axisMin, axisMax);
  }

  const addMesh = (mesh) => {
    if (!mesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    created.push(mesh);
    if (meshes) meshes.push(mesh);
  };

  const addRail = (start, end, height) => {
    const direction = end.clone().sub(start);
    const length = direction.length();
    if (length < 1e-4) return null;
    const geom = new THREE.CylinderGeometry(RAIL_RADIUS, RAIL_RADIUS, length, 16);
    const rail = new THREE.Mesh(geom, material.clone());
    const center = start.clone().addScaledVector(direction, 0.5);
    rail.position.copy(center);
    rail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    rail.position.y = height;
    return rail;
  };

  const addRailPair = (start, end) => {
    const baseStart = start.clone();
    baseStart.y = lowerY;
    const baseEnd = end.clone();
    baseEnd.y = lowerY;
    const highStart = start.clone();
    highStart.y = upperY;
    const highEnd = end.clone();
    highEnd.y = upperY;
    addMesh(addRail(baseStart, baseEnd, lowerY));
    addMesh(addRail(highStart, highEnd, upperY));
  };

  const postCache = new Set();

  const addPost = (x, z) => {
    const key = `${x.toFixed(4)}:${z.toFixed(4)}`;
    if (postCache.has(key)) return;
    postCache.add(key);
    const height = upperY - topY;
    if (height <= 0) return;
    const geom = new THREE.CylinderGeometry(RAIL_RADIUS * 1.25, RAIL_RADIUS * 1.25, height, 16);
    const post = new THREE.Mesh(geom, material.clone());
    post.position.set(x, topY + height / 2, z);
    addMesh(post);
  };

  const frontZ = halfSize;
  const backZ = -halfSize;
  const leftX = -halfSize;
  const rightX = halfSize;

  const addNetPanel = (side, startCoord, endCoord) => {
    if (!addNet) return;
    const length = Math.abs(endCoord - startCoord);
    const height = Math.max(0, upperY - topY);
    if (length < 1e-4 || height < 1e-4) return;
    const net = new THREE.Mesh(new THREE.PlaneGeometry(length, height), createRailNetMaterial());
    net.castShadow = false;
    net.receiveShadow = false;
    net.position.y = topY + height / 2;
    switch (side) {
      case 'front':
        net.position.x = (startCoord + endCoord) / 2;
        net.position.z = frontZ - RAIL_RADIUS * 0.3;
        net.rotation.y = Math.PI;
        break;
      case 'back':
        net.position.x = (startCoord + endCoord) / 2;
        net.position.z = backZ + RAIL_RADIUS * 0.3;
        break;
      case 'left':
        net.position.x = leftX + RAIL_RADIUS * 0.3;
        net.position.z = (startCoord + endCoord) / 2;
        net.rotation.y = Math.PI / 2;
        break;
      case 'right':
        net.position.x = rightX - RAIL_RADIUS * 0.3;
        net.position.z = (startCoord + endCoord) / 2;
        net.rotation.y = -Math.PI / 2;
        break;
      default:
        break;
    }
    addMesh(net);
  };

  const axisToVector = (side, coord) => {
    switch (side) {
      case 'front':
        return new THREE.Vector3(coord, 0, frontZ);
      case 'back':
        return new THREE.Vector3(coord, 0, backZ);
      case 'left':
        return new THREE.Vector3(leftX, 0, coord);
      case 'right':
        return new THREE.Vector3(rightX, 0, coord);
      default:
        return new THREE.Vector3(coord, 0, 0);
    }
  };

  const buildSegments = (side) => {
    const axis = side === 'front' || side === 'back' ? 'x' : 'z';
    const min = -halfSize;
    const max = halfSize;
    if (side !== entrySide) {
      return [[min, max]];
    }
    if (axis !== entryAxis) {
      return [[min, max]];
    }
    const segments = [];
    if (entryMin > min) segments.push([min, entryMin]);
    if (entryMax < max) segments.push([entryMax, max]);
    return segments;
  };

  const addSide = (side) => {
    buildSegments(side).forEach(([startCoord, endCoord]) => {
      const minCoord = Math.min(startCoord, endCoord);
      const maxCoord = Math.max(startCoord, endCoord);
      if (maxCoord - minCoord < 1e-4) return;
      const start = axisToVector(side, minCoord);
      const end = axisToVector(side, maxCoord);
      addRailPair(start, end);
      addNetPanel(side, minCoord, maxCoord);
      addPost(start.x, start.z);
      addPost(end.x, end.z);
    });
  };

  addSide('front');
  addSide('back');
  addSide('left');
  addSide('right');

  const walkwayReach = Math.max(0, walkwayDepth);
  if (walkwayReach > 0 && entrySide) {
    const directionMap = {
      front: new THREE.Vector3(0, 0, -1),
      back: new THREE.Vector3(0, 0, 1),
      left: new THREE.Vector3(1, 0, 0),
      right: new THREE.Vector3(-1, 0, 0)
    };
    const dir = directionMap[entrySide]?.clone();
    if (dir && dir.lengthSq() > 1e-6) {
      dir.normalize();
      const entryCoords = [entryMin, entryMax];
      entryCoords.forEach((coord) => {
        const start = axisToVector(entrySide, coord);
        const end = start.clone().addScaledVector(dir, walkwayReach);
        addRailPair(start, end);
        addPost(end.x, end.z);
      });
    }
  }

  return created;
}

function getRailingEntryConfig(levelIndex, indexToPosition) {
  if (levelIndex <= 0) {
    return { side: 'front', axis: 'x', center: null };
  }
  const stairInfo = STAIR_CONNECTIONS[levelIndex - 1];
  if (!stairInfo) {
    return { side: 'front', axis: 'x', center: null };
  }
  const fromPos = indexToPosition.get(stairInfo.from);
  const toPos = indexToPosition.get(stairInfo.to);
  if (!fromPos || !toPos) {
    return { side: 'front', axis: 'x', center: null };
  }
  const dx = fromPos.x - toPos.x;
  const dz = fromPos.z - toPos.z;
  if (Math.abs(dx) >= Math.abs(dz)) {
    return {
      side: dx >= 0 ? 'right' : 'left',
      axis: 'z',
      center: toPos.z
    };
  }
  return {
    side: dz >= 0 ? 'front' : 'back',
    axis: 'x',
    center: toPos.x
  };
}

function addWallStaircase(
  parent,
  { fromIndex, toIndex, indexToPosition, stepCount = STAIR_STEP_COUNT, width = STAIR_WIDTH, depthMin = STAIR_DEPTH_MIN, outwardOffset = STAIR_OUTWARD_OFFSET },
  meshes
) {
  if (!indexToPosition?.has(fromIndex) || !indexToPosition?.has(toIndex) || stepCount <= 0) {
    return null;
  }
  const created = [];
  const fromPos = indexToPosition.get(fromIndex).clone();
  const toPos = indexToPosition.get(toIndex).clone();
  const heightDelta = toPos.y - fromPos.y;
  if (heightDelta <= 0) return null;

  const material = new THREE.MeshStandardMaterial({
    color: STAIR_COLOR,
    roughness: 0.55,
    metalness: 0.2
  });

  const horizontal = new THREE.Vector3(toPos.x - fromPos.x, 0, toPos.z - fromPos.z);
  const horizontalLength = horizontal.length();
  let direction;
  if (horizontalLength > 1e-6) {
    direction = horizontal.clone().normalize();
  } else {
    direction = new THREE.Vector3(1, 0, 0);
  }
  const outward = new THREE.Vector3(-direction.z, 0, direction.x);
  if (outward.lengthSq() > 1e-6) {
    outward.normalize();
    const toCenter = new THREE.Vector3(fromPos.x, 0, fromPos.z);
    if (toCenter.dot(outward) < 0) outward.multiplyScalar(-1);
  } else {
    outward.set(0, 0, 1);
  }

  const stepHeight = heightDelta / stepCount;
  const stepDepth = Math.max(depthMin, horizontalLength / Math.max(1, stepCount));
  const totalDepth = stepDepth * stepCount;
  const overshoot = Math.max(0, totalDepth - horizontalLength);
  const startBase = fromPos
    .clone()
    .addScaledVector(direction, -overshoot / 2)
    .addScaledVector(outward, outwardOffset);

  const group = new THREE.Group();
  for (let i = 0; i < stepCount; i += 1) {
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(width, Math.max(stepHeight * 0.98, TILE_SIZE * 0.04), stepDepth),
      material.clone()
    );
    const center = startBase.clone().addScaledVector(direction, stepDepth * (i + 0.5));
    center.y = fromPos.y + stepHeight * (i + 0.5);
    step.position.copy(center);
    step.castShadow = true;
    step.receiveShadow = true;
    group.add(step);
    created.push(step);
  }

  parent.add(group);
  created.push(group);
  if (meshes) {
    created.forEach((mesh) => meshes.push(mesh));
  }
  return group;
}

function createChairClothTexture(chairOption, renderer) {
  const primary = chairOption?.primary ?? '#0f6a2f';
  const accent = chairOption?.accent ?? adjustHexColor(primary, -0.28);
  const highlight = chairOption?.highlight ?? adjustHexColor(primary, 0.22);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const shadow = adjustHexColor(accent, -0.22);
  const seam = adjustHexColor(accent, -0.35);

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, adjustHexColor(primary, 0.2));
  gradient.addColorStop(0.5, primary);
  gradient.addColorStop(1, accent);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const repeat = 6;
  const spacing = canvas.width / repeat;
  const halfSpacing = spacing / 2;
  const lineWidth = Math.max(1.6, spacing * 0.06);

  ctx.strokeStyle = seam;
  ctx.lineWidth = lineWidth;
  ctx.globalAlpha = 0.9;
  for (let offset = -canvas.height; offset <= canvas.width + canvas.height; offset += spacing) {
    ctx.beginPath();
    ctx.moveTo(offset, 0);
    ctx.lineTo(offset - canvas.height, canvas.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(offset, 0);
    ctx.lineTo(offset + canvas.height, canvas.height);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.strokeStyle = adjustHexColor(highlight, 0.18);
  ctx.lineWidth = lineWidth * 0.55;
  ctx.globalAlpha = 0.55;
  for (let offset = -canvas.height; offset <= canvas.width + canvas.height; offset += spacing) {
    ctx.beginPath();
    ctx.moveTo(offset + halfSpacing, 0);
    ctx.lineTo(offset + halfSpacing - canvas.height, canvas.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(offset + halfSpacing, 0);
    ctx.lineTo(offset + halfSpacing + canvas.height, canvas.height);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = renderer?.capabilities?.getMaxAnisotropy?.() ?? 4;
  texture.repeat.set(2.5, 2.5);
  texture.needsUpdate = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createChairFabricMaterial(chairOption, renderer) {
  const clothTexture = createChairClothTexture(chairOption, renderer);
  const material = new THREE.MeshPhysicalMaterial({
    map: clothTexture,
    color: new THREE.Color('#ffffff'),
    roughness: 0.72,
    metalness: 0.08,
    clearcoat: 0.24,
    clearcoatRoughness: 0.38,
    sheen: 0.35,
    sheenColor: new THREE.Color('#ffffff'),
    sheenRoughness: 0.6
  });
  material.userData = {
    ...(material.userData || {}),
    chairId: chairOption?.id ?? 'default',
    clothTexture
  };
  return material;
}

function disposeChairMaterial(material) {
  if (!material) return;
  const texture = material.userData?.clothTexture;
  texture?.dispose?.();
  if (material.map && material.map !== texture) {
    material.map.dispose?.();
  }
  material.dispose();
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

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

function removeAnimationsByType(list, type) {
  if (!Array.isArray(list) || !type) return;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (list[i]?.type === type) list.splice(i, 1);
  }
}

function createCameraTransitionAnimation(
  camera,
  controls,
  {
    toPosition,
    toTarget,
    durationIn = 480,
    durationOut = 480,
    hold = 420,
    type,
    onComplete,
    returnPosition,
    returnTarget
  }
) {
  if (!camera || !controls || !toPosition || !toTarget) return null;
  const startPosition = camera.position.clone();
  const startTarget = controls?.target ? controls.target.clone() : new THREE.Vector3();
  const goalPosition = toPosition.clone();
  const goalTarget = toTarget.clone();
  const finalPosition = returnPosition ? returnPosition.clone() : startPosition.clone();
  const finalTarget = returnTarget ? returnTarget.clone() : startTarget.clone();
  const tempPosition = new THREE.Vector3();
  const tempTarget = new THREE.Vector3();
  const start = performance.now();
  const total = durationIn + hold + durationOut;

  const applyFrame = (pos, target) => {
    camera.position.copy(pos);
    if (controls?.target) controls.target.copy(target);
    camera.lookAt(target);
    controls?.update?.();
  };

  return {
    type,
    update: (now) => {
      const elapsed = now - start;
      if (elapsed <= durationIn) {
        const t = durationIn > 0 ? easeInOut(Math.min(Math.max(elapsed / durationIn, 0), 1)) : 1;
        tempPosition.copy(startPosition).lerp(goalPosition, t);
        tempTarget.copy(startTarget).lerp(goalTarget, t);
        applyFrame(tempPosition, tempTarget);
        return false;
      }
      if (elapsed <= durationIn + hold) {
        applyFrame(goalPosition, goalTarget);
        return false;
      }
      if (elapsed <= total) {
        const t = durationOut > 0
          ? easeInOut(Math.min(Math.max((elapsed - durationIn - hold) / durationOut, 0), 1))
          : 1;
        tempPosition.copy(goalPosition).lerp(finalPosition, t);
        tempTarget.copy(goalTarget).lerp(finalTarget, t);
        applyFrame(tempPosition, tempTarget);
        return false;
      }
      applyFrame(finalPosition, finalTarget);
      if (typeof onComplete === 'function') onComplete();
      return true;
    }
  };
}

function computeTokenFollowCameraState(board, fromIndex, toIndex) {
  if (!board) return null;
  const { indexToPosition, serpentineIndexToXZ } = board;
  const sanitizeIndex = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };
  const from = sanitizeIndex(fromIndex);
  const to = sanitizeIndex(toIndex);
  if (to == null) return null;
  const baseVector = (indexToPosition.get(to) || serpentineIndexToXZ(to))?.clone();
  if (!baseVector) return null;
  baseVector.y += TOKEN_HEIGHT * 0.02;

  let fromVector = null;
  if (from != null) {
    const ref = indexToPosition.get(from) || serpentineIndexToXZ(from);
    if (ref) fromVector = ref.clone();
  }
  if (!fromVector) {
    fromVector = baseVector.clone();
    fromVector.x += 1e-3;
  }
  fromVector.y += TOKEN_HEIGHT * 0.02;

  const direction = baseVector.clone().sub(fromVector);
  direction.y = 0;
  if (direction.lengthSq() < 1e-6) {
    direction.set(baseVector.x, 0, baseVector.z);
    if (direction.lengthSq() < 1e-6) direction.set(0, 0, 1);
  }
  direction.normalize();

  const focusTarget = baseVector.clone();
  focusTarget.y += TOKEN_HEIGHT * 0.65;

  const backward = direction.clone().multiplyScalar(-TOKEN_CAMERA_FOLLOW_DISTANCE);
  const lateral = new THREE.Vector3().crossVectors(direction, WORLD_UP).normalize();
  const cameraPosition = focusTarget
    .clone()
    .add(backward)
    .addScaledVector(lateral, TOKEN_CAMERA_LATERAL_OFFSET);
  if (cameraPosition.y < focusTarget.y + TOKEN_CAMERA_HEIGHT_OFFSET) {
    cameraPosition.y = focusTarget.y + TOKEN_CAMERA_HEIGHT_OFFSET;
  }

  return { focusTarget, cameraPosition };
}

function shouldFollowTileChange(_fromIndex, toIndex) {
  const to = Number(toIndex);
  if (!Number.isFinite(to)) return false;
  return to >= CAMERA_FOLLOW_MIN_TILE;
}

function createTokenCameraFollowAnimation(camera, controls, followState, restoreState, onComplete) {
  if (!followState) return null;
  const { focusTarget, cameraPosition } = followState;
  return createCameraTransitionAnimation(camera, controls, {
    toPosition: cameraPosition,
    toTarget: focusTarget,
    durationIn: TOKEN_CAMERA_FOLLOW_IN_DURATION,
    hold: TOKEN_CAMERA_FOLLOW_HOLD_DURATION,
    durationOut: TOKEN_CAMERA_FOLLOW_OUT_DURATION,
    type: 'cameraTokenFollow',
    returnPosition: restoreState?.position,
    returnTarget: restoreState?.target,
    onComplete
  });
}

function captureCameraState(camera, controls) {
  if (!camera || !controls) return null;
  return {
    position: camera.position.clone(),
    target: controls?.target ? controls.target.clone() : new THREE.Vector3()
  };
}

function getDiceOrientationQuaternion(val) {
  const orientations = {
    1: new THREE.Euler(0, 0, 0),
    2: new THREE.Euler(-Math.PI / 2, 0, 0),
    3: new THREE.Euler(0, 0, -Math.PI / 2),
    4: new THREE.Euler(0, 0, Math.PI / 2),
    5: new THREE.Euler(Math.PI / 2, 0, 0),
    6: new THREE.Euler(Math.PI, 0, 0)
  };
  const euler = orientations[val] || orientations[1];
  return new THREE.Quaternion().setFromEuler(euler);
}

function setDiceOrientation(dice, val, quaternion) {
  const q = quaternion ?? getDiceOrientationQuaternion(val);
  dice.setRotationFromQuaternion(q);
  return q;
}

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

  const pipGeo = new THREE.SphereGeometry(
    DICE_PIP_RADIUS,
    36,
    24,
    0,
    Math.PI * 2,
    0,
    Math.PI
  );
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

  dice.userData.setValue = (val, { immediate = true } = {}) => {
    dice.userData.currentValue = val;
    const target = getDiceOrientationQuaternion(val);
    dice.userData.targetQuaternion = target.clone();
    if (immediate) {
      dice.userData.appliedQuaternion = setDiceOrientation(dice, val, target);
    }
  };
  dice.userData.currentValue = 1;
  dice.userData.setValue(1, { immediate: true });
  return dice;
}

function computeDiceThrowLayout(board, seatIndex, count) {
  const result = {
    basePositions: [],
    startPositions: [],
    travelVectors: [],
    bouncePoints: [],
    retreatVectors: [],
    edgeNormals: []
  };
  if (!board?.root || !Array.isArray(board?.seatAnchors)) return result;
  if (typeof seatIndex !== 'number' || seatIndex < 0) return result;
  const anchor = board.seatAnchors[seatIndex];
  if (!anchor) return result;

  board.root.updateMatrixWorld(true);
  anchor.updateMatrixWorld?.(true);

  const seatWorld = new THREE.Vector3();
  anchor.getWorldPosition(seatWorld);

  const diceBaseY = board.diceBaseY ?? 0;
  const centerLocal = new THREE.Vector3(0, diceBaseY, 0);
  const seatLocal = seatWorld.clone();
  board.root.worldToLocal(seatLocal);

  const direction = centerLocal.clone().sub(seatLocal).setY(0);
  if (direction.lengthSq() < 1e-6) direction.set(0, 0, 1);
  direction.normalize();
  const awayFromBoard = direction.clone().multiplyScalar(-1);

  const lateral = new THREE.Vector3(-direction.z, 0, direction.x);
  if (lateral.lengthSq() < 1e-6) lateral.set(1, 0, 0);
  lateral.normalize();

  const boardHalf = (BASE_LEVEL_TILES * TILE_SIZE) / 2;
  const boardEdgeDistance = boardHalf + BOARD_EDGE_BUFFER;
  const baseStartDistance = boardHalf + DICE_THROW_START_EXTRA;
  const settleBaseDistance = boardHalf + DICE_THROW_LANDING_MARGIN + DICE_RETREAT_EXTRA;

  const seatAdjust = DICE_SEAT_ADJUSTMENTS[seatIndex] ?? {};
  const forwardAdjust = seatAdjust.forward ?? {};
  const frontAdjust = seatAdjust.front ?? {};
  const sideAdjust = seatAdjust.side ?? {};

  const isSideSeat = seatIndex === 1 || seatIndex === 3;
  const sideStartBoost = isSideSeat ? SIDE_SEAT_THROW_START_EXTRA : 0;
  const sideBounceBoost = isSideSeat ? SIDE_SEAT_THROW_BOUNCE_EXTRA : 0;
  const sideSettleBoost = isSideSeat ? SIDE_SEAT_THROW_SETTLE_EXTRA : 0;

  const startBaseDistance = baseStartDistance + (forwardAdjust.start ?? 0) + sideStartBoost;
  const bounceBaseDistance = boardEdgeDistance + (forwardAdjust.bounce ?? 0) + sideBounceBoost;
  const settleDistanceBase = settleBaseDistance + (forwardAdjust.base ?? 0) + sideSettleBoost;

  const applyAxisOffsets = (vec, phase) => {
    const front = frontAdjust?.[phase];
    if (typeof front === 'number' && Number.isFinite(front) && front !== 0) {
      vec.addScaledVector(BOARD_FRONT_VECTOR, front);
    }
    const side = sideAdjust?.[phase];
    if (typeof side === 'number' && Number.isFinite(side) && side !== 0) {
      vec.addScaledVector(BOARD_SIDE_VECTOR, side);
    }
  };

  const spacing = DICE_SIZE * 1.35;
  const centerOffset = (count - 1) / 2;

  for (let i = 0; i < count; i += 1) {
    const offset = (i - centerOffset) * spacing;
    const lateralJitter = (Math.random() - 0.5) * DICE_SIZE * 0.75;
    const bounceJitter = (Math.random() - 0.5) * DICE_SIZE * 0.35;
    const retreatExtra = Math.random() * DICE_SIZE * 0.8;
    const outwardJitter = Math.random() * DICE_SIZE * 0.9;

    const startDistance = startBaseDistance + Math.random() * DICE_SIZE * 0.9;
    const bounceDistance = bounceBaseDistance + (Math.random() - 0.5) * DICE_SIZE * 0.12;
    const settleDistance = Math.max(
      bounceDistance + DICE_SIZE * 0.35,
      settleDistanceBase + (Math.random() - 0.1) * DICE_SIZE * 0.6
    );

    const start = centerLocal
      .clone()
      .addScaledVector(awayFromBoard, startDistance)
      .addScaledVector(lateral, offset * 0.9 + lateralJitter);
    start.y = diceBaseY + DICE_THROW_HEIGHT + Math.random() * (DICE_THROW_HEIGHT * 0.25);
    applyAxisOffsets(start, 'start');

    const bounce = centerLocal
      .clone()
      .addScaledVector(awayFromBoard, bounceDistance)
      .addScaledVector(lateral, offset * 0.35 + bounceJitter);
    bounce.y = diceBaseY + DICE_SIZE * (0.12 + Math.random() * 0.12);
    applyAxisOffsets(bounce, 'bounce');

    const base = centerLocal
      .clone()
      .addScaledVector(awayFromBoard, settleDistance + retreatExtra)
      .addScaledVector(lateral, offset + lateralJitter * 0.45);
    base.addScaledVector(awayFromBoard, outwardJitter);
    base.y = diceBaseY;
    applyAxisOffsets(base, 'base');

    const bouncePoint = bounce.clone();

    result.startPositions.push(start);
    result.bouncePoints.push(bouncePoint);
    result.basePositions.push(base);
    const approach = bouncePoint.clone().sub(start);
    const retreat = base.clone().sub(bouncePoint);
    result.travelVectors.push(approach);
    result.retreatVectors.push(retreat);
    result.edgeNormals.push(awayFromBoard.clone());
  }

  result.direction = direction;
  result.lateral = lateral;
  result.seatIndex = seatIndex;
  return result;
}

function createDiceRollAnimation(
  diceArray,
  {
    basePositions,
    baseY,
    startPositions = [],
    travelVectors = [],
    bouncePoints = [],
    retreatVectors = [],
    edgeNormals = []
  }
) {
  const start = performance.now();
  const spinSpeeds = diceArray.map(() => 0.22 + Math.random() * 0.16);
  const impactPhases = diceArray.map(() => 0.42 + Math.random() * 0.18);
  const bounceHeights = diceArray.map(() => DICE_BOUNCE_HEIGHT * (0.85 + Math.random() * 0.55));
  const settleHeights = bounceHeights.map((height) => height * (0.35 + Math.random() * 0.3));
  const yawSpeeds = diceArray.map(() => (Math.random() - 0.5) * 0.14);
  const postYawSpeeds = yawSpeeds.map((speed) => -speed * (0.35 + Math.random() * 0.35));
  const swayOffsets = diceArray.map(() => Math.random() * Math.PI * 2);
  const swayMagnitudes = diceArray.map(() => DICE_SIZE * (0.09 + Math.random() * 0.12));
  const slideMagnitudes = diceArray.map(() => DICE_SIZE * (0.18 + Math.random() * 0.25));

  const approachAxes = diceArray.map((_, index) => {
    const travel = travelVectors[index];
    if (travel && travel.lengthSq() > 1e-6) {
      const axis = new THREE.Vector3(travel.z, 0, -travel.x);
      if (axis.lengthSq() > 1e-6) return axis.normalize();
    }
    return new THREE.Vector3(Math.random() * 0.6 + 0.2, Math.random() * 0.3 + 0.1, Math.random() * 0.6 + 0.2).normalize();
  });

  const retreatAxes = diceArray.map((_, index) => {
    const travel = retreatVectors[index];
    if (travel && travel.lengthSq() > 1e-6) {
      const axis = new THREE.Vector3(travel.z, 0, -travel.x);
      if (axis.lengthSq() > 1e-6) return axis.normalize();
    }
    return approachAxes[index].clone();
  });

  const lateralVectors = diceArray.map((_, index) => {
    const travel = travelVectors[index];
    if (travel && travel.lengthSq() > 1e-6) {
      const lateral = new THREE.Vector3(-travel.z, 0, travel.x);
      if (lateral.lengthSq() > 1e-6) return lateral.normalize();
    }
    const fallback = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5);
    if (fallback.lengthSq() < 1e-6) fallback.set(1, 0, 0);
    return fallback.normalize();
  });

  const retreatDirections = diceArray.map((_, index) => {
    const retreat = retreatVectors[index];
    if (retreat && retreat.lengthSq() > 1e-6) return retreat.clone().setY(0).normalize();
    const normal = edgeNormals[index];
    if (normal && normal.lengthSq() > 1e-6) return normal.clone().setY(0).normalize();
    return new THREE.Vector3(0, 0, 0);
  });

  return {
    type: 'diceRoll',
    update: (now) => {
      const t = Math.min((now - start) / DICE_ROLL_DURATION, 1);
      diceArray.forEach((die, index) => {
        const base = basePositions[index];
        if (!base) return;
        const startPos = startPositions[index] ?? base;
        const bounce = bouncePoints[index] ?? base;
        const impactPhase = impactPhases[index];

        if (t < impactPhase) {
          const local = impactPhase > 1e-3 ? Math.min(t / impactPhase, 1) : 1;
          const ease = easeOutCubic(local);
          die.position.copy(startPos).lerp(bounce, ease);
          const lift = Math.sin(local * Math.PI) * bounceHeights[index];
          die.position.y = baseY + lift;
          const sway = Math.sin(local * Math.PI * 2.1 + swayOffsets[index]) * swayMagnitudes[index];
          die.position.addScaledVector(lateralVectors[index], sway);
          die.rotateOnAxis(approachAxes[index], spinSpeeds[index] * 1.25);
          die.rotateOnWorldAxis(WORLD_UP, yawSpeeds[index]);
        } else {
          const remaining = Math.max(1 - impactPhase, 1e-3);
          const local = Math.min((t - impactPhase) / remaining, 1);
          const ease = easeOutCubic(local);
          die.position.copy(bounce).lerp(base, ease);
          const rebound = Math.sin(local * Math.PI) * settleHeights[index] * (1 - ease * 0.65);
          die.position.y = baseY + rebound;
          const sway = Math.sin((local + 0.35) * Math.PI * 2 + swayOffsets[index]) * swayMagnitudes[index] * 0.6;
          die.position.addScaledVector(lateralVectors[index], sway);
          const slide = Math.sin(local * Math.PI) * slideMagnitudes[index] * (1 - ease * 0.35);
          if (retreatDirections[index].lengthSq() > 1e-6) {
            die.position.addScaledVector(retreatDirections[index], slide);
          }
          die.rotateOnAxis(retreatAxes[index], spinSpeeds[index] * 0.6);
          die.rotateOnWorldAxis(WORLD_UP, postYawSpeeds[index]);
        }
      });
      if (t >= 1) {
        diceArray.forEach((die, index) => {
          const base = basePositions[index];
          if (!base) return;
          die.position.set(base.x, baseY, base.z);
        });
        return true;
      }
      return false;
    }
  };
}

function createDiceSettleAnimation(diceArray, { basePositions, baseY, startStates = [] }) {
  const start = performance.now();
  const startPositions = diceArray.map((die, index) => {
    const state = startStates[index];
    if (state?.position) return state.position.clone();
    return die.position.clone();
  });
  const startQuaternions = diceArray.map((die, index) => {
    const state = startStates[index];
    if (state?.quaternion) return state.quaternion.clone();
    return die.quaternion.clone();
  });
  const targetPositions = basePositions.map((base) =>
    base ? new THREE.Vector3(base.x, baseY, base.z) : null
  );
  const targetQuaternions = diceArray.map((die) => {
    if (die.userData?.targetQuaternion) return die.userData.targetQuaternion.clone();
    const fallback = getDiceOrientationQuaternion(die.userData?.currentValue ?? 1);
    die.userData.targetQuaternion = fallback.clone();
    return fallback;
  });

  return {
    type: 'diceSettle',
    update: (now) => {
      const t = Math.min((now - start) / DICE_SETTLE_DURATION, 1);
      const ease = easeOutCubic(t);
      diceArray.forEach((die, index) => {
        const targetPos = targetPositions[index];
        if (targetPos) {
          const startPos = startPositions[index];
          if (startPos) {
            die.position.copy(startPos).lerp(targetPos, ease);
          } else {
            die.position.copy(targetPos);
          }
        }
        const startQuat = startQuaternions[index];
        const targetQuat = targetQuaternions[index];
        if (startQuat && targetQuat) {
          die.quaternion.copy(startQuat).slerp(targetQuat, ease);
        }
      });
      if (t >= 1) {
        diceArray.forEach((die, index) => {
          const targetPos = targetPositions[index];
          const targetQuat = targetQuaternions[index];
          if (targetPos) {
            die.position.copy(targetPos);
          }
          if (targetQuat) {
            die.setRotationFromQuaternion(targetQuat);
            die.userData.appliedQuaternion = targetQuat.clone();
          }
        });
        return true;
      }
      return false;
    }
  };
}

function createTileLabel(number) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  const text = String(number);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${size * 0.55}px 'Inter', 'Segoe UI', sans-serif`;
  ctx.lineWidth = size * 0.08;
  ctx.strokeStyle = 'rgba(15,23,42,0.85)';
  ctx.strokeText(text, size / 2, size / 2);
  ctx.fillStyle = '#f8fafc';
  ctx.fillText(text, size / 2, size / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1
  });
  const planeSize = TILE_SIZE * 0.58;
  const geometry = new THREE.PlaneGeometry(planeSize, planeSize);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 10;
  mesh.rotation.x = -Math.PI / 2;
  mesh.userData = { texture, geometry };
  return mesh;
}

function createTileMaterialSet(baseColor) {
  const topColor = baseColor.clone().lerp(new THREE.Color(0xffffff), 0.08);
  const sideColor = TILE_SIDE_COLOR.clone().lerp(topColor, 0.35);
  const bottomColor = TILE_BOTTOM_COLOR.clone().lerp(topColor, 0.2);

  const topMaterial = new THREE.MeshStandardMaterial({
    color: topColor,
    roughness: 0.48,
    metalness: 0.18,
    emissive: new THREE.Color(0x101321),
    emissiveIntensity: 0.18,
    envMapIntensity: 0.45
  });
  topMaterial.shadowSide = THREE.DoubleSide;

  const sideMaterial = new THREE.MeshStandardMaterial({
    color: sideColor,
    roughness: 0.62,
    metalness: 0.12,
    emissive: new THREE.Color(0x080c18),
    emissiveIntensity: 0.14,
    envMapIntensity: 0.32
  });
  sideMaterial.shadowSide = THREE.FrontSide;

  const bottomMaterial = new THREE.MeshStandardMaterial({
    color: bottomColor,
    roughness: 0.7,
    metalness: 0.08,
    emissive: new THREE.Color(0x05070e),
    emissiveIntensity: 0.1,
    envMapIntensity: 0.24
  });

  return {
    materials: [sideMaterial, sideMaterial, topMaterial, bottomMaterial, sideMaterial, sideMaterial],
    topMaterial,
    sideMaterial,
    bottomMaterial
  };
}

function resetTileAppearance(tile) {
  const { topMaterial, sideMaterial, bottomMaterial, baseColor } = tile.userData ?? {};
  if (topMaterial && baseColor) {
    topMaterial.color.copy(baseColor);
    topMaterial.emissive?.setRGB(0, 0, 0);
  }
  if (sideMaterial) {
    sideMaterial.emissive?.setRGB(0, 0, 0);
  }
  if (bottomMaterial) {
    bottomMaterial.emissive?.setRGB(0, 0, 0);
  }
  if (!topMaterial && tile.material?.color && baseColor) {
    tile.material.color.copy(baseColor);
    tile.material.emissive?.setRGB(0, 0, 0);
  }
}

function applyTileHighlight(tile, color, intensity = 1) {
  const { topMaterial, sideMaterial, bottomMaterial } = tile.userData ?? {};
  if (topMaterial?.emissive) {
    topMaterial.emissive.copy(color).multiplyScalar(intensity);
  }
  if (sideMaterial?.emissive) {
    sideMaterial.emissive
      .copy(color)
      .multiplyScalar(intensity * TILE_SIDE_EMISSIVE_SCALE);
  }
  if (bottomMaterial?.emissive) {
    bottomMaterial.emissive
      .copy(color)
      .multiplyScalar(intensity * TILE_BOTTOM_EMISSIVE_SCALE);
  }
  if (!topMaterial && tile.material?.emissive) {
    tile.material.emissive.copy(color).multiplyScalar(intensity);
  }
}

function makeRailTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#b08968';
  ctx.fillRect(0, 0, 128, 64);
  ctx.fillStyle = '#8b5e34';
  for (let i = 0; i < 16; i++) {
    ctx.fillRect(0, i * 4 + (i % 2 ? 1 : 0), 128, 2);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let i = 0; i < 12; i++) {
    ctx.fillRect(0, i * 6, 128, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 1);
  return tex;
}

let railNetTextureCache = null;

function getRailNetTexture() {
  if (railNetTextureCache) return railNetTextureCache;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.7)';
  ctx.lineWidth = 2;
  const spacing = 16;
  for (let i = 0; i <= c.width; i += spacing) {
    ctx.beginPath();
    ctx.moveTo(i + 0.5, 0);
    ctx.lineTo(i + 0.5, c.height);
    ctx.stroke();
  }
  for (let j = 0; j <= c.height; j += spacing) {
    ctx.beginPath();
    ctx.moveTo(0, j + 0.5);
    ctx.lineTo(c.width, j + 0.5);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.35)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= c.width; i += spacing / 2) {
    ctx.beginPath();
    ctx.moveTo(i + 0.5, 0);
    ctx.lineTo(i + 0.5, c.height);
    ctx.stroke();
  }
  for (let j = 0; j <= c.height; j += spacing / 2) {
    ctx.beginPath();
    ctx.moveTo(0, j + 0.5);
    ctx.lineTo(c.width, j + 0.5);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 3);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  railNetTextureCache = tex;
  return tex;
}

function createRailNetMaterial() {
  return new THREE.MeshStandardMaterial({
    map: getRailNetTexture(),
    color: 0xf8fafc,
    roughness: 0.68,
    metalness: 0.18,
    transparent: true,
    opacity: 0.58,
    side: THREE.DoubleSide,
    depthWrite: false
  });
}

function makeSnakeTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0f5132';
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = '#198754';
  const diamond = (cx, cy, w, h) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy - h);
    ctx.lineTo(cx + w, cy);
    ctx.lineTo(cx, cy + h);
    ctx.lineTo(cx - w, cy);
    ctx.closePath();
    ctx.fill();
  };
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 32; x++) {
      const cx = x * 8 + ((y % 2) * 4);
      const cy = y * 8 + 4;
      diamond(cx, cy, 6, 4);
    }
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  for (let y = 0; y <= 128; y += 8) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(256, y + 0.5);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 2);
  tex.anisotropy = 4;
  return tex;
}

function makeFloorTexture() {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, size, size);

  const tile = 64;
  for (let y = 0; y < size; y += tile) {
    for (let x = 0; x < size; x += tile) {
      const shade = (x / tile + y / tile) % 2 === 0 ? '#1f2937' : '#1a2433';
      ctx.fillStyle = shade;
      ctx.fillRect(x, y, tile, tile);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(x, y, tile, 1.5);
      ctx.fillRect(x, y, 1.5, tile);
    }
  }

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
  ctx.lineWidth = 2;
  for (let y = 0; y <= size; y += tile) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(size, y + 0.5);
    ctx.stroke();
  }
  for (let x = 0; x <= size; x += tile) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, size);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(15, 23, 42, 0.22)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= size; i += tile / 2) {
    ctx.beginPath();
    ctx.moveTo(0, i + 0.5);
    ctx.lineTo(size, i + 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(i + 0.5, 0);
    ctx.lineTo(i + 0.5, size);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeRoundedBoxGeometry(w, h, d, r, seg = 4) {
  const geo = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const hw = w / 2;
  const hh = h / 2;
  const hd = d / 2;
  const irx = hw - r;
  const iry = hh - r;
  const irz = hd - r;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const cx = THREE.MathUtils.clamp(v.x, -irx, irx);
    const cy = THREE.MathUtils.clamp(v.y, -iry, iry);
    const cz = THREE.MathUtils.clamp(v.z, -irz, irz);
    const delta = new THREE.Vector3(v.x - cx, v.y - cy, v.z - cz);
    const l = delta.length();
    if (l > 0) {
      delta.normalize().multiplyScalar(r);
      v.set(cx + delta.x, cy + delta.y, cz + delta.z);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function parseJumpMap(data = {}) {
  const entries = [];
  Object.entries(data).forEach(([start, value]) => {
    const s = Number(start);
    if (!Number.isFinite(s)) return;
    if (typeof value === 'number') {
      entries.push([s, value]);
    } else if (value && typeof value === 'object') {
      const end = Number(value.end ?? value.target ?? value.to ?? value);
      if (Number.isFinite(end)) entries.push([s, end]);
    }
  });
  return entries;
}

function buildArena(scene, renderer, host, cameraRef, disposeHandlers) {
  scene.background = new THREE.Color('#030712');

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

  const floorTexture = makeFloorTexture();
  floorTexture.center.set(0.5, 0.5);
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#111827'),
    roughness: 0.92,
    metalness: 0.08,
    map: floorTexture
  });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(TABLE_RADIUS * ARENA_GROWTH * 3.2, 64), floorMaterial);
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
    createArenaWallMaterial('#1f2937', '#64748b')
  );
  wall.position.y = ARENA_WALL_CENTER_Y;
  arenaGroup.add(wall);

  const woodOption = TABLE_WOOD_OPTIONS[DEFAULT_TABLE_CUSTOMIZATION.tableWood] ?? TABLE_WOOD_OPTIONS[0];
  const clothOption = TABLE_CLOTH_OPTIONS[DEFAULT_TABLE_CUSTOMIZATION.tableCloth] ?? TABLE_CLOTH_OPTIONS[0];
  const baseOption = TABLE_BASE_OPTIONS[DEFAULT_TABLE_CUSTOMIZATION.tableBase] ?? TABLE_BASE_OPTIONS[0];
  const shapeOption = TABLE_SHAPE_OPTIONS[0];
  const chairOption = DEFAULT_CHAIR_OPTION;

  const tableInfo = createMurlanStyleTable({
    arena: arenaGroup,
    renderer,
    tableRadius: TABLE_RADIUS,
    tableHeight: TABLE_HEIGHT,
    woodOption,
    clothOption,
    baseOption,
    shapeOption,
    rotationY: 0
  });
  applyTableMaterials(tableInfo.materials, { woodOption, clothOption, baseOption }, renderer);

  const boardGroup = new THREE.Group();
  boardGroup.position.set(0, tableInfo.surfaceY + 0.004, 0);
  boardGroup.scale.setScalar(BOARD_SCALE);
  tableInfo.group.add(boardGroup);

  const boardLookTarget = new THREE.Vector3(
    0,
    tableInfo.surfaceY + CAMERA_TARGET_LIFT + 0.12 * MODEL_SCALE,
    0
  );

  const camera = new THREE.PerspectiveCamera(CAM.fov, 1, CAM.near, CAM.far);
  const isPortrait = host.clientHeight > host.clientWidth;
  const cameraSeatAngle = Math.PI / 2;
  const cameraBackOffset = isPortrait ? 1.65 : 1.05;
  const cameraForwardOffset = isPortrait ? 0.18 : 0.35;
  const cameraHeightOffset = isPortrait ? 1.46 : 1.12;
  const cameraRadius = AI_CHAIR_RADIUS + cameraBackOffset - cameraForwardOffset;
  camera.position.set(
    Math.cos(cameraSeatAngle) * cameraRadius,
    TABLE_HEIGHT + cameraHeightOffset,
    Math.sin(cameraSeatAngle) * cameraRadius
  );
  camera.lookAt(boardLookTarget);

  const controls = new OrbitControls(camera, renderer.domElement);
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

  const fit = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h || 1;
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

  fit();
  cameraRef.current = camera;

  const chairMaterial = createChairFabricMaterial(chairOption, renderer);
  const legMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(chairOption.legColor ?? DEFAULT_STOOL_THEME.legColor)
  });
  legMaterial.userData = { chairId: chairOption.id ?? 'default' };

  const chairs = [];
  for (let i = 0; i < DEFAULT_PLAYER_COUNT; i += 1) {
    const fallbackAngle = Math.PI / 2 - HUMAN_SEAT_ROTATION_OFFSET - (i / DEFAULT_PLAYER_COUNT) * Math.PI * 2;
    const angle = CUSTOM_CHAIR_ANGLES[i] ?? fallbackAngle;
    const forward = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const seatPos = forward.clone().multiplyScalar(AI_CHAIR_RADIUS);
    seatPos.y = CHAIR_BASE_HEIGHT;
    const group = new THREE.Group();
    group.position.copy(seatPos);
    group.lookAt(new THREE.Vector3(0, seatPos.y, 0));

    const seatMesh = new THREE.Mesh(new THREE.BoxGeometry(SEAT_WIDTH, SEAT_THICKNESS, SEAT_DEPTH), chairMaterial);
    seatMesh.position.y = SEAT_THICKNESS / 2;
    seatMesh.castShadow = true;
    seatMesh.receiveShadow = true;
    group.add(seatMesh);

    const backMesh = new THREE.Mesh(
      new THREE.BoxGeometry(SEAT_WIDTH, BACK_HEIGHT, BACK_THICKNESS),
      chairMaterial
    );
    backMesh.position.set(0, SEAT_THICKNESS / 2 + BACK_HEIGHT / 2, -SEAT_DEPTH / 2 + BACK_THICKNESS / 2);
    backMesh.castShadow = true;
    backMesh.receiveShadow = true;
    group.add(backMesh);

    const armLeft = createStraightArmrest('left', chairMaterial);
    group.add(armLeft.group);
    const armRight = createStraightArmrest('right', chairMaterial);
    group.add(armRight.group);

    const legBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16 * MODEL_SCALE * STOOL_SCALE, 0.2 * MODEL_SCALE * STOOL_SCALE, BASE_COLUMN_HEIGHT, 16),
      legMaterial
    );
    legBase.position.y = -SEAT_THICKNESS / 2 - BASE_COLUMN_HEIGHT / 2;
    legBase.castShadow = true;
    legBase.receiveShadow = true;
    group.add(legBase);

    const avatarAnchor = new THREE.Object3D();
    avatarAnchor.position.set(0, AVATAR_ANCHOR_HEIGHT, 0);
    group.add(avatarAnchor);

    arenaGroup.add(group);
    chairs.push({ group, anchor: avatarAnchor, meshes: [seatMesh, backMesh, ...armLeft.meshes, ...armRight.meshes], legMesh: legBase });
  }

  const updateCameraTarget = () => {
    const radius = camera.position.distanceTo(boardLookTarget);
    const dir = camera.position.clone().sub(boardLookTarget).normalize();
    camera.position.copy(boardLookTarget).addScaledVector(dir, radius);
    camera.lookAt(boardLookTarget);
    controls.target.copy(boardLookTarget);
    fit();
  };

  disposeHandlers.push(() => {
    controls.dispose();
    disposeChairMaterial(chairMaterial);
    legMaterial.dispose?.();
    chairs.forEach(({ group }) => {
      group.parent?.remove(group);
    });
    if (tableInfo?.dispose) tableInfo.dispose();
    scene.remove(ambient, spot, rim);
    floor.geometry.dispose();
    floor.material.map?.dispose?.();
    floor.material.dispose();
    carpet.geometry.dispose();
    carpet.material.dispose();
    wall.geometry.dispose();
    wall.material.dispose();
    arenaGroup.parent?.remove(arenaGroup);
  });

  return { boardGroup, boardLookTarget, fit, updateCameraTarget, controls, seatAnchors: chairs.map(({ anchor }) => anchor) };
}

function buildSnakeBoard(
  boardGroup,
  boardLookTarget,
  disposeHandlers = [],
  onTargetChange = null
) {
  const boardRoot = new THREE.Group();
  boardGroup.add(boardRoot);

  const platformGroup = new THREE.Group();
  boardRoot.add(platformGroup);

  const tileGroup = new THREE.Group();
  boardRoot.add(tileGroup);

  const tileMeshes = new Map();
  const indexToPosition = new Map();
  const tileHeight = BOARD_TILE_HEIGHT;
  const tileGeo = new THREE.BoxGeometry(
    TILE_SIZE - TILE_GAP,
    tileHeight,
    TILE_SIZE - TILE_GAP
  );

  const labelGroup = new THREE.Group();
  boardRoot.add(labelGroup);

  const platformThickness = PYRAMID_PLATFORM_THICKNESS;
  const levelGap = PYRAMID_LEVEL_GAP;
  const platformMeshes = [];
  const railingInfos = [];
  const levelPlacements = [];
  const topTileLift = (platformThickness + tileHeight + levelGap) * TOP_TILE_EXTRA_LEVELS;

  let currentLevelBottom = 0;
  PYRAMID_LEVELS.forEach((size, levelIndex) => {
    const dimension = size * TILE_SIZE;
    const t = levelIndex / Math.max(1, PYRAMID_LEVELS.length - 1);
    const tone = PYRAMID_CONCRETE_LIGHT.clone().lerp(PYRAMID_CONCRETE_SHADOW, t * 0.85);
    const rimTone = PYRAMID_CONCRETE_ACCENT.clone().lerp(PYRAMID_CONCRETE_LIGHT, t * 0.65);
    const mat = new THREE.MeshStandardMaterial({
      color: tone,
      roughness: 0.76,
      metalness: 0.08,
      emissive: rimTone.clone().multiplyScalar(0.18),
      emissiveIntensity: 0.14
    });
    const baseExtraRatio = 1 - levelIndex / (PYRAMID_LEVELS.length + 1);
    let extra =
      BOARD_BASE_EXTRA *
      (levelIndex === 0 ? baseExtraRatio * BASE_PLATFORM_EXTRA_MULTIPLIER : baseExtraRatio);
    if (levelIndex === 0) {
      extra += FIRST_LEVEL_PLATFORM_EXTRA;
    }
    const shrinkFactor = BENTONITE_EXTRA_SHRINK[levelIndex] ?? 1;
    const platformSize = dimension + extra * shrinkFactor;
    const platform = new THREE.Mesh(new THREE.BoxGeometry(platformSize, platformThickness, platformSize), mat);
    platform.position.y = currentLevelBottom + platformThickness / 2;
    platformGroup.add(platform);
    platformMeshes.push(platform);

    const platformTopY = currentLevelBottom + platformThickness;
    const walkwayEstimate = -dimension / 2 + TILE_SIZE / 2;
    railingInfos.push({
      halfSize: platformSize / 2,
      topY: platformTopY,
      gapWidth: RAIL_GAP_WIDTH,
      walkwayCenter: walkwayEstimate,
      levelIndex
    });

    if (levelIndex === 0) {
      const pavementSize = platformSize * PAVEMENT_EXTRA_SCALE;
      addPavementLayer(platformGroup, pavementSize, PAVEMENT_THICKNESS, currentLevelBottom, platformMeshes);
    }

    const tileCenterY = currentLevelBottom + platformThickness + tileHeight / 2;
    const tileTopY = tileCenterY + tileHeight / 2;
    levelPlacements.push({
      size,
      half: dimension / 2,
      tileCenterY,
      tileTopY
    });

    currentLevelBottom += platformThickness + tileHeight + levelGap;
  });

  const levelOffsets = [];
  let accumulated = 0;
  PYRAMID_LEVELS.forEach((size, idx) => {
    levelOffsets[idx] = accumulated;
    accumulated += LEVEL_TILE_COUNTS[idx];
  });

  PYRAMID_LEVELS.forEach((size, levelIndex) => {
    const offset = levelOffsets[levelIndex];
    const { half, tileCenterY, tileTopY } = levelPlacements[levelIndex];
    const perimeter = buildPerimeterSequence(size);
    perimeter.forEach(({ row, col }, seqIndex) => {
      const idx = offset + seqIndex + 1;
      const baseColor = (row + col) % 2 === 0 ? TILE_COLOR_A : TILE_COLOR_B;
      const materialSet = createTileMaterialSet(baseColor);
      const baseX = -half + (col + 0.5) * TILE_SIZE;
      const baseZ = -half + ((size - 1 - row) + 0.5) * TILE_SIZE;
      const tilePosition = new THREE.Vector3(baseX, tileCenterY, baseZ);
      if (levelIndex === 0) {
        const outward = tilePosition.clone();
        outward.y = 0;
        if (outward.lengthSq() > 1e-6) {
          outward.normalize().multiplyScalar(EDGE_TILE_OUTWARD_OFFSET);
          tilePosition.add(outward);
        }
      }
      if (idx === TOTAL_BOARD_TILES) {
        tilePosition.y += topTileLift;
      }
      const tile = new THREE.Mesh(tileGeo, materialSet.materials);
      tile.position.copy(tilePosition);
      tile.castShadow = true;
      tile.receiveShadow = true;
      tile.userData.index = idx;
      tile.userData.topMaterial = materialSet.topMaterial;
      tile.userData.sideMaterial = materialSet.sideMaterial;
      tile.userData.bottomMaterial = materialSet.bottomMaterial;
      tile.userData.baseColor = materialSet.topMaterial.color.clone();
      tileGroup.add(tile);
      tileMeshes.set(idx, tile);

      const topPosition = tilePosition.clone();
      topPosition.y = tileTopY;
      if (idx === TOTAL_BOARD_TILES) {
        topPosition.y += topTileLift;
      }
      indexToPosition.set(idx, topPosition);

      const label = createTileLabel(idx);
      let labelY = tileTopY;
      if (idx === TOTAL_BOARD_TILES) {
        labelY += topTileLift;
      }
      label.position.set(tilePosition.x, labelY + TILE_LABEL_OFFSET, tilePosition.z);
      labelGroup.add(label);
    });
  });

  railingInfos.forEach(({ halfSize, topY, gapWidth, walkwayCenter, levelIndex }) => {
    const startIndex = LEVEL_START_INDICES[levelIndex] ?? 1;
    const startPos = indexToPosition.get(startIndex);
    const entryConfig = getRailingEntryConfig(levelIndex, indexToPosition);
    let gapCenter;
    if (entryConfig.center != null) {
      gapCenter = entryConfig.center;
    } else if (startPos) {
      gapCenter = entryConfig.axis === 'z' ? startPos.z : startPos.x;
    } else {
      gapCenter = entryConfig.axis === 'z' ? 0 : walkwayCenter;
    }
    addChromeRailings(
      platformGroup,
      {
        halfSize,
        topY,
        railHeight: RAIL_HEIGHT,
        gapWidth,
        gapCenter,
        entrySide: entryConfig.side,
        addNet: levelIndex > 0
      },
      platformMeshes
    );
  });

  STAIR_CONNECTIONS.forEach(({ from, to }, index) => {
    addWallStaircase(
      platformGroup,
      {
        fromIndex: from,
        toIndex: to,
        indexToPosition,
        stepCount: STAIR_STEP_COUNT,
        width: STAIR_WIDTH,
        depthMin: STAIR_DEPTH_MIN,
        outwardOffset: STAIR_OUTWARD_OFFSET * (1 - index * 0.08)
      },
      platformMeshes
    );
  });

  const tileHundred = tileMeshes.get(TOTAL_BOARD_TILES);
  if (tileHundred) {
    const topLevelPlacement = levelPlacements[levelPlacements.length - 1];
    const supportBaseY = topLevelPlacement.tileCenterY - tileHeight / 2;
    const supportTopY = tileHundred.position.y - tileHeight / 2;
    const supportHeight = Math.max(
      TILE_100_SUPPORT_HEIGHT_EXTRA,
      supportTopY - supportBaseY + TILE_100_SUPPORT_HEIGHT_EXTRA
    );
    const supportMaterial = new THREE.MeshStandardMaterial({
      color: PYRAMID_CONCRETE_LIGHT.clone().lerp(PYRAMID_CONCRETE_SHADOW, 0.55),
      roughness: 0.74,
      metalness: 0.08,
      emissive: PYRAMID_CONCRETE_ACCENT.clone().multiplyScalar(0.14),
      emissiveIntensity: 0.18
    });
    const support = new THREE.Mesh(
      new THREE.CylinderGeometry(TILE_100_SUPPORT_RADIUS * 0.85, TILE_100_SUPPORT_RADIUS, supportHeight, 24),
      supportMaterial
    );
    support.position.set(tileHundred.position.x, supportBaseY + supportHeight / 2, tileHundred.position.z);
    support.castShadow = true;
    support.receiveShadow = true;
    platformGroup.add(support);
    platformMeshes.push(support);
  }

  const baseHalf = (BASE_LEVEL_TILES * TILE_SIZE) / 2;
  const baseStart = new THREE.Vector3(
    -baseHalf - TILE_SIZE * 0.8,
    levelPlacements[0].tileTopY,
    -baseHalf - TILE_SIZE * 0.6
  );
  const apexTop = levelPlacements[levelPlacements.length - 1]?.tileTopY ?? levelPlacements[0].tileTopY;

  const serpentineIndexToXZ = (index) => {
    if (index < 1) {
      return baseStart.clone();
    }
    if (indexToPosition.has(index)) {
      return indexToPosition.get(index).clone();
    }
    const clamped = Math.min(TOTAL_BOARD_TILES, Math.max(1, Math.floor(index)));
    const fallback = indexToPosition.get(clamped);
    if (fallback) return fallback.clone();
    return new THREE.Vector3(0, apexTop, 0);
  };

  const laddersGroup = new THREE.Group();
  boardRoot.add(laddersGroup);

  const snakesGroup = new THREE.Group();
  boardRoot.add(snakesGroup);

  const tokensGroup = new THREE.Group();
  boardRoot.add(tokensGroup);

  const potGroup = new THREE.Group();
  const coin = new THREE.Mesh(
    new THREE.CylinderGeometry(TILE_SIZE * 0.24, TILE_SIZE * 0.24, TILE_SIZE * 0.12, 32),
    new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.3,
      metalness: 0.4,
      emissive: 0x332200,
      emissiveIntensity: 0.25
    })
  );
  coin.rotation.x = Math.PI / 2;
  coin.position.y = COIN_LOCAL_LIFT;
  coin.castShadow = true;
  coin.receiveShadow = true;
  potGroup.add(coin);
  potGroup.userData.coin = coin;
  const potPos = serpentineIndexToXZ(TOTAL_BOARD_TILES);
  potGroup.position.set(potPos.x, potPos.y + COIN_RAISE, potPos.z);
  boardRoot.add(potGroup);

  const diceGroup = new THREE.Group();
  const baseLevelTop = levelPlacements[0].tileTopY;
  const diceBaseY = baseLevelTop + DICE_SIZE * 0.5 + TILE_SIZE * 0.02;
  const diceAnchorZ =
    baseHalf +
    DICE_THROW_LANDING_MARGIN +
    DICE_RETREAT_EXTRA +
    DICE_SIZE * 0.5 +
    DICE_PLAYER_EXTRA_OFFSET;
  const diceSpacing = DICE_SIZE * 1.35;
  const diceSet = [];
  for (let i = 0; i < MAX_DICE; i += 1) {
    const die = makeDice();
    die.visible = true;
    const offsetX = (i - (MAX_DICE - 1) / 2) * diceSpacing;
    die.position.set(offsetX, diceBaseY, diceAnchorZ);
    diceGroup.add(die);
    diceSet.push(die);
  }
  boardRoot.add(diceGroup);

  const diceLightTarget = new THREE.Object3D();
  diceLightTarget.position.set(0, diceBaseY, diceAnchorZ);
  boardRoot.add(diceLightTarget);

  const diceAccent = new THREE.SpotLight(0xfff1c1, 2.25, RAW_BOARD_SIZE * 1.2, Math.PI / 5, 0.42, 1.25);
  diceAccent.userData.offset = new THREE.Vector3(DICE_SIZE * 2.6, DICE_SIZE * 7.5, DICE_SIZE * 3.4);
  diceAccent.target = diceLightTarget;
  boardRoot.add(diceAccent);

  const diceFill = new THREE.PointLight(0xffe4a3, 1.18, RAW_BOARD_SIZE * 0.9, 2.2);
  diceFill.userData.offset = new THREE.Vector3(-DICE_SIZE * 3.2, DICE_SIZE * 6.2, -DICE_SIZE * 3.6);
  boardRoot.add(diceFill);

  disposeHandlers.push(() => {
    platformMeshes.forEach((mesh) => {
      mesh.geometry.dispose();
      mesh.material.dispose?.();
    });
  });

  disposeHandlers.push(() => {
    labelGroup.children.forEach((sprite) => {
      if (sprite.material?.map) sprite.material.map.dispose();
      sprite.material?.dispose?.();
      sprite.geometry?.dispose?.();
    });
  });

  if (boardLookTarget) {
    boardGroup.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(boardRoot);
    const center = new THREE.Vector3();
    bounds.getCenter(center);
    const targetY = Number.isFinite(boardLookTarget.y) ? boardLookTarget.y : center.y;
    center.y = targetY;
    boardLookTarget.copy(center);
    onTargetChange?.();
  }

  return {
    root: boardRoot,
    tileMeshes,
    indexToPosition,
    laddersGroup,
    snakesGroup,
    tokensGroup,
    serpentineIndexToXZ,
    potGroup,
    labelGroup,
    diceGroup,
    diceSet,
    diceBaseY,
    diceAnchorZ,
    baseLevelTop,
    diceLights: {
      accent: diceAccent,
      fill: diceFill,
      target: diceLightTarget
    }
  };
}

function updateTilesHighlight(tileMeshes, highlight, trail) {
  tileMeshes.forEach((tile) => {
    resetTileAppearance(tile);
  });
  if (trail?.length) {
    trail.forEach((segment) => {
      const tile = tileMeshes.get(segment.cell);
      if (!tile) return;
      const color = HIGHLIGHT_COLORS[segment.type] ?? HIGHLIGHT_COLORS.normal;
      applyTileHighlight(tile, color, 0.35);
    });
  }
  if (highlight) {
    const tile = tileMeshes.get(highlight.cell);
    if (tile) {
      const color = HIGHLIGHT_COLORS[highlight.type] ?? HIGHLIGHT_COLORS.normal;
      applyTileHighlight(tile, color);
    }
  }
}

function updateTokens(
  tokensGroup,
  players,
  indexToPosition,
  serpentineIndexToXZ,
  {
    burning = [],
    rollingIndex = null,
    currentTurn = null,
    boardRoot = null,
    seatAnchors = [],
    baseLevelTop = 0
  } = {}
) {
  if (!tokensGroup) return;
  const existing = new Map();
  tokensGroup.children.forEach((child) => {
    if (child.userData && child.userData.playerIndex != null) {
      existing.set(child.userData.playerIndex, child);
    }
  });

  const occupancy = new Map();
  players.forEach((player, index) => {
    const raw = Number(player.position);
    if (!Number.isFinite(raw) || raw < 1) return;
    if (!occupancy.has(raw)) occupancy.set(raw, []);
    occupancy.get(raw).push(index);
  });

  const keep = new Set();

  const seatHomes = [];
  if (boardRoot && Array.isArray(seatAnchors) && seatAnchors.length) {
    boardRoot.updateMatrixWorld(true);
    const boardHalf = (BASE_LEVEL_TILES * TILE_SIZE) / 2;
    const baseY = Number.isFinite(baseLevelTop) ? baseLevelTop : 0;
    const center = new THREE.Vector3(0, baseY, 0);
    const forwardLift = HOME_TOKEN_FORWARD_LIFT + HOME_TOKEN_OUTWARD_EXTRA;
    seatAnchors.forEach((anchor, index) => {
      if (!anchor) {
        seatHomes[index] = null;
        return;
      }
      anchor.updateMatrixWorld?.(true);
      const seatWorld = new THREE.Vector3();
      anchor.getWorldPosition(seatWorld);
      const seatLocal = seatWorld.clone();
      boardRoot.worldToLocal(seatLocal);
      const direction = seatLocal.clone().sub(center);
      direction.y = 0;
      if (direction.lengthSq() < 1e-6) {
        direction.set(0, 0, 1);
      } else {
        direction.normalize();
      }
      let seatBonus = 0;
      if (index === 1 || index === 3) seatBonus = SIDE_HOME_EXTRA_DISTANCE;
      else if (index === 2) seatBonus = BACK_HOME_EXTRA_DISTANCE;
      const distanceFromBoard = boardHalf + BOARD_EDGE_BUFFER + forwardLift + seatBonus;
      const target = center.clone().addScaledVector(direction, distanceFromBoard);
      target.y = baseY + TOKEN_HEIGHT * 0.02;
      seatHomes[index] = { position: target, direction };
    });
  }

  players.forEach((player, index) => {
    keep.add(index);
    let token = existing.get(index);
    if (!token) {
      token = new THREE.Group();
      const baseColor = new THREE.Color(player.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]);
      const coreMaterial = new THREE.MeshPhysicalMaterial({
        color: baseColor.clone(),
        roughness: 0.32,
        metalness: 0.45,
        clearcoat: 0.36,
        clearcoatRoughness: 0.22,
        sheen: 0.35,
        sheenColor: baseColor.clone().lerp(new THREE.Color('#ffffff'), 0.55)
      });
      const accentMaterial = new THREE.MeshPhysicalMaterial({
        color: baseColor.clone().lerp(TOKEN_ACCENT_TARGET, 0.55),
        roughness: 0.24,
        metalness: 0.82,
        clearcoat: 0.18,
        clearcoatRoughness: 0.25
      });

      const baseHeight = TOKEN_HEIGHT * 0.24;
      const bodyHeight = TOKEN_HEIGHT * 0.46;
      const leftoverHeight = Math.max(TOKEN_HEIGHT - (baseHeight + bodyHeight), TOKEN_HEIGHT * 0.18);
      const headHeight = leftoverHeight * 0.65;
      const crestHeight = Math.max(leftoverHeight - headHeight, TOKEN_HEIGHT * 0.08);

      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(TOKEN_RADIUS * 1.45, TOKEN_RADIUS * 1.65, baseHeight, 48),
        accentMaterial
      );
      base.position.y = baseHeight / 2;
      base.castShadow = true;
      base.receiveShadow = true;
      token.add(base);

      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(TOKEN_RADIUS * 1.05, TOKEN_RADIUS * 0.82, bodyHeight, 48),
        coreMaterial
      );
      body.position.y = baseHeight + bodyHeight / 2;
      body.castShadow = true;
      body.receiveShadow = true;
      token.add(body);

      const collar = new THREE.Mesh(
        new THREE.TorusGeometry(TOKEN_RADIUS * 0.95, TOKEN_HEIGHT * 0.06, 24, 48),
        accentMaterial
      );
      collar.rotation.x = Math.PI / 2;
      collar.position.y = baseHeight + bodyHeight * 0.78;
      collar.castShadow = true;
      collar.receiveShadow = true;
      token.add(collar);

      const head = new THREE.Mesh(
        new RoundedBoxGeometry(TOKEN_RADIUS * 1.3, headHeight, TOKEN_RADIUS * 1.3, 6, TOKEN_RADIUS * 0.45),
        coreMaterial
      );
      head.position.y = baseHeight + bodyHeight + headHeight / 2;
      head.castShadow = true;
      head.receiveShadow = true;
      token.add(head);

      const crest = new THREE.Mesh(
        new THREE.CylinderGeometry(TOKEN_RADIUS * 0.55, TOKEN_RADIUS * 0.7, crestHeight, 32),
        accentMaterial
      );
      crest.position.y = baseHeight + bodyHeight + headHeight + crestHeight / 2;
      crest.castShadow = true;
      crest.receiveShadow = true;
      token.add(crest);

      token.userData = {
        playerIndex: index,
        material: coreMaterial,
        coreMaterial,
        accentMaterial,
        isSliding: false
      };
      tokensGroup.add(token);
    }

    const mat = token.userData.coreMaterial || token.userData.material;
    const accentMat = token.userData.accentMaterial || null;
    const targetColor = new THREE.Color(player.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]);

    if (mat) {
      mat.color.copy(targetColor);
      if (mat.sheenColor) {
        mat.sheenColor.copy(targetColor.clone().lerp(new THREE.Color('#ffffff'), 0.5));
      }
    }
    if (accentMat) {
      const accentColor = targetColor.clone().lerp(TOKEN_ACCENT_TARGET, 0.55);
      accentMat.color.copy(accentColor);
    }

    let emissiveHex = 0x000000;
    let emissiveIntensity = 0.2;
    if (burning.includes(index)) {
      emissiveHex = 0x7f1d1d;
      emissiveIntensity = 0.65;
    } else if (index === rollingIndex) {
      emissiveHex = 0x0ea5e9;
      emissiveIntensity = 0.45;
    } else if (index === currentTurn) {
      emissiveHex = 0x1d4ed8;
      emissiveIntensity = 0.4;
    }

    if (mat) {
      if (emissiveHex === 0x000000) {
        mat.emissive.setRGB(0, 0, 0);
      } else {
        mat.emissive.setHex(emissiveHex);
      }
      mat.emissiveIntensity = emissiveIntensity;
    }

    if (accentMat) {
      if (emissiveHex === 0x000000) {
        const glow = targetColor.clone().lerp(TOKEN_ACCENT_TARGET, 0.6).multiplyScalar(0.15);
        accentMat.emissive.copy(glow);
        accentMat.emissiveIntensity = 1;
      } else {
        accentMat.emissive.setHex(emissiveHex);
        accentMat.emissiveIntensity = emissiveIntensity;
      }
    }

    const rawPosition = Number(player.position);
    const hasBoardPosition = Number.isFinite(rawPosition) && rawPosition >= 1;
    let worldPos = null;
    if (hasBoardPosition) {
      const tilePlayers = occupancy.get(rawPosition) || [];
      const occupantCount = tilePlayers.length;
      let offsetX = 0;
      let offsetZ = 0;
      if (occupantCount > 1) {
        const radius = Math.min(TOKEN_MULTI_OCCUPANT_RADIUS, TOKEN_RADIUS * 1.15);
        const offsetIndex = tilePlayers.indexOf(index);
        const indexForAngle = offsetIndex >= 0 ? offsetIndex : 0;
        const angle = (indexForAngle / occupantCount) * Math.PI * 2;
        offsetX = Math.cos(angle) * radius;
        offsetZ = Math.sin(angle) * radius;
      }
      const basePos = indexToPosition.get(rawPosition);
      const baseVector = basePos ? basePos.clone() : serpentineIndexToXZ(rawPosition).clone();
      baseVector.x += offsetX;
      baseVector.z += offsetZ;
      baseVector.y += TOKEN_HEIGHT * 0.02;
      worldPos = baseVector;
    } else {
      const fallbackHomeIndex = seatHomes.length > 0 ? index % seatHomes.length : -1;
      const home =
        seatHomes[index] || (fallbackHomeIndex >= 0 ? seatHomes[fallbackHomeIndex] : null) || null;
      if (home?.position) {
        worldPos = home.position.clone();
      } else {
        const fallbackIndex = Number.isFinite(rawPosition) ? rawPosition : 0;
        worldPos = serpentineIndexToXZ(fallbackIndex).clone();
        worldPos.y = (Number.isFinite(baseLevelTop) ? baseLevelTop : worldPos.y) + TOKEN_HEIGHT * 0.02;
      }
    }

    if (!token.userData.isSliding && worldPos) {
      token.position.copy(worldPos);
    }
  });

  existing.forEach((group, index) => {
    if (!keep.has(index)) {
      tokensGroup.remove(group);
      group.traverse((obj) => {
        if (obj.isMesh) {
          obj.geometry.dispose();
          obj.material.dispose();
        }
      });
    }
  });
}

function updateLadders(group, ladders, indexToPosition, serpentineIndexToXZ, railTexture) {
  while (group.children.length) {
    const child = group.children.pop();
    if (child) {
      child.traverse?.((o) => {
        if (o.isMesh) {
          o.geometry.dispose();
          if (Array.isArray(o.material)) {
            o.material.forEach((m) => m.dispose?.());
          } else {
            o.material.dispose?.();
          }
        }
      });
    }
  }

  const matRail = new THREE.MeshStandardMaterial({
    map: railTexture,
    color: 0xffffff,
    roughness: 0.6,
    metalness: 0.05
  });
  const matRung = new THREE.MeshStandardMaterial({
    color: 0xeab308,
    roughness: 0.55,
    metalness: 0.05
  });

  group.userData.paths = new Map();

  parseJumpMap(ladders)
    .filter(([a, b]) => b > a)
    .forEach(([start, end]) => {
      const A = (indexToPosition.get(start) || serpentineIndexToXZ(start)).clone();
      const B = (indexToPosition.get(end) || serpentineIndexToXZ(end)).clone();
      const dir = B.clone().sub(A);
      const len = dir.length();
      const up = new THREE.Vector3(0, 1, 0);
      const forward = dir.lengthSq() > 1e-6 ? dir.clone().normalize() : new THREE.Vector3(0, 0, 1);
      const rightBase = new THREE.Vector3().crossVectors(forward, up);
      if (rightBase.lengthSq() < 1e-6) {
        rightBase.set(1, 0, 0);
      } else {
        rightBase.normalize();
      }
      const railOffset = TILE_SIZE * 0.14;

      const baseLift = LADDER_BASE_LIFT;
      const archHeight = Math.min(TILE_SIZE * 1.05, LADDER_ARCH_BASE + len * LADDER_ARCH_SCALE);
      const swayAmount = Math.min(TILE_SIZE * 0.22, LADDER_SWAY_BASE + len * LADDER_SWAY_SCALE);

      const startPoint = pullPointTowardCenter(A.clone().addScaledVector(up, baseLift));
      const endPoint = pullPointTowardCenter(B.clone().addScaledVector(up, baseLift));
      const quarterLift = archHeight * LADDER_INNER_LIFT_RATIO;
      const threeQuarterLift = archHeight * LADDER_OUTER_LIFT_RATIO;
      const quarterPoint = startPoint
        .clone()
        .lerp(endPoint, 0.25)
        .addScaledVector(up, quarterLift)
        .addScaledVector(rightBase, swayAmount);
      const midPoint = startPoint.clone().lerp(endPoint, 0.5).addScaledVector(up, archHeight);
      const threeQuarterPoint = startPoint
        .clone()
        .lerp(endPoint, 0.75)
        .addScaledVector(up, threeQuarterLift)
        .addScaledVector(rightBase, -swayAmount);

      const centerPoints = [startPoint, quarterPoint, midPoint, threeQuarterPoint, endPoint];
      const centerCurve = new THREE.CatmullRomCurve3(centerPoints, false, 'centripetal');

      const leftPoints = [];
      const rightPoints = [];
      centerPoints.forEach((point, pointIndex) => {
        const prev = centerPoints[pointIndex - 1] ?? centerPoints[pointIndex];
        const next = centerPoints[pointIndex + 1] ?? centerPoints[pointIndex];
        const tangent = next.clone().sub(prev);
        if (tangent.lengthSq() < 1e-6) {
          tangent.copy(forward);
        } else {
          tangent.normalize();
        }
        const localRight = new THREE.Vector3().crossVectors(tangent, up);
        if (localRight.lengthSq() < 1e-6) {
          localRight.copy(rightBase);
        } else {
          localRight.normalize();
        }
        const ease = pointIndex === 1 || pointIndex === centerPoints.length - 2 ? 0.82 : 1;
        leftPoints.push(point.clone().addScaledVector(localRight, -railOffset * ease));
        rightPoints.push(point.clone().addScaledVector(localRight, railOffset * ease));
      });

      const leftCurve = new THREE.CatmullRomCurve3(leftPoints, false, 'centripetal');
      const rightCurve = new THREE.CatmullRomCurve3(rightPoints, false, 'centripetal');

      const railGeomA = new THREE.TubeGeometry(leftCurve, 64, TILE_SIZE * 0.05, 12, false);
      const railGeomB = new THREE.TubeGeometry(rightCurve, 64, TILE_SIZE * 0.05, 12, false);
      const railA = new THREE.Mesh(railGeomA, matRail.clone());
      const railB = new THREE.Mesh(railGeomB, matRail.clone());
      const repeat = Math.max(3, len / (TILE_SIZE * 0.35));
      railA.material.map.repeat.x = repeat;
      railB.material.map.repeat.x = repeat;
      group.add(railA, railB);

      const rungStep = TILE_SIZE * 0.55;
      const rungCount = Math.max(4, Math.floor(len / rungStep));
      for (let i = 1; i < rungCount; i++) {
        const t = i / rungCount;
        const point = centerCurve.getPoint(t);
        const tangent = centerCurve.getTangent(t).normalize();
        const localRight = new THREE.Vector3().crossVectors(tangent, up);
        if (localRight.lengthSq() < 1e-6) {
          localRight.copy(rightBase);
        } else {
          localRight.normalize();
        }
        const rungGeom = new THREE.CylinderGeometry(TILE_SIZE * 0.04, TILE_SIZE * 0.04, railOffset * 2, 12);
        const rung = new THREE.Mesh(rungGeom, matRung);
        rung.position.copy(point);
        rung.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), localRight);
        group.add(rung);
      }

      group.userData.paths.set(start, {
        curve: centerCurve,
        start: startPoint.clone(),
        end: endPoint.clone()
      });
    });
}

function updateSnakes(group, snakes, indexToPosition, serpentineIndexToXZ, snakeTexture) {
  while (group.children.length) {
    const child = group.children.pop();
    if (child) {
      child.traverse?.((o) => {
        if (o.isMesh) {
          o.geometry.dispose();
          if (Array.isArray(o.material)) {
            o.material.forEach((m) => m.dispose?.());
          } else {
            o.material.dispose?.();
          }
        }
      });
    }
  }

  const matBody = new THREE.MeshStandardMaterial({
    map: snakeTexture,
    color: 0xffffff,
    roughness: 0.45,
    metalness: 0.05
  });
  const matHead = new THREE.MeshStandardMaterial({
    color: 0x14532d,
    roughness: 0.4,
    metalness: 0.05
  });
  const matTail = new THREE.MeshStandardMaterial({
    color: 0x1b8060,
    roughness: 0.55,
    metalness: 0.05
  });
  const matTongue = new THREE.MeshStandardMaterial({
    color: 0xff0000,
    emissive: 0x440000,
    roughness: 0.3,
    metalness: 0.05
  });

  const entries = parseJumpMap(snakes).filter(([a, b]) => b < a);

  group.userData.paths = new Map();

  entries.forEach(([start, end]) => {
    const baseStart = (indexToPosition.get(start) || serpentineIndexToXZ(start)).clone();
    const baseEnd = (indexToPosition.get(end) || serpentineIndexToXZ(end)).clone();
    const startPoint = pullPointTowardCenter(baseStart.clone().add(new THREE.Vector3(0, SNAKE_BASE_LIFT, 0)), TILE_EDGE_INSET * 0.8);
    const endPoint = pullPointTowardCenter(baseEnd.clone().add(new THREE.Vector3(0, SNAKE_BASE_LIFT, 0)), TILE_EDGE_INSET * 0.8);
    const length = Math.abs(start - end);
    const archHeight = Math.min(TILE_SIZE * 0.9, SNAKE_ARCH_BASE + length * SNAKE_ARCH_SCALE);
    const peak = startPoint.clone().lerp(endPoint, 0.5).add(new THREE.Vector3(0, archHeight, 0));
    const lateral = new THREE.Vector3(endPoint.z - startPoint.z, 0, -(endPoint.x - startPoint.x));
    if (lateral.lengthSq() < 1e-6) {
      lateral.set(1, 0, 0);
    } else {
      lateral.normalize();
    }
    const lateralAmount = Math.min(TILE_SIZE * 0.18, SNAKE_LATERAL_BASE + length * SNAKE_LATERAL_SCALE);
    const peakLeft = peak.clone().addScaledVector(lateral, lateralAmount);
    const peakRight = peak.clone().addScaledVector(lateral, -lateralAmount);
    const fullCurve = new THREE.CatmullRomCurve3([startPoint, peakLeft, peakRight, endPoint], false, 'centripetal');

    const bodyRadius = TILE_SIZE * 0.075;
    const mainCurve = sampleSubCurve(fullCurve, 0, 0.75, 24);
    const bodyMain = new THREE.Mesh(new THREE.TubeGeometry(mainCurve, 160, bodyRadius, 16, false), matBody.clone());
    const mainLen = startPoint.distanceTo(fullCurve.getPoint(0.75));
    bodyMain.material.map.repeat.set(Math.max(4, Math.ceil(mainLen / (TILE_SIZE * 0.4))), 2);
    group.add(bodyMain);

    group.userData.paths.set(start, {
      curve: fullCurve.clone(),
      start: startPoint.clone(),
      end: endPoint.clone()
    });

    const tailSegments = [
      [0.75, 0.87, bodyRadius * 0.9],
      [0.87, 0.94, bodyRadius * 0.7],
      [0.94, 1.0, bodyRadius * 0.5]
    ];
    tailSegments.forEach(([t0, t1, r]) => {
      const segCurve = sampleSubCurve(fullCurve, t0, t1, 12);
      const seg = new THREE.Mesh(new THREE.TubeGeometry(segCurve, 64, r, 14, false), matBody.clone());
      seg.material.map.repeat.x = Math.max(2, Math.ceil((t1 - t0) * 20));
      group.add(seg);
    });

    const tA = fullCurve.getTangent(0).normalize();
    const tB = fullCurve.getTangent(1).normalize();

    const headGroup = new THREE.Group();
    const headR = bodyRadius * 1.15;
    const headGeom = new THREE.SphereGeometry(headR, 20, 16);
    const head = new THREE.Mesh(headGeom, matHead);
    headGroup.add(head);
    const hood = new THREE.Mesh(new THREE.CylinderGeometry(headR * 0.6, headR * 1.6, headR * 1.9, 20, 1, true), matHead);
    hood.rotation.x = Math.PI / 2;
    hood.position.z = -headR;
    headGroup.add(hood);
    const eyeGeom = new THREE.SphereGeometry(headR * 0.22, 12, 10);
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xffe066,
      emissive: 0x332200,
      roughness: 0.35
    });
    const eyeL = new THREE.Mesh(eyeGeom, eyeMat);
    const eyeR = eyeL.clone();
    eyeL.position.set(-headR * 0.45, headR * 0.33, headR * 0.4);
    eyeR.position.set(headR * 0.45, headR * 0.33, headR * 0.4);
    headGroup.add(eyeL, eyeR);
    const tongue = new THREE.Mesh(new THREE.CylinderGeometry(headR * 0.05, headR * 0.05, headR * 2.1, 8, 1), matTongue);
    tongue.rotation.x = Math.PI / 2;
    tongue.position.z = headR * 1.5;
    headGroup.add(tongue);
    const headPos = startPoint.clone().add(tA.clone().multiplyScalar(headR * 0.6));
    headGroup.position.copy(headPos);
    headGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tA.clone());
    group.add(headGroup);

    const tailTip = new THREE.Mesh(new THREE.ConeGeometry(bodyRadius * 0.58, bodyRadius * 1.8, 12), matTail);
    tailTip.position.copy(endPoint.clone());
    tailTip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tB.clone());
    group.add(tailTip);
  });
}

function sampleSubCurve(curve, t0, t1, samples = 20) {
  const pts = [];
  for (let i = 0; i <= samples; i++) {
    const t = THREE.MathUtils.lerp(t0, t1, i / samples);
    pts.push(curve.getPoint(t));
  }
  return new THREE.CatmullRomCurve3(pts);
}

export default function SnakeBoard3D({
  players = [],
  highlight,
  trail,
  pot,
  snakes,
  ladders,
  snakeOffsets,
  ladderOffsets,
  offsetPopup,
  celebrate,
  tokenType,
  rollingIndex,
  currentTurn,
  burning = [],
  slide,
  onSlideComplete,
  diceEvent,
  onSeatPositionsChange,
  onDiceAnchorChange
}) {
  const mountRef = useRef(null);
  const cameraRef = useRef(null);
  const boardRef = useRef(null);
  const fitRef = useRef(() => {});
  const disposeHandlers = useRef([]);
  const railTextureRef = useRef(null);
  const snakeTextureRef = useRef(null);
  const animationsRef = useRef([]);
  const diceStateRef = useRef({ currentId: null, basePositions: [], baseY: 0, count: 0 });
  const seatCallbackRef = useRef(null);
  const diceAnchorCallbackRef = useRef(null);
  const lastSeatPositionsRef = useRef([]);
  const lastDiceAnchorRef = useRef(null);
  const prevPlayerPositionsRef = useRef([]);
  const cameraRestoreRef = useRef(null);
  const lastFrameTimeRef = useRef(0);

  useEffect(() => {
    seatCallbackRef.current = typeof onSeatPositionsChange === 'function' ? onSeatPositionsChange : null;
    return () => {
      if (!onSeatPositionsChange) return;
      seatCallbackRef.current = null;
    };
  }, [onSeatPositionsChange]);

  useEffect(() => {
    diceAnchorCallbackRef.current = typeof onDiceAnchorChange === 'function' ? onDiceAnchorChange : null;
    return () => {
      if (!onDiceAnchorChange) return;
      diceAnchorCallbackRef.current = null;
    };
  }, [onDiceAnchorChange]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
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
    mount.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#030712');

    const handlers = disposeHandlers.current;
    handlers.length = 0;

    const arena = buildArena(scene, renderer, mount, cameraRef, handlers);
    const board = buildSnakeBoard(
      arena.boardGroup,
      arena.boardLookTarget,
      handlers,
      arena.updateCameraTarget
    );
    boardRef.current = {
      ...board,
      boardLookTarget: arena.boardLookTarget,
      controls: arena.controls,
      seatAnchors: arena.seatAnchors ?? []
    };

    railTextureRef.current = makeRailTexture();
    snakeTextureRef.current = makeSnakeTexture();

    fitRef.current = arena.fit;
    arena.fit();

    lastFrameTimeRef.current = 0;

    renderer.setAnimationLoop((time) => {
      const now = typeof time === 'number' ? time : performance.now();
      const last = lastFrameTimeRef.current || now;
      const deltaSeconds = Math.min(0.2, Math.max(0, (now - last) / 1000));
      lastFrameTimeRef.current = now;
      const active = animationsRef.current;
      for (let i = active.length - 1; i >= 0; i -= 1) {
        const anim = active[i];
        if (!anim || typeof anim.update !== 'function') {
          active.splice(i, 1);
          continue;
        }
        try {
          const done = anim.update(now);
          if (done) active.splice(i, 1);
        } catch (error) {
          console.warn('Snake animation error', error);
          active.splice(i, 1);
        }
      }
      const board = boardRef.current;
      let hasDiceCenter = false;
      if (board?.diceLights && board?.diceSet?.length) {
        DICE_CENTER_VECTOR.set(0, 0, 0);
        let visibleCount = 0;
        board.diceSet.forEach((die) => {
          if (!die.visible) return;
          DICE_CENTER_VECTOR.add(die.position);
          visibleCount += 1;
        });
        if (visibleCount > 0) {
          DICE_CENTER_VECTOR.multiplyScalar(1 / visibleCount);
          hasDiceCenter = true;
          const { accent, fill, target } = board.diceLights;
          if (target) target.position.copy(DICE_CENTER_VECTOR);
          if (accent?.userData?.offset) {
            accent.position.copy(DICE_CENTER_VECTOR).add(accent.userData.offset);
          }
          if (fill?.userData?.offset) {
            fill.position.copy(DICE_CENTER_VECTOR).add(fill.userData.offset);
          }
        }
      }
      arena.controls?.update?.();
      const camera = cameraRef.current;
      if (camera) {
        if (board?.potGroup) {
          board.potGroup.rotation.y += deltaSeconds * COIN_SPIN_SPEED;
        }
        if (board?.seatAnchors?.length && seatCallbackRef.current) {
          const positions = board.seatAnchors.map((anchor, index) => {
            anchor.getWorldPosition(TEMP_SEAT_VECTOR);
            TEMP_NDC_VECTOR.copy(TEMP_SEAT_VECTOR).project(camera);
            const x = clamp((TEMP_NDC_VECTOR.x * 0.5 + 0.5) * 100, -25, 125);
            const y = clamp((0.5 - TEMP_NDC_VECTOR.y * 0.5) * 100, -25, 125);
            const depth = camera.position.distanceTo(TEMP_SEAT_VECTOR);
            return { index, x, y, depth };
          });
          const prev = lastSeatPositionsRef.current;
          let changed = positions.length !== prev.length;
          if (!changed) {
            for (let i = 0; i < positions.length; i += 1) {
              const current = positions[i];
              const before = prev[i];
              if (
                !before ||
                Math.abs(before.x - current.x) > 0.2 ||
                Math.abs(before.y - current.y) > 0.2 ||
                Math.abs((before.depth ?? 0) - current.depth) > 0.02
              ) {
                changed = true;
                break;
              }
            }
          }
          if (changed) {
            const clones = positions.map((p) => ({ ...p }));
            lastSeatPositionsRef.current = clones;
            seatCallbackRef.current?.(clones);
          }
        }
        if (diceAnchorCallbackRef.current) {
          if (hasDiceCenter) {
            TEMP_NDC_VECTOR.copy(DICE_CENTER_VECTOR).project(camera);
            const x = clamp((TEMP_NDC_VECTOR.x * 0.5 + 0.5) * 100, -25, 125);
            const y = clamp((0.5 - TEMP_NDC_VECTOR.y * 0.5) * 100, -25, 125);
            const depth = camera.position.distanceTo(DICE_CENTER_VECTOR);
            const anchor = { x, y, depth };
            const prevAnchor = lastDiceAnchorRef.current;
            if (
              !prevAnchor ||
              Math.abs(prevAnchor.x - anchor.x) > 0.2 ||
              Math.abs(prevAnchor.y - anchor.y) > 0.2 ||
              Math.abs((prevAnchor.depth ?? 0) - depth) > 0.02
            ) {
              lastDiceAnchorRef.current = anchor;
              diceAnchorCallbackRef.current(anchor);
            }
          } else if (lastDiceAnchorRef.current) {
            lastDiceAnchorRef.current = null;
            diceAnchorCallbackRef.current(null);
          }
        }
        renderer.render(scene, camera);
      }
    });

    const resizeObserver = new ResizeObserver(() => arena.fit());
    resizeObserver.observe(mount);

    return () => {
      resizeObserver.disconnect();
      renderer.setAnimationLoop(null);
      handlers.forEach((fn) => fn());
      lastSeatPositionsRef.current = [];
      seatCallbackRef.current?.([]);
      lastDiceAnchorRef.current = null;
      diceAnchorCallbackRef.current?.(null);
      boardRef.current = null;
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
      railTextureRef.current?.dispose?.();
      snakeTextureRef.current?.dispose?.();
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj.isMesh) {
          obj.geometry?.dispose?.();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose?.());
          else obj.material?.dispose?.();
        }
      });
      lastFrameTimeRef.current = 0;
    };
  }, []);

  useEffect(() => {
    if (!boardRef.current) return;
    updateTilesHighlight(boardRef.current.tileMeshes, highlight, trail);
    if (offsetPopup) {
      const tile = boardRef.current.tileMeshes.get(offsetPopup.cell);
      if (tile) {
        const color = offsetPopup.type === 'snake' ? HIGHLIGHT_COLORS.snake : HIGHLIGHT_COLORS.ladder;
        applyTileHighlight(tile, color);
      }
    }
  }, [highlight, trail, offsetPopup]);

  useEffect(() => {
    if (!boardRef.current) return;
    const board = boardRef.current;
    updateTokens(board.tokensGroup, players, board.indexToPosition, board.serpentineIndexToXZ, {
      burning,
      rollingIndex,
      currentTurn,
      boardRoot: board.root,
      seatAnchors: board.seatAnchors,
      baseLevelTop: board.baseLevelTop
    });

    const sanitizedPositions = players.map((player) => {
      const raw = Number(player?.position);
      return Number.isFinite(raw) ? raw : null;
    });
    const previous = prevPlayerPositionsRef.current;
    let movement = null;
    if (Array.isArray(previous) && previous.length === sanitizedPositions.length) {
      const movements = [];
      sanitizedPositions.forEach((pos, index) => {
        const prev = previous[index];
        if (prev == null || pos == null) return;
        if (prev !== pos) movements.push({ index, from: prev, to: pos });
      });
      if (movements.length) {
        movement =
          movements.find((m) => m.index === rollingIndex) ||
          movements.find((m) => m.index === currentTurn) ||
          movements[0];
      }
    }
    prevPlayerPositionsRef.current = sanitizedPositions;

    if (movement && shouldFollowTileChange(movement.from, movement.to)) {
      const camera = cameraRef.current;
      const controls = board.controls;
      const followState = computeTokenFollowCameraState(board, movement.from, movement.to);
      if (camera && controls && followState) {
        removeAnimationsByType(animationsRef.current, 'cameraDiceZoom');
        removeAnimationsByType(animationsRef.current, 'cameraTokenFollow');
        if (!cameraRestoreRef.current) {
          cameraRestoreRef.current = captureCameraState(camera, controls);
        }
        const restoreState = cameraRestoreRef.current;
        const followAnimation = createTokenCameraFollowAnimation(
          camera,
          controls,
          followState,
          restoreState,
          () => {
            if (cameraRestoreRef.current === restoreState) {
              cameraRestoreRef.current = null;
            }
          }
        );
        if (followAnimation) animationsRef.current.push(followAnimation);
      }
    }
  }, [players, burning, rollingIndex, currentTurn, tokenType]);

  useEffect(() => {
    if (!boardRef.current || !railTextureRef.current) return;
    updateLadders(
      boardRef.current.laddersGroup,
      ladders,
      boardRef.current.indexToPosition,
      boardRef.current.serpentineIndexToXZ,
      railTextureRef.current
    );
  }, [ladders, ladderOffsets]);

  useEffect(() => {
    if (!boardRef.current || !snakeTextureRef.current) return;
    updateSnakes(
      boardRef.current.snakesGroup,
      snakes,
      boardRef.current.indexToPosition,
      boardRef.current.serpentineIndexToXZ,
      snakeTextureRef.current
    );
  }, [snakes, snakeOffsets]);

  useEffect(() => {
    if (!slide || !boardRef.current) return;
    const board = boardRef.current;
    const tokensGroup = board.tokensGroup;
    if (!tokensGroup) {
      onSlideComplete?.(slide.id, false);
      return;
    }
    const token = tokensGroup.children.find((child) => child.userData?.playerIndex === slide.playerIndex);
    if (!token) {
      onSlideComplete?.(slide.id, false);
      return;
    }
    const pathMap =
      slide.type === 'ladder'
        ? board.laddersGroup?.userData?.paths
        : board.snakesGroup?.userData?.paths;
    const startBase = (board.indexToPosition.get(slide.from) || board.serpentineIndexToXZ(slide.from)).clone();
    const endBase = (board.indexToPosition.get(slide.to) || board.serpentineIndexToXZ(slide.to)).clone();
    startBase.y = startBase.y ?? tokensGroup.position.y;
    endBase.y = endBase.y ?? tokensGroup.position.y;
    let pathInfo = pathMap?.get(slide.from);
    if (!pathInfo) {
      const fallbackCurve = new THREE.LineCurve3(startBase.clone(), endBase.clone());
      pathInfo = { curve: fallbackCurve, start: startBase.clone(), end: endBase.clone() };
    }
    const curve = pathInfo.curve;
    token.userData.isSliding = true;
    const duration = 1100;
    const startTime = performance.now();
    const lift = TOKEN_HEIGHT * 0.6;
    const camera = cameraRef.current;
    const controls = board.controls;
    const followState = computeTokenFollowCameraState(board, slide.from, slide.to);
    if (camera && controls && followState && shouldFollowTileChange(slide.from, slide.to)) {
      removeAnimationsByType(animationsRef.current, 'cameraDiceZoom');
      removeAnimationsByType(animationsRef.current, 'cameraTokenFollow');
      if (!cameraRestoreRef.current) {
        cameraRestoreRef.current = captureCameraState(camera, controls);
      }
      const restoreState = cameraRestoreRef.current;
      const followAnimation = createTokenCameraFollowAnimation(
        camera,
        controls,
        followState,
        restoreState,
        () => {
          if (cameraRestoreRef.current === restoreState) {
            cameraRestoreRef.current = null;
          }
        }
      );
      if (followAnimation) animationsRef.current.push(followAnimation);
    }
    animationsRef.current.push({
      update: (now) => {
        const t = Math.min((now - startTime) / duration, 1);
        let pos;
        if (t < 0.18) {
          const local = easeInOut(t / 0.18);
          const target = curve.getPoint(0).clone().add(new THREE.Vector3(0, lift, 0));
          pos = startBase.clone().lerp(target, local);
        } else if (t < 0.9) {
          const local = easeInOut((t - 0.18) / 0.72);
          pos = curve.getPoint(local).clone().add(new THREE.Vector3(0, lift * 0.4, 0));
        } else {
          const local = easeOutCubic((t - 0.9) / 0.1);
          const from = curve.getPoint(1).clone().add(new THREE.Vector3(0, lift * 0.25, 0));
          pos = from.lerp(endBase, Math.min(1, local));
        }
        token.position.copy(pos);
        if (t >= 1) {
          token.userData.isSliding = false;
          token.position.copy(endBase);
          onSlideComplete?.(slide.id, true);
          return true;
        }
        return false;
      }
    });
  }, [slide, onSlideComplete]);

  useEffect(() => {
    if (!diceEvent || !boardRef.current) return;
    const board = boardRef.current;
    const diceSet = board.diceSet || [];
    if (!diceSet.length) return;
    const diceBaseY = board.diceBaseY ?? 0;
    const diceAnchorZ = board.diceAnchorZ ?? 0;
    if (diceEvent.phase === 'start') {
      removeAnimationsByType(animationsRef.current, 'cameraDiceZoom');
      removeAnimationsByType(animationsRef.current, 'diceRoll');
      const count = Math.max(1, Math.min(diceEvent.count ?? diceSet.length, diceSet.length));
      const prevState = diceStateRef.current || {};
      const rawSeatIndex = Number.isInteger(diceEvent.seatIndex)
        ? diceEvent.seatIndex
        : Number.isInteger(diceEvent.playerIndex)
        ? diceEvent.playerIndex
        : Number.isInteger(prevState.seatIndex)
        ? prevState.seatIndex
        : Number.isInteger(prevState.lastSeatIndex)
        ? prevState.lastSeatIndex
        : 0;
      const seatCount = Array.isArray(board.seatAnchors) ? board.seatAnchors.length : 0;
      const seatIndex = seatCount > 0 ? Math.max(0, Math.min(seatCount - 1, rawSeatIndex)) : Math.max(0, rawSeatIndex);
      const layout = computeDiceThrowLayout(board, seatIndex, count);
      const spacing = DICE_SIZE * 1.35;
      const centerOffset = (count - 1) / 2;
      const basePositions = [];
      const startPositions = [];
      const travelVectors = [];
      const bouncePoints = [];
      const retreatVectors = [];
      const edgeNormals = [];
      let visibleIndex = 0;
      diceSet.forEach((die, index) => {
        const visible = index < count;
        die.visible = visible;
        if (!visible) return;
        const fallbackBase = new THREE.Vector3((index - centerOffset) * spacing, diceBaseY, diceAnchorZ);
        const base = layout.basePositions?.[visibleIndex] ?? fallbackBase;
        const start = layout.startPositions?.[visibleIndex] ?? base.clone();
        const travel = layout.travelVectors?.[visibleIndex] ?? base.clone().sub(start);
        const bounce = layout.bouncePoints?.[visibleIndex] ?? base.clone();
        const retreat = layout.retreatVectors?.[visibleIndex] ?? base.clone().sub(bounce);
        const normal = layout.edgeNormals?.[visibleIndex]
          ? layout.edgeNormals[visibleIndex].clone()
          : new THREE.Vector3(0, 0, 0);
        die.position.copy(start);
        die.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        basePositions.push(base.clone());
        startPositions.push(start.clone());
        travelVectors.push(travel.clone());
        bouncePoints.push(bounce.clone());
        retreatVectors.push(retreat.clone());
        edgeNormals.push(normal);
        visibleIndex += 1;
      });
      diceStateRef.current = {
        currentId: diceEvent.id,
        basePositions: basePositions.map((vec) => vec.clone()),
        baseY: diceBaseY,
        count,
        seatIndex,
        lastSeatIndex: seatIndex
      };
      const active = diceSet.filter((_, idx) => idx < count);
      if (active.length) {
        const rollAnimation = createDiceRollAnimation(active, {
          basePositions,
          baseY: diceBaseY,
          startPositions,
          travelVectors,
          bouncePoints,
          retreatVectors,
          edgeNormals
        });
        if (rollAnimation) animationsRef.current.push(rollAnimation);
      }
    } else if (diceEvent.phase === 'end') {
      if (diceStateRef.current.currentId !== diceEvent.id) return;
      removeAnimationsByType(animationsRef.current, 'diceRoll');
      const values = diceEvent.values || [];
      const active = diceSet.filter((die) => die.visible);
      if (active.length) {
        const startStates = active.map((die) => ({
          position: die.position.clone(),
          quaternion: die.quaternion.clone()
        }));
        active.forEach((die, index) => {
          const value = values[index] ?? values[values.length - 1] ?? 1;
          die.userData.setValue?.(value, { immediate: false });
        });
        const storedBases = diceStateRef.current.basePositions || [];
        const basePositions =
          storedBases.length >= active.length
            ? storedBases.slice(0, active.length).map((vec) => vec.clone())
            : active.map((die) => die.position.clone());
        const settleAnimation = createDiceSettleAnimation(active, {
          basePositions,
          baseY: diceBaseY,
          startStates
        });
        if (settleAnimation) animationsRef.current.push(settleAnimation);

      }
      const lastSeatIndex = diceStateRef.current.lastSeatIndex;
      diceStateRef.current = {
        currentId: null,
        basePositions: [],
        baseY: diceBaseY,
        count: 0,
        lastSeatIndex
      };
    }
  }, [diceEvent]);

  useEffect(() => {
    const handle = () => fitRef.current();
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);

  return (
    <div className="relative w-full h-full" data-snake-board-root>
      <div ref={mountRef} className="w-full h-full" />
      {celebrate && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-6xl animate-pulse">
          🎉
        </div>
      )}
      {pot != null && (
        <div className="absolute top-4 right-4 bg-slate-900/70 text-slate-100 text-xs px-3 py-2 rounded-xl">
          Pot: {pot}
        </div>
      )}
    </div>
  );
}
