import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';

THREE.Cache.enabled = true;

const MODEL_LOAD_TIMEOUT_MS = 150000;
const TEXTURE_FETCH_TIMEOUT_MS = 90000;
const GLB_MAGIC = 0x46546c67;
const GLB_VERSION = 2;
const GLB_JSON_CHUNK = 0x4e4f534a;
const GLB_BIN_CHUNK = 0x004e4942;

const FALLBACK_PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

export const UKRAINIAN_DRONE_SOURCES = Object.freeze([
  {
    label: 'jsDelivr',
    url: 'https://cdn.jsdelivr.net/gh/srcejon/sdrangel-3d-models@main/drone.glb'
  },
  {
    label: 'raw GitHub',
    url: 'https://raw.githubusercontent.com/srcejon/sdrangel-3d-models/main/drone.glb'
  },
  {
    label: 'Statically',
    url: 'https://cdn.statically.io/gh/srcejon/sdrangel-3d-models/main/drone.glb'
  }
]);

const DRACO_DECODER_PATH = 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/';
const BASIS_TRANSCODER_PATH = 'https://threejs.org/examples/jsm/libs/basis/';
const droneTemplateCache = new Map();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isAbsoluteOrDataUrl(url) {
  return /^(https?:)?\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:');
}

function parentFolder(url) {
  return url.slice(0, url.lastIndexOf('/') + 1);
}

function normalizeResourcePath(resourceUrl) {
  try {
    return decodeURIComponent(resourceUrl).replace(/\\/g, '/').replace(/^\.\//, '');
  } catch {
    return resourceUrl.replace(/\\/g, '/').replace(/^\.\//, '');
  }
}

function resolveRelativeUrl(url, baseFolder) {
  if (isAbsoluteOrDataUrl(url)) return url;
  return new URL(normalizeResourcePath(url), baseFolder).toString();
}

function mimeFromUri(uri) {
  const clean = uri.split('?')[0].split('#')[0].toLowerCase();
  if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return 'image/jpeg';
  if (clean.endsWith('.webp')) return 'image/webp';
  if (clean.endsWith('.ktx2')) return 'image/ktx2';
  if (clean.endsWith('.basis')) return 'image/ktx2';
  if (clean.endsWith('.bin')) return 'application/octet-stream';
  return 'image/png';
}

function isLikelyHtmlBlob(blob) {
  return /text\/html|text\/plain/i.test(blob.type);
}

function toJsDelivrFromRawUrl(url) {
  const match = url.match(/^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/i);
  if (!match) return null;
  return `https://cdn.jsdelivr.net/gh/${match[1]}/${match[2]}@${match[3]}/${match[4]}`;
}

function toRawFromJsDelivrUrl(url) {
  const match = url.match(/^https:\/\/cdn\.jsdelivr\.net\/gh\/([^/]+)\/([^@/]+)@([^/]+)\/(.+)$/i);
  if (!match) return null;
  return `https://raw.githubusercontent.com/${match[1]}/${match[2]}/${match[3]}/${match[4]}`;
}

function urlAlternates(url) {
  const values = [url];
  const rawFromJsDelivr = toRawFromJsDelivrUrl(url);
  const jsFromRaw = toJsDelivrFromRawUrl(url);
  if (rawFromJsDelivr) values.push(rawFromJsDelivr);
  if (jsFromRaw) values.push(jsFromRaw);
  return Array.from(new Set(values));
}

function resourceCandidates(resourceUri, sourceUrl) {
  if (isAbsoluteOrDataUrl(resourceUri)) return urlAlternates(resourceUri);
  const base = parentFolder(sourceUrl);
  const resolved = resolveRelativeUrl(resourceUri, base);
  return urlAlternates(resolved);
}

async function fetchWithTimeout(input, init = {}, timeoutMs = TEXTURE_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

async function blobToDataUri(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Failed converting blob to data URI'));
    reader.readAsDataURL(blob);
  });
}

async function fetchAsDataUri(url, fallbackMime) {
  const response = await fetchWithTimeout(url, { mode: 'cors' }, TEXTURE_FETCH_TIMEOUT_MS);
  if (!response.ok) throw new Error(`Fetch failed ${response.status}: ${url}`);
  const blob = await response.blob();
  if (isLikelyHtmlBlob(blob)) throw new Error(`Rejected non-asset response ${blob.type || 'unknown'}: ${url}`);
  if (blob.type || !fallbackMime) return blobToDataUri(blob);
  const typedBlob = new Blob([await blob.arrayBuffer()], { type: fallbackMime });
  return blobToDataUri(typedBlob);
}

async function fetchFirstDataUri(candidates, fallbackMime) {
  let lastError = null;
  for (const candidate of candidates) {
    try {
      return await fetchAsDataUri(candidate, fallbackMime || mimeFromUri(candidate));
    } catch (error) {
      lastError = error;
      console.warn('Ukrainian drone texture candidate failed:', candidate, error);
    }
  }
  throw lastError ?? new Error('No texture candidate loaded');
}

async function fetchArrayBufferWithTimeout(url) {
  const response = await fetchWithTimeout(url, { mode: 'cors' }, MODEL_LOAD_TIMEOUT_MS);
  if (!response.ok) throw new Error(`Fetch failed ${response.status}: ${url}`);
  return response.arrayBuffer();
}

function decodeGlb(buffer) {
  const view = new DataView(buffer);
  if (view.byteLength < 20) throw new Error('GLB too small');
  if (view.getUint32(0, true) !== GLB_MAGIC) throw new Error('Not a GLB asset');
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
    if (chunkType === GLB_JSON_CHUNK) json = JSON.parse(decoder.decode(chunkBytes).trim());
    if (chunkType === GLB_BIN_CHUNK) binChunk = chunkBytes;
  }

  if (!json) throw new Error('GLB missing JSON chunk');
  return { json, binChunk };
}

