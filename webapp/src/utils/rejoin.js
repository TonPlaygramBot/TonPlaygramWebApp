export function rebuildFromSnapshot(snapshot = {}) {
  const {
    board = {},
    positions = {},
    currentTurn = null,
    lastRoll = null,
    timers = {},
    startedAt = null
  } = snapshot || {};
  return { board, positions, currentTurn, lastRoll, timers, startedAt };
}
