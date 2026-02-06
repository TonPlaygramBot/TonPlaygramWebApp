import test from 'node:test';
import assert from 'node:assert/strict';
import { AmericanBilliards } from '../lib/americanBilliards.js';

test('open table assigns group after a clean pot', () => {
  const game = new AmericanBilliards();
  const res = game.shotTaken({
    contactOrder: [2],
    potted: [2],
    cueOffTable: false,
    placedFromHand: false
  });
  assert.equal(res.foul, false);
  assert.equal(game.state.assignments.A, 'solids');
  assert.equal(game.state.assignments.B, 'stripes');
});

test('potting both groups keeps table open', () => {
  const game = new AmericanBilliards();
  const res = game.shotTaken({
    contactOrder: [2],
    potted: [2, 9],
    cueOffTable: false,
    placedFromHand: false
  });
  assert.equal(res.foul, false);
  assert.equal(game.state.isOpenTable, true);
  assert.equal(game.state.assignments.A, null);
});

test('wrong first contact after assignment is a foul', () => {
  const game = new AmericanBilliards();
  game.shotTaken({ contactOrder: [1], potted: [1], cueOffTable: false, placedFromHand: false });
  const res = game.shotTaken({
    contactOrder: [9],
    potted: [],
    cueOffTable: false,
    placedFromHand: false
  });
  assert.equal(res.foul, true);
  assert.equal(res.reason, 'wrong first contact');
  assert.equal(res.nextPlayer, 'B');
  assert.equal(res.ballInHandNext, true);
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
});

test('illegal early 8-ball ends the frame', () => {
  const game = new AmericanBilliards();
  const res = game.shotTaken({
    contactOrder: [8],
    potted: [8],
    cueOffTable: false,
    placedFromHand: false
  });
  assert.equal(res.foul, true);
  assert.equal(res.frameOver, true);
  assert.equal(res.winner, 'B');
});

test('legal 8-ball wins after clearing group', () => {
  const game = new AmericanBilliards();
  game.shotTaken({ contactOrder: [1], potted: [1], cueOffTable: false, placedFromHand: false });
  for (const id of [2, 3, 4, 5, 6, 7]) {
    game.shotTaken({ contactOrder: [id], potted: [id], cueOffTable: false, placedFromHand: false });
  }
  const res = game.shotTaken({
    contactOrder: [8],
    potted: [8],
    cueOffTable: false,
    placedFromHand: false
  });
  assert.equal(res.foul, false);
  assert.equal(res.frameOver, true);
  assert.equal(res.winner, 'A');
});
