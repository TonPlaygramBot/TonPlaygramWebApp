import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

import { createArenaCarpetMaterial, createArenaWallMaterial } from '../../utils/arenaDecor.js';
import { applyRendererSRGB, applySRGBColorSpace } from '../../utils/colorSpace.js';
import { ARENA_CAMERA_DEFAULTS, buildArenaCameraConfig } from '../../utils/arenaCameraConfig.js';
import { createMurlanStyleTable, applyTableMaterials, TABLE_SHAPE_OPTIONS } from '../../utils/murlanTable.js';
import {
  createCardGeometry,
  createCardMesh,
  orientCard,
  setCardFace,
  CARD_THEMES
} from '../../utils/cards3d.js';
import { createChipFactory } from '../../utils/chips3d.js';
import { FLAG_EMOJIS } from '../../utils/flagEmojis.js';
import { AVATARS } from '../../components/AvatarPickerModal.jsx';
import { getAvatarUrl } from '../../utils/avatarUtils.js';
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
import { getGameVolume, isGameMuted } from '../../utils/sound.js';

import {
  createDeck,
  shuffle,
  dealHoleCards,
  estimateWinProbability,
  bestHand
} from '../../../../lib/texasHoldem.js';
import {
  buildSidePotsFromBets,
  determineWinnersFromHands
} from '../../../../lib/texasHoldemGame.js';

const MODEL_SCALE = 0.75;
const ARENA_GROWTH = 1.45;
const TABLE_RADIUS = 3.4 * MODEL_SCALE;
const BASE_TABLE_HEIGHT = 1.08 * MODEL_SCALE;
const ARENA_SCALE = 1.3 * ARENA_GROWTH;
const BOARD_SIZE = (TABLE_RADIUS * 2 + 1.2 * MODEL_SCALE) * ARENA_SCALE;
const CHAIR_SIZE_SCALE = 1;
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
const TARGET_CHAIR_SIZE = new THREE.Vector3(1.3162499970197679, 1.9173749900311232, 1.7001562547683715).multiplyScalar(
  CHAIR_SIZE_SCALE
);
const TARGET_CHAIR_MIN_Y = -0.8570624993294478 * CHAIR_SIZE_SCALE;
const TARGET_CHAIR_CENTER_Z = -0.1553906416893005 * CHAIR_SIZE_SCALE;
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
const DEFAULT_PLAYER_COUNT = 6;
const MIN_PLAYER_COUNT = 2;
const MAX_PLAYER_COUNT = 6;
const DIAMOND_SHAPE_ID = 'diamondEdge';
// Keep betting units aligned with the 2D classic experience (public/texas-holdem.js uses ANTE = 10).
const CLASSIC_ANTE = 10;
const ANTE = CLASSIC_ANTE;
const COMMUNITY_SPACING = CARD_W * 0.75;
const COMMUNITY_CARD_FORWARD_OFFSET = 0;
const COMMUNITY_CARD_LIFT = CARD_D * 3.2;
const COMMUNITY_CARD_LOOK_LIFT = CARD_H * 0.06;
const COMMUNITY_CARD_TILT = 0;
const COMMUNITY_CARD_POSITIONS = [-2, -1, 0, 1, 2].map((index) =>
  new THREE.Vector3(
    index * COMMUNITY_SPACING,
    TABLE_HEIGHT + CARD_SURFACE_OFFSET + COMMUNITY_CARD_LIFT,
    COMMUNITY_CARD_FORWARD_OFFSET
  )
);
const HOLE_SPACING = CARD_W * 0.65;
const HUMAN_CARD_SPREAD = HOLE_SPACING * 1.32;
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
const HUMAN_CARD_SCALE = 1;
const COMMUNITY_CARD_SCALE = 1;
const HUMAN_CHIP_SCALE = 1;
const TURN_TOKEN_RADIUS = 0.14 * MODEL_SCALE;
const TURN_TOKEN_HEIGHT = 0.05 * MODEL_SCALE;
const TURN_TOKEN_FORWARD_OFFSET = 0.18 * MODEL_SCALE;
const TURN_TOKEN_LIFT = 0.08 * MODEL_SCALE;

const CHIP_VALUES = [1000, 500, 100, 50, 20, 10, 5, 2, 1];
const WORLD_UP = new THREE.Vector3(0, 1, 0);

const CHAIR_COLOR_OPTIONS = Object.freeze([
  { id: 'ruby', label: 'Ruby', primary: '#8b0000', accent: '#8b0000', highlight: '#b22222', legColor: '#1f1f1f' },
  { id: 'slate', label: 'Slate', primary: '#374151', accent: '#374151', highlight: '#6b7280', legColor: '#0f172a' },
  { id: 'teal', label: 'Teal', primary: '#0f766e', accent: '#0f766e', highlight: '#38b2ac', legColor: '#082f2a' },
  { id: 'amber', label: 'Amber', primary: '#b45309', accent: '#b45309', highlight: '#f59e0b', legColor: '#2f2410' },
  { id: 'violet', label: 'Violet', primary: '#7c3aed', accent: '#7c3aed', highlight: '#c084fc', legColor: '#2b1059' },
  { id: 'frost', label: 'Ice', primary: '#1f2937', accent: '#1f2937', highlight: '#9ca3af', legColor: '#0f172a' }
]);

const CHAIR_MODEL_URLS = [
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/AntiqueChair/glTF-Binary/AntiqueChair.glb',
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/SheenChair/glTF-Binary/SheenChair.glb',
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/AntiqueChair/glTF-Binary/AntiqueChair.glb'
];

const DEFAULT_STOOL_THEME = Object.freeze({ legColor: '#1f1f1f' });
const LABEL_SIZE = Object.freeze({ width: 1.24 * MODEL_SCALE, height: 0.58 * MODEL_SCALE });
const LABEL_BASE_HEIGHT = SEAT_THICKNESS + 0.32 * MODEL_SCALE;
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

const CHIP_RAIL_LAYOUT = Object.freeze({
  perRow: 4,
  spacing: CARD_W * 0.48,
  rowSpacing: CARD_W * 0.34,
  jitter: CARD_W * 0.06,
  lift: 0
});

const SHOWDOWN_RESET_DELAY = 6500;
const CARD_HIGHLIGHT_COLOR = '#facc15';
const CARD_HIGHLIGHT = new THREE.Color(CARD_HIGHLIGHT_COLOR);
const CARD_EMISSIVE_OFF = new THREE.Color(0x000000);

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
const CAMERA_AUTO_YAW_SMOOTHING = 0.085;

const CHAIR_CLOTH_TEXTURE_SIZE = 512;
const CHAIR_CLOTH_REPEAT = 7;
const ARENA_WALL_HEIGHT = 3.6 * 1.3;
const ARENA_WALL_CENTER_Y = ARENA_WALL_HEIGHT / 2;
const ARENA_WALL_TOP_Y = ARENA_WALL_CENTER_Y + ARENA_WALL_HEIGHT / 2;
const ARENA_WALL_INNER_RADIUS = TABLE_RADIUS * ARENA_GROWTH * 2.4;
const DEFAULT_PITCH_LIMITS = Object.freeze({ min: -CAMERA_HEAD_PITCH_UP, max: CAMERA_HEAD_PITCH_DOWN });
const HUMAN_SEAT_ROTATION_OFFSET = Math.PI / 8;

const STAGE_SEQUENCE = ['preflop', 'flop', 'turn', 'river'];

function cardKey(card) {
  if (!card || typeof card !== 'object') return '';
  return `${card.rank ?? ''}${card.suit ?? ''}`;
}

function setCardHighlight(mesh, highlighted) {
  if (!mesh?.userData) return;
  const desired = Boolean(highlighted);
  const current = Boolean(mesh.userData.isHighlighted);
  if (desired === current) {
    return;
  }
  const { frontMaterial, backMaterial, edgeMaterials } = mesh.userData;
  if (desired) {
    if (frontMaterial) {
      frontMaterial.emissive.copy(CARD_HIGHLIGHT);
      frontMaterial.emissiveIntensity = 0.65;
    }
    if (backMaterial) {
      backMaterial.emissive.copy(CARD_HIGHLIGHT);
      backMaterial.emissiveIntensity = 0.35;
    }
    if (Array.isArray(edgeMaterials)) {
      edgeMaterials.forEach((material) => {
        if (!material) return;
        material.emissive.copy(CARD_HIGHLIGHT);
        material.emissiveIntensity = 0.4;
      });
    }
    mesh.userData.isHighlighted = true;
  } else {
    if (frontMaterial) {
      frontMaterial.emissive.copy(CARD_EMISSIVE_OFF);
      frontMaterial.emissiveIntensity = 0;
    }
    if (backMaterial) {
      backMaterial.emissive.copy(CARD_EMISSIVE_OFF);
      backMaterial.emissiveIntensity = 0;
    }
    if (Array.isArray(edgeMaterials)) {
      edgeMaterials.forEach((material) => {
        if (!material) return;
        material.emissive.copy(CARD_EMISSIVE_OFF);
        material.emissiveIntensity = 0;
      });
    }
    mesh.userData.isHighlighted = false;
  }
}

const APPEARANCE_STORAGE_KEY = 'texasHoldemArenaAppearance';
const DEFAULT_APPEARANCE = {
  ...DEFAULT_TABLE_CUSTOMIZATION,
  chairColor: 0,
  tableShape: 0
};

const CUSTOMIZATION_SECTIONS = [
  { key: 'tableWood', label: 'Table Wood', options: TABLE_WOOD_OPTIONS },
  { key: 'tableCloth', label: 'Table Cloth', options: TABLE_CLOTH_OPTIONS },
  { key: 'chairColor', label: 'Chair Color', options: CHAIR_COLOR_OPTIONS },
  { key: 'tableShape', label: 'Table Shape', options: TABLE_SHAPE_OPTIONS },
  { key: 'cards', label: 'Cards', options: CARD_THEMES }
];

const NON_DIAMOND_SHAPE_INDEX = (() => {
  const index = TABLE_SHAPE_OPTIONS.findIndex((option) => option.id !== DIAMOND_SHAPE_ID);
  return index >= 0 ? index : 0;
})();

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

const REGION_NAMES = typeof Intl !== 'undefined' ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;

function flagToName(flag) {
  if (!flag || !REGION_NAMES) return 'Guest';
  const points = Array.from(flag, (c) => c.codePointAt(0) - 0x1f1e6 + 65);
  if (points.length !== 2) return 'Guest';
  const code = String.fromCharCode(points[0], points[1]);
  return REGION_NAMES.of(code) || 'Guest';
}

function clampPlayerCount(value) {
  if (!Number.isFinite(value)) {
    return DEFAULT_PLAYER_COUNT;
  }
  return Math.min(Math.max(MIN_PLAYER_COUNT, Math.round(value)), MAX_PLAYER_COUNT);
}

