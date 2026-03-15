import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { GroundedSkybox } from 'three/examples/jsm/objects/GroundedSkybox.js';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { ARENA_CAMERA_DEFAULTS } from '../../utils/arenaCameraConfig.js';
import { createMurlanStyleTable } from '../../utils/murlanTable.js';
import {
  CHESS_CHAIR_OPTIONS,
  CHESS_TABLE_OPTIONS,
  CHESS_BATTLE_OPTION_LABELS
} from '../../config/chessBattleInventoryConfig.js';
import {
  POOL_ROYALE_DEFAULT_HDRI_ID,
  POOL_ROYALE_HDRI_VARIANTS
} from '../../config/poolRoyaleInventoryConfig.js';
import {
  chessBattleAccountId,
  getChessBattleInventory,
  getDefaultChessBattleLoadout
} from '../../utils/chessBattleInventory.js';

const SIZE = 8;
const BEAUTIFUL_GAME_URLS = [
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/ABeautifulGame/glTF/ABeautifulGame.gltf',
  'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/ABeautifulGame/glTF/ABeautifulGame.gltf',
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/ABeautifulGame/glTF/ABeautifulGame.gltf',
  'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/ABeautifulGame/glTF/ABeautifulGame.gltf'
];
const CHIP_SETS = [
  { id: 'ruby-cyan', light: '#ef4444', dark: '#06b6d4' },
  { id: 'emerald-violet', light: '#10b981', dark: '#8b5cf6' },
  { id: 'amber-slate', light: '#f59e0b', dark: '#334155' }
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

async function loadBeautifulBoardScene(loader) {
  let lastError = null;
  for (const url of BEAUTIFUL_GAME_URLS) {
    try {
      const gltf = await loader.loadAsync(url);
      if (gltf?.scene) return gltf.scene;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('ABeautifulGame failed to load');
}

async function resolveHdriUrl(variant) {
  const fallbackRes = variant?.fallbackResolution || '4k';
  const fallbackUrl = `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/${fallbackRes}/${variant?.assetId ?? 'colorful_studio'}_${fallbackRes}.hdr`;
  if (!variant?.assetId) return fallbackUrl;
  try {
    const response = await fetch(`https://api.polyhaven.com/files/${encodeURIComponent(variant.assetId)}`);
    if (!response.ok) return fallbackUrl;
    const data = await response.json();
    const urls = [];
    const walk = (value) => {
      if (!value) return;
      if (typeof value === 'string') {
        const low = value.toLowerCase();
        if (value.startsWith('http') && (low.endsWith('.hdr') || low.endsWith('.exr'))) urls.push(value);
        return;
      }
      if (Array.isArray(value)) return value.forEach(walk);
      if (typeof value === 'object') Object.values(value).forEach(walk);
    };
    walk(data);
    return urls.find((u) => u.includes(`/${fallbackRes}/`)) || urls[0] || fallbackUrl;
  } catch {
    return fallbackUrl;
  }
}

export default function CheckersBattleRoyal() {
  useTelegramBackButton();
  const navigate = useNavigate();
  const mountRef = useRef(null);
  const boardRef = useRef(createInitial());
  const selectedRef = useRef(null);
  const piecesGroupRef = useRef(null);
  const boardOriginRef = useRef({ x: 0, y: 0.72, z: 0, tile: 2.65 });

  const [turn, setTurn] = useState('light');
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [status, setStatus] = useState('Loading Checkers arena…');

  const inventory = useMemo(() => {
    const account = chessBattleAccountId();
    const inv = getChessBattleInventory(account);
    const defaults = getDefaultChessBattleLoadout();
    const pick = (type, fallback) => {
      const selected = inv[type]?.[0];
      if (selected) return selected;
      return defaults.find((d) => d.type === type)?.optionId || fallback;
    };
    return {
      tableId: pick('tables', CHESS_TABLE_OPTIONS[0]?.id),
      chairId: pick('chairColor', CHESS_CHAIR_OPTIONS[0]?.id),
      hdriId: pick('environmentHdri', POOL_ROYALE_DEFAULT_HDRI_ID)
    };
  }, []);

  const palette = CHIP_SETS[paletteIndex] || CHIP_SETS[0];

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
            new THREE.CylinderGeometry(0.88, 0.88, 0.33, 40),
            new THREE.MeshStandardMaterial({
              color: piece.side === 'light' ? palette.light : palette.dark,
              metalness: 0.5,
              roughness: 0.24
            })
          );
          chip.castShadow = true;
          chip.position.set(x + (c - 3.5) * tile, y + 0.18, z + (r - 3.5) * tile);
          if (piece.king) {
            const ring = new THREE.Mesh(
              new THREE.TorusGeometry(0.5, 0.11, 10, 28),
              new THREE.MeshStandardMaterial({ color: '#f8fafc', metalness: 0.92, roughness: 0.18 })
            );
            ring.rotation.x = Math.PI / 2;
            ring.position.y = 0.22;
            chip.add(ring);
          }
          group.add(chip);
        }
      }
    },
    [palette.dark, palette.light]
  );

  useEffect(() => {
    renderPieces();
  }, [renderPieces, turn]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer({ antialias: true });
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
    camera.position.set(0, 36, 42);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.enablePan = false;
    controls.minDistance = 22;
    controls.maxDistance = 70;
    controls.maxPolarAngle = Math.PI * 0.47;
    controls.minPolarAngle = 0.42;

    scene.add(new THREE.AmbientLight('#ffffff', 0.5));
    const keyLight = new THREE.DirectionalLight('#ffffff', 1.1);
    keyLight.position.set(18, 26, 12);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const piecesGroup = new THREE.Group();
    piecesGroupRef.current = piecesGroup;
    scene.add(piecesGroup);

    const pickTiles = [];
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let skybox = null;

    const applyMove = (r, c) => {
      const board = boardRef.current;
      const selected = selectedRef.current;
      const piece = board[r][c];
      if (piece && piece.side === turn) {
        selectedRef.current = { r, c };
        return;
      }
      if (!selected) return;
      const legal = getMoves(board, selected.r, selected.c);
      const move = legal.find((m) => m.r === r && m.c === c);
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
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    const boot = async () => {
      try {
        const tableTheme = CHESS_TABLE_OPTIONS.find((o) => o.id === inventory.tableId) || CHESS_TABLE_OPTIONS[0];
        const tableInfo = createMurlanStyleTable({ tableTheme: tableTheme?.id, tableScale: 1.16 });
        tableInfo.group.position.set(0, -0.6, 0);
        scene.add(tableInfo.group);

        // chairs use the same default color/theme source as Chess Battle Royal inventory
        const chairOption = CHESS_CHAIR_OPTIONS.find((o) => o.id === inventory.chairId) || CHESS_CHAIR_OPTIONS[0];
        const chairColor = chairOption?.primary || chairOption?.seatColor || '#8b0000';
        const chairMat = new THREE.MeshStandardMaterial({ color: chairColor, roughness: 0.42, metalness: 0.22 });
        const createChair = (z, rotY) => {
          const group = new THREE.Group();
          const seat = new THREE.Mesh(new THREE.BoxGeometry(5.6, 1.5, 5.4), chairMat);
          const back = new THREE.Mesh(new THREE.BoxGeometry(5.6, 4.8, 1.3), chairMat);
          seat.position.y = 0.75;
          back.position.set(0, 3.1, -2);
          seat.castShadow = back.castShadow = true;
          group.add(seat, back);
          group.position.set(0, -0.3, z);
          group.rotation.y = rotY;
          scene.add(group);
        };
        createChair(18.4, Math.PI);
        createChair(-18.4, 0);

        const loader = new GLTFLoader();
        const boardRoot = await loadBeautifulBoardScene(loader);
        boardRoot.scale.setScalar(0.125);
        boardRoot.position.set(0, 0.72, 0);
        boardRoot.traverse((child) => {
          if (!child.isMesh) return;
          const n = `${child.name || ''}`.toLowerCase();
          if (/(pawn|rook|knight|bishop|queen|king)/.test(n)) child.visible = false;
          child.castShadow = true;
          child.receiveShadow = true;
        });
        scene.add(boardRoot);

        const bbox = new THREE.Box3().setFromObject(boardRoot);
        const center = bbox.getCenter(new THREE.Vector3());
        boardOriginRef.current = {
          x: center.x,
          y: bbox.max.y + 0.05,
          z: center.z,
          tile: 2.65
        };

        const hdriVariant = POOL_ROYALE_HDRI_VARIANTS.find((v) => v.id === inventory.hdriId) ||
          POOL_ROYALE_HDRI_VARIANTS.find((v) => v.id === POOL_ROYALE_DEFAULT_HDRI_ID) ||
          POOL_ROYALE_HDRI_VARIANTS[0];
        const hdriUrl = await resolveHdriUrl(hdriVariant);
        const loaderEnv = hdriUrl.toLowerCase().endsWith('.exr') ? new EXRLoader() : new RGBELoader();
        const envMap = await loaderEnv.loadAsync(hdriUrl);
        envMap.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = envMap;
        scene.background = envMap;
        skybox = new GroundedSkybox(envMap, 1.5, 40, 128);
        scene.add(skybox);

        const { x, y, z, tile } = boardOriginRef.current;
        const pickMat = new THREE.MeshBasicMaterial({ visible: false });
        for (let r = 0; r < SIZE; r += 1) {
          for (let c = 0; c < SIZE; c += 1) {
            const pick = new THREE.Mesh(new THREE.BoxGeometry(tile * 0.94, 0.25, tile * 0.94), pickMat);
            pick.position.set(x + (c - 3.5) * tile, y + 0.16, z + (r - 3.5) * tile);
            pick.userData = { r, c };
            pickTiles.push(pick);
            scene.add(pick);
          }
        }

        renderPieces();
        setStatus('Ready');
      } catch (error) {
        console.error('Checkers Battle Royal boot failed:', error);
        setStatus('Asset load error. Please refresh.');
      }
    };
    void boot();

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
      if (skybox) scene.remove(skybox);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-[#050814] text-white">
      <div className="flex items-center justify-between px-4 py-3 text-xs">
        <button onClick={() => navigate('/games/checkersbattleroyal/lobby')} className="rounded bg-white/10 px-3 py-1">Lobby</button>
        <div>Checkers Battle Royal • Turn: {turn}</div>
        <button onClick={() => setPaletteIndex((v) => (v + 1) % CHIP_SETS.length)} className="rounded bg-white/10 px-3 py-1">Chip Colors</button>
      </div>
      <div className="px-4 pb-2 text-[11px] text-white/70">
        Board: ABeautifulGame • Table: {inventory.tableId} • Chairs: {inventory.chairId} • HDRI: {CHESS_BATTLE_OPTION_LABELS.environmentHdri?.[inventory.hdriId] || inventory.hdriId}
      </div>
      <div ref={mountRef} className="h-[72vh] w-full" />
      <div className="px-4 py-2 text-center text-xs text-white/70">{status}</div>
    </div>
  );
}
