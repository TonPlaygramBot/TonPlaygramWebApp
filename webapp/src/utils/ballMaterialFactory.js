import * as THREE from 'three';
import { applySRGBColorSpace } from './colorSpace.js';

// Pool Royale generates up to 15 numbered + striped textures when players pick the
// Solids & Stripes skin for UK 8-ball. At 4096px this was exhausting mobile GPUs
// and crashing the session, so dial the texture size back to keep memory in check.
const BALL_TEXTURE_SIZE = 1024;
const BALL_TEXTURE_CACHE = new Map();
const BALL_MATERIAL_CACHE = new Map();
const CUE_TIP_RADIUS_RATIO = 0.1714285714;

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function toHexString(input) {
  const color = new THREE.Color(input);
  return `#${color.getHexString()}`;
}

function mixHex(a, b, t) {
  const colorA = new THREE.Color(a);
  const colorB = new THREE.Color(b);
  colorA.lerp(colorB, clamp01(t));
  return `#${colorA.getHexString()}`;
}

function lighten(hex, amount) {
  return mixHex(hex, 0xffffff, amount);
}

function darken(hex, amount) {
  return mixHex(hex, 0x000000, amount);
}

function addNoise(ctx, size, strength = 0.02, samples = 3600) {
  ctx.save();
  ctx.globalAlpha = strength;
  for (let i = 0; i < samples; i++) {
    ctx.fillStyle = Math.random() > 0.5
      ? 'rgba(255,255,255,0.9)'
      : 'rgba(0,0,0,0.9)';
    ctx.fillRect(Math.random() * size, Math.random() * size, 1, 1);
  }
  ctx.restore();
}

function drawNumberBadge(ctx, size, number) {
  const radius = size * 0.132;
  const cx = size * 0.5;
  const cy = size * 0.55;

  ctx.save();
  const badgeGrad = ctx.createRadialGradient(
    cx,
    cy - radius * 0.35,
    radius * 0.25,
    cx,
    cy,
    radius
  );
  badgeGrad.addColorStop(0, 'rgba(255,255,255,1)');
  badgeGrad.addColorStop(1, 'rgba(222,222,222,1)');
  ctx.fillStyle = badgeGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fill();

  ctx.lineWidth = size * 0.008;
  ctx.strokeStyle = 'rgba(0,0,0,0.16)';
  ctx.stroke();

  const fontSize = size * 0.164;
  ctx.fillStyle = '#121212';
  ctx.font = `600 ${fontSize}px "Arial"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(number), cx, cy + size * 0.005);
  ctx.restore();
}

function drawPoolNumberBadge(ctx, size, number) {
  const radius = size * 0.08; // shrink the badge so numbers sit farther inside the stripes
  const badgeStretch = 2; // compensate equirectangular vertical compression on spheres
  const cx = size * 0.5;
  const cy = size * 0.5;

  ctx.save();

  ctx.beginPath();
  ctx.ellipse(cx, cy, radius, radius * badgeStretch, 0, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.lineWidth = Math.max(2, Math.floor(size * 0.016));
  ctx.strokeStyle = '#000000';
  ctx.stroke();

  const numStr = String(number);

  ctx.fillStyle = '#000000';
  const fontSize = numStr.length === 2 ? size * 0.1296 : size * 0.144; // ~20% smaller label text
  ctx.font = `900 ${fontSize}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, badgeStretch);
  if (numStr.length === 2) {
    ctx.save();
    ctx.scale(0.9, 1);
    ctx.fillText(numStr, 0, 0);
    ctx.restore();
  } else {
    ctx.fillText(numStr, 0, 0);
  }
  ctx.restore();

  ctx.restore();
}

