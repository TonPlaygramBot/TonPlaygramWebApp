import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createArenaCarpetMaterial, createArenaWallMaterial } from '../../utils/arenaDecor.js';
import {
  createMurlanStyleTable,
  applyTableMaterials,
  TABLE_SHAPE_OPTIONS
} from '../../utils/murlanTable.js';
import { applyRendererSRGB } from '../../utils/colorSpace.js';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import {
  getTelegramFirstName,
  getTelegramUsername,
  getTelegramPhotoUrl
} from '../../utils/telegram.js';
import coinConfetti from '../../utils/coinConfetti';
import {
  dropSound,
  snakeSound,
  cheerSound
} from '../../assets/soundData.js';
import { getGameVolume } from '../../utils/sound.js';
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

const DEFAULT_PLAYER_COUNT = 6;

const CAMERA_FOV = 52;
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 5000;
const CAMERA_DOLLY_FACTOR = 0.2;
const CAMERA_TARGET_LIFT = 0.04 * MODEL_SCALE;
const CAM = {
  fov: CAMERA_FOV,
  near: CAMERA_NEAR,
  far: CAMERA_FAR,
  minR: TABLE_RADIUS * 1.6,
  maxR: TABLE_RADIUS * 4.2,
  phiMin: Math.PI * 0.26,
  phiMax: Math.PI * 0.58
};

const DEFAULT_STOOL_THEME = Object.freeze({ legColor: '#1f1f1f' });

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
    id: 'royalPlum',
    label: 'Gështenjë Mbretërore',
    primary: '#3f1f5b',
    accent: '#2c1340',
    highlight: '#7c4ae0',
    legColor: '#140a24'
  }
]);

const CHAIR_CLOTH_TEXTURE_SIZE = 512;
const CHAIR_CLOTH_REPEAT = 6;

const APPEARANCE_STORAGE_KEY = 'ludoBattleRoyalArenaAppearance';
const DEFAULT_APPEARANCE = {
  ...DEFAULT_TABLE_CUSTOMIZATION,
  chairColor: 0,
  tableShape: 0
};

const CUSTOMIZATION_SECTIONS = [
  { key: 'tableWood', label: 'Dru i Tavolinës', options: TABLE_WOOD_OPTIONS },
  { key: 'tableCloth', label: 'Rroba e Tavolinës', options: TABLE_CLOTH_OPTIONS },
  { key: 'chairColor', label: 'Ngjyra e Karrigeve', options: CHAIR_COLOR_OPTIONS },
  { key: 'tableBase', label: 'Baza e Tavolinës', options: TABLE_BASE_OPTIONS },
  { key: 'tableShape', label: 'Forma e Tavolinës', options: TABLE_SHAPE_OPTIONS }
];

const DIAMOND_SHAPE_ID = 'diamondEdge';
const NON_DIAMOND_SHAPE_INDEX = (() => {
  const index = TABLE_SHAPE_OPTIONS.findIndex((option) => option.id !== DIAMOND_SHAPE_ID);
  return index >= 0 ? index : 0;
})();

function normalizeAppearance(value = {}) {
  const normalized = { ...DEFAULT_APPEARANCE };
  const entries = [
    ['tableWood', TABLE_WOOD_OPTIONS.length],
    ['tableCloth', TABLE_CLOTH_OPTIONS.length],
    ['tableBase', TABLE_BASE_OPTIONS.length],
    ['chairColor', CHAIR_COLOR_OPTIONS.length],
    ['tableShape', TABLE_SHAPE_OPTIONS.length]
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

const LUDO_GRID = 15;
const LUDO_TILE = 0.075;
const RAW_BOARD_SIZE = LUDO_GRID * LUDO_TILE;
// Enlarge the Ludo board so it spans 2.7x the classic footprint.
const BOARD_SCALE = 2.7;
const BOARD_DISPLAY_SIZE = RAW_BOARD_SIZE * BOARD_SCALE;
const BOARD_CLOTH_HALF = BOARD_DISPLAY_SIZE / 2;
const RING_STEPS = 52;
const HOME_STEPS = 4;
const GOAL_PROGRESS = RING_STEPS + HOME_STEPS;
const PLAYER_START_INDEX = [0, 13, 26, 39];
const COLOR_NAMES = ['Red', 'Green', 'Yellow', 'Blue'];
const PLAYER_COLORS = [0xef4444, 0x22c55e, 0xf59e0b, 0x3b82f6];

const DICE_SIZE = 0.09;
const DICE_CORNER_RADIUS = DICE_SIZE * 0.17;
const DICE_PIP_RADIUS = DICE_SIZE * 0.093;
const DICE_PIP_DEPTH = DICE_SIZE * 0.018;
const DICE_PIP_RIM_INNER = DICE_PIP_RADIUS * 0.78;
const DICE_PIP_RIM_OUTER = DICE_PIP_RADIUS * 1.08;
const DICE_PIP_RIM_OFFSET = DICE_SIZE * 0.0048;
const DICE_PIP_SPREAD = DICE_SIZE * 0.3;
const DICE_FACE_INSET = DICE_SIZE * 0.064;
const DICE_BASE_HEIGHT = DICE_SIZE / 2 + 0.047;

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
    new RoundedBoxGeometry(
      DICE_SIZE,
      DICE_SIZE,
      DICE_SIZE,
      6,
      DICE_CORNER_RADIUS
    ),
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
    Math.PI / 2
  );
  pipGeo.rotateX(Math.PI);
  pipGeo.computeVertexNormals();
  const pipRimGeo = new THREE.RingGeometry(DICE_PIP_RIM_INNER, DICE_PIP_RIM_OUTER, 64);
  const halfSize = DICE_SIZE / 2;
  const faceDepth = halfSize - DICE_FACE_INSET * 0.6;
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

function setDiceOrientation(dice, val) {
  const q = new THREE.Quaternion();
  const eulers = {
    1: new THREE.Euler(0, 0, 0),
    2: new THREE.Euler(-Math.PI / 2, 0, 0),
    3: new THREE.Euler(0, 0, -Math.PI / 2),
    4: new THREE.Euler(0, 0, Math.PI / 2),
    5: new THREE.Euler(Math.PI / 2, 0, 0),
    6: new THREE.Euler(Math.PI, 0, 0)
  };
  const e = eulers[val] || eulers[1];
  q.setFromEuler(e);
  dice.setRotationFromQuaternion(q);
}

function spinDice(
  dice,
  { duration = 900, targetPosition = new THREE.Vector3(), bounceHeight = 0.06 } = {}
) {
  return new Promise((resolve) => {
    const start = performance.now();
    const startPos = dice.position.clone();
    const endPos = targetPosition.clone();
    const spinVec = new THREE.Vector3(
      0.6 + Math.random() * 0.5,
      0.7 + Math.random() * 0.45,
      0.5 + Math.random() * 0.55
    );
    const wobble = new THREE.Vector3((Math.random() - 0.5) * 0.12, 0, (Math.random() - 0.5) * 0.12);
    const targetValue = 1 + Math.floor(Math.random() * 6);

    const step = () => {
      const now = performance.now();
      const t = Math.min(1, (now - start) / Math.max(1, duration));
      const eased = easeOutCubic(t);
      const position = startPos.clone().lerp(endPos, eased);
      const wobbleStrength = Math.sin(eased * Math.PI);
      position.addScaledVector(wobble, wobbleStrength * 0.45);
      const bounce = Math.sin(Math.min(1, eased * 1.25) * Math.PI) * bounceHeight * (1 - eased * 0.45);
      position.y = THREE.MathUtils.lerp(startPos.y, endPos.y, eased) + bounce;
      dice.position.copy(position);

      const spinFactor = 1 - eased * 0.35;
      dice.rotation.x += spinVec.x * spinFactor * 0.2;
      dice.rotation.y += spinVec.y * spinFactor * 0.2;
      dice.rotation.z += spinVec.z * spinFactor * 0.2;

      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        if (typeof dice.userData?.setValue === 'function') {
          dice.userData.setValue(targetValue);
        } else {
          setDiceOrientation(dice, targetValue);
        }
        dice.position.copy(endPos);
        resolve(targetValue);
      }
    };

    requestAnimationFrame(step);
  });
}

