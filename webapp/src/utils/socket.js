import { io } from 'socket.io-client';
import { API_BASE_URL } from './api.js';

function normalizePath(path) {
  if (!path) return '/socket.io';
  return path.startsWith('/') ? path : `/${path}`;
}

function normalizeBaseUrl(rawUrl) {
  const fallback = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
  if (!rawUrl) return fallback;

  try {
    const parsed = new URL(rawUrl, fallback);
    parsed.pathname = '';
    parsed.search = '';
    parsed.hash = '';

    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && parsed.protocol === 'http:') {
      parsed.protocol = 'https:';
    }

    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return rawUrl.replace(/\/+$/, '') || fallback;
  }
}

function loadMetaEnv() {
  try {
    // eslint-disable-next-line no-new-func
    const resolved = Function('try { return import.meta.env || {}; } catch (e) { return {}; }')();
    if (resolved && typeof resolved === 'object') return resolved;
  } catch {
    // ignore
  }
  return {};
}

function resolveSocketConfig() {
  const metaEnv = loadMetaEnv();
  const explicitUrl = metaEnv.VITE_SOCKET_URL;
  const explicitPath = metaEnv.VITE_SOCKET_PATH;

  const url = normalizeBaseUrl(explicitUrl || API_BASE_URL);
  const path = normalizePath(explicitPath);

  const options = {
    path,
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 8,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
    timeout: 20000
  };

  return { url, options };
}

const { url, options } = resolveSocketConfig();

export const socket = io(url, options);
