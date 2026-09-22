import { configured } from './security.js';
export const PROVIDERS = {
  youtube: { name: 'YouTube', color: '#ff414c', post: ['video/mp4'], live: true, limit: 5000, note: 'Videos and live streams. Your channel must have live access.', env: 'GOOGLE' },
  facebook: { name: 'Facebook', color: '#5c94ff', post: ['text', 'image/jpeg', 'image/png', 'video/mp4'], live: true, limit: 63206, note: 'Connect the Pages you manage. Personal profiles are not supported.', env: 'META' },
  instagram: { name: 'Instagram', color: '#fa6aab', post: ['image/jpeg', 'video/mp4'], live: false, limit: 2200, note: 'Business or Creator account. Photos and Reels; live is not available here.', env: 'INSTAGRAM' },
  tiktok: { name: 'TikTok', color: '#54e5df', post: ['video/mp4'], live: false, limit: 2200, note: 'Original videos. Choose your audience and interactions before posting.', env: 'TIKTOK' }
};
export function credentials(platform) {
  const p = platform === 'google' ? { env: 'GOOGLE' } : Object.hasOwn(PROVIDERS, platform) ? PROVIDERS[platform] : null;
  if (!p) return null;
  const id = process.env[`CREATOR_${p.env}_CLIENT_ID`], secret = process.env[`CREATOR_${p.env}_CLIENT_SECRET`];
  // Use a complete app credential pair. Never mix secrets from different apps.
  if (id || secret) return { id, secret };
  const shared = { GOOGLE: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'], META: ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET'], INSTAGRAM: ['INSTAGRAM_APP_ID', 'INSTAGRAM_APP_SECRET'], TIKTOK: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET'] }[p.env];
  return { id: process.env[shared[0]], secret: process.env[shared[1]] };
}
export function connectionStatus(platform) {
  const c = credentials(platform);
  const name = platform === 'google' ? 'Google' : Object.hasOwn(PROVIDERS, platform) ? PROVIDERS[platform].name : 'This platform';
  if (!c) return { available: false, setupReason: 'unsupported', setupMessage: 'This platform is not supported in Creator Studio.' };
  if (!configured()) return { available: false, setupReason: 'secure_storage', setupMessage: 'TonPlayGram account connections are temporarily unavailable. Please try again later.' };
  if (!c.id || !c.secret) return { available: false, setupReason: 'app_credentials', setupMessage: `${name} connections have not been enabled by TonPlayGram yet. The app owner must complete the platform setup. You do not need to enter passwords, codes or keys here.` };
  if (platform === 'tiktok' && process.env.CREATOR_TIKTOK_APPROVED !== 'true') return { available: false, setupReason: 'platform_approval', setupMessage: 'TonPlayGram has not enabled TikTok publishing approval yet. The app owner must finish this setup before TikTok can connect.' };
  return { available: true, setupReason: null, setupMessage: null };
}
export function available(platform) { return connectionStatus(platform).available; }
export function catalog() {
  return Object.entries(PROVIDERS).map(([id, p]) => ({ id, ...p, env: undefined, ...connectionStatus(id) }));
}
