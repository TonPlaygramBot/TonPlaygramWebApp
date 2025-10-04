import * as THREE from 'three';

const BALL_TEXTURE_SIZE = 1024;
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

function addNoise(ctx, size, strength = 0.04, samples = 2800) {
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
  const radius = size * 0.18;
  const cx = size * 0.5;
  const cy = size * 0.56;

  ctx.save();
  const badgeGrad = ctx.createRadialGradient(
    cx,
    cy - radius * 0.4,
    radius * 0.2,
    cx,
    cy,
    radius
  );
  badgeGrad.addColorStop(0, 'rgba(255,255,255,1)');
  badgeGrad.addColorStop(1, 'rgba(220,220,220,1)');
  ctx.fillStyle = badgeGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = size * 0.01;
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.stroke();

  const fontSize = size * 0.24;
  ctx.fillStyle = '#111111';
  ctx.font = `bold ${fontSize}px "Arial"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(number), cx, cy + size * 0.01);
  ctx.restore();
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
  const baseHex = toHexString(baseColor);

  ctx.save();
  if (pattern === 'stripe') {
    ctx.fillStyle = '#fefefe';
    ctx.fillRect(0, 0, size, size);
    const stripeHeight = size * 0.46;
    const stripeY = (size - stripeHeight) / 2;
    const stripeGrad = ctx.createLinearGradient(0, stripeY, 0, stripeY + stripeHeight);
    stripeGrad.addColorStop(0, lighten(baseHex, 0.2));
    stripeGrad.addColorStop(0.5, baseHex);
    stripeGrad.addColorStop(1, darken(baseHex, 0.15));
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
    radial.addColorStop(0, lighten(baseHex, 0.3));
    radial.addColorStop(0.45, baseHex);
    radial.addColorStop(1, darken(baseHex, 0.25));
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, size, size);
  }
  ctx.restore();

  ctx.save();
  const diagonalShade = ctx.createLinearGradient(0, 0, size, size);
  diagonalShade.addColorStop(0, 'rgba(255,255,255,0.75)');
  diagonalShade.addColorStop(0.55, 'rgba(255,255,255,0.35)');
  diagonalShade.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = diagonalShade;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const highlight = ctx.createRadialGradient(
    size * 0.32,
    size * 0.28,
    size * 0.04,
    size * 0.32,
    size * 0.28,
    size * 0.28
  );
  highlight.addColorStop(0, 'rgba(255,255,255,0.95)');
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
  lowerShadow.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = lowerShadow;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();

  addNoise(ctx, size, 0.05, 4500);

  if (Number.isFinite(number)) {
    drawNumberBadge(ctx, size, number);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  texture.minFilter = THREE.LinearMipMapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  if ('colorSpace' in texture) texture.colorSpace = THREE.SRGBColorSpace;
  else texture.encoding = THREE.sRGBEncoding;
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
    roughness: 0.16,
    metalness: 0.04,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    reflectivity: 0.9
  });
  material.needsUpdate = true;
  BALL_MATERIAL_CACHE.set(cacheKey, material);
  return material;
}

export function clearBallMaterialCache() {
  BALL_MATERIAL_CACHE.clear();
  BALL_TEXTURE_CACHE.clear();
}
