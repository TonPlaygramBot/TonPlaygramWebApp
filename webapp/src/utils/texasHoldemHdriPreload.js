import { TEXAS_DEFAULT_HDRI_ID, TEXAS_HDRI_OPTIONS } from '../config/texasHoldemInventoryConfig.js';
import { TEXAS_CHAIR_THEME_OPTIONS, TEXAS_TABLE_THEME_OPTIONS } from '../config/texasHoldemOptions.js';

const DEFAULT_RESOLUTIONS = Object.freeze(['4k', '2k', '1k']);
const hdriUrlCache = new Map();
const hdriJsonPromiseCache = new Map();
const hdriWarmPromiseCache = new Map();
const modelWarmPromiseCache = new Map();
const imageWarmPromiseCache = new Map();
const TEXAS_CARD_BACK_LOGO_SRC = '/assets/icons/file_00000000bc2862439eecffff3730bbe4.webp';

function buildPolyHavenModelUrls(assetId) {
  if (!assetId) return [];
  return [
    `https://dl.polyhaven.org/file/ph-assets/Models/gltf/2k/${assetId}/${assetId}_2k.gltf`,
    `https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/${assetId}/${assetId}_1k.gltf`
  ];
}

function warmImageAsset(src) {
  if (!src || typeof window === 'undefined') return Promise.resolve();
  if (imageWarmPromiseCache.has(src)) return imageWarmPromiseCache.get(src);
  const job = new Promise((resolve) => {
    const image = new Image();
    image.loading = 'eager';
    image.decoding = 'async';
    image.src = src;
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
  });
  imageWarmPromiseCache.set(src, job);
  return job;
}

function warmModelManifestAndEntry(assetId) {
  if (!assetId || typeof fetch !== 'function') return Promise.resolve();
  const cacheKey = String(assetId).toLowerCase();
  if (modelWarmPromiseCache.has(cacheKey)) return modelWarmPromiseCache.get(cacheKey);

  const job = fetch(`https://api.polyhaven.com/files/${encodeURIComponent(assetId)}`)
    .then((response) => (response?.ok ? response.json() : null))
    .then((files) => {
      const gltf2k = files?.gltf?.['2k'];
      if (typeof gltf2k === 'string' && gltf2k) {
        return fetch(gltf2k, { mode: 'cors', cache: 'force-cache' }).catch(() => null);
      }
      return null;
    })
    .catch(() => null)
    .then((result) => {
      if (result) return result;
      const fallbackUrls = buildPolyHavenModelUrls(assetId);
      return Promise.allSettled(
        fallbackUrls.map((url) => fetch(url, { mode: 'cors', cache: 'force-cache' }))
      );
    });

  modelWarmPromiseCache.set(cacheKey, job);
  return job;
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
  const urls = [];
  const walk = (value) => {
    if (!value) return;
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (value.startsWith('http') && (lower.includes('.hdr') || lower.includes('.exr'))) {
        urls.push(value);
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (typeof value === 'object') {
      Object.values(value).forEach(walk);
    }
  };
  walk(fileMap);

  if (!urls.length) return null;
  const lowerUrls = urls.map((url) => url.toLowerCase());
  const chooseByResolution = (resolution) => {
    const withUnderscore = lowerUrls
      .map((url, index) => ({ url, index }))
      .filter(({ url }) => url.includes(`_${resolution}.`));
    if (withUnderscore.length) {
      const hdrMatch = withUnderscore.find(({ url }) => url.includes('.hdr'));
      return urls[(hdrMatch || withUnderscore[0]).index];
    }
    const withPathSegment = lowerUrls
      .map((url, index) => ({ url, index }))
      .filter(({ url }) => url.includes(`/${resolution}/`));
    if (withPathSegment.length) {
      const hdrMatch = withPathSegment.find(({ url }) => url.includes('.hdr'));
      return urls[(hdrMatch || withPathSegment[0]).index];
    }
    return null;
  };
  for (const resolution of preferredResolutions) {
    const resolved = chooseByResolution(resolution);
    if (resolved) return resolved;
  }
  const firstHdr = lowerUrls.findIndex((url) => url.includes('.hdr'));
  if (firstHdr >= 0) return urls[firstHdr];
  return urls[0] || null;
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
  const requestedResolutions = Array.isArray(preferred)
    ? preferred.filter((value) => typeof value === 'string' && value.length)
    : [];
  const configResolutions = Array.isArray(config?.preferredResolutions)
    ? config.preferredResolutions.filter((value) => typeof value === 'string' && value.length)
    : [];
  const preferredResolutions = Array.from(new Set([...requestedResolutions, ...configResolutions]));
  if (!preferredResolutions.length) {
    preferredResolutions.push(...DEFAULT_RESOLUTIONS);
  }
  const cacheKey = `${String(config?.id || config?.assetId || getFallbackHdriUrl(config, preferredResolutions))}|${preferredResolutions.join(',')}`;
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

function normalizePreferredResolutions(preferred = DEFAULT_RESOLUTIONS) {
  const requested = Array.isArray(preferred)
    ? preferred.filter((value) => typeof value === 'string' && value.length)
    : [];
  return requested.length ? Array.from(new Set(requested)) : [...DEFAULT_RESOLUTIONS];
}

export function warmTexasHoldemHdriFromLobby(options = TEXAS_HDRI_OPTIONS, preferredResolutions = DEFAULT_RESOLUTIONS) {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return Promise.resolve();
  const variants = prioritizeDefaultHdri(options);
  const normalizedPreferredResolutions = normalizePreferredResolutions(preferredResolutions);
  const jobs = variants.map((variant) => {
    const variantId = variant?.id || variant?.assetId || variant?.fallbackUrl;
    const key = `${variantId ?? 'unknown'}|${normalizedPreferredResolutions.join(',')}`;
    if (!key) return Promise.resolve();
    if (hdriWarmPromiseCache.has(key)) return hdriWarmPromiseCache.get(key);

    const job = resolveTexasHoldemHdriUrl(variant, normalizedPreferredResolutions)
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

export function warmTexasHoldemArenaAssetsFromLobby() {
  if (typeof window === 'undefined') return Promise.resolve();
  const storedFrameRate = window.localStorage?.getItem('texasHoldemFrameRate');
  const preferredResolutionsByFrameRate = {
    uhd120: ['8k', '4k', '2k', '1k'],
    qhd90: ['4k', '2k', '1k'],
    fhd60: ['2k', '1k']
  };
  const preferredResolutions = preferredResolutionsByFrameRate[storedFrameRate] || DEFAULT_RESOLUTIONS;
  const defaultTable = TEXAS_TABLE_THEME_OPTIONS[0];
  const defaultChair = TEXAS_CHAIR_THEME_OPTIONS[0];
  const jobs = [
    warmTexasHoldemHdriFromLobby(TEXAS_HDRI_OPTIONS, preferredResolutions),
    warmImageAsset(TEXAS_CARD_BACK_LOGO_SRC)
  ];

  if (defaultTable?.source === 'polyhaven' && defaultTable?.assetId) {
    jobs.push(warmModelManifestAndEntry(defaultTable.assetId));
  }
  if (defaultChair?.source === 'polyhaven' && defaultChair?.assetId) {
    jobs.push(warmModelManifestAndEntry(defaultChair.assetId));
  }

  return Promise.allSettled(jobs);
}
