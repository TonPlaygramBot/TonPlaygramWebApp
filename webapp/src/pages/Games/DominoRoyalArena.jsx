import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

import { createArenaCarpetMaterial, createArenaWallMaterial } from '../../utils/arenaDecor.js';
import { applyRendererSRGB } from '../../utils/colorSpace.js';
import { ARENA_CAMERA_DEFAULTS, buildArenaCameraConfig } from '../../utils/arenaCameraConfig.js';
import {
  createMurlanStyleTable,
  TABLE_SHAPE_OPTIONS,
  TABLE_WOOD_OPTIONS,
  TABLE_CLOTH_OPTIONS,
  TABLE_BASE_OPTIONS
} from '../../utils/murlanTable.js';
import { DEFAULT_TABLE_CUSTOMIZATION } from '../../utils/tableCustomizationOptions.js';

const MODEL_SCALE = 0.75;
const ARENA_GROWTH = 1.45;
const TABLE_RADIUS = 3.4 * MODEL_SCALE;
const BASE_TABLE_HEIGHT = 1.08 * MODEL_SCALE;
const STOOL_SCALE = 1.5 * 1.3;
const SEAT_WIDTH = 0.9 * MODEL_SCALE * STOOL_SCALE;
const SEAT_DEPTH = 0.95 * MODEL_SCALE * STOOL_SCALE;
const SEAT_THICKNESS = 0.09 * MODEL_SCALE * STOOL_SCALE;
const BACK_HEIGHT = 0.68 * MODEL_SCALE * STOOL_SCALE;
const ARM_THICKNESS = 0.125 * MODEL_SCALE * STOOL_SCALE;
const ARM_HEIGHT = 0.3 * MODEL_SCALE * STOOL_SCALE;
const ARM_DEPTH = SEAT_DEPTH * 0.75;
const BASE_COLUMN_HEIGHT = 0.5 * MODEL_SCALE * STOOL_SCALE;
const HUMAN_CHAIR_PULLBACK = 0.32 * MODEL_SCALE;
const BASE_HUMAN_CHAIR_RADIUS = 5.6 * MODEL_SCALE * ARENA_GROWTH * 0.85;
const CHAIR_RADIUS = BASE_HUMAN_CHAIR_RADIUS + HUMAN_CHAIR_PULLBACK;
const CHAIR_BASE_HEIGHT = BASE_TABLE_HEIGHT - SEAT_THICKNESS * 0.85;
const STOOL_HEIGHT = CHAIR_BASE_HEIGHT + SEAT_THICKNESS;
const TABLE_HEIGHT_LIFT = 0.05 * MODEL_SCALE;
const TABLE_HEIGHT = STOOL_HEIGHT + TABLE_HEIGHT_LIFT;
const ARENA_WALL_HEIGHT = 3.6 * 1.3;
const ARENA_WALL_CENTER_Y = ARENA_WALL_HEIGHT / 2;
const ARENA_WALL_TOP_Y = ARENA_WALL_CENTER_Y + ARENA_WALL_HEIGHT / 2;
const HUMAN_SEAT_ROTATION_OFFSET = Math.PI / 8;
const CAMERA_SETTINGS = buildArenaCameraConfig(TABLE_RADIUS * 2.4);
const CAMERA_WALL_HEIGHT_MARGIN = 0.18 * MODEL_SCALE;
const CAMERA_LATERAL_OFFSET = { portrait: -0.08, landscape: 0.5 };
const CAMERA_RETREAT_OFFSET = { portrait: 1.7, landscape: 1.16 };
const CAMERA_ELEVATION_OFFSET = { portrait: 1.6, landscape: 1.18 };
const CAMERA_FOCUS_LIFT = -0.16 * MODEL_SCALE;
const CAMERA_PLAYER_FOCUS_HEIGHT = 0.32 * MODEL_SCALE;
const CAMERA_PLAYER_FOCUS_BLEND = 0.6;
const PORTRAIT_CAMERA_PLAYER_FOCUS_BLEND = 0.48;
const PORTRAIT_CAMERA_PLAYER_FOCUS_FORWARD_PULL = 0.02 * MODEL_SCALE;
const PORTRAIT_CAMERA_PLAYER_FOCUS_HEIGHT = 0.24 * MODEL_SCALE;
const CAMERA_PLAYER_FOCUS_FORWARD_PULL = 0.12 * MODEL_SCALE;
const TILE_STEP = 0.28 * MODEL_SCALE;
const HAND_SPACING = 0.34 * MODEL_SCALE;
const HAND_ARC_OFFSET = 0.16 * MODEL_SCALE;
const HAND_HEIGHT = TABLE_HEIGHT + 0.18 * MODEL_SCALE;
const BOARD_HEIGHT = TABLE_HEIGHT + 0.04 * MODEL_SCALE;
const MARKER_HEIGHT = BOARD_HEIGHT + 0.005;

