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

const SIZE = 8;
const A_BEAUTIFUL_GAME_URL =
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/ABeautifulGame/glTF/ABeautifulGame.gltf';
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

function getMoves(board, r, c) {
  const piece = board[r][c];
  if (!piece) return [];
  const dirs = piece.king ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] : piece.side === 'light' ? [[-1, 1], [-1, -1]] : [[1, 1], [1, -1]];
  const captures = [];
  const normals = [];
  dirs.forEach(([dr, dc]) => {
    const nr = r + dr; const nc = c + dc;
    if (!inBounds(nr, nc)) return;
    if (!board[nr][nc]) normals.push({ r: nr, c: nc });
    else if (board[nr][nc].side !== piece.side) {
      const jr = nr + dr; const jc = nc + dc;
      if (inBounds(jr, jc) && !board[jr][jc]) captures.push({ r: jr, c: jc, capture: [nr, nc] });
    }
  });
  return captures.length ? captures : normals;
}

const resolveHdriUrl = async (variant) => {
  const fallbackRes = variant?.fallbackResolution || '4k';
  const fallback = `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/${fallbackRes}/${variant?.assetId}_${fallbackRes}.hdr`;
  if (!variant?.assetId) return fallback;
  try {
    const response = await fetch(`https://api.polyhaven.com/files/${encodeURIComponent(variant.assetId)}`);
    if (!response.ok) return fallback;
    const json = await response.json();
    const all = [];
    const walk = (value) => {
      if (!value) return;
      if (typeof value === 'string' && value.startsWith('http') && (value.endsWith('.hdr') || value.endsWith('.exr'))) all.push(value);
      else if (Array.isArray(value)) value.forEach(walk);
      else if (typeof value === 'object') Object.values(value).forEach(walk);
    };
    walk(json);
    return all.find((u) => u.includes(`/${fallbackRes}/`)) || all[0] || fallback;
  } catch {
    return fallback;
  }
};

