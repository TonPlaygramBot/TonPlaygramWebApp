import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { GroundedSkybox } from 'three/examples/jsm/objects/GroundedSkybox.js';
import AvatarTimer from '../../components/AvatarTimer.jsx';
import BottomLeftIcons from '../../components/BottomLeftIcons.jsx';
import GiftPopup from '../../components/GiftPopup.jsx';
import InfoPopup from '../../components/InfoPopup.jsx';
import QuickMessagePopup from '../../components/QuickMessagePopup.jsx';
import {
  createMurlanStyleTable,
  applyTableMaterials
} from '../../utils/murlanTable.js';
import { ARENA_CAMERA_DEFAULTS } from '../../utils/arenaCameraConfig.js';
import { applyRendererSRGB, applySRGBColorSpace } from '../../utils/colorSpace.js';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import {
  ensureAccountId,
  getTelegramFirstName,
  getTelegramUsername,
  getTelegramPhotoUrl
} from '../../utils/telegram.js';
import coinConfetti from '../../utils/coinConfetti';
import {
  chatBeep,
  bombSound,
  cheerSound
} from '../../assets/soundData.js';
import { getGameVolume, isGameMuted, setGameMuted } from '../../utils/sound.js';
import { FLAG_EMOJIS } from '../../utils/flagEmojis.js';
import { avatarToName } from '../../utils/avatarUtils.js';
import {
  TABLE_WOOD_OPTIONS,
  TABLE_CLOTH_OPTIONS,
  TABLE_BASE_OPTIONS
} from '../../utils/tableCustomizationOptions.js';
import {
  CAPTURE_ANIMATION_OPTIONS,
  TOKEN_PALETTE_OPTIONS,
  TOKEN_PIECE_OPTIONS,
  TOKEN_STYLE_OPTIONS
} from '../../config/ludoBattleOptions.js';
import { MURLAN_TABLE_FINISHES } from '../../config/murlanTableFinishes.js';
import { MURLAN_STOOL_THEMES, MURLAN_TABLE_THEMES } from '../../config/murlanThemes.js';
import { POOL_ROYALE_DEFAULT_HDRI_ID, POOL_ROYALE_HDRI_VARIANTS } from '../../config/poolRoyaleInventoryConfig.js';
import { TOKEN_TYPE_SEQUENCE } from '../../utils/ludoTokenConstants.js';
import {
  getLudoBattleInventory,
  isLudoOptionUnlocked,
  ludoBattleAccountId
} from '../../utils/ludoBattleInventory.js';
import { giftSounds } from '../../utils/giftSounds.js';
import { playLudoDiceRollSfx, playLudoTokenStepSfx } from '../../utils/ludoSfx.js';
import { socket } from '../../utils/socket.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const FRAME_TIME_CATCH_UP_MULTIPLIER = 3;
const MISSILE_FORWARD = new THREE.Vector3(1, 0, 0);
const MISSILE_WORLD_UP = new THREE.Vector3(0, 1, 0);
const CAPTURE_VEHICLE_TEXTURE_CACHE = new Map();
const CAPTURE_VEHICLE_MODEL_CACHE = new Map();
const CAPTURE_VEHICLE_MODEL_HOSTS = [
  'https://cdn.jsdelivr.net/gh/srcejon/sdrangel-3d-models@main',
  'https://raw.githubusercontent.com/srcejon/sdrangel-3d-models/main',
  'https://cdn.statically.io/gh/srcejon/sdrangel-3d-models/main'
];
const CAPTURE_VEHICLE_MODEL_FILES = {
  drone: 'drone.glb',
  helicopter: 'helicopter.glb',
  fighter: 'f15.glb'
};
const GLB_MAGIC = 0x46546c67;
const GLB_VERSION = 2;
const GLB_JSON_CHUNK = 0x4e4f534a;
const GLB_BIN_CHUNK = 0x004e4942;
const CAPTURE_JET_SIZE_MULTIPLIER = 0.8;
const CAPTURE_DRONE_SIZE_MULTIPLIER = 0.8;
const CAPTURE_HELICOPTER_SIZE_MULTIPLIER = 0.82;
const CAPTURE_AIRCRAFT_SLOW_FACTOR = 1.22;

function getCaptureVehicleTexture(kind = 'generic') {
  if (CAPTURE_VEHICLE_TEXTURE_CACHE.has(kind)) return CAPTURE_VEHICLE_TEXTURE_CACHE.get(kind);
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const fallback = new THREE.CanvasTexture(canvas);
    CAPTURE_VEHICLE_TEXTURE_CACHE.set(kind, fallback);
    return fallback;
  }
  const palettes = {
    drone: ['#4f5a47', '#6f7b61', '#2e362b', '#879574'],
    fighter: ['#555f66', '#7f8c94', '#353d43', '#9caab2'],
    helicopter: ['#4a554a', '#697865', '#2a3129', '#7f8d7c'],
    generic: ['#55606a', '#74818b', '#313940', '#99a6af']
  };
  const tone = palettes[kind] ?? palettes.generic;
  ctx.fillStyle = tone[0];
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i += 1) {
    const w = 24 + ((i * 11) % 70);
    const h = 10 + ((i * 7) % 36);
    const x = (i * 37) % 256;
    const y = (i * 53) % 256;
    ctx.fillStyle = tone[(i % (tone.length - 1)) + 1];
    ctx.globalAlpha = 0.42 + ((i % 4) * 0.12);
    ctx.fillRect(x, y, w, h);
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  for (let y = 0; y <= 256; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.4, 2.4);
  texture.anisotropy = 4;
  CAPTURE_VEHICLE_TEXTURE_CACHE.set(kind, texture);
  return texture;
}

function createCaptureVehicleMaterial(kind, options = {}) {
  return new THREE.MeshStandardMaterial({
    map: getCaptureVehicleTexture(kind),
    ...options
  });
}

function fitObjectToTargetSize(root, targetSize) {
  if (!root) return;
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(maxDim) || maxDim <= 0) return;
  const scale = targetSize / maxDim;
  root.scale.multiplyScalar(scale);
  const nextBox = new THREE.Box3().setFromObject(root);
  const center = nextBox.getCenter(new THREE.Vector3());
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= nextBox.min.y;
}

async function loadCaptureVehicleModel(kind) {
  const file = CAPTURE_VEHICLE_MODEL_FILES[kind];
  if (!file) return null;
  if (CAPTURE_VEHICLE_MODEL_CACHE.has(kind)) return CAPTURE_VEHICLE_MODEL_CACHE.get(kind);
  const promise = (async () => {
    const urls = CAPTURE_VEHICLE_MODEL_HOSTS.map((host) => `${host}/${file}`);
    const loader = new GLTFLoader();
    loader.setCrossOrigin('anonymous');
    const imageCache = new Map();
    for (const url of urls) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const rawBuffer = await fetchBuffer(url);
        // eslint-disable-next-line no-await-in-loop
        const patchedBuffer = await patchGlbImagesToDataUris(rawBuffer, kind, url, urls, imageCache);
        // eslint-disable-next-line no-await-in-loop
        const gltf = await parseObjectFromBuffer(loader, patchedBuffer);
        const modelRoot = gltf || null;
        if (!modelRoot) continue;
        prepareLoadedModel(modelRoot, { preserveGltfTextureMapping: true });
        return modelRoot;
      } catch (error) {
        console.warn(`Capture ${kind} model load failed`, url, error);
      }
    }
    for (const url of urls) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const gltf = await loader.loadAsync(url);
        const modelRoot = gltf?.scene || gltf?.scenes?.[0] || null;
        if (!modelRoot) continue;
        prepareLoadedModel(modelRoot, { preserveGltfTextureMapping: true });
        return modelRoot;
      } catch (error) {
        console.warn(`Capture ${kind} model load failed`, url, error);
      }
    }
    return null;
  })();
  CAPTURE_VEHICLE_MODEL_CACHE.set(kind, promise);
  return promise;
}

function isDataUri(uri) {
  return typeof uri === 'string' && uri.startsWith('data:');
}

function isAbsoluteUrl(uri) {
  return /^https?:\/\//i.test(uri) || uri.startsWith('blob:');
}

function uniqueStrings(values) {
  return Array.from(new Set(values));
}

function buildImageCandidates(imageUri, sourceUrl, modelUrls) {
  if (isAbsoluteUrl(imageUri)) return uniqueStrings([imageUri]);
  return uniqueStrings([
    imageUri,
    new URL(imageUri, sourceUrl).href,
    ...modelUrls.map((modelUrl) => new URL(imageUri, modelUrl).href)
  ]);
}

function decodeGlb(buffer) {
  const view = new DataView(buffer);
  if (view.byteLength < 20) throw new Error('GLB too small to parse');
  if (view.getUint32(0, true) !== GLB_MAGIC) throw new Error('Asset is not a GLB file');
  if (view.getUint32(4, true) !== GLB_VERSION) throw new Error('Unsupported GLB version');

  const totalLength = view.getUint32(8, true);
  const bytes = new Uint8Array(buffer, 0, totalLength);
  const decoder = new TextDecoder();

  let offset = 12;
  let json = null;
  let binChunk = null;

  while (offset + 8 <= totalLength) {
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    offset += 8;
    const chunkBytes = bytes.slice(offset, offset + chunkLength);
    offset += chunkLength;
    if (chunkType === GLB_JSON_CHUNK) {
      json = JSON.parse(decoder.decode(chunkBytes).trim());
    } else if (chunkType === GLB_BIN_CHUNK) {
      binChunk = chunkBytes;
    }
  }

  if (!json) throw new Error('GLB missing JSON chunk');
  return { json, binChunk };
}

function createMinimalGlbBuffer(json, binChunk) {
  const encoder = new TextEncoder();
  const rawJson = encoder.encode(JSON.stringify(json));
  const jsonPadding = (4 - (rawJson.length % 4)) % 4;
  const paddedJson = new Uint8Array(rawJson.length + jsonPadding);
  paddedJson.set(rawJson);
  paddedJson.fill(0x20, rawJson.length);

  let paddedBin = null;
  if (binChunk) {
    const binPadding = (4 - (binChunk.length % 4)) % 4;
    paddedBin = new Uint8Array(binChunk.length + binPadding);
    paddedBin.set(binChunk);
  }

  const totalLength = 12 + 8 + paddedJson.length + (paddedBin ? 8 + paddedBin.length : 0);
  const buffer = new ArrayBuffer(totalLength);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, GLB_VERSION, true);
  view.setUint32(8, totalLength, true);

  let offset = 12;
  view.setUint32(offset, paddedJson.length, true);
  view.setUint32(offset + 4, GLB_JSON_CHUNK, true);
  offset += 8;
  bytes.set(paddedJson, offset);
  offset += paddedJson.length;

  if (paddedBin) {
    view.setUint32(offset, paddedBin.length, true);
    view.setUint32(offset + 4, GLB_BIN_CHUNK, true);
    offset += 8;
    bytes.set(paddedBin, offset);
  }

  return buffer;
}

function extractBufferViewBytes(json, binChunk, bufferViewIndex) {
  if (!binChunk) return null;
  const bufferViews = Array.isArray(json?.bufferViews) ? json.bufferViews : [];
  const view = bufferViews[bufferViewIndex];
  if (!view) return null;
  const byteOffset = typeof view.byteOffset === 'number' ? view.byteOffset : 0;
  const byteLength = typeof view.byteLength === 'number' ? view.byteLength : 0;
  if (byteLength <= 0) return null;
  return binChunk.slice(byteOffset, byteOffset + byteLength);
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function bytesToDataUri(bytes, mimeType) {
  return `data:${mimeType};base64,${bytesToBase64(bytes)}`;
}

async function fetchBuffer(url) {
  const response = await fetch(url, { mode: 'cors' });
  if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
  return response.arrayBuffer();
}

async function fetchBlob(url) {
  const response = await fetch(url, { mode: 'cors' });
  if (!response.ok) throw new Error(`Fetch blob failed: ${response.status}`);
  return response.blob();
}

function parseObjectFromBuffer(loader, buffer) {
  return new Promise((resolve, reject) => {
    loader.parse(
      buffer,
      '',
      (gltf) => resolve(gltf?.scene || gltf?.scenes?.[0] || null),
      (error) => reject(error)
    );
  });
}

async function blobToDataUri(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Failed to convert blob to data URI'));
    reader.readAsDataURL(blob);
  });
}

function makePlaceholderTextureDataUri(primary, secondary) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return 'data:image/png;base64,';
  ctx.fillStyle = primary;
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = secondary;
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillRect(32, 32, 32, 32);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 62, 62);
  return canvas.toDataURL('image/png');
}

async function resolveExternalImageToDataUri(imageUri, kind, sourceUrl, modelUrls, cache) {
  if (isDataUri(imageUri)) return imageUri;
  const placeholderColors = {
    drone: ['#7c8791', '#4f5861'],
    helicopter: ['#6f7763', '#4f5648'],
    fighter: ['#98a1a9', '#646d76']
  };
  const [primary, secondary] = placeholderColors[kind] ?? ['#6e7681', '#4f5861'];
  const placeholderDataUri = makePlaceholderTextureDataUri(primary, secondary);
  const candidates = buildImageCandidates(imageUri, sourceUrl, modelUrls);
  for (const candidate of candidates) {
    if (!isAbsoluteUrl(candidate)) continue;
    const cached = cache.get(candidate);
    if (cached) return cached;
    try {
      // eslint-disable-next-line no-await-in-loop
      const blob = await fetchBlob(candidate);
      // eslint-disable-next-line no-await-in-loop
      const dataUri = await blobToDataUri(blob);
      if (dataUri) {
        cache.set(candidate, dataUri);
        return dataUri;
      }
    } catch (err) {
      // ignore candidate
    }
  }
  return placeholderDataUri;
}

async function patchGlbImagesToDataUris(buffer, kind, sourceUrl, modelUrls, cache) {
  const { json, binChunk } = decodeGlb(buffer);
  const cloned = JSON.parse(JSON.stringify(json));
  const images = Array.isArray(cloned.images) ? cloned.images : [];
  if (!images.length) return buffer;

  for (let i = 0; i < images.length; i += 1) {
    const image = images[i];
    if (typeof image.uri === 'string') {
      // eslint-disable-next-line no-await-in-loop
      image.uri = await resolveExternalImageToDataUri(image.uri, kind, sourceUrl, modelUrls, cache);
      delete image.bufferView;
      image.mimeType = image.mimeType ?? 'image/png';
      continue;
    }
    if (typeof image.bufferView === 'number') {
      const bytes = extractBufferViewBytes(cloned, binChunk, image.bufferView);
      if (bytes?.length) {
        const mimeType = typeof image.mimeType === 'string' ? image.mimeType : 'image/png';
        image.uri = bytesToDataUri(bytes, mimeType);
        delete image.bufferView;
        image.mimeType = mimeType;
      }
    }
  }

  return createMinimalGlbBuffer(cloned, binChunk);
}

function applyCaptureTextureToOpaqueMeshes(root, kind) {
  root.traverse((obj) => {
    if (!obj?.isMesh) return;
    const mat = obj.material;
    if (!mat || Array.isArray(mat) || mat.transparent || mat.opacity < 1) return;
    obj.material = createCaptureVehicleMaterial(kind, {
      color: mat.color ?? '#ffffff',
      roughness: typeof mat.roughness === 'number' ? mat.roughness : 0.58,
      metalness: typeof mat.metalness === 'number' ? mat.metalness : 0.2
    });
    obj.castShadow = true;
    obj.receiveShadow = true;
  });
}

function paintMeshMaterials(node, painter) {
  if (!node?.isMesh) return;
  const materials = Array.isArray(node.material) ? node.material : [node.material];
  materials.forEach((mat) => {
    if (!mat || !mat.color) return;
    painter(mat);
    mat.needsUpdate = true;
  });
}

function applyMilitaryJetLook(root) {
  if (!root) return;
  applyCaptureTextureToOpaqueMeshes(root, 'fighter');
  root.traverse((node) => {
    if (!node?.isMesh) return;
    const name = `${node.name || ''}`.toLowerCase();
    paintMeshMaterials(node, (mat) => {
      if (/cockpit|canopy|window|glass/.test(name)) {
        mat.color.set('#06080c');
        if ('metalness' in mat) mat.metalness = 0.55;
        if ('roughness' in mat) mat.roughness = 0.16;
        if ('transparent' in mat) mat.transparent = true;
        if ('opacity' in mat) mat.opacity = 0.94;
        return;
      }
      if (/missile|rocket|store|pod/.test(name)) {
        mat.color.set('#d8dde3');
        if ('metalness' in mat) mat.metalness = 0.88;
        if ('roughness' in mat) mat.roughness = 0.24;
        return;
      }
      mat.color.offsetHSL(-0.03, -0.18, -0.12);
      if ('metalness' in mat) mat.metalness = Math.min(0.75, (mat.metalness ?? 0.25) + 0.2);
      if ('roughness' in mat) mat.roughness = Math.max(0.32, (mat.roughness ?? 0.6) - 0.14);
    });
  });
}

function applyMilitaryHelicopterLook(root, topRotor = null, tailRotor = null) {
  if (!root) return;
  root.traverse((node) => {
    if (!node?.isMesh) return;
    const name = `${node.name || ''}`.toLowerCase();
    const isRotorNode =
      node === topRotor ||
      node === tailRotor ||
      node.parent === topRotor ||
      node.parent === tailRotor ||
      /rotor|propell|blade|fan/.test(name);
    paintMeshMaterials(node, (mat) => {
      if (/window|cockpit|glass|canopy/.test(name)) {
        mat.color.setHex(0x0c1016);
        if ('metalness' in mat) mat.metalness = 0.38;
        if ('roughness' in mat) mat.roughness = 0.2;
        if ('opacity' in mat) mat.opacity = 0.95;
        if ('transparent' in mat) mat.transparent = true;
        return;
      }
      if (isRotorNode) {
        mat.color.setHex(0xb8c1cc);
        if ('metalness' in mat) mat.metalness = 0.72;
        if ('roughness' in mat) mat.roughness = 0.26;
        return;
      }
      mat.color.offsetHSL(0.02, -0.14, -0.16);
      if ('metalness' in mat) mat.metalness = Math.min(0.58, (mat.metalness ?? 0.3) + 0.08);
      if ('roughness' in mat) mat.roughness = Math.max(0.36, (mat.roughness ?? 0.6) - 0.12);
    });
  });
}

function findDroneMotorMesh(root) {
  let best = null;
  root?.traverse((node) => {
    if (best || !node?.isMesh) return;
    const name = `${node.name || ''}`.toLowerCase();
    if (/propell|rotor|blade|fan|motor/.test(name)) best = node;
  });
  return best;
}

function applyMilitaryDroneLook(root, propeller = null) {
  if (!root) return null;
  applyCaptureTextureToOpaqueMeshes(root, 'drone');
  const motor = propeller ?? findDroneMotorMesh(root);
  root.traverse((node) => {
    if (!node?.isMesh) return;
    const name = `${node.name || ''}`.toLowerCase();
    const isMotor = node === motor || /propell|rotor|blade|fan|motor/.test(name);
    paintMeshMaterials(node, (mat) => {
      if (isMotor || /engine|exhaust|rear|tail/.test(name)) {
        mat.color.setHex(0x11151a);
        if ('metalness' in mat) mat.metalness = 0.72;
        if ('roughness' in mat) mat.roughness = 0.28;
        return;
      }
      mat.color.setHex(0xcfd4d9);
      if ('metalness' in mat) mat.metalness = 0.82;
      if ('roughness' in mat) mat.roughness = 0.2;
    });
  });
  return motor;
}

function easeSmooth(t) {
  const n = clamp(t, 0, 1);
  return n * n * (3 - 2 * n);
}

function quadraticBezier(a, b, c, t) {
  const ab = new THREE.Vector3().copy(a).lerp(b, t);
  const bc = new THREE.Vector3().copy(b).lerp(c, t);
  return ab.lerp(bc, t);
}

function cubicBezier(a, b, c, d, t) {
  const ab = new THREE.Vector3().copy(a).lerp(b, t);
  const bc = new THREE.Vector3().copy(b).lerp(c, t);
  const cd = new THREE.Vector3().copy(c).lerp(d, t);
  const abbc = ab.lerp(bc, t);
  const bccd = bc.lerp(cd, t);
  return abbc.lerp(bccd, t);
}

function addFxBox(
  group,
  size,
  position,
  color,
  roughness = 0.7,
  metalness = 0.2
) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size[0], size[1], size[2]),
    new THREE.MeshStandardMaterial({ color, roughness, metalness })
  );
  mesh.position.set(position[0], position[1], position[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addFxCylinder(
  group,
  radiusTop,
  radiusBottom,
  height,
  position,
  rotation,
  color,
  radialSegments = 18,
  roughness = 0.62,
  metalness = 0.28
) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments),
    new THREE.MeshStandardMaterial({ color, roughness, metalness })
  );
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addFxSphere(
  group,
  radius,
  position,
  color,
  roughness = 0.45,
  metalness = 0.25,
  transparent = false,
  opacity = 1
) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 16, 16),
    new THREE.MeshStandardMaterial({ color, roughness, metalness, transparent, opacity })
  );
  mesh.position.set(position[0], position[1], position[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function createFxPolygon(points, depth, color, roughness = 0.62, metalness = 0.18) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 });
  geometry.translate(0, 0, -depth / 2);
  geometry.rotateX(Math.PI / 2);
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color, roughness, metalness })
  );
  mesh.castShadow = true;
  return mesh;
}

function createCaptureMissileFx() {
  const root = new THREE.Group();
  addFxCylinder(root, 0.09, 0.1, 1.18, [0, 0, 0], [0, 0, Math.PI / 2], '#d3d8de', 16, 0.3, 0.86);

  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.1, 0.28, 16),
    new THREE.MeshStandardMaterial({ color: '#edf1f6', roughness: 0.22, metalness: 0.9 })
  );
  nose.position.set(0.74, 0, 0);
  nose.rotation.z = -Math.PI / 2;
  nose.castShadow = true;
  nose.receiveShadow = true;
  root.add(nose);

  addFxBox(root, [0.17, 0.025, 0.34], [-0.19, 0, 0], '#cfd5dc', 0.34, 0.82);
  addFxBox(root, [0.17, 0.34, 0.025], [-0.19, 0, 0], '#cfd5dc', 0.34, 0.82);
  addFxBox(root, [0.12, 0.024, 0.22], [-0.44, 0, 0], '#0f1419', 0.5, 0.36);
  addFxBox(root, [0.12, 0.22, 0.024], [-0.44, 0, 0], '#0f1419', 0.5, 0.36);

  const trail = [];
  for (let i = 0; i < 5; i += 1) {
    trail.push(
      addFxSphere(
        root,
        0.12 + i * 0.03,
        [-0.84 - i * 0.19, 0, 0],
        i < 2 ? '#f6af4b' : '#8f989d',
        i < 2 ? 0.2 : 1,
        0,
        true,
        i < 2 ? 0.8 - i * 0.15 : 0.26 - (i - 2) * 0.04
      )
    );
  }

  root.visible = false;
  return { root, trail };
}

async function createCaptureDroneFx() {
  const root = new THREE.Group();
  const loadedDrone = await loadCaptureVehicleModel('drone');
  if (loadedDrone) {
    const model = loadedDrone.clone(true);
    fitObjectToTargetSize(model, 3.85 * CAPTURE_DRONE_SIZE_MULTIPLIER);
    model.rotation.y = Math.PI;
    const propeller = applyMilitaryDroneLook(model);
    root.add(model);
    const trail = [];
    for (let i = 0; i < 5; i += 1) {
      trail.push(
        addFxSphere(
          root,
          0.12 + i * 0.03,
          [-0.84 - i * 0.19, 0, 0],
          i < 2 ? '#f6af4b' : '#8f989d',
          i < 2 ? 0.2 : 1,
          0,
          true,
          i < 2 ? 0.8 - i * 0.15 : 0.26 - (i - 2) * 0.04
        )
      );
    }
    root.visible = false;
    return { root, propeller, trail };
  }
  root.scale.setScalar(0.3);
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.18, 2.85, 24),
    createCaptureVehicleMaterial('drone', { color: '#d1d7de', roughness: 0.28, metalness: 0.84 })
  );
  body.rotation.set(0, 0, Math.PI / 2);
  body.castShadow = true;
  body.receiveShadow = true;
  root.add(body);
  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.17, 0.68, 22),
    createCaptureVehicleMaterial('drone', { color: '#edf1f6', roughness: 0.24, metalness: 0.88 })
  );
  nose.position.set(1.74, 0, 0);
  nose.rotation.z = -Math.PI / 2;
  nose.castShadow = true;
  root.add(nose);
  const tail = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.13, 0.58, 16),
    createCaptureVehicleMaterial('drone', { color: '#10151c', roughness: 0.44, metalness: 0.44 })
  );
  tail.position.set(-1.62, 0, 0);
  tail.rotation.set(0, 0, Math.PI / 2);
  tail.castShadow = true;
  tail.receiveShadow = true;
  root.add(tail);
  const deltaWing = createFxPolygon(
    [
      [-1.25, -1.95],
      [1.05, 0],
      [-1.3, 1.95]
    ],
    0.08,
    '#a8b0b7',
    0.74,
    0.12
  );
  deltaWing.position.set(-0.14, -0.06, 0);
  root.add(deltaWing);
  addFxBox(root, [0.65, 0.08, 0.24], [-0.12, 0.2, 0], '#889198', 0.58, 0.2);
  const spine = createFxPolygon(
    [
      [-0.52, -0.16],
      [0.92, 0],
      [-0.52, 0.16]
    ],
    0.06,
    '#798289',
    0.55,
    0.24
  );
  spine.position.set(0.15, 0.03, 0);
  root.add(spine);
  const finLeft = createFxPolygon(
    [
      [-0.28, 0],
      [0.22, 0],
      [-0.04, 0.55]
    ],
    0.04,
    '#838b90',
    0.55,
    0.24
  );
  finLeft.rotation.z = Math.PI / 2;
  finLeft.position.set(-0.4, 0.35, -0.25);
  root.add(finLeft);
  const finRight = finLeft.clone();
  finRight.position.z = 0.25;
  root.add(finRight);
  addFxCylinder(root, 0.04, 0.04, 0.64, [0.28, -0.22, -0.55], [Math.PI / 2, 0, 0], '#656e76', 12, 0.54, 0.22);
  addFxCylinder(root, 0.04, 0.04, 0.64, [0.28, -0.22, 0.55], [Math.PI / 2, 0, 0], '#656e76', 12, 0.54, 0.22);
  addFxSphere(root, 0.09, [1.05, 0, 0], '#1f2428', 0.22, 0.35);
  const propeller = new THREE.Group();
  propeller.position.set(-1.95, 0, 0);
  addFxBox(propeller, [0.05, 1.0, 0.08], [0, 0, 0], '#191d20', 0.6, 0.12);
  const blade2 = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 1.0, 0.08),
    new THREE.MeshStandardMaterial({ color: '#191d20', roughness: 0.6 })
  );
  blade2.rotation.x = Math.PI / 2;
  blade2.castShadow = true;
  propeller.add(blade2);
  addFxSphere(propeller, 0.07, [0, 0, 0], '#41484d', 0.45, 0.25);
  root.add(propeller);
  const trail = [];
  for (let i = 0; i < 5; i += 1) {
    trail.push(
      addFxSphere(
        root,
        0.12 + i * 0.03,
        [-0.84 - i * 0.19, 0, 0],
        i < 2 ? '#f6af4b' : '#8f989d',
        i < 2 ? 0.2 : 1,
        0,
        true,
        i < 2 ? 0.8 - i * 0.15 : 0.26 - (i - 2) * 0.04
      )
    );
  }
  applyMilitaryDroneLook(root, propeller);
  root.visible = false;
  return { root, propeller, trail };
}

async function createCaptureJetFx() {
  const root = new THREE.Group();
  const loadedJet = await loadCaptureVehicleModel('fighter');
  if (loadedJet) {
    const model = loadedJet.clone(true);
    fitObjectToTargetSize(model, 9.2 * CAPTURE_JET_SIZE_MULTIPLIER * 0.86);
    model.rotation.set(Math.PI, Math.PI, 0);
    applyMilitaryJetLook(model);
    root.add(model);
    const trail = [];
    for (let i = 0; i < 6; i += 1) {
      trail.push(
        addFxSphere(
          root,
          0.11 + i * 0.03,
          [-1.95 - i * 0.2, 0, 0],
          i < 2 ? '#f7a94b' : '#8b949b',
          i < 2 ? 0.22 : 1,
          0,
          true,
          i < 2 ? 0.85 - i * 0.18 : 0.28 - (i - 2) * 0.045
        )
      );
    }
    root.visible = false;
    return { root, trail };
  }
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.21, 3.18, 28),
    createCaptureVehicleMaterial('fighter', { color: '#bcc3c9', roughness: 0.46, metalness: 0.25 })
  );
  body.rotation.set(0, 0, Math.PI / 2);
  body.castShadow = true;
  body.receiveShadow = true;
  root.add(body);
  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.16, 1.02, 24),
    createCaptureVehicleMaterial('fighter', { color: '#d9dde2', roughness: 0.42, metalness: 0.2 })
  );
  nose.position.set(2.04, 0, 0);
  nose.rotation.z = -Math.PI / 2;
  nose.castShadow = true;
  root.add(nose);
  const cockpit = addFxSphere(root, 0.21, [0.66, 0.16, 0], '#070b12', 0.1, 0.56, true, 0.94);
  cockpit.scale.set(1.25, 0.56, 0.62);
  const wing = createFxPolygon([[-1.6, -2.55], [0.8, 0], [-0.4, 2.55]], 0.1, '#9ba4ac', 0.66, 0.18);
  wing.position.set(-0.18, -0.04, 0);
  root.add(wing);
  const canardLeft = createFxPolygon([[-0.42, -0.52], [0.2, 0], [-0.18, 0.52]], 0.05, '#8f99a2', 0.63, 0.2);
  canardLeft.position.set(0.58, 0.01, -0.42);
  root.add(canardLeft);
  const canardRight = canardLeft.clone();
  canardRight.position.z = 0.42;
  root.add(canardRight);
  const tailWing = createFxPolygon([[-0.95, -1.18], [0.33, 0], [-0.38, 1.18]], 0.08, '#929ca4', 0.64, 0.2);
  tailWing.position.set(-1.36, 0.06, 0);
  root.add(tailWing);
  const fin = createFxPolygon([[-0.54, 0], [0.24, 0], [-0.1, 1.02]], 0.05, '#8b959d', 0.58, 0.2);
  fin.rotation.z = Math.PI / 2;
  fin.position.set(-1.12, 0.58, 0);
  root.add(fin);
  const engineLeft = addFxCylinder(root, 0.12, 0.1, 0.84, [-1.98, -0.08, -0.22], [0, 0, Math.PI / 2], '#6f7881', 18);
  const engineRight = engineLeft.clone();
  engineRight.position.z = 0.22;
  root.add(engineRight);
  const leftStore = new THREE.Group();
  addFxCylinder(leftStore, 0.04, 0.05, 0.55, [0, 0, 0], [0, 0, Math.PI / 2], '#dce1e7', 12, 0.24, 0.9);
  const leftStoreNose = new THREE.Mesh(
    new THREE.ConeGeometry(0.05, 0.14, 12),
    new THREE.MeshStandardMaterial({ color: '#edf1f6', roughness: 0.22, metalness: 0.9 })
  );
  leftStoreNose.position.set(0.34, 0, 0);
  leftStoreNose.rotation.z = -Math.PI / 2;
  leftStore.add(leftStoreNose);
  leftStore.position.set(0.25, -0.25, -1.15);
  root.add(leftStore);
  const rightStore = leftStore.clone();
  rightStore.position.z = 1.15;
  root.add(rightStore);
  const trail = [];
  for (let i = 0; i < 6; i += 1) {
    trail.push(
      addFxSphere(
        root,
        0.11 + i * 0.03,
        [-1.95 - i * 0.2, 0, 0],
        i < 2 ? '#f7a94b' : '#8b949b',
        i < 2 ? 0.22 : 1,
        0,
        true,
        i < 2 ? 0.85 - i * 0.18 : 0.28 - (i - 2) * 0.045
      )
    );
  }
  applyMilitaryJetLook(root);
  root.visible = false;
  return { root, trail };
}

async function createCaptureHelicopterFx() {
  const root = new THREE.Group();
  const loadedHelicopter = await loadCaptureVehicleModel('helicopter');
  if (loadedHelicopter) {
    const model = loadedHelicopter.clone(true);
    fitObjectToTargetSize(model, 7.68 * CAPTURE_HELICOPTER_SIZE_MULTIPLIER);
    model.rotation.y = Math.PI;
    applyMilitaryHelicopterLook(model);
    root.add(model);
    const trail = [];
    for (let i = 0; i < 6; i += 1) {
      trail.push(
        addFxSphere(
          root,
          0.11 + i * 0.03,
          [-1.76 - i * 0.2, 0, 0],
          i < 2 ? '#f7a94b' : '#8b949b',
          i < 2 ? 0.22 : 1,
          0,
          true,
          i < 2 ? 0.85 - i * 0.18 : 0.28 - (i - 2) * 0.045
        )
      );
    }
    root.visible = false;
    return { root, rotor: null, tailRotor: null, trail };
  }
  root.scale.setScalar(1.2 * CAPTURE_HELICOPTER_SIZE_MULTIPLIER);
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.22, 2.56, 24),
    createCaptureVehicleMaterial('helicopter', { color: '#86909a', roughness: 0.56, metalness: 0.26 })
  );
  body.rotation.set(0, 0, Math.PI / 2);
  body.castShadow = true;
  body.receiveShadow = true;
  root.add(body);
  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.2, 0.88, 22),
    createCaptureVehicleMaterial('helicopter', { color: '#99a3ad', roughness: 0.5, metalness: 0.2 })
  );
  nose.position.set(1.7, 0, 0);
  nose.rotation.z = -Math.PI / 2;
  nose.castShadow = true;
  root.add(nose);
  const cockpit = addFxSphere(root, 0.26, [0.72, 0.18, 0], '#22303d', 0.18, 0.28);
  cockpit.scale.set(1.2, 0.68, 0.72);
  addFxCylinder(root, 0.08, 0.1, 1.25, [-1.7, 0.1, 0], [0, 0, Math.PI / 2], '#6f7881', 16, 0.56, 0.24);
  addFxBox(root, [1.0, 0.08, 0.1], [0.2, -0.28, 0], '#4f5963', 0.6, 0.2);
  addFxBox(root, [1.1, 0.08, 0.1], [-0.15, -0.28, -0.5], '#4f5963', 0.6, 0.2);
  addFxBox(root, [1.1, 0.08, 0.1], [-0.15, -0.28, 0.5], '#4f5963', 0.6, 0.2);
  const rotor = new THREE.Group();
  rotor.position.set(-0.1, 0.47, 0);
  addFxBox(rotor, [0.08, 0.08, 0.08], [0, 0, 0], '#1b1f24', 0.52, 0.2);
  addFxBox(rotor, [0.14, 0.02, 1.9], [0, 0, 0], '#12161a', 0.44, 0.12);
  const rotorCross = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.02, 0.14),
    new THREE.MeshStandardMaterial({ color: '#12161a', roughness: 0.44, metalness: 0.12 })
  );
  rotorCross.castShadow = true;
  rotorCross.receiveShadow = true;
  rotor.add(rotorCross);
  root.add(rotor);
  const tailRotor = new THREE.Group();
  tailRotor.position.set(-2.18, 0.12, 0);
  addFxBox(tailRotor, [0.04, 0.4, 0.08], [0, 0, 0], '#15191d', 0.52, 0.14);
  const tailRotorCross = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.08, 0.4),
    new THREE.MeshStandardMaterial({ color: '#15191d', roughness: 0.52, metalness: 0.14 })
  );
  tailRotorCross.castShadow = true;
  tailRotorCross.receiveShadow = true;
  tailRotor.add(tailRotorCross);
  root.add(tailRotor);
  const missileLeft = new THREE.Group();
  addFxCylinder(missileLeft, 0.04, 0.05, 0.55, [0, 0, 0], [0, 0, Math.PI / 2], '#d8dbdf', 12, 0.4, 0.18);
  const missileNose = new THREE.Mesh(
    new THREE.ConeGeometry(0.05, 0.14, 12),
    new THREE.MeshStandardMaterial({ color: '#eceef0', roughness: 0.35, metalness: 0.16 })
  );
  missileNose.position.set(0.34, 0, 0);
  missileNose.rotation.z = -Math.PI / 2;
  missileNose.castShadow = true;
  missileNose.receiveShadow = true;
  missileLeft.add(missileNose);
  missileLeft.position.set(0.22, -0.18, -0.62);
  root.add(missileLeft);
  const missileRight = missileLeft.clone();
  missileRight.position.z = 0.62;
  root.add(missileRight);
  const trail = [];
  for (let i = 0; i < 6; i += 1) {
    trail.push(
      addFxSphere(
        root,
        0.11 + i * 0.03,
        [-1.76 - i * 0.2, 0, 0],
        i < 2 ? '#f7a94b' : '#8b949b',
        i < 2 ? 0.22 : 1,
        0,
        true,
        i < 2 ? 0.85 - i * 0.18 : 0.28 - (i - 2) * 0.045
      )
    );
  }
  applyMilitaryHelicopterLook(root, rotor, tailRotor);
  root.visible = false;
  return { root, rotor, tailRotor, trail };
}

function createCaptureExplosionFx() {
  const root = new THREE.Group();
  const flash = addFxSphere(root, 0.28, [0, 0.25, 0], '#ffe29f', 0.05, 0, true, 1);
  const fire = [];
  const smoke = [];
  const firePalette = ['#ffd166', '#ff8c1a', '#ff4d3d', '#d7263d', '#ff8fab', '#ffe45e'];
  for (let i = 0; i < 6; i += 1) {
    fire.push(
      addFxSphere(
        root,
        0.21 + i * 0.05,
        [0, 0.2 + i * 0.045, 0],
        firePalette[i % firePalette.length],
        0.2,
        0,
        true,
        0.98 - i * 0.1
      )
    );
  }
  for (let i = 0; i < 6; i += 1) {
    smoke.push(
      addFxSphere(
        root,
        0.17 + i * 0.037,
        [0, 0.165 + i * 0.067, 0],
        '#646b72',
        1,
        0,
        true,
        0.34 - i * 0.035
      )
    );
  }
  root.scale.setScalar(0.27);
  root.visible = false;
  return { root, flash, fire, smoke };
}

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

function detectUltraRefreshDisplay() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  const queries = ['(min-refresh-rate: 143hz)', '(min-refresh-rate: 144hz)'];
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

