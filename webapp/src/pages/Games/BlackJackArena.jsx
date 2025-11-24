import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

import { createArenaCarpetMaterial, createArenaWallMaterial } from '../../utils/arenaDecor.js';
import { applyRendererSRGB, applySRGBColorSpace } from '../../utils/colorSpace.js';
import { ARENA_CAMERA_DEFAULTS, buildArenaCameraConfig } from '../../utils/arenaCameraConfig.js';
import { createMurlanStyleTable, applyTableMaterials, TABLE_SHAPE_OPTIONS } from '../../utils/murlanTable.js';
import { createCardGeometry, createCardMesh, orientCard, setCardFace, CARD_THEMES } from '../../utils/cards3d.js';
import { createChipFactory } from '../../utils/chips3d.js';
import { FLAG_EMOJIS } from '../../utils/flagEmojis.js';
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
import {
  createDeck,
  shuffle,
  dealInitial,
  hitCard,
  handValue,
  isBust,
  aiAction
} from '../../utils/blackjackLogic.js';

const MODEL_SCALE = 0.75;
const ARENA_GROWTH = 1.45;
const TABLE_RADIUS = 3.4 * MODEL_SCALE;
const BASE_TABLE_HEIGHT = 1.08 * MODEL_SCALE;
const ARENA_SCALE = 1.3 * ARENA_GROWTH;
const BOARD_SIZE = (TABLE_RADIUS * 2 + 1.2 * MODEL_SCALE) * ARENA_SCALE;
const STOOL_SCALE = 1.5 * 1.3;
const CARD_SCALE = 0.95;
const CARD_W = 0.4 * MODEL_SCALE * CARD_SCALE;
const CARD_H = 0.56 * MODEL_SCALE * CARD_SCALE;
const CARD_D = 0.02 * MODEL_SCALE * CARD_SCALE;
const CARD_SURFACE_OFFSET = CARD_D * 4;
const SEAT_WIDTH = 0.9 * MODEL_SCALE * STOOL_SCALE;
const SEAT_DEPTH = 0.95 * MODEL_SCALE * STOOL_SCALE;
const SEAT_THICKNESS = 0.09 * MODEL_SCALE * STOOL_SCALE;
const BACK_HEIGHT = 0.68 * MODEL_SCALE * STOOL_SCALE;
const BACK_THICKNESS = 0.08 * MODEL_SCALE * STOOL_SCALE;
const ARM_THICKNESS = 0.125 * MODEL_SCALE * STOOL_SCALE;
const ARM_HEIGHT = 0.3 * MODEL_SCALE * STOOL_SCALE;
const ARM_DEPTH = SEAT_DEPTH * 0.75;
const BASE_COLUMN_HEIGHT = 0.5 * MODEL_SCALE * STOOL_SCALE;
const BASE_HUMAN_CHAIR_RADIUS = 5.6 * MODEL_SCALE * ARENA_GROWTH * 0.85;
const HUMAN_CHAIR_PULLBACK = 0.32 * MODEL_SCALE;
const CHAIR_RADIUS = BASE_HUMAN_CHAIR_RADIUS + HUMAN_CHAIR_PULLBACK;
const CHAIR_BASE_HEIGHT = BASE_TABLE_HEIGHT - SEAT_THICKNESS * 0.85;
const STOOL_HEIGHT = CHAIR_BASE_HEIGHT + SEAT_THICKNESS;
const TABLE_HEIGHT_LIFT = 0.05 * MODEL_SCALE;
const TABLE_HEIGHT = STOOL_HEIGHT + TABLE_HEIGHT_LIFT;
const TABLE_HEIGHT_RAISE = TABLE_HEIGHT - BASE_TABLE_HEIGHT;
const AI_CHAIR_GAP = CARD_W * 0.4;
const AI_CHAIR_RADIUS = TABLE_RADIUS + SEAT_DEPTH / 2 + AI_CHAIR_GAP;
const DIAMOND_SHAPE_ID = 'diamondEdge';
const HOLE_SPACING = CARD_W * 0.65;
const DEALER_INDEX = 3;
const DEFAULT_PLAYER_COUNT = 6;
const MIN_PLAYER_COUNT = DEALER_INDEX + 1;
const MAX_PLAYER_COUNT = DEFAULT_PLAYER_COUNT;
const CAMERA_SETTINGS = buildArenaCameraConfig(BOARD_SIZE);
const CAMERA_TARGET_LIFT = 0.04 * MODEL_SCALE;
const CAMERA_FOCUS_CENTER_LIFT = -0.16 * MODEL_SCALE;
const CAMERA_HEAD_TURN_LIMIT = THREE.MathUtils.degToRad(175);
const CAMERA_HEAD_PITCH_UP = THREE.MathUtils.degToRad(8);
const CAMERA_HEAD_PITCH_DOWN = THREE.MathUtils.degToRad(52);
const HEAD_YAW_SENSITIVITY = 0.0042;
const HEAD_PITCH_SENSITIVITY = 0;
const CAMERA_LATERAL_OFFSETS = Object.freeze({ portrait: -0.08, landscape: 0.5 });
const CAMERA_RETREAT_OFFSETS = Object.freeze({ portrait: 1.7, landscape: 1.16 });
const CAMERA_ELEVATION_OFFSETS = Object.freeze({ portrait: 1.6, landscape: 1.18 });
const PORTRAIT_CAMERA_PLAYER_FOCUS_BLEND = 0.48;
const PORTRAIT_CAMERA_PLAYER_FOCUS_FORWARD_PULL = CARD_W * 0.02;
const PORTRAIT_CAMERA_PLAYER_FOCUS_HEIGHT = CARD_SURFACE_OFFSET * 0.64;
const HUMAN_CARD_INWARD_SHIFT = CARD_W * -0.68;
const HUMAN_CHIP_INWARD_SHIFT = CARD_W * -0.92;
const HUMAN_CARD_LATERAL_SHIFT = CARD_W * 0.82;
const HUMAN_CHIP_LATERAL_SHIFT = CARD_W * 1.12;
const HUMAN_CARD_CHIP_BLEND = 0.08;
const HUMAN_CARD_FORWARD_OFFSET = CARD_W * 0.04;
const HUMAN_CARD_VERTICAL_OFFSET = CARD_H * 0.52;
const HUMAN_CARD_LOOK_LIFT = CARD_H * 0.24;
const HUMAN_CARD_LOOK_SPLAY = HOLE_SPACING * 0.45;
const CARD_FORWARD_OFFSET = HUMAN_CARD_FORWARD_OFFSET;
const CARD_VERTICAL_OFFSET = HUMAN_CARD_VERTICAL_OFFSET;
const CARD_LOOK_LIFT = HUMAN_CARD_LOOK_LIFT;
const CARD_LOOK_SPLAY = HUMAN_CARD_LOOK_SPLAY;
const BET_FORWARD_OFFSET = CARD_W * -0.2;
const POT_OFFSET = new THREE.Vector3(0, TABLE_HEIGHT + CARD_SURFACE_OFFSET, 0);
const DECK_POSITION = new THREE.Vector3(-TABLE_RADIUS * 0.55, TABLE_HEIGHT + CARD_SURFACE_OFFSET, TABLE_RADIUS * 0.55);
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const CHIP_VALUES = [1000, 500, 100, 50, 20, 10, 5, 2, 1];

const CHAIR_COLOR_OPTIONS = Object.freeze([
  {
    id: 'crimsonVelvet',
    label: 'Kadife e Kuqe',
    primary: '#8b1538',
    accent: '#5c0f26',
    highlight: '#d35a7a',
    legColor: '#1f1f1f'
  },
  {
    id: 'midnightNavy',
    label: 'Blu Mesnate',
    primary: '#153a8b',
    accent: '#0c214f',
    highlight: '#4d74d8',
    legColor: '#10131c'
  },
  {
    id: 'emeraldWave',
    label: 'Valë Smerald',
    primary: '#0f6a2f',
    accent: '#063d1b',
    highlight: '#48b26a',
    legColor: '#142318'
  },
  {
    id: 'onyxShadow',
    label: 'Hije Oniks',
    primary: '#202020',
    accent: '#101010',
    highlight: '#6f6f6f',
    legColor: '#080808'
  },
  {
    id: 'goldenHour',
    label: 'Ar Pasdite',
    primary: '#8b5a1a',
    accent: '#4a2f0b',
    highlight: '#d8a85f',
    legColor: '#2a1a09'
  }
]);

const DEFAULT_STOOL_THEME = Object.freeze({ legColor: '#1f1f1f' });
const LABEL_SIZE = Object.freeze({ width: 1.24 * MODEL_SCALE, height: 0.58 * MODEL_SCALE });
const LABEL_BASE_HEIGHT = SEAT_THICKNESS + 0.24 * MODEL_SCALE;
const HUMAN_LABEL_FORWARD = SEAT_DEPTH * 0.12;
const AI_LABEL_FORWARD = SEAT_DEPTH * 0.16;
const RAIL_ANCHOR_RATIO = 0.98;
const RAIL_FORWARD_MARGIN = TABLE_RADIUS * (1 - RAIL_ANCHOR_RATIO);
const RAIL_SURFACE_FORWARD_SHIFT = RAIL_FORWARD_MARGIN * 0.65;
const CARD_RAIL_FORWARD_SHIFT = -RAIL_SURFACE_FORWARD_SHIFT * 1.18;
const CHIP_RAIL_FORWARD_SHIFT = -RAIL_SURFACE_FORWARD_SHIFT * 1.35;
const CARD_RAIL_LATERAL_SHIFT = CARD_W * 0.88;
const CHIP_RAIL_LATERAL_SHIFT = CARD_W * 0.66;