function parseSearch(search) {
  const params = new URLSearchParams(search);
  const username = params.get('username') || 'You';
  const avatar = params.get('avatar') || '';
  const amount = Number.parseInt(params.get('amount') || '1000', 10);
  const token = params.get('token') || 'TPC';
  const stake = Number.isFinite(amount) && amount > 0 ? amount : 1000;
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
  const { username, stake } = options;
  const playerCount = clampPlayerCount(options?.playerCount);
  const baseChips = Math.max(400, Math.round(stake));
  const preferredFlags = Array.isArray(options.flags) ? options.flags.filter(Boolean) : [];
  const shuffledFlags = [...FLAG_EMOJIS].sort(() => 0.5 - Math.random());
  const fallbackFlags = preferredFlags.length ? [...shuffledFlags] : [...shuffledFlags];
  const flags = preferredFlags.length ? [...preferredFlags] : [...shuffledFlags];
  const nextFlag = () => flags.shift() || fallbackFlags.shift() || FLAG_EMOJIS[(flags.length + 5) % FLAG_EMOJIS.length];
  const shuffledAvatars = [...AVATARS].sort(() => 0.5 - Math.random());
  const fallbackAvatar = '/assets/icons/profile.svg';
  const nextAvatar = () => getAvatarUrl(shuffledAvatars.shift()) || fallbackAvatar;
  const humanAvatar = getAvatarUrl(options.avatar) || nextAvatar();
  const humanFlag = nextFlag() || '🇦🇱';
  const players = [
    {
      id: 'player-0',
      name: username,
      flag: humanFlag,
      isHuman: true,
      chips: baseChips,
      avatar: humanAvatar
    }
  ];
  for (let i = 0; i < Math.max(0, playerCount - 1); i += 1) {
    const flag = nextFlag() || FLAG_EMOJIS[(i * 17) % FLAG_EMOJIS.length];
    players.push({
      id: `ai-${i}`,
      name: flagToName(flag),
      flag,
      isHuman: false,
      chips: baseChips,
      avatar: nextAvatar()
    });
  }
  return players.slice(0, playerCount);
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
  // Skip the two slots that sit immediately to the human player's left and right
  // so opponents remain on the flat edges in front of the user.
  const preferredSlots = [0, 2, 3, 4, 5, 6];
  const angles = [];
  for (let i = 0; i < safeCount; i += 1) {
    const slotIndex = preferredSlots[i];
    if (slotIndex == null) {
      const fallbackAngle =
        Math.PI / 2 - HUMAN_SEAT_ROTATION_OFFSET - (i / safeCount) * Math.PI * 2;
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

async function loadGltfChair() {
  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
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

function createProceduralChair(theme, renderer) {
  const chairMaterial = createChairFabricMaterial(theme, renderer);
  const legMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(theme?.legColor ?? DEFAULT_STOOL_THEME.legColor),
    metalness: 0.42,
    roughness: 0.38
  });

  const chair = new THREE.Group();

  const seatMesh = new THREE.Mesh(new THREE.BoxGeometry(SEAT_WIDTH, SEAT_THICKNESS, SEAT_DEPTH), chairMaterial);
  seatMesh.position.y = SEAT_THICKNESS / 2;
  seatMesh.castShadow = true;
  seatMesh.receiveShadow = true;
  chair.add(seatMesh);

  const backMesh = new THREE.Mesh(new THREE.BoxGeometry(SEAT_WIDTH * 0.98, BACK_HEIGHT, BACK_THICKNESS), chairMaterial);
  backMesh.position.set(0, SEAT_THICKNESS / 2 + BACK_HEIGHT / 2, -SEAT_DEPTH / 2 + BACK_THICKNESS / 2);
  backMesh.castShadow = true;
  backMesh.receiveShadow = true;
  chair.add(backMesh);

  const armLeft = createStraightArmrest('left', chairMaterial);
  const armRight = createStraightArmrest('right', chairMaterial);
  chair.add(armLeft.group);
  chair.add(armRight.group);

  const legBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16 * MODEL_SCALE * STOOL_SCALE, 0.2 * MODEL_SCALE * STOOL_SCALE, BASE_COLUMN_HEIGHT, 18),
    legMaterial
  );
  legBase.position.y = -SEAT_THICKNESS / 2 - BASE_COLUMN_HEIGHT / 2;
  legBase.castShadow = true;
  legBase.receiveShadow = true;
  chair.add(legBase);

  const foot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32 * MODEL_SCALE * STOOL_SCALE, 0.32 * MODEL_SCALE * STOOL_SCALE, 0.08 * MODEL_SCALE, 24),
    legMaterial
  );
  foot.position.y = legBase.position.y - BASE_COLUMN_HEIGHT / 2 - 0.04 * MODEL_SCALE;
  foot.castShadow = true;
  foot.receiveShadow = true;
  chair.add(foot);

  return {
    chairTemplate: chair,
    materials: {
      seat: chairMaterial,
      leg: legMaterial,
      upholstery: [chairMaterial],
      metal: [legMaterial]
    }
  };
}

async function buildChairTemplate(theme, renderer) {
  try {
    const gltfChair = await loadGltfChair();
    applyChairThemeMaterials({ chairMaterials: gltfChair.materials }, theme);
    return gltfChair;
  } catch (error) {
    console.error('Falling back to procedural chair', error);
  }
  return createProceduralChair(theme, renderer);
}

function applyChairThemeMaterials(target, theme, renderer) {
  const mats = target?.chairMaterials;
  if (!mats) return;
  const seatColor = theme?.primary ?? '#7c3aed';
  const legColor = theme?.legColor ?? DEFAULT_STOOL_THEME.legColor;
  if (mats.seat) {
    if (mats.seat.userData?.clothTexture && renderer) {
      const next = createChairFabricMaterial(theme, renderer);
      Object.assign(mats, { seat: next });
      (mats.upholstery ?? []).forEach((mat, idx) => {
        if (idx === 0) {
          mats.upholstery[idx] = next;
        }
      });
    } else if (mats.seat.color) {
      mats.seat.color.set(seatColor);
      mats.seat.needsUpdate = true;
    }
    mats.seat.userData = { ...(mats.seat.userData || {}), chairId: theme?.id ?? 'default' };
  }
  if (mats.leg?.color) {
    mats.leg.color.set(legColor);
    mats.leg.needsUpdate = true;
    mats.leg.userData = { ...(mats.leg.userData || {}), chairId: theme?.id ?? 'default' };
  }
  (mats.upholstery ?? []).forEach((mat) => {
    if (mat?.color) {
      mat.color.set(seatColor);
      mat.needsUpdate = true;
    }
  });
  (mats.metal ?? []).forEach((mat) => {
    if (mat?.color) {
      mat.color.set(legColor);
      mat.needsUpdate = true;
    }
  });
}

function disposeChairMaterials(materials) {
  if (!materials) return;
  const disposeList = [materials.seat, materials.leg, ...(materials.upholstery ?? []), ...(materials.metal ?? [])];
  disposeList.forEach((mat) => {
    if (!mat) return;
    try {
      if (Array.isArray(mat)) {
        mat.forEach((m) => m?.dispose?.());
      } else {
        mat.dispose?.();
      }
    } catch (error) {
      console.warn('Failed disposing chair material', error);
    }
  });
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
      isHuman
    });
  }
  return layout;
}

function computeCommunitySlotPosition(index, options = {}) {
  const rotationY = options.rotationY ?? 0;
  const surfaceY = options.surfaceY ?? TABLE_HEIGHT;
  const base = new THREE.Vector3(0, surfaceY + CARD_SURFACE_OFFSET + COMMUNITY_CARD_LIFT, COMMUNITY_CARD_FORWARD_OFFSET);
  const offset = new THREE.Vector3((index - 2) * COMMUNITY_SPACING, 0, 0);
  if (rotationY) {
    base.applyAxisAngle(WORLD_UP, rotationY);
    offset.applyAxisAngle(WORLD_UP, rotationY);
  }
  return base.add(offset);
}

function makeNameplate(name, chips, renderer, avatar) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const fallbackAvatar = '/assets/icons/profile.svg';
  let avatarSrc = getAvatarUrl(avatar) || fallbackAvatar;
  const avatarImg = new Image();
  avatarImg.crossOrigin = 'anonymous';
  let avatarReady = false;
  let lastName = name;
  let lastStack = chips;
  let lastHighlight = false;
  let lastStatus = '';
  const draw = (playerName, stack, highlight, status, nextAvatar) => {
    const normalizedAvatar = getAvatarUrl(nextAvatar) || fallbackAvatar;
    if (nextAvatar && normalizedAvatar !== avatarSrc) {
      avatarSrc = normalizedAvatar;
      avatarReady = false;
      avatarImg.src = avatarSrc;
    }
    lastName = playerName;
    lastStack = stack;
    lastHighlight = highlight;
    lastStatus = status;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const panelRadius = 44;
    const panelX = 12;
    const panelY = 18;
    const panelW = canvas.width - panelX * 2;
    const panelH = canvas.height - panelY * 2;
    const panelGradient = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
    panelGradient.addColorStop(0, 'rgba(10,14,24,0.9)');
    panelGradient.addColorStop(1, 'rgba(7,10,18,0.75)');
    ctx.fillStyle = panelGradient;
    ctx.strokeStyle = highlight ? 'rgba(96,165,250,0.75)' : 'rgba(255,215,0,0.38)';
    ctx.lineWidth = 10;
    roundRect(ctx, panelX, panelY, panelW, panelH, panelRadius);
    ctx.fill();
    ctx.stroke();

    const avatarSize = 148;
    const avatarX = panelX + 20;
    const avatarY = panelY + (panelH - avatarSize) / 2;
    const ringGradient = ctx.createLinearGradient(avatarX, avatarY, avatarX + avatarSize, avatarY + avatarSize);
    ringGradient.addColorStop(0, 'rgba(255,215,0,0.65)');
    ringGradient.addColorStop(1, 'rgba(255,255,255,0.5)');
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.09)';
    ctx.fill();
    ctx.lineWidth = highlight ? 10 : 8;
    ctx.strokeStyle = ringGradient;
    ctx.stroke();
    if (avatarReady) {
      ctx.save();
      ctx.clip();
      ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
      ctx.restore();
    }
    ctx.restore();
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 68px "Inter", system-ui, sans-serif';
    ctx.textBaseline = 'top';
    const textX = avatarX + avatarSize + 32;
    const textY = panelY + 32;
    ctx.fillText(playerName, textX, textY);
    ctx.font = '600 54px "Inter", system-ui, sans-serif';
    ctx.fillStyle = '#f7e7a4';
    ctx.fillText(`${stack} chips`, textX, textY + 86);
    if (status) {
      ctx.font = '600 44px "Inter", system-ui, sans-serif';
      ctx.fillStyle = '#c7d2fe';
      ctx.fillText(status, textX, textY + 150);
    }
  };
  draw(name, chips, false, '');
  avatarImg.onload = () => {
    avatarReady = true;
    draw(lastName, lastStack, lastHighlight, lastStatus, avatarSrc);
    texture.needsUpdate = true;
  };
  avatarImg.onerror = () => {
    if (avatarSrc !== fallbackAvatar) {
      avatarSrc = fallbackAvatar;
      avatarReady = false;
      avatarImg.src = fallbackAvatar;
      return;
    }
    avatarReady = true;
    draw(lastName, lastStack, lastHighlight, lastStatus, avatarSrc);
    texture.needsUpdate = true;
  };
  avatarImg.src = avatarSrc;
  const texture = new THREE.CanvasTexture(canvas);
  applySRGBColorSpace(texture);
  texture.anisotropy = renderer?.capabilities?.getMaxAnisotropy?.() ?? 4;
  texture.needsUpdate = true;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
    toneMapped: false,
    depthWrite: false
  });
  const geometry = new THREE.PlaneGeometry(LABEL_SIZE.width, LABEL_SIZE.height);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.update = draw;
  mesh.userData.texture = texture;
  mesh.userData.canvas = canvas;
  mesh.userData.dispose = () => {
    texture.dispose();
    material.dispose();
    geometry.dispose();
  };
  return mesh;
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

function createRailTextSprite(initialLines = [], options = {}) {
  const { width = 1.9 * MODEL_SCALE, height = 0.68 * MODEL_SCALE } = options;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const draw = (lines) => {
    const content = Array.isArray(lines) ? lines : [String(lines ?? '')];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(15,23,42,0.82)';
    ctx.strokeStyle = 'rgba(148,163,184,0.4)';
    ctx.lineWidth = 14;
    roundRect(ctx, 32, 32, canvas.width - 64, canvas.height - 64, 56);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e2e8f0';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const baseY = canvas.height / 2;
    const lineHeight = 96;
    const startY = baseY - ((content.length - 1) * lineHeight) / 2;
    content.forEach((line, idx) => {
      ctx.font = idx === 0 ? '700 92px "Inter", system-ui, sans-serif' : '600 76px "Inter", system-ui, sans-serif';
      ctx.fillText(line, canvas.width / 2, startY + idx * lineHeight);
    });
  };
  draw(initialLines);
  const texture = new THREE.CanvasTexture(canvas);
  applySRGBColorSpace(texture);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(width, height, 1);
  sprite.center.set(0.5, 0);
  sprite.userData.update = (lines) => {
    draw(lines);
    texture.needsUpdate = true;
  };
  sprite.userData.dispose = () => {
    texture.dispose();
  };
  sprite.userData.canvas = canvas;
  sprite.userData.texture = texture;
  return sprite;
}

function createRaiseControls({ arena, seat, chipFactory, tableInfo }) {
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

  return {
    group,
    chipButtons,
    interactables,
    dispose
  };
}

function applyCardToMesh(mesh, card, geometry, cache, theme) {
  if (!mesh) return;
  const target = card || mesh.userData?.card;
  if (!target) return;
  const previousCard = mesh.userData?.card;
  const previousTheme = mesh.userData?.cardThemeId;
  const nextTheme = theme || CARD_THEMES[0];
  const sameCard =
    previousCard && previousCard.rank === target.rank && previousCard.suit === target.suit && previousTheme === nextTheme.id;
  if (sameCard) {
    mesh.userData.card = target;
    mesh.userData.cardThemeId = nextTheme.id;
    return;
  }
  const fresh = createCardMesh(target, geometry, cache, nextTheme);
  const existing = mesh.material;
  if (Array.isArray(existing)) {
    existing.forEach((mat) => mat?.dispose?.());
  } else {
    existing?.dispose?.();
  }
  mesh.material = fresh.material;
  const currentFace = mesh.userData?.cardFace || 'front';
  mesh.userData = { ...mesh.userData, ...fresh.userData, card: target, cardThemeId: nextTheme.id, cardFace: currentFace };
  setCardFace(mesh, currentFace);
}

