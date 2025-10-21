import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  createArenaCarpetMaterial,
  createArenaWallMaterial
} from '../../utils/arenaDecor.js';
import { applyRendererSRGB } from '../../utils/colorSpace.js';
import {
  createMurlanStyleTable,
  applyTableMaterials,
  TABLE_SHAPE_OPTIONS
} from '../../utils/murlanTable.js';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import {
  getTelegramFirstName,
  getTelegramUsername,
  getTelegramPhotoUrl
} from '../../utils/telegram.js';
import { bombSound } from '../../assets/soundData.js';
import { getGameVolume } from '../../utils/sound.js';
import { ARENA_CAMERA_DEFAULTS, buildArenaCameraConfig } from '../../utils/arenaCameraConfig.js';
import {
  TABLE_WOOD_OPTIONS,
  TABLE_CLOTH_OPTIONS,
  TABLE_BASE_OPTIONS,
  DEFAULT_TABLE_CUSTOMIZATION,
  WOOD_PRESETS_BY_ID,
  WOOD_GRAIN_OPTIONS,
  WOOD_GRAIN_OPTIONS_BY_ID
} from '../../utils/tableCustomizationOptions.js';
import { hslToHexNumber, WOOD_FINISH_PRESETS } from '../../utils/woodMaterials.js';

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

const DEFAULT_PLAYER_COUNT = 2;

const CHAIR_COLOR_OPTIONS = Object.freeze([
  {
    id: 'midnightNavy',
    label: 'Blu Mesnate',
    primary: '#1a2745',
    accent: '#111a30',
    highlight: '#3b4c82',
    legColor: '#0b0d14'
  },
  {
    id: 'emeraldVelvet',
    label: 'Kadife Smerald',
    primary: '#0f6a2f',
    accent: '#08401c',
    highlight: '#48b26a',
    legColor: '#132416'
  },
  {
    id: 'crimsonLuxe',
    label: 'Luksi Kaltër',
    primary: '#7a132c',
    accent: '#4a0b1c',
    highlight: '#d35a7a',
    legColor: '#1c090d'
  },
  {
    id: 'onyxShadow',
    label: 'Hije Oniks',
    primary: '#1f1f1f',
    accent: '#101010',
    highlight: '#6f6f6f',
    legColor: '#050505'
  }
]);

const APPEARANCE_STORAGE_KEY = 'chessBattleRoyalArenaAppearance';
const DEFAULT_APPEARANCE = {
  ...DEFAULT_TABLE_CUSTOMIZATION,
  chairColor: 0,
  tableShape: 0
};

const CUSTOMIZATION_SECTIONS = [
  { key: 'tableWood', label: 'Dru i Tavolinës', options: TABLE_WOOD_OPTIONS },
  { key: 'tableCloth', label: 'Rroba e Tavolinës', options: TABLE_CLOTH_OPTIONS },
  { key: 'chairColor', label: 'Ngjyra e Karrigeve', options: CHAIR_COLOR_OPTIONS },
  { key: 'tableBase', label: 'Baza e Tavolinës', options: TABLE_BASE_OPTIONS },
  { key: 'tableShape', label: 'Forma e Tavolinës', options: TABLE_SHAPE_OPTIONS }
];

const DIAMOND_SHAPE_ID = 'diamondEdge';
const NON_DIAMOND_SHAPE_INDEX = (() => {
  const index = TABLE_SHAPE_OPTIONS.findIndex((option) => option.id !== DIAMOND_SHAPE_ID);
  return index >= 0 ? index : 0;
})();

function normalizeAppearance(value = {}) {
  const normalized = { ...DEFAULT_APPEARANCE };
  const entries = [
    ['tableWood', TABLE_WOOD_OPTIONS.length],
    ['tableCloth', TABLE_CLOTH_OPTIONS.length],
    ['tableBase', TABLE_BASE_OPTIONS.length],
    ['chairColor', CHAIR_COLOR_OPTIONS.length],
    ['tableShape', TABLE_SHAPE_OPTIONS.length]
  ];
  entries.forEach(([key, max]) => {
    const raw = Number(value?.[key]);
    if (Number.isFinite(raw)) {
      const clamped = Math.min(Math.max(0, Math.round(raw)), Math.max(0, max - 1));
      normalized[key] = clamped;
    }
  });
  return normalized;
}

