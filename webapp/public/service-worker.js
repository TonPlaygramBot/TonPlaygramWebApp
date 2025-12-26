const STATIC_CACHE = 'tonplaygram-static-v3';
const RUNTIME_CACHE = 'tonplaygram-runtime-v3';
const OFFLINE_FALLBACK = '/offline.html';
const OFFLINE_MANIFEST = '/pwa/offline-assets.json';

const APP_SHELL = [
  '/',
  '/index.html',
  OFFLINE_FALLBACK,
  '/manifest.webmanifest',
  '/tonconnect-manifest.json',
  '/power-slider.css',
  '/assets/icons/file_00000000bc2862439eecffff3730bbe4.webp',
  '/assets/icons/file_000000003f7861f481d50537fb031e13.png'
];

const enableNavigationPreload = async () => {
  if (self.registration?.navigationPreload) {
    await self.registration.navigationPreload.enable();
  }
};

const precache = async () => {
  const cache = await caches.open(STATIC_CACHE);
  await cache.addAll(APP_SHELL);
};

const normalizeAsset = asset => {
  try {
    const url = new URL(asset, self.location.origin);
    return url.href;
  } catch (err) {
    return null;
  }
};

const precacheOfflineAssets = async () => {
  try {
    const response = await fetch(OFFLINE_MANIFEST, { cache: 'no-store' });
    if (!response.ok) return;

    const assets = await response.json();
    if (!Array.isArray(assets)) return;

    const normalizedAssets = assets
      .map(normalizeAsset)
      .filter(Boolean);

    const cache = await caches.open(RUNTIME_CACHE);
    await Promise.all(
      normalizedAssets.map(asset =>
        cache.add(asset).catch(() => {
          // Ignore individual asset failures to keep install fast
        })
      )
    );
  } catch (err) {
    // Offline precache is best-effort; ignore failures
  }
};

self.addEventListener('install', event => {
  event.waitUntil(
    Promise.all([precache(), precacheOfflineAssets(), enableNavigationPreload()]).catch(() => {})
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
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (event.data?.type === 'CACHE_OFFLINE_BUNDLE') {
    event.waitUntil(precacheOfflineAssets());
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

  if (request.mode === 'navigate') {
    handleNavigationRequest(event);
    return;
  }

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const destination = request.destination;
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
