import test from 'node:test';
import assert from 'node:assert/strict';
import { planShot, estimateCueAfterShot } from '../lib/poolAi.js';

test('planShot targets lowest numbered ball', () => {
  const req = {
    game: 'AMERICAN_BILLIARDS',
    state: {
      balls: [
        { id: 0, x: 300, y: 250, vx: 0, vy: 0, pocketed: false },
        { id: 3, x: 500, y: 250, vx: 0, vy: 0, pocketed: false },
        { id: 5, x: 700, y: 250, vx: 0, vy: 0, pocketed: false }
      ],
      pockets: [
        { x: 0, y: 0 }, { x: 500, y: 0 }, { x: 1000, y: 0 },
        { x: 0, y: 500 }, { x: 500, y: 500 }, { x: 1000, y: 500 }
      ],
      width: 1000,
      height: 500,
      ballRadius: 10,
      friction: 0.01
    },
    timeBudgetMs: 100,
    rngSeed: 1
  };
  const decision = planShot(req);
  assert.equal(decision.targetBallId, 3);
  assert(decision.targetPocket);
  assert(decision.quality >= 0 && decision.quality <= 1);
  assert(decision.rationale.length > 0);
});

test('eight ball is treated as normal', () => {
  const req = {
    game: 'AMERICAN_BILLIARDS',
    state: {
      balls: [
        { id: 0, x: 100, y: 100, vx: 0, vy: 0, pocketed: false },
        { id: 8, x: 300, y: 100, vx: 0, vy: 0, pocketed: false }
      ],
      pockets: [
        { x: 0, y: 0 }, { x: 500, y: 0 }, { x: 1000, y: 0 },
        { x: 0, y: 500 }, { x: 500, y: 500 }, { x: 1000, y: 500 }
      ],
      width: 1000,
      height: 500,
      ballRadius: 10,
      friction: 0.01
    },
    timeBudgetMs: 100,
    rngSeed: 1
  };
  const decision = planShot(req);
  assert.equal(decision.targetBallId, 8);
});

test('ball in hand aims for straight shot', () => {
  const req = {
    game: 'AMERICAN_BILLIARDS',
    state: {
      balls: [
        { id: 0, x: 0, y: 0, vx: 0, vy: 0, pocketed: false },
        { id: 2, x: 500, y: 250, vx: 0, vy: 0, pocketed: false }
      ],
      pockets: [
        { x: 0, y: 0 }, { x: 500, y: 0 }, { x: 1000, y: 0 },
        { x: 0, y: 500 }, { x: 500, y: 500 }, { x: 1000, y: 500 }
      ],
      width: 1000,
      height: 500,
      ballRadius: 10,
      friction: 0.01,
      ballInHand: true
    },
    timeBudgetMs: 100,
    rngSeed: 2
  };
  const decision = planShot(req);
  assert(decision.cueBallPosition);
  const cue = decision.cueBallPosition;
  const pocket = decision.targetPocket;
  const target = req.state.balls[1];
  const angle1 = Math.atan2(target.y - cue.y, target.x - cue.x);
  const angle2 = Math.atan2(pocket.y - target.y, pocket.x - target.x);
  const diff = Math.abs(angle1 - angle2);
  assert(diff < 0.2);
});

test('avoids pocket with blocking ball at entrance', () => {
  const req = {
    game: 'AMERICAN_BILLIARDS',
    state: {
      balls: [
        { id: 0, x: 50, y: 100, vx: 0, vy: 0, pocketed: false },
        { id: 1, x: 220, y: 80, vx: 0, vy: 0, pocketed: false },
        { id: 2, x: 285, y: 15, vx: 0, vy: 0, pocketed: false }
      ],
      pockets: [ { x: 300, y: 0 } ],
      width: 300,
      height: 200,
      ballRadius: 10,
      friction: 0.01
    },
    timeBudgetMs: 50,
    rngSeed: 3
  };
  const decision = planShot(req);
  assert.equal(decision.rationale, 'safety');
  assert.equal(decision.quality, 0);
});

test('respects group assignment in eight-ball', () => {
  const req = {
    game: 'EIGHT_POOL_UK',
    state: {
      balls: [
        { id: 0, x: 100, y: 100, vx: 0, vy: 0, pocketed: false },
        { id: 1, x: 400, y: 250, vx: 0, vy: 0, pocketed: false },
        { id: 9, x: 600, y: 250, vx: 0, vy: 0, pocketed: false }
      ],
      pockets: [
        { x: 0, y: 0 }, { x: 500, y: 0 }, { x: 1000, y: 0 },
        { x: 0, y: 500 }, { x: 500, y: 500 }, { x: 1000, y: 500 }
      ],
      width: 1000,
      height: 500,
      ballRadius: 10,
      friction: 0.01,
      ballOn: 'blue'
    },
    timeBudgetMs: 50
  };
  const decision = planShot(req);
  assert.equal(decision.targetBallId, 9);
});

