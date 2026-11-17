import { createHmac } from 'node:crypto';
import { verifySocialCredentials } from '../middleware/socialAuth.js';
import { createSnakeMoveJournal } from '../services/settlement/snakeMoveJournal.js';
// Real local Mongo transactions only; ephemeral replica set, never external URI.
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { SnakeGame } from '../logic/snakeGame.js';
import { snakeJournalRulesHash } from '../services/settlement/snakeDurableRules.js';
const snakeRulesHash = board => snakeJournalRulesHash('snake-server-single-die-v1', board);
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
      const names = ['offers', 'consents', 'users', 'fundingAudits', 'accountLocks', 'escrowMatches', 'lifecycleMatches', 'journal', 'receipts', 'gameStates', 'gameMoves'];
      for (const name of names) await db.createCollection(name);
      const c = Object.fromEntries(names.map(name => [name, db.collection(name)]));
      await c.gameMoves.createIndex({ matchId: 1, sequence: 1 }, { unique: true });
      const people = ['a', 'b', 'house'].map((id, i) => ({ _id: `u-${id}`, tpcAccountNumber: id, telegramId: i + 1, balance: 100, transactions: [] }));
      await c.users.insertMany(people);
      await c.fundingAudits.insertMany(people.map(user => ({ _id: user.tpcAccountNumber, assetId: 'test-ledger', userId: user._id, status: 'verified', version: 0,
        fingerprint: gameFundingFingerprint(user), availableUnits: '100' })));
      const producer = createSnakeReservationProducer({ ...c, client, assetId: 'test-ledger', verifyCredentials: async credentials => ({ telegramId: Number(credentials.initData), expiresAt: Date.now() + 120000 }) });
      async function reserve(id = matchId) {
        const at = Date.now(); const offer = { _id: id, matchId: id, roomId: 'room', offerId: `o-${serial}`, gameType: 'snake', rulesVersion: 'snake-server-single-die-v1', turnOrder: ['a', 'b'], assetId: 'test-ledger', revision: 0, status: 'offered',
          expiresAt: at + 60000, stakeUnits: '10', accountIds: ['a', 'b'], rulesHash: snakeRulesHash(board), feePolicy: { policyId: 'testfee', units: '2', accountId: 'house' } };
        await c.offers.insertOne(offer); await c.lifecycleMatches.insertOne({ _id: id, matchId: id, offerId: offer.offerId, status: 'offered', version: 0, updatedAt: at, accountIds: ['a', 'b'] });
        for (const identity of [1, 2]) await producer.accept({ matchId: id, presentedTermsHash: gameOfferTerms(offer).termsHash, credentials: { initData: String(identity) } });
        return producer.reserve(id);
      }
      let moveClock = Date.now();
      const moveOptions = { ...c, client, now: () => (moveClock += 1000), rollDie: (() => { let n = 0; return () => (++n % 10 === 0 ? 1 : 6); })(), verifyCredentials: async credentials => ({ telegramId: Number(credentials.initData), expiresAt: Date.now() + 120000 }) };
      const moves = createSnakeMoveJournal(moveOptions);
      const makeMoves = overrides => createSnakeMoveJournal({ ...moveOptions, ...overrides });
      async function playToWin(id = matchId) { for (let version = 0; version < 10; version++) await moves.roll({ matchId: id, requestId: `roll-${version}`, expectedVersion: version, credentials: { initData: '1' } }); }
      const coordinator = overrides => createSnakeRoundCoordinator({ ...c, client, assetId: 'test-ledger', ...overrides });
      function room(id = matchId) {
        const game = new SnakeGame(board); game.addPlayer('a', 'A'); game.addPlayer('b', 'B'); game.players.forEach(p => { p.playerId = p.id; });
        game.players[0].position = 49; game.rollDice([1]);
        return { id: 'room', settlementMatchId: id, gameType: 'snake', rulesVersion: 'snake-server-single-die-v1', turnOrder: ['a', 'b'], status: 'finished', game, players: game.players, snakes: {}, ladders: {}, initialDiceCells: {} };
      }
      const balances = async () => (await c.users.find().sort({ _id: 1 }).toArray()).map(u => u.balance);
      async function checkAudits() { for (const user of await c.users.find().toArray()) { const audit = await c.fundingAudits.findOne({ _id: user.tpcAccountNumber }); assert.equal(audit.fingerprint, gameFundingFingerprint(user)); assert.equal(audit.availableUnits, String(user.balance)); } }
      await reserve(); return { c, reserve, playToWin, moves, makeMoves, coordinator: coordinator(), makeCoordinator: coordinator, room, balances, checkAudits, matchId };
    }
    await t.test('reserve→start→concurrent finish conserves funds and permits next round', async () => {
      const f = await fixture(); const started = await f.coordinator.start('m', board, ['a', 'b']); assert.equal(started.duplicate, false);
      assert.equal((await f.coordinator.start('m', board, ['a', 'b'])).duplicate, true);
      await f.playToWin();
      const attempts = await Promise.allSettled([f.coordinator.finish('m'), f.coordinator.finish('m')]);
      assert.ok(attempts.some(a => a.status === 'fulfilled')); assert.equal((await f.coordinator.finish('m')).duplicate, true);
      assert.deepEqual(await f.balances(), [108, 90, 102]); await f.checkAudits();
      assert.equal(await f.c.accountLocks.countDocuments(), 0); assert.equal(await f.c.receipts.countDocuments(), 1);
      assert.equal((await f.c.lifecycleMatches.findOne({ _id: 'm' })).status, 'settled');
      await f.reserve('m2'); assert.deepEqual(await f.balances(), [98, 80, 102]); assert.equal(await f.c.accountLocks.countDocuments(), 2); await f.checkAudits();
    });
    await t.test('duplicate pre-start refund restores balances/audits and releases all locks exactly once', async () => {
      const f = await fixture(); const attempts = await Promise.allSettled([f.coordinator.refundBeforeStart('m'), f.coordinator.refundBeforeStart('m')]);
      assert.ok(attempts.some(a => a.status === 'fulfilled')); assert.equal((await f.coordinator.refundBeforeStart('m')).duplicate, true);
      assert.deepEqual(await f.balances(), [100, 100, 100]); assert.equal(await f.c.accountLocks.countDocuments(), 0); await f.checkAudits();
      await assert.rejects(f.coordinator.start('m', board, ['a', 'b']));
    });
    await t.test('start versus cancellation race cannot both succeed', async () => {
      const f = await fixture(); const result = await Promise.allSettled([f.coordinator.start('m', board, ['a', 'b']), f.coordinator.refundBeforeStart('m')]);
      assert.equal(result.filter(r => r.status === 'fulfilled').length, 1);
      const state = await f.c.lifecycleMatches.findOne({ _id: 'm' });
      if (state.status === 'playing') { assert.deepEqual(await f.balances(), [90, 90, 100]); await f.playToWin(); await f.coordinator.finish('m'); }
      else { assert.equal(state.status, 'refunded'); assert.deepEqual(await f.balances(), [100, 100, 100]); }
      await f.checkAudits(); assert.equal(await f.c.accountLocks.countDocuments(), 0);
    });
    await t.test('failure at final receipt rolls back credits, audit cursors, locks and lifecycle', async () => {
      const f = await fixture(); await f.coordinator.start('m', board, ['a', 'b']); await f.playToWin();
      const bad = f.makeCoordinator({ receipts: { findOne: (...args) => f.c.receipts.findOne(...args), insertOne: () => { throw new Error('receipt_failure'); } } });
      await assert.rejects(bad.finish('m'), /receipt_failure/);
      assert.deepEqual(await f.balances(), [90, 90, 100]); await f.checkAudits();
      assert.equal(await f.c.accountLocks.countDocuments(), 2); assert.equal(await f.c.receipts.countDocuments(), 0);
      assert.equal((await f.c.lifecycleMatches.findOne({ _id: 'm' })).status, 'playing');
      await f.coordinator.finish('m');
    });
    await t.test('stale provenance fails closed without releasing held funds', async () => {
      const f = await fixture(); await f.coordinator.start('m', board, ['a', 'b']); await f.playToWin(); await f.c.users.updateOne({ _id: 'u-a' }, { $inc: { balance: 1 } });
      await assert.rejects(f.coordinator.finish('m'), /funding_provenance_required/);
      assert.deepEqual(await f.balances(), [91, 90, 100]); assert.equal(await f.c.accountLocks.countDocuments(), 2); assert.equal(await f.c.receipts.countDocuments(), 0);
    });
    await t.test('missing/wrong round lock rejects settlement', async () => {
      const f = await fixture(); await f.coordinator.start('m', board, ['a', 'b']); await f.playToWin(); await f.c.accountLocks.updateOne({ _id: 'b' }, { $set: { matchId: 'other' } });
      await assert.rejects(f.coordinator.finish('m'), /round_lock_missing/); assert.deepEqual(await f.balances(), [90, 90, 100]);
    });
    await t.test('post-start refund and cross-round winner are rejected', async () => {
      const f = await fixture(); await f.coordinator.start('m', board, ['a', 'b']);
      await assert.rejects(f.coordinator.refundBeforeStart('m'), /round_lifecycle_mismatch/);
      await assert.rejects(f.coordinator.finish('m', f.room('other')), /client_outcome_not_accepted/);
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
        await assert.rejects(f.makeCoordinator({ users: guardedUsers }).start('m', board, ['a', 'b']));
        assert.ok(injected); assert.equal((await f.c.lifecycleMatches.findOne({ _id: 'm' })).status, 'reserved');
        assert.equal((await f.c.escrowMatches.findOne({ _id: 'm' })).startedAt, null);
        assert.deepEqual(await f.balances(), mutation === 'participant-ledger-change' ? [91, 90, 100] : [90, 90, 100]);
      });
    }
    await t.test('concurrent duplicate move records exactly one server roll', async () => {
      const f = await fixture(); await f.coordinator.start('m', board, ['a', 'b']);
      const command = { matchId: 'm', requestId: 'same-roll', expectedVersion: 0, credentials: { initData: '1' } };
      const results = await Promise.allSettled([f.moves.roll(command), f.moves.roll(command)]);
      assert.ok(results.some(r => r.status === 'fulfilled')); assert.equal((await f.moves.roll(command)).duplicate, true);
      assert.equal(await f.c.gameMoves.countDocuments(), 2); assert.equal((await f.moves.recover('m')).version, 1);
      await assert.rejects(f.moves.roll({ ...command, credentials: { initData: '2' } }), /roll_idempotency_conflict/);
    });
    await t.test('different concurrent move IDs cannot double-spend one turn version', async () => {
      const f = await fixture(); await f.coordinator.start('m', board, ['a', 'b']);
      const command = { matchId: 'm', expectedVersion: 0, credentials: { initData: '1' } };
      const results = await Promise.allSettled([f.moves.roll({ ...command, requestId: 'r1' }), f.moves.roll({ ...command, requestId: 'r2' })]);
      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1); assert.equal((await f.moves.recover('m')).version, 1);
    });
    await t.test('new service instance recovers moves and settles only replayed winner', async () => {
      const f = await fixture(); await f.coordinator.start('m', board, ['a', 'b']);
      for (let v = 0; v < 9; v++) await f.moves.roll({ matchId: 'm', requestId: `r${v}`, expectedVersion: v, credentials: { initData: '1' } });
      const restarted = f.makeMoves({ rollDie: () => 1 }); const recovered = await restarted.recover('m');
      assert.equal(recovered.version, 9); assert.equal(recovered.current.players[0].position, 49);
      await restarted.roll({ matchId: 'm', requestId: 'final', expectedVersion: 9, credentials: { initData: '1' } });
      await f.makeCoordinator({}).finish('m'); assert.deepEqual(await f.balances(), [108, 90, 102]); await f.checkAudits();
    });
    await t.test('journal append failure rolls back move snapshot and identity fence', async () => {
      const f = await fixture(); await f.coordinator.start('m', board, ['a', 'b']);
      const moves = f.makeMoves({ gameMoves: { findOne: (...a) => f.c.gameMoves.findOne(...a), find: (...a) => f.c.gameMoves.find(...a), insertOne: () => { throw new Error('append_failure'); } } });
      await assert.rejects(moves.roll({ matchId: 'm', requestId: 'r', expectedVersion: 0, credentials: { initData: '1' } }), /append_failure/);
      assert.equal((await f.moves.recover('m')).version, 0); assert.equal((await f.c.users.findOne({ _id: 'u-a' })).gameActionFence, undefined);
    });
    await t.test('client dice/winner claims cannot select a server result', async () => {
      const f = await fixture(); await f.coordinator.start('m', board, ['a', 'b']);
      await assert.rejects(f.moves.roll({ matchId: 'm', requestId: 'r', expectedVersion: 0, dice: 6, credentials: { initData: '1' } }), /client_outcome_not_accepted/);
      await assert.rejects(f.coordinator.finish('m', f.room()), /client_outcome_not_accepted/);
      assert.equal((await f.moves.recover('m')).version, 0);
    });
    await t.test('tampered durable outcome blocks payout and leaves funds held', async () => {
      const f = await fixture(); await f.coordinator.start('m', board, ['a', 'b']); await f.playToWin();
      await f.c.gameMoves.updateOne({ matchId: 'm', sequence: 10 }, { $set: { 'result.position': 49 } });
      await assert.rejects(f.coordinator.finish('m'), /journal_move_corrupt/); assert.deepEqual(await f.balances(), [90, 90, 100]);
      assert.equal(await f.c.accountLocks.countDocuments(), 2);
    });
    await t.test('missing move blocks recovery; no fallback to mutable snapshot', async () => {
      const f = await fixture(); await f.coordinator.start('m', board, ['a', 'b']); await f.playToWin();
      await f.c.gameMoves.deleteOne({ matchId: 'm', sequence: 5 }); await assert.rejects(f.moves.recover('m'), /journal_sequence_corrupt/);
    });
    for (const mutation of ['ban', 'dispute']) await t.test(`move fences reject concurrent ${mutation} after auth/state validation`, async () => {
      const f = await fixture(); await f.coordinator.start('m', board, ['a', 'b']); let changed = false;
      const moves = f.makeMoves({ users: { find: (...a) => f.c.users.find(...a), updateOne: async (...a) => {
        if (!changed) { changed = true; if (mutation === 'ban') await f.c.users.updateOne({ _id: 'u-a' }, { $set: { isBanned: true } });
          else await f.c.lifecycleMatches.updateOne({ _id: 'm' }, { $set: { status: 'disputed' } }); }
        return f.c.users.updateOne(...a);
      } } });
      await assert.rejects(moves.roll({ matchId: 'm', requestId: 'r', expectedVersion: 0, credentials: { initData: '1' } }));
      assert.ok(changed); assert.equal((await f.moves.recover('m')).version, 0);
    });
    await t.test('move adapter verifies real HMAC and rejects forged, expired, nonmember and unsigned callers', async () => {
      const f = await fixture(); await f.coordinator.start('m', board, ['a', 'b']); const token = 'synthetic-journal-test-token';
      function signed(id, age = 0, secretToken = token) {
        const params = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000) - age), user: JSON.stringify({ id }) });
        const secret = createHmac('sha256', 'WebAppData').update(secretToken).digest();
        const text = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n');
        params.set('hash', createHmac('sha256', secret).update(text).digest('hex')); return params.toString();
      }
      const liveAuth = f.makeMoves({ now: Date.now, rollDie: () => 6, verifyCredentials: credentials => verifySocialCredentials(credentials, { botToken: token, maxAgeSeconds: 60 }) });
      const request = { matchId: 'm', requestId: 'signed', expectedVersion: 0 };
      for (const credentials of [{ initData: signed(1, 0, 'wrong') }, { initData: signed(1, 120) }, { initData: signed(3) }, { accountId: 'a' }]) {
        await assert.rejects(liveAuth.roll({ ...request, credentials }));
      }
      assert.equal((await liveAuth.recover('m')).version, 0);
      const moved = await liveAuth.roll({ ...request, credentials: { initData: signed(1) } });
      assert.equal(moved.move.actor, 'a'); assert.equal(moved.move.dice, 6);
    });
    await t.test('coordinator cannot change accepted turn order after reservation', async () => {
      const f = await fixture(); await assert.rejects(f.coordinator.start('m', board, ['b', 'a']), /initial_rules_mismatch/);
      assert.equal((await f.c.escrowMatches.findOne({ _id: 'm' })).startedAt, null); assert.equal(await f.c.gameMoves.countDocuments(), 0);
    });
    await t.test('maximum round ID supports pre-start refund and bounded journal references', async () => {
      const id = 'x'.repeat(160); const f = await fixture(id); await f.coordinator.refundBeforeStart(id);
      assert.deepEqual(await f.balances(), [100, 100, 100]); await f.checkAudits();
    });
  } finally { await connection?.close(); await replica?.stop(); }
});
