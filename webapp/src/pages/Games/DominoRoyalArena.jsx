import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

import { createArenaCarpetMaterial, createArenaWallMaterial } from '../../utils/arenaDecor.js';
import { applyRendererSRGB } from '../../utils/colorSpace.js';
import { buildArenaCameraConfig } from '../../utils/arenaCameraConfig.js';
import {
  createMurlanStyleTable,
  applyTableMaterials,
  TABLE_SHAPE_OPTIONS
} from '../../utils/murlanTable.js';
import {
  TABLE_WOOD_OPTIONS,
  TABLE_CLOTH_OPTIONS,
  TABLE_BASE_OPTIONS
} from '../../utils/tableCustomizationOptions.js';

const MODEL_SCALE = 0.75;
const ARENA_GROWTH = 1.45;
const TABLE_RADIUS = 3.4 * MODEL_SCALE;
const BASE_TABLE_HEIGHT = 1.08 * MODEL_SCALE;
const STOOL_SCALE = 1.5 * 1.3;
const SEAT_WIDTH = 0.9 * MODEL_SCALE * STOOL_SCALE;
const SEAT_DEPTH = 0.95 * MODEL_SCALE * STOOL_SCALE;
const SEAT_THICKNESS = 0.09 * MODEL_SCALE * STOOL_SCALE;
const BACK_HEIGHT = 0.68 * MODEL_SCALE * STOOL_SCALE;
const BACK_THICKNESS = 0.08 * MODEL_SCALE * STOOL_SCALE;
const ARM_THICKNESS = 0.125 * MODEL_SCALE * STOOL_SCALE;
const ARM_HEIGHT = 0.3 * MODEL_SCALE * STOOL_SCALE;
const ARM_DEPTH = SEAT_DEPTH * 0.75;
const BASE_COLUMN_HEIGHT = 0.5 * MODEL_SCALE * STOOL_SCALE;
const CHAIR_BASE_HEIGHT = BASE_TABLE_HEIGHT - SEAT_THICKNESS * 0.85;
const STOOL_HEIGHT = CHAIR_BASE_HEIGHT + SEAT_THICKNESS;
const TABLE_HEIGHT_LIFT = 0.05 * MODEL_SCALE;
const TABLE_HEIGHT = STOOL_HEIGHT + TABLE_HEIGHT_LIFT;
const HUMAN_SEAT_ROTATION_OFFSET = Math.PI / 8;

const ARENA_WALL_HEIGHT = 3.6 * 1.3;
const ARENA_WALL_CENTER_Y = ARENA_WALL_HEIGHT / 2;
const ARENA_WALL_TOP_Y = ARENA_WALL_CENTER_Y + ARENA_WALL_HEIGHT / 2;
const ARENA_WALL_INNER_RADIUS = TABLE_RADIUS * ARENA_GROWTH * 2.4;

const CAMERA_TARGET_LIFT = 0.04 * MODEL_SCALE;
const CAMERA_FOCUS_CENTER_LIFT = -0.16 * MODEL_SCALE;
const CAMERA_PLAYER_FOCUS_BLEND = 0.68;
const CAMERA_PLAYER_FOCUS_FORWARD_PULL = 0.18 * MODEL_SCALE;
const CAMERA_PLAYER_FOCUS_HEIGHT = 0.16 * MODEL_SCALE;
const CAMERA_PLAYER_FOCUS_DROP = 0.14 * MODEL_SCALE;
const CAMERA_LATERAL_OFFSETS = Object.freeze({ portrait: -0.08, landscape: 0.5 });
const CAMERA_RETREAT_OFFSETS = Object.freeze({ portrait: 1.7, landscape: 1.16 });
const CAMERA_ELEVATION_OFFSETS = Object.freeze({ portrait: 1.6, landscape: 1.18 });
const CAMERA_HEAD_TURN_LIMIT = THREE.MathUtils.degToRad(175);
const CAMERA_HEAD_PITCH_UP = THREE.MathUtils.degToRad(8);
const CAMERA_HEAD_PITCH_DOWN = THREE.MathUtils.degToRad(52);
const HEAD_YAW_SENSITIVITY = 0.0042;
const HEAD_PITCH_SENSITIVITY = 0.0026;
const CAMERA_WALL_HEIGHT_MARGIN = 0.1 * MODEL_SCALE;

const BOARD_SIZE = (TABLE_RADIUS * 2 + 1.2 * MODEL_SCALE) * 1.3 * ARENA_GROWTH;
const CAMERA_SETTINGS = buildArenaCameraConfig(BOARD_SIZE);

const WORLD_UP = new THREE.Vector3(0, 1, 0);

const DEFAULT_CHAIR = Object.freeze({
  id: 'crimsonVelvet',
  primary: '#8b1538',
  accent: '#5c0f26',
  highlight: '#d35a7a',
  legColor: '#1f1f1f'
});

const CHAIR_CLOTH_TEXTURE_SIZE = 512;
const CHAIR_CLOTH_REPEAT = 7;

const DOMINO_SCALE = 0.68;
const DOMINO_BODY = new RoundedBoxGeometry(1, 2, 0.22, 4, 0.06);
const DOMINO_MID_SHAPE_WIDTH = 1 - 0.08;
const DOMINO_MID_SHAPE_HEIGHT = 0.03;
const DOMINO_MID_RADIUS = 0.06;
const DOMINO_RING_INNER = 0.107;
const DOMINO_RING_OUTER = 0.12;
const DOMINO_PIP_GEO = new THREE.SphereGeometry(0.085, 24, 24);
const DOMINO_RING_GEO = new THREE.RingGeometry(DOMINO_RING_INNER, DOMINO_RING_OUTER, 64);

const MARKER_GEOMETRY = new THREE.TorusGeometry(0.045, 0.005, 12, 32);

const PIP_POSITIONS = [
  [-0.3, 0.6],
  [0, 0.6],
  [0.3, 0.6],
  [-0.3, 0.3],
  [0, 0.3],
  [0.3, 0.3],
  [-0.3, 0.0],
  [0, 0.0],
  [0.3, 0.0]
];

const PIP_INDEX_SETS = {
  0: [],
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8]
};

const HAND_TILE_SPACING = 0.12;
const HAND_TILE_OFFSET = 0.05;
const HAND_TILE_HEIGHT = TABLE_HEIGHT + 0.09;
const CHAIN_TILE_STEP = 0.12;

