import Busboy from 'busboy';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { constants as fsConstants, createWriteStream } from 'fs';
import { access, mkdir, readFile, rm, truncate, writeFile } from 'fs/promises';
import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import { EventEmitter } from 'events';
import mongoose from 'mongoose';
import FlamingoPost from '../models/FlamingoPost.js';
import User from '../models/User.js';
import { optionalAuthenticate } from '../middleware/auth.js';
import { mediaType } from '../utils/mediaType.js';
import { setFlamingoMediaResponseHeaders } from '../utils/flamingoMediaResponse.js';
import { commitFlamingoMedia, findFlamingoDatabaseMedia, findFlamingoMedia, flamingoDatabaseStorageEnabled, flamingoMediaName, flamingoStorageDirectories, openFlamingoDatabaseMedia, pruneFlamingoDatabaseMediaCopies, removeFlamingoMedia, saveFlamingoMediaToDatabase } from '../utils/flamingoStorage.js';
import { wallMediaPostQuery } from '../utils/flamingoPostLookup.js';
import { createFlamingoDownloadGrant, readFlamingoDownloadGrant } from '../utils/flamingoDownloadGrant.js';

const router = express.Router();
const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
// Render starts the API from `bot/`, while local tools and tests may start it
// from the repository root. Resolve the fallback beside the bot instead of
// against process.cwd(), and let production point it at a persistent disk.
const uploadDirectory = path.resolve(
  process.env.FLAMINGO_UPLOAD_DIR || path.join(moduleDirectory, '../data/flamingo-uploads')
);
// Keep reading the original application-local directory after production is
// switched to a persistent disk. Existing database records still point at
// those file names, so checking both locations prevents a storage migration
// from turning every earlier wall video into a 404.
const mediaDirectories = flamingoStorageDirectories(
  uploadDirectory,
  [
    // This is the location used by the wall before persistent storage was
    // enabled. Keep it readable so morning uploads continue to work.
    path.join(moduleDirectory, '../data/flamingo-uploads'),
    // Allow an old Render disk/snapshot to be mounted read-only during a
    // migration without changing where current uploads are written.
    ...String(process.env.FLAMINGO_LEGACY_UPLOAD_DIRS || '').split(path.delimiter)
  ]
);
const maxBytes = Math.max(1, Number(process.env.FLAMINGO_UPLOAD_MAX_BYTES) || 5 * 1024 ** 3);
// Keep each request small enough for mobile networks while allowing several
// independent ranges to be written at once. Six 8 MB requests use less memory
// than the former three 32 MB requests and no longer queue behind one another.
const maxChunkBytes = Math.max(1024 ** 2, Number(process.env.FLAMINGO_UPLOAD_CHUNK_BYTES) || 8 * 1024 ** 2);
const pendingDirectory = path.join(uploadDirectory, '.pending');
const uploadLocks = new Map();
const mediaBackfills = new Map();
let mediaPrune;
const wallEvents = new EventEmitter();
wallEvents.setMaxListeners(0);
const publishWallEvent = (action, postId) => wallEvents.emit('change', { action, postId, at: Date.now() });

router.use(optionalAuthenticate);

const safeName = (name) => path.basename(String(name || 'file'))
  .normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-160) || 'file';

const normalizedPost = post => post?.attachment
  ? { ...post, attachment: { ...post.attachment, type: mediaType(post.attachment.type, post.attachment.name) } }
  : post;

const decodeHeader = (value, fallback = '') => {
  try { return decodeURIComponent(String(value || fallback)); } catch { return fallback; }
};

