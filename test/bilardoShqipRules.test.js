import test from 'node:test';
import assert from 'node:assert/strict';
import { BilardoShqipRules } from '../lib/bilardoShqipRules.js';

test('Bilardo Shqip: lowest ball contact is mandatory after break', () => {
  const game = new BilardoShqipRules();
  game.state.breakInProgress = false;
  const res = game.shotTaken({
    contactOrder: [3],
    potted: [],
    cueOffTable: false
  });

  assert.equal(res.foul, true);
  assert.equal(res.reason, 'wrong first contact');
  assert.equal(res.nextPlayer, 'B');
});

test('Bilardo Shqip: scoring uses numbered balls and race-to-61 win condition', () => {
  const game = new BilardoShqipRules();
  game.state.breakInProgress = false;
  game.state.scores.A = 52;
  game.state.ballsOnTable = new Set([9, 15]);

  const res = game.shotTaken({
    contactOrder: [9],
    potted: [9],
    cueOffTable: false
  });

  assert.equal(res.foul, false);
  assert.equal(res.scores.A, 61);
  assert.equal(res.frameOver, true);
  assert.equal(res.winner, 'A');
});
