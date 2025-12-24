import { createAccount } from './api.js';
import { ensureAccountId } from './telegram.js';

function readLocal(key) {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key, value) {
  if (typeof window === 'undefined') return;
  try {
    if (value === undefined || value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function resolveOwnerKey(telegramId, googleId) {
  if (telegramId) return `tg:${telegramId}`;
  if (googleId) return `gg:${googleId}`;
  return 'anon';
}

/**
 * Ensure we have a persistent TPC account for the current user/device.
 * - Reuses the stored account when present.
 * - Creates a new account for first-time visitors.
 * - Avoids creating duplicate accounts on every login.
 */
export async function provisionAccount({ telegramId, googleId } = {}) {
  const ownerKey = resolveOwnerKey(telegramId, googleId);
  const lastOwner = readLocal('accountOwnerKey');
  if (lastOwner && lastOwner !== ownerKey) {
    writeLocal('accountProvisioned', null);
  }
  writeLocal('accountOwnerKey', ownerKey);

  let accountId = readLocal('accountId');
  if (!accountId) {
    accountId = await ensureAccountId();
  }

  const alreadyProvisioned =
    readLocal('accountProvisioned') === 'true' && Boolean(accountId);

  if (alreadyProvisioned) {
    return {
      accountId,
      walletAddress: readLocal('walletAddress')
    };
  }

  const res = await createAccount({
    telegramId,
    googleId,
    accountId
  });

  if (res?.error) throw new Error(res.error);

  const finalAccountId = res?.accountId || accountId;
  if (finalAccountId) {
    writeLocal('accountId', finalAccountId);
  }
  if (res?.walletAddress) {
    writeLocal('walletAddress', res.walletAddress);
  }
  writeLocal('accountProvisioned', 'true');

  return {
    accountId: finalAccountId,
    walletAddress: res?.walletAddress || readLocal('walletAddress')
  };
}

export function getStoredAccount() {
  const accountId = readLocal('accountId');
  const walletAddress = readLocal('walletAddress');
  return { accountId, walletAddress };
}
