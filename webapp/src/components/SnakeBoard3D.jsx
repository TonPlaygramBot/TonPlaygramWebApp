import { useEffect, useRef } from 'react';
import * as THREE from 'three';

import {
  buildDominoArena,
  DOMINO_TABLE_DIMENSIONS,
  DOMINO_CAMERA_CONFIG
} from '../utils/dominoArena.js';
import { applyRendererSRGB } from '../utils/colorSpace.js';
import { ARENA_CAMERA_DEFAULTS } from '../utils/arenaCameraConfig.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const SNAKE_BOARD_TILES = 10;
const SNAKE_BOARD_SIZE = DOMINO_TABLE_DIMENSIONS.playfieldSize * 0.5;

const CAMERA_INITIAL_RADIUS_FACTOR = ARENA_CAMERA_DEFAULTS.initialRadiusFactor;
const CAMERA_INITIAL_PHI_LERP = ARENA_CAMERA_DEFAULTS.initialPhiLerp;
const CAMERA_VERTICAL_SENSITIVITY = ARENA_CAMERA_DEFAULTS.verticalSensitivity;
const CAMERA_LEAN_STRENGTH = ARENA_CAMERA_DEFAULTS.leanStrength;
const CAMERA_WHEEL_FACTOR = ARENA_CAMERA_DEFAULTS.wheelDeltaFactor;
const CAM = {
  fov: DOMINO_CAMERA_CONFIG.fov,
  near: DOMINO_CAMERA_CONFIG.near,
  far: DOMINO_CAMERA_CONFIG.far,
  minR: DOMINO_CAMERA_CONFIG.minRadius,
  maxR: DOMINO_CAMERA_CONFIG.maxRadius,
  phiMin: ARENA_CAMERA_DEFAULTS.phiMin,
  phiMax: DOMINO_CAMERA_CONFIG.maxPolarAngle
};
const TILE_GAP = 0.015;
const TILE_SIZE = SNAKE_BOARD_SIZE / SNAKE_BOARD_TILES;
const BOARD_BASE_EXTRA = SNAKE_BOARD_SIZE * (0.28 / 3.4);
const BOARD_BASE_HEIGHT = SNAKE_BOARD_SIZE * (0.22 / 3.4);

const TILE_COLOR_A = new THREE.Color(0x1e293b);
const TILE_COLOR_B = new THREE.Color(0x0ea5e9);
const HIGHLIGHT_COLORS = {
  normal: new THREE.Color(0xf59e0b),
  snake: new THREE.Color(0xdc2626),
  ladder: new THREE.Color(0x22c55e)
};

const TOKEN_RADIUS = TILE_SIZE * 0.2;
const TOKEN_HEIGHT = TILE_SIZE * 0.32;

const DEFAULT_COLORS = ['#f97316', '#22d3ee', '#22c55e', '#a855f7'];

