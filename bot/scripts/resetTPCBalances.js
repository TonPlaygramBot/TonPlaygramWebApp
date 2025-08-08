import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
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
  user.balance = 0;
  user.minedTPC = 0;
  user.transactions = [];
  await user.save();
  console.log(`Reset TPC for ${user.telegramId || user.accountId}`);
}

await mongoose.disconnect();
