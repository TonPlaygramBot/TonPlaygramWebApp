import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

import {
  buildDominoArena,
  DOMINO_TABLE_DIMENSIONS,
  DOMINO_CAMERA_CONFIG
} from '../utils/dominoArena.js';
import { applyRendererSRGB } from '../utils/colorSpace.js';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const SNAKE_BOARD_TILES = 10;
const SNAKE_BOARD_SIZE = DOMINO_TABLE_DIMENSIONS.playfieldSize * 0.5;

const CAMERA_INITIAL_RADIUS_FACTOR = 1.35;
const CAMERA_INITIAL_PHI_LERP = 0.42;
const CAM = {
  fov: DOMINO_CAMERA_CONFIG.fov,
  near: DOMINO_CAMERA_CONFIG.near,
  far: DOMINO_CAMERA_CONFIG.far,
  minR: DOMINO_CAMERA_CONFIG.minRadius,
  maxR: DOMINO_CAMERA_CONFIG.maxRadius,
  phiMin: Math.PI * 0.38,
  phiMax: DOMINO_CAMERA_CONFIG.maxPolarAngle
};
const TILE_GAP = 0.015;
const TILE_SIZE = SNAKE_BOARD_SIZE / SNAKE_BOARD_TILES;
const MAX_DICE = 2;
const DICE_SIZE = TILE_SIZE * 0.45;
const DICE_CORNER_RADIUS = DICE_SIZE * 0.18;
const DICE_PIP_RADIUS = DICE_SIZE * 0.093;
const DICE_PIP_DEPTH = DICE_SIZE * 0.018;
const DICE_PIP_SPREAD = DICE_SIZE * 0.3;
const DICE_FACE_INSET = DICE_SIZE * 0.064;
const DICE_ROLL_DURATION = 900;
const DICE_SETTLE_DURATION = 360;
const DICE_BOUNCE_HEIGHT = DICE_SIZE * 0.6;
const BOARD_BASE_EXTRA = SNAKE_BOARD_SIZE * (0.28 / 3.4);
const BOARD_BASE_HEIGHT = SNAKE_BOARD_SIZE * (0.22 / 3.4);

const TILE_COLOR_A = new THREE.Color(0xe7e2d3);
const TILE_COLOR_B = new THREE.Color(0x776a5a);
const HIGHLIGHT_COLORS = {
  normal: new THREE.Color(0xf59e0b),
  snake: new THREE.Color(0xdc2626),
  ladder: new THREE.Color(0x22c55e)
};

const TOKEN_RADIUS = TILE_SIZE * 0.2;
const TOKEN_HEIGHT = TILE_SIZE * 0.32;
const TILE_LABEL_OFFSET = TILE_SIZE * 0.0004;

const DEFAULT_COLORS = ['#f97316', '#22d3ee', '#22c55e', '#a855f7'];

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

function setDiceOrientation(dice, val) {
  const orientations = {
    1: new THREE.Euler(0, 0, 0),
    2: new THREE.Euler(-Math.PI / 2, 0, 0),
    3: new THREE.Euler(0, 0, -Math.PI / 2),
    4: new THREE.Euler(0, 0, Math.PI / 2),
    5: new THREE.Euler(Math.PI / 2, 0, 0),
    6: new THREE.Euler(Math.PI, 0, 0)
  };
  const euler = orientations[val] || orientations[1];
  const q = new THREE.Quaternion().setFromEuler(euler);
  dice.setRotationFromQuaternion(q);
}

