import { RUNTIME_CACHE_NAME } from './preloadGames.js';

const OFFLINE_MANIFEST_PATHS = ['pwa/offline-assets.json', 'pwa/model-assets.json'];
const OFFLINE_CACHE_VERSION_KEY = 'tonplaygram-offline-cache-version';

const normalizeBaseUrl = base => {
  if (!base) return '/';
  return base.endsWith('/') ? base : `${base}/`;
};

const buildManifestUrl = (path, baseNormalized) =>
  new URL(path, `${window.location.origin}${baseNormalized}`).toString();

const fetchManifestAssets = async (baseNormalized = '/') => {
  const seen = new Set();
  const assets = [];

  for (const manifestPath of OFFLINE_MANIFEST_PATHS) {
    const manifestUrl = buildManifestUrl(manifestPath, baseNormalized);
    const manifestResponse = await fetch(manifestUrl, { cache: 'no-store' });
    if (!manifestResponse.ok) throw new Error(`Unable to fetch manifest at ${manifestPath}`);

    const manifestAssets = await manifestResponse.json();
    if (!Array.isArray(manifestAssets)) {
      throw new Error(`Offline manifest ${manifestPath} is invalid`);
    }

    for (const asset of manifestAssets) {
      if (typeof asset === 'string' && !seen.has(asset)) {
        seen.add(asset);
        assets.push(asset);
      }
    }
  }

  if (assets.length === 0) {
    throw new Error('Offline manifests are empty');
  }

  return assets;
};

export const isTelegramEnvironment = () => Boolean(window.Telegram?.WebApp);

export const shouldAutoWarmOfflineCache = () => {
  const stored = localStorage.getItem(OFFLINE_CACHE_VERSION_KEY);
  return stored !== RUNTIME_CACHE_NAME;
};

export async function cacheOfflineAssets({ baseUrl = '/', onUpdate } = {}) {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker?.ready || !('caches' in window)) {
    throw new Error('Offline caching is unavailable in this browser.');
  }

  await navigator.serviceWorker.ready;

  const baseNormalized = normalizeBaseUrl(baseUrl);
  const assets = await fetchManifestAssets(baseNormalized);
  const cache = await caches.open(RUNTIME_CACHE_NAME);
  let successes = 0;
  let failures = 0;

  for (const [index, asset] of assets.entries()) {
    const normalizedAsset = asset.startsWith('http') ? asset : asset.replace(/^\//, '');
    const assetUrl = new URL(
      normalizedAsset,
      `${window.location.origin}${baseNormalized}`
    ).toString();

    try {
      const request = new Request(assetUrl, { cache: 'reload' });
      const response = await fetch(request);
      if (!response.ok) throw new Error('Bad response');
      await cache.put(request, response.clone());
      successes++;
    } catch (err) {
      console.warn('Failed to cache asset', assetUrl, err);
      failures++;
    }

    if (typeof onUpdate === 'function') {
      onUpdate({ completed: index + 1, total: assets.length, successes, failures });
    }
  }

  if (successes === 0) {
    throw new Error('None of the offline assets could be cached.');
  }

  localStorage.setItem(OFFLINE_CACHE_VERSION_KEY, RUNTIME_CACHE_NAME);

  return { successes, total: assets.length, failures };
}
