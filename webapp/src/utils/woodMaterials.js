import * as THREE from 'three';

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const normalizeHue = (h) => {
  let hue = h % 360;
  if (hue < 0) hue += 360;
  return hue;
};

const fract = (value) => value - Math.floor(value);

const stringToSeed = (value) => {
  if (value === null || value === undefined) return 0;
  const str = String(value);
  let hash = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    hash = Math.imul(hash ^ str.charCodeAt(i), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
  hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
  hash ^= hash >>> 16;
  return hash >>> 0;
};

const createSeededRandom = (seedValue) => {
  if (seedValue === null || seedValue === undefined) {
    return { next: () => Math.random() };
  }
  let state = stringToSeed(seedValue) || 1;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next };
};

const hslToRgb = (h, s, l) => {
  const hue = normalizeHue(h) / 360;
  const sat = clamp01(s);
  const light = clamp01(l);
  if (sat === 0) {
    const gray = Math.round(light * 255);
    return { r: gray, g: gray, b: gray };
  }
  const hue2rgb = (p, q, t) => {
    let temp = t;
    if (temp < 0) temp += 1;
    if (temp > 1) temp -= 1;
    if (temp < 1 / 6) return p + (q - p) * 6 * temp;
    if (temp < 1 / 2) return q;
    if (temp < 2 / 3) return p + (q - p) * (2 / 3 - temp) * 6;
    return p;
  };
  const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat;
  const p = 2 * light - q;
  const r = hue2rgb(p, q, hue + 1 / 3);
  const g = hue2rgb(p, q, hue);
  const b = hue2rgb(p, q, hue - 1 / 3);
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
};

const makeNaturalWoodTexture = (width, height, hue, sat, light, contrast, seedKey = null) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  const rng = createSeededRandom(seedKey);
  const baseSeed = stringToSeed(`${seedKey ?? 'wood'}:${width}x${height}`);
  const bandFreq = 2.6 + rng.next() * 2.2;
  const rippleFreq = 6 + rng.next() * 4;
  const rippleStrength = 0.08 + rng.next() * 0.08;
  const bandJitter = new Float32Array(height);
  const bandShift = new Float32Array(height);
  for (let y = 0; y < height; y += 1) {
    bandJitter[y] = 0.6 + rng.next() * 0.7;
    bandShift[y] = rng.next() * Math.PI * 2;
  }

  const ringNoise = (x, y, scale = 1) => {
    const nx = x / width;
    const ny = y / height;
    const n = Math.sin((nx * 157.1 + ny * 311.7) * scale + baseSeed * 0.0002);
    return fract(Math.sin(n * 43758.5453 + baseSeed * 0.13));
  };

  const variationField = new Float32Array(width * height);
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;
  for (let y = 0; y < height; y += 1) {
    const ny = y / height;
    const jitter = bandJitter[y];
    const shift = bandShift[y];
    for (let x = 0; x < width; x += 1) {
      const nx = x / width;
      const idx = (y * width + x) * 4;
      const primaryWave = Math.sin((nx * bandFreq + shift) * Math.PI * 2);
      const secondaryWave = Math.sin((nx * rippleFreq + ny * 2 + shift * 0.5) * Math.PI * 2);
      const streakNoise = ringNoise(x * 0.75, y * 0.45, 2.4) * 2 - 1;
      const fiberNoise = ringNoise(x * 1.9 + baseSeed * 0.01, y * 0.5 + baseSeed * 0.02, 3.8) * 2 - 1;
      const band = primaryWave * 0.65 + secondaryWave * rippleStrength * jitter;
      const variation = band * 0.6 + streakNoise * 0.18 + fiberNoise * 0.12;
      variationField[y * width + x] = variation;
      const localContrast = contrast * (0.55 + jitter * 0.2);
      const localHue = hue + variation * 4;
      const localSat = sat * (0.92 + variation * 0.08);
      const localLight = light + variation * localContrast * 0.42;
      const { r, g, b } = hslToRgb(localHue, localSat, clamp01(localLight));
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);

  const highlightHeight = Math.max(2, Math.floor(height * 0.06));
  const highlightGradient = ctx.createLinearGradient(0, 0, 0, highlightHeight);
  highlightGradient.addColorStop(0, 'rgba(255,255,255,0.16)');
  highlightGradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = highlightGradient;
  ctx.fillRect(0, 0, width, highlightHeight);
  ctx.save();
  ctx.scale(1, -1);
  ctx.translate(0, -height);
  ctx.fillRect(0, 0, width, highlightHeight);
  ctx.restore();

  const knotCount = Math.max(4, Math.floor((width * height) / 45000));
  for (let i = 0; i < knotCount; i += 1) {
    const kx = rng.next() * width;
    const ky = rng.next() * height;
    const rx = (width * 0.03 + rng.next() * width * 0.04) * (rng.next() > 0.5 ? 1 : 0.6);
    const ry = height * 0.045 + rng.next() * height * 0.035;
    const knot = ctx.createRadialGradient(kx, ky, 0, kx, ky, Math.max(rx, ry));
    knot.addColorStop(0, `rgba(0,0,0,${0.22 + rng.next() * 0.18})`);
    knot.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = knot;
    ctx.beginPath();
    ctx.ellipse(kx, ky, rx, ry, (rng.next() - 0.5) * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  return { texture, variationField };
};

const makeRoughnessMap = (
  width,
  height,
  base,
  variance,
  seedKey = null,
  variationField = null
) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const rng = createSeededRandom(`${seedKey ?? 'rough'}:roughness`);
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      const grainVariation = variationField ? variationField[y * width + x] ?? 0 : 0;
      const noise = rng.next() * 2 - 1;
      const value = clamp01(base + grainVariation * variance * 0.45 + noise * variance * 0.35);
      const g = Math.round(value * 255);
      data[idx] = g;
      data[idx + 1] = g;
      data[idx + 2] = g;
      data[idx + 3] = 255;
    }
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
    const seedKey = `${sharedKey ?? 'wood'}:${hue}:${sat}:${light}:${contrast}`;
    const { texture: map, variationField } = makeNaturalWoodTexture(
      textureSize,
      textureSize,
      hue,
      sat,
      light,
      contrast,
      seedKey
    );
    const roughnessMap = makeRoughnessMap(
      roughnessSize,
      roughnessSize,
      roughnessBase,
      roughnessVariance,
      seedKey,
      variationField
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
    : (() => {
        const seedKey = sharedKey
          ? `${sharedKey ?? 'wood'}:${hue}:${sat}:${light}:${contrast}:local`
          : null;
        const { texture: map, variationField } = makeNaturalWoodTexture(
          textureSize,
          textureSize,
          hue,
          sat,
          light,
          contrast,
          seedKey
        );
        const roughnessMap = makeRoughnessMap(
          roughnessSize,
          roughnessSize,
          roughnessBase,
          roughnessVariance,
          seedKey,
          variationField
        );
        return { map, roughnessMap };
      })();
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

