import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { GroundedSkybox } from 'three/examples/jsm/objects/GroundedSkybox.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { ARENA_CAMERA_DEFAULTS } from '../../utils/arenaCameraConfig.js';
import {
  createMurlanStyleTable,
  applyTableMaterials
} from '../../utils/murlanTable.js';
import {
  FOUR_IN_ROW_CHAIR_OPTIONS,
  FOUR_IN_ROW_BOARD_THEMES,
  FOUR_IN_ROW_BOARD_FINISH_OPTIONS,
  FOUR_IN_ROW_BOARD_FRAME_FINISH_OPTIONS,
  FOUR_IN_ROW_RING_FINISH_OPTIONS,
  FOUR_IN_ROW_STONE_STYLES,
  FOUR_IN_ROW_TABLE_OPTIONS,
  FOUR_IN_ROW_BATTLE_DEFAULT_LOADOUT,
  FOUR_IN_ROW_BOARD_LAYOUTS,
  FOUR_IN_ROW_BATTLE_OPTION_LABELS
} from '../../config/fourInRowInventoryConfig.js';
import {
  POOL_ROYALE_DEFAULT_HDRI_ID,
  POOL_ROYALE_HDRI_VARIANTS,
  POOL_ROYALE_HDRI_VARIANT_MAP
} from '../../config/poolRoyaleInventoryConfig.js';
import { MURLAN_TABLE_FINISHES } from '../../config/murlanTableFinishes.js';
import {
  applyWoodTextures,
  DEFAULT_WOOD_GRAIN_ID,
  WOOD_FINISH_PRESETS,
  WOOD_GRAIN_OPTIONS_BY_ID
} from '../../utils/woodMaterials.js';
import {
  getTelegramPhotoUrl,
  getTelegramUsername
} from '../../utils/telegram.js';
import BottomLeftIcons from '../../components/BottomLeftIcons.jsx';
import AvatarTimer from '../../components/AvatarTimer.jsx';
import GiftPopup from '../../components/GiftPopup.jsx';
import QuickMessagePopup from '../../components/QuickMessagePopup.jsx';
import {
  fourInRowAccountId,
  getFourInRowInventory
} from '../../utils/fourInRowInventory.js';
import { applyRendererSRGB } from '../../utils/colorSpace.js';

const MODEL_SCALE = 0.75;
const TABLE_AND_CHAIR_SCALE = 0.245; // 50% smaller than the current table/chair sizing.
const BOARD_AND_CHIPS_SCALE = 0.35; // 50% smaller than the current board + chip props.
const CAMERA_FRAME_MATCH_SCALE = 0.7; // Move camera in to keep the previous framing.
const ARENA_VISUAL_SCALE = 0.82;
const TABLE_RADIUS = 3.4 * MODEL_SCALE * TABLE_AND_CHAIR_SCALE;
const TABLE_HEIGHT = 1.2;
const DEFAULT_GROUNDED_CAMERA_HEIGHT = 1.45;
const CHAIR_GAP = 1.3 * TABLE_AND_CHAIR_SCALE;
const CHAIR_DISTANCE = TABLE_RADIUS + CHAIR_GAP;
const CAMERA_RADIUS_COMPENSATION =
  (3.4 * MODEL_SCALE + 1.3 - CHAIR_DISTANCE) * CAMERA_FRAME_MATCH_SCALE;
const BOARD_TABLE_CLEARANCE = 0.2 * BOARD_AND_CHIPS_SCALE;
const BOARD_VERTICAL_LIFT = 0.06 * BOARD_AND_CHIPS_SCALE;
const INTRO_MESSAGE_DURATION_MS = 2200;
const BOARD_BASE_THICKNESS = 0.12 * BOARD_AND_CHIPS_SCALE;
const BOARD_FRAME_THICKNESS = 0.12 * BOARD_AND_CHIPS_SCALE;
const BOARD_FACE_THICKNESS = 0.028 * BOARD_AND_CHIPS_SCALE;
const BOARD_SLOT_GAP = 0.15 * BOARD_AND_CHIPS_SCALE;
const BOARD_FRAME_DEPTH = BOARD_SLOT_GAP + BOARD_FACE_THICKNESS * 2 + 0.08;
const BOARD_FRAME_CENTER_Z = 0;
const CONNECT4_WOOD = '#4b2b1f';
const CONNECT4_WOOD_DARK = '#2d170f';
const CONNECT4_PANEL = '#efe9d5';
const CONNECT4_RED = '#e3342f';
const CONNECT4_BLUE = '#2d79d8';
const DROP_PREVIEW_DELAY = 0.09;
const DROP_BASE_DURATION = 0.2;
const DROP_ROW_DURATION_STEP = 0.03;
const DRACO_DECODER_PATH = 'https://www.gstatic.com/draco/v1/decoders/';
const TARGET_CHAIR_SIZE = new THREE.Vector3(
  1.3162499970197679 * TABLE_AND_CHAIR_SCALE,
  1.9173749900311232 * TABLE_AND_CHAIR_SCALE,
  1.7001562547683715 * TABLE_AND_CHAIR_SCALE
);

const GRAPHICS_PRESETS = Object.freeze([
  {
    id: 'balanced',
    label: 'Balanced',
    pixelRatioScale: 1,
    shadowMapSize: 1024
  },
  {
    id: 'performance',
    label: 'Performance',
    pixelRatioScale: 0.85,
    shadowMapSize: 512
  },
  {
    id: 'cinematic',
    label: 'Cinematic',
    pixelRatioScale: 1.4,
    shadowMapSize: 2048
  }
]);

const createBoard = (rows, cols) =>
  Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));
const cloneBoard = (board) => board.map((row) => [...row]);
const isFull = (board) => board.every((row) => row.every(Boolean));

const getDropRow = (board, col) => {
  for (let r = board.length - 1; r >= 0; r -= 1) {
    if (!board[r][col]) return r;
  }
  return -1;
};

const getWinningCells = (board, token) => {
  const rows = board.length;
  const cols = board[0].length;
  const dirs = [
    [0, 1],
    [1, 0],
    [1, 1],
    [-1, 1]
  ];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (board[r][c] !== token) continue;
      for (const [dr, dc] of dirs) {
        const cells = [[r, c]];
        let ok = true;
        for (let i = 1; i < 4; i += 1) {
          const nr = r + dr * i;
          const nc = c + dc * i;
          if (
            nr < 0 ||
            nr >= rows ||
            nc < 0 ||
            nc >= cols ||
            board[nr][nc] !== token
          ) {
            ok = false;
            break;
          }
          cells.push([nr, nc]);
        }
        if (ok) return cells;
      }
    }
  }
  return null;
};

const checkWinner = (board, token) => Boolean(getWinningCells(board, token));

const evaluateWindow = (window, aiToken, playerToken) => {
  const aiCount = window.filter((v) => v === aiToken).length;
  const playerCount = window.filter((v) => v === playerToken).length;
  const empty = window.filter((v) => !v).length;
  if (aiCount === 4) return 1000;
  if (aiCount === 3 && empty === 1) return 25;
  if (aiCount === 2 && empty === 2) return 6;
  if (playerCount === 3 && empty === 1) return -35;
  return 0;
};

const scorePosition = (board, aiToken, playerToken) => {
  const rows = board.length;
  const cols = board[0].length;
  let score = 0;
  const centerCol = Math.floor(cols / 2);
  for (let r = 0; r < rows; r += 1) {
    if (board[r][centerCol] === aiToken) score += 3;
  }
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols - 3; c += 1)
      score += evaluateWindow(
        [board[r][c], board[r][c + 1], board[r][c + 2], board[r][c + 3]],
        aiToken,
        playerToken
      );
  }
  for (let c = 0; c < cols; c += 1) {
    for (let r = 0; r < rows - 3; r += 1)
      score += evaluateWindow(
        [board[r][c], board[r + 1][c], board[r + 2][c], board[r + 3][c]],
        aiToken,
        playerToken
      );
  }
  for (let r = 0; r < rows - 3; r += 1) {
    for (let c = 0; c < cols - 3; c += 1)
      score += evaluateWindow(
        [
          board[r][c],
          board[r + 1][c + 1],
          board[r + 2][c + 2],
          board[r + 3][c + 3]
        ],
        aiToken,
        playerToken
      );
  }
  for (let r = 3; r < rows; r += 1) {
    for (let c = 0; c < cols - 3; c += 1)
      score += evaluateWindow(
        [
          board[r][c],
          board[r - 1][c + 1],
          board[r - 2][c + 2],
          board[r - 3][c + 3]
        ],
        aiToken,
        playerToken
      );
  }
  return score;
};

