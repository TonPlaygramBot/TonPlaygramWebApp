import '../loadEnv.js';
import mongoose from 'mongoose';
import FlamingoPost from '../models/FlamingoPost.js';

const uri = process.env.MONGO_URI;
if (!uri || uri === 'memory') throw new Error('MONGO_URI must point to the target MongoDB database.');

await mongoose.connect(uri);
try {
  const posts = await FlamingoPost.find({ author: { $regex: /^Antar komiteti$/i } })
    .sort({ createdAt: -1 }).limit(2).select('_id author createdAt').lean();
  if (posts.length !== 2) throw new Error(`Expected exactly 2 matching posts, found ${posts.length}; nothing was deleted.`);
  const result = await FlamingoPost.deleteMany({ _id: { $in: posts.map(post => post._id) } });
  console.log(`Deleted ${result.deletedCount} posts by Antar komiteti: ${posts.map(post => post._id).join(', ')}`);
} finally {
  await mongoose.disconnect();
}
