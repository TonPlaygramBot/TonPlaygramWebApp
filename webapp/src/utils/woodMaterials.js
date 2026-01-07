import * as THREE from 'three';
import { applySRGBColorSpace } from './colorSpace.js';

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const normalizeHue = (h) => {
  let hue = h % 360;
  if (hue < 0) hue += 360;
  return hue;
};

const hslString = (h, s, l) => {
  const sat = clamp01(s);
  const light = clamp01(l);
  return `hsl(${normalizeHue(h)}, ${Math.round(sat * 100)}%, ${Math.round(light * 100)}%)`;
};

const TAU = Math.PI * 2;

const seededRandom = (seed) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

// Tileable low-frequency noise adapted from common open source texture recipes
// that blend cosine-wrapped components so the pattern loops cleanly when repeated.
const tileableNoise = (x, y, width, height, scale, seed = 1) => {
  const nx = Math.cos(((x * scale) / width) * TAU + seed * 1.3);
  const ny = Math.cos(((y * scale) / height) * TAU + seed * 2.1);
  const nxy = Math.cos((((x + y) * scale) / (width + height)) * TAU + seed * 3.7);
  return (nx + ny + nxy + 3) / 6; // normalize to [0,1]
};

const WOOD_TEXTURE_ANISOTROPY = 12;
let WOOD_ANISOTROPY_CAP = WOOD_TEXTURE_ANISOTROPY;

export const setWoodTextureAnisotropyCap = (value) => {
  if (!Number.isFinite(value) || value <= 0) return;
  WOOD_ANISOTROPY_CAP = Math.max(WOOD_TEXTURE_ANISOTROPY, value);
};

const woodTextureLoader = new THREE.TextureLoader();
woodTextureLoader.setCrossOrigin?.('anonymous');
const WOOD_EXTERNAL_TEXTURE_CACHE = new Map();

const normalizeExternalTexture = (texture, isColor = false, anisotropy = WOOD_TEXTURE_ANISOTROPY) => {
  if (!texture) return;
  if (isColor) {
    applySRGBColorSpace(texture);
  }
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  const targetAnisotropy = Math.max(
    texture.anisotropy ?? 1,
    anisotropy ?? WOOD_TEXTURE_ANISOTROPY,
    WOOD_ANISOTROPY_CAP || 1
  );
  texture.anisotropy = targetAnisotropy;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
};

const resolveExternalWoodTextureUrls = ({ mapUrl, roughnessMapUrl, normalMapUrl }) => {
  if (!mapUrl) return null;
  if (roughnessMapUrl || normalMapUrl) {
    return {
      color: mapUrl,
      roughness: roughnessMapUrl ?? null,
      normal: normalMapUrl ?? null
    };
  }
  const matchers = [
    { regex: /_(color|col)\.(jpg|jpeg|png)$/i, rough: '_Roughness', normal: '_NormalGL' },
    { regex: /_(diff|diffuse)\.(jpg|jpeg|png)$/i, rough: '_rough', normal: '_nor_gl' },
    { regex: /_basecolor\.(jpg|jpeg|png)$/i, rough: '_rough', normal: '_nor_gl' },
    { regex: /_albedo\.(jpg|jpeg|png)$/i, rough: '_rough', normal: '_nor_gl' }
  ];
  for (const { regex, rough, normal } of matchers) {
    const match = mapUrl.match(regex);
    if (match) {
      const extension = match[2] ?? match[1];
      const base = mapUrl.slice(0, match.index);
      return {
        color: mapUrl,
        roughness: `${base}${rough}.${extension}`,
        normal: `${base}${normal}.${extension}`
      };
    }
  }
  return { color: mapUrl };
};

const loadExternalTexture = (url, isColor, anisotropy, onError) => {
  const texture = woodTextureLoader.load(
    url,
    (loaded) => normalizeExternalTexture(loaded, isColor, anisotropy),
    undefined,
    (err) => {
      console.warn('Failed to load external wood texture', url, err);
      if (typeof onError === 'function') {
        onError(texture, err);
      }
    }
  );
  normalizeExternalTexture(texture, isColor, anisotropy);
  return texture;
};

