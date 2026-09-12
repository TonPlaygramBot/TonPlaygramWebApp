import {
  GAME_PACK_CACHE_PREFIX,
  findGamePack,
  loadGamePackCatalog,
  loadGamePackManifest,
  resolveGamePackAssets
} from './gamePackCatalog.js';
import { getNetworkFetch } from './gamePackFetchInterceptor.js';

const INSTALL_STATE_KEY = 'tonplaygram-game-pack-installs-v1';
const CHANGE_EVENT = 'tonplaygram-game-packs-changed';
const PROGRESS_EVENT = 'tonplaygram-game-pack-progress';
const MAX_HASH_BYTES = 24 * 1024 * 1024;
const DEFAULT_CONCURRENCY = 3;
const activeInstalls = new Map();

const safePackId = value => String(value || '').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();

export const formatBytes = value => {
  const bytes = Number(value) || 0;
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const amount = bytes / 1024 ** index;
  return `${amount >= 100 || index === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[index]}`;
};

export const getPackCacheName = (packId, version) =>
  `${GAME_PACK_CACHE_PREFIX}${safePackId(packId)}-${safePackId(version || 'unknown')}`;

const getLocalStorage = () => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
};

const readState = () => {
  const storage = getLocalStorage();
  if (!storage) return { schemaVersion: 1, packs: {} };
  try {
    const parsed = JSON.parse(storage.getItem(INSTALL_STATE_KEY) || '{}');
    return {
      schemaVersion: 1,
      packs: parsed && typeof parsed.packs === 'object' ? parsed.packs : {}
    };
  } catch {
    return { schemaVersion: 1, packs: {} };
  }
};

const writeState = state => {
  const storage = getLocalStorage();
  if (!storage) return;
  storage.setItem(INSTALL_STATE_KEY, JSON.stringify({ schemaVersion: 1, packs: state.packs || {} }));
};

const updatePackState = (packId, patch) => {
  const state = readState();
  const previous = state.packs[packId] || {};
  state.packs[packId] = { ...previous, ...patch };
  writeState(state);
  return state.packs[packId];
};

const removePackState = packId => {
  const state = readState();
  delete state.packs[packId];
  writeState(state);
};

const dispatch = (name, detail) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }
};

const dispatchChanged = detail => dispatch(CHANGE_EVENT, detail);
const dispatchProgress = detail => dispatch(PROGRESS_EVENT, detail);

export const getGamePackInstallations = () => ({ ...readState().packs });

export async function reconcileGamePackInstallations() {
  const state = readState();
  if (!isGamePackStorageSupported()) return { ...state.packs };
  let changed = false;
  const cacheNames = new Set(await caches.keys());
  for (const [packId, installation] of Object.entries(state.packs)) {
    if (installation?.status !== 'installed') continue;
    if (installation.cacheName && cacheNames.has(installation.cacheName)) continue;
    state.packs[packId] = {
      ...installation,
      status: 'partial',
      lastError: 'Downloaded files were removed by the device. Resume the download.',
      updatedAt: new Date().toISOString()
    };
    changed = true;
  }
  if (changed) writeState(state);
  return { ...state.packs };
}

export const getGamePackStatus = (pack, installation = readState().packs[pack?.id]) => {
  if (!pack) return 'unavailable';
  if (activeInstalls.has(pack.id)) return 'downloading';
  if (!installation) return 'not-installed';
  if (installation.status === 'partial' || installation.status === 'failed') return installation.status;
  if (installation.status === 'installed' && installation.version !== pack.version) return 'update-available';
  if (installation.status === 'installed') return 'installed';
  return installation.status || 'not-installed';
};

export const isGamePackStorageSupported = () =>
  typeof window !== 'undefined' && typeof caches !== 'undefined' && typeof caches.open === 'function';

export async function requestPersistentGamePackStorage() {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function getGamePackStorageEstimate() {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
    return { usage: 0, quota: 0, persisted: false };
  }
  try {
    const [{ usage = 0, quota = 0 }, persisted] = await Promise.all([
      navigator.storage.estimate(),
      navigator.storage?.persisted ? navigator.storage.persisted().catch(() => false) : false
    ]);
    return { usage, quota, persisted: Boolean(persisted) };
  } catch {
    return { usage: 0, quota: 0, persisted: false };
  }
}

const makeRequest = asset => {
  const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
  return new Request(new URL(asset.url, base).toString(), {
    method: 'GET',
    credentials: 'same-origin'
  });
};

