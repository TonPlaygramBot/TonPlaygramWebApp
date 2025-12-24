import { createAccount } from './api.js';

const OWNER_KEY = 'accountOwner';

function normalizeId(id) {
  if (id == null) return null;
  return String(id);
}

function readOwner() {
  const raw = localStorage.getItem(OWNER_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return {
      telegramId: parsed.telegramId ? String(parsed.telegramId) : null,
      googleId: parsed.googleId || null
    };
  } catch {
    return {};
  }
}

export function persistAccountLocally({ accountId, walletAddress, telegramId, googleId }) {
  if (accountId) localStorage.setItem('accountId', accountId);
  if (walletAddress) localStorage.setItem('walletAddress', walletAddress);

  const owner = {};
  if (telegramId) owner.telegramId = normalizeId(telegramId);
  if (googleId) owner.googleId = googleId;

  if (owner.telegramId || owner.googleId) {
    localStorage.setItem(OWNER_KEY, JSON.stringify(owner));
  }
}

export function getStoredAccount() {
  const accountId = localStorage.getItem('accountId');
  const walletAddress = localStorage.getItem('walletAddress');
  const owner = readOwner();

  if (!accountId) return null;

  return {
    accountId,
    walletAddress,
    telegramId: owner.telegramId || null,
    googleId: owner.googleId || null
  };
}

export async function ensureAccountForUser({ telegramId, googleId } = {}) {
  const normalizedTelegram = normalizeId(telegramId);
  const normalizedGoogle = googleId || null;
  const cached = getStoredAccount();

  const matchesCached =
    cached?.accountId &&
    (!normalizedTelegram || cached.telegramId === normalizedTelegram) &&
    (!normalizedGoogle || cached.googleId === normalizedGoogle);

  if (matchesCached) {
    const merged = {
      ...cached,
      telegramId: cached.telegramId || normalizedTelegram,
      googleId: cached.googleId || normalizedGoogle
    };
    if (normalizedTelegram || normalizedGoogle) {
      persistAccountLocally(merged);
    }
    return merged;
  }

  const res = await createAccount(normalizedTelegram, normalizedGoogle);
  if (res?.error) throw new Error(res.error);

  const account = {
    accountId: res.accountId,
    walletAddress: res.walletAddress || cached?.walletAddress || null,
    telegramId: normalizedTelegram,
    googleId: normalizedGoogle
  };

  persistAccountLocally(account);
  return account;
}