const getExternalWoodTextures = (urls, anisotropy = 16, fallbacks = null) => {
  if (!urls?.mapUrl) return null;
  const cacheKey = [urls.mapUrl, urls.roughnessMapUrl, urls.normalMapUrl]
    .filter(Boolean)
    .join('|');
  const cached = WOOD_EXTERNAL_TEXTURE_CACHE.get(cacheKey);
  if (cached) return cached;
  const resolved = resolveExternalWoodTextureUrls(urls);
  if (!resolved?.color) return null;
  const normalizeFallback = (texture, isColor) => {
    if (!texture) return null;
    const clone = texture.clone ? texture.clone() : texture;
    clone.image = texture.image;
    normalizeExternalTexture(clone, isColor, anisotropy);
    return clone;
  };
  const fallbackMap = normalizeFallback(fallbacks?.map, true);
  const fallbackRoughness = normalizeFallback(fallbacks?.roughnessMap, false);
  const fallbackNormal = normalizeFallback(fallbacks?.normalMap, false);
  const entry = {
    map: loadExternalTexture(resolved.color, true, anisotropy, (texture) => {
      if (!fallbackMap) return;
      texture.image = fallbackMap.image;
      normalizeExternalTexture(texture, true, anisotropy);
      texture.needsUpdate = true;
    }),
    roughnessMap: resolved.roughness
      ? loadExternalTexture(resolved.roughness, false, anisotropy, (texture) => {
          if (!fallbackRoughness) return;
          texture.image = fallbackRoughness.image;
          normalizeExternalTexture(texture, false, anisotropy);
          texture.needsUpdate = true;
        })
      : fallbackRoughness,
    normalMap: resolved.normal
      ? loadExternalTexture(resolved.normal, false, anisotropy, (texture) => {
          if (!fallbackNormal) return;
          texture.image = fallbackNormal.image;
          normalizeExternalTexture(texture, false, anisotropy);
          texture.needsUpdate = true;
        })
      : fallbackNormal
  };
  WOOD_EXTERNAL_TEXTURE_CACHE.set(cacheKey, entry);
  return entry;
};

const makeSlabTexture = (width, height, hue, sat, light, contrast) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = hslString(hue, sat, light);
  ctx.fillRect(0, 0, width, height);

  // Add a soft diagonal falloff so the laminate reflects light more realistically.
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, 'rgba(255,255,255,0.08)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.08)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  const baseNoiseStrength = Math.max(0.04, contrast * 0.22);
  const grainStrength = 0.24 + contrast * 0.46;
  const knotCount = 8 + Math.floor(seededRandom(width + height) * 6);
  const knots = Array.from({ length: knotCount }, (_, idx) => {
    const r = 18 + seededRandom(idx + 11) * 48;
    return {
      cx: seededRandom(idx + 7) * width,
      cy: seededRandom(idx + 19) * height,
      radius: r,
      falloff: r * (1.6 + seededRandom(idx + 23) * 0.6)
    };
  });

  for (let i = 0; i < data.length; i += 4) {
    const pixelIndex = i / 4;
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);

    const baseNoise = (Math.random() - 0.5) * baseNoiseStrength;
    const wrappedNoise = tileableNoise(x, y, width, height, 2.8, contrast * 7.3);
    const ripple = tileableNoise(x * 1.4, y * 0.35 + wrappedNoise * 14, width, height, 1.4, 5.1);
    const ring = 0.5 + 0.5 * Math.sin((x / width) * TAU * 2.2 + ripple * 3.4);
    const grain = clamp01((ring * 0.65 + ripple * 0.35) * 1.08);

    let knotFactor = 0;
    for (let k = 0; k < knots.length; k += 1) {
      const { cx, cy, radius, falloff } = knots[k];
      const dx = Math.min(Math.abs(x - cx), width - Math.abs(x - cx));
      const dy = Math.min(Math.abs(y - cy), height - Math.abs(y - cy));
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < falloff) {
        const strength = clamp01(1 - dist / falloff);
        knotFactor = Math.max(knotFactor, strength * (dist < radius ? 1 : 0.35));
      }
    }

    const grainInfluence = (grain - 0.5 + baseNoise * 0.8) * grainStrength;
    const knotInfluence = knotFactor * (0.22 + contrast * 0.28);
    const finalInfluence = grainInfluence + knotInfluence;

    const adjust = clamp01((data[i] / 255 + finalInfluence));
    const gAdjust = clamp01((data[i + 1] / 255 + finalInfluence * 0.92));
    const bAdjust = clamp01((data[i + 2] / 255 + finalInfluence * 0.88));

    data[i] = adjust * 255;
    data[i + 1] = gAdjust * 255;
    data[i + 2] = bAdjust * 255;
  }

  ctx.putImageData(imageData, 0, 0);

  // Bold notches and filled grain pores layered above the base wood.
  ctx.globalAlpha = 0.12 + contrast * 0.18;
  ctx.fillStyle = 'rgba(48, 28, 10, 0.9)';
  for (let i = 0; i < 480; i += 1) {
    const size = 0.8 + Math.random() * 2.1;
    ctx.beginPath();
    ctx.ellipse(
      Math.random() * width,
      Math.random() * height,
      size * (0.8 + Math.random() * 1.6),
      size,
      Math.random() * TAU,
      0,
      TAU
    );
    ctx.fill();
  }

  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  applySRGBColorSpace(texture);
  texture.anisotropy = 16;
  return texture;
};

