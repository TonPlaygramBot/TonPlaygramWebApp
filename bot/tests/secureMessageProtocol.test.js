import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID, webcrypto } from 'node:crypto';
import { validateEnvelope, validateKeyBundle } from '../services/secureMessages.js';
import { stableStringify, normalizePublicKey, unsignedEnvelope } from '../../shared/secureMessagingProtocol.js';

const subtle = webcrypto.subtle;
const b64 = (bytes) => Buffer.from(bytes).toString('base64url');
const random = (length) => b64(randomBytes(length));

async function makeIdentity() {
  const agreement = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const signing = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const bundle = { version: 1,
    agreementKey: normalizePublicKey(await subtle.exportKey('jwk', agreement.publicKey)),
    signingKey: normalizePublicKey(await subtle.exportKey('jwk', signing.publicKey)) };
  bundle.fingerprint = createHash('sha256').update(stableStringify(bundle)).digest('hex');
  return { bundle, signing };
}

async function makeFixture() {
  const [sender, recipient, ephemeral] = await Promise.all([
    makeIdentity(), makeIdentity(), subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  ]);
  const now = Date.now();
  const contentKey = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
  const iv = randomBytes(12);
  const ciphertext = await subtle.encrypt({ name: 'AES-GCM', iv }, contentKey, new TextEncoder().encode('private message'));
  const envelope = {
    version: 1, algorithm: 'P256-HKDF-SHA256-A256GCM', messageId: randomUUID(),
    from: 'alice', to: 'bob', sentAt: new Date(now).toISOString(), ttlSeconds: 3600,
    senderFingerprint: sender.bundle.fingerprint, recipientFingerprint: recipient.bundle.fingerprint,
    senderBundle: sender.bundle,
    ephemeralKey: normalizePublicKey(await subtle.exportKey('jwk', ephemeral.publicKey)),
    salt: random(32), iv: b64(iv), ciphertext: b64(ciphertext),
    wrappedKeys: { sender: { iv: random(12), ciphertext: random(48) }, recipient: { iv: random(12), ciphertext: random(48) } },
    signature: ''
  };
  async function sign(value) {
    value.signature = b64(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, sender.signing.privateKey,
      new TextEncoder().encode(stableStringify(unsignedEnvelope(value)))));
    return value;
  }
  await sign(envelope);
  return { envelope, sign, now, sender, recipient, context: { sender: 'alice', recipient: 'bob',
    senderBundle: sender.bundle, recipientBundle: recipient.bundle, now } };
}

const rejectsCode = (operation, code) => assert.rejects(operation, (error) => error.code === code);

test('accepts a real P-256 signature and computes the signed message expiry', async () => {
  const { envelope, context, now } = await makeFixture();
  assert.deepEqual(await validateKeyBundle(envelope.senderBundle), envelope.senderBundle);
  const result = await validateEnvelope(envelope, context);
  assert.equal(result.createdAt.getTime(), now);
  assert.equal(result.expiresAt.getTime(), now + 3600000);
  assert.equal(JSON.stringify(envelope).includes('private message'), false);
});

test('rejects tampered ciphertext and authenticated metadata', async () => {
  const { envelope, context } = await makeFixture();
  const changedCiphertext = structuredClone(envelope);
  changedCiphertext.ciphertext = random(Buffer.from(envelope.ciphertext, 'base64url').length);
  await rejectsCode(() => validateEnvelope(changedCiphertext, context), 'invalid_message_signature');
  const changedExpiry = { ...envelope, ttlSeconds: 86400 };
  await rejectsCode(() => validateEnvelope(changedExpiry, context), 'invalid_message_signature');
  const changedWrappingKey = structuredClone(envelope);
  changedWrappingKey.wrappedKeys.recipient.ciphertext = random(48);
  await rejectsCode(() => validateEnvelope(changedWrappingKey, context), 'invalid_message_signature');
});

test('rejects private JWK material, unknown fields and invalid fingerprints', async () => {
  const { sender } = await makeFixture();
  const privateBundle = structuredClone(sender.bundle);
  privateBundle.signingKey.d = random(32);
  await assert.rejects(() => validateKeyBundle(privateBundle));
  const extraMetadata = { ...sender.bundle, nickname: 'not part of a key bundle' };
  await assert.rejects(() => validateKeyBundle(extraMetadata));
  await rejectsCode(() => validateKeyBundle({ ...sender.bundle, fingerprint: 'a'.repeat(64) }), 'invalid_key_fingerprint');
});

test('rejects forged identity and recipient key substitution', async () => {
  const { envelope, context } = await makeFixture();
  await rejectsCode(() => validateEnvelope({ ...envelope, from: 'mallory' }, context), 'invalid_envelope');
  await rejectsCode(() => validateEnvelope(envelope, { ...context, recipientBundle: { ...context.recipientBundle, fingerprint: 'b'.repeat(64) } }), 'key_changed');
  await rejectsCode(() => validateEnvelope(envelope, { ...context, senderBundle: null }), 'key_changed');
});

test('rejects expired, stale, future and unsupported timer messages even if signed', async () => {
  const { envelope, context, sign, now } = await makeFixture();
  await rejectsCode(async () => validateEnvelope(await sign({ ...envelope, ttlSeconds: 300, sentAt: new Date(now - 300000).toISOString() }), context), 'message_expired');
  await rejectsCode(async () => validateEnvelope(await sign({ ...envelope, sentAt: new Date(now - 300001).toISOString() }), context), 'message_clock_skew');
  await rejectsCode(async () => validateEnvelope(await sign({ ...envelope, sentAt: new Date(now + 300001).toISOString() }), context), 'message_clock_skew');
  await rejectsCode(async () => validateEnvelope(await sign({ ...envelope, ttlSeconds: -1 }), context), 'invalid_envelope');
  await rejectsCode(async () => validateEnvelope(await sign({ ...envelope, ttlSeconds: 42 }), context), 'invalid_envelope');
});

test('requires canonical base64url and rejects unsafe envelope extensions', async () => {
  const { envelope, context, sign } = await makeFixture();
  await rejectsCode(async () => validateEnvelope(await sign({ ...envelope, iv: `${envelope.iv}=` }), context), 'invalid_envelope');
  await rejectsCode(async () => validateEnvelope(await sign({ ...envelope, plaintext: 'must never be stored' }), context), 'invalid_envelope');
  const brokenWrappedKey = structuredClone(envelope);
  brokenWrappedKey.wrappedKeys.sender.ciphertext = random(47);
  await rejectsCode(() => validateEnvelope(brokenWrappedKey, context), 'invalid_envelope');
});
