// This validates the relay boundary, not the physical outcome of a shot.
// Competitive settlement still requires server-side shot adjudication.
const SEATS = ['A', 'B'];
const COLORS = new Set(['CUE', 'RED', 'YELLOW', 'GREEN', 'BROWN', 'BLUE', 'PINK', 'BLACK']);
const BALL_IDS = new Set([
  ...Array.from({ length: 15 }, (_, index) => `RED_${index + 1}`),
  'YELLOW', 'GREEN', 'BROWN', 'BLUE', 'PINK', 'BLACK', 'CUE'
]);
const LAYOUT_IDS = new Set([...BALL_IDS].map(id => id.toLowerCase()));
const record = value => value && typeof value === 'object' && !Array.isArray(value);
const finite = value => Number.isFinite(value) && Math.abs(value) <= 100000;
const vector = (value, keys) => record(value) && keys.every(key => finite(value[key]));
const score = value => Number.isSafeInteger(value) && value >= 0 && value <= 1000000;

export function authorizeSnookerActor(table, cached, accountId) {
  if (!table || table.gameType !== 'snookerroyale' || !table.started || table.players?.length !== 2) {
    return { ok: false, error: 'table_not_started' };
  }
  const index = table.players.findIndex(player => String(player.id) === String(accountId));
  if (index < 0) return { ok: false, error: 'seat_required' };
  if (cached?.state?.frameOver) return { ok: false, error: 'frame_over' };
  const active = SEATS.includes(cached?.state?.activePlayer)
    ? cached.state.activePlayer
    : SEATS[table.players.findIndex(player => String(player.id) === String(table.currentTurn))];
  if (!active || SEATS[index] !== active) return { ok: false, error: 'not_your_turn' };
  return { ok: true, seat: SEATS[index] };
}

function boundedPayload(value, limit) {
  try { return JSON.stringify(value).length <= limit; } catch { return false; }
}

export function isValidSnookerLayout(layout) {
  if (!Array.isArray(layout) || layout.length !== 22 || !boundedPayload(layout, 24000)) return false;
  const ids = new Set();
  return layout.every(ball => {
    if (!record(ball) || typeof ball.id !== 'string' || !LAYOUT_IDS.has(ball.id) ||
        ids.has(ball.id) ||
        typeof ball.active !== 'boolean' || !vector(ball.pos, ['x', 'y'])) return false;
    ids.add(ball.id);
    if (ball.mesh == null) return true;
    return record(ball.mesh) && vector(ball.mesh.position, ['x', 'y', 'z']) &&
      vector(ball.mesh.quaternion, ['x', 'y', 'z', 'w']) &&
      vector(ball.mesh.scale, ['x', 'y', 'z']) && typeof ball.mesh.visible === 'boolean';
  });
}

export function isValidSnookerAim(aim) {
  return record(aim) && vector(aim.dir, ['x', 'y']) &&
    Math.hypot(aim.dir.x, aim.dir.y) > 0.001 && Math.hypot(aim.dir.x, aim.dir.y) <= 1.01 &&
    Number.isFinite(aim.power) && aim.power >= 0 && aim.power <= 1 &&
    vector(aim.spin, ['x', 'y']) && Math.abs(aim.spin.x) <= 1 && Math.abs(aim.spin.y) <= 1 &&
    (aim.cueBall == null || vector(aim.cueBall, ['x', 'y'])) && boundedPayload(aim, 1000);
}