export default function CheckersBattleRoyal() {
  useTelegramBackButton();
  const navigate = useNavigate();
  const mountRef = useRef(null);
  const boardRef = useRef(createInitial());
  const selectedRef = useRef(null);
  const [turn, setTurn] = useState('light');
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [tableIndex] = useState(0);
  const [chairIndex] = useState(0);
  const [hdriId] = useState(POOL_ROYALE_DEFAULT_HDRI_ID);
  const [status, setStatus] = useState('Loading 3D assets...');

  const palette = useMemo(() => CHIP_SETS[paletteIndex] || CHIP_SETS[0], [paletteIndex]);

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

    scene.add(new THREE.AmbientLight('#ffffff', 0.45));
    const key = new THREE.DirectionalLight('#ffffff', 1.1);
    key.position.set(18, 26, 12);
    key.castShadow = true;
    scene.add(key);

    const piecesGroup = new THREE.Group();
    const pickTiles = [];
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    scene.add(piecesGroup);

    const tileSize = 2.65;
    const boardCenter = new THREE.Vector3(0, 0, 0);
    let boardY = 0.72;

    const renderPieces = () => {
      piecesGroup.clear();
      const board = boardRef.current;
      for (let r = 0; r < SIZE; r += 1) {
        for (let c = 0; c < SIZE; c += 1) {
          const piece = board[r][c];
          if (!piece) continue;
          const chip = new THREE.Mesh(
            new THREE.CylinderGeometry(0.92, 0.92, 0.34, 42),
            new THREE.MeshStandardMaterial({ color: piece.side === 'light' ? palette.light : palette.dark, metalness: 0.52, roughness: 0.24 })
          );
          chip.castShadow = true;
          chip.position.set(boardCenter.x + (c - 3.5) * tileSize, boardY + 0.2, boardCenter.z + (r - 3.5) * tileSize);
          if (piece.king) {
            const crown = new THREE.Mesh(
              new THREE.TorusGeometry(0.55, 0.11, 10, 30),
              new THREE.MeshStandardMaterial({ color: '#f8fafc', metalness: 0.9, roughness: 0.2 })
            );
            crown.rotation.x = Math.PI / 2;
            crown.position.y = 0.23;
            chip.add(crown);
          }
          piecesGroup.add(chip);
        }
      }
    };

    const setupPickTiles = () => {
      const mat = new THREE.MeshBasicMaterial({ visible: false });
      for (let r = 0; r < SIZE; r += 1) {
        for (let c = 0; c < SIZE; c += 1) {
          const pick = new THREE.Mesh(new THREE.BoxGeometry(tileSize * 0.94, 0.25, tileSize * 0.94), mat);
          pick.position.set(boardCenter.x + (c - 3.5) * tileSize, boardY + 0.16, boardCenter.z + (r - 3.5) * tileSize);
          pick.userData = { r, c };
          scene.add(pick);
          pickTiles.push(pick);
        }
      }
    };

    const applyMove = (r, c) => {
      const board = boardRef.current;
      const selected = selectedRef.current;
      const piece = board[r][c];
      if (piece && piece.side === turn) {
        selectedRef.current = { r, c };
        setStatus(`${piece.side} selected`);
        return;
      }
      if (!selected) return;
      const legalMoves = getMoves(board, selected.r, selected.c);
      const move = legalMoves.find((m) => m.r === r && m.c === c);
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
      setStatus('Move applied');
      renderPieces();
    };

    const handlePointer = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hit = raycaster.intersectObjects(pickTiles, false)[0];
      if (hit?.object?.userData) applyMove(hit.object.userData.r, hit.object.userData.c);
    };

    renderer.domElement.addEventListener('pointerup', handlePointer);

    let skybox = null;
    const boot = async () => {
      try {
        const tableTheme = CHESS_TABLE_OPTIONS[tableIndex] || CHESS_TABLE_OPTIONS[0];
        const tableInfo = createMurlanStyleTable({ tableTheme: tableTheme?.id, tableScale: 1.16 });
        tableInfo.group.position.set(0, -0.6, 0);
        scene.add(tableInfo.group);

        const chairColor = CHESS_CHAIR_OPTIONS[chairIndex]?.primary || '#2b314e';
        const chairMat = new THREE.MeshStandardMaterial({ color: chairColor, roughness: 0.42, metalness: 0.22 });
        const mkChair = (z, rot) => {
          const g = new THREE.Group();
          const seat = new THREE.Mesh(new THREE.BoxGeometry(5.6, 1.5, 5.4), chairMat);
          const back = new THREE.Mesh(new THREE.BoxGeometry(5.6, 4.8, 1.3), chairMat);
          seat.position.y = 0.75; back.position.set(0, 3.1, -2);
          g.add(seat, back);
          g.position.set(0, -0.3, z);
          g.rotation.y = rot;
          scene.add(g);
        };
        mkChair(18.4, Math.PI);
        mkChair(-18.4, 0);

        const gltf = await new GLTFLoader().loadAsync(A_BEAUTIFUL_GAME_URL);
        const boardRoot = gltf.scene;
        boardRoot.scale.setScalar(0.125);
        boardRoot.position.set(0, boardY, 0);
        boardRoot.traverse((obj) => {
          if (!obj.isMesh) return;
          const n = `${obj.name || ''}`.toLowerCase();
          if (/(pawn|rook|knight|bishop|queen|king)/.test(n)) {
            obj.visible = false;
          } else {
            obj.castShadow = true;
            obj.receiveShadow = true;
          }
        });
        scene.add(boardRoot);

        const bbox = new THREE.Box3().setFromObject(boardRoot);
        boardCenter.copy(bbox.getCenter(new THREE.Vector3()));
        boardY = bbox.max.y + 0.05;

        const hdriVariant = POOL_ROYALE_HDRI_VARIANTS.find((v) => v.id === hdriId) || POOL_ROYALE_HDRI_VARIANTS[0];
        const hdriUrl = await resolveHdriUrl(hdriVariant);
        const useExr = hdriUrl.toLowerCase().endsWith('.exr');
        const envMap = await (useExr ? new EXRLoader() : new RGBELoader()).loadAsync(hdriUrl);
        envMap.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = envMap;
        scene.background = envMap;
        skybox = new GroundedSkybox(envMap, 1.5, 40, 128);
        scene.add(skybox);

        setupPickTiles();
        renderPieces();
        setStatus('Ready');
      } catch (error) {
        console.error('Checkers scene failed', error);
        setStatus('Failed to load some 3D assets, retrying visuals fallback.');
        setupPickTiles();
        renderPieces();
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
      renderer.domElement.removeEventListener('pointerup', handlePointer);
      window.removeEventListener('resize', onResize);
      if (skybox) scene.remove(skybox);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [palette]);

  return (
    <div className="min-h-screen bg-[#050814] text-white">
      <div className="flex items-center justify-between px-4 py-3 text-xs">
        <button onClick={() => navigate('/games/checkersbattleroyal/lobby')} className="rounded bg-white/10 px-3 py-1">Lobby</button>
        <div>Checkers Battle Royal • Turn: {turn}</div>
        <button onClick={() => setPaletteIndex((v) => (v + 1) % CHIP_SETS.length)} className="rounded bg-white/10 px-3 py-1">Chip Colors</button>
      </div>
      <div className="px-4 pb-2 text-[11px] text-white/70">
        Board: ABeautifulGame • Table: {CHESS_TABLE_OPTIONS[0]?.label} • Chairs: {CHESS_CHAIR_OPTIONS[0]?.label} • HDRI: {CHESS_BATTLE_OPTION_LABELS.environmentHdri?.[hdriId] || hdriId}
      </div>
      <div ref={mountRef} className="h-[72vh] w-full" />
      <div className="px-4 py-2 text-center text-xs text-white/70">{status}</div>
    </div>
  );
}