const CHAIR_COLOR_OPTIONS = Object.freeze([
  {
    id: 'crimsonVelvet',
    label: 'Kadife e Kuqe',
    primary: '#8b1538',
    accent: '#5c0f26',
    highlight: '#d35a7a',
    legColor: '#1f1f1f'
  },
  {
    id: 'midnightNavy',
    label: 'Blu Mesnate',
    primary: '#153a8b',
    accent: '#0c214f',
    highlight: '#4d74d8',
    legColor: '#10131c'
  },
  {
    id: 'emeraldWave',
    label: 'Valë Smerald',
    primary: '#0f6a2f',
    accent: '#063d1b',
    highlight: '#48b26a',
    legColor: '#142318'
  }
]);

const MARKER_MATERIAL = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#15d16f'),
  roughness: 0.7,
  metalness: 0,
  transparent: true,
  opacity: 0.55
});

const porcelainMaterial = new THREE.MeshPhysicalMaterial({
  color: 0xf8f8fb,
  roughness: 0.12,
  metalness: 0.2,
  clearcoat: 1,
  clearcoatRoughness: 0.05,
  reflectivity: 0.6
});

const pipMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x0a0a0a,
  roughness: 0.05,
  metalness: 0.6,
  clearcoat: 0.9,
  clearcoatRoughness: 0.04
});

const goldMaterial = new THREE.MeshPhysicalMaterial({
  color: 0xffd700,
  emissive: 0x3a2a00,
  emissiveIntensity: 0.55,
  metalness: 1,
  roughness: 0.18,
  reflectivity: 1,
  envMapIntensity: 1.4,
  transmission: 0,
  side: THREE.DoubleSide
});

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
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = primary;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 14;
  ctx.strokeRect(18, 18, size - 36, size - 36);
  ctx.strokeStyle = highlight;
  ctx.lineWidth = 6;
  ctx.strokeRect(52, 52, size - 104, size - 104);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy?.() ?? 8;
  return texture;
}

function createChairFabricMaterial(chairOption, renderer) {
  const texture = createChairClothTexture(chairOption, renderer);
  const primary = chairOption?.primary ?? '#0f6a2f';
  const accent = chairOption?.accent ?? adjustHexColor(primary, -0.28);
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(primary),
    roughness: 0.65,
    metalness: 0.08,
    map: texture,
    emissive: new THREE.Color(accent).multiplyScalar(0.15)
  });
}

function createStraightArmrest(side, material) {
  const group = new THREE.Group();
  const sideSign = side === 'right' ? 1 : -1;
  const baseHeight = SEAT_THICKNESS * 0.52;
  const supportHeight = ARM_HEIGHT;
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

function pipPositions() {
  return [
    [-0.3, 0.6],
    [0, 0.6],
    [0.3, 0.6],
    [-0.3, 0.3],
    [0, 0.3],
    [0.3, 0.3],
    [-0.3, 0],
    [0, 0],
    [0.3, 0]
  ];
}

const INDEX_SETS = {
  0: [],
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8]
};

function canonTile(tile) {
  if (!tile || typeof tile.a !== 'number' || typeof tile.b !== 'number') return null;
  const a = Math.min(tile.a, tile.b);
  const b = Math.max(tile.a, tile.b);
  return { a, b };
}

function makeGoldFrame() {
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
  const mesh = new THREE.Mesh(geometry, goldMaterial.clone());
  mesh.position.z = 0.11;
  mesh.renderOrder = 5;
  return mesh;
}

function addPips(dominoFace, count, yOffset) {
  const positions = pipPositions();
  const idxs = INDEX_SETS[Math.max(0, Math.min(6, count))];
  const pipGeo = new THREE.SphereGeometry(0.085, 24, 24);
  idxs.forEach((i) => {
    const [px, py] = positions[i];
    const pip = new THREE.Mesh(pipGeo, pipMaterial);
    pip.position.set(px, py + yOffset, 0.11);
    dominoFace.add(pip);

    const innerR = 0.107;
    const outerR = 0.12;
    const ringGeo = new THREE.RingGeometry(innerR, outerR, 64);
    const ring = new THREE.Mesh(ringGeo, goldMaterial.clone());
    ring.position.set(px, py + yOffset, 0.11);
    ring.renderOrder = 6;
    dominoFace.add(ring);
  });
}

