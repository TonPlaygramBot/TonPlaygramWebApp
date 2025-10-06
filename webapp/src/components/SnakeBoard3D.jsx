import React, { useEffect, useRef } from "react";
import * as THREE from "three";

const ROWS = 20;
const COLS = 5;
export const FINAL_TILE = ROWS * COLS + 1; // 101

const COLORS = Object.freeze({
  bg: 0x0b0d11,
  woodLight: 0xd6b38a,
  woodDark: 0x3a2d23,
  tileLight: 0xf2efe7,
  tileDark: 0x776a5a,
  highlight: 0x38bdf8,
  snake: 0xef4444,
  ladder: 0x22c55e,
  dice: 0xfacc15,
  tokenGlow: 0x38bdf8,
  pot: 0xfbbf24,
});

const CAM = Object.freeze({
  fov: 52,
  near: 0.1,
  far: 5000,
  phiMin: 0.88,
  phiMax: 1.32,
});

const TILE_SIZE = 1.32;
const BOARD_RIM = 0.5;
const BOARD_BASE_HEIGHT = 0.32;
const BOARD_TILE_HEIGHT = 0.12;
const BOARD_WIDTH = COLS * TILE_SIZE;
const BOARD_DEPTH = ROWS * TILE_SIZE;
const TABLE_TOP_PADDING = 1.6;
const TABLE_TOP_THICKNESS = 0.18;
const TABLE_LEG_HEIGHT = 1.12;
const TABLE_LEG_OFFSET = 0.7;

const ROOM_WIDTH = BOARD_WIDTH + 18;
const ROOM_DEPTH = BOARD_DEPTH + 26;
const ROOM_HEIGHT = 8.6;

const TWO_PI = Math.PI * 2;

const scratchV3A = new THREE.Vector3();
const scratchV3B = new THREE.Vector3();

function hexToColor(hex, fallback = 0xffffff) {
  try {
    if (!hex) return new THREE.Color(fallback);
    return new THREE.Color(hex);
  } catch {
    return new THREE.Color(fallback);
  }
}

