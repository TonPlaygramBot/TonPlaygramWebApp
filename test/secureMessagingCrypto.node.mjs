import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createRequire } from 'node:module';
import { createIdentity, encryptMessage, decryptMessage, fingerprint, validateBundle } from '../webapp/src/utils/secureMessaging/crypto.js';
const require = createRequire(new URL('../webapp/package.json', import.meta.url));
const { indexedDB } = require('fake-indexeddb');
Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
Object.defineProperty(globalThis, 'indexedDB', { value: indexedDB, configurable: true });
const { getOrCreateIdentity, getOrPinPeer, getPeerPin, acceptChangedPeerKey } = await import('../webapp/src/utils/secureMessaging/storage.js');
const alice = await createIdentity('alice');
const bob = await createIdentity('bob');
const mallory = await createIdentity('mallory');
const trustAlice = { trustedPeerFingerprints: [alice.bundle.fingerprint] };
const send = (options = {}) => encryptMessage(alice, bob.bundle, { to: 'bob', text: 'Meet me after the match', ...options });
const receive = (envelope, options = {}) => decryptMessage(bob, 'alice', envelope, { ...trustAlice, ...options });

test('both parties decrypt a signed message, no plaintext in transmitted envelope', async () => {
  const envelope = await send();
  assert.equal((await receive(envelope)).text, 'Meet me after the match');
  assert.equal((await decryptMessage(alice, 'bob', envelope)).text, 'Meet me after the match');
  assert.ok(!JSON.stringify(envelope).includes('Meet me'));
  assert.equal(alice.agreementPrivateKey.extractable, false);
  assert.equal(alice.signingPrivateKey.extractable, false);
  await assert.rejects(crypto.subtle.exportKey('jwk', alice.agreementPrivateKey));
});

test('each send uses a new ephemeral key, IV, salt and ciphertext', async () => {
  const first = await send(); const second = await send();
  assert.notDeepEqual(first.ephemeralKey, second.ephemeralKey);
  for (const field of ['iv', 'salt', 'ciphertext', 'signature', 'messageId']) assert.notEqual(first[field], second[field]);
});

test('tampering with body, signatures, wrappers and signed retention fails closed', async () => {
  const original = await send({ ttlSeconds: 3600 });
  const cases = [
    ['ciphertext', (copy) => { copy.ciphertext = `${copy.ciphertext[0] === 'A' ? 'B' : 'A'}${copy.ciphertext.slice(1)}`; }],
    ['signature', (copy) => { copy.signature = `${copy.signature[0] === 'A' ? 'B' : 'A'}${copy.signature.slice(1)}`; }],
    ['retention', (copy) => { copy.ttlSeconds = 0; }],
    ['sender wrap', (copy) => { copy.wrappedKeys.sender.iv = copy.iv; }],
    ['timestamp', (copy) => { copy.sentAt = new Date(Date.parse(copy.sentAt) + 1000).toISOString(); }],
    ['recipient', (copy) => { copy.to = 'mallory'; }]
  ];
  for (const [label, mutate] of cases) { const copy = structuredClone(original); mutate(copy); await assert.rejects(receive(copy), undefined, label); }
});

test('wrong peer, untrusted sender, replacement identity cannot decrypt', async () => {
  const envelope = await send();
  await assert.rejects(decryptMessage(mallory, 'alice', envelope, trustAlice));
  await assert.rejects(receive(envelope, { trustedPeerFingerprints: [] }), { code: 'UNTRUSTED_KEY' });
  const replacement = await createIdentity('bob');
  await assert.rejects(decryptMessage(replacement, 'alice', envelope, trustAlice), { code: 'DEVICE_KEY_UNAVAILABLE' });
});

