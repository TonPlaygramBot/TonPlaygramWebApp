import test from 'node:test';
import assert from 'node:assert/strict';
import { Albanian61 } from '../lib/albanian61.js';

for (const seat of ['A', 'B']) {
  test(`61 legal break scores numeric values for ${seat} and keeps turn`, () => {
    const game = new Albanian61();
    game.state.currentPlayer = seat;
    const result = game.shotTaken({ contactOrder: ['ball_1'], potted: ['ball_8', 'ball_15'] });
    assert.equal(result.foul, false);
    assert.equal(result.points, 23);
    assert.equal(game.state.scores[seat], 23);
    assert.equal(game.state.currentPlayer, seat);
    assert.equal(game.state.frameOver, false);
    assert.equal(game.state.ballsOnTable.has(8), false);
    assert.equal(game.state.breakInProgress, false);
    assert.equal(game.state.ballInHand, false);
  });
  test(`61 scratch on ${seat}'s break restores pots and awards no points`, () => {
    const game = new Albanian61();
    game.state.currentPlayer = seat;
    const result = game.shotTaken({ contactOrder: [1], potted: [0, 8, 15] });
    assert.equal(result.reason, 'scratch');
    assert.equal(game.state.scores[seat], 0);
    assert.equal(game.state.ballsOnTable.size, 15);
    assert.equal(game.state.currentPlayer, seat === 'A' ? 'B' : 'A');
    assert.equal(game.state.ballInHand, true);
    assert.equal(game.state.mustPlayFromBaulk, true);
  });
}

test('61 requires lowest first while permitting any scoring combination', () => {
  const game = new Albanian61();
  const foul = game.shotTaken({ contactOrder: [15], potted: [15] });
  assert.equal(foul.reason, 'wrong first contact');
  assert.equal(game.state.ballsOnTable.has(15), true);
  const legal = game.shotTaken({ contactOrder: [1], potted: [15] });
  assert.equal(legal.foul, false);
  assert.deepEqual(game.state.scores, { A: 0, B: 15 });
});

test('61 dry break needs four distinct object balls at rails', () => {
  const game = new Albanian61();
  assert.equal(game.shotTaken({ contactOrder: [1], objectBallsToRailAfterContact: [1, 1, 2, 3, 0] }).reason, 'illegal break');
  const legal = new Albanian61();
  assert.equal(legal.shotTaken({ contactOrder: [1], objectBallsToRailAfterContact: [1, 2, 3, 4] }).foul, false);
  assert.equal(legal.state.currentPlayer, 'B');
});

test('61 deduplicates pocket notifications and ignores balls already scored', () => {
  const game = new Albanian61();
  game.shotTaken({ contactOrder: [1], potted: [1, 'ball_1', 15, 15, 16, 'pocket_3'] });
  assert.equal(game.state.scores.A, 16);
  const later = game.shotTaken({ contactOrder: [2], potted: [1, 15], noCushionAfterContact: true });
  assert.equal(later.reason, 'no cushion');
  assert.equal(game.state.scores.A, 16);
});

test('61 object off table and explicit foul never score', () => {
  const game = new Albanian61();
  const result = game.shotTaken({ contactOrder: [1], potted: [15], offTable: [14] });
  assert.equal(result.reason, 'object ball off table');
  assert.equal(game.state.ballsOnTable.size, 15);
  const timeout = game.shotTaken({ contactOrder: [1], potted: [14], foulReason: 'shot clock expired' });
  assert.equal(timeout.reason, 'shot clock expired');
  assert.deepEqual(game.state.scores, { A: 0, B: 0 });
});

test('61 ends immediately on reaching the target; delayed events cannot change winner', () => {
  const game = new Albanian61();
  const result = game.shotTaken({ contactOrder: [1], potted: [1, 10, 11, 12, 13, 14] });
  assert.equal(result.points, 61);
  assert.equal(game.state.frameOver, true);
  assert.equal(game.state.winner, 'A');
  assert.equal(game.state.scores.A, 61);
  const snapshot = JSON.stringify({ ...game.state, ballsOnTable: [...game.state.ballsOnTable] });
  game.shotTaken({ contactOrder: [2], potted: [0, 15] });
  assert.equal(JSON.stringify({ ...game.state, ballsOnTable: [...game.state.ballsOnTable] }), snapshot);
});

test('61 ends on exceeding target too', () => {
  const game = new Albanian61();
  game.shotTaken({ contactOrder: [1], potted: [11, 12, 13, 14, 15] });
  assert.equal(game.state.scores.A, 65);
  assert.equal(game.state.winner, 'A');
});

test('60–60 awards exactly one deciding point to the last legal potter', () => {
  const game = new Albanian61();
  game.state.breakInProgress = false;
  game.state.ballsOnTable = new Set([15]);
  game.state.scores = { A: 60, B: 45 };
  game.state.currentPlayer = 'B';
  game.shotTaken({ contactOrder: [15], potted: [15] });
  assert.deepEqual(game.state.scores, { A: 60, B: 61 });
  assert.equal(game.state.winner, 'B');
  assert.equal(game.state.tieBreakBonus, 'B');
});
