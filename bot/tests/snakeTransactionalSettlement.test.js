import test from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { SnakeGame } from '../logic/snakeGame.js';
import { captureSnakeServerResult, snakeRulesHash } from '../services/settlement/snakeServerResult.js';
import { createSnakeTransactionalSettlement } from '../services/settlement/snakeTransactionalSettlement.js';

function setup() {
  const game = new SnakeGame(); game.addPlayer('a', 'A'); game.addPlayer('b', 'B');
  game.players.forEach(p => { p.playerId = p.id; });
  game.players[0].position = 49; game.rollDice([1]);
  const room = { id: 'room1', settlementMatchId: 'match1', gameType: 'snake', status: 'finished', game, players: game.players, snakes: {}, ladders: {}, initialDiceCells: {} };
  const match = { _id: 'match1', matchId: 'match1', roomId: 'room1', gameType: 'snake', assetId: 'test-ledger', status: 'reserved', version: 0,
    startedAt: '2026-11-17T12:00:00Z', rulesHash: snakeRulesHash({ snakes: {}, ladders: {}, diceCells: {} }),
    feePolicy: { policyId: 'test-fee', units: '2', accountId: 'house' }, reservations: ['a', 'b'].map(accountId => ({
      matchId: 'match1', assetId: 'test-ledger', accountId, receiptId: `held-${accountId}`, status: 'held', units: '10' })) };
  let data = { matches: [match], users: ['a', 'b', 'house'].map(id => ({ _id: id, tpcAccountNumber: id, balance: 90,
    transactions: id === 'house' ? [] : [{ transactionId: `held-${id}`, amount: -10, type: 'stake_reserve', token: 'TPG', status: 'reserved', game: 'snake', detail: 'match1' }] })), receipts: [] };
  const calls = []; let failCreditAt = 0; let creditAttempts = 0; let failReceipt = false; let ended = false;
  const session = { async withTransaction(fn, options) { calls.push(options); const before = structuredClone(data);
    try { await fn(); } catch (e) { data = before; throw e; } }, async endSession() { ended = true; } };
  const matches = (doc, query) => Object.entries(query).every(([key, value]) => isDeepStrictEqual(doc[key], value));
  const collection = name => ({
    async findOne(query, opts) { assert.equal(opts.session, session); return structuredClone(data[name].find(d => matches(d, query)) || null); },
    find(query, opts) { assert.equal(opts.session, session); return { limit(n) { return { async toArray() { return structuredClone(data[name].filter(d => matches(d, query)).slice(0, n)); } }; } }; },
    async updateOne(query, update, opts) { assert.equal(opts.session, session);
      if (name === 'users' && update.$inc?.balance != null && ++creditAttempts === failCreditAt) return { modifiedCount: 0 };
      const doc = data[name].find(d => matches(d, query)); if (!doc) return { modifiedCount: 0 };
      Object.assign(doc, structuredClone(update.$set || {}));
      for (const [k, v] of Object.entries(update.$inc || {})) doc[k] += v;
      for (const [k, v] of Object.entries(update.$push || {})) doc[k].push(structuredClone(v));
      return { modifiedCount: 1 };
    },
    async insertOne(doc, opts) { assert.equal(opts.session, session); if (failReceipt) throw new Error('simulated_insert_failure');
      if (data[name].some(d => d._id === doc._id)) throw new Error('duplicate_key'); data[name].push(structuredClone(doc)); }
  });
  const settle = createSnakeTransactionalSettlement({ client: { startSession: () => session }, matches: collection('matches'), users: collection('users'), receipts: collection('receipts'), assetId: 'test-ledger' });
  return { room, match, settle, data: () => data, calls, ended: () => ended, failCredit: (at = 1) => { failCreditAt = at; }, failReceipt: () => { failReceipt = true; } };
}
test('real SnakeGame finish is converted to account-bound immutable evidence', () => {
  const f = setup(); const result = captureSnakeServerResult(f.room, f.match);
  assert.equal(result.winnerAccountId, 'a'); assert.ok(Object.isFrozen(result));
  assert.equal(result.evidenceId, captureSnakeServerResult(f.room, f.match).evidenceId);
});
test('transaction writes result, exact winner and house credits, unique receipt; retry does not credit twice', async () => {
  const f = setup(); const first = await f.settle('match1', f.room);
  assert.equal(first.duplicate, false); assert.deepEqual(f.data().users.map(u => u.balance), [108, 90, 92]);
  assert.equal(f.data().matches[0].status, 'settled'); assert.ok(f.data().users.slice(0, 2).every(u => u.transactions[0].status === 'settled')); assert.equal(f.data().receipts.length, 1);
  const again = await f.settle('match1', null); assert.equal(again.duplicate, true);
  assert.deepEqual(f.data().users.map(u => u.balance), [108, 90, 92]); assert.ok(f.ended());
  assert.equal(f.calls[0].writeConcern.w, 'majority');
});
for (const mode of ['credit', 'fee-credit', 'receipt']) test(`simulated ${mode} failure rolls back all transaction writes`, async () => {
  const f = setup(); const before = structuredClone(f.data());
  mode === 'receipt' ? f.failReceipt() : f.failCredit(mode === 'fee-credit' ? 2 : 1);
  await assert.rejects(f.settle('match1', f.room)); assert.deepEqual(f.data(), before); assert.ok(f.ended());
});
const invalid = [
 ['wrong game', f => { f.room.gameType = 'poolroyale'; }],
 ['not finished', f => { f.room.game.finished = false; }],
 ['detached player state', f => { f.room.players = structuredClone(f.room.players); }],
 ['winner not reserved', f => { f.room.players[0].playerId = 'outsider'; }],
 ['changed rules', f => { f.room.snakes = { 49: 1 }; }],
 ['two winners', f => { f.room.players[1].position = 50; }],
 ['wrong turn', f => { f.room.game.currentTurn = 1; }],
 ['wrong room', f => { f.room.id = 'other'; }],
 ['missing reservation debit', f => { f.data().users[0].transactions = []; }],
 ['wrong reservation amount', f => { f.data().users[0].transactions[0].amount = -9; }],
 ['duplicate reservation debit', f => { f.data().users[0].transactions.push(structuredClone(f.data().users[0].transactions[0])); }],
 ['ambiguous canonical account', f => { f.data().users.push(structuredClone(f.data().users[0])); }],
 ['fractional balance', f => { f.data().users[0].balance = 90.5; }],
 ['unsafe balance sum', f => { f.data().users[0].balance = Number.MAX_SAFE_INTEGER; }],
 ['missing fee recipient', f => { f.data().users.pop(); }],
 ['orphan credit', f => { f.data().users[0].transactions.push({ transactionId: 'game-settlement:match1:0', amount: 18 }); }],
 ['bad receipt state', f => { f.data().receipts.push({ _id: 'game-settlement:match1', matchId: 'match1', assetId: 'test-ledger' }); }],
];
for (const [name, mutate] of invalid) test(`rejects ${name} with no financial effects`, async () => {
  const f = setup(); mutate(f); const before = structuredClone(f.data());
  await assert.rejects(f.settle('match1', f.room)); assert.deepEqual(f.data(), before); assert.ok(f.ended());
});

test('rejects corrupted committed receipt instead of reporting successful duplicate', async () => {
  const f = setup(); await f.settle('match1', f.room);
  f.data().receipts[0].decision.evidenceId = 'different-result';
  await assert.rejects(f.settle('match1', null), /inconsistent_settlement_receipt/);
});

test('finished room cannot settle a second match with the same room, roster and rules', async () => {
  const f = setup(); const second = structuredClone(f.match);
  second._id = second.matchId = 'match2'; second.reservations.forEach(r => { r.matchId = 'match2'; });
  f.data().matches.push(second);
  await assert.rejects(f.settle('match2', f.room), /not_server_snake_finish/);
  assert.equal(f.data().receipts.length, 0);
});
test('legacy room without reservation-bound match identity fails closed', async () => {
  const f = setup(); delete f.room.settlementMatchId;
  await assert.rejects(f.settle('match1', f.room), /not_server_snake_finish/);
});