function makeDice() {
  const dice = new THREE.Group();

  const dieMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0.24,
    roughness: 0.36,
    clearcoat: 1,
    clearcoatRoughness: 0.18,
    reflectivity: 0.72,
    envMapIntensity: 1.2
  });

  const pipMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x111111,
    roughness: 0.06,
    metalness: 0.5,
    clearcoat: 0.8,
    clearcoatRoughness: 0.06,
    envMapIntensity: 1
  });

  const body = new THREE.Mesh(
    new RoundedBoxGeometry(DICE_SIZE, DICE_SIZE, DICE_SIZE, 6, DICE_CORNER_RADIUS),
    dieMaterial
  );
  body.castShadow = true;
  body.receiveShadow = true;
  dice.add(body);

  const pipGeo = new THREE.SphereGeometry(
    DICE_PIP_RADIUS,
    36,
    24,
    0,
    Math.PI * 2,
    0,
    Math.PI / 2
  );
  pipGeo.rotateX(Math.PI);
  pipGeo.computeVertexNormals();
  const half = DICE_SIZE / 2;
  const faceDepth = half - DICE_FACE_INSET * 0.6;
  const spread = DICE_PIP_SPREAD;

  const faces = [
    { normal: new THREE.Vector3(0, 1, 0), points: [[0, 0]] },
    {
      normal: new THREE.Vector3(0, 0, 1),
      points: [
        [-spread, -spread],
        [spread, spread]
      ]
    },
    {
      normal: new THREE.Vector3(1, 0, 0),
      points: [
        [-spread, -spread],
        [0, 0],
        [spread, spread]
      ]
    },
    {
      normal: new THREE.Vector3(-1, 0, 0),
      points: [
        [-spread, -spread],
        [-spread, spread],
        [spread, -spread],
        [spread, spread]
      ]
    },
    {
      normal: new THREE.Vector3(0, 0, -1),
      points: [
        [-spread, -spread],
        [-spread, spread],
        [0, 0],
        [spread, -spread],
        [spread, spread]
      ]
    },
    {
      normal: new THREE.Vector3(0, -1, 0),
      points: [
        [-spread, -spread],
        [-spread, 0],
        [-spread, spread],
        [spread, -spread],
        [spread, 0],
        [spread, spread]
      ]
    }
  ];

  faces.forEach(({ normal, points }) => {
    const n = normal.clone().normalize();
    const helper = Math.abs(n.y) > 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
    const xAxis = new THREE.Vector3().crossVectors(helper, n).normalize();
    const yAxis = new THREE.Vector3().crossVectors(n, xAxis).normalize();

    points.forEach(([gx, gy]) => {
      const base = new THREE.Vector3()
        .addScaledVector(xAxis, gx)
        .addScaledVector(yAxis, gy)
        .addScaledVector(n, faceDepth - DICE_PIP_DEPTH * 0.5);

      const pip = new THREE.Mesh(pipGeo, pipMaterial);
      pip.castShadow = true;
      pip.receiveShadow = true;
      pip.position.copy(base).addScaledVector(n, DICE_PIP_DEPTH);
      pip.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n));
      dice.add(pip);
    });
  });

  dice.userData.setValue = (val) => {
    dice.userData.currentValue = val;
    setDiceOrientation(dice, val);
  };
  dice.userData.currentValue = 1;
  return dice;
}

function createDiceRollAnimation(diceArray, { basePositions, baseY }) {
  const start = performance.now();
  const offsets = diceArray.map(() =>
    new THREE.Vector3((Math.random() - 0.5) * DICE_SIZE * 0.35, 0, (Math.random() - 0.5) * DICE_SIZE * 0.35)
  );
  const spinVecs = diceArray.map(
    () =>
      new THREE.Vector3(
        0.45 + Math.random() * 0.55,
        0.6 + Math.random() * 0.65,
        0.4 + Math.random() * 0.55
      )
  );
  return {
    update: (now) => {
      const t = Math.min((now - start) / DICE_ROLL_DURATION, 1);
      const bounce = Math.sin(t * Math.PI) * DICE_BOUNCE_HEIGHT;
      diceArray.forEach((die, index) => {
        const base = basePositions[index];
        if (!base) return;
        die.position.x = base.x + offsets[index].x * Math.sin(t * Math.PI * 0.6);
        die.position.z = base.z + offsets[index].z * Math.sin(t * Math.PI * 0.6);
        die.position.y = baseY + bounce;
        die.rotation.x += spinVecs[index].x;
        die.rotation.y += spinVecs[index].y;
        die.rotation.z += spinVecs[index].z;
      });
      if (t >= 1) {
        diceArray.forEach((die, index) => {
          const base = basePositions[index];
          if (!base) return;
          die.position.set(base.x, baseY, base.z);
        });
        return true;
      }
      return false;
    }
  };
}

function createDiceSettleAnimation(diceArray, { basePositions, baseY }) {
  const start = performance.now();
  return {
    update: (now) => {
      const t = Math.min((now - start) / DICE_SETTLE_DURATION, 1);
      const ease = easeOutCubic(t);
      diceArray.forEach((die, index) => {
        const base = basePositions[index];
        if (!base) return;
        const wobble = Math.sin((1 - ease) * Math.PI) * (DICE_BOUNCE_HEIGHT * 0.18);
        die.position.set(base.x, baseY + wobble, base.z);
      });
      if (t >= 1) {
        diceArray.forEach((die, index) => {
          const base = basePositions[index];
          if (!base) return;
          die.position.set(base.x, baseY, base.z);
        });
        return true;
      }
      return false;
    }
  };
}

