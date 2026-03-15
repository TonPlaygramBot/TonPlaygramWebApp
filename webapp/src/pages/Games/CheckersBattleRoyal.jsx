import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { GroundedSkybox } from 'three/examples/jsm/objects/GroundedSkybox.js';
import {
  applyRendererSRGB,
  applySRGBColorSpace
} from '../../utils/colorSpace.js';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import {
  getTelegramFirstName,
  getTelegramPhotoUrl
} from '../../utils/telegram.js';
import { ARENA_CAMERA_DEFAULTS } from '../../utils/arenaCameraConfig.js';
import {
  createMurlanStyleTable,
  applyTableMaterials
} from '../../utils/murlanTable.js';
import AvatarTimer from '../../components/AvatarTimer.jsx';
import BottomLeftIcons from '../../components/BottomLeftIcons.jsx';
import GiftPopup from '../../components/GiftPopup.jsx';
import QuickMessagePopup from '../../components/QuickMessagePopup.jsx';
import {
  CHESS_CHAIR_OPTIONS,
  CHESS_TABLE_OPTIONS
} from '../../config/chessBattleInventoryConfig.js';
import {
  POOL_ROYALE_DEFAULT_HDRI_ID,
  POOL_ROYALE_HDRI_VARIANTS
} from '../../config/poolRoyaleInventoryConfig.js';
import { MURLAN_TABLE_FINISHES } from '../../config/murlanTableFinishes.js';
import { chatBeep } from '../../assets/soundData.js';
import { getGameVolume } from '../../utils/sound.js';
import { giftSounds } from '../../utils/giftSounds.js';
import {
  chessBattleAccountId,
  getChessBattleInventory
} from '../../utils/chessBattleInventory.js';

const SIZE = 8;
const MODEL_SCALE = 0.75;
const STOOL_SCALE = 1.5 * 1.3;
const TABLE_RADIUS = 3.4 * MODEL_SCALE;
const BASE_TABLE_HEIGHT = 1.08 * MODEL_SCALE;
const SEAT_THICKNESS = 0.09 * MODEL_SCALE * STOOL_SCALE;
const CHAIR_BASE_HEIGHT = BASE_TABLE_HEIGHT - SEAT_THICKNESS * 0.85;
const STOOL_HEIGHT = CHAIR_BASE_HEIGHT + SEAT_THICKNESS;
const TABLE_HEIGHT = STOOL_HEIGHT + 0.05 * MODEL_SCALE;
const BOARD_SCALE = 0.0576;
const BOARD_VISUAL_Y_OFFSET = -0.08;
const BOARD_TILE_SIZE = ((SIZE * 4.2 + 3 * 2) * BOARD_SCALE) / SIZE;
const CHAIR_DISTANCE = TABLE_RADIUS + 0.82;
const SEAT_WIDTH = 0.9 * MODEL_SCALE * STOOL_SCALE;
const SEAT_DEPTH = 0.95 * MODEL_SCALE * STOOL_SCALE;
const SEAT_THICKNESS_SCALED = 0.09 * MODEL_SCALE * STOOL_SCALE;
const BACK_HEIGHT = 0.68 * MODEL_SCALE * STOOL_SCALE;
const BACK_THICKNESS = 0.08 * MODEL_SCALE * STOOL_SCALE;
const ARM_THICKNESS = 0.125 * MODEL_SCALE * STOOL_SCALE;
const ARM_HEIGHT = 0.3 * MODEL_SCALE * STOOL_SCALE;
const ARM_DEPTH = SEAT_DEPTH * 0.75;
const BASE_COLUMN_HEIGHT = 0.5 * MODEL_SCALE * STOOL_SCALE;
const HDRI_UNITS_PER_METER = 10;
const MIN_HDRI_CAMERA_HEIGHT_M = 0.4;
const MIN_HDRI_RADIUS = 28;
const DEFAULT_HDRI_RADIUS_MULTIPLIER = 4;
const DEFAULT_HDRI_GROUNDED_RESOLUTION = 112;
const DRACO_DECODER_PATH =
  'https://www.gstatic.com/draco/versioned/decoders/1.5.7/';
const BASIS_TRANSCODER_PATH =
  'https://cdn.jsdelivr.net/npm/three@0.164.0/examples/jsm/libs/basis/';

let sharedKtx2Loader = null;
let hasDetectedKtx2Support = false;
const BEAUTIFUL_GAME_URLS = [
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/ABeautifulGame/glTF/ABeautifulGame.gltf',
  'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/ABeautifulGame/glTF/ABeautifulGame.gltf',
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/ABeautifulGame/glTF/ABeautifulGame.gltf',
  'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/ABeautifulGame/glTF/ABeautifulGame.gltf'
];

