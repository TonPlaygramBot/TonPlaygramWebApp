export function buildGameLiveChatRoomId (gameSlug, params) {
  const sessionId =
    params.get('tableId') ||
    params.get('table') ||
    params.get('room') ||
    params.get('roomId') ||
    'default'
  return `live-${gameSlug}-${sessionId}`
}
