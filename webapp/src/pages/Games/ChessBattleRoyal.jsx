import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import * as THREE from 'three';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import {
  getTelegramFirstName,
  getTelegramUsername,
  getTelegramPhotoUrl
} from '../../utils/telegram.js';
import { FLAG_EMOJIS } from '../../utils/flagEmojis.js';
import { avatarToName } from '../../utils/avatarUtils.js';
import { getAIOpponentFlag } from '../../utils/aiOpponentFlag.js';
import { bombSound } from '../../assets/soundData.js';

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
const CAM = {
  fov: 52,
  near: 0.1,
  far: 5000,
  // allow a bit wider zoom range
  minR: 30,
  maxR: 150,
  phiMin: 0.9,
  phiMax: 1.35
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const COLORS = Object.freeze({
  woodDark: 0x3a2d23,
  woodLight: 0xd2b48c,
  tileLight: 0xe7e2d3,
  tileDark: 0x776a5a,
  accent: 0x00e5ff,
  whitePiece: 0xf5f5f7,
  blackPiece: 0x1c1f26,
  highlight: 0x6ee7b7,
  danger: 0xf87171,
  bg: 0x0b0d11
});

// slightly larger board tiles for a roomier layout
const BOARD = { N: 8, tile: 4.5, rim: 2.2, baseH: 0.8 };
const PIECE_Y = 1.2; // baseline height for meshes

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

// ---------- AI evaluation and search ----------
const PIECE_VALUES = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000 };

function evaluateBoard(board) {
  let score = 0;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p) score += PIECE_VALUES[p.t] * (p.w ? 1 : -1);
    }
  return score;
}

function generateMoves(board, whiteTurn) {
  const moves = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.w === whiteTurn) {
        const ls = legalMoves(board, r, c);
        for (const [rr, cc] of ls) moves.push({ from: [r, c], to: [rr, cc] });
      }
    }
  return moves;
}

function applyMove(board, move) {
  const b = cloneBoard(board);
  const [r, c] = move.from;
  const [rr, cc] = move.to;
  b[rr][cc] = b[r][c];
  b[r][c] = null;
  if (b[rr][cc].t === 'P' && (rr === 0 || rr === 7)) b[rr][cc].t = 'Q';
  return b;
}

function minimax(board, depth, alpha, beta, maximizing) {
  if (depth === 0) return { score: evaluateBoard(board) };
  const moves = generateMoves(board, maximizing);
  if (moves.length === 0) {
    const king = findKing(board, maximizing);
    const inCheck = king && isSquareAttacked(board, king[0], king[1], !maximizing);
    const score = inCheck ? (maximizing ? -99999 : 99999) : 0;
    return { score };
  }
  let bestMove = null;
  if (maximizing) {
    let maxEval = -Infinity;
    for (const mv of moves) {
      const evalScore = minimax(applyMove(board, mv), depth - 1, alpha, beta, !maximizing).score;
      if (evalScore > maxEval) {
        maxEval = evalScore;
        bestMove = mv;
      }
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) break;
    }
    return { score: maxEval, move: bestMove };
  } else {
    let minEval = Infinity;
    for (const mv of moves) {
      const evalScore = minimax(applyMove(board, mv), depth - 1, alpha, beta, !maximizing).score;
      if (evalScore < minEval) {
        minEval = evalScore;
        bestMove = mv;
      }
      beta = Math.min(beta, evalScore);
      if (beta <= alpha) break;
    }
    return { score: minEval, move: bestMove };
  }
}

function bestAIMove(board, whiteTurn) {
  return minimax(board, 3, -Infinity, Infinity, whiteTurn).move;
}