const RAIL_FORWARD_MARGIN_RATIO = RAIL_FORWARD_MARGIN / TABLE_RADIUS;
const CARD_RAIL_FORWARD_SHIFT_RATIO = CARD_RAIL_FORWARD_SHIFT / RAIL_FORWARD_MARGIN;
const CHIP_RAIL_FORWARD_SHIFT_RATIO = CHIP_RAIL_FORWARD_SHIFT / RAIL_FORWARD_MARGIN;
const HUMAN_SEAT_RADIUS_OFFSET = CHAIR_RADIUS - TABLE_RADIUS;
const AI_SEAT_RADIUS_OFFSET = AI_CHAIR_RADIUS - TABLE_RADIUS;
const BET_DISTANCE_RATIO = 0.6;

const RAIL_CHIP_SCALE = 1.08;
const RAIL_CHIP_SPACING = CARD_W * 0.5;
const RAIL_HEIGHT_OFFSET = CARD_D * 6.2;
const RAIL_SURFACE_LIFT = CARD_D * 0.5;
const RAIL_CHIP_ROW_SPACING = CARD_H * 0.36;

const CHIP_SCATTER_LAYOUT = Object.freeze({
  perRow: 5,
  spacing: CARD_W * 0.56,
  rowSpacing: CARD_W * 0.44,
  jitter: CARD_W * 0.1,
  lift: 0
});

const POT_SCATTER_LAYOUT = Object.freeze({
  perRow: 6,
  spacing: CARD_W * 0.58,
  rowSpacing: CARD_W * 0.46,
  jitter: CARD_W * 0.14,
  lift: 0
});

const CAMERA_PLAYER_FOCUS_BLEND = 0.68;
const CAMERA_PLAYER_FOCUS_DROP = CARD_H * 0.26;
const CAMERA_PLAYER_FOCUS_HEIGHT = CARD_SURFACE_OFFSET * 0.42;
const CAMERA_PLAYER_FOCUS_FORWARD_PULL = CARD_W * 0.12;
const CAMERA_WALL_MARGIN = THREE.MathUtils.degToRad(2.5);
const CAMERA_WALL_HEIGHT_MARGIN = 0.1 * MODEL_SCALE;
const CAMERA_TURN_FOCUS_LIFT = 0.6 * MODEL_SCALE;

const CHAIR_CLOTH_TEXTURE_SIZE = 512;
const CHAIR_CLOTH_REPEAT = 7;
const ARENA_WALL_HEIGHT = 3.6 * 1.3;
const ARENA_WALL_CENTER_Y = ARENA_WALL_HEIGHT / 2;
const ARENA_WALL_TOP_Y = ARENA_WALL_CENTER_Y + ARENA_WALL_HEIGHT / 2;
const ARENA_WALL_INNER_RADIUS = TABLE_RADIUS * ARENA_GROWTH * 2.4;
const DEFAULT_PITCH_LIMITS = Object.freeze({ min: -CAMERA_HEAD_PITCH_UP, max: CAMERA_HEAD_PITCH_DOWN });
const HUMAN_SEAT_ROTATION_OFFSET = Math.PI / 8;

const APPEARANCE_STORAGE_KEY = 'blackjackArenaAppearance';
const DEFAULT_APPEARANCE = {
  ...DEFAULT_TABLE_CUSTOMIZATION,
  chairColor: 0,
  tableShape: 0,
  cards: 0
};

const CUSTOMIZATION_SECTIONS = [
  { key: 'tableWood', label: 'Dru i Tavolinës', options: TABLE_WOOD_OPTIONS },
  { key: 'tableCloth', label: 'Rroba e Tavolinës', options: TABLE_CLOTH_OPTIONS },
  { key: 'chairColor', label: 'Ngjyra e Karrigeve', options: CHAIR_COLOR_OPTIONS },
  { key: 'tableShape', label: 'Forma e Tavolinës', options: TABLE_SHAPE_OPTIONS },
  { key: 'cards', label: 'Letrat', options: CARD_THEMES }
];

const NON_DIAMOND_SHAPE_INDEX = (() => {
  const index = TABLE_SHAPE_OPTIONS.findIndex((option) => option.id !== DIAMOND_SHAPE_ID);
  return index >= 0 ? index : 0;
})();

const REGION_NAMES = typeof Intl !== 'undefined' ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;