function makeTokenMaterial(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
}

function makeRook(mat) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.018, 24), mat);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.036, 24), mat);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.004, 8, 24), mat);
  base.position.y = 0.009;
  body.position.y = 0.009 + 0.018;
  rim.position.y = 0.009 + 0.036 + 0.006;
  rim.rotation.x = Math.PI / 2;
  g.add(base, body, rim);
  return g;
}

function ease(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

function Ludo3D({ avatar, username }) {
  const wrapRef = useRef(null);
  const rafRef = useRef(0);
  const zoomRef = useRef({});
  const controlsRef = useRef(null);
  const diceRef = useRef(null);
  const diceTransitionRef = useRef(null);
  const rollDiceRef = useRef(() => {});
  const turnIndicatorRef = useRef(null);
  const stateRef = useRef(null);
  const moveSoundRef = useRef(null);
  const captureSoundRef = useRef(null);
  const cheerSoundRef = useRef(null);
  const fitRef = useRef(() => {});
  const [configOpen, setConfigOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const settingsRef = useRef({ soundEnabled: true });
  const [appearance, setAppearance] = useState(() => {
    if (typeof window === 'undefined') return { ...DEFAULT_APPEARANCE };
    try {
      const stored = window.localStorage?.getItem(APPEARANCE_STORAGE_KEY);
      if (!stored) return { ...DEFAULT_APPEARANCE };
      const parsed = JSON.parse(stored);
      return normalizeAppearance(parsed);
    } catch (error) {
      console.warn('Failed to load Ludo appearance', error);
      return { ...DEFAULT_APPEARANCE };
    }
  });
  const appearanceRef = useRef(appearance);
  const arenaRef = useRef(null);
  const [ui, setUi] = useState({
    turn: 0,
    status: 'Red to roll',
    dice: null,
    winner: null
  });

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
          ? `#${hslToHexNumber(presetRef.hue, presetRef.sat, presetRef.light)
              .toString(16)
              .padStart(6, '0')}`
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
      case 'tableBase':
        return (
          <div className="relative h-14 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950/40">
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="h-10 w-24 rounded-full border border-white/10"
                style={{
                  background: `linear-gradient(135deg, ${option.baseColor}, ${option.trimColor ?? option.baseColor})`,
                  boxShadow: 'inset 0 0 10px rgba(0,0,0,0.35)'
                }}
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-tr from-white/5 via-transparent to-black/40" />
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
      default:
        return null;
    }
  }, []);

  const stopDiceTransition = () => {
    if (diceTransitionRef.current?.cancel) {
      try {
        diceTransitionRef.current.cancel();
      } catch (error) {
        console.warn('Failed to cancel dice transition', error);
      }
    }
    diceTransitionRef.current = null;
  };

  const animateDicePosition = (dice, destination, { duration = 450, lift = 0.04 } = {}) => {
    if (!dice || !destination) return;
    const target = destination.clone ? destination.clone() : new THREE.Vector3().copy(destination);
    stopDiceTransition();
    const startPos = dice.position.clone();
    const started = performance.now();
    const state = { cancelled: false };
    const handle = {
      cancel: () => {
        state.cancelled = true;
      }
    };
    diceTransitionRef.current = handle;
    const step = () => {
      if (state.cancelled) return;
      const now = performance.now();
      const t = Math.min(1, (now - started) / Math.max(1, duration));
      const eased = easeOutCubic(t);
      const pos = startPos.clone().lerp(target, eased);
      if (lift > 0) {
        const arc = Math.sin(Math.PI * eased) * lift * (1 - eased * 0.35);
        pos.y = THREE.MathUtils.lerp(startPos.y, target.y, eased) + arc;
      }
      dice.position.copy(pos);
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        dice.position.copy(target);
        if (diceTransitionRef.current === handle) {
          diceTransitionRef.current = null;
        }
      }
    };
    requestAnimationFrame(step);
  };

  const moveDiceToRail = (player, immediate = false) => {
    const dice = diceRef.current;
    if (!dice) return;
    const rails = dice.userData?.railPositions;
    if (!rails || !rails[player]) return;
    const target = rails[player].clone ? rails[player].clone() : new THREE.Vector3().copy(rails[player]);
    if (immediate) {
      stopDiceTransition();
      dice.position.copy(target);
      return;
    }
    animateDicePosition(dice, target, { duration: 520, lift: 0.05 });
  };

  const updateTurnIndicator = (player, immediate = false) => {
    const indicator = turnIndicatorRef.current;
    if (!indicator) return;
    const material = Array.isArray(indicator.material)
      ? indicator.material[0]
      : indicator.material;
    if (!material) return;
    const color = new THREE.Color(PLAYER_COLORS[player]);
    material.color.set(color);
    if (material.emissive) {
      material.emissive.set(color.clone().multiplyScalar(0.3));
    }
    moveDiceToRail(player, immediate);
  };

  useEffect(() => {
    const applyVolume = (baseVolume) => {
      const level = settingsRef.current.soundEnabled ? baseVolume : 0;
      [moveSoundRef, captureSoundRef, cheerSoundRef].forEach((ref) => {
        if (ref.current) {
          ref.current.volume = level;
          if (!settingsRef.current.soundEnabled) {
            try {
              ref.current.pause();
              ref.current.currentTime = 0;
            } catch {}
          }
        }
      });
    };
    const vol = getGameVolume();
    moveSoundRef.current = new Audio(dropSound);
    captureSoundRef.current = new Audio(snakeSound);
    cheerSoundRef.current = new Audio(cheerSound);
    applyVolume(vol);
    const onVolChange = () => {
      applyVolume(getGameVolume());
    };
    window.addEventListener('gameVolumeChanged', onVolChange);
    return () => {
      window.removeEventListener('gameVolumeChanged', onVolChange);
    };
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage?.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(appearance));
      } catch (error) {
        console.warn('Failed to persist Ludo appearance', error);
      }
    }

    const arena = arenaRef.current;
    if (!arena) return;

    const normalized = normalizeAppearance(appearance);
    const safe = enforceShapeForPlayers(normalized, DEFAULT_PLAYER_COUNT);
    const woodOption = TABLE_WOOD_OPTIONS[safe.tableWood] ?? TABLE_WOOD_OPTIONS[0];
    const clothOption = TABLE_CLOTH_OPTIONS[safe.tableCloth] ?? TABLE_CLOTH_OPTIONS[0];
    const baseOption = TABLE_BASE_OPTIONS[safe.tableBase] ?? TABLE_BASE_OPTIONS[0];
    const chairOption = CHAIR_COLOR_OPTIONS[safe.chairColor] ?? CHAIR_COLOR_OPTIONS[0];
    const { option: shapeOption, rotationY } = getEffectiveShapeConfig(safe.tableShape, DEFAULT_PLAYER_COUNT);

    if (shapeOption) {
      const shapeChanged = shapeOption.id !== arena.tableShapeId;
      const rotationChanged = Math.abs((arena.tableInfo?.rotationY ?? 0) - rotationY) > 1e-3;
      if (shapeChanged || rotationChanged) {
        const boardGroup = arena.boardGroup;
        if (boardGroup && arena.tableInfo?.group) {
          arena.tableInfo.group.remove(boardGroup);
        }
        const nextTable = createMurlanStyleTable({
          arena: arena.arenaGroup,
          renderer: arena.renderer,
          tableRadius: TABLE_RADIUS,
          tableHeight: TABLE_HEIGHT,
          woodOption,
          clothOption,
          baseOption,
          shapeOption,
          rotationY
        });
        applyTableMaterials(nextTable.materials, { woodOption, clothOption, baseOption }, arena.renderer);
        if (boardGroup) {
          boardGroup.position.set(0, nextTable.surfaceY + 0.004, 0);
          nextTable.group.add(boardGroup);
        }
        arena.tableInfo?.dispose?.();
        arena.tableInfo = nextTable;
        arena.tableShapeId = nextTable.shapeId;
        if (arena.boardLookTarget) {
          arena.boardLookTarget.set(0, nextTable.surfaceY + CAMERA_TARGET_LIFT, 0);
        }
        arena.controls?.target.copy(arena.boardLookTarget ?? new THREE.Vector3());
        arena.controls?.update();
        fitRef.current?.();
      } else if (arena.tableInfo?.materials) {
        applyTableMaterials(arena.tableInfo.materials, { woodOption, clothOption, baseOption }, arena.renderer);
      }
    }

    if (chairOption) {
      if (arena.chairMaterial?.userData?.chairId !== (chairOption.id ?? 'default')) {
        const nextMaterial = createChairFabricMaterial(chairOption, arena.renderer);
        arena.chairs?.forEach((chair) => {
          chair.meshes.forEach((mesh) => {
            mesh.material = nextMaterial;
          });
        });
        disposeChairMaterial(arena.chairMaterial);
        arena.chairMaterial = nextMaterial;
      }
      if (arena.legMaterial?.userData?.chairId !== (chairOption.id ?? 'default')) {
        const nextLeg = new THREE.MeshStandardMaterial({
          color: new THREE.Color(chairOption.legColor ?? DEFAULT_STOOL_THEME.legColor)
        });
        nextLeg.userData = { chairId: chairOption.id ?? 'default' };
        arena.chairs?.forEach((chair) => {
          if (chair.legMesh) {
            chair.legMesh.material = nextLeg;
          }
        });
        arena.legMaterial?.dispose?.();
        arena.legMaterial = nextLeg;
      }
    }
  }, [appearance]);

  useEffect(() => {
    settingsRef.current.soundEnabled = soundEnabled;
    const baseVolume = getGameVolume();
    const level = soundEnabled ? baseVolume : 0;
    [moveSoundRef, captureSoundRef, cheerSoundRef].forEach((ref) => {
      if (ref.current) {
        ref.current.volume = level;
        if (!soundEnabled) {
          try {
            ref.current.pause();
            ref.current.currentTime = 0;
          } catch {}
        }
      }
    });
  }, [soundEnabled]);

  useEffect(() => {
    const host = wrapRef.current;
    if (!host) return;

    let scene = null;
    let camera = null;
    let renderer = null;
    let controls = null;
    let animationId = 0;
    const pointer = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();

    const baseVolume = settingsRef.current.soundEnabled ? getGameVolume() : 0;
    [moveSoundRef, captureSoundRef, cheerSoundRef].forEach((ref) => {
      if (ref.current) {
        ref.current.volume = baseVolume;
      }
    });

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.localClippingEnabled = true;
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
    renderer.domElement.style.cursor = 'grab';
    host.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color('#030712');

    camera = new THREE.PerspectiveCamera(CAM.fov, 1, CAM.near, CAM.far);
    camera.position.set(0, TABLE_HEIGHT * 2.85, TABLE_RADIUS * 3.9);

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
    const initialAppearance = enforceShapeForPlayers(initialAppearanceRaw, DEFAULT_PLAYER_COUNT);
    const woodOption = TABLE_WOOD_OPTIONS[initialAppearance.tableWood] ?? TABLE_WOOD_OPTIONS[0];
    const clothOption = TABLE_CLOTH_OPTIONS[initialAppearance.tableCloth] ?? TABLE_CLOTH_OPTIONS[0];
    const baseOption = TABLE_BASE_OPTIONS[initialAppearance.tableBase] ?? TABLE_BASE_OPTIONS[0];
    const chairOption = CHAIR_COLOR_OPTIONS[initialAppearance.chairColor] ?? CHAIR_COLOR_OPTIONS[0];
    const { option: shapeOption, rotationY } = getEffectiveShapeConfig(initialAppearance.tableShape, DEFAULT_PLAYER_COUNT);

    const tableInfo = createMurlanStyleTable({
      arena: arenaGroup,
      renderer,
      tableRadius: TABLE_RADIUS,
      tableHeight: TABLE_HEIGHT,
      woodOption,
      clothOption,
      baseOption,
      shapeOption,
      rotationY
    });
    applyTableMaterials(tableInfo.materials, { woodOption, clothOption, baseOption }, renderer);

    const boardGroup = new THREE.Group();
    boardGroup.position.set(0, tableInfo.surfaceY + 0.004, 0);
    boardGroup.scale.setScalar(BOARD_SCALE);
    tableInfo.group.add(boardGroup);

    const boardLookTarget = new THREE.Vector3(0, tableInfo.surfaceY + CAMERA_TARGET_LIFT, 0);
    camera.lookAt(boardLookTarget);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.minDistance = CAM.minR;
    controls.maxDistance = CAM.maxR;
    controls.minPolarAngle = CAM.phiMin;
    controls.maxPolarAngle = CAM.phiMax;
    controls.target.copy(boardLookTarget);
    controlsRef.current = controls;

    const fit = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
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
    fitRef.current = fit;
    fit();

    const dollyScale = 1 + CAMERA_DOLLY_FACTOR;
    zoomRef.current = {
      zoomIn: () => {
        if (!controls) return;
        controls.dollyIn(dollyScale);
        controls.update();
      },
      zoomOut: () => {
        if (!controls) return;
        controls.dollyOut(dollyScale);
        controls.update();
      }
    };

    const chairMaterial = createChairFabricMaterial(chairOption, renderer);
    const legMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(chairOption.legColor ?? DEFAULT_STOOL_THEME.legColor)
    });
    legMaterial.userData = { chairId: chairOption.id ?? 'default' };

    const chairs = [];
    for (let i = 0; i < DEFAULT_PLAYER_COUNT; i += 1) {
      const angle = Math.PI / 2 - HUMAN_SEAT_ROTATION_OFFSET - (i / DEFAULT_PLAYER_COUNT) * Math.PI * 2;
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
      const armMeshes = [...armLeft.meshes, ...armRight.meshes];
      chairs.push({ group, meshes: [seatMesh, backMesh, ...armMeshes], legMesh: legBase });
    }

    const boardData = buildLudoBoard(boardGroup);
    diceRef.current = boardData.dice;
    turnIndicatorRef.current = boardData.turnIndicator;
    moveDiceToRail(0, true);
    updateTurnIndicator(0, true);

    stateRef.current = {
      paths: boardData.paths,
      startPads: boardData.startPads,
      homeColumns: boardData.homeColumns,
      goalSlots: boardData.goalSlots,
      tokens: boardData.tokens,
      turnIndicator: boardData.turnIndicator,
      progress: Array.from({ length: 4 }, () => Array(4).fill(-1)),
      turn: 0,
      winner: null,
      animation: null
    };

    arenaRef.current = {
      renderer,
      scene,
      camera,
      controls,
      arenaGroup,
      tableInfo,
      tableShapeId: tableInfo.shapeId,
      boardGroup,
      boardLookTarget,
      chairMaterial,
      legMaterial,
      chairs
    };

    const attemptDiceRoll = (clientX, clientY) => {
      const dice = diceRef.current;
      const rollFn = rollDiceRef.current;
      const state = stateRef.current;
      if (
        !dice ||
        !rollFn ||
        !state ||
        state.winner ||
        state.animation ||
        dice.userData?.isRolling
      ) {
        return false;
      }
      const rect = renderer.domElement.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((clientY - rect.top) / rect.height) * 2 + 1;
      pointer.set(x, y);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObject(dice, true);
      if (hit.length) {
        rollFn();
        return true;
      }
      return false;
    };
    let pointerLocked = false;
    const onPointerDown = (event) => {
      const { clientX, clientY } = event;
      if (clientX == null || clientY == null) return;
      const handled = attemptDiceRoll(clientX, clientY);
      if (handled) {
        pointerLocked = true;
        if (controls) controls.enabled = false;
        event.preventDefault();
      }
    };
    const onPointerUp = () => {
      if (!pointerLocked) return;
      pointerLocked = false;
      if (controls) controls.enabled = true;
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown, { passive: false });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointercancel', onPointerUp, { passive: true });

    const step = () => {
      if (diceRef.current) {
        const lights = diceRef.current.userData?.lights;
        if (lights?.accent) {
          const pos = diceRef.current.getWorldPosition(new THREE.Vector3());
          lights.accent.position.copy(pos).add(lights.accent.userData.offset);
          lights.fill.position.copy(pos).add(lights.fill.userData.offset);
          lights.target.position.copy(pos);
        }
      }
      controls?.update();
      renderer.render(scene, camera);
      animationId = requestAnimationFrame(step);
    };
    animationId = requestAnimationFrame(step);

    const onResize = () => fit();
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animationId);
      stateRef.current = null;
      turnIndicatorRef.current = null;
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      controlsRef.current = null;
      controls?.dispose();
      controls = null;
      stopDiceTransition();
      diceRef.current = null;
      const arena = arenaRef.current;
      if (arena) {
        arena.chairs?.forEach((chair) => {
          if (chair.group.parent) {
            chair.group.parent.remove(chair.group);
          }
          chair.meshes.forEach((mesh) => {
            mesh.geometry?.dispose?.();
          });
          chair.legMesh?.geometry?.dispose?.();
        });
        disposeChairMaterial(arena.chairMaterial);
        arena.legMaterial?.dispose?.();
        arena.tableInfo?.dispose?.();
      }
      arenaRef.current = null;
      renderer.dispose();
      if (renderer.domElement.parentElement === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, []);

  const playMove = () => {
    if (!settingsRef.current.soundEnabled) return;
    if (moveSoundRef.current) {
      moveSoundRef.current.currentTime = 0;
      moveSoundRef.current.play().catch(() => {});
    }
  };

  const playCapture = () => {
    if (!settingsRef.current.soundEnabled) return;
    if (captureSoundRef.current) {
      captureSoundRef.current.currentTime = 0;
      captureSoundRef.current.play().catch(() => {});
    }
  };

  const playCheer = () => {
    if (!settingsRef.current.soundEnabled) return;
    if (cheerSoundRef.current) {
      cheerSoundRef.current.currentTime = 0;
      cheerSoundRef.current.play().catch(() => {});
    }
  };

  const getWorldForProgress = (player, progress, tokenIndex) => {
    const state = stateRef.current;
    if (!state) return new THREE.Vector3();
    if (progress < 0) {
      return state.startPads[player][tokenIndex]
        .clone()
        .add(new THREE.Vector3(0, 0.012, 0));
    }
    if (progress < RING_STEPS) {
      const idx = (PLAYER_START_INDEX[player] + progress) % RING_STEPS;
      return state.paths[idx].clone().add(new THREE.Vector3(0, 0.012, 0));
    }
    if (progress < RING_STEPS + HOME_STEPS) {
      const homeStep = progress - RING_STEPS;
      return state.homeColumns[player][homeStep]
        .clone()
        .add(new THREE.Vector3(0, 0.012, 0));
    }
    return state.goalSlots[player][tokenIndex]
      .clone()
      .add(new THREE.Vector3(0, 0.012, 0));
  };

  const scheduleMove = (player, tokenIndex, targetProgress, onComplete) => {
    const state = stateRef.current;
    if (!state) return;
    const fromProgress = state.progress[player][tokenIndex];
    const path = [];
    if (fromProgress < 0) {
      path.push(getWorldForProgress(player, -1, tokenIndex));
      path.push(getWorldForProgress(player, 0, tokenIndex));
    } else {
      path.push(getWorldForProgress(player, fromProgress, tokenIndex));
      for (let p = fromProgress + 1; p <= targetProgress; p++) {
        path.push(getWorldForProgress(player, p, tokenIndex));
      }
    }
    const token = state.tokens[player][tokenIndex];
    state.animation = {
      active: true,
      token,
      path,
      segment: 0,
      t: 0,
      onComplete
    };
  };

  const advanceTurn = (extraTurn) => {
    setUi((s) => {
      if (s.winner) return s;
      const nextTurn = extraTurn ? s.turn : (s.turn + 1) % 4;
      const state = stateRef.current;
      if (state) state.turn = nextTurn;
      updateTurnIndicator(nextTurn);
      return {
        ...s,
        turn: nextTurn,
        status: `${COLOR_NAMES[nextTurn]} to roll`,
        dice: null
      };
    });
  };

  const handleCaptures = (player, tokenIndex) => {
    const state = stateRef.current;
    if (!state) return;
    const prog = state.progress[player][tokenIndex];
    if (prog < 0 || prog >= RING_STEPS) return;
    const landingIdx = (PLAYER_START_INDEX[player] + prog) % RING_STEPS;
    const safeStarts = [0, 8, 16, 24];
    if (safeStarts.includes(landingIdx)) return;
    for (let p = 0; p < 4; p++) {
      if (p === player) continue;
      for (let t = 0; t < 4; t++) {
        if (state.progress[p][t] < 0 || state.progress[p][t] >= RING_STEPS) continue;
        const idx = (PLAYER_START_INDEX[p] + state.progress[p][t]) % RING_STEPS;
        if (idx === landingIdx) {
          state.progress[p][t] = -1;
          const token = state.tokens[p][t];
          const pos = state.startPads[p][t]
            .clone()
            .add(new THREE.Vector3(0, 0.012, 0));
          token.position.copy(pos);
          token.rotation.set(0, 0, 0);
          playCapture();
        }
      }
    }
  };

  const checkWin = (player) => {
    const state = stateRef.current;
    if (!state) return false;
    const allHome = state.progress[player].every((p) => p >= GOAL_PROGRESS);
    if (allHome) {
      state.winner = player;
      setUi((s) => ({
        ...s,
        winner: COLOR_NAMES[player],
        status: `${COLOR_NAMES[player]} wins!`
      }));
      playCheer();
      coinConfetti();
      return true;
    }
    return false;
  };

  const moveToken = (player, tokenIndex, roll) => {
    const state = stateRef.current;
    if (!state) return;
    const current = state.progress[player][tokenIndex];
    const entering = current < 0;
    const target = entering ? 0 : current + roll;
    if (target > GOAL_PROGRESS) return advanceTurn(false);
    const applyResult = () => {
      state.progress[player][tokenIndex] = target;
      const finalPos = getWorldForProgress(player, target, tokenIndex);
      state.tokens[player][tokenIndex].position.copy(finalPos);
      state.tokens[player][tokenIndex].rotation.set(0, 0, 0);
      playMove();
      handleCaptures(player, tokenIndex);
      const winner = checkWin(player);
      advanceTurn(!winner && roll === 6);
    };
    if (entering || target !== current) {
      scheduleMove(player, tokenIndex, target, applyResult);
    } else {
      applyResult();
    }
  };

  const getMovableTokens = (player, roll) => {
    const state = stateRef.current;
    if (!state) return [];
    const list = [];
    for (let i = 0; i < 4; i++) {
      const prog = state.progress[player][i];
      if (prog < 0) {
        if (roll === 6) list.push({ token: i, entering: true });
        continue;
      }
      const target = prog + roll;
      if (target <= GOAL_PROGRESS) list.push({ token: i, entering: false });
    }
    return list;
  };

  const rollDice = async () => {
    const state = stateRef.current;
    if (!state || state.winner) return;
    if (state.animation) return;
    const dice = diceRef.current;
    if (!dice || dice.userData?.isRolling) return;
    const player = state.turn;
    const baseHeight = dice.userData?.baseHeight ?? DICE_BASE_HEIGHT;
    const rollTargets = dice.userData?.rollTargets;
    const clothLimit = dice.userData?.clothLimit ?? BOARD_CLOTH_HALF - 0.12;
    const baseTarget = rollTargets?.[player]?.clone() ?? new THREE.Vector3(0, baseHeight, 0);
    const jitter = new THREE.Vector3((Math.random() - 0.5) * 0.18, 0, (Math.random() - 0.5) * 0.18);
    baseTarget.add(jitter);
    baseTarget.x = THREE.MathUtils.clamp(baseTarget.x, -clothLimit, clothLimit);
    baseTarget.z = THREE.MathUtils.clamp(baseTarget.z, -clothLimit, clothLimit);
    baseTarget.y = baseHeight;
    stopDiceTransition();
    dice.userData.isRolling = true;
    const value = await spinDice(dice, {
      duration: 950,
      targetPosition: baseTarget,
      bounceHeight: dice.userData?.bounceHeight ?? 0.06
    });
    dice.userData.isRolling = false;
    setUi((s) => ({ ...s, dice: value }));
    const options = getMovableTokens(player, value);
    if (!options.length) {
      advanceTurn(value === 6);
      return;
    }
    const choice = options[0];
    moveToken(player, choice.token, value);
  };

  rollDiceRef.current = rollDice;

  return (
    <div
      ref={wrapRef}
      className="fixed inset-0 bg-[#0c1020] text-white touch-none select-none"
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-4 left-4 z-20 flex flex-col items-start gap-3 pointer-events-none">
          <div className="pointer-events-none rounded bg-white/10 px-3 py-2 text-xs">
            <div className="font-semibold">{ui.status}</div>
            {ui.dice != null && (
              <div className="mt-1 text-[10px]">Rolled: {ui.dice}</div>
            )}
          </div>
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
                          key === 'tableShape' && option.id === DIAMOND_SHAPE_ID && DEFAULT_PLAYER_COUNT > 4;
                        return (
                          <button
                            key={option.id ?? idx}
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
                            <span className="mt-2 text-center text-[0.65rem] font-semibold text-gray-200">
                              {option.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-3">
                <label className="flex items-center justify-between text-[0.7rem] text-gray-200">
                  <span>Efekte zanore</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border border-emerald-400/40 bg-transparent text-emerald-400 focus:ring-emerald-500"
                    checked={soundEnabled}
                    onChange={(event) => setSoundEnabled(event.target.checked)}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    fitRef.current?.();
                    setConfigOpen(false);
                  }}
                  className="w-full rounded-lg bg-white/10 py-2 text-center text-[0.7rem] font-semibold text-white transition hover:bg-white/20"
                >
                  Centro kamerën
                </button>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="w-full rounded-lg bg-emerald-500/20 py-2 text-center text-[0.7rem] font-semibold text-emerald-200 transition hover:bg-emerald-500/30"
                >
                  Rifillo lojën
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="absolute top-3 right-3 flex items-center space-x-3 pointer-events-auto">
          <div className="flex items-center space-x-2 rounded-full bg-white/10 px-3 py-1 text-xs">
            {avatar && (
              <img src={avatar} alt="avatar" className="h-7 w-7 rounded-full object-cover" />
            )}
            <span>{username || 'Guest'}</span>
          </div>
        </div>
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="px-5 py-2 rounded-full bg-[rgba(7,10,18,0.65)] border border-[rgba(255,215,0,0.25)] text-sm font-semibold backdrop-blur">
            {ui.winner
              ? `${ui.winner} Wins`
              : ui.turn === 0
              ? 'Your turn — tap the dice to roll'
              : ui.status}
          </div>
        </div>
        <div className="absolute right-3 bottom-3 flex flex-col space-y-2">
          <button
            onClick={() => zoomRef.current.zoomIn?.()}
            className="text-xl bg-white/10 hover:bg-white/20 rounded px-2 py-1"
          >
            +
          </button>
          <button
            onClick={() => zoomRef.current.zoomOut?.()}
            className="text-xl bg-white/10 hover:bg-white/20 rounded px-2 py-1"
          >
            -
          </button>
        </div>
      </div>
    </div>
  );
}

