import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  BADUK_BATTLE_DEFAULT_LOADOUT
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

const BOARD_SIZES = [9, 13, 16, 19];
const BOARD_TEXTURE_SIZE = 2048;
const BOARD_GRID_MIN = 86;
const BOARD_GRID_MAX = 938;
const BOARD_GRID_RANGE_RATIO = (BOARD_GRID_MAX - BOARD_GRID_MIN) / BOARD_TEXTURE_SIZE;
const BOARD_WORLD_EXTENT = 2.04;

const MODEL_SCALE = 0.75;
const STOOL_SCALE = 1.5 * 1.3;
const CARD_SCALE = 0.95;
const TABLE_RADIUS = 3.4 * MODEL_SCALE;
const SEAT_WIDTH = 0.9 * MODEL_SCALE * STOOL_SCALE;
const SEAT_DEPTH = 0.95 * MODEL_SCALE * STOOL_SCALE;
const BASE_TABLE_HEIGHT = 1.08 * MODEL_SCALE;
const SEAT_THICKNESS = 0.09 * MODEL_SCALE * STOOL_SCALE;
const BACK_HEIGHT = 0.68 * MODEL_SCALE * STOOL_SCALE;
const BACK_THICKNESS = 0.08 * MODEL_SCALE * STOOL_SCALE;
const CHAIR_BASE_HEIGHT = BASE_TABLE_HEIGHT - SEAT_THICKNESS * 0.85;
const STOOL_HEIGHT = CHAIR_BASE_HEIGHT + SEAT_THICKNESS;
const TABLE_HEIGHT = STOOL_HEIGHT + 0.05 * MODEL_SCALE;
const AI_CHAIR_GAP = (0.4 * MODEL_SCALE * CARD_SCALE) * 0.4;
const CHAIR_DISTANCE = TABLE_RADIUS + AI_CHAIR_GAP + SEAT_DEPTH * 0.52;

const DEFAULT_TARGET_FPS = 120;
const MIN_TARGET_FPS = 50;
const MAX_TARGET_FPS = 144;
const GRAPHICS_STORAGE_KEY = 'badukBattleRoyalGraphics';
const DEFAULT_GRAPHICS_ID = 'uhd120';
const GRAPHICS_OPTIONS = Object.freeze([
  { id: 'hd50', label: 'HD (50 Hz)', fps: 50, pixelRatioCap: 1.4, renderScale: 1 },
  { id: 'fhd60', label: 'Full HD (60 Hz)', fps: 60, pixelRatioCap: 1.5, renderScale: 1.1 },
  { id: 'qhd90', label: 'QHD (90 Hz)', fps: 90, pixelRatioCap: 1.7, renderScale: 1.25 },
  { id: 'uhd120', label: 'Ultra HD (120 Hz)', fps: 120, pixelRatioCap: 2, renderScale: 1.35 },
  { id: 'ultra144', label: 'Ultra HD+ (144 Hz)', fps: 144, pixelRatioCap: 2.2, renderScale: 1.5 }
]);

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const createBoard = (size) => Array.from({ length: size }, () => Array.from({ length: size }, () => null));
const cloneBoard = (board) => board.map((line) => [...line]);
const neighbors = (r, c, size) => [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([nr, nc]) => nr >= 0 && nr < size && nc >= 0 && nc < size);

const collectGroup = (board, row, col) => {
  const color = board[row][col];
  if (!color) return { stones: [], liberties: 0 };
  const size = board.length;
  const seen = new Set();
  const stack = [[row, col]];
  const stones = [];
  let liberties = 0;
  while (stack.length) {
    const [r, c] = stack.pop();
    const key = `${r}:${c}`;
    if (seen.has(key)) continue;
    seen.add(key);
    stones.push([r, c]);
    neighbors(r, c, size).forEach(([nr, nc]) => {
      if (!board[nr][nc]) liberties += 1;
      else if (board[nr][nc] === color && !seen.has(`${nr}:${nc}`)) stack.push([nr, nc]);
    });
  }
  return { stones, liberties };
};

