// Ephemeral Mongo only. No external URI/environment database is ever accepted.
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { SnakeGame } from '../logic/snakeGame.js';
import { snakeRulesHash } from '../services/settlement/snakeServerResult.js';
import { createSnakeTransactionalSettlement } from '../services/settlement/snakeTransactionalSettlement.js';

test('real replica-set transaction: concurrent duplicate settlement and failed credit rollback', async () => {
  let replica; let connection;
  try {
    replica = await MongoMemoryReplSet.create({ replSet: { count: 1, args: ['--nounixsocket'] } });
    connection = await mongoose.createConnection(replica.getUri(), { dbName: 'isolated_snake_settlement_test' }).asPromise();
    const db = connection.db;
    const matches = db.collection('matches'); const users = db.collection('users'); const receipts = db.collection('receipts');
    await users.createIndex({ tpcAccountNumber: 1 }, { unique: true });
    const game = new SnakeGame(); game.addPlayer('a', 'A'); game.addPlayer('b', 'B');
    game.players.forEach(p => { p.playerId = p.id; }); game.players[0].position = 49; game.rollDice([1]);
    const room = { id: 'room', settlementMatchId: 'm', gameType: 'snake', status: 'finished', game, players: game.players, snakes: {}, ladders: {}, initialDiceCells: {} };
    const match = { _id: 'm', matchId: 'm', roomId: 'room', gameType: 'snake', assetId: 'test-ledger', version: 0, status: 'reserved',
      startedAt: '2026-11-17T12:00:00Z', rulesHash: snakeRulesHash({ snakes: {}, ladders: {}, diceCells: {} }),
      feePolicy: { policyId: 'test', units: '2', accountId: 'house' }, reservations: ['a', 'b'].map(accountId => ({
        matchId: 'm', assetId: 'test-ledger', accountId, receiptId: `held-${accountId}`, status: 'held', units: '10' })) };
    const accounts = ['a', 'b'].map(id => ({ _id: id, tpcAccountNumber: id, balance: 90, transactions: [{
      transactionId: `held-${id}`, amount: -10, type: 'stake_reserve', token: 'TPG', status: 'reserved', game: 'snake', detail: 'm' }] }));
    await matches.insertOne(match); await users.insertMany(accounts);
    const settle = createSnakeTransactionalSettlement({ client: connection.getClient(), matches, users, receipts, assetId: 'test-ledger' });
    await assert.rejects(settle('m', room), /canonical_account_missing_or_ambiguous/);
    assert.equal((await matches.findOne({ _id: 'm' })).status, 'reserved');
    assert.equal((await users.findOne({ _id: 'a' })).balance, 90);
    assert.equal((await users.findOne({ _id: 'b' })).transactions[0].status, 'reserved');
    assert.equal(await receipts.countDocuments(), 0);
    await users.insertOne({ _id: 'house', tpcAccountNumber: 'house', balance: 0, transactions: [] });
    const results = await Promise.all([settle('m', room), settle('m', room)]);
    assert.equal(results.filter(r => !r.duplicate).length, 1);
    assert.equal(await receipts.countDocuments(), 1);
    assert.equal((await users.findOne({ _id: 'a' })).balance, 108);
    assert.equal((await users.findOne({ _id: 'house' })).balance, 2);
    assert.equal((await users.findOne({ _id: 'b' })).transactions[0].status, 'settled');
    assert.equal((await settle('m', null)).duplicate, true);
  } finally { await connection?.close(); await replica?.stop(); }
});
