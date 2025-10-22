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

const SNAKE_BOARD_TILES = 10;
const RAW_BOARD_SIZE = 1.125;
const BOARD_SCALE = 2.7 * 0.68 * 0.85; // reduce board footprint by an additional 15%
const BOARD_DISPLAY_SIZE = RAW_BOARD_SIZE * BOARD_SCALE;
const BOARD_RADIUS = BOARD_DISPLAY_SIZE / 2;

const TILE_GAP = 0.015;
const TILE_SIZE = RAW_BOARD_SIZE / SNAKE_BOARD_TILES;
const MAX_DICE = 2;
const DICE_SIZE = TILE_SIZE * 0.45;
const DICE_CORNER_RADIUS = DICE_SIZE * 0.18;
const DICE_PIP_RADIUS = DICE_SIZE * 0.093;
const DICE_PIP_DEPTH = DICE_SIZE * 0.018;
const DICE_PIP_RIM_INNER = DICE_PIP_RADIUS * 0.78;
const DICE_PIP_RIM_OUTER = DICE_PIP_RADIUS * 1.08;
const DICE_PIP_RIM_OFFSET = DICE_SIZE * 0.0048;
const DICE_PIP_SPREAD = DICE_SIZE * 0.3;
const DICE_FACE_INSET = DICE_SIZE * 0.064;
const DICE_ROLL_DURATION = 900;
const DICE_SETTLE_DURATION = 360;
const DICE_BOUNCE_HEIGHT = DICE_SIZE * 0.6;
const DICE_THROW_LANDING_MARGIN = TILE_SIZE * 0.9;
const DICE_THROW_START_EXTRA = TILE_SIZE * 2.35;
const DICE_THROW_HEIGHT = DICE_SIZE * 1.25;
const BOARD_BASE_EXTRA = RAW_BOARD_SIZE * (0.28 / 3.4);
const BOARD_BASE_HEIGHT = RAW_BOARD_SIZE * (0.22 / 3.4);
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

const TOKEN_RADIUS = TILE_SIZE * 0.2;
const TOKEN_HEIGHT = TILE_SIZE * 0.32;
const TILE_LABEL_OFFSET = TILE_SIZE * 0.0004;

const AVATAR_ANCHOR_HEIGHT = SEAT_THICKNESS / 2 + BACK_HEIGHT * 0.85;

const TEMP_SEAT_VECTOR = new THREE.Vector3();
const TEMP_NDC_VECTOR = new THREE.Vector3();
const DICE_CENTER_VECTOR = new THREE.Vector3();

const DEFAULT_COLORS = ['#f97316', '#22d3ee', '#22c55e', '#a855f7'];

