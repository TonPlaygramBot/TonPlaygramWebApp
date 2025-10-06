import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import * as THREE from 'three';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import {
  getTelegramFirstName,
  getTelegramUsername,
  getTelegramPhotoUrl
} from '../../utils/telegram.js';
import { bombSound } from '../../assets/soundData.js';
import { getGameVolume } from '../../utils/sound.js';
import { ARENA_COLORS, createCarpetTextures } from '../../components/arenaMaterials.js';

/**
 * CHESS 3D — Procedural, Modern Look (no external models)
 * -------------------------------------------------------
 * • E njëjta teknikë si projektet e tua: vetëm primitive (Box/Cylinder/Cone/Sphere) + materiale standarde
 * • Fushë 8x8 me koordinata, bordure moderne, ndriçim kinematik
 * • Figura low‑poly procedurale (king/queen/rook/bishop/knight/pawn)
 * • Lojë e plotë bazë: lëvizje të ligjshme, radhë e bardhë → e zezë, kapje, shah, **checkmate/stalemate**, promovim në queen
 * • UI minimale: status bar (rendi, check, mate), reset
 * • Kontroll: klik për të zgjedhur figuren, klik te një nga synimet e theksuara për ta lëvizur
 *
 * Shënim: për thjeshtësi, ky version nuk përfshin en‑passant dhe rokadë. Mund t’i shtojmë lehtë.
 */

// ========================= Config =========================
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const COLORS = Object.freeze({
  woodDark: 0x3a2d23,
  woodLight: 0xd2b48c,
  tileLight: 0xe7e2d3,
  tileDark: 0x776a5a,
  accent: 0x00e5ff,
  whitePiece: 0xf5f5f7,
  // Slightly brighter black pieces for better visibility
  blackPiece: 0x3c4044,
  highlight: 0x6ee7b7,
  danger: 0xf87171,
  bg: 0x0b0d11
});

const BOARD = { N: 8, tile: 4.2, rim: 2.2, baseH: 0.8 };
const PIECE_Y = 1.2; // baseline height for meshes

const RAW_BOARD_SIZE = BOARD.N * BOARD.tile + BOARD.rim * 2;
const BOARD_DISPLAY_SIZE = 3.4;
const BOARD_SCALE = BOARD_DISPLAY_SIZE / RAW_BOARD_SIZE;

const TABLE_TOP_SIZE = BOARD_DISPLAY_SIZE + 0.6;
const TABLE_TOP_THICKNESS = 0.18;
const TABLE_LEG_HEIGHT = 0.85 * 2; // Twice the original height
const TABLE_LEG_INSET = 0.45;

const WALL_PROXIMITY_FACTOR = 0.5; // Bring arena walls 50% closer
const WALL_HEIGHT_MULTIPLIER = 2; // Double wall height
const CHAIR_SCALE = 4; // Chairs are 4x larger
const CHAIR_CLEARANCE = 0.52;
const CAMERA_INITIAL_RADIUS_FACTOR = 1.35;
const CAMERA_MIN_RADIUS_FACTOR = 0.95;
const CAMERA_MAX_RADIUS_FACTOR = 2.4;
const CAMERA_INITIAL_PHI_LERP = 0.35;
const CAMERA_VERTICAL_SENSITIVITY = 0.003;
const CAMERA_LEAN_STRENGTH = 0.0065;

const SNOOKER_TABLE_SCALE = 1.3;
const SNOOKER_TABLE_W = 66 * SNOOKER_TABLE_SCALE;
const SNOOKER_TABLE_H = 132 * SNOOKER_TABLE_SCALE;
const SNOOKER_ROOM_DEPTH = SNOOKER_TABLE_H * 3.6;
const SNOOKER_SIDE_CLEARANCE = SNOOKER_ROOM_DEPTH / 2 - SNOOKER_TABLE_H / 2;
const SNOOKER_ROOM_WIDTH = SNOOKER_TABLE_W + SNOOKER_SIDE_CLEARANCE * 2;
const SNOOKER_SIZE_REDUCTION = 0.7;
const SNOOKER_GLOBAL_SIZE_FACTOR = 0.85 * SNOOKER_SIZE_REDUCTION;
const SNOOKER_WORLD_SCALE = 0.85 * SNOOKER_GLOBAL_SIZE_FACTOR * 0.7;
// Match half of the scaled snooker arena footprint
const CHESS_ARENA = Object.freeze({
  width: (SNOOKER_ROOM_WIDTH * SNOOKER_WORLD_SCALE) / 2,
  depth: (SNOOKER_ROOM_DEPTH * SNOOKER_WORLD_SCALE) / 2
});

const CAM = {
  fov: 52,
  near: 0.1,
  far: 5000,
  minR: BOARD_DISPLAY_SIZE * CAMERA_MIN_RADIUS_FACTOR,
  maxR: BOARD_DISPLAY_SIZE * CAMERA_MAX_RADIUS_FACTOR,
  phiMin: 0.92,
  phiMax: 1.22
};

// =============== Materials & simple builders ===============
const mat = (c, r = 0.82, m = 0.12) =>
  new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
const box = (w, h, d, c) =>
  new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
const cyl = (rt, rb, h, c, seg = 24) =>
  new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(c));
const sph = (r, c, seg = 20) =>
  new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg), mat(c, 0.6, 0.05));
const cone = (r, h, c, seg = 24) =>
  new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat(c));

