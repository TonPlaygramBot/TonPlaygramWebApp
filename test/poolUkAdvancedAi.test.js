import test from 'node:test';
import assert from 'node:assert/strict';
import { selectShot } from '../lib/poolUkAdvancedAi.js';

function makePockets() {
  return [
    { x: 0, y: 0, name: 'TL' },
    { x: 1000, y: 0, name: 'TR' },
    { x: 0, y: 250, name: 'ML' },
    { x: 1000, y: 250, name: 'MR' },
    { x: 0, y: 500, name: 'BL' },
    { x: 1000, y: 500, name: 'BR' }
  ];
}

test('open table selects higher EV colour', () => {
  const state = {
    balls: [
      { id: 0, colour: 'cue', x: 100, y: 100 },
      { id: 1, colour: 'yellow', x: 200, y: 100 },
      { id: 2, colour: 'red', x: 800, y: 400 }
    ],
    pockets: makePockets(),
    width: 1000,
    height: 500,
    ballRadius: 10,
    ballOn: null,
    isOpenTable: true,
    shotsRemaining: 1
  };
  const plan = selectShot(state, {});
  assert.equal(plan.targetBall, 'red');
  assert.equal(plan.actionType, 'pot');
});

test('falls back to safety when pot not viable', () => {
  const state = {
    balls: [
      { id: 0, colour: 'cue', x: 100, y: 250 },
      { id: 1, colour: 'yellow', x: 200, y: 250 },
      { id: 2, colour: 'red', x: 150, y: 250 }
    ],
    pockets: makePockets(),
    width: 1000,
    height: 500,
    ballRadius: 10,
    ballOn: 'yellow',
    isOpenTable: false,
    shotsRemaining: 1
  };
  const plan = selectShot(state, {});
  assert.equal(plan.actionType, 'safety');
});

test('uses free ball when available', () => {
  const state = {
    balls: [
      { id: 0, colour: 'cue', x: 50, y: 50 },
      { id: 1, colour: 'yellow', x: 400, y: 250 },
      { id: 2, colour: 'red', x: 300, y: 250 }
    ],
    pockets: makePockets(),
    width: 1000,
    height: 500,
    ballRadius: 10,
    ballOn: 'yellow',
    isOpenTable: false,
    freeBallAvailable: true,
    shotsRemaining: 1
  };
  const plan = selectShot(state, {});
  assert.equal(plan.actionType, 'freeBallPot');
});

