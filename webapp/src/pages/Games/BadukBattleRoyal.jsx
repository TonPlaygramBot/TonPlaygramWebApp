import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { GroundedSkybox } from 'three/examples/jsm/objects/GroundedSkybox.js';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { ARENA_CAMERA_DEFAULTS } from '../../utils/arenaCameraConfig.js';
import { createMurlanStyleTable, applyTableMaterials } from '../../utils/murlanTable.js';
import {
  BADUK_CHAIR_OPTIONS,
  BADUK_BOARD_THEMES,
  BADUK_STONE_STYLES,
  BADUK_TABLE_OPTIONS,
  BADUK_BATTLE_DEFAULT_LOADOUT,
  BADUK_BOARD_LAYOUTS,
  BADUK_BATTLE_OPTION_LABELS
} from '../../config/badukBattleInventoryConfig.js';
import {
  POOL_ROYALE_DEFAULT_HDRI_ID,
  POOL_ROYALE_HDRI_VARIANTS
} from '../../config/poolRoyaleInventoryConfig.js';
import { MURLAN_TABLE_FINISHES } from '../../config/murlanTableFinishes.js';
import { getTelegramPhotoUrl, getTelegramUsername } from '../../utils/telegram.js';
import BottomLeftIcons from '../../components/BottomLeftIcons.jsx';
import AvatarTimer from '../../components/AvatarTimer.jsx';
import GiftPopup from '../../components/GiftPopup.jsx';
import QuickMessagePopup from '../../components/QuickMessagePopup.jsx';
import { badukBattleAccountId, getBadukBattleInventory } from '../../utils/badukBattleInventory.js';
import { applyRendererSRGB } from '../../utils/colorSpace.js';

const MODEL_SCALE = 0.75;
const TABLE_RADIUS = 3.4 * MODEL_SCALE;
const TABLE_HEIGHT = 1.2;
const CHAIR_DISTANCE = TABLE_RADIUS + 1.3;
const BOARD_TABLE_CLEARANCE = 0.02;
const BOARD_BASE_THICKNESS = 0.12;
const BOARD_FRAME_THICKNESS = 0.12;
const BOARD_FRAME_DEPTH = 0.18;
const CONNECT4_WOOD = '#4b2b1f';
const CONNECT4_WOOD_DARK = '#2d170f';
const CONNECT4_PANEL = '#efe9d5';
const CONNECT4_RED = '#e3342f';
const CONNECT4_BLUE = '#2d79d8';

const GRAPHICS_PRESETS = Object.freeze([
  { id: 'balanced', label: 'Balanced', pixelRatioScale: 1, shadowMapSize: 1024 },
  { id: 'performance', label: 'Performance', pixelRatioScale: 0.85, shadowMapSize: 512 },
  { id: 'cinematic', label: 'Cinematic', pixelRatioScale: 1.4, shadowMapSize: 2048 }
]);

const createBoard = (rows, cols) => Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));
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
  const dirs = [[0, 1], [1, 0], [1, 1], [-1, 1]];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (board[r][c] !== token) continue;
      for (const [dr, dc] of dirs) {
        const cells = [[r, c]];
        let ok = true;
        for (let i = 1; i < 4; i += 1) {
          const nr = r + dr * i;
          const nc = c + dc * i;
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || board[nr][nc] !== token) {
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
    for (let c = 0; c < cols - 3; c += 1) score += evaluateWindow([board[r][c], board[r][c + 1], board[r][c + 2], board[r][c + 3]], aiToken, playerToken);
  }
  for (let c = 0; c < cols; c += 1) {
    for (let r = 0; r < rows - 3; r += 1) score += evaluateWindow([board[r][c], board[r + 1][c], board[r + 2][c], board[r + 3][c]], aiToken, playerToken);
  }
  for (let r = 0; r < rows - 3; r += 1) {
    for (let c = 0; c < cols - 3; c += 1) score += evaluateWindow([board[r][c], board[r + 1][c + 1], board[r + 2][c + 2], board[r + 3][c + 3]], aiToken, playerToken);
  }
  for (let r = 3; r < rows; r += 1) {
    for (let c = 0; c < cols - 3; c += 1) score += evaluateWindow([board[r][c], board[r - 1][c + 1], board[r - 2][c + 2], board[r - 3][c + 3]], aiToken, playerToken);
  }
  return score;
};