// ======================= Piece shapes =======================
function buildPawn(color) {
  const g = new THREE.Group();
  const base = cyl(1.1, 1.3, 0.4, color);
  base.position.y = PIECE_Y;
  g.add(base);
  const neck = cyl(0.7, 0.95, 1.6, color);
  neck.position.y = PIECE_Y + 1.1;
  g.add(neck);
  const head = sph(0.7, color);
  head.position.y = PIECE_Y + 2.3;
  g.add(head);
  return g;
}
function buildRook(color) {
  const g = new THREE.Group();
  const foot = cyl(1.3, 1.6, 0.5, color);
  foot.position.y = PIECE_Y;
  g.add(foot);
  const body = cyl(1.2, 1.2, 2.2, color);
  body.position.y = PIECE_Y + 1.4;
  g.add(body);
  const crown = box(2.0, 0.5, 2.0, color);
  crown.position.y = PIECE_Y + 2.8;
  g.add(crown);
  return g;
}
function buildKnight(color) {
  const g = new THREE.Group();
  const foot = cyl(1.3, 1.6, 0.5, color);
  foot.position.y = PIECE_Y;
  g.add(foot);
  const body = cyl(1.0, 1.2, 1.6, color);
  body.position.y = PIECE_Y + 1.1;
  g.add(body);
  const head = new THREE.Group();
  const neck = cyl(0.7, 0.9, 0.8, color);
  neck.rotation.z = 0.2;
  neck.position.set(0, PIECE_Y + 1.9, 0.2);
  head.add(neck);
  const face = box(0.9, 1.1, 0.6, color);
  face.position.set(0.1, PIECE_Y + 2.6, 0.2);
  head.add(face);
  const ear1 = cone(0.18, 0.35, color);
  ear1.position.set(0.35, PIECE_Y + 3.0, 0.15);
  head.add(ear1);
  const ear2 = cone(0.18, 0.35, color);
  ear2.position.set(-0.05, PIECE_Y + 3.0, 0.15);
  head.add(ear2);
  g.add(head);
  return g;
}
function buildBishop(color) {
  const g = new THREE.Group();
  const foot = cyl(1.2, 1.6, 0.5, color);
  foot.position.y = PIECE_Y;
  g.add(foot);
  const body = cyl(0.9, 1.1, 2.2, color);
  body.position.y = PIECE_Y + 1.3;
  g.add(body);
  const mitre = sph(0.9, color);
  mitre.position.y = PIECE_Y + 2.6;
  g.add(mitre);
  const slit = box(0.1, 0.6, 0.2, COLORS.accent);
  slit.position.y = PIECE_Y + 2.6;
  g.add(slit);
  return g;
}
function buildQueen(color) {
  const g = new THREE.Group();
  const base = cyl(1.4, 1.8, 0.6, color);
  base.position.y = PIECE_Y;
  g.add(base);
  const body = cyl(1.1, 1.3, 2.6, color);
  body.position.y = PIECE_Y + 1.7;
  g.add(body);
  const crown = new THREE.Group();
  const ring = cyl(1.2, 1.2, 0.3, color);
  ring.position.y = PIECE_Y + 3.1;
  crown.add(ring);
  const spikes = 6;
  for (let i = 0; i < spikes; i++) {
    const s = cone(0.18, 0.6, color);
    const a = i * ((Math.PI * 2) / spikes);
    s.position.set(Math.cos(a) * 0.9, PIECE_Y + 3.6, Math.sin(a) * 0.9);
    s.rotation.x = -Math.PI / 2;
    crown.add(s);
  }
  g.add(crown);
  return g;
}
function buildKing(color) {
  const g = new THREE.Group();
  const base = cyl(1.4, 1.9, 0.6, color);
  base.position.y = PIECE_Y;
  g.add(base);
  const body = cyl(1.1, 1.3, 2.9, color);
  body.position.y = PIECE_Y + 1.9;
  g.add(body);
  const orb = sph(0.55, color);
  orb.position.y = PIECE_Y + 3.2;
  g.add(orb);
  const crossV = box(0.2, 0.8, 0.2, color);
  crossV.position.y = PIECE_Y + 3.8;
  g.add(crossV);
  const crossH = box(0.8, 0.2, 0.2, color);
  crossH.position.y = PIECE_Y + 3.8;
  g.add(crossH);
  return g;
}

// Map to builder
const BUILDERS = {
  P: buildPawn,
  R: buildRook,
  N: buildKnight,
  B: buildBishop,
  Q: buildQueen,
  K: buildKing
};

// ======================= Game logic ========================
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';

function parseFEN(fen) {
  const rows = fen.split('/');
  const board = [];
  for (let r = 0; r < 8; r++) {
    const row = [];
    let i = 0;
    for (const ch of rows[r]) {
      if (/[1-8]/.test(ch)) {
        const n = parseInt(ch, 10);
        for (let k = 0; k < n; k++) row.push(null);
      } else {
        const isWhite = ch === ch.toUpperCase();
        row.push({ t: ch.toUpperCase(), w: isWhite });
      }
      i++;
    }
    board.push(row);
  }
  return board;
}

function cloneBoard(b) {
  return b.map((r) => r.map((c) => (c ? { t: c.t, w: c.w } : null)));
}

// Offsets
const DIRS = {
  N: [-1, 0],
  S: [1, 0],
  E: [0, 1],
  W: [0, -1],
  NE: [-1, 1],
  NW: [-1, -1],
  SE: [1, 1],
  SW: [1, -1]
};
const KN = [
  [-2, -1],
  [-2, 1],
  [-1, -2],
  [-1, 2],
  [1, -2],
  [1, 2],
  [2, -1],
  [2, 1]
];

