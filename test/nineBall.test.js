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
  assert.equal(game.state.currentPlayer, 'B');
  const res2 = game.shotTaken({
    contactOrder: [1],
    potted: [],
    cueOffTable: false,
    placedFromHand: true
  });
  assert.equal(res2.foul, false);
  assert.equal(res2.ballInHandNext, false);
});

test('foul still grants ball-in-hand and removes pocketed object balls', () => {
  const game = new NineBall();
  const res = game.shotTaken({
    contactOrder: [],
    potted: [2, 3],
    cueOffTable: true,
    placedFromHand: false
  });
  assert.equal(res.foul, true);
  assert.equal(res.reason, 'no contact');
  assert.equal(res.nextPlayer, 'B');
  assert.equal(res.ballInHandNext, true);
  assert.equal(game.state.ballsOnTable.has(2), false);
  assert.equal(game.state.ballsOnTable.has(3), false);
  assert.equal(game.state.ballsOnTable.has(9), true);
});

test('pocketing the nine on a foul respots it', () => {
  const game = new NineBall();
  const res = game.shotTaken({
    contactOrder: [1],
    potted: [1, 9, 0],
    cueOffTable: true,
    placedFromHand: false
  });
  assert.equal(res.foul, true);
  assert.equal(res.reason, 'scratch');
  assert.equal(res.ballInHandNext, true);
  assert.equal(game.state.ballsOnTable.has(9), true);
  assert.equal(game.state.ballsOnTable.has(1), false);
});
