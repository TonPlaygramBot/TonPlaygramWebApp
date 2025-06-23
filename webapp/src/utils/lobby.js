export function canStartGame(game, table, stake, aiCount = 0) {
  if ((game === 'ludo' || game === 'snake') && table?.id === 'single') {
    return aiCount > 0;
  }
  if (!stake || !stake.token || !stake.amount) return false;
  if (game === 'snake' && !table) return false;
  return true;
}
