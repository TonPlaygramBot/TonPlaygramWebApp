import test from 'node:test';
import assert from 'node:assert/strict';
import { createSocialMessagesRouter } from '../routes/socialMessages.js';
import { createIdentity, encryptMessage, decryptMessage } from '../../webapp/src/utils/secureMessaging/crypto.js';

// A small stateful repository adapter exercises the route's selectors and writes
// without a Mongo daemon or HTTP listener. Authentication itself is separately
// covered by socialAuth tests; these tests start with a verified canonical user.
const id = (number) => number.toString(16).padStart(24, '0');
const clone = (value) => structuredClone(value);
const primitive = (value) => value instanceof Date ? value.getTime() : value?._bsontype === 'ObjectId' ? String(value) : value;
const equals = (a, b) => Array.isArray(a) ? a.some((entry) => equals(entry, b)) : b === null && a === undefined ? true : primitive(a) === primitive(b);
const read = (value, path) => path.split('.').reduce((cursor, part) => cursor?.[part], value);

function matches(row, selector) {
  return Object.entries(selector).every(([field, expected]) => {
    if (field === '$and') return expected.every((part) => matches(row, part));
    if (field === '$or') return expected.some((part) => matches(row, part));
    const actual = read(row, field);
    if (expected && typeof expected === 'object' && !(expected instanceof Date) && !expected._bsontype) {
      return Object.entries(expected).every(([operator, value]) => {
        if (operator === '$exists') return (actual !== undefined) === value;
        if (operator === '$in') return value.some((entry) => equals(actual, entry));
        if (operator === '$ne') return !equals(actual, value);
        if (operator === '$gt') return primitive(actual) > primitive(value);
        if (operator === '$lt') return primitive(actual) < primitive(value);
        if (operator === '$lte') return primitive(actual) <= primitive(value);
        if (operator === '$regex') return typeof actual === 'string' && new RegExp(value).test(actual);
        throw new Error(`Unsupported test selector: ${operator}`);
      });
    }
    return equals(actual, expected);
  });
}

function memoryModel(seed = []) {
  const rows = clone(seed);
  function query(selector, one = false) {
    let ordering;
    let max = Infinity;
    function resultRows() {
      let result = rows.filter((row) => matches(row, selector));
      if (ordering) {
        const [field, direction] = Object.entries(ordering)[0];
        result = [...result].sort((a, b) => primitive(read(a, field)) < primitive(read(b, field)) ? -direction : primitive(read(a, field)) > primitive(read(b, field)) ? direction : 0);
      }
      return result.slice(0, max);
    }
    return {
      sort(value) { ordering = value; return this; },
      limit(value) { max = value; return this; },
      lean: async () => {
        const result = resultRows();
        return clone(one ? result[0] || null : result);
      },
      cursor(options) {
        assert.equal(options.batchSize, 1);
        let closed = false;
        return {
          async *[Symbol.asyncIterator]() {
            for (const row of resultRows()) { if (closed) return; yield clone(row); }
          },
          async close() { closed = true; }
        };
      }
    };
  }
  function apply(row, update) {
    for (const [field, value] of Object.entries(update.$set || {})) row[field] = clone(value);
    for (const field of Object.keys(update.$unset || {})) delete row[field];
    for (const [field, value] of Object.entries(update.$addToSet || {})) {
      row[field] ||= [];
      if (!row[field].some((entry) => equals(entry, value))) row[field].push(clone(value));
    }
  }
  return { rows,
    find: (selector) => query(selector), findOne: (selector) => query(selector, true),
    countDocuments: async (selector) => rows.filter((row) => matches(row, selector)).length,
    updateOne: async (selector, update) => { const row = rows.find((entry) => matches(entry, selector)); if (row) apply(row, update); return { modifiedCount: row ? 1 : 0 }; },
    updateMany: async (selector, update) => { const found = rows.filter((entry) => matches(entry, selector)); found.forEach((row) => apply(row, update)); return { modifiedCount: found.length }; },
    findOneAndUpdate: (selector, update) => ({ lean: async () => { const row = rows.find((entry) => matches(entry, selector)); if (!row) return null; apply(row, update); return clone(row); } }),
    create: async (value) => { const row = { _id: id(rows.length + 1000), ...clone(value) }; rows.push(row); return clone(row); }
  };
}

const alice = { accountId: 'alice', telegramId: 11, friends: ['bob'] };
const bob = { accountId: 'bob', telegramId: 22, friends: [11] };
const mallory = { accountId: 'mallory', telegramId: 33, friends: [] };
const baseMessage = (number, extra = {}) => ({ _id: id(number), from: 'alice', to: 'bob', text: `message ${number}`,
  createdAt: new Date(Date.now() - 10000), deletedFor: [], ...extra });

