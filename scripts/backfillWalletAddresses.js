import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../bot/models/User.js';
import { generateWalletAddress } from '../bot/utils/ton.js';

dotenv.config();

const uri = process.env.MONGO_URI;
if (!uri || uri === 'memory') {
  console.error('MONGO_URI must be set to a MongoDB instance');
  process.exit(1);
}

await mongoose.connect(uri);

const users = await User.find({
  $or: [{ walletAddress: { $exists: false } }, { walletAddress: null }, { walletAddress: '' }]
});

let processed = 0;
for (const user of users) {
  const address = await generateWalletAddress();
  user.walletAddress = address;
  await user.save();
  processed++;
  console.log(`Updated user ${user.accountId || user._id} with address ${address}`);
}

console.log(`Backfilled ${processed} user(s).`);

await mongoose.disconnect();