function adjustHexColor(hex, amount) {
  const base = new THREE.Color(hex);
  const target = amount >= 0 ? new THREE.Color(0xffffff) : new THREE.Color(0x000000);
  base.lerp(target, Math.min(Math.abs(amount), 1));
  return `#${base.getHexString()}`;
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

function setDiceOrientation(dice, val) {
  const orientations = {
    1: new THREE.Euler(0, 0, 0),
    2: new THREE.Euler(-Math.PI / 2, 0, 0),
    3: new THREE.Euler(0, 0, -Math.PI / 2),
    4: new THREE.Euler(0, 0, Math.PI / 2),
    5: new THREE.Euler(Math.PI / 2, 0, 0),
    6: new THREE.Euler(Math.PI, 0, 0)
  };
  const euler = orientations[val] || orientations[1];
  const q = new THREE.Quaternion().setFromEuler(euler);
  dice.setRotationFromQuaternion(q);
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

  dice.userData.setValue = (val) => {
    dice.userData.currentValue = val;
    setDiceOrientation(dice, val);
  };
  dice.userData.currentValue = 1;
  return dice;
}

function computeDiceThrowLayout(board, seatIndex, count) {
  const result = { basePositions: [], startPositions: [], travelVectors: [] };
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

  const lateral = new THREE.Vector3(-direction.z, 0, direction.x);
  if (lateral.lengthSq() < 1e-6) lateral.set(1, 0, 0);
  lateral.normalize();

  const boardHalf = (SNAKE_BOARD_TILES * TILE_SIZE) / 2;
  const landingDistance = boardHalf + DICE_THROW_LANDING_MARGIN;
  const startDistance = boardHalf + DICE_THROW_START_EXTRA;

  const landingCenter = centerLocal.clone().addScaledVector(direction, -landingDistance);
  landingCenter.y = diceBaseY;
  const startCenter = centerLocal.clone().addScaledVector(direction, -startDistance);
  startCenter.y = diceBaseY + DICE_THROW_HEIGHT;

  const spacing = DICE_SIZE * 1.35;
  const centerOffset = (count - 1) / 2;

  for (let i = 0; i < count; i += 1) {
    const offset = (i - centerOffset) * spacing;
    const base = landingCenter.clone().addScaledVector(lateral, offset);
    const start = startCenter.clone().addScaledVector(lateral, offset * 0.92);

    const jitterForward = (Math.random() - 0.5) * DICE_SIZE * 0.45;
    const jitterSide = (Math.random() - 0.5) * DICE_SIZE * 0.35;

    base.addScaledVector(direction, -jitterForward * 0.25);
    base.addScaledVector(lateral, jitterSide * 0.15);
    start.addScaledVector(direction, -Math.abs(jitterForward) * 0.25);
    start.addScaledVector(lateral, jitterSide);

    result.basePositions.push(base);
    result.startPositions.push(start);
    result.travelVectors.push(base.clone().sub(start));
  }

  result.direction = direction;
  result.lateral = lateral;
  result.seatIndex = seatIndex;
  return result;
}

function createDiceRollAnimation(
  diceArray,
  { basePositions, baseY, startPositions = [], travelVectors = [] }
) {
  const start = performance.now();
  const spinSpeeds = diceArray.map(() => 0.18 + Math.random() * 0.12);
  const yawSpeeds = diceArray.map(() => (Math.random() - 0.5) * 0.1);
  const swayOffsets = diceArray.map(() => Math.random() * Math.PI * 2);
  const rollAxes = diceArray.map((_, index) => {
    const travel = travelVectors[index];
    if (travel && travel.lengthSq() > 1e-6) {
      const axis = new THREE.Vector3(travel.z, 0, -travel.x);
      if (axis.lengthSq() > 1e-6) return axis.normalize();
    }
    return new THREE.Vector3(Math.random() * 0.6 + 0.2, Math.random() * 0.3 + 0.1, Math.random() * 0.6 + 0.2).normalize();
  });
  const lateralVectors = diceArray.map((_, index) => {
    const travel = travelVectors[index];
    if (travel && travel.lengthSq() > 1e-6) {
      const lateral = new THREE.Vector3(-travel.z, 0, travel.x);
      if (lateral.lengthSq() > 1e-6) return lateral.normalize();
    }
    return null;
  });

  return {
    update: (now) => {
      const t = Math.min((now - start) / DICE_ROLL_DURATION, 1);
      const travelEase = easeOutCubic(t);
      const bounce = Math.sin(Math.min(1, t * 1.45) * Math.PI) * DICE_BOUNCE_HEIGHT;
      diceArray.forEach((die, index) => {
        const base = basePositions[index];
        if (!base) return;
        const origin = startPositions[index] ?? base;
        const travel = travelVectors[index];
        die.position.copy(origin);
        if (travel && travel.lengthSq() > 1e-6) {
          die.position.addScaledVector(travel, travelEase);
        }
        const lateral = lateralVectors[index];
        if (lateral) {
          const sway = Math.sin(t * Math.PI * 2.2 + swayOffsets[index]) * DICE_SIZE * 0.18 * (1 - travelEase * 0.35);
          die.position.addScaledVector(lateral, sway);
        }
        die.position.y = baseY + bounce;
        die.rotateOnAxis(rollAxes[index], spinSpeeds[index]);
        die.rotateOnWorldAxis(WORLD_UP, yawSpeeds[index]);
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

function createDiceSettleAnimation(diceArray, { basePositions, baseY }) {
  const start = performance.now();
  return {
    update: (now) => {
      const t = Math.min((now - start) / DICE_SETTLE_DURATION, 1);
      const ease = easeOutCubic(t);
      diceArray.forEach((die, index) => {
        const base = basePositions[index];
        if (!base) return;
        const wobble = Math.sin((1 - ease) * Math.PI) * (DICE_BOUNCE_HEIGHT * 0.18);
        die.position.set(base.x, baseY + wobble, base.z);
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
  texture.anisotropy = 4;
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

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(
      RAW_BOARD_SIZE + BOARD_BASE_EXTRA,
      BOARD_BASE_HEIGHT,
      RAW_BOARD_SIZE + BOARD_BASE_EXTRA
    ),
    new THREE.MeshStandardMaterial({
      color: 0x11172a,
      roughness: 0.9,
      metalness: 0.05
    })
  );
  base.position.y = BOARD_BASE_HEIGHT / 2 - 0.01;
  boardRoot.add(base);

  const tileGroup = new THREE.Group();
  tileGroup.position.y = BOARD_BASE_HEIGHT - 0.02;
  boardRoot.add(tileGroup);

  const tileMeshes = new Map();
  const indexToPosition = new Map();
  const tileHeight = TILE_SIZE * 0.024;
  const tileGeo = new THREE.BoxGeometry(
    TILE_SIZE - TILE_GAP,
    tileHeight,
    TILE_SIZE - TILE_GAP
  );

  const labelGroup = new THREE.Group();
  labelGroup.position.y = tileGroup.position.y + tileHeight + TILE_LABEL_OFFSET;
  boardRoot.add(labelGroup);

  const half = (SNAKE_BOARD_TILES * TILE_SIZE) / 2;

  const mats = {
    even: new THREE.MeshStandardMaterial({
      color: TILE_COLOR_A,
      roughness: 0.8,
      metalness: 0.05
    }),
    odd: new THREE.MeshStandardMaterial({
      color: TILE_COLOR_B,
      roughness: 0.8,
      metalness: 0.05
    })
  };

  const serpentineIndexToXZ = (index) => {
    if (index < 1) {
      return new THREE.Vector3(-half - TILE_SIZE * 0.8, 0, -half - TILE_SIZE * 0.6);
    }
    const n = Math.min(index, SNAKE_BOARD_TILES * SNAKE_BOARD_TILES);
    const r = Math.floor((n - 1) / SNAKE_BOARD_TILES);
    const rr = SNAKE_BOARD_TILES - 1 - r;
    const inRow = (n - 1) % SNAKE_BOARD_TILES;
    const c = r % 2 === 0 ? inRow : SNAKE_BOARD_TILES - 1 - inRow;
    const x = -half + (c + 0.5) * TILE_SIZE;
    const z = -half + (rr + 0.5) * TILE_SIZE;
    return new THREE.Vector3(x, 0, z);
  };

  for (let r = 0; r < SNAKE_BOARD_TILES; r++) {
    for (let c = 0; c < SNAKE_BOARD_TILES; c++) {
      const idx = r * SNAKE_BOARD_TILES + c + 1;
      const mat = (r + c) % 2 === 0 ? mats.even.clone() : mats.odd.clone();
      const tile = new THREE.Mesh(tileGeo, mat);
      const pos = serpentineIndexToXZ(idx);
      tile.position.set(pos.x, tileGroup.position.y + tileHeight / 2, pos.z);
      tile.userData.index = idx;
      tile.userData.baseColor = tile.material.color.clone();
      tile.material.emissive = new THREE.Color(0x000000);
      tile.material.emissiveIntensity = 1.0;
      tileGroup.add(tile);
      tileMeshes.set(idx, tile);
      indexToPosition.set(idx, pos.clone().setY(tile.position.y + tileHeight / 2));

      const label = createTileLabel(idx);
      label.position.set(pos.x, labelGroup.position.y, pos.z);
      labelGroup.add(label);
    }
  }

  const laddersGroup = new THREE.Group();
  laddersGroup.position.y = tileGroup.position.y + tileHeight / 2;
  boardRoot.add(laddersGroup);

  const snakesGroup = new THREE.Group();
  snakesGroup.position.y = tileGroup.position.y + tileHeight / 2;
  boardRoot.add(snakesGroup);

  const tokensGroup = new THREE.Group();
  tokensGroup.position.y = tileGroup.position.y + tileHeight;
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
  potGroup.add(coin);
  const potPos = serpentineIndexToXZ(SNAKE_BOARD_TILES * SNAKE_BOARD_TILES);
  potGroup.position.set(potPos.x, tileGroup.position.y + tileHeight + TILE_SIZE * 0.1, potPos.z);
  boardRoot.add(potGroup);

  const diceGroup = new THREE.Group();
  const diceBaseY = tileGroup.position.y + tileHeight + DICE_SIZE * 0.5 + TILE_SIZE * 0.02;
  const diceAnchorZ = -half + TILE_SIZE * 1.25;
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
    diceLights: {
      accent: diceAccent,
      fill: diceFill,
      target: diceLightTarget
    }
  };
}

function updateTilesHighlight(tileMeshes, highlight, trail) {
  tileMeshes.forEach((tile) => {
    tile.material.color.copy(tile.userData.baseColor);
    tile.material.emissive.setRGB(0, 0, 0);
  });
  if (trail?.length) {
    trail.forEach((segment) => {
      const tile = tileMeshes.get(segment.cell);
      if (!tile) return;
      const color = HIGHLIGHT_COLORS[segment.type] ?? HIGHLIGHT_COLORS.normal;
      tile.material.emissive.copy(color).multiplyScalar(0.35);
    });
  }
  if (highlight) {
    const tile = tileMeshes.get(highlight.cell);
    if (tile) {
      const color = HIGHLIGHT_COLORS[highlight.type] ?? HIGHLIGHT_COLORS.normal;
      tile.material.emissive.copy(color);
    }
  }
}

function updateTokens(
  tokensGroup,
  players,
  indexToPosition,
  serpentineIndexToXZ,
  { burning = [], rollingIndex = null, currentTurn = null } = {}
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
    const key = player.position || 0;
    if (!occupancy.has(key)) occupancy.set(key, []);
    occupancy.get(key).push(index);
  });

  const keep = new Set();

  players.forEach((player, index) => {
    keep.add(index);
    let token = existing.get(index);
    if (!token) {
      token = new THREE.Group();
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(player.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]),
        roughness: 0.4,
        metalness: 0.2
      });
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(TOKEN_RADIUS * 1.1, TOKEN_RADIUS * 1.2, TOKEN_HEIGHT * 0.65, 24),
        material
      );
      base.position.y = TOKEN_HEIGHT * 0.32;
      token.add(base);
      const head = new THREE.Mesh(new THREE.SphereGeometry(TOKEN_RADIUS * 0.9, 18, 14), material);
      head.position.y = TOKEN_HEIGHT * 0.95;
      token.add(head);
      token.userData = { playerIndex: index, material, isSliding: false };
      tokensGroup.add(token);
    }
    const mat = token.userData.material;
    const targetColor = new THREE.Color(player.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]);
    mat.color.copy(targetColor);
    if (burning.includes(index)) {
      mat.emissive.setHex(0x7f1d1d);
    } else if (index === rollingIndex) {
      mat.emissive.setHex(0x0ea5e9);
    } else if (index === currentTurn) {
      mat.emissive.setHex(0x1d4ed8);
    } else {
      mat.emissive.setHex(0x000000);
    }

    const positionIndex = player.position;
    const tilePlayers = occupancy.get(positionIndex || 0) || [];
    const offsetIndex = tilePlayers.indexOf(index);
    const radius = TOKEN_RADIUS * 1.2;
    const angle = (offsetIndex / Math.max(1, tilePlayers.length)) * Math.PI * 2;
    const offsetX = Math.cos(angle) * radius;
    const offsetZ = Math.sin(angle) * radius;

    const basePos = indexToPosition.get(positionIndex);
    const worldPos = basePos
      ? basePos.clone()
      : serpentineIndexToXZ(positionIndex).clone().setY(tokensGroup.position.y);
    if (!token.userData.isSliding) {
      worldPos.x += offsetX;
      worldPos.z += offsetZ;
      worldPos.y += TOKEN_HEIGHT * 0.02;
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
      const right = new THREE.Vector3().crossVectors(dir.clone().normalize(), up).normalize();
      const railOffset = TILE_SIZE * 0.18;

      const railCurveA = new THREE.LineCurve3(
        A.clone().add(right.clone().multiplyScalar(-railOffset)),
        B.clone().add(right.clone().multiplyScalar(-railOffset))
      );
      const railCurveB = new THREE.LineCurve3(
        A.clone().add(right.clone().multiplyScalar(railOffset)),
        B.clone().add(right.clone().multiplyScalar(railOffset))
      );
      const railGeomA = new THREE.TubeGeometry(railCurveA, 1, TILE_SIZE * 0.05, 12, false);
      const railGeomB = new THREE.TubeGeometry(railCurveB, 1, TILE_SIZE * 0.05, 12, false);
      const railA = new THREE.Mesh(railGeomA, matRail.clone());
      const railB = new THREE.Mesh(railGeomB, matRail.clone());
      const repeat = Math.max(3, len / (TILE_SIZE * 0.5));
      railA.material.map.repeat.x = repeat;
      railB.material.map.repeat.x = repeat;
      group.add(railA, railB);

      const rungStep = TILE_SIZE * 0.55;
      const rungCount = Math.max(3, Math.floor(len / rungStep));
      for (let i = 1; i < rungCount; i++) {
        const t = i / rungCount;
        const pMid = A.clone().lerp(B, t);
        const rungGeom = new THREE.CylinderGeometry(TILE_SIZE * 0.04, TILE_SIZE * 0.04, railOffset * 2, 12);
        const rung = new THREE.Mesh(rungGeom, matRung);
        rung.position.copy(pMid);
        rung.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), right.clone());
        group.add(rung);
      }

      const ladderCurve = new THREE.LineCurve3(
        A.clone().add(new THREE.Vector3(0, TILE_SIZE * 0.1, 0)),
        B.clone().add(new THREE.Vector3(0, TILE_SIZE * 0.1, 0))
      );
      group.userData.paths.set(start, {
        curve: ladderCurve,
        start: A.clone(),
        end: B.clone()
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
    const A = (indexToPosition.get(start) || serpentineIndexToXZ(start)).clone();
    const B = (indexToPosition.get(end) || serpentineIndexToXZ(end)).clone();
    const length = Math.abs(start - end);
    const mid = A.clone().lerp(B, 0.5);
    mid.y += TILE_SIZE * 0.8 + length * 0.01;
    const side = new THREE.Vector3(B.z - A.z, 0, -(B.x - A.x))
      .normalize()
      .multiplyScalar(TILE_SIZE * 0.3);
    const p0 = A.clone();
    const p1 = mid.add(side);
    const p2 = B.clone();
    const fullCurve = new THREE.CatmullRomCurve3([p0, p1, p2]);

    const bodyRadius = TILE_SIZE * 0.08;
    const mainCurve = sampleSubCurve(fullCurve, 0, 0.75, 24);
    const bodyMain = new THREE.Mesh(new THREE.TubeGeometry(mainCurve, 160, bodyRadius, 16, false), matBody.clone());
    const mainLen = A.distanceTo(fullCurve.getPoint(0.75));
    bodyMain.material.map.repeat.set(Math.max(4, Math.ceil(mainLen / (TILE_SIZE * 0.4))), 2);
    group.add(bodyMain);

    group.userData.paths.set(start, {
      curve: fullCurve.clone(),
      start: A.clone(),
      end: B.clone()
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
    const headPos = A.clone().add(tA.clone().multiplyScalar(headR * 0.8));
    headGroup.position.copy(headPos);
    headGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tA.clone());
    group.add(headGroup);

    const tailTip = new THREE.Mesh(new THREE.ConeGeometry(bodyRadius * 0.58, bodyRadius * 1.8, 12), matTail);
    tailTip.position.copy(B.clone());
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

    renderer.setAnimationLoop((time) => {
      const now = typeof time === 'number' ? time : performance.now();
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
    };
  }, []);

  useEffect(() => {
    if (!boardRef.current) return;
    updateTilesHighlight(boardRef.current.tileMeshes, highlight, trail);
    if (offsetPopup) {
      const tile = boardRef.current.tileMeshes.get(offsetPopup.cell);
      if (tile) {
        const color = offsetPopup.type === 'snake' ? HIGHLIGHT_COLORS.snake : HIGHLIGHT_COLORS.ladder;
        tile.material.emissive.copy(color);
      }
    }
  }, [highlight, trail, offsetPopup]);

  useEffect(() => {
    if (!boardRef.current) return;
    updateTokens(
      boardRef.current.tokensGroup,
      players,
      boardRef.current.indexToPosition,
      boardRef.current.serpentineIndexToXZ,
      { burning, rollingIndex, currentTurn }
    );
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
      let visibleIndex = 0;
      diceSet.forEach((die, index) => {
        const visible = index < count;
        die.visible = visible;
        if (!visible) return;
        const fallbackBase = new THREE.Vector3((index - centerOffset) * spacing, diceBaseY, diceAnchorZ);
        const base = layout.basePositions?.[visibleIndex] ?? fallbackBase;
        const start = layout.startPositions?.[visibleIndex] ?? base.clone();
        const travel = layout.travelVectors?.[visibleIndex] ?? base.clone().sub(start);
        die.position.copy(start);
        die.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        basePositions.push(base.clone());
        startPositions.push(start.clone());
        travelVectors.push(travel.clone());
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
        animationsRef.current.push(
          createDiceRollAnimation(active, {
            basePositions,
            baseY: diceBaseY,
            startPositions,
            travelVectors
          })
        );
      }
    } else if (diceEvent.phase === 'end') {
      if (diceStateRef.current.currentId !== diceEvent.id) return;
      const values = diceEvent.values || [];
      const active = diceSet.filter((die) => die.visible);
      if (active.length) {
        active.forEach((die, index) => {
          const value = values[index] ?? values[values.length - 1] ?? 1;
          die.userData.setValue?.(value);
        });
        const storedBases = diceStateRef.current.basePositions || [];
        const basePositions =
          storedBases.length >= active.length
            ? storedBases.slice(0, active.length).map((vec) => vec.clone())
            : active.map((die) => die.position.clone());
        animationsRef.current.push(
          createDiceSettleAnimation(active, {
            basePositions,
            baseY: diceBaseY
          })
        );
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
