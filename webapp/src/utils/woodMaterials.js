import * as THREE from 'three';

const LEGACY_SRGB_ENCODING = Reflect.get(THREE, 'sRGBEncoding');

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

const MAX_CANVAS_DIMENSION = 3072;

const createFallbackTexture = (hue, sat, light) => {
  const color = new THREE.Color();
  color.setHSL(normalizeHue(hue) / 360, clamp01(sat), clamp01(light));
  const data = new Uint8Array([
    Math.round(color.r * 255),
    Math.round(color.g * 255),
    Math.round(color.b * 255),
    255
  ]);
  const texture = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  if ('colorSpace' in texture && THREE.SRGBColorSpace) {
    texture.colorSpace = THREE.SRGBColorSpace;
  } else if ('encoding' in texture && LEGACY_SRGB_ENCODING !== undefined) {
    texture.encoding = LEGACY_SRGB_ENCODING;
  }
  return texture;
};

const getCanvasContext = (width, height) => {
  if (typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    const safeWidth = Math.max(
      1,
      Math.min(MAX_CANVAS_DIMENSION, Math.floor(width || DEFAULT_WOOD_TEXTURE_SIZE))
    );
    const safeHeight = Math.max(
      1,
      Math.min(MAX_CANVAS_DIMENSION, Math.floor(height || DEFAULT_WOOD_TEXTURE_SIZE))
    );
    canvas.width = safeWidth;
    canvas.height = safeHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    return { canvas, ctx, width: safeWidth, height: safeHeight };
  } catch (error) {
    console.warn('Failed to allocate wood texture canvas', error);
    return null;
  }
};

const makeNaturalWoodTexture = (width, height, hue, sat, light, contrast) => {
  const context = getCanvasContext(width, height);
  if (!context) {
    console.warn('Falling back to solid wood texture');
    return createFallbackTexture(hue, sat, light);
  }
  const { canvas, ctx, width: w, height: h } = context;
  ctx.fillStyle = hslString(hue, sat, light);
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 3000; i += 1) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const grainLen = 50 + Math.random() * 200;
    const curve = Math.sin(y / 40 + Math.random() * 2) * 10;
    ctx.strokeStyle = hslString(hue, sat * 0.6, light - Math.random() * contrast);
    ctx.lineWidth = 0.8 + Math.random() * 1.2;
    ctx.globalAlpha = 0.25 + Math.random() * 0.3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + curve, y + grainLen / 2, x, y + grainLen);
    ctx.stroke();
  }

  for (let i = 0; i < 40; i += 1) {
    const kx = Math.random() * w;
    const ky = Math.random() * h;
    const r = 8 + Math.random() * 15;
    const grad = ctx.createRadialGradient(kx, ky, 0, kx, ky, r);
    grad.addColorStop(0, hslString(hue, sat * 0.9, light - 0.3));
    grad.addColorStop(1, hslString(hue, sat * 0.4, light));
    ctx.fillStyle = grad;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(kx, ky, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  if ('colorSpace' in texture && THREE.SRGBColorSpace) {
    texture.colorSpace = THREE.SRGBColorSpace;
  } else if ('encoding' in texture && LEGACY_SRGB_ENCODING !== undefined) {
    texture.encoding = LEGACY_SRGB_ENCODING;
  }
  texture.anisotropy = 16;
  return texture;
};

const makeRoughnessMap = (width, height, base, variance) => {
  const context = getCanvasContext(width, height);
  if (!context) {
    const clamped = clamp01(base);
    const value = Math.round(clamped * 255);
    const data = new Uint8Array([value, value, value, 255]);
    const texture = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.needsUpdate = true;
    return texture;
  }
  const { canvas, ctx, width: w, height: h } = context;
  const imageData = ctx.createImageData(w, h);
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

export const WOOD_GRAIN_OPTIONS = Object.freeze([
  Object.freeze({
    id: 'heritagePlanks',
    label: 'Heritage Planks',
    rail: {
      repeat: { x: 0.09, y: 0.5 },
      rotation: Math.PI / 28,
      textureSize: 3072
    },
    frame: {
      repeat: { x: 0.18, y: 0.34 },
      rotation: Math.PI / 2,
      textureSize: 3072
    }
  }),
  Object.freeze({
    id: 'atelierChevron',
    label: 'Atelier Chevron',
    rail: {
      repeat: { x: 0.16, y: 0.62 },
      rotation: Math.PI / 9,
      textureSize: 3072
    },
    frame: {
      repeat: { x: 0.28, y: 0.46 },
      rotation: -Math.PI / 8,
      textureSize: 3072
    }
  }),
  Object.freeze({
    id: 'estateBands',
    label: 'Estate Bands',
    rail: {
      repeat: { x: 0.12, y: 0.68 },
      rotation: Math.PI / 2,
      textureSize: 3072
    },
    frame: {
      repeat: { x: 0.32, y: 0.4 },
      rotation: 0,
      textureSize: 3072
    }
  }),
  Object.freeze({
    id: 'studioVeins',
    label: 'Studio Veins',
    rail: {
      repeat: { x: 0.1, y: 0.56 },
      rotation: Math.PI / 14,
      textureSize: 3072
    },
    frame: {
      repeat: { x: 0.24, y: 0.38 },
      rotation: Math.PI / 2,
      textureSize: 3072
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
    const map = makeNaturalWoodTexture(textureSize, textureSize, hue, sat, light, contrast);
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
  if ('colorSpace' in clone && 'colorSpace' in texture && texture.colorSpace !== undefined) {
    clone.colorSpace = texture.colorSpace;
  } else if ('encoding' in clone && 'encoding' in texture && texture.encoding !== undefined) {
    clone.encoding = texture.encoding;
  }
  if (typeof texture.anisotropy === 'number') {
    clone.anisotropy = texture.anisotropy;
  }
  if (texture.minFilter !== undefined) clone.minFilter = texture.minFilter;
  if (texture.magFilter !== undefined) clone.magFilter = texture.magFilter;
  if (texture.generateMipmaps !== undefined) clone.generateMipmaps = texture.generateMipmaps;
  if (texture.wrapS !== undefined) clone.wrapS = texture.wrapS;
  if (texture.wrapT !== undefined) clone.wrapT = texture.wrapT;
  if (texture.center?.isVector2) {
    clone.center.copy(texture.center);
  } else {
    clone.center.set(0.5, 0.5);
  }
  if (repeat) {
    clone.repeat.set(repeat.x ?? 1, repeat.y ?? 1);
  } else if (texture.repeat?.isVector2) {
    clone.repeat.copy(texture.repeat);
  }
  if (typeof rotation === 'number') {
    clone.rotation = rotation;
  } else if (typeof texture.rotation === 'number') {
    clone.rotation = texture.rotation;
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
  const baseTextures = sharedKey
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
        map: makeNaturalWoodTexture(textureSize, textureSize, hue, sat, light, contrast),
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

