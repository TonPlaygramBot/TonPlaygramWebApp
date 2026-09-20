import Busboy from 'busboy';
import { receiveNativeWallFile } from '../utils/flamingoNativeUpload.js';
import express from 'express';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { constants as fsConstants, createWriteStream } from 'fs';
import { access, mkdir, readFile, rename, rm, truncate, writeFile } from 'fs/promises';
import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import { EventEmitter } from 'events';
import { pipeline } from 'stream/promises';
import { Readable, Transform } from 'stream';
import mongoose from 'mongoose';
import FlamingoPost from '../models/FlamingoPost.js';
import User from '../models/User.js';
import { optionalAuthenticate } from '../middleware/auth.js';
import { mediaType } from '../utils/mediaType.js';
import { setFlamingoMediaResponseHeaders } from '../utils/flamingoMediaResponse.js';
import { commitFlamingoMedia, findFlamingoDatabaseMedia, findFlamingoMedia, flamingoDatabaseStorageEnabled, flamingoMediaName, flamingoStorageDirectories, openFlamingoDatabaseMedia, pruneFlamingoOrphanChunks, removeFlamingoMedia, saveFlamingoMediaToDatabase } from '../utils/flamingoStorage.js';
import { assertFlamingoDurability, flamingoUploadDirectory, flamingoLocalDirectory, inspectFlamingoDurability } from '../utils/flamingoDurability.js';
import { objectStorageEnabled, flamingoObjectStorage, objectAttachment } from '../utils/flamingoObjectStorage.js';
import { objectUploads } from '../services/flamingoObjectUploads.js';
import { createFlamingoUploadStorage, validFlamingoUploadId } from '../utils/flamingoUploadStorage.js';
import { flamingoUploadFailure } from '../utils/flamingoUploadErrors.js';
import { wallMediaPostQuery } from '../utils/flamingoPostLookup.js';
import { createFlamingoDownloadGrant, readFlamingoDownloadGrant } from '../utils/flamingoDownloadGrant.js';
import { decodeFlamingoWallCursor, encodeFlamingoWallCursor, flamingoWallCursorQuery, flamingoWallPageSize } from '../utils/flamingoWallPagination.js';
import { createVideoRenditions, probeVideo, videoSourceKey } from '../services/flamingoVideoRenditions.js';

const router = express.Router();
// Render starts the API from `bot/`, while local tools and tests may start it
// from the repository root. Local defaults resolve beside the bot; Render
// defaults to the configured persistent mount instead of the application tree.
const uploadDirectory = flamingoUploadDirectory();
// Keep reading the original application-local directory after production is
// switched to a persistent disk. Existing database records still point at
// those file names, so checking both locations prevents a storage migration
// from turning every earlier wall video into a 404.
const mediaDirectories = flamingoStorageDirectories(
  uploadDirectory,
  [
    // This is the location used by the wall before persistent storage was
    // enabled. Keep it readable so morning uploads continue to work.
    flamingoLocalDirectory,
    // Allow an old Render disk/snapshot to be mounted read-only during a
    // migration without changing where current uploads are written.
    ...String(process.env.FLAMINGO_LEGACY_UPLOAD_DIRS || '').split(path.delimiter)
  ]
);
const maxBytes = Math.max(1, Number(process.env.FLAMINGO_UPLOAD_MAX_BYTES) || 5 * 1024 ** 3);
// Keep every request below the timeout window of mobile WebViews and hosting
// proxies. An 8 MB chunk routinely took longer than two minutes on a weak
// cellular uplink, so the browser aborted it and only reported an interrupted
// connection. Resumability makes small chunks cheap: only the current 1 MB
// range has to be retried when reception drops.
const maxChunkBytes = Math.max(1024 ** 2, Number(process.env.FLAMINGO_UPLOAD_CHUNK_BYTES) || 1024 ** 2);
const pendingDirectory = path.join(uploadDirectory, '.pending');
const uploadLocks = new Map();
const mediaBackfills = new Map();
const wallEvents = new EventEmitter();
wallEvents.setMaxListeners(0);
const publishWallEvent = (action, postId) => {
  wallEvents.emit('change', { action, postId, at: Date.now() });
  // Publication stays fast; common playback copies are prepared afterwards.
  if (['created', 'updated'].includes(action)) {
    setImmediate(() => {
      if (mongoose.connection.readyState !== 1) return;
      void FlamingoPost.findById(postId).lean()
        .then(post => videoRenditions.warm(normalizedPost(post)))
        .catch(error => console.warn('Video preparation scheduling:', error.message));
    });
  }
};

router.use(optionalAuthenticate);

const safeName = (name) => path.basename(String(name || 'file'))
  .normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-160) || 'file';

export const publicWallAvatar = value => /https?:\/\/api\.telegram\.org\/file\/bot[^/]+\//i.test(String(value || '')) ? '' : value;
const normalizedPost = post => post ? {
  ...post,
  ...(post.authorAvatar ? { authorAvatar: publicWallAvatar(post.authorAvatar) } : {}),
  ...(post.attachment ? { attachment: { ...post.attachment, type: mediaType(post.attachment.type, post.attachment.name) } } : {})
} : post;

const decodeHeader = (value, fallback = '') => {
  try { return decodeURIComponent(String(value || fallback)); } catch { return fallback; }
};

const sessionPaths = (id) => ({
  data: path.join(pendingDirectory, `${id}.part`),
  native: path.join(pendingDirectory, `${id}.native`),
  meta: path.join(pendingDirectory, `${id}.json`)
});
const tokenHash = token => createHash('sha256').update(String(token || '')).digest('hex');
const ownerToken = req => req.get('x-wall-owner-token') || '';
const userSelector = req => req.auth?.accountId
  ? { accountId: req.auth.accountId }
  : req.auth?.telegramId
    ? { telegramId: req.auth.telegramId }
    : req.auth?.googleId ? { googleId: req.auth.googleId } : null;
const displayName = user => user?.nickname || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Community member';
const resolveUser = req => {
  const selector = userSelector(req);
  return selector ? User.findOne(selector) : null;
};
const withUploadLock = (id, task) => {
  const previous = uploadLocks.get(id) || Promise.resolve();
  const current = previous.catch(() => {}).then(task);
  uploadLocks.set(id, current);
  return current.finally(() => { if (uploadLocks.get(id) === current) uploadLocks.delete(id); });
};
const uploadStorage = createFlamingoUploadStorage({
  directory: uploadDirectory,
  isBusy: id => [...uploadLocks.keys()].some(key => key === id || key.startsWith(`${id}:`)),
  withLock: withUploadLock,
  isPublished: async (id, metadata) => {
    if (mongoose.connection.readyState !== 1) return true;
    return Boolean(await FlamingoPost.exists({ $or: [
      { 'attachment.url': new RegExp(`/files/${id}-`) },
      { 'attachment.name': metadata.name, 'attachment.size': metadata.size }
    ] }));
  }
});
export const inspectFlamingoWallStorage = async () => objectStorageEnabled()
  ? flamingoObjectStorage().health()
  : ({ ...await uploadStorage.inspect(), provider: 'disk', durability: await inspectFlamingoDurability(uploadDirectory) });
