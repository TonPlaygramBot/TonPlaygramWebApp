import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPoolOnlineTournaments } from '../bot/services/poolOnlineTournaments.js';

function setup(size = 4) {
  let time = 100;
  const tableMap = new Map(), poolStates = new Map();
  const io = { to: () => ({ emit() {} }) };
  const service = createPoolOnlineTournaments({ io, tableMap, poolStates, now: () => time });
  const players = Array.from({ length: size }, (_, i) => ({ id: `socket-${i}`, data: { playerId: `p${i}`, auth: { accountId: `p${i}` } }, join() {}, leave() {} }));
  const call = (i, action, extra = {}) => service.act(players[i], { accountId: `p${i}`, action, id: event?.id, ...extra });
  let event = null;
  event = call(0, 'create', { size, variant: '9ball', name: 'Host' });
  for (let i = 1; i < size; i++) event = call(i, 'join', { name: `Player ${i}` });
  const start = () => (event = call(0, 'start'));
  const finish = pair => {
    const a = Number(pair.a.slice(1)), b = Number(pair.b.slice(1));
    poolStates.set(pair.tableId, { state: { frameOver: true, winner: 'A' } });
    event = call(a, 'report', { tableId: pair.tableId, winner: 'A' });
    assert.equal(event.draw.flat().find(p => p.tableId === pair.tableId).winner, undefined);
    event = call(b, 'report', { tableId: pair.tableId, winner: 'A' });
    return event;
  };
  return { call, start, finish, service, tableMap, poolStates, players, advanceTime: value => { time += value; } };
}
for (const size of [4, 8, 16, 32]) test(`${size} live entrants advance to exactly one champion after mutual results`, () => {
  const h = setup(size);
  let event = h.start(), matches = 0;
  while (event.status === 'active') {
    for (const pair of [...event.draw[event.round]]) { event = h.finish(pair); matches++; }
  }
  assert.equal(matches, size - 1);
  assert.equal(event.draw.length, Math.log2(size));
  assert.equal(event.champion, event.draw.at(-1)[0].winner);
  assert.equal(h.tableMap.size, size - 1);
  const pair = event.draw[0][0];
  assert.equal(h.call(Number(pair.a.slice(1)), 'report', { tableId: pair.tableId, winner: 'A' }).champion, event.champion);
});
test('seat, settled result, winner agreement and host checks reject unauthorized changes', () => {
  const h = setup();
  assert.throws(() => h.call(1, 'start'), /host/);
  let event = h.start();
  const pair = event.draw[0][0], a = Number(pair.a.slice(1));
  const other = [0, 1, 2, 3].find(i => ![pair.a, pair.b].includes(`p${i}`));
  assert.throws(() => h.call(a, 'report', { tableId: pair.tableId, winner: 'A' }), /settled/);
  assert.throws(() => h.call(other, 'report', { tableId: pair.tableId, winner: 'A' }), /seated/);
  h.poolStates.set(pair.tableId, { state: { frameOver: true, winner: 'A' } });
  assert.throws(() => h.call(a, 'report', { tableId: pair.tableId, winner: 'B' }), /disagree/);
  assert.throws(() => h.call(a, 'sync', { accountId: 'spoof' }), /Sign in/);
  assert.throws(() => h.call(a, 'leave'), /Concede/);
  assert.equal(h.service.canUpdate(h.tableMap.get(pair.tableId), pair.a), false);
});
test('only the active seat can relay a shot, including the first shot', () => {
  const h = setup(), pair = h.start().draw[0][0], table = h.tableMap.get(pair.tableId);
  assert.equal(h.service.canUpdate(table, pair.a), true);
  assert.equal(h.service.canUpdate(table, pair.b), false);
  h.poolStates.set(pair.tableId, { state: { activePlayer: 'B' } });
  assert.equal(h.service.canUpdate(table, pair.a), false);
  assert.equal(h.service.canUpdate(table, pair.b), true);
});
test('reconnect preserves the draw and forfeit is idempotent', () => {
  const h = setup(), event = h.start(), pair = event.draw[0][0], a = Number(pair.a.slice(1));
  h.players[a].id = 'reconnected';
  assert.deepEqual(h.call(a, 'join').draw, event.draw);
  assert.equal(h.call(a, 'forfeit', { tableId: pair.tableId }).draw[0][0].winner, pair.b);
  assert.equal(h.call(a, 'forfeit', { tableId: pair.tableId }).draw[0][0].winner, pair.b);
  assert.equal(h.call(a, 'leave').draw[0][0].winner, pair.b);
});
test('waiting room host transfers and expired rooms release all tables', () => {
  const h = setup();
  assert.equal(h.call(0, 'leave').host, 'p1');
  assert.throws(() => h.call(1, 'start'), /every seat/);
  h.call(0, 'join');
  const event = h.call(1, 'start');
  assert.equal(h.tableMap.size, 2);
  h.advanceTime(6 * 60 * 60 * 1000 + 1);
  h.service.sweep();
  assert.equal(h.tableMap.size, 0);
  assert.equal(h.poolStates.size, 0);
  assert.throws(() => h.call(1, 'sync', { id: event.id }), /expired/);
});