function isWebGLAvailable() {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');
    return Boolean(gl);
  } catch (err) {
    console.warn('WebGL availability check failed', err);
    return false;
  }
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
    return DEFAULT_FRAME_RATE_ID;
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
  const ultraRefresh = detectUltraRefreshDisplay();
  const rendererTier = classifyRendererTier(readGraphicsRendererString());

  if (lowRefresh) {
    return 'hd50';
  }

  if (isMobileUA || coarsePointer || isTouch || rendererTier === 'mobile') {
    if ((deviceMemory !== null && deviceMemory <= 4) || hardwareConcurrency <= 4) {
      return 'hd50';
    }
    if (ultraRefresh && hardwareConcurrency >= 8 && (deviceMemory == null || deviceMemory >= 8)) {
      return 'uhd144';
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
    return DEFAULT_FRAME_RATE_ID;
  }

  if (ultraRefresh && (rendererTier === 'desktopHigh' || hardwareConcurrency >= 8)) {
    return 'uhd144';
  }

  if (rendererTier === 'desktopHigh' || hardwareConcurrency >= 8) {
    return 'uhd120';
  }

  if (rendererTier === 'desktopMid') {
    return 'qhd90';
  }

  return DEFAULT_FRAME_RATE_ID;
}

function isLikelyMobileDevice() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  const coarsePointer = detectCoarsePointer();
  const ua = navigator.userAgent ?? '';
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const maxTouchPoints = navigator.maxTouchPoints ?? 0;
  const isTouch = maxTouchPoints > 1;
  const rendererTier = classifyRendererTier(readGraphicsRendererString());
  return isMobileUA || coarsePointer || isTouch || rendererTier === 'mobile';
}

const ABG_MODEL_URLS = Object.freeze([
  'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/ABeautifulGame/glTF-Binary/ABeautifulGame.glb',
  'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/ABeautifulGame/glTF/ABeautifulGame.gltf'
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
let proceduralTokenHeight = null;

const BASE_ARENA_SCALE = 0.85;
// Keep the exact layout, but make the full table setup (table + board + chairs + attached animations)
// slightly smaller in world space while preserving the exact relative layout.
const LUDO_ARENA_SHRINK_FACTOR = 0.374;
const ARENA_SCALE = 0.72 * LUDO_ARENA_SHRINK_FACTOR;
const ARENA_SCALE_RATIO = ARENA_SCALE / BASE_ARENA_SCALE;
const MODEL_SCALE = 0.75 * ARENA_SCALE;
const TABLE_SIDE_SHRINK_FACTOR = 0.92;
const TABLE_RADIUS = 4.2 * MODEL_SCALE * TABLE_SIDE_SHRINK_FACTOR;
const TABLE_HEIGHT_SCALE = 0.56;
const BASE_TABLE_HEIGHT = 1.03 * MODEL_SCALE * TABLE_HEIGHT_SCALE;
const TABLE_VISUAL_SCALE = 0.9;
const TABLE_SIDE_EXPANSION_FACTOR = 1;
const TABLE_EDGE_INSET = TABLE_RADIUS * (1 - TABLE_VISUAL_SCALE);
const CHAIR_GLOBAL_SCALE = 0.5;
const STOOL_SCALE = 1.5 * 1.3 * CHAIR_GLOBAL_SCALE;
const SEAT_WIDTH = 0.9 * MODEL_SCALE * STOOL_SCALE;
const SEAT_DEPTH = 0.95 * MODEL_SCALE * STOOL_SCALE;
const SEAT_THICKNESS = 0.09 * MODEL_SCALE * STOOL_SCALE;
const BACK_HEIGHT = 0.68 * MODEL_SCALE * STOOL_SCALE;
const BACK_THICKNESS = 0.08 * MODEL_SCALE * STOOL_SCALE;
const ARM_THICKNESS = 0.125 * MODEL_SCALE * STOOL_SCALE;
const ARM_HEIGHT = 0.3 * MODEL_SCALE * STOOL_SCALE;
const ARM_DEPTH = SEAT_DEPTH * 0.75;
const CHAIR_LEG_TRIM_FACTOR = 0.64;
const BASE_COLUMN_HEIGHT = 0.5 * MODEL_SCALE * STOOL_SCALE * CHAIR_LEG_TRIM_FACTOR;
const CARD_SCALE = 0.95;
const CARD_W = 0.4 * MODEL_SCALE * CARD_SCALE;
const HUMAN_SEAT_ROTATION_OFFSET = Math.PI / 8;
const AI_CHAIR_GAP = CARD_W * 0.74;
const CHAIR_BASE_HEIGHT = BASE_TABLE_HEIGHT - SEAT_THICKNESS * 1.1;
const STOOL_HEIGHT = CHAIR_BASE_HEIGHT + SEAT_THICKNESS;
const TABLE_VERTICAL_LOWERING = 0.198 * MODEL_SCALE;
const TABLE_EXTRA_LOWERING = 0.048 * MODEL_SCALE;
const TABLE_HEIGHT_LIFT = 0.025 * MODEL_SCALE - TABLE_VERTICAL_LOWERING - TABLE_EXTRA_LOWERING;
const TABLE_HEIGHT = STOOL_HEIGHT + TABLE_HEIGHT_LIFT;
const CHAIR_OUTWARD_OFFSET = 0.31 * MODEL_SCALE;
const CHAIR_INWARD_PULL = 0.22 * MODEL_SCALE;
const AI_CHAIR_RADIUS =
  TABLE_RADIUS +
  SEAT_DEPTH / 2 +
  AI_CHAIR_GAP +
  0.19 * MODEL_SCALE +
  CHAIR_OUTWARD_OFFSET -
  TABLE_EDGE_INSET -
  CHAIR_INWARD_PULL;
const CHAIR_GLOBAL_PUSHBACK = 0.065 * MODEL_SCALE;
const SELF_BOTTOM_CHAIR_EXTRA_PUSHBACK = 0.11 * MODEL_SCALE;

const DEFAULT_PLAYER_COUNT = 4;
const clampPlayerCount = (value) =>
  clamp(
    Number.isFinite(value) ? Math.floor(value) : DEFAULT_PLAYER_COUNT,
    1,
    DEFAULT_PLAYER_COUNT
  );
const CUSTOM_CHAIR_ANGLES = [
  THREE.MathUtils.degToRad(90),
  THREE.MathUtils.degToRad(0),
  THREE.MathUtils.degToRad(270),
  THREE.MathUtils.degToRad(180)
];
const AI_ROLL_DELAY_MS = 2000;
const AI_EXTRA_TURN_DELAY_MS = 1600;
const HUMAN_ROLL_DELAY_MS = 2600;
const AUTO_ROLL_DURATION_MS = 1100;
const DICE_RESULT_EXTRA_HOLD_MS = 3000;
const ANIMATION_BASE_FPS = 60;
const MIN_ANIMATION_SPEED_MULTIPLIER = 0.62;
const MAX_ANIMATION_SPEED_MULTIPLIER = 1.2;
const AVATAR_ANCHOR_HEIGHT = SEAT_THICKNESS / 2 + BACK_HEIGHT * 0.85;
const CHAIR_SIZE_SCALE = CHAIR_GLOBAL_SCALE;
const CHAIR_MODEL_URLS = [
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/AntiqueChair/glTF-Binary/AntiqueChair.glb',
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/SheenChair/glTF-Binary/SheenChair.glb',
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/AntiqueChair/glTF-Binary/AntiqueChair.glb'
];
const TARGET_CHAIR_SIZE = new THREE.Vector3(1.3162499970197679, 1.9173749900311232, 1.7001562547683715).multiplyScalar(
  CHAIR_SIZE_SCALE
);
const CHAIR_BOTTOM_TRIM_SCALE = 0.74;
TARGET_CHAIR_SIZE.y *= 0.84;
const TARGET_CHAIR_MIN_Y = -0.8570624993294478 * CHAIR_SIZE_SCALE + 0.07 * CHAIR_SIZE_SCALE;
const TARGET_CHAIR_CENTER_Z = -0.1553906416893005 * CHAIR_SIZE_SCALE;

const FALLBACK_SEAT_POSITIONS = [
  { left: '50%', top: '84%' },
  { left: '80%', top: '56%' },
  { left: '52%', top: '24%' },
  { left: '20%', top: '56%' }
];
const SELF_AVATAR_BOTTOM_OFFSET_PERCENT = 8;

const colorNumberToHex = (value) => `#${value.toString(16).padStart(6, '0')}`;

const normalizeColorValue = (value, fallback) => {
  if (value == null) return fallback;
  if (typeof value === 'string') return new THREE.Color(value).getHex();
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

function resolvePlayerColors(appearance = {}) {
  const paletteOption = TOKEN_PALETTE_OPTIONS[appearance.tokenPalette] ?? TOKEN_PALETTE_OPTIONS[0];
  const swatches = paletteOption?.swatches ?? [];
  return PLAYER_COLOR_ORDER.map((_, idx) => normalizeColorValue(swatches[idx], DEFAULT_PLAYER_COLORS[idx]));
}

const CAMERA_FOV = ARENA_CAMERA_DEFAULTS.fov;
const CAMERA_NEAR = ARENA_CAMERA_DEFAULTS.near;
const CAMERA_FAR = ARENA_CAMERA_DEFAULTS.far;
const CAMERA_DOLLY_FACTOR = ARENA_CAMERA_DEFAULTS.wheelDeltaFactor;
const CAMERA_TARGET_LIFT = 0.028 * MODEL_SCALE;
const CAMERA_SIDE_LOOK_EXTRA = 0.13;
const CAMERA_TURN_PLAYER_LERP = 0.58;
const CAMERA_BROADCAST_TARGET_BLEND = 0.6;
const CAMERA_BROADCAST_SIDE_BLEND = 0.82;
const CAMERA_SIDE_AVATAR_BLEND = 1.08;
const USER_TURN_CAMERA_PULLBACK = 0.15 * MODEL_SCALE;
const USER_TURN_CAMERA_LIFT = 0.09 * MODEL_SCALE;
const LUDO_CAMERA_AUTO_LOOK_ENABLED = true;
const LUDO_CAMERA_BROADCAST_LOCKED_POSITION = false;
const CAMERA_FREE_LOOK_AZIMUTH_RANGE = THREE.MathUtils.degToRad(26);
const CAMERA_FREE_LOOK_POLAR_DELTA = THREE.MathUtils.degToRad(16);
const CAMERA_ZOOM_MIN_FACTOR = 1;
const CAMERA_ZOOM_MAX_FACTOR = 1;
const LUDO_CAMERA_PHI_MIN = 0.92;
const LUDO_CAMERA_PHI_MAX = 1.22;
const LANDSCAPE_CAMERA_TUNING = Object.freeze({
  backOffset: 0.54,
  forwardOffset: 0,
  heightOffset: 1.08,
  targetLift: 0.08 * MODEL_SCALE
});
const PORTRAIT_CAMERA_TUNING = Object.freeze({
  backOffset: 0.74,
  forwardOffset: 0,
  heightOffset: 2.3,
  targetLift: 0.055 * MODEL_SCALE
});
const CAMERA_EXTRA_PULLBACK = 0;
const CAMERA_EXTRA_LIFT = 0.064;
const PORTRAIT_CAMERA_EXTRA_LIFT = 0.048;
const CAMERA_PLAYER_CENTER_X_EPSILON = 0.0001;
const CAMERA_LOOK_YAW_LIMIT = THREE.MathUtils.degToRad(26);
const CAMERA_LOOK_YAW_DRAG_FACTOR = 0.0055;
const CAMERA_LOOK_PITCH_LIMIT = THREE.MathUtils.degToRad(22);
const CAMERA_LOOK_MIN_PITCH = THREE.MathUtils.degToRad(-10);
const CAMERA_LOOK_PITCH_DRAG_FACTOR = -0.0038;
const CAMERA_LOOK_YAW_RECENTER_SPEED = 0.055;
const LUDO_CAMERA_CUSTOM_LOOK_ENABLED = true;
const CAMERA_TOUCH_PULL_FORWARD_FACTOR = 0.0032;
const CAMERA_TOUCH_PULL_FORWARD_MAX_RATIO = 0.32;
const CAMERA_TOUCH_PULL_BACK_MAX_RATIO = 0.4;
const CAMERA_TOUCH_LIFT_FACTOR = 0.0016;
const CAMERA_TOUCH_LIFT_MAX = 0.065 * MODEL_SCALE;
const HDRI_GROUND_ALIGNMENT_OFFSET = -0.085 * MODEL_SCALE;
const LUDO_HDRI_MAIN_SCENE_FACING_ROTATION_Y = Math.PI / 2;

const DEFAULT_STOOL_THEME = Object.freeze({ legColor: '#1f1f1f' });
const DEFAULT_HDRI_RESOLUTIONS = Object.freeze(['2k']);
const DEFAULT_HDRI_CAMERA_HEIGHT_M = 1.2;
const MIN_HDRI_CAMERA_HEIGHT_M = 0.8;
const DEFAULT_HDRI_RADIUS_MULTIPLIER = 6;
const MIN_HDRI_RADIUS = 24;
const HDRI_GROUNDED_RESOLUTION = 256;
const HDRI_UNITS_PER_METER = 1;
const LUDO_HDRI_OPTIONS = Object.freeze(
  POOL_ROYALE_HDRI_VARIANTS.map((variant) => ({
    ...variant,
    label: `${variant.name} HDRI`
  }))
);
const DEFAULT_HDRI_INDEX = Math.max(
  0,
  LUDO_HDRI_OPTIONS.findIndex((variant) => variant.id === POOL_ROYALE_DEFAULT_HDRI_ID)
);
const DEFAULT_HDRI_VARIANT = LUDO_HDRI_OPTIONS[DEFAULT_HDRI_INDEX] ?? LUDO_HDRI_OPTIONS[0] ?? null;
const TABLE_FINISH_OPTIONS = Object.freeze([...MURLAN_TABLE_FINISHES]);
const DEFAULT_TABLE_FINISH = TABLE_FINISH_OPTIONS[0] ?? null;
const DEFAULT_WOOD_OPTION = DEFAULT_TABLE_FINISH?.woodOption ?? TABLE_WOOD_OPTIONS[0];
const DEFAULT_CLOTH_OPTION = TABLE_CLOTH_OPTIONS[0];
const DEFAULT_BASE_OPTION = TABLE_BASE_OPTIONS[0];
const TABLE_MODEL_TARGET_DIAMETER = TABLE_RADIUS * 2 * TABLE_VISUAL_SCALE;

function createAiUniqueLoadout(activePlayerCount) {
  const totalPlayers = Math.max(1, Number(activePlayerCount) || 1);
  const byPlayer = Array.from({ length: totalPlayers }, () => ({
    tokenPieceIndex: 0,
    captureAnimationIndex: 0
  }));
  const aiIndexes = Array.from({ length: Math.max(0, totalPlayers - 1) }, (_, idx) => idx + 1);
  if (!aiIndexes.length) return byPlayer;

  const shuffle = (items) => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const piecePool = shuffle(Array.from({ length: TOKEN_PIECE_OPTIONS.length }, (_, idx) => idx));
  const capturePool = shuffle(Array.from({ length: CAPTURE_ANIMATION_OPTIONS.length }, (_, idx) => idx));

  aiIndexes.forEach((playerIndex, aiIndex) => {
    byPlayer[playerIndex] = {
      tokenPieceIndex: piecePool[aiIndex % piecePool.length] ?? 0,
      captureAnimationIndex: capturePool[aiIndex % capturePool.length] ?? 0
    };
  });
  return byPlayer;
}
const TABLE_MODEL_TARGET_HEIGHT = TABLE_HEIGHT;
const TABLE_LEG_EXTENSION_FACTOR = 1.22;
const BASIS_TRANSCODER_PATH = 'https://cdn.jsdelivr.net/npm/three@0.164.0/examples/jsm/libs/basis/';
const DRACO_DECODER_PATH = 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/';
const PREFERRED_TEXTURE_SIZES = ['4k', '2k', '1k'];
const POLYHAVEN_MODEL_CACHE = new Map();
const resolveHdriVariant = (index) => {
  const max = LUDO_HDRI_OPTIONS.length - 1;
  const idx = Number.isFinite(index) ? Math.min(Math.max(Math.round(index), 0), max) : DEFAULT_HDRI_INDEX;
  return LUDO_HDRI_OPTIONS[idx] ?? LUDO_HDRI_OPTIONS[DEFAULT_HDRI_INDEX] ?? LUDO_HDRI_OPTIONS[0];
};

const APPEARANCE_STORAGE_KEY = 'ludoBattleRoyalArenaAppearance';
const DEFAULT_APPEARANCE = {
  tables: 0,
  tableFinish: 0,
  tableCloth: 0,
  stools: 0,
  environmentHdri: DEFAULT_HDRI_INDEX,
  tokenPalette: 0,
  tokenStyle: 0,
  tokenPiece: 0,
  captureAnimation: 0
};

const CUSTOMIZATION_SECTIONS = [
  { key: 'tables', label: 'Table Model', options: MURLAN_TABLE_THEMES },
  { key: 'tableFinish', label: 'Table Finish', options: TABLE_FINISH_OPTIONS },
  { key: 'tableCloth', label: 'Table Cloth', options: TABLE_CLOTH_OPTIONS },
  { key: 'stools', label: 'Chairs', options: MURLAN_STOOL_THEMES },
  { key: 'environmentHdri', label: 'HDR Environments', options: LUDO_HDRI_OPTIONS },
  { key: 'tokenPalette', label: 'Token Palette', options: TOKEN_PALETTE_OPTIONS },
  { key: 'tokenStyle', label: 'Token Style', options: TOKEN_STYLE_OPTIONS },
  { key: 'tokenPiece', label: 'Token Piece', options: TOKEN_PIECE_OPTIONS },
  { key: 'captureAnimation', label: 'Capture Animation', options: CAPTURE_ANIMATION_OPTIONS }
];

const FRAME_RATE_STORAGE_KEY = 'ludoFrameRate';
const FRAME_RATE_OPTIONS = Object.freeze([
  {
    id: 'hd50',
    label: 'HD Performance (50 Hz)',
    fps: 50,
    renderScale: 0.82,
    pixelRatioCap: 1.15,
    resolution: '2K assets • fallback 1K',
    description: 'Battery saver profile that keeps Poly Haven textures and HDRIs on official 2K assets.',
    hdriPreferredResolutions: ['2k'],
    hdriFallbackResolution: '2k',
    texturePreferredSizes: ['2k', '1k']
  },
  {
    id: 'fhd60',
    label: 'Full HD (60 Hz)',
    fps: 60,
    renderScale: 0.92,
    pixelRatioCap: 1.25,
    resolution: '2K assets • fallback 1K',
    description: '60 Hz profile: HDRI + table/cloth/board/tokens/dice/chairs/UI run at official 2K.',
    hdriPreferredResolutions: ['2k'],
    hdriFallbackResolution: '2k',
    texturePreferredSizes: ['2k', '1k']
  },
  {
    id: 'qhd90',
    label: 'Quad HD (90 Hz)',
    fps: 90,
    renderScale: 1,
    pixelRatioCap: 1.4,
    resolution: '4K assets • fallback 2K',
    description: '90 Hz profile: targets official 4K Poly Haven assets with 2K fallback.',
    hdriPreferredResolutions: ['4k', '2k'],
    hdriFallbackResolution: '2k',
    texturePreferredSizes: ['4k', '2k', '1k']
  },
  {
    id: 'uhd120',
    label: 'Ultra HD (120 Hz)',
    fps: 120,
    renderScale: 1.08,
    pixelRatioCap: 1.5,
    resolution: '8K assets • fallback 4K',
    description: '120 Hz profile: targets official 8K Poly Haven assets with 4K fallback.',
    hdriPreferredResolutions: ['8k', '4k'],
    hdriFallbackResolution: '4k',
    texturePreferredSizes: ['8k', '4k', '2k']
  },
  {
    id: 'uhd144',
    label: 'Ultra+ HD (144 Hz)',
    fps: 144,
    renderScale: 1.12,
    pixelRatioCap: 1.6,
    resolution: '8K assets • fallback 4K',
    description: '144 Hz profile: forces 8K-first Poly Haven assets for maximum clarity.',
    hdriPreferredResolutions: ['8k', '4k'],
    hdriFallbackResolution: '4k',
    texturePreferredSizes: ['8k', '4k', '2k']
  }
]);
const DEFAULT_FRAME_RATE_ID = 'fhd60';
const DEFAULT_FRAME_RATE_OPTION =
  FRAME_RATE_OPTIONS.find((option) => option.id === DEFAULT_FRAME_RATE_ID) ?? FRAME_RATE_OPTIONS[0];

function normalizeAppearance(value = {}) {
  const normalized = { ...DEFAULT_APPEARANCE };
  const entries = [
    ['tables', MURLAN_TABLE_THEMES.length],
    ['tableFinish', TABLE_FINISH_OPTIONS.length],
    ['tableCloth', TABLE_CLOTH_OPTIONS.length],
    ['stools', MURLAN_STOOL_THEMES.length],
    ['environmentHdri', LUDO_HDRI_OPTIONS.length],
    ['tokenPalette', TOKEN_PALETTE_OPTIONS.length],
    ['tokenStyle', TOKEN_STYLE_OPTIONS.length],
    ['tokenPiece', TOKEN_PIECE_OPTIONS.length],
    ['captureAnimation', CAPTURE_ANIMATION_OPTIONS.length]
  ];
  entries.forEach(([key, max]) => {
    const raw = Number(value?.[key]);
    if (Number.isFinite(raw)) {
      const clamped = Math.min(Math.max(0, Math.round(raw)), max - 1);
      normalized[key] = clamped;
    }
  });
  return normalized;
}

function adjustHexColor(hex, amount) {
  const base = new THREE.Color(hex);
  const target = amount >= 0 ? new THREE.Color(0xffffff) : new THREE.Color(0x000000);
  base.lerp(target, Math.min(Math.abs(amount), 1));
  return `#${base.getHexString()}`;
}

function abgNodePath(node) {
  const names = [];
  let current = node;
  while (current) {
    if (current.name) names.push(current.name);
    current = current.parent;
  }
  return names.reverse().join('/');
}

function abgDetectType(path) {
  const lower = path.toLowerCase();
  for (const [t, re] of ABG_TYPE_ALIASES) {
    if (re.test(lower)) return t;
  }
  return undefined;
}

function abgDetectColor(path, luminanceHint = 0.6) {
  if (ABG_COLOR_W.test(path)) return 'w';
  if (ABG_COLOR_B.test(path)) return 'b';
  return luminanceHint >= 0.5 ? 'w' : 'b';
}

function abgAverageLuminance(root) {
  let sum = 0;
  let count = 0;
  root.traverse((node) => {
    if (!node.isMesh) return;
    const mats = Array.isArray(node.material) ? node.material : [node.material];
    mats.forEach((mat) => {
      if (mat?.color) {
        const c = mat.color;
        sum += 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
        count += 1;
      }
    });
  });
  return count ? sum / count : 0.5;
}

function abgCloneWithMats(src) {
  const clone = src.clone(true);
  clone.traverse((node) => {
    if (node.isMesh) {
      if (Array.isArray(node.material)) {
        node.material = node.material.map((m) => m?.clone?.() ?? m);
      } else if (node.material) {
        node.material = node.material.clone();
      }
      node.castShadow = true;
      node.receiveShadow = true;
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

function measureProceduralTokenHeight() {
  if (proceduralTokenHeight) return proceduralTokenHeight;
  proceduralTokenHeight = 0.09;
  return proceduralTokenHeight;
}

const STANDARD_TOKEN_FOOTPRINT = Object.freeze({ x: 0.054, z: 0.054 });

function abgPreparePiece(src) {
  const clone = abgCloneWithMats(src);
  const { size } = abgBbox(clone);
  const targetHeight = measureProceduralTokenHeight();
  if (size.y) {
    const scale = targetHeight / size.y;
    clone.scale.setScalar(scale);
    clone.updateMatrixWorld(true);
    let scaledBox = new THREE.Box3().setFromObject(clone);
    const scaledSize = scaledBox.getSize(new THREE.Vector3());
    const scaleX = scaledSize.x > 1e-6 ? STANDARD_TOKEN_FOOTPRINT.x / scaledSize.x : 1;
    const scaleZ = scaledSize.z > 1e-6 ? STANDARD_TOKEN_FOOTPRINT.z / scaledSize.z : 1;
    clone.scale.set(clone.scale.x * scaleX, clone.scale.y, clone.scale.z * scaleZ);
    clone.updateMatrixWorld(true);
    scaledBox = new THREE.Box3().setFromObject(clone);
    const center = scaledBox.getCenter(new THREE.Vector3());
    clone.position.x -= center.x;
    clone.position.z -= center.z;
    clone.position.y -= scaledBox.min.y;
  }
  const group = new THREE.Group();
  group.add(clone);
  group.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
  return group;
}

function tintGltfToken(node, tint) {
  if (!node || !tint) return;
  const target = new THREE.Color(tint);
  node.traverse((child) => {
    if (!child.isMesh) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    mats.forEach((mat) => {
      if (!mat) return;
      if (mat.color?.set) {
        mat.color.set(target);
      }
      if (mat.emissive?.set) {
        mat.emissive.set(0x000000);
      }
      mat.needsUpdate = true;
    });
  });
}

function resolveAbgColorKey() {
  return 'w';
}

function resolveAbgPrototype(proto, colorKey, type) {
  if (!proto) return null;
  return proto[colorKey]?.[type] ?? proto[colorKey]?.p ?? proto.w?.p ?? proto.b?.p ?? null;
}

function applyTokenFacingRotation(token) {
  if (!token?.rotation) return;
  const typeKey = String(token.userData?.tokenType || '').toLowerCase();
  const baseY = token.userData?.baseFacingY ?? token.rotation.y ?? 0;
  if (!token.userData) token.userData = {};
  if (!Number.isFinite(token.userData.baseFacingY)) {
    token.userData.baseFacingY = baseY;
  }
  if (typeKey === 'king') {
    token.rotation.set(0, baseY + Math.PI, 0);
    return;
  }
  if (typeKey === 'knight' || typeKey === 'horse') {
    token.rotation.set(0, baseY + Math.PI / 4, 0);
    return;
  }
  token.rotation.set(0, baseY, 0);
}

function cloneAbgToken(proto) {
  if (!proto) return null;
  return abgCloneWithMats(proto);
}

let abgAssetPromise = null;
async function getAbgAssets() {
  if (abgAssetPromise) return abgAssetPromise;
  abgAssetPromise = (async () => {
    const loader = new GLTFLoader();
    loader.setCrossOrigin('anonymous');
    const draco = new DRACOLoader();
    draco.setDecoderPath(DRACO_DECODER_PATH);
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
    const boards = [];

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
        void colorKey;
        if (/board|table|chessboard/i.test(node.name || '')) boards.push(node);
      }
      if (!type) return;
      const color = abgDetectColor(path, abgAverageLuminance(node));
      if (!proto[color][type]) {
        proto[color][type] = node;
      }
    });

    const boardNode = boards[0] || root;
    (['w', 'b']).forEach((color) => {
      ABG_TYPES.forEach((type) => {
        if (!proto[color][type]) {
          const other = color === 'w' ? 'b' : 'w';
          if (proto[other][type]) {
            const clone = abgCloneWithMats(proto[other][type]);
            proto[color][type] = clone;
          }
        }
        if (proto[color][type]) {
          proto[color][type] = abgPreparePiece(proto[color][type]);
        }
      });
    });

    return { proto, boardPrototype: abgCloneWithMats(boardNode) };
  })();
  return abgAssetPromise;
}

function cloneBoardMaterial(base, color) {
  const mat = base?.clone?.() ?? new THREE.MeshStandardMaterial({ color });
  if (mat.color) {
    mat.color.set(color);
  }
  if (mat.emissive) {
    mat.emissive.set(0x000000);
  }
  return mat;
}

let sharedKtx2Loader = null;

function createConfiguredGLTFLoader(renderer = null, manager = undefined) {
  const loader = new GLTFLoader(manager);
  loader.setCrossOrigin('anonymous');
  const draco = new DRACOLoader();
  draco.setDecoderPath(DRACO_DECODER_PATH);
  loader.setDRACOLoader(draco);
  loader.setMeshoptDecoder(MeshoptDecoder);

  if (!sharedKtx2Loader) {
    sharedKtx2Loader = new KTX2Loader();
    sharedKtx2Loader.setTranscoderPath(BASIS_TRANSCODER_PATH);
    const supportRenderer =
      renderer || (typeof document !== 'undefined' ? new THREE.WebGLRenderer({ antialias: false, alpha: true }) : null);
    if (supportRenderer) {
      try {
        sharedKtx2Loader.detectSupport(supportRenderer);
      } catch (error) {
        console.warn('KTX2 detection failed', error);
      }
      if (!renderer) supportRenderer.dispose();
    }
  }

  loader.setKTX2Loader(sharedKtx2Loader);
  return loader;
}

function normalizeMaterialTextures(material, maxAnisotropy = 8, { preserveGltfTextureMapping = false } = {}) {
  if (!material) return;
  const normalizeTex = (texture, isColor = false) => {
    if (!texture) return;
    if (isColor) applySRGBColorSpace(texture);
    texture.flipY = false;
    if (!preserveGltfTextureMapping) {
      texture.wrapS = texture.wrapS ?? THREE.RepeatWrapping;
      texture.wrapT = texture.wrapT ?? THREE.RepeatWrapping;
    }
    texture.anisotropy = Math.max(texture.anisotropy ?? 1, maxAnisotropy);
    texture.needsUpdate = true;
  };
  normalizeTex(material.map, true);
  normalizeTex(material.emissiveMap, true);
  normalizeTex(material.normalMap, false);
  normalizeTex(material.roughnessMap, false);
  normalizeTex(material.metalnessMap, false);
  normalizeTex(material.aoMap, false);
}

function prepareLoadedModel(model, { preserveGltfTextureMapping = false } = {}) {
  if (!model) return;
  model.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((mat) => {
        if (!mat) return;
        normalizeMaterialTextures(mat, 8, { preserveGltfTextureMapping });
        mat.needsUpdate = true;
      });
    }
  });
}

function disposeObjectResources(object) {
  if (!object) return;
  const materials = new Set();
  object.traverse((obj) => {
    if (!obj.isMesh) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach((mat) => mat && materials.add(mat));
    obj.geometry?.dispose?.();
  });
  materials.forEach((mat) => {
    if (mat?.map) mat.map.dispose?.();
    if (mat?.emissiveMap) mat.emissiveMap.dispose?.();
    mat?.dispose?.();
  });
}

const buildPolyhavenModelUrls = (assetId) => {
  const ids = Array.from(new Set([assetId, assetId?.toLowerCase?.()]));
  const urls = [];
  ids.forEach((id) => {
    if (!id) return;
    urls.push(
      `https://dl.polyhaven.org/file/ph-assets/Models/gltf/2k/${id}/${id}_2k.gltf`,
      `https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/${id}/${id}_1k.gltf`
    );
  });
  return urls;
};

function pickBestTextureUrls(apiJson, preferredSizes = PREFERRED_TEXTURE_SIZES) {
  if (!apiJson || typeof apiJson !== 'object') {
    return { diffuse: null, normal: null, roughness: null };
  }

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

function extractPolyhavenIncludeUrlMap(manifest, resolution = '2k') {
  const include = manifest?.gltf?.[resolution]?.gltf?.include;
  if (!include || typeof include !== 'object') return null;
  const map = new Map();
  Object.entries(include).forEach(([relativePath, entry]) => {
    if (!relativePath || typeof relativePath !== 'string') return;
    const fileUrl = entry?.url;
    if (!fileUrl || typeof fileUrl !== 'string') return;
    map.set(relativePath, fileUrl);
    map.set(relativePath.replace(/^\.\//, ''), fileUrl);
    map.set(relativePath.split('/').pop() || relativePath, fileUrl);
  });
  return map;
}

function buildPolyhavenManifestCandidates(manifest, resolutionOrder = ['2k', '1k']) {
  if (!manifest?.gltf || typeof manifest.gltf !== 'object') return [];
  const availableResolutions = Object.keys(manifest.gltf);
  const orderedResolutions = Array.from(new Set([...resolutionOrder, ...availableResolutions]));
  return orderedResolutions
    .map((resolution) => {
      const url = manifest?.gltf?.[resolution]?.gltf?.url;
      if (!url || typeof url !== 'string') return null;
      return {
        url,
        includeUrlMap: extractPolyhavenIncludeUrlMap(manifest, resolution)
      };
    })
    .filter(Boolean);
}

function createPolyhavenGltfLoader(renderer = null, includeUrlMap = null) {
  const manager = new THREE.LoadingManager();
  if (includeUrlMap?.size) {
    manager.setURLModifier((requestUrl = '') => {
      const cleanUrl = String(requestUrl || '').split('?')[0];
      const normalized = cleanUrl.replace(/^\.\//, '');
      const fileName = normalized.split('/').pop();
      return (
        includeUrlMap.get(cleanUrl) ||
        includeUrlMap.get(normalized) ||
        includeUrlMap.get(fileName) ||
        requestUrl
      );
    });
  }
  return createConfiguredGLTFLoader(renderer, manager);
}

async function loadPolyhavenModel(assetId, renderer = null) {
  if (!assetId) throw new Error('Missing Poly Haven asset id');
  const cacheKey = assetId.toLowerCase();
  if (POLYHAVEN_MODEL_CACHE.has(cacheKey)) {
    return POLYHAVEN_MODEL_CACHE.get(cacheKey);
  }

  const promise = (async () => {
    const candidates = [];
    try {
      const response = await fetch(`https://api.polyhaven.com/files/${encodeURIComponent(assetId)}`);
      if (response.ok) {
        const manifest = await response.json();
        candidates.push(...buildPolyhavenManifestCandidates(manifest));
      }
    } catch (error) {
      console.warn('Poly Haven manifest lookup failed, using direct model URL fallback', error);
    }
    buildPolyhavenModelUrls(assetId).forEach((url) => candidates.push({ url, includeUrlMap: null }));
    let lastError = null;
    for (const candidate of candidates) {
      try {
        const modelUrl = candidate?.url;
        if (!modelUrl) continue;
        const loader = createPolyhavenGltfLoader(renderer, candidate?.includeUrlMap ?? null);
        const resolvedUrl = new URL(modelUrl, typeof window !== 'undefined' ? window.location?.href : modelUrl).href;
        const resourcePath = resolvedUrl.substring(0, resolvedUrl.lastIndexOf('/') + 1);
        loader.setResourcePath(resourcePath);
        loader.setPath('');
        // eslint-disable-next-line no-await-in-loop
        const gltf = await loader.loadAsync(resolvedUrl);
        const root = gltf.scene || gltf.scenes?.[0] || gltf;
        if (root) {
          prepareLoadedModel(root, { preserveGltfTextureMapping: true });
          return root;
        }
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error(`Failed to load Poly Haven model for ${assetId}`);
  })();

  POLYHAVEN_MODEL_CACHE.set(cacheKey, promise);
  promise.catch(() => POLYHAVEN_MODEL_CACHE.delete(cacheKey));
  return promise;
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

async function loadPolyhavenTextureSet(
  assetId,
  textureLoader,
  maxAnisotropy = 1,
  cache = null,
  preferredSizes = PREFERRED_TEXTURE_SIZES
) {
  if (!assetId || !textureLoader) return null;
  const preferredStack =
    Array.isArray(preferredSizes) && preferredSizes.length ? preferredSizes : PREFERRED_TEXTURE_SIZES;
  const key = `${assetId.toLowerCase()}|${maxAnisotropy}|${preferredStack.join(',')}`;
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
      const urls = pickBestTextureUrls(json, preferredStack);
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

function fitTableModelToArena(model, tableThemeId = null) {
  if (!model) return { surfaceY: TABLE_MODEL_TARGET_HEIGHT, radius: TABLE_RADIUS };
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const maxXZ = Math.max(size.x, size.z);
  const targetHeight = TABLE_MODEL_TARGET_HEIGHT;
  const targetDiameter =
    TABLE_MODEL_TARGET_DIAMETER * TABLE_SIDE_EXPANSION_FACTOR * getTableWidthScale(tableThemeId);
  const targetRadius = targetDiameter / 2;
  const scaleY = size.y > 0 ? targetHeight / size.y : 1;
  const scaleXZ = maxXZ > 0 ? targetDiameter / maxXZ : 1;
  if (scaleY !== 1 || scaleXZ !== 1) {
    model.scale.set(model.scale.x * scaleXZ, model.scale.y * scaleY, model.scale.z * scaleXZ);
  }
  if (TABLE_LEG_EXTENSION_FACTOR !== 1) {
    const stretchedScaleY = model.scale.y * TABLE_LEG_EXTENSION_FACTOR;
    model.scale.set(model.scale.x, stretchedScaleY, model.scale.z);
  }
  const scaledBox = new THREE.Box3().setFromObject(model);
  const center = scaledBox.getCenter(new THREE.Vector3());
  const topAfterStretch = scaledBox.max.y;
  const topCorrection = targetHeight - topAfterStretch;
  model.position.add(new THREE.Vector3(-center.x, -scaledBox.min.y + topCorrection, -center.z));
  const recenteredBox = new THREE.Box3().setFromObject(model);
  void recenteredBox;
  const radius = targetRadius;
  return {
    surfaceY: targetHeight,
    radius
  };
}

function getTableWidthScale(tableThemeId) {
  const id = String(tableThemeId || '').toLowerCase();
  if (!id) return 1;
  if (id.includes('octagon')) return 1;
  return 1.06;
}

function applyBoardGroupScale(boardGroup, tableInfo) {
  if (!boardGroup) return;
  const scale = tableInfo?.group?.scale;
  const scaleX = scale?.x ?? 1;
  const scaleY = scale?.y ?? 1;
  const scaleZ = scale?.z ?? 1;
  if (scaleX && scaleY && scaleZ) {
    boardGroup.scale.set(BOARD_SCALE / scaleX, BOARD_SCALE / scaleY, BOARD_SCALE / scaleZ);
  } else {
    boardGroup.scale.setScalar(BOARD_SCALE);
  }
}

function stripTableBase(model) {
  if (!model) return;
  const toRemove = [];
  model.traverse((obj) => {
    if (!obj.isMesh) return;
    const name = (obj.name || '').toLowerCase();
    if (name.includes('base') || name.includes('pedestal') || name.includes('stand')) {
      toRemove.push(obj);
    }
  });
  toRemove.forEach((mesh) => {
    disposeObjectResources(mesh);
    mesh.parent?.remove(mesh);
  });
}

const shouldPreserveChairMaterials = (theme) => Boolean(theme?.preserveMaterials || theme?.source === 'polyhaven');

async function createPolyhavenInstance(
  assetId,
  targetHeight,
  rotationY = 0,
  renderer = null,
  textureOptions = {},
  preserveOriginalTextures = false
) {
  const root = await loadPolyhavenModel(assetId, renderer);
  const model = root.clone ? root.clone(true) : root;
  prepareLoadedModel(model);
  const {
    textureLoader = null,
    maxAnisotropy = 1,
    fallbackTexture = null,
    textureCache = null,
    textureSet = null,
    preferredTextureSizes = PREFERRED_TEXTURE_SIZES
  } = textureOptions || {};
  if (textureLoader && !preserveOriginalTextures) {
    try {
      const textures =
        textureSet ??
        (await loadPolyhavenTextureSet(
          assetId,
          textureLoader,
          maxAnisotropy,
          textureCache,
          preferredTextureSizes
        ));
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

function fitChairModelToFootprint(model) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const targetMax = Math.max(TARGET_CHAIR_SIZE.x, TARGET_CHAIR_SIZE.y, TARGET_CHAIR_SIZE.z);
  const currentMax = Math.max(size.x, size.y, size.z);
  if (currentMax > 0) {
    const scale = targetMax / currentMax;
    model.scale.multiplyScalar(scale);
  }
  model.scale.y *= CHAIR_BOTTOM_TRIM_SCALE;

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

function applyChairThemeMaterials(three, theme) {
  if (shouldPreserveChairMaterials(theme)) return;
  const mats = three?.chairMaterials;
  if (!mats) return;
  if (mats.seat?.color) {
    mats.seat.color.set(theme.seatColor);
    mats.seat.needsUpdate = true;
  }
  if (mats.leg?.color) {
    mats.leg.color.set(theme.legColor);
    mats.leg.needsUpdate = true;
  }
  (mats.upholstery ?? []).forEach((mat) => {
    if (mat?.color) {
      mat.color.set(theme.seatColor);
      mat.needsUpdate = true;
    }
  });
  (mats.metal ?? []).forEach((mat) => {
    if (mat?.color) {
      mat.color.set(theme.legColor);
      mat.needsUpdate = true;
    }
  });
}

async function loadGltfChair() {
  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath(DRACO_DECODER_PATH);
  loader.setDRACOLoader(draco);

  let gltf = null;
  let lastError = null;
  for (const url of CHAIR_MODEL_URLS) {
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

  model.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((mat) => {
        if (mat?.map) applySRGBColorSpace(mat.map);
        if (mat?.emissiveMap) applySRGBColorSpace(mat.emissiveMap);
      });
    }
  });

  fitChairModelToFootprint(model);

  return {
    chairTemplate: model,
    materials: extractChairMaterials(model)
  };
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
    }
  };
}

async function buildChairTemplate(theme, renderer = null, textureOptions = {}) {
  const preserve = shouldPreserveChairMaterials(theme);
  try {
    if (theme?.source === 'polyhaven' && theme?.assetId) {
      const model = await createPolyhavenInstance(
        theme.assetId,
        TARGET_CHAIR_SIZE.y - TARGET_CHAIR_MIN_Y,
        theme.modelRotation || 0,
        renderer,
        textureOptions,
        preserve
      );
      fitChairModelToFootprint(model);
      return {
        chairTemplate: model,
        materials: extractChairMaterials(model),
        preserveOriginal: true
      };
    }

    const gltfChair = await loadGltfChair();
    if (!preserve) {
      applyChairThemeMaterials({ chairMaterials: gltfChair.materials }, theme);
    }
    return { ...gltfChair, preserveOriginal: preserve };
  } catch (error) {
    console.error('Falling back to procedural chair', error);
  }
  const procedural = createProceduralChair(theme);
  return { ...procedural, preserveOriginal: false };
}

const pickPolyHavenHdriUrl = (json, preferred = DEFAULT_HDRI_RESOLUTIONS) => {
  if (!json || typeof json !== 'object') return null;
  const resolutions = Array.isArray(preferred) && preferred.length ? preferred : DEFAULT_HDRI_RESOLUTIONS;
  for (const res of resolutions) {
    const entry = json[res];
    if (entry?.hdr) return entry.hdr;
    if (entry?.exr) return entry.exr;
  }
  const fallback = Object.values(json).find((value) => value?.hdr || value?.exr);
  if (!fallback) return null;
  return fallback.hdr || fallback.exr || null;
};

async function resolvePolyHavenHdriUrl(config = {}) {
  const preferred =
    Array.isArray(config?.preferredResolutions) && config.preferredResolutions.length
      ? config.preferredResolutions
      : DEFAULT_HDRI_RESOLUTIONS;
  const fallbackRes = config?.fallbackResolution || preferred[0] || '2k';
  const fallbackUrl =
    config?.fallbackUrl ||
    `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/${fallbackRes}/${config?.assetId ?? 'neon_photostudio'}_${fallbackRes}.hdr`;
  if (config?.assetUrls && typeof config.assetUrls === 'object') {
    for (const res of preferred) {
      if (config.assetUrls[res]) return config.assetUrls[res];
    }
    const manual = Object.values(config.assetUrls).find((value) => typeof value === 'string' && value.length);
    if (manual) return manual;
  }
  if (typeof config?.assetUrl === 'string' && config.assetUrl.length) return config.assetUrl;
  if (!config?.assetId || typeof fetch !== 'function') return fallbackUrl;
  try {
    const response = await fetch(`https://api.polyhaven.com/files/${encodeURIComponent(config.assetId)}`);
    if (!response?.ok) return fallbackUrl;
    const json = await response.json();
    const picked = pickPolyHavenHdriUrl(json, preferred);
    return picked || fallbackUrl;
  } catch (error) {
    console.warn('Failed to resolve Poly Haven HDRI url', error);
    return fallbackUrl;
  }
}

async function loadPolyHavenHdriEnvironment(renderer, config = {}) {
  if (!renderer) return null;
  const url = await resolvePolyHavenHdriUrl(config);
  const lowerUrl = `${url ?? ''}`.toLowerCase();
  const useExr = lowerUrl.endsWith('.exr');
  const loader = useExr ? new EXRLoader() : new RGBELoader();
  loader.setCrossOrigin?.('anonymous');
  return new Promise((resolve) => {
    loader.load(
      url,
      (texture) => {
        const pmrem = new THREE.PMREMGenerator(renderer);
        pmrem.compileEquirectangularShader();
        const envMap = pmrem.fromEquirectangular(texture).texture;
        envMap.name = `${config?.assetId ?? 'polyhaven'}-env`;
        const skyboxMap = texture;
        skyboxMap.name = `${config?.assetId ?? 'polyhaven'}-skybox`;
        skyboxMap.mapping = THREE.EquirectangularReflectionMapping;
        skyboxMap.needsUpdate = true;
        pmrem.dispose();
        resolve({ envMap, skyboxMap, url });
      },
      undefined,
      (error) => {
        console.warn('Failed to load Poly Haven HDRI', error);
        resolve(null);
      }
    );
  });
}

function disposeChairAssets(chairTemplate, chairMaterials) {
  if (chairTemplate) {
    chairTemplate.traverse((obj) => {
      if (obj.isMesh) {
        obj.geometry?.dispose?.();
      }
    });
  }
  if (chairMaterials) {
    const mats = new Set([
      chairMaterials.seat,
      chairMaterials.leg,
      ...(chairMaterials.upholstery ?? []),
      ...(chairMaterials.metal ?? [])
    ]);
    mats.forEach((mat) => mat?.dispose?.());
  }
}

const LUDO_GRID = 15;
const LUDO_TILE = 0.075;
const RAW_BOARD_SIZE = LUDO_GRID * LUDO_TILE;
// Enlarge the Ludo board so it spans 3.1x the classic footprint.
const BOARD_SCALE = 3.22 * ARENA_SCALE;
const BOARD_DISPLAY_SIZE = RAW_BOARD_SIZE * BOARD_SCALE;
const BOARD_CLOTH_HALF = BOARD_DISPLAY_SIZE / 2;
const BOARD_RADIUS = BOARD_DISPLAY_SIZE / 2;
const PLAYFIELD_HEIGHT = 0.018;
const BOARD_GROUP_SURFACE_OFFSET = -0.0025;
const TILE_HALF_HEIGHT = PLAYFIELD_HEIGHT / 2;
const MARKER_SURFACE_OFFSET = 0.002;
const STAR_MARKER_SURFACE_INSET = 0.001;
const CENTER_HOME_BASE_OFFSET = -0.0045;
// Align the Ludo board quadrants with the token rails that sit on the table edges.
const BOARD_ROTATION_Y = -Math.PI / 2;
const CAMERA_BASE_RADIUS = Math.max(TABLE_RADIUS, BOARD_RADIUS);
const CAMERA_EXTRA_ZOOM_IN = 0.82;
const CAMERA_EXTRA_ZOOM_OUT = 1.26;
const INITIAL_CAMERA_DISTANCE_FACTOR = 0.62;
const PORTRAIT_INITIAL_CAMERA_DISTANCE_FACTOR = 0.56;
const CAM = {
  fov: CAMERA_FOV,
  near: CAMERA_NEAR,
  far: CAMERA_FAR,
  minR: CAMERA_BASE_RADIUS * ARENA_CAMERA_DEFAULTS.minRadiusFactor * CAMERA_EXTRA_ZOOM_IN,
  maxR: CAMERA_BASE_RADIUS * ARENA_CAMERA_DEFAULTS.maxRadiusFactor * CAMERA_EXTRA_ZOOM_OUT,
  phiMin: LUDO_CAMERA_PHI_MIN,
  phiMax: LUDO_CAMERA_PHI_MAX
};
const CAMERA_2D_DISTANCE_FACTOR = 1.08;
const CAMERA_2D_MAX_DISTANCE_FACTOR = 1.32;
const CAMERA_3D_VERTICAL_DROP = 0;
const CAMERA_3D_HEIGHT_BOOST = 0.084 * MODEL_SCALE;
const CAMERA_LOOKDOWN_TARGET_OFFSET = 0.038 * MODEL_SCALE;
const TRACK_COORDS = Object.freeze([
  [6, 1],
  [6, 2],
  [6, 3],
  [6, 4],
  [6, 5],
  [5, 6],
  [4, 6],
  [3, 6],
  [2, 6],
  [1, 6],
  [0, 6],
  [0, 7],
  [0, 8],
  [1, 8],
  [2, 8],
  [3, 8],
  [4, 8],
  [5, 8],
  [6, 9],
  [6, 10],
  [6, 11],
  [6, 12],
  [6, 13],
  [6, 14],
  [7, 14],
  [8, 14],
  [8, 13],
  [8, 12],
  [8, 11],
  [8, 10],
  [8, 9],
  [9, 8],
  [10, 8],
  [11, 8],
  [12, 8],
  [13, 8],
  [14, 8],
  [14, 7],
  [14, 6],
  [13, 6],
  [12, 6],
  [11, 6],
  [10, 6],
  [9, 6],
  [8, 5],
  [8, 4],
  [8, 3],
  [8, 2],
  [8, 1],
  [8, 0],
  [7, 0],
  [6, 0]
]);
const PLAYER_START_INDEX = Object.freeze([26, 13, 0, 39]);
const HOME_COLUMN_COORDS = Object.freeze([
  Object.freeze([
    [7, 13],
    [7, 12],
    [7, 11],
    [7, 10],
    [7, 9],
    [7, 8]
  ]),
  Object.freeze([
    [1, 7],
    [2, 7],
    [3, 7],
    [4, 7],
    [5, 7],
    [6, 7]
  ]),
  Object.freeze([
    [7, 1],
    [7, 2],
    [7, 3],
    [7, 4],
    [7, 5],
    [7, 6]
  ]),
  Object.freeze([
    [13, 7],
    [12, 7],
    [11, 7],
    [10, 7],
    [9, 7],
    [8, 7]
  ])
]);
const RING_STEPS = TRACK_COORDS.length;
const HOME_STEPS = HOME_COLUMN_COORDS[0].length;
const GOAL_PROGRESS = RING_STEPS + HOME_STEPS;
const COLOR_NAMES = ['Red', 'Blue', 'Yellow', 'Green'];
const BOARD_COLORS = Object.freeze([0xef4444, 0x3b82f6, 0xfacc15, 0x22c55e]);
const PLAYER_COLOR_ORDER = Object.freeze([0, 1, 2, 3]);
const DEFAULT_PLAYER_COLORS = Object.freeze(
  PLAYER_COLOR_ORDER.map((boardIndex) => BOARD_COLORS[boardIndex])
);
const TOKEN_TRACK_SURFACE_OFFSET = 0.0005;
const TOKEN_HOME_SURFACE_OFFSET = 0.0035;
const TOKEN_GOAL_SURFACE_OFFSET = 0.0038;
const TOKEN_TRACK_HEIGHT = PLAYFIELD_HEIGHT + TOKEN_TRACK_SURFACE_OFFSET;
const TOKEN_HOME_HEIGHT = PLAYFIELD_HEIGHT + TOKEN_HOME_SURFACE_OFFSET;
const TOKEN_GOAL_HEIGHT = PLAYFIELD_HEIGHT + TOKEN_GOAL_SURFACE_OFFSET;
const TOKEN_TRACK_LIFT = new THREE.Vector3(0, TOKEN_TRACK_HEIGHT, 0);
const TOKEN_GOAL_LIFT = new THREE.Vector3(0, TOKEN_GOAL_HEIGHT, 0);
const RAIL_TOKEN_FORWARD_SPACING = 0.05;
const RAIL_TOKEN_SIDE_SPACING = 0.06;
const TOKEN_HOME_HEIGHT_OFFSETS = Object.freeze([0, 0.0035, 0.0035, 0.0035]);
const TOKEN_RAIL_BASE_FORWARD_SHIFT = Object.freeze([0.012, 0, 0, 0]);
const TOKEN_RAIL_SIDE_MULTIPLIER = Object.freeze([1.12, 1.12, 1.12, 1.12]);
const TOKEN_RAIL_CENTER_PULL_DEFAULT = 0.115;
const TOKEN_RAIL_CENTER_PULL_PER_PLAYER = Object.freeze([
  0.146,
  0.14,
  0.146,
  0.14
]);
const TOKEN_RAIL_HEIGHT_LIFT = 0.0035;
const NON_OCTAGON_TOKEN_SURFACE_OFFSET = 0;
const SHAPED_TABLE_TOKEN_SURFACE_LIFT = 0.005;
const SHAPED_TABLE_DICE_SURFACE_LIFT = 0.0055;
let tokenSurfaceOffset = 0;
const TOKEN_FRONT_OUTWARD_SHIFT = 0.074;
const TOKEN_MOVE_SPEED = 2.45;
const TOKEN_STEP_DURATION_SECONDS = 0.34;
const LUDO_CAPTURE_MISSILE_LAUNCH_SOUND_URL = '/assets/sounds/launch-85216.mp3';
const LUDO_CAPTURE_MISSILE_IMPACT_SOUND_URL = '/assets/sounds/080998_bullet-hit-39870.mp3';
const LUDO_CAPTURE_DRONE_SOUND_URL =
  '/assets/sounds/kimsa-kimsa-big-motorcycle-sound-394700.mp3';
const LUDO_CAPTURE_FIGHTER_SOUND_URL = '/assets/sounds/race-care-151963.mp3';
const LUDO_CAPTURE_HELICOPTER_SOUND_URL = '/assets/sounds/dragon-studio-helicopter-sound-8d-372463.mp3';
const HAHA_SOUND_MAX_DURATION_MS = 6000;
const TOKEN_STEP_JUMP_HEIGHT = 0.03;
const TOKEN_STEP_JUMP_PHASE = 0.7;
const keyFor = (r, c) => `${r},${c}`;
const TRACK_KEY_SET = new Set(TRACK_COORDS.map(([r, c]) => keyFor(r, c)));
const TRACK_INDEX_BY_KEY = new Map(
  TRACK_COORDS.map(([r, c], index) => [keyFor(r, c), index])
);
const START_KEY_TO_PLAYER = new Map(
  PLAYER_START_INDEX.map((index, player) => {
    const [r, c] = TRACK_COORDS[index];
    return [keyFor(r, c), player];
  })
);
const SAFE_TRACK_INDEXES = new Set(
  PLAYER_START_INDEX
    .map((index) => (index + 8) % RING_STEPS)
    .filter((index) => !PLAYER_START_INDEX.includes(index))
);
const SAFE_TRACK_KEY_SET = new Set(
  [...SAFE_TRACK_INDEXES].map((index) => {
    const [r, c] = TRACK_COORDS[index];
    return keyFor(r, c);
  })
);
const HOME_COLUMN_KEY_TO_PLAYER = new Map();
const HOME_COLUMN_KEY_TO_STEP = new Map();
HOME_COLUMN_COORDS.forEach((coords, player) => {
  coords.forEach(([r, c], step) => {
    const key = keyFor(r, c);
    HOME_COLUMN_KEY_TO_PLAYER.set(key, player);
    HOME_COLUMN_KEY_TO_STEP.set(key, step);
  });
});

function getPlayerHomeHeight(playerIndex) {
  const offset = TOKEN_HOME_HEIGHT_OFFSETS[playerIndex] ?? 0;
  return TOKEN_HOME_HEIGHT + offset + tokenSurfaceOffset;
}

function getTokenRailHeight(playerIndex) {
  return getPlayerHomeHeight(playerIndex) + TOKEN_RAIL_HEIGHT_LIFT;
}

function isShapedLudoTable(tableThemeId) {
  const id = String(tableThemeId || '').toLowerCase();
  if (!id) return false;
  return id === 'murlan-default' || id.includes('octagon') || id.includes('oval') || id.includes('hexagon') || id.includes('diamond');
}

function getShapedTableHeightLift(tableThemeId) {
  void tableThemeId;
  return SHAPED_TABLE_TOKEN_SURFACE_LIFT;
}

function updateTokenSurfaceOffset(tableThemeId) {
  tokenSurfaceOffset =
    (tableThemeId === 'murlan-default' ? 0 : NON_OCTAGON_TOKEN_SURFACE_OFFSET) +
    getShapedTableHeightLift(tableThemeId);
}

const DICE_SIZE = 0.076;
const DICE_CORNER_RADIUS = DICE_SIZE * 0.17;
const DICE_PIP_RADIUS = DICE_SIZE * 0.093;
const DICE_PIP_DEPTH = DICE_SIZE * 0.018;
const DICE_PIP_SPREAD = DICE_SIZE * 0.3;
const DICE_FACE_INSET = DICE_SIZE * 0.064;
const DICE_BASE_HEIGHT = DICE_SIZE / 2 + 0.027;
const DICE_PIP_RIM_INNER = DICE_PIP_RADIUS * 0.78;
const DICE_PIP_RIM_OUTER = DICE_PIP_RADIUS * 1.08;
const DICE_PIP_RIM_OFFSET = DICE_SIZE * 0.0048;

function makeDice() {
  const dice = new THREE.Group();

  const dieMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0.25,
    roughness: 0.35,
    clearcoat: 1,
    clearcoatRoughness: 0.15,
    reflectivity: 0.75,
    envMapIntensity: 1.4
  });

  const pipMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x0a0a0a,
    roughness: 0.05,
    metalness: 0.6,
    clearcoat: 0.9,
    clearcoatRoughness: 0.04,
    envMapIntensity: 1.1
  });

  const pipRimMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffd700,
    emissive: 0x3a2a00,
    emissiveIntensity: 0.55,
    metalness: 1,
    roughness: 0.18,
    reflectivity: 1,
    envMapIntensity: 1.35,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1
  });

  const body = new THREE.Mesh(
    new RoundedBoxGeometry(DICE_SIZE, DICE_SIZE, DICE_SIZE, 6, DICE_CORNER_RADIUS),
    dieMaterial
  );
  body.castShadow = true;
  body.receiveShadow = true;
  dice.add(body);

  const pipGeo = new THREE.SphereGeometry(DICE_PIP_RADIUS, 36, 24, 0, Math.PI * 2, 0, Math.PI);
  pipGeo.rotateX(Math.PI);
  pipGeo.computeVertexNormals();
  const pipRimGeo = new THREE.RingGeometry(DICE_PIP_RIM_INNER, DICE_PIP_RIM_OUTER, 64);
  const half = DICE_SIZE / 2;
  const faceDepth = half - DICE_FACE_INSET * 0.6;
  const spread = DICE_PIP_SPREAD;

  const faces = [
    { normal: new THREE.Vector3(0, 1, 0), points: [[0, 0]] },
    {
      normal: new THREE.Vector3(0, 0, 1),
      points: [
        [-spread, -spread],
        [spread, spread]
      ]
    },
    {
      normal: new THREE.Vector3(1, 0, 0),
      points: [
        [-spread, -spread],
        [0, 0],
        [spread, spread]
      ]
    },
    {
      normal: new THREE.Vector3(-1, 0, 0),
      points: [
        [-spread, -spread],
        [-spread, spread],
        [spread, -spread],
        [spread, spread]
      ]
    },
    {
      normal: new THREE.Vector3(0, 0, -1),
      points: [
        [-spread, -spread],
        [-spread, spread],
        [0, 0],
        [spread, -spread],
        [spread, spread]
      ]
    },
    {
      normal: new THREE.Vector3(0, -1, 0),
      points: [
        [-spread, -spread],
        [-spread, 0],
        [-spread, spread],
        [spread, -spread],
        [spread, 0],
        [spread, spread]
      ]
    }
  ];

  faces.forEach(({ normal, points }) => {
    const n = normal.clone().normalize();
    const helper = Math.abs(n.y) > 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
    const xAxis = new THREE.Vector3().crossVectors(helper, n).normalize();
    const yAxis = new THREE.Vector3().crossVectors(n, xAxis).normalize();

    points.forEach(([gx, gy]) => {
      const base = new THREE.Vector3()
        .addScaledVector(xAxis, gx)
        .addScaledVector(yAxis, gy)
        .addScaledVector(n, faceDepth - DICE_PIP_DEPTH * 0.5);

      const pip = new THREE.Mesh(pipGeo, pipMaterial);
      pip.castShadow = true;
      pip.receiveShadow = true;
      pip.position.copy(base).addScaledVector(n, DICE_PIP_DEPTH);
      pip.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n));
      dice.add(pip);

      const rim = new THREE.Mesh(pipRimGeo, pipRimMaterial);
      rim.receiveShadow = true;
      rim.renderOrder = 6;
      rim.position.copy(base).addScaledVector(n, DICE_PIP_RIM_OFFSET);
      rim.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n));
      dice.add(rim);
    });
  });

  dice.userData.setValue = (val) => {
    dice.userData.currentValue = val;
    setDiceOrientation(dice, val);
  };
  dice.userData.currentValue = 1;
  return dice;
}

