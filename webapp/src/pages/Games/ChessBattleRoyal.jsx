import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import * as THREE from 'three';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import {
  getTelegramFirstName,
  getTelegramUsername,
  getTelegramPhotoUrl
} from '../../utils/telegram.js';

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
  minR: 38,
  maxR: 120,
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
  // Slightly brighter black pieces for better visibility
  blackPiece: 0x2b2f33,
  highlight: 0x6ee7b7,
  danger: 0xf87171,
  bg: 0x0b0d11
});

const BOARD = { N: 8, tile: 4.0, rim: 2.2, baseH: 0.8 };
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

    // Camera orbit
    camera = new THREE.PerspectiveCamera(CAM.fov, 1, CAM.near, CAM.far);
    sph = new THREE.Spherical(
      88,
      (CAM.phiMin + CAM.phiMax) / 2,
      Math.PI * 0.25
    );
    const fit = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const boardSize = BOARD.N * BOARD.tile + BOARD.rim * 2;
      const needed =
        boardSize / (2 * Math.tan(THREE.MathUtils.degToRad(CAM.fov) / 2));
      sph.radius = Math.max(needed, sph.radius);
      camera.position.setFromSpherical(sph);
      // keep the chess board centered on all screens
      camera.lookAt(0, 0, 0);
    };
    fit();

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
        scene.remove(targetMesh);
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
      const intersects = ray.intersectObjects(scene.children, true);
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
      sph.phi = clamp(sph.phi + dy * 0.003, CAM.phiMin, CAM.phiMax);
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
