import test from 'node:test';
import assert from 'node:assert/strict';
import { UkPool } from '../lib/poolUk8Ball.js';
import { selectShot, recordShotOutcome, __resetShotMemory } from '../lib/poolUkAdvancedAi.js';
import planShot from '../lib/poolAi.js';

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
});

test('after foul player must hit a valid colour first', () => {
  const game = new UkPool();
  game.shotTaken({
    contactOrder: ['blue'],
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
    contactOrder: ['blue'],
    potted: [],
    cueOffTable: false,
    noCushionAfterContact: true,
    placedFromHand: false
  });
  assert.equal(res.foul, true);
  assert.equal(res.reason, 'no cushion');
});

test('potting opponent ball is foul', () => {
  const game = new UkPool();
  game.state.assignments = { A: 'blue', B: 'red' };
  game.state.isOpenTable = false;
  const res = game.shotTaken({
    contactOrder: ['blue'],
    potted: ['red'],
    cueOffTable: false,
    noCushionAfterContact: false,
    placedFromHand: false
  });
  assert.equal(res.foul, true);
  assert.equal(res.reason, 'potted opponent ball');
});

test('potting 8-ball before clearing group loses the frame', () => {
  const game = new UkPool();
  // assign groups by potting one blue
  game.shotTaken({
    contactOrder: ['blue'],
    potted: ['blue'],
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
    contactOrder: ['blue'],
    potted: ['cue'],
    cueOffTable: false,
    noCushionAfterContact: false,
    placedFromHand: false
  });
  const res1 = game.shotTaken({
    contactOrder: ['blue'],
    potted: [],
    cueOffTable: false,
    noCushionAfterContact: false,
    placedFromHand: true
  });
  assert.equal(res1.nextPlayer, 'B');
  assert.equal(res1.shotsRemainingNext, 1);

  const game2 = new UkPool();
  game2.shotTaken({
    contactOrder: ['blue'],
    potted: ['cue'],
    cueOffTable: false,
    noCushionAfterContact: false,
    placedFromHand: false
  });
  const res2 = game2.shotTaken({
    contactOrder: ['blue'],
    potted: ['blue'],
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
    contactOrder: ['blue'],
    potted: ['blue', 'red'],
    cueOffTable: false,
    noCushionAfterContact: false,
    placedFromHand: false
  });
  assert.equal(res.foul, false);
  assert.equal(res.choiceRequired, true);
  game.chooseColor('A', 'blue');
  assert.equal(game.state.assignments.A, 'blue');
});

test('cross pot on break is legal', () => {
  const game = new UkPool();
  const res = game.shotTaken({
    contactOrder: ['blue'],
    potted: ['red'],
    cueOffTable: false,
    noCushionAfterContact: false,
    placedFromHand: false
  });
  assert.equal(res.foul, false);
  assert.equal(game.state.assignments.A, 'red');
});

test('cross pot on open table after break is foul', () => {
  const game = new UkPool();
  game.shotTaken({
    contactOrder: ['blue'],
    potted: [],
    cueOffTable: false,
    noCushionAfterContact: false,
    placedFromHand: false
  });
  const res = game.shotTaken({
    contactOrder: ['red'],
    potted: ['blue'],
    cueOffTable: false,
    noCushionAfterContact: false,
    placedFromHand: false
  });
  assert.equal(res.foul, true);
  assert.equal(res.reason, 'wrong ball potted');
});