function fixture(seed = []) {
  const users = memoryModel([alice, bob, mallory]);
  const messages = memoryModel(seed);
  const keys = memoryModel();
  const emitted = [];
  const router = createSocialMessagesRouter({ users, messages, keys });
  async function request(path, { method = 'post', user = alice, body = {}, params = {} } = {}) {
    const req = { body, params, socialUser: clone(user), app: { get: (key) => key === 'emitSocialEvent' ? (...args) => emitted.push(args) : undefined } };
    const res = { statusCode: 200, headers: {}, headersSent: false,
      setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
      status(value) { this.statusCode = value; return this; },
      json(value) { this.body = value; this.headersSent = true; return this; },
      end() { this.headersSent = true; },
      sendFile(value) { this.file = value; this.headersSent = true; }
    };
    for (const layer of router.stack.filter((entry) => !entry.route)) await layer.handle(req, res, () => {});
    const route = router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]);
    assert.ok(route, `Route exists: ${method} ${path}`);
    await route.route.stack.find((layer) => layer.method === method).handle(req, res);
    return res;
  }
  return { users, messages, keys, emitted, request };
}

test('read returns the latest page chronologically and supports an older cursor', async () => {
  const state = fixture(Array.from({ length: 8 }, (_, index) => baseMessage(index + 1)));
  const latest = await state.request('/messages', { body: { withId: 'bob', limit: 3 } });
  assert.equal(latest.statusCode, 200);
  assert.deepEqual(latest.body.map((message) => String(message._id)), [id(6), id(7), id(8)]);
  assert.equal(latest.headers['x-social-has-more'], 'true');
  assert.equal(latest.headers['x-social-next-cursor'], id(6));
  assert.match(latest.headers['access-control-expose-headers'], /X-Social-Next-Cursor/);
  assert.equal(latest.body[0].legacy, true);
  assert.equal('deletedFor' in latest.body[0], false);
  const older = await state.request('/messages', { body: { withId: 'bob', limit: 3, before: id(6) } });
  assert.deepEqual(older.body.map((message) => String(message._id)), [id(3), id(4), id(5)]);
  assert.match(latest.headers['cache-control'], /no-store/);
});

test('message pages stay within the byte budget and cursors never skip an omitted attachment', async () => {
  const ciphertext = 'a'.repeat(3 * 1024 * 1024);
  const state = fixture(Array.from({ length: 4 }, (_, index) => baseMessage(index + 1, { envelope: { ciphertext } })));
  const seen = [];
  let before;
  for (let pageNumber = 0; pageNumber < 4; pageNumber++) {
    const page = await state.request('/messages', { body: { withId: 'bob', limit: 50, ...(before ? { before } : {}) } });
    assert.equal(page.statusCode, 200);
    assert.ok(Buffer.byteLength(JSON.stringify(page.body)) <= 6 * 1024 * 1024);
    assert.equal(page.body.length, 1);
    seen.push(String(page.body[0]._id));
    before = page.headers['x-social-next-cursor'];
    assert.equal(page.headers['x-social-has-more'], String(pageNumber < 3));
  }
  assert.deepEqual(seen, [id(4), id(3), id(2), id(1)]);
});

test('the default page contains at most ten messages and reports the next cursor', async () => {
  const state = fixture(Array.from({ length: 11 }, (_, index) => baseMessage(index + 1)));
  const page = await state.request('/messages', { body: { withId: 'bob' } });
  assert.equal(page.body.length, 10);
  assert.equal(page.headers['x-social-next-cursor'], id(2));
  assert.equal(page.headers['x-social-has-more'], 'true');
});

test('reads and unread counts hide expired, personally hidden, deleted and unrelated rows before TTL cleanup', async () => {
  const state = fixture([
    baseMessage(1, { from: 'bob', to: 'alice' }),
    baseMessage(2, { from: 'bob', to: 'alice', expiresAt: new Date(Date.now() - 1) }),
    baseMessage(3, { from: 'bob', to: 'alice', deletedFor: ['alice'] }),
    baseMessage(4, { from: 'bob', to: 'alice', deletedAt: new Date() }),
    baseMessage(5, { from: 'bob', to: 'mallory' }),
    baseMessage(6, { from: 22, to: 11 })
  ]);
  const readResult = await state.request('/messages', { body: { withId: 22 } });
  assert.deepEqual(readResult.body.map((message) => String(message._id)), [id(1), id(6)]);
  const unread = await state.request('/unread-count');
  assert.equal(unread.body.count, 2);
});

