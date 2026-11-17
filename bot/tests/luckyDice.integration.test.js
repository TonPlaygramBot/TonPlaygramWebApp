import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import User from '../models/User.js';
import { createSpinRewards } from '../services/spinRewards.js';
let mongo, user, now, draws;
const service = createSpinRewards({ User, clock: () => now, random: () => draws.shift() ?? 0 });
test.before(async () => { mongo = await MongoMemoryServer.create(); await mongoose.connect(mongo.getUri()); });
test.after(async () => { await mongoose.disconnect(); await mongo?.stop(); });
test.beforeEach(async () => {
  await User.deleteMany({}); now = 1800000000000; draws = [];
  user = await User.create({ balance: 100, transactions: [] });
});
test('Mongo persists Lucky dice/suit/card grant and duplicate claims credit once', async () => {
  draws = [1, 2, 3, 30, 6];
  const lucky = await service.start(user._id, 'lucky', randomUUID());
  assert.deepEqual(lucky.dice, [2, 3]); assert.equal(lucky.suit, 'clubs'); assert.equal(lucky.outcome, 1200);
  now += 15000;
  const claims = await Promise.all(Array.from({ length: 16 }, () => service.claim(user._id, 'lucky', lucky.id)));
  assert.ok(claims.every(x => x.balance === 1300));
  assert.equal((await User.findById(user._id)).transactions.length, 1);
});
test('Lucky free spins and simultaneous spin consumption preserve exact entitlement count', async () => {
  await User.updateOne({ _id: user._id }, { $set: { 'spinRewards.spin.freeSpins': 1 } });
  draws = [0, 0, 0, 15];
  const lucky = await service.start(user._id, 'lucky', randomUUID()); now += 15000;
  await Promise.all([service.claim(user._id, 'lucky', lucky.id), service.start(user._id, 'spin', randomUUID())]);
  assert.equal((await service.status(user._id, 'spin')).freeSpins, 2);
  assert.equal((await service.claim(user._id, 'lucky', lucky.id)).spinFreeSpins, 2);
});
test('bonus sum credits once without changing spin cooldown or creating consumable bonus tokens', async () => {
  draws = [0, 0, 0, 0, 0, 1, 2];
  const lucky = await service.start(user._id, 'lucky', randomUUID()); now += 15000;
  assert.equal((await service.claim(user._id, 'lucky', lucky.id)).balance, 1900);
  assert.equal((await service.claim(user._id, 'lucky', lucky.id)).balance, 1900);
  assert.equal((await service.status(user._id, 'spin')).nextSpinAt, 0);
});
