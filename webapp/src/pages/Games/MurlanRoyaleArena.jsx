import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {
  createArenaCarpetMaterial,
  createArenaWallMaterial
} from '../../utils/arenaDecor.js';
import { applyRendererSRGB, applySRGBColorSpace } from '../../utils/colorSpace.js';
import { ARENA_CAMERA_DEFAULTS, buildArenaCameraConfig } from '../../utils/arenaCameraConfig.js';
import { createMurlanStyleTable, applyTableMaterials } from '../../utils/murlanTable.js';
import {
  WOOD_FINISH_PRESETS,
  WOOD_GRAIN_OPTIONS,
  WOOD_GRAIN_OPTIONS_BY_ID,
  hslToHexNumber
} from '../../utils/woodMaterials.js';
import {
  TABLE_WOOD_OPTIONS,
  TABLE_CLOTH_OPTIONS,
  TABLE_BASE_OPTIONS,
  DEFAULT_TABLE_CUSTOMIZATION,
  WOOD_PRESETS_BY_ID
} from '../../utils/tableCustomizationOptions.js';
import { CARD_THEMES } from '../../utils/cardThemes.js';
import {
  getMurlanInventory,
  isMurlanOptionUnlocked,
  murlanAccountId
} from '../../utils/murlanInventory.js';
import {
  ComboType,
  DEFAULT_CONFIG as BASE_CONFIG,
  aiChooseAction,
  canBeat,
  detectCombo,
  sortHand
} from '../../../../lib/murlan.js';
import { FLAG_EMOJIS } from '../../utils/flagEmojis.js';
import AvatarTimer from '../../components/AvatarTimer.jsx';
import {
  MURLAN_OUTFIT_THEMES as OUTFIT_THEMES,
  MURLAN_STOOL_THEMES as STOOL_THEMES,
  MURLAN_TABLE_THEMES as TABLE_THEMES
} from '../../config/murlanThemes.js';

const MODEL_SCALE = 0.75;
const ARENA_GROWTH = 1.45; // expanded arena footprint for wider walkways
const CHAIR_SIZE_SCALE = 1.3;

const TABLE_RADIUS = 3.4 * MODEL_SCALE;
const CHAIR_COUNT = 4;
const CUSTOM_SEAT_ANGLES = [
  THREE.MathUtils.degToRad(90),
  THREE.MathUtils.degToRad(0),
  THREE.MathUtils.degToRad(270),
  THREE.MathUtils.degToRad(180)
];

const SUITS = ['♠', '♥', '♦', '♣'];
const SUIT_COLORS = {
  '♠': '#111111',
  '♣': '#111111',
  '♥': '#cc2233',
  '♦': '#cc2233',
  '🃏': '#111111'
};

function detectCoarsePointer() {
  if (typeof window === 'undefined') {
    return false;
  }
  if (typeof window.matchMedia === 'function') {
    try {
      const coarseQuery = window.matchMedia('(pointer: coarse)');
      if (typeof coarseQuery?.matches === 'boolean') {
        return coarseQuery.matches;
      }
    } catch (err) {
      // ignore
    }
  }
  try {
    if ('ontouchstart' in window) {
      return true;
    }
    const nav = window.navigator;
    if (nav && typeof nav.maxTouchPoints === 'number') {
      return nav.maxTouchPoints > 0;
    }
  } catch (err) {
    // ignore
  }
  return false;
}

function detectLowRefreshDisplay() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  const queries = ['(max-refresh-rate: 59hz)', '(max-refresh-rate: 50hz)', '(prefers-reduced-motion: reduce)'];
  for (const query of queries) {
    try {
      if (window.matchMedia(query).matches) {
        return true;
      }
    } catch (err) {
      // ignore unsupported query
    }
  }
  return false;
}

function detectHighRefreshDisplay() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  const queries = ['(min-refresh-rate: 120hz)', '(min-refresh-rate: 90hz)'];
  for (const query of queries) {
    try {
      if (window.matchMedia(query).matches) {
        return true;
      }
    } catch (err) {
      // ignore unsupported query
    }
  }
  return false;
}

let cachedRendererString = null;
let rendererLookupAttempted = false;

function readGraphicsRendererString() {
  if (rendererLookupAttempted) {
    return cachedRendererString;
  }
  rendererLookupAttempted = true;
  if (typeof document === 'undefined') {
    return null;
  }
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl') ||
      canvas.getContext('webgl2');
    if (!gl) {
      return null;
    }
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) ?? '';
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) ?? '';
      cachedRendererString = `${vendor} ${renderer}`.trim();
    } else {
      const vendor = gl.getParameter(gl.VENDOR) ?? '';
      const renderer = gl.getParameter(gl.RENDERER) ?? '';
      cachedRendererString = `${vendor} ${renderer}`.trim();
    }
    return cachedRendererString;
  } catch (err) {
    return null;
  }
}

function classifyRendererTier(rendererString) {
  if (typeof rendererString !== 'string' || rendererString.length === 0) {
    return 'unknown';
  }
  const signature = rendererString.toLowerCase();
  if (
    signature.includes('mali') ||
    signature.includes('adreno') ||
    signature.includes('powervr') ||
    signature.includes('apple a') ||
    signature.includes('snapdragon') ||
    signature.includes('tegra x1')
  ) {
    return 'mobile';
  }
  if (
    signature.includes('geforce') ||
    signature.includes('nvidia') ||
    signature.includes('radeon') ||
    signature.includes('rx ') ||
    signature.includes('rtx') ||
    signature.includes('apple m') ||
    signature.includes('arc')
  ) {
    return 'desktopHigh';
  }
  if (signature.includes('intel') || signature.includes('iris') || signature.includes('uhd')) {
    return 'desktopMid';
  }
  return 'unknown';
}

function resolveDefaultPixelRatioCap() {
  if (typeof window === 'undefined') {
    return 2;
  }
  return window.innerWidth <= 1366 ? 1.5 : 2;
}

function detectPreferredFrameRateId() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'fhd60';
  }
  const coarsePointer = detectCoarsePointer();
  const ua = navigator.userAgent ?? '';
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const maxTouchPoints = navigator.maxTouchPoints ?? 0;
  const isTouch = maxTouchPoints > 1;
  const deviceMemory = typeof navigator.deviceMemory === 'number' ? navigator.deviceMemory : null;
  const hardwareConcurrency = navigator.hardwareConcurrency ?? 4;
  const lowRefresh = detectLowRefreshDisplay();
  const highRefresh = detectHighRefreshDisplay();
  const rendererTier = classifyRendererTier(readGraphicsRendererString());

  if (lowRefresh) {
    return 'hd50';
  }

  if (isMobileUA || coarsePointer || isTouch || rendererTier === 'mobile') {
    if ((deviceMemory !== null && deviceMemory <= 4) || hardwareConcurrency <= 4) {
      return 'hd50';
    }
    if (highRefresh && hardwareConcurrency >= 8 && (deviceMemory == null || deviceMemory >= 6)) {
      return 'uhd120';
    }
    if (
      highRefresh ||
      hardwareConcurrency >= 6 ||
      (deviceMemory != null && deviceMemory >= 6)
    ) {
      return 'qhd90';
    }
    return 'fhd60';
  }

  if (rendererTier === 'desktopHigh' && highRefresh) {
    return 'ultra144';
  }

  if (rendererTier === 'desktopHigh' || hardwareConcurrency >= 8) {
    return 'uhd120';
  }

  if (rendererTier === 'desktopMid') {
    return 'qhd90';
  }

  return 'fhd60';
}

const CHAIR_MODEL_URLS = [
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/AntiqueChair/glTF-Binary/AntiqueChair.glb',
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/SheenChair/glTF-Binary/SheenChair.glb',
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/AntiqueChair/glTF-Binary/AntiqueChair.glb'
];
const PREFERRED_TEXTURE_SIZES = ['4k', '2k', '1k'];
const HALLWAY_PLANT_ASSETS = ['potted_plant_04'];
const POLYHAVEN_MODEL_CACHE = new Map();
const PLANT_TARGET_HEIGHT = 2.8 * MODEL_SCALE;
const HALLWAY_PLANT_SCALE = 1;
const DECOR_PLANT_COUNT = 4;
const BASIS_TRANSCODER_PATH = 'https://cdn.jsdelivr.net/npm/three@0.164.0/examples/jsm/libs/basis/';
const DRACO_DECODER_PATH = 'https://www.gstatic.com/draco/v1/decoders/';

let sharedKtx2Loader = null;

function stripQueryHash(u) {
  return u.split('#')[0].split('?')[0];
}

function basename(p) {
  const s = p.replace(/\\/g, '/');
  const parts = s.split('/');
  return parts[parts.length - 1] || s;
}

function isModelUrl(u) {
  const s = stripQueryHash(u).toLowerCase();
  return s.endsWith('.glb') || s.endsWith('.gltf');
}

function extractAllHttpUrls(apiJson) {
  const out = new Set();
  const walk = (v) => {
    if (!v) return;
    if (typeof v === 'string') {
      if (v.startsWith('http')) out.add(v);
      return;
    }
    if (typeof v !== 'object') return;
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    Object.values(v).forEach(walk);
  };
  walk(apiJson);
  return Array.from(out);
}

function pickBestModelUrl(urls) {
  const modelUrls = urls.filter(isModelUrl);
  const glbs = modelUrls.filter((u) => stripQueryHash(u).toLowerCase().endsWith('.glb'));
  const gltfs = modelUrls.filter((u) => stripQueryHash(u).toLowerCase().endsWith('.gltf'));

  const score = (u) => {
    const lu = u.toLowerCase();
    let s = 0;
    if (lu.includes('2k')) s += 3;
    if (lu.includes('1k')) s += 2;
    if (lu.includes('4k')) s += 1;
    if (lu.includes('8k')) s -= 2;
    if (lu.includes('download')) s += 1;
    return s;
  };

  glbs.sort((a, b) => score(b) - score(a));
  gltfs.sort((a, b) => score(b) - score(a));

  return glbs[0] || gltfs[0] || null;
}

function pickBestTextureUrls(apiJson, preferredSizes = PREFERRED_TEXTURE_SIZES) {
  if (!apiJson || typeof apiJson !== 'object') {
    return { diffuse: null, normal: null, roughness: null };
  }

  const urls = [];

  const walk = (value) => {
    if (!value) {
      return;
    }
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (value.startsWith('http') && (lower.includes('.jpg') || lower.includes('.png'))) {
        urls.push(value);
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (typeof value === 'object') {
      Object.values(value).forEach(walk);
    }
  };

  walk(apiJson);

  const pick = (keywords) => {
    const scored = urls
      .filter((url) => keywords.some((kw) => url.toLowerCase().includes(kw)))
      .map((url) => {
        const lower = url.toLowerCase();
        let score = 0;
        preferredSizes.forEach((size, index) => {
          if (lower.includes(size)) {
            score += (preferredSizes.length - index) * 10;
          }
        });
        if (lower.includes('jpg')) score += 6;
        if (lower.includes('png')) score += 3;
        if (lower.includes('preview') || lower.includes('thumb')) score -= 50;
        if (lower.includes('.exr')) score -= 100;
        return { url, score };
      })
      .sort((a, b) => b.score - a.score);
    return scored[0]?.url;
  };

  return {
    diffuse: pick(['diff', 'diffuse', 'albedo', 'basecolor']),
    normal: pick(['nor_gl', 'normal_gl', 'nor', 'normal']),
    roughness: pick(['rough', 'roughness'])
  };
}

async function loadTexture(textureLoader, url, isColor, maxAnisotropy = 1) {
  return await new Promise((resolve, reject) => {
    textureLoader.load(
      url,
      (texture) => {
        if (isColor) {
          applySRGBColorSpace(texture);
        }
        texture.flipY = false;
        texture.anisotropy = Math.max(texture.anisotropy ?? 1, maxAnisotropy);
        texture.needsUpdate = true;
        resolve(texture);
      },
      undefined,
      () => reject(new Error('texture load failed'))
    );
  });
}

function normalizePbrTexture(texture, maxAnisotropy = 1) {
  if (!texture) return;
  texture.flipY = false;
  texture.wrapS = texture.wrapS ?? THREE.RepeatWrapping;
  texture.wrapT = texture.wrapT ?? THREE.RepeatWrapping;
  texture.anisotropy = Math.max(texture.anisotropy ?? 1, maxAnisotropy);
  texture.needsUpdate = true;
}

async function loadPolyhavenTextureSet(assetId, textureLoader, maxAnisotropy = 1, cache = null) {
  if (!assetId || !textureLoader) return null;
  const key = `${assetId.toLowerCase()}|${maxAnisotropy}`;
  if (cache?.has(key)) {
    return cache.get(key);
  }

  const promise = (async () => {
    try {
      const response = await fetch(`https://api.polyhaven.com/files/${encodeURIComponent(assetId)}`);
      if (!response.ok) {
        return null;
      }
      const json = await response.json();
      const urls = pickBestTextureUrls(json, PREFERRED_TEXTURE_SIZES);
      if (!urls.diffuse) {
        return null;
      }

      const [diffuse, normal, roughness] = await Promise.all([
        loadTexture(textureLoader, urls.diffuse, true, maxAnisotropy),
        urls.normal ? loadTexture(textureLoader, urls.normal, false, maxAnisotropy) : null,
        urls.roughness ? loadTexture(textureLoader, urls.roughness, false, maxAnisotropy) : null
      ]);

      [diffuse, normal, roughness].filter(Boolean).forEach((tex) => normalizePbrTexture(tex, maxAnisotropy));

      return { diffuse, normal, roughness };
    } catch (error) {
      return null;
    }
  })();

  if (cache) {
    cache.set(key, promise);
    promise.catch(() => cache.delete(key));
  }
  return promise;
}

function applyTextureSetToModel(model, textureSet, fallbackTexture, maxAnisotropy = 1) {
  const normalizeTexture = (texture, isColor = false) => {
    if (!texture) return null;
    if (isColor) applySRGBColorSpace(texture);
    normalizePbrTexture(texture, maxAnisotropy);
    return texture;
  };

  const applyToMaterial = (material) => {
    if (!material) return;
    material.roughness = Math.max(material.roughness ?? 0.4, 0.4);
    material.metalness = Math.min(material.metalness ?? 0.4, 0.4);

    if (material.map) {
      normalizeTexture(material.map, true);
    } else if (textureSet?.diffuse) {
      material.map = normalizeTexture(textureSet.diffuse, true);
      material.needsUpdate = true;
    } else if (fallbackTexture) {
      material.map = normalizeTexture(fallbackTexture, true);
      material.needsUpdate = true;
    }

    if (material.emissiveMap) {
      normalizeTexture(material.emissiveMap, true);
    }

    if (!material.normalMap && textureSet?.normal) {
      material.normalMap = textureSet.normal;
    }
    if (material.normalMap) {
      normalizeTexture(material.normalMap, false);
    }

    if (!material.roughnessMap && textureSet?.roughness) {
      material.roughnessMap = textureSet.roughness;
    }
    normalizeTexture(material.roughnessMap, false);
  };

  model.traverse((obj) => {
    if (!obj.isMesh) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach(applyToMaterial);
  });
}

function prepareLoadedModel(model) {
  model.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((mat) => {
        if (!mat) return;
        if (mat.map) applySRGBColorSpace(mat.map);
        if (mat.emissiveMap) applySRGBColorSpace(mat.emissiveMap);
      });
    }
  });
}
const TARGET_CHAIR_SIZE = new THREE.Vector3(1.3162499970197679, 1.9173749900311232, 1.7001562547683715).multiplyScalar(
  CHAIR_SIZE_SCALE
);
const TARGET_CHAIR_MIN_Y = -0.8570624993294478 * CHAIR_SIZE_SCALE;
const TARGET_CHAIR_CENTER_Z = -0.1553906416893005 * CHAIR_SIZE_SCALE;

const DEFAULT_APPEARANCE = {
  outfit: 0,
  stools: 0,
  tables: 0,
  ...DEFAULT_TABLE_CUSTOMIZATION
};
const APPEARANCE_STORAGE_KEY = 'murlanRoyaleAppearance';
const FRAME_RATE_STORAGE_KEY = 'murlanFrameRate';
const CUSTOMIZATION_SECTIONS = [
  { key: 'tables', label: 'Table Model', options: TABLE_THEMES },
  { key: 'tableWood', label: 'Table Wood', options: TABLE_WOOD_OPTIONS },
  { key: 'tableCloth', label: 'Table Cloth', options: TABLE_CLOTH_OPTIONS },
  { key: 'tableBase', label: 'Table Base', options: TABLE_BASE_OPTIONS },
  { key: 'cards', label: 'Cards', options: CARD_THEMES },
  { key: 'stools', label: 'Stools', options: STOOL_THEMES }
];

