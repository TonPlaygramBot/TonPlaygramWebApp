/** Predict presentation only; movement and turn ownership remain in the game engine. */
export function snakeDiceReceiver({ roller, positions, values, snakes = {}, ladders = {}, diceCells = {}, online = false }: {
  roller: number; positions: number[]; values: number[];
  snakes?: Record<number, number>; ladders?: Record<number, number | { end: number }>;
  diceCells?: Record<number, unknown>; online?: boolean;
}) {
  const count = positions.length;
  if (!count || !Number.isFinite(positions[roller])) return Math.max(0, roller);
  const total = values.reduce((a, b) => a + Number(b), 0), six = values.some(v => Number(v) === 6);
  const position = positions[roller];
  let landing = position === 0 ? six ? 1 : 0 : position + total <= 50 ? position + total : position;
  // Local human early exits don't consume an effect/bonus on an unchanged tile.
  const earlyExit = !online && (position === 49 && total !== 1 || roller === 0 && (position === 0 && !six || position + total > 50));
  if (!earlyExit) {
    const ladder = ladders[landing];
    landing = snakes[landing] != null ? Math.max(0, snakes[landing]) : ladder != null ? typeof ladder === 'object' ? ladder.end : ladder : landing;
  }
  const extra = online ? values.length > 0 && values.every(v => Number(v) === 6) : six;
  // Preserve the existing local AI penultimate-tile rule.
  if (landing === 50 || (extra && !(earlyExit && roller !== 0)) || (!earlyExit && diceCells[landing])) return roller;
  for (let step = 1; step <= count; step++) {
    const next = (roller + (online ? step : -step) + count) % count;
    if (positions[next] !== 50) return next;
  }
  return roller;
}
