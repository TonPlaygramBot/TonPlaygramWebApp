import { clearDeviceCredentialId, loadDeviceCredentialId, saveDeviceCredentialId } from './deviceBiometric.ts';

const LOCK_CONFIG_KEY = 'tpc-profile-lock';
const UNLOCKED_FLAG = 'tpc-profile-lock-unlocked';
const DEVICE_CREDENTIAL_STORAGE_KEY = 'tpc-device-credential-id';

const textEncoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
const CONFIG_VERSION = 2;

let secureCredentialCache = null;
if (typeof window !== 'undefined') {
  loadDeviceCredentialId()
    .then((id) => {
      secureCredentialCache = id;
      if (id) localStorage.setItem(DEVICE_CREDENTIAL_STORAGE_KEY, id);
    })
    .catch(() => {
      secureCredentialCache = null;
    });
}

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

function normalizeConfig(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    method: raw.method || null,
    salt: raw.salt || '',
    hash: raw.hash || '',
    credentialId: raw.credentialId || null,
    recoveryCodes: Array.isArray(raw.recoveryCodes) ? raw.recoveryCodes : [],
    lastUpdated: raw.lastUpdated || Date.now(),
    deviceInfo: raw.deviceInfo || null,
    version: raw.version || CONFIG_VERSION
  };
}

export function loadLockConfig() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOCK_CONFIG_KEY);
    return raw ? normalizeConfig(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function clearLockConfig() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(LOCK_CONFIG_KEY);
    sessionStorage.removeItem(UNLOCKED_FLAG);
    localStorage.removeItem(DEVICE_CREDENTIAL_STORAGE_KEY);
    void clearDeviceCredentialId();
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

function generateRecoveryCodes(count = 3) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const chunk = Array.from(crypto?.getRandomValues?.(new Uint8Array(8)) || [])
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    codes.push(chunk.slice(0, 4) + '-' + chunk.slice(4, 8));
  }
  return codes;
}

export async function setSecretLock({ method, secret }) {
  if (!method || !secret) return { ok: false, error: 'missing_fields' };
  const trimmed = secret.trim();
  if (method === 'password' && trimmed.length < 8) {
    return { ok: false, error: 'password_too_short' };
  }
  if ((method === 'pin' || method === 'pattern') && trimmed.length < 4) {
    return { ok: false, error: 'pin_too_short' };
  }
  const salt = generateSalt();
  const hashed = await sha256(`${salt}:${trimmed}`);
  if (!hashed) return { ok: false, error: 'hash_failed' };
  if (typeof window === 'undefined') return { ok: false, error: 'unavailable' };
  const recoveryCodes = generateRecoveryCodes();
  const recoveryHashes = await Promise.all(
    recoveryCodes.map(async (code) => sha256(`${salt}:${code}`))
  );
  const payload = {
    method,
    salt,
    hash: hashed,
    recoveryCodes: recoveryHashes.filter(Boolean),
    lastUpdated: Date.now(),
    version: CONFIG_VERSION
  };
  try {
    localStorage.setItem(LOCK_CONFIG_KEY, JSON.stringify(payload));
    sessionStorage.removeItem(UNLOCKED_FLAG);
    return { ok: true, recoveryCodes };
  } catch {
    return { ok: false, error: 'storage_failed' };
  }
}

export async function verifySecret(secret) {
  const cfg = loadLockConfig();
  if (!cfg?.hash || !cfg?.salt) return false;
  const hashed = await sha256(`${cfg.salt}:${secret}`);
  return Boolean(hashed && hashed === cfg.hash);
}

export async function verifyRecoveryCode(code) {
  const cfg = loadLockConfig();
  if (!cfg?.recoveryCodes?.length || !cfg?.salt) return false;
  const hashed = await sha256(`${cfg.salt}:${code.trim()}`);
  if (!hashed) return false;
  const match = cfg.recoveryCodes.includes(hashed);
  if (match) {
    try {
      const remaining = cfg.recoveryCodes.filter((h) => h !== hashed);
      const updated = { ...cfg, recoveryCodes: remaining, lastUpdated: Date.now() };
      localStorage.setItem(LOCK_CONFIG_KEY, JSON.stringify(updated));
    } catch {
      // best effort
    }
  }
  return match;
}

export function storeDeviceCredentialId(id) {
  if (!id || typeof window === 'undefined') return;
  try {
    const cfg = loadLockConfig() || { method: 'device' };
    cfg.method = 'device';
    cfg.credentialId = id;
    cfg.salt = cfg.salt || generateSalt();
    cfg.hash = cfg.hash || '';
    cfg.lastUpdated = Date.now();
    cfg.deviceInfo = { userAgent: navigator?.userAgent || 'unknown', platform: navigator?.platform };
    cfg.version = CONFIG_VERSION;
    localStorage.setItem(LOCK_CONFIG_KEY, JSON.stringify(cfg));
    sessionStorage.removeItem(UNLOCKED_FLAG);
    localStorage.setItem(DEVICE_CREDENTIAL_STORAGE_KEY, id);
    void saveDeviceCredentialId(id);
  } catch {
    // ignore
  }
}

export function getDeviceCredentialId() {
  const cfg = loadLockConfig();
  const local = localStorage.getItem(DEVICE_CREDENTIAL_STORAGE_KEY);
  return local || cfg?.credentialId || secureCredentialCache || null;
}