function createRegularPolygonShape(sides = 8, radius = 1) {
  const shape = new THREE.Shape();
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    const x = Math.cos(a) * radius;
    const y = Math.sin(a) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

function normalizeAppearance(value = {}) {
  const normalized = { ...DEFAULT_APPEARANCE };
  const entries = [
    ['outfit', OUTFIT_THEMES.length],
    ['tableWood', TABLE_WOOD_OPTIONS.length],
    ['tableCloth', TABLE_CLOTH_OPTIONS.length],
    ['tableBase', TABLE_BASE_OPTIONS.length],
    ['cards', CARD_THEMES.length],
    ['stools', STOOL_THEMES.length],
    ['tables', TABLE_THEMES.length]
  ];
  entries.forEach(([key, max]) => {
    const raw = Number(value?.[key]);
    if (Number.isFinite(raw)) {
      const clamped = Math.min(Math.max(0, Math.round(raw)), max - 1);
      normalized[key] = clamped;
    }
  });
  const legacyTable = Number(value?.table);
  if (Number.isFinite(legacyTable)) {
    const legacyIndex = Math.min(
      Math.max(0, Math.round(legacyTable)),
      Math.min(TABLE_CLOTH_OPTIONS.length, TABLE_BASE_OPTIONS.length) - 1
    );
    if (!Number.isFinite(Number(value?.tableWood))) {
      normalized.tableWood = Math.min(legacyIndex, TABLE_WOOD_OPTIONS.length - 1);
    }
    if (!Number.isFinite(Number(value?.tableCloth))) {
      normalized.tableCloth = Math.min(legacyIndex, TABLE_CLOTH_OPTIONS.length - 1);
    }
    if (!Number.isFinite(Number(value?.tableBase))) {
      normalized.tableBase = Math.min(legacyIndex, TABLE_BASE_OPTIONS.length - 1);
    }
  }
  return normalized;
}

function fitChairModelToFootprint(model) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const targetMax = Math.max(TARGET_CHAIR_SIZE.x, TARGET_CHAIR_SIZE.y, TARGET_CHAIR_SIZE.z);
  const currentMax = Math.max(size.x, size.y, size.z);
  if (currentMax > 0) {
    const scale = targetMax / currentMax;
    model.scale.multiplyScalar(scale);
  }

  const scaledBox = new THREE.Box3().setFromObject(model);
  const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
  const offset = new THREE.Vector3(
    -scaledCenter.x,
    TARGET_CHAIR_MIN_Y - scaledBox.min.y,
    TARGET_CHAIR_CENTER_Z - scaledCenter.z
  );
  model.position.add(offset);
}

function extractChairMaterials(model) {
  const upholstery = new Set();
  const metal = new Set();
  model.traverse((obj) => {
    if (obj.isMesh) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((mat) => {
        if (!mat) return;
        if (mat.map) applySRGBColorSpace(mat.map);
        if (mat.emissiveMap) applySRGBColorSpace(mat.emissiveMap);
        const bucket = (mat.metalness ?? 0) > 0.35 ? metal : upholstery;
        bucket.add(mat);
      });
    }
  });
  const upholsteryArr = Array.from(upholstery);
  const metalArr = Array.from(metal);
  return {
    seat: upholsteryArr[0] ?? metalArr[0] ?? null,
    leg: metalArr[0] ?? upholsteryArr[0] ?? null,
    upholstery: upholsteryArr,
    metal: metalArr
  };
}

function disposeObjectResources(object) {
  const materials = new Set();
  object.traverse((obj) => {
    if (obj.isMesh) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((mat) => mat && materials.add(mat));
      obj.geometry?.dispose?.();
    }
  });
  materials.forEach((mat) => {
    if (mat?.map) mat.map.dispose?.();
    if (mat?.emissiveMap) mat.emissiveMap.dispose?.();
    mat?.dispose?.();
  });
}

function liftModelToGround(model, targetMinY = 0) {
  const box = new THREE.Box3().setFromObject(model);
  model.position.y += targetMinY - box.min.y;
}

function fitModelToHeight(model, targetHeight) {
  const box = new THREE.Box3().setFromObject(model);
  const currentHeight = box.max.y - box.min.y;
  if (currentHeight > 0) {
    const scale = targetHeight / currentHeight;
    model.scale.multiplyScalar(scale);
  }
  liftModelToGround(model, 0);
}

function fitTableModelToArena(model) {
  if (!model) return { surfaceY: TABLE_HEIGHT, radius: TABLE_RADIUS };
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const maxXZ = Math.max(size.x, size.z);
  const targetHeight = TABLE_MODEL_TARGET_HEIGHT;
  const targetDiameter = TABLE_MODEL_TARGET_DIAMETER;
  const targetRadius = targetDiameter / 2;
  const scaleY = size.y > 0 ? targetHeight / size.y : 1;
  const scaleXZ = maxXZ > 0 ? targetDiameter / maxXZ : 1;

  if (scaleY !== 1 || scaleXZ !== 1) {
    model.scale.set(
      model.scale.x * scaleXZ,
      model.scale.y * scaleY,
      model.scale.z * scaleXZ
    );
  }

  const scaledBox = new THREE.Box3().setFromObject(model);
  const center = scaledBox.getCenter(new THREE.Vector3());
  model.position.add(new THREE.Vector3(-center.x, -scaledBox.min.y, -center.z));

  const recenteredBox = new THREE.Box3().setFromObject(model);
  const surfaceOffset = targetHeight - recenteredBox.max.y;
  if (surfaceOffset !== 0) {
    model.position.y += surfaceOffset;
    recenteredBox.translate(new THREE.Vector3(0, surfaceOffset, 0));
  }

  const radius = Math.max(
    Math.abs(recenteredBox.max.x),
    Math.abs(recenteredBox.min.x),
    Math.abs(recenteredBox.max.z),
    Math.abs(recenteredBox.min.z),
    targetRadius
  );
  return {
    surfaceY: targetHeight,
    radius
  };
}

async function createPolyhavenInstance(
  assetId,
  targetHeight,
  rotationY = 0,
  renderer = null,
  textureOptions = {}
) {
  const root = await loadPolyhavenModel(assetId, renderer);
  const model = root.clone(true);
  prepareLoadedModel(model);
  const {
    textureLoader = null,
    maxAnisotropy = 1,
    fallbackTexture = null,
    textureCache = null,
    textureSet = null
  } = textureOptions || {};
  if (textureLoader) {
    try {
      const textures =
        textureSet ?? (await loadPolyhavenTextureSet(assetId, textureLoader, maxAnisotropy, textureCache));
      if (textures || fallbackTexture) {
        applyTextureSetToModel(model, textures, fallbackTexture, maxAnisotropy);
      }
    } catch (error) {
      if (fallbackTexture) {
        applyTextureSetToModel(model, null, fallbackTexture, maxAnisotropy);
      }
    }
  }
  fitModelToHeight(model, targetHeight);
  if (rotationY) model.rotation.y += rotationY;
  return model;
}

function buildPolyhavenModelUrls(assetId) {
  if (!assetId) return [];
  return [
    `https://dl.polyhaven.org/file/ph-assets/Models/gltf/2k/${assetId}/${assetId}_2k.gltf`,
    `https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/${assetId}/${assetId}_1k.gltf`
  ];
}

function shouldPreserveChairMaterials(theme) {
  return Boolean(theme?.preserveMaterials || theme?.source === 'polyhaven');
}

function createHallwayCeilingWallMaterial(textureLoader, maxAnisotropy = 1) {
  if (!textureLoader) {
    return createArenaWallMaterial('#0b1120', '#1e293b');
  }
  const ceilingTex = textureLoader.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r150/examples/textures/water.jpg');
  ceilingTex.wrapS = THREE.RepeatWrapping;
  ceilingTex.wrapT = THREE.RepeatWrapping;
  ceilingTex.repeat.set(4, 4);
  ceilingTex.colorSpace = THREE.SRGBColorSpace;
  ceilingTex.anisotropy = Math.max(ceilingTex.anisotropy ?? 1, maxAnisotropy);

  return new THREE.MeshStandardMaterial({
    color: '#fdf8ef',
    emissive: '#f0e8d0',
    emissiveIntensity: 0.4,
    metalness: 0.25,
    roughness: 0.15,
    map: ceilingTex
  });
}

const WALL_TEXTURE_CONFIG = {
  sourceId: 'white_planks_clean',
  fallbackColor: 0xdedede,
  repeat: new THREE.Vector2(1.875, 3.4),
  anisotropy: 12,
  preferredResolutionK: 4
};

const loadWallPlankTextures = (() => {
  let cache = null;
  let pending = null;

  const pickTextureUrls = (apiJson) => {
    const urls = [];
    const walk = (value) => {
      if (!value) return;
      if (typeof value === 'string') {
        const lower = value.toLowerCase();
        if (value.startsWith('http') && (lower.includes('.jpg') || lower.includes('.png'))) {
          urls.push(value);
        }
        return;
      }
      if (Array.isArray(value)) {
        value.forEach(walk);
        return;
      }
      if (typeof value === 'object') {
        Object.values(value).forEach(walk);
      }
    };
    walk(apiJson);
    const pickTexture = (candidateUrls, preferredResolutions) => {
      const lowerUrls = candidateUrls.map((u) => u.toLowerCase());
      for (const res of preferredResolutions) {
        const match = lowerUrls.find((u) => u.includes(`_${res}.`));
        if (match) return candidateUrls[lowerUrls.indexOf(match)];
      }
      return candidateUrls[0] ?? null;
    };
    const scoreAndPick = (keys) => {
      const candidates = [];
      keys.forEach((key) => {
        Object.entries(apiJson || {}).forEach(([k, v]) => {
          if (k.toLowerCase().includes(key)) candidates.push(v);
        });
      });
      const flat = [];
      const flatten = (v) => {
        if (!v) return;
        if (typeof v === 'string') {
          flat.push(v);
          return;
        }
        if (Array.isArray(v)) {
          v.forEach(flatten);
          return;
        }
        if (typeof v === 'object') {
          Object.values(v).forEach(flatten);
        }
      };
      flatten(candidates);
      return pickTexture(
        flat,
        WALL_TEXTURE_CONFIG.preferredResolutionK ? [`${WALL_TEXTURE_CONFIG.preferredResolutionK}k`, '4k', '2k'] : ['4k', '2k']
      );
    };
    return {
      diffuse: scoreAndPick(['diff', 'diffuse', 'albedo', 'basecolor']),
      normal: scoreAndPick(['nor_gl', 'normal_gl', 'nor', 'normal']),
      roughness: scoreAndPick(['rough', 'roughness'])
    };
  };

  const loadTexture = (loader, url, isColor) =>
    new Promise((resolve) => {
      if (!url) {
        resolve(null);
        return;
      }
      loader.load(
        url,
        (texture) => {
          if (isColor) {
            applySRGBColorSpace(texture);
          }
          resolve(texture);
        },
        undefined,
        () => resolve(null)
      );
    });

  return async (anisotropy) => {
    if (cache) return cache;
    if (!pending) {
      pending = (async () => {
        if (typeof fetch !== 'function') return null;
        try {
          const response = await fetch(`https://api.polyhaven.com/files/${WALL_TEXTURE_CONFIG.sourceId}`);
          if (!response?.ok) return null;
          const json = await response.json();
          const urls = pickTextureUrls(json);
          if (!urls.diffuse) return null;
          const loader = new THREE.TextureLoader();
          loader.setCrossOrigin('anonymous');
          const [map, normal, roughness] = await Promise.all([
            loadTexture(loader, urls.diffuse, true),
            loadTexture(loader, urls.normal, false),
            loadTexture(loader, urls.roughness, false)
          ]);
          [map, normal, roughness].forEach((tex) => {
            if (!tex) return;
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.anisotropy = Math.max(1, anisotropy ?? WALL_TEXTURE_CONFIG.anisotropy);
            tex.needsUpdate = true;
          });
          cache = { map, normal, roughness };
          return cache;
        } catch (err) {
          console.warn('Failed to load Poly Haven wall plank textures', err);
          return null;
        }
      })();
    }
    return pending;
  };
})();

async function applyPoolWallMaterial(material, { repeat, anisotropy, isCancelled } = {}) {
  if (!material || (typeof isCancelled === 'function' && isCancelled())) return null;
  const targetRepeat = new THREE.Vector2(
    repeat?.x ?? WALL_TEXTURE_CONFIG.repeat.x,
    repeat?.y ?? WALL_TEXTURE_CONFIG.repeat.y
  );
  const textures = await loadWallPlankTextures(anisotropy);
  if (!textures || (typeof isCancelled === 'function' && isCancelled())) return null;
  const applyRepeat = (tex) => {
    if (!tex) return;
    tex.repeat.copy(targetRepeat);
    tex.needsUpdate = true;
  };
  applyRepeat(textures.map);
  applyRepeat(textures.normal);
  applyRepeat(textures.roughness);
  material.map = textures.map ?? material.map;
  material.normalMap = textures.normal ?? material.normalMap;
  material.roughnessMap = textures.roughness ?? material.roughnessMap;
  material.color = new THREE.Color(0xffffff);
  material.roughness = 0.78;
  material.metalness = 0.03;
  material.needsUpdate = true;
  return textures;
}

function createConfiguredGLTFLoader(renderer = null, manager = undefined) {
  const loader = new GLTFLoader(manager);
  loader.setCrossOrigin?.('anonymous');

  const draco = new DRACOLoader();
  draco.setDecoderPath(DRACO_DECODER_PATH);
  loader.setDRACOLoader(draco);
  loader.setMeshoptDecoder?.(MeshoptDecoder);

  if (!sharedKtx2Loader) {
    sharedKtx2Loader = new KTX2Loader();
    sharedKtx2Loader.setTranscoderPath(BASIS_TRANSCODER_PATH);
  }

  if (renderer) {
    try {
      sharedKtx2Loader.detectSupport(renderer);
    } catch (error) {
      console.warn('Murlan KTX2 support detection failed', error);
    }
  }

  loader.setKTX2Loader(sharedKtx2Loader);
  return loader;
}

