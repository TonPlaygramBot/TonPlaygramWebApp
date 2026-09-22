import path from 'node:path';
import { mkdir, open, statfs, unlink } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Media } from './models.js';
import { digest, matches, problem, publicOrigin, sign } from './security.js';
const run = promisify(execFile);
export const CHUNK = 1024 * 1024;
export const MAX_MEDIA = 250 * 1024 * 1024;
export function mediaDirectory() {
  if (process.env.CREATOR_MEDIA_DIR) return path.resolve(process.env.CREATOR_MEDIA_DIR);
  if (process.env.FLAMINGO_UPLOAD_DIR) return path.resolve(process.env.FLAMINGO_UPLOAD_DIR, '../creator-media');
  if (process.env.NODE_ENV === 'production' || process.env.RENDER) throw problem(503, 'Studio uploads are being prepared. Please try again later.');
  return path.resolve('uploads/creator');
}
export function mediaPath(media) { return path.join(mediaDirectory(), `${media._id}.media`); }
export const supportedMime = ['image/jpeg', 'image/png', 'video/mp4'];
export async function reserveMedia(owner, input) {
  if (!supportedMime.includes(input.mime) || !Number.isSafeInteger(input.size) || input.size < 1 || input.size > MAX_MEDIA) throw problem(400, 'Choose a JPG, PNG or MP4 file up to 250 MB.');
  const usage = await Media.aggregate([{ $match: { owner } }, { $group: { _id: null, size: { $sum: '$size' } } }]);
  if ((usage[0]?.size || 0) + input.size > 1024 ** 3) throw problem(400, 'Your Studio media storage is full. Remove unused media before uploading.');
  await mkdir(mediaDirectory(), { recursive: true });
  const space = await statfs(mediaDirectory());
  if (Number(space.bavail) * Number(space.bsize) < input.size + 512 * 1024 ** 2) throw problem(503, 'Media storage is temporarily full. Please try again later.');
  return Media.create({ owner, name: String(input.name || 'Upload').slice(0, 180), mime: input.mime, size: input.size });
}
const locks = new Map();
export async function appendMedia(media, offset, bytes) {
  const key = String(media._id);
  if (locks.has(key)) throw problem(409, 'This upload is already receiving a part.');
  locks.set(key, true);
  try {
    const fresh = await Media.findOne({ _id: media._id, owner: media.owner });
    if (fresh.ready) return fresh;
    if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > CHUNK || offset !== fresh.offset || offset + bytes.length > fresh.size) throw problem(409, 'Upload position changed. Resume the upload.');
    let file;
    try { file = await open(mediaPath(fresh), 'r+'); }
    catch (error) { if (error.code !== 'ENOENT' || offset !== 0) throw error; file = await open(mediaPath(fresh), 'w+'); }
    try { await file.write(bytes, 0, bytes.length, offset); await file.sync(); } finally { await file.close(); }
    fresh.offset += bytes.length;
    if (fresh.offset === fresh.size) {
      let info;
      try { info = JSON.parse((await run('ffprobe', ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-format_whitelist', 'mov,jpeg_pipe,png_pipe', '-show_format', '-show_streams', '-of', 'json', mediaPath(fresh)], { timeout: 20000, maxBuffer: 1024 * 1024 })).stdout); }
      catch { throw problem(400, 'This file could not be read. Choose a valid JPG, PNG or MP4.'); }
      const video = info.streams?.find(x => x.codec_type === 'video');
      const valid = fresh.mime === 'video/mp4' ? info.format?.format_name?.includes('mp4') && video?.codec_name === 'h264' : video?.codec_name === (fresh.mime === 'image/jpeg' ? 'mjpeg' : 'png');
      if (!valid || !video?.width || !video?.height) throw problem(400, 'Use a JPG, PNG or H.264 MP4 video. This file format is not supported.');
      fresh.duration = Number(info.format.duration || 0); fresh.width = video.width; fresh.height = video.height; fresh.ready = true;
    }
    await fresh.save(); return fresh;
  } finally { locks.delete(key); }
}
export function mediaUrl(media) {
  const expires = Math.floor(Date.now() / 1000) + 86400;
  const signature = sign(`media:${media._id}:${expires}`);
  return `${publicOrigin()}/api/creator/media-file/${media._id}?expires=${expires}&signature=${signature}`;
}
export function verifyMediaLink(id, expires, signature) {
  return /^[a-f0-9]{24}$/.test(id) && /^\d{10}$/.test(String(expires)) && Number(expires) > Date.now() / 1000 && Number(expires) <= Date.now() / 1000 + 86410 && matches(sign(`media:${id}:${expires}`), signature);
}
export const publicMedia = m => ({ id: String(m._id), name: m.name, size: m.size, mime: m.mime, offset: m.offset, ready: m.ready, duration: m.duration, width: m.width, height: m.height, ...(m.ready ? { url: mediaUrl(m) } : {}) });
export async function removeMedia(media) { await unlink(mediaPath(media)).catch(error => { if (error.code !== 'ENOENT') throw error; }); await Media.deleteOne({ _id: media._id, owner: media.owner }); }
