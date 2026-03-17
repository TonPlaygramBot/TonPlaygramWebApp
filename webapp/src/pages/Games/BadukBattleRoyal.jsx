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
  BADUK_BOARD_LAYOUTS
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

const createBoard = (rows, cols) => Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));
const cloneBoard = (board) => board.map((row) => [...row]);
const isFull = (board) => board.every((row) => row.every(Boolean));

const getDropRow = (board, col) => {
  for (let r = board.length - 1; r >= 0; r -= 1) {
    if (!board[r][col]) return r;
  }
  return -1;
};

const checkWinner = (board, token) => {
  const rows = board.length;
  const cols = board[0].length;
  const dirs = [[0, 1], [1, 0], [1, 1], [-1, 1]];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (board[r][c] !== token) continue;
      for (const [dr, dc] of dirs) {
        let ok = true;
        for (let i = 1; i < 4; i += 1) {
          const nr = r + dr * i;
          const nc = c + dc * i;
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || board[nr][nc] !== token) {
            ok = false;
            break;
          }
        }
        if (ok) return true;
      }
    }
  }
  return false;
};

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

export default function BadukBattleRoyal() {
  useTelegramBackButton();
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const boardMeshRef = useRef(null);
  const stonesRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const rendererRef = useRef(null);
  const rayRef = useRef(new THREE.Raycaster());
  const pointerRef = useRef(new THREE.Vector2());
  const envRef = useRef({ map: null, skybox: null, hdriId: null });
  const navigate = useNavigate();

  const [params] = useSearchParams();
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

  const [appearance, setAppearance] = useState(() => ({
    tableFinish: inventory.tableFinish?.[0] || MURLAN_TABLE_FINISHES[0]?.id,
    tableId: inventory.tables?.[0] || BADUK_BATTLE_DEFAULT_LOADOUT.tables?.[0] || BADUK_TABLE_OPTIONS[0]?.id,
    chairId: inventory.chairColor?.[0] || BADUK_BATTLE_DEFAULT_LOADOUT.chairColor?.[0] || BADUK_CHAIR_OPTIONS[0]?.id,
    boardTheme: inventory.boardTheme?.[0] || BADUK_BATTLE_DEFAULT_LOADOUT.boardTheme?.[0] || BADUK_BOARD_THEMES[0]?.id,
    stoneStyle: inventory.stoneStyle?.[0] || BADUK_BATTLE_DEFAULT_LOADOUT.stoneStyle?.[0] || BADUK_STONE_STYLES[0]?.id,
    hdriId: inventory.environmentHdri?.[0] || BADUK_BATTLE_DEFAULT_LOADOUT.environmentHdri?.[0] || POOL_ROYALE_DEFAULT_HDRI_ID
  }));

  const [board, setBoard] = useState(() => createBoard(rows, cols));
  const [turn, setTurn] = useState('player');
  const [winner, setWinner] = useState(null);
  const [status, setStatus] = useState('4 in a Row started. Your move.');
  const [showChat, setShowChat] = useState(false);
  const [showGift, setShowGift] = useState(false);
  const [chatBubbles, setChatBubbles] = useState([]);

  const boardWidth = 2.1;
  const boardHeight = 2.2;
  const xStep = boardWidth / cols;
  const yStep = boardHeight / rows;

  useEffect(() => {
    setBoard(createBoard(rows, cols));
    setTurn('player');
    setWinner(null);
    setStatus(`Board ${cols}×${rows} loaded. Your move.`);
  }, [rows, cols]);

  const worldFromCell = (r, c) => [
    -boardWidth / 2 + (c + 0.5) * xStep,
    TABLE_HEIGHT + 0.2 + boardHeight / 2 - (r + 0.5) * yStep,
    0
  ];

  const renderPieces = (boardState) => {
    const group = stonesRef.current;
    if (!group) return;
    group.clear();
    const style = BADUK_STONE_STYLES.find((s) => s.id === appearance.stoneStyle) || BADUK_STONE_STYLES[0];
    const pMat = new THREE.MeshStandardMaterial({ color: style.white || '#f8fafc', roughness: 0.3 });
    const aiMat = new THREE.MeshStandardMaterial({ color: style.black || '#ca8a04', roughness: 0.25 });
    const geo = new THREE.CylinderGeometry(0.115, 0.115, 0.08, 32);
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        if (!boardState[r][c]) continue;
        const [x, y, z] = worldFromCell(r, c);
        const mesh = new THREE.Mesh(geo, boardState[r][c] === 'player' ? pMat : aiMat);
        mesh.position.set(x, y, z + 0.05);
        mesh.rotation.x = Math.PI / 2;
        group.add(mesh);
      }
    }
  };

  useEffect(() => renderPieces(board), [board, appearance.stoneStyle, rows, cols]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    applyRendererSRGB(renderer);
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const camera = new THREE.PerspectiveCamera(47, mount.clientWidth / mount.clientHeight, 0.1, 200);
    camera.position.set(0, TABLE_HEIGHT + 1.8, CHAIR_DISTANCE + 2.7);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.target.set(0, TABLE_HEIGHT + 0.6, 0);
    controls.minPolarAngle = THREE.MathUtils.degToRad(30);
    controls.maxPolarAngle = ARENA_CAMERA_DEFAULTS.phiMax;
    controls.enableDamping = true;
    controlsRef.current = controls;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(2.2, 4.5, 1.6);
    scene.add(key);

    const table = createMurlanStyleTable({ arena: scene, renderer, tableRadius: TABLE_RADIUS, tableHeight: TABLE_HEIGHT });
    applyTableMaterials(table.parts, MURLAN_TABLE_FINISHES[0]);

    [Math.PI / 2, -Math.PI / 2].forEach((angle) => {
      const chair = createChair();
      chair.position.set(Math.cos(angle) * CHAIR_DISTANCE, 0, Math.sin(angle) * CHAIR_DISTANCE);
      chair.lookAt(0, TABLE_HEIGHT, 0);
      scene.add(chair);
    });

    const boardGroup = new THREE.Group();
    const boardTheme = BADUK_BOARD_THEMES.find((theme) => theme.id === appearance.boardTheme) || BADUK_BOARD_THEMES[0];
    const frame = new THREE.Mesh(new THREE.BoxGeometry(boardWidth + 0.35, boardHeight + 0.35, 0.22), new THREE.MeshStandardMaterial({ color: boardTheme.tint || '#d7a359', roughness: 0.6 }));
    frame.position.set(0, TABLE_HEIGHT + 0.2, 0);
    boardGroup.add(frame);

    const boardFace = new THREE.Mesh(new THREE.PlaneGeometry(boardWidth, boardHeight), new THREE.MeshStandardMaterial({ color: boardTheme.grid || '#334155' }));
    boardFace.position.set(0, TABLE_HEIGHT + 0.2, 0.11);
    boardGroup.add(boardFace);

    const holes = new THREE.Group();
    const holeGeo = new THREE.TorusGeometry(0.12, 0.02, 8, 20);
    const holeMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.2 });
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const [x, y] = worldFromCell(r, c);
        const hole = new THREE.Mesh(holeGeo, holeMat);
        hole.position.set(x, y, 0.12);
        holes.add(hole);
      }
    }
    boardGroup.add(holes);

    const plane = new THREE.Mesh(new THREE.PlaneGeometry(boardWidth, boardHeight), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }));
    plane.position.set(0, TABLE_HEIGHT + 0.2, 0.18);
    boardGroup.add(plane);
    boardMeshRef.current = plane;

    const pieces = new THREE.Group();
    stonesRef.current = pieces;
    boardGroup.add(pieces);

    scene.add(boardGroup);

    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };

    let raf;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [rows, cols, appearance.boardTheme]);

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

  const playColumn = (col, token) => {
    const row = getDropRow(board, col);
    if (row < 0) return false;
    const next = cloneBoard(board);
    next[row][col] = token;
    setBoard(next);
    if (checkWinner(next, token)) {
      setWinner(token);
      setStatus(token === 'player' ? 'You connected 4 and won.' : 'AI connected 4 and won.');
      return true;
    }
    if (isFull(next)) {
      setWinner('draw');
      setStatus('Board full. Draw game.');
      return true;
    }
    setTurn(token === 'player' ? 'ai' : 'player');
    setStatus(token === 'player' ? 'AI is thinking…' : 'Your turn.');
    return true;
  };

  useEffect(() => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const boardMesh = boardMeshRef.current;
    if (!renderer || !camera || !boardMesh) return undefined;
    const onPointer = (event) => {
      if (turn !== 'player' || winner) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointerRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      rayRef.current.setFromCamera(pointerRef.current, camera);
      const hit = rayRef.current.intersectObject(boardMesh, false)[0];
      if (!hit) return;
      const normalizedX = (hit.point.x + boardWidth / 2) / boardWidth;
      const col = Math.min(cols - 1, Math.max(0, Math.floor(normalizedX * cols)));
      playColumn(col, 'player');
    };
    renderer.domElement.addEventListener('pointerdown', onPointer);
    return () => renderer.domElement.removeEventListener('pointerdown', onPointer);
  }, [turn, winner, board, cols]);

  useEffect(() => {
    if (turn !== 'ai' || winner) return;
    const t = setTimeout(() => {
      const depth = cols >= 8 ? 4 : 5;
      const { col } = minimax(board, depth, -Infinity, Infinity, true, 'ai', 'player');
      playColumn(col, 'ai');
    }, 380);
    return () => clearTimeout(t);
  }, [turn, winner, board, cols]);

  const playerCount = board.flat().filter((x) => x === 'player').length;
  const aiCount = board.flat().filter((x) => x === 'ai').length;

  return (
    <div className="relative min-h-screen bg-[#070b16] text-white">
      <div ref={mountRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute left-4 top-4 z-20 rounded-2xl border border-white/15 bg-black/60 p-3 text-xs">
        <h1 className="text-sm font-semibold uppercase tracking-[0.18em]">4 in a Row</h1>
        <p className="mt-1 text-white/80">Board: {cols}×{rows} • You:{playerCount} • AI:{aiCount}</p>
        <p className="mt-1 text-white/75">{status}</p>
      </div>

      <div className="pointer-events-none absolute inset-0 z-20">
        <div className="absolute left-1/2 top-[12%] -translate-x-1/2"><AvatarTimer photoUrl="🤖" name="AI Rival" active isTurn={turn === 'ai'} size={1} /></div>
        <div className="absolute left-1/2 top-[85%] -translate-x-1/2"><AvatarTimer photoUrl={avatar} name={username} active isTurn={turn === 'player'} size={1} /></div>
      </div>

      <div className="pointer-events-auto fixed bottom-4 right-3 z-50 flex gap-2">
        <button type="button" onClick={() => navigate('/store/badukbattleroyal')} className="rounded-xl border border-white/20 bg-black/60 px-3 py-2 text-xs">Store</button>
        <button type="button" onClick={() => { setBoard(createBoard(rows, cols)); setTurn('player'); setWinner(null); setStatus('New match started. Your move.'); }} className="rounded-xl border border-cyan-300/40 bg-cyan-400/30 px-3 py-2 text-xs font-semibold">Restart</button>
      </div>

      <BottomLeftIcons onGift={() => setShowGift(true)} showInfo={false} showChat={false} showMute={false} className="fixed right-3 bottom-28 z-50 flex flex-col gap-4" buttonClassName="icon-only-button pointer-events-auto flex h-11 w-11 items-center justify-center text-white/90" iconClassName="text-[1.65rem] leading-none" labelClassName="sr-only" giftIcon="🎁" order={['gift']} />
      <BottomLeftIcons onChat={() => setShowChat(true)} showInfo={false} showGift={false} showMute={false} className="fixed left-3 bottom-28 z-50 flex flex-col" buttonClassName="icon-only-button pointer-events-auto flex h-11 w-11 items-center justify-center text-white/90" iconClassName="text-[1.65rem] leading-none" labelClassName="sr-only" chatIcon="💬" order={['chat']} />

      <QuickMessagePopup open={showChat} onClose={() => setShowChat(false)} title="Quick Chat" onSend={(text) => { const id = Date.now(); setChatBubbles((b) => [...b, { id, text, photoUrl: avatar || '/assets/icons/profile.svg' }]); setTimeout(() => setChatBubbles((b) => b.filter((x) => x.id !== id)), 3000); }} />
      {chatBubbles.map((bubble) => <div key={bubble.id} className="chat-bubble chess-battle-chat-bubble"><span>{bubble.text}</span><img src={bubble.photoUrl} alt="avatar" className="w-5 h-5 rounded-full" /></div>)}
      <GiftPopup open={showGift} onClose={() => setShowGift(false)} players={[{ index: 0, id: badukBattleAccountId(accountId || undefined), name: username, photoUrl: avatar || '/assets/icons/profile.svg' }, { index: 1, id: 'ai-rival', name: 'AI Rival', photoUrl: '/assets/icons/bot.webp' }]} senderIndex={0} title="Send Gift" />
    </div>
  );
}
