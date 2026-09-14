import {
  GAME_PACK_CACHE_PREFIX,
  GAME_PACK_COMPLETE_PATH,
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
const DOWNLOAD_INACTIVITY_MS = 120000;
const activeInstalls = new Map();
const APP_PACK_ID = 'tonplaygram-app';
const completionRequest = () => new Request(new URL(GAME_PACK_COMPLETE_PATH, window.location.origin));
const checkCancelled = signal => {
  if (signal?.aborted) throw new DOMException('Download cancelled.', 'AbortError');
};

const safePackId = value => String(value || '').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();

export const GAME_PACK_STORAGE_ERROR_MESSAGE = 'This browser could not save more app files. Its storage limit can differ from your device’s free space. Free space for this browser, then retry; verified files already saved will be reused.';

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

async function cacheIsComplete(installation,cacheNames,{verifyAssets=true}={}) {
  if(!installation?.cacheName||!cacheNames.has(installation.cacheName))return false;
  const cache=await caches.open(installation.cacheName);
  const marker=await cache.match(completionRequest());
  if(!marker)return false;
  let receipt;try{receipt=await marker.json();}catch{return false;}
  if(!receipt||typeof receipt.version!=='string'||!receipt.version||receipt.version!==installation.version||
    !Number.isInteger(installation.assetCount)||installation.assetCount<=0||
    !Array.isArray(receipt.assets)||receipt.assets.length!==installation.assetCount||
    receipt.assets.some(asset=>!asset||typeof asset.url!=='string'||!asset.url.trim()))return false;
  // Routine Home/route checks read the durable completion receipt, not thousands
  // of files. Installation and explicit update checks still audit every asset.
  if(!verifyAssets)return true;
  // Counting entries alone can hide missing files behind stale or unrelated ones.
  for(let i=0;i<receipt.assets.length;i+=32){
    const valid=await Promise.all(receipt.assets.slice(i,i+32).map(async asset=>responseMatchesAsset(await cache.match(makeRequest(asset)),asset)));
    if(valid.some(value=>!value))return false;
  }
  return true;
}
export async function reconcileGamePackInstallations({verifyAssets=true}={}) {
  const state = readState();
  if (!isGamePackStorageSupported()) return { ...state.packs };
  const cacheNames = new Set(await caches.keys());
  const invalid=new Set();
  for (const [id, installation] of Object.entries(state.packs)) {
    if(installation?.status==='installed'&&!await cacheIsComplete(installation,cacheNames,{verifyAssets}))invalid.add(id);
  }
  // Invalidate dependants transitively, irrespective of object iteration order.
  let grew=true;while(grew){grew=false;for(const [id,p]of Object.entries(state.packs)){
    if(p.status==='installed'&&!invalid.has(id)&&(p.dependencies||[]).some(dep=>invalid.has(dep)||state.packs[dep]?.status!=='installed')){invalid.add(id);grew=true;}
  }}
  for(const id of invalid){
    const installation=state.packs[id];
    // A parallel install/remove may have changed state during the cache audit.
    const unchanged=()=>{const current=readState().packs[id];return current?.status==='installed'&&current.cacheName===installation.cacheName&&current.updatedAt===installation.updatedAt;};
    if(!unchanged())continue;
    if(cacheNames.has(installation.cacheName))await (await caches.open(installation.cacheName)).delete(completionRequest());
    if(unchanged())updatePackState(id,{status:'partial',lastError:'Some game files are missing from this device. Resume the download.',updatedAt:new Date().toISOString()});
  }
  return {...readState().packs};
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

async function consumeStream(stream, onChunk, signal) {
  if (!stream?.getReader) return 0;
  const reader = stream.getReader();
  // Cancelling the reader also wakes a pending read if a transport does not
  // propagate the fetch signal to its response body.
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener('abort', abort, { once: true });
  let total = 0;
  try {
    while (true) {
      checkCancelled(signal);
      const { done, value } = await reader.read();
      checkCancelled(signal);
      if (done) break;
      total += value?.byteLength || 0;
      onChunk?.(value);
    }
    return total;
  } catch (error) {
    abort();
    throw error;
  } finally {
    signal?.removeEventListener('abort', abort);
    reader.releaseLock();
  }
}

async function readDownloadBuffer(response, { asset, expectedSize, signal, onBytes, onActivity, onNetworkComplete }) {
  if (!response.body?.getReader) {
    const buffer = await response.arrayBuffer();
    onNetworkComplete();
    checkCancelled(signal);
    onBytes?.(buffer.byteLength);
    return buffer;
  }
  // Full-app manifests provide every decoded size. Allocate once instead of
  // retaining hundreds of megabytes of chunks and then copying them together.
  const bytes = expectedSize === undefined ? null : new Uint8Array(expectedSize);
  const chunks = bytes ? null : [];
  let offset = 0;
  try {
    await consumeStream(response.body, chunk => {
      const size = chunk?.byteLength || 0;
      if (!size) return;
      onActivity();
      if (bytes) {
        if (offset + size > bytes.byteLength) throw new Error(`Size mismatch for ${asset.url}.`);
        bytes.set(chunk, offset);
      } else {
        chunks.push(chunk);
      }
      offset += size;
      onBytes?.(size);
    }, signal);
  } finally {
    // Hashing and writing a large file are local work, not stalled networking.
    onNetworkComplete();
  }
  if (bytes) {
    if (offset !== bytes.byteLength) throw new Error(`Size mismatch for ${asset.url}.`);
    return bytes;
  }
  const result = new Uint8Array(offset);
  let cursor = 0;
  for (const chunk of chunks) { result.set(chunk, cursor); cursor += chunk.byteLength; }
  return result;
}

const responseFromBuffer = (buffer, init) => new Response(
  // Response(ArrayBuffer) copies its input. Feed the verified bytes directly to
  // Cache Storage so a large texture does not need another whole JS buffer.
  typeof ReadableStream === 'function' ? new ReadableStream({
    start(controller) {
      controller.enqueue(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer));
      controller.close();
    }
  }) : buffer,
  init
);

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

async function downloadAsset(options) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  let timedOut = false;
  let timer;
  const clearInactivityTimer = () => clearTimeout(timer);
  const recordActivity = () => {
    clearInactivityTimer();
    timer = setTimeout(() => { timedOut = true; controller.abort(); }, DOWNLOAD_INACTIVITY_MS);
  };
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) abort();
  try {
    return await downloadAssetBytes({
      ...options,
      signal: controller.signal,
      onActivity: recordActivity,
      onNetworkComplete: clearInactivityTimer
    });
  } catch (error) {
    controller.abort();
    if (timedOut) throw new Error('The connection stopped responding. Resume the download to keep the files already saved.');
    throw error;
  } finally {
    clearInactivityTimer();
    options.signal?.removeEventListener('abort', abort);
  }
}

