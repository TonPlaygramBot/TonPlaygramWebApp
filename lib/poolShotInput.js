/** Physics IDs and saved shot IDs must identify one actual ball. */
export function normalizePoolBallId(value, maxBall = 15) {
  if (typeof value === 'string') {
    const text = value.trim().toLowerCase();
    if (text === 'cue' || text === 'cue_ball') return 0;
    if (!/^(?:ball_)?\d+$/.test(text)) return null;
    value = Number(text.replace(/^ball_/, ''));
  }
  return Number.isInteger(value) && value >= 0 && value <= maxBall ? value : null;
}

/** Repeated pocket notifications and balls already down cannot score twice. */
export function normalizePoolPots(values, ballsOnTable, maxBall) {
  const unique = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const id = normalizePoolBallId(value, maxBall);
    if (id === 0 || (id !== null && ballsOnTable.has(id))) unique.add(id);
  }
  return [...unique];
}

export function countPoolBreakObjectRails(shot, ballsOnTable, maxBall) {
  if (!Array.isArray(shot.objectBallsToRailAfterContact)) {
    // Legacy callers supply an already-counted number; live physics uses IDs.
    return Math.max(0, Number(shot.railContactsAfterFirstHit) || 0);
  }
  const ids = shot.objectBallsToRailAfterContact
    .map(value => normalizePoolBallId(value, maxBall))
    .filter(id => id !== null && id !== 0 && ballsOnTable.has(id));
  return new Set(ids).size;
}

/** Only explicit rail evidence can establish the absence of a cushion. */
export function poolShotHasNoCushion(context) {
  if (typeof context.noCushionAfterContact === 'boolean') return context.noCushionAfterContact;
  if (typeof context.cushionAfterContact === 'boolean') return !context.cushionAfterContact;
  if (typeof context.railContactCountAfterContact === 'number') return context.railContactCountAfterContact === 0;
  return false;
}
