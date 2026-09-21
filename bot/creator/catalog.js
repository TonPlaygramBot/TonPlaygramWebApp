import { configured } from './security.js';
export const PROVIDERS = {
  youtube: { name: 'YouTube', color: '#ff414c', post: ['video/mp4'], live: true, limit: 5000, note: 'Videos and live streams. Your channel must have live access.', env: 'GOOGLE' },
  facebook: { name: 'Facebook', color: '#5c94ff', post: ['text', 'image/jpeg', 'image/png', 'video/mp4'], live: true, limit: 63206, note: 'Connect the Pages you manage. Personal profiles are not supported.', env: 'META' },
  instagram: { name: 'Instagram', color: '#fa6aab', post: ['image/jpeg', 'video/mp4'], live: false, limit: 2200, note: 'Business or Creator account. Photos and Reels; live is not available here.', env: 'INSTAGRAM' },
  tiktok: { name: 'TikTok', color: '#54e5df', post: ['video/mp4'], live: false, limit: 2200, note: 'Original videos. Choose your audience and interactions before posting.', env: 'TIKTOK' },
  threads: { name: 'Threads', color: '#ededed', post: ['text', 'image/jpeg', 'image/png', 'video/mp4'], live: false, limit: 500, note: 'Text, photos and videos.', env: 'THREADS' },
  x: { name: 'X', color: '#cbd5e1', post: ['text'], live: false, limit: 280, note: 'Text and links. Media uploads and live are not available here.', env: 'X' },
  twitch: { name: 'Twitch', color: '#b28bff', post: [], live: true, limit: 140, note: 'Live streaming. Stream details are connected automatically.', env: 'TWITCH' }
};
export function credentials(platform) {
  const p = platform === 'google' ? { env: 'GOOGLE' } : PROVIDERS[platform];
  if (!p) return null;
  return { id: process.env[`CREATOR_${p.env}_CLIENT_ID`], secret: process.env[`CREATOR_${p.env}_CLIENT_SECRET`] };
}
export function available(platform) {
  const c = credentials(platform);
  return configured() && Boolean(c?.id && c?.secret) && (platform !== 'tiktok' || process.env.CREATOR_TIKTOK_APPROVED === 'true');
}
export function catalog() {
  return Object.entries(PROVIDERS).map(([id, p]) => ({ id, ...p, env: undefined, available: available(id) }));
}