function buildInitialState(players, token, stake) {
  return {
    players: players.map((p, index) => ({
      ...p,
      seatIndex: index,
      hand: [],
      bet: 0,
      totalBet: 0,
      folded: false,
      allIn: false,
      actedInRound: false,
      status: '',
      winnings: 0,
      winningCards: []
    })),
    token,
    stake,
    pot: 0,
    deck: [],
    community: [],
    stage: 'preflop',
    dealerIndex: players.length - 1,
    actionIndex: 0,
    currentBet: 0,
    minRaise: ANTE,
    winners: [],
    awaitingInput: false,
    handId: 0,
    showdown: false,
    winningCommunityCards: [],
    winnerFocusIndex: null
  };
}

function resetForNextHand(state) {
  const next = { ...state, handId: state.handId + 1 };
  next.deck = shuffle(createDeck());
  next.community = [];
  next.stage = 'preflop';
  next.winners = [];
  next.showdown = false;
  next.pot = 0;
  next.currentBet = 0;
  next.minRaise = ANTE;
  next.dealerIndex = (state.dealerIndex + 1) % state.players.length;
  next.winningCommunityCards = [];
  next.winnerFocusIndex = null;
  next.players = state.players.map((p, idx) => ({
    ...p,
    seatIndex: p.seatIndex ?? idx,
    bet: 0,
    totalBet: 0,
    hand: [],
    folded: p.chips <= 0,
    allIn: p.chips <= 0,
    actedInRound: false,
    status: p.chips <= 0 ? 'Out' : '',
    winnings: 0,
    winningCards: []
  }));
  const active = next.players.filter((p) => p.chips > 0);
  if (active.length < 2) {
    return next;
  }
  collectAntes(next);
  dealHoleCardsToState(next);
  prepareNextAction(next, true);
  return next;
}

function dealHoleCardsToState(state) {
  const { hands, deck } = dealHoleCards(state.deck, state.players.length);
  state.deck = deck;
  state.players.forEach((player, idx) => {
    player.hand = hands[idx];
    player.folded = player.chips <= 0;
    player.allIn = player.chips <= 0;
    player.status = player.folded ? 'Out' : '';
  });
}

function collectAntes(state) {
  const ante = Math.max(0, ANTE);
  state.players.forEach((player) => {
    if (player.chips <= 0 || player.folded || player.allIn) return;
    const paid = payChips(player, Math.min(ante, player.chips), state);
    player.totalBet = (player.totalBet ?? 0) + paid;
    player.bet = 0;
    if (paid > 0) {
      player.status = `Ante ${paid}`;
    }
  });
  state.currentBet = 0;
  state.minRaise = ante;
  state.actionIndex = getNextActiveIndex(state.players, state.dealerIndex);
  resetActedFlags(state);
}

function payChips(player, amount, state) {
  if (amount <= 0) return 0;
  const spend = Math.min(amount, player.chips);
  player.chips -= spend;
  state.pot += spend;
  if (player.chips <= 0) {
    player.chips = 0;
    player.allIn = true;
  }
  return spend;
}

function getNextActiveIndex(players, startIndex) {
  if (!players.length) return 0;
  for (let offset = 1; offset <= players.length; offset += 1) {
    const idx = (startIndex + offset) % players.length;
    const p = players[idx];
    if (!p) continue;
    if (!p.folded && p.chips > 0 && !p.allIn) {
      return idx;
    }
  }
  return players.findIndex((p) => !p.folded) ?? 0;
}

function resetActedFlags(state) {
  state.players.forEach((p) => {
    p.actedInRound = p.folded || p.allIn;
  });
}

function allActiveMatched(state) {
  const active = state.players.filter((p) => !p.folded && !p.allIn);
  if (!active.length) return true;
  return active.every((p) => p.actedInRound && p.bet === state.currentBet);
}

function advanceStage(state) {
  if (state.stage === 'river') {
    goToShowdown(state);
    return;
  }
  const stageIndex = STAGE_SEQUENCE.indexOf(state.stage);
  const nextStage = STAGE_SEQUENCE[stageIndex + 1];
  state.stage = nextStage;
  if (nextStage === 'flop') {
    state.deck.pop();
    const cardA = state.deck.pop();
    const cardB = state.deck.pop();
    const cardC = state.deck.pop();
    state.community = [cardA, cardB, cardC];
  } else if (nextStage === 'turn' || nextStage === 'river') {
    state.deck.pop();
    state.community = [...state.community, state.deck.pop()];
  }
  state.players.forEach((p) => {
    p.bet = 0;
    p.actedInRound = p.folded || p.allIn;
    if (!p.folded && !p.allIn) {
      p.status = '';
    }
  });
  state.currentBet = 0;
  state.minRaise = ANTE;
  state.actionIndex = getNextActiveIndex(state.players, state.dealerIndex);
  prepareNextAction(state, false);
}

function goToShowdown(state) {
  while (state.community.length < 5 && state.deck.length) {
    if (state.community.length === 3 || state.community.length === 4) {
      state.deck.pop();
    }
    state.community.push(state.deck.pop());
  }
  const pots = buildSidePotsFromBets(state.players);
  const results = [];
  const communityWinning = new Set();
  state.players.forEach((player) => {
    player.winnings = 0;
    player.winningCards = [];
    player.bet = 0;
  });
  const communityKeys = new Set(state.community.map((card) => cardKey(card)));
  let focusIndex = null;
  pots.forEach((pot) => {
    const eligible = pot.players.filter((idx) => !state.players[idx].folded);
    if (!eligible.length) return;
    const winnerIndices = determineWinnersFromHands(state.players, state.community, eligible);
    if (!winnerIndices.length) return;
    const baseShare = Math.floor(pot.amount / winnerIndices.length);
    let remainder = pot.amount - baseShare * winnerIndices.length;
    const potWinners = winnerIndices.map((idx, position) => {
      const player = state.players[idx];
      const share = baseShare + (position < remainder ? 1 : 0);
      if (share > 0) {
        player.chips += share;
        player.winnings = (player.winnings ?? 0) + share;
        player.status = `Win ${Math.round(player.winnings)}`;
      }
      const best = bestHand([...(player.hand ?? []), ...state.community]);
      const bestCards = Array.isArray(best?.cards) ? best.cards : [];
      const bestKeys = new Set(bestCards.map((card) => cardKey(card)));
      const holeKeys = (player.hand ?? [])
        .map((card) => cardKey(card))
        .filter((key) => bestKeys.has(key));
      const existing = new Set(player.winningCards ?? []);
      holeKeys.forEach((key) => existing.add(key));
      player.winningCards = Array.from(existing);
      bestCards.forEach((card) => {
        const key = cardKey(card);
        if (communityKeys.has(key)) {
          communityWinning.add(key);
        }
      });
      if (focusIndex == null) {
        focusIndex = idx;
      }
      return {
        index: idx,
        share,
        cards: bestCards.map((card) => ({ ...card }))
      };
    });
    results.push({ amount: pot.amount, winners: potWinners });
  });
  state.pot = 0;
  state.winners = results;
  state.winningCommunityCards = Array.from(communityWinning);
  state.winnerFocusIndex = focusIndex;
  state.stage = 'showdown';
  state.showdown = true;
  state.awaitingInput = false;
}

function prepareNextAction(state, isNewHand) {
  const activePlayers = state.players.filter((p) => !p.folded);
  if (activePlayers.length <= 1) {
    goToShowdown(state);
    return;
  }
  const actor = state.players[state.actionIndex];
  if (!actor || actor.folded || actor.allIn || actor.chips <= 0) {
    const nextIndex = getNextActiveIndex(state.players, state.actionIndex);
    if (nextIndex === state.actionIndex) {
      if (allActiveMatched(state)) {
        advanceStage(state);
      }
    } else {
      state.actionIndex = nextIndex;
      prepareNextAction(state, false);
    }
    return;
  }
  state.awaitingInput = actor.isHuman;
  if (!actor.isHuman) {
    actor.status = actor.status || 'Thinking';
  }
  if (isNewHand && actor.isHuman && state.stage === 'preflop') {
    actor.status = 'Your move';
  }
}

function performPlayerAction(state, action, raiseSize = ANTE) {
  const player = state.players[state.actionIndex];
  if (!player || player.folded || player.allIn) return;
  const toCall = Math.max(0, state.currentBet - player.bet);
  let advanced = false;
  if (action === 'fold') {
    player.folded = true;
    player.status = 'Fold';
    player.actedInRound = true;
    advanced = true;
  } else if (action === 'check') {
    if (toCall === 0) {
      player.status = 'Check';
      player.actedInRound = true;
      advanced = true;
    } else {
      return;
    }
  } else if (action === 'call') {
    const amount = Math.min(toCall, player.chips);
    if (amount <= 0 && toCall > 0) {
      player.status = 'Check';
      player.actedInRound = true;
      advanced = true;
    } else {
      const paid = payChips(player, amount, state);
      player.bet += paid;
      player.totalBet += paid;
      player.status = paid === toCall ? 'Call' : 'All-in';
      player.actedInRound = true;
      if (player.chips === 0) {
        player.allIn = true;
      }
      advanced = true;
    }
  } else if (action === 'bet' || action === 'raise') {
    let amount = Math.max(state.minRaise, raiseSize);
    if (action === 'raise') {
      amount += toCall;
    }
    let spend = Math.min(player.chips, amount);
    if (action === 'raise') {
      spend = Math.min(player.chips, toCall + Math.max(state.minRaise, raiseSize));
    }
    if (spend <= 0) {
      return;
    }
    const paid = payChips(player, spend, state);
    player.bet += paid;
    player.totalBet += paid;
    state.currentBet = Math.max(state.currentBet, player.bet);
    state.minRaise = Math.max(state.minRaise, paid - toCall);
    player.status = player.chips === 0 ? 'All-in' : action === 'bet' ? 'Bet' : 'Raise';
    player.actedInRound = true;
    state.players.forEach((p, idx) => {
      if (idx !== player.seatIndex && !p.folded && !p.allIn) {
        p.actedInRound = false;
      }
    });
    advanced = true;
  }
  if (!advanced) return;
  if (allActiveMatched(state)) {
    advanceStage(state);
    return;
  }
  const nextIndex = getNextActiveIndex(state.players, state.actionIndex);
  if (nextIndex === state.actionIndex || nextIndex < 0) {
    if (allActiveMatched(state)) {
      advanceStage(state);
      return;
    }
  }
  state.actionIndex = nextIndex;
  prepareNextAction(state, false);
}

function performAiAction(state) {
  const player = state.players[state.actionIndex];
  if (!player || player.isHuman || player.folded || player.allIn) return;
  const toCall = Math.max(0, state.currentBet - player.bet);
  const community = state.community;
  const opponents = state.players.filter((p) => p !== player && !p.folded).length;
  const winRate = estimateWinProbability(player.hand, community, Math.max(1, opponents - 1), 80);
  let action = 'check';
  let raiseSize = state.minRaise;
  if (toCall > 0) {
    if (winRate < 0.28) {
      action = 'fold';
    } else if (winRate < 0.45) {
      action = 'call';
    } else {
      action = 'raise';
      raiseSize = Math.min(player.chips, Math.round(state.minRaise * (0.75 + winRate)));
    }
  } else {
    if (winRate > 0.55 && player.chips > state.minRaise) {
      action = 'bet';
      raiseSize = Math.min(player.chips, Math.round(state.minRaise * (0.5 + winRate)));
    } else {
      action = 'check';
    }
  }
  performPlayerAction(state, action, raiseSize);
}

function cloneState(state) {
  return {
    ...state,
    players: state.players.map((p) => ({ ...p }))
  };
}