const INITIAL_STATUS = 'Ready';

function adjustHexColor(hex, amount) {
  const base = new THREE.Color(hex);
  const target = amount >= 0 ? new THREE.Color(0xffffff) : new THREE.Color(0x000000);
  base.lerp(target, Math.min(Math.abs(amount), 1));
  return `#${base.getHexString()}`;
}

function createChairClothTexture(chairOption, renderer) {
  const primary = chairOption?.primary ?? '#0f6a2f';
  const accent = chairOption?.accent ?? adjustHexColor(primary, -0.28);
  const highlight = chairOption?.highlight ?? adjustHexColor(primary, 0.22);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = CHAIR_CLOTH_TEXTURE_SIZE;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, adjustHexColor(primary, 0.2));
  gradient.addColorStop(0.5, primary);
  gradient.addColorStop(1, accent);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const spacing = canvas.width / CHAIR_CLOTH_REPEAT;
  const lineWidth = Math.max(1.6, spacing * 0.06);

  ctx.strokeStyle = adjustHexColor(accent, -0.35);
  ctx.lineWidth = lineWidth;
  ctx.globalAlpha = 0.9;
  for (let offset = -canvas.height; offset <= canvas.width + canvas.height; offset += spacing) {
    ctx.beginPath();
    ctx.moveTo(offset, 0);
    ctx.lineTo(offset - canvas.height, canvas.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(offset, 0);
    ctx.lineTo(offset + canvas.height, canvas.height);
    ctx.stroke();
  }

  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = adjustHexColor(highlight, 0.18);
  ctx.lineWidth = lineWidth * 0.55;
  for (let offset = -canvas.height; offset <= canvas.width + canvas.height; offset += spacing) {
    ctx.beginPath();
    ctx.moveTo(offset + spacing / 2, 0);
    ctx.lineTo(offset + spacing / 2 - canvas.height, canvas.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(offset + spacing / 2, 0);
    ctx.lineTo(offset + spacing / 2 + canvas.height, canvas.height);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(CHAIR_CLOTH_REPEAT, CHAIR_CLOTH_REPEAT);
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy?.() ?? 1;
  return texture;
}

function createChairFabricMaterial(chairOption, renderer) {
  const texture = createChairClothTexture(chairOption, renderer);
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    color: new THREE.Color(chairOption?.primary ?? '#0f6a2f'),
    roughness: 0.78,
    metalness: 0.12
  });
  material.userData = {
    ...(material.userData || {}),
    chairId: chairOption?.id ?? 'default',
    clothTexture: texture
  };
  return material;
}

function disposeMaterial(material) {
  if (!material) return;
  if (Array.isArray(material)) {
    material.forEach(disposeMaterial);
    return;
  }
  const texture = material.userData?.clothTexture;
  texture?.dispose?.();
  material.map?.dispose?.();
  material.dispose?.();
}

function createStraightArmrest(side, material) {
  const sideSign = side === 'right' ? 1 : -1;
  const group = new THREE.Group();

  const baseHeight = SEAT_THICKNESS / 2;
  const supportHeight = ARM_HEIGHT + SEAT_THICKNESS * 0.65;
  const topLength = ARM_DEPTH * 1.1;
  const topThickness = ARM_THICKNESS * 0.65;

  const top = new THREE.Mesh(new THREE.BoxGeometry(ARM_THICKNESS * 0.95, topThickness, topLength), material);
  top.position.set(0, baseHeight + supportHeight, -SEAT_DEPTH * 0.05);
  top.castShadow = true;
  top.receiveShadow = true;
  group.add(top);

  const createSupport = (zOffset) => {
    const support = new THREE.Mesh(
      new THREE.BoxGeometry(ARM_THICKNESS * 0.6, supportHeight, ARM_THICKNESS * 0.7),
      material
    );
    support.position.set(0, baseHeight + supportHeight / 2, top.position.z + zOffset);
    support.castShadow = true;
    support.receiveShadow = true;
    return support;
  };

  const frontSupport = createSupport(ARM_DEPTH * 0.4);
  const rearSupport = createSupport(-ARM_DEPTH * 0.4);
  group.add(frontSupport, rearSupport);

  const sidePanel = new THREE.Mesh(
    new THREE.BoxGeometry(ARM_THICKNESS * 0.45, supportHeight * 0.92, ARM_DEPTH * 0.85),
    material
  );
  sidePanel.position.set(0, baseHeight + supportHeight * 0.46, top.position.z - ARM_DEPTH * 0.02);
  sidePanel.castShadow = true;
  sidePanel.receiveShadow = true;
  group.add(sidePanel);

  const handRest = new THREE.Mesh(
    new THREE.BoxGeometry(ARM_THICKNESS * 0.7, topThickness * 0.7, topLength * 0.8),
    material
  );
  handRest.position.set(0, top.position.y + topThickness * 0.45, top.position.z);
  handRest.castShadow = true;
  handRest.receiveShadow = true;
  group.add(handRest);

  group.position.set(sideSign * (SEAT_WIDTH / 2 + ARM_THICKNESS * 0.7), 0, 0);
  return group;
}

function disposeObject3D(object) {
  object.traverse((node) => {
    if (node.isMesh || node.isPoints || node.isLine) {
      if (node.geometry) {
        node.geometry.dispose?.();
      }
      if (Array.isArray(node.material)) {
        node.material.forEach((mat) => mat?.dispose?.());
      } else {
        node.material?.dispose?.();
      }
    }
  });
}

function roundedRectShape(halfWidth, halfHeight, radius) {
  const shape = new THREE.Shape();
  const w = halfWidth;
  const h = halfHeight;
  shape.moveTo(-w + radius, -h);
  shape.lineTo(w - radius, -h);
  shape.quadraticCurveTo(w, -h, w, -h + radius);
  shape.lineTo(w, h - radius);
  shape.quadraticCurveTo(w, h, w - radius, h);
  shape.lineTo(-w + radius, h);
  shape.quadraticCurveTo(-w, h, -w, h - radius);
  shape.lineTo(-w, -h + radius);
  shape.quadraticCurveTo(-w, -h, -w + radius, -h);
  return shape;
}

function roundedRectAbs(width, height, radius) {
  return roundedRectShape(width / 2, height / 2, radius);
}