test('rejects a client supplied identity that disagrees with verified identity', async () => {
  const state = fixture([baseMessage(1)]);
  for (const path of ['/messages', '/unread-count', '/mark-read']) {
    const result = await state.request(path, { body: { telegramId: 22, withId: 'bob' } });
    assert.equal(result.statusCode, 403);
  }
});

test('a stranger cannot delete another conversation or read its attachment', async () => {
  const state = fixture([baseMessage(1, { attachment: { url: '/api/social/message-files/photo.jpg' } })]);
  const deletion = await state.request('/messages/:id/delete', { user: mallory, body: { scope: 'everyone' }, params: { id: id(1) } });
  assert.equal(deletion.statusCode, 404);
  assert.equal(state.messages.rows[0].text, 'message 1');
  const attachment = await state.request('/message-files/:name', { method: 'get', user: mallory, params: { name: 'photo.jpg' } });
  assert.equal(attachment.statusCode, 404);
  assert.equal(attachment.file, undefined);
  assert.equal(state.emitted.length, 0);
});

test('recipient can delete for self but cannot destroy sender content for everyone', async () => {
  const state = fixture([baseMessage(1)]);
  const everyone = await state.request('/messages/:id/delete', { user: bob, body: { scope: 'everyone' }, params: { id: id(1) } });
  assert.equal(everyone.statusCode, 403);
  assert.equal(everyone.body.code, 'sender_only');
  const own = await state.request('/messages/:id/delete', { user: bob, body: { scope: 'me' }, params: { id: id(1) } });
  assert.equal(own.statusCode, 200);
  assert.deepEqual(state.messages.rows[0].deletedFor, ['bob']);
  assert.equal(state.messages.rows[0].text, 'message 1');
  assert.equal((await state.request('/messages', { user: bob, body: { withId: 'alice' } })).body.length, 0);
  assert.equal((await state.request('/messages', { body: { withId: 'bob' } })).body.length, 1);
  assert.deepEqual(state.emitted[0][0], ['bob']);
});

test('sender deletion erases content immediately and emits to the two canonical accounts', async () => {
  const state = fixture([baseMessage(1, { envelope: { ciphertext: 'secret-encrypted-content' }, clientMessageId: 'opaque-id' })]);
  const result = await state.request('/messages/:id/delete', { body: { scope: 'everyone' }, params: { id: id(1) } });
  assert.equal(result.statusCode, 200);
  const row = state.messages.rows[0];
  assert.equal('text' in row, false);
  assert.equal('envelope' in row, false);
  assert.equal('attachment' in row, false);
  assert.ok(row.deletedAt instanceof Date);
  assert.ok(row.expiresAt > new Date());
  assert.equal(row.clientMessageId, 'opaque-id');
  assert.deepEqual(state.emitted[0][0], ['alice', 'bob']);
  assert.equal(state.emitted[0][1], 'privateMessage:deleted');
  assert.equal((await state.request('/messages', { user: bob, body: { withId: 'alice' } })).body.length, 0);
});

test('a concurrent personal clear cannot prevent an authorized delete for everyone', async () => {
  const state = fixture([baseMessage(1, { envelope: { ciphertext: 'opaque' } })]);
  const update = state.messages.updateOne;
  state.messages.updateOne = async (selector, change) => {
    // Simulate another device clearing the sender's history after the initial
    // ownership read, before this request destroys the shared content.
    state.messages.rows[0].deletedFor = ['alice'];
    return update(selector, change);
  };
  const result = await state.request('/messages/:id/delete', { body: { scope: 'everyone' }, params: { id: id(1) } });
  assert.equal(result.statusCode, 200);
  assert.equal(state.messages.rows[0].envelope, undefined);
  assert.equal(state.messages.rows[0].text, undefined);
  assert.equal((await state.request('/messages', { user: bob, body: { withId: 'alice' } })).body.length, 0);
});

test('a send retry cannot restore a message hidden on another device', async () => {
  const envelope = { from: 'alice', to: 'bob', messageId: 'hidden-message', ciphertext: 'opaque' };
  const state = fixture([baseMessage(1, { envelope, clientMessageId: envelope.messageId, deletedFor: ['alice'] })]);
  const result = await state.request('/send-message', { body: { envelope } });
  assert.equal(result.statusCode, 410);
  assert.equal(result.body.code, 'message_deleted');
  assert.equal(state.emitted.length, 0);
});

