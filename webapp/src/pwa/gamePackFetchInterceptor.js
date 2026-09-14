import { APP_BUILD } from '../config/buildInfo.js';
import { resolveLocalAssetUrl } from './externalAssetUrls.js';
import { GAME_PACK_CACHE_PREFIX, GAME_PACK_COMPLETE_PATH } from './gamePackCatalog.js';

const NETWORK_FETCH_SYMBOL = Symbol.for('tonplaygram.network-fetch');
const CACHEABLE_PATH = /^\/(?:assets|models|game-preloads|lib|vendor)\//;
const CACHEABLE_EXTENSION = /\.(?:glb|gltf|bin|wasm|woff2?|ttf|otf|mp4|webm|ktx2|basis|dds|hdr|exr|png|jpe?g|webp|avif|svg|mp3|ogg|wav|m4a|json|css|js|html|txt)$/i;
let installed = false;


// Cache names contain the manifest content version. A completed version cannot
// legitimately change its build; keep its legacy receipt parse out of the hot
// asset path. Still check the marker and requested file on every lookup so
// staging, removal, and browser eviction take effect immediately.
const receiptBuilds = new WeakMap();
const MAX_RECEIPT_BUILDS = 32;
function readCompletedBuild(storage, name, marker) {
  const build = marker.headers.get('X-TonPlaygram-App-Build');
  if (build) return Promise.resolve(build);
  let entries = receiptBuilds.get(storage);
  if (!entries) receiptBuilds.set(storage, entries = new Map());
  if (entries.has(name)) return entries.get(name);
  if (entries.size >= MAX_RECEIPT_BUILDS) entries.delete(entries.keys().next().value);
  const pending = marker.json().then(receipt => receipt?.build || null).catch(() => {
    if (entries.get(name) === pending) entries.delete(name);
    return null;
  });
  entries.set(name, pending);
  return pending;
}

const canReadPackCaches = () => typeof caches !== 'undefined' && typeof caches.keys === 'function';

async function matchGamePackCache(request) {
  if (!canReadPackCaches()) return null;
  const fullAppPrefix = `${GAME_PACK_CACHE_PREFIX}tonplaygram-app-`;
  const names = (await caches.keys()).filter(name => name.startsWith(GAME_PACK_CACHE_PREFIX));
  names.sort((a, b) => Number(b.startsWith(fullAppPrefix)) - Number(a.startsWith(fullAppPrefix)));
  for (const name of names) {
    const pathname = new URL(request.url).pathname;
    if (!name.startsWith(fullAppPrefix) && !CACHEABLE_PATH.test(pathname) && !CACHEABLE_EXTENSION.test(pathname)) continue;
    const cache = await caches.open(name);
    const marker = await cache.match(new URL(GAME_PACK_COMPLETE_PATH, window.location.origin).href);
    if (!marker) {
      receiptBuilds.get(caches)?.delete(name);
      continue;
    }
    if (name.startsWith(fullAppPrefix) && await readCompletedBuild(caches, name, marker) !== APP_BUILD) continue;
    const response = await cache.match(request, { ignoreVary: true });
    if (response) return response;
    // Domino cache-busts its public module with the current app build. The
    // verified full-app manifest records the same file without that query.
    const url = new URL(request.url);
    if (name.startsWith(fullAppPrefix) && url.pathname === '/domino-royal-game.js' &&
        [...url.searchParams].length === 1 && url.searchParams.get('v') === APP_BUILD) {
      const entrypoint = await cache.match(new URL(url.pathname, url.origin).href, { ignoreVary: true });
      if (entrypoint) return entrypoint;
    }
  }
  return null;
}

const shouldCheckPackCache = (input, init) => {
  if (typeof window === 'undefined') return null;
  if (['no-store', 'reload'].includes(init?.cache || (input instanceof Request ? input.cache : ''))) return null;
  const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  if (method !== 'GET') return null;

  try {
    const rawUrl = input instanceof Request ? input.url : String(input);
    const originalUrl = new URL(rawUrl, window.location.href);
    if (/^\/(?:api|auth|socket\.io|colyseus)(?:\/|$)/.test(originalUrl.pathname)) return null;
    // The external resolver is installed below this wrapper. Resolve its public
    // provider URLs here too, before the same-origin downloaded-cache lookup.
    const url = new URL(resolveLocalAssetUrl(rawUrl, window.location.href), window.location.href);
    if (url.origin !== window.location.origin || /^\/(?:api|auth|socket\.io|colyseus)(?:\/|$)/.test(url.pathname)) return null;
    if (['/version.json', '/service-worker.js', '/pwa/app-build.js', '/pwa/game-pack-service-worker.js'].includes(url.pathname) || url.pathname.startsWith('/pwa/game-packs/')) return null;
    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    if (headers.has('range') || headers.has('authorization') || headers.get('X-TonPlaygram-Verify') === '1') return null;
    return new Request(url.toString(), { method: 'GET', credentials: 'same-origin' });
  } catch {
    return null;
  }
};

export function getNetworkFetch() {
  if (typeof window !== 'undefined' && window[NETWORK_FETCH_SYMBOL]) {
    return window[NETWORK_FETCH_SYMBOL];
  }
  return typeof fetch === 'function' ? fetch.bind(globalThis) : null;
}

export function installGamePackFetchInterceptor() {
  if (installed || typeof window === 'undefined' || typeof window.fetch !== 'function' || !canReadPackCaches()) {
    return false;
  }

  const networkFetch = window.fetch.bind(window);
  window[NETWORK_FETCH_SYMBOL] = networkFetch;

  window.fetch = async (input, init) => {
    const request = shouldCheckPackCache(input, init);
    if (request) {
      try {
        const cached = await matchGamePackCache(request);
        if (cached) return cached;
      } catch (error) {
        console.warn('Game-pack cache lookup failed', error);
      }
    }
    return networkFetch(input, init);
  };

  installed = true;
  return true;
}

export { matchGamePackCache };
