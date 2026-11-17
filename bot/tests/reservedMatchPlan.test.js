import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReservedMatchSettlementPlan as plan } from '../services/settlement/reservedMatchPlan.js';
function fixture(gameType = 'snake') {
  return [{ matchId: 'match-1', assetId: 'test-ledger:tpg:v1', gameType, status: 'reserved',
    startedAt: '2026-11-17T12:00:00.000Z', feePolicy: { policyId: 'test-only', units: '3', accountId: 'house' },
    reservations: ['a', 'b'].map(accountId => ({ accountId, receiptId: `reserve-${accountId}`,
      matchId: 'match-1', assetId: 'test-ledger:tpg:v1', status: 'held', units: '10' })) },
    { matchId: 'match-1', gameType, decisionId: 'decision-1', evidenceId: 'server-result-1', kind: 'winner', winnerAccountId: 'a' }];
}
for (const game of ['snake', 'poolroyale']) test(`${game}: conserved prize and explicit fee`, () => {
  const [s, d] = fixture(game); const p = plan(s, d);
  assert.deepEqual(p.transfers, [{ accountId: 'a', units: '17', kind: 'prize' }, { accountId: 'house', units: '3', kind: 'fee' }]);
  assert.equal(p.totalUnits, '20'); assert.ok(Object.isFrozen(p.transfers[0]));
});
test('cancellation refunds exact held amounts with no fee; uses same settlement key', () => {
  const [s, d] = fixture(); const key = plan(s, d).settlementKey;
  s.startedAt = null; delete s.feePolicy; d.kind = 'cancel_before_start';
  const p = plan(s, d); assert.equal(p.settlementKey, key);
  assert.deepEqual(p.transfers.map(t => t.units), ['10', '10']);
  assert.ok(p.transfers.every(t => t.kind === 'refund'));
});
test('large amounts remain exact beyond Number precision', () => {
  const [s, d] = fixture(); s.reservations.forEach(r => { r.units = '9999999999999999999'; });
  assert.equal(plan(s, d).totalUnits, '19999999999999999998');
});
test('input ordering is deterministic and does not mutate records', () => {
  const [s, d] = fixture(); const copy = structuredClone(s); const first = plan(s, d);
  assert.deepEqual(s, copy); s.reservations.reverse(); assert.deepEqual(plan(s, d), first);
});
const failures = [
 ['client numeric units', (s) => { s.reservations[0].units = 10; }],
 ['fractional', (s) => { s.reservations[0].units = '1.5'; }],
 ['negative', (s) => { s.reservations[0].units = '-1'; }],
 ['zero', (s) => { s.reservations[0].units = '0'; }],
 ['exponent', (s) => { s.reservations[0].units = '1e3'; }],
 ['overflow', (s) => { s.reservations[0].units = (1n << 120n).toString(); }],
 ['duplicate account', (s) => { s.reservations[1].accountId = 'a'; }],
 ['duplicate receipt', (s) => { s.reservations[1].receiptId = 'reserve-a'; }],
 ['unheld reservation', (s) => { s.reservations[0].status = 'refunded'; }],
 ['other match reservation', (s) => { s.reservations[0].matchId = 'other'; }],
 ['other asset', (s) => { s.reservations[0].assetId = 'ton:mainnet'; }],
 ['unequal stakes', (s) => { s.reservations[0].units = '11'; }],
 ['unfunded winner', (_, d) => { d.winnerAccountId = 'outsider'; }],
 ['different decision game', (_, d) => { d.gameType = 'poolroyale'; }],
 ['different decision match', (_, d) => { d.matchId = 'other'; }],
 ['no adjudication', (_, d) => { delete d.evidenceId; }],
 ['no fee policy', (s) => { delete s.feePolicy; }],
 ['excessive fee', (s) => { s.feePolicy.units = '20'; }],
 ['fee paid to player', (s) => { s.feePolicy.accountId = 'a'; }],
 ['already settled', (s) => { s.status = 'settled'; }],
 ['win before start', (s) => { s.startedAt = null; }],
 ['cancel after start', (_, d) => { d.kind = 'cancel_before_start'; }],
 ['unknown outcome', (_, d) => { d.kind = 'client_claim'; }],
 ['unsupported game', (s, d) => { s.gameType = d.gameType = 'chess'; }],
 ['ambiguous cancellation start', (s, d) => { delete s.startedAt; d.kind = 'cancel_before_start'; }],
];
for (const [name, mutate] of failures) test(`rejects ${name}`, () => {
  const [s, d] = fixture(); mutate(s, d); assert.throws(() => plan(s, d));
});

test('explicit zero fee credits the full pot without fee recipient', () => {
  const [s, d] = fixture(); s.feePolicy = { policyId: 'free-of-fee', units: '0' };
  assert.deepEqual(plan(s, d).transfers, [{ accountId: 'a', units: '20', kind: 'prize' }]);
});
test('aggregate overflow is rejected even if each reservation is in bounds', () => {
  const [s, d] = fixture(); s.reservations.forEach(r => { r.units = ((1n << 120n) - 1n).toString(); });
  assert.throws(() => plan(s, d), /total_out_of_range/);
});
for (const kind of ['sparse', 'fully-sparse', 'null', 'empty', 'one', 'too-many']) test(`rejects ${kind} reservation roster`, () => {
  const [s, d] = fixture();
  if (kind === 'sparse') delete s.reservations[1];
  if (kind === 'fully-sparse') { s.reservations = Array(2); s.startedAt = null; d.kind = 'cancel_before_start'; }
  if (kind === 'null') s.reservations[1] = null;
  if (kind === 'empty') s.reservations = [];
  if (kind === 'one') s.reservations.pop();
  if (kind === 'too-many') s.reservations = Array(5).fill(s.reservations[0]);
  assert.throws(() => plan(s, d));
});
test('Pool rejects a third seat while Snake permits four fully held seats', () => {
  const [s, d] = fixture();
  for (const accountId of ['c', 'd']) s.reservations.push({ ...s.reservations[0], accountId, receiptId: `reserve-${accountId}` });
  assert.equal(plan(s, d).totalUnits, '40');
  s.gameType = d.gameType = 'poolroyale';
  assert.throws(() => plan(s, d), /invalid_roster/);
});
