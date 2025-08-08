import { fetchTelegramInfo } from "./api.js";

export function isTelegramWebView() {
  if (typeof window === 'undefined') return false;
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  return Boolean(window.Telegram?.WebApp || ua.includes('Telegram'));
}
export function getTelegramId() {
  if (typeof window !== 'undefined') {
    const tgId = window?.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (tgId) {
      localStorage.setItem('telegramId', tgId);
      return tgId;
    }
    const params = new URLSearchParams(window.location.search);
    const urlId = params.get('tg') || params.get('telegramId');
    if (urlId) {
      localStorage.setItem('telegramId', urlId);
      return Number(urlId);
    }
    const stored = localStorage.getItem('telegramId');
    if (stored) return Number(stored);
  }
  return null;
}

export function getPlayerId() {
  if (typeof window !== 'undefined') {
    const aid = localStorage.getItem('accountId');
    if (aid) return aid;
  }
  return getTelegramId();
}

export async function ensureAccountId() {
  if (typeof window === 'undefined') return null;
  let id = localStorage.getItem('accountId');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('accountId', id);
  }
  return id;
}

export async function signAccountId(id) {
  const secret = import.meta.env.VITE_BOT_TOKEN;
  if (!id || !secret) return '';
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(String(id)));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
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
