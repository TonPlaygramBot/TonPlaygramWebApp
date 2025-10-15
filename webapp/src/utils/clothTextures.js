import * as THREE from 'three';
import { applySRGBColorSpace } from './colorSpace.js';

const CLOTH_TEXTURE_SIZE = 4096;
const CLOTH_THREAD_PITCH = 12 * 0.8;
export const CLOTH_THREADS_PER_TILE = CLOTH_TEXTURE_SIZE / CLOTH_THREAD_PITCH;

const CLOTH_TEXTURE_INTENSITY = 0.48;
const CLOTH_BUMP_INTENSITY = 0.42;
const CLOTH_SOFT_BLEND = 0.52;
const CLOTH_HAIR_INTENSITY = 0.26;

const clamp255 = (value) => Math.max(0, Math.min(255, value));

let baseCache = null;

export function getPoolClothDetailTextures() {
  if (baseCache) {
    return baseCache;
  }
  if (typeof document === 'undefined') {
    baseCache = { map: null, bump: null };
    return baseCache;
  }

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = CLOTH_TEXTURE_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    baseCache = { map: null, bump: null };
    return baseCache;
  }

  const image = ctx.createImageData(CLOTH_TEXTURE_SIZE, CLOTH_TEXTURE_SIZE);
  const data = image.data;

  const SIZE = CLOTH_TEXTURE_SIZE;
  const THREAD_PITCH = CLOTH_THREAD_PITCH;
  const DIAG = Math.PI / 4;
  const COS = Math.cos(DIAG);
  const SIN = Math.sin(DIAG);
  const TAU = Math.PI * 2;

  const shadow = { r: 0x1a, g: 0x64, b: 0x39 };
  const base = { r: 0x2f, g: 0x97, b: 0x53 };
  const accent = { r: 0x41, g: 0xb4, b: 0x67 };
  const highlight = { r: 0x62, g: 0xd8, b: 0x8b };

  const hashNoise = (x, y, seedX, seedY, phase = 0) =>
    Math.sin((x * seedX + y * seedY + phase) * 0.02454369260617026) * 0.5 + 0.5;
  const fiberNoise = (x, y) =>
    hashNoise(x, y, 12.9898, 78.233, 1.5) * 0.7 +
    hashNoise(x, y, 32.654, 23.147, 15.73) * 0.2 +
    hashNoise(x, y, 63.726, 12.193, -9.21) * 0.1;
  const microNoise = (x, y) =>
    hashNoise(x, y, 41.12, 27.43, -4.5) * 0.5 +
    hashNoise(x, y, 19.71, 55.83, 23.91) * 0.5;
  const sparkleNoise = (x, y) =>
    hashNoise(x, y, 73.19, 11.17, 7.2) * 0.45 +
    hashNoise(x, y, 27.73, 61.91, -14.4) * 0.55;
  const strayWispNoise = (x, y) =>
    hashNoise(x, y, 91.27, 7.51, 3.3) * 0.6 +
    hashNoise(x, y, 14.91, 83.11, -5.7) * 0.4;
  const hairFiber = (x, y) => {
    const tuftSeed = hashNoise(x, y, 67.41, 3.73, -11.9);
    const straySeed = strayWispNoise(x + 13.7, y - 21.4);
    const dir = hashNoise(x, y, 5.19, 14.73, 8.2) * TAU;
    const wiggle = hashNoise(x, y, 51.11, 33.07, -6.9) * 2.5;
    const along = Math.sin((x * Math.cos(dir) + y * Math.sin(dir)) * 0.042 + wiggle);
    const tuft = Math.pow(tuftSeed, 3.8);
    const stray = Math.pow(straySeed, 2.4);
    const filament = Math.pow(Math.abs(along), 1.6);
    const wisp = Math.pow(strayWispNoise(x * 0.82 - y * 0.63, y * 0.74 + x * 0.18), 4.2);
    return THREE.MathUtils.clamp(tuft * 0.55 + stray * 0.25 + filament * 0.3 + wisp * 0.2, 0, 1);
  };

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = ((x * COS + y * SIN) / THREAD_PITCH) * TAU;
      const v = ((x * COS - y * SIN) / THREAD_PITCH) * TAU;
      const warp = 0.5 + 0.5 * Math.cos(u);
      const weft = 0.5 + 0.5 * Math.cos(v);
      const weave = Math.pow((warp + weft) * 0.5, 1.68);
      const cross = Math.pow(warp * weft, 0.9);
      const diamond = Math.pow(Math.abs(Math.sin(u) * Math.sin(v)), 0.6);
      const fiber = fiberNoise(x, y);
      const micro = microNoise(x + 31.8, y + 17.3);
      const sparkle = sparkleNoise(x * 0.6 + 11.8, y * 0.7 - 4.1);
      const fuzz = Math.pow(fiber, 1.2);
      const hair = hairFiber(x, y);
      const tonal = THREE.MathUtils.clamp(
        0.56 +
          (weave - 0.5) * 0.6 * CLOTH_TEXTURE_INTENSITY +
          (cross - 0.5) * 0.48 * CLOTH_TEXTURE_INTENSITY +
          (diamond - 0.5) * 0.54 * CLOTH_TEXTURE_INTENSITY +
          (fiber - 0.5) * 0.32 * CLOTH_TEXTURE_INTENSITY +
          (fuzz - 0.5) * 0.24 * CLOTH_TEXTURE_INTENSITY +
          (micro - 0.5) * 0.18 * CLOTH_TEXTURE_INTENSITY +
          (hair - 0.5) * 0.3 * CLOTH_HAIR_INTENSITY,
        0,
        1
      );
      const tonalEnhanced = THREE.MathUtils.clamp(
        0.5 +
          (tonal - 0.5) * (1 + (1.56 - 1) * CLOTH_TEXTURE_INTENSITY) +
          (hair - 0.5) * 0.16 * CLOTH_HAIR_INTENSITY,
        0,
        1
      );
      const highlightMix = THREE.MathUtils.clamp(
        0.34 +
          (cross - 0.5) * 0.44 * CLOTH_TEXTURE_INTENSITY +
          (diamond - 0.5) * 0.66 * CLOTH_TEXTURE_INTENSITY +
          (sparkle - 0.5) * 0.38 * CLOTH_TEXTURE_INTENSITY +
          (hair - 0.5) * 0.22 * CLOTH_HAIR_INTENSITY,
        0,
        1
      );
      const accentMix = THREE.MathUtils.clamp(
        0.48 +
          (diamond - 0.5) * 1.12 * CLOTH_TEXTURE_INTENSITY +
          (fuzz - 0.5) * 0.3 * CLOTH_TEXTURE_INTENSITY +
          (hair - 0.5) * 0.26 * CLOTH_HAIR_INTENSITY,
        0,
        1
      );
      const highlightEnhanced = THREE.MathUtils.clamp(
        0.38 +
          (highlightMix - 0.5) * (1 + (1.68 - 1) * CLOTH_TEXTURE_INTENSITY) +
          (hair - 0.5) * 0.18 * CLOTH_HAIR_INTENSITY,
        0,
        1
      );
      const baseR = shadow.r + (base.r - shadow.r) * tonalEnhanced;
      const baseG = shadow.g + (base.g - shadow.g) * tonalEnhanced;
      const baseB = shadow.b + (base.b - shadow.b) * tonalEnhanced;
      const accentR = baseR + (accent.r - baseR) * accentMix;
      const accentG = baseG + (accent.g - baseG) * accentMix;
      const accentB = baseB + (accent.b - baseB) * accentMix;
      const r = accentR + (highlight.r - accentR) * highlightEnhanced;
      const g = accentG + (highlight.g - accentG) * highlightEnhanced;
      const b = accentB + (highlight.b - accentB) * highlightEnhanced;
      const softR = baseR + (r - baseR) * CLOTH_SOFT_BLEND;
      const softG = baseG + (g - baseG) * CLOTH_SOFT_BLEND;
      const softB = baseB + (b - baseB) * CLOTH_SOFT_BLEND;
      const i = (y * SIZE + x) * 4;
      data[i + 0] = clamp255(softR);
      data[i + 1] = clamp255(softG);
      data[i + 2] = clamp255(softB);
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  const colorMap = new THREE.CanvasTexture(canvas);
  colorMap.wrapS = colorMap.wrapT = THREE.RepeatWrapping;
  colorMap.repeat.set(16, 64);
  colorMap.anisotropy = 64;
  colorMap.generateMipmaps = true;
  colorMap.minFilter = THREE.LinearMipmapLinearFilter;
  colorMap.magFilter = THREE.LinearFilter;
  applySRGBColorSpace(colorMap);
  colorMap.needsUpdate = true;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = bumpCanvas.height = SIZE;
  const bumpCtx = bumpCanvas.getContext('2d');
  if (!bumpCtx) {
    baseCache = { map: colorMap, bump: null };
    return baseCache;
  }
  const bumpImage = bumpCtx.createImageData(SIZE, SIZE);
  const bumpData = bumpImage.data;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = ((x * COS + y * SIN) / THREAD_PITCH) * TAU;
      const v = ((x * COS - y * SIN) / THREAD_PITCH) * TAU;
      const warp = 0.5 + 0.5 * Math.cos(u);
      const weft = 0.5 + 0.5 * Math.cos(v);
      const weave = Math.pow((warp + weft) * 0.5, 1.58);
      const cross = Math.pow(warp * weft, 0.94);
      const diamond = Math.pow(Math.abs(Math.sin(u) * Math.sin(v)), 0.68);
      const fiber = fiberNoise(x, y);
      const micro = microNoise(x + 31.8, y + 17.3);
      const fuzz = Math.pow(fiber, 1.22);
      const hair = hairFiber(x, y);
      const bump = THREE.MathUtils.clamp(
        0.56 +
          (weave - 0.5) * 0.9 * CLOTH_BUMP_INTENSITY +
          (cross - 0.5) * 0.46 * CLOTH_BUMP_INTENSITY +
          (diamond - 0.5) * 0.58 * CLOTH_BUMP_INTENSITY +
          (fiber - 0.5) * 0.36 * CLOTH_BUMP_INTENSITY +
          (fuzz - 0.5) * 0.24 * CLOTH_BUMP_INTENSITY +
          (micro - 0.5) * 0.26 * CLOTH_BUMP_INTENSITY +
          (hair - 0.5) * 0.4 * CLOTH_HAIR_INTENSITY,
        0,
        1
      );
      const value = clamp255(140 + (bump - 0.5) * 180 + (hair - 0.5) * 36);
      const i = (y * SIZE + x) * 4;
      bumpData[i + 0] = value;
      bumpData[i + 1] = value;
      bumpData[i + 2] = value;
      bumpData[i + 3] = 255;
    }
  }
  bumpCtx.putImageData(bumpImage, 0, 0);

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.copy(colorMap.repeat);
  bumpMap.anisotropy = colorMap.anisotropy;
  bumpMap.generateMipmaps = true;
  bumpMap.minFilter = THREE.LinearMipmapLinearFilter;
  bumpMap.magFilter = THREE.LinearFilter;

  baseCache = { map: colorMap, bump: bumpMap };
  return baseCache;
}

