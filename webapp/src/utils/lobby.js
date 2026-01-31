export function canStartGame(game, table, stake, aiCount = 0, players = 0) {
  if (game === 'snake' && table?.id === 'single') {
    return aiCount > 0 && !!stake?.token && !!stake?.amount;
  }
  if (game === 'snake' && table && table.id !== 'single') {
    const capacity = table.capacity || 0;
    if (capacity <= 0) return false;
    if (players < capacity) return false;
    if (players > capacity) return false;
  }
  if (!stake || !stake.token || !stake.amount) return false;
  if (game === 'snake' && !table) return false;
  return true;
}
