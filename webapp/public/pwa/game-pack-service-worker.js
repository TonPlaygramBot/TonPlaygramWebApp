/* Imported by /pwa/app-build.js inside the service worker. It keeps separately
 * versioned game-pack caches alive across shell updates and serves their assets
 * before reaching the network. */
(() => {
  const PACK_CACHE_PREFIX = 'tonplaygram-pack-';
  const PATCH_FLAG = Symbol.for('tonplaygram.game-pack-worker-patched');
  const CACHEABLE_PATH = /^\/(?:assets|models|game-preloads|lib)\//;
  const CACHEABLE_EXTENSION = /\.(?:glb|gltf|bin|ktx2|basis|dds|hdr|exr|png|jpe?g|webp|avif|svg|mp3|ogg|wav|m4a|json|css|js|html|txt)$/i;

  if (self[PATCH_FLAG] || !self.caches) return;
  self[PATCH_FLAG] = true;

  const cacheStoragePrototype = Object.getPrototypeOf(self.caches);
  const nativeDelete = cacheStoragePrototype.delete;
  const nativeOpen = cacheStoragePrototype.open;
  const nativeFetch = self.fetch.bind(self);

  try {
    cacheStoragePrototype.delete = function protectedGamePackDelete(cacheName) {
      if (String(cacheName).startsWith(PACK_CACHE_PREFIX)) return Promise.resolve(false);
      return nativeDelete.call(this, cacheName);
    };
  } catch {
    // Cache protection is best-effort; the page-side manager still remains usable.
  }

  const shouldUsePackCache = request => {
    if (!request || request.method !== 'GET' || ['no-store', 'reload'].includes(request.cache)) return false;
    try {
      const url = new URL(request.url);
      return (
        url.origin === self.location.origin &&
        (CACHEABLE_PATH.test(url.pathname) || CACHEABLE_EXTENSION.test(url.pathname))
      );
    } catch {
      return false;
    }
  };

  const matchPack = async request => {
    const cacheNames = (await self.caches.keys())
      .filter(name => name.startsWith(PACK_CACHE_PREFIX))
      .reverse();
    for (const cacheName of cacheNames) {
      const cache = await nativeOpen.call(self.caches, cacheName);
      if (!(await cache.match(new URL('/pwa/game-packs/.complete', self.location.origin).href))) continue;
      const response = await cache.match(request, { ignoreVary: true });
      if (response) return response;
    }
    return null;
  };

  try {
    self.fetch = async (input, init) => {
      let request;
      try {
        request = new Request(input, init);
      } catch {
        return nativeFetch(input, init);
      }

      if (shouldUsePackCache(request)) {
        try {
          const cached = await matchPack(request);
          if (cached) return cached.clone();
        } catch {
          // The normal service-worker strategy remains the fallback.
        }
      }
      return nativeFetch(input, init);
    };
  } catch {
    // Some worker implementations expose a non-writable fetch binding.
  }
})();
