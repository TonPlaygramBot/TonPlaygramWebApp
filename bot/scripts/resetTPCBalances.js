import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const uri = process.env.MONGO_URI;
if (!uri || uri === 'memory') {
  console.error('MONGO_URI must be set to a MongoDB instance');
  process.exit(1);
}

await mongoose.connect(uri);

const ids = process.argv.slice(2);

// If no identifiers are provided, reset every user's TPC balance just like
// the original behaviour of this script.
if (ids.length === 0) {
  const users = await User.find({});
  for (const user of users) {
    user.balance = 0;
    user.minedTPC = 0;
    user.transactions = [];
    await user.save();
    console.log(`Reset TPC for ${user.telegramId || user.accountId}`);
  }
} else {
  // Otherwise, only reset the balances of the specified users. The arguments
  // may be a telegramId, accountId or nickname.
  for (const id of ids) {
    const query = { $or: [{ accountId: id }, { nickname: id }] };
    const asNumber = Number(id);
    if (!Number.isNaN(asNumber)) query.$or.push({ telegramId: asNumber });

    const user = await User.findOne(query);
    if (!user) {
      console.error(`User ${id} not found`);
      continue;
    }

    user.balance = 0;
    user.minedTPC = 0;
    user.transactions = [];
    await user.save();
    console.log(`Reset TPC for ${user.telegramId || user.accountId || user.nickname}`);
  }
}

await mongoose.disconnect();