function createDominoMaterials() {
  const porcelain = new THREE.MeshPhysicalMaterial({
    color: 0xf8f8fb,
    roughness: 0.12,
    metalness: 0.2,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    reflectivity: 0.6
  });
  const pip = new THREE.MeshPhysicalMaterial({
    color: 0x0a0a0a,
    roughness: 0.05,
    metalness: 0.6,
    clearcoat: 0.9,
    clearcoatRoughness: 0.04
  });
  const gold = new THREE.MeshPhysicalMaterial({
    color: 0xffd700,
    emissive: 0x3a2a00,
    emissiveIntensity: 0.55,
    metalness: 1.0,
    roughness: 0.18,
    reflectivity: 1.0,
    side: THREE.DoubleSide
  });
  return { porcelain, pip, gold };
}

const DOMINO_MATERIALS = createDominoMaterials();

function addDominoGoldPerimeter(parent) {
  const inset = 0.04;
  const width = 1 - inset * 2;
  const height = 2 - inset * 2;
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, -height / 2);
  shape.lineTo(width / 2, -height / 2);
  shape.lineTo(width / 2, height / 2);
  shape.lineTo(-width / 2, height / 2);
  shape.lineTo(-width / 2, -height / 2);
  const hole = new THREE.Path();
  const t = 0.015;
  hole.moveTo(-width / 2 + t, -height / 2 + t);
  hole.lineTo(width / 2 - t, -height / 2 + t);
  hole.lineTo(width / 2 - t, height / 2 - t);
  hole.lineTo(-width / 2 + t, height / 2 - t);
  hole.lineTo(-width / 2 + t, -height / 2 + t);
  shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.01, bevelEnabled: false });
  const mesh = new THREE.Mesh(geometry, DOMINO_MATERIALS.gold.clone());
  mesh.position.z = 0.11;
  mesh.renderOrder = 5;
  parent.add(mesh);
}

function addDominoPips(parent, count, yOffset) {
  const indexes = PIP_INDEX_SETS[Math.max(0, Math.min(6, count))];
  indexes.forEach((idx) => {
    const [px, py] = PIP_POSITIONS[idx];
    const pip = new THREE.Mesh(DOMINO_PIP_GEO.clone(), DOMINO_MATERIALS.pip.clone());
    pip.position.set(px, py + yOffset, 0.11);
    parent.add(pip);
    const ring = new THREE.Mesh(DOMINO_RING_GEO.clone(), DOMINO_MATERIALS.gold.clone());
    ring.position.set(px, py + yOffset, 0.11);
    ring.renderOrder = 6;
    parent.add(ring);
  });
}

function createDominoMesh(a, b) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(DOMINO_BODY.clone(), DOMINO_MATERIALS.porcelain.clone());
  body.castShadow = true;
  body.receiveShadow = true;

  const midShape = roundedRectAbs(DOMINO_MID_SHAPE_WIDTH, DOMINO_MID_SHAPE_HEIGHT, Math.min(DOMINO_MID_RADIUS, 0.015));
  const midGeo = new THREE.ExtrudeGeometry(midShape, { depth: 0.01, bevelEnabled: false });
  const midLine = new THREE.Mesh(midGeo, DOMINO_MATERIALS.gold.clone());
  midLine.position.z = 0.11;
  midLine.renderOrder = 5;
  body.add(midLine);

  addDominoGoldPerimeter(body);
  addDominoPips(body, a, -0.8);
  addDominoPips(body, b, 0.2);

  group.add(body);
  group.userData.dominoBody = body;
  group.userData.values = [a, b];
  configureDominoMesh(group, { flat: true, faceUp: true });
  return group;
}

function configureDominoMesh(group, { flat, faceUp }) {
  const baseScaleX = DOMINO_SCALE * 0.1;
  const baseScaleY = DOMINO_SCALE * 0.20;
  const baseScaleZ = DOMINO_SCALE * 0.016;
  group.rotation.set(0, 0, 0);
  if (flat) {
    group.rotation.x = -Math.PI / 2;
    group.scale.set(baseScaleX, baseScaleZ, baseScaleY / 2);
  } else {
    group.scale.set(baseScaleX, baseScaleY / 2, baseScaleZ);
  }
  if (!faceUp) {
    group.rotation.y = Math.PI;
  }
  group.userData.faceUp = faceUp;
  group.userData.flat = flat;
}

function canonTile(tile) {
  if (!tile) return null;
  const a = Number.isFinite(tile.a) ? tile.a : null;
  const b = Number.isFinite(tile.b) ? tile.b : null;
  if (a === null || b === null) return null;
  const [min, max] = a <= b ? [a, b] : [b, a];
  if (min < 0 || max > 6) return null;
  return { a: min, b: max };
}

function generateDominoSet() {
  const set = [];
  for (let a = 0; a <= 6; a += 1) {
    for (let b = a; b <= 6; b += 1) {
      const mesh = createDominoMesh(a, b);
      set.push({ a, b, mesh, jitter: Math.random() * Math.PI * 2 });
    }
  }
  return set;
}

