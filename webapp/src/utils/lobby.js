export function canStartGame(game, table, stake, aiCount = 0, players = 0) {
  if ((game === 'snake' || game === 'ludo') && table?.id === 'single') {
    if (!stake || !stake.token || !stake.amount) return false;
    return aiCount > 0;
  }
  if (game === 'domino') {
    if (!stake || !stake.token || !stake.amount) return false;
    return true;
  }
  if ((game === 'snake' || game === 'ludo') && table && table.id !== 'single') {
    if (players < (table.capacity || 0)) return false;
  }
  if (!stake || !stake.token || !stake.amount) return false;
  if ((game === 'snake' || game === 'ludo') && !table) return false;
  return true;
}
