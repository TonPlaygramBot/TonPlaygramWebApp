const CACHE_VERSION = 'v2';
const CACHE_NAME = `tonplaygram-cache-${CACHE_VERSION}`;
const FONT_CACHE = 'tonplaygram-fonts';
const RUNTIME_CACHE = 'tonplaygram-runtime';
const OFFLINE_URL = '/offline.html';

const CORE_ASSETS = [
  '/',
  '/index.html',
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/tonconnect-manifest.json',
  '/power-slider.css',
  '/assets/icons/file_00000000bc2862439eecffff3730bbe4.webp'
];

const GOOGLE_FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

const isGoogleFontRequest = url => GOOGLE_FONT_HOSTS.includes(url.hostname);
const isStaticAsset = request =>
  ['script', 'style', 'font', 'image', 'audio', 'video', 'worker'].includes(
    request.destination
  );

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  const expectedCaches = [CACHE_NAME, FONT_CACHE, RUNTIME_CACHE];
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then(cacheNames =>
          Promise.all(
            cacheNames.filter(name => !expectedCaches.includes(name)).map(name => caches.delete(name))
          )
        ),
      self.clients.claim()
    ])
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

const cacheFirst = async (request, cacheName) => {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    cache.put(request, response.clone());
    return response;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
};

const networkFirst = async (request, { fallback } = {}) => {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const freshResponse = await fetch(request, { cache: 'no-store' });
    cache.put(request, freshResponse.clone());
    return freshResponse;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (fallback) {
      const offline = await caches.match(fallback);
      if (offline) return offline;
    }
    throw err;
  }
};

const staleWhileRevalidate = async (request, cacheName = CACHE_NAME) => {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then(response => {
      cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);

  const response = cached || (await fetchPromise);
  return response || fetch(request);
};

self.addEventListener('fetch', event => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, { fallback: OFFLINE_URL }));
    return;
  }

  if (isGoogleFontRequest(url)) {
    event.respondWith(cacheFirst(request, FONT_CACHE));
    return;
  }

  if (isSameOrigin && isStaticAsset(request)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  event.respondWith(
    fetch(request).catch(async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      if (isSameOrigin) return caches.match(OFFLINE_URL);
      throw new Error('Network request failed and no cache available');
    })
  );
});