function cloneDominoTile(template) {
  const mesh = template.mesh.clone(true);
  mesh.traverse((node) => {
    if (node.isMesh) {
      node.geometry = node.geometry?.clone?.() ?? node.geometry;
      if (Array.isArray(node.material)) {
        node.material = node.material.map((mat) => mat?.clone?.() ?? mat);
      } else if (node.material) {
        node.material = node.material.clone?.() ?? node.material;
      }
    }
  });
  return {
    a: template.a,
    b: template.b,
    mesh,
    jitter: template.jitter
  };
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function parseSearchParams(search) {
  const params = new URLSearchParams(search);
  const requestedPlayers = Number.parseInt(params.get('players') || params.get('playerCount') || '', 10);
  const playerCount = Number.isFinite(requestedPlayers)
    ? Math.min(4, Math.max(2, requestedPlayers))
    : 4;
  const amount = Number.parseInt(params.get('amount') || '', 10);
  const token = params.get('token') || 'TPC';
  const stakeLabel = Number.isFinite(amount) && amount > 0
    ? `Ready — Stake ${amount.toLocaleString('en-US')} ${token.toUpperCase()}`
    : INITIAL_STATUS;
  return { playerCount, stakeLabel };
}

function createMarker() {
  const mesh = new THREE.Mesh(MARKER_GEOMETRY.clone(), new THREE.MeshStandardMaterial({
    color: '#15d16f',
    roughness: 0.7,
    metalness: 0,
    transparent: true,
    opacity: 0.55
  }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 10;
  return mesh;
}

function buildSeatLayout(count, tableInfo) {
  const layout = [];
  const safeCount = Math.max(2, Math.min(6, Math.round(Number(count) || 4)));
  for (let i = 0; i < safeCount; i += 1) {
    const baseAngle = Math.PI / 2 - HUMAN_SEAT_ROTATION_OFFSET - (i / safeCount) * Math.PI * 2;
    const forward = new THREE.Vector3(Math.cos(baseAngle), 0, Math.sin(baseAngle));
    const right = new THREE.Vector3(-Math.sin(baseAngle), 0, Math.cos(baseAngle));
    const outerDistance = tableInfo?.getOuterRadius?.(forward) ?? TABLE_RADIUS;
    const seatRadius = outerDistance + SEAT_DEPTH * 0.6;
    const seatPos = forward.clone().multiplyScalar(seatRadius);
    seatPos.y = CHAIR_BASE_HEIGHT;
    const stoolAnchor = forward.clone().multiplyScalar(seatRadius);
    stoolAnchor.y = CHAIR_BASE_HEIGHT + SEAT_THICKNESS / 2;
    const handRadius = (tableInfo?.getInnerRadius?.(forward) ?? outerDistance * 0.82) + 0.12;
    const handAnchor = forward.clone().multiplyScalar(handRadius);
    handAnchor.y = HAND_TILE_HEIGHT;
    layout.push({ forward, right, seatPos, stoolAnchor, handAnchor, isHuman: i === 0 });
  }
  return layout;
}

function createChair({ seat, chairMaterial, legMaterial, arena }) {
  const group = new THREE.Group();
  group.position.copy(seat.seatPos);
  group.lookAt(new THREE.Vector3(0, seat.seatPos.y, 0));

  const seatMesh = new THREE.Mesh(new THREE.BoxGeometry(SEAT_WIDTH, SEAT_THICKNESS, SEAT_DEPTH), chairMaterial);
  seatMesh.position.y = SEAT_THICKNESS / 2;
  seatMesh.castShadow = true;
  seatMesh.receiveShadow = true;
  group.add(seatMesh);

  const backMesh = new THREE.Mesh(new THREE.BoxGeometry(SEAT_WIDTH, BACK_HEIGHT, BACK_THICKNESS), chairMaterial);
  backMesh.position.set(0, SEAT_THICKNESS / 2 + BACK_HEIGHT / 2, -SEAT_DEPTH / 2 + BACK_THICKNESS / 2);
  backMesh.castShadow = true;
  backMesh.receiveShadow = true;
  group.add(backMesh);

  const armLeft = createStraightArmrest('left', chairMaterial);
  group.add(armLeft);
  const armRight = createStraightArmrest('right', chairMaterial);
  group.add(armRight);

  const legBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16 * MODEL_SCALE * STOOL_SCALE, 0.2 * MODEL_SCALE * STOOL_SCALE, BASE_COLUMN_HEIGHT, 16),
    legMaterial
  );
  legBase.position.y = -SEAT_THICKNESS / 2 - BASE_COLUMN_HEIGHT / 2;
  legBase.castShadow = true;
  legBase.receiveShadow = true;
  group.add(legBase);

  arena.add(group);
  return group;
}

export default function DominoRoyalArena({ search }) {
  const config = useMemo(() => parseSearchParams(search), [search]);
  const [playerCount, setPlayerCount] = useState(config.playerCount);
  const [status, setStatus] = useState(config.stakeLabel);
  const [drawDisabled, setDrawDisabled] = useState(true);
  const [passDisabled, setPassDisabled] = useState(true);
  const [gameActive, setGameActive] = useState(false);
  const [showRules, setShowRules] = useState(false);

  const mountRef = useRef(null);
  const threeRef = useRef(null);
  const gameRef = useRef(null);

  useEffect(() => {
    setPlayerCount(config.playerCount);
    setStatus(config.stakeLabel);
    setDrawDisabled(true);
    setPassDisabled(true);
    setGameActive(false);
  }, [config.playerCount, config.stakeLabel]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    applyRendererSRGB(renderer);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(mount.clientWidth, mount.clientHeight, false);
    renderer.shadowMap.enabled = true;
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.cursor = 'grab';
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#030712');

    const camera = new THREE.PerspectiveCamera(
      CAMERA_SETTINGS.fov,
      mount.clientWidth / mount.clientHeight,
      CAMERA_SETTINGS.near,
      CAMERA_SETTINGS.far
    );

    const ambient = new THREE.AmbientLight(0xffffff, 1.08);
    scene.add(ambient);
    const spot = new THREE.SpotLight(0xffffff, 4.2, TABLE_RADIUS * 10, Math.PI / 3, 0.35, 1);
    spot.position.set(3, 7, 3);
    spot.castShadow = true;
    scene.add(spot);
    const rim = new THREE.PointLight(0x33ccff, 1.72);
    rim.position.set(-4, 3, -4);
    scene.add(rim);

    const arena = new THREE.Group();
    scene.add(arena);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(TABLE_RADIUS * ARENA_GROWTH * 3.2, 64),
      new THREE.MeshStandardMaterial({ color: 0x0b1120, roughness: 0.9, metalness: 0.1 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    arena.add(floor);

    const carpet = new THREE.Mesh(
      new THREE.CircleGeometry(TABLE_RADIUS * ARENA_GROWTH * 2.2, 64),
      createArenaCarpetMaterial(new THREE.Color('#0f172a'), new THREE.Color('#1e3a8a'))
    );
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.y = 0.01;
    carpet.receiveShadow = true;
    arena.add(carpet);

    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(
        TABLE_RADIUS * ARENA_GROWTH * 2.4,
        TABLE_RADIUS * ARENA_GROWTH * 2.6,
        ARENA_WALL_HEIGHT,
        32,
        1,
        true
      ),
      createArenaWallMaterial('#0b1120', '#1e293b')
    );
    wall.position.y = ARENA_WALL_CENTER_Y;
    arena.add(wall);

    const woodOption = TABLE_WOOD_OPTIONS[0];
    const clothOption = TABLE_CLOTH_OPTIONS[1] ?? TABLE_CLOTH_OPTIONS[0];
    const baseOption = TABLE_BASE_OPTIONS[0];
    const shapeOption = TABLE_SHAPE_OPTIONS[0];
    const tableInfo = createMurlanStyleTable({
      arena,
      renderer,
      tableRadius: TABLE_RADIUS,
      tableHeight: TABLE_HEIGHT,
      woodOption,
      clothOption,
      baseOption,
      shapeOption
    });
    applyTableMaterials(tableInfo.materials, { woodOption, clothOption, baseOption }, renderer);

    const chairMaterial = createChairFabricMaterial(DEFAULT_CHAIR, renderer);
    const legMaterial = new THREE.MeshStandardMaterial({ color: DEFAULT_CHAIR.legColor });

    const seatLayout = buildSeatLayout(playerCount, tableInfo);
    const seatGroups = seatLayout.map((seat) => {
      const chairGroup = createChair({ seat, chairMaterial, legMaterial, arena });
      const handGroup = new THREE.Group();
      const label = new THREE.Group();
      arena.add(handGroup);
      arena.add(label);
      return { seat, chairGroup, handGroup, label, isHuman: seat.isHuman };
    });

    const chainGroup = new THREE.Group();
    arena.add(chainGroup);
    const markerGroup = new THREE.Group();
    arena.add(markerGroup);

    const headAngles = { yaw: 0, pitch: 0 };
    const cameraBasis = { position: new THREE.Vector3(), baseForward: new THREE.Vector3(), baseUp: new THREE.Vector3(), baseRight: new THREE.Vector3() };

    const applyHeadOrientation = () => {
      const basis = cameraBasis;
      const yawQuat = new THREE.Quaternion().setFromAxisAngle(WORLD_UP, headAngles.yaw);
      const rotatedForward = basis.baseForward.clone().applyQuaternion(yawQuat);
      const rotatedUp = basis.baseUp.clone().applyQuaternion(yawQuat);
      const rightAxis = basis.baseRight.clone().applyQuaternion(yawQuat);
      const pitchQuat = new THREE.Quaternion().setFromAxisAngle(rightAxis, headAngles.pitch);
      const finalForward = rotatedForward.applyQuaternion(pitchQuat).normalize();
      const finalUp = rotatedUp.applyQuaternion(pitchQuat).normalize();
      camera.position.copy(basis.position);
      camera.up.copy(finalUp);
      camera.lookAt(basis.position.clone().add(finalForward));
    };

    const humanSeat = seatGroups.find((seat) => seat.isHuman) ?? seatGroups[0];
    const cameraTarget = new THREE.Vector3(0, tableInfo.surfaceY + CAMERA_TARGET_LIFT, 0);
    const applySeatedCamera = (width, height) => {
      if (!humanSeat) return;
      const portrait = height > width;
      const lateral = portrait ? CAMERA_LATERAL_OFFSETS.portrait : CAMERA_LATERAL_OFFSETS.landscape;
      const retreat = portrait ? CAMERA_RETREAT_OFFSETS.portrait : CAMERA_RETREAT_OFFSETS.landscape;
      const elevation = portrait ? CAMERA_ELEVATION_OFFSETS.portrait : CAMERA_ELEVATION_OFFSETS.landscape;
      const base = humanSeat.seat.stoolAnchor
        .clone()
        .addScaledVector(humanSeat.seat.forward, -retreat)
        .addScaledVector(humanSeat.seat.right, lateral);
      const maxHeight = ARENA_WALL_TOP_Y - CAMERA_WALL_HEIGHT_MARGIN;
      base.y = Math.min(humanSeat.seat.stoolAnchor.y + elevation, maxHeight);
      camera.position.copy(base);
      const focusBase = cameraTarget.clone().add(new THREE.Vector3(0, CAMERA_FOCUS_CENTER_LIFT, 0));
      const focusForwardPull = CAMERA_PLAYER_FOCUS_FORWARD_PULL;
      const focusHeight = CAMERA_PLAYER_FOCUS_HEIGHT;
      const focusBlend = CAMERA_PLAYER_FOCUS_BLEND;
      const chipFocus = humanSeat.seat.handAnchor.clone();
      chipFocus.y = tableInfo.surfaceY + focusHeight - CAMERA_PLAYER_FOCUS_DROP;
      const focus = focusBase.lerp(chipFocus, focusBlend);
      camera.lookAt(focus);
      camera.updateMatrixWorld();
      const baseForward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
      const baseUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion).normalize();
      const baseRight = new THREE.Vector3().crossVectors(baseForward, baseUp).normalize();
      cameraBasis.position.copy(base);
      cameraBasis.baseForward.copy(baseForward);
      cameraBasis.baseUp.copy(baseUp);
      cameraBasis.baseRight.copy(baseRight);
      headAngles.yaw = 0;
      headAngles.pitch = 0;
      applyHeadOrientation();
    };

    applySeatedCamera(mount.clientWidth, mount.clientHeight);

    const pointerState = { active: false, pointerId: null, startX: 0, startY: 0, startYaw: 0, startPitch: 0 };

    const handlePointerDown = (event) => {
      pointerState.active = true;
      pointerState.pointerId = event.pointerId;
      pointerState.startX = event.clientX;
      pointerState.startY = event.clientY;
      pointerState.startYaw = headAngles.yaw;
      pointerState.startPitch = headAngles.pitch;
      renderer.domElement.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event) => {
      if (!pointerState.active || pointerState.pointerId !== event.pointerId) return;
      const dx = event.clientX - pointerState.startX;
      const dy = event.clientY - pointerState.startY;
      headAngles.yaw = THREE.MathUtils.clamp(
        pointerState.startYaw - dx * HEAD_YAW_SENSITIVITY,
        -CAMERA_HEAD_TURN_LIMIT,
        CAMERA_HEAD_TURN_LIMIT
      );
      headAngles.pitch = THREE.MathUtils.clamp(
        pointerState.startPitch - dy * HEAD_PITCH_SENSITIVITY,
        -CAMERA_HEAD_PITCH_UP,
        CAMERA_HEAD_PITCH_DOWN
      );
      applyHeadOrientation();
    };

    const handlePointerUp = (event) => {
      if (pointerState.pointerId === event.pointerId) {
        renderer.domElement.releasePointerCapture(event.pointerId);
        pointerState.active = false;
        pointerState.pointerId = null;
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);
    renderer.domElement.addEventListener('pointercancel', handlePointerUp);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const dominoTemplates = generateDominoSet();

    const gameState = {
      players: [],
      boneyard: [],
      chain: [],
      ends: null,
      current: 0,
      human: 0,
      selectedTile: null,
      markers: { L: null, R: null },
      flipDir: false,
      chainLimit: (tableInfo.feltRadius ?? (TABLE_RADIUS * 0.78)) - 0.08
    };

    const clearMarkers = () => {
      ['L', 'R'].forEach((key) => {
        const marker = gameState.markers[key];
        if (marker) {
          markerGroup.remove(marker);
          marker.geometry?.dispose?.();
          marker.material?.dispose?.();
          gameState.markers[key] = null;
        }
      });
    };

    const setUiStatus = (text) => {
      setStatus(text);
    };

    const refreshControls = () => {
      const isHumanTurn = gameState.current === gameState.human;
      const canDraw = isHumanTurn && gameState.boneyard.length > 0;
      const canPass = isHumanTurn;
      setDrawDisabled(!canDraw);
      setPassDisabled(!canPass);
    };

    const renderHands = () => {
      seatGroups.forEach((seat) => {
        seat.handGroup.clear();
      });
      gameState.players.forEach((player, index) => {
        const seat = seatGroups[index % seatGroups.length];
        if (!seat) return;
        const faceUp = index === gameState.human;
        const baseAnchor = seat.seat.handAnchor.clone();
        const gap = HAND_TILE_SPACING;
        const start = player.hand.length > 1 ? -((player.hand.length - 1) * gap) / 2 : 0;
        player.hand.forEach((tile, tileIndex) => {
          const mesh = tile.mesh;
          configureDominoMesh(mesh, { flat: false, faceUp });
          const offset = start + tileIndex * gap;
          const position = baseAnchor
            .clone()
            .addScaledVector(seat.seat.right, offset)
            .addScaledVector(seat.seat.forward, faceUp ? HAND_TILE_OFFSET : -HAND_TILE_OFFSET * 0.4);
          position.y = HAND_TILE_HEIGHT;
          mesh.position.copy(position);
          if (faceUp) {
            const jitter = tile.jitter ?? 0;
            mesh.rotation.y += Math.sin(jitter) * 0.05;
            mesh.rotation.z += Math.cos(jitter) * 0.015;
          }
          mesh.userData.owner = index;
          mesh.userData.tile = tile;
          if (mesh.parent) {
            mesh.parent.remove(mesh);
          }
          seat.handGroup.add(mesh);
        });
      });
    };

    const renderChain = () => {
      chainGroup.clear();
      gameState.chain.forEach((entry) => {
        const { tile, x, z, rot } = entry;
        const mesh = tile.mesh;
        configureDominoMesh(mesh, { flat: true, faceUp: true });
        if (mesh.parent) {
          mesh.parent.remove(mesh);
        }
        mesh.position.set(x, tableInfo.surfaceY + 0.01, z);
        mesh.rotation.y += rot;
        mesh.userData.owner = null;
        chainGroup.add(mesh);
      });
    };

    const withinChainBounds = (x, z) => {
      return Math.hypot(x, z) <= gameState.chainLimit;
    };

    const nextCandidate = (end) => {
      let { x, z, dir } = end;
      let [dx, dz] = dir;
      let angle = Math.atan2(dz, dx);
      let nx = x + dx * CHAIN_TILE_STEP;
      let nz = z + dz * CHAIN_TILE_STEP;
      if (!withinChainBounds(nx, nz)) {
        const ndx = -dz;
        const ndz = dx;
        dx = ndx;
        dz = ndz;
        angle = Math.atan2(dz, dx);
        nx = x + dx * CHAIN_TILE_STEP;
        nz = z + dz * CHAIN_TILE_STEP;
        if (!withinChainBounds(nx, nz)) {
          const clampedAngle = Math.atan2(nz, nx);
          nx = Math.cos(clampedAngle) * gameState.chainLimit;
          nz = Math.sin(clampedAngle) * gameState.chainLimit;
        }
      }
      return { nx, nz, rot: angle, dx, dz };
    };

    const showMarkersFor = (tile) => {
      clearMarkers();
      if (!gameState.ends) return;
      const canL = tile.a === gameState.ends.L.v || tile.b === gameState.ends.L.v;
      const canR = tile.a === gameState.ends.R.v || tile.b === gameState.ends.R.v;
      if (canL) {
        const c = nextCandidate(gameState.ends.L);
        const marker = createMarker();
        marker.position.set(c.nx, tableInfo.surfaceY + 0.012, c.nz);
        marker.userData = { type: 'marker', side: -1 };
        markerGroup.add(marker);
        gameState.markers.L = marker;
      }
      if (canR) {
        const c = nextCandidate(gameState.ends.R);
        const marker = createMarker();
        marker.position.set(c.nx, tableInfo.surfaceY + 0.012, c.nz);
        marker.userData = { type: 'marker', side: 1 };
        markerGroup.add(marker);
        gameState.markers.R = marker;
      }
    };

    const placeOnBoard = (tile, side) => {
      if (!gameState.chain.length) return false;
      const end = side < 0 ? gameState.ends.L : gameState.ends.R;
      const want = end.v;
      let { a, b } = tile;
      if (a !== want && b === want) {
        [a, b] = [b, a];
      }
      if (a !== want) {
        return false;
      }
      const candidate = nextCandidate(end);
      let rot = candidate.rot;
      if (a === b) {
        rot += Math.PI / 2;
      }
      tile.a = a;
      tile.b = b;
      gameState.chain.push({ tile, x: candidate.nx, z: candidate.nz, rot });
      const newVal = side < 0 ? b : a;
      const nextEnd = { v: newVal, x: candidate.nx, z: candidate.nz, dir: [candidate.dx, candidate.dz] };
      if (side < 0) gameState.ends.L = nextEnd;
      else gameState.ends.R = nextEnd;
      renderChain();
      return true;
    };

    const updateInteractivity = () => {
      renderHands();
      renderChain();
      refreshControls();
    };

    const blockedAndWinner = () => {
      if (!gameState.ends) return null;
      const nobodyCan = gameState.players.every((player) => {
        return !player.hand.some((tile) => {
          return (
            tile.a === gameState.ends.L.v ||
            tile.b === gameState.ends.L.v ||
            tile.a === gameState.ends.R.v ||
            tile.b === gameState.ends.R.v
          );
        });
      });
      if (nobodyCan && gameState.boneyard.length === 0) {
        let best = Infinity;
        let winner = -1;
        gameState.players.forEach((player, index) => {
          const score = player.hand.reduce((sum, tile) => sum + tile.a + tile.b, 0);
          if (score < best) {
            best = score;
            winner = index;
          }
        });
        return { blocked: true, winner, reason: `Bllokuar. Dora më e ulët = Lojtari ${winner + 1} (${best})` };
      }
      return null;
    };

    const finishGame = (message) => {
      setUiStatus(message);
      setGameActive(false);
      setDrawDisabled(true);
      setPassDisabled(true);
    };

    const nextTurn = () => {
      if (gameState.players[gameState.human]?.hand.length === 0) {
        finishGame('Fitove!');
        return;
      }
      gameState.current = (gameState.current + 1) % gameState.players.length;
      const blocked = blockedAndWinner();
      if (blocked) {
        finishGame(blocked.reason);
        return;
      }
      setUiStatus(`Rradha: Lojtari ${gameState.current + 1}`);
      refreshControls();
      if (gameState.current !== gameState.human) {
        setTimeout(() => {
          cpuPlay();
        }, 450);
      }
    };

    const cpuPlay = () => {
      const player = gameState.players[gameState.current];
      if (!player) return;
      let playableIndex = -1;
      let side = 1;
      if (gameState.ends) {
        for (let i = 0; i < player.hand.length; i += 1) {
          const tile = player.hand[i];
          if (tile.a === gameState.ends.L.v || tile.b === gameState.ends.L.v) {
            playableIndex = i;
            side = -1;
            break;
          }
          if (tile.a === gameState.ends.R.v || tile.b === gameState.ends.R.v) {
            playableIndex = i;
            side = 1;
            break;
          }
        }
      } else {
        playableIndex = 0;
      }
      if (playableIndex < 0) {
        if (gameState.boneyard.length) {
          const drawn = gameState.boneyard.pop();
          if (drawn) {
            player.hand.push(drawn);
            renderHands();
          }
          setTimeout(cpuPlay, 350);
          return;
        }
        nextTurn();
        return;
      }
      const tile = player.hand.splice(playableIndex, 1)[0];
      const placed = placeOnBoard(tile, side);
      if (!placed) {
        player.hand.splice(playableIndex, 0, tile);
      }
      renderHands();
      if (player.hand.length === 0) {
        finishGame(`Lojtari ${gameState.current + 1} fitoi!`);
        return;
      }
      nextTurn();
    };

    const startGame = () => {
      clearMarkers();
      gameState.players = Array.from({ length: playerCount }, (_, index) => ({ id: index, hand: [] }));
      gameState.chain = [];
      gameState.ends = null;
      gameState.selectedTile = null;
      gameState.current = 0;
      gameState.human = 0;
      setGameActive(true);

      const tileObjects = dominoTemplates.map((template) => cloneDominoTile(template));
      gameState.boneyard = shuffle(tileObjects);
      for (let r = 0; r < 7; r += 1) {
        gameState.players.forEach((player) => {
          const tile = gameState.boneyard.pop();
          if (tile) player.hand.push(tile);
        });
      }
      gameState.players.forEach((player) => shuffle(player.hand));

      let starter = 0;
      let starterIdx = -1;
      let bestDouble = -1;
      gameState.players.forEach((player, index) => {
        const idx = player.hand.findIndex((tile) => tile.a === tile.b && tile.a > bestDouble);
        if (idx >= 0) {
          const tile = player.hand[idx];
          if (tile.a > bestDouble) {
            bestDouble = tile.a;
            starter = index;
            starterIdx = idx;
          }
        }
      });
      if (starterIdx < 0) {
        starterIdx = 0;
      }
      const starterTile = gameState.players[starter].hand.splice(starterIdx, 1)[0];
      const canonical = canonTile(starterTile) ?? starterTile;
      starterTile.a = canonical.a;
      starterTile.b = canonical.b;
      gameState.chain.push({ tile: starterTile, x: 0, z: 0, rot: 0 });
      const step = CHAIN_TILE_STEP;
      if (!gameState.flipDir) {
        gameState.ends = {
          L: { v: starterTile.a, x: -step, z: 0, dir: [-1, 0] },
          R: { v: starterTile.b, x: step, z: 0, dir: [1, 0] }
        };
      } else {
        gameState.ends = {
          L: { v: starterTile.a, x: step, z: 0, dir: [1, 0] },
          R: { v: starterTile.b, x: -step, z: 0, dir: [-1, 0] }
        };
      }
      gameState.flipDir = !gameState.flipDir;
      renderHands();
      renderChain();
      gameState.current = (starter + 1) % gameState.players.length;
      setUiStatus(`Rradha: Lojtari ${gameState.current + 1}`);
      refreshControls();
      if (gameState.current !== gameState.human) {
        setTimeout(cpuPlay, 600);
      }
    };

    const drawTile = () => {
      if (gameState.current !== gameState.human) return;
      while (gameState.boneyard.length) {
        const tile = gameState.boneyard.pop();
        if (!tile) continue;
        gameState.players[gameState.human].hand.push(tile);
        renderHands();
        if (
          tile.a === gameState.ends?.L?.v ||
          tile.b === gameState.ends?.L?.v ||
          tile.a === gameState.ends?.R?.v ||
          tile.b === gameState.ends?.R?.v
        ) {
          break;
        }
      }
      gameState.selectedTile = null;
      clearMarkers();
      refreshControls();
    };

    const passTurn = () => {
      if (gameState.current !== gameState.human) return;
      gameState.selectedTile = null;
      clearMarkers();
      nextTurn();
    };

    const findSelectable = (object) => {
      let current = object;
      while (current) {
        if (current.userData?.tile || current.userData?.type === 'marker') {
          return current;
        }
        current = current.parent;
      }
      return object;
    };

    const handleGamePointerDown = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
      raycaster.setFromCamera(pointer, camera);
      const pickables = [
        ...seatGroups.flatMap((seat) => seat.handGroup.children),
        ...markerGroup.children
      ];
      const hits = raycaster.intersectObjects(pickables, true);
      if (!hits.length) return;
      const root = findSelectable(hits[0].object);
      if (root.userData?.tile) {
        if (root.userData.owner !== gameState.human || gameState.current !== gameState.human) return;
        gameState.selectedTile = root.userData.tile;
        showMarkersFor(gameState.selectedTile);
        setUiStatus('Zgjidh skajin (tap marker)');
        return;
      }
      if (root.userData?.type === 'marker' && gameState.selectedTile) {
        const side = root.userData.side;
        const hand = gameState.players[gameState.human].hand;
        const idx = hand.indexOf(gameState.selectedTile);
        if (idx >= 0) {
          const tile = hand.splice(idx, 1)[0];
          const placed = placeOnBoard(tile, side);
          if (!placed) {
            hand.splice(idx, 0, tile);
          } else {
            renderHands();
            gameState.selectedTile = null;
            clearMarkers();
            nextTurn();
          }
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', handleGamePointerDown);

    threeRef.current = { renderer, scene, camera, arena, tableInfo, seatGroups };
    gameRef.current = { startGame, drawTile, passTurn, updateInteractivity, refreshControls };

    const resizeObserver = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      applySeatedCamera(width, height);
    };

    const handleResize = () => {
      resizeObserver();
    };

    window.addEventListener('resize', handleResize);

    const renderLoop = () => {
      renderer.render(scene, camera);
      if (threeRef.current) {
        threeRef.current.frameId = requestAnimationFrame(renderLoop);
      }
    };
    renderLoop();

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', handleGamePointerDown);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('pointercancel', handlePointerUp);
      renderer.dispose();
      threeRef.current?.frameId && cancelAnimationFrame(threeRef.current.frameId);
      disposeMaterial(chairMaterial);
      disposeMaterial(legMaterial);
      dominoTemplates.forEach((tile) => disposeObject3D(tile.mesh));
      disposeObject3D(scene);
      mount.removeChild(renderer.domElement);
      threeRef.current = null;
      gameRef.current = null;
    };
  }, [playerCount]);

  const handleStart = () => {
    if (!gameRef.current) return;
    setGameActive(true);
    gameRef.current.startGame();
  };

  const handleDraw = () => {
    if (!gameRef.current) return;
    gameRef.current.drawTile?.();
  };

  const handlePass = () => {
    if (!gameRef.current) return;
    gameRef.current.passTurn?.();
  };

  return (
    <div className="relative w-full h-screen bg-slate-950" ref={mountRef}>
      <div className="pointer-events-none absolute inset-0 flex flex-col">
        <div className="mt-3 flex justify-center">
          <div className="rounded-xl bg-black/55 px-4 py-2 text-sm font-semibold text-white shadow-lg">
            {status}
          </div>
        </div>
        <div className="mt-auto mb-3 flex w-full justify-center px-4">
          <div className="pointer-events-auto flex flex-col gap-3 rounded-2xl bg-emerald-900/80 p-3 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="playerCount" className="text-xs font-semibold uppercase tracking-wide text-emerald-200">
                Lojtarë
              </label>
              <select
                id="playerCount"
                value={playerCount}
                onChange={(event) => setPlayerCount(Number(event.target.value))}
                className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white shadow-inner"
              >
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm font-semibold">
              <button
                type="button"
                onClick={handleStart}
                disabled={gameActive}
                className={`col-span-2 rounded-lg px-4 py-2 text-slate-900 shadow-lg transition ${
                  gameActive
                    ? 'bg-amber-900/50 text-amber-200/70 shadow-none'
                    : 'bg-amber-400 hover:bg-amber-300'
                }`}
              >
                Start
              </button>
              <button
                type="button"
                onClick={handleDraw}
                disabled={drawDisabled}
                className={`rounded-lg px-4 py-2 shadow-lg transition ${
                  drawDisabled
                    ? 'bg-emerald-950/60 text-emerald-200/40 shadow-none'
                    : 'bg-emerald-500 text-white hover:bg-emerald-400'
                }`}
              >
                Tërhiq
              </button>
              <button
                type="button"
                onClick={handlePass}
                disabled={passDisabled}
                className={`rounded-lg px-4 py-2 shadow-lg transition ${
                  passDisabled
                    ? 'bg-emerald-950/60 text-emerald-200/40 shadow-none'
                    : 'bg-slate-200 text-emerald-900 hover:bg-white'
                }`}
              >
                Kalo
              </button>
              <button
                type="button"
                onClick={() => setShowRules(true)}
                className="col-span-2 rounded-lg border border-emerald-300/60 px-4 py-2 text-emerald-100"
              >
                Rregulla
              </button>
            </div>
          </div>
        </div>
      </div>

      {showRules && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 px-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5 text-slate-900 shadow-2xl">
            <h2 className="mb-3 text-center text-lg font-bold">Domino Shqiptare — Rregulla për 2–4 lojtarë</h2>
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed">
              <li>
                <strong>Set:</strong> Double-Six (28 gurë, 0–6). Çdo gur unik (a,b) me a ≤ b.
              </li>
              <li>
                <strong>Shpërndarja:</strong> 7 gurë secili. Pjesa tjetër = stok (boneyard).
              </li>
              <li>
                <strong>Nisja:</strong> Kush ka dopion më të lartë nis; në mungesë dopios, nis ai me gurin më të lartë.
              </li>
              <li>
                <strong>Vënia në tavolinë:</strong> Zinxhir mbi rrobën jeshile. Dopio pozicionohet vertikalisht.
              </li>
              <li>
                <strong>Përputhja:</strong> Skaji i lirë duhet të përputhet në vlerë. Dopio pranon nga të dyja anët të njëjtën vlerë.
              </li>
              <li>
                <strong>Nëse s’ke lojë:</strong> Tërhiq derisa të kesh lojë. Nëse stok-u mbaron, kalon rradha.
              </li>
              <li>
                <strong>Mbyllja:</strong> Fiton ai që mbaron i pari ose me më pak pikë kur loja bllokohet.
              </li>
            </ol>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRules(false)}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow"
              >
                Mbyll
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
