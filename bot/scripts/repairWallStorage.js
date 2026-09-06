import '../loadEnv.js';
import mongoose from 'mongoose';
import { mongoConnectionOptions } from '../config/mongo.js';
import { removeRequestedWallPosts } from '../migrations/removeRequestedWallPosts.js';
import {
  inspectFlamingoWallStorage,
  recoverFlamingoWallStorage
} from '../routes/flamingoWall.js';
import {
  flamingoDatabaseStorageEnabled,
  pruneFlamingoOrphanChunks
} from '../utils/flamingoStorage.js';
import FlamingoPost from '../models/FlamingoPost.js';

// Inspection is the default. --apply deletes only the two reviewed post ids
// and runs the same expired-upload recovery used by the API.
const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--apply'))
  throw new Error('Usage: node scripts/repairWallStorage.js [--apply]');
const uri = process.env.MONGO_URI;
if (!uri || uri === 'memory') throw new Error('A real MONGO_URI is required.');
await mongoose.connect(uri, mongoConnectionOptions());
try {
  const stats = await mongoose.connection.db.command({ dbStats: 1 });
  console.log(
    JSON.stringify(
      {
        disk: await inspectFlamingoWallStorage(),
        gridfsBackup: flamingoDatabaseStorageEnabled(),
        database: {
          dataBytes: stats.dataSize,
          allocatedBytes: stats.storageSize,
          indexBytes: stats.indexSize
        },
        expiredOrphanChunks: await pruneFlamingoOrphanChunks({
          dryRun: true,
          isReferenced: (id) =>
            FlamingoPost.exists({ 'attachment.databaseFileId': id })
        })
      },
      null,
      2
    )
  );
  console.log(
    JSON.stringify(
      await removeRequestedWallPosts({ apply: args.includes('--apply') }),
      null,
      2
    )
  );
  if (args.includes('--apply'))
    console.log(
      JSON.stringify(await recoverFlamingoWallStorage(true), null, 2)
    );
} finally {
  await mongoose.disconnect();
}