function makeTextSprite(text, { color = "#ffffff", fontSize = 92, padding = 24 } = {}) {
  const canvas = document.createElement("canvas");
  const size = 256;
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "rgba(0,0,0,0)";
  ctx.fillRect(0, 0, size, size);
  ctx.font = `bold ${fontSize}px 'Poppins', 'Helvetica', sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = padding * 0.6;
  ctx.fillText(text, size / 2, size / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  texture.encoding = THREE.sRGBEncoding;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.9, 0.9, 0.9);
  sprite.userData.texture = texture;
  return sprite;
}

function disposeObject3D(obj) {
  if (!obj) return;
  obj.traverse((child) => {
    if (child.geometry) child.geometry.dispose?.();
    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => m.dispose?.());
      } else child.material.dispose?.();
    }
    if (child.userData?.texture) child.userData.texture.dispose?.();
  });
}

function buildKing(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.18,
    roughness: 0.52,
  });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.86, 0.24, 28), mat);
  base.position.y = 0.12;
  g.add(base);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 1.1, 28), mat);
  body.position.y = 0.82;
  g.add(body);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.18, 28), mat);
  collar.position.y = 1.46;
  g.add(collar);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.5, 0.48, 24), mat);
  neck.position.y = 1.86;
  g.add(neck);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.4, 0.42, 24), mat);
  crown.position.y = 2.24;
  g.add(crown);
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.38, 0.12), mat);
  crossV.position.y = 2.56;
  g.add(crossV);
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.12), mat);
  crossH.position.y = 2.62;
  g.add(crossH);
  return g;
}

function buildQueen(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.2 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.86, 0.24, 28), mat);
  base.position.y = 0.12;
  g.add(base);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.68, 1.1, 28), mat);
  body.position.y = 0.82;
  g.add(body);
  const crownRing = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.18, 24), mat);
  crownRing.position.y = 1.56;
  g.add(crownRing);
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.36, 20, 16), mat);
  sphere.position.y = 1.94;
  g.add(sphere);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.4, 20), mat);
  tip.position.y = 2.32;
  g.add(tip);
  return g;
}

function buildBishop(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.52, metalness: 0.16 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.74, 0.22, 24), mat);
  base.position.y = 0.11;
  g.add(base);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.58, 0.9, 24), mat);
  body.position.y = 0.76;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 12), mat);
  head.position.y = 1.48;
  g.add(head);
  const slit = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.46, 0.16), new THREE.MeshStandardMaterial({ color: 0x38bdf8 }));
  slit.position.y = 1.48;
  g.add(slit);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.28, 16), mat);
  tip.position.y = 1.82;
  g.add(tip);
  return g;
}

const PIECE_BUILDERS = [buildKing, buildQueen, buildKing, buildBishop];

function clearGroup(group) {
  if (!group) return;
  const children = [...group.children];
  children.forEach((child) => {
    group.remove(child);
    disposeObject3D(child);
  });
}

function createArena() {
  const arena = new THREE.Group();

  const floorTex = new THREE.CanvasTexture((() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#161922";
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) {
      const shade = 20 + Math.random() * 25;
      ctx.fillStyle = `rgb(${shade}, ${shade + 5}, ${shade + 12})`;
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 1, 1);
    }
    return canvas;
  })());
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(12, 12);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_DEPTH),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.92, metalness: 0.06 })
  );
  floor.rotation.x = -Math.PI / 2;
  arena.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x10131d, roughness: 0.92, metalness: 0.04 });
  const wallThickness = 0.6;
  const wallBack = new THREE.Mesh(
    new THREE.BoxGeometry(ROOM_WIDTH, ROOM_HEIGHT, wallThickness),
    wallMat
  );
  wallBack.position.set(0, ROOM_HEIGHT / 2, -ROOM_DEPTH / 2);
  arena.add(wallBack);
  const wallFront = wallBack.clone();
  wallFront.position.z = ROOM_DEPTH / 2;
  arena.add(wallFront);
  const wallLeft = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, ROOM_HEIGHT, ROOM_DEPTH),
    wallMat
  );
  wallLeft.position.set(-ROOM_WIDTH / 2, ROOM_HEIGHT / 2, 0);
  arena.add(wallLeft);
  const wallRight = wallLeft.clone();
  wallRight.position.x = ROOM_WIDTH / 2;
  arena.add(wallRight);

  const ledMat = new THREE.MeshStandardMaterial({
    color: 0x00faff,
    emissive: 0x0098c2,
    emissiveIntensity: 0.35,
    roughness: 0.4,
    metalness: 0.2,
  });
  const stripBack = new THREE.Mesh(
    new THREE.BoxGeometry(ROOM_WIDTH, 0.12, 0.1),
    ledMat
  );
  stripBack.position.set(0, 0.24, -ROOM_DEPTH / 2 + wallThickness / 2);
  arena.add(stripBack);
  const stripFront = stripBack.clone();
  stripFront.position.z = ROOM_DEPTH / 2 - wallThickness / 2;
  arena.add(stripFront);
  const stripLeft = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.12, ROOM_DEPTH),
    ledMat
  );
  stripLeft.position.set(-ROOM_WIDTH / 2 + wallThickness / 2, 0.24, 0);
  arena.add(stripLeft);
  const stripRight = stripLeft.clone();
  stripRight.position.x = ROOM_WIDTH / 2 - wallThickness / 2;
  arena.add(stripRight);

  const table = new THREE.Group();
  const tableWidth = BOARD_WIDTH + TABLE_TOP_PADDING * 2;
  const tableDepth = BOARD_DEPTH + TABLE_TOP_PADDING * 2;
  const tableTop = new THREE.Mesh(
    new THREE.BoxGeometry(tableWidth, TABLE_TOP_THICKNESS, tableDepth),
    new THREE.MeshStandardMaterial({ color: 0x2b3146, roughness: 0.64, metalness: 0.18 })
  );
  tableTop.position.y = TABLE_LEG_HEIGHT + TABLE_TOP_THICKNESS / 2;
  table.add(tableTop);
  const legGeo = new THREE.CylinderGeometry(0.32, 0.36, TABLE_LEG_HEIGHT, 16);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x1f232f, roughness: 0.8 });
  const legOffsetX = tableWidth / 2 - TABLE_LEG_OFFSET;
  const legOffsetZ = tableDepth / 2 - TABLE_LEG_OFFSET;
  [
    [-legOffsetX, legOffsetZ],
    [legOffsetX, legOffsetZ],
    [-legOffsetX, -legOffsetZ],
    [legOffsetX, -legOffsetZ],
  ].forEach(([x, z]) => {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(x, TABLE_LEG_HEIGHT / 2, z);
    table.add(leg);
  });
  arena.add(table);

  const boardGroup = new THREE.Group();
  const boardBaseY = TABLE_LEG_HEIGHT + TABLE_TOP_THICKNESS + BOARD_BASE_HEIGHT / 2;
  boardGroup.position.y = boardBaseY;
  arena.add(boardGroup);

  const tokenGroup = new THREE.Group();
  boardGroup.add(tokenGroup);
  const snakesGroup = new THREE.Group();
  boardGroup.add(snakesGroup);
  const laddersGroup = new THREE.Group();
  boardGroup.add(laddersGroup);
  const diceGroup = new THREE.Group();
  boardGroup.add(diceGroup);
  const labelGroup = new THREE.Group();
  boardGroup.add(labelGroup);
  const celebrationGroup = new THREE.Group();
  boardGroup.add(celebrationGroup);

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(BOARD_WIDTH + BOARD_RIM * 2, BOARD_BASE_HEIGHT, BOARD_DEPTH + BOARD_RIM * 2),
    new THREE.MeshStandardMaterial({ color: COLORS.woodDark, roughness: 0.72, metalness: 0.12 })
  );
  base.position.y = 0;
  boardGroup.add(base);
  const surface = new THREE.Mesh(
    new THREE.BoxGeometry(BOARD_WIDTH, BOARD_TILE_HEIGHT, BOARD_DEPTH),
    new THREE.MeshStandardMaterial({ color: COLORS.woodLight, roughness: 0.58, metalness: 0.18 })
  );
  surface.position.y = BOARD_BASE_HEIGHT / 2 + BOARD_TILE_HEIGHT / 2;
  boardGroup.add(surface);

  const tileY = surface.position.y + BOARD_TILE_HEIGHT / 2 + 0.01;
  const tileGroup = new THREE.Group();
  tileGroup.position.y = tileY;
  boardGroup.add(tileGroup);

  const tileMap = new Map();
  const tilePositions = new Map();
  const halfW = BOARD_WIDTH / 2;
  const halfD = BOARD_DEPTH / 2;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const isDark = (r + c) % 2 === 1;
      const mat = new THREE.MeshStandardMaterial({
        color: isDark ? COLORS.tileDark : COLORS.tileLight,
        roughness: 0.82,
        metalness: 0.06,
      });
      const tile = new THREE.Mesh(
        new THREE.BoxGeometry(TILE_SIZE * 0.98, 0.06, TILE_SIZE * 0.98),
        mat
      );
      const x = c * TILE_SIZE - halfW + TILE_SIZE / 2;
      const z = r * TILE_SIZE - halfD + TILE_SIZE / 2;
      tile.position.set(x, 0, z);
      tile.userData.baseColor = new THREE.Color(mat.color.getHex());
      tileGroup.add(tile);
      const num = r % 2 === 0 ? r * COLS + c + 1 : r * COLS + (COLS - c);
      tileMap.set(num, tile);
      tilePositions.set(num, new THREE.Vector3(x, 0, z));
    }
  }

  const finalPos = new THREE.Vector3(0, 0, halfD + TILE_SIZE * 0.92);
  tilePositions.set(FINAL_TILE, finalPos.clone());

  const potGroup = new THREE.Group();
  potGroup.position.copy(finalPos).add(new THREE.Vector3(0, 0.26, 0));
  const potBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 1.1, 0.46, 28),
    new THREE.MeshStandardMaterial({ color: 0x2c1a0f, roughness: 0.68, metalness: 0.18 })
  );
  potGroup.add(potBase);
  const potLip = new THREE.Mesh(
    new THREE.CylinderGeometry(1.18, 1.18, 0.18, 32),
    new THREE.MeshStandardMaterial({ color: 0x3b2414, roughness: 0.5, metalness: 0.24 })
  );
  potLip.position.y = 0.28;
  potGroup.add(potLip);
  const potCoin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.72, 0.72, 0.18, 32),
    new THREE.MeshStandardMaterial({
      color: COLORS.pot,
      roughness: 0.38,
      metalness: 0.64,
      emissive: 0x000000,
      emissiveIntensity: 0.0,
    })
  );
  potCoin.position.y = 0.44;
  potGroup.add(potCoin);
  potGroup.userData.coin = potCoin;
  boardGroup.add(potGroup);

  const cameraTarget = new THREE.Vector3(0, tileY + 0.5, 0);

  return {
    arena,
    boardGroup,
    tokenGroup,
    snakesGroup,
    laddersGroup,
    diceGroup,
    labelGroup,
    celebrationGroup,
    tileMap,
    tilePositions,
    tileY,
    cameraTarget,
    potGroup,
  };
}

function createDiceSprite(value) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 256, 256);
  ctx.fillStyle = "rgba(0,0,0,0)";
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(48, 32);
  ctx.lineTo(208, 32);
  ctx.quadraticCurveTo(224, 32, 224, 48);
  ctx.lineTo(224, 208);
  ctx.quadraticCurveTo(224, 224, 208, 224);
  ctx.lineTo(48, 224);
  ctx.quadraticCurveTo(32, 224, 32, 208);
  ctx.lineTo(32, 48);
  ctx.quadraticCurveTo(32, 32, 48, 32);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#111827";
  const pip = (x, y) => {
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, TWO_PI);
    ctx.fill();
  };
  const coords = {
    1: [[128, 128]],
    2: [[80, 80], [176, 176]],
    3: [[80, 80], [128, 128], [176, 176]],
    4: [[80, 80], [80, 176], [176, 80], [176, 176]],
    5: [[80, 80], [80, 176], [176, 80], [176, 176], [128, 128]],
    6: [[80, 80], [80, 128], [80, 176], [176, 80], [176, 128], [176, 176]],
  };
  (coords[value] || coords[6]).forEach(([x, y]) => pip(x, y));
  ctx.fillStyle = "#1f2937";
  ctx.font = "bold 56px 'Poppins', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`+${value}`, 128, 226);
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  texture.encoding = THREE.sRGBEncoding;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true })
  );
  sprite.scale.set(0.85, 0.85, 0.85);
  sprite.userData.texture = texture;
  return sprite;
}

function createCelebrationParticle() {
  const mat = new THREE.MeshStandardMaterial({
    color: COLORS.pot,
    roughness: 0.3,
    metalness: 0.8,
    emissive: COLORS.pot,
    emissiveIntensity: 0.3,
  });
  const geo = new THREE.CylinderGeometry(0.14, 0.14, 0.06, 18);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = Math.random() * Math.PI;
  mesh.rotation.z = Math.random() * Math.PI;
  mesh.userData = {
    velocity: new THREE.Vector3(
      (Math.random() - 0.5) * 1.8,
      2.4 + Math.random() * 0.6,
      (Math.random() - 0.5) * 1.8
    ),
    life: 1.4 + Math.random() * 0.6,
  };
  return mesh;
}

export default function SnakeBoard3D({
  players = [],
  highlight,
  trail,
  pot,
  snakes = {},
  ladders = {},
  snakeOffsets = {},
  ladderOffsets = {},
  offsetPopup,
  celebrate,
  token,
  tokenType,
  diceCells = {},
  rollingIndex,
  currentTurn,
  burning = [],
}) {
  const hostRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const boardGroupRef = useRef(null);
  const tokenGroupRef = useRef(null);
  const snakesGroupRef = useRef(null);
  const laddersGroupRef = useRef(null);
  const diceGroupRef = useRef(null);
  const labelGroupRef = useRef(null);
  const celebrationGroupRef = useRef(null);
  const tileMapRef = useRef(new Map());
  const tilePositionsRef = useRef(new Map());
  const tileYRef = useRef(0);
  const potGroupRef = useRef(null);
  const potLabelRef = useRef(null);
  const offsetSpriteRef = useRef(null);
  const tokensRef = useRef([]);
  const celebrationStateRef = useRef([]);
  const clockRef = useRef(new THREE.Clock());
  const cameraSphericalRef = useRef(null);
  const cameraTargetRef = useRef(new THREE.Vector3());
  const zoomBoundsRef = useRef({ min: 10, max: 80 });
  const animRef = useRef(0);
  const resizeObserverRef = useRef(null);
  const tokenTextureCacheRef = useRef({});
  const snakeLabelsRef = useRef([]);
  const ladderLabelsRef = useRef([]);
  const boardStateRef = useRef({ players, rollingIndex, currentTurn, burning });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    renderer.outputEncoding = THREE.sRGBEncoding;
    host.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.bg);
    sceneRef.current = scene;

    const hemi = new THREE.HemisphereLight(0xffffff, 0x1a1c26, 0.88);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.05);
    key.position.set(-24, 42, 24);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x6bb7ff, 0.6);
    fill.position.set(28, 32, -18);
    scene.add(fill);
    const rim = new THREE.SpotLight(0xfff2aa, 0.35, 180, Math.PI / 5, 0.4);
    rim.position.set(0, 54, 0);
    rim.target.position.set(0, 0, 0);
    scene.add(rim, rim.target);

    const {
      arena,
      boardGroup,
      tokenGroup,
      snakesGroup,
      laddersGroup,
      diceGroup,
      labelGroup,
      celebrationGroup,
      tileMap,
      tilePositions,
      tileY,
      cameraTarget,
      potGroup,
    } = createArena();
    scene.add(arena);

    boardGroupRef.current = boardGroup;
    tokenGroupRef.current = tokenGroup;
    snakesGroupRef.current = snakesGroup;
    laddersGroupRef.current = laddersGroup;
    diceGroupRef.current = diceGroup;
    labelGroupRef.current = labelGroup;
    celebrationGroupRef.current = celebrationGroup;
    tileMapRef.current = tileMap;
    tilePositionsRef.current = tilePositions;
    tileYRef.current = tileY;
    potGroupRef.current = potGroup;
    cameraTargetRef.current.copy(cameraTarget);

    const camera = new THREE.PerspectiveCamera(
      CAM.fov,
      host.clientWidth / host.clientHeight,
      CAM.near,
      CAM.far
    );
    scene.add(camera);
    cameraRef.current = camera;

    const boardRadius = Math.max(BOARD_WIDTH, BOARD_DEPTH) * 0.65;
    const minR = Math.max(boardRadius * 1.15, 14);
    const maxR = Math.max(boardRadius * 2.8, 40);
    zoomBoundsRef.current = { min: minR, max: maxR };
    const sph = new THREE.Spherical(
      minR * 1.35,
      (CAM.phiMin + CAM.phiMax) / 2,
      Math.PI * 0.23
    );
    cameraSphericalRef.current = sph;

    const updateCamera = () => {
      const bounds = zoomBoundsRef.current;
      sph.radius = Math.min(Math.max(sph.radius, bounds.min), bounds.max);
      sph.phi = Math.min(Math.max(sph.phi, CAM.phiMin), CAM.phiMax);
      const offset = new THREE.Vector3().setFromSpherical(sph);
      camera.position.copy(cameraTargetRef.current).add(offset);
      camera.lookAt(cameraTargetRef.current);
    };
    updateCamera();

    const handleResize = () => {
      if (!renderer || !camera) return;
      const { clientWidth, clientHeight } = host;
      renderer.setSize(clientWidth, clientHeight, false);
      camera.aspect = clientWidth / Math.max(clientHeight, 1);
      camera.updateProjectionMatrix();
      updateCamera();
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(host);
    resizeObserverRef.current = resizeObserver;

    const drag = { active: false, x: 0, y: 0 };
    const onPointerDown = (e) => {
      drag.active = true;
      drag.x = e.clientX || e.touches?.[0]?.clientX || 0;
      drag.y = e.clientY || e.touches?.[0]?.clientY || 0;
    };
    const onPointerMove = (e) => {
      if (!drag.active) return;
      const x = e.clientX || e.touches?.[0]?.clientX || drag.x;
      const y = e.clientY || e.touches?.[0]?.clientY || drag.y;
      const dx = x - drag.x;
      const dy = y - drag.y;
      drag.x = x;
      drag.y = y;
      if (cameraSphericalRef.current) {
        cameraSphericalRef.current.theta -= dx * 0.0032;
        cameraSphericalRef.current.phi -= dy * 0.0024;
        cameraSphericalRef.current.phi = Math.min(
          Math.max(cameraSphericalRef.current.phi, CAM.phiMin),
          CAM.phiMax
        );
        updateCamera();
      }
    };
    const onPointerUp = () => {
      drag.active = false;
    };
    const onWheel = (e) => {
      if (!cameraSphericalRef.current) return;
      cameraSphericalRef.current.radius += e.deltaY * 0.01;
      updateCamera();
    };

    const dom = renderer.domElement;
    dom.addEventListener("pointerdown", onPointerDown, { passive: true });
    dom.addEventListener("pointermove", onPointerMove, { passive: true });
    dom.addEventListener("pointerup", onPointerUp, { passive: true });
    dom.addEventListener("pointerleave", onPointerUp, { passive: true });
    dom.addEventListener("touchstart", onPointerDown, { passive: true });
    dom.addEventListener("touchmove", onPointerMove, { passive: true });
    dom.addEventListener("touchend", onPointerUp, { passive: true });
    dom.addEventListener("wheel", onWheel, { passive: true });

    const animate = () => {
      const delta = clockRef.current.getDelta();
      const state = boardStateRef.current;
      updateTokens(delta, state.players, state.rollingIndex, state.currentTurn, state.burning);
      updateCelebration(delta);
      renderer.render(scene, camera);
      animRef.current = requestAnimationFrame(animate);
    };
    clockRef.current.start();
    animate();

    return () => {
      cancelAnimationFrame(animRef.current);
      resizeObserver.disconnect();
      dom.removeEventListener("pointerdown", onPointerDown);
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerup", onPointerUp);
      dom.removeEventListener("pointerleave", onPointerUp);
      dom.removeEventListener("touchstart", onPointerDown);
      dom.removeEventListener("touchmove", onPointerMove);
      dom.removeEventListener("touchend", onPointerUp);
      dom.removeEventListener("wheel", onWheel);
      disposeObject3D(scene);
      renderer.dispose();
      renderer.forceContextLoss?.();
      if (renderer.domElement?.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  const updateTokens = (delta, playersArr, rolling, turn, burningArr) => {
    const group = tokenGroupRef.current;
    const tiles = tilePositionsRef.current;
    if (!group || !tiles.size) return;
    const tokens = tokensRef.current;

    while (tokens.length < playersArr.length) {
      const idx = tokens.length;
      const builder = PIECE_BUILDERS[idx % PIECE_BUILDERS.length];
      const mesh = builder(0xffffff);
      mesh.scale.setScalar(0.35);
      mesh.position.set(0, 0, 0);
      mesh.userData = {
        current: new THREE.Vector3(),
        target: new THREE.Vector3(),
        color: new THREE.Color(0xffffff),
        emissive: new THREE.Color(0x000000),
      };
      group.add(mesh);
      tokens.push(mesh);
    }
    while (tokens.length > playersArr.length) {
      const mesh = tokens.pop();
      if (mesh) {
        group.remove(mesh);
        disposeObject3D(mesh);
      }
    }

    const positions = new Map();
    playersArr.forEach((p, idx) => {
      const cell = p.position ?? 0;
      if (!positions.has(cell)) positions.set(cell, []);
      positions.get(cell).push(idx);
    });

    playersArr.forEach((player, idx) => {
      const mesh = tokens[idx];
      if (!mesh) return;
      const cell = player.position ?? 0;
      const basePos = new THREE.Vector3();
      if (cell <= 0) {
        const startRow = tilePositionsRef.current.get(1) ?? new THREE.Vector3();
        basePos.copy(startRow).add(new THREE.Vector3(-TILE_SIZE * 1.4, 0, TILE_SIZE * 1.6));
        basePos.x += (idx - (playersArr.length - 1) / 2) * 0.6;
      } else if (cell >= FINAL_TILE) {
        basePos.copy(tilePositionsRef.current.get(FINAL_TILE) ?? new THREE.Vector3());
      } else {
        basePos.copy(tilePositionsRef.current.get(cell) ?? new THREE.Vector3());
      }
      basePos.y = 0;
      const same = positions.get(cell) || [];
      if (same.length > 1) {
        const order = same.indexOf(idx);
        const radius = 0.3 + same.length * 0.04;
        const angle = (order / same.length) * TWO_PI;
        basePos.x += Math.cos(angle) * radius;
        basePos.z += Math.sin(angle) * radius;
      }
      mesh.userData.target.copy(basePos).y += tileYRef.current + 0.02;
      const color = hexToColor(player.color, 0x91c5ff);
      mesh.traverse((child) => {
        if (child.material) {
          child.material.color?.copy(color);
          child.material.emissive?.setHex(0x000000);
        }
      });
    });

    tokens.forEach((mesh, idx) => {
      const data = mesh.userData;
      if (!data) return;
      data.current.lerp(data.target, 1 - Math.exp(-delta * 6));
      mesh.position.copy(data.current);
      const wobble = Math.sin(clockRef.current.elapsedTime * 6 + idx) * 0.06;
      mesh.position.y += wobble * (rolling === idx ? 1.8 : 0.3);
      const isActive = idx === turn;
      const isBurning = burningArr.includes(idx);
      mesh.traverse((child) => {
        if (!child.material) return;
        if (isBurning) {
          const pulse = 0.5 + Math.sin(clockRef.current.elapsedTime * 12) * 0.5;
          child.material.emissive?.setRGB(0.6 * pulse, 0.18 * pulse, 0.05 * pulse);
        } else if (isActive) {
          child.material.emissive?.setHex(COLORS.tokenGlow);
        } else {
          child.material.emissive?.setHex(0x000000);
        }
      });
    });
  };

  const updateCelebration = (delta) => {
    const group = celebrationGroupRef.current;
    if (!group) return;
    celebrationStateRef.current = celebrationStateRef.current.filter((mesh) => {
      mesh.userData.life -= delta;
      mesh.userData.velocity.y -= 3.6 * delta;
      mesh.position.addScaledVector(mesh.userData.velocity, delta);
      const lifeRatio = Math.max(mesh.userData.life / 1.6, 0);
      mesh.scale.setScalar(0.8 + lifeRatio * 0.6);
      if (lifeRatio <= 0) {
        group.remove(mesh);
        disposeObject3D(mesh);
        return false;
      }
      return true;
    });
  };

  useEffect(() => {
    const group = snakesGroupRef.current;
    const labelGroup = labelGroupRef.current;
    if (!group || !labelGroup) return;
    snakeLabelsRef.current.forEach((sprite) => {
      labelGroup.remove(sprite);
      disposeObject3D(sprite);
    });
    snakeLabelsRef.current = [];
    clearGroup(group);
    Object.entries(snakes || {}).forEach(([start, end]) => {
      const from = tilePositionsRef.current.get(Number(start));
      const to = tilePositionsRef.current.get(Number(end));
      if (!from || !to) return;
      const path = new THREE.CatmullRomCurve3([
        scratchV3A.copy(from).add(new THREE.Vector3(0, tileYRef.current + 0.2, 0)),
        scratchV3A.clone().lerp(scratchV3B.copy(to), 0.3).add(new THREE.Vector3(0, 1.4, TILE_SIZE)),
        scratchV3B.clone().lerp(scratchV3A, 0.6).add(new THREE.Vector3(0, 1.2, -TILE_SIZE)),
        scratchV3B.copy(to).add(new THREE.Vector3(0, tileYRef.current + 0.2, 0)),
      ]);
      const geo = new THREE.TubeGeometry(path, 48, 0.22, 14, false);
      const mat = new THREE.MeshStandardMaterial({ color: COLORS.snake, metalness: 0.22, roughness: 0.48 });
      const snakeMesh = new THREE.Mesh(geo, mat);
      group.add(snakeMesh);
      const offsetVal = snakeOffsets?.[start];
      if (offsetVal != null) {
        const sprite = makeTextSprite(`-${Math.abs(offsetVal)}`, { color: "#f87171" });
        sprite.position.copy(from).add(new THREE.Vector3(0, tileYRef.current + 1.2, 0));
        labelGroup.add(sprite);
        snakeLabelsRef.current.push(sprite);
      }
    });
    return () => {
      clearGroup(group);
      snakeLabelsRef.current.forEach((sprite) => {
        labelGroup.remove(sprite);
        disposeObject3D(sprite);
      });
      snakeLabelsRef.current = [];
    };
  }, [snakes, snakeOffsets]);

  useEffect(() => {
    const group = laddersGroupRef.current;
    const labelGroup = labelGroupRef.current;
    if (!group || !labelGroup) return;
    ladderLabelsRef.current.forEach((sprite) => {
      labelGroup.remove(sprite);
      disposeObject3D(sprite);
    });
    ladderLabelsRef.current = [];
    clearGroup(group);
    Object.entries(ladders || {}).forEach(([start, end]) => {
      const from = tilePositionsRef.current.get(Number(start));
      const to = tilePositionsRef.current.get(Number(end));
      if (!from || !to) return;
      const dir = scratchV3A.copy(to).sub(from);
      const mid = from.clone().add(dir.clone().multiplyScalar(0.5));
      const length = dir.length();
      const up = dir.clone().normalize();
      const side = new THREE.Vector3(0, 1, 0).cross(up).normalize().multiplyScalar(0.35);
      const railGeo = new THREE.CylinderGeometry(0.16, 0.16, length, 12);
      const railMat = new THREE.MeshStandardMaterial({ color: COLORS.ladder, roughness: 0.38, metalness: 0.32 });
      const railA = new THREE.Mesh(railGeo, railMat);
      const railB = new THREE.Mesh(railGeo, railMat);
      railA.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
      railB.quaternion.copy(railA.quaternion);
      railA.position.copy(mid).add(side);
      railB.position.copy(mid).add(side.clone().multiplyScalar(-1));
      railA.position.y += tileYRef.current;
      railB.position.y += tileYRef.current;
      group.add(railA, railB);
      const rungCount = Math.max(3, Math.floor(length / 1.2));
      for (let i = 1; i < rungCount; i++) {
        const t = i / rungCount;
        const pos = from.clone().lerp(to, t).add(new THREE.Vector3(0, tileYRef.current, 0));
        const rung = new THREE.Mesh(
          new THREE.BoxGeometry(side.length() * 2, 0.1, 0.32),
          new THREE.MeshStandardMaterial({ color: 0xe5f7e8, roughness: 0.52 })
        );
        rung.position.copy(pos);
        rung.quaternion.copy(railA.quaternion);
        group.add(rung);
      }
      const offsetVal = ladderOffsets?.[start];
      if (offsetVal != null) {
        const sprite = makeTextSprite(`+${offsetVal}`, { color: "#34d399" });
        sprite.position.copy(from).add(new THREE.Vector3(0, tileYRef.current + 1.2, 0));
        labelGroup.add(sprite);
        ladderLabelsRef.current.push(sprite);
      }
    });
    return () => {
      clearGroup(group);
      ladderLabelsRef.current.forEach((sprite) => {
        labelGroup.remove(sprite);
        disposeObject3D(sprite);
      });
      ladderLabelsRef.current = [];
    };
  }, [ladders, ladderOffsets]);

  useEffect(() => {
    const group = diceGroupRef.current;
    if (!group) return;
    clearGroup(group);
    Object.entries(diceCells || {}).forEach(([cell, value]) => {
      const pos = tilePositionsRef.current.get(Number(cell));
      if (!pos) return;
      const sprite = createDiceSprite(value);
      sprite.position.copy(pos).add(new THREE.Vector3(0, tileYRef.current + 0.9, 0));
      group.add(sprite);
    });
  }, [diceCells]);

  useEffect(() => {
    const tileMap = tileMapRef.current;
    if (!tileMap.size) return;
    tileMap.forEach((tile, cell) => {
      const mat = tile.material;
      if (!mat || !tile.userData?.baseColor) return;
      mat.color.copy(tile.userData.baseColor);
      mat.emissive?.setHex(0x000000);
    });
    const applyHighlight = (cell, type) => {
      const tile = tileMap.get(cell);
      if (!tile) return;
      const mat = tile.material;
      if (!mat) return;
      if (type === "snake") {
        mat.color.setHex(COLORS.snake);
      } else if (type === "ladder") {
        mat.color.setHex(COLORS.ladder);
      } else if (type === "dice") {
        mat.color.setHex(COLORS.dice);
      } else {
        mat.color.setHex(COLORS.highlight);
      }
      mat.emissive?.setHex(0x0ea5e9);
    };
    if (highlight?.cell && highlight.cell !== FINAL_TILE) applyHighlight(highlight.cell, highlight.type);
    (trail || [])
      .filter((step) => step.cell && step.cell !== FINAL_TILE)
      .forEach((step) => applyHighlight(step.cell, step.type));
    const potCoin = potGroupRef.current?.userData?.coin;
    if (potCoin && potCoin.material) {
      const shouldGlow =
        highlight?.cell === FINAL_TILE ||
        (trail || []).some((step) => step.cell === FINAL_TILE);
      potCoin.material.emissive?.setHex(shouldGlow ? COLORS.highlight : 0x000000);
      potCoin.material.emissiveIntensity = shouldGlow ? 0.45 : 0.0;
      potCoin.material.needsUpdate = true;
    }
  }, [highlight, trail]);

  useEffect(() => {
    const group = labelGroupRef.current;
    if (!group) return;
    if (offsetPopup?.cell) {
      let sprite = offsetSpriteRef.current;
      const amount = `${offsetPopup.type === "snake" ? "-" : "+"}${offsetPopup.amount}`;
      const color = offsetPopup.type === "snake" ? "#f87171" : "#34d399";
      if (!sprite) {
        sprite = makeTextSprite(amount, { color, fontSize: 120 });
        offsetSpriteRef.current = sprite;
        group.add(sprite);
      } else if (sprite.userData) {
        disposeObject3D(sprite);
        group.remove(sprite);
        const fresh = makeTextSprite(amount, { color, fontSize: 120 });
        offsetSpriteRef.current = fresh;
        group.add(fresh);
        sprite = fresh;
      }
      const pos = tilePositionsRef.current.get(offsetPopup.cell);
      if (pos && sprite) {
        sprite.position.copy(pos).add(new THREE.Vector3(0, tileYRef.current + 1.6, 0));
      }
    } else if (offsetSpriteRef.current) {
      group.remove(offsetSpriteRef.current);
      disposeObject3D(offsetSpriteRef.current);
      offsetSpriteRef.current = null;
    }
  }, [offsetPopup]);

  useEffect(() => {
    if (!celebrate) return;
    const group = celebrationGroupRef.current;
    const finalPos = tilePositionsRef.current.get(FINAL_TILE);
    if (!group || !finalPos) return;
    for (let i = 0; i < 28; i++) {
      const particle = createCelebrationParticle();
      particle.position.copy(finalPos).add(new THREE.Vector3(0, tileYRef.current + 0.4, 0));
      group.add(particle);
      celebrationStateRef.current.push(particle);
    }
  }, [celebrate]);

  useEffect(() => {
    const potGroup = potGroupRef.current;
    if (!potGroup || !token) return;
    const cache = tokenTextureCacheRef.current;
    if (!cache[token]) {
      const loader = new THREE.TextureLoader();
      loader.load(
        token === "TON"
          ? "/assets/icons/TON.webp"
          : token === "USDT"
          ? "/assets/icons/Usdt.webp"
          : "/assets/icons/ezgif-54c96d8a9b9236.webp",
        (texture) => {
          texture.encoding = THREE.sRGBEncoding;
          cache[token] = texture;
          const coin = potGroup.userData?.coin;
          if (coin && coin.material) {
            coin.material.map = texture;
            coin.material.needsUpdate = true;
          }
        }
      );
    } else {
      const coin = potGroup.userData?.coin;
      if (coin && coin.material) {
        coin.material.map = cache[token];
        coin.material.needsUpdate = true;
      }
    }
  }, [token]);

  useEffect(() => {
    boardStateRef.current = { players, rollingIndex, currentTurn, burning };
  }, [players, rollingIndex, currentTurn, burning]);

  useEffect(() => {
    const potGroup = potGroupRef.current;
    const labelGroup = labelGroupRef.current;
    if (!potGroup || !labelGroup) return;
    if (potLabelRef.current) {
      labelGroup.remove(potLabelRef.current);
      disposeObject3D(potLabelRef.current);
      potLabelRef.current = null;
    }
    if (pot != null) {
      const sprite = makeTextSprite(`${pot} ${tokenType || ""}`.trim(), {
        color: "#fde68a",
        fontSize: 84,
      });
      sprite.position.copy(potGroup.position).add(new THREE.Vector3(0, 1.6, 0));
      labelGroup.add(sprite);
      potLabelRef.current = sprite;
    }
  }, [pot, tokenType]);

  useEffect(() => {
    updateTokens(0, players, rollingIndex, currentTurn, burning);
  }, [players, rollingIndex, currentTurn, burning]);

  return (
    <div ref={hostRef} className="snake-board-3d relative w-full h-full min-h-[80vh]" />
  );
}
