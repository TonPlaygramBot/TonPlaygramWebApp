import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

const refreshTokens = new Map();

function getSecret() {
  return process.env.JWT_SECRET || 'dev-secret';
}

function issueTokens(user) {
  const payload = {
    sub: user.accountId,
    telegramId: user.telegramId,
    googleId: user.googleId,
    walletAddress: user.walletAddress
  };
  const accessToken = jwt.sign(payload, getSecret(), { expiresIn: '15m' });
  const refreshToken = randomUUID();
  const refreshExpiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
  refreshTokens.set(refreshToken, { userId: user.accountId, expiresAt: refreshExpiresAt });
  return { accessToken, refreshToken, refreshExpiresAt };
}

function verifyRefreshToken(token) {
  const entry = refreshTokens.get(token);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    refreshTokens.delete(token);
    return null;
  }
  return entry;
}

function revokeRefreshToken(token) {
  refreshTokens.delete(token);
}

function revokeTokensForUser(userId) {
  for (const [token, entry] of refreshTokens.entries()) {
    if (entry.userId === userId) {
      refreshTokens.delete(token);
    }
  }
}

function parseCookies(cookieHeader = '') {
  return cookieHeader
    .split(';')
    .map((c) => c.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const [key, ...rest] = part.split('=');
      acc[key] = rest.join('=');
      return acc;
    }, {});
}

export {
  issueTokens,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeTokensForUser,
  parseCookies
};
