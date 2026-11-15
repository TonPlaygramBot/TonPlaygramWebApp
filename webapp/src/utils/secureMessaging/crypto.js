import {
  SECURE_MESSAGE_VERSION, SECURE_MESSAGE_ALGORITHM, SECURE_MESSAGE_TTLS,
  MAX_SECURE_ATTACHMENT_BYTES, MAX_SECURE_TEXT_LENGTH, stableStringify,
  normalizePublicKey, keyFingerprintInput, unsignedEnvelope, messageAdditionalData,
  messageExpiresAt
} from '../../../../shared/secureMessagingProtocol.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const MAX_PAYLOAD_BYTES = Math.ceil(MAX_SECURE_ATTACHMENT_BYTES * 4 / 3) + 20000;

function subtle() {
  if (!globalThis.crypto?.subtle) throw securityError('CRYPTO_UNAVAILABLE', 'Secure messages need a current browser over HTTPS.');
  return globalThis.crypto.subtle;
}
export function securityError(code, message) { return Object.assign(new Error(message), { code }); }
const bytes = (value) => encoder.encode(stableStringify(value));
const random = (length) => globalThis.crypto.getRandomValues(new Uint8Array(length));

export function base64url(data) {
  const view = data instanceof Uint8Array ? data : new Uint8Array(data);
  let binary = '';
  for (let i = 0; i < view.length; i += 0x4000) binary += String.fromCharCode(...view.subarray(i, i + 0x4000));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
export function unbase64url(value, expectedSize, maxSize = MAX_PAYLOAD_BYTES + 16) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value) || value.length > Math.ceil(maxSize * 4 / 3)) {
    throw securityError('INVALID_ENVELOPE', 'Invalid encrypted message.');
  }
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  const result = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (base64url(result) !== value || (expectedSize && result.length !== expectedSize)) {
    throw securityError('INVALID_ENVELOPE', 'Invalid encrypted message.');
  }
  return result;
}
export async function fingerprint(bundle) {
  const digest = await subtle().digest('SHA-256', bytes(keyFingerprintInput(bundle)));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}
