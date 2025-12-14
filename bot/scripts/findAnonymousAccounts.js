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

const anonymousQuery = {
  telegramId: { $exists: false },
  googleId: { $exists: false },
  nickname: { $in: [null, ''] },
  firstName: { $in: [null, ''] },
  lastName: { $in: [null, ''] }
};

const totalAnonymous = await User.countDocuments(anonymousQuery);
console.log(`Accounts without identity information: ${totalAnonymous}`);

const dailyBreakdown = await User.aggregate([
  { $match: anonymousQuery },
  {
    $group: {
      _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
      count: { $sum: 1 }
    }
  },
  { $sort: { _id: 1 } }
]);

if (dailyBreakdown.length) {
  console.log('\nDaily creation breakdown for anonymous accounts:');
  for (const day of dailyBreakdown) {
    console.log(`${day._id}: ${day.count}`);
  }
}

const sample = await User.find(anonymousQuery)
  .sort({ createdAt: -1 })
  .limit(20)
  .select('accountId createdAt balance walletAddress');

if (sample.length) {
  console.log('\nLatest anonymous accounts:');
  for (const user of sample) {
    console.log(
      `${user.accountId} | created ${user.createdAt?.toISOString?.()} | balance ${user.balance ?? 0}`
    );
  }
}

await mongoose.disconnect();
