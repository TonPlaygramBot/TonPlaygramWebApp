export function buildGameLiveChatRoomId (gameSlug, params) {
  const sessionId =
    params.get('tableId')?.trim() ||
    params.get('table')?.trim() ||
    params.get('room')?.trim() ||
    params.get('roomId')?.trim() ||
    'default'
  return `live-${gameSlug}-${sessionId}`
}
