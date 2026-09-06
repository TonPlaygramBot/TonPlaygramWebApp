import test from 'node:test';
import assert from 'node:assert/strict';
import { createTennisRoyal } from '../bot/services/tennisRoyal.js';
import {
  reserveTennisStake,
  settleTennisStake
} from '../bot/services/tennisStake.js';
import {
  createMemoryUser,
  findMemoryUser
} from '../bot/utils/memoryUserStore.js';
import { validateSeatTableRequest } from '../bot/config/onlineGamePolicy.js';
import { updateTennisCareer } from '../bot/services/tennisCareer.js';
import {
  createMatch,
  advance,
  setInput,
  neutralInput,
  awardPoint,
  initialScore
} from '../shared/tennis/engine.js';
process.env.MONGO_URI = 'memory';
const user = (id, balance = 1000) =>
  createMemoryUser({ accountId: id, tpcAccountNumber: id, balance });
const funds = (id) => findMemoryUser({ accountId: id }).balance;
const table = (id, accounts = ['a', 'b']) => ({
  id,
  players: accounts.map((id) => ({ id, tpcAccountNumber: id })),
  stake: 100,
  meta: { surface: 'clay', format: 'set' },
  ready: new Set(accounts)
});
function fakeSocket(id, accountId) {
  const handlers = new Map();
  return {
    id,
    data: { playerId: accountId, auth: { accountId } },
    on: (event, handler) => handlers.set(event, handler),
    join() {},
    leave() {},
    emit(event, payload) {
      handlers.get(event)?.(payload);
    },
    request(event, payload = {}) {
      return new Promise((resolve) =>
        handlers.get(event)(
          { ...payload, accountId: payload.accountId ?? accountId },
          resolve
        )
      );
    }
  };
}