let storageRecovery;
let lastStorageRecovery = 0;
export const recoverFlamingoWallStorage = (force = false) => {
  if (storageRecovery) return storageRecovery;
  if (!force && Date.now() - lastStorageRecovery < 10 * 60 * 1000) return Promise.resolve();
  storageRecovery = (async () => {
    // A missing/full Render upload directory must not block object uploads.
    const disk = objectStorageEnabled() ? { removed: 0, recoveredBytes: 0 }
      : await withUploadLock('$storage', () => uploadStorage.sweep());
    if (objectStorageEnabled()) await objectUploads.recover({
      isBusy: id => uploadLocks.has(id), withLock: withUploadLock,
      referenced: key => FlamingoPost.exists({ 'attachment.objectKey': key })
    });
    const database = await pruneFlamingoOrphanChunks({
      isReferenced: id => FlamingoPost.exists({ 'attachment.databaseFileId': id })
    });
    lastStorageRecovery = Date.now();
    if (disk.removed || database.uploads) console.log('Flamingo expired upload cleanup:', { disk, database });
    return { disk, database };
  })().finally(() => { storageRecovery = undefined; });
  return storageRecovery;
};
export const startFlamingoWallMaintenance = () => {
  const recover = () => {
    void recoverFlamingoWallStorage(true).catch(error => console.error('Flamingo storage recovery failed:', error.message));
    // Rendition cleanup must never lengthen an upload's admission request.
    if (mongoose.connection.readyState === 1) void (async () => {
      await videoRenditions.sweep();
      await warmRecentFlamingoVideos();
    })().catch(error => console.warn('Video cache maintenance:', error.message));
  };
  void recover();
  const timer = setInterval(recover, 10 * 60 * 1000);
  timer.unref();
  return () => clearInterval(timer);
};
const videoPrice = duration => duration > 40 ? 300 : duration >= 20 ? 200 : 0;
const premiumPrice = value => Math.min(1_000_000, Math.max(0, Math.floor(Number(value) || 0)));
export const attachmentDownloadPrice = attachment => {
  const type = mediaType(attachment?.type, attachment?.name);
  return attachment?.premium ? premiumPrice(attachment.priceTpg) : type.startsWith('video/') ? videoPrice(attachment?.duration) : 0;
};

// Mobile browsers depend on byte ranges to read video metadata and to seek.
// Keep this parser independent from Express so both playback and download
// endpoints apply identical RFC 7233 single-range behavior.
export const mediaByteRange = (header, length) => {
  const value = String(header || '').trim();
  if (!value) return null;
  const match = value.match(/^bytes=(\d*)-(\d*)$/i);
  if (!match || (!match[1] && !match[2]) || !Number.isSafeInteger(length) || length < 1) return false;
  let start;
  let end;
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength < 1) return false;
    start = Math.max(0, length - suffixLength);
    end = length - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Math.min(Number(match[2]), length - 1) : length - 1;
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= length || end < start) return false;
  return { start, end };
};

const streamDatabaseMedia = (req, res, databaseFile) => {
  setFlamingoMediaResponseHeaders(res);
  const range = mediaByteRange(req.get('range'), databaseFile.length);
  if (range === false) {
    res.setHeader('Content-Range', `bytes */${databaseFile.length}`);
    return res.status(416).end();
  }
  const { start, end } = range || { start: 0, end: databaseFile.length - 1 };
  if (range) res.status(206).setHeader('Content-Range', `bytes ${start}-${end}/${databaseFile.length}`);
  res.setHeader('Content-Length', end - start + 1);
  const stream = openFlamingoDatabaseMedia(databaseFile, { start, end: end + 1 });
  if (!stream) return res.status(404).end();
  stream.on('error', () => { if (!res.headersSent) res.status(404).end(); else res.destroy(); });
  stream.pipe(res);
};

// Lazily migrate a legacy disk-only upload without delaying playback. A
// single promise per filename prevents several phone range requests from
// uploading the same large video to GridFS concurrently.
const backfillDatabaseMedia = (diskPath, name, attachment = {}) => {
  if (!flamingoDatabaseStorageEnabled() || !diskPath || mongoose.connection.readyState !== 1 || mediaBackfills.has(name)) return;
  const task = saveFlamingoMediaToDatabase(diskPath, name, {
    contentType: mediaType(attachment.type, attachment.name || name),
    originalName: attachment.name || name,
    size: attachment.size
  }).catch(error => {
    console.error(`Flamingo media backfill failed for ${name}:`, error.message);
  }).finally(() => mediaBackfills.delete(name));
  mediaBackfills.set(name, task);
};

