import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
// Snooker uses its own slimmer power slider
import { SnookerPowerSlider } from '../../../../snooker-power-slider.js';
import '../../../../snooker-power-slider.css';
import {
  getTelegramUsername,
  getTelegramPhotoUrl
} from '../../utils/telegram.js';
import { FLAG_EMOJIS } from '../../utils/flagEmojis.js';
import { SnookerRules } from '../../../../src/rules/SnookerRules.ts';
import { useAimCalibration } from '../../hooks/useAimCalibration.js';

// --------------------------------------------------
// Procedural emerald cloth texture utilities
// --------------------------------------------------
function makeFbmHeightCanvas(size = 512, octaves = 5) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  function valueNoise(grid, x, y) {
    const x0 = Math.floor(x),
      y0 = Math.floor(y);
    const x1 = x0 + 1,
      y1 = y0 + 1;
    const sx = x - x0,
      sy = y - y0;
    const v00 = grid[(y0 & 255) * 256 + (x0 & 255)];
    const v10 = grid[(y0 & 255) * 256 + (x1 & 255)];
    const v01 = grid[(y1 & 255) * 256 + (x0 & 255)];
    const v11 = grid[(y1 & 255) * 256 + (x1 & 255)];
    const cx = (1 - Math.cos(sx * Math.PI)) * 0.5;
    const cy = (1 - Math.cos(sy * Math.PI)) * 0.5;
    const ix0 = v00 * (1 - cx) + v10 * cx;
    const ix1 = v01 * (1 - cx) + v11 * cx;
    return ix0 * (1 - cy) + ix1 * cy;
  }
  const grid = new Float32Array(256 * 256);
  for (let i = 0; i < grid.length; i++) grid[i] = Math.random();
  const lacunarity = 2.2;
  const gain = 0.52;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let amp = 1,
        freq = 1 / 8,
        sum = 0,
        norm = 0;
      for (let o = 0; o < octaves; o++) {
        const nx = x * freq,
          ny = y * freq;
        const v = valueNoise(grid, nx, ny);
        sum += v * amp;
        norm += amp;
        amp *= gain;
        freq *= lacunarity;
      }
      let h = sum / norm;
      h = Math.pow(h, 1.25);
      const i = (y * size + x) * 4;
      img.data[i + 0] = img.data[i + 1] = img.data[i + 2] = Math.floor(h * 255);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function heightToNormalCanvas(heightCanvas, strength = 2.0) {
  const w = heightCanvas.width,
    h = heightCanvas.height;
  const src = heightCanvas.getContext('2d').getImageData(0, 0, w, h).data;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const out = ctx.createImageData(w, h);
  const get = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) << 2];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const hL = get(x - 1, y),
        hR = get(x + 1, y);
      const hD = get(x, y + 1),
        hU = get(x, y - 1);
      const dx = ((hR - hL) / 255) * strength;
      const dy = ((hD - hU) / 255) * strength;
      let nx = -dx,
        ny = -dy,
        nz = 1.0;
      const invLen = 1.0 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx *= invLen;
      ny *= invLen;
      nz *= invLen;
      const i = (y * w + x) * 4;
      out.data[i + 0] = Math.floor((nx * 0.5 + 0.5) * 255);
      out.data[i + 1] = Math.floor((ny * 0.5 + 0.5) * 255);
      out.data[i + 2] = Math.floor((nz * 0.5 + 0.5) * 255);
      out.data[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return c;
}

