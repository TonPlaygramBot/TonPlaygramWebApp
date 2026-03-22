import { io } from 'socket.io-client';
import { API_BASE_URL } from './api.js';

function normalizePath(path) {
  if (!path) return '/socket.io';
  const trimmed = String(path).trim();
  if (!trimmed) return '/socket.io';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
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

function getTelegramInitData() {
  if (typeof window === 'undefined') return '';
  return window?.Telegram?.WebApp?.initData || '';
}

function getStoredAccountId() {
  if (typeof window === 'undefined') return '';
  return window?.localStorage?.getItem('accountId') || '';
}

function getStoredGoogleId() {
  if (typeof window === 'undefined') return '';
  return window?.localStorage?.getItem('googleId') || '';
}

function buildSocketAuthPayload() {
  const initData = getTelegramInitData();
  const accountId = getStoredAccountId();
  const googleId = getStoredGoogleId();
  return {
    ...(initData ? { initData } : {}),
    ...(accountId ? { accountId } : {}),
    ...(googleId ? { googleId } : {})
  };
}

function deriveSocketPathFromApiBase(rawUrl) {
  if (!rawUrl) return '/socket.io';
  const fallback = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';

  try {
    const parsed = new URL(rawUrl, fallback);
    const cleanPath = parsed.pathname.replace(/\/+$/, '');
    if (!cleanPath || cleanPath === '/') return '/socket.io';

    // Most deployments expose REST APIs under `/api` but keep Socket.IO on the
    // default `/socket.io` endpoint. If we blindly append to `/api`, clients
    // attempt `/api/socket.io` and fail to connect.
    const baseWithoutApiSuffix = cleanPath.replace(/\/api(?:\/v\d+)?$/i, '');
    if (!baseWithoutApiSuffix || baseWithoutApiSuffix === '/') return '/socket.io';
    return `${baseWithoutApiSuffix}/socket.io`;
  } catch {
    return '/socket.io';
  }
}

function resolveSocketConfig() {
  const metaEnv = loadMetaEnv();
  const explicitUrl = metaEnv.VITE_SOCKET_URL;
  const explicitPath = metaEnv.VITE_SOCKET_PATH;

  const url = normalizeBaseUrl(explicitUrl || API_BASE_URL);
  const path = explicitPath
    ? normalizePath(explicitPath)
    : normalizePath(deriveSocketPathFromApiBase(API_BASE_URL));

  const options = {
    path,
    transports: ['websocket', 'polling'],
    auth: (cb) => cb(buildSocketAuthPayload()),
    reconnectionAttempts: 8,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
    timeout: 20000
  };

  return { url, options };
}

const { url, options } = resolveSocketConfig();

export const socket = io(url, options);