function inBoard(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function genMoves(board, r, c) {
  const piece = board[r][c];
  if (!piece) return [];
  const { t, w } = piece;
  const moves = [];
  const push = (rr, cc) => {
    if (!inBoard(rr, cc)) return;
    const dst = board[rr][cc];
    if (!dst || dst.w !== w) moves.push([rr, cc]);
  };

  if (t === 'P') {
    const dir = w ? -1 : 1;
    const start = w ? 6 : 1;
    const f1 = [r + dir, c];
    if (inBoard(...f1) && !board[f1[0]][f1[1]]) {
      moves.push(f1);
      const f2 = [r + dir * 2, c];
      if (r === start && !board[f2[0]][f2[1]]) moves.push(f2);
    }
    for (const dc of [-1, 1]) {
      const rr = r + dir,
        cc = c + dc;
      if (inBoard(rr, cc) && board[rr][cc] && board[rr][cc].w !== w)
        moves.push([rr, cc]);
    }
    // (no en passant here)
  } else if (t === 'N') {
    for (const [dr, dc] of KN) {
      const rr = r + dr,
        cc = c + dc;
      push(rr, cc);
    }
  } else if (t === 'B' || t === 'R' || t === 'Q') {
    const dirs = [];
    if (t === 'B' || t === 'Q') dirs.push(DIRS.NE, DIRS.NW, DIRS.SE, DIRS.SW);
    if (t === 'R' || t === 'Q') dirs.push(DIRS.N, DIRS.S, DIRS.E, DIRS.W);
    for (const [dr, dc] of dirs) {
      let rr = r + dr,
        cc = c + dc;
      while (inBoard(rr, cc)) {
        if (board[rr][cc]) {
          if (board[rr][cc].w !== w) moves.push([rr, cc]);
          break;
        }
        moves.push([rr, cc]);
        rr += dr;
        cc += dc;
      }
    }
  } else if (t === 'K') {
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (dr || dc) push(r + dr, c + dc);
      }
    // (no castling here)
  }
  return moves;
}

function findKing(board, w) {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.t === 'K' && p.w === w) return [r, c];
    }
  return null;
}

function isSquareAttacked(board, r, c, byWhite) {
  // generate opponent pseudo-moves and see if any hits (r,c)
  for (let rr = 0; rr < 8; rr++) {
    for (let cc = 0; cc < 8; cc++) {
      const p = board[rr][cc];
      if (!p || p.w !== byWhite) continue;
      const mv = genMoves(board, rr, cc);
      if (mv.some(([r2, c2]) => r2 === r && c2 === c)) return true;
    }
  }
  return false;
}

function legalMoves(board, r, c) {
  const piece = board[r][c];
  if (!piece) return [];
  const cand = genMoves(board, r, c);
  const res = [];
  for (const [rr, cc] of cand) {
    const b2 = cloneBoard(board);
    b2[rr][cc] = b2[r][c];
    b2[r][c] = null;
    const king = findKing(b2, piece.w);
    if (!king) continue;
    const check = isSquareAttacked(b2, king[0], king[1], !piece.w);
    if (!check) res.push([rr, cc]);
  }
  return res;
}

function anyLegal(board, whiteTurn) {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.w === whiteTurn) {
        if (legalMoves(board, r, c).length > 0) return true;
      }
    }
  return false;
}

// --------- Simple minimax AI for black ---------
const PIECE_VALUE = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000 };

function evaluate(board) {
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      const val = PIECE_VALUE[p.t] || 0;
      score += p.w ? val : -val;
    }
  }
  return score;
}

function minimax(board, depth, whiteTurn, alpha, beta) {
  const noMoves = !anyLegal(board, whiteTurn);
  if (depth === 0 || noMoves) {
    if (noMoves) {
      const king = findKing(board, whiteTurn);
      const inCheck = king && isSquareAttacked(board, king[0], king[1], !whiteTurn);
      if (inCheck) return whiteTurn ? -Infinity : Infinity;
      return 0;
    }
    return evaluate(board);
  }
  if (whiteTurn) {
    let maxEval = -Infinity;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (!p || !p.w) continue;
        for (const [rr, cc] of legalMoves(board, r, c)) {
          const b2 = cloneBoard(board);
          b2[rr][cc] = b2[r][c];
          b2[r][c] = null;
          if (b2[rr][cc].t === 'P' && rr === 0) b2[rr][cc].t = 'Q';
          const evalScore = minimax(b2, depth - 1, false, alpha, beta);
          maxEval = Math.max(maxEval, evalScore);
          alpha = Math.max(alpha, evalScore);
          if (beta <= alpha) break;
        }
      }
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (!p || p.w) continue;
        for (const [rr, cc] of legalMoves(board, r, c)) {
          const b2 = cloneBoard(board);
          b2[rr][cc] = b2[r][c];
          b2[r][c] = null;
          if (b2[rr][cc].t === 'P' && rr === 7) b2[rr][cc].t = 'Q';
          const evalScore = minimax(b2, depth - 1, true, alpha, beta);
          minEval = Math.min(minEval, evalScore);
          beta = Math.min(beta, evalScore);
          if (beta <= alpha) break;
        }
      }
    }
    return minEval;
  }
}

function bestBlackMove(board, depth = 3) {
  let best = null;
  let bestScore = Infinity;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p || p.w) continue;
      for (const [rr, cc] of legalMoves(board, r, c)) {
        const b2 = cloneBoard(board);
        b2[rr][cc] = b2[r][c];
        b2[r][c] = null;
        if (b2[rr][cc].t === 'P' && rr === 7) b2[rr][cc].t = 'Q';
        const score = minimax(b2, depth - 1, true, -Infinity, Infinity);
        if (score < bestScore) {
          bestScore = score;
          best = { from: [r, c], to: [rr, cc] };
        }
      }
    }
  }
  return best;
}

