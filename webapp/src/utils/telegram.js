import { createAccount } from "./api.js";
export function getTelegramId() {
  if (typeof window !== 'undefined') {
    const tgId = window?.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (tgId) {
      localStorage.setItem('telegramId', tgId);
      return tgId;
    }
    const stored = localStorage.getItem('telegramId');
    if (stored) return Number(stored);
  }
  // Fallback for non-Telegram browsers
  return 1;
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
  if (id) return id;
  const tgId = getTelegramId();
  try {
    const res = await createAccount(tgId);
    if (res && res.accountId) {
      localStorage.setItem('accountId', res.accountId);
      return res.accountId;
    }
  } catch {}
  return tgId;
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
