export function canStartGame(game, table, stake, aiCount = 0, players = 0) {
  if (game === 'snake' && table?.id === 'single') {
    if (!stake || !stake.token || !stake.amount) return false;
    return aiCount > 0;
  }
  if (game === 'snake' && table && table.id !== 'single') {
    // Allow players to confirm their readiness even if the table is not yet
    // full. The server will begin the match once all participants have
    // confirmed, so we don't enforce player count here.
    const capacity = table.capacity || 0;
    if (capacity <= 0) return false;
  }
  if (!stake || !stake.token || !stake.amount) return false;
  if (game === 'snake' && !table) return false;
  return true;
}
