// Simple service worker to ensure latest assets are served
self.addEventListener('install', () => {
  // Take control immediately after installation
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Become the active worker for all clients
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Always go to the network and avoid caches
  event.respondWith(fetch(event.request, { cache: 'no-store' }));
});

