import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { bombSound, chatBeep } from '../assets/coreSoundData.js';
import GiftPopup from './GiftPopup.jsx';
import QuickMessagePopup from './QuickMessagePopup.jsx';
import { giftSounds } from '../utils/giftSounds.js';
import LiveVideoChatPanel from './LiveVideoChatPanel.jsx';
import useLiveVideoChat from '../hooks/useLiveVideoChat.js';
import { getGameVolume, isGameMuted, toggleGameMuted } from '../utils/sound.js';
import { getAvatarUrl } from '../utils/avatarUtils.js';
import { buildAirHockeyCommentaryLine, AIR_HOCKEY_SPEAKERS } from '../utils/airHockeyCommentary.js';
import {
  getSpeechSupport,
  getSpeechSynthesis,
  onSpeechSupportChange,
  primeSpeechSynthesis,
  speakCommentaryLines
} from '../utils/textToSpeech.js';
import { AIR_HOCKEY_CUSTOMIZATION } from '../config/airHockeyInventoryConfig.js';
import { AIR_HOCKEY_DIMENSIONS, SOURCE_FIELD, loadAirHockeyModel, fitAirHockeyPiece, disposeAirHockeyModel } from './airHockey/model';
import { AirHockeyControls, AirHockeySettingsSheet } from './airHockey/AirHockeyControls';
import { resolveAirHockeyRails } from './airHockey/collisions';
import {
  airHockeyAccountId,
  getAirHockeyInventory,
  isAirHockeyOptionUnlocked
} from '../utils/airHockeyInventory.js';
import { refreshSocketAuthIdentity, socket } from '../utils/socket.js';

const CUSTOMIZATION_KEYS = Object.freeze([
  'field',
  'cushionCloth',
  'table',
  'tableBase',
  'environmentHdri',
  'puck',
  'mallet',
  'goals'
]);

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const resolveNumber = (...values) => values.find((value) => typeof value === 'number' && !Number.isNaN(value));

const DEFAULT_RENDER_PIXEL_RATIO_CAP = 1.25;
const RENDER_PIXEL_RATIO_SCALE = 1.0;
const MIN_RENDER_PIXEL_RATIO = 0.85;
const GRAPHICS_STORAGE_KEY = 'airHockeyGraphics';
const COMMENTARY_PRESET_STORAGE_KEY = 'airHockeyCommentaryPreset';
const COMMENTARY_MUTE_STORAGE_KEY = 'airHockeyCommentaryMute';
const COMMENTARY_QUEUE_LIMIT = 4;
const COMMENTARY_MIN_INTERVAL_MS = 1200;
const GRAPHICS_OPTIONS = Object.freeze([
  {
    id: 'hd50',
    label: 'HD Performance (50 Hz)',
    fps: 50,
    renderScale: 1,
    pixelRatioCap: 1.4,
    pixelRatioScale: 1,
    resolution: 'HD render • DPR 1.4 cap',
    description: 'Lower power use for everyday play.'
  },
  {
    id: 'fhd60',
    label: 'Full HD (60 Hz)',
    fps: 60,
    renderScale: 1.1,
    pixelRatioCap: 1.5,
    pixelRatioScale: 1,
    resolution: 'Full HD render • DPR 1.5 cap',
    description: 'Balanced detail and smooth motion.'
  },
  {
    id: 'qhd90',
    label: 'Quad HD (90 Hz)',
    fps: 90,
    renderScale: 1.25,
    pixelRatioCap: 1.7,
    pixelRatioScale: 1,
    resolution: 'QHD render • DPR 1.7 cap',
    description: 'Sharper detail on compatible 90 Hz displays.'
  },
  {
    id: 'uhd120',
    label: 'Ultra HD (120 Hz)',
    fps: 120,
    renderScale: 1.35,
    pixelRatioCap: 2,
    pixelRatioScale: 1,
    resolution: 'Ultra HD render • DPR 2.0 cap',
    description: 'Extra clarity on compatible 120 Hz displays.'
  },
  {
    id: 'ultra144',
    label: 'Ultra HD+ (144 Hz)',
    fps: 144,
    renderScale: 1.5,
    pixelRatioCap: 2.2,
    pixelRatioScale: 1,
    resolution: 'Ultra HD+ render • DPR 2.2 cap',
    description: 'Highest detail for capable 144 Hz displays.'
  }
]);
const DEFAULT_GRAPHICS_ID = 'fhd60';
const DEFAULT_CAMERA_LIFT = 1;
const AIR_HOCKEY_COMMENTARY_PRESETS = Object.freeze([
  {
    id: 'english',
    label: 'English',
    description: 'Mixed voices, classic English',
    language: 'en',
    voiceHints: {
      [AIR_HOCKEY_SPEAKERS.lead]: ['en-US', 'English', 'male', 'David', 'Guy', 'Daniel', 'Alex'],
      [AIR_HOCKEY_SPEAKERS.analyst]: ['en-GB', 'English', 'female', 'Sonia', 'Hazel', 'Kate', 'Emma']
    },
    speakerSettings: {
      [AIR_HOCKEY_SPEAKERS.lead]: { rate: 1, pitch: 0.96, volume: 1 },
      [AIR_HOCKEY_SPEAKERS.analyst]: { rate: 1.04, pitch: 1.06, volume: 1 }
    }
  },
  {
    id: 'saffron-table',
    label: 'Indian Table',
    description: 'Hindi commentary with lively pacing',
    language: 'hi',
    voiceHints: {
      [AIR_HOCKEY_SPEAKERS.lead]: ['hi-IN', 'hi', 'Hindi', 'male', 'Raj', 'Amit', 'Arjun'],
      [AIR_HOCKEY_SPEAKERS.analyst]: ['hi-IN', 'hi', 'Hindi', 'female', 'Asha', 'Priya', 'Neha']
    },
    speakerSettings: {
      [AIR_HOCKEY_SPEAKERS.lead]: { rate: 1.06, pitch: 1.02, volume: 1 },
      [AIR_HOCKEY_SPEAKERS.analyst]: { rate: 1.08, pitch: 1.08, volume: 1 }
    }
  },
  {
    id: 'moscow-mics',
    label: 'Russian Booth',
    description: 'Russian commentary with steady cadence',
    language: 'ru',
    voiceHints: {
      [AIR_HOCKEY_SPEAKERS.lead]: ['ru-RU', 'ru', 'Russian', 'male', 'Dmitri', 'Ivan', 'Sergey', 'Alexey'],
      [AIR_HOCKEY_SPEAKERS.analyst]: ['ru-RU', 'ru', 'Russian', 'female', 'Anna', 'Svetlana', 'Irina', 'Olga']
    },
    speakerSettings: {
      [AIR_HOCKEY_SPEAKERS.lead]: { rate: 1, pitch: 0.95, volume: 1 },
      [AIR_HOCKEY_SPEAKERS.analyst]: { rate: 1.03, pitch: 1.02, volume: 1 }
    }
  },
  {
    id: 'latin-pulse',
    label: 'Latin Pulse',
    description: 'Spanish play-by-play with lively color',
    language: 'es',
    voiceHints: {
      [AIR_HOCKEY_SPEAKERS.lead]: ['es-ES', 'es-MX', 'Spanish', 'male', 'Jorge', 'Carlos', 'Miguel'],
      [AIR_HOCKEY_SPEAKERS.analyst]: ['es-ES', 'es-MX', 'Spanish', 'female', 'Isabella', 'Lucia', 'Camila']
    },
    speakerSettings: {
      [AIR_HOCKEY_SPEAKERS.lead]: { rate: 1.05, pitch: 1, volume: 1 },
      [AIR_HOCKEY_SPEAKERS.analyst]: { rate: 1.08, pitch: 1.1, volume: 1 }
    }
  },
  {
    id: 'francophone-booth',
    label: 'Francophone Booth',
    description: 'French broadcast pairing',
    language: 'fr',
    voiceHints: {
      [AIR_HOCKEY_SPEAKERS.lead]: ['fr-FR', 'French', 'male', 'Henri', 'Louis', 'Paul'],
      [AIR_HOCKEY_SPEAKERS.analyst]: ['fr-FR', 'French', 'female', 'Amelie', 'Marie', 'Charlotte']
    },
    speakerSettings: {
      [AIR_HOCKEY_SPEAKERS.lead]: { rate: 0.98, pitch: 0.96, volume: 1 },
      [AIR_HOCKEY_SPEAKERS.analyst]: { rate: 1.04, pitch: 1.06, volume: 1 }
    }
  }
]);
const DEFAULT_COMMENTARY_PRESET_ID = AIR_HOCKEY_COMMENTARY_PRESETS[0]?.id || 'english';
const AIR_HOCKEY_TOP_VIEW_CAMERA_DISTANCE_SCALE = 0.9;
const CAMERA_LIFT_STEP = 0.2;
const CAMERA_LIFT_MIN = 0.45;
const CAMERA_LIFT_MAX = 1.85;
// Physics stays at one deterministic rate even when the selected graphics
// profile renders at 50, 60, 90, 120, or 144 Hz.
const AIR_HOCKEY_FIXED_STEP_SECONDS = 1 / 120;
const AIR_HOCKEY_MAX_PHYSICS_STEPS = 12;
const AIR_HOCKEY_VARIANT = Object.freeze({
  id: 'airhockey',
  roomPrefix: 'air-hockey',
  lobbyPath: '/games/airhockey/lobby',
  lobbyLabel: 'Air Hockey',
  arenaLabel: 'Air Hockey arena',
  optionLabels: {
    puck: 'Puck',
    mallet: 'Mallets'
  }
});

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