async function resolveHdriUrl(variant) {
  const fallbackRes = variant?.maxResolution || '2k';
  const fallback = `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/${fallbackRes}/${variant?.assetId || 'colorful_studio'}_${fallbackRes}.hdr`;
  if (!variant?.assetId) return fallback;
  try {
    const endpoint = `https://api.polyhaven.com/files/${variant.assetId}`;
    const res = await fetch(endpoint);
    if (!res.ok) return fallback;
    const data = await res.json();
    const exr = data?.exr?.[fallbackRes]?.url;
    const hdr = data?.hdr?.[fallbackRes]?.url;
    return exr || hdr || fallback;
  } catch {
    return fallback;
  }
}

function createChair(chairColor = '#7f1d1d', legColor = '#111827') {
  const group = new THREE.Group();
  const seat = new THREE.Mesh(
    new THREE.BoxGeometry(SEAT_WIDTH, SEAT_THICKNESS, SEAT_DEPTH),
    new THREE.MeshStandardMaterial({ color: chairColor, roughness: 0.5 })
  );
  seat.position.y = CHAIR_BASE_HEIGHT;
  group.add(seat);

  const back = new THREE.Mesh(
    new THREE.BoxGeometry(SEAT_WIDTH, BACK_HEIGHT, BACK_THICKNESS),
    new THREE.MeshStandardMaterial({ color: chairColor, roughness: 0.55 })
  );
  back.position.set(0, CHAIR_BASE_HEIGHT + BACK_HEIGHT * 0.5 - SEAT_THICKNESS * 0.15, -SEAT_DEPTH * 0.45);
  group.add(back);

  const legGeo = new THREE.CylinderGeometry(0.045, 0.05, STOOL_HEIGHT, 20);
  const legMat = new THREE.MeshStandardMaterial({ color: legColor, metalness: 0.35, roughness: 0.45 });
  [
    [-SEAT_WIDTH * 0.36, STOOL_HEIGHT / 2, -SEAT_DEPTH * 0.36],
    [SEAT_WIDTH * 0.36, STOOL_HEIGHT / 2, -SEAT_DEPTH * 0.36],
    [-SEAT_WIDTH * 0.36, STOOL_HEIGHT / 2, SEAT_DEPTH * 0.36],
    [SEAT_WIDTH * 0.36, STOOL_HEIGHT / 2, SEAT_DEPTH * 0.36]
  ].forEach(([x, y, z]) => {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(x, y, z);
    group.add(leg);
  });

  return group;
}

const optionButton = (active) =>
  `rounded-xl border px-2 py-1 ${
    active ? 'border-cyan-300 bg-cyan-500/20 text-cyan-100' : 'border-white/15 bg-white/5 text-white/70'
  }`;

function createBadukTileBoard(boardSize, boardTheme) {
  const group = new THREE.Group();
  const playableExtent = BOARD_WORLD_EXTENT * BOARD_GRID_RANGE_RATIO;
  const step = playableExtent / Math.max(boardSize - 1, 1);
  const tileSize = step * 0.9;
  const tileHeight = 0.04;
  const start = -playableExtent / 2;
  const boardTint = new THREE.Color(boardTheme?.tint || '#d7a359');
  const lightTileColor = boardTint.clone().offsetHSL(0.012, 0.08, 0.08);
  const darkTileColor = boardTint.clone().offsetHSL(-0.008, -0.04, -0.08);
  const tileGeometry = new THREE.BoxGeometry(tileSize, tileHeight, tileSize);

  for (let r = 0; r < boardSize - 1; r += 1) {
    for (let c = 0; c < boardSize - 1; c += 1) {
      const isDark = (r + c) % 2 === 0;
      const tile = new THREE.Mesh(
        tileGeometry,
        new THREE.MeshStandardMaterial({
          color: isDark ? darkTileColor : lightTileColor,
          roughness: 0.75,
          metalness: 0.03
        })
      );
      tile.position.set(start + c * step + step / 2, TABLE_HEIGHT + 0.046, start + r * step + step / 2);
      tile.castShadow = true;
      tile.receiveShadow = true;
      group.add(tile);
    }
  }

  const gridColor = new THREE.Color(boardTheme?.grid || '#4d2f2d');
  const gridMaterial = new THREE.LineBasicMaterial({ color: gridColor, transparent: true, opacity: 0.82 });
  const points = [];
  for (let i = 0; i < boardSize; i += 1) {
    const p = start + i * step;
    points.push(new THREE.Vector3(start, TABLE_HEIGHT + 0.068, p), new THREE.Vector3(-start, TABLE_HEIGHT + 0.068, p));
    points.push(new THREE.Vector3(p, TABLE_HEIGHT + 0.068, start), new THREE.Vector3(p, TABLE_HEIGHT + 0.068, -start));
  }
  const gridGeometry = new THREE.BufferGeometry().setFromPoints(points);
  const grid = new THREE.LineSegments(gridGeometry, gridMaterial);
  group.add(grid);

  return group;
}

