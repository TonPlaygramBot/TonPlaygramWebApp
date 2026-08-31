import Busboy from 'busboy';
import express from 'express';
import path from 'path';
import { createWriteStream } from 'fs';
import { mkdir, readFile, rename, rm, truncate, writeFile } from 'fs/promises';
import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import FlamingoPost from '../models/FlamingoPost.js';
import User from '../models/User.js';
import { optionalAuthenticate } from '../middleware/auth.js';

const router = express.Router();
const uploadDirectory = path.resolve('data/flamingo-uploads');
const maxBytes = Math.max(1, Number(process.env.FLAMINGO_UPLOAD_MAX_BYTES) || 5 * 1024 ** 3);
// Keep each request small enough for mobile networks while allowing several
// independent ranges to be written at once. Six 8 MB requests use less memory
// than the former three 32 MB requests and no longer queue behind one another.
const maxChunkBytes = Math.max(1024 ** 2, Number(process.env.FLAMINGO_UPLOAD_CHUNK_BYTES) || 8 * 1024 ** 2);
const pendingDirectory = path.join(uploadDirectory, '.pending');
const downloadGrants = new Map();
const uploadLocks = new Map();

router.use(optionalAuthenticate);

const safeName = (name) => path.basename(String(name || 'file'))
  .normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-160) || 'file';

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
const displayName = user => user?.nickname || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Anëtar i komunitetit';
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
const normalizedAuthor = author => String(author || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLocaleLowerCase('sq');
const isCommitteeVideo = post => post?.attachment?.type?.startsWith('video/')
  && normalizedAuthor(post.author) === 'antar i komitetit';
const ownsPost = (post, token) => {
  if (!post.ownerTokenHash || !token) return false;
  const supplied = Buffer.from(tokenHash(token));
  const stored = Buffer.from(post.ownerTokenHash);
  return supplied.length === stored.length && timingSafeEqual(supplied, stored);
};

// Large videos are uploaded in small, retryable requests. This avoids mobile and
// reverse-proxy timeouts that occur when a multi-gigabyte request stays open.
router.post('/uploads', async (req, res) => {
  const size = Number(req.get('x-upload-size'));
  if (!Number.isSafeInteger(size) || size < 1 || size > maxBytes) {
    return res.status(413).json({ error: `Skedari duhet të jetë më i vogël se ${Math.floor(maxBytes / 1024 ** 3)} GB.` });
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
    type: decodeHeader(req.get('x-upload-type'), 'application/octet-stream'),
    duration: Math.max(0, Number(req.get('x-upload-duration')) || 0),
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
    return res.status(409).json({ error: 'Ky identifikues ngarkimi është përdorur.' });
  } catch (err) {
    if (err?.code !== 'ENOENT') throw err;
  }
  await Promise.all([writeFile(paths.data, ''), writeFile(paths.meta, JSON.stringify(metadata))]);
  await truncate(paths.data, size);
  res.status(201).json({ uploadId: id, chunkBytes: maxChunkBytes });
});

router.put('/uploads/:id', async (req, res) => {
  const id = String(req.params.id || '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(404).json({ error: 'Ngarkimi nuk u gjet.' });
  const paths = sessionPaths(id);
  try {
    const offset = Number(req.get('x-upload-offset'));
    const contentLength = Number(req.get('content-length'));
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(contentLength) || contentLength < 1 || contentLength > maxChunkBytes) {
      return res.status(413).json({ error: 'Pjesa e videos është shumë e madhe.' });
    }
    const metadata = await withUploadLock(id, async () => {
      const metadata = JSON.parse(await readFile(paths.meta, 'utf8'));
      const expectedLength = Math.min(maxChunkBytes, metadata.size - offset);
      if (offset >= metadata.size || offset % maxChunkBytes !== 0 || contentLength !== expectedLength) throw Object.assign(new Error('Pjesa është jashtë kufijve.'), { status: 409 });
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
    if (err?.code === 'ENOENT') return res.status(404).json({ error: 'Ngarkimi nuk u gjet.' });
    res.status(err?.status || 400).json({ error: err.message || 'Pjesa e videos dështoi.' });
  }
});

router.get('/identity', async (req, res) => {
  const user = await resolveUser(req);
  res.json({ author: displayName(user), authorAvatar: user?.photo || '' });
});

router.post('/uploads/:id/complete', async (req, res) => {
  const id = String(req.params.id || '');
  const paths = sessionPaths(id);
  try {
    const metadata = JSON.parse(await readFile(paths.meta, 'utf8'));
    if (metadata.received !== metadata.size) return res.status(409).json({ error: 'Videoja nuk është ngarkuar plotësisht.', received: metadata.received });
    const storedName = `${id}-${metadata.name}`;
    await rename(paths.data, path.join(uploadDirectory, storedName));
    await rm(paths.meta, { force: true });
    const user = await resolveUser(req);
    const attachment = { name: metadata.name, size: metadata.size, type: metadata.type, duration: metadata.duration, url: `/api/flamingo-wall/files/${storedName}` };
    const post = await FlamingoPost.create({ text: metadata.text, author: displayName(user), authorAvatar: user?.photo || '', authorAccountId: user?.accountId || '', attachment, ownerTokenHash: metadata.ownerTokenHash });
    res.status(201).json({ post });
  } catch (err) {
    if (err?.code === 'ENOENT') {
      // Completion may already have succeeded even if its response was lost.
      // Return the existing post so a safe client retry cannot show failure.
      const post = await FlamingoPost.findOne({ 'attachment.url': new RegExp(`/files/${id}-`) }).lean();
      if (post) return res.status(200).json({ post });
      return res.status(404).json({ error: 'Ngarkimi nuk u gjet.' });
    }
    res.status(500).json({ error: err.message || 'Publikimi dështoi.' });
  }
});

router.get('/posts', async (req, res) => {
  const token = ownerToken(req);
  const posts = await FlamingoPost.find().select('+ownerTokenHash').sort({ createdAt: -1 }).lean();
  const committeeVideos = posts.filter(isCommitteeVideo);
  if (committeeVideos.length) {
    // Remove the withdrawn committee video from both the feed and storage.
    // Normalizing the author also catches the previous spelling with "ë".
    await Promise.allSettled(committeeVideos.map(async post => {
      await FlamingoPost.deleteOne({ _id: post._id });
      if (post.attachment?.url) await rm(path.join(uploadDirectory, path.basename(post.attachment.url)), { force: true });
    }));
  }
  // The wall is a shared live feed. Never let a browser/proxy reuse an old
  // response while another community member is publishing.
  res.setHeader('Cache-Control', 'no-store');
  res.json({ posts: posts.filter(post => !isCommitteeVideo(post)).map(({ ownerTokenHash, ...post }) => ({ ...post, canManage: ownsPost({ ownerTokenHash }, token) })) });
});

router.post('/posts/content', express.json({ limit: '16kb' }), async (req, res) => {
  const text = String(req.body?.text || '').trim();
  const title = String(req.body?.title || '').trim();
  const question = String(req.body?.poll?.question || '').trim();
  const options = Array.isArray(req.body?.poll?.options)
    ? req.body.poll.options.map(option => String(option).trim()).filter(Boolean).slice(0, 4)
    : [];
  if (!text && !title && (!question || options.length < 2)) {
    return res.status(400).json({ error: 'Postimi nuk ka përmbajtje.' });
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
        return res.status(413).json({ error: `Skedari tejkalon kufirin maksimal prej ${Math.floor(maxBytes / 1024 ** 3)} GB.` });
      }
      const text = String(fields.text || '').trim();
      if (!text && !upload) return res.status(400).json({ error: 'Shkruaj diçka ose zgjidh një skedar.' });
      const user = await resolveUser(req);
      const author = displayName(user).slice(0, 120);
      const attachment = upload ? { name: upload.originalName, size: upload.size, type: upload.type, url: `/api/flamingo-wall/files/${upload.storedName}` } : undefined;
      const post = await FlamingoPost.create({ text: text.slice(0, 1200), author, authorAvatar: user?.photo || '', authorAccountId: user?.accountId || '', attachment, ownerTokenHash: tokenHash(ownerToken(req)) });
      completed = true;
      res.status(201).json({ post });
    } catch (err) {
      if (upload?.diskPath) await rm(upload.diskPath, { force: true });
      if (!res.headersSent) res.status(500).json({ error: err.message || 'Ngarkimi dështoi.' });
    }
  });
  req.pipe(busboy);
});

