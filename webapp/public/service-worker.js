const CACHE_NAME = 'tonplaygram-cache-v1';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/tonconnect-manifest.json',
  '/assets/icons/file_00000000bc2862439eecffff3730bbe4.webp'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(cacheNames =>
        Promise.all(cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name)))
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

const networkFirst = async request => {
  try {
    const freshResponse = await fetch(request, { cache: 'no-store' });
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, freshResponse.clone());
    return freshResponse;
  } catch (err) {
    const cached = (await caches.match(request)) || (await caches.match('/'));
    if (cached) return cached;
    throw err;
  }
};

const staleWhileRevalidate = async request => {
  const cache = await caches.open(CACHE_NAME);
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
    event.respondWith(networkFirst(request));
    return;
  }

  if (isSameOrigin) {
    const shouldCache = ['script', 'style', 'font', 'image'].includes(request.destination);
    if (shouldCache) {
      event.respondWith(staleWhileRevalidate(request));
      return;
    }
  }

  event.respondWith(fetch(request));
});

