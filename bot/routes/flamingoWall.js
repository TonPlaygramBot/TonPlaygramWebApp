import Busboy from 'busboy';
import express from 'express';
import path from 'path';
import { createWriteStream } from 'fs';
import { mkdir, rm } from 'fs/promises';
import { randomUUID } from 'crypto';
import FlamingoPost from '../models/FlamingoPost.js';

const router = express.Router();
const uploadDirectory = path.resolve('data/flamingo-uploads');
const maxBytes = Math.max(1, Number(process.env.FLAMINGO_UPLOAD_MAX_BYTES) || 1024 ** 3);

const safeName = (name) => path.basename(String(name || 'file'))
  .normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-160) || 'file';

router.get('/posts', async (_req, res) => {
  const posts = await FlamingoPost.find().sort({ createdAt: -1 }).limit(100).lean();
  res.json({ posts });
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
        return res.status(413).json({ error: 'Skedari tejkalon kufirin maksimal prej 1 GB.' });
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
  res.setHeader('Content-Disposition', `${disposition}; filename="${requestedName}"`);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.sendFile(path.join(uploadDirectory, name), err => {
    if (err && !res.headersSent) res.status(err.statusCode || 404).end();
  });
});

export default router;
