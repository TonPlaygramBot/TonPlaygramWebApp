import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import * as THREE from 'three';
import {
  createArenaCarpetMaterial,
  createArenaWallMaterial
} from '../../utils/arenaDecor.js';
import { applyRendererSRGB } from '../../utils/colorSpace.js';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import {
  getTelegramFirstName,
  getTelegramUsername,
  getTelegramPhotoUrl
} from '../../utils/telegram.js';
import coinConfetti from '../../utils/coinConfetti';
import {
  dropSound,
  snakeSound,
  cheerSound
} from '../../assets/soundData.js';
import { getGameVolume } from '../../utils/sound.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const TABLE_TOP_SIZE = 3.4 + 0.6;
const TABLE_TOP_THICKNESS = 0.18;
const TABLE_LEG_HEIGHT = 0.85 * 2;
const TABLE_LEG_INSET = 0.45;

const WALL_PROXIMITY_FACTOR = 0.5;
const WALL_HEIGHT_MULTIPLIER = 2;
const CHAIR_SCALE = 4;
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
const CHESS_ARENA = Object.freeze({
  width: (SNOOKER_ROOM_WIDTH * SNOOKER_WORLD_SCALE) / 2,
  depth: (SNOOKER_ROOM_DEPTH * SNOOKER_WORLD_SCALE) / 2
});

const CAM = {
  fov: 52,
  near: 0.1,
  far: 5000,
  minR: 3.4 * CAMERA_MIN_RADIUS_FACTOR,
  maxR: 3.4 * CAMERA_MAX_RADIUS_FACTOR,
  phiMin: 0.92,
  phiMax: 1.22
};

const LUDO_GRID = 15;
const LUDO_TILE = 0.075;
const RAW_BOARD_SIZE = LUDO_GRID * LUDO_TILE;
const BOARD_DISPLAY_SIZE = 3.4;
const BOARD_SCALE = BOARD_DISPLAY_SIZE / RAW_BOARD_SIZE;
const RING_STEPS = 52;
const HOME_STEPS = 4;
const GOAL_PROGRESS = RING_STEPS + HOME_STEPS;
const PLAYER_START_INDEX = [0, 13, 26, 39];
const COLOR_NAMES = ['Red', 'Green', 'Yellow', 'Blue'];
const PLAYER_COLORS = [0xef4444, 0x22c55e, 0xf59e0b, 0x3b82f6];

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
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
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