function encodeGlb(json, binChunk) {
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

async function inlineExternalGlbTextures(sourceUrl) {
  const rawBuffer = await fetchArrayBufferWithTimeout(sourceUrl);
  const decoded = decodeGlb(rawBuffer);
  const images = Array.isArray(decoded.json.images) ? decoded.json.images : [];
  let changed = false;

  for (const image of images) {
    if (typeof image.uri !== 'string' || image.uri.startsWith('data:')) continue;
    const candidates = resourceCandidates(image.uri, sourceUrl);
    try {
      image.uri = await fetchFirstDataUri(candidates, image.mimeType || mimeFromUri(candidates[0]));
      image.mimeType = image.mimeType || mimeFromUri(candidates[0]);
      changed = true;
    } catch (error) {
      console.warn('Ukrainian drone external texture failed, using fallback pixel:', image.uri, error);
      image.uri = FALLBACK_PIXEL;
      image.mimeType = 'image/png';
      changed = true;
    }
  }

  return changed ? encodeGlb(decoded.json, decoded.binChunk) : rawBuffer;
}

function createTextureAwareLoader(modelUrl, renderer = null) {
  const baseFolder = parentFolder(modelUrl);
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((resourceUrl) => {
    if (!resourceUrl) return resourceUrl;
    if (resourceUrl.startsWith('data:') || resourceUrl.startsWith('blob:')) return resourceUrl;
    if (resourceUrl.startsWith('#')) return resourceUrl;
    if (isAbsoluteOrDataUrl(resourceUrl)) return resourceUrl;
    return resolveRelativeUrl(resourceUrl, baseFolder);
  });
  manager.onError = (url) => console.warn('Ukrainian drone texture/bin resource failed:', url, 'for model', modelUrl);

  const loader = new GLTFLoader(manager);
  loader.setCrossOrigin('anonymous');
  loader.setResourcePath(baseFolder);

  const draco = new DRACOLoader();
  draco.setDecoderPath(DRACO_DECODER_PATH);
  loader.setDRACOLoader(draco);
  loader.userData = { ...(loader.userData || {}), draco };

  if (renderer) {
    const ktx2 = new KTX2Loader();
    ktx2.setTranscoderPath(BASIS_TRANSCODER_PATH);
    ktx2.detectSupport(renderer);
    loader.setKTX2Loader(ktx2);
    loader.userData.ktx2 = ktx2;
  }

  return loader;
}

function disposeLoaderTranscoders(loader) {
  loader?.userData?.draco?.dispose?.();
  loader?.userData?.ktx2?.dispose?.();
}

function parseGlbBuffer(loader, buffer) {
  return new Promise((resolve, reject) => loader.parse(buffer, '', resolve, reject));
}

function loadUrlDirect(loader, url) {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('Timeout loading Ukrainian drone')), MODEL_LOAD_TIMEOUT_MS);
    loader.load(
      url,
      (loaded) => {
        window.clearTimeout(timer);
        resolve(loaded);
      },
      undefined,
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function configureTexture(texture, key, renderer = null) {
  if (key === 'map' || key === 'emissiveMap' || key === 'baseColorTexture') {
    texture.colorSpace = THREE.SRGBColorSpace;
  }
  texture.anisotropy = renderer?.capabilities?.getMaxAnisotropy?.() || texture.anisotropy || 1;
  texture.needsUpdate = true;
}

export function configureUkrainianDroneModel(model, renderer = null) {
  const stats = { meshCount: 0, materialCount: 0, textureCount: 0, missingTextureCount: 0 };

  model.traverse((obj) => {
    if (!obj?.isMesh && !obj?.isSkinnedMesh) return;
    stats.meshCount += 1;
    obj.castShadow = true;
    obj.receiveShadow = true;
    obj.frustumCulled = false;

    const materials = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
    stats.materialCount += materials.length;
    materials.forEach((material) => {
      const textureKeys = [
        'map',
        'emissiveMap',
        'normalMap',
        'roughnessMap',
        'metalnessMap',
        'aoMap',
        'alphaMap',
        'bumpMap',
        'clearcoatMap',
        'clearcoatNormalMap',
        'clearcoatRoughnessMap'
      ];
      const before = stats.textureCount;
      textureKeys.forEach((key) => {
        const texture = material[key];
        if (texture?.isTexture) {
          stats.textureCount += 1;
          configureTexture(texture, key, renderer);
        }
      });
      if (before === stats.textureCount && material.color) stats.missingTextureCount += 1;
      if ('envMapIntensity' in material && typeof material.envMapIntensity === 'number') {
        material.envMapIntensity = Math.max(material.envMapIntensity, 1.2);
      }
      material.needsUpdate = true;
    });
  });

  return stats;
}

export function normalizeUkrainianDroneObject(model, targetLength = 4.2) {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const maxLength = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(maxLength) || maxLength <= 0) return;
  model.scale.multiplyScalar(targetLength / maxLength);
  model.updateMatrixWorld(true);
  const fittedBox = new THREE.Box3().setFromObject(model);
  const center = fittedBox.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= fittedBox.min.y;
  model.updateMatrixWorld(true);
}