function flagToName(flag) {
  if (!flag || !REGION_NAMES) return 'Guest';
  const codes = Array.from(flag, (c) => c.codePointAt(0) - 0x1f1e6 + 65);
  if (codes.length !== 2) return 'Guest';
  const code = String.fromCharCode(codes[0], codes[1]);
  return REGION_NAMES.of(code) || 'Guest';
}

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
  canvas.width = canvas.height = CHAIR_CLOTH_TEXTURE_SIZE;
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

  const spacing = canvas.width / CHAIR_CLOTH_REPEAT;
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

  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  const tuftRadius = Math.max(1.8, spacing * 0.08);
  for (let y = -spacing; y <= canvas.height + spacing; y += spacing) {
    for (let x = -spacing; x <= canvas.width + spacing; x += spacing) {
      ctx.beginPath();
      ctx.ellipse(x + halfSpacing, y + halfSpacing, tuftRadius, tuftRadius * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  const sheenGradient = ctx.createRadialGradient(
    canvas.width * 0.28,
    canvas.height * 0.32,
    canvas.width * 0.05,
    canvas.width * 0.28,
    canvas.height * 0.32,
    canvas.width * 0.75
  );
  sheenGradient.addColorStop(0, 'rgba(255, 255, 255, 0.26)');
  sheenGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.08)');
  sheenGradient.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
  ctx.fillStyle = sheenGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  ctx.globalAlpha = 0.08;
  for (let y = 0; y < canvas.height; y += 2) {
    for (let x = 0; x < canvas.width; x += 2) {
      ctx.fillStyle = Math.random() > 0.5 ? highlight : shadow;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(CHAIR_CLOTH_REPEAT, CHAIR_CLOTH_REPEAT);
  texture.anisotropy = renderer?.capabilities?.getMaxAnisotropy?.() ?? 8;
  applySRGBColorSpace(texture);
  texture.needsUpdate = true;
  return texture;
}

function createChairFabricMaterial(chairOption, renderer) {
  const texture = createChairClothTexture(chairOption, renderer);
  const primary = chairOption?.primary ?? '#0f6a2f';
  const sheenColor = chairOption?.highlight ?? adjustHexColor(primary, 0.2);
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(adjustHexColor(primary, 0.04)),
    map: texture,
    roughness: 0.28,
    metalness: 0.08,
    clearcoat: 0.48,
    clearcoatRoughness: 0.28,
    sheen: 0.18
  });
  if ('sheenColor' in material) {
    material.sheenColor.set(sheenColor);
  }
  if ('sheenRoughness' in material) {
    material.sheenRoughness = 0.32;
  }
  if ('specularIntensity' in material) {
    material.specularIntensity = 0.65;
  }
  material.userData.clothTexture = texture;
  material.userData.chairId = chairOption?.id ?? 'default';
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

function computeCameraPitchLimits(position, baseForward, options = {}) {
  const { seatTopPoint = null } = options ?? {};
  const horizontalForward = Math.hypot(baseForward.x, baseForward.z);
  const baseDownAngle = Math.atan2(-baseForward.y, horizontalForward);
  const radialDistance = Math.hypot(position.x, position.z);
  const horizontalGap = Math.max(0.35, ARENA_WALL_INNER_RADIUS - radialDistance);
  const verticalReach = Math.max(0.01, ARENA_WALL_TOP_Y - position.y);
  const wallLimitedUp = Math.max(0, Math.atan2(verticalReach, horizontalGap) - CAMERA_WALL_MARGIN);
  const maxUpAngle = Math.max(0, Math.min(wallLimitedUp, THREE.MathUtils.degToRad(65)));
  const computedUp = Math.max(0, Math.min(baseDownAngle + maxUpAngle, THREE.MathUtils.degToRad(65)));
  let safeUp = computedUp > 0 ? computedUp : CAMERA_HEAD_PITCH_UP;
  if (seatTopPoint) {
    const limitVector = seatTopPoint.clone().sub(position);
    const horizontal = Math.hypot(limitVector.x, limitVector.z);
    if (horizontal > 1e-3) {
      const seatDownAngle = Math.atan2(Math.max(0, -limitVector.y), horizontal);
      const maxSeatUp = Math.max(0, baseDownAngle - seatDownAngle);
      safeUp = Math.min(safeUp, maxSeatUp);
    } else if (limitVector.y < 0) {
      safeUp = 0;
    }
  }
  return {
    min: -safeUp,
    max: CAMERA_HEAD_PITCH_DOWN
  };
}

function clampValue(value, min, max) {
  let low = Number.isFinite(min) ? min : 0;
  let high = Number.isFinite(max) ? max : 0;
  if (low > high) {
    [low, high] = [high, low];
  }
  if (!Number.isFinite(value)) {
    return low;
  }
  return Math.min(Math.max(value, low), high);
}

function buildCardinalSeatAngles(count) {
  if (!Number.isFinite(count) || count <= 0) {
    return [];
  }
  const baseAngles = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
  switch (Math.min(count, baseAngles.length)) {
    case 1:
      return [baseAngles[0]];
    case 2:
      return [baseAngles[0], baseAngles[2]];
    case 3:
      return [baseAngles[0], baseAngles[3], baseAngles[1]];
    default:
      return baseAngles.slice(0, Math.min(count, baseAngles.length));
  }
}

function buildClassicOctagonAngles(count) {
  if (!Number.isFinite(count) || count <= 0) {
    return [];
  }
  const safeCount = Math.max(1, Math.floor(count));
  const slotAngles = [
    (3 * Math.PI) / 8,
    Math.PI / 8,
    -Math.PI / 8,
    (-3 * Math.PI) / 8,
    (-5 * Math.PI) / 8,
    (-7 * Math.PI) / 8,
    (7 * Math.PI) / 8,
    (5 * Math.PI) / 8
  ];
  const preferredSlots = [0, 2, 3, 4, 5, 6];
  const angles = [];
  for (let i = 0; i < safeCount; i += 1) {
    const slotIndex = preferredSlots[i];
    if (slotIndex == null) {
      const fallbackAngle = Math.PI / 2 - HUMAN_SEAT_ROTATION_OFFSET - (i / safeCount) * Math.PI * 2;
      angles.push(fallbackAngle);
    } else {
      angles.push(slotAngles[slotIndex]);
    }
  }
  return angles;
}

function normalizeAppearance(value = {}) {
  const normalized = { ...DEFAULT_APPEARANCE };
  const entries = [
    ['tableWood', TABLE_WOOD_OPTIONS.length],
    ['tableCloth', TABLE_CLOTH_OPTIONS.length],
    ['tableBase', TABLE_BASE_OPTIONS.length],
    ['chairColor', CHAIR_COLOR_OPTIONS.length],
    ['tableShape', TABLE_SHAPE_OPTIONS.length],
    ['cards', CARD_THEMES.length]
  ];
  entries.forEach(([key, max]) => {
    const raw = Number(value?.[key]);
    if (Number.isFinite(raw)) {
      const clamped = Math.min(Math.max(0, Math.round(raw)), max - 1);
      normalized[key] = clamped;
    }
  });
  return normalized;
}

function clampPlayerCount(value) {
  if (!Number.isFinite(value)) {
    return DEFAULT_PLAYER_COUNT;
  }
  const rounded = Math.round(value);
  return Math.min(Math.max(rounded, MIN_PLAYER_COUNT), MAX_PLAYER_COUNT);
}

function enforceShapeForPlayers(appearance, playerCount) {
  const safe = { ...appearance };
  const shapeOption = TABLE_SHAPE_OPTIONS[safe.tableShape];
  if (playerCount > 4 && shapeOption?.id === DIAMOND_SHAPE_ID) {
    safe.tableShape = NON_DIAMOND_SHAPE_INDEX;
  }
  return safe;
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

function parseSearch(search) {
  const params = new URLSearchParams(search);
  const username = params.get('username') || 'You';
  const avatar = params.get('avatar') || '';
  const amount = Number.parseInt(params.get('amount') || '500', 10);
  const token = params.get('token') || 'TPC';
  const stake = Number.isFinite(amount) && amount > 0 ? amount : 500;
  const rawPlayers = Number.parseInt(params.get('players') || params.get('playerCount') || '', 10);
  const playerCount = clampPlayerCount(rawPlayers);
  const flags = (params.get('flags') || '')
    .split(',')
    .map((value) => Number.parseInt(value, 10))
    .filter(Number.isFinite)
    .map((index) => FLAG_EMOJIS[index])
    .filter(Boolean);
  return { username, avatar, stake, token, playerCount, flags };
}

function buildPlayers(searchOrOptions) {
  const options =
    typeof searchOrOptions === 'string' ? parseSearch(searchOrOptions) : { ...searchOrOptions };
  const { username, avatar, stake } = options;
  const seatCount = clampPlayerCount(options?.playerCount);
  const baseChips = Math.max(200, Math.round(stake));
  const preferredFlags = Array.isArray(options.flags) ? options.flags.filter(Boolean) : [];
  const shuffledFlags = [...FLAG_EMOJIS].sort(() => 0.5 - Math.random());
  const fallbackFlags = preferredFlags.length ? [...shuffledFlags] : [...shuffledFlags];
  const flags = preferredFlags.length ? [...preferredFlags] : [...shuffledFlags];
  const nextFlag = () => flags.shift() || fallbackFlags.shift() || FLAG_EMOJIS[(flags.length + 3) % FLAG_EMOJIS.length];
  const players = [];
  for (let i = 0; i < seatCount; i += 1) {
    if (i === DEALER_INDEX) {
      players.push({
        id: 'dealer',
        name: 'Dealer',
        flag: '🎩',
        isDealer: true,
        isHuman: false,
        chips: baseChips * 2,
        avatar: null
      });
    } else if (i === 0) {
      const flag = nextFlag() || '🇦🇱';
      players.push({
        id: 'player',
        name: username,
        flag,
        isDealer: false,
        isHuman: true,
        chips: baseChips,
        avatar: avatar || null
      });
    } else {
      const flag = nextFlag() || FLAG_EMOJIS[(i * 11) % FLAG_EMOJIS.length];
      players.push({
        id: `ai-${i}`,
        name: flagToName(flag),
        flag,
        isDealer: false,
        isHuman: false,
        chips: baseChips,
        avatar: null
      });
    }
  }
  return players;
}

function createSeatLayout(count, tableInfo = null, options = {}) {
  const layout = [];
  const safeCount = Math.max(0, Math.floor(Number(count) || 0));
  if (safeCount <= 0) {
    return layout;
  }
  const cardinalForDiamond =
    tableInfo?.shapeId === DIAMOND_SHAPE_ID && safeCount > 0 && safeCount <= 4;
  const useCardinal = Boolean(options?.useCardinal) || cardinalForDiamond;
  const cardinalAngles = useCardinal ? buildCardinalSeatAngles(safeCount) : null;
  const classicAngles =
    tableInfo?.shapeId === 'classicOctagon' ? buildClassicOctagonAngles(safeCount) : null;
  for (let i = 0; i < safeCount; i += 1) {
    const baseAngle = Math.PI / 2 - HUMAN_SEAT_ROTATION_OFFSET - (i / safeCount) * Math.PI * 2;
    const angle = classicAngles?.[i] ?? cardinalAngles?.[i] ?? baseAngle;
    const isHuman = i === 0;
    const forward = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const right = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));
    const baseRadius = tableInfo?.radius ?? TABLE_RADIUS;
    const tableSurfaceY = tableInfo?.surfaceY ?? TABLE_HEIGHT;
    const outerDistance = tableInfo?.getOuterRadius?.(forward) ?? baseRadius;
    let innerDistance = tableInfo?.getInnerRadius?.(forward);
    if (!Number.isFinite(innerDistance) || innerDistance <= 0 || innerDistance >= outerDistance) {
      innerDistance = outerDistance * 0.85;
    }
    const railSpan = Math.max(outerDistance - innerDistance, baseRadius * 0.04);
    let forwardMargin = outerDistance * RAIL_FORWARD_MARGIN_RATIO;
    const maxForwardMargin = Math.max(railSpan * 0.75, baseRadius * 0.015);
    forwardMargin = clampValue(forwardMargin, baseRadius * 0.01, maxForwardMargin);
    const railAnchorDistance = outerDistance - forwardMargin;
    const railAnchor = forward.clone().multiplyScalar(railAnchorDistance);
    railAnchor.y = tableSurfaceY + RAIL_HEIGHT_OFFSET;
    const railSurfaceY = railAnchor.y + RAIL_SURFACE_LIFT;
    const cardRailBase = railAnchorDistance + forwardMargin * CARD_RAIL_FORWARD_SHIFT_RATIO;
    const chipRailBase = railAnchorDistance + forwardMargin * CHIP_RAIL_FORWARD_SHIFT_RATIO;
    const cardRailDistance = clampValue(
      cardRailBase,
      innerDistance + railSpan * 0.15,
      railAnchorDistance - railSpan * 0.05
    );
    const chipRailDistance = clampValue(
      chipRailBase,
      innerDistance + railSpan * 0.4,
      outerDistance - railSpan * 0.05
    );
    const seatRadius = outerDistance + (isHuman ? HUMAN_SEAT_RADIUS_OFFSET : AI_SEAT_RADIUS_OFFSET);
    const seatPos = forward.clone().multiplyScalar(seatRadius);
    seatPos.y = CHAIR_BASE_HEIGHT;
    const cardRailCenter = forward.clone().multiplyScalar(cardRailDistance);
    cardRailCenter.y = railSurfaceY;
    const chipRailCenter = forward.clone().multiplyScalar(chipRailDistance);
    chipRailCenter.y = railSurfaceY;
    const cardAnchor = cardRailCenter
      .clone()
      .addScaledVector(forward, HUMAN_CARD_INWARD_SHIFT)
      .addScaledVector(right, -HUMAN_CARD_LATERAL_SHIFT);
    cardAnchor.y = tableSurfaceY + CARD_SURFACE_OFFSET;
    const chipAnchor = chipRailCenter
      .clone()
      .addScaledVector(forward, HUMAN_CHIP_INWARD_SHIFT)
      .addScaledVector(right, HUMAN_CHIP_LATERAL_SHIFT);
    chipAnchor.y = tableSurfaceY + CARD_SURFACE_OFFSET;
    const cardRailAnchor = cardRailCenter
      .clone()
      .addScaledVector(forward, HUMAN_CARD_INWARD_SHIFT)
      .addScaledVector(right, -HUMAN_CARD_LATERAL_SHIFT);
    cardRailAnchor.y = railSurfaceY;
    const chipRailAnchor = chipRailCenter
      .clone()
      .addScaledVector(forward, HUMAN_CHIP_INWARD_SHIFT)
      .addScaledVector(right, HUMAN_CHIP_LATERAL_SHIFT);
    chipRailAnchor.y = railSurfaceY;
    const betAnchor = forward
      .clone()
      .multiplyScalar(outerDistance * BET_DISTANCE_RATIO)
      .addScaledVector(forward, -BET_FORWARD_OFFSET);
    betAnchor.y = tableSurfaceY + CARD_SURFACE_OFFSET;
    const previewAnchor = betAnchor.clone();
    previewAnchor.y = betAnchor.y;
    const stoolAnchor = forward.clone().multiplyScalar(seatRadius);
    stoolAnchor.y = CHAIR_BASE_HEIGHT + SEAT_THICKNESS / 2;
    layout.push({
      angle,
      forward,
      right,
      seatPos,
      cardAnchor,
      chipAnchor,
      cardRailAnchor,
      chipRailAnchor,
      betAnchor,
      previewAnchor,
      labelOffset: {
        height: LABEL_BASE_HEIGHT,
        forward: isHuman ? HUMAN_LABEL_FORWARD : AI_LABEL_FORWARD
      },
      stoolAnchor,
      stoolHeight: STOOL_HEIGHT,
      isHuman,
      isDealer: i === DEALER_INDEX
    });
  }
  return layout;
}

function makeNameplate(name, chips, renderer) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 220;
  const ctx = canvas.getContext('2d');
  const draw = (playerName, stack, highlight, status) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = highlight ? 'rgba(34,197,94,0.3)' : 'rgba(15,23,42,0.78)';
    ctx.strokeStyle = highlight ? '#4ade80' : 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 10;
    roundRect(ctx, 16, 16, canvas.width - 32, canvas.height - 32, 32);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 64px "Inter", system-ui, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(playerName, 40, 40);
    ctx.font = '600 48px "Inter", system-ui, sans-serif';
    ctx.fillStyle = '#cbd5f5';
    ctx.fillText(`${stack} chips`, 40, 130);
    if (status) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#facc15';
      ctx.fillText(status, canvas.width - 40, 130);
      ctx.textAlign = 'left';
    }
  };
  draw(name, chips, false, '');
  const texture = new THREE.CanvasTexture(canvas);
  applySRGBColorSpace(texture);
  texture.anisotropy = renderer?.capabilities?.getMaxAnisotropy?.() ?? 4;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  const scale = 1.3 * MODEL_SCALE;
  sprite.scale.set(scale, scale * 0.45, 1);
  sprite.userData.update = draw;
  sprite.userData.texture = texture;
  return sprite;
}

