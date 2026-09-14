/* The main worker consults completed downloads before runtime caches. */
(() => {
  const PACK_CACHE_PREFIX = 'tonplaygram-pack-';
  const APP_CACHE_PREFIX = `${PACK_CACHE_PREFIX}tonplaygram-app-`;
  const COMPLETE_PATH = '/pwa/game-packs/.complete';
  const CACHEABLE_PATH = /^\/(?:assets|models|game-preloads|lib|vendor)\//;
  const CACHEABLE_EXTENSION = /\.(?:glb|gltf|bin|wasm|ktx2|basis|dds|hdr|exr|png|jpe?g|webp|avif|svg|mp3|ogg|wav|m4a|mp4|webm|woff2?|ttf|otf|json|css|js|html|txt)$/i;
  const nativeFetch = self.fetch.bind(self);
  // Cache names contain the manifest content version. A completed version cannot
  // legitimately change its build; keep its legacy receipt parse out of the hot
  // asset path. Still check the marker and requested file on every lookup so
  // staging, removal, and browser eviction take effect immediately.
  const receiptBuilds = new WeakMap();
  const MAX_RECEIPT_BUILDS = 32;
  function readCompletedBuild(storage, name, marker) {
    const build = marker.headers.get('X-TonPlaygram-App-Build');
    if (build) return Promise.resolve(build);
    let entries = receiptBuilds.get(storage);
    if (!entries) receiptBuilds.set(storage, entries = new Map());
    if (entries.has(name)) return entries.get(name);
    if (entries.size >= MAX_RECEIPT_BUILDS) entries.delete(entries.keys().next().value);
    const pending = marker.json().then(receipt => receipt?.build || null).catch(() => {
      if (entries.get(name) === pending) entries.delete(name);
      return null;
    });
    entries.set(name, pending);
    return pending;
  }

  const matchDownload = async (request, { navigation = false } = {}) => {
    if (request.method !== 'GET' || ['no-store', 'reload'].includes(request.cache) || request.headers.get('X-TonPlaygram-Verify') === '1') return null;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin || /^\/(?:api|auth|socket\.io|colyseus)(?:\/|$)/.test(url.pathname)) return null;
    if (['/version.json', '/service-worker.js', '/pwa/app-build.js', '/pwa/game-pack-service-worker.js'].includes(url.pathname) || url.pathname.startsWith('/pwa/game-packs/')) return null;
    const names = (await self.caches.keys()).filter(name => name.startsWith(PACK_CACHE_PREFIX));
    // The full app is authoritative; do not let an old per-game copy shadow it.
    names.sort((a, b) => Number(b.startsWith(APP_CACHE_PREFIX)) - Number(a.startsWith(APP_CACHE_PREFIX)));
    for (const name of names) {
      const fullApp = name.startsWith(APP_CACHE_PREFIX);
      if (!fullApp && (navigation || (!CACHEABLE_PATH.test(url.pathname) && !CACHEABLE_EXTENSION.test(url.pathname)))) continue;
      const cache = await self.caches.open(name);
      const marker = await cache.match(new URL(COMPLETE_PATH, self.location.origin).href);
      if (!marker) {
        receiptBuilds.get(self.caches)?.delete(name);
        continue;
      }
      // Never combine this build's shell with another build's un-hashed files.
      if (fullApp && await readCompletedBuild(self.caches, name, marker) !== self.__TONPLAYGRAM_APP_BUILD__) continue;
      const exact = await cache.match(request, { ignoreVary: true });
      if (exact) return exact;
      // The public Domino module has an explicit current-build cache-buster;
      // only this known alias may match its verified manifest URL.
      if (fullApp && url.pathname === '/domino-royal-game.js' &&
          [...url.searchParams].length === 1 && url.searchParams.get('v') === self.__TONPLAYGRAM_APP_BUILD__) {
        const entrypoint = await cache.match(new URL(url.pathname, url.origin).href, { ignoreVary: true });
        if (entrypoint) return entrypoint;
      }
      // Only SPA navigations may resolve to index.html; missing binary URLs must
      // remain misses. Search parameters on a game route are not cache keys.
      if (navigation && (url.pathname === '/' || url.pathname === '/index.html' || !/\.[^/]+$/.test(url.pathname))) {
        const shell = await cache.match(new URL('/index.html', self.location.origin).href);
        if (shell) return shell;
      }
    }
    return null;
  };
  self.matchTonPlaygramDownload = matchDownload;
  // Compatibility for legacy callers. The main fetch handler also consults the
  // cache directly, before a stale runtime response can win.
  self.fetch = async (input, init) => {
    let request;
    try { request = new Request(input, init); } catch { return nativeFetch(input, init); }
    try {
      const cached = await matchDownload(request);
      if (cached && !request.headers.has('range')) return cached;
    } catch { /* Use the network when storage is unavailable. */ }
    return nativeFetch(input, init);
  };
})();
