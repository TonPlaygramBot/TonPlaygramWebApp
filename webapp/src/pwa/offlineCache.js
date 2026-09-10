import { RUNTIME_CACHE_NAME } from './preloadGames.js';
import { fetchWithDeadline, readStorage, resolvePublicCacheAsset, waitForServiceWorker, writeStorage } from './installSupport.js';
export { isTelegramEnvironment } from './installSupport.js';

const OFFLINE_CACHE_VERSION_KEY = 'tonplaygram-offline-cache-version';
const OFFLINE_CACHE_ENABLED_KEY = 'tonplaygram-offline-cache-enabled';

export const shouldAutoWarmOfflineCache = () => {
  const enabled = readStorage(OFFLINE_CACHE_ENABLED_KEY) === '1';
  const isUpdate = readStorage(OFFLINE_CACHE_VERSION_KEY) !== RUNTIME_CACHE_NAME;
  return { shouldWarm: enabled && isUpdate, isUpdate: enabled && isUpdate };
};

export async function cacheOfflineAssets({ baseUrl = '/', onUpdate, signal } = {}) {
  if (!globalThis.window?.caches) throw new Error('Web caching is unavailable in this browser.');
  await waitForServiceWorker({ signal });
  const base = new URL(baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`, window.location.origin);
  if (base.origin !== window.location.origin) throw new Error('Only this app’s public game files can be cached.');
  const assets = await fetchWithDeadline(new URL('pwa/offline-assets.json', base).href, {
    signal, cache: 'no-store', credentials: 'omit',
    consume: async response => {
      if (!response.ok) throw new Error('Unable to fetch the game-file list.');
      return response.json();
    }
  });
  if (!Array.isArray(assets) || !assets.length) throw new Error('The game-file list is empty.');

  const uniqueAssets = [...new Set(assets)];
  const cache = await caches.open(RUNTIME_CACHE_NAME);
  writeStorage(OFFLINE_CACHE_ENABLED_KEY, '1');
  writeStorage(OFFLINE_CACHE_VERSION_KEY, null);
  const progress = { completed: 0, total: uniqueAssets.length, successes: 0, failures: 0 };
  onUpdate?.({ ...progress });

  // Sequential downloads avoid a large spike in memory/network use on phones.
  for (const asset of uniqueAssets) {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    const url = resolvePublicCacheAsset(asset, base);
    try {
      if (!url) throw new Error('Not a public game asset.');
      if (!(await cache.match(url))) {
        await fetchWithDeadline(url, {
          signal, cache: 'reload', credentials: 'omit',
          consume: async response => {
            if (!response.ok || response.type === 'opaque' || response.redirected) throw new Error('Asset unavailable.');
            // Do not cache a server's HTML fallback in place of a missing JS/model file.
            if (!/\.html$/i.test(new URL(url).pathname) && /text\/html/i.test(response.headers.get('content-type') || '')) {
              throw new Error('Unexpected HTML response.');
            }
            if (/\bprivate\b/i.test(response.headers.get('cache-control') || '')) throw new Error('Private response.');
            await cache.put(url, response);
          }
        });
      }
      progress.successes++;
    } catch (error) {
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      if (error?.name === 'QuotaExceededError') throw new Error('Your browser storage is full. Free space before retrying.');
      progress.failures++;
    }
    progress.completed++;
    onUpdate?.({ ...progress });
  }
  if (!progress.successes) throw new Error('No game files could be cached. Check your connection and try again.');
  // Partial downloads remain retryable; never label them as a complete offline install.
  if (!progress.failures) writeStorage(OFFLINE_CACHE_VERSION_KEY, RUNTIME_CACHE_NAME);
  return { ...progress };
}