/**
 * AIR HOCKEY 3D — Mobile Portrait
 * -------------------------------
 * • HDRI-lit Air Hockey arena with Murlan Royale environments (no walls or carpet)
 * • Player-edge camera for an at-table perspective suited to portrait play
 * • Controls: drag bottom half to move mallet
 * • AI opponent on top half with simple tracking logic
 * • Scoreboard with avatars
 */

export default function AirHockey3D({
  player,
  ai,
  target = 11,
  playType = 'regular',
  accountId,
  online = false,
  tableId = '',
  seatIndex = 0
}) {
  const gameVariant = AIR_HOCKEY_VARIANT;
  const targetValue = Number(target) || 11;
  const hostRef = useRef(null);
  const raf = useRef(0);
  const [ui, setUi] = useState({ left: 0, right: 0 });
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState('');
  const [goalPopup, setGoalPopup] = useState(null);
  const [postPopup, setPostPopup] = useState(false);
  const [rematchStatus, setRematchStatus] = useState('');
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
  const [tableReady, setTableReady] = useState(false);
  const [tableError, setTableError] = useState('');
  const [isTopDownView, setIsTopDownView] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showGift, setShowGift] = useState(false);
  const [cameraLiftUi, setCameraLiftUi] = useState(DEFAULT_CAMERA_LIFT);
  const [chatBubbles, setChatBubbles] = useState([]);
  const [liveMode, setLiveMode] = useState(false);
  const [showLivePanel, setShowLivePanel] = useState(false);
  const [muted, setMuted] = useState(isGameMuted());
  const [commentaryPresetId, setCommentaryPresetId] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(COMMENTARY_PRESET_STORAGE_KEY);
      if (stored && AIR_HOCKEY_COMMENTARY_PRESETS.some((preset) => preset.id === stored)) {
        return stored;
      }
    }
    return DEFAULT_COMMENTARY_PRESET_ID;
  });
  const [commentaryMuted, setCommentaryMuted] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(COMMENTARY_MUTE_STORAGE_KEY);
      if (stored === '1') return true;
      if (stored === '0') return false;
    }
    return false;
  });
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
  const activeCommentaryPreset = useMemo(
    () =>
      AIR_HOCKEY_COMMENTARY_PRESETS.find((preset) => preset.id === commentaryPresetId) ??
      AIR_HOCKEY_COMMENTARY_PRESETS[0],
    [commentaryPresetId]
  );
  const [commentarySupported, setCommentarySupported] = useState(() => getSpeechSupport());
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
  const commentaryMutedRef = useRef(commentaryMuted);
  const commentaryReadyRef = useRef(false);
  const commentaryQueueRef = useRef([]);
  const commentarySpeakingRef = useRef(false);
  const commentaryLastEventAtRef = useRef(0);
  const pendingCommentaryLinesRef = useRef(null);
  const commentaryIntroPlayedRef = useRef(false);
  const commentarySpeakerIndexRef = useRef(0);
  const goalTimeoutRef = useRef(null);
  const postTimeoutRef = useRef(null);
  const restartTimeoutRef = useRef(null);
  const lastTouchRef = useRef(null);
  const onlineSyncRef = useRef({ remoteInput: null, snapshot: null, inputSeq: 0, lastSentAt: 0, revision: 0 });
  const topLiveVideoRef = useRef(null);
  const materialsRef = useRef({
    tableSurface: null,
    cushion: null,
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
  const cameraLiftRef = useRef(DEFAULT_CAMERA_LIFT);
  const isTopDownViewRef = useRef(false);
  const renderSettingsRef = useRef({
    targetFrameIntervalMs: 1000 / initialProfile.targetFps,
    renderResolutionScale: initialProfile.renderScale ?? 1,
    pixelRatioCap: initialProfile.pixelRatioCap ?? DEFAULT_RENDER_PIXEL_RATIO_CAP,
    pixelRatioScale: initialProfile.pixelRatioScale ?? RENDER_PIXEL_RATIO_SCALE
  });
  const lastFrameTimeRef = useRef(0);
  const frameAccumulatorRef = useRef(0);
  const physicsAccumulatorRef = useRef(0);
  const selectionsRef = useRef(selections);
  const chatAvatar = useMemo(() => getAvatarUrl(player.avatar), [player.avatar]);
  const liveChatRoomId = useMemo(() => {
    const params = new URLSearchParams(window.location.search || '');
    return (
      params.get('tableId') ||
      params.get('table') ||
      `${gameVariant.roomPrefix}-${playType || 'regular'}`
    );
  }, [gameVariant.roomPrefix, playType]);
  const liveChat = useLiveVideoChat({
    roomId: liveChatRoomId,
    displayName: player?.name || 'Player',
    enabled: liveMode
  });
  useEffect(() => {
    if (!online || !tableId || !accountId) return undefined;
    refreshSocketAuthIdentity({ accountId }, { reconnect: true });
    const joinAndSync = () => {
      socket.emit('register', { playerId: accountId });
      socket.emit('joinAirHockeyTable', { tableId, accountId });
      socket.emit('airHockeySyncRequest', { tableId, accountId });
    };
    const onRemoteInput = (payload = {}) => {
      if (payload.tableId === tableId) onlineSyncRef.current.remoteInput = payload.input || null;
    };
    const onRemoteState = (payload = {}) => {
      const revision = Number(payload.revision ?? payload.state?.seq ?? 0);
      if (
        payload.tableId === tableId &&
        payload.state &&
        revision >= onlineSyncRef.current.revision
      ) {
        onlineSyncRef.current.revision = revision;
        onlineSyncRef.current.snapshot = payload.state;
      }
    };
    const onRematchRequested = (payload = {}) => {
      if (payload.tableId === tableId && String(payload.accountId) !== String(accountId)) {
        setRematchStatus('Opponent wants to play again.');
      }
    };
    const onRematchStart = (payload = {}) => {
      if (payload.tableId === tableId) window.location.reload();
    };
    socket.on('connect', joinAndSync);
    socket.on('airHockeyInput', onRemoteInput);
    socket.on('airHockeyState', onRemoteState);
    socket.on('airHockeyRematchRequested', onRematchRequested);
    socket.on('airHockeyRematchStart', onRematchStart);
    joinAndSync();
    return () => {
      socket.off('connect', joinAndSync);
      socket.off('airHockeyInput', onRemoteInput);
      socket.off('airHockeyState', onRemoteState);
      socket.off('airHockeyRematchRequested', onRematchRequested);
      socket.off('airHockeyRematchStart', onRematchStart);
    };
  }, [accountId, online, tableId]);
  useEffect(() => {
    if (liveMode) {
      liveChat.startLiveChat();
      return;
    }
    liveChat.stopLiveChat();
  }, [liveMode, liveChat.startLiveChat, liveChat.stopLiveChat]);
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
  useEffect(() => {
    if (!topLiveVideoRef.current) return;
    topLiveVideoRef.current.srcObject = liveChat.localStream || null;
  }, [liveChat.localStream]);
  const toggleLiveFromAvatar = useCallback(() => {
    setLiveMode((prev) => {
      const nextLiveMode = !prev;
      setShowLivePanel((panelOpen) => (nextLiveMode ? true : panelOpen));
      return nextLiveMode;
    });
  }, []);
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
  const tableGroupRef = useRef(null);
  const tableMarkingsRef = useRef({ line: null, circle: null });
  const avatarSpritesRef = useRef({ player: null, ai: null });
  const getOption = (key, optionId) => {
    const options = AIR_HOCKEY_CUSTOMIZATION[key] || [];
    return options.find((option) => option.id === optionId) || options[0];
  };

  useEffect(() => {
    const updateSupport = () => setCommentarySupported(getSpeechSupport());
    updateSupport();
    const unsubscribe = onSpeechSupportChange((supported) => setCommentarySupported(Boolean(supported)));
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    setAirInventory(getAirHockeyInventory(resolvedAccountId));
  }, [resolvedAccountId]);

  useEffect(() => {
    selectionsRef.current = selections;
  }, [selections]);



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

  useEffect(() => () => {
    clearTimeout(goalTimeoutRef.current);
    clearTimeout(postTimeoutRef.current);
    clearTimeout(restartTimeoutRef.current);
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
    cameraLiftRef.current = DEFAULT_CAMERA_LIFT;
    cameraViewRef.current.applyCurrent?.(isTopDownView, DEFAULT_CAMERA_LIFT);
  }, [isTopDownView]);

  useEffect(() => {
    commentaryMutedRef.current = commentaryMuted;
    if (commentaryMuted) {
      const synth = getSpeechSynthesis();
      synth?.cancel();
      commentaryQueueRef.current = [];
      commentarySpeakingRef.current = false;
      pendingCommentaryLinesRef.current = null;
    }
  }, [commentaryMuted]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(COMMENTARY_PRESET_STORAGE_KEY, commentaryPresetId);
    }
  }, [commentaryPresetId]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(COMMENTARY_MUTE_STORAGE_KEY, commentaryMuted ? '1' : '0');
    }
  }, [commentaryMuted]);

  const playerNameRef = useRef(player.name || 'Player');
  const aiNameRef = useRef(ai.name || 'Opponent');
  useEffect(() => {
    playerNameRef.current = player.name || 'Player';
    aiNameRef.current = ai.name || 'Opponent';
  }, [ai.name, player.name]);

  const resolveScoreline = useCallback((left, right) => {
    if (left === right) return `level at ${left}-${right}`;
    const leader = left > right ? playerNameRef.current : aiNameRef.current;
    const leaderScore = left > right ? left : right;
    const trailerScore = left > right ? right : left;
    return `${leader} leads ${leaderScore}-${trailerScore}`;
  }, []);

  const pickCommentarySpeaker = useCallback(() => {
    const speakers = [AIR_HOCKEY_SPEAKERS.lead, AIR_HOCKEY_SPEAKERS.analyst];
    const index = commentarySpeakerIndexRef.current;
    commentarySpeakerIndexRef.current = index + 1;
    return speakers[index % speakers.length] || AIR_HOCKEY_SPEAKERS.lead;
  }, []);

  const playNextCommentary = useCallback(async () => {
    if (commentarySpeakingRef.current) return;
    const next = commentaryQueueRef.current.shift();
    if (!next) return;
    const synth = getSpeechSynthesis();
    if (!synth) return;
    commentarySpeakingRef.current = true;
    try {
      synth.cancel();
    } catch {}
    await speakCommentaryLines(next.lines, {
      speakerSettings: next.preset?.speakerSettings,
      voiceHints: next.preset?.voiceHints
    });
    commentarySpeakingRef.current = false;
    if (commentaryQueueRef.current.length) {
      playNextCommentary();
    }
  }, []);

  const enqueueAirHockeyCommentary = useCallback(
    (lines, { priority = false, preset = activeCommentaryPreset } = {}) => {
      if (!Array.isArray(lines) || lines.length === 0) return;
      if (commentaryMutedRef.current || isGameMuted()) return;
      if (!commentaryReadyRef.current) {
        pendingCommentaryLinesRef.current = { lines, priority, preset };
        return;
      }
      const now = performance.now();
      if (!priority && now - commentaryLastEventAtRef.current < COMMENTARY_MIN_INTERVAL_MS) return;
      if (!priority && commentaryQueueRef.current.length >= COMMENTARY_QUEUE_LIMIT) return;
      if (priority) {
        commentaryQueueRef.current.unshift({ lines, preset });
      } else {
        commentaryQueueRef.current.push({ lines, preset });
      }
      if (!commentarySpeakingRef.current) {
        playNextCommentary();
      }
      commentaryLastEventAtRef.current = now;
    },
    [activeCommentaryPreset, playNextCommentary]
  );

  const enqueueAirHockeyCommentaryEventRef = useRef(() => {});
  useEffect(() => {
    enqueueAirHockeyCommentaryEventRef.current = (event, context = {}, options = {}) => {
      const speaker = options.speaker ?? pickCommentarySpeaker();
      const text = buildAirHockeyCommentaryLine({
        event,
        speaker,
        language: activeCommentaryPreset?.language ?? commentaryPresetId,
        context: {
          arena: gameVariant.arenaLabel,
          targetScore: targetRef.current ?? targetValue,
          ...context
        }
      });
      enqueueAirHockeyCommentary([{ speaker, text }], options);
    };
  }, [
    activeCommentaryPreset?.language,
    commentaryPresetId,
    enqueueAirHockeyCommentary,
    pickCommentarySpeaker,
    targetValue
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const unlockCommentary = () => {
      if (commentaryReadyRef.current) return;
      primeSpeechSynthesis();
      const synth = getSpeechSynthesis();
      synth?.getVoices?.();
      commentaryReadyRef.current = true;
      const pending = pendingCommentaryLinesRef.current;
      if (pending) {
        pendingCommentaryLinesRef.current = null;
        enqueueAirHockeyCommentary(pending.lines, pending);
      }
    };
    window.addEventListener('pointerdown', unlockCommentary);
    window.addEventListener('click', unlockCommentary);
    window.addEventListener('touchstart', unlockCommentary);
    window.addEventListener('keydown', unlockCommentary);
    return () => {
      window.removeEventListener('pointerdown', unlockCommentary);
      window.removeEventListener('click', unlockCommentary);
      window.removeEventListener('touchstart', unlockCommentary);
      window.removeEventListener('keydown', unlockCommentary);
    };
  }, [enqueueAirHockeyCommentary]);

  useEffect(() => {
    if (commentaryIntroPlayedRef.current) return;
    commentaryIntroPlayedRef.current = true;
    const lead = AIR_HOCKEY_SPEAKERS.lead;
    const analyst = AIR_HOCKEY_SPEAKERS.analyst;
    const baseContext = {
      player: playerNameRef.current,
      opponent: aiNameRef.current,
      playerScore: scoreRef.current.left,
      opponentScore: scoreRef.current.right,
      scoreline: resolveScoreline(scoreRef.current.left, scoreRef.current.right)
    };
    enqueueAirHockeyCommentary(
      [
        {
          speaker: lead,
          text: buildAirHockeyCommentaryLine({
            event: 'intro',
            speaker: lead,
            language: activeCommentaryPreset?.language ?? commentaryPresetId,
            context: baseContext
          })
        },
        {
          speaker: analyst,
          text: buildAirHockeyCommentaryLine({
            event: 'introReply',
            speaker: analyst,
            language: activeCommentaryPreset?.language ?? commentaryPresetId,
            context: baseContext
          })
        }
      ],
      { priority: true }
    );
  }, [activeCommentaryPreset?.language, commentaryPresetId, enqueueAirHockeyCommentary, resolveScoreline]);

  useEffect(() => {
    const handler = () => setMuted(isGameMuted());
    window.addEventListener('gameMuteChanged', handler);
    return () => window.removeEventListener('gameMuteChanged', handler);
  }, []);

  useEffect(() => {
    const handleMute = () => {
      if (!isGameMuted()) return;
      const synth = getSpeechSynthesis();
      synth?.cancel();
      commentaryQueueRef.current = [];
      commentarySpeakingRef.current = false;
      pendingCommentaryLinesRef.current = null;
    };
    window.addEventListener('gameMuteChanged', handleMute);
    return () => window.removeEventListener('gameMuteChanged', handleMute);
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
      const lastTouch = lastTouchRef.current;
      const playerWasLast = lastTouch === 'player';
      const scorerName = playerWasLast ? playerNameRef.current : aiNameRef.current;
      const opponentName = playerWasLast ? aiNameRef.current : playerNameRef.current;
      enqueueAirHockeyCommentaryEventRef.current('post', {
        player: scorerName,
        opponent: opponentName,
        playerScore: playerWasLast ? scoreRef.current.left : scoreRef.current.right,
        opponentScore: playerWasLast ? scoreRef.current.right : scoreRef.current.left,
        scoreline: resolveScoreline(scoreRef.current.left, scoreRef.current.right)
      });
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
      const prevLeft = scoreRef.current.left;
      const prevRight = scoreRef.current.right;
      const prevLeader =
        prevLeft === prevRight ? 'tie' : prevLeft > prevRight ? 'left' : 'right';
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
      const scoreline = resolveScoreline(scoreRef.current.left, scoreRef.current.right);
      const scorerName = playerScored ? playerNameRef.current : aiNameRef.current;
      const opponentName = playerScored ? aiNameRef.current : playerNameRef.current;
      const playerScore = playerScored ? scoreRef.current.left : scoreRef.current.right;
      const opponentScore = playerScored ? scoreRef.current.right : scoreRef.current.left;
      const newLeader =
        scoreRef.current.left === scoreRef.current.right
          ? 'tie'
          : scoreRef.current.left > scoreRef.current.right
            ? 'left'
            : 'right';
      const leadChanged = newLeader !== prevLeader && newLeader !== 'tie';
      if (
        targetScore &&
        (scoreRef.current.left >= targetScore || scoreRef.current.right >= targetScore)
      ) {
        gameOverRef.current = true;
        setGameOver(true);
        setWinner(playerScored ? player.name : ai.name);
        enqueueAirHockeyCommentaryEventRef.current(
          'matchWin',
          {
            player: scorerName,
            opponent: opponentName,
            playerScore,
            opponentScore,
            scoreline
          },
          { priority: true }
        );
        return true;
      }
      if (scoreRef.current.left === scoreRef.current.right) {
        enqueueAirHockeyCommentaryEventRef.current('equalizer', {
          player: scorerName,
          opponent: opponentName,
          playerScore,
          opponentScore,
          scoreline
        });
      } else if (leadChanged) {
        enqueueAirHockeyCommentaryEventRef.current('leadChange', {
          player: scorerName,
          opponent: opponentName,
          playerScore,
          opponentScore,
          scoreline
        });
      } else {
        enqueueAirHockeyCommentaryEventRef.current('goal', {
          player: scorerName,
          opponent: opponentName,
          playerScore,
          opponentScore,
          scoreline
        });
      }
      if (targetScore && playerScore === targetScore - 1) {
        enqueueAirHockeyCommentaryEventRef.current('matchPoint', {
          player: scorerName,
          opponent: opponentName,
          playerScore,
          opponentScore,
          scoreline
        });
      }
      return false;
    };

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance'
      });
    } catch {
      setTableError('3D graphics could not start. Please try again.');
      return;
    }
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.85;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    updateRendererSettings();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);
    sceneRef.current = scene;

    const TABLE_SCALE = 1;
    const TABLE = {
      w: AIR_HOCKEY_DIMENSIONS.tableWidth * TABLE_SCALE,
      h: AIR_HOCKEY_DIMENSIONS.tableLength * TABLE_SCALE,
      thickness: AIR_HOCKEY_DIMENSIONS.tableThickness * TABLE_SCALE,
      topExtension: 0
    };
    const TABLE_WALL = AIR_HOCKEY_DIMENSIONS.tableWall * TABLE_SCALE;
    const PLAYFIELD = {
      w: AIR_HOCKEY_DIMENSIONS.playfieldWidth * TABLE_SCALE,
      h: AIR_HOCKEY_DIMENSIONS.playfieldHeight * TABLE_SCALE,
      goalW: AIR_HOCKEY_DIMENSIONS.playfieldWidth * SOURCE_FIELD.goalHalfWidth / SOURCE_FIELD.halfWidth,
      inset: 0
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
    const PUCK_RADIUS = PLAYFIELD.w * 0.0285;
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

    const elevatedTableSurfaceY = AIR_HOCKEY_DIMENSIONS.surfaceY;
    const tableGroup = new THREE.Group();
    tableGroup.position.y = elevatedTableSurfaceY;
    tableGroup.position.z = -TABLE.topExtension / 2;
    const tableCenterZ = tableGroup.position.z;
    world.add(tableGroup);
    tableGroupRef.current = tableGroup;
    const railThickness = TABLE_WALL * 0.6;
    const goalLabels = [];

    scene.add(new THREE.HemisphereLight(0xd6f5ff, 0x202634, 2.2));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
    keyLight.position.set(-PLAYFIELD.w, PLAYFIELD.h, PLAYFIELD.h * 0.35);
    scene.add(keyLight);

    const goalMaterial = new THREE.MeshStandardMaterial({ color: 0x99ffd6, emissive: 0x003322, emissiveIntensity: 0.6 });
    materialsRef.current.goal = goalMaterial;
    for (const end of [-1, 1]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(PLAYFIELD.goalW, SCALE_WIDTH * 0.018, SCALE_WIDTH * 0.035), goalMaterial);
      strip.position.set(0, SCALE_WIDTH * 0.012, end * (PLAYFIELD.h / 2 + SCALE_WIDTH * 0.025));
      tableGroup.add(strip);
    }

    const you = new THREE.Group();
    const aiMallet = new THREE.Group();
    const puck = new THREE.Group();
    you.name = 'air-hockey-player-mallet';
    aiMallet.name = 'air-hockey-opponent-mallet';
    puck.name = 'air-hockey-puck';
    tableGroup.add(you, aiMallet, puck);
    malletRefs.current = { player: you, ai: aiMallet };
    const playerMaterial = new THREE.MeshStandardMaterial({ color: 0xff5577, roughness: 0.3, metalness: 0.2 });
    const aiMaterial = new THREE.MeshStandardMaterial({ color: 0x66ddff, roughness: 0.3, metalness: 0.2 });
    const puckMaterial = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3, metalness: 0.2 });
    materialsRef.current.playerMallet = playerMaterial;
    materialsRef.current.aiMallet = aiMaterial;
    materialsRef.current.puck = puckMaterial;
    let modelDisposed = false;
    let modelLoaded = false;
    let loadedModel = null;
    setTableReady(false);
    setTableError('');
    loadAirHockeyModel().then((model) => {
      if (modelDisposed) { disposeAirHockeyModel(model); return; }
      loadedModel = model;
      const table = new THREE.Mesh(model.table, model.material);
      table.name = 'air-hockey-uploaded-table';
      tableGroup.add(table);
      [you, aiMallet].forEach((group, i) => {
        const geometry = fitAirHockeyPiece(model.mallets[i], MALLET_RADIUS);
        group.add(new THREE.Mesh(geometry, i === 0 ? playerMaterial : aiMaterial));
      });
      const puckGeometry = fitAirHockeyPiece(model.puck, PUCK_RADIUS);
      const puckMesh = new THREE.Mesh(puckGeometry, puckMaterial);
      puckMesh.position.y = -PUCK_HEIGHT / 2 + SCALE_WIDTH * 0.004;
      puck.add(puckMesh);
      const malletHeight = model.mallets[0].boundingBox.max.y;
      malletDimensionsRef.current = { radius: MALLET_RADIUS, knobRadius: MALLET_RADIUS * 0.48, height: 0, knobHeight: malletHeight };
      modelLoaded = true;
      reset();
      physicsAccumulatorRef.current = 0;
      setTableReady(true);
    }).catch((error) => {
      if (modelDisposed) return;
      console.error('Air Hockey model failed to load', error);
      setTableError('The table could not load. Please try again.');
    });

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
    const resolveCameraAnchor = () => {
      const anchor = standingCameraAnchor.clone();
      anchor.y += (cameraLiftRef.current - DEFAULT_CAMERA_LIFT) * SCALE_WIDTH * 0.38;
      return anchor;
    };
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
      const distance =
        Math.max(halfLength / verticalTan, halfWidth / horizontalTan) *
        AIR_HOCKEY_TOP_VIEW_CAMERA_DISTANCE_SCALE;
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

    const fitCameraToTable = () => {
      if (isTopDownViewRef.current) {
        updateTopViewCamera();
        return;
      }
      const anchor = resolveCameraAnchor();
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
      applyCurrent: (useTopView, lift = cameraLiftRef.current) => {
        cameraLiftRef.current = clamp(lift, CAMERA_LIFT_MIN, CAMERA_LIFT_MAX);
        if (useTopView) {
          updateTopViewCamera();
        } else {
          fitCameraToTable();
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
      if (e.cancelable) {
        e.preventDefault();
      }
      if (!isLowerHalfTouch(t.clientY)) return;
      const { x, z } = touchToXZ(t.clientX, t.clientY);
      you.position.set(x, 0, z);
      if (online && seatIndex === 1 && tableId && accountId) {
        const sync = onlineSyncRef.current;
        const now = performance.now();
        if (now - sync.lastSentAt >= 33) {
          sync.lastSentAt = now;
          sync.inputSeq += 1;
          // The guest sees their own goal at the visually lower edge. Rotate
          // only the network coordinates so both phones retain that portrait view.
          socket.emit('airHockeyInput', {
            tableId,
            accountId,
            input: { x: -x, z: -z, seq: sync.inputSeq }
          });
        }
      }
    };

    renderer.domElement.addEventListener('touchstart', onMove, {
      passive: false
    });
    renderer.domElement.addEventListener('touchmove', onMove, {
      passive: false
    });
    renderer.domElement.addEventListener('mousemove', onMove);

    const SPEED_BOOST = 1.25;
    const PUCK_SPEED_TUNING = 0.82;
    const HIT_FORCE = 0.5 * SPEED_SCALE * SPEED_BOOST * PUCK_SPEED_TUNING;
    const MAX_SPEED = 0.095 * SPEED_SCALE * SPEED_BOOST * PUCK_SPEED_TUNING;
    const SERVE_SPEED = 0.055 * SPEED_SCALE * SPEED_BOOST * PUCK_SPEED_TUNING;
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
        lastTouchRef.current = isPlayer ? 'player' : 'ai';
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

    const reset = (towardTop = false, shouldServe = true, spawnZ = 0) => {
      puck.position.set(0, PUCK_HEIGHT / 2, spawnZ);
      S.vel.set(0, 0, 0);
      you.position.set(0, 0, PLAYFIELD.h * 0.42);
      aiMallet.position.set(0, 0, -PLAYFIELD.h * 0.36);
      lastTouchRef.current = null;
      if (shouldServe) {
        servePuck(towardTop);
      }
    };

    // Load the table before serving.
    reset(false, false);
    fitCameraToTable();

    const tick = (timestamp = performance.now()) => {
      if (lastFrameTimeRef.current === 0) {
        lastFrameTimeRef.current = timestamp;
        frameAccumulatorRef.current = 0;
      }

      const elapsedMs = Math.min(100, timestamp - lastFrameTimeRef.current);
      lastFrameTimeRef.current = timestamp;
      frameAccumulatorRef.current += elapsedMs;
      physicsAccumulatorRef.current = Math.min(
        AIR_HOCKEY_FIXED_STEP_SECONDS * AIR_HOCKEY_MAX_PHYSICS_STEPS,
        physicsAccumulatorRef.current + elapsedMs / 1000
      );
      const targetInterval = renderSettingsRef.current.targetFrameIntervalMs || 16.67;
      if (frameAccumulatorRef.current < targetInterval * 0.92) {
        raf.current = requestAnimationFrame(tick);
        return;
      }

      frameAccumulatorRef.current = Math.max(0, frameAccumulatorRef.current - targetInterval);

      if (!modelLoaded) {
        physicsAccumulatorRef.current = 0;
        renderer.render(scene, camera);
        raf.current = requestAnimationFrame(tick);
        return;
      }

      if (online && seatIndex === 1) {
        const snapshot = onlineSyncRef.current.snapshot;
        if (snapshot) {
          puck.position.x += (-Number(snapshot.puck?.x || 0) - puck.position.x) * 0.65;
          puck.position.z += (-Number(snapshot.puck?.z || 0) - puck.position.z) * 0.65;
          aiMallet.position.x += (-Number(snapshot.host?.x || 0) - aiMallet.position.x) * 0.65;
          aiMallet.position.z += (-Number(snapshot.host?.z || 0) - aiMallet.position.z) * 0.65;
          const nextScore = { left: Number(snapshot.score?.right || 0), right: Number(snapshot.score?.left || 0) };
          if (nextScore.left !== scoreRef.current.left || nextScore.right !== scoreRef.current.right) {
            scoreRef.current = nextScore;
            setUi(nextScore);
          }
          if (snapshot.gameOver && !gameOverRef.current) {
            gameOverRef.current = true;
            setGameOver(true);
            setWinner(snapshot.winnerSeat === 1 ? player.name : ai.name);
          }
        }
        renderer.render(scene, camera);
        if (!gameOverRef.current) raf.current = requestAnimationFrame(tick);
        return;
      }

      if (online && seatIndex === 0 && onlineSyncRef.current.remoteInput) {
        const remote = onlineSyncRef.current.remoteInput;
        aiMallet.position.x += (clamp(remote.x, -PLAYFIELD.w / 2 + MALLET_RADIUS, PLAYFIELD.w / 2 - MALLET_RADIUS) - aiMallet.position.x) * 0.8;
        aiMallet.position.z += (clamp(remote.z, -PLAYFIELD.h / 2 + MALLET_RADIUS, -MALLET_RADIUS) - aiMallet.position.z) * 0.8;
      }

      let physicsSteps = 0;
      while (
        physicsAccumulatorRef.current >= AIR_HOCKEY_FIXED_STEP_SECONDS &&
        physicsSteps < AIR_HOCKEY_MAX_PHYSICS_STEPS &&
        !gameOverRef.current
      ) {
        const dt = AIR_HOCKEY_FIXED_STEP_SECONDS;
        const nominalFrameScale = dt * 60;
        puck.position.x += S.vel.x * nominalFrameScale;
        puck.position.z += S.vel.z * nominalFrameScale;
        S.vel.multiplyScalar(Math.pow(S.friction, nominalFrameScale));
        S.vel.clampLength(0, MAX_SPEED);

        const railContact = resolveAirHockeyRails(puck.position, S.vel, PLAYFIELD, PUCK_RADIUS);
        if (railContact === 'north-goal' || railContact === 'south-goal') {
          const atTop = railContact === 'north-goal';
          const ended = recordGoal(atTop);
          playGoal();
          S.vel.set(0, 0, 0);
          clearTimeout(restartTimeoutRef.current);
          if (!ended) {
            reset(atTop, false);
            restartTimeoutRef.current = setTimeout(() => servePuck(atTop), GOAL_RESET_DELAY);
          }
        } else if (railContact === 'rail') {
          playHit();
        }
        if (!online) aiUpdate(dt);
        handleCollision(you, true);
        handleCollision(aiMallet);
        physicsAccumulatorRef.current -= AIR_HOCKEY_FIXED_STEP_SECONDS;
        physicsSteps += 1;
      }
      if (online && seatIndex === 0 && timestamp - onlineSyncRef.current.lastSentAt >= 50) {
        onlineSyncRef.current.lastSentAt = timestamp;
        socket.emit('airHockeyState', {
          tableId,
          accountId,
          state: {
            puck: { x: puck.position.x, z: puck.position.z, vx: S.vel.x, vz: S.vel.z },
            host: { x: you.position.x, z: you.position.z },
            guest: { x: aiMallet.position.x, z: aiMallet.position.z },
            score: scoreRef.current,
            gameOver: gameOverRef.current,
            winnerSeat: scoreRef.current.left >= targetRef.current ? 0 : 1
          }
        });
      }
      renderer.render(scene, camera);
      if (!gameOverRef.current) {
        raf.current = requestAnimationFrame(tick);
      }
    };

    tick();

    const onResize = () => {
      fitCameraToTable();
    };
    window.addEventListener('resize', onResize);

    return () => {
      modelDisposed = true;
      if (loadedModel) disposeAirHockeyModel(loadedModel);
      playerMaterial.dispose();
      aiMaterial.dispose();
      puckMaterial.dispose();
      goalMaterial.dispose();
      tableGroup.traverse((object) => { if (object.isMesh) object.geometry?.dispose(); });
      clearTimeout(restartTimeoutRef.current);
      cancelAnimationFrame(raf.current);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('touchstart', onMove);
      renderer.domElement.removeEventListener('touchmove', onMove);
      renderer.domElement.removeEventListener('mousemove', onMove);
      rendererRef.current = null;
      lastFrameTimeRef.current = 0;
      frameAccumulatorRef.current = 0;
      physicsAccumulatorRef.current = 0;
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
      if (tableMarkingsRef.current.line) {
        tableMarkingsRef.current.line.parent?.remove(tableMarkingsRef.current.line);
        tableMarkingsRef.current.line.geometry?.dispose();
        tableMarkingsRef.current.line.material?.dispose();
      }
      if (tableMarkingsRef.current.circle) {
        tableMarkingsRef.current.circle.parent?.remove(tableMarkingsRef.current.circle);
        tableMarkingsRef.current.circle.geometry?.dispose();
        tableMarkingsRef.current.circle.material?.dispose();
      }
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
    if (!tableReady || !playerMallet || !aiMallet || !dims.knobRadius || !dims.knobHeight) {
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

    let avatarsCancelled = false;
    const setAvatar = (key, avatar) => {
      const existing = avatarSpritesRef.current[key];
      if (existing) {
        existing.parent?.remove(existing);
        existing.material.map?.dispose();
        existing.material.dispose();
        existing.geometry?.dispose();
      }
      loadAvatarImage(key, avatar, (image, url) => {
        if (avatarsCancelled) return;
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
      avatarsCancelled = true;
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
  }, [tableReady, player.avatar, ai.avatar]);

  useEffect(() => {
    const mats = materialsRef.current;
    if (!mats) return;

    const puckTheme = getOption('puck', selections.puck);
    const malletTheme = getOption('mallet', selections.mallet);
    const goalTheme = getOption('goals', selections.goals);

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
                type="button"
                aria-pressed={active}
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
      className="ah-game w-full h-[100dvh] bg-black relative overflow-hidden select-none"
      style={{ touchAction: 'none', overscrollBehavior: 'none' }}
    >
      <div className="ah-scoreboard" aria-label={`Score: ${player.name} ${ui.left}, ${ai.name} ${ui.right}`}>
        <button type="button" className="ah-player" data-player-index="0" data-self-player="true"
          aria-label={liveMode ? 'Turn off live avatar video' : 'Turn on live avatar video'} onClick={toggleLiveFromAvatar}>
          {liveMode ? <video ref={topLiveVideoRef} autoPlay playsInline muted /> : <img src={getAvatarUrl(player.avatar)} alt="" />}
          <span className="ah-player-info"><span className="ah-player-name">{player.name}{liveMode ? ' • Live' : ''}</span><strong className="ah-player-score">{ui.left}</strong></span>
        </button>
        <div className="ah-match-target"><span>{playType}</span><strong>First to {targetValue}</strong></div>
        <div className="ah-player" data-player-index="1">
          <span className="ah-player-info"><span className="ah-player-name">{ai.name}</span><strong className="ah-player-score">{ui.right}</strong></span>
          <img src={getAvatarUrl(ai.avatar)} alt="" />
        </div>
      </div>
      <AirHockeyControls topView={isTopDownView} muted={muted} settingsOpen={showCustomizer}
        lift={cameraLiftUi} minLift={CAMERA_LIFT_MIN} maxLift={CAMERA_LIFT_MAX}
        onView={() => setIsTopDownView((prev) => !prev)}
        onMute={() => { toggleGameMuted(); setMuted(isGameMuted()); }}
        onSettings={() => setShowCustomizer((prev) => !prev)}
        onChat={() => setShowChat(true)} onGift={() => setShowGift(true)}
        onLift={(direction) => {
          const nextLift = clamp(cameraLiftUi + direction * CAMERA_LIFT_STEP, CAMERA_LIFT_MIN, CAMERA_LIFT_MAX);
          setCameraLiftUi(nextLift);
          cameraViewRef.current.applyCurrent?.(false, nextLift);
        }} />
      {!tableReady && <div className="ah-model-status" role={tableError ? 'alert' : 'status'}>
        <span>{tableError || 'Loading your table…'}</span>
        {tableError && <button type="button" onClick={() => window.location.reload()}>Retry</button>}
      </div>}
      <AirHockeySettingsSheet open={showCustomizer} onClose={() => setShowCustomizer(false)}>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div>
                <p className="ah-setting-label">Graphics</p>
                <p className="mt-1 text-[0.7rem] text-white/60">Choose the detail and frame rate for your phone.</p>
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
                        <span className="text-sm font-semibold text-white">
                          {option.label}
                        </span>
                        <span className="text-[11px] font-semibold tracking-wide text-sky-100">
                          {option.fps} FPS
                        </span>
                      </span>
                      {option.description ? (
                        <span className="mt-1 block text-xs text-white/60">
                          {option.description}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div>
                <p className="ah-setting-label">Commentary</p>
              </div>
              <div className="mt-2 grid gap-2">
                {AIR_HOCKEY_COMMENTARY_PRESETS.map((preset) => {
                  const active = preset.id === commentaryPresetId;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setCommentaryPresetId(preset.id)}
                      aria-pressed={active}
                      disabled={!commentarySupported}
                      className={`w-full rounded-2xl border px-3 py-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                        active
                          ? 'border-sky-300 bg-sky-300/15 shadow-[0_0_12px_rgba(125,211,252,0.35)]'
                          : 'border-white/10 bg-white/5 hover:border-white/20 text-white/80'
                      } ${commentarySupported ? '' : 'cursor-not-allowed opacity-60'}`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-white">{preset.label}</span>
                        {active && (
                          <span className="rounded-full border border-sky-200/70 px-2 py-0.5 text-[9px] tracking-[0.3em] text-sky-100">
                            Active
                          </span>
                        )}
                      </span>
                      <span className="mt-1 block text-xs text-white/60">
                        {preset.description}
                      </span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setCommentaryMuted((prev) => !prev)}
                aria-pressed={commentaryMuted}
                disabled={!commentarySupported}
                className={`mt-2 flex w-full items-center justify-between gap-3 rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                  commentaryMuted
                    ? 'bg-sky-300 text-slate-900 shadow-[0_0_12px_rgba(125,211,252,0.35)]'
                    : 'bg-white/10 text-white/80 hover:bg-white/20'
                } ${commentarySupported ? '' : 'cursor-not-allowed opacity-60'}`}
              >
                <span>Mute commentary</span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] tracking-[0.3em] ${
                    commentaryMuted ? 'border-black/30 text-black/70' : 'border-white/30 text-white/70'
                  }`}
                >
                  {commentaryMuted ? 'On' : 'Off'}
                </span>
              </button>
              {!commentarySupported && (
                <p className="mt-2 text-[0.65rem] text-white/60">
                  Voice commentary needs Web Speech support.
                </p>
              )}
            </div>
            {renderOptionRow('HDRI Environment', 'environmentHdri')}
            {renderOptionRow(gameVariant.optionLabels.puck, 'puck')}
            {renderOptionRow(gameVariant.optionLabels.mallet, 'mallet')}
            {renderOptionRow('Goals', 'goals')}
      </AirHockeySettingsSheet>
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
      <LiveVideoChatPanel
        open={showLivePanel && liveMode}
        onClose={() => {
          setShowLivePanel(false);
        }}
        roomId={liveChatRoomId}
        localStream={liveChat.localStream}
        localMediaState={liveChat.mediaState}
        remotePeers={liveChat.remotePeers}
        isConnected={liveChat.isConnected}
        error={liveChat.error}
        onStart={() => {
          setLiveMode(true);
          liveChat.startLiveChat();
        }}
        onStop={() => {
          liveChat.stopLiveChat();
          setLiveMode(false);
          setShowLivePanel(false);
        }}
        onToggleMicrophone={liveChat.toggleMicrophone}
        onToggleCamera={liveChat.toggleCamera}
      />
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
            {rematchStatus ? <div className="text-[11px] text-cyan-200">{rematchStatus}</div> : null}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => {
                  if (!online) {
                    window.location.reload();
                    return;
                  }
                  setRematchStatus('Waiting for opponent…');
                  socket.emit('airHockeyRematch', { tableId, accountId });
                }}
                className="w-full rounded bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold py-2 text-sm"
              >
                Play Again
              </button>
              <button
                onClick={() => (window.location.href = gameVariant.lobbyPath)}
                className="w-full rounded bg-emerald-500/90 hover:bg-emerald-500 text-black font-semibold py-2 text-sm"
              >
                Return to Lobby
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
