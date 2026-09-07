import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TOTAL_ARROWS,
  chooseAiShot,
  createMatch,
  ringScore,
  sanitizeShot,
  submitShot,
  windFor
} from '../webapp/src/games/archeryroyal/shared/rules.mjs';
import { validateSeatTableRequest } from '../bot/config/onlineGamePolicy.js';
import { attachArcheryRoyal } from '../bot/services/archeryRoyal.js';

const players = [{ id: 'A', name: 'Ada' }, { id: 'B', name: 'Besa' }];

test('archery rings use standard descending target values', () => {
  assert.equal(ringScore(0), 10);
  assert.equal(ringScore(.15), 9);
  assert.equal(ringScore(.7), 5);
  assert.equal(ringScore(3), 0);
});

test('shot contract rejects forged values', () => {
  for (const shot of [null, {}, { aimX: NaN, aimY: 0, power: .8 }, { aimX: 2, aimY: 0, power: .8 }, { aimX: 0, aimY: 0, power: .1 }, { aimX: '0', aimY: 0, power: .8 }]) {
    assert.equal(sanitizeShot(shot), null);
  }
});

test('wind and AI shots are deterministic and legal', () => {
  const match = createMatch(players, 4812);
  assert.deepEqual(windFor(4812, 1), windFor(4812, 1));
  for (const difficulty of ['club', 'tour', 'pro']) {
    const shot = chooseAiShot(match, difficulty);
    assert.deepEqual(shot, chooseAiShot(match, difficulty));
    assert.ok(sanitizeShot(shot));
  }
});

test('turn order, scores, ends and winner are authoritative', () => {
  const match = createMatch(players, 22);
  assert.equal(submitShot(match, 'B', { aimX: 0, aimY: 0, power: .9 }).error, 'not_your_turn');
  for (let index = 0; index < TOTAL_ARROWS; index += 1) {
    const player = match.currentPlayerId;
    const accepted = submitShot(match, player, { aimX: player === 'A' ? 0 : 1, aimY: player === 'A' ? .08 : -1, power: .9 });
    assert.equal(accepted.ok, true);
  }
  assert.equal(match.phase, 'finished');
  assert.equal(match.arrows.A.length, 9);
  assert.equal(match.arrows.B.length, 9);
  assert.equal(match.winnerId, 'A');
  assert.ok(match.scores.A > match.scores.B);
});

test('online matchmaking accepts only the fixed two-player archery contract', () => {
  const request = {
    gameType: 'archeryroyal', stake: 100, maxPlayers: 2,
    matchMeta: { arena: 'royal-grounds', format: 'standard', mode: 'online', token: 'TPG' }
  };
  assert.equal(validateSeatTableRequest(request).ok, true);
  assert.equal(validateSeatTableRequest({ ...request, maxPlayers: 3 }).ok, false);
  assert.equal(validateSeatTableRequest({ ...request, matchMeta: { ...request.matchMeta, arena: 'client-map' } }).error, 'invalid_archery_options');
  assert.equal(validateSeatTableRequest({ ...request, matchMeta: { ...request.matchMeta, token: 'BTC' } }).error, 'invalid_stake_token');
});

class FakeSocket {
  constructor(id, playerId) { this.id = id; this.data = { playerId }; this.handlers = new Map(); this.events = []; }
  on(event, handler) { this.handlers.set(event, handler); }
  off(event) { this.handlers.delete(event); }
  join() {}
  leave() {}
  emit(event, payload) { this.events.push({ event, payload }); }
  call(event, payload = {}) { return new Promise((resolve) => this.handlers.get(event)(payload, resolve)); }
}

class FakeIo {
  constructor() { this.connection = null; this.broadcasts = []; this.sockets = { sockets: new Map() }; }
  on(event, handler) { if (event === 'connection') this.connection = handler; }
  off() {}
  to(room) { return { emit: (event, payload) => this.broadcasts.push({ room, event, payload }) }; }
  connect(socket) { this.sockets.sockets.set(socket.id, socket); this.connection(socket); }
}

test('online runtime binds seats and accepts only the active archer', async () => {
  let now = 1000;
  const io = new FakeIo();
  const settlements = [];
  const runtime = attachArcheryRoyal(io, {
    clock: () => now,
    autoTick: false,
    settleMatch: async (tableId, outcome) => { settlements.push({ tableId, outcome }); return { status: outcome.winnerAccountId ? 'paid' : 'refunded' }; }
  });
  runtime.createMatch({ id: 'archery-1', stake: 100, maxPlayers: 2, players });
  const a = new FakeSocket('socket-a', 'A');
  const b = new FakeSocket('socket-b', 'B');
  io.connect(a);
  io.connect(b);
  assert.equal((await a.call('archery:join', { tableId: 'archery-1' })).ok, true);
  assert.equal((await b.call('archery:join', { tableId: 'archery-1' })).ok, true);
  now += 300;
  const accepted = await a.call('archery:shot', { turnId: 1, requestId: 'one', shot: { aimX: 0, aimY: .08, power: .9 } });
  assert.equal(accepted.ok, true);
  now += 300;
  assert.equal((await a.call('archery:shot', { turnId: 2, requestId: 'two', shot: { aimX: 0, aimY: 0, power: .9 } })).error, 'not_your_turn');
  assert.equal(runtime.rooms.get('archery-1').match.currentPlayerId, 'B');
  assert.equal(settlements.length, 0);
  await runtime.close();
});
