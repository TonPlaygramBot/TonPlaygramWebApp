import {
  BACKGAMMON_ONLINE_READY,
  BACKGAMMON_ONLINE_MESSAGE
} from '../../games/backgammon/readiness.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { MURLAN_TABLE_FINISHES } from '../../config/murlanTableFinishes.js';
import {
  getTelegramFirstName,
  getTelegramPhotoUrl
} from '../../utils/telegram.js';
import {
  applyRendererSRGB,
  applySRGBColorSpace
} from '../../utils/colorSpace.js';
import BottomLeftIcons from '../../components/BottomLeftIcons.jsx';
import AvatarTimer from '../../components/AvatarTimer.jsx';
import { getGameVolume, isGameMuted } from '../../utils/sound.js';
import QuickMessagePopup from '../../components/QuickMessagePopup.jsx';
import GiftPopup from '../../components/GiftPopup.jsx';
import {
  TAVULL_BATTLE_BOARD_FINISH_OPTIONS,
  TAVULL_BATTLE_CHAIR_OPTIONS,
  TAVULL_BATTLE_FRAME_FINISH_OPTIONS,
  TAVULL_BATTLE_TRIANGLE_COLOR_OPTIONS
} from '../../config/tavullBattleInventoryConfig.js';
import { POOL_ROYALE_HDRI_VARIANTS } from '../../config/poolRoyaleInventoryConfig.js';
import {
  getTavullBattleInventory,
  isTavullOptionUnlocked,
  tavullBattleAccountId
} from '../../utils/tavullBattleInventory.js';
import { getCustomHdriVariantsForGame } from '../../utils/customHdriCatalog.js';
import { BLACK, WHITE } from '../../utils/tavullEngine.js';
import { CHESS_HUMAN_CHARACTER_OPTIONS } from '../../config/chessBattleInventoryConfig.js';
import {
  getChessBattleInventory,
  isChessOptionUnlocked
} from '../../utils/chessBattleInventory.js';
import { BATTLE_ROYALE_SHARED_TABLE_THEME_OPTIONS } from '../../config/battleRoyaleSharedInventory.js';
import { createSeatedHumanModelLibrary } from '../../games/chess/seatedHumanModel.js';
import { useBackgammonMatch } from '../../games/backgammon/useBackgammonMatch.ts';
import {
  canDouble,
  legalFirstMoves,
  pipCount
} from '../../games/backgammon/match.mjs';
import {
  BACKGAMMON_GRAPHICS,
  BACKGAMMON_GRAPHICS_KEY,
  readBackgammonGraphics
} from '../../games/backgammon/graphics.ts';
import {
  createBackgammonActor,
  setBackgammonView,
  idleBackgammonActor,
  disposeBackgammonActor,
  updateBackgammonChecker,
  createBackgammonDiceAction,
  applyBackgammonCamera,
  BACKGAMMON_HUMAN_HEIGHT,
  BACKGAMMON_SEAT_DISTANCE,
  BACKGAMMON_SEAT_Y,
  PHYSICAL_MOVE_DURATION_MS
} from '../../games/backgammon/presentation.ts';
import {
  createBackgammonEnvironment,
  disposeBackgammonObject
} from '../../games/backgammon/environment.ts';

const TABLE_RADIUS = 1.72;
const TABLE_HEIGHT = 1.16;
const CHAIR_DISTANCE = BACKGAMMON_SEAT_DISTANCE;
const BOARD_Y = TABLE_HEIGHT + 0.08;
const BOARD_HALF_X = 1.28;
const BOARD_HALF_Z = 0.98;
const BOARD_EDGE_MARGIN_X = 0.092;
const BOARD_EDGE_MARGIN_Z = 0.118;
const CENTER_BAR_WIDTH = 0.118;
const POINT_COLUMNS = 6;
const POINT_WIDTH =
  (BOARD_HALF_X * 2 - CENTER_BAR_WIDTH - BOARD_EDGE_MARGIN_X * 2) /
  (POINT_COLUMNS * 2);
const BOARD_BASE_THICKNESS = 0.16;
const FRAME_THICKNESS = 0.112;
const LANE_THICKNESS = 0.04;
const CENTER_BAR_THICKNESS = 0.062;
const POINT_INSET_X = POINT_WIDTH * 0.12;
const POINT_INSET_Z = POINT_WIDTH * 0.16;

const TRIANGLE_BASE_Y_OFFSET = 0.127;
const TRIANGLE_HEIGHT = 0.014;
const TRIANGLE_HALF_BASE = POINT_WIDTH * 0.43;
const TRIANGLE_APEX_LENGTH = BOARD_HALF_Z * 0.73;
const CHIP_RADIUS = POINT_WIDTH * 0.36;
const CHIP_HEIGHT = 0.02;
const CHIP_ROW_SPACING = CHIP_RADIUS * 1.88;
const CHIP_POINT_INSET = POINT_WIDTH * 0.18;
const CHIP_BASE_Y_OFFSET =
  TRIANGLE_BASE_Y_OFFSET + TRIANGLE_HEIGHT + CHIP_HEIGHT * 0.53;

const MODEL_SCALE = 0.75;
const STOOL_SCALE = 1.5 * 1.3;
const SEAT_WIDTH = 0.9 * MODEL_SCALE * STOOL_SCALE;
const SEAT_DEPTH = 0.95 * MODEL_SCALE * STOOL_SCALE;
const SEAT_THICKNESS_SCALED = 0.09 * MODEL_SCALE * STOOL_SCALE;
const BACK_HEIGHT = 0.68 * MODEL_SCALE * STOOL_SCALE;
const BACK_THICKNESS = 0.08 * MODEL_SCALE * STOOL_SCALE;
const ARM_THICKNESS = 0.125 * MODEL_SCALE * STOOL_SCALE;
const ARM_HEIGHT = 0.3 * MODEL_SCALE * STOOL_SCALE;
const ARM_DEPTH = SEAT_DEPTH * 0.75;
const BASE_COLUMN_HEIGHT = 0.5 * MODEL_SCALE * STOOL_SCALE;
const DRACO_DECODER_PATH =
  'https://www.gstatic.com/draco/versioned/decoders/1.5.7/';
const BASIS_TRANSCODER_PATH =
  'https://cdn.jsdelivr.net/npm/three@0.164.0/examples/jsm/libs/basis/';
let sharedKtx2Loader = null;
let hasDetectedKtx2Support = false;
const CHAIR_THEMES = Object.freeze([...TAVULL_BATTLE_CHAIR_OPTIONS]);
const QUALITY_OPTIONS = BACKGAMMON_GRAPHICS;
const MOVE_SOUND_URL = '/assets/sounds/domino-pieces-1-32112 (mp3cut.net).mp3';
const WIN_SOUND_URL =
  'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard/End.mp3';
const DICE_ROLL_SOUND_URL = '/assets/sounds/u_qpfzpydtro-dice-142528.mp3';
const FALLBACK_SEAT_POSITIONS = [
  { left: '15%', top: '87%' },
  { left: '50%', top: '14%' }
];
const BOARD_FRAME_TEXTURE_SIZE = 1024;
const BOARD_FRAME_TEXTURE_REPEAT = [2.2, 2.2];
const BACKGAMMON_DIE_SIZE = 0.116;
const BACKGAMMON_DIE_CORNER_RADIUS = BACKGAMMON_DIE_SIZE * 0.18;
const BACKGAMMON_DIE_PIP_RADIUS = BACKGAMMON_DIE_SIZE * 0.093;
const BACKGAMMON_DIE_PIP_DEPTH = BACKGAMMON_DIE_SIZE * 0.018;
const BACKGAMMON_DIE_PIP_RIM_INNER = BACKGAMMON_DIE_PIP_RADIUS * 0.78;
const BACKGAMMON_DIE_PIP_RIM_OUTER = BACKGAMMON_DIE_PIP_RADIUS * 1.08;
const BACKGAMMON_DIE_PIP_RIM_OFFSET = BACKGAMMON_DIE_SIZE * 0.0048;
const BACKGAMMON_DIE_PIP_SPREAD = BACKGAMMON_DIE_SIZE * 0.3;
const BACKGAMMON_DIE_FACE_INSET = BACKGAMMON_DIE_SIZE * 0.064;

const CHECKERS_CHIP_HEAD_PRESET = Object.freeze({
  roughness: 0.18,
  metalness: 0.35,
  transmission: 0.18,
  ior: 1.6,
  thickness: 0.44
});
const CHECKERS_CHIP_COLORS = Object.freeze({
  [WHITE]: '#ef4444',
  [BLACK]: '#06b6d4'
});

function createCheckerMaterial(sideColor, headPreset) {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(sideColor),
    roughness: headPreset?.roughness ?? 0.08,
    metalness: headPreset?.metalness ?? 0,
    transmission: headPreset?.transmission ?? 0.95,
    ior: headPreset?.ior ?? 1.5,
    thickness: headPreset?.thickness ?? 0.5,
    clearcoat: 0.22,
    clearcoatRoughness: 0.08,
    specularIntensity: 0.9
  });
}

function getDieOrientationQuaternion(val) {
  const orientations = {
    1: new THREE.Euler(0, 0, 0),
    2: new THREE.Euler(-Math.PI / 2, 0, 0),
    3: new THREE.Euler(0, 0, Math.PI / 2),
    4: new THREE.Euler(0, 0, -Math.PI / 2),
    5: new THREE.Euler(Math.PI / 2, 0, 0),
    6: new THREE.Euler(Math.PI, 0, 0)
  };
  return new THREE.Quaternion().setFromEuler(
    orientations[val] || orientations[1]
  );
}

