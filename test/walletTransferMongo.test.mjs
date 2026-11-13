import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import User from '../bot/models/User.js';
import WalletTransfer from '../bot/models/WalletTransfer.js';
import { createWalletTransferService } from '../bot/services/walletTransfer.js';
const mongoose = User.base;

// CI runs a disposable replica set. Developers may supply a LOCAL test replica
// set URI; a unique database is created and removed. Never use production here.
const enabled = process.env.WALLET_TEST_MONGO_URI || process.env.RUN_WALLET_MONGO_TESTS === '1';
const mongoTest = enabled ? test : test.skip;
mongoTest('MongoDB transfer rollback, concurrency and durable retry receipts', {
  timeout: 180000
}, async (t) => {
  let replica;
  let uri = process.env.WALLET_TEST_MONGO_URI;
  if (!uri) {
    const { MongoMemoryReplSet } = await import('mongodb-memory-server');
    replica = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
    uri = replica.getUri();
  }
  await mongoose.connect(uri, { dbName: `wallet_test_${randomUUID().replaceAll('-', '')}` });
  t.after(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    if (replica) await replica.stop();
  });
  await Promise.all([User.init(), WalletTransfer.init()]);
  const [a, b, c] = await User.create([
    { accountId: 'a', balance: 100 },
    { accountId: 'b', balance: 10 },
    { accountId: 'c', balance: 0 }
  ]);
  const dependencies = { UserModel: User, TransferModel: WalletTransfer, database: mongoose };
  const transfer = createWalletTransferService(dependencies);
  const input = (extra = {}) => ({
    senderId: a._id, receiverId: b._id, amount: 25,
    operationId: 'mongo-operation-00001', note: '', ...extra
  });

  await t.test('recipient write failure aborts prior sender debit and history', async () => {
    const failedTransfer = createWalletTransferService({
      ...dependencies,
      UserModel: {
        findOne: (filter) => User.findOne(filter),
        updateOne: async (filter, update, options) => {
          if (String(filter._id) === String(b._id)) throw new Error('injected recipient write failure');
          return User.updateOne(filter, update, options);
        }
      }
    });
    await assert.rejects(failedTransfer(input()), { code: 'transfer_unavailable_retry_same_operation' });
    assert.equal((await User.findById(a._id)).balance, 100);
    assert.equal((await User.findById(a._id)).transactions.length, 0);
    assert.equal((await User.findById(b._id)).balance, 10);
    assert.equal(await WalletTransfer.countDocuments(), 0);
  });

  await t.test('simultaneous identical retries commit exactly once', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => transfer(input())));
    assert.equal(results.filter((r) => !r.replayed).length, 1);
    assert.equal((await User.findById(a._id)).balance, 75);
    assert.equal((await User.findById(b._id)).balance, 35);
    assert.equal((await User.findById(a._id)).transactions.length, 1);
    assert.equal(await WalletTransfer.countDocuments(), 1);
    const recreated = createWalletTransferService(dependencies);
    assert.equal((await recreated(input())).replayed, true);
    await assert.rejects(recreated(input({ amount: 24 })), { code: 'operation_id_conflict' });
  });

  await t.test('competing operations cannot overdraw an account', async () => {
    const results = await Promise.allSettled([
      transfer(input({ amount: 60, operationId: 'mongo-operation-00002' })),
      transfer(input({ amount: 60, receiverId: c._id, operationId: 'mongo-operation-00003' }))
    ]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(results.find((r) => r.status === 'rejected').reason.code, 'insufficient_balance');
    assert.equal((await User.findById(a._id)).balance, 15);
    const users = await User.find();
    assert.equal(users.reduce((sum, user) => sum + user.balance, 0), 110);
    assert.equal(await WalletTransfer.countDocuments(), 2);
  });
});
