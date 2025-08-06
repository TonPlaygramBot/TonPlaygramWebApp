import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

// Reset all user balances and transactions while keeping the database structure.
// Also clears other collections so the database starts empty for production.

dotenv.config();

const uri = process.env.MONGODB_URI;
if (!uri || uri === 'memory') {
  console.error('MONGODB_URI must be set to a MongoDB instance');
  process.exit(1);
}

await mongoose.connect(uri);

try {
  // Reset balances and transactions for all users
  await User.updateMany({}, {
    $set: { balance: 0, minedTPC: 0, transactions: [] }
  });

  // Remove documents from all other collections while keeping their structure
  const collections = await mongoose.connection.db.collections();
  for (const collection of collections) {
    if (collection.collectionName !== 'users') {
      await collection.deleteMany({});
    }
  }

  console.log('Database cleaned. All user balances and transactions reset to 0.');
} catch (err) {
  console.error('Failed to reset database:', err.message);
} finally {
  await mongoose.disconnect();
}