function createBetControls({ arena, seat, chipFactory, tableInfo }) {
  if (!arena || !seat || !chipFactory || !tableInfo) return null;
  const group = new THREE.Group();
  group.visible = false;
  arena.add(group);

  const forward = seat.forward.clone().normalize();
  const axis = seat.right.clone().normalize();
  const anchorY = seat.cardRailAnchor?.y ?? seat.chipRailAnchor?.y ?? tableInfo.surfaceY + RAIL_HEIGHT_OFFSET + RAIL_SURFACE_LIFT;
  const fallbackAnchor = forward.clone().multiplyScalar(tableInfo.radius * RAIL_ANCHOR_RATIO);
  fallbackAnchor.y = anchorY;
  const cardRailAnchor = seat.cardRailAnchor
    ? seat.cardRailAnchor.clone()
    : fallbackAnchor.clone().addScaledVector(forward, CARD_RAIL_FORWARD_SHIFT).addScaledVector(axis, -CARD_RAIL_LATERAL_SHIFT);
  cardRailAnchor.y = anchorY;
  const chipCenter = seat.chipRailAnchor
    ? seat.chipRailAnchor.clone()
    : fallbackAnchor.clone().addScaledVector(axis, CARD_RAIL_LATERAL_SHIFT + CHIP_RAIL_LATERAL_SHIFT);
  chipCenter.y = anchorY;

  const columns = 3;
  const rows = Math.max(1, Math.ceil(CHIP_VALUES.length / columns));
  const colOffset = (columns - 1) / 2;
  const rowOffset = (rows - 1) / 2;

  const chipButtons = CHIP_VALUES.map((value, index) => {
    const chip = chipFactory.createStack(value, { mode: 'stack' });
    const baseScale = RAIL_CHIP_SCALE;
    chip.position.copy(chipCenter);
    chip.position.y = anchorY + CARD_D * 2.2;
    const row = Math.floor(index / columns);
    const col = index % columns;
    chip.position.addScaledVector(axis, (col - colOffset) * RAIL_CHIP_SPACING);
    chip.position.addScaledVector(forward, -(row - rowOffset) * RAIL_CHIP_ROW_SPACING);
    chip.scale.setScalar(baseScale);
    chip.userData = { type: 'chip-button', value, baseScale };
    group.add(chip);
    return chip;
  });

  const interactables = [...chipButtons];

  const dispose = () => {
    chipButtons.forEach((chip) => {
      chipFactory.disposeStack(chip);
      if (chip.parent) {
        chip.parent.remove(chip);
      }
    });
    if (group.parent) {
      group.parent.remove(group);
    }
  };

  return { group, chipButtons, interactables, dispose };
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function applyCardToMesh(mesh, card, geometry, cache, theme) {
  if (!mesh || !card) return;
  const prev = mesh.userData?.card;
  if (prev && prev.rank === card.rank && prev.suit === card.suit) {
    mesh.userData.card = card;
    return;
  }
  const fresh = createCardMesh(card, geometry, cache, theme);
  const existing = mesh.material;
  if (Array.isArray(existing)) {
    existing.forEach((mat) => mat?.dispose?.());
  } else {
    existing?.dispose?.();
  }
  mesh.material = fresh.material;
  mesh.userData = { ...mesh.userData, ...fresh.userData, card };
}

function buildInitialState(players, token, stake) {
  return {
    players: players.map((p, idx) => ({
      ...p,
      seatIndex: idx,
      hand: [],
      bet: 0,
      result: '',
      revealed: false,
      bust: false
    })),
    deck: [],
    token,
    stake,
    stage: 'betting',
    currentIndex: 0,
    dealerIndex: DEALER_INDEX,
    pot: 0,
    awaitingInput: false,
    winners: [],
    round: 0
  };
}

function resetForNextRound(state) {
  const next = { ...state, round: state.round + 1 };
  next.deck = shuffle(createDeck());
  next.stage = 'betting';
  next.currentIndex = 0;
  next.pot = 0;
  next.winners = [];
  next.players = state.players.map((p) => ({
    ...p,
    hand: [],
    bet: 0,
    result: '',
    revealed: p.isDealer,
    bust: false
  }));
  return next;
}

function placeInitialBets(state, options = {}) {
  const { humanBet } = options;
  state.players.forEach((player) => {
    if (player.isDealer) return;
    const baseBet = Math.min(player.chips, Math.max(20, Math.round(state.stake * 0.2)));
    let wager = baseBet;
    if (player.isHuman && Number.isFinite(humanBet)) {
      const target = Math.round(humanBet);
      wager = clampValue(target, 1, player.chips);
    }
    player.chips -= wager;
    player.bet = wager;
    state.pot += wager;
    player.result = `Bet ${wager}`;
    if (player.chips <= 0) player.chips = 0;
  });
}

function dealInitialCards(state) {
  const { hands, deck } = dealInitial(state.deck, state.players.length);
  state.deck = deck;
  state.players.forEach((player, idx) => {
    player.hand = hands[idx];
    player.bust = false;
    player.revealed = player.isDealer ? false : true;
  });
  state.stage = 'player-turns';
  state.currentIndex = getNextPlayerIndex(state.players, -1);
}

function getNextPlayerIndex(players, start) {
  const total = players.length;

  if (start < 0) {
    for (let idx = 0; idx < total; idx += 1) {
      const player = players[idx];
      if (!player) continue;
      if (!player.isDealer && player.bet > 0 && !player.bust) {
        return idx;
      }
    }
    return DEALER_INDEX;
  }

  for (let offset = 1; offset <= total; offset += 1) {
    const idx = (start - offset + total) % total;
    const player = players[idx];
    if (!player) continue;
    if (!player.isDealer && player.bet > 0 && !player.bust) {
      return idx;
    }
  }
  return DEALER_INDEX;
}

function playDealer(state) {
  const dealer = state.players[state.dealerIndex];
  dealer.revealed = true;
  dealer.result = '';
  while (handValue(dealer.hand) < 17) {
    const { card, deck } = hitCard(state.deck);
    state.deck = deck;
    dealer.hand.push(card);
  }
  if (isBust(dealer.hand)) {
    dealer.bust = true;
    dealer.result = 'Bust';
  } else {
    dealer.result = `Dealer ${handValue(dealer.hand)}`;
  }
}

function resolveRound(state) {
  playDealer(state);
  const dealer = state.players[state.dealerIndex];
  const contenders = state.players.filter((p) => !p.isDealer);
  const winners = [];
  contenders.forEach((player) => {
    if (player.bet <= 0) return;
    const playerValue = handValue(player.hand);
    const dealerValue = handValue(dealer.hand);
    if (player.bust) {
      player.result = 'Lose';
    } else if (dealer.bust || playerValue > dealerValue) {
      const payout = player.bet * 2;
      player.chips += payout;
      player.result = `Win ${payout}`;
      winners.push(player.seatIndex);
    } else if (playerValue === dealerValue) {
      player.chips += player.bet;
      player.result = 'Push';
    } else {
      player.result = 'Lose';
    }
  });
  state.pot = 0;
  state.stage = 'round-end';
  state.winners = winners;
}

function applyPlayerAction(state, action) {
  const player = state.players[state.currentIndex];
  if (!player || player.isDealer) return;
  if (action === 'hit') {
    const { card, deck } = hitCard(state.deck);
    state.deck = deck;
    player.hand.push(card);
    player.revealed = true;
    if (isBust(player.hand)) {
      player.bust = true;
      player.result = 'Bust';
      advancePlayer(state);
    }
  } else if (action === 'stand') {
    player.result = `Stand ${handValue(player.hand)}`;
    advancePlayer(state);
  }
}

function advancePlayer(state) {
  const nextIndex = getNextPlayerIndex(state.players, state.currentIndex);
  if (nextIndex === DEALER_INDEX) {
    state.stage = 'dealer';
    state.currentIndex = DEALER_INDEX;
    resolveRound(state);
  } else {
    state.currentIndex = nextIndex;
  }
}

function cloneState(state) {
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, hand: [...p.hand] }))
  };
}

