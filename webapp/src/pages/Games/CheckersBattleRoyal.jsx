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
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { ARENA_CAMERA_DEFAULTS } from '../../utils/arenaCameraConfig.js';
import { createMurlanStyleTable, applyTableMaterials } from '../../utils/murlanTable.js';
import {
  CHESS_CHAIR_OPTIONS,
  CHESS_TABLE_OPTIONS,
  CHESS_BATTLE_OPTION_LABELS
} from '../../config/chessBattleInventoryConfig.js';
import {
  POOL_ROYALE_DEFAULT_HDRI_ID,
  POOL_ROYALE_HDRI_VARIANTS
} from '../../config/poolRoyaleInventoryConfig.js';
import { MURLAN_TABLE_FINISHES } from '../../config/murlanTableFinishes.js';
import { chessBattleAccountId, getChessBattleInventory } from '../../utils/chessBattleInventory.js';

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
const CHAIR_DISTANCE = TABLE_RADIUS + 0.82;
const HDRI_UNITS_PER_METER = 10;
const MIN_HDRI_CAMERA_HEIGHT_M = 0.4;
const MIN_HDRI_RADIUS = 28;
const DEFAULT_HDRI_RADIUS_MULTIPLIER = 4;
const DEFAULT_HDRI_GROUNDED_RESOLUTION = 112;
const DRACO_DECODER_PATH = 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/';
const BASIS_TRANSCODER_PATH = 'https://cdn.jsdelivr.net/npm/three@0.164.0/examples/jsm/libs/basis/';

let sharedKtx2Loader = null;
let hasDetectedKtx2Support = false;
const BEAUTIFUL_GAME_URLS = [
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/ABeautifulGame/glTF/ABeautifulGame.gltf',
  'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/ABeautifulGame/glTF/ABeautifulGame.gltf',
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/ABeautifulGame/glTF/ABeautifulGame.gltf',
  'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/ABeautifulGame/glTF/ABeautifulGame.gltf'
];

const CHIP_SETS = [
  { id: 'ruby-cyan', label: 'Ruby/Cyan', light: '#ef4444', dark: '#06b6d4' },
  { id: 'emerald-violet', label: 'Emerald/Violet', light: '#10b981', dark: '#8b5cf6' },
  { id: 'amber-slate', label: 'Amber/Slate', light: '#f59e0b', dark: '#334155' },
  { id: 'rose-ice', label: 'Rose/Ice', light: '#fb7185', dark: '#67e8f9' }
];

const createInitial = () => {
  const board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  for (let r = 0; r < 3; r += 1) for (let c = 0; c < SIZE; c += 1) if ((r + c) % 2 === 1) board[r][c] = { side: 'dark', king: false };
  for (let r = 5; r < SIZE; r += 1) for (let c = 0; c < SIZE; c += 1) if ((r + c) % 2 === 1) board[r][c] = { side: 'light', king: false };
  return board;
};

