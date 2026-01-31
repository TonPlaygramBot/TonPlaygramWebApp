import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import User from '../bot/models/User.js';

// Regression test: inserting multiple users without a telegramId should not
// trigger a duplicate key error on the telegramId index.
test('allows multiple users without telegramId', { timeout: 20000 }, async () => {
  const mongo = await MongoMemoryServer.create();
  mongoose.set('bufferTimeoutMS', 20000);
  const connection = await mongoose
    .createConnection(mongo.getUri(), { serverSelectionTimeoutMS: 20000 })
    .asPromise();
  await connection.db.admin().ping();
  const UserModel = connection.model('User', User.schema);
  try {
    await UserModel.create({ walletAddress: 'addr1' });
    await UserModel.create({ walletAddress: 'addr2' });
    const count = await UserModel.countDocuments();
    assert.equal(count, 2);
  } finally {
    await connection.close();
    await mongo.stop();
  }
});
