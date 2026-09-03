import '../loadEnv.js';
import mongoose from 'mongoose';
import FlamingoPost from '../models/FlamingoPost.js';
import { removeAntarKomitetiPosts } from '../utils/flamingoMaintenance.js';

const uri = process.env.MONGO_URI;
if (!uri || uri === 'memory') throw new Error('MONGO_URI must point to the target MongoDB database.');

await mongoose.connect(uri);
try {
  const deleted = await removeAntarKomitetiPosts(FlamingoPost);
  console.log(`Deleted ${deleted} post${deleted === 1 ? '' : 's'} by Antar komiteti.`);
} finally {
  await mongoose.disconnect();
}