const responseMatchesAsset = (response, asset) => {
  if (!response) return false;
  const storedHash = response.headers.get('X-TonPlaygram-Asset-Sha256');
  const storedSize = Number(response.headers.get('X-TonPlaygram-Asset-Size') || 0);
  if (asset.sha256) return storedHash === asset.sha256;
  if (asset.size && storedSize) return storedSize === asset.size;
  return response.ok;
};

const withPackHeaders = (headers, pack, asset, actualSize) => {
  const next = new Headers(headers || {});
  // Fetch exposes decoded response bodies. Do not persist transport encoding or
  // compressed byte lengths alongside the decoded cached bytes.
  next.delete('content-encoding');
  next.delete('content-length');
  next.delete('transfer-encoding');
  next.set('X-TonPlaygram-Pack-Id', pack.id);
  next.set('X-TonPlaygram-Pack-Version', pack.version);
  next.set('X-TonPlaygram-Asset-Size', String(asset.size || actualSize || 0));
  if (asset.sha256) next.set('X-TonPlaygram-Asset-Sha256', asset.sha256);
  return next;
};

const digestSha256 = async buffer => {
  if (!globalThis.crypto?.subtle) return null;
  const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
};

async function consumeStream(stream, onChunk) {
  if (!stream?.getReader) return 0;
  const reader = stream.getReader();
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const size = value?.byteLength || 0;
    total += size;
    onChunk?.(size);
  }
  return total;
}

async function findReusableResponse(request, asset, targetCacheName) {
  const cacheNames = await caches.keys();
  for (const cacheName of cacheNames) {
    if (!cacheName.startsWith(GAME_PACK_CACHE_PREFIX) || cacheName === targetCacheName) continue;
    const cache = await caches.open(cacheName);
    const response = await cache.match(request, { ignoreVary: true });
    if (responseMatchesAsset(response, asset)) return response;
  }
  return null;
}

async function downloadAsset({ pack, asset, cache, cacheName, signal, onBytes }) {
  const request = makeRequest(asset);
  const existing = await cache.match(request, { ignoreVary: true });
  if (responseMatchesAsset(existing, asset)) {
    return { bytes: asset.size || Number(existing.headers.get('X-TonPlaygram-Asset-Size')) || 0, reused: true };
  }

  const reusable = await findReusableResponse(request, asset, cacheName);
  if (reusable) {
    await cache.put(request, reusable.clone());
    return { bytes: asset.size || Number(reusable.headers.get('X-TonPlaygram-Asset-Size')) || 0, reused: true };
  }

  const networkFetch = getNetworkFetch();
  if (!networkFetch) throw new Error('Network downloads are unavailable.');
  const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
  const sourceUrl = new URL(asset.sourceUrl || asset.url, base).toString();
  const sameOrigin = new URL(sourceUrl).origin === new URL(base).origin;
  const response = await networkFetch(sourceUrl, {
    method: 'GET',
    cache: 'no-store',
    credentials: sameOrigin ? 'same-origin' : 'omit',
    mode: sameOrigin ? 'same-origin' : 'cors',
    signal
  });

  if (!response.ok) throw new Error(`Download failed for ${asset.url} (${response.status}).`);
  const contentLength = Number(response.headers.get('content-length') || 0);
  const contentEncoding = response.headers.get('content-encoding');
  if (asset.size && contentLength && !contentEncoding && asset.size !== contentLength) {
    throw new Error(`Size mismatch for ${asset.url}.`);
  }

  const expectedSize = asset.size || (!contentEncoding ? contentLength : 0);
  if (asset.sha256 && expectedSize > 0 && expectedSize <= MAX_HASH_BYTES) {
    const buffer = await response.arrayBuffer();
    const actualHash = await digestSha256(buffer);
    if (actualHash && actualHash !== asset.sha256) {
      throw new Error(`Integrity check failed for ${asset.url}.`);
    }
    if (asset.size && buffer.byteLength !== asset.size) {
      throw new Error(`Size mismatch for ${asset.url}.`);
    }
    onBytes?.(buffer.byteLength);
    const headers = withPackHeaders(response.headers, pack, asset, buffer.byteLength);
    await cache.put(
      request,
      new Response(buffer, { status: response.status, statusText: response.statusText, headers })
    );
    return { bytes: buffer.byteLength, reused: false };
  }

  if (!response.body?.tee) {
    const buffer = await response.arrayBuffer();
    onBytes?.(buffer.byteLength);
    const headers = withPackHeaders(response.headers, pack, asset, buffer.byteLength);
    await cache.put(
      request,
      new Response(buffer, { status: response.status, statusText: response.statusText, headers })
    );
    return { bytes: buffer.byteLength, reused: false };
  }

  const [cacheBody, progressBody] = response.body.tee();
  const headers = withPackHeaders(response.headers, pack, asset, expectedSize);
  const cacheResponse = new Response(cacheBody, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
  const [actualSize] = await Promise.all([
    consumeStream(progressBody, onBytes),
    cache.put(request, cacheResponse)
  ]);
  if (asset.size && actualSize !== asset.size) {
    await cache.delete(request);
    throw new Error(`Size mismatch for ${asset.url}.`);
  }
  return { bytes: actualSize || expectedSize, reused: false };
}

async function clearRuntimeCopies(assets) {
  const runtimeCacheNames = (await caches.keys()).filter(name => name.startsWith('tonplaygram-runtime-'));
  if (!runtimeCacheNames.length || !assets?.length) return;
  const requests = assets.map(makeRequest);
  for (const cacheName of runtimeCacheNames) {
    const cache = await caches.open(cacheName);
    for (let index = 0; index < requests.length; index += 40) {
      await Promise.all(requests.slice(index, index + 40).map(request => cache.delete(request)));
    }
  }
}

async function deleteOldPackCaches(packId, keepCacheName) {
  const prefix = `${GAME_PACK_CACHE_PREFIX}${safePackId(packId)}-`;
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter(name => name.startsWith(prefix) && name !== keepCacheName)
      .map(name => caches.delete(name))
  );
}

