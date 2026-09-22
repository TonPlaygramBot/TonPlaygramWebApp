import { createHash } from 'node:crypto';
import User from '../models/User.js';

// Signed Telegram identity and the active Google login precede a cached guest
// account id, which can still be present while account linking finishes.
export const wallUserSelector = (auth) =>
  auth?.telegramId
    ? { telegramId: auth.telegramId }
    : auth?.googleId
      ? { googleId: auth.googleId }
      : auth?.accountId
        ? { accountId: auth.accountId }
        : null;
export const resolveWallUser = (req) => {
  const selector = wallUserSelector(req.auth);
  return selector ? User.findOne(selector) : null;
};
export const wallDisplayName = (user) =>
  String(
    user?.nickname ||
      [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
      (user?.accountId ? `Member ${user.accountId.slice(-6)}` : 'Guest')
  )
    .trim()
    .slice(0, 120);
export const privateTelegramPhoto = (value) =>
  /^https:\/\/api\.telegram\.org\/file\/bot[^/]+\/(photos\/[a-zA-Z0-9_.-]+)$/i.exec(
    String(value || '')
  );
export const publicWallAvatar = (value, accountId) =>
  /^data:image\/webp;base64,/.test(String(value || '')) && accountId
    ? `/api/flamingo-wall/profiles/${encodeURIComponent(accountId)}/avatar?v=${createHash('sha256').update(value).digest('hex').slice(0, 16)}`
    : privateTelegramPhoto(value)
      ? accountId
        ? `/api/flamingo-wall/profiles/${encodeURIComponent(accountId)}/avatar`
        : ''
      : /https?:\/\/api\.telegram\.org\/file\/bot/i.test(String(value || ''))
        ? ''
        : value || '';
export async function hydrateWallAuthors(posts) {
  const ids = [
    ...new Set(posts.map((post) => post.authorAccountId).filter(Boolean))
  ];
  if (!ids.length) return posts;
  const users = await User.find({ accountId: { $in: ids } })
    .select('accountId nickname firstName lastName photo')
    .lean();
  const profiles = new Map(users.map((user) => [user.accountId, user]));
  return posts.map((post) => {
    const user = profiles.get(post.authorAccountId);
    return user
      ? {
          ...post,
          author: wallDisplayName(user),
          authorAvatar: publicWallAvatar(user.photo, user.accountId)
        }
      : post;
  });
}