// ======================= Main Component =======================
function Chess3D({ avatar, username }) {
  const wrapRef = useRef(null);
  const rafRef = useRef(0);

  const [ui, setUi] = useState({
    turnWhite: true,
    status: 'White to move',
    promoting: null,
    winner: null
  });
  const uiRef = useRef(ui);
  const autoMoveRef = useRef(null);
  const [timeLeft, setTimeLeft] = useState(60);
  const [aiFlag] = useState(() => {
    const playerFlag = FLAG_EMOJIS.includes(avatar) ? avatar : null;
    return playerFlag
      ? getAIOpponentFlag(playerFlag)
      : FLAG_EMOJIS[Math.floor(Math.random() * FLAG_EMOJIS.length)];
  });
  const aiName = avatarToName(aiFlag);
  const bombSoundRef = useRef(null);
  const capturedWhite = useRef([]);
  const capturedBlack = useRef([]);
  const topViewRef = useRef(false);
  const [topView, setTopView] = useState(false);
  const last3DRef = useRef({
    phi: (CAM.phiMin + CAM.phiMax) / 2,
    theta: Math.PI * 0.25
  });
  const cameraRef = useRef(null);
  const sphRef = useRef(null);
  const fitRef = useRef(() => {});

  useEffect(() => {
    uiRef.current = ui;
  }, [ui]);

  useEffect(() => {
    bombSoundRef.current = new Audio(bombSound);
    bombSoundRef.current.volume = 0.3;
  }, []);

  useEffect(() => {
    if (ui.winner) return;
    const duration = ui.turnWhite ? 60 : 5;
    setTimeLeft(duration);
    const interval = setInterval(() => {
      setTimeLeft((t) => (t > 0 ? t - 1 : 0));
    }, 1000);
    const timeout = setTimeout(() => {
      autoMoveRef.current && autoMoveRef.current(ui.turnWhite);
    }, duration * 1000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [ui.turnWhite, ui.winner]);

  useEffect(() => {
    const host = wrapRef.current;
    if (!host) return;
    let scene, camera, renderer, ray, sph;
    let last = performance.now();
    const explosions = [];

    function spawnExplosion(pos, piece) {
      const burst = new THREE.Mesh(
        new THREE.SphereGeometry(2.5, 16, 16),
        new THREE.MeshStandardMaterial({
          color: 0xffaa00,
          transparent: true,
          opacity: 0.8
        })
      );
      burst.position.copy(pos);
      burst.userData.start = performance.now();
      scene.add(burst);

      const smoke = new THREE.Mesh(
        new THREE.SphereGeometry(2.5, 12, 12),
        new THREE.MeshStandardMaterial({
          color: 0x555555,
          transparent: true,
          opacity: 0.6
        })
      );
      smoke.position.copy(pos);
      smoke.scale.set(0.6, 1.2, 0.6);
      smoke.userData.start = performance.now();
      smoke.userData.smoke = true;
      scene.add(smoke);

      explosions.push(burst, smoke);

      if (piece) {
        piece.visible = false;
        const color = piece.userData.w ? COLORS.whitePiece : COLORS.blackPiece;
        for (let i = 0; i < 12; i++) {
          const frag = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 0.3, 0.3),
            mat(color)
          );
          frag.position.copy(pos);
          frag.userData.start = performance.now();
          frag.userData.vel = new THREE.Vector3(
            (Math.random() - 0.5) * 4,
            Math.random() * 4,
            (Math.random() - 0.5) * 4
          );
          frag.userData.fragment = true;
          scene.add(frag);
          explosions.push(frag);
        }
      }

      const vec = pos.clone().project(camera);
      const rect = renderer.domElement.getBoundingClientRect();
      const x = rect.left + (vec.x * 0.5 + 0.5) * rect.width;
      const y = rect.top + (-vec.y * 0.5 + 0.5) * rect.height;
      const el = document.createElement('div');
      el.textContent = '💨';
      el.className = 'bomb-explosion';
      el.style.position = 'absolute';
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.style.fontSize = '48px';
      el.style.pointerEvents = 'none';
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1000);
    }

    function explodeCaptured(mesh, isWhite) {
      const pos = mesh.position.clone();
      spawnExplosion(pos, mesh);
      const arr = isWhite ? capturedBlack.current : capturedWhite.current;
      setTimeout(() => {
        const x = (arr.length - 3.5) * (tile * 0.8);
        const z = isWhite ? half + tile : -half - tile;
        mesh.position.set(x, 0, z);
        mesh.userData.captured = true;
        mesh.visible = true;
        arr.push(mesh);
      }, 600);
    }

    // ----- Build scene -----
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
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
    scene.background = new THREE.Color(COLORS.bg);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x1a1f2b, 0.95));
    const key = new THREE.DirectionalLight(0xffffff, 1.0);
    key.position.set(-60, 120, 50);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x88ccff, 0.35);
    rim.position.set(80, 60, -40);
    scene.add(rim);
    const spotGroup = new THREE.Group();
    [-10, 0, 10].forEach((x) => {
      const spot = new THREE.SpotLight(0xffffff, 1.5, 200, Math.PI / 8, 0.4, 1);
      spot.position.set(x, 120, 40);
      spot.target.position.set(0, 0, 0);
      scene.add(spot.target);
      spotGroup.add(spot);
    });
    scene.add(spotGroup);

    // Camera orbit
    camera = new THREE.PerspectiveCamera(CAM.fov, 1, CAM.near, CAM.far);
    sph = new THREE.Spherical(
      88,
      (CAM.phiMin + CAM.phiMax) / 2,
      Math.PI * 0.25
    );
    const fit = (margin = 1) => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const boardSize = BOARD.N * BOARD.tile + BOARD.rim * 2;
      const needed =
        (boardSize * margin) /
        (2 * Math.tan(THREE.MathUtils.degToRad(CAM.fov) / 2));
      sph.radius = Math.max(needed, clamp(sph.radius, CAM.minR, CAM.maxR));
      camera.position.setFromSpherical(sph);
      // keep the chess board centered on all screens
      camera.lookAt(0, 0, 0);
    };
    fit();
    cameraRef.current = camera;
    sphRef.current = sph;
    fitRef.current = fit;

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
    base.position.set(0, BOARD.baseH / 2 - 0.01, 0);
    scene.add(base);
    const top = box(N * tile, 0.12, N * tile, COLORS.woodLight);
    top.position.set(0, BOARD.baseH + 0.06, 0);
    scene.add(top);

    // Tiles
    const tiles = [];
    const tileGroup = new THREE.Group();
    scene.add(tileGroup);
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
      scene.add(mSmall);
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
      scene.add(nSmall);
    }

    // Pieces — meshes + state
    let board = parseFEN(START_FEN);
    const pieceMeshes = Array.from({ length: 8 }, () => Array(8).fill(null));

    function placePieceMesh(r, c, p) {
      const color = p.w ? COLORS.whitePiece : COLORS.blackPiece;
      const b = BUILDERS[p.t](color);
      b.position.set(c * tile - half + tile / 2, 0, r * tile - half + tile / 2);
      b.userData = { r, c, w: p.w, t: p.t, type: 'piece' };
      scene.add(b);
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
        scene.add(h);
      });
    }
    function clearHighlights() {
      const toKill = [];
      scene.traverse((o) => {
        if (o.userData && o.userData.__highlight) toKill.push(o);
      });
      toKill.forEach((o) => scene.remove(o));
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
        const isWhite = board[sel.r][sel.c].w;
        if (bombSoundRef.current) {
          bombSoundRef.current.currentTime = 0;
          bombSoundRef.current.play().catch(() => {});
        }
        explodeCaptured(targetMesh, isWhite);
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

      setUi((s) => ({ ...s, turnWhite: nextWhite, status, winner }));
      sel = null;
      clearHighlights();
    }

    autoMoveRef.current = (whiteTurn) => {
      const color =
        typeof whiteTurn === 'boolean' ? whiteTurn : uiRef.current.turnWhite;
      const mv = bestAIMove(board, color);
      if (mv) {
        selectAt(mv.from[0], mv.from[1]);
        moveSelTo(mv.to[0], mv.to[1]);
      }
    };

    function onClick(e) {
      setPointer(e);
      ray.setFromCamera(pointer, camera);
      const intersects = ray.intersectObjects(scene.children, true);
      let obj = null;
      for (const i of intersects) {
        let o = i.object;
        while (o) {
          if (
            o.userData &&
            !o.userData.captured &&
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
      if (ud.type === 'piece') {
        if (sel && legal.some(([r, c]) => r === ud.r && c === ud.c)) {
          moveSelTo(ud.r, ud.c);
        } else {
          selectAt(ud.r, ud.c);
        }
      } else if (ud.type === 'tile' && sel) {
        moveSelTo(ud.r, ud.c);
      }
    }

    renderer.domElement.addEventListener('click', onClick);
    renderer.domElement.addEventListener('touchend', onClick);

    // Orbit controls minimal
    const drag = { on: false, x: 0, y: 0 };
    const pinch = { active: false, dist: 0 };
    const onDown = (e) => {
      if (e.touches?.length === 2) {
        const [t1, t2] = e.touches;
        pinch.active = true;
        pinch.dist = Math.hypot(
          t1.clientX - t2.clientX,
          t1.clientY - t2.clientY
        );
        return;
      }
      if (topViewRef.current) return;
      drag.on = true;
      drag.x = e.clientX || e.touches?.[0]?.clientX || 0;
      drag.y = e.clientY || e.touches?.[0]?.clientY || 0;
    };
    const onMove = (e) => {
      if (pinch.active && e.touches?.length === 2) {
        const [t1, t2] = e.touches;
        const d = Math.hypot(
          t1.clientX - t2.clientX,
          t1.clientY - t2.clientY
        );
        const delta = pinch.dist - d;
        sph.radius = clamp(
          sph.radius + delta * 0.5,
          CAM.minR,
          CAM.maxR
        );
        pinch.dist = d;
        fit(topViewRef.current ? 1.05 : 1.0);
        return;
      }
      if (topViewRef.current || !drag.on) return;
      const x = e.clientX || e.touches?.[0]?.clientX || drag.x;
      const y = e.clientY || e.touches?.[0]?.clientY || drag.y;
      const dx = x - drag.x,
        dy = y - drag.y;
      drag.x = x;
      drag.y = y;
      sph.theta -= dx * 0.004;
      sph.phi = clamp(sph.phi + dy * 0.003, CAM.phiMin, CAM.phiMax);
      fit(topViewRef.current ? 1.05 : 1.0);
    };
    const onUp = () => {
      drag.on = false;
      pinch.active = false;
    };
    const onWheel = (e) => {
      const r = sph.radius || 88;
      sph.radius = clamp(r + e.deltaY * 0.2, CAM.minR, CAM.maxR);
      fit(topViewRef.current ? 1.05 : 1.0);
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
      const now = performance.now();
      const dt = now - last;
      last = now;
      for (let i = explosions.length - 1; i >= 0; i--) {
        const ex = explosions[i];
        const t = (now - ex.userData.start) / 600;
        if (ex.userData.fragment) {
          ex.position.addScaledVector(ex.userData.vel, dt * 0.002);
          ex.material.opacity = Math.max(0, 1 - t);
        } else if (ex.userData.smoke) {
          ex.scale.setScalar(1 + t * 3);
          ex.material.opacity = Math.max(0, 0.6 - t);
        } else {
          ex.scale.setScalar(1 + t * 5);
          ex.material.opacity = Math.max(0, 0.8 - t * 1.2);
        }
        if (ex.material.opacity <= 0) {
          scene.remove(ex);
          explosions.splice(i, 1);
        }
      }
      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(step);
    };
    step();

    // Resize
    const onResize = () => {
      fit(topViewRef.current ? 1.05 : 1.0);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
      try {
        host.removeChild(renderer.domElement);
      } catch {}
      renderer.domElement.removeEventListener('click', onClick);
      renderer.domElement.removeEventListener('touchend', onClick);
    };
  }, []);

  const toggleView = () => {
    const cam = cameraRef.current;
    const sph = sphRef.current;
    const fit = fitRef.current;
    if (!cam || !sph || !fit) return;
    const next = !topViewRef.current;
    const start = { radius: sph.radius, phi: sph.phi, theta: sph.theta };
    if (next) last3DRef.current = { phi: sph.phi, theta: sph.theta };
    const boardSize = BOARD.N * BOARD.tile + BOARD.rim * 2;
    const margin = next ? 1.05 : 1.0;
    const needed =
      (boardSize * margin) /
      (2 * Math.tan(THREE.MathUtils.degToRad(CAM.fov) / 2));
    const target = {
      radius: clamp(needed, CAM.minR, CAM.maxR),
      phi: next ? 0.0001 : last3DRef.current.phi,
      theta: next ? sph.theta : last3DRef.current.theta
    };
    const duration = 600;
    const t0 = performance.now();
    function anim(t) {
      const k = Math.min(1, (t - t0) / duration);
      const ease = k * (2 - k);
      sph.radius = start.radius + (target.radius - start.radius) * ease;
      sph.phi = start.phi + (target.phi - start.phi) * ease;
      sph.theta = start.theta + (target.theta - start.theta) * ease;
      cam.position.setFromSpherical(sph);
      cam.lookAt(0, 0, 0);
      if (k < 1) requestAnimationFrame(anim);
      else {
        topViewRef.current = next;
        setTopView(next);
        fit(margin);
      }
    }
    requestAnimationFrame(anim);
  };

  return (
    <div
      ref={wrapRef}
      className="w-screen h-dvh bg-black text-white overflow-hidden select-none relative"
    >
      {aiFlag && (
        <div className="absolute top-2 left-2 flex items-center space-x-2 z-10 pointer-events-none">
          <span className="text-2xl">{aiFlag}</span>
          {aiName && <span className="text-sm font-semibold">{aiName}</span>}
        </div>
      )}
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
          Black{!ui.turnWhite && ` - ${timeLeft}s`}
        </div>
      </div>
      <div className="absolute bottom-2 left-0 right-0 flex justify-center z-10 pointer-events-none">
        <div
          className={`px-3 py-1 text-sm rounded ${ui.turnWhite ? 'bg-white/20' : 'opacity-60'}`}
        >
          White{ui.turnWhite && ` - ${timeLeft}s`}
        </div>
      </div>

      <div className="absolute left-3 top-3 text-xs bg-white/10 rounded px-2 py-1 z-10 pointer-events-none">
        <div className="font-semibold">Chess 3D — {ui.status}</div>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="absolute left-3 bottom-3 text-xs bg-white/10 hover:bg-white/20 rounded px-3 py-1 z-10"
      >
        Reset
      </button>
      <button
        onClick={toggleView}
        className="absolute bottom-3 right-3 w-12 h-12 rounded-full bg-white text-black text-sm font-bold flex items-center justify-center z-10"
      >
        {topView ? '3D' : '2D'}
      </button>
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
