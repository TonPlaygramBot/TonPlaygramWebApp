import crypto from 'crypto';

const receiptWindowMs =
  Number(process.env.REWARD_RECEIPT_WINDOW_MS) || 5 * 60 * 1000;

const usedNonces = new Map();

function cleanupNonces(now) {
  for (const [nonce, ts] of usedNonces.entries()) {
    if (now - ts > receiptWindowMs) {
      usedNonces.delete(nonce);
    }
  }
}

function buildCanonicalPayload(payload) {
  return Object.entries(payload)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('&');
}

export function signRewardReceipt(payload, secret) {
  const canonical = buildCanonicalPayload(payload);
  return crypto.createHmac('sha256', secret).update(canonical).digest('hex');
}

export function verifyRewardReceipt(payload, receipt, secret) {
  if (!secret) return { ok: false, error: 'missing_secret' };
  if (!receipt) return { ok: false, error: 'missing_receipt' };
  const now = Date.now();
  const ts = Number(payload.ts);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > receiptWindowMs) {
    return { ok: false, error: 'expired_receipt' };
  }
  const nonce = payload.nonce;
  if (!nonce) return { ok: false, error: 'missing_nonce' };
  cleanupNonces(now);
  if (usedNonces.has(nonce)) {
    return { ok: false, error: 'reused_nonce' };
  }
  const expected = signRewardReceipt(payload, secret);
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(receipt))) {
    return { ok: false, error: 'invalid_receipt' };
  }
  usedNonces.set(nonce, now);
  return { ok: true };
}