test('Tennis queue validates court, format, player count and TPG token', () => {
  const base = {
    gameType: 'tennisroyal',
    maxPlayers: 2,
    stake: 100,
    matchMeta: { surface: 'hard', format: 'set', token: 'TPG', mode: 'online' }
  };
  assert.equal(validateSeatTableRequest(base).ok, true);
  for (const patch of [
    { stake: 0 },
    { maxPlayers: 3 },
    { matchMeta: { ...base.matchMeta, surface: 'ice' } },
    { matchMeta: { ...base.matchMeta, token: 'TON' } },
    { matchMeta: { ...base.matchMeta, format: 'anything' } }
  ])
    assert.equal(validateSeatTableRequest({ ...base, ...patch }).ok, false);
});
test('Stake reservation, insufficiency, payout replay and refunds conserve balances', async () => {
  user('ledger-a');
  user('ledger-b');
  const t = table('ledger', ['ledger-a', 'ledger-b']);
  await reserveTennisStake(t);
  await reserveTennisStake(t);
  assert.equal(funds('ledger-a'), 900);
  assert.equal(funds('ledger-b'), 900);
  await assert.rejects(
    reserveTennisStake(table('duplicate', ['ledger-a', 'ledger-b'])),
    /active_match/
  );
  await assert.rejects(
    settleTennisStake('ledger', 'outsider'),
    /invalid_winner/
  );
  await settleTennisStake('ledger', 'ledger-a');
  await settleTennisStake('ledger', 'ledger-a');
  assert.equal(funds('ledger-a'), 1100);
  assert.equal(funds('ledger-b'), 900);
  user('poor', 50);
  const before = funds('ledger-a');
  await assert.rejects(
    reserveTennisStake(table('poor-match', ['ledger-a', 'poor'])),
    /insufficient/
  );
  assert.equal(funds('ledger-a'), before);
  assert.equal(funds('poor'), 50);
  const refund = table('refund', ['ledger-a', 'ledger-b']);
  await reserveTennisStake(refund);
  await settleTennisStake('refund');
  await settleTennisStake('refund');
  assert.equal(funds('ledger-a'), 1100);
  assert.equal(funds('ledger-b'), 900);
});
test('Two clients share authoritative tennis; outsiders, spoofed identities and replaced sockets cannot move', async () => {
  user('a');
  user('b');
  const t = table('room'),
    tables = new Map([[t.id, t]]);
  let clock = 100000;
  const service = createTennisRoyal({
    io: {},
    tableMap: tables,
    autoTick: false,
    now: () => clock
  });
  await service.prepare(t);
  const a = fakeSocket('s-a', 'a'),
    b = fakeSocket('s-b', 'b'),
    outsider = fakeSocket('s-x', 'x');
  [a, b, outsider].forEach(service.attach);
  assert.equal(
    (await outsider.request('tennisJoin', { tableId: t.id })).success,
    false
  );
  assert.equal(
    (await a.request('tennisJoin', { tableId: t.id, accountId: 'b' })).success,
    false
  );
  assert.equal((await a.request('tennisJoin', { tableId: t.id })).data.seat, 0);
  assert.equal((await b.request('tennisJoin', { tableId: t.id })).data.seat, 1);
  await a.request('tennisInput', {
    tableId: t.id,
    input: { ...neutralInput(), swing: 1 },
    winner: 'a',
    score: { sets: [99, 0] }
  });
  for (let i = 0; i < 60; i++) {
    clock += 33;
    service.tick();
  }
  const sa = await a.request('tennisInput', {
      tableId: t.id,
      input: { ...neutralInput(), swing: 1 }
    }),
    sb = await b.request('tennisInput', {
      tableId: t.id,
      input: neutralInput()
    });
  assert.deepEqual(sa.data.state, sb.data.state);
  assert.equal(sa.data.state.config.ai, false);
  assert.ok(sa.data.state.time > 1.8);
  assert.equal(sa.data.state.config.surface, 'clay');
  assert.deepEqual(sa.data.state.score.sets, [0, 0]);
  const replacement = fakeSocket('s-a-new', 'a');
  service.attach(replacement);
  await replacement.request('tennisJoin', { tableId: t.id });
  a.emit('disconnect');
  assert.equal(
    (await a.request('tennisInput', { tableId: t.id, input: neutralInput() }))
      .success,
    false
  );
  assert.equal(
    (
      await replacement.request('tennisInput', {
        tableId: t.id,
        input: neutralInput()
      })
    ).success,
    true
  );
  await replacement.request('tennisLeave', { tableId: t.id });
  await new Promise((r) => setImmediate(r));
  assert.equal(service.rooms.get(t.id).state.winner, 1);
  assert.equal(funds('a'), 900);
  assert.equal(funds('b'), 1100);
  await replacement.request('tennisLeave', { tableId: t.id });
  assert.equal(funds('b'), 1100);
  service.close();
});
test('Both absent clients get one refund and a lone connected player wins after grace', async () => {
  for (const id of ['abs-a', 'abs-b', 'stay-a', 'stay-b']) user(id);
  let clock = 200000;
  const t = table('absent', ['abs-a', 'abs-b']);
  const t2 = table('single', ['stay-a', 'stay-b']);
  const tables = new Map([
    [t.id, t],
    [t2.id, t2]
  ]);
  const service = createTennisRoyal({
    io: {},
    tableMap: tables,
    autoTick: false,
    now: () => clock
  });
  await service.prepare(t);
  await service.prepare(t2);
  const stay = fakeSocket('stay', 'stay-a');
  service.attach(stay);
  await stay.request('tennisJoin', { tableId: t2.id });
  clock += 61000;
  await stay.request('tennisInput', { tableId: t2.id, input: neutralInput() });
  service.tick();
  await new Promise((r) => setImmediate(r));
  service.tick();
  assert.equal(funds('abs-a'), 1000);
  assert.equal(funds('abs-b'), 1000);
  assert.equal(funds('stay-a'), 1100);
  assert.equal(funds('stay-b'), 900);
  service.close();
});
test('Cancellation while the stake transaction runs refunds both accounts', async () => {
  user('cancel-a');
  user('cancel-b');
  const t = table('cancel', ['cancel-a', 'cancel-b']);
  const tables = new Map([[t.id, t]]);
  const service = createTennisRoyal({
    io: {},
    tableMap: tables,
    autoTick: false,
    reserve: async (table) => {
      const r = await reserveTennisStake(table);
      table.players.pop();
      return r;
    }
  });
  await assert.rejects(service.prepare(t), /lobby_cancelled/);
  assert.equal(funds('cancel-a'), 1000);
  assert.equal(funds('cancel-b'), 1000);
  service.close();
});
test('Career persists by account, rejects replay and awards only skill points', async () => {
  user('career');
  const start = await updateTennisCareer('career', 'start');
  const result = await updateTennisCareer('career', 'finish', {
    id: start.id,
    won: true,
    rally: 8
  });
  assert.equal(result.wins, 1);
  assert.equal(
    (
      await updateTennisCareer('career', 'finish', {
        id: start.id,
        won: true,
        rally: 8
      })
    ).wins,
    1
  );
  assert.equal((await updateTennisCareer('career', 'get')).wins, 1);
  await assert.rejects(
    updateTennisCareer('other', 'finish', {
      id: start.id,
      won: true,
      rally: 8
    }),
    /not_active/
  );
  assert.equal(
    (await updateTennisCareer('career', 'upgrade', { stat: 0 })).upgrades[0],
    1
  );
  await assert.rejects(
    updateTennisCareer('career', 'upgrade', { stat: 1 }),
    /unavailable/
  );
  assert.equal(funds('career'), 1000);
});
test('Ported engine keeps deuce and completes a full rally-based match', () => {
  const score = initialScore();
  score.points = [3, 3];
  awardPoint(score, 0, 6, 2);
  assert.deepEqual(score.points, [4, 3]);
  awardPoint(score, 1, 6, 2);
  assert.deepEqual(score.points, [4, 4]);
  const s = createMatch();
  for (let i = 0; i < 36000 && s.phase !== 'over'; i++) {
    if (i % 30 === 0)
      setInput(s, 0, { ...neutralInput(), swing: i + 1, aim: 0.85 });
    advance(s, 1 / 120);
  }
  assert.equal(s.phase, 'over');
  assert.ok(s.bestRally > 2);
  assert.ok(s.pointCount >= 4);
});
