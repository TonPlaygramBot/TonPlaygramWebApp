import { fetchTelegramInfo } from "./api.js";

export function isTelegramWebView() {
  if (typeof window === 'undefined') return false;
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  return Boolean(window.Telegram?.WebApp || ua.includes('Telegram'));
}

function parseTelegramId(value) {
  if (value == null) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getTelegramId() {
  if (typeof window !== 'undefined') {
    const tgId = window?.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    const telegramId = parseTelegramId(tgId);
    if (telegramId != null) {
      localStorage.setItem('telegramId', telegramId);
      return telegramId;
    }
    const params = new URLSearchParams(window.location.search);
    const urlId = params.get('tg') || params.get('telegramId');
    if (urlId) {
      const parsed = parseTelegramId(urlId);
      if (parsed != null) {
        localStorage.setItem('telegramId', parsed);
        return parsed;
      }
      localStorage.removeItem('telegramId');
    }
    const stored = localStorage.getItem('telegramId');
    if (stored) {
      const parsed = parseTelegramId(stored);
      if (parsed != null) return parsed;
      localStorage.removeItem('telegramId');
    }
  }
  return null;
}

export function getTelegramBotUsername() {
  if (typeof document === 'undefined') return '';
  const meta = document.querySelector('meta[name="telegram:web_app:bot_username"]');
  const content = meta?.getAttribute('content') || meta?.content || '';
  return content.trim();
}

export function getTelegramStartParam() {
  if (typeof window === 'undefined') return '';
  const initStart =
    window?.Telegram?.WebApp?.initDataUnsafe?.start_param ||
    window?.Telegram?.WebApp?.initDataUnsafe?.startParam;
  if (initStart) return String(initStart);
  const params = new URLSearchParams(window.location.search);
  const urlStart =
    params.get('tgWebAppStartParam') ||
    params.get('start_param') ||
    params.get('startapp') ||
    params.get('start') ||
    params.get('ref');
  if (urlStart) return urlStart;
  return localStorage.getItem('telegramStartParam') || '';
}

export function getTelegramReturnUrl() {
  if (typeof window === 'undefined') return undefined;
  const botUsername = getTelegramBotUsername();
  if (!botUsername) return undefined;
  const startParam = getTelegramStartParam();
  const base = `https://t.me/${botUsername}`;
  if (!startParam) return base;
  return `${base}?startapp=${encodeURIComponent(startParam)}`;
}

function generateAccountId() {
  if (typeof window === 'undefined') return null;
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  const random = Math.random().toString(36).slice(2, 11);
  const timestamp = Date.now().toString(36);
  return `tpc-${timestamp}-${random}`;
}

export function getPlayerId() {
  if (typeof window === 'undefined') return null;
  let id = localStorage.getItem('accountId');
  if (!id) {
    id = generateAccountId();
    if (id) localStorage.setItem('accountId', id);
  }
  return id;
}

export async function ensureAccountId() {
  if (typeof window === 'undefined') return null;
  return getPlayerId();
}

export function getTelegramUsername() {
  if (typeof window !== 'undefined') {
    const name = window?.Telegram?.WebApp?.initDataUnsafe?.user?.username;
    if (name) return name;
    const stored = localStorage.getItem('telegramUsername');
    if (stored) return stored;
  }
  return '';
}

export function getTelegramFirstName() {
  if (typeof window !== 'undefined') {
    const first = window?.Telegram?.WebApp?.initDataUnsafe?.user?.first_name;
    if (first) return first;
    const stored = localStorage.getItem('telegramFirstName');
    if (stored) return stored;
  }
  return '';
}

export function getTelegramLastName() {
  if (typeof window !== 'undefined') {
    const last = window?.Telegram?.WebApp?.initDataUnsafe?.user?.last_name;
    if (last) return last;
    const stored = localStorage.getItem('telegramLastName');
    if (stored) return stored;
  }
  return '';
}

export function getTelegramUserData() {
  if (typeof window !== 'undefined') {
    const user = window?.Telegram?.WebApp?.initDataUnsafe?.user;
    if (user) return user;
    const stored = localStorage.getItem('telegramUserData');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function getTelegramPhotoUrl() {
  if (typeof window !== 'undefined') {
    const photo = window?.Telegram?.WebApp?.initDataUnsafe?.user?.photo_url;
    if (photo) {
      localStorage.setItem('telegramPhotoUrl', photo);
      return photo;
    }
    const stored = localStorage.getItem('telegramPhotoUrl');
    if (stored) return stored;
    const id = getTelegramId();
    if (id) {
      fetchTelegramInfo(id)
        .then((info) => {
          if (info?.photoUrl) {
            localStorage.setItem('telegramPhotoUrl', info.photoUrl);
            window.dispatchEvent(new Event('profilePhotoUpdated'));
          }
        })
        .catch(() => {});
    }
  }
  return '';
}

export function parseTelegramPostLink(link) {
  const m = link.match(/TonPlaygram\/(?:([0-9]+)\/)?([0-9]+)/);
  return {
    threadId: m && m[1] ? Number(m[1]) : undefined,
    messageId: m && m[2] ? Number(m[2]) : undefined,
  };
}

export function clearTelegramCache() {
  if (typeof window === 'undefined') return;
  try {
    [
      'telegramId',
      'telegramUsername',
      'telegramFirstName',
      'telegramLastName',
      'telegramUserData',
      'telegramPhotoUrl'
    ].forEach((key) => localStorage.removeItem(key));
  } catch {
    // ignore
  }
}
