import test from 'node:test';
import assert from 'node:assert/strict';
import { SnakeGame, FINAL_TILE } from '../bot/logic/snakeGame.js';

function setupGame() {
  const game = new SnakeGame({ snakes: {}, ladders: {} });
  game.addPlayer('p1', 'A');
  return game;
}

// Dice rolling should accept provided values and activate token when a six appears
test('dice roll activates token with six', () => {
  const game = setupGame();
  const res = game.rollDice([6, 3]);
  assert.equal(res.player, 'p1');
  assert.deepEqual(res.dice, [6, 3]);
  assert.equal(game.players[0].position, 1);
  assert.deepEqual(res.path, [1]);
});

// After entering the board the token moves forward by the dice total
test('token moves forward by dice total', () => {
  const game = setupGame();
  game.players[0].position = 1;
  const res = game.rollDice([2, 3]);
  assert.equal(game.players[0].position, 6);
  assert.deepEqual(res.path, [2, 3, 4, 5, 6]);
});

// Reaching the final tile ends the game
test('player wins when reaching final tile', () => {
  const game = setupGame();
  game.players[0].position = 100;
  game.players[0].diceCount = 1;
  const res = game.rollDice([1]);
  assert.equal(game.players[0].position, FINAL_TILE);
  assert.ok(res.finished);
  assert.ok(game.finished);
});