function createTileLabel(number) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  const text = String(number);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${size * 0.55}px 'Inter', 'Segoe UI', sans-serif`;
  ctx.lineWidth = size * 0.08;
  ctx.strokeStyle = 'rgba(15,23,42,0.85)';
  ctx.strokeText(text, size / 2, size / 2);
  ctx.fillStyle = '#f8fafc';
  ctx.fillText(text, size / 2, size / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  const scale = TILE_SIZE * 0.45;
  sprite.scale.set(scale, scale, 1);
  sprite.userData = { texture };
  return sprite;
}

function makeRailTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#b08968';
  ctx.fillRect(0, 0, 128, 64);
  ctx.fillStyle = '#8b5e34';
  for (let i = 0; i < 16; i++) {
    ctx.fillRect(0, i * 4 + (i % 2 ? 1 : 0), 128, 2);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let i = 0; i < 12; i++) {
    ctx.fillRect(0, i * 6, 128, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 1);
  return tex;
}

function makeSnakeTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0f5132';
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = '#198754';
  const diamond = (cx, cy, w, h) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy - h);
    ctx.lineTo(cx + w, cy);
    ctx.lineTo(cx, cy + h);
    ctx.lineTo(cx - w, cy);
    ctx.closePath();
    ctx.fill();
  };
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 32; x++) {
      const cx = x * 8 + ((y % 2) * 4);
      const cy = y * 8 + 4;
      diamond(cx, cy, 6, 4);
    }
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  for (let y = 0; y <= 128; y += 8) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(256, y + 0.5);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 2);
  tex.anisotropy = 4;
  return tex;
}

function makeRoundedBoxGeometry(w, h, d, r, seg = 4) {
  const geo = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const hw = w / 2;
  const hh = h / 2;
  const hd = d / 2;
  const irx = hw - r;
  const iry = hh - r;
  const irz = hd - r;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const cx = THREE.MathUtils.clamp(v.x, -irx, irx);
    const cy = THREE.MathUtils.clamp(v.y, -iry, iry);
    const cz = THREE.MathUtils.clamp(v.z, -irz, irz);
    const delta = new THREE.Vector3(v.x - cx, v.y - cy, v.z - cz);
    const l = delta.length();
    if (l > 0) {
      delta.normalize().multiplyScalar(r);
      v.set(cx + delta.x, cy + delta.y, cz + delta.z);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function parseJumpMap(data = {}) {
  const entries = [];
  Object.entries(data).forEach(([start, value]) => {
    const s = Number(start);
    if (!Number.isFinite(s)) return;
    if (typeof value === 'number') {
      entries.push([s, value]);
    } else if (value && typeof value === 'object') {
      const end = Number(value.end ?? value.target ?? value.to ?? value);
      if (Number.isFinite(end)) entries.push([s, end]);
    }
  });
  return entries;
}

function buildArena(scene, renderer, host, cameraRef, disposeHandlers) {
  const arenaSetup = buildDominoArena({ scene, renderer });
  if (arenaSetup?.dispose && disposeHandlers) {
    disposeHandlers.push(() => {
      try {
        arenaSetup.dispose();
      } catch (error) {
        console.warn('Failed to dispose Snake arena', error);
      }
    });
  }

  const boardGroup = new THREE.Group();
  boardGroup.position.set(0, 0.004, 0);
  if (arenaSetup?.boardAnchor) {
    arenaSetup.boardAnchor.add(boardGroup);
  } else if (arenaSetup?.arena) {
    arenaSetup.arena.add(boardGroup);
  } else {
    scene.add(boardGroup);
  }

  const boardLookTarget = new THREE.Vector3(
    0,
    DOMINO_CAMERA_CONFIG.targetY,
    0
  );

  const camera = new THREE.PerspectiveCamera(CAM.fov, 1, CAM.near, CAM.far);
  const initialRadius = Math.max(
    SNAKE_BOARD_SIZE * CAMERA_INITIAL_RADIUS_FACTOR,
    CAM.minR
  );
  const sph = new THREE.Spherical(
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
    const needed =
      SNAKE_BOARD_SIZE / (2 * Math.tan(THREE.MathUtils.degToRad(CAM.fov) / 2));
    sph.radius = clamp(Math.max(needed, sph.radius), CAM.minR, CAM.maxR);
    const offset = new THREE.Vector3().setFromSpherical(sph);
    camera.position.copy(boardLookTarget).add(offset);
    camera.lookAt(boardLookTarget);
  };
  fit();

  cameraRef.current = camera;

  const drag = { on: false, x: 0, y: 0 };
  const dom = renderer.domElement;
  const onDown = (e) => {
    drag.on = true;
    drag.x = e.clientX || e.touches?.[0]?.clientX || 0;
    drag.y = e.clientY || e.touches?.[0]?.clientY || 0;
  };
  const onMove = (e) => {
    if (!drag.on) return;
    const x = e.clientX || e.touches?.[0]?.clientX || drag.x;
    const y = e.clientY || e.touches?.[0]?.clientY || drag.y;
    const dx = x - drag.x;
    const dy = y - drag.y;
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
    const r = sph.radius || initialRadius;
    sph.radius = clamp(r + e.deltaY * CAMERA_WHEEL_FACTOR, CAM.minR, CAM.maxR);
    fit();
  };
  dom.addEventListener('mousedown', onDown);
  dom.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  dom.addEventListener('touchstart', onDown, { passive: true });
  dom.addEventListener('touchmove', onMove, { passive: true });
  window.addEventListener('touchend', onUp);
  dom.addEventListener('wheel', onWheel, { passive: true });

  disposeHandlers.push(() => {
    dom.removeEventListener('mousedown', onDown);
    dom.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    dom.removeEventListener('touchstart', onDown);
    dom.removeEventListener('touchmove', onMove);
    window.removeEventListener('touchend', onUp);
    dom.removeEventListener('wheel', onWheel);
  });

  return { boardGroup, boardLookTarget, fit };
}

function buildSnakeBoard(boardGroup, boardLookTarget, disposeHandlers = []) {
  const boardRoot = new THREE.Group();
  boardGroup.add(boardRoot);

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(
      SNAKE_BOARD_SIZE + BOARD_BASE_EXTRA,
      BOARD_BASE_HEIGHT,
      SNAKE_BOARD_SIZE + BOARD_BASE_EXTRA
    ),
    new THREE.MeshStandardMaterial({
      color: 0x11172a,
      roughness: 0.9,
      metalness: 0.05
    })
  );
  base.position.y = BOARD_BASE_HEIGHT / 2 - 0.01;
  boardRoot.add(base);

  const tileGroup = new THREE.Group();
  tileGroup.position.y = BOARD_BASE_HEIGHT - 0.02;
  boardRoot.add(tileGroup);

  const tileMeshes = new Map();
  const indexToPosition = new Map();
  const tileHeight = 0.08;
  const tileGeo = new THREE.BoxGeometry(
    TILE_SIZE - TILE_GAP,
    tileHeight,
    TILE_SIZE - TILE_GAP
  );

  const labelGroup = new THREE.Group();
  labelGroup.position.y = tileGroup.position.y + tileHeight + 0.001;
  boardRoot.add(labelGroup);

  const half = (SNAKE_BOARD_TILES * TILE_SIZE) / 2;

  const mats = {
    even: new THREE.MeshStandardMaterial({
      color: TILE_COLOR_A,
      roughness: 0.8,
      metalness: 0.05
    }),
    odd: new THREE.MeshStandardMaterial({
      color: TILE_COLOR_B,
      roughness: 0.8,
      metalness: 0.05
    })
  };

  const serpentineIndexToXZ = (index) => {
    if (index < 1) {
      return new THREE.Vector3(-half - TILE_SIZE * 0.8, 0, -half - TILE_SIZE * 0.6);
    }
    const n = Math.min(index, SNAKE_BOARD_TILES * SNAKE_BOARD_TILES);
    const r = Math.floor((n - 1) / SNAKE_BOARD_TILES);
    const rr = SNAKE_BOARD_TILES - 1 - r;
    const inRow = (n - 1) % SNAKE_BOARD_TILES;
    const c = r % 2 === 0 ? inRow : SNAKE_BOARD_TILES - 1 - inRow;
    const x = -half + (c + 0.5) * TILE_SIZE;
    const z = -half + (rr + 0.5) * TILE_SIZE;
    return new THREE.Vector3(x, 0, z);
  };

  for (let r = 0; r < SNAKE_BOARD_TILES; r++) {
    for (let c = 0; c < SNAKE_BOARD_TILES; c++) {
      const idx = r * SNAKE_BOARD_TILES + c + 1;
      const mat = (r + c) % 2 === 0 ? mats.even.clone() : mats.odd.clone();
      const tile = new THREE.Mesh(tileGeo, mat);
      const pos = serpentineIndexToXZ(idx);
      tile.position.set(pos.x, tileGroup.position.y + tileHeight / 2, pos.z);
      tile.userData.index = idx;
      tile.userData.baseColor = tile.material.color.clone();
      tile.material.emissive = new THREE.Color(0x000000);
      tile.material.emissiveIntensity = 1.0;
      tileGroup.add(tile);
      tileMeshes.set(idx, tile);
      indexToPosition.set(idx, pos.clone().setY(tile.position.y + tileHeight / 2));

      const label = createTileLabel(idx);
      label.position.set(pos.x, labelGroup.position.y, pos.z);
      labelGroup.add(label);
    }
  }

  const laddersGroup = new THREE.Group();
  laddersGroup.position.y = tileGroup.position.y + tileHeight / 2;
  boardRoot.add(laddersGroup);

  const snakesGroup = new THREE.Group();
  snakesGroup.position.y = tileGroup.position.y + tileHeight / 2;
  boardRoot.add(snakesGroup);

  const tokensGroup = new THREE.Group();
  tokensGroup.position.y = tileGroup.position.y + tileHeight;
  boardRoot.add(tokensGroup);

  const potGroup = new THREE.Group();
  const coin = new THREE.Mesh(
    new THREE.CylinderGeometry(TILE_SIZE * 0.24, TILE_SIZE * 0.24, TILE_SIZE * 0.12, 32),
    new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.3,
      metalness: 0.4,
      emissive: 0x332200,
      emissiveIntensity: 0.25
    })
  );
  coin.rotation.x = Math.PI / 2;
  potGroup.add(coin);
  const potPos = serpentineIndexToXZ(SNAKE_BOARD_TILES * SNAKE_BOARD_TILES);
  potGroup.position.set(potPos.x, tileGroup.position.y + tileHeight + TILE_SIZE * 0.1, potPos.z);
  boardRoot.add(potGroup);

  disposeHandlers.push(() => {
    labelGroup.children.forEach((sprite) => {
      if (sprite.material?.map) sprite.material.map.dispose();
      sprite.material?.dispose?.();
    });
  });

  if (boardLookTarget) {
    boardGroup.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(boardRoot);
    const center = new THREE.Vector3();
    bounds.getCenter(center);
    center.y = bounds.max.y + 0.12;
    boardLookTarget.copy(center);
  }

  return {
    root: boardRoot,
    tileMeshes,
    indexToPosition,
    laddersGroup,
    snakesGroup,
    tokensGroup,
    serpentineIndexToXZ,
    potGroup,
    labelGroup
  };
}

function updateTilesHighlight(tileMeshes, highlight, trail) {
  tileMeshes.forEach((tile) => {
    tile.material.color.copy(tile.userData.baseColor);
    tile.material.emissive.setRGB(0, 0, 0);
  });
  if (trail?.length) {
    trail.forEach((segment) => {
      const tile = tileMeshes.get(segment.cell);
      if (!tile) return;
      const color = HIGHLIGHT_COLORS[segment.type] ?? HIGHLIGHT_COLORS.normal;
      tile.material.emissive.copy(color).multiplyScalar(0.35);
    });
  }
  if (highlight) {
    const tile = tileMeshes.get(highlight.cell);
    if (tile) {
      const color = HIGHLIGHT_COLORS[highlight.type] ?? HIGHLIGHT_COLORS.normal;
      tile.material.emissive.copy(color);
    }
  }
}

function updateTokens(
  tokensGroup,
  players,
  indexToPosition,
  serpentineIndexToXZ,
  { burning = [], rollingIndex = null, currentTurn = null } = {}
) {
  if (!tokensGroup) return;
  const existing = new Map();
  tokensGroup.children.forEach((child) => {
    if (child.userData && child.userData.playerIndex != null) {
      existing.set(child.userData.playerIndex, child);
    }
  });

  const occupancy = new Map();
  players.forEach((player, index) => {
    const key = player.position || 0;
    if (!occupancy.has(key)) occupancy.set(key, []);
    occupancy.get(key).push(index);
  });

  const keep = new Set();

  players.forEach((player, index) => {
    keep.add(index);
    let token = existing.get(index);
    if (!token) {
      token = new THREE.Group();
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(player.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]),
        roughness: 0.4,
        metalness: 0.2
      });
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(TOKEN_RADIUS * 1.1, TOKEN_RADIUS * 1.2, TOKEN_HEIGHT * 0.65, 24),
        material
      );
      base.position.y = TOKEN_HEIGHT * 0.32;
      token.add(base);
      const head = new THREE.Mesh(new THREE.SphereGeometry(TOKEN_RADIUS * 0.9, 18, 14), material);
      head.position.y = TOKEN_HEIGHT * 0.95;
      token.add(head);
      token.userData = { playerIndex: index, material };
      tokensGroup.add(token);
    }
    const mat = token.userData.material;
    const targetColor = new THREE.Color(player.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]);
    mat.color.copy(targetColor);
    if (burning.includes(index)) {
      mat.emissive.setHex(0x7f1d1d);
    } else if (index === rollingIndex) {
      mat.emissive.setHex(0x0ea5e9);
    } else if (index === currentTurn) {
      mat.emissive.setHex(0x1d4ed8);
    } else {
      mat.emissive.setHex(0x000000);
    }

    const positionIndex = player.position;
    const tilePlayers = occupancy.get(positionIndex || 0) || [];
    const offsetIndex = tilePlayers.indexOf(index);
    const radius = TOKEN_RADIUS * 1.2;
    const angle = (offsetIndex / Math.max(1, tilePlayers.length)) * Math.PI * 2;
    const offsetX = Math.cos(angle) * radius;
    const offsetZ = Math.sin(angle) * radius;

    const basePos = indexToPosition.get(positionIndex);
    const worldPos = basePos
      ? basePos.clone()
      : serpentineIndexToXZ(positionIndex).clone().setY(tokensGroup.position.y);
    worldPos.x += offsetX;
    worldPos.z += offsetZ;
    worldPos.y += TOKEN_HEIGHT * 0.02;

    token.position.copy(worldPos);
  });

  existing.forEach((group, index) => {
    if (!keep.has(index)) {
      tokensGroup.remove(group);
      group.traverse((obj) => {
        if (obj.isMesh) {
          obj.geometry.dispose();
          obj.material.dispose();
        }
      });
    }
  });
}

function updateLadders(group, ladders, indexToPosition, serpentineIndexToXZ, railTexture) {
  while (group.children.length) {
    const child = group.children.pop();
    if (child) {
      child.traverse?.((o) => {
        if (o.isMesh) {
          o.geometry.dispose();
          if (Array.isArray(o.material)) {
            o.material.forEach((m) => m.dispose?.());
          } else {
            o.material.dispose?.();
          }
        }
      });
    }
  }

  const matRail = new THREE.MeshStandardMaterial({
    map: railTexture,
    color: 0xffffff,
    roughness: 0.6,
    metalness: 0.05
  });
  const matRung = new THREE.MeshStandardMaterial({
    color: 0xeab308,
    roughness: 0.55,
    metalness: 0.05
  });

  parseJumpMap(ladders)
    .filter(([a, b]) => b > a)
    .forEach(([start, end]) => {
      const A = (indexToPosition.get(start) || serpentineIndexToXZ(start)).clone();
      const B = (indexToPosition.get(end) || serpentineIndexToXZ(end)).clone();
      const dir = B.clone().sub(A);
      const len = dir.length();
      const up = new THREE.Vector3(0, 1, 0);
      const right = new THREE.Vector3().crossVectors(dir.clone().normalize(), up).normalize();
      const railOffset = TILE_SIZE * 0.18;

      const railCurveA = new THREE.LineCurve3(
        A.clone().add(right.clone().multiplyScalar(-railOffset)),
        B.clone().add(right.clone().multiplyScalar(-railOffset))
      );
      const railCurveB = new THREE.LineCurve3(
        A.clone().add(right.clone().multiplyScalar(railOffset)),
        B.clone().add(right.clone().multiplyScalar(railOffset))
      );
      const railGeomA = new THREE.TubeGeometry(railCurveA, 1, TILE_SIZE * 0.05, 12, false);
      const railGeomB = new THREE.TubeGeometry(railCurveB, 1, TILE_SIZE * 0.05, 12, false);
      const railA = new THREE.Mesh(railGeomA, matRail.clone());
      const railB = new THREE.Mesh(railGeomB, matRail.clone());
      const repeat = Math.max(3, len / (TILE_SIZE * 0.5));
      railA.material.map.repeat.x = repeat;
      railB.material.map.repeat.x = repeat;
      group.add(railA, railB);

      const rungStep = TILE_SIZE * 0.55;
      const rungCount = Math.max(3, Math.floor(len / rungStep));
      for (let i = 1; i < rungCount; i++) {
        const t = i / rungCount;
        const pMid = A.clone().lerp(B, t);
        const rungGeom = new THREE.CylinderGeometry(TILE_SIZE * 0.04, TILE_SIZE * 0.04, railOffset * 2, 12);
        const rung = new THREE.Mesh(rungGeom, matRung);
        rung.position.copy(pMid);
        rung.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), right.clone());
        group.add(rung);
      }
    });
}

function updateSnakes(group, snakes, indexToPosition, serpentineIndexToXZ, snakeTexture) {
  while (group.children.length) {
    const child = group.children.pop();
    if (child) {
      child.traverse?.((o) => {
        if (o.isMesh) {
          o.geometry.dispose();
          if (Array.isArray(o.material)) {
            o.material.forEach((m) => m.dispose?.());
          } else {
            o.material.dispose?.();
          }
        }
      });
    }
  }

  const matBody = new THREE.MeshStandardMaterial({
    map: snakeTexture,
    color: 0xffffff,
    roughness: 0.45,
    metalness: 0.05
  });
  const matHead = new THREE.MeshStandardMaterial({
    color: 0x14532d,
    roughness: 0.4,
    metalness: 0.05
  });
  const matTail = new THREE.MeshStandardMaterial({
    color: 0x1b8060,
    roughness: 0.55,
    metalness: 0.05
  });
  const matTongue = new THREE.MeshStandardMaterial({
    color: 0xff0000,
    emissive: 0x440000,
    roughness: 0.3,
    metalness: 0.05
  });

  const entries = parseJumpMap(snakes).filter(([a, b]) => b < a);

  entries.forEach(([start, end]) => {
    const A = (indexToPosition.get(start) || serpentineIndexToXZ(start)).clone();
    const B = (indexToPosition.get(end) || serpentineIndexToXZ(end)).clone();
    const length = Math.abs(start - end);
    const mid = A.clone().lerp(B, 0.5);
    mid.y += TILE_SIZE * 0.8 + length * 0.01;
    const side = new THREE.Vector3(B.z - A.z, 0, -(B.x - A.x))
      .normalize()
      .multiplyScalar(TILE_SIZE * 0.3);
    const p0 = A.clone();
    const p1 = mid.add(side);
    const p2 = B.clone();
    const fullCurve = new THREE.CatmullRomCurve3([p0, p1, p2]);

    const bodyRadius = TILE_SIZE * 0.08;
    const mainCurve = sampleSubCurve(fullCurve, 0, 0.75, 24);
    const bodyMain = new THREE.Mesh(new THREE.TubeGeometry(mainCurve, 160, bodyRadius, 16, false), matBody.clone());
    const mainLen = A.distanceTo(fullCurve.getPoint(0.75));
    bodyMain.material.map.repeat.set(Math.max(4, Math.ceil(mainLen / (TILE_SIZE * 0.4))), 2);
    group.add(bodyMain);

    const tailSegments = [
      [0.75, 0.87, bodyRadius * 0.9],
      [0.87, 0.94, bodyRadius * 0.7],
      [0.94, 1.0, bodyRadius * 0.5]
    ];
    tailSegments.forEach(([t0, t1, r]) => {
      const segCurve = sampleSubCurve(fullCurve, t0, t1, 12);
      const seg = new THREE.Mesh(new THREE.TubeGeometry(segCurve, 64, r, 14, false), matBody.clone());
      seg.material.map.repeat.x = Math.max(2, Math.ceil((t1 - t0) * 20));
      group.add(seg);
    });

    const tA = fullCurve.getTangent(0).normalize();
    const tB = fullCurve.getTangent(1).normalize();

    const headGroup = new THREE.Group();
    const headR = bodyRadius * 1.15;
    const headGeom = new THREE.SphereGeometry(headR, 20, 16);
    const head = new THREE.Mesh(headGeom, matHead);
    headGroup.add(head);
    const hood = new THREE.Mesh(new THREE.CylinderGeometry(headR * 0.6, headR * 1.6, headR * 1.9, 20, 1, true), matHead);
    hood.rotation.x = Math.PI / 2;
    hood.position.z = -headR;
    headGroup.add(hood);
    const eyeGeom = new THREE.SphereGeometry(headR * 0.22, 12, 10);
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xffe066,
      emissive: 0x332200,
      roughness: 0.35
    });
    const eyeL = new THREE.Mesh(eyeGeom, eyeMat);
    const eyeR = eyeL.clone();
    eyeL.position.set(-headR * 0.45, headR * 0.33, headR * 0.4);
    eyeR.position.set(headR * 0.45, headR * 0.33, headR * 0.4);
    headGroup.add(eyeL, eyeR);
    const tongue = new THREE.Mesh(new THREE.CylinderGeometry(headR * 0.05, headR * 0.05, headR * 2.1, 8, 1), matTongue);
    tongue.rotation.x = Math.PI / 2;
    tongue.position.z = headR * 1.5;
    headGroup.add(tongue);
    const headPos = A.clone().add(tA.clone().multiplyScalar(headR * 0.8));
    headGroup.position.copy(headPos);
    headGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tA.clone());
    group.add(headGroup);

    const tailTip = new THREE.Mesh(new THREE.ConeGeometry(bodyRadius * 0.58, bodyRadius * 1.8, 12), matTail);
    tailTip.position.copy(B.clone());
    tailTip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tB.clone());
    group.add(tailTip);
  });
}

function sampleSubCurve(curve, t0, t1, samples = 20) {
  const pts = [];
  for (let i = 0; i <= samples; i++) {
    const t = THREE.MathUtils.lerp(t0, t1, i / samples);
    pts.push(curve.getPoint(t));
  }
  return new THREE.CatmullRomCurve3(pts);
}

export default function SnakeBoard3D({
  players = [],
  highlight,
  trail,
  pot,
  snakes,
  ladders,
  snakeOffsets,
  ladderOffsets,
  offsetPopup,
  celebrate,
  tokenType,
  rollingIndex,
  currentTurn,
  burning = []
}) {
  const mountRef = useRef(null);
  const cameraRef = useRef(null);
  const boardRef = useRef(null);
  const fitRef = useRef(() => {});
  const disposeHandlers = useRef([]);
  const railTextureRef = useRef(null);
  const snakeTextureRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    applyRendererSRGB(renderer);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.zIndex = '0';
    renderer.domElement.style.touchAction = 'none';
    mount.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xece6dc);

    const handlers = disposeHandlers.current;
    handlers.length = 0;

    const arena = buildArena(scene, renderer, mount, cameraRef, handlers);
    const board = buildSnakeBoard(arena.boardGroup, arena.boardLookTarget, handlers);
    boardRef.current = { ...board, boardLookTarget: arena.boardLookTarget };

    railTextureRef.current = makeRailTexture();
    snakeTextureRef.current = makeSnakeTexture();

    fitRef.current = arena.fit;
    arena.fit();

    renderer.setAnimationLoop(() => {
      if (cameraRef.current) {
        renderer.render(scene, cameraRef.current);
      }
    });

    const resizeObserver = new ResizeObserver(() => arena.fit());
    resizeObserver.observe(mount);

    return () => {
      resizeObserver.disconnect();
      renderer.setAnimationLoop(null);
      handlers.forEach((fn) => fn());
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
      railTextureRef.current?.dispose?.();
      snakeTextureRef.current?.dispose?.();
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj.isMesh) {
          obj.geometry?.dispose?.();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose?.());
          else obj.material?.dispose?.();
        }
      });
    };
  }, []);

  useEffect(() => {
    if (!boardRef.current) return;
    updateTilesHighlight(boardRef.current.tileMeshes, highlight, trail);
    if (offsetPopup) {
      const tile = boardRef.current.tileMeshes.get(offsetPopup.cell);
      if (tile) {
        const color = offsetPopup.type === 'snake' ? HIGHLIGHT_COLORS.snake : HIGHLIGHT_COLORS.ladder;
        tile.material.emissive.copy(color);
      }
    }
  }, [highlight, trail, offsetPopup]);

  useEffect(() => {
    if (!boardRef.current) return;
    updateTokens(
      boardRef.current.tokensGroup,
      players,
      boardRef.current.indexToPosition,
      boardRef.current.serpentineIndexToXZ,
      { burning, rollingIndex, currentTurn }
    );
  }, [players, burning, rollingIndex, currentTurn, tokenType]);

  useEffect(() => {
    if (!boardRef.current || !railTextureRef.current) return;
    updateLadders(
      boardRef.current.laddersGroup,
      ladders,
      boardRef.current.indexToPosition,
      boardRef.current.serpentineIndexToXZ,
      railTextureRef.current
    );
  }, [ladders, ladderOffsets]);

  useEffect(() => {
    if (!boardRef.current || !snakeTextureRef.current) return;
    updateSnakes(
      boardRef.current.snakesGroup,
      snakes,
      boardRef.current.indexToPosition,
      boardRef.current.serpentineIndexToXZ,
      snakeTextureRef.current
    );
  }, [snakes, snakeOffsets]);

  useEffect(() => {
    const handle = () => fitRef.current();
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);

  return (
    <div className="relative w-full h-full" data-snake-board-root>
      <div ref={mountRef} className="w-full h-full" />
      {celebrate && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-6xl animate-pulse">
          🎉
        </div>
      )}
      {pot != null && (
        <div className="absolute top-4 right-4 bg-slate-900/70 text-slate-100 text-xs px-3 py-2 rounded-xl">
          Pot: {pot}
        </div>
      )}
    </div>
  );
}