export function validateSnookerShotState(state, previousState) {
  if (!record(state) || !boundedPayload(state, 32000) || !SEATS.includes(state.activePlayer) ||
      !['REDS_AND_COLORS', 'COLORS_ORDER'].includes(state.phase) ||
      typeof state.frameOver !== 'boolean' ||
      !Number.isInteger(state.redsRemaining) || state.redsRemaining < 0 || state.redsRemaining > 15 ||
      !Array.isArray(state.ballOn) || state.ballOn.length > 7 ||
      !state.ballOn.every(color => COLORS.has(color)) ||
      !SEATS.every(seat => record(state.players?.[seat]) && score(state.players[seat].score)) ||
      !Array.isArray(state.balls) || state.balls.length !== 22) return false;
  if (state.frameOver && !SEATS.includes(state.winner)) return false;
  if (state.currentBreak != null && !score(state.currentBreak)) return false;
  if (!['freeBall', 'colorOnAfterRed'].every(key => state[key] == null || typeof state[key] === 'boolean')) return false;
  if (state.foul != null && (!record(state.foul) || !Number.isInteger(state.foul.points) ||
      state.foul.points < 4 || state.foul.points > 7 || typeof state.foul.reason !== 'string')) return false;
  if (!SEATS.every(seat => ['name', 'avatar'].every(key => state.players[seat][key] == null ||
      typeof state.players[seat][key] === 'string'))) return false;
  if (state.meta != null) {
    if (!record(state.meta) || state.meta.variant !== 'snooker') return false;
    if (state.meta.hud != null && (!record(state.meta.hud) ||
        typeof state.meta.hud.next !== 'string' || typeof state.meta.hud.phase !== 'string')) return false;
    if (state.meta.hud?.scores != null &&
        !SEATS.every(seat => state.meta.hud.scores[seat] === state.players[seat].score)) return false;
    if (state.meta.state != null && (!record(state.meta.state) ||
        typeof state.meta.state.ballInHand !== 'boolean')) return false;
    if (state.meta.foulChoice != null && (!record(state.meta.foulChoice) ||
        !SEATS.includes(state.meta.foulChoice.offender))) return false;
    if (state.meta.decidingBlackChoice != null && (!record(state.meta.decidingBlackChoice) ||
        !SEATS.includes(state.meta.decidingBlackChoice.winner) ||
        state.meta.decidingBlackChoice.winner !== state.activePlayer)) return false;
    if (state.meta.foulChoice?.layout != null &&
        !isValidSnookerLayout(state.meta.foulChoice.layout)) return false;
    const replacement = state.meta.foulChoice?.replacement;
    if (replacement != null && (!record(replacement) ||
        typeof replacement.ballInHand !== 'boolean' ||
        typeof replacement.colorOnAfterRed !== 'boolean' ||
        !Array.isArray(replacement.colorsRemaining) || replacement.colorsRemaining.length > 6 ||
        !replacement.colorsRemaining.every(color => COLORS.has(color) && !['RED', 'CUE'].includes(color)) ||
        !validateSnookerShotState({
          ...state, meta: undefined, frameOver: false,
          balls: replacement.balls, phase: replacement.phase, redsRemaining: replacement.redsRemaining
        }, state))) return false;
    if (state.meta.colorsRemaining != null && (!Array.isArray(state.meta.colorsRemaining) ||
        state.meta.colorsRemaining.length > 6 ||
        !state.meta.colorsRemaining.every(color => COLORS.has(color) && !['RED', 'CUE'].includes(color)))) return false;
  }
  const ids = new Set();
  if (!state.balls.every(ball => {
    if (!record(ball) || typeof ball.id !== 'string' || !BALL_IDS.has(ball.id) || ids.has(ball.id) ||
        !COLORS.has(ball.color) || typeof ball.onTable !== 'boolean' || typeof ball.potted !== 'boolean') return false;
    if (ball.color !== (ball.id.startsWith('RED_') ? 'RED' : ball.id)) return false;
    ids.add(ball.id);
    return ball.position == null || vector(ball.position, ['x', 'y']);
  })) return false;
  for (const seat of SEATS) {
    const before = previousState?.players?.[seat]?.score ?? 0;
    const delta = state.players[seat].score - before;
    // Bounds reject malformed score resets/jumps, not fabricated plausible pots.
    if (delta < 0 || delta > 147) return false;
  }
  return true;
}
