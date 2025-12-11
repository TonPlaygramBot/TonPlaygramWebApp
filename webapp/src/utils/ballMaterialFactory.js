import * as THREE from 'three';
import { applySRGBColorSpace } from './colorSpace.js';

const BALL_TEXTURE_SIZE = 4096; // ultra high resolution for sharper billiard ball textures
const BALL_TEXTURE_CACHE = new Map();
const BALL_MATERIAL_CACHE = new Map();
const MILK_WHITE = '#f7f3eb';
const CUE_DOT_COLOR = '#e43b3b';
const CUE_DOT_SHADOW = '#9b1c1c';

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

function directionToUV([x, y, z]) {
  const u = 0.5 + Math.atan2(z, x) / (Math.PI * 2);
  const v = 0.5 - Math.asin(Math.max(-1, Math.min(1, y))) / Math.PI;
  return { u, v };
}

function drawRaisedDot(ctx, cx, cy, radius, color = CUE_DOT_COLOR) {
  const highlight = lighten(color, 0.2);
  const edge = darken(color, 0.2);
  const grad = ctx.createRadialGradient(
    cx - radius * 0.25,
    cy - radius * 0.25,
    radius * 0.2,
    cx,
    cy,
    radius
  );
  grad.addColorStop(0, highlight);
  grad.addColorStop(0.6, color);
  grad.addColorStop(1, edge);

  ctx.save();
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fill();

  ctx.lineWidth = Math.max(1, radius * 0.22);
  ctx.strokeStyle = CUE_DOT_SHADOW;
  ctx.stroke();
  ctx.restore();
}

function drawGlossPasses(ctx, size) {
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
  const radius = size * 0.092;
  const badgeStretch = 2; // compensate equirectangular vertical compression on spheres
  const cx = size * 0.5;
  const cy = size * 0.5;

  ctx.save();

  ctx.beginPath();
  ctx.ellipse(cx, cy, radius, radius * badgeStretch, 0, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.lineWidth = Math.max(2, Math.floor(size * 0.02));
  ctx.strokeStyle = '#000000';
  ctx.stroke();

  ctx.fillStyle = '#000000';
  ctx.font = `bold ${size * 0.165}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const numStr = String(number);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, badgeStretch);
  if (numStr.length === 2) {
    ctx.save();
    ctx.scale(0.84, 1);
    ctx.fillText(numStr, 0, 0);
    ctx.restore();
  } else {
    ctx.fillText(numStr, 0, 0);
  }
  ctx.restore();

  ctx.restore();
}

function drawPoolBallTexture(ctx, size, baseColor, pattern, number) {
  const color = new THREE.Color(baseColor);
  const baseHex = `#${color.getHexString()}`;
  const isCueWhite = color.getHexString() === 'ffffff';

  const cueBase = pattern === 'stripe' || isCueWhite ? MILK_WHITE : baseHex;
  ctx.fillStyle = cueBase;
  ctx.fillRect(0, 0, size, size);

  if (pattern === 'stripe') {
    ctx.fillStyle = baseHex;
    const stripeHeight = size * 0.45;
    const stripeY = (size - stripeHeight) / 2;
    ctx.fillRect(0, stripeY, size, stripeHeight);
  }

  const isCueBall = pattern === 'solid' && !Number.isFinite(number) && isCueWhite;

  if (isCueBall) {
    const dotRadius = size * 0.044;
    const normals = [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1]
    ];
    normals.forEach((dir) => {
      const { u, v } = directionToUV(dir);
      drawRaisedDot(ctx, u * size, v * size, dotRadius);
    });
  }

  drawGlossPasses(ctx, size);
  addNoise(ctx, size, 0.012, 3200);

  if (Number.isFinite(number)) {
    drawPoolNumberBadge(ctx, size, number);
  }
}

function drawDefaultBallTexture(ctx, size, baseColor, pattern, number) {
  const baseHex = toHexString(baseColor);

  ctx.save();
  if (pattern === 'stripe') {
    ctx.fillStyle = MILK_WHITE;
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

  drawGlossPasses(ctx, size);

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
    color: 0xfaf7f0,
    map,
    clearcoat: 1,
    clearcoatRoughness: 0.009,
    metalness: 0.22,
    roughness: 0.045,
    reflectivity: 1,
    sheen: 0.22,
    sheenColor: new THREE.Color(0xf2f4ff),
    envMapIntensity: 1.24
  });
  material.needsUpdate = true;
  BALL_MATERIAL_CACHE.set(cacheKey, material);
  return material;
}

export function clearBallMaterialCache() {
  BALL_MATERIAL_CACHE.clear();
  BALL_TEXTURE_CACHE.clear();
}
