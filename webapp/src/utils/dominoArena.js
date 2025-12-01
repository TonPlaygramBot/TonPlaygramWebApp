import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { makeRoughClothTexture, DEFAULT_TABLE_CLOTH_OPTION } from './murlanTable.js';

const ROOM_DIMENSIONS = Object.freeze({
  width: 6.2,
  depth: 6.2,
  wallThickness: 0.45,
  wallHeight: 3.4,
  carpetThickness: 0.12
});

const TABLE_DIMENSIONS = Object.freeze({
  baseY: 0.64,
  outerHalfWidth: 0.95,
  innerHalfWidth: 0.76,
  clothHalfWidth: 0.7,
  rimThickness: 0.07,
  clothRise: 0.022,
  baseSkirtInset: 0.05,
  skirtHeight: 0.6
});

const CHAIR_DIMENSIONS = Object.freeze({
  seatWidth: 0.72,
  seatDepth: 0.72,
  seatThickness: 0.12,
  backHeight: 0.78,
  backThickness: 0.08,
  armHeight: 0.36,
  armThickness: 0.1,
  armDepth: 0.76,
  columnHeight: 0.46,
  baseThickness: 0.08,
  columnRadiusTop: 0.11,
  columnRadiusBottom: 0.15,
  baseRadius: 0.46,
  footRingRadius: 0.34,
  footRingTube: 0.03
});

const DEFAULT_CHAIR_OPTION = Object.freeze({
  primary: '#3b0f1b',
  accent: '#1f0a10',
  highlight: '#a13b52',
  legColor: '#151515'
});

const CAMERA_CONFIG = Object.freeze({
  fov: 56,
  near: 0.05,
  far: 100,
  minRadius: 1.1,
  maxRadius: 4,
  targetY: 0.64,
  maxPolarAngle: Math.PI * 0.49
});

let cachedCarpet = null;
let cachedChairTextures = null;
let cachedEnvTexture = null;

const clamp01 = (v) => Math.min(1, Math.max(0, v));

function ensureEnvTexture(renderer) {
  if (!renderer) return null;
  if (cachedEnvTexture) return cachedEnvTexture;
  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    cachedEnvTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  } catch (error) {
    console.warn('Failed to build Domino PMREM environment', error);
    cachedEnvTexture = null;
  }
  return cachedEnvTexture;
}

