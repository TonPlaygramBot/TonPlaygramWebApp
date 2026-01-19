import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { bombSound, chatBeep } from '../assets/soundData.js';
import BottomLeftIcons from './BottomLeftIcons.jsx';
import GiftPopup from './GiftPopup.jsx';
import InfoPopup from './InfoPopup.jsx';
import QuickMessagePopup from './QuickMessagePopup.jsx';
import { giftSounds } from '../utils/giftSounds.js';
import { getGameVolume, isGameMuted } from '../utils/sound.js';
import { getAvatarUrl } from '../utils/avatarUtils.js';
import { applyWoodTextures, WOOD_GRAIN_OPTIONS_BY_ID } from '../utils/woodMaterials.js';
import { AIR_HOCKEY_CUSTOMIZATION } from '../config/airHockeyInventoryConfig.js';
import {
  airHockeyAccountId,
  getAirHockeyInventory,
  isAirHockeyOptionUnlocked
} from '../utils/airHockeyInventory.js';

const CUSTOMIZATION_KEYS = Object.freeze([
  'field',
  'table',
  'tableBase',
  'environmentHdri',
  'puck',
  'mallet',
  'rails',
  'goals'
]);

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const DEFAULT_RENDER_PIXEL_RATIO_CAP = 1.25;
const RENDER_PIXEL_RATIO_SCALE = 1.0;
const MIN_RENDER_PIXEL_RATIO = 0.85;
const GRAPHICS_STORAGE_KEY = 'airHockeyGraphics';
const GRAPHICS_OPTIONS = Object.freeze([
  {
    id: 'hd50',
    label: 'HD Performance (50 Hz)',
    fps: 50,
    renderScale: 1,
    pixelRatioCap: 1.4,
    pixelRatioScale: 1,
    resolution: 'HD render • DPR 1.4 cap',
    description: 'Minimum HD output for battery saver and 50–60 Hz displays.'
  },
  {
    id: 'fhd60',
    label: 'Full HD (60 Hz)',
    fps: 60,
    renderScale: 1.1,
    pixelRatioCap: 1.5,
    pixelRatioScale: 1,
    resolution: 'Full HD render • DPR 1.5 cap',
    description: '1080p-focused profile that mirrors the Snooker frame pacing.'
  },
  {
    id: 'qhd90',
    label: 'Quad HD (90 Hz)',
    fps: 90,
    renderScale: 1.25,
    pixelRatioCap: 1.7,
    pixelRatioScale: 1,
    resolution: 'QHD render • DPR 1.7 cap',
    description: 'Sharper 1440p render for capable 90 Hz mobile and desktop GPUs.'
  },
  {
    id: 'uhd120',
    label: 'Ultra HD (120 Hz)',
    fps: 120,
    renderScale: 1.35,
    pixelRatioCap: 2,
    pixelRatioScale: 1,
    resolution: 'Ultra HD render • DPR 2.0 cap',
    description: '4K-oriented profile for 120 Hz flagships and desktops.'
  },
  {
    id: 'ultra144',
    label: 'Ultra HD+ (144 Hz)',
    fps: 144,
    renderScale: 1.5,
    pixelRatioCap: 2.2,
    pixelRatioScale: 1,
    resolution: 'Ultra HD+ render • DPR 2.2 cap',
    description: 'Maximum clarity preset that prioritizes UHD detail at 144 Hz.'
  }
]);
const DEFAULT_GRAPHICS_ID = 'fhd60';

function detectRefreshRateHint() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  const queries = [
    { query: '(min-refresh-rate: 143hz)', fps: 144 },
    { query: '(min-refresh-rate: 119hz)', fps: 120 },
    { query: '(min-refresh-rate: 89hz)', fps: 90 },
    { query: '(max-refresh-rate: 59hz)', fps: 60 },
    { query: '(max-refresh-rate: 50hz)', fps: 50 },
    { query: '(prefers-reduced-motion: reduce)', fps: 50 }
  ];
  for (const { query, fps } of queries) {
    try {
      if (window.matchMedia(query).matches) {
        return fps;
      }
    } catch {}
  }
  return null;
}

function resolveDefaultGraphicsId() {
  const hint = detectRefreshRateHint();
  if (hint >= 144) return 'ultra144';
  if (hint >= 120) return 'uhd120';
  if (hint >= 90) return 'qhd90';
  if (hint && hint <= 50) return 'hd50';
  return DEFAULT_GRAPHICS_ID;
}

function selectPerformanceProfile(option = null) {
  const targetFps = clamp(option?.fps ?? detectRefreshRateHint() ?? 60, 45, 144);
  return {
    targetFps,
    renderScale: option?.renderScale ?? 1,
    pixelRatioCap: option?.pixelRatioCap ?? DEFAULT_RENDER_PIXEL_RATIO_CAP,
    pixelRatioScale: option?.pixelRatioScale ?? RENDER_PIXEL_RATIO_SCALE
  };
}

const DEFAULT_HDRI_RESOLUTIONS = ['4k'];

const pickPolyHavenHdriUrl = (json, preferred = DEFAULT_HDRI_RESOLUTIONS) => {
  if (!json || typeof json !== 'object') return null;
  const resolutions = Array.isArray(preferred) && preferred.length ? preferred : DEFAULT_HDRI_RESOLUTIONS;
  for (const res of resolutions) {
    const entry = json[res];
    if (entry?.hdr) return entry.hdr;
    if (entry?.exr) return entry.exr;
  }
  const fallback = Object.values(json).find((value) => value?.hdr || value?.exr);
  if (!fallback) return null;
  return fallback.hdr || fallback.exr || null;
};