const minimax = (
  board,
  depth,
  alpha,
  beta,
  maximizing,
  aiToken,
  playerToken
) => {
  const cols = board[0].length;
  const validCols = Array.from({ length: cols }, (_, i) => i).filter(
    (col) => getDropRow(board, col) >= 0
  );
  const terminal =
    checkWinner(board, aiToken) ||
    checkWinner(board, playerToken) ||
    validCols.length === 0;
  if (depth === 0 || terminal) {
    if (checkWinner(board, aiToken)) return { score: 1_000_000 };
    if (checkWinner(board, playerToken)) return { score: -1_000_000 };
    if (validCols.length === 0) return { score: 0 };
    return { score: scorePosition(board, aiToken, playerToken) };
  }

  if (maximizing) {
    let best = { col: validCols[0], score: -Infinity };
    for (const col of validCols) {
      const row = getDropRow(board, col);
      const next = cloneBoard(board);
      next[row][col] = aiToken;
      const val = minimax(
        next,
        depth - 1,
        alpha,
        beta,
        false,
        aiToken,
        playerToken
      ).score;
      if (val > best.score) best = { col, score: val };
      alpha = Math.max(alpha, val);
      if (alpha >= beta) break;
    }
    return best;
  }

  let best = { col: validCols[0], score: Infinity };
  for (const col of validCols) {
    const row = getDropRow(board, col);
    const next = cloneBoard(board);
    next[row][col] = playerToken;
    const val = minimax(
      next,
      depth - 1,
      alpha,
      beta,
      true,
      aiToken,
      playerToken
    ).score;
    if (val < best.score) best = { col, score: val };
    beta = Math.min(beta, val);
    if (alpha >= beta) break;
  }
  return best;
};

const chooseAiMove = (board, aiToken, playerToken, depth) => {
  const cols = board[0].length;
  const validCols = Array.from({ length: cols }, (_, i) => i).filter(
    (col) => getDropRow(board, col) >= 0
  );
  if (!validCols.length) return null;

  for (const col of validCols) {
    const row = getDropRow(board, col);
    const next = cloneBoard(board);
    next[row][col] = aiToken;
    if (checkWinner(next, aiToken)) return col;
  }

  for (const col of validCols) {
    const row = getDropRow(board, col);
    const next = cloneBoard(board);
    next[row][col] = playerToken;
    if (checkWinner(next, playerToken)) return col;
  }

  const ordered = [...validCols].sort(
    (a, b) => Math.abs(a - cols / 2) - Math.abs(b - cols / 2)
  );
  const { col } = minimax(
    board,
    depth,
    -Infinity,
    Infinity,
    true,
    aiToken,
    playerToken
  );
  return Number.isInteger(col) ? col : ordered[0];
};

async function resolveHdriUrl(variant) {
  const fallbackRes = variant?.maxResolution || '2k';
  const fallback = `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/${fallbackRes}/${variant?.assetId || 'colorful_studio'}_${fallbackRes}.hdr`;
  if (!variant?.assetId) return fallback;
  try {
    const res = await fetch(
      `https://api.polyhaven.com/files/${variant.assetId}`
    );
    if (!res.ok) return fallback;
    const data = await res.json();
    return (
      data?.exr?.[fallbackRes]?.url || data?.hdr?.[fallbackRes]?.url || fallback
    );
  } catch {
    return fallback;
  }
}

function createChair(chairColor = '#7f1d1d', legColor = '#111827') {
  const group = new THREE.Group();
  const seat = new THREE.Mesh(
    new THREE.BoxGeometry(0.85, 0.09, 0.92),
    new THREE.MeshStandardMaterial({ color: chairColor, roughness: 0.5 })
  );
  seat.position.y = TABLE_HEIGHT - 0.05;
  group.add(seat);
  const legGeo = new THREE.CylinderGeometry(0.045, 0.05, TABLE_HEIGHT, 20);
  const legMat = new THREE.MeshStandardMaterial({
    color: legColor,
    metalness: 0.35,
    roughness: 0.45
  });
  [
    [-0.3, TABLE_HEIGHT / 2, -0.3],
    [0.3, TABLE_HEIGHT / 2, -0.3],
    [-0.3, TABLE_HEIGHT / 2, 0.3],
    [0.3, TABLE_HEIGHT / 2, 0.3]
  ].forEach(([x, y, z]) => {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(x, y, z);
    group.add(leg);
  });
  return group;
}

function createConfiguredGLTFLoader() {
  const loader = new GLTFLoader();
  loader.setCrossOrigin('anonymous');
  const draco = new DRACOLoader();
  draco.setDecoderPath(DRACO_DECODER_PATH);
  loader.setDRACOLoader(draco);
  return loader;
}

function fitChairModelToFootprint(model) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const targetMax = Math.max(
    TARGET_CHAIR_SIZE.x,
    TARGET_CHAIR_SIZE.y,
    TARGET_CHAIR_SIZE.z
  );
  const currentMax = Math.max(size.x, size.y, size.z);
  if (currentMax > 0) {
    const scale = targetMax / currentMax;
    model.scale.multiplyScalar(scale);
  }
  const scaledBox = new THREE.Box3().setFromObject(model);
  const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
  const offset = new THREE.Vector3(
    -scaledCenter.x,
    -scaledBox.min.y,
    -scaledCenter.z
  );
  model.position.add(offset);
}

function preserveOriginalGltfTextureMapping(model) {
  if (!model) return;
  model.traverse((obj) => {
    if (!obj?.isMesh) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach((mat) => {
      if (!mat) return;
      const textureSlots = [
        'map',
        'normalMap',
        'roughnessMap',
        'metalnessMap',
        'emissiveMap',
        'aoMap',
        'alphaMap'
      ];
      textureSlots.forEach((slot) => {
        const tex = mat[slot];
        if (!tex) return;
        tex.flipY = false;
        tex.needsUpdate = true;
      });
      mat.needsUpdate = true;
    });
  });
}

function tintChairModel(model, chairTheme) {
  const seatColor = chairTheme?.seatColor || chairTheme?.primary || '#7f1d1d';
  const legColor = chairTheme?.legColor || '#111827';
  model.traverse((obj) => {
    if (!obj.isMesh) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach((mat) => {
      if (!mat?.color) return;
      const targetColor = (mat.metalness ?? 0) > 0.35 ? legColor : seatColor;
      mat.color.set(targetColor);
      mat.needsUpdate = true;
    });
  });
}

function buildPolyhavenModelUrls(assetId) {
  if (!assetId) return [];
  const id = assetId.trim();
  const lower = id.toLowerCase();
  return [
    `https://dl.polyhaven.org/file/ph-assets/Models/gltf/2k/${id}/${id}_2k.gltf`,
    `https://dl.polyhaven.org/file/ph-assets/Models/gltf/2k/${lower}/${lower}_2k.gltf`,
    `https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/${id}/${id}_1k.gltf`,
    `https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/${lower}/${lower}_1k.gltf`
  ];
}

