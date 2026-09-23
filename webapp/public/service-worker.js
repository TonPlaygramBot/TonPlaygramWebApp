/* Build-aware service worker: this file is copied as-is from /public. The build
 * marker in /pwa/app-build.js is generated at build time to keep caches in sync
 * with the currently packaged assets. */


self.__TONPLAYGRAM_APP_BUILD__ = self.__TONPLAYGRAM_APP_BUILD__ || 'dev';
try {
  importScripts('/pwa/app-build.js');
  importScripts('/assets/external/url-map.js');
} catch (err) {
  // Best-effort: fall back to the bundled default when the marker is missing.
}

const APP_BUILD =
  typeof self.__TONPLAYGRAM_APP_BUILD__ === 'string' &&
  self.__TONPLAYGRAM_APP_BUILD__.trim()
    ? self.__TONPLAYGRAM_APP_BUILD__.trim()
    : 'dev';

const STATIC_CACHE = `tonplaygram-static-${APP_BUILD}`;
const RUNTIME_CACHE = `tonplaygram-runtime-${APP_BUILD}`;
const OFFLINE_FALLBACK = '/offline.html';
const GLTF_MANIFEST_PATH = '/pwa/gltf-assets.json';
const HALLWAY_MANIFEST_PATH = '/pwa/hallway-assets.json';
const VERSION_ASSETS = ['/version.json', '/pwa/app-build.js'];

const APP_SHELL = [
  '/',
  '/index.html',
  OFFLINE_FALLBACK,
  '/manifest.webmanifest',
  GLTF_MANIFEST_PATH,
  HALLWAY_MANIFEST_PATH,
  '/tonconnect-manifest.json',
  '/power-slider.css',
  ...VERSION_ASSETS,
  '/assets/icons/generated/app-icon-192.png',
  '/assets/icons/generated/app-icon-512.png',
  '/assets/icons/file_00000000efd081f78539cff614489f91.png',
  '/assets/icons/file_000000003f7861f481d50537fb031e13.png',
  '/assets/splash/splash-828x1792.png',
  '/assets/splash/splash-1125x2436.png',
  '/assets/splash/splash-1170x2532.png',
  '/assets/splash/splash-1242x2688.png',
  '/assets/splash/splash-1284x2778.png'
];

const PREFETCH_RUNTIME_ASSETS = [
  '/flag-emojis.js',
  '/init.js',
  '/texas-holdem.js',
  '/lib/texasHoldem.js',
  '/lib/texasHoldemGame.js',
  '/domino-royal-game.js',
  '/roulette.html',
  '/chess-royale.html',
  '/pool-royale-bracket.html',
  '/pool-royale-api.js',
  '/lib/poolAi.js',
  '/snooker-royale-bracket.html',
  '/snooker-royale-api.js',
  '/game-preloads/pool-royale-preload.txt',
  '/game-preloads/snooker-royale-preload.txt',
  '/power-slider.js',
  '/power-slider.css'
];

const GLTF_EXTENSIONS = /\.(gltf|glb|bin|ktx2|dds|hdr|exr)$/i;
const MANAGED_GAME_ASSET_PREFIXES = [
  '/assets/tirana-streets/',
  '/assets/tirana-detail-kit/',
  '/assets/tirana-landmarks/',
  '/assets/blackwater/',
  '/assets/kart-royale/',
  '/assets/pool-royale/',
  '/models/pool-royale/',
  '/assets/table-tennis/',
  '/assets/royal-lanes/'
];
const shouldWarmAsset = asset =>
  !MANAGED_GAME_ASSET_PREFIXES.some(prefix => asset.startsWith(prefix));
const REMOTE_CACHEABLE_DESTINATIONS = ['font', 'image', 'model', ''];
const REMOTE_CACHEABLE_HOSTS = new Set([
  'cdn.jsdelivr.net',
  'fastly.jsdelivr.net',
  'raw.githubusercontent.com',
  'dl.polyhaven.org',
  'api.polyhaven.com'
]);

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