function makeDice(matWhite, matPip) {
  const dice = new THREE.Group();
  const box = new THREE.Mesh(
    makeRoundedBoxGeometry(0.07, 0.07, 0.07, 0.012, 4),
    matWhite
  );
  dice.add(box);

  const pipRadius = 0.0062;
  const pipDepth = 0.0065;
  const halfSize = 0.07 / 2;
  const faceInset = 0.0045;
  const faceOffset = halfSize - faceInset;
  const pipSpread = 0.0165;

  const faces = [
    {
      normal: new THREE.Vector3(0, 0, 1),
      u: new THREE.Vector3(1, 0, 0),
      v: new THREE.Vector3(0, 1, 0),
      coords: [[0, 0]]
    },
    {
      normal: new THREE.Vector3(0, 0, -1),
      u: new THREE.Vector3(-1, 0, 0),
      v: new THREE.Vector3(0, 1, 0),
      coords: [
        [-pipSpread, -pipSpread],
        [pipSpread, -pipSpread],
        [-pipSpread, 0],
        [pipSpread, 0],
        [-pipSpread, pipSpread],
        [pipSpread, pipSpread]
      ]
    },
    {
      normal: new THREE.Vector3(1, 0, 0),
      u: new THREE.Vector3(0, 0, -1),
      v: new THREE.Vector3(0, 1, 0),
      coords: [
        [-pipSpread, pipSpread],
        [0, 0],
        [pipSpread, -pipSpread]
      ]
    },
    {
      normal: new THREE.Vector3(-1, 0, 0),
      u: new THREE.Vector3(0, 0, 1),
      v: new THREE.Vector3(0, 1, 0),
      coords: [
        [-pipSpread, pipSpread],
        [-pipSpread, -pipSpread],
        [pipSpread, pipSpread],
        [pipSpread, -pipSpread]
      ]
    },
    {
      normal: new THREE.Vector3(0, 1, 0),
      u: new THREE.Vector3(1, 0, 0),
      v: new THREE.Vector3(0, 0, -1),
      coords: [
        [-pipSpread, pipSpread],
        [-pipSpread, -pipSpread],
        [0, 0],
        [pipSpread, pipSpread],
        [pipSpread, -pipSpread]
      ]
    },
    {
      normal: new THREE.Vector3(0, -1, 0),
      u: new THREE.Vector3(1, 0, 0),
      v: new THREE.Vector3(0, 0, 1),
      coords: [
        [-pipSpread, -pipSpread],
        [pipSpread, pipSpread]
      ]
    }
  ];

  const baseSphere = new THREE.SphereGeometry(pipRadius, 24, 18);
  const up = new THREE.Vector3(0, 0, 1);

  faces.forEach(({ normal, u, v, coords }) => {
    const n = normal.clone().normalize();
    const planeConstant = -(faceOffset - pipDepth);
    coords.forEach(([cx, cy]) => {
      const pos = n
        .clone()
        .multiplyScalar(faceOffset)
        .add(u.clone().multiplyScalar(cx))
        .add(v.clone().multiplyScalar(cy));
      const pipMaterial = matPip.clone();
      pipMaterial.side = THREE.BackSide;
      pipMaterial.clippingPlanes = [new THREE.Plane(n.clone(), planeConstant)];
      const pip = new THREE.Mesh(baseSphere, pipMaterial);
      pip.position.copy(pos.clone().addScaledVector(n, -pipDepth));
      const quat = new THREE.Quaternion().setFromUnitVectors(up, n);
      pip.quaternion.copy(quat);
      dice.add(pip);
    });
  });

  dice.userData.setValue = (val) => {
    setDiceOrientation(dice, val);
  };
  return dice;
}

function setDiceOrientation(dice, val) {
  const q = new THREE.Quaternion();
  const eulers = {
    1: new THREE.Euler(0, 0, 0),
    2: new THREE.Euler(Math.PI / 2, 0, 0),
    3: new THREE.Euler(0, -Math.PI / 2, 0),
    4: new THREE.Euler(0, Math.PI / 2, 0),
    5: new THREE.Euler(0, 0, 0),
    6: new THREE.Euler(-Math.PI / 2, 0, 0)
  };
  const e = eulers[val] || eulers[1];
  q.setFromEuler(e);
  dice.setRotationFromQuaternion(q);
}

function spinDice(dice, duration = 700) {
  return new Promise((resolve) => {
    const start = performance.now();
    const target = 1 + Math.floor(Math.random() * 6);
    (function step() {
      const t = performance.now() - start;
      const k = Math.min(1, t / duration);
      dice.rotation.x += 0.38 * (1 - k);
      dice.rotation.y += 0.41 * (1 - k);
      dice.rotation.z += 0.33 * (1 - k);
      if (k < 1) {
        requestAnimationFrame(step);
      } else {
        setDiceOrientation(dice, target);
        resolve(target);
      }
    })();
  });
}

function makeTokenMaterial(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
}

function makeRook(mat) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.018, 24), mat);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.036, 24), mat);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.004, 8, 24), mat);
  base.position.y = 0.009;
  body.position.y = 0.009 + 0.018;
  rim.position.y = 0.009 + 0.036 + 0.006;
  rim.rotation.x = Math.PI / 2;
  g.add(base, body, rim);
  return g;
}

