import * as THREE from 'three';

const clamp01 = (value) => Math.min(1, Math.max(0, value));

export const WOOD_FINISH_PRESETS = Object.freeze([
  { id: 'birch', label: 'Birch', hue: 38, saturation: 0.25, lightness: 0.84, contrast: 0.42 },
  { id: 'maple', label: 'Maple', hue: 35, saturation: 0.22, lightness: 0.78, contrast: 0.44 },
  { id: 'oak', label: 'Oak', hue: 32, saturation: 0.34, lightness: 0.7, contrast: 0.52 },
  { id: 'cherry', label: 'Cherry', hue: 14, saturation: 0.42, lightness: 0.6, contrast: 0.58 },
  { id: 'teak', label: 'Teak', hue: 28, saturation: 0.4, lightness: 0.52, contrast: 0.6 },
  { id: 'walnut', label: 'Walnut', hue: 22, saturation: 0.4, lightness: 0.44, contrast: 0.64 },
  { id: 'smokedOak', label: 'Smoked Oak', hue: 28, saturation: 0.35, lightness: 0.28, contrast: 0.75 },
  { id: 'wenge', label: 'Wenge', hue: 24, saturation: 0.38, lightness: 0.22, contrast: 0.8 },
  { id: 'ebony', label: 'Ebony', hue: 25, saturation: 0.35, lightness: 0.18, contrast: 0.85 }
]);

export const hslToColor = (hue, saturation, lightness) => {
  const color = new THREE.Color();
  const normalizedHue = ((hue % 360) + 360) / 360;
  color.setHSL(normalizedHue, clamp01(saturation), clamp01(lightness));
  return color;
};

export const hslToHex = (hue, saturation, lightness) => hslToColor(hue, saturation, lightness).getHex();

export function makeNaturalWoodTexture(width, height, hue, saturation, lightness, contrast) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const fill = hslToColor(hue, saturation, lightness).getStyle();
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 3000; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const grainLength = 50 + Math.random() * 200;
    const curve = Math.sin(y / 40 + Math.random() * 2) * 10;
    const shade = hslToColor(hue, saturation * 0.6, clamp01(lightness - Math.random() * contrast));
    ctx.strokeStyle = shade.getStyle();
    ctx.lineWidth = 0.8 + Math.random() * 1.2;
    ctx.globalAlpha = 0.25 + Math.random() * 0.3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + curve, y + grainLength / 2, x, y + grainLength);
    ctx.stroke();
  }

  for (let i = 0; i < 40; i++) {
    const kx = Math.random() * width;
    const ky = Math.random() * height;
    const r = 8 + Math.random() * 15;
    const gradient = ctx.createRadialGradient(kx, ky, 0, kx, ky, r);
    gradient.addColorStop(0, hslToColor(hue, saturation * 0.9, clamp01(lightness - 0.3)).getStyle());
    gradient.addColorStop(1, hslToColor(hue, saturation * 0.4, lightness).getStyle());
    ctx.fillStyle = gradient;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(kx, ky, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipMapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  return texture;
}

export function makeRoughnessMap(width, height, base = 0.15, variance = 0.25) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const v = base + (Math.random() - 0.5) * variance;
      const g = Math.max(0, Math.min(255, Math.floor(v * 255)));
      data[i] = g;
      data[i + 1] = g;
      data[i + 2] = g;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipMapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  return texture;
}