const markerTextureCache = new Map();
const starMarkerTextureCache = new Map();
const homeLabelTextureCache = new Map();

function resolveColorStyle(input) {
  if (input == null) {
    return null;
  }
  const color = new THREE.Color(input);
  return color.getStyle();
}

function getMarkerTexture({
  label,
  color,
  arrow = false,
  backgroundColor,
  textColor,
  arrowColor
}) {
  const key = `${label}-${color}-${arrow}-${backgroundColor ?? ''}-${textColor ?? ''}-${arrowColor ?? ''}`;
  if (markerTextureCache.has(key)) {
    return markerTextureCache.get(key);
  }
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }
  const baseColor = new THREE.Color(color);
  const skipBackground = backgroundColor === 'transparent' || backgroundColor === 'none';
  const bgColor =
    skipBackground || !backgroundColor
      ? baseColor.clone().lerp(new THREE.Color(0x000000), 0.68).getStyle()
      : backgroundColor;
  const accentColor =
    resolveColorStyle(arrowColor) || baseColor.clone().lerp(new THREE.Color(0xffffff), 0.18).getStyle();
  const labelColor =
    textColor || baseColor.clone().lerp(new THREE.Color(0x1f2937), 0.2).getStyle();

  if (!skipBackground) {
    ctx.fillStyle = bgColor;
    ctx.globalAlpha = 0.92;
    ctx.fillRect(0, 0, size, size);
    ctx.globalAlpha = 1;
  } else {
    ctx.clearRect(0, 0, size, size);
  }

  ctx.translate(size / 2, size / 2);
  if (arrow) {
    ctx.fillStyle = accentColor;
    const arrowHeight = size * 0.36;
    const arrowWidth = size * 0.22;
    ctx.beginPath();
    ctx.moveTo(0, -arrowHeight * 0.75);
    ctx.lineTo(arrowWidth, arrowHeight * 0.05);
    ctx.lineTo(arrowWidth * 0.38, arrowHeight * 0.05);
    ctx.lineTo(arrowWidth * 0.38, arrowHeight * 0.55);
    ctx.lineTo(-arrowWidth * 0.38, arrowHeight * 0.55);
    ctx.lineTo(-arrowWidth * 0.38, arrowHeight * 0.05);
    ctx.lineTo(-arrowWidth, arrowHeight * 0.05);
    ctx.closePath();
    ctx.fill();
  }

  if (label) {
    ctx.fillStyle = labelColor;
    ctx.font = `bold ${size * 0.26}px Inter, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label.toUpperCase(), 0, size * 0.28);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  markerTextureCache.set(key, texture);
  return texture;
}

const MARKER_HEIGHT_OFFSET = TILE_HALF_HEIGHT + MARKER_SURFACE_OFFSET;
const STAR_MARKER_HEIGHT_OFFSET = TILE_HALF_HEIGHT - STAR_MARKER_SURFACE_INSET;

function createMarkerMesh({
  label,
  color,
  position,
  angle = 0,
  size = LUDO_TILE * 0.92,
  arrow = false,
  backgroundColor,
  textColor,
  arrowColor
}) {
  const texture = getMarkerTexture({ label, color, arrow, backgroundColor, textColor, arrowColor });
  if (!texture) return null;
  const geometry = new THREE.PlaneGeometry(size, size);
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  mesh.position.y += MARKER_HEIGHT_OFFSET;
  mesh.quaternion.setFromEuler(new THREE.Euler(-Math.PI / 2, angle, 0, 'YXZ'));
  mesh.renderOrder = 12;
  return mesh;
}

function getStarMarkerTexture(color) {
  const key = color;
  if (starMarkerTextureCache.has(key)) {
    return starMarkerTextureCache.get(key);
  }
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }

  ctx.fillStyle = '#fef9ef';
  ctx.globalAlpha = 0.62;
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = 1;

  ctx.strokeStyle = '#d1a15d';
  ctx.lineWidth = size * 0.06;
  ctx.strokeRect(size * 0.08, size * 0.08, size * 0.84, size * 0.84);

  const outerRadius = size * 0.32;
  const innerRadius = outerRadius * 0.45;
  const cx = size / 2;
  const cy = size / 2;
  const points = 5;
  ctx.fillStyle = new THREE.Color(color).getStyle();
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const angle = (Math.PI / points) * i - Math.PI / 2;
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  if ('colorSpace' in texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }
  starMarkerTextureCache.set(key, texture);
  return texture;
}

function createStarMarkerMesh({ color, position, size = LUDO_TILE * 0.82 }) {
  const texture = getStarMarkerTexture(color);
  if (!texture) return null;
  const geometry = new THREE.PlaneGeometry(size, size);
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  mesh.position.y += STAR_MARKER_HEIGHT_OFFSET;
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 13;
  return mesh;
}

function getHomeLabelTexture() {
  if (homeLabelTextureCache.has('home')) {
    return homeLabelTextureCache.get('home');
  }
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = '#b45309';
  ctx.lineWidth = size * 0.08;
  ctx.strokeRect(size * 0.08, size * 0.08, size * 0.84, size * 0.84);

  ctx.fillStyle = '#b91c1c';
  ctx.font = `bold ${size * 0.24}px Inter, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('HOME', size / 2, size / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  if ('colorSpace' in texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }
  homeLabelTextureCache.set('home', texture);
  return texture;
}

function createHomeLabelMesh(size) {
  const texture = getHomeLabelTexture();
  if (!texture) return null;
  const geometry = new THREE.PlaneGeometry(size, size);
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 14;
  return mesh;
}

function addCenterHome(scene, playerColors = DEFAULT_PLAYER_COLORS) {
  const size = LUDO_TILE * 3;
  const half = size / 2;
  const baseHeight = PLAYFIELD_HEIGHT + CENTER_HOME_BASE_OFFSET;
  const centerColors = [
    playerColors[2] ?? DEFAULT_PLAYER_COLORS[2],
    playerColors[1] ?? DEFAULT_PLAYER_COLORS[1],
    playerColors[0] ?? DEFAULT_PLAYER_COLORS[0],
    playerColors[3] ?? DEFAULT_PLAYER_COLORS[3]
  ];

  const base = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78 })
  );
  base.rotation.x = -Math.PI / 2;
  base.position.set(0, baseHeight, 0);
  base.receiveShadow = true;
  scene.add(base);

  const triangleDefs = [
    {
      color: centerColors[0],
      vertices: new Float32Array([
        -half,
        0,
        -half,
        -half,
        0,
        half,
        0,
        0,
        0
      ])
    },
    {
      color: centerColors[1],
      vertices: new Float32Array([
        -half,
        0,
        -half,
        half,
        0,
        -half,
        0,
        0,
        0
      ])
    },
    {
      color: centerColors[2],
      vertices: new Float32Array([
        half,
        0,
        -half,
        half,
        0,
        half,
        0,
        0,
        0
      ])
    },
    {
      color: centerColors[3],
      vertices: new Float32Array([
        -half,
        0,
        half,
        half,
        0,
        half,
        0,
        0,
        0
      ])
    }
  ];

  triangleDefs.forEach(({ color, vertices }) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.74,
      metalness: 0.06,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = baseHeight + 0.0006;
    mesh.receiveShadow = true;
    scene.add(mesh);
  });

  const homeLabel = createHomeLabelMesh(LUDO_TILE * 1.2);
  if (homeLabel) {
    homeLabel.position.set(0, baseHeight + 0.001, 0);
    scene.add(homeLabel);
  }
}

function getArrowAngle(dx, dz) {
  if (dx === 0 && dz === 0) {
    return 0;
  }
  return Math.atan2(dx, -dz);
}

function getTrackDirectionAngle(index) {
  const current = TRACK_COORDS[index];
  const next = TRACK_COORDS[(index + 1) % RING_STEPS];
  const dx = next[1] - current[1];
  const dz = next[0] - current[0];
  return getArrowAngle(dx, dz);
}

function addBoardMarkers(scene, cellToWorld, playerColors = DEFAULT_PLAYER_COLORS) {
  if (typeof document === 'undefined') return;
  const group = new THREE.Group();
  scene.add(group);

  const safeKeyToPlayer = new Map();
  PLAYER_START_INDEX.forEach((startIndex, playerIdx) => {
    const [startR, startC] = TRACK_COORDS[startIndex];
    safeKeyToPlayer.set(keyFor(startR, startC), playerIdx);
    const safeIndex = (startIndex + 8) % RING_STEPS;
    const [safeR, safeC] = TRACK_COORDS[safeIndex];
    safeKeyToPlayer.set(keyFor(safeR, safeC), playerIdx);
  });

  TRACK_COORDS.forEach(([r, c], index) => {
    const key = keyFor(r, c);
    const startOwner = START_KEY_TO_PLAYER.get(key);
    const safeOwner = safeKeyToPlayer.get(key);
    const position = cellToWorld(r, c).clone();
    const angle = getTrackDirectionAngle(index);
    const baseColor =
      startOwner != null
        ? playerColors[startOwner]
        : safeOwner != null
        ? playerColors[safeOwner]
        : '#0f172a';
    const isStartTile = startOwner != null;
    if (!isStartTile) {
      return;
    }
    const marker = createMarkerMesh({
      label: 'GO',
      color: baseColor,
      position,
      angle,
      size: LUDO_TILE * 0.98,
      arrow: true,
      backgroundColor: '#ffffff',
      textColor: resolveColorStyle(baseColor),
      arrowColor: baseColor
    });
    if (marker) group.add(marker);
  });

  PLAYER_START_INDEX.forEach((startIndex, playerIdx) => {
    const safeIndex = (startIndex + 8) % RING_STEPS;
    const [safeR, safeC] = TRACK_COORDS[safeIndex];
    const safePosition = cellToWorld(safeR, safeC).clone();
    const star = createStarMarkerMesh({
      color: playerColors[playerIdx],
      position: safePosition,
      size: LUDO_TILE * 0.88
    });
    if (star) group.add(star);

  });

  HOME_COLUMN_COORDS.forEach((coords, playerIdx) => {
    const isHorizontal = coords.every(([row]) => row === coords[0][0]);
    coords.forEach(([homeR, homeC]) => {
      const homePos = cellToWorld(homeR, homeC).clone();
      let arrowAngle = getArrowAngle(-homePos.x, -homePos.z);
      if (isHorizontal) {
        arrowAngle = -arrowAngle;
      }
      const arrowMarker = createMarkerMesh({
        label: '',
        color: playerColors[playerIdx],
        position: homePos,
        angle: arrowAngle,
        size: LUDO_TILE * 0.88,
        arrow: true,
        backgroundColor: 'transparent',
        arrowColor: playerColors[playerIdx]
      });
      if (arrowMarker) group.add(arrowMarker);
    });
  });
}

function setDiceOrientation(dice, val) {
  const q = new THREE.Quaternion();
  const eulers = {
    1: new THREE.Euler(0, 0, 0),
    2: new THREE.Euler(-Math.PI / 2, 0, 0),
    3: new THREE.Euler(0, 0, Math.PI / 2),
    4: new THREE.Euler(0, 0, -Math.PI / 2),
    5: new THREE.Euler(Math.PI / 2, 0, 0),
    6: new THREE.Euler(Math.PI, 0, 0)
  };
  const e = eulers[val] || eulers[1];
  q.setFromEuler(e);
  dice.setRotationFromQuaternion(q);
}

function spinDice(
  dice,
  { duration = 900, targetPosition = new THREE.Vector3(), bounceHeight = 0.06 } = {}
) {
  return new Promise((resolve) => {
    const start = performance.now();
    const startPos = dice.position.clone();
    const endPos = targetPosition.clone();
    const spinVec = new THREE.Vector3(
      1.2 + Math.random() * 0.7,
      1.35 + Math.random() * 0.65,
      1.05 + Math.random() * 0.75
    );
    const wobble = new THREE.Vector3((Math.random() - 0.5) * 0.16, 0, (Math.random() - 0.5) * 0.16);
    const targetValue = 1 + Math.floor(Math.random() * 6);

    const step = () => {
      const now = performance.now();
      const t = Math.min(1, (now - start) / Math.max(1, duration));
      const eased = easeOutCubic(t);
      const position = startPos.clone().lerp(endPos, eased);
      const wobbleStrength = Math.sin(eased * Math.PI);
      position.addScaledVector(wobble, wobbleStrength * 0.45);
      const bounce = Math.sin(Math.min(1, eased * 1.25) * Math.PI) * bounceHeight * (1 - eased * 0.45);
      position.y = THREE.MathUtils.lerp(startPos.y, endPos.y, eased) + bounce;
      dice.position.copy(position);

      const spinFactor = 1 - eased * 0.28;
      dice.rotation.x += spinVec.x * spinFactor * 0.22;
      dice.rotation.y += spinVec.y * spinFactor * 0.22;
      dice.rotation.z += spinVec.z * spinFactor * 0.22;

      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        if (typeof dice.userData?.setValue === 'function') {
          dice.userData.setValue(targetValue);
        } else {
          setDiceOrientation(dice, targetValue);
        }
        dice.position.copy(endPos);
        resolve(targetValue);
      }
    };

    requestAnimationFrame(step);
  });
}

function createTokenCountLabel() {
  if (typeof document === 'undefined') return null;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  if ('colorSpace' in texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.045, 0.045, 0.045);
  sprite.position.set(0, 0.08, 0);
  sprite.renderOrder = 30;
  sprite.visible = false;
  sprite.userData.countLabel = {
    canvas,
    ctx,
    texture,
    value: 0
  };
  return sprite;
}

function updateTokenCountLabel(sprite, count, baseColor) {
  if (!sprite) return;
  const data = sprite.userData?.countLabel;
  if (!data) return;
  if (data.value === count) return;
  const { canvas, ctx, texture } = data;
  const size = canvas.width;
  ctx.clearRect(0, 0, size, size);

  const color = baseColor
    ? new THREE.Color(baseColor).lerp(new THREE.Color(0xffffff), 0.18)
    : new THREE.Color('#1f2937');
  const rim = color.clone().lerp(new THREE.Color(0x000000), 0.35);

  ctx.fillStyle = `#${color.getHexString()}`;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.42, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = size * 0.08;
  ctx.strokeStyle = `#${rim.getHexString()}`;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${size * 0.56}px Inter, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(count), size / 2, size / 2);

  texture.needsUpdate = true;
  data.value = count;
}

