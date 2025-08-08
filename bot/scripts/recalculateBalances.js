import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import { ensureTransactionArray } from '../utils/userUtils.js';
import { getMongoUri } from '../utils/mongoUri.js';

dotenv.config();

const uri = getMongoUri();
if (!uri || uri === 'memory') {
  console.error('MONGODB_URI must be set to a MongoDB instance');
  process.exit(1);
}

await mongoose.connect(uri);

const users = await User.find({});
for (const user of users) {
  ensureTransactionArray(user);
  const total = user.transactions.reduce((acc, tx) => {
    const amt = typeof tx.amount === 'number' ? tx.amount : 0;
    return acc + amt;
  }, 0);
  if (user.balance !== total) {
    console.log(`Updating balance for ${user.telegramId || user.accountId}: ${user.balance} -> ${total}`);
    user.balance = total;
    await user.save();
  }
}

await mongoose.disconnect();