function buildLudoBoard(boardGroup) {
  const scene = boardGroup;
  const plateMat = new THREE.MeshStandardMaterial({
    color: 0x11172a,
    roughness: 0.92
  });
  const tileMat = new THREE.MeshStandardMaterial({
    color: 0xf3f4f6,
    roughness: 0.9
  });
  const safeMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.85
  });
  const centerMat = new THREE.MeshStandardMaterial({
    color: 0x1f2937,
    roughness: 0.9
  });

  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(RAW_BOARD_SIZE + 0.04, 0.02, RAW_BOARD_SIZE + 0.04),
    plateMat
  );
  plate.position.y = -0.011;
  scene.add(plate);

  const half = (LUDO_GRID * LUDO_TILE) / 2;
  const cellToWorld = (r, c) => {
    const x = -half + (c + 0.5) * LUDO_TILE;
    const z = -half + (r + 0.5) * LUDO_TILE;
    return new THREE.Vector3(x, 0.005, z);
  };

  const startPads = getHomeStartPads(half);
  const homeColumns = [[], [], [], []];
  const goalSlots = getGoalSlots(half);
  const ringPath = buildRingFromGrid(cellToWorld);

  const tileGeo = new THREE.BoxGeometry(LUDO_TILE * 0.96, 0.01, LUDO_TILE * 0.96);
  const homeBaseMats = PLAYER_COLORS.map((color) => {
    const darker = new THREE.Color(color).multiplyScalar(0.72);
    return new THREE.MeshStandardMaterial({ color: darker, roughness: 0.85 });
  });
  const pathMats = PLAYER_COLORS.map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.8 })
  );
  const safeSet = new Set(['6,0', '0,8', '8,14', '14,6']);
  const center = cellToWorld(7, 7);

  for (let r = 0; r < LUDO_GRID; r++) {
    for (let c = 0; c < LUDO_GRID; c++) {
      const pos = cellToWorld(r, c);
      const key = `${r},${c}`;
      const homeIndex = getHomeIndex(r, c);
      const columnIndex = getHomeColumnIndex(r, c);
      const inCenter = r >= 6 && r <= 8 && c >= 6 && c <= 8;
      const inCross = r >= 6 && r <= 8 || c >= 6 && c <= 8;
      if (homeIndex !== -1) {
        const mesh = new THREE.Mesh(tileGeo, homeBaseMats[homeIndex]);
        mesh.position.copy(pos);
        scene.add(mesh);
        continue;
      }
      if (inCenter) {
        const mesh = new THREE.Mesh(tileGeo, centerMat);
        mesh.position.copy(pos);
        scene.add(mesh);
        continue;
      }
      if (columnIndex !== -1) {
        const mesh = new THREE.Mesh(tileGeo, pathMats[columnIndex]);
        mesh.position.copy(pos);
        scene.add(mesh);
        const dist = pos.distanceTo(center);
        homeColumns[columnIndex].push({ dist, pos });
        continue;
      }
      if (inCross) {
        const mat = safeSet.has(key) ? safeMat : tileMat;
        const mesh = new THREE.Mesh(tileGeo, mat);
        mesh.position.copy(pos);
        scene.add(mesh);
      }
    }
  }

  const sortedColumns = homeColumns.map((list) =>
    list
      .sort((a, b) => b.dist - a.dist)
      .map((item) => item.pos.clone())
  );

  const tokens = PLAYER_COLORS.map((color, playerIdx) => {
    return Array.from({ length: 4 }, (_, i) => {
      const rook = makeRook(makeTokenMaterial(color));
      rook.position.copy(startPads[playerIdx][i].clone().add(new THREE.Vector3(0, 0.012, 0)));
      scene.add(rook);
      return rook;
    });
  });

  const dice = makeDice();
  const clothHalf = BOARD_CLOTH_HALF;
  const railDistance = clothHalf + 0.09;
  const railHeight = DICE_BASE_HEIGHT + 0.024;
  const rollRadius = clothHalf * 0.45;
  const railPositions = [
    new THREE.Vector3(0, railHeight, -railDistance),
    new THREE.Vector3(railDistance, railHeight, 0),
    new THREE.Vector3(0, railHeight, railDistance),
    new THREE.Vector3(-railDistance, railHeight, 0)
  ];
  const rollTargets = [
    new THREE.Vector3(0, DICE_BASE_HEIGHT, -rollRadius),
    new THREE.Vector3(rollRadius, DICE_BASE_HEIGHT, 0),
    new THREE.Vector3(0, DICE_BASE_HEIGHT, rollRadius),
    new THREE.Vector3(-rollRadius, DICE_BASE_HEIGHT, 0)
  ];
  dice.position.copy(railPositions[0]);
  dice.userData.railPositions = railPositions.map((pos) => pos.clone());
  dice.userData.rollTargets = rollTargets.map((pos) => pos.clone());
  dice.userData.baseHeight = DICE_BASE_HEIGHT;
  dice.userData.railHeight = railHeight;
  dice.userData.bounceHeight = 0.07;
  dice.userData.clothLimit = clothHalf - 0.12;
  dice.userData.isRolling = false;
  scene.add(dice);

  const diceLightTarget = new THREE.Object3D();
  scene.add(diceLightTarget);

  const diceAccent = new THREE.SpotLight(0xffffff, 2.1, 3.4, Math.PI / 5, 0.42, 1.25);
  diceAccent.userData.offset = new THREE.Vector3(0.45, 1.55, 1.05);
  diceAccent.target = diceLightTarget;
  scene.add(diceAccent);

  const diceFill = new THREE.PointLight(0xfff8e1, 1.05, 2.6, 2.2);
  diceFill.userData.offset = new THREE.Vector3(-0.65, 1.25, -0.75);
  scene.add(diceFill);

  dice.userData.lights = {
    accent: diceAccent,
    fill: diceFill,
    target: diceLightTarget
  };

  const indicatorMat = new THREE.MeshStandardMaterial({
    color: PLAYER_COLORS[0],
    emissive: new THREE.Color(PLAYER_COLORS[0]).multiplyScalar(0.3),
    emissiveIntensity: 0.9,
    metalness: 0.45,
    roughness: 0.35,
    side: THREE.DoubleSide
  });
  const turnIndicator = new THREE.Mesh(
    new THREE.RingGeometry(0.05, 0.075, 48),
    indicatorMat
  );
  turnIndicator.rotation.x = -Math.PI / 2;
  turnIndicator.position.set(0, 0.006, 0);
  scene.add(turnIndicator);

  return {
    paths: ringPath,
    startPads,
    homeColumns: sortedColumns,
    goalSlots,
    tokens,
    dice,
    turnIndicator
  };
}

