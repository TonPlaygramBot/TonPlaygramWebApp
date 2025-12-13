import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { applySRGBColorSpace } from './colorSpace.js';

const ABG_MODEL_URLS = Object.freeze([
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/ABeautifulGame/glTF/ABeautifulGame.gltf',
  'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/ABeautifulGame/glTF/ABeautifulGame.gltf',
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/ABeautifulGame/glTF/ABeautifulGame.gltf',
  'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/ABeautifulGame/glTF/ABeautifulGame.gltf'
]);

const ABG_TYPES = Object.freeze(['p', 'r', 'n', 'b', 'q', 'k']);
const ABG_TYPE_ALIASES = Object.freeze([
  ['p', /pawn/],
  ['r', /rook|castle/],
  ['n', /knight|horse/],
  ['b', /bishop/],
  ['q', /queen/],
  ['k', /king/]
]);
const ABG_COLOR_W = /\b(white|ivory|light|w)\b/i;
const ABG_COLOR_B = /\b(black|ebony|dark|b)\b/i;

function abgNodePath(node) {
  const names = [];
  let current = node;
  while (current && current.parent && names.length < 4) {
    names.unshift(current.name || '');
    current = current.parent;
  }
  return names.join('/').toLowerCase();
}

function abgDetectType(path) {
  if (!path) return null;
  const alias = ABG_TYPE_ALIASES.find(([, regex]) => regex.test(path));
  return alias ? alias[0] : null;
}

function abgDetectColor(path, luminanceHint = 0.6) {
  if (!path) return luminanceHint > 0.5 ? 'w' : 'b';
  if (ABG_COLOR_W.test(path)) return 'w';
  if (ABG_COLOR_B.test(path)) return 'b';
  return luminanceHint > 0.5 ? 'w' : 'b';
}

function abgAverageLuminance(root) {
  let sum = 0;
  let count = 0;
  root.traverse((node) => {
    if (!node.isMesh) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.forEach((mat) => {
      if (mat?.color) {
        const c = mat.color;
        sum += 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
        count += 1;
      }
    });
  });
  return count ? sum / count : 0.5;
}

export function cloneAbgWithMats(src) {
  const clone = src.clone(true);
  clone.traverse((node) => {
    if (node.isMesh) {
      if (Array.isArray(node.material)) {
        node.material = node.material.map((m) => m?.clone?.() ?? m);
      } else if (node.material) {
        node.material = node.material.clone();
      }
      node.castShadow = true;
      node.receiveShadow = false;
    }
  });
  return clone;
}

function abgBbox(obj) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3();
  box.getSize(size);
  return { box, size };
}

function prepareAbgPiece(src, targetFootprint = 1, baseLift = 0) {
  const clone = cloneAbgWithMats(src);
  const { size } = abgBbox(clone);
  const footprint = Math.max(size.x, size.z) || 1;
  const scale = targetFootprint / footprint;
  clone.scale.setScalar(scale);
  const { box } = abgBbox(clone);
  const lift = -box.min.y + baseLift;
  const group = new THREE.Group();
  group.add(clone);
  group.position.y = lift;
  group.traverse((node) => {
    if (node.isMesh) node.castShadow = true;
  });
  return group;
}

export function abgApplyPalette(node, palette) {
  if (!Array.isArray(palette) || !palette.length) return;
  node.traverse((child) => {
    if (!child.isMesh) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    const next = mats.map((_, idx) => palette[idx % palette.length].clone());
    child.material = Array.isArray(child.material) ? next : next[0];
  });
}

export function abgTintPalette(palette, color) {
  const tint = new THREE.Color(color);
  return (palette || []).map((mat) => {
    const clone = mat?.clone?.() ?? mat;
    if (clone?.color) {
      clone.color.copy(tint);
    }
    if (clone?.emissive) {
      clone.emissive.set(0x000000);
    }
    return clone;
  });
}

let rawAbgPromise = null;
const preparedCache = new Map();

async function loadRawAbg() {
  if (rawAbgPromise) return rawAbgPromise;
  rawAbgPromise = (async () => {
    const loader = new GLTFLoader();
    loader.setCrossOrigin('anonymous');
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
    loader.setDRACOLoader(draco);

    let root = null;
    for (const url of ABG_MODEL_URLS) {
      try {
        const gltf = await loader.loadAsync(url);
        root = gltf?.scene;
        if (root) break;
      } catch (error) {
        console.warn('ABG load failed', url, error);
      }
    }
    if (!root) return null;
    root.updateMatrixWorld(true);

    const proto = { w: {}, b: {} };
    const palettes = { w: [], b: [] };

    root.traverse((node) => {
      const path = abgNodePath(node);
      const type = abgDetectType(path);
      if (node.isMesh) {
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        let lum = 0;
        let cnt = 0;
        mats.forEach((mat) => {
          if (mat?.map) applySRGBColorSpace(mat.map);
          if (mat?.emissiveMap) applySRGBColorSpace(mat.emissiveMap);
          if (mat?.color) {
            const c = mat.color;
            lum += 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
            cnt += 1;
          }
        });
        const lumAvg = cnt ? lum / cnt : 0.6;
        const colorKey = abgDetectColor(path, lumAvg);
        mats.forEach((mat) => {
          if (mat?.isMaterial) palettes[colorKey].push(mat.clone());
        });
      }
      if (!type) return;
      const color = abgDetectColor(path, abgAverageLuminance(node));
      if (!proto[color][type]) {
        proto[color][type] = node;
      }
    });

    (['w', 'b']).forEach((color) => {
      ABG_TYPES.forEach((type) => {
        if (!proto[color][type]) {
          const other = color === 'w' ? 'b' : 'w';
          if (proto[other][type]) {
            const clone = cloneAbgWithMats(proto[other][type]);
            abgApplyPalette(clone, palettes[color]);
            proto[color][type] = clone;
          }
        }
      });
    });

    return { proto, palettes };
  })();

  return rawAbgPromise;
}

export async function loadAbgAssets({ targetFootprint = 1, baseLift = 0 } = {}) {
  const raw = await loadRawAbg();
  if (!raw) return null;
  const key = `${targetFootprint}|${baseLift}`;
  if (preparedCache.has(key)) return preparedCache.get(key);

  const prepared = { proto: { w: {}, b: {} }, palettes: raw.palettes };
  (['w', 'b']).forEach((color) => {
    ABG_TYPES.forEach((type) => {
      const src = raw.proto[color][type];
      if (src) {
        prepared.proto[color][type] = prepareAbgPiece(src, targetFootprint, baseLift);
      }
    });
  });

  preparedCache.set(key, prepared);
  return prepared;
}
