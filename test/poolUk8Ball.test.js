import test from 'node:test';
import assert from 'node:assert/strict';
import { UkPool } from '../lib/poolUk8Ball.js';

test('scratch on break gives opponent two visits without free ball', () => {
  const game = new UkPool();
  const res = game.shotTaken({
    contactOrder: ['red'],
    potted: ['cue'],
    cueOffTable: false,
    noCushionAfterContact: false,
    placedFromHand: false
  });
  assert.equal(res.foul, true);
  assert.equal(res.nextPlayer, 'B');
  assert.equal(res.shotsRemainingNext, 2);
  assert.equal(res.freeBallNext, false);
});

test('after foul player must hit a valid colour first', () => {
  const game = new UkPool();
  game.shotTaken({
    contactOrder: ['yellow'],
    potted: ['cue'],
    cueOffTable: false,
    noCushionAfterContact: false,
    placedFromHand: false
  });
  const res = game.shotTaken({
    contactOrder: ['black'],
    potted: [],
    cueOffTable: false,
    noCushionAfterContact: false,
    placedFromHand: true
  });
  assert.equal(res.foul, true);
  assert.equal(res.reason, 'wrong first contact');
});

test('no pot and no cushion is foul', () => {
  const game = new UkPool();
  const res = game.shotTaken({
    contactOrder: ['yellow'],
    potted: [],
    cueOffTable: false,
    noCushionAfterContact: true,
    placedFromHand: false
  });
  assert.equal(res.foul, true);
  assert.equal(res.reason, 'no cushion');
});

test('potting 8-ball before clearing group loses the frame', () => {
  const game = new UkPool();
  // assign groups by potting one yellow
  game.shotTaken({
    contactOrder: ['yellow'],
    potted: ['yellow'],
    cueOffTable: false,
    noCushionAfterContact: false,
    placedFromHand: false
  });
  game.state.currentPlayer = 'A';
  const res = game.shotTaken({
    contactOrder: ['black'],
    potted: ['black'],
    cueOffTable: false,
    noCushionAfterContact: false,
    placedFromHand: false
  });
  assert.equal(res.foul, true);
  assert.equal(res.frameOver, true);
  assert.equal(res.winner, 'B');
});

test('two visits behaviour', () => {
  const game = new UkPool();
  // foul to give B two visits
  game.shotTaken({
    contactOrder: ['yellow'],
    potted: ['cue'],
    cueOffTable: false,
    noCushionAfterContact: false,
    placedFromHand: false
  });
  const res1 = game.shotTaken({
    contactOrder: ['yellow'],
    potted: [],
    cueOffTable: false,
    noCushionAfterContact: false,
    placedFromHand: true
  });
  assert.equal(res1.nextPlayer, 'B');
  assert.equal(res1.shotsRemainingNext, 1);

  const game2 = new UkPool();
  game2.shotTaken({
    contactOrder: ['yellow'],
    potted: ['cue'],
    cueOffTable: false,
    noCushionAfterContact: false,
    placedFromHand: false
  });
  const res2 = game2.shotTaken({
    contactOrder: ['yellow'],
    potted: ['yellow'],
    cueOffTable: false,
    noCushionAfterContact: false,
    placedFromHand: true
  });
  assert.equal(res2.nextPlayer, 'B');
  assert.equal(res2.shotsRemainingNext, 2);
});

test('potting both colours on break requires choice', () => {
  const game = new UkPool();
  const res = game.shotTaken({
    contactOrder: ['yellow'],
    potted: ['yellow', 'red'],
    cueOffTable: false,
    noCushionAfterContact: false,
    placedFromHand: false
  });
  assert.equal(res.foul, false);
  assert.equal(res.choiceRequired, true);
  game.chooseColor('A', 'yellow');
  assert.equal(game.state.assignments.A, 'yellow');
});

test('potting 8-ball legally after clearing group wins', () => {
  const game = new UkPool();
  game.state.assignments = { A: 'yellow', B: 'red' };
  game.state.isOpenTable = false;
  game.state.ballsOnTable.yellow.clear();
  const res = game.shotTaken({
    contactOrder: ['black'],
    potted: ['black'],
    cueOffTable: false,
    noCushionAfterContact: false,
    placedFromHand: false
  });
  assert.equal(res.legal, true);
  assert.equal(res.frameOver, true);
  assert.equal(res.winner, 'A');
});
