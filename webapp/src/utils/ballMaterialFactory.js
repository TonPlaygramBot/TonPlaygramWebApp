import * as THREE from 'three';
import { applySRGBColorSpace } from './colorSpace.js';

const BALL_TEXTURE_SIZE = 4096; // ultra high resolution for sharper billiard ball textures
const MILKY_WHITE = '#f7f3ec';
const MILKY_WHITE_SHADE = '#ede6dc';
const MILKY_WHITE_GLOSS = '#fff8f1';
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
  const radius = size * 0.092;
  const badgeStretch = 2; // compensate equirectangular vertical compression on spheres
  const cx = size * 0.5;
  const cy = size * 0.5;

  ctx.save();

  ctx.beginPath();
  ctx.ellipse(cx, cy, radius, radius * badgeStretch, 0, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = MILKY_WHITE_GLOSS;
  ctx.fill();

  ctx.lineWidth = Math.max(1.6, Math.floor(size * 0.016));
  ctx.strokeStyle = '#000000';
  ctx.stroke();

  ctx.fillStyle = '#000000';
  const fontSize = size * 0.16;
  ctx.font = `bold ${fontSize}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const numStr = String(number);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, badgeStretch);
  if (numStr.length === 2) {
    const [first, second] = numStr.split('');
    const w1 = ctx.measureText(first).width;
    const w2 = ctx.measureText(second).width;
    const spacing = -fontSize * 0.08; // pull double digits slightly closer together
    const total = w1 + w2 + spacing;
    let cursor = -total / 2;
    ctx.fillText(first, cursor + w1 / 2, 0);
    cursor += w1 + spacing;
    ctx.fillText(second, cursor + w2 / 2, 0);
  } else {
    ctx.fillText(numStr, 0, 0);
  }
  ctx.restore();

  ctx.restore();
}

function drawEmbeddedSpot(ctx, cx, cy, radius, color, stretch = 1.12) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, stretch);

  const grad = ctx.createRadialGradient(0, 0, radius * 0.2, 0, 0, radius);
  grad.addColorStop(0, lighten(color, 0.16));
  grad.addColorStop(0.55, color);
  grad.addColorStop(1, darken(color, 0.12));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fill();

  ctx.lineWidth = radius * 0.18;
  ctx.strokeStyle = 'rgba(0,0,0,0.16)';
  ctx.stroke();

  ctx.globalCompositeOperation = 'multiply';
  const insetShadow = ctx.createRadialGradient(0, 0, radius * 0.3, 0, 0, radius * 1.1);
  insetShadow.addColorStop(0, 'rgba(0,0,0,0)');
  insetShadow.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = insetShadow;
  ctx.fill();

  ctx.restore();
}

function drawCueBallSpots(ctx, size) {
  const radius = size * 0.092;
  const positions = [
    { u: 0.5, v: 0.5 },
    { u: 0.999, v: 0.5 },
    { u: 0.75, v: 0.5 },
    { u: 0.25, v: 0.5 },
    { u: 0.5, v: 0.035 },
    { u: 0.5, v: 0.965 }
  ];
  positions.forEach(({ u, v }) => {
    drawEmbeddedSpot(ctx, size * u, size * v, radius, '#d82626');
  });
}

function drawPoolBallTexture(ctx, size, baseColor, pattern, number) {
  const baseHex = toHexString(baseColor);

  ctx.fillStyle = pattern === 'stripe' ? MILKY_WHITE : baseHex;
  ctx.fillRect(0, 0, size, size);

  if (pattern === 'stripe') {
    ctx.fillStyle = baseHex;
    const stripeHeight = size * 0.45;
    const stripeY = (size - stripeHeight) / 2;
    ctx.fillRect(0, stripeY, size, stripeHeight);
  }

  if (pattern === 'cue') {
    ctx.save();
    const radial = ctx.createRadialGradient(
      size * 0.32,
      size * 0.3,
      size * 0.12,
      size * 0.6,
      size * 0.7,
      size * 0.64
    );
    radial.addColorStop(0, lighten(MILKY_WHITE, 0.18));
    radial.addColorStop(0.45, MILKY_WHITE);
    radial.addColorStop(1, darken(MILKY_WHITE_SHADE, 0.08));
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, size, size);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const highlight = ctx.createRadialGradient(
      size * 0.34,
      size * 0.28,
      size * 0.06,
      size * 0.34,
      size * 0.28,
      size * 0.24
    );
    highlight.addColorStop(0, MILKY_WHITE_GLOSS);
    highlight.addColorStop(0.5, 'rgba(255,255,255,0.32)');
    highlight.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = highlight;
    ctx.fillRect(0, 0, size, size);
    ctx.restore();

    drawCueBallSpots(ctx, size);
  }

  if (Number.isFinite(number)) {
    drawPoolNumberBadge(ctx, size, number);
  }
}

function drawDefaultBallTexture(ctx, size, baseColor, pattern, number) {
  const baseHex = toHexString(baseColor);

  ctx.save();
  if (pattern === 'stripe') {
    ctx.fillStyle = MILKY_WHITE;
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
    color: 0xfaf7f2,
    map,
    clearcoat: 1,
    clearcoatRoughness: 0.01,
    metalness: 0.28,
    roughness: 0.045,
    reflectivity: 1,
    sheen: 0.2,
    sheenColor: new THREE.Color(0xf4f4fb),
    envMapIntensity: 1.3
  });
  material.needsUpdate = true;
  BALL_MATERIAL_CACHE.set(cacheKey, material);
  return material;
}

export function clearBallMaterialCache() {
  BALL_MATERIAL_CACHE.clear();
  BALL_TEXTURE_CACHE.clear();
}
