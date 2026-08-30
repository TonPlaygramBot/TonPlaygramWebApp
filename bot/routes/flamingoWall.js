import Busboy from 'busboy';
import express from 'express';
import path from 'path';
import { createWriteStream } from 'fs';
import { appendFile, mkdir, readFile, rename, rm, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import FlamingoPost from '../models/FlamingoPost.js';

const router = express.Router();
const uploadDirectory = path.resolve('data/flamingo-uploads');
const maxBytes = Math.max(1, Number(process.env.FLAMINGO_UPLOAD_MAX_BYTES) || 5 * 1024 ** 3);
const maxChunkBytes = Math.max(1024 ** 2, Number(process.env.FLAMINGO_UPLOAD_CHUNK_BYTES) || 8 * 1024 ** 2);
const pendingDirectory = path.join(uploadDirectory, '.pending');

const safeName = (name) => path.basename(String(name || 'file'))
  .normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-160) || 'file';

const decodeHeader = (value, fallback = '') => {
  try { return decodeURIComponent(String(value || fallback)); } catch { return fallback; }
};

const sessionPaths = (id) => ({
  data: path.join(pendingDirectory, `${id}.part`),
  meta: path.join(pendingDirectory, `${id}.json`)
});

// The protest wall intentionally starts fresh and retains only its newest
// uploaded video. Remove both stale database rows and their orphaned files.
async function retainLatestVideo() {
  const latestVideo = await FlamingoPost.findOne({ 'attachment.type': /^video\//i }).sort({ createdAt: -1 }).lean();
  const stalePosts = await FlamingoPost.find(latestVideo ? { _id: { $ne: latestVideo._id } } : {}).lean();
  await FlamingoPost.deleteMany(latestVideo ? { _id: { $ne: latestVideo._id } } : {});
  await Promise.all(stalePosts.map(post => {
    if (!post.attachment?.url) return Promise.resolve();
    const storedName = path.basename(post.attachment.url);
    return rm(path.join(uploadDirectory, storedName), { force: true });
  }));
  return latestVideo;
}

// Large videos are uploaded in small, retryable requests. This avoids mobile and
// reverse-proxy timeouts that occur when a multi-gigabyte request stays open.
router.post('/uploads', async (req, res) => {
  const size = Number(req.get('x-upload-size'));
  if (!Number.isSafeInteger(size) || size < 1 || size > maxBytes) {
    return res.status(413).json({ error: `Skedari duhet të jetë më i vogël se ${Math.floor(maxBytes / 1024 ** 3)} GB.` });
  }
  const id = randomUUID();
  const paths = sessionPaths(id);
  const metadata = {
    id,
    size,
    received: 0,
    name: safeName(decodeHeader(req.get('x-upload-name'), 'video.mp4')),
    type: decodeHeader(req.get('x-upload-type'), 'application/octet-stream'),
    text: decodeHeader(req.get('x-upload-text')).slice(0, 1200),
    author: decodeHeader(req.get('x-upload-author'), 'Anëtar i komunitetit').slice(0, 120),
    createdAt: Date.now()
  };
  await mkdir(pendingDirectory, { recursive: true });
  await Promise.all([writeFile(paths.data, ''), writeFile(paths.meta, JSON.stringify(metadata))]);
  res.status(201).json({ uploadId: id, chunkBytes: maxChunkBytes });
});

router.put('/uploads/:id', async (req, res) => {
  const id = String(req.params.id || '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(404).json({ error: 'Ngarkimi nuk u gjet.' });
  const paths = sessionPaths(id);
  try {
    const metadata = JSON.parse(await readFile(paths.meta, 'utf8'));
    const offset = Number(req.get('x-upload-offset'));
    const contentLength = Number(req.get('content-length'));
    if (offset !== metadata.received) return res.status(409).json({ error: 'Pjesa është jashtë radhe.', received: metadata.received });
    if (!Number.isSafeInteger(contentLength) || contentLength < 1 || contentLength > maxChunkBytes || metadata.received + contentLength > metadata.size) {
      return res.status(413).json({ error: 'Pjesa e videos është shumë e madhe.' });
    }
    const chunks = [];
    let received = 0;
    for await (const chunk of req) {
      received += chunk.length;
      if (received > contentLength) throw new Error('Invalid chunk length.');
      chunks.push(chunk);
    }
    if (received !== contentLength) throw new Error('Incomplete chunk.');
    await appendFile(paths.data, Buffer.concat(chunks));
    metadata.received += received;
    await writeFile(paths.meta, JSON.stringify(metadata));
    res.json({ received: metadata.received, complete: metadata.received === metadata.size });
  } catch (err) {
    if (err?.code === 'ENOENT') return res.status(404).json({ error: 'Ngarkimi nuk u gjet.' });
    res.status(400).json({ error: err.message || 'Pjesa e videos dështoi.' });
  }
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
    const attachment = { name: metadata.name, size: metadata.size, type: metadata.type, url: `/api/flamingo-wall/files/${storedName}` };
    const post = await FlamingoPost.create({ text: metadata.text, author: metadata.author, attachment });
    res.status(201).json({ post });
  } catch (err) {
    if (err?.code === 'ENOENT') return res.status(404).json({ error: 'Ngarkimi nuk u gjet.' });
    res.status(500).json({ error: err.message || 'Publikimi dështoi.' });
  }
});

router.get('/posts', async (_req, res) => {
  const latestVideo = await retainLatestVideo();
  res.json({ posts: latestVideo ? [latestVideo] : [] });
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
      const identity = req.auth?.telegramId || req.get('x-tpc-account-id') || req.get('x-google-id');
      const author = String(fields.author || (identity ? `Anëtar ${identity}` : 'Anëtar i komunitetit')).slice(0, 120);
      const attachment = upload ? { name: upload.originalName, size: upload.size, type: upload.type, url: `/api/flamingo-wall/files/${upload.storedName}` } : undefined;
      const post = await FlamingoPost.create({ text: text.slice(0, 1200), author, attachment });
      completed = true;
      res.status(201).json({ post });
    } catch (err) {
      if (upload?.diskPath) await rm(upload.diskPath, { force: true });
      if (!res.headersSent) res.status(500).json({ error: err.message || 'Ngarkimi dështoi.' });
    }
  });
  req.pipe(busboy);
});

router.get('/files/:name', (req, res) => {
  const name = path.basename(req.params.name);
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
