export function canStartGame(game, table, stake, aiCount = 0, players = 0) {
  if (game === 'snake' && table?.id === 'single') {
    return aiCount > 0;
  }
  if (game === 'snake' && table && table.id !== 'single') {
    if (players < (table.capacity || 0)) return false;
  }
  if (!stake || !stake.token || !stake.amount) return false;
  if (game === 'snake' && !table) return false;
  return true;
}