async function createChairModel(chairTheme) {
  if (chairTheme?.source === 'polyhaven' && chairTheme?.assetId) {
    const loader = createConfiguredGLTFLoader();
    const urls = buildPolyhavenModelUrls(chairTheme.assetId);
    let gltf = null;
    let lastError = null;
    for (const url of urls) {
      try {
        gltf = await loader.loadAsync(url);
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (gltf) {
      const root = gltf.scene || gltf.scenes?.[0];
      if (root) {
        root.traverse((obj) => {
          if (!obj.isMesh) return;
          obj.castShadow = true;
          obj.receiveShadow = true;
        });
        preserveOriginalGltfTextureMapping(root);
        fitChairModelToFootprint(root);
        if (!chairTheme.preserveMaterials) {
          tintChairModel(root, chairTheme);
        }
        return root;
      }
    }
    console.warn('Falling back to procedural chair', lastError);
  }
  return createChair(
    chairTheme?.primary || chairTheme?.seatColor,
    chairTheme?.legColor
  );
}

const safeThumbnail = (value) => {
  if (!value) return '/assets/icons/four-in-row-royale.svg';
  if (
    value.startsWith('data:') ||
    value.startsWith('/assets/') ||
    value.startsWith('http')
  )
    return value;
  return '/assets/icons/four-in-row-royale.svg';
};

const getArenaYOffsetForHdri = (hdriId) => {
  const variant =
    POOL_ROYALE_HDRI_VARIANT_MAP[hdriId] ||
    POOL_ROYALE_HDRI_VARIANTS.find((h) => h.id === hdriId) ||
    POOL_ROYALE_HDRI_VARIANTS[0];
  const groundedHeight = Math.max(
    variant?.cameraHeightM ?? DEFAULT_GROUNDED_CAMERA_HEIGHT,
    DEFAULT_GROUNDED_CAMERA_HEIGHT
  );
  return -groundedHeight;
};

export default function FourInRowRoyal() {
  useTelegramBackButton();
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const boardHitPlaneRef = useRef(null);
  const piecesGroupRef = useRef(null);
  const piecesMapRef = useRef(new Map());
  const displayedBoardRef = useRef([]);
  const fallingPiecesRef = useRef([]);
  const animationClockRef = useRef(new THREE.Clock());
  const markerRef = useRef(null);
  const hoverColRef = useRef(null);
  const turnRef = useRef('player');
  const winnerRef = useRef(null);
  const winningCellsRef = useRef([]);
  const rendererRef = useRef(null);
  const perspectiveCameraRef = useRef(null);
  const controlsRef = useRef(null);
  const rayRef = useRef(new THREE.Raycaster());
  const pointerRef = useRef(new THREE.Vector2());
  const envRef = useRef({ map: null, skybox: null, hdriId: null });
  const arenaRootRef = useRef(null);
  const arenaYOffsetRef = useRef(
    getArenaYOffsetForHdri(POOL_ROYALE_DEFAULT_HDRI_ID)
  );
  const tablePartsRef = useRef(null);
  const chairMeshesRef = useRef([]);
  const boardMaterialsRef = useRef({
    boardFaceMat: null,
    railMat: null,
    trimMat: null,
    holeRimMat: null
  });
  const keyLightRef = useRef(null);
  const audioCtxRef = useRef(null);
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const accountId = params.get('accountId') || '';
  const avatar = params.get('avatar') || getTelegramPhotoUrl();
  const username = params.get('username') || getTelegramUsername() || 'Player';

  const inventory = useMemo(
    () => getFourInRowInventory(fourInRowAccountId(accountId || undefined)),
    [accountId]
  );
  const selectedLayout = useMemo(() => {
    const requested = params.get('boardLayout');
    const owned = inventory.boardLayout || [];
    return (
      FOUR_IN_ROW_BOARD_LAYOUTS.find(
        (l) => l.id === requested && owned.includes(l.id)
      ) ||
      FOUR_IN_ROW_BOARD_LAYOUTS.find((l) => owned.includes(l.id)) ||
      FOUR_IN_ROW_BOARD_LAYOUTS[0]
    );
  }, [inventory.boardLayout, params]);

  const rows = selectedLayout.rows;
  const cols = selectedLayout.cols;
  const boardWidth = (1.08 + cols * 0.19) * BOARD_AND_CHIPS_SCALE;
  const boardHeight = (0.92 + rows * 0.2) * BOARD_AND_CHIPS_SCALE;
  const boardBottomY =
    TABLE_HEIGHT + BOARD_TABLE_CLEARANCE + 0.14 + BOARD_VERTICAL_LIFT;
  const boardCenterY = boardBottomY + boardHeight / 2;
  const slotRadius = Math.min(boardWidth / cols, boardHeight / rows) * 0.285;
  const xStep = boardWidth / cols;
  const yStep = boardHeight / rows;

  const [appearance, setAppearance] = useState(() => ({
    tableFinish: inventory.tableFinish?.[0] || MURLAN_TABLE_FINISHES[0]?.id,
    tableId:
      inventory.tables?.[0] ||
      FOUR_IN_ROW_BATTLE_DEFAULT_LOADOUT.tables?.[0] ||
      FOUR_IN_ROW_TABLE_OPTIONS[0]?.id,
    chairId:
      inventory.chairColor?.[0] ||
      FOUR_IN_ROW_BATTLE_DEFAULT_LOADOUT.chairColor?.[0] ||
      FOUR_IN_ROW_CHAIR_OPTIONS[0]?.id,
    boardFinish:
      inventory.boardFinish?.[0] ||
      FOUR_IN_ROW_BATTLE_DEFAULT_LOADOUT.boardFinish?.[0] ||
      FOUR_IN_ROW_BOARD_FINISH_OPTIONS[0]?.id,
    boardFrameFinish:
      inventory.boardFrameFinish?.[0] ||
      FOUR_IN_ROW_BATTLE_DEFAULT_LOADOUT.boardFrameFinish?.[0] ||
      FOUR_IN_ROW_BOARD_FRAME_FINISH_OPTIONS[0]?.id,
    ringFinish:
      inventory.ringFinish?.[0] ||
      FOUR_IN_ROW_BATTLE_DEFAULT_LOADOUT.ringFinish?.[0] ||
      FOUR_IN_ROW_RING_FINISH_OPTIONS[0]?.id,
    boardTheme:
      inventory.boardTheme?.[0] ||
      FOUR_IN_ROW_BATTLE_DEFAULT_LOADOUT.boardTheme?.[0] ||
      FOUR_IN_ROW_BOARD_THEMES[0]?.id,
    stoneStyle:
      inventory.stoneStyle?.[0] ||
      FOUR_IN_ROW_BATTLE_DEFAULT_LOADOUT.stoneStyle?.[0] ||
      FOUR_IN_ROW_STONE_STYLES[0]?.id,
    hdriId:
      inventory.environmentHdri?.[0] ||
      FOUR_IN_ROW_BATTLE_DEFAULT_LOADOUT.environmentHdri?.[0] ||
      POOL_ROYALE_DEFAULT_HDRI_ID,
    graphics: GRAPHICS_PRESETS[0].id
  }));

  const [board, setBoard] = useState(() => createBoard(rows, cols));
  const [turn, setTurn] = useState('player');
  const [winner, setWinner] = useState(null);
  const [showWinnerActions, setShowWinnerActions] = useState(false);
  const [winningCells, setWinningCells] = useState([]);
  const [showIntroBanner, setShowIntroBanner] = useState(true);
  const [hoverCol, setHoverCol] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [showGift, setShowGift] = useState(false);
  const [chatBubbles, setChatBubbles] = useState([]);
  const introBannerTimeoutRef = useRef(null);

  useEffect(() => {
    hoverColRef.current = hoverCol;
  }, [hoverCol]);

  useEffect(() => {
    turnRef.current = turn;
  }, [turn]);

  useEffect(() => {
    winnerRef.current = winner;
  }, [winner]);

  useEffect(() => {
    if (!winner) {
      setShowWinnerActions(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setShowWinnerActions(true), 5000);
    return () => window.clearTimeout(timer);
  }, [winner]);

  useEffect(() => {
    winningCellsRef.current = winningCells;
  }, [winningCells]);
  const [configOpen, setConfigOpen] = useState(false);

  const triggerIntroBanner = useCallback(() => {
    setShowIntroBanner(true);
    if (introBannerTimeoutRef.current) {
      window.clearTimeout(introBannerTimeoutRef.current);
    }
    introBannerTimeoutRef.current = window.setTimeout(() => {
      setShowIntroBanner(false);
      introBannerTimeoutRef.current = null;
    }, INTRO_MESSAGE_DURATION_MS);
  }, []);

  const resetMatch = () => {
    setBoard(createBoard(rows, cols));
    setTurn('player');
    setWinner(null);
    setWinningCells([]);
    triggerIntroBanner();
  };

  const worldFromCell = (r, c) => [
    -boardWidth / 2 + (c + 0.5) * xStep,
    boardCenterY + boardHeight / 2 - (r + 0.5) * yStep,
    0
  ];

  const playTone = (
    frequency = 430,
    duration = 0.08,
    type = 'triangle',
    gain = 0.02
  ) => {
    const ACtx = window.AudioContext || window.webkitAudioContext;
    if (!ACtx) return;
    if (!audioCtxRef.current) audioCtxRef.current = new ACtx();
    const ctx = audioCtxRef.current;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.frequency.value = frequency;
    osc.type = type;
    amp.gain.value = gain;
    osc.connect(amp);
    amp.connect(ctx.destination);
    const now = ctx.currentTime;
    amp.gain.setValueAtTime(gain, now);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.start(now);
    osc.stop(now + duration);
  };

  const createTokenMesh = (token) => {
    const playerMat = new THREE.MeshStandardMaterial({
      color: CONNECT4_RED,
      roughness: 0.35,
      metalness: 0.03
    });
    const aiMat = new THREE.MeshStandardMaterial({
      color: CONNECT4_BLUE,
      roughness: 0.3,
      metalness: 0.03
    });
    const rimMat = new THREE.MeshStandardMaterial({
      color: '#1f1a16',
      roughness: 0.5,
      metalness: 0.02
    });
    const tokenMesh = new THREE.Group();
    const material = token === 'player' ? playerMat : aiMat;
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(
        slotRadius * 0.99,
        slotRadius * 0.99,
        0.13,
        42
      ),
      material
    );
    const domeA = new THREE.Mesh(
      new THREE.SphereGeometry(
        slotRadius * 0.93,
        36,
        20,
        0,
        Math.PI * 2,
        0,
        Math.PI / 2
      ),
      material
    );
    domeA.rotation.x = Math.PI;
    domeA.position.y = 0.038;
    const domeB = domeA.clone();
    domeB.position.y = -0.038;
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(slotRadius * 0.96, 0.01, 12, 36),
      rimMat
    );
    rim.rotation.x = Math.PI / 2;
    tokenMesh.add(body, domeA, domeB, rim);
    tokenMesh.rotation.x = Math.PI / 2;
    return tokenMesh;
  };

  const renderPieces = (boardState) => {
    const group = piecesGroupRef.current;
    if (!group) return;
    group.clear();
    piecesMapRef.current.clear();
    fallingPiecesRef.current = [];

    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        if (!boardState[r][c]) continue;
        const [x, y, z] = worldFromCell(r, c);
        const token = createTokenMesh(boardState[r][c]);
        token.position.set(x, y, z);
        group.add(token);
        piecesMapRef.current.set(`${r}-${c}`, token);
      }
    }
    displayedBoardRef.current = cloneBoard(boardState);
  };

  useEffect(() => {
    setBoard(createBoard(rows, cols));
    setTurn('player');
    setWinner(null);
    setWinningCells([]);
    displayedBoardRef.current = createBoard(rows, cols);
    triggerIntroBanner();
  }, [rows, cols, triggerIntroBanner]);

  useEffect(
    () => () => {
      if (introBannerTimeoutRef.current) {
        window.clearTimeout(introBannerTimeoutRef.current);
      }
    },
    []
  );

  useEffect(() => renderPieces(board), [appearance.stoneStyle, rows, cols]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const arenaRoot = new THREE.Group();
    arenaRoot.position.y = getArenaYOffsetForHdri(appearance.hdriId);
    arenaRoot.scale.setScalar(ARENA_VISUAL_SCALE);
    arenaRootRef.current = arenaRoot;
    arenaYOffsetRef.current = arenaRoot.position.y;
    scene.add(arenaRoot);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    applyRendererSRGB(renderer);
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const perspective = new THREE.PerspectiveCamera(47, 1, 0.1, 200);
    const isPortrait = mount.clientHeight > mount.clientWidth;
    const cameraSeatAngle = Math.PI / 2;
    const cameraBackOffset =
      ((isPortrait ? 2.55 : 1.78) + 0.35) * CAMERA_FRAME_MATCH_SCALE +
      CAMERA_RADIUS_COMPENSATION;
    const cameraForwardOffset =
      (isPortrait ? 0.08 : 0.2) * CAMERA_FRAME_MATCH_SCALE;
    const cameraHeightOffset =
      (isPortrait ? 1.86 : 1.44) * CAMERA_FRAME_MATCH_SCALE;
    const cameraRadius =
      CHAIR_DISTANCE + cameraBackOffset - cameraForwardOffset;
    perspective.position.set(
      Math.cos(cameraSeatAngle) * cameraRadius,
      arenaRoot.position.y + TABLE_HEIGHT + cameraHeightOffset,
      Math.sin(cameraSeatAngle) * cameraRadius
    );
    perspectiveCameraRef.current = perspective;

    const controls = new OrbitControls(perspective, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, arenaRoot.position.y + TABLE_HEIGHT - 0.1, 0);
    controls.minPolarAngle = THREE.MathUtils.degToRad(30);
    controls.maxPolarAngle =
      ARENA_CAMERA_DEFAULTS.phiMax + THREE.MathUtils.degToRad(16);
    controls.rotateSpeed = 0.85;
    controls.zoomSpeed = 0.7;
    renderer.domElement.style.touchAction = 'none';
    controlsRef.current = controls;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.05);
    key.position.set(2.2, 4.5, 1.6);
    key.position.y += arenaRoot.position.y;
    key.castShadow = true;
    keyLightRef.current = key;
    scene.add(key);

    const table = createMurlanStyleTable({
      arena: arenaRoot,
      renderer,
      tableRadius: TABLE_RADIUS,
      tableHeight: TABLE_HEIGHT,
      tableThemeId: appearance.tableId
    });
    tablePartsRef.current = table.parts;
    applyTableMaterials(
      table.parts,
      MURLAN_TABLE_FINISHES.find((f) => f.id === appearance.tableFinish) ||
        MURLAN_TABLE_FINISHES[0]
    );

    const chairTheme =
      FOUR_IN_ROW_CHAIR_OPTIONS.find(
        (item) => item.id === appearance.chairId
      ) || FOUR_IN_ROW_CHAIR_OPTIONS[0];
    chairMeshesRef.current = [];
    const chairPositions = [
      [0, 0, -CHAIR_DISTANCE],
      [0, 0, CHAIR_DISTANCE]
    ];
    chairPositions.forEach(([x, y, z]) => {
      const chair = new THREE.Group();
      chair.position.set(x, y, z);
      chair.lookAt(0, 0, 0);
      chair.userData = {
        seatColor: chairTheme.primary,
        legColor: chairTheme.legColor
      };
      chairMeshesRef.current.push(chair);
      arenaRoot.add(chair);
    });
    createChairModel(chairTheme).then((template) => {
      chairMeshesRef.current.forEach((chair) => {
        chair.clear();
        chair.add(template.clone(true));
      });
    });

    const boardGroup = new THREE.Group();

    const selectedBoardTheme =
      FOUR_IN_ROW_BOARD_THEMES.find(
        (item) => item.id === appearance.boardTheme
      ) || FOUR_IN_ROW_BOARD_THEMES[0];
    const selectedBoardFinish =
      FOUR_IN_ROW_BOARD_FINISH_OPTIONS.find(
        (item) => item.id === appearance.boardFinish
      ) || FOUR_IN_ROW_BOARD_FINISH_OPTIONS[0];
    const selectedBoardFrameFinish =
      FOUR_IN_ROW_BOARD_FRAME_FINISH_OPTIONS.find(
        (item) => item.id === appearance.boardFrameFinish
      ) || FOUR_IN_ROW_BOARD_FRAME_FINISH_OPTIONS[0];
    const selectedRingFinish =
      FOUR_IN_ROW_RING_FINISH_OPTIONS.find(
        (item) => item.id === appearance.ringFinish
      ) || FOUR_IN_ROW_RING_FINISH_OPTIONS[0];

    const boardFaceMat = new THREE.MeshStandardMaterial({
      color: selectedBoardTheme?.tint || CONNECT4_PANEL,
      roughness: 0.74,
      metalness: 0.02,
      side: THREE.DoubleSide
    });
    const railMat = new THREE.MeshStandardMaterial({
      color: CONNECT4_WOOD,
      roughness: 0.52,
      metalness: 0.08
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: CONNECT4_WOOD_DARK,
      roughness: 0.48,
      metalness: 0.1
    });
    const holeRimMat = new THREE.MeshStandardMaterial({
      color: selectedRingFinish?.color || '#9a856e',
      roughness: selectedRingFinish?.roughness ?? 0.52,
      metalness: selectedRingFinish?.metalness ?? 0.04
    });
    boardMaterialsRef.current = { boardFaceMat, railMat, trimMat, holeRimMat };

    const resolveWoodOption = (finish) => {
      const preset =
        WOOD_FINISH_PRESETS.find(
          (entry) => entry.id === finish?.woodOption?.presetId
        ) ||
        WOOD_FINISH_PRESETS[1] ||
        WOOD_FINISH_PRESETS[0];
      const grainId = finish?.woodOption?.grainId || DEFAULT_WOOD_GRAIN_ID;
      const grain =
        WOOD_GRAIN_OPTIONS_BY_ID[grainId] ||
        WOOD_GRAIN_OPTIONS_BY_ID[DEFAULT_WOOD_GRAIN_ID] ||
        {};
      return { preset, grain };
    };
    const applyWoodFinish = (
      material,
      finish,
      texturePart = 'rail',
      fallbackRepeat = { x: 1, y: 1 }
    ) => {
      if (!material) return;
      const { preset, grain } = resolveWoodOption(finish);
      const texture = grain?.[texturePart] || {};
      applyWoodTextures(material, {
        hue: preset?.hue ?? 32,
        sat: preset?.sat ?? 0.34,
        light: preset?.light ?? 0.7,
        contrast: preset?.contrast ?? 0.52,
        repeat: texture?.repeat ?? fallbackRepeat,
        rotation: texture?.rotation ?? 0,
        textureSize: texture?.textureSize,
        mapUrl: texture?.mapUrl,
        roughnessMapUrl: texture?.roughnessMapUrl,
        normalMapUrl: texture?.normalMapUrl,
        sharedKey: `fourinrow-${finish?.id || 'default'}-${texturePart}`
      });
    };
    applyWoodFinish(boardFaceMat, selectedBoardFinish, 'frame', {
      x: 0.9,
      y: 0.9
    });
    applyWoodFinish(railMat, selectedBoardFrameFinish, 'rail', { x: 1, y: 1 });
    applyWoodFinish(trimMat, selectedBoardFrameFinish, 'frame', { x: 1, y: 1 });

    const boardThickness = BOARD_FACE_THICKNESS;
    const boardBaseY = boardBottomY - BOARD_BASE_THICKNESS / 2;
    const boardShape = new THREE.Shape();
    boardShape.moveTo(-boardWidth / 2, -boardHeight / 2);
    boardShape.lineTo(boardWidth / 2, -boardHeight / 2);
    boardShape.lineTo(boardWidth / 2, boardHeight / 2);
    boardShape.lineTo(-boardWidth / 2, boardHeight / 2);
    boardShape.lineTo(-boardWidth / 2, -boardHeight / 2);

    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const x = -boardWidth / 2 + (c + 0.5) * xStep;
        const y = boardHeight / 2 - (r + 0.5) * yStep;
        const holePath = new THREE.Path();
        holePath.absellipse(
          x,
          y,
          slotRadius * 0.96,
          slotRadius * 0.96,
          0,
          Math.PI * 2,
          true
        );
        boardShape.holes.push(holePath);
      }
    }

    const boardFaceGeo = new THREE.ExtrudeGeometry(boardShape, {
      depth: boardThickness,
      bevelEnabled: false,
      curveSegments: 42
    });
    const boardFaceFront = new THREE.Mesh(boardFaceGeo, boardFaceMat);
    const boardFaceBack = boardFaceFront.clone();
    boardFaceFront.position.set(
      0,
      boardCenterY,
      BOARD_SLOT_GAP / 2 - boardThickness / 2
    );
    boardFaceBack.position.set(
      0,
      boardCenterY,
      -BOARD_SLOT_GAP / 2 - boardThickness / 2
    );
    boardFaceFront.castShadow = true;
    boardFaceFront.receiveShadow = true;
    boardFaceBack.castShadow = true;
    boardFaceBack.receiveShadow = true;
    boardGroup.add(boardFaceFront, boardFaceBack);

    const frameSideWidth = 0.12;
    const topRailDepth = 0.046;
    const topFrontRail = new THREE.Mesh(
      new THREE.BoxGeometry(
        boardWidth + frameSideWidth * 2,
        BOARD_FRAME_THICKNESS,
        topRailDepth
      ),
      railMat
    );
    topFrontRail.position.set(
      0,
      boardCenterY + boardHeight / 2 + BOARD_FRAME_THICKNESS / 2,
      BOARD_SLOT_GAP / 2 + boardThickness / 2 + topRailDepth / 2
    );
    const topBackRail = topFrontRail.clone();
    topBackRail.position.z = -topFrontRail.position.z;
    boardGroup.add(topFrontRail, topBackRail);

    const bottomRail = new THREE.Mesh(
      new THREE.BoxGeometry(
        boardWidth + frameSideWidth * 2,
        BOARD_FRAME_THICKNESS,
        BOARD_FRAME_DEPTH
      ),
      railMat
    );
    bottomRail.position.set(
      0,
      boardCenterY - boardHeight / 2 - BOARD_FRAME_THICKNESS / 2,
      BOARD_FRAME_CENTER_Z
    );
    boardGroup.add(bottomRail);

    const sideOffset = boardWidth / 2 + frameSideWidth / 2;
    const leftRail = new THREE.Mesh(
      new THREE.BoxGeometry(
        frameSideWidth,
        boardHeight + BOARD_FRAME_THICKNESS * 2,
        BOARD_FRAME_DEPTH
      ),
      railMat
    );
    leftRail.position.set(-sideOffset, boardCenterY, BOARD_FRAME_CENTER_Z);
    const rightRail = leftRail.clone();
    rightRail.position.x = sideOffset;
    boardGroup.add(leftRail, rightRail);

    const legHeight = boardHeight * 0.66;
    const legY = boardBaseY - legHeight / 2 - 0.02 * BOARD_AND_CHIPS_SCALE;
    const legLeft = new THREE.Mesh(
      new THREE.BoxGeometry(
        0.16 * BOARD_AND_CHIPS_SCALE,
        legHeight,
        0.2 * BOARD_AND_CHIPS_SCALE
      ),
      trimMat
    );
    legLeft.position.set(-sideOffset, legY, BOARD_FRAME_CENTER_Z);
    const legRight = legLeft.clone();
    legRight.position.x = sideOffset;
    boardGroup.add(legLeft, legRight);

    const footY = TABLE_HEIGHT + 0.02 * BOARD_AND_CHIPS_SCALE;
    const footGeo = new THREE.BoxGeometry(
      0.54 * BOARD_AND_CHIPS_SCALE,
      0.16 * BOARD_AND_CHIPS_SCALE,
      0.28 * BOARD_AND_CHIPS_SCALE
    );
    const leftFoot = new THREE.Mesh(footGeo, railMat);
    leftFoot.position.set(
      -sideOffset - 0.04 * BOARD_AND_CHIPS_SCALE,
      footY,
      BOARD_FRAME_CENTER_Z
    );
    const rightFoot = leftFoot.clone();
    rightFoot.position.x = sideOffset + 0.04 * BOARD_AND_CHIPS_SCALE;
    boardGroup.add(leftFoot, rightFoot);

    // Keep the board and frame facing the player at the default start camera.
    boardGroup.rotation.y = 0;

    const holeRimGeo = new THREE.TorusGeometry(
      slotRadius * 0.97,
      0.018 * BOARD_AND_CHIPS_SCALE,
      16,
      42
    );
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const [x, y] = worldFromCell(r, c);
        const frontRim = new THREE.Mesh(holeRimGeo, holeRimMat);
        frontRim.position.set(
          x,
          y,
          BOARD_SLOT_GAP / 2 +
            boardThickness / 2 +
            0.0012 * BOARD_AND_CHIPS_SCALE
        );
        const backRim = frontRim.clone();
        backRim.position.z = -(
          BOARD_SLOT_GAP / 2 +
          boardThickness / 2 +
          0.0012 * BOARD_AND_CHIPS_SCALE
        );
        boardGroup.add(frontRim, backRim);
      }
    }

    const createChipStack = (
      tokenColor,
      side = 'front',
      xOffset = 0,
      count = 6
    ) => {
      const stack = new THREE.Group();
      const chipMat = new THREE.MeshStandardMaterial({
        color: tokenColor,
        roughness: 0.3,
        metalness: 0.04
      });
      const topMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(tokenColor).lerp(
          new THREE.Color('#ffffff'),
          0.25
        ),
        roughness: 0.24,
        metalness: 0.05
      });
      const chipDepth = 0.024 * BOARD_AND_CHIPS_SCALE;
      for (let i = 0; i < count; i += 1) {
        const chip = new THREE.Mesh(
          new THREE.CylinderGeometry(
            slotRadius * 1.08,
            slotRadius * 1.08,
            chipDepth,
            36
          ),
          chipMat
        );
        chip.position.y = i * chipDepth * 0.85;
        stack.add(chip);
      }
      const topChip = new THREE.Mesh(
        new THREE.CylinderGeometry(
          slotRadius * 1.06,
          slotRadius * 1.06,
          chipDepth * 0.5,
          36
        ),
        topMat
      );
      topChip.position.y = count * chipDepth * 0.85 + chipDepth * 0.16;
      stack.add(topChip);

      const sideSign = side === 'front' ? 1 : -1;
      stack.position.set(
        xOffset,
        TABLE_HEIGHT + chipDepth / 2,
        sideSign * (TABLE_RADIUS * 0.58)
      );
      stack.rotation.y = side === 'front' ? 0 : Math.PI;
      return stack;
    };

    boardGroup.add(
      createChipStack(CONNECT4_RED, 'front', -0.2 * BOARD_AND_CHIPS_SCALE, 7),
      createChipStack(CONNECT4_BLUE, 'back', 0.2 * BOARD_AND_CHIPS_SCALE, 7)
    );

    const hitPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(boardWidth, boardHeight + yStep * 1.65),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })
    );
    hitPlane.position.set(0, boardCenterY + yStep * 0.28, 0.2);
    boardGroup.add(hitPlane);
    boardHitPlaneRef.current = hitPlane;

    const marker = new THREE.Mesh(
      new THREE.RingGeometry(slotRadius * 1.1, slotRadius * 1.45, 24),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.85
      })
    );
    marker.position.set(0, boardCenterY + boardHeight / 2 + yStep * 0.48, 0.2);
    marker.visible = false;
    markerRef.current = marker;
    boardGroup.add(marker);

    const pieces = new THREE.Group();
    piecesGroupRef.current = pieces;
    boardGroup.add(pieces);
    arenaRoot.add(boardGroup);

    const onResize = () => {
      if (!mount) return;
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      const aspect = width / height;
      perspective.aspect = aspect;
      perspective.updateProjectionMatrix();
      const preset =
        GRAPHICS_PRESETS.find((g) => g.id === appearance.graphics) ||
        GRAPHICS_PRESETS[0];
      renderer.setPixelRatio(
        Math.min(window.devicePixelRatio * preset.pixelRatioScale, 2)
      );
      renderer.setSize(width, height);
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      key.shadow.mapSize.setScalar(preset.shadowMapSize);
    };
    onResize();
    animationClockRef.current.start();

    let raf;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const delta = Math.min(animationClockRef.current.getDelta(), 1 / 60);
      const elapsed = animationClockRef.current.elapsedTime;

      for (let i = fallingPiecesRef.current.length - 1; i >= 0; i -= 1) {
        const entry = fallingPiecesRef.current[i];
        entry.elapsed += delta;
        if (entry.phase === 'preview') {
          const t = Math.min(1, entry.elapsed / entry.previewDuration);
          const pulse = 1 + Math.sin(t * Math.PI) * 0.04;
          entry.mesh.scale.setScalar(pulse);
          if (t >= 1) {
            entry.phase = 'drop';
            entry.elapsed = 0;
            entry.mesh.scale.setScalar(1);
          }
          continue;
        }

        const t = Math.min(1, entry.elapsed / entry.dropDuration);
        const eased = 1 - (1 - t) ** 4;
        entry.mesh.position.y = THREE.MathUtils.lerp(
          entry.columnTop.y,
          entry.target.y,
          eased
        );
        const wobble = Math.sin((1 - t) * Math.PI * 2.2) * 0.015 * (1 - t);
        entry.mesh.position.z = entry.target.z + wobble;
        if (t >= 1) {
          entry.mesh.position.copy(entry.target);
          fallingPiecesRef.current.splice(i, 1);
        }
      }

      winningCellsRef.current.forEach(([r, c]) => {
        const token = piecesMapRef.current.get(`${r}-${c}`);
        if (!token) return;
        const pulse = 1.08 + Math.sin(elapsed * 8) * 0.06;
        token.scale.setScalar(pulse);
      });

      controls.update();
      if (
        markerRef.current &&
        Number.isInteger(hoverColRef.current) &&
        turnRef.current === 'player' &&
        !winnerRef.current
      ) {
        const x = -boardWidth / 2 + (hoverColRef.current + 0.5) * xStep;
        markerRef.current.visible = true;
        markerRef.current.position.x = x;
      } else if (markerRef.current) {
        markerRef.current.visible = false;
      }
      renderer.render(scene, perspective);
    };
    animate();

    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [
    rows,
    cols,
    boardWidth,
    boardHeight,
    boardCenterY,
    slotRadius,
    xStep,
    yStep
  ]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || envRef.current.hdriId === appearance.hdriId) return;
    let cancelled = false;
    const apply = async () => {
      const variant =
        POOL_ROYALE_HDRI_VARIANT_MAP[appearance.hdriId] ||
        POOL_ROYALE_HDRI_VARIANTS.find((h) => h.id === appearance.hdriId) ||
        POOL_ROYALE_HDRI_VARIANTS[0];
      const url = await resolveHdriUrl(variant);
      const loader = url.toLowerCase().endsWith('.exr')
        ? new EXRLoader()
        : new RGBELoader();
      const envMap = await loader.loadAsync(url);
      if (cancelled) return;
      envMap.mapping = THREE.EquirectangularReflectionMapping;
      scene.environment = envMap;
      scene.background = envMap;
      if (envRef.current.skybox) scene.remove(envRef.current.skybox);
      const groundedHeight = Math.max(
        variant?.cameraHeightM ?? DEFAULT_GROUNDED_CAMERA_HEIGHT,
        DEFAULT_GROUNDED_CAMERA_HEIGHT
      );
      const groundedRadius = Math.max(
        TABLE_RADIUS * (variant?.groundRadiusMultiplier ?? 40),
        32
      );
      const groundedResolution = Math.max(
        96,
        Math.floor(variant?.groundResolution ?? 112)
      );
      const skybox = new GroundedSkybox(
        envMap,
        groundedHeight,
        groundedRadius,
        groundedResolution
      );
      if (Number.isFinite(variant?.rotationY)) {
        skybox.rotation.y = variant.rotationY;
      }
      scene.add(skybox);
      const nextArenaYOffset = -groundedHeight;
      const yDelta = nextArenaYOffset - arenaYOffsetRef.current;
      if (Math.abs(yDelta) > 1e-4) {
        const arenaRoot = arenaRootRef.current;
        const camera = perspectiveCameraRef.current;
        const controls = controlsRef.current;
        const key = keyLightRef.current;
        if (arenaRoot) arenaRoot.position.y = nextArenaYOffset;
        if (camera) camera.position.y += yDelta;
        if (controls) controls.target.y += yDelta;
        if (key) key.position.y += yDelta;
        arenaYOffsetRef.current = nextArenaYOffset;
      }
      envRef.current = { map: envMap, skybox, hdriId: appearance.hdriId };
    };
    void apply();
    return () => {
      cancelled = true;
    };
  }, [appearance.hdriId]);

  useEffect(() => {
    if (!winningCells.length) return;
    winningCells.forEach(([r, c], index) => {
      const piece = piecesMapRef.current.get(`${r}-${c}`);
      if (!piece) return;
      piece.scale.setScalar(1.1);
      setTimeout(
        () => {
          if (piece) piece.scale.setScalar(1);
        },
        300 + index * 60
      );
    });
  }, [winningCells]);

  const playColumn = (col, token) => {
    const row = getDropRow(board, col);
    if (row < 0) {
      playTone(180, 0.05, 'sawtooth', 0.012);
      return false;
    }
    const next = cloneBoard(board);
    next[row][col] = token;
    setBoard(next);
    playTone(token === 'player' ? 520 : 300, 0.09, 'triangle', 0.03);

    const winning = getWinningCells(next, token);
    if (winning) {
      setWinner(token);
      setWinningCells(winning);
      playTone(token === 'player' ? 760 : 220, 0.2, 'square', 0.03);
      return true;
    }
    if (isFull(next)) {
      setWinner('draw');
      setWinningCells([]);
      playTone(200, 0.18, 'triangle', 0.02);
      return true;
    }
    setTurn(token === 'player' ? 'ai' : 'player');
    return true;
  };

  useEffect(() => {
    const group = piecesGroupRef.current;
    if (!group) return;
    const shown = displayedBoardRef.current;

    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const nextCell = board[r][c];
        const currentCell = shown[r][c];
        if (nextCell && !currentCell) {
          const [targetX, targetY, targetZ] = worldFromCell(r, c);
          const dropX = -boardWidth / 2 + (c + 0.5) * xStep;
          const columnTop = new THREE.Vector3(
            dropX,
            boardCenterY + boardHeight / 2 + yStep * 0.62,
            targetZ
          );
          const target = new THREE.Vector3(targetX, targetY, targetZ);
          const mesh = createTokenMesh(nextCell);
          mesh.position.copy(columnTop);
          group.add(mesh);
          piecesMapRef.current.set(`${r}-${c}`, mesh);
          fallingPiecesRef.current.push({
            mesh,
            key: `${r}-${c}`,
            columnTop,
            target,
            elapsed: 0,
            phase: 'preview',
            previewDuration: DROP_PREVIEW_DELAY,
            dropDuration:
              DROP_BASE_DURATION + (rows - 1 - r) * DROP_ROW_DURATION_STEP
          });
        } else if (!nextCell && currentCell) {
          const key = `${r}-${c}`;
          const mesh = piecesMapRef.current.get(key);
          if (mesh) {
            group.remove(mesh);
            piecesMapRef.current.delete(key);
          }
          fallingPiecesRef.current = fallingPiecesRef.current.filter(
            (entry) => entry.key !== key
          );
        }
        shown[r][c] = nextCell;
      }
    }
  }, [board, rows, cols, boardWidth, boardHeight, boardCenterY, xStep, yStep]);

  useEffect(() => {
    const renderer = rendererRef.current;
    const boardMesh = boardHitPlaneRef.current;
    const camera = perspectiveCameraRef.current;
    if (!renderer || !camera || !boardMesh) return undefined;

    const getColumnFromEvent = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerRef.current.y =
        -((event.clientY - rect.top) / rect.height) * 2 + 1;
      rayRef.current.setFromCamera(pointerRef.current, camera);
      const hit = rayRef.current.intersectObject(boardMesh, false)[0];
      if (!hit) return null;
      const localHitPoint = boardMesh.worldToLocal(hit.point.clone());
      const normalizedX = (localHitPoint.x + boardWidth / 2) / boardWidth;
      return Math.min(cols - 1, Math.max(0, Math.floor(normalizedX * cols)));
    };

    const updateHover = (event) => {
      const col = getColumnFromEvent(event);
      setHoverCol(col);
    };

    const onPointer = (event) => {
      if (turn !== 'player' || winner) return;
      const col = getColumnFromEvent(event);
      setHoverCol(col);
      if (Number.isInteger(col)) playColumn(col, 'player');
    };

    const onPointerLeave = () => setHoverCol(null);

    renderer.domElement.addEventListener('pointermove', updateHover);
    renderer.domElement.addEventListener('pointerdown', onPointer);
    renderer.domElement.addEventListener('pointerleave', onPointerLeave);
    return () => {
      renderer.domElement.removeEventListener('pointermove', updateHover);
      renderer.domElement.removeEventListener('pointerdown', onPointer);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
    };
  }, [turn, winner, board, cols, boardWidth]);

  useEffect(() => {
    if (turn !== 'ai' || winner) return;
    const t = setTimeout(() => {
      const depth = cols >= 8 ? 5 : 6;
      const col = chooseAiMove(board, 'ai', 'player', depth);
      if (Number.isInteger(col)) playColumn(col, 'ai');
    }, 420);
    return () => clearTimeout(t);
  }, [turn, winner, board, cols]);

  useEffect(() => {
    const renderer = rendererRef.current;
    const key = keyLightRef.current;
    if (!renderer || !key || !mountRef.current) return;
    const preset =
      GRAPHICS_PRESETS.find((g) => g.id === appearance.graphics) ||
      GRAPHICS_PRESETS[0];
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio * preset.pixelRatioScale, 2)
    );
    renderer.setSize(width, height);
    key.shadow.mapSize.setScalar(preset.shadowMapSize);
  }, [appearance.graphics]);

  useEffect(() => {
    if (!tablePartsRef.current) return;
    const finish =
      MURLAN_TABLE_FINISHES.find((f) => f.id === appearance.tableFinish) ||
      MURLAN_TABLE_FINISHES[0];
    applyTableMaterials(tablePartsRef.current, finish);
  }, [appearance.tableFinish]);

  useEffect(() => {
    const chairTheme =
      FOUR_IN_ROW_CHAIR_OPTIONS.find(
        (item) => item.id === appearance.chairId
      ) || FOUR_IN_ROW_CHAIR_OPTIONS[0];
    let cancelled = false;
    createChairModel(chairTheme).then((template) => {
      if (cancelled) return;
      chairMeshesRef.current.forEach((chair) => {
        chair.clear();
        chair.add(template.clone(true));
      });
    });
    return () => {
      cancelled = true;
    };
  }, [appearance.chairId]);

  useEffect(() => {
    const { boardFaceMat, railMat, trimMat, holeRimMat } =
      boardMaterialsRef.current;
    if (!boardFaceMat || !railMat || !trimMat || !holeRimMat) return;
    const boardTheme =
      FOUR_IN_ROW_BOARD_THEMES.find(
        (item) => item.id === appearance.boardTheme
      ) || FOUR_IN_ROW_BOARD_THEMES[0];
    const boardFinish =
      FOUR_IN_ROW_BOARD_FINISH_OPTIONS.find(
        (item) => item.id === appearance.boardFinish
      ) || FOUR_IN_ROW_BOARD_FINISH_OPTIONS[0];
    const boardFrameFinish =
      FOUR_IN_ROW_BOARD_FRAME_FINISH_OPTIONS.find(
        (item) => item.id === appearance.boardFrameFinish
      ) || FOUR_IN_ROW_BOARD_FRAME_FINISH_OPTIONS[0];
    const ring =
      FOUR_IN_ROW_RING_FINISH_OPTIONS.find(
        (item) => item.id === appearance.ringFinish
      ) || FOUR_IN_ROW_RING_FINISH_OPTIONS[0];
    boardFaceMat.color.set(boardTheme?.tint || CONNECT4_PANEL);
    holeRimMat.color.set(ring?.color || '#9a856e');
    holeRimMat.roughness = ring?.roughness ?? 0.52;
    holeRimMat.metalness = ring?.metalness ?? 0.04;
    const applyFinish = (
      material,
      finish,
      texturePart = 'rail',
      fallbackRepeat = { x: 1, y: 1 }
    ) => {
      const preset =
        WOOD_FINISH_PRESETS.find(
          (entry) => entry.id === finish?.woodOption?.presetId
        ) ||
        WOOD_FINISH_PRESETS[1] ||
        WOOD_FINISH_PRESETS[0];
      const grainId = finish?.woodOption?.grainId || DEFAULT_WOOD_GRAIN_ID;
      const grain =
        WOOD_GRAIN_OPTIONS_BY_ID[grainId] ||
        WOOD_GRAIN_OPTIONS_BY_ID[DEFAULT_WOOD_GRAIN_ID] ||
        {};
      const texture = grain?.[texturePart] || {};
      applyWoodTextures(material, {
        hue: preset?.hue ?? 32,
        sat: preset?.sat ?? 0.34,
        light: preset?.light ?? 0.7,
        contrast: preset?.contrast ?? 0.52,
        repeat: texture?.repeat ?? fallbackRepeat,
        rotation: texture?.rotation ?? 0,
        textureSize: texture?.textureSize,
        mapUrl: texture?.mapUrl,
        roughnessMapUrl: texture?.roughnessMapUrl,
        normalMapUrl: texture?.normalMapUrl,
        sharedKey: `fourinrow-${finish?.id || 'default'}-${texturePart}`
      });
    };
    applyFinish(boardFaceMat, boardFinish, 'frame', { x: 0.9, y: 0.9 });
    applyFinish(railMat, boardFrameFinish, 'rail', { x: 1, y: 1 });
    applyFinish(trimMat, boardFrameFinish, 'frame', { x: 1, y: 1 });
  }, [
    appearance.boardTheme,
    appearance.boardFinish,
    appearance.boardFrameFinish,
    appearance.ringFinish
  ]);

  const optionGroups = [
    {
      key: 'chairId',
      label: 'Chairs',
      options: FOUR_IN_ROW_CHAIR_OPTIONS.map((item) => ({
        id: item.id,
        label: item.label,
        thumbnail: item.thumbnail
      }))
    },
    {
      key: 'tableFinish',
      label: 'Table Cloth',
      options: MURLAN_TABLE_FINISHES.map((item) => ({
        id: item.id,
        label: item.label,
        thumbnail: item.thumbnail
      }))
    },
    {
      key: 'boardFinish',
      label: 'Board Finish',
      options: FOUR_IN_ROW_BOARD_FINISH_OPTIONS.map((item) => ({
        id: item.id,
        label: item.label,
        thumbnail: item.thumbnail
      }))
    },
    {
      key: 'boardFrameFinish',
      label: 'Board Frame',
      options: FOUR_IN_ROW_BOARD_FRAME_FINISH_OPTIONS.map((item) => ({
        id: item.id,
        label: item.label,
        thumbnail: item.thumbnail
      }))
    },
    {
      key: 'ringFinish',
      label: 'Ring Finish',
      options: FOUR_IN_ROW_RING_FINISH_OPTIONS.map((item) => ({
        id: item.id,
        label: item.label,
        thumbnail: item.thumbnail
      }))
    },
    {
      key: 'hdriId',
      label: 'HDRI',
      options: POOL_ROYALE_HDRI_VARIANTS.map((item) => ({
        id: item.id,
        label: item.name,
        thumbnail: item.thumbnail
      }))
    },
    {
      key: 'boardTheme',
      label: 'Board',
      options: FOUR_IN_ROW_BOARD_THEMES.map((item) => ({
        id: item.id,
        label: item.label,
        thumbnail: item.thumbnail
      }))
    },
    {
      key: 'stoneStyle',
      label: 'Pieces',
      options: FOUR_IN_ROW_STONE_STYLES.map((item) => ({
        id: item.id,
        label: item.label,
        thumbnail: item.thumbnail
      }))
    },
    {
      key: 'graphics',
      label: 'Graphics',
      options: GRAPHICS_PRESETS.map((item) => ({
        id: item.id,
        label: item.label,
        thumbnail: '/assets/icons/four-in-row-royale.svg'
      }))
    }
  ];

  return (
    <div className="relative min-h-screen bg-[#070b16] text-white">
      <div ref={mountRef} className="absolute inset-0" />

      <div className="absolute inset-0 pointer-events-none z-20">
        <div className="absolute top-20 left-4 flex flex-col items-start gap-3 pointer-events-none">
          <button
            type="button"
            onClick={() => setConfigOpen((open) => !open)}
            aria-expanded={configOpen}
            aria-label={configOpen ? 'Close game menu' : 'Open game menu'}
            className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-gray-100"
          >
            <span className="text-base leading-none" aria-hidden="true">
              ☰
            </span>
            <span className="leading-none">Menu</span>
          </button>
          <h1 className="pointer-events-none rounded-2xl border border-white/15 bg-black/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em]">
            4 in a Row
          </h1>
        </div>

        <div className="absolute top-20 right-4 flex flex-col items-end gap-3 pointer-events-none">
          <div className="pointer-events-auto flex flex-col items-end gap-3">
            <BottomLeftIcons
              showInfo={false}
              showChat={false}
              showGift={false}
              className="flex flex-col"
              buttonClassName="icon-only-button pointer-events-auto flex h-10 w-10 items-center justify-center text-white/90"
              iconClassName="text-[1.5rem] leading-none"
              labelClassName="sr-only"
              muteIconOn="🔇"
              muteIconOff="🔊"
              order={['mute']}
            />
          </div>
          {configOpen && (
            <div className="pointer-events-auto mt-2 w-[min(90vw,32rem)] max-h-[72vh] overflow-y-auto rounded-2xl border border-white/15 bg-black/80 p-4 text-xs text-white shadow-2xl backdrop-blur">
              <p className="text-[10px] uppercase tracking-[0.4em] text-sky-200/80">
                4 in a Row Customization
              </p>
              <p className="mt-2 text-white/70">
                Layout:{' '}
                {FOUR_IN_ROW_BATTLE_OPTION_LABELS.boardLayout[
                  selectedLayout.id
                ] || selectedLayout.label}
              </p>
              {optionGroups.map((group) => (
                <div key={group.key} className="mt-4">
                  <p className="text-[10px] uppercase tracking-[0.35em] text-white/70">
                    {group.label}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {group.options.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() =>
                          setAppearance((prev) => ({
                            ...prev,
                            [group.key]: option.id
                          }))
                        }
                        className={`rounded-xl border p-2 text-left ${appearance[group.key] === option.id ? 'border-cyan-300/70 bg-cyan-400/20' : 'border-white/15 bg-white/5'}`}
                      >
                        <img
                          src={safeThumbnail(option.thumbnail)}
                          alt={option.label}
                          className="h-12 w-full rounded-lg object-cover"
                        />
                        <p className="mt-1 truncate text-[10px] text-white/85">
                          {option.label}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 z-20">
        <div className="absolute left-1/2 top-[17%] -translate-x-1/2">
          <AvatarTimer
            photoUrl="🤖"
            name="AI Rival"
            active
            isTurn={turn === 'ai'}
            size={1}
          />
        </div>
        <div
          data-self-player="true"
          className="absolute left-1/2 top-[85%] -translate-x-1/2"
        >
          <AvatarTimer
            photoUrl={avatar}
            name={username}
            active
            isTurn={turn === 'player'}
            size={1}
          />
        </div>
      </div>

      {showIntroBanner && !winner && (
        <div className="pointer-events-none absolute left-1/2 top-[8%] z-30 -translate-x-1/2 rounded-full border border-cyan-200/35 bg-black/70 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100">
          Match 4 in row to win
        </div>
      )}
      {winner && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
          <div className="relative w-[min(24rem,90vw)] rounded-3xl border border-yellow-300/30 bg-transparent px-6 pb-6 pt-10 text-center">
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
              {Array.from({ length: 14 }).map((_, i) => {
                const angle = (Math.PI * 2 * i) / 14;
                const x = Math.cos(angle) * 120;
                const y = Math.sin(angle) * 96 - 24;
                return (
                  <span
                    // eslint-disable-next-line react/no-array-index-key
                    key={`coin-${i}`}
                    className="absolute left-1/2 top-1/2 text-xl"
                    style={{
                      animation: `fourinrow-coin-burst 900ms ease-out ${i * 35}ms forwards`,
                      '--x': `${x}px`,
                      '--y': `${y}px`
                    }}
                  >
                    🪙
                  </span>
                );
              })}
            </div>
            <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-yellow-300/60 bg-white/10 text-4xl">
              {winner === 'player' ? (
                <img
                  src={avatar || '/assets/icons/profile.svg'}
                  alt="winner avatar"
                  className="h-full w-full object-cover"
                />
              ) : (
                '🤖'
              )}
            </div>
            <p className="text-xs uppercase tracking-[0.26em] text-yellow-300">
              Winner
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white">
              {winner === 'draw'
                ? 'Draw Game'
                : winner === 'player'
                  ? `${username} Wins!`
                  : 'AI Rival Wins!'}
            </h2>
            <p className="mt-2 text-sm text-white/75">
              {winner === 'draw'
                ? 'No more moves left.'
                : '4 pieces connected and highlighted.'}
            </p>
            {showWinnerActions && (
              <div className="pointer-events-auto mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={resetMatch}
                  className="rounded-xl border border-cyan-300/70 bg-transparent px-4 py-2 text-sm font-semibold text-cyan-100"
                >
                  Play Again
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/games/fourinrowroyale/lobby')}
                  className="rounded-xl border border-white/45 bg-transparent px-4 py-2 text-sm font-semibold text-white"
                >
                  Return Lobby
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <style>
        {`@keyframes fourinrow-coin-burst {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
          15% { opacity: 1; }
          100% { opacity: 0; transform: translate(calc(-50% + var(--x, 0px)), calc(-50% + var(--y, -110px))) scale(1.25); }
        }`}
      </style>

      <BottomLeftIcons
        onGift={() => setShowGift(true)}
        showInfo={false}
        showChat={false}
        showMute={false}
        className="fixed right-3 bottom-28 z-50 flex flex-col gap-4"
        buttonClassName="icon-only-button pointer-events-auto flex h-11 w-11 items-center justify-center text-white/90"
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
        className="fixed left-3 bottom-28 z-50 flex flex-col"
        buttonClassName="icon-only-button pointer-events-auto flex h-11 w-11 items-center justify-center text-white/90"
        iconClassName="text-[1.65rem] leading-none"
        labelClassName="sr-only"
        chatIcon="💬"
        order={['chat']}
      />

      <QuickMessagePopup
        open={showChat}
        onClose={() => setShowChat(false)}
        title="Quick Chat"
        onSend={(text) => {
          const id = Date.now();
          setChatBubbles((b) => [
            ...b,
            { id, text, photoUrl: avatar || '/assets/icons/profile.svg' }
          ]);
          setTimeout(
            () => setChatBubbles((b) => b.filter((x) => x.id !== id)),
            3000
          );
        }}
      />
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
      <GiftPopup
        open={showGift}
        onClose={() => setShowGift(false)}
        players={[
          {
            index: 0,
            id: fourInRowAccountId(accountId || undefined),
            name: username,
            photoUrl: avatar || '/assets/icons/profile.svg'
          },
          {
            index: 1,
            id: 'ai-rival',
            name: 'AI Rival',
            photoUrl: '/assets/icons/bot.webp'
          }
        ]}
        senderIndex={0}
        title="Send Gift"
      />
    </div>
  );
}
