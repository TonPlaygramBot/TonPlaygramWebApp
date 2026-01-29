import { APP_BUILD } from '../config/buildInfo.js';

const OPEN_SOURCE_MANIFEST_PATH = '/pwa/open-source-assets.json';
const OPEN_SOURCE_CACHE = `tonplaygram-open-source-${APP_BUILD || 'dev'}`;
const OPEN_SOURCE_CACHE_VERSION_KEY = 'tonplaygram-open-source-cache-version';

export async function cacheOpenSourceAssets({ onUpdate } = {}) {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker?.ready || !('caches' in window)) {
    throw new Error('Offline caching is unavailable in this browser.');
  }

  await navigator.serviceWorker.ready;
  const manifestResponse = await fetch(OPEN_SOURCE_MANIFEST_PATH, { cache: 'no-store' });
  if (!manifestResponse.ok) throw new Error('Unable to fetch open-source manifest.');

  const assets = await manifestResponse.json();
  if (!Array.isArray(assets) || assets.length === 0) {
    throw new Error('Open-source manifest is empty.');
  }

  const cache = await caches.open(OPEN_SOURCE_CACHE);
  let successes = 0;
  let failures = 0;

  for (const [index, asset] of assets.entries()) {
    if (typeof asset !== 'string') continue;
    try {
      const request = new Request(asset, { cache: 'reload', mode: 'cors' });
      const response = await fetch(request);
      if (!response.ok) throw new Error('Bad response');
      await cache.put(request, response.clone());
      successes++;
    } catch (err) {
      failures++;
    }

    if (typeof onUpdate === 'function') {
      onUpdate({ completed: index + 1, total: assets.length, successes, failures });
    }
  }

  if (successes === 0) {
    throw new Error('None of the open-source assets could be cached.');
  }

  localStorage.setItem(OPEN_SOURCE_CACHE_VERSION_KEY, OPEN_SOURCE_CACHE);
  return { successes, total: assets.length, failures };
}
