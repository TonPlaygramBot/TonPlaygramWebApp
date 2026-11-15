import { expect, it } from 'vitest';
import { resolveSnakeRoll } from '../../../lib/snakeRules.js';
import { SnakeGame } from '../../../bot/logic/snakeGame.js';
import { snakeDiceReceiver } from './snakeDiceReceiver';

it.each([
  [0, [5], 0, false],
  [0, [6], 1, true],
  [0, [6, 2], 1, false],
  [0, [6, 6], 1, true],
  [49, [1], 50, false],
  [49, [6], 49, true],
  [48, [3], 48, false],
  [44, [6], 50, true],
  [40, [6, 2], 48, false],
  [45, [6, 6], 45, true]
])('agrees with authoritative movement at %i with dice %j', (position, dice, landing, extraTurn) => {
  const resolution = resolveSnakeRoll(position, dice);
  const game = new SnakeGame();
  game.addPlayer('one', 'One'); game.addPlayer('two', 'Two');
  game.players[0].position = position;
  const result = game.rollDice(dice);
  expect(resolution.landing).toBe(landing);
  expect(resolution.extraTurn).toBe(extraTurn);
  expect(result.landing).toBe(landing);
  expect(result.extraTurn).toBe(extraTurn);
  expect(result.finished).toBe(landing === 50);
});

it('does not re-trigger a snake, capture, or bonus after overshooting', () => {
  const game = new SnakeGame({ snakes: { 49: 35 }, diceCells: { 49: 2 } });
  game.addPlayer('one', 'One'); game.addPlayer('two', 'Two');
  game.players.forEach((player) => { player.position = 49; player.isActive = true; });
  const result = game.rollDice([2]);
  expect(result.path).toEqual([]);
  expect(result.position).toBe(49);
  expect(result.bonus).toBeNull();
  expect(game.players[1].position).toBe(49);
  expect(game.diceCells[49]).toBe(2);
});

it('keeps local AI sixes at tile 49 and passes mixed dice to the next seat', () => {
  const base = { roller: 1, positions: [20, 49, 10, 0], values: [6] };
  expect(snakeDiceReceiver(base)).toBe(1);
  expect(snakeDiceReceiver({ ...base, values: [6, 2] })).toBe(0);
  expect(snakeDiceReceiver({ ...base, values: [6, 6] })).toBe(1);
});

it('does not predict a bonus from a stationary tile', () => {
  expect(snakeDiceReceiver({ roller: 1, positions: [20, 49, 10], values: [2], diceCells: { 49: 2 } })).toBe(0);
});

it('rejects invalid dice without moving or awarding extra turns', () => {
  for (const dice of [[], [0], [7], [2.5], [NaN]]) {
    expect(resolveSnakeRoll(10, dice)).toMatchObject({ total: 0, landing: 10, moved: false, extraTurn: false });
  }
});
