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

function addNoise(ctx, size, strength = 0.03, samples = 2800) {
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
  const radius = size * 0.1;
  const cx = size * 0.5;
  const cy = size * 0.5;

  ctx.save();

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.lineWidth = Math.max(2, Math.floor(size * 0.02));
  ctx.strokeStyle = '#000000';
  ctx.stroke();

  ctx.fillStyle = '#000000';
  ctx.font = `bold ${size * 0.18}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const numStr = String(number);
  if (numStr.length === 2) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(0.9, 1);
    ctx.fillText(numStr, 0, 0);
    ctx.restore();
  } else {
    ctx.fillText(numStr, cx, cy);
  }

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
  diagonalShade.addColorStop(0, 'rgba(255,255,255,0.78)');
  diagonalShade.addColorStop(0.55, 'rgba(255,255,255,0.38)');
  diagonalShade.addColorStop(1, 'rgba(0,0,0,0.18)');
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
  highlight.addColorStop(0, 'rgba(255,255,255,0.98)');
  highlight.addColorStop(1, 'rgba(255,255,255,0.05)');
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

  addNoise(ctx, size, 0.03, 4200);

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
  if (variantKey === 'snooker') {
    ctx.fillStyle = toHexString(baseColor);
    ctx.fillRect(0, 0, size, size);
  } else if (variantKey === 'pool') {
    drawPoolBallTexture(ctx, size, baseColor, pattern, number);
  } else {
    drawDefaultBallTexture(ctx, size, baseColor, pattern, number);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 16;
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

  const material =
    variantKey === 'snooker'
      ? new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          map,
          clearcoat: 1,
          clearcoatRoughness: 0.05,
          metalness: 0.05,
          roughness: 0.13,
          reflectivity: 0.9
        })
      : new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          map,
          clearcoat: 1,
          clearcoatRoughness: 0.04,
          metalness: 0.1,
          roughness: 0.12,
          reflectivity: 1
        });
  material.needsUpdate = true;
  BALL_MATERIAL_CACHE.set(cacheKey, material);
  return material;
}

export function clearBallMaterialCache() {
  BALL_MATERIAL_CACHE.clear();
  BALL_TEXTURE_CACHE.clear();
}
