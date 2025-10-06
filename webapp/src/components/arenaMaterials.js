import * as THREE from 'three';

export const ARENA_COLORS = Object.freeze({
  floor: 0x0f1222,
  carpet: 0xb01224,
  wall: 0xeeeeee,
  wallRoughness: 0.88,
  wallMetalness: 0.06,
  trim: 0x1a233f,
  led: 0x00f7ff,
  ledEmissive: 0x0099aa,
  hemisphereSky: 0xffffff,
  hemisphereGround: 0x1a1f2b,
  hemisphereIntensity: 0.95
});

let cachedCarpetTextures = null;

export function createCarpetTextures() {
  if (cachedCarpetTextures) return cachedCarpetTextures;
  if (typeof document === 'undefined') {
    cachedCarpetTextures = { map: null, bump: null };
    return cachedCarpetTextures;
  }

  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const prng = (seed) => {
    let value = seed;
    return () => {
      value = (value * 1664525 + 1013904223) % 4294967296;
      return value / 4294967296;
    };
  };

  const drawRoundedRect = (ctx, x, y, w, h, r) => {
    const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  };

  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#7a0a18');
  gradient.addColorStop(1, '#5e0913');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const rand = prng(987654321);
  const image = ctx.getImageData(0, 0, size, size);
  const data = image.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const fiber =
        (Math.sin((x / size) * Math.PI * 18) + Math.cos((y / size) * Math.PI * 22)) *
        0.12;
      const grain = (rand() - 0.5) * 0.22;
      const shade = clamp01(0.96 + fiber + grain);
      data[idx] = clamp01((data[idx] / 255) * shade) * 255;
      data[idx + 1] = clamp01((data[idx + 1] / 255) * (0.98 + grain * 0.35)) * 255;
      data[idx + 2] = clamp01((data[idx + 2] / 255) * (0.95 + grain * 0.2)) * 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  ctx.globalAlpha = 0.05;
  ctx.fillStyle = '#000000';
  for (let row = 0; row < size; row += 3) {
    ctx.fillRect(0, row, size, 1);
  }
  ctx.globalAlpha = 1;

  const insetRatio = 0.055;
  const stripeInset = size * insetRatio;
  const stripeRadius = size * 0.08;
  const stripeWidth = size * 0.012;
  ctx.lineWidth = stripeWidth;
  ctx.strokeStyle = '#d4af37';
  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = stripeWidth * 0.8;
  drawRoundedRect(
    ctx,
    stripeInset,
    stripeInset,
    size - stripeInset * 2,
    size - stripeInset * 2,
    stripeRadius
  );
  ctx.stroke();
  ctx.shadowBlur = 0;

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 8;
  texture.minFilter = THREE.LinearMipMapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  if ('colorSpace' in texture) texture.colorSpace = THREE.SRGBColorSpace;
  else texture.encoding = THREE.sRGBEncoding;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = bumpCanvas.height = size;
  const bumpCtx = bumpCanvas.getContext('2d');
  bumpCtx.drawImage(canvas, 0, 0);
  const bumpImage = bumpCtx.getImageData(0, 0, size, size);
  const bumpData = bumpImage.data;
  for (let i = 0; i < bumpData.length; i += 4) {
    const avg = (bumpData[i] + bumpData[i + 1] + bumpData[i + 2]) / 3;
    const noise = (rand() - 0.5) * 32;
    const value = clamp01((avg + noise) / 255) * 255;
    bumpData[i] = bumpData[i + 1] = bumpData[i + 2] = value;
  }
  bumpCtx.putImageData(bumpImage, 0, 0);

  const bumpTexture = new THREE.CanvasTexture(bumpCanvas);
  bumpTexture.wrapS = bumpTexture.wrapT = THREE.ClampToEdgeWrapping;
  bumpTexture.minFilter = THREE.LinearMipMapLinearFilter;
  bumpTexture.magFilter = THREE.LinearFilter;
  bumpTexture.generateMipmaps = true;
  if ('colorSpace' in bumpTexture) bumpTexture.colorSpace = THREE.SRGBColorSpace;
  else bumpTexture.encoding = THREE.sRGBEncoding;

  cachedCarpetTextures = { map: texture, bump: bumpTexture };
  return cachedCarpetTextures;
}