function createTileLabel(number) {
  const size = 256;
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
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1
  });
  const planeSize = TILE_SIZE * 0.58;
  const geometry = new THREE.PlaneGeometry(planeSize, planeSize);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 10;
  mesh.rotation.x = -Math.PI / 2;
  mesh.userData = { texture, geometry };
  return mesh;
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
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.enableZoom = true;
  controls.minPolarAngle = CAM.phiMin;
  controls.maxPolarAngle = CAM.phiMax;

  const cameraOffset = new THREE.Vector3().setFromSpherical(
    new THREE.Spherical(
      Math.max(SNAKE_BOARD_SIZE * CAMERA_INITIAL_RADIUS_FACTOR, CAM.minR),
      THREE.MathUtils.lerp(CAM.phiMin, CAM.phiMax, CAMERA_INITIAL_PHI_LERP),
      Math.PI * 0.25
    )
  );

  camera.position.copy(boardLookTarget).add(cameraOffset);
  controls.target.copy(boardLookTarget);
  controls.minDistance = CAM.minR;
  controls.maxDistance = CAM.maxR;
  controls.update();

  const ensureMinDistance = () => {
    const needed =
      SNAKE_BOARD_SIZE / (2 * Math.tan(THREE.MathUtils.degToRad(CAM.fov) / 2));
    const minDistance = clamp(Math.max(needed, CAM.minR), CAM.minR, CAM.maxR);
    controls.minDistance = minDistance;
    controls.maxDistance = CAM.maxR;
    const currentOffset = camera.position.clone().sub(boardLookTarget);
    const currentDistance = currentOffset.length();
    if (currentDistance < minDistance) {
      currentOffset.normalize().multiplyScalar(minDistance);
      camera.position.copy(boardLookTarget).add(currentOffset);
      controls.update();
      cameraOffset.copy(currentOffset);
    }
  };

  const fit = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h || 1;
    camera.updateProjectionMatrix();
    ensureMinDistance();
    const needed =
      SNAKE_BOARD_SIZE / (2 * Math.tan(THREE.MathUtils.degToRad(CAM.fov) / 2));
    const minDistance = controls.minDistance;
    const currentRadius = camera.position.distanceTo(boardLookTarget);
    const radius = clamp(Math.max(needed, currentRadius), minDistance, CAM.maxR);
    const dir = camera.position.clone().sub(boardLookTarget).normalize();
    camera.position.copy(boardLookTarget).addScaledVector(dir, radius);
    controls.update();
  };

  fit();

  const updateCameraOffset = () => {
    cameraOffset.copy(camera.position).sub(boardLookTarget);
  };

  updateCameraOffset();
  controls.addEventListener('change', updateCameraOffset);

  cameraRef.current = camera;

  disposeHandlers.push(() => {
    controls.removeEventListener('change', updateCameraOffset);
    controls.dispose();
  });

  const updateCameraTarget = () => {
    camera.position.copy(boardLookTarget).add(cameraOffset);
    controls.target.copy(boardLookTarget);
    ensureMinDistance();
    controls.update();
    updateCameraOffset();
  };

  return { boardGroup, boardLookTarget, fit, updateCameraTarget, controls };
}

