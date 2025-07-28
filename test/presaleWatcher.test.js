import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import PresaleTransaction from '../bot/models/PresaleTransaction.js';
import User from '../bot/models/User.js';
import { processTransactions, processPendingRecords } from '../bot/presaleWatcher.js';

const wallet = 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c';
const txHash = 'testhash123';
const utime = Math.floor(Date.now() / 1000);

test('presale watcher stores and processes pending transactions', { concurrency: false }, async () => {
  const mem = await MongoMemoryServer.create();
  await mongoose.connect(mem.getUri(), { autoIndex: false });

  const origFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      transactions: [
        {
          in_msg: { source: { address: wallet }, value: '1000000000' },
          utime,
          hash: txHash,
        },
      ],
    }),
  });

  await processTransactions();

  let rec = await PresaleTransaction.findOne({ txHash });
  assert.ok(rec, 'transaction record saved');
  assert.equal(rec.processed, false);

  const user = new User({ telegramId: 1, walletAddress: wallet });
  await user.save();

  await processPendingRecords();

  rec = await PresaleTransaction.findOne({ txHash });
  const updatedUser = await User.findOne({ walletAddress: wallet });
  assert.ok(rec.processed, 'record processed');
  assert.equal(rec.accountId, updatedUser.accountId);
  assert.equal(updatedUser.balance, rec.tpc);

  await mongoose.disconnect();
  await mem.stop();
  global.fetch = origFetch;
});