// Copy every legacy attachment that is still present on a mounted disk into
// GridFS as soon as MongoDB connects. Waiting for a browser to request each
// file leaves yesterday's uploads exposed to the next ephemeral-disk restart,
// especially for posts that are below the first screen of the mobile feed.
// The migration is idempotent because GridFS is queried before each copy.
export const backfillFlamingoWallMedia = async () => {
  if (!flamingoDatabaseStorageEnabled() || mongoose.connection.readyState !== 1) {
    return { copied: 0, missing: 0, failed: 0 };
  }
  const posts = await FlamingoPost.find({ 'attachment.url': { $exists: true, $ne: '' } })
    .select('attachment')
    .sort({ createdAt: 1 })
    .lean();
  const result = { copied: 0, missing: 0, failed: 0 };
  for (const post of posts) {
    const attachment = post.attachment;
    const name = flamingoMediaName(attachment?.url);
    if (!name) continue;
    try {
      const existing = await findFlamingoDatabaseMedia(name, attachment?.name, attachment?.size, attachment?.databaseFileId);
      if (existing) {
        if (String(attachment?.databaseFileId || '') !== String(existing._id)) {
          await FlamingoPost.updateOne({ _id: post._id }, { $set: { 'attachment.databaseFileId': existing._id } });
        }
        continue;
      }
      const diskPath = await findFlamingoMedia(name, mediaDirectories, attachment?.name, attachment?.size);
      if (!diskPath) {
        result.missing += 1;
        continue;
      }
      const stored = await saveFlamingoMediaToDatabase(diskPath, name, {
        contentType: mediaType(attachment?.type, attachment?.name || name),
        originalName: attachment?.name || name,
        size: attachment?.size
      });
      await FlamingoPost.updateOne({ _id: post._id }, { $set: { 'attachment.databaseFileId': stored._id } });
      result.copied += 1;
    } catch (error) {
      result.failed += 1;
      console.error(`Flamingo startup media backup failed for ${name}:`, error.message);
    }
  }
  return result;
};
// The persistent disk holds the original. When GridFS backup is explicitly
// enabled, finish that backup before publishing the public record as well.
const persistDatabaseMedia = async (diskPath, storedName, metadata) => {
  if (!flamingoDatabaseStorageEnabled()) {
    // A local copy may be ephemeral. Never delete an existing durable backup
    // merely because a new post is being published with backup disabled.
    return null;
  }
  return saveFlamingoMediaToDatabase(diskPath, storedName, metadata);
};
const sendUploadFailure = (res, error) => {
  const { status, ...payload } = flamingoUploadFailure(error);
  if (status >= 500) console.error('Flamingo upload failed:', payload.code || status, error.message);
  if (!res.headersSent && !res.destroyed) res.status(status).json(payload);
};
const ownsPost = (post, token) => {
  if (!post.ownerTokenHash || !token) return false;
  const supplied = Buffer.from(tokenHash(token));
  const stored = Buffer.from(post.ownerTokenHash);
  return supplied.length === stored.length && timingSafeEqual(supplied, stored);
};
const locatePostMedia = async (post, { aliases = true } = {}) => {
  const attachment = post?.attachment;
  if (!attachment?.url) return null;
  if (attachment.objectKey) {
    const object = await flamingoObjectStorage().head(attachment.objectKey, attachment.objectBucket);
    return object ? { object } : null;
  }
  const name = flamingoMediaName(attachment.url);
  const originalName = aliases ? attachment.name : undefined;
  const databaseFile = await findFlamingoDatabaseMedia(name, originalName, attachment.size, attachment.databaseFileId);
  if (databaseFile) return { databaseFile };
  const diskPath = await findFlamingoMedia(name, mediaDirectories, originalName, attachment.size);
  return diskPath ? { diskPath } : null;
};
export const videoRenditions = createVideoRenditions({
  directory: uploadDirectory,
  getPost: id => FlamingoPost.findById(id).lean(),
  inspectSpace: () => uploadStorage.inspect(),
  getSource: async (post, folder, signal) => {
    const attachment = post.attachment;
    const name = flamingoMediaName(attachment.url);
    const diskPath = !attachment.objectKey && await findFlamingoMedia(name, mediaDirectories, attachment.name, attachment.size);
    if (diskPath) return { diskPath };
    // Serialize large legacy source copies. The next worker checks capacity
    // after the previous copy occupies disk, rather than both reserving the
    // same free bytes. Encodes still run independently of metadata probes.
    return withUploadLock('$video-source', async () => {
      signal.throwIfAborted();
      await uploadStorage.assertCapacity(attachment.size + 512 * 1024 ** 2);
      const temporary = path.join(folder, `source-${randomUUID()}.partial`);
      const cleanup = () => rm(temporary, { force: true });
      try {
        let input;
        if (attachment.objectKey) {
          const url = await flamingoObjectStorage().readUrl(attachment.objectKey, attachment.objectBucket);
          const response = await fetch(url, { signal });
          if (!response.ok || !response.body) throw Object.assign(new Error('The original video is unavailable.'), { status: 404 });
          input = Readable.fromWeb(response.body);
        } else {
          const stored = await findFlamingoDatabaseMedia(name, attachment.name, attachment.size, attachment.databaseFileId);
          if (stored) input = openFlamingoDatabaseMedia(stored);
        }
        if (!input) throw Object.assign(new Error('The original video is unavailable.'), { status: 404 });
        let copied = 0;
        const bounded = new Transform({ transform(chunk, _encoding, done) {
          copied += chunk.length;
          if (copied > attachment.size + 1024 ** 2) done(new Error('Unexpected source video size.'));
          else done(null, chunk);
        } });
        await pipeline(input, bounded, createWriteStream(temporary), { signal });
        return { diskPath: temporary, cleanup };
      } catch (error) { await cleanup(); throw error; }
    });
  }
});
let warmingRecent;
export const warmRecentFlamingoVideos = () => {
  if (warmingRecent) return warmingRecent;
  warmingRecent = (async () => {
    const posts = await FlamingoPost.find({ 'attachment.type': /^video\// })
      .sort({ createdAt: -1 }).limit(20).select('attachment').lean();
    for (const post of posts) await videoRenditions.warm(post);
  })().finally(() => { warmingRecent = undefined; });
  return warmingRecent;
};
const videoConversionLimit = rateLimit({
  windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false,
  // Requests pass through Render; use the authenticated viewer where known.
  keyGenerator: req => String(req.auth?.accountId || req.auth?.telegramId || req.ip),
  validate: { xForwardedForHeader: false },
  message: { error: 'Please wait a moment before preparing more resolutions.' }
});
const videoPost = async id => {
  if (!mongoose.isValidObjectId(id)) throw Object.assign(new Error('Invalid video.'), { status: 400 });
  const post = await FlamingoPost.findById(id).lean();
  if (!post?.attachment || !mediaType(post.attachment.type, post.attachment.name).startsWith('video/'))
    throw Object.assign(new Error('Video not found.'), { status: 404 });
  return post;
};
const videoFailure = (res, error) => res.status(error.status || 503).json({ error: error.status ? error.message : 'Video resolutions are temporarily unavailable. The original can still be used.' });
router.get('/posts/:id/video-qualities', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try { res.json(await videoRenditions.status(await videoPost(req.params.id))); }
  catch (error) { videoFailure(res, error); }
});
router.post('/posts/:id/video-qualities', videoConversionLimit, express.json({ limit: '1kb' }), async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try { res.status(202).json(await videoRenditions.request(await videoPost(req.params.id), req.body?.quality)); }
  catch (error) { videoFailure(res, error); }
});
router.get('/posts/:id/video/:quality', async (req, res) => {
  try {
    const post = await videoPost(req.params.id);
    if (req.query.download === '1') return res.status(403).json({ error: 'Use the download button to choose a resolution and confirm any TPG price.' });
    if (req.query.v && req.query.v !== videoSourceKey(post)) return res.status(410).json({ error: 'This video was replaced. Refresh the wall.' });
    const rendition = await videoRenditions.file(post, req.params.quality);
    if (!rendition) return res.status(404).json({ error: 'This resolution is not ready yet.' });
    setFlamingoMediaResponseHeaders(res);
    res.type('video/mp4').setHeader('Cache-Control', 'public, max-age=3600');
    res.sendFile(rendition.diskPath, error => { if (error && !res.headersSent) res.status(error.statusCode || 404).end(); });
  } catch (error) { videoFailure(res, error); }
});
const restoreTarget = async (id, req, size) => {
  if (!mongoose.isValidObjectId(id)) throw Object.assign(new Error('Invalid post.'), { status: 400 });
  const post = await FlamingoPost.findById(id).select('+ownerTokenHash').lean();
  if (!post?.attachment) throw Object.assign(new Error('The post is no longer available.'), { status: 404 });
  if (!ownsPost(post, ownerToken(req))) throw Object.assign(new Error('Only the author can restore this media.'), { status: 403 });
  if (post.attachment.size !== size) throw Object.assign(new Error('Choose the original file shown on this post. Its size must match.'), { status: 409 });
  return post;
};

// Database records are the source of truth for the public wall. In particular,
// do not hide or delete posts based on their author: a read request must never
// mutate content that a community member has already published.
export const serializeWallPosts = (posts, token = '') => posts.map(({ ownerTokenHash, ...post }) => (
  normalizedPost({ ...post, canManage: ownsPost({ ownerTokenHash }, token) })
));

export const latestWallPost = post => normalizedPost(post || null);