router.patch('/posts/:id', express.json({ limit: '16kb' }), async (req, res) => {
  const post = await FlamingoPost.findById(req.params.id).select('+ownerTokenHash');
  if (!post) return res.status(404).json({ error: 'Postimi nuk u gjet.' });
  if (!ownsPost(post, ownerToken(req))) return res.status(403).json({ error: 'Vetëm autori mund ta ndryshojë postimin.' });
  post.text = String(req.body?.text || '').trim().slice(0, 1200);
  await post.save();
  res.json({ post: { ...post.toObject(), ownerTokenHash: undefined, canManage: true } });
});

router.delete('/posts/:id', async (req, res) => {
  const post = await FlamingoPost.findById(req.params.id).select('+ownerTokenHash');
  if (!post) return res.status(404).json({ error: 'Postimi nuk u gjet.' });
  if (!ownsPost(post, ownerToken(req))) return res.status(403).json({ error: 'Vetëm autori mund ta fshijë postimin.' });
  await post.deleteOne();
  if (post.attachment?.url) await rm(path.join(uploadDirectory, path.basename(post.attachment.url)), { force: true });
  res.status(204).end();
});

router.post('/posts/:id/download', async (req, res) => {
  const selector = userSelector(req);
  if (!selector) return res.status(401).json({ error: 'Hyr në llogari për ta shkarkuar videon.' });
  const post = await FlamingoPost.findById(req.params.id).lean();
  if (!post?.attachment?.url) return res.status(404).json({ error: 'Videoja nuk u gjet.' });
  const price = post.attachment.type.startsWith('video/') ? videoPrice(post.attachment.duration) : 0;
  let user = await User.findOne(selector);
  if (!user) return res.status(404).json({ error: 'Llogaria nuk u gjet.' });
  if (price) {
    user = await User.findOneAndUpdate({ _id: user._id, balance: { $gte: price } }, {
      $inc: { balance: -price },
      $push: { transactions: { transactionId: randomUUID(), amount: -price, type: 'video_download', token: 'TPG', status: 'delivered', detail: String(post._id) } }
    }, { new: true });
    if (!user) return res.status(402).json({ error: `Të duhen ${price} TPG për ta shkarkuar këtë video.` });
  }
  const grant = randomUUID();
  downloadGrants.set(grant, { file: path.basename(post.attachment.url), expiresAt: Date.now() + 5 * 60_000 });
  res.json({ downloadUrl: `/api/flamingo-wall/downloads/${grant}?name=${encodeURIComponent(post.attachment.name)}`, price, balance: user.balance });
});

