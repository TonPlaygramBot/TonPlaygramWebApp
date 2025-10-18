import * as THREE from 'three';

const clamp01 = (v) => Math.min(1, Math.max(0, v));

const DOMINO_ROOM = Object.freeze({
  width: 6.2,
  depth: 6.2,
  wallThickness: 0.45,
  wallHeight: 3.4,
  carpetThickness: 0.12
});

const CHAIR_DIMENSIONS = Object.freeze({
  seatWidth: 0.72,
  seatDepth: 0.72,
  seatThickness: 0.12,
  backHeight: 0.62,
  backThickness: 0.08,
  armHeight: 0.3,
  armThickness: 0.1,
  armDepth: 0.76,
  columnHeight: 0.38,
  baseThickness: 0.08,
  columnRadiusTop: 0.11,
  columnRadiusBottom: 0.15,
  baseRadius: 0.46,
  footRingRadius: 0.34,
  footRingTube: 0.03
});

export const DEFAULT_DOMINO_CHAIR_OPTION = Object.freeze({
  id: 'crimsonVelvet',
  primary: '#8b1538',
  accent: '#5c0f26',
  highlight: '#d35a7a',
  legColor: '#1f1f1f'
});

export const DOMINO_CAMERA_DEFAULTS = Object.freeze({
  fov: 56,
  near: 0.05,
  far: 100,
  initial: Object.freeze({
    radius: 3.3319,
    phi: 1.034,
    theta: 0.773
  }),
  phiMin: 0.82,
  phiMax: 1.25,
  minRadiusFactor: 0.72,
  maxRadiusFactor: 1.65
});

let cachedCarpetTextures = null;

function ensureDominoCarpetTextures(renderer) {
  if (cachedCarpetTextures) return cachedCarpetTextures;
  if (typeof document === 'undefined') {
    cachedCarpetTextures = { map: null, bump: null };
    return cachedCarpetTextures;
  }

  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#7c242f');
  gradient.addColorStop(1, '#9d3642');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const prng = (seed) => {
    let value = seed >>> 0;
    return () => {
      value = (value * 1664525 + 1013904223) % 4294967296;
      return value / 4294967296;
    };
  };

  const rand = prng(987654321);
  const image = ctx.getImageData(0, 0, size, size);
  const data = image.data;
  const baseColor = { r: 112, g: 28, b: 34 };
  const highlightColor = { r: 196, g: 72, b: 82 };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const fiber = (Math.sin((x / size) * Math.PI * 14) + Math.cos((y / size) * Math.PI * 16)) * 0.08;
      const grain = (rand() - 0.5) * 0.12;
      const shade = clamp01(0.55 + fiber * 0.75 + grain * 0.6);
      const r = baseColor.r + (highlightColor.r - baseColor.r) * shade;
      const g = baseColor.g + (highlightColor.g - baseColor.g) * shade;
      const b = baseColor.b + (highlightColor.b - baseColor.b) * shade;
      data[idx] = Math.round(clamp01(r / 255) * 255);
      data[idx + 1] = Math.round(clamp01(g / 255) * 255);
      data[idx + 2] = Math.round(clamp01(b / 255) * 255);
    }
  }
  ctx.putImageData(image, 0, 0);

  ctx.globalAlpha = 0.04;
  ctx.fillStyle = '#4f1119';
  for (let row = 0; row < size; row += 3) {
    ctx.fillRect(0, row, size, 1);
  }
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
  ctx.strokeStyle = '#f2b7b4';
  ctx.shadowColor = 'rgba(80,20,30,0.18)';
  ctx.shadowBlur = stripeWidth * 0.8;
  drawRoundedRect(ctx, stripeInset, stripeInset, size - stripeInset * 2, size - stripeInset * 2, stripeRadius);
  ctx.stroke();
  ctx.shadowBlur = 0;

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = renderer?.capabilities?.getMaxAnisotropy?.() ?? 8;
  texture.minFilter = THREE.LinearMipMapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  if ('colorSpace' in texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = bumpCanvas.height = size;
  const bumpCtx = bumpCanvas.getContext('2d');
  bumpCtx.drawImage(canvas, 0, 0);
  const bumpImage = bumpCtx.getImageData(0, 0, size, size);
  const bumpData = bumpImage.data;
  const bumpRand = prng(246813579);
  for (let i = 0; i < bumpData.length; i += 4) {
    const r = bumpData[i];
    const g = bumpData[i + 1];
    const b = bumpData[i + 2];
    const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
    const noise = (bumpRand() - 0.5) * 0.16;
    const value = Math.floor(clamp01(0.62 + lum * 0.28 + noise) * 255);
    bumpData[i] = bumpData[i + 1] = bumpData[i + 2] = value;
  }
  bumpCtx.putImageData(bumpImage, 0, 0);

  const bump = new THREE.CanvasTexture(bumpCanvas);
  bump.wrapS = bump.wrapT = THREE.ClampToEdgeWrapping;
  bump.anisotropy = Math.min(texture.anisotropy ?? 4, 6);
  bump.minFilter = THREE.LinearMipMapLinearFilter;
  bump.magFilter = THREE.LinearFilter;
  bump.generateMipmaps = true;

  cachedCarpetTextures = { map: texture, bump };
  return cachedCarpetTextures;
}

