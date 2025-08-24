import test from 'node:test';
import assert from 'node:assert/strict';
import { AmericanBilliards } from '../lib/americanBilliards.js';

test('hitting wrong ball first is foul and points to opponent', () => {
  const game = new AmericanBilliards();
  const res = game.shotTaken({
    contactOrder: [2],
    potted: [2],
    cueOffTable: false,
    placedFromHand: false
  });
  assert.equal(res.foul, true);
  assert.equal(res.reason, 'wrong first contact');
  assert.equal(res.nextPlayer, 'B');
  assert.equal(res.ballInHandNext, true);
  assert.equal(res.scores.B, 2);
  assert.equal(game.state.ballsOnTable.has(2), true);
});

test('legal pot adds points and keeps turn', () => {
  const game = new AmericanBilliards();
  const res1 = game.shotTaken({
    contactOrder: [1],
    potted: [1],
    cueOffTable: false,
    placedFromHand: false
  });
  assert.equal(res1.foul, false);
  assert.equal(res1.nextPlayer, 'A');
  assert.equal(res1.scores.A, 1);
  const res2 = game.shotTaken({
    contactOrder: [2],
    potted: [],
    cueOffTable: false,
    placedFromHand: false
  });
  assert.equal(res2.nextPlayer, 'B');
});

test('scratch gives opponent points and ball in hand', () => {
  const game = new AmericanBilliards();
  const res = game.shotTaken({
    contactOrder: [1],
    potted: [1, 0],
    cueOffTable: false,
    placedFromHand: false
  });
  assert.equal(res.foul, true);
  assert.equal(res.reason, 'scratch');
  assert.equal(res.nextPlayer, 'B');
  assert.equal(res.ballInHandNext, true);
  assert.equal(res.scores.B, 1);
  assert.equal(game.state.ballsOnTable.has(1), true);
});

test('eight ball is treated as normal', () => {
  const game = new AmericanBilliards();
  game.shotTaken({ contactOrder: [1], potted: [1], cueOffTable: false, placedFromHand: false });
  const res = game.shotTaken({
    contactOrder: [2],
    potted: [2, 8],
    cueOffTable: false,
    placedFromHand: false
  });
  assert.equal(res.foul, false);
  assert.equal(res.scores.A, 1 + 2 + 8);
});
