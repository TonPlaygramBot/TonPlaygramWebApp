import path from 'path';
import { createReadStream } from 'fs';
import { access, open, readdir, rename, rm, stat } from 'fs/promises';
import mongoose from 'mongoose';

const BUCKET_NAME = 'flamingoMedia';

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

export const findFlamingoDatabaseMedia = async (name, originalName, size) => {
  const db = database();
  const query = flamingoDatabaseMediaQuery(name, originalName, size);
  if (!db || !query) return null;
  return db.collection(`${BUCKET_NAME}.files`).findOne(
    query,
    { sort: { uploadDate: -1 } }
  );
};

// GridFS is enabled by default so a deployment or disk replacement cannot
// detach a wall post from its photo/video. Operators with a separately backed
// up permanent volume may explicitly opt out, but an unset value must preserve
// user media in the same MongoDB deployment as the FlamingoPost document.
export const flamingoDatabaseStorageEnabled = (value = process.env.FLAMINGO_GRIDFS_BACKUP) => (
  !/^(0|false|no|off)$/i.test(String(value ?? '').trim())
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
  return new Promise((resolve, reject) => {
    const input = createReadStream(diskPath);
    const output = mediaBucket.openUploadStream(safeName, { metadata });
    input.on('error', reject);
    output.on('error', reject);
    output.on('finish', () => resolve({ _id: output.id, filename: safeName, length: output.length }));
    input.pipe(output);
  });
};

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