function drawCueBallDots(ctx, size) {
  const dotRadius = size * 0.5 * CUE_TIP_RADIUS_RATIO;
  const angularRadius = (dotRadius / size) * Math.PI;
  const seamInset = Math.min(0.05, Math.max(0.02, angularRadius / (Math.PI * 2)));
  const poleInset = Math.max(seamInset, angularRadius / Math.PI);
  const dotPositions = [
    { u: 0.5, v: 0.5 }, // front
    { u: 0.25, v: 0.5 }, // left
    { u: 0.75, v: 0.5 }, // right
    { u: 0.5, v: poleInset }, // top
    { u: 0.5, v: 1 - poleInset } // bottom
  ];

  const uvToVec3 = (u, v) => {
    const longitude = (u - 0.5) * Math.PI * 2;
    const latitude = (0.5 - v) * Math.PI;
    const cosLat = Math.cos(latitude);
    return {
      x: Math.sin(longitude) * cosLat,
      y: Math.sin(latitude),
      z: Math.cos(longitude) * cosLat
    };
  };

  const drawDot = ({ u, v }) => {
    const du = angularRadius / (Math.PI * 2);
    const dv = angularRadius / Math.PI;
    const minU = Math.max(0, u - du);
    const maxU = Math.min(1, u + du);
    const minV = Math.max(0, v - dv);
    const maxV = Math.min(1, v + dv);
    const startX = Math.floor(minU * size);
    const endX = Math.ceil(maxU * size);
    const startY = Math.floor(minV * size);
    const endY = Math.ceil(maxV * size);
    const width = Math.max(1, endX - startX);
    const height = Math.max(1, endY - startY);
    const imageData = ctx.getImageData(startX, startY, width, height);
    const data = imageData.data;
    const center = uvToVec3(u, v);
    const cosRadius = Math.cos(angularRadius);

    for (let y = 0; y < height; y += 1) {
      const vSample = (startY + y + 0.5) / size;
      for (let x = 0; x < width; x += 1) {
        const uSample = (startX + x + 0.5) / size;
        const point = uvToVec3(uSample, vSample);
        const dot =
          center.x * point.x + center.y * point.y + center.z * point.z;
        if (dot >= cosRadius) {
          const idx = (y * width + x) * 4;
          data[idx] = 220;
          data[idx + 1] = 38;
          data[idx + 2] = 38;
          data[idx + 3] = 255;
        }
      }
    }

    ctx.putImageData(imageData, startX, startY);
  };

  ctx.save();
  dotPositions.forEach(drawDot);

  // Back dot spans the seam to keep a full circle.
  drawDot({ u: seamInset, v: 0.5 });
  drawDot({ u: 1 - seamInset, v: 0.5 });
  ctx.restore();
}

function drawPoolBallTexture(ctx, size, baseColor, pattern, number) {
  const baseHex = toHexString(baseColor);

  ctx.fillStyle = pattern === 'stripe' ? '#ffffff' : baseHex;
  ctx.fillRect(0, 0, size, size);

  if (pattern === 'stripe') {
    ctx.fillStyle = baseHex;
    const stripeHeight = size * 0.45;
    const stripeY = (size - stripeHeight) / 2;
    ctx.fillRect(0, stripeY, size, stripeHeight);
  }

  if (pattern === 'cue') {
    drawCueBallDots(ctx, size);
  }

  if (Number.isFinite(number)) {
    drawPoolNumberBadge(ctx, size, number);
  }
}