const sessionPaths = (id) => ({
  data: path.join(pendingDirectory, `${id}.part`),
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
const pruneDuplicateDatabaseMedia = () => {
  if (flamingoDatabaseStorageEnabled()) return Promise.resolve(0);
  if (!mediaPrune) mediaPrune = pruneFlamingoDatabaseMediaCopies(mediaDirectories)
    .catch(error => { console.error('Flamingo duplicate media cleanup failed:', error.message); return 0; })
    .finally(() => { mediaPrune = undefined; });
  return mediaPrune;
};

const isDatabaseQuotaError = error => /space quota|exceeded.*storage|limit=storage|quota.*(?:exceed|full)/i
  .test(String(error?.message || error || ''));
// Do not publish a post until its original bytes are in GridFS. A local disk is
// still retained as a fast fallback, but it may be replaced during a deploy;
// MongoDB is the durable source that keeps yesterday's uploads retrievable.
const persistDatabaseMedia = async (diskPath, storedName, metadata) => {
  if (!flamingoDatabaseStorageEnabled()) {
    await pruneDuplicateDatabaseMedia();
    return null;
  }
  return saveFlamingoMediaToDatabase(diskPath, storedName, metadata);
};
const publicUploadError = error => isDatabaseQuotaError(error)
  ? 'MongoDB media storage is temporarily full. The post was not published; please try again shortly.'
  : 'Publishing failed. Please try again.';
const ownsPost = (post, token) => {
  if (!post.ownerTokenHash || !token) return false;
  const supplied = Buffer.from(tokenHash(token));
  const stored = Buffer.from(post.ownerTokenHash);
  return supplied.length === stored.length && timingSafeEqual(supplied, stored);
};

// Database records are the source of truth for the public wall. In particular,
// do not hide or delete posts based on their author: a read request must never
// mutate content that a community member has already published.
export const serializeWallPosts = (posts, token = '') => posts.map(({ ownerTokenHash, ...post }) => (
  normalizedPost({ ...post, canManage: ownsPost({ ownerTokenHash }, token) })
));

export const latestWallPost = post => normalizedPost(post || null);

// Large videos are uploaded in small, retryable requests. This avoids mobile and
// reverse-proxy timeouts that occur when a multi-gigabyte request stays open.
router.post('/uploads', async (req, res) => {
  const size = Number(req.get('x-upload-size'));
  if (!Number.isSafeInteger(size) || size < 1 || size > maxBytes) {
    return res.status(413).json({ error: `The file must be smaller than ${Math.floor(maxBytes / 1024 ** 3)} GB.` });
  }
  // A stable client id makes initiation safe to retry when the phone sent the
  // request but lost the response. No video bytes are transformed at any point.
  const requestedId = String(req.get('x-upload-id') || '');
  const id = /^[0-9a-f-]{36}$/i.test(requestedId) ? requestedId : randomUUID();
  const paths = sessionPaths(id);
  const metadata = {
    id,
    size,
    received: 0,
    chunks: {},
    name: safeName(decodeHeader(req.get('x-upload-name'), 'video.mp4')),
    type: mediaType(decodeHeader(req.get('x-upload-type'), 'application/octet-stream'), decodeHeader(req.get('x-upload-name'), 'video.mp4')),
    duration: Math.max(0, Number(req.get('x-upload-duration')) || 0),
    premium: req.get('x-upload-premium') === '1',
    priceTpg: premiumPrice(req.get('x-upload-price-tpg')),
    text: decodeHeader(req.get('x-upload-text')).slice(0, 1200),
    ownerTokenHash: tokenHash(ownerToken(req)),
    createdAt: Date.now()
  };
  await mkdir(pendingDirectory, { recursive: true });
  try {
    const existing = JSON.parse(await readFile(paths.meta, 'utf8'));
    if (existing.size === size && existing.ownerTokenHash === metadata.ownerTokenHash) {
      return res.status(200).json({ uploadId: id, chunkBytes: maxChunkBytes });
    }
    return res.status(409).json({ error: 'This upload identifier is already in use.' });
  } catch (err) {
    if (err?.code !== 'ENOENT') throw err;
  }
  await Promise.all([writeFile(paths.data, ''), writeFile(paths.meta, JSON.stringify(metadata))]);
  await truncate(paths.data, size);
  res.status(201).json({ uploadId: id, chunkBytes: maxChunkBytes });
});

router.put('/uploads/:id', async (req, res) => {
  const id = String(req.params.id || '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(404).json({ error: 'Upload session not found.' });
  const paths = sessionPaths(id);
  try {
    const offset = Number(req.get('x-upload-offset'));
    const contentLength = Number(req.get('content-length'));
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(contentLength) || contentLength < 1 || contentLength > maxChunkBytes) {
      return res.status(413).json({ error: 'The video chunk is too large.' });
    }
    const metadata = await withUploadLock(id, async () => {
      const metadata = JSON.parse(await readFile(paths.meta, 'utf8'));
      const expectedLength = Math.min(maxChunkBytes, metadata.size - offset);
      if (offset >= metadata.size || offset % maxChunkBytes !== 0 || contentLength !== expectedLength) throw Object.assign(new Error('The video chunk is out of range.'), { status: 409 });
      return metadata;
    });
    const key = String(offset);
    let received = 0;
    if (!metadata.chunks?.[key]) {
      // Stream straight to the preallocated range instead of buffering every
      // chunk in RAM first. Disk writes now overlap the network transfer and a
      // busy server can sustain parallel phone uploads without memory spikes.
      const output = createWriteStream(paths.data, { flags: 'r+', start: offset });
      await new Promise((resolve, reject) => {
        req.on('data', chunk => {
          received += chunk.length;
          if (received > contentLength) req.destroy(new Error('Invalid chunk length.'));
        });
        req.on('error', reject);
        output.on('error', reject);
        output.on('finish', resolve);
        req.pipe(output);
      });
      if (received !== contentLength) throw new Error('Incomplete chunk.');
    } else {
      // Drain a retried chunk that the server has already committed.
      for await (const chunk of req) received += chunk.length;
      if (received !== contentLength) throw new Error('Incomplete chunk.');
    }
    const result = await withUploadLock(id, async () => {
      const latest = JSON.parse(await readFile(paths.meta, 'utf8'));
      if (!latest.chunks?.[key]) {
        latest.chunks ||= {};
        latest.chunks[key] = received;
        latest.received += received;
        await writeFile(paths.meta, JSON.stringify(latest));
      }
      return { received: latest.received, complete: latest.received === latest.size };
    });
    res.json(result);
  } catch (err) {
    if (err?.code === 'ENOENT') return res.status(404).json({ error: 'Upload session not found.' });
    res.status(err?.status || 400).json({ error: err.message || 'The video chunk failed.' });
  }
});

router.get('/identity', async (req, res) => {
  const user = await resolveUser(req);
  res.json({ author: displayName(user), authorAvatar: user?.photo || '' });
});

router.get('/health', async (_req, res) => {
  try {
    if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) throw new Error('database disconnected');
    await Promise.all([
      mongoose.connection.db.command({ ping: 1 }),
      mkdir(uploadDirectory, { recursive: true }),
      access(uploadDirectory, fsConstants.R_OK | fsConstants.W_OK)
    ]);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, database: 'connected', mediaStorage: 'available' });
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    res.status(503).json({ ok: false, database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected', mediaStorage: 'unavailable' });
  }
});

router.post('/uploads/:id/complete', async (req, res) => {
  const id = String(req.params.id || '');
  const paths = sessionPaths(id);
  try {
    const metadata = JSON.parse(await readFile(paths.meta, 'utf8'));
    // Completing an upload is idempotent. Mobile clients retry this request
    // when a response is lost, so retain the tiny session manifest and return
    // the post that was already created instead of reporting a false 404 after
    // the video reached 100%.
    if (metadata.postId) {
      const existingPost = await FlamingoPost.findById(metadata.postId).lean();
      if (existingPost) return res.status(200).json({ post: existingPost });
    }
    const existingPost = await FlamingoPost.findOne({ 'attachment.url': new RegExp(`/files/${id}-`) }).lean();
    if (existingPost) return res.status(200).json({ post: existingPost });
    if (metadata.received !== metadata.size) return res.status(409).json({ error: 'The video has not finished uploading.', received: metadata.received });
    const storedName = `${id}-${metadata.name}`;
    const diskPath = path.join(uploadDirectory, storedName);
    await commitFlamingoMedia(paths.data, diskPath, metadata.size);
    const databaseFile = await persistDatabaseMedia(diskPath, storedName, {
      contentType: metadata.type, originalName: metadata.name, size: metadata.size
    });
    const user = await resolveUser(req);
    const attachment = { name: metadata.name, size: metadata.size, type: metadata.type, duration: metadata.duration, premium: metadata.premium && metadata.priceTpg > 0, priceTpg: metadata.premium ? metadata.priceTpg : 0, url: `/api/flamingo-wall/files/${storedName}`, ...(databaseFile?._id ? { databaseFileId: databaseFile._id } : {}) };
    const post = await FlamingoPost.create({ text: metadata.text, author: displayName(user), authorAvatar: user?.photo || '', authorAccountId: user?.accountId || '', attachment, ownerTokenHash: metadata.ownerTokenHash });
    metadata.postId = String(post._id);
    metadata.completedAt = Date.now();
    await writeFile(paths.meta, JSON.stringify(metadata));
    publishWallEvent('created', String(post._id));
    res.status(201).json({ post });
  } catch (err) {
    if (err?.code === 'ENOENT') {
      // Completion may already have succeeded even if its response was lost.
      // Return the existing post so a safe client retry cannot show failure.
      const post = await FlamingoPost.findOne({ 'attachment.url': new RegExp(`/files/${id}-`) }).lean();
      if (post) return res.status(200).json({ post });
      return res.status(404).json({ error: 'Upload session not found. Please retry.' });
    }
    res.status(500).json({ error: publicUploadError(err) });
  }
});

router.get('/events', (req, res) => {
  // Server-sent invalidations make the feed update immediately after another
  // visitor publishes. The regular feed request remains the source of truth.
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  const send = event => res.write(`event: wall-change\ndata: ${JSON.stringify(event)}\n\n`);
  const heartbeat = setInterval(() => res.write(': keep-alive\n\n'), 20_000);
  wallEvents.on('change', send);
  req.on('close', () => { clearInterval(heartbeat); wallEvents.off('change', send); });
});

router.get('/posts', async (req, res) => {
  const token = ownerToken(req);
  const posts = await FlamingoPost.find().select('+ownerTokenHash').sort({ createdAt: -1 }).lean();
  // The wall is a shared live feed. Never let a browser/proxy reuse an old
  // response while another community member is publishing.
  res.setHeader('Cache-Control', 'no-store');
  res.json({ posts: serializeWallPosts(posts, token) });
});

router.get('/latest-post', async (req, res) => {
  const post = await FlamingoPost.findOne().sort({ createdAt: -1 }).lean();
  res.setHeader('Cache-Control', 'no-store');
  res.json({ post: latestWallPost(post) });
});

router.post('/posts/content', express.json({ limit: '16kb' }), async (req, res) => {
  const text = String(req.body?.text || '').trim();
  const title = String(req.body?.title || '').trim();
  const question = String(req.body?.poll?.question || '').trim();
  const options = Array.isArray(req.body?.poll?.options)
    ? req.body.poll.options.map(option => String(option).trim()).filter(Boolean).slice(0, 4)
    : [];
  if (!text && !title && (!question || options.length < 2)) {
    return res.status(400).json({ error: 'The post has no content.' });
  }
  const user = await resolveUser(req);
  const poll = question && options.length >= 2
    ? { question: question.slice(0, 300), options: options.map(option => option.slice(0, 160)), votes: options.map(() => 0) }
    : undefined;
  const post = await FlamingoPost.create({
    text: text.slice(0, 8000),
    title: title ? title.slice(0, 120) : undefined,
    poll,
    author: displayName(user).slice(0, 120),
    authorAvatar: user?.photo || '',
    authorAccountId: user?.accountId || '',
    ownerTokenHash: tokenHash(ownerToken(req))
  });
  publishWallEvent('created', String(post._id));
  res.status(201).json({ post });
});

router.post('/posts', async (req, res) => {
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
      const post = await FlamingoPost.create({ text: text.slice(0, 1200), author, authorAvatar: user?.photo || '', authorAccountId: user?.accountId || '', attachment, ownerTokenHash: tokenHash(ownerToken(req)) });
      completed = true;
      publishWallEvent('created', String(post._id));
      res.status(201).json({ post });
    } catch (err) {
      if (upload?.diskPath) await rm(upload.diskPath, { force: true });
      if (!res.headersSent) res.status(500).json({ error: publicUploadError(err) });
    }
  });
  req.pipe(busboy);
});

