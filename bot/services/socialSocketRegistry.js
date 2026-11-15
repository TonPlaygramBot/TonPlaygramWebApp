// Socket.IO socket IDs are room names too. Legacy game APIs can join arbitrary
// rooms, so io.to(socketId) is never a private delivery primitive here.
export function emitDirectSocket(io, socketId, event, payload) {
  io.sockets.sockets.get(String(socketId))?.emit(event, payload);
}
export function emitLiveChatMembers(io, room, excludedSocketId, event, payload) {
  for (const sid of room?.keys() || []) {
    if (sid !== excludedSocketId) emitDirectSocket(io, sid, event, payload);
  }
}

/** Private event delivery must never use caller-selected game IDs or rooms. */
export function createSocialSocketRegistry({ io, resolveUser, now = Date.now, onRevoke = () => {}, onExpire = () => {}, setTimer = setTimeout, clearTimer = clearTimeout }) {
  const sockets = new Map();
  function emit(accountIds, event, payload) {
    for (const accountId of new Set(accountIds.map(String))) {
      for (const sid of sockets.get(accountId) || []) {
        const peer = io.sockets.sockets.get(sid);
        if (peer?.data?.socialAuth?.expiresAt > now() && peer.data.socialAuth.auth.accountId === accountId) peer.emit(event, payload);
      }
    }
  }
  function remove(socket, { endCalls = false } = {}) {
    socket.data.socialAuthGeneration = (socket.data.socialAuthGeneration || 0) + 1;
    clearTimer(socket.data.socialAuthTimer);
    const accountId = socket.data.socialAuth?.auth?.accountId;
    if (endCalls && accountId) onRevoke(accountId, 'identity_changed');
    const set = sockets.get(accountId);
    set?.delete(socket.id);
    if (set?.size === 0) sockets.delete(accountId);
    const activePeer = [...(sockets.get(accountId) || [])].some((sid) => io.sockets.sockets.get(sid)?.data?.socialAuth?.expiresAt > now());
    if (accountId && !activePeer) onRevoke(accountId, 'disconnected');
    delete socket.data.socialAuth;
  }
  async function authenticate(socket, credentials) {
    const generation = (socket.data.socialAuthGeneration || 0) + 1;
    socket.data.socialAuthGeneration = generation;
    let verified;
    try {
      verified = await resolveUser(credentials || {
        initData: socket.handshake.auth?.initData || socket.handshake.headers?.['x-telegram-init-data'] || '',
        googleIdToken: socket.handshake.auth?.googleIdToken || socket.handshake.headers?.['x-google-id-token'] || ''
      });
    } catch (error) {
      if (generation !== socket.data.socialAuthGeneration) throw Object.assign(new Error('Authentication superseded'), { code: 'authentication_superseded' });
      throw error;
    }
    if (!socket.connected || generation !== socket.data.socialAuthGeneration) throw Object.assign(new Error('Authentication superseded'), { code: 'authentication_superseded' });
    if (socket.data.socialAuth?.auth?.accountId !== verified.auth.accountId) remove(socket, { endCalls: true });
    clearTimer(socket.data.socialAuthTimer);
    socket.data.socialAuth = verified;
    const set = sockets.get(verified.auth.accountId) || new Set();
    set.add(socket.id);
    sockets.set(verified.auth.accountId, set);
    socket.data.socialAuthTimer = setTimer(() => {
      if (socket.data.socialAuth !== verified) return;
      // An unused expired tab must not end a call on another authenticated tab.
      // The host closes media only if this socket actually joined a call.
      onExpire(socket);
      remove(socket);
      socket.emit('social:authentication-required', { error: 'reauthentication_required' });
    }, Math.max(1, verified.expiresAt - now()));
    socket.data.socialAuthTimer?.unref?.();
    return verified.user;
  }
  async function requireUser(socket) {
    if (socket.data.socialAuth?.expiresAt > now()) return socket.data.socialAuth.user;
    return authenticate(socket);
  }
  return { sockets, emit, remove, authenticate, requireUser };
}
