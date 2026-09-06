import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { rm } from 'fs/promises';
import FlamingoPost from '../models/FlamingoPost.js';
import { flamingoMediaName, removeFlamingoDatabaseMedia } from '../utils/flamingoStorage.js';
import { mongoConnectionOptions } from '../config/mongo.js';

dotenv.config();
const uri = process.env.MONGO_URI;
if (!uri || uri === 'memory') throw new Error('MONGO_URI must point to the production MongoDB instance.');
const cutoff = process.env.SOCIAL_WALL_CUTOFF ? new Date(process.env.SOCIAL_WALL_CUTOFF) : null;
if (cutoff && Number.isNaN(cutoff.getTime())) throw new Error('SOCIAL_WALL_CUTOFF must be a valid ISO date.');
const postQuery = cutoff ? { createdAt: { $lt: cutoff } } : {};

await mongoose.connect(uri, mongoConnectionOptions());
try {
  const posts = await FlamingoPost.find(postQuery).select('attachment').lean();
  for (const post of posts) {
    const name = flamingoMediaName(post.attachment?.url);
    if (!name) continue;
    await removeFlamingoDatabaseMedia(name);
    const directory = path.resolve(process.env.FLAMINGO_UPLOAD_DIR || new URL('../data/flamingo-uploads', import.meta.url).pathname);
    await rm(path.join(directory, name), { force: true });
  }
  const result = await FlamingoPost.deleteMany(postQuery);
  console.log(`Social wall reset${cutoff ? ` before ${cutoff.toISOString()}` : ''}: removed ${result.deletedCount} posts and their media.`);

  // Deleting documents frees reusable space inside MongoDB. Ask self-hosted
  // deployments to return that space to the host as well; managed services
  // may reject compact, so a completed reset must not fail on that limitation.
  if (!/^(0|false|no|off)$/i.test(String(process.env.SOCIAL_WALL_COMPACT ?? '').trim())) {
    for (const collection of [FlamingoPost.collection.collectionName, 'flamingoMedia.files', 'flamingoMedia.chunks']) {
      try {
        await mongoose.connection.db.command({ compact: collection });
      } catch (error) {
        console.warn(`MongoDB compact skipped for ${collection}: ${error.message}`);
      }
    }
  }
} finally {
  await mongoose.disconnect();
}