function makeDominoMesh(tile, { flat = true, faceUp = true } = {}) {
  const canon = canonTile(tile);
  if (!canon) return new THREE.Group();
  const { a, b } = canon;
  const group = new THREE.Group();

  const bodyGeo = new RoundedBoxGeometry(1, 2, 0.22, 4, 0.06);
  const body = new THREE.Mesh(bodyGeo, porcelainMaterial.clone());
  body.castShadow = true;
  body.receiveShadow = true;

  const midW = 1 - 0.08;
  const midH = 0.03;
  const midR = 0.06;
  const midShape = new THREE.Shape();
  const hw = midW / 2;
  const hh = midH / 2;
  const radius = Math.min(midR, hh);
  midShape.moveTo(-hw + radius, -hh);
  midShape.lineTo(hw - radius, -hh);
  midShape.absarc(hw - radius, -hh + radius, radius, -Math.PI / 2, 0, false);
  midShape.lineTo(hw, hh - radius);
  midShape.absarc(hw - radius, hh - radius, radius, 0, Math.PI / 2, false);
  midShape.lineTo(-hw + radius, hh);
  midShape.absarc(-hw + radius, hh - radius, radius, Math.PI / 2, Math.PI, false);
  midShape.lineTo(-hw, -hh + radius);
  midShape.absarc(-hw + radius, -hh + radius, radius, Math.PI, (3 * Math.PI) / 2, false);
  const midGeo = new THREE.ExtrudeGeometry(midShape, { depth: 0.01, bevelEnabled: false });
  const midLine = new THREE.Mesh(midGeo, goldMaterial.clone());
  midLine.position.z = 0.11;
  midLine.renderOrder = 5;
  body.add(midLine);

  body.add(makeGoldFrame());

  if (faceUp) {
    addPips(body, a, -0.8);
    addPips(body, b, 0.2);
  }

  group.add(body);
  if (flat) {
    group.rotation.x = -Math.PI / 2;
  }

  const sx = 0.1;
  const sy = flat ? 0.016 : 0.2;
  const sz = flat ? 0.2 : 0.016;
  const scale = 0.68;
  group.scale.set(scale * sx, scale * sy, scale * sz);
  group.userData.val = [a, b];
  group.userData.tile = { a, b };
  return group;
}

function genSet() {
  const set = [];
  for (let a = 0; a <= 6; a += 1) {
    for (let b = a; b <= 6; b += 1) {
      set.push({ a, b });
    }
  }
  return set;
}

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pipSum(hand) {
  return hand.reduce((sum, tile) => sum + tile.a + tile.b, 0);
}

function highestDoubleIndex(hand) {
  let best = -1;
  let index = -1;
  hand.forEach((tile, idx) => {
    if (tile.a === tile.b && tile.a > best) {
      best = tile.a;
      index = idx;
    }
  });
  return index;
}

function parseSearch(search) {
  if (!search) return {};
  const params = new URLSearchParams(search);
  const playerCount = Number.parseInt(params.get('players') || params.get('playerCount') || '', 10);
  const stakeToken = params.get('token') || 'TPC';
  const stakeAmount = Number.parseInt(params.get('amount') || '', 10);
  return { playerCount, stakeToken, stakeAmount };
}

