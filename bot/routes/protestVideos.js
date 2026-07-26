import Busboy from 'busboy';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { copyFile, mkdir, readFile, rename, rm, writeFile } from 'fs/promises';
import { createWriteStream } from 'fs';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const ONE_GB = 1024 * 1024 * 1024;
const MAX_VIDEO_BYTES = Number(process.env.PROTEST_VIDEO_MAX_BYTES || ONE_GB);
const VIDEO_LIBRARY_DIR = path.join(REPO_ROOT, 'webapp/public/ProtestVideo');
const VIDEO_DIST_ROOT = path.join(REPO_ROOT, 'webapp/dist');
const VIDEO_DIST_DIR = path.join(VIDEO_DIST_ROOT, 'ProtestVideo');
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

  const ext = path.extname(upload.originalName).toLowerCase().replace(/[^.a-z0-9]/g, '') || '.mp4';
  const baseSlug = sanitizeSlug(path.basename(upload.originalName, ext));
  const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e6).toString(36)}`;
  const file = `${baseSlug}-${uniqueSuffix}${ext}`;
  const id = sanitizeSlug(`${baseSlug}-${uniqueSuffix}`);
  const entry = {
    id,
    title: path.basename(upload.originalName, ext).replace(/[-_]+/g, ' '),
    date: sanitizeDate(fields.date),
    file
  };

  const publicPath = path.join(VIDEO_LIBRARY_DIR, file);
  await rename(upload.tempPath, publicPath);

  const targetDirs = [VIDEO_LIBRARY_DIR];
  if (existsSync(VIDEO_DIST_ROOT)) {
    await mkdir(VIDEO_DIST_DIR, { recursive: true });
    await copyFile(publicPath, path.join(VIDEO_DIST_DIR, file));
    targetDirs.push(VIDEO_DIST_DIR);
  }

  await Promise.all(targetDirs.map((directory) => saveLibrary(directory, entry)));
  res.status(201).json({ video: { ...entry, source: 'library', url: `/ProtestVideo/${file}` } });
});

export default router;