function makeColorCanvasFromHeight(
  heightCanvas,
  c0 = '#228b22',
  c1 = '#2ec956',
  variation = 0.1
) {
  const w = heightCanvas.width,
    h = heightCanvas.height;
  const src = heightCanvas.getContext('2d').getImageData(0, 0, w, h).data;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const out = ctx.createImageData(w, h);
  const ca = new THREE.Color(c0),
    cb = new THREE.Color(c1);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const v = src[idx * 4] / 255;
      const t = Math.min(
        1,
        Math.max(0, v * (1 + (Math.random() - 0.5) * variation))
      );
      const col = ca.clone().lerp(cb, t);
      const edge =
        Math.min(x, w - 1 - x, y, h - 1 - y) / (Math.min(w, h) * 0.5);
      col.multiplyScalar(0.8 + edge * 0.2);
      out.data[idx * 4 + 0] = Math.floor(col.r * 255);
      out.data[idx * 4 + 1] = Math.floor(col.g * 255);
      out.data[idx * 4 + 2] = Math.floor(col.b * 255);
      out.data[idx * 4 + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return c;
}

// --------------------------------------------------
// Procedural rug texture and floor helper
// --------------------------------------------------
function makeRugTexture(Wpx = 2048, Hpx = 1400) {
  const c = document.createElement('canvas');
  c.width = Wpx;
  c.height = Hpx;
  const ctx = c.getContext('2d');

  function hairStroke(x, y, len, ang, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    const w = 1 + Math.random() * 0.6;
    const l = len * (0.6 + Math.random() * 0.8);
    const grd = ctx.createLinearGradient(0, 0, l, 0);
    grd.addColorStop(0, `rgba(30,0,8,0)`);
    grd.addColorStop(0.25, `rgba(30,0,8,${alpha})`);
    grd.addColorStop(0.75, `rgba(80,0,18,${alpha})`);
    grd.addColorStop(1, `rgba(30,0,8,0)`);
    ctx.fillStyle = grd;
    ctx.fillRect(0, -w * 0.5, l, w);
    ctx.restore();
  }

  const g = ctx.createLinearGradient(0, 0, Wpx, Hpx);
  g.addColorStop(0, '#5a0014');
  g.addColorStop(1, '#30000b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, Wpx, Hpx);

  for (let i = 0; i < 11000; i++) {
    hairStroke(
      Math.random() * Wpx,
      Math.random() * Hpx,
      10 + Math.random() * 22,
      Math.random() * 0.6 - 0.3,
      0.18
    );
  }
  for (let i = 0; i < 8000; i++) {
    hairStroke(
      Math.random() * Wpx,
      Math.random() * Hpx,
      8 + Math.random() * 18,
      Math.random() * 0.6 - 0.3 + 0.6,
      0.12
    );
  }

  const outerGold = 16;
  const innerGold = 8;
  ctx.lineJoin = 'miter';
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = outerGold;
  ctx.strokeRect(
    outerGold * 0.5,
    outerGold * 0.5,
    Wpx - outerGold,
    Hpx - outerGold
  );
  const inset = outerGold * 1.8;
  ctx.lineWidth = innerGold;
  ctx.strokeRect(inset, inset, Wpx - 2 * inset, Hpx - 2 * inset);

  const motifPad = Math.floor(innerGold * 2.2);
  const zoneX = inset + motifPad + Math.floor(Wpx * 0.03);
  const zoneY = inset + motifPad;
  const zoneW = Wpx - 2 * (inset + motifPad) - Math.floor(Wpx * 0.03);
  const zoneH = Hpx - 2 * (inset + motifPad);

  ctx.save();
  ctx.beginPath();
  ctx.rect(zoneX, zoneY, zoneW, zoneH);
  ctx.clip();
  ctx.strokeStyle = '#2f2f2f';
  ctx.fillStyle = '#2f2f2f';
  const cell = Math.floor(Math.min(zoneW, zoneH) * 0.06);
  const pad = Math.floor(cell * 0.25);
  ctx.globalAlpha = 0.18;
  ctx.lineWidth = 4;
  ctx.strokeRect(zoneX, zoneY, zoneW, zoneH);
  ctx.globalAlpha = 1;
  const step = cell + pad;
  for (let x = zoneX + pad; x < zoneX + zoneW - pad - cell; x += step) {
    const h = Math.max(2, Math.floor(cell * 0.18));
    ctx.fillRect(x, zoneY + pad, cell, h);
    ctx.fillRect(x, zoneY + zoneH - pad - h, cell, h);
  }
  for (let y = zoneY + pad; y < zoneY + zoneH - pad - cell; y += step) {
    const w = Math.max(2, Math.floor(cell * 0.18));
    ctx.fillRect(zoneX + pad, y, w, cell);
    ctx.fillRect(zoneX + zoneW - pad - w, y, w, cell);
  }
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = '#333333';
  for (let i = 0; i < 10; i++) {
    const rx = zoneX + zoneW * 0.3 + Math.random() * zoneW * 0.45;
    const ry = zoneY + zoneH * 0.25 + Math.random() * zoneH * 0.5;
    const r = cell * 0.9 + Math.random() * cell * 0.7;
    ctx.beginPath();
    ctx.ellipse(rx, ry, r, r * 0.78, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  return new THREE.CanvasTexture(c);
}

function addRugUnderTable(scene, table) {
  const box = new THREE.Box3().setFromObject(table);
  const size = box.getSize(new THREE.Vector3());
  const rugWidth = size.x * 4 * 0.7; // 30% smaller carpet around the table
  const rugHeight = size.z * 4 * 0.7; // 30% smaller carpet around the table
  const tex = makeRugTexture();
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 8;
  tex.center.set(0.5, 0.5);
  tex.rotation = Math.PI / 2; // align long side with table length
  const rugMat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.96,
    metalness: 0.05
  });
  const rug = new THREE.Mesh(
    new THREE.PlaneGeometry(rugWidth, rugHeight),
    rugMat
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(
    (box.max.x + box.min.x) / 2,
    box.min.y,
    (box.max.z + box.min.z) / 2
  );
  scene.add(rug);
  return rug;
}

function addArenaWalls(scene, rug) {
  const wallT = TABLE.WALL;
  const wallH = TABLE.H * 2 * 0.7; // lower walls by 30%
  const rugWidth = rug.geometry.parameters.width;
  const rugHeight = rug.geometry.parameters.height;
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x8b8000,
    roughness: 0.8,
    metalness: 0.2,
    side: THREE.DoubleSide
  });
  const wallGeoX = new THREE.BoxGeometry(rugWidth + wallT * 2, wallH, wallT);
  const wallGeoZ = new THREE.BoxGeometry(wallT, wallH, rugHeight + wallT * 2);
  const walls = new THREE.Group();
  const north = new THREE.Mesh(wallGeoX, wallMat);
  north.position.set(
    rug.position.x,
    rug.position.y + wallH / 2,
    rug.position.z - rugHeight / 2 - wallT / 2
  );
  const south = new THREE.Mesh(wallGeoX, wallMat);
  south.position.set(
    rug.position.x,
    rug.position.y + wallH / 2,
    rug.position.z + rugHeight / 2 + wallT / 2
  );
  const west = new THREE.Mesh(wallGeoZ, wallMat);
  west.position.set(
    rug.position.x - rugWidth / 2 - wallT / 2,
    rug.position.y + wallH / 2,
    rug.position.z
  );
  const east = new THREE.Mesh(wallGeoZ, wallMat);
  east.position.set(
    rug.position.x + rugWidth / 2 + wallT / 2,
    rug.position.y + wallH / 2,
    rug.position.z
  );
  walls.add(north, south, west, east);
  scene.add(walls);

  const sideOffsetX = rugWidth * 0.15;
  const sideOffsetZ = rugHeight * 0.15;
  [north, south, west, east].forEach((w, i) => {
    const s = new THREE.SpotLight(0xffffff, 0.5, 0, Math.PI * 0.35, 0.4, 1);
    const x =
      i === 0
        ? w.position.x - sideOffsetX
        : i === 1
        ? w.position.x + sideOffsetX
        : w.position.x;
    const z =
      i === 2
        ? w.position.z - sideOffsetZ
        : i === 3
        ? w.position.z + sideOffsetZ
        : w.position.z;
    s.position.set(x, rug.position.y + wallH - 0.5, z);
    s.target.position.set(rug.position.x, 0, rug.position.z);
    scene.add(s);
    scene.add(s.target);
  });
  return { walls, north, south, west, east, wallH, rugWidth, rugHeight };
}

// --------------------------------------------------
// Pocket jaws
// --------------------------------------------------
const JAW_H = 3.0;
const JAW_T = 1.25;
const SECTOR_START = -Math.PI * 0.65;
const SECTOR_END = Math.PI * 0.65;
const jawMat = new THREE.MeshPhysicalMaterial({
  color: 0x111111,
  roughness: 0.35,
  metalness: 0.1,
  clearcoat: 0.4
});
function makeJawSector(
  R = POCKET_VIS_R,
  T = JAW_T,
  start = SECTOR_START,
  end = SECTOR_END
) {
  const r = R - T;
  const s = new THREE.Shape();
  s.absarc(0, 0, R, start, end, false);
  s.absarc(0, 0, r, end, start, true);
  const geo = new THREE.ExtrudeGeometry(s, { depth: JAW_H, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  return geo;
}
function addPocketJaws(scene, playW, playH) {
  const HALF_PLAY_W = playW * 0.5;
  const HALF_PLAY_H = playH * 0.5;
  const POCKET_MAP = [
    { id: 'corner_tl', type: 'corner', pos: [-HALF_PLAY_W, -HALF_PLAY_H] },
    { id: 'corner_tr', type: 'corner', pos: [HALF_PLAY_W, -HALF_PLAY_H] },
    { id: 'corner_bl', type: 'corner', pos: [-HALF_PLAY_W, HALF_PLAY_H] },
    { id: 'corner_br', type: 'corner', pos: [HALF_PLAY_W, HALF_PLAY_H] },
    { id: 'side_top', type: 'side', pos: [0, -HALF_PLAY_H] },
    { id: 'side_bottom', type: 'side', pos: [0, HALF_PLAY_H] }
  ];
  const jaws = [];
  const geoCorner = makeJawSector();
  const geoSide = makeJawSector(POCKET_VIS_R, JAW_T * 0.8);
  for (const entry of POCKET_MAP) {
    const p = new THREE.Vector2(entry.pos[0], entry.pos[1]);
    const towardCenter2 = p.clone().multiplyScalar(-1).normalize();
    const offset = entry.type === 'side' ? POCKET_VIS_R * 1.15 : POCKET_VIS_R;
    const pShift = p.clone().add(towardCenter2.multiplyScalar(offset));
    const geom = entry.type === 'side' ? geoSide.clone() : geoCorner.clone();
    const jaw = new THREE.Mesh(geom, jawMat);
    jaw.castShadow = true;
    jaw.receiveShadow = true;
    jaw.position.set(pShift.x, TABLE_Y + 0.01, pShift.y);
    jaw.lookAt(new THREE.Vector3(0, TABLE_Y, 0));
    if (entry.type === 'side') {
      jaw.rotateY(Math.PI / 2);
    }
    scene.add(jaw);
    jaws.push(jaw);
  }
  return jaws;
}

/**
 * NEW SNOOKER GAME — fresh build (keep ONLY Guret for balls)
 * Per kërkesën tënde:
 *  • Kamera rotullohet si një person te tavolina (orbit e butë), me kënd pak të ulët, pa rënë në nivelin e cloth.
 *  • 6 gropa të prera realisht në cloth (Shape.holes + Extrude) + kapje (capture radius) → guret bien brenda.
 *  • Power slider i RI: i madh, djathtas ekranit, me gjest **PULL** (tërhiq POSHTË sa fort do → fuqi), dhe **gjuan në release**.
 *  • Playable: aiming line + tick, përplasje, kapje në xhepa, logjikë bazë snooker (reds→colour, pastaj colours in order, fouls, in‑hand).
 */

// --------------------------------------------------
// Config
// --------------------------------------------------
// separate scales for table and balls
// Dimensions enlarged for a roomier snooker table
const BALL_SCALE = 1;
const TABLE_SCALE = 1.3;
const TABLE = {
  W: 66 * TABLE_SCALE,
  H: 132 * TABLE_SCALE,
  THICK: 1.8 * TABLE_SCALE,
  WALL: 2.6 * TABLE_SCALE
};
const PLAY_W = TABLE.W - 2 * TABLE.WALL;
const PLAY_H = TABLE.H - 2 * TABLE.WALL;
const BALL_R = 2 * BALL_SCALE;
const POCKET_R = BALL_R * 2; // pockets twice the ball radius
// slightly larger visual radius so rails align with pocket rings
const POCKET_VIS_R = POCKET_R / 0.85;
const FRICTION = 0.9925;
const STOP_EPS = 0.02;
const CAPTURE_R = POCKET_R; // pocket capture radius
const TABLE_Y = -2; // vertical offset to lower entire table
const TABLE_H = 0.75; // physical height of table used for legs/skirt
const CUE_TIP_GAP = BALL_R * 0.25; // bring cue stick slightly closer
// angle for cushion cuts guiding balls into pockets
const CUSHION_CUT_ANGLE = 30;

// Updated colors for dark cloth and standard balls
// includes separate tones for rails, base wood and cloth markings
const COLORS = Object.freeze({
  cloth: 0x238b23,
  rail: 0x3a2a1a,
  base: 0x5b3a1a,
  markings: 0xffffff,
  cue: 0xffffff,
  red: 0xff0000,
  yellow: 0xffff00,
  green: 0x006400,
  brown: 0x8b4513,
  blue: 0x0000ff,
  pink: 0xff69b4,
  black: 0x000000
});

function spotPositions(baulkZ) {
  const halfH = PLAY_H / 2;
  return {
    yellow: [-PLAY_W * 0.22, baulkZ],
    green: [PLAY_W * 0.22, baulkZ],
    brown: [0, baulkZ],
    blue: [0, 0],
    pink: [0, PLAY_H * 0.25],
    black: [0, halfH - PLAY_H * 0.09]
  };
}

// Kamera: lejojmë ulje më të madhe (phi më i vogël), por mos shko kurrë krejt në nivel (limit ~0.5rad)
const CAMERA = {
  fov: 44,
  near: 0.1,
  far: 4000,
  minR: 40 * TABLE_SCALE,
  maxR: 420 * TABLE_SCALE,
  minPhi: 0.5,
  // keep the camera slightly above the horizontal plane
  maxPhi: Math.PI / 2 - 0.1
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fitRadius = (camera, margin = 1.1) => {
  const a = camera.aspect,
    f = THREE.MathUtils.degToRad(camera.fov);
  const halfW = (TABLE.W / 2) * margin,
    halfH = (TABLE.H / 2) * margin;
  const dzH = halfH / Math.tan(f / 2);
  const dzW = halfW / (Math.tan(f / 2) * a);
  // Nudge camera closer so the table fills more of the view
  const r = Math.max(dzH, dzW) * 0.95;
  return clamp(r, CAMERA.minR, CAMERA.maxR);
};

// --------------------------------------------------
// Utilities
// --------------------------------------------------
const pocketCenters = () => [
  new THREE.Vector2(-PLAY_W / 2, -PLAY_H / 2),
  new THREE.Vector2(PLAY_W / 2, -PLAY_H / 2),
  new THREE.Vector2(-PLAY_W / 2, PLAY_H / 2),
  new THREE.Vector2(PLAY_W / 2, PLAY_H / 2),
  new THREE.Vector2(-PLAY_W / 2, 0),
  new THREE.Vector2(PLAY_W / 2, 0)
];
const allStopped = (balls) => balls.every((b) => b.vel.length() < STOP_EPS);
function reflectRails(ball) {
  const limX = TABLE.W / 2 - BALL_R - TABLE.WALL;
  const limY = TABLE.H / 2 - BALL_R - TABLE.WALL;
  // If the ball is near any pocket, skip rail reflections so it can drop in
  const nearPocket = pocketCenters().some(
    (c) => ball.pos.distanceTo(c) < POCKET_VIS_R + BALL_R
  );
  if (nearPocket) return;
  if (ball.pos.x < -limX && ball.vel.x < 0) {
    ball.pos.x = -limX;
    ball.vel.x *= -1;
  }
  if (ball.pos.x > limX && ball.vel.x > 0) {
    ball.pos.x = limX;
    ball.vel.x *= -1;
  }
  if (ball.pos.y < -limY && ball.vel.y < 0) {
    ball.pos.y = -limY;
    ball.vel.y *= -1;
  }
  if (ball.pos.y > limY && ball.vel.y > 0) {
    ball.pos.y = limY;
    ball.vel.y *= -1;
  }
}

// calculate impact point and post-collision direction for aiming guide
function calcTarget(cue, dir, balls) {
  const cuePos = cue.pos.clone();
  let tHit = Infinity;
  let targetBall = null;
  let railNormal = null;

  const limX = TABLE.W / 2 - BALL_R - TABLE.WALL;
  const limY = TABLE.H / 2 - BALL_R - TABLE.WALL;
  const checkRail = (t, normal) => {
    if (t >= 0 && t < tHit) {
      tHit = t;
      railNormal = normal;
      targetBall = null;
    }
  };
  if (dir.x < 0) checkRail((-limX - cuePos.x) / dir.x, new THREE.Vector2(1, 0));
  if (dir.x > 0) checkRail((limX - cuePos.x) / dir.x, new THREE.Vector2(-1, 0));
  if (dir.y < 0) checkRail((-limY - cuePos.y) / dir.y, new THREE.Vector2(0, 1));
  if (dir.y > 0) checkRail((limY - cuePos.y) / dir.y, new THREE.Vector2(0, -1));

  const diam = BALL_R * 2;
  const diam2 = diam * diam;
  balls.forEach((b) => {
    if (!b.active || b === cue) return;
    const v = b.pos.clone().sub(cuePos);
    const proj = v.dot(dir);
    if (proj <= 0) return;
    const perp2 = v.lengthSq() - proj * proj;
    if (perp2 > diam2) return;
    const thc = Math.sqrt(diam2 - perp2);
    const t = proj - thc;
    if (t >= 0 && t < tHit) {
      tHit = t;
      targetBall = b;
      railNormal = null;
    }
  });

  const impact = cuePos.clone().add(dir.clone().multiplyScalar(tHit));
  let afterDir = null;
  if (targetBall) {
    afterDir = targetBall.pos.clone().sub(impact).normalize();
  } else if (railNormal) {
    const n = railNormal.clone().normalize();
    afterDir = dir
      .clone()
      .sub(n.clone().multiplyScalar(2 * dir.dot(n)))
      .normalize();
  }
  return { impact, afterDir, targetBall, railNormal };
}

// --------------------------------------------------
// ONLY kept component: Guret (balls factory)
// --------------------------------------------------
function Guret(parent, id, color, x, y) {
  const material = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.2,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    specularIntensity: 1
  });
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_R, 64, 48),
    material
  );
  mesh.position.set(x, BALL_R, y);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (id === 'cue') {
    const dotSize = BALL_R * 0.15;
    const dotGeom = new THREE.SphereGeometry(dotSize, 16, 8);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    [
      [BALL_R * 0.7, 0, 0],
      [-BALL_R * 0.7, 0, 0],
      [0, 0, BALL_R * 0.7],
      [0, 0, -BALL_R * 0.7]
    ].forEach(([dx, dy, dz]) => {
      const d = new THREE.Mesh(dotGeom, dotMat);
      d.position.set(dx, dy, dz);
      mesh.add(d);
    });
  }
  parent.add(mesh);
  return {
    id,
    color,
    mesh,
    pos: new THREE.Vector2(x, y),
    vel: new THREE.Vector2(),
    active: true
  };
}