test('clear hides only the selected conversation for the current account', async () => {
  const state = fixture([baseMessage(1), baseMessage(2, { from: 'bob', to: 'alice' }), baseMessage(3, { to: 'mallory' })]);
  const result = await state.request('/conversation/clear', { body: { withId: 'bob', scope: 'me' } });
  assert.equal(result.statusCode, 200);
  assert.equal((await state.request('/messages', { body: { withId: 'bob' } })).body.length, 0);
  assert.equal((await state.request('/messages', { user: bob, body: { withId: 'alice' } })).body.length, 2);
  assert.equal((await state.request('/messages', { body: { withId: 'mallory' } })).body.length, 1);
  assert.deepEqual(state.emitted[0][0], ['alice']);
  assert.equal(state.emitted[0][1], 'privateMessage:cleared');
  assert.equal(state.emitted[0][2].withId, 'bob');
  assert.ok(Number.isFinite(Date.parse(state.emitted[0][2].cutoffAt)));
  const forbiddenScope = await state.request('/conversation/clear', { body: { withId: 'bob', scope: 'everyone' } });
  assert.equal(forbiddenScope.statusCode, 400);
});

test('expired and hidden attachments are inaccessible even while files still exist', async () => {
  const state = fixture([
    baseMessage(1, { attachment: { url: '/api/social/message-files/expired.jpg' }, expiresAt: new Date(Date.now() - 1) }),
    baseMessage(2, { attachment: { url: '/api/social/message-files/hidden.jpg' }, deletedFor: ['alice'] }),
    baseMessage(3, { attachment: { url: '/api/social/message-files/current.jpg' } })
  ]);
  for (const name of ['expired.jpg', 'hidden.jpg', '../current.jpg']) {
    const result = await state.request('/message-files/:name', { method: 'get', params: { name } });
    assert.equal(result.statusCode, 404);
  }
  const current = await state.request('/message-files/:name', { method: 'get', params: { name: 'current.jpg' } });
  assert.equal(current.statusCode, 200);
  assert.ok(current.file.endsWith('/current.jpg'));
  assert.equal(current.headers['content-disposition'], 'attachment');
  assert.match(current.headers['cache-control'], /no-store/);
});

test('all old plaintext send paths fail closed', async () => {
  const state = fixture();
  const plain = await state.request('/send-message', { body: { fromId: 'alice', toId: 'bob', text: 'not encrypted' } });
  assert.equal(plain.statusCode, 426);
  assert.equal(plain.body.code, 'encryption_required');
  const upload = await state.request('/send-message-attachment');
  assert.equal(upload.statusCode, 426);
  assert.equal(state.messages.rows.length, 0);
});

test('spoofed sender and nonfriend ciphertext cannot reach storage', async () => {
  const state = fixture();
  const spoof = await state.request('/send-message', { body: { envelope: { from: 'bob', to: 'alice' } } });
  assert.equal(spoof.statusCode, 403);
  const stranger = await state.request('/send-message', { body: { envelope: { from: 'alice', to: 'mallory' } } });
  assert.equal(stranger.statusCode, 403);
  assert.equal(stranger.body.code, 'friends_required');
  assert.equal(state.messages.rows.length, 0);
});

test('message retry is idempotent and a changed envelope cannot reuse its ID', async () => {
  const envelope = { from: 'alice', to: 'bob', messageId: 'same-client-id', ciphertext: 'opaque' };
  const state = fixture([baseMessage(1, { clientMessageId: envelope.messageId, envelope })]);
  const duplicate = await state.request('/send-message', { body: { envelope: clone(envelope) } });
  assert.equal(duplicate.statusCode, 200);
  assert.equal(String(duplicate.body._id), id(1));
  assert.equal(state.messages.rows.length, 1);
  assert.equal(state.emitted.length, 0);
  const changed = await state.request('/send-message', { body: { envelope: { ...envelope, ciphertext: 'different' } } });
  assert.equal(changed.statusCode, 409);
  assert.equal(changed.body.code, 'message_id_conflict');
});

test('a retry cannot resurrect a deleted or expired encrypted message', async () => {
  const envelope = { from: 'alice', to: 'bob', messageId: 'already-deleted', ciphertext: 'opaque' };
  const state = fixture([baseMessage(1, { clientMessageId: envelope.messageId, deletedAt: new Date() })]);
  const deleted = await state.request('/send-message', { body: { envelope } });
  assert.equal(deleted.statusCode, 410);
  assert.equal(deleted.body.code, 'message_deleted');
  delete state.messages.rows[0].deletedAt;
  state.messages.rows[0].expiresAt = new Date(Date.now() - 1);
  const expired = await state.request('/send-message', { body: { envelope } });
  assert.equal(expired.statusCode, 410);
  assert.equal(state.messages.rows.length, 1);
  assert.equal(state.emitted.length, 0);
});

