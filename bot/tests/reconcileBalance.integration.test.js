import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import User from '../models/User.js';
import { reconcileBalanceSnapshot } from '../utils/reconcileBalance.js';

let mongo, id;
test.before(async () => { mongo = await MongoMemoryServer.create(); await mongoose.connect(mongo.getUri()); });
test.after(async () => { await mongoose.disconnect(); await mongo?.stop(); });
test.beforeEach(async () => {
  await User.collection.deleteMany({}); id = new mongoose.Types.ObjectId();
  // Bypass schema defaults to exercise real legacy records and exact BSON match.
  await User.collection.insertOne({ _id: id, balance: 50, transactions: [{ amount: 100 }] });
});
test('raw legacy ledger repairs without hydration defaults or ledger rewrite', async () => {
  const user = await User.findById(id);
  assert.equal((await reconcileBalanceSnapshot(user)).balance, 100);
  assert.deepEqual((await User.collection.findOne({ _id: id })).transactions, [{ amount: 100 }]);
});
for (const amount of [400, -30]) {
  test(`concurrent atomic change ${amount} wins over stale reconciliation`, async () => {
    const Model = { hydrate: raw => User.hydrate(raw), collection: {
      findOne: filter => User.collection.findOne(filter),
      async findOneAndUpdate(filter, update, options) {
        await User.collection.updateOne({ _id: id }, { $inc: { balance: amount }, $push: { transactions: { amount } } });
        return User.collection.findOneAndUpdate(filter, update, options);
      }
    } };
    const result = await reconcileBalanceSnapshot(await User.findById(id), Model);
    assert.equal(result.balance, 50 + amount);
    assert.equal((await User.findById(id)).balance, 50 + amount);
  });
}
test('parallel read repairs converge without duplicate credits', async () => {
  const user = await User.findById(id);
  const results = await Promise.all(Array.from({ length: 16 }, () => reconcileBalanceSnapshot(user)));
  assert.ok(results.every(u => u.balance === 100));
  assert.equal((await User.findById(id)).balance, 100);
});