function ease(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function Ludo3D({ avatar, username }) {
  const wrapRef = useRef(null);
  const rafRef = useRef(0);
  const zoomRef = useRef({});
  const diceRef = useRef(null);
  const turnIndicatorRef = useRef(null);
  const stateRef = useRef(null);
  const moveSoundRef = useRef(null);
  const captureSoundRef = useRef(null);
  const cheerSoundRef = useRef(null);
  const [ui, setUi] = useState({
    turn: 0,
    status: 'Red to roll',
    dice: null,
    winner: null
  });

  const updateTurnIndicator = (player) => {
    const indicator = turnIndicatorRef.current;
    if (!indicator) return;
    const material = Array.isArray(indicator.material)
      ? indicator.material[0]
      : indicator.material;
    if (!material) return;
    const color = new THREE.Color(PLAYER_COLORS[player]);
    material.color.set(color);
    if (material.emissive) {
      material.emissive.set(color.clone().multiplyScalar(0.3));
    }
  };

  useEffect(() => {
    const vol = getGameVolume();
    moveSoundRef.current = new Audio(dropSound);
    captureSoundRef.current = new Audio(snakeSound);
    cheerSoundRef.current = new Audio(cheerSound);
    [moveSoundRef, captureSoundRef, cheerSoundRef].forEach((ref) => {
      if (ref.current) ref.current.volume = vol;
    });
    const onVolChange = () => {
      const next = getGameVolume();
      [moveSoundRef, captureSoundRef, cheerSoundRef].forEach((ref) => {
        if (ref.current) ref.current.volume = next;
      });
    };
    window.addEventListener('gameVolumeChanged', onVolChange);
    return () => {
      window.removeEventListener('gameVolumeChanged', onVolChange);
    };
  }, []);

  useEffect(() => {
    const host = wrapRef.current;
    if (!host) return;
    let scene, camera, renderer;
    let sph;
    const orbit = { drag: false, x: 0, y: 0 };

    const vol = getGameVolume();
    moveSoundRef.current?.pause();
    captureSoundRef.current?.pause();
    cheerSoundRef.current?.pause();
    if (moveSoundRef.current) moveSoundRef.current.volume = vol;
    if (captureSoundRef.current) captureSoundRef.current.volume = vol;
    if (cheerSoundRef.current) cheerSoundRef.current.volume = vol;

    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    renderer.localClippingEnabled = true;
    applyRendererSRGB(renderer);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.zIndex = '0';
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

    const arena = new THREE.Group();
    scene.add(arena);

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
      boardGroup.position.y + 0.16,
      0
    );
    spotTarget.position.copy(boardLookTarget);
    spot.target.updateMatrixWorld();
    studioCamA.lookAt(boardLookTarget);
    studioCamB.lookAt(boardLookTarget);

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

    const boardData = buildLudoBoard(boardGroup);
    diceRef.current = boardData.dice;
    turnIndicatorRef.current = boardData.turnIndicator;
    updateTurnIndicator(0);

    stateRef.current = {
      paths: boardData.paths,
      startPads: boardData.startPads,
      homeColumns: boardData.homeColumns,
      goalSlots: boardData.goalSlots,
      tokens: boardData.tokens,
      turnIndicator: boardData.turnIndicator,
      progress: Array.from({ length: 4 }, () => Array(4).fill(-1)),
      turn: 0,
      winner: null,
      animation: null
    };

    const onDown = (e) => {
      orbit.drag = true;
      orbit.x = e.clientX || e.touches?.[0]?.clientX || 0;
      orbit.y = e.clientY || e.touches?.[0]?.clientY || 0;
    };
    const onMove = (e) => {
      if (!orbit.drag) return;
      const x = e.clientX || e.touches?.[0]?.clientX || orbit.x;
      const y = e.clientY || e.touches?.[0]?.clientY || orbit.y;
      const dx = x - orbit.x;
      const dy = y - orbit.y;
      orbit.x = x;
      orbit.y = y;
      sph.theta -= dx * 0.004;
      const phiDelta = -dy * CAMERA_VERTICAL_SENSITIVITY;
      sph.phi = clamp(sph.phi + phiDelta, CAM.phiMin, CAM.phiMax);
      const leanDelta = dy * CAMERA_LEAN_STRENGTH;
      sph.radius = clamp(sph.radius - leanDelta, CAM.minR, CAM.maxR);
      fit();
    };
    const onUp = () => {
      orbit.drag = false;
    };
    const onWheel = (e) => {
      const r = sph.radius || initialRadius;
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

    const step = () => {
      const state = stateRef.current;
      const anim = state?.animation;
      if (anim && anim.active && anim.token) {
        anim.t += 0.02;
        const { path, segment } = anim;
        const from = path[segment];
        const to = path[segment + 1];
        if (from && to) {
          const k = ease(Math.min(1, anim.t));
          const pos = from.clone().lerp(to, k);
          pos.y += Math.sin(k * Math.PI) * 0.02;
          anim.token.position.copy(pos);
          anim.token.rotation.y += 0.08;
          if (anim.t >= 1) {
            anim.segment += 1;
            anim.t = 0;
            if (anim.segment >= path.length - 1) {
              anim.active = false;
              anim.token.rotation.y = 0;
              const done = anim.onComplete;
              state.animation = null;
              done?.();
            }
          }
        }
      }
      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(step);
    };
    step();

    const onResize = () => fit();
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      stateRef.current = null;
      turnIndicatorRef.current = null;
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('mousedown', onDown);
      renderer.domElement.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      renderer.domElement.removeEventListener('touchstart', onDown);
      renderer.domElement.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.dispose();
      if (renderer.domElement.parentElement === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, []);

  const playMove = () => {
    if (moveSoundRef.current) {
      moveSoundRef.current.currentTime = 0;
      moveSoundRef.current.play().catch(() => {});
    }
  };

  const playCapture = () => {
    if (captureSoundRef.current) {
      captureSoundRef.current.currentTime = 0;
      captureSoundRef.current.play().catch(() => {});
    }
  };

  const playCheer = () => {
    if (cheerSoundRef.current) {
      cheerSoundRef.current.currentTime = 0;
      cheerSoundRef.current.play().catch(() => {});
    }
  };

  const getWorldForProgress = (player, progress, tokenIndex) => {
    const state = stateRef.current;
    if (!state) return new THREE.Vector3();
    if (progress < 0) {
      return state.startPads[player][tokenIndex]
        .clone()
        .add(new THREE.Vector3(0, 0.012, 0));
    }
    if (progress < RING_STEPS) {
      const idx = (PLAYER_START_INDEX[player] + progress) % RING_STEPS;
      return state.paths[idx].clone().add(new THREE.Vector3(0, 0.012, 0));
    }
    if (progress < RING_STEPS + HOME_STEPS) {
      const homeStep = progress - RING_STEPS;
      return state.homeColumns[player][homeStep]
        .clone()
        .add(new THREE.Vector3(0, 0.012, 0));
    }
    return state.goalSlots[player][tokenIndex]
      .clone()
      .add(new THREE.Vector3(0, 0.012, 0));
  };

  const scheduleMove = (player, tokenIndex, targetProgress, onComplete) => {
    const state = stateRef.current;
    if (!state) return;
    const fromProgress = state.progress[player][tokenIndex];
    const path = [];
    if (fromProgress < 0) {
      path.push(getWorldForProgress(player, -1, tokenIndex));
      path.push(getWorldForProgress(player, 0, tokenIndex));
    } else {
      path.push(getWorldForProgress(player, fromProgress, tokenIndex));
      for (let p = fromProgress + 1; p <= targetProgress; p++) {
        path.push(getWorldForProgress(player, p, tokenIndex));
      }
    }
    const token = state.tokens[player][tokenIndex];
    state.animation = {
      active: true,
      token,
      path,
      segment: 0,
      t: 0,
      onComplete
    };
  };

  const advanceTurn = (extraTurn) => {
    setUi((s) => {
      if (s.winner) return s;
      const nextTurn = extraTurn ? s.turn : (s.turn + 1) % 4;
      const state = stateRef.current;
      if (state) state.turn = nextTurn;
      updateTurnIndicator(nextTurn);
      return {
        ...s,
        turn: nextTurn,
        status: `${COLOR_NAMES[nextTurn]} to roll`,
        dice: null
      };
    });
  };

  const handleCaptures = (player, tokenIndex) => {
    const state = stateRef.current;
    if (!state) return;
    const prog = state.progress[player][tokenIndex];
    if (prog < 0 || prog >= RING_STEPS) return;
    const landingIdx = (PLAYER_START_INDEX[player] + prog) % RING_STEPS;
    const safeStarts = [0, 8, 16, 24];
    if (safeStarts.includes(landingIdx)) return;
    for (let p = 0; p < 4; p++) {
      if (p === player) continue;
      for (let t = 0; t < 4; t++) {
        if (state.progress[p][t] < 0 || state.progress[p][t] >= RING_STEPS) continue;
        const idx = (PLAYER_START_INDEX[p] + state.progress[p][t]) % RING_STEPS;
        if (idx === landingIdx) {
          state.progress[p][t] = -1;
          const token = state.tokens[p][t];
          const pos = state.startPads[p][t]
            .clone()
            .add(new THREE.Vector3(0, 0.012, 0));
          token.position.copy(pos);
          token.rotation.set(0, 0, 0);
          playCapture();
        }
      }
    }
  };

  const checkWin = (player) => {
    const state = stateRef.current;
    if (!state) return false;
    const allHome = state.progress[player].every((p) => p >= GOAL_PROGRESS);
    if (allHome) {
      state.winner = player;
      setUi((s) => ({
        ...s,
        winner: COLOR_NAMES[player],
        status: `${COLOR_NAMES[player]} wins!`
      }));
      playCheer();
      coinConfetti();
      return true;
    }
    return false;
  };

  const moveToken = (player, tokenIndex, roll) => {
    const state = stateRef.current;
    if (!state) return;
    const current = state.progress[player][tokenIndex];
    const entering = current < 0;
    const target = entering ? 0 : current + roll;
    if (target > GOAL_PROGRESS) return advanceTurn(false);
    const applyResult = () => {
      state.progress[player][tokenIndex] = target;
      const finalPos = getWorldForProgress(player, target, tokenIndex);
      state.tokens[player][tokenIndex].position.copy(finalPos);
      state.tokens[player][tokenIndex].rotation.set(0, 0, 0);
      playMove();
      handleCaptures(player, tokenIndex);
      const winner = checkWin(player);
      advanceTurn(!winner && roll === 6);
    };
    if (entering || target !== current) {
      scheduleMove(player, tokenIndex, target, applyResult);
    } else {
      applyResult();
    }
  };

  const getMovableTokens = (player, roll) => {
    const state = stateRef.current;
    if (!state) return [];
    const list = [];
    for (let i = 0; i < 4; i++) {
      const prog = state.progress[player][i];
      if (prog < 0) {
        if (roll === 6) list.push({ token: i, entering: true });
        continue;
      }
      const target = prog + roll;
      if (target <= GOAL_PROGRESS) list.push({ token: i, entering: false });
    }
    return list;
  };

  const rollDice = async () => {
    const state = stateRef.current;
    if (!state || state.winner) return;
    if (state.animation) return;
    const dice = diceRef.current;
    if (!dice) return;
    const value = await spinDice(dice, 700);
    setUi((s) => ({ ...s, dice: value }));
    const player = state.turn;
    const options = getMovableTokens(player, value);
    if (!options.length) {
      advanceTurn(value === 6);
      return;
    }
    const choice = options[0];
    moveToken(player, choice.token, value);
  };

  return (
    <div
      ref={wrapRef}
      className="fixed inset-0 bg-[#0c1020] text-white touch-none select-none"
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-3 left-3 bg-white/10 rounded px-3 py-2 text-xs">
          <div className="font-semibold">{ui.status}</div>
          {ui.dice != null && (
            <div className="text-[10px] mt-1">Rolled: {ui.dice}</div>
          )}
        </div>
        <div className="absolute top-3 right-3 flex items-center space-x-2 bg-white/10 rounded-full px-3 py-1 text-xs">
          {avatar && (
            <img
              src={avatar}
              alt="avatar"
              className="h-7 w-7 rounded-full object-cover"
            />
          )}
          <span>{username || 'Guest'}</span>
        </div>
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto">
          <button
            onClick={rollDice}
            className="px-6 py-3 bg-primary hover:bg-primary-hover rounded-xl text-sm font-semibold shadow-lg"
            disabled={!!ui.winner}
          >
            {ui.winner ? `${ui.winner} Wins` : 'ROLL'}
          </button>
        </div>
        <div className="absolute right-3 bottom-3 flex flex-col space-y-2">
          <button
            onClick={() => zoomRef.current.zoomIn?.()}
            className="text-xl bg-white/10 hover:bg-white/20 rounded px-2 py-1"
          >
            +
          </button>
          <button
            onClick={() => zoomRef.current.zoomOut?.()}
            className="text-xl bg-white/10 hover:bg-white/20 rounded px-2 py-1"
          >
            -
          </button>
        </div>
      </div>
    </div>
  );
}

function buildLudoBoard(boardGroup) {
  const scene = boardGroup;
  const plateMat = new THREE.MeshStandardMaterial({
    color: 0x11172a,
    roughness: 0.92
  });
  const tileMat = new THREE.MeshStandardMaterial({
    color: 0xf3f4f6,
    roughness: 0.9
  });
  const safeMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.85
  });
  const centerMat = new THREE.MeshStandardMaterial({
    color: 0x1f2937,
    roughness: 0.9
  });

  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(RAW_BOARD_SIZE + 0.04, 0.02, RAW_BOARD_SIZE + 0.04),
    plateMat
  );
  plate.position.y = -0.011;
  scene.add(plate);

  const half = (LUDO_GRID * LUDO_TILE) / 2;
  const cellToWorld = (r, c) => {
    const x = -half + (c + 0.5) * LUDO_TILE;
    const z = -half + (r + 0.5) * LUDO_TILE;
    return new THREE.Vector3(x, 0.005, z);
  };

  const startPads = getHomeStartPads(half);
  const homeColumns = [[], [], [], []];
  const goalSlots = getGoalSlots(half);
  const ringPath = buildRingFromGrid(cellToWorld);

  const tileGeo = new THREE.BoxGeometry(LUDO_TILE * 0.96, 0.01, LUDO_TILE * 0.96);
  const homeBaseMats = PLAYER_COLORS.map((color) => {
    const darker = new THREE.Color(color).multiplyScalar(0.72);
    return new THREE.MeshStandardMaterial({ color: darker, roughness: 0.85 });
  });
  const pathMats = PLAYER_COLORS.map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.8 })
  );
  const safeSet = new Set(['6,0', '0,8', '8,14', '14,6']);
  const center = cellToWorld(7, 7);

  for (let r = 0; r < LUDO_GRID; r++) {
    for (let c = 0; c < LUDO_GRID; c++) {
      const pos = cellToWorld(r, c);
      const key = `${r},${c}`;
      const homeIndex = getHomeIndex(r, c);
      const columnIndex = getHomeColumnIndex(r, c);
      const inCenter = r >= 6 && r <= 8 && c >= 6 && c <= 8;
      const inCross = r >= 6 && r <= 8 || c >= 6 && c <= 8;
      if (homeIndex !== -1) {
        const mesh = new THREE.Mesh(tileGeo, homeBaseMats[homeIndex]);
        mesh.position.copy(pos);
        scene.add(mesh);
        continue;
      }
      if (inCenter) {
        const mesh = new THREE.Mesh(tileGeo, centerMat);
        mesh.position.copy(pos);
        scene.add(mesh);
        continue;
      }
      if (columnIndex !== -1) {
        const mesh = new THREE.Mesh(tileGeo, pathMats[columnIndex]);
        mesh.position.copy(pos);
        scene.add(mesh);
        const dist = pos.distanceTo(center);
        homeColumns[columnIndex].push({ dist, pos });
        continue;
      }
      if (inCross) {
        const mat = safeSet.has(key) ? safeMat : tileMat;
        const mesh = new THREE.Mesh(tileGeo, mat);
        mesh.position.copy(pos);
        scene.add(mesh);
      }
    }
  }

  const sortedColumns = homeColumns.map((list) =>
    list
      .sort((a, b) => b.dist - a.dist)
      .map((item) => item.pos.clone())
  );

  const tokens = PLAYER_COLORS.map((color, playerIdx) => {
    return Array.from({ length: 4 }, (_, i) => {
      const rook = makeRook(makeTokenMaterial(color));
      rook.position.copy(startPads[playerIdx][i].clone().add(new THREE.Vector3(0, 0.012, 0)));
      scene.add(rook);
      return rook;
    });
  });

  const dice = makeDice(
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.38 }),
    new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.95 })
  );
  dice.position.set(0, 0.082, 0);
  scene.add(dice);

  const indicatorMat = new THREE.MeshStandardMaterial({
    color: PLAYER_COLORS[0],
    emissive: new THREE.Color(PLAYER_COLORS[0]).multiplyScalar(0.3),
    emissiveIntensity: 0.9,
    metalness: 0.45,
    roughness: 0.35,
    side: THREE.DoubleSide
  });
  const turnIndicator = new THREE.Mesh(
    new THREE.RingGeometry(0.05, 0.075, 48),
    indicatorMat
  );
  turnIndicator.rotation.x = -Math.PI / 2;
  turnIndicator.position.set(0, 0.006, 0);
  scene.add(turnIndicator);

  return {
    paths: ringPath,
    startPads,
    homeColumns: sortedColumns,
    goalSlots,
    tokens,
    dice,
    turnIndicator
  };
}