function ensureCarpetTextures(renderer) {
  if (cachedCarpet) return cachedCarpet;
  if (typeof document === 'undefined') {
    cachedCarpet = { map: null, bump: null };
    return cachedCarpet;
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
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
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

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
  map.anisotropy = renderer?.capabilities?.getMaxAnisotropy?.() ?? 8;
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
  bump.anisotropy = map.anisotropy;
  bump.minFilter = THREE.LinearMipMapLinearFilter;
  bump.magFilter = THREE.LinearFilter;
  bump.generateMipmaps = true;

  cachedCarpet = { map, bump };
  return cachedCarpet;
}

function adjustHexColor(hex, amount) {
  const base = new THREE.Color(hex);
  const target = amount >= 0 ? new THREE.Color(0xffffff) : new THREE.Color(0x000000);
  base.lerp(target, Math.min(Math.abs(amount), 1));
  return `#${base.getHexString()}`;
}

function ensureChairTexture(option, renderer) {
  if (cachedChairTextures) return cachedChairTextures;
  if (typeof document === 'undefined') {
    cachedChairTextures = null;
    return cachedChairTextures;
  }
  const primary = option?.primary ?? '#0f6a2f';
  const accent = option?.accent ?? adjustHexColor(primary, -0.32);
  const highlight = option?.highlight ?? adjustHexColor(primary, 0.18);
  const size = 512;
  const prng = (seed) => {
    let value = seed >>> 0;
    return () => {
      value = (value * 1664525 + 1013904223) % 4294967296;
      return value / 4294967296;
    };
  };
  const rand = prng(314159265);

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  const seam = adjustHexColor(accent, -0.25);
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, adjustHexColor(primary, -0.06));
  gradient.addColorStop(0.4, primary);
  gradient.addColorStop(1, adjustHexColor(accent, -0.12));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const repeat = 5;
  const spacing = size / repeat;
  const halfSpacing = spacing / 2;
  const lineWidth = Math.max(1.4, spacing * 0.05);

  ctx.strokeStyle = seam;
  ctx.lineWidth = lineWidth;
  ctx.globalAlpha = 0.95;
  for (let offset = -size; offset <= size * 2; offset += spacing) {
    ctx.beginPath();
    ctx.moveTo(offset, 0);
    ctx.lineTo(offset - size, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(offset, 0);
    ctx.lineTo(offset + size, size);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.strokeStyle = adjustHexColor(highlight, 0.12);
  ctx.lineWidth = lineWidth * 0.55;
  ctx.globalAlpha = 0.65;
  for (let offset = -size; offset <= size * 2; offset += spacing) {
    ctx.beginPath();
    ctx.moveTo(offset + halfSpacing, 0);
    ctx.lineTo(offset + halfSpacing - size, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(offset + halfSpacing, 0);
    ctx.lineTo(offset + halfSpacing + size, size);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
  const tuftRadius = Math.max(1.5, spacing * 0.07);
  for (let y = -spacing; y <= size + spacing; y += spacing) {
    for (let x = -spacing; x <= size + spacing; x += spacing) {
      ctx.beginPath();
      ctx.ellipse(x + halfSpacing, y + halfSpacing, tuftRadius, tuftRadius * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  const grainLayers = 4;
  for (let i = 0; i < grainLayers; i += 1) {
    const opacity = 0.18 - i * 0.02;
    ctx.fillStyle = `rgba(255,255,255,${opacity})`;
    for (let g = 0; g < 1800; g += 1) {
      const gx = rand() * size;
      const gy = rand() * size;
      const radius = 0.4 + rand() * 1.2;
      ctx.beginPath();
      ctx.ellipse(gx, gy, radius * 1.6, radius, rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  const sheenGradient = ctx.createRadialGradient(size * 0.26, size * 0.34, size * 0.04, size * 0.26, size * 0.34, size * 0.8);
  sheenGradient.addColorStop(0, 'rgba(255,255,255,0.22)');
  sheenGradient.addColorStop(0.45, 'rgba(255,255,255,0.09)');
  sheenGradient.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.fillStyle = sheenGradient;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = bumpCanvas.height = size;
  const bumpCtx = bumpCanvas.getContext('2d');
  const baseHeight = 128;
  const bumpImage = bumpCtx.createImageData(size, size);
  const bumpData = bumpImage.data;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const idx = (y * size + x) * 4;
      const ripple = Math.sin((x / size) * Math.PI * 4 + rand() * 0.8) * 6;
      const rippleY = Math.cos((y / size) * Math.PI * 3 + rand() * 0.8) * 6;
      const grain = (rand() - 0.5) * 26;
      const value = clamp01((baseHeight + ripple + rippleY + grain) / 255) * 255;
      bumpData[idx] = bumpData[idx + 1] = bumpData[idx + 2] = value;
      bumpData[idx + 3] = 255;
    }
  }

  bumpCtx.putImageData(bumpImage, 0, 0);
  bumpCtx.strokeStyle = `rgba(0,0,0,0.45)`;
  bumpCtx.lineWidth = lineWidth * 0.8;
  for (let offset = -size; offset <= size * 2; offset += spacing) {
    bumpCtx.beginPath();
    bumpCtx.moveTo(offset, 0);
    bumpCtx.lineTo(offset - size, size);
    bumpCtx.stroke();
    bumpCtx.beginPath();
    bumpCtx.moveTo(offset, 0);
    bumpCtx.lineTo(offset + size, size);
    bumpCtx.stroke();
  }
  bumpCtx.lineWidth = lineWidth * 0.5;
  bumpCtx.strokeStyle = `rgba(255,255,255,0.2)`;
  for (let offset = -size; offset <= size * 2; offset += spacing) {
    bumpCtx.beginPath();
    bumpCtx.moveTo(offset + halfSpacing, 0);
    bumpCtx.lineTo(offset + halfSpacing - size, size);
    bumpCtx.stroke();
    bumpCtx.beginPath();
    bumpCtx.moveTo(offset + halfSpacing, 0);
    bumpCtx.lineTo(offset + halfSpacing + size, size);
    bumpCtx.stroke();
  }

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(4, 4);
  map.anisotropy = renderer?.capabilities?.getMaxAnisotropy?.() ?? 8;
  map.colorSpace = THREE.SRGBColorSpace;
  map.needsUpdate = true;

  const normalMap = new THREE.CanvasTexture(bumpCanvas);
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.repeat.set(4, 4);
  normalMap.anisotropy = renderer?.capabilities?.getMaxAnisotropy?.() ?? 8;
  normalMap.needsUpdate = true;

  cachedChairTextures = { map, normalMap };
  return cachedChairTextures;
}

function createChairFabricMaterial(option, renderer) {
  const textures = ensureChairTexture(option, renderer);
  const primary = option?.primary ?? '#0f6a2f';
  const sheenColor = option?.highlight ?? adjustHexColor(primary, 0.18);
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(adjustHexColor(primary, -0.02)),
    map: textures?.map ?? null,
    normalMap: textures?.normalMap ?? null,
    roughness: 0.24,
    metalness: 0.06,
    clearcoat: 0.62,
    clearcoatRoughness: 0.2,
    sheen: 0.14
  });
  if ('sheenColor' in material && material.sheenColor) {
    material.sheenColor.set(sheenColor);
  }
  if ('sheenRoughness' in material) {
    material.sheenRoughness = 0.28;
  }
  if ('specularIntensity' in material) {
    material.specularIntensity = 0.7;
  }
  if (material.normalMap) {
    material.normalScale = new THREE.Vector2(0.55, 0.55);
  }
  return material;
}

function createDominoChair(option, renderer, sharedMaterials = null) {
  const material = sharedMaterials?.fabric ?? createChairFabricMaterial(option, renderer);
  const legMaterial = sharedMaterials?.leg ?? new THREE.MeshStandardMaterial({
    color: new THREE.Color(option?.legColor ?? '#1f1f1f'),
    metalness: 0.6,
    roughness: 0.35
  });
  const metalAccent = sharedMaterials?.accent ?? new THREE.MeshStandardMaterial({
    color: new THREE.Color('#2a2a2a'),
    metalness: 0.75,
    roughness: 0.32
  });

  const group = new THREE.Group();
  const dims = CHAIR_DIMENSIONS;

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(dims.baseRadius, dims.baseRadius * 1.02, dims.baseThickness, 32),
    legMaterial
  );
  base.position.y = dims.baseThickness / 2;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(dims.columnRadiusBottom, dims.columnRadiusTop, dims.columnHeight, 24),
    legMaterial
  );
  column.position.y = dims.baseThickness + dims.columnHeight / 2;
  column.castShadow = true;
  column.receiveShadow = true;
  group.add(column);

  const footRing = new THREE.Mesh(new THREE.TorusGeometry(dims.footRingRadius, dims.footRingTube, 16, 48), metalAccent);
  footRing.rotation.x = Math.PI / 2;
  footRing.position.y = dims.baseThickness + dims.columnHeight * 0.45;
  footRing.castShadow = true;
  group.add(footRing);

  const seat = new THREE.Mesh(
    new THREE.BoxGeometry(dims.seatWidth, dims.seatThickness, dims.seatDepth),
    material
  );
  seat.position.y = dims.baseThickness + dims.columnHeight + dims.seatThickness / 2;
  seat.castShadow = true;
  seat.receiveShadow = true;
  group.add(seat);

  const cushion = new THREE.Mesh(
    new THREE.BoxGeometry(dims.seatWidth * 0.92, dims.seatThickness * 0.6, dims.seatDepth * 0.92),
    material
  );
  cushion.position.y = seat.position.y + dims.seatThickness * 0.2;
  cushion.castShadow = true;
  cushion.receiveShadow = true;
  group.add(cushion);

  const back = new THREE.Mesh(
    new THREE.BoxGeometry(dims.seatWidth * 0.98, dims.backHeight, dims.backThickness),
    material
  );
  back.position.set(0, seat.position.y + dims.backHeight / 2 - dims.seatThickness / 2, dims.seatDepth / 2 - dims.backThickness / 2);
  back.castShadow = true;
  back.receiveShadow = true;
  group.add(back);

  const armGeo = new THREE.BoxGeometry(dims.armThickness, dims.armHeight, dims.armDepth);
  const armY = seat.position.y + dims.armHeight / 2 - dims.seatThickness * 0.25;
  const armOffsetZ = (dims.armDepth - dims.seatDepth) / 2;
  const armLeft = new THREE.Mesh(armGeo, material);
  armLeft.position.set(-dims.seatWidth / 2 + dims.armThickness / 2, armY, armOffsetZ);
  armLeft.castShadow = true;
  armLeft.receiveShadow = true;
  group.add(armLeft);
  const armRight = new THREE.Mesh(armGeo, material);
  armRight.position.set(dims.seatWidth / 2 - dims.armThickness / 2, armY, armOffsetZ);
  armRight.castShadow = true;
  armRight.receiveShadow = true;
  group.add(armRight);

  const armCapGeo = new THREE.BoxGeometry(dims.armThickness * 0.9, dims.armThickness * 0.35, dims.armDepth * 0.92);
  const armCapY = armY + dims.armHeight / 2 - (dims.armThickness * 0.35) / 2;
  const armCapLeft = new THREE.Mesh(armCapGeo, material);
  armCapLeft.position.set(armLeft.position.x, armCapY, armOffsetZ * 0.94);
  armCapLeft.castShadow = true;
  armCapLeft.receiveShadow = true;
  group.add(armCapLeft);
  const armCapRight = new THREE.Mesh(armCapGeo, material);
  armCapRight.position.set(armRight.position.x, armCapY, armOffsetZ * 0.94);
  armCapRight.castShadow = true;
  armCapRight.receiveShadow = true;
  group.add(armCapRight);

  const columnCap = new THREE.Mesh(new THREE.CylinderGeometry(dims.columnRadiusTop * 1.05, dims.columnRadiusTop * 1.05, 0.02, 24), metalAccent);
  columnCap.position.y = dims.baseThickness + dims.columnHeight + 0.01;
  columnCap.castShadow = true;
  columnCap.receiveShadow = true;
  group.add(columnCap);

  return group;
}

function roundedRectShape(hw = 0.95, hh = 0.95, r = 0.06) {
  const shape = new THREE.Shape();
  const w = hw * 2;
  const h = hh * 2;
  shape.moveTo(-hw + r, -hh);
  shape.lineTo(hw - r, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
  shape.lineTo(hw, hh - r);
  shape.quadraticCurveTo(hw, hh, hw - r, hh);
  shape.lineTo(-hw + r, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
  shape.lineTo(-hw, -hh + r);
  shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  return shape;
}

function buildDominoTable(renderer) {
  const disposables = [];
  const group = new THREE.Group();
  const tableY = TABLE_DIMENSIONS.baseY;
  const clothTop = tableY + TABLE_DIMENSIONS.clothRise;

  const woodMat = new THREE.MeshStandardMaterial({ color: '#5a3a19', roughness: 0.55, metalness: 0.08 });
  const woodDark = new THREE.MeshStandardMaterial({ color: '#4a3115', roughness: 0.7, metalness: 0.05 });
  const clothOption = DEFAULT_TABLE_CLOTH_OPTION;
  const feltMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.82,
    metalness: 0.04,
    emissive: clothOption.emissive ?? '#000000',
    emissiveIntensity: Number.isFinite(clothOption.emissiveIntensity)
      ? clothOption.emissiveIntensity
      : 0.08
  });
  const baseMat = new THREE.MeshStandardMaterial({ color: '#0f3e2d', roughness: 0.85, metalness: 0.05 });

  const feltTexture = makeRoughClothTexture(
    1024,
    clothOption.feltTop,
    clothOption.feltBottom,
    renderer?.capabilities?.getMaxAnisotropy?.() ?? 8
  );
  feltMat.map = feltTexture;
  feltMat.needsUpdate = true;

  disposables.push(woodMat, woodDark, feltMat, baseMat, feltTexture);

  const outer = roundedRectShape(TABLE_DIMENSIONS.outerHalfWidth, TABLE_DIMENSIONS.outerHalfWidth, 0.06);
  const extrudeSettings = { depth: 0.02, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012 };
  const outerGeo = new THREE.ExtrudeGeometry(outer, extrudeSettings);
  outerGeo.rotateX(-Math.PI / 2);
  const outerMesh = new THREE.Mesh(outerGeo, woodMat);
  outerMesh.position.y = tableY;
  outerMesh.castShadow = true;
  outerMesh.receiveShadow = true;
  group.add(outerMesh);
  disposables.push(outerGeo);

  const feltShape = roundedRectShape(TABLE_DIMENSIONS.clothHalfWidth, TABLE_DIMENSIONS.clothHalfWidth, 0.04);
  const feltGeo = new THREE.ExtrudeGeometry(feltShape, { depth: 0.012, bevelEnabled: false });
  feltGeo.rotateX(-Math.PI / 2);
  const feltMesh = new THREE.Mesh(feltGeo, feltMat);
  feltMesh.position.y = tableY + TABLE_DIMENSIONS.clothRise;
  feltMesh.receiveShadow = true;
  group.add(feltMesh);
  disposables.push(feltGeo);

  const rimOuter = outer;
  const rimInner = roundedRectShape(TABLE_DIMENSIONS.innerHalfWidth, TABLE_DIMENSIONS.innerHalfWidth, 0.05);
  const rimShape = rimOuter.clone();
  rimShape.holes.push(rimInner);
  const rimGeo = new THREE.ExtrudeGeometry(rimShape, {
    depth: TABLE_DIMENSIONS.rimThickness,
    bevelEnabled: true,
    bevelThickness: TABLE_DIMENSIONS.rimThickness * 0.285,
    bevelSize: TABLE_DIMENSIONS.rimThickness * 0.285
  });
  rimGeo.rotateX(-Math.PI / 2);
  const rimMesh = new THREE.Mesh(rimGeo, woodDark);
  rimMesh.position.y = tableY + 0.02;
  rimMesh.castShadow = true;
  rimMesh.receiveShadow = true;
  group.add(rimMesh);
  disposables.push(rimGeo);

  const skirtSize = (TABLE_DIMENSIONS.outerHalfWidth + TABLE_DIMENSIONS.baseSkirtInset) * 2;
  const skirtGeo = new THREE.BoxGeometry(skirtSize, TABLE_DIMENSIONS.skirtHeight, skirtSize);
  const skirtMesh = new THREE.Mesh(skirtGeo, baseMat);
  skirtMesh.position.y = tableY - TABLE_DIMENSIONS.skirtHeight / 2 + 0.01;
  skirtMesh.castShadow = true;
  skirtMesh.receiveShadow = true;
  group.add(skirtMesh);
  disposables.push(skirtGeo);

  const boardAnchor = new THREE.Object3D();
  boardAnchor.position.set(0, clothTop + 0.006, 0);
  group.add(boardAnchor);

  const dispose = () => {
    disposables.forEach((item) => {
      if (item?.dispose) {
        try {
          item.dispose();
        } catch (error) {
          console.warn('Failed disposing domino table part', error);
        }
      }
    });
  };

  return {
    group,
    boardAnchor,
    clothTop,
    dispose
  };
}

function buildStudioCamera() {
  const cam = new THREE.Group();
  const legLen = 1.2;
  const legRad = 0.025;
  const legGeo = new THREE.CylinderGeometry(legRad, legRad, legLen, 10);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5, metalness: 0.3 });
  const legA = new THREE.Mesh(legGeo, legMat);
  legA.position.set(-0.28, legLen / 2, 0);
  legA.rotation.z = THREE.MathUtils.degToRad(18);
  const legB = legA.clone();
  legB.position.set(0.18, legLen / 2, 0.24);
  const legC = legA.clone();
  legC.position.set(0.18, legLen / 2, -0.24);
  cam.add(legA, legB, legC);

  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.08, 16), new THREE.MeshStandardMaterial({
    color: 0x2e2e2e,
    roughness: 0.6,
    metalness: 0.2
  }));
  head.position.set(0, legLen + 0.04, 0);
  cam.add(head);

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.22), new THREE.MeshStandardMaterial({
    color: 0x151515,
    roughness: 0.5,
    metalness: 0.4
  }));
  body.position.set(0, legLen + 0.2, 0);
  cam.add(body);

  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.22, 16), new THREE.MeshStandardMaterial({
    color: 0x202020,
    roughness: 0.4,
    metalness: 0.5
  }));
  lens.rotation.z = Math.PI / 2;
  lens.position.set(0.22, legLen + 0.2, 0);
  cam.add(lens);

  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.3, 10), new THREE.MeshStandardMaterial({
    color: 0x444444,
    roughness: 0.6
  }));
  handle.rotation.z = THREE.MathUtils.degToRad(30);
  handle.position.set(-0.16, legLen + 0.16, -0.1);
  cam.add(handle);

  return cam;
}

