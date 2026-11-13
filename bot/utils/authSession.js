import crypto from 'node:crypto';

const VERSION = 'tpg1';
export const AUTH_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

function signingKey() {
  const configured = process.env.AUTH_SESSION_SECRET;
  if (!configured || configured.length < 32) {
    throw new Error('AUTH_SESSION_SECRET must contain at least 32 characters');
  }
  // Separate from BOT_TOKEN/API_AUTH_TOKEN so a legacy credential exposure
  // cannot mint new account sessions.
  return crypto.createHmac('sha256', configured).update('tonplaygram:account-session:v1').digest();
}

function identityFromClaims(claims) {
  if (typeof claims?.accountId !== 'string' || !claims.accountId || claims.accountId.length > 160) return null;
  const identity = { accountId: claims.accountId };
  if (claims.telegramId !== undefined) {
    if (!Number.isSafeInteger(claims.telegramId) || claims.telegramId <= 0) return null;
    identity.telegramId = claims.telegramId;
  }
  if (claims.googleId !== undefined) {
    if (typeof claims.googleId !== 'string' || !claims.googleId || claims.googleId.length > 255) return null;
    identity.googleId = claims.googleId;
  }
  return identity;
}

// Call only after creating a fresh account or proving ownership of an existing
// one. Public account numbers and decoded Google JWTs are not ownership proof.
export function createAuthSession(identity, now = Date.now()) {
  const verifiedIdentity = identityFromClaims(identity);
  if (!verifiedIdentity) throw new Error('Invalid account session identity');
  const issuedAt = Math.floor(now / 1000);
  const payload = Buffer.from(JSON.stringify({
    ...verifiedIdentity,
    iat: issuedAt,
    exp: issuedAt + AUTH_SESSION_TTL_SECONDS
  })).toString('base64url');
  const data = `${VERSION}.${payload}`;
  const signature = crypto.createHmac('sha256', signingKey()).update(data).digest('base64url');
  return `${data}.${signature}`;
}

export function verifyAuthSession(token, now = Date.now()) {
  try {
    if (typeof token !== 'string' || token.length > 4096) return null;
    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== VERSION || !/^[A-Za-z0-9_-]+$/.test(parts[1]) || !/^[A-Za-z0-9_-]{43}$/.test(parts[2])) return null;
    const expected = crypto.createHmac('sha256', signingKey()).update(`${parts[0]}.${parts[1]}`).digest();
    const actual = Buffer.from(parts[2], 'base64url');
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    const nowSeconds = Math.floor(now / 1000);
    if (!Number.isSafeInteger(claims.iat) || !Number.isSafeInteger(claims.exp) ||
        claims.iat > nowSeconds + 60 || claims.exp <= nowSeconds ||
        claims.exp <= claims.iat || claims.exp - claims.iat > AUTH_SESSION_TTL_SECONDS) return null;
    return identityFromClaims(claims);
  } catch {
    return null;
  }
}
