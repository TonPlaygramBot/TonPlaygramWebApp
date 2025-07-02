import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import { ensureTransactionArray, calculateBalance } from '../utils/userUtils.js';

dotenv.config();

const [targetId, ...sourceIds] = process.argv.slice(2);

if (!targetId || sourceIds.length === 0) {
  console.error('Usage: node importTransactions.js <targetAccountId> <sourceAccountId...>');
  process.exit(1);
}

const uri = process.env.MONGODB_URI;
if (!uri || uri === 'memory') {
  console.error('MONGODB_URI must be set to a MongoDB instance');
  process.exit(1);
}

await mongoose.connect(uri);

const target = await User.findOne({ accountId: targetId });
if (!target) {
  console.error('Target account not found:', targetId);
  process.exit(1);
}
ensureTransactionArray(target);

let imported = 0;
for (const id of sourceIds) {
  if (id === targetId) continue;
  const src = await User.findOne({ accountId: id });
  if (!src) {
    console.warn('Source account not found:', id);
    continue;
  }
  ensureTransactionArray(src);
  for (const tx of src.transactions) {
    target.transactions.push({ ...tx });
    imported++;
  }
}

target.balance = calculateBalance(target);
await target.save();

await mongoose.disconnect();
console.log(`Imported ${imported} transactions into ${targetId}. New balance: ${target.balance}`);

