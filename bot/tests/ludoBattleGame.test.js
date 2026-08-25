import test from 'node:test';
import assert from 'node:assert/strict';
import { LudoBattleGame } from '../logic/ludoBattleGame.js';

test('server owns dice, turn order and legal token entry', () => {
  const game = new LudoBattleGame(['a', 'b']);
  assert.equal(game.roll('b', () => 0).error, 'not_your_turn');
  const rolled = game.roll('a', () => 0.999);
  assert.equal(rolled.roll, 6);
  assert.deepEqual(rolled.movableTokens, [0, 1, 2, 3]);
  assert.equal(game.move('a', 0, rolled.state.revision).state.progress[0][0], 0);
  assert.equal(game.snapshot().currentPlayerId, 'a');
});

test('rejects stale and impossible moves without mutating state', () => {
  const game = new LudoBattleGame(['a', 'b']);
  const rolled = game.roll('a', () => 0.999);
  assert.equal(game.move('a', 0, rolled.state.revision - 1).error, 'stale_revision');
  assert.equal(game.move('a', 9, rolled.state.revision).error, 'illegal_move');
  assert.deepEqual(game.snapshot().progress[0], [-1, -1, -1, -1]);
});

test('authoritative capture resets the opponent token', () => {
  const game = new LudoBattleGame(['a', 'b']);
  game.progress[0][0] = 9;
  game.progress[1][0] = 1;
  game.pendingRoll = 5;
  const moved = game.move('a', 0, game.revision);
  assert.deepEqual(moved.captures, [{ player: 1, token: 0 }]);
  assert.equal(game.progress[1][0], -1);
});
