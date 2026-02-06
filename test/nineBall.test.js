import test from 'node:test';
import assert from 'node:assert/strict';
import { NineBall } from '../lib/nineBall.js';

test('must hit lowest ball first or foul', () => {
  const game = new NineBall();
  const res = game.shotTaken({
    contactOrder: [2],
    potted: [],
    cueOffTable: false,
    placedFromHand: false
  });
  assert.equal(res.foul, true);
  assert.equal(res.reason, 'wrong first contact');
  assert.equal(res.ballInHandNext, true);
  assert.equal(res.nextPlayer, 'B');
});

test('potting nine after legal contact wins', () => {
  const game = new NineBall();
  const res = game.shotTaken({
    contactOrder: [1],
    potted: [9],
    cueOffTable: false,
    placedFromHand: false
  });
  assert.equal(res.foul, false);
  assert.equal(res.frameOver, true);
  assert.equal(res.winner, 'A');
});

test('scratch gives opponent ball in hand', () => {
  const game = new NineBall();
  const res1 = game.shotTaken({
    contactOrder: [1],
    potted: [0],
    cueOffTable: false,
    placedFromHand: false
  });
  assert.equal(res1.foul, true);
  assert.equal(res1.reason, 'scratch');
  assert.equal(res1.ballInHandNext, true);
  assert.equal(res1.nextPlayer, 'B');
  assert.equal(game.state.currentPlayer, 'B');
});
