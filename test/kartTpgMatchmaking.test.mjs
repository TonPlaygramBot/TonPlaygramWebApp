import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { io as client } from 'socket.io-client';
import { attachKartRoyale } from '../bot/services/kartRoyale.js';
import {
  validateSeatTableRequest,
  buildReadinessSnapshot
} from '../bot/config/onlineGamePolicy.js';
import {
  aiInput,
  RACE_LIMIT,
  damageRacer,
  standings
} from '../webapp/src/games/kartroyale/simulation.mjs';

async function setup(t, settleMatch) {
  const http = createServer();
  const io = new Server(http, { transports: ['websocket'] });
  io.use((s, next) => {
    s.data.playerId = s.handshake.auth.accountId;
    next();
  });
  let now = Date.now();
  const service = attachKartRoyale(io, { clock: () => now, settleMatch });
  await new Promise((resolve) => http.listen(0, '127.0.0.1', resolve));
  const clients = [];
  const connect = async (accountId) => {
    const c = client(`http://127.0.0.1:${http.address().port}`, {
      auth: { accountId },
      transports: ['websocket'],
      forceNew: true,
      reconnection: false
    });
    clients.push(c);
    await new Promise((resolve, reject) => {
      c.once('connect', resolve);
      c.once('connect_error', reject);
    });
    return c;
  };
  const emit = (s, event, data = {}) => {
    now += 700;
    return new Promise((resolve, reject) =>
      s
        .timeout(1000)
        .emit(`kart:${event}`, data, (e, r) => (e ? reject(e) : resolve(r)))
    );
  };
  const tick = async (advance = 100, delay = 35) => {
    now += advance;
    await new Promise((r) => setTimeout(r, delay));
  };
  t.after(async () => {
    clients.forEach((c) => c.disconnect());
    service.close();
    await new Promise((r) => io.close(r));
  });
  return { service, connect, emit, tick, io };
}
const table = (id, accounts = ['TPG-A', 'TPG-B']) => ({
  id,
  stake: 100,
  meta: { trackId: 'harbor' },
  players: accounts.map((id) => ({ id, tpcAccountNumber: id, name: id }))
});

test('Kart Royale uses the shared TPG seat policy and rejects invalid grids', () => {
  const criteria = {
    gameType: 'kartroyale',
    stake: 100,
    maxPlayers: 2,
    matchMeta: { token: 'TPG', mode: 'online', trackId: 'harbor' }
  };
  for (const maxPlayers of [2, 3, 4, 5, 6])
    assert.equal(
      validateSeatTableRequest({ ...criteria, maxPlayers }).ok,
      true
    );
  for (const patch of [
    { stake: 0 },
    { stake: 0.5 },
    { stake: Infinity },
    { stake: Number.MAX_SAFE_INTEGER },
    { maxPlayers: 1 },
    { maxPlayers: 7 }
  ])
    assert.equal(validateSeatTableRequest({ ...criteria, ...patch }).ok, false);
  for (const patch of [{ token: 'TON' }, { mode: 'ai' }, { trackId: 'fake' }])
    assert.equal(
      validateSeatTableRequest({
        ...criteria,
        matchMeta: { ...criteria.matchMeta, ...patch }
      }).ok,
      false
    );
  assert.equal(buildReadinessSnapshot().kartroyale.checks.backend, true);
});

test('a verified finisher keeps their finishing position after a connection drop', () => {
  const racers = [
    { id: 'second', finished: true, finishTime: 62, disconnected: false },
    { id: 'winner', finished: true, finishTime: 60, disconnected: true },
    { id: 'racing', finished: false, progress: 2.9, disconnected: false }
  ];
  assert.deepEqual(
    standings(racers).map((r) => r.id),
    ['winner', 'second', 'racing']
  );
});