// Each manifest describes acknowledged byte ranges, so retrying on a phone
// resumes the same file instead of sending gigabytes from the beginning.
const validUploadId = validFlamingoUploadId;
const writeUploadMetadata = async (paths, metadata) => {
  const temporary = `${paths.meta}.${randomUUID()}.tmp`;
  metadata.updatedAt = Date.now();
  try {
    await writeFile(temporary, JSON.stringify(metadata));
    await rename(temporary, paths.meta);
  } finally {
    await rm(temporary, { force: true });
  }
};
const uploadResponse = metadata => ({
  uploadId: metadata.id,
  nativeFileUpload: true,
  chunkBytes: metadata.chunkBytes || maxChunkBytes,
  receivedOffsets: Object.keys(metadata.chunks || {}).map(Number),
  received: metadata.received
});
const assertUploadOwner = (metadata, req) => {
  if (!ownerToken(req) || metadata.ownerTokenHash !== tokenHash(ownerToken(req))) {
    throw Object.assign(new Error('This upload belongs to another session.'), { status: 403 });
  }
};
router.post('/uploads', express.json({ limit: '64kb' }), async (req, res) => {
  const size = Number(req.body?.size ?? req.get('x-upload-size'));
  if (!Number.isSafeInteger(size) || size < 1 || size > maxBytes) return res.status(413).json({ error: 'The file is empty or exceeds the upload limit.' });
  if (!ownerToken(req)) return res.status(400).json({ error: 'An upload owner token is required.' });
  const requestedId = String(req.get('x-upload-id') || '');
  const id = validUploadId(requestedId) ? requestedId : randomUUID();
  const paths = sessionPaths(id);
  const originalName = req.body?.name ?? decodeHeader(req.get('x-upload-name'), 'file');
  const title = String(req.body?.title || '').trim().slice(0, 120);
  const text = String(req.body?.text ?? decodeHeader(req.get('x-upload-text'))).trim();
  if (title && !text) return res.status(400).json({ error: 'Write the article body.' });
  const metadata = {
    id, size, received: 0, chunks: {}, chunkBytes: maxChunkBytes,
    name: safeName(originalName),
    type: mediaType(req.body?.type ?? decodeHeader(req.get('x-upload-type')), originalName),
    duration: Math.max(0, Number(req.body?.duration ?? req.get('x-upload-duration')) || 0),
    premium: req.body?.premium === true || req.get('x-upload-premium') === '1',
    priceTpg: premiumPrice(req.body?.priceTpg ?? req.get('x-upload-price-tpg')),
    text: text.slice(0, title ? 8000 : 1200), title: title || undefined,
    ownerTokenHash: tokenHash(ownerToken(req)), createdAt: Date.now()
  };
  if (req.body?.restorePostId) metadata.restorePostId = String(req.body.restorePostId);
  try {
    const target = metadata.restorePostId ? await restoreTarget(metadata.restorePostId, req, size) : null;
    if (target) {
      metadata.name = safeName(target.attachment.name);
      metadata.type = target.attachment.type;
      // A staged restoration can match a legacy filename alias before its
      // required GridFS backup/post update succeeds. Resume that session;
      // only the post's committed media reference confirms completion.
      if (await locatePostMedia(target, { aliases: false })) return res.json({ post: serializeWallPosts([target], ownerToken(req))[0] });
    }
    if (objectStorageEnabled()) {
      return await withUploadLock(id, async () => {
        const existing = await FlamingoPost.findOne({ $or: [{ clientId: id }, { 'attachment.url': new RegExp(`/files/${id}-`) }] }).select('+ownerTokenHash').lean();
        if (existing && !ownsPost(existing, ownerToken(req))) return res.status(403).json({ error: 'This upload belongs to another session.' });
        if (existing) return res.json({ post: serializeWallPosts([existing], ownerToken(req))[0] });
        const { session, response } = await objectUploads.start(metadata);
        if (session.postId) {
          const post = await FlamingoPost.findById(session.postId).select('+ownerTokenHash').lean();
          if (!post) return res.status(410).json({ error: 'This post was deleted.' });
          return res.json({ post: serializeWallPosts([post], ownerToken(req))[0] });
        }
        res.status(201).json(response);
      });
    }
    await assertFlamingoDurability(uploadDirectory);
    await recoverFlamingoWallStorage().catch(error => console.error('Flamingo storage recovery deferred:', error.message));
    await withUploadLock('$storage', () => withUploadLock(id, async () => {
      await mkdir(pendingDirectory, { recursive: true });
      try {
        const existing = JSON.parse(await readFile(paths.meta, 'utf8'));
        assertUploadOwner(existing, req);
        if (existing.size !== size || existing.name !== metadata.name || existing.restorePostId !== metadata.restorePostId) return res.status(409).json({ error: 'This upload identifier is already in use.' });
        if (existing.postId) {
          const post = await FlamingoPost.findById(existing.postId).select('+ownerTokenHash').lean();
          if (post) return res.json({ ...uploadResponse(existing), post: serializeWallPosts([post], ownerToken(req))[0] });
          return res.status(410).json({ error: 'This post was deleted. Select the file again to create a new post.' });
        }
        await uploadStorage.assertCapacity();
        Object.assign(existing, { text: metadata.text, title: metadata.title, premium: metadata.premium, priceTpg: metadata.priceTpg });
        await writeUploadMetadata(paths, existing);
        return res.json(uploadResponse(existing));
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
      // Recover a confirmed publication even if an old pending manifest was lost.
      const post = await FlamingoPost.findOne({ 'attachment.url': new RegExp(`/files/${id}-`), ownerTokenHash: metadata.ownerTokenHash }).select('+ownerTokenHash').lean();
      if (post) return res.json({ ...uploadResponse(metadata), post: serializeWallPosts([post], ownerToken(req))[0] });
      await uploadStorage.assertCapacity(size);
      try {
        await writeFile(paths.data, '');
        await truncate(paths.data, size);
        await writeUploadMetadata(paths, metadata);
      } catch (error) {
        await rm(paths.data, { force: true });
        throw error;
      }
      res.status(201).json(uploadResponse(metadata));
    }));
  } catch (error) { sendUploadFailure(res, error); }
});

router.put('/uploads/:id', async (req, res) => {
  if (objectStorageEnabled()) { req.resume(); return res.status(409).json({ error: 'Refresh the wall to use direct media uploads.', retryable: false }); }
  const id = String(req.params.id || '');
  if (!validUploadId(id)) return res.status(404).json({ error: 'Upload session not found.' });
  if (uploadLocks.has(`${id}:native`)) { req.resume(); return res.status(409).json({ error: 'The original file is already uploading. Wait for it to finish.' }); }
  const paths = sessionPaths(id);
  const offset = Number(req.get('x-upload-offset'));
  const contentLength = Number(req.get('content-length'));
  try {
    await assertFlamingoDurability(uploadDirectory);
    if (uploadLocks.has(`${id}:native`)) { req.resume(); return res.status(409).json({ error: 'The original file is already uploading. Wait for it to finish.' }); }
    // Serialize retries of the same range, while distinct ranges stream in parallel.
    const result = await withUploadLock(`${id}:${offset}`, async () => {
      const metadata = await withUploadLock(id, async () => JSON.parse(await readFile(paths.meta, 'utf8')));
      assertUploadOwner(metadata, req);
      const chunkBytes = metadata.chunkBytes || maxChunkBytes;
      const expectedLength = Math.min(chunkBytes, metadata.size - offset);
      if (!Number.isSafeInteger(offset) || offset < 0 || offset >= metadata.size || offset % chunkBytes !== 0 || contentLength !== expectedLength) throw Object.assign(new Error('The upload chunk is out of range.'), { status: 409 });
      const key = String(offset);
      let received = 0;
      if (!metadata.chunks?.[key]) {
        const output = createWriteStream(paths.data, { flags: 'r+', start: offset });
        // Keep the HTTP response open on a disk failure so the phone receives
        // the actionable 507, while pipeline still closes the output handle.
        await pipeline(async function* () {
          for await (const chunk of req.iterator({ destroyOnReturn: false })) {
            received += chunk.length;
            if (received > contentLength) throw new Error('Invalid chunk length.');
            yield chunk;
          }
        }, output);
      } else {
        for await (const chunk of req) received += chunk.length;
      }
      if (received !== contentLength) throw new Error('Incomplete chunk.');
      return withUploadLock(id, async () => {
        const latest = JSON.parse(await readFile(paths.meta, 'utf8'));
        if (!latest.chunks?.[key]) {
          latest.chunks ||= {}; latest.chunks[key] = received; latest.received += received;
          await writeUploadMetadata(paths, latest);
        }
        return { received: latest.received, complete: latest.received === latest.size };
      });
    });
    res.json(result);
  } catch (error) {
    req.resume();
    sendUploadFailure(res, error);
  }
});

router.post('/uploads/:id/file', async (req, res) => {
  if (objectStorageEnabled()) { req.resume(); return res.status(409).json({ error: 'Native file upload is not supported by this storage provider.', retryable: false }); }
  const id = String(req.params.id || '');
  if (!validUploadId(id)) { req.resume(); return res.status(404).json({ error: 'Upload session not found.' }); }
  const paths = sessionPaths(id);
  try {
    const result = await withUploadLock(`${id}:native`, async () => {
      let admitted = false;
      try {
        // The native-session lock rejects new range writes. Drain older ones
        // before staging a replacement so file-open/rename races are impossible.
        await Promise.allSettled([...uploadLocks.entries()]
          .filter(([key]) => key.startsWith(`${id}:`) && key !== `${id}:native`)
          .map(([, pending]) => pending));
        const metadata = await withUploadLock('$storage', () => withUploadLock(id, async () => {
          const current = JSON.parse(await readFile(paths.meta, 'utf8'));
          assertUploadOwner(current, req);
          if (current.received === current.size || current.postId) return current;
          await assertFlamingoDurability(uploadDirectory);
          // Recover an interrupted native attempt owned by this session. Account
          // for both staging files so simultaneous uploads cannot overbook disk.
          await rm(paths.native, { force: true });
          delete current.nativeUploadSize;
          await writeUploadMetadata(paths, current);
          await uploadStorage.assertCapacity(current.size);
          admitted = true;
          await writeFile(paths.native, '');
          await truncate(paths.native, current.size);
          current.nativeUploadSize = current.size;
          await writeUploadMetadata(paths, current);
          return current;
        }));
        if (!admitted) { req.resume(); return { received: metadata.size, complete: true }; }
        await receiveNativeWallFile(req, paths.native, { size: metadata.size, name: metadata.name, normalizeName: safeName });
        // A failed phone preview can leave duration at zero. Recover it from
        // the received original so existing video download pricing still works.
        let duration = metadata.duration;
        if (metadata.type.startsWith('video/') && !duration) {
          try { duration = (await probeVideo(paths.native)).duration; }
          catch { throw Object.assign(new Error('The uploaded video could not be verified. Choose a playable copy from Files.'), { status: 422 }); }
        }
        return await withUploadLock(id, async () => {
          const latest = JSON.parse(await readFile(paths.meta, 'utf8'));
          assertUploadOwner(latest, req);
          if (!latest.postId) {
            // Replace prior partial ranges only after exact name/size validation.
            await rename(paths.native, paths.data);
            latest.received = latest.size;
            latest.duration = duration;
            latest.chunks = {};
            const chunkBytes = latest.chunkBytes || maxChunkBytes;
            for (let offset = 0; offset < latest.size; offset += chunkBytes) {
              latest.chunks[String(offset)] = Math.min(chunkBytes, latest.size - offset);
            }
          }
          delete latest.nativeUploadSize;
          await writeUploadMetadata(paths, latest);
          return { received: latest.size, complete: true };
        });
      } finally {
        if (admitted) {
          await rm(paths.native, { force: true });
          await withUploadLock(id, async () => {
            const metadata = JSON.parse(await readFile(paths.meta, 'utf8'));
            if (metadata.nativeUploadSize) {
              delete metadata.nativeUploadSize;
              await writeUploadMetadata(paths, metadata);
            }
          });
        }
      }
    });
    res.json(result);
  } catch (error) {
    req.resume();
    sendUploadFailure(res, error);
  }
});

router.post('/uploads/:id/parts/:number/sign', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (!validUploadId(req.params.id) || !ownerToken(req)) return res.status(403).json({ error: 'Upload owner token required.' });
    res.json(await objectUploads.sign(req.params.id, tokenHash(ownerToken(req)), Number(req.params.number)));
  } catch (error) { sendUploadFailure(res, error); }
});
router.post('/uploads/:id/parts/:number/ack', express.json({ limit: '2kb' }), async (req, res) => {
  try {
    if (!validUploadId(req.params.id) || !ownerToken(req)) return res.status(403).json({ error: 'Upload owner token required.' });
    res.json(await objectUploads.acknowledge(req.params.id, tokenHash(ownerToken(req)), Number(req.params.number), req.body?.etag));
  } catch (error) { sendUploadFailure(res, error); }
});

