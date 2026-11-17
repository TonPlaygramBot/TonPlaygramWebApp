import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import User from '../models/User.js';
import { createLuckyDaily } from '../services/luckyDaily.js';
let mongo, user;
const now = Date.parse('2026-11-17T12:00:00Z');
const service = createLuckyDaily({ User, clock: () => now });
test.before(async () => { mongo = await MongoMemoryServer.create(); await mongoose.connect(mongo.getUri()); });
test.after(async () => { await mongoose.disconnect(); await mongo?.stop(); });
test.beforeEach(async () => { await User.deleteMany({}); user = await User.create({ telegramId: 123, balance: 50, transactions: [] }); });
test('parallel requests credit only once and duplicate response recovery is safe', async () => {
  const results = await Promise.all(Array.from({ length: 24 }, () => service.claim(user._id)));
  assert.ok(results.every(x => x.balance === 150));
  assert.equal((await service.claim(user._id)).alreadyClaimed, true);
  const stored = await User.findById(user._id); assert.equal(stored.balance, 150); assert.equal(stored.transactions.length, 1);
});
test('raw legacy ledger is recognized without Mongoose defaults', async () => {
  await User.collection.updateOne({ _id: user._id }, { $set: { transactions: [{ type: 'lucky', amount: 100, date: new Date(now) }] } });
  assert.equal((await service.claim(user._id)).legacy, true);
  assert.equal((await User.findById(user._id)).balance, 50);
});
test('next UTC date grants one more daily reward', async () => {
  await service.claim(user._id);
  await createLuckyDaily({ User, clock: () => now + 86400000 }).claim(user._id);
  assert.equal((await User.findById(user._id)).balance, 250);
});
