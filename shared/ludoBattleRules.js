export const LUDO_TOKEN_COUNT = 4;
export const LUDO_RING_STEPS = 52;
export const LUDO_GOAL_PROGRESS = 57;

export function isLudoSafeCell(index) {
  return Number.isInteger(index) && index >= 0 && index < LUDO_RING_STEPS &&
    (index % 13 === 0 || index % 13 === 8);
}

export function getLudoMovableTokens(progress, roll) {
  if (!Array.isArray(progress) || !Number.isInteger(roll) || roll < 1 || roll > 6) return [];
  return progress.flatMap((value, token) => {
    if (!Number.isInteger(value) || value < -1 || value >= LUDO_GOAL_PROGRESS) return [];
    if (value === -1) return roll === 6 ? [token] : [];
    return value + roll <= LUDO_GOAL_PROGRESS ? [token] : [];
  });
}

// Accept the scene's seat offsets so practice and the server share capture
// rules without changing the board's existing visual orientation.
export function getLudoCaptureVictims(progress, player, target, starts) {
  if (target < 0 || target >= LUDO_RING_STEPS) return [];
  const landing = (starts[player] + target) % LUDO_RING_STEPS;
  if (isLudoSafeCell(landing)) return [];
  return progress.flatMap((tokens, opponent) => {
    if (opponent === player) return [];
    return tokens.flatMap((value, token) =>
      value >= 0 && value < LUDO_RING_STEPS &&
      (starts[opponent] + value) % LUDO_RING_STEPS === landing
        ? [{ player: opponent, token }]
        : []
    );
  });
}

export function canRollLudoDice(state, { rolling = false, selecting = false, resolving = false } = {}) {
  return Boolean(state && state.winner == null && !state.animation &&
    state.pendingRoll == null && state.onlinePendingRoll == null &&
    !rolling && !selecting && !resolving);
}
