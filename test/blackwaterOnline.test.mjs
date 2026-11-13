import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { io as client } from 'socket.io-client';
import { attachBlackwater } from '../bot/services/blackwater.js';
const table = (id) => ({
  id,
  stake: 100,
  players: ['A', 'B'].map((id) => ({ id, tpcAccountNumber: id, name: id }))
});
async function fixture(t, settleMatch) {
  const http = createServer(),
    io = new Server(http, { transports: ['websocket'] });
  io.use((s, next) => {
    s.data.playerId = s.handshake.auth.accountId;
    next();
  });
  let now = 100000;
  const service = attachBlackwater(io, {
      clock: () => now,
      settleMatch,
      autoTick: false
    }),
    clients = [];
  await new Promise((r) => http.listen(0, '127.0.0.1', r));
  const connect = async (accountId) => {
    const c = client(`http://127.0.0.1:${http.address().port}`, {
      auth: { accountId },
      transports: ['websocket'],
      forceNew: true,
      reconnection: false
    });
    clients.push(c);
    await new Promise((r, j) => {
      c.once('connect', r);
      c.once('connect_error', j);
    });
    return c;
  };
  const emit = (c, event, data = {}) =>
    new Promise((r, j) =>
      c
        .timeout(2000)
        .emit(`blackwater:${event}`, data, (e, v) => (e ? j(e) : r(v)))
    );
  const advance = async (ms) => {
    for (let i = 0; i < ms; i += 20) {
      now += 20;
      service.tick();
    }
    await new Promise((r) => setImmediate(r));
  };
  t.after(async () => {
    clients.forEach((c) => c.disconnect());
    service.close();
    await new Promise((r) => io.close(r));
  });
  return { service, connect, emit, advance, io };
}
test('two TPG seats join one server match; outsiders and replacement sockets cannot control another seat', async (t) => {
  const calls = [],
    f = await fixture(t, async (id, outcome) => {
      calls.push({ id, ...outcome });
      return {
        status: outcome.winnerAccountId ? 'paid' : 'refunded',
        amount: 200,
        ...outcome
      };
    });
  f.service.createMatch(table('match'));
  const a = await f.connect('A'),
    b = await f.connect('B'),
    outsider = await f.connect('X');
  assert.equal(
    (await f.emit(outsider, 'join', { tableId: 'match', accountId: 'A' })).ok,
    false
  );
  const joined = await f.emit(a, 'join', { tableId: 'match', weapon: 'smg' });
  assert.equal(joined.ok, true);
  assert.equal(joined.state.players[0].ammo, 36);
  assert.equal(joined.state.players[0].socketId, undefined);
  await f.emit(b, 'join', { tableId: 'match' });
  const room = f.service.rooms.get('match');
  assert.equal(room.status, 'countdown');
  await f.advance(3600);
  assert.equal(room.status, 'playing');
  const replacement = await f.connect('A');
  await f.advance(400);
  assert.equal(
    (await f.emit(replacement, 'join', { tableId: 'match' })).ok,
    true
  );
  a.emit('blackwater:input', {
    seq: 100,
    rx: 1,
    forward: 0,
    yaw: 0,
    pitch: 0,
    fire: true
  });
  await f.emit(replacement, 'sync');
  assert.equal(room.match.players[0].input.fire, false);
  await f.emit(b, 'leave');
  await f.advance(40);
  assert.equal(room.status, 'finished');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].winnerAccountId, 'A');
  await f.advance(2000);
  assert.equal(calls.length, 1);
});
test('loading failures refund, lost connections get a grace period, and pending settlements retry', async (t) => {
  let tries = 0;
  const f = await fixture(t, async (_id, outcome) => {
    if (++tries === 1) throw new Error('temporary test ledger failure');
    return { status: 'refunded', ...outcome };
  });
  f.service.createMatch(table('unloaded'));
  await f.advance(30100);
  const room = f.service.rooms.get('unloaded');
  assert.equal(room.status, 'finished');
  assert.equal(room.outcome.reason, 'loading_timeout_refund');
  assert.equal(room.settlement.status, 'pending');
  await f.advance(5100);
  assert.equal(room.settlement.status, 'refunded');
  assert.equal(tries, 2);
  f.service.createMatch(table('reconnect'));
  let a = await f.connect('A');
  const b = await f.connect('B');
  await f.emit(a, 'join', { tableId: 'reconnect' });
  await f.emit(b, 'join', { tableId: 'reconnect' });
  await f.advance(3600);
  const dropped = new Promise((r) =>
    f.io.sockets.sockets.get(a.id).once('disconnect', r)
  );
  a.disconnect();
  await dropped;
  await f.advance(7000);
  assert.equal(f.service.rooms.get('reconnect').status, 'playing');
  a = await f.connect('A');
  assert.equal((await f.emit(a, 'join', { tableId: 'reconnect' })).ok, true);
  assert.equal(
    f.service.rooms.get('reconnect').match.players[0].forfeited,
    false
  );
});