const CHAIR_MODEL_URLS = [
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/AntiqueChair/glTF-Binary/AntiqueChair.glb',
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/SheenChair/glTF-Binary/SheenChair.glb',
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/AntiqueChair/glTF-Binary/AntiqueChair.glb'
];
const TARGET_CHAIR_SIZE = new THREE.Vector3(
  1.3162499970197679,
  1.9173749900311232,
  1.7001562547683715
);
const TARGET_CHAIR_MIN_Y = -0.8570624993294478;
const TARGET_CHAIR_CENTER_Z = -0.1553906416893005;
const MOVE_SOUND_URL =
  'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard/Move.mp3';
const CHECKERS_HIGHLIGHT_COLORS = Object.freeze({
  selection: '#ff8e6e',
  move: '#7ef9a1',
  capture: '#ff8e6e'
});

const CHIP_SETS = [
  { id: 'ruby-cyan', label: 'Ruby/Cyan', light: '#ef4444', dark: '#06b6d4' },
  {
    id: 'emerald-violet',
    label: 'Emerald/Violet',
    light: '#10b981',
    dark: '#8b5cf6'
  },
  {
    id: 'amber-slate',
    label: 'Amber/Slate',
    light: '#f59e0b',
    dark: '#334155'
  },
  { id: 'rose-ice', label: 'Rose/Ice', light: '#fb7185', dark: '#67e8f9' }
];

const FALLBACK_SEAT_POSITIONS = [
  { left: '50%', top: '18%' },
  { left: '50%', top: '82%' }
];

const createInitial = () => {
  const board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  for (let r = 0; r < 3; r += 1)
    for (let c = 0; c < SIZE; c += 1)
      if ((r + c) % 2 === 1) board[r][c] = { side: 'dark', king: false };
  for (let r = 5; r < SIZE; r += 1)
    for (let c = 0; c < SIZE; c += 1)
      if ((r + c) % 2 === 1) board[r][c] = { side: 'light', king: false };
  return board;
};

const inBounds = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;
const copyBoard = (board) =>
  board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));

const getMoves = (board, r, c) => {
  const piece = board[r][c];
  if (!piece) return [];
  const dirs = piece.king
    ? [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1]
      ]
    : piece.side === 'light'
      ? [
          [-1, 1],
          [-1, -1]
        ]
      : [
          [1, 1],
          [1, -1]
        ];
  const captures = [];
  const normals = [];
  dirs.forEach(([dr, dc]) => {
    const nr = r + dr;
    const nc = c + dc;
    if (!inBounds(nr, nc)) return;
    if (!board[nr][nc]) normals.push({ r: nr, c: nc });
    else if (board[nr][nc].side !== piece.side) {
      const jr = nr + dr;
      const jc = nc + dc;
      if (inBounds(jr, jc) && !board[jr][jc])
        captures.push({ r: jr, c: jc, capture: [nr, nc] });
    }
  });
  return captures.length ? captures : normals;
};

async function loadBeautifulBoard(loader) {
  let err = null;
  for (const url of BEAUTIFUL_GAME_URLS) {
    try {
      const gltf = await loader.loadAsync(url);
      if (gltf?.scene) return gltf.scene;
    } catch (e) {
      err = e;
    }
  }
  throw err || new Error('ABeautifulGame failed to load');
}

function ensureKtx2SupportDetection(renderer = null) {
  if (!sharedKtx2Loader || hasDetectedKtx2Support || !renderer) return;
  try {
    sharedKtx2Loader.detectSupport(renderer);
    hasDetectedKtx2Support = true;
  } catch (error) {
    console.warn('Checkers Battle Royal: KTX2 support detection failed', error);
  }
}

function createConfiguredGLTFLoader(renderer = null) {
  const loader = new GLTFLoader();
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
    model.scale.multiplyScalar(targetMax / currentMax);
  }
  const scaledBox = new THREE.Box3().setFromObject(model);
  const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
  model.position.add(
    new THREE.Vector3(
      -scaledCenter.x,
      TARGET_CHAIR_MIN_Y - scaledBox.min.y,
      TARGET_CHAIR_CENTER_Z - scaledCenter.z
    )
  );
}