async function downloadAssetBytes({ pack, asset, cache, cacheName, signal, onBytes, onActivity, onNetworkComplete }) {
  checkCancelled(signal);
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
  const originalSource = new URL(asset.sourceUrl || asset.url, base).toString();
  const externalAssets = globalThis.__TONPLAYGRAM_EXTERNAL_ASSETS__ || {};
  // Fetch also maps imported CDN assets to local files. Classify the resolved
  // target first so verification requests bypass the worker's local caches.
  const mappedSource = externalAssets[originalSource] || externalAssets[originalSource.replace(/#.*$/, '')];
  const sourceUrl = new URL(mappedSource || originalSource, base).toString();
  const sameOrigin = new URL(sourceUrl).origin === new URL(base).origin;
  checkCancelled(signal);
  onActivity();
  const response = await networkFetch(sourceUrl, {
    method: 'GET',
    cache: 'no-store',
    credentials: sameOrigin ? 'same-origin' : 'omit',
    mode: sameOrigin ? 'same-origin' : 'cors',
    ...(sameOrigin ? { headers: { 'X-TonPlaygram-Verify': '1' } } : {}),
    signal
  });

  checkCancelled(signal);
  onActivity();
  if (!response.ok) throw new Error(`Download failed for ${asset.url} (${response.status}).`);
  if (/text\/html/i.test(response.headers.get('content-type') || '') && !/\.html(?:[?#]|$)/i.test(asset.url)) {
    throw new Error(`The server returned a page instead of ${asset.url}. Please check for game updates.`);
  }
  const contentLength = Number(response.headers.get('content-length') || 0);
  const contentEncoding = response.headers.get('content-encoding');
  if (asset.size && contentLength && !contentEncoding && asset.size !== contentLength) {
    throw new Error(`Size mismatch for ${asset.url}.`);
  }

  const expectedSize = asset.size || (!contentEncoding ? contentLength : 0);
  if (asset.sha256 && (pack.id === APP_PACK_ID || (expectedSize > 0 && expectedSize <= MAX_HASH_BYTES))) {
    const buffer = await readDownloadBuffer(response, {
      asset, expectedSize: pack.id === APP_PACK_ID ? asset.size : expectedSize || undefined,
      signal, onBytes, onActivity, onNetworkComplete
    });
    checkCancelled(signal);
    const actualHash = await digestSha256(buffer);
    checkCancelled(signal);
    if ((!actualHash && pack.id === APP_PACK_ID) || (actualHash && actualHash !== asset.sha256)) {
      throw new Error(`Integrity check failed for ${asset.url}.`);
    }
    if (asset.size && buffer.byteLength !== asset.size) {
      throw new Error(`Size mismatch for ${asset.url}.`);
    }
    const headers = withPackHeaders(response.headers, pack, asset, buffer.byteLength);
    await cache.put(
      request,
      responseFromBuffer(buffer, { status: response.status, statusText: response.statusText, headers })
    );
    return { bytes: buffer.byteLength, reused: false };
  }

  if (!response.body?.tee) {
    const buffer = await readDownloadBuffer(response, {
      asset, expectedSize: expectedSize || undefined, signal, onBytes, onActivity, onNetworkComplete
    });
    if (asset.size && buffer.byteLength !== asset.size) throw new Error(`Size mismatch for ${asset.url}.`);
    const headers = withPackHeaders(response.headers, pack, asset, buffer.byteLength);
    await cache.put(
      request,
      responseFromBuffer(buffer, { status: response.status, statusText: response.statusText, headers })
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
    consumeStream(progressBody, chunk => {
      if (chunk?.byteLength) { onActivity(); onBytes?.(chunk.byteLength); }
    }, signal).finally(onNetworkComplete),
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
  checkCancelled(signal);
  if (!isGamePackStorageSupported()) {
    throw new Error('Game-pack storage is not supported on this device.');
  }

  const resolvedCatalog = catalog || (await loadGamePackCatalog());
  const catalogPack = findGamePack(resolvedCatalog, packId);
  if (!catalogPack) throw new Error(`Unknown game pack: ${packId}`);

  if(packId==='tirana-streets'&&!(catalogPack.dependencies||[]).includes('shared-game-runtime')) {
    throw new Error('The complete offline game is not available in this build. Refresh after the game update is published.');
  }
  const manifest = await loadGamePackManifest(catalogPack, { fetchImpl: getNetworkFetch() });
  if(manifest.version!==catalogPack.version||JSON.stringify([...(manifest.dependencies||[])].sort())!==JSON.stringify([...(catalogPack.dependencies||[])].sort())){
    throw new Error('The game download changed while preparing. Refresh the game list and try again.');
  }
  await reconcileGamePackInstallations();
  for (const dependencyId of catalogPack.dependencies || []) {
    const dependency = findGamePack(resolvedCatalog, dependencyId);
    if (!dependency) throw new Error(`Missing download dependency: ${dependencyId}. Check for game updates.`);
    const dependencyState = readState().packs[dependencyId];
    if (dependency && getGamePackStatus(dependency, dependencyState) !== 'installed') {
      dispatchProgress({ packId, phase: 'dependency', dependencyTitle: dependency.title, percent: 0 });
      const relay = event => {
        if (event.detail?.packId !== dependencyId) return;
        dispatchProgress({ ...event.detail, packId, phase: 'dependency', dependencyTitle: dependency.title });
      };
      window.addEventListener(PROGRESS_EVENT, relay);
      try {
        await installGamePack(dependencyId, { catalog: resolvedCatalog, concurrency, signal });
      } finally {
        window.removeEventListener(PROGRESS_EVENT, relay);
      }
    }
  }

  checkCancelled(signal);
  const assets = await resolveGamePackAssets(manifest, { fetchImpl: getNetworkFetch() });
  if (!assets.length) throw new Error(`The ${catalogPack.title} pack has no downloadable assets.`);
  if (packId === APP_PACK_ID && (!manifest.build || manifest.build !== catalogPack.build ||
      assets.length !== manifest.assetCount || assets.some(asset => !Number.isFinite(asset.size) || asset.size < 0 || !/^[a-f0-9]{64}$/.test(asset.sha256 || '')) ||
      !assets.some(asset => asset.url === '/index.html') || !assets.some(asset => /^\/assets\/.+\.js$/.test(asset.url)))) {
    throw new Error('The full app download is incomplete. Refresh after the app update is published.');
  }

  const pack = {
    ...catalogPack,
    version: manifest.version || catalogPack.version,
    dependencies: manifest.dependencies || catalogPack.dependencies || []
  };
  const cacheName = getPackCacheName(pack.id, pack.version);
  const cache = await caches.open(cacheName);
  const previousInstallation = readState().packs[pack.id];
  await cache.delete(completionRequest());
  const totalBytes = assets.reduce((sum, asset) => sum + (asset.size || 0), 0);
  // Browser estimates are approximate per-site allowances, not free disk space.
  // Do not veto a download (or add a percentage reserve) from that estimate.
  // Cache writes enforce the real limit; failures retain verified files for retry.
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

  // Keep the app shell and smaller files parallel. Serialize large files so
  // Web Crypto never holds several original-resolution textures at once.
  const downloadAssets = pack.id === APP_PACK_ID ? [
    ...assets.filter(asset => asset.size <= MAX_HASH_BYTES),
    ...assets.filter(asset => asset.size > MAX_HASH_BYTES)
  ] : assets;
  let largeAssetTail = Promise.resolve();
  let cursor = 0;
  let workerError;
  const workersController = new AbortController();
  const abortWorkers = () => workersController.abort();
  signal?.addEventListener('abort', abortWorkers, { once: true });
  if (signal?.aborted) abortWorkers();
  const worker = async () => {
    while (cursor < downloadAssets.length) {
      checkCancelled(workersController.signal);
      const asset = downloadAssets[cursor++];
      let releaseLargeAsset;
      if (pack.id === APP_PACK_ID && asset.size > MAX_HASH_BYTES) {
        const previousLargeAsset = largeAssetTail;
        largeAssetTail = new Promise(resolve => { releaseLargeAsset = resolve; });
        await previousLargeAsset;
      }
      try {
        checkCancelled(workersController.signal);
        emitProgress('downloading', asset.url, true);
        const result = await downloadAsset({
          pack,
          asset,
          cache,
          cacheName,
          signal: workersController.signal,
          onBytes: size => {
            downloadedBytes += size;
            emitProgress('downloading', asset.url);
          }
        });
        if (result.reused) reusedBytes += result.bytes || 0;
        completedAssets += 1;
        emitProgress('downloading', asset.url, true);
      } finally {
        releaseLargeAsset?.();
      }
    }
  };

  try {
    const workerCount = Math.max(1, Math.min(Number(concurrency) || DEFAULT_CONCURRENCY, assets.length,
      pack.id === APP_PACK_ID ? DEFAULT_CONCURRENCY : Infinity));
    // Settle every writer before exposing Resume or removing a partial cache.
    // Otherwise a late worker can overwrite a subsequent attempt's result.
    await Promise.allSettled(Array.from({ length: workerCount }, () => worker().catch(error => {
      workerError ||= error;
      abortWorkers();
      throw error;
    })));
    if (workerError) throw workerError;
    checkCancelled(signal);

    await cache.put(completionRequest(), new Response(JSON.stringify({
      version: pack.version,
      build: manifest.build,
      assets: assets.map(({ url, size, sha256 }) => ({ url, size, sha256 }))
    }), { headers: {
      'Content-Type': 'application/json',
      // Runtime lookups need only the build, not the entire asset audit list.
      ...(manifest.build ? { 'X-TonPlaygram-App-Build': manifest.build } : {})
    } }));
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
    // Successful activation must not be undone by best-effort cache cleanup.
    await deleteOldPackCaches(pack.id, cacheName).catch(() => {});
    await clearRuntimeCopies(assets).catch(() => {});
    if (pack.id === APP_PACK_ID) {
      // Migrate old separate downloads only after the complete app is durable.
      const superseded = (await caches.keys()).filter(name => name.startsWith(GAME_PACK_CACHE_PREFIX) &&
        name !== cacheName && !name.includes('metadata-'));
      for (const name of superseded) await caches.delete(name).catch(() => {});
      const state = readState();
      state.packs = { [APP_PACK_ID]: state.packs[APP_PACK_ID] };
      writeState(state);
    }
    emitProgress('complete', null, true);
    dispatchChanged({ packId: pack.id, status: 'installed', installation });
    return installation;
  } catch (error) {
    const cancelled = error?.name === 'AbortError';
    const installation = updatePackState(pack.id, previousInstallation?.status === 'installed' ? {
      ...previousInstallation,
      lastError: cancelled ? null : error?.message || 'Update failed. Your previous download is still available.'
    } : {
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
  } finally {
    signal?.removeEventListener('abort', abortWorkers);
  }
}

export function installGamePack(packId, options = {}) {
  if (activeInstalls.has(packId)) return activeInstalls.get(packId).promise;
  const controller = new AbortController();
  const externalSignal = options.signal;
  const abortFromExternal = () => controller.abort();
  externalSignal?.addEventListener?.('abort', abortFromExternal, { once: true });
  if (externalSignal?.aborted) controller.abort();

  const previousInstallation = readState().packs[packId];
  const promise = requestPersistentGamePackStorage()
    .catch(() => false)
    .then(() => performInstall(packId, { ...options, signal: controller.signal }))
    .catch(error => {
      const cancelled = error?.name === 'AbortError';
      const message = error?.name === 'QuotaExceededError'
        ? GAME_PACK_STORAGE_ERROR_MESSAGE
        : error?.message || 'Download failed. Try again when connected.';
      updatePackState(packId, { ...(previousInstallation?.status === 'installed' ? previousInstallation : { status: 'partial' }), lastError: cancelled ? null : message });
      dispatchProgress({ packId, phase: cancelled ? 'cancelled' : 'failed', percent: 0 });
      if (error?.name === 'QuotaExceededError') {
        // Hooks also surface the rejected error, so keep it consistent with the
        // persisted message instead of leaking the browser's generic exception.
        const storageError = new Error(message, { cause: error });
        storageError.name = 'QuotaExceededError';
        throw storageError;
      }
      throw error;
    })
    .finally(() => {
      externalSignal?.removeEventListener?.('abort', abortFromExternal);
      activeInstalls.delete(packId);
      // All hooks must see the final state AFTER the active flag is cleared.
      dispatchChanged({ packId, status: readState().packs[packId]?.status || 'not-installed' });
    });

  activeInstalls.set(packId, { controller, promise });
  dispatchProgress({ packId, phase: 'preparing', percent: 0 });
  dispatchChanged({ packId, status: 'downloading' });
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
  const pending = activeInstalls.get(packId)?.promise;
  cancelGamePackInstall(packId);
  if (pending) await pending.catch(() => {});
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