function buildSnakeBoard(
  boardGroup,
  boardLookTarget,
  disposeHandlers = [],
  onTargetChange = null
) {
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
  const tileHeight = TILE_SIZE * 0.024;
  const tileGeo = new THREE.BoxGeometry(
    TILE_SIZE - TILE_GAP,
    tileHeight,
    TILE_SIZE - TILE_GAP
  );

  const labelGroup = new THREE.Group();
  labelGroup.position.y = tileGroup.position.y + tileHeight + TILE_LABEL_OFFSET;
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

  const diceGroup = new THREE.Group();
  const diceBaseY = tileGroup.position.y + tileHeight + DICE_SIZE * 0.5 + TILE_SIZE * 0.02;
  const diceAnchorZ = -half + TILE_SIZE * 1.25;
  const diceSpacing = DICE_SIZE * 1.35;
  const diceSet = [];
  for (let i = 0; i < MAX_DICE; i += 1) {
    const die = makeDice();
    die.visible = true;
    const offsetX = (i - (MAX_DICE - 1) / 2) * diceSpacing;
    die.position.set(offsetX, diceBaseY, diceAnchorZ);
    diceGroup.add(die);
    diceSet.push(die);
  }
  boardRoot.add(diceGroup);

  const diceLightTarget = new THREE.Object3D();
  diceLightTarget.position.set(0, diceBaseY, diceAnchorZ);
  boardRoot.add(diceLightTarget);

  const diceAccent = new THREE.SpotLight(0xffffff, 2.1, SNAKE_BOARD_SIZE * 1.2, Math.PI / 5, 0.42, 1.25);
  diceAccent.userData.offset = new THREE.Vector3(DICE_SIZE * 2.6, DICE_SIZE * 7.5, DICE_SIZE * 3.4);
  diceAccent.target = diceLightTarget;
  boardRoot.add(diceAccent);

  const diceFill = new THREE.PointLight(0xfff8e1, 1.05, SNAKE_BOARD_SIZE * 0.9, 2.2);
  diceFill.userData.offset = new THREE.Vector3(-DICE_SIZE * 3.2, DICE_SIZE * 6.2, -DICE_SIZE * 3.6);
  boardRoot.add(diceFill);

  disposeHandlers.push(() => {
    labelGroup.children.forEach((sprite) => {
      if (sprite.material?.map) sprite.material.map.dispose();
      sprite.material?.dispose?.();
      sprite.geometry?.dispose?.();
    });
  });

  if (boardLookTarget) {
    boardGroup.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(boardRoot);
    const center = new THREE.Vector3();
    bounds.getCenter(center);
    center.y = bounds.max.y + 0.12;
    boardLookTarget.copy(center);
    onTargetChange?.();
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
    labelGroup,
    diceGroup,
    diceSet,
    diceBaseY,
    diceAnchorZ,
    diceLights: {
      accent: diceAccent,
      fill: diceFill,
      target: diceLightTarget
    }
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
      token.userData = { playerIndex: index, material, isSliding: false };
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
    if (!token.userData.isSliding) {
      worldPos.x += offsetX;
      worldPos.z += offsetZ;
      worldPos.y += TOKEN_HEIGHT * 0.02;
      token.position.copy(worldPos);
    }
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

  group.userData.paths = new Map();

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

      const ladderCurve = new THREE.LineCurve3(
        A.clone().add(new THREE.Vector3(0, TILE_SIZE * 0.1, 0)),
        B.clone().add(new THREE.Vector3(0, TILE_SIZE * 0.1, 0))
      );
      group.userData.paths.set(start, {
        curve: ladderCurve,
        start: A.clone(),
        end: B.clone()
      });
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

  group.userData.paths = new Map();

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

    group.userData.paths.set(start, {
      curve: fullCurve.clone(),
      start: A.clone(),
      end: B.clone()
    });

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
  burning = [],
  slide,
  onSlideComplete,
  diceEvent
}) {
  const mountRef = useRef(null);
  const cameraRef = useRef(null);
  const boardRef = useRef(null);
  const fitRef = useRef(() => {});
  const disposeHandlers = useRef([]);
  const railTextureRef = useRef(null);
  const snakeTextureRef = useRef(null);
  const animationsRef = useRef([]);
  const diceStateRef = useRef({ currentId: null, basePositions: [], baseY: 0, count: 0 });

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
    const board = buildSnakeBoard(
      arena.boardGroup,
      arena.boardLookTarget,
      handlers,
      arena.updateCameraTarget
    );
    boardRef.current = {
      ...board,
      boardLookTarget: arena.boardLookTarget,
      controls: arena.controls
    };

    railTextureRef.current = makeRailTexture();
    snakeTextureRef.current = makeSnakeTexture();

    fitRef.current = arena.fit;
    arena.fit();

    renderer.setAnimationLoop((time) => {
      const now = typeof time === 'number' ? time : performance.now();
      const active = animationsRef.current;
      for (let i = active.length - 1; i >= 0; i -= 1) {
        const anim = active[i];
        if (!anim || typeof anim.update !== 'function') {
          active.splice(i, 1);
          continue;
        }
        try {
          const done = anim.update(now);
          if (done) active.splice(i, 1);
        } catch (error) {
          console.warn('Snake animation error', error);
          active.splice(i, 1);
        }
      }
      const board = boardRef.current;
      if (board?.diceLights && board?.diceSet?.length) {
        const center = new THREE.Vector3();
        let visibleCount = 0;
        board.diceSet.forEach((die) => {
          if (!die.visible) return;
          center.add(die.position);
          visibleCount += 1;
        });
        if (visibleCount > 0) {
          center.multiplyScalar(1 / visibleCount);
          const { accent, fill, target } = board.diceLights;
          if (target) target.position.copy(center);
          if (accent?.userData?.offset) {
            accent.position.copy(center).add(accent.userData.offset);
          }
          if (fill?.userData?.offset) {
            fill.position.copy(center).add(fill.userData.offset);
          }
        }
      }
      arena.controls?.update?.();
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
    if (!slide || !boardRef.current) return;
    const board = boardRef.current;
    const tokensGroup = board.tokensGroup;
    if (!tokensGroup) {
      onSlideComplete?.(slide.id, false);
      return;
    }
    const token = tokensGroup.children.find((child) => child.userData?.playerIndex === slide.playerIndex);
    if (!token) {
      onSlideComplete?.(slide.id, false);
      return;
    }
    const pathMap =
      slide.type === 'ladder'
        ? board.laddersGroup?.userData?.paths
        : board.snakesGroup?.userData?.paths;
    const startBase = (board.indexToPosition.get(slide.from) || board.serpentineIndexToXZ(slide.from)).clone();
    const endBase = (board.indexToPosition.get(slide.to) || board.serpentineIndexToXZ(slide.to)).clone();
    startBase.y = startBase.y ?? tokensGroup.position.y;
    endBase.y = endBase.y ?? tokensGroup.position.y;
    let pathInfo = pathMap?.get(slide.from);
    if (!pathInfo) {
      const fallbackCurve = new THREE.LineCurve3(startBase.clone(), endBase.clone());
      pathInfo = { curve: fallbackCurve, start: startBase.clone(), end: endBase.clone() };
    }
    const curve = pathInfo.curve;
    token.userData.isSliding = true;
    const duration = 1100;
    const startTime = performance.now();
    const lift = TOKEN_HEIGHT * 0.6;
    animationsRef.current.push({
      update: (now) => {
        const t = Math.min((now - startTime) / duration, 1);
        let pos;
        if (t < 0.18) {
          const local = easeInOut(t / 0.18);
          const target = curve.getPoint(0).clone().add(new THREE.Vector3(0, lift, 0));
          pos = startBase.clone().lerp(target, local);
        } else if (t < 0.9) {
          const local = easeInOut((t - 0.18) / 0.72);
          pos = curve.getPoint(local).clone().add(new THREE.Vector3(0, lift * 0.4, 0));
        } else {
          const local = easeOutCubic((t - 0.9) / 0.1);
          const from = curve.getPoint(1).clone().add(new THREE.Vector3(0, lift * 0.25, 0));
          pos = from.lerp(endBase, Math.min(1, local));
        }
        token.position.copy(pos);
        if (t >= 1) {
          token.userData.isSliding = false;
          token.position.copy(endBase);
          onSlideComplete?.(slide.id, true);
          return true;
        }
        return false;
      }
    });
  }, [slide, onSlideComplete]);

  useEffect(() => {
    if (!diceEvent || !boardRef.current) return;
    const board = boardRef.current;
    const diceSet = board.diceSet || [];
    if (!diceSet.length) return;
    const diceBaseY = board.diceBaseY ?? 0;
    const diceAnchorZ = board.diceAnchorZ ?? 0;
    if (diceEvent.phase === 'start') {
      const count = Math.max(1, Math.min(diceEvent.count ?? diceSet.length, diceSet.length));
      const spacing = DICE_SIZE * 1.35;
      const centerOffset = (count - 1) / 2;
      const basePositions = [];
      diceSet.forEach((die, index) => {
        const visible = index < count;
        die.visible = visible;
        if (visible) {
          const offsetX = (index - centerOffset) * spacing;
          die.position.set(offsetX, diceBaseY, diceAnchorZ);
          basePositions.push(die.position.clone());
        }
      });
      diceStateRef.current = {
        currentId: diceEvent.id,
        basePositions,
        baseY: diceBaseY,
        count
      };
      const active = diceSet.filter((_, idx) => idx < count);
      if (active.length) {
        animationsRef.current.push(
          createDiceRollAnimation(active, {
            basePositions: active.map((die) => die.position.clone()),
            baseY: diceBaseY
          })
        );
      }
    } else if (diceEvent.phase === 'end') {
      if (diceStateRef.current.currentId !== diceEvent.id) return;
      const values = diceEvent.values || [];
      const active = diceSet.filter((die) => die.visible);
      if (active.length) {
        active.forEach((die, index) => {
          const value = values[index] ?? values[values.length - 1] ?? 1;
          die.userData.setValue?.(value);
        });
        animationsRef.current.push(
          createDiceSettleAnimation(active, {
            basePositions: active.map((die) => die.position.clone()),
            baseY: diceBaseY
          })
        );
      }
      diceStateRef.current = { currentId: null, basePositions: [], baseY: diceBaseY, count: 0 };
    }
  }, [diceEvent]);

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