export async function validateBundle(bundle) {
  const normalized = keyFingerprintInput(bundle);
  const hash = await fingerprint(normalized);
  if (bundle.fingerprint !== hash) throw securityError('INVALID_KEY', 'The encryption key fingerprint is invalid.');
  // Import also validates the point, rather than only checking its encoding.
  await subtle().importKey('jwk', normalized.agreementKey, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  await subtle().importKey('jwk', normalized.signingKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  return { ...normalized, fingerprint: hash };
}

export async function createIdentity(accountId) {
  if (!accountId) throw securityError('IDENTITY_REQUIRED', 'Sign in again to set up secure messages.');
  const agreement = await subtle().generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  const signing = await subtle().generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const bundle = {
    version: SECURE_MESSAGE_VERSION,
    agreementKey: normalizePublicKey(await subtle().exportKey('jwk', agreement.publicKey)),
    signingKey: normalizePublicKey(await subtle().exportKey('jwk', signing.publicKey))
  };
  bundle.fingerprint = await fingerprint(bundle);
  return { accountId: String(accountId), bundle, agreementPrivateKey: agreement.privateKey,
    signingPrivateKey: signing.privateKey, createdAt: new Date().toISOString() };
}

async function wrappingKey(privateKey, publicKey, envelope, role) {
  const imported = await subtle().importKey('jwk', normalizePublicKey(publicKey), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const secret = await subtle().deriveBits({ name: 'ECDH', public: imported }, privateKey, 256);
  const material = await subtle().importKey('raw', secret, 'HKDF', false, ['deriveKey']);
  new Uint8Array(secret).fill(0);
  return subtle().deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: unbase64url(envelope.salt, 32),
    info: bytes({ domain: 'tonplaygram/message-key/v1', messageId: envelope.messageId, from: envelope.from, to: envelope.to, role })
  }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
const wrapAad = (envelope, role) => bytes({ ...messageAdditionalData(envelope), role });

function validateHeader(envelope, selfId, peerId) {
  if (!envelope || envelope.version !== SECURE_MESSAGE_VERSION || envelope.algorithm !== SECURE_MESSAGE_ALGORITHM ||
      typeof envelope.messageId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(envelope.messageId) ||
      !SECURE_MESSAGE_TTLS.includes(envelope.ttlSeconds) || !Number.isFinite(Date.parse(envelope.sentAt)) ||
      new Date(envelope.sentAt).toISOString() !== envelope.sentAt ||
      !((envelope.from === String(selfId) && envelope.to === String(peerId)) ||
        (envelope.from === String(peerId) && envelope.to === String(selfId)))) {
    throw securityError('INVALID_ENVELOPE', 'This encrypted message does not belong to this conversation.');
  }
  for (const hash of [envelope.senderFingerprint, envelope.recipientFingerprint]) {
    if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)) throw securityError('INVALID_ENVELOPE', 'Invalid encryption fingerprint.');
  }
  normalizePublicKey(envelope.ephemeralKey);
  unbase64url(envelope.salt, 32);
  unbase64url(envelope.iv, 12);
  unbase64url(envelope.signature, 64);
  unbase64url(envelope.ciphertext);
  for (const role of ['sender', 'recipient']) {
    unbase64url(envelope.wrappedKeys?.[role]?.iv, 12);
    unbase64url(envelope.wrappedKeys?.[role]?.ciphertext, 48);
  }
}

export async function encryptMessage(identity, peerBundle, { to, text = '', attachment = null, replyTo = null, ttlSeconds = 0, now = Date.now() }) {
  const peer = await validateBundle(peerBundle);
  if (!SECURE_MESSAGE_TTLS.includes(ttlSeconds)) throw securityError('INVALID_TTL', 'Choose a supported disappearing message timer.');
  if (typeof text !== 'string' || text.trim().length > MAX_SECURE_TEXT_LENGTH) throw securityError('MESSAGE_TOO_LONG', 'Messages can contain up to 2,000 characters.');
  const payload = { text: text.trim() };
  if (attachment) {
    if (!Number.isFinite(attachment.size) || attachment.size > MAX_SECURE_ATTACHMENT_BYTES || attachment.size < 0) {
      throw securityError('ATTACHMENT_TOO_LARGE', 'Choose a file no larger than 2 MB for an encrypted message.');
    }
    const contents = await attachment.arrayBuffer();
    if (contents.byteLength !== attachment.size) throw securityError('INVALID_ATTACHMENT', 'The attachment changed. Select it again.');
    payload.attachment = { name: String(attachment.name || 'attachment').slice(0, 160),
      type: String(attachment.type || 'application/octet-stream').slice(0, 120), size: attachment.size, data: base64url(contents) };
  }
  if (!payload.text && !attachment) throw securityError('EMPTY_MESSAGE', 'Write a message or choose a file first.');
  if (replyTo?.id) payload.replyTo = { id: String(replyTo.id).slice(0, 100), from: String(replyTo.from || '').slice(0, 100) };
  const ephemeral = await subtle().generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  const envelope = {
    version: SECURE_MESSAGE_VERSION, algorithm: SECURE_MESSAGE_ALGORITHM,
    messageId: globalThis.crypto.randomUUID(), from: identity.accountId, to: String(to), sentAt: new Date(now).toISOString(), ttlSeconds,
    senderFingerprint: identity.bundle.fingerprint, recipientFingerprint: peer.fingerprint,
    senderBundle: identity.bundle,
    ephemeralKey: normalizePublicKey(await subtle().exportKey('jwk', ephemeral.publicKey)), salt: base64url(random(32)), iv: base64url(random(12))
  };
  const contentKeyBytes = random(32);
  try {
    const contentKey = await subtle().importKey('raw', contentKeyBytes, 'AES-GCM', false, ['encrypt']);
    envelope.ciphertext = base64url(await subtle().encrypt({ name: 'AES-GCM', iv: unbase64url(envelope.iv, 12), additionalData: bytes(messageAdditionalData(envelope)), tagLength: 128 }, contentKey, bytes(payload)));
    envelope.wrappedKeys = {};
    for (const [role, bundle] of [['sender', identity.bundle], ['recipient', peer]]) {
      const key = await wrappingKey(ephemeral.privateKey, bundle.agreementKey, envelope, role);
      const iv = random(12);
      const wrapped = await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: wrapAad(envelope, role), tagLength: 128 }, key, contentKeyBytes);
      envelope.wrappedKeys[role] = { iv: base64url(iv), ciphertext: base64url(wrapped) };
    }
    envelope.signature = base64url(await subtle().sign({ name: 'ECDSA', hash: 'SHA-256' }, identity.signingPrivateKey, bytes(unsignedEnvelope(envelope))));
    return envelope;
  } finally { contentKeyBytes.fill(0); }
}