const makeRoughnessMap = (width, height, base, variance) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const value = base + (Math.random() - 0.5) * variance;
    const g = Math.max(0, Math.min(255, Math.floor(value * 255)));
    data[i] = g;
    data[i + 1] = g;
    data[i + 2] = g;
    data[i + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
  return new THREE.CanvasTexture(canvas);
};

const disposeWoodTextures = (material) => {
  if (!material) return;
  const textures = material.userData?.__woodTextures;
  if (textures) {
    const { map, roughnessMap, normalMap } = textures;
    if (map?.dispose) map.dispose();
    if (roughnessMap && roughnessMap !== map && roughnessMap.dispose) {
      roughnessMap.dispose();
    }
    if (normalMap && normalMap !== map && normalMap.dispose) {
      normalMap.dispose();
    }
    delete material.userData.__woodTextures;
  }
  if (material.map?.dispose) {
    material.map.dispose();
  }
  if (material.roughnessMap && material.roughnessMap !== material.map && material.roughnessMap.dispose) {
    material.roughnessMap.dispose();
  }
  if (material.normalMap && material.normalMap !== material.map && material.normalMap.dispose) {
    material.normalMap.dispose();
  }
  material.map = null;
  material.roughnessMap = null;
  material.normalMap = null;
};

export const WOOD_FINISH_PRESETS = Object.freeze([
  Object.freeze({ id: 'birch', label: 'Birch', hue: 38, sat: 0.25, light: 0.84, contrast: 0.42 }),
  Object.freeze({ id: 'maple', label: 'Maple', hue: 35, sat: 0.22, light: 0.78, contrast: 0.44 }),
  Object.freeze({ id: 'oak', label: 'Oak', hue: 32, sat: 0.34, light: 0.7, contrast: 0.52 }),
  Object.freeze({ id: 'cherry', label: 'Cherry', hue: 14, sat: 0.42, light: 0.6, contrast: 0.58 }),
  Object.freeze({ id: 'teak', label: 'Teak', hue: 28, sat: 0.4, light: 0.52, contrast: 0.6 }),
  Object.freeze({ id: 'walnut', label: 'Walnut', hue: 22, sat: 0.4, light: 0.44, contrast: 0.64 }),
  Object.freeze({ id: 'smokedOak', label: 'Smoked Oak', hue: 28, sat: 0.35, light: 0.28, contrast: 0.75 }),
  Object.freeze({ id: 'wenge', label: 'Wenge', hue: 24, sat: 0.38, light: 0.22, contrast: 0.8 }),
  Object.freeze({ id: 'ebony', label: 'Ebony', hue: 25, sat: 0.35, light: 0.18, contrast: 0.85 })
]);

// Stretch large, seamless slabs along the rail direction so the table reads as a single board
// with no visible tiling seams.
const LARGE_SLAB_REPEAT_X = 0.009;
const FRAME_SLAB_REPEAT_X = LARGE_SLAB_REPEAT_X * 1.18;
const POLYHAVEN_ASSET_ALIASES = {
  rosewood_veneer_01: 'rosewood_veneer1'
};

