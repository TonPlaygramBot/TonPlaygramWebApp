import test from 'node:test';
import assert from 'node:assert/strict';
import { AmericanBilliards } from '../lib/americanBilliards.js';

test('open table assigns groups on first legal pot', () => {
  const game = new AmericanBilliards();
  const res = game.shotTaken({
    contactOrder: [3],
    potted: [3],
    cueOffTable: false,
    placedFromHand: false
  });
  assert.equal(res.foul, false);
  assert.equal(game.state.isOpenTable, false);
  assert.equal(game.state.assignments.A, 'SOLIDS');
  assert.equal(game.state.assignments.B, 'STRIPES');
});

test('eight ball on the break is a win', () => {
  const game = new AmericanBilliards();
  const res = game.shotTaken({
    contactOrder: [8],
    potted: [8],
    cueOffTable: false,
    placedFromHand: false
  });
  assert.equal(res.frameOver, true);
  assert.equal(res.winner, 'A');
});

test('wrong first contact after assignment is a foul', () => {
  const game = new AmericanBilliards();
  game.shotTaken({ contactOrder: [2], potted: [2], cueOffTable: false, placedFromHand: false });
  const res = game.shotTaken({
    contactOrder: [9],
    potted: [],
    cueOffTable: false,
    placedFromHand: false,
    noCushionAfterContact: false
  });
  assert.equal(res.foul, true);
  assert.equal(res.reason, 'wrong first contact');
  assert.equal(res.nextPlayer, 'B');
  assert.equal(res.ballInHandNext, true);
});

test('early eight-ball is a loss', () => {
  const game = new AmericanBilliards();
  game.shotTaken({ contactOrder: [10], potted: [10], cueOffTable: false, placedFromHand: false });
  const res = game.shotTaken({
    contactOrder: [8],
    potted: [8],
    cueOffTable: false,
    placedFromHand: false
  });
  assert.equal(res.frameOver, true);
  assert.equal(res.winner, 'B');
});

test('clearing group then potting eight wins', () => {
  const game = new AmericanBilliards();
  game.shotTaken({ contactOrder: [1], potted: [1], cueOffTable: false, placedFromHand: false });
  game.state.ballsOnTable = new Set([8]);
  const res = game.shotTaken({
    contactOrder: [8],
    potted: [8],
    cueOffTable: false,
    placedFromHand: false
  });
  assert.equal(res.frameOver, true);
  assert.equal(res.winner, 'A');
});