function TexasHoldemArena({ search }) {
  const mountRef = useRef(null);
  const threeRef = useRef(null);
  const animationRef = useRef(null);
  const headAnglesRef = useRef({ yaw: 0, pitch: 0 });
  const humanSeatRef = useRef(null);
  const seatTopPointRef = useRef(null);
  const viewControlsRef = useRef({ applySeatedCamera: null, applyOverheadCamera: null });
  const lastViewRef = useRef(false);
  const cameraBasisRef = useRef({
    position: new THREE.Vector3(),
    baseForward: new THREE.Vector3(0, 0, -1),
    baseUp: new THREE.Vector3(0, 1, 0),
    baseRight: new THREE.Vector3(1, 0, 0),
    pitchLimits: DEFAULT_PITCH_LIMITS
  });
  const pointerStateRef = useRef({
    active: false,
    pointerId: null,
    mode: null,
    startX: 0,
    startY: 0,
    startYaw: 0,
    startPitch: 0,
    buttonAction: null,
    dragged: false
  });
  const cameraAutoTargetRef = useRef({ yaw: 0, activeIndex: null });
  const pointerVectorRef = useRef(new THREE.Vector2());
  const interactionsRef = useRef({
    onChip: () => {},
    onSliderChange: () => {},
    onAllIn: () => {},
    onConfirm: () => {},
    onUndo: () => {}
  });
  const hoverTargetRef = useRef(null);
  const searchOptions = useMemo(() => parseSearch(search), [search]);
  const effectivePlayerCount = clampPlayerCount(searchOptions.playerCount);
  const [gameState, setGameState] = useState(() => {
    const players = buildPlayers(searchOptions);
    const baseState = buildInitialState(players, searchOptions.token, searchOptions.stake);
    return resetForNextHand(baseState);
  });
  const gameStateRef = useRef(null);
  const prevStateRef = useRef(null);
  const [uiState, setUiState] = useState({
    availableActions: [],
    toCall: 0,
    canRaise: false,
    maxRaise: 0,
    minRaise: 0
  });
  const [chipSelection, setChipSelection] = useState([]);
  const [sliderValue, setSliderValue] = useState(0);
  const overheadView = false;
  const [appearance, setAppearance] = useState(() => {
    if (typeof window === 'undefined') return { ...DEFAULT_APPEARANCE };
    try {
      const stored = window.localStorage?.getItem(APPEARANCE_STORAGE_KEY);
      if (!stored) return { ...DEFAULT_APPEARANCE };
      const parsed = JSON.parse(stored);
      return normalizeAppearance(parsed);
    } catch (error) {
      console.warn('Failed to load Texas Hold\'em appearance', error);
      return { ...DEFAULT_APPEARANCE };
    }
  });
  const appearanceRef = useRef(appearance);
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
  }, [effectivePlayerCount, appearance.tableShape]);
  const [configOpen, setConfigOpen] = useState(false);
  const timerRef = useRef(null);
  const soundsRef = useRef({});
  const potDisplayRef = useRef(0);
  const potTargetRef = useRef(0);
  const lastFrameRef = useRef(null);
  const showdownAnimationRef = useRef({
    handId: null,
    active: false,
    pendingValue: 0,
    seatPending: {},
    startingChips: {}
  });
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    const activeIndex = cameraAutoTargetRef.current?.activeIndex;
    if (typeof activeIndex !== 'number') {
      return;
    }
    const player = gameState?.players?.[activeIndex];
    if (!player || player.folded || player.chips <= 0) {
      cameraAutoTargetRef.current = {
        yaw: headAnglesRef.current.yaw,
        activeIndex: null
      };
    }
  }, [gameState]);

  const playSound = useCallback((name) => {
    const audio = soundsRef.current?.[name];
    if (!audio || isGameMuted()) return;
    if (name === 'knock') {
      audio.currentTime = Math.min(audio.duration || 1, 1);
    } else {
      audio.currentTime = 0;
    }
    audio.volume = getGameVolume();
    audio.play().catch(() => {});
    if (name === 'knock') {
      window.setTimeout(() => {
        try {
          audio.pause();
        } catch (error) {
          console.debug('Failed to pause knock sound', error);
        }
      }, 2000);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return undefined;
    const baseVolume = getGameVolume();
    const muted = isGameMuted();
    const createAudio = (src) => {
      const audio = new Audio(src);
      audio.preload = 'auto';
      audio.volume = baseVolume;
      audio.muted = muted;
      return audio;
    };
    const sounds = {
      callRaise: createAudio('/assets/sounds/Callraischip.mp3'),
      allIn: createAudio('/assets/sounds/allinpushchips2-39133.mp3'),
      fold: createAudio('/assets/sounds/pounding-cards-on-table-99355.mp3'),
      flip: createAudio('/assets/sounds/flipcard-91468.mp3'),
      knock: createAudio('/assets/sounds/wooden-door-knock-102902.mp3')
    };
    soundsRef.current = sounds;
    const handleMuteChange = () => {
      const nextMuted = isGameMuted();
      Object.values(soundsRef.current).forEach((audio) => {
        if (audio) audio.muted = nextMuted;
      });
    };
    const handleVolumeChange = () => {
      const nextVolume = getGameVolume();
      Object.values(soundsRef.current).forEach((audio) => {
        if (audio) audio.volume = nextVolume;
      });
    };
    window.addEventListener('gameMuteChanged', handleMuteChange);
    window.addEventListener('gameVolumeChanged', handleVolumeChange);
    return () => {
      window.removeEventListener('gameMuteChanged', handleMuteChange);
      window.removeEventListener('gameVolumeChanged', handleVolumeChange);
      Object.values(soundsRef.current).forEach((audio) => {
        if (audio) {
          try {
            audio.pause();
          } catch (error) {
            console.debug('Failed to stop audio', error);
          }
        }
      });
      soundsRef.current = {};
    };
  }, []);

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

  const focusCameraOnSeat = useCallback(
    (seatIndex, immediate = false) => {
      if (typeof seatIndex !== 'number' || seatIndex < 0) return;
      const three = threeRef.current;
      const basis = cameraBasisRef.current;
      if (!three || !basis) return;
      const seat = three.seatGroups?.[seatIndex];
      if (!seat) return;
      const focusPoint = seat.stoolAnchor.clone();
      focusPoint.y += seat.stoolHeight + CAMERA_TURN_FOCUS_LIFT;
      const toTarget = focusPoint.sub(basis.position);
      if (toTarget.lengthSq() === 0) return;
      const projected = toTarget.clone().projectOnPlane(basis.baseUp);
      if (projected.lengthSq() === 0) return;
      projected.normalize();
      const baseForward = basis.baseForward.clone().projectOnPlane(basis.baseUp).normalize();
      const baseRight = basis.baseRight.clone().projectOnPlane(basis.baseUp).normalize();
      const yaw = Math.atan2(projected.dot(baseRight), projected.dot(baseForward));
      const clampedYaw = THREE.MathUtils.clamp(yaw, -CAMERA_HEAD_TURN_LIMIT, CAMERA_HEAD_TURN_LIMIT);
      if (immediate) {
        headAnglesRef.current.yaw = clampedYaw;
        headAnglesRef.current.pitch = 0;
        cameraAutoTargetRef.current = { yaw: clampedYaw, activeIndex: seatIndex };
        applyHeadOrientation();
      } else {
        cameraAutoTargetRef.current = { yaw: clampedYaw, activeIndex: seatIndex };
      }
    },
    [applyHeadOrientation]
  );

  useEffect(() => {
    appearanceRef.current = appearance;
    if (typeof window !== 'undefined') {
      try {
        window.localStorage?.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(appearance));
      } catch (error) {
        console.warn('Failed to persist Texas Hold\'em appearance', error);
      }
    }
    const three = threeRef.current;
    if (!three) return;
    const normalized = normalizeAppearance(appearance);
    const safe = enforceShapeForPlayers(normalized, effectivePlayerCount);
    const woodOption = TABLE_WOOD_OPTIONS[safe.tableWood] ?? TABLE_WOOD_OPTIONS[0];
    const clothOption = TABLE_CLOTH_OPTIONS[safe.tableCloth] ?? TABLE_CLOTH_OPTIONS[0];
    const baseOption = TABLE_BASE_OPTIONS[safe.tableBase] ?? TABLE_BASE_OPTIONS[0];
    const chairOption = CHAIR_COLOR_OPTIONS[safe.chairColor] ?? CHAIR_COLOR_OPTIONS[0];
    const { option: shapeOption, rotationY } = getEffectiveShapeConfig(
      safe.tableShape,
      effectivePlayerCount
    );
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
        three.seatGroups?.forEach((seat) => {
          seat.cardMeshes.forEach((mesh) => {
            if (!mesh.userData?.card) {
              mesh.position.copy(updatedDeckAnchor);
            }
          });
        });
        three.communityMeshes?.forEach((mesh) => {
          if (!mesh.userData?.card) {
            mesh.position.copy(updatedDeckAnchor);
          }
        });
      }
      const humanSeat = three.seatGroups?.find((seat) => seat.isHuman) ?? null;
      const previousControls = three.raiseControls || null;
      const previousVisible = Boolean(previousControls?.group?.visible);
      previousControls?.dispose?.();
      three.raiseControls = null;
      if (hoverTargetRef.current?.userData?.type === 'chip-button') {
        hoverTargetRef.current = null;
      }
      if (humanSeat) {
        const nextControls = createRaiseControls({
          arena: three.arenaGroup,
          seat: humanSeat,
          chipFactory: three.chipFactory,
          tableInfo: nextTable
        });
        if (nextControls) {
          if (previousVisible) {
            nextControls.group.visible = true;
            nextControls.chipButtons.forEach((chip) => {
              chip.visible = true;
              if (chip.userData?.baseScale) {
                chip.scale.setScalar(chip.userData.baseScale);
              }
            });
          }
          three.raiseControls = nextControls;
        }
      } else {
        three.raiseControls = null;
      }
    }
    if (three.tableInfo?.materials) {
      applyTableMaterials(three.tableInfo.materials, { woodOption, clothOption, baseOption }, three.renderer);
    }
    if (chairOption && three.chairMaterials) {
      const previousSeat = three.chairMaterials.seat;
      applyChairThemeMaterials(three, chairOption, three.renderer);
      const updatedSeat = three.chairMaterials.seat;
      if (updatedSeat && updatedSeat !== previousSeat) {
        three.seatGroups?.forEach((seat) => {
          seat.chairMeshes?.forEach((mesh) => {
            if (!Array.isArray(mesh.material)) {
              mesh.material = updatedSeat;
            }
            mesh.material.needsUpdate = true;
          });
        });
      }
    }
    three.cardThemeId = cardTheme.id;
    const applyThemeToMesh = (mesh, cardData) => {
      if (!mesh) return;
      const priorFace = mesh.userData?.cardFace || 'front';
      applyCardToMesh(mesh, cardData, three.cardGeometry, three.faceCache, cardTheme);
      setCardFace(mesh, priorFace);
    };
    three.seatGroups?.forEach((seat) => {
      seat.cardMeshes.forEach((mesh) => {
        const data = mesh.userData?.card;
        if (data) {
          applyThemeToMesh(mesh, data);
        } else {
          applyThemeToMesh(mesh, { rank: 'A', suit: 'S' });
        }
      });
    });
    three.communityMeshes?.forEach((mesh) => {
      const data = mesh.userData?.card;
      if (data) {
        applyThemeToMesh(mesh, data);
      } else {
        applyThemeToMesh(mesh, { rank: 'A', suit: 'S' });
      }
    });
  }, [appearance, effectivePlayerCount]);

  const renderPreview = useCallback((type, option) => {
    switch (type) {
      case 'tableWood': {
        const preset = option?.presetId ? WOOD_PRESETS_BY_ID[option.presetId] : undefined;
        const grain = option?.grainId ? WOOD_GRAIN_OPTIONS_BY_ID[option.grainId] : undefined;
        const presetRef = preset || WOOD_FINISH_PRESETS?.[0];
        const baseHex = presetRef ? `#${hslToHexNumber(presetRef.hue, presetRef.sat, presetRef.light).toString(16).padStart(6, '0')}` : '#8b5a2b';
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
            <div className="absolute inset-0" style={{
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
    const mount = mountRef.current;
    if (!mount) return;
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

    const raycaster = new THREE.Raycaster();

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

    const floorGeometry = new THREE.CircleGeometry(TABLE_RADIUS * ARENA_GROWTH * 3.2, 64);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x0b1120, roughness: 0.9, metalness: 0.1 });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
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
    wall.receiveShadow = false;
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
    applyTableMaterials(tableInfo.materials, { woodOption: initialWood, clothOption: initialCloth, baseOption: initialBase }, renderer);

    const cardGeometry = createCardGeometry(CARD_W, CARD_H, CARD_D);
    const faceCache = new Map();
    const cardTheme = CARD_THEMES[initialAppearance.cards] ?? CARD_THEMES[0];

    const chipFactory = createChipFactory(renderer, { cardWidth: CARD_W });
    const initialPlayers = gameState?.players ?? [];
    const initialPlayerCount = initialPlayers.length || effectivePlayerCount;
    const useCardinalLayout = initialShape?.id === DIAMOND_SHAPE_ID && initialPlayerCount <= 4;
    const seatLayout = createSeatLayout(initialPlayerCount, tableInfo, { useCardinal: useCardinalLayout });
    seatLayout.forEach((seat, idx) => {
      seat.player = initialPlayers[idx] || null;
    });
    const topSeat = seatLayout
      .filter((seat) => !seat.isHuman)
      .reduce((best, seat) => {
        if (!best) return seat;
        return seat.seatPos.z < best.seatPos.z ? seat : best;
      }, null);
    const seatTopPoint = topSeat ? topSeat.stoolAnchor.clone().setY(topSeat.stoolHeight) : null;
    const seatGroups = [];
    const deckAnchor = DECK_POSITION.clone();
    if (tableInfo.rotationY) {
      deckAnchor.applyAxisAngle(WORLD_UP, tableInfo.rotationY);
    }

    const humanSeat = seatLayout.find((seat) => seat.isHuman) ?? seatLayout[0];
    humanSeatRef.current = humanSeat;
    seatTopPointRef.current = seatTopPoint;
    const raiseControls = createRaiseControls({ arena: arenaGroup, seat: humanSeat, chipFactory, tableInfo });
    const cameraTarget = new THREE.Vector3(0, TABLE_HEIGHT + CAMERA_TARGET_LIFT, 0);

    const smoothCameraTransition = (targetPosition, targetQuaternion, onComplete = null, duration = 260) => {
      const startPosition = camera.position.clone();
      const startQuaternion = camera.quaternion.clone();
      const startTime = performance.now();
      const step = () => {
        const now = performance.now();
        const t = Math.min(1, (now - startTime) / duration);
        const eased = t * (2 - t);
        camera.position.lerpVectors(startPosition, targetPosition, eased);
        THREE.Quaternion.slerp(startQuaternion, targetQuaternion, camera.quaternion, eased);
        camera.updateMatrixWorld();
        if (t < 1) {
          requestAnimationFrame(step);
        } else if (onComplete) {
          onComplete();
        }
      };
      requestAnimationFrame(step);
    };

    const applySeatedCamera = (width, height, options = {}) => {
      if (!humanSeat) return;
      const animate = Boolean(options.animate);
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
      const focusBase = cameraTarget.clone().add(new THREE.Vector3(0, CAMERA_FOCUS_CENTER_LIFT, 0));
      const focusForwardPull = portrait
        ? PORTRAIT_CAMERA_PLAYER_FOCUS_FORWARD_PULL
        : CAMERA_PLAYER_FOCUS_FORWARD_PULL;
      const focusHeight = portrait
        ? PORTRAIT_CAMERA_PLAYER_FOCUS_HEIGHT
        : CAMERA_PLAYER_FOCUS_HEIGHT;
      const focusBlend = portrait ? PORTRAIT_CAMERA_PLAYER_FOCUS_BLEND : CAMERA_PLAYER_FOCUS_BLEND;
      const chipFocus = humanSeat.chipAnchor
        .clone()
        .addScaledVector(humanSeat.forward, -focusForwardPull);
      chipFocus.y = TABLE_HEIGHT + focusHeight - CAMERA_PLAYER_FOCUS_DROP;
      const focus = focusBase.lerp(chipFocus, focusBlend);
      const lookMatrix = new THREE.Matrix4();
      lookMatrix.lookAt(position, focus, WORLD_UP);
      const targetQuaternion = new THREE.Quaternion().setFromRotationMatrix(lookMatrix);
      const targetUp = WORLD_UP.clone().applyQuaternion(targetQuaternion).normalize();
      const targetForward = focus.clone().sub(position).normalize();
      const targetRight = new THREE.Vector3().crossVectors(targetForward, targetUp).normalize();
      const pitchLimits = computeCameraPitchLimits(position, targetForward, { seatTopPoint });
      cameraBasisRef.current = {
        position: position.clone(),
        baseForward: targetForward,
        baseUp: targetUp,
        baseRight: targetRight,
        pitchLimits
      };
      headAnglesRef.current.yaw = THREE.MathUtils.clamp(0, -CAMERA_HEAD_TURN_LIMIT, CAMERA_HEAD_TURN_LIMIT);
      headAnglesRef.current.pitch = 0;
      cameraAutoTargetRef.current = {
        yaw: headAnglesRef.current.yaw,
        activeIndex: cameraAutoTargetRef.current.activeIndex
      };
      const finalize = () => {
        camera.position.copy(position);
        camera.quaternion.copy(targetQuaternion);
        camera.up.copy(WORLD_UP);
        camera.updateMatrixWorld();
        applyHeadOrientation();
      };
      if (animate) {
        smoothCameraTransition(position, targetQuaternion, finalize, 220);
      } else {
        finalize();
      }
    };

    const applyOverheadCamera = (options = {}) => {
      const animate = Boolean(options.animate);
      const height = TABLE_HEIGHT + BOARD_SIZE * 0.88;
      const lateralPull = humanSeat?.forward.clone().setY(0).normalize().multiplyScalar(TABLE_RADIUS * 0.12) ??
        new THREE.Vector3();
      const targetPosition = new THREE.Vector3(lateralPull.x, height, lateralPull.z + 0.001);
      const focus = new THREE.Vector3(0, TABLE_HEIGHT, 0);
      const lookMatrix = new THREE.Matrix4();
      lookMatrix.lookAt(targetPosition, focus, new THREE.Vector3(0, 0, 1));
      const targetQuaternion = new THREE.Quaternion().setFromRotationMatrix(lookMatrix);
      const alignedQuaternion = targetQuaternion.clone();
      const rollAdjust = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, -1, 0), 0);
      alignedQuaternion.multiply(rollAdjust);
      const rotatedQuaternion = alignedQuaternion.multiply(
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI)
      );
      const baseForward = focus.clone().sub(targetPosition).normalize();
      const baseUp = new THREE.Vector3(0, 0, 1).applyQuaternion(rotatedQuaternion).normalize();
      const baseRight = new THREE.Vector3().crossVectors(baseForward, baseUp).normalize();
      cameraBasisRef.current = {
        position: targetPosition.clone(),
        baseForward,
        baseUp,
        baseRight,
        pitchLimits: { min: 0, max: 0 }
      };
      headAnglesRef.current.yaw = 0;
      headAnglesRef.current.pitch = 0;
      cameraAutoTargetRef.current = null;
      const finalize = () => {
        camera.position.copy(targetPosition);
        camera.quaternion.copy(rotatedQuaternion);
        camera.up.set(0, 0, 1);
        camera.updateMatrixWorld();
        applyHeadOrientation();
      };
      if (animate) {
        smoothCameraTransition(targetPosition, rotatedQuaternion, finalize, 220);
      } else {
        finalize();
      }
    };

    viewControlsRef.current = { applySeatedCamera, applyOverheadCamera };
    if (overheadView) {
      applyOverheadCamera();
    } else {
      applySeatedCamera(mount.clientWidth, mount.clientHeight);
    }

    (async () => {
      const chairBuild = await buildChairTemplate(initialChair, renderer);
      if (!chairBuild) return;
      const chairTemplate = chairBuild.chairTemplate;
      const chairMaterials = chairBuild.materials;
      applyChairThemeMaterials({ chairMaterials }, initialChair, renderer);

      seatLayout.forEach((seat, seatIndex) => {
        const group = new THREE.Group();
        group.position.copy(seat.seatPos);
        group.lookAt(new THREE.Vector3(0, seat.seatPos.y, 0));

        const chairModel = chairTemplate.clone(true);
        const chairMeshes = [];
        chairModel.traverse((obj) => {
          if (obj.isMesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;
            chairMeshes.push(obj);
          }
        });
        group.add(chairModel);
        arenaGroup.add(group);

        const cardMeshes = [0, 1].map(() => {
          const mesh = createCardMesh({ rank: 'A', suit: 'S' }, cardGeometry, faceCache, cardTheme);
          mesh.position.copy(deckAnchor);
          mesh.castShadow = true;
          arenaGroup.add(mesh);
          return mesh;
        });
        cardMeshes.forEach((mesh) => {
          mesh.scale.setScalar(HUMAN_CARD_SCALE);
        });

        const tableLayout = {
          perRow: CHIP_SCATTER_LAYOUT.perRow,
          spacing: CHIP_SCATTER_LAYOUT.spacing,
          rowSpacing: CHIP_SCATTER_LAYOUT.rowSpacing,
          jitter: CHIP_SCATTER_LAYOUT.jitter,
          lift: CHIP_SCATTER_LAYOUT.lift,
          right: seat.right.clone(),
          forward: seat.forward.clone()
        };
        const railLayout = {
          perRow: CHIP_RAIL_LAYOUT.perRow,
          spacing: CHIP_RAIL_LAYOUT.spacing,
          rowSpacing: CHIP_RAIL_LAYOUT.rowSpacing,
          jitter: CHIP_RAIL_LAYOUT.jitter,
          lift: CHIP_RAIL_LAYOUT.lift,
          right: seat.right.clone(),
          forward: seat.forward.clone()
        };

        const chipStack = chipFactory.createStack(0, { mode: 'scatter', layout: tableLayout });
        chipStack.position.copy(seat.chipAnchor);
        arenaGroup.add(chipStack);

        const betStack = chipFactory.createStack(0, { mode: 'scatter', layout: tableLayout });
        betStack.position.copy(seat.betAnchor);
        betStack.visible = false;
        arenaGroup.add(betStack);

        const previewStack = chipFactory.createStack(0, { mode: 'scatter', layout: tableLayout });
        previewStack.position.copy(seat.previewAnchor);
        previewStack.visible = false;
        previewStack.scale.setScalar(HUMAN_CHIP_SCALE);
        arenaGroup.add(previewStack);

        const hoverChip = chipFactory.createStack(0, { mode: 'rail', layout: railLayout });
        hoverChip.position.copy(seat.cardRailAnchor);
        hoverChip.visible = false;
        arenaGroup.add(hoverChip);

        const nameplate = makeNameplate(`Player ${seatIndex + 1}`, 1000, renderer, seat.player?.avatar);
        nameplate.position.copy(seat.chipRailAnchor.clone().add(new THREE.Vector3(0, SEAT_THICKNESS + LABEL_BASE_HEIGHT, 0)));
        arenaGroup.add(nameplate);

        const seatGroup = {
          index: seatIndex,
          group,
          seatPos: seat.seatPos,
          forward: seat.forward,
          right: seat.right,
          cardAnchor: seat.cardAnchor,
          chipAnchor: seat.chipAnchor,
          cardRailAnchor: seat.cardRailAnchor,
          chipRailAnchor: seat.chipRailAnchor,
          betAnchor: seat.betAnchor,
          previewAnchor: seat.previewAnchor,
          stoolAnchor: seat.stoolAnchor,
          stoolHeight: seat.stoolHeight,
          isHuman: seat.isHuman,
          cardMeshes,
          chipStack,
          betStack,
          previewStack,
          hoverChip,
          chairMeshes,
          tableLayout,
          railLayout,
          nameplate,
          lastBet: 0,
          folded: false,
          lastStatus: '',
          tableInfo
        };
        seatGroups.push(seatGroup);

        const labelLift = seat.labelOffset?.height ?? LABEL_BASE_HEIGHT;
        const labelForward = seat.labelOffset?.forward ?? 0;
        const labelOffset = seat.forward.clone().setLength(labelForward).add(new THREE.Vector3(0, labelLift, 0));
        nameplate.position.copy(seat.seatPos.clone().add(labelOffset));

        const { player } = seat;
        if (player) {
          const labelFace = nameplate.material?.map ?? null;
          labelFace?.userData?.update?.(
            player.name ?? `Player ${seatIndex + 1}`,
            Math.round(player.chips) || 0,
            false,
            '',
            player.avatar
          );
          const cardValues = player.hand?.map?.((card) => cardKey(card));
          const hasCards = cardValues?.length;
          cardMeshes.forEach((mesh, idx) => {
            if (hasCards) {
              const card = player.hand[idx];
              applyCardToMesh(mesh, card, cardGeometry, faceCache, cardTheme);
              orientCard(mesh, seat.seatPos.clone().add(new THREE.Vector3(0, CARD_LOOK_LIFT, 0)), {
                face: seat.isHuman ? 'front' : 'back',
                flat: false
              });
              setCardFace(mesh, seat.isHuman ? 'front' : 'back');
              mesh.visible = true;
            } else {
              mesh.visible = false;
            }
          });
          seatGroup.tableLayout = {
            ...tableLayout,
            forward: seat.forward.clone().multiplyScalar(player.isHuman ? 1 : -1),
            right: seat.right.clone().multiplyScalar(player.isHuman ? 1 : -1)
          };
          seatGroup.railLayout = seatGroup.tableLayout;
          if (player.isHuman) {
            cameraTarget.copy(seat.seatPos.clone().add(new THREE.Vector3(0, CARD_LOOK_LIFT, 0)));
          }
        }
      });

      const opponents = initialPlayers.filter((player) => !player.isHuman);
      const aiSeats = seatGroups.filter((seat) => !seat.isHuman);
      opponents.forEach((opponent, index) => {
        const seat = aiSeats[index];
        if (!seat) return;
        seat.player = opponent;
        seat.tableLayout = {
          ...seat.tableLayout,
          forward: seat.forward.clone().negate(),
          right: seat.right.clone().negate()
        };
        seat.railLayout = seat.tableLayout;
      });

      const nameplates = seatGroups.map((seat) => seat.nameplate);
        const humanSeat = seatGroups.find((seat) => seat.isHuman);
        if (humanSeat) {
          nameplates.forEach((plate) => {
            plate.renderOrder = 10;
          });
          humanSeat.group.renderOrder = 5;
          humanSeat.cardMeshes.forEach((mesh) => {
            mesh.renderOrder = 20;
          });
          humanSeat.cardMeshes[1].position.add(new THREE.Vector3(0, HUMAN_CARD_VERTICAL_OFFSET * 1.2, 0));
          const controls = createRaiseControls({ arena: arenaGroup, seat: humanSeat, chipFactory, tableInfo });
          if (controls) {
            threeRef.current = { ...threeRef.current, raiseControls: controls };
            controls.group.visible = false;
          }
        }

      const communityMeshes = COMMUNITY_CARD_POSITIONS.map((pos, idx) => {
        const mesh = createCardMesh({ rank: 'A', suit: 'S' }, cardGeometry, faceCache, cardTheme);
        mesh.position.copy(
          computeCommunitySlotPosition(idx, { rotationY: tableInfo?.rotationY ?? 0, surfaceY: tableInfo?.surfaceY })
        );
        mesh.scale.setScalar(COMMUNITY_CARD_SCALE);
        mesh.castShadow = true;
        arenaGroup.add(mesh);
        return mesh;
      });

      const potStack = chipFactory.createStack(0, { mode: 'scatter', layout: CHIP_SCATTER_LAYOUT });
      potStack.position.copy(POT_OFFSET);
      arenaGroup.add(potStack);
      const potLayout = { ...CHIP_SCATTER_LAYOUT, right: new THREE.Vector3(1, 0, 0), forward: new THREE.Vector3(0, 0, 1) };
      chipFactory.setAmount(potStack, 0, { mode: 'scatter', layout: potLayout });

      const turnIndicator = new THREE.Mesh(
        new THREE.CylinderGeometry(TURN_TOKEN_RADIUS, TURN_TOKEN_RADIUS * 0.92, TURN_TOKEN_HEIGHT, 24),
        new THREE.MeshStandardMaterial({ color: '#f59e0b', emissive: '#78350f', emissiveIntensity: 0.38, metalness: 0.55 })
      );
      turnIndicator.position.copy(POT_OFFSET.clone().add(new THREE.Vector3(0, TURN_TOKEN_LIFT, TURN_TOKEN_FORWARD_OFFSET)));
      turnIndicator.visible = false;
      turnIndicator.castShadow = true;
      turnIndicator.receiveShadow = true;
      arenaGroup.add(turnIndicator);

        const orientHumanCards = () => {
          const humanSeatGroup = seatGroups.find((seat) => seat.isHuman);
          if (!humanSeatGroup) return;

          const baseAnchor = humanSeatGroup.chipAnchor
            .clone()
            .add(humanSeatGroup.right.clone().setLength(HUMAN_CARD_LATERAL_SHIFT * 0.6))
            .add(humanSeatGroup.forward.clone().setLength(HUMAN_CARD_INWARD_SHIFT * 0.2));
          const right = humanSeatGroup.right.clone();
          const forward = humanSeatGroup.forward.clone();

          humanSeatGroup.cardMeshes.forEach((mesh, idx) => {
            const lateral = right.clone().setLength((idx - 0.5) * HUMAN_CARD_SPREAD * 0.92);
            const forwardOffset = forward.clone().setLength(HUMAN_CARD_FORWARD_OFFSET * 0.2);
            const position = baseAnchor.clone().add(lateral).add(forwardOffset);
            position.y = humanSeatGroup.chipAnchor.y + CARD_SURFACE_OFFSET;
            mesh.position.copy(position);

            const lookTarget = position
              .clone()
              .add(forward.clone().setLength(Math.max(HUMAN_CARD_LOOK_SPLAY, 0.001)))
              .add(new THREE.Vector3(0, CARD_LOOK_LIFT, 0));
            orientCard(mesh, lookTarget, { face: 'front', flat: true });
            setCardFace(mesh, 'front');
          });
        };

        threeRef.current = {
          renderer,
          scene,
          camera,
        chipFactory,
        cardGeometry,
        faceCache,
        seatGroups,
        communityMeshes,
        potStack,
          turnIndicator,
          potLayout,
          deckAnchor,
          raiseControls,
          raycaster,
          orientHumanCards,
        frameId: null,
        chairTemplate,
        chairMaterials,
        arenaGroup,
        tableInfo,
        tableShapeId: initialShape.id,
        cardThemeId: cardTheme.id
      };

      potDisplayRef.current = Math.max(0, Math.round(gameState?.pot ?? 0));
      potTargetRef.current = potDisplayRef.current;
      chipFactory.setAmount(potStack, potDisplayRef.current, { mode: 'scatter', layout: potLayout });

      orientHumanCards();
    })().catch((error) => console.error('Failed to set up Texas Hold\'em arena', error));

    const element = renderer.domElement;
    const getControls = () => threeRef.current?.raiseControls || null;

    const applyHoverTarget = (target) => {
      const prev = hoverTargetRef.current;
      if (prev && prev !== target) {
        if (prev.userData?.type === 'chip-button') {
          prev.scale.setScalar(prev.userData.baseScale);
        } else if (prev.userData?.type === 'button') {
          const controls = getControls();
          const buttons = controls?.buttons ? Object.values(controls.buttons) : [];
          const button = buttons.find((btn) => btn.group === prev) || null;
          button?.setHover(false);
        }
      }
      hoverTargetRef.current = target || null;
      if (!target) return;
      if (target.userData?.type === 'chip-button') {
        target.scale.setScalar(target.userData.baseScale * 1.12);
      } else if (target.userData?.type === 'button') {
        const controls = getControls();
        const buttons = controls?.buttons ? Object.values(controls.buttons) : [];
        const button = buttons.find((btn) => btn.group === target) || null;
        button?.setHover(true);
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
      return { target, point: intersects[0].point };
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
        buttonAction: null,
        dragged: false
      };
    };

    const handlePointerDown = (event) => {
      event.preventDefault();
      const interactive = pickInteractive(event);
      if (interactive) {
        const { target } = interactive;
        const type = target.userData?.type;
        if (type === 'button' && target.userData?.enabled === false) {
          applyHoverTarget(null);
          element.style.cursor = 'grab';
          return;
        }
        pointerStateRef.current = {
          active: true,
          pointerId: event.pointerId,
          mode: type,
          startX: event.clientX,
          startY: event.clientY,
          startYaw: headAnglesRef.current.yaw,
          startPitch: headAnglesRef.current.pitch,
          buttonAction: target.userData?.action ?? null,
          dragged: false
        };
        element.setPointerCapture(event.pointerId);
        if (type === 'chip-button') {
          interactionsRef.current.onChip?.(target.userData.value);
        } else if (type === 'button') {
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
        buttonAction: null,
        dragged: false
      };
      element.setPointerCapture(event.pointerId);
      element.style.cursor = 'grabbing';
    };

    const handlePointerMove = (event) => {
      const state = pointerStateRef.current;
      if (!state.active || state.pointerId !== event.pointerId) {
        const hit = pickInteractive(event);
        if (hit?.target?.userData?.type === 'button' && hit.target.userData.enabled === false) {
          applyHoverTarget(null);
          element.style.cursor = 'grab';
          return;
        }
        applyHoverTarget(hit?.target ?? null);
        element.style.cursor = hit ? 'pointer' : 'grab';
        return;
      }
      if (state.mode === 'camera') {
        const dx = event.clientX - state.startX;
        if (!state.dragged && Math.abs(dx) > 3) {
          state.dragged = true;
        }
        headAnglesRef.current.yaw = THREE.MathUtils.clamp(
          state.startYaw - dx * HEAD_YAW_SENSITIVITY,
          -CAMERA_HEAD_TURN_LIMIT,
          CAMERA_HEAD_TURN_LIMIT
        );
        headAnglesRef.current.pitch = 0;
        cameraAutoTargetRef.current = {
          yaw: headAnglesRef.current.yaw,
          activeIndex: cameraAutoTargetRef.current.activeIndex
        };
        applyHeadOrientation();
        return;
      }
      if (state.mode === 'button' || state.mode === 'chip-button') {
        const distance = Math.hypot(event.clientX - state.startX, event.clientY - state.startY);
        state.dragged = distance > 10;
      }
    };

    const handlePointerUp = (event) => {
      const state = pointerStateRef.current;
      if (state.pointerId === event.pointerId) {
        element.releasePointerCapture(event.pointerId);
        const wasCameraDrag = state.mode === 'camera' && state.dragged;
        const releaseYaw = headAnglesRef.current.yaw;
        if (state.mode === 'button' && !state.dragged) {
          if (state.buttonAction === 'undo') {
            interactionsRef.current.onUndo?.();
          }
        }
        resetPointerState();
        element.style.cursor = 'grab';
        applyHoverTarget(null);
        if (wasCameraDrag) {
          cameraAutoTargetRef.current = { yaw: releaseYaw, activeIndex: null };
        }
      }
    };

    element.addEventListener('pointerdown', handlePointerDown);
    element.addEventListener('pointermove', handlePointerMove);
    element.addEventListener('pointerup', handlePointerUp);
    element.addEventListener('pointercancel', handlePointerUp);
    element.addEventListener('pointerleave', handlePointerUp);

    const handleResize = () => {
      if (!mount || !threeRef.current) return;
      const { renderer: r, camera: cam } = threeRef.current;
      const { clientWidth, clientHeight } = mount;
      r.setSize(clientWidth, clientHeight);
      cam.aspect = clientWidth / clientHeight;
      cam.updateProjectionMatrix();
      applySeatedCamera(clientWidth, clientHeight);
    };

    window.addEventListener('resize', handleResize);

    const animate = (time) => {
      const three = threeRef.current;
      if (!three) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }
      const pointerState = pointerStateRef.current;
      if (lastFrameRef.current == null) {
        lastFrameRef.current = time;
      }
      const deltaSeconds = Math.max(0, Math.min(0.1, (time - lastFrameRef.current) / 1000));
      lastFrameRef.current = time;
      three.chipFactory.update(deltaSeconds);
      if (!pointerState.active || pointerState.mode !== 'camera') {
        const targetYaw = cameraAutoTargetRef.current?.yaw;
        if (typeof targetYaw === 'number') {
          const currentYaw = headAnglesRef.current.yaw;
          const delta = targetYaw - currentYaw;
          if (Math.abs(delta) > 0.0005) {
            headAnglesRef.current.yaw = currentYaw + delta * CAMERA_AUTO_YAW_SMOOTHING;
          } else {
            headAnglesRef.current.yaw = targetYaw;
          }
        }
      } else {
        cameraAutoTargetRef.current.yaw = headAnglesRef.current.yaw;
      }
      headAnglesRef.current.pitch = 0;
      applyHeadOrientation();
      three.renderer.render(three.scene, three.camera);
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationRef.current);
      lastFrameRef.current = null;
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
          communityMeshes: community,
          raiseControls: controls,
          chairMaterials,
          arenaGroup: arena,
          turnIndicator
        } = threeRef.current;
        seats.forEach((seat) => {
          seat.cardMeshes.forEach((mesh) => {
            mesh.geometry?.dispose?.();
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach((mat) => mat?.dispose?.());
            } else {
              mesh.material?.dispose?.();
            }
            s.remove(mesh);
          });
          factory.disposeStack(seat.chipStack);
          factory.disposeStack(seat.betStack);
          factory.disposeStack(seat.previewStack);
          seat.chairMeshes?.forEach((mesh) => {
            mesh.geometry?.dispose?.();
            mesh.parent?.remove(mesh);
          });
          if (seat.nameplate) {
            seat.nameplate.userData?.dispose?.();
            seat.nameplate.parent?.remove(seat.nameplate);
          }
          seat.group?.parent?.remove(seat.group);
        });
        community.forEach((mesh) => {
          mesh.geometry?.dispose?.();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((mat) => mat?.dispose?.());
          } else {
            mesh.material?.dispose?.();
          }
          s.remove(mesh);
        });
        factory.disposeStack(threeRef.current.potStack);
        if (turnIndicator) {
          turnIndicator.geometry?.dispose?.();
          turnIndicator.material?.dispose?.();
          turnIndicator.parent?.remove(turnIndicator);
        }
        factory.dispose();
        arena?.parent?.remove(arena);
        controls?.dispose?.();
        disposeChairMaterials(chairMaterials);
        tableInfo?.dispose?.();
        r.dispose();
      }
      mount.removeChild(renderer.domElement);
      threeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const three = threeRef.current;
    if (!three) return;
    const { seatGroups, communityMeshes, chipFactory, potStack, potLayout, deckAnchor, arenaGroup, turnIndicator } = three;
    const cardTheme = CARD_THEMES.find((theme) => theme.id === three.cardThemeId) ?? CARD_THEMES[0];
    const state = gameState;
    if (!state) return;

    const previous = prevStateRef.current;
    potTargetRef.current = Math.max(0, Math.round(state.pot ?? 0));

    const showdownState = showdownAnimationRef.current;
    const winningCommunity = new Set(state.winningCommunityCards ?? []);

    let turnTarget = null;
    let turnForward = null;

    state.players.forEach((player, idx) => {
      const seat = seatGroups[idx];
      if (!seat) return;
      const prevPlayer = previous?.players?.[idx];
      const baseAnchor = seat.isHuman
        ? seat.cardRailAnchor.clone().lerp(seat.chipRailAnchor, HUMAN_CARD_CHIP_BLEND)
        : seat.cardAnchor.clone();
      const right = seat.right.clone();
      const forward = seat.forward.clone();

      seat.folded = player.folded;
      seat.lastStatus = player.status || '';

      const winningCardSet = new Set(player.winningCards ?? []);

      seat.cardMeshes.forEach((mesh, cardIdx) => {
        let card = player.hand[cardIdx];
        if (!card && player.folded) {
          card = prevPlayer?.hand?.[cardIdx] ?? mesh.userData?.card ?? null;
        }
        if (!card) {
          mesh.visible = false;
          mesh.position.copy(deckAnchor);
          setCardHighlight(mesh, false);
          return;
        }
        mesh.visible = true;
        applyCardToMesh(mesh, card, three.cardGeometry, three.faceCache, cardTheme);
        if (player.folded && !state.showdown) {
          const railBase = seat.cardRailAnchor.clone();
          const lateral = seat.right.clone().multiplyScalar((cardIdx - 0.5) * HOLE_SPACING);
          const position = railBase.add(lateral);
          mesh.position.copy(position);
          const lookTarget = position.clone().add(seat.forward.clone());
          orientCard(mesh, lookTarget, { face: 'back', flat: true });
          setCardFace(mesh, 'back');
          setCardHighlight(mesh, false);
          return;
        }
        const position = baseAnchor
          .clone()
          .addScaledVector(forward, seat.isHuman ? CARD_FORWARD_OFFSET * -0.35 : CARD_FORWARD_OFFSET)
          .add(right.clone().multiplyScalar((cardIdx - 0.5) * HUMAN_CARD_SPREAD));
        position.y = seat.cardRailAnchor.y + CARD_D * 0.6;
        mesh.position.copy(position);
        const lookOrigin = seat.isHuman ? seat.cardRailAnchor : seat.stoolAnchor;
        const lookTarget = lookOrigin
          .clone()
          .add(new THREE.Vector3(0, seat.stoolHeight * 0.5 + CARD_LOOK_LIFT, 0))
          .add(right.clone().multiplyScalar((cardIdx - 0.5) * CARD_LOOK_SPLAY))
          .addScaledVector(forward, seat.isHuman ? -CARD_LOOK_SPLAY * 0.45 : 0);
        const face = seat.isHuman || state.showdown ? 'front' : 'back';
        orientCard(mesh, lookTarget, { face, flat: false });
        setCardFace(mesh, face);
        const key = cardKey(card);
        setCardHighlight(mesh, state.showdown && winningCardSet.has(key));
      });

      const chipsAmount = Math.max(0, Math.round(player.chips));
      const seatPendingValue = Math.max(0, showdownState?.seatPending?.[idx] ?? 0);
      const storedStarting = showdownState?.startingChips?.[idx];
      const baseStarting = Math.max(0, Math.round((player.chips ?? 0) - (player.winnings ?? 0)));
      const effectiveStarting = Number.isFinite(storedStarting) ? storedStarting : baseStarting;
      const shouldHoldChips =
        state.stage === 'showdown' && (seatPendingValue > 0 || (player.winnings ?? 0) > 0);
      const displayChips = shouldHoldChips ? Math.max(0, effectiveStarting) : chipsAmount;
      chipFactory.setAmount(seat.chipStack, displayChips, { mode: 'scatter', layout: seat.tableLayout });

      const bet = Math.max(0, Math.round(player.bet));
      const prevBet = seat.lastBet ?? 0;
      const betDelta = Math.max(0, bet - prevBet);
      if (betDelta > 0 && arenaGroup) {
        const chipHeight = chipFactory.chipHeight;
        const startBase = seat.chipRailAnchor.clone();
        startBase.y -= chipHeight / 2;
        const midBase = seat.chipAnchor.clone();
        midBase.y -= chipHeight / 2;
        const endBase = potStack.position.clone();
        endBase.y -= chipHeight / 2;
        chipFactory.animateTransfer(betDelta, {
          scene: arenaGroup,
          start: startBase,
          mid: midBase,
          end: endBase,
          startLayout: seat.railLayout,
          midLayout: seat.tableLayout,
          endLayout: potLayout,
          pauseDuration: 0.45,
          toMidDuration: 0.35,
          toEndDuration: 0.6,
          onComplete: (value) => {
            potDisplayRef.current = Math.min(potTargetRef.current, potDisplayRef.current + value);
            chipFactory.setAmount(potStack, potDisplayRef.current, { mode: 'scatter', layout: potLayout });
          }
        });
      }

      seat.lastBet = bet;
      seat.lastChips = chipsAmount;

      if (seat.betStack) {
        chipFactory.setAmount(seat.betStack, 0, { mode: 'scatter', layout: seat.tableLayout });
        seat.betStack.visible = false;
      }

      const highlight = state.stage !== 'showdown' && idx === state.actionIndex && !player.folded && !player.allIn;
      if (highlight) {
        turnTarget = seat.cardRailAnchor
          .clone()
          .add(new THREE.Vector3(0, TURN_TOKEN_LIFT, TURN_TOKEN_FORWARD_OFFSET));
        turnForward = seat.forward.clone();
      }
      const label = seat.nameplate;
      if (label?.userData?.update) {
        const status = player.status || '';
        label.userData.update(player.name, chipsAmount, highlight, status, player.avatar);
        label.userData.texture.needsUpdate = true;
      }

      if (player.folded && !(prevPlayer?.folded)) {
        playSound('fold');
      }
      const currentStatus = player.status || '';
      const previousStatus = prevPlayer?.status || '';
      if (currentStatus !== previousStatus) {
        if (currentStatus === 'All-in') {
          playSound('allIn');
        } else if (
          currentStatus === 'Call' ||
          currentStatus === 'Bet' ||
          currentStatus === 'Raise' ||
          currentStatus.startsWith('SB') ||
          currentStatus.startsWith('BB')
        ) {
          playSound('callRaise');
        }
      }
      seat.lastStatus = currentStatus;
    });

    if (turnIndicator) {
      if (turnTarget) {
        if (!turnIndicator.visible) {
          turnIndicator.position.copy(turnTarget);
        } else {
          turnIndicator.position.lerp(turnTarget, 0.32);
        }
        const forward = turnForward ? turnForward.clone().setY(0).normalize() : null;
        if (forward && forward.lengthSq() > 0) {
          const lookTarget = turnIndicator.position.clone().add(forward);
          turnIndicator.lookAt(lookTarget);
          turnIndicator.up.copy(WORLD_UP);
        }
        turnIndicator.visible = true;
      } else {
        turnIndicator.visible = false;
      }
    }

    three.orientHumanCards?.();

    communityMeshes.forEach((mesh, idx) => {
      const card = state.community[idx];
      if (!card) {
        mesh.position.copy(deckAnchor);
        mesh.visible = false;
        setCardHighlight(mesh, false);
        return;
      }
      mesh.visible = true;
      applyCardToMesh(mesh, card, three.cardGeometry, three.faceCache, cardTheme);
      const rotationY = three.tableInfo?.rotationY ?? 0;
      const surfaceY = three.tableInfo?.surfaceY ?? TABLE_HEIGHT;
      const slotPosition = computeCommunitySlotPosition(idx, { rotationY, surfaceY });
      mesh.position.copy(slotPosition);
      const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(WORLD_UP, rotationY);
      const lookTarget = slotPosition
        .clone()
        .add(new THREE.Vector3(0, COMMUNITY_CARD_LOOK_LIFT, 0))
        .add(forward);
      orientCard(mesh, lookTarget, { face: 'front', flat: true });
      if (COMMUNITY_CARD_TILT) {
        mesh.rotateX(COMMUNITY_CARD_TILT);
      }
      setCardFace(mesh, 'front');
      const communityKey = cardKey(card);
      setCardHighlight(mesh, state.showdown && winningCommunity.has(communityKey));
      if (!previous?.community?.[idx]) {
        playSound('flip');
      }
    });

    state.players.forEach((player, idx) => {
      const prevPlayer = previous?.players?.[idx];
      player.hand.forEach((card, cardIdx) => {
        if (card && !prevPlayer?.hand?.[cardIdx]) {
          playSound('flip');
        }
      });
    });

    if (!showdownState?.active) {
      if (potDisplayRef.current > potTargetRef.current || potTargetRef.current === 0) {
        potDisplayRef.current = potTargetRef.current;
        chipFactory.setAmount(potStack, potDisplayRef.current, { mode: 'scatter', layout: potLayout });
      }
    }

    prevStateRef.current = {
      players: state.players.map((p) => ({
        status: p.status || '',
        folded: p.folded,
        chips: Math.round(p.chips),
        bet: Math.round(p.bet),
        hand: p.hand.map((card) => (card ? { ...card } : null))
      })),
      community: state.community.map((card) => (card ? { ...card } : null)),
      pot: state.pot,
      stage: state.stage,
      actionIndex: state.actionIndex
    };
  }, [gameState, playSound]);

  const currentActionIndex = gameState?.actionIndex;
  const currentStage = gameState?.stage;
  useEffect(() => {
    if (typeof currentActionIndex !== 'number') return;
    if (currentStage === 'showdown') return;
    const three = threeRef.current;
    if (!three) return;
    const seat = three.seatGroups?.[currentActionIndex];
    if (seat?.isHuman) {
      playSound('knock');
    }
  }, [currentActionIndex, currentStage, playSound]);

  useEffect(() => {
    if (!gameState) return;
    if (gameState.stage !== 'showdown') {
      showdownAnimationRef.current.active = false;
      return;
    }
    const handId = gameState.handId;
    const previousHandId = showdownAnimationRef.current.handId;
    showdownAnimationRef.current.handId = handId;

    const focusIndex = gameState.winnerFocusIndex;
    if (typeof focusIndex === 'number') {
      focusCameraOnSeat(focusIndex, false);
    }

    if (previousHandId === handId) {
      return;
    }

    const three = threeRef.current;
    if (!three) return;
    const { seatGroups, chipFactory, potStack, potLayout, arenaGroup } = three;
    const results = Array.isArray(gameState.winners) ? gameState.winners : [];
    const totalPot = results.reduce((sum, entry) => sum + Math.max(0, Math.round(entry?.amount ?? 0)), 0);

    const startingChips = {};
    gameState.players.forEach((player, idx) => {
      startingChips[idx] = Math.max(0, Math.round((player.chips ?? 0) - (player.winnings ?? 0)));
    });

    const seatPending = {};
    const seatTargets = {};
    results.forEach((potEntry) => {
      const winners = Array.isArray(potEntry?.winners) ? potEntry.winners : [];
      winners.forEach((winnerInfo) => {
        const seatIndex = winnerInfo?.index;
        if (typeof seatIndex !== 'number' || seatIndex < 0) return;
        const shareAmount = Math.max(0, Math.round(winnerInfo?.share ?? 0));
        if (shareAmount <= 0) return;
        seatPending[seatIndex] = (seatPending[seatIndex] ?? 0) + shareAmount;
        seatTargets[seatIndex] = Math.max(0, Math.round(gameState.players?.[seatIndex]?.chips ?? 0));
      });
    });

    showdownAnimationRef.current.active = totalPot > 0;
    showdownAnimationRef.current.pendingValue = totalPot;
    showdownAnimationRef.current.seatPending = seatPending;
    showdownAnimationRef.current.startingChips = startingChips;

    if (totalPot <= 0) {
      potDisplayRef.current = 0;
      chipFactory.setAmount(potStack, 0, { mode: 'scatter', layout: potLayout });
      return;
    }

    potDisplayRef.current = Math.max(potDisplayRef.current, totalPot);
    chipFactory.setAmount(potStack, Math.round(potDisplayRef.current), { mode: 'scatter', layout: potLayout });

    results.forEach((potEntry) => {
      const winners = Array.isArray(potEntry?.winners) ? potEntry.winners : [];
      winners.forEach((winnerInfo) => {
        const seatIndex = winnerInfo?.index;
        if (typeof seatIndex !== 'number' || seatIndex < 0) return;
        const shareAmount = Math.max(0, Math.round(winnerInfo?.share ?? 0));
        if (shareAmount <= 0) return;
        const seat = seatGroups?.[seatIndex];
        if (!seat) return;
        const start = potStack.position.clone();
        const end = seat.chipAnchor.clone();
        const mid = start.clone().lerp(end, 0.5);
        mid.y += CARD_SURFACE_OFFSET * 6;
        const targetChips = seatTargets[seatIndex] ?? Math.max(0, Math.round(gameState.players?.[seatIndex]?.chips ?? 0));
        chipFactory.animateTransfer(shareAmount, {
          scene: arenaGroup,
          start,
          mid,
          end,
          startLayout: potLayout,
          midLayout: seat.tableLayout,
          endLayout: seat.tableLayout,
          startLift: CARD_SURFACE_OFFSET,
          midLift: CARD_SURFACE_OFFSET * 4,
          endLift: CARD_SURFACE_OFFSET,
          onComplete: (value) => {
            showdownAnimationRef.current.pendingValue = Math.max(
              0,
              showdownAnimationRef.current.pendingValue - value
            );
            potDisplayRef.current = Math.max(0, potDisplayRef.current - value);
            chipFactory.setAmount(potStack, Math.max(0, Math.round(potDisplayRef.current)), {
              mode: 'scatter',
              layout: potLayout
            });
            if (showdownAnimationRef.current.seatPending) {
              showdownAnimationRef.current.seatPending[seatIndex] = Math.max(
                0,
                (showdownAnimationRef.current.seatPending[seatIndex] ?? 0) - value
              );
              if (showdownAnimationRef.current.seatPending[seatIndex] <= 0) {
                chipFactory.setAmount(seat.chipStack, targetChips, {
                  mode: 'scatter',
                  layout: seat.tableLayout
                });
              }
            }
            if (showdownAnimationRef.current.pendingValue <= 0) {
              showdownAnimationRef.current.active = false;
              potDisplayRef.current = 0;
              chipFactory.setAmount(potStack, 0, { mode: 'scatter', layout: potLayout });
            }
          }
        });
      });
    });
  }, [gameState, focusCameraOnSeat]);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!gameState) return;
    if (gameState.stage === 'showdown') {
      timerRef.current = setTimeout(() => {
        setGameState((prev) => resetForNextHand(cloneState(prev)));
      }, SHOWDOWN_RESET_DELAY);
      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      };
    }
    const actor = gameState.players[gameState.actionIndex];
    if (!actor) return;
    if (actor.isHuman) {
      const toCall = Math.max(0, gameState.currentBet - actor.bet);
      const canCheck = toCall === 0;
      const maxRaise = Math.max(0, actor.chips - toCall);
      const minRaise = Math.min(maxRaise, gameState.minRaise);
      const canRaise = maxRaise > 0;
      const actions = [];
      actions.push({ id: 'fold', label: 'Fold' });
      if (canCheck) {
        actions.push({ id: 'check', label: 'Check' });
      } else {
        actions.push({ id: 'call', label: `Call ${Math.round(toCall)} ${gameState.token}` });
      }
      setUiState({ availableActions: actions, toCall, canRaise, maxRaise, minRaise });
    } else {
      setUiState({ availableActions: [], toCall: 0, canRaise: false, maxRaise: 0, minRaise: 0 });
      timerRef.current = setTimeout(() => {
        setGameState((prev) => {
          const next = cloneState(prev);
          performAiAction(next);
          return next;
        });
      }, 3000);
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [gameState]);

  const handleAction = (id, raiseAmount) => {
    setGameState((prev) => {
      const next = cloneState(prev);
      if (next.stage === 'showdown') return next;
      const amount = raiseAmount ?? next.minRaise;
      performPlayerAction(next, id, amount);
      return next;
    });
  };

  const actor = gameState.players[gameState.actionIndex];
  const toCall = actor ? Math.max(0, gameState.currentBet - actor.bet) : 0;
  const sliderMax = actor ? Math.max(0, actor.chips - toCall) : 0;
  const minRaiseAmount = actor ? Math.min(sliderMax, gameState.minRaise) : 0;
  const defaultRaise = sliderMax <= 0 ? 0 : minRaiseAmount > 0 ? Math.min(sliderMax, minRaiseAmount) : sliderMax;
  const chipTotal = useMemo(
    () => chipSelection.reduce((sum, chip) => sum + chip, 0),
    [chipSelection]
  );
  const effectiveRaise = chipTotal > 0 ? chipTotal : sliderValue;
  const finalRaise = sliderMax > 0 ? Math.min(sliderMax, Math.max(effectiveRaise, defaultRaise)) : 0;
  const totalSpend = toCall + finalRaise;
  const sliderEnabled = Boolean(actor?.isHuman && uiState.canRaise && sliderMax > 0);
  const sliderLabel = toCall > 0 ? 'Raise' : 'Bet';
  const raisePreview = sliderEnabled ? Math.min(sliderMax, effectiveRaise) : 0;
  const overlaySelected = Math.round(Math.min(sliderMax, Math.max(0, raisePreview)));
  const overlayTotal = Math.round(totalSpend);
  const overlayConfirmDisabled = !sliderEnabled || overlayTotal <= 0;
  const overlayAllInDisabled = !sliderEnabled || sliderMax <= 0;
  const undoDisabled = !sliderEnabled || chipSelection.length === 0;

  const turnLabel = useMemo(() => {
    if (!actor || gameState.stage === 'showdown') return '';
    if (actor.isHuman) return 'Your turn';
    const name = actor.name || 'Opponent';
    return `${name} is acting`;
  }, [actor, gameState.stage]);

  useEffect(() => {
    if (!actor?.isHuman || gameState.stage === 'showdown') {
      setChipSelection([]);
      setSliderValue(0);
      return;
    }
    if (sliderMax <= 0) {
      setChipSelection([]);
      setSliderValue(0);
      return;
    }
    setChipSelection([]);
    setSliderValue(defaultRaise);
  }, [actor?.id, sliderMax, minRaiseAmount, gameState.stage, defaultRaise]);

  useEffect(() => {
    if (sliderMax <= 0) return;
    setSliderValue((prev) => Math.min(prev, sliderMax));
  }, [sliderMax]);

  useEffect(() => {
    const three = threeRef.current;
    if (!three) return;
    const seat = three.seatGroups?.find((s) => s.isHuman);
    if (!seat?.previewStack) return;
    const amount = sliderEnabled ? Math.round(raisePreview) : 0;
    three.chipFactory.setAmount(seat.previewStack, amount, { mode: 'scatter', layout: seat.tableLayout });
    seat.previewStack.visible = amount > 0;
  }, [raisePreview, sliderEnabled]);


  useEffect(() => {
    const three = threeRef.current;
    const controls = three?.raiseControls;
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

  const handleChipClick = (value) => {
    if (!sliderEnabled) return;
    setChipSelection((prev) => {
      const currentTotal = prev.reduce((sum, chip) => sum + chip, 0);
      const nextTotal = currentTotal + value;
      if (nextTotal > sliderMax) return prev;
      setSliderValue(nextTotal);
      return [...prev, value];
    });
  };

  const handleUndoChip = () => {
    setChipSelection((prev) => {
      if (!prev.length) return prev;
      const updated = prev.slice(0, -1);
      const nextTotal = updated.reduce((sum, chip) => sum + chip, 0);
      setSliderValue(nextTotal > 0 ? nextTotal : defaultRaise);
      return updated;
    });
  };

  const handleRaiseConfirm = () => {
    if (!sliderEnabled) return;
    const action = toCall > 0 ? 'raise' : 'bet';
    handleAction(action, finalRaise);
  };

  const handleAllIn = () => {
    if (!sliderEnabled) return;
    const action = toCall > 0 ? 'raise' : 'bet';
    handleAction(action, sliderMax);
  };

  useEffect(() => {
    interactionsRef.current = {
      onChip: (value) => handleChipClick(value),
      onUndo: () => handleUndoChip()
    };
  }, [handleChipClick, handleUndoChip]);

  useEffect(() => {
    const controls = viewControlsRef.current;
    const mount = mountRef.current;
    const three = threeRef.current;
    if (!three?.camera) return;
    const animate = lastViewRef.current !== overheadView;
    lastViewRef.current = overheadView;
    if (Array.isArray(three.seatGroups)) {
      three.seatGroups.forEach((seat) => {
        if (seat?.group) {
          seat.group.visible = !overheadView;
        }
      });
    }
    if (overheadView) {
      controls.applyOverheadCamera?.({ animate });
    } else {
      const width = mount?.clientWidth ?? window.innerWidth;
      const height = mount?.clientHeight ?? window.innerHeight;
      controls.applySeatedCamera?.(width, height, { animate });
    }
  }, [overheadView]);

  return (
    <div className="relative w-full h-full">
      <div ref={mountRef} className="absolute inset-0" />
      <div className="absolute top-4 left-4 z-20 flex flex-col items-start gap-2">
        <div className="flex items-center gap-2">
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
            <span className="sr-only">Open table customization</span>
          </button>
        </div>
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
                            selected ? 'border-sky-400/80 bg-sky-400/10 shadow-[0_0_12px_rgba(56,189,248,0.35)]' : 'border-white/10 bg-white/5 hover:border-white/20'
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
      {turnLabel && (
        <div className="pointer-events-none fixed bottom-20 inset-x-0 z-20 flex justify-center">
          <div className="rounded-full border border-[rgba(255,215,0,0.35)] bg-[rgba(7,10,18,0.7)] px-4 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur">
            {turnLabel}
          </div>
        </div>
      )}
      {actor?.isHuman && sliderEnabled && sliderMax > 0 && (
        <div className="pointer-events-auto absolute top-1/2 right-2 z-10 flex -translate-y-1/2 flex-col items-center gap-4 text-white sm:right-6">
          <div className="flex flex-col items-center gap-1 text-center">
            <span className="text-xs uppercase tracking-[0.5em] text-white/60">{sliderLabel}</span>
            <span className="text-2xl font-semibold drop-shadow-md">
              {overlaySelected} {gameState.token}
            </span>
            {toCall > 0 && (
              <span className="text-[0.7rem] text-white/60">Call {Math.round(toCall)} {gameState.token}</span>
            )}
            <span className="text-[0.7rem] text-white/70">Total {overlayTotal} {gameState.token}</span>
          </div>
          <div className="flex flex-col items-center gap-3">
            <input
              type="range"
              min={0}
              max={Math.round(sliderMax)}
              step={1}
              value={Math.round(sliderValue)}
              onChange={(event) => {
                const next = Number(event.target.value);
                setChipSelection([]);
                setSliderValue(next);
              }}
              className="h-64 w-10 cursor-pointer appearance-none bg-transparent"
              style={{ writingMode: 'bt-lr', WebkitAppearance: 'slider-vertical' }}
            />
            <button
              type="button"
              onClick={handleRaiseConfirm}
              disabled={overlayConfirmDisabled}
              className={`w-full rounded-lg px-4 py-2 text-sm font-semibold uppercase tracking-wide text-white shadow-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${
                overlayConfirmDisabled
                  ? 'bg-blue-900/50 text-white/40 shadow-none'
                  : 'bg-blue-600/90 hover:bg-blue-500'
              }`}
            >
              {sliderLabel}
            </button>
          </div>
        </div>
      )}
      {actor?.isHuman && gameState.stage !== 'showdown' && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleUndoChip}
            disabled={undoDisabled}
            className={`px-5 py-2 rounded-lg font-semibold uppercase tracking-wide text-white shadow-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 ${
              undoDisabled
                ? 'bg-amber-900/40 text-white/40 shadow-none'
                : 'bg-amber-500/90 hover:bg-amber-400'
            }`}
          >
            Undo
          </button>
          {uiState.availableActions.map((action) => (
            <button
              key={action.id}
              onClick={() => handleAction(action.id)}
              className="px-5 py-2 rounded-lg bg-blue-600/90 text-white font-semibold shadow-lg"
            >
              {action.label}
            </button>
          ))}
          <button
            type="button"
            onClick={handleAllIn}
            disabled={overlayAllInDisabled}
            className={`px-5 py-2 rounded-lg font-semibold uppercase tracking-wide text-white shadow-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 ${
              overlayAllInDisabled
                ? 'bg-red-900/50 text-white/40 shadow-none'
                : 'bg-red-600/90 hover:bg-red-500'
            }`}
          >
            All-in
          </button>
        </div>
      )}
    </div>
  );
}

export default TexasHoldemArena;
