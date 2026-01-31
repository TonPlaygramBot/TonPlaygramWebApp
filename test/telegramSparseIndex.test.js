import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import User from '../bot/models/User.js';

// Regression test: inserting multiple users without a telegramId should not
// trigger a duplicate key error on the telegramId index.
test('allows multiple users without telegramId', async () => {
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  try {
    await User.create({ walletAddress: 'addr1' });
    await User.create({ walletAddress: 'addr2' });
    const count = await User.countDocuments();
    assert.equal(count, 2);
  } finally {
    await mongoose.disconnect();
    await mongo.stop();
  }
});
