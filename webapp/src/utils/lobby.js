export function canStartGame(game, table, stake, aiCount = 0, players = 0) {
  if (game === 'snake' && table?.id === 'single') {
    if (!stake || !stake.token || !stake.amount) return false;
    return aiCount > 0;
  }
  // For multiplayer snake games allow confirming before the table is full.
  if (!stake || !stake.token || !stake.amount) return false;
  if (game === 'snake' && !table) return false;
  return true;
}