test('potting 8-ball legally after clearing group wins', () => {
  const game = new UkPool();
  game.state.assignments = { A: 'blue', B: 'red' };
  game.state.isOpenTable = false;
  game.state.ballsOnTable.blue.clear();
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

test('hitting black after clearing group without pot is legal', () => {
  const game = new UkPool();
  game.state.assignments = { A: 'blue', B: 'red' };
  game.state.isOpenTable = false;
  game.state.ballsOnTable.blue.clear();
  const res = game.shotTaken({
    contactOrder: ['black'],
    potted: [],
    cueOffTable: false,
    noCushionAfterContact: false,
    placedFromHand: false
  });
  assert.equal(res.foul, false);
});

test('potting black when one colour cleared on open table is legal', () => {
  const game = new UkPool();
  game.state.ballsOnTable.blue.clear();
  game.state.isOpenTable = true;
  const res = game.shotTaken({
    contactOrder: ['black'],
    potted: ['black'],
    cueOffTable: false,
    noCushionAfterContact: false,
    placedFromHand: false
  });
  assert.equal(res.foul, false);
  assert.equal(res.frameOver, true);
  assert.equal(res.winner, 'A');
});

test('after foul cue must be played from baulk', () => {
  const game = new UkPool();
  game.shotTaken({
    contactOrder: ['blue'],
    potted: ['cue'],
    cueOffTable: false,
    noCushionAfterContact: false,
    placedFromHand: false
  });
  const res = game.shotTaken({
    contactOrder: ['blue'],
    potted: [],
    cueOffTable: false,
    noCushionAfterContact: false,
    placedFromHand: false
  });
  assert.equal(res.foul, true);
  assert.equal(res.reason, 'must play from baulk');
});

test('shots after frame end are not fouls', () => {
  const game = new UkPool();
  game.state.assignments = { A: 'blue', B: 'red' };
  game.state.isOpenTable = false;
  game.state.ballsOnTable.blue.clear();
  game.shotTaken({
    contactOrder: ['black'],
    potted: ['black'],
    cueOffTable: false,
    noCushionAfterContact: false,
    placedFromHand: false
  });
  const res = game.shotTaken({
    contactOrder: ['blue'],
    potted: [],
    cueOffTable: false,
    noCushionAfterContact: false,
    placedFromHand: false
  });
  assert.equal(res.foul, false);
  assert.equal(res.frameOver, true);
});

test('AI targets black when own balls cleared', () => {
  __resetShotMemory();
  const state = {
    balls: [
      { id: 0, colour: 'cue', x: 50, y: 50 },
      { id: 1, colour: 'black', x: 200, y: 200 }
    ],
    pockets: [
      { name: 'TL', x: 0, y: 0 },
      { name: 'TR', x: 300, y: 0 },
      { name: 'ML', x: 0, y: 150 },
      { name: 'MR', x: 300, y: 150 },
      { name: 'BL', x: 0, y: 300 },
      { name: 'BR', x: 300, y: 300 }
    ],
    width: 300,
    height: 300,
    ballRadius: 5,
    ballOn: 'blue',
    isOpenTable: false,
    shotsRemaining: 1
  };
  const plan = selectShot(state);
  assert.equal(plan.targetBall, 'black');
});

test('AI plays safety when own ball is blocked', () => {
  __resetShotMemory();
  const state = {
    balls: [
      { id: 0, colour: 'cue', x: 50, y: 150 },
      { id: 1, colour: 'blue', x: 250, y: 150 },
      { id: 2, colour: 'red', x: 150, y: 150 }
    ],
    pockets: [
      { name: 'TL', x: 0, y: 0 },
      { name: 'TR', x: 300, y: 0 },
      { name: 'ML', x: 0, y: 150 },
      { name: 'MR', x: 300, y: 150 },
      { name: 'BL', x: 0, y: 300 },
      { name: 'BR', x: 300, y: 300 }
    ],
    width: 300,
    height: 300,
    ballRadius: 5,
    ballOn: 'blue',
    isOpenTable: false,
    shotsRemaining: 1
  };
  const plan = selectShot(state);
  assert.equal(plan.actionType, 'safety');
});

test('AI increases EV after learning from success', () => {
  __resetShotMemory();
  const state = {
    balls: [
      { id: 0, colour: 'cue', x: 200, y: 20 },
      { id: 1, colour: 'blue', x: 260, y: 20 }
    ],
    pockets: [
      { name: 'TL', x: 0, y: 0 },
      { name: 'TR', x: 300, y: 0 },
      { name: 'ML', x: 0, y: 150 },
      { name: 'MR', x: 300, y: 150 },
      { name: 'BL', x: 0, y: 300 },
      { name: 'BR', x: 300, y: 300 }
    ],
    width: 300,
    height: 300,
    ballRadius: 5,
    ballOn: 'blue',
    isOpenTable: false,
    shotsRemaining: 1
  };
  const plan1 = selectShot(state);
  const ev1 = plan1.EV;
  recordShotOutcome(plan1, true);
  const plan2 = selectShot(state);
  assert.ok(plan2.EV >= ev1);
});

test('basic AI targets its assigned colour', () => {
  const req = {
    game: 'EIGHT_POOL_UK',
    state: {
      balls: [
        { id: 0, x: 50, y: 150, vx: 0, vy: 0, pocketed: false },
        { id: 1, x: 150, y: 150, vx: 0, vy: 0, pocketed: false },
        { id: 9, x: 250, y: 150, vx: 0, vy: 0, pocketed: false }
      ],
      pockets: [
        { x: 0, y: 0 },
        { x: 300, y: 0 },
        { x: 0, y: 150 },
        { x: 300, y: 150 },
        { x: 0, y: 300 },
        { x: 300, y: 300 }
      ],
      width: 300,
      height: 300,
      ballRadius: 5,
      friction: 0.015,
      ballOn: 'red',
      myGroup: 'UNASSIGNED',
      ballInHand: false
    }
  };
  const shot = planShot(req);
  assert.ok(shot && shot.targetBallId >= 1 && shot.targetBallId <= 7);
});