const polyHavenTextureSet = (assetId) => {
  const resolvedId = POLYHAVEN_ASSET_ALIASES[assetId] ?? assetId;
  const base = `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/4k/${resolvedId}/${resolvedId}`;
  return {
    mapUrl: `${base}_diff_4k.jpg`,
    roughnessMapUrl: `${base}_rough_4k.jpg`,
    normalMapUrl: `${base}_nor_gl_4k.jpg`
  };
};

export const WOOD_GRAIN_OPTIONS = Object.freeze([
  Object.freeze({
    id: 'acg_walnut_quarter',
    label: 'Walnut Quarter-Sawn',
    source: 'ambientCG — WalnutQuarter 002 (CC0)',
    rail: {
      repeat: { x: LARGE_SLAB_REPEAT_X, y: 0.92 },
      rotation: 0,
      textureSize: 4096
    },
    frame: {
      repeat: { x: FRAME_SLAB_REPEAT_X, y: 0.9 },
      rotation: 0,
      textureSize: 4096
    }
  }),
  Object.freeze({
    id: 'acg_birch_studio',
    label: 'Birch Studio Slab',
    source: 'ambientCG — Birch Planks 003 (CC0)',
    rail: {
      repeat: { x: LARGE_SLAB_REPEAT_X * 0.92, y: 0.96 },
      rotation: 0,
      textureSize: 4096
    },
    frame: {
      repeat: { x: FRAME_SLAB_REPEAT_X * 0.92, y: 0.9 },
      rotation: 0,
      textureSize: 4096
    }
  }),
  Object.freeze({
    id: 'wood_peeling_paint_weathered',
    label: 'Wood Peeling Paint Weathered',
    source: 'Poly Haven — Wood Peeling Paint Weathered (CC0)',
    rail: {
      repeat: { x: 1, y: 1 },
      rotation: 0,
      textureSize: 4096,
      ...polyHavenTextureSet('wood_peeling_paint_weathered')
    },
    frame: {
      repeat: { x: 1, y: 1 },
      rotation: 0,
      textureSize: 4096,
      ...polyHavenTextureSet('wood_peeling_paint_weathered')
    }
  }),
  Object.freeze({
    id: 'oak_veneer_01',
    label: 'Oak Veneer 01',
    source: 'Poly Haven — Oak Veneer 01 (CC0)',
    rail: {
      repeat: { x: 1, y: 1 },
      rotation: 0,
      textureSize: 4096,
      ...polyHavenTextureSet('oak_veneer_01')
    },
    frame: {
      repeat: { x: 1, y: 1 },
      rotation: 0,
      textureSize: 4096,
      ...polyHavenTextureSet('oak_veneer_01')
    }
  }),
  Object.freeze({
    id: 'wood_table_001',
    label: 'Wood Table 001',
    source: 'Poly Haven — Wood Table 001 (CC0)',
    rail: {
      repeat: { x: 1, y: 1 },
      rotation: 0,
      textureSize: 4096,
      ...polyHavenTextureSet('wood_table_001')
    },
    frame: {
      repeat: { x: 1, y: 1 },
      rotation: 0,
      textureSize: 4096,
      ...polyHavenTextureSet('wood_table_001')
    }
  }),
  Object.freeze({
    id: 'dark_wood',
    label: 'Dark Wood',
    source: 'Poly Haven — Dark Wood (CC0)',
    rail: {
      repeat: { x: 1, y: 1 },
      rotation: 0,
      textureSize: 4096,
      ...polyHavenTextureSet('dark_wood')
    },
    frame: {
      repeat: { x: 1, y: 1 },
      rotation: 0,
      textureSize: 4096,
      ...polyHavenTextureSet('dark_wood')
    }
  }),
  Object.freeze({
    id: 'rosewood_veneer_01',
    label: 'Rosewood Veneer 01',
    source: 'Poly Haven — Rosewood Veneer 01 (CC0)',
    rail: {
      repeat: { x: 0.7, y: 0.7 }, // enlarge the veneer grain for the rails
      rotation: 0,
      textureSize: 4096,
      ...polyHavenTextureSet('rosewood_veneer_01')
    },
    frame: {
      repeat: { x: 0.72, y: 0.72 }, // slightly finer than rails to balance the border scale
      rotation: 0,
      textureSize: 4096,
      ...polyHavenTextureSet('rosewood_veneer_01')
    }
  }),
  Object.freeze({
    id: 'kitchen_wood',
    label: 'Kitchen Wood',
    source: 'Poly Haven — Kitchen Wood (CC0)',
    rail: {
      repeat: { x: 1, y: 1 },
      rotation: 0,
      textureSize: 4096,
      ...polyHavenTextureSet('kitchen_wood')
    },
    frame: {
      repeat: { x: 1, y: 1 },
      rotation: 0,
      textureSize: 4096,
      ...polyHavenTextureSet('kitchen_wood')
    }
  }),
  Object.freeze({
    id: 'japanese_sycamore',
    label: 'Japanese Sycamore',
    source: 'Poly Haven — Japanese Sycamore (CC0)',
    rail: {
      repeat: { x: 1, y: 1 },
      rotation: 0,
      textureSize: 4096,
      ...polyHavenTextureSet('japanese_sycamore')
    },
    frame: {
      repeat: { x: 1, y: 1 },
      rotation: 0,
      textureSize: 4096,
      ...polyHavenTextureSet('japanese_sycamore')
    }
  })
]);