test('expired messages reject while future expiry works, off stays persistent', async () => {
  const now = Date.now();
  const timed = await send({ now, ttlSeconds: 300 });
  assert.equal((await receive(timed, { now: now + 299999 })).expiresAt, new Date(now + 300000).toISOString());
  await assert.rejects(receive(timed, { now: now + 300000 }), { code: 'MESSAGE_EXPIRED' });
  const persistent = await send({ now, ttlSeconds: 0 });
  assert.equal((await receive(persistent, { now: now + 999999999 })).expiresAt, null);
  await assert.rejects(send({ ttlSeconds: 17 }), { code: 'INVALID_TTL' });
});

test('attachments are encrypted and replies retain no original content', async () => {
  const attachment = new File([new Uint8Array([1, 2, 3, 255])], 'private-note.txt', { type: 'text/plain' });
  const envelope = await send({ attachment, replyTo: { id: 'reply-id', text: 'Old private text', from: 'bob' } });
  const wire = JSON.stringify(envelope);
  assert.ok(!wire.includes('private-note')); assert.ok(!wire.includes('Old private text')); assert.ok(!wire.includes('text/plain'));
  const decoded = await receive(envelope);
  assert.equal(decoded.attachment.name, 'private-note.txt');
  assert.deepEqual(decoded.attachment.data, new Uint8Array([1, 2, 3, 255]));
  assert.equal(decoded.replyTo.text, undefined);
  assert.equal(decoded.replyTo.id, 'reply-id');
  await assert.rejects(send({ attachment: { size: 2 * 1024 * 1024 + 1 } }), { code: 'ATTACHMENT_TOO_LARGE' });
});

test('malformed key bundles and empty/oversized messages are rejected', async () => {
  await assert.rejects(validateBundle({ ...alice.bundle, fingerprint: bob.bundle.fingerprint }), { code: 'INVALID_KEY' });
  await assert.rejects(fingerprint({ ...alice.bundle, agreementKey: { ...alice.bundle.agreementKey, d: 'private' } }));
  await assert.rejects(send({ text: '' }), { code: 'EMPTY_MESSAGE' });
  await assert.rejects(send({ text: 'x'.repeat(2001) }), { code: 'MESSAGE_TOO_LONG' });
});

test('concurrent tabs create one durable nonextractable identity', async () => {
  const [first, second, third] = await Promise.all([getOrCreateIdentity('race-user'), getOrCreateIdentity('race-user'), getOrCreateIdentity('race-user')]);
  assert.equal(first.bundle.fingerprint, second.bundle.fingerprint);
  assert.equal(first.bundle.fingerprint, third.bundle.fingerprint);
  assert.equal((await getOrCreateIdentity('race-user')).bundle.fingerprint, first.bundle.fingerprint);
  assert.equal(first.agreementPrivateKey.extractable, false);
  const envelope = await encryptMessage(first, bob.bundle, { to: 'bob', text: 'Persisted key works' });
  assert.equal((await decryptMessage(second, 'bob', envelope)).text, 'Persisted key works');
});

test('first contact is pinned; changed keys need explicit compare-and-set acceptance', async () => {
  const first = await getOrPinPeer('alice', 'bob', bob.bundle.fingerprint);
  assert.equal(first.fingerprint, bob.bundle.fingerprint);
  const changed = await getOrPinPeer('alice', 'bob', mallory.bundle.fingerprint);
  assert.equal(changed.fingerprint, bob.bundle.fingerprint);
  await assert.rejects(acceptChangedPeerKey('alice', 'bob', mallory.bundle.fingerprint, 'wrong-old'), { code: 'KEY_CHANGED' });
  await acceptChangedPeerKey('alice', 'bob', mallory.bundle.fingerprint, bob.bundle.fingerprint);
  const current = await getPeerPin('alice', 'bob');
  assert.equal(current.fingerprint, mallory.bundle.fingerprint);
  assert.deepEqual(current.trustedFingerprints, [bob.bundle.fingerprint, mallory.bundle.fingerprint]);
  assert.equal(await getPeerPin('different-user', 'bob'), null);
});
