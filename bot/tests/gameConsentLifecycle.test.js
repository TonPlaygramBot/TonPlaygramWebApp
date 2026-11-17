import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { verifySocialCredentials } from '../middleware/socialAuth.js';
import { gameOfferTerms, buildVerifiedStakeConsent, requireCurrentConsents } from '../services/settlement/gameStakeConsent.js';
import { nextGameLifecycle, createGameLifecycleJournal } from '../services/settlement/gameLifecycle.js';

const NOW = 1800000000000; const TEST_TOKEN = 'test-only-not-a-real-bot-token';
function signed(id, token = TEST_TOKEN) {
  const params = new URLSearchParams({ auth_date: String(NOW / 1000 - 10), user: JSON.stringify({ id }) });
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const data = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n');
  params.set('hash', createHmac('sha256', secret).update(data).digest('hex')); return params.toString();
}
function fixture() {
  const offer = { matchId: 'm', roomId: 'room', offerId: 'o', assetId: 'test-ledger', gameType: 'snake', status: 'offered', revision: 0,
    expiresAt: NOW + 60000, stakeUnits: '10', accountIds: ['a', 'b'], rulesHash: 'a'.repeat(64), feePolicy: { policyId: 'fee1', units: '2', accountId: 'house' } };
  const rows = [{ _id: 'ua', telegramId: 1, tpcAccountNumber: 'a' }, { _id: 'ub', telegramId: 2, tpcAccountNumber: 'b' }];
  let clock = NOW;
  const deps = { now: () => clock, verifyCredentials: credentials => verifySocialCredentials(credentials, { now: clock, botToken: TEST_TOKEN, maxAgeSeconds: 3600 }),
    users: { find(query) { return { limit(n) { return { async toArray() { return rows.filter(row => Object.entries(query).every(([k, v]) => row[k] === v)).slice(0, n); } }; } }; } } };
  const consent = id => buildVerifiedStakeConsent({ offer, presentedTermsHash: gameOfferTerms(offer).termsHash, credentials: { initData: signed(id) } }, deps);
  return { offer, rows, deps, consent, setClock: value => { clock = value; } };
}
test('real HMAC verification produces canonical receipt with no credentials stored', async () => {
  const f = fixture(); const receipt = await f.consent(1);
  assert.equal(receipt.accountId, 'a'); assert.equal(receipt.userId, 'ua'); assert.ok(Object.isFrozen(receipt));
  assert.equal(receipt.expiresAt, f.offer.expiresAt); assert.equal(JSON.stringify(receipt).includes(TEST_TOKEN), false);
  assert.equal(requireCurrentConsents(f.offer, [receipt, await f.consent(2)], NOW), gameOfferTerms(f.offer).termsHash);
});
test('unsigned account claims cannot substitute for signed proof', async () => {
  const f = fixture(); await assert.rejects(buildVerifiedStakeConsent({ offer: f.offer, presentedTermsHash: gameOfferTerms(f.offer).termsHash,
    credentials: { accountId: 'a', telegramId: 1, socialVerified: true } }, f.deps));
});
test('forged Telegram signature fails before account lookup', async () => {
  const f = fixture(); f.deps.users.find = () => { throw new Error('unexpected_lookup'); };
  await assert.rejects(buildVerifiedStakeConsent({ offer: f.offer, presentedTermsHash: gameOfferTerms(f.offer).termsHash,
    credentials: { initData: signed(1, 'attacker') } }, f.deps), e => e.message !== 'unexpected_lookup');
});
for (const [name, change] of [
 ['banned', f => { f.rows[0].isBanned = true; }],
 ['missing canonical', f => { delete f.rows[0].tpcAccountNumber; }],
 ['duplicate provider identity', f => { f.rows.push({ ...f.rows[0], _id: 'other' }); }],
 ['duplicate canonical identity', f => { f.rows.push({ _id: 'other', telegramId: 3, tpcAccountNumber: 'a' }); }],
 ['not invited', f => { f.offer.accountIds = ['c', 'd']; }],
 ['offer expired', f => { f.setClock(NOW + 60000); }],
 ['credentials expired', f => { f.setClock(NOW + 3600000); }],
 ['cancelled offer', f => { f.offer.status = 'cancelled'; }],
]) test(`rejects ${name}`, async () => { const f = fixture(); change(f); await assert.rejects(f.consent(1)); });
for (const key of ['stakeUnits', 'assetId', 'rulesHash', 'revision', 'expiresAt']) test(`changed ${key} invalidates consent`, async () => {
  const f = fixture(); const receipts = [await f.consent(1), await f.consent(2)];
  f.offer[key] = typeof f.offer[key] === 'number' ? f.offer[key] + 1 : key === 'stakeUnits' ? '11' : key === 'rulesHash' ? 'b'.repeat(64) : 'other';
  assert.throws(() => requireCurrentConsents(f.offer, receipts, NOW));
});
test('changed fee, duplicate receipts, sparse receipts and stale credentials fail', async () => {
  const f = fixture(); const a = await f.consent(1); const b = await f.consent(2);
  assert.throws(() => requireCurrentConsents(f.offer, [a, a], NOW));
  assert.throws(() => requireCurrentConsents(f.offer, Array(2), NOW));
  assert.throws(() => requireCurrentConsents(f.offer, [a, { ...b, expiresAt: NOW }], NOW));
  f.offer.feePolicy.units = '3'; assert.throws(() => requireCurrentConsents(f.offer, [a, b], NOW));
});
test('wrong terms hash cannot authorize stake acceptance', async () => {
  const f = fixture(); await assert.rejects(buildVerifiedStakeConsent({ offer: f.offer, presentedTermsHash: 'wrong', credentials: { initData: signed(1) } }, f.deps), /offer_changed/);
});
test('sparse offered roster fails validation', () => { const f = fixture(); delete f.offer.accountIds[1]; assert.throws(() => gameOfferTerms(f.offer)); });

