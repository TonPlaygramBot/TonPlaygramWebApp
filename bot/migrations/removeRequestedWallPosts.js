import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lstat, rm } from 'node:fs/promises';
import mongoose from 'mongoose';
import FlamingoPost from '../models/FlamingoPost.js';
import { flamingoStorageDirectories } from '../utils/flamingoStorage.js';

// User-requested removal, September 6, 2026. The author is a generic fallback
// label, so it must NEVER be used as a blanket deletion rule.
export const requestedWallPosts = [
  {
    id: '6a94689790f890313ad875e0',
    text: '',
    createdAt: '2026-08-30T17:29:59.517Z',
    name: '1000235334.mp4',
    size: 984233452,
    storedName: '3af84a3e-83ba-46a4-862e-7b254311ff6f-1000235334.mp4'
  },
  {
    id: '6a9422dbdd036aa24c413368',
    text: 'Dita 91',
    createdAt: '2026-08-30T12:32:27.310Z',
    name: '21635.mp4',
    size: 709881957,
    storedName: '55953f42-dee3-4b7b-aa02-b45114f0d123-21635.mp4'
  }
];
const author = 'Anëtar i komunitetit';
const url = (target) => `/api/flamingo-wall/files/${target.storedName}`;
export const requestedWallPostMatches = (post, target) =>
  Boolean(
    post &&
    String(post._id) === target.id &&
    post.author === author &&
    !post.authorAccountId &&
    post.source === 'community' &&
    post.text === target.text &&
    new Date(post.createdAt).getTime() ===
      new Date(target.createdAt).getTime() &&
    post.attachment?.url === url(target) &&
    post.attachment?.name === target.name &&
    post.attachment?.size === target.size
  );

const defaultDirectory = fileURLToPath(
  new URL('../data/flamingo-uploads', import.meta.url)
);
export async function removeRequestedWallPosts({
  apply = false,
  posts = FlamingoPost,
  db = mongoose.connection.db,
  directories = flamingoStorageDirectories(
    process.env.FLAMINGO_UPLOAD_DIR || defaultDirectory,
    [
      defaultDirectory,
      ...String(process.env.FLAMINGO_LEGACY_UPLOAD_DIRS || '').split(
        path.delimiter
      )
    ]
  ),
  removeDatabaseFile = (id) =>
    new mongoose.mongo.GridFSBucket(db, { bucketName: 'flamingoMedia' }).delete(
      id
    )
} = {}) {
  if (!db)
    throw new Error('The wall database must be connected before cleanup.');
  // Validate all existing records before any mutation, then use the same
  // conditions on deleteOne to reject edits that race this inspection.
  const records = await Promise.all(
    requestedWallPosts.map((target) => posts.findById(target.id).lean())
  );
  records.forEach((post, index) => {
    if (post && !requestedWallPostMatches(post, requestedWallPosts[index])) {
      throw new Error(
        `Wall cleanup stopped: post ${requestedWallPosts[index].id} changed since review.`
      );
    }
  });
  const result = {
    apply,
    deletedPosts: 0,
    deletedDiskFiles: 0,
    deletedDatabaseFiles: 0,
    recoveredDiskBytes: 0,
    targets: []
  };
  for (const [index, target] of requestedWallPosts.entries()) {
    const post = records[index];
    const report = {
      id: target.id,
      name: target.name,
      present: Boolean(post),
      sharedMedia: false
    };
    result.targets.push(report);
    if (apply && post) {
      const deletion = await posts.deleteOne({
        _id: target.id,
        author,
        authorAccountId: { $in: [null, ''] },
        source: 'community',
        text: target.text,
        createdAt: new Date(target.createdAt),
        'attachment.url': url(target),
        'attachment.name': target.name,
        'attachment.size': target.size
      });
      if (deletion.deletedCount !== 1)
        throw new Error(
          `Wall cleanup stopped: post ${target.id} changed during deletion.`
        );
      result.deletedPosts += 1;
    }
    const databaseFiles = await db
      .collection('flamingoMedia.files')
      .find({
        $or: [
          { filename: target.storedName },
          ...(post?.attachment?.databaseFileId
            ? [{ _id: post.attachment.databaseFileId }]
            : [])
        ]
      })
      .toArray();
    // Retain any media another post may use, including legacy filename aliases.
    const shared = await posts
      .findOne({
        _id: { $ne: target.id },
        $or: [
          ...[
            ...new Set([
              target.storedName,
              ...databaseFiles.map((file) => file.filename).filter(Boolean)
            ])
          ].map((name) => ({
            'attachment.url': {
              $regex: `/files/${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[?#]|$)`
            }
          })),
          { 'attachment.name': target.name, 'attachment.size': target.size },
          {
            'attachment.databaseFileId': {
              $in: databaseFiles.map((file) => file._id)
            }
          }
        ]
      })
      .lean();
    if (shared) {
      report.sharedMedia = true;
      continue;
    }
    if (!apply) continue;
    for (const directory of directories) {
      const filename = path.join(directory, target.storedName);
      try {
        const details = await lstat(filename);
        if (!details.isFile()) continue;
        await rm(filename);
        result.deletedDiskFiles += 1;
        result.recoveredDiskBytes += Math.min(
          details.size,
          details.blocks * 512
        );
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
    for (const file of databaseFiles) {
      await removeDatabaseFile(file._id);
      result.deletedDatabaseFiles += 1;
    }
  }
  return result;
}
