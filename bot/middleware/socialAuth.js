import { createHmac, timingSafeEqual } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import User from '../models/User.js';

const googleClient = new OAuth2Client();
const USER_FIELDS = '_id accountId telegramId googleId firstName lastName nickname photo friends isBanned pushTokens';

function authError() {
  return Object.assign(new Error('Sign in again with Telegram or Google to use private conversations.'), {
    code: 'reauthentication_required'
  });
}

/** Verify credentials, never compatibility account/Google identity headers. */
export async function verifySocialCredentials(
  { initData = '', googleIdToken = '' } = {},
  {
    now = Date.now(), botToken = process.env.BOT_TOKEN,
    maxAgeSeconds = Math.min(86400, Math.max(60, Number(process.env.SOCIAL_AUTH_MAX_AGE_SECONDS) || 3600)),
    googleAudiences = String(process.env.GOOGLE_CLIENT_IDS || process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '').split(',').map((id) => id.trim()).filter(Boolean),
    verifyGoogle = (token, audiences) => googleClient.verifyIdToken({ idToken: token, audience: audiences })
  } = {}
) {
  const identity = {};
  let expiresAt = Infinity;
  if (initData) {
    if (!botToken || typeof initData !== 'string' || initData.length > 16384) throw authError();
    const params = new URLSearchParams(initData);
    if ([...params.keys()].some((key) => params.getAll(key).length !== 1)) throw authError();
    const hash = params.get('hash');
    if (!/^[a-fA-F0-9]{64}$/.test(hash || '')) throw authError();
    params.delete('hash');
    const dataCheckString = [...params.entries()].map(([key, value]) => `${key}=${value}`).sort().join('\n');
    const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
    const expected = createHmac('sha256', secret).update(dataCheckString).digest();
    if (!timingSafeEqual(expected, Buffer.from(hash, 'hex'))) throw authError();
    const authDate = Number(params.get('auth_date'));
    if (!Number.isSafeInteger(authDate) || authDate <= 0 || authDate * 1000 > now + 60000 || now >= (authDate + maxAgeSeconds) * 1000) throw authError();
    let user;
    try { user = JSON.parse(params.get('user')); } catch { throw authError(); }
    if (!Number.isSafeInteger(user?.id) || user.id <= 0) throw authError();
    identity.telegramId = user.id;
    expiresAt = Math.min(expiresAt, (authDate + maxAgeSeconds) * 1000);
  }
  if (googleIdToken) {
    if (typeof googleIdToken !== 'string' || googleIdToken.length > 16384 || !googleAudiences.length) throw authError();
    let payload;
    try { payload = (await verifyGoogle(googleIdToken, googleAudiences)).getPayload(); } catch { throw authError(); }
    // The official verifier checks signature, issuer, audience and expiry. Keep
    // strict application checks here too; do not accept its clock-skew grace.
    if (!payload || !['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss) ||
        !googleAudiences.includes(payload.aud) || typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 255 ||
        !Number.isFinite(payload.exp) || payload.exp * 1000 <= now ||
        !Number.isFinite(payload.iat) || payload.iat * 1000 > now + 60000 ||
        (payload.azp && !googleAudiences.includes(payload.azp))) throw authError();
    identity.googleId = payload.sub;
    expiresAt = Math.min(expiresAt, payload.exp * 1000);
  }
  if (!identity.telegramId && !identity.googleId) throw authError();
  return { ...identity, expiresAt };
}

export async function resolveSocialUser(credentials, { findUser, verify = verifySocialCredentials } = {}) {
  const claims = await verify(credentials);
  const selector = claims.telegramId != null ? { telegramId: claims.telegramId } : { googleId: claims.googleId };
  const user = await (findUser ? findUser(selector) : User.findOne(selector).select(USER_FIELDS).lean());
  if (!user?.accountId || user.isBanned || (claims.googleId && String(user.googleId) !== claims.googleId)) throw authError();
  return { user, expiresAt: claims.expiresAt, auth: {
    socialVerified: true,
    accountId: String(user.accountId),
    ...(user.telegramId != null ? { telegramId: user.telegramId } : {}),
    ...(user.googleId ? { googleId: String(user.googleId) } : {})
  } };
}

export default async function socialAuthenticate(req, res, next) {
  try {
    const verified = await resolveSocialUser({
      initData: req.get('x-telegram-init-data') || '',
      googleIdToken: req.get('x-google-id-token') || ''
    });
    req.auth = verified.auth;
    req.socialUser = verified.user;
    req.socialAuthExpiresAt = verified.expiresAt;
    res.setHeader('Cache-Control', 'no-store');
    next();
  } catch {
    res.status(401).json({ error: 'reauthentication_required', message: authError().message });
  }
}
