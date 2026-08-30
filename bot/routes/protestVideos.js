import Busboy from 'busboy';
import { randomUUID } from 'crypto';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createReadStream, createWriteStream, existsSync } from 'fs';
import { copyFile, mkdir, open, readFile, rename, rm, stat, writeFile } from 'fs/promises';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const ONE_GB = 1024 * 1024 * 1024;
const MAX_VIDEO_BYTES = Number(process.env.PROTEST_VIDEO_MAX_BYTES || ONE_GB);
const VIDEO_LIBRARY_DIR = path.join(REPO_ROOT, 'webapp/public/ProtestVideo');
const VIDEO_DIST_ROOT = path.join(REPO_ROOT, 'webapp/dist');
const VIDEO_DIST_DIR = path.join(VIDEO_DIST_ROOT, 'ProtestVideo');
const UPLOAD_DIR = path.join(VIDEO_LIBRARY_DIR, '.uploads');
const CHUNK_BYTES = 8 * 1024 * 1024;
const MAX_PARALLEL_CHUNKS = 3;
const DEV_ACCOUNTS = [
  process.env.VITE_DEV_ACCOUNT_ID,
  process.env.VITE_DEV_ACCOUNT_ID_1,
  process.env.VITE_DEV_ACCOUNT_ID_2,
  process.env.DEV_ACCOUNT_ID,
  process.env.DEV_ACCOUNT_ID_1,
  process.env.DEV_ACCOUNT_ID_2
].filter(Boolean);

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function isAuthorized(req) {
  const account = normalize(req.get('x-tpc-account-id'));
  return Boolean(account && DEV_ACCOUNTS.some((devAccount) => normalize(devAccount) === account));
}

function sanitizeSlug(value, fallback = 'protest-video') {
  const slug = String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || fallback;
}

function sanitizeDate(value) {
  const date = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  return new Date().toISOString().slice(0, 10);
}

async function loadLibrary(libraryPath) {
  try {
    const parsed = JSON.parse(await readFile(libraryPath, 'utf8'));
    return { ...parsed, videos: Array.isArray(parsed.videos) ? parsed.videos : [] };
  } catch {
    return { videos: [] };
  }
}

async function saveLibrary(directory, entry) {
  await mkdir(directory, { recursive: true });
  const libraryPath = path.join(directory, 'library.json');
  const library = await loadLibrary(libraryPath);
  const videos = [entry, ...library.videos.filter((video) => video.id !== entry.id)];
  await writeFile(libraryPath, `${JSON.stringify({ ...library, videos }, null, 2)}\n`);
}

function uploadPaths(id) {
  if (!/^[a-z0-9-]{12,100}$/.test(id)) return null;
  return {
    data: path.join(UPLOAD_DIR, `${id}.part`),
    metadata: path.join(UPLOAD_DIR, `${id}.json`),
    chunk: (index) => path.join(UPLOAD_DIR, `${id}.${index}.done`)
  };
}

async function readUpload(id) {
  const paths = uploadPaths(id);
  if (!paths) return null;
  try {
    return { paths, metadata: JSON.parse(await readFile(paths.metadata, 'utf8')) };
  } catch {
    return null;
  }
}

