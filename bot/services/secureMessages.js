import { createHash, webcrypto } from 'node:crypto';
import { stableStringify, unsignedEnvelope } from '../../shared/secureMessagingProtocol.js';

export const MESSAGE_TTLS = new Set([0, 300, 3600, 86400, 604800]);
export const MAX_ENVELOPE_BYTES = 4 * 1024 * 1024;
const ALGORITHM = 'P256-HKDF-SHA256-A256GCM';

export function socialError(status, code, message = code) {
  return Object.assign(new Error(message), { status, code });
}

function exactFields(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).sort().join('|') !== [...fields].sort().join('|')) {
    throw socialError(400, 'invalid_envelope', 'Unsupported encrypted message format.');
  }
}

function base64url(value, bytes, max = bytes) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) return false;
  const buffer = Buffer.from(value, 'base64url');
  return buffer.toString('base64url') === value && buffer.length >= bytes && buffer.length <= max;
}

async function validatePublicKey(key, usage) {
  exactFields(key, ['kty', 'crv', 'x', 'y']);
  if (key.kty !== 'EC' || key.crv !== 'P-256' || !base64url(key.x, 32) || !base64url(key.y, 32)) {
    throw socialError(400, 'invalid_public_key');
  }
  try {
    return await webcrypto.subtle.importKey('jwk', key,
      { name: usage === 'verify' ? 'ECDSA' : 'ECDH', namedCurve: 'P-256' }, false, usage ? [usage] : []);
  } catch {
    throw socialError(400, 'invalid_public_key');
  }
}

export async function validateKeyBundle(bundle) {
  exactFields(bundle, ['version', 'agreementKey', 'signingKey', 'fingerprint']);
  if (bundle.version !== 1 || !/^[a-f0-9]{64}$/.test(bundle.fingerprint)) {
    throw socialError(400, 'invalid_key_bundle');
  }
  await Promise.all([validatePublicKey(bundle.agreementKey), validatePublicKey(bundle.signingKey, 'verify')]);
  const normalized = { version: 1, agreementKey: bundle.agreementKey, signingKey: bundle.signingKey };
  const fingerprint = createHash('sha256').update(stableStringify(normalized)).digest('hex');
  if (bundle.fingerprint !== fingerprint) throw socialError(400, 'invalid_key_fingerprint');
  return { ...normalized, fingerprint };
}

export async function validateEnvelope(envelope, { sender, recipient, senderBundle, recipientBundle, now = Date.now() }) {
  exactFields(envelope, ['version', 'algorithm', 'messageId', 'from', 'to', 'sentAt', 'ttlSeconds',
    'senderFingerprint', 'recipientFingerprint', 'senderBundle', 'ephemeralKey', 'salt', 'iv',
    'ciphertext', 'wrappedKeys', 'signature']);
  if (Buffer.byteLength(JSON.stringify(envelope)) > MAX_ENVELOPE_BYTES) throw socialError(413, 'message_too_large');
  if (envelope.version !== 1 || envelope.algorithm !== ALGORITHM ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(envelope.messageId) ||
      envelope.from !== sender || envelope.to !== recipient || sender === recipient ||
      !MESSAGE_TTLS.has(envelope.ttlSeconds)) throw socialError(400, 'invalid_envelope');
  const sentAt = Date.parse(envelope.sentAt);
  if (!Number.isFinite(sentAt) || new Date(sentAt).toISOString() !== envelope.sentAt ||
      Math.abs(now - sentAt) > 5 * 60 * 1000) throw socialError(400, 'message_clock_skew', 'Check your device time and send again.');
  const expiresAt = envelope.ttlSeconds ? new Date(sentAt + envelope.ttlSeconds * 1000) : undefined;
  if (expiresAt && expiresAt.getTime() <= now) throw socialError(410, 'message_expired');
  if (!senderBundle || !recipientBundle ||
      envelope.senderFingerprint !== senderBundle.fingerprint ||
      envelope.recipientFingerprint !== recipientBundle.fingerprint) throw socialError(409, 'key_changed', 'A conversation key changed. Review the security code before sending again.');
  const suppliedSender = await validateKeyBundle(envelope.senderBundle);
  if (stableStringify(suppliedSender) !== stableStringify(senderBundle)) throw socialError(400, 'invalid_sender_key');
  await validatePublicKey(envelope.ephemeralKey);
  if (!base64url(envelope.salt, 32) || !base64url(envelope.iv, 12) ||
      !base64url(envelope.ciphertext, 16, 3 * 1024 * 1024) || !base64url(envelope.signature, 64)) {
    throw socialError(400, 'invalid_envelope');
  }
  exactFields(envelope.wrappedKeys, ['sender', 'recipient']);
  for (const wrapped of Object.values(envelope.wrappedKeys)) {
    exactFields(wrapped, ['iv', 'ciphertext']);
    if (!base64url(wrapped.iv, 12) || !base64url(wrapped.ciphertext, 48)) throw socialError(400, 'invalid_envelope');
  }
  const signingKey = await validatePublicKey(senderBundle.signingKey, 'verify');
  const valid = await webcrypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, signingKey,
    Buffer.from(envelope.signature, 'base64url'), Buffer.from(stableStringify(unsignedEnvelope(envelope))));
  if (!valid) throw socialError(400, 'invalid_message_signature');
  return { expiresAt, createdAt: new Date(now) };
}

export function identityAliases(user) {
  return [...new Set([user?.accountId, user?.telegramId, user?.telegramId != null ? String(user.telegramId) : undefined]
    .filter((value) => value != null && value !== ''))];
}

export function areMutualFriends(a, b) {
  const accepts = (owner, peer) => (owner.friends || []).some((friend) =>
    identityAliases(peer).some((id) => String(id) === String(friend)));
  return Boolean(a && b && a.accountId !== b.accountId && accepts(a, b) && accepts(b, a));
}

export function activeMessageFilter(accountId, now = new Date()) {
  return { deletedAt: { $exists: false }, deletedFor: { $ne: String(accountId) },
    $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }] };
}

export function conversationFilter(self, peer) {
  const own = identityAliases(self);
  const other = identityAliases(peer);
  return { $or: [
    { from: { $in: own }, to: { $in: other } },
    { from: { $in: other }, to: { $in: own } }
  ] };
}

export function isParticipant(message, user) {
  return identityAliases(user).some((id) => String(id) === String(message.from) || String(id) === String(message.to));
}

export function serializeMessage(message) {
  const raw = message.toObject ? message.toObject() : message;
  const { _id, from, to, createdAt, expiresAt, envelope, text, attachment } = raw;
  return { _id, from, to, createdAt, ...(expiresAt ? { expiresAt } : {}),
    ...(envelope ? { envelope } : { text, attachment, legacy: true }) };
}
