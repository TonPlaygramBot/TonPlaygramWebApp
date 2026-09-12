import { GAME_PACK_DEFINITIONS } from './gamePackDefinitions.js';
export const GAME_PACK_SCHEMA_VERSION = 1;
export const GAME_PACK_CATALOG_URL = '/pwa/game-packs/index.json';
export const GAME_PACK_CACHE_PREFIX = 'tonplaygram-pack-';
export const GAME_PACK_COMPLETE_PATH = '/pwa/game-packs/.complete';
const GAME_PACK_METADATA_CACHE = `${GAME_PACK_CACHE_PREFIX}metadata-v1`;
export const FALLBACK_GAME_PACK_CATALOG = Object.freeze({
  schemaVersion: 1, source: 'runtime-fallback',
  packs: GAME_PACK_DEFINITIONS.map(definition => ({
    ...definition, version: 'fallback-2', totalBytes: 0, assetCount: 0,
    manifestUrl: `/pwa/game-packs/${definition.id}.json`,
    fallbackManifest: {
      schemaVersion: 1, id: definition.id, version: 'fallback-2',
      dependencies: definition.dependencies || [],
      assets: (definition.files || []).map(file => `/${file}`),
      assetSources: ['/pwa/offline-assets.json', '/pwa/gltf-assets.json'].map(url => ({
        url, includePrefixes: (definition.roots || []).map(root => `/${root}/`),
        excludePrefixes: (definition.excludeRoots || []).map(root => `/${root}/`)
      }))
    }
  }))
});

let cachedCatalogPromise = null;

const absoluteUrl = (value, baseUrl) => {
  const base = baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  return new URL(value, base).toString();
};

const normalizePath = value => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
};

const normalizeAsset = value => {
  if (typeof value === 'string') {
    const url = normalizePath(value);
    return url ? { url, sourceUrl: url, size: 0, sha256: null } : null;
  }
  if (!value || typeof value !== 'object') return null;
  const url = normalizePath(value.url || value.path);
  if (!url) return null;
  return {
    url,
    sourceUrl: normalizePath(value.sourceUrl || value.url || value.path) || url,
    size: Number.isFinite(Number(value.size)) ? Math.max(0, Number(value.size)) : 0,
    sha256: typeof value.sha256 === 'string' && value.sha256.length ? value.sha256.toLowerCase() : null,
    contentType: typeof value.contentType === 'string' ? value.contentType : null
  };
};

const prefixMatches = (url, prefixes = []) => !prefixes.length || prefixes.some(prefix => url.startsWith(prefix));
const prefixExcluded = (url, prefixes = []) => prefixes.some(prefix => url.startsWith(prefix));

async function fetchJsonWithMetadataCache(url, networkFetch) {
  const request = new Request(absoluteUrl(url), { method: 'GET', credentials: 'same-origin' });
  try {
    const response = await networkFetch(request, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Request failed (${response.status}).`);
    const value = await response.clone().json();
    // A full/disabled cache must not turn a successful catalog fetch into failure.
    try {
      if (typeof caches !== 'undefined') {
        const cache = await caches.open(GAME_PACK_METADATA_CACHE);
        await cache.put(request, response);
      }
    } catch { /* Downloads report storage failures separately. */ }
    return value;
  } catch (networkError) {
    if (typeof caches !== 'undefined') {
      const cached = await caches.match(request, { ignoreVary: true });
      if (cached) return await cached.json();
    }
    throw networkError;
  }
}

const normalizeCatalog = catalog => {
  if (!catalog || !Array.isArray(catalog.packs)) throw new Error('Invalid game-pack catalog.');
  return {
    ...catalog,
    schemaVersion: Number(catalog.schemaVersion) || GAME_PACK_SCHEMA_VERSION,
    packs: catalog.packs
      .filter(pack => pack && typeof pack.id === 'string')
      .map(pack => ({
        ...pack,
        dependencies: Array.isArray(pack.dependencies) ? pack.dependencies : [],
        totalBytes: Number(pack.totalBytes) || 0,
        assetCount: Number(pack.assetCount) || 0
      }))
  };
};

export async function loadGamePackCatalog({ force = false, fetchImpl } = {}) {
  if (!force && cachedCatalogPromise) return cachedCatalogPromise;
  const networkFetch = fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);

  cachedCatalogPromise = (async () => {
    if (!networkFetch) return FALLBACK_GAME_PACK_CATALOG;
    try {
      return normalizeCatalog(await fetchJsonWithMetadataCache(GAME_PACK_CATALOG_URL, networkFetch));
    } catch (error) {
      console.warn('Using fallback game-pack catalog', error);
      return FALLBACK_GAME_PACK_CATALOG;
    }
  })();

  return cachedCatalogPromise;
}

export async function loadGamePackManifest(pack, { fetchImpl } = {}) {
  if (!pack) throw new Error('A game-pack definition is required.');
  const networkFetch = fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);

  if (networkFetch && pack.manifestUrl) {
    try {
      const manifest = await fetchJsonWithMetadataCache(pack.manifestUrl, networkFetch);
      if (!manifest || !Array.isArray(manifest.assets)) throw new Error('Invalid game-pack manifest.');
      return {
        ...manifest,
        id: manifest.id || pack.id,
        version: manifest.version || pack.version,
        dependencies: Array.isArray(manifest.dependencies) ? manifest.dependencies : pack.dependencies || []
      };
    } catch (error) {
      if (!pack.fallbackManifest) throw error;
      console.warn(`Using fallback manifest for ${pack.id}`, error);
    }
  }

  if (!pack.fallbackManifest) throw new Error(`No manifest is available for ${pack.id}.`);
  return {
    ...pack.fallbackManifest,
    id: pack.id,
    version: pack.version,
    dependencies: pack.dependencies || []
  };
}

export async function resolveGamePackAssets(manifest, { fetchImpl } = {}) {
  const networkFetch = fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
  const assets = new Map();

  for (const candidate of manifest.assets || []) {
    const asset = normalizeAsset(candidate);
    if (asset) assets.set(asset.url, asset);
  }

  if (networkFetch) {
    for (const assetSource of manifest.assetSources || []) {
      if (!assetSource?.url) continue;
      try {
        const sourceAssets = await fetchJsonWithMetadataCache(assetSource.url, networkFetch);
        if (!Array.isArray(sourceAssets)) continue;

        for (const candidate of sourceAssets) {
          const asset = normalizeAsset(candidate);
          if (!asset) continue;
          if (!prefixMatches(asset.url, assetSource.includePrefixes || [])) continue;
          if (prefixExcluded(asset.url, assetSource.excludePrefixes || [])) continue;
          if (!assets.has(asset.url)) assets.set(asset.url, asset);
        }
      } catch (error) {
        console.warn(`Unable to resolve game-pack asset source ${assetSource.url}`, error);
      }
    }
  }

  return [...assets.values()].sort((left, right) => left.url.localeCompare(right.url));
}

export function findGamePack(catalog, packId) {
  return catalog?.packs?.find(pack => pack.id === packId) || null;
}

export function findGamePackForSlug(catalog, slug) {
  return catalog?.packs?.find(pack => Array.isArray(pack.gameSlugs) && pack.gameSlugs.includes(slug)) || null;
}