async function performInstall(packId, { catalog, concurrency = DEFAULT_CONCURRENCY, signal } = {}) {
  if (!isGamePackStorageSupported()) {
    throw new Error('Game-pack storage is not supported on this device.');
  }

  const resolvedCatalog = catalog || (await loadGamePackCatalog());
  const catalogPack = findGamePack(resolvedCatalog, packId);
  if (!catalogPack) throw new Error(`Unknown game pack: ${packId}`);

  for (const dependencyId of catalogPack.dependencies || []) {
    const dependency = findGamePack(resolvedCatalog, dependencyId);
    const dependencyState = readState().packs[dependencyId];
    if (dependency && getGamePackStatus(dependency, dependencyState) !== 'installed') {
      await installGamePack(dependencyId, {
        catalog: resolvedCatalog,
        concurrency,
        signal
      });
    }
  }

  const manifest = await loadGamePackManifest(catalogPack, { fetchImpl: getNetworkFetch() });
  const assets = await resolveGamePackAssets(manifest, { fetchImpl: getNetworkFetch() });
  if (!assets.length) throw new Error(`The ${catalogPack.title} pack has no downloadable assets.`);

  const pack = {
    ...catalogPack,
    version: manifest.version || catalogPack.version,
    dependencies: manifest.dependencies || catalogPack.dependencies || []
  };
  const cacheName = getPackCacheName(pack.id, pack.version);
  const cache = await caches.open(cacheName);
  const totalBytes = assets.reduce((sum, asset) => sum + (asset.size || 0), 0);
  let completedAssets = 0;
  let downloadedBytes = 0;
  let reusedBytes = 0;
  let lastProgressAt = 0;

  const emitProgress = (phase, currentAsset = null, force = false) => {
    const now = Date.now();
    if (!force && now - lastProgressAt < 100) return;
    lastProgressAt = now;
    const assetRatio = assets.length ? completedAssets / assets.length : 0;
    const byteRatio = totalBytes ? Math.min(1, (downloadedBytes + reusedBytes) / totalBytes) : 0;
    dispatchProgress({
      packId: pack.id,
      phase,
      currentAsset,
      completedAssets,
      totalAssets: assets.length,
      downloadedBytes,
      reusedBytes,
      totalBytes,
      percent: Math.round((totalBytes ? byteRatio : assetRatio) * 100)
    });
  };

  updatePackState(pack.id, {
    status: 'partial',
    version: pack.version,
    cacheName,
    title: pack.title,
    assetCount: assets.length,
    totalBytes,
    updatedAt: new Date().toISOString(),
    lastError: null
  });
  dispatchChanged({ packId: pack.id, status: 'partial' });
  emitProgress('preparing', null, true);

  let cursor = 0;
  const worker = async () => {
    while (cursor < assets.length) {
      if (signal?.aborted) throw new DOMException('Download cancelled.', 'AbortError');
      const index = cursor++;
      const asset = assets[index];
      emitProgress('downloading', asset.url, true);
      const result = await downloadAsset({
        pack,
        asset,
        cache,
        cacheName,
        signal,
        onBytes: size => {
          downloadedBytes += size;
          emitProgress('downloading', asset.url);
        }
      });
      if (result.reused) reusedBytes += result.bytes || 0;
      completedAssets += 1;
      emitProgress('downloading', asset.url, true);
    }
  };

  try {
    const workerCount = Math.max(1, Math.min(Number(concurrency) || DEFAULT_CONCURRENCY, assets.length));
    await Promise.all(Array.from({ length: workerCount }, worker));

    const installation = updatePackState(pack.id, {
      status: 'installed',
      version: pack.version,
      cacheName,
      title: pack.title,
      assetCount: assets.length,
      totalBytes: totalBytes || downloadedBytes + reusedBytes,
      downloadedBytes,
      reusedBytes,
      installedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastError: null,
      dependencies: pack.dependencies
    });
    await deleteOldPackCaches(pack.id, cacheName);
    await clearRuntimeCopies(assets);
    emitProgress('complete', null, true);
    dispatchChanged({ packId: pack.id, status: 'installed', installation });
    return installation;
  } catch (error) {
    const cancelled = error?.name === 'AbortError';
    const installation = updatePackState(pack.id, {
      status: 'partial',
      version: pack.version,
      cacheName,
      title: pack.title,
      assetCount: assets.length,
      totalBytes,
      downloadedBytes,
      reusedBytes,
      updatedAt: new Date().toISOString(),
      lastError: cancelled ? null : error?.message || 'Download failed.'
    });
    emitProgress(cancelled ? 'cancelled' : 'failed', null, true);
    dispatchChanged({ packId: pack.id, status: installation.status, error: installation.lastError });
    throw error;
  }
}