async function loadGltfChair(urls = CHAIR_MODEL_URLS, rotationY = 0, renderer = null) {
  const loader = createConfiguredGLTFLoader(renderer);

  let gltf = null;
  let lastError = null;
  for (const url of urls) {
    try {
      gltf = await loader.loadAsync(url);
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!gltf) {
    throw lastError || new Error('Failed to load chair model');
  }

  const model = gltf.scene || gltf.scenes?.[0];
  if (!model) {
    throw new Error('Chair model missing scene');
  }

  prepareLoadedModel(model);

  fitChairModelToFootprint(model);
  if (rotationY) {
    model.rotation.y += rotationY;
  }

  return {
    chairTemplate: model,
    materials: extractChairMaterials(model)
  };
}

async function loadPolyhavenModel(assetId, renderer = null) {
  if (!assetId) throw new Error('Missing Poly Haven asset id');
  const normalizedId = assetId.toLowerCase();
  const cacheKey = normalizedId;
  if (POLYHAVEN_MODEL_CACHE.has(cacheKey)) {
    return POLYHAVEN_MODEL_CACHE.get(cacheKey);
  }

  const promise = (async () => {
    let fileMap = new Map();
    const modelCandidates = new Set();
    const assetCandidates = Array.from(new Set([assetId, normalizedId]));

    for (const candidateId of assetCandidates) {
      try {
        const filesJson = await fetch(`https://api.polyhaven.com/files/${encodeURIComponent(candidateId)}`).then((r) => r.json());
        const allUrls = extractAllHttpUrls(filesJson);
        const apiModelUrl = pickBestModelUrl(allUrls);
        if (apiModelUrl) modelCandidates.add(apiModelUrl);
        if (!fileMap.size) {
          fileMap = allUrls.reduce((acc, u) => {
            const b = basename(stripQueryHash(u));
            if (!acc.has(b)) acc.set(b, u);
            return acc;
          }, new Map());
        }
      } catch (error) {
        console.warn('Poly Haven file lookup failed, falling back to direct URLs', error);
      }

      buildPolyhavenModelUrls(candidateId).forEach((u) => modelCandidates.add(u));
    }

    const modelUrlList = Array.from(modelCandidates);
    if (!modelUrlList.length) {
      throw new Error(`No model URL found for ${assetId}`);
    }

    const manager = fileMap.size ? new THREE.LoadingManager() : undefined;
    const loader = createConfiguredGLTFLoader(renderer, manager);

    if (fileMap.size) {
      const base = stripQueryHash(modelUrlList[0]);
      const baseDir = base.substring(0, base.lastIndexOf('/') + 1);
      loader.manager.setURLModifier((requestedUrl) => {
        if (/^https?:\/\//i.test(requestedUrl)) return requestedUrl;
        const req = stripQueryHash(requestedUrl);
        const b = basename(req);
        const mapped = fileMap.get(b);
        if (mapped) return mapped;
        try {
          return new URL(req, baseDir).toString();
        } catch {
          return requestedUrl;
        }
      });
    }

    let gltf = null;
    let lastError = null;
    for (const modelUrl of modelUrlList) {
      try {
        const resolvedUrl = new URL(modelUrl, typeof window !== 'undefined' ? window.location?.href : modelUrl).href;
        const resourcePath = resolvedUrl.substring(0, resolvedUrl.lastIndexOf('/') + 1);
        loader.setResourcePath?.(resourcePath);
        loader.setPath?.('');
        gltf = await loader.loadAsync(resolvedUrl);
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!gltf) {
      throw lastError || new Error(`Failed to load chair model for ${assetId}`);
    }

    const root = gltf.scene || gltf.scenes?.[0] || gltf;
    if (!root) {
      throw new Error(`Missing scene for ${assetId}`);
    }
    prepareLoadedModel(root);
    return root;
  })();

  POLYHAVEN_MODEL_CACHE.set(cacheKey, promise);
  promise.catch(() => POLYHAVEN_MODEL_CACHE.delete(cacheKey));
  return promise;
}

function createProceduralChair(theme) {
  const seatMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(theme?.seatColor || '#7c3aed'),
    roughness: 0.42,
    metalness: 0.18
  });
  const legMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(theme?.legColor || '#111827'),
    roughness: 0.55,
    metalness: 0.38
  });

  const chair = new THREE.Group();

  const seatMesh = new THREE.Mesh(new THREE.BoxGeometry(SEAT_WIDTH, SEAT_THICKNESS, SEAT_DEPTH), seatMaterial);
  seatMesh.position.y = SEAT_THICKNESS / 2;
  seatMesh.castShadow = true;
  seatMesh.receiveShadow = true;
  chair.add(seatMesh);

  const backMesh = new THREE.Mesh(
    new THREE.BoxGeometry(SEAT_WIDTH * 0.96, BACK_HEIGHT, BACK_THICKNESS),
    seatMaterial
  );
  backMesh.position.set(0, SEAT_THICKNESS / 2 + BACK_HEIGHT / 2, -SEAT_DEPTH / 2 + BACK_THICKNESS / 2);
  backMesh.castShadow = true;
  backMesh.receiveShadow = true;
  chair.add(backMesh);

  const armGeometry = new THREE.BoxGeometry(ARM_THICKNESS, ARM_HEIGHT, ARM_DEPTH);
  const armOffsetX = SEAT_WIDTH / 2 - ARM_THICKNESS / 2;
  const armOffsetY = SEAT_THICKNESS / 2 + ARM_HEIGHT / 2;
  const armOffsetZ = -ARM_DEPTH / 2 + ARM_THICKNESS * 0.2;
  const leftArm = new THREE.Mesh(armGeometry, seatMaterial);
  leftArm.position.set(-armOffsetX, armOffsetY, armOffsetZ);
  leftArm.castShadow = true;
  leftArm.receiveShadow = true;
  chair.add(leftArm);
  const rightArm = new THREE.Mesh(armGeometry, seatMaterial);
  rightArm.position.set(armOffsetX, armOffsetY, armOffsetZ);
  rightArm.castShadow = true;
  rightArm.receiveShadow = true;
  chair.add(rightArm);

  const legMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16 * MODEL_SCALE * STOOL_SCALE, 0.2 * MODEL_SCALE * STOOL_SCALE, BASE_COLUMN_HEIGHT, 18),
    legMaterial
  );
  legMesh.position.y = -SEAT_THICKNESS / 2 - BASE_COLUMN_HEIGHT / 2;
  legMesh.castShadow = true;
  legMesh.receiveShadow = true;
  chair.add(legMesh);

  const foot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32 * MODEL_SCALE * STOOL_SCALE, 0.32 * MODEL_SCALE * STOOL_SCALE, 0.08 * MODEL_SCALE, 24),
    legMaterial
  );
  foot.position.y = legMesh.position.y - BASE_COLUMN_HEIGHT / 2 - 0.04 * MODEL_SCALE;
  foot.castShadow = true;
  foot.receiveShadow = true;
  chair.add(foot);

  return {
    chairTemplate: chair,
    materials: {
      seat: seatMaterial,
      leg: legMaterial,
      upholstery: [seatMaterial],
      metal: [legMaterial]
    },
    preserveOriginal: false
  };
}

async function buildChairTemplate(theme, renderer = null, textureOptions = {}) {
  const rotationY = theme?.modelRotation || 0;
  const preserveMaterials = shouldPreserveChairMaterials(theme);
  const {
    textureLoader = null,
    maxAnisotropy = 1,
    fallbackTexture = null,
    textureCache = null
  } = textureOptions || {};
  try {
    if (theme?.source === 'polyhaven' && theme?.assetId) {
      const polyhavenRoot = await loadPolyhavenModel(theme.assetId, renderer);
      const model = polyhavenRoot.clone(true);
      prepareLoadedModel(model);
      if (textureLoader) {
        try {
          const textures = await loadPolyhavenTextureSet(
            theme.assetId,
            textureLoader,
            maxAnisotropy,
            textureCache
          );
          if (textures || fallbackTexture) {
            applyTextureSetToModel(model, textures, fallbackTexture, maxAnisotropy);
          }
        } catch (error) {
          if (fallbackTexture) {
            applyTextureSetToModel(model, null, fallbackTexture, maxAnisotropy);
          }
        }
      }
      fitChairModelToFootprint(model);
      if (rotationY) model.rotation.y += rotationY;
      const materials = extractChairMaterials(model);
      if (!preserveMaterials) {
        applyChairThemeMaterials({ chairMaterials: materials }, theme);
      }
      return { chairTemplate: model, materials, preserveOriginal: preserveMaterials };
    }
    if (theme?.source === 'gltf' && Array.isArray(theme.urls) && theme.urls.length) {
      const gltfChair = await loadGltfChair(theme.urls, rotationY, renderer);
      if (!preserveMaterials) {
        applyChairThemeMaterials({ chairMaterials: gltfChair.materials }, theme);
      }
      return { ...gltfChair, preserveOriginal: preserveMaterials };
    }
    const gltfChair = await loadGltfChair(CHAIR_MODEL_URLS, rotationY, renderer);
    if (!preserveMaterials) {
      applyChairThemeMaterials({ chairMaterials: gltfChair.materials }, theme);
    }
    return { ...gltfChair, preserveOriginal: preserveMaterials };
  } catch (error) {
    console.error('Falling back to procedural chair', error);
  }
  return createProceduralChair(theme);
}

const STOOL_SCALE = 1.5 * 1.3 * CHAIR_SIZE_SCALE;
const CARD_SCALE = 0.92;
const CARD_W = 0.4 * MODEL_SCALE * CARD_SCALE;
const CARD_H = 0.56 * MODEL_SCALE * CARD_SCALE;
const CARD_D = 0.02 * MODEL_SCALE * CARD_SCALE;
const CARD_SURFACE_OFFSET = CARD_D * 4;
const SEAT_WIDTH = 0.9 * MODEL_SCALE * STOOL_SCALE;
const SEAT_DEPTH = 0.95 * MODEL_SCALE * STOOL_SCALE;
const SEAT_THICKNESS = 0.09 * MODEL_SCALE * STOOL_SCALE;
const BACK_HEIGHT = 0.68 * MODEL_SCALE * STOOL_SCALE;
const BACK_THICKNESS = 0.08 * MODEL_SCALE * STOOL_SCALE;
const ARM_THICKNESS = 0.125 * MODEL_SCALE * STOOL_SCALE;
const ARM_HEIGHT = 0.3 * MODEL_SCALE * STOOL_SCALE;
const ARM_DEPTH = SEAT_DEPTH * 0.75;
const BASE_COLUMN_HEIGHT = 0.5 * MODEL_SCALE * STOOL_SCALE;
const BASE_TABLE_HEIGHT = 1.08 * MODEL_SCALE;
const BASE_HUMAN_CHAIR_RADIUS = 4.8 * MODEL_SCALE * ARENA_GROWTH * 0.72 * CHAIR_SIZE_SCALE;
const HUMAN_CHAIR_PULLBACK = 0;
const CHAIR_RADIUS = BASE_HUMAN_CHAIR_RADIUS + HUMAN_CHAIR_PULLBACK;
const CHAIR_BASE_HEIGHT = BASE_TABLE_HEIGHT - SEAT_THICKNESS * 0.85;
const STOOL_HEIGHT = CHAIR_BASE_HEIGHT + SEAT_THICKNESS;
const TABLE_HEIGHT_LIFT = 0.05 * MODEL_SCALE;
const TABLE_HEIGHT = STOOL_HEIGHT + TABLE_HEIGHT_LIFT;
const TABLE_MODEL_TARGET_DIAMETER = TABLE_RADIUS * 2;
const TABLE_MODEL_TARGET_HEIGHT = TABLE_HEIGHT;
const TABLE_HEIGHT_RAISE = TABLE_HEIGHT - BASE_TABLE_HEIGHT;
const ARENA_WALL_HEIGHT = 3.6 * 1.3;
const ARENA_WALL_CENTER_Y = ARENA_WALL_HEIGHT / 2;
const ARENA_WALL_TOP_Y = ARENA_WALL_CENTER_Y + ARENA_WALL_HEIGHT / 2;
const CAMERA_WALL_HEIGHT_MARGIN = 0.1 * MODEL_SCALE;
const HUMAN_SELECTION_OFFSET = 0.14 * MODEL_SCALE;
const CARD_ANIMATION_DURATION = 420;
const FRAME_TIME_CATCH_UP_MULTIPLIER = 3;
const CAMERA_WALL_PADDING = 0.9 * MODEL_SCALE;
const AI_TURN_DELAY = 2000;

const PLAYER_COLORS = ['#f97316', '#38bdf8', '#a78bfa', '#22c55e'];
const FALLBACK_SEAT_POSITIONS = [
  { left: '50%', top: '78%' },
  { left: '80%', top: '50%' },
  { left: '20%', top: '50%' },
  { left: '50%', top: '22%' }
];

const clampValue = (value, min, max) => Math.min(Math.max(value, min), max);

const FRAME_RATE_OPTIONS = Object.freeze([
  {
    id: 'hd50',
    label: 'HD Performance (50 Hz)',
    fps: 50,
    renderScale: 1,
    pixelRatioCap: 1.4,
    resolution: 'HD render • DPR 1.4 cap',
    description: 'Minimum HD output for battery saver and 50–60 Hz displays.'
  },
  {
    id: 'fhd60',
    label: 'Full HD (60 Hz)',
    fps: 60,
    renderScale: 1.1,
    pixelRatioCap: 1.5,
    resolution: 'Full HD render • DPR 1.5 cap',
    description: '1080p-focused profile that mirrors the Snooker frame pacing.'
  },
  {
    id: 'qhd90',
    label: 'Quad HD (90 Hz)',
    fps: 90,
    renderScale: 1.25,
    pixelRatioCap: 1.7,
    resolution: 'QHD render • DPR 1.7 cap',
    description: 'Sharper 1440p render for capable 90 Hz mobile and desktop GPUs.'
  },
  {
    id: 'uhd120',
    label: 'Ultra HD (120 Hz)',
    fps: 120,
    renderScale: 1.35,
    pixelRatioCap: 2,
    resolution: 'Ultra HD render • DPR 2.0 cap',
    description: '4K-oriented profile for 120 Hz flagships and desktops.'
  },
  {
    id: 'ultra144',
    label: 'Ultra HD+ (144 Hz)',
    fps: 144,
    renderScale: 1.5,
    pixelRatioCap: 2.2,
    resolution: 'Ultra HD+ render • DPR 2.2 cap',
    description: 'Maximum clarity preset that prioritizes UHD detail at 144 Hz.'
  }
]);
const DEFAULT_FRAME_RATE_ID = 'fhd60';

const GAME_CONFIG = { ...BASE_CONFIG };
const START_CARD = { rank: '3', suit: '♠' };