function getHomeIndex(r, c) {
  if (r < 6 && c < 6) return 0;
  if (r < 6 && c > 8) return 1;
  if (r > 8 && c < 6) return 2;
  if (r > 8 && c > 8) return 3;
  return -1;
}

function getHomeColumnIndex(r, c) {
  if (c === 7 && r >= 3 && r <= 6) return 0;
  if (r === 7 && c >= 8 && c <= 11) return 1;
  if (c === 7 && r >= 8 && r <= 11) return 3;
  if (r === 7 && c >= 3 && c <= 6) return 2;
  return -1;
}

function buildRingFromGrid(cellToWorld) {
  const pts = [];
  for (let c = 0; c < 15; c++) pts.push(cellToWorld(6, c));
  for (let r = 7; r < 15; r++) pts.push(cellToWorld(r, 8));
  for (let c = 14; c >= 0; c--) pts.push(cellToWorld(8, c));
  for (let r = 7; r >= 1; r--) pts.push(cellToWorld(r, 6));
  const dedup = [];
  const keySet = new Set();
  for (const p of pts) {
    const key = `${p.x.toFixed(3)},${p.z.toFixed(3)}`;
    if (!keySet.has(key)) {
      keySet.add(key);
      dedup.push(p.clone());
    }
  }
  if (dedup.length > 52) {
    const out = [];
    const step = (dedup.length - 1) / 52;
    for (let i = 0; i < 52; i++) {
      out.push(dedup[Math.round(i * step)].clone());
    }
    return out;
  }
  return dedup;
}

