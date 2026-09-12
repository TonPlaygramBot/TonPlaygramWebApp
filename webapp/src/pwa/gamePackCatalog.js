export const GAME_PACK_SCHEMA_VERSION = 1;
export const GAME_PACK_CATALOG_URL = '/pwa/game-packs/index.json';
export const GAME_PACK_CACHE_PREFIX = 'tonplaygram-pack-';
const GAME_PACK_METADATA_CACHE = `${GAME_PACK_CACHE_PREFIX}metadata-v1`;

const source = (includePrefixes, excludePrefixes = []) => ({
  url: '/pwa/offline-assets.json',
  includePrefixes,
  excludePrefixes
});

const gltfSource = (includePrefixes, excludePrefixes = []) => ({
  url: '/pwa/gltf-assets.json',
  includePrefixes,
  excludePrefixes
});

const fallbackManifest = ({ id, version, dependencies = [], prefixes, excludes = [], assets = [] }) => ({
  schemaVersion: GAME_PACK_SCHEMA_VERSION,
  id,
  version,
  dependencies,
  assets,
  assetSources: [source(prefixes, excludes), gltfSource(prefixes, excludes)]
});

export const FALLBACK_GAME_PACK_CATALOG = Object.freeze({
  schemaVersion: GAME_PACK_SCHEMA_VERSION,
  generatedAt: null,
  source: 'runtime-fallback',
  packs: [
    {
      id: 'shared-tirana-vehicles',
      title: 'Shared Tirana Vehicle Fleet',
      description: 'Vehicle models shared by Tirana Streets and Racing Royal.',
      version: 'fallback-1',
      manifestUrl: '/pwa/game-packs/shared-tirana-vehicles.json',
      hidden: true,
      route: null,
      cover: '/assets/kart-royale/cover.webp',
      dependencies: [],
      totalBytes: 0,
      assetCount: 0,
      fallbackManifest: fallbackManifest({
        id: 'shared-tirana-vehicles',
        version: 'fallback-1',
        prefixes: ['/assets/tirana-streets/vehicle-collection/']
      })
    },
    {
      id: 'tirana-streets',
      gameSlugs: ['tiranastreets'],
      title: 'Tirana Streets',
      description: 'City, landmark, street-life, vehicle and operation assets.',
      version: 'fallback-1',
      manifestUrl: '/pwa/game-packs/tirana-streets.json',
      route: '/games/tiranastreets/lobby',
      cover: '/assets/tirana-streets/map.svg',
      dependencies: ['shared-tirana-vehicles'],
      totalBytes: 0,
      assetCount: 0,
      fallbackManifest: fallbackManifest({
        id: 'tirana-streets',
        version: 'fallback-1',
        dependencies: ['shared-tirana-vehicles'],
        prefixes: [
          '/assets/tirana-streets/',
          '/assets/tirana-detail-kit/',
          '/assets/tirana-landmarks/',
          '/assets/blackwater/'
        ],
        excludes: ['/assets/tirana-streets/vehicle-collection/']
      })
    },
    {
      id: 'racing-royal',
      gameSlugs: ['kartroyale'],
      title: 'Racing Royal',
      description: 'Tracks, vehicles, environments and racing presentation assets.',
      version: 'fallback-1',
      manifestUrl: '/pwa/game-packs/racing-royal.json',
      route: '/games/kartroyale/lobby',
      cover: '/assets/kart-royale/cover.webp',
      dependencies: ['shared-tirana-vehicles'],
      totalBytes: 0,
      assetCount: 0,
      fallbackManifest: fallbackManifest({
        id: 'racing-royal',
        version: 'fallback-1',
        dependencies: ['shared-tirana-vehicles'],
        prefixes: ['/assets/kart-royale/']
      })
    },
    {
      id: 'pool-royale',
      gameSlugs: ['poolroyale', 'snookerroyale'],
      title: 'Pool & Snooker Royale',
      description: 'Tables, arenas, materials, cues and offline game entry assets.',
      version: 'fallback-1',
      manifestUrl: '/pwa/game-packs/pool-royale.json',
      route: '/games/poolroyale/lobby',
      cover: '/assets/icons/pool-royale.svg',
      dependencies: [],
      totalBytes: 0,
      assetCount: 0,
      fallbackManifest: fallbackManifest({
        id: 'pool-royale',
        version: 'fallback-1',
        prefixes: ['/assets/pool-royale/', '/models/pool-royale/'],
        assets: [
          '/pool-royale-bracket.html',
          '/pool-royale-api.js',
          '/snooker-royale-bracket.html',
          '/snooker-royale-api.js',
          '/lib/poolAi.js',
          '/game-preloads/pool-royale-preload.txt',
          '/game-preloads/snooker-royale-preload.txt',
          '/power-slider.js',
          '/power-slider.css'
        ]
      })
    },
    {
      id: 'table-tennis-royal',
      gameSlugs: ['tabletennisroyal', 'tennisroyal'],
      title: 'Table Tennis & Tennis Royal',
      description: 'Athletes, arenas, rackets, tables and court assets.',
      version: 'fallback-1',
      manifestUrl: '/pwa/game-packs/table-tennis-royal.json',
      route: '/games/tabletennisroyal/lobby',
      cover: '/assets/icons/table-tennis-royal.svg',
      dependencies: [],
      totalBytes: 0,
      assetCount: 0,
      fallbackManifest: fallbackManifest({
        id: 'table-tennis-royal',
        version: 'fallback-1',
        prefixes: ['/assets/table-tennis/']
      })
    },
    {
      id: 'royal-lanes',
      gameSlugs: ['royallanes'],
      title: 'Royal Lanes Bowling',
      description: 'Bowling lane, ball, pin, character and arena assets.',
      version: 'fallback-1',
      manifestUrl: '/pwa/game-packs/royal-lanes.json',
      route: '/games/royallanes/lobby',
      cover: '/assets/royal-lanes/mark.svg',
      dependencies: [],
      totalBytes: 0,
      assetCount: 0,
      fallbackManifest: fallbackManifest({
        id: 'royal-lanes',
        version: 'fallback-1',
        prefixes: ['/assets/royal-lanes/']
      })
    }
  ]
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
    if (typeof caches !== 'undefined') {
      const cache = await caches.open(GAME_PACK_METADATA_CACHE);
      await cache.put(request, response.clone());
    }
    return await response.json();
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