router.get('/identity', async (req, res) => {
  const user = await resolveUser(req);
  res.json({ author: displayName(user), authorAvatar: publicWallAvatar(user?.photo || ''), accountId: user?.accountId || '' });
});

router.get('/profiles/:accountId', async (req, res) => {
  const accountId = String(req.params.accountId || '').trim();
  if (!accountId || accountId.length > 120) return res.status(400).json({ error: 'Invalid profile.' });
  const [user, postCount, mediaCount] = await Promise.all([
    User.findOne({ accountId }).select('accountId nickname firstName lastName photo bio createdAt').lean(),
    FlamingoPost.countDocuments({ authorAccountId: accountId }),
    FlamingoPost.countDocuments({ authorAccountId: accountId, attachment: { $exists: true } })
  ]);
  if (!user && !postCount) return res.status(404).json({ error: 'Profile not found.' });
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    profile: {
      accountId,
      name: user ? displayName(user) : 'Community member',
      avatar: publicWallAvatar(user?.photo || ''),
      bio: user?.bio || '',
      joinedAt: user?.createdAt,
      postCount,
      mediaCount
    }
  });
});

router.get('/health', async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  let database = 'disconnected';
  let mediaStorage = 'unavailable';
  let storage;
  await Promise.all([
    (async () => {
      if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
        await mongoose.connection.db.command({ ping: 1 });
        database = 'connected';
      }
    })().catch(() => {}),
    (async () => {
      if (objectStorageEnabled()) {
        storage = await inspectFlamingoWallStorage();
        mediaStorage = 'available';
        return;
      }
      // Check access only after creating the directory, including on first boot.
      await mkdir(uploadDirectory, { recursive: true });
      await access(uploadDirectory, fsConstants.R_OK | fsConstants.W_OK);
      storage = { ...await inspectFlamingoWallStorage(), backup: flamingoDatabaseStorageEnabled() ? 'gridfs' : 'disk' };
      const durable = !storage.durability.required || storage.durability.persistent || flamingoDatabaseStorageEnabled();
      mediaStorage = !durable ? 'not-durable' : storage.availableBytes > 0 ? 'available' : 'full';
    })().catch(() => {})
  ]);
  const ok = database === 'connected' && mediaStorage === 'available';
  res.status(ok ? 200 : 503).json({ ok, database, mediaStorage, storage });
});