const tintedCache = new Map();

function mixColorChannel(a, b, t) {
  return a + (b - a) * t;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

export function getMurlanClothTextures(feltTop, feltBottom) {
  const key = `${feltTop}|${feltBottom}`;
  const cached = tintedCache.get(key);
  if (cached) {
    return cached;
  }
  if (typeof document === 'undefined') {
    const fallback = { map: null, bump: null };
    tintedCache.set(key, fallback);
    return fallback;
  }

  const baseTextures = getPoolClothDetailTextures();
  const baseCanvas = baseTextures.map?.image;
  if (!baseCanvas) {
    const fallback = {
      map: null,
      bump: baseTextures.bump ? baseTextures.bump.clone() : null
    };
    tintedCache.set(key, fallback);
    return fallback;
  }

  const baseCtx = baseCanvas.getContext('2d', { willReadFrequently: true });
  if (!baseCtx) {
    const fallback = {
      map: null,
      bump: baseTextures.bump ? baseTextures.bump.clone() : null
    };
    tintedCache.set(key, fallback);
    return fallback;
  }

  const width = baseCanvas.width;
  const height = baseCanvas.height;
  const baseData = baseCtx.getImageData(0, 0, width, height).data;

  const topColor = new THREE.Color(feltTop);
  const bottomColor = new THREE.Color(feltBottom);

  const topAccent = topColor.clone().lerp(new THREE.Color('#ffffff'), 0.16);
  const bottomAccent = bottomColor.clone().lerp(new THREE.Color('#ffffff'), 0.12);
  const topHighlight = topColor.clone().lerp(new THREE.Color('#ffffff'), 0.32);
  const bottomHighlight = bottomColor.clone().lerp(new THREE.Color('#ffffff'), 0.28);
  const topShadow = topColor.clone().lerp(new THREE.Color('#000000'), 0.22);
  const bottomShadow = bottomColor.clone().lerp(new THREE.Color('#000000'), 0.28);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const fallback = {
      map: null,
      bump: baseTextures.bump ? baseTextures.bump.clone() : null
    };
    tintedCache.set(key, fallback);
    return fallback;
  }

  const image = ctx.createImageData(width, height);
  const data = image.data;

  for (let y = 0; y < height; y++) {
    const v = height > 1 ? 1 - y / (height - 1) : 0;
    const baseR = mixColorChannel(bottomColor.r, topColor.r, v);
    const baseG = mixColorChannel(bottomColor.g, topColor.g, v);
    const baseB = mixColorChannel(bottomColor.b, topColor.b, v);

    const accentR = mixColorChannel(bottomAccent.r, topAccent.r, v);
    const accentG = mixColorChannel(bottomAccent.g, topAccent.g, v);
    const accentB = mixColorChannel(bottomAccent.b, topAccent.b, v);

    const highlightR = mixColorChannel(bottomHighlight.r, topHighlight.r, v);
    const highlightG = mixColorChannel(bottomHighlight.g, topHighlight.g, v);
    const highlightB = mixColorChannel(bottomHighlight.b, topHighlight.b, v);

    const shadowR = mixColorChannel(bottomShadow.r, topShadow.r, v);
    const shadowG = mixColorChannel(bottomShadow.g, topShadow.g, v);
    const shadowB = mixColorChannel(bottomShadow.b, topShadow.b, v);

    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const srcR = baseData[i + 0];
      const srcG = baseData[i + 1];
      const srcB = baseData[i + 2];
      const brightness = (srcR + srcG + srcB) / (255 * 3);
      const micro = (srcG - srcB) / 255;
      const tonal = clamp01(0.62 + (brightness - 0.5) * 1.12 + micro * 0.12);
      const accentMix = clamp01(0.48 + (brightness - 0.5) * 1.1 + micro * 0.18);
      const highlightMix = clamp01(0.36 + (brightness - 0.5) * 1.24 + micro * 0.16);

      const tonalR = clamp01(shadowR + (baseR - shadowR) * tonal);
      const tonalG = clamp01(shadowG + (baseG - shadowG) * tonal);
      const tonalB = clamp01(shadowB + (baseB - shadowB) * tonal);

      const accentMixR = tonalR + (accentR - tonalR) * accentMix;
      const accentMixG = tonalG + (accentG - tonalG) * accentMix;
      const accentMixB = tonalB + (accentB - tonalB) * accentMix;

      const finalR = clamp01(accentMixR + (highlightR - accentMixR) * highlightMix);
      const finalG = clamp01(accentMixG + (highlightG - accentMixG) * highlightMix);
      const finalB = clamp01(accentMixB + (highlightB - accentMixB) * highlightMix);

      data[i + 0] = clamp255(finalR * 255);
      data[i + 1] = clamp255(finalG * 255);
      data[i + 2] = clamp255(finalB * 255);
      data[i + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(8, 8);
  map.anisotropy = 32;
  map.generateMipmaps = true;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.magFilter = THREE.LinearFilter;
  applySRGBColorSpace(map);
  map.needsUpdate = true;

  let bump = null;
  if (baseTextures.bump) {
    bump = baseTextures.bump.clone();
    bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
    bump.repeat.set(8, 8);
    bump.anisotropy = map.anisotropy;
    bump.generateMipmaps = true;
    bump.minFilter = THREE.LinearMipmapLinearFilter;
    bump.magFilter = THREE.LinearFilter;
    bump.needsUpdate = true;
  }

  const result = { map, bump };
  tintedCache.set(key, result);
  return result;
}
