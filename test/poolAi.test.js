import test from 'node:test';
import assert from 'node:assert/strict';
import { planShot } from '../lib/poolAi.js';

test('planShot returns a shot decision', () => {
  const req = {
    game: 'AMERICAN_BILLIARDS',
    state: {
      balls: [
        { id: 0, x: 300, y: 250, vx: 0, vy: 0, pocketed: false },
        { id: 1, x: 500, y: 250, vx: 0, vy: 0, pocketed: false }
      ],
      pockets: [
        { x: 0, y: 0 }, { x: 500, y: 0 }, { x: 1000, y: 0 },
        { x: 0, y: 500 }, { x: 500, y: 500 }, { x: 1000, y: 500 }
      ],
      width: 1000,
      height: 500,
      ballRadius: 10,
      friction: 0.01,
      myGroup: 'SOLIDS'
    },
    timeBudgetMs: 50,
    rngSeed: 1
  };
  const decision = planShot(req);
  assert.equal(decision.targetBallId, 1);
  assert(decision.targetPocket);
  assert(decision.quality >= 0 && decision.quality <= 1);
  assert(decision.rationale.length > 0);
});

test('targets 8 ball after clearing group', () => {
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
      friction: 0.01,
      myGroup: 'SOLIDS'
    },
    timeBudgetMs: 50,
    rngSeed: 1
  };
  const decision = planShot(req);
  assert.equal(decision.targetBallId, 8);
});

test('aims at nearest ball when no pockets available', () => {
  const req = {
    game: 'AMERICAN_BILLIARDS',
    state: {
      balls: [
        { id: 0, x: 100, y: 100, vx: 0, vy: 0, pocketed: false },
        { id: 1, x: 200, y: 200, vx: 0, vy: 0, pocketed: false }
      ],
      pockets: [],
      width: 1000,
      height: 500,
      ballRadius: 10,
      friction: 0.01,
      myGroup: 'SOLIDS'
    },
    timeBudgetMs: 50,
    rngSeed: 2
  };
  const decision = planShot(req);
  assert.equal(decision.targetBallId, 1);
  assert(decision.angleRad > 0.7 && decision.angleRad < 0.9); // roughly 45 degrees
});
