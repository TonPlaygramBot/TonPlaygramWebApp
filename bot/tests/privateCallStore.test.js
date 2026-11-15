import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrivateCallStore } from '../services/privateCallStore.js';
import { createSocialSocketRegistry, emitDirectSocket, emitLiveChatMembers } from '../services/socialSocketRegistry.js';

const caller = { accountId: 'alice', telegramId: 1, nickname: 'Alice' };
const target = { accountId: 'bob', nickname: 'Bob' };
function fixture() {
  let now = 1000;
  const ended = [];
  const store = createPrivateCallStore({ now: () => now, uuid: () => 'unpredictable-test-uuid', onEnd: (call, reason) => ended.push({ call, reason }) });
  return { store, ended, advance(ms) { now += ms; } };
}
test('only invited recipient can accept; strangers cannot join, reject, or end', () => {
  const { store } = fixture();
  const call = store.create(caller, target);
  assert.equal(store.canJoin(call.roomId, 'alice'), true);
  assert.equal(store.canJoin(call.roomId, 'bob'), false);
  assert.equal(store.accept(call.roomId, 'alice'), null);
  assert.equal(store.accept(call.roomId, 'mallory'), null);
  assert.equal(store.end(call.roomId, 'mallory'), false);
  assert.equal(store.end(call.roomId, 'alice', 'declined'), false);
  assert.equal(store.accept(call.roomId, 'bob').state, 'accepted');
  assert.equal(store.canJoin(call.roomId, 'bob'), true);
  assert.equal(store.canJoin(call.roomId, 'mallory'), false);
});
test('call metadata comes from canonical stored profiles', () => {
  const { store } = fixture();
  const call = store.create(caller, target, 'video');
  assert.equal(call.fromName, 'Alice');
  assert.equal(call.toTelegramId, undefined); // browser accounts may call
  assert.equal(call.type, 'video');
  assert.equal(call.roomId, 'friend-call-unpredictable-test-uuid');
  assert.equal(Object.hasOwn(call, 'sdp'), false);
});
test('ringing expires and removes participants, allowing another call', () => {
  const { store, advance, ended } = fixture();
  const call = store.create(caller, target);
  advance(60000);
  assert.equal(store.get(call.roomId), null);
  assert.equal(store.size(), 0);
  assert.equal(ended[0].reason, 'expired');
  assert.ok(store.create(caller, target));
});
test('accepted calls expire after max duration; duplicate accept does not extend retention', () => {
  const { store, advance } = fixture();
  const call = store.create(caller, target);
  store.accept(call.roomId, 'bob');
  advance(3 * 3600000);
  store.accept(call.roomId, 'bob');
  advance(3600000);
  store.sweep();
  assert.equal(store.size(), 0);
});
test('end immediately destroys server call metadata and denies later reuse', () => {
  const { store, ended } = fixture();
  const call = store.create(caller, target);
  assert.equal(store.end(call.roomId, 'alice'), true);
  assert.equal(store.get(call.roomId), null);
  assert.equal(store.accept(call.roomId, 'bob'), null);
  assert.equal(store.canJoin(call.roomId, 'alice'), false);
  assert.equal(ended.length, 1);
});
test('one active call per account and disconnect clears call', () => {
  const { store } = fixture();
  store.create(caller, target);
  assert.throws(() => store.create(caller, { accountId: 'charlie' }));
  assert.throws(() => store.create({ accountId: 'charlie' }, target));
  store.endForAccount('bob');
  assert.equal(store.size(), 0);
});

function socket(id) {
  return { id, connected: true, data: {}, handshake: { auth: {}, headers: {} }, events: [], emit(event, payload) { this.events.push({ event, payload }); } };
}
function registryFixture() {
  let now = 1000;
  const peers = new Map();
  const timers = [];
  const revoked = [];
  const registry = createSocialSocketRegistry({
    io: { sockets: { sockets: peers } }, now: () => now,
    resolveUser: async (credential) => {
      if (!credential?.proof) throw new Error('Invalid credentials');
      return { user: { accountId: credential.proof }, auth: { accountId: credential.proof }, expiresAt: now + 1000 };
    },
    onRevoke: (id, reason) => revoked.push({ id, reason }),
    setTimer: (callback) => { timers.push(callback); return timers.length; }, clearTimer: () => {}
  });
  return { registry, peers, timers, revoked, advance(ms) { now += ms; } };
}
test('forged account IDs and game room subscriptions cannot receive private events', async () => {
  const { registry, peers } = registryFixture();
  const alice = socket('alice-socket'); const attacker = socket('attacker-socket');
  attacker.data.playerId = 'alice'; attacker.handshake.auth.accountId = 'alice';
  peers.set(alice.id, alice); peers.set(attacker.id, attacker);
  await registry.authenticate(alice, { proof: 'alice' });
  await assert.rejects(registry.authenticate(attacker, { accountId: 'alice' }));
  registry.emit(['alice'], 'privateMessage', { ciphertext: 'opaque' });
  assert.equal(alice.events.length, 1);
  assert.equal(attacker.events.length, 0);
});
test('expired credentials stop private event delivery before cleanup timer runs', async () => {
  const { registry, peers, advance } = registryFixture();
  const alice = socket('alice'); peers.set(alice.id, alice);
  await registry.authenticate(alice, { proof: 'alice' });
  advance(1001);
  registry.emit(['alice'], 'privateMessage', {});
  assert.equal(alice.events.length, 0);
});
test('identity switch unsubscribes old account and disconnect clears registry', async () => {
  const { registry, peers, revoked } = registryFixture();
  const client = socket('client'); peers.set(client.id, client);
  await registry.authenticate(client, { proof: 'alice' });
  await registry.authenticate(client, { proof: 'bob' });
  registry.emit(['alice'], 'privateMessage', {});
  assert.equal(client.events.length, 0);
  registry.emit(['bob'], 'privateMessage', {});
  assert.equal(client.events.length, 1);
  registry.remove(client);
  assert.equal(registry.sockets.size, 0);
  assert.ok(revoked.some((entry) => entry.id === 'alice'));
});
test('authentication completing after disconnect never registers a socket', async () => {
  const { registry, peers } = registryFixture();
  const client = socket('client'); peers.set(client.id, client);
  const pending = registry.authenticate(client, { proof: 'alice' });
  client.connected = false;
  await assert.rejects(pending);
  assert.equal(registry.sockets.size, 0);
});

