import { fetchTelegramInfo } from "./api.js";

export function isTelegramWebView() {
  if (typeof window === 'undefined') return false;
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  return Boolean(window.Telegram?.WebApp || ua.includes('Telegram'));
}

const storage = {
  get(key) {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  set(key, value) {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage?.setItem(key, value);
    } catch {
      // ignore storage failures (private mode, blocked storage)
    }
  },
  remove(key) {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage?.removeItem(key);
    } catch {
      // ignore storage failures (private mode, blocked storage)
    }
  }
};

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
      storage.set('telegramId', telegramId);
      return telegramId;
    }
    const params = new URLSearchParams(window.location.search);
    const urlId = params.get('tg') || params.get('telegramId');
    if (urlId) {
      const parsed = parseTelegramId(urlId);
      if (parsed != null) {
        storage.set('telegramId', parsed);
        return parsed;
      }
      storage.remove('telegramId');
    }
    const stored = storage.get('telegramId');
    if (stored) {
      const parsed = parseTelegramId(stored);
      if (parsed != null) return parsed;
      storage.remove('telegramId');
    }
  }
  return null;
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
  let id = storage.get('accountId');
  if (!id) {
    id = generateAccountId();
    if (id) storage.set('accountId', id);
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
    const stored = storage.get('telegramUsername');
    if (stored) return stored;
  }
  return '';
}

export function getTelegramFirstName() {
  if (typeof window !== 'undefined') {
    const first = window?.Telegram?.WebApp?.initDataUnsafe?.user?.first_name;
    if (first) return first;
    const stored = storage.get('telegramFirstName');
    if (stored) return stored;
  }
  return '';
}

export function getTelegramLastName() {
  if (typeof window !== 'undefined') {
    const last = window?.Telegram?.WebApp?.initDataUnsafe?.user?.last_name;
    if (last) return last;
    const stored = storage.get('telegramLastName');
    if (stored) return stored;
  }
  return '';
}

export function getTelegramUserData() {
  if (typeof window !== 'undefined') {
    const user = window?.Telegram?.WebApp?.initDataUnsafe?.user;
    if (user) return user;
    const stored = storage.get('telegramUserData');
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
      storage.set('telegramPhotoUrl', photo);
      return photo;
    }
    const stored = storage.get('telegramPhotoUrl');
    if (stored) return stored;
    const id = getTelegramId();
    if (id) {
      fetchTelegramInfo(id)
        .then((info) => {
          if (info?.photoUrl) {
            storage.set('telegramPhotoUrl', info.photoUrl);
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
    ].forEach((key) => storage.remove(key));
  } catch {
    // ignore
  }
}