function ease(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

const TOKEN_SELECTION_SCALE = 1.08;
const TOKEN_SIZE_MULTIPLIER = 1.4;
const TOKEN_THINNESS_SCALE = 0.86;
const TOKEN_RAIL_OUTWARD_PUSH = 0.108;
const CAPTURE_ANIMATION_HEIGHT_COMPENSATION = TABLE_VERTICAL_LOWERING;
const CAMERA_TURN_VIEW_DURATION_MS = 520;
const CAMERA_BROADCAST_ANIMATION_MS = 700;
const CAMERA_RETURN_ANIMATION_MS = 760;
const ROCK_TOKEN_REFERENCE_SCALE = Object.freeze({ x: 0.78, y: 0.92, z: 0.74 });
const TOKEN_TYPE_SCALE_PROFILE = Object.freeze({
  pawn: {
    x: ROCK_TOKEN_REFERENCE_SCALE.x * 0.88,
    y: ROCK_TOKEN_REFERENCE_SCALE.y * 0.84,
    z: ROCK_TOKEN_REFERENCE_SCALE.z * 0.88
  },
  knight: { x: ROCK_TOKEN_REFERENCE_SCALE.x, y: ROCK_TOKEN_REFERENCE_SCALE.y * 1.06, z: ROCK_TOKEN_REFERENCE_SCALE.z },
  rook: { x: ROCK_TOKEN_REFERENCE_SCALE.x, y: ROCK_TOKEN_REFERENCE_SCALE.y * 1.06, z: ROCK_TOKEN_REFERENCE_SCALE.z },
  bishop: { x: ROCK_TOKEN_REFERENCE_SCALE.x, y: ROCK_TOKEN_REFERENCE_SCALE.y * 1.36, z: ROCK_TOKEN_REFERENCE_SCALE.z },
  queen: { x: ROCK_TOKEN_REFERENCE_SCALE.x, y: ROCK_TOKEN_REFERENCE_SCALE.y * 1.45, z: ROCK_TOKEN_REFERENCE_SCALE.z },
  king: { x: ROCK_TOKEN_REFERENCE_SCALE.x, y: ROCK_TOKEN_REFERENCE_SCALE.y * 1.5, z: ROCK_TOKEN_REFERENCE_SCALE.z }
});

function setTokenHighlight(token, active) {
  if (!token) return;
  if (!token.userData) token.userData = {};
  if (!token.userData.baseScale) {
    token.userData.baseScale = token.scale.clone();
  }
  const baseScale = token.userData.baseScale;
  if (active) {
    token.scale.set(
      baseScale.x * TOKEN_SELECTION_SCALE,
      baseScale.y * TOKEN_SELECTION_SCALE,
      baseScale.z * TOKEN_SELECTION_SCALE
    );
  } else if (baseScale) {
    token.scale.copy(baseScale);
  }

  const tokenColor = token.userData?.tokenColor ? new THREE.Color(token.userData.tokenColor) : null;
  const highlightColor = tokenColor ? tokenColor.clone().lerp(new THREE.Color(0xffffff), 0.2) : null;

  token.traverse((child) => {
    if (!child?.isMesh) return;
    if (!child.userData) child.userData = {};
    const { material } = child;
    if (!material) return;
    if (material.emissive && !child.userData.baseEmissive) {
      child.userData.baseEmissive = material.emissive.clone();
    }
    if (material.emissiveIntensity != null && child.userData.baseEmissiveIntensity == null) {
      child.userData.baseEmissiveIntensity = material.emissiveIntensity;
    }
    if (active) {
      if (material.emissive) {
        if (highlightColor) {
          material.emissive.copy(highlightColor);
        } else {
          material.emissive.setRGB(0.85, 0.85, 0.85);
        }
      }
      if (material.emissiveIntensity != null) {
        const base = child.userData.baseEmissiveIntensity ?? 0.7;
        material.emissiveIntensity = Math.max(base, 1.25);
      }
    } else {
      if (material.emissive && child.userData.baseEmissive) {
        material.emissive.copy(child.userData.baseEmissive);
      }
      if (material.emissiveIntensity != null && child.userData.baseEmissiveIntensity != null) {
        material.emissiveIntensity = child.userData.baseEmissiveIntensity;
      }
    }
  });

  token.userData.isSelectable = !!active;
}

function clearTokenHighlight(token) {
  setTokenHighlight(token, false);
}

const areColorArraysEqual = (a = [], b = []) => {
  if (a.length !== b.length) return false;
  return a.every((value, idx) => value === b[idx]);
};

function disposeBoardGroup(group) {
  if (!group) return;
  group.traverse((node) => {
    if (node.isMesh) {
      node.geometry?.dispose?.();
      const mats = Array.isArray(node.material) ? node.material : [node.material];
      mats.forEach((mat) => {
        if (mat?.map) mat.map.dispose?.();
        mat?.dispose?.();
      });
    }
  });
}

function Ludo3D({ avatar, username, aiFlagOverrides, playerCount, aiCount }) {
  const wrapRef = useRef(null);
  const rafRef = useRef(0);
  const controlsRef = useRef(null);
  const rendererRef = useRef(null);
  const textureLoaderRef = useRef(null);
  const textureCacheRef = useRef(new Map());
  const maxAnisotropyRef = useRef(1);
  const fallbackTextureRef = useRef(null);
  const diceRef = useRef(null);
  const diceTransitionRef = useRef(null);
  const rollDiceRef = useRef(() => {});
  const turnIndicatorRef = useRef(null);
  const stateRef = useRef(null);
  const uiRef = useRef(null);
  const moveSoundRef = useRef(null);
  const captureSoundRef = useRef(null);
  const missileLaunchSoundRef = useRef(null);
  const missileImpactSoundRef = useRef(null);
  const droneSoundRef = useRef(null);
  const fighterJetSoundRef = useRef(null);
  const helicopterSoundRef = useRef(null);
  const cheerSoundRef = useRef(null);
  const diceSoundRef = useRef(null);
  const diceRewardSoundRef = useRef(null);
  const sixRollSoundRef = useRef(null);
  const hahaSoundRef = useRef(null);
  const hahaStopTimeoutRef = useRef(null);
  const giftBombSoundRef = useRef(null);
  const aiTimeoutRef = useRef(null);
  const diceClearTimeoutRef = useRef(null);
  const humanRollTimeoutRef = useRef(null);
  const turnAdvanceTimeoutRef = useRef(null);
  const cameraFocusTimeoutRef = useRef(null);
  const cameraFocusFrameRef = useRef(0);
  const cameraViewFrameRef = useRef(0);
  const preserveUserTurnCameraRef = useRef(false);
  const cameraTurnStateRef = useRef({
    currentTarget: null,
    activePriority: -Infinity,
    followObject: null,
    followOffset: null,
    baseTurnView: null
  });
  const initialBottomCameraViewRef = useRef(null);
  const humanSelectionRef = useRef(null);
  const fitRef = useRef(() => {});
  const cameraRef = useRef(null);
  const boardLookTargetRef = useRef(null);
  const saved3dCameraStateRef = useRef(null);
  const captureFxRef = useRef(null);
  const activePlayerCount = useMemo(() => clampPlayerCount(playerCount), [playerCount]);
  const aiSlots = Math.max(0, activePlayerCount - 1);
  const aiOpponentCount = useMemo(
    () => clamp(Math.floor(aiCount ?? aiSlots), 0, aiSlots),
    [aiCount, aiSlots]
  );
  const resolvedAccountId = useMemo(() => ludoBattleAccountId(), []);
  const [inventoryVersion, setInventoryVersion] = useState(0);
  const ludoInventory = useMemo(
    () => getLudoBattleInventory(resolvedAccountId),
    [resolvedAccountId, inventoryVersion]
  );
  useEffect(() => {
    const handler = (event) => {
      if (!event?.detail?.accountId || event.detail.accountId === resolvedAccountId) {
        setInventoryVersion((value) => value + 1);
      }
    };
    window.addEventListener('ludoBattleInventoryUpdate', handler);
    return () => window.removeEventListener('ludoBattleInventoryUpdate', handler);
  }, [resolvedAccountId]);
  const [configOpen, setConfigOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => !isGameMuted());
  const [showInfo, setShowInfo] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showGift, setShowGift] = useState(false);
  const [isCamera2d, setIsCamera2d] = useState(false);
  const [chatBubbles, setChatBubbles] = useState([]);
  const settingsRef = useRef({ soundEnabled: true });
  useEffect(() => {
    const handler = () => setSoundEnabled(!isGameMuted());
    window.addEventListener('gameMuteChanged', handler);
    return () => window.removeEventListener('gameMuteChanged', handler);
  }, []);
  const [frameRateId, setFrameRateId] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage?.getItem(FRAME_RATE_STORAGE_KEY);
      const legacyMap = {
        mobile50: 'hd50',
        balanced60: 'fhd60',
        smooth90: 'qhd90',
        fast120: 'uhd120',
        esports144: 'uhd144'
      };
      const normalized = legacyMap[stored] ?? stored;
      if (normalized && FRAME_RATE_OPTIONS.some((opt) => opt.id === normalized)) {
        return normalized;
      }
      const detected = detectPreferredFrameRateId();
      if (detected && FRAME_RATE_OPTIONS.some((opt) => opt.id === detected)) {
        return detected;
      }
    }
    return DEFAULT_FRAME_RATE_ID;
  });
  const activeFrameRateOption = useMemo(
    () => FRAME_RATE_OPTIONS.find((opt) => opt.id === frameRateId) ?? DEFAULT_FRAME_RATE_OPTION,
    [frameRateId]
  );
  const frameQualityProfile = useMemo(() => {
    const option = activeFrameRateOption ?? DEFAULT_FRAME_RATE_OPTION;
    const fallback = DEFAULT_FRAME_RATE_OPTION;
    const fps =
      Number.isFinite(option?.fps) && option.fps > 0
        ? option.fps
        : Number.isFinite(fallback?.fps) && fallback.fps > 0
        ? fallback.fps
        : 60;
    const renderScale =
      typeof option?.renderScale === 'number' && Number.isFinite(option.renderScale)
        ? THREE.MathUtils.clamp(option.renderScale, 0.75, 1.3)
        : 0.92;
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
  const textureResolutionStack = useMemo(() => {
    const option = activeFrameRateOption ?? DEFAULT_FRAME_RATE_OPTION;
    const stack = Array.isArray(option?.texturePreferredSizes) ? option.texturePreferredSizes : [];
    return stack.length ? stack : PREFERRED_TEXTURE_SIZES;
  }, [activeFrameRateOption]);
  const textureResolutionKey = useMemo(() => textureResolutionStack.join('|'), [textureResolutionStack]);
  const hdriResolutionProfile = useMemo(() => {
    const option = activeFrameRateOption ?? DEFAULT_FRAME_RATE_OPTION;
    const mobileHdri4kOptionIds = ['qhd90'];
    const forceMobile4kHdri = isLikelyMobileDevice() && mobileHdri4kOptionIds.includes(option?.id);
    if (forceMobile4kHdri) {
      return {
        preferredResolutions: ['4k', '2k'],
        fallbackResolution: '2k',
        key: '4k|2k|mobile'
      };
    }
    const preferred = Array.isArray(option?.hdriPreferredResolutions) ? option.hdriPreferredResolutions : [];
    const resolvedPreferred = preferred.length ? preferred : DEFAULT_HDRI_RESOLUTIONS;
    const fallback =
      typeof option?.hdriFallbackResolution === 'string' && option.hdriFallbackResolution
        ? option.hdriFallbackResolution
        : resolvedPreferred[resolvedPreferred.length - 1] || DEFAULT_HDRI_RESOLUTIONS[0];
    return {
      preferredResolutions: resolvedPreferred,
      fallbackResolution: fallback,
      key: resolvedPreferred.join('|')
    };
  }, [activeFrameRateOption]);
  useEffect(() => {
    frameQualityRef.current = frameQualityProfile;
  }, [frameQualityProfile]);
  const resolvedFrameTiming = useMemo(() => {
    const fallbackFps =
      Number.isFinite(DEFAULT_FRAME_RATE_OPTION?.fps) && DEFAULT_FRAME_RATE_OPTION.fps > 0
        ? DEFAULT_FRAME_RATE_OPTION.fps
        : 60;
    const fps =
      Number.isFinite(frameQualityProfile?.fps) && frameQualityProfile.fps > 0
        ? frameQualityProfile.fps
        : fallbackFps;
    const targetMs = 1000 / fps;
    return {
      id: frameQualityProfile?.id ?? DEFAULT_FRAME_RATE_OPTION?.id ?? DEFAULT_FRAME_RATE_ID,
      fps,
      targetMs,
      maxMs: targetMs * FRAME_TIME_CATCH_UP_MULTIPLIER
    };
  }, [frameQualityProfile]);
  const frameTimingRef = useRef(resolvedFrameTiming);
  useEffect(() => {
    frameTimingRef.current = resolvedFrameTiming;
  }, [resolvedFrameTiming]);
  const resolveFrameSyncedDuration = useCallback((baseDurationMs, { min = 120, max = 2400 } = {}) => {
    const baseDuration = Number(baseDurationMs);
    const safeBaseDuration = Number.isFinite(baseDuration) ? Math.max(0, baseDuration) : 0;
    if (safeBaseDuration <= 0) return 0;
    const activeFps =
      Number.isFinite(frameQualityRef.current?.fps) && frameQualityRef.current.fps > 0
        ? frameQualityRef.current.fps
        : ANIMATION_BASE_FPS;
    const speedMultiplier = THREE.MathUtils.clamp(
      ANIMATION_BASE_FPS / activeFps,
      MIN_ANIMATION_SPEED_MULTIPLIER,
      MAX_ANIMATION_SPEED_MULTIPLIER
    );
    const resolved = safeBaseDuration * speedMultiplier;
    return THREE.MathUtils.clamp(resolved, min, max);
  }, []);
  const [appearance, setAppearance] = useState(() => {
    if (typeof window === 'undefined') return { ...DEFAULT_APPEARANCE };
    try {
      const stored = window.localStorage?.getItem(APPEARANCE_STORAGE_KEY);
      if (!stored) return { ...DEFAULT_APPEARANCE };
      const parsed = JSON.parse(stored);
      return normalizeAppearance(parsed);
    } catch (error) {
      console.warn('Failed to load Ludo appearance', error);
      return { ...DEFAULT_APPEARANCE };
    }
  });
  const appearanceRef = useRef(appearance);
  const hdriVariantRef = useRef(DEFAULT_HDRI_VARIANT);
  const disposeEnvironmentRef = useRef(() => {});
  const envTextureRef = useRef(null);
  const envSkyboxRef = useRef(null);
  const envSkyboxTextureRef = useRef(null);
  const baseSkyboxScaleRef = useRef(1);
  const baseCameraRadiusRef = useRef(null);
  const lastCameraRadiusRef = useRef(null);
  const environmentFloorRef = useRef(0);
  const cameraLookStateRef = useRef({
    yaw: 0,
    pitch: 0,
    pointerId: null,
    active: false,
    lastX: 0,
    lastY: 0
  });
  const syncSkyboxToCameraRef = useRef(() => {});
  const tableBuildTokenRef = useRef(0);
  const chairBuildTokenRef = useRef(0);
  const playerColorsRef = useRef(resolvePlayerColors(appearance));
  const ensureAppearanceUnlocked = useCallback(
    (value = DEFAULT_APPEARANCE) => {
      const normalized = normalizeAppearance(value);
      const map = {
        tables: MURLAN_TABLE_THEMES,
        tableFinish: TABLE_FINISH_OPTIONS,
        tableCloth: TABLE_CLOTH_OPTIONS,
        stools: MURLAN_STOOL_THEMES,
        environmentHdri: LUDO_HDRI_OPTIONS,
        tokenPalette: TOKEN_PALETTE_OPTIONS,
        tokenStyle: TOKEN_STYLE_OPTIONS,
        tokenPiece: TOKEN_PIECE_OPTIONS,
        captureAnimation: CAPTURE_ANIMATION_OPTIONS
      };
      let changed = false;
      const next = { ...normalized };
      Object.entries(map).forEach(([key, options]) => {
        const idx = Number.isFinite(next[key]) ? next[key] : 0;
        const option = options[idx];
        if (!option || !isLudoOptionUnlocked(key, option.id, ludoInventory)) {
          const fallbackIdx = options.findIndex((opt) => isLudoOptionUnlocked(key, opt.id, ludoInventory));
          const safeIdx = fallbackIdx >= 0 ? fallbackIdx : 0;
          if (safeIdx !== idx) {
            next[key] = safeIdx;
            changed = true;
          }
        }
      });
      return changed ? next : normalized;
    },
    [ludoInventory]
  );
  useEffect(() => {
    setAppearance((prev) => ensureAppearanceUnlocked(prev));
  }, [ensureAppearanceUnlocked]);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage?.setItem(FRAME_RATE_STORAGE_KEY, frameRateId);
    }
  }, [frameRateId]);
  useEffect(() => {
    textureCacheRef.current?.clear?.();
  }, [textureResolutionKey]);
  const customizationSections = useMemo(
    () =>
      CUSTOMIZATION_SECTIONS.map((section) => ({
        ...section,
        options: section.options
          .map((option, idx) => ({ ...option, idx }))
          .filter(({ id }) => isLudoOptionUnlocked(section.key, id, ludoInventory))
      })).filter((section) => section.options.length > 0),
    [ludoInventory]
  );
  const arenaRef = useRef(null);
  const [seatAnchors, setSeatAnchors] = useState([]);
  const seatPositionsRef = useRef([]);
  const [ui, setUi] = useState({
    turn: 0,
    status: 'Your turn — dice rolling soon',
    dice: null,
    winner: null,
    turnCycle: 0
  });

  const playerColors = useMemo(() => resolvePlayerColors(appearance), [appearance]);

  const playerColorsHex = useMemo(
    () => playerColors.slice(0, activePlayerCount).map((value) => colorNumberToHex(value)),
    [activePlayerCount, playerColors]
  );

  const aiFlags = useMemo(() => {
    const base = Array.isArray(aiFlagOverrides) ? aiFlagOverrides.filter(Boolean) : [];
    const pool = [...base];
    while (pool.length < aiOpponentCount) {
      pool.push(FLAG_EMOJIS[Math.floor(Math.random() * FLAG_EMOJIS.length)]);
    }
    return pool.slice(0, aiOpponentCount);
  }, [aiFlagOverrides, aiOpponentCount]);
  const aiLoadoutByPlayer = useMemo(() => createAiUniqueLoadout(activePlayerCount), [activePlayerCount]);

  const userPhotoUrl = avatar || '/assets/icons/profile.svg';

  const applyCameraViewMode = useCallback((nextIs2d) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const boardLookTarget = boardLookTargetRef.current;
    if (!camera || !controls || !boardLookTarget) return;

    const topDownPolar = 0.001;
    if (nextIs2d) {
      if (!saved3dCameraStateRef.current) {
        saved3dCameraStateRef.current = {
          position: camera.position.clone(),
          target: controls.target.clone(),
          minPolarAngle: controls.minPolarAngle,
          maxPolarAngle: controls.maxPolarAngle,
          minAzimuthAngle: controls.minAzimuthAngle,
          maxAzimuthAngle: controls.maxAzimuthAngle,
          enableRotate: controls.enableRotate,
          enablePan: controls.enablePan,
          enableZoom: controls.enableZoom,
          minDistance: controls.minDistance,
          maxDistance: controls.maxDistance
        };
      }
      cancelCameraFocusAnimation();
      cancelCameraViewAnimation();
      cameraTurnStateRef.current.activePriority = -Infinity;
      cameraTurnStateRef.current.followObject = null;
      const max2dDistance = CAM.maxR * CAMERA_2D_MAX_DISTANCE_FACTOR;
      const topDownDistance = clamp(CAM.maxR * CAMERA_2D_DISTANCE_FACTOR, CAM.minR, max2dDistance);
      camera.position.set(boardLookTarget.x, boardLookTarget.y + topDownDistance, boardLookTarget.z + 0.001);
      controls.target.copy(boardLookTarget);
      controls.enableRotate = false;
      controls.enablePan = false;
      controls.enableZoom = true;
      controls.minPolarAngle = topDownPolar;
      controls.maxPolarAngle = topDownPolar;
      controls.minAzimuthAngle = -Infinity;
      controls.maxAzimuthAngle = Infinity;
      controls.minDistance = CAM.minR;
      controls.maxDistance = max2dDistance;
    } else {
      const saved = saved3dCameraStateRef.current;
      controls.enableRotate = false;
      controls.enablePan = saved?.enablePan ?? false;
      controls.enableZoom = false;
      controls.minPolarAngle = saved?.minPolarAngle ?? CAM.phiMin;
      controls.maxPolarAngle = saved?.maxPolarAngle ?? CAM.phiMax;
      controls.minAzimuthAngle = saved?.minAzimuthAngle ?? -Infinity;
      controls.maxAzimuthAngle = saved?.maxAzimuthAngle ?? Infinity;
      const baseRadius =
        saved?.position && saved?.target
          ? saved.position.distanceTo(saved.target)
          : camera.position.distanceTo(controls.target);
      controls.minDistance = baseRadius * CAMERA_ZOOM_MIN_FACTOR;
      controls.maxDistance = baseRadius * CAMERA_ZOOM_MAX_FACTOR;
      if (saved?.position && saved?.target) {
        camera.position.copy(saved.position);
        controls.target.copy(saved.target);
      } else {
        fitRef.current?.();
      }
      saved3dCameraStateRef.current = null;
    }

    controls.update();
    syncSkyboxToCameraRef.current?.();
  }, []);

  const handleToggleCamera2d = useCallback(() => {
    setIsCamera2d((current) => {
      const next = !current;
      applyCameraViewMode(next);
      return next;
    });
  }, [applyCameraViewMode]);

  const players = useMemo(() => {
    return Array.from({ length: activePlayerCount }, (_, index) => {
      if (index === 0) {
        return {
          index,
          photoUrl: avatar || '🙂',
          name: username || 'You',
          color: playerColorsHex[index] ?? '#ffffff',
          isAI: false
        };
      }
      const flag = aiFlags[index - 1] || '🏁';
      const name = avatarToName(flag) || 'AI Player';
      return {
        index,
        photoUrl: flag,
        name,
        color: playerColorsHex[index] ?? '#ffffff',
        isAI: true
      };
    });
  }, [activePlayerCount, aiFlags, avatar, username, playerColorsHex]);

  const resolvePlayerLabel = useCallback(
    (playerIndex) => players[playerIndex]?.name || COLOR_NAMES[playerIndex] || `Player ${playerIndex + 1}`,
    [players]
  );

  useEffect(() => {
    uiRef.current = ui;
  }, [ui]);

  const seatAnchorMap = useMemo(() => {
    const map = new Map();
    seatAnchors.forEach((anchor) => {
      if (anchor && typeof anchor.index === 'number') {
        map.set(anchor.index, anchor);
      }
    });
    return map;
  }, [seatAnchors]);

  const applyRendererQuality = useCallback(() => {
    const renderer = rendererRef.current;
    const host = wrapRef.current;
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
        ? THREE.MathUtils.clamp(quality.renderScale, 0.75, 1.3)
        : 0.92;
    renderer.setPixelRatio(Math.min(pixelRatioCap, dpr));
    renderer.setSize(host.clientWidth * renderScale, host.clientHeight * renderScale, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
  }, []);
  useEffect(() => {
    applyRendererQuality();
  }, [applyRendererQuality, frameQualityProfile]);

  const applyHdriEnvironment = useCallback(
    async (variantConfig = hdriVariantRef.current || DEFAULT_HDRI_VARIANT) => {
      const renderer = rendererRef.current;
      const arena = arenaRef.current;
      if (!renderer || !arena?.scene) return;
      const activeVariant = variantConfig || hdriVariantRef.current || DEFAULT_HDRI_VARIANT;
      if (!activeVariant) return;
      const envResult = await loadPolyHavenHdriEnvironment(renderer, {
        ...activeVariant,
        preferredResolutions: hdriResolutionProfile.preferredResolutions,
        fallbackResolution: hdriResolutionProfile.fallbackResolution
      });
      if (!envResult?.envMap) return;
      const prevDispose = disposeEnvironmentRef.current;
      const prevTexture = envTextureRef.current;
      const prevSkybox = envSkyboxRef.current;
      const floorY = environmentFloorRef.current ?? 0;
      const boardLookTarget = arena.boardLookTarget ?? boardLookTargetRef.current ?? new THREE.Vector3();
      const cameraHeight =
        Math.max(activeVariant?.cameraHeightM ?? DEFAULT_HDRI_CAMERA_HEIGHT_M, MIN_HDRI_CAMERA_HEIGHT_M) *
        HDRI_UNITS_PER_METER;
      const radiusMultiplier =
        typeof activeVariant?.groundRadiusMultiplier === 'number'
          ? activeVariant.groundRadiusMultiplier
          : DEFAULT_HDRI_RADIUS_MULTIPLIER;
      const sceneSpan = Math.max(TABLE_RADIUS, BOARD_RADIUS);
      const groundRadius = Math.max(sceneSpan * radiusMultiplier, MIN_HDRI_RADIUS);
      const skyboxResolution = Math.max(
        16,
        Math.floor(activeVariant?.groundResolution ?? HDRI_GROUNDED_RESOLUTION)
      );
      const skyboxRadius = Math.max(groundRadius, cameraHeight * 2.5, MIN_HDRI_RADIUS);
      const environmentRotationY =
        typeof activeVariant?.rotationY === 'number'
          ? activeVariant.rotationY
          : LUDO_HDRI_MAIN_SCENE_FACING_ROTATION_Y;
      let skybox = null;
      if (envResult.skyboxMap && skyboxRadius > 0 && cameraHeight > 0) {
        try {
          skybox = new GroundedSkybox(envResult.skyboxMap, cameraHeight, skyboxRadius, skyboxResolution);
          skybox.position.set(boardLookTarget.x, floorY + cameraHeight, boardLookTarget.z);
          skybox.rotation.y = environmentRotationY;
          skybox.material.depthWrite = false;
          skybox.userData.cameraHeight = cameraHeight;
          skybox.userData.rotationY = environmentRotationY;
          arena.scene.background = null;
          arena.scene.add(skybox);
          envSkyboxRef.current = skybox;
          envSkyboxTextureRef.current = envResult.skyboxMap;
          baseSkyboxScaleRef.current = skybox.scale?.x ?? 1;
        } catch (error) {
          console.warn('Failed to create grounded HDRI skybox', error);
          skybox = null;
        }
      }
      arena.scene.environment = envResult.envMap;
      if (!skybox) {
        arena.scene.background = envResult.envMap;
        envSkyboxRef.current = null;
        envSkyboxTextureRef.current = null;
        if ('backgroundRotation' in arena.scene) {
          arena.scene.backgroundRotation.set(0, environmentRotationY, 0);
        }
        if ('backgroundIntensity' in arena.scene && typeof activeVariant?.backgroundIntensity === 'number') {
          arena.scene.backgroundIntensity = activeVariant.backgroundIntensity;
        }
      }
      if ('environmentRotation' in arena.scene) {
        arena.scene.environmentRotation.set(0, environmentRotationY, 0);
      }
      if (typeof activeVariant?.environmentIntensity === 'number') {
        arena.scene.environmentIntensity = activeVariant.environmentIntensity;
      }
      renderer.toneMappingExposure = activeVariant?.exposure ?? renderer.toneMappingExposure;
      envTextureRef.current = envResult.envMap;
      syncSkyboxToCameraRef.current?.();
      disposeEnvironmentRef.current = () => {
        if (arena.scene) {
          if (arena.scene.environment === envResult.envMap) {
            arena.scene.environment = null;
          }
          if (!skybox && arena.scene.background === envResult.envMap) {
            arena.scene.background = null;
          }
        }
        envResult.envMap.dispose?.();
        if (skybox) {
          skybox.parent?.remove(skybox);
          skybox.geometry?.dispose?.();
          skybox.material?.dispose?.();
          if (envSkyboxRef.current === skybox) {
            envSkyboxRef.current = null;
          }
        }
        if (envResult.skyboxMap) {
          envResult.skyboxMap.dispose?.();
          if (envSkyboxTextureRef.current === envResult.skyboxMap) {
            envSkyboxTextureRef.current = null;
          }
        }
      };
      if (prevDispose && (prevTexture !== envResult.envMap || prevSkybox !== skybox)) {
        prevDispose();
      }
    },
    [hdriResolutionProfile]
  );

  const updateEnvironmentFloor = useCallback(() => {
    const arena = arenaRef.current;
    if (!arena) return;
    const tableGroup = arena.tableInfo?.group ?? null;
    const objects = [];
    if (tableGroup) objects.push(tableGroup);
    if (Array.isArray(arena.chairs)) {
      arena.chairs.forEach((chair) => {
        if (chair?.group) objects.push(chair.group);
      });
    }
    if (!objects.length) return;
    const box = new THREE.Box3();
    let hasBounds = false;
    objects.forEach((obj) => {
      if (!obj) return;
      const objBox = new THREE.Box3().setFromObject(obj);
      if (objBox.isEmpty()) return;
      if (!hasBounds) {
        box.copy(objBox);
        hasBounds = true;
      } else {
        box.union(objBox);
      }
    });
    if (!hasBounds) return;
    const floorMinY = box.min.y;
    environmentFloorRef.current = floorMinY - HDRI_GROUND_ALIGNMENT_OFFSET;
    const skybox = envSkyboxRef.current;
    const boardLookTarget = arena.boardLookTarget ?? boardLookTargetRef.current;
    if (skybox && Number.isFinite(skybox.userData?.cameraHeight)) {
      if (boardLookTarget) {
        skybox.position.x = boardLookTarget.x;
        skybox.position.z = boardLookTarget.z;
      }
      skybox.position.y = environmentFloorRef.current + skybox.userData.cameraHeight;
      if (Number.isFinite(skybox.userData?.rotationY)) {
        skybox.rotation.y = skybox.userData.rotationY;
      }
    }
  }, []);

  const groundArenaToHdriFloor = useCallback(({ preserveView = false } = {}) => {
    const arena = arenaRef.current;
    if (!arena?.arenaGroup) return;
    const tableGroup = arena.tableInfo?.group ?? null;
    const objects = [];
    if (tableGroup) objects.push(tableGroup);
    if (Array.isArray(arena.chairs)) {
      arena.chairs.forEach((chair) => {
        if (chair?.group) objects.push(chair.group);
      });
    }
    if (!objects.length) return;
    const bounds = new THREE.Box3();
    let hasBounds = false;
    objects.forEach((obj) => {
      if (!obj) return;
      const box = new THREE.Box3().setFromObject(obj);
      if (box.isEmpty()) return;
      if (!hasBounds) {
        bounds.copy(box);
        hasBounds = true;
      } else {
        bounds.union(box);
      }
    });
    if (!hasBounds || !Number.isFinite(bounds.min.y)) return;
    const floorMinY = bounds.min.y;
    const targetFloorY = HDRI_GROUND_ALIGNMENT_OFFSET;
    const yShift = targetFloorY - floorMinY;
    if (Math.abs(yShift) <= 1e-4) {
      environmentFloorRef.current = -HDRI_GROUND_ALIGNMENT_OFFSET;
      return;
    }

    const finalShift = yShift;
    arena.arenaGroup.position.y += finalShift;
    if (arena.boardLookTarget) arena.boardLookTarget.y += finalShift;
    if (arena.defaultLookTarget) arena.defaultLookTarget.y += finalShift;
    if (preserveView) {
      const camera = cameraRef.current;
      if (camera) {
        camera.position.y += finalShift;
      }
      if (arena.controls?.target) {
        arena.controls.target.y += finalShift;
        arena.controls.update();
      }
    }
    environmentFloorRef.current = -HDRI_GROUND_ALIGNMENT_OFFSET;
    const skybox = envSkyboxRef.current;
    if (skybox && Number.isFinite(skybox.userData?.cameraHeight)) {
      skybox.position.y = environmentFloorRef.current + skybox.userData.cameraHeight;
    }
  }, []);

  const rebuildTable = useCallback(
    async (tableTheme, tableFinish, tableCloth = DEFAULT_CLOTH_OPTION) => {
      const arena = arenaRef.current;
      const renderer = rendererRef.current;
      if (!arena?.arenaGroup || !renderer) return null;
      const token = ++tableBuildTokenRef.current;
      const previous = arena.tableInfo;
      const boardGroup = arena.boardGroup;
      if (boardGroup && previous?.group) {
        previous.group.remove(boardGroup);
      }
      previous?.dispose?.();

      let tableInfo = null;

      const textureOptions = {
        textureLoader: textureLoaderRef.current,
        maxAnisotropy: maxAnisotropyRef.current ?? 1,
        fallbackTexture: fallbackTextureRef.current,
        textureCache: textureCacheRef.current,
        preferredTextureSizes: textureResolutionStack
      };

      if (tableTheme?.source === 'polyhaven' && tableTheme?.assetId) {
        try {
          const model = await createPolyhavenInstance(
            tableTheme.assetId,
            TABLE_HEIGHT,
            tableTheme.rotationY || 0,
            renderer,
            textureOptions
          );
          stripTableBase(model);
          if (tableBuildTokenRef.current !== token) {
            disposeObjectResources(model);
            return null;
          }
          const tableGroup = new THREE.Group();
          tableGroup.add(model);
          const { surfaceY, radius } = fitTableModelToArena(tableGroup, tableTheme?.id);
          arena.arenaGroup.add(tableGroup);
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
            shapeId: tableTheme.id,
            rotationY: tableTheme.rotationY ?? 0,
            themeId: tableTheme.id,
            getOuterRadius: () => radius,
            getInnerRadius: () => radius * 0.72
          };
        } catch (error) {
          console.warn('Failed to load Poly Haven table', error);
        }
      }

      if (!tableInfo) {
        const woodOption = tableFinish?.woodOption ?? DEFAULT_WOOD_OPTION;
        const clothOption = tableCloth;
        const baseOption = DEFAULT_BASE_OPTION;
        const procedural = createMurlanStyleTable({
          arena: arena.arenaGroup,
          renderer,
          tableRadius: TABLE_RADIUS * TABLE_VISUAL_SCALE,
          tableHeight: TABLE_HEIGHT,
          woodOption,
          clothOption,
          baseOption,
          includeBase: true
        });
        applyTableMaterials(procedural.materials, { woodOption, clothOption, baseOption }, renderer);
        tableInfo = { ...procedural, themeId: tableTheme?.id || procedural.shapeId };
      }

      if (tableBuildTokenRef.current !== token) {
        tableInfo.dispose?.();
        return null;
      }

      arena.tableInfo = tableInfo;
      arena.tableThemeId = tableTheme?.id || 'murlan-default';
      updateTokenSurfaceOffset(arena.tableThemeId);

      if (boardGroup) {
        boardGroup.position.set(0, tableInfo.surfaceY + BOARD_GROUP_SURFACE_OFFSET, 0);
        applyBoardGroupScale(boardGroup, tableInfo);
        tableInfo.group.add(boardGroup);
      }

      groundArenaToHdriFloor({ preserveView: true });
      updateEnvironmentFloor();
      return tableInfo;
    },
    [groundArenaToHdriFloor, textureResolutionStack, updateEnvironmentFloor]
  );

  const rebuildChairs = useCallback(
    async (stoolTheme) => {
      const arena = arenaRef.current;
      const renderer = rendererRef.current;
      if (!arena?.chairs || !renderer) return;
      const textureOptions = {
        textureLoader: textureLoaderRef.current,
        maxAnisotropy: maxAnisotropyRef.current ?? 1,
        fallbackTexture: fallbackTextureRef.current,
        textureCache: textureCacheRef.current,
        preferredTextureSizes: textureResolutionStack
      };
      const token = ++chairBuildTokenRef.current;
      const chairBuild = await buildChairTemplate(stoolTheme, renderer, textureOptions);
      if (chairBuildTokenRef.current !== token || !chairBuild) return;

      arena.chairs.forEach(({ group }) => {
        const previous = group?.userData?.chairModel;
        if (previous) {
          disposeObjectResources(previous);
          group.remove(previous);
        }
      });

      if (arena.chairTemplate && arena.chairTemplate !== chairBuild.chairTemplate) {
        disposeChairAssets(arena.chairTemplate, arena.chairMaterials);
      }

      const preserve = chairBuild.preserveOriginal ?? shouldPreserveChairMaterials(stoolTheme);
      const chairMaterials = chairBuild.materials;
      if (!preserve && chairMaterials) {
        applyChairThemeMaterials({ chairMaterials }, stoolTheme);
      }

      arena.chairTemplate = chairBuild.chairTemplate;
      arena.chairMaterials = chairMaterials;
      arena.chairThemePreserve = preserve;
      arena.chairThemeId = stoolTheme?.id;

      arena.chairs.forEach(({ group }) => {
        const clone = chairBuild.chairTemplate.clone(true);
        group.add(clone);
        group.userData.chairModel = clone;
      });
      groundArenaToHdriFloor({ preserveView: true });
      updateEnvironmentFloor();
    },
    [groundArenaToHdriFloor, textureResolutionStack, updateEnvironmentFloor]
  );

  const clearHumanRollTimeout = useCallback(() => {
    if (humanRollTimeoutRef.current) {
      clearTimeout(humanRollTimeoutRef.current);
      humanRollTimeoutRef.current = null;
    }
  }, [activePlayerCount]);

  const clearTurnAdvanceTimeout = useCallback(() => {
    if (turnAdvanceTimeoutRef.current) {
      clearTimeout(turnAdvanceTimeoutRef.current);
      turnAdvanceTimeoutRef.current = null;
    }
  }, [activePlayerCount, players]);

  const clearHumanSelection = useCallback(() => {
    const selection = humanSelectionRef.current;
    const state = stateRef.current;
    if (selection && state?.tokens?.[0]) {
      selection.options.forEach((option) => {
        const token = state.tokens[0][option.token];
        clearTokenHighlight(token);
      });
    }
    humanSelectionRef.current = null;
  }, []);

  const beginHumanSelection = useCallback(
    (roll, options, { skipCameraFollow = false } = {}) => {
      const state = stateRef.current;
      if (!state || !Array.isArray(options) || !options.length) return;
      clearHumanSelection();
      const normalized = options.map((option) => ({ token: option.token, entering: option.entering }));
      humanSelectionRef.current = { roll, options: normalized, skipCameraFollow };
      normalized.forEach((option) => {
        const token = state.tokens?.[0]?.[option.token];
        if (token) {
          setTokenHighlight(token, true);
        }
      });
      setUi((s) => ({
        ...s,
        status: `Tap a token to move (rolled ${roll})`
      }));
    },
    [clearHumanSelection, setUi]
  );

  const scheduleHumanAutoRoll = useCallback(() => {
    const state = stateRef.current;
    if (!state || state.winner || state.turn !== 0 || state.animation) return;
    if (humanSelectionRef.current) return;
    const diceObj = diceRef.current;
    if (!diceObj || diceObj.userData?.isRolling) return;
    if (humanRollTimeoutRef.current) return;
    humanRollTimeoutRef.current = window.setTimeout(() => {
      humanRollTimeoutRef.current = null;
      rollDiceRef.current?.();
    }, HUMAN_ROLL_DELAY_MS);
  }, []);

  const setTileHighlight = useCallback((tile, active, tokenColor = null) => {
    if (!tile || !tile.material) return;
    const data = tile.userData?.boardTile;
    if (!data) return;
    if (active) {
      if (tile.material.emissive) {
        if (tokenColor) {
          tile.material.emissive.copy(tokenColor).lerp(new THREE.Color(0xffffff), 0.14);
        } else if (data.highlightEmissive) {
          tile.material.emissive.copy(data.highlightEmissive);
        }
      }
      if (tile.material.color && tokenColor) {
        tile.material.color.copy(tokenColor).lerp(new THREE.Color(0xffffff), 0.08);
      } else if (tile.material.color && data.highlightColor) {
        tile.material.color.copy(data.highlightColor);
      }
      tile.material.emissiveIntensity = tokenColor
        ? Math.max(data.baseIntensity + 1.2, data.highlightIntensity + 0.2, 1.2)
        : Math.max(data.highlightIntensity, data.baseIntensity + 1.05);
      data.isHighlighted = true;
    } else {
      if (tile.material.emissive && data.baseEmissive) {
        tile.material.emissive.copy(data.baseEmissive);
      }
      if (tile.material.color && data.baseColor) {
        tile.material.color.copy(data.baseColor);
      }
      tile.material.emissiveIntensity = data.baseIntensity;
      data.isHighlighted = false;
    }
  }, []);

  const findTileForProgress = useCallback((player, progress) => {
    const state = stateRef.current;
    if (!state) return null;
    if (progress < 0) return null;
    if (progress < RING_STEPS) {
      const trackIndex = (PLAYER_START_INDEX[player] + progress) % RING_STEPS;
      return state.trackTiles?.[trackIndex] ?? null;
    }
    if (progress < RING_STEPS + HOME_STEPS) {
      const step = progress - RING_STEPS;
      return state.homeColumnTiles?.[player]?.[step] ?? null;
    }
    return null;
  }, []);

  const clearAnimationHighlights = useCallback(
    (anim) => {
      if (!anim || !Array.isArray(anim.activeHighlightTiles)) return;
      anim.activeHighlightTiles.forEach((tile) => {
        setTileHighlight(tile, false);
      });
      anim.activeHighlightTiles.length = 0;
      anim.highlightIndex = -1;
    },
    [setTileHighlight]
  );

  const updateAnimationHighlight = useCallback(
    (anim, nextIndex) => {
      if (!anim || !Array.isArray(anim.highlightTiles)) return;
      if (nextIndex != null && nextIndex >= 0 && nextIndex < anim.highlightTiles.length) {
        const nextTile = anim.highlightTiles[nextIndex];
      if (nextTile && Array.isArray(anim.activeHighlightTiles) && !anim.activeHighlightTiles.includes(nextTile)) {
          const activeColors = playerColorsRef.current || DEFAULT_PLAYER_COLORS;
          const color = new THREE.Color(activeColors[anim.player] ?? DEFAULT_PLAYER_COLORS[anim.player] ?? 0xffffff);
          setTileHighlight(nextTile, true, color);
          anim.activeHighlightTiles.push(nextTile);
        }
        anim.highlightIndex = nextIndex;
        return;
      }
      clearAnimationHighlights(anim);
    },
    [clearAnimationHighlights, setTileHighlight]
  );

  const updateTokenStacks = useCallback(() => {
    const state = stateRef.current;
    if (!state) return;
    const counts = new Map();
    for (let player = 0; player < activePlayerCount; player += 1) {
      for (let tokenIndex = 0; tokenIndex < 4; tokenIndex += 1) {
        const progress = state.progress?.[player]?.[tokenIndex];
        const token = state.tokens?.[player]?.[tokenIndex];
        if (!token) continue;
        const label = token.userData?.countLabel;
        if (label) {
          label.visible = false;
        }
        if (!Number.isFinite(progress) || progress < 0 || progress > GOAL_PROGRESS) {
          continue;
        }
        const key = `${player}-${progress}`;
        if (!counts.has(key)) counts.set(key, []);
        counts.get(key).push(token);
      }
    }

    counts.forEach((tokens) => {
      if (!Array.isArray(tokens) || tokens.length < 2) return;
      tokens.forEach((token) => {
        const label = token.userData?.countLabel;
        if (!label) return;
        const tokenColor = token.userData?.tokenColor;
        updateTokenCountLabel(label, tokens.length, tokenColor);
        label.visible = true;
      });
    });
  }, []);

  const renderPreview = useCallback((type, option) => {
    switch (type) {
      case 'tables': {
        const thumb = option?.thumbnail;
        return (
          <div className="relative h-14 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950/60">
            {thumb ? (
              <img
                src={thumb}
                alt={option?.label || 'Table model'}
                className="h-full w-full object-cover opacity-80"
                loading="lazy"
              />
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
      case 'stools': {
        if (option?.thumbnail) {
          return (
            <div className="relative h-14 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950/60">
              <img
                src={option.thumbnail}
                alt={option?.label || 'Chair'}
                className="h-full w-full object-cover opacity-80"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-br from-black/30 via-transparent to-black/50" />
              <div className="absolute bottom-1 left-1 rounded-md bg-black/60 px-2 py-0.5 text-[0.55rem] font-semibold uppercase tracking-wide text-emerald-100/80">
                {(option?.label || 'Chair').slice(0, 22)}
              </div>
            </div>
          );
        }
        return (
          <div className="relative h-14 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950/40">
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="h-12 w-20 rounded-3xl border border-white/10"
                style={{
                  background: `linear-gradient(135deg, ${option.seatColor || '#7c3aed'}, ${option.legColor || '#111827'})`,
                  boxShadow: 'inset 0 0 12px rgba(0,0,0,0.35)'
                }}
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-black/40" />
          </div>
        );
      }
      case 'environmentHdri': {
        const swatches = option?.swatches || option?.preview || [];
        const fallbackSwatches = [0x0ea5e9, 0x1e293b, 0xfbbf24, 0x111827];
        const palette = swatches.length ? swatches : fallbackSwatches;
        return (
          <div className="relative h-14 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950/50">
            {option?.thumbnail ? (
              <img
                src={option.thumbnail}
                alt={`${option?.label || option?.name || 'HDRI'} thumbnail`}
                className="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="absolute inset-0 grid grid-cols-4">
                {palette.map((swatch, idx) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <div
                    key={`${option?.id}-swatch-${idx}`}
                    className="h-full w-full"
                    style={{ backgroundColor: colorNumberToHex(normalizeColorValue(swatch, DEFAULT_PLAYER_COLORS[idx] || swatch)) }}
                  />
                ))}
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/5 via-transparent to-black/50" />
          </div>
        );
      }
      case 'tokenPalette': {
        const swatches = option?.swatches ?? [];
        return (
          <div className="relative h-14 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950/40">
            <div className="absolute inset-0 grid grid-cols-4">
              {swatches.map((swatch, idx) => (
                <div
                  // eslint-disable-next-line react/no-array-index-key
                  key={`${option.id}-swatch-${idx}`}
                  className="h-full w-full"
                  style={{ backgroundColor: colorNumberToHex(normalizeColorValue(swatch, DEFAULT_PLAYER_COLORS[idx])) }}
                />
              ))}
            </div>
            <div className="absolute inset-0 bg-gradient-to-tr from-white/5 via-transparent to-black/40" />
          </div>
        );
      }
      case 'tokenStyle':
        return (
          <div className="relative flex h-14 w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-slate-950/40 px-3 text-center text-[0.7rem] leading-tight text-slate-100">
            <div className="absolute inset-0 bg-gradient-to-tr from-white/5 via-transparent to-black/40" />
            <div className="relative flex flex-col items-center">
              <span className="font-semibold">{option.label}</span>
              {option.description && (
                <span className="text-[0.6rem] text-slate-200/80">{option.description}</span>
              )}
            </div>
          </div>
        );
      case 'tokenPiece':
        return (
          <div className="relative flex h-14 w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-slate-950/40 px-3 text-center text-[0.7rem] leading-tight text-slate-100">
            <div className="absolute inset-0 bg-gradient-to-tr from-white/5 via-transparent to-black/40" />
            <div className="relative flex flex-col items-center">
              <span className="text-xl">{option.symbol}</span>
              <span className="text-[0.6rem] text-slate-200/80">{option.label}</span>
            </div>
          </div>
        );
      case 'captureAnimation':
        return (
          <div className="relative flex h-14 w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-slate-950/40 px-3 text-center text-[0.65rem] leading-tight text-slate-100">
            <div className="absolute inset-0 bg-gradient-to-tr from-white/5 via-transparent to-black/40" />
            <div className="relative flex flex-col items-center gap-0.5">
              <span className="font-semibold">{option.label}</span>
              {option.description ? <span className="text-[0.56rem] text-slate-200/80">{option.description}</span> : null}
            </div>
          </div>
        );
      default:
        return null;
    }
  }, []);

  const stopDiceTransition = () => {
    if (diceTransitionRef.current?.cancel) {
      try {
        diceTransitionRef.current.cancel();
      } catch (error) {
        console.warn('Failed to cancel dice transition', error);
      }
    }
    diceTransitionRef.current = null;
  };

  const animateDicePosition = (dice, destination, { duration = 450, lift = 0.04 } = {}) => {
    if (!dice || !destination) return;
    const target = destination.clone ? destination.clone() : new THREE.Vector3().copy(destination);
    stopDiceTransition();
    const startPos = dice.position.clone();
    const started = performance.now();
    const state = { cancelled: false };
    const handle = {
      cancel: () => {
        state.cancelled = true;
      }
    };
    diceTransitionRef.current = handle;
    const step = () => {
      if (state.cancelled) return;
      const now = performance.now();
      const t = Math.min(1, (now - started) / Math.max(1, duration));
      const eased = easeOutCubic(t);
      const pos = startPos.clone().lerp(target, eased);
      if (lift > 0) {
        const arc = Math.sin(Math.PI * eased) * lift * (1 - eased * 0.35);
        pos.y = THREE.MathUtils.lerp(startPos.y, target.y, eased) + arc;
      }
      dice.position.copy(pos);
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        dice.position.copy(target);
        if (diceTransitionRef.current === handle) {
          diceTransitionRef.current = null;
        }
      }
    };
    requestAnimationFrame(step);
  };

  const moveDiceToRail = (player, immediate = false) => {
    const dice = diceRef.current;
    if (!dice) return;
    const rails = dice.userData?.railPositions;
    if (!rails || !rails[player]) return;
    const target = rails[player].clone ? rails[player].clone() : new THREE.Vector3().copy(rails[player]);
    if (immediate) {
      stopDiceTransition();
      dice.position.copy(target);
      return;
    }
    animateDicePosition(dice, target, { duration: 520, lift: 0.05 });
  };

  const updateTurnIndicator = (player, immediate = false) => {
    const indicator = turnIndicatorRef.current;
    if (!indicator) return;
    const material = Array.isArray(indicator.material)
      ? indicator.material[0]
      : indicator.material;
    if (!material) return;
    const activeColors = playerColorsRef.current || DEFAULT_PLAYER_COLORS;
    const color = new THREE.Color(activeColors[player]);
    material.color.set(color);
    if (material.emissive) {
      material.emissive.set(color.clone().multiplyScalar(0.3));
    }
    moveDiceToRail(player, immediate);
  };

  const applyRailLayout = useCallback(() => {
    const dice = diceRef.current;
    const state = stateRef.current;
    if (!dice || !state) return;
    const layouts = dice.userData?.tokenRails;
    if (!Array.isArray(layouts) || layouts.length < activePlayerCount) return;

    const padMeshes = Array.isArray(dice.userData?.railPads) ? dice.userData.railPads : [];
    const updatedPads =
      Array.isArray(state.startPads) && state.startPads.length >= activePlayerCount
        ? state.startPads.slice()
        : Array.from({ length: activePlayerCount }, () =>
            Array.from({ length: 4 }, () => new THREE.Vector3())
          );

    layouts.forEach((layout, player) => {
      if (!layout) {
        if (padMeshes[player]) padMeshes[player].visible = false;
        return;
      }
      const base = layout.base?.clone?.() ? layout.base.clone() : null;
      const forward = layout.forward?.clone?.() ? layout.forward.clone() : null;
      const right = layout.right?.clone?.() ? layout.right.clone() : null;
      if (!base || !forward || !right) {
        if (padMeshes[player]) padMeshes[player].visible = false;
        return;
      }
      forward.setY(0);
      right.setY(0);
      if (forward.lengthSq() < 1e-6) {
        forward.set(0, 0, 1);
      } else {
        forward.normalize();
      }
      if (right.lengthSq() < 1e-6) {
        right.set(-forward.z, 0, forward.x);
      } else {
        right.normalize();
      }

      const centerPull =
        TOKEN_RAIL_CENTER_PULL_PER_PLAYER[player] ?? TOKEN_RAIL_CENTER_PULL_DEFAULT;
      if (centerPull > 0) {
        base.add(forward.clone().multiplyScalar(-centerPull));
      }

      const baseForwardShift = TOKEN_RAIL_BASE_FORWARD_SHIFT[player] ?? 0;
      if (baseForwardShift !== 0) {
        base.add(forward.clone().multiplyScalar(baseForwardShift));
      }

      if (TOKEN_FRONT_OUTWARD_SHIFT !== 0) {
        base.add(forward.clone().multiplyScalar(TOKEN_FRONT_OUTWARD_SHIFT));
      }

      const forwardOffset = forward.clone().multiplyScalar(RAIL_TOKEN_FORWARD_SPACING);
      const backwardOffset = forwardOffset.clone().multiplyScalar(-1);
      const sideMultiplier = TOKEN_RAIL_SIDE_MULTIPLIER[player] ?? 1;
      const rightOffset = right
        .clone()
        .multiplyScalar(RAIL_TOKEN_SIDE_SPACING * sideMultiplier);
      const leftOffset = rightOffset.clone().multiplyScalar(-1);

      const homeHeight = getTokenRailHeight(player);

      const playerPads = [
        base.clone().add(backwardOffset).add(leftOffset),
        base.clone().add(backwardOffset).add(rightOffset),
        base.clone().add(forwardOffset).add(leftOffset),
        base.clone().add(forwardOffset).add(rightOffset)
      ].map((vec) => {
        vec.y = 0;
        return vec;
      });

      updatedPads[player] = playerPads;

      const mesh = padMeshes[player];
      if (mesh) {
        mesh.visible = true;
        mesh.position.copy(base);
        mesh.position.y = 0;
        mesh.rotation.x = -Math.PI / 2;
        const angle = Math.atan2(forward.x, forward.z);
        mesh.rotation.y = angle;
      }

      for (let tokenIndex = 0; tokenIndex < 4; tokenIndex += 1) {
        if (!state.progress?.[player] || state.progress[player][tokenIndex] == null) continue;
        if (state.progress[player][tokenIndex] >= 0) continue;
        const token = state.tokens?.[player]?.[tokenIndex];
        if (!token) continue;
        const home = playerPads[tokenIndex];
        const target = home.clone();
        target.y = homeHeight;
        token.position.copy(target);
        applyTokenFacingRotation(token);
      }
    });

    padMeshes.forEach((mesh, index) => {
      if (!layouts[index] && mesh) {
        mesh.visible = false;
      }
    });

    state.startPads = updatedPads;
  }, [activePlayerCount]);

  const configureDiceAnchors = useCallback(
    ({ dice, boardGroup, chairs, tableInfo } = {}) => {
      const diceObj = dice ?? diceRef.current;
      const arena = arenaRef.current;
      const group = boardGroup ?? arena?.boardGroup;
      const chairList = chairs ?? arena?.chairs;
      const table = tableInfo ?? arena?.tableInfo;
      if (!diceObj || !group) return;

      const centerWorld = new THREE.Vector3();
      const scaleWorld = new THREE.Vector3();
      const centerXZ = new THREE.Vector3();
      group.getWorldPosition(centerWorld);
      group.getWorldScale(scaleWorld);
      centerXZ.set(centerWorld.x, 0, centerWorld.z);

      const heightLocal =
        diceObj.userData?.railHeight ?? diceObj.userData?.baseHeight ?? DICE_BASE_HEIGHT;
      const diceShapeLift = isShapedLudoTable(table?.themeId) ? SHAPED_TABLE_DICE_SURFACE_LIFT : 0;
      const heightWorld = heightLocal * scaleWorld.y;

      const fallbackDirs = [
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(0, 0, -1),
        new THREE.Vector3(-1, 0, 0)
      ];

      const rails = [];
      const rolls = [];
      const layouts = [];
      const up = new THREE.Vector3(0, 1, 0);
      const centerLocal = new THREE.Vector3();
      centerLocal.copy(centerWorld);
      group.worldToLocal(centerLocal);
      const seatWorldPos = new THREE.Vector3();

      for (let i = 0; i < activePlayerCount; i += 1) {
        const seatDir = new THREE.Vector3();
        const chairGroup = chairList?.[i]?.group;
        if (chairGroup) {
          chairGroup.getWorldPosition(seatDir);
          seatDir.setY(0);
          seatDir.sub(centerXZ);
        } else {
          seatDir.copy(fallbackDirs[i % fallbackDirs.length]);
        }

        if (seatDir.lengthSq() < 1e-6) {
          seatDir.copy(fallbackDirs[i % fallbackDirs.length]);
        }
        seatDir.setY(0);
        if (seatDir.lengthSq() < 1e-6) {
          seatDir.set(0, 0, 1);
        }
        seatDir.normalize();

        // Keep token resting rails aligned to the previous wooden rail footprint.
        let restRadius = BOARD_RADIUS + 0.075;
        if (chairGroup) {
          chairGroup.getWorldPosition(seatWorldPos);
          seatWorldPos.setY(0);
          const seatDistance = seatWorldPos.distanceTo(centerXZ);
          if (Number.isFinite(seatDistance) && seatDistance > 0.2) {
            restRadius = Math.max(restRadius, seatDistance - 0.34);
          }
        }
        if (table?.getInnerRadius) {
          const inner = table.getInnerRadius(seatDir);
          if (Number.isFinite(inner) && inner > 0) {
            const outer = table.getOuterRadius?.(seatDir) ?? inner;
            const rimInner = Math.min(inner, outer);
            const rimOuter = Math.max(inner, outer);
            const rimMid = rimInner + (rimOuter - rimInner) * 0.3;
            restRadius = Math.max(restRadius, THREE.MathUtils.clamp(rimMid, rimInner + 0.05, rimOuter - 0.08));
            restRadius = Math.max(restRadius, BOARD_RADIUS + 0.18);
            if (Number.isFinite(rimOuter)) {
              restRadius = Math.min(restRadius, rimOuter - 0.12);
            }
          }
        }
        if (table?.getOuterRadius) {
          const outer = table.getOuterRadius(seatDir);
          if (Number.isFinite(outer) && outer > 0) {
            restRadius = Math.min(restRadius, outer - 0.14);
          }
        }
        restRadius = Math.max(restRadius, BOARD_RADIUS + 0.075);
        restRadius += TOKEN_RAIL_OUTWARD_PUSH;
        if (table?.getOuterRadius) {
          const outer = table.getOuterRadius(seatDir);
          if (Number.isFinite(outer) && outer > 0) {
            restRadius = Math.min(restRadius, outer - 0.06);
          }
        }

        const restWorld = seatDir.clone().multiplyScalar(restRadius).add(centerXZ);
        restWorld.y = centerWorld.y + heightWorld + diceShapeLift;
        const rollWorld = restWorld.clone();

        const restLocal = restWorld.clone();
        const rollLocal = rollWorld.clone();
        group.worldToLocal(restLocal);
        group.worldToLocal(rollLocal);
        restLocal.y = heightLocal;
        rollLocal.y = heightLocal;

        rails.push(restLocal);
        rolls.push(rollLocal);

        const seatWorldPoint = centerWorld.clone().add(seatDir);
        const seatLocalPoint = seatWorldPoint.clone();
        group.worldToLocal(seatLocalPoint);
        const forwardLocal = seatLocalPoint.sub(centerLocal).setY(0);
        if (forwardLocal.lengthSq() < 1e-6) {
          forwardLocal.set(0, 0, 1);
        } else {
          forwardLocal.normalize();
        }
        const rightLocal = new THREE.Vector3().crossVectors(up, forwardLocal).setY(0);
        if (rightLocal.lengthSq() < 1e-6) {
          rightLocal.set(-forwardLocal.z, 0, forwardLocal.x);
        } else {
          rightLocal.normalize();
        }
        const base = restLocal.clone();
        base.y = 0;
        layouts.push({ base, forward: forwardLocal.clone(), right: rightLocal.clone() });
      }

      diceObj.userData.railPositions = rails;
      const preferredLanding = Array.isArray(diceObj.userData?.homeLandingTargets)
        ? diceObj.userData.homeLandingTargets.map((vec) => vec.clone())
        : rolls.map((vec) => vec.clone());
      diceObj.userData.rollTargets = preferredLanding;
      diceObj.userData.tokenRails = layouts;
      applyRailLayout();
    }, [activePlayerCount, applyRailLayout]);

  useEffect(() => {
    const applyVolume = (baseVolume) => {
      const level = settingsRef.current.soundEnabled ? baseVolume : 0;
      [moveSoundRef, captureSoundRef, missileLaunchSoundRef, missileImpactSoundRef, droneSoundRef, fighterJetSoundRef, helicopterSoundRef, cheerSoundRef, diceSoundRef, diceRewardSoundRef, sixRollSoundRef, hahaSoundRef, giftBombSoundRef].forEach((ref) => {
        if (ref.current) {
          ref.current.volume = level;
          if (!settingsRef.current.soundEnabled) {
            try {
              ref.current.pause();
              ref.current.currentTime = 0;
            } catch {}
          }
        }
      });
    };
    const vol = getGameVolume();
    moveSoundRef.current = null;
    captureSoundRef.current = new Audio(bombSound);
    missileLaunchSoundRef.current = new Audio(LUDO_CAPTURE_MISSILE_LAUNCH_SOUND_URL);
    missileImpactSoundRef.current = new Audio(LUDO_CAPTURE_MISSILE_IMPACT_SOUND_URL);
    droneSoundRef.current = new Audio(LUDO_CAPTURE_DRONE_SOUND_URL);
    droneSoundRef.current.loop = true;
    droneSoundRef.current.volume = 0.42;
    fighterJetSoundRef.current = new Audio(LUDO_CAPTURE_FIGHTER_SOUND_URL);
    fighterJetSoundRef.current.loop = true;
    fighterJetSoundRef.current.volume = 0.42;
    helicopterSoundRef.current = new Audio(LUDO_CAPTURE_HELICOPTER_SOUND_URL);
    helicopterSoundRef.current.loop = true;
    helicopterSoundRef.current.volume = 0.42;
    cheerSoundRef.current = new Audio(cheerSound);
    // Procedural dice SFX is generated with Web Audio (no binary asset).
    diceSoundRef.current = null;
    diceRewardSoundRef.current = new Audio('/assets/sounds/successful.mp3');
    sixRollSoundRef.current = null;
    hahaSoundRef.current = new Audio('/assets/sounds/Haha.mp3');
    giftBombSoundRef.current = new Audio(bombSound);
    applyVolume(vol);
    const onVolChange = () => {
      applyVolume(getGameVolume());
    };
    window.addEventListener('gameVolumeChanged', onVolChange);
    return () => {
      window.removeEventListener('gameVolumeChanged', onVolChange);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (diceClearTimeoutRef.current) {
        clearTimeout(diceClearTimeoutRef.current);
        diceClearTimeoutRef.current = null;
      }
      if (humanRollTimeoutRef.current) {
        clearTimeout(humanRollTimeoutRef.current);
        humanRollTimeoutRef.current = null;
      }
      if (turnAdvanceTimeoutRef.current) {
        clearTimeout(turnAdvanceTimeoutRef.current);
        turnAdvanceTimeoutRef.current = null;
      }
      if (hahaStopTimeoutRef.current) {
        clearTimeout(hahaStopTimeoutRef.current);
        hahaStopTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage?.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(appearance));
      } catch (error) {
        console.warn('Failed to persist Ludo appearance', error);
      }
    }

    const arena = arenaRef.current;
    if (!arena) return;

    const normalized = normalizeAppearance(appearance);
    const safe = ensureAppearanceUnlocked(normalized);
    const tableTheme = MURLAN_TABLE_THEMES[safe.tables] ?? MURLAN_TABLE_THEMES[0];
    const tableFinish = TABLE_FINISH_OPTIONS[safe.tableFinish] ?? DEFAULT_TABLE_FINISH;
    const tableCloth = TABLE_CLOTH_OPTIONS[safe.tableCloth] ?? DEFAULT_CLOTH_OPTION;
    const stoolTheme = MURLAN_STOOL_THEMES[safe.stools] ?? MURLAN_STOOL_THEMES[0];
    const envVariant = resolveHdriVariant(safe.environmentHdri);
    const tokenStyleOption = TOKEN_STYLE_OPTIONS[safe.tokenStyle] ?? TOKEN_STYLE_OPTIONS[0];
    const tokenPieceByPlayer = Array.from({ length: activePlayerCount }, (_, playerIndex) => {
      if (playerIndex === 0) {
        return TOKEN_PIECE_OPTIONS[safe.tokenPiece] ?? TOKEN_PIECE_OPTIONS[0];
      }
      const aiTokenPieceIndex = aiLoadoutByPlayer[playerIndex]?.tokenPieceIndex ?? 0;
      return TOKEN_PIECE_OPTIONS[aiTokenPieceIndex] ?? TOKEN_PIECE_OPTIONS[0];
    });
    const previousAppearance = appearanceRef.current || DEFAULT_APPEARANCE;
    const previousColors = resolvePlayerColors(previousAppearance);
    const nextColors = resolvePlayerColors(safe);
    const paletteChanged = !areColorArraysEqual(previousColors, nextColors);
    const tokenStyleChanged = previousAppearance.tokenStyle !== safe.tokenStyle;
    const tokenPieceChanged = previousAppearance.tokenPiece !== safe.tokenPiece;
    const qualityChanged = arena.textureResolutionKey !== textureResolutionKey;
    const tableChanged = qualityChanged || arena.tableThemeId !== tableTheme.id || !arena.tableInfo;
    const tableFinishChanged = previousAppearance.tableFinish !== safe.tableFinish;
    const tableClothChanged = previousAppearance.tableCloth !== safe.tableCloth;
    const stoolChanged = qualityChanged || arena.chairThemeId !== stoolTheme.id || !arena.chairs?.length;
    const hdriChanged =
      (hdriVariantRef.current?.id || hdriVariantRef.current?.name) !== envVariant?.id ||
      arena.hdriResolutionKey !== hdriResolutionProfile.key;

    const refreshBoardTokens = async () => {
      const arenaState = arenaRef.current;
      if (!arenaState?.tableInfo?.group) return;
      const nextBoardGroup = new THREE.Group();
      nextBoardGroup.position.set(0, arenaState.tableInfo.surfaceY + BOARD_GROUP_SURFACE_OFFSET, 0);
      applyBoardGroupScale(nextBoardGroup, arenaState.tableInfo);
      nextBoardGroup.rotation.y = BOARD_ROTATION_Y;
      arenaState.tableInfo.group.add(nextBoardGroup);

      const boardData = await buildLudoBoard(
        nextBoardGroup,
        activePlayerCount,
        nextColors,
        tokenStyleOption,
        tokenPieceByPlayer
      );
      if (arenaState.boardGroup) {
        arenaState.tableInfo.group.remove(arenaState.boardGroup);
        disposeBoardGroup(arenaState.boardGroup);
      }
      arenaState.boardGroup = nextBoardGroup;
      diceRef.current = boardData.dice;
      turnIndicatorRef.current = boardData.turnIndicator;
      configureDiceAnchors({
        dice: boardData.dice,
        boardGroup: nextBoardGroup,
        chairs: arenaState.chairs,
        tableInfo: arenaState.tableInfo
      });
      moveDiceToRail(0, true);
      updateTurnIndicator(0, true);
      stateRef.current = {
        paths: boardData.paths,
        startPads: boardData.startPads,
        homeColumns: boardData.homeColumns,
        goalSlots: boardData.goalSlots,
        tokens: boardData.tokens,
        turnIndicator: boardData.turnIndicator,
        trackTiles: boardData.trackTiles,
        homeColumnTiles: boardData.homeColumnTiles,
        progress: Array.from({ length: activePlayerCount }, () => Array(4).fill(-1)),
        turn: 0,
        winner: null,
        animation: null
      };
      setUi({ turn: 0, status: 'Your turn — dice rolling soon', dice: null, winner: null, turnCycle: 0 });
      updateTokenStacks();
      applyRailLayout();
      scheduleHumanAutoRoll();
    };

    playerColorsRef.current = nextColors;
    appearanceRef.current = safe;
    hdriVariantRef.current = envVariant || hdriVariantRef.current;

    const woodOption = tableFinish?.woodOption ?? DEFAULT_WOOD_OPTION;
    const clothOption = tableCloth;
    const baseOption = DEFAULT_BASE_OPTION;

    (async () => {
      if (tableChanged) {
        await rebuildTable(tableTheme, tableFinish, tableCloth);
        arena.textureResolutionKey = textureResolutionKey;
        if (arena.tableInfo) {
          if (!arena.boardLookTarget) {
            arena.boardLookTarget = new THREE.Vector3();
          }
          arena.boardLookTarget.set(0, arena.tableInfo.surfaceY + CAMERA_TARGET_LIFT, 0);
          arena.defaultLookTarget = arena.boardLookTarget.clone();
          arena.controls?.target.copy(arena.boardLookTarget ?? new THREE.Vector3());
          arena.controls?.update();
          fitRef.current?.();
          applyBoardGroupScale(arena.boardGroup, arena.tableInfo);
          configureDiceAnchors({ tableInfo: arena.tableInfo, boardGroup: arena.boardGroup, chairs: arena.chairs });
          const currentTurn = stateRef.current?.turn ?? 0;
          moveDiceToRail(currentTurn, true);
        }
      } else if (arena.tableInfo?.materials && (tableFinishChanged || tableClothChanged)) {
        applyTableMaterials(arena.tableInfo.materials, { woodOption, clothOption, baseOption }, rendererRef.current);
      }

      if (stoolChanged) {
        await rebuildChairs(stoolTheme);
        arena.textureResolutionKey = textureResolutionKey;
        configureDiceAnchors({ tableInfo: arena.tableInfo, boardGroup: arena.boardGroup, chairs: arena.chairs });
      } else if (!shouldPreserveChairMaterials(stoolTheme) && arena.chairMaterials) {
        applyChairThemeMaterials(
          { chairMaterials: arena.chairMaterials },
          { seatColor: stoolTheme.seatColor, legColor: stoolTheme.legColor ?? DEFAULT_STOOL_THEME.legColor }
        );
      }

      if (hdriChanged) {
        await applyHdriEnvironment(envVariant);
        arena.hdriResolutionKey = hdriResolutionProfile.key;
      }

      if (paletteChanged || tokenStyleChanged || tokenPieceChanged || tableChanged || qualityChanged) {
        await refreshBoardTokens();
      }
    })();
  }, [
    appearance,
    activePlayerCount,
    aiLoadoutByPlayer,
    applyHdriEnvironment,
    applyRailLayout,
    ensureAppearanceUnlocked,
    rebuildChairs,
    rebuildTable,
    players,
    scheduleHumanAutoRoll,
    hdriResolutionProfile,
    textureResolutionKey,
    updateTurnIndicator
  ]);

  useEffect(() => {
    settingsRef.current.soundEnabled = soundEnabled;
    const baseVolume = getGameVolume();
    const level = soundEnabled ? baseVolume : 0;
      [moveSoundRef, captureSoundRef, missileLaunchSoundRef, missileImpactSoundRef, droneSoundRef, fighterJetSoundRef, helicopterSoundRef, cheerSoundRef, diceSoundRef, diceRewardSoundRef, sixRollSoundRef, hahaSoundRef, giftBombSoundRef].forEach((ref) => {
      if (ref.current) {
        ref.current.muted = !soundEnabled;
        ref.current.volume = level;
        if (!soundEnabled) {
          try {
            ref.current.pause();
            ref.current.currentTime = 0;
          } catch {}
        }
      }
    });
  }, [soundEnabled]);

  useEffect(() => {
    const host = wrapRef.current;
    if (!host) return;

    let scene = null;
    let camera = null;
    let renderer = null;
    let controls = null;
    let animationId = 0;
    const pointer = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();

    let cancelled = false;
    let onPointerDown = null;
    let onPointerUp = null;
    let onResize = null;

  const setupScene = async () => {

      const baseVolume = settingsRef.current.soundEnabled ? getGameVolume() : 0;
      [moveSoundRef, captureSoundRef, missileLaunchSoundRef, missileImpactSoundRef, droneSoundRef, fighterJetSoundRef, helicopterSoundRef, cheerSoundRef, diceSoundRef, diceRewardSoundRef, sixRollSoundRef].forEach((ref) => {
        if (ref.current) {
          ref.current.volume = baseVolume;
        }
      });

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
      renderer.localClippingEnabled = true;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      applyRendererSRGB(renderer);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.85;
      rendererRef.current = renderer;
      renderer.domElement.style.position = 'absolute';
      renderer.domElement.style.top = '0';
      renderer.domElement.style.left = '0';
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.zIndex = '0';
      renderer.domElement.style.touchAction = 'none';
      renderer.domElement.style.cursor = 'grab';
      host.appendChild(renderer.domElement);
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
      fallbackTexture.needsUpdate = true;
      textureLoaderRef.current = textureLoader;
      textureCacheRef.current = new Map();
      maxAnisotropyRef.current = maxAnisotropy;
      fallbackTextureRef.current = fallbackTexture;
      applyRendererQuality();

      scene = new THREE.Scene();
      scene.background = new THREE.Color('#030712');

      const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
      keyLight.position.set(4.2, 6.4, 3.1);
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(2048, 2048);
      keyLight.shadow.bias = -0.00035;
      keyLight.shadow.normalBias = 0.025;
      keyLight.shadow.radius = 2.2;
      keyLight.shadow.camera.left = -8;
      keyLight.shadow.camera.right = 8;
      keyLight.shadow.camera.top = 8;
      keyLight.shadow.camera.bottom = -8;
      keyLight.shadow.camera.near = 0.5;
      keyLight.shadow.camera.far = 20;
      scene.add(keyLight);
      const fillLight = new THREE.DirectionalLight(0xffffff, 0.55);
      fillLight.position.set(-4.6, 3.8, 2.2);
      scene.add(fillLight);
      const rimLight = new THREE.DirectionalLight(0xffffff, 0.75);
      rimLight.position.set(-2.4, 5.4, -4.8);
      scene.add(rimLight);

      camera = new THREE.PerspectiveCamera(CAM.fov, 1, CAM.near, CAM.far);
      cameraRef.current = camera;
      const isPortrait = host.clientHeight > host.clientWidth;
      const cameraSeatAngle = Math.PI / 2;
      const cameraBackOffset = isPortrait ? PORTRAIT_CAMERA_TUNING.backOffset : LANDSCAPE_CAMERA_TUNING.backOffset;
      const cameraForwardOffset = isPortrait ? PORTRAIT_CAMERA_TUNING.forwardOffset : LANDSCAPE_CAMERA_TUNING.forwardOffset;
      const cameraHeightOffset = isPortrait ? PORTRAIT_CAMERA_TUNING.heightOffset : LANDSCAPE_CAMERA_TUNING.heightOffset;
      const chairRadius = AI_CHAIR_RADIUS;
      const cameraRadius = chairRadius + cameraBackOffset - cameraForwardOffset + CAMERA_EXTRA_PULLBACK;
      camera.position.set(
        Math.cos(cameraSeatAngle) * cameraRadius,
        TABLE_HEIGHT + cameraHeightOffset,
        Math.sin(cameraSeatAngle) * cameraRadius
      );

      const arenaGroup = new THREE.Group();
      scene.add(arenaGroup);

    const initialAppearanceRaw = normalizeAppearance(appearanceRef.current);
    const initialAppearance = ensureAppearanceUnlocked(initialAppearanceRaw);
    const tableTheme = MURLAN_TABLE_THEMES[initialAppearance.tables] ?? MURLAN_TABLE_THEMES[0];
    const tableFinish = TABLE_FINISH_OPTIONS[initialAppearance.tableFinish] ?? DEFAULT_TABLE_FINISH;
    const tableCloth = TABLE_CLOTH_OPTIONS[initialAppearance.tableCloth] ?? DEFAULT_CLOTH_OPTION;
    const stoolTheme = MURLAN_STOOL_THEMES[initialAppearance.stools] ?? MURLAN_STOOL_THEMES[0];
    const envVariant = resolveHdriVariant(initialAppearance.environmentHdri);
    const tokenStyleOption = TOKEN_STYLE_OPTIONS[initialAppearance.tokenStyle] ?? TOKEN_STYLE_OPTIONS[0];
    const tokenPieceByPlayer = Array.from({ length: activePlayerCount }, (_, playerIndex) => {
      if (playerIndex === 0) {
        return TOKEN_PIECE_OPTIONS[initialAppearance.tokenPiece] ?? TOKEN_PIECE_OPTIONS[0];
      }
      const aiTokenPieceIndex = aiLoadoutByPlayer[playerIndex]?.tokenPieceIndex ?? 0;
      return TOKEN_PIECE_OPTIONS[aiTokenPieceIndex] ?? TOKEN_PIECE_OPTIONS[0];
    });
    const initialPlayerColors = resolvePlayerColors(initialAppearance);
    appearanceRef.current = initialAppearance;
    playerColorsRef.current = initialPlayerColors;

    let tableInfo = null;
    const textureOptions = {
      textureLoader: textureLoaderRef.current,
      maxAnisotropy: maxAnisotropyRef.current ?? 1,
      fallbackTexture: fallbackTextureRef.current,
      textureCache: textureCacheRef.current,
      preferredTextureSizes: textureResolutionStack
    };

    if (tableTheme?.source === 'polyhaven' && tableTheme?.assetId) {
      try {
        const model = await createPolyhavenInstance(
          tableTheme.assetId,
          TABLE_HEIGHT,
          tableTheme.rotationY || 0,
          renderer,
          textureOptions
        );
        stripTableBase(model);
        const tableGroup = new THREE.Group();
        tableGroup.add(model);
        const { surfaceY, radius } = fitTableModelToArena(tableGroup, tableTheme?.id);
        arenaGroup.add(tableGroup);
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
          shapeId: tableTheme.id,
          rotationY: tableTheme.rotationY ?? 0,
          themeId: tableTheme.id,
          getOuterRadius: () => radius,
          getInnerRadius: () => radius * 0.72
        };
      } catch (error) {
        console.warn('Failed to load Poly Haven table', error);
      }
    }

    if (!tableInfo) {
      const woodOption = tableFinish?.woodOption ?? DEFAULT_WOOD_OPTION;
      const clothOption = tableCloth;
      const baseOption = DEFAULT_BASE_OPTION;
      const procedural = createMurlanStyleTable({
        arena: arenaGroup,
        renderer,
        tableRadius: TABLE_RADIUS * TABLE_VISUAL_SCALE,
        tableHeight: TABLE_HEIGHT,
        woodOption,
        clothOption,
        baseOption,
        includeBase: true
      });
      applyTableMaterials(procedural.materials, { woodOption, clothOption, baseOption }, renderer);
      tableInfo = { ...procedural, themeId: tableTheme?.id || procedural.shapeId };
    }
    updateTokenSurfaceOffset(tableInfo.themeId || tableTheme?.id || 'murlan-default');

    const boardGroup = new THREE.Group();
    boardGroup.position.set(0, tableInfo.surfaceY + BOARD_GROUP_SURFACE_OFFSET, 0);
    applyBoardGroupScale(boardGroup, tableInfo);
    boardGroup.rotation.y = BOARD_ROTATION_Y;
    tableInfo.group.add(boardGroup);

    const targetLift = isPortrait ? PORTRAIT_CAMERA_TUNING.targetLift : CAMERA_TARGET_LIFT;
    const boardLookTarget = new THREE.Vector3(
      0,
      tableInfo.surfaceY + targetLift + 0.12 * MODEL_SCALE - CAMERA_LOOKDOWN_TARGET_OFFSET,
      0
    );
    boardLookTargetRef.current = boardLookTarget;
    const initialCameraDirection = camera.position.clone().sub(boardLookTarget).normalize();
    if (Math.abs(initialCameraDirection.x) > 1e-4) {
      const zSign = Math.sign(initialCameraDirection.z) || 1;
      initialCameraDirection.set(
        0,
        initialCameraDirection.y,
        zSign * Math.max(Math.abs(initialCameraDirection.z), 1e-3)
      ).normalize();
    }
    const initialDistanceFactor = isPortrait ? PORTRAIT_INITIAL_CAMERA_DISTANCE_FACTOR : INITIAL_CAMERA_DISTANCE_FACTOR;
    const desiredInitialCameraRadius = clamp(CAM.maxR * initialDistanceFactor, CAM.minR, CAM.maxR);
    camera.position.copy(boardLookTarget).add(initialCameraDirection.multiplyScalar(desiredInitialCameraRadius));
    camera.position.y += CAMERA_3D_HEIGHT_BOOST + (isPortrait ? PORTRAIT_CAMERA_EXTRA_LIFT : CAMERA_EXTRA_LIFT);
    camera.lookAt(boardLookTarget);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.enableRotate = false;
    controls.zoomSpeed = CAMERA_DOLLY_FACTOR;
    const initialCameraRadius = camera.position.distanceTo(boardLookTarget);
    controls.minDistance = initialCameraRadius * CAMERA_ZOOM_MIN_FACTOR;
    controls.maxDistance = initialCameraRadius * CAMERA_ZOOM_MAX_FACTOR;
    controls.minPolarAngle = CAM.phiMin;
    controls.maxPolarAngle = CAM.phiMax;
    controls.target.copy(boardLookTarget);
    const initialAzimuth = controls.getAzimuthalAngle();
    controls.minAzimuthAngle = Number.isFinite(CAMERA_FREE_LOOK_AZIMUTH_RANGE)
      ? initialAzimuth - CAMERA_FREE_LOOK_AZIMUTH_RANGE
      : -Infinity;
    controls.maxAzimuthAngle = Number.isFinite(CAMERA_FREE_LOOK_AZIMUTH_RANGE)
      ? initialAzimuth + CAMERA_FREE_LOOK_AZIMUTH_RANGE
      : Infinity;
    controls.minDistance = initialCameraRadius * CAMERA_ZOOM_MIN_FACTOR;
    controls.maxDistance = initialCameraRadius * CAMERA_ZOOM_MAX_FACTOR;
    controlsRef.current = controls;
    baseCameraRadiusRef.current = initialCameraRadius;
    syncSkyboxToCameraRef.current = () => {
      if (!camera || !boardLookTarget) return;
      const skybox = envSkyboxRef.current;
      if (!skybox) return;
      const radius = camera.position.distanceTo(boardLookTarget);
      const baseRadius = baseCameraRadiusRef.current || radius || 1;
      const baseScale = baseSkyboxScaleRef.current || 1;
      const scale = clamp(radius / baseRadius, 0.35, 3.5);
      skybox.scale.setScalar(baseScale * scale);
      lastCameraRadiusRef.current = radius;
      const floorY = environmentFloorRef.current ?? 0;
      if (Number.isFinite(skybox.userData?.cameraHeight)) {
        skybox.position.y = floorY + skybox.userData.cameraHeight;
      }
      skybox.position.x = boardLookTarget.x;
      skybox.position.z = boardLookTarget.z;
      if (Number.isFinite(skybox.userData?.rotationY)) {
        skybox.rotation.y = skybox.userData.rotationY;
      }
    };
    controls.addEventListener('change', syncSkyboxToCameraRef.current);

    const fit = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (baseCameraRadiusRef.current == null) {
        baseCameraRadiusRef.current = camera.position.distanceTo(boardLookTarget);
      }
      controls.update();
      applyRendererQuality();
      syncSkyboxToCameraRef.current?.();
    };
    fitRef.current = fit;
    fit();
    applyCameraViewMode(false);

    const chairBuild = await buildChairTemplate(stoolTheme, renderer, textureOptions);
    if (cancelled || !chairBuild) return;
    const chairTemplate = chairBuild.chairTemplate;
    const chairMaterials = chairBuild.materials;
    const preserveChairMats = chairBuild.preserveOriginal ?? shouldPreserveChairMaterials(stoolTheme);
    if (!preserveChairMats && chairMaterials) {
      applyChairThemeMaterials({ chairMaterials }, stoolTheme);
    }

    const chairs = [];
    for (let i = 0; i < activePlayerCount; i += 1) {
      const fallbackAngle = Math.PI / 2 - HUMAN_SEAT_ROTATION_OFFSET - (i / activePlayerCount) * Math.PI * 2;
      const angle = CUSTOM_CHAIR_ANGLES[i] ?? fallbackAngle;
      const forward = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
      const seatRadius =
        AI_CHAIR_RADIUS +
        CHAIR_GLOBAL_PUSHBACK +
        (i === 0 ? SELF_BOTTOM_CHAIR_EXTRA_PUSHBACK : 0);
      const seatPos = forward.clone().multiplyScalar(seatRadius);
      seatPos.y = CHAIR_BASE_HEIGHT;
      const group = new THREE.Group();
      group.position.copy(seatPos);
      group.lookAt(new THREE.Vector3(0, seatPos.y, 0));

      const chairModel = chairTemplate.clone(true);
      chairModel.traverse((obj) => {
        if (obj.isMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
        }
      });
      group.add(chairModel);
      group.userData.chairModel = chairModel;

      const avatarAnchor = new THREE.Object3D();
      avatarAnchor.position.set(0, AVATAR_ANCHOR_HEIGHT, 0);
      group.add(avatarAnchor);

      arenaGroup.add(group);
      chairs.push({ group, anchor: avatarAnchor });
    }
    controls.minDistance = CAM.minR;
    controls.maxDistance = CAM.maxR * CAMERA_ZOOM_MAX_FACTOR;
    baseCameraRadiusRef.current = desiredInitialCameraRadius;
    controls.update();
    groundArenaToHdriFloor({ preserveView: true });
    updateEnvironmentFloor();

    const boardData = await buildLudoBoard(
      boardGroup,
      activePlayerCount,
      initialPlayerColors,
      tokenStyleOption,
      tokenPieceByPlayer
    );
    diceRef.current = boardData.dice;
    turnIndicatorRef.current = boardData.turnIndicator;
    configureDiceAnchors({ dice: boardData.dice, boardGroup, chairs, tableInfo });
    moveDiceToRail(0, true);
    updateTurnIndicator(0, true);
    if (camera && controls) {
      initialBottomCameraViewRef.current = {
        position: camera.position.clone(),
        target: controls.target.clone()
      };
      cameraTurnStateRef.current.baseTurnView = {
        position: initialBottomCameraViewRef.current.position.clone(),
        target: initialBottomCameraViewRef.current.target.clone()
      };
    }
    setCameraFocus({ target: resolveTurnLookTarget(0), priority: 1, force: true });
    setCameraViewForTurn(0, 0, { force: true });

    stateRef.current = {
      paths: boardData.paths,
      startPads: boardData.startPads,
      homeColumns: boardData.homeColumns,
      goalSlots: boardData.goalSlots,
      tokens: boardData.tokens,
      turnIndicator: boardData.turnIndicator,
      trackTiles: boardData.trackTiles,
      homeColumnTiles: boardData.homeColumnTiles,
      progress: Array.from({ length: activePlayerCount }, () => Array(4).fill(-1)),
      turn: 0,
      winner: null,
      animation: null
    };

    updateTokenStacks();

    applyRailLayout();

    scheduleHumanAutoRoll();

    arenaRef.current = {
      renderer,
      scene,
      camera,
      controls,
      arenaGroup,
      tableInfo,
      tableThemeId: tableInfo.themeId,
      boardGroup,
      boardLookTarget,
      defaultLookTarget: boardLookTarget.clone(),
      chairTemplate,
      chairMaterials,
      chairThemeId: stoolTheme?.id,
      chairThemePreserve: preserveChairMats,
      chairs,
      seatAnchors: chairs.map((chair) => chair.anchor),
      textureResolutionKey,
      hdriResolutionKey: hdriResolutionProfile.key
    };

    updateEnvironmentFloor();
    hdriVariantRef.current = envVariant || DEFAULT_HDRI_VARIANT;
    void applyHdriEnvironment(envVariant);

    const attemptDiceRoll = (clientX, clientY) => {
      const dice = diceRef.current;
      const rollFn = rollDiceRef.current;
      const state = stateRef.current;
      if (
        !dice ||
        !rollFn ||
        !state ||
        state.turn !== 0 ||
        state.winner ||
        state.animation ||
        dice.userData?.isRolling ||
        humanSelectionRef.current
      ) {
        return false;
      }
      const rect = renderer.domElement.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((clientY - rect.top) / rect.height) * 2 + 1;
      pointer.set(x, y);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObject(dice, true);
      if (hit.length) {
        rollFn();
        return true;
      }
      return false;
    };

    const attemptHumanSelection = (clientX, clientY) => {
      const state = stateRef.current;
      const selection = humanSelectionRef.current;
      if (
        !state ||
        state.turn !== 0 ||
        !selection ||
        !Array.isArray(selection.options) ||
        !selection.options.length
      ) {
        return false;
      }
      const rect = renderer.domElement.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((clientY - rect.top) / rect.height) * 2 + 1;
      pointer.set(x, y);
      raycaster.setFromCamera(pointer, camera);
      const tokens = selection.options
        .map((option) => state.tokens?.[0]?.[option.token])
        .filter(Boolean);
      if (!tokens.length) return false;
      const hits = raycaster.intersectObjects(tokens, true);
      if (!hits.length) return false;
      let targetToken = null;
      for (const hit of hits) {
        const group = hit.object?.userData?.tokenGroup;
        if (group && tokens.includes(group)) {
          targetToken = group;
          break;
        }
      }
      if (!targetToken) return false;
      const option = selection.options.find(
        (opt) => state.tokens?.[0]?.[opt.token] === targetToken
      );
      if (!option) return false;
      clearHumanSelection();
      moveToken(0, option.token, selection.roll, {
        skipCameraFollow: selection.skipCameraFollow || option.entering
      });
      return true;
    };
    const getCameraLookTarget = () => {
      if (!controls || !camera) return null;
      const baseTarget = cameraTurnStateRef.current.currentTarget?.isVector3
        ? cameraTurnStateRef.current.currentTarget
        : controls.target;
      const target = baseTarget.clone();
      const toTarget = baseTarget.clone().sub(camera.position);
      if (toTarget.lengthSq() > 1e-6 && Math.abs(cameraLookStateRef.current.yaw) > 0.0001) {
        const horizontalLength = Math.max(
          Math.sqrt(toTarget.x * toTarget.x + toTarget.z * toTarget.z),
          0.001
        );
        const lateral = new THREE.Vector3(-toTarget.z, 0, toTarget.x).normalize();
        target.addScaledVector(lateral, Math.tan(cameraLookStateRef.current.yaw) * horizontalLength);
      }
      if (toTarget.lengthSq() > 1e-6 && Math.abs(cameraLookStateRef.current.pitch) > 0.0001) {
        target.y += Math.tan(cameraLookStateRef.current.pitch) * toTarget.length();
      }
      return target;
    };
    const applyCameraLookOffset = ({ recenter = false } = {}) => {
      if (!controls || !camera || isCamera2d) return;
      if (recenter) {
        cameraLookStateRef.current.yaw *= 1 - CAMERA_LOOK_YAW_RECENTER_SPEED;
        if (Math.abs(cameraLookStateRef.current.yaw) < 1e-4) {
          cameraLookStateRef.current.yaw = 0;
        }
      }
      const target = getCameraLookTarget();
      if (!target) return;
      controls.target.copy(target);
    };

    let pointerLocked = false;
    let onPointerMove = null;
    onPointerDown = (event) => {
      const { clientX, clientY } = event;
      if (clientX == null || clientY == null) return;
      let handled = attemptHumanSelection(clientX, clientY);
      if (!handled) {
        handled = attemptDiceRoll(clientX, clientY);
      }
      if (handled) {
        pointerLocked = true;
        if (controls) controls.enabled = false;
        event.preventDefault();
        return;
      }
      if (
        LUDO_CAMERA_CUSTOM_LOOK_ENABLED &&
        !isCamera2d &&
        controls &&
        event.isPrimary !== false
      ) {
        cameraLookStateRef.current.pointerId = event.pointerId;
        cameraLookStateRef.current.active = true;
        cameraLookStateRef.current.lastX = clientX;
        cameraLookStateRef.current.lastY = clientY;
      }
    };
    onPointerMove = (event) => {
      const lookState = cameraLookStateRef.current;
      if (
        !LUDO_CAMERA_CUSTOM_LOOK_ENABLED ||
        isCamera2d ||
        !lookState.active ||
        lookState.pointerId !== event.pointerId
      ) {
        return;
      }
      const { clientX, clientY } = event;
      if (clientX == null || clientY == null) return;
      const deltaX = clientX - lookState.lastX;
      const deltaY = clientY - lookState.lastY;
      lookState.lastX = clientX;
      lookState.lastY = clientY;
      const isTouchDrag = event.pointerType === 'touch';
      lookState.yaw = clamp(
        lookState.yaw + deltaX * CAMERA_LOOK_YAW_DRAG_FACTOR,
        -CAMERA_LOOK_YAW_LIMIT,
        CAMERA_LOOK_YAW_LIMIT
      );
      if (isTouchDrag && camera && controls && Math.abs(deltaY) > 0.001) {
        const elementHeight = Math.max(renderer?.domElement?.clientHeight ?? 0, 1);
        const rotateSpeed = Number.isFinite(controls.rotateSpeed) ? controls.rotateSpeed : 1;
        const verticalAngle = (2 * Math.PI * deltaY * rotateSpeed) / elementHeight;
        const offset = camera.position.clone().sub(controls.target);
        const spherical = new THREE.Spherical().setFromVector3(offset);
        spherical.phi = clamp(
          spherical.phi + verticalAngle,
          controls.minPolarAngle,
          controls.maxPolarAngle
        );
        offset.setFromSpherical(spherical);
        camera.position.copy(controls.target).add(offset);
      } else if (!isTouchDrag) {
        lookState.pitch = clamp(
          lookState.pitch + deltaY * CAMERA_LOOK_PITCH_DRAG_FACTOR,
          CAMERA_LOOK_MIN_PITCH,
          CAMERA_LOOK_PITCH_LIMIT
        );
      }
      applyCameraLookOffset();
      if (stateRef.current?.turn === 0) {
        preserveUserTurnCameraRef.current = true;
      }
      controls?.update();
    };
    onPointerUp = (event) => {
      const lookState = cameraLookStateRef.current;
      if (lookState.pointerId === event?.pointerId) {
        lookState.pointerId = null;
        lookState.active = false;
      }
      if (pointerLocked) {
        pointerLocked = false;
        if (controls) controls.enabled = true;
      }
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown, { passive: false });
    renderer.domElement.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointercancel', onPointerUp, { passive: true });

    let lastRenderTime = performance.now();
    const animTemp = new THREE.Vector3();
    const animDir = new THREE.Vector3();
    const animLook = new THREE.Vector3();
    const seatWorld = new THREE.Vector3();
    const seatNdc = new THREE.Vector3();

    const step = () => {
      const now = performance.now();
      const frameTiming = frameTimingRef.current;
      const targetFrameTime =
        frameTiming && Number.isFinite(frameTiming.targetMs)
          ? frameTiming.targetMs
          : 1000 / 60;
      const maxFrameTime =
        frameTiming && Number.isFinite(frameTiming.maxMs)
          ? frameTiming.maxMs
          : targetFrameTime * FRAME_TIME_CATCH_UP_MULTIPLIER;
      const deltaMs = now - lastRenderTime;
      if (deltaMs < targetFrameTime - 0.5) {
        animationId = requestAnimationFrame(step);
        return;
      }
      const appliedDeltaMs = Math.min(deltaMs, maxFrameTime);
      lastRenderTime = now - Math.max(0, deltaMs - appliedDeltaMs);
      const delta = appliedDeltaMs / 1000;

      const state = stateRef.current;
      if (state?.animation?.active) {
        const anim = state.animation;
        const seg = anim.segments?.[anim.segment];
        if (anim.highlightIndex !== anim.segment) {
          updateAnimationHighlight(anim, anim.segment);
          if (anim.segment > 0) {
            playTokenStepSound();
          }
        }
        if (!seg) {
          const done = anim.onComplete;
          clearAnimationHighlights(anim);
          state.animation = null;
          if (typeof done === 'function') done();
          updateTokenStacks();
        } else {
          anim.elapsed += delta;
          const duration = Math.max(seg.duration, 1e-4);
          const t = Math.min(1, anim.elapsed / duration);
          const jumpT =
            t <= TOKEN_STEP_JUMP_PHASE
              ? 0
              : (t - TOKEN_STEP_JUMP_PHASE) / Math.max(1e-4, 1 - TOKEN_STEP_JUMP_PHASE);
          animTemp.copy(seg.from).lerp(seg.to, jumpT);
          const jumpLift = Math.sin(jumpT * Math.PI) * TOKEN_STEP_JUMP_HEIGHT;
          animTemp.y = THREE.MathUtils.lerp(seg.from.y, seg.to.y, jumpT) + jumpLift;
          anim.token.position.copy(animTemp);
          animDir.copy(seg.to).sub(seg.from);
          animDir.y = 0;
          if (animDir.lengthSq() > 1e-6) {
            animDir.normalize();
            animLook.copy(anim.token.position).add(animDir);
            anim.token.lookAt(animLook);
          }
          if (t >= 0.999) {
            anim.segment += 1;
            anim.elapsed = 0;
            if (anim.segment >= anim.segments.length) {
              const done = anim.onComplete;
              clearAnimationHighlights(anim);
              state.animation = null;
              if (typeof done === 'function') {
                const result = done();
                if (result && typeof result.then === 'function') {
                  result.finally(() => updateTokenStacks());
                } else {
                  updateTokenStacks();
                }
              } else {
                updateTokenStacks();
              }
            }
          }
        }
      }

      if (diceRef.current) {
        const lights = diceRef.current.userData?.lights;
        if (lights?.accent) {
          const pos = diceRef.current.getWorldPosition(new THREE.Vector3());
          lights.accent.position.copy(pos).add(lights.accent.userData.offset);
          lights.fill.position.copy(pos).add(lights.fill.userData.offset);
          lights.target.position.copy(pos);
        }
      }

      const arenaState = arenaRef.current;
      if (arenaState?.seatAnchors?.length && camera) {
        const positions = arenaState.seatAnchors.map((anchor, index) => {
          anchor.getWorldPosition(seatWorld);
          seatNdc.copy(seatWorld).project(camera);
          const x = clamp((seatNdc.x * 0.5 + 0.5) * 100, -25, 125);
          const y = clamp((0.5 - seatNdc.y * 0.5) * 100, -25, 125);
          const depth = camera.position.distanceTo(seatWorld);
          return { index, x, y, depth };
        });
        let changed = positions.length !== seatPositionsRef.current.length;
        if (!changed) {
          for (let i = 0; i < positions.length; i += 1) {
            const prev = seatPositionsRef.current[i];
            const curr = positions[i];
            if (
              !prev ||
              Math.abs(prev.x - curr.x) > 0.2 ||
              Math.abs(prev.y - curr.y) > 0.2 ||
              Math.abs((prev.depth ?? 0) - curr.depth) > 0.02
            ) {
              changed = true;
              break;
            }
          }
        }
        if (changed) {
          seatPositionsRef.current = positions;
          setSeatAnchors(positions);
        }
      } else if (seatPositionsRef.current.length) {
        seatPositionsRef.current = [];
        setSeatAnchors([]);
      }

      if (!isCamera2d && cameraTurnStateRef.current.followObject?.isObject3D && controls) {
        const followedTarget = cameraTurnStateRef.current.followObject.getWorldPosition(new THREE.Vector3());
        const liftedTarget = resolveFocusCameraState(followedTarget, CAMERA_TARGET_LIFT + 0.02);
        if (liftedTarget) {
          controls.target.lerp(liftedTarget.target, 0.18);
          if (cameraTurnStateRef.current.followOffset?.isVector3) {
            const followCameraTarget = liftedTarget.target.clone().add(cameraTurnStateRef.current.followOffset);
            camera.position.lerp(followCameraTarget, 0.12);
          }
          cameraTurnStateRef.current.currentTarget = controls.target.clone();
        }
      }

      if (!isCamera2d && controls) {
        if (LUDO_CAMERA_CUSTOM_LOOK_ENABLED) {
          applyCameraLookOffset({ recenter: !cameraLookStateRef.current.active });
        }
      }
      controls?.update();
      renderer.render(scene, camera);
      animationId = requestAnimationFrame(step);
    };
    animationId = requestAnimationFrame(step);

    onResize = () => fit();
    window.addEventListener('resize', onResize);

    };

    setupScene();

    return () => {
      cancelled = true;
      clearHumanSelection();
      cancelAnimationFrame(animationId);
      if (aiTimeoutRef.current) {
        clearTimeout(aiTimeoutRef.current);
        aiTimeoutRef.current = null;
      }
      seatPositionsRef.current = [];
      setSeatAnchors([]);
      stateRef.current = null;
      turnIndicatorRef.current = null;
      if (onResize) {
        window.removeEventListener('resize', onResize);
      }
      if (renderer?.domElement && onPointerDown) {
        renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      }
      if (renderer?.domElement && onPointerMove) {
        renderer.domElement.removeEventListener('pointermove', onPointerMove);
      }
      if (onPointerUp) {
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
      }
      cameraLookStateRef.current.pointerId = null;
      cameraLookStateRef.current.active = false;
      cameraLookStateRef.current.yaw = 0;
      cameraLookStateRef.current.pitch = 0;
      if (controls && syncSkyboxToCameraRef.current) {
        controls.removeEventListener('change', syncSkyboxToCameraRef.current);
      }
      controlsRef.current = null;
      controls?.dispose();
      controls = null;
      cameraRef.current = null;
      boardLookTargetRef.current = null;
      saved3dCameraStateRef.current = null;
      stopDiceTransition();
      cancelCameraFocusAnimation();
      cancelCameraViewAnimation();
      diceRef.current = null;
      const arena = arenaRef.current;
      if (arena) {
        arena.chairs?.forEach((chair) => {
          if (chair.group.parent) {
            chair.group.parent.remove(chair.group);
          }
        });
        disposeChairAssets(arena.chairTemplate, arena.chairMaterials);
        arena.tableInfo?.dispose?.();
      }
      disposeEnvironmentRef.current?.();
      envTextureRef.current = null;
      envSkyboxRef.current = null;
      envSkyboxTextureRef.current = null;
      if (textureCacheRef.current) {
        textureCacheRef.current.clear();
      }
      fallbackTextureRef.current?.dispose?.();
      textureLoaderRef.current = null;
      maxAnisotropyRef.current = 1;
      fallbackTextureRef.current = null;
      if (captureFxRef.current) {
        if (Array.isArray(captureFxRef.current.missiles)) {
          captureFxRef.current.missiles.forEach((entry) => {
            entry?.parent?.remove?.(entry);
          });
        }
        captureFxRef.current.missile?.parent?.remove?.(captureFxRef.current.missile);
        captureFxRef.current.explosion?.parent?.remove?.(captureFxRef.current.explosion);
        captureFxRef.current = null;
      }
      arenaRef.current = null;
      rendererRef.current = null;
      renderer?.dispose?.();
      if (renderer?.domElement?.parentElement === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, []);

  const playHahaSound = () => {
    if (!settingsRef.current.soundEnabled || !hahaSoundRef.current) return;
    if (hahaStopTimeoutRef.current) {
      clearTimeout(hahaStopTimeoutRef.current);
      hahaStopTimeoutRef.current = null;
    }
    hahaSoundRef.current.currentTime = 0;
    hahaSoundRef.current.play().catch(() => {});
    hahaStopTimeoutRef.current = window.setTimeout(() => {
      if (!hahaSoundRef.current) return;
      hahaSoundRef.current.pause();
      hahaSoundRef.current.currentTime = 0;
      hahaStopTimeoutRef.current = null;
    }, HAHA_SOUND_MAX_DURATION_MS);
  };

  const playCapture = () => {
    if (!settingsRef.current.soundEnabled) return;
    playHahaSound();
  };

  const playExplosionBombSound = () => {
    if (!settingsRef.current.soundEnabled || !captureSoundRef.current) return;
    captureSoundRef.current.currentTime = 0;
    captureSoundRef.current.play().catch(() => {});
  };

  const playMissileLaunchSound = () => {
    if (!settingsRef.current.soundEnabled || !missileLaunchSoundRef.current) return;
    missileLaunchSoundRef.current.currentTime = 0;
    missileLaunchSoundRef.current.play().catch(() => {});
  };

  const playMissileImpactSound = () => {
    if (!settingsRef.current.soundEnabled || !missileImpactSoundRef.current) return;
    missileImpactSoundRef.current.currentTime = 0;
    missileImpactSoundRef.current.play().catch(() => {});
  };

  const playHelicopterSound = () => {
    if (!settingsRef.current.soundEnabled || !helicopterSoundRef.current) return;
    helicopterSoundRef.current.currentTime = 0;
    helicopterSoundRef.current.play().catch(() => {});
  };

  const playDroneSound = () => {
    if (!settingsRef.current.soundEnabled || !droneSoundRef.current) return;
    droneSoundRef.current.currentTime = 0;
    droneSoundRef.current.play().catch(() => {});
  };

  const playFighterJetSound = () => {
    if (!settingsRef.current.soundEnabled || !fighterJetSoundRef.current) return;
    fighterJetSoundRef.current.currentTime = 0;
    fighterJetSoundRef.current.play().catch(() => {});
  };

  const stopHelicopterSound = () => {
    if (!helicopterSoundRef.current) return;
    helicopterSoundRef.current.pause();
    helicopterSoundRef.current.currentTime = 0;
  };

  const stopDroneSound = () => {
    if (!droneSoundRef.current) return;
    droneSoundRef.current.pause();
    droneSoundRef.current.currentTime = 0;
  };

  const stopFighterJetSound = () => {
    if (!fighterJetSoundRef.current) return;
    fighterJetSoundRef.current.pause();
    fighterJetSoundRef.current.currentTime = 0;
  };

  const stopCaptureVehicleSounds = () => {
    stopDroneSound();
    stopFighterJetSound();
    stopHelicopterSound();
  };

  const getReferenceBishopSize = (player, fallbackToken) => {
    const state = stateRef.current;
    const sourceTokens = state?.tokens?.[player] ?? [];
    const bishopToken =
      sourceTokens.find((token) => /bishop/i.test(String(token?.userData?.tokenType ?? ''))) || fallbackToken;
    const box = new THREE.Box3().setFromObject(bishopToken || fallbackToken);
    const size = new THREE.Vector3();
    box.getSize(size);
    const bishopHeight = Math.max(0.28, size.y || 0.28);
    const bishopWidth = Math.max(0.14, Math.max(size.x, size.z) || 0.14);
    return { bishopHeight, bishopWidth };
  };

  const resolveTokenAnchorPoint = useCallback((token, fallbackPosition = null, yOffset = 0) => {
    const base =
      token?.isObject3D
        ? token.getWorldPosition(new THREE.Vector3())
        : fallbackPosition?.isVector3
        ? fallbackPosition.clone()
        : null;
    if (!base) return null;
    base.y += yOffset;
    return base;
  }, []);

  const resolveLiveTokenPosition = useCallback(
    ({ token, player, tokenIndex, fallbackPosition = null }) => {
      const direct = resolveTokenAnchorPoint(token, fallbackPosition, 0);
      if (direct?.isVector3) return direct;
      const state = stateRef.current;
      const progress = state?.progress?.[player]?.[tokenIndex];
      if (!Number.isFinite(progress)) {
        return fallbackPosition?.isVector3 ? fallbackPosition.clone() : null;
      }
      return getWorldForProgress(player, progress, tokenIndex);
    },
    [resolveTokenAnchorPoint]
  );

  const playCaptureMissileSequence = ({
    attackerToken,
    attackerPlayer,
    attackerTokenIndex,
    startPosition,
    targetToken,
    targetPlayer,
    targetTokenIndex,
    targetPosition,
    impactPosition
  }) =>
    new Promise((resolve) => {
      void (async () => {
        try {
          const arena = arenaRef.current;
          const scene = arena?.scene;
          if (!scene || !attackerToken || !startPosition?.isVector3 || !targetPosition?.isVector3) {
            resolve();
            return;
          }

        const selectedCaptureAnimationId =
          attackerPlayer > 0
            ? CAPTURE_ANIMATION_OPTIONS[aiLoadoutByPlayer[attackerPlayer]?.captureAnimationIndex ?? 0]?.id
            : CAPTURE_ANIMATION_OPTIONS[appearanceRef.current?.captureAnimation]?.id;
        const resolvedCaptureAnimationId =
          selectedCaptureAnimationId ?? CAPTURE_ANIMATION_OPTIONS[0]?.id ?? 'missileJavelin';
        const isHelicopterAttack = resolvedCaptureAnimationId === 'helicopterAttack';
        const isDroneAttack = resolvedCaptureAnimationId === 'droneAttack';
        const isFighterJetAttack = resolvedCaptureAnimationId === 'fighterJetAttack';
        stopCaptureVehicleSounds();
        if (isHelicopterAttack) playHelicopterSound();
        if (isDroneAttack) playDroneSound();
        if (isFighterJetAttack) playFighterJetSound();
        const primaryFx =
          resolvedCaptureAnimationId === 'droneAttack'
            ? await createCaptureDroneFx()
            : resolvedCaptureAnimationId === 'helicopterAttack'
            ? await createCaptureHelicopterFx()
            : resolvedCaptureAnimationId === 'fighterJetAttack'
            ? await createCaptureJetFx()
            : createCaptureMissileFx();
        const jetMissiles =
          resolvedCaptureAnimationId === 'fighterJetAttack' || resolvedCaptureAnimationId === 'helicopterAttack'
            ? [createCaptureMissileFx(), createCaptureMissileFx()]
            : [];
        const explosion = createCaptureExplosionFx();
        scene.add(primaryFx.root);
        jetMissiles.forEach((jetMissile) => {
          jetMissile.root.visible = false;
          scene.add(jetMissile.root);
        });
        scene.add(explosion.root);
        captureFxRef.current = {
          missile: primaryFx.root,
          missiles: [primaryFx.root, ...jetMissiles.map((entry) => entry.root)],
          explosion: explosion.root
        };
        playMissileLaunchSound();

        const { bishopHeight, bishopWidth } = getReferenceBishopSize(attackerPlayer, attackerToken);
        const missileLengthScale = (bishopHeight / 1.02) * 0.92;
        const missileThicknessScale = ((bishopWidth * 0.46) / 0.16) * 0.3;
        const animationScaleFactor =
          selectedCaptureAnimationId === 'fighterJetAttack'
            ? 0.4
            : selectedCaptureAnimationId === 'helicopterAttack'
            ? 0.28
            : selectedCaptureAnimationId === 'droneAttack'
            ? 0.26
            : 1;
        primaryFx.root.scale.set(
          missileLengthScale * animationScaleFactor,
          missileThicknessScale * animationScaleFactor,
          missileThicknessScale * animationScaleFactor
        );
        if (jetMissiles.length) {
          const jetMissileScale = missileThicknessScale * 0.85;
          jetMissiles.forEach((entry) => {
            entry.root.scale.set(jetMissileScale, jetMissileScale, jetMissileScale);
          });
        }

        const tokenWorldPos =
          resolveTokenAnchorPoint(attackerToken, startPosition, 0) ?? startPosition.clone();
        const launchAnchor = tokenWorldPos.clone().add(new THREE.Vector3(0, bishopHeight * 0.52, 0));
        moveCameraToHighestAllowedAngle(launchAnchor, Math.max(0.004, CAMERA_TARGET_LIFT - 0.018));
        setCameraFocus({
          target: launchAnchor,
          follow: false,
          priority: 7,
          ttl: 1.1,
          offset: Math.max(0.004, CAMERA_TARGET_LIFT - 0.018),
          force: true
        });
        const resolvedImpactPoint = resolveLiveTokenPosition({
          token: targetToken,
          player: targetPlayer,
          tokenIndex: targetTokenIndex,
          fallbackPosition: impactPosition?.isVector3 === true ? impactPosition : targetPosition
        });
        const safeImpactPoint =
          resolvedImpactPoint?.isVector3 === true
            ? resolvedImpactPoint
            : targetPosition?.clone?.() ?? launchAnchor.clone();
        const impactAnchor = safeImpactPoint
          .clone()
          .add(new THREE.Vector3(0, Math.max(0.02, 0.04 - CAPTURE_ANIMATION_HEIGHT_COMPENSATION), 0));
        const from = launchAnchor.clone();
        const baseTravelTime =
          selectedCaptureAnimationId === 'fighterJetAttack'
            ? 2860
            : selectedCaptureAnimationId === 'helicopterAttack'
            ? 3320
            : selectedCaptureAnimationId === 'droneAttack'
            ? 1780
            : 1780;
        const airAttackSlowFactor =
          selectedCaptureAnimationId === 'fighterJetAttack' ||
          selectedCaptureAnimationId === 'helicopterAttack' ||
          selectedCaptureAnimationId === 'droneAttack'
            ? CAPTURE_AIRCRAFT_SLOW_FACTOR
            : 1;
        const travelTime =
          selectedCaptureAnimationId === 'fighterJetAttack' ||
          selectedCaptureAnimationId === 'helicopterAttack'
            ? baseTravelTime * 1.3 * airAttackSlowFactor
            : baseTravelTime * airAttackSlowFactor;
        const explosionTime = 920;
        const flyAwayDuration =
          selectedCaptureAnimationId === 'fighterJetAttack'
            ? 900
            : selectedCaptureAnimationId === 'helicopterAttack'
            ? 1400
            : 0;
        const topStrikeHeight = Math.max(bishopHeight * 1.55, TILE_HALF_HEIGHT * 2.2);
        const topStrikeLift = new THREE.Vector3(0, topStrikeHeight, 0);
        const started = performance.now();
        let explosionTriggered = false;
        let helicopterMissileImpactAt = null;

        const updateExplosionRig = (elapsedSinceImpact) => {
          if (elapsedSinceImpact < 0 || elapsedSinceImpact > explosionTime / 1000) {
            explosion.root.visible = false;
            return;
          }
          explosion.root.visible = true;
          const fireLife = clamp(1 - elapsedSinceImpact / 0.88, 0, 1);
          const smokeLife = clamp(1 - elapsedSinceImpact / (explosionTime / 1000), 0, 1);
          const fireGrow = 0.9 + elapsedSinceImpact * 1.75;
          const smokeGrow = 0.82 + elapsedSinceImpact * 0.95;

          explosion.flash.scale.setScalar(0.54 + elapsedSinceImpact * 1.25);
          explosion.flash.material.opacity = clamp(fireLife * 1.08, 0, 1);
          explosion.fire.forEach((mesh, i) => {
            const angle = elapsedSinceImpact * 5 + i * 1.35;
            mesh.position.set(
              Math.cos(angle) * (0.05 + elapsedSinceImpact * 0.11),
              0.09 + elapsedSinceImpact * 0.21 + i * 0.026,
              Math.sin(angle) * (0.05 + elapsedSinceImpact * 0.1)
            );
            mesh.scale.setScalar(fireGrow * (0.78 + i * 0.13));
            mesh.material.opacity = clamp(fireLife * (1.02 - i * 0.08), 0, 1);
          });
          explosion.smoke.forEach((mesh, i) => {
            const angle = i * 1.1 + elapsedSinceImpact * 1.8;
            mesh.position.set(
              Math.cos(angle) * (0.05 + i * 0.018),
              0.12 + elapsedSinceImpact * (0.16 + i * 0.036),
              Math.sin(angle) * (0.05 + i * 0.018)
            );
            mesh.scale.setScalar(smokeGrow * (0.66 + i * 0.12));
            mesh.material.opacity = smokeLife * (0.45 - i * 0.04);
          });
        };

        const tick = () => {
          const elapsed = performance.now() - started;
          const liveFrom =
            resolveLiveTokenPosition({
              token: attackerToken,
              player: attackerPlayer,
              tokenIndex: attackerTokenIndex,
              fallbackPosition: from
            }) ?? from.clone();
          const liveTarget =
            resolveLiveTokenPosition({
              token: targetToken,
              player: targetPlayer,
              tokenIndex: targetTokenIndex,
              fallbackPosition: safeImpactPoint
            }) ?? safeImpactPoint.clone();
          const dynamicFrom = liveFrom.clone().add(new THREE.Vector3(0, bishopHeight * 0.54, 0));
          const dynamicTo = liveTarget
            .clone()
            .add(new THREE.Vector3(0, Math.max(0.03, 0.06 - CAPTURE_ANIMATION_HEIGHT_COMPENSATION), 0));
          const arenaCenter =
            boardLookTargetRef.current?.clone?.() ?? new THREE.Vector3(0, dynamicFrom.y, 0);
          arenaCenter.y = dynamicFrom.y;
          const fromOffset = dynamicFrom.clone().sub(arenaCenter).setY(0);
          const toOffset = dynamicTo.clone().sub(arenaCenter).setY(0);
          const fallbackRadius = Math.max(TABLE_RADIUS, BOARD_RADIUS) * 0.96;
          const fromRadius = Math.max(fromOffset.length(), fallbackRadius);
          const toRadius = Math.max(toOffset.length(), fallbackRadius);
          const baseOrbitalRadius = Math.max(fromRadius, toRadius, BOARD_RADIUS * 1.02);
          const orbitalRadius =
            selectedCaptureAnimationId === 'fighterJetAttack' || selectedCaptureAnimationId === 'helicopterAttack'
              ? baseOrbitalRadius * 0.9
              : baseOrbitalRadius;
          const fromAngle = Math.atan2(fromOffset.z, fromOffset.x);
          const toAngle = Math.atan2(toOffset.z, toOffset.x);
          let angularDelta = toAngle - fromAngle;
          if (angularDelta <= 0) angularDelta += Math.PI * 2;
          if (selectedCaptureAnimationId === 'fighterJetAttack') {
            angularDelta = Math.max(angularDelta + Math.PI * 0.9, Math.PI * 1.8);
          } else if (angularDelta < Math.PI / 3) {
            angularDelta += Math.PI * 2;
          }
          const cruiseAngle = fromAngle + angularDelta * 0.7;
          const apexHeight =
            selectedCaptureAnimationId === 'fighterJetAttack'
              ? liveTarget.y + topStrikeLift.y * 0.54
              : selectedCaptureAnimationId === 'helicopterAttack'
              ? liveTarget.y + topStrikeLift.y * 0.72
              : liveTarget.y + topStrikeLift.y;
          const apex = new THREE.Vector3(
            arenaCenter.x + Math.cos(cruiseAngle) * orbitalRadius,
            apexHeight,
            arenaCenter.z + Math.sin(cruiseAngle) * orbitalRadius
          );
          const phaseSplit =
            selectedCaptureAnimationId === 'fighterJetAttack'
              ? 0.84
              : selectedCaptureAnimationId === 'helicopterAttack'
              ? 0.8
              : selectedCaptureAnimationId === 'droneAttack'
              ? 0.78
              : 0.84;
          if (elapsed < travelTime) {
            const u = easeSmooth(elapsed / travelTime);
            const nextU = clamp(u + 0.02, 0, 1);
            const pathAt = (v) => {
              const t = clamp(v, 0, 1);
              if (t < phaseSplit) {
                const a = easeSmooth(t / phaseSplit);
                const orbitAngle = fromAngle + angularDelta * a;
                const ring = new THREE.Vector3(
                  arenaCenter.x + Math.cos(orbitAngle) * orbitalRadius,
                  THREE.MathUtils.lerp(dynamicFrom.y, apex.y, a),
                  arenaCenter.z + Math.sin(orbitAngle) * orbitalRadius
                );
                return dynamicFrom.clone().lerp(ring, 0.78 + a * 0.22);
              }
              const d = easeSmooth((t - phaseSplit) / (1 - phaseSplit));
              if (selectedCaptureAnimationId === 'fighterJetAttack') {
                const flyByEnd = dynamicTo
                  .clone()
                  .add(dynamicTo.clone().sub(arenaCenter).setY(0).normalize().multiplyScalar(orbitalRadius * 0.85))
                  .add(new THREE.Vector3(0, topStrikeHeight * 0.2, 0));
                return quadraticBezier(apex, apex.clone().lerp(flyByEnd, 0.5), flyByEnd, d);
              }
              if (selectedCaptureAnimationId === 'helicopterAttack') {
                const retreatDir = apex.clone().sub(dynamicTo).setY(0);
                if (retreatDir.lengthSq() < 1e-6) {
                  retreatDir.set(Math.cos(fromAngle + angularDelta), 0, Math.sin(fromAngle + angularDelta));
                }
                retreatDir.normalize();
                const flyAwayEnd = apex
                  .clone()
                  .add(retreatDir.multiplyScalar(orbitalRadius * 1.35))
                  .add(new THREE.Vector3(0, topStrikeHeight * 0.08, 0));
                return quadraticBezier(apex, apex.clone().lerp(flyAwayEnd, 0.5), flyAwayEnd, d);
              }
              const isDroneStrike = selectedCaptureAnimationId === 'droneAttack';
              if (isDroneStrike) {
                return quadraticBezier(apex, apex.clone().lerp(dynamicTo, 0.46), dynamicTo, d);
              }
              const strikeTop = new THREE.Vector3(dynamicTo.x, apex.y, dynamicTo.z);
              if (selectedCaptureAnimationId === 'missileJavelin') {
                return strikeTop.clone().lerp(dynamicTo, d);
              }
              const diveStart = new THREE.Vector3(
                arenaCenter.x + Math.cos(fromAngle + angularDelta) * orbitalRadius,
                apex.y,
                arenaCenter.z + Math.sin(fromAngle + angularDelta) * orbitalRadius
              );
              return quadraticBezier(diveStart, apex.clone().lerp(dynamicTo, 0.36), dynamicTo, d);
            };
            const pos = pathAt(u);
            const next = pathAt(nextU);
            const dir = next.clone().sub(pos).normalize();
            const right = dir.clone().cross(MISSILE_WORLD_UP).normalize();
            primaryFx.root.visible = true;
            primaryFx.root.position.copy(pos);
            primaryFx.root.quaternion.setFromUnitVectors(MISSILE_FORWARD, dir);
            const isVerticalImpactVehicle = selectedCaptureAnimationId === 'missileJavelin';
            if (isVerticalImpactVehicle && u > phaseSplit) {
              primaryFx.root.quaternion.setFromUnitVectors(MISSILE_FORWARD, new THREE.Vector3(0, -1, 0));
            }
            if (primaryFx.propeller) {
              primaryFx.propeller.rotation.y += 1.2;
              primaryFx.propeller.rotation.x += 1.2;
            }
            if (primaryFx.rotor) {
              primaryFx.rotor.rotation.y += 0.5;
            }
            if (primaryFx.tailRotor) {
              primaryFx.tailRotor.rotation.x += 0.9;
            }
            primaryFx.trail.forEach((puff, i) => {
              puff.position.set(
                -0.55 - i * 0.16,
                Math.sin(elapsed * 0.02 + i) * 0.02,
                Math.sin(elapsed * 0.012 + i * 0.4) * 0.01 + right.z * 0.005
              );
              const s = 0.85 + i * 0.16 + ((elapsed * 0.0018 + i * 0.18) % 1) * 0.6;
              puff.scale.setScalar(s);
              puff.material.opacity =
                i < 2
                  ? clamp(0.85 - u * 0.45 - i * 0.12, 0.2, 0.85)
                  : clamp(0.24 - (i - 2) * 0.04, 0.06, 0.24);
            });
            if (
              (selectedCaptureAnimationId === 'fighterJetAttack' || selectedCaptureAnimationId === 'helicopterAttack') &&
              jetMissiles.length
            ) {
              const releaseStart = travelTime * 0.56;
              const releaseEnd = travelTime * 0.96;
              const missileTravel = Math.max(280, releaseEnd - releaseStart - 100);
              const hitTop = dynamicTo.clone().add(new THREE.Vector3(0, Math.max(topStrikeHeight * 0.8, 0.38), 0));
              jetMissiles.forEach((jetMissile, missileIndex) => {
                const releaseTime = releaseStart + missileIndex * 140;
                if (elapsed < releaseTime) {
                  jetMissile.root.visible = false;
                  return;
                }
                const missileU = clamp((elapsed - releaseTime) / missileTravel, 0, 1);
                if (missileU <= 0 || missileU >= 1) {
                  jetMissile.root.visible = false;
                  return;
                }
                if (Math.abs(elapsed - releaseTime) < 30) {
                  playMissileLaunchSound();
                }
                const sideOffset = missileIndex === 0 ? -0.045 : 0.045;
                const launchPos = pos.clone().add(right.clone().multiplyScalar(sideOffset));
                const missileEntry = launchPos.clone().lerp(hitTop, 0.72);
                missileEntry.y += topStrikeHeight * 0.12;
                const missilePos =
                  missileU < 0.74
                    ? launchPos.clone().lerp(missileEntry, missileU / 0.74)
                    : missileEntry.clone().lerp(dynamicTo, (missileU - 0.74) / 0.26);
                const missileNext = quadraticBezier(
                  missileU < 0.74 ? launchPos : missileEntry,
                  missileU < 0.74 ? missileEntry : missileEntry,
                  dynamicTo,
                  clamp(missileU + 0.03, 0, 1)
                );
                const missileDir = missileNext.clone().sub(missilePos).normalize();
                jetMissile.root.visible = true;
                jetMissile.root.position.copy(missilePos);
                jetMissile.root.quaternion.setFromUnitVectors(MISSILE_FORWARD, missileDir);
                if (
                  selectedCaptureAnimationId === 'helicopterAttack' &&
                  helicopterMissileImpactAt == null &&
                  missileU >= 0.96
                ) {
                  helicopterMissileImpactAt = elapsed;
                  explosion.root.position.copy(dynamicTo.clone().add(new THREE.Vector3(0, 0.02, 0)));
                  playMissileImpactSound();
                  playExplosionBombSound();
                  playCapture();
                }
                jetMissile.trail.forEach((puff, i) => {
                  puff.position.set(-0.5 - i * 0.14, Math.sin(elapsed * 0.024 + i + missileIndex) * 0.02, 0);
                  puff.scale.setScalar(0.85 + i * 0.12 + missileU * 0.5);
                });
              });
            }
            if ((selectedCaptureAnimationId === 'fighterJetAttack' || selectedCaptureAnimationId === 'helicopterAttack') && u > 0.88) {
              const retreatDir = pos.clone().sub(dynamicTo).setY(0).normalize();
              primaryFx.root.position.addScaledVector(retreatDir, (u - 0.88) * 1.5);
            }
            if (selectedCaptureAnimationId === 'helicopterAttack' && helicopterMissileImpactAt != null) {
              const impactElapsed = (elapsed - helicopterMissileImpactAt) / 1000;
              updateExplosionRig(impactElapsed);
            } else {
              updateExplosionRig(-1);
            }
            requestAnimationFrame(tick);
            return;
          }

          if (flyAwayDuration > 0 && elapsed < travelTime + flyAwayDuration) {
            const flyAwayT = clamp((elapsed - travelTime) / flyAwayDuration, 0, 1);
            const liveExitFrom =
              resolveLiveTokenPosition({
                token: targetToken,
                player: targetPlayer,
                tokenIndex: targetTokenIndex,
                fallbackPosition: safeImpactPoint
              }) ?? safeImpactPoint.clone();
            const flyAwayDir = liveExitFrom.clone().sub(arenaCenter).setY(0);
            if (flyAwayDir.lengthSq() < 1e-6) {
              flyAwayDir.set(Math.cos(fromAngle + angularDelta), 0, Math.sin(fromAngle + angularDelta));
            }
            flyAwayDir.normalize();
            const flyAwayStart = liveExitFrom.clone().add(new THREE.Vector3(0, topStrikeHeight * 0.32, 0));
            const flyAwayEnd = flyAwayStart
              .clone()
              .add(flyAwayDir.multiplyScalar(orbitalRadius * (isHelicopterAttack ? 1.25 : 1.45)))
              .add(new THREE.Vector3(0, topStrikeHeight * (isHelicopterAttack ? 0.18 : 0.08), 0));
            const flyAwayPos = flyAwayStart.clone().lerp(flyAwayEnd, easeSmooth(flyAwayT));
            const flyAwayNext = flyAwayStart.clone().lerp(flyAwayEnd, clamp(flyAwayT + 0.04, 0, 1));
            const flyAwayDirNow = flyAwayNext.sub(flyAwayPos).normalize();
            primaryFx.root.visible = true;
            primaryFx.root.position.copy(flyAwayPos);
            primaryFx.root.quaternion.setFromUnitVectors(MISSILE_FORWARD, flyAwayDirNow);
            const fade = clamp(1 - flyAwayT * 1.1, 0, 1);
            primaryFx.root.traverse((node) => {
              if (!node?.isMesh) return;
              const mats = Array.isArray(node.material) ? node.material : [node.material];
              mats.forEach((mat) => {
                if (!mat) return;
                mat.transparent = true;
                mat.opacity = fade;
              });
            });
          } else {
            primaryFx.root.visible = false;
          }
          jetMissiles.forEach((entry) => {
            entry.root.visible = false;
          });
          const useHelicopterMissileImpact =
            selectedCaptureAnimationId === 'helicopterAttack' && helicopterMissileImpactAt != null;
          const explosionElapsed = useHelicopterMissileImpact
            ? (elapsed - helicopterMissileImpactAt) / 1000
            : (elapsed - travelTime) / 1000;
          if (!useHelicopterMissileImpact) {
            explosion.root.position.copy(liveTarget.clone().add(new THREE.Vector3(0, 0.02, 0)));
            updateExplosionRig(explosionElapsed);
            if (!explosionTriggered) {
              explosionTriggered = true;
              playMissileImpactSound();
              playExplosionBombSound();
              playCapture();
            }
          } else {
            updateExplosionRig(explosionElapsed);
          }
          if (
            elapsed < travelTime + Math.max(explosionTime, flyAwayDuration) ||
            (useHelicopterMissileImpact && explosionElapsed < explosionTime / 1000)
          ) {
            requestAnimationFrame(tick);
            return;
          }

          stopCaptureVehicleSounds();
          if (primaryFx.root.parent) primaryFx.root.parent.remove(primaryFx.root);
          jetMissiles.forEach((entry) => {
            if (entry.root.parent) entry.root.parent.remove(entry.root);
          });
          if (explosion.root.parent) explosion.root.parent.remove(explosion.root);
          captureFxRef.current = null;
          resolve();
        };
          requestAnimationFrame(tick);
        } catch (error) {
          stopCaptureVehicleSounds();
          captureFxRef.current = null;
          resolve();
        }
      })();
    });

  const playTokenStepSound = () => {
    if (!settingsRef.current.soundEnabled) return;
    playLudoTokenStepSfx({
      volume: getGameVolume(),
      muted: !settingsRef.current.soundEnabled
    });
  };

  const playCheer = () => {
    if (!settingsRef.current.soundEnabled) return;
    if (cheerSoundRef.current) {
      cheerSoundRef.current.currentTime = 0;
      cheerSoundRef.current.play().catch(() => {});
    }
  };

  const playDiceSound = () => {
    if (!settingsRef.current.soundEnabled) return;
    playLudoDiceRollSfx({
      volume: getGameVolume(),
      muted: !settingsRef.current.soundEnabled
    });
  };

  const playSixRollSound = () => {
    if (!settingsRef.current.soundEnabled) return;
    if (diceRewardSoundRef.current) {
      diceRewardSoundRef.current.currentTime = 0;
      diceRewardSoundRef.current.play().catch(() => {});
    }
  };

  const cancelCameraFocusAnimation = useCallback(() => {
    if (cameraFocusTimeoutRef.current) {
      clearTimeout(cameraFocusTimeoutRef.current);
      cameraFocusTimeoutRef.current = null;
    }
    if (cameraFocusFrameRef.current) {
      cancelAnimationFrame(cameraFocusFrameRef.current);
      cameraFocusFrameRef.current = 0;
    }
    cameraTurnStateRef.current.activePriority = -Infinity;
    cameraTurnStateRef.current.followObject = null;
    cameraTurnStateRef.current.followOffset = null;
  }, []);

  const cancelCameraViewAnimation = useCallback(() => {
    if (cameraViewFrameRef.current) {
      cancelAnimationFrame(cameraViewFrameRef.current);
      cameraViewFrameRef.current = 0;
    }
  }, []);

  const animateCameraPose = useCallback((toTarget, toPosition = null, duration = 300) => {
    const resolvedDuration = resolveFrameSyncedDuration(duration, { min: 220, max: 1200 });
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    if (!controls || !camera || !toTarget) return;
    const fromPosition = camera.position.clone();
    const destinationPosition =
      toPosition?.isVector3
        ? toPosition.clone()
        : camera.position.clone();
    if (!cameraTurnStateRef.current.currentTarget) {
      cameraTurnStateRef.current.currentTarget = controls.target.clone();
    }
    const fromTarget = cameraTurnStateRef.current.currentTarget.clone();
    const destination = toTarget.clone();
    if (cameraFocusFrameRef.current) {
      cancelAnimationFrame(cameraFocusFrameRef.current);
      cameraFocusFrameRef.current = 0;
    }
    if (resolvedDuration <= 0) {
      controls.target.copy(destination);
      cameraTurnStateRef.current.currentTarget.copy(destination);
      camera.position.copy(destinationPosition);
      controls.update();
      return;
    }
    const started = performance.now();
    const step = () => {
      const now = performance.now();
      const t = Math.min(1, (now - started) / Math.max(resolvedDuration, 1));
      const eased = easeSmooth(t);
      controls.target.copy(fromTarget).lerp(destination, eased);
      camera.position.copy(fromPosition).lerp(destinationPosition, eased);
      cameraTurnStateRef.current.currentTarget.copy(controls.target);
      controls.update();
      if (t < 1) {
        cameraFocusFrameRef.current = requestAnimationFrame(step);
      } else {
        cameraFocusFrameRef.current = 0;
      }
    };
    cameraFocusFrameRef.current = requestAnimationFrame(step);
  }, [resolveFrameSyncedDuration]);

  const resolveTurnCameraState = useCallback((player, offset = CAMERA_TARGET_LIFT) => {
    const arena = arenaRef.current;
    const camera = cameraRef.current;
    if (!arena?.boardLookTarget || !camera) return null;
    const anchors = Array.isArray(arena.seatAnchors) ? arena.seatAnchors : [];
    const seatIndex = Number.isInteger(player) ? player : Number(player);
    if (!Number.isFinite(seatIndex) || seatIndex < 0 || seatIndex >= anchors.length) return null;
    const anchor = anchors[seatIndex];
    if (!anchor) return null;

    const boardLookTarget = arena.boardLookTarget;
    const seatWorld = new THREE.Vector3();
    anchor.getWorldPosition(seatWorld);
    const sideBlend =
      seatIndex === 1 || seatIndex === 3 ? CAMERA_SIDE_AVATAR_BLEND : CAMERA_BROADCAST_TARGET_BLEND;
    const target = boardLookTarget
      .clone()
      .lerp(seatWorld, CAMERA_TURN_PLAYER_LERP * sideBlend);
    target.y = (arena.tableInfo?.surfaceY ?? boardLookTarget.y) + offset;
    const direction = seatWorld.clone().sub(boardLookTarget).setY(0);
    if (direction.lengthSq() < 1e-6) return null;
    direction.normalize();

    const isTopOrBottomSeat = Math.abs(direction.z) >= Math.abs(direction.x);
    if (isTopOrBottomSeat) {
      const baseView = cameraTurnStateRef.current.baseTurnView;
      if (!baseView) return null;
      return {
        position: camera.position.clone(),
        target: baseView.target.clone()
      };
    }

    const boardToCamera = camera.position.clone().sub(boardLookTarget).setY(0);
    if (boardToCamera.lengthSq() > 1e-6) {
      boardToCamera.normalize();
      if (direction.dot(boardToCamera) >= 0.82) return null;
    }

    const desiredOrbitDirection = direction.clone().multiplyScalar(-1);
    const orbitDirection = boardToCamera.lengthSq() > 1e-6
      ? boardToCamera.clone().lerp(desiredOrbitDirection, 0.8).normalize()
      : desiredOrbitDirection;
    if (!orbitDirection.lengthSq()) return null;

    const position = camera.position.clone();
    if (seatIndex === 0) {
      const toCamera = position.clone().sub(boardLookTarget);
      const horizontal = toCamera.clone().setY(0);
      if (horizontal.lengthSq() > 1e-6) {
        horizontal.normalize();
        position.addScaledVector(horizontal, USER_TURN_CAMERA_PULLBACK);
      }
      position.y += USER_TURN_CAMERA_LIFT;
    }

    return {
      position,
      target
    };
  }, []);

  const resolveFocusCameraState = useCallback((focusTarget, offset = CAMERA_TARGET_LIFT) => {
    const camera = cameraRef.current;
    const arena = arenaRef.current;
    if (!camera || !arena?.boardLookTarget || !focusTarget?.isVector3) return null;
    const boardLookTarget = arena.boardLookTarget;
    const sideDistance = Math.min(
      1,
      Math.abs(focusTarget.x - boardLookTarget.x) / Math.max(BOARD_CLOTH_HALF * 0.75, 0.01)
    );
    const dynamicBlend = THREE.MathUtils.lerp(
      CAMERA_BROADCAST_TARGET_BLEND,
      CAMERA_BROADCAST_SIDE_BLEND,
      sideDistance
    );
    const target = boardLookTarget.clone().lerp(focusTarget, dynamicBlend);
    target.y = (arena.tableInfo?.surfaceY ?? target.y) + offset;

    return { position: camera.position.clone(), target };
  }, []);

  const moveCameraToHighestAllowedAngle = useCallback((focusTarget, offset = CAMERA_TARGET_LIFT) => {
    if (isCamera2d || !LUDO_CAMERA_AUTO_LOOK_ENABLED) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const arena = arenaRef.current;
    if (!camera || !controls || !arena?.boardLookTarget || !focusTarget?.isVector3) return;

    const surfaceY = arena.tableInfo?.surfaceY ?? focusTarget.y;
    const target = focusTarget.clone();
    target.y = surfaceY + offset;

    const currentOffset = camera.position.clone().sub(controls.target);
    const radius = clamp(currentOffset.length(), CAM.minR, CAM.maxR);
    const horizontal = currentOffset.setY(0);
    if (horizontal.lengthSq() < 1e-6) {
      horizontal.set(0, 0, 1);
    } else {
      horizontal.normalize();
    }
    const highestPolar = clamp(controls.minPolarAngle, 0.001, Math.PI - 0.001);
    const horizontalDistance = radius * Math.sin(highestPolar);
    const verticalDistance = radius * Math.cos(highestPolar);
    const position = target
      .clone()
      .addScaledVector(horizontal, horizontalDistance)
      .add(new THREE.Vector3(0, verticalDistance, 0));
    animateCameraPose(target, position, 220);
  }, [animateCameraPose, isCamera2d]);

  const resolveTurnLookTarget = useCallback((player, offset = CAMERA_TARGET_LIFT) => {
    const controls = controlsRef.current;
    const arena = arenaRef.current;
    if (!controls || !arena?.boardLookTarget) return null;
    const baseTarget = arena.boardLookTarget.clone();
    baseTarget.y = (arena.tableInfo?.surfaceY ?? baseTarget.y) + offset;

    if (player === 3) {
      baseTarget.x -= CAMERA_SIDE_LOOK_EXTRA;
      return baseTarget;
    }

    if (player === 1) {
      baseTarget.x += CAMERA_SIDE_LOOK_EXTRA;
      return baseTarget;
    }

    return baseTarget;
  }, []);

  const shouldRespectUserCamera = useCallback(
    (player) => {
      if (player !== 0) return false;
      if (humanSelectionRef.current) return true;
      const state = stateRef.current;
      if (!state || state.winner) return false;
      return Boolean(state.animation?.active && state.animation.player === 0);
    },
    []
  );

  const setCameraViewForTurn = useCallback((player, duration = CAMERA_TURN_VIEW_DURATION_MS, { force = false } = {}) => {
    cancelCameraViewAnimation();
    if (isCamera2d || !LUDO_CAMERA_AUTO_LOOK_ENABLED) return;
    if (shouldRespectUserCamera(player)) return;
    if (!force && preserveUserTurnCameraRef.current) return;
    if (player !== 0) {
      preserveUserTurnCameraRef.current = false;
    }
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (player === 0) {
      const initialBottomView = initialBottomCameraViewRef.current;
      if (initialBottomView?.position?.isVector3 && initialBottomView?.target?.isVector3) {
        const boardLookTarget = boardLookTargetRef.current;
        const alignedPosition = initialBottomView.position.clone();
        const alignedTarget = initialBottomView.target.clone();
        if (boardLookTarget?.isVector3) {
          alignedPosition.x = boardLookTarget.x;
          alignedTarget.x = boardLookTarget.x;
          if (Math.abs(alignedTarget.z - boardLookTarget.z) > CAMERA_PLAYER_CENTER_X_EPSILON) {
            alignedTarget.z = boardLookTarget.z;
          }
        }
        cameraTurnStateRef.current.baseTurnView = {
          position: alignedPosition,
          target: alignedTarget
        };
        animateCameraPose(
          cameraTurnStateRef.current.baseTurnView.target,
          cameraTurnStateRef.current.baseTurnView.position,
          duration
        );
        return;
      }
      if (camera && controls) {
        cameraTurnStateRef.current.baseTurnView = {
          position: camera.position.clone(),
          target: controls.target.clone()
        };
      }
    }
    const nextView = resolveTurnCameraState(player, CAMERA_TARGET_LIFT);
    if (!nextView) return;
    animateCameraPose(nextView.target, nextView.position, duration);
  }, [animateCameraPose, cancelCameraViewAnimation, isCamera2d, resolveTurnCameraState, shouldRespectUserCamera]);

  const setCameraFocus = useCallback(
    (focus = {}) => {
      const state = stateRef.current;
      const controls = controlsRef.current;
      if (!state || !controls || isCamera2d || !LUDO_CAMERA_AUTO_LOOK_ENABLED) return;
      const {
        object,
        target,
        follow = false,
        ttl = 0,
        priority = 0,
        force = false,
        offset = CAMERA_TARGET_LIFT,
        allowDuringHumanMove = false
      } = focus;
      if (!allowDuringHumanMove && shouldRespectUserCamera(state.turn)) return;
      if (!force && priority < cameraTurnStateRef.current.activePriority) return;

      let nextTarget = null;
      if (target?.isVector3) {
        nextTarget = target.clone();
        nextTarget.y = (arenaRef.current?.tableInfo?.surfaceY ?? nextTarget.y) + offset;
      } else if (object?.isObject3D) {
        nextTarget = object.getWorldPosition(new THREE.Vector3());
        nextTarget.y = (arenaRef.current?.tableInfo?.surfaceY ?? nextTarget.y) + offset;
      } else {
        const turnView = resolveTurnCameraState(state.turn, offset);
        if (turnView) {
          nextTarget = turnView.target.clone();
        } else {
          nextTarget = resolveTurnLookTarget(state.turn, offset);
        }
      }
      if (!nextTarget) return;

      cameraTurnStateRef.current.activePriority = priority;
      cameraTurnStateRef.current.followObject =
        !LUDO_CAMERA_BROADCAST_LOCKED_POSITION && follow && object?.isObject3D ? object : null;

      const nextFocusState = resolveFocusCameraState(nextTarget, offset);
      if (nextFocusState) {
        if (cameraTurnStateRef.current.followObject) {
          const camera = cameraRef.current;
          cameraTurnStateRef.current.followOffset = camera
            ? camera.position.clone().sub(nextFocusState.target)
            : null;
        } else {
          cameraTurnStateRef.current.followOffset = null;
        }
        animateCameraPose(nextFocusState.target, nextFocusState.position, CAMERA_BROADCAST_ANIMATION_MS);
      }
      if (ttl > 0) {
        if (cameraFocusTimeoutRef.current) {
          clearTimeout(cameraFocusTimeoutRef.current);
        }
        cameraFocusTimeoutRef.current = window.setTimeout(() => {
          cameraFocusTimeoutRef.current = null;
          cameraTurnStateRef.current.activePriority = -Infinity;
          cameraTurnStateRef.current.followObject = null;
          cameraTurnStateRef.current.followOffset = null;
          const returnTarget = resolveTurnLookTarget(stateRef.current?.turn ?? 0, CAMERA_TARGET_LIFT);
          if (returnTarget) {
            const restoreFocusState = resolveFocusCameraState(returnTarget, CAMERA_TARGET_LIFT);
            if (restoreFocusState) {
              animateCameraPose(restoreFocusState.target, restoreFocusState.position, CAMERA_RETURN_ANIMATION_MS);
            }
          }
        }, Math.max(0, ttl * 1000));
      }
    },
    [animateCameraPose, isCamera2d, resolveFocusCameraState, resolveTurnCameraState, resolveTurnLookTarget, shouldRespectUserCamera]
  );

  const getWorldForProgress = (player, progress, tokenIndex) => {
    const state = stateRef.current;
    if (!state) return new THREE.Vector3();
    if (progress < 0) {
      const base = state.startPads[player][tokenIndex].clone();
      base.y = getTokenRailHeight(player);
      return base;
    }
    if (progress < RING_STEPS) {
      const idx = (PLAYER_START_INDEX[player] + progress) % RING_STEPS;
      return state.paths[idx].clone().add(TOKEN_TRACK_LIFT.clone());
    }
    if (progress < RING_STEPS + HOME_STEPS) {
      const homeStep = progress - RING_STEPS;
      return state.homeColumns[player][homeStep].clone().add(TOKEN_TRACK_LIFT.clone());
    }
    return state.goalSlots[player][tokenIndex].clone().add(TOKEN_GOAL_LIFT.clone());
  };

  const hasAnyTokenOnBoard = useCallback((player) => {
    const state = stateRef.current;
    if (!state?.progress?.[player]) return false;
    return state.progress[player].some((progress) => Number.isFinite(progress) && progress >= 0 && progress < GOAL_PROGRESS);
  }, []);

  const scheduleMove = (player, tokenIndex, targetProgress, onComplete, options = {}) => {
    const state = stateRef.current;
    if (!state) return;
    const { skipCameraFollow = false } = options;
    const shouldFollowCamera = !skipCameraFollow;
    const fromProgress = state.progress[player][tokenIndex];
    const path = [];
    if (fromProgress < 0) {
      path.push({ position: getWorldForProgress(player, -1, tokenIndex), progress: fromProgress });
      path.push({ position: getWorldForProgress(player, 0, tokenIndex), progress: 0 });
    } else {
      path.push({
        position: getWorldForProgress(player, fromProgress, tokenIndex),
        progress: fromProgress
      });
      for (let p = fromProgress + 1; p <= targetProgress; p++) {
        path.push({ position: getWorldForProgress(player, p, tokenIndex), progress: p });
      }
    }
    const token = state.tokens[player][tokenIndex];
    const segments = [];
    const highlightTiles = [];
    for (let i = 0; i < path.length - 1; i++) {
      const from = path[i].position;
      const to = path[i + 1].position;
      const distance = from.distanceTo(to);
      const duration = Math.max(TOKEN_STEP_DURATION_SECONDS, distance / TOKEN_MOVE_SPEED);
      segments.push({ from, to, distance, duration, progress: path[i + 1].progress });
      const tile = findTileForProgress(player, path[i + 1].progress);
      highlightTiles.push(tile ?? null);
    }
    if (!segments.length) {
      if (token && shouldFollowCamera) {
        setCameraFocus({
          target: token.position.clone(),
          follow: false,
          ttl: 1.2,
          priority: 2,
          offset: CAMERA_TARGET_LIFT + 0.02,
          force: true
        });
      }
      state.animation = null;
      if (typeof onComplete === 'function') onComplete();
      return;
    }
      if (token && shouldFollowCamera) {
        setCameraFocus({
          object: token,
          follow: true,
          priority: 6,
          offset: CAMERA_TARGET_LIFT + 0.02
        });
      }
    state.animation = {
      active: true,
      token,
      segments,
      segment: 0,
      elapsed: 0,
      onComplete,
      player,
      tokenIndex,
      highlightTiles,
      activeHighlightTiles: [],
      highlightIndex: -1
    };
    playTokenStepSound();
  };

  const getTrackIndexForProgress = (player, progress) => {
    if (progress < 0 || progress >= RING_STEPS) return null;
    return (PLAYER_START_INDEX[player] + progress) % RING_STEPS;
  };

  const countCapturesForTarget = (state, player, targetProgress) => {
    if (targetProgress < 0 || targetProgress >= RING_STEPS) return 0;
    const landingIdx = getTrackIndexForProgress(player, targetProgress);
    if (landingIdx == null) return 0;
    let captures = 0;
    for (let opponent = 0; opponent < activePlayerCount; opponent += 1) {
      if (opponent === player) continue;
      for (let t = 0; t < 4; t += 1) {
        const prog = state.progress[opponent][t];
        if (prog < 0 || prog >= RING_STEPS) continue;
        const idx = getTrackIndexForProgress(opponent, prog);
        if (idx === landingIdx) captures += 1;
      }
    }
    return captures;
  };

  const countOwnStacking = (state, player, targetProgress, ignoreToken) => {
    if (targetProgress < 0 || targetProgress >= RING_STEPS) return 0;
    const landingIdx = getTrackIndexForProgress(player, targetProgress);
    if (landingIdx == null) return 0;
    let stack = 0;
    for (let i = 0; i < 4; i += 1) {
      if (i === ignoreToken) continue;
      const prog = state.progress[player][i];
      if (prog < 0 || prog >= RING_STEPS) continue;
      const idx = getTrackIndexForProgress(player, prog);
      if (idx === landingIdx) stack += 1;
    }
    return stack;
  };

  const countThreatsAgainst = (state, player, targetProgress) => {
    if (!state || targetProgress < 0 || targetProgress >= RING_STEPS) return 0;
    const landingIdx = getTrackIndexForProgress(player, targetProgress);
    if (landingIdx == null) return 0;
    let threat = 0;
    for (let opponent = 0; opponent < activePlayerCount; opponent += 1) {
      if (opponent === player) continue;
      for (let t = 0; t < 4; t += 1) {
        const prog = state.progress[opponent][t];
        if (prog < 0 || prog >= RING_STEPS) continue;
        const oppIdx = getTrackIndexForProgress(opponent, prog);
        if (oppIdx == null) continue;
        const distance = (landingIdx - oppIdx + RING_STEPS) % RING_STEPS;
        if (distance > 0 && distance <= 6) {
          threat = Math.max(threat, 7 - distance);
        }
      }
    }
    return threat;
  };

  const evaluateMoveOption = (state, player, option, roll) => {
    if (!state) return -Infinity;
    const current = state.progress[player][option.token];
    const target = option.entering ? 0 : current + roll;
    if (target > GOAL_PROGRESS) return -Infinity;
    if (target >= GOAL_PROGRESS) {
      return 10000 + roll * 10;
    }
    let score = 0;
    if (option.entering) {
      score += 180;
      if (state.progress[player].every((p) => p < 0)) {
        score += 50;
      }
    }
    if (target >= RING_STEPS) {
      const stepsIntoHome = target - RING_STEPS + 1;
      score += 600 + stepsIntoHome * 45;
      return score + Math.random() * 0.01;
    }
    const captureCount = countCapturesForTarget(state, player, target);
    if (captureCount > 0) {
      score += 450 + captureCount * 60;
    }
    const landingIdx = getTrackIndexForProgress(player, target);
    let ownStack = 0;
    if (landingIdx != null) {
      if (SAFE_TRACK_INDEXES.has(landingIdx)) {
        score += 80;
      }
      ownStack = countOwnStacking(state, player, target, option.token);
      if (ownStack > 0) {
        score += 60 + ownStack * 25;
      }
    }
    if (!option.entering && current >= 0 && current < RING_STEPS) {
      const fromIdx = getTrackIndexForProgress(player, current);
      if (
        fromIdx != null &&
        SAFE_TRACK_INDEXES.has(fromIdx) &&
        !(landingIdx != null && SAFE_TRACK_INDEXES.has(landingIdx))
      ) {
        score -= 40;
      }
    }
    if (
      landingIdx != null &&
      !SAFE_TRACK_INDEXES.has(landingIdx) &&
      ownStack === 0 &&
      target < RING_STEPS
    ) {
      const threat = countThreatsAgainst(state, player, target);
      if (threat > 0) {
        score -= 45 + threat * 25;
      }
    }
    score += target * 6;
    score += Math.max(0, (RING_STEPS - target) * 0.4);
    return score + Math.random() * 0.01;
  };

  const chooseMoveOption = (state, player, roll, options) => {
    if (!state || !options.length) return null;
    let best = null;
    let bestScore = -Infinity;
    for (const option of options) {
      const score = evaluateMoveOption(state, player, option, roll);
      if (score > bestScore) {
        bestScore = score;
        best = option;
      }
    }
    return best ?? options[0] ?? null;
  };

  const queueAiRoll = useCallback(
    (delay = AI_ROLL_DELAY_MS) => {
      if (aiTimeoutRef.current) {
        clearTimeout(aiTimeoutRef.current);
      }
      aiTimeoutRef.current = window.setTimeout(() => {
        aiTimeoutRef.current = null;
        const nextState = stateRef.current;
        if (!nextState || nextState.winner) return;
        if (nextState.turn === 0) return;
        if (nextState.animation) {
          queueAiRoll(Math.min(400, delay));
          return;
        }
        const diceObj = diceRef.current;
        if (diceObj?.userData?.isRolling) {
          queueAiRoll(Math.min(400, delay));
          return;
        }
        rollDiceRef.current?.();
      }, delay);
    },
    []
  );

  const scheduleDiceClear = useCallback(() => {
    if (diceClearTimeoutRef.current) {
      clearTimeout(diceClearTimeoutRef.current);
    }
    diceClearTimeoutRef.current = window.setTimeout(() => {
      diceClearTimeoutRef.current = null;
      setUi((s) => {
        if (s.dice == null) return s;
        return { ...s, dice: null };
      });
    }, 2000 + DICE_RESULT_EXTRA_HOLD_MS);
  }, [setUi]);

  const advanceTurn = (extraTurn) => {
    clearTurnAdvanceTimeout();
    clearHumanSelection();
    cancelCameraFocusAnimation();
    let nextTurn = 0;
    let updated = false;
    setUi((s) => {
      if (s.winner) return s;
      const playerCycle = Math.max(1, activePlayerCount);
      nextTurn = extraTurn ? s.turn : (s.turn + playerCycle - 1) % playerCycle;
      const state = stateRef.current;
      if (state) state.turn = nextTurn;
      updateTurnIndicator(nextTurn);
      const shouldLockHumanCamera = nextTurn === 0;
      preserveUserTurnCameraRef.current = shouldLockHumanCamera;
      if (!shouldLockHumanCamera) {
        setCameraViewForTurn(nextTurn);
        setCameraFocus({ target: resolveTurnLookTarget(nextTurn), priority: 1, force: true });
      }
      if (diceRef.current && !shouldLockHumanCamera) {
        setCameraFocus({
          object: diceRef.current,
          follow: true,
          priority: 4,
          force: true,
          offset: CAMERA_TARGET_LIFT + 0.022
        });
      }
      updated = true;
      const status =
        nextTurn === 0
          ? extraTurn
            ? 'You rolled a 6 — rolling again'
            : 'Your turn — dice rolling soon'
          : extraTurn
          ? `${COLOR_NAMES[nextTurn]} rolled a 6 — rolling again`
          : `${COLOR_NAMES[nextTurn]} to roll`;
      return {
        ...s,
        turn: nextTurn,
        turnCycle: (s.turnCycle ?? 0) + 1,
        status
      };
    });
    if (!updated) {
      if (aiTimeoutRef.current) {
        clearTimeout(aiTimeoutRef.current);
        aiTimeoutRef.current = null;
      }
      clearHumanRollTimeout();
      return;
    }
    scheduleDiceClear();
    if (nextTurn === 0) {
      clearHumanRollTimeout();
      scheduleHumanAutoRoll();
      if (aiTimeoutRef.current) {
        clearTimeout(aiTimeoutRef.current);
        aiTimeoutRef.current = null;
      }
    } else {
      clearHumanRollTimeout();
      const delay = extraTurn ? AI_EXTRA_TURN_DELAY_MS : AI_ROLL_DELAY_MS;
      queueAiRoll(delay);
    }
  };

  const getCaptureVictims = (player, landingProgress) => {
    const state = stateRef.current;
    if (!state) return [];
    if (landingProgress < 0 || landingProgress >= RING_STEPS) return [];
    const landingIdx = (PLAYER_START_INDEX[player] + landingProgress) % RING_STEPS;
    const victims = [];
    for (let p = 0; p < activePlayerCount; p++) {
      if (p === player) continue;
      for (let t = 0; t < 4; t++) {
        if (state.progress[p][t] < 0 || state.progress[p][t] >= RING_STEPS) continue;
        const idx = (PLAYER_START_INDEX[p] + state.progress[p][t]) % RING_STEPS;
        if (idx === landingIdx) {
          victims.push({ player: p, token: t });
        }
      }
    }
    return victims;
  };

  const applyCaptureVictims = (victims = []) => {
    const state = stateRef.current;
    if (!state || !victims.length) return { count: 0, opponents: [] };
    const opponents = [];
    victims.forEach(({ player, token }) => {
      if (state.progress[player][token] < 0) return;
      state.progress[player][token] = -1;
      const tokenNode = state.tokens[player][token];
      const pos = state.startPads[player][token].clone();
      pos.y = getTokenRailHeight(player);
      tokenNode.position.copy(pos);
      applyTokenFacingRotation(tokenNode);
      opponents.push(resolvePlayerLabel(player));
    });
    return { count: opponents.length, opponents };
  };

  const checkWin = (player) => {
    const state = stateRef.current;
    if (!state) return false;
    const allHome = state.progress[player].every((p) => p >= GOAL_PROGRESS);
    if (allHome) {
      state.winner = player;
      clearHumanSelection();
      setUi((s) => ({
        ...s,
        winner: COLOR_NAMES[player],
        status: `${COLOR_NAMES[player]} wins!`
      }));
      clearHumanRollTimeout();
      playCheer();
      coinConfetti();
      return true;
    }
    return false;
  };

  const moveToken = (player, tokenIndex, roll, options = {}) => {
    const state = stateRef.current;
    if (!state) return;
    const current = state.progress[player][tokenIndex];
    const entering = current < 0;
    const target = entering ? 0 : current + roll;
    if (target > GOAL_PROGRESS) return advanceTurn(false);
    if (entering) {
      const seatSideTarget = getWorldForProgress(player, 0, tokenIndex);
      const isSideSeat = player === 1 || player === 3;
      const enteringOffset = isSideSeat ? CAMERA_TARGET_LIFT + 0.035 : CAMERA_TARGET_LIFT + 0.02;
      if (player !== 0) {
        setCameraViewForTurn(player, CAMERA_TURN_VIEW_DURATION_MS, { force: true });
        setCameraFocus({
          target: seatSideTarget,
          follow: false,
          priority: 6,
          ttl: 0.95,
          force: true,
          offset: enteringOffset
        });
      }
    }
    const captureVictims = getCaptureVictims(player, target);
    const hasCapture = captureVictims.length > 0;
    const finalizeMove = () => {
      const finalPos = getWorldForProgress(player, target, tokenIndex);
      state.progress[player][tokenIndex] = target;
      state.tokens[player][tokenIndex].position.copy(finalPos);
      applyTokenFacingRotation(state.tokens[player][tokenIndex]);
      updateTokenStacks();
      const winner = checkWin(player);
      advanceTurn(!winner && roll === 6);
    };
    const applyResult = async () => {
      applyCaptureVictims(captureVictims);
      finalizeMove();
    };
    const { skipCameraFollow = false } = options;
    if (hasCapture) {
      const attackerStartPos = state.tokens[player][tokenIndex].position.clone();
      const firstVictim = captureVictims[0];
      const victimToken = state.tokens[firstVictim.player][firstVictim.token];
      const victimPos =
        victimToken?.position?.clone?.() ??
        getWorldForProgress(firstVictim.player, state.progress[firstVictim.player][firstVictim.token], firstVictim.token);
      const impactPos = victimPos.clone();
      void playCaptureMissileSequence({
        attackerToken: state.tokens[player][tokenIndex],
        attackerPlayer: player,
        attackerTokenIndex: tokenIndex,
        startPosition: attackerStartPos,
        targetToken: victimToken,
        targetPlayer: firstVictim.player,
        targetTokenIndex: firstVictim.token,
        targetPosition: victimPos,
        impactPosition: impactPos
      }).then(() => {
        applyCaptureVictims(captureVictims);
        if (entering || target !== current) {
          scheduleMove(player, tokenIndex, target, finalizeMove, { skipCameraFollow });
          return;
        }
        finalizeMove();
      }).catch(() => {
        applyCaptureVictims(captureVictims);
        if (entering || target !== current) {
          scheduleMove(player, tokenIndex, target, finalizeMove, { skipCameraFollow });
          return;
        }
        finalizeMove();
      });
    } else if (entering || target !== current) {
      scheduleMove(player, tokenIndex, target, applyResult, { skipCameraFollow });
    } else {
      void applyResult();
    }
  };

  const getMovableTokens = (player, roll) => {
    const state = stateRef.current;
    if (!state) return [];
    const list = [];
    for (let i = 0; i < 4; i++) {
      const prog = state.progress[player][i];
      if (prog < 0) {
        if (roll === 6) list.push({ token: i, entering: true });
        continue;
      }
      const target = prog + roll;
      if (target <= GOAL_PROGRESS) list.push({ token: i, entering: false });
    }
    return list;
  };

  const rollDice = async () => {
    const state = stateRef.current;
    clearHumanRollTimeout();
    clearTurnAdvanceTimeout();
    clearHumanSelection();
    if (!state || state.winner) return;
    if (state.animation) return;
    const dice = diceRef.current;
    if (!dice || dice.userData?.isRolling) return;
    const player = state.turn;
    const baseHeight = dice.userData?.baseHeight ?? DICE_BASE_HEIGHT;
    const rollTargets = dice.userData?.rollTargets;
    const clothLimit = dice.userData?.clothLimit ?? BOARD_CLOTH_HALF - 0.12;
    const baseTarget = rollTargets?.[player]?.clone() ?? new THREE.Vector3(0, baseHeight, 0);
    baseTarget.x = THREE.MathUtils.clamp(baseTarget.x, -clothLimit, clothLimit);
    baseTarget.z = THREE.MathUtils.clamp(baseTarget.z, -clothLimit, clothLimit);
    baseTarget.y = baseHeight;
    stopDiceTransition();
    dice.userData.isRolling = true;
    if (player !== 0) {
      setCameraViewForTurn(player, CAMERA_TURN_VIEW_DURATION_MS, { force: true });
      setCameraFocus({
        object: dice,
        follow: false,
        priority: 5,
        force: true,
        offset: CAMERA_TARGET_LIFT + 0.025
      });
    }
    playDiceSound();
    const landingFocus = baseTarget.clone();
    const value = await spinDice(dice, {
      duration: resolveFrameSyncedDuration(AUTO_ROLL_DURATION_MS, { min: 620, max: 1400 }),
      targetPosition: baseTarget,
      bounceHeight: dice.userData?.bounceHeight ?? 0.06
    });
    dice.userData.isRolling = false;
    setUi((s) => ({
      ...s,
      dice: value,
      status: player === 0 ? `You rolled ${value}` : `${COLOR_NAMES[player]} rolled ${value}`
    }));
    if (value === 6) {
      playSixRollSound();
    }
    const hasBoardTokenBeforeRoll = hasAnyTokenOnBoard(player);
    const options = getMovableTokens(player, value);
    const hasBoardMoveOption = options.some((option) => !option.entering);
    const keepTurnCameraFraming = !hasBoardTokenBeforeRoll || !options.length || !hasBoardMoveOption;
    scheduleDiceClear();
    if (!keepTurnCameraFraming && player !== 0) {
      setCameraFocus({
        target: landingFocus,
        follow: false,
        ttl: 0.88,
        priority: 2,
        offset: CAMERA_TARGET_LIFT + 0.03,
        force: true
      });
    } else if (player !== 0) {
      setCameraViewForTurn(player, CAMERA_TURN_VIEW_DURATION_MS, { force: true });
    }
    if (!options.length) {
      const playerCycle = Math.max(1, activePlayerCount);
      const upcomingTurn = value === 6 ? player : (player + playerCycle - 1) % playerCycle;
      setCameraViewForTurn(upcomingTurn, CAMERA_TURN_VIEW_DURATION_MS, { force: true });
      setCameraFocus({ target: resolveTurnLookTarget(upcomingTurn), priority: 1, force: true });
      clearTurnAdvanceTimeout();
      turnAdvanceTimeoutRef.current = window.setTimeout(() => {
        turnAdvanceTimeoutRef.current = null;
        advanceTurn(value === 6);
      }, 900);
      return;
    }
    if (player === 0) {
      beginHumanSelection(value, options, { skipCameraFollow: !hasBoardTokenBeforeRoll });
      return;
    }
    const choice = chooseMoveOption(state, player, value, options);
    if (!choice) {
      const playerCycle = Math.max(1, activePlayerCount);
      const upcomingTurn = value === 6 ? player : (player + playerCycle - 1) % playerCycle;
      setCameraViewForTurn(upcomingTurn, CAMERA_TURN_VIEW_DURATION_MS, { force: true });
      setCameraFocus({ target: resolveTurnLookTarget(upcomingTurn), priority: 1, force: true });
      clearTurnAdvanceTimeout();
      turnAdvanceTimeoutRef.current = window.setTimeout(() => {
        turnAdvanceTimeoutRef.current = null;
        advanceTurn(value === 6);
      }, DICE_RESULT_EXTRA_HOLD_MS);
      return;
    }
    moveToken(player, choice.token, value, {
      skipCameraFollow: !hasBoardTokenBeforeRoll || choice.entering
    });
  };

  rollDiceRef.current = rollDice;

  useEffect(() => {
    const state = stateRef.current;
    if (ui.winner) return undefined;
    if (!state) return undefined;
    if (ui.turn === 0) return undefined;
    if (state.turn !== ui.turn) return undefined;
    if (state.animation) return undefined;
    if (!aiTimeoutRef.current) {
      queueAiRoll();
    }

    return () => {
      if (aiTimeoutRef.current) {
        clearTimeout(aiTimeoutRef.current);
        aiTimeoutRef.current = null;
      }
    };
  }, [ui.turn, ui.turnCycle, ui.winner, queueAiRoll]);

  return (
    <div
      ref={wrapRef}
      className="fixed inset-0 bg-[#0c1020] text-white touch-pan-y select-none"
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[5.35rem] left-2 z-20 flex flex-col items-start gap-3">
          <div className="pointer-events-auto">
            <button
              type="button"
              onClick={() => setConfigOpen((prev) => !prev)}
              aria-expanded={configOpen}
              aria-label={configOpen ? 'Close game settings menu' : 'Open game settings menu'}
              className="flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-gray-100 shadow-[0_6px_18px_rgba(2,6,23,0.45)] transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              <span className="text-base leading-none">☰</span>
              <span className="leading-none">Menu</span>
            </button>
          </div>
          {configOpen && (
            <div className="pointer-events-auto mt-2 flex max-h-[80vh] w-72 max-w-[80vw] flex-col overflow-y-auto rounded-2xl border border-white/15 bg-black/80 p-4 text-xs text-white shadow-2xl backdrop-blur pr-1">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] uppercase tracking-[0.4em] text-sky-200/80">Table Setup</span>
                  <p className="mt-1 text-[0.7rem] text-white/70">
                    Personalize the board, tokens, and arena staging.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfigOpen(false)}
                  className="rounded-full p-1 text-white/70 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                  aria-label="Close customization"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m6 6 12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>
              <div className="mt-4 flex-1 space-y-3 touch-pan-y overscroll-contain">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-[0.35em] text-white/70">Personalize Arena</p>
                  <p className="mt-1 text-[0.7rem] text-white/60">Table surfaces, tokens, and seating.</p>
                  <div className="mt-3 space-y-4">
                    {customizationSections.map(({ key, label, options }) => (
                      <div key={key} className="space-y-2">
                        <p className="text-[10px] uppercase tracking-[0.35em] text-white/60">{label}</p>
                        <div className="grid grid-cols-2 gap-2">
                          {options.map((option) => {
                            const selected = appearance[key] === option.idx;
                            const disabled = false;
                            return (
                              <button
                                key={option.id ?? option.idx}
                                type="button"
                                onClick={() => setAppearance((prev) => ({ ...prev, [key]: option.idx }))}
                                aria-pressed={selected}
                                disabled={disabled}
                                className={`flex flex-col items-center rounded-2xl border p-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                                  selected
                                    ? 'border-sky-400/80 bg-sky-400/10 shadow-[0_0_12px_rgba(56,189,248,0.35)]'
                                    : 'border-white/10 bg-white/5 hover:border-white/20'
                                } ${disabled ? 'cursor-not-allowed opacity-50 hover:border-white/10' : ''}`}
                              >
                                {renderPreview(key, option)}
                                <span className="mt-2 text-center text-[0.65rem] font-semibold text-gray-200">
                                  {option.label}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
                  <h3 className="text-[10px] uppercase tracking-[0.35em] text-sky-100/80">
                    Graphics
                  </h3>
                  <div className="mt-2 grid gap-2">
                    {FRAME_RATE_OPTIONS.map((option) => {
                      const active = option.id === frameRateId;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setFrameRateId(option.id)}
                          aria-pressed={active}
                          className={`w-full rounded-2xl border px-4 py-2 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                            active
                              ? 'border-sky-300 bg-sky-300/90 text-black shadow-[0_0_16px_rgba(125,211,252,0.45)]'
                              : 'border-white/15 bg-white/5 text-white/80 hover:bg-white/10'
                          }`}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.28em]">
                              {option.label}
                            </span>
                            <span className="text-xs font-semibold tracking-wide">
                              {option.resolution
                                ? `${option.resolution} • ${option.fps} FPS`
                                : `${option.fps} FPS`}
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
                <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-3">
                  <label className="flex items-center justify-between text-[0.7rem] text-gray-200">
                    <span>Sound effects</span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border border-emerald-400/40 bg-transparent text-emerald-400 focus:ring-emerald-500"
                      checked={soundEnabled}
                      onChange={(event) => {
                        const next = event.target.checked;
                        setSoundEnabled(next);
                        setGameMuted(!next);
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      fitRef.current?.();
                      setConfigOpen(false);
                    }}
                    className="w-full rounded-lg bg-white/10 py-2 text-center text-[0.7rem] font-semibold text-white transition hover:bg-white/20"
                  >
                    Center camera
                  </button>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="w-full rounded-lg bg-emerald-500/20 py-2 text-center text-[0.7rem] font-semibold text-emerald-200 transition hover:bg-emerald-500/30"
                  >
                    Restart game
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        <BottomLeftIcons
          className="absolute right-4 top-[5.2rem] z-20 flex flex-col items-center gap-3 pointer-events-auto"
          showInfo={false}
          showChat={false}
          showGift={false}
          order={['mute']}
          buttonClassName="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/90 shadow-[0_6px_18px_rgba(0,0,0,0.35)] backdrop-blur transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          iconClassName="h-5 w-5"
          labelClassName="sr-only"
          muteIconOn={(
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M11 5 7.5 8.5H4v7h3.5L11 19V5z" />
              <path d="M16 9.5 20 13.5" />
              <path d="M20 9.5 16 13.5" />
            </svg>
          )}
          muteIconOff={(
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M11 5 7.5 8.5H4v7h3.5L11 19V5z" />
              <path d="M15.5 8.5c1.5 1.2 2.5 2.6 2.5 4.5s-1 3.3-2.5 4.5" />
              <path d="M18.5 6.5c2.2 1.8 3.5 3.9 3.5 6.5s-1.3 4.7-3.5 6.5" />
            </svg>
          )}
        />
        <BottomLeftIcons
          className="absolute right-4 top-[8.7rem] z-20 flex flex-col items-center gap-3 pointer-events-auto"
          showInfo={false}
          showChat={false}
          showGift={false}
          showMute={false}
          showCamera2d
          camera2dActive={isCamera2d}
          onCamera2d={handleToggleCamera2d}
          order={['camera2d']}
          buttonClassName="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/90 shadow-[0_6px_18px_rgba(0,0,0,0.35)] backdrop-blur transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          iconClassName="h-5 w-5"
          labelClassName="sr-only"
        />
        <BottomLeftIcons
          onChat={() => setShowChat(true)}
          className="absolute bottom-14 left-3 z-20 flex flex-col items-center gap-3 pointer-events-auto"
          showInfo={false}
          showGift={false}
          showMute={false}
          buttonClassName="flex h-[3.15rem] w-[3.15rem] flex-col items-center justify-center gap-1 rounded-[14px] border-none bg-transparent p-0 text-white shadow-none transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          iconClassName="text-[1.35rem] leading-none"
          labelClassName="text-[0.6rem] font-extrabold uppercase tracking-[0.08em] leading-none"
          chatIcon="💬"
        />
        <BottomLeftIcons
          onGift={() => setShowGift(true)}
          className="absolute bottom-14 right-3 z-20 flex flex-col items-center gap-3 pointer-events-auto"
          showInfo={false}
          showChat={false}
          showMute={false}
          order={['gift']}
          buttonClassName="flex h-[3.15rem] w-[3.15rem] flex-col items-center justify-center gap-1 rounded-[14px] border-none bg-transparent p-0 text-white shadow-none transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          iconClassName="text-[1.35rem] leading-none"
          labelClassName="text-[0.6rem] font-extrabold uppercase tracking-[0.08em] leading-none"
          giftIcon="🎁"
        />
        <div className="absolute inset-0 z-10 pointer-events-none">
          {players.map((player) => {
            const anchor = seatAnchorMap.get(player.index);
            const fallback =
              FALLBACK_SEAT_POSITIONS[player.index] ||
              FALLBACK_SEAT_POSITIONS[FALLBACK_SEAT_POSITIONS.length - 1];
            const selfBottomOffset = player.index === 0 ? SELF_AVATAR_BOTTOM_OFFSET_PERCENT : 0;
            const positionStyle = anchor
              ? {
                  position: 'absolute',
                  left: `${anchor.x}%`,
                  top: `${anchor.y + selfBottomOffset}%`,
                  transform: 'translate(-50%, -50%)'
                }
              : {
                  position: 'absolute',
                  left: fallback.left,
                  top: `calc(${fallback.top} + ${selfBottomOffset}%)`,
                  transform: 'translate(-50%, -50%)'
                };
            const depth = anchor?.depth ?? 3;
            const avatarSize = anchor ? clamp(1.32 - (depth - 2.6) * 0.22, 0.86, 1.2) : 1;
            const isTurn = ui.turn === player.index;
            return (
              <div
                key={`ludo-seat-${player.index}`}
                className="absolute pointer-events-auto flex flex-col items-center"
                style={positionStyle}
              >
                <AvatarTimer
                  index={player.index}
                  photoUrl={player.photoUrl}
                  active={isTurn}
                  isTurn={isTurn}
                  timerPct={1}
                  name={player.name}
                  color={player.color}
                  size={avatarSize}
                />
                <span className="mt-1 text-[0.65rem] font-semibold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">
                  {player.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      {chatBubbles.map((bubble) => (
        <div key={bubble.id} className="chat-bubble">
          <span>{bubble.text}</span>
          <img src={bubble.photoUrl} alt="avatar" className="w-5 h-5 rounded-full" />
        </div>
      ))}
      <div className="pointer-events-auto">
        <InfoPopup
          open={showInfo}
          onClose={() => setShowInfo(false)}
          title="Ludo Battle Royal"
          info="Roll the dice to move your tokens around the track. Bring all four tokens home to win. Landing on an opponent sends them back to start."
        />
      </div>
      <div className="pointer-events-auto">
        <QuickMessagePopup
          open={showChat}
          onClose={() => setShowChat(false)}
          onSend={(text) => {
            const id = Date.now();
            setChatBubbles((bubbles) => [...bubbles, { id, text, photoUrl: userPhotoUrl }]);
            if (soundEnabled) {
              const audio = new Audio(chatBeep);
              audio.volume = getGameVolume();
              audio.play().catch(() => {});
            }
            setTimeout(
              () => setChatBubbles((bubbles) => bubbles.filter((bubble) => bubble.id !== id)),
              3000,
            );
          }}
        />
      </div>
      <div className="pointer-events-auto">
        <GiftPopup
          open={showGift}
          onClose={() => setShowGift(false)}
          players={players.map((player) => ({
            ...player,
            id: player.id ?? (player.isAI ? `ludo-ai-${player.index}` : resolvedAccountId),
            name: player.name
          }))}
          senderIndex={0}
          onGiftSent={({ from, to, gift }) => {
            const start = document.querySelector(`[data-player-index="${from}"]`);
            const end = document.querySelector(`[data-player-index="${to}"]`);
            if (start && end) {
              const s = start.getBoundingClientRect();
              const e = end.getBoundingClientRect();
              const cx = window.innerWidth / 2;
              const cy = window.innerHeight / 2;
              let icon;
              if (typeof gift.icon === 'string' && gift.icon.match(/\.(png|jpg|jpeg|webp|svg)$/)) {
                icon = document.createElement('img');
                icon.src = gift.icon;
                icon.className = 'w-5 h-5';
              } else {
                icon = document.createElement('div');
                icon.textContent = gift.icon;
                icon.style.fontSize = '24px';
              }
              icon.style.position = 'fixed';
              icon.style.left = '0px';
              icon.style.top = '0px';
              icon.style.pointerEvents = 'none';
              icon.style.transform = `translate(${s.left + s.width / 2}px, ${s.top + s.height / 2}px) scale(1)`;
              icon.style.zIndex = '9999';
              document.body.appendChild(icon);
              const giftSound = giftSounds[gift.id];
              if (gift.id === 'laugh_bomb' && soundEnabled) {
                giftBombSoundRef.current.currentTime = 0;
                giftBombSoundRef.current.play().catch(() => {});
                playHahaSound();
              } else if (gift.id === 'coffee_boost' && soundEnabled) {
                const audio = new Audio(giftSound);
                audio.volume = getGameVolume();
                audio.currentTime = 4;
                audio.play().catch(() => {});
                setTimeout(() => {
                  audio.pause();
                }, 4000);
              } else if (gift.id === 'baby_chick' && soundEnabled) {
                const audio = new Audio(giftSound);
                audio.volume = getGameVolume();
                audio.play().catch(() => {});
              } else if (gift.id === 'magic_trick' && soundEnabled) {
                const audio = new Audio(giftSound);
                audio.volume = getGameVolume();
                audio.play().catch(() => {});
                setTimeout(() => {
                  audio.pause();
                }, 4000);
              } else if (gift.id === 'fireworks' && soundEnabled) {
                const audio = new Audio(giftSound);
                audio.volume = getGameVolume();
                audio.play().catch(() => {});
                setTimeout(() => {
                  audio.pause();
                }, 6000);
              } else if (gift.id === 'surprise_box' && soundEnabled) {
                const audio = new Audio(giftSound);
                audio.volume = getGameVolume();
                audio.play().catch(() => {});
                setTimeout(() => {
                  audio.pause();
                }, 5000);
              } else if (gift.id === 'bullseye' && soundEnabled) {
                const audio = new Audio(giftSound);
                audio.volume = getGameVolume();
                setTimeout(() => {
                  audio.play().catch(() => {});
                }, 2500);
              } else if (giftSound && soundEnabled) {
                const audio = new Audio(giftSound);
                audio.volume = getGameVolume();
                audio.play().catch(() => {});
              }
              const animation = icon.animate(
                [
                  { transform: `translate(${s.left + s.width / 2}px, ${s.top + s.height / 2}px) scale(1)` },
                  { transform: `translate(${cx}px, ${cy}px) scale(3)`, offset: 0.5 },
                  { transform: `translate(${e.left + e.width / 2}px, ${e.top + e.height / 2}px) scale(1)` },
                ],
                { duration: 3500, easing: 'linear' },
              );
              animation.onfinish = () => icon.remove();
            }
          }}
        />
      </div>
    </div>
  );
}

async function buildLudoBoard(
  boardGroup,
  playerCount = DEFAULT_PLAYER_COUNT,
  playerColors = DEFAULT_PLAYER_COLORS,
  tokenStyleOption = TOKEN_STYLE_OPTIONS[0],
  tokenPieceByPlayer = TOKEN_PIECE_OPTIONS[0]
) {
  const scene = boardGroup;

  const lightBoardMat = cloneBoardMaterial(null, 0xfef9ef);
  const darkBoardMat = cloneBoardMaterial(null, 0xdccfb0);
  let defaultTokenTypeSequence =
    tokenStyleOption?.typeSequence?.length ? tokenStyleOption.typeSequence : TOKEN_TYPE_SEQUENCE;
  const useAbgTokens = true;
  const abgAssets = useAbgTokens ? await getAbgAssets() : null;
  const abgPrototypes = abgAssets?.proto ?? null;
  const shouldUseAbgTokens = Boolean(abgPrototypes);

  const trackTileMeshes = new Array(RING_STEPS).fill(null);
  const homeColumnTiles = Array.from({ length: playerCount }, () =>
    new Array(HOME_STEPS).fill(null)
  );

  const registerTile = (mesh) => {
    if (!mesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const mat = mesh.material;
    const baseEmissive = mat?.emissive?.clone?.() ?? new THREE.Color(0x000000);
    const baseIntensity = mat?.emissiveIntensity ?? 0;
    const baseColor = mat?.color?.clone?.() ?? new THREE.Color(0xffffff);
    const highlightColor = baseColor.clone().offsetHSL(0.01, 0.35, 0.02);
    const highlightEmissive = baseColor.clone().lerp(new THREE.Color(0xffffff), 0.72);
    mesh.userData = {
      ...mesh.userData,
      boardTile: {
        baseColor,
        highlightColor,
        baseEmissive,
        baseIntensity,
        highlightEmissive,
        highlightIntensity: Math.max(baseIntensity + 1.05, 1.12)
      }
    };
  };

  const half = (LUDO_GRID * LUDO_TILE) / 2;
  const cellToWorld = (r, c) => {
    const x = -half + (c + 0.5) * LUDO_TILE;
    const z = -half + (r + 0.5) * LUDO_TILE;
    return new THREE.Vector3(x, TILE_HALF_HEIGHT, z);
  };

  const startPads = getHomeStartPads(half, playerCount);
  const goalSlots = getGoalSlots(half, playerCount);
  const ringPath = buildRingFromGrid(cellToWorld);
  const homeColumnPositions = HOME_COLUMN_COORDS.slice(0, playerCount).map((coords) =>
    coords.map(([r, c]) => cellToWorld(r, c))
  );
  const diceRollTargets = startPads.map((pads) => {
    if (!Array.isArray(pads) || !pads.length) {
      return new THREE.Vector3(0, DICE_BASE_HEIGHT, 0);
    }
    const center = pads.reduce(
      (acc, pad) => acc.add(pad.clone()),
      new THREE.Vector3()
    );
    center.multiplyScalar(1 / pads.length);
    center.y = DICE_BASE_HEIGHT;
    return center;
  });

  const tileSize = LUDO_TILE * 0.92;
  const tileGeo = new THREE.BoxGeometry(tileSize, PLAYFIELD_HEIGHT, tileSize);
  for (let r = 0; r < LUDO_GRID; r++) {
    for (let c = 0; c < LUDO_GRID; c++) {
      const pos = cellToWorld(r, c);
      const key = `${r},${c}`;
      const homeIndex = getHomeIndex(r, c);
      const columnIndex = getHomeColumnIndex(r, c);
      const inCenter = r >= 6 && r <= 8 && c >= 6 && c <= 8;
      const inCross = (r >= 6 && r <= 8) || (c >= 6 && c <= 8);
      const inTrimmedOuter = r < 2 || r > LUDO_GRID - 3 || c < 2 || c > LUDO_GRID - 3;
      if (homeIndex !== -1) {
        continue;
      }
      if (inCenter) {
        continue;
      }
      if (columnIndex !== -1 && columnIndex < playerCount) {
        const baseColor = playerColors[columnIndex];
        const mesh = new THREE.Mesh(tileGeo, cloneBoardMaterial(darkBoardMat, baseColor));
        mesh.position.copy(pos);
        registerTile(mesh);
        const stepIndex = HOME_COLUMN_KEY_TO_STEP.get(key);
        if (stepIndex != null && homeColumnTiles[columnIndex]) {
          homeColumnTiles[columnIndex][stepIndex] = mesh;
        }
        scene.add(mesh);
        continue;
      }
      if (TRACK_KEY_SET.has(key)) {
        const isSafe = SAFE_TRACK_KEY_SET.has(key);
        const baseColor = isSafe ? 0xf4e3bd : 0xfef9ef;
        const mesh = new THREE.Mesh(tileGeo, cloneBoardMaterial(isSafe ? darkBoardMat : lightBoardMat, baseColor));
        mesh.position.copy(pos);
        registerTile(mesh);
        const trackIndex = TRACK_INDEX_BY_KEY.get(key);
        if (trackIndex != null) {
          trackTileMeshes[trackIndex] = mesh;
        }
        scene.add(mesh);
        continue;
      }
      if (inTrimmedOuter || inCross) {
        continue;
      }
    }
  }

  addCenterHome(scene, playerColors);
  addBoardMarkers(scene, cellToWorld, playerColors);

  const tokens = playerColors.slice(0, playerCount).map((color, playerIdx) => {
    const playerTokenPieceOption = Array.isArray(tokenPieceByPlayer)
      ? tokenPieceByPlayer[playerIdx]
      : tokenPieceByPlayer;
    const tokenTypeSequence = playerTokenPieceOption?.type
      ? Array(4).fill(playerTokenPieceOption.type)
      : defaultTokenTypeSequence;
    return Array.from({ length: 4 }, (_, i) => {
      const type = tokenTypeSequence[i % tokenTypeSequence.length];
      const useAbgForPlayer = shouldUseAbgTokens;
      const tokenTint = color;
      let token = null;
      if (useAbgForPlayer && abgPrototypes) {
        const colorKey = resolveAbgColorKey(playerIdx);
        const proto = resolveAbgPrototype(abgPrototypes, colorKey, type);
        token = cloneAbgToken(proto);
        if (token && tokenTint) {
          tintGltfToken(token, tokenTint);
        }
      }
      if (!token) {
        const fallbackProto =
          resolveAbgPrototype(abgPrototypes, 'w', type) ?? resolveAbgPrototype(abgPrototypes, 'w', 'p');
        token = cloneAbgToken(fallbackProto) || new THREE.Group();
        if (tokenTint) {
          tintGltfToken(token, tokenTint);
        }
      }
      token.scale.multiplyScalar(TOKEN_SIZE_MULTIPLIER);
      const typeKey = String(type || '').toLowerCase();
      const typeScale =
        TOKEN_TYPE_SCALE_PROFILE[typeKey] ??
        (typeKey === 'castle' ? TOKEN_TYPE_SCALE_PROFILE.rook : null);
      if (typeScale) {
        token.scale.set(
          token.scale.x * typeScale.x * TOKEN_THINNESS_SCALE,
          token.scale.y * typeScale.y,
          token.scale.z * typeScale.z * TOKEN_THINNESS_SCALE
        );
      }
      const label = createTokenCountLabel();
      if (label) {
        token.add(label);
        token.userData.countLabel = label;
      }
      if (!token.userData) token.userData = {};
      token.userData.tokenColor = colorNumberToHex(tokenTint ?? color);
      token.userData.tokenType = type;
      token.userData.playerIndex = playerIdx;
      token.userData.tokenIndex = i;
      token.traverse((node) => {
        if (!node.userData) node.userData = {};
        node.userData.tokenGroup = token;
        node.userData.playerIndex = playerIdx;
        node.userData.tokenIndex = i;
      });
      applyTokenFacingRotation(token);
      const homePos = startPads[playerIdx][i].clone();
      homePos.y = getTokenRailHeight(playerIdx);
      token.position.copy(homePos);
      scene.add(token);
      return token;
    });
  });

  const dice = makeDice();
  dice.userData.homeLandingTargets = diceRollTargets.map((target) => target.clone());
  dice.userData.rollTargets = diceRollTargets.map((target) => target.clone());
  const clothHalf = BOARD_CLOTH_HALF;
  const railHeight = DICE_BASE_HEIGHT;
  const diceAnchor = new THREE.Vector3(0, railHeight, 0);
  const railPositions = Array.from({ length: playerCount }, () => diceAnchor.clone());
  dice.position.copy(diceAnchor);
  dice.userData.railPositions = railPositions.map((pos) => pos.clone());
  dice.userData.baseHeight = DICE_BASE_HEIGHT;
  dice.userData.railHeight = railHeight;
  dice.userData.bounceHeight = 0.07;
  dice.userData.clothLimit = clothHalf - 0.12;
  dice.userData.isRolling = false;
  dice.userData.railPads = Array.from({ length: playerCount }, () => null);
  scene.add(dice);

  const indicatorMat = new THREE.MeshStandardMaterial({
    color: playerColors[0],
    emissive: new THREE.Color(playerColors[0]).multiplyScalar(0.3),
    emissiveIntensity: 0.9,
    metalness: 0.45,
    roughness: 0.35,
    side: THREE.DoubleSide
  });
  const turnIndicator = new THREE.Mesh(
    new THREE.RingGeometry(0.05, 0.075, 48),
    indicatorMat
  );
  turnIndicator.rotation.x = -Math.PI / 2;
  turnIndicator.position.set(0, 0.006, 0);
  scene.add(turnIndicator);

  return {
    paths: ringPath,
    startPads,
    homeColumns: homeColumnPositions,
    goalSlots,
    tokens,
    dice,
    turnIndicator,
    trackTiles: trackTileMeshes,
    homeColumnTiles
  };
}

function getHomeIndex(r, c) {
  if (r < 6 && c < 6) return 0;
  if (r < 6 && c > 8) return 1;
  if (r > 8 && c < 6) return 3;
  if (r > 8 && c > 8) return 2;
  return -1;
}

function getHomeColumnIndex(r, c) {
  const value = HOME_COLUMN_KEY_TO_PLAYER.get(keyFor(r, c));
  return value == null ? -1 : value;
}

function buildRingFromGrid(cellToWorld) {
  return TRACK_COORDS.map(([r, c]) => cellToWorld(r, c));
}

function getHomeStartPads(half, playerCount = DEFAULT_PLAYER_COUNT) {
  const count = clampPlayerCount(playerCount);
  const TILE = LUDO_TILE;
  const off = half - TILE * 3;
  const inwardPull = TILE * 0.46;
  const lateralSpread = TILE * 0.92;
  const depthSpread = TILE * 0.64;
  const layout = [
    [1, 1],
    [1, -1],
    [-1, -1],
    [-1, 1]
  ];
  return layout.slice(0, count).map(([sx, sz]) => {
    const cx = sx * off - sx * inwardPull;
    const cz = sz * off - sz * inwardPull;
    return [
      new THREE.Vector3(cx - lateralSpread, 0, cz - depthSpread),
      new THREE.Vector3(cx + lateralSpread, 0, cz - depthSpread),
      new THREE.Vector3(cx - lateralSpread, 0, cz + depthSpread),
      new THREE.Vector3(cx + lateralSpread, 0, cz + depthSpread)
    ];
  });
}

function getGoalSlots(half, playerCount = DEFAULT_PLAYER_COUNT) {
  const TILE = LUDO_TILE;
  const offsets = [
    [-TILE * 0.3, -TILE * 0.3],
    [TILE * 0.3, -TILE * 0.3],
    [-TILE * 0.3, TILE * 0.3],
    [TILE * 0.3, TILE * 0.3]
  ];
  const count = clampPlayerCount(playerCount);
  return Array.from({ length: count }, () =>
    offsets.map(([ox, oz]) => new THREE.Vector3(ox, PLAYFIELD_HEIGHT, oz))
  );
}

export default function LudoBattleRoyal() {
  useTelegramBackButton();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const avatar = params.get('avatar') || getTelegramPhotoUrl();
  const username =
    params.get('username') ||
    params.get('name') ||
    getTelegramFirstName() ||
    getTelegramUsername();
  const tableId = params.get('table') || 'royale';
  const capacityParam = parseInt(params.get('capacity') ?? '', 10);
  const aiParam = parseInt(params.get('ai') ?? '', 10);
  const parsedCapacity = clampPlayerCount(capacityParam);
  const requestedAiCount = clamp(Math.max(0, aiParam || 0), 0, DEFAULT_PLAYER_COUNT - 1);
  const playerCount = tableId === 'practice'
    ? clampPlayerCount(1 + requestedAiCount)
    : parsedCapacity;
  const flagsParam = params.get('flags');
  const mode = params.get('mode') || 'local';
  const onlineTableId = params.get('tableId') || params.get('table') || '';
  const accountIdParam = params.get('accountId') || '';

  useEffect(() => {
    if (mode !== 'online' || !onlineTableId) return undefined;

    let cancelled = false;
    let resolvedAccountId = accountIdParam.trim();

    const syncRuntime = async () => {
      if (!resolvedAccountId) {
        resolvedAccountId = (await ensureAccountId().catch(() => '')) || '';
      }
      if (cancelled || !resolvedAccountId) return;
      socket.emit('register', { playerId: resolvedAccountId });
      socket.emit('joinRoom', {
        roomId: onlineTableId,
        accountId: resolvedAccountId,
        name: username || getTelegramUsername() || 'Player',
        avatar
      });
      socket.emit('confirmReady', { accountId: resolvedAccountId, tableId: onlineTableId });
    };

    syncRuntime().catch(() => {});

    return () => {
      cancelled = true;
      if (resolvedAccountId) {
        socket.emit('leaveLobby', { accountId: resolvedAccountId, tableId: onlineTableId });
      }
    };
  }, [mode, onlineTableId, accountIdParam, username, avatar]);

  const aiFlagOverrides = useMemo(() => {
    if (!flagsParam) return null;
    const indices = flagsParam
      .split(',')
      .map((value) => parseInt(value, 10))
      .filter((idx) => Number.isFinite(idx) && idx >= 0 && idx < FLAG_EMOJIS.length);
    if (!indices.length) return null;
    return indices.map((idx) => FLAG_EMOJIS[idx]);
  }, [flagsParam]);
  return (
    <Ludo3D
      avatar={avatar}
      username={username}
      aiFlagOverrides={aiFlagOverrides}
      playerCount={playerCount}
      aiCount={tableId === 'practice' ? requestedAiCount : playerCount - 1}
    />
  );
}
