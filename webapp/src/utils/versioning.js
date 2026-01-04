import { API_BASE_URL } from './api.js';
import { resolveRuntimeEnv } from './env.js';

const env = resolveRuntimeEnv();
const DEFAULT_VERSION_ENDPOINT = env.VITE_VERSION_ENDPOINT || '/api/app/version';
const FALLBACK_VERSION_URL = env.VITE_VERSION_FALLBACK || '/pwa/version.json';

export const CURRENT_BUILD =
  (typeof window !== 'undefined' && window.APP_BUILD && String(window.APP_BUILD)) || 'dev';

function resolveUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  if (API_BASE_URL && path.startsWith('/')) return `${API_BASE_URL}${path}`;
  return path;
}

async function loadVersionFromUrl(url) {
  if (!url) return null;
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data || typeof data !== 'object') return null;
    if (!data.build && !data.version && !data.appBuild) return null;
    const build = String(data.build || data.version || data.appBuild);
    return { build, meta: data, source: url };
  } catch (err) {
    console.warn('Version check failed for', url, err);
    return null;
  }
}

export async function fetchLatestVersion() {
  const candidates = [
    resolveUrl(DEFAULT_VERSION_ENDPOINT),
    resolveUrl(FALLBACK_VERSION_URL),
    FALLBACK_VERSION_URL
  ].filter(Boolean);

  for (const url of candidates) {
    const result = await loadVersionFromUrl(url);
    if (result) return result;
  }

  return null;
}

