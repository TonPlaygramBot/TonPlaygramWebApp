import test from 'node:test';
import assert from 'node:assert/strict';
import { BcaEightBall } from '../lib/bcaEightBall.js';

test('legal black pot is not marked foul when hit event is missing but pot is present', () => {
  const game = new BcaEightBall();
  game.state.breakInProgress = false;
  game.state.assignments = { A: 'SOLID', B: 'STRIPE' };
  game.state.ballsOnTable = new Set([8]);

  const res = game.shotTaken({
    contactOrder: [],
    potted: [8],
    cueOffTable: false
  });

  assert.equal(res.foul, false);
  assert.equal(res.frameOver, true);
  assert.equal(res.winner, 'A');
});
