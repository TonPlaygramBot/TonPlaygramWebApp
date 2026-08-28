export function getInviteUrl(roomId, token, amount, game = 'snake', capacity = 2) {
  const baseUrl = process.env.WEBAPP_BASE_URL || 'https://tonplaygramwebapp.onrender.com';
  const safeGame = String(game || 'snake').trim().toLowerCase().replace(/[^a-z0-9-]/g, '') || 'snake';
  const playerCapacity = String(Math.max(2, Number(capacity) || 2));
  const params = new URLSearchParams({
    table: String(roomId || ''),
    tableId: String(roomId || ''),
    mode: 'online',
    capacity: playerCapacity,
    players: playerCapacity,
    type: 'regular',
    inviteAccept: '1'
  });
  if (token) params.set('token', String(token));
  if (amount !== undefined && amount !== null && amount !== '') params.set('amount', String(amount));
  return `${baseUrl.replace(/\/$/, '')}/games/${safeGame}?${params.toString()}`;
}

export function getInviteReplyMarkup(url, rejectToken) {
  return {
    inline_keyboard: [[
      { text: '✅ Accept', web_app: { url } },
      { text: '❌ Reject', callback_data: `reject_invite:${rejectToken}` }
    ]]
  };
}
