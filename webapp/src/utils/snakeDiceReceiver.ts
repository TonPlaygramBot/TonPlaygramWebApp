import { resolveSnakeRoll, SNAKE_FINAL_TILE } from '../../../lib/snakeRules.js';

/** Predict presentation only; movement and turn ownership remain in the game engine. */
export function snakeDiceReceiver({ roller, positions, values, snakes = {}, ladders = {}, diceCells = {}, online = false }: {
  roller: number; positions: number[]; values: number[];
  snakes?: Record<number, number>; ladders?: Record<number, number | { end: number }>;
  diceCells?: Record<number, unknown>; online?: boolean;
}) {
  const count = positions.length;
  if (!count || !Number.isFinite(positions[roller])) return Math.max(0, roller);
  const resolution = resolveSnakeRoll(positions[roller], values);
  let landing = resolution.landing;
  if (resolution.moved) {
    const ladder = ladders[landing];
    landing = snakes[landing] != null ? Math.max(0, snakes[landing]) : ladder != null ? typeof ladder === 'object' ? ladder.end : ladder : landing;
  }
  if (landing === SNAKE_FINAL_TILE || resolution.extraTurn || (resolution.moved && diceCells[landing])) return roller;
  for (let step = 1; step <= count; step++) {
    const next = (roller + (online ? step : -step) + count) % count;
    if (positions[next] !== SNAKE_FINAL_TILE) return next;
  }
  return roller;
}