function makeRoyalDie() {
  const die = new THREE.Group();
  const bodyMaterial = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    metalness: 0.25,
    roughness: 0.35,
    clearcoat: 1,
    clearcoatRoughness: 0.15,
    reflectivity: 0.75,
    envMapIntensity: 1.4
  });
  const pipMaterial = new THREE.MeshPhysicalMaterial({
    color: '#0a0a0a',
    roughness: 0.05,
    metalness: 0.6,
    clearcoat: 0.9,
    clearcoatRoughness: 0.04,
    envMapIntensity: 1.1,
    emissive: '#0f172a',
    emissiveIntensity: 0.35
  });
  const rimMaterial = new THREE.MeshPhysicalMaterial({
    color: '#ffd700',
    emissive: '#3a2a00',
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
      BACKGAMMON_DIE_SIZE,
      BACKGAMMON_DIE_SIZE,
      BACKGAMMON_DIE_SIZE,
      6,
      BACKGAMMON_DIE_CORNER_RADIUS
    ),
    bodyMaterial
  );
  body.castShadow = true;
  body.receiveShadow = true;
  die.add(body);

  const pipGeo = new THREE.SphereGeometry(
    BACKGAMMON_DIE_PIP_RADIUS,
    36,
    24,
    0,
    Math.PI * 2,
    0,
    Math.PI
  );
  pipGeo.rotateX(Math.PI);
  pipGeo.computeVertexNormals();
  const pipRimGeo = new THREE.RingGeometry(
    BACKGAMMON_DIE_PIP_RIM_INNER,
    BACKGAMMON_DIE_PIP_RIM_OUTER,
    64
  );
  const faceDepth = BACKGAMMON_DIE_SIZE / 2 - BACKGAMMON_DIE_FACE_INSET * 0.6;
  const spread = BACKGAMMON_DIE_PIP_SPREAD;
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
    const helper =
      Math.abs(n.y) > 0.9
        ? new THREE.Vector3(0, 0, 1)
        : new THREE.Vector3(0, 1, 0);
    const xAxis = new THREE.Vector3().crossVectors(helper, n).normalize();
    const yAxis = new THREE.Vector3().crossVectors(n, xAxis).normalize();
    points.forEach(([gx, gy]) => {
      const base = new THREE.Vector3()
        .addScaledVector(xAxis, gx)
        .addScaledVector(yAxis, gy)
        .addScaledVector(n, faceDepth - BACKGAMMON_DIE_PIP_DEPTH * 0.5);

      const pip = new THREE.Mesh(pipGeo, pipMaterial);
      pip.castShadow = true;
      pip.receiveShadow = true;
      pip.position.copy(base).addScaledVector(n, BACKGAMMON_DIE_PIP_DEPTH);
      pip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
      die.add(pip);

      const rim = new THREE.Mesh(pipRimGeo, rimMaterial);
      rim.receiveShadow = true;
      rim.renderOrder = 6;
      rim.position.copy(base).addScaledVector(n, BACKGAMMON_DIE_PIP_RIM_OFFSET);
      rim.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
      die.add(rim);
    });
  });

  die.visible = false;
  die.userData.setValue = (value) => {
    die.userData.currentValue = value;
    die.quaternion.copy(getDieOrientationQuaternion(value));
  };
  die.userData.setValue(1);
  return die;
}

function ensureKtx2SupportDetection(renderer = null) {
  if (!sharedKtx2Loader || hasDetectedKtx2Support || !renderer) return;
  try {
    sharedKtx2Loader.detectSupport(renderer);
    hasDetectedKtx2Support = true;
  } catch (error) {
    console.warn('Failed to detect KTX2 support for Tavull loader', error);
  }
}

function createConfiguredGLTFLoader(renderer = null, manager) {
  const loader = new GLTFLoader(manager);
  loader.setCrossOrigin?.('anonymous');
  const draco = new DRACOLoader();
  draco.setDecoderPath(DRACO_DECODER_PATH);
  loader.setDRACOLoader(draco);
  loader.setMeshoptDecoder?.(MeshoptDecoder);

  if (!sharedKtx2Loader) {
    sharedKtx2Loader = new KTX2Loader();
    sharedKtx2Loader.setTranscoderPath(BASIS_TRANSCODER_PATH);
  }
  ensureKtx2SupportDetection(renderer);
  loader.setKTX2Loader(sharedKtx2Loader);
  return loader;
}

function createArenaChairFallback(
  chairColor = '#8b1d2c',
  legColor = '#111827'
) {
  const seatMaterial = new THREE.MeshStandardMaterial({
    color: chairColor,
    roughness: 0.42,
    metalness: 0.18
  });
  const legMaterial = new THREE.MeshStandardMaterial({
    color: legColor,
    roughness: 0.55,
    metalness: 0.38
  });
  const chair = new THREE.Group();
  const seatMesh = new THREE.Mesh(
    new THREE.BoxGeometry(SEAT_WIDTH, SEAT_THICKNESS_SCALED, SEAT_DEPTH),
    seatMaterial
  );
  seatMesh.position.y = SEAT_THICKNESS_SCALED / 2;
  const backMesh = new THREE.Mesh(
    new THREE.BoxGeometry(SEAT_WIDTH * 0.96, BACK_HEIGHT, BACK_THICKNESS),
    seatMaterial
  );
  backMesh.position.set(
    0,
    SEAT_THICKNESS_SCALED / 2 + BACK_HEIGHT / 2,
    -SEAT_DEPTH / 2 + BACK_THICKNESS / 2
  );
  const armGeometry = new THREE.BoxGeometry(
    ARM_THICKNESS,
    ARM_HEIGHT,
    ARM_DEPTH
  );
  const armOffsetX = SEAT_WIDTH / 2 - ARM_THICKNESS / 2;
  const armOffsetY = SEAT_THICKNESS_SCALED / 2 + ARM_HEIGHT / 2;
  const armOffsetZ = -ARM_DEPTH / 2 + ARM_THICKNESS * 0.2;
  const leftArm = new THREE.Mesh(armGeometry, seatMaterial);
  leftArm.position.set(-armOffsetX, armOffsetY, armOffsetZ);
  const rightArm = new THREE.Mesh(armGeometry, seatMaterial);
  rightArm.position.set(armOffsetX, armOffsetY, armOffsetZ);
  const legMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.16 * MODEL_SCALE * STOOL_SCALE,
      0.2 * MODEL_SCALE * STOOL_SCALE,
      BASE_COLUMN_HEIGHT,
      18
    ),
    legMaterial
  );
  legMesh.position.y = -SEAT_THICKNESS_SCALED / 2 - BASE_COLUMN_HEIGHT / 2;
  const foot = new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.32 * MODEL_SCALE * STOOL_SCALE,
      0.32 * MODEL_SCALE * STOOL_SCALE,
      0.08 * MODEL_SCALE,
      24
    ),
    legMaterial
  );
  foot.position.y =
    legMesh.position.y - BASE_COLUMN_HEIGHT / 2 - 0.04 * MODEL_SCALE;
  [seatMesh, backMesh, leftArm, rightArm, legMesh, foot].forEach((mesh) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    chair.add(mesh);
  });
  return chair;
}

const pointColumnFromEdge = (x) => {
  const laneInnerEdge = BOARD_HALF_X - BOARD_EDGE_MARGIN_X;
  const distanceFromEdge = laneInnerEdge - Math.abs(x);
  return Math.max(
    0,
    Math.min(POINT_COLUMNS - 1, Math.round(distanceFromEdge / POINT_WIDTH))
  );
};

const pointBasePosition = (index) => {
  const rightLaneOuterX =
    BOARD_HALF_X - BOARD_EDGE_MARGIN_X - POINT_WIDTH * 0.5 - POINT_INSET_X;
  const rightLaneInnerX =
    CENTER_BAR_WIDTH * 0.5 + POINT_WIDTH * 0.5 + POINT_INSET_X;
  const leftLaneInnerX = -rightLaneInnerX;
  const leftLaneOuterX = -rightLaneOuterX;

  const laneStep =
    (rightLaneOuterX - rightLaneInnerX) / Math.max(1, POINT_COLUMNS - 1);
  const bottomLane = [
    ...Array.from(
      { length: POINT_COLUMNS },
      (_, col) => rightLaneOuterX - col * laneStep
    ),
    ...Array.from(
      { length: POINT_COLUMNS },
      (_, col) => leftLaneInnerX - col * laneStep
    )
  ];

  if (index <= 11) {
    return {
      x: bottomLane[index],
      z: BOARD_HALF_Z - BOARD_EDGE_MARGIN_Z - POINT_INSET_Z,
      top: false
    };
  }
  const i = 23 - index;
  return {
    x: bottomLane[i],
    z: -BOARD_HALF_Z + BOARD_EDGE_MARGIN_Z + POINT_INSET_Z,
    top: true
  };
};

const checkerPosition = (point, slot, color) => {
  if (point === 'bar')
    return new THREE.Vector3(
      0,
      BOARD_Y + CHIP_BASE_Y_OFFSET + Math.floor(slot / 5) * CHIP_HEIGHT * 1.5,
      (color === WHITE ? 1 : -1) * (0.24 + (slot % 5) * 0.12)
    );
  if (point === 'off')
    return new THREE.Vector3(
      BOARD_HALF_X + 0.16,
      BOARD_Y + CHIP_BASE_Y_OFFSET + Math.floor(slot / 5) * CHIP_HEIGHT * 1.5,
      (color === WHITE ? 1 : -1) * (0.22 + (slot % 5) * 0.13)
    );
  const base = pointBasePosition(point);
  return new THREE.Vector3(
    base.x,
    BOARD_Y + CHIP_BASE_Y_OFFSET + Math.floor(slot / 5) * CHIP_HEIGHT * 1.5,
    base.z +
      (base.top ? 1 : -1) * (CHIP_POINT_INSET + (slot % 5) * CHIP_ROW_SPACING)
  );
};

