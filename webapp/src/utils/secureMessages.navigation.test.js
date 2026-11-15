import { beforeAll, beforeEach, afterEach, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { TextEncoder, TextDecoder } from 'node:util';
import { indexedDB } from 'fake-indexeddb';
vi.mock('./api.js', () => ({ API_BASE_URL: 'https://example.test' }));
vi.mock('./google.js', () => ({ loadGoogleCredential: () => 'verified-test-credential' }));
let cryptoCore, api, bob, directory, records, captured, sequence = 0;
beforeAll(async () => {
  vi.stubGlobal('crypto', webcrypto);
  vi.stubGlobal('TextEncoder', TextEncoder);
  vi.stubGlobal('TextDecoder', TextDecoder);
  vi.stubGlobal('indexedDB', indexedDB);
  cryptoCore = await import('./secureMessaging/crypto.js');
  api = await import('./secureMessages.js');
  bob = await cryptoCore.createIdentity('peer');
});
beforeEach(() => {
  sequence++;
  directory = new Map([['peer', bob.bundle]]); records = []; captured = [];
  vi.stubGlobal('fetch', vi.fn(async (url, options) => {
    const path = new URL(url).pathname.replace('/api/social', '');
    const body = options.body ? JSON.parse(options.body) : {};
    captured.push({ path, options, body });
    let data;
    if (path === '/keys/lookup') data = { accountId: body.peerId, bundle: directory.get(body.peerId) || null };
    else if (path === '/keys') {
      const id = captured.find(item => item.path === '/keys/lookup').body.peerId;
      if (directory.has(id) && directory.get(id).fingerprint !== body.expectedFingerprint && directory.get(id).fingerprint !== body.bundle.fingerprint) return new Response(JSON.stringify({ error: 'Key changed', code: 'key_changed' }), { status: 409 });
      directory.set(id, body.bundle); data = { accountId: id, bundle: body.bundle };
    } else if (path === '/send-message') {
      data = { _id: `row-${records.length}`, envelope: body.envelope, createdAt: body.envelope.sentAt };
      records.push(data);
    } else if (path === '/messages') data = records;
    else if (path.endsWith('/delete') || path === '/conversation/clear') data = { success: true };
    else return new Response('{}', { status: 404 });
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }));
});
afterEach(() => vi.clearAllMocks());
it('sets up canonical identities, sends ciphertext and reads its own archive', async () => {
  const ctx = await api.prepareConversation(`client-${sequence}`, 'peer');
  expect(ctx.canSend).toBe(true);
  expect(ctx.identity.agreementPrivateKey.extractable).toBe(false);
  const sent = await api.sendSecureMessage(ctx, { text: 'Private test content', ttlSeconds: 300 });
  expect(sent.text).toBe('Private test content');
  const outgoing = captured.find(item => item.path === '/send-message');
  expect(outgoing.body.text).toBeUndefined();
  expect(JSON.stringify(outgoing.body)).not.toContain('Private test content');
  expect(outgoing.options.headers['X-Google-Id-Token']).toBe('verified-test-credential');
  expect(outgoing.options.cache).toBe('no-store');
  expect((await api.loadMessages(ctx))[0].text).toBe('Private test content');
});
it('does not fall back to plaintext when a recipient has no encryption key', async () => {
  directory.delete('peer');
  const ctx = await api.prepareConversation(`client-${sequence}`, 'peer');
  expect(ctx.canSend).toBe(false);
  expect(ctx.securityReason).toBe('KEYS_NOT_READY');
  await expect(api.sendSecureMessage(ctx, { text: 'Must not send' })).rejects.toMatchObject({ code: 'KEYS_NOT_READY' });
  records = [{ _id: 'legacy', from: 'peer', to: ctx.selfId, text: 'Older plaintext message' }];
  const loaded = await api.loadMessages(ctx);
  expect(loaded[0].legacy).toBe(true);
  expect(loaded[0].text).toBe('Older plaintext message');
  expect(captured.some(item => item.path === '/send-message')).toBe(false);
});
it('pins peer keys and blocks changed-key sends until explicit acceptance', async () => {
  const id = `client-${sequence}`;
  const ctx = await api.prepareConversation(id, 'peer');
  const replacement = await cryptoCore.createIdentity('peer');
  directory.set('peer', replacement.bundle);
  await expect(api.sendSecureMessage(ctx, { text: 'Blocked' })).rejects.toMatchObject({ code: 'KEY_CHANGED' });
  const changed = await api.prepareConversation(id, 'peer');
  expect(changed.securityReason).toBe('KEY_CHANGED');
  expect(changed.previousPeerFingerprint).toBe(bob.bundle.fingerprint);
  const accepted = await api.acceptPeerKeyChange(changed);
  expect(accepted.canSend).toBe(true);
  expect(accepted.trustedPeerFingerprints).toContain(bob.bundle.fingerprint);
  expect(accepted.trustedPeerFingerprints).toContain(replacement.bundle.fingerprint);
  expect((await api.sendSecureMessage(accepted, { text: 'Verified new key' })).text).toBe('Verified new key');
});
it('missing device keys never replace the directory until explicit reset', async () => {
  const id = `client-${sequence}`;
  const original = await cryptoCore.createIdentity(id);
  directory.set(id, original.bundle);
  const ctx = await api.prepareConversation(id, 'peer');
  expect(ctx.securityReason).toBe('DEVICE_KEY_UNAVAILABLE');
  expect(captured.filter(item => item.path === '/keys')).toHaveLength(0);
  const restored = await api.resetConversationDeviceKey(ctx);
  expect(restored.canSend).toBe(true);
  expect(restored.ownFingerprint).not.toBe(original.bundle.fingerprint);
  const keyUpdate = captured.find(item => item.path === '/keys');
  expect(keyUpdate.body.expectedFingerprint).toBe(original.bundle.fingerprint);
  const old = await cryptoCore.encryptMessage(bob, original.bundle, { to: id, text: 'Cannot recover missing key' });
  const [unavailable] = await api.decryptMessages(restored, [{ _id: 'old', envelope: old }]);
  expect(unavailable.decryptionError).toBe('DEVICE_KEY_UNAVAILABLE');
  expect(unavailable.text).not.toBe('Cannot recover missing key');
});
it('expired rows are removed and deletion scopes use authenticated endpoints', async () => {
  const ctx = await api.prepareConversation(`client-${sequence}`, 'peer');
  const expired = await cryptoCore.encryptMessage(bob, ctx.identity.bundle, { to: ctx.selfId, text: 'Old', ttlSeconds: 300, now: Date.now() - 300001 });
  expect(await api.decryptMessages(ctx, [{ _id: 'old', envelope: expired }])).toEqual([]);
  await api.deleteSecureMessage(ctx, 'some-id', 'everyone');
  expect(captured.at(-1).body.scope).toBe('everyone');
  await api.clearSecureConversation(ctx);
  expect(captured.at(-1).path).toBe('/conversation/clear');
  expect(captured.at(-1).body.withId).toBe('peer');
  expect(() => api.clearSecureConversation(ctx, 'everyone')).toThrow();
});
it('active HTML/SVG attachments become download-only inert blobs', async () => {
  const ctx = await api.prepareConversation(`client-${sequence}`, 'peer');
  const originalCreate = URL.createObjectURL;
  const blobs = [];
  URL.createObjectURL = vi.fn(blob => { blobs.push(blob); return `blob:test-${blobs.length}`; });
  try {
    for (const type of ['text/html', 'image/svg+xml']) {
      const data = new TextEncoder().encode('<script>window.compromised=true</script>');
      const attachment = { name: 'untrusted.html', type, size: data.length, arrayBuffer: async () => data.buffer };
      const envelope = await cryptoCore.encryptMessage(bob, ctx.identity.bundle, { to: ctx.selfId, text: 'file', attachment });
      const [message] = await api.decryptMessages(ctx, [{ _id: type, envelope }]);
      expect(message.attachment.type).toBe('application/octet-stream');
      expect(blobs.at(-1).type).toBe('application/octet-stream');
    }
  } finally { URL.createObjectURL = originalCreate; }
});
it('enrolls a device on hub entry without selecting a friend', async () => {
  directory.delete('peer');
  const result = await api.initializeSecureMessaging(`hub-entry-${sequence}`);
  expect(result.isReady).toBe(true);
  expect(result.ownFingerprint).toBe(directory.get(result.selfId).fingerprint);
  expect(captured.filter(item => item.path === '/keys/lookup')).toHaveLength(1);
  expect(captured.some(item => item.path === '/messages')).toBe(false);
});
it('preserves server pagination cursors even when every decoded row expires', async () => {
  const ctx = await api.prepareConversation(`client-${sequence}`, 'peer');
  const envelope = await cryptoCore.encryptMessage(bob, ctx.identity.bundle, { to: ctx.selfId, text: 'Expired', ttlSeconds: 300, now: Date.now() - 300001 });
  fetch.mockImplementationOnce(async () => new Response(JSON.stringify([{ _id: 'oldest-raw-id', envelope }]), {
    headers: { 'Content-Type': 'application/json', 'X-Social-Has-More': 'true', 'X-Social-Next-Cursor': 'oldest-raw-id' }
  }));
  const page = await api.loadMessages(ctx);
  expect(page.length).toBe(0);
  expect(page.hasMore).toBe(true);
  expect(page.nextCursor).toBe('oldest-raw-id');
});
it('recovers a persisted replacement after a lost publish response without generating another key', async () => {
  const id = `interrupted-client-${sequence}`;
  directory.set(id, (await cryptoCore.createIdentity(id)).bundle);
  const ctx = await api.prepareConversation(id, 'peer');
  const normalFetch = fetch.getMockImplementation();
  fetch.mockImplementation(async (url, options) => {
    const result = await normalFetch(url, options);
    if (new URL(url).pathname === '/api/social/keys') throw new Error('Response lost after server commit');
    return result;
  });
  await expect(api.resetConversationDeviceKey(ctx)).rejects.toThrow('Response lost');
  const publishedFingerprint = directory.get(id).fingerprint;
  fetch.mockImplementation(normalFetch);
  const recovered = await api.prepareConversation(id, 'peer');
  expect(recovered.canSend).toBe(true);
  expect(recovered.ownFingerprint).toBe(publishedFingerprint);
  expect(captured.filter(item => item.path === '/keys')).toHaveLength(1);
});