const formatTime = (t) =>
  `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;

// ======================= Main Component =======================
function Chess3D({ avatar, username }) {
  const wrapRef = useRef(null);
  const rafRef = useRef(0);
  const timerRef = useRef(null);
  const bombSoundRef = useRef(null);
  const zoomRef = useRef({});
  const [whiteTime, setWhiteTime] = useState(60);
  const [blackTime, setBlackTime] = useState(5);

  const [ui, setUi] = useState({
    turnWhite: true,
    status: 'White to move',
    promoting: null,
    winner: null
  });
  const uiRef = useRef(ui);
  useEffect(() => {
    uiRef.current = ui;
  }, [ui]);

  useEffect(() => {
    const host = wrapRef.current;
    if (!host) return;
    let scene, camera, renderer, ray, sph;
    let last = performance.now();
    const capturedByWhite = [];
    const capturedByBlack = [];

    const vol = getGameVolume();
    bombSoundRef.current = new Audio(bombSound);
    bombSoundRef.current.volume = vol;

    // ----- Build scene -----
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    // Ensure the canvas covers the entire host element so the board is centered
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.zIndex = '0';
    host.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c1020);
    const key = new THREE.DirectionalLight(0xffffff, 1.0);
    key.position.set(1.8, 2.6, 1.6);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.55);
    fill.position.set(-1.4, 2.2, -2.0);
    scene.add(fill);
    const rim = new THREE.PointLight(0xff7373, 0.4, 12, 2.0);
    rim.position.set(0, 2.1, 0);
    scene.add(rim);

    const arena = new THREE.Group();
    scene.add(arena);

    const ambient = new THREE.HemisphereLight(
      ARENA_COLORS.hemisphereSky,
      ARENA_COLORS.hemisphereGround,
      ARENA_COLORS.hemisphereIntensity
    );
    arena.add(ambient);

    const arenaHalfWidth = CHESS_ARENA.width / 2;
    const arenaHalfDepth = CHESS_ARENA.depth / 2;
    const wallInset = 0.5;
    const halfRoomX = (arenaHalfWidth - wallInset) * WALL_PROXIMITY_FACTOR;
    const halfRoomZ = (arenaHalfDepth - wallInset) * WALL_PROXIMITY_FACTOR;
    const roomHalfWidth = halfRoomX + wallInset;
    const roomHalfDepth = halfRoomZ + wallInset;

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(roomHalfWidth * 2, roomHalfDepth * 2),
      new THREE.MeshStandardMaterial({
        color: ARENA_COLORS.floor,
        roughness: 0.95,
        metalness: 0.05
      })
    );
    floor.rotation.x = -Math.PI / 2;
    arena.add(floor);

    const carpetTextures = createCarpetTextures();
    const carpetMat = new THREE.MeshStandardMaterial({
      color: ARENA_COLORS.carpet,
      roughness: 0.92,
      metalness: 0.04
    });
    if (carpetTextures.map) {
      carpetMat.map = carpetTextures.map;
      carpetMat.map.repeat.set(1, 1);
      carpetMat.map.needsUpdate = true;
    }
    if (carpetTextures.bump) {
      carpetMat.bumpMap = carpetTextures.bump;
      carpetMat.bumpMap.repeat.set(1, 1);
      carpetMat.bumpScale = 0.24;
      carpetMat.bumpMap.needsUpdate = true;
    }
    const carpet = new THREE.Mesh(
      new THREE.PlaneGeometry(roomHalfWidth * 1.2, roomHalfDepth * 1.2),
      carpetMat
    );
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.y = 0.002;
    arena.add(carpet);

    const wallH = 3 * WALL_HEIGHT_MULTIPLIER;
    const wallT = 0.1;
    const wallMat = new THREE.MeshStandardMaterial({
      color: ARENA_COLORS.wall,
      roughness: ARENA_COLORS.wallRoughness,
      metalness: ARENA_COLORS.wallMetalness,
      side: THREE.DoubleSide
    });
    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(halfRoomX * 2, wallH, wallT),
      wallMat
    );
    backWall.position.set(0, wallH / 2, halfRoomZ);
    arena.add(backWall);
    const frontWall = new THREE.Mesh(
      new THREE.BoxGeometry(halfRoomX * 2, wallH, wallT),
      wallMat
    );
    frontWall.position.set(0, wallH / 2, -halfRoomZ);
    arena.add(frontWall);
    const leftWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallT, wallH, halfRoomZ * 2),
      wallMat
    );
    leftWall.position.set(-halfRoomX, wallH / 2, 0);
    arena.add(leftWall);
    const rightWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallT, wallH, halfRoomZ * 2),
      wallMat
    );
    rightWall.position.set(halfRoomX, wallH / 2, 0);
    arena.add(rightWall);

    const ceilTrim = new THREE.Mesh(
      new THREE.BoxGeometry(halfRoomX * 2, 0.02, halfRoomZ * 2),
      new THREE.MeshStandardMaterial({
        color: ARENA_COLORS.trim,
        roughness: 0.9,
        metalness: 0.02,
        side: THREE.DoubleSide
      })
    );
    ceilTrim.position.set(0, wallH - 0.02, 0);
    arena.add(ceilTrim);

    const ledMat = new THREE.MeshStandardMaterial({
      color: ARENA_COLORS.led,
      emissive: ARENA_COLORS.ledEmissive,
      emissiveIntensity: 0.4,
      roughness: 0.6,
      metalness: 0.2,
      side: THREE.DoubleSide
    });
    const stripBack = new THREE.Mesh(
      new THREE.BoxGeometry(halfRoomX * 2, 0.02, 0.01),
      ledMat
    );
    stripBack.position.set(0, 0.05, halfRoomZ - wallT / 2);
    arena.add(stripBack);
    const stripFront = stripBack.clone();
    stripFront.position.set(0, 0.05, -halfRoomZ + wallT / 2);
    arena.add(stripFront);
    const stripLeft = new THREE.Mesh(
      new THREE.BoxGeometry(0.01, 0.02, halfRoomZ * 2),
      ledMat
    );
    stripLeft.position.set(-halfRoomX + wallT / 2, 0.05, 0);
    arena.add(stripLeft);
    const stripRight = stripLeft.clone();
    stripRight.position.set(halfRoomX - wallT / 2, 0.05, 0);
    arena.add(stripRight);

    const table = new THREE.Group();
    const tableTop = new THREE.Mesh(
      new THREE.BoxGeometry(
        TABLE_TOP_SIZE,
        TABLE_TOP_THICKNESS,
        TABLE_TOP_SIZE
      ),
      new THREE.MeshStandardMaterial({
        color: 0x2a2a2a,
        roughness: 0.6,
        metalness: 0.1
      })
    );
    const tableTopY = TABLE_LEG_HEIGHT + TABLE_TOP_THICKNESS / 2;
    tableTop.position.y = tableTopY;
    table.add(tableTop);
    const legGeo = new THREE.BoxGeometry(0.12, TABLE_LEG_HEIGHT, 0.12);
    const legMat = new THREE.MeshStandardMaterial({
      color: 0x3a3a3a,
      roughness: 0.7
    });
    const legOffsetX = TABLE_TOP_SIZE / 2 - TABLE_LEG_INSET;
    const legOffsetZ = TABLE_TOP_SIZE / 2 - TABLE_LEG_INSET;
    [
      [-legOffsetX, TABLE_LEG_HEIGHT / 2, -legOffsetZ],
      [legOffsetX, TABLE_LEG_HEIGHT / 2, -legOffsetZ],
      [-legOffsetX, TABLE_LEG_HEIGHT / 2, legOffsetZ],
      [legOffsetX, TABLE_LEG_HEIGHT / 2, legOffsetZ]
    ].forEach(([x, y, z]) => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(x, y, z);
      table.add(leg);
    });
    arena.add(table);

    function makeChair() {
      const g = new THREE.Group();
      const seat = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.06, 0.5),
        new THREE.MeshStandardMaterial({
          color: 0x2b314e,
          roughness: 0.6,
          metalness: 0.1
        })
      );
      seat.position.y = 0.48;
      g.add(seat);
      const back = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.5, 0.06),
        new THREE.MeshStandardMaterial({
          color: 0x32395c,
          roughness: 0.6
        })
      );
      back.position.set(0, 0.78, -0.22);
      g.add(back);
      const legG = new THREE.CylinderGeometry(0.03, 0.03, 0.46, 12);
      const legM = new THREE.MeshStandardMaterial({
        color: 0x444444,
        roughness: 0.7
      });
      [
        [-0.2, 0.23, -0.2],
        [0.2, 0.23, -0.2],
        [-0.2, 0.23, 0.2],
        [0.2, 0.23, 0.2]
      ].forEach(([x, y, z]) => {
        const leg = new THREE.Mesh(legG, legM);
        leg.position.set(x, y, z);
        g.add(leg);
      });
      g.scale.setScalar(CHAIR_SCALE);
      return g;
    }

    const chairA = makeChair();
    const seatHalfDepth = 0.25 * CHAIR_SCALE;
    const chairDistance = TABLE_TOP_SIZE / 2 + seatHalfDepth + CHAIR_CLEARANCE;
    chairA.position.set(0, 0, -chairDistance);
    arena.add(chairA);
    const chairB = makeChair();
    chairB.position.set(0, 0, chairDistance);
    chairB.rotation.y = Math.PI;
    arena.add(chairB);

    function makeStudioCamera() {
      const cam = new THREE.Group();
      const legLen = 1.2;
      const legRad = 0.025;
      const legG = new THREE.CylinderGeometry(legRad, legRad, legLen, 10);
      const legM = new THREE.MeshStandardMaterial({
        color: 0x333333,
        roughness: 0.5,
        metalness: 0.3
      });
      const l1 = new THREE.Mesh(legG, legM);
      l1.position.set(-0.28, legLen / 2, 0);
      l1.rotation.z = THREE.MathUtils.degToRad(18);
      const l2 = l1.clone();
      l2.position.set(0.18, legLen / 2, 0.24);
      const l3 = l1.clone();
      l3.position.set(0.18, legLen / 2, -0.24);
      cam.add(l1, l2, l3);
      const head = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.1, 0.08, 16),
        new THREE.MeshStandardMaterial({
          color: 0x2e2e2e,
          roughness: 0.6,
          metalness: 0.2
        })
      );
      head.position.set(0, legLen + 0.04, 0);
      cam.add(head);
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.22, 0.22),
        new THREE.MeshStandardMaterial({
          color: 0x151515,
          roughness: 0.5,
          metalness: 0.4
        })
      );
      body.position.set(0, legLen + 0.2, 0);
      cam.add(body);
      const lens = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 0.22, 16),
        new THREE.MeshStandardMaterial({
          color: 0x202020,
          roughness: 0.4,
          metalness: 0.5
        })
      );
      lens.rotation.z = Math.PI / 2;
      lens.position.set(0.22, legLen + 0.2, 0);
      cam.add(lens);
      const handle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.01, 0.01, 0.3, 10),
        new THREE.MeshStandardMaterial({
          color: 0x444444,
          roughness: 0.6
        })
      );
      handle.rotation.z = THREE.MathUtils.degToRad(30);
      handle.position.set(-0.16, legLen + 0.16, -0.1);
      cam.add(handle);
      return cam;
    }

    const cameraRigOffsetX = TABLE_TOP_SIZE / 2 + 1.4;
    const cameraRigOffsetZ = TABLE_TOP_SIZE / 2 + 1.2;
    const studioCamA = makeStudioCamera();
    studioCamA.position.set(-cameraRigOffsetX, 0, -cameraRigOffsetZ);
    arena.add(studioCamA);
    const studioCamB = makeStudioCamera();
    studioCamB.position.set(cameraRigOffsetX, 0, cameraRigOffsetZ);
    arena.add(studioCamB);

    const tableSurfaceY = tableTopY + TABLE_TOP_THICKNESS / 2;
    const boardGroup = new THREE.Group();
    boardGroup.position.y = tableSurfaceY + 0.01;
    boardGroup.scale.setScalar(BOARD_SCALE);
    arena.add(boardGroup);
    const boardLookTarget = new THREE.Vector3(
      0,
      boardGroup.position.y + (BOARD.baseH + 0.12) * BOARD_SCALE,
      0
    );
    studioCamA.lookAt(boardLookTarget);
    studioCamB.lookAt(boardLookTarget);

    const spotlight = new THREE.SpotLight(0xffffff, 0.65, 30, Math.PI / 4, 0.45, 1.2);
    spotlight.position.set(0, boardLookTarget.y + 6, 0);
    const spotTarget = new THREE.Object3D();
    spotTarget.position.copy(boardLookTarget);
    arena.add(spotlight);
    arena.add(spotTarget);
    spotlight.target = spotTarget;

    // Camera orbit
    camera = new THREE.PerspectiveCamera(CAM.fov, 1, CAM.near, CAM.far);
    const initialRadius = Math.max(
      BOARD_DISPLAY_SIZE * CAMERA_INITIAL_RADIUS_FACTOR,
      CAM.minR + 0.6
    );
    sph = new THREE.Spherical(
      initialRadius,
      THREE.MathUtils.lerp(CAM.phiMin, CAM.phiMax, CAMERA_INITIAL_PHI_LERP),
      Math.PI * 0.25
    );
    const fit = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const boardSize = RAW_BOARD_SIZE * BOARD_SCALE;
      const needed =
        boardSize / (2 * Math.tan(THREE.MathUtils.degToRad(CAM.fov) / 2));
      sph.radius = clamp(Math.max(needed, sph.radius), CAM.minR, CAM.maxR);
      const offset = new THREE.Vector3().setFromSpherical(sph);
      camera.position.copy(boardLookTarget).add(offset);
      camera.lookAt(boardLookTarget);
    };
    fit();

    zoomRef.current = {
      zoomIn: () => {
        const r = sph.radius || initialRadius;
        sph.radius = clamp(r - 1.2, CAM.minR, CAM.maxR);
        fit();
      },
      zoomOut: () => {
        const r = sph.radius || initialRadius;
        sph.radius = clamp(r + 1.2, CAM.minR, CAM.maxR);
        fit();
      }
    };

    const createExplosion = (pos) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const v = pos.clone().project(camera);
      const x = rect.left + ((v.x + 1) / 2) * rect.width;
      const y = rect.top + ((-v.y + 1) / 2) * rect.height;
      const el = document.createElement('div');
      el.textContent = '💨';
      el.className = 'bomb-explosion';
      el.style.position = 'fixed';
      el.style.transform = 'translate(-50%, -50%) scale(1)';
      el.style.fontSize = '64px';
      el.style.pointerEvents = 'none';
      el.style.zIndex = '200';
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1000);
    };

    // Board base + rim
    const tile = BOARD.tile;
    const N = 8;
    const half = (N * tile) / 2;
    const base = box(
      N * tile + BOARD.rim * 2,
      BOARD.baseH,
      N * tile + BOARD.rim * 2,
      COLORS.woodDark
    );
    base.position.set(0, BOARD.baseH / 2, 0);
    boardGroup.add(base);
    const top = box(N * tile, 0.12, N * tile, COLORS.woodLight);
    top.position.set(0, BOARD.baseH + 0.06, 0);
    boardGroup.add(top);

    // Tiles
    const tiles = [];
    const tileGroup = new THREE.Group();
    boardGroup.add(tileGroup);
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const isDark = (r + c) % 2 === 1;
        const m = new THREE.MeshStandardMaterial({
          color: isDark ? COLORS.tileDark : COLORS.tileLight,
          metalness: 0.05,
          roughness: 0.85
        });
        const g = new THREE.BoxGeometry(tile, 0.1, tile);
        const mesh = new THREE.Mesh(g, m);
        mesh.position.set(
          c * tile - half + tile / 2,
          BOARD.baseH + 0.12,
          r * tile - half + tile / 2
        );
        mesh.userData = { r, c, type: 'tile' };
        tileGroup.add(mesh);
        tiles.push(mesh);
      }
    }

    // Coordinates (optional minimal markers)
    const coordMat = new THREE.MeshBasicMaterial({ color: COLORS.accent });
    for (let i = 0; i < N; i++) {
      const mSmall = new THREE.Mesh(
        new THREE.PlaneGeometry(0.08, 0.8),
        coordMat
      );
      mSmall.rotation.x = -Math.PI / 2;
      mSmall.position.set(
        i * tile - half + tile / 2,
        BOARD.baseH + 0.13,
        -half - 0.6
      );
      boardGroup.add(mSmall);
      const nSmall = new THREE.Mesh(
        new THREE.PlaneGeometry(0.8, 0.08),
        coordMat
      );
      nSmall.rotation.x = -Math.PI / 2;
      nSmall.position.set(
        -half - 0.6,
        BOARD.baseH + 0.13,
        i * tile - half + tile / 2
      );
      boardGroup.add(nSmall);
    }

    // Pieces — meshes + state
    let board = parseFEN(START_FEN);
    const pieceMeshes = Array.from({ length: 8 }, () => Array(8).fill(null));

    function placePieceMesh(r, c, p) {
      const color = p.w ? COLORS.whitePiece : COLORS.blackPiece;
      const b = BUILDERS[p.t](color);
      b.position.set(c * tile - half + tile / 2, 0, r * tile - half + tile / 2);
      b.userData = { r, c, w: p.w, t: p.t, type: 'piece' };
      boardGroup.add(b);
      pieceMeshes[r][c] = b;
    }

    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p) placePieceMesh(r, c, p);
      }

    // Raycaster for picking
    ray = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const setPointer = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const cx =
        e.clientX ??
        e.touches?.[0]?.clientX ??
        e.changedTouches?.[0]?.clientX ??
        0;
      const cy =
        e.clientY ??
        e.touches?.[0]?.clientY ??
        e.changedTouches?.[0]?.clientY ??
        0;
      pointer.x = ((cx - rect.left) / rect.width) * 2 - 1;
      pointer.y = -(((cy - rect.top) / rect.height) * 2 - 1);
    };

    // Selection
    let sel = null;
    let legal = [];

    function startTimer(isWhite) {
      clearInterval(timerRef.current);
      if (isWhite) {
        setWhiteTime(60);
        timerRef.current = setInterval(() => {
          setWhiteTime((t) => {
            if (t <= 1) {
              clearInterval(timerRef.current);
              setUi((s) => ({ ...s, status: 'White ran out of time', winner: 'Black' }));
              return 0;
            }
            return t - 1;
          });
        }, 1000);
      } else {
        setBlackTime(5);
        timerRef.current = setInterval(() => {
          setBlackTime((t) => {
            if (t <= 1) {
              clearInterval(timerRef.current);
              setUi((s) => ({ ...s, status: 'Black ran out of time', winner: 'White' }));
              return 0;
            }
            return t - 1;
          });
        }, 1000);
      }
    }

    function applyStatus(nextWhite, status, winner) {
      setUi((s) => ({ ...s, turnWhite: nextWhite, status, winner }));
      if (winner) {
        clearInterval(timerRef.current);
        return;
      }
      startTimer(nextWhite);
      if (!nextWhite) setTimeout(aiMove, 200);
    }

    function highlightMoves(list, color = COLORS.highlight) {
      list.forEach(([rr, cc]) => {
        const mesh = tiles.find(
          (t) => t.userData.r === rr && t.userData.c === cc
        );
        if (!mesh) return;
        const h = new THREE.Mesh(
          new THREE.CylinderGeometry(tile * 0.28, tile * 0.28, 0.06, 20),
          new THREE.MeshStandardMaterial({
            color,
            transparent: true,
            opacity: 0.55,
            metalness: 0.2
          })
        );
        h.position.copy(mesh.position).add(new THREE.Vector3(0, 0.06, 0));
        h.userData.__highlight = true;
        boardGroup.add(h);
      });
    }
    function clearHighlights() {
      const toKill = [];
      boardGroup.traverse((o) => {
        if (o.userData && o.userData.__highlight) toKill.push(o);
      });
      toKill.forEach((o) => boardGroup.remove(o));
    }

    function selectAt(r, c) {
      const p = board[r][c];
      if (!p) return ((sel = null), clearHighlights());
      if (p.w !== uiRef.current.turnWhite) return; // not your turn
      sel = { r, c, p };
      legal = legalMoves(board, r, c);
      clearHighlights();
      highlightMoves(legal);
    }

    function moveSelTo(rr, cc) {
      if (!sel) return;
      if (!legal.some(([r, c]) => r === rr && c === cc)) return;
      // capture mesh if any
      const targetMesh = pieceMeshes[rr][cc];
      if (targetMesh) {
        const worldPos = new THREE.Vector3();
        targetMesh.getWorldPosition(worldPos);
        const capturingWhite = board[sel.r][sel.c].w;
        const zone = capturingWhite ? capturedByWhite : capturedByBlack;
        const idx = zone.push(targetMesh) - 1;
        const row = Math.floor(idx / 8);
        const col = idx % 8;
        const capX = (col - 3.5) * (tile * 0.5);
        const capZ = capturingWhite
          ? half + BOARD.rim + 1 + row * (tile * 0.5)
          : -half - BOARD.rim - 1 - row * (tile * 0.5);
        targetMesh.position.set(capX, 0, capZ);
        targetMesh.scale.set(0.8, 0.8, 0.8);
        createExplosion(worldPos);
        if (bombSoundRef.current) {
          bombSoundRef.current.currentTime = 0;
          bombSoundRef.current.play().catch(() => {});
        }
        pieceMeshes[rr][cc] = null;
      }
      // move board
      board[rr][cc] = board[sel.r][sel.c];
      board[sel.r][sel.c] = null;
      // promotion (auto to Queen)
      if (board[rr][cc].t === 'P' && (rr === 0 || rr === 7)) {
        board[rr][cc].t = 'Q';
      }
      // move mesh
      const m = pieceMeshes[sel.r][sel.c];
      pieceMeshes[sel.r][sel.c] = null;
      pieceMeshes[rr][cc] = m;
      m.userData.r = rr;
      m.userData.c = cc;
      m.position.set(
        cc * tile - half + tile / 2,
        0,
        rr * tile - half + tile / 2
      );

      // turn switch & status
      const nextWhite = !uiRef.current.turnWhite;
      const king = findKing(board, nextWhite);
      const inCheck =
        king && isSquareAttacked(board, king[0], king[1], !nextWhite);
      const hasMove = anyLegal(board, nextWhite);
      let status = nextWhite ? 'White to move' : 'Black to move';
      let winner = null;
      if (!hasMove) {
        if (inCheck) {
          winner = nextWhite ? 'Black' : 'White';
          status = `Checkmate — ${winner} wins`;
        } else {
          status = 'Stalemate';
        }
      } else if (inCheck) {
        status = (nextWhite ? 'White' : 'Black') + ' in check';
      }

      applyStatus(nextWhite, status, winner);
      sel = null;
      clearHighlights();
    }

    function aiMove() {
      const mv = bestBlackMove(board, 3);
      if (!mv) return;
      sel = { r: mv.from[0], c: mv.from[1] };
      legal = legalMoves(board, mv.from[0], mv.from[1]);
      moveSelTo(mv.to[0], mv.to[1]);
    }

    function onClick(e) {
      setPointer(e);
      ray.setFromCamera(pointer, camera);
      const intersects = ray.intersectObjects(boardGroup.children, true);
      let obj = null;
      for (const i of intersects) {
        let o = i.object;
        while (o) {
          if (
            o.userData &&
            (o.userData.type === 'piece' || o.userData.type === 'tile')
          ) {
            obj = o;
            break;
          }
          o = o.parent;
        }
        if (obj) break;
      }
      if (!obj) return;
      const ud = obj.userData;
      if (ud.type === 'piece') selectAt(ud.r, ud.c);
      else if (ud.type === 'tile' && sel) {
        moveSelTo(ud.r, ud.c);
      }
    }

    renderer.domElement.addEventListener('click', onClick);
    renderer.domElement.addEventListener('touchend', onClick);

    // Orbit controls minimal
    const drag = { on: false, x: 0, y: 0 };
    const onDown = (e) => {
      drag.on = true;
      drag.x = e.clientX || e.touches?.[0]?.clientX || 0;
      drag.y = e.clientY || e.touches?.[0]?.clientY || 0;
    };
    const onMove = (e) => {
      if (!drag.on) return;
      const x = e.clientX || e.touches?.[0]?.clientX || drag.x;
      const y = e.clientY || e.touches?.[0]?.clientY || drag.y;
      const dx = x - drag.x,
        dy = y - drag.y;
      drag.x = x;
      drag.y = y;
      sph.theta -= dx * 0.004;
      const phiDelta = -dy * CAMERA_VERTICAL_SENSITIVITY;
      sph.phi = clamp(sph.phi + phiDelta, CAM.phiMin, CAM.phiMax);
      const leanDelta = dy * CAMERA_LEAN_STRENGTH;
      sph.radius = clamp(sph.radius - leanDelta, CAM.minR, CAM.maxR);
      fit();
    };
    const onUp = () => {
      drag.on = false;
    };
    const onWheel = (e) => {
      const r = sph.radius || 88;
      sph.radius = clamp(r + e.deltaY * 0.2, CAM.minR, CAM.maxR);
      fit();
    };
    renderer.domElement.addEventListener('mousedown', onDown);
    renderer.domElement.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    renderer.domElement.addEventListener('touchstart', onDown, {
      passive: true
    });
    renderer.domElement.addEventListener('touchmove', onMove, {
      passive: true
    });
    window.addEventListener('touchend', onUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: true });

    // Loop
    const step = () => {
      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(step);
    };
    step();

    // Resize
    const onResize = () => {
      fit();
    };
    window.addEventListener('resize', onResize);

    // Start timer for the human player
    startTimer(true);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
      clearInterval(timerRef.current);
      try {
        host.removeChild(renderer.domElement);
      } catch {}
      renderer.domElement.removeEventListener('click', onClick);
      renderer.domElement.removeEventListener('touchend', onClick);
      bombSoundRef.current?.pause();
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className="w-screen h-dvh bg-black text-white overflow-hidden select-none relative"
    >
      {(avatar || username) && (
        <div className="absolute top-2 right-2 flex items-center space-x-2 z-10 pointer-events-none">
          {avatar && (
            <img
              src={avatar}
              alt="avatar"
              className="w-8 h-8 rounded-full border border-white/20"
            />
          )}
          {username && (
            <span className="text-sm font-semibold">{username}</span>
          )}
        </div>
      )}
      {/* player turn indicators */}
      <div className="absolute top-2 left-0 right-0 flex justify-center z-10 pointer-events-none">
        <div
          className={`px-3 py-1 text-sm rounded ${ui.turnWhite ? 'opacity-60' : 'bg-white/20'}`}
        >
          Black {formatTime(blackTime)}
        </div>
      </div>
      <div className="absolute bottom-2 left-0 right-0 flex justify-center z-10 pointer-events-none">
        <div
          className={`px-3 py-1 text-sm rounded ${ui.turnWhite ? 'bg-white/20' : 'opacity-60'}`}
        >
          White {formatTime(whiteTime)}
        </div>
      </div>

      <div className="absolute left-3 top-3 text-xs bg-white/10 rounded px-2 py-1 z-10 pointer-events-none">
        <div className="font-semibold">{ui.status}</div>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="absolute left-3 bottom-3 text-xs bg-white/10 hover:bg-white/20 rounded px-3 py-1 z-10"
      >
        Reset
      </button>
      <div className="absolute right-3 bottom-3 flex flex-col space-y-2 z-10">
        <button
          onClick={() => zoomRef.current.zoomIn && zoomRef.current.zoomIn()}
          className="text-xl bg-white/10 hover:bg-white/20 rounded px-2 py-1"
        >
          +
        </button>
        <button
          onClick={() => zoomRef.current.zoomOut && zoomRef.current.zoomOut()}
          className="text-xl bg-white/10 hover:bg-white/20 rounded px-2 py-1"
        >
          -
        </button>
      </div>
    </div>
  );
}

export default function ChessBattleRoyal() {
  useTelegramBackButton();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const avatar = params.get('avatar') || getTelegramPhotoUrl();
  let username =
    params.get('username') ||
    params.get('name') ||
    getTelegramFirstName() ||
    getTelegramUsername();
  return <Chess3D avatar={avatar} username={username} />;
}