export function installGamePack(packId, options = {}) {
  if (activeInstalls.has(packId)) return activeInstalls.get(packId).promise;
  const controller = new AbortController();
  const externalSignal = options.signal;
  const abortFromExternal = () => controller.abort();
  externalSignal?.addEventListener?.('abort', abortFromExternal, { once: true });

  const promise = requestPersistentGamePackStorage()
    .catch(() => false)
    .then(() => performInstall(packId, { ...options, signal: controller.signal }))
    .finally(() => {
      externalSignal?.removeEventListener?.('abort', abortFromExternal);
      activeInstalls.delete(packId);
    });

  activeInstalls.set(packId, { controller, promise });
  return promise;
}

export function cancelGamePackInstall(packId) {
  const active = activeInstalls.get(packId);
  if (!active) return false;
  active.controller.abort();
  return true;
}

const isDependencyUsed = (catalog, dependencyId, state, excludingPackId) =>
  catalog.packs.some(pack => {
    if (pack.id === excludingPackId || !state.packs[pack.id]) return false;
    return state.packs[pack.id].status === 'installed' && (pack.dependencies || []).includes(dependencyId);
  });

export async function removeGamePack(packId, { catalog, removeUnusedDependencies = true } = {}) {
  cancelGamePackInstall(packId);
  if (!isGamePackStorageSupported()) {
    removePackState(packId);
    dispatchChanged({ packId, status: 'not-installed' });
    return;
  }

  const resolvedCatalog = catalog || (await loadGamePackCatalog());
  const pack = findGamePack(resolvedCatalog, packId);
  let packAssets = [];
  if (pack) {
    try {
      const manifest = await loadGamePackManifest(pack, { fetchImpl: getNetworkFetch() });
      packAssets = await resolveGamePackAssets(manifest, { fetchImpl: getNetworkFetch() });
    } catch {
      // Cache removal still proceeds when the catalog is temporarily unavailable.
    }
  }
  const prefix = `${GAME_PACK_CACHE_PREFIX}${safePackId(packId)}-`;
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.filter(name => name.startsWith(prefix)).map(name => caches.delete(name)));
  await clearRuntimeCopies(packAssets);
  removePackState(packId);

  if (removeUnusedDependencies && pack) {
    const state = readState();
    for (const dependencyId of pack.dependencies || []) {
      const dependency = findGamePack(resolvedCatalog, dependencyId);
      if (dependency?.hidden && !isDependencyUsed(resolvedCatalog, dependencyId, state, packId)) {
        await removeGamePack(dependencyId, {
          catalog: resolvedCatalog,
          removeUnusedDependencies: false
        });
      }
    }
  }

  dispatchChanged({ packId, status: 'not-installed' });
}

export const isGamePackDownloadActive = packId => activeInstalls.has(packId);
export const GAME_PACK_CHANGE_EVENT = CHANGE_EVENT;
export const GAME_PACK_PROGRESS_EVENT = PROGRESS_EVENT;
