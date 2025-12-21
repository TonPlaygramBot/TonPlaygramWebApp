import * as THREE from 'three';
import { applySRGBColorSpace } from './colorSpace.js';

const BALL_TEXTURE_SIZE = 4096; // ultra high resolution for sharper billiard ball textures
const BALL_TEXTURE_CACHE = new Map();
const BALL_MATERIAL_CACHE = new Map();

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
  const radius = size * 0.088;
  const badgeStretch = 1.9; // compensate equirectangular vertical compression on spheres
  const cx = size * 0.5;
  const cy = size * 0.5;

  ctx.save();

  const rimGradient = ctx.createLinearGradient(cx, cy - radius, cx, cy + radius);
  rimGradient.addColorStop(0, 'rgba(255,255,255,1)');
  rimGradient.addColorStop(1, 'rgba(235,235,235,1)');

  ctx.beginPath();
  ctx.ellipse(cx, cy, radius, radius * badgeStretch, 0, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = rimGradient;
  ctx.fill();

  ctx.lineWidth = Math.max(1, Math.floor(size * 0.014));
  ctx.strokeStyle = 'rgba(0,0,0,0.28)';
  ctx.stroke();

  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  const gloss = ctx.createRadialGradient(
    cx,
    cy - radius * 0.3,
    radius * 0.1,
    cx,
    cy,
    radius
  );
  gloss.addColorStop(0, 'rgba(255,255,255,0.9)');
  gloss.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gloss;
  ctx.beginPath();
  ctx.ellipse(cx, cy, radius, radius * badgeStretch, 0, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = '#0d0d0d';
  ctx.font = `800 ${size * 0.155}px "DIN Condensed", "Arial Narrow", "Arial"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const numStr = String(number);
  ctx.save();
  ctx.translate(cx, cy + size * 0.0025);
  ctx.scale(1, badgeStretch * 0.98);
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

function drawPoolBallTexture(ctx, size, baseColor, pattern, number) {
  const baseHex = toHexString(baseColor);

  ctx.save();
  ctx.fillStyle = pattern === 'stripe' ? lighten(baseHex, 0.08) : baseHex;
  ctx.fillRect(0, 0, size, size);

  const cx = size * 0.5;
  const cy = size * 0.5;
  const radius = size * 0.5;

  if (pattern === 'stripe') {
    const stripeHeight = size * 0.45;
    const stripeY = (size - stripeHeight) / 2;
    const stripeGrad = ctx.createLinearGradient(0, stripeY, 0, stripeY + stripeHeight);
    stripeGrad.addColorStop(0, lighten(baseHex, 0.2));
    stripeGrad.addColorStop(0.5, lighten(baseHex, 0.08));
    stripeGrad.addColorStop(1, darken(baseHex, 0.12));
    ctx.fillStyle = stripeGrad;
    ctx.fillRect(0, stripeY, size, stripeHeight);

    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    const stripeShadow = ctx.createLinearGradient(0, stripeY, 0, stripeY + stripeHeight);
    stripeShadow.addColorStop(0, 'rgba(0,0,0,0.08)');
    stripeShadow.addColorStop(1, 'rgba(0,0,0,0.18)');
    ctx.fillStyle = stripeShadow;
    ctx.fillRect(0, stripeY, size, stripeHeight);
    ctx.restore();
  } else {
    const radial = ctx.createRadialGradient(
      cx - radius * 0.16,
      cy - radius * 0.14,
      radius * 0.12,
      cx,
      cy + radius * 0.08,
      radius
    );
    radial.addColorStop(0, lighten(baseHex, 0.26));
    radial.addColorStop(0.48, lighten(baseHex, 0.08));
    radial.addColorStop(1, darken(baseHex, 0.12));
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, size, size);
  }

  const vignette = ctx.createRadialGradient(cx, cy, radius * 0.32, cx, cy, radius);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, size, size);

  ctx.globalCompositeOperation = 'screen';
  const highlight = ctx.createRadialGradient(
    cx - radius * 0.16,
    cy - radius * 0.18,
    radius * 0.02,
    cx - radius * 0.16,
    cy - radius * 0.18,
    radius * 0.35
  );
  highlight.addColorStop(0, 'rgba(255,255,255,0.9)');
  highlight.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = highlight;
  ctx.fillRect(0, 0, size, size);

  ctx.globalCompositeOperation = 'source-over';
  addNoise(ctx, size, 0.012, 4200);

  if (Number.isFinite(number)) {
    drawPoolNumberBadge(ctx, size, number);
  }

  ctx.restore();
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
    clearcoatRoughness: 0.015,
    metalness: 0.24,
    roughness: 0.06,
    reflectivity: 1,
    sheen: 0.18,
    sheenColor: new THREE.Color(0xf8f9ff),
    envMapIntensity: 1.18
  });
  material.needsUpdate = true;
  BALL_MATERIAL_CACHE.set(cacheKey, material);
  return material;
}

export function clearBallMaterialCache() {
  BALL_MATERIAL_CACHE.clear();
  BALL_TEXTURE_CACHE.clear();
}
