// Real local Mongo transactions only; ephemeral replica set, never external URI.
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { SnakeGame } from '../logic/snakeGame.js';
import { snakeRulesHash } from '../services/settlement/snakeServerResult.js';
import { gameOfferTerms } from '../services/settlement/gameStakeConsent.js';
import { createSnakeReservationProducer, gameFundingFingerprint } from '../services/settlement/snakeReservationProducer.js';
import { createSnakeRoundCoordinator } from '../services/settlement/snakeRoundCoordinator.js';
const board = { snakes: {}, ladders: {}, diceCells: {} };

test('coherent Snake reserve/start/finish/refund real Mongo release gates', async t => {
  let replica; let connection; let serial = 0;
  try {
    replica = await MongoMemoryReplSet.create({ replSet: { count: 1, args: ['--nounixsocket'] } });
    connection = await mongoose.createConnection(replica.getUri(), { dbName: 'snake_coordinator_test' }).asPromise();
    const client = connection.getClient();
    async function fixture(matchId = 'm') {
      const db = client.db(`snake_coordinator_${++serial}`);
      const names = ['offers', 'consents', 'users', 'fundingAudits', 'accountLocks', 'escrowMatches', 'lifecycleMatches', 'journal', 'receipts'];
      for (const name of names) await db.createCollection(name);
      const c = Object.fromEntries(names.map(name => [name, db.collection(name)]));
      const people = ['a', 'b', 'house'].map((id, i) => ({ _id: `u-${id}`, tpcAccountNumber: id, telegramId: i + 1, balance: 100, transactions: [] }));
      await c.users.insertMany(people);
      await c.fundingAudits.insertMany(people.map(user => ({ _id: user.tpcAccountNumber, assetId: 'test-ledger', userId: user._id, status: 'verified', version: 0,
        fingerprint: gameFundingFingerprint(user), availableUnits: '100' })));
      const producer = createSnakeReservationProducer({ ...c, client, assetId: 'test-ledger', verifyCredentials: async credentials => ({ telegramId: Number(credentials.initData), expiresAt: Date.now() + 120000 }) });
      async function reserve(id = matchId) {
        const at = Date.now(); const offer = { _id: id, matchId: id, roomId: 'room', offerId: `o-${serial}`, gameType: 'snake', assetId: 'test-ledger', revision: 0, status: 'offered',
          expiresAt: at + 60000, stakeUnits: '10', accountIds: ['a', 'b'], rulesHash: snakeRulesHash(board), feePolicy: { policyId: 'testfee', units: '2', accountId: 'house' } };
        await c.offers.insertOne(offer); await c.lifecycleMatches.insertOne({ _id: id, matchId: id, offerId: offer.offerId, status: 'offered', version: 0, updatedAt: at, accountIds: ['a', 'b'] });
        for (const identity of [1, 2]) await producer.accept({ matchId: id, presentedTermsHash: gameOfferTerms(offer).termsHash, credentials: { initData: String(identity) } });
        return producer.reserve(id);
      }
      const coordinator = overrides => createSnakeRoundCoordinator({ ...c, client, assetId: 'test-ledger', ...overrides });
      function room(id = matchId) {
        const game = new SnakeGame(board); game.addPlayer('a', 'A'); game.addPlayer('b', 'B'); game.players.forEach(p => { p.playerId = p.id; });
        game.players[0].position = 49; game.rollDice([1]);
        return { id: 'room', settlementMatchId: id, gameType: 'snake', status: 'finished', game, players: game.players, snakes: {}, ladders: {}, initialDiceCells: {} };
      }
      const balances = async () => (await c.users.find().sort({ _id: 1 }).toArray()).map(u => u.balance);
      async function checkAudits() { for (const user of await c.users.find().toArray()) { const audit = await c.fundingAudits.findOne({ _id: user.tpcAccountNumber }); assert.equal(audit.fingerprint, gameFundingFingerprint(user)); assert.equal(audit.availableUnits, String(user.balance)); } }
      await reserve(); return { c, reserve, coordinator: coordinator(), makeCoordinator: coordinator, room, balances, checkAudits, matchId };
    }
    await t.test('reserve→start→concurrent finish conserves funds and permits next round', async () => {
      const f = await fixture(); const started = await f.coordinator.start('m', board); assert.equal(started.duplicate, false);
      assert.equal((await f.coordinator.start('m', board)).duplicate, true);
      const attempts = await Promise.allSettled([f.coordinator.finish('m', f.room()), f.coordinator.finish('m', f.room())]);
      assert.ok(attempts.some(a => a.status === 'fulfilled')); assert.equal((await f.coordinator.finish('m', null)).duplicate, true);
      assert.deepEqual(await f.balances(), [108, 90, 102]); await f.checkAudits();
      assert.equal(await f.c.accountLocks.countDocuments(), 0); assert.equal(await f.c.receipts.countDocuments(), 1);
      assert.equal((await f.c.lifecycleMatches.findOne({ _id: 'm' })).status, 'settled');
      await f.reserve('m2'); assert.deepEqual(await f.balances(), [98, 80, 102]); assert.equal(await f.c.accountLocks.countDocuments(), 2); await f.checkAudits();
    });
    await t.test('duplicate pre-start refund restores balances/audits and releases all locks exactly once', async () => {
      const f = await fixture(); const attempts = await Promise.allSettled([f.coordinator.refundBeforeStart('m'), f.coordinator.refundBeforeStart('m')]);
      assert.ok(attempts.some(a => a.status === 'fulfilled')); assert.equal((await f.coordinator.refundBeforeStart('m')).duplicate, true);
      assert.deepEqual(await f.balances(), [100, 100, 100]); assert.equal(await f.c.accountLocks.countDocuments(), 0); await f.checkAudits();
      await assert.rejects(f.coordinator.start('m', board));
    });
    await t.test('start versus cancellation race cannot both succeed', async () => {
      const f = await fixture(); const result = await Promise.allSettled([f.coordinator.start('m', board), f.coordinator.refundBeforeStart('m')]);
      assert.equal(result.filter(r => r.status === 'fulfilled').length, 1);
      const state = await f.c.lifecycleMatches.findOne({ _id: 'm' });
      if (state.status === 'playing') { assert.deepEqual(await f.balances(), [90, 90, 100]); await f.coordinator.finish('m', f.room()); }
      else { assert.equal(state.status, 'refunded'); assert.deepEqual(await f.balances(), [100, 100, 100]); }
      await f.checkAudits(); assert.equal(await f.c.accountLocks.countDocuments(), 0);
    });
    await t.test('failure at final receipt rolls back credits, audit cursors, locks and lifecycle', async () => {
      const f = await fixture(); await f.coordinator.start('m', board);
      const bad = f.makeCoordinator({ receipts: { findOne: (...args) => f.c.receipts.findOne(...args), insertOne: () => { throw new Error('receipt_failure'); } } });
      await assert.rejects(bad.finish('m', f.room()), /receipt_failure/);
      assert.deepEqual(await f.balances(), [90, 90, 100]); await f.checkAudits();
      assert.equal(await f.c.accountLocks.countDocuments(), 2); assert.equal(await f.c.receipts.countDocuments(), 0);
      assert.equal((await f.c.lifecycleMatches.findOne({ _id: 'm' })).status, 'playing');
      await f.coordinator.finish('m', f.room());
    });
    await t.test('stale provenance fails closed without releasing held funds', async () => {
      const f = await fixture(); await f.coordinator.start('m', board); await f.c.users.updateOne({ _id: 'u-a' }, { $inc: { balance: 1 } });
      await assert.rejects(f.coordinator.finish('m', f.room()), /funding_provenance_required/);
      assert.deepEqual(await f.balances(), [91, 90, 100]); assert.equal(await f.c.accountLocks.countDocuments(), 2); assert.equal(await f.c.receipts.countDocuments(), 0);
    });
    await t.test('missing/wrong round lock rejects settlement', async () => {
      const f = await fixture(); await f.coordinator.start('m', board); await f.c.accountLocks.updateOne({ _id: 'b' }, { $set: { matchId: 'other' } });
      await assert.rejects(f.coordinator.finish('m', f.room()), /round_lock_missing/); assert.deepEqual(await f.balances(), [90, 90, 100]);
    });
    await t.test('post-start refund and cross-round winner are rejected', async () => {
      const f = await fixture(); await f.coordinator.start('m', board);
      await assert.rejects(f.coordinator.refundBeforeStart('m'), /round_lifecycle_mismatch/);
      await assert.rejects(f.coordinator.finish('m', f.room('other')), /not_server_snake_finish/);
      assert.deepEqual(await f.balances(), [90, 90, 100]);
    });
    for (const mutation of ['participant-ban', 'participant-audit-revoke', 'participant-ledger-change', 'lock-deletion', 'house-audit-revoke']) {
      await t.test(`start write fence rejects concurrent ${mutation} after validation`, async () => {
        const f = await fixture(); let injected = false;
        const guardedUsers = {
          find: (...args) => f.c.users.find(...args),
          updateOne: async (...args) => {
            if (!injected) {
              injected = true;
              if (mutation === 'participant-ban') await f.c.users.updateOne({ _id: 'u-a' }, { $set: { isBanned: true } });
              if (mutation === 'participant-audit-revoke') await f.c.fundingAudits.updateOne({ _id: 'a' }, { $set: { status: 'revoked' } });
              if (mutation === 'participant-ledger-change') await f.c.users.updateOne({ _id: 'u-a' }, { $inc: { balance: 1 } });
              if (mutation === 'lock-deletion') await f.c.accountLocks.deleteOne({ _id: 'a' });
              if (mutation === 'house-audit-revoke') await f.c.fundingAudits.updateOne({ _id: 'house' }, { $set: { status: 'revoked' } });
            }
            return f.c.users.updateOne(...args);
          }
        };
        await assert.rejects(f.makeCoordinator({ users: guardedUsers }).start('m', board));
        assert.ok(injected); assert.equal((await f.c.lifecycleMatches.findOne({ _id: 'm' })).status, 'reserved');
        assert.equal((await f.c.escrowMatches.findOne({ _id: 'm' })).startedAt, null);
        assert.deepEqual(await f.balances(), mutation === 'participant-ledger-change' ? [91, 90, 100] : [90, 90, 100]);
      });
    }
    await t.test('maximum round ID supports pre-start refund and bounded journal references', async () => {
      const id = 'x'.repeat(160); const f = await fixture(id); await f.coordinator.refundBeforeStart(id);
      assert.deepEqual(await f.balances(), [100, 100, 100]); await f.checkAudits();
    });
  } finally { await connection?.close(); await replica?.stop(); }
});