function BlackJackArena({ search }) {
  const mountRef = useRef(null);
  const threeRef = useRef(null);
  const animationRef = useRef(null);
  const headAnglesRef = useRef({ yaw: 0, pitch: 0 });
  const cameraBasisRef = useRef({
    position: new THREE.Vector3(),
    baseForward: new THREE.Vector3(0, 0, -1),
    baseUp: new THREE.Vector3(0, 1, 0),
    baseRight: new THREE.Vector3(1, 0, 0)
  });
  const pointerStateRef = useRef({
    active: false,
    pointerId: null,
    mode: null,
    startX: 0,
    startY: 0,
    startYaw: 0,
    startPitch: 0,
    dragged: false
  });
  const pointerVectorRef = useRef(new THREE.Vector2());
  const interactionsRef = useRef({
    onChip: () => {},
    onUndo: () => {}
  });
  const hoverTargetRef = useRef(null);
  const previousStageRef = useRef(null);
  const searchOptions = useMemo(() => parseSearch(search), [search]);
  const [gameState, setGameState] = useState(() => {
    const players = buildPlayers(searchOptions);
    const base = buildInitialState(players, searchOptions.token, searchOptions.stake);
    return resetForNextRound(base);
  });
  const [uiState, setUiState] = useState({ actions: [] });
  const [chipSelection, setChipSelection] = useState([]);
  const [sliderValue, setSliderValue] = useState(0);
  const [appearance, setAppearance] = useState(() => {
    if (typeof window === 'undefined') return { ...DEFAULT_APPEARANCE };
    try {
      const stored = window.localStorage?.getItem(APPEARANCE_STORAGE_KEY);
      if (!stored) return { ...DEFAULT_APPEARANCE };
      return normalizeAppearance(JSON.parse(stored));
    } catch (error) {
      console.warn('Failed to load Blackjack appearance', error);
      return { ...DEFAULT_APPEARANCE };
    }
  });
  const appearanceRef = useRef(appearance);
  const [configOpen, setConfigOpen] = useState(false);
  const timerRef = useRef(null);
  const effectivePlayerCount = clampPlayerCount(
    gameState?.players?.length || searchOptions.playerCount
  );

  useEffect(() => {
    appearanceRef.current = appearance;
  }, [appearance]);

  const renderPreview = useCallback((type, option) => {
    switch (type) {
      case 'tableWood': {
        const preset = option?.presetId ? WOOD_PRESETS_BY_ID[option.presetId] : undefined;
        const grain = option?.grainId ? WOOD_GRAIN_OPTIONS_BY_ID[option.grainId] : undefined;
        const presetRef = preset || WOOD_FINISH_PRESETS?.[0];
        const baseHex = presetRef
          ? `#${hslToHexNumber(presetRef.hue, presetRef.sat, presetRef.light).toString(16).padStart(6, '0')}`
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
      case 'cards':
        return (
          <div className="relative h-14 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950/40">
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(135deg, ${option.backGradient?.[0] ?? option.backColor}, ${option.backGradient?.[1] ?? option.backColor})`
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="rounded-full bg-black/50 px-3 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.2em] text-white/80">
                {option.label}
              </span>
            </div>
          </div>
        );
      default:
        return null;
    }
  }, []);

  useEffect(() => {
    if (effectivePlayerCount > 4) {
      const currentShape = TABLE_SHAPE_OPTIONS[appearance.tableShape];
      if (currentShape?.id === DIAMOND_SHAPE_ID && NON_DIAMOND_SHAPE_INDEX !== appearance.tableShape) {
        setAppearance((prev) => {
          const prevShape = TABLE_SHAPE_OPTIONS[prev.tableShape];
          if (prevShape?.id !== DIAMOND_SHAPE_ID) {
            return prev;
          }
          return { ...prev, tableShape: NON_DIAMOND_SHAPE_INDEX };
        });
      }
    }
  }, [appearance.tableShape, effectivePlayerCount]);

  const applyHeadOrientation = useCallback(() => {
    const three = threeRef.current;
    if (!three) return;
    const { camera } = three;
    const basis = cameraBasisRef.current;
    const { yaw, pitch } = headAnglesRef.current;

    const yawQuat = new THREE.Quaternion().setFromAxisAngle(WORLD_UP, yaw);
    const rotatedForward = basis.baseForward.clone().applyQuaternion(yawQuat);
    const rotatedUp = basis.baseUp.clone().applyQuaternion(yawQuat);
    const rightAxis = basis.baseRight.clone().applyQuaternion(yawQuat);
    const pitchQuat = new THREE.Quaternion().setFromAxisAngle(rightAxis, pitch);
    const finalForward = rotatedForward.applyQuaternion(pitchQuat).normalize();
    const finalUp = rotatedUp.applyQuaternion(pitchQuat).normalize();

    camera.position.copy(basis.position);
    camera.up.copy(finalUp);
    camera.lookAt(basis.position.clone().add(finalForward));
    three.orientHumanCards?.();
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    applyRendererSRGB(renderer);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#030712');

    const camera = new THREE.PerspectiveCamera(
      CAMERA_SETTINGS.fov,
      mount.clientWidth / mount.clientHeight,
      CAMERA_SETTINGS.near,
      CAMERA_SETTINGS.far
    );
    camera.position.set(0, TABLE_HEIGHT * 2.85, TABLE_RADIUS * 3.9);
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.cursor = 'grab';

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
    const initialAppearance = enforceShapeForPlayers(initialAppearanceRaw, effectivePlayerCount);
    const initialWood = TABLE_WOOD_OPTIONS[initialAppearance.tableWood] ?? TABLE_WOOD_OPTIONS[0];
    const initialCloth = TABLE_CLOTH_OPTIONS[initialAppearance.tableCloth] ?? TABLE_CLOTH_OPTIONS[0];
    const initialBase = TABLE_BASE_OPTIONS[initialAppearance.tableBase] ?? TABLE_BASE_OPTIONS[0];
    const initialChair = CHAIR_COLOR_OPTIONS[initialAppearance.chairColor] ?? CHAIR_COLOR_OPTIONS[0];
    const { option: initialShape, rotationY: initialRotation } = getEffectiveShapeConfig(
      initialAppearance.tableShape,
      effectivePlayerCount
    );

    const tableInfo = createMurlanStyleTable({
      arena: arenaGroup,
      renderer,
      tableRadius: TABLE_RADIUS,
      tableHeight: TABLE_HEIGHT,
      woodOption: initialWood,
      clothOption: initialCloth,
      baseOption: initialBase,
      shapeOption: initialShape,
      rotationY: initialRotation
    });
    applyTableMaterials(
      tableInfo.materials,
      { woodOption: initialWood, clothOption: initialCloth, baseOption: initialBase },
      renderer
    );

    const cardGeometry = createCardGeometry(CARD_W, CARD_H, CARD_D);
    const faceCache = new Map();
    const cardTheme = CARD_THEMES[initialAppearance.cards] ?? CARD_THEMES[0];
    const chipFactory = createChipFactory(renderer, { cardWidth: CARD_W });
    const initialPlayers = gameState?.players ?? [];
    const initialSeatCount = initialPlayers.length || effectivePlayerCount;
    const seatLayout = createSeatLayout(initialSeatCount, tableInfo, {
      useCardinal: initialShape?.id === DIAMOND_SHAPE_ID && initialSeatCount <= 4
    });
    const topSeat = seatLayout
      .filter((seat) => !seat.isHuman)
      .reduce((best, seat) => (!best || seat.seatPos.z < best.seatPos.z ? seat : best), null);
    const seatTopPoint = topSeat ? topSeat.stoolAnchor.clone().setY(topSeat.stoolHeight) : null;

    const seatGroups = [];
    const deckAnchor = DECK_POSITION.clone();
    if (tableInfo.rotationY) {
      deckAnchor.applyAxisAngle(WORLD_UP, tableInfo.rotationY);
    }

    const humanSeat = seatLayout.find((seat) => seat.isHuman) ?? seatLayout[0];
    const raiseControls = createBetControls({ arena: arenaGroup, seat: humanSeat, chipFactory, tableInfo });
    const applySeatedCamera = (width, height) => {
      if (!humanSeat) return;
      const portrait = height > width;
      const lateralOffset = portrait ? CAMERA_LATERAL_OFFSETS.portrait : CAMERA_LATERAL_OFFSETS.landscape;
      const retreatOffset = portrait ? CAMERA_RETREAT_OFFSETS.portrait : CAMERA_RETREAT_OFFSETS.landscape;
      const elevation = portrait ? CAMERA_ELEVATION_OFFSETS.portrait : CAMERA_ELEVATION_OFFSETS.landscape;
      const position = humanSeat.stoolAnchor
        .clone()
        .addScaledVector(humanSeat.forward, -retreatOffset)
        .addScaledVector(humanSeat.right, lateralOffset);
      const maxCameraHeight = ARENA_WALL_TOP_Y - CAMERA_WALL_HEIGHT_MARGIN;
      position.y = Math.min(humanSeat.stoolHeight + elevation, maxCameraHeight);

      const focusBase = new THREE.Vector3(0, TABLE_HEIGHT + CAMERA_TARGET_LIFT + CAMERA_FOCUS_CENTER_LIFT, 0);
      const focusForwardPull = portrait ? PORTRAIT_CAMERA_PLAYER_FOCUS_FORWARD_PULL : CAMERA_PLAYER_FOCUS_FORWARD_PULL;
      const focusHeight = portrait ? PORTRAIT_CAMERA_PLAYER_FOCUS_HEIGHT : CAMERA_PLAYER_FOCUS_HEIGHT;
      const focusBlend = portrait ? PORTRAIT_CAMERA_PLAYER_FOCUS_BLEND : CAMERA_PLAYER_FOCUS_BLEND;
      const chipFocus = humanSeat.chipAnchor.clone().addScaledVector(humanSeat.forward, -focusForwardPull);
      chipFocus.y = TABLE_HEIGHT + focusHeight - CAMERA_PLAYER_FOCUS_DROP;
      const focus = focusBase.lerp(chipFocus, focusBlend);

      camera.position.copy(position);
      camera.lookAt(focus);
      camera.updateMatrixWorld();
      const baseForward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
      const baseUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion).normalize();
      const baseRight = new THREE.Vector3().crossVectors(baseForward, baseUp).normalize();
      const pitchLimits = computeCameraPitchLimits(position, baseForward, { seatTopPoint });
      cameraBasisRef.current = {
        position: position.clone(),
        baseForward,
        baseUp,
        baseRight,
        pitchLimits
      };
      headAnglesRef.current.yaw = THREE.MathUtils.clamp(0, -CAMERA_HEAD_TURN_LIMIT, CAMERA_HEAD_TURN_LIMIT);
      headAnglesRef.current.pitch = THREE.MathUtils.clamp(0, pitchLimits.min, pitchLimits.max);
      applyHeadOrientation();
    };

    applySeatedCamera(mount.clientWidth, mount.clientHeight);

    const stoolTheme = DEFAULT_STOOL_THEME;
    const chairMaterial = createChairFabricMaterial(initialChair, renderer);
    const legMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(initialChair.legColor ?? stoolTheme.legColor)
    });
    legMaterial.userData = { ...(legMaterial.userData || {}), chairId: initialChair.id ?? 'default' };

    seatLayout.forEach((seat) => {
      const group = new THREE.Group();
      group.position.copy(seat.seatPos);
      group.lookAt(new THREE.Vector3(0, seat.seatPos.y, 0));

      const seatMesh = new THREE.Mesh(new THREE.BoxGeometry(SEAT_WIDTH, SEAT_THICKNESS, SEAT_DEPTH), chairMaterial);
      seatMesh.position.y = SEAT_THICKNESS / 2;
      seatMesh.castShadow = true;
      seatMesh.receiveShadow = true;
      group.add(seatMesh);

      const backMesh = new THREE.Mesh(new THREE.BoxGeometry(SEAT_WIDTH, BACK_HEIGHT, BACK_THICKNESS), chairMaterial);
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

      arenaGroup.add(group);

      const cardMeshes = Array.from({ length: 6 }, () => {
        const mesh = createCardMesh({ rank: 'A', suit: 'S' }, cardGeometry, faceCache, cardTheme);
        mesh.position.copy(deckAnchor);
        mesh.castShadow = true;
        arenaGroup.add(mesh);
        return mesh;
      });

      const chipStack = chipFactory.createStack(0, { mode: 'scatter', layout: CHIP_SCATTER_LAYOUT });
      chipStack.position.copy(seat.chipAnchor);
      arenaGroup.add(chipStack);

      const betStack = chipFactory.createStack(0, { mode: 'scatter', layout: CHIP_SCATTER_LAYOUT });
      betStack.position.copy(seat.betAnchor);
      arenaGroup.add(betStack);

      const previewStack = chipFactory.createStack(0, { mode: 'scatter', layout: CHIP_SCATTER_LAYOUT });
      previewStack.position.copy(seat.previewAnchor);
      previewStack.visible = false;
      arenaGroup.add(previewStack);

      const nameplate = makeNameplate('Player', 0, renderer);
      nameplate.position.set(0, seat.labelOffset.height, seat.labelOffset.forward);
      group.add(nameplate);

      seatGroups.push({
        group,
        chairMeshes: [seatMesh, backMesh, ...armLeft.meshes, ...armRight.meshes],
        legMesh: legBase,
        cardMeshes,
        chipStack,
        betStack,
        previewStack,
        nameplate,
        forward: seat.forward.clone(),
        right: seat.right.clone(),
        cardAnchor: seat.cardAnchor.clone(),
        chipAnchor: seat.chipAnchor.clone(),
        cardRailAnchor: seat.cardRailAnchor.clone(),
        chipRailAnchor: seat.chipRailAnchor.clone(),
        betAnchor: seat.betAnchor.clone(),
        previewAnchor: seat.previewAnchor.clone(),
        stoolAnchor: seat.stoolAnchor.clone(),
        stoolHeight: seat.stoolHeight,
        labelOffset: { ...seat.labelOffset },
        isHuman: seat.isHuman,
        isDealer: seat.isDealer,
        tableLayout: CHIP_SCATTER_LAYOUT,
        lastBet: 0,
        lastChips: 0,
        lastStatus: ''
      });
    });

    const potLayout = {
      perRow: POT_SCATTER_LAYOUT.perRow,
      spacing: POT_SCATTER_LAYOUT.spacing,
      rowSpacing: POT_SCATTER_LAYOUT.rowSpacing,
      jitter: POT_SCATTER_LAYOUT.jitter,
      lift: POT_SCATTER_LAYOUT.lift,
      right: new THREE.Vector3(1, 0, 0),
      forward: new THREE.Vector3(0, 0, 1)
    };
    const potStack = chipFactory.createStack(0, { mode: 'scatter', layout: potLayout });
    potStack.position.copy(POT_OFFSET);
    arenaGroup.add(potStack);

    const raycaster = new THREE.Raycaster();

    threeRef.current = {
      renderer,
      scene,
      camera,
      arenaGroup,
      tableInfo,
      tableShapeId: initialShape?.id ?? null,
      cardGeometry,
      faceCache,
      chipFactory,
      seatGroups,
      potStack,
      deckAnchor,
      raiseControls,
      raycaster,
      sharedMaterials: { chair: chairMaterial, leg: legMaterial },
      cardTheme,
      orientHumanCards: () => {
        const seat = seatGroups.find((s) => s.isHuman);
        if (!seat) return;
        const baseAnchor = seat.cardAnchor
          .clone()
          .addScaledVector(seat.forward, HUMAN_CARD_FORWARD_OFFSET)
          .lerp(seat.chipAnchor, HUMAN_CARD_CHIP_BLEND);
        seat.cardMeshes.forEach((mesh, idx) => {
          if (!mesh.visible || !mesh.userData?.card) {
            return;
          }
          const position = baseAnchor.clone().add(seat.right.clone().multiplyScalar((idx - 0.5) * HOLE_SPACING));
          position.y = TABLE_HEIGHT + HUMAN_CARD_VERTICAL_OFFSET;
          mesh.position.copy(position);
          const lookTarget = camera.position.clone();
          lookTarget.y = position.y + HUMAN_CARD_LOOK_LIFT;
          lookTarget.add(seat.right.clone().multiplyScalar((idx - 0.5) * HUMAN_CARD_LOOK_SPLAY));
          orientCard(mesh, lookTarget, { face: 'front', flat: false });
        });
      }
    };

    const element = renderer.domElement;

    const updateCameraAngles = () => {
      const basis = cameraBasisRef.current;
      const pitchLimits = basis?.pitchLimits ?? DEFAULT_PITCH_LIMITS;
      headAnglesRef.current.yaw = THREE.MathUtils.clamp(
        headAnglesRef.current.yaw,
        -CAMERA_HEAD_TURN_LIMIT,
        CAMERA_HEAD_TURN_LIMIT
      );
      headAnglesRef.current.pitch = THREE.MathUtils.clamp(
        headAnglesRef.current.pitch,
        pitchLimits.min,
        pitchLimits.max
      );
      applyHeadOrientation();
    };

    const resetPointerState = () => {
      pointerStateRef.current = {
        active: false,
        pointerId: null,
        mode: null,
        startX: 0,
        startY: 0,
        startYaw: 0,
        startPitch: 0,
        dragged: false
      };
    };

    const getControls = () => threeRef.current?.raiseControls || null;

    const applyHoverTarget = (target) => {
      const previous = hoverTargetRef.current;
      if (previous && previous !== target && previous.userData?.type === 'chip-button') {
        previous.scale.setScalar(previous.userData.baseScale);
      }
      hoverTargetRef.current = target || null;
      if (!target) return;
      if (target.userData?.type === 'chip-button') {
        target.scale.setScalar(target.userData.baseScale * 1.12);
      }
    };

    const pickInteractive = (event) => {
      const controls = getControls();
      if (!controls?.group?.visible) return null;
      const rect = element.getBoundingClientRect();
      pointerVectorRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerVectorRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerVectorRef.current, camera);
      const intersects = raycaster.intersectObjects(controls.interactables, true);
      if (!intersects.length) return null;
      let target = intersects[0].object;
      while (target && !target.userData?.type && target.parent) {
        target = target.parent;
      }
      if (!target?.userData?.type) return null;
      return target;
    };

    const handlePointerDown = (event) => {
      event.preventDefault();
      const target = pickInteractive(event);
      if (target) {
        pointerStateRef.current = {
          active: true,
          pointerId: event.pointerId,
          mode: target.userData.type,
          startX: event.clientX,
          startY: event.clientY,
          startYaw: headAnglesRef.current.yaw,
          startPitch: headAnglesRef.current.pitch,
          dragged: false
        };
        element.setPointerCapture(event.pointerId);
        if (target.userData.type === 'chip-button') {
          interactionsRef.current.onChip?.(target.userData.value);
          applyHoverTarget(target);
          element.style.cursor = 'pointer';
        }
        return;
      }
      pointerStateRef.current = {
        active: true,
        pointerId: event.pointerId,
        mode: 'camera',
        startX: event.clientX,
        startY: event.clientY,
        startYaw: headAnglesRef.current.yaw,
        startPitch: headAnglesRef.current.pitch,
        dragged: false
      };
      element.setPointerCapture(event.pointerId);
      element.style.cursor = 'grabbing';
    };

    const handlePointerMove = (event) => {
      const state = pointerStateRef.current;
      if (!state.active || state.pointerId !== event.pointerId) {
        const target = pickInteractive(event);
        applyHoverTarget(target);
        element.style.cursor = target ? 'pointer' : 'grab';
        return;
      }
      if (state.mode === 'camera') {
        const dx = event.clientX - state.startX;
        if (!state.dragged && Math.abs(dx) > 3) {
          state.dragged = true;
        }
        const dy = event.clientY - state.startY;
        const basis = cameraBasisRef.current;
        const pitchLimits = basis?.pitchLimits ?? DEFAULT_PITCH_LIMITS;
        headAnglesRef.current.yaw = THREE.MathUtils.clamp(
          state.startYaw - dx * HEAD_YAW_SENSITIVITY,
          -CAMERA_HEAD_TURN_LIMIT,
          CAMERA_HEAD_TURN_LIMIT
        );
        headAnglesRef.current.pitch = THREE.MathUtils.clamp(
          state.startPitch - dy * HEAD_PITCH_SENSITIVITY,
          pitchLimits.min,
          pitchLimits.max
        );
        applyHeadOrientation();
        return;
      }
      if (state.mode === 'chip-button') {
        const distance = Math.hypot(event.clientX - state.startX, event.clientY - state.startY);
        state.dragged = distance > 10;
      }
    };

    const handlePointerUp = (event) => {
      const state = pointerStateRef.current;
      if (state.pointerId !== event.pointerId) {
        return;
      }
      element.releasePointerCapture(event.pointerId);
      element.style.cursor = 'grab';
      resetPointerState();
      updateCameraAngles();
      applyHoverTarget(null);
    };

    element.addEventListener('pointerdown', handlePointerDown);
    element.addEventListener('pointermove', handlePointerMove);
    element.addEventListener('pointerup', handlePointerUp);
    element.addEventListener('pointercancel', handlePointerUp);
    element.addEventListener('pointerleave', handlePointerUp);

    const handleResize = () => {
      if (!threeRef.current) return;
      const { renderer: r, camera: cam } = threeRef.current;
      const { clientWidth, clientHeight } = mount;
      r.setSize(clientWidth, clientHeight);
      cam.aspect = clientWidth / clientHeight;
      cam.updateProjectionMatrix();
      applySeatedCamera(clientWidth, clientHeight);
    };
    window.addEventListener('resize', handleResize);

    const animate = () => {
      const three = threeRef.current;
      if (!three) return;
      three.renderer.render(three.scene, three.camera);
      animationRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationRef.current);
      element.removeEventListener('pointerdown', handlePointerDown);
      element.removeEventListener('pointermove', handlePointerMove);
      element.removeEventListener('pointerup', handlePointerUp);
      element.removeEventListener('pointercancel', handlePointerUp);
      element.removeEventListener('pointerleave', handlePointerUp);
      if (threeRef.current) {
        const {
          renderer: r,
          scene: s,
          chipFactory: factory,
          seatGroups: seats,
          potStack: pot,
          tableInfo: info,
          raiseControls: controls
        } = threeRef.current;
        seats.forEach((seat) => {
          seat.cardMeshes.forEach((mesh) => {
            s.remove(mesh);
            mesh.geometry?.dispose?.();
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach((mat) => mat?.dispose?.());
            } else {
              mesh.material?.dispose?.();
            }
          });
          factory.disposeStack(seat.chipStack);
          factory.disposeStack(seat.betStack);
          factory.disposeStack(seat.previewStack);
          if (seat.nameplate) {
            seat.nameplate.material?.map?.dispose?.();
            seat.nameplate.material?.dispose?.();
            s.remove(seat.nameplate);
          }
        });
        factory.disposeStack(pot);
        controls?.dispose?.();
        factory.dispose();
        info?.dispose?.();
        disposeChairMaterial(threeRef.current.sharedMaterials?.chair);
        threeRef.current.sharedMaterials?.leg?.dispose?.();
        r.dispose();
      }
      mount.removeChild(renderer.domElement);
      threeRef.current = null;
    };
  }, [applyHeadOrientation]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage?.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(appearance));
      } catch (error) {
        console.warn('Failed to persist Blackjack appearance', error);
      }
    }
    const three = threeRef.current;
    if (!three) return;
    const normalized = normalizeAppearance(appearance);
    const seatCount = three.seatGroups?.length || effectivePlayerCount;
    const safe = enforceShapeForPlayers(normalized, seatCount);
    const woodOption = TABLE_WOOD_OPTIONS[safe.tableWood] ?? TABLE_WOOD_OPTIONS[0];
    const clothOption = TABLE_CLOTH_OPTIONS[safe.tableCloth] ?? TABLE_CLOTH_OPTIONS[0];
    const baseOption = TABLE_BASE_OPTIONS[safe.tableBase] ?? TABLE_BASE_OPTIONS[0];
    const chairOption = CHAIR_COLOR_OPTIONS[safe.chairColor] ?? CHAIR_COLOR_OPTIONS[0];
    const { option: shapeOption, rotationY } = getEffectiveShapeConfig(safe.tableShape, seatCount);
    const cardTheme = CARD_THEMES[safe.cards] ?? CARD_THEMES[0];

    const shapeChanged = shapeOption && three.tableShapeId !== shapeOption.id;
    const rotationChanged = Number.isFinite(rotationY)
      ? Math.abs((three.tableInfo?.rotationY ?? 0) - rotationY) > 1e-3
      : false;

    if (shapeOption && three.arenaGroup && (shapeChanged || rotationChanged)) {
      const nextTable = createMurlanStyleTable({
        arena: three.arenaGroup,
        renderer: three.renderer,
        tableRadius: TABLE_RADIUS,
        tableHeight: TABLE_HEIGHT,
        woodOption,
        clothOption,
        baseOption,
        shapeOption,
        rotationY
      });
      three.tableInfo?.dispose?.();
      three.tableInfo = nextTable;
      three.tableShapeId = shapeOption.id;
      if (three.deckAnchor) {
        const updatedDeckAnchor = DECK_POSITION.clone();
        if (nextTable.rotationY) {
          updatedDeckAnchor.applyAxisAngle(WORLD_UP, nextTable.rotationY);
        }
        three.deckAnchor.copy(updatedDeckAnchor);
      }
    } else if (three.tableInfo?.materials) {
      applyTableMaterials(three.tableInfo.materials, { woodOption, clothOption, baseOption }, three.renderer);
    }

    if (chairOption && three.sharedMaterials) {
      const currentChairId = three.sharedMaterials.chair?.userData?.chairId;
      if (currentChairId !== (chairOption.id ?? 'default')) {
        const nextMaterial = createChairFabricMaterial(chairOption, three.renderer);
        three.seatGroups?.forEach((seat) => {
          seat.chairMeshes.forEach((mesh) => {
            mesh.material = nextMaterial;
          });
        });
        disposeChairMaterial(three.sharedMaterials.chair);
        three.sharedMaterials.chair = nextMaterial;
      }
      const currentLegId = three.sharedMaterials.leg?.userData?.chairId;
      if (currentLegId !== (chairOption.id ?? 'default')) {
        const nextLeg = new THREE.MeshStandardMaterial({
          color: new THREE.Color(chairOption.legColor ?? DEFAULT_STOOL_THEME.legColor)
        });
        nextLeg.userData = { chairId: chairOption.id ?? 'default' };
        three.seatGroups?.forEach((seat) => {
          if (seat.legMesh) {
            seat.legMesh.material = nextLeg;
          }
        });
        three.sharedMaterials.leg?.dispose?.();
        three.sharedMaterials.leg = nextLeg;
      }
    }

    if (cardTheme && three.cardTheme !== cardTheme) {
      const applyThemeToMesh = (mesh, cardData) => {
        if (!mesh) return;
        const priorFace = mesh.userData?.cardFace || 'front';
        applyCardToMesh(mesh, cardData, three.cardGeometry, three.faceCache, cardTheme);
        setCardFace(mesh, priorFace);
      };
      three.seatGroups?.forEach((seat) => {
        seat.cardMeshes.forEach((mesh) => {
          const data = mesh.userData?.card || { rank: 'A', suit: 'S' };
          applyThemeToMesh(mesh, data);
        });
      });
      three.cardTheme = cardTheme;
    }
  }, [appearance, effectivePlayerCount]);

  useEffect(() => {
    const three = threeRef.current;
    if (!three) return;
    const { seatGroups, chipFactory, potStack, cardGeometry, faceCache } = three;
    const state = gameState;
    if (!state) return;

    seatGroups.forEach((seat, idx) => {
      const player = state.players[idx];
      if (!player) return;
      const base = seat.cardAnchor.clone();
      const right = seat.right.clone();
      const forward = seat.forward.clone();
      seat.cardMeshes.forEach((mesh, cardIdx) => {
        const card = player.hand[cardIdx];
        if (!card) {
          mesh.visible = false;
          return;
        }
        mesh.visible = true;
        applyCardToMesh(mesh, card, cardGeometry, faceCache, three.cardTheme);
        const target = base
          .clone()
          .add(right.clone().multiplyScalar((cardIdx - (player.hand.length - 1) / 2) * HOLE_SPACING));
        mesh.position.copy(target);
        const look = target.clone().add(forward.clone().multiplyScalar(player.isDealer ? -1 : 1));
        const face = player.isDealer && cardIdx === 1 && !player.revealed ? 'back' : 'front';
        orientCard(mesh, look, { face, flat: true });
        setCardFace(mesh, face);
      });
      chipFactory.setAmount(seat.chipStack, player.chips);
      chipFactory.setAmount(seat.betStack, player.bet);
      if (seat.nameplate?.userData?.update) {
        const active = state.currentIndex === idx && state.stage === 'player-turns';
        seat.nameplate.userData.update(player.name, Math.round(player.chips), active, player.result || '');
        seat.nameplate.userData.texture.needsUpdate = true;
      }
    });
    chipFactory.setAmount(potStack, state.pot);
  }, [gameState]);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!gameState) return;
    if (gameState.stage === 'round-end') {
      timerRef.current = setTimeout(() => {
        setGameState((prev) => {
          return resetForNextRound(cloneState(prev));
        });
      }, 3000);
      setUiState({ actions: [] });
      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      };
    }
    if (gameState.stage === 'player-turns') {
      const actor = gameState.players[gameState.currentIndex];
      if (!actor) return;
      if (actor.isHuman) {
        setUiState({
          actions: [
            { id: 'hit', label: 'Hit' },
            { id: 'stand', label: 'Stand' }
          ]
        });
      } else {
        setUiState({ actions: [] });
        timerRef.current = setTimeout(() => {
          setGameState((prev) => {
            const next = cloneState(prev);
            const player = next.players[next.currentIndex];
            const decision = aiAction(player.hand);
            applyPlayerAction(next, decision);
            return next;
          });
        }, 900);
      }
    } else if (gameState.stage === 'dealer') {
      setUiState({ actions: [] });
      timerRef.current = setTimeout(() => {
        setGameState((prev) => {
          const next = cloneState(prev);
          resolveRound(next);
          return next;
        });
      }, 600);
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [gameState]);

  const handleAction = (id) => {
    setGameState((prev) => {
      const next = cloneState(prev);
      if (next.stage !== 'player-turns') return next;
      applyPlayerAction(next, id);
      return next;
    });
  };

  const humanPlayer = gameState.players.find((player) => player.isHuman && !player.isDealer);
  const sliderMax = humanPlayer ? Math.max(0, Math.round(humanPlayer.chips)) : 0;
  const baseBetAmount = humanPlayer ? Math.max(20, Math.round(gameState.stake * 0.2)) : 0;
  const minBet = sliderMax > 0 ? Math.min(sliderMax, baseBetAmount || sliderMax) : 0;
  const sliderEnabled = gameState.stage === 'betting' && Boolean(humanPlayer);
  const chipTotal = useMemo(() => chipSelection.reduce((sum, chip) => sum + chip, 0), [chipSelection]);
  const betPreview = sliderEnabled ? Math.min(sliderMax, Math.max(0, chipTotal > 0 ? chipTotal : sliderValue)) : 0;
  const finalBet = sliderEnabled ? Math.min(sliderMax, Math.max(betPreview, minBet)) : 0;
  const sliderDisplayValue = sliderEnabled ? Math.round(Math.min(sliderMax, sliderValue)) : 0;
  const sliderLabel = 'Bet';
  const undoDisabled = !sliderEnabled || chipSelection.length === 0;
  const overlayConfirmDisabled = !sliderEnabled || (sliderMax > 0 && finalBet <= 0);
  const overlayAllInDisabled = !sliderEnabled || sliderMax <= 0;

  const handleChipClick = useCallback(
    (value) => {
      if (!sliderEnabled) return;
      setChipSelection((prev) => {
        const total = prev.reduce((sum, chip) => sum + chip, 0);
        const nextTotal = total + value;
        if (nextTotal > sliderMax) return prev;
        const updated = [...prev, value];
        setSliderValue(Math.min(nextTotal, sliderMax));
        return updated;
      });
    },
    [sliderEnabled, sliderMax]
  );

  const handleUndoChip = useCallback(() => {
    if (!sliderEnabled) return;
    setChipSelection((prev) => {
      if (!prev.length) return prev;
      const updated = prev.slice(0, -1);
      const nextTotal = updated.reduce((sum, chip) => sum + chip, 0);
      setSliderValue(nextTotal > 0 ? Math.min(nextTotal, sliderMax) : minBet);
      return updated;
    });
  }, [sliderEnabled, minBet, sliderMax]);

  const handleAllIn = useCallback(() => {
    if (!sliderEnabled) return;
    setChipSelection([]);
    setSliderValue(sliderMax);
  }, [sliderEnabled, sliderMax]);

  const handleBetConfirm = useCallback(() => {
    if (!sliderEnabled) return;
    const wager = Math.max(0, Math.round(finalBet));
    if (wager <= 0) return;
    setGameState((prev) => {
      const next = cloneState(prev);
      if (next.stage !== 'betting') return next;
      placeInitialBets(next, { humanBet: wager });
      dealInitialCards(next);
      return next;
    });
  }, [sliderEnabled, finalBet]);

  useEffect(() => {
    interactionsRef.current = {
      onChip: (value) => handleChipClick(value),
      onUndo: () => handleUndoChip()
    };
  }, [handleChipClick, handleUndoChip]);

  useEffect(() => {
    const prevStage = previousStageRef.current;
    if (gameState.stage === 'betting' && prevStage !== 'betting') {
      const defaultBet = minBet > 0 ? minBet : 0;
      setChipSelection([]);
      setSliderValue(defaultBet);
    } else if (gameState.stage !== 'betting' && prevStage === 'betting') {
      setChipSelection([]);
      setSliderValue(0);
    }
    previousStageRef.current = gameState.stage;
  }, [gameState.stage, minBet]);

  useEffect(() => {
    if (!sliderEnabled) return;
    setSliderValue((prev) => {
      let next = Math.min(prev, sliderMax);
      if (next < minBet) {
        next = minBet;
      }
      return next;
    });
  }, [sliderEnabled, sliderMax, minBet]);

  useEffect(() => {
    const three = threeRef.current;
    if (!three) return;
    const seat = three.seatGroups?.find((s) => s.isHuman);
    if (!seat?.previewStack) return;
    const amount = sliderEnabled ? Math.round(betPreview) : 0;
    three.chipFactory.setAmount(seat.previewStack, amount, {
      mode: 'scatter',
      layout: seat.tableLayout || CHIP_SCATTER_LAYOUT
    });
    seat.previewStack.visible = amount > 0;
  }, [betPreview, sliderEnabled]);

  useEffect(() => {
    const three = threeRef.current;
    if (!three) return;
    const controls = three.raiseControls;
    if (!controls) return;
    const visible = sliderEnabled && sliderMax > 0;
    controls.group.visible = visible;
    controls.chipButtons.forEach((chip) => {
      chip.visible = visible;
      if (chip.userData?.baseScale) {
        chip.scale.setScalar(chip.userData.baseScale);
      }
    });
    if (!visible && hoverTargetRef.current) {
      if (hoverTargetRef.current.userData?.type === 'chip-button') {
        hoverTargetRef.current.scale.setScalar(hoverTargetRef.current.userData.baseScale);
      }
      hoverTargetRef.current = null;
    }
  }, [sliderEnabled, sliderMax]);

  const dealer = gameState.players[DEALER_INDEX];
  const dealerValue = dealer?.hand?.length ? (dealer.revealed ? handValue(dealer.hand) : '??') : '--';


  return (
    <div className="relative w-full h-full">
      <div ref={mountRef} className="absolute inset-0" />
      <div className="absolute top-4 left-4 z-20 flex flex-col items-start gap-2">
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
          <span className="sr-only">Hap personalizimin e tavolinës</span>
        </button>
        {configOpen && (
          <div className="pointer-events-auto mt-2 w-72 max-w-[80vw] rounded-2xl border border-white/15 bg-black/80 p-4 text-xs text-white shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] uppercase tracking-[0.4em] text-sky-200/80">Table Setup</span>
              <button
                type="button"
                onClick={() => setConfigOpen(false)}
                className="rounded-full p-1 text-white/70 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                aria-label="Mbyll personalizimin"
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
                        key === 'tableShape' && option.id === DIAMOND_SHAPE_ID && effectivePlayerCount > 4;
                      return (
                        <button
                          key={option.id}
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
                          <span className="mt-2 text-center text-[0.65rem] font-semibold text-gray-200">{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-center text-white drop-shadow-lg">
        <p className="text-lg font-semibold">Black Jack Multiplayer</p>
        <p className="text-sm opacity-80">
          Pot: {Math.round(gameState.pot)} {gameState.token} · Dealer: {dealerValue}
        </p>
      </div>
      {gameState.stage === 'round-end' && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-black/60 text-white px-4 py-2 rounded-lg text-sm">
          Round complete
        </div>
      )}
      {sliderEnabled && (
        <div className="pointer-events-auto absolute top-1/2 right-2 z-10 flex -translate-y-1/2 flex-col items-center gap-4 text-white sm:right-6">
          <div className="flex flex-col items-center gap-1 text-center">
            <span className="text-xs uppercase tracking-[0.5em] text-white/60">{sliderLabel}</span>
            <span className="text-2xl font-semibold drop-shadow-md">
              {Math.round(finalBet)} {gameState.token}
            </span>
            {minBet > 0 && (
              <span className="text-[0.7rem] text-white/60">Min {Math.round(minBet)} {gameState.token}</span>
            )}
            <span className="text-[0.7rem] text-white/70">Stack {Math.round(sliderMax)} {gameState.token}</span>
          </div>
          <div className="flex flex-col items-center gap-3">
            <input
              type="range"
              min={0}
              max={Math.round(sliderMax)}
              step={1}
              value={sliderDisplayValue}
              onChange={(event) => {
                const next = Math.max(0, Math.min(sliderMax, Number(event.target.value)));
                setChipSelection([]);
                setSliderValue(next);
              }}
              className="h-64 w-10 cursor-pointer appearance-none bg-transparent"
              style={{ writingMode: 'bt-lr', WebkitAppearance: 'slider-vertical' }}
            />
            <button
              type="button"
              onClick={handleBetConfirm}
              disabled={overlayConfirmDisabled}
              className={`w-full rounded-lg px-4 py-2 text-sm font-semibold uppercase tracking-wide text-white shadow-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${
                overlayConfirmDisabled ? 'bg-blue-900/50 text-white/40 shadow-none' : 'bg-blue-600/90 hover:bg-blue-500'
              }`}
            >
              {sliderLabel}
            </button>
          </div>
        </div>
      )}
      {sliderEnabled && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleUndoChip}
            disabled={undoDisabled}
            className={`px-5 py-2 rounded-lg font-semibold uppercase tracking-wide text-white shadow-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 ${
              undoDisabled ? 'bg-amber-900/40 text-white/40 shadow-none' : 'bg-amber-500/90 hover:bg-amber-400'
            }`}
          >
            Undo
          </button>
          <button
            type="button"
            onClick={handleAllIn}
            disabled={overlayAllInDisabled}
            className={`px-5 py-2 rounded-lg font-semibold uppercase tracking-wide text-white shadow-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 ${
              overlayAllInDisabled ? 'bg-red-900/50 text-white/40 shadow-none' : 'bg-red-600/90 hover:bg-red-500'
            }`}
          >
            All-in
          </button>
        </div>
      )}
      {gameState.stage === 'player-turns' && gameState.players[gameState.currentIndex]?.isHuman && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center justify-center gap-3">
          {uiState.actions.map((action) => (
            <button
              key={action.id}
              onClick={() => handleAction(action.id)}
              className="px-5 py-2 rounded-lg bg-green-600/90 text-white font-semibold shadow-lg"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default BlackJackArena;