function DominoRoyalArena({ search }) {
  const mountRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const arenaRef = useRef(null);
  const tableRef = useRef(null);
  const piecesGroupRef = useRef(null);
  const markersRef = useRef({ left: null, right: null });
  const animationRef = useRef(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerRef = useRef(new THREE.Vector2());
  const seatLayoutRef = useRef([]);
  const boardRadiusRef = useRef(TABLE_RADIUS * 0.78);
  const gameRef = useRef({
    players: [],
    boneyard: [],
    chain: [],
    ends: null,
    current: 0,
    human: 0,
    selected: null,
    flipDir: false,
    status: 'Ready',
    stakeToken: 'TPC',
    stakeAmount: null
  });

  const { playerCount: queryPlayers, stakeToken, stakeAmount } = useMemo(() => parseSearch(search), [search]);
  const [playerCount, setPlayerCount] = useState(() => {
    if (queryPlayers >= 2 && queryPlayers <= 4) return queryPlayers;
    return 4;
  });
  const [status, setStatus] = useState('Ready');
  const [rulesOpen, setRulesOpen] = useState(false);
  const [canDraw, setCanDraw] = useState(false);
  const [canPass, setCanPass] = useState(false);

  useEffect(() => {
    if (typeof stakeToken === 'string') {
      gameRef.current.stakeToken = stakeToken.toUpperCase();
    }
    if (Number.isFinite(stakeAmount) && stakeAmount > 0) {
      gameRef.current.stakeAmount = stakeAmount;
      setStatus(
        `Ready — Stake ${stakeAmount.toLocaleString('en-US')} ${gameRef.current.stakeToken.toUpperCase()}`
      );
    }
  }, [stakeAmount, stakeToken]);

  const clearMarkers = useCallback(() => {
    const markers = markersRef.current;
    const piecesGroup = piecesGroupRef.current;
    if (!piecesGroup) return;
    ['left', 'right'].forEach((side) => {
      const marker = markers[side];
      if (marker && marker.parent) {
        marker.parent.remove(marker);
      }
      markers[side] = null;
    });
  }, []);

  const renderChain = useCallback(() => {
    const piecesGroup = piecesGroupRef.current;
    if (!piecesGroup) return;
    const chain = gameRef.current.chain;
    chain.forEach((segment) => {
      if (segment.mesh && segment.mesh.parent) {
        segment.mesh.parent.remove(segment.mesh);
      }
      const mesh = makeDominoMesh(segment.tile, { flat: true, faceUp: true });
      mesh.position.set(segment.x, BOARD_HEIGHT, segment.z);
      mesh.rotation.y = segment.rot || 0;
      mesh.castShadow = true;
      piecesGroup.add(mesh);
      segment.mesh = mesh;
    });
  }, []);

  const layoutHands = useCallback(() => {
    const piecesGroup = piecesGroupRef.current;
    if (!piecesGroup) return;
    const layout = seatLayoutRef.current;
    const { players } = gameRef.current;
    const boardRadius = boardRadiusRef.current;
    const humanIndex = gameRef.current.human;

    players.forEach((player) => {
      player.hand.forEach((tile) => {
        if (tile.mesh && tile.mesh.parent) {
          tile.mesh.parent.remove(tile.mesh);
        }
        tile.mesh = null;
      });
    });

    const spacing = HAND_SPACING;
    players.forEach((player, playerIndex) => {
      const seat = layout[playerIndex];
      if (!seat) return;
      const forward = seat.forward;
      const right = new THREE.Vector3(-forward.z, 0, forward.x);
      const handDistance = boardRadius + HAND_ARC_OFFSET;
      const base = forward.clone().multiplyScalar(handDistance);
      base.y = HAND_HEIGHT;
      const start = -((player.hand.length - 1) * spacing) / 2;
      player.hand.forEach((tile, tileIndex) => {
        const mesh = makeDominoMesh(tile, { flat: false, faceUp: playerIndex === humanIndex });
        const offset = start + spacing * tileIndex;
        const position = base.clone().addScaledVector(right, offset);
        mesh.position.copy(position);
        const yaw = Math.atan2(-forward.x, -forward.z);
        if (playerIndex === humanIndex) {
          mesh.rotation.set(0, 0, 0);
        } else {
          mesh.rotation.set(0, yaw, 0);
        }
        mesh.position.y = HAND_HEIGHT;
        mesh.userData.owner = playerIndex;
        mesh.userData.tile = tile;
        mesh.castShadow = true;
        piecesGroup.add(mesh);
        tile.mesh = mesh;
      });
    });
  }, []);

  const nextCandidate = useCallback((end) => {
    if (!end) return null;
    const { x, z, dir } = end;
    let [dx, dz] = dir;
    const ang = Math.atan2(dz, dx);
    const nx = x + dx * TILE_STEP;
    const nz = z + dz * TILE_STEP;
    const limit = boardRadiusRef.current - TILE_STEP * 1.2;
    if (Math.hypot(nx, nz) > limit) {
      const ndx = -dz;
      const ndz = dx;
      return { nx: x + ndx * TILE_STEP, nz: z + ndz * TILE_STEP, rot: Math.atan2(ndz, ndx), dx: ndx, dz: ndz };
    }
    return { nx, nz, rot: ang, dx, dz };
  }, []);

  const showMarkersFor = useCallback(
    (tile) => {
      const { ends } = gameRef.current;
      const piecesGroup = piecesGroupRef.current;
      if (!piecesGroup || !ends) return;
      clearMarkers();
      const markers = markersRef.current;
      const createMarker = () => {
        const geo = new THREE.TorusGeometry(0.045, 0.005, 12, 32);
        const mesh = new THREE.Mesh(geo, MARKER_MATERIAL.clone());
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.y = MARKER_HEIGHT;
        mesh.renderOrder = 10;
        return mesh;
      };

      const canLeft = tile.a === ends.left?.v || tile.b === ends.left?.v;
      if (canLeft && ends.left) {
        const placement = nextCandidate(ends.left);
        if (placement) {
          const marker = createMarker();
          marker.position.x = placement.nx;
          marker.position.z = placement.nz;
          marker.userData.marker = true;
          marker.userData.side = -1;
          piecesGroup.add(marker);
          markers.left = marker;
        }
      }

      const canRight = tile.a === ends.right?.v || tile.b === ends.right?.v;
      if (canRight && ends.right) {
        const placement = nextCandidate(ends.right);
        if (placement) {
          const marker = createMarker();
          marker.position.x = placement.nx;
          marker.position.z = placement.nz;
          marker.userData.marker = true;
          marker.userData.side = 1;
          piecesGroup.add(marker);
          markers.right = marker;
        }
      }
    },
    [clearMarkers, nextCandidate]
  );

  const renderStatus = useCallback(() => {
    setStatus(gameRef.current.status);
  }, []);

  const canPlayAny = useCallback((hand) => {
    const { ends } = gameRef.current;
    if (!ends || !ends.left || !ends.right) return true;
    return hand.some((tile) =>
      [ends.left.v, ends.right.v].some((value) => tile.a === value || tile.b === value)
    );
  }, []);

  const placeOnBoard = useCallback(
    (tile, side) => {
      const chain = gameRef.current.chain;
      if (!chain.length) return false;
      const { ends } = gameRef.current;
      const end = side < 0 ? ends.left : ends.right;
      if (!end) return false;
      const want = end.v;
      let { a, b } = tile;
      if (a !== want && b === want) {
        [a, b] = [b, a];
      }
      if (a !== want) return false;
      let placement = nextCandidate(end);
      if (!placement) return false;
      const { nx, nz, rot, dx, dz } = placement;
      const newTile = canonTile({ a, b });
      chain.push({ tile: newTile, x: nx, z: nz, rot });
      if (side < 0) {
        gameRef.current.ends.left = { v: b, x: nx, z: nz, dir: [dx, dz] };
      } else {
        gameRef.current.ends.right = { v: b, x: nx, z: nz, dir: [dx, dz] };
      }
      renderChain();
      return true;
    },
    [nextCandidate, renderChain]
  );

  const blockedAndWinner = useCallback(() => {
    const { players, ends, boneyard } = gameRef.current;
    if (!ends?.left || !ends?.right) return null;
    const nobodyCan = players.every((p) => !canPlayAny(p.hand));
    if (nobodyCan && boneyard.length === 0) {
      let best = Infinity;
      let winner = -1;
      players.forEach((player, index) => {
        const sum = pipSum(player.hand);
        if (sum < best) {
          best = sum;
          winner = index;
        }
      });
      return { blocked: true, winner, reason: `Bllokuar. Dora më e ulët = Lojtari ${winner + 1} (${best})` };
    }
    return null;
  }, [canPlayAny]);

  const scheduleCpu = useRef(null);

  const updateButtonsForTurn = useCallback(() => {
    const { current, human, players, boneyard } = gameRef.current;
    if (current !== human) {
      setCanDraw(false);
      setCanPass(false);
      return;
    }
    const hand = players[human]?.hand ?? [];
    const canPlay = canPlayAny(hand);
    setCanDraw(!canPlay && boneyard.length > 0);
    setCanPass(!canPlay && boneyard.length === 0);
  }, [canPlayAny]);

  const updateInteractivity = useCallback(() => {
    const winner = blockedAndWinner();
    if (winner) {
      gameRef.current.status = winner.reason;
      renderStatus();
      setCanDraw(false);
      setCanPass(false);
      return;
    }
    const current = gameRef.current.current;
    gameRef.current.status = `Rradha: Lojtari ${current + 1}`;
    renderStatus();
    layoutHands();
    renderChain();
    updateButtonsForTurn();
  }, [blockedAndWinner, layoutHands, renderChain, renderStatus, updateButtonsForTurn]);

  const nextTurn = useCallback(() => {
    const { players, human } = gameRef.current;
    if (players[human]?.hand?.length === 0) {
      gameRef.current.status = 'Fitove!';
      renderStatus();
      setCanDraw(false);
      setCanPass(false);
      return;
    }
    gameRef.current.current = (gameRef.current.current + 1) % players.length;
    updateInteractivity();
    if (gameRef.current.current === gameRef.current.human) {
      return;
    }

    const runCpuTurn = () => {
      const state = gameRef.current;
      const seat = state.players[state.current];
      if (!seat) return;
      let playableIndex = -1;
      let side = 1;
      if (state.ends?.left && state.ends?.right) {
        for (let i = 0; i < seat.hand.length; i += 1) {
          const tile = seat.hand[i];
          if (tile.a === state.ends.left.v || tile.b === state.ends.left.v) {
            playableIndex = i;
            side = -1;
            break;
          }
          if (tile.a === state.ends.right.v || tile.b === state.ends.right.v) {
            playableIndex = i;
            side = 1;
            break;
          }
        }
      } else {
        playableIndex = 0;
      }
      if (playableIndex < 0) {
        if (state.boneyard.length) {
          const drawn = state.boneyard.pop();
          seat.hand.push(drawn);
          layoutHands();
          scheduleCpu.current = window.setTimeout(runCpuTurn, 420);
          return;
        }
        nextTurn();
        return;
      }
      const tile = seat.hand.splice(playableIndex, 1)[0];
      placeOnBoard(tile, side);
      layoutHands();
      if (seat.hand.length === 0) {
        gameRef.current.status = `Lojtari ${gameRef.current.current + 1} fitoi!`;
        renderStatus();
        setCanDraw(false);
        setCanPass(false);
        return;
      }
      nextTurn();
    };

    window.clearTimeout(scheduleCpu.current);
    scheduleCpu.current = window.setTimeout(runCpuTurn, 520);
  }, [layoutHands, placeOnBoard, renderStatus, updateInteractivity]);

  const startGame = useCallback(() => {
    clearMarkers();
    window.clearTimeout(scheduleCpu.current);
    const state = gameRef.current;
    const seats = seatLayoutRef.current;
    const count = Math.min(Math.max(2, playerCount), seats.length);
    state.players = Array.from({ length: count }, (_, i) => ({ id: i, hand: [] }));
    state.boneyard = shuffle(genSet());
    state.chain = [];
    state.ends = null;
    state.current = 0;
    state.human = 0;
    state.selected = null;
    state.flipDir = !state.flipDir;
    for (let r = 0; r < 7; r += 1) {
      state.players.forEach((player) => {
        const tile = state.boneyard.pop();
        if (tile) player.hand.push(tile);
      });
    }
    state.players.forEach((player) => {
      const shuffled = shuffle(player.hand);
      player.hand.splice(0, player.hand.length, ...shuffled);
    });
    layoutHands();
    let starter = 0;
    let index = -1;
    let best = -1;
    state.players.forEach((player, playerIndex) => {
      const idx = highestDoubleIndex(player.hand);
      if (idx >= 0 && player.hand[idx].a > best) {
        best = player.hand[idx].a;
        starter = playerIndex;
        index = idx;
      }
    });
    if (index < 0) index = 0;
    const tile = state.players[starter].hand.splice(index, 1)[0];
    state.chain.push({ tile: canonTile(tile), x: 0, z: 0, rot: 0 });
    const offset = TILE_STEP;
    if (!state.flipDir) {
      state.ends = {
        left: { v: tile.a, x: -offset, z: 0, dir: [-1, 0] },
        right: { v: tile.b, x: offset, z: 0, dir: [1, 0] }
      };
    } else {
      state.ends = {
        left: { v: tile.a, x: offset, z: 0, dir: [1, 0] },
        right: { v: tile.b, x: -offset, z: 0, dir: [-1, 0] }
      };
    }
    renderChain();
    state.current = (starter + 1) % state.players.length;
    updateInteractivity();
    if (state.current !== state.human) {
      window.clearTimeout(scheduleCpu.current);
      scheduleCpu.current = window.setTimeout(() => nextTurn(), 480);
    }
  }, [clearMarkers, layoutHands, nextTurn, playerCount, renderChain, updateInteractivity]);

  const handleDraw = useCallback(() => {
    const state = gameRef.current;
    if (state.current !== state.human) return;
    while (state.boneyard.length) {
      const tile = state.boneyard.pop();
      if (!tile) continue;
      state.players[state.human].hand.push(tile);
      if (state.ends && (tile.a === state.ends.left?.v || tile.b === state.ends.left?.v || tile.a === state.ends.right?.v || tile.b === state.ends.right?.v)) {
        break;
      }
    }
    state.selected = null;
    clearMarkers();
    layoutHands();
    updateButtonsForTurn();
  }, [clearMarkers, layoutHands, updateButtonsForTurn]);

  const handlePass = useCallback(() => {
    if (gameRef.current.current !== gameRef.current.human) return;
    clearMarkers();
    gameRef.current.selected = null;
    nextTurn();
  }, [clearMarkers, nextTurn]);

  const applyCameraForSeat = useCallback(() => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const seats = seatLayoutRef.current;
    const humanSeat = seats[0];
    if (!renderer || !camera || !humanSeat) return;
    const mount = mountRef.current;
    const width = mount?.clientWidth ?? window.innerWidth;
    const height = mount?.clientHeight ?? window.innerHeight;
    const portrait = height > width;
    const lateral = portrait ? CAMERA_LATERAL_OFFSET.portrait : CAMERA_LATERAL_OFFSET.landscape;
    const retreat = portrait ? CAMERA_RETREAT_OFFSET.portrait : CAMERA_RETREAT_OFFSET.landscape;
    const elevation = portrait ? CAMERA_ELEVATION_OFFSET.portrait : CAMERA_ELEVATION_OFFSET.landscape;
    const position = humanSeat.stoolAnchor
      .clone()
      .addScaledVector(humanSeat.forward, -retreat)
      .addScaledVector(humanSeat.right, lateral);
    const maxCameraHeight = ARENA_WALL_TOP_Y - CAMERA_WALL_HEIGHT_MARGIN;
    position.y = Math.min(humanSeat.stoolHeight + elevation, maxCameraHeight);
    const focusBase = new THREE.Vector3(0, TABLE_HEIGHT + CAMERA_FOCUS_LIFT, 0);
    const chipFocus = humanSeat.forward.clone().multiplyScalar(TABLE_RADIUS * 0.18);
    const focusForwardPull = portrait ? PORTRAIT_CAMERA_PLAYER_FOCUS_FORWARD_PULL : CAMERA_PLAYER_FOCUS_FORWARD_PULL;
    chipFocus.addScaledVector(humanSeat.forward, -focusForwardPull);
    chipFocus.y = TABLE_HEIGHT + (portrait ? PORTRAIT_CAMERA_PLAYER_FOCUS_HEIGHT : CAMERA_PLAYER_FOCUS_HEIGHT);
    const blend = portrait ? PORTRAIT_CAMERA_PLAYER_FOCUS_BLEND : CAMERA_PLAYER_FOCUS_BLEND;
    const focus = focusBase.lerp(chipFocus, blend);
    camera.position.copy(position);
    camera.lookAt(focus);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    applyRendererSRGB(renderer);
    renderer.shadowMap.enabled = true;
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#030712');
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      CAMERA_SETTINGS.fov,
      mount.clientWidth / mount.clientHeight,
      CAMERA_SETTINGS.near,
      CAMERA_SETTINGS.far
    );
    camera.position.set(0, TABLE_HEIGHT * 2.85, TABLE_RADIUS * 3.9);
    cameraRef.current = camera;

    const ambient = new THREE.AmbientLight(0xffffff, 1.08);
    scene.add(ambient);
    const spot = new THREE.SpotLight(0xffffff, 4.8384, TABLE_RADIUS * 10, Math.PI / 3, 0.35, 1);
    spot.position.set(3, 7, 3);
    spot.castShadow = true;
    scene.add(spot);
    const rim = new THREE.PointLight(0x33ccff, 1.728);
    rim.position.set(-4, 3, -4);
    scene.add(rim);

    const arenaGroup = new THREE.Group();
    scene.add(arenaGroup);
    arenaRef.current = arenaGroup;

    const floorGeometry = new THREE.CircleGeometry(TABLE_RADIUS * ARENA_GROWTH * 3.2, 64);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x0b1120, roughness: 0.9, metalness: 0.1 });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    arenaGroup.add(floor);

    const carpet = new THREE.Mesh(
      new THREE.CircleGeometry(TABLE_RADIUS * ARENA_GROWTH * 2.2, 64),
      createArenaCarpetMaterial(new THREE.Color('#0f172a'), new THREE.Color('#1e3a8a'))
    );
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.y = 0.01;
    carpet.receiveShadow = true;
    arenaGroup.add(carpet);

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
    arenaGroup.add(wall);

    const defaults = DEFAULT_TABLE_CUSTOMIZATION;
    const tableInfo = createMurlanStyleTable({
      arena: arenaGroup,
      renderer,
      tableRadius: TABLE_RADIUS,
      tableHeight: TABLE_HEIGHT,
      woodOption: TABLE_WOOD_OPTIONS[defaults.tableWood],
      clothOption: TABLE_CLOTH_OPTIONS[defaults.tableCloth],
      baseOption: TABLE_BASE_OPTIONS[defaults.tableBase],
      shapeOption: TABLE_SHAPE_OPTIONS[0]
    });
    tableRef.current = tableInfo;
    boardRadiusRef.current = tableInfo.feltRadius * 0.78;

    const piecesGroup = new THREE.Group();
    arenaGroup.add(piecesGroup);
    piecesGroupRef.current = piecesGroup;

    const chairOption = CHAIR_COLOR_OPTIONS[0];
    const chairMaterial = createChairFabricMaterial(chairOption, renderer);
    const legMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(chairOption.legColor) });

    const totalSeats = 6;
    const seats = [];
    for (let i = 0; i < totalSeats; i += 1) {
      const angle = Math.PI / 2 - HUMAN_SEAT_ROTATION_OFFSET - (i / totalSeats) * Math.PI * 2;
      const forward = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
      const right = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));
      const seatPos = forward.clone().multiplyScalar(CHAIR_RADIUS);
      seatPos.y = CHAIR_BASE_HEIGHT;
      const stoolAnchor = forward.clone().multiplyScalar(CHAIR_RADIUS);
      stoolAnchor.y = STOOL_HEIGHT;
      seats.push({ angle, forward, right, seatPos, stoolAnchor, stoolHeight: STOOL_HEIGHT });

      const group = new THREE.Group();
      group.position.copy(seatPos);
      group.lookAt(new THREE.Vector3(0, seatPos.y, 0));

      const seatMesh = new THREE.Mesh(new THREE.BoxGeometry(SEAT_WIDTH, SEAT_THICKNESS, SEAT_DEPTH), chairMaterial);
      seatMesh.position.y = SEAT_THICKNESS / 2;
      seatMesh.castShadow = true;
      seatMesh.receiveShadow = true;
      group.add(seatMesh);

      const backMesh = new THREE.Mesh(new THREE.BoxGeometry(SEAT_WIDTH, BACK_HEIGHT, ARM_THICKNESS * 0.6), chairMaterial);
      backMesh.position.set(0, SEAT_THICKNESS / 2 + BACK_HEIGHT / 2, -SEAT_DEPTH / 2 + ARM_THICKNESS * 0.3);
      backMesh.castShadow = true;
      backMesh.receiveShadow = true;
      group.add(backMesh);

      const armLeft = createStraightArmrest('left', chairMaterial);
      const armRight = createStraightArmrest('right', chairMaterial);
      group.add(armLeft, armRight);

      const legBase = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16 * MODEL_SCALE * STOOL_SCALE, 0.2 * MODEL_SCALE * STOOL_SCALE, BASE_COLUMN_HEIGHT, 16),
        legMaterial
      );
      legBase.position.y = -SEAT_THICKNESS / 2 - BASE_COLUMN_HEIGHT / 2;
      legBase.castShadow = true;
      legBase.receiveShadow = true;
      group.add(legBase);

      arenaGroup.add(group);
    }
    seatLayoutRef.current = seats;

    const animate = (time) => {
      animationRef.current = time;
      renderer.render(scene, camera);
      window.requestAnimationFrame(animate);
    };
    window.requestAnimationFrame(animate);

    const handleResize = () => {
      applyCameraForSeat();
    };
    window.addEventListener('resize', handleResize);
    applyCameraForSeat();

    const handlePointerDown = (event) => {
      const state = gameRef.current;
      if (state.current !== state.human) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
      pointerRef.current.set(x, y);
      raycasterRef.current.setFromCamera(pointerRef.current, camera);
      const intersects = raycasterRef.current.intersectObjects(piecesGroup.children, true);
      if (!intersects.length) return;
      const root = (() => {
        let obj = intersects[0].object;
        while (obj) {
          if (obj.userData?.tile || obj.userData?.marker) return obj;
          obj = obj.parent;
        }
        return intersects[0].object;
      })();
      if (root.userData?.owner === state.human && root.userData.tile) {
        state.selected = root.userData.tile;
        showMarkersFor(root.userData.tile);
        state.status = 'Zgjidh skajin (tap marker)';
        renderStatus();
        return;
      }
      if (root.userData?.marker && state.selected) {
        const markerSide = root.userData.side;
        const hand = state.players[state.human].hand;
        const idx = hand.indexOf(state.selected);
        if (idx >= 0) {
          const tile = hand.splice(idx, 1)[0];
          if (!placeOnBoard(tile, markerSide)) {
            hand.splice(idx, 0, tile);
          }
          state.selected = null;
          clearMarkers();
          layoutHands();
          nextTurn();
        }
      }
    };
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);

    return () => {
      window.clearTimeout(scheduleCpu.current);
      window.cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      clearMarkers();
      seatLayoutRef.current = [];
      piecesGroup.clear?.();
      tableInfo.dispose?.();
      arenaGroup.remove(piecesGroup);
      arenaGroup.remove(wall, carpet, floor);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      scene.clear();
    };
  }, [applyCameraForSeat, clearMarkers, layoutHands, nextTurn, placeOnBoard, renderChain, renderStatus, showMarkersFor, updateInteractivity]);

  return (
    <div className="fixed inset-0 bg-black">
      <div ref={mountRef} className="absolute inset-0" />
      <div className="absolute inset-x-0 bottom-0 flex justify-center pb-4">
        <div className="flex gap-2 rounded-xl bg-emerald-900/80 px-4 py-3 text-white shadow-lg">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <span>Lojtarë</span>
            <select
              value={playerCount}
              onChange={(event) => setPlayerCount(Number.parseInt(event.target.value, 10) || 4)}
              className="rounded-lg bg-emerald-700 px-2 py-1 text-base font-bold"
            >
              {[2, 3, 4].map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="rounded-lg bg-amber-300 px-3 py-1 text-base font-bold text-slate-900"
            onClick={startGame}
          >
            Start
          </button>
          <button
            type="button"
            className="rounded-lg bg-amber-300 px-3 py-1 text-base font-bold text-slate-900 disabled:opacity-40"
            onClick={handleDraw}
            disabled={!canDraw}
          >
            Tërhiq
          </button>
          <button
            type="button"
            className="rounded-lg bg-amber-300 px-3 py-1 text-base font-bold text-slate-900 disabled:opacity-40"
            onClick={handlePass}
            disabled={!canPass}
          >
            Kalo
          </button>
          <button
            type="button"
            className="rounded-lg bg-slate-800 px-3 py-1 text-sm font-semibold"
            onClick={() => setRulesOpen(true)}
          >
            Rregulla
          </button>
        </div>
      </div>
      <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-lg bg-black/65 px-4 py-2 text-center text-sm font-bold text-white shadow-lg">
        {status}
      </div>
      {rulesOpen && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          onClick={() => setRulesOpen(false)}
          role="presentation"
        >
          <div
            className="max-w-xl rounded-2xl bg-white p-6 text-slate-900 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="presentation"
          >
            <h2 className="mb-3 text-lg font-bold">Domino Shqiptare — Rregulla për 2–4 lojtarë</h2>
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed">
              <li>
                <strong>Set:</strong> Double-Six (28 gurë, 0–6). Çdo gur unik (a,b) me a≤b. Dublikatat nuk lejohen.
              </li>
              <li>
                <strong>Shpërndarja:</strong> 7 gurë secili. Pjesa tjetër = <em>stok</em> (boneyard).
              </li>
              <li>
                <strong>Nisja:</strong> Kush ka dopion më të lartë nis. Në mungesë dopios, nis ai me gurin më të lartë.
              </li>
              <li>
                <strong>Vënia:</strong> Gjarpër mbi rrobën jeshile; dopiot vertikale. Kur afrohesh skajit, kthe 90° brenda fushës.
              </li>
              <li>
                <strong>Përputhja:</strong> Skaji i lirë duhet të përputhet në vlerë. Dopio pranon të njëjtën vlerë në të dyja anët.
              </li>
              <li>
                <strong>Nëse s’ke lojë:</strong> Tërhiq nga stok-u derisa të kesh lojë. Nëse stok-u mbaron, kalon rradha.
              </li>
              <li>
                <strong>Mbyllja:</strong> Fiton ai që mbaron i pari ose kur loja bllokohet – fiton ai me shumën më të ulët të pikëve në dorë.
              </li>
            </ol>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
                onClick={() => setRulesOpen(false)}
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

export default DominoRoyalArena;

