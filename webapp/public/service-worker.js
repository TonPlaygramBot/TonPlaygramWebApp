const CACHE_VERSION = 'tonplaygram-pwa-v2';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/power-slider.css',
  '/pwa-icon.svg',
  '/pwa-icon-maskable.svg',
  '/pwa-splash.svg',
  '/service-worker.js'
];

// Pre-cache the heavier game shells so repeat loads are instant and offline tolerant.
const GAME_SHELL_ASSETS = [
  '/chess-royale.html',
  '/flag-emojis.js',
  '/pool-royale-bracket.html',
  '/pool-royale-api.js',
  '/pool-royale-power-slider.js',
  '/pool-royale-power-slider.css',
  '/game-preloads/pool-royale-preload.txt'
];

const STATIC_ASSET_DESTINATIONS = new Set([
  'style',
  'script',
  'worker',
  'font',
  'image',
  'audio',
  'video'
]);

self.addEventListener('install', (event) => {
  const assetsToCache = [...new Set([...CORE_ASSETS, ...GAME_SHELL_ASSETS])];

  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(assetsToCache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => ![STATIC_CACHE, RUNTIME_CACHE].includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

const OFFLINE_NAVIGATION_PATHS = ['/games/poolroyale', '/games/snookerclub', '/games/chessroyale'];

const isSameOrigin = (request) => {
  try {
    return new URL(request.url).origin === self.location.origin;
  } catch (error) {
    return false;
  }
};

const cacheFirst = async (request) => {
  const cache = await caches.open(RUNTIME_CACHE);
  const cachedResponse = await cache.match(request);
  if (cachedResponse) return cachedResponse;

  try {
    const response = await fetch(request);
    cache.put(request, response.clone());
    return response;
  } catch (error) {
    if (cachedResponse) return cachedResponse;
    throw error;
  }
};

const networkFirst = async (request) => {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) return cachedResponse;
    throw error;
  }
};

const staleWhileRevalidate = async (request) => {
  const cache = await caches.open(RUNTIME_CACHE);
  const cachedResponse = await cache.match(request);

  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.status === 200) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cachedResponse);

  return cachedResponse || networkPromise;
};

const handleNavigation = async (request) => {
  const cache = await caches.open(STATIC_CACHE);
  const cachedIndex = await cache.match('/index.html');
  const requestUrl = new URL(request.url);

  try {
    const response = await fetch(request);
    cache.put('/index.html', response.clone());
    return response;
  } catch (error) {
    const cachedPage = await cache.match(requestUrl.pathname);
    if (cachedPage) return cachedPage;

    if (OFFLINE_NAVIGATION_PATHS.some((path) => requestUrl.pathname.startsWith(path))) {
      const cachedFallback = await cache.match(requestUrl.pathname);
      if (cachedFallback) return cachedFallback;
    }

    return cachedIndex || Response.error();
  }
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (!isSameOrigin(request)) return;

  if (STATIC_ASSET_DESTINATIONS.has(request.destination)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.url.includes('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});
