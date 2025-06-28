import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import { ensureTransactionArray } from '../utils/userUtils.js';

dotenv.config();

const [accountId, amountArg] = process.argv.slice(2);
const amount = Number(amountArg);

if (!accountId || !amount) {
  console.error('Usage: node creditAccount.js <accountId> <amount>');
  process.exit(1);
}

const uri = process.env.MONGODB_URI;
if (!uri || uri === 'memory') {
  console.error('MONGODB_URI must be set to a MongoDB instance');
  process.exit(1);
}

await mongoose.connect(uri);
const user = await User.findOne({ accountId });
if (!user) {
  console.error('Account not found:', accountId);
  process.exit(1);
}

ensureTransactionArray(user);
user.balance += amount;
user.transactions.push({
  amount,
  type: 'deposit',
  status: 'delivered',
  date: new Date()
});
await user.save();
console.log(`Credited ${amount} TPC to account ${accountId}`);
await mongoose.disconnect();