router.patch('/posts/:id', express.json({ limit: '16kb' }), async (req, res) => {
  const post = await FlamingoPost.findById(req.params.id).select('+ownerTokenHash');
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  if (!ownsPost(post, ownerToken(req))) return res.status(403).json({ error: 'Only the author can edit this post.' });
  post.text = String(req.body?.text || '').trim().slice(0, 1200);
  await post.save();
  publishWallEvent('updated', String(post._id));
  res.json({ post: { ...post.toObject(), ownerTokenHash: undefined, canManage: true } });
});

router.delete('/posts/:id', async (req, res) => {
  const post = await FlamingoPost.findById(req.params.id).select('+ownerTokenHash');
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  if (!ownsPost(post, ownerToken(req))) return res.status(403).json({ error: 'Only the author can delete this post.' });
  await post.deleteOne();
  publishWallEvent('deleted', String(post._id));
  if (post.attachment?.url) await removeFlamingoMedia(flamingoMediaName(post.attachment.url), mediaDirectories);
  res.status(204).end();
});

router.post('/posts/:id/download', async (req, res) => {
  const post = await FlamingoPost.findById(req.params.id).lean();
  if (!post?.attachment?.url) return res.status(404).json({ error: 'Video not found.' });
  const file = flamingoMediaName(post.attachment.url);
  // Check the morning/legacy location before taking any TPG. Older database
  // rows can have a missing or generic MIME type, but their original filename
  // is still sufficient to identify and serve the video.
  const [diskPath, databaseFile] = await Promise.all([
    findFlamingoMedia(file, mediaDirectories, post.attachment.name, post.attachment.size),
    findFlamingoDatabaseMedia(file, post.attachment.name, post.attachment.size, post.attachment.databaseFileId)
  ]);
  if (!diskPath && !databaseFile) return res.status(404).json({ error: 'The original video was not found in storage.' });
  const price = attachmentDownloadPrice(post.attachment);
  const selector = userSelector(req);
  if (price && !selector) return res.status(401).json({ error: 'Sign in to download the video.' });
  let user = selector ? await User.findOne(selector) : null;
  if (selector && !user) return res.status(404).json({ error: 'Account not found.' });
  if (price) {
    user = await User.findOneAndUpdate({ _id: user._id, balance: { $gte: price } }, {
      $inc: { balance: -price },
      $push: { transactions: { transactionId: randomUUID(), amount: -price, type: 'video_download', token: 'TPG', status: 'delivered', detail: String(post._id) } }
    }, { new: true });
    if (!user) return res.status(402).json({ error: `You need ${price} TPG to download this video.` });
  }
  const grant = createFlamingoDownloadGrant({ file, originalName: post.attachment.name, size: post.attachment.size });
  res.json({ downloadUrl: `/api/flamingo-wall/downloads/${grant}?name=${encodeURIComponent(post.attachment.name)}`, price, balance: user?.balance });
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
    return res.status(404).end();
  }
  backfillDatabaseMedia(diskPath, name, post?.attachment);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  return res.sendFile(diskPath, err => {
    if (err && !res.headersSent) res.status(err.statusCode || 404).end();
  });
});

export default router;