function drawDefaultBallTexture(ctx, size, baseColor, pattern, number) {
  const baseHex = toHexString(baseColor);

  ctx.save();
  if (pattern === 'stripe') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    const stripeHeight = size * 0.46;
    const stripeY = (size - stripeHeight) / 2;
    const stripeGrad = ctx.createLinearGradient(0, stripeY, 0, stripeY + stripeHeight);
    stripeGrad.addColorStop(0, lighten(baseHex, 0.28));
    stripeGrad.addColorStop(0.5, lighten(baseHex, 0.1));
    stripeGrad.addColorStop(1, darken(baseHex, 0.06));
    ctx.fillStyle = stripeGrad;
    ctx.fillRect(0, stripeY, size, stripeHeight);

    ctx.lineWidth = size * 0.015;
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.moveTo(0, stripeY);
    ctx.lineTo(size, stripeY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, stripeY + stripeHeight);
    ctx.lineTo(size, stripeY + stripeHeight);
    ctx.stroke();
  } else {
    const radial = ctx.createRadialGradient(
      size * 0.3,
      size * 0.3,
      size * 0.1,
      size * 0.5,
      size * 0.55,
      size * 0.5
    );
    radial.addColorStop(0, lighten(baseHex, 0.34));
    radial.addColorStop(0.45, lighten(baseHex, 0.12));
    radial.addColorStop(1, darken(baseHex, 0.08));
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, size, size);
  }
  ctx.restore();

  ctx.save();
  const diagonalShade = ctx.createLinearGradient(0, 0, size, size);
  diagonalShade.addColorStop(0, 'rgba(255,255,255,0.86)');
  diagonalShade.addColorStop(0.55, 'rgba(255,255,255,0.42)');
  diagonalShade.addColorStop(1, 'rgba(0,0,0,0.16)');
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = diagonalShade;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const highlight = ctx.createRadialGradient(
    size * 0.3,
    size * 0.26,
    size * 0.035,
    size * 0.3,
    size * 0.26,
    size * 0.32
  );
  highlight.addColorStop(0, 'rgba(255,255,255,1)');
  highlight.addColorStop(0.45, 'rgba(255,255,255,0.26)');
  highlight.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = highlight;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  const lowerShadow = ctx.createRadialGradient(
    size * 0.55,
    size * 0.72,
    size * 0.1,
    size * 0.55,
    size * 0.72,
    size * 0.45
  );
  lowerShadow.addColorStop(0, 'rgba(0,0,0,0)');
  lowerShadow.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = lowerShadow;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();

    addNoise(ctx, size, 0.02, 3600);

  if (Number.isFinite(number)) {
    drawNumberBadge(ctx, size, number);
  }
}

function createBallTexture({ baseColor, pattern, number, variantKey }) {
  const key = `${variantKey}|${pattern}|${number ?? 'none'}|${new THREE.Color(baseColor).getHexString()}`;
  if (BALL_TEXTURE_CACHE.has(key)) {
    return BALL_TEXTURE_CACHE.get(key);
  }

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = BALL_TEXTURE_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const size = BALL_TEXTURE_SIZE;
  if (variantKey === 'pool') {
    drawPoolBallTexture(ctx, size, baseColor, pattern, number);
  } else {
    drawDefaultBallTexture(ctx, size, baseColor, pattern, number);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 32;
  texture.minFilter = THREE.LinearMipMapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  applySRGBColorSpace(texture);
  texture.needsUpdate = true;

  BALL_TEXTURE_CACHE.set(key, texture);
  return texture;
}

export function createBallPreviewDataUrl({
  color,
  pattern = 'solid',
  number = null,
  variantKey = 'pool',
  size = 256
} = {}) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const baseColor = color ?? 0xffffff;
  if (variantKey === 'pool') {
    drawPoolBallTexture(ctx, size, baseColor, pattern, number);
  } else {
    drawDefaultBallTexture(ctx, size, baseColor, pattern, number);
  }
  return canvas.toDataURL('image/png');
}

export function getBallMaterial({
  color,
  pattern = 'solid',
  number = null,
  variantKey = 'pool'
} = {}) {
  const baseColor = color ?? 0xffffff;
  const cacheKey = `${variantKey}|${pattern}|${number ?? 'none'}|${new THREE.Color(baseColor).getHexString()}`;
  if (BALL_MATERIAL_CACHE.has(cacheKey)) {
    return BALL_MATERIAL_CACHE.get(cacheKey);
  }

  const map = createBallTexture({
    baseColor,
    pattern,
    number,
    variantKey
  });

  const material = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    metalness: 0.24,
    roughness: 0.08,
    reflectivity: 0.9,
    sheen: 0.14,
    sheenColor: new THREE.Color(0xf8f9ff),
    envMapIntensity: 1.05
  });
  material.needsUpdate = true;
  BALL_MATERIAL_CACHE.set(cacheKey, material);
  return material;
}

export function clearBallMaterialCache() {
  BALL_MATERIAL_CACHE.clear();
  BALL_TEXTURE_CACHE.clear();
}
