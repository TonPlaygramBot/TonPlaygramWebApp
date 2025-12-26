const STATIC_CACHE = 'tonplaygram-static-v4';
const RUNTIME_CACHE = 'tonplaygram-runtime-v4';
const OFFLINE_FALLBACK = '/offline.html';
const MODEL_ASSET_PATTERN = /\.(gltf|glb)(\?|$)/i;

const APP_SHELL = [
  '/',
  '/index.html',
  OFFLINE_FALLBACK,
  '/manifest.webmanifest',
  '/tonconnect-manifest.json',
  '/pwa/offline-assets.json',
  '/pwa/model-assets.json',
  '/power-slider.css',
  '/assets/icons/file_00000000bc2862439eecffff3730bbe4.webp',
  '/assets/icons/file_000000003f7861f481d50537fb031e13.png'
];

const PREFETCH_RUNTIME_ASSETS = [
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

const enableNavigationPreload = async () => {
  if (self.registration?.navigationPreload) {
    await self.registration.navigationPreload.enable();
  }
};

const precache = async () => {
  const cache = await caches.open(STATIC_CACHE);
  await cache.addAll(APP_SHELL.map(path => new Request(path, { cache: 'reload' })));
};

const prewarmRuntimeCache = async () => {
  const cache = await caches.open(RUNTIME_CACHE);
  await Promise.all(
    PREFETCH_RUNTIME_ASSETS.map(async asset => {
      try {
        const request = new Request(asset, { cache: 'reload' });
        const response = await fetch(request);
        if (response.ok) {
          await cache.put(request, response.clone());
        }
      } catch (err) {
        // Ignore failed warmups to avoid breaking install
      }
    })
  );
};

self.addEventListener('install', event => {
  event.waitUntil(
    Promise.all([precache(), prewarmRuntimeCache(), enableNavigationPreload()]).catch(() => {})
  );
  self.skipWaiting();
});

const cleanupCaches = async () => {
  const cacheNames = await caches.keys();
  const deletions = cacheNames
    .filter(name => ![STATIC_CACHE, RUNTIME_CACHE].includes(name))
    .map(name => caches.delete(name));
  await Promise.all(deletions);
};

self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([cleanupCaches(), self.clients.claim(), enableNavigationPreload()]).catch(
      () => {}
    )
  );
});

self.addEventListener('message', event => {
  const { type } = event.data || {};
  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (type === 'CHECK_FOR_UPDATE' && self.registration?.update) {
    event.waitUntil(self.registration.update());
  }
});

const cacheResponse = async (cacheName, request, response) => {
  if (!response || response.status !== 200 || response.type === 'opaque') return;
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
};

const navigationPreloadResponse = async event => {
  try {
    return await event.preloadResponse;
  } catch (err) {
    return null;
  }
};

const cacheFirstModelAsset = async request => {
  const cached = await caches.match(request);
  const updatePromise = fetch(request)
    .then(async response => {
      await cacheResponse(RUNTIME_CACHE, request, response);
      return response.clone();
    })
    .catch(() => null);

  if (cached) {
    updatePromise.catch(() => {});
    return cached;
  }

  const networkResponse = await updatePromise;
  if (networkResponse) return networkResponse;
  throw new Error('Network unavailable for model asset');
};

const networkFirst = async (event, request) => {
  const preloadResponse = await navigationPreloadResponse(event);
  if (preloadResponse) return preloadResponse;

  try {
    const freshResponse = await fetch(request, { cache: 'no-store' });
    await cacheResponse(RUNTIME_CACHE, request, freshResponse);
    return freshResponse.clone();
  } catch (err) {
    const cached =
      (await caches.match(request)) ||
      (await caches.match('/index.html')) ||
      (await caches.match(OFFLINE_FALLBACK));
    if (cached) return cached;
    throw err;
  }
};

const staleWhileRevalidate = async request => {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then(async response => {
      await cacheResponse(RUNTIME_CACHE, request, response);
      return response.clone();
    })
    .catch(() => cached);

  const response = cached || (await fetchPromise);
  return response || fetchPromise;
};

const handleNavigationRequest = event => {
  event.respondWith(
    networkFirst(event, event.request).catch(async () => {
      const cached = (await caches.match('/index.html')) || (await caches.match(OFFLINE_FALLBACK));
      return cached || Response.error();
    })
  );
};

self.addEventListener('fetch', event => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const destination = request.destination;
  const isModelAsset = destination === 'model' || MODEL_ASSET_PATTERN.test(url.pathname);

  if (isModelAsset) {
    event.respondWith(
      cacheFirstModelAsset(request).catch(() => fetch(request))
    );
    return;
  }

  if (request.mode === 'navigate') {
    handleNavigationRequest(event);
    return;
  }

  const isSameOrigin = url.origin === self.location.origin;
  const cacheableDestinations = ['script', 'style', 'font', 'image', 'audio', 'video'];

  if (isSameOrigin && cacheableDestinations.includes(destination)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (!isSameOrigin && destination === 'font') {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  event.respondWith(fetch(request));
});