function getHomeStartPads(half) {
  const TILE = LUDO_TILE;
  const off = half - TILE * 3;
  const layout = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1]
  ];
  return layout.map(([sx, sz]) => {
    const cx = sx * off;
    const cz = sz * off;
    return [
      new THREE.Vector3(cx - 0.8 * TILE, 0, cz - 0.8 * TILE),
      new THREE.Vector3(cx + 0.8 * TILE, 0, cz - 0.8 * TILE),
      new THREE.Vector3(cx - 0.8 * TILE, 0, cz + 0.8 * TILE),
      new THREE.Vector3(cx + 0.8 * TILE, 0, cz + 0.8 * TILE)
    ];
  });
}

function getGoalSlots(half) {
  const TILE = LUDO_TILE;
  const offsets = [
    [-TILE * 0.3, -TILE * 0.3],
    [TILE * 0.3, -TILE * 0.3],
    [-TILE * 0.3, TILE * 0.3],
    [TILE * 0.3, TILE * 0.3]
  ];
  return Array.from({ length: 4 }, (_, player) =>
    offsets.map(([ox, oz]) => new THREE.Vector3(ox, 0.01, oz))
  );
}

export default function LudoBattleRoyal() {
  useTelegramBackButton();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const avatar = params.get('avatar') || getTelegramPhotoUrl();
  const username =
    params.get('username') ||
    params.get('name') ||
    getTelegramFirstName() ||
    getTelegramUsername();
  return <Ludo3D avatar={avatar} username={username} />;
}
