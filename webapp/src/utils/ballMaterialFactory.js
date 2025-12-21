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

const OFFICIAL_POOL_COLORS = Object.freeze({
  cue: '#f7f7f7',
  solids: {
    1: '#f7c948',
    2: '#1e5eff',
    3: '#cf202a',
    4: '#7d3cff',
    5: '#ff7a00',
    6: '#00c2a8',
    7: '#7a1630',
    8: '#111111'
  },
  stripes: {
    9: '#f7c948',
    10: '#1e5eff',
    11: '#cf202a',
    12: '#7d3cff',
    13: '#ff7a00',
    14: '#00c2a8',
    15: '#7a1630'
  }
});

function drawPoolNumberBadge(ctx, width, height, number) {
  const radius = Math.floor(height * 0.13);
  const centers = [width * 0.25, width * 0.75];

  ctx.save();
  centers.forEach((cx) => {
    const cy = height * 0.5;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(250,250,250,0.98)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.max(8, Math.floor(height * 0.012));
    ctx.stroke();

    ctx.fillStyle = '#111';
    const fs = String(number).length >= 2 ? Math.floor(height * 0.16) : Math.floor(height * 0.19);
    ctx.font = `900 ${fs}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(number), cx, cy + (String(number).length >= 2 ? height * 0.01 : height * 0.012));
  });
  ctx.restore();
}

function addOfficialPoolSpeckle(ctx, width, height) {
  ctx.save();
  ctx.globalAlpha = 0.05;
  for (let i = 0; i < 1800; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const r = 1 + Math.random() * 2;
    ctx.fillStyle = Math.random() > 0.5 ? '#ffffff' : '#000000';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawOfficialPoolTexture(ctx, width, height, baseColor, pattern, number) {
  if (pattern === 'cue') ctx.fillStyle = OFFICIAL_POOL_COLORS.cue;
  else if (pattern === 'solid') ctx.fillStyle = baseColor;
  else ctx.fillStyle = OFFICIAL_POOL_COLORS.cue;

  ctx.fillRect(0, 0, width, height);

  addOfficialPoolSpeckle(ctx, width, height);

  if (pattern === 'stripe') {
    const bandH = Math.floor(height * 0.26);
    const bandY0 = Math.floor(height / 2 - bandH / 2);
    const bandY1 = bandY0 + bandH;

    ctx.fillStyle = baseColor;
    ctx.globalAlpha = 1;
    ctx.fillRect(0, 0, width, bandY0);
    ctx.fillRect(0, bandY1, width, height - bandY1);

    const edge = Math.max(6, Math.floor(height * 0.008));
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.95;
    ctx.fillRect(0, bandY0, width, edge);
    ctx.fillRect(0, bandY1 - edge, width, edge);
    ctx.globalAlpha = 1;
  }

  if (Number.isFinite(number)) {
    drawPoolNumberBadge(ctx, width, height, number);
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

  let texture = null;

  if (variantKey === 'pool') {
    const width = 2048;
    const height = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    drawOfficialPoolTexture(ctx, width, height, toHexString(baseColor), pattern, number);

    texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = 8;
  } else {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = BALL_TEXTURE_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    drawDefaultBallTexture(ctx, BALL_TEXTURE_SIZE, baseColor, pattern, number);

    texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 32;
  }

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

  const material =
    variantKey === 'pool'
      ? new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          map,
          roughness: 0.14,
          metalness: 0.0,
          clearcoat: 1.0,
          clearcoatRoughness: 0.06,
          ior: 1.5,
          reflectivity: 0.6,
          envMapIntensity: 1
        })
      : new THREE.MeshPhysicalMaterial({
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
