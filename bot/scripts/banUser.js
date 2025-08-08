import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const uri = process.env.MONGO_URI;
if (!uri || uri === 'memory') {
  console.error('MONGO_URI must be set to a MongoDB instance');
  process.exit(1);
}

const accountId = process.argv[2];
if (!accountId) {
  console.error('Usage: node bot/scripts/banUser.js <accountId>');
  process.exit(1);
}

await mongoose.connect(uri);

const user = await User.findOne({ accountId });
if (!user) {
  console.error('User not found');
  await mongoose.disconnect();
  process.exit(1);
}

user.isBanned = true;
await user.save();
console.log(`User ${accountId} banned`);

await mongoose.disconnect();