function getEffectiveShapeConfig(shapeIndex, playerCount) {
  const fallback = TABLE_SHAPE_OPTIONS[NON_DIAMOND_SHAPE_INDEX] ?? TABLE_SHAPE_OPTIONS[0];
  const requested = TABLE_SHAPE_OPTIONS[shapeIndex] ?? fallback;
  if (requested?.id === DIAMOND_SHAPE_ID && playerCount > 4) {
    return { option: fallback, rotationY: 0, forced: true };
  }
  const rotationY = requested?.id === DIAMOND_SHAPE_ID && playerCount <= 4 ? Math.PI / 4 : 0;
  return { option: requested ?? fallback, rotationY, forced: false };
}

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

const TABLE_RADIUS = 3.315; // 30% wider footprint to better fill the arena
const TABLE_HEIGHT = 2.05; // Raised so the surface aligns with the oversized chairs

const WALL_PROXIMITY_FACTOR = 0.5; // Bring arena walls 50% closer
const WALL_HEIGHT_MULTIPLIER = 2; // Double wall height
const CHAIR_SCALE = 4; // Chairs are 4x larger
const CHAIR_CLEARANCE = 0.52;
const CAMERA_DOLLY_FACTOR = ARENA_CAMERA_DEFAULTS.wheelDeltaFactor;

function createChessChair(option) {
  const primary = new THREE.Color(option?.primary ?? '#2b314e');
  const accent = new THREE.Color(option?.accent ?? '#1f2438');
  const highlight = new THREE.Color(option?.highlight ?? '#4d74d8');
  const legColor = new THREE.Color(option?.legColor ?? '#0f121a');

  const group = new THREE.Group();

  const seat = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.06, 0.5),
    new THREE.MeshStandardMaterial({ color: primary, roughness: 0.6, metalness: 0.1 })
  );
  seat.position.y = 0.48;
  seat.castShadow = true;
  seat.receiveShadow = true;
  group.add(seat);

  const cushion = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.02, 0.46),
    new THREE.MeshStandardMaterial({ color: highlight, roughness: 0.55, metalness: 0.18 })
  );
  cushion.position.y = 0.52;
  cushion.castShadow = true;
  cushion.receiveShadow = true;
  group.add(cushion);

  const back = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.5, 0.06),
    new THREE.MeshStandardMaterial({ color: accent, roughness: 0.6, metalness: 0.08 })
  );
  back.position.set(0, 0.78, -0.22);
  back.castShadow = true;
  back.receiveShadow = true;
  group.add(back);

  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.5, 0.015),
    new THREE.MeshStandardMaterial({ color: highlight, roughness: 0.5, metalness: 0.2 })
  );
  trim.position.set(0, 0.78, -0.24);
  trim.castShadow = true;
  trim.receiveShadow = true;
  group.add(trim);

  const legGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.46, 12);
  const legMaterial = new THREE.MeshStandardMaterial({ color: legColor, roughness: 0.7 });
  [
    [-0.2, 0.23, -0.2],
    [0.2, 0.23, -0.2],
    [-0.2, 0.23, 0.2],
    [0.2, 0.23, 0.2]
  ].forEach(([x, y, z]) => {
    const leg = new THREE.Mesh(legGeometry, legMaterial);
    leg.position.set(x, y, z);
    leg.castShadow = true;
    leg.receiveShadow = true;
    group.add(leg);
  });

  group.scale.setScalar(CHAIR_SCALE);
  return group;
}

function disposeChairGroup(group) {
  if (!group) return;
  const materials = new Set();
  group.traverse((obj) => {
    if (obj.isMesh) {
      if (Array.isArray(obj.material)) {
        obj.material.forEach((mat) => mat && materials.add(mat));
      } else if (obj.material) {
        materials.add(obj.material);
      }
      obj.geometry?.dispose?.();
    }
  });
  materials.forEach((mat) => mat?.dispose?.());
}

