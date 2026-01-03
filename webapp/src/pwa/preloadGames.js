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

const GLTF_MANIFEST_PATH = '/pwa/gltf-assets.json';
const GLTF_EXTENSIONS = /\.(gltf|glb|bin|ktx2|dds|hdr)$/i;

const runWhenIdle = cb => {
  if ('requestIdleCallback' in window) {
    return requestIdleCallback(cb, { timeout: 1500 });
  }
  return setTimeout(cb, 500);
};

const normalizeBaseUrl = base => {
  if (!base) return '/';
  return base.endsWith('/') ? base : `${base}/`;
};

async function warmGltfMaterials({ baseUrl = '/', forceReload = false } = {}) {
  if (!('caches' in window) || !('serviceWorker' in navigator)) return;

  try {
    await navigator.serviceWorker.ready;
    const cache = await caches.open(RUNTIME_CACHE_NAME);
    const base = normalizeBaseUrl(baseUrl);
    const manifestUrl = new URL(GLTF_MANIFEST_PATH, `${window.location.origin}${base}`).toString();
    const manifestResponse = await fetch(manifestUrl, { cache: 'no-store' });
    if (!manifestResponse.ok) return;
    const assets = await manifestResponse.json();
    if (!Array.isArray(assets) || !assets.length) return;

    await Promise.all(
      assets.map(async asset => {
        if (typeof asset !== 'string' || !GLTF_EXTENSIONS.test(asset)) return;
        try {
          const request = new Request(asset, { cache: forceReload ? 'reload' : 'default', mode: 'cors' });
          const response = await fetch(request);
          if (response.ok) {
            await cache.put(request, response.clone());
          }
        } catch (err) {
          console.warn('Skipping GLTF prefetch', asset, err);
        }
      })
    );
  } catch (err) {
    console.warn('Skipping GLTF warmup', err);
  }
}

const notifyServiceWorkerGltfWarmup = async () => {
  if (!('serviceWorker' in navigator)) return false;
  const registration = await navigator.serviceWorker.ready;
  const worker = navigator.serviceWorker.controller || registration.active;
  if (!worker) return false;
  worker.postMessage({ type: 'WARM_GLTF_ASSETS' });
  return true;
};

export async function refreshGltfAssets({ baseUrl = '/', forceReload = false } = {}) {
  try {
    await notifyServiceWorkerGltfWarmup();
    await warmGltfMaterials({ baseUrl, forceReload });
  } catch (err) {
    console.warn('Unable to refresh GLTF caches', err);
  }
}

export function warmGameCaches() {
  if (!('caches' in window) || !('serviceWorker' in navigator)) return;

  runWhenIdle(async () => {
    try {
      await navigator.serviceWorker.ready;
      const cache = await caches.open(RUNTIME_CACHE_NAME);
      await Promise.all(
        GAME_ENTRYPOINTS.map(async asset => {
          try {
            const request = new Request(asset, { cache: 'reload' });
            const response = await fetch(request);
            if (response.ok) {
              await cache.put(request, response.clone());
            }
          } catch (err) {
            console.warn('Skipping prefetch for', asset, err);
          }
        })
      );
      await warmGltfMaterials({ baseUrl: import.meta.env.BASE_URL || '/' });
    } catch (err) {
      console.warn('Skipping game warmup', err);
    }
  });
}

export { RUNTIME_CACHE_NAME, warmGltfMaterials };