function getHomeIndex(r, c) {
  if (r < 6 && c < 6) return 0;
  if (r < 6 && c > 8) return 1;
  if (r > 8 && c < 6) return 2;
  if (r > 8 && c > 8) return 3;
  return -1;
}

function getHomeColumnIndex(r, c) {
  if (c === 7 && r >= 3 && r <= 6) return 0;
  if (r === 7 && c >= 8 && c <= 11) return 1;
  if (c === 7 && r >= 8 && r <= 11) return 3;
  if (r === 7 && c >= 3 && c <= 6) return 2;
  return -1;
}

function buildRingFromGrid(cellToWorld) {
  const pts = [];
  for (let c = 0; c < 15; c++) pts.push(cellToWorld(6, c));
  for (let r = 7; r < 15; r++) pts.push(cellToWorld(r, 8));
  for (let c = 14; c >= 0; c--) pts.push(cellToWorld(8, c));
  for (let r = 7; r >= 1; r--) pts.push(cellToWorld(r, 6));
  const dedup = [];
  const keySet = new Set();
  for (const p of pts) {
    const key = `${p.x.toFixed(3)},${p.z.toFixed(3)}`;
    if (!keySet.has(key)) {
      keySet.add(key);
      dedup.push(p.clone());
    }
  }
  if (dedup.length > 52) {
    const out = [];
    const step = (dedup.length - 1) / 52;
    for (let i = 0; i < 52; i++) {
      out.push(dedup[Math.round(i * step)].clone());
    }
    return out;
  }
  return dedup;
}

