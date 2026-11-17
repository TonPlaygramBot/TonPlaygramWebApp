// Isolated ephemeral replica set only. Never uses an external database URI.
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createSnakeReservationProducer, gameFundingFingerprint } from '../services/settlement/snakeReservationProducer.js';
import { gameOfferTerms } from '../services/settlement/gameStakeConsent.js';

test('real Mongo reserve rollback and competing same-round requests conserve funds', async () => {
  let replica; let connection;
  try {
    replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    connection = await mongoose.createConnection(replica.getUri(), { dbName: 'isolated_reserve_test' }).asPromise();
    const names = ['offers', 'consents', 'users', 'fundingAudits', 'accountLocks', 'escrowMatches', 'lifecycleMatches', 'journal'];
    const db = connection.db; for (const name of names) await db.createCollection(name);
    const collections = Object.fromEntries(names.map(name => [name, db.collection(name)]));
    const at = Date.now();
    const offer = { _id: 'm', matchId: 'm', roomId: 'room', offerId: 'o', gameType: 'snake', assetId: 'test-ledger', revision: 0, status: 'offered',
      expiresAt: at + 60000, stakeUnits: '10', accountIds: ['a', 'b'], rulesHash: 'a'.repeat(64), feePolicy: { policyId: 'testfee', units: '2', accountId: 'house' } };
    const people = ['a', 'b', 'house'].map((id, i) => ({ _id: `u-${id}`, tpcAccountNumber: id, telegramId: i + 1, balance: 100, transactions: [] }));
    await collections.offers.insertOne(offer); await collections.users.insertMany(people);
    await collections.fundingAudits.insertMany(people.slice(0, 2).map(user => ({ _id: user.tpcAccountNumber, assetId: 'test-ledger', userId: user._id, status: 'verified', version: 0,
      fingerprint: gameFundingFingerprint(user), availableUnits: '100' })));
    await collections.lifecycleMatches.insertOne({ _id: 'm', matchId: 'm', offerId: 'o', status: 'offered', version: 0, updatedAt: at, accountIds: ['a', 'b'] });
    let failJournal = true;
    const producer = createSnakeReservationProducer({ ...collections, client: connection.getClient(), assetId: 'test-ledger',
      journal: { insertOne: (...args) => { if (failJournal) throw new Error('injected_final_write_failure'); return collections.journal.insertOne(...args); } },
      verifyCredentials: async credentials => ({ telegramId: Number(credentials.initData), expiresAt: at + 120000 }) });
    for (const id of [1, 2]) await producer.accept({ matchId: 'm', presentedTermsHash: gameOfferTerms(offer).termsHash, credentials: { initData: String(id) } });
    await assert.rejects(producer.reserve('m'), /injected_final_write_failure/);
    assert.equal((await collections.users.findOne({ _id: 'u-a' })).balance, 100);
    assert.equal((await collections.fundingAudits.findOne({ _id: 'a' })).availableUnits, '100');
    assert.equal(await collections.accountLocks.countDocuments(), 0); assert.equal(await collections.escrowMatches.countDocuments(), 0);
    assert.equal((await collections.offers.findOne({ _id: 'm' })).status, 'offered');
    failJournal = false;
    const attempts = await Promise.allSettled([producer.reserve('m'), producer.reserve('m')]);
    assert.ok(attempts.some(r => r.status === 'fulfilled'));
    assert.equal((await producer.reserve('m')).duplicate, true);
    assert.equal((await collections.users.findOne({ _id: 'u-a' })).balance, 90);
    assert.equal((await collections.users.findOne({ _id: 'u-b' })).balance, 90);
    assert.equal(await collections.accountLocks.countDocuments(), 2); assert.equal(await collections.escrowMatches.countDocuments(), 1);
    assert.equal(await collections.journal.countDocuments(), 1);
  } finally { await connection?.close(); await replica?.stop(); }
});