export default function MurlanRoyaleArena({ search }) {
  const mountRef = useRef(null);
  const players = useMemo(() => buildPlayers(search), [search]);

  const [murlanInventory, setMurlanInventory] = useState(() => getMurlanInventory(murlanAccountId()));

  const [appearance, setAppearance] = useState(() => {
    if (typeof window === 'undefined') return { ...DEFAULT_APPEARANCE };
    try {
      const stored = window.localStorage?.getItem(APPEARANCE_STORAGE_KEY);
      if (!stored) return { ...DEFAULT_APPEARANCE };
      const parsed = JSON.parse(stored);
      return normalizeAppearance(parsed);
    } catch (error) {
      console.warn('Failed to load appearance', error);
      return { ...DEFAULT_APPEARANCE };
    }
  });
  const appearanceRef = useRef(appearance);
  const [configOpen, setConfigOpen] = useState(false);

  const [gameState, setGameState] = useState(() => initializeGame(players));
  const [selectedIds, setSelectedIds] = useState([]);
  const [uiState, setUiState] = useState(() => computeUiState(gameState));
  const [actionError, setActionError] = useState('');
  const [threeReady, setThreeReady] = useState(false);
  const [seatAnchors, setSeatAnchors] = useState([]);
  const seatAnchorMap = useMemo(() => {
    const map = new Map();
    seatAnchors.forEach((anchor) => {
      if (anchor && typeof anchor.index === 'number') map.set(anchor.index, anchor);
    });
    return map;
  }, [seatAnchors]);

  const customizationSections = useMemo(
    () =>
      CUSTOMIZATION_SECTIONS.map((section) => ({
        ...section,
        options: section.options
          .map((option, idx) => ({ ...option, idx }))
          .filter(({ id }) => isMurlanOptionUnlocked(section.key, id, murlanInventory))
      })).filter((section) => section.options.length > 0),
    [murlanInventory]
  );
  const [frameRateId, setFrameRateId] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage?.getItem(FRAME_RATE_STORAGE_KEY);
      if (stored && FRAME_RATE_OPTIONS.some((opt) => opt.id === stored)) {
        return stored;
      }
      const detected = detectPreferredFrameRateId();
      if (detected && FRAME_RATE_OPTIONS.some((opt) => opt.id === detected)) {
        return detected;
      }
    }
    return DEFAULT_FRAME_RATE_ID;
  });
  const activeFrameRateOption = useMemo(
    () => FRAME_RATE_OPTIONS.find((opt) => opt.id === frameRateId) ?? FRAME_RATE_OPTIONS[0],
    [frameRateId]
  );
  const frameQualityProfile = useMemo(() => {
    const option = activeFrameRateOption ?? FRAME_RATE_OPTIONS[0];
    const fallback = FRAME_RATE_OPTIONS[0];
    const fps =
      Number.isFinite(option?.fps) && option.fps > 0
        ? option.fps
        : Number.isFinite(fallback?.fps) && fallback.fps > 0
          ? fallback.fps
          : 60;
    const renderScale =
      typeof option?.renderScale === 'number' && Number.isFinite(option.renderScale)
        ? THREE.MathUtils.clamp(option.renderScale, 1, 1.6)
        : 1;
    const pixelRatioCap =
      typeof option?.pixelRatioCap === 'number' && Number.isFinite(option.pixelRatioCap)
        ? Math.max(1, option.pixelRatioCap)
        : resolveDefaultPixelRatioCap();
    return {
      id: option?.id ?? DEFAULT_FRAME_RATE_ID,
      fps,
      renderScale,
      pixelRatioCap
    };
  }, [activeFrameRateOption]);
  const frameQualityRef = useRef(frameQualityProfile);
  useEffect(() => {
    frameQualityRef.current = frameQualityProfile;
  }, [frameQualityProfile]);
  const resolvedFrameTiming = useMemo(() => {
    const fallbackFps =
      Number.isFinite(FRAME_RATE_OPTIONS[0]?.fps) && FRAME_RATE_OPTIONS[0].fps > 0
        ? FRAME_RATE_OPTIONS[0].fps
        : 60;
    const fps =
      Number.isFinite(frameQualityProfile?.fps) && frameQualityProfile.fps > 0
        ? frameQualityProfile.fps
        : fallbackFps;
    const targetMs = 1000 / fps;
    return {
      id: frameQualityProfile?.id ?? FRAME_RATE_OPTIONS[0]?.id ?? DEFAULT_FRAME_RATE_ID,
      fps,
      targetMs,
      maxMs: targetMs * FRAME_TIME_CATCH_UP_MULTIPLIER
    };
  }, [frameQualityProfile]);
  const frameTimingRef = useRef(resolvedFrameTiming);
  useEffect(() => {
    frameTimingRef.current = resolvedFrameTiming;
  }, [resolvedFrameTiming]);

  const ensureAppearanceUnlocked = useCallback(
    (value = DEFAULT_APPEARANCE) => {
      const normalized = normalizeAppearance(value);
      const map = {
        tableWood: TABLE_WOOD_OPTIONS,
        tableCloth: TABLE_CLOTH_OPTIONS,
        tableBase: TABLE_BASE_OPTIONS,
        cards: CARD_THEMES,
        stools: STOOL_THEMES,
        tables: TABLE_THEMES
      };
      let changed = false;
      const next = { ...normalized };
      Object.entries(map).forEach(([key, options]) => {
        const idx = Number.isFinite(next[key]) ? next[key] : 0;
        const option = options[idx];
        if (!option || !isMurlanOptionUnlocked(key, option.id, murlanInventory)) {
          const fallbackIdx = options.findIndex((opt) => isMurlanOptionUnlocked(key, opt.id, murlanInventory));
          const safeIdx = fallbackIdx >= 0 ? fallbackIdx : 0;
          if (safeIdx !== idx) {
            next[key] = safeIdx;
            changed = true;
          }
        }
      });
      return changed ? next : normalized;
    },
    [murlanInventory]
  );

  useEffect(() => {
    const handler = (event) => {
      if (!event?.detail?.accountId || event.detail.accountId === murlanAccountId()) {
        setMurlanInventory(getMurlanInventory(murlanAccountId()));
      }
    };
    window.addEventListener('murlanInventoryUpdate', handler);
    return () => window.removeEventListener('murlanInventoryUpdate', handler);
  }, []);

  useEffect(() => {
    setAppearance((prev) => ensureAppearanceUnlocked(prev));
  }, [ensureAppearanceUnlocked]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage?.setItem(FRAME_RATE_STORAGE_KEY, frameRateId);
    } catch (error) {
      console.warn('Failed to persist frame rate option', error);
    }
  }, [frameRateId]);

  const gameStateRef = useRef(gameState);
  const selectedRef = useRef(selectedIds);
  const humanTurnRef = useRef(false);

  const threeStateRef = useRef({
    renderer: null,
    scene: null,
    camera: null,
    controls: null,
    textureLoader: null,
    textureCache: new Map(),
    maxAnisotropy: 1,
    fallbackTexture: null,
    arena: null,
    cardGeometry: null,
    cardMap: new Map(),
    faceTextureCache: new Map(),
    seatConfigs: [],
    selectionTargets: [],
    animations: [],
    raycaster: new THREE.Raycaster(),
    tableAnchor: new THREE.Vector3(0, TABLE_HEIGHT + CARD_SURFACE_OFFSET, 0),
    discardAnchor: new THREE.Vector3(-TABLE_RADIUS * 0.76, TABLE_HEIGHT - CARD_H * 0.3, -TABLE_RADIUS * 0.62),
    scoreboard: null,
    tableInfo: null,
    tableThemeId: null,
    chairMaterials: null,
    chairTemplate: null,
    chairThemePreserve: false,
    chairThemeId: null,
    chairInstances: [],
    decorPlants: [],
    decorGroup: null,
    outfitParts: [],
    cardThemeId: '',
    appearance: { ...DEFAULT_APPEARANCE }
  });
  const soundsRef = useRef({ card: null, turn: null });
  const audioStateRef = useRef({ tableIds: [], activePlayer: null, status: null, initialized: false });
  const prevStateRef = useRef(null);
  const tableBuildTokenRef = useRef(0);

  const ensureCardMeshes = useCallback((state) => {
    const three = threeStateRef.current;
    if (!three.arena || !three.cardGeometry) return;
    const theme = CARD_THEMES[appearanceRef.current.cards] ?? CARD_THEMES[0];
    three.cardThemeId = theme.id;
    state.allCards.forEach((card) => {
      if (three.cardMap.has(card.id)) return;
      const mesh = createCardMesh(card, three.cardGeometry, three.faceTextureCache, theme);
      mesh.visible = false;
      mesh.position.set(0, -10, 0);
      three.arena.add(mesh);
      three.cardMap.set(card.id, { mesh });
    });
  }, []);

  const updateSeatAnchors = useCallback(() => {
    const store = threeStateRef.current;
    const { camera, seatConfigs } = store;
    const mount = mountRef.current;
    if (!camera || !seatConfigs?.length || !mount) return;
    const rect = mount.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const anchors = seatConfigs.map((seat, index) => {
      const stool = seat.stoolPosition ? seat.stoolPosition.clone() : new THREE.Vector3();
      stool.y = seat.stoolHeight ?? CHAIR_BASE_HEIGHT;
      const projected = stool.clone().project(camera);
      const x = clampValue(((projected.x + 1) / 2) * 100, -10, 110);
      const y = clampValue(((1 - projected.y) / 2) * 100, -10, 110);
      const depth = stool.distanceTo(camera.position);
      return { index, x, y, depth };
    });

    setSeatAnchors(anchors);
  }, []);

  const applyRendererQuality = useCallback(() => {
    const renderer = threeStateRef.current.renderer;
    const host = mountRef.current;
    if (!renderer || !host) return;
    const quality = frameQualityRef.current;
    const dpr =
      typeof window !== 'undefined' && typeof window.devicePixelRatio === 'number'
        ? window.devicePixelRatio
        : 1;
    const pixelRatioCap =
      quality?.pixelRatioCap ??
      (typeof window !== 'undefined' ? resolveDefaultPixelRatioCap() : 2);
    const renderScale =
      typeof quality?.renderScale === 'number' && Number.isFinite(quality.renderScale)
        ? THREE.MathUtils.clamp(quality.renderScale, 1, 1.6)
        : 1;
    renderer.setPixelRatio(Math.min(pixelRatioCap, dpr));
    renderer.setSize(host.clientWidth * renderScale, host.clientHeight * renderScale, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
  }, []);

  useEffect(() => {
    applyRendererQuality();
  }, [applyRendererQuality, frameQualityProfile]);

  const updateScoreboardDisplay = useCallback((entries = []) => {
    const store = threeStateRef.current;
    const scoreboard = store.scoreboard;
    if (!scoreboard?.context || !scoreboard.texture || !scoreboard.mesh || !scoreboard.canvas) return;
    const { canvas, context, texture, mesh } = scoreboard;
    const { width, height } = canvas;

    context.clearRect(0, 0, width, height);

    if (!entries?.length) {
      mesh.visible = false;
      texture.needsUpdate = true;
      return;
    }

    mesh.visible = true;
    context.save();
    const padding = 36;
    const innerWidth = width - padding * 2;
    context.fillStyle = 'rgba(8, 12, 24, 0.82)';
    context.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    context.lineWidth = 12;
    roundRect(context, padding, padding, innerWidth, height - padding * 2, 48);
    context.fill();
    context.stroke();
    context.clip();

    context.textAlign = 'left';
    context.textBaseline = 'alphabetic';
    context.fillStyle = 'rgba(226, 232, 240, 0.82)';
    context.font = '700 64px "Inter", "Segoe UI", sans-serif';
    context.fillText('Results', padding + 24, 120);
    context.font = '500 28px "Inter", "Segoe UI", sans-serif';
    context.fillStyle = 'rgba(148, 163, 184, 0.8)';
    context.fillText('Cards remaining', padding + 24, 160);

    const rowHeight = 76;
    const rowGap = 12;
    const rowWidth = innerWidth - 48;
    const rowX = padding + 24;
    const maxRows = Math.min(entries.length, 4);

    for (let i = 0; i < maxRows; i += 1) {
      const entry = entries[i];
      const rowY = 168 + i * (rowHeight + rowGap);
      const isActive = Boolean(entry?.isActive);
      const finished = Boolean(entry?.finished);
      const displayName = typeof entry?.name === 'string' ? entry.name : 'Player';
      const trimmedName = displayName.trim();
      const fallbackInitial = trimmedName ? trimmedName.charAt(0).toUpperCase() : '🂠';
      const avatar = entry?.avatar && !entry.avatar.startsWith('http') ? entry.avatar : fallbackInitial;

      context.fillStyle = isActive ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.08)';
      roundRect(context, rowX, rowY, rowWidth, rowHeight, 28);
      context.fill();
      context.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      context.lineWidth = 4;
      roundRect(context, rowX, rowY, rowWidth, rowHeight, 28);
      context.stroke();

      context.textBaseline = 'middle';
      context.textAlign = 'left';
      context.font = '700 60px "Inter", "Segoe UI", sans-serif';
      context.fillStyle = '#f8fafc';
      context.fillText(avatar, rowX + 36, rowY + rowHeight / 2);

      context.save();
      context.beginPath();
      context.rect(rowX + 110, rowY + 18, rowWidth - 220, rowHeight - 36);
      context.clip();
      context.font = '600 40px "Inter", "Segoe UI", sans-serif';
      context.fillStyle = '#e2e8f0';
      context.fillText(displayName, rowX + 110, rowY + rowHeight / 2);
      context.restore();

      context.textAlign = 'right';
      context.font = '700 42px "Inter", "Segoe UI", sans-serif';
      context.fillStyle = finished ? '#4ade80' : '#f1f5f9';
      const scoreLabel = finished ? '🏁' : String(entry?.cardsLeft ?? 0);
      context.fillText(scoreLabel, rowX + rowWidth - 32, rowY + rowHeight / 2);
    }

    context.restore();
    texture.needsUpdate = true;
  }, []);


  const applyStateToScene = useCallback((state, selection, immediate = false) => {
    const three = threeStateRef.current;
    if (!three.scene) return;

    const selectionSet = new Set(selection);
    const handsVisible = new Set();
    const tableSet = new Set(state.tableCards.map((card) => card.id));
    const discardSet = new Set(state.discardPile.map((card) => card.id));

    const seatConfigs = three.seatConfigs;
    const cardMap = three.cardMap;

    const humanTurn = state.status === 'PLAYING' && state.players[state.activePlayer]?.isHuman;
    humanTurnRef.current = humanTurn;

    const humanMeshes = [];

    state.players.forEach((player, idx) => {
      const seat = seatConfigs[idx];
      if (!seat) return;
      const cards = player.hand;
      const baseHeight = TABLE_HEIGHT + CARD_H / 2 + (player.isHuman ? 0.06 * MODEL_SCALE : 0);
      const forward = seat.forward;
      const right = seat.right;
      const radius = seat.radius;
      const focus = seat.focus;
      const spacing = seat.spacing;
      const maxSpread = seat.maxSpread;
      const spread = cards.length > 1 ? Math.min((cards.length - 1) * spacing, maxSpread) : 0;
      cards.forEach((card, cardIdx) => {
        const entry = cardMap.get(card.id);
        if (!entry) return;
        const mesh = entry.mesh;
        mesh.visible = true;
        updateCardFace(mesh, player.isHuman ? 'front' : 'back');
        handsVisible.add(card.id);
        const offset = cards.length > 1 ? cardIdx - (cards.length - 1) / 2 : 0;
        const lateral = cards.length > 1 ? (offset * spread) / (cards.length - 1 || 1) : 0;
        const target = forward.clone().multiplyScalar(radius).addScaledVector(right, lateral);
        target.y = baseHeight + (player.isHuman ? 0 : 0.02 * Math.abs(offset));
        if (player.isHuman && selectionSet.has(card.id)) target.y += HUMAN_SELECTION_OFFSET;
        setMeshPosition(
          mesh,
          target,
          focus,
          { face: player.isHuman ? 'front' : 'back' },
          immediate,
          three.animations
        );
        mesh.userData.cardId = card.id;
        if (player.isHuman) humanMeshes.push(mesh);
      });
    });

    const tableAnchor = three.tableAnchor.clone();
    const tableCount = state.tableCards.length;
    const tableSpacing =
      tableCount > 1 ? Math.min(CARD_W * 1.28, (CARD_W * 5.2) / (tableCount - 1)) : CARD_W;
    const tableStartX = tableCount > 1 ? -((tableCount - 1) * tableSpacing) / 2 : 0;
    const humanIndex = state.players.findIndex((player) => player.isHuman);
    const humanSeat = humanIndex >= 0 ? seatConfigs[humanIndex] : null;
    const tableLookBase = humanSeat
      ? tableAnchor
          .clone()
          .add(humanSeat.forward.clone().multiplyScalar(1.15 * MODEL_SCALE))
          .setY(tableAnchor.y + 0.32 * MODEL_SCALE)
      : tableAnchor.clone().setY(tableAnchor.y + 0.32 * MODEL_SCALE);
    state.tableCards.forEach((card, idx) => {
      const entry = cardMap.get(card.id);
      if (!entry) return;
      const mesh = entry.mesh;
      mesh.visible = true;
      updateCardFace(mesh, 'front');
      const target = tableAnchor.clone();
      target.x += tableStartX + idx * tableSpacing;
      target.y += 0.06 * MODEL_SCALE + idx * 0.014;
      target.z += (idx - (tableCount - 1) / 2) * 0.06;
      const lookTarget = tableLookBase.clone();
      setMeshPosition(
        mesh,
        target,
        lookTarget,
        { face: 'front' },
        immediate,
        three.animations
      );
    });

    const discardBase = three.discardAnchor.clone();
    state.discardPile.forEach((card, idx) => {
      const entry = cardMap.get(card.id);
      if (!entry) return;
      const mesh = entry.mesh;
      mesh.visible = true;
      updateCardFace(mesh, 'front');
      const row = Math.floor(idx / 12);
      const col = idx % 12;
      const target = discardBase.clone();
      target.x += (col - 5.5) * CARD_W * 0.4;
      target.z += row * CARD_W * 0.32;
      target.y -= row * 0.05;
      setMeshPosition(
        mesh,
        target,
        target.clone().setY(target.y + 0.1),
        { face: 'front', flat: true },
        immediate,
        three.animations
      );
    });

    three.cardMap.forEach(({ mesh }, id) => {
      if (handsVisible.has(id) || tableSet.has(id) || discardSet.has(id)) return;
      mesh.visible = false;
      if (mesh.userData?.animation) {
        mesh.userData.animation.cancelled = true;
        mesh.userData.animation = null;
      }
    });

    three.selectionTargets = humanTurn ? humanMeshes : [];
    if (three.renderer?.domElement) {
      three.renderer.domElement.style.cursor = humanTurn ? 'pointer' : 'default';
    }
  }, []);

  const rebuildTable = useCallback(
    async (tableTheme, woodOption, clothOption, baseOption) => {
      const three = threeStateRef.current;
      if (!three?.arena || !three.renderer) return null;
      const token = ++tableBuildTokenRef.current;
      if (three.tableInfo) {
        three.tableInfo.dispose?.();
        three.tableInfo = null;
      }

      const theme = tableTheme || TABLE_THEMES[0];
      let tableInfo = null;

      if (theme?.source === 'polyhaven' && theme?.assetId) {
        try {
          const model = await createPolyhavenInstance(
            theme.assetId,
            TABLE_MODEL_TARGET_HEIGHT,
            theme.rotationY || 0,
            three.renderer,
            {
              textureLoader: three.textureLoader,
              maxAnisotropy: three.maxAnisotropy,
              fallbackTexture: three.fallbackTexture,
              textureCache: three.textureCache
            }
          );
          if (tableBuildTokenRef.current === token && model) {
            const tableGroup = new THREE.Group();
            tableGroup.add(model);
            const { surfaceY, radius } = fitTableModelToArena(tableGroup);
            three.arena.add(tableGroup);
            tableInfo = {
              group: tableGroup,
              surfaceY,
              tableHeight: surfaceY,
              radius,
              dispose: () => {
                disposeObjectResources(tableGroup);
                if (tableGroup.parent) tableGroup.parent.remove(tableGroup);
              },
              materials: null,
              shapeId: theme.id,
              rotationY: theme.rotationY ?? 0,
              themeId: theme.id
            };
          }
        } catch (error) {
          console.warn('Failed to load Poly Haven table', error);
        }
      }

      if (!tableInfo) {
        const procedural = createMurlanStyleTable({
          arena: three.arena,
          renderer: three.renderer,
          tableRadius: TABLE_RADIUS,
          tableHeight: TABLE_HEIGHT,
          woodOption,
          clothOption,
          baseOption
        });
        applyTableMaterials(procedural.materials, { woodOption, clothOption, baseOption }, three.renderer);
        tableInfo = { ...procedural, themeId: theme?.id || 'murlan-default' };
      }

      if (tableBuildTokenRef.current !== token) {
        tableInfo.dispose?.();
        return null;
      }

      three.tableInfo = tableInfo;
      three.tableThemeId = theme?.id || 'murlan-default';
      three.tableAnchor = new THREE.Vector3(0, tableInfo.surfaceY + CARD_SURFACE_OFFSET, 0);
      three.discardAnchor = new THREE.Vector3(
        -TABLE_RADIUS * 0.76,
        tableInfo.surfaceY - CARD_H * 0.3,
        -TABLE_RADIUS * 0.62
      );
      return tableInfo;
    },
    []
  );

  const rebuildChairs = useCallback(
    async (stoolTheme) => {
      if (!threeReady) return;
      const safe = stoolTheme || STOOL_THEMES[0];
      const store = threeStateRef.current;
      const chairBuild = await buildChairTemplate(safe, store.renderer, {
        textureLoader: store.textureLoader,
        maxAnisotropy: store.maxAnisotropy,
        fallbackTexture: store.fallbackTexture,
        textureCache: store.textureCache
      });
      const currentAppearance = normalizeAppearance(appearanceRef.current);
      const expectedTheme = STOOL_THEMES[currentAppearance.stools] ?? STOOL_THEMES[0];
      if (expectedTheme.id !== safe.id) return;
      if (store.chairMaterials) {
        const mats = new Set([
          store.chairMaterials.seat,
          store.chairMaterials.leg,
          ...(store.chairMaterials.upholstery ?? []),
          ...(store.chairMaterials.metal ?? [])
        ]);
        mats.forEach((mat) => mat?.dispose?.());
      }
      if (store.chairTemplate) {
        disposeObjectResources(store.chairTemplate);
      }
      store.chairTemplate = chairBuild.chairTemplate;
      store.chairMaterials = chairBuild.materials;
      store.chairThemePreserve = chairBuild.preserveOriginal ?? shouldPreserveChairMaterials(safe);
      store.chairThemeId = safe.id;
      applyChairThemeMaterials(store, safe);

      store.chairInstances.forEach((chair) => {
        const previous = chair?.userData?.chairModel;
        if (previous) {
          disposeObjectResources(previous);
          chair.remove(previous);
        }
        const clone = chairBuild.chairTemplate.clone(true);
        chair.add(clone);
        chair.userData.chairModel = clone;
      });
    },
    [threeReady]
  );

  const updateSceneAppearance = useCallback(
    (nextAppearance, { refreshCards = false } = {}) => {
      if (!threeReady) return;
      const safe = normalizeAppearance(nextAppearance);
      const woodOption = TABLE_WOOD_OPTIONS[safe.tableWood] ?? TABLE_WOOD_OPTIONS[0];
      const clothOption = TABLE_CLOTH_OPTIONS[safe.tableCloth] ?? TABLE_CLOTH_OPTIONS[0];
      const baseOption = TABLE_BASE_OPTIONS[safe.tableBase] ?? TABLE_BASE_OPTIONS[0];
      const stoolTheme = STOOL_THEMES[safe.stools] ?? STOOL_THEMES[0];
      const outfitTheme = OUTFIT_THEMES[safe.outfit] ?? OUTFIT_THEMES[0];
      const cardTheme = CARD_THEMES[safe.cards] ?? CARD_THEMES[0];
      const tableTheme = TABLE_THEMES[safe.tables] ?? TABLE_THEMES[0];

      void (async () => {
        const three = threeStateRef.current;
        if (!three.scene) return;
        const tableChanged = three.tableThemeId !== tableTheme.id || !three.tableInfo;
        if (tableChanged) {
          await rebuildTable(tableTheme, woodOption, clothOption, baseOption);
        } else if (three.tableInfo?.materials) {
          applyTableMaterials(three.tableInfo.materials, { woodOption, clothOption, baseOption }, three.renderer);
        }

        const preserveRequested = shouldPreserveChairMaterials(stoolTheme);
        if (three.chairThemePreserve == null) {
          three.chairThemePreserve = preserveRequested;
        }
        if (three.chairThemeId !== stoolTheme.id) {
          three.chairThemePreserve = preserveRequested;
          void rebuildChairs(stoolTheme);
        } else {
          applyChairThemeMaterials(three, stoolTheme);
        }
        applyOutfitThemeMaterials(three, outfitTheme);

        const shouldRefreshCards = refreshCards || three.appearance?.cards !== safe.cards;
        applyCardThemeMaterials(three, cardTheme, shouldRefreshCards);

        three.appearance = { ...safe };

        ensureCardMeshes(gameStateRef.current);
        applyStateToScene(gameStateRef.current, selectedRef.current, true);
      })();
    },
    [applyStateToScene, ensureCardMeshes, rebuildChairs, rebuildTable, threeReady]
  );

  const renderPreview = useCallback((type, option) => {
    switch (type) {
      case 'tables': {
        const thumb = option?.thumbnail;
        return (
          <div className="relative h-14 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950/60">
            {thumb ? (
              <img src={thumb} alt={option?.label || 'Table model'} className="h-full w-full object-cover opacity-80" loading="lazy" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-100/80">
                {option?.label || 'Table'}
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-br from-black/30 via-transparent to-black/50" />
            <div className="absolute bottom-1 left-1 rounded-md bg-black/60 px-2 py-0.5 text-[0.55rem] font-semibold uppercase tracking-wide text-emerald-100/80">
              {(option?.label || 'Table').slice(0, 22)}
            </div>
          </div>
        );
      }
      case 'tableWood': {
        const presetId = option?.presetId;
        const grainId = option?.grainId;
        const preset = (presetId && WOOD_PRESETS_BY_ID[presetId]) || WOOD_FINISH_PRESETS[0];
        const grain = (grainId && WOOD_GRAIN_OPTIONS_BY_ID[grainId]) || WOOD_GRAIN_OPTIONS[0];
        const baseHex = `#${hslToHexNumber(preset.hue, preset.sat, preset.light)
          .toString(16)
          .padStart(6, '0')}`;
        const accentHex = `#${hslToHexNumber(preset.hue, Math.min(1, preset.sat + 0.12), Math.max(0, preset.light - 0.18))
          .toString(16)
          .padStart(6, '0')}`;
        const grainLabel = grain?.label ?? '';
        return (
          <div className="relative h-14 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950/40">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `repeating-linear-gradient(135deg, ${baseHex}, ${baseHex} 12%, ${accentHex} 12%, ${accentHex} 20%)`
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/40" />
            <div className="absolute bottom-1 right-1 rounded-full bg-black/60 px-2 py-0.5 text-[0.55rem] font-semibold uppercase tracking-wide text-emerald-100/80">
              {grainLabel.slice(0, 10)}
            </div>
          </div>
        );
      }
      case 'tableCloth':
        return (
          <div className="relative h-14 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950/40">
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="h-12 w-20 rounded-[999px] border border-white/10"
                style={{
                  background: `radial-gradient(circle at 35% 30%, ${option.feltTop}, ${option.feltBottom})`
                }}
              />
            </div>
            <div className="absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-black/50 to-transparent" />
          </div>
        );
      case 'tableBase':
        return (
          <div className="relative h-14 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950/40">
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <div className="h-3 w-16 rounded-full" style={{ background: option.trimColor }} />
              <div className="h-4 w-20 rounded-full" style={{ background: option.baseColor }} />
              <div
                className="absolute bottom-2 h-3 w-14 rounded-full opacity-80"
                style={{ background: option.columnColor }}
              />
            </div>
          </div>
        );
      case 'cards':
        return (
          <div className="flex items-center justify-center gap-2">
            <div
              className="h-12 w-8 rounded-md border"
              style={{
                background: option.frontBackground,
                borderColor: option.frontBorder || '#e5e7eb'
              }}
            />
            <div
              className="h-12 w-8 rounded-md border border-white/10"
              style={{
                backgroundImage: `linear-gradient(135deg, ${
                  option.backGradient?.[0] ?? option.backColor
                }, ${option.backGradient?.[1] ?? option.backColor})`,
                boxShadow: `0 0 0 2px ${option.backAccent || 'rgba(255,255,255,0.25)'} inset`
              }}
            />
          </div>
        );
      case 'stools':
        return (
          <div className="relative flex h-12 w-full items-center justify-center rounded-xl border border-white/10 bg-slate-950/50 overflow-hidden">
            {option.thumbnail ? (
              <img
                src={option.thumbnail}
                alt={option.label}
                className="h-full w-full object-cover opacity-90"
                loading="lazy"
              />
            ) : (
              <>
                <div className="h-6 w-12 rounded-md" style={{ background: option.seatColor }} />
                <div
                  className="absolute bottom-1 h-2 w-14 rounded-full opacity-80"
                  style={{ background: option.legColor }}
                />
              </>
            )}
          </div>
        );
      case 'outfit':
      default:
        return (
          <div className="relative flex h-12 w-full items-center justify-center">
            <div className="relative h-12 w-12 rounded-full" style={{ background: option.baseColor }}>
              <div
                className="absolute inset-1 rounded-full border-2"
                style={{ borderColor: option.accentColor }}
              />
              <div
                className="absolute left-1/2 top-1/2 h-4 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ background: option.accentColor }}
              />
            </div>
          </div>
        );
    }
  }, []);

  useEffect(() => {
    prevStateRef.current = gameState;
    gameStateRef.current = gameState;
    setUiState(computeUiState(gameState));
    if (!threeReady) return;

    applyStateToScene(gameState, selectedRef.current);
  }, [gameState, threeReady, applyStateToScene]);

  useEffect(() => {
    selectedRef.current = selectedIds;
    if (threeReady) {
      applyStateToScene(gameStateRef.current, selectedIds);
    }
  }, [selectedIds, threeReady, applyStateToScene]);

  useEffect(() => {
    if (threeReady) {
      updateSeatAnchors();
    }
  }, [threeReady, updateSeatAnchors]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return undefined;
    const card = new Audio('/assets/sounds/flipcard-91468.mp3');
    const turn = new Audio('/assets/sounds/wooden-door-knock-102902.mp3');
    card.preload = 'auto';
    turn.preload = 'auto';
    card.volume = 0.55;
    turn.volume = 0.55;
    soundsRef.current = { card, turn };
    return () => {
      [card, turn].forEach((audio) => {
        if (!audio) return;
        audio.pause();
        audio.src = '';
      });
      soundsRef.current = { card: null, turn: null };
    };
  }, []);

  useEffect(() => {
    const prev = audioStateRef.current;
    const tableIds = gameState.tableCards.map((card) => card.id);
    const hasNewTableCards =
      prev.initialized &&
      (tableIds.length > prev.tableIds.length ||
        tableIds.some((id, index) => id !== prev.tableIds[index]));
    if (hasNewTableCards && tableIds.length) {
      const cardSound = soundsRef.current.card;
      if (cardSound) {
        try {
          cardSound.currentTime = 0;
          void cardSound.play();
        } catch (error) {
          // ignore playback errors (autoplay restrictions)
        }
      }
    }
    const activeChanged = prev.initialized && prev.activePlayer !== gameState.activePlayer;
    if (activeChanged && gameState.status === 'PLAYING') {
      const turnSound = soundsRef.current.turn;
      if (turnSound) {
        try {
          turnSound.currentTime = 0;
          void turnSound.play();
        } catch (error) {
          // ignore playback errors
        }
      }
    }
    audioStateRef.current = {
      tableIds,
      activePlayer: gameState.activePlayer,
      status: gameState.status,
      initialized: true
    };
  }, [gameState]);

  useEffect(() => {
    appearanceRef.current = appearance;
    if (typeof window !== 'undefined') {
      try {
        window.localStorage?.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(appearance));
      } catch (error) {
        console.warn('Failed to persist appearance', error);
      }
    }
    const previous = threeStateRef.current.appearance;
    const cardChanged = previous?.cards !== appearance.cards;
    updateSceneAppearance(appearance, { refreshCards: cardChanged });
  }, [appearance, updateSceneAppearance]);

  useEffect(() => {
    if (!threeReady) return;
    updateSceneAppearance(appearanceRef.current, { refreshCards: true });
  }, [threeReady, updateSceneAppearance]);

  useEffect(() => {
    if (!threeReady) return;
    updateScoreboardDisplay(uiState.scoreboard);
  }, [threeReady, uiState.scoreboard, updateScoreboardDisplay]);

  const toggleSelection = useCallback((cardId) => {
    setSelectedIds((prev) => {
      if (!humanTurnRef.current) return prev;
      const human = gameStateRef.current.players.find((p) => p.isHuman);
      if (!human || !human.hand.some((card) => card.id === cardId)) return prev;
      if (prev.includes(cardId)) {
        return prev.filter((id) => id !== cardId);
      }
      return [...prev, cardId];
    });
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    let renderer = null;
    let scene = null;
    let camera = null;
    let controls = null;
    let observer = null;
    let frameId = null;
    let dom = null;
    let cardGeometry = null;
    let arenaGroup = null;
    let handlePointerDown = null;
    let disposed = false;
    let lastRenderTime = performance.now();

    const setup = async () => {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
      applyRendererSRGB(renderer);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.85;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.display = 'block';
      mount.appendChild(renderer.domElement);
      dom = renderer.domElement;
      threeStateRef.current.renderer = renderer;
      const textureLoader = new THREE.TextureLoader();
      textureLoader.setCrossOrigin?.('anonymous');
      const maxAnisotropy = renderer.capabilities.getMaxAnisotropy?.() ?? 1;
      const fallbackTexture = textureLoader.load(
        'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r150/examples/textures/uv_grid_opengl.jpg'
      );
      applySRGBColorSpace(fallbackTexture);
      fallbackTexture.wrapS = THREE.RepeatWrapping;
      fallbackTexture.wrapT = THREE.RepeatWrapping;
      fallbackTexture.repeat.set(1.6, 1.6);
      fallbackTexture.anisotropy = maxAnisotropy;
      threeStateRef.current.textureLoader = textureLoader;
      threeStateRef.current.textureCache = new Map();
      threeStateRef.current.maxAnisotropy = maxAnisotropy;
      threeStateRef.current.fallbackTexture = fallbackTexture;
      applyRendererQuality();

      scene = new THREE.Scene();
      scene.background = new THREE.Color('#030712');

      const ambient = new THREE.AmbientLight(0xffffff, 0.35);
      scene.add(ambient);

      const key = new THREE.DirectionalLight(0xffffff, 1.2);
      key.position.set(6, 8, 5);
      key.castShadow = true;
      scene.add(key);

      const fill = new THREE.DirectionalLight(0xffffff, 0.65);
      fill.position.set(-5, 5.5, 3);
      scene.add(fill);

      const rim = new THREE.DirectionalLight(0xffffff, 0.9);
      rim.position.set(0, 6, -6);
      scene.add(rim);

      const spot = new THREE.SpotLight(0xffffff, 0.8, 0, Math.PI / 4, 0.35, 1.1);
      spot.position.set(0, 4.2, 4.6);
      scene.add(spot);
      const spotTarget = new THREE.Object3D();
      spotTarget.position.set(0, TABLE_HEIGHT + 0.2 * MODEL_SCALE, 0);
      scene.add(spotTarget);
      spot.target = spotTarget;

      arenaGroup = new THREE.Group();
      scene.add(arenaGroup);

      const currentAppearance = normalizeAppearance(appearanceRef.current);
      const woodOption =
        TABLE_WOOD_OPTIONS[currentAppearance.tableWood] ?? TABLE_WOOD_OPTIONS[0];
      const clothOption =
        TABLE_CLOTH_OPTIONS[currentAppearance.tableCloth] ?? TABLE_CLOTH_OPTIONS[0];
      const baseOption =
        TABLE_BASE_OPTIONS[currentAppearance.tableBase] ?? TABLE_BASE_OPTIONS[0];
      const stoolTheme = STOOL_THEMES[currentAppearance.stools] ?? STOOL_THEMES[0];
      const tableTheme = TABLE_THEMES[currentAppearance.tables] ?? TABLE_THEMES[0];
      const outfitTheme = OUTFIT_THEMES[currentAppearance.outfit] ?? OUTFIT_THEMES[0];

      const arenaScale = 1.3 * ARENA_GROWTH;
      const boardSize = (TABLE_RADIUS * 2 + 1.2 * MODEL_SCALE) * arenaScale;
      const camConfig = buildArenaCameraConfig(boardSize);
      const wallThickness = 0.8 * MODEL_SCALE;
      const interiorWidth = Math.max(TABLE_RADIUS * ARENA_GROWTH * 3.6, CHAIR_RADIUS * 2 + 4 * MODEL_SCALE);
      const interiorDepth = interiorWidth;
      const roomWidth = interiorWidth + wallThickness * 2;
      const roomDepth = interiorDepth + wallThickness * 2;
      const halfWidth = roomWidth / 2;
      const halfDepth = roomDepth / 2;
      const innerHalfWidth = interiorWidth / 2;
      const innerHalfDepth = interiorDepth / 2;

      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(roomWidth, roomDepth),
        new THREE.MeshStandardMaterial({ color: 0x0b1120, roughness: 0.9, metalness: 0.1 })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      arenaGroup.add(floor);

      const carpet = new THREE.Mesh(
        new THREE.PlaneGeometry(interiorWidth * 0.9, interiorDepth * 0.9),
        createArenaCarpetMaterial(new THREE.Color('#0f172a'), new THREE.Color('#1e3a8a'))
      );
      carpet.rotation.x = -Math.PI / 2;
      carpet.position.y = 0.01;
      carpet.receiveShadow = true;
      arenaGroup.add(carpet);

      const wallMaterial = new THREE.MeshStandardMaterial({
        color: WALL_TEXTURE_CONFIG.fallbackColor,
        roughness: 0.78,
        metalness: 0.03,
        flatShading: true
      });
      void applyPoolWallMaterial(wallMaterial, {
        repeat: new THREE.Vector2(
          Math.max(WALL_TEXTURE_CONFIG.repeat.x, roomWidth / 160),
          Math.max(WALL_TEXTURE_CONFIG.repeat.y, ARENA_WALL_HEIGHT / 40)
        ),
        anisotropy: maxAnisotropy,
        isCancelled: () => disposed
      });

      const makeWall = (width, depth, position) => {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(width, ARENA_WALL_HEIGHT, depth), wallMaterial);
        wall.castShadow = false;
        wall.receiveShadow = true;
        wall.position.set(position.x, ARENA_WALL_CENTER_Y, position.z);
        arenaGroup.add(wall);
        return wall;
      };

      makeWall(roomWidth, wallThickness, { x: 0, z: halfDepth - wallThickness / 2 });
      makeWall(roomWidth, wallThickness, { x: 0, z: -halfDepth + wallThickness / 2 });
      makeWall(wallThickness, roomDepth, { x: -halfWidth + wallThickness / 2, z: 0 });
      makeWall(wallThickness, roomDepth, { x: halfWidth - wallThickness / 2, z: 0 });

      const ceilingMaterial = createHallwayCeilingWallMaterial(textureLoader, maxAnisotropy);
      ceilingMaterial.side = THREE.DoubleSide;
      const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, roomDepth), ceilingMaterial);
      ceiling.rotation.x = Math.PI / 2;
      ceiling.position.y = ARENA_WALL_HEIGHT;
      ceiling.receiveShadow = false;
      arenaGroup.add(ceiling);

      const cameraBoundRadius = Math.hypot(innerHalfWidth, innerHalfDepth) - CAMERA_WALL_PADDING;

      const decorGroup = new THREE.Group();
      arenaGroup.add(decorGroup);
      threeStateRef.current.decorGroup = decorGroup;
      threeStateRef.current.decorPlants = [];
      const addCornerPlants = async () => {
        try {
          const plantTextures = new Map(
            (
              await Promise.all(
                HALLWAY_PLANT_ASSETS.map(async (assetId) => {
                  const textures = await loadPolyhavenTextureSet(
                    assetId,
                    textureLoader,
                    maxAnisotropy,
                    threeStateRef.current.textureCache
                  );
                  return [assetId, textures];
                })
              )
            ).filter((entry) => entry[1])
          );
          const plantPadding = Math.max(0.8 * MODEL_SCALE, wallThickness * 1.1);
          const cornerOffsets = [
            new THREE.Vector3(innerHalfWidth - plantPadding, 0, innerHalfDepth - plantPadding),
            new THREE.Vector3(-(innerHalfWidth - plantPadding), 0, innerHalfDepth - plantPadding),
            new THREE.Vector3(innerHalfWidth - plantPadding, 0, -(innerHalfDepth - plantPadding)),
            new THREE.Vector3(-(innerHalfWidth - plantPadding), 0, -(innerHalfDepth - plantPadding))
          ];
          const targetOffsets = cornerOffsets.slice(0, DECOR_PLANT_COUNT);
          for (let i = 0; i < targetOffsets.length; i += 1) {
            const assetId = HALLWAY_PLANT_ASSETS[0];
            const plant = await createPolyhavenInstance(assetId, PLANT_TARGET_HEIGHT, 0, renderer, {
              textureLoader,
              maxAnisotropy,
              fallbackTexture,
              textureCache: threeStateRef.current.textureCache,
              textureSet: plantTextures.get(assetId)
            });
            if (disposed) return;
            plant.scale.multiplyScalar(HALLWAY_PLANT_SCALE);
            const pos = targetOffsets[i];
            plant.position.copy(pos);
            plant.lookAt(new THREE.Vector3(0, plant.position.y + 0.1, 0));
            decorGroup.add(plant);
            threeStateRef.current.decorPlants.push(plant);
          }
        } catch (error) {
          console.warn('Failed to load decor plants', error);
        }
      };
      void addCornerPlants();

      const scoreboardCanvas = document.createElement('canvas');
      scoreboardCanvas.width = 1024;
      scoreboardCanvas.height = 512;
      const scoreboardContext = scoreboardCanvas.getContext('2d');
      if (scoreboardContext) {
        const scoreboardTexture = new THREE.CanvasTexture(scoreboardCanvas);
        applySRGBColorSpace(scoreboardTexture);
        scoreboardTexture.anisotropy = 8;
        const scoreboardMaterial = new THREE.MeshBasicMaterial({
          map: scoreboardTexture,
          transparent: true,
          toneMapped: false,
          depthWrite: false
        });
        const scoreboardWidth = Math.min(innerHalfWidth * 0.9, 4.4 * MODEL_SCALE);
        const scoreboardHeight = scoreboardWidth * 0.42;
        const scoreboardGeometry = new THREE.PlaneGeometry(scoreboardWidth, scoreboardHeight);
        const scoreboardMesh = new THREE.Mesh(scoreboardGeometry, scoreboardMaterial);
        scoreboardMesh.position.set(0, ARENA_WALL_HEIGHT * 0.6, -innerHalfDepth + wallThickness * 0.6);
        scoreboardMesh.lookAt(new THREE.Vector3(0, scoreboardMesh.position.y, 0));
        scoreboardMesh.renderOrder = 2;
        scoreboardMesh.visible = false;
        arenaGroup.add(scoreboardMesh);
        threeStateRef.current.scoreboard = {
          canvas: scoreboardCanvas,
          context: scoreboardContext,
          texture: scoreboardTexture,
          material: scoreboardMaterial,
          geometry: scoreboardGeometry,
          mesh: scoreboardMesh
        };
      } else {
        threeStateRef.current.scoreboard = null;
      }

      const buildHallwayDoor = () => {
        const woodTex = textureLoader.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r150/examples/textures/wood/mahogany_diffuse.jpg');
        applySRGBColorSpace(woodTex);
        woodTex.wrapS = THREE.RepeatWrapping;
        woodTex.wrapT = THREE.RepeatWrapping;
        woodTex.anisotropy = maxAnisotropy;

        const handleTex = textureLoader.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r150/examples/textures/metal/Brass_Albedo.jpg');
        applySRGBColorSpace(handleTex);

        const doorMat = new THREE.MeshStandardMaterial({
          map: woodTex,
          color: '#0a0a0f',
          roughness: 0.3,
          metalness: 0.25
        });
        const handleMat = new THREE.MeshStandardMaterial({
          map: handleTex,
          color: '#ffd700',
          metalness: 1,
          roughness: 0.1
        });
        const frameMat = new THREE.MeshStandardMaterial({
          color: '#d7b56b',
          metalness: 0.9,
          roughness: 0.18,
          emissive: '#a2752a',
          emissiveIntensity: 0.08
        });
        const doorGroup = new THREE.Group();
        const frame = new THREE.Mesh(new THREE.BoxGeometry(4.6, 5.2, 0.25), frameMat);
        frame.castShadow = true;
        frame.receiveShadow = true;
        doorGroup.add(frame);

        const doorMatGeometry = new THREE.BoxGeometry(2, 4.8, 0.12);
        const leftDoor = new THREE.Mesh(doorMatGeometry, doorMat);
        const rightDoor = new THREE.Mesh(doorMatGeometry, doorMat);
        leftDoor.position.set(-1.05, 0, 0.12);
        rightDoor.position.set(1.05, 0, 0.12);
        const handleGeom = new THREE.CylinderGeometry(0.07, 0.07, 0.4, 32);
        const leftHandle = new THREE.Mesh(handleGeom, handleMat);
        const rightHandle = new THREE.Mesh(handleGeom, handleMat);
        leftHandle.rotation.z = Math.PI / 2;
        rightHandle.rotation.z = Math.PI / 2;
        leftHandle.position.set(0.85, 0, 0.16);
        rightHandle.position.set(-0.85, 0, 0.16);
        leftDoor.add(leftHandle);
        rightDoor.add(rightHandle);
        [leftDoor, rightDoor].forEach((mesh) => {
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        });
        [leftHandle, rightHandle].forEach((mesh) => {
          mesh.castShadow = true;
          mesh.receiveShadow = false;
        });
        doorGroup.add(leftDoor);
        doorGroup.add(rightDoor);

        const frameHeight = 5.2;
        return { doorGroup, frameHeight };
      };

      const { doorGroup, frameHeight } = buildHallwayDoor();
      const doorScale = Math.min(1, (ARENA_WALL_HEIGHT * 0.92) / frameHeight);
      doorGroup.scale.setScalar(doorScale);
      doorGroup.position.set(0, (frameHeight * doorScale) / 2, innerHalfDepth - wallThickness * 0.55);
      doorGroup.rotation.y = Math.PI;
      decorGroup.add(doorGroup);

      updateScoreboardDisplay(computeUiState(gameStateRef.current).scoreboard);

      await rebuildTable(tableTheme, woodOption, clothOption, baseOption);
      if (disposed) return;

      const chairBuild = await buildChairTemplate(stoolTheme, renderer, {
        textureLoader,
        maxAnisotropy,
        fallbackTexture,
        textureCache: threeStateRef.current.textureCache
      });
      if (disposed) return;
      const chairTemplate = chairBuild.chairTemplate;
      threeStateRef.current.chairTemplate = chairTemplate;
      threeStateRef.current.chairMaterials = chairBuild.materials;
      threeStateRef.current.chairThemePreserve =
        chairBuild.preserveOriginal ?? shouldPreserveChairMaterials(stoolTheme);
      threeStateRef.current.chairThemeId = stoolTheme.id;
      applyChairThemeMaterials(threeStateRef.current, stoolTheme);

      const chairRadius = CHAIR_RADIUS;
      const seatThickness = SEAT_THICKNESS;

      cardGeometry = new THREE.BoxGeometry(CARD_W, CARD_H, CARD_D, 1, 1, 1);

      const seatConfigs = [];
      threeStateRef.current.chairInstances = [];

      for (let i = 0; i < CHAIR_COUNT; i++) {
        const player = players[i] ?? null;
        const chair = new THREE.Group();
        const chairModel = chairTemplate.clone(true);
        chair.add(chairModel);
        chair.userData.chairModel = chairModel;
        threeStateRef.current.chairInstances.push(chair);

        const angle = CUSTOM_SEAT_ANGLES[i] ?? Math.PI / 2 - (i / CHAIR_COUNT) * Math.PI * 2;
        const isHumanSeat = Boolean(player?.isHuman);
        const seatRadius = chairRadius - (isHumanSeat ? 0.55 * MODEL_SCALE : 0.24 * MODEL_SCALE);
        const x = Math.cos(angle) * seatRadius;
        const z = Math.sin(angle) * seatRadius;
        const chairBaseHeight = CHAIR_BASE_HEIGHT;
        chair.position.set(x, chairBaseHeight, z);
        chair.lookAt(new THREE.Vector3(0, chairBaseHeight, 0));
        arenaGroup.add(chair);

        const forward = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
        const right = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));
        const focus = forward
          .clone()
          .multiplyScalar(seatRadius - (isHumanSeat ? 1.05 * MODEL_SCALE : 0.65 * MODEL_SCALE));
        focus.y = TABLE_HEIGHT + CARD_H * (isHumanSeat ? 0.72 : 0.55);
        const stoolPosition = forward.clone().multiplyScalar(seatRadius - 0.08 * MODEL_SCALE);
        stoolPosition.y = CHAIR_BASE_HEIGHT + SEAT_THICKNESS / 2;
        const stoolHeight = STOOL_HEIGHT;
        seatConfigs.push({
          forward,
          right,
          focus,
          radius: (isHumanSeat ? 2.7 : 3.25) * MODEL_SCALE,
          spacing: (isHumanSeat ? 0.12 : 0.16) * MODEL_SCALE,
          maxSpread: (isHumanSeat ? 2.1 : 2.3) * MODEL_SCALE,
          stoolPosition,
          stoolHeight
        });

      }

      const humanSeatIndex = players.findIndex((player) => player?.isHuman);
      const humanSeatConfig = humanSeatIndex >= 0 ? seatConfigs[humanSeatIndex] : null;

      threeStateRef.current.outfitParts = [];
      threeStateRef.current.appearance = { ...currentAppearance };

      spotTarget.position.set(0, TABLE_HEIGHT + 0.2 * MODEL_SCALE, 0);
      spot.target.updateMatrixWorld();

      const isPortrait = mount.clientHeight > mount.clientWidth;
      camera = new THREE.PerspectiveCamera(
        camConfig.fov,
        mount.clientWidth / mount.clientHeight,
        camConfig.near,
        camConfig.far
      );
      const targetHeightOffset = 0.08 * MODEL_SCALE;
      let target = new THREE.Vector3(0, TABLE_HEIGHT + targetHeightOffset, 0);
      let initialCameraPosition;
      if (humanSeatConfig) {
        const humanSeatAngle = Math.atan2(humanSeatConfig.forward.z, humanSeatConfig.forward.x);
        const stoolAnchor = humanSeatConfig.stoolPosition?.clone() ??
          new THREE.Vector3(
            Math.cos(humanSeatAngle) * chairRadius,
            TABLE_HEIGHT,
            Math.sin(humanSeatAngle) * chairRadius
          );
        const stoolHeight = humanSeatConfig.stoolHeight ?? TABLE_HEIGHT + seatThickness / 2;
        const retreatOffset = isPortrait ? 1.95 : 1.45;
        const elevation = isPortrait ? 1.95 : 1.58;
        initialCameraPosition = stoolAnchor.addScaledVector(humanSeatConfig.forward, -retreatOffset);
        initialCameraPosition.y = stoolHeight + elevation;
        target = new THREE.Vector3(0, TABLE_HEIGHT + targetHeightOffset + 0.12 * MODEL_SCALE, 0);
      } else {
        const humanSeatAngle = Math.PI / 2;
        const cameraBackOffset = isPortrait ? 1.65 : 1.05;
        const cameraForwardOffset = isPortrait ? 0.18 : 0.35;
        const cameraHeightOffset = isPortrait ? 1.46 : 1.12;
        initialCameraPosition = new THREE.Vector3(
          Math.cos(humanSeatAngle) * (chairRadius + cameraBackOffset - cameraForwardOffset),
          TABLE_HEIGHT + cameraHeightOffset,
          Math.sin(humanSeatAngle) * (chairRadius + cameraBackOffset - cameraForwardOffset)
        );
      }
      const initialOffset = initialCameraPosition.clone().sub(target);
      const spherical = new THREE.Spherical().setFromVector3(initialOffset);
      const safeHorizontalReach = Math.max(2.6 * MODEL_SCALE, cameraBoundRadius);
      const maxOrbitRadius = Math.max(3.6 * MODEL_SCALE, safeHorizontalReach / Math.sin(ARENA_CAMERA_DEFAULTS.phiMax));
      const minOrbitRadius = Math.max(2.4 * MODEL_SCALE, maxOrbitRadius * 0.55);
      const desiredRadius = THREE.MathUtils.clamp(spherical.radius * 1.05, minOrbitRadius, maxOrbitRadius);
      spherical.radius = desiredRadius;
      spherical.phi = THREE.MathUtils.clamp(
        spherical.phi,
        ARENA_CAMERA_DEFAULTS.phiMin,
        ARENA_CAMERA_DEFAULTS.phiMax
      );
      const nextPosition = new THREE.Vector3().setFromSpherical(spherical).add(target);
      camera.position.copy(nextPosition);
      camera.lookAt(target);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.enablePan = true;
      controls.enableZoom = true;
      controls.enableRotate = true;
      controls.minPolarAngle = ARENA_CAMERA_DEFAULTS.phiMin;
      controls.maxPolarAngle = ARENA_CAMERA_DEFAULTS.phiMax;
      controls.minAzimuthAngle = -Infinity;
      controls.maxAzimuthAngle = Infinity;
      controls.minDistance = minOrbitRadius;
      controls.maxDistance = maxOrbitRadius;
      controls.rotateSpeed = 0.6;
      controls.target.copy(target);
      controls.update();
      controls.addEventListener('change', updateSeatAnchors);

      const resize = () => {
        applyRendererQuality();
        const { clientWidth, clientHeight } = mount;
        const aspect = clientHeight > 0 ? clientWidth / clientHeight : 1;
        camera.aspect = aspect;
        camera.updateProjectionMatrix();
        updateSeatAnchors();
      };

      observer = new ResizeObserver(resize);
      observer.observe(mount);
      resize();

      const stepAnimations = (time) => {
        const store = threeStateRef.current;
        const list = store.animations;
        if (!list?.length) return;
        store.animations = list.filter((anim) => {
          if (anim.cancelled) return false;
          const progress = Math.min(1, (time - anim.start) / anim.duration);
          const eased = easeOutCubic(progress);
          anim.mesh.position.lerpVectors(anim.from, anim.to, eased);
          orientMesh(anim.mesh, anim.lookTarget, anim.orientation);
          if (progress >= 1) {
            anim.mesh.position.copy(anim.to);
            orientMesh(anim.mesh, anim.lookTarget, anim.orientation);
            anim.mesh.userData.animation = null;
            return false;
          }
          return true;
        });
      };

      const animate = (time) => {
        const frameTiming = frameTimingRef.current;
        const targetFrameTime = frameTiming?.targetMs ?? 1000 / 60;
        const maxFrameTime =
          frameTiming?.maxMs ?? targetFrameTime * FRAME_TIME_CATCH_UP_MULTIPLIER;
        const delta = time - lastRenderTime;
        if (delta >= targetFrameTime - 0.5) {
          const appliedDelta = Math.min(delta, maxFrameTime);
          lastRenderTime = time - Math.max(0, delta - appliedDelta);
          stepAnimations(time);
          controls.update();
          renderer.render(scene, camera);
        }
        frameId = requestAnimationFrame(animate);
      };

      frameId = requestAnimationFrame(animate);

      threeStateRef.current.renderer = renderer;
      threeStateRef.current.scene = scene;
      threeStateRef.current.camera = camera;
      threeStateRef.current.controls = controls;
      threeStateRef.current.arena = arenaGroup;
      threeStateRef.current.cardGeometry = cardGeometry;
      threeStateRef.current.seatConfigs = seatConfigs;

      ensureCardMeshes(gameStateRef.current);
      applyStateToScene(gameStateRef.current, selectedRef.current, true);
      updateSeatAnchors();
      setThreeReady(true);

      handlePointerDown = (event) => {
        if (!humanTurnRef.current) return;
        const rect = dom.getBoundingClientRect();
        const pointer = new THREE.Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
        threeStateRef.current.raycaster.setFromCamera(pointer, camera);
        const intersects = threeStateRef.current.raycaster.intersectObjects(threeStateRef.current.selectionTargets, false);
        if (!intersects.length) return;
        const picked = intersects[0].object;
        const cardId = picked.userData.cardId || picked.parent?.userData.cardId;
        if (cardId) toggleSelection(cardId);
      };
      dom.addEventListener('pointerdown', handlePointerDown);
    };

    setup().catch((error) => console.error('Failed to set up Murlan Royale arena', error));

    return () => {
      disposed = true;
      const store = threeStateRef.current;
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
      observer?.disconnect?.();
      controls?.removeEventListener('change', updateSeatAnchors);
      controls?.dispose?.();
      if (dom && handlePointerDown) {
        dom.removeEventListener('pointerdown', handlePointerDown);
      }
      if (mount && dom && dom.parentElement === mount) {
        mount.removeChild(dom);
      }
      renderer?.dispose?.();
      cardGeometry?.dispose?.();
      store.cardMap.forEach(({ mesh }) => {
        const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const mats = new Set(list.filter(Boolean));
        const { frontMaterial, backMaterial, hiddenMaterial } = mesh.userData ?? {};
        [frontMaterial, backMaterial, hiddenMaterial].forEach((mat) => {
          if (mat) mats.add(mat);
        });
        mats.forEach((mat) => {
          if (typeof mat.dispose === 'function') {
            mat.dispose();
          }
        });
        arenaGroup?.remove(mesh);
      });
      store.faceTextureCache.forEach((tex) => tex.dispose());
      if (store.scoreboard) {
        const { mesh, geometry, material, texture } = store.scoreboard;
        if (mesh?.parent) {
          mesh.parent.remove(mesh);
        }
        geometry?.dispose?.();
        material?.dispose?.();
        texture?.dispose?.();
        store.scoreboard = null;
      }
      if (store.tableInfo) {
        store.tableInfo.dispose?.();
        store.tableInfo = null;
      }
      if (store.chairMaterials) {
        const mats = new Set([
          store.chairMaterials.seat,
          store.chairMaterials.leg,
          ...(store.chairMaterials.upholstery ?? []),
          ...(store.chairMaterials.metal ?? [])
        ]);
        mats.forEach((mat) => {
          if (mat && typeof mat.dispose === 'function') mat.dispose();
        });
      }
      if (store.chairTemplate) {
        store.chairTemplate.traverse((obj) => {
          if (obj.isMesh) {
            obj.geometry?.dispose?.();
          }
        });
        store.chairTemplate = null;
      }
      if (store.chairInstances?.length) {
        store.chairInstances.forEach((group) => {
          const model = group?.userData?.chairModel;
          if (model) {
            disposeObjectResources(model);
            group.remove(model);
          }
        });
        store.chairInstances = [];
      }
      if (store.decorGroup) {
        disposeObjectResources(store.decorGroup);
        if (store.decorGroup.parent) {
          store.decorGroup.parent.remove(store.decorGroup);
        }
        store.decorGroup = null;
        store.decorPlants = [];
      }
      if (store.outfitParts) {
        store.outfitParts.forEach((mat) => {
          if (mat && typeof mat.dispose === 'function') mat.dispose();
        });
      }
      if (store.textureCache) {
        store.textureCache.forEach((promise) => {
          Promise.resolve(promise).then((set) => {
            if (set) {
              [set.diffuse, set.normal, set.roughness].forEach((tex) => tex?.dispose?.());
            }
          });
        });
        store.textureCache.clear();
      }
      store.fallbackTexture?.dispose?.();
      threeStateRef.current = {
        renderer: null,
        scene: null,
        camera: null,
        controls: null,
        textureLoader: null,
        textureCache: new Map(),
        maxAnisotropy: 1,
        fallbackTexture: null,
        arena: null,
        cardGeometry: null,
        cardMap: new Map(),
        faceTextureCache: new Map(),
        seatConfigs: [],
        selectionTargets: [],
        animations: [],
        raycaster: new THREE.Raycaster(),
        tableAnchor: new THREE.Vector3(0, TABLE_HEIGHT + CARD_SURFACE_OFFSET, 0),
        discardAnchor: new THREE.Vector3(-TABLE_RADIUS * 0.76, TABLE_HEIGHT - CARD_H * 0.3, -TABLE_RADIUS * 0.62),
        scoreboard: null,
        tableInfo: null,
        tableThemeId: null,
        chairMaterials: null,
        chairTemplate: null,
        chairThemePreserve: false,
        chairThemeId: null,
        chairInstances: [],
        decorPlants: [],
        decorGroup: null,
        outfitParts: [],
        cardThemeId: '',
        appearance: { ...DEFAULT_APPEARANCE }
      };
      setThreeReady(false);
      setSeatAnchors([]);
    };
  }, [applyRendererQuality, applyStateToScene, ensureCardMeshes, players, rebuildTable, toggleSelection, updateScoreboardDisplay, updateSeatAnchors]);

  useEffect(() => {
    if (!threeReady) return;
    const state = gameState;
    if (state.status !== 'PLAYING') return;
    const active = state.players[state.activePlayer];
    if (!active || active.isHuman) return;
    const timer = setTimeout(() => {
      setGameState((prev) => {
        if (prev.status !== 'PLAYING') return prev;
        const current = prev.players[prev.activePlayer];
        if (!current || current.isHuman) return prev;
        return runAiTurn(prev);
      });
    }, AI_TURN_DELAY);
    return () => clearTimeout(timer);
  }, [gameState, threeReady]);

  const handlePlay = useCallback(() => {
    const state = gameStateRef.current;
    if (state.status !== 'PLAYING') return;
    const active = state.players[state.activePlayer];
    if (!active || !active.isHuman) return;
    const selectedCards = extractSelectedCards(active.hand, selectedRef.current);
    if (!selectedCards.length) {
      setActionError('Select at least one card.');
      return;
    }
    const combo = detectCombo(selectedCards, GAME_CONFIG);
    if (!combo) {
      setActionError('The combination is not valid.');
      return;
    }
    const includesStart = selectedCards.some(
      (card) => card.rank === START_CARD.rank && card.suit === START_CARD.suit
    );
    if (state.firstMove && !includesStart) {
      setActionError('The first move must include the 3♠.');
      return;
    }
    if (!canBeat(combo, state.tableCombo, GAME_CONFIG)) {
      setActionError('This combo does not beat the one on the table.');
      return;
    }
    setActionError('');
    setSelectedIds([]);
    setGameState(buildPlayState(state, selectedCards, combo));
  }, []);

  const handlePass = useCallback(() => {
    const state = gameStateRef.current;
    if (state.status !== 'PLAYING') return;
    const active = state.players[state.activePlayer];
    if (!active || !active.isHuman) return;
    if (!state.tableCombo) {
      setActionError('You cannot pass without a combo on the table.');
      return;
    }
    setActionError('');
    setSelectedIds([]);
    setGameState(buildPassState(state));
  }, []);

  const handleClear = useCallback(() => {
    setSelectedIds([]);
    setActionError('');
  }, []);

  return (
    <div className="absolute inset-0">
      <div ref={mountRef} className="absolute inset-0" />
      <div className="absolute inset-0 pointer-events-none flex h-full flex-col">
        {uiState.scoreboard?.length ? (
          <div className="sr-only" aria-live="polite">
            <p>Current score:</p>
            <ul>
              {uiState.scoreboard.map((entry) => (
                <li key={entry.id}>
                  {entry.name}
                  {entry.isActive ? ' (turn)' : ''}
                  {entry.finished ? ' - finished the game' : ` - ${entry.cardsLeft} cards`}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="absolute inset-0 pointer-events-none">
          {players.map((player, idx) => {
            const activePlayer = gameState.players?.[idx] ?? player;
            const anchor = seatAnchorMap.get(idx);
            const fallback = FALLBACK_SEAT_POSITIONS[idx % FALLBACK_SEAT_POSITIONS.length];
            const positionStyle = anchor
              ? {
                  position: 'absolute',
                  left: `${anchor.x}%`,
                  top: `${anchor.y}%`,
                  transform: 'translate(-50%, -50%)'
                }
              : { position: 'absolute', left: fallback.left, top: fallback.top, transform: 'translate(-50%, -50%)' };
            const avatarSize = anchor ? clampValue(1.25 - (anchor.depth - 2.4) * 0.12, 0.85, 1.25) : 1;
            const color = PLAYER_COLORS[idx % PLAYER_COLORS.length];
            const isTurn = gameState.activePlayer === idx;
            const handCount = activePlayer?.hand?.length ?? 0;
            return (
              <div
                key={activePlayer?.id ?? idx}
                className="absolute pointer-events-auto flex flex-col items-center gap-1"
                style={positionStyle}
              >
                <AvatarTimer
                  index={idx}
                  photoUrl={activePlayer?.avatar}
                  active={isTurn}
                  isTurn={isTurn}
                  timerPct={1}
                  name={activePlayer?.name}
                  color={color}
                  size={avatarSize}
                />
                <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-white/80 drop-shadow">
                  {handCount} cards
                </span>
              </div>
            );
          })}
        </div>
        <div className="pointer-events-none flex items-start justify-start px-4 pt-4">
          <div className="pointer-events-none flex flex-col items-start gap-2">
            <button
              type="button"
              onClick={() => setConfigOpen((prev) => !prev)}
              aria-expanded={configOpen}
              className={`pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white shadow-lg backdrop-blur transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                configOpen ? 'bg-black/60' : 'hover:bg-black/60'
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-6 w-6"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m19.4 13.5-.44 1.74a1 1 0 0 1-1.07.75l-1.33-.14a7.03 7.03 0 0 1-1.01.59l-.2 1.32a1 1 0 0 1-.98.84h-1.9a1 1 0 0 1-.98-.84l-.2-1.32a7.03 7.03 0 0 1-1.01-.59l-1.33.14a1 1 0 0 1-1.07-.75L4.6 13.5a1 1 0 0 1 .24-.96l1-.98a6.97 6.97 0 0 1 0-1.12l-1-.98a1 1 0 0 1-.24-.96l.44-1.74a1 1 0 0 1 1.07-.75l1.33.14c.32-.23.66-.43 1.01-.6l.2-1.31a1 1 0 0 1 .98-.84h1.9a1 1 0 0 1 .98.84l.2 1.31c.35.17.69.37 1.01.6l1.33-.14a1 1 0 0 1 1.07.75l.44 1.74a1 1 0 0 1-.24.96l-1 .98c.03.37.03.75 0 1.12l1 .98a1 1 0 0 1 .24.96z"
                />
              </svg>
              <span className="sr-only">Open table customization</span>
            </button>
            {configOpen && (
              <div className="pointer-events-auto mt-2 w-72 max-w-[80vw] rounded-2xl border border-white/15 bg-black/80 p-4 text-xs text-white shadow-2xl backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] uppercase tracking-[0.4em] text-sky-200/80">Table Setup</span>
                  <button
                    type="button"
                    onClick={() => setConfigOpen(false)}
                    className="rounded-full p-1 text-white/70 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                    aria-label="Close customization"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      className="h-4 w-4"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="m6 6 12 12M18 6 6 18" />
                    </svg>
                  </button>
                </div>
                <div className="mt-4 max-h-72 space-y-4 overflow-y-auto pr-1">
                  {customizationSections.map(({ key, label, options }) => (
                    <div key={key} className="space-y-2">
                      <p className="text-[10px] uppercase tracking-[0.35em] text-white/60">{label}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {options.map((option, idx) => {
                          const selected = appearance[key] === idx;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => setAppearance((prev) => ({ ...prev, [key]: idx }))}
                              aria-pressed={selected}
                              className={`flex flex-col items-center rounded-2xl border p-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                                selected
                                  ? 'border-sky-400/80 bg-sky-400/10 shadow-[0_0_12px_rgba(56,189,248,0.35)]'
                                  : 'border-white/10 bg-white/5 hover:border-white/20'
                              }`}
                            >
                              {renderPreview(key, option)}
                              <span className="mt-2 text-center text-[0.65rem] font-semibold text-gray-200">{option.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-[0.35em] text-white/60">Graphics</p>
                    <div className="grid gap-2">
                      {FRAME_RATE_OPTIONS.map((option) => {
                        const active = option.id === frameRateId;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => setFrameRateId(option.id)}
                            aria-pressed={active}
                            className={`w-full rounded-2xl border px-3 py-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                              active
                                ? 'border-sky-300 bg-sky-300/15 shadow-[0_0_12px_rgba(125,211,252,0.35)]'
                                : 'border-white/10 bg-white/5 hover:border-white/20 text-white/80'
                            }`}
                          >
                            <span className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-semibold uppercase tracking-[0.26em] text-white">{option.label}</span>
                              <span className="text-[11px] font-semibold tracking-wide text-sky-100">
                                {option.resolution ? `${option.resolution} • ${option.fps} FPS` : `${option.fps} FPS`}
                              </span>
                            </span>
                            {option.description ? (
                              <span className="mt-1 block text-[10px] uppercase tracking-[0.2em] text-white/60">
                                {option.description}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="mt-auto px-4 pb-6 pointer-events-none">
          <div className="mx-auto max-w-2xl rounded-2xl bg-black/70 p-4 text-sm text-gray-100 backdrop-blur-md shadow-2xl pointer-events-auto">
            <p className="text-sm text-gray-100">{uiState.message}</p>
            {uiState.tableSummary && (
              <p className="mt-2 text-xs text-gray-300">{uiState.tableSummary}</p>
            )}
            {actionError && <p className="mt-2 text-xs text-red-400">{actionError}</p>}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={handlePass}
                className="rounded-lg bg-gradient-to-r from-red-600 to-red-500 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-lg transition hover:shadow-xl disabled:cursor-not-allowed disabled:from-red-900/70 disabled:to-red-800/70 disabled:opacity-60 disabled:shadow-none"
                disabled={!uiState.humanTurn || !gameState.tableCombo}
              >
                Pass
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="rounded-lg bg-gradient-to-r from-amber-300 to-amber-400 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-black shadow-lg transition hover:shadow-xl disabled:cursor-not-allowed disabled:from-amber-300/60 disabled:to-amber-400/60 disabled:text-black/60 disabled:shadow-none"
                disabled={!selectedIds.length}
              >
                Undo
              </button>
              <button
                type="button"
                onClick={handlePlay}
                className="rounded-lg bg-gradient-to-r from-green-500 to-green-600 px-5 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-lg transition hover:shadow-xl disabled:cursor-not-allowed disabled:from-green-800/60 disabled:to-green-700/60 disabled:opacity-60 disabled:shadow-none"
                disabled={!uiState.humanTurn || !selectedIds.length}
              >
                Play
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function runAiTurn(state) {
  const active = state.players[state.activePlayer];
  if (!active || active.isHuman) return state;
  const action = aiChooseAction(active.hand, state.tableCombo, GAME_CONFIG);
  if (action.type === 'PLAY' && action.cards?.length) {
    const combo = detectCombo(action.cards, GAME_CONFIG);
    if (combo) {
      const includesStart = action.cards.some(
        (card) => card.rank === START_CARD.rank && card.suit === START_CARD.suit
      );
      if (!state.firstMove || includesStart) {
        return buildPlayState(state, action.cards, combo);
      }
    }
  }
  if (!state.tableCombo && active.hand.length) {
    const card = active.hand[0];
    const combo = detectCombo([card], GAME_CONFIG);
    if (combo) return buildPlayState(state, [card], combo);
  }
  return buildPassState(state);
}

function buildPlayState(state, cards, combo) {
  const players = state.players.map((player, idx) => {
    if (idx !== state.activePlayer) return { ...player, hand: [...player.hand] };
    const remaining = player.hand.filter((card) => !cards.includes(card));
    return { ...player, hand: remaining, finished: remaining.length === 0 };
  });

  const discardPile = state.tableCards.length
    ? [...state.discardPile, ...state.tableCards]
    : [...state.discardPile];

  const aliveCount = players.filter((p) => !p.finished).length;
  const lastWinner = state.activePlayer;
  let tableCombo = combo.type === ComboType.BOMB_4K ? null : combo;
  let tableCards = [...cards];
  let nextActive = getNextAlive(players, state.activePlayer);

  if (combo.type === ComboType.BOMB_4K) {
    tableCombo = null;
    tableCards = [...cards];
    nextActive = players[state.activePlayer].finished
      ? getNextAlive(players, state.activePlayer)
      : lastWinner;
  }

  let status = state.status;
  if (aliveCount <= 1) {
    status = 'ENDED';
    nextActive = state.activePlayer;
    tableCombo = null;
  }

  return {
    ...state,
    players,
    tableCombo,
    tableCards,
    discardPile,
    lastWinner,
    passesInRow: 0,
    firstMove: false,
    activePlayer: nextActive,
    status
  };
}

function buildPassState(state) {
  const players = state.players;
  const aliveCount = players.filter((p) => !p.finished).length;
  let passesInRow = state.passesInRow + 1;
  let tableCombo = state.tableCombo;
  let tableCards = state.tableCards;
  let discardPile = state.discardPile;
  let activePlayer = getNextAlive(players, state.activePlayer);

  if (tableCombo && passesInRow >= aliveCount - 1) {
    discardPile = tableCards.length ? [...discardPile, ...tableCards] : discardPile;
    tableCombo = null;
    tableCards = [];
    passesInRow = 0;
    const winner = state.lastWinner ?? state.activePlayer;
    activePlayer = players[winner]?.finished ? getNextAlive(players, winner) : winner;
  }

  return {
    ...state,
    activePlayer,
    passesInRow,
    tableCombo,
    tableCards,
    discardPile
  };
}

function extractSelectedCards(hand, selectedIds) {
  const idSet = new Set(selectedIds);
  return hand.filter((card) => idSet.has(card.id));
}

function initializeGame(playersInfo) {
  const deck = createDeck();
  shuffleInPlace(deck);
  const hands = dealHands(deck, playersInfo.length);
  const playerStates = playersInfo.map((info, idx) => ({
    ...info,
    hand: sortHand(hands[idx], GAME_CONFIG),
    finished: false
  }));
  const startIdx = playerStates.findIndex((player) =>
    player.hand.some((card) => card.rank === START_CARD.rank && card.suit === START_CARD.suit)
  );
  const active = startIdx === -1 ? 0 : startIdx;
  return {
    players: playerStates,
    activePlayer: active,
    tableCombo: null,
    tableCards: [],
    discardPile: [],
    passesInRow: 0,
    lastWinner: active,
    firstMove: true,
    status: 'PLAYING',
    allCards: deck
  };
}

function createDeck() {
  const ranks = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
  const deck = [];
  let id = 0;
  for (const suit of SUITS) {
    for (const rank of ranks) {
      deck.push({ id: `c-${id++}`, rank, suit });
    }
  }
  deck.push({ id: `c-${id++}`, rank: 'JR', suit: '🃏' });
  deck.push({ id: `c-${id++}`, rank: 'JB', suit: '🃏' });
  return deck;
}

function shuffleInPlace(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

function dealHands(deck, playerCount) {
  const hands = Array.from({ length: playerCount }, () => []);
  let idx = 0;
  deck.forEach((card) => {
    hands[idx].push(card);
    idx = (idx + 1) % playerCount;
  });
  return hands;
}

function getNextAlive(players, index) {
  if (!players.length) return 0;
  const { length } = players;
  let next = (index - 1 + length) % length;
  let safety = 0;
  while (players[next]?.finished) {
    next = (next - 1 + length) % length;
    safety += 1;
    if (safety > length) return index;
  }
  return next;
}

function computeUiState(state) {
  const scoreboard = state.players.map((player, idx) => ({
    id: idx,
    name: player.name,
    avatar: player.avatar,
    cardsLeft: player.hand.length,
    finished: player.finished,
    isActive: idx === state.activePlayer,
    isHuman: !!player.isHuman
  }));
  let message = '';
  let tableSummary = '';
  let humanTurn = false;

  if (state.status === 'ENDED') {
    const winners = scoreboard.filter((entry) => entry.finished).map((entry) => entry.name);
    message = winners.length === 1 ? `${winners[0]} emerged victorious!` : `Winners: ${winners.join(', ')}`;
  } else {
    const active = state.players[state.activePlayer];
    if (active) {
      humanTurn = !!active.isHuman;
      if (humanTurn) {
        message = state.firstMove
          ? 'Choose the cards (include 3♠) and press "Play".'
          : state.tableCombo
            ? 'Find a combo that beats the table or press "Pass".'
            : 'Pick your cards and press "Play" to start the trick.';
      } else {
        message = `Waiting for ${active.name}...`;
      }
    }
  }

  if (state.tableCards.length) {
    const description = describeCombo(state.tableCombo, state.tableCards);
    if (description) {
      const owner = state.lastWinner != null ? state.players[state.lastWinner]?.name : null;
      tableSummary = owner ? `${owner} played ${description}` : description;
    }
  }

  return { scoreboard, message, tableSummary, humanTurn, status: state.status };
}

function describeCombo(combo, cards) {
  if (!cards?.length) return '';
  if (!combo) {
    return cards.map((card) => cardLabel(card)).join(' ');
  }
  switch (combo.type) {
    case ComboType.SINGLE:
      return `a ${cardLabel(cards[0])}`;
    case ComboType.PAIR:
      return `pair ${combo.keyRank}`;
    case ComboType.TRIPS:
      return `trips ${combo.keyRank}`;
    case ComboType.BOMB_4K:
      return `bomb ${combo.keyRank}`;
    case ComboType.STRAIGHT:
      return `straight ${cardLabel(cards[0])} - ${cardLabel(cards[cards.length - 1])}`;
    case ComboType.FLUSH:
      return `flush with ${cards.length} cards`;
    case ComboType.FULL_HOUSE:
      return 'full house';
    case ComboType.STRAIGHT_FLUSH:
      return 'straight flush';
    default:
      return cards.map((card) => cardLabel(card)).join(' ');
  }
}

function cardLabel(card) {
  if (!card) return '';
  if (card.rank === 'JR') return 'Red Joker';
  if (card.rank === 'JB') return 'Black Joker';
  return `${card.rank}${card.suit}`;
}

function buildPlayers(search) {
  const params = new URLSearchParams(search);
  const username = params.get('username') || 'You';
  const avatar = params.get('avatar') || '';
  const providedFlags = (params.get('flags') || '')
    .split(',')
    .map((value) => Number.parseInt(value, 10))
    .filter(Number.isFinite)
    .map((index) => FLAG_EMOJIS[index])
    .filter(Boolean);
  const seedFlags = providedFlags.length
    ? [...providedFlags]
    : [...FLAG_EMOJIS].sort(() => 0.5 - Math.random());
  const basePlayers = [
    { name: username, avatar, isHuman: true },
    seedFlags[0] ? { name: flagName(seedFlags[0]), avatar: seedFlags[0] } : { name: 'Aria', avatar: '🦊' },
    seedFlags[1] ? { name: flagName(seedFlags[1]), avatar: seedFlags[1] } : { name: 'Milo', avatar: '🐻' },
    seedFlags[2] ? { name: flagName(seedFlags[2]), avatar: seedFlags[2] } : { name: 'Sora', avatar: '🐱' }
  ];
  return basePlayers.map((player, index) => ({ ...player, color: PLAYER_COLORS[index % PLAYER_COLORS.length] }));
}

function flagName(flag) {
  if (!flag) return 'Player';
  const base = 0x1f1e6;
  const codePoints = [...flag].map((c) => c.codePointAt(0) - base + 65);
  try {
    const region = String.fromCharCode(...codePoints);
    const names = new Intl.DisplayNames(['en'], { type: 'region' });
    return names.of(region) || `Player ${flag}`;
  } catch (error) {
    return `Player ${flag}`;
  }
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function setMeshPosition(mesh, target, lookTarget, orientation, immediate, animations) {
  if (!mesh) return;
  const orientTarget = lookTarget.clone();
  const orientOptions =
    typeof orientation === 'object' && orientation !== null
      ? orientation
      : { face: orientation ? 'front' : 'back', flat: false };
  const stopExisting = () => {
    if (mesh.userData?.animation) {
      mesh.userData.animation.cancelled = true;
      mesh.userData.animation = null;
    }
  };

  if (immediate || !animations) {
    stopExisting();
    mesh.position.copy(target);
    orientMesh(mesh, orientTarget, orientOptions);
    return;
  }

  const current = mesh.position.clone();
  if (current.distanceToSquared(target) < 1e-6) {
    stopExisting();
    mesh.position.copy(target);
    orientMesh(mesh, orientTarget, orientOptions);
    return;
  }

  stopExisting();
  const animation = {
    mesh,
    from: current,
    to: target.clone(),
    lookTarget: orientTarget,
    orientation: orientOptions,
    start: performance.now(),
    duration: CARD_ANIMATION_DURATION,
    cancelled: false
  };
  mesh.userData.animation = animation;
  animations.push(animation);
}

function orientMesh(mesh, lookTarget, options = {}) {
  const { face = 'front', flat = false } = options;
  mesh.up.set(0, 1, 0);
  mesh.lookAt(lookTarget);
  mesh.rotation.z = 0;
  if (flat) {
    mesh.rotateX(-Math.PI / 2);
  }
  if (face === 'back') {
    mesh.rotateY(Math.PI);
  }
}

function updateCardFace(mesh, mode) {
  if (!mesh?.material) return;
  const { frontMaterial, backMaterial, hiddenMaterial, cardFace } = mesh.userData ?? {};
  if (!frontMaterial || !backMaterial) return;
  if (mode === cardFace) return;
  if (mode === 'back') {
    const mat = hiddenMaterial ?? backMaterial;
    mesh.material[4] = mat;
    mesh.material[5] = mat;
    mesh.userData.cardFace = 'back';
    return;
  }
  mesh.material[4] = frontMaterial;
  mesh.material[5] = backMaterial;
  mesh.userData.cardFace = 'front';
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function createCardMesh(card, geometry, cache, theme) {
  const faceKey = `${theme.id}-${card.rank}-${card.suit}`;
  let faceTexture = cache.get(faceKey);
  if (!faceTexture) {
    faceTexture = makeCardFace(card.rank, card.suit, theme);
    cache.set(faceKey, faceTexture);
  }
  const edgeMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.edgeColor), roughness: 0.55, metalness: 0.1 });
  const edgeMats = [edgeMat, edgeMat.clone(), edgeMat.clone(), edgeMat.clone()];
  const frontMat = new THREE.MeshStandardMaterial({
    map: faceTexture,
    roughness: 0.35,
    metalness: 0.08,
    color: new THREE.Color('#ffffff')
  });
  const backTexture = makeCardBackTexture(theme);
  const backMat = new THREE.MeshStandardMaterial({
    map: backTexture,
    color: new THREE.Color(theme.backColor),
    roughness: 0.6,
    metalness: 0.15
  });
  const hiddenMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(theme.hiddenColor || theme.backColor),
    roughness: 0.7,
    metalness: 0.12
  });
  const mesh = new THREE.Mesh(geometry, [...edgeMats, frontMat, backMat]);
  mesh.userData.cardId = card.id;
  mesh.userData.card = card;
  mesh.userData.frontMaterial = frontMat;
  mesh.userData.backMaterial = backMat;
  mesh.userData.hiddenMaterial = hiddenMat;
  mesh.userData.edgeMaterials = edgeMats;
  mesh.userData.backTexture = backTexture;
  mesh.userData.cardFace = 'front';
  return mesh;
}

function makeCardFace(rank, suit, theme, w = 512, h = 720) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  g.fillStyle = theme.frontBackground || '#ffffff';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = theme.frontBorder || '#e5e7eb';
  g.lineWidth = 8;
  roundRect(g, 6, 6, w - 12, h - 12, 32);
  g.stroke();
  const color = SUIT_COLORS[suit] || '#111111';
  g.fillStyle = color;
  const label = rank === 'JB' ? 'JB' : rank === 'JR' ? 'JR' : String(rank);
  const padding = 36;
  const topRankY = 96;
  const topSuitY = topRankY + 76;
  const bottomSuitY = h - 92;
  const bottomRankY = bottomSuitY - 76;
  g.font = 'bold 96px "Inter", "Segoe UI", sans-serif';
  g.textAlign = 'left';
  g.fillText(label, padding, topRankY);
  g.font = 'bold 78px "Inter", "Segoe UI", sans-serif';
  g.fillText(suit, padding, topSuitY);
  g.font = 'bold 96px "Inter", "Segoe UI", sans-serif';
  g.fillText(label, padding, bottomRankY);
  g.font = 'bold 78px "Inter", "Segoe UI", sans-serif';
  g.fillText(suit, padding, bottomSuitY);
  g.textAlign = 'right';
  g.font = 'bold 96px "Inter", "Segoe UI", sans-serif';
  g.fillText(label, w - padding, topRankY);
  g.font = 'bold 78px "Inter", "Segoe UI", sans-serif';
  g.fillText(suit, w - padding, topSuitY);
  g.font = 'bold 96px "Inter", "Segoe UI", sans-serif';
  g.fillText(label, w - padding, bottomRankY);
  g.font = 'bold 78px "Inter", "Segoe UI", sans-serif';
  g.fillText(suit, w - padding, bottomSuitY);

  if (theme.centerAccent) {
    g.fillStyle = theme.centerAccent;
    g.beginPath();
    g.ellipse(w / 2, h / 2, w * 0.18, h * 0.22, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = color;
  g.font = 'bold 160px "Inter", "Segoe UI", sans-serif';
  g.textAlign = 'center';
  g.fillText(suit, w / 2, h / 2 + 56);
  const tex = new THREE.CanvasTexture(canvas);
  applySRGBColorSpace(tex);
  tex.anisotropy = 8;
  return tex;
}

function makeCardBackTexture(theme, w = 512, h = 720) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const [c1, c2] = theme.backGradient || [theme.backColor, theme.backColor];
  const gradient = ctx.createLinearGradient(0, 0, w, h);
  gradient.addColorStop(0, c1);
  gradient.addColorStop(1, c2);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = theme.backBorder || 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 14;
  roundRect(ctx, 18, 18, w - 36, h - 36, 48);
  ctx.stroke();
  if (theme.backAccent) {
    ctx.strokeStyle = theme.backAccent;
    ctx.lineWidth = 8;
    for (let i = 0; i < 6; i += 1) {
      const inset = 36 + i * 18;
      roundRect(ctx, inset, inset, w - inset * 2, h - inset * 2, 42);
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  applySRGBColorSpace(texture);
  texture.anisotropy = 8;
  return texture;
}

function applyChairThemeMaterials(three, theme) {
  const mats = three?.chairMaterials;
  if (!mats) return;
  const preserve = three?.chairThemePreserve ?? shouldPreserveChairMaterials(theme);
  if (preserve) return;
  const seatColor = theme?.seatColor || '#7c3aed';
  const legColor = theme?.legColor || '#111827';
  if (mats.seat?.color) {
    mats.seat.color.set(seatColor);
    mats.seat.needsUpdate = true;
  }
  if (mats.leg?.color) {
    mats.leg.color.set(legColor);
    mats.leg.needsUpdate = true;
  }
  (mats.upholstery ?? []).forEach((mat) => {
    if (mat?.color) {
      mat.color.set(seatColor);
      mat.needsUpdate = true;
    }
  });
  (mats.metal ?? []).forEach((mat) => {
    if (mat?.color) {
      mat.color.set(legColor);
      mat.needsUpdate = true;
    }
  });
}

function applyOutfitThemeMaterials(three, theme) {
  const parts = three?.outfitParts;
  if (!parts?.length) return;
  const base = theme?.baseColor ? new THREE.Color(theme.baseColor) : null;
  const accent = theme?.accentColor ? new THREE.Color(theme.accentColor) : null;
  parts.forEach((mat, index) => {
    if (!mat?.color) return;
    if (base) {
      mat.color.lerp(base, 0.08 + (index % 2) * 0.04);
    }
    if (accent && mat.sheenColor) {
      mat.sheenColor.lerp(accent, 0.12);
    }
    mat.needsUpdate = true;
  });
}

function applyCardThemeMaterials(three, theme, force = false) {
  if (!three?.cardMap) return;
  if (!force && three.cardThemeId === theme.id) return;
  const frontTextures = new Set();
  const backTextures = new Set();
  three.cardMap.forEach(({ mesh }) => {
    const { frontMaterial, backTexture } = mesh.userData ?? {};
    if (frontMaterial?.map) frontTextures.add(frontMaterial.map);
    if (backTexture) backTextures.add(backTexture);
  });
  frontTextures.forEach((tex) => tex?.dispose?.());
  backTextures.forEach((tex) => tex?.dispose?.());
  three.faceTextureCache.forEach((tex) => tex.dispose());
  three.faceTextureCache.clear();
  three.cardMap.forEach(({ mesh }) => {
    const { frontMaterial, backMaterial, hiddenMaterial, edgeMaterials, card } = mesh.userData ?? {};
    if (!frontMaterial || !backMaterial || !edgeMaterials || !card) return;
    const faceKey = `${theme.id}-${card.rank}-${card.suit}`;
    let faceTexture = three.faceTextureCache.get(faceKey);
    if (!faceTexture) {
      faceTexture = makeCardFace(card.rank, card.suit, theme);
      three.faceTextureCache.set(faceKey, faceTexture);
    }
    frontMaterial.map = faceTexture;
    frontMaterial.color?.set?.('#ffffff');
    frontMaterial.needsUpdate = true;
    const backTexture = makeCardBackTexture(theme);
    mesh.userData.backTexture = backTexture;
    backMaterial.map = backTexture;
    backMaterial.color?.set?.(theme.backColor);
    backMaterial.needsUpdate = true;
    if (hiddenMaterial?.color) {
      hiddenMaterial.color.set(theme.hiddenColor || theme.backColor);
      hiddenMaterial.needsUpdate = true;
    }
    edgeMaterials.forEach((mat) => {
      mat.color?.set?.(theme.edgeColor);
      mat.needsUpdate = true;
    });
  });
  three.cardThemeId = theme.id;
}
