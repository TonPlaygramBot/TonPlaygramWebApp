import { API_BASE_URL } from '../../utils/api.js';
export const base = `${API_BASE_URL}/api/creator`;
export async function creatorApi(path: string, method = 'GET', body?: unknown, extra: Record<string, string> = {}) {
  const raw = body instanceof Blob;
  const res = await fetch(`${base}${path}`, { method, credentials: 'include', headers: { 'X-Creator-Request': '1', ...(body !== undefined ? { 'Content-Type': raw ? 'application/octet-stream' : 'application/json' } : {}), ...extra }, ...(body !== undefined ? { body: raw ? body : JSON.stringify(body) } : {}) });
  let result; try { result = await res.json(); } catch { throw new Error('Studio is temporarily unavailable. Please try again.'); }
  if (!res.ok) throw new Error(result.error || 'The request could not be completed.');
  return result;
}
export async function uploadMedia(file: File, progress: (percent: number) => void) {
  if (!['image/jpeg', 'image/png', 'video/mp4'].includes(file.type) || file.size > 250 * 1024 ** 2) throw new Error('Choose a JPG, PNG or MP4 up to 250 MB.');
  const key = `creator-upload:${file.name}:${file.size}:${file.lastModified}`;
  let upload;
  try { const previous = sessionStorage.getItem(key); if (previous) upload = await creatorApi(`/media/${previous}`); } catch { /* Recreate expired/inaccessible uploads. */ }
  if (!upload) { upload = await creatorApi('/media', 'POST', { name: file.name, size: file.size, mime: file.type }); try { sessionStorage.setItem(key, upload.id); } catch { /* Upload still works without browser storage. */ } }
  while (upload.offset < file.size) {
    const offset = upload.offset;
    try { upload = await creatorApi(`/media/${upload.id}`, 'PUT', file.slice(offset, offset + 1024 * 1024), { 'X-Upload-Offset': String(offset) }); }
    catch (error) {
      const current = await creatorApi(`/media/${upload.id}`).catch(() => null);
      if (!current || current.offset <= offset) throw error;
      upload = current;
    }
    progress(Math.round(upload.offset / file.size * 100));
  }
  try { sessionStorage.removeItem(key); } catch { /* no-op */ }
  return upload;
}
export type Platform = { id: string; name: string; color: string; post: string[]; live: boolean; limit: number; note: string; available: boolean };
export type Account = { id: string; platform: string; name: string; status: string };
export type Media = { id: string; name: string; mime: string; url?: string; ready: boolean; size: number; duration?: number };
