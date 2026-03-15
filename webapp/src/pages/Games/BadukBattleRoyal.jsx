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
import { badukBattleAccountId, getBadukBattleInventory } from '../../utils/badukBattleInventory.js';
import { applyRendererSRGB, applySRGBColorSpace } from '../../utils/colorSpace.js';

const BOARD_SIZES = [9, 13, 16, 19];

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

export default function BadukBattleRoyal() {
  useTelegramBackButton();
  const navigate = useNavigate();
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
    const boardExtent = 2.04;
    const step = boardExtent / (boardSize - 1);
    const start = -boardExtent / 2;
    const x = start + c * step;
    const z = start + r * step;
    return [x, z];
  };

  const cellFromWorld = (x, z) => {
    const boardExtent = 2.04;
    const half = boardExtent / 2;
    const normalizedX = clamp((x + half) / boardExtent, 0, 1);
    const normalizedZ = clamp((z + half) / boardExtent, 0, 1);
    const c = Math.round(normalizedX * (boardSize - 1));
    const r = Math.round(normalizedZ * (boardSize - 1));
    return [r, c];
  };

  const renderStones = (boardState, lm) => {
    const group = stonesGroupRef.current;
    if (!group) return;
    group.clear();

    const stoneGeo = new THREE.SphereGeometry(0.045, 22, 16);
    const blackMat = new THREE.MeshStandardMaterial({ color: '#0b0b0d', roughness: 0.28, metalness: 0.06 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.2, metalness: 0.03 });
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
  }, [board, lastMove]);

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

    const boardPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(2.04, 2.04),
      new THREE.MeshStandardMaterial({ color: '#d7a359', roughness: 0.78, metalness: 0 })
    );
    boardPlane.rotation.x = -Math.PI / 2;
    boardPlane.position.y = TABLE_HEIGHT + 0.046;
    boardPlane.name = 'baduk-board-click-plane';
    boardGroup.add(boardPlane);
    boardMeshRef.current = boardPlane;

    const boardTexture = new THREE.TextureLoader().load(`/assets/game-art/baduk-battle-royal/boards/${boardSize}x${boardSize}.svg`);
    applySRGBColorSpace(boardTexture);
    boardTexture.anisotropy = 8;
    boardPlane.material.map = boardTexture;
    boardPlane.material.needsUpdate = true;

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
  }, [boardSize, appearance.chairId, graphicsOption.fps, graphicsOption.pixelRatioCap, graphicsOption.renderScale]);

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

  const onRestart = () => {
    setBoard(createBoard(boardSize));
    setTurn('black');
    setCaptures({ black: 0, white: 0 });
    setPassCount(0);
    setLastMove(null);
    setStatus('Board reset. Black to play.');
  };

  const blackStones = board.flat().filter((s) => s === 'black').length;
  const whiteStones = board.flat().filter((s) => s === 'white').length;

  return (
    <div className="relative min-h-screen bg-[#070b16] text-white">
      <div ref={mountRef} className="absolute inset-0" />

      <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 p-3">
        <div className="pointer-events-auto mx-auto max-w-[27rem] rounded-2xl border border-white/15 bg-black/60 p-3 backdrop-blur">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-sm font-semibold uppercase tracking-[0.18em]">Baduk Battle Royal</h1>
            <button onClick={() => navigate('/games/badukbattleroyal/lobby')} className="rounded-lg border border-white/20 px-2 py-1 text-xs">Lobby</button>
          </div>
          <p className="mt-2 text-xs text-white/75">Board {boardSize}×{boardSize} • Turn: {turn} • B:{blackStones} W:{whiteStones} • Captures B:{captures.black} W:{captures.white}</p>
          <p className="mt-1 text-xs text-cyan-100/90">{status}</p>
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
            <button onClick={onRestart} className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs">Restart</button>
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
          onGift={() => setStatus('Gift interactions are aligned with Chess Battle Royal UI.')}
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
          onChat={() => setStatus('Quick chat coming soon for Baduk multiplayer.')}
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
        <div className="absolute left-1/2 top-[12%] -translate-x-1/2">
          <AvatarTimer photoUrl="🤖" name="AI Rival" active isTurn={turn === 'white'} size={1} />
        </div>
        <div className="absolute left-1/2 top-[85%] -translate-x-1/2">
          <AvatarTimer photoUrl={avatar} name={username} active isTurn={turn === 'black'} size={1} />
        </div>
      </div>
    </div>
  );
}
