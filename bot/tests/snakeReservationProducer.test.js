import test from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { createSnakeReservationProducer, gameFundingFingerprint } from '../services/settlement/snakeReservationProducer.js';
import { gameOfferTerms } from '../services/settlement/gameStakeConsent.js';
const NOW = 1800000000000;
function fixture() {
  const offer = { _id: 'm', matchId: 'm', roomId: 'room', offerId: 'o', gameType: 'snake', assetId: 'test-ledger', revision: 0, status: 'offered',
    expiresAt: NOW + 60000, stakeUnits: '10', accountIds: ['a', 'b'], rulesHash: 'a'.repeat(64), feePolicy: { policyId: 'testfee', units: '2', accountId: 'house' } };
  const people = ['a', 'b', 'house'].map((id, i) => ({ _id: `u-${id}`, tpcAccountNumber: id, telegramId: i + 1, balance: 100, transactions: [] }));
  let data = { offers: [offer], consents: [], users: people,
    fundingAudits: people.slice(0, 2).map(user => ({ _id: user.tpcAccountNumber, assetId: 'test-ledger', userId: user._id, status: 'verified', version: 0,
      fingerprint: gameFundingFingerprint(user), availableUnits: '100' })),
    accountLocks: [], escrowMatches: [], lifecycleMatches: [{ _id: 'm', matchId: 'm', offerId: 'o', status: 'offered', version: 0, updatedAt: NOW, accountIds: ['a', 'b'] }], journal: [] };
  let clock = NOW; let clockSequence = []; let fail = null; let operationCount = 0; let closes = 0;
  const session = { async withTransaction(fn) { const before = structuredClone(data); try { await fn(); } catch (e) { data = before; throw e; } }, async endSession() { closes++; } };
  const match = (doc, query) => Object.entries(query).every(([k, v]) => v && typeof v === 'object' && '$ne' in v ? !isDeepStrictEqual(doc[k], v.$ne) : isDeepStrictEqual(doc[k], v));
  const check = (name, op, options) => { assert.equal(options.session, session); if (fail?.name === name && fail?.op === op && ++operationCount === (fail.at || 1)) throw new Error('simulated_write_failure'); };
  const collection = name => ({
    async findOne(q, options) { check(name, 'findOne', options); return structuredClone(data[name].find(d => match(d, q)) || null); },
    find(q, options) { check(name, 'find', options); let limit = Infinity; const cursor = { limit(n) { limit = n; return cursor; }, async toArray() { return structuredClone(data[name].filter(d => match(d, q)).slice(0, limit)); } }; return cursor; },
    async insertOne(doc, options) { check(name, 'insertOne', options); if (data[name].some(d => d._id === doc._id)) throw new Error('duplicate_key'); data[name].push(structuredClone(doc)); },
    async replaceOne(q, doc, options) { check(name, 'replaceOne', options); const index = data[name].findIndex(d => match(d, q)); if (index < 0) { assert.equal(options.upsert, true); data[name].push(structuredClone(doc)); } else data[name][index] = structuredClone(doc); return { modifiedCount: 1 }; },
    async updateOne(q, update, options) { check(name, 'updateOne', options); const doc = data[name].find(d => match(d, q)); if (!doc) return { modifiedCount: 0 };
      Object.assign(doc, structuredClone(update.$set || {})); for (const [k, v] of Object.entries(update.$inc || {})) doc[k] = (doc[k] || 0) + v;
      for (const [k, v] of Object.entries(update.$push || {})) doc[k].push(structuredClone(v)); return { modifiedCount: 1 }; }
  });
  const producer = createSnakeReservationProducer({ client: { startSession: () => session },
    ...Object.fromEntries(Object.keys(data).map(name => [name, collection(name)])), assetId: 'test-ledger', now: () => clockSequence.length ? clockSequence.shift() : clock,
    // Auth verification is covered with real signed HMAC in gameConsentLifecycle.test.js.
    verifyCredentials: async credentials => { const id = Number(credentials.initData); if (![1, 2].includes(id)) throw new Error('signed_identity_required'); return { telegramId: id, expiresAt: NOW + 120000 }; }
  });
  const accept = (id, matchId = 'm') => producer.accept({ matchId, presentedTermsHash: gameOfferTerms(data.offers[0]).termsHash, credentials: { initData: String(id) } });
  return { producer, accept, data: () => data, setClock: v => { clock = v; }, setClockSequence: v => { clockSequence = v; }, setFailure: value => { fail = value; operationCount = 0; }, closes: () => closes };
}
async function prepared() { const f = fixture(); await f.accept(1); await f.accept(2); return f; }
test('accept persists only signed canonical receipt and conflicts with changed offer', async () => {
  const f = fixture(); const receipt = await f.accept(1);
  assert.deepEqual(receipt.identity, { telegramId: 1 }); assert.equal(f.data().consents.length, 1);
  assert.equal(JSON.stringify(f.data().consents).includes('initData'), false); assert.equal(f.data().offers[0].consentRevision, 1);
  f.data().offers[0].stakeUnits = '11'; await assert.rejects(f.accept(1), /consent_conflict/);
});
test('reserve debits all participants, advances audits, acquires locks and writes escrow+lifecycle+journal in one boundary', async () => {
  const f = await prepared(); const result = await f.producer.reserve('m');
  assert.equal(result.duplicate, false); assert.deepEqual(f.data().users.map(u => u.balance), [90, 90, 100]);
  assert.equal(f.data().accountLocks.length, 2); assert.equal(f.data().escrowMatches.length, 1);
  assert.equal(f.data().offers[0].status, 'reserved'); assert.equal(f.data().lifecycleMatches[0].status, 'reserved'); assert.equal(f.data().journal.length, 1);
  assert.equal(result.match.startedAt, null); assert.equal(result.match.reservations.length, 2);
  for (const user of f.data().users.slice(0, 2)) { const audit = f.data().fundingAudits.find(a => a._id === user.tpcAccountNumber); assert.equal(audit.availableUnits, '90'); assert.equal(audit.fingerprint, gameFundingFingerprint(user)); }
  const before = structuredClone(f.data()); assert.equal((await f.producer.reserve('m')).duplicate, true); assert.deepEqual(f.data(), before);
});
for (const failure of [
 { name: 'accountLocks', op: 'insertOne', at: 2 }, { name: 'users', op: 'updateOne', at: 2 },
 { name: 'fundingAudits', op: 'updateOne', at: 2 }, { name: 'escrowMatches', op: 'insertOne' },
 { name: 'offers', op: 'updateOne' }, { name: 'lifecycleMatches', op: 'updateOne' }, { name: 'journal', op: 'insertOne' }
]) test(`rollback simulated ${failure.name} write failure including prior debits`, async () => {
  const f = await prepared(); const before = structuredClone(f.data()); f.setFailure(failure);
  await assert.rejects(f.producer.reserve('m'), /simulated_write_failure/); assert.deepEqual(f.data(), before);
});
const rejected = [
 ['missing consent', f => { f.data().consents.pop(); }],
 ['expired consent', f => { f.setClock(NOW + 60000); }],
 ['banned account', f => { f.data().users[0].isBanned = true; }],
 ['provider unlinked', f => { f.data().users[0].telegramId = 99; }],
 ['canonical user changed', f => { f.data().users[0]._id = 'replacement'; }],
 ['duplicate canonical account', f => { f.data().users.push({ ...f.data().users[0], _id: 'duplicate' }); }],
 ['missing provenance audit', f => { f.data().fundingAudits = []; }],
 ['unverified provenance', f => { f.data().fundingAudits[0].status = 'pending'; }],
 ['other asset provenance', f => { f.data().fundingAudits[0].assetId = 'mainnet'; }],
 ['stale balance fingerprint', f => { f.data().users[0].balance = 101; }],
 ['stale ledger fingerprint', f => { f.data().users[0].transactions.push({ amount: 1 }); }],
 ['insufficient balance', f => { f.data().users[0].balance = 1; }],
 ['fractional balance', f => { f.data().users[0].balance = 100.5; }],
 ['existing active account lock', f => { f.data().accountLocks.push({ _id: 'a', matchId: 'different' }); }],
 ['missing fee account', f => { f.data().users.pop(); }],
 ['banned fee account', f => { f.data().users[2].isBanned = true; }],
 ['changed fee consent', f => { f.data().offers[0].feePolicy.units = '3'; }],
 ['cancelled lifecycle', f => { f.data().lifecycleMatches[0].status = 'cancelled'; }],
 ['different lifecycle roster', f => { f.data().lifecycleMatches[0].accountIds = ['a', 'c']; }],
 ['Pool unsupported', f => { f.data().offers[0].gameType = 'poolroyale'; }],
];
for (const [name, change] of rejected) test(`reject ${name} without debit`, async () => {
  const f = await prepared(); change(f); const before = structuredClone(f.data());
  await assert.rejects(f.producer.reserve('m')); assert.deepEqual(f.data(), before);
});
test('failed consent storage rolls back offer write', async () => {
  const f = fixture(); const before = structuredClone(f.data()); f.setFailure({ name: 'consents', op: 'replaceOne' });
  await assert.rejects(f.accept(1)); assert.deepEqual(f.data(), before);
});
test('query object cannot select another match', async () => {
  const f = fixture(); await assert.rejects(f.producer.reserve({ $ne: null }), /invalid_match/);
  await assert.rejects(f.producer.accept({ matchId: { $ne: null } }), /invalid_match/); assert.equal(f.closes(), 0);
});
test('reservation retry cannot restart an already advanced game', async () => {
  const f = await prepared(); await f.producer.reserve('m'); f.data().escrowMatches[0].startedAt = '2026-11-17T12:00:00Z';
  await assert.rejects(f.producer.reserve('m'), /reservation_already_advanced_or_conflicting/);
});