async function publishVideo(upload, tempPath) {
  const ext = path.extname(upload.name).toLowerCase().replace(/[^.a-z0-9]/g, '') || '.mp4';
  const baseSlug = sanitizeSlug(path.basename(upload.name, ext));
  const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e6).toString(36)}`;
  const file = `${baseSlug}-${uniqueSuffix}${ext}`;
  const entry = {
    id: sanitizeSlug(`${baseSlug}-${uniqueSuffix}`),
    title: path.basename(upload.name, ext).replace(/[-_]+/g, ' '),
    date: sanitizeDate(upload.date),
    file
  };
  const publicPath = path.join(VIDEO_LIBRARY_DIR, file);
  await rename(tempPath, publicPath);
  const targetDirs = [VIDEO_LIBRARY_DIR];
  if (existsSync(VIDEO_DIST_ROOT)) {
    await mkdir(VIDEO_DIST_DIR, { recursive: true });
    await copyFile(publicPath, path.join(VIDEO_DIST_DIR, file));
    targetDirs.push(VIDEO_DIST_DIR);
  }
  await Promise.all(targetDirs.map((directory) => saveLibrary(directory, entry)));
  return { ...entry, source: 'library', url: `/api/protest-videos/download/${encodeURIComponent(file)}` };
}

// Resumable, parallel uploads keep the original video bytes untouched. Each chunk can
// retry independently, which is substantially faster and safer on mobile connections.
router.post('/uploads', express.json({ limit: '16kb' }), async (req, res) => {
  if (!isAuthorized(req)) return res.status(403).json({ error: 'Developer upload is locked.' });
  const size = Number(req.body?.size);
  const name = String(req.body?.name || 'protest-video.mp4');
  const mimeType = String(req.body?.type || '').toLowerCase();
  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_VIDEO_BYTES) {
    return res.status(400).json({ error: 'Invalid video size.' });
  }
  if (!mimeType.startsWith('video/')) return res.status(400).json({ error: 'Only video files can be uploaded.' });

  await mkdir(UPLOAD_DIR, { recursive: true });
  const id = `${Date.now().toString(36)}-${randomUUID().replaceAll('-', '')}`;
  const paths = uploadPaths(id);
  const chunks = Math.ceil(size / CHUNK_BYTES);
  const metadata = { id, name, mimeType, size, date: sanitizeDate(req.body?.date), chunks, createdAt: Date.now() };
  const handle = await open(paths.data, 'w');
  await handle.truncate(size);
  await handle.close();
  await writeFile(paths.metadata, JSON.stringify(metadata));
  res.status(201).json({ id, chunkSize: CHUNK_BYTES, chunks, parallel: MAX_PARALLEL_CHUNKS });
});

router.get('/uploads/:id', async (req, res) => {
  if (!isAuthorized(req)) return res.status(403).json({ error: 'Developer upload is locked.' });
  const upload = await readUpload(req.params.id);
  if (!upload) return res.status(404).json({ error: 'Upload not found.' });
  const received = [];
  for (let index = 0; index < upload.metadata.chunks; index += 1) {
    if (existsSync(upload.paths.chunk(index))) received.push(index);
  }
  res.json({ ...upload.metadata, received });
});

router.put('/uploads/:id/chunks/:index', express.raw({ type: 'application/octet-stream', limit: `${CHUNK_BYTES}b` }), async (req, res) => {
  if (!isAuthorized(req)) return res.status(403).json({ error: 'Developer upload is locked.' });
  const upload = await readUpload(req.params.id);
  const index = Number(req.params.index);
  if (!upload || !Number.isInteger(index) || index < 0 || index >= upload.metadata.chunks) {
    return res.status(404).json({ error: 'Upload chunk not found.' });
  }
  const expected = Math.min(CHUNK_BYTES, upload.metadata.size - index * CHUNK_BYTES);
  if (!Buffer.isBuffer(req.body) || req.body.length !== expected) {
    return res.status(400).json({ error: `Chunk must contain exactly ${expected} bytes.` });
  }
  const handle = await open(upload.paths.data, 'r+');
  try {
    await handle.write(req.body, 0, req.body.length, index * CHUNK_BYTES);
  } finally {
    await handle.close();
  }
  await writeFile(upload.paths.chunk(index), String(req.body.length));
  res.status(204).end();
});

router.post('/uploads/:id/complete', async (req, res) => {
  if (!isAuthorized(req)) return res.status(403).json({ error: 'Developer upload is locked.' });
  const upload = await readUpload(req.params.id);
  if (!upload) return res.status(404).json({ error: 'Upload not found.' });
  for (let index = 0; index < upload.metadata.chunks; index += 1) {
    if (!existsSync(upload.paths.chunk(index))) return res.status(409).json({ error: 'Upload is incomplete.', missingChunk: index });
  }
  const video = await publishVideo(upload.metadata, upload.paths.data);
  await Promise.all([
    rm(upload.paths.metadata, { force: true }),
    ...Array.from({ length: upload.metadata.chunks }, (_, index) => rm(upload.paths.chunk(index), { force: true }))
  ]);
  res.status(201).json({ video });
});

router.get('/download/:file', async (req, res) => {
  const file = path.basename(req.params.file);
  if (file !== req.params.file || file.startsWith('.')) return res.status(404).end();
  const filePath = path.join(VIDEO_LIBRARY_DIR, file);
  let fileStat;
  try { fileStat = await stat(filePath); } catch { return res.status(404).end(); }
  const range = req.get('range');
  res.set({ 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=31536000, immutable', 'Content-Type': 'video/mp4' });
  if (!range) {
    res.set('Content-Length', String(fileStat.size));
    return createReadStream(filePath).pipe(res);
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match || (!match[1] && !match[2])) return res.status(416).set('Content-Range', `bytes */${fileStat.size}`).end();
  const suffixLength = !match[1] && match[2] ? Number(match[2]) : null;
  const start = suffixLength === null ? Number(match[1]) : Math.max(fileStat.size - suffixLength, 0);
  const end = suffixLength === null && match[2] ? Math.min(Number(match[2]), fileStat.size - 1) : fileStat.size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= fileStat.size) {
    return res.status(416).set('Content-Range', `bytes */${fileStat.size}`).end();
  }
  res.status(206).set({ 'Content-Range': `bytes ${start}-${end}/${fileStat.size}`, 'Content-Length': String(end - start + 1) });
  return createReadStream(filePath, { start, end }).pipe(res);
});

function parseUpload(req) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({
      headers: req.headers,
      limits: { fileSize: MAX_VIDEO_BYTES, files: 1, fields: 2 }
    });
    const fields = {};
    const upload = { bytes: 0, limited: false, mimeType: '', originalName: '', tempPath: '' };
    let writePromise = null;
    let hasFile = false;

    busboy.on('field', (name, value) => {
      if (name === 'date') fields.date = value;
    });

    busboy.on('file', (name, file, info) => {
      if (name !== 'video') {
        file.resume();
        return;
      }
      hasFile = true;
      upload.mimeType = String(info.mimeType || '').toLowerCase();
      upload.originalName = info.filename || 'protest-video.mp4';
      upload.tempPath = path.join(VIDEO_LIBRARY_DIR, `.upload-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);
      const output = createWriteStream(upload.tempPath);
      file.on('data', (chunk) => {
        upload.bytes += chunk.length;
      });
      file.on('limit', () => {
        upload.limited = true;
        file.unpipe(output);
        output.destroy();
      });
      writePromise = new Promise((resolveWrite, rejectWrite) => {
        output.on('finish', resolveWrite);
        output.on('error', rejectWrite);
        file.on('error', rejectWrite);
      });
      file.pipe(output);
    });

    busboy.on('error', reject);
    busboy.on('finish', async () => {
      try {
        if (writePromise) await writePromise;
        if (!hasFile) throw new Error('A video file is required.');
        resolve({ fields, upload });
      } catch (err) {
        reject(err);
      }
    });

    req.pipe(busboy);
  });
}

router.post('/upload', async (req, res) => {
  if (!isAuthorized(req)) return res.status(403).json({ error: 'Developer upload is locked.' });

  await mkdir(VIDEO_LIBRARY_DIR, { recursive: true });
  let parsed;
  try {
    parsed = await parseUpload(req);
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Upload failed.' });
  }

  const { fields, upload } = parsed;
  if (upload.limited || upload.bytes > MAX_VIDEO_BYTES) {
    if (upload.tempPath) await rm(upload.tempPath, { force: true });
    return res.status(413).json({ error: 'Video file is too large. Maximum size is 1GB.' });
  }
  if (!upload.mimeType.startsWith('video/')) {
    if (upload.tempPath) await rm(upload.tempPath, { force: true });
    return res.status(400).json({ error: 'Only video files can be uploaded.' });
  }

  const video = await publishVideo({ name: upload.originalName, date: fields.date }, upload.tempPath);
  res.status(201).json({ video });
});

export default router;
