export function buildGameLiveChatRoomId(gameSlug, params) {
  const sessionId =
    params.get('table') ||
    params.get('tableId') ||
    params.get('room') ||
    params.get('roomId') ||
    'default';
  return `live-${gameSlug}-${sessionId}`;
}
