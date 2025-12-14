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

const devAccountIds = [
  process.env.DEV_ACCOUNT_ID,
  process.env.VITE_DEV_ACCOUNT_ID,
  process.env.DEV_ACCOUNT_ID_1,
  process.env.VITE_DEV_ACCOUNT_ID_1,
  process.env.DEV_ACCOUNT_ID_2,
  process.env.VITE_DEV_ACCOUNT_ID_2
].filter(Boolean);

const ids = process.argv.slice(2);

function isDevAccount(user) {
  return user?.accountId && devAccountIds.includes(user.accountId);
}

async function reportSuspiciousAccounts() {
  const suspicious = await User.find({
    $and: [
      { $or: [{ telegramId: { $exists: false } }, { telegramId: null }] },
      { $or: [{ googleId: { $exists: false } }, { googleId: null }, { googleId: '' }] },
      { $or: [{ walletAddress: { $exists: false } }, { walletAddress: null }, { walletAddress: '' }] },
      { $or: [{ nickname: { $exists: false } }, { nickname: null }, { nickname: '' }] },
      { $or: [{ firstName: { $exists: false } }, { firstName: null }, { firstName: '' }] }
    ]
  });

  if (!suspicious.length) {
    console.log('No suspicious accounts without usernames or identifiers detected.');
    return;
  }

  console.log(
    `Suspicious accounts without usernames or identifiers detected: ${suspicious.length}`
  );

  const sample = suspicious.slice(0, 20);
  for (const user of sample) {
    console.log(
      ` - accountId=${user.accountId || 'unknown'} | createdAt=${user.createdAt?.toISOString()}`
    );
  }

  if (suspicious.length > sample.length) {
    console.log(
      ` ...and ${suspicious.length - sample.length} more without usernames or linked accounts.`
    );
  }
}

// If no identifiers are provided, reset every user's TPC balance just like
// the original behaviour of this script.
if (ids.length === 0) {
  const query = devAccountIds.length ? { accountId: { $nin: devAccountIds } } : {};
  const users = await User.find(query);
  let resetCount = 0;
  for (const user of users) {
    if (isDevAccount(user)) continue;
    user.balance = 0;
    user.minedTPC = 0;
    user.transactions = [];
    await user.save();
    resetCount += 1;
    console.log(`Reset TPC for ${user.telegramId || user.accountId}`);
  }

  console.log(`Reset ${resetCount} accounts. Skipped ${devAccountIds.length} dev account(s).`);
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

    if (isDevAccount(user)) {
      console.log(`Skipped dev account ${user.accountId}`);
      continue;
    }

    user.balance = 0;
    user.minedTPC = 0;
    user.transactions = [];
    await user.save();
    console.log(`Reset TPC for ${user.telegramId || user.accountId || user.nickname}`);
  }
}

await reportSuspiciousAccounts();

await mongoose.disconnect();
