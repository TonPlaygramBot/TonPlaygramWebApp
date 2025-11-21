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

const woodTextureLoader = new THREE.TextureLoader();

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
    const { map, roughnessMap } = textures;
    if (map?.dispose) map.dispose();
    if (roughnessMap && roughnessMap !== map && roughnessMap.dispose) {
      roughnessMap.dispose();
    }
    delete material.userData.__woodTextures;
  }
  if (material.map?.dispose) {
    material.map.dispose();
  }
  if (material.roughnessMap && material.roughnessMap !== material.map && material.roughnessMap.dispose) {
    material.roughnessMap.dispose();
  }
  material.map = null;
  material.roughnessMap = null;
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

export const WOOD_GRAIN_OPTIONS = Object.freeze([
  Object.freeze({
    id: 'frameRusticSplit',
    label: 'Rustic Split Planks',
    source: 'Frame #3 cracked timber',
    rail: {
      mapUrl:
        'https://images.pexels.com/photos/172289/pexels-photo-172289.jpeg?auto=compress&cs=tinysrgb&w=1600',
      repeat: { x: LARGE_SLAB_REPEAT_X * 18, y: 0.8 },
      rotation: 0,
      textureSize: 2048
    },
    frame: {
      mapUrl:
        'https://images.pexels.com/photos/172289/pexels-photo-172289.jpeg?auto=compress&cs=tinysrgb&w=1600',
      repeat: { x: FRAME_SLAB_REPEAT_X * 18, y: 0.8 },
      rotation: 0,
      textureSize: 2048
    }
  }),
  Object.freeze({
    id: 'frameCharred',
    label: 'Charred Timber',
    source: 'Frame #5 burnt wood',
    rail: {
      mapUrl:
        'https://images.pexels.com/photos/129733/pexels-photo-129733.jpeg?auto=compress&cs=tinysrgb&w=1600',
      repeat: { x: LARGE_SLAB_REPEAT_X * 18, y: 0.8 },
      rotation: 0,
      textureSize: 2048
    },
    frame: {
      mapUrl:
        'https://images.pexels.com/photos/129733/pexels-photo-129733.jpeg?auto=compress&cs=tinysrgb&w=1600',
      repeat: { x: FRAME_SLAB_REPEAT_X * 18, y: 0.8 },
      rotation: 0,
      textureSize: 2048
    }
  }),
  Object.freeze({
    id: 'framePlank',
    label: 'Plank Studio',
    source: 'Frame #11 simple plank',
    rail: {
      mapUrl:
        'https://images.pexels.com/photos/172277/pexels-photo-172277.jpeg?auto=compress&cs=tinysrgb&w=1600',
      repeat: { x: LARGE_SLAB_REPEAT_X * 18, y: 0.8 },
      rotation: 0,
      textureSize: 2048
    },
    frame: {
      mapUrl:
        'https://images.pexels.com/photos/172277/pexels-photo-172277.jpeg?auto=compress&cs=tinysrgb&w=1600',
      repeat: { x: FRAME_SLAB_REPEAT_X * 18, y: 0.8 },
      rotation: 0,
      textureSize: 2048
    }
  }),
  Object.freeze({
    id: 'frameWeathered',
    label: 'Weathered Grey',
    source: 'Frame #12 aged grey',
    rail: {
      mapUrl:
        'https://images.pexels.com/photos/172289/pexels-photo-172289.jpeg?auto=compress&cs=tinysrgb&w=1600&sat=-100',
      repeat: { x: LARGE_SLAB_REPEAT_X * 18, y: 0.8 },
      rotation: 0,
      textureSize: 2048
    },
    frame: {
      mapUrl:
        'https://images.pexels.com/photos/172289/pexels-photo-172289.jpeg?auto=compress&cs=tinysrgb&w=1600&sat=-100',
      repeat: { x: FRAME_SLAB_REPEAT_X * 18, y: 0.8 },
      rotation: 0,
      textureSize: 2048
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

export const applyWoodTextures = (
  material,
  {
    hue,
    sat,
    light,
    contrast,
    mapUrl,
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
  const baseTextures = mapUrl
    ? (() => {
        const map = woodTextureLoader.load(mapUrl, (texture) => {
          applySRGBColorSpace(texture);
          texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
          texture.center.set(0.5, 0.5);
          texture.anisotropy = 16;
          texture.needsUpdate = true;
        });
        applySRGBColorSpace(map);
        map.wrapS = map.wrapT = THREE.RepeatWrapping;
        map.center.set(0.5, 0.5);
        map.anisotropy = 16;
        map.needsUpdate = true;
        return {
          map,
          roughnessMap: makeRoughnessMap(
            roughnessSize,
            roughnessSize,
            roughnessBase,
            roughnessVariance
          )
        };
      })()
    : sharedKey
      ? ensureSharedWoodTextures({
          hue,
          sat,
          light,
          contrast,
          textureSize,
          roughnessSize,
          roughnessBase,
          roughnessVariance,
          sharedKey
        })
      : {
          map: makeSlabTexture(textureSize, textureSize, hue, sat, light, contrast),
          roughnessMap: makeRoughnessMap(
            roughnessSize,
            roughnessSize,
            roughnessBase,
            roughnessVariance
          )
        };
  const repeatVec = new THREE.Vector2(repeat?.x ?? 1, repeat?.y ?? 1);
  const map = cloneWoodTexture(baseTextures.map, repeatVec, rotation);
  const roughnessMap = cloneWoodTexture(baseTextures.roughnessMap, repeatVec, rotation);
  if (map) {
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
  }
  if (roughnessMap) {
    roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  }
  material.map = map;
  material.roughnessMap = roughnessMap;
  material.color.setHex(0xffffff);
  material.needsUpdate = true;
  if (material.map) material.map.needsUpdate = true;
  if (material.roughnessMap) material.roughnessMap.needsUpdate = true;
  material.userData = material.userData || {};
  material.userData.__woodTextures = { map, roughnessMap };
  material.userData.__woodOptions = {
    hue,
    sat,
    light,
    contrast,
    mapUrl,
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