const inBounds = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;
const getMoves = (board, r, c) => {
  const piece = board[r][c];
  if (!piece) return [];
  const dirs = piece.king
    ? [[1, 1], [1, -1], [-1, 1], [-1, -1]]
    : piece.side === 'light'
      ? [[-1, 1], [-1, -1]]
      : [[1, 1], [1, -1]];
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
      if (inBounds(jr, jc) && !board[jr][jc]) captures.push({ r: jr, c: jc, capture: [nr, nc] });
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

async function resolveHdriUrl(variant) {
  const fallbackRes = variant?.fallbackResolution || '4k';
  const fallback = `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/${fallbackRes}/${variant?.assetId || 'colorful_studio'}_${fallbackRes}.hdr`;
  if (!variant?.assetId) return fallback;
  try {
    const res = await fetch(`https://api.polyhaven.com/files/${encodeURIComponent(variant.assetId)}`);
    if (!res.ok) return fallback;
    const data = await res.json();
    const urls = [];
    const walk = (value) => {
      if (!value) return;
      if (typeof value === 'string') {
        const low = value.toLowerCase();
        if (value.startsWith('http') && (low.endsWith('.hdr') || low.endsWith('.exr'))) urls.push(value);
      } else if (Array.isArray(value)) value.forEach(walk);
      else if (typeof value === 'object') Object.values(value).forEach(walk);
    };
    walk(data);
    return urls.find((u) => u.includes(`/${fallbackRes}/`)) || urls[0] || fallback;
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

  const sceneRef = useRef(null);
  const tableRef = useRef(null);
  const chairsRef = useRef([]);
  const envRef = useRef({ map: null, skybox: null });

  const [turn, setTurn] = useState('light');
  const [status, setStatus] = useState('Loading arena…');
  const [showAppearance, setShowAppearance] = useState(false);

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
            new THREE.CylinderGeometry(0.9, 0.9, 0.34, 40),
            new THREE.MeshStandardMaterial({
              color: piece.side === 'light' ? chipSet.light : chipSet.dark,
              roughness: 0.25,
              metalness: 0.52
            })
          );
          chip.castShadow = true;
          chip.position.set(x + (c - 3.5) * tile, y + 0.2, z + (r - 3.5) * tile);
          if (piece.king) {
            const ring = new THREE.Mesh(
              new THREE.TorusGeometry(0.5, 0.11, 12, 30),
              new THREE.MeshStandardMaterial({ color: '#f8fafc', metalness: 0.92, roughness: 0.18 })
            );
            ring.rotation.x = Math.PI / 2;
            ring.position.y = 0.23;
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

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0b1220');
    sceneRef.current = scene;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(
      ARENA_CAMERA_DEFAULTS.fov,
      mount.clientWidth / mount.clientHeight,
      ARENA_CAMERA_DEFAULTS.near,
      ARENA_CAMERA_DEFAULTS.far
    );
    const isPortrait = mount.clientHeight > mount.clientWidth;
    const cameraSeatAngle = Math.PI / 2;
    const cameraBackOffset = (isPortrait ? 2.55 : 1.78) + 0.35;
    const cameraForwardOffset = isPortrait ? 0.08 : 0.2;
    const cameraHeightOffset = isPortrait ? 1.72 : 1.34;
    const cameraRadius = CHAIR_DISTANCE + cameraBackOffset - cameraForwardOffset;
    camera.position.set(
      Math.cos(cameraSeatAngle) * cameraRadius,
      TABLE_HEIGHT + cameraHeightOffset,
      Math.sin(cameraSeatAngle) * cameraRadius
    );

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, TABLE_HEIGHT, 0);
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.minDistance = TABLE_RADIUS * 1.85;
    controls.maxDistance = TABLE_RADIUS * 4.9;
    controls.minPolarAngle = THREE.MathUtils.degToRad(28);
    controls.maxPolarAngle = ARENA_CAMERA_DEFAULTS.phiMax;
    controls.rotateSpeed = 0.85;
    controls.zoomSpeed = 0.7;
    controls.panSpeed = 0.6;

    scene.add(new THREE.AmbientLight('#ffffff', 0.5));
    const key = new THREE.DirectionalLight('#ffffff', 1.08);
    key.position.set(18, 26, 12);
    key.castShadow = true;
    scene.add(key);

    const piecesGroup = new THREE.Group();
    piecesGroupRef.current = piecesGroup;
    scene.add(piecesGroup);

    const pickTiles = [];
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const applyMove = (r, c) => {
      const board = boardRef.current;
      const selected = selectedRef.current;
      const piece = board[r][c];
      if (piece && piece.side === turn) {
        selectedRef.current = { r, c };
        return;
      }
      if (!selected) return;
      const moves = getMoves(board, selected.r, selected.c);
      const move = moves.find((m) => m.r === r && m.c === c);
      if (!move) return;
      const next = board.map((row) => row.slice());
      const moving = { ...next[selected.r][selected.c] };
      next[selected.r][selected.c] = null;
      if (move.capture) next[move.capture[0]][move.capture[1]] = null;
      if (moving.side === 'light' && r === 0) moving.king = true;
      if (moving.side === 'dark' && r === SIZE - 1) moving.king = true;
      next[r][c] = moving;
      boardRef.current = next;
      selectedRef.current = null;
      setTurn((prev) => (prev === 'light' ? 'dark' : 'light'));
    };

    const onPointerUp = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(pickTiles, false)[0];
      if (hit?.object?.userData) applyMove(hit.object.userData.r, hit.object.userData.c);
    };

    const buildSceneAssets = async () => {
      const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });
      const setupPickTiles = () => {
        const { x, y, z, tile } = boardOriginRef.current;
        if (pickTiles.length) return;
        for (let r = 0; r < SIZE; r += 1) {
          for (let c = 0; c < SIZE; c += 1) {
            const pick = new THREE.Mesh(new THREE.BoxGeometry(tile * 0.94, 0.25, tile * 0.94), pickMaterial);
            pick.position.set(x + (c - 3.5) * tile, y + 0.16, z + (r - 3.5) * tile);
            pick.userData = { r, c };
            pickTiles.push(pick);
            scene.add(pick);
          }
        }
      };

      // 1) Table always present (fallback-safe)
      try {
        const tableTheme = CHESS_TABLE_OPTIONS.find((t) => t.id === appearance.tableId) || CHESS_TABLE_OPTIONS[0];
        const table = createMurlanStyleTable({
          arena: scene,
          renderer,
          tableRadius: TABLE_RADIUS,
          tableHeight: TABLE_HEIGHT
        });
        table.group.position.set(0, 0, 0);
        const finish = MURLAN_TABLE_FINISHES.find((f) => f.id === appearance.tableFinish) || MURLAN_TABLE_FINISHES[0];
        applyTableMaterials(table.parts, finish);
        tableRef.current = table;
      } catch (error) {
        console.error('Checkers table load failed:', error);
      }

      // 2) Chairs always present (fallback-safe)
      try {
        const chairOption = CHESS_CHAIR_OPTIONS.find((c) => c.id === appearance.chairId) || CHESS_CHAIR_OPTIONS[0];
        const chairColor = chairOption?.primary || chairOption?.seatColor || '#8b0000';
        const chairMat = new THREE.MeshStandardMaterial({ color: chairColor, roughness: 0.42, metalness: 0.22 });
        const makeChair = (z, ry) => {
          const g = new THREE.Group();
          const seat = new THREE.Mesh(new THREE.BoxGeometry(1.316, 0.197, 1.389), chairMat);
          const back = new THREE.Mesh(new THREE.BoxGeometry(1.316, 1.0, 0.185), chairMat);
          seat.position.y = 0;
          back.position.set(0, 0.56, -0.6);
          seat.castShadow = true;
          back.castShadow = true;
          g.add(seat, back);
          g.position.set(0, CHAIR_BASE_HEIGHT, z);
          g.rotation.y = ry;
          scene.add(g);
          return g;
        };
        chairsRef.current = [makeChair(CHAIR_DISTANCE, Math.PI), makeChair(-CHAIR_DISTANCE, 0)];
      } catch (error) {
        console.error('Checkers chairs load failed:', error);
      }

      // 3) Board: try ABeautifulGame, fallback to procedural checkerboard plane
      try {
        const boardRoot = await loadBeautifulBoard(createConfiguredGLTFLoader(renderer));
        const boardVisualGroup = new THREE.Group();
        boardVisualGroup.position.y = BOARD_VISUAL_Y_OFFSET;
        boardVisualGroup.add(boardRoot);
        scene.add(boardVisualGroup);
        boardRoot.scale.setScalar(BOARD_SCALE);
        boardRoot.position.set(0, TABLE_HEIGHT, 0);
        boardRoot.traverse((child) => {
          if (!child.isMesh) return;
          const n = `${child.name || ''}`.toLowerCase();
          if (/(pawn|rook|knight|bishop|queen|king)/.test(n)) child.visible = false;
          child.castShadow = true;
          child.receiveShadow = true;
        });
        const bbox = new THREE.Box3().setFromObject(boardRoot);
        const center = bbox.getCenter(new THREE.Vector3());
        boardOriginRef.current = { x: center.x, y: bbox.max.y + 0.05, z: center.z, tile: 2.65 };
      } catch (error) {
        console.error('Checkers board load failed, using fallback board:', error);
        const boardGroup = new THREE.Group();
        const tile = 2.65;
        const darkMat = new THREE.MeshStandardMaterial({ color: '#6d4c41', roughness: 0.62, metalness: 0.12 });
        const lightMat = new THREE.MeshStandardMaterial({ color: '#e8dcc6', roughness: 0.66, metalness: 0.1 });
        for (let r = 0; r < SIZE; r += 1) {
          for (let c = 0; c < SIZE; c += 1) {
            const sq = new THREE.Mesh(new THREE.BoxGeometry(tile, 0.24, tile), (r + c) % 2 ? darkMat : lightMat);
            sq.position.set((c - 3.5) * tile, 0.72, (r - 3.5) * tile);
            sq.receiveShadow = true;
            boardGroup.add(sq);
          }
        }
        scene.add(boardGroup);
        boardOriginRef.current = { x: 0, y: 0.9, z: 0, tile };
      }

      setupPickTiles();

      // 4) HDRI optional: if fails keep lit fallback background (avoid black screen)
      try {
        const hdriVariant = POOL_ROYALE_HDRI_VARIANTS.find((h) => h.id === appearance.hdriId) ||
          POOL_ROYALE_HDRI_VARIANTS.find((h) => h.id === POOL_ROYALE_DEFAULT_HDRI_ID) ||
          POOL_ROYALE_HDRI_VARIANTS[0];
        const hdriUrl = await resolveHdriUrl(hdriVariant);
        const loaderEnv = hdriUrl.toLowerCase().endsWith('.exr') ? new EXRLoader() : new RGBELoader();
        const envMap = await loaderEnv.loadAsync(hdriUrl);
        envMap.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = envMap;
        scene.background = envMap;
        const cameraHeight = Math.max(
          hdriVariant?.cameraHeightM ?? 1.5,
          MIN_HDRI_CAMERA_HEIGHT_M
        ) * HDRI_UNITS_PER_METER;
        const radiusMultiplier = typeof hdriVariant?.groundRadiusMultiplier === 'number'
          ? hdriVariant.groundRadiusMultiplier
          : DEFAULT_HDRI_RADIUS_MULTIPLIER;
        const groundRadius = Math.max(TABLE_RADIUS * HDRI_UNITS_PER_METER * radiusMultiplier, MIN_HDRI_RADIUS);
        const skyboxResolution = Math.max(16, Math.floor(hdriVariant?.groundResolution ?? DEFAULT_HDRI_GROUNDED_RESOLUTION));
        const skybox = new GroundedSkybox(envMap, cameraHeight, groundRadius, skyboxResolution);
        skybox.position.y = cameraHeight;
        if (typeof hdriVariant?.rotationY === 'number') skybox.rotation.y = hdriVariant.rotationY;
        scene.add(skybox);
        envRef.current = { map: envMap, skybox, hdriId: appearance.hdriId };
      } catch (error) {
        console.error('Checkers HDRI load failed, keeping fallback background:', error);
        envRef.current = { map: null, skybox: null, hdriId: null };
      }
    };

    renderer.domElement.addEventListener('pointerup', onPointerUp);

    void buildSceneAssets()
      .then(() => {
        renderPieces();
        setStatus('Ready');
      })
      .catch((error) => {
        console.error('Checkers scene boot error:', error);
        setStatus('Failed to load board/table/chairs/HDRI.');
      });

    let raf = 0;
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (tableRef.current?.parts) {
      const finish = MURLAN_TABLE_FINISHES.find((f) => f.id === appearance.tableFinish) || MURLAN_TABLE_FINISHES[0];
      applyTableMaterials(tableRef.current.parts, finish);
    }

    const chairOption = CHESS_CHAIR_OPTIONS.find((c) => c.id === appearance.chairId) || CHESS_CHAIR_OPTIONS[0];
    const nextChairColor = new THREE.Color(chairOption?.primary || chairOption?.seatColor || '#8b0000');
    chairsRef.current.forEach((chairGroup) => {
      chairGroup?.traverse?.((child) => {
        if (child?.isMesh && child.material?.color) {
          child.material.color.copy(nextChairColor);
          child.material.needsUpdate = true;
        }
      });
    });

    const activeTableTheme = CHESS_TABLE_OPTIONS.find((t) => t.id === appearance.tableId) || CHESS_TABLE_OPTIONS[0];
    if (tableRef.current?.group?.userData?.tableThemeId !== activeTableTheme?.id) {
      if (tableRef.current?.group) scene.remove(tableRef.current.group);
      const nextTable = createMurlanStyleTable({
        arena: scene,
        renderer: null,
        tableRadius: TABLE_RADIUS,
        tableHeight: TABLE_HEIGHT
      });
      nextTable.group.position.set(0, 0, 0);
      nextTable.group.userData = { ...(nextTable.group.userData || {}), tableThemeId: activeTableTheme?.id };
      const finish = MURLAN_TABLE_FINISHES.find((f) => f.id === appearance.tableFinish) || MURLAN_TABLE_FINISHES[0];
      applyTableMaterials(nextTable.parts, finish);
      tableRef.current = nextTable;
    }

    const currentHdriId = envRef.current?.hdriId;
    if (currentHdriId === appearance.hdriId) return;

    const applyHdri = async () => {
      try {
        const variant = POOL_ROYALE_HDRI_VARIANTS.find((h) => h.id === appearance.hdriId) ||
          POOL_ROYALE_HDRI_VARIANTS.find((h) => h.id === POOL_ROYALE_DEFAULT_HDRI_ID) ||
          POOL_ROYALE_HDRI_VARIANTS[0];
        const url = await resolveHdriUrl(variant);
        const loaderEnv = url.toLowerCase().endsWith('.exr') ? new EXRLoader() : new RGBELoader();
        const envMap = await loaderEnv.loadAsync(url);
        envMap.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = envMap;
        scene.background = envMap;
        if (envRef.current?.skybox) scene.remove(envRef.current.skybox);
        const cameraHeight = Math.max(variant?.cameraHeightM ?? 1.5, MIN_HDRI_CAMERA_HEIGHT_M) * HDRI_UNITS_PER_METER;
        const radiusMultiplier = typeof variant?.groundRadiusMultiplier === 'number'
          ? variant.groundRadiusMultiplier
          : DEFAULT_HDRI_RADIUS_MULTIPLIER;
        const groundRadius = Math.max(TABLE_RADIUS * HDRI_UNITS_PER_METER * radiusMultiplier, MIN_HDRI_RADIUS);
        const skyboxResolution = Math.max(16, Math.floor(variant?.groundResolution ?? DEFAULT_HDRI_GROUNDED_RESOLUTION));
        const skybox = new GroundedSkybox(envMap, cameraHeight, groundRadius, skyboxResolution);
        skybox.position.y = cameraHeight;
        if (typeof variant?.rotationY === 'number') skybox.rotation.y = variant.rotationY;
        scene.add(skybox);
        envRef.current = { map: envMap, skybox, hdriId: appearance.hdriId };
      } catch (error) {
        console.error('Checkers HDRI swap failed:', error);
      }
    };

    void applyHdri();
  }, [appearance]);

  const optionButton = (active) => `rounded-lg border px-2 py-1 text-[11px] ${active ? 'border-cyan-300 bg-cyan-500/20 text-cyan-100' : 'border-white/15 bg-white/5 text-white/70'}`;

  return (
    <div className="min-h-screen bg-[#050814] text-white">
      <div className="flex items-center justify-between px-4 py-3 text-xs">
        <button onClick={() => navigate('/games/checkersbattleroyal/lobby')} className="rounded bg-white/10 px-3 py-1">Lobby</button>
        <div>Checkers Battle Royal • Turn: {turn}</div>
        <button onClick={() => setShowAppearance((v) => !v)} className="rounded bg-white/10 px-3 py-1">Appearance</button>
      </div>

      <div className="px-4 pb-2 text-[11px] text-white/70">
        Board: ABeautifulGame • Table: {appearance.tableId} • Chair: {appearance.chairId} • HDRI: {CHESS_BATTLE_OPTION_LABELS.environmentHdri?.[appearance.hdriId] || appearance.hdriId}
      </div>

      <div ref={mountRef} className="h-[70vh] w-full" />
      <div className="px-4 py-2 text-center text-xs text-white/70">{status}</div>

      {showAppearance && (
        <div className="mx-3 mb-4 rounded-2xl border border-white/15 bg-[#0b1324]/95 p-3">
          <div className="mb-2 text-xs font-semibold">Checkers Arena Setup (Chess Battle Royal style)</div>
          <div className="mb-2 text-[11px] text-white/60">Use same option sets as Chess Battle Royal. (These controls are synced to the same inventory categories.)</div>

          <div className="mb-2 text-[11px] text-white/70">Chips</div>
          <div className="mb-3 flex flex-wrap gap-2">
            {CHIP_SETS.map((set) => (
              <button key={set.id} onClick={() => setChipSetId(set.id)} className={optionButton(chipSetId === set.id)}>{set.label}</button>
            ))}
          </div>

          <div className="mb-2 text-[11px] text-white/70">Tables</div>
          <div className="mb-3 flex max-h-24 flex-wrap gap-2 overflow-auto">
            {CHESS_TABLE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setAppearance((prev) => ({ ...prev, tableId: opt.id }))}
                className={optionButton(appearance.tableId === opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="mb-2 text-[11px] text-white/70">Chairs</div>
          <div className="mb-3 flex max-h-24 flex-wrap gap-2 overflow-auto">
            {CHESS_CHAIR_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setAppearance((prev) => ({ ...prev, chairId: opt.id }))}
                className={optionButton(appearance.chairId === opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="mb-2 text-[11px] text-white/70">Table Finish</div>
          <div className="mb-3 flex max-h-24 flex-wrap gap-2 overflow-auto">
            {MURLAN_TABLE_FINISHES.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setAppearance((prev) => ({ ...prev, tableFinish: opt.id }))}
                className={optionButton(appearance.tableFinish === opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="mb-2 text-[11px] text-white/70">HDRI</div>
          <div className="flex max-h-24 flex-wrap gap-2 overflow-auto">
            {POOL_ROYALE_HDRI_VARIANTS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setAppearance((prev) => ({ ...prev, hdriId: opt.id }))}
                className={optionButton(appearance.hdriId === opt.id)}
              >
                {opt.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