function state(status = 'created') { return { _id: 'm', matchId: 'm', version: 0, status, updatedAt: NOW, accountIds: ['a', 'b'] }; }
function event(kind, extra = {}) { return { matchId: 'm', eventId: 'e', expectedVersion: 0, at: NOW, kind, ...extra }; }
test('lifecycle follows durable reserve/start/result/settlement references', () => {
  let s = state();
  for (const [kind, referenceId] of [['offer', 'o'], ['reservation_committed', 'r'], ['start', null], ['server_finish', 'result'], ['settlement_committed', 'settlement']]) {
    s = nextGameLifecycle(s, event(kind, { expectedVersion: s.version, referenceId }));
  }
  assert.equal(s.status, 'settled'); assert.equal(s.version, 5); assert.equal(s.startedAt, NOW);
});
for (const [before, after] of [['offered', 'cancelled'], ['reserved', 'refund_pending'], ['playing', 'disputed'], ['finished', 'disputed']]) test(`cancel ${before} becomes ${after}, never silently releases money`, () => {
  assert.equal(nextGameLifecycle(state(before), event('cancel')).status, after);
});
for (const kind of ['disconnect', 'reconnect']) test(`${kind} retains funded match identity and state`, () => {
  const s = nextGameLifecycle(state('playing'), event(kind, { accountId: 'a' }));
  assert.equal(s.status, 'playing'); assert.equal(s.matchId, 'm'); assert.equal(s.version, 1);
});
for (const [name, s, e] of [
 ['client win before start', state('offered'), event('server_finish', { referenceId: 'x' })],
 ['direct settlement from playing', state('playing'), event('settlement_committed', { referenceId: 'x' })],
 ['refund without pending', state('playing'), event('refund_committed', { referenceId: 'x' })],
 ['duplicate stale version', state('offered'), event('start', { expectedVersion: 2 })],
 ['terminal restart', state('settled'), event('start')],
 ['different match', state(), event('offer', { matchId: 'other', referenceId: 'o' })],
 ['backdated event', state(), event('offer', { at: NOW - 1, referenceId: 'o' })],
 ['nonparticipant reconnect', state('playing'), event('reconnect', { accountId: 'outsider' })],
]) test(`lifecycle rejects ${name}`, () => assert.throws(() => nextGameLifecycle(s, e)));

test('journal adapter persists state/event atomically, retries exact event, rejects reused ID', async () => {
  let current = state(); let entries = []; let fail = false; let ended = 0;
  const session = { async withTransaction(fn) { const old = structuredClone([current, entries]); try { await fn(); } catch (e) { [current, entries] = old; throw e; } }, async endSession() { ended++; } };
  const journal = { async findOne(q, options) { assert.equal(options.session, session); return entries.find(x => x._id === q._id); }, async insertOne(doc, options) { assert.equal(options.session, session); if (fail) throw new Error('journal_failure'); entries.push(structuredClone(doc)); } };
  const matches = { async findOne(q, options) { assert.equal(options.session, session); return structuredClone(current); },
    async updateOne(q, update, options) { assert.equal(options.session, session); if (!Object.entries(q).every(([k, v]) => isDeepStrictEqual(current[k], v))) return { modifiedCount: 0 }; current = { ...current, ...structuredClone(update.$set) }; return { modifiedCount: 1 }; } };
  const append = createGameLifecycleJournal({ client: { startSession: () => session }, lifecycleMatches: matches, journal });
  const command = event('offer', { referenceId: 'o' }); fail = true;
  await assert.rejects(append(command), /journal_failure/); assert.equal(current.status, 'created'); assert.equal(entries.length, 0);
  fail = false; assert.equal((await append(command)).duplicate, false); assert.equal(current.status, 'offered');
  assert.equal((await append(command)).duplicate, true); assert.equal(entries.length, 1);
  await assert.rejects(append({ ...command, referenceId: 'other' }), /lifecycle_idempotency_conflict/); assert.equal(ended, 4);
});

test('repeated pending-refund cancellation does not create a second refund or restart', () => {
  const s = nextGameLifecycle(state('refund_pending'), event('cancel'));
  assert.equal(s.status, 'refund_pending');
});
test('identity revoked during canonical lookup cannot produce a consent receipt', async () => {
  const f = fixture(); const original = f.deps.users.find.bind(f.deps.users);
  f.deps.users.find = query => { if (query.tpcAccountNumber) f.rows[0].isBanned = true; return original(query); };
  await assert.rejects(f.consent(1), /identity_changed/);
});
test('the offer pot must fit the legacy exact integer ledger', () => {
  const f = fixture(); f.offer.stakeUnits = String(Number.MAX_SAFE_INTEGER);
  assert.throws(() => gameOfferTerms(f.offer), /offer_pot_unsafe/);
});

test('reserved cancellation, repeated cancellation and committed refund remain legal', () => {
  let s = nextGameLifecycle(state('reserved'), event('cancel'));
  s = nextGameLifecycle(s, event('cancel', { eventId: 'second-cancel', expectedVersion: 1 }));
  s = nextGameLifecycle(s, event('refund_committed', { eventId: 'refund', expectedVersion: 2, referenceId: 'refund-receipt' }));
  assert.equal(s.status, 'refunded'); assert.equal(s.refundId, 'refund-receipt');
});
