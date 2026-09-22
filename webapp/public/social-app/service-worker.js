/* The build inserts the dependency graph of the social entry, including its
 * lazy pages. Never cache private API responses or user video files here. */
const SOCIAL_CACHE = 'tonplaygram-social-__SOCIAL_VERSION__';
const SOCIAL_ASSETS = /* SOCIAL_ASSETS */ [];
const SOCIAL_SHELL = '/social-app/index.html';
importScripts('/pwa/wall-push.js');
importScripts('/pwa/wall-upload-worker.js');

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SOCIAL_CACHE);
    await cache.addAll(SOCIAL_ASSETS.map(path => new Request(path, { cache: 'reload' })));
    // Do not skipWaiting: an existing page or upload keeps its current worker.
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await Promise.all((await caches.keys()).filter(name => name.startsWith('tonplaygram-social-') && name !== SOCIAL_CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || request.headers.has('authorization')) return;
  if (request.mode === 'navigate' && url.pathname.startsWith('/social-app/')) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) return response;
      } catch { /* Use the complete previously installed shell when offline. */ }
      return (await (await caches.open(SOCIAL_CACHE)).match(SOCIAL_SHELL)) || Response.error();
    })());
  } else if (SOCIAL_ASSETS.includes(url.pathname) && url.pathname !== SOCIAL_SHELL && !url.pathname.endsWith('.webmanifest')) {
    event.respondWith((async () => {
      const cache = await caches.open(SOCIAL_CACHE);
      return (await cache.match(url.pathname)) || fetch(request);
    })());
  }
});