export default function BadukBattleRoyal() {
  useTelegramBackButton();
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const rendererRef = useRef(null);
  const tableRef = useRef(null);
  const chairsRef = useRef([]);
  const envRef = useRef({ map: null, skybox: null, hdriId: null });
  const boardMeshRef = useRef(null);
  const stonesGroupRef = useRef(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerRef = useRef(new THREE.Vector2());

  const [params] = useSearchParams();
  const requestedSize = Number(params.get('boardSize'));
  const boardSize = BOARD_SIZES.includes(requestedSize) ? requestedSize : 19;
  const accountId = params.get('accountId') || '';
  const avatar = params.get('avatar') || getTelegramPhotoUrl();
  const username = params.get('username') || getTelegramUsername() || 'Player';

  const inventory = useMemo(
    () => getBadukBattleInventory(badukBattleAccountId(accountId || undefined)),
    [accountId]
  );

  const [appearance, setAppearance] = useState(() => ({
    tableFinish: inventory.tableFinish?.[0] || MURLAN_TABLE_FINISHES[0]?.id,
    tableId: inventory.tables?.[0] || BADUK_BATTLE_DEFAULT_LOADOUT.tables?.[0] || BADUK_TABLE_OPTIONS[0]?.id,
    chairId: inventory.chairColor?.[0] || BADUK_BATTLE_DEFAULT_LOADOUT.chairColor?.[0] || BADUK_CHAIR_OPTIONS[0]?.id,
    boardTheme: inventory.boardTheme?.[0] || BADUK_BATTLE_DEFAULT_LOADOUT.boardTheme?.[0] || BADUK_BOARD_THEMES[0]?.id,
    stoneStyle: inventory.stoneStyle?.[0] || BADUK_BATTLE_DEFAULT_LOADOUT.stoneStyle?.[0] || BADUK_STONE_STYLES[0]?.id,
    hdriId: inventory.environmentHdri?.[0] || BADUK_BATTLE_DEFAULT_LOADOUT.environmentHdri?.[0] || POOL_ROYALE_DEFAULT_HDRI_ID
  }));

  const [board, setBoard] = useState(() => createBoard(boardSize));
  const [turn, setTurn] = useState('black');
  const [captures, setCaptures] = useState({ black: 0, white: 0 });
  const [passCount, setPassCount] = useState(0);
  const [lastMove, setLastMove] = useState(null);
  const [status, setStatus] = useState('Baduk started. Black plays first.');
  const [viewMode, setViewMode] = useState('3d');
  const [configOpen, setConfigOpen] = useState(false);
  const [graphicsId, setGraphicsId] = useState(() => {
    try {
      const stored = window.localStorage?.getItem(GRAPHICS_STORAGE_KEY);
      return GRAPHICS_OPTIONS.some((g) => g.id === stored) ? stored : DEFAULT_GRAPHICS_ID;
    } catch {
      return DEFAULT_GRAPHICS_ID;
    }
  });
  const [showChat, setShowChat] = useState(false);
  const [showGift, setShowGift] = useState(false);
  const [chatBubbles, setChatBubbles] = useState([]);

  const graphicsOption = useMemo(
    () => GRAPHICS_OPTIONS.find((opt) => opt.id === graphicsId) || GRAPHICS_OPTIONS[3],
    [graphicsId]
  );

  useEffect(() => {
    setBoard(createBoard(boardSize));
    setTurn('black');
    setCaptures({ black: 0, white: 0 });
    setPassCount(0);
    setLastMove(null);
    setStatus(`Loaded ${boardSize}×${boardSize} board. Black to play.`);
  }, [boardSize]);

  useEffect(() => {
    try {
      window.localStorage?.setItem(GRAPHICS_STORAGE_KEY, graphicsId);
    } catch {
      // ignore
    }
  }, [graphicsId]);

  const worldFromCell = (r, c) => {
    const boardExtent = BOARD_WORLD_EXTENT;
    const playableExtent = boardExtent * BOARD_GRID_RANGE_RATIO;
    const step = playableExtent / (boardSize - 1);
    const start = -playableExtent / 2;
    const x = start + c * step;
    const z = start + r * step;
    return [x, z];
  };

  const cellFromWorld = (x, z) => {
    const boardExtent = BOARD_WORLD_EXTENT;
    const playableExtent = boardExtent * BOARD_GRID_RANGE_RATIO;
    const halfPlayable = playableExtent / 2;
    const normalizedX = clamp((x + halfPlayable) / playableExtent, 0, 1);
    const normalizedZ = clamp((z + halfPlayable) / playableExtent, 0, 1);
    const c = Math.round(normalizedX * (boardSize - 1));
    const r = Math.round(normalizedZ * (boardSize - 1));
    return [r, c];
  };

  const renderStones = (boardState, lm) => {
    const group = stonesGroupRef.current;
    if (!group) return;
    group.clear();

    const stoneStyle = BADUK_STONE_STYLES.find((style) => style.id === appearance.stoneStyle) || BADUK_STONE_STYLES[0];
    const stoneGeo = new THREE.SphereGeometry(0.045, 22, 16);
    const blackMat = new THREE.MeshStandardMaterial({
      color: stoneStyle?.black || '#0b0b0d',
      roughness: stoneStyle?.blackRoughness ?? 0.28,
      metalness: 0.06
    });
    const whiteMat = new THREE.MeshStandardMaterial({
      color: stoneStyle?.white || '#f8fafc',
      roughness: stoneStyle?.whiteRoughness ?? 0.2,
      metalness: 0.03
    });
    const markerGeo = new THREE.SphereGeometry(0.014, 14, 10);
    const markerMat = new THREE.MeshBasicMaterial({ color: '#34d399' });

    for (let r = 0; r < boardSize; r += 1) {
      for (let c = 0; c < boardSize; c += 1) {
        const s = boardState[r][c];
        if (!s) continue;
        const [x, z] = worldFromCell(r, c);
        const stone = new THREE.Mesh(stoneGeo, s === 'black' ? blackMat : whiteMat);
        stone.position.set(x, TABLE_HEIGHT + 0.055, z);
        stone.scale.set(1, 0.42, 1);
        group.add(stone);
      }
    }

    if (lm) {
      const [x, z] = worldFromCell(lm[0], lm[1]);
      const marker = new THREE.Mesh(markerGeo, markerMat);
      marker.position.set(x, TABLE_HEIGHT + 0.08, z);
      group.add(marker);
    }
  };

  useEffect(() => {
    renderStones(board, lastMove);
  }, [appearance.stoneStyle, board, lastMove]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    applyRendererSRGB(renderer);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, graphicsOption.pixelRatioCap) * graphicsOption.renderScale);
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const camera = new THREE.PerspectiveCamera(47, mount.clientWidth / mount.clientHeight, 0.1, 200);
    camera.position.set(0, TABLE_HEIGHT + 1.72, CHAIR_DISTANCE + 2.7);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.target.set(0, TABLE_HEIGHT, 0);
    controls.minDistance = 2.3;
    controls.maxDistance = 11;
    controls.minPolarAngle = THREE.MathUtils.degToRad(28);
    controls.maxPolarAngle = ARENA_CAMERA_DEFAULTS.phiMax;
    controls.zoomSpeed = 0.9;
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controlsRef.current = controls;

    const hemi = new THREE.HemisphereLight(0xffffff, 0x223344, 0.8);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(2.2, 4.5, 1.6);
    scene.add(key);

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

    const chairOption = BADUK_CHAIR_OPTIONS.find((opt) => opt.id === appearance.chairId) || BADUK_CHAIR_OPTIONS[0];
    const chairs = [Math.PI / 2, -Math.PI / 2].map((angle) => {
      const chair = createChair(chairOption?.primary || chairOption?.seatColor || '#7f1d1d', chairOption?.legColor || '#111827');
      chair.position.set(Math.cos(angle) * CHAIR_DISTANCE, 0, Math.sin(angle) * CHAIR_DISTANCE);
      chair.lookAt(0, STOOL_HEIGHT, 0);
      scene.add(chair);
      return chair;
    });
    chairsRef.current = chairs;

    const boardGroup = new THREE.Group();
    const boardBase = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.05, 2.2),
      new THREE.MeshStandardMaterial({ color: '#c6954f', roughness: 0.7 })
    );
    boardBase.position.y = TABLE_HEIGHT + 0.02;
    boardGroup.add(boardBase);

    const boardTheme = BADUK_BOARD_THEMES.find((theme) => theme.id === appearance.boardTheme) || BADUK_BOARD_THEMES[0];
    const boardTiles = createBadukTileBoard(boardSize, boardTheme);
    boardGroup.add(boardTiles);

    const boardPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(BOARD_WORLD_EXTENT, BOARD_WORLD_EXTENT),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    boardPlane.rotation.x = -Math.PI / 2;
    boardPlane.position.y = TABLE_HEIGHT + 0.09;
    boardPlane.name = 'baduk-board-click-plane';
    boardGroup.add(boardPlane);
    boardMeshRef.current = boardPlane;

    const stonesGroup = new THREE.Group();
    stonesGroupRef.current = stonesGroup;
    boardGroup.add(stonesGroup);

    scene.add(boardGroup);

    let raf = 0;
    let last = 0;
    const frameInterval = 1000 / clamp(graphicsOption.fps, MIN_TARGET_FPS, MAX_TARGET_FPS);

    const loop = (ts) => {
      raf = window.requestAnimationFrame(loop);
      if (ts - last < frameInterval) return;
      last = ts;
      controls.update();
      renderer.render(scene, camera);
    };
    raf = window.requestAnimationFrame(loop);

    const onResize = () => {
      if (!mountRef.current || !cameraRef.current || !rendererRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
      rendererRef.current.setPixelRatio(Math.min(window.devicePixelRatio || 1, graphicsOption.pixelRatioCap) * graphicsOption.renderScale);
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      controls.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj.isMesh) {
          obj.geometry?.dispose?.();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose?.());
          else obj.material?.dispose?.();
        }
      });
    };
  }, [boardSize, appearance.boardTheme, appearance.chairId, graphicsOption.fps, graphicsOption.pixelRatioCap, graphicsOption.renderScale]);

  useEffect(() => {
    const finish = MURLAN_TABLE_FINISHES.find((f) => f.id === appearance.tableFinish) || MURLAN_TABLE_FINISHES[0];
    if (tableRef.current?.parts) applyTableMaterials(tableRef.current.parts, finish);
  }, [appearance.tableFinish]);

  useEffect(() => {
    const next = BADUK_CHAIR_OPTIONS.find((c) => c.id === appearance.chairId) || BADUK_CHAIR_OPTIONS[0];
    const chairColor = new THREE.Color(next?.primary || next?.seatColor || '#7f1d1d');
    chairsRef.current.forEach((chair) => {
      chair.traverse((node) => {
        if (node.isMesh && node.material?.color) node.material.color.copy(chairColor);
      });
    });
  }, [appearance.chairId]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || envRef.current.hdriId === appearance.hdriId) return;
    let cancelled = false;

    const applyHdri = async () => {
      try {
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
        skybox.position.y = 16;
        scene.add(skybox);

        envRef.current = { map: envMap, skybox, hdriId: appearance.hdriId };
      } catch {
        // ignore hdri failure
      }
    };

    void applyHdri();
    return () => {
      cancelled = true;
    };
  }, [appearance.hdriId]);

  useEffect(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    if (viewMode === '2d') {
      camera.position.set(0, TABLE_HEIGHT + 8.9, 0.001);
      controls.enableRotate = false;
      controls.minPolarAngle = 0;
      controls.maxPolarAngle = 0;
    } else {
      camera.position.set(0, TABLE_HEIGHT + 1.72, CHAIR_DISTANCE + 2.7);
      controls.enableRotate = true;
      controls.minPolarAngle = THREE.MathUtils.degToRad(28);
      controls.maxPolarAngle = ARENA_CAMERA_DEFAULTS.phiMax;
    }
    controls.target.set(0, TABLE_HEIGHT, 0);
    controls.update();
  }, [viewMode]);

  const playAt = (row, col) => {
    setBoard((prev) => {
      if (prev[row][col]) return prev;
      const enemy = turn === 'black' ? 'white' : 'black';
      const next = cloneBoard(prev);
      next[row][col] = turn;

      let captured = 0;
      neighbors(row, col, boardSize).forEach(([nr, nc]) => {
        if (next[nr][nc] !== enemy) return;
        const group = collectGroup(next, nr, nc);
        if (group.liberties === 0) {
          group.stones.forEach(([sr, sc]) => {
            next[sr][sc] = null;
            captured += 1;
          });
        }
      });

      const own = collectGroup(next, row, col);
      if (own.liberties === 0) {
        setStatus('Illegal move: suicide is blocked.');
        return prev;
      }

      setCaptures((curr) => ({ ...curr, [turn]: curr[turn] + captured }));
      setTurn(enemy);
      setPassCount(0);
      setLastMove([row, col]);
      setStatus(captured ? `${turn} captured ${captured} stone(s).` : `${enemy} to move.`);
      return next;
    });
  };

  useEffect(() => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const boardMesh = boardMeshRef.current;
    if (!renderer || !camera || !boardMesh) return undefined;

    const onPointer = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(pointerRef.current, camera);
      const hit = raycasterRef.current.intersectObject(boardMesh, false)[0];
      if (!hit) return;
      const [r, c] = cellFromWorld(hit.point.x, hit.point.z);
      playAt(r, c);
    };

    renderer.domElement.addEventListener('pointerdown', onPointer);
    return () => renderer.domElement.removeEventListener('pointerdown', onPointer);
  }, [boardSize, turn]);

  const onPass = () => {
    const enemy = turn === 'black' ? 'white' : 'black';
    setTurn(enemy);
    setPassCount((value) => {
      const next = value + 1;
      setStatus(next >= 2 ? 'Both players passed. Game ended by pass rule.' : `${turn} passed. ${enemy} to move.`);
      return next;
    });
  };

  const blackStones = board.flat().filter((s) => s === 'black').length;
  const whiteStones = board.flat().filter((s) => s === 'white').length;
  const chatGiftOverlayClass = 'fixed inset-0 z-50 flex items-center justify-center bg-black/70';
  const chatGiftPanelClass = 'w-[min(340px,88vw)] rounded-2xl border border-[#233050] bg-[#0b1220] p-4 text-white shadow-[0_18px_40px_rgba(0,0,0,0.5)]';
  const chatGiftHeaderClass = 'flex items-center justify-between gap-2';
  const chatGiftTitleClass = 'text-sm font-semibold tracking-[0.04em] text-white';
  const chatGiftCloseButtonClass = 'flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/80 hover:bg-white/20';
  const chatGiftOptionClass = 'text-[11px] font-semibold border border-white/15 rounded-[10px] px-2 py-1 bg-[#0f172a]/60 text-white/85';
  const chatGiftOptionActiveClass = 'border-emerald-400/80 bg-emerald-400/20 text-emerald-50';
  const chatGiftActionButtonClass = 'w-full rounded-[12px] border border-emerald-400/70 bg-gradient-to-br from-emerald-400/95 to-emerald-500/85 px-3 py-2 text-sm font-extrabold uppercase tracking-[0.18em] text-[#04210f] shadow-[0_12px_24px_rgba(16,185,129,0.3)]';

  const giftPlayers = [
    { index: 0, id: badukBattleAccountId(accountId || undefined), name: username, photoUrl: avatar || '/assets/icons/profile.svg' },
    { index: 1, id: 'baduk-ai-rival', name: 'AI Rival', photoUrl: '/assets/icons/bot.webp' }
  ];

  return (
    <div className="relative min-h-screen bg-[#070b16] text-white">
      <div ref={mountRef} className="absolute inset-0" />

      <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 p-3">
        <div className="pointer-events-none absolute top-20 left-4 z-20 flex flex-col items-start gap-3">
          <button
            type="button"
            onClick={() => setConfigOpen((open) => !open)}
            aria-expanded={configOpen}
            aria-label={configOpen ? 'Close game menu' : 'Open game menu'}
            className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-gray-100 shadow-[0_6px_18px_rgba(2,6,23,0.45)] transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <span className="text-base leading-none" aria-hidden="true">☰</span>
            <span className="leading-none">Menu</span>
          </button>
          <div className="pointer-events-auto max-w-[27rem] rounded-2xl border border-white/15 bg-black/60 p-3 backdrop-blur">
            <h1 className="text-sm font-semibold uppercase tracking-[0.18em]">Baduk Battle Royal</h1>
            <p className="mt-2 text-xs text-white/75">Board {boardSize}×{boardSize} • Turn: {turn} • B:{blackStones} W:{whiteStones} • Captures B:{captures.black} W:{captures.white}</p>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-4">
        <div className="pointer-events-auto mx-auto max-w-[32rem]">
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfigOpen((v) => !v)}
              className="icon-only-button flex h-10 w-10 items-center justify-center text-[1.2rem] text-white/90"
            >
              ⚙
            </button>
            <button onClick={onPass} className="rounded-xl border border-amber-300/40 bg-amber-400/30 px-3 py-2 text-xs font-semibold">Pass</button>
          </div>

          {configOpen && (
            <div className="mt-2 w-80 max-w-[90vw] rounded-2xl border border-white/15 bg-black/80 p-4 text-xs text-white shadow-2xl backdrop-blur max-h-[70vh] overflow-y-auto">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-white/80">Baduk Battle Royal</div>

              <div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-white/70">Graphics / FPS</div>
              <div className="mb-3 grid grid-cols-1 gap-2">
                {GRAPHICS_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setGraphicsId(opt.id)}
                    className={optionButton(graphicsId === opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setViewMode((mode) => (mode === '3d' ? '2d' : '3d'))}
                className="mb-3 w-full rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/90"
              >
                {viewMode === '3d' ? '2D View' : '3D View'}
              </button>

              <div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-white/70">Table Finish</div>
              <div className="mb-3 grid max-h-40 grid-cols-2 gap-2 overflow-auto">
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

              <div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-white/70">Tables</div>
              <div className="mb-3 grid max-h-40 grid-cols-2 gap-2 overflow-auto">
                {BADUK_TABLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setAppearance((prev) => ({ ...prev, tableId: opt.id }))}
                    className={optionButton(appearance.tableId === opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-white/70">Chairs</div>
              <div className="mb-3 grid max-h-40 grid-cols-2 gap-2 overflow-auto">
                {BADUK_CHAIR_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setAppearance((prev) => ({ ...prev, chairId: opt.id }))}
                    className={optionButton(appearance.chairId === opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-white/70">Baduk Boards</div>
              <div className="mb-3 grid max-h-40 grid-cols-2 gap-2 overflow-auto">
                {BADUK_BOARD_THEMES.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setAppearance((prev) => ({ ...prev, boardTheme: opt.id }))}
                    className={optionButton(appearance.boardTheme === opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-white/70">Stone Sets</div>
              <div className="mb-3 grid max-h-40 grid-cols-2 gap-2 overflow-auto">
                {BADUK_STONE_STYLES.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setAppearance((prev) => ({ ...prev, stoneStyle: opt.id }))}
                    className={optionButton(appearance.stoneStyle === opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-white/70">HDRI</div>
              <div className="flex max-h-40 flex-wrap gap-2 overflow-auto">
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

              <button
                onClick={() => navigate('/store/badukbattleroyal')}
                className="mt-3 w-full rounded-xl border border-cyan-300/40 bg-cyan-400/20 px-3 py-2 text-xs font-semibold text-cyan-100"
              >
                Open Store (Baduk items)
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="absolute top-20 right-4 z-20 flex flex-col items-end gap-3 pointer-events-none">
        <div className="pointer-events-auto flex flex-col items-end gap-3">
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
          <button
            type="button"
            onClick={() => setViewMode((mode) => (mode === '3d' ? '2d' : '3d'))}
            className="icon-only-button flex h-10 w-10 items-center justify-center text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-white/90 transition-opacity duration-200 hover:text-white focus:outline-none"
          >
            {viewMode === '3d' ? '2D' : '3D'}
          </button>
        </div>
      </div>

      <div className="pointer-events-auto">
        <BottomLeftIcons
          onGift={() => setShowGift(true)}
          showInfo={false}
          showChat={false}
          showMute={false}
          className="fixed right-3 bottom-28 z-50 flex flex-col gap-4"
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
          className="fixed left-3 bottom-28 z-50 flex flex-col"
          buttonClassName="icon-only-button pointer-events-auto flex h-11 w-11 items-center justify-center text-white/90 transition-opacity duration-200 hover:text-white focus:outline-none"
          iconClassName="text-[1.65rem] leading-none"
          labelClassName="sr-only"
          chatIcon="💬"
          order={['chat']}
        />
      </div>

      <div className="pointer-events-none absolute inset-0 z-20">
        <div className="absolute left-1/2 top-[12%] -translate-x-1/2" data-player-index={1}>
          <AvatarTimer photoUrl="🤖" name="AI Rival" active isTurn={turn === 'white'} size={1} />
        </div>
        <div className="absolute left-1/2 top-[85%] -translate-x-1/2" data-player-index={0}>
          <AvatarTimer photoUrl={avatar} name={username} active isTurn={turn === 'black'} size={1} />
        </div>
        <div className="absolute left-1/2 top-[77%] -translate-x-1/2">
          <div className="px-4 py-2 rounded-full bg-[rgba(7,10,18,0.65)] border border-[rgba(255,215,0,0.25)] text-xs font-semibold backdrop-blur text-cyan-100/90">
            {status}
          </div>
        </div>
      </div>

      {chatBubbles.map((bubble) => (
        <div key={bubble.id} className="chat-bubble chess-battle-chat-bubble">
          <span>{bubble.text}</span>
          <img src={bubble.photoUrl} alt="avatar" className="w-5 h-5 rounded-full" />
        </div>
      ))}

      <QuickMessagePopup
        open={showChat}
        onClose={() => setShowChat(false)}
        title="Quick Chat"
        headerClassName={chatGiftHeaderClass}
        titleClassName={chatGiftTitleClass}
        closeButtonClassName={chatGiftCloseButtonClass}
        showCloseButton
        overlayClassName={chatGiftOverlayClass}
        panelClassName={chatGiftPanelClass}
        messageGridClassName="grid grid-cols-2 gap-[0.45rem] max-h-48 overflow-y-auto"
        messageButtonClassName={chatGiftOptionClass}
        messageButtonActiveClassName={chatGiftOptionActiveClass}
        sendButtonClassName={chatGiftActionButtonClass}
        onSend={(text) => {
          const id = Date.now();
          setChatBubbles((bubbles) => [...bubbles, { id, text, photoUrl: avatar || '/assets/icons/profile.svg' }]);
          setTimeout(() => setChatBubbles((bubbles) => bubbles.filter((bubble) => bubble.id !== id)), 3000);
        }}
      />

      <GiftPopup
        open={showGift}
        onClose={() => setShowGift(false)}
        players={giftPlayers}
        senderIndex={0}
        overlayClassName={chatGiftOverlayClass}
        panelClassName={chatGiftPanelClass}
        title="Send Gift"
        headerClassName={chatGiftHeaderClass}
        titleClassName={chatGiftTitleClass}
        closeButtonClassName={chatGiftCloseButtonClass}
        showCloseButton
        playerListClassName="flex flex-col gap-[0.4rem] max-h-[8.5rem] overflow-y-auto"
        tierGroupClassName="flex flex-col gap-[0.35rem]"
        giftGridClassName="grid grid-cols-2 gap-[0.4rem]"
        playerButtonClassName={`${chatGiftOptionClass} flex items-center gap-2 text-left`}
        playerButtonActiveClassName={chatGiftOptionActiveClass}
        tierTitleClassName="text-[11px] uppercase tracking-[0.18em] text-white/70"
        giftButtonClassName={`${chatGiftOptionClass} flex items-center justify-center gap-2`}
        giftButtonActiveClassName={chatGiftOptionActiveClass}
        costClassName="text-[11px] uppercase tracking-[0.18em] text-white/70 mt-2 flex items-center justify-center gap-2"
        sendButtonClassName={chatGiftActionButtonClass}
        noteClassName="text-[10px] uppercase tracking-[0.18em] text-white/60 text-center"
        onGiftSent={({ from, to, gift }) => {
          const start = document.querySelector(`[data-player-index="${from}"]`);
          const end = document.querySelector(`[data-player-index="${to}"]`);
          if (!start || !end) return;
          const s = start.getBoundingClientRect();
          const e = end.getBoundingClientRect();
          const icon = document.createElement('div');
          icon.textContent = gift.icon;
          icon.style.position = 'fixed';
          icon.style.left = '0px';
          icon.style.top = '0px';
          icon.style.transform = `translate(${s.left + s.width / 2}px, ${s.top + s.height / 2}px)`;
          icon.style.transition = 'transform 1s ease-in-out';
          icon.style.fontSize = '24px';
          icon.style.zIndex = '70';
          document.body.appendChild(icon);
          requestAnimationFrame(() => {
            icon.style.transform = `translate(${e.left + e.width / 2}px, ${e.top + e.height / 2}px)`;
          });
          setTimeout(() => icon.remove(), 1200);
        }}
      />
    </div>
  );
}
