import { TEXAS_DEFAULT_HDRI_ID, TEXAS_HDRI_OPTIONS } from '../config/texasHoldemInventoryConfig.js';

const DEFAULT_RESOLUTIONS = Object.freeze(['4k']);
const hdriUrlCache = new Map();
const hdriJsonPromiseCache = new Map();
const hdriWarmPromiseCache = new Map();
const arenaAssetWarmPromiseCache = new Map();
const FALLBACK_CHAIR_MODEL_URLS = Object.freeze([
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/AntiqueChair/glTF-Binary/AntiqueChair.glb',
  'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/AntiqueChair/glTF-Binary/AntiqueChair.glb'
]);

function buildPolyhavenModelUrls(assetId) {
  if (!assetId) return [];
  return [
    `https://dl.polyhaven.org/file/ph-assets/Models/gltf/2k/${assetId}/${assetId}_2k.gltf`,
    `https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/${assetId}/${assetId}_1k.gltf`
  ];
}

function prioritizeDefaultHdri(options = TEXAS_HDRI_OPTIONS) {
  const variants = Array.isArray(options) ? options.filter(Boolean) : [];
  const defaultIndex = variants.findIndex((variant) => variant?.id === TEXAS_DEFAULT_HDRI_ID);
  if (defaultIndex <= 0) return variants;
  const prioritized = variants.slice();
  const [defaultVariant] = prioritized.splice(defaultIndex, 1);
  return [defaultVariant, ...prioritized];
}

function pickPolyHavenHdriUrl(fileMap, preferredResolutions = DEFAULT_RESOLUTIONS) {
  if (!fileMap || typeof fileMap !== 'object') return null;
  const exr = fileMap?.exr || {};
  const hdr = fileMap?.hdr || {};
  for (const res of preferredResolutions) {
    if (typeof exr[res] === 'string' && exr[res]) return exr[res];
    if (typeof hdr[res] === 'string' && hdr[res]) return hdr[res];
  }
  const exrValues = Object.values(exr);
  const hdrValues = Object.values(hdr);
  return exrValues[0] || hdrValues[0] || null;
}

function getFallbackHdriUrl(config = {}, preferredResolutions = DEFAULT_RESOLUTIONS) {
  const fallbackResolution =
    config?.fallbackResolution || preferredResolutions[0] || DEFAULT_RESOLUTIONS[0] || '2k';
  const assetId = config?.assetId || 'neon_photostudio';
  return (
    config?.fallbackUrl ||
    `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/${fallbackResolution}/${assetId}_${fallbackResolution}.hdr`
  );
}

async function getPolyHavenFilesJson(assetId) {
  if (!assetId || typeof fetch !== 'function') return null;
  const key = String(assetId).toLowerCase();
  let pending = hdriJsonPromiseCache.get(key);
  if (!pending) {
    pending = fetch(`https://api.polyhaven.com/files/${encodeURIComponent(assetId)}`)
      .then((response) => (response?.ok ? response.json() : null))
      .catch(() => null);
    hdriJsonPromiseCache.set(key, pending);
  }
  return pending;
}

export async function resolveTexasHoldemHdriUrl(config = {}, preferred = DEFAULT_RESOLUTIONS) {
  const preferredResolutions =
    Array.isArray(config?.preferredResolutions) && config.preferredResolutions.length
      ? config.preferredResolutions
      : preferred;
  const cacheKey = String(config?.id || config?.assetId || getFallbackHdriUrl(config, preferredResolutions));
  if (hdriUrlCache.has(cacheKey)) {
    return hdriUrlCache.get(cacheKey);
  }

  if (config?.assetUrls && typeof config.assetUrls === 'object') {
    for (const res of preferredResolutions) {
      const url = config.assetUrls[res];
      if (typeof url === 'string' && url) {
        hdriUrlCache.set(cacheKey, url);
        return url;
      }
    }
    const manual = Object.values(config.assetUrls).find((value) => typeof value === 'string' && value.length);
    if (manual) {
      hdriUrlCache.set(cacheKey, manual);
      return manual;
    }
  }
  if (typeof config?.assetUrl === 'string' && config.assetUrl.length) {
    hdriUrlCache.set(cacheKey, config.assetUrl);
    return config.assetUrl;
  }

  const fallbackUrl = getFallbackHdriUrl(config, preferredResolutions);
  const filesJson = await getPolyHavenFilesJson(config?.assetId);
  const picked = pickPolyHavenHdriUrl(filesJson, preferredResolutions) || fallbackUrl;
  hdriUrlCache.set(cacheKey, picked);
  return picked;
}

export function warmTexasHoldemHdriFromLobby(options = TEXAS_HDRI_OPTIONS) {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return Promise.resolve();
  const variants = prioritizeDefaultHdri(options);
  const jobs = variants.map((variant) => {
    const key = variant?.id || variant?.assetId || variant?.fallbackUrl;
    if (!key) return Promise.resolve();
    if (hdriWarmPromiseCache.has(key)) return hdriWarmPromiseCache.get(key);

    const job = resolveTexasHoldemHdriUrl(variant)
      .then((url) => {
        if (!url) return null;
        return fetch(url, { mode: 'cors', cache: 'force-cache' });
      })
      .catch(() => null);

    hdriWarmPromiseCache.set(key, job);
    return job;
  });
  return Promise.allSettled(jobs);
}

export async function warmTexasHoldemArenaAssetsFromLobby() {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return null;
  const cacheKey = 'texas-holdem-default-arena-assets';
  if (arenaAssetWarmPromiseCache.has(cacheKey)) {
    return arenaAssetWarmPromiseCache.get(cacheKey);
  }

  const task = (async () => {
    const jobs = [warmTexasHoldemHdriFromLobby()];

    const [
      { TEXAS_CHAIR_THEME_OPTIONS, TEXAS_TABLE_THEME_OPTIONS },
      { CARD_THEMES, warmTexasHoldemCardsFromLobby },
      { warmTexasHoldemChipsFromLobby }
    ] =
      await Promise.all([
        import('../config/texasHoldemOptions.js'),
        import('./cards3d.js'),
        import('./chips3d.js')
      ]);

    const defaultChairTheme = TEXAS_CHAIR_THEME_OPTIONS?.[0];
    const defaultTableTheme = TEXAS_TABLE_THEME_OPTIONS?.[0];
    const defaultCardTheme = CARD_THEMES?.[0];

    const chairUrls = defaultChairTheme?.source === 'polyhaven' && defaultChairTheme?.assetId
      ? buildPolyhavenModelUrls(defaultChairTheme.assetId)
      : FALLBACK_CHAIR_MODEL_URLS;

    const tableUrls = defaultTableTheme?.source === 'polyhaven' && defaultTableTheme?.assetId
      ? buildPolyhavenModelUrls(defaultTableTheme.assetId)
      : [];

    [...chairUrls, ...tableUrls].forEach((url) => {
      jobs.push(fetch(url, { mode: 'cors', cache: 'force-cache' }).catch(() => null));
    });

    if (defaultCardTheme) {
      jobs.push(Promise.resolve(warmTexasHoldemCardsFromLobby(defaultCardTheme)));
    }
    jobs.push(Promise.resolve(warmTexasHoldemChipsFromLobby()));

    return Promise.allSettled(jobs);
  })();

  arenaAssetWarmPromiseCache.set(cacheKey, task);
  return task;
}
