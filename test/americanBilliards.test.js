import test from 'node:test';
import assert from 'node:assert/strict';
import { AmericanBilliards } from '../lib/americanBilliards.js';

test('open table assigns group on a legal pot', () => {
  const game = new AmericanBilliards();
  const res = game.shotTaken({
    contactOrder: [1],
    potted: [1],
    cueOffTable: false,
    placedFromHand: false
  });
  assert.equal(res.foul, false);
  assert.equal(res.nextPlayer, 'A');
  assert.equal(res.assignments.A, 'solids');
  assert.equal(res.assignments.B, 'stripes');
  assert.equal(res.isOpenTable, false);
});

test('illegal first contact on the 8 ball is a foul on an open table', () => {
  const game = new AmericanBilliards();
  const res = game.shotTaken({
    contactOrder: [8],
    potted: [],
    cueOffTable: false,
    placedFromHand: false
  });
  assert.equal(res.foul, true);
  assert.equal(res.reason, 'illegal first contact');
  assert.equal(res.nextPlayer, 'B');
  assert.equal(res.ballInHandNext, true);
});

test('pocketing the 8 ball early is loss', () => {
  const game = new AmericanBilliards();
  game.shotTaken({ contactOrder: [1], potted: [1], cueOffTable: false, placedFromHand: false });
  const res = game.shotTaken({
    contactOrder: [8],
    potted: [8],
    cueOffTable: false,
    placedFromHand: false
  });
  assert.equal(res.frameOver, true);
  assert.equal(res.winner, 'B');
});

test('clearing group and pocketing 8 ball wins', () => {
  const game = new AmericanBilliards();
  game.state.assignments = { A: 'solids', B: 'stripes' };
  game.state.isOpenTable = false;
  for (let i = 1; i <= 7; i += 1) {
    game.state.ballsOnTable.delete(i);
  }
  const res = game.shotTaken({
    contactOrder: [8],
    potted: [8],
    cueOffTable: false,
    placedFromHand: false
  });
  assert.equal(res.frameOver, true);
  assert.equal(res.winner, 'A');
});