test('consent expiring during transaction rolls back completed tentative debits', async () => {
  const f = await prepared(); const before = structuredClone(f.data()); f.setClockSequence([NOW, NOW + 60000]);
  await assert.rejects(f.producer.reserve('m'), /offer_expired/); assert.deepEqual(f.data(), before);
});

test('fresh signed acceptance can renew older revision; all seats must renew before reserve', async () => {
  const f = await prepared(); f.data().offers[0].revision = 1; f.data().offers[0].stakeUnits = '11';
  await f.accept(1); await assert.rejects(f.producer.reserve('m'), /consent_not_current/);
  await f.accept(2); const result = await f.producer.reserve('m');
  assert.equal(result.match.reservations[0].units, '11'); assert.deepEqual(f.data().users.map(u => u.balance), [89, 89, 100]);
});
test('maximum valid round ID produces bounded lifecycle event ID and reserves safely', async () => {
  const f = fixture(); const long = 'm'.repeat(160);
  f.data().offers[0]._id = f.data().offers[0].matchId = long;
  f.data().lifecycleMatches[0]._id = f.data().lifecycleMatches[0].matchId = long;
  await f.accept(1, long); await f.accept(2, long); const result = await f.producer.reserve(long);
  assert.equal(result.match.matchId, long); assert.ok(f.data().journal[0].command.eventId.length <= 160);
});
