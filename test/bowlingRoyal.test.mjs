import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newPlayer,
  recordRoll,
  frameIndex,
  availablePins,
  symbols
} from '../shared/bowling/scoring.js';
import { BowlingMatch, swipeInput } from '../shared/bowling/engine.js';
import { createBowlingRoyal } from '../bot/services/bowlingRoyal.js';
import {
  reserveBowlingStake,
  settleBowlingStake
} from '../bot/services/bowlingStake.js';
import {
  createMemoryUser,
  findMemoryUser
} from '../bot/utils/memoryUserStore.js';
import { validateSeatTableRequest } from '../bot/config/onlineGamePolicy.js';
import { getTpgGameContract } from '../bot/config/tpgGameContracts.js';
process.env.MONGO_URI = 'memory';
const user = (accountId, balance = 1000) =>
  createMemoryUser({ accountId, tpcAccountNumber: accountId, balance });
const balance = (id) => findMemoryUser({ accountId: id }).balance;
const table = (id, accounts = [`${id}-a`, `${id}-b`]) => ({
  id,
  gameType: 'bowlingroyal',
  stake: 100,
  maxPlayers: 2,
  meta: { format: 'tenpin', mode: 'online', token: 'tpg' },
  players: accounts.map((id) => ({ id, tpcAccountNumber: id, name: id })),
  ready: new Set(accounts)
});
const standard = { power: 0.85, releaseX: 0.2, targetX: 0.16, hook: 0 };
function fakeSocket(id, account) {
  const handlers = new Map();
  return {
    id,
    data: { playerId: account, auth: { accountId: account } },
    on: (e, h) => handlers.set(e, h),
    join() {},
    leave() {},
    disconnect() {
      handlers.get('disconnect')?.();
    },
    request(event, payload = {}) {
      return new Promise((resolve) =>
        handlers.get(event)({ accountId: account, ...payload }, resolve)
      );
    }
  };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

test('official scoring: perfect, all spares, misses, open frames and pending bonuses', () => {
  for (const [rolls, total] of [
    [Array(12).fill(10), 300],
    [Array(21).fill(5), 150],
    [Array(20).fill(0), 0],
    [Array(20).fill(1), 20]
  ]) {
    const p = newPlayer('You');
    rolls.forEach((n) => recordRoll(p, n));
    assert.equal(frameIndex(p), -1);
    assert.equal(p.total, total);
    assert.equal(p.frames[9].cumulative, total);
    assert.throws(() => recordRoll(p, 0), /finished/);
  }
  const p = newPlayer('You');
  recordRoll(p, 10);
  recordRoll(p, 3);
  assert.equal(p.frames[0].cumulative, null);
  recordRoll(p, 4);
  assert.equal(p.frames[0].cumulative, 17);
  assert.equal(p.total, 24);
});
test('tenth frame resets after strikes/spares and retains pins after a non-strike bonus', () => {
  for (const [rolls, maxima, expected] of [
    [[10, 7, 3], [10, 10, 3], 20],
    [[10, 10, 10], [10, 10, 10], 30],
    [[9, 1, 10], [10, 1, 10], 20],
    [[7, 2], [10, 3], 9]
  ]) {
    const p = newPlayer('You');
    Array(18)
      .fill(0)
      .forEach((n) => recordRoll(p, n));
    rolls.forEach((n, i) => {
      assert.equal(availablePins(p), maxima[i]);
      recordRoll(p, n);
    });
    assert.equal(p.total, expected);
  }
  const p = newPlayer('You');
  Array(18)
    .fill(0)
    .forEach((n) => recordRoll(p, n));
  [10, 7].forEach((n) => recordRoll(p, n));
  for (const n of [4, 11, -1, 1.5, NaN, Infinity])
    assert.throws(() => recordRoll(p, n), /pin_count/);
  recordRoll(p, 3);
  assert.deepEqual(symbols(p.frames[9], 9), ['X', '7', '/']);
});
test('portrait coordinates are relative to the canvas; upward swipe adds power and right stays right', () => {
  const left = swipeInput(390, 844, 195, 750, 100, 440),
    right = swipeInput(390, 844, 195, 750, 300, 440),
    down = swipeInput(390, 844, 195, 440, 195, 750);
  assert.ok(left.power > 0.8);
  assert.ok(left.targetX < 0 && left.hook < 0);
  assert.ok(right.targetX > 0 && right.hook > 0);
  assert.equal(down.power, 0);
});
test('rigid-body strikes and gutters settle exactly once and allow the next turn', () => {
  for (const [input, pins] of [
    [standard, 10],
    [{ ...standard, targetX: 1.6 }, 0]
  ]) {
    const m = new BowlingMatch({ ai: false });
    m.throwBall(0, 1, input);
    assert.throws(() => m.throwBall(0, 1, input), /turn/);
    for (let i = 0; i < 1600 && m.state.turn === 1; i++) m.advance(1 / 120);
    assert.equal(m.state.phase, 'ready');
    assert.equal(m.state.lastShot.pins, pins);
    assert.equal(m.state.lastShot.turn, 1);
    assert.deepEqual(m.state.players[0].frames[0].rolls, [pins]);
    assert.equal(m.state.active, pins === 10 ? 1 : 0);
    assert.equal(m.state.standing.filter(Boolean).length, 10);
  }
});
test('full AI games finish, scores stay valid, and replaying the seed gives the same results', () => {
  const play = () => {
    const m = new BowlingMatch({ ai: true, difficulty: 2, seed: 17 });
    let ticks = 0;
    while (m.state.phase !== 'over' && ticks++ < 60000) {
      if (m.state.phase === 'ready' && m.state.active === 0)
        m.throwBall(0, m.state.turn, standard);
      m.advance(0.1);
    }
    assert.equal(m.state.phase, 'over');
    for (const p of m.state.players) {
      assert.equal(frameIndex(p), -1);
      assert.ok(p.total >= 0 && p.total <= 300);
    }
    return m.state.players;
  };
  assert.deepEqual(play(), play());
});
test('online queue validates format, identities, seats, token and safe integer stakes', () => {
  const base = {
    gameType: 'bowlingroyal',
    stake: 100,
    maxPlayers: 2,
    matchMeta: { token: 'TPG', mode: 'online', format: 'tenpin' }
  };
  assert.equal(validateSeatTableRequest(base).ok, true);
  assert.deepEqual(getTpgGameContract('bowlingroyal').matchmaking, [
    'stake',
    'format'
  ]);
  for (const patch of [
    { stake: 0 },
    { stake: 1.5 },
    { stake: Number.MAX_SAFE_INTEGER },
    { maxPlayers: 3 },
    { matchMeta: { ...base.matchMeta, format: 'fivepin' } },
    { matchMeta: { ...base.matchMeta, mode: 'ai' } },
    { matchMeta: { ...base.matchMeta, token: 'TON' } }
  ])
    assert.equal(validateSeatTableRequest({ ...base, ...patch }).ok, false);
});
test('TPG reservations/payouts/refunds are idempotent and prevent account reuse', async () => {
  const t = table('ledger');
  t.players.forEach((p) => user(p.id));
  await reserveBowlingStake(t);
  await reserveBowlingStake(t);
  assert.equal(balance(t.players[0].id), 900);
  assert.equal(balance(t.players[1].id), 900);
  await assert.rejects(reserveBowlingStake({ ...t, stake: 200 }), /mismatch/);
  await assert.rejects(
    reserveBowlingStake({ ...t, id: 'another' }),
    /active_match/
  );
  await assert.rejects(settleBowlingStake(t.id, 'outsider'), /invalid_winner/);
  await Promise.all([
    settleBowlingStake(t.id, t.players[0].id),
    settleBowlingStake(t.id, t.players[1].id)
  ]);
  assert.equal(balance(t.players[0].id), 1100);
  assert.equal(balance(t.players[1].id), 900);
  const tie = table('tie');
  tie.players.forEach((p) => user(p.id));
  await reserveBowlingStake(tie);
  await settleBowlingStake(tie.id, null, 'tie');
  await settleBowlingStake(tie.id, null, 'tie');
  tie.players.forEach((p) => assert.equal(balance(p.id), 1000));
  const poor = table('poor');
  user(poor.players[0].id);
  user(poor.players[1].id, 50);
  await assert.rejects(reserveBowlingStake(poor), /insufficient/);
  assert.equal(balance(poor.players[0].id), 1000);
});
test('socket seats reject forged, duplicate, stale and wrong-turn inputs; reconnect preserves a seat', async () => {
  let clock = 100000;
  const t = table('seats');
  t.players.forEach((p) => user(p.id));
  const service = createBowlingRoyal({
    io: {},
    tableMap: new Map([[t.id, t]]),
    autoTick: false,
    now: () => clock
  });
  await service.prepare(t);
  const a = fakeSocket('a', t.players[0].id),
    b = fakeSocket('b', t.players[1].id),
    x = fakeSocket('x', 'outsider');
  [a, b, x].forEach(service.attach);
  const body = { tableId: t.id };
  assert.equal((await x.request('bowlingJoin', body)).success, false);
  assert.equal(
    (await a.request('bowlingJoin', { ...body, accountId: t.players[1].id }))
      .success,
    false
  );
  assert.equal((await a.request('bowlingJoin', body)).data.seat, 0);
  await b.request('bowlingJoin', body);
  assert.equal(
    (await b.request('bowlingThrow', { ...body, turn: 1, input: standard }))
      .success,
    false
  );
  const shot = { ...body, turn: 1, input: standard, winner: 1, score: 300 };
  assert.equal((await a.request('bowlingThrow', shot)).success, true);
  assert.equal((await a.request('bowlingThrow', shot)).success, true);
  assert.equal(
    (
      await a.request('bowlingThrow', {
        ...shot,
        input: { ...standard, power: 0.5 }
      })
    ).success,
    false
  );
  for (let i = 0; i < 250; i++) {
    clock += 33;
    service.tick();
  }
  const sa = (await a.request('bowlingSync', body)).data,
    sb = (await b.request('bowlingSync', body)).data;
  assert.deepEqual(sa.state, sb.state);
  assert.equal(sa.state.players[0].frames[0].rolls.length, 1);
  assert.equal(sa.state.players[0].total, 0);
  const replacement = fakeSocket('new', t.players[0].id);
  service.attach(replacement);
  assert.equal((await replacement.request('bowlingJoin', body)).data.seat, 0);
  a.disconnect();
  assert.equal((await a.request('bowlingSync', body)).success, false);
  assert.equal((await replacement.request('bowlingSync', body)).success, true);
  await replacement.request('bowlingLeave', body);
  await flush();
  await replacement.request('bowlingLeave', body);
  assert.equal(balance(t.players[1].id), 1100);
  assert.equal(service.rooms.get(t.id).match.state.winner, 1);
  service.close();
});
test('missing start, disconnect grace and turn timeout use authoritative outcomes', async () => {
  for (const scenario of [
    'unloaded',
    'both-away',
    'one-away',
    'turn-timeout'
  ]) {
    let clock = 200000;
    const t = table(scenario);
    t.players.forEach((p) => user(p.id));
    const service = createBowlingRoyal({
      io: {},
      tableMap: new Map([[t.id, t]]),
      autoTick: false,
      now: () => clock
    });
    await service.prepare(t);
    const a = fakeSocket('a', t.players[0].id),
      b = fakeSocket('b', t.players[1].id);
    [a, b].forEach(service.attach);
    const p = { tableId: t.id };
    await a.request('bowlingJoin', p);
    if (scenario !== 'unloaded') await b.request('bowlingJoin', p);
    if (scenario === 'turn-timeout') {
      for (let i = 0; i < 500; i++) {
        clock += 100;
        await a.request('bowlingSync', p);
        await b.request('bowlingSync', p);
        service.tick();
      }
    } else {
      clock += 61000;
      if (scenario !== 'both-away') await a.request('bowlingSync', p);
      service.tick();
    }
    await flush();
    const winner = service.rooms.get(t.id).match.state.winner;
    assert.equal(
      winner,
      scenario === 'one-away' ? 0 : scenario === 'turn-timeout' ? 1 : null
    );
    assert.equal(balance(t.players[0].id) + balance(t.players[1].id), 2000);
    service.close();
  }
});
test('cancellation during reservation refunds; transient settlement retries the frozen winner', async () => {
  const t = table('cancel');
  t.players.forEach((p) => user(p.id));
  const tables = new Map([[t.id, t]]);
  const cancelled = createBowlingRoyal({
    io: {},
    tableMap: tables,
    autoTick: false,
    reserve: async (table) => {
      const r = await reserveBowlingStake(table);
      tables.delete(table.id);
      return r;
    }
  });
  await assert.rejects(cancelled.prepare(t), /cancelled/);
  t.players.forEach((p) => assert.equal(balance(p.id), 1000));
  cancelled.close();
  const retry = table('retry');
  retry.players.forEach((p) => user(p.id));
  let clock = 500000,
    calls = 0;
  const service = createBowlingRoyal({
    io: {},
    tableMap: new Map([[retry.id, retry]]),
    autoTick: false,
    now: () => clock,
    settle: async (...args) => {
      if (++calls === 1) throw Error('temporary outage');
      return settleBowlingStake(...args);
    }
  });
  await service.prepare(retry);
  const a = fakeSocket('a', retry.players[0].id),
    b = fakeSocket('b', retry.players[1].id);
  [a, b].forEach(service.attach);
  const p = { tableId: retry.id };
  await a.request('bowlingJoin', p);
  await b.request('bowlingJoin', p);
  await a.request('bowlingLeave', p);
  await flush();
  assert.equal(service.rooms.get(retry.id).settlement.status, 'pending');
  await b.request('bowlingLeave', p);
  await flush();
  clock += 6000;
  service.tick();
  await flush();
  assert.equal(service.rooms.get(retry.id).match.state.winner, 1);
  assert.equal(balance(retry.players[1].id), 1100);
  assert.equal(balance(retry.players[0].id), 900);
  service.close();
});