router.post('/uploads/:id/complete', async (req, res) => {
  const id = String(req.params.id || '');
  if (!validUploadId(id)) return res.status(404).json({ error: 'Upload session not found.' });
  if (uploadLocks.has(`${id}:native`)) return res.status(409).json({ error: 'The video is still uploading. Wait for it to finish.' });
  const paths = sessionPaths(id);
  try {
    // A timed-out completion can still be saving media. Join it under the
    // session lock before checking for its post, instead of creating a duplicate.
    const post = await withUploadLock(id, async () => {
      if (objectStorageEnabled()) {
        const session = await objectUploads.load(id, tokenHash(ownerToken(req)));
        const existing = session.postId
          ? await FlamingoPost.findById(session.postId).select('+ownerTokenHash').lean()
          : await FlamingoPost.findOne({ 'attachment.objectKey': session.key, ownerTokenHash: session.ownerTokenHash }).select('+ownerTokenHash').lean();
        if (existing) return existing;
        if (session.postId) throw Object.assign(new Error('This post was deleted.'), { status: 410 });
        await objectUploads.finish(session);
        const metadata = session.details;
        if (metadata.restorePostId) return withUploadLock(`restore:${metadata.restorePostId}`, async () => {
          const target = await restoreTarget(metadata.restorePostId, req, metadata.size);
          if (await locatePostMedia(target, { aliases: false })) return target;
          const restored = await FlamingoPost.findOneAndUpdate(
            { _id: target._id, ownerTokenHash: session.ownerTokenHash, 'attachment.url': target.attachment.url },
            { $set: { attachment: objectAttachment(session, target.attachment) } }, { new: true, runValidators: true }
          ).select('+ownerTokenHash').lean();
          if (!restored) throw Object.assign(new Error('This post changed during restoration. Refresh the wall.'), { status: 409 });
          await objectUploads.published(session, restored._id);
          publishWallEvent('updated', String(restored._id));
          return restored;
        });
        const user = await resolveUser(req);
        const content = { clientId: id, text: metadata.text, title: metadata.title, author: displayName(user),
          authorAvatar: publicWallAvatar(user?.photo || ''), authorAccountId: user?.accountId || '',
          ownerTokenHash: session.ownerTokenHash, attachment: objectAttachment(session) };
        let created;
        try {
          created = await FlamingoPost.findOneAndUpdate({ clientId: id, ownerTokenHash: session.ownerTokenHash }, { $setOnInsert: content }, { upsert: true, new: true, runValidators: true }).select('+ownerTokenHash').lean();
        } catch (error) {
          if (error.code !== 11000) throw error;
          created = await FlamingoPost.findOne({ clientId: id, ownerTokenHash: session.ownerTokenHash }).select('+ownerTokenHash').lean();
          if (!created) throw error;
        }
        await objectUploads.published(session, created._id);
        publishWallEvent('created', String(created._id));
        return created;
      }
      const metadata = JSON.parse(await readFile(paths.meta, 'utf8'));
      assertUploadOwner(metadata, req);
      const existing = metadata.postId
        ? await FlamingoPost.findById(metadata.postId).select('+ownerTokenHash').lean()
        : await FlamingoPost.findOne({ 'attachment.url': new RegExp(`/files/${id}-`), ownerTokenHash: metadata.ownerTokenHash }).select('+ownerTokenHash').lean();
      if (existing) return existing;
      if (metadata.postId) throw Object.assign(new Error('This post was deleted.'), { status: 410 });
      if (metadata.received !== metadata.size) throw Object.assign(new Error('The file has not finished uploading. Tap Publish to resume.'), { status: 409 });
      await assertFlamingoDurability(uploadDirectory);
      if (metadata.restorePostId) return withUploadLock(`restore:${metadata.restorePostId}`, async () => {
        const target = await restoreTarget(metadata.restorePostId, req, metadata.size);
        const storedName = `${id}-${metadata.name}`;
        const current = await locatePostMedia(target, { aliases: false });
        const ownFile = (current?.diskPath && path.basename(current.diskPath) === storedName) || current?.databaseFile?.filename === storedName;
        if (current && !ownFile) return target;
        const diskPath = path.join(uploadDirectory, storedName);
        await commitFlamingoMedia(paths.data, diskPath, metadata.size);
        const databaseFile = await persistDatabaseMedia(diskPath, storedName, { contentType: metadata.type, originalName: metadata.name, size: metadata.size });
        const attachment = { ...target.attachment, url: `/api/flamingo-wall/files/${storedName}` };
        if (databaseFile?._id) attachment.databaseFileId = databaseFile._id;
        else delete attachment.databaseFileId;
        const restored = await FlamingoPost.findOneAndUpdate(
          { _id: target._id, ownerTokenHash: metadata.ownerTokenHash, 'attachment.url': target.attachment.url },
          { $set: { attachment } }, { new: true, runValidators: true }
        ).select('+ownerTokenHash').lean();
        if (!restored) throw Object.assign(new Error('This post changed during restoration. Refresh the wall.'), { status: 409 });
        metadata.postId = String(restored._id); metadata.completedAt = Date.now();
        await writeUploadMetadata(paths, metadata);
        publishWallEvent('updated', String(restored._id));
        return restored;
      });
      const storedName = `${id}-${metadata.name}`;
      const diskPath = path.join(uploadDirectory, storedName);
      await commitFlamingoMedia(paths.data, diskPath, metadata.size);
      const databaseFile = await persistDatabaseMedia(diskPath, storedName, { contentType: metadata.type, originalName: metadata.name, size: metadata.size });
      const user = await resolveUser(req);
      const attachment = { name: metadata.name, size: metadata.size, type: metadata.type, duration: metadata.duration, premium: metadata.premium && metadata.priceTpg > 0, priceTpg: metadata.premium ? metadata.priceTpg : 0, url: `/api/flamingo-wall/files/${storedName}`, ...(databaseFile?._id ? { databaseFileId: databaseFile._id } : {}) };
      const created = await FlamingoPost.create({ text: metadata.text, title: metadata.title, author: displayName(user), authorAvatar: publicWallAvatar(user?.photo || ''), authorAccountId: user?.accountId || '', attachment, ownerTokenHash: metadata.ownerTokenHash });
      metadata.postId = String(created._id); metadata.completedAt = Date.now();
      await writeUploadMetadata(paths, metadata);
      publishWallEvent('created', String(created._id));
      return created;
    });
    res.status(201).json({ post: serializeWallPosts([post.toObject?.() || post], ownerToken(req))[0] });
  } catch (error) {
    sendUploadFailure(res, error);
  }
});

router.get('/events', (req, res) => {
  // Server-sent invalidations make the feed update immediately after another
  // visitor publishes. The regular feed request remains the source of truth.
  res.setHeader('Content-Type', 'text/event-stream');
  // compression() otherwise buffers small heartbeats until the proxy times
  // out. no-transform opts this stream out, including on Render.
  res.setHeader('Cache-Control', 'no-store, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
  const write = message => { res.write(message); res.flush?.(); };
  write(': connected\n\n');
  const send = event => write(`event: wall-change\ndata: ${JSON.stringify(event)}\n\n`);
  const heartbeat = setInterval(() => write(': keep-alive\n\n'), 20_000);
  wallEvents.on('change', send);
  req.on('close', () => { clearInterval(heartbeat); wallEvents.off('change', send); });
});

router.get('/posts', async (req, res) => {
  const token = ownerToken(req);
  const paginated = req.query.paginated === '1';
  const cursor = decodeFlamingoWallCursor(req.query.cursor);
  if (req.query.cursor && (!cursor || !mongoose.isValidObjectId(cursor.id))) return res.status(400).json({ error: 'Invalid wall cursor.' });
  const limit = flamingoWallPageSize(req.query.limit);
  const profileAccountId = String(req.query.profile || '').trim();
  if (profileAccountId.length > 120) return res.status(400).json({ error: 'Invalid profile.' });
  const query = paginated ? flamingoWallCursorQuery(cursor, id => new mongoose.Types.ObjectId(id)) : {};
  if (profileAccountId) query.authorAccountId = profileAccountId;
  const result = await FlamingoPost.find(query).select('+ownerTokenHash').sort({ createdAt: -1, _id: -1 }).limit(paginated ? limit + 1 : 0).lean();
  const hasMore = paginated && result.length > limit;
  const posts = paginated ? result.slice(0, limit) : result;
  // The wall is a shared live feed. Never let a browser/proxy reuse an old
  // response while another community member is publishing.
  res.setHeader('Cache-Control', 'no-store');
  res.json({ posts: serializeWallPosts(posts, token), hasMore, nextCursor: hasMore ? encodeFlamingoWallCursor(posts.at(-1)) : null });
});

router.get('/latest-post', async (req, res) => {
  const post = await FlamingoPost.findOne().sort({ createdAt: -1 }).lean();
  res.setHeader('Cache-Control', 'no-store');
  res.json({ post: latestWallPost(post) });
});

router.get('/posts/:id/media-status', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid post.' });
  try {
    const post = await FlamingoPost.findById(req.params.id).select('+ownerTokenHash').lean();
    if (!post?.attachment) return res.status(404).json({ code: 'WALL_POST_NOT_FOUND', error: 'The post is no longer available.' });
    const available = Boolean(await locatePostMedia(post));
    res.json({ available, code: available ? 'WALL_MEDIA_AVAILABLE' : 'WALL_MEDIA_MISSING', canRestore: !available && ownsPost(post, ownerToken(req)) });
  } catch {
    res.status(503).json({ code: 'WALL_MEDIA_UNAVAILABLE', error: 'Media storage cannot be reached right now.' });
  }
});