function getHomeStartPads(half) {
  const TILE = LUDO_TILE;
  const off = half - TILE * 3;
  const layout = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1]
  ];
  return layout.map(([sx, sz]) => {
    const cx = sx * off;
    const cz = sz * off;
    return [
      new THREE.Vector3(cx - 0.8 * TILE, 0, cz - 0.8 * TILE),
      new THREE.Vector3(cx + 0.8 * TILE, 0, cz - 0.8 * TILE),
      new THREE.Vector3(cx - 0.8 * TILE, 0, cz + 0.8 * TILE),
      new THREE.Vector3(cx + 0.8 * TILE, 0, cz + 0.8 * TILE)
    ];
  });
}

function getGoalSlots(half) {
  const TILE = LUDO_TILE;
  const offsets = [
    [-TILE * 0.3, -TILE * 0.3],
    [TILE * 0.3, -TILE * 0.3],
    [-TILE * 0.3, TILE * 0.3],
    [TILE * 0.3, TILE * 0.3]
  ];
  return Array.from({ length: 4 }, (_, player) =>
    offsets.map(([ox, oz]) => new THREE.Vector3(ox, 0.01, oz))
  );
}

export default function LudoBattleRoyal() {
  useTelegramBackButton();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const avatar = params.get('avatar') || getTelegramPhotoUrl();
  const username =
    params.get('username') ||
    params.get('name') ||
    getTelegramFirstName() ||
    getTelegramUsername();
  return <Ludo3D avatar={avatar} username={username} />;
}
