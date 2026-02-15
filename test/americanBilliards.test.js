import test from 'node:test';
import assert from 'node:assert/strict';
import { AmericanBilliards } from '../lib/americanBilliards.js';

test('hitting wrong ball first is foul and gives opponent ball in hand', () => {
  const game = new AmericanBilliards();
  game.state.breakInProgress = false;
  game.state.assignments = { A: 'SOLID', B: 'STRIPE' };
  const res = game.shotTaken({
    contactOrder: [10],
    potted: [10],
    cueOffTable: false,
    placedFromHand: false
  });
  assert.equal(res.foul, true);
  assert.equal(res.reason, 'wrong first contact');
  assert.equal(res.nextPlayer, 'B');
  assert.equal(res.ballInHandNext, true);
  assert.equal(res.scores.B, 0);
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

test('scratch gives opponent ball in hand', () => {
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
  assert.equal(res.scores.B, 0);
  assert.equal(game.state.ballsOnTable.has(1), true);
});

test('eight ball is only legal after clearing own group', () => {
  const game = new AmericanBilliards();
  game.shotTaken({ contactOrder: [1], potted: [1], cueOffTable: false, placedFromHand: false });
  const res = game.shotTaken({
    contactOrder: [2],
    potted: [2, 8],
    cueOffTable: false,
    placedFromHand: false
  });
  assert.equal(res.frameOver, true);
  assert.equal(res.winner, 'B');
});

test('group is not assigned from a legal break', () => {
  const game = new AmericanBilliards();
  const res = game.shotTaken({
    contactOrder: [1],
    potted: [1, 9],
    cueOffTable: false
  });
  assert.equal(res.foul, false);
  assert.equal(game.state.assignments.A, null);
  assert.equal(game.state.assignments.B, null);
  assert.equal(game.state.breakInProgress, false);
});

test('eight on break is spotted and frame continues', () => {
  const game = new AmericanBilliards();
  const res = game.shotTaken({
    contactOrder: [1],
    potted: [8],
    cueOffTable: false
  });
  assert.equal(res.frameOver, false);
  assert.equal(game.state.ballsOnTable.has(8), true);
});