function buildChairSet(option, tableRadius) {
  const chairA = createChessChair(option);
  const chairB = createChessChair(option);
  const seatHalfDepth = 0.25 * CHAIR_SCALE;
  const distance = (tableRadius ?? TABLE_RADIUS) + seatHalfDepth + CHAIR_CLEARANCE;
  chairA.position.set(0, 0, -distance);
  chairB.position.set(0, 0, distance);
  chairB.rotation.y = Math.PI;
  return { chairs: [chairA, chairB], radius: distance };
}

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

const CAM_RANGE = buildArenaCameraConfig(BOARD_DISPLAY_SIZE);
const CAM = {
  fov: CAM_RANGE.fov,
  near: CAM_RANGE.near,
  far: CAM_RANGE.far,
  minR: CAM_RANGE.minRadius,
  maxR: CAM_RANGE.maxRadius,
  phiMin: ARENA_CAMERA_DEFAULTS.phiMin,
  phiMax: ARENA_CAMERA_DEFAULTS.phiMax
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
  const fitRef = useRef(() => {});
  const arenaRef = useRef(null);
  const clearHighlightsRef = useRef(() => {});
  const settingsRef = useRef({ showHighlights: true });
  const [whiteTime, setWhiteTime] = useState(60);
  const [blackTime, setBlackTime] = useState(5);
  const [configOpen, setConfigOpen] = useState(false);
  const [showHighlights, setShowHighlights] = useState(true);
  const [appearance, setAppearance] = useState(() => {
    if (typeof window === 'undefined') return { ...DEFAULT_APPEARANCE };
    try {
      const stored = window.localStorage?.getItem(APPEARANCE_STORAGE_KEY);
      if (!stored) return { ...DEFAULT_APPEARANCE };
      const parsed = JSON.parse(stored);
      return normalizeAppearance(parsed);
    } catch (error) {
      console.warn('Failed to load chess table appearance', error);
      return { ...DEFAULT_APPEARANCE };
    }
  });
  const appearanceRef = useRef(appearance);

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
    settingsRef.current.showHighlights = showHighlights;
    if (!showHighlights && typeof clearHighlightsRef.current === 'function') {
      clearHighlightsRef.current();
    }
  }, [showHighlights]);

  useEffect(() => {
    appearanceRef.current = appearance;
  }, [appearance]);

  const renderPreview = useCallback((type, option) => {
    switch (type) {
      case 'tableWood': {
        const preset = option?.presetId ? WOOD_PRESETS_BY_ID[option.presetId] : undefined;
        const grain = option?.grainId ? WOOD_GRAIN_OPTIONS_BY_ID[option.grainId] : undefined;
        const presetRef = preset || WOOD_FINISH_PRESETS?.[0];
        const baseHex = presetRef
          ? `#${hslToHexNumber(presetRef.hue, presetRef.sat, presetRef.light)
              .toString(16)
              .padStart(6, '0')}`
          : '#8b5a2b';
        const accentHex = presetRef
          ? `#${hslToHexNumber(
              presetRef.hue,
              Math.min(1, presetRef.sat + 0.12),
              Math.max(0, presetRef.light - 0.18)
            )
              .toString(16)
              .padStart(6, '0')}`
          : '#5a3820';
        const grainLabel = grain?.label ?? WOOD_GRAIN_OPTIONS?.[0]?.label ?? '';
        return (
          <div className="relative h-14 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950/40">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `repeating-linear-gradient(135deg, ${baseHex}, ${baseHex} 12%, ${accentHex} 12%, ${accentHex} 20%)`
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/40" />
            <div className="absolute bottom-1 right-1 rounded-full bg-black/60 px-2 py-0.5 text-[0.55rem] font-semibold uppercase tracking-wide text-emerald-100/80">
              {grainLabel.slice(0, 12)}
            </div>
          </div>
        );
      }
      case 'tableCloth':
        return (
          <div className="relative h-14 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950/40">
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="h-12 w-20 rounded-[999px] border border-white/10"
                style={{ background: `radial-gradient(circle at 35% 30%, ${option.feltTop}, ${option.feltBottom})` }}
              />
            </div>
            <div className="absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-black/50 to-transparent" />
          </div>
        );
      case 'chairColor':
        return (
          <div className="relative h-14 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950/40">
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="h-12 w-20 rounded-3xl border border-white/10"
                style={{
                  background: `linear-gradient(135deg, ${option.primary}, ${option.accent})`,
                  boxShadow: 'inset 0 0 12px rgba(0,0,0,0.35)'
                }}
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-black/40" />
          </div>
        );
      case 'tableBase':
        return (
          <div className="relative h-14 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950/40">
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="h-10 w-24 rounded-full border border-white/10"
                style={{
                  background: `linear-gradient(135deg, ${option.baseColor}, ${option.trimColor ?? option.baseColor})`,
                  boxShadow: 'inset 0 0 10px rgba(0,0,0,0.35)'
                }}
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-tr from-white/5 via-transparent to-black/40" />
          </div>
        );
      case 'tableShape': {
        const previewStyle = option?.preview || {};
        return (
          <div className="relative h-14 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950/40">
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="h-12 w-24 bg-gradient-to-br from-slate-300/70 via-slate-100/90 to-slate-400/60 shadow-inner"
                style={{
                  borderRadius: previewStyle.borderRadius ?? '999px',
                  clipPath: previewStyle.clipPath,
                  WebkitClipPath: previewStyle.clipPath
                }}
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-tr from-white/5 via-transparent to-black/40" />
          </div>
        );
      }
      default:
        return null;
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage?.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(appearance));
      } catch (error) {
        console.warn('Failed to persist chess table appearance', error);
      }
    }

    const current = arenaRef.current;
    if (!current || !current.renderer || !current.arenaGroup) return;

    const normalized = normalizeAppearance(appearance);
    const { option: shapeOption, rotationY } = getEffectiveShapeConfig(normalized.tableShape, DEFAULT_PLAYER_COUNT);
    const woodOption = TABLE_WOOD_OPTIONS[normalized.tableWood] ?? TABLE_WOOD_OPTIONS[0];
    const clothOption = TABLE_CLOTH_OPTIONS[normalized.tableCloth] ?? TABLE_CLOTH_OPTIONS[0];
    const baseOption = TABLE_BASE_OPTIONS[normalized.tableBase] ?? TABLE_BASE_OPTIONS[0];
    const chairOption = CHAIR_COLOR_OPTIONS[normalized.chairColor] ?? CHAIR_COLOR_OPTIONS[0];

    const rendererInstance = current.renderer;
    const arenaGroup = current.arenaGroup;
    const boardGroup = current.boardGroup;
    const prevTable = current.tableInfo;

    const shapeChanged = shapeOption?.id !== current.tableShapeId;
    const rotationChanged = Math.abs((current.tableRotationY ?? 0) - rotationY) > 1e-3;

    if (shapeChanged || rotationChanged) {
      if (boardGroup && prevTable?.group) {
        prevTable.group.remove(boardGroup);
      }
      prevTable?.dispose?.();
      const nextTable = createMurlanStyleTable({
        arena: arenaGroup,
        renderer: rendererInstance,
        tableRadius: TABLE_RADIUS,
        tableHeight: TABLE_HEIGHT,
        woodOption,
        clothOption,
        baseOption,
        shapeOption,
        rotationY
      });
      applyTableMaterials(nextTable?.materials, { woodOption, clothOption, baseOption }, rendererInstance);
      if (boardGroup && nextTable?.group) {
        nextTable.group.add(boardGroup);
      }
      current.tableInfo = nextTable;
      current.tableShapeId = nextTable?.shapeId ?? shapeOption?.id ?? null;
      current.tableRotationY = nextTable?.rotationY ?? rotationY ?? 0;
      current.tableRadius = nextTable?.radius ?? TABLE_RADIUS;
      current.tableSurfaceY = nextTable?.surfaceY ?? TABLE_HEIGHT;
    } else if (prevTable?.materials) {
      applyTableMaterials(prevTable.materials, { woodOption, clothOption, baseOption }, rendererInstance);
    }

    if (boardGroup) {
      const surfaceY = (current.tableInfo?.surfaceY ?? TABLE_HEIGHT) + 0.01;
      boardGroup.position.set(0, surfaceY, 0);
    }

    if (!current.boardLookTarget) {
      current.boardLookTarget = new THREE.Vector3();
    }
    current.boardLookTarget.set(
      0,
      (current.tableInfo?.surfaceY ?? TABLE_HEIGHT) + (BOARD.baseH + 0.12) * BOARD_SCALE,
      0
    );

    if (current.spotTarget) {
      current.spotTarget.position.copy(current.boardLookTarget);
      current.spotTarget.updateMatrixWorld();
    }
    if (Array.isArray(current.studioCams)) {
      current.studioCams.forEach((cam) => {
        cam?.lookAt?.(current.boardLookTarget);
      });
    }

    const nextChairId = chairOption?.id ?? 'default';
    const chairNeedsRefresh = shapeChanged || rotationChanged || current.chairOptionId !== nextChairId;
    if (chairNeedsRefresh) {
      const existingChairs = current.chairs ?? [];
      existingChairs.forEach((chair) => {
        if (chair.parent) {
          chair.parent.remove(chair);
        }
        disposeChairGroup(chair);
      });
      const { chairs: newChairs, radius } = buildChairSet(
        chairOption,
        current.tableInfo?.radius ?? TABLE_RADIUS
      );
      newChairs.forEach((chair) => arenaGroup.add(chair));
      current.chairs = newChairs;
      current.chairRadius = radius;
      current.chairOptionId = nextChairId;
    }

    current.controls?.target.copy(current.boardLookTarget);
    current.controls?.update();
    current.fit = current.fit || (() => {});
    fitRef.current = current.fit;
    fitRef.current?.();
  }, [appearance]);

  useEffect(() => {
    const host = wrapRef.current;
    if (!host) return;
    let scene = null;
    let camera = null;
    let renderer = null;
    let controls = null;
    let ray = null;
    const capturedByWhite = [];
    const capturedByBlack = [];

    const vol = getGameVolume();
    const disposers = [];
    bombSoundRef.current = new Audio(bombSound);
    bombSoundRef.current.volume = vol;

    // ----- Build scene -----
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    renderer.localClippingEnabled = true;
    renderer.shadowMap.enabled = true;
    applyRendererSRGB(renderer);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    // Ensure the canvas covers the entire host element so the board is centered
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.zIndex = '0';
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.cursor = 'grab';
    host.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c1020);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x1a1f2b, 0.95);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.0);
    key.position.set(1.8, 2.6, 1.6);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.55);
    fill.position.set(-1.4, 2.2, -2.0);
    scene.add(fill);
    const rim = new THREE.PointLight(0xff7373, 0.4, 12, 2.0);
    rim.position.set(0, 2.1, 0);
    scene.add(rim);
    const spot = new THREE.SpotLight(0xffffff, 1.05, 0, Math.PI / 4, 0.35, 1.1);
    spot.position.set(0, 4.2, 4.6);
    scene.add(spot);
    const spotTarget = new THREE.Object3D();
    scene.add(spotTarget);
    spot.target = spotTarget;
    state.spotTarget = spotTarget;

    const arena = new THREE.Group();
    scene.add(arena);

    const appearanceState = normalizeAppearance(appearanceRef.current);
    const { option: shapeOption, rotationY } = getEffectiveShapeConfig(
      appearanceState.tableShape,
      DEFAULT_PLAYER_COUNT
    );
    const woodOption = TABLE_WOOD_OPTIONS[appearanceState.tableWood] ?? TABLE_WOOD_OPTIONS[0];
    const clothOption = TABLE_CLOTH_OPTIONS[appearanceState.tableCloth] ?? TABLE_CLOTH_OPTIONS[0];
    const baseOption = TABLE_BASE_OPTIONS[appearanceState.tableBase] ?? TABLE_BASE_OPTIONS[0];
    const chairOption = CHAIR_COLOR_OPTIONS[appearanceState.chairColor] ?? CHAIR_COLOR_OPTIONS[0];

    const state = {
      renderer,
      camera: null,
      controls: null,
      arenaGroup: arena,
      boardGroup: null,
      boardLookTarget: null,
      tableInfo: null,
      tableShapeId: null,
      tableRotationY: 0,
      tableRadius: TABLE_RADIUS,
      tableSurfaceY: TABLE_HEIGHT,
      chairs: [],
      chairOptionId: chairOption?.id ?? 'default',
      chairRadius: TABLE_RADIUS + 1,
      host,
      fit: () => {}
    };
    arenaRef.current = state;

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
        color: 0x0f1222,
        roughness: 0.95,
        metalness: 0.05
      })
    );
    floor.rotation.x = -Math.PI / 2;
    arena.add(floor);

    const carpetMat = createArenaCarpetMaterial();
    const carpet = new THREE.Mesh(
      new THREE.PlaneGeometry(roomHalfWidth * 1.2, roomHalfDepth * 1.2),
      carpetMat
    );
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.y = 0.002;
    arena.add(carpet);

    const wallH = 3 * WALL_HEIGHT_MULTIPLIER;
    const wallT = 0.1;
    const wallMat = createArenaWallMaterial();
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
        color: 0x1a233f,
        roughness: 0.9,
        metalness: 0.02,
        side: THREE.DoubleSide
      })
    );
    ceilTrim.position.set(0, wallH - 0.02, 0);
    arena.add(ceilTrim);

    const ledMat = new THREE.MeshStandardMaterial({
      color: 0x00f7ff,
      emissive: 0x0099aa,
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

    const tableInfo = createMurlanStyleTable({
      THREE,
      arena,
      renderer,
      tableRadius: TABLE_RADIUS,
      tableHeight: TABLE_HEIGHT,
      woodOption,
      clothOption,
      baseOption,
      shapeOption,
      rotationY
    });
    applyTableMaterials(tableInfo?.materials, { woodOption, clothOption, baseOption }, renderer);
    if (tableInfo?.dispose) {
      disposers.push(() => {
        try {
          const activeTable = arenaRef.current?.tableInfo ?? tableInfo;
          activeTable?.dispose?.();
        } catch (error) {
          console.warn('Failed to dispose chess table', error);
        }
      });
    }
    state.tableInfo = tableInfo;
    state.tableShapeId = tableInfo?.shapeId ?? null;
    state.tableRotationY = tableInfo?.rotationY ?? 0;
    state.tableRadius = tableInfo?.radius ?? TABLE_RADIUS;
    state.tableSurfaceY = tableInfo?.surfaceY ?? TABLE_HEIGHT;

    const { chairs, radius: chairRadius } = buildChairSet(chairOption, tableInfo?.radius ?? TABLE_RADIUS);
    chairs.forEach((chair) => arena.add(chair));
    state.chairs = chairs;
    state.chairRadius = chairRadius;
    state.chairOptionId = chairOption?.id ?? 'default';
    disposers.push(() => {
      const currentChairs = arenaRef.current?.chairs ?? chairs;
      currentChairs.forEach((chair) => {
        if (chair.parent) {
          chair.parent.remove(chair);
        }
        disposeChairGroup(chair);
      });
    });

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

    const cameraRigOffsetX = (tableInfo?.radius ?? TABLE_RADIUS) + 1.4;
    const cameraRigOffsetZ = (tableInfo?.radius ?? TABLE_RADIUS) + 1.2;
    const studioCamA = makeStudioCamera();
    studioCamA.position.set(-cameraRigOffsetX, 0, -cameraRigOffsetZ);
    arena.add(studioCamA);
    const studioCamB = makeStudioCamera();
    studioCamB.position.set(cameraRigOffsetX, 0, cameraRigOffsetZ);
    arena.add(studioCamB);
    state.studioCams = [studioCamA, studioCamB];

    const boardGroup = new THREE.Group();
    boardGroup.position.set(0, (tableInfo?.surfaceY ?? TABLE_HEIGHT) + 0.01, 0);
    boardGroup.scale.setScalar(BOARD_SCALE);
    tableInfo?.group?.add(boardGroup);
    const boardLookTarget = new THREE.Vector3(
      0,
      (tableInfo?.surfaceY ?? TABLE_HEIGHT) + (BOARD.baseH + 0.12) * BOARD_SCALE,
      0
    );
    state.boardGroup = boardGroup;
    state.boardLookTarget = boardLookTarget;
    spotTarget.position.copy(boardLookTarget);
    spot.target.updateMatrixWorld();
    studioCamA.lookAt(boardLookTarget);
    studioCamB.lookAt(boardLookTarget);

    // Camera orbit
    camera = new THREE.PerspectiveCamera(CAM.fov, 1, CAM.near, CAM.far);
    state.camera = camera;

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.minDistance = CAM.minR;
    controls.maxDistance = CAM.maxR;
    controls.minPolarAngle = CAM.phiMin;
    controls.maxPolarAngle = CAM.phiMax;
    controls.target.copy(boardLookTarget);
    state.controls = controls;

    const fit = () => {
      const current = arenaRef.current;
      const mount = current?.host || host;
      const cam = current?.camera;
      const r = current?.renderer;
      const target = current?.boardLookTarget;
      if (!mount || !cam || !r || !target) return;
      const tbl = current.tableInfo;
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      r.setSize(w, h, false);
      cam.aspect = w / h;
      cam.updateProjectionMatrix();

      const isPortrait = h > w;
      const cameraSeatAngle = Math.PI / 2;
      const backOffset = isPortrait ? 1.65 : 1.05;
      const forwardOffset = isPortrait ? 0.18 : 0.35;
      const heightOffset = isPortrait ? 1.46 : 1.12;
      const seatRadius = current.chairRadius ?? (tbl?.radius ?? TABLE_RADIUS) + 1;
      const tableHeightForCamera = tbl?.tableHeight ?? TABLE_HEIGHT;
      const baseRadius = seatRadius + backOffset - forwardOffset;

      cam.position.set(
        Math.cos(cameraSeatAngle) * baseRadius,
        tableHeightForCamera + heightOffset,
        Math.sin(cameraSeatAngle) * baseRadius
      );

      const tableSpan = (tbl?.radius ?? TABLE_RADIUS) * 2.6;
      const boardSpan = RAW_BOARD_SIZE * BOARD_SCALE * 1.6;
      const span = Math.max(tableSpan, boardSpan);
      const needed = span / (2 * Math.tan(THREE.MathUtils.degToRad(CAM.fov) / 2));
      const currentRadius = cam.position.distanceTo(target);
      const radius = clamp(Math.max(needed, currentRadius), CAM.minR, CAM.maxR);
      const dir = cam.position.clone().sub(target).normalize();
      cam.position.copy(target).addScaledVector(dir, radius);
      controls.target.copy(target);
      controls.update();
    };

    state.fit = fit;
    fitRef.current = fit;
    fit();

    const dollyScale = 1 + CAMERA_DOLLY_FACTOR;
    zoomRef.current = {
      zoomIn: () => {
        if (!state.controls) return;
        state.controls.dollyIn(dollyScale);
        state.controls.update();
      },
      zoomOut: () => {
        if (!state.controls) return;
        state.controls.dollyOut(dollyScale);
        state.controls.update();
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
      if (!settingsRef.current.showHighlights) return;
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
    clearHighlightsRef.current = clearHighlights;

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

    // Loop
    const step = () => {
      controls?.update?.();
      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(step);
    };
    step();

    // Resize
    const onResize = () => {
      fitRef.current?.();
    };
    window.addEventListener('resize', onResize);

    // Start timer for the human player
    startTimer(true);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
      clearInterval(timerRef.current);
      disposers.forEach((fn) => {
        try {
          fn();
        } catch (error) {
          console.warn('Failed during chess cleanup', error);
        }
      });
      try {
        host.removeChild(renderer.domElement);
      } catch {}
      renderer.domElement.removeEventListener('click', onClick);
      renderer.domElement.removeEventListener('touchend', onClick);
      controls?.dispose?.();
      bombSoundRef.current?.pause();
      arenaRef.current = null;
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className="w-screen h-dvh bg-black text-white overflow-hidden select-none relative"
    >
      <div className="absolute top-4 left-4 z-20 flex flex-col items-start gap-2">
        <button
          type="button"
          onClick={() => setConfigOpen((prev) => !prev)}
          aria-expanded={configOpen}
          className={`pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white shadow-lg backdrop-blur transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
            configOpen ? 'bg-black/60' : 'hover:bg-black/60'
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="h-6 w-6"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m19.4 13.5-.44 1.74a1 1 0 0 1-1.07.75l-1.33-.14a7.03 7.03 0 0 1-1.01.59l-.2 1.32a1 1 0 0 1-.98.84h-1.9a1 1 0 0 1-.98-.84l-.2-1.32a7.03 7.03 0 0 1-1.01-.59l-1.33.14a1 1 0 0 1-1.07-.75L4.6 13.5a1 1 0 0 1 .24-.96l1-.98a6.97 6.97 0 0 1 0-1.12l-1-.98a1 1 0 0 1-.24-.96l.44-1.74a1 1 0 0 1 1.07-.75l1.33.14c.32-.23.66-.43 1.01-.6l.2-1.31a1 1 0 0 1 .98-.84h1.9a1 1 0 0 1 .98.84l.2 1.31c.35.17.69.37 1.01.6l1.33-.14a1 1 0 0 1 1.07.75l.44 1.74a1 1 0 0 1-.24.96l-1 .98c.03.37.03.75 0 1.12l1 .98a1 1 0 0 1 .24.96z"
            />
          </svg>
          <span className="sr-only">Hap personalizimin e tavolinës</span>
        </button>
        {configOpen && (
          <div className="pointer-events-auto mt-2 w-72 max-w-[80vw] rounded-2xl border border-white/15 bg-black/80 p-4 text-xs text-white shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] uppercase tracking-[0.4em] text-sky-200/80">Table Setup</span>
              <button
                type="button"
                onClick={() => setConfigOpen(false)}
                className="rounded-full p-1 text-white/70 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                aria-label="Mbyll personalizimin"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <div className="mt-4 max-h-72 space-y-4 overflow-y-auto pr-1">
              {CUSTOMIZATION_SECTIONS.map(({ key, label, options }) => (
                <div key={key} className="space-y-2">
                  <p className="text-[10px] uppercase tracking-[0.35em] text-white/60">{label}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {options.map((option, idx) => {
                      const selected = appearance[key] === idx;
                      return (
                        <button
                          key={option.id ?? `${key}-${idx}`}
                          type="button"
                          onClick={() => setAppearance((prev) => ({ ...prev, [key]: idx }))}
                          aria-pressed={selected}
                          className={`flex flex-col items-center rounded-2xl border p-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                            selected
                              ? 'border-sky-400/80 bg-sky-400/10 shadow-[0_0_12px_rgba(56,189,248,0.35)]'
                              : 'border-white/10 bg-white/5 hover:border-white/20'
                          }`}
                        >
                          {renderPreview(key, option)}
                          <span className="mt-2 text-center text-[0.65rem] font-semibold text-gray-200">{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-3 border-t border-white/10 pt-3">
              <label className="flex items-center justify-between text-[0.7rem] text-gray-200">
                <span>Shfaq lëvizjet e lejueshme</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border border-emerald-400/40 bg-transparent text-emerald-400 focus:ring-emerald-500"
                  checked={showHighlights}
                  onChange={(event) => setShowHighlights(event.target.checked)}
                />
              </label>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="w-full rounded-lg bg-emerald-500/20 py-2 text-center text-[0.7rem] font-semibold text-emerald-200 transition hover:bg-emerald-500/30"
              >
                Rifillo ndeshjen
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="absolute top-2 right-2 flex items-center space-x-2 z-20">
        {avatar && (
          <img
            src={avatar}
            alt="Avatar"
            className="w-10 h-10 rounded-full border border-white/20 pointer-events-none"
          />
        )}
        {username && (
          <div className="text-right leading-tight pointer-events-none">
            <p className="text-sm font-semibold">{username}</p>
            <p className="text-xs text-white/70">Grandmaster</p>
          </div>
        )}
      </div>
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