router.post('/posts/content', express.json({ limit: '64kb' }), async (req, res) => {
  const text = String(req.body?.text || '').trim();
  const title = String(req.body?.title || '').trim();
  const question = String(req.body?.poll?.question || '').trim();
  const options = Array.isArray(req.body?.poll?.options) ? req.body.poll.options.map(option => String(option).trim()).filter(Boolean).slice(0, 4) : [];
  if ((!text && (!question || options.length < 2)) || (title && !text)) return res.status(400).json({ error: 'Write your post or add a question and two choices.' });
  const clientId = req.body?.clientId;
  if (clientId && !validUploadId(clientId)) return res.status(400).json({ error: 'Invalid post identifier.' });
  if (clientId && !ownerToken(req)) return res.status(400).json({ error: 'A post owner token is required.' });
  try {
    const user = await resolveUser(req);
    const content = {
      text: text.slice(0, title ? 8000 : 1200), title: title ? title.slice(0, 120) : undefined,
      poll: question && options.length >= 2 ? { question: question.slice(0, 300), options: options.map(option => option.slice(0, 160)), votes: options.map(() => 0) } : undefined,
      author: displayName(user).slice(0, 120), authorAvatar: publicWallAvatar(user?.photo || ''), authorAccountId: user?.accountId || '',
      ownerTokenHash: tokenHash(ownerToken(req)), ...(clientId ? { clientId } : {})
    };
    const query = { clientId, ownerTokenHash: content.ownerTokenHash };
    const post = clientId
      ? await FlamingoPost.findOneAndUpdate(query, { $setOnInsert: content }, { upsert: true, new: true, runValidators: true }).select('+ownerTokenHash').lean()
      : await FlamingoPost.create(content);
    publishWallEvent('created', String(post._id));
    res.status(201).json({ post: serializeWallPosts([post.toObject?.() || post], ownerToken(req))[0] });
  } catch (error) {
    // A concurrent request can race the unique upsert; return its confirmed post.
    if (error.code === 11000 && clientId) {
      const post = await FlamingoPost.findOne({ clientId, ownerTokenHash: tokenHash(ownerToken(req)) }).select('+ownerTokenHash').lean();
      if (post) return res.json({ post: serializeWallPosts([post], ownerToken(req))[0] });
    }
    sendUploadFailure(res, error);
  }
});

router.post('/posts', async (req, res) => {
  if (objectStorageEnabled()) { req.resume(); return res.status(409).json({ error: 'Refresh the wall to use direct media uploads.', retryable: false }); }
  try { await assertFlamingoDurability(uploadDirectory); } catch (error) { return sendUploadFailure(res, error); }
  await mkdir(uploadDirectory, { recursive: true });
  const busboy = Busboy({ headers: req.headers, limits: { fileSize: maxBytes, files: 1, fields: 3 } });
  const fields = {};
  let upload;
  let writeDone;
  let completed = false;

  busboy.on('field', (name, value) => { fields[name] = value; });
  busboy.on('file', (_name, stream, info) => {
    const storedName = `${randomUUID()}-${safeName(info.filename)}`;
    const diskPath = path.join(uploadDirectory, storedName);
    const output = createWriteStream(diskPath, { flags: 'wx' });
    upload = { diskPath, limited: false, originalName: safeName(info.filename), storedName, type: info.mimeType || 'application/octet-stream', size: 0 };
    stream.on('data', chunk => { upload.size += chunk.length; });
    stream.on('limit', () => { upload.limited = true; });
    writeDone = new Promise((resolve, reject) => {
      output.on('finish', resolve);
      output.on('error', reject);
      stream.on('error', reject);
    });
    stream.pipe(output);
  });

  req.on('aborted', async () => {
    if (completed) return;
    completed = true;
    if (upload?.diskPath) await rm(upload.diskPath, { force: true });
  });

  busboy.on('error', err => res.status(400).json({ error: err.message }));
  busboy.on('finish', async () => {
    try {
      if (completed) return;
      if (writeDone) await writeDone;
      if (upload?.limited) {
        await rm(upload.diskPath, { force: true });
        return res.status(413).json({ error: `The file exceeds the maximum limit of ${Math.floor(maxBytes / 1024 ** 3)} GB.` });
      }
      const text = String(fields.text || '').trim();
      if (!text && !upload) return res.status(400).json({ error: 'Write something or select a file.' });
      const user = await resolveUser(req);
      const author = displayName(user).slice(0, 120);
      if (upload) {
        upload.databaseFile = await persistDatabaseMedia(upload.diskPath, upload.storedName, {
          contentType: upload.type, originalName: upload.originalName, size: upload.size
        });
      }
      const attachment = upload ? { name: upload.originalName, size: upload.size, type: upload.type, url: `/api/flamingo-wall/files/${upload.storedName}`, ...(upload.databaseFile?._id ? { databaseFileId: upload.databaseFile._id } : {}) } : undefined;
      const post = await FlamingoPost.create({ text: text.slice(0, 1200), author, authorAvatar: publicWallAvatar(user?.photo || ''), authorAccountId: user?.accountId || '', attachment, ownerTokenHash: tokenHash(ownerToken(req)) });
      completed = true;
      publishWallEvent('created', String(post._id));
      res.status(201).json({ post: serializeWallPosts([post.toObject?.() || post], ownerToken(req))[0] });
    } catch (err) {
      if (upload?.diskPath) await rm(upload.diskPath, { force: true });
      sendUploadFailure(res, err);
    }
  });
  req.pipe(busboy);
});

router.patch('/posts/:id', express.json({ limit: '64kb' }), async (req, res) => {
  const post = await FlamingoPost.findById(req.params.id).select('+ownerTokenHash');
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  if (!ownsPost(post, ownerToken(req))) return res.status(403).json({ error: 'Only the author can edit this post.' });
  post.text = String(req.body?.text || '').trim().slice(0, post.title ? 8000 : 1200);
  await post.save();
  publishWallEvent('updated', String(post._id));
  res.json({ post: serializeWallPosts([post.toObject()], ownerToken(req))[0] });
});

router.delete('/posts/:id', async (req, res) => {
  const post = await FlamingoPost.findById(req.params.id).select('+ownerTokenHash');
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  if (!ownsPost(post, ownerToken(req))) return res.status(403).json({ error: 'Only the author can delete this post.' });
  await post.deleteOne();
  publishWallEvent('deleted', String(post._id));
  await videoRenditions.remove(String(post._id));
  if (post.attachment?.objectKey) {
    try {
      if (!await FlamingoPost.exists({ 'attachment.objectKey': post.attachment.objectKey }))
        await flamingoObjectStorage().remove(post.attachment.objectKey, post.attachment.objectBucket);
    } catch (error) { return sendUploadFailure(res, error); }
  } else if (post.attachment?.url) await removeFlamingoMedia(flamingoMediaName(post.attachment.url), mediaDirectories);
  res.status(204).end();
});