export function buildDominoArena({ scene, renderer }) {
  if (!scene) throw new Error('buildDominoArena requires a THREE.Scene');

  const envTexture = ensureEnvTexture(renderer);
  if (envTexture) {
    scene.environment = envTexture;
  }

  const ambient = new THREE.AmbientLight(0xffffff, 0.45);
  const hemisphere = new THREE.HemisphereLight(0xffffff, 0xb8b19a, 0.55);
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(3.2, 3.6, 2.2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const rim = new THREE.DirectionalLight(0xffffff, 0.55);
  rim.position.set(-2.2, 2.6, -1.4);

  scene.add(ambient, hemisphere, key, rim);

  const arena = new THREE.Group();
  scene.add(arena);

  const trackedGeometries = new Set();
  const trackedMaterials = new Set();

  const carpetTex = ensureCarpetTextures(renderer);
  const carpetMat = new THREE.MeshStandardMaterial({ color: 0x8c2a2e, roughness: 0.9, metalness: 0.025 });
  if (carpetTex.map) {
    carpetMat.map = carpetTex.map;
    carpetMat.map.needsUpdate = true;
  }
  if (carpetTex.bump) {
    carpetMat.bumpMap = carpetTex.bump;
    carpetMat.bumpScale = 0.18;
    carpetMat.bumpMap.needsUpdate = true;
  }

  const carpet = new THREE.Mesh(
    new THREE.BoxGeometry(
      ROOM_DIMENSIONS.width - ROOM_DIMENSIONS.wallThickness,
      ROOM_DIMENSIONS.carpetThickness,
      ROOM_DIMENSIONS.depth - ROOM_DIMENSIONS.wallThickness
    ),
    carpetMat
  );
  carpet.position.y = -ROOM_DIMENSIONS.carpetThickness / 2;
  carpet.receiveShadow = true;
  arena.add(carpet);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xb9ddff, roughness: 0.88, metalness: 0.06 });

  const makeWall = (width, height, depth) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), wallMat);
    wall.position.y = height / 2;
    wall.receiveShadow = true;
    arena.add(wall);
    return wall;
  };

  const backWall = makeWall(ROOM_DIMENSIONS.width, ROOM_DIMENSIONS.wallHeight, ROOM_DIMENSIONS.wallThickness);
  backWall.position.z = ROOM_DIMENSIONS.depth / 2 - ROOM_DIMENSIONS.wallThickness / 2;
  const frontWall = makeWall(ROOM_DIMENSIONS.width, ROOM_DIMENSIONS.wallHeight, ROOM_DIMENSIONS.wallThickness);
  frontWall.position.z = -ROOM_DIMENSIONS.depth / 2 + ROOM_DIMENSIONS.wallThickness / 2;
  const leftWall = makeWall(ROOM_DIMENSIONS.wallThickness, ROOM_DIMENSIONS.wallHeight, ROOM_DIMENSIONS.depth);
  leftWall.position.x = -ROOM_DIMENSIONS.width / 2 + ROOM_DIMENSIONS.wallThickness / 2;
  const rightWall = makeWall(ROOM_DIMENSIONS.wallThickness, ROOM_DIMENSIONS.wallHeight, ROOM_DIMENSIONS.depth);
  rightWall.position.x = ROOM_DIMENSIONS.width / 2 - ROOM_DIMENSIONS.wallThickness / 2;

  const table = buildDominoTable(renderer);
  arena.add(table.group);

  const sharedChairMaterials = {
    fabric: createChairFabricMaterial(DEFAULT_CHAIR_OPTION, renderer),
    leg: new THREE.MeshStandardMaterial({
      color: new THREE.Color(DEFAULT_CHAIR_OPTION.legColor),
      metalness: 0.6,
      roughness: 0.35
    }),
    accent: new THREE.MeshStandardMaterial({
      color: new THREE.Color('#2a2a2a'),
      metalness: 0.75,
      roughness: 0.32
    })
  };
  Object.values(sharedChairMaterials).forEach((material) => {
    if (material) trackedMaterials.add(material);
  });

  const chairRadius = TABLE_DIMENSIONS.outerHalfWidth + 0.55;
  const chairHeight =
    CHAIR_DIMENSIONS.baseThickness + CHAIR_DIMENSIONS.columnHeight + CHAIR_DIMENSIONS.seatThickness;
  const lookTarget = new THREE.Vector3(0, chairHeight, 0);
  const chairs = [
    new THREE.Vector3(0, 0, chairRadius),
    new THREE.Vector3(chairRadius, 0, 0),
    new THREE.Vector3(0, 0, -chairRadius),
    new THREE.Vector3(-chairRadius, 0, 0)
  ].map((position) => {
    const chair = createDominoChair(DEFAULT_CHAIR_OPTION, renderer, sharedChairMaterials);
    chair.position.copy(position);
    chair.lookAt(lookTarget);
    chair.rotateY(Math.PI);
    table.group.add(chair);
    chair.traverse((child) => {
      if (child.isMesh) {
        if (child.geometry) trackedGeometries.add(child.geometry);
        if (child.material) trackedMaterials.add(child.material);
      }
    });
    return chair;
  });

  const studioCamA = buildStudioCamera();
  const studioCamB = buildStudioCamera();
  const cameraOffset = TABLE_DIMENSIONS.outerHalfWidth + 1.1;
  studioCamA.position.set(-cameraOffset, 0, -cameraOffset);
  studioCamB.position.set(cameraOffset, 0, cameraOffset);
  arena.add(studioCamA, studioCamB);
  [studioCamA, studioCamB].forEach((rig) => {
    rig.traverse((child) => {
      if (child.isMesh) {
        if (child.geometry) trackedGeometries.add(child.geometry);
        if (child.material) trackedMaterials.add(child.material);
      }
    });
  });

  const dispose = () => {
    [ambient, hemisphere, key, rim].forEach((light) => {
      if (light?.parent) {
        light.parent.remove(light);
      }
    });
    const disposables = [
      carpet.geometry,
      carpet.material,
      wallMat,
      backWall.geometry,
      frontWall.geometry,
      leftWall.geometry,
      rightWall.geometry,
      table
    ];
    disposables.forEach((item) => {
      if (!item) return;
      if (item.dispose) {
        try {
          item.dispose();
        } catch (error) {
          console.warn('Failed disposing domino arena resource', error);
        }
      }
    });
    trackedGeometries.forEach((geo) => {
      if (geo?.dispose) {
        try {
          geo.dispose();
        } catch (error) {
          console.warn('Failed disposing domino arena geometry', error);
        }
      }
    });
    trackedMaterials.forEach((mat) => {
      if (mat?.dispose) {
        try {
          mat.dispose();
        } catch (error) {
          console.warn('Failed disposing domino arena material', error);
        }
      }
    });
    chairs.forEach((chair) => {
      chair.parent?.remove(chair);
    });
    [studioCamA, studioCamB].forEach((rig) => {
      rig.parent?.remove(rig);
    });
    arena.parent?.remove(arena);
  };

  return {
    arena,
    table,
    boardAnchor: table.boardAnchor,
    clothHalfWidth: TABLE_DIMENSIONS.clothHalfWidth,
    clothTop: table.clothTop,
    cameraConfig: CAMERA_CONFIG,
    dispose,
    chairHeight
  };
}

export const DOMINO_TABLE_DIMENSIONS = Object.freeze({
  clothHalfWidth: TABLE_DIMENSIONS.clothHalfWidth,
  clothTop: TABLE_DIMENSIONS.baseY + TABLE_DIMENSIONS.clothRise,
  playfieldSize: TABLE_DIMENSIONS.clothHalfWidth * 2
});

export const DOMINO_CAMERA_CONFIG = CAMERA_CONFIG;
