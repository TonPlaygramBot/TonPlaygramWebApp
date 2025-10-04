import * as THREE from 'three';

const MATERIAL_CACHE = new Map();

function normalizeColor(input) {
  const color = new THREE.Color(input);
  return {
    color,
    hex: color.getHexString(),
    style: `#${color.getHexString()}`,
    luminance: color.getLuminance()
  };
}

function hashKey(str) {
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function addSurfaceNoise(ctx, size, seedKey) {
  const seed = hashKey(seedKey);
  const rand = mulberry32(seed || 1);
  const image = ctx.getImageData(0, 0, size, size);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (rand() - 0.5) * 12;
    data[i] = Math.max(0, Math.min(255, data[i] + noise));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise * 0.8));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise * 0.6));
  }
  ctx.putImageData(image, 0, 0);
}

function drawBallTexture({ color, pattern, number }) {
  const { style, luminance } = normalizeColor(color);
  const stripe = pattern === 'stripe';
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.fillStyle = stripe ? '#ffffff' : style;
  ctx.fillRect(0, 0, size, size);

  if (stripe) {
    const stripeHeight = size * 0.44;
    const stripeY = (size - stripeHeight) / 2;
    ctx.fillStyle = style;
    ctx.fillRect(0, stripeY, size, stripeHeight);

    const stripeEdge = ctx.createLinearGradient(0, stripeY, 0, stripeY + stripeHeight);
    stripeEdge.addColorStop(0, 'rgba(255,255,255,0.18)');
    stripeEdge.addColorStop(0.5, 'rgba(255,255,255,0)');
    stripeEdge.addColorStop(1, 'rgba(0,0,0,0.2)');
    ctx.fillStyle = stripeEdge;
    ctx.fillRect(0, stripeY - size * 0.015, size, stripeHeight + size * 0.03);
  }

  addSurfaceNoise(ctx, size, `${pattern}:${style}:${number ?? 'none'}`);

  const highlight = ctx.createRadialGradient(
    size * 0.32,
    size * 0.28,
    size * 0.1,
    size * 0.32,
    size * 0.28,
    size * 0.58
  );
  highlight.addColorStop(0, 'rgba(255,255,255,0.92)');
  highlight.addColorStop(0.45, 'rgba(255,255,255,0.35)');
  highlight.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = highlight;
  ctx.beginPath();
  ctx.arc(size * 0.32, size * 0.28, size * 0.58, 0, Math.PI * 2);
  ctx.fill();

  const shadow = ctx.createRadialGradient(
    size * 0.72,
    size * 0.74,
    size * 0.25,
    size * 0.72,
    size * 0.74,
    size * 0.78
  );
  shadow.addColorStop(0, 'rgba(0,0,0,0)');
  shadow.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.arc(size * 0.72, size * 0.74, size * 0.78, 0, Math.PI * 2);
  ctx.fill();

  const seam = ctx.createLinearGradient(0, size * 0.5 - size * 0.025, 0, size * 0.5 + size * 0.025);
  seam.addColorStop(0, 'rgba(255,255,255,0.12)');
  seam.addColorStop(0.5, 'rgba(0,0,0,0.2)');
  seam.addColorStop(1, 'rgba(255,255,255,0.12)');
  ctx.fillStyle = seam;
  ctx.fillRect(0, size * 0.5 - size * 0.025, size, size * 0.05);

  if (number != null) {
    const circleRadius = size * 0.18;
    ctx.beginPath();
    ctx.arc(size * 0.5, size * 0.55, circleRadius, 0, Math.PI * 2);
    ctx.fillStyle = stripe ? '#ffffff' : '#fefefe';
    ctx.fill();
    ctx.lineWidth = size * 0.02;
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.stroke();

    const textColor = number === 8 || luminance < 0.35 ? '#ffffff' : '#111111';
    ctx.fillStyle = textColor;
    ctx.font = `bold ${size * 0.26}px "Segoe UI", "Helvetica Neue", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(number), size * 0.5, size * 0.55 + size * 0.01);
  }

  return canvas;
}

export function getBallMaterial({ color, pattern = 'solid', number = null } = {}) {
  const { hex } = normalizeColor(color ?? 0xffffff);
  const key = `${pattern}:${hex}:${number ?? 'none'}`;
  if (MATERIAL_CACHE.has(key)) {
    return MATERIAL_CACHE.get(key);
  }
  const canvas = typeof document !== 'undefined'
    ? drawBallTexture({ color, pattern, number })
    : null;
  const texture = canvas
    ? new THREE.CanvasTexture(canvas)
    : null;
  if (texture) {
    texture.anisotropy = 16;
    texture.minFilter = THREE.LinearMipMapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    if ('colorSpace' in texture) texture.colorSpace = THREE.SRGBColorSpace;
    else texture.encoding = THREE.sRGBEncoding;
    texture.needsUpdate = true;
  }
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: texture || null,
    roughness: 0.18,
    metalness: 0.04,
    clearcoat: 1,
    clearcoatRoughness: 0.12
  });
  MATERIAL_CACHE.set(key, material);
  return material;
}