async function resolvePolyHavenHdriUrl(config = {}) {
  const forcedResolution =
    typeof config?.forceResolution === 'string' && config.forceResolution.length
      ? config.forceResolution
      : null;
  const preferred = forcedResolution
    ? [forcedResolution]
    : Array.isArray(config?.preferredResolutions) && config.preferredResolutions.length
      ? config.preferredResolutions
      : DEFAULT_HDRI_RESOLUTIONS;
  const fallbackRes = forcedResolution || config?.fallbackResolution || preferred[0] || '4k';
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

async function loadPolyHavenHdriEnvironment(renderer, config = {}) {
  if (!renderer) return null;
  const url = await resolvePolyHavenHdriUrl(config);
  const lowerUrl = `${url ?? ''}`.toLowerCase();
  const useExr = lowerUrl.endsWith('.exr');
  const loader = useExr ? new EXRLoader() : null;
  const rgbeLoader = new RGBELoader();
  const activeLoader = useExr && loader ? loader : rgbeLoader;
  if (!activeLoader) return null;
  activeLoader.setCrossOrigin?.('anonymous');
  return new Promise((resolve) => {
    activeLoader.load(
      url,
      (texture) => {
        const pmrem = new THREE.PMREMGenerator(renderer);
        pmrem.compileEquirectangularShader();
        const envMap = pmrem.fromEquirectangular(texture).texture;
        envMap.name = `${config?.assetId ?? 'polyhaven'}-env`;
        texture.dispose();
        pmrem.dispose();
        resolve({ envMap, url });
      },
      undefined,
      (error) => {
        console.warn('Failed to load Poly Haven HDRI', error);
        resolve(null);
      }
    );
  });
}

const POOL_ENVIRONMENT = (() => {
  const TABLE_SIZE_SHRINK = 0.85;
  const TABLE_REDUCTION = 0.84 * TABLE_SIZE_SHRINK;
  const SIZE_REDUCTION = 0.7;
  const GLOBAL_SIZE_FACTOR = 0.85 * SIZE_REDUCTION;
  const TABLE_DISPLAY_SCALE = 0.78;
  const WORLD_SCALE = 0.85 * GLOBAL_SIZE_FACTOR * 0.7 * TABLE_DISPLAY_SCALE;

  const TABLE_BASE_SCALE = 1.2;
  const TABLE_WIDTH_SCALE = 1.25;
  const TABLE_SCALE = TABLE_BASE_SCALE * TABLE_REDUCTION * TABLE_WIDTH_SCALE;
  const TABLE_LENGTH_SCALE = 0.8;
  const TABLE_WIDTH_RAW = 72 * TABLE_SCALE;
  const TABLE_LENGTH_RAW = 132 * TABLE_SCALE * TABLE_LENGTH_SCALE;
  const TABLE_THICKNESS_RAW = 1.8 * TABLE_SCALE;
  const FRAME_TOP_Y = -TABLE_THICKNESS_RAW + 0.01;

  const LEG_SCALE = 6.2;
  const LEG_HEIGHT_FACTOR = 4;
  const LEG_HEIGHT_MULTIPLIER = 4.5;
  const BASE_TABLE_LIFT = 3.6;
  const TABLE_DROP = 0.4;
  const TABLE_HEIGHT_REDUCTION = 1;
  const TABLE_HEIGHT_SCALE = 1.56 * 1.3;
  const TABLE_H_RAW = 0.75 * LEG_SCALE * TABLE_HEIGHT_REDUCTION * TABLE_HEIGHT_SCALE;
  const TABLE_LIFT_RAW = BASE_TABLE_LIFT + TABLE_H_RAW * (LEG_HEIGHT_FACTOR - 1);
  const BASE_LEG_HEIGHT_RAW = TABLE_THICKNESS_RAW * 2 * 3 * 1.15 * LEG_HEIGHT_MULTIPLIER;
  const BASE_LEG_LENGTH_SCALE = 0.72;
  const LEG_ELEVATION_SCALE = 0.96;
  const LEG_LENGTH_SHRINK = 0.867;
  const LEG_LENGTH_SCALE = BASE_LEG_LENGTH_SCALE * LEG_ELEVATION_SCALE * LEG_LENGTH_SHRINK;
  const LEG_HEIGHT_OFFSET = FRAME_TOP_Y - 0.3;
  const LEG_ROOM_HEIGHT_RAW = BASE_LEG_HEIGHT_RAW + TABLE_LIFT_RAW;
  const BASE_LEG_ROOM_HEIGHT_RAW =
    (LEG_ROOM_HEIGHT_RAW + LEG_HEIGHT_OFFSET) * BASE_LEG_LENGTH_SCALE - LEG_HEIGHT_OFFSET;
  const LEG_ROOM_HEIGHT =
    (LEG_ROOM_HEIGHT_RAW + LEG_HEIGHT_OFFSET) * LEG_LENGTH_SCALE - LEG_HEIGHT_OFFSET;
  const LEG_ELEVATION_DELTA = LEG_ROOM_HEIGHT - BASE_LEG_ROOM_HEIGHT_RAW;

  const BASE_TABLE_Y = -2 + (TABLE_H_RAW - 0.75) + TABLE_H_RAW + TABLE_LIFT_RAW - TABLE_DROP;
  const TABLE_Y_RAW = BASE_TABLE_Y + LEG_ELEVATION_DELTA;
  const LEG_BASE_DROP = LEG_ROOM_HEIGHT * 0.3;
  const TABLE_SURFACE_RAW = TABLE_Y_RAW - TABLE_THICKNESS_RAW + 0.01;
  const FLOOR_Y_RAW = TABLE_Y_RAW - TABLE_THICKNESS_RAW - LEG_ROOM_HEIGHT - LEG_BASE_DROP + 0.3;

  const ROOM_DEPTH_RAW = TABLE_LENGTH_RAW * 3.6;
  const SIDE_CLEARANCE_RAW = ROOM_DEPTH_RAW / 2 - TABLE_LENGTH_RAW / 2;
  const ROOM_WIDTH_RAW = TABLE_WIDTH_RAW + SIDE_CLEARANCE_RAW * 2;
  const WALL_THICKNESS_RAW = 1.2;
  const WALL_HEIGHT_BASE_RAW = LEG_ROOM_HEIGHT + TABLE_THICKNESS_RAW + 40;
  const WALL_HEIGHT_RAW = WALL_HEIGHT_BASE_RAW * 1.3 * 1.3;
  const CARPET_THICKNESS_RAW = 1.2;
  const CARPET_INSET_RAW = WALL_THICKNESS_RAW * 0.02;
  const CARPET_WIDTH_RAW = ROOM_WIDTH_RAW - WALL_THICKNESS_RAW + CARPET_INSET_RAW;
  const CARPET_DEPTH_RAW = ROOM_DEPTH_RAW - WALL_THICKNESS_RAW + CARPET_INSET_RAW;

  return Object.freeze({
    WORLD_SCALE,
    tableWidth: TABLE_WIDTH_RAW * WORLD_SCALE,
    tableLength: TABLE_LENGTH_RAW * WORLD_SCALE,
    tableThickness: TABLE_THICKNESS_RAW * WORLD_SCALE,
    tableSurfaceY: TABLE_SURFACE_RAW * WORLD_SCALE,
    floorY: FLOOR_Y_RAW * WORLD_SCALE,
    roomWidth: ROOM_WIDTH_RAW * WORLD_SCALE,
    roomDepth: ROOM_DEPTH_RAW * WORLD_SCALE,
    wallThickness: WALL_THICKNESS_RAW * WORLD_SCALE,
    wallHeight: WALL_HEIGHT_RAW * WORLD_SCALE,
    carpetThickness: CARPET_THICKNESS_RAW * WORLD_SCALE,
    carpetWidth: CARPET_WIDTH_RAW * WORLD_SCALE,
    carpetDepth: CARPET_DEPTH_RAW * WORLD_SCALE
  });
})();

const POLYHAVEN_BASE_TEMPLATES = new Map();
const POLYHAVEN_BASE_PROMISES = new Map();

const buildPolyhavenModelUrls = (assetId = '') => {
  const normalizedId = `${assetId}`.trim().toLowerCase();
  if (!normalizedId) return [];
  return [
    `https://dl.polyhaven.org/file/ph-assets/Models/gltf/2k/${normalizedId}/${normalizedId}_2k.gltf`,
    `https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/${normalizedId}/${normalizedId}_1k.gltf`,
    `https://dl.polyhaven.org/file/ph-assets/Models/glb/${normalizedId}.glb`
  ];
};

const ensurePolyhavenBaseTemplate = (assetId) => {
  if (!assetId) return Promise.resolve(null);
  if (POLYHAVEN_BASE_TEMPLATES.has(assetId)) {
    return Promise.resolve(POLYHAVEN_BASE_TEMPLATES.get(assetId));
  }
  if (POLYHAVEN_BASE_PROMISES.has(assetId)) {
    return POLYHAVEN_BASE_PROMISES.get(assetId);
  }
  const loader = new GLTFLoader();
  loader.setCrossOrigin('anonymous');
  const promise = (async () => {
    const urls = buildPolyhavenModelUrls(assetId);
    let lastError = null;
    for (const url of urls) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const gltf = await loader.loadAsync(url);
        const scene = gltf?.scene || gltf?.scenes?.[0];
        if (scene) {
          POLYHAVEN_BASE_TEMPLATES.set(assetId, scene);
          return scene;
        }
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('Failed to load Poly Haven base model');
  })()
    .catch((error) => {
      console.warn('Failed to load Poly Haven table base', error);
      return null;
    })
    .finally(() => {
      POLYHAVEN_BASE_PROMISES.delete(assetId);
    });
  POLYHAVEN_BASE_PROMISES.set(assetId, promise);
  return promise;
};

const clonePolyhavenBaseTemplate = (assetId) => {
  const template = POLYHAVEN_BASE_TEMPLATES.get(assetId);
  return template?.clone?.(true) ?? null;
};

/**
 * AIR HOCKEY 3D — Mobile Portrait
 * -------------------------------
 * • HDRI-lit Air Hockey arena with Murlan Royale environments (no walls or carpet)
 * • Player-edge camera for an at-table perspective suited to portrait play
 * • Controls: drag bottom half to move mallet
 * • AI opponent on top half with simple tracking logic
 * • Scoreboard with avatars
 */

export default function AirHockey3D({ player, ai, target = 11, playType = 'regular', accountId }) {
  const targetValue = Number(target) || 11;
  const hostRef = useRef(null);
  const raf = useRef(0);
  const [ui, setUi] = useState({ left: 0, right: 0 });
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState('');
  const [goalPopup, setGoalPopup] = useState(null);
  const [postPopup, setPostPopup] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const resolvedAccountId = useMemo(() => airHockeyAccountId(accountId), [accountId]);
  const [airInventory, setAirInventory] = useState(() => getAirHockeyInventory(resolvedAccountId));
  const defaultSelections = useMemo(
    () =>
      CUSTOMIZATION_KEYS.reduce((acc, key) => {
        acc[key] = AIR_HOCKEY_CUSTOMIZATION[key]?.[0]?.id;
        return acc;
      }, {}),
    []
  );
  const [selections, setSelections] = useState({
    ...defaultSelections
  });
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [isTopDownView, setIsTopDownView] = useState(false);
  const [cameraLift, setCameraLift] = useState(1);
  const [showInfo, setShowInfo] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showGift, setShowGift] = useState(false);
  const [chatBubbles, setChatBubbles] = useState([]);
  const [muted, setMuted] = useState(isGameMuted());
  const [graphicsId, setGraphicsId] = useState(() => {
    const fallback = resolveDefaultGraphicsId();
    if (typeof window === 'undefined') return fallback;
    try {
      const stored = window.localStorage?.getItem(GRAPHICS_STORAGE_KEY);
      if (stored && GRAPHICS_OPTIONS.some((opt) => opt.id === stored)) return stored;
    } catch {}
    return fallback;
  });
  const activeGraphicsOption = useMemo(
    () =>
      GRAPHICS_OPTIONS.find((opt) => opt.id === graphicsId) ||
      GRAPHICS_OPTIONS.find((opt) => opt.id === DEFAULT_GRAPHICS_ID) ||
      GRAPHICS_OPTIONS[0],
    [graphicsId]
  );
  const initialProfile = useMemo(() => selectPerformanceProfile(activeGraphicsOption), [activeGraphicsOption]);
  const targetRef = useRef(Number(target) || 3);
  const gameOverRef = useRef(false);
  const audioRef = useRef({
    hit: null,
    goal: null,
    whistle: null,
    post: null
  });
  const audioStartedRef = useRef(false);
  const hahaSoundRef = useRef(null);
  const bombSoundRef = useRef(null);
  const scoreRef = useRef({ left: 0, right: 0 });
  const goalTimeoutRef = useRef(null);
  const postTimeoutRef = useRef(null);
  const restartTimeoutRef = useRef(null);
  const redirectTimeoutRef = useRef(null);
  const materialsRef = useRef({
    tableSurface: null,
    frame: null,
    trim: null,
    base: null,
    baseAccent: null,
    rail: null,
    line: null,
    rings: [],
    goal: null,
    playerMallet: null,
    aiMallet: null,
    playerKnob: null,
    aiKnob: null,
    puck: null
  });
  const sceneRef = useRef(null);
  const environmentRef = useRef({ envMap: null });
  const tableBaseRef = useRef({ rebuild: () => {}, clear: () => {} });
  const malletRefs = useRef({ player: null, ai: null });
  const malletDimensionsRef = useRef({
    radius: 0,
    knobRadius: 0,
    height: 0,
    knobHeight: 0
  });
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const cameraViewRef = useRef({ applyCurrent: () => {} });
  const cameraLiftRef = useRef(1);
  const cameraDragRef = useRef({
    active: false,
    pointerId: null,
    startY: 0,
    startLift: 1
  });
  const isTopDownViewRef = useRef(false);
  const renderSettingsRef = useRef({
    targetFrameIntervalMs: 1000 / initialProfile.targetFps,
    renderResolutionScale: initialProfile.renderScale ?? 1,
    pixelRatioCap: initialProfile.pixelRatioCap ?? DEFAULT_RENDER_PIXEL_RATIO_CAP,
    pixelRatioScale: initialProfile.pixelRatioScale ?? RENDER_PIXEL_RATIO_SCALE
  });
  const lastFrameTimeRef = useRef(0);
  const frameAccumulatorRef = useRef(0);
  const selectionsRef = useRef(selections);
  const chatAvatar = useMemo(() => getAvatarUrl(player.avatar), [player.avatar]);
  const giftPlayers = useMemo(() => {
    const playerAvatar = getAvatarUrl(player.avatar);
    const aiAvatar = getAvatarUrl(ai.avatar);
    const safeId = resolvedAccountId || accountId || 'guest';
    return [
      {
        ...player,
        id: safeId,
        index: 0,
        photoUrl: playerAvatar,
        name: player.name || 'Player'
      },
      {
        ...ai,
        id: safeId,
        index: 1,
        photoUrl: aiAvatar,
        name: ai.name || 'Opponent'
      }
    ];
  }, [ai, accountId, player, resolvedAccountId]);
  const updateRendererSettings = useCallback(() => {
    const renderer = rendererRef.current;
    const host = hostRef.current;
    if (!renderer || !host || typeof window === 'undefined') return;

    const { renderResolutionScale, pixelRatioCap, pixelRatioScale } = renderSettingsRef.current;
    const devicePixelRatio = window.devicePixelRatio || 1;
    const scaledPixelRatio = devicePixelRatio * pixelRatioScale;
    const pixelRatio = Math.max(
      MIN_RENDER_PIXEL_RATIO,
      Math.min(pixelRatioCap, scaledPixelRatio)
    );

    renderer.setPixelRatio(pixelRatio);
    const targetWidth = host.clientWidth * renderResolutionScale;
    const targetHeight = host.clientHeight * renderResolutionScale;
    renderer.setSize(targetWidth, targetHeight, false);
    renderer.domElement.style.width = `${host.clientWidth}px`;
    renderer.domElement.style.height = `${host.clientHeight}px`;
  }, []);
  const updateCameraLift = useCallback((nextLift) => {
    const clamped = clamp(nextLift, 0, 1);
    if (clamped === cameraLiftRef.current) return;
    cameraLiftRef.current = clamped;
    setCameraLift(clamped);
    cameraViewRef.current.applyCurrent?.(isTopDownViewRef.current, clamped);
  }, []);
  const tableGroupRef = useRef(null);
  const avatarSpritesRef = useRef({ player: null, ai: null });
  const getOption = (key, optionId) => {
    const options = AIR_HOCKEY_CUSTOMIZATION[key] || [];
    return options.find((option) => option.id === optionId) || options[0];
  };

  useEffect(() => {
    setAirInventory(getAirHockeyInventory(resolvedAccountId));
  }, [resolvedAccountId]);

  useEffect(() => {
    selectionsRef.current = selections;
  }, [selections]);

  useEffect(() => {
    tableBaseRef.current?.rebuild?.(selections.tableBase);
  }, [selections.tableBase]);

  useEffect(() => {
    const handler = (event) => {
      if (!event?.detail?.accountId || event.detail.accountId === resolvedAccountId) {
        setAirInventory(getAirHockeyInventory(resolvedAccountId));
      }
    };
    window.addEventListener('airHockeyInventoryUpdate', handler);
    return () => window.removeEventListener('airHockeyInventoryUpdate', handler);
  }, [resolvedAccountId]);

  useEffect(() => {
    setSelections((prev) => {
      let changed = false;
      const next = { ...prev };
      CUSTOMIZATION_KEYS.forEach((key) => {
        const currentId = prev[key];
        if (!isAirHockeyOptionUnlocked(key, currentId, airInventory)) {
          const fallback = (AIR_HOCKEY_CUSTOMIZATION[key] || []).find((option) =>
            isAirHockeyOptionUnlocked(key, option.id, airInventory)
          );
          if (fallback && fallback.id !== currentId) {
            next[key] = fallback.id;
            changed = true;
          }
        }
      });
      return changed ? next : prev;
    });
  }, [airInventory]);

  useEffect(() => {
    if (!gameOver) return undefined;

    setRedirecting(true);
    redirectTimeoutRef.current = setTimeout(() => {
      window.location.href = '/games/airhockey/lobby';
    }, 2000);

    return () => {
      clearTimeout(redirectTimeoutRef.current);
    };
  }, [gameOver]);

  useEffect(() => () => {
    clearTimeout(goalTimeoutRef.current);
    clearTimeout(postTimeoutRef.current);
    clearTimeout(restartTimeoutRef.current);
    clearTimeout(redirectTimeoutRef.current);
  }, []);

  useEffect(() => {
    targetRef.current = Number(target) || 3;
  }, [target]);

  useEffect(() => {
    try {
      window.localStorage?.setItem(GRAPHICS_STORAGE_KEY, graphicsId);
    } catch {}
  }, [graphicsId]);

  useEffect(() => {
    const profile = selectPerformanceProfile(activeGraphicsOption);
    renderSettingsRef.current = {
      targetFrameIntervalMs: 1000 / profile.targetFps,
      renderResolutionScale: profile.renderScale ?? 1,
      pixelRatioCap: profile.pixelRatioCap ?? DEFAULT_RENDER_PIXEL_RATIO_CAP,
      pixelRatioScale: profile.pixelRatioScale ?? RENDER_PIXEL_RATIO_SCALE
    };
    lastFrameTimeRef.current = 0;
    frameAccumulatorRef.current = 0;
    updateRendererSettings();
  }, [activeGraphicsOption, updateRendererSettings]);

  useEffect(() => {
    isTopDownViewRef.current = isTopDownView;
    cameraLiftRef.current = cameraLift;
    cameraViewRef.current.applyCurrent?.(isTopDownView, cameraLift);
  }, [cameraLift, isTopDownView]);

  useEffect(() => {
    const handler = () => setMuted(isGameMuted());
    window.addEventListener('gameMuteChanged', handler);
    return () => window.removeEventListener('gameMuteChanged', handler);
  }, []);

  useEffect(() => {
    const vol = getGameVolume();
    hahaSoundRef.current = new Audio('/assets/sounds/Haha.mp3');
    hahaSoundRef.current.volume = vol;
    bombSoundRef.current = new Audio(bombSound);
    bombSoundRef.current.volume = vol;
    return () => {
      hahaSoundRef.current?.pause();
      bombSoundRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    audioRef.current.hit = new Audio('/assets/sounds/football-game-sound-effects-359284.mp3');
    audioRef.current.goal = new Audio('/assets/sounds/a-football-hits-the-net-goal-313216.mp3');
    audioRef.current.whistle = new Audio('/assets/sounds/metal-whistle-6121.mp3');
    audioRef.current.post = new Audio('/assets/sounds/frying-pan-over-the-head-89303.mp3');

    const primeAudio = () => {
      const audios = Object.values(audioRef.current).filter(Boolean);
      if (!audios.length || audioStartedRef.current) return;

      let unlocked = false;
      let pending = audios.length;

      audios.forEach((audio) => {
        const originalVolume = audio.volume;
        audio.volume = Math.max(0.0001, originalVolume * 0.0001);
        audio.currentTime = 0;

        const finalize = (wasUnlocked) => {
          unlocked = unlocked || wasUnlocked;
          audio.volume = originalVolume;
          pending -= 1;
          if (pending === 0) {
            audioStartedRef.current = unlocked;
          }
        };

        const playPromise = audio.play();
        if (playPromise && playPromise.then) {
          playPromise
            .then(() => {
              audio.pause();
              audio.currentTime = 0;
              finalize(true);
            })
            .catch(() => finalize(false));
        } else {
          audio.pause();
          audio.currentTime = 0;
          finalize(true);
        }
      });
    };

    const playWhistle = () => {
      if (isGameMuted()) return;
      const whistle = audioRef.current.whistle;
      if (!whistle || !audioStartedRef.current) return;
      whistle.volume = getGameVolume();
      whistle.currentTime = 0;
      whistle.play().catch(() => {});
      setTimeout(() => {
        whistle.pause();
        whistle.currentTime = 0;
      }, 2000);
    };

    const playHit = () => {
      if (isGameMuted()) return;
      const hit = audioRef.current.hit;
      if (!hit || !audioStartedRef.current) return;
      hit.volume = getGameVolume();
      hit.currentTime = 0;
      hit.play().catch(() => {});
      setTimeout(() => {
        hit.pause();
      }, 700);
    };

    const playPost = () => {
      if (isGameMuted()) return;
      const post = audioRef.current.post;
      if (!post || !audioStartedRef.current) return;
      post.volume = Math.min(1, getGameVolume() * 0.7);
      post.currentTime = 0.15;
      post.play().catch(() => {});
      setTimeout(() => {
        post.pause();
        post.currentTime = 0.15;
      }, 1000);
      setPostPopup(true);
      clearTimeout(postTimeoutRef.current);
      postTimeoutRef.current = setTimeout(() => setPostPopup(false), 900);
    };

    const playGoal = () => {
      if (isGameMuted()) return;
      const goal = audioRef.current.goal;
      if (!goal || !audioStartedRef.current) return;
      goal.volume = getGameVolume();
      goal.currentTime = 0;
      goal.play().catch(() => {});
      setTimeout(() => {
        goal.pause();
        goal.currentTime = 0;
      }, 2000);
    };

    const recordGoal = (playerScored) => {
      scoreRef.current = {
        left: scoreRef.current.left + (playerScored ? 1 : 0),
        right: scoreRef.current.right + (playerScored ? 0 : 1)
      };
      setUi({ ...scoreRef.current });
      setGoalPopup({
        scorer: playerScored ? player.name : ai.name,
        scoreLine: `${scoreRef.current.left} - ${scoreRef.current.right}`,
        isPlayer: playerScored
      });
      clearTimeout(goalTimeoutRef.current);
      goalTimeoutRef.current = setTimeout(() => setGoalPopup(null), 1500);
      const targetScore = targetRef.current;
      if (
        targetScore &&
        (scoreRef.current.left >= targetScore || scoreRef.current.right >= targetScore)
      ) {
        gameOverRef.current = true;
        setGameOver(true);
        setWinner(playerScored ? player.name : ai.name);
        return true;
      }
      return false;
    };

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.85;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    updateRendererSettings();

    const createPuckTexture = () => {
      const size = 512;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      const cx = size / 2;
      const cy = size / 2;

      ctx.fillStyle = '#0b0c0f';
      ctx.fillRect(0, 0, size, size);

      const outerRim = ctx.createRadialGradient(cx, cy, size * 0.1, cx, cy, size * 0.48);
      outerRim.addColorStop(0, '#1b1f23');
      outerRim.addColorStop(0.55, '#0f1114');
      outerRim.addColorStop(1, '#040506');
      ctx.fillStyle = outerRim;
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.48, 0, Math.PI * 2);
      ctx.fill();

      const rimCut = ctx.createRadialGradient(cx, cy, size * 0.14, cx, cy, size * 0.42);
      rimCut.addColorStop(0, 'rgba(255,255,255,0.08)');
      rimCut.addColorStop(0.42, 'rgba(60,60,60,0.2)');
      rimCut.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.strokeStyle = rimCut;
      ctx.lineWidth = size * 0.05;
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.36, 0, Math.PI * 2);
      ctx.stroke();

      const top = ctx.createRadialGradient(cx, cy * 0.98, size * 0.06, cx, cy, size * 0.33);
      top.addColorStop(0, 'rgba(240,240,240,0.28)');
      top.addColorStop(0.6, 'rgba(80,85,90,0.18)');
      top.addColorStop(1, 'rgba(10,10,10,0.55)');
      ctx.fillStyle = top;
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.34, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.4);
      const sheen = ctx.createLinearGradient(-size * 0.2, -size * 0.18, size * 0.12, size * 0.26);
      sheen.addColorStop(0, 'rgba(255,255,255,0.12)');
      sheen.addColorStop(0.55, 'rgba(255,255,255,0.25)');
      sheen.addColorStop(1, 'rgba(255,255,255,0.06)');
      ctx.fillStyle = sheen;
      ctx.beginPath();
      ctx.ellipse(0, size * 0.02, size * 0.32, size * 0.21, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      for (let i = 0; i < 8; i += 1) {
        const angle = (i / 8) * Math.PI * 2;
        const radius = size * 0.36;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;
        ctx.beginPath();
        ctx.arc(x, y, size * 0.01, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      texture.needsUpdate = true;
      return texture;
    };

    const createMalletTexture = (color) => {
      const size = 512;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      const cx = size / 2;
      const cy = size / 2;

      const base = ctx.createRadialGradient(cx, cy, size * 0.08, cx, cy, size * 0.5);
      base.addColorStop(0, '#fafafc');
      base.addColorStop(0.08, '#ffffff');
      base.addColorStop(0.26, color);
      base.addColorStop(1, '#0a0a0c');
      ctx.fillStyle = base;
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.48, 0, Math.PI * 2);
      ctx.fill();

      const gloss = ctx.createLinearGradient(cx - size * 0.18, cy - size * 0.25, cx + size * 0.22, cy + size * 0.26);
      gloss.addColorStop(0, 'rgba(255,255,255,0.18)');
      gloss.addColorStop(0.55, 'rgba(255,255,255,0.34)');
      gloss.addColorStop(1, 'rgba(255,255,255,0.08)');
      ctx.fillStyle = gloss;
      ctx.beginPath();
      ctx.ellipse(cx - size * 0.06, cy, size * 0.32, size * 0.18, -0.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = size * 0.018;
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.34, 0, Math.PI * 2);
      ctx.stroke();

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      texture.needsUpdate = true;
      return texture;
    };

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);
    sceneRef.current = scene;

    const TABLE_SCALE = 1;
    const BASE_TABLE_LENGTH = POOL_ENVIRONMENT.tableLength * TABLE_SCALE;
    const TOP_EXTENSION_FACTOR = 0;
    const TABLE = {
      w: POOL_ENVIRONMENT.tableWidth * TABLE_SCALE,
      h:
        BASE_TABLE_LENGTH / 2 + (BASE_TABLE_LENGTH / 2) * (1 + TOP_EXTENSION_FACTOR),
      thickness: POOL_ENVIRONMENT.tableThickness,
      topExtension: (BASE_TABLE_LENGTH / 2) * TOP_EXTENSION_FACTOR
    };
    const TABLE_WALL = TABLE.thickness * (2.6 / 1.8);
    const SIDE_RAIL_INNER_REDUCTION = 0.72;
    const SIDE_RAIL_INNER_SCALE = 1 - SIDE_RAIL_INNER_REDUCTION;
    const SIDE_RAIL_INNER_THICKNESS = TABLE_WALL * SIDE_RAIL_INNER_SCALE;
    const TARGET_RATIO = 1.83;
    const END_RAIL_INNER_SCALE =
      (TABLE.h - TARGET_RATIO * (TABLE.w - 2 * SIDE_RAIL_INNER_THICKNESS)) /
      (2 * TABLE_WALL);
    const END_RAIL_INNER_THICKNESS = TABLE_WALL * END_RAIL_INNER_SCALE;
    const FIELD_INSET = Math.min(SIDE_RAIL_INNER_THICKNESS, END_RAIL_INNER_THICKNESS);
    const PLAYFIELD = {
      w: TABLE.w - SIDE_RAIL_INNER_THICKNESS * 2,
      h: TABLE.h - END_RAIL_INNER_THICKNESS * 2,
      goalW: (TABLE.w - SIDE_RAIL_INNER_THICKNESS * 2) * 0.45454545454545453,
      inset: FIELD_INSET
    };
    const SCALE_WIDTH = PLAYFIELD.w / 2.2;
    const SCALE_LENGTH = PLAYFIELD.h / (4.8 * 1.2);
    const SPEED_SCALE = (SCALE_WIDTH + SCALE_LENGTH) / 2;
    const MALLET_RADIUS = PLAYFIELD.w * 0.072;
    const MALLET_HEIGHT = MALLET_RADIUS * (0.05 / 0.12);
    const MALLET_KNOB_RADIUS = MALLET_RADIUS * (0.065 / 0.12);
    const MALLET_KNOB_HEIGHT = MALLET_RADIUS * (0.1 / 0.12);
    malletDimensionsRef.current = {
      radius: MALLET_RADIUS,
      knobRadius: MALLET_KNOB_RADIUS,
      height: MALLET_HEIGHT,
      knobHeight: MALLET_KNOB_HEIGHT
    };
    const PUCK_RADIUS = PLAYFIELD.w * 0.0295;
    const PUCK_HEIGHT = PUCK_RADIUS * 1.05;

    const camera = new THREE.PerspectiveCamera(
      56,
      host.clientWidth / host.clientHeight,
      0.1,
      1200
    );
    cameraRef.current = camera;

    const world = new THREE.Group();
    scene.add(world);

    const elevatedTableSurfaceY = POOL_ENVIRONMENT.tableSurfaceY;

    const tableGroup = new THREE.Group();
    tableGroup.position.y = elevatedTableSurfaceY;
    tableGroup.position.z = -TABLE.topExtension / 2;
    const tableCenterZ = tableGroup.position.z;
    world.add(tableGroup);
    tableGroupRef.current = tableGroup;

    const clothThickness = TABLE.thickness * 0.18;
    const tableSurface = new THREE.Mesh(
      new THREE.BoxGeometry(PLAYFIELD.w, clothThickness, PLAYFIELD.h),
      new THREE.MeshStandardMaterial({
        color: 0x3b83c3,
        roughness: 0.92,
        metalness: 0.05
      })
    );
    tableSurface.position.y = -clothThickness / 2;
    tableSurface.castShadow = true;
    tableSurface.receiveShadow = true;
    tableGroup.add(tableSurface);
    materialsRef.current.tableSurface = tableSurface.material;

    const floorLocalY = POOL_ENVIRONMENT.floorY - elevatedTableSurfaceY;
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0x5d3725,
      roughness: 0.55,
      metalness: 0.18
    });
    const trimMaterial = new THREE.MeshStandardMaterial({
      color: 0x2c1a11,
      roughness: 0.7,
      metalness: 0.12
    });
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a2918,
      roughness: 0.5,
      metalness: 0.16
    });
    const baseAccentMaterial = new THREE.MeshStandardMaterial({
      color: 0x2c1a11,
      roughness: 0.62,
      metalness: 0.12
    });
    materialsRef.current.frame = frameMaterial;
    materialsRef.current.trim = trimMaterial;
    materialsRef.current.base = baseMaterial;
    materialsRef.current.baseAccent = baseAccentMaterial;

    const frameOuterW = TABLE.w + TABLE_WALL * 2;
    const frameOuterH = TABLE.h + TABLE_WALL * 2;
    const frameHeight = TABLE.thickness * 1.15;
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(frameOuterW, frameHeight, frameOuterH),
      frameMaterial
    );
    frame.position.y = -frameHeight / 2 - TABLE.thickness * 0.05;
    frame.castShadow = true;
    frame.receiveShadow = true;
    tableGroup.add(frame);

    const trimHeight = TABLE.thickness * 0.32;
    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(frameOuterW * 0.98, trimHeight, frameOuterH * 0.98),
      trimMaterial
    );
    trim.position.y = -trimHeight / 2 - TABLE.thickness * 0.01;
    trim.castShadow = true;
    trim.receiveShadow = true;
    tableGroup.add(trim);

    const railThickness = TABLE_WALL * 0.6;
    const railHeight = TABLE.thickness * 0.32;
    const railMaterial = new THREE.MeshStandardMaterial({
      color: 0x8f6243,
      roughness: 0.62,
      metalness: 0.08,
      transparent: true
    });
    materialsRef.current.rail = railMaterial;
    const railInset = FIELD_INSET * 0.32;
    const railOuterW = PLAYFIELD.w + railInset * 2;
    const railOuterH = PLAYFIELD.h + railInset * 2;
    const railY = railHeight / 2 + 0.002;
    const railGroup = new THREE.Group();
    tableGroup.add(railGroup);
    const sideRailGeo = new THREE.BoxGeometry(railOuterW, railHeight, railThickness);
    const endRailGeo = new THREE.BoxGeometry(railThickness, railHeight, railOuterH);
    const northRail = new THREE.Mesh(sideRailGeo, railMaterial);
    northRail.position.set(0, railY, -railOuterH / 2);
    railGroup.add(northRail);
    const southRail = northRail.clone();
    southRail.position.z = railOuterH / 2;
    railGroup.add(southRail);
    const eastRail = new THREE.Mesh(endRailGeo, railMaterial);
    eastRail.position.set(railOuterW / 2, railY, 0);
    railGroup.add(eastRail);
    const westRail = eastRail.clone();
    westRail.position.x = -railOuterW / 2;
    railGroup.add(westRail);

    const pocketMaterial = new THREE.MeshStandardMaterial({
      color: 0x101112,
      roughness: 0.9,
      metalness: 0.05
    });
    const chromeMaterial = new THREE.MeshStandardMaterial({
      color: 0xd2d8e5,
      roughness: 0.3,
      metalness: 0.85,
      envMapIntensity: 0.8
    });
    const pocketRingMaterial = new THREE.MeshStandardMaterial({
      color: 0x99ffd6,
      emissive: 0x003322,
      emissiveIntensity: 0.6,
      roughness: 0.25,
      metalness: 0.5
    });
    materialsRef.current.goal = pocketRingMaterial;
    const pocketGroup = new THREE.Group();
    tableGroup.add(pocketGroup);
    const pocketRadius = PLAYFIELD.w * 0.085;
    const pocketDepth = TABLE.thickness * 0.9;
    const pocketY = -clothThickness * 0.35 - pocketDepth / 2;
    const ringRadius = pocketRadius * 1.18;
    const ringTube = pocketRadius * 0.12;
    const pocketInset = railInset * 0.8;
    const pocketPositions = [
      [-PLAYFIELD.w / 2 - pocketInset, -PLAYFIELD.h / 2 - pocketInset],
      [PLAYFIELD.w / 2 + pocketInset, -PLAYFIELD.h / 2 - pocketInset],
      [-PLAYFIELD.w / 2 - pocketInset, PLAYFIELD.h / 2 + pocketInset],
      [PLAYFIELD.w / 2 + pocketInset, PLAYFIELD.h / 2 + pocketInset],
      [0, -PLAYFIELD.h / 2 - pocketInset],
      [0, PLAYFIELD.h / 2 + pocketInset]
    ];
    pocketPositions.forEach(([px, pz]) => {
      const pocket = new THREE.Mesh(
        new THREE.CylinderGeometry(pocketRadius, pocketRadius * 0.96, pocketDepth, 32),
        pocketMaterial
      );
      pocket.position.set(px, pocketY, pz);
      pocketGroup.add(pocket);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(ringRadius, ringTube, 18, 64),
        pocketRingMaterial
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(px, 0.002, pz);
      pocketGroup.add(ring);
    });

    const chromePlateThickness = railHeight * 0.18;
    const chromePlate = (width, depth) =>
      new THREE.Mesh(new THREE.BoxGeometry(width, chromePlateThickness, depth), chromeMaterial);
    const plateOffsetY = railHeight * 0.35;
    const chromePlates = [
      { w: railThickness * 1.7, d: railThickness * 1.1, x: 0, z: -railOuterH / 2 },
      { w: railThickness * 1.7, d: railThickness * 1.1, x: 0, z: railOuterH / 2 },
      { w: railThickness * 1.1, d: railThickness * 1.7, x: -railOuterW / 2, z: 0 },
      { w: railThickness * 1.1, d: railThickness * 1.7, x: railOuterW / 2, z: 0 },
      { w: railThickness * 1.25, d: railThickness * 1.1, x: -railOuterW / 2, z: -railOuterH / 2 },
      { w: railThickness * 1.25, d: railThickness * 1.1, x: railOuterW / 2, z: -railOuterH / 2 },
      { w: railThickness * 1.25, d: railThickness * 1.1, x: -railOuterW / 2, z: railOuterH / 2 },
      { w: railThickness * 1.25, d: railThickness * 1.1, x: railOuterW / 2, z: railOuterH / 2 }
    ];
    chromePlates.forEach((plateInfo) => {
      const plate = chromePlate(plateInfo.w, plateInfo.d);
      plate.position.set(plateInfo.x, plateOffsetY, plateInfo.z);
      plate.castShadow = true;
      plate.receiveShadow = true;
      railGroup.add(plate);
    });
    const baseGroup = new THREE.Group();
    tableGroup.add(baseGroup);

    const clearBaseGroup = () => {
      baseGroup.children.forEach((child) => {
        child.traverse?.((node) => {
          if (node?.isMesh) {
            if (node.userData?.__polyhavenBase) return;
            node.geometry?.dispose?.();
            if (Array.isArray(node.material)) {
              node.material.forEach((mat) => mat?.dispose?.());
            } else {
              node.material?.dispose?.();
            }
          }
        });
      });
      baseGroup.clear();
    };

    const tagBaseMesh = (mesh) => {
      if (!mesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    };

    const buildClassicCylinders = () => {
      const legRadius = Math.min(TABLE.w, TABLE.h) * 0.055;
      const legHeight = Math.max(0.1, -floorLocalY + TABLE.thickness * 0.25);
      const legGeometry = new THREE.CylinderGeometry(
        legRadius * 0.92,
        legRadius,
        legHeight,
        32
      );
      const legCenterY = floorLocalY + legHeight / 2;
      const legInset = Math.max(TABLE_WALL * 1.2, legRadius * 1.6);
      const halfW = frameOuterW / 2;
      const halfH = frameOuterH / 2;
      const legPositions = [
        [-halfW + legInset, -halfH + legInset],
        [halfW - legInset, -halfH + legInset],
        [-halfW + legInset, 0],
        [halfW - legInset, 0],
        [-halfW + legInset, halfH - legInset],
        [halfW - legInset, halfH - legInset]
      ];
      const footHeight = legRadius * 0.4;
      const footGeometry = new THREE.CylinderGeometry(
        legRadius * 1.08,
        legRadius * 1.2,
        footHeight,
        32
      );
      const footY = floorLocalY + footHeight / 2;
      legPositions.forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(legGeometry, baseMaterial);
        leg.position.set(lx, legCenterY, lz);
        tagBaseMesh(leg);
        baseGroup.add(leg);

        const foot = new THREE.Mesh(footGeometry, baseAccentMaterial);
        foot.position.set(lx, footY, lz);
        tagBaseMesh(foot);
        baseGroup.add(foot);
      });
    };

    const buildOpenPortal = () => {
      const legRadius = Math.min(TABLE.w, TABLE.h) * 0.055;
      const legHeight = Math.max(0.1, -floorLocalY + TABLE.thickness * 0.2);
      const legWidth = legRadius * 1.4;
      const portalDepth = frameOuterH * 0.22;
      const portalHeight = legHeight * 0.92;
      const legGeometry = new THREE.BoxGeometry(legWidth, portalHeight, portalDepth);
      const legCenterY = floorLocalY + portalHeight / 2;
      const halfW = frameOuterW / 2;
      const halfH = frameOuterH / 2;
      const offsetX = Math.max(legWidth * 0.6, halfW - legWidth * 0.8);
      const portalZ = Math.max(0, halfH - portalDepth * 0.7);
      [-1, 1].forEach((sign) => {
        const portal = new THREE.Group();
        [-1, 1].forEach((side) => {
          const leg = new THREE.Mesh(legGeometry, baseMaterial);
          leg.position.set(side * offsetX, legCenterY, 0);
          tagBaseMesh(leg);
          portal.add(leg);
        });
        portal.position.z = sign * portalZ;
        baseGroup.add(portal);
      });
    };

    const buildPolyhavenBase = (assetId, { widthScale = 0.98, depthScale = 0.96 } = {}) => {
      const base = clonePolyhavenBaseTemplate(assetId);
      if (!base) return false;
      base.traverse((child) => {
        if (child?.isMesh) {
          child.userData = { ...(child.userData || {}), __polyhavenBase: true };
          tagBaseMesh(child);
        }
      });
      const bounds = new THREE.Box3().setFromObject(base);
      const size = bounds.getSize(new THREE.Vector3());
      const targetWidth = frameOuterW * widthScale;
      const targetDepth = frameOuterH * depthScale;
      const scale = Math.min(
        size.x > 0 ? targetWidth / size.x : 1,
        size.z > 0 ? targetDepth / size.z : 1
      );
      if (Number.isFinite(scale) && scale > 0) {
        base.scale.setScalar(scale);
      }
      base.updateMatrixWorld(true);
      const scaledBounds = new THREE.Box3().setFromObject(base);
      const offsetY = floorLocalY - scaledBounds.min.y;
      base.position.y += offsetY;
      baseGroup.add(base);
      return true;
    };

    const rebuildTableBase = (variantId) => {
      clearBaseGroup();
      if (variantId === 'openPortal') {
        buildOpenPortal();
        return;
      }
      if (variantId === 'coffeeTableRound01') {
        if (!buildPolyhavenBase('coffee_table_round_01', { widthScale: 0.96, depthScale: 1.02 })) {
          ensurePolyhavenBaseTemplate('coffee_table_round_01').then(() => {
            if (selectionsRef.current.tableBase === 'coffeeTableRound01') {
              rebuildTableBase('coffeeTableRound01');
            }
          });
        }
        return;
      }
      if (variantId === 'gothicCoffeeTable') {
        if (!buildPolyhavenBase('gothic_coffee_table', { widthScale: 1.02, depthScale: 1.02 })) {
          ensurePolyhavenBaseTemplate('gothic_coffee_table').then(() => {
            if (selectionsRef.current.tableBase === 'gothicCoffeeTable') {
              rebuildTableBase('gothicCoffeeTable');
            }
          });
        }
        return;
      }
      if (variantId === 'woodenTable02Alt') {
        if (!buildPolyhavenBase('wooden_table_02', { widthScale: 0.95, depthScale: 0.98 })) {
          ensurePolyhavenBaseTemplate('wooden_table_02').then(() => {
            if (selectionsRef.current.tableBase === 'woodenTable02Alt') {
              rebuildTableBase('woodenTable02Alt');
            }
          });
        }
        return;
      }
      buildClassicCylinders();
    };

    tableBaseRef.current = {
      rebuild: rebuildTableBase,
      clear: clearBaseGroup
    };
    rebuildTableBase(selectionsRef.current.tableBase);

    const lineMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.6
    });
    materialsRef.current.line = lineMat;

    const createGoalLabel = (text, accent) => {
      const width = 1024;
      const height = 300;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, 'rgba(0,0,0,0.82)');
      gradient.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = gradient;
      const radius = 36;
      ctx.beginPath();
      ctx.moveTo(radius, 0);
      ctx.lineTo(width - radius, 0);
      ctx.quadraticCurveTo(width, 0, width, radius);
      ctx.lineTo(width, height - radius);
      ctx.quadraticCurveTo(width, height, width - radius, height);
      ctx.lineTo(radius, height);
      ctx.quadraticCurveTo(0, height, 0, height - radius);
      ctx.lineTo(0, radius);
      ctx.quadraticCurveTo(0, 0, radius, 0);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = `${accent}80`;
      ctx.lineWidth = 14;
      ctx.stroke();

      ctx.font = '700 150px "Inter", "Helvetica", sans-serif';
      ctx.fillStyle = accent;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = 24;
      ctx.fillText(text, width / 2, height / 2 + 8);

      const map = new THREE.CanvasTexture(canvas);
      map.colorSpace = THREE.SRGBColorSpace;
      map.needsUpdate = true;
      const material = new THREE.SpriteMaterial({
        map,
        transparent: true,
        depthTest: false,
        depthWrite: false
      });
      const sprite = new THREE.Sprite(material);
      const labelWidth = PLAYFIELD.goalW * 0.72;
      const labelHeight = labelWidth * (height / width) * 0.6;
      sprite.scale.set(labelWidth, labelHeight, 1);
      sprite.renderOrder = 15;
      return sprite;
    };

    const goalLabels = [];

    const northLabel = createGoalLabel(ai?.name || 'Opponent', '#22d3ee');
    northLabel.position.set(0, northGoal.position.y + SCALE_WIDTH * 0.12, northGoal.position.z);
    tableGroup.add(northLabel);
    goalLabels.push(northLabel);

    const southLabel = createGoalLabel(player?.name || 'You', '#ff5577');
    southLabel.position.set(0, southGoal.position.y + SCALE_WIDTH * 0.12, southGoal.position.z);
    tableGroup.add(southLabel);
    goalLabels.push(southLabel);

    const makeMallet = (color) => {
      const mallet = new THREE.Group();
      const baseTexture = createMalletTexture(new THREE.Color(color).getStyle());
      const baseMaterial = new THREE.MeshStandardMaterial({
        color,
        map: baseTexture,
        roughness: 0.32,
        metalness: 0.28
      });
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(MALLET_RADIUS, MALLET_RADIUS, MALLET_HEIGHT, 32),
        baseMaterial
      );
      base.position.y = MALLET_HEIGHT / 2;
      const knobMaterial = new THREE.MeshStandardMaterial({
        color: 0x222222,
        roughness: 0.26,
        metalness: 0.22
      });
      const knob = new THREE.Mesh(
        new THREE.CylinderGeometry(
          MALLET_KNOB_RADIUS,
          MALLET_KNOB_RADIUS,
          MALLET_KNOB_HEIGHT,
          32
        ),
        knobMaterial
      );
      knob.position.y = MALLET_HEIGHT + MALLET_KNOB_HEIGHT / 2;
      mallet.add(base, knob);
      return { mallet, baseMaterial, knobMaterial };
    };

    const youData = makeMallet(0xff5577);
    const you = youData.mallet;
    you.position.set(0, 0, PLAYFIELD.h * 0.42);
    tableGroup.add(you);
    materialsRef.current.playerMallet = youData.baseMaterial;
    materialsRef.current.playerKnob = youData.knobMaterial;
    malletRefs.current.player = you;

    const aiData = makeMallet(0x66ddff);
    const aiMallet = aiData.mallet;
    aiMallet.position.set(0, 0, -PLAYFIELD.h * 0.36);
    tableGroup.add(aiMallet);
    materialsRef.current.aiMallet = aiData.baseMaterial;
    materialsRef.current.aiKnob = aiData.knobMaterial;
    malletRefs.current.ai = aiMallet;

    const puckTexture = createPuckTexture();
    const puck = new THREE.Mesh(
      new THREE.CylinderGeometry(PUCK_RADIUS, PUCK_RADIUS, PUCK_HEIGHT, 32),
      new THREE.MeshStandardMaterial({
        color: 0x111111,
        map: puckTexture,
        roughness: 0.34,
        metalness: 0.22,
        clearcoat: 0.35,
        clearcoatRoughness: 0.28
      })
    );
    puck.position.y = PUCK_HEIGHT / 2;
    tableGroup.add(puck);
    materialsRef.current.puck = puck.material;

    const playerRailZ = PLAYFIELD.h / 2 + railThickness / 2;
    const cameraFocus = new THREE.Vector3(
      0,
      elevatedTableSurfaceY + TABLE.thickness * 0.06,
      tableCenterZ
    );
    const standingCameraAnchor = new THREE.Vector3(
      0,
      elevatedTableSurfaceY + TABLE.h * 0.31,
      tableCenterZ + playerRailZ + TABLE.w * 0.12
    );
    const cueCameraAnchor = new THREE.Vector3(
      0,
      elevatedTableSurfaceY + TABLE.thickness * 0.7,
      tableCenterZ + playerRailZ + TABLE.w * 0.06
    );
    const resolveCameraAnchor = (blend = cameraLiftRef.current) =>
      new THREE.Vector3().lerpVectors(cueCameraAnchor, standingCameraAnchor, blend);
    const getCameraDirection = (anchor) =>
      new THREE.Vector3().subVectors(anchor, cameraFocus).normalize();
    const TOP_VIEW_MARGIN = 1.12;
    const defaultCameraUp = new THREE.Vector3(0, 1, 0);
    const topViewUp = new THREE.Vector3(0, 0, -1);
    const topViewTarget = cameraFocus.clone();

    const updateTopViewCamera = () => {
      camera.aspect = host.clientWidth / host.clientHeight;
      const verticalFov = THREE.MathUtils.degToRad(camera.fov);
      const verticalTan = Math.tan(Math.max(verticalFov / 2, 1e-3));
      const horizontalTan = Math.max(verticalTan * camera.aspect, 1e-3);
      const halfWidth = (TABLE.w * TOP_VIEW_MARGIN) / 2;
      const halfLength = (TABLE.h * TOP_VIEW_MARGIN) / 2;
      const distance = Math.max(halfLength / verticalTan, halfWidth / horizontalTan);
      camera.up.copy(topViewUp);
      camera.position.set(0, topViewTarget.y + distance, tableCenterZ);
      camera.lookAt(topViewTarget);
      camera.updateProjectionMatrix();
      updateRendererSettings();
    };

    const tableCorners = [
      new THREE.Vector3(-TABLE.w / 2, elevatedTableSurfaceY, -TABLE.h / 2 + tableCenterZ),
      new THREE.Vector3(TABLE.w / 2, elevatedTableSurfaceY, -TABLE.h / 2 + tableCenterZ),
      new THREE.Vector3(-TABLE.w / 2, elevatedTableSurfaceY, TABLE.h / 2 + tableCenterZ),
      new THREE.Vector3(TABLE.w / 2, elevatedTableSurfaceY, TABLE.h / 2 + tableCenterZ)
    ];

    const fitCameraToTable = (cameraBlend = cameraLiftRef.current) => {
      if (isTopDownViewRef.current) {
        updateTopViewCamera();
        return;
      }
      const anchor = resolveCameraAnchor(cameraBlend);
      const direction = getCameraDirection(anchor);
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.up.copy(defaultCameraUp);
      camera.position.copy(anchor);
      camera.lookAt(cameraFocus);
      camera.updateProjectionMatrix();
      updateRendererSettings();
      for (let i = 0; i < 20; i++) {
        const needsRetreat = tableCorners.some((corner) => {
          const sample = corner.clone();
          const ndc = sample.project(camera);
          return Math.abs(ndc.x) > 0.95 || ndc.y < -1.05 || ndc.y > 1.05;
        });
        if (!needsRetreat) break;
        camera.position.addScaledVector(direction, 2.4);
        camera.lookAt(cameraFocus);
        camera.updateProjectionMatrix();
      }
    };

    cameraViewRef.current = {
      applyCurrent: (useTopView, cameraBlend = cameraLiftRef.current) => {
        if (useTopView) {
          updateTopViewCamera();
        } else {
          fitCameraToTable(cameraBlend);
        }
      }
    };

    const S = {
      vel: new THREE.Vector3(0, 0, 0),
      friction: 0.996
    };

    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const plane = new THREE.Plane(
      new THREE.Vector3(0, 1, 0),
      -elevatedTableSurfaceY
    );
    const hit = new THREE.Vector3();

    const isLowerHalfTouch = (clientY) => {
      const r = renderer.domElement.getBoundingClientRect();
      return clientY >= r.top + r.height * 0.5;
    };

    const beginCameraDrag = (clientY, identifier = null) => {
      if (isTopDownViewRef.current) return;
      if (isLowerHalfTouch(clientY)) return;
      cameraDragRef.current = {
        active: true,
        pointerId: identifier,
        startY: clientY,
        startLift: cameraLiftRef.current
      };
    };

    const updateCameraDrag = (clientY) => {
      if (!cameraDragRef.current.active) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const delta = (cameraDragRef.current.startY - clientY) / (rect.height || 1);
      updateCameraLift(cameraDragRef.current.startLift + delta * 1.6);
    };

    const endCameraDrag = () => {
      cameraDragRef.current = {
        active: false,
        pointerId: null,
        startY: 0,
        startLift: cameraLiftRef.current
      };
    };

    const touchToXZ = (clientX, clientY) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.x = ((clientX - r.left) / r.width) * 2 - 1;
      ndc.y = -((clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(ndc, camera);
      if (!ray.ray.intersectPlane(plane, hit)) {
        return { x: you.position.x, z: you.position.z };
      }
      return {
        x: clamp(hit.x, -PLAYFIELD.w / 2 + MALLET_RADIUS, PLAYFIELD.w / 2 - MALLET_RADIUS),
        z: clamp(hit.z, 0, PLAYFIELD.h / 2 - MALLET_RADIUS)
      };
    };

    const onMove = (e) => {
      primeAudio();
      const t = e.touches ? e.touches[0] : e;
      if (!isLowerHalfTouch(t.clientY)) return;
      const { x, z } = touchToXZ(t.clientX, t.clientY);
      you.position.set(x, 0, z);
    };

    const findTouchById = (touches, identifier) => {
      if (identifier == null) return touches?.[0] ?? null;
      return Array.from(touches).find((touch) => touch.identifier === identifier) || null;
    };

    const onCameraTouchStart = (event) => {
      const touch = event.touches?.[0];
      if (!touch) return;
      beginCameraDrag(touch.clientY, touch.identifier);
    };

    const onCameraTouchMove = (event) => {
      const touch = findTouchById(event.touches, cameraDragRef.current.pointerId);
      if (!touch) return;
      updateCameraDrag(touch.clientY);
    };

    const onCameraTouchEnd = (event) => {
      if (!cameraDragRef.current.active) return;
      const touch = findTouchById(event.touches, cameraDragRef.current.pointerId);
      if (!touch) {
        endCameraDrag();
      }
    };

    renderer.domElement.addEventListener('touchstart', onMove, {
      passive: true
    });
    renderer.domElement.addEventListener('touchmove', onMove, {
      passive: true
    });
    renderer.domElement.addEventListener('touchstart', onCameraTouchStart, {
      passive: true
    });
    renderer.domElement.addEventListener('touchmove', onCameraTouchMove, {
      passive: true
    });
    renderer.domElement.addEventListener('touchend', onCameraTouchEnd);
    renderer.domElement.addEventListener('touchcancel', onCameraTouchEnd);
    renderer.domElement.addEventListener('mousemove', onMove);

    const SPEED_BOOST = 1.25;
    const HIT_FORCE = 0.5 * SPEED_SCALE * SPEED_BOOST;
    const MAX_SPEED = 0.095 * SPEED_SCALE * SPEED_BOOST;
    const SERVE_SPEED = 0.055 * SPEED_SCALE * SPEED_BOOST;
    const GOAL_RESET_DELAY = 1500;

    const servePuck = (towardTop = false) => {
      S.vel.set(0, 0, towardTop ? -SERVE_SPEED : SERVE_SPEED);
      playWhistle();
    };

    const handleCollision = (mallet, isPlayer = false) => {
      const dx = puck.position.x - mallet.position.x;
      const dz = puck.position.z - mallet.position.z;
      const d2 = dx * dx + dz * dz;
      const collideRadius = MALLET_RADIUS + PUCK_RADIUS * 0.8;
      if (d2 < collideRadius * collideRadius) {
        const distance = Math.max(Math.sqrt(d2), 1e-6);
        const overlap = collideRadius - distance;
        const normal = new THREE.Vector3(dx / distance, 0, dz / distance);

        puck.position.x += normal.x * overlap;
        puck.position.z += normal.z * overlap;

        const directionalForce = HIT_FORCE * (isPlayer ? 1.2 : 1);
        S.vel.addScaledVector(normal, directionalForce);

        if (isPlayer) {
          const guardOffset = MALLET_RADIUS + PUCK_RADIUS * 0.2;
          puck.position.z = Math.min(puck.position.z, mallet.position.z - guardOffset);
          if (S.vel.z > 0) {
            S.vel.z = -Math.abs(S.vel.z);
          }
        }

        const alongNormal = S.vel.dot(normal);
        if (alongNormal < SERVE_SPEED * 0.4) {
          S.vel.addScaledVector(normal, SERVE_SPEED * 0.4 - alongNormal);
        }

        playHit();
      }
    };

    const aiUpdate = (dt) => {
      const guardLine = -MALLET_RADIUS;
      const defensiveZ = -PLAYFIELD.h * 0.36;
      const targetZ =
        puck.position.z < guardLine
          ? clamp(
              puck.position.z + MALLET_RADIUS * 0.8,
              -PLAYFIELD.h / 2 + MALLET_RADIUS,
              guardLine - MALLET_RADIUS
            )
          : defensiveZ;
      const targetX = clamp(
        puck.position.x,
        -PLAYFIELD.w / 2 + MALLET_RADIUS,
        PLAYFIELD.w / 2 - MALLET_RADIUS
      );
      const chaseSpeed = 3.4;
      aiMallet.position.x += (targetX - aiMallet.position.x) * chaseSpeed * dt;
      aiMallet.position.z += (targetZ - aiMallet.position.z) * chaseSpeed * dt;
    };

    const reset = (towardTop = false, shouldServe = true) => {
      puck.position.set(0, PUCK_HEIGHT / 2, 0);
      S.vel.set(0, 0, 0);
      you.position.set(0, 0, PLAYFIELD.h * 0.42);
      aiMallet.position.set(0, 0, -PLAYFIELD.h * 0.36);
      if (shouldServe) {
        servePuck(towardTop);
      }
    };

    // loop
    reset();
    fitCameraToTable();

    const tick = (timestamp = performance.now()) => {
      if (lastFrameTimeRef.current === 0) {
        lastFrameTimeRef.current = timestamp;
        frameAccumulatorRef.current = 0;
      }

      const elapsedMs = Math.min(1000, timestamp - lastFrameTimeRef.current);
      frameAccumulatorRef.current += elapsedMs;
      const targetInterval = renderSettingsRef.current.targetFrameIntervalMs || 16.67;
      if (frameAccumulatorRef.current < targetInterval * 0.92) {
        raf.current = requestAnimationFrame(tick);
        return;
      }

      const dt = Math.min(0.033, frameAccumulatorRef.current / 1000);
      frameAccumulatorRef.current = Math.max(0, frameAccumulatorRef.current - targetInterval);
      lastFrameTimeRef.current = timestamp;

      puck.position.x += S.vel.x;
      puck.position.z += S.vel.z;
      S.vel.multiplyScalar(Math.pow(S.friction, dt * 60));
      // keep puck speed manageable
      S.vel.clampLength(0, MAX_SPEED);

      if (Math.abs(puck.position.x) > PLAYFIELD.w / 2 - PUCK_RADIUS) {
        puck.position.x = clamp(
          puck.position.x,
          -PLAYFIELD.w / 2 + PUCK_RADIUS,
          PLAYFIELD.w / 2 - PUCK_RADIUS
        );
        S.vel.x = -S.vel.x;
        playHit();
      }

      const goalHalf = PLAYFIELD.goalW / 2;
      const atTop = puck.position.z < -PLAYFIELD.h / 2 + PUCK_RADIUS;
      const atBot = puck.position.z > PLAYFIELD.h / 2 - PUCK_RADIUS;
      if (atTop || atBot) {
        if (Math.abs(puck.position.x) <= goalHalf) {
          const playerScored = atTop;
          const ended = recordGoal(playerScored);
          playGoal();
          S.vel.set(0, 0, 0);
          clearTimeout(restartTimeoutRef.current);
          if (!ended) {
            reset(!atBot, false);
            restartTimeoutRef.current = setTimeout(() => {
              servePuck(!atBot);
            }, GOAL_RESET_DELAY);
          }
        } else {
          S.vel.z = -S.vel.z;
          puck.position.z = clamp(
            puck.position.z,
            -PLAYFIELD.h / 2 + PUCK_RADIUS,
            PLAYFIELD.h / 2 - PUCK_RADIUS
          );
          playPost();
        }
      }

      aiUpdate(dt);
      handleCollision(you, true);
      handleCollision(aiMallet);
      renderer.render(scene, camera);
      if (!gameOverRef.current) {
        raf.current = requestAnimationFrame(tick);
      }
    };

    tick();

    const onResize = () => {
      fitCameraToTable(cameraLiftRef.current);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('touchstart', onMove);
      renderer.domElement.removeEventListener('touchmove', onMove);
      renderer.domElement.removeEventListener('touchstart', onCameraTouchStart);
      renderer.domElement.removeEventListener('touchmove', onCameraTouchMove);
      renderer.domElement.removeEventListener('touchend', onCameraTouchEnd);
      renderer.domElement.removeEventListener('touchcancel', onCameraTouchEnd);
      renderer.domElement.removeEventListener('mousemove', onMove);
      rendererRef.current = null;
      lastFrameTimeRef.current = 0;
      frameAccumulatorRef.current = 0;
      Object.keys(audioRef.current).forEach((key) => {
        const audio = audioRef.current[key];
        if (audio) {
          audio.pause();
          audioRef.current[key] = null;
        }
      });
      goalLabels.forEach((label) => {
        label.parent?.remove(label);
        label.material.map?.dispose();
        label.material.dispose();
      });
      try {
        host.removeChild(renderer.domElement);
      } catch {}
      if (environmentRef.current.envMap) {
        environmentRef.current.envMap.dispose?.();
        environmentRef.current.envMap = null;
      }
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    if (!renderer || !scene) return undefined;
    const hdriOption = getOption('environmentHdri', selections.environmentHdri);
    if (!hdriOption) return undefined;
    let cancelled = false;
    loadPolyHavenHdriEnvironment(renderer, hdriOption).then((result) => {
      if (cancelled || !result?.envMap) {
        result?.envMap?.dispose?.();
        return;
      }
      const prevEnv = environmentRef.current.envMap;
      if (prevEnv && prevEnv !== result.envMap) {
        prevEnv.dispose?.();
      }
      environmentRef.current.envMap = result.envMap;
      scene.environment = result.envMap;
      scene.background = result.envMap;
      const rotationY = Number.isFinite(hdriOption.rotationY) ? hdriOption.rotationY : 0;
      if ('backgroundRotation' in scene) {
        scene.backgroundRotation = new THREE.Euler(0, rotationY, 0);
      }
      if ('environmentRotation' in scene) {
        scene.environmentRotation = new THREE.Euler(0, rotationY, 0);
      }
      if ('backgroundIntensity' in scene && typeof hdriOption.backgroundIntensity === 'number') {
        scene.backgroundIntensity = hdriOption.backgroundIntensity;
      }
      if ('environmentIntensity' in scene && typeof hdriOption.environmentIntensity === 'number') {
        scene.environmentIntensity = hdriOption.environmentIntensity;
      }
      if (typeof hdriOption.exposure === 'number') {
        renderer.toneMappingExposure = hdriOption.exposure;
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selections.environmentHdri]);

  useEffect(() => {
    const playerMallet = malletRefs.current.player;
    const aiMallet = malletRefs.current.ai;
    const dims = malletDimensionsRef.current;
    if (!playerMallet || !aiMallet || !dims.knobRadius || !dims.knobHeight) {
      return undefined;
    }

    const createCircleTexture = (image, fallbackLabel = '?') => {
      const size = 512;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      const maskRadius = size / 2 - 10;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, maskRadius, 0, Math.PI * 2);
      ctx.closePath();
      const gradient = ctx.createLinearGradient(0, 0, 0, size);
      gradient.addColorStop(0, '#0b1224');
      gradient.addColorStop(1, '#111827');
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.clip();
      if (image && image.width && image.height) {
        const cropSize = Math.min(image.width, image.height);
        const sx = (image.width - cropSize) / 2;
        const sy = (image.height - cropSize) / 2;
        const inset = size * 0.12;
        ctx.drawImage(
          image,
          sx,
          sy,
          cropSize,
          cropSize,
          inset,
          inset,
          size - inset * 2,
          size - inset * 2
        );
      } else {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = '#e5e7eb';
        ctx.font = 'bold 220px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(fallbackLabel, size / 2, size / 2 + 20);
      }
      ctx.restore();
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, maskRadius - 4, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 10;
      ctx.stroke();
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      return texture;
    };

    const loadAvatarImage = (key, avatar, onReady) => {
      const url = getAvatarUrl(avatar) || '/assets/icons/profile.svg';
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => onReady(img, url);
      img.onerror = () => {
        if (url !== '/assets/icons/profile.svg') {
          loadAvatarImage(key, '/assets/icons/profile.svg', onReady);
          return;
        }
        onReady(null, url);
      };
      img.src = url;
    };

    const setAvatar = (key, avatar) => {
      const existing = avatarSpritesRef.current[key];
      if (existing) {
        existing.parent?.remove(existing);
        existing.material.map?.dispose();
        existing.material.dispose();
        existing.geometry?.dispose();
      }
      loadAvatarImage(key, avatar, (image, url) => {
        const label = typeof avatar === 'string' ? avatar.slice(0, 2) : '?';
        const texture = createCircleTexture(image, label);
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          depthWrite: false,
          depthTest: false,
          side: THREE.DoubleSide
        });
        const geometry = new THREE.CircleGeometry(dims.knobRadius, 64);
        const badge = new THREE.Mesh(geometry, material);
        badge.position.set(0, dims.height + dims.knobHeight + 0.0005, 0);
        badge.rotation.x = -Math.PI / 2;
        badge.renderOrder = 20;
        const targetMallet = key === 'player' ? playerMallet : aiMallet;
        targetMallet.add(badge);
        avatarSpritesRef.current[key] = badge;
      });
    };

    setAvatar('player', player.avatar);
    setAvatar('ai', ai.avatar);

    return () => {
      ['player', 'ai'].forEach((key) => {
        const sprite = avatarSpritesRef.current[key];
        if (sprite) {
          sprite.parent?.remove(sprite);
          sprite.material.map?.dispose();
          sprite.material.dispose();
          sprite.geometry?.dispose();
          avatarSpritesRef.current[key] = null;
        }
      });
    };
  }, [player.avatar, ai.avatar]);

  useEffect(() => {
    const mats = materialsRef.current;
    if (!mats.tableSurface) return;

    const fieldTheme = getOption('field', selections.field);
    const tableTheme = getOption('table', selections.table);
    const baseTheme = getOption('tableBase', selections.tableBase);
    const puckTheme = getOption('puck', selections.puck);
    const malletTheme = getOption('mallet', selections.mallet);
    const railTheme = getOption('rails', selections.rails);
    const goalTheme = getOption('goals', selections.goals);
    const tableGrain =
      tableTheme?.woodTextureId && WOOD_GRAIN_OPTIONS_BY_ID[tableTheme.woodTextureId]
        ? WOOD_GRAIN_OPTIONS_BY_ID[tableTheme.woodTextureId]
        : null;
    const fallbackHsl = tableTheme?.wood
      ? new THREE.Color(tableTheme.wood).getHSL({})
      : { h: 0.08, s: 0.35, l: 0.5 };
    const baseHsl = baseTheme?.base ? new THREE.Color(baseTheme.base).getHSL({}) : fallbackHsl;
    const accentHsl = baseTheme?.accent ? new THREE.Color(baseTheme.accent).getHSL({}) : baseHsl;

    const applyTableTexture = (material, surfaceKey) => {
      if (!material || !tableGrain) return;
      const surface = tableGrain[surfaceKey] || tableGrain.frame || tableGrain.rail;
      if (!surface) return;
      applyWoodTextures(material, {
        mapUrl: surface.mapUrl,
        roughnessMapUrl: surface.roughnessMapUrl,
        normalMapUrl: surface.normalMapUrl,
        repeat: surface.repeat,
        rotation: surface.rotation,
        textureSize: surface.textureSize,
        hue: fallbackHsl.h * 360,
        sat: fallbackHsl.s,
        light: fallbackHsl.l,
        contrast: 0.55
      });
    };
    const applyBaseTexture = (material, surfaceKey, tint) => {
      if (!material || !tableGrain) return;
      const surface = tableGrain[surfaceKey] || tableGrain.frame || tableGrain.rail;
      if (!surface) return;
      applyWoodTextures(material, {
        mapUrl: surface.mapUrl,
        roughnessMapUrl: surface.roughnessMapUrl,
        normalMapUrl: surface.normalMapUrl,
        repeat: surface.repeat,
        rotation: surface.rotation,
        textureSize: surface.textureSize,
        hue: tint.h * 360,
        sat: tint.s,
        light: tint.l,
        contrast: 0.55
      });
    };

    mats.tableSurface.color.set(fieldTheme.surface);
    if (mats.line) mats.line.color.set(fieldTheme.lines);
    mats.rings.forEach((material) => material.color.set(fieldTheme.rings || fieldTheme.lines));
    if (tableGrain) {
      applyTableTexture(mats.frame, 'frame');
      applyTableTexture(mats.trim, 'rail');
      applyBaseTexture(mats.base, 'frame', baseHsl);
      applyBaseTexture(mats.baseAccent, 'rail', accentHsl);
    } else {
      if (mats.frame) mats.frame.color.set(tableTheme.wood);
      if (mats.trim) mats.trim.color.set(tableTheme.trim);
    }
    if (mats.base) mats.base.color.set(baseTheme.base);
    if (mats.baseAccent) mats.baseAccent.color.set(baseTheme.accent);
    if (mats.rail) {
      mats.rail.color.set(railTheme.color);
      mats.rail.opacity = railTheme.opacity;
    }
    if (mats.puck) {
      mats.puck.color.set(puckTheme.color);
      mats.puck.emissive.set(puckTheme.emissive);
      mats.puck.needsUpdate = true;
    }
    if (mats.playerMallet) mats.playerMallet.color.set(malletTheme.color);
    if (mats.aiMallet) mats.aiMallet.color.set(malletTheme.color);
    if (mats.playerKnob) mats.playerKnob.color.set(malletTheme.knob);
    if (mats.aiKnob) mats.aiKnob.color.set(malletTheme.knob);
    if (mats.goal) {
      mats.goal.color.set(goalTheme.color);
      mats.goal.emissive.set(goalTheme.emissive);
    }
  }, [selections]);

  const renderOptionRow = (label, key) => {
    const options = (AIR_HOCKEY_CUSTOMIZATION[key] || []).filter((option) =>
      isAirHockeyOptionUnlocked(key, option.id, airInventory)
    );
    if (!options.length) return null;
    return (
      <div className="space-y-1">
        <div className="text-[11px] uppercase tracking-wide text-white/70">{label}</div>
        <div className="grid grid-cols-2 gap-2">
          {options.map((option, idx) => {
            const swatch =
              option.surface ||
              option.wood ||
              option.color ||
              option.base ||
              option.swatches?.[0];
            const active = selections[key] === option.id;
            return (
              <button
                key={`${key}-${option.name}`}
                onClick={() =>
                  setSelections((prev) => ({
                    ...prev,
                    [key]: option.id
                  }))
                }
                className={`flex items-center justify-between rounded px-2 py-1 text-left text-[11px] font-semibold transition ${
                  active ? 'bg-white/20 text-white' : 'bg-white/5 text-white/80 hover:bg-white/10'
                }`}
              >
                <span className="truncate">{option.name}</span>
                <span
                  className="ml-2 w-5 h-5 rounded-full border border-white/30"
                  style={{ background: swatch }}
                />
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div
      ref={hostRef}
      className="w-full h-[100dvh] bg-black relative overflow-hidden select-none"
    >
      <div className="absolute top-2 left-1/2 -translate-x-1/2 text-white text-[10px] bg-white/10 rounded px-3 py-1 backdrop-blur">
        <span className="uppercase tracking-wide">{playType}</span>
        <span className="mx-2">•</span>
        <span>Target: {targetValue}</span>
      </div>
      <div
        className="absolute top-1 left-2 flex items-center space-x-2 text-white text-xs bg-white/10 rounded px-2 py-1"
        data-player-index="0"
      >
        <img
          src={getAvatarUrl(player.avatar)}
          alt=""
          className="w-5 h-5 rounded-full object-cover"
        />
        <span>
          {player.name}: {ui.left}
        </span>
      </div>
      <div
        className="absolute top-1 right-2 flex items-center space-x-2 text-white text-xs bg-white/10 rounded px-2 py-1"
        data-player-index="1"
      >
        <span>
          {ui.right}: {ai.name}
        </span>
        <img
          src={getAvatarUrl(ai.avatar)}
          alt=""
          className="w-5 h-5 rounded-full object-cover"
        />
      </div>
      <div className="absolute bottom-2 left-2 z-20 flex flex-col items-start gap-3 pointer-events-auto">
        <BottomLeftIcons
          onInfo={() => setShowInfo(true)}
          onChat={() => setShowChat(true)}
          onGift={() => setShowGift(true)}
          className="flex flex-col items-center space-y-2"
        />
        <button
          type="button"
          aria-pressed={isTopDownView}
          onClick={() => setIsTopDownView((prev) => !prev)}
          className={`rounded px-3 py-2 text-xs font-semibold backdrop-blur border transition ${
            isTopDownView
              ? 'border-emerald-300 bg-emerald-300/20 text-emerald-100'
              : 'border-white/15 bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          <span className="inline-flex items-center gap-1">
            <span aria-hidden>🧭</span>
            <span>{isTopDownView ? '3D' : '2D'}</span>
          </span>
        </button>
        {!gameOver && (
          <button
            onClick={() => (window.location.href = '/games/airhockey/lobby')}
            className="text-white text-xs bg-white/10 hover:bg-white/20 rounded px-2 py-1"
          >
            Exit to Lobby
          </button>
        )}
      </div>
      <div className="absolute bottom-2 right-2 flex flex-col items-end space-y-2 z-20">
        <button
          onClick={() => setShowCustomizer((v) => !v)}
          className="rounded px-3 py-2 text-xs font-semibold text-white bg-white/10 hover:bg-white/20 backdrop-blur"
        >
          <span className="inline-flex items-center gap-1">
            <span aria-hidden>⚙️</span>
            {showCustomizer ? 'Close customizer' : 'Customize table'}
          </span>
        </button>
        {showCustomizer && (
          <div className="w-72 max-h-[70vh] overflow-y-auto bg-black/70 border border-white/15 rounded-lg p-3 space-y-3 backdrop-blur">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.35em] text-white/70">Graphics</p>
                <p className="mt-1 text-[0.7rem] text-white/60">Match the Murlan Royale quality presets.</p>
              </div>
              <div className="mt-2 grid gap-2">
                {GRAPHICS_OPTIONS.map((option) => {
                  const active = option.id === graphicsId;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setGraphicsId(option.id)}
                      aria-pressed={active}
                      className={`w-full rounded-2xl border px-3 py-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                        active
                          ? 'border-sky-300 bg-sky-300/15 shadow-[0_0_12px_rgba(125,211,252,0.35)]'
                          : 'border-white/10 bg-white/5 hover:border-white/20 text-white/80'
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.26em] text-white">
                          {option.label}
                        </span>
                        <span className="text-[11px] font-semibold tracking-wide text-sky-100">
                          {option.resolution ? `${option.resolution} • ${option.fps} FPS` : `${option.fps} FPS`}
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
            {renderOptionRow('Field', 'field')}
            {renderOptionRow('Table Finish', 'table')}
            {renderOptionRow('Table Base', 'tableBase')}
            {renderOptionRow('HDRI Environment', 'environmentHdri')}
            {renderOptionRow('Puck', 'puck')}
            {renderOptionRow('Mallets', 'mallet')}
            {renderOptionRow('Rails', 'rails')}
            {renderOptionRow('Goals', 'goals')}
          </div>
        )}
      </div>
      {goalPopup && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className={`text-center drop-shadow-[0_0_12px_rgba(0,0,0,0.9)] px-4 py-3 rounded-lg bg-black/50 border border-white/10 ${goalPopup.isPlayer ? 'text-emerald-200' : 'text-amber-200'}`}
          >
            <div className="text-4xl font-extrabold tracking-[0.2em] uppercase">Goal!</div>
            <div className="text-lg font-semibold mt-1">{goalPopup.scorer}</div>
            <div className="text-sm font-semibold mt-1">Score: {goalPopup.scoreLine}</div>
          </div>
        </div>
      )}
      {postPopup && !goalPopup && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-amber-200 text-3xl font-extrabold uppercase tracking-[0.15em] drop-shadow-[0_0_12px_rgba(0,0,0,0.9)] bg-black/50 border border-white/10 rounded-lg px-4 py-2">
            Post!
          </div>
        </div>
      )}
      {chatBubbles.map((bubble) => (
        <div key={bubble.id} className="chat-bubble">
          <span>{bubble.text}</span>
          <img src={bubble.photoUrl} alt="avatar" className="w-5 h-5 rounded-full" />
        </div>
      ))}
      <div className="pointer-events-auto">
        <InfoPopup
          open={showInfo}
          onClose={() => setShowInfo(false)}
          title="Air Hockey"
          info="Defend your goal and score on your opponent. First to the target score wins. Drag on the lower half of the table to move your mallet. Pull up or down on the top half to adjust the camera height."
        />
      </div>
      <div className="pointer-events-auto">
        <QuickMessagePopup
          open={showChat}
          onClose={() => setShowChat(false)}
          onSend={(text) => {
            const id = Date.now();
            setChatBubbles((bubbles) => [...bubbles, { id, text, photoUrl: chatAvatar }]);
            if (!muted) {
              const audio = new Audio(chatBeep);
              audio.volume = getGameVolume();
              audio.play().catch(() => {});
            }
            setTimeout(
              () => setChatBubbles((bubbles) => bubbles.filter((bubble) => bubble.id !== id)),
              3000
            );
          }}
        />
      </div>
      <div className="pointer-events-auto">
        <GiftPopup
          open={showGift}
          onClose={() => setShowGift(false)}
          players={giftPlayers}
          senderIndex={0}
          onGiftSent={({ from, to, gift }) => {
            const start = document.querySelector(`[data-player-index="${from}"]`);
            const end = document.querySelector(`[data-player-index="${to}"]`);
            if (start && end) {
              const s = start.getBoundingClientRect();
              const e = end.getBoundingClientRect();
              const cx = window.innerWidth / 2;
              const cy = window.innerHeight / 2;
              let icon;
              if (typeof gift.icon === 'string' && gift.icon.match(/\.(png|jpg|jpeg|webp|svg)$/)) {
                icon = document.createElement('img');
                icon.src = gift.icon;
                icon.className = 'w-5 h-5';
              } else {
                icon = document.createElement('div');
                icon.textContent = gift.icon;
                icon.style.fontSize = '24px';
              }
              icon.style.position = 'fixed';
              icon.style.left = '0px';
              icon.style.top = '0px';
              icon.style.pointerEvents = 'none';
              icon.style.transform = `translate(${s.left + s.width / 2}px, ${s.top + s.height / 2}px) scale(1)`;
              icon.style.zIndex = '9999';
              document.body.appendChild(icon);
              const giftSound = giftSounds[gift.id];
              if (gift.id === 'laugh_bomb' && !muted) {
                bombSoundRef.current.currentTime = 0;
                bombSoundRef.current.play().catch(() => {});
                hahaSoundRef.current.currentTime = 0;
                hahaSoundRef.current.play().catch(() => {});
                setTimeout(() => {
                  hahaSoundRef.current.pause();
                }, 5000);
              } else if (gift.id === 'coffee_boost' && !muted) {
                const audio = new Audio(giftSound);
                audio.volume = getGameVolume();
                audio.currentTime = 4;
                audio.play().catch(() => {});
                setTimeout(() => {
                  audio.pause();
                }, 4000);
              } else if (gift.id === 'baby_chick' && !muted) {
                const audio = new Audio(giftSound);
                audio.volume = getGameVolume();
                audio.play().catch(() => {});
              } else if (gift.id === 'magic_trick' && !muted) {
                const audio = new Audio(giftSound);
                audio.volume = getGameVolume();
                audio.play().catch(() => {});
                setTimeout(() => {
                  audio.pause();
                }, 4000);
              } else if (gift.id === 'fireworks' && !muted) {
                const audio = new Audio(giftSound);
                audio.volume = getGameVolume();
                audio.play().catch(() => {});
                setTimeout(() => {
                  audio.pause();
                }, 6000);
              } else if (gift.id === 'surprise_box' && !muted) {
                const audio = new Audio(giftSound);
                audio.volume = getGameVolume();
                audio.play().catch(() => {});
                setTimeout(() => {
                  audio.pause();
                }, 5000);
              } else if (gift.id === 'bullseye' && !muted) {
                const audio = new Audio(giftSound);
                audio.volume = getGameVolume();
                setTimeout(() => {
                  audio.play().catch(() => {});
                }, 2500);
              } else if (giftSound && !muted) {
                const audio = new Audio(giftSound);
                audio.volume = getGameVolume();
                audio.play().catch(() => {});
              }
              const animation = icon.animate(
                [
                  { transform: `translate(${s.left + s.width / 2}px, ${s.top + s.height / 2}px) scale(1)` },
                  { transform: `translate(${cx}px, ${cy}px) scale(3)`, offset: 0.5 },
                  { transform: `translate(${e.left + e.width / 2}px, ${e.top + e.height / 2}px) scale(1)` }
                ],
                { duration: 3500, easing: 'linear' }
              );
              animation.onfinish = () => icon.remove();
            }
          }}
        />
      </div>
      {gameOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white text-center px-4">
          <div className="rounded-lg border border-white/10 bg-white/5 px-5 py-4 space-y-2 max-w-sm w-full">
            <div className="text-lg font-semibold">Game Over</div>
            <div className="text-sm font-medium">Winner: {winner}</div>
            <div className="text-xs text-white/80">Final Score: {scoreRef.current.left} - {scoreRef.current.right}</div>
            <div className="text-[11px] text-white/70">
              {redirecting ? 'Redirecting to the Air Hockey lobby...' : 'Preparing lobby return...'}
            </div>
            <div className="pt-2">
              <button
                onClick={() => (window.location.href = '/games/airhockey/lobby')}
                className="w-full rounded bg-emerald-500/90 hover:bg-emerald-500 text-black font-semibold py-2 text-sm"
              >
                Go to Lobby
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
