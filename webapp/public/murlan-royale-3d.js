import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

const host = document.getElementById('threeHost');
if (!host) {
  window.murlanArena = null;
} else {
  const stageEl = host.closest('.stage');
  const tempVec = new THREE.Vector3();

  const ARENA_CAMERA_DEFAULTS = Object.freeze({
    fov: 52,
    near: 0.1,
    far: 5000,
    initialRadiusFactor: 1.35,
    minRadiusFactor: 0.95,
    maxRadiusFactor: 2.4,
    initialPhiLerp: 0.35,
    phiMin: 0.92,
    phiMax: 1.22,
    verticalSensitivity: 0.003,
    leanStrength: 0.0065,
    wheelDeltaFactor: 0.2
  });

  const TWO_PI = Math.PI * 2;
  const clamp01 = (v) => Math.min(1, Math.max(0, v));

  function buildArenaCameraConfig(boardSize) {
    return {
      fov: ARENA_CAMERA_DEFAULTS.fov,
      near: ARENA_CAMERA_DEFAULTS.near,
      far: ARENA_CAMERA_DEFAULTS.far,
      minRadius: boardSize * ARENA_CAMERA_DEFAULTS.minRadiusFactor,
      maxRadius: boardSize * ARENA_CAMERA_DEFAULTS.maxRadiusFactor
    };
  }

  function createArenaCarpetMaterial() {
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#7a0a18');
    gradient.addColorStop(1, '#5e0913');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    let seed = 987654321;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    const image = ctx.getImageData(0, 0, size, size);
    const data = image.data;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const fiber = (Math.sin((x / size) * Math.PI * 18) + Math.cos((y / size) * Math.PI * 22)) * 0.12;
        const grain = (rand() - 0.5) * 0.22;
        const shade = clamp01(0.96 + fiber + grain);
        data[idx] = clamp01((data[idx] / 255) * shade) * 255;
        data[idx + 1] = clamp01((data[idx + 1] / 255) * (0.98 + grain * 0.35)) * 255;
        data[idx + 2] = clamp01((data[idx + 2] / 255) * (0.95 + grain * 0.2)) * 255;
      }
    }
    ctx.putImageData(image, 0, 0);

    ctx.globalAlpha = 0.05;
    ctx.fillStyle = '#000000';
    for (let row = 0; row < size; row += 3) ctx.fillRect(0, row, size, 1);
    ctx.globalAlpha = 1;

    const drawRoundedRect = (context, x, y, w, h, r) => {
      const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
      context.beginPath();
      context.moveTo(x + radius, y);
      context.lineTo(x + w - radius, y);
      context.quadraticCurveTo(x + w, y, x + w, y + radius);
      context.lineTo(x + w, y + h - radius);
      context.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
      context.lineTo(x + radius, y + h);
      context.quadraticCurveTo(x, y + h, x, y + h - radius);
      context.lineTo(x, y + radius);
      context.quadraticCurveTo(x, y, x + radius, y);
      context.closePath();
    };

    const insetRatio = 0.055;
    const stripeInset = size * insetRatio;
    const stripeRadius = size * 0.08;
    const stripeWidth = size * 0.012;
    ctx.lineWidth = stripeWidth;
    ctx.strokeStyle = '#d4af37';
    ctx.shadowColor = 'rgba(0,0,0,0.18)';
    ctx.shadowBlur = stripeWidth * 0.8;
    drawRoundedRect(ctx, stripeInset, stripeInset, size - stripeInset * 2, size - stripeInset * 2, stripeRadius);
    ctx.stroke();
    ctx.shadowBlur = 0;

    const map = new THREE.CanvasTexture(canvas);
    map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
    map.anisotropy = 8;
    map.minFilter = THREE.LinearMipMapLinearFilter;
    map.magFilter = THREE.LinearFilter;
    map.generateMipmaps = true;
    map.colorSpace = THREE.SRGBColorSpace;

    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = bumpCanvas.height = size;
    const bumpCtx = bumpCanvas.getContext('2d');
    bumpCtx.drawImage(canvas, 0, 0);
    const bumpImage = bumpCtx.getImageData(0, 0, size, size);
    const bumpData = bumpImage.data;
    for (let i = 0; i < bumpData.length; i += 4) {
      const avg = (bumpData[i] + bumpData[i + 1] + bumpData[i + 2]) / 3;
      const noise = (rand() - 0.5) * 32;
      const value = clamp01((avg + noise) / 255) * 255;
      bumpData[i] = bumpData[i + 1] = bumpData[i + 2] = value;
    }
    bumpCtx.putImageData(bumpImage, 0, 0);
    const bump = new THREE.CanvasTexture(bumpCanvas);
    bump.wrapS = bump.wrapT = THREE.ClampToEdgeWrapping;
    bump.anisotropy = 4;
    bump.minFilter = THREE.LinearMipMapLinearFilter;
    bump.magFilter = THREE.LinearFilter;
    bump.generateMipmaps = true;

    return new THREE.MeshStandardMaterial({
      color: 0xb01224,
      roughness: 0.92,
      metalness: 0.04,
      map,
      bumpMap: bump,
      bumpScale: 0.24
    });
  }

  function createArenaWallMaterial() {
    return new THREE.MeshStandardMaterial({
      color: 0xeeeeee,
      roughness: 0.88,
      metalness: 0.06,
      side: THREE.DoubleSide
    });
  }
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(host.clientWidth, host.clientHeight, false);
  renderer.domElement.style.position = 'absolute';
  renderer.domElement.style.inset = '0';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
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
  spotTarget.position.set(0, 1.4, 0);
  scene.add(spotTarget);
  spot.target = spotTarget;

  const arena = new THREE.Group();
  scene.add(arena);

  const SNOOKER_TABLE_SCALE = 1.3;
  const SNOOKER_TABLE_W = 66 * SNOOKER_TABLE_SCALE;
  const SNOOKER_TABLE_H = 132 * SNOOKER_TABLE_SCALE;
  const SNOOKER_ROOM_DEPTH = SNOOKER_TABLE_H * 3.6;
  const SNOOKER_SIDE_CLEARANCE = SNOOKER_ROOM_DEPTH / 2 - SNOOKER_TABLE_H / 2;
  const SNOOKER_ROOM_WIDTH = SNOOKER_TABLE_W + SNOOKER_SIDE_CLEARANCE * 2;
  const SNOOKER_SIZE_REDUCTION = 0.7;
  const SNOOKER_GLOBAL_SIZE_FACTOR = 0.85 * SNOOKER_SIZE_REDUCTION;
  const SNOOKER_WORLD_SCALE = 0.85 * SNOOKER_GLOBAL_SIZE_FACTOR * 0.7;
  const CHESS_ARENA = {
    width: (SNOOKER_ROOM_WIDTH * SNOOKER_WORLD_SCALE) / 2,
    depth: (SNOOKER_ROOM_DEPTH * SNOOKER_WORLD_SCALE) / 2
  };

  const WALL_PROXIMITY_FACTOR = 0.5;
  const WALL_HEIGHT_MULTIPLIER = 2;

  const arenaHalfWidth = CHESS_ARENA.width / 2;
  const arenaHalfDepth = CHESS_ARENA.depth / 2;
  const wallInset = 0.5;
  const halfRoomX = (arenaHalfWidth - wallInset) * WALL_PROXIMITY_FACTOR;
  const halfRoomZ = (arenaHalfDepth - wallInset) * WALL_PROXIMITY_FACTOR;
  const roomHalfWidth = halfRoomX + wallInset;
  const roomHalfDepth = halfRoomZ + wallInset;

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(roomHalfWidth * 2, roomHalfDepth * 2),
    new THREE.MeshStandardMaterial({ color: 0x0f1222, roughness: 0.95, metalness: 0.05 })
  );
  floor.rotation.x = -Math.PI / 2;
  arena.add(floor);

  const carpet = new THREE.Mesh(
    new THREE.PlaneGeometry(roomHalfWidth * 1.2, roomHalfDepth * 1.2),
    createArenaCarpetMaterial()
  );
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.y = 0.002;
  arena.add(carpet);

  const wallMat = createArenaWallMaterial();
  const wallH = 3 * WALL_HEIGHT_MULTIPLIER;
  const wallT = 0.1;
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(halfRoomX * 2, wallH, wallT), wallMat);
  backWall.position.set(0, wallH / 2, halfRoomZ);
  arena.add(backWall);
  const frontWall = new THREE.Mesh(new THREE.BoxGeometry(halfRoomX * 2, wallH, wallT), wallMat);
  frontWall.position.set(0, wallH / 2, -halfRoomZ);
  arena.add(frontWall);
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, halfRoomZ * 2), wallMat);
  leftWall.position.set(-halfRoomX, wallH / 2, 0);
  arena.add(leftWall);
  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, halfRoomZ * 2), wallMat);
  rightWall.position.set(halfRoomX, wallH / 2, 0);
  arena.add(rightWall);

  const ceilTrim = new THREE.Mesh(
    new THREE.BoxGeometry(halfRoomX * 2, 0.02, halfRoomZ * 2),
    new THREE.MeshStandardMaterial({ color: 0x1a233f, roughness: 0.9, metalness: 0.02, side: THREE.DoubleSide })
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
  const stripBack = new THREE.Mesh(new THREE.BoxGeometry(halfRoomX * 2, 0.02, 0.01), ledMat);
  stripBack.position.set(0, 0.05, halfRoomZ - wallT / 2);
  arena.add(stripBack);
  const stripFront = stripBack.clone();
  stripFront.position.set(0, 0.05, -halfRoomZ + wallT / 2);
  arena.add(stripFront);
  const stripLeft = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.02, halfRoomZ * 2), ledMat);
  stripLeft.position.set(-halfRoomX + wallT / 2, 0.05, 0);
  arena.add(stripLeft);
  const stripRight = stripLeft.clone();
  stripRight.position.set(halfRoomX - wallT / 2, 0.05, 0);
  arena.add(stripRight);

  function makeVelvetTexture(w, h, c1, c2) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, c1);
    g.addColorStop(1, c2);
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    for (let i = 0; i < 7000; i++) {
      const px = Math.random() * w;
      const py = Math.random() * h;
      x.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`;
      x.fillRect(px, py, 1, 1);
    }
    return new THREE.CanvasTexture(c);
  }

  const baseMat = new THREE.MeshPhysicalMaterial({ color: 0x141414, metalness: 0.85, roughness: 0.2, clearcoat: 0.9 });
  const tableBase = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 3.8, 0.25, 64), baseMat);
  tableBase.position.y = 1.05;
  arena.add(tableBase);

  const frameMat = new THREE.MeshPhysicalMaterial({ color: 0x3a1e0f, roughness: 0.35, metalness: 0.45 });
  const frame = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.15, 32, 64), frameMat);
  frame.rotation.x = Math.PI / 2;
  frame.position.y = 1.15;
  arena.add(frame);

  const velvetTex = makeVelvetTexture(1024, 1024, '#7a001a', '#520014');
  velvetTex.colorSpace = THREE.SRGBColorSpace;
  velvetTex.anisotropy = 8;
  const velvetMat = new THREE.MeshStandardMaterial({ map: velvetTex, roughness: 0.7, metalness: 0.15 });
  const surface = new THREE.Mesh(new THREE.CylinderGeometry(3.25, 3.25, 0.05, 64), velvetMat);
  surface.position.y = 1.25;
  arena.add(surface);

  const baseColumn = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 0.8, 1.2, 32),
    new THREE.MeshStandardMaterial({ color: 0x111111 })
  );
  baseColumn.position.y = 0.4;
  arena.add(baseColumn);

  const TABLE_SURFACE_Y = 1.25 + 0.05 / 2;
  const TABLE_RADIUS = 3.25;
  function makeChair() {
    const chair = new THREE.Group();
    const cushionMat = new THREE.MeshPhysicalMaterial({
      color: 0x8b0000,
      roughness: 0.35,
      metalness: 0.5,
      clearcoat: 1,
      clearcoatRoughness: 0.2,
      emissive: new THREE.Color(0x210000),
      emissiveIntensity: 0.12
    });
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1f1f1f, roughness: 0.6 });

    const cushionParts = [];
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.18, 1.3), cushionMat);
    cushionParts.push(seat);
    chair.add(seat);

    const back = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.8, 0.2), cushionMat);
    back.position.set(0, 0.5, -0.55);
    cushionParts.push(back);
    chair.add(back);

    const armLeft = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.9), cushionMat);
    armLeft.position.set(-0.7, 0.2, -0.1);
    cushionParts.push(armLeft);
    chair.add(armLeft);

    const armRight = armLeft.clone();
    armRight.position.x = 0.7;
    cushionParts.push(armRight);
    chair.add(armRight);

    const legBase = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.6, 16), legMat);
    legBase.position.y = -0.45;
    chair.add(legBase);

    return { chair, cushionMat, cushionParts };
  }

  const chairsGroup = new THREE.Group();
  arena.add(chairsGroup);

  const seatData = [];
  const seatPlacements = [];
  let activeSeatCount = 0;

  const CARD = { W: 0.46, H: 0.68, T: 0.018 };
  const cardGeo = new THREE.BoxGeometry(CARD.W, CARD.T, CARD.H, 1, 1, 1);
  const cardEdgeMaterial = new THREE.MeshStandardMaterial({ color: 0xe0dfdc, roughness: 0.55, metalness: 0.08 });
  const cardBackMaterial = (() => {
    const tex = makeCardBackTexture();
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.48, metalness: 0.08 });
  })();

  function makeCardBackTexture() {
    const w = 512;
    const h = 768;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#0f1b2b');
    grad.addColorStop(1, '#15324f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 18;
    ctx.strokeRect(28, 28, w - 56, h - 56);
    ctx.lineWidth = 6;
    ctx.strokeRect(64, 64, w - 128, h - 128);
    ctx.fillStyle = '#d4af37';
    ctx.font = 'bold 160px "Segoe UI", system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('MR', w / 2, h / 2);
    return new THREE.CanvasTexture(canvas);
  }

  const faceMaterialCache = new Map();

  function getCardFaceMaterial(card) {
    const rank = card?.r;
    const suit = card?.s;
    const key = `${rank}_${suit}`;
    if (faceMaterialCache.has(key)) return faceMaterialCache.get(key);
    const tex = makeCardFaceTexture(rank, suit);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.34, metalness: 0.06 });
    faceMaterialCache.set(key, mat);
    return mat;
  }

  function makeCardFaceTexture(rank, suit) {
    const w = 512;
    const h = 768;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 10;
    const radius = 42;
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.arcTo(w, 0, w, h, radius);
    ctx.arcTo(w, h, 0, h, radius);
    ctx.arcTo(0, h, 0, 0, radius);
    ctx.arcTo(0, 0, w, 0, radius);
    ctx.closePath();
    ctx.stroke();

    const rankStr = typeof rank === 'number' ? String(rank) : String(rank || '');
    const isRedSuit = suit === '♥' || suit === '♦' || rank === 'RJ';
    const textColor = suit === '🃏' ? (rank === 'RJ' ? '#d12d2d' : '#1a1a1a') : isRedSuit ? '#cc2233' : '#111111';
    ctx.fillStyle = textColor;

    if (suit === '🃏') {
      ctx.font = 'bold 96px "Segoe UI", system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(rank === 'RJ' ? 'Red' : 'Black', 48, 120);
      ctx.font = 'bold 220px "Segoe UI", system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('🃏', w / 2, h / 2 - 40);
      ctx.font = 'bold 72px "Segoe UI", system-ui';
      ctx.fillText('JOKER', w / 2, h / 2 + 210);
    } else {
      ctx.font = 'bold 92px "Segoe UI", system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(rankStr, 48, 128);
      ctx.font = 'bold 72px "Segoe UI", system-ui';
      ctx.fillText(suit || '', 48, 200);
      ctx.textAlign = 'center';
      ctx.font = 'bold 220px "Segoe UI", system-ui';
      ctx.fillText(suit || '', w / 2, h / 2 + 20);
    }

    return new THREE.CanvasTexture(canvas);
  }

  function ensureCardMesh(group, index) {
    let mesh = group.children[index];
    if (!mesh) {
      mesh = new THREE.Mesh(cardGeo, [
        cardEdgeMaterial,
        cardEdgeMaterial,
        cardBackMaterial,
        cardBackMaterial,
        cardEdgeMaterial,
        cardEdgeMaterial
      ]);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      group.add(mesh);
    }
    mesh.visible = true;
    return mesh;
  }

  function hideExtra(group, keep) {
    for (let i = keep; i < group.children.length; i++) group.children[i].visible = false;
  }

  function determineSide(angle) {
    const normalized = (angle % TWO_PI + TWO_PI) % TWO_PI;
    if (normalized >= (7 * Math.PI) / 4 || normalized < Math.PI / 4) return 'right';
    if (normalized < (3 * Math.PI) / 4) return 'bottom';
    if (normalized < (5 * Math.PI) / 4) return 'left';
    return 'top';
  }

  function buildSeating(count) {
    while (chairsGroup.children.length) chairsGroup.remove(chairsGroup.children[0]);
    seatData.length = 0;
    activeSeatCount = count;
    seatPlacements.length = count;

    for (let i = 0; i < count; i++) {
      const { chair, cushionMat, cushionParts } = makeChair();
      const angle = Math.PI / 2 - (TWO_PI * i) / count;
      const radius = 4.8;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      chair.position.set(x, 1.0, z);
      chair.lookAt(new THREE.Vector3(0, 1, 0));
      chairsGroup.add(chair);

      const anchor = new THREE.Object3D();
      anchor.position.set(0, 1.7, -0.42);
      chair.add(anchor);

      const inward = new THREE.Vector3(-Math.cos(angle), 0, -Math.sin(angle)).normalize();
      const outward = inward.clone().multiplyScalar(-1);
      const right = new THREE.Vector3(inward.z, 0, -inward.x).normalize();
      const yaw = Math.atan2(inward.x, inward.z);

      const handGroup = new THREE.Group();
      arena.add(handGroup);

      seatData.push({
        angle,
        anchor,
        inward,
        outward,
        right,
        yaw,
        handGroup,
        cushionMat,
        cushionParts,
        side: determineSide(angle)
      });
    }
  }

  const pileGroup = new THREE.Group();
  pileGroup.position.set(0, TABLE_SURFACE_Y + CARD.T / 2 + 0.01, 0);
  arena.add(pileGroup);
  const camera = new THREE.PerspectiveCamera(
    ARENA_CAMERA_DEFAULTS.fov,
    1,
    ARENA_CAMERA_DEFAULTS.near,
    ARENA_CAMERA_DEFAULTS.far
  );
  let spherical = new THREE.Spherical(10, 1.05, Math.PI * 0.25);
  const lookTarget = new THREE.Vector3(0, TABLE_SURFACE_Y + 0.28, 0);
  let needsPlacementUpdate = true;

  const TABLE_DISPLAY_SIZE = TABLE_RADIUS * 2.2;
  const CAM_RANGE = buildArenaCameraConfig(TABLE_DISPLAY_SIZE);
  const CAM = {
    fov: CAM_RANGE.fov,
    near: CAM_RANGE.near,
    far: CAM_RANGE.far,
    minR: CAM_RANGE.minRadius,
    maxR: CAM_RANGE.maxRadius,
    phiMin: ARENA_CAMERA_DEFAULTS.phiMin,
    phiMax: ARENA_CAMERA_DEFAULTS.phiMax
  };

  function fitCamera() {
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const needed = TABLE_DISPLAY_SIZE / (2 * Math.tan(THREE.MathUtils.degToRad(CAM.fov) / 2));
    spherical.radius = THREE.MathUtils.clamp(Math.max(needed, spherical.radius), CAM.minR, CAM.maxR);
    const offset = new THREE.Vector3().setFromSpherical(spherical);
    camera.position.copy(lookTarget).add(offset);
    camera.lookAt(lookTarget);
    needsPlacementUpdate = true;
  }

  const initialRadius = Math.max(TABLE_DISPLAY_SIZE * ARENA_CAMERA_DEFAULTS.initialRadiusFactor, CAM.minR + 0.6);
  spherical = new THREE.Spherical(
    initialRadius,
    THREE.MathUtils.lerp(CAM.phiMin, CAM.phiMax, ARENA_CAMERA_DEFAULTS.initialPhiLerp),
    Math.PI * 0.25
  );
  fitCamera();

  window.addEventListener('resize', fitCamera);

  function computeSeatPlacements() {
    if (!stageEl) return;
    const rect = stageEl.getBoundingClientRect();
    for (let i = 0; i < activeSeatCount; i++) {
      const seat = seatData[i];
      if (!seat) continue;
      const world = seat.anchor.getWorldPosition(tempVec);
      const projected = world.project(camera);
      const x = ((projected.x + 1) / 2) * rect.width;
      const y = ((-projected.y + 1) / 2) * rect.height;
      seatPlacements[i] = { x, y, side: seat.side, angle: seat.angle };
    }
  }

  function updatePlacementsIfNeeded() {
    if (!needsPlacementUpdate) return;
    needsPlacementUpdate = false;
    computeSeatPlacements();
  }

  function applyCardMaterials(mesh, faceMat, faceUp) {
    if (!mesh) return;
    const top = faceUp ? faceMat : cardBackMaterial;
    const bottom = cardBackMaterial;
    mesh.material = [
      cardEdgeMaterial,
      cardEdgeMaterial,
      top,
      bottom,
      cardEdgeMaterial,
      cardEdgeMaterial
    ];
  }

  function updateHands(state) {
    if (!state.players) return;
    const selected = new Set(Array.isArray(state.selectedIndices) ? state.selectedIndices : []);
    const tempBase = new THREE.Vector3();
    const tempOffset = new THREE.Vector3();

    seatData.forEach((seat, idx) => {
      const player = state.players[idx];
      const group = seat.handGroup;
      if (!player) {
        hideExtra(group, 0);
        group.visible = false;
        return;
      }
      group.visible = true;
      const cards = Array.isArray(player.hand) ? player.hand : [];
      const faceUp = !!player.isHuman;
      const outward = seat.outward;
      tempBase.copy(outward).multiplyScalar(TABLE_RADIUS - 0.35);
      tempBase.y = TABLE_SURFACE_Y + CARD.T / 2 + 0.01;
      const spacing = cards.length > 1 ? (faceUp ? 0.42 : 0.32) : 0;
      for (let i = 0; i < cards.length; i++) {
        const mesh = ensureCardMesh(group, i);
        const faceMat = faceUp ? getCardFaceMaterial(cards[i]) : cardBackMaterial;
        applyCardMaterials(mesh, faceMat, faceUp);
        const centerIndex = (cards.length - 1) / 2;
        const offsetAmount = (i - centerIndex) * spacing;
        tempOffset.copy(seat.right).multiplyScalar(offsetAmount);
        mesh.position.copy(tempBase).add(tempOffset);
        mesh.position.y += i * 0.0015;
        mesh.rotation.set(0, seat.yaw, 0);
        if (faceUp && selected.has(i)) mesh.position.y += 0.12;
      }
      hideExtra(group, cards.length);
    });
  }

  function updatePile(cards) {
    const pile = Array.isArray(cards) ? cards : [];
    for (let i = 0; i < pile.length; i++) {
      const mesh = ensureCardMesh(pileGroup, i);
      const faceMat = getCardFaceMaterial(pile[i]);
      applyCardMaterials(mesh, faceMat, true);
      const centerIndex = (pile.length - 1) / 2;
      const offset = i - centerIndex;
      mesh.position.set(offset * 0.18, CARD.T / 2 + 0.002 * i, offset * 0.08);
      mesh.rotation.set(0, offset * 0.18, 0);
    }
    hideExtra(pileGroup, pile.length);
    pileGroup.visible = pile.length > 0;
  }

  function highlightSeat(activeIndex) {
    seatData.forEach((seat, idx) => {
      const intensity = idx === activeIndex ? 0.7 : 0.15;
      seat.cushionMat.emissiveIntensity = intensity;
      seat.cushionMat.needsUpdate = true;
    });
  }

  const latestStateRef = { state: null };

  function syncState(state) {
    if (!state || !Array.isArray(state.players)) return;
    latestStateRef.state = state;
    if (state.players.length !== activeSeatCount) {
      buildSeating(state.players.length);
      needsPlacementUpdate = true;
    }
    updateHands(state);
    updatePile(state.pile || []);
    highlightSeat(state.turn ?? 0);
    needsPlacementUpdate = true;
  }

  function requestResize() {
    fitCamera();
  }

  renderer.setAnimationLoop(() => {
    updatePlacementsIfNeeded();
    renderer.render(scene, camera);
  });

  window.murlanArena = {
    init(count) {
      if (typeof count === 'number' && count > 0) {
        buildSeating(count);
        needsPlacementUpdate = true;
      }
      if (latestStateRef.state) syncState(latestStateRef.state);
    },
    syncState,
    highlightSeat,
    getSeatPlacements(count) {
      if (typeof count === 'number') {
        return seatPlacements.slice(0, Math.min(count, seatPlacements.length));
      }
      return seatPlacements.slice();
    },
    requestResize
  };
}