export function createDominoCarpetMaterial(renderer) {
  const carpetTextures = ensureDominoCarpetTextures(renderer);
  const material = new THREE.MeshStandardMaterial({
    color: 0x8c2a2e,
    roughness: 0.9,
    metalness: 0.025
  });
  if (carpetTextures.map) {
    material.map = carpetTextures.map;
    material.map.needsUpdate = true;
  }
  if (carpetTextures.bump) {
    material.bumpMap = carpetTextures.bump;
    material.bumpScale = 0.18;
    material.bumpMap.needsUpdate = true;
  }
  return material;
}

function adjustHexColor(hex, amount) {
  const base = new THREE.Color(hex);
  const target = amount >= 0 ? new THREE.Color(0xffffff) : new THREE.Color(0x000000);
  base.lerp(target, Math.min(Math.abs(amount), 1));
  return `#${base.getHexString()}`;
}

const CHAIR_CLOTH_TEXTURE_SIZE = 512;
const CHAIR_CLOTH_REPEAT = 4;

function createChairClothTexture(option, renderer) {
  if (typeof document === 'undefined') {
    return null;
  }
  const primary = option?.primary ?? '#0f6a2f';
  const accent = option?.accent ?? adjustHexColor(primary, -0.28);
  const highlight = option?.highlight ?? adjustHexColor(primary, 0.22);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = CHAIR_CLOTH_TEXTURE_SIZE;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const shadow = adjustHexColor(accent, -0.22);
  const seam = adjustHexColor(accent, -0.35);

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, adjustHexColor(primary, 0.2));
  gradient.addColorStop(0.5, primary);
  gradient.addColorStop(1, accent);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const spacing = canvas.width / CHAIR_CLOTH_REPEAT;
  const halfSpacing = spacing / 2;
  const lineWidth = Math.max(1.6, spacing * 0.06);

  ctx.strokeStyle = seam;
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
  ctx.globalAlpha = 1;

  ctx.strokeStyle = adjustHexColor(highlight, 0.18);
  ctx.lineWidth = lineWidth * 0.55;
  ctx.globalAlpha = 0.55;
  for (let offset = -canvas.height; offset <= canvas.width + canvas.height; offset += spacing) {
    ctx.beginPath();
    ctx.moveTo(offset + halfSpacing, 0);
    ctx.lineTo(offset + halfSpacing - canvas.height, canvas.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(offset + halfSpacing, 0);
    ctx.lineTo(offset + halfSpacing + canvas.height, canvas.height);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  const tuftRadius = Math.max(1.8, spacing * 0.08);
  for (let y = -spacing; y <= canvas.height + spacing; y += spacing) {
    for (let x = -spacing; x <= canvas.width + spacing; x += spacing) {
      ctx.beginPath();
      ctx.ellipse(x + halfSpacing, y + halfSpacing, tuftRadius, tuftRadius * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  const sheenGradient = ctx.createRadialGradient(
    canvas.width * 0.28,
    canvas.height * 0.32,
    canvas.width * 0.05,
    canvas.width * 0.28,
    canvas.height * 0.32,
    canvas.width * 0.75
  );
  sheenGradient.addColorStop(0, 'rgba(255, 255, 255, 0.26)');
  sheenGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.08)');
  sheenGradient.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
  ctx.fillStyle = sheenGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  ctx.globalAlpha = 0.08;
  for (let y = 0; y < canvas.height; y += 2) {
    for (let x = 0; x < canvas.width; x += 2) {
      ctx.fillStyle = Math.random() > 0.5 ? highlight : shadow;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(CHAIR_CLOTH_REPEAT, CHAIR_CLOTH_REPEAT);
  texture.anisotropy = renderer?.capabilities?.getMaxAnisotropy?.() ?? 8;
  if ('colorSpace' in texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }
  texture.needsUpdate = true;
  return texture;
}

function createChairFabricMaterial(option, renderer) {
  const texture = createChairClothTexture(option, renderer);
  const primary = option?.primary ?? '#0f6a2f';
  const sheenColor = option?.highlight ?? adjustHexColor(primary, 0.2);
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(adjustHexColor(primary, 0.04)),
    map: texture,
    roughness: 0.28,
    metalness: 0.08,
    clearcoat: 1,
    clearcoatRoughness: 0.28,
    sheen: 0.18
  });
  if ('sheenColor' in material) {
    material.sheenColor.set(sheenColor);
  }
  if ('sheenRoughness' in material) {
    material.sheenRoughness = 0.32;
  }
  if ('specularIntensity' in material) {
    material.specularIntensity = 0.65;
  }
  return material;
}

const chairMaterialCache = new Map();

function getDominoChairMaterials(renderer, option = DEFAULT_DOMINO_CHAIR_OPTION) {
  const key = option?.id ?? JSON.stringify(option);
  if (chairMaterialCache.has(key)) {
    return chairMaterialCache.get(key);
  }
  const materials = {
    fabric: createChairFabricMaterial(option, renderer),
    leg: new THREE.MeshStandardMaterial({
      color: new THREE.Color(option?.legColor ?? '#1f1f1f'),
      metalness: 0.6,
      roughness: 0.35
    }),
    accent: new THREE.MeshStandardMaterial({
      color: new THREE.Color('#2a2a2a'),
      metalness: 0.75,
      roughness: 0.32
    })
  };
  chairMaterialCache.set(key, materials);
  return materials;
}

export function createDominoChair(option = DEFAULT_DOMINO_CHAIR_OPTION, renderer, sharedMaterials = null) {
  const materials = sharedMaterials ?? getDominoChairMaterials(renderer, option);
  const group = new THREE.Group();
  const dims = CHAIR_DIMENSIONS;

  const base = new THREE.Mesh(new THREE.CylinderGeometry(dims.baseRadius, dims.baseRadius * 1.02, dims.baseThickness, 32), materials.leg);
  base.position.y = dims.baseThickness / 2;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(dims.columnRadiusBottom, dims.columnRadiusTop, dims.columnHeight, 24),
    materials.leg
  );
  column.position.y = dims.baseThickness + dims.columnHeight / 2;
  column.castShadow = true;
  column.receiveShadow = true;
  group.add(column);

  const footRing = new THREE.Mesh(new THREE.TorusGeometry(dims.footRingRadius, dims.footRingTube, 16, 48), materials.accent);
  footRing.rotation.x = Math.PI / 2;
  footRing.position.y = dims.baseThickness + dims.columnHeight * 0.45;
  footRing.castShadow = true;
  group.add(footRing);

  const seat = new THREE.Mesh(
    new THREE.BoxGeometry(dims.seatWidth, dims.seatThickness, dims.seatDepth),
    materials.fabric
  );
  seat.position.y = dims.baseThickness + dims.columnHeight + dims.seatThickness / 2;
  seat.castShadow = true;
  seat.receiveShadow = true;
  group.add(seat);

  const cushion = new THREE.Mesh(
    new THREE.BoxGeometry(dims.seatWidth * 0.92, dims.seatThickness * 0.6, dims.seatDepth * 0.92),
    materials.fabric
  );
  cushion.position.y = seat.position.y + dims.seatThickness * 0.2;
  cushion.castShadow = true;
  cushion.receiveShadow = true;
  group.add(cushion);

  const back = new THREE.Mesh(
    new THREE.BoxGeometry(dims.seatWidth * 0.98, dims.backHeight, dims.backThickness),
    materials.fabric
  );
  back.position.set(0, seat.position.y + dims.backHeight / 2 - dims.seatThickness / 2, dims.seatDepth / 2 - dims.backThickness / 2);
  back.castShadow = true;
  back.receiveShadow = true;
  group.add(back);

  const armGeo = new THREE.BoxGeometry(dims.armThickness, dims.armHeight, dims.armDepth);
  const armY = seat.position.y + dims.armHeight / 2 - dims.seatThickness * 0.25;
  const armOffsetZ = (dims.armDepth - dims.seatDepth) / 2;

  const armLeft = new THREE.Mesh(armGeo, materials.fabric);
  armLeft.position.set(-dims.seatWidth / 2 + dims.armThickness / 2, armY, armOffsetZ);
  armLeft.castShadow = true;
  armLeft.receiveShadow = true;
  group.add(armLeft);

  const armRight = new THREE.Mesh(armGeo, materials.fabric);
  armRight.position.set(dims.seatWidth / 2 - dims.armThickness / 2, armY, armOffsetZ);
  armRight.castShadow = true;
  armRight.receiveShadow = true;
  group.add(armRight);

  const armCapGeo = new THREE.BoxGeometry(dims.armThickness * 0.9, dims.armThickness * 0.35, dims.armDepth * 0.92);
  const armCapY = armY + dims.armHeight / 2 - (dims.armThickness * 0.35) / 2;

  const armCapLeft = new THREE.Mesh(armCapGeo, materials.fabric);
  armCapLeft.position.set(armLeft.position.x, armCapY, armOffsetZ * 0.94);
  armCapLeft.castShadow = true;
  armCapLeft.receiveShadow = true;
  group.add(armCapLeft);

  const armCapRight = new THREE.Mesh(armCapGeo, materials.fabric);
  armCapRight.position.set(armRight.position.x, armCapY, armOffsetZ * 0.94);
  armCapRight.castShadow = true;
  armCapRight.receiveShadow = true;
  group.add(armCapRight);

  const columnCap = new THREE.Mesh(new THREE.CylinderGeometry(dims.columnRadiusTop * 1.05, dims.columnRadiusTop * 1.05, 0.02, 24), materials.accent);
  columnCap.position.y = dims.baseThickness + dims.columnHeight + 0.01;
  columnCap.castShadow = true;
  columnCap.receiveShadow = true;
  group.add(columnCap);

  return group;
}

function roundedRectShape(hw = 0.95, hh = 0.95, r = 0.06) {
  const s = new THREE.Shape();
  s.moveTo(-hw + r, -hh);
  s.lineTo(hw - r, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + r);
  s.lineTo(hw, hh - r);
  s.quadraticCurveTo(hw, hh, hw - r, hh);
  s.lineTo(-hw + r, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - r);
  s.lineTo(-hw, -hh + r);
  s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  return s;
}

function makeClothTexture(color = '#155c2a', renderer) {
  if (typeof document === 'undefined') {
    return null;
  }
  const canvas = document.createElement('canvas');
  const size = 512;
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < size; i += 6) {
    ctx.fillRect(i, 0, 1, size);
    ctx.fillRect(0, i, size, 1);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 5);
  texture.anisotropy = renderer?.capabilities?.getMaxAnisotropy?.() ?? 8;
  if ('colorSpace' in texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }
  return texture;
}

function disposeMaterial(material, { disposeMap = true } = {}) {
  if (!material) return;
  if (disposeMap && material.map?.dispose) {
    material.map.dispose();
  }
  if (disposeMap && material.bumpMap?.dispose) {
    material.bumpMap.dispose();
  }
  material.dispose?.();
}

export function createDominoPokerTable({ THREE: ThreeRef = THREE, renderer, scale = 1 } = {}) {
  const tableGroup = new ThreeRef.Group();
  const disposeItems = [];

  const wood = new ThreeRef.MeshStandardMaterial({ color: '#5a3a19', roughness: 0.55, metalness: 0.08 });
  const woodDark = new ThreeRef.MeshStandardMaterial({ color: '#4a3115', roughness: 0.7, metalness: 0.05 });
  const feltTexture = makeClothTexture('#155c2a', renderer);
  const felt = new ThreeRef.MeshStandardMaterial({ color: '#155c2a', map: feltTexture, roughness: 1, metalness: 0 });
  const baseGreen = new ThreeRef.MeshStandardMaterial({ color: '#0f3e2d', roughness: 0.85, metalness: 0.05 });

  disposeItems.push(() => disposeMaterial(wood));
  disposeItems.push(() => disposeMaterial(woodDark));
  disposeItems.push(() => disposeMaterial(felt));
  disposeItems.push(() => disposeMaterial(baseGreen));

  const Y = 0.64;
  const OUT_HW = 0.95;
  const IN_HW = 0.76;
  const CLOTH_HW = 0.7;
  const RIM_H = 0.07;
  const clothTop = Y + 0.022;

  {
    const geo = new ThreeRef.ExtrudeGeometry(roundedRectShape(OUT_HW, OUT_HW, 0.06), {
      depth: 0.02,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.012
    });
    geo.rotateX(-Math.PI / 2);
    const mesh = new ThreeRef.Mesh(geo, wood);
    mesh.position.y = Y;
    mesh.castShadow = true;
    tableGroup.add(mesh);
    disposeItems.push(() => geo.dispose());
  }

  {
    const geo = new ThreeRef.ExtrudeGeometry(roundedRectShape(CLOTH_HW, CLOTH_HW, 0.04), {
      depth: 0.012,
      bevelEnabled: false
    });
    geo.rotateX(-Math.PI / 2);
    const mesh = new ThreeRef.Mesh(geo, felt);
    mesh.position.y = clothTop;
    mesh.receiveShadow = true;
    tableGroup.add(mesh);
    disposeItems.push(() => geo.dispose());
  }

  {
    const outer = roundedRectShape(OUT_HW, OUT_HW, 0.06);
    const inner = roundedRectShape(IN_HW, IN_HW, 0.05);
    outer.holes.push(inner);
    const geo = new ThreeRef.ExtrudeGeometry(outer, {
      depth: RIM_H,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02
    });
    geo.rotateX(-Math.PI / 2);
    const mesh = new ThreeRef.Mesh(geo, woodDark);
    mesh.position.y = Y + 0.02;
    mesh.castShadow = true;
    tableGroup.add(mesh);
    disposeItems.push(() => geo.dispose());
  }

  {
    const skirtH = 0.6;
    const geo = new ThreeRef.BoxGeometry((OUT_HW + 0.05) * 2, skirtH, (OUT_HW + 0.05) * 2);
    const mesh = new ThreeRef.Mesh(geo, baseGreen);
    mesh.position.y = Y - skirtH / 2 + 0.01;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    tableGroup.add(mesh);
    disposeItems.push(() => geo.dispose());
  }

  tableGroup.scale.setScalar(scale);
  const surfaceY = clothTop * scale;
  const clothDiameter = CLOTH_HW * 2 * scale;
  const chairRadius = (OUT_HW + 0.55) * scale;
  const chairLookTargetY = (CHAIR_DIMENSIONS.baseThickness + CHAIR_DIMENSIONS.columnHeight + CHAIR_DIMENSIONS.seatThickness) * scale;

  return {
    group: tableGroup,
    surfaceY,
    clothDiameter,
    radius: OUT_HW * scale,
    chairRadius,
    chairLookTargetY,
    scale,
    dispose: () => {
      disposeItems.forEach((fn) => fn?.());
    }
  };
}

export function createDominoChairRing({
  THREE: ThreeRef = THREE,
  renderer,
  radius,
  lookTargetY,
  option = DEFAULT_DOMINO_CHAIR_OPTION,
  seatCount = 4,
  scale = 1
}) {
  const sharedMaterials = getDominoChairMaterials(renderer, option);
  const chairs = [];
  const lookTarget = new ThreeRef.Vector3(0, lookTargetY, 0);

  for (let i = 0; i < seatCount; i++) {
    const angle = (i / seatCount) * Math.PI * 2;
    const x = Math.sin(angle) * radius;
    const z = Math.cos(angle) * radius;
    const chair = createDominoChair(option, renderer, sharedMaterials);
    chair.scale.setScalar(scale);
    chair.position.set(x, 0, z);
    chair.lookAt(lookTarget);
    chair.rotateY(Math.PI);
    chairs.push(chair);
  }

  return { chairs };
}

export function decorateDominoArenaEnvelope({ THREE: ThreeRef = THREE, arena, renderer }) {
  const carpetMat = createDominoCarpetMaterial(renderer);
  const carpetGeo = new ThreeRef.BoxGeometry(
    DOMINO_ROOM.width - DOMINO_ROOM.wallThickness,
    DOMINO_ROOM.carpetThickness,
    DOMINO_ROOM.depth - DOMINO_ROOM.wallThickness
  );
  const carpet = new ThreeRef.Mesh(carpetGeo, carpetMat);
  carpet.position.y = -DOMINO_ROOM.carpetThickness / 2;
  carpet.receiveShadow = true;
  arena.add(carpet);

  const wallMat = new ThreeRef.MeshStandardMaterial({
    color: 0xb9ddff,
    roughness: 0.88,
    metalness: 0.06
  });

  const makeWall = (width, height, depth) => {
    const geo = new ThreeRef.BoxGeometry(width, height, depth);
    const mesh = new ThreeRef.Mesh(geo, wallMat);
    mesh.position.y = height / 2;
    mesh.receiveShadow = true;
    arena.add(mesh);
    return { mesh, geo };
  };

  const walls = [];
  walls.push(makeWall(DOMINO_ROOM.width, DOMINO_ROOM.wallHeight, DOMINO_ROOM.wallThickness));
  walls[walls.length - 1].mesh.position.z = DOMINO_ROOM.depth / 2 - DOMINO_ROOM.wallThickness / 2;
  walls.push(makeWall(DOMINO_ROOM.width, DOMINO_ROOM.wallHeight, DOMINO_ROOM.wallThickness));
  walls[walls.length - 1].mesh.position.z = -DOMINO_ROOM.depth / 2 + DOMINO_ROOM.wallThickness / 2;
  walls.push(makeWall(DOMINO_ROOM.wallThickness, DOMINO_ROOM.wallHeight, DOMINO_ROOM.depth));
  walls[walls.length - 1].mesh.position.x = -DOMINO_ROOM.width / 2 + DOMINO_ROOM.wallThickness / 2;
  walls.push(makeWall(DOMINO_ROOM.wallThickness, DOMINO_ROOM.wallHeight, DOMINO_ROOM.depth));
  walls[walls.length - 1].mesh.position.x = DOMINO_ROOM.width / 2 - DOMINO_ROOM.wallThickness / 2;

  return {
    carpet,
    walls: walls.map((w) => w.mesh),
    dispose: () => {
      carpetGeo.dispose();
      disposeMaterial(carpetMat, { disposeMap: false });
      walls.forEach(({ geo }) => geo.dispose());
      disposeMaterial(wallMat, { disposeMap: false });
    }
  };
}

export const DOMINO_ROOM_DIMENSIONS = DOMINO_ROOM;
export const DOMINO_CHAIR_DIMENSIONS = CHAIR_DIMENSIONS;