export function createWoodMaterial({
  hue,
  saturation,
  lightness,
  contrast,
  repeat = 1,
  anisotropy = 16,
  roughness = 0.32,
  metalness = 0.2,
  clearcoat = 0.35,
  clearcoatRoughness = 0.18,
  sheen = 0.12,
  sheenRoughness = 0.5,
  envMapIntensity = 0.85,
  reflectivity = 0.42,
  map: providedMap = null,
  roughnessMap: providedRoughnessMap = null
} = {}) {
  const ownsMap = !providedMap;
  const map = providedMap ?? makeNaturalWoodTexture(1024, 1024, hue, saturation, lightness, contrast);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = anisotropy;
  map.repeat.set(repeat, repeat);
  map.needsUpdate = true;
  const ownsRoughness = !providedRoughnessMap;
  const roughnessMap =
    providedRoughnessMap ?? makeRoughnessMap(512, 512, 0.18, 0.28);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.anisotropy = Math.min(anisotropy, 8);
  roughnessMap.repeat.set(repeat, repeat);
  roughnessMap.needsUpdate = true;
  const material = new THREE.MeshPhysicalMaterial({
    color: hslToColor(hue, saturation, lightness),
    map,
    roughnessMap,
    roughness,
    metalness,
    clearcoat,
    clearcoatRoughness,
    sheen,
    sheenRoughness,
    reflectivity,
    envMapIntensity
  });
  material.addEventListener('dispose', () => {
    if (!ownsMap && map?.userData?.preserveOnDispose) return;
    if (map && (ownsMap || !map.userData?.preserveOnDispose)) {
      map.dispose();
    }
    if (!ownsRoughness && roughnessMap?.userData?.preserveOnDispose) return;
    if (
      roughnessMap &&
      (ownsRoughness || !roughnessMap.userData?.preserveOnDispose)
    ) {
      roughnessMap.dispose();
    }
  });
  return material;
}

export function buildWoodFinishMap({ defaultClothColor, makeColorPalette }) {
  if (typeof makeColorPalette !== 'function') {
    throw new Error('makeColorPalette callback is required to build wood finishes.');
  }
  const entries = {};
  WOOD_FINISH_PRESETS.forEach((preset) => {
    const { id, label, hue, saturation, lightness, contrast } = preset;
    const frameLight = clamp01(lightness - 0.03);
    const railLight = clamp01(lightness - 0.08);
    const legLight = clamp01(lightness - 0.1);
    const trimLight = clamp01(lightness - 0.14);
    const frameSat = clamp01(saturation * 1.02);
    const railSat = clamp01(saturation * 1.05);
    const legSat = clamp01(saturation * 0.95);
    const trimSat = clamp01(saturation * 0.9);

    const baseMap = makeNaturalWoodTexture(1024, 1024, hue, saturation, lightness, contrast);
    const baseRoughness = makeRoughnessMap(512, 512, 0.18, 0.28);
    baseMap.userData = { ...(baseMap.userData || {}), preserveOnDispose: false };
    baseRoughness.userData = {
      ...(baseRoughness.userData || {}),
      preserveOnDispose: false
    };
    const cloneTexture = (texture) => {
      if (!texture) return null;
      const cloned = texture.clone();
      cloned.wrapS = texture.wrapS;
      cloned.wrapT = texture.wrapT;
      cloned.anisotropy = texture.anisotropy;
      cloned.repeat.copy(texture.repeat);
      cloned.needsUpdate = true;
      return cloned;
    };
    entries[id] = {
      id,
      label,
      colors: makeColorPalette({
        cloth: defaultClothColor,
        rail: hslToHex(hue, railSat, railLight),
        base: hslToHex(hue, legSat, legLight)
      }),
      createMaterials: () => {
        const leg = createWoodMaterial({
          hue,
          saturation: legSat,
          lightness: legLight,
          contrast,
          repeat: 1.1,
          roughness: 0.38,
          envMapIntensity: 0.84,
          map: baseMap,
          roughnessMap: baseRoughness
        });
        const frame = createWoodMaterial({
          hue,
          saturation: frameSat,
          lightness: frameLight,
          contrast,
          repeat: 1.2,
          envMapIntensity: 0.88,
          map: cloneTexture(baseMap),
          roughnessMap: cloneTexture(baseRoughness)
        });
        const rail = createWoodMaterial({
          hue,
          saturation: railSat,
          lightness: railLight,
          contrast,
          repeat: 1.6,
          roughness: 0.34,
          envMapIntensity: 0.92,
          map: cloneTexture(baseMap),
          roughnessMap: cloneTexture(baseRoughness)
        });
        const trim = new THREE.MeshPhysicalMaterial({
          color: hslToColor(hue, trimSat, trimLight),
          metalness: 0.92,
          roughness: 0.18,
          clearcoat: 0.6,
          clearcoatRoughness: 0.12,
          reflectivity: 0.62,
          envMapIntensity: 1.15
        });
        trim.userData = { ...(trim.userData || {}), isChromeTrim: true };
        return { frame, rail, leg, trim, accent: null, woodMap: baseMap };
      }
    };
  });
  return entries;
}

export { clamp01 };
