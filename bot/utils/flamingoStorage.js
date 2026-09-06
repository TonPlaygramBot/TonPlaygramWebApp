import path from 'path';
import { createReadStream } from 'fs';
import { access, open, readdir, rename, rm, stat } from 'fs/promises';
import { pipeline } from 'node:stream/promises';
import mongoose from 'mongoose';
import { uploadExpiryMs } from './flamingoUploadStorage.js';

const BUCKET_NAME = 'flamingoMedia';
const activeDatabaseUploads = new Set();

export const flamingoStorageDirectories = (primaryDirectory, legacyDirectory) => (
  [...new Set([primaryDirectory, ...(Array.isArray(legacyDirectory) ? legacyDirectory : [legacyDirectory])]
    .filter(Boolean).map(directory => path.resolve(directory)))]
);

export const flamingoMediaName = url => {
  try {
    return path.basename(decodeURIComponent(new URL(String(url), 'https://wall.local').pathname));
  } catch {
    return path.basename(String(url || '').split(/[?#]/, 1)[0]);
  }
};

const database = () => mongoose.connection.readyState === 1 ? mongoose.connection.db : null;
const bucket = () => {
  const db = database();
  return db ? new mongoose.mongo.GridFSBucket(db, { bucketName: BUCKET_NAME }) : null;
};

export const flamingoDatabaseMediaQuery = (name, originalName, size) => {
  const safeName = path.basename(String(name || ''));
  if (!safeName) return null;
  const safeOriginalName = path.basename(String(originalName || ''));
  const expectedSize = Number(size);
  // The stable GridFS filename is authoritative. Some early post documents
  // recorded a rounded/partial size, which must not hide an exact stored file.
  // Size remains mandatory for an original-name alias so two phone uploads
  // named "video.mp4" cannot be confused during historical recovery.
  const exactFile = { filename: safeName };
  const alias = safeOriginalName
    ? { 'metadata.originalName': safeOriginalName, ...(Number.isSafeInteger(expectedSize) && expectedSize > 0 ? { length: expectedSize } : {}) }
    : null;
  return { $or: [exactFile, ...(alias ? [alias] : [])] };
};

export const findFlamingoDatabaseMedia = async (name, originalName, size, databaseFileId) => {
  const db = database();
  const query = flamingoDatabaseMediaQuery(name, originalName, size);
  if (!db) return null;
  if (databaseFileId && mongoose.isValidObjectId(databaseFileId)) {
    const exact = await db.collection(`${BUCKET_NAME}.files`).findOne({
      _id: new mongoose.Types.ObjectId(databaseFileId)
    });
    if (exact) return exact;
  }
  if (!query) return null;
  return db.collection(`${BUCKET_NAME}.files`).findOne(
    query,
    { sort: { uploadDate: -1 } }
  );
};

// The production wall stores media on its mounted persistent disk. GridFS is
// an opt-in migration/backup mode because enabling it implicitly can exhaust
// MongoDB storage and makes every deploy rescan irrecoverable legacy records.
export const flamingoDatabaseStorageEnabled = (value = process.env.FLAMINGO_GRIDFS_BACKUP) => (
  /^(1|true|yes|on)$/i.test(String(value ?? '').trim())
);

// Publishing the Mongo document before the media bytes are durably committed
// can leave a public post pointing at a truncated file after a host restart.
// Keep the final move atomic and fsync both the file and its directory before
// callers create the FlamingoPost record.
export const commitFlamingoMedia = async (pendingPath, finalPath, expectedSize) => {
  try {
    await access(finalPath);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    await rename(pendingPath, finalPath);
  }
  const file = await open(finalPath, 'r');
  try {
    const details = await file.stat();
    if (!details.isFile() || details.size !== Number(expectedSize)) {
      throw new Error('The stored media does not match the completed upload.');
    }
    await file.sync();
  } finally {
    await file.close();
  }
  const directory = await open(path.dirname(finalPath), 'r');
  try {
    await directory.sync();
  } finally {
    await directory.close();
  }
  return finalPath;
};

// GridFS keeps the original bytes in MongoDB in small chunks. The filename is
// the same stable key already stored in FlamingoPost, so old and new API URLs
// can resolve media without embedding multi-gigabyte data in a post document.
export const saveFlamingoMediaToDatabase = async (diskPath, name, metadata = {}) => {
  const mediaBucket = bucket();
  const safeName = path.basename(String(name || ''));
  if (!mediaBucket) throw new Error('Lidhja me databazën e videove nuk është gati.');
  const existing = await findFlamingoDatabaseMedia(safeName);
  if (existing?.length === metadata.size || (existing && metadata.size == null)) return existing;
  if (existing) await mediaBucket.delete(existing._id);
  const input = createReadStream(diskPath);
  const output = mediaBucket.openUploadStream(safeName, { metadata });
  activeDatabaseUploads.add(String(output.id));
  try {
    await writeFlamingoDatabaseStream(input, output, async () => {
      // abort() alone rejects when the final metadata insert failed. Bucket
      // deletion also clears chunks without a files document in that case.
      await output.abort().catch(() => {});
      await mediaBucket.delete(output.id).catch(error => {
        if (!/File not found for id/i.test(error.message)) throw error;
      });
    });
    return { _id: output.id, filename: safeName, length: output.length };
  } finally {
    activeDatabaseUploads.delete(String(output.id));
  }
};

export async function writeFlamingoDatabaseStream(input, output, cleanup) {
  try {
    await pipeline(input, output);
  } catch (error) {
    try { await cleanup(); } catch (cleanupError) {
      console.error('Flamingo failed-upload cleanup deferred:', cleanupError.message);
    }
    throw error;
  }
}

// Recover historical failed GridFS transfers. Finished files, recently written
// chunks, active transfers and explicitly referenced ids are always retained.
export async function pruneFlamingoOrphanChunks({
  db = database(), now = Date.now(), isReferenced = async () => true, dryRun = false
} = {}) {
  if (!db) return { uploads: 0, chunks: 0 };
  const cutoff = mongoose.Types.ObjectId.createFromTime(Math.floor((now - uploadExpiryMs) / 1000));
  const chunks = db.collection(`${BUCKET_NAME}.chunks`);
  const files = db.collection(`${BUCKET_NAME}.files`);
  const candidates = chunks.aggregate([
    { $match: { files_id: { $type: 'objectId', $lt: cutoff }, _id: { $type: 'objectId' } } },
    { $group: { _id: '$files_id', newest: { $max: '$_id' }, chunks: { $sum: 1 } } },
    { $match: { newest: { $lt: cutoff } } },
    { $lookup: { from: `${BUCKET_NAME}.files`, localField: '_id', foreignField: '_id', as: 'file' } },
    { $match: { file: { $size: 0 } } },
    { $limit: 100 }
  ]);
  const result = { uploads: 0, chunks: 0 };
  for await (const candidate of candidates) {
    const id = candidate._id;
    if (activeDatabaseUploads.has(String(id)) || await isReferenced(id) ||
      await chunks.findOne({ files_id: id, _id: { $gte: cutoff } }, { projection: { _id: 1 } }) ||
      await files.findOne({ _id: id }, { projection: { _id: 1 } })) continue;
    const removed = dryRun ? candidate.chunks : (await chunks.deleteMany({ files_id: id })).deletedCount;
    result.uploads += 1;
    result.chunks += removed;
  }
  return result;
}

export const openFlamingoDatabaseMedia = (file, options) => {
  const mediaBucket = bucket();
  return mediaBucket && file?._id ? mediaBucket.openDownloadStream(file._id, options) : null;
};

export const removeFlamingoDatabaseMedia = async name => {
  const mediaBucket = bucket();
  if (!mediaBucket) return;
  const file = await findFlamingoDatabaseMedia(name);
  if (file) await mediaBucket.delete(file._id);
};

export const pruneFlamingoDatabaseMediaCopies = async (directories, { force = false } = {}) => {
  const db = database();
  const mediaBucket = bucket();
  if (!db || !mediaBucket || (!force && flamingoDatabaseStorageEnabled())) return 0;
  const files = await db.collection(`${BUCKET_NAME}.files`).find({}, { projection: { filename: 1 } }).toArray();
  let removed = 0;
  for (const file of files) {
    if (!file?.filename || !await findFlamingoMedia(file.filename, directories)) continue;
    await mediaBucket.delete(file._id);
    removed += 1;
  }
  return removed;
};

export const findFlamingoMedia = async (name, directories, originalName, size) => {
  const safeName = path.basename(String(name || ''));
  const safeOriginalName = path.basename(String(originalName || ''));
  const expectedSize = Number(size);
  for (const directory of directories) {
    const candidate = path.join(directory, safeName);
    try {
      await access(candidate);
      return candidate;
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    // Before durable media storage was enabled, retrying an upload created a
    // new UUID while the post kept the older UUID. Reuse another byte-for-byte
    // upload of the same original file instead of leaving the historical post
    // permanently unplayable.
    if (safeOriginalName && Number.isSafeInteger(expectedSize) && expectedSize > 0) {
      try {
        const entries = await readdir(directory);
        for (const entry of entries) {
          if (entry !== safeOriginalName && !entry.endsWith(`-${safeOriginalName}`)) continue;
          const alias = path.join(directory, entry);
          if ((await stat(alias)).size === expectedSize) return alias;
        }
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
    }
  }
  return null;
};

export const removeFlamingoMedia = async (name, directories) => {
  const safeName = path.basename(String(name || ''));
  await Promise.all([
    ...directories.map(directory => rm(path.join(directory, safeName), { force: true })),
    removeFlamingoDatabaseMedia(safeName)
  ]);
};
