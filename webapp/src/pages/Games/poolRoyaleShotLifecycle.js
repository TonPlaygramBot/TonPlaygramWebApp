/** A scoring run restarts after a miss; it does not mean the rack is breaking. */
export function isPoolRoyalBreak(frame) {
  const meta = frame?.meta;
  if (meta?.variant === 'uk') return meta.state?.lastEvent === 'BREAK_START';
  return Boolean(meta?.state?.breakInProgress ?? meta?.breakInProgress);
}

export function poolRoyalBallInHand(frame) {
  if (frame?.frameOver) return false;
  return Boolean(frame?.meta?.state?.ballInHand || frame?.meta?.state?.mustPlayFromBaulk);
}

/** Count distinct numbered balls, not repeat bounces or the cue ball. */
export function poolRoyalBallNumber(id) {
  const value = typeof id === 'number' ? id : /^ball_\d+$/i.test(String(id))
    ? Number(String(id).slice(5)) : Number(id);
  return Number.isInteger(value) && value >= 1 && value <= 15 ? value : null;
}

export function poolRoyalBallsToSpot(balls, frame) {
  if (frame?.frameOver || !['8ball', '9ball'].includes(frame?.meta?.variant)) return [];
  const remaining = new Set(frame.meta.state.ballsOnTable);
  return balls.filter(ball => !ball.active && remaining.has(poolRoyalBallNumber(ball.id)));
}

export function recordPoolRoyalRail(context, id) {
  if (!context.contactMade) return;
  context.cushionAfterContact = true;
  context.railContactCountAfterContact = (context.railContactCountAfterContact ?? 0) + 1;
  const number = poolRoyalBallNumber(id);
  if (number === null) return;
  const ids = context.objectBallsToRailAfterContact ??= [];
  if (!ids.includes(String(number))) ids.push(String(number));
}

/** Deterministic spotting along the long string, clear of every active ball. */
export function findPoolRoyalSpot(balls, id, { x = 0, y, minY, maxY, radius }) {
  const clearance = radius * 2 + radius * 0.01;
  const obstacles = balls.filter(ball => ball.active && ball.id !== id);
  const clear = candidate => obstacles.every(ball =>
    Math.hypot(ball.pos.x - x, ball.pos.y - candidate) >= clearance - 1e-8);
  // Foot rail first, then toward the head rail when the foot side is full.
  for (const sign of [-1, 1]) {
    let candidate = y;
    for (let i = 0; i <= obstacles.length; i++) {
      if (candidate < minY || candidate > maxY) break;
      if (clear(candidate)) return { x, y: candidate };
      const blockers = obstacles.filter(ball => Math.hypot(ball.pos.x - x, ball.pos.y - candidate) < clearance);
      candidate = blockers.reduce((next, ball) => {
        const extent = Math.sqrt(Math.max(0, clearance ** 2 - (ball.pos.x - x) ** 2));
        const edge = ball.pos.y + sign * extent;
        return sign < 0 ? Math.min(next, edge) : Math.max(next, edge);
      }, candidate);
    }
  }
  return null;
}
