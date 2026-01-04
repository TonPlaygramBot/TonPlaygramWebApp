const LOCK_CONFIG_KEY = 'tpc-profile-lock';
const UNLOCKED_FLAG = 'tpc-profile-lock-unlocked';

const textEncoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;

async function sha256(text) {
  if (!textEncoder || !crypto?.subtle) return null;
  try {
    const data = textEncoder.encode(text);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return null;
  }
}

export function loadLockConfig() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOCK_CONFIG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearLockConfig() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(LOCK_CONFIG_KEY);
    sessionStorage.removeItem(UNLOCKED_FLAG);
  } catch {
    // ignore
  }
}

export function markUnlockedSession() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(UNLOCKED_FLAG, '1');
  } catch {
    // ignore
  }
}

export function isUnlocked() {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(UNLOCKED_FLAG) === '1';
  } catch {
    return false;
  }
}

function generateSalt() {
  if (!crypto?.getRandomValues) return Math.random().toString(36).slice(2);
  return Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function setSecretLock({ method, secret }) {
  if (!method || !secret) return false;
  const salt = generateSalt();
  const hashed = await sha256(`${salt}:${secret}`);
  if (!hashed) return false;
  if (typeof window === 'undefined') return false;
  const payload = { method, salt, hash: hashed };
  try {
    localStorage.setItem(LOCK_CONFIG_KEY, JSON.stringify(payload));
    sessionStorage.removeItem(UNLOCKED_FLAG);
    return true;
  } catch {
    return false;
  }
}

export async function verifySecret(secret) {
  const cfg = loadLockConfig();
  if (!cfg?.hash || !cfg?.salt) return false;
  const hashed = await sha256(`${cfg.salt}:${secret}`);
  return Boolean(hashed && hashed === cfg.hash);
}

export function storeDeviceCredentialId(id) {
  if (!id || typeof window === 'undefined') return;
  try {
    const cfg = loadLockConfig() || { method: 'device' };
    cfg.method = 'device';
    cfg.credentialId = id;
    cfg.salt = cfg.salt || generateSalt();
    cfg.hash = cfg.hash || '';
    localStorage.setItem(LOCK_CONFIG_KEY, JSON.stringify(cfg));
    sessionStorage.removeItem(UNLOCKED_FLAG);
  } catch {
    // ignore
  }
}

export function getDeviceCredentialId() {
  const cfg = loadLockConfig();
  return cfg?.credentialId || null;
}
