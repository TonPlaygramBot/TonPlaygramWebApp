import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const MAX_VIDEO_BYTES = Number(process.env.PROTEST_VIDEO_MAX_BYTES || 250 * 1024 * 1024);
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
  const configuredToken = process.env.PROTEST_VIDEO_UPLOAD_TOKEN;
  const requestToken = req.get('x-protest-video-upload-token') || req.body?.uploadToken;
  if (configuredToken && requestToken === configuredToken) return true;

  const account = normalize(req.body?.accountId || req.get('x-tpc-account-id'));
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

function normalizeVideoPayload(fileData) {
  const match = String(fileData || '').match(/^data:(video\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (!match) return null;
  return { mimeType: match[1].toLowerCase(), buffer: Buffer.from(match[2], 'base64') };
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

router.post('/upload', express.json({ limit: process.env.PROTEST_VIDEO_UPLOAD_LIMIT || '300mb' }), async (req, res) => {
  if (!isAuthorized(req)) return res.status(403).json({ error: 'Developer upload is locked.' });

  const payload = normalizeVideoPayload(req.body?.fileData);
  if (!payload) return res.status(400).json({ error: 'A video file is required.' });
  if (!payload.mimeType.startsWith('video/')) return res.status(400).json({ error: 'Only video files can be uploaded.' });
  if (payload.buffer.length > MAX_VIDEO_BYTES) return res.status(413).json({ error: 'Video file is too large.' });

  const originalName = String(req.body?.fileName || 'protest-video.mp4');
  const ext = path.extname(originalName).toLowerCase().replace(/[^.a-z0-9]/g, '') || '.mp4';
  const baseSlug = sanitizeSlug(req.body?.title || path.basename(originalName, ext));
  const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e6).toString(36)}`;
  const file = `${baseSlug}-${uniqueSuffix}${ext}`;
  const id = sanitizeSlug(`${baseSlug}-${uniqueSuffix}`);
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString().slice(11, 16);
  const entry = {
    id,
    title: String(req.body?.title || path.basename(originalName, ext)).trim(),
    date: String(req.body?.date || today).trim(),
    time: String(req.body?.time || now).trim(),
    timezone: String(req.body?.timezone || 'UTC').trim(),
    quality: String(req.body?.quality || 'Mobile upload').trim(),
    file,
    description: String(req.body?.description || '').trim()
  };

  const targetDirs = [VIDEO_LIBRARY_DIR];
  if (existsSync(VIDEO_DIST_ROOT)) targetDirs.push(VIDEO_DIST_DIR);

  await Promise.all(targetDirs.map(async (directory) => {
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, file), payload.buffer);
    await saveLibrary(directory, entry);
  }));

  res.status(201).json({ video: { ...entry, source: 'library', url: `/ProtestVideo/${file}` } });
});

export default router;
