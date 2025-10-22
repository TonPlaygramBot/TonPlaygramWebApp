import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  createArenaCarpetMaterial,
  createArenaWallMaterial
} from '../../utils/arenaDecor.js';
import { applyRendererSRGB, applySRGBColorSpace } from '../../utils/colorSpace.js';
import { ARENA_CAMERA_DEFAULTS, buildArenaCameraConfig } from '../../utils/arenaCameraConfig.js';
import { createMurlanStyleTable, applyTableMaterials } from '../../utils/murlanTable.js';
import {
  WOOD_FINISH_PRESETS,
  WOOD_GRAIN_OPTIONS,
  WOOD_GRAIN_OPTIONS_BY_ID,
  hslToHexNumber
} from '../../utils/woodMaterials.js';
import {
  TABLE_WOOD_OPTIONS,
  TABLE_CLOTH_OPTIONS,
  TABLE_BASE_OPTIONS,
  DEFAULT_TABLE_CUSTOMIZATION,
  WOOD_PRESETS_BY_ID
} from '../../utils/tableCustomizationOptions.js';
import { CARD_THEMES } from '../../utils/cardThemes.js';
import {
  ComboType,
  DEFAULT_CONFIG as BASE_CONFIG,
  aiChooseAction,
  canBeat,
  detectCombo,
  sortHand
} from '../../../../lib/murlan.js';

const MODEL_SCALE = 0.75;
const ARENA_GROWTH = 1.45; // expanded arena footprint for wider walkways

const TABLE_RADIUS = 3.4 * MODEL_SCALE;
const CHAIR_COUNT = 4;
const CUSTOM_SEAT_ANGLES = [
  THREE.MathUtils.degToRad(90),
  THREE.MathUtils.degToRad(315),
  THREE.MathUtils.degToRad(270),
  THREE.MathUtils.degToRad(225)
];

const FLAG_EMOJIS = ['🇦🇱', '🇺🇸', '🇫🇷', '🇬🇧', '🇮🇹', '🇩🇪', '🇯🇵', '🇨🇦'];

const SUITS = ['♠', '♥', '♦', '♣'];
const SUIT_COLORS = {
  '♠': '#111111',
  '♣': '#111111',
  '♥': '#cc2233',
  '♦': '#cc2233',
  '🃏': '#111111'
};

const OUTFIT_THEMES = [
  { id: 'midnight', label: 'Blu Mbretëror', baseColor: '#1f3c88', accentColor: '#f5d547', glow: '#0f172a' },
  { id: 'ember', label: 'E Kuqe Neon', baseColor: '#a31621', accentColor: '#ff8e3c', glow: '#22080b' },
  { id: 'glacier', label: 'Akull', baseColor: '#1b8dbf', accentColor: '#9ff0ff', glow: '#082433' },
  { id: 'forest', label: 'Pyje', baseColor: '#1b7f4a', accentColor: '#b5f44a', glow: '#071f11' },
  { id: 'royal', label: 'Vjollcë', baseColor: '#6b21a8', accentColor: '#f0abfc', glow: '#220a35' },
  { id: 'onyx', label: 'Oniks', baseColor: '#1f2937', accentColor: '#9ca3af', glow: '#090b10' }
];

const STOOL_THEMES = [
  { id: 'ruby', label: 'Rubi', seatColor: '#8b0000', legColor: '#1f1f1f' },
  { id: 'slate', label: 'Guri', seatColor: '#374151', legColor: '#0f172a' },
  { id: 'teal', label: 'Bruz', seatColor: '#0f766e', legColor: '#082f2a' },
  { id: 'amber', label: 'Qelibari', seatColor: '#b45309', legColor: '#2f2410' },
  { id: 'violet', label: 'Vjollcë', seatColor: '#7c3aed', legColor: '#2b1059' },
  { id: 'frost', label: 'Akull', seatColor: '#1f2937', legColor: '#0f172a' }
];

const DEFAULT_APPEARANCE = {
  outfit: 0,
  stools: 0,
  ...DEFAULT_TABLE_CUSTOMIZATION
};
const APPEARANCE_STORAGE_KEY = 'murlanRoyaleAppearance';
const CUSTOMIZATION_SECTIONS = [
  { key: 'tableWood', label: 'Dru i Tavolinës', options: TABLE_WOOD_OPTIONS },
  { key: 'tableCloth', label: 'Rroba e Tavolinës', options: TABLE_CLOTH_OPTIONS },
  { key: 'tableBase', label: 'Baza e Tavolinës', options: TABLE_BASE_OPTIONS },
  { key: 'cards', label: 'Letrat', options: CARD_THEMES },
  { key: 'stools', label: 'Stola', options: STOOL_THEMES }
];

