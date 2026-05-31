import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

THREE.Cache.enabled = true;

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

const MODEL_LOAD_TIMEOUT_MS = 150000;
const TEXTURE_FETCH_TIMEOUT_MS = 90000;
const GLB_MAGIC = 0x46546c67;
const GLB_VERSION = 2;
const GLB_JSON_CHUNK = 0x4e4f534a;
const GLB_BIN_CHUNK = 0x004e4942;
const FALLBACK_PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

let sharedDronePromise = null;
let sharedKtx2Loader = null;

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
  if (clean.endsWith('.ktx2') || clean.endsWith('.basis')) return 'image/ktx2';
  if (clean.endsWith('.bin')) return 'application/octet-stream';
  return 'image/png';
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
  const resolved = resolveRelativeUrl(resourceUri, parentFolder(sourceUrl));
  return urlAlternates(resolved);
}

function installUkrainianDroneImageFallback() {
  const originalLoad = THREE.ImageLoader.prototype.load;
  THREE.ImageLoader.prototype.load = function patchedUkrainianDroneImageLoad(url, onLoad, onProgress, onError) {
    const candidates = urlAlternates(String(url));
    let index = 0;
    const tryLoad = () => {
      const candidate = candidates[index] ?? FALLBACK_PIXEL;
      return originalLoad.call(this, candidate, onLoad, onProgress, (event) => {
        index += 1;
        if (index < candidates.length) {
          window.setTimeout(tryLoad, 250);
          return;
        }
        console.warn('Ukrainian drone ImageLoader failed all original candidates, using fallback pixel:', candidates, event);
        const img = document.createElement('img');
        img.crossOrigin = 'anonymous';
        img.onload = () => onLoad?.(img);
        img.onerror = () => onError?.(event);
        img.src = FALLBACK_PIXEL;
      });
    };
    return tryLoad();
  };
  return () => {
    THREE.ImageLoader.prototype.load = originalLoad;
  };
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
  if (/text\/html|text\/plain/i.test(blob.type || '')) {
    throw new Error(`Rejected non-asset response ${blob.type || 'unknown'}: ${url}`);
  }
  if (blob.type || !fallbackMime) return blobToDataUri(blob);
  return blobToDataUri(new Blob([await blob.arrayBuffer()], { type: fallbackMime }));
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
  throw lastError ?? new Error('No Ukrainian drone texture candidate loaded');
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
    } catch (error) {
      console.warn('Ukrainian drone external texture failed, using fallback pixel:', image.uri, error);
      image.uri = FALLBACK_PIXEL;
      image.mimeType = 'image/png';
    }
    changed = true;
  }
  return changed ? encodeGlb(decoded.json, decoded.binChunk) : rawBuffer;
}

function getSharedKtx2Loader(renderer) {
  if (!sharedKtx2Loader) {
    sharedKtx2Loader = new KTX2Loader();
    sharedKtx2Loader.setTranscoderPath('https://threejs.org/examples/jsm/libs/basis/');
  }
  if (renderer) {
    try {
      sharedKtx2Loader.detectSupport(renderer);
    } catch (error) {
      console.warn('Ukrainian drone KTX2 support detection failed', error);
    }
  }
  return sharedKtx2Loader;
}

function createTextureAwareLoader(modelUrl, renderer = null) {
  const baseFolder = parentFolder(modelUrl);
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((resourceUrl) => {
    if (!resourceUrl || resourceUrl.startsWith('data:') || resourceUrl.startsWith('blob:') || resourceUrl.startsWith('#')) return resourceUrl;
    if (isAbsoluteOrDataUrl(resourceUrl)) return resourceUrl;
    return resolveRelativeUrl(resourceUrl, baseFolder);
  });
  manager.onError = (url) => console.warn('Ukrainian drone texture/bin resource failed:', url, 'for model', modelUrl);
  const loader = new GLTFLoader(manager);
  loader.setCrossOrigin('anonymous');
  loader.setResourcePath(baseFolder);
  loader.setMeshoptDecoder(MeshoptDecoder);
  const draco = new DRACOLoader();
  draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
  loader.setDRACOLoader(draco);
  loader.setKTX2Loader(getSharedKtx2Loader(renderer));
  return loader;
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
  if (key === 'map' || key === 'emissiveMap' || key === 'baseColorTexture') texture.colorSpace = THREE.SRGBColorSpace;
  const maxAnisotropy = renderer?.capabilities?.getMaxAnisotropy?.() || 8;
  texture.anisotropy = Math.max(texture.anisotropy || 1, maxAnisotropy);
  texture.needsUpdate = true;
}

function configureUkrainianDroneModel(model, renderer = null) {
  model.userData = { ...(model.userData || {}), exactUkrainianDroneModel: true };
  model.traverse((obj) => {
    obj.userData = { ...(obj.userData || {}), exactUkrainianDroneModel: true };
    if (!obj.isMesh && !obj.isSkinnedMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;
    obj.frustumCulled = false;
    const materials = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
    materials.forEach((material) => {
      ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'alphaMap', 'bumpMap', 'clearcoatMap', 'clearcoatNormalMap', 'clearcoatRoughnessMap'].forEach((key) => {
        if (material?.[key]?.isTexture) configureTexture(material[key], key, renderer);
      });
      if (material && 'envMapIntensity' in material && typeof material.envMapIntensity === 'number') {
        material.envMapIntensity = Math.max(material.envMapIntensity, 1.2);
      }
      if (material) material.needsUpdate = true;
    });
  });
  return model;
}

async function loadSharedUkrainianDrone(renderer = null) {
  if (!sharedDronePromise) {
    sharedDronePromise = (async () => {
      let lastError = null;
      const restoreImageLoader = installUkrainianDroneImageFallback();
      try {
        for (const source of UKRAINIAN_DRONE_SOURCES) {
          try {
            const patched = await inlineExternalGlbTextures(source.url);
            const loader = createTextureAwareLoader(source.url, renderer);
            const gltf = await parseGlbBuffer(loader, patched);
            return configureUkrainianDroneModel(gltf.scene, renderer);
          } catch (error) {
            lastError = error;
            console.warn('Ukrainian drone preflight parse failed:', source, error);
          }
          try {
            const loader = createTextureAwareLoader(source.url, renderer);
            const gltf = await loadUrlDirect(loader, source.url);
            return configureUkrainianDroneModel(gltf.scene, renderer);
          } catch (error) {
            lastError = error;
            console.warn('Ukrainian drone direct load failed:', source, error);
          }
        }
        throw lastError ?? new Error('Ukrainian drone failed from all sources');
      } finally {
        restoreImageLoader();
      }
    })();
  }
  return sharedDronePromise;
}

export function isExactUkrainianDroneObject(root) {
  if (!root) return false;
  if (root.userData?.exactUkrainianDroneModel) return true;
  let found = false;
  root.traverse?.((node) => {
    if (node.userData?.exactUkrainianDroneModel) found = true;
  });
  return found;
}

export async function loadExactUkrainianDroneModel(renderer = null) {
  const template = await loadSharedUkrainianDrone(renderer);
  const model = cloneSkeleton(template);
  configureUkrainianDroneModel(model, renderer);
  return model;
}

export function findExactUkrainianDroneRotor(root) {
  let fallback = null;
  root?.traverse?.((node) => {
    const name = `${node.name || ''}`.toLowerCase();
    if (!fallback && /propell|rotor|blade|fan|motor/.test(name)) fallback = node;
  });
  return fallback;
}