router.get('/downloads/:grant', (req, res) => {
  const grant = downloadGrants.get(req.params.grant);
  if (!grant || grant.expiresAt < Date.now()) return res.status(403).json({ error: 'Lidhja e shkarkimit ka skaduar.' });
  const requestedName = path.basename(String(req.query.name || grant.file)).replace(/["\\\r\n]/g, '');
  // sendFile (used by res.download) supports byte ranges; these headers make
  // that resumable behavior explicit and let a briefly interrupted phone
  // download continue without transferring the completed bytes again.
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.download(path.join(uploadDirectory, grant.file), requestedName);
});

router.get('/files/:name', async (req, res) => {
  const name = path.basename(req.params.name);
  if (req.query.download === '1') {
    const post = await FlamingoPost.findOne({ 'attachment.url': `/api/flamingo-wall/files/${name}` }).lean();
    if (post?.attachment?.type?.startsWith('video/')) {
      return res.status(403).json({ error: 'Përdor butonin e shkarkimit që të zbatohet pagesa TPG.' });
    }
  }
  const disposition = req.query.download === '1' ? 'attachment' : 'inline';
  const requestedName = path.basename(String(req.query.name || name)).replace(/["\\\r\n]/g, '');
  const asciiName = requestedName.replace(/[^\x20-\x7E]/g, '_');
  res.setHeader('Content-Disposition', `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(requestedName)}`);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.sendFile(path.join(uploadDirectory, name), err => {
    if (err && !res.headersSent) res.status(err.statusCode || 404).end();
  });
});

export default router;
