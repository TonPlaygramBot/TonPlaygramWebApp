import { loadGltfManifest } from './gltfManifest.js';

const RUNTIME_CACHE_NAME = 'tonplaygram-runtime-v4';

const GAME_ENTRYPOINTS = [
  '/goal-rush.html',
  '/goal-rush-api.js',
  '/texas-holdem.html',
  '/texas-holdem.js',
  '/domino-royal.html',
  '/murlan-royale.html',
  '/roulette.html',
  '/chess-royale.html',
  '/pool-royale-api.js',
  '/power-slider.js',
  '/power-slider.css'
];

const runWhenIdle = cb => {
  if ('requestIdleCallback' in window) {
    return requestIdleCallback(cb, { timeout: 1500 });
  }
  return setTimeout(cb, 500);
};

const createRequest = (asset, { forceReload = false } = {}) => {
  const init = { cache: forceReload ? 'reload' : 'default' };
  if (/^https?:\/\//.test(asset)) {
    init.mode = 'cors';
    init.credentials = 'omit';
  }
  return new Request(asset, init);
};

const prefetchIntoCache = async (cache, assets = [], { forceReload = false } = {}) => {
  const uniqueAssets = Array.from(new Set(assets));
  await Promise.all(
    uniqueAssets.map(async asset => {
      try {
        const request = createRequest(asset, { forceReload });
        const response = await fetch(request);
        if (response.ok) {
          await cache.put(request, response.clone());
        }
      } catch (err) {
        console.warn('Skipping prefetch for', asset, err);
      }
    })
  );
};

export function warmGameCaches({ forceReload = false, immediate = false } = {}) {
  if (!('caches' in window) || !('serviceWorker' in navigator)) return null;

  const performWarmup = async () => {
    try {
      await navigator.serviceWorker.ready;
      const cache = await caches.open(RUNTIME_CACHE_NAME);
      await prefetchIntoCache(cache, GAME_ENTRYPOINTS, { forceReload });
      try {
        const gltfAssets = await loadGltfManifest();
        await prefetchIntoCache(cache, gltfAssets, { forceReload });
      } catch (err) {
        console.warn('Skipping GLTF warmup', err);
      }
    } catch (err) {
      console.warn('Skipping game warmup', err);
    }
  };

  if (immediate) {
    return performWarmup();
  }

  runWhenIdle(() => {
    void performWarmup();
  });

  return performWarmup;
}

export async function refreshGameCachesInBackground() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    if (registration?.update) {
      registration.update().catch(() => {});
    }
    registration.active?.postMessage?.({ type: 'CHECK_FOR_UPDATE' });
  } catch (err) {
    console.warn('Unable to force service worker update', err);
  }

  await warmGameCaches({ forceReload: true, immediate: true });
}

export { RUNTIME_CACHE_NAME };