export default function TavullBattleRoyal() {
  useTelegramBackButton();
  if (
    !BACKGAMMON_ONLINE_READY &&
    new URLSearchParams(window.location.search).get('mode') === 'online'
  )
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950 p-6 text-center text-white">
        <p>{BACKGAMMON_ONLINE_MESSAGE}</p>
        <a
          className="rounded-xl border border-white/30 p-3"
          href="/games/tavullbattleroyal/lobby"
        >
          Back to lobby
        </a>
      </div>
    );
  const localSide =
    new URLSearchParams(window.location.search).get('preferredSide') === BLACK
      ? BLACK
      : WHITE;
  return <BackgammonGame localSide={localSide} />;
}

const humanModels = createSeatedHumanModelLibrary({
  createLoader: createConfiguredGLTFLoader,
  targetHeight: BACKGAMMON_HUMAN_HEIGHT,
  visualScaleMultiplier: 1
});

// Shared by the production route and the portrait preview.
export function BackgammonGame({ preview = false, localSide = WHITE } = {}) {
  const aiSide = localSide === WHITE ? BLACK : WHITE;
  const canvasHostRef = useRef(null);
  const sceneBundleRef = useRef(null);

  const [configOpen, setConfigOpen] = useState(false);
  const [viewMode, setViewMode] = useState('3d');
  const [tableFinishIdx, setTableFinishIdx] = useState(0);
  const [chairThemeIdx, setChairThemeIdx] = useState(0);
  const [hdriIdx, setHdriIdx] = useState(0);
  const [boardFinishIdx, setBoardFinishIdx] = useState(0);
  const [frameFinishIdx, setFrameFinishIdx] = useState(0);
  const [triangleColorIdx, setTriangleColorIdx] = useState(0);
  const [qualityIdx, setQualityIdx] = useState(readBackgammonGraphics);
  const [tableModelIdx, setTableModelIdx] = useState(0);
  const [humanIdx, setHumanIdx] = useState(0);
  const [assetStatus, setAssetStatus] = useState('');
  const [humanStatus, setHumanStatus] = useState('loading');
  const [moveChoices, setMoveChoices] = useState([]);
  const [activeCustomizationKey, setActiveCustomizationKey] =
    useState('tableFinish');
  const [showChat, setShowChat] = useState(false);
  const [showGift, setShowGift] = useState(false);
  const [chatBubbles, setChatBubbles] = useState([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [inventoryVersion, setInventoryVersion] = useState(0);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const accountId = tavullBattleAccountId(
    (() => {
      try {
        return localStorage.getItem('accountId');
      } catch {
        return '';
      }
    })()
  );
  const tavullInventory = useMemo(
    () => getTavullBattleInventory(accountId),
    [accountId, inventoryVersion]
  );
  const playerName = getTelegramFirstName() || 'Player';
  const playerAvatar = getTelegramPhotoUrl();

  const playSfx = (url, volumeScale = 1) => {
    if (preview || isGameMuted() || !soundEnabled) return;
    try {
      const audio = new Audio(url);
      audio.volume = Math.min(1, getGameVolume() * volumeScale);
      void audio.play().catch(() => {});
    } catch {
      /* Audio is optional. */
    }
  };
  const controller = useBackgammonMatch(
    sceneBundleRef,
    (kind) =>
      playSfx(
        kind === 'dice'
          ? DICE_ROLL_SOUND_URL
          : kind === 'win'
            ? WIN_SOUND_URL
            : MOVE_SOUND_URL
      ),
    localSide
  );
  const { match, busy, message, roll } = controller;
  const game = match.board;
  const winner = match.result?.winner;
  const aiThinking = match.turn === aiSide && !winner;
  const available =
    !busy && match.turn === localSide && match.phase === 'move'
      ? match.sequences
      : [];
  const firstMoves = legalFirstMoves({ ...match, sequences: available });
  const humanInventory = useMemo(
    () => getChessBattleInventory(accountId),
    [accountId, inventoryVersion]
  );
  const humanOptions = useMemo(
    () =>
      CHESS_HUMAN_CHARACTER_OPTIONS.filter(
        (option, index) =>
          index === 0 ||
          isChessOptionUnlocked('humanCharacter', option.id, humanInventory)
      ),
    [humanInventory]
  );
  const tableOptions = BATTLE_ROYALE_SHARED_TABLE_THEME_OPTIONS;

  const players = [
    {
      index: 0,
      id: 'self-player',
      name: playerName,
      photoUrl: playerAvatar || '/assets/icons/profile.svg',
      color: localSide,
      isTurn: !aiThinking && !winner
    },
    {
      index: 1,
      id: 'ai-royal',
      name: 'AI Royal',
      photoUrl: '/assets/icons/profile.svg',
      color: aiSide,
      isTurn: aiThinking
    }
  ];

  const ownedChairOptions = CHAIR_THEMES;
  const ownedHdriOptions = useMemo(() => {
    const customVariants = getCustomHdriVariantsForGame(
      'tavullbattleroyal',
      accountId
    );
    return [...POOL_ROYALE_HDRI_VARIANTS, ...customVariants].filter(
      (option) =>
        !option.isCustomUpload ||
        isTavullOptionUnlocked('environmentHdri', option.id, tavullInventory)
    );
  }, [accountId, tavullInventory]);
  const ownedFinishOptions = useMemo(
    () =>
      MURLAN_TABLE_FINISHES.filter((option) =>
        isTavullOptionUnlocked('tableFinish', option.id, tavullInventory)
      ),
    [tavullInventory]
  );
  const ownedBoardFinishOptions = useMemo(
    () =>
      TAVULL_BATTLE_BOARD_FINISH_OPTIONS.filter((option) =>
        isTavullOptionUnlocked('boardFinish', option.id, tavullInventory)
      ),
    [tavullInventory]
  );
  const ownedFrameFinishOptions = useMemo(
    () =>
      TAVULL_BATTLE_FRAME_FINISH_OPTIONS.filter((option) =>
        isTavullOptionUnlocked('frameFinish', option.id, tavullInventory)
      ),
    [tavullInventory]
  );
  const ownedTriangleColorOptions = useMemo(
    () =>
      TAVULL_BATTLE_TRIANGLE_COLOR_OPTIONS.filter((option) =>
        isTavullOptionUnlocked('triangleColor', option.id, tavullInventory)
      ),
    [tavullInventory]
  );

  const customizationSections = useMemo(
    () =>
      [
        {
          key: 'tables',
          label: 'Table Model',
          options: tableOptions,
          selectedIdx: tableModelIdx,
          setSelectedIdx: setTableModelIdx
        },
        {
          key: 'humanCharacter',
          label: 'Characters',
          options: humanOptions,
          selectedIdx: humanIdx,
          setSelectedIdx: setHumanIdx
        },
        {
          key: 'tableFinish',
          label: 'Table Finish',
          options: ownedFinishOptions,
          selectedIdx: tableFinishIdx,
          setSelectedIdx: setTableFinishIdx
        },
        {
          key: 'chairColor',
          label: 'Chairs',
          options: ownedChairOptions,
          selectedIdx: chairThemeIdx,
          setSelectedIdx: setChairThemeIdx
        },
        {
          key: 'boardFinish',
          label: 'Board Finish',
          options: ownedBoardFinishOptions,
          selectedIdx: boardFinishIdx,
          setSelectedIdx: setBoardFinishIdx
        },
        {
          key: 'frameFinish',
          label: 'Frame Finish',
          options: ownedFrameFinishOptions,
          selectedIdx: frameFinishIdx,
          setSelectedIdx: setFrameFinishIdx
        },
        {
          key: 'triangleColor',
          label: 'Triangles',
          options: ownedTriangleColorOptions,
          selectedIdx: triangleColorIdx,
          setSelectedIdx: setTriangleColorIdx
        },
        {
          key: 'environmentHdri',
          label: 'HDR Environment',
          options: ownedHdriOptions,
          selectedIdx: hdriIdx,
          setSelectedIdx: setHdriIdx
        }
      ].filter(
        (section) =>
          !preview ||
          ['boardFinish', 'frameFinish', 'triangleColor'].includes(section.key)
      ),
    [
      preview,
      tableModelIdx,
      humanIdx,
      humanOptions,
      ownedFinishOptions,
      tableFinishIdx,
      ownedChairOptions,
      chairThemeIdx,
      ownedBoardFinishOptions,
      boardFinishIdx,
      ownedFrameFinishOptions,
      frameFinishIdx,
      ownedTriangleColorOptions,
      triangleColorIdx,
      ownedHdriOptions,
      hdriIdx
    ]
  );
  const activeCustomizationSection = useMemo(
    () =>
      customizationSections.find(({ key }) => key === activeCustomizationKey) ||
      customizationSections[0] ||
      null,
    [activeCustomizationKey, customizationSections]
  );

  const renderCustomizationPreview = useCallback(
    (option) => {
      if (!option) return null;
      if (option.thumbnail && !preview) {
        return (
          <span className="relative flex h-16 w-full items-center justify-center overflow-hidden rounded-xl border border-white/20 bg-black/20">
            <img
              src={option.thumbnail}
              alt={option.label || option.name || 'Option thumbnail'}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </span>
        );
      }
      const swatches =
        Array.isArray(option.swatches) && option.swatches.length >= 2
          ? option.swatches
          : [
              option.dark || option.primary || '#7c5e45',
              option.light || option.accent || '#3f2e23'
            ];
      return (
        <span
          className="h-16 w-full rounded-xl border border-white/20"
          style={{
            background: `linear-gradient(135deg, ${swatches[0]}, ${swatches[1]})`
          }}
        />
      );
    },
    [preview]
  );

  useEffect(() => {
    const onInventoryUpdate = () => setInventoryVersion((v) => v + 1);
    window.addEventListener('tavullBattleInventoryUpdate', onInventoryUpdate);
    return () =>
      window.removeEventListener(
        'tavullBattleInventoryUpdate',
        onInventoryUpdate
      );
  }, []);

  useEffect(() => {
    if (!ownedFinishOptions.length) return;
    if (!ownedFinishOptions[tableFinishIdx]) setTableFinishIdx(0);
  }, [ownedFinishOptions, tableFinishIdx]);

  useEffect(() => {
    if (!ownedChairOptions.length) return;
    if (!ownedChairOptions[chairThemeIdx]) setChairThemeIdx(0);
  }, [ownedChairOptions, chairThemeIdx]);

  useEffect(() => {
    if (!ownedHdriOptions.length) return;
    if (!ownedHdriOptions[hdriIdx]) setHdriIdx(0);
  }, [ownedHdriOptions, hdriIdx]);
  useEffect(() => {
    if (!ownedBoardFinishOptions.length) return;
    if (!ownedBoardFinishOptions[boardFinishIdx]) setBoardFinishIdx(0);
  }, [ownedBoardFinishOptions, boardFinishIdx]);
  useEffect(() => {
    if (!ownedFrameFinishOptions.length) return;
    if (!ownedFrameFinishOptions[frameFinishIdx]) setFrameFinishIdx(0);
  }, [ownedFrameFinishOptions, frameFinishIdx]);
  useEffect(() => {
    if (!ownedTriangleColorOptions.length) return;
    if (!ownedTriangleColorOptions[triangleColorIdx]) setTriangleColorIdx(0);
  }, [ownedTriangleColorOptions, triangleColorIdx]);

  useEffect(() => {
    if (!canvasHostRef.current) return undefined;

    const host = canvasHostRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#090f1f');

    const camera = new THREE.PerspectiveCamera(
      42,
      host.clientWidth / host.clientHeight,
      0.1,
      120
    );

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    applyRendererSRGB(renderer);
    const initialQuality = QUALITY_OPTIONS[qualityIdx] || QUALITY_OPTIONS[1];
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, initialQuality.pixelRatioCap) *
        initialQuality.renderScale
    );
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    host.appendChild(renderer.domElement);

    let disposed = false;
    let currentMode = viewMode;
    let activeQuality = QUALITY_OPTIONS[qualityIdx] || QUALITY_OPTIONS[0];
    let actors = [];
    let humanRequest = 0;
    let pendingHumans = null;
    let action = null;
    let renderedBoard = null;
    let boardWaiters = [];
    const cameraTarget = new THREE.Vector3();
    const applyViewMode = (mode) => {
      currentMode = mode;
      applyBackgammonCamera(camera, mode, cameraTarget);
      actors.forEach((actor) => setBackgammonView(actor, mode));
    };
    applyViewMode(viewMode);
    const loadHumans = async (option) => {
      const request = ++humanRequest;
      setHumanStatus('loading');
      const results = await Promise.allSettled(
        [
          option || CHESS_HUMAN_CHARACTER_OPTIONS[0],
          CHESS_HUMAN_CHARACTER_OPTIONS[0]
        ].map((choice) =>
          humanModels.loadSeatedHumanTemplate(choice, renderer, 2)
        )
      );
      if (disposed || request !== humanRequest) return;
      const install = () => {
        if (disposed || request !== humanRequest) return;
        results.forEach((result, index) => {
          if (result.status !== 'fulfilled') return;
          const actor = createBackgammonActor(
            result.value,
            index ? 'top' : 'bottom'
          );
          if (actors[index]) disposeBackgammonActor(actors[index]);
          actors[index] = actor;
          setBackgammonView(actor, currentMode);
          scene.add(actor.root);
        });
        setHumanStatus(
          results.every((result) => result.status === 'fulfilled')
            ? 'ready'
            : 'error'
        );
      };
      if (action) pendingHumans = install;
      else install();
    };

    scene.add(new THREE.AmbientLight('#ffffff', 0.5));
    const key = new THREE.DirectionalLight('#ffffff', 1.15);
    key.position.set(5, 8, 3);
    key.castShadow = true;
    scene.add(key);

    const fill = new THREE.PointLight('#6ec4ff', 0.7, 30);
    fill.position.set(-4, 4.5, -3);
    scene.add(fill);

    const environment = createBackgammonEnvironment({
      scene,
      renderer,
      createLoader: createConfiguredGLTFLoader,
      fallbackChair: createArenaChairFallback,
      tableRadius: TABLE_RADIUS,
      tableHeight: TABLE_HEIGHT,
      chairDistance: CHAIR_DISTANCE,
      seatY: BACKGAMMON_SEAT_Y,
      status: (text) => {
        if (!disposed) setAssetStatus(text);
      }
    });

    const boardRoot = new THREE.Group();
    scene.add(boardRoot);

    const createCanvasTexture = (drawFn, repeat = [1, 1]) => {
      const canvas = document.createElement('canvas');
      canvas.width = BOARD_FRAME_TEXTURE_SIZE;
      canvas.height = BOARD_FRAME_TEXTURE_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      drawFn(ctx, canvas.width, canvas.height);
      const texture = new THREE.CanvasTexture(canvas);
      applySRGBColorSpace(texture);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(repeat[0], repeat[1]);
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy?.() || 1;
      texture.needsUpdate = true;
      return texture;
    };
    const boardLaneTexture = createCanvasTexture((ctx, width, height) => {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#f8ebd2');
      grad.addColorStop(0.5, '#e2cfa8');
      grad.addColorStop(1, '#d6ba8d');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = 'rgba(103,61,31,0.22)';
      ctx.lineWidth = 2;
      for (let y = 0; y <= height; y += 28) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }, BOARD_FRAME_TEXTURE_REPEAT);
    const frameTexture = createCanvasTexture((ctx, width, height) => {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#6e3a22');
      grad.addColorStop(0.45, '#5c2e1a');
      grad.addColorStop(1, '#472211');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1.6;
      for (let x = 8; x < width; x += 22) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x - 36, height);
        ctx.stroke();
      }
    }, BOARD_FRAME_TEXTURE_REPEAT);
    const triangleTexture = createCanvasTexture(
      (ctx, width, height) => {
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(1, '#c7d2fe');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = 'rgba(15,23,42,0.26)';
        ctx.lineWidth = 2;
        for (let x = 0; x <= width; x += 30) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x - 16, height);
          ctx.stroke();
        }
      },
      [1.2, 3.2]
    );

    const woodMaterial = new THREE.MeshStandardMaterial({
      color: '#7b4127',
      map: frameTexture || null,
      roughness: 0.52,
      metalness: 0.14
    });
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: '#5d2e1b',
      map: frameTexture || null,
      roughness: 0.48,
      metalness: 0.22
    });
    const boardSurfaceMaterial = new THREE.MeshStandardMaterial({
      color: '#f0dfbf',
      map: boardLaneTexture || null,
      roughness: 0.74,
      metalness: 0.02
    });
    const pointDarkMaterial = new THREE.MeshStandardMaterial({
      color: '#08080b',
      map: triangleTexture || null,
      roughness: 0.66,
      metalness: 0.08
    });
    const pointLightMaterial = new THREE.MeshStandardMaterial({
      color: '#f4f1e8',
      map: triangleTexture || null,
      roughness: 0.7,
      metalness: 0.04
    });
    const applyFinishToMaterial = (material, finish, fallback = '#7b4127') => {
      const [primary] = finish?.swatches || [];
      material.color.set(primary || fallback);
      if (material.map) material.map.needsUpdate = true;
      material.needsUpdate = true;
    };
    const applyTrianglePalette = (palette) => {
      pointDarkMaterial.color.set(palette?.dark || '#f59e0b');
      pointLightMaterial.color.set(palette?.light || '#fef3c7');
      pointDarkMaterial.needsUpdate = true;
      pointLightMaterial.needsUpdate = true;
    };

    const boardBase = new THREE.Mesh(
      new THREE.BoxGeometry(
        BOARD_HALF_X * 2,
        BOARD_BASE_THICKNESS,
        BOARD_HALF_Z * 2
      ),
      woodMaterial
    );
    boardBase.position.y = BOARD_Y;
    boardRoot.add(boardBase);

    const frameOuter = new THREE.Mesh(
      new THREE.BoxGeometry(
        BOARD_HALF_X * 1.98,
        FRAME_THICKNESS,
        BOARD_HALF_Z * 1.98
      ),
      frameMaterial
    );
    frameOuter.position.y = BOARD_Y + BOARD_BASE_THICKNESS * 0.52;
    boardRoot.add(frameOuter);

    const laneWidth =
      BOARD_HALF_X - CENTER_BAR_WIDTH * 0.5 - BOARD_EDGE_MARGIN_X;
    const laneDepth = BOARD_HALF_Z * 2 - BOARD_EDGE_MARGIN_Z * 2;
    const laneOffset = CENTER_BAR_WIDTH * 0.5 + laneWidth * 0.5;
    [-1, 1].forEach((side) => {
      const lane = new THREE.Mesh(
        new THREE.BoxGeometry(laneWidth, LANE_THICKNESS, laneDepth),
        boardSurfaceMaterial
      );
      lane.position.set(
        side * laneOffset,
        BOARD_Y + BOARD_BASE_THICKNESS * 0.62,
        0
      );
      boardRoot.add(lane);
    });

    const centerBar = new THREE.Mesh(
      new THREE.BoxGeometry(
        CENTER_BAR_WIDTH,
        CENTER_BAR_THICKNESS,
        BOARD_HALF_Z * 2 - BOARD_EDGE_MARGIN_Z * 2
      ),
      boardSurfaceMaterial
    );
    centerBar.position.y = BOARD_Y + BOARD_BASE_THICKNESS * 0.64;
    boardRoot.add(centerBar);

    const hinge = new THREE.Mesh(
      new THREE.BoxGeometry(0.022, 0.09, BOARD_HALF_Z * 0.25),
      new THREE.MeshStandardMaterial({
        color: '#a9b0ba',
        roughness: 0.3,
        metalness: 0.92
      })
    );
    hinge.position.set(0, BOARD_Y + 0.165, 0);
    boardRoot.add(hinge);

    const makeTriangle = (x, top, dark) => {
      const baseZ = top
        ? -BOARD_HALF_Z + BOARD_EDGE_MARGIN_Z
        : BOARD_HALF_Z - BOARD_EDGE_MARGIN_Z;
      const apexZ = top
        ? baseZ + TRIANGLE_APEX_LENGTH
        : baseZ - TRIANGLE_APEX_LENGTH;
      const shape = new THREE.Shape();
      shape.moveTo(-TRIANGLE_HALF_BASE, -baseZ);
      shape.lineTo(TRIANGLE_HALF_BASE, -baseZ);
      shape.lineTo(0, -apexZ);
      shape.closePath();
      const geom = new THREE.ExtrudeGeometry(shape, {
        depth: TRIANGLE_HEIGHT,
        bevelEnabled: false
      });
      geom.rotateX(-Math.PI / 2);
      const tri = new THREE.Mesh(
        geom,
        dark ? pointDarkMaterial : pointLightMaterial
      );
      tri.position.set(x, BOARD_Y + TRIANGLE_BASE_Y_OFFSET, 0);
      boardRoot.add(tri);
    };

    for (let i = 0; i < 24; i += 1) {
      const p = pointBasePosition(i);
      makeTriangle(p.x, p.top, pointColumnFromEdge(p.x) % 2 === 0);
    }
    applyFinishToMaterial(
      boardSurfaceMaterial,
      ownedBoardFinishOptions[boardFinishIdx] || ownedBoardFinishOptions[0],
      '#f0dfbf'
    );
    applyFinishToMaterial(
      frameMaterial,
      ownedFrameFinishOptions[frameFinishIdx] || ownedFrameFinishOptions[0],
      '#5d2e1b'
    );
    applyTrianglePalette(
      ownedTriangleColorOptions[triangleColorIdx] ||
        ownedTriangleColorOptions[0]
    );

    for (const sign of [-1, 1]) {
      const tray = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, 0.055, 0.86),
        frameMaterial
      );
      tray.position.set(BOARD_HALF_X + 0.16, BOARD_Y + 0.112, sign * 0.49);
      boardRoot.add(tray);
    }
    const chipGroup = new THREE.Group();
    scene.add(chipGroup);
    const diceGroup = new THREE.Group();
    scene.add(diceGroup);
    const markerGroup = new THREE.Group();
    scene.add(markerGroup);
    const maxDice = 2;

    const diceMeshes = Array.from({ length: maxDice }, () => {
      const mesh = makeRoyalDie();
      diceGroup.add(mesh);
      return mesh;
    });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const boardPlane = new THREE.Plane(
      new THREE.Vector3(0, 1, 0),
      -(BOARD_Y + 0.16)
    );
    const hitPoint = new THREE.Vector3();
    const resolveNearestPoint = (x, z) => {
      if (Math.abs(z) > BOARD_HALF_Z + 0.12) return null;
      if (Math.abs(x) < CENTER_BAR_WIDTH * 0.85) return 'bar';
      if (x > BOARD_HALF_X && x < BOARD_HALF_X + 0.36 && z >= 0) return 'off';
      if (Math.abs(x) > BOARD_HALF_X) return null;
      let nearest = null,
        distance = Infinity;
      for (let i = z >= 0 ? 0 : 12; i < (z >= 0 ? 12 : 24); i++) {
        const delta = Math.abs(x - pointBasePosition(i).x);
        if (delta < distance) {
          distance = delta;
          nearest = i;
        }
      }
      return nearest;
    };
    let pointerStart = null;
    const onPointerDown = (event) => {
      pointerStart = {
        x: event.clientX,
        y: event.clientY,
        id: event.pointerId
      };
    };
    const onBoardTap = (event) => {
      if (
        !pointerStart ||
        event.pointerId !== pointerStart.id ||
        Math.hypot(
          event.clientX - pointerStart.x,
          event.clientY - pointerStart.y
        ) > 10
      ) {
        pointerStart = null;
        return;
      }
      pointerStart = null;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      // Resolve the actual checker before falling back to the whole triangle.
      const hit = raycaster.intersectObjects(chipGroup.children, true)[0];
      let selected = hit?.object;
      while (selected && selected.userData.point === undefined)
        selected = selected.parent;
      let nearest = selected?.userData.point;
      if (
        nearest === undefined &&
        raycaster.ray.intersectPlane(boardPlane, hitPoint)
      )
        nearest = resolveNearestPoint(hitPoint.x, hitPoint.z);
      if (nearest == null) return;
      window.dispatchEvent(
        new CustomEvent('tavullPointTap', { detail: { point: nearest } })
      );
    };
    const onPointerCancel = () => {
      pointerStart = null;
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onBoardTap);
    renderer.domElement.addEventListener('pointercancel', onPointerCancel);

    const resize = () => {
      if (!host) return;
      const width = host.clientWidth;
      const height = host.clientHeight;
      camera.aspect = width / height;
      applyViewMode(currentMode);
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', resize);

    const runAction = (update) =>
      new Promise((resolve) => {
        if (action || disposed) {
          resolve(false);
          return;
        }
        action = { update, resolve };
      });
    const cancelActions = () => {
      action?.resolve(false);
      action = null;
      boardWaiters.splice(0).forEach((waiter) => waiter.resolve(false));
      actors.forEach(idleBackgammonActor);
    };
    let raf = 0,
      lastRender = -Infinity;
    const tick = (now = performance.now()) => {
      if (action?.update(now)) {
        const complete = action;
        action = null;
        complete.resolve(true);
      }
      if (!action && pendingHumans) {
        const install = pendingHumans;
        pendingHumans = null;
        install();
      }
      if (!action) actors.forEach(idleBackgammonActor);
      const interval = 1000 / activeQuality.fps;
      if (now - lastRender >= interval - 0.2) {
        renderer.render(scene, camera);
        lastRender = now - ((now - lastRender) % interval || 0);
        if (!Number.isFinite(lastRender)) lastRender = now;
      }
      raf = window.requestAnimationFrame(tick);
    };
    tick();

    sceneBundleRef.current = {
      scene,
      camera,
      renderer,
      chipGroup,
      markerGroup,
      loadHumans,
      cancelActions,
      waitForBoard: (board) =>
        renderedBoard === board
          ? Promise.resolve(true)
          : new Promise((resolve) => boardWaiters.push({ board, resolve })),
      didRenderBoard: (board) => {
        renderedBoard = board;
        boardWaiters = boardWaiters.filter((waiter) => {
          if (waiter.board !== board) return true;
          waiter.resolve(true);
          return false;
        });
      },
      animateCheckerMove: (state, color, move) => {
        const mesh = chipGroup.children
          .filter(
            (child) =>
              child.userData.point === move.from &&
              child.userData.color === color
          )
          .at(-1);
        if (!mesh) return Promise.resolve(false);
        const targetSlot =
          move.to === 'off'
            ? state.off[color]
            : state.points[move.to].color === color
              ? state.points[move.to].count
              : 0;
        const from = mesh.position.clone(),
          to = checkerPosition(move.to, targetSlot, color);
        const motion = {
          mesh,
          from,
          to,
          gripHeight: CHIP_HEIGHT * 0.6,
          gripRadius: CHIP_RADIUS * 0.9,
          fromCell: {
            r: (from.z / BOARD_HALF_Z + 1) * 3.5,
            c: (from.x / BOARD_HALF_X + 1) * 3.5
          },
          toCell: {
            r: (to.z / BOARD_HALF_Z + 1) * 3.5,
            c: (to.x / BOARD_HALF_X + 1) * 3.5
          }
        };
        const victim = chipGroup.children.find(
          (child) =>
            child.userData.point === move.to && child.userData.color !== color
        );
        const start = performance.now();
        return runAction((now) => {
          const progress = Math.min(
            1,
            (now - start) / PHYSICAL_MOVE_DURATION_MS
          );
          const frame = updateBackgammonChecker(
            actors[color === localSide ? 0 : 1],
            motion,
            progress
          );
          if (victim && progress >= 0.82) victim.visible = false;
          return frame.done;
        });
      },
      animateDiceThrow: async (values, seat, indices = [0, 1]) => {
        const selected = values.map((value, i) => diceMeshes[indices[i]]);
        // Dice begin where they last landed, so a hand actually retrieves them.
        selected.forEach((mesh, i) => {
          if (!mesh.visible) {
            mesh.position.set(
              0.4 + i * 0.15,
              BOARD_Y + 0.18,
              seat ? -0.12 : 0.12
            );
            mesh.visible = true;
          }
        });
        if (
          selected.length === 2 &&
          selected[0].position.distanceTo(selected[1].position) > 0.22
        ) {
          const mesh = selected[1],
            from = mesh.position.clone(),
            to = selected[0].position
              .clone()
              .add(new THREE.Vector3(0.15, 0, 0));
          const gather = {
            mesh,
            from,
            to,
            gripHeight: BACKGAMMON_DIE_SIZE * 0.3,
            gripRadius: BACKGAMMON_DIE_SIZE * 0.46,
            fromCell: { r: 3.5, c: 3.5 },
            toCell: { r: 3.5, c: 3.5 }
          };
          const gatherStart = performance.now();
          const completed = await runAction(
            (now) =>
              updateBackgammonChecker(
                actors[seat],
                gather,
                Math.min(1, (now - gatherStart) / PHYSICAL_MOVE_DURATION_MS)
              ).done
          );
          if (!completed || disposed) return false;
        }
        const destinations = selected.map(
          (_, index) =>
            new THREE.Vector3(
              seat ? -0.43 - index * 0.16 : 0.43 + index * 0.16,
              BOARD_Y + 0.18,
              0
            )
        );
        const motion = createBackgammonDiceAction(
          actors[seat],
          selected,
          destinations,
          values.map(getDieOrientationQuaternion),
          performance.now()
        );
        return runAction((now) => motion.update(now));
      },
      applyViewMode,
      applyTableModel: (option, finish) =>
        environment.table(option, finish, activeQuality.resolutions),
      applyTableFinish: (idx) =>
        environment.finish(
          MURLAN_TABLE_FINISHES[idx] || MURLAN_TABLE_FINISHES[0]
        ),
      applyHdri: (option) =>
        environment.hdri(option, activeQuality.resolutions),
      applyBoardFinish: (idx) =>
        applyFinishToMaterial(
          boardSurfaceMaterial,
          TAVULL_BATTLE_BOARD_FINISH_OPTIONS[idx] ||
            TAVULL_BATTLE_BOARD_FINISH_OPTIONS[0],
          '#f0dfbf'
        ),
      applyFrameFinish: (idx) =>
        applyFinishToMaterial(
          frameMaterial,
          TAVULL_BATTLE_FRAME_FINISH_OPTIONS[idx] ||
            TAVULL_BATTLE_FRAME_FINISH_OPTIONS[0],
          '#5d2e1b'
        ),
      applyTriangleColor: (idx) =>
        applyTrianglePalette(
          TAVULL_BATTLE_TRIANGLE_COLOR_OPTIONS[idx] ||
            TAVULL_BATTLE_TRIANGLE_COLOR_OPTIONS[0]
        ),
      applyQuality: (idx) => {
        activeQuality = QUALITY_OPTIONS[idx] || QUALITY_OPTIONS[0];
        renderer.setPixelRatio(
          Math.min(window.devicePixelRatio || 1, activeQuality.pixelRatioCap) *
            activeQuality.renderScale
        );
        renderer.setSize(host.clientWidth, host.clientHeight);
      },
      applyChairs: (option) =>
        environment.chairs(option, activeQuality.resolutions)
    };

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      disposed = true;
      humanRequest++;
      pendingHumans = null;
      cancelActions();
      actors.forEach(disposeBackgammonActor);
      actors = [];
      environment.dispose();
      [boardRoot, chipGroup, markerGroup, diceGroup].forEach(
        disposeBackgammonObject
      );
      renderer.dispose();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onBoardTap);
      renderer.domElement.removeEventListener('pointercancel', onPointerCancel);
      if (host.contains(renderer.domElement))
        host.removeChild(renderer.domElement);
      sceneBundleRef.current = null;
    };
  }, []);

  useEffect(() => {
    const bundle = sceneBundleRef.current;
    if (!bundle?.applyViewMode) return;
    bundle.applyViewMode(viewMode);
  }, [viewMode]);

  useEffect(() => {
    const bundle = sceneBundleRef.current;
    if (!bundle?.applyTableFinish) return;
    const selected =
      ownedFinishOptions[tableFinishIdx] || ownedFinishOptions[0];
    const globalIdx = MURLAN_TABLE_FINISHES.findIndex(
      (option) => option.id === selected?.id
    );
    bundle.applyTableFinish(globalIdx >= 0 ? globalIdx : 0);
  }, [tableFinishIdx, ownedFinishOptions]);

  useEffect(() => {
    const bundle = sceneBundleRef.current;
    if (!bundle?.applyHdri) return;
    const selected = ownedHdriOptions[hdriIdx] || ownedHdriOptions[0];
    bundle.applyQuality(qualityIdx);
    bundle.applyHdri(selected);
  }, [hdriIdx, ownedHdriOptions, qualityIdx]);
  useEffect(() => {
    sceneBundleRef.current?.loadHumans(humanOptions[humanIdx]);
  }, [humanIdx, humanOptions]);
  useEffect(() => {
    sceneBundleRef.current?.applyTableModel(
      tableOptions[tableModelIdx],
      ownedFinishOptions[tableFinishIdx] || MURLAN_TABLE_FINISHES[0]
    );
  }, [tableModelIdx, qualityIdx]);
  useEffect(() => {
    const bundle = sceneBundleRef.current;
    if (!bundle?.applyBoardFinish) return;
    const selected =
      ownedBoardFinishOptions[boardFinishIdx] || ownedBoardFinishOptions[0];
    const globalIdx = TAVULL_BATTLE_BOARD_FINISH_OPTIONS.findIndex(
      (option) => option.id === selected?.id
    );
    bundle.applyBoardFinish(globalIdx >= 0 ? globalIdx : 0);
  }, [boardFinishIdx, ownedBoardFinishOptions]);
  useEffect(() => {
    const bundle = sceneBundleRef.current;
    if (!bundle?.applyFrameFinish) return;
    const selected =
      ownedFrameFinishOptions[frameFinishIdx] || ownedFrameFinishOptions[0];
    const globalIdx = TAVULL_BATTLE_FRAME_FINISH_OPTIONS.findIndex(
      (option) => option.id === selected?.id
    );
    bundle.applyFrameFinish(globalIdx >= 0 ? globalIdx : 0);
  }, [frameFinishIdx, ownedFrameFinishOptions]);
  useEffect(() => {
    const bundle = sceneBundleRef.current;
    if (!bundle?.applyTriangleColor) return;
    const selected =
      ownedTriangleColorOptions[triangleColorIdx] ||
      ownedTriangleColorOptions[0];
    const globalIdx = TAVULL_BATTLE_TRIANGLE_COLOR_OPTIONS.findIndex(
      (option) => option.id === selected?.id
    );
    bundle.applyTriangleColor(globalIdx >= 0 ? globalIdx : 0);
  }, [triangleColorIdx, ownedTriangleColorOptions]);

  useEffect(() => {
    const bundle = sceneBundleRef.current;
    if (!bundle?.applyQuality) return;
    bundle.applyQuality(qualityIdx);
    try {
      localStorage.setItem(
        BACKGAMMON_GRAPHICS_KEY,
        QUALITY_OPTIONS[qualityIdx].id
      );
    } catch {
      /* Session setting still works. */
    }
  }, [qualityIdx]);

  useEffect(() => {
    const bundle = sceneBundleRef.current;
    if (!bundle?.applyChairs) return;
    const selected = ownedChairOptions[chairThemeIdx] || ownedChairOptions[0];
    void bundle.applyChairs(selected);
  }, [chairThemeIdx, ownedChairOptions, qualityIdx]);

  useEffect(() => {
    const bundle = sceneBundleRef.current;
    if (!bundle) return;
    const { chipGroup } = bundle;
    // A committed board owns its piece meshes. Selection changes only markers,
    // and cannot destroy a checker while a hand is carrying it.
    chipGroup.children.slice().forEach(disposeBackgammonObject);

    const createChip = (color) => {
      const pieceGroup = new THREE.Group();
      const sideColor =
        CHECKERS_CHIP_COLORS[color] || CHECKERS_CHIP_COLORS[WHITE];
      const baseMaterial = createCheckerMaterial(
        sideColor,
        CHECKERS_CHIP_HEAD_PRESET
      );

      const chip = new THREE.Mesh(
        new THREE.CylinderGeometry(
          CHIP_RADIUS,
          CHIP_RADIUS * 0.94,
          CHIP_HEIGHT,
          56,
          1,
          false
        ),
        baseMaterial
      );
      chip.castShadow = true;
      chip.receiveShadow = true;
      pieceGroup.add(chip);

      const topCap = new THREE.Mesh(
        new THREE.CylinderGeometry(
          CHIP_RADIUS * 0.74,
          CHIP_RADIUS * 0.81,
          CHIP_HEIGHT * 0.42,
          48
        ),
        baseMaterial.clone()
      );
      topCap.position.y = CHIP_HEIGHT * 0.56;
      topCap.castShadow = true;
      topCap.receiveShadow = true;
      pieceGroup.add(topCap);

      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(CHIP_RADIUS * 0.7, CHIP_RADIUS * 0.064, 16, 64),
        new THREE.MeshStandardMaterial({
          color: '#f8fafc',
          metalness: 0.88,
          roughness: 0.25,
          transparent: true,
          opacity: 0.85
        })
      );
      rim.rotation.x = Math.PI / 2;
      rim.position.y = CHIP_HEIGHT * 0.64;
      pieceGroup.add(rim);

      return pieceGroup;
    };

    for (let i = 0; i < 24; i++) {
      const point = game.points[i];
      for (let slot = 0; slot < point.count; slot++) {
        const chip = createChip(point.color);
        chip.userData = { point: i, color: point.color };
        chip.position.copy(checkerPosition(i, slot, point.color));
        chipGroup.add(chip);
      }
    }
    for (const color of [WHITE, BLACK])
      for (const location of ['bar', 'off']) {
        for (let slot = 0; slot < game[location][color]; slot++) {
          const chip = createChip(color);
          chip.userData = { point: location, color };
          chip.position.copy(checkerPosition(location, slot, color));
          chipGroup.add(chip);
        }
      }
    bundle.didRenderBoard(game);
  }, [game]);

  useEffect(() => {
    const root = sceneBundleRef.current?.markerGroup;
    if (!root) return;
    root.children.slice().forEach(disposeBackgammonObject);
    const sources = new Set(firstMoves.map((move) => move.from));
    const destinations = new Set(
      firstMoves
        .filter((move) => move.from === selectedPoint)
        .map((move) => move.to)
    );
    for (const [locations, destination] of [
      [sources, false],
      [destinations, true]
    ])
      for (const point of locations) {
        const slot =
          point === 'bar'
            ? Math.max(0, game.bar[localSide] - 1)
            : point === 'off'
              ? game.off[localSide]
              : Math.max(
                  0,
                  (game.points[point].color === localSide
                    ? game.points[point].count
                    : 0) - (destination ? 0 : 1)
                );
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(CHIP_RADIUS * 1.2, 0.009, 8, 32),
          new THREE.MeshBasicMaterial({
            color: destination ? '#fbbf24' : '#22d3ee',
            depthTest: false
          })
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.copy(checkerPosition(point, slot, localSide));
        ring.position.y += 0.025;
        ring.renderOrder = 10;
        root.add(ring);
      }
  }, [game, busy, match, selectedPoint]);

  useEffect(() => {
    if (busy || match.turn !== localSide || match.phase !== 'move') {
      setSelectedPoint(null);
      setMoveChoices([]);
      return;
    }
    const onPointTap = (event) => {
      const point = event.detail.point;
      const choices = firstMoves.filter(
        (move) => move.from === selectedPoint && move.to === point
      );
      if (choices.length === 1) {
        setSelectedPoint(null);
        void controller.move(choices[0]);
      } else if (choices.length > 1) setMoveChoices(choices);
      else if (firstMoves.some((move) => move.from === point)) {
        setSelectedPoint(point);
        setMoveChoices([]);
      }
    };
    window.addEventListener('tavullPointTap', onPointTap);
    return () => window.removeEventListener('tavullPointTap', onPointTap);
  }, [match, busy, selectedPoint]);

  return (
    <div
      data-backgammon-phase={match.phase}
      className="fixed inset-0 bg-[#060b16] px-3 py-3 text-white touch-none select-none"
    >
      {message ? (
        <div className="pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2 px-4">
          <div
            role="status"
            aria-live="polite"
            className="max-w-[90vw] rounded-full border border-white/15 bg-black/55 px-4 py-2 text-center text-xs font-semibold text-white/90 shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur"
          >
            {message}
          </div>
        </div>
      ) : null}

      <div className="absolute top-16 left-3 z-20 flex flex-col items-start gap-3 pointer-events-none">
        <button
          type="button"
          onClick={() => setConfigOpen((open) => !open)}
          aria-expanded={configOpen}
          aria-label={configOpen ? 'Close game menu' : 'Open game menu'}
          className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-gray-100 shadow-[0_6px_18px_rgba(2,6,23,0.45)] transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <span className="text-base leading-none" aria-hidden="true">
            ☰
          </span>
          <span className="leading-none">Menu</span>
        </button>
      </div>

      <div className="absolute top-16 right-3 z-20 flex flex-col items-end gap-3 pointer-events-none">
        <div className="pointer-events-auto flex flex-col items-end gap-3">
          <button
            type="button"
            onClick={() => setViewMode((mode) => (mode === '3d' ? '2d' : '3d'))}
            className="icon-only-button flex h-10 w-10 items-center justify-center text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-white/90 transition-opacity duration-200 hover:text-white focus:outline-none"
          >
            {viewMode === '3d' ? '2D' : '3D'}
          </button>
          <BottomLeftIcons
            showInfo={false}
            showChat={false}
            showGift={false}
            className="flex flex-col"
            buttonClassName="icon-only-button pointer-events-auto flex h-10 w-10 items-center justify-center text-white/90 transition-opacity duration-200 hover:text-white focus:outline-none"
            iconClassName="text-[1.5rem] leading-none"
            labelClassName="sr-only"
            muteIconOn="🔇"
            muteIconOff="🔊"
            order={['mute']}
          />
        </div>
      </div>

      {configOpen && (
        <div className="absolute top-16 right-3 z-30 pointer-events-auto mt-2 w-72 max-w-[80vw] rounded-2xl border border-white/15 bg-black/80 p-4 text-xs text-white shadow-2xl backdrop-blur max-h-[80vh] overflow-y-auto pr-1">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.4em] text-sky-200/80">
                Backgammon Settings
              </p>
              <p className="mt-1 text-[0.7rem] text-white/70">
                Personalize board finish, frame, triangle colors, chairs, and
                table finish.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setConfigOpen(false)}
              className="rounded-full p-1 text-white/70 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              aria-label="Close settings"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-4 w-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m6 6 12 12M18 6 6 18"
                />
              </svg>
            </button>
          </div>
          <div className="mt-4 space-y-3">
            <label className="flex items-center justify-between text-[0.7rem] text-gray-200">
              <span>Sound effects</span>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border border-emerald-400/40 bg-transparent text-emerald-400 focus:ring-emerald-500"
                checked={soundEnabled}
                onChange={(event) => setSoundEnabled(event.target.checked)}
              />
            </label>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.35em] text-white/70">
                    Personalize Arena
                  </p>
                  <p className="mt-1 text-[0.7rem] text-white/60">
                    Table cloth, chairs, and table details.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTableFinishIdx(0);
                    setChairThemeIdx(0);
                    setHdriIdx(0);
                    setBoardFinishIdx(0);
                    setFrameFinishIdx(0);
                    setTriangleColorIdx(0);
                    setQualityIdx(0);
                    setTableModelIdx(0);
                    setHumanIdx(0);
                  }}
                  className="rounded-lg border border-white/15 px-2 py-1 text-[0.65rem] font-semibold text-white/80 transition hover:border-white/30 hover:text-white"
                >
                  Reset
                </button>
              </div>
              <div className="mt-3 max-h-72 space-y-3">
                <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 px-1">
                  {customizationSections.map(({ key, label }) => {
                    const selectedSection = key === activeCustomizationKey;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setActiveCustomizationKey(key)}
                        className={`whitespace-nowrap rounded-full border px-3 py-2 text-[0.7rem] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                          selectedSection
                            ? 'border-sky-400/70 bg-sky-500/10 text-white shadow-[0_0_12px_rgba(56,189,248,0.35)]'
                            : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:text-white'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                {activeCustomizationSection && (
                  <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-white/60">
                      {activeCustomizationSection.label}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {activeCustomizationSection.options.map((option, idx) => {
                        const selected =
                          activeCustomizationSection.selectedIdx === idx;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() =>
                              activeCustomizationSection.setSelectedIdx(idx)
                            }
                            disabled={
                              ['tables', 'chairColor'].includes(
                                activeCustomizationSection.key
                              ) &&
                              idx !== 0 &&
                              !isTavullOptionUnlocked(
                                activeCustomizationSection.key,
                                option.id,
                                tavullInventory
                              )
                            }
                            aria-pressed={selected}
                            className={`flex flex-col items-center rounded-2xl border p-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                              selected
                                ? 'border-sky-400/80 bg-sky-400/10 shadow-[0_0_12px_rgba(56,189,248,0.35)]'
                                : 'border-white/10 bg-white/5 hover:border-white/20'
                            }`}
                          >
                            {renderCustomizationPreview(option)}
                            <span className="mt-1 text-center text-[0.6rem] font-semibold text-gray-100">
                              {option.label || option.name || 'Option'}
                              {['tables', 'chairColor'].includes(
                                activeCustomizationSection.key
                              ) &&
                              idx !== 0 &&
                              !isTavullOptionUnlocked(
                                activeCustomizationSection.key,
                                option.id,
                                tavullInventory
                              )
                                ? ' · Store'
                                : ''}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="space-y-2" aria-label="Graphics settings">
                  <p className="font-semibold">Graphics</p>
                  {QUALITY_OPTIONS.map((quality, idx) => (
                    <button
                      key={quality.id}
                      type="button"
                      aria-pressed={qualityIdx === idx}
                      onClick={() => setQualityIdx(idx)}
                      className={`min-h-11 w-full rounded-xl border px-3 py-2 text-left ${qualityIdx === idx ? 'border-sky-300 bg-sky-300/15' : 'border-white/15 bg-white/5'}`}
                    >
                      <span className="block font-semibold">
                        {quality.label}
                      </span>
                      <span className="block text-white/70">
                        {quality.resolutions[0].toUpperCase()} HDRI · up to{' '}
                        {quality.fps} FPS
                      </span>
                    </button>
                  ))}
                </div>
                {assetStatus && <p role="status">{assetStatus}</p>}
                {humanStatus === 'error' && (
                  <button
                    type="button"
                    onClick={() =>
                      sceneBundleRef.current?.loadHumans(humanOptions[humanIdx])
                    }
                  >
                    Retry characters
                  </button>
                )}
                <label className="block">
                  New match length
                  <select
                    className="mt-1 min-h-11 w-full rounded bg-slate-900 p-2 text-base"
                    value={match.target}
                    onChange={(event) =>
                      controller.restart(Number(event.target.value))
                    }
                    disabled={busy}
                  >
                    {[1, 3, 5, 7].map((target) => (
                      <option key={target} value={target}>
                        {target} point{target === 1 ? '' : 's'}
                      </option>
                    ))}
                  </select>
                </label>
                <details>
                  <summary className="min-h-11 cursor-pointer py-2">
                    Backgammon rules
                  </summary>
                  <p>
                    One opening die each; ties reroll. Move toward your home
                    board. Enter all barred checkers first. Use both dice, or
                    the higher die when only one can be used. Doubles give four
                    moves. Bear off only with every active checker at home;
                    oversized dice may remove only your farthest checker. A
                    single wins the cube value, a gammon twice, a backgammon
                    three times. Double before rolling; the taker owns the cube,
                    a drop loses the old cube value. The first one-away game
                    uses the Crawford rule. Automatic doubles, beavers and
                    Jacoby are not used in match play.
                  </p>
                </details>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="absolute inset-0 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
        <div ref={canvasHostRef} className="h-full w-full" />
      </div>

      <div className="absolute bottom-[max(70px,env(safe-area-inset-bottom))] left-1/2 z-20 flex w-[94%] max-w-sm -translate-x-1/2 flex-col items-center gap-2 rounded-2xl bg-black/65 p-3 text-sm">
        <div className="flex w-full justify-between gap-2 text-xs">
          <span>
            You {match.score[localSide]} · {pipCount(game, localSide)} pips
          </span>
          <span>To {match.target}</span>
          <span>
            AI {match.score[aiSide]} · {pipCount(game, aiSide)} pips
          </span>
        </div>
        <div className="text-xs text-sky-100">
          Cube ×{match.cube.value} ·{' '}
          {match.crawford
            ? 'Crawford game'
            : match.cube.owner === null
              ? 'Centered'
              : match.cube.owner === localSide
                ? 'Yours'
                : 'AI owns cube'}{' '}
          · Off {game.off[localSide]}/15 : {game.off[aiSide]}/15
        </div>
        {match.dice.length > 0 && (
          <div aria-label="Remaining dice">Dice: {match.dice.join(' · ')}</div>
        )}
        {humanStatus === 'loading' && (
          <span className="text-xs">Loading players…</span>
        )}
        {humanStatus === 'error' && (
          <button
            type="button"
            className="min-h-11"
            onClick={() =>
              sceneBundleRef.current?.loadHumans(humanOptions[humanIdx])
            }
          >
            Retry loading players
          </button>
        )}
        {!winner && ['opening', 'roll'].includes(match.phase) && (
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={roll}
              disabled={busy || aiThinking || humanStatus !== 'ready'}
              className="min-h-11 rounded-xl border border-white/30 px-4 py-2 font-semibold disabled:opacity-40"
            >
              {match.phase === 'opening' ? 'Opening roll' : 'Roll dice'}
            </button>
            {canDouble(match, localSide) && (
              <button
                type="button"
                disabled={busy}
                onClick={controller.double}
                className="min-h-11 rounded-xl border border-white/30 px-3"
              >
                Double
              </button>
            )}
          </div>
        )}
        {!busy && match.phase === 'move' && match.turn === localSide && (
          <div className="flex flex-wrap justify-center gap-2">
            {game.bar[localSide] > 0 && (
              <button
                type="button"
                onClick={() => setSelectedPoint('bar')}
                className="min-h-11 rounded-xl border border-cyan-300 px-3"
              >
                Enter from bar ({game.bar[localSide]})
              </button>
            )}
            {firstMoves.some(
              (move) => move.from === selectedPoint && move.to === 'off'
            ) && (
              <button
                type="button"
                onClick={() => {
                  const choices = firstMoves.filter(
                    (move) => move.from === selectedPoint && move.to === 'off'
                  );
                  if (choices.length === 1) void controller.move(choices[0]);
                  else setMoveChoices(choices);
                }}
                className="min-h-11 rounded-xl border border-amber-300 px-3"
              >
                Bear off
              </button>
            )}
            {moveChoices.map((move) => (
              <button
                type="button"
                key={move.die}
                onClick={() => {
                  setMoveChoices([]);
                  void controller.move(move);
                }}
                className="min-h-11 rounded-xl border border-white/30 px-3"
              >
                Use {move.die}
              </button>
            ))}
            <details className="w-full">
              <summary className="cursor-pointer py-2 text-center">
                Legal moves
              </summary>
              <div className="flex max-h-32 flex-wrap gap-2 overflow-auto">
                {firstMoves.map((move) => (
                  <button
                    type="button"
                    key={`${move.from}/${move.to}/${move.die}`}
                    className="min-h-11 rounded-lg border border-white/20 px-2"
                    onClick={() => controller.move(move)}
                  >
                    {move.from === 'bar' ? 'Bar' : move.from + 1} →{' '}
                    {move.to === 'off' ? 'Off' : move.to + 1} ({move.die})
                  </button>
                ))}
              </div>
            </details>
          </div>
        )}
        {match.phase === 'double' && match.offeredBy === aiSide && (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => controller.respond(true)}
              className="min-h-11 rounded-xl border border-sky-300 px-4"
            >
              Take ×{match.cube.value * 2}
            </button>
            <button
              type="button"
              onClick={() => controller.respond(false)}
              className="min-h-11 rounded-xl border border-white/30 px-4"
            >
              Drop
            </button>
          </div>
        )}
        {winner && (
          <button
            type="button"
            onClick={() =>
              Math.max(match.score.white, match.score.black) >= match.target
                ? controller.restart()
                : controller.continueMatch()
            }
            className="min-h-11 rounded-xl border border-sky-300 px-4"
          >
            {Math.max(match.score.white, match.score.black) >= match.target
              ? 'New match'
              : 'Next game'}
          </button>
        )}
      </div>

      <div className="pointer-events-auto">
        <BottomLeftIcons
          onGift={() => setShowGift(true)}
          showInfo={false}
          showChat={false}
          showMute={false}
          className="fixed right-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-50 flex flex-col gap-4"
          buttonClassName="icon-only-button pointer-events-auto flex h-11 w-11 items-center justify-center text-white/90 transition-opacity duration-200 hover:text-white focus:outline-none"
          iconClassName="text-[1.65rem] leading-none"
          labelClassName="sr-only"
          giftIcon="🎁"
          order={['gift']}
        />
        <BottomLeftIcons
          onChat={() => setShowChat(true)}
          showInfo={false}
          showGift={false}
          showMute={false}
          className="fixed left-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-50 flex flex-col"
          buttonClassName="icon-only-button pointer-events-auto flex h-11 w-11 items-center justify-center text-white/90 transition-opacity duration-200 hover:text-white focus:outline-none"
          iconClassName="text-[1.65rem] leading-none"
          labelClassName="sr-only"
          chatIcon="💬"
          order={['chat']}
        />
      </div>

      {chatBubbles.map((bubble) => (
        <div key={bubble.id} className="chat-bubble chess-battle-chat-bubble">
          <span>{bubble.text}</span>
          <img
            src={bubble.photoUrl}
            alt="avatar"
            className="w-5 h-5 rounded-full"
          />
        </div>
      ))}

      <QuickMessagePopup
        open={showChat}
        onClose={() => setShowChat(false)}
        title="Quick Chat"
        onSend={(text) => {
          const id = Date.now();
          setChatBubbles((bubbles) => [
            ...bubbles,
            { id, text, photoUrl: playerAvatar || '/assets/icons/profile.svg' }
          ]);
          setTimeout(
            () =>
              setChatBubbles((bubbles) =>
                bubbles.filter((bubble) => bubble.id !== id)
              ),
            3000
          );
        }}
      />

      <GiftPopup
        open={showGift}
        onClose={() => setShowGift(false)}
        players={players}
        senderIndex={0}
      />

      <div className="absolute inset-0 z-10 pointer-events-none">
        {players
          .filter((player) => player.index === 1)
          .map((player) => {
            const fallback =
              FALLBACK_SEAT_POSITIONS[player.index] ||
              FALLBACK_SEAT_POSITIONS[0];
            const positionStyle = {
              position: 'absolute',
              left: fallback.left,
              top: fallback.top,
              transform: 'translate(-50%, -50%)'
            };
            return (
              <div
                key={`backgammon-seat-${player.index}`}
                className="absolute pointer-events-auto flex flex-col items-center"
                style={positionStyle}
              >
                <AvatarTimer
                  index={player.index}
                  photoUrl={player.photoUrl}
                  active={player.isTurn}
                  isTurn={player.isTurn}
                  timerPct={1}
                  name={player.name}
                  color={player.color}
                  size={1}
                />
                <span className="mt-1 text-[0.65rem] font-semibold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">
                  {player.name}
                </span>
                {player.index === 1 && winner && (
                  <span
                    className="mt-0.5 max-w-[120px] text-center text-[0.52rem] font-semibold leading-[1.2] text-white/90 drop-shadow-[0_2px_6px_rgba(0,0,0,0.75)]"
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}
                  >
                    {winner === localSide ? 'You win!' : 'AI wins!'}
                  </span>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