test('a delayed earlier login cannot replace a newer authenticated identity', async () => {
  const client = socket('client');
  const pending = [];
  const registry = createSocialSocketRegistry({
    io: { sockets: { sockets: new Map([[client.id, client]]) } },
    resolveUser: (credentials) => new Promise((resolve) => pending.push(() => resolve({ user: { accountId: credentials.proof }, auth: { accountId: credentials.proof }, expiresAt: Date.now() + 10000 }))),
    setTimer: () => 1, clearTimer: () => {}
  });
  const first = registry.authenticate(client, { proof: 'alice' });
  const second = registry.authenticate(client, { proof: 'bob' });
  pending[1]();
  await second;
  pending[0]();
  await assert.rejects(first, { code: 'authentication_superseded' });
  assert.equal(client.data.socialAuth.auth.accountId, 'bob');
  assert.equal(registry.sockets.has('alice'), false);
});

test('failed old login is superseded and cannot revoke newer successful authentication', async () => {
  const client = socket('client');
  const pending = [];
  const registry = createSocialSocketRegistry({
    io: { sockets: { sockets: new Map([[client.id, client]]) } },
    resolveUser: (credentials) => new Promise((resolve, reject) => pending.push({ resolve: () => resolve({ user: { accountId: credentials.proof }, auth: { accountId: credentials.proof }, expiresAt: Date.now() + 10000 }), reject })),
    setTimer: () => 1, clearTimer: () => {}
  });
  const first = registry.authenticate(client, { proof: 'bad' });
  const second = registry.authenticate(client, { proof: 'bob' });
  pending[1].resolve();
  await second;
  pending[0].reject(new Error('Bad credentials'));
  await assert.rejects(first, { code: 'authentication_superseded' });
  assert.equal(client.data.socialAuth.auth.accountId, 'bob');
});
test('expired unused tab does not revoke a still-valid tab for the same account', async () => {
  const { registry, peers, timers, revoked, advance } = registryFixture();
  const older = socket('older'); const newer = socket('newer');
  peers.set(older.id, older); peers.set(newer.id, newer);
  await registry.authenticate(older, { proof: 'alice' });
  advance(500);
  await registry.authenticate(newer, { proof: 'alice' });
  advance(501);
  timers[0]();
  assert.equal(revoked.length, 0);
  assert.equal(registry.sockets.get('alice').size, 1);
  assert.equal(older.events[0].event, 'social:authentication-required');
});

test('joining another socket ID room cannot intercept SDP, ICE, or peer metadata', () => {
  const caller = socket('caller-socket'); const recipient = socket('recipient-socket'); const attacker = socket('attacker-socket');
  const peers = new Map([[caller.id, caller], [recipient.id, recipient], [attacker.id, attacker]]);
  let roomBroadcasts = 0;
  const io = {
    sockets: { sockets: peers },
    // Reproduce Socket.IO's joinable socket-ID room. Public game APIs permit
    // such a subscription, so using io.to(recipient.id) would leak to attacker.
    to: () => ({ emit: (event, payload) => { roomBroadcasts++; recipient.emit(event, payload); attacker.emit(event, payload); } })
  };
  emitDirectSocket(io, recipient.id, 'liveChat:signal', { data: { sdp: 'private-offer' } });
  emitDirectSocket(io, recipient.id, 'liveChat:signal', { data: { candidate: 'private-ice' } });
  emitLiveChatMembers(io, new Map([[caller.id, {}], [recipient.id, {}]]), caller.id, 'liveChat:peer-joined', { participant: 'private-profile' });
  assert.equal(recipient.events.length, 3);
  assert.equal(attacker.events.length, 0);
  assert.equal(caller.events.length, 0);
  assert.equal(roomBroadcasts, 0);
});