export async function decryptMessage(identity, peerId, envelope, { trustedPeerFingerprints = [], now = Date.now(), allowExpired = false } = {}) {
  validateHeader(envelope, identity.accountId, peerId);
  const ownMessage = envelope.from === identity.accountId;
  const ownFingerprint = ownMessage ? envelope.senderFingerprint : envelope.recipientFingerprint;
  if (ownFingerprint !== identity.bundle.fingerprint) throw securityError('DEVICE_KEY_UNAVAILABLE', 'This message was encrypted for another device key.');
  const senderBundle = await validateBundle(envelope.senderBundle);
  if (senderBundle.fingerprint !== envelope.senderFingerprint ||
      (!ownMessage && !trustedPeerFingerprints.includes(envelope.senderFingerprint))) {
    throw securityError('UNTRUSTED_KEY', 'Verify this friend’s security key before opening this message.');
  }
  const senderSigningKey = await subtle().importKey('jwk', senderBundle.signingKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const verified = await subtle().verify({ name: 'ECDSA', hash: 'SHA-256' }, senderSigningKey, unbase64url(envelope.signature, 64), bytes(unsignedEnvelope(envelope)));
  if (!verified) throw securityError('INVALID_SIGNATURE', 'The message signature could not be verified.');
  const expiresAt = messageExpiresAt(envelope);
  if (!allowExpired && expiresAt && Date.parse(expiresAt) <= now) throw securityError('MESSAGE_EXPIRED', 'This message has expired.');
  const role = ownMessage ? 'sender' : 'recipient';
  const wrap = envelope.wrappedKeys[role];
  const key = await wrappingKey(identity.agreementPrivateKey, envelope.ephemeralKey, envelope, role);
  const contentKeyBytes = new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv: unbase64url(wrap.iv, 12), additionalData: wrapAad(envelope, role), tagLength: 128 }, key, unbase64url(wrap.ciphertext, 48)));
  let decoded;
  try {
    const contentKey = await subtle().importKey('raw', contentKeyBytes, 'AES-GCM', false, ['decrypt']);
    decoded = await subtle().decrypt({ name: 'AES-GCM', iv: unbase64url(envelope.iv, 12), additionalData: bytes(messageAdditionalData(envelope)), tagLength: 128 }, contentKey, unbase64url(envelope.ciphertext));
  } finally { contentKeyBytes.fill(0); }
  if (decoded.byteLength > MAX_PAYLOAD_BYTES) throw securityError('INVALID_PAYLOAD', 'Encrypted message exceeds the size limit.');
  const payload = JSON.parse(decoder.decode(decoded));
  if (!payload || typeof payload.text !== 'string' || payload.text.length > MAX_SECURE_TEXT_LENGTH) throw securityError('INVALID_PAYLOAD', 'Encrypted message content is invalid.');
  const result = { text: payload.text, expiresAt };
  if (payload.replyTo) result.replyTo = { id: String(payload.replyTo.id || '').slice(0, 100), from: String(payload.replyTo.from || '').slice(0, 100) };
  if (payload.attachment) {
    const file = payload.attachment;
    const data = file.data === '' && file.size === 0 ? new Uint8Array(0) : unbase64url(file.data, undefined, MAX_SECURE_ATTACHMENT_BYTES);
    if (!Number.isInteger(file.size) || data.byteLength !== file.size || file.size > MAX_SECURE_ATTACHMENT_BYTES) throw securityError('INVALID_PAYLOAD', 'Encrypted attachment is invalid.');
    result.attachment = { name: String(file.name || 'attachment').slice(0, 160), type: String(file.type || 'application/octet-stream').slice(0, 120), size: file.size, data };
  }
  return result;
}
