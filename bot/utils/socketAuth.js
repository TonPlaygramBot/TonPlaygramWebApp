import { bearerToken, resolveAuthCredentials } from '../middleware/auth.js';

// Socket.IO authenticates once on connection. Resolve its actor from the same
// verified credentials as HTTP, then bind every registration to that account.
export async function authenticateSocketHandshake(handshake = {}, findUser) {
  const supplied = handshake.auth || {};
  const headers = handshake.headers || {};
  const identity = resolveAuthCredentials({
    token: supplied.token || bearerToken(headers.authorization),
    initData: supplied.initData || headers['x-telegram-init-data']
  });
  if (!identity || identity.apiToken) return null;
  const selector = identity.telegramId ? { telegramId: identity.telegramId }
    : identity.accountId ? { accountId: identity.accountId }
      : null;
  if (!selector) return null;
  const user = await findUser(selector);
  if (!user || user.isBanned || !user.accountId) return null;
  if (identity.googleId && String(user.googleId || '') !== identity.googleId) return null;
  if (identity.accountId && user.accountId !== identity.accountId) return null;
  const playerId = String(user.tpcAccountNumber || user.accountId);
  return { auth: { ...identity, accountId: user.accountId }, playerId };
}

export function ownsSocketPlayer(socket, playerId) {
  const owner = socket.data?.authenticatedPlayerId;
  return Boolean(owner && (!playerId || String(playerId) === owner));
}
