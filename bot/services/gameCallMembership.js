// Signed identity comes exclusively from socialSocketRegistry, never legacy
// register/playerId, caller payloads, watchers, or Socket.IO room membership.
const GAME_TYPES = Object.freeze({
  snake: 'snake', airhockey: 'airhockey', chessbattleroyal: 'chess',
  checkersbattleroyal: 'checkers', fourinrowroyale: 'fourinrow',
  ludobattleroyal: 'ludobattleroyal', texasholdem: 'texasholdem',
  'domino-royal': 'domino-royal', murlanroyale: 'murlanroyale',
  poolroyale: 'poolroyale', snookerroyale: 'snookerroyale',
  '2048royale': '2048royale', hextrisbattle: 'hextrisbattle', underrunarena: 'underrunarena'
});

export function parseGameCallRoom(roomId) {
  if (typeof roomId !== 'string' || roomId.length > 256 || roomId !== roomId.trim()) return null;
  for (const [slug, gameType] of Object.entries(GAME_TYPES)) {
    const prefix = `live-${slug}-`;
    if (!roomId.startsWith(prefix)) continue;
    const tableId = roomId.slice(prefix.length);
    if (!tableId || tableId === 'default' || tableId !== tableId.trim()) return null;
    return { gameType, tableId };
  }
  return null;
}

export function createGameCallMembership({ tableMap, getSocket, now = Date.now }) {
  function allows(socket, roomId, expectedAccountId) {
    const match = parseGameCallRoom(roomId);
    const verified = socket?.data?.socialAuth;
    if (!match || !socket?.connected || verified?.auth?.socialVerified !== true ||
        !(verified.expiresAt > now())) return false;
    const accountId = verified.auth.accountId;
    if (typeof accountId !== 'string' || !accountId ||
        String(verified.user?.accountId || '') !== accountId || verified.user?.isBanned ||
        (expectedAccountId != null && expectedAccountId !== accountId)) return false;
    const table = tableMap.get(match.tableId);
    if (!table || table.gameType !== match.gameType || !Array.isArray(table.players)) return false;
    return table.players.some((player) =>
      String(player.id || '') === accountId &&
      (!player.tpcAccountNumber || String(player.tpcAccountNumber) === accountId) &&
      player.socketId === socket.id);
  }
  function prune(roomId, members, onRemove) {
    for (const [socketId, participant] of members || []) {
      if (allows(getSocket(socketId), roomId, participant.accountId)) continue;
      members.delete(socketId);
      onRemove(socketId);
    }
  }
  return { allows, prune };
}