// --------------------------------------------------
// Table with CUT pockets + markings (fresh)
// --------------------------------------------------

function Table3D(scene) {
  const table = new THREE.Group();
  const halfW = PLAY_W / 2,
    halfH = PLAY_H / 2;

  const clothMat = new THREE.MeshPhysicalMaterial({
    color: COLORS.cloth,
    roughness: 0.95,
    sheen: 1.0,
    sheenRoughness: 0.8
  });
  const clothHeight = makeFbmHeightCanvas(512, 6);
  const clothColorTex = new THREE.CanvasTexture(
    makeColorCanvasFromHeight(clothHeight)
  );
  const clothNormalTex = new THREE.CanvasTexture(
    heightToNormalCanvas(clothHeight, 4.0)
  );
  clothColorTex.wrapS = clothColorTex.wrapT = THREE.RepeatWrapping;
  clothNormalTex.wrapS = clothNormalTex.wrapT = THREE.RepeatWrapping;
  clothColorTex.repeat.set(16, 16);
  clothNormalTex.repeat.set(16, 16);
  clothMat.map = clothColorTex;
  clothMat.normalMap = clothNormalTex;
  clothMat.normalScale.set(0.4, 0.4);
  const cushionMat = clothMat.clone();
  const railWoodMat = new THREE.MeshStandardMaterial({
    color: COLORS.rail,
    metalness: 0.3,
    roughness: 0.8
  });
  const woodMat = new THREE.MeshStandardMaterial({
    color: COLORS.base,
    metalness: 0.2,
    roughness: 0.8
  });

  // Cloth with pocket holes
  const shape = new THREE.Shape();
  shape.moveTo(-halfW, -halfH);
  shape.lineTo(halfW, -halfH);
  shape.lineTo(halfW, halfH);
  shape.lineTo(-halfW, halfH);
  shape.lineTo(-halfW, -halfH);
  pocketCenters().forEach((p) => {
    const h = new THREE.Path();
    h.absellipse(
      p.x,
      p.y,
      POCKET_VIS_R * 0.9,
      POCKET_VIS_R * 0.9,
      0,
      Math.PI * 2
    );
    shape.holes.push(h);
  });
  const extrude = new THREE.ExtrudeGeometry(shape, {
    depth: TABLE.THICK,
    bevelEnabled: false
  });
  const cloth = new THREE.Mesh(extrude, clothMat);
  cloth.rotation.x = -Math.PI / 2;
  cloth.position.y = -TABLE.THICK;
  table.add(cloth);

  // Markings
  const markingMat = new THREE.LineBasicMaterial({ color: COLORS.markings });
  const markingMeshMat = new THREE.MeshBasicMaterial({
    color: COLORS.markings,
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: 1
  });
  const baulkZ = -PLAY_H / 4;
  const baulkGeom = new THREE.PlaneGeometry(PLAY_W, BALL_R * 0.1);
  const baulkLine = new THREE.Mesh(baulkGeom, markingMeshMat);
  baulkLine.rotation.x = -Math.PI / 2;
  baulkLine.position.set(0, 0.01, baulkZ);
  table.add(baulkLine);

  const dRadius = PLAY_W * 0.15;
  const dThickness = BALL_R * 0.1;
  const dGeom = new THREE.RingGeometry(
    dRadius - dThickness,
    dRadius,
    32,
    1,
    Math.PI,
    Math.PI
  );
  const dMesh = new THREE.Mesh(dGeom, markingMeshMat);
  dMesh.rotation.x = -Math.PI / 2;
  dMesh.position.set(0, 0.01, baulkZ);
  table.add(dMesh);

  const spots = spotPositions(baulkZ);
  const spotRadius = BALL_R * 0.15;
  const spotGeom = new THREE.CircleGeometry(spotRadius, 32);
  const spotMat = new THREE.MeshBasicMaterial({ color: COLORS.markings });
  Object.values(spots).forEach(([x, z]) => {
    const s = new THREE.Mesh(spotGeom, spotMat);
    s.rotation.x = -Math.PI / 2;
    s.position.set(x, 0.015, z);
    s.matrixAutoUpdate = false;
    s.updateMatrix();
    table.add(s);
  });

  // Side rails
  const railH = TABLE.THICK * 2.0;
  const railW = TABLE.WALL * 0.9;
  const FRAME_W = railW * 2.5;
  const outerHalfW = halfW + 2 * railW + FRAME_W;
  const outerHalfH = halfH + 2 * railW + FRAME_W;

  const frameShape = new THREE.Shape();
  frameShape.moveTo(-outerHalfW, -outerHalfH);
  frameShape.lineTo(outerHalfW, -outerHalfH);
  frameShape.lineTo(outerHalfW, outerHalfH);
  frameShape.lineTo(-outerHalfW, outerHalfH);
  frameShape.lineTo(-outerHalfW, -outerHalfH);
  const innerRect = new THREE.Path();
  innerRect.moveTo(-halfW - railW, -halfH - railW);
  innerRect.lineTo(halfW + railW, -halfH - railW);
  innerRect.lineTo(halfW + railW, halfH + railW);
  innerRect.lineTo(-halfW - railW, halfH + railW);
  innerRect.lineTo(-halfW - railW, -halfH - railW);
  frameShape.holes.push(innerRect);
  const frameGeo = new THREE.ExtrudeGeometry(frameShape, {
    depth: railH,
    bevelEnabled: false
  });
  const frame = new THREE.Mesh(frameGeo, railWoodMat);
  frame.rotation.x = -Math.PI / 2;
  frame.position.y = -TABLE.THICK + 0.01;
  table.add(frame);

  // Cushions
  const cushionRaiseY = -TABLE.THICK + 0.02;
  const cushionExtend = POCKET_VIS_R * 0.85;
  function cushionProfile(len) {
    const L = len + cushionExtend;
    const half = L / 2;
    const backY = railW / 2;
    const frontY = -railW / 2;
    const cut = railW / Math.tan(THREE.MathUtils.degToRad(CUSHION_CUT_ANGLE));
    const s = new THREE.Shape();
    s.moveTo(-half, backY);
    s.lineTo(half, backY);
    s.lineTo(half - cut, frontY);
    s.lineTo(-half + cut, frontY);
    s.lineTo(-half, backY);
    const geo = new THREE.ExtrudeGeometry(s, {
      depth: railH,
      bevelEnabled: false
    });
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const tFront = THREE.MathUtils.clamp(
        (backY - y) / (backY - frontY),
        0,
        1
      );
      if (tFront > 0) pos.setZ(i, z * (1.0 - tFront));
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }

  function addCushion(x, z, len, horizontal, flip = false) {
    const geo = cushionProfile(len);
    const mesh = new THREE.Mesh(geo, cushionMat);
    mesh.rotation.x = -Math.PI / 2;
    const g = new THREE.Group();
    g.add(mesh);
    g.position.set(x, cushionRaiseY, z);
    if (!horizontal) {
      g.rotation.y = Math.PI / 2;
      if (flip) g.rotation.y += Math.PI;
    } else if (flip) {
      g.rotation.y = Math.PI;
    }
    table.add(g);
  }

  const horizLen = PLAY_W - 2 * POCKET_VIS_R;
  const vertSeg = PLAY_H / 2 - 2 * POCKET_VIS_R;
  const CUSHION_LEN = Math.min(horizLen, vertSeg);
  const bottomZ = -halfH - (TABLE.WALL * 0.5) / 2;
  const topZ = halfH + (TABLE.WALL * 0.5) / 2;
  const leftX = -halfW - (TABLE.WALL * 0.5) / 2;
  const rightX = halfW + (TABLE.WALL * 0.5) / 2;
  addCushion(0, bottomZ, CUSHION_LEN, true, false);
  addCushion(
    leftX,
    -halfH + POCKET_VIS_R + vertSeg / 2,
    CUSHION_LEN,
    false,
    false
  );
  addCushion(
    rightX,
    halfH - POCKET_VIS_R - vertSeg / 2,
    CUSHION_LEN,
    false,
    true
  );
  addCushion(0, topZ, CUSHION_LEN, true, true);
  addCushion(
    leftX,
    halfH - POCKET_VIS_R - vertSeg / 2,
    CUSHION_LEN,
    false,
    false
  );
  addCushion(
    rightX,
    -halfH + POCKET_VIS_R + vertSeg / 2,
    CUSHION_LEN,
    false,
    true
  );

  // Skirt & legs
  const skirtH = TABLE_H * 0.4;
  const outerHalfW2 = outerHalfW;
  const outerHalfH2 = outerHalfH;
  const skirtT = railW * 2.5 * 0.8;
  const skirtShape = new THREE.Shape();
  const outW = outerHalfW2 + skirtT * 0.2;
  const outH = outerHalfH2 + skirtT * 0.2;
  skirtShape.moveTo(-outW, -outH);
  skirtShape.lineTo(outW, -outH);
  skirtShape.lineTo(outW, outH);
  skirtShape.lineTo(-outW, outH);
  skirtShape.lineTo(-outW, -outH);
  const innerS = new THREE.Path();
  innerS.moveTo(
    -(halfW + 2 * railW + FRAME_W - railW),
    -(halfH + 2 * railW + FRAME_W - railW)
  );
  innerS.lineTo(
    halfW + 2 * railW + FRAME_W - railW,
    -(halfH + 2 * railW + FRAME_W - railW)
  );
  innerS.lineTo(
    halfW + 2 * railW + FRAME_W - railW,
    halfH + 2 * railW + FRAME_W - railW
  );
  innerS.lineTo(
    -(halfW + 2 * railW + FRAME_W - railW),
    halfH + 2 * railW + FRAME_W - railW
  );
  innerS.lineTo(
    -(halfW + 2 * railW + FRAME_W - railW),
    -(halfH + 2 * railW + FRAME_W - railW)
  );
  skirtShape.holes.push(innerS);
  const skirtGeo = new THREE.ExtrudeGeometry(skirtShape, {
    depth: skirtH,
    bevelEnabled: false
  });
  const skirt = new THREE.Mesh(skirtGeo, woodMat);
  skirt.rotation.x = -Math.PI / 2;
  skirt.position.y = -TABLE.THICK - skirtH * 0.8;
  table.add(skirt);

  const legR = Math.min(TABLE.W, TABLE.H) * 0.055;
  const legH = TABLE_H;
  const legGeo = new THREE.CylinderGeometry(legR, legR, legH, 64);
  const legPositions = [
    [-outerHalfW2 + FRAME_W * 0.6, -outerHalfH2 + FRAME_W * 0.6],
    [outerHalfW2 - FRAME_W * 0.6, -outerHalfH2 + FRAME_W * 0.6],
    [-outerHalfW2 + FRAME_W * 0.6, outerHalfH2 - FRAME_W * 0.6],
    [outerHalfW2 - FRAME_W * 0.6, outerHalfH2 - FRAME_W * 0.6]
  ];
  legPositions.forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(legGeo, woodMat);
    leg.position.set(lx, -TABLE.THICK - legH / 2, lz);
    table.add(leg);
  });

  // Crossbars connecting table legs
  const braceT = legR * 0.6;
  const braceY = -TABLE.THICK - legH + braceT / 2;
  const spanX = Math.abs(legPositions[0][0] - legPositions[1][0]) + legR * 2;
  const spanZ = Math.abs(legPositions[0][1] - legPositions[2][1]) + legR * 2;
  const braceGeoX = new THREE.BoxGeometry(spanX, braceT, braceT);
  const braceGeoZ = new THREE.BoxGeometry(braceT, braceT, spanZ);
  const braceFront = new THREE.Mesh(braceGeoX, woodMat);
  braceFront.position.set(0, braceY, -outerHalfH2 + FRAME_W * 0.6);
  const braceBack = new THREE.Mesh(braceGeoX, woodMat);
  braceBack.position.set(0, braceY, outerHalfH2 - FRAME_W * 0.6);
  const braceLeft = new THREE.Mesh(braceGeoZ, woodMat);
  braceLeft.position.set(-outerHalfW2 + FRAME_W * 0.6, braceY, 0);
  const braceRight = new THREE.Mesh(braceGeoZ, woodMat);
  braceRight.position.set(outerHalfW2 - FRAME_W * 0.6, braceY, 0);
  table.add(braceFront, braceBack, braceLeft, braceRight);

  console.assert(
    typeof railW !== 'undefined',
    '[TEST] railW should be defined once'
  );
  console.assert(
    typeof FRAME_W !== 'undefined',
    '[TEST] FRAME_W should be defined once'
  );

  table.position.y = TABLE_Y;
  scene.add(table);
  return { centers: pocketCenters(), baulkZ, group: table, clothMat };
}
// --------------------------------------------------
// NEW Engine (no globals). Camera feels like standing at the side.
// --------------------------------------------------
export default function NewSnookerGame() {
  const mountRef = useRef(null);
  const rafRef = useRef(null);
  const rules = useMemo(() => new SnookerRules(), []);
  const [hud, setHud] = useState({
    power: 0.65,
    A: 0,
    B: 0,
    turn: 0,
    phase: 'reds',
    next: 'red',
    inHand: false,
    over: false
  });
  const powerRef = useRef(hud.power);
  useEffect(() => {
    powerRef.current = hud.power;
  }, [hud.power]);
  const [err, setErr] = useState(null);
  const fireRef = useRef(() => {}); // set from effect so slider can trigger fire()
  const cameraRef = useRef(null);
  const sphRef = useRef(null);
  const rendererRef = useRef(null);
  const last3DRef = useRef({ phi: 1.05, theta: Math.PI });
  const fitRef = useRef(() => {});
  const topViewRef = useRef(false);
  const [topView, setTopView] = useState(false);
  const aimDirRef = useRef(new THREE.Vector2(0, 1));
  const playerOffsetRef = useRef(0);
  const [timer, setTimer] = useState(60);
  const timerRef = useRef(null);
  const spinRef = useRef({ x: 0, y: 0 });
  const tipGroupRef = useRef(null);
  const spinRangeRef = useRef(0);
  const cueRef = useRef(null);
  const ballsRef = useRef([]);
  const [player, setPlayer] = useState({ name: '', avatar: '' });
  const panelsRef = useRef(null);
  const { mapDelta } = useAimCalibration();
  useEffect(() => {
    document.title = '3D Snooker';
  }, []);
  useEffect(() => {
    setPlayer({
      name: getTelegramUsername() || 'Player',
      avatar: getTelegramPhotoUrl()
    });
  }, []);
  useEffect(() => {
    let wakeLock;
    const request = async () => {
      try {
        wakeLock = await navigator.wakeLock?.request('screen');
      } catch (e) {
        console.warn('wakeLock request failed', e);
      }
    };
    request();
    const handleVis = () => {
      if (document.visibilityState === 'visible') request();
    };
    document.addEventListener('visibilitychange', handleVis);
    return () => {
      document.removeEventListener('visibilitychange', handleVis);
      try {
        wakeLock?.release();
      } catch {}
    };
  }, []);
  const aiFlag = useMemo(
    () => FLAG_EMOJIS[Math.floor(Math.random() * FLAG_EMOJIS.length)],
    []
  );
  const aiShoot = useRef(() => {
    aimDirRef.current.set(Math.random() - 0.5, Math.random() - 0.5).normalize();
    powerRef.current = 0.5;
    setHud((s) => ({ ...s, power: 0.5 }));
    fireRef.current?.();
  });

  // determine which sides of the cue ball are blocked by nearby balls or rails
  const getBlockedSides = () => {
    const cue = cueRef.current;
    const balls = ballsRef.current;
    const sides = { left: false, right: false, up: false, down: false };
    if (!cue) return sides;
    const thresh = BALL_R * 2.05;
    for (const b of balls) {
      if (!b.active || b === cue) continue;
      const dx = b.pos.x - cue.pos.x;
      const dz = b.pos.y - cue.pos.y;
      if (Math.hypot(dx, dz) < thresh) {
        if (dx > 0) sides.right = true;
        if (dx < 0) sides.left = true;
        if (dz > 0) sides.up = true;
        if (dz < 0) sides.down = true;
      }
    }
    const halfW = PLAY_W / 2;
    const halfH = PLAY_H / 2;
    if (cue.pos.x + BALL_R >= halfW) sides.right = true;
    if (cue.pos.x - BALL_R <= -halfW) sides.left = true;
    if (cue.pos.y + BALL_R >= halfH) sides.up = true;
    if (cue.pos.y - BALL_R <= -halfH) sides.down = true;
    return sides;
  };

  const drawHudPanel = (ctx, logo, avatarImg, name, score, t, emoji) => {
    const c = ctx.canvas;
    const w = c.width;
    const h = c.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 10;
    ctx.strokeRect(0, 0, w, h);
    if (logo && logo.complete) ctx.drawImage(logo, w / 2 - 64, 5, 128, 64);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = '28px sans-serif';
    ctx.fillText('Match of the Day', w / 2, 110);
    if (avatarImg && avatarImg.complete)
      ctx.drawImage(avatarImg, 20, 100, 64, 64);
    else if (emoji) {
      ctx.font = '48px serif';
      ctx.fillText(emoji, 52, 150);
    }
    ctx.textAlign = 'left';
    ctx.font = '24px sans-serif';
    ctx.fillText(name, 100, 120);
    ctx.fillText(`Score: ${score}`, 100, 160);
    ctx.fillText(`Time: ${t}`, 100, 200);
  };

  const updateHudPanels = useCallback(() => {
    const panels = panelsRef.current;
    if (!panels) return;
    const { A, B, C, D, logo, playerImg } = panels;
    drawHudPanel(A.ctx, logo, playerImg, player.name, hud.A, timer);
    A.tex.needsUpdate = true;
    drawHudPanel(B.ctx, logo, null, 'AI', hud.B, timer, aiFlag);
    B.tex.needsUpdate = true;
    drawHudPanel(C.ctx, logo, playerImg, player.name, hud.A, timer);
    C.tex.needsUpdate = true;
    drawHudPanel(D.ctx, logo, null, 'AI', hud.B, timer, aiFlag);
    D.tex.needsUpdate = true;
  }, [hud.A, hud.B, timer, player.name, aiFlag]);

  useEffect(() => {
    updateHudPanels();
  }, [updateHudPanels]);

  // Removed camera rotation helpers previously triggered by UI buttons

  const toggleView = () => {
    const cam = cameraRef.current;
    const sph = sphRef.current;
    const fit = fitRef.current;
    if (!cam || !sph || !fit) return;
    const next = !topViewRef.current;
    const start = {
      radius: sph.radius,
      phi: sph.phi,
      theta: sph.theta
    };
    if (next) last3DRef.current = { phi: sph.phi, theta: sph.theta };
    const targetMargin = next
      ? 1.05
      : window.innerHeight > window.innerWidth
        ? 1.5
        : 1.3;
    const target = {
      radius: fitRadius(cam, targetMargin),
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
      const targetPos = new THREE.Vector3(
        playerOffsetRef.current,
        TABLE_Y + 0.05,
        0
      );
      cam.position.setFromSpherical(sph).add(targetPos);
      cam.lookAt(targetPos);
      if (k < 1) requestAnimationFrame(anim);
      else {
        topViewRef.current = next;
        setTopView(next);
        if (rendererRef.current) {
          rendererRef.current.domElement.style.transform = next
            ? 'scale(0.9)'
            : 'scale(1)';
        }
        fit(targetMargin);
      }
    }
    requestAnimationFrame(anim);
  };

  useEffect(() => {
    if (hud.over) return;
    const playerTurn = hud.turn;
    const duration = playerTurn === 0 ? 60 : 5;
    setTimer(duration);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          if (playerTurn === 0) {
            setHud((s) => ({ ...s, turn: 1 - s.turn }));
          } else {
            aiShoot.current();
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [hud.turn, hud.over]);

  useEffect(() => {
    const host = mountRef.current;
    if (!host) return;
    try {
      screen.orientation?.lock?.('portrait').catch(() => {});
      // Renderer
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance'
      });
      renderer.useLegacyLights = false;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      // Ensure the canvas fills the host element so the table is centered and
      // scaled correctly on all view modes.
      renderer.setSize(host.clientWidth, host.clientHeight);
      host.appendChild(renderer.domElement);
      renderer.domElement.addEventListener('webglcontextlost', (e) => e.preventDefault());
      rendererRef.current = renderer;
      renderer.domElement.style.transformOrigin = 'top left';

      // Scene & Camera
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x050505);
      RectAreaLightUniformsLib.init();
      let cue;
      let clothMat;
      let shooting = false; // track when a shot is in progress
      const camera = new THREE.PerspectiveCamera(
        CAMERA.fov,
        host.clientWidth / host.clientHeight,
        CAMERA.near,
        CAMERA.far
      );
      // Start behind baulk colours
      const sph = new THREE.Spherical(
        170 * TABLE_SCALE,
        1.05 /* slightly lower angle */,
        Math.PI
      );
      const updateCamera = () => {
        const target =
          cue?.mesh && !topViewRef.current && !shooting
            ? new THREE.Vector3(cue.pos.x, BALL_R, cue.pos.y)
            : new THREE.Vector3(playerOffsetRef.current, TABLE_Y + 0.05, 0);
        if (topViewRef.current) {
          camera.position.set(target.x, sph.radius, target.z);
          camera.lookAt(target);
        } else {
          camera.position.setFromSpherical(sph).add(target);
          camera.lookAt(target);
        }
        if (clothMat) {
          const dist = camera.position.distanceTo(target);
          const fade = THREE.MathUtils.clamp((220 - dist) / 120, 0, 1);
          const ns = 0.45 * fade;
          clothMat.normalScale.set(ns, ns);
        }
      };
      const fit = (m = 1.1) => {
        camera.aspect = host.clientWidth / host.clientHeight;
        const baseR = fitRadius(camera, m);
        let t = (sph.phi - CAMERA.minPhi) / (CAMERA.maxPhi - CAMERA.minPhi);
        let r = baseR * (1 - 0.8 * t);
        const railLimit = TABLE.THICK + 0.4; // stay above side rails
        const phiCap = Math.acos(THREE.MathUtils.clamp(railLimit / r, -1, 1));
        sph.phi = clamp(
          sph.phi,
          CAMERA.minPhi,
          Math.min(phiCap, CAMERA.maxPhi)
        );
        t = (sph.phi - CAMERA.minPhi) / (CAMERA.maxPhi - CAMERA.minPhi);
        sph.radius = clamp(baseR * (1 - 0.8 * t), CAMERA.minR, CAMERA.maxR);
        updateCamera();
        camera.updateProjectionMatrix();
      };
      cameraRef.current = camera;
      sphRef.current = sph;
      fitRef.current = fit;
      fit(
        topViewRef.current
          ? 1.05
          : window.innerHeight > window.innerWidth
            ? 1.5
            : 1.3
      );
      const dom = renderer.domElement;
      dom.style.touchAction = 'none';
      const balls = [];
      let project;
      const drag = { on: false, x: 0, y: 0, moved: false };
      const pinch = { active: false, dist: 0 };
      const down = (e) => {
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
        drag.moved = false;
        drag.x = e.clientX || e.touches?.[0]?.clientX || 0;
        drag.y = e.clientY || e.touches?.[0]?.clientY || 0;
      };
      const move = (e) => {
        if (pinch.active && e.touches?.length === 2) {
          const [t1, t2] = e.touches;
          const d = Math.hypot(
            t1.clientX - t2.clientX,
            t1.clientY - t2.clientY
          );
          const delta = pinch.dist - d;
          sph.radius = clamp(
            sph.radius + delta * 0.5,
            CAMERA.minR,
            CAMERA.maxR
          );
          pinch.dist = d;
          updateCamera();
          return;
        }
        if (topViewRef.current || !drag.on) return;
        const x = e.clientX || e.touches?.[0]?.clientX || drag.x;
        const y = e.clientY || e.touches?.[0]?.clientY || drag.y;
        const dx = x - drag.x;
        const dy = y - drag.y;
        if (!drag.moved && Math.hypot(dx, dy) > 4) drag.moved = true;
        if (drag.moved) {
          drag.x = x;
          drag.y = y;
          sph.theta -= dx * 0.005;
          sph.phi = clamp(sph.phi + dy * 0.003, CAMERA.minPhi, CAMERA.maxPhi);
          fit(
            topViewRef.current
              ? 1.05
              : window.innerHeight > window.innerWidth
                ? 1.2
                : 1.0
          );
        }
      };
      const up = () => {
        drag.on = false;
        drag.moved = false;
        pinch.active = false;
      };
      const wheel = (e) => {
        sph.radius = clamp(
          sph.radius + e.deltaY * 0.12,
          CAMERA.minR,
          CAMERA.maxR
        );
        updateCamera();
      };
      dom.addEventListener('mousedown', down);
      dom.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
      dom.addEventListener('touchstart', down, { passive: true });
      dom.addEventListener('touchmove', move, { passive: true });
      window.addEventListener('touchend', up);
      dom.addEventListener('wheel', wheel, { passive: true });
      const keyRot = (e) => {
        if (topViewRef.current) return;
        const step = e.shiftKey ? 0.12 : 0.06;
        if (e.code === 'ArrowLeft') sph.theta += step;
        else if (e.code === 'ArrowRight') sph.theta -= step;
        else if (e.code === 'ArrowUp')
          sph.phi = clamp(sph.phi - step, CAMERA.minPhi, CAMERA.maxPhi);
        else if (e.code === 'ArrowDown')
          sph.phi = clamp(sph.phi + step, CAMERA.minPhi, CAMERA.maxPhi);
        else return;
        fit(window.innerHeight > window.innerWidth ? 1.5 : 1.3);
      };
      window.addEventListener('keydown', keyRot);

      // Lights
      scene.add(new THREE.AmbientLight(0xffffff, 0.2));
      scene.add(new THREE.HemisphereLight(0xdde7ff, 0x0b1020, 1));
      const dir = new THREE.DirectionalLight(0xffffff, 1.4);
      dir.position.set(-2.5, 4, 2);
      scene.add(dir);
      // Position lights slightly closer to the table center and surface
      const lightHeight = TABLE_Y + 3.0;
      const lightOffset = 15;
      const lightX = TABLE.W / 2 - lightOffset;
      const lightZ = TABLE.H / 2 - lightOffset;
      const rectSize = 20;

      const makeLight = (x, z, intensity) => {
        const rect = new THREE.RectAreaLight(0xffffff, intensity, rectSize, rectSize);
        rect.position.set(x, lightHeight, z);
        rect.lookAt(0, TABLE_Y, 0);
        scene.add(rect);
      };

      makeLight(lightX, lightZ, 30);
      makeLight(-lightX, lightZ, 26);
      makeLight(-lightX, -lightZ, 26);
      makeLight(lightX, -lightZ, 24);
      makeLight(lightX, 0, 28);
      makeLight(-lightX, 0, 28);

      // Table
      const { centers, baulkZ, group: table, clothMat: tableCloth } = Table3D(scene);
      clothMat = tableCloth;
      addPocketJaws(scene, PLAY_W, PLAY_H);
      const rug = addRugUnderTable(scene, table);
      const arena = addArenaWalls(scene, rug);

      // 3D HUD panels on arena walls
      const panelW = 100;
      const panelH = 50;
      const panelY = TABLE_Y + arena.wallH * 0.4;
      const canvasA = document.createElement('canvas');
      canvasA.width = 512;
      canvasA.height = 256;
      const ctxA = canvasA.getContext('2d');
      const texA = new THREE.CanvasTexture(canvasA);
      const meshA = new THREE.Mesh(
        new THREE.PlaneGeometry(panelW, panelH),
        new THREE.MeshBasicMaterial({ map: texA, transparent: true })
      );
      const panelOffset = TABLE.WALL / 2 + 0.1;
      meshA.position.set(
        arena.west.position.x + panelOffset,
        panelY,
        arena.west.position.z
      );
      meshA.rotation.y = Math.PI / 2;
      scene.add(meshA);

      const canvasB = document.createElement('canvas');
      canvasB.width = 512;
      canvasB.height = 256;
      const ctxB = canvasB.getContext('2d');
      const texB = new THREE.CanvasTexture(canvasB);
      const meshB = new THREE.Mesh(
        new THREE.PlaneGeometry(panelW, panelH),
        new THREE.MeshBasicMaterial({ map: texB, transparent: true })
      );
      meshB.position.set(
        arena.east.position.x - panelOffset,
        panelY,
        arena.east.position.z
      );
      meshB.rotation.y = -Math.PI / 2;
      scene.add(meshB);

      const canvasC = document.createElement('canvas');
      canvasC.width = 512;
      canvasC.height = 256;
      const ctxC = canvasC.getContext('2d');
      const texC = new THREE.CanvasTexture(canvasC);
      const meshC = new THREE.Mesh(
        new THREE.PlaneGeometry(panelW, panelH),
        new THREE.MeshBasicMaterial({ map: texC, transparent: true })
      );
      meshC.position.set(
        arena.north.position.x,
        panelY,
        arena.north.position.z + panelOffset
      );
      scene.add(meshC);

      const canvasD = document.createElement('canvas');
      canvasD.width = 512;
      canvasD.height = 256;
      const ctxD = canvasD.getContext('2d');
      const texD = new THREE.CanvasTexture(canvasD);
      const meshD = new THREE.Mesh(
        new THREE.PlaneGeometry(panelW, panelH),
        new THREE.MeshBasicMaterial({ map: texD, transparent: true })
      );
      meshD.position.set(
        arena.south.position.x,
        panelY,
        arena.south.position.z - panelOffset
      );
      meshD.rotation.y = Math.PI;
      scene.add(meshD);

      panelsRef.current = {
        A: { ctx: ctxA, tex: texA },
        B: { ctx: ctxB, tex: texB },
        C: { ctx: ctxC, tex: texC },
        D: { ctx: ctxD, tex: texD },
        logo: new Image(),
        playerImg: new Image()
      };
      panelsRef.current.logo.src =
        '/assets/icons/file_00000000bc2862439eecffff3730bbe4.webp';
      panelsRef.current.logo.onload = () => updateHudPanels();
      if (player.avatar) {
        panelsRef.current.playerImg.crossOrigin = 'anonymous';
        panelsRef.current.playerImg.src = player.avatar;
        panelsRef.current.playerImg.onload = () => updateHudPanels();
      }
      updateHudPanels();

      // Balls (ONLY Guret)
      const add = (id, color, x, z) => {
        const b = Guret(table, id, color, x, z);
        balls.push(b);
        return b;
      };
      cue = add('cue', COLORS.cue, -BALL_R * 2, baulkZ);
      const SPOTS = spotPositions(baulkZ);

      // 15 red balls arranged in triangle behind the pink
      const startZ = SPOTS.pink[1] + BALL_R * 2;
      let rid = 0;
      for (let row = 0; row < 5; row++) {
        for (let i = 0; i <= row; i++) {
          if (rid >= 15) break;
          const x = (i - row / 2) * (BALL_R * 2 + 0.002 * (BALL_R / 0.0525));
          const z = startZ + row * (BALL_R * 1.9);
          add(`red_${rid++}`, COLORS.red, x, z);
        }
      }

      // colours
      const colors = Object.fromEntries(
        Object.entries(SPOTS).map(([k, [x, z]]) => [k, add(k, COLORS[k], x, z)])
      );

      cueRef.current = cue;
      ballsRef.current = balls;

      // Aiming visuals
      const aimMat = new THREE.LineBasicMaterial({
        color: 0xffffff,
        linewidth: 2,
        transparent: true,
        opacity: 0.9
      });
      const aimGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3()
      ]);
      const aim = new THREE.Line(aimGeom, aimMat);
      aim.visible = false;
      table.add(aim);
      const tickGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3()
      ]);
      const tick = new THREE.Line(
        tickGeom,
        new THREE.LineBasicMaterial({ color: 0xffffff })
      );
      tick.visible = false;
      table.add(tick);

      const targetGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3()
      ]);
      const target = new THREE.Line(
        targetGeom,
        new THREE.LineDashedMaterial({
          color: 0xffffff,
          dashSize: 1,
          gapSize: 1,
          transparent: true,
          opacity: 0.5
        })
      );
      target.visible = false;
      table.add(target);

      // Cue stick behind cueball
      const SCALE = BALL_R / 0.0525;
      const cueLen = 1.5 * SCALE;
      const cueStick = new THREE.Group();

      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008 * SCALE, 0.025 * SCALE, cueLen, 32),
        new THREE.MeshPhysicalMaterial({ color: 0xdeb887, roughness: 0.6 })
      );
      shaft.rotation.x = -Math.PI / 2;
      cueStick.add(shaft);

      // group for tip & connector so only the thin end moves for spin
      const tipGroup = new THREE.Group();
      tipGroup.position.z = -cueLen / 2;
      cueStick.add(tipGroup);
      tipGroupRef.current = tipGroup;

      // subtle leather-like line texture for the tip
      const tipCanvas = document.createElement('canvas');
      tipCanvas.width = tipCanvas.height = 64;
      const tipCtx = tipCanvas.getContext('2d');
      tipCtx.fillStyle = '#0a4cbf';
      tipCtx.fillRect(0, 0, 64, 64);
      tipCtx.strokeStyle = 'rgba(255,255,255,0.1)';
      tipCtx.lineWidth = 2;
      for (let i = 0; i < 64; i += 8) {
        tipCtx.beginPath();
        tipCtx.moveTo(i, 0);
        tipCtx.lineTo(i, 64);
        tipCtx.stroke();
      }
      const tipTex = new THREE.CanvasTexture(tipCanvas);

      const tipLen = 0.03 * SCALE;
      const tip = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.008 * SCALE, tipLen - 0.016 * SCALE, 8, 16),
        new THREE.MeshPhysicalMaterial({
          color: 0x0000ff,
          roughness: 0.9,
          map: tipTex
        })
      );
      tip.rotation.x = -Math.PI / 2;
      tip.position.z = -tipLen / 2;
      tipGroup.add(tip);

      const connectorHeight = 0.015 * SCALE;
      const connector = new THREE.Mesh(
        new THREE.CylinderGeometry(
          0.009 * SCALE,
          0.009 * SCALE,
          connectorHeight,
          32
        ),
        new THREE.MeshPhysicalMaterial({
          color: 0xcd7f32,
          metalness: 0.8,
          roughness: 0.5
        })
      );
      connector.rotation.x = -Math.PI / 2;
      connector.position.z = connectorHeight / 2;
      tipGroup.add(connector);

      const buttCap = new THREE.Mesh(
        new THREE.SphereGeometry(0.03 * SCALE, 32, 16),
        new THREE.MeshPhysicalMaterial({ color: 0x111111, roughness: 0.5 })
      );
      buttCap.position.z = cueLen / 2;
      cueStick.add(buttCap);

      const stripeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
      for (let i = 0; i < 12; i++) {
        const stripe = new THREE.Mesh(
          new THREE.BoxGeometry(0.01 * SCALE, 0.001 * SCALE, 0.35 * SCALE),
          stripeMat
        );
        const angle = (i / 12) * Math.PI * 2;
        stripe.position.x = Math.cos(angle) * 0.02 * SCALE;
        stripe.position.y = Math.sin(angle) * 0.02 * SCALE;
        stripe.position.z = 0.55 * SCALE;
        stripe.rotation.z = angle;
        cueStick.add(stripe);
      }

      cueStick.position.set(cue.pos.x, BALL_R, cue.pos.y + 0.8 * SCALE);
      // thin side already faces the cue ball so no extra rotation
      cueStick.visible = false;
      table.add(cueStick);

      spinRangeRef.current = 0.05 * SCALE;

      // Pointer → XZ plane
      const pointer = new THREE.Vector2();
      const ray = new THREE.Raycaster();
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TABLE_Y);
      project = (ev) => {
        const r = dom.getBoundingClientRect();
        const cx =
          (((ev.clientX ?? ev.touches?.[0]?.clientX ?? 0) - r.left) / r.width) *
            2 -
          1;
        const cy = -(
          (((ev.clientY ?? ev.touches?.[0]?.clientY ?? 0) - r.top) / r.height) *
            2 -
          1
        );
        pointer.set(cx, cy);
        ray.setFromCamera(pointer, camera);
        const pt = new THREE.Vector3();
        ray.ray.intersectPlane(plane, pt);
        return new THREE.Vector2(pt.x, pt.z);
      };

      const aimDir = aimDirRef.current;
      const camFwd = new THREE.Vector3();
      const tmpAim = new THREE.Vector2();

      // In-hand placement
      const free = (x, z) =>
        balls.every(
          (b) =>
            !b.active ||
            b === cue ||
            new THREE.Vector2(x, z).distanceTo(b.pos) > BALL_R * 2.1
        );
      const onPlace = (e) => {
        if (!hud.inHand) return;
        const p = project(e);
        if (
          p.y <= baulkZ &&
          Math.abs(p.x) <= PLAY_W / 2 - BALL_R * 2 &&
          free(p.x, p.y)
        ) {
          cue.active = true;
          cue.mesh.visible = true;
          cue.pos.set(p.x, p.y);
          cue.mesh.position.set(p.x, BALL_R, p.y);
          setHud((s) => ({ ...s, inHand: false }));
        }
      };
      dom.addEventListener('pointerdown', onPlace);

      // Shot lifecycle
      let potted = [];
      let foul = false;
      let firstHit = null;
      const legalTarget = () =>
        hud.phase === 'reds'
          ? hud.next === 'red'
            ? 'red'
            : 'colour'
          : hud.next;
      const isRedId = (id) => id.startsWith('red');
      const values = rules.getBallValues();
      const val = (id) =>
        isRedId(id) ? values.RED : values[id.toUpperCase()] || 0;

      // Fire (slider e thërret në release)
      const fire = () => {
        if (!cue?.active || hud.inHand || !allStopped(balls) || hud.over)
          return;
        shooting = true;
        potted = [];
        foul = false;
        firstHit = null;
        clearInterval(timerRef.current);
        const base = aimDir
          .clone()
          .multiplyScalar(4.2 * (0.48 + powerRef.current * 1.52) * 0.5);
        cue.vel.copy(base);

        // switch camera back to orbit view and pull back to show full table
        if (cameraRef.current && sphRef.current && fitRef.current) {
          topViewRef.current = false;
          const cam = cameraRef.current;
          const sph = sphRef.current;
          sph.theta = Math.PI;
          sph.phi = 0.9;
          fitRef.current(2.0);
          updateCamera();
        }
      };
      fireRef.current = fire;

      // Resolve shot
      function resolve() {
        const me = hud.turn === 0 ? 'A' : 'B',
          op = hud.turn === 0 ? 'B' : 'A';
        let gain = 0;
        let swap = true;
        if (!cue.active) foul = true;
        const target = legalTarget();
        if (firstHit) {
          if (target === 'red' && !isRedId(firstHit)) foul = true;
          else if (target === 'colour' && isRedId(firstHit)) foul = true;
          else if (
            target !== 'red' &&
            target !== 'colour' &&
            firstHit !== target
          )
            foul = true;
        } else {
          foul = true;
        }
        const reds = potted.filter(isRedId),
          cols = potted.filter((id) => !isRedId(id));
        if (hud.phase === 'reds') {
          if (hud.next === 'red') {
            if (cols.length > 0) foul = true;
            gain += reds.length;
            if (reds.length > 0 && !foul) {
              setHud((s) => ({ ...s, next: 'colour' }));
              swap = false;
            }
          } else {
            if (reds.length > 0) foul = true;
            if (cols.length > 0 && !foul) {
              cols.forEach((id) => {
                gain += val(id);
                const b = colors[id];
                if (b) {
                  const [sx, sy] = SPOTS[id];
                  b.active = true;
                  b.mesh.visible = true;
                  b.pos.set(sx, sy);
                  b.mesh.position.set(sx, BALL_R, sy);
                }
              });
              setHud((s) => ({ ...s, next: 'red' }));
              swap = false;
            }
          }
          const redsLeft = balls.some((b) => b.active && isRedId(b.id));
          if (!redsLeft)
            setHud((s) => ({ ...s, phase: 'colors', next: 'yellow' }));
        } else {
          if (
            cols.length === 1 &&
            reds.length === 0 &&
            cols[0] === hud.next &&
            !foul
          ) {
            gain += val(hud.next);
            const order = ['yellow', 'green', 'brown', 'blue', 'pink', 'black'];
            const idx = order.indexOf(hud.next);
            const nxt = order[idx + 1];
            if (nxt) {
              setHud((s) => ({ ...s, next: nxt }));
              swap = false;
            } else {
              setHud((s) => ({ ...s, over: true }));
            }
          } else if (cols.length > 0 || reds.length > 0) {
            foul = true;
          }
        }
        if (foul) {
          const foulPts = Math.max(
            4,
            ...potted.map((id) => val(id)),
            cue.active ? 0 : 4
          );
          setHud((s) => ({
            ...s,
            [op]: s[op] + foulPts,
            inHand: true,
            next: s.phase === 'reds' ? 'red' : s.next
          }));
          cue.active = false;
          cue.mesh.visible = false;
          cue.vel.set(0, 0);
        } else if (gain > 0) {
          setHud((s) => ({ ...s, [me]: s[me] + gain }));
        }
        if (swap || foul) setHud((s) => ({ ...s, turn: 1 - s.turn }));
        shooting = false;
        if (cameraRef.current && sphRef.current && fitRef.current) {
          const cam = cameraRef.current;
          const sph = sphRef.current;
          sph.radius = fitRadius(cam, 1.25);
          sph.phi = 0.9;
          fitRef.current(1.5);
          updateCamera();
        }
        potted = [];
        foul = false;
        firstHit = null;
      }

      // Loop
      const step = () => {
        camera.getWorldDirection(camFwd);
        tmpAim.set(camFwd.x, camFwd.z).normalize();
        aimDir.lerp(tmpAim, 0.2);
        // Aiming vizual
        if (allStopped(balls) && !hud.inHand && cue?.active && !hud.over) {
          const { impact, afterDir, targetBall, railNormal } = calcTarget(
            cue,
            aimDir,
            balls
          );
          const start = new THREE.Vector3(cue.pos.x, BALL_R, cue.pos.y);
          let end = new THREE.Vector3(impact.x, BALL_R, impact.y);
          const dir = new THREE.Vector3(aimDir.x, 0, aimDir.y).normalize();
          if (start.distanceTo(end) < 1e-4) {
            end = start.clone().add(dir.clone().multiplyScalar(BALL_R));
          }
          aimGeom.setFromPoints([start, end]);
          aim.visible = true;
          aim.material.color.set(
            targetBall && !railNormal ? 0xffff00 : 0xffffff
          );
          const perp = new THREE.Vector3(-dir.z, 0, dir.x);
          tickGeom.setFromPoints([
            end.clone().add(perp.clone().multiplyScalar(1.4)),
            end.clone().add(perp.clone().multiplyScalar(-1.4))
          ]);
          tick.visible = true;
          const pull = powerRef.current * BALL_R * 10 * 0.5;
          const side = spinRef.current.x * spinRangeRef.current;
          const vert = -spinRef.current.y * spinRangeRef.current;
          const spinWorld = new THREE.Vector3(
            perp.x * side,
            vert,
            perp.z * side
          );
          cueStick.position.set(
            cue.pos.x - dir.x * (cueLen / 2 + pull + CUE_TIP_GAP) + spinWorld.x,
            BALL_R + spinWorld.y,
            cue.pos.y - dir.z * (cueLen / 2 + pull + CUE_TIP_GAP) + spinWorld.z
          );
          cueStick.rotation.y = Math.atan2(dir.x, dir.z) + Math.PI;
          if (tipGroupRef.current) {
            tipGroupRef.current.position.set(0, 0, -cueLen / 2);
          }
          cueStick.visible = true;
          if (afterDir) {
            const tEnd = new THREE.Vector3(
              end.x + afterDir.x * 30,
              BALL_R,
              end.z + afterDir.y * 30
            );
            targetGeom.setFromPoints([end, tEnd]);
            target.visible = true;
            target.computeLineDistances();
          } else {
            target.visible = false;
          }
        } else {
          aim.visible = false;
          tick.visible = false;
          target.visible = false;
          cueStick.visible = false;
        }

        // Fizika
        balls.forEach((b) => {
          if (!b.active) return;
          b.pos.add(b.vel);
          b.vel.multiplyScalar(FRICTION);
          const speed = b.vel.length();
          if (speed < STOP_EPS) b.vel.set(0, 0);
          reflectRails(b);
          b.mesh.position.set(b.pos.x, BALL_R, b.pos.y);
          if (speed > 0) {
            const axis = new THREE.Vector3(b.vel.y, 0, -b.vel.x).normalize();
            const angle = speed / BALL_R;
            b.mesh.rotateOnWorldAxis(axis, angle);
          }
        });
        // Kolizione + regjistro firstHit
        for (let i = 0; i < balls.length; i++)
          for (let j = i + 1; j < balls.length; j++) {
            const a = balls[i],
              b = balls[j];
            if (!a.active || !b.active) continue;
            const dx = b.pos.x - a.pos.x,
              dy = b.pos.y - a.pos.y;
            const d2 = dx * dx + dy * dy;
            const min = (BALL_R * 2) ** 2;
            if (d2 > 0 && d2 < min) {
              const d = Math.sqrt(d2) || 1e-4;
              const nx = dx / d,
                ny = dy / d;
              const overlap = (BALL_R * 2 - d) / 2;
              a.pos.x -= nx * overlap;
              a.pos.y -= ny * overlap;
              b.pos.x += nx * overlap;
              b.pos.y += ny * overlap;
              const avn = a.vel.x * nx + a.vel.y * ny;
              const bvn = b.vel.x * nx + b.vel.y * ny;
              const at = a.vel
                .clone()
                .sub(new THREE.Vector2(nx, ny).multiplyScalar(avn));
              const bt = b.vel
                .clone()
                .sub(new THREE.Vector2(nx, ny).multiplyScalar(bvn));
              a.vel.copy(at.add(new THREE.Vector2(nx, ny).multiplyScalar(bvn)));
              b.vel.copy(bt.add(new THREE.Vector2(nx, ny).multiplyScalar(avn)));
              if (!firstHit) {
                if (a.id === 'cue' && b.id !== 'cue') firstHit = b.id;
                else if (b.id === 'cue' && a.id !== 'cue') firstHit = a.id;
              }
            }
          }
        // Kapje në xhepa
        balls.forEach((b) => {
          if (!b.active) return;
          for (const c of centers) {
            if (b.pos.distanceTo(c) < CAPTURE_R) {
              b.active = false;
              b.mesh.visible = false;
              b.vel.set(0, 0);
              if (b !== cue) potted.push(b.id.startsWith('red') ? 'red' : b.id);
              break;
            }
          }
        });
        // Fund i goditjes
        if (shooting) {
          const any = balls.some((b) => b.active && b.vel.length() >= STOP_EPS);
          if (!any) resolve();
        }
        const fit = fitRef.current;
        if (fit && cue?.active && !shooting) {
          const limX = PLAY_W / 2 - BALL_R - TABLE.WALL;
          const limY = PLAY_H / 2 - BALL_R - TABLE.WALL;
          const edgeX = Math.max(0, Math.abs(cue.pos.x) - (limX - 5));
          const edgeY = Math.max(0, Math.abs(cue.pos.y) - (limY - 5));
          const edge = Math.min(1, Math.max(edgeX, edgeY) / 5);
          fit(1 + edge * 0.08);
        }
        updateCamera();
        renderer.render(scene, camera);
        rafRef.current = requestAnimationFrame(step);
      };
      step();

      // Resize
      const onResize = () => {
        // Update canvas dimensions when the window size changes so the table
        // remains fully visible.
        renderer.setSize(host.clientWidth, host.clientHeight);
        fit(
          topViewRef.current
            ? 1.05
            : window.innerHeight > window.innerWidth
              ? 1.5
              : 1.3
        );
      };
      window.addEventListener('resize', onResize);

      return () => {
        cancelAnimationFrame(rafRef.current);
        window.removeEventListener('resize', onResize);
        try {
          host.removeChild(renderer.domElement);
        } catch {}
        dom.removeEventListener('mousedown', down);
        dom.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
        dom.removeEventListener('touchstart', down);
        dom.removeEventListener('touchmove', move);
        window.removeEventListener('touchend', up);
        dom.removeEventListener('wheel', wheel);
        window.removeEventListener('keydown', keyRot);
        dom.removeEventListener('pointerdown', onPlace);
      };
    } catch (e) {
      console.error(e);
      setErr(e?.message || String(e));
    }
  }, [hud.inHand, hud.over]);

  // --------------------------------------------------
  // NEW Big Pull Slider (right side): drag DOWN to set power, releases → fire()
  // --------------------------------------------------
  const sliderRef = useRef(null);
  useEffect(() => {
    const mount = sliderRef.current;
    if (!mount) return;
    const slider = new SnookerPowerSlider({
      mount,
      value: powerRef.current * 100,
      cueSrc: '/assets/snooker/cue.webp',
      labels: true,
      onChange: (v) => setHud((s) => ({ ...s, power: v / 100 })),
      onCommit: () => fireRef.current?.()
    });
    return () => {
      mount.innerHTML = '';
      slider.el?.remove?.();
    };
  }, []);

  // Spin controller interactions
  useEffect(() => {
    const box = document.getElementById('spinBox');
    const dot = document.getElementById('spinDot');
    if (!box || !dot) return;
    const move = (e) => {
      const rect = box.getBoundingClientRect();
      const x =
        (((e.clientX ?? e.touches?.[0]?.clientX ?? 0) - rect.left) /
          rect.width) *
          2 -
        1;
      const y =
        (((e.clientY ?? e.touches?.[0]?.clientY ?? 0) - rect.top) /
          rect.height) *
          2 -
        1;
      let nx = x,
        ny = y;
      const r = Math.hypot(nx, ny);
      if (r > 1) {
        nx /= r;
        ny /= r;
      }
      const blocked = getBlockedSides();
      if (blocked.left && nx < 0) nx = 0;
      if (blocked.right && nx > 0) nx = 0;
      if (blocked.down && ny < 0) ny = 0;
      if (blocked.up && ny > 0) ny = 0;
      spinRef.current = { x: nx, y: ny };
      dot.style.transform = `translate(${(nx * rect.width) / 2}px, ${(ny * rect.height) / 2}px)`;
    };
    const up = () => {
      box.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    const down = (e) => {
      move(e);
      box.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    };
    box.addEventListener('pointerdown', down);
    return () => {
      box.removeEventListener('pointerdown', down);
      box.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, []);

  return (
    <div className="w-full h-[100vh] bg-black text-white overflow-hidden select-none">
      {/* Canvas host now stretches full width so table reaches the slider */}
      <div ref={mountRef} className="absolute inset-0" />

      {/* Top HUD */}
      <div className="absolute top-0 left-0 right-0 flex justify-center pointer-events-none z-50">
        <div className="bg-gray-800 px-4 py-2 rounded-b flex flex-col items-center text-white">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <img
                src={player.avatar || '/assets/icons/profile.svg'}
                alt="player"
                className="w-10 h-10 rounded-full object-cover border-2 border-yellow-400"
              />
              <span className={hud.turn === 0 ? 'text-yellow-400' : ''}>{player.name}</span>
            </div>
            <div className="text-xl font-bold">{hud.A} - {hud.B}</div>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full border-2 border-yellow-400 flex items-center justify-center">
                <span className="text-3xl leading-none">{aiFlag}</span>
              </div>
              <span className={hud.turn === 1 ? 'text-yellow-400' : ''}>AI</span>
            </div>
          </div>
          <div className="mt-1 text-sm">Time: {timer}</div>
        </div>
      </div>

      {err && (
        <div className="absolute inset-0 bg-black/80 text-white text-xs flex items-center justify-center p-4 z-50">
          Init error: {String(err)}
        </div>
      )}
      {/* Power Slider */}
      <div
        ref={sliderRef}
        className="absolute right-3 top-1/2 -translate-y-1/2"
      />

      {/* Spin controller */}
      <div
        id="spinBox"
        className="absolute bottom-4 right-4 w-16 h-16 rounded-full bg-white flex items-center justify-center"
      >
        <div id="spinDot" className="w-2 h-2 rounded-full bg-red-600"></div>
      </div>
    </div>
  );
}
