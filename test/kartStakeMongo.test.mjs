import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import User from '../bot/models/User.js';
import KartMatch from '../bot/models/KartMatch.js';
import { createKartStakeService } from '../bot/services/kartStake.js';
const mongoose = User.base;

// Supply a local/test MongoDB replica set; a unique database is created and
// removed. Never point this test at a production connection.
const mongoTest = process.env.KART_TEST_MONGO_URI ? test : test.skip;
mongoTest(
  'MongoDB: reserve rollback, concurrent grids, duplicate payout and refund',
  async (t) => {
    await mongoose.connect(process.env.KART_TEST_MONGO_URI, {
      dbName: `kart_test_${randomUUID().replaceAll('-', '')}`
    });
    t.after(async () => {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    });
    await Promise.all([User.init(), KartMatch.init()]);
    for (const id of ['a', 'b', 'c'])
      await User.create({
        accountId: id,
        tpcAccountNumber: id,
        balance: id === 'b' ? 10 : 1000
      });
    const service = createKartStakeService();
    const grid = (id, ids) => ({
      id,
      stake: 100,
      players: ids.map((id) => ({ id }))
    });
    await assert.rejects(
      service.reserve(grid('poor', ['a', 'b'])),
      /insufficient/
    );
    assert.equal((await User.findOne({ accountId: 'a' })).balance, 1000);
    assert.equal(await KartMatch.countDocuments(), 0);
    await User.updateOne({ accountId: 'b' }, { balance: 1000 });
    const attempts = await Promise.allSettled([
      service.reserve(grid('one', ['a', 'b'])),
      service.reserve(grid('two', ['a', 'c']))
    ]);
    assert.equal(attempts.filter((r) => r.status === 'fulfilled').length, 1);
    const match = await KartMatch.findOne();
    await Promise.all([
      service.settle(match.tableId, { winnerAccountId: 'a' }),
      service.settle(match.tableId, { winnerAccountId: 'a' })
    ]);
    assert.equal((await User.findOne({ accountId: 'a' })).balance, 1100);
    await service.reserve(grid('refund', ['a', 'b', 'c']));
    await service.settle('refund', { reason: 'loading_timeout_refund' });
    await service.settle('refund', { reason: 'loading_timeout_refund' });
    assert.equal((await User.findOne({ accountId: 'a' })).balance, 1100);
    assert.equal(
      await User.countDocuments({ currentTableId: { $ne: null } }),
      0
    );
  }
);
