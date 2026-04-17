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


test('legal break that pots an object ball keeps breaker shooting', () => {
  const game = new NineBall();
  const res = game.shotTaken({
    contactOrder: [1],
    potted: [1],
    cueOffTable: false,
    placedFromHand: false
  });

  assert.equal(res.foul, false);
  assert.equal(res.nextPlayer, 'A');
  assert.equal(game.state.currentPlayer, 'A');
  assert.equal(game.state.breakInProgress, false);
  assert.equal(game.state.ballsOnTable.has(1), false);
});

test('official 9-ball: legal nine on the break wins immediately', () => {
  const game = new NineBall();
  const res = game.shotTaken({
    contactOrder: [1],
    potted: [9],
    cueOffTable: false,
    placedFromHand: false,
    railContactsAfterFirstHit: 4
  });

  assert.equal(res.foul, false);
  assert.equal(res.frameOver, true);
  assert.equal(res.winner, 'A');
  assert.equal(game.state.gameOver, true);
});

test('official 9-ball: nine potted on a foul break is spotted and inning passes with ball in hand', () => {
  const game = new NineBall();
  const res = game.shotTaken({
    contactOrder: [1],
    potted: [9, 0],
    cueOffTable: false,
    placedFromHand: false,
    railContactsAfterFirstHit: 4
  });

  assert.equal(res.foul, true);
  assert.equal(res.reason, 'scratch');
  assert.equal(res.frameOver, false);
  assert.equal(res.nextPlayer, 'B');
  assert.equal(res.ballInHandNext, true);
  assert.equal(game.state.ballsOnTable.has(9), true);
});