export const DEFAULT_WOOD_GRAIN_ID = WOOD_GRAIN_OPTIONS[0].id;

export const WOOD_GRAIN_OPTIONS_BY_ID = Object.freeze(
  WOOD_GRAIN_OPTIONS.reduce((acc, option) => {
    acc[option.id] = option;
    return acc;
  }, {})
);

export const DEFAULT_WOOD_TEXTURE_SIZE = 1024;
export const DEFAULT_WOOD_ROUGHNESS_SIZE = 512;

export const shiftLightness = (light, delta) => clamp01(light + delta);
export const shiftSaturation = (sat, delta) => clamp01(sat + delta);

export const hslToHexNumber = (h, s, l) => {
  const color = new THREE.Color();
  color.setHSL(normalizeHue(h) / 360, clamp01(s), clamp01(l));
  return color.getHex();
};

const makeCacheKey = ({
  hue,
  sat,
  light,
  contrast,
  textureSize,
  roughnessSize,
  roughnessBase,
  roughnessVariance,
  sharedKey
}) =>
  [
    sharedKey,
    hue,
    sat,
    light,
    contrast,
    textureSize,
    roughnessSize,
    roughnessBase,
    roughnessVariance
  ]
    .map((value) =>
      typeof value === 'number' ? Number.parseFloat(value).toFixed(6) : String(value ?? '')
    )
    .join('|');

const WOOD_TEXTURE_BASE_CACHE = new Map();

const ensureSharedWoodTextures = ({
  hue,
  sat,
  light,
  contrast,
  textureSize,
  roughnessSize,
  roughnessBase,
  roughnessVariance,
  sharedKey
}) => {
  const cacheKey = makeCacheKey({
    hue,
    sat,
    light,
    contrast,
    textureSize,
    roughnessSize,
    roughnessBase,
    roughnessVariance,
    sharedKey
  });
  let entry = WOOD_TEXTURE_BASE_CACHE.get(cacheKey);
  if (!entry) {
    const map = makeSlabTexture(textureSize, textureSize, hue, sat, light, contrast);
    const roughnessMap = makeRoughnessMap(
      roughnessSize,
      roughnessSize,
      roughnessBase,
      roughnessVariance
    );
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
    map.center.set(0.5, 0.5);
    roughnessMap.center.set(0.5, 0.5);
    map.needsUpdate = true;
    roughnessMap.needsUpdate = true;
    entry = { map, roughnessMap };
    WOOD_TEXTURE_BASE_CACHE.set(cacheKey, entry);
  }
  return entry;
};

const cloneWoodTexture = (texture, repeat, rotation) => {
  if (!texture) return null;
  const clone = texture.clone();
  if (repeat) {
    clone.repeat.set(repeat.x ?? 1, repeat.y ?? 1);
  }
  clone.center.set(0.5, 0.5);
  if (typeof rotation === 'number' && rotation !== 0) {
    clone.rotation = rotation;
  }
  clone.needsUpdate = true;
  return clone;
};

const boostWoodTextureSampling = (texture, { isColor = false } = {}) => {
  if (!texture) return;
  if (isColor) {
    applySRGBColorSpace(texture);
  }
  texture.anisotropy = Math.max(texture.anisotropy ?? 1, WOOD_TEXTURE_ANISOTROPY);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
};

