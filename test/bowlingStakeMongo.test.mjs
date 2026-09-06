import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import User from '../bot/models/User.js';
import BowlingMatch from '../bot/models/BowlingMatch.js';
import {
  reserveBowlingStake,
  settleBowlingStake
} from '../bot/services/bowlingStake.js';
const mongoose = User.base;
// A disposable replica set only. This test creates and drops a unique database.
test(
  'MongoDB bowling ledger: rollback, concurrent account reservation, duplicate settlement and tie refunds',
  { skip: !process.env.BOWLING_TEST_MONGO_URI },
  async (t) => {
    await mongoose.connect(process.env.BOWLING_TEST_MONGO_URI, {
      dbName: `bowling_test_${randomUUID().replaceAll('-', '')}`
    });
    t.after(async () => {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    });
    await Promise.all([User.init(), BowlingMatch.init()]);
    for (const id of ['a', 'b', 'c'])
      await User.create({
        accountId: id,
        tpcAccountNumber: id,
        balance: id === 'b' ? 10 : 1000
      });
    const table = (id, ids) => ({
      id,
      gameType: 'bowlingroyal',
      stake: 100,
      players: ids.map((id) => ({ id })),
      meta: { format: 'tenpin', mode: 'online', token: 'tpg' }
    });
    const funds = async (id) => (await User.findOne({ accountId: id })).balance;
    await assert.rejects(
      reserveBowlingStake(table('poor', ['a', 'b'])),
      /insufficient/
    );
    assert.equal(await funds('a'), 1000);
    assert.equal(await BowlingMatch.countDocuments(), 0);
    await User.updateOne({ accountId: 'b' }, { balance: 1000 });
    const races = await Promise.allSettled([
      reserveBowlingStake(table('one', ['a', 'b'])),
      reserveBowlingStake(table('two', ['a', 'c']))
    ]);
    assert.equal(races.filter((r) => r.status === 'fulfilled').length, 1);
    const match = await BowlingMatch.findOne();
    await Promise.all([
      settleBowlingStake(match.tableId, 'a'),
      settleBowlingStake(match.tableId, 'a')
    ]);
    assert.equal(await funds('a'), 1100);
    assert.equal(
      (await User.findOne({ accountId: 'a' })).transactions.filter(
        (x) => x.type === 'stake_payout'
      ).length,
      1
    );
    await reserveBowlingStake(table('tie', ['a', 'b']));
    await settleBowlingStake('tie');
    await settleBowlingStake('tie');
    assert.equal(await funds('a'), 1100);
    assert.equal(
      await User.countDocuments({ currentTableId: { $ne: null } }),
      0
    );
  }
);