function createRegularPolygonShape(sides = 8, radius = 1) {
  const shape = new THREE.Shape();
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    const x = Math.cos(a) * radius;
    const y = Math.sin(a) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

function normalizeAppearance(value = {}) {
  const normalized = { ...DEFAULT_APPEARANCE };
  const entries = [
    ['outfit', OUTFIT_THEMES.length],
    ['tableWood', TABLE_WOOD_OPTIONS.length],
    ['tableCloth', TABLE_CLOTH_OPTIONS.length],
    ['tableBase', TABLE_BASE_OPTIONS.length],
    ['cards', CARD_THEMES.length],
    ['stools', STOOL_THEMES.length]
  ];
  entries.forEach(([key, max]) => {
    const raw = Number(value?.[key]);
    if (Number.isFinite(raw)) {
      const clamped = Math.min(Math.max(0, Math.round(raw)), max - 1);
      normalized[key] = clamped;
    }
  });
  const legacyTable = Number(value?.table);
  if (Number.isFinite(legacyTable)) {
    const legacyIndex = Math.min(
      Math.max(0, Math.round(legacyTable)),
      Math.min(TABLE_CLOTH_OPTIONS.length, TABLE_BASE_OPTIONS.length) - 1
    );
    if (!Number.isFinite(Number(value?.tableWood))) {
      normalized.tableWood = Math.min(legacyIndex, TABLE_WOOD_OPTIONS.length - 1);
    }
    if (!Number.isFinite(Number(value?.tableCloth))) {
      normalized.tableCloth = Math.min(legacyIndex, TABLE_CLOTH_OPTIONS.length - 1);
    }
    if (!Number.isFinite(Number(value?.tableBase))) {
      normalized.tableBase = Math.min(legacyIndex, TABLE_BASE_OPTIONS.length - 1);
    }
  }
  return normalized;
}

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
const BASE_TABLE_HEIGHT = 1.08 * MODEL_SCALE;
const BASE_HUMAN_CHAIR_RADIUS = 5.6 * MODEL_SCALE * ARENA_GROWTH * 0.85;
const HUMAN_CHAIR_PULLBACK = 0.32 * MODEL_SCALE;
const CHAIR_RADIUS = BASE_HUMAN_CHAIR_RADIUS + HUMAN_CHAIR_PULLBACK;
const CHAIR_BASE_HEIGHT = BASE_TABLE_HEIGHT - SEAT_THICKNESS * 0.85;
const STOOL_HEIGHT = CHAIR_BASE_HEIGHT + SEAT_THICKNESS;
const TABLE_HEIGHT_LIFT = 0.05 * MODEL_SCALE;
const TABLE_HEIGHT = STOOL_HEIGHT + TABLE_HEIGHT_LIFT;
const TABLE_HEIGHT_RAISE = TABLE_HEIGHT - BASE_TABLE_HEIGHT;
const ARENA_WALL_HEIGHT = 3.6 * 1.3;
const ARENA_WALL_CENTER_Y = ARENA_WALL_HEIGHT / 2;
const ARENA_WALL_TOP_Y = ARENA_WALL_CENTER_Y + ARENA_WALL_HEIGHT / 2;
const CAMERA_WALL_HEIGHT_MARGIN = 0.1 * MODEL_SCALE;
const CAMERA_TARGET_LIFT = 0.04 * MODEL_SCALE;
const CAMERA_DEFAULT_TARGET = new THREE.Vector3(0, TABLE_HEIGHT + CAMERA_TARGET_LIFT, 0);
const CAMERA_FOCUS_CENTER_LIFT = -0.16 * MODEL_SCALE;
const CAMERA_CENTER_TARGET = new THREE.Vector3(
  0,
  TABLE_HEIGHT + CAMERA_TARGET_LIFT + CAMERA_FOCUS_CENTER_LIFT,
  0
);
const CAMERA_SIDE_SWING_FACTOR = 0.8;
const CAMERA_SIDE_THRESHOLD = 0.45;
const HUMAN_SELECTION_OFFSET = 0.14 * MODEL_SCALE;
const CARD_ANIMATION_DURATION = 420;
const CAMERA_AZIMUTH_SWING = THREE.MathUtils.degToRad(15);
const CAMERA_HEAD_LIMIT = THREE.MathUtils.degToRad(175);
const CAMERA_WALL_PADDING = 0.9 * MODEL_SCALE;
const CAMERA_TRANSITION_DURATION = 520;
const AI_TURN_DELAY = 2000;
const TURN_FOCUS_HOLD_MS = AI_TURN_DELAY;

const GAME_CONFIG = { ...BASE_CONFIG };
const START_CARD = { rank: '3', suit: '♠' };

export default function MurlanRoyaleArena({ search }) {
  const mountRef = useRef(null);
  const players = useMemo(() => buildPlayers(search), [search]);

  const [appearance, setAppearance] = useState(() => {
    if (typeof window === 'undefined') return { ...DEFAULT_APPEARANCE };
    try {
      const stored = window.localStorage?.getItem(APPEARANCE_STORAGE_KEY);
      if (!stored) return { ...DEFAULT_APPEARANCE };
      const parsed = JSON.parse(stored);
      return normalizeAppearance(parsed);
    } catch (error) {
      console.warn('Failed to load appearance', error);
      return { ...DEFAULT_APPEARANCE };
    }
  });
  const appearanceRef = useRef(appearance);
  const [configOpen, setConfigOpen] = useState(false);

  const [gameState, setGameState] = useState(() => initializeGame(players));
  const [selectedIds, setSelectedIds] = useState([]);
  const [uiState, setUiState] = useState(() => computeUiState(gameState));
  const [actionError, setActionError] = useState('');
  const [threeReady, setThreeReady] = useState(false);

  const gameStateRef = useRef(gameState);
  const selectedRef = useRef(selectedIds);
  const humanTurnRef = useRef(false);

  const threeStateRef = useRef({
    renderer: null,
    scene: null,
    camera: null,
    controls: null,
    cameraTarget: null,
    cameraSpherical: null,
    cameraRadius: null,
    cameraIdealRadius: null,
    cameraPhi: null,
    cameraAzimuthSwing: CAMERA_AZIMUTH_SWING,
    cameraHomeTheta: null,
    cameraHeadLimit: CAMERA_HEAD_LIMIT,
    cameraAnimationId: null,
    cameraChangeHandler: null,
    cameraBounds: null,
    cameraAdjusting: false,
    arena: null,
    cardGeometry: null,
    cardMap: new Map(),
    faceTextureCache: new Map(),
    labelTextures: [],
    labelMaterials: [],
    seatConfigs: [],
    selectionTargets: [],
    animations: [],
    raycaster: new THREE.Raycaster(),
    tableAnchor: new THREE.Vector3(0, TABLE_HEIGHT + CARD_SURFACE_OFFSET, 0),
    discardAnchor: new THREE.Vector3(-TABLE_RADIUS * 0.76, TABLE_HEIGHT - CARD_H * 0.3, -TABLE_RADIUS * 0.62),
    scoreboard: null,
    tableInfo: null,
    chairMaterials: null,
    outfitParts: null,
    cardThemeId: '',
    appearance: { ...DEFAULT_APPEARANCE }
  });
  const soundsRef = useRef({ card: null, turn: null });
  const audioStateRef = useRef({ tableIds: [], activePlayer: null, status: null, initialized: false });
  const prevStateRef = useRef(null);
  const focusTimerRef = useRef(null);

  const ensureCardMeshes = useCallback((state) => {
    const three = threeStateRef.current;
    if (!three.arena || !three.cardGeometry) return;
    const theme = CARD_THEMES[appearanceRef.current.cards] ?? CARD_THEMES[0];
    three.cardThemeId = theme.id;
    state.allCards.forEach((card) => {
      if (three.cardMap.has(card.id)) return;
      const mesh = createCardMesh(card, three.cardGeometry, three.faceTextureCache, theme);
      mesh.visible = false;
      mesh.position.set(0, -10, 0);
      three.arena.add(mesh);
      three.cardMap.set(card.id, { mesh });
    });
  }, []);

  const updateScoreboardDisplay = useCallback((entries = []) => {
    const store = threeStateRef.current;
    const scoreboard = store.scoreboard;
    if (!scoreboard?.context || !scoreboard.texture || !scoreboard.mesh || !scoreboard.canvas) return;
    const { canvas, context, texture, mesh } = scoreboard;
    const { width, height } = canvas;

    context.clearRect(0, 0, width, height);

    if (!entries?.length) {
      mesh.visible = false;
      texture.needsUpdate = true;
      return;
    }

    mesh.visible = true;
    context.save();
    const padding = 36;
    const innerWidth = width - padding * 2;
    context.fillStyle = 'rgba(8, 12, 24, 0.82)';
    context.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    context.lineWidth = 12;
    roundRect(context, padding, padding, innerWidth, height - padding * 2, 48);
    context.fill();
    context.stroke();
    context.clip();

    context.textAlign = 'left';
    context.textBaseline = 'alphabetic';
    context.fillStyle = 'rgba(226, 232, 240, 0.82)';
    context.font = '700 64px "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI"';
    context.fillText('Rezultati', padding + 24, 120);
    context.font = '500 28px "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI"';
    context.fillStyle = 'rgba(148, 163, 184, 0.8)';
    context.fillText('Kartat e mbetura', padding + 24, 160);

    const rowHeight = 76;
    const rowGap = 12;
    const rowWidth = innerWidth - 48;
    const rowX = padding + 24;
    const maxRows = Math.min(entries.length, 4);

    for (let i = 0; i < maxRows; i += 1) {
      const entry = entries[i];
      const rowY = 168 + i * (rowHeight + rowGap);
      const isActive = Boolean(entry?.isActive);
      const finished = Boolean(entry?.finished);
      const displayName = typeof entry?.name === 'string' ? entry.name : 'Lojtar';
      const trimmedName = displayName.trim();
      const fallbackInitial = trimmedName ? trimmedName.charAt(0).toUpperCase() : '🂠';
      const avatar = entry?.avatar && !entry.avatar.startsWith('http') ? entry.avatar : fallbackInitial;

      context.fillStyle = isActive ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.08)';
      roundRect(context, rowX, rowY, rowWidth, rowHeight, 28);
      context.fill();
      context.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      context.lineWidth = 4;
      roundRect(context, rowX, rowY, rowWidth, rowHeight, 28);
      context.stroke();

      context.textBaseline = 'middle';
      context.textAlign = 'left';
      context.font = '700 60px "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI"';
      context.fillStyle = '#f8fafc';
      context.fillText(avatar, rowX + 36, rowY + rowHeight / 2);

      context.save();
      context.beginPath();
      context.rect(rowX + 110, rowY + 18, rowWidth - 220, rowHeight - 36);
      context.clip();
      context.font = '600 40px "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI"';
      context.fillStyle = '#e2e8f0';
      context.fillText(displayName, rowX + 110, rowY + rowHeight / 2);
      context.restore();

      context.textAlign = 'right';
      context.font = '700 42px "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI"';
      context.fillStyle = finished ? '#4ade80' : '#f1f5f9';
      const scoreLabel = finished ? '🏁' : String(entry?.cardsLeft ?? 0);
      context.fillText(scoreLabel, rowX + rowWidth - 32, rowY + rowHeight / 2);
    }

    context.restore();
    texture.needsUpdate = true;
  }, []);

  const moveCameraToTheta = useCallback((theta, immediateOrOptions = false) => {
    const options =
      typeof immediateOrOptions === 'boolean'
        ? { immediate: immediateOrOptions }
        : immediateOrOptions ?? {};
    const { immediate = false, target = null } = options;

    const three = threeStateRef.current;
    const { camera, controls } = three;
    let cameraTarget = three.cameraTarget;
    const spherical = three.cameraSpherical;
    if (!camera || !controls || !spherical) return;

    if (target) {
      let nextTarget = null;
      if (target.isVector3) {
        nextTarget = target;
      } else if (
        typeof target === 'object' &&
        target !== null &&
        Number.isFinite(target.x) &&
        Number.isFinite(target.y) &&
        Number.isFinite(target.z)
      ) {
        nextTarget = new THREE.Vector3(target.x, target.y, target.z);
      }
      if (nextTarget) {
        if (cameraTarget) {
          cameraTarget.copy(nextTarget);
        } else {
          cameraTarget = nextTarget.clone();
          three.cameraTarget = cameraTarget;
        }
        controls.target.copy(cameraTarget);
      }
    }

    if (!cameraTarget) {
      cameraTarget = CAMERA_DEFAULT_TARGET.clone();
      three.cameraTarget = cameraTarget;
      controls.target.copy(cameraTarget);
    }

    const idealRadius = three.cameraIdealRadius ?? spherical.radius;
    const basePhi = three.cameraPhi ?? spherical.phi;
    const homeTheta = three.cameraHomeTheta ?? spherical.theta;
    const headLimit = three.cameraHeadLimit ?? CAMERA_HEAD_LIMIT;
    const minBound = homeTheta - headLimit;
    const maxBound = homeTheta + headLimit;

    const clampToHeadLimit = (rawTheta) => {
      const normalized = normalizeAngle(rawTheta);
      const offset = shortestAngleDifference(homeTheta, normalized);
      const clampedOffset = THREE.MathUtils.clamp(offset, -headLimit, headLimit);
      return normalizeAngle(homeTheta + clampedOffset);
    };

    const applyTheta = (value) => {
      const constrained = clampToHeadLimit(value);
      spherical.theta = constrained;
      spherical.radius = idealRadius;
      spherical.phi = basePhi;
      three.cameraAdjusting = true;
      try {
        updateCameraFromSpherical(camera, spherical, cameraTarget, three);
        const actualRadius = three.cameraRadius ?? spherical.radius;
        controls.target.copy(cameraTarget);
        controls.minPolarAngle = basePhi;
        controls.maxPolarAngle = basePhi;
        controls.minAzimuthAngle = minBound;
        controls.maxAzimuthAngle = maxBound;
        controls.minDistance = actualRadius;
        controls.maxDistance = actualRadius;
        controls.update();
      } finally {
        three.cameraAdjusting = false;
      }
    };

    if (three.cameraAnimationId) {
      cancelAnimationFrame(three.cameraAnimationId);
      three.cameraAnimationId = null;
    }

    const startTheta = spherical.theta;
    const targetTheta = clampToHeadLimit(theta);
    const delta = shortestAngleDifference(startTheta, targetTheta);
    const finalTheta = startTheta + delta;

    if (immediate || Math.abs(delta) < 1e-4) {
      applyTheta(finalTheta);
      return;
    }

    const start = performance.now();

    const step = (time) => {
      const progress = Math.min(1, (time - start) / CAMERA_TRANSITION_DURATION);
      const eased = easeOutCubic(progress);
      const value = startTheta + delta * eased;
      applyTheta(value);
      if (progress < 1) {
        three.cameraAnimationId = requestAnimationFrame(step);
      } else {
        three.cameraAnimationId = null;
      }
    };

    three.cameraAnimationId = requestAnimationFrame(step);
  }, []);

  const focusCameraOnPlayer = useCallback(
    (playerIndex, immediate = false) => {
      if (typeof playerIndex !== 'number') return;
      const three = threeStateRef.current;
      const seatConfigs = three.seatConfigs;
      if (!seatConfigs?.length) return;
      const seat = seatConfigs[playerIndex];
      if (!seat) return;
      const seatAngle = Math.atan2(seat.forward.z, seat.forward.x);
      const playerTheta = Math.PI / 2 - seatAngle;
      const baseTheta =
        typeof three.cameraHomeTheta === 'number'
          ? three.cameraHomeTheta
          : typeof three.cameraSpherical?.theta === 'number'
            ? three.cameraSpherical.theta
            : playerTheta;
      const forward = seat.forward ?? new THREE.Vector3();
      const isSideSeat = Math.abs(forward.x) >= CAMERA_SIDE_THRESHOLD;
      let desiredTheta = baseTheta;
      if (isSideSeat) {
        const delta = shortestAngleDifference(baseTheta, playerTheta);
        const swingLimit = three.cameraAzimuthSwing ?? CAMERA_AZIMUTH_SWING;
        const limited = THREE.MathUtils.clamp(delta, -swingLimit, swingLimit);
        desiredTheta = baseTheta + limited * CAMERA_SIDE_SWING_FACTOR;
      }
      const focusTarget = CAMERA_CENTER_TARGET.clone();
      moveCameraToTheta(desiredTheta, { immediate, target: focusTarget });
    },
    [moveCameraToTheta]
  );

  const focusCameraOnActivePlayer = useCallback(
    (state, immediate = false) => {
      if (!state) return;
      const activeIdx = state.activePlayer;
      if (typeof activeIdx !== 'number') return;
      const playersList = Array.isArray(state.players) ? state.players : [];
      if (!playersList.length) {
        focusCameraOnPlayer(activeIdx, immediate);
        return;
      }
      const nextIdx = getNextAlive(playersList, activeIdx);
      const focusIdx = typeof nextIdx === 'number' && nextIdx !== activeIdx ? nextIdx : activeIdx;
      focusCameraOnPlayer(focusIdx, immediate);
    },
    [focusCameraOnPlayer]
  );

  const applyStateToScene = useCallback((state, selection, immediate = false) => {
    const three = threeStateRef.current;
    if (!three.scene) return;

    const selectionSet = new Set(selection);
    const handsVisible = new Set();
    const tableSet = new Set(state.tableCards.map((card) => card.id));
    const discardSet = new Set(state.discardPile.map((card) => card.id));

    const seatConfigs = three.seatConfigs;
    const cardMap = three.cardMap;

    const humanTurn = state.status === 'PLAYING' && state.players[state.activePlayer]?.isHuman;
    humanTurnRef.current = humanTurn;

    const humanMeshes = [];

    state.players.forEach((player, idx) => {
      const seat = seatConfigs[idx];
      if (!seat) return;
      const cards = player.hand;
      const baseHeight = TABLE_HEIGHT + CARD_H / 2 + (player.isHuman ? 0.06 * MODEL_SCALE : 0);
      const forward = seat.forward;
      const right = seat.right;
      const radius = seat.radius;
      const focus = seat.focus;
      const spacing = seat.spacing;
      const maxSpread = seat.maxSpread;
      const spread = cards.length > 1 ? Math.min((cards.length - 1) * spacing, maxSpread) : 0;
      cards.forEach((card, cardIdx) => {
        const entry = cardMap.get(card.id);
        if (!entry) return;
        const mesh = entry.mesh;
        mesh.visible = true;
        updateCardFace(mesh, player.isHuman ? 'front' : 'back');
        handsVisible.add(card.id);
        const offset = cards.length > 1 ? cardIdx - (cards.length - 1) / 2 : 0;
        const lateral = cards.length > 1 ? (offset * spread) / (cards.length - 1 || 1) : 0;
        const target = forward.clone().multiplyScalar(radius).addScaledVector(right, lateral);
        target.y = baseHeight + (player.isHuman ? 0 : 0.02 * Math.abs(offset));
        if (player.isHuman && selectionSet.has(card.id)) target.y += HUMAN_SELECTION_OFFSET;
        setMeshPosition(
          mesh,
          target,
          focus,
          { face: player.isHuman ? 'front' : 'back' },
          immediate,
          three.animations
        );
        mesh.userData.cardId = card.id;
        if (player.isHuman) humanMeshes.push(mesh);
      });
    });

    const tableAnchor = three.tableAnchor.clone();
    const tableCount = state.tableCards.length;
    const tableSpacing = tableCount > 1 ? Math.min(CARD_W * 1.45, (CARD_W * 5.6) / (tableCount - 1)) : CARD_W;
    const tableStartX = tableCount > 1 ? -((tableCount - 1) * tableSpacing) / 2 : 0;
    const humanIndex = state.players.findIndex((player) => player.isHuman);
    const humanSeat = humanIndex >= 0 ? seatConfigs[humanIndex] : null;
    const tableLookBase = humanSeat
      ? tableAnchor
          .clone()
          .add(humanSeat.forward.clone().multiplyScalar(1.15 * MODEL_SCALE))
          .setY(tableAnchor.y + 0.32 * MODEL_SCALE)
      : tableAnchor.clone().setY(tableAnchor.y + 0.32 * MODEL_SCALE);
    state.tableCards.forEach((card, idx) => {
      const entry = cardMap.get(card.id);
      if (!entry) return;
      const mesh = entry.mesh;
      mesh.visible = true;
      updateCardFace(mesh, 'front');
      const target = tableAnchor.clone();
      target.x += tableStartX + idx * tableSpacing;
      target.y += 0.06 * MODEL_SCALE + idx * 0.014;
      target.z += (idx - (tableCount - 1) / 2) * 0.06;
      const lookTarget = tableLookBase.clone();
      setMeshPosition(
        mesh,
        target,
        lookTarget,
        { face: 'front' },
        immediate,
        three.animations
      );
    });

    const discardBase = three.discardAnchor.clone();
    state.discardPile.forEach((card, idx) => {
      const entry = cardMap.get(card.id);
      if (!entry) return;
      const mesh = entry.mesh;
      mesh.visible = true;
      updateCardFace(mesh, 'front');
      const row = Math.floor(idx / 12);
      const col = idx % 12;
      const target = discardBase.clone();
      target.x += (col - 5.5) * CARD_W * 0.4;
      target.z += row * CARD_W * 0.32;
      target.y -= row * 0.05;
      setMeshPosition(
        mesh,
        target,
        target.clone().setY(target.y + 0.1),
        { face: 'front', flat: true },
        immediate,
        three.animations
      );
    });

    three.cardMap.forEach(({ mesh }, id) => {
      if (handsVisible.has(id) || tableSet.has(id) || discardSet.has(id)) return;
      mesh.visible = false;
      if (mesh.userData?.animation) {
        mesh.userData.animation.cancelled = true;
        mesh.userData.animation = null;
      }
    });

    three.selectionTargets = humanTurn ? humanMeshes : [];
    if (three.renderer?.domElement) {
      three.renderer.domElement.style.cursor = humanTurn ? 'pointer' : 'default';
    }
  }, []);

  const updateSceneAppearance = useCallback(
    (nextAppearance, { refreshCards = false } = {}) => {
      if (!threeReady) return;
      const three = threeStateRef.current;
      if (!three.scene) return;
      const safe = normalizeAppearance(nextAppearance);
      const woodOption = TABLE_WOOD_OPTIONS[safe.tableWood] ?? TABLE_WOOD_OPTIONS[0];
      const clothOption = TABLE_CLOTH_OPTIONS[safe.tableCloth] ?? TABLE_CLOTH_OPTIONS[0];
      const baseOption = TABLE_BASE_OPTIONS[safe.tableBase] ?? TABLE_BASE_OPTIONS[0];
      const stoolTheme = STOOL_THEMES[safe.stools] ?? STOOL_THEMES[0];
      const outfitTheme = OUTFIT_THEMES[safe.outfit] ?? OUTFIT_THEMES[0];
      const cardTheme = CARD_THEMES[safe.cards] ?? CARD_THEMES[0];

      if (three.tableInfo?.materials) {
        applyTableMaterials(three.tableInfo.materials, { woodOption, clothOption, baseOption }, three.renderer);
      }
      applyChairThemeMaterials(three, stoolTheme);
      applyOutfitThemeMaterials(three, outfitTheme);

      const shouldRefreshCards = refreshCards || three.appearance?.cards !== safe.cards;
      applyCardThemeMaterials(three, cardTheme, shouldRefreshCards);

      three.appearance = { ...safe };

      ensureCardMeshes(gameStateRef.current);
      applyStateToScene(gameStateRef.current, selectedRef.current, true);
    },
    [applyStateToScene, ensureCardMeshes, threeReady]
  );

  const renderPreview = useCallback((type, option) => {
    switch (type) {
      case 'tableWood': {
        const presetId = option?.presetId;
        const grainId = option?.grainId;
        const preset = (presetId && WOOD_PRESETS_BY_ID[presetId]) || WOOD_FINISH_PRESETS[0];
        const grain = (grainId && WOOD_GRAIN_OPTIONS_BY_ID[grainId]) || WOOD_GRAIN_OPTIONS[0];
        const baseHex = `#${hslToHexNumber(preset.hue, preset.sat, preset.light)
          .toString(16)
          .padStart(6, '0')}`;
        const accentHex = `#${hslToHexNumber(preset.hue, Math.min(1, preset.sat + 0.12), Math.max(0, preset.light - 0.18))
          .toString(16)
          .padStart(6, '0')}`;
        const grainLabel = grain?.label ?? '';
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
              {grainLabel.slice(0, 10)}
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
                style={{
                  background: `radial-gradient(circle at 35% 30%, ${option.feltTop}, ${option.feltBottom})`
                }}
              />
            </div>
            <div className="absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-black/50 to-transparent" />
          </div>
        );
      case 'tableBase':
        return (
          <div className="relative h-14 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950/40">
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <div className="h-3 w-16 rounded-full" style={{ background: option.trimColor }} />
              <div className="h-4 w-20 rounded-full" style={{ background: option.baseColor }} />
              <div
                className="absolute bottom-2 h-3 w-14 rounded-full opacity-80"
                style={{ background: option.columnColor }}
              />
            </div>
          </div>
        );
      case 'cards':
        return (
          <div className="flex items-center justify-center gap-2">
            <div
              className="h-12 w-8 rounded-md border"
              style={{
                background: option.frontBackground,
                borderColor: option.frontBorder || '#e5e7eb'
              }}
            />
            <div
              className="h-12 w-8 rounded-md border border-white/10"
              style={{
                backgroundImage: `linear-gradient(135deg, ${
                  option.backGradient?.[0] ?? option.backColor
                }, ${option.backGradient?.[1] ?? option.backColor})`,
                boxShadow: `0 0 0 2px ${option.backAccent || 'rgba(255,255,255,0.25)'} inset`
              }}
            />
          </div>
        );
      case 'stools':
        return (
          <div className="relative flex h-12 w-full items-center justify-center rounded-xl border border-white/10 bg-slate-950/50">
            <div className="h-6 w-12 rounded-md" style={{ background: option.seatColor }} />
            <div className="absolute bottom-1 h-2 w-14 rounded-full opacity-80" style={{ background: option.legColor }} />
          </div>
        );
      case 'outfit':
      default:
        return (
          <div className="relative flex h-12 w-full items-center justify-center">
            <div className="relative h-12 w-12 rounded-full" style={{ background: option.baseColor }}>
              <div
                className="absolute inset-1 rounded-full border-2"
                style={{ borderColor: option.accentColor }}
              />
              <div
                className="absolute left-1/2 top-1/2 h-4 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ background: option.accentColor }}
              />
            </div>
          </div>
        );
    }
  }, []);

  useEffect(() => {
    const prev = prevStateRef.current;
    prevStateRef.current = gameState;
    gameStateRef.current = gameState;
    setUiState(computeUiState(gameState));
    if (!threeReady) return;

    applyStateToScene(gameState, selectedRef.current);

    if (focusTimerRef.current) {
      clearTimeout(focusTimerRef.current);
      focusTimerRef.current = null;
    }

    const initialRun = !prev;
    if (initialRun) {
      focusCameraOnActivePlayer(gameState, true);
      return;
    }

    const newCardsPlayed =
      prev.tableCards !== gameState.tableCards &&
      Array.isArray(gameState.tableCards) &&
      gameState.tableCards.length > 0;

    if (newCardsPlayed && typeof prev.activePlayer === 'number') {
      focusCameraOnPlayer(prev.activePlayer);
      focusTimerRef.current = setTimeout(() => {
        const latest = gameStateRef.current;
        if (!latest) return;
        focusCameraOnActivePlayer(latest);
        focusTimerRef.current = null;
      }, TURN_FOCUS_HOLD_MS);
      return;
    }

    focusCameraOnActivePlayer(gameState);
  }, [gameState, threeReady, applyStateToScene, focusCameraOnActivePlayer, focusCameraOnPlayer]);

  useEffect(() => {
    selectedRef.current = selectedIds;
    if (threeReady) {
      applyStateToScene(gameStateRef.current, selectedIds);
    }
  }, [selectedIds, threeReady, applyStateToScene]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return undefined;
    const card = new Audio('/assets/sounds/flipcard-91468.mp3');
    const turn = new Audio('/assets/sounds/wooden-door-knock-102902.mp3');
    card.preload = 'auto';
    turn.preload = 'auto';
    card.volume = 0.55;
    turn.volume = 0.55;
    soundsRef.current = { card, turn };
    return () => {
      [card, turn].forEach((audio) => {
        if (!audio) return;
        audio.pause();
        audio.src = '';
      });
      soundsRef.current = { card: null, turn: null };
    };
  }, []);

  useEffect(() => {
    const prev = audioStateRef.current;
    const tableIds = gameState.tableCards.map((card) => card.id);
    const hasNewTableCards =
      prev.initialized &&
      (tableIds.length > prev.tableIds.length ||
        tableIds.some((id, index) => id !== prev.tableIds[index]));
    if (hasNewTableCards && tableIds.length) {
      const cardSound = soundsRef.current.card;
      if (cardSound) {
        try {
          cardSound.currentTime = 0;
          void cardSound.play();
        } catch (error) {
          // ignore playback errors (autoplay restrictions)
        }
      }
    }
    const activeChanged = prev.initialized && prev.activePlayer !== gameState.activePlayer;
    if (activeChanged && gameState.status === 'PLAYING') {
      const turnSound = soundsRef.current.turn;
      if (turnSound) {
        try {
          turnSound.currentTime = 0;
          void turnSound.play();
        } catch (error) {
          // ignore playback errors
        }
      }
    }
    audioStateRef.current = {
      tableIds,
      activePlayer: gameState.activePlayer,
      status: gameState.status,
      initialized: true
    };
  }, [gameState]);

  useEffect(() => {
    appearanceRef.current = appearance;
    if (typeof window !== 'undefined') {
      try {
        window.localStorage?.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(appearance));
      } catch (error) {
        console.warn('Failed to persist appearance', error);
      }
    }
    const previous = threeStateRef.current.appearance;
    const cardChanged = previous?.cards !== appearance.cards;
    updateSceneAppearance(appearance, { refreshCards: cardChanged });
  }, [appearance, updateSceneAppearance]);

  useEffect(() => {
    if (!threeReady) return;
    updateSceneAppearance(appearanceRef.current, { refreshCards: true });
  }, [threeReady, updateSceneAppearance]);

  useEffect(() => {
    if (!threeReady) return;
    updateScoreboardDisplay(uiState.scoreboard);
  }, [threeReady, uiState.scoreboard, updateScoreboardDisplay]);

  const toggleSelection = useCallback((cardId) => {
    setSelectedIds((prev) => {
      if (!humanTurnRef.current) return prev;
      const human = gameStateRef.current.players.find((p) => p.isHuman);
      if (!human || !human.hand.some((card) => card.id === cardId)) return prev;
      if (prev.includes(cardId)) {
        return prev.filter((id) => id !== cardId);
      }
      return [...prev, cardId];
    });
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    applyRendererSRGB(renderer);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#030712');

    const ambient = new THREE.AmbientLight(0xffffff, 1.08);
    const spot = new THREE.SpotLight(0xffffff, 4.8384, TABLE_RADIUS * 10, Math.PI / 3, 0.35, 1);
    spot.position.set(3, 7, 3);
    spot.castShadow = true;
    const rim = new THREE.PointLight(0x33ccff, 1.728);
    rim.position.set(-4, 3, -4);
    scene.add(ambient, spot, rim);

    const spotTarget = new THREE.Object3D();
    spotTarget.position.set(0, TABLE_HEIGHT + 0.2 * MODEL_SCALE, 0);
    scene.add(spotTarget);
    spot.target = spotTarget;

    const arenaGroup = new THREE.Group();
    scene.add(arenaGroup);

    const currentAppearance = normalizeAppearance(appearanceRef.current);
    const woodOption =
      TABLE_WOOD_OPTIONS[currentAppearance.tableWood] ?? TABLE_WOOD_OPTIONS[0];
    const clothOption =
      TABLE_CLOTH_OPTIONS[currentAppearance.tableCloth] ?? TABLE_CLOTH_OPTIONS[0];
    const baseOption =
      TABLE_BASE_OPTIONS[currentAppearance.tableBase] ?? TABLE_BASE_OPTIONS[0];
    const stoolTheme = STOOL_THEMES[currentAppearance.stools] ?? STOOL_THEMES[0];
    const outfitTheme = OUTFIT_THEMES[currentAppearance.outfit] ?? OUTFIT_THEMES[0];

    const arenaScale = 1.3 * ARENA_GROWTH;
    const boardSize = (TABLE_RADIUS * 2 + 1.2 * MODEL_SCALE) * arenaScale;
    const camConfig = buildArenaCameraConfig(boardSize);

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

    const wallInnerRadius = TABLE_RADIUS * ARENA_GROWTH * 2.4;
    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(
        wallInnerRadius,
        TABLE_RADIUS * ARENA_GROWTH * 2.6,
        ARENA_WALL_HEIGHT,
        48,
        1,
        true
      ),
      createArenaWallMaterial('#0b1120', '#1e293b')
    );
    wall.position.y = ARENA_WALL_CENTER_Y;
    wall.receiveShadow = false;
    arenaGroup.add(wall);

    const cameraBoundRadius = wallInnerRadius - CAMERA_WALL_PADDING;
    threeStateRef.current.cameraBounds = {
      minX: -cameraBoundRadius,
      maxX: cameraBoundRadius,
      minZ: -cameraBoundRadius,
      maxZ: cameraBoundRadius,
      minY: CHAIR_BASE_HEIGHT * 0.5,
      maxY: ARENA_WALL_TOP_Y - CAMERA_WALL_HEIGHT_MARGIN
    };

    const scoreboardCanvas = document.createElement('canvas');
    scoreboardCanvas.width = 1024;
    scoreboardCanvas.height = 512;
    const scoreboardContext = scoreboardCanvas.getContext('2d');
    if (scoreboardContext) {
      const scoreboardTexture = new THREE.CanvasTexture(scoreboardCanvas);
      applySRGBColorSpace(scoreboardTexture);
      scoreboardTexture.anisotropy = 8;
      const scoreboardMaterial = new THREE.MeshBasicMaterial({
        map: scoreboardTexture,
        transparent: true,
        toneMapped: false,
        depthWrite: false
      });
      const scoreboardWidth = Math.min(wallInnerRadius * 0.7, 4.4 * MODEL_SCALE);
      const scoreboardHeight = scoreboardWidth * 0.42;
      const scoreboardGeometry = new THREE.PlaneGeometry(scoreboardWidth, scoreboardHeight);
      const scoreboardMesh = new THREE.Mesh(scoreboardGeometry, scoreboardMaterial);
      scoreboardMesh.position.set(0, ARENA_WALL_HEIGHT * 0.6, -wallInnerRadius + 0.12);
      scoreboardMesh.lookAt(new THREE.Vector3(0, scoreboardMesh.position.y, 0));
      scoreboardMesh.renderOrder = 2;
      scoreboardMesh.visible = false;
      arenaGroup.add(scoreboardMesh);
      threeStateRef.current.scoreboard = {
        canvas: scoreboardCanvas,
        context: scoreboardContext,
        texture: scoreboardTexture,
        material: scoreboardMaterial,
        geometry: scoreboardGeometry,
        mesh: scoreboardMesh
      };
    } else {
      threeStateRef.current.scoreboard = null;
    }

    updateScoreboardDisplay(computeUiState(gameStateRef.current).scoreboard);

    const tableInfo = createMurlanStyleTable({
      arena: arenaGroup,
      renderer,
      tableRadius: TABLE_RADIUS,
      tableHeight: TABLE_HEIGHT,
      woodOption,
      clothOption,
      baseOption
    });
    applyTableMaterials(tableInfo.materials, { woodOption, clothOption, baseOption }, renderer);
    threeStateRef.current.tableInfo = tableInfo;
    threeStateRef.current.tableAnchor = new THREE.Vector3(0, tableInfo.surfaceY + CARD_SURFACE_OFFSET, 0);
    threeStateRef.current.discardAnchor = new THREE.Vector3(
      -TABLE_RADIUS * 0.76,
      tableInfo.surfaceY - CARD_H * 0.3,
      -TABLE_RADIUS * 0.62
    );
    const chairMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(stoolTheme.seatColor),
      roughness: 0.35,
      metalness: 0.5,
      clearcoat: 1
    });
    const legMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(stoolTheme.legColor) });

    threeStateRef.current.chairMaterials = { seat: chairMat, leg: legMat };

    const outfitBodyMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(outfitTheme.baseColor),
      roughness: 0.55,
      metalness: 0.35,
      emissive: new THREE.Color(outfitTheme.glow || '#000000'),
      emissiveIntensity: 0.25
    });
    const outfitAccentMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(outfitTheme.accentColor),
      roughness: 0.4,
      metalness: 0.55
    });
    const headMat = new THREE.MeshStandardMaterial({ color: '#f9e0d0', roughness: 0.75, metalness: 0.1 });
    const torsoGeo = new THREE.CylinderGeometry(0.22 * MODEL_SCALE, 0.22 * MODEL_SCALE, 0.52 * MODEL_SCALE, 20);
    const headGeo = new THREE.SphereGeometry(0.16 * MODEL_SCALE, 20, 16);
    const collarGeo = new THREE.TorusGeometry(0.23 * MODEL_SCALE, 0.035 * MODEL_SCALE, 16, 32);

    threeStateRef.current.outfitParts = {
      bodyMaterial: outfitBodyMat,
      accentMaterial: outfitAccentMat,
      headMaterial: headMat
    };
    const chairRadius = CHAIR_RADIUS;
    const seatWidth = SEAT_WIDTH;
    const seatDepth = SEAT_DEPTH;
    const seatThickness = SEAT_THICKNESS;
    const backHeight = BACK_HEIGHT;
    const backThickness = BACK_THICKNESS;
    const armThickness = ARM_THICKNESS;
    const armHeight = ARM_HEIGHT;
    const armDepth = ARM_DEPTH;
    const baseColumnHeight = BASE_COLUMN_HEIGHT;

    const cardGeometry = new THREE.BoxGeometry(CARD_W, CARD_H, CARD_D, 1, 1, 1);
    const labelGeo = new THREE.PlaneGeometry(1.7 * MODEL_SCALE, 0.82 * MODEL_SCALE);

    const seatConfigs = [];

    for (let i = 0; i < CHAIR_COUNT; i++) {
      const player = players[i] ?? null;
      const chair = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(seatWidth, seatThickness, seatDepth), chairMat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(seatWidth, backHeight, backThickness), chairMat);
      back.position.set(0, seatThickness / 2 + backHeight / 2, -seatDepth / 2 + backThickness / 2);
      const armLeft = new THREE.Mesh(new THREE.BoxGeometry(armThickness, armHeight, armDepth), chairMat);
      const armOffsetX = seatWidth / 2 + armThickness / 2;
      const armOffsetY = seatThickness / 2 + armHeight / 2;
      const armOffsetZ = -seatDepth * 0.05;
      armLeft.position.set(-armOffsetX, armOffsetY, armOffsetZ);
      const armRight = armLeft.clone();
      armRight.position.x = armOffsetX;
      const legBase = new THREE.Mesh(
        new THREE.CylinderGeometry(
          0.16 * MODEL_SCALE * STOOL_SCALE,
          0.2 * MODEL_SCALE * STOOL_SCALE,
          baseColumnHeight,
          16
        ),
        legMat
      );
      legBase.position.y = -seatThickness / 2 - baseColumnHeight / 2;
      chair.add(seat, back, armLeft, armRight, legBase);

      const occupant = new THREE.Group();
      occupant.position.z = -seatDepth * 0.12;
      const torso = new THREE.Mesh(torsoGeo, outfitBodyMat);
      torso.position.y = seatThickness / 2 + 0.38 * MODEL_SCALE;
      occupant.add(torso);
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.y = torso.position.y + 0.36 * MODEL_SCALE;
      occupant.add(head);
      const collar = new THREE.Mesh(collarGeo, outfitAccentMat);
      collar.rotation.x = Math.PI / 2;
      collar.position.y = torso.position.y + 0.26 * MODEL_SCALE;
      occupant.add(collar);
      chair.add(occupant);

      const angle = CUSTOM_SEAT_ANGLES[i] ?? Math.PI / 2 - (i / CHAIR_COUNT) * Math.PI * 2;
      const x = Math.cos(angle) * chairRadius;
      const z = Math.sin(angle) * chairRadius;
      const chairBaseHeight = CHAIR_BASE_HEIGHT;
      chair.position.set(x, chairBaseHeight, z);
      chair.lookAt(new THREE.Vector3(0, chairBaseHeight, 0));
      arenaGroup.add(chair);

      const forward = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
      const right = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));
      const isHumanSeat = Boolean(player?.isHuman);
      const focus = forward
        .clone()
        .multiplyScalar(chairRadius - (isHumanSeat ? 1.2 * MODEL_SCALE : 0.6 * MODEL_SCALE));
      focus.y = TABLE_HEIGHT + CARD_H * (isHumanSeat ? 0.72 : 0.55);
      const stoolPosition = forward.clone().multiplyScalar(chairRadius);
      stoolPosition.y = CHAIR_BASE_HEIGHT + SEAT_THICKNESS / 2;
      const stoolHeight = STOOL_HEIGHT;
      seatConfigs.push({
        forward,
        right,
        focus,
        radius: (isHumanSeat ? 2.9 : 3.45) * MODEL_SCALE,
        spacing: (isHumanSeat ? 0.14 : 0.18) * MODEL_SCALE,
        maxSpread: (isHumanSeat ? 2.3 : 2.5) * MODEL_SCALE,
        stoolPosition,
        stoolHeight
      });

      if (player) {
        const labelTex = makeLabelTexture(player.name, player.avatar);
        labelTex.wrapS = THREE.RepeatWrapping;
        labelTex.repeat.x = -1;
        labelTex.offset.x = 1;
        const labelMat = new THREE.MeshBasicMaterial({ map: labelTex, transparent: true, side: THREE.DoubleSide });
        const label = new THREE.Mesh(labelGeo, labelMat);
        const baseLabelHeight = 0.62 * MODEL_SCALE;
        const labelForward = player.isHuman ? 0.88 * MODEL_SCALE : 0.98 * MODEL_SCALE;
        label.position.set(0, baseLabelHeight, labelForward);
        label.rotation.y = Math.PI;
        chair.add(label);
        threeStateRef.current.labelTextures.push(labelTex);
        threeStateRef.current.labelMaterials.push(labelMat);
      }
    }

    const humanSeatIndex = players.findIndex((player) => player?.isHuman);
    const humanSeatConfig = humanSeatIndex >= 0 ? seatConfigs[humanSeatIndex] : null;

    threeStateRef.current.appearance = { ...currentAppearance };

    spotTarget.position.set(0, TABLE_HEIGHT + 0.2 * MODEL_SCALE, 0);
    spot.target.updateMatrixWorld();

    const isPortrait = mount.clientHeight > mount.clientWidth;
    const camera = new THREE.PerspectiveCamera(
      camConfig.fov,
      mount.clientWidth / mount.clientHeight,
      camConfig.near,
      camConfig.far
    );
    const targetHeightOffset = 0.08 * MODEL_SCALE;
    let target = new THREE.Vector3(0, TABLE_HEIGHT + targetHeightOffset, 0);
    let initialCameraPosition;
    if (humanSeatConfig) {
      const humanSeatAngle = Math.atan2(humanSeatConfig.forward.z, humanSeatConfig.forward.x);
      const stoolAnchor = humanSeatConfig.stoolPosition?.clone() ??
        new THREE.Vector3(
          Math.cos(humanSeatAngle) * chairRadius,
          TABLE_HEIGHT,
          Math.sin(humanSeatAngle) * chairRadius
        );
      const stoolHeight = humanSeatConfig.stoolHeight ?? TABLE_HEIGHT + seatThickness / 2;
      const lateralOffset = isPortrait ? 0.55 : 0.42;
      const retreatOffset = isPortrait ? 1.85 : 1.35;
      const elevation = isPortrait ? 1.95 : 1.58;
      initialCameraPosition = stoolAnchor
        .addScaledVector(humanSeatConfig.forward, -retreatOffset)
        .addScaledVector(humanSeatConfig.right, lateralOffset);
      initialCameraPosition.y = stoolHeight + elevation;
      target = new THREE.Vector3(0, TABLE_HEIGHT + targetHeightOffset + 0.12 * MODEL_SCALE, 0);
    } else {
      const humanSeatAngle = Math.PI / 2;
      const cameraBackOffset = isPortrait ? 1.65 : 1.05;
      const cameraForwardOffset = isPortrait ? 0.18 : 0.35;
      const cameraHeightOffset = isPortrait ? 1.46 : 1.12;
      initialCameraPosition = new THREE.Vector3(
        Math.cos(humanSeatAngle) * (chairRadius + cameraBackOffset - cameraForwardOffset),
        TABLE_HEIGHT + cameraHeightOffset,
        Math.sin(humanSeatAngle) * (chairRadius + cameraBackOffset - cameraForwardOffset)
      );
    }
    const initialOffset = initialCameraPosition.clone().sub(target);
    const spherical = new THREE.Spherical().setFromVector3(initialOffset);
    const maxHorizontalReach = cameraBoundRadius;
    const safeHorizontalReach = Math.max(2.6 * MODEL_SCALE, maxHorizontalReach);
    const maxOrbitRadius = Math.max(3.6 * MODEL_SCALE, safeHorizontalReach / Math.sin(ARENA_CAMERA_DEFAULTS.phiMax));
    const minOrbitRadius = Math.max(2.6 * MODEL_SCALE, maxOrbitRadius * 0.7);
    const desiredRadius = THREE.MathUtils.clamp(
      spherical.radius * 1.18,
      minOrbitRadius + 0.05 * MODEL_SCALE,
      maxOrbitRadius * 1.02
    );
    spherical.radius = desiredRadius;
    spherical.phi = THREE.MathUtils.clamp(
      spherical.phi,
      ARENA_CAMERA_DEFAULTS.phiMin,
      ARENA_CAMERA_DEFAULTS.phiMax
    );
    threeStateRef.current.cameraIdealRadius = spherical.radius;
    threeStateRef.current.cameraRadius = spherical.radius;
    threeStateRef.current.cameraAdjusting = true;
    updateCameraFromSpherical(camera, spherical, target, threeStateRef.current);
    threeStateRef.current.cameraAdjusting = false;

    const storedSpherical = spherical.clone();
    storedSpherical.theta = normalizeAngle(storedSpherical.theta);
    const homeTheta = storedSpherical.theta;
    const headLimit = threeStateRef.current.cameraHeadLimit ?? CAMERA_HEAD_LIMIT;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.copy(target);
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.enableRotate = false;
    controls.minPolarAngle = storedSpherical.phi;
    controls.maxPolarAngle = storedSpherical.phi;
    controls.minAzimuthAngle = homeTheta - headLimit;
    controls.maxAzimuthAngle = homeTheta + headLimit;
    controls.minDistance = storedSpherical.radius;
    controls.maxDistance = storedSpherical.radius;
    controls.rotateSpeed = 0.38;

    threeStateRef.current.cameraTarget = target.clone();
    threeStateRef.current.cameraSpherical = storedSpherical;
    threeStateRef.current.cameraRadius = storedSpherical.radius;
    threeStateRef.current.cameraIdealRadius = storedSpherical.radius;
    threeStateRef.current.cameraPhi = storedSpherical.phi;
    threeStateRef.current.cameraAzimuthSwing = CAMERA_AZIMUTH_SWING;
    threeStateRef.current.cameraHomeTheta = homeTheta;
    threeStateRef.current.cameraHeadLimit = headLimit;

    const handleControlChange = () => {
      const store = threeStateRef.current;
      if (!store.cameraTarget || !store.cameraSpherical || store.cameraAdjusting) return;
      store.cameraAdjusting = true;
      try {
        const offset = camera.position.clone().sub(store.cameraTarget);
        const current = new THREE.Spherical().setFromVector3(offset);
        updateCameraFromSpherical(camera, current, store.cameraTarget, store);
        store.cameraSpherical.theta = normalizeAngle(current.theta);
        store.cameraSpherical.phi = current.phi;
        store.cameraSpherical.radius = current.radius;
        if (typeof store.cameraIdealRadius !== 'number') {
          store.cameraIdealRadius = current.radius;
        }
        const actualRadius = store.cameraRadius ?? current.radius;
        controls.minDistance = actualRadius;
        controls.maxDistance = actualRadius;
        controls.update();
      } finally {
        store.cameraAdjusting = false;
      }
    };
    controls.addEventListener('change', handleControlChange);
    threeStateRef.current.cameraChangeHandler = handleControlChange;
    threeStateRef.current.cameraAnimationId = null;

    const resize = () => {
      const { clientWidth, clientHeight } = mount;
      renderer.setSize(clientWidth, clientHeight, false);
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    const stepAnimations = (time) => {
      const store = threeStateRef.current;
      const list = store.animations;
      if (!list?.length) return;
      store.animations = list.filter((anim) => {
        if (anim.cancelled) return false;
        const progress = Math.min(1, (time - anim.start) / anim.duration);
        const eased = easeOutCubic(progress);
        anim.mesh.position.lerpVectors(anim.from, anim.to, eased);
        orientMesh(anim.mesh, anim.lookTarget, anim.orientation);
        if (progress >= 1) {
          anim.mesh.position.copy(anim.to);
          orientMesh(anim.mesh, anim.lookTarget, anim.orientation);
          anim.mesh.userData.animation = null;
          return false;
        }
        return true;
      });
    };

    const animate = (time) => {
      stepAnimations(time);
      controls.update();
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };

    let frameId = requestAnimationFrame(animate);

    threeStateRef.current.renderer = renderer;
    threeStateRef.current.scene = scene;
    threeStateRef.current.camera = camera;
    threeStateRef.current.controls = controls;
    threeStateRef.current.arena = arenaGroup;
    threeStateRef.current.cardGeometry = cardGeometry;
    threeStateRef.current.seatConfigs = seatConfigs;

    ensureCardMeshes(gameStateRef.current);
    applyStateToScene(gameStateRef.current, selectedRef.current, true);
    focusCameraOnActivePlayer(gameStateRef.current, true);
    setThreeReady(true);

    const dom = renderer.domElement;
    const handlePointerDown = (event) => {
      if (!humanTurnRef.current) return;
      const rect = dom.getBoundingClientRect();
      const pointer = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      threeStateRef.current.raycaster.setFromCamera(pointer, camera);
      const intersects = threeStateRef.current.raycaster.intersectObjects(threeStateRef.current.selectionTargets, false);
      if (!intersects.length) return;
      const picked = intersects[0].object;
      const cardId = picked.userData.cardId || picked.parent?.userData.cardId;
      if (cardId) toggleSelection(cardId);
    };
    dom.addEventListener('pointerdown', handlePointerDown);

    return () => {
      const store = threeStateRef.current;
      if (store.cameraAnimationId) {
        cancelAnimationFrame(store.cameraAnimationId);
      }
      if (store.cameraChangeHandler) {
        controls.removeEventListener('change', store.cameraChangeHandler);
      }
      cancelAnimationFrame(frameId);
      observer.disconnect();
      controls.dispose();
      dom.removeEventListener('pointerdown', handlePointerDown);
      mount.removeChild(dom);
      renderer.dispose();
      cardGeometry.dispose();
      labelGeo.dispose();
      torsoGeo.dispose();
      headGeo.dispose();
      collarGeo.dispose();
      store.cardMap.forEach(({ mesh }) => {
        const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const mats = new Set(list.filter(Boolean));
        const { frontMaterial, backMaterial, hiddenMaterial } = mesh.userData ?? {};
        [frontMaterial, backMaterial, hiddenMaterial].forEach((mat) => {
          if (mat) mats.add(mat);
        });
        mats.forEach((mat) => {
          if (typeof mat.dispose === 'function') {
            mat.dispose();
          }
        });
        arena.remove(mesh);
      });
      store.faceTextureCache.forEach((tex) => tex.dispose());
      store.labelTextures.forEach((tex) => tex.dispose());
      store.labelMaterials.forEach((mat) => mat.dispose());
      if (store.scoreboard) {
        const { mesh, geometry, material, texture } = store.scoreboard;
        if (mesh?.parent) {
          mesh.parent.remove(mesh);
        }
        geometry?.dispose?.();
        material?.dispose?.();
        texture?.dispose?.();
        store.scoreboard = null;
      }
      if (store.tableInfo) {
        store.tableInfo.dispose?.();
        store.tableInfo = null;
      }
      if (store.chairMaterials) {
        [store.chairMaterials.seat, store.chairMaterials.leg].forEach((mat) => {
          if (mat && typeof mat.dispose === 'function') mat.dispose();
        });
      }
      if (store.outfitParts) {
        [store.outfitParts.bodyMaterial, store.outfitParts.accentMaterial, store.outfitParts.headMaterial].forEach(
          (mat) => {
            if (mat && typeof mat.dispose === 'function') mat.dispose();
          }
        );
      }
      if (focusTimerRef.current) {
        clearTimeout(focusTimerRef.current);
        focusTimerRef.current = null;
      }
      threeStateRef.current = {
        renderer: null,
        scene: null,
        camera: null,
        controls: null,
        cameraTarget: null,
        cameraSpherical: null,
        cameraRadius: null,
        cameraIdealRadius: null,
        cameraPhi: null,
        cameraAzimuthSwing: CAMERA_AZIMUTH_SWING,
        cameraHomeTheta: null,
        cameraHeadLimit: CAMERA_HEAD_LIMIT,
        cameraAnimationId: null,
        cameraChangeHandler: null,
        cameraBounds: null,
        cameraAdjusting: false,
        arena: null,
        cardGeometry: null,
        cardMap: new Map(),
        faceTextureCache: new Map(),
        labelTextures: [],
        labelMaterials: [],
        seatConfigs: [],
        selectionTargets: [],
        animations: [],
        raycaster: new THREE.Raycaster(),
        tableAnchor: new THREE.Vector3(0, TABLE_HEIGHT + CARD_SURFACE_OFFSET, 0),
        discardAnchor: new THREE.Vector3(-TABLE_RADIUS * 0.76, TABLE_HEIGHT - CARD_H * 0.3, -TABLE_RADIUS * 0.62),
        scoreboard: null,
        tableInfo: null,
        chairMaterials: null,
        outfitParts: null,
        cardThemeId: '',
        appearance: { ...DEFAULT_APPEARANCE }
      };
      setThreeReady(false);
    };
  }, [applyStateToScene, ensureCardMeshes, focusCameraOnActivePlayer, players, toggleSelection, updateScoreboardDisplay]);

  useEffect(() => {
    if (!threeReady) return;
    const state = gameState;
    if (state.status !== 'PLAYING') return;
    const active = state.players[state.activePlayer];
    if (!active || active.isHuman) return;
    const timer = setTimeout(() => {
      setGameState((prev) => {
        if (prev.status !== 'PLAYING') return prev;
        const current = prev.players[prev.activePlayer];
        if (!current || current.isHuman) return prev;
        return runAiTurn(prev);
      });
    }, AI_TURN_DELAY);
    return () => clearTimeout(timer);
  }, [gameState, threeReady]);

  const handlePlay = useCallback(() => {
    const state = gameStateRef.current;
    if (state.status !== 'PLAYING') return;
    const active = state.players[state.activePlayer];
    if (!active || !active.isHuman) return;
    const selectedCards = extractSelectedCards(active.hand, selectedRef.current);
    if (!selectedCards.length) {
      setActionError('Zgjidh të paktën një letër.');
      return;
    }
    const combo = detectCombo(selectedCards, GAME_CONFIG);
    if (!combo) {
      setActionError('Kombinimi nuk është i vlefshëm.');
      return;
    }
    const includesStart = selectedCards.some(
      (card) => card.rank === START_CARD.rank && card.suit === START_CARD.suit
    );
    if (state.firstMove && !includesStart) {
      setActionError('Lëvizja e parë duhet të përfshijë 3♠.');
      return;
    }
    if (!canBeat(combo, state.tableCombo, GAME_CONFIG)) {
      setActionError('Ky kombin nuk e mund atë në tavolinë.');
      return;
    }
    setActionError('');
    setSelectedIds([]);
    setGameState(buildPlayState(state, selectedCards, combo));
  }, []);

  const handlePass = useCallback(() => {
    const state = gameStateRef.current;
    if (state.status !== 'PLAYING') return;
    const active = state.players[state.activePlayer];
    if (!active || !active.isHuman) return;
    if (!state.tableCombo) {
      setActionError('Nuk mund të pasosh pa një kombin në tavolinë.');
      return;
    }
    setActionError('');
    setSelectedIds([]);
    setGameState(buildPassState(state));
  }, []);

  const handleClear = useCallback(() => {
    setSelectedIds([]);
    setActionError('');
  }, []);

  return (
    <div className="absolute inset-0">
      <div ref={mountRef} className="absolute inset-0" />
      <div className="absolute inset-0 pointer-events-none flex h-full flex-col">
        {uiState.scoreboard?.length ? (
          <div className="sr-only" aria-live="polite">
            <p>Rezultati aktual:</p>
            <ul>
              {uiState.scoreboard.map((entry) => (
                <li key={entry.id}>
                  {entry.name}
                  {entry.isActive ? ' (radha)' : ''}
                  {entry.finished ? ' - e përfundoi lojën' : ` - ${entry.cardsLeft} letra`}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="pointer-events-none flex items-start justify-start px-4 pt-4">
          <div className="pointer-events-none flex flex-col items-start gap-2">
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
                  {CUSTOMIZATION_SECTIONS.map(({ key, label, options }) => (
                    <div key={key} className="space-y-2">
                      <p className="text-[10px] uppercase tracking-[0.35em] text-white/60">{label}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {options.map((option, idx) => {
                          const selected = appearance[key] === idx;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => setAppearance((prev) => ({ ...prev, [key]: idx }))}
                              aria-pressed={selected}
                              className={`flex flex-col items-center rounded-2xl border p-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                                selected
                                  ? 'border-sky-400/80 bg-sky-400/10 shadow-[0_0_12px_rgba(56,189,248,0.35)]'
                                  : 'border-white/10 bg-white/5 hover:border-white/20'
                              }`}
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
        </div>
        <div className="mt-auto px-4 pb-6 pointer-events-none">
          <div className="mx-auto max-w-2xl rounded-2xl bg-black/70 p-4 text-sm text-gray-100 backdrop-blur-md shadow-2xl pointer-events-auto">
            <p className="text-sm text-gray-100">{uiState.message}</p>
            {uiState.tableSummary && (
              <p className="mt-2 text-xs text-gray-300">{uiState.tableSummary}</p>
            )}
            {actionError && <p className="mt-2 text-xs text-red-400">{actionError}</p>}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={handlePass}
                className="rounded-lg border border-white/25 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:text-gray-500 disabled:hover:bg-transparent"
                disabled={!uiState.humanTurn || !gameState.tableCombo}
              >
                Paso
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="rounded-lg border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:text-gray-500 disabled:hover:bg-transparent"
                disabled={!selectedIds.length}
              >
                Hiq zgjedhjet
              </button>
              <button
                type="button"
                onClick={handlePlay}
                className="rounded-lg bg-gradient-to-r from-[#ff0050] to-[#f97316] px-5 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-lg transition hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!uiState.humanTurn || !selectedIds.length}
              >
                Luaj
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function runAiTurn(state) {
  const active = state.players[state.activePlayer];
  if (!active || active.isHuman) return state;
  const action = aiChooseAction(active.hand, state.tableCombo, GAME_CONFIG);
  if (action.type === 'PLAY' && action.cards?.length) {
    const combo = detectCombo(action.cards, GAME_CONFIG);
    if (combo) {
      const includesStart = action.cards.some(
        (card) => card.rank === START_CARD.rank && card.suit === START_CARD.suit
      );
      if (!state.firstMove || includesStart) {
        return buildPlayState(state, action.cards, combo);
      }
    }
  }
  if (!state.tableCombo && active.hand.length) {
    const card = active.hand[0];
    const combo = detectCombo([card], GAME_CONFIG);
    if (combo) return buildPlayState(state, [card], combo);
  }
  return buildPassState(state);
}

function buildPlayState(state, cards, combo) {
  const players = state.players.map((player, idx) => {
    if (idx !== state.activePlayer) return { ...player, hand: [...player.hand] };
    const remaining = player.hand.filter((card) => !cards.includes(card));
    return { ...player, hand: remaining, finished: remaining.length === 0 };
  });

  const discardPile = state.tableCards.length
    ? [...state.discardPile, ...state.tableCards]
    : [...state.discardPile];

  const aliveCount = players.filter((p) => !p.finished).length;
  const lastWinner = state.activePlayer;
  let tableCombo = combo.type === ComboType.BOMB_4K ? null : combo;
  let tableCards = [...cards];
  let nextActive = getNextAlive(players, state.activePlayer);

  if (combo.type === ComboType.BOMB_4K) {
    tableCombo = null;
    tableCards = [...cards];
    nextActive = players[state.activePlayer].finished
      ? getNextAlive(players, state.activePlayer)
      : lastWinner;
  }

  let status = state.status;
  if (aliveCount <= 1) {
    status = 'ENDED';
    nextActive = state.activePlayer;
    tableCombo = null;
  }

  return {
    ...state,
    players,
    tableCombo,
    tableCards,
    discardPile,
    lastWinner,
    passesInRow: 0,
    firstMove: false,
    activePlayer: nextActive,
    status
  };
}

function buildPassState(state) {
  const players = state.players;
  const aliveCount = players.filter((p) => !p.finished).length;
  let passesInRow = state.passesInRow + 1;
  let tableCombo = state.tableCombo;
  let tableCards = state.tableCards;
  let discardPile = state.discardPile;
  let activePlayer = getNextAlive(players, state.activePlayer);

  if (tableCombo && passesInRow >= aliveCount - 1) {
    discardPile = tableCards.length ? [...discardPile, ...tableCards] : discardPile;
    tableCombo = null;
    tableCards = [];
    passesInRow = 0;
    const winner = state.lastWinner ?? state.activePlayer;
    activePlayer = players[winner]?.finished ? getNextAlive(players, winner) : winner;
  }

  return {
    ...state,
    activePlayer,
    passesInRow,
    tableCombo,
    tableCards,
    discardPile
  };
}

function extractSelectedCards(hand, selectedIds) {
  const idSet = new Set(selectedIds);
  return hand.filter((card) => idSet.has(card.id));
}

function initializeGame(playersInfo) {
  const deck = createDeck();
  shuffleInPlace(deck);
  const hands = dealHands(deck, playersInfo.length);
  const playerStates = playersInfo.map((info, idx) => ({
    ...info,
    hand: sortHand(hands[idx], GAME_CONFIG),
    finished: false
  }));
  const startIdx = playerStates.findIndex((player) =>
    player.hand.some((card) => card.rank === START_CARD.rank && card.suit === START_CARD.suit)
  );
  const active = startIdx === -1 ? 0 : startIdx;
  return {
    players: playerStates,
    activePlayer: active,
    tableCombo: null,
    tableCards: [],
    discardPile: [],
    passesInRow: 0,
    lastWinner: active,
    firstMove: true,
    status: 'PLAYING',
    allCards: deck
  };
}

function createDeck() {
  const ranks = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
  const deck = [];
  let id = 0;
  for (const suit of SUITS) {
    for (const rank of ranks) {
      deck.push({ id: `c-${id++}`, rank, suit });
    }
  }
  deck.push({ id: `c-${id++}`, rank: 'JR', suit: '🃏' });
  deck.push({ id: `c-${id++}`, rank: 'JB', suit: '🃏' });
  return deck;
}

function shuffleInPlace(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

function dealHands(deck, playerCount) {
  const hands = Array.from({ length: playerCount }, () => []);
  let idx = 0;
  deck.forEach((card) => {
    hands[idx].push(card);
    idx = (idx - 1 + playerCount) % playerCount;
  });
  return hands;
}

function getNextAlive(players, index) {
  if (!players.length) return 0;
  const totalPlayers = players.length;
  let next = ((index - 1) % totalPlayers + totalPlayers) % totalPlayers;
  let safety = 0;
  while (players[next]?.finished) {
    next = (next - 1 + totalPlayers) % totalPlayers;
    safety += 1;
    if (safety > players.length) return index;
  }
  return next;
}

function computeUiState(state) {
  const scoreboard = state.players.map((player, idx) => ({
    id: idx,
    name: player.name,
    avatar: player.avatar,
    cardsLeft: player.hand.length,
    finished: player.finished,
    isActive: idx === state.activePlayer,
    isHuman: !!player.isHuman
  }));
  let message = '';
  let tableSummary = '';
  let humanTurn = false;

  if (state.status === 'ENDED') {
    const winners = scoreboard.filter((entry) => entry.finished).map((entry) => entry.name);
    message = winners.length === 1 ? `${winners[0]} doli fitues!` : `Fitues: ${winners.join(', ')}`;
  } else {
    const active = state.players[state.activePlayer];
    if (active) {
      humanTurn = !!active.isHuman;
      if (humanTurn) {
        message = state.firstMove
          ? 'Zgjidh kartat (përfshi 3♠) dhe shtyp "Luaj".'
          : state.tableCombo
            ? 'Gjej një kombin që e mund tavolinën ose shtyp "Paso".'
            : 'Zgjidh kartat dhe shtyp "Luaj" për të nisur hedhjen.';
      } else {
        message = `Duke pritur ${active.name}...`;
      }
    }
  }

  if (state.tableCards.length) {
    const description = describeCombo(state.tableCombo, state.tableCards);
    if (description) {
      const owner = state.lastWinner != null ? state.players[state.lastWinner]?.name : null;
      tableSummary = owner ? `${owner} hodhi ${description}` : description;
    }
  }

  return { scoreboard, message, tableSummary, humanTurn, status: state.status };
}

function describeCombo(combo, cards) {
  if (!cards?.length) return '';
  if (!combo) {
    return cards.map((card) => cardLabel(card)).join(' ');
  }
  switch (combo.type) {
    case ComboType.SINGLE:
      return `një ${cardLabel(cards[0])}`;
    case ComboType.PAIR:
      return `çift ${combo.keyRank}`;
    case ComboType.TRIPS:
      return `treshe ${combo.keyRank}`;
    case ComboType.BOMB_4K:
      return `bombë ${combo.keyRank}`;
    case ComboType.STRAIGHT:
      return `shteg ${cardLabel(cards[0])} - ${cardLabel(cards[cards.length - 1])}`;
    case ComboType.FLUSH:
      return `flush me ${cards.length} letra`;
    case ComboType.FULL_HOUSE:
      return 'full house';
    case ComboType.STRAIGHT_FLUSH:
      return 'straight flush';
    default:
      return cards.map((card) => cardLabel(card)).join(' ');
  }
}

function cardLabel(card) {
  if (!card) return '';
  if (card.rank === 'JR') return 'Joker i kuq';
  if (card.rank === 'JB') return 'Joker i zi';
  return `${card.rank}${card.suit}`;
}

function buildPlayers(search) {
  const params = new URLSearchParams(search);
  const username = params.get('username') || 'Ti';
  const avatar = params.get('avatar') || '';
  const seedFlags = [...FLAG_EMOJIS].sort(() => 0.5 - Math.random());
  return [
    { name: username, avatar, isHuman: true },
    seedFlags[0] ? { name: flagName(seedFlags[0]), avatar: seedFlags[0] } : { name: 'Aria', avatar: '🦊' },
    seedFlags[1] ? { name: flagName(seedFlags[1]), avatar: seedFlags[1] } : { name: 'Milo', avatar: '🐻' },
    seedFlags[2] ? { name: flagName(seedFlags[2]), avatar: seedFlags[2] } : { name: 'Sora', avatar: '🐱' }
  ];
}

function flagName(flag) {
  if (!flag) return 'Player';
  const base = 0x1f1e6;
  const codePoints = [...flag].map((c) => c.codePointAt(0) - base + 65);
  try {
    const region = String.fromCharCode(...codePoints);
    const names = new Intl.DisplayNames(['en'], { type: 'region' });
    return names.of(region) || `Player ${flag}`;
  } catch (error) {
    return `Player ${flag}`;
  }
}

function makeLabelTexture(name, avatar) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = 'rgba(12, 16, 32, 0.92)';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  g.lineWidth = 12;
  roundRect(g, 16, 16, canvas.width - 32, canvas.height - 32, 42);
  g.stroke();
  g.fillStyle = '#ffffff';
  g.font = 'bold 140px "Inter", system-ui, sans-serif';
  const display = avatar && avatar.startsWith('http') ? '' : avatar || '🂠';
  g.fillText(display, 48, 172);
  const texture = new THREE.CanvasTexture(canvas);
  applySRGBColorSpace(texture);
  texture.anisotropy = 8;
  if (avatar && avatar.startsWith('http')) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      g.save();
      g.beginPath();
      g.arc(128, 128, 96, 0, Math.PI * 2);
      g.closePath();
      g.clip();
      g.drawImage(img, 32, 32, 192, 192);
      g.restore();
      texture.needsUpdate = true;
    };
    img.src = avatar;
  }
  g.font = 'bold 96px "Inter", system-ui, sans-serif';
  g.fillText(name, 220, 172);
  texture.needsUpdate = true;
  return texture;
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

function setMeshPosition(mesh, target, lookTarget, orientation, immediate, animations) {
  if (!mesh) return;
  const orientTarget = lookTarget.clone();
  const orientOptions =
    typeof orientation === 'object' && orientation !== null
      ? orientation
      : { face: orientation ? 'front' : 'back', flat: false };
  const stopExisting = () => {
    if (mesh.userData?.animation) {
      mesh.userData.animation.cancelled = true;
      mesh.userData.animation = null;
    }
  };

  if (immediate || !animations) {
    stopExisting();
    mesh.position.copy(target);
    orientMesh(mesh, orientTarget, orientOptions);
    return;
  }

  const current = mesh.position.clone();
  if (current.distanceToSquared(target) < 1e-6) {
    stopExisting();
    mesh.position.copy(target);
    orientMesh(mesh, orientTarget, orientOptions);
    return;
  }

  stopExisting();
  const animation = {
    mesh,
    from: current,
    to: target.clone(),
    lookTarget: orientTarget,
    orientation: orientOptions,
    start: performance.now(),
    duration: CARD_ANIMATION_DURATION,
    cancelled: false
  };
  mesh.userData.animation = animation;
  animations.push(animation);
}

function orientMesh(mesh, lookTarget, options = {}) {
  const { face = 'front', flat = false } = options;
  mesh.up.set(0, 1, 0);
  mesh.lookAt(lookTarget);
  mesh.rotation.z = 0;
  if (flat) {
    mesh.rotateX(-Math.PI / 2);
  }
  if (face === 'back') {
    mesh.rotateY(Math.PI);
  }
}

function updateCardFace(mesh, mode) {
  if (!mesh?.material) return;
  const { frontMaterial, backMaterial, hiddenMaterial, cardFace } = mesh.userData ?? {};
  if (!frontMaterial || !backMaterial) return;
  if (mode === cardFace) return;
  if (mode === 'back') {
    const mat = hiddenMaterial ?? backMaterial;
    mesh.material[4] = mat;
    mesh.material[5] = mat;
    mesh.userData.cardFace = 'back';
    return;
  }
  mesh.material[4] = frontMaterial;
  mesh.material[5] = backMaterial;
  mesh.userData.cardFace = 'front';
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function normalizeAngle(angle) {
  const twoPi = Math.PI * 2;
  let value = angle % twoPi;
  if (value > Math.PI) {
    value -= twoPi;
  } else if (value <= -Math.PI) {
    value += twoPi;
  }
  return value;
}

function shortestAngleDifference(from, to) {
  return normalizeAngle(to - from);
}

function updateCameraFromSpherical(camera, spherical, target, store) {
  const offset = new THREE.Vector3().setFromSpherical(spherical);
  const position = offset.clone().add(target);

  if (store?.cameraBounds) {
    const { cameraBounds } = store;
    const clamped = position.clone();
    if (typeof cameraBounds.minX === 'number' && typeof cameraBounds.maxX === 'number') {
      clamped.x = THREE.MathUtils.clamp(clamped.x, cameraBounds.minX, cameraBounds.maxX);
    }
    if (typeof cameraBounds.minY === 'number' || typeof cameraBounds.maxY === 'number') {
      const lower = typeof cameraBounds.minY === 'number' ? cameraBounds.minY : clamped.y;
      const upper = typeof cameraBounds.maxY === 'number' ? cameraBounds.maxY : clamped.y;
      clamped.y = THREE.MathUtils.clamp(clamped.y, lower, upper);
    }
    if (typeof cameraBounds.minZ === 'number' && typeof cameraBounds.maxZ === 'number') {
      clamped.z = THREE.MathUtils.clamp(clamped.z, cameraBounds.minZ, cameraBounds.maxZ);
    }
    if (!clamped.equals(position)) {
      const correctedOffset = clamped.clone().sub(target);
      const corrected = new THREE.Spherical().setFromVector3(correctedOffset);
      spherical.radius = corrected.radius;
      spherical.theta = corrected.theta;
      spherical.phi = corrected.phi;
      camera.position.copy(clamped);
    } else {
      camera.position.copy(position);
    }
    store.cameraRadius = spherical.radius;
  } else {
    camera.position.copy(position);
    if (store) {
      store.cameraRadius = spherical.radius;
    }
  }

  camera.lookAt(target);
}

function createCardMesh(card, geometry, cache, theme) {
  const faceKey = `${theme.id}-${card.rank}-${card.suit}`;
  let faceTexture = cache.get(faceKey);
  if (!faceTexture) {
    faceTexture = makeCardFace(card.rank, card.suit, theme);
    cache.set(faceKey, faceTexture);
  }
  const edgeMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.edgeColor), roughness: 0.55, metalness: 0.1 });
  const edgeMats = [edgeMat, edgeMat.clone(), edgeMat.clone(), edgeMat.clone()];
  const frontMat = new THREE.MeshStandardMaterial({
    map: faceTexture,
    roughness: 0.35,
    metalness: 0.08,
    color: new THREE.Color('#ffffff')
  });
  const backTexture = makeCardBackTexture(theme);
  const backMat = new THREE.MeshStandardMaterial({
    map: backTexture,
    color: new THREE.Color(theme.backColor),
    roughness: 0.6,
    metalness: 0.15
  });
  const hiddenMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(theme.hiddenColor || theme.backColor),
    roughness: 0.7,
    metalness: 0.12
  });
  const mesh = new THREE.Mesh(geometry, [...edgeMats, frontMat, backMat]);
  mesh.userData.cardId = card.id;
  mesh.userData.card = card;
  mesh.userData.frontMaterial = frontMat;
  mesh.userData.backMaterial = backMat;
  mesh.userData.hiddenMaterial = hiddenMat;
  mesh.userData.edgeMaterials = edgeMats;
  mesh.userData.backTexture = backTexture;
  mesh.userData.cardFace = 'front';
  return mesh;
}

function makeCardFace(rank, suit, theme, w = 512, h = 720) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  g.fillStyle = theme.frontBackground || '#ffffff';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = theme.frontBorder || '#e5e7eb';
  g.lineWidth = 8;
  roundRect(g, 6, 6, w - 12, h - 12, 32);
  g.stroke();
  const color = SUIT_COLORS[suit] || '#111111';
  g.fillStyle = color;
  const label = rank === 'JB' ? 'JB' : rank === 'JR' ? 'JR' : String(rank);
  const padding = 36;
  const topRankY = 96;
  const topSuitY = topRankY + 76;
  const bottomSuitY = h - 92;
  const bottomRankY = bottomSuitY - 76;
  g.font = 'bold 96px "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI"';
  g.textAlign = 'left';
  g.fillText(label, padding, topRankY);
  g.font = 'bold 78px "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI"';
  g.fillText(suit, padding, topSuitY);
  g.font = 'bold 96px "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI"';
  g.fillText(label, padding, bottomRankY);
  g.font = 'bold 78px "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI"';
  g.fillText(suit, padding, bottomSuitY);
  g.textAlign = 'right';
  g.font = 'bold 96px "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI"';
  g.fillText(label, w - padding, topRankY);
  g.font = 'bold 78px "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI"';
  g.fillText(suit, w - padding, topSuitY);
  g.font = 'bold 96px "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI"';
  g.fillText(label, w - padding, bottomRankY);
  g.font = 'bold 78px "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI"';
  g.fillText(suit, w - padding, bottomSuitY);

  if (theme.centerAccent) {
    g.fillStyle = theme.centerAccent;
    g.beginPath();
    g.ellipse(w / 2, h / 2, w * 0.18, h * 0.22, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = color;
  g.font = 'bold 160px "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI"';
  g.textAlign = 'center';
  g.fillText(suit, w / 2, h / 2 + 56);
  const tex = new THREE.CanvasTexture(canvas);
  applySRGBColorSpace(tex);
  tex.anisotropy = 8;
  return tex;
}

function makeCardBackTexture(theme, w = 512, h = 720) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const [c1, c2] = theme.backGradient || [theme.backColor, theme.backColor];
  const gradient = ctx.createLinearGradient(0, 0, w, h);
  gradient.addColorStop(0, c1);
  gradient.addColorStop(1, c2);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = theme.backBorder || 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 14;
  roundRect(ctx, 18, 18, w - 36, h - 36, 48);
  ctx.stroke();
  if (theme.backAccent) {
    ctx.strokeStyle = theme.backAccent;
    ctx.lineWidth = 8;
    for (let i = 0; i < 6; i += 1) {
      const inset = 36 + i * 18;
      roundRect(ctx, inset, inset, w - inset * 2, h - inset * 2, 42);
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  applySRGBColorSpace(texture);
  texture.anisotropy = 8;
  return texture;
}

function applyChairThemeMaterials(three, theme) {
  const mats = three?.chairMaterials;
  if (!mats) return;
  if (mats.seat?.color) mats.seat.color.set(theme.seatColor);
  if (mats.leg?.color) mats.leg.color.set(theme.legColor);
}

function applyOutfitThemeMaterials(three, theme) {
  const parts = three?.outfitParts;
  if (!parts) return;
  if (parts.bodyMaterial?.color) parts.bodyMaterial.color.set(theme.baseColor);
  if (parts.bodyMaterial?.emissive) parts.bodyMaterial.emissive.set(theme.glow || '#000000');
  if (parts.accentMaterial?.color) parts.accentMaterial.color.set(theme.accentColor);
}

function applyCardThemeMaterials(three, theme, force = false) {
  if (!three?.cardMap) return;
  if (!force && three.cardThemeId === theme.id) return;
  const frontTextures = new Set();
  const backTextures = new Set();
  three.cardMap.forEach(({ mesh }) => {
    const { frontMaterial, backTexture } = mesh.userData ?? {};
    if (frontMaterial?.map) frontTextures.add(frontMaterial.map);
    if (backTexture) backTextures.add(backTexture);
  });
  frontTextures.forEach((tex) => tex?.dispose?.());
  backTextures.forEach((tex) => tex?.dispose?.());
  three.faceTextureCache.forEach((tex) => tex.dispose());
  three.faceTextureCache.clear();
  three.cardMap.forEach(({ mesh }) => {
    const { frontMaterial, backMaterial, hiddenMaterial, edgeMaterials, card } = mesh.userData ?? {};
    if (!frontMaterial || !backMaterial || !edgeMaterials || !card) return;
    const faceKey = `${theme.id}-${card.rank}-${card.suit}`;
    let faceTexture = three.faceTextureCache.get(faceKey);
    if (!faceTexture) {
      faceTexture = makeCardFace(card.rank, card.suit, theme);
      three.faceTextureCache.set(faceKey, faceTexture);
    }
    frontMaterial.map = faceTexture;
    frontMaterial.color?.set?.('#ffffff');
    frontMaterial.needsUpdate = true;
    const backTexture = makeCardBackTexture(theme);
    mesh.userData.backTexture = backTexture;
    backMaterial.map = backTexture;
    backMaterial.color?.set?.(theme.backColor);
    backMaterial.needsUpdate = true;
    if (hiddenMaterial?.color) {
      hiddenMaterial.color.set(theme.hiddenColor || theme.backColor);
      hiddenMaterial.needsUpdate = true;
    }
    edgeMaterials.forEach((mat) => {
      mat.color?.set?.(theme.edgeColor);
      mat.needsUpdate = true;
    });
  });
  three.cardThemeId = theme.id;
}