test('matched TPG seats synchronize a human-only race, bind account reconnects and settle the authoritative winner', async (t) => {
  const attempts = [];
  const { service, connect, emit, tick, io } = await setup(
    t,
    async (tableId, outcome) => {
      attempts.push({ tableId, ...outcome });
      if (attempts.length === 1) throw new Error('temporary ledger failure');
      return {
        status: 'paid',
        winnerAccountId: outcome.winnerAccountId,
        amount: 200
      };
    }
  );
  const a = await connect('TPG-A'),
    b = await connect('TPG-B'),
    outsider = await connect('TPG-X');
  const id = 'a7a14cbd-8da4-43b4-8722-44825c7403da';
  service.createMatch(table(id));
  assert.equal(
    (await emit(outsider, 'match', { tableId: id, accountId: 'TPG-A' })).ok,
    false
  );
  const joined = await emit(a, 'match', { tableId: id });
  assert.equal(joined.ok, true);
  assert.equal(joined.state.stake, 100);
  assert.equal(joined.state.token, 'TPG');
  assert.equal(joined.state.players[0].token, undefined);
  assert.equal(service.rooms.get(id).status, 'waiting');
  const quick = await emit(outsider, 'quick', { name: 'Guest' });
  assert.notEqual(
    quick.code,
    id,
    'free quick rooms cannot add racers to a TPG grid'
  );
  await emit(b, 'match', { tableId: id });
  const room = service.rooms.get(id);
  assert.equal(room.status, 'countdown');
  assert.equal(room.racers.length, 2);
  assert.ok(room.racers.every((r) => !r.ai));
  assert.equal((await emit(a, 'start')).ok, false);
  await tick(4000);
  const disconnected = new Promise((r) =>
    io.sockets.sockets.get(a.id).once('disconnect', r)
  );
  a.disconnect();
  await disconnected;
  const credentials = {
    code: id,
    playerId: joined.playerId,
    token: joined.token
  };
  assert.equal(
    (await emit(outsider, 'resume', credentials)).ok,
    false,
    'a token alone cannot take a TPG seat'
  );
  const replacement = await connect('TPG-A');
  assert.equal((await emit(replacement, 'resume', credentials)).ok, true);
  for (let i = 0; i < 2700 && room.status !== 'finished'; i++) {
    for (const [s, account] of [
      [replacement, 'TPG-A'],
      [b, 'TPG-B']
    ]) {
      s.emit('kart:input', {
        ...aiInput(
          room.racers.find((r) => r.id === account),
          room.track,
          room.elapsed,
          'pro'
        ),
        winnerAccountId: 'TPG-X',
        lap: 100,
        x: 1e9
      });
    }
    await tick(190, 17);
  }
  assert.equal(room.status, 'finished');
  assert.ok(room.racers.every((r) => r.finished && r.gates === 13));
  const fastest = [...room.racers].sort(
    (a, b) => a.finishTime - b.finishTime
  )[0];
  assert.equal(attempts[0].winnerAccountId, fastest.id);
  assert.equal(room.settlement.status, 'pending');
  await tick(5100, 80);
  assert.equal(room.settlement.status, 'paid');
  assert.deepEqual(
    attempts[0],
    attempts[1],
    'retry must use the same frozen server result'
  );
  assert.equal(
    (await emit(replacement, 'rematch')).ok,
    false,
    'a rematch must reserve a new stake through the lobby'
  );
});

test('an incomplete grid start refunds; leaving a race without a finisher also refunds', async (t) => {
  const settlements = [];
  const { service, connect, emit, tick } = await setup(
    t,
    async (tableId, outcome) => {
      settlements.push({ tableId, ...outcome });
      return { status: 'refunded', amount: 100, reason: outcome.reason };
    }
  );
  const a = await connect('TPG-A'),
    b = await connect('TPG-B');
  service.createMatch(table('loading'));
  await emit(a, 'match', { tableId: 'loading' });
  await tick(31000, 80);
  assert.equal(settlements[0].reason, 'loading_timeout_refund');
  assert.equal(service.rooms.get('loading').settlement.status, 'refunded');
  await emit(a, 'leave');
  service.createMatch(table('no-finisher'));
  await emit(a, 'match', { tableId: 'no-finisher' });
  await emit(b, 'match', { tableId: 'no-finisher' });
  await tick(4000);
  await emit(a, 'leave');
  await emit(b, 'leave');
  await tick();
  assert.equal(settlements[1].reason, 'no_finisher_refund');
  assert.equal(settlements[1].winnerAccountId, '');
  assert.equal((await emit(a, 'match', { tableId: 'no-finisher' })).ok, false);
});

test('damage cannot retire karts and an idle manual-gas race times out with a no-finisher refund', async (t) => {
  let outcome;
  const { service, connect, emit, tick } = await setup(t, async (_, result) => {
    outcome = result;
    return { status: 'refunded', reason: result.reason };
  });
  const a = await connect('TPG-A'),
    b = await connect('TPG-B'),
    id = 'retired-grid';
  service.createMatch(table(id));
  await emit(a, 'match', { tableId: id });
  await emit(b, 'match', { tableId: id });
  await tick(4000);
  const room = service.rooms.get(id);
  room.racers.forEach((r) => damageRacer(r, 100));
  await tick(100);
  assert.equal(room.status, 'racing');
  assert.ok(room.racers.every((r) => !r.retired && r.speed === 0));
  room.elapsed = RACE_LIMIT;
  await tick(100);
  assert.equal(room.status, 'finished');
  assert.ok(room.racers.every((r) => !r.retired && !r.finished));
  assert.equal(outcome.winnerAccountId, '');
  assert.equal(outcome.reason, 'no_finisher_refund');
});
