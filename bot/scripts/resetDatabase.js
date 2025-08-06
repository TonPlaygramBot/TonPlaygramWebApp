import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGODB_URI;
if (!uri || uri === 'memory') {
  console.error('MONGODB_URI must be set to a MongoDB instance');
  process.exit(1);
}

await mongoose.connect(uri);

try {
  await mongoose.connection.dropDatabase();
  console.log('Database dropped. All user balances reset to 0.');
} catch (err) {
  console.error('Failed to reset database:', err.message);
} finally {
  await mongoose.disconnect();
}