async function buildChessMappedChairTemplate() {
  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath(DRACO_DECODER_PATH);
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
  if (!gltf) throw lastError || new Error('Failed to load mapped chair');
  const model = gltf.scene || gltf.scenes?.[0];
  if (!model) throw new Error('Missing chair model scene');
  model.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach((mat) => {
      if (mat?.map) applySRGBColorSpace(mat.map);
      if (mat?.emissiveMap) applySRGBColorSpace(mat.emissiveMap);
    });
  });
  fitChairModelToFootprint(model);
  return model;
}

function createProceduralChairFallback(chairColor, legColor) {
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

async function resolveHdriUrl(variant) {
  const fallbackRes = variant?.fallbackResolution || '4k';
  const fallback = `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/${fallbackRes}/${variant?.assetId || 'colorful_studio'}_${fallbackRes}.hdr`;
  if (!variant?.assetId) return fallback;
  try {
    const res = await fetch(
      `https://api.polyhaven.com/files/${encodeURIComponent(variant.assetId)}`
    );
    if (!res.ok) return fallback;
    const data = await res.json();
    const urls = [];
    const walk = (value) => {
      if (!value) return;
      if (typeof value === 'string') {
        const low = value.toLowerCase();
        if (
          value.startsWith('http') &&
          (low.endsWith('.hdr') || low.endsWith('.exr'))
        )
          urls.push(value);
      } else if (Array.isArray(value)) value.forEach(walk);
      else if (typeof value === 'object') Object.values(value).forEach(walk);
    };
    walk(data);
    return (
      urls.find((u) => u.includes(`/${fallbackRes}/`)) || urls[0] || fallback
    );
  } catch {
    return fallback;
  }
}

export default function CheckersBattleRoyal() {
  useTelegramBackButton();
  const navigate = useNavigate();
  const mountRef = useRef(null);

  const boardRef = useRef(createInitial());
  const selectedRef = useRef(null);
  const piecesGroupRef = useRef(null);
  const boardOriginRef = useRef({ x: 0, y: 0.75, z: 0, tile: 2.65 });
  const replayStateRef = useRef(null);
  const highlightGroupRef = useRef(null);
  const moveSoundRef = useRef(null);

  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const tableRef = useRef(null);
  const chairsRef = useRef([]);
  const envRef = useRef({ map: null, skybox: null });

  const [turn, setTurn] = useState('light');
  const [status, setStatus] = useState('Loading arena…');
  const [configOpen, setConfigOpen] = useState(false);
  const [viewMode, setViewMode] = useState('3d');
  const [showGift, setShowGift] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatBubbles, setChatBubbles] = useState([]);
  const [canReplay, setCanReplay] = useState(false);

  const inv = useMemo(() => {
    const inventory = getChessBattleInventory(chessBattleAccountId());
    return {
      tableId: inventory.tables?.[0] || CHESS_TABLE_OPTIONS[0]?.id,
      chairId: inventory.chairColor?.[0] || CHESS_CHAIR_OPTIONS[0]?.id,
      tableFinish: inventory.tableFinish?.[0] || MURLAN_TABLE_FINISHES[0]?.id,
      hdriId: inventory.environmentHdri?.[0] || POOL_ROYALE_DEFAULT_HDRI_ID
    };
  }, []);

  const [appearance, setAppearance] = useState(inv);
  const [chipSetId, setChipSetId] = useState(CHIP_SETS[0].id);

  const chipSet = CHIP_SETS.find((s) => s.id === chipSetId) || CHIP_SETS[0];
  const playerName = getTelegramFirstName() || 'Player';
  const playerPhotoUrl = getTelegramPhotoUrl() || '/assets/icons/profile.svg';

  const players = [
    {
      index: 0,
      name: 'Rival',
      photoUrl: '/assets/icons/profile.svg',
      color: '#f43f5e',
      isTurn: turn === 'dark'
    },
    {
      index: 1,
      name: playerName,
      photoUrl: playerPhotoUrl,
      color: '#38bdf8',
      isTurn: turn === 'light'
    }
  ];

  const renderPieces = useMemo(
    () => () => {
      const group = piecesGroupRef.current;
      if (!group) return;
      group.clear();
      const board = boardRef.current;
      const { x, y, z, tile } = boardOriginRef.current;
      for (let r = 0; r < SIZE; r += 1) {
        for (let c = 0; c < SIZE; c += 1) {
          const piece = board[r][c];
          if (!piece) continue;
          const chip = new THREE.Mesh(
            new THREE.CylinderGeometry(
              tile * 0.28,
              tile * 0.28,
              tile * 0.13,
              40
            ),
            new THREE.MeshStandardMaterial({
              color: piece.side === 'light' ? chipSet.light : chipSet.dark,
              roughness: 0.25,
              metalness: 0.52
            })
          );
          chip.castShadow = true;
          chip.position.set(
            x + (c - 3.5) * tile,
            y + tile * 0.075,
            z + (r - 3.5) * tile
          );
          chip.userData = { r, c, side: piece.side };
          if (piece.king) {
            const ring = new THREE.Mesh(
              new THREE.TorusGeometry(tile * 0.17, tile * 0.04, 12, 30),
              new THREE.MeshStandardMaterial({
                color: '#f8fafc',
                metalness: 0.92,
                roughness: 0.18
              })
            );
            ring.rotation.x = Math.PI / 2;
            ring.position.y = tile * 0.09;
            chip.add(ring);
          }
          group.add(chip);
        }
      }
    },
    [chipSet.dark, chipSet.light]
  );

  useEffect(() => {
    renderPieces();
  }, [renderPieces, turn]);

  const renderHighlights = useMemo(
    () => () => {
      const group = highlightGroupRef.current;
      if (!group) return;
      group.clear();
      const selected = selectedRef.current;
      if (!selected) return;
      const board = boardRef.current;
      const { x, y, z, tile } = boardOriginRef.current;
      const toPosition = (r, c) =>
        new THREE.Vector3(
          x + (c - 3.5) * tile,
          y + tile * 0.02,
          z + (r - 3.5) * tile
        );
      const selection = new THREE.Mesh(
        new THREE.CylinderGeometry(
          tile * 0.3,
          tile * 0.3,
          Math.max(0.07, tile * 0.03),
          20
        ),
        new THREE.MeshBasicMaterial({
          color: CHECKERS_HIGHLIGHT_COLORS.selection,
          transparent: true,
          opacity: 0.9
        })
      );
      selection.position.copy(toPosition(selected.r, selected.c));
      group.add(selection);
      getMoves(board, selected.r, selected.c).forEach((move) => {
        const isCapture = Array.isArray(move.capture);
        const marker = new THREE.Mesh(
          new THREE.CylinderGeometry(
            tile * 0.26,
            tile * 0.26,
            Math.max(0.06, tile * 0.03),
            20
          ),
          new THREE.MeshBasicMaterial({
            color: isCapture
              ? CHECKERS_HIGHLIGHT_COLORS.capture
              : CHECKERS_HIGHLIGHT_COLORS.move,
            transparent: true,
            opacity: 0.9
          })
        );
        marker.position.copy(toPosition(move.r, move.c));
        group.add(marker);
      });
    },
    []
  );

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0b1220');
    sceneRef.current = scene;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    applyRendererSRGB(renderer);
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(
      ARENA_CAMERA_DEFAULTS.fov,
      mount.clientWidth / mount.clientHeight,
      ARENA_CAMERA_DEFAULTS.near,
      ARENA_CAMERA_DEFAULTS.far
    );
    cameraRef.current = camera;

    const isPortrait = mount.clientHeight > mount.clientWidth;
    const cameraSeatAngle = Math.PI / 2;
    const cameraBackOffset = (isPortrait ? 2.55 : 1.78) + 0.35;
    const cameraForwardOffset = isPortrait ? 0.08 : 0.2;
    const cameraHeightOffset = isPortrait ? 1.72 : 1.34;
    const cameraRadius =
      CHAIR_DISTANCE + cameraBackOffset - cameraForwardOffset;
    camera.position.set(
      Math.cos(cameraSeatAngle) * cameraRadius,
      TABLE_HEIGHT + cameraHeightOffset,
      Math.sin(cameraSeatAngle) * cameraRadius
    );

    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, TABLE_HEIGHT, 0);
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.minDistance = TABLE_RADIUS * 1.85;
    controls.maxDistance = TABLE_RADIUS * 4.9;
    controls.minPolarAngle = THREE.MathUtils.degToRad(28);
    controls.maxPolarAngle = ARENA_CAMERA_DEFAULTS.phiMax;

    scene.add(new THREE.AmbientLight('#ffffff', 0.5));
    const key = new THREE.DirectionalLight('#ffffff', 1.08);
    key.position.set(18, 26, 12);
    key.castShadow = true;
    scene.add(key);

    const piecesGroup = new THREE.Group();
    piecesGroupRef.current = piecesGroup;
    scene.add(piecesGroup);
    const highlightGroup = new THREE.Group();
    highlightGroupRef.current = highlightGroup;
    scene.add(highlightGroup);

    moveSoundRef.current = new Audio(MOVE_SOUND_URL);
    moveSoundRef.current.volume = getGameVolume();

    const pickTiles = [];
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const applyMove = (r, c) => {
      const board = boardRef.current;
      const selected = selectedRef.current;
      const piece = board[r][c];
      if (piece && piece.side === turn) {
        selectedRef.current = { r, c };
        renderHighlights();
        return;
      }
      if (!selected) return;
      const moves = getMoves(board, selected.r, selected.c);
      const move = moves.find((m) => m.r === r && m.c === c);
      if (!move) return;
      const beforeBoard = copyBoard(board);
      const next = board.map((row) => row.slice());
      const moving = { ...next[selected.r][selected.c] };
      next[selected.r][selected.c] = null;
      if (move.capture) next[move.capture[0]][move.capture[1]] = null;
      if (moving.side === 'light' && r === 0) moving.king = true;
      if (moving.side === 'dark' && r === SIZE - 1) moving.king = true;
      next[r][c] = moving;
      boardRef.current = next;
      selectedRef.current = null;
      moveSoundRef.current?.play().catch(() => {});
      const nextTurn = turn === 'light' ? 'dark' : 'light';
      replayStateRef.current = {
        beforeBoard,
        afterBoard: copyBoard(next),
        beforeTurn: turn,
        afterTurn: nextTurn
      };
      setCanReplay(true);
      setTurn(nextTurn);
      renderHighlights();
    };

    const onPointerUp = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(pickTiles, false)[0];
      if (hit?.object?.userData)
        applyMove(hit.object.userData.r, hit.object.userData.c);
    };

    const buildSceneAssets = async () => {
      const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });
      const setupPickTiles = () => {
        const { x, y, z, tile } = boardOriginRef.current;
        if (pickTiles.length) return;
        for (let r = 0; r < SIZE; r += 1) {
          for (let c = 0; c < SIZE; c += 1) {
            const pick = new THREE.Mesh(
              new THREE.BoxGeometry(tile * 0.94, 0.25, tile * 0.94),
              pickMaterial
            );
            pick.position.set(
              x + (c - 3.5) * tile,
              y + 0.16,
              z + (r - 3.5) * tile
            );
            pick.userData = { r, c };
            pickTiles.push(pick);
            scene.add(pick);
          }
        }
      };

      try {
        const table = createMurlanStyleTable({
          arena: scene,
          renderer,
          tableRadius: TABLE_RADIUS,
          tableHeight: TABLE_HEIGHT
        });
        const finish =
          MURLAN_TABLE_FINISHES.find((f) => f.id === appearance.tableFinish) ||
          MURLAN_TABLE_FINISHES[0];
        applyTableMaterials(table.parts, finish);
        tableRef.current = table;
      } catch (error) {
        console.error('Checkers table load failed:', error);
      }

      try {
        const chairOption =
          CHESS_CHAIR_OPTIONS.find((c) => c.id === appearance.chairId) ||
          CHESS_CHAIR_OPTIONS[0];
        const chairColor =
          chairOption?.primary || chairOption?.seatColor || '#8b0000';
        const chairTemplate = await buildChessMappedChairTemplate();
        const makeChair = (z, ry) => {
          const g = chairTemplate.clone(true);
          g.traverse((obj) => {
            if (!obj.isMesh) return;
            const mats = Array.isArray(obj.material)
              ? obj.material
              : [obj.material];
            mats.forEach((mat) => {
              if (mat?.color) mat.color.set(chairColor);
              mat.needsUpdate = true;
            });
          });
          g.position.set(0, CHAIR_BASE_HEIGHT, z);
          g.rotation.y = ry;
          scene.add(g);
          return g;
        };
        chairsRef.current = [
          makeChair(CHAIR_DISTANCE, Math.PI),
          makeChair(-CHAIR_DISTANCE, 0)
        ];
      } catch (error) {
        console.error('Checkers chairs load failed, using fallback:', error);
        const chairOption =
          CHESS_CHAIR_OPTIONS.find((c) => c.id === appearance.chairId) ||
          CHESS_CHAIR_OPTIONS[0];
        const chairColor =
          chairOption?.primary || chairOption?.seatColor || '#8b0000';
        const legColor = chairOption?.legColor || '#111827';
        const makeFallback = (z, ry) => {
          const g = createProceduralChairFallback(chairColor, legColor);
          g.position.set(0, CHAIR_BASE_HEIGHT, z);
          g.rotation.y = ry;
          scene.add(g);
          return g;
        };
        chairsRef.current = [
          makeFallback(CHAIR_DISTANCE, Math.PI),
          makeFallback(-CHAIR_DISTANCE, 0)
        ];
      }

      const addVisibleBoardBase = () => {
        const boardBase = new THREE.Group();
        const lightMat = new THREE.MeshStandardMaterial({
          color: '#d1d5db',
          roughness: 0.34,
          metalness: 0.22
        });
        const darkMat = new THREE.MeshStandardMaterial({
          color: '#1f2937',
          roughness: 0.4,
          metalness: 0.28
        });
        for (let r = 0; r < SIZE; r += 1) {
          for (let c = 0; c < SIZE; c += 1) {
            const sq = new THREE.Mesh(
              new THREE.BoxGeometry(BOARD_TILE_SIZE, 0.06, BOARD_TILE_SIZE),
              (r + c) % 2 ? darkMat : lightMat
            );
            sq.position.set(
              (c - 3.5) * BOARD_TILE_SIZE,
              TABLE_HEIGHT + 0.02,
              (r - 3.5) * BOARD_TILE_SIZE
            );
            sq.receiveShadow = true;
            boardBase.add(sq);
          }
        }
        scene.add(boardBase);
      };

      addVisibleBoardBase();

      try {
        const boardRoot = await loadBeautifulBoard(
          createConfiguredGLTFLoader(renderer)
        );
        const boardVisualGroup = new THREE.Group();
        boardVisualGroup.position.y = BOARD_VISUAL_Y_OFFSET;
        boardVisualGroup.add(boardRoot);
        scene.add(boardVisualGroup);
        boardRoot.scale.setScalar(BOARD_SCALE);
        boardRoot.position.set(0, TABLE_HEIGHT, 0);
      } catch {}

      boardOriginRef.current = {
        x: 0,
        y: TABLE_HEIGHT + 0.08,
        z: 0,
        tile: BOARD_TILE_SIZE
      };

      setupPickTiles();
      renderPieces();
      renderHighlights();
      setStatus('Tap your piece, then a highlighted square to move.');
    };

    void buildSceneAssets();

    const onResize = () => {
      if (!mount) return;
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
    };

    renderer.domElement.addEventListener('pointerup', onPointerUp);
    window.addEventListener('resize', onResize);

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      controls.update();
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.dispose();
      moveSoundRef.current?.pause();
      moveSoundRef.current = null;
      if (mount.contains(renderer.domElement))
        mount.removeChild(renderer.domElement);
      cameraRef.current = null;
      controlsRef.current = null;
    };
  }, [renderPieces, appearance.chairId, appearance.tableFinish]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const finish =
      MURLAN_TABLE_FINISHES.find((f) => f.id === appearance.tableFinish) ||
      MURLAN_TABLE_FINISHES[0];
    if (tableRef.current?.parts)
      applyTableMaterials(tableRef.current.parts, finish);

    const chairOption =
      CHESS_CHAIR_OPTIONS.find((c) => c.id === appearance.chairId) ||
      CHESS_CHAIR_OPTIONS[0];
    const nextChairColor = new THREE.Color(
      chairOption?.primary || chairOption?.seatColor || '#8b0000'
    );
    chairsRef.current.forEach((chairGroup) => {
      chairGroup?.traverse?.((child) => {
        if (child?.isMesh && child.material?.color) {
          child.material.color.copy(nextChairColor);
          child.material.needsUpdate = true;
        }
      });
    });

    if (envRef.current?.hdriId === appearance.hdriId) return;

    const applyHdri = async () => {
      try {
        const variant =
          POOL_ROYALE_HDRI_VARIANTS.find((h) => h.id === appearance.hdriId) ||
          POOL_ROYALE_HDRI_VARIANTS[0];
        const url = await resolveHdriUrl(variant);
        const loaderEnv = url.toLowerCase().endsWith('.exr')
          ? new EXRLoader()
          : new RGBELoader();
        const envMap = await loaderEnv.loadAsync(url);
        envMap.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = envMap;
        scene.background = envMap;
        if (envRef.current?.skybox) scene.remove(envRef.current.skybox);
        const cameraHeight =
          Math.max(variant?.cameraHeightM ?? 1.5, MIN_HDRI_CAMERA_HEIGHT_M) *
          HDRI_UNITS_PER_METER;
        const radiusMultiplier =
          typeof variant?.groundRadiusMultiplier === 'number'
            ? variant.groundRadiusMultiplier
            : DEFAULT_HDRI_RADIUS_MULTIPLIER;
        const groundRadius = Math.max(
          TABLE_RADIUS * HDRI_UNITS_PER_METER * radiusMultiplier,
          MIN_HDRI_RADIUS
        );
        const skyboxResolution = Math.max(
          16,
          Math.floor(
            variant?.groundResolution ?? DEFAULT_HDRI_GROUNDED_RESOLUTION
          )
        );
        const skybox = new GroundedSkybox(
          envMap,
          cameraHeight,
          groundRadius,
          skyboxResolution
        );
        skybox.position.y = cameraHeight;
        if (typeof variant?.rotationY === 'number')
          skybox.rotation.y = variant.rotationY;
        scene.add(skybox);
        envRef.current = { map: envMap, skybox, hdriId: appearance.hdriId };
      } catch (error) {
        console.error('Checkers HDRI swap failed:', error);
      }
    };

    void applyHdri();
  }, [appearance]);

  useEffect(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    const target = new THREE.Vector3(0, TABLE_HEIGHT, 0);
    if (viewMode === '2d') {
      camera.position.set(0, TABLE_HEIGHT + 9.2, 0.001);
      controls.enableRotate = false;
      controls.minPolarAngle = 0;
      controls.maxPolarAngle = 0;
    } else {
      const cameraSeatAngle = Math.PI / 2;
      const cameraRadius = CHAIR_DISTANCE + 2.7;
      camera.position.set(
        Math.cos(cameraSeatAngle) * cameraRadius,
        TABLE_HEIGHT + 1.72,
        Math.sin(cameraSeatAngle) * cameraRadius
      );
      controls.enableRotate = true;
      controls.minPolarAngle = THREE.MathUtils.degToRad(28);
      controls.maxPolarAngle = ARENA_CAMERA_DEFAULTS.phiMax;
    }
    controls.target.copy(target);
    controls.update();
  }, [viewMode]);

  const replayLastMove = () => {
    if (!replayStateRef.current) return;
    const replay = replayStateRef.current;
    boardRef.current = copyBoard(replay.beforeBoard);
    setTurn(replay.beforeTurn);
    renderPieces();
    setTimeout(() => {
      boardRef.current = copyBoard(replay.afterBoard);
      setTurn(replay.afterTurn);
      renderPieces();
    }, 700);
  };

  const optionButton = (active) =>
    `rounded-lg border px-2 py-1 text-[11px] ${active ? 'border-cyan-300 bg-cyan-500/20 text-cyan-100' : 'border-white/15 bg-white/5 text-white/70'}`;

  return (
    <div className="fixed inset-0 bg-[#050814] text-white">
      <div ref={mountRef} className="h-full w-full" />
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-4 z-20 flex flex-col items-start gap-3 pointer-events-none">
          <button
            type="button"
            onClick={() => setConfigOpen((open) => !open)}
            className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-gray-100"
          >
            <span className="text-base leading-none">☰</span>
            <span className="leading-none">Menu</span>
          </button>
        </div>

        <div className="absolute top-20 right-4 z-20 flex flex-col items-end gap-3 pointer-events-none">
          <div className="pointer-events-auto flex flex-col items-end gap-3">
            <button
              type="button"
              onClick={replayLastMove}
              disabled={!canReplay}
              className={`icon-only-button flex h-10 w-10 items-center justify-center text-[1.4rem] ${canReplay ? 'text-white/90' : 'text-white/40'}`}
            >
              ↺
            </button>
            <button
              type="button"
              onClick={() =>
                setViewMode((mode) => (mode === '3d' ? '2d' : '3d'))
              }
              className="icon-only-button flex h-10 w-10 items-center justify-center text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-white/90"
            >
              {viewMode === '3d' ? '2D' : '3D'}
            </button>
          </div>
          {configOpen && (
            <div className="pointer-events-auto mt-2 w-72 max-w-[80vw] rounded-2xl border border-white/15 bg-black/80 p-4 text-xs text-white shadow-2xl backdrop-blur max-h-[80vh] overflow-y-auto pr-1">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-white/80">
                Checkers Battle Royal
              </div>
              <button
                type="button"
                onClick={() =>
                  setViewMode((mode) => (mode === '3d' ? '2d' : '3d'))
                }
                className="w-full rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/90"
              >
                {viewMode === '3d' ? '2D View' : '3D View'}
              </button>
              <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-white/70">
                  Table Finish
                </div>
                <div className="mb-3 grid max-h-40 grid-cols-2 gap-2 overflow-auto">
                  {MURLAN_TABLE_FINISHES.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() =>
                        setAppearance((prev) => ({
                          ...prev,
                          tableFinish: opt.id
                        }))
                      }
                      className={`rounded-xl border px-2 py-2 text-[11px] ${appearance.tableFinish === opt.id ? 'border-cyan-300 bg-cyan-500/20 text-cyan-100' : 'border-white/15 bg-white/5 text-white/70'}`}
                    >
                      {opt.thumbnail ? (
                        <img
                          src={opt.thumbnail}
                          alt={`${opt.label} thumbnail`}
                          className="mb-1 h-10 w-full rounded object-cover"
                        />
                      ) : null}
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-white/70">
                  Tables
                </div>
                <div className="mb-3 grid max-h-40 grid-cols-2 gap-2 overflow-auto">
                  {CHESS_TABLE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() =>
                        setAppearance((prev) => ({ ...prev, tableId: opt.id }))
                      }
                      className={`rounded-xl border px-2 py-2 text-[11px] ${appearance.tableId === opt.id ? 'border-cyan-300 bg-cyan-500/20 text-cyan-100' : 'border-white/15 bg-white/5 text-white/70'}`}
                    >
                      {opt.thumbnail ? (
                        <img
                          src={opt.thumbnail}
                          alt={`${opt.label} thumbnail`}
                          className="mb-1 h-10 w-full rounded object-cover"
                        />
                      ) : null}
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-white/70">
                  Chairs
                </div>
                <div className="mb-3 grid max-h-40 grid-cols-2 gap-2 overflow-auto">
                  {CHESS_CHAIR_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() =>
                        setAppearance((prev) => ({ ...prev, chairId: opt.id }))
                      }
                      className={`rounded-xl border px-2 py-2 text-[11px] ${appearance.chairId === opt.id ? 'border-cyan-300 bg-cyan-500/20 text-cyan-100' : 'border-white/15 bg-white/5 text-white/70'}`}
                    >
                      {opt.thumbnail ? (
                        <img
                          src={opt.thumbnail}
                          alt={`${opt.label} thumbnail`}
                          className="mb-1 h-10 w-full rounded object-cover"
                        />
                      ) : null}
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="mb-2 text-[11px] text-white/70">HDRI</div>
                <div className="mb-3 flex max-h-24 flex-wrap gap-2 overflow-auto">
                  {POOL_ROYALE_HDRI_VARIANTS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() =>
                        setAppearance((prev) => ({ ...prev, hdriId: opt.id }))
                      }
                      className={optionButton(appearance.hdriId === opt.id)}
                    >
                      {opt.name}
                    </button>
                  ))}
                </div>

                <div className="mb-2 text-[11px] text-white/70">Chips</div>
                <div className="flex flex-wrap gap-2">
                  {CHIP_SETS.map((set) => (
                    <button
                      key={set.id}
                      onClick={() => setChipSetId(set.id)}
                      className={optionButton(chipSetId === set.id)}
                    >
                      {set.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="pointer-events-auto">
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
        </div>

        <div className="absolute inset-0 z-10 pointer-events-none">
          {players.map((player) => (
            <div
              key={`checkers-seat-${player.index}`}
              className="absolute pointer-events-auto flex flex-col items-center"
              data-player-index={player.index}
              style={{
                left: FALLBACK_SEAT_POSITIONS[player.index].left,
                top: FALLBACK_SEAT_POSITIONS[player.index].top,
                transform: 'translate(-50%, -50%)'
              }}
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
              <span className="mt-1 text-[0.65rem] font-semibold text-white">
                {player.name}
              </span>
            </div>
          ))}
        </div>

        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="px-5 py-2 rounded-full bg-[rgba(7,10,18,0.65)] border border-[rgba(255,215,0,0.25)] text-sm font-semibold backdrop-blur">
            {status} • Turn: {turn}
          </div>
        </div>
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

      <div className="pointer-events-auto">
        <QuickMessagePopup
          open={showChat}
          onClose={() => setShowChat(false)}
          title="Quick Chat"
          onSend={(text) => {
            const id = Date.now();
            setChatBubbles((bubbles) => [
              ...bubbles,
              { id, text, photoUrl: playerPhotoUrl }
            ]);
            const audio = new Audio(chatBeep);
            audio.volume = getGameVolume();
            audio.play().catch(() => {});
            setTimeout(
              () =>
                setChatBubbles((bubbles) =>
                  bubbles.filter((bubble) => bubble.id !== id)
                ),
              1800
            );
          }}
        />
      </div>
      <div className="pointer-events-auto">
        <GiftPopup
          open={showGift}
          onClose={() => setShowGift(false)}
          onGiftSent={({ gift }) => {
            const giftSound = giftSounds[gift.id];
            if (!giftSound) return;
            const audio = new Audio(giftSound);
            audio.volume = getGameVolume();
            audio.play().catch(() => {});
          }}
        />
      </div>
    </div>
  );
}