export function createFallbackUkrainianDrone() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: '#7b8792', roughness: 0.65, metalness: 0.2 });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#374151', roughness: 0.7, metalness: 0.12 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 2.4, 24), bodyMat);
  body.rotation.z = Math.PI / 2;
  body.position.y = 0.18;
  group.add(body);

  const wing = new THREE.Mesh(new THREE.BoxGeometry(1, 0.06, 3), bodyMat);
  wing.position.set(-0.1, 0.14, 0);
  group.add(wing);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.55, 24), bodyMat);
  nose.rotation.z = -Math.PI / 2;
  nose.position.set(1.45, 0.18, 0);
  group.add(nose);

  const prop = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.1, 0.08), darkMat);
  prop.name = 'propeller';
  prop.position.set(-1.45, 0.18, 0);
  group.add(prop);

  group.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  return group;
}

export async function loadUkrainianDroneModel(options = {}) {
  const { renderer = null, targetSize = null, allowFallback = false, report = null } = options;
  const cacheKey = `ukrainian-drone:${targetSize || 'raw'}:${Boolean(renderer)}`;
  if (!droneTemplateCache.has(cacheKey)) {
    droneTemplateCache.set(
      cacheKey,
      (async () => {
        let lastError = null;
        for (const source of UKRAINIAN_DRONE_SOURCES) {
          let loader = null;
          try {
            report?.(`Checking ${source.label} Ukrainian drone GLB + original textures...`);
            const patched = await inlineExternalGlbTextures(source.url);
            loader = createTextureAwareLoader(source.url, renderer);
            const gltf = await parseGlbBuffer(loader, patched);
            const model = gltf?.scene || gltf?.scenes?.[0] || null;
            if (!model) throw new Error('Ukrainian drone GLB had no scene');
            configureUkrainianDroneModel(model, renderer);
            if (targetSize) normalizeUkrainianDroneObject(model, targetSize);
            model.userData.ukrainianDroneSource = source.label;
            return model;
          } catch (error) {
            lastError = error;
            console.warn('Ukrainian drone preflight parse failed:', source, error);
          } finally {
            disposeLoaderTranscoders(loader);
          }

          loader = null;
          try {
            report?.(`Trying direct ${source.label} Ukrainian drone GLB loader...`);
            loader = createTextureAwareLoader(source.url, renderer);
            const gltf = await loadUrlDirect(loader, source.url);
            const model = gltf?.scene || gltf?.scenes?.[0] || null;
            if (!model) throw new Error('Ukrainian drone direct load had no scene');
            configureUkrainianDroneModel(model, renderer);
            if (targetSize) normalizeUkrainianDroneObject(model, targetSize);
            model.userData.ukrainianDroneSource = source.label;
            return model;
          } catch (error) {
            lastError = error;
            console.warn('Ukrainian drone direct load failed:', source, error);
          } finally {
            disposeLoaderTranscoders(loader);
          }
        }

        if (allowFallback) {
          const fallback = createFallbackUkrainianDrone();
          if (targetSize) normalizeUkrainianDroneObject(fallback, targetSize);
          fallback.userData.ukrainianDroneSource = 'fallback';
          return fallback;
        }
        throw lastError ?? new Error('Ukrainian drone failed from all sources');
      })()
    );
  }

  const template = await droneTemplateCache.get(cacheKey);
  const clone = template?.clone?.(true) ?? null;
  if (clone) configureUkrainianDroneModel(clone, renderer);
  return clone;
}

export function runUkrainianDroneSelfTests() {
  assert(UKRAINIAN_DRONE_SOURCES.length === 3, 'Drone must have 3 source fallbacks');
  assert(
    UKRAINIAN_DRONE_SOURCES.every((source) => /drone\.glb(\?|#|$)/i.test(source.url)),
    'Every source must point to drone.glb'
  );
  assert(
    urlAlternates('https://cdn.jsdelivr.net/gh/a/b@main/c.png').some((url) =>
      url.includes('raw.githubusercontent.com/a/b/main/c.png')
    ),
    'jsDelivr alternate must include raw GitHub URL'
  );
  assert(
    resourceCandidates('textures/a.png', UKRAINIAN_DRONE_SOURCES[0].url).some((url) => url.includes('textures/a.png')),
    'Relative texture candidate must preserve original texture path'
  );
}

runUkrainianDroneSelfTests();
