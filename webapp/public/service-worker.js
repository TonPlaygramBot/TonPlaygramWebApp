/* Build marker is generated alongside the bundled web assets. */
self.__TONPLAYGRAM_APP_BUILD__ = self.__TONPLAYGRAM_APP_BUILD__ || 'dev';
try { importScripts('/pwa/app-build.js'); } catch { /* Keep the existing dev fallback. */ }
const APP_BUILD = String(self.__TONPLAYGRAM_APP_BUILD__ || 'dev').trim() || 'dev';
const STATIC_CACHE = `tonplaygram-static-${APP_BUILD}`;
const RUNTIME_CACHE = `tonplaygram-runtime-${APP_BUILD}`;
const OFFLINE_FALLBACK = '/offline.html';
const APP_SHELL = ['/', '/index.html', OFFLINE_FALLBACK, '/manifest.webmanifest',
  '/assets/icons/generated/app-icon-192.png', '/assets/icons/generated/app-icon-512.png'];
const REMOTE_HOSTS = new Set(['cdn.jsdelivr.net', 'fastly.jsdelivr.net', 'raw.githubusercontent.com', 'dl.polyhaven.org']);
const ASSET_EXTENSIONS = /\.(?:js|mjs|css|woff2?|ttf|png|jpe?g|webp|avif|svg|gif|mp3|ogg|wav|mp4|webm|glb|gltf|bin|ktx2|dds|hdr|exr|wasm)$/i;
const PRIVATE_PATH = /^\/(?:api|auth|socket\.io)(?:\/|$)/i;
const privatePath = pathname => {
  try { return PRIVATE_PATH.test(decodeURIComponent(pathname)); } catch { return true; }
};
const isMetadata = pathname => ['/version.json', '/pwa/app-build.js', '/manifest.webmanifest'].includes(pathname) || /^\/pwa\/.*\.json$/.test(pathname);
const isPublicAsset = url => !url.search && !url.hash && !privatePath(url.pathname) && ASSET_EXTENSIONS.test(url.pathname) &&
  (url.origin === self.location.origin || REMOTE_HOSTS.has(url.hostname));

async function enableNavigationPreload() {
  try { await self.registration.navigationPreload?.enable(); } catch { /* Optional optimization. */ }
}

self.addEventListener('install', event => {
  // A missing app shell must fail installation instead of replacing a good worker.
  // Large games are cached on demand, not all downloaded on every deployment.
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await cache.addAll(APP_SHELL.map(path => new Request(path, { cache: 'reload', credentials: 'omit' })));
    await enableNavigationPreload();
  })());
  // Do not skipWaiting here: the player chooses when an update can activate.
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => /^(tonplaygram-static-|tonplaygram-runtime-)/.test(name) && ![STATIC_CACHE, RUNTIME_CACHE].includes(name))
      .map(name => caches.delete(name)));
    await self.clients.claim();
    await enableNavigationPreload();
  })());
});

async function cacheResponse(cacheName, request, response) {
  if (!response || response.status !== 200 || response.type === 'opaque' || response.redirected) return;
  if (/\b(private|no-store)\b/i.test(response.headers.get('cache-control') || '')) return;
  const cache = await caches.open(cacheName);
  try { await cache.put(request, response.clone()); } catch { /* Cache quota must not break network playback. */ }
}

async function navigationResponse(event) {
  const request = event.request;
  let preload;
  try { preload = await event.preloadResponse; } catch { /* Try normal navigation. */ }
  try {
    const response = preload || await fetch(request, { cache: 'no-store' });
    // Query strings may contain Telegram/auth data; never persist those responses.
    if (!new URL(request.url).search) await cacheResponse(RUNTIME_CACHE, request, response);
    return response;
  } catch {
    const exact = !new URL(request.url).search ? await caches.match(request) : null;
    return exact || await caches.match('/index.html') || await caches.match(OFFLINE_FALLBACK) || Response.error();
  }
}

async function staleWhileRevalidate(event) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(event.request);
  const fresh = fetch(event.request).then(async response => {
    await cacheResponse(RUNTIME_CACHE, event.request, response);
    return response;
  });
  event.waitUntil(fresh.then(() => undefined, () => undefined));
  return cached || fresh.catch(() => Response.error());
}

async function warmManifest(path) {
  try {
    const response = await fetch(path, { cache: 'no-store', credentials: 'omit' });
    if (!response.ok) return;
    const assets = await response.json();
    if (!Array.isArray(assets)) return;
    // Explicit legacy warm requests remain supported, with bounded concurrency.
    let index = 0;
    await Promise.all(Array.from({ length: 3 }, async () => {
      while (index < assets.length) {
        const asset = assets[index++];
        try {
          if (typeof asset !== 'string') continue;
          const url = new URL(asset, self.location.origin);
          if (!isPublicAsset(url)) continue;
          const request = new Request(url.href, { credentials: 'omit' });
          await cacheResponse(RUNTIME_CACHE, request, await fetch(request));
        } catch { /* Individual assets are best effort. */ }
      }
    }));
  } catch { /* Keep the installed worker usable while offline. */ }
}

self.addEventListener('message', event => {
  const type = event.data?.type;
  if (type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting());
  if (type === 'CHECK_FOR_UPDATE') event.waitUntil(self.registration.update());
  if (type === 'WARM_GLTF_ASSETS') event.waitUntil(warmManifest('/pwa/gltf-assets.json'));
  if (type === 'WARM_HALLWAY_ASSETS') event.waitUntil(warmManifest('/pwa/hallway-assets.json'));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || request.headers.has('range')) return;
  const url = new URL(request.url);
  // Never cache APKs, release metadata, authenticated requests or API/wallet data.
  if (privatePath(url.pathname) || /\.(?:apk|aab|sha256)$/i.test(url.pathname) ||
      (request.credentials === 'include' && request.mode !== 'navigate') || ['authorization', 'x-telegram-init-data', 'x-tpc-account-id', 'x-google-id', 'x-native-auth'].some(name => request.headers.has(name))) return;
  if (url.origin === self.location.origin && isMetadata(url.pathname)) {
    event.respondWith(fetch(request, { cache: 'no-store' }));
    return;
  }
  if (url.origin === self.location.origin && request.mode === 'navigate') {
    event.respondWith(navigationResponse(event));
    return;
  }
  if (isPublicAsset(url)) event.respondWith(staleWhileRevalidate(event));
  // All other requests pass through normally, including third-party fetch APIs.
});
