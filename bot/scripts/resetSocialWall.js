import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { rm } from 'fs/promises';
import FlamingoPost from '../models/FlamingoPost.js';
import { flamingoMediaName, removeFlamingoDatabaseMedia } from '../utils/flamingoStorage.js';

dotenv.config();
const uri = process.env.MONGO_URI;
if (!uri || uri === 'memory') throw new Error('MONGO_URI must point to the production MongoDB instance.');
const cutoff = process.env.SOCIAL_WALL_CUTOFF ? new Date(process.env.SOCIAL_WALL_CUTOFF) : new Date();
cutoff.setUTCHours(0, 0, 0, 0);
if (Number.isNaN(cutoff.getTime())) throw new Error('SOCIAL_WALL_CUTOFF must be a valid ISO date.');

await mongoose.connect(uri);
try {
  const posts = await FlamingoPost.find({ createdAt: { $lt: cutoff } }).select('attachment').lean();
  for (const post of posts) {
    const name = flamingoMediaName(post.attachment?.url);
    if (!name) continue;
    await removeFlamingoDatabaseMedia(name);
    const directory = path.resolve(process.env.FLAMINGO_UPLOAD_DIR || new URL('../data/flamingo-uploads', import.meta.url).pathname);
    await rm(path.join(directory, name), { force: true });
  }
  const result = await FlamingoPost.deleteMany({ createdAt: { $lt: cutoff } });
  console.log(`Social wall reset at ${cutoff.toISOString()}: removed ${result.deletedCount} old posts and their media.`);
} finally {
  await mongoose.disconnect();
}
