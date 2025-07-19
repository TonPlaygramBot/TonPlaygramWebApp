import test from 'node:test';
import assert from 'node:assert/strict';
import { LudoGame } from '../bot/logic/ludoGame.js';

test('token requires 6 to leave base', () => {
  const game = new LudoGame(2);
  const res = game.rollDice(3);
  assert.equal(game.players[0].tokens[0], -1);
  assert.equal(game.currentTurn, 1);
  game.currentTurn = 0;
  game.rollDice(6);
  assert.equal(game.players[0].tokens[0], 0);
});

test('player wins when all tokens finish', () => {
  const game = new LudoGame(1);
  game.players[0].tokens = Array(4).fill(56);
  game.players[0].finished = 3;
  game.currentTurn = 0;
  const res = game.rollDice(1);
  assert.ok(game.finished);
});

