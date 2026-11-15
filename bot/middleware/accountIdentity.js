import { verifySocialCredentials } from './socialAuth.js';

function denied(code = 'reauthentication_required') {
  return Object.assign(new Error('Sign in again with the account you want to manage.'), { code });
}

/** Credential verification for identity creation, before a User exists. */
export async function verifyRequestedIdentity(req, requested = {}, verify = verifySocialCredentials) {
  const telegramId = requested.telegramId;
  const googleId = requested.googleId;
  if (telegramId != null && (!Number.isSafeInteger(telegramId) || telegramId <= 0)) throw denied('invalid_identity');
  if (googleId != null && (typeof googleId !== 'string' || !googleId || googleId.length > 255)) throw denied('invalid_identity');
  const claims = await verify({
    initData: req.get('x-telegram-init-data') || '',
    googleIdToken: req.get('x-google-id-token') || ''
  });
  if (telegramId != null && claims.telegramId !== telegramId) throw denied('identity_mismatch');
  if (googleId != null && claims.googleId !== googleId) throw denied('identity_mismatch');
  return claims;
}

export function identityOwnsUser(claims, user) {
  if (!user) return false;
  return Boolean(
    (claims.telegramId != null && user.telegramId != null && claims.telegramId === Number(user.telegramId)) ||
    (claims.googleId && user.googleId && claims.googleId === String(user.googleId))
  );
}

export function sendIdentityError(res, error) {
  const code = error?.code || 'reauthentication_required';
  return res.status(code === 'invalid_identity' ? 400 : code === 'identity_mismatch' ? 403 : 401)
    .json({ error: code, message: 'Sign in again with the account you want to manage.' });
}