const minimax = (board, depth, alpha, beta, maximizing, aiToken, playerToken) => {
  const cols = board[0].length;
  const validCols = Array.from({ length: cols }, (_, i) => i).filter((col) => getDropRow(board, col) >= 0);
  const terminal = checkWinner(board, aiToken) || checkWinner(board, playerToken) || validCols.length === 0;
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
      const val = minimax(next, depth - 1, alpha, beta, false, aiToken, playerToken).score;
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
    const val = minimax(next, depth - 1, alpha, beta, true, aiToken, playerToken).score;
    if (val < best.score) best = { col, score: val };
    beta = Math.min(beta, val);
    if (alpha >= beta) break;
  }
  return best;
};

const chooseAiMove = (board, aiToken, playerToken, depth) => {
  const cols = board[0].length;
  const validCols = Array.from({ length: cols }, (_, i) => i).filter((col) => getDropRow(board, col) >= 0);
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

  const ordered = [...validCols].sort((a, b) => Math.abs(a - cols / 2) - Math.abs(b - cols / 2));
  const { col } = minimax(board, depth, -Infinity, Infinity, true, aiToken, playerToken);
  return Number.isInteger(col) ? col : ordered[0];
};

async function resolveHdriUrl(variant) {
  const fallbackRes = variant?.maxResolution || '2k';
  const fallback = `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/${fallbackRes}/${variant?.assetId || 'colorful_studio'}_${fallbackRes}.hdr`;
  if (!variant?.assetId) return fallback;
  try {
    const res = await fetch(`https://api.polyhaven.com/files/${variant.assetId}`);
    if (!res.ok) return fallback;
    const data = await res.json();
    return data?.exr?.[fallbackRes]?.url || data?.hdr?.[fallbackRes]?.url || fallback;
  } catch {
    return fallback;
  }
}

function createChair(chairColor = '#7f1d1d', legColor = '#111827') {
  const group = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.09, 0.92), new THREE.MeshStandardMaterial({ color: chairColor, roughness: 0.5 }));
  seat.position.y = TABLE_HEIGHT - 0.05;
  group.add(seat);
  const legGeo = new THREE.CylinderGeometry(0.045, 0.05, TABLE_HEIGHT, 20);
  const legMat = new THREE.MeshStandardMaterial({ color: legColor, metalness: 0.35, roughness: 0.45 });
  [[-0.3, TABLE_HEIGHT / 2, -0.3], [0.3, TABLE_HEIGHT / 2, -0.3], [-0.3, TABLE_HEIGHT / 2, 0.3], [0.3, TABLE_HEIGHT / 2, 0.3]].forEach(([x, y, z]) => {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(x, y, z);
    group.add(leg);
  });
  return group;
}

const safeThumbnail = (value) => {
  if (!value) return '/assets/icons/four-in-row-royale.svg';
  if (value.startsWith('data:') || value.startsWith('/assets/') || value.startsWith('http')) return value;
  return '/assets/icons/four-in-row-royale.svg';
};

