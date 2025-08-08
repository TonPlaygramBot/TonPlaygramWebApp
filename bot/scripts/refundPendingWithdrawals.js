import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import { ensureTransactionArray } from '../utils/userUtils.js';

dotenv.config();

const uri = process.env.MONGODB_URI;
if (!uri || uri === 'memory') {
  console.error('MONGODB_URI must be set to a MongoDB instance');
  process.exit(1);
}

await mongoose.connect(uri);

const users = await User.find({
  transactions: { $elemMatch: { type: 'withdraw', status: 'pending' } }
});

for (const user of users) {
  ensureTransactionArray(user);
  let refundTotal = 0;
  for (const tx of user.transactions) {
    if (tx.type === 'withdraw' && tx.status === 'pending') {
      const amount = Math.abs(tx.amount || 0);
      refundTotal += amount;
      tx.status = 'failed';
      user.transactions.push({
        amount,
        type: 'refund',
        token: tx.token || 'TPC',
        status: 'delivered',
        date: new Date(),
        detail: 'Refund of pending withdrawal'
      });
    }
  }
  if (refundTotal > 0) {
    user.balance += refundTotal;
    await user.save();
    console.log(`Refunded ${refundTotal} TPC to ${user.telegramId || user.accountId}`);
  }
}

await mongoose.disconnect();