test('UNASSIGNED group defers to ballOn value', () => {
  const req = {
    game: 'EIGHT_POOL_UK',
    state: {
      balls: [
        { id: 0, x: 100, y: 100, vx: 0, vy: 0, pocketed: false },
        { id: 1, x: 400, y: 250, vx: 0, vy: 0, pocketed: false },
        { id: 9, x: 600, y: 250, vx: 0, vy: 0, pocketed: false }
      ],
      pockets: [
        { x: 0, y: 0 }, { x: 500, y: 0 }, { x: 1000, y: 0 },
        { x: 0, y: 500 }, { x: 500, y: 500 }, { x: 1000, y: 500 }
      ],
      width: 1000,
      height: 500,
      ballRadius: 10,
      friction: 0.01,
      myGroup: 'UNASSIGNED',
      ballOn: 'red'
    },
    timeBudgetMs: 50
  };
  const decision = planShot(req);
  assert.equal(decision.targetBallId, 1);
});

test('prefers target with smallest cut angle', () => {
  const req = {
    game: 'AMERICAN_BILLIARDS',
    state: {
      balls: [
        { id: 0, x: 100, y: 250, vx: 0, vy: 0, pocketed: false },
        { id: 1, x: 600, y: 250, vx: 0, vy: 0, pocketed: false },
        { id: 2, x: 600, y: 150, vx: 0, vy: 0, pocketed: false }
      ],
      pockets: [ { x: 1000, y: 250 } ],
      width: 1000,
      height: 500,
      ballRadius: 10,
      friction: 0.01
    },
    timeBudgetMs: 50
  };
  const decision = planShot(req);
  assert.equal(decision.targetBallId, 1);
});

test('cue ball remains within table bounds for varied power and spin', () => {
  const cue = { id: 0, x: 500, y: 250, vx: 0, vy: 0, pocketed: false };
  const target = { id: 1, x: 600, y: 250, vx: 0, vy: 0, pocketed: false };
  const pocket = { x: 1000, y: 250 };
  const table = { width: 1000, height: 500 };
  const powers = [0.5, 1];
  const spins = [
    { top: 0, side: -1, back: 0 },
    { top: 0, side: 0, back: 0 },
    { top: 0, side: 1, back: 0 },
    { top: 0.3, side: 0.5, back: -0.3 }
  ];

  for (const power of powers) {
    for (const spin of spins) {
      const next = estimateCueAfterShot(cue, target, pocket, power, spin, table);
      assert(next.x >= 0 && next.x <= table.width, `x out of bounds: ${next.x}`);
      assert(next.y >= 0 && next.y <= table.height, `y out of bounds: ${next.y}`);
    }
  }
});

test('straight shots stay on line regardless of power', () => {
  const cue = { id: 0, x: 500, y: 250, vx: 0, vy: 0, pocketed: false };
  const target = { id: 1, x: 600, y: 250, vx: 0, vy: 0, pocketed: false };
  const pocket = { x: 1000, y: 250 };
  const table = { width: 1000, height: 500 };
  const powers = [0.2, 0.5, 1];

  for (const power of powers) {
    const next = estimateCueAfterShot(cue, target, pocket, power, { top: 0, side: 0, back: 0 }, table);
    assert.equal(next.y, target.y);
  }
});

test('avoids unnecessary spin when natural position is good', () => {
  const req = {
    game: 'AMERICAN_BILLIARDS',
    state: {
      balls: [
        { id: 0, x: 200, y: 250, vx: 0, vy: 0, pocketed: false },
        { id: 1, x: 400, y: 250, vx: 0, vy: 0, pocketed: false },
        { id: 2, x: 700, y: 350, vx: 0, vy: 0, pocketed: false }
      ],
      pockets: [{ x: 1000, y: 250 }],
      width: 1000,
      height: 500,
      ballRadius: 10,
      friction: 0.01
    },
    timeBudgetMs: 50
  };
  const decision = planShot(req);
  assert.equal(decision.power, 0.5);
  assert.deepEqual(decision.spin, { top: 0, side: 0, back: 0 });
});