export const applyWoodTextures = (
  material,
  {
    hue,
    sat,
    light,
    contrast,
    mapUrl,
    roughnessMapUrl,
    normalMapUrl,
    repeat = { x: 1, y: 1 },
    rotation = 0,
    textureSize = DEFAULT_WOOD_TEXTURE_SIZE,
    roughnessSize = DEFAULT_WOOD_ROUGHNESS_SIZE,
    roughnessBase = 0.18,
    roughnessVariance = 0.25,
    sharedKey = null
  } = {}
) => {
  if (!material) return null;
  disposeWoodTextures(material);
  const fallbackTextures = {
    map: makeSlabTexture(textureSize, textureSize, hue, sat, light, contrast),
    roughnessMap: makeRoughnessMap(
      roughnessSize,
      roughnessSize,
      roughnessBase,
      roughnessVariance
    ),
    normalMap: null
  };
  let baseTextures = null;
  if (mapUrl) {
    const external = getExternalWoodTextures(
      { mapUrl, roughnessMapUrl, normalMapUrl },
      16,
      fallbackTextures
    );
    baseTextures = {
      map: external?.map ?? fallbackTextures.map,
      roughnessMap: external?.roughnessMap ?? fallbackTextures.roughnessMap,
      normalMap: external?.normalMap ?? fallbackTextures.normalMap
    };
  } else if (sharedKey) {
    baseTextures = ensureSharedWoodTextures({
      hue,
      sat,
      light,
      contrast,
      textureSize,
      roughnessSize,
      roughnessBase,
      roughnessVariance,
      sharedKey
    });
  } else {
    baseTextures = fallbackTextures;
  }
  const repeatVec = new THREE.Vector2(repeat?.x ?? 1, repeat?.y ?? 1);
  const map = cloneWoodTexture(baseTextures.map, repeatVec, rotation);
  const roughnessMap = cloneWoodTexture(baseTextures.roughnessMap, repeatVec, rotation);
  const normalMap = cloneWoodTexture(baseTextures.normalMap, repeatVec, rotation);
  if (map) {
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    boostWoodTextureSampling(map, { isColor: true });
  }
  if (roughnessMap) {
    roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
    boostWoodTextureSampling(roughnessMap);
  }
  if (normalMap) {
    normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
    boostWoodTextureSampling(normalMap);
  }
  material.map = map;
  material.roughnessMap = roughnessMap;
  material.normalMap = normalMap;
  material.color.setHex(0xffffff);
  material.needsUpdate = true;
  if (material.map) material.map.needsUpdate = true;
  if (material.roughnessMap) material.roughnessMap.needsUpdate = true;
  if (material.normalMap) material.normalMap.needsUpdate = true;
  material.userData = material.userData || {};
  material.userData.__woodTextures = { map, roughnessMap, normalMap };
  material.userData.__woodOptions = {
    hue,
    sat,
    light,
    contrast,
    mapUrl,
    roughnessMapUrl,
    normalMapUrl,
    repeat: { x: repeatVec.x, y: repeatVec.y },
    rotation,
    textureSize,
    roughnessSize,
    roughnessBase,
    roughnessVariance,
    sharedKey
  };
  material.userData.woodRepeat = new THREE.Vector2(repeatVec.x, repeatVec.y);
  return { map, roughnessMap };
};

export const createWoodMaterial = ({
  hue,
  sat,
  light,
  contrast,
  repeat,
  rotation = 0,
  textureSize = DEFAULT_WOOD_TEXTURE_SIZE,
  roughnessSize = DEFAULT_WOOD_ROUGHNESS_SIZE,
  roughnessBase = 0.18,
  roughnessVariance = 0.25,
  sharedKey = null,
  ...materialProps
} = {}) => {
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    ...materialProps
  });
  applyWoodTextures(material, {
    hue,
    sat,
    light,
    contrast,
    repeat,
    rotation,
    textureSize,
    roughnessSize,
    roughnessBase,
    roughnessVariance,
    sharedKey
  });
  return material;
};

export const disposeMaterialWithWood = (material) => {
  if (!material) return;
  disposeWoodTextures(material);
  if (material.dispose) {
    material.dispose();
  }
};