router.post('/posts/:id/download', express.json({ limit: '1kb' }), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid post.' });
  const requestId = req.body?.requestId;
  if (requestId !== undefined && (typeof requestId !== 'string' || !/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(requestId))) return res.status(400).json({ error: 'Invalid download request.' });
  const post = await FlamingoPost.findById(req.params.id).lean();
  if (!post?.attachment?.url) return res.status(404).json({ error: 'Video not found.' });
  const file = flamingoMediaName(post.attachment.url);
  // Check the morning/legacy location before taking any TPG. Older database
  // rows can have a missing or generic MIME type, but their original filename
  // is still sufficient to identify and serve the video.
  let media;
  try { media = await locatePostMedia(post); }
  catch (error) { return sendUploadFailure(res, error); }
  if (!media) return res.status(404).json({ error: 'The original video was not found in storage.' });
  const quality = req.body?.quality || 'original';
  const rendition = quality === 'original' ? null : await videoRenditions.file(post, quality);
  // A missing/pending rendition must never charge the viewer or silently
  // substitute the original after they selected a smaller resolution.
  if (quality !== 'original' && !rendition) return res.status(409).json({ error: 'This resolution is not ready. Prepare it before downloading.' });
  let price = attachmentDownloadPrice(post.attachment);
  const selector = userSelector(req);
  if (price && !selector) return res.status(401).json({ error: 'Sign in to download the video.' });
  let user = selector ? await User.findOne(selector) : null;
  if (selector && !user) return res.status(404).json({ error: 'Account not found.' });
  if (price) {
    // A phone may lose the response after payment, or need a fresh signed URL.
    // Scope retry IDs to owner, original media and quality. This also respects
    // the global unique transaction index and cannot unlock another video.
    const transactionId = requestId ? `wall-download:${createHash('sha256').update(JSON.stringify([String(user._id), String(post._id), videoSourceKey(post), quality, requestId])).digest('hex')}` : randomUUID();
    const previousPayment = (account) => account?.transactions?.find((entry) => entry.transactionId === transactionId && entry.type === 'video_download');
    let paid = previousPayment(user);
    if (!paid) {
      const accountId = user._id;
      user = await User.findOneAndUpdate({ _id: accountId, balance: { $gte: price }, 'transactions.transactionId': { $ne: transactionId } }, {
        $inc: { balance: -price },
        $push: { transactions: { transactionId, amount: -price, type: 'video_download', token: 'TPG', status: 'delivered', detail: String(post._id) } }
      }, { new: true });
      if (!user && requestId) {
        user = await User.findOne({ _id: accountId });
        paid = previousPayment(user);
        if (!paid) return res.status(402).json({ error: `You need ${price} TPG to download this video.` });
      }
      if (!user) return res.status(402).json({ error: `You need ${price} TPG to download this video.` });
    }
    if (paid) price = Math.abs(paid.amount);
  }
  const downloadName = rendition?.name || post.attachment.name;
  const grant = createFlamingoDownloadGrant(rendition ? {
    file: `${quality}.mp4`, originalName: downloadName, size: rendition.size,
    postId: String(post._id), quality, sourceKey: videoSourceKey(post)
  } : { file, originalName: post.attachment.name, size: post.attachment.size,
    ...(post.attachment.objectKey ? { objectKey: post.attachment.objectKey, objectBucket: post.attachment.objectBucket, type: post.attachment.type } : {}) });
  res.json({ downloadUrl: `/api/flamingo-wall/downloads/${grant}?name=${encodeURIComponent(downloadName)}`, name: downloadName, quality, price, balance: user?.balance });
});

router.get('/downloads/:grant', async (req, res) => {
  const grant = readFlamingoDownloadGrant(req.params.grant);
  if (!grant) return res.status(403).json({ error: 'Lidhja e shkarkimit ka skaduar.' });
  const requestedName = path.basename(String(req.query.name || grant.file)).replace(/["\\\r\n]/g, '');
  // sendFile (used by res.download) supports byte ranges; these headers make
  // that resumable behavior explicit and let a briefly interrupted phone
  // download continue without transferring the completed bytes again.
  setFlamingoMediaResponseHeaders(res);
  res.setHeader('Cache-Control', 'private, max-age=300');
  if (grant.quality) {
    try {
      const post = await videoPost(grant.postId);
      if (grant.sourceKey !== videoSourceKey(post)) return res.status(410).json({ error: 'This video was replaced.' });
      const rendition = await videoRenditions.file(post, grant.quality);
      if (!rendition || rendition.size !== grant.size) return res.status(404).json({ error: 'This video resolution is no longer available.' });
      res.type('video/mp4');
      return res.download(rendition.diskPath, grant.originalName);
    } catch (error) { return videoFailure(res, error); }
  }
  if (grant.objectKey) {
    try {
      const store = flamingoObjectStorage();
      if (!await store.head(grant.objectKey, grant.objectBucket)) return res.status(404).json({ error: 'Video not found.' });
      const url = await store.readUrl(grant.objectKey, grant.objectBucket, { name: grant.originalName || requestedName, type: grant.type, download: true });
      res.setHeader('Cache-Control', 'no-store');
      return res.redirect(307, url);
    } catch (error) { return sendUploadFailure(res, error); }
  }
  const databaseFile = await findFlamingoDatabaseMedia(grant.file, grant.originalName, grant.size);
  if (databaseFile) {
    res.setHeader('Content-Type', databaseFile.metadata?.contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${requestedName}"; filename*=UTF-8''${encodeURIComponent(requestedName)}`);
    return streamDatabaseMedia(req, res, databaseFile);
  }
  const diskPath = await findFlamingoMedia(grant.file, mediaDirectories, grant.originalName, grant.size);
  if (!diskPath) return res.status(404).json({ error: 'Video not found.' });
  backfillDatabaseMedia(diskPath, grant.file, { name: grant.originalName, size: grant.size });
  return res.download(diskPath, requestedName);
});

router.get('/files/:name', async (req, res) => {
  setFlamingoMediaResponseHeaders(res);
  const name = path.basename(req.params.name);
  const post = await FlamingoPost.findOne(wallMediaPostQuery(name)).lean();
  if (req.query.download === '1') {
    if (post?.attachment?.type?.startsWith('video/') || post?.attachment?.premium) {
      return res.status(403).json({ error: 'Use the download button so the TPG payment can be applied.' });
    }
  }
  const disposition = req.query.download === '1' ? 'attachment' : 'inline';
  const requestedName = path.basename(String(req.query.name || name)).replace(/["\\\r\n]/g, '');
  const asciiName = requestedName.replace(/[^\x20-\x7E]/g, '_');
  res.setHeader('Content-Disposition', `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(requestedName)}`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Uploaded phone videos do not always keep a recognizable extension (and
  // older uploads can use MOV/M4V names). With `nosniff`, serving those files
  // as application/octet-stream makes Safari and Chromium refuse playback.
  // Use the MIME type captured at upload time so historical videos remain
  // playable while preserving byte-range support from sendFile.
  const contentType = mediaType(post?.attachment?.type, post?.attachment?.name || name);
  if (/^[\w.+-]+\/[\w.+-]+$/.test(contentType)) {
    res.type(contentType);
  }
  if (post?.attachment?.objectKey) {
    try {
      const store = flamingoObjectStorage();
      res.setHeader('Cache-Control', 'no-store');
      if (!await store.head(post.attachment.objectKey, post.attachment.objectBucket)) return res.status(404).type('application/json').json({ code: 'WALL_MEDIA_MISSING', error: 'The original media is not available in storage.' });
      const url = await store.readUrl(post.attachment.objectKey, post.attachment.objectBucket, { name: post.attachment.name, type: contentType, download: disposition === 'attachment' });
      // Keep the feed's stable API URL. Each playback gets a fresh signed
      // location, and range/seek traffic is served directly by the bucket.
      return res.redirect(307, url);
    } catch (error) { return sendUploadFailure(res, error); }
  }
  // Prefer MongoDB so wall playback survives host disk replacement. Legacy
  // disk-only uploads remain readable and are lazily copied into GridFS.
  const databaseFile = await findFlamingoDatabaseMedia(name, post?.attachment?.name, post?.attachment?.size, post?.attachment?.databaseFileId);
  if (databaseFile) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return streamDatabaseMedia(req, res, databaseFile);
  }
  const diskPath = await findFlamingoMedia(name, mediaDirectories, post?.attachment?.name, post?.attachment?.size);
  if (!diskPath) {
    // Never pin a temporarily missing media response in the browser. A disk
    // remount or GridFS recovery should make an older upload playable again.
    res.setHeader('Cache-Control', 'no-store');
    return res.status(404).type('application/json').json({ code: 'WALL_MEDIA_MISSING', error: 'The original media is not available on the server.' });
  }
  backfillDatabaseMedia(diskPath, name, post?.attachment);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  return res.sendFile(diskPath, err => {
    if (err && !res.headersSent) res.status(err.statusCode || 404).end();
  });
});

export default router;