const warmGltfAssets = async ({ forceReload = false } = {}) => {
  try {
    const manifestResponse = await fetch(GLTF_MANIFEST_PATH, { cache: 'no-store' });
    if (!manifestResponse.ok) return;
    const manifest = await manifestResponse.json();
    if (!Array.isArray(manifest) || !manifest.length) return;

    const cache = await caches.open(RUNTIME_CACHE);
    await Promise.all(
      manifest.map(async asset => {
        if (typeof asset !== 'string' || !GLTF_EXTENSIONS.test(asset) || !shouldWarmAsset(asset)) return;
        try {
          const request = new Request(asset, {
            cache: forceReload ? 'reload' : 'default',
            mode: 'cors'
          });
          const response = await fetch(request);
          if (response?.ok) {
            await cache.put(request, response.clone());
          }
        } catch (err) {
          // GLTF warming is best-effort
        }
      })
    );
  } catch (err) {
    // Ignore manifest failures to avoid blocking install
  }
};

const warmHallwayAssets = async ({ forceReload = false } = {}) => {
  try {
    const manifestResponse = await fetch(HALLWAY_MANIFEST_PATH, { cache: 'no-store' });
    if (!manifestResponse.ok) return;
    const manifest = await manifestResponse.json();
    if (!Array.isArray(manifest) || !manifest.length) return;

    const cache = await caches.open(RUNTIME_CACHE);
    await Promise.all(
      manifest.map(async asset => {
        if (typeof asset !== 'string') return;
        try {
          const request = new Request(asset, {
            cache: forceReload ? 'reload' : 'default',
            mode: 'cors'
          });
          const response = await fetch(request);
          if (response?.ok) {
            await cache.put(request, response.clone());
          }
        } catch (err) {
          // hallway warming is best-effort
        }
      })
    );
  } catch (err) {
    // Ignore manifest failures to avoid blocking install
  }
};

self.addEventListener('install', event => {
  event.waitUntil(
    precache().catch(() => {})
  );
  self.skipWaiting();
});

const cleanupCaches = async () => {
  const cacheNames = await caches.keys();
  const deletions = cacheNames
    .filter(name => /^tonplaygram-(?:static|runtime)-/.test(name) && ![STATIC_CACHE, RUNTIME_CACHE].includes(name))
    .map(name => caches.delete(name));
  await Promise.all(deletions);
};

self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      cleanupCaches(),
      self.clients.claim(),
      self.registration?.navigationPreload?.disable()
    ]).catch(() => {})
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
  if (type === 'WARM_GLTF_ASSETS') {
    event.waitUntil(warmGltfAssets({ forceReload: true }));
  }
  if (type === 'WARM_HALLWAY_ASSETS') {
    event.waitUntil(warmHallwayAssets({ forceReload: true }));
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
      (await (await caches.open(RUNTIME_CACHE)).match(request)) ||
      (await (await caches.open(STATIC_CACHE)).match('/index.html')) ||
      (await (await caches.open(STATIC_CACHE)).match(OFFLINE_FALLBACK));
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
    .catch(error => {
      if (cached) return cached;
      throw error;
    });

  if (cached) {
    fetchPromise.catch(() => {});
    return cached;
  }

  try {
    const response = await fetchPromise;
    if (response) return response;
  } catch (error) {
    // fall through to deterministic error response
  }

  return Response.error();
};

const handleNavigationRequest = event => {
  event.respondWith(
    networkFirst(event, event.request).catch(async () => {
      const cached = (await caches.match('/index.html')) || (await caches.match(OFFLINE_FALLBACK));
      return cached || Response.error();
    })
  );
};

