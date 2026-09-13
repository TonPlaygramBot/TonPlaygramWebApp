import { expect, it } from 'vitest';
import { snakeDiceReceiver } from './snakeDiceReceiver';
import { SnakeGame } from '../../../bot/logic/snakeGame';

it.each([2, 3, 4])('matches the authoritative receiver for %i-player rolls, bonuses and effects', count => {
  for (let roller = 0; roller < count; roller++) for (const position of [0, 1, 8, 20, 45, 49]) for (let value = 1; value <= 6; value++) {
    const game = new SnakeGame({ snakes: { 10: 2 }, ladders: { 3: 22 }, diceCells: { 22: 1 } });
    for (let i = 0; i < count; i++) game.addPlayer(String(i), String(i));
    game.currentTurn = roller; game.players[roller].position = position;
    const receiver = snakeDiceReceiver({ roller, positions: game.players.map(p => p.position), values: [value], snakes: game.snakes, ladders: game.ladders, diceCells: game.diceCells, online: true });
    game.rollDice([value]); expect(receiver).toBe(game.currentTurn);
  }
});
it('uses the local reverse order, including sixes and bonus landings', () => {
  const base = { roller: 0, positions: [1, 0, 0, 0], values: [2] };
  expect(snakeDiceReceiver(base)).toBe(3);
  expect(snakeDiceReceiver({ ...base, values: [6] })).toBe(0);
  expect(snakeDiceReceiver({ ...base, ladders: { 3: 22 }, diceCells: { 22: 1 } })).toBe(0);
  expect(snakeDiceReceiver({ ...base, roller: 1, positions: [0, 49, 0, 0], values: [6] })).toBe(0);
  expect(snakeDiceReceiver({ ...base, positions: [49, 0, 0, 0], values: [6] })).toBe(0);
});
