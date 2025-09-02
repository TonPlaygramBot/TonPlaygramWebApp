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

const result = await User.deleteMany({
  telegramId: { $exists: false },
  balance: { $lte: 0 },
  $or: [
    { nickname: { $in: [null, '', 'user'] } },
    { firstName: { $in: [null, '', 'user'] }, lastName: { $in: [null, '', 'user'] } }
  ]
});

console.log(`Removed ${result.deletedCount} anonymous accounts`);

await mongoose.disconnect();