async function downloadedResponse(request) {
  const response = await self.matchTonPlaygramDownload?.(request, { navigation: request.mode === 'navigate' });
  if (!response || !request.headers.has('range')) return response;
  // HTML media elements use Range requests. CacheStorage stores full bodies.
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range'));
  if (!range) return null;
  const buffer = await response.arrayBuffer();
  const length = buffer.byteLength;
  const start = range[1] ? Number(range[1]) : Math.max(0, length - Number(range[2]));
  const end = range[1] && range[2] ? Math.min(Number(range[2]), length - 1) : length - 1;
  if ((!range[1] && !range[2]) || start > end || start >= length) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${length}` } });
  }
  const headers = new Headers(response.headers);
  headers.set('Content-Range', `bytes ${start}-${end}/${length}`);
  headers.set('Content-Length', String(end - start + 1));
  headers.set('Accept-Ranges', 'bytes');
  return new Response(buffer.slice(start, end + 1), { status: 206, headers });
}

const LIVE_SERVICE_PATH = /^\/(?:api|auth|socket\.io|colyseus)(?:\/|$)/;
const LOCAL_PUBLIC_ASSET_PATH = /^\/(?:assets|models|vendor|lib|game-preloads)\//;
const VENDORED_PUBLIC_TARGETS = new Set(Object.values(self.__TONPLAYGRAM_EXTERNAL_ASSETS__ || {}).flatMap(value => {
  if (typeof value !== 'string') return [];
  try {
    const url = new URL(value, self.location.origin);
    return url.origin === self.location.origin && LOCAL_PUBLIC_ASSET_PATH.test(url.pathname) ? [url.href] : [];
  } catch { return []; }
}));

function mappedPublicRequest(request, url) {
  const map = self.__TONPLAYGRAM_EXTERNAL_ASSETS__;
  if (!map) return null;
  const key = url.href.replace(/#.*$/, '');
  // Page-side mapping may have already rewritten the provider URL. The same
  // immutable public file must remain usable offline through that direct URL.
  if (VENDORED_PUBLIC_TARGETS.has(key)) return request;
  // Standalone glTF loaders may prepend their original provider origin to a
  // root-relative rewritten sidecar URI. Accept only a known bundled target.
  const rootedTarget = new URL(url.pathname, self.location.origin).href;
  const mapped = Object.prototype.hasOwnProperty.call(map, key) ? map[key]
    : url.pathname.startsWith('/assets/external/') && !url.search && VENDORED_PUBLIC_TARGETS.has(rootedTarget) ? rootedTarget : null;
  if (typeof mapped !== 'string') return null;
  let localUrl;
  try { localUrl = new URL(mapped, self.location.origin); } catch { return null; }
  if (localUrl.origin !== self.location.origin || !LOCAL_PUBLIC_ASSET_PATH.test(localUrl.pathname)) return null;
  return new Request(localUrl, {
    method: 'GET',
    headers: request.headers,
    credentials: 'same-origin',
    mode: 'same-origin',
    cache: request.cache,
    redirect: request.redirect
  });
}

async function serveMappedPublicRequest(request) {
  // Provider metadata is immutable once bundled into this app build. Runtime
  // no-store/reload requests can use its verified download offline; the explicit
  // installer verification header below is the authority for fresh server bytes.
  // Preserve Range while bypassing the legacy helper's generic no-store guard.
  try {
    const downloaded = await downloadedResponse(new Request(request, { cache: 'default' }));
    if (downloaded) return downloaded;
  } catch { /* Storage eviction must still fall back to the local deployment. */ }
  // Cache misses retain the requested cache policy at the local deployment.
  return fetch(request);
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // A social install has its own shell. The main game download must never
  // substitute index.html while the social worker is taking control.
  if (url.origin === self.location.origin && (url.pathname === '/social-app' || url.pathname.startsWith('/social-app/'))) return;
  // Never rewrite personalized traffic, even if an invalid mapping was added.
  if (LIVE_SERVICE_PATH.test(url.pathname) || request.headers.has('authorization')) return;
  if (request.headers.get('X-TonPlaygram-Verify') === '1') {
    event.respondWith(fetch(request));
    return;
  }

  // Resolve public provider URLs before no-store/reload bypasses. In particular,
  // a no-store Poly Haven metadata request must not escape back to its provider.
  // Direct local requests need no map scan: the normal download lookup handles
  // them, avoiding Object.values(map) work on every game asset request.
  const mappedRequest = mappedPublicRequest(request, url);
  if (mappedRequest) {
    event.respondWith(serveMappedPublicRequest(mappedRequest).catch(() => Response.error()));
    return;
  }
  // Update metadata and installer requests always reach the current deployment.
  if (['no-store', 'reload'].includes(request.cache) || VERSION_ASSETS.includes(url.pathname) || url.pathname.startsWith('/pwa/game-packs/')) {
    event.respondWith(fetch(request));
    return;
  }
  const isSameOrigin = url.origin === self.location.origin;

  event.respondWith((async () => {
    try {
      const downloaded = await downloadedResponse(request);
      if (downloaded) return downloaded;
    } catch { /* Fall back normally when the browser has evicted storage. */ }
    if (request.mode === 'navigate') return networkFirst(event, request);
    const destinations = ['script', 'style', 'font', 'image', 'audio', 'video', 'model'];
    if ((isSameOrigin && (destinations.includes(request.destination) || GLTF_EXTENSIONS.test(url.pathname))) ||
        (!isSameOrigin && (REMOTE_CACHEABLE_DESTINATIONS.includes(request.destination) || REMOTE_CACHEABLE_HOSTS.has(url.host)))) {
      return staleWhileRevalidate(request);
    }
    return fetch(request);
  })().catch(() => Response.error()));
});
