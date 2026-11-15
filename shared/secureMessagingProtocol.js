// Versioned wire format. Keep canonicalization identical in browser and server.
export const SECURE_MESSAGE_VERSION = 1;
export const SECURE_MESSAGE_ALGORITHM = 'P256-HKDF-SHA256-A256GCM';
export const SECURE_MESSAGE_TTLS = Object.freeze([0, 300, 3600, 86400, 604800]);
export const MAX_SECURE_ATTACHMENT_BYTES = 2 * 1024 * 1024;
export const MAX_SECURE_TEXT_LENGTH = 2000;

export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

export function normalizePublicKey(key) {
  if (!key || key.kty !== 'EC' || key.crv !== 'P-256' ||
      typeof key.x !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(key.x) ||
      typeof key.y !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(key.y) || 'd' in key) {
    throw new Error('Invalid public encryption key.');
  }
  return { kty: 'EC', crv: 'P-256', x: key.x, y: key.y };
}

export function keyFingerprintInput(bundle) {
  if (bundle?.version !== SECURE_MESSAGE_VERSION) throw new Error('Unsupported encryption key version.');
  return { version: SECURE_MESSAGE_VERSION,
    agreementKey: normalizePublicKey(bundle.agreementKey),
    signingKey: normalizePublicKey(bundle.signingKey) };
}

export function unsignedEnvelope(envelope) {
  const { signature: _signature, ...unsigned } = envelope;
  return unsigned;
}

export function messageAdditionalData(envelope) {
  const fields = ['version', 'algorithm', 'messageId', 'from', 'to', 'sentAt', 'ttlSeconds',
    'senderFingerprint', 'recipientFingerprint', 'ephemeralKey', 'salt', 'iv'];
  return Object.fromEntries(fields.map((field) => [field, envelope[field]]));
}

export function messageExpiresAt(envelope) {
  if (!envelope?.ttlSeconds) return null;
  return new Date(Date.parse(envelope.sentAt) + envelope.ttlSeconds * 1000).toISOString();
}
