import { io } from 'socket.io-client';
import { API_BASE_URL } from './api.js';

function resolveSocketConfig() {
  const explicitUrl = import.meta.env.VITE_SOCKET_URL;
  const explicitPath = import.meta.env.VITE_SOCKET_PATH;

  let rawUrl =
    explicitUrl ||
    API_BASE_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '');

  const options = { transports: ['websocket', 'polling'] };

  const applyDefaultPath = () => {
    if (!options.path) {
      options.path = '/socket.io';
    }
  };

  if (explicitPath) {
    options.path = explicitPath;
  }

  if (!rawUrl) {
    applyDefaultPath();
    return { url: rawUrl, options };
  }

  try {
    const base = typeof window !== 'undefined' ? window.location.href : 'http://localhost';
    const parsed = new URL(rawUrl, base);
    if (!explicitPath) {
      const trimmedPath = parsed.pathname.replace(/\/+$/, '');
      if (trimmedPath && trimmedPath !== '') {
        options.path = `${trimmedPath}/socket.io`;
      }
    }
    parsed.pathname = '';
    parsed.search = '';
    parsed.hash = '';
    rawUrl = parsed.toString().replace(/\/+$/, '');
  } catch {
    if (!explicitPath) {
      if (/\/socket\.io\/?$/.test(rawUrl)) {
        options.path = '/socket.io';
        rawUrl = rawUrl.replace(/\/socket\.io\/?$/, '');
      } else if (/\/api\/?$/.test(rawUrl)) {
        options.path = '/socket.io';
        rawUrl = rawUrl.replace(/\/api\/?$/, '');
      }
    }
    rawUrl = rawUrl.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && rawUrl.startsWith('http:')) {
    rawUrl = rawUrl.replace(/^http:/, 'https:');
  }

  applyDefaultPath();
  return { url: rawUrl, options };
}

const { url, options } = resolveSocketConfig();

export const socket = io(url, options);