export default function BadukBattleRoyal() {
  useTelegramBackButton();
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const boardHitPlaneRef = useRef(null);
  const piecesGroupRef = useRef(null);
  const piecesMapRef = useRef(new Map());
  const markerRef = useRef(null);
  const rendererRef = useRef(null);
  const perspectiveCameraRef = useRef(null);
  const topCameraRef = useRef(null);
  const controlsRef = useRef(null);
  const rayRef = useRef(new THREE.Raycaster());
  const pointerRef = useRef(new THREE.Vector2());
  const envRef = useRef({ map: null, skybox: null, hdriId: null });
  const audioCtxRef = useRef(null);
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const accountId = params.get('accountId') || '';
  const avatar = params.get('avatar') || getTelegramPhotoUrl();
  const username = params.get('username') || getTelegramUsername() || 'Player';

  const inventory = useMemo(() => getBadukBattleInventory(badukBattleAccountId(accountId || undefined)), [accountId]);
  const selectedLayout = useMemo(() => {
    const requested = params.get('boardLayout');
    const owned = inventory.boardLayout || [];
    return BADUK_BOARD_LAYOUTS.find((l) => l.id === requested && owned.includes(l.id)) || BADUK_BOARD_LAYOUTS.find((l) => owned.includes(l.id)) || BADUK_BOARD_LAYOUTS[0];
  }, [inventory.boardLayout, params]);

  const rows = selectedLayout.rows;
  const cols = selectedLayout.cols;
  const boardWidth = 1.08 + cols * 0.19;
  const boardHeight = 0.92 + rows * 0.2;
  const boardBottomY = TABLE_HEIGHT + BOARD_TABLE_CLEARANCE;
  const boardCenterY = boardBottomY + boardHeight / 2;
  const slotRadius = Math.min(boardWidth / cols, boardHeight / rows) * 0.285;
  const xStep = boardWidth / cols;
  const yStep = boardHeight / rows;

  const [appearance, setAppearance] = useState(() => ({
    tableFinish: inventory.tableFinish?.[0] || MURLAN_TABLE_FINISHES[0]?.id,
    tableId: inventory.tables?.[0] || BADUK_BATTLE_DEFAULT_LOADOUT.tables?.[0] || BADUK_TABLE_OPTIONS[0]?.id,
    chairId: inventory.chairColor?.[0] || BADUK_BATTLE_DEFAULT_LOADOUT.chairColor?.[0] || BADUK_CHAIR_OPTIONS[0]?.id,
    boardTheme: inventory.boardTheme?.[0] || BADUK_BATTLE_DEFAULT_LOADOUT.boardTheme?.[0] || BADUK_BOARD_THEMES[0]?.id,
    stoneStyle: inventory.stoneStyle?.[0] || BADUK_BATTLE_DEFAULT_LOADOUT.stoneStyle?.[0] || BADUK_STONE_STYLES[0]?.id,
    hdriId: inventory.environmentHdri?.[0] || BADUK_BATTLE_DEFAULT_LOADOUT.environmentHdri?.[0] || POOL_ROYALE_DEFAULT_HDRI_ID,
    graphics: GRAPHICS_PRESETS[0].id
  }));

  const [board, setBoard] = useState(() => createBoard(rows, cols));
  const [turn, setTurn] = useState('player');
  const [winner, setWinner] = useState(null);
  const [winningCells, setWinningCells] = useState([]);
  const [status, setStatus] = useState('Drop pieces into columns. First to connect 4 in row/column/diagonal wins.');
  const [showChat, setShowChat] = useState(false);
  const [showGift, setShowGift] = useState(false);
  const [chatBubbles, setChatBubbles] = useState([]);
  const [configOpen, setConfigOpen] = useState(false);
  const [viewMode, setViewMode] = useState('3d');
  const [hoverCol, setHoverCol] = useState(null);

  const worldFromCell = (r, c) => [
    -boardWidth / 2 + (c + 0.5) * xStep,
    boardCenterY + boardHeight / 2 - (r + 0.5) * yStep,
    0
  ];

  const playTone = (frequency = 430, duration = 0.08, type = 'triangle', gain = 0.02) => {
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

  const renderPieces = (boardState) => {
    const group = piecesGroupRef.current;
    if (!group) return;
    group.clear();
    piecesMapRef.current.clear();
    const playerMat = new THREE.MeshStandardMaterial({ color: CONNECT4_RED, roughness: 0.35, metalness: 0.03 });
    const aiMat = new THREE.MeshStandardMaterial({ color: CONNECT4_BLUE, roughness: 0.3, metalness: 0.03 });
    const rimMat = new THREE.MeshStandardMaterial({ color: '#1f1a16', roughness: 0.5, metalness: 0.02 });

    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        if (!boardState[r][c]) continue;
        const [x, y, z] = worldFromCell(r, c);
        const token = new THREE.Group();
        const body = new THREE.Mesh(new THREE.CylinderGeometry(slotRadius * 0.99, slotRadius * 0.99, 0.13, 42), boardState[r][c] === 'player' ? playerMat : aiMat);
        const domeA = new THREE.Mesh(new THREE.SphereGeometry(slotRadius * 0.93, 36, 20, 0, Math.PI * 2, 0, Math.PI / 2), boardState[r][c] === 'player' ? playerMat : aiMat);
        domeA.rotation.x = Math.PI;
        domeA.position.y = 0.038;
        const domeB = domeA.clone();
        domeB.position.y = -0.038;
        const rim = new THREE.Mesh(new THREE.TorusGeometry(slotRadius * 0.96, 0.01, 12, 36), rimMat);
        rim.rotation.x = Math.PI / 2;
        token.add(body, domeA, domeB, rim);
        token.position.set(x, y, z + 0.03);
        token.rotation.x = Math.PI / 2;
        group.add(token);
        piecesMapRef.current.set(`${r}-${c}`, token);
      }
    }
  };

  useEffect(() => {
    setBoard(createBoard(rows, cols));
    setTurn('player');
    setWinner(null);
    setWinningCells([]);
    setStatus(`Board ${cols}×${rows} loaded. First to connect 4 horizontally, vertically, or diagonally wins.`);
  }, [rows, cols]);

  useEffect(() => renderPieces(board), [board, appearance.stoneStyle, rows, cols]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    applyRendererSRGB(renderer);
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const perspective = new THREE.PerspectiveCamera(47, 1, 0.1, 200);
    perspective.position.set(0, TABLE_HEIGHT + 1.8, CHAIR_DISTANCE + 2.8);
    perspectiveCameraRef.current = perspective;

    const topCamera = new THREE.OrthographicCamera(-boardWidth, boardWidth, boardHeight, -boardHeight, 0.1, 200);
    topCamera.position.set(0, boardCenterY, 7.2);
    topCamera.lookAt(0, boardCenterY, 0);
    topCameraRef.current = topCamera;

    const controls = new OrbitControls(perspective, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.target.set(0, TABLE_HEIGHT + 0.6, 0);
    controls.minPolarAngle = THREE.MathUtils.degToRad(30);
    controls.maxPolarAngle = ARENA_CAMERA_DEFAULTS.phiMax;
    controlsRef.current = controls;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.05);
    key.position.set(2.2, 4.5, 1.6);
    key.castShadow = true;
    scene.add(key);

    const table = createMurlanStyleTable({ arena: scene, renderer, tableRadius: TABLE_RADIUS, tableHeight: TABLE_HEIGHT, tableThemeId: appearance.tableId });
    applyTableMaterials(table.parts, MURLAN_TABLE_FINISHES.find((f) => f.id === appearance.tableFinish) || MURLAN_TABLE_FINISHES[0]);

    const chairTheme = BADUK_CHAIR_OPTIONS.find((item) => item.id === appearance.chairId) || BADUK_CHAIR_OPTIONS[0];
    [Math.PI / 2, -Math.PI / 2].forEach((angle) => {
      const chair = createChair(chairTheme.primary, chairTheme.legColor);
      chair.position.set(Math.cos(angle) * CHAIR_DISTANCE, 0, Math.sin(angle) * CHAIR_DISTANCE);
      chair.lookAt(0, TABLE_HEIGHT, 0);
      scene.add(chair);
    });

    const boardGroup = new THREE.Group();

    const railMat = new THREE.MeshStandardMaterial({ color: CONNECT4_WOOD, roughness: 0.52, metalness: 0.08 });
    const trimMat = new THREE.MeshStandardMaterial({ color: CONNECT4_WOOD_DARK, roughness: 0.48, metalness: 0.1 });

    const boardThickness = 0.08;
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
        holePath.absellipse(x, y, slotRadius * 0.96, slotRadius * 0.96, 0, Math.PI * 2, true);
        boardShape.holes.push(holePath);
      }
    }

    const boardFace = new THREE.Mesh(
      new THREE.ExtrudeGeometry(boardShape, { depth: boardThickness, bevelEnabled: false, curveSegments: 42 }),
      new THREE.MeshStandardMaterial({ color: CONNECT4_PANEL, roughness: 0.74, metalness: 0.02, side: THREE.DoubleSide })
    );
    boardFace.position.set(0, boardCenterY, -boardThickness / 2);
    boardFace.castShadow = true;
    boardFace.receiveShadow = true;
    boardGroup.add(boardFace);

    const frameSideWidth = 0.12;
    const topRail = new THREE.Mesh(new THREE.BoxGeometry(boardWidth + frameSideWidth * 2, BOARD_FRAME_THICKNESS, BOARD_FRAME_DEPTH), railMat);
    topRail.position.set(0, boardCenterY + boardHeight / 2 + BOARD_FRAME_THICKNESS / 2, 0.04);
    boardGroup.add(topRail);

    const slotCutGeo = new THREE.CylinderGeometry(slotRadius * 0.82, slotRadius * 0.82, 0.07, 32);
    const slotCutMat = new THREE.MeshStandardMaterial({ color: '#2a1b13', roughness: 0.62, metalness: 0.02 });
    for (let c = 0; c < cols; c += 1) {
      const slotCut = new THREE.Mesh(slotCutGeo, slotCutMat);
      slotCut.rotation.x = Math.PI / 2;
      slotCut.position.set(-boardWidth / 2 + (c + 0.5) * xStep, boardCenterY + boardHeight / 2 + BOARD_FRAME_THICKNESS / 2 + 0.035, 0.082);
      boardGroup.add(slotCut);
    }

    const bottomRail = new THREE.Mesh(new THREE.BoxGeometry(boardWidth + frameSideWidth * 2, BOARD_FRAME_THICKNESS, BOARD_FRAME_DEPTH), railMat);
    bottomRail.position.set(0, boardCenterY - boardHeight / 2 - BOARD_FRAME_THICKNESS / 2, 0.03);
    boardGroup.add(bottomRail);

    const sideOffset = boardWidth / 2 + frameSideWidth / 2;
    const leftRail = new THREE.Mesh(new THREE.BoxGeometry(frameSideWidth, boardHeight + BOARD_FRAME_THICKNESS * 2, BOARD_FRAME_DEPTH), railMat);
    leftRail.position.set(-sideOffset, boardCenterY, 0.03);
    const rightRail = leftRail.clone();
    rightRail.position.x = sideOffset;
    boardGroup.add(leftRail, rightRail);

    const legHeight = boardHeight * 0.66;
    const legY = boardBaseY - legHeight / 2 - 0.02;
    const legLeft = new THREE.Mesh(new THREE.BoxGeometry(0.16, legHeight, 0.2), trimMat);
    legLeft.position.set(-sideOffset, legY, 0.02);
    const legRight = legLeft.clone();
    legRight.position.x = sideOffset;
    boardGroup.add(legLeft, legRight);

    const footY = TABLE_HEIGHT - 0.08;
    const footGeo = new THREE.BoxGeometry(0.54, 0.16, 0.28);
    const leftFoot = new THREE.Mesh(footGeo, railMat);
    leftFoot.position.set(-sideOffset - 0.04, footY, 0.04);
    const rightFoot = leftFoot.clone();
    rightFoot.position.x = sideOffset + 0.04;
    boardGroup.add(leftFoot, rightFoot);

    const holeRimGeo = new THREE.TorusGeometry(slotRadius * 0.97, slotRadius * 0.027, 16, 42);
    const holeRimMat = new THREE.MeshStandardMaterial({ color: '#9a856e', roughness: 0.52, metalness: 0.04 });
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const [x, y] = worldFromCell(r, c);
        const frontRim = new THREE.Mesh(holeRimGeo, holeRimMat);
        frontRim.position.set(x, y, boardThickness / 2 + 0.0012);
        const backRim = frontRim.clone();
        backRim.position.z = -boardThickness / 2 - 0.0012;
        boardGroup.add(frontRim, backRim);
      }
    }

    const createChipStack = (tokenColor, side = 'front', xOffset = 0, count = 6) => {
      const stack = new THREE.Group();
      const chipMat = new THREE.MeshStandardMaterial({ color: tokenColor, roughness: 0.3, metalness: 0.04 });
      const topMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(tokenColor).lerp(new THREE.Color('#ffffff'), 0.25), roughness: 0.24, metalness: 0.05 });
      const chipDepth = 0.024;
      for (let i = 0; i < count; i += 1) {
        const chip = new THREE.Mesh(new THREE.CylinderGeometry(slotRadius * 1.08, slotRadius * 1.08, chipDepth, 36), chipMat);
        chip.position.y = i * chipDepth * 0.85;
        stack.add(chip);
      }
      const topChip = new THREE.Mesh(new THREE.CylinderGeometry(slotRadius * 1.06, slotRadius * 1.06, chipDepth * 0.5, 36), topMat);
      topChip.position.y = count * chipDepth * 0.85 + chipDepth * 0.16;
      stack.add(topChip);

      const sideSign = side === 'front' ? 1 : -1;
      stack.position.set(xOffset, TABLE_HEIGHT + chipDepth / 2, sideSign * (TABLE_RADIUS * 0.58));
      stack.rotation.y = side === 'front' ? 0 : Math.PI;
      return stack;
    };

    boardGroup.add(
      createChipStack(CONNECT4_RED, 'front', -0.2, 7),
      createChipStack(CONNECT4_BLUE, 'back', 0.2, 7)
    );

    const hitPlane = new THREE.Mesh(new THREE.PlaneGeometry(boardWidth, boardHeight), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }));
    hitPlane.position.set(0, boardCenterY, 0.2);
    boardGroup.add(hitPlane);
    boardHitPlaneRef.current = hitPlane;

    const marker = new THREE.Mesh(new THREE.RingGeometry(slotRadius * 1.1, slotRadius * 1.45, 24), new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85 }));
    marker.position.set(0, boardCenterY + boardHeight / 2 + 0.22, 0.2);
    marker.visible = false;
    markerRef.current = marker;
    boardGroup.add(marker);

    const pieces = new THREE.Group();
    piecesGroupRef.current = pieces;
    boardGroup.add(pieces);
    scene.add(boardGroup);

    const onResize = () => {
      if (!mount) return;
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      const aspect = width / height;
      perspective.aspect = aspect;
      perspective.updateProjectionMatrix();
      const frustumWidth = Math.max(boardWidth * 1.22, boardHeight * aspect * 1.22);
      const frustumHeight = frustumWidth / aspect;
      topCamera.left = -frustumWidth / 2;
      topCamera.right = frustumWidth / 2;
      topCamera.top = frustumHeight / 2;
      topCamera.bottom = -frustumHeight / 2;
      topCamera.updateProjectionMatrix();
      const preset = GRAPHICS_PRESETS.find((g) => g.id === appearance.graphics) || GRAPHICS_PRESETS[0];
      renderer.setPixelRatio(Math.min(window.devicePixelRatio * preset.pixelRatioScale, 2));
      renderer.setSize(width, height);
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      key.shadow.mapSize.setScalar(preset.shadowMapSize);
    };
    onResize();

    let raf;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      controls.update();
      if (markerRef.current && Number.isInteger(hoverCol) && turn === 'player' && !winner) {
        const x = -boardWidth / 2 + (hoverCol + 0.5) * xStep;
        markerRef.current.visible = true;
        markerRef.current.position.x = x;
      } else if (markerRef.current) {
        markerRef.current.visible = false;
      }
      renderer.render(scene, viewMode === '2d' ? topCamera : perspective);
    };
    animate();

    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [rows, cols, appearance.boardTheme, appearance.tableId, appearance.tableFinish, appearance.chairId, appearance.graphics, viewMode, hoverCol, turn, winner, boardWidth, boardHeight, boardCenterY, slotRadius, xStep]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || envRef.current.hdriId === appearance.hdriId) return;
    let cancelled = false;
    const apply = async () => {
      const variant = POOL_ROYALE_HDRI_VARIANTS.find((h) => h.id === appearance.hdriId) || POOL_ROYALE_HDRI_VARIANTS[0];
      const url = await resolveHdriUrl(variant);
      const loader = url.toLowerCase().endsWith('.exr') ? new EXRLoader() : new RGBELoader();
      const envMap = await loader.loadAsync(url);
      if (cancelled) return;
      envMap.mapping = THREE.EquirectangularReflectionMapping;
      scene.environment = envMap;
      scene.background = envMap;
      if (envRef.current.skybox) scene.remove(envRef.current.skybox);
      const skybox = new GroundedSkybox(envMap, 16, Math.max(TABLE_RADIUS * 40, 32), 112);
      scene.add(skybox);
      envRef.current = { map: envMap, skybox, hdriId: appearance.hdriId };
    };
    void apply();
    return () => { cancelled = true; };
  }, [appearance.hdriId]);

  useEffect(() => {
    if (!winningCells.length) return;
    winningCells.forEach(([r, c], index) => {
      const piece = piecesMapRef.current.get(`${r}-${c}`);
      if (!piece) return;
      piece.scale.setScalar(1.1);
      setTimeout(() => {
        if (piece) piece.scale.setScalar(1);
      }, 300 + index * 60);
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
      setStatus(token === 'player' ? 'You connected 4 and won.' : 'AI connected 4 and won.');
      playTone(token === 'player' ? 760 : 220, 0.2, 'square', 0.03);
      return true;
    }
    if (isFull(next)) {
      setWinner('draw');
      setWinningCells([]);
      setStatus('Board full. Draw game.');
      playTone(200, 0.18, 'triangle', 0.02);
      return true;
    }
    setTurn(token === 'player' ? 'ai' : 'player');
    setStatus(token === 'player' ? 'AI is thinking…' : 'Your turn.');
    return true;
  };

  useEffect(() => {
    const renderer = rendererRef.current;
    const boardMesh = boardHitPlaneRef.current;
    const camera = viewMode === '2d' ? topCameraRef.current : perspectiveCameraRef.current;
    if (!renderer || !camera || !boardMesh) return undefined;

    const getColumnFromEvent = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      rayRef.current.setFromCamera(pointerRef.current, camera);
      const hit = rayRef.current.intersectObject(boardMesh, false)[0];
      if (!hit) return null;
      const normalizedX = (hit.point.x + boardWidth / 2) / boardWidth;
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
  }, [turn, winner, board, cols, viewMode, boardWidth]);

  useEffect(() => {
    if (turn !== 'ai' || winner) return;
    const t = setTimeout(() => {
      const depth = cols >= 8 ? 5 : 6;
      const col = chooseAiMove(board, 'ai', 'player', depth);
      if (Number.isInteger(col)) playColumn(col, 'ai');
    }, 420);
    return () => clearTimeout(t);
  }, [turn, winner, board, cols]);

  const playerCount = board.flat().filter((x) => x === 'player').length;
  const aiCount = board.flat().filter((x) => x === 'ai').length;

  const optionGroups = [
    { key: 'tableId', label: 'Tables', options: BADUK_TABLE_OPTIONS.map((item) => ({ id: item.id, label: item.label, thumbnail: item.thumbnail })) },
    { key: 'chairId', label: 'Chairs', options: BADUK_CHAIR_OPTIONS.map((item) => ({ id: item.id, label: item.label, thumbnail: item.thumbnail })) },
    { key: 'tableFinish', label: 'Table Cloth', options: MURLAN_TABLE_FINISHES.map((item) => ({ id: item.id, label: item.label, thumbnail: item.thumbnail })) },
    { key: 'hdriId', label: 'HDRI', options: POOL_ROYALE_HDRI_VARIANTS.map((item) => ({ id: item.id, label: item.name, thumbnail: item.thumbnail })) },
    { key: 'boardTheme', label: 'Board', options: BADUK_BOARD_THEMES.map((item) => ({ id: item.id, label: item.label, thumbnail: item.thumbnail })) },
    { key: 'stoneStyle', label: 'Pieces', options: BADUK_STONE_STYLES.map((item) => ({ id: item.id, label: item.label, thumbnail: item.thumbnail })) },
    { key: 'graphics', label: 'Graphics', options: GRAPHICS_PRESETS.map((item) => ({ id: item.id, label: item.label, thumbnail: '/assets/icons/four-in-row-royale.svg' })) }
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
            <span className="text-base leading-none" aria-hidden="true">☰</span>
            <span className="leading-none">Menu</span>
          </button>
          <div className="pointer-events-none rounded-2xl border border-white/15 bg-black/60 p-3 text-xs">
            <h1 className="text-sm font-semibold uppercase tracking-[0.18em]">4 in a Row</h1>
            <p className="mt-1 text-white/80">Board: {cols}×{rows} • You:{playerCount} • AI:{aiCount}</p>
            <p className="mt-1 text-white/75">{status}</p>
          </div>
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
            <button
              type="button"
              onClick={() => setViewMode((mode) => (mode === '3d' ? '2d' : '3d'))}
              className="icon-only-button flex h-10 w-10 items-center justify-center text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-white/90"
            >
              {viewMode === '3d' ? '2D' : '3D'}
            </button>
          </div>
          {configOpen && (
            <div className="pointer-events-auto mt-2 w-[min(90vw,32rem)] max-h-[72vh] overflow-y-auto rounded-2xl border border-white/15 bg-black/80 p-4 text-xs text-white shadow-2xl backdrop-blur">
              <p className="text-[10px] uppercase tracking-[0.4em] text-sky-200/80">4 in a Row Customization</p>
              <p className="mt-2 text-white/70">Layout: {BADUK_BATTLE_OPTION_LABELS.boardLayout[selectedLayout.id] || selectedLayout.label}</p>
              {optionGroups.map((group) => (
                <div key={group.key} className="mt-4">
                  <p className="text-[10px] uppercase tracking-[0.35em] text-white/70">{group.label}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {group.options.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setAppearance((prev) => ({ ...prev, [group.key]: option.id }))}
                        className={`rounded-xl border p-2 text-left ${appearance[group.key] === option.id ? 'border-cyan-300/70 bg-cyan-400/20' : 'border-white/15 bg-white/5'}`}
                      >
                        <img src={safeThumbnail(option.thumbnail)} alt={option.label} className="h-12 w-full rounded-lg object-cover" />
                        <p className="mt-1 truncate text-[10px] text-white/85">{option.label}</p>
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
        <div className="absolute left-1/2 top-[12%] -translate-x-1/2"><AvatarTimer photoUrl="🤖" name="AI Rival" active isTurn={turn === 'ai'} size={1} /></div>
        <div className="absolute left-1/2 top-[85%] -translate-x-1/2"><AvatarTimer photoUrl={avatar} name={username} active isTurn={turn === 'player'} size={1} /></div>
      </div>

      <div className="pointer-events-auto fixed bottom-4 right-3 z-50 flex gap-2">
        <button type="button" onClick={() => navigate('/store/badukbattleroyal')} className="rounded-xl border border-white/20 bg-black/60 px-3 py-2 text-xs">Store</button>
        <button
          type="button"
          onClick={() => {
            setBoard(createBoard(rows, cols));
            setTurn('player');
            setWinner(null);
            setWinningCells([]);
            setStatus('New match started. Your move.');
          }}
          className="rounded-xl border border-cyan-300/40 bg-cyan-400/30 px-3 py-2 text-xs font-semibold"
        >
          Restart
        </button>
      </div>

      <BottomLeftIcons onGift={() => setShowGift(true)} showInfo={false} showChat={false} showMute={false} className="fixed right-3 bottom-28 z-50 flex flex-col gap-4" buttonClassName="icon-only-button pointer-events-auto flex h-11 w-11 items-center justify-center text-white/90" iconClassName="text-[1.65rem] leading-none" labelClassName="sr-only" giftIcon="🎁" order={['gift']} />
      <BottomLeftIcons onChat={() => setShowChat(true)} showInfo={false} showGift={false} showMute={false} className="fixed left-3 bottom-28 z-50 flex flex-col" buttonClassName="icon-only-button pointer-events-auto flex h-11 w-11 items-center justify-center text-white/90" iconClassName="text-[1.65rem] leading-none" labelClassName="sr-only" chatIcon="💬" order={['chat']} />

      <QuickMessagePopup open={showChat} onClose={() => setShowChat(false)} title="Quick Chat" onSend={(text) => { const id = Date.now(); setChatBubbles((b) => [...b, { id, text, photoUrl: avatar || '/assets/icons/profile.svg' }]); setTimeout(() => setChatBubbles((b) => b.filter((x) => x.id !== id)), 3000); }} />
      {chatBubbles.map((bubble) => <div key={bubble.id} className="chat-bubble chess-battle-chat-bubble"><span>{bubble.text}</span><img src={bubble.photoUrl} alt="avatar" className="w-5 h-5 rounded-full" /></div>)}
      <GiftPopup open={showGift} onClose={() => setShowGift(false)} players={[{ index: 0, id: badukBattleAccountId(accountId || undefined), name: username, photoUrl: avatar || '/assets/icons/profile.svg' }, { index: 1, id: 'ai-rival', name: 'AI Rival', photoUrl: '/assets/icons/bot.webp' }]} senderIndex={0} title="Send Gift" />
    </div>
  );
}