test('key lookup permits self and mutual friends only, including uninitialized keys', async () => {
  const state = fixture();
  const own = await state.request('/keys/lookup', { body: { peerId: 11 } });
  assert.deepEqual(own.body, { accountId: 'alice', bundle: null });
  const friend = await state.request('/keys/lookup', { body: { peerId: 22 } });
  assert.deepEqual(friend.body, { accountId: 'bob', bundle: null });
  const stranger = await state.request('/keys/lookup', { body: { peerId: 'mallory' } });
  assert.equal(stranger.statusCode, 403);
  const injection = await state.request('/keys/lookup', { body: { peerId: { $ne: null } } });
  assert.equal(injection.statusCode, 400);
});

test('rejects malformed IDs and unbounded pagination', async () => {
  const state = fixture([baseMessage(1)]);
  const deletion = await state.request('/messages/:id/delete', { body: { scope: 'me' }, params: { id: 'not-an-object-id' } });
  assert.equal(deletion.statusCode, 400);
  for (const limit of [0, 101, -1, 1.5, 'bad']) {
    const result = await state.request('/messages', { body: { withId: 'bob', limit } });
    assert.equal(result.statusCode, 400);
  }
});


test('browser-generated encrypted message survives authenticated store, read and recipient decrypt', async () => {
  const state = fixture();
  const [aliceKey, bobKey] = await Promise.all([createIdentity('alice'), createIdentity('bob')]);
  assert.equal((await state.request('/keys', { method: 'put', body: { bundle: aliceKey.bundle } })).statusCode, 201);
  assert.equal((await state.request('/keys', { method: 'put', user: bob, body: { bundle: bobKey.bundle } })).statusCode, 201);
  const attachmentBytes = new TextEncoder().encode('private file contents');
  const attachment = { name: 'private-note.txt', type: 'text/plain', size: attachmentBytes.byteLength,
    arrayBuffer: async () => attachmentBytes.buffer };
  const envelope = await encryptMessage(aliceKey, bobKey.bundle, { to: 'bob', text: 'meet at the pool table', attachment, ttlSeconds: 3600 });
  const sent = await state.request('/send-message', { body: { envelope } });
  assert.equal(sent.statusCode, 201, JSON.stringify(sent.body));
  const stored = state.messages.rows[0];
  assert.equal('text' in stored, false);
  assert.equal('attachment' in stored, false);
  assert.equal(JSON.stringify(stored).includes('meet at the pool table'), false);
  assert.equal(JSON.stringify(stored).includes('private-note.txt'), false);
  assert.deepEqual(state.emitted[0][0], ['alice', 'bob']);
  assert.equal(state.emitted[0][1], 'privateMessage');
  const incoming = await state.request('/messages', { user: bob, body: { withId: 'alice' } });
  assert.equal(incoming.body.length, 1);
  const plaintext = await decryptMessage(bobKey, 'alice', incoming.body[0].envelope,
    { trustedPeerFingerprints: [aliceKey.bundle.fingerprint] });
  assert.equal(plaintext.text, 'meet at the pool table');
  assert.equal(plaintext.attachment.name, 'private-note.txt');
  assert.equal(new TextDecoder().decode(plaintext.attachment.data), 'private file contents');
});

test('key registration is idempotent and reset requires compare-and-swap confirmation', async () => {
  const state = fixture();
  const [first, replacement] = await Promise.all([createIdentity('alice'), createIdentity('alice')]);
  const created = await state.request('/keys', { method: 'put', body: { bundle: first.bundle } });
  assert.equal(created.statusCode, 201);
  const repeated = await state.request('/keys', { method: 'put', body: { bundle: first.bundle } });
  assert.equal(repeated.statusCode, 200);
  assert.equal(state.keys.rows.length, 1);
  for (const expectedFingerprint of [undefined, 'a'.repeat(64)]) {
    const refused = await state.request('/keys', { method: 'put', body: { bundle: replacement.bundle, expectedFingerprint } });
    assert.equal(refused.statusCode, 409);
    assert.equal(state.keys.rows[0].bundle.fingerprint, first.bundle.fingerprint);
  }
  const reset = await state.request('/keys', { method: 'put', body: {
    bundle: replacement.bundle, expectedFingerprint: first.bundle.fingerprint
  } });
  assert.equal(reset.statusCode, 200);
  assert.equal(state.keys.rows[0].bundle.fingerprint, replacement.bundle.fingerprint);
  assert.equal(state.keys.rows.length, 1);
});
