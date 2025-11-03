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
      { id: 1, colour: 'blue', x: 200, y: 100 },
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
  assert.equal(plan.targetId, 2);
});

test('falls back to safety when pot not viable', () => {
  const state = {
    balls: [
      { id: 0, colour: 'cue', x: 100, y: 250 },
      { id: 1, colour: 'blue', x: 200, y: 250 },
      { id: 2, colour: 'red', x: 150, y: 250 }
    ],
    pockets: makePockets(),
    width: 1000,
    height: 500,
    ballRadius: 10,
    ballOn: 'blue',
    isOpenTable: false,
    shotsRemaining: 1
  };
  const plan = selectShot(state, {});
  assert.equal(plan.actionType, 'safety');
});

test('uses cushion escapes when direct path blocked', () => {
  const state = {
    balls: [
      { id: 0, colour: 'cue', x: 50, y: 50 },
      { id: 1, colour: 'blue', x: 250, y: 50 },
      { id: 2, colour: 'red', x: 150, y: 50 }
    ],
    pockets: [
      { x: 0, y: 0, name: 'TL' },
      { x: 300, y: 0, name: 'TR' },
      { x: 0, y: 100, name: 'BL' },
      { x: 300, y: 100, name: 'BR' }
    ],
    width: 300,
    height: 100,
    ballRadius: 5,
    ballOn: 'blue',
    isOpenTable: false,
    shotsRemaining: 1
  };
  const plan = selectShot(state, {});
  assert.equal(plan.actionType, 'safety');
  assert.ok(plan.aimPoint.x === 0 || plan.aimPoint.x === state.width || plan.aimPoint.y === 0 || plan.aimPoint.y === state.height);
});

test('prioritizes straight pots', () => {
  const state = {
    balls: [
      { id: 0, colour: 'cue', x: 100, y: 250 },
      { id: 1, colour: 'blue', x: 800, y: 250 }, // straight shot
      { id: 2, colour: 'blue', x: 200, y: 300 } // angled shot
    ],
    pockets: makePockets(),
    width: 1000,
    height: 500,
    ballRadius: 10,
    ballOn: 'blue',
    isOpenTable: false,
    shotsRemaining: 1
  };
  const plan = selectShot(state, {});
  assert.equal(plan.targetBall, 'blue');
  assert.equal(plan.aimPoint.x, 800);
  assert.equal(plan.aimPoint.y, 250);
});

test('avoids pockets on line to target', () => {
  const state = {
    balls: [
      { id: 0, colour: 'cue', x: 50, y: 100 },
      { id: 1, colour: 'blue', x: 250, y: 100 },
      { id: 2, colour: 'red', x: 150, y: 150 }
    ],
    pockets: [
      { x: 150, y: 100, name: 'M' },
      { x: 0, y: 0, name: 'TL' },
      { x: 300, y: 0, name: 'TR' },
      { x: 0, y: 200, name: 'BL' },
      { x: 300, y: 200, name: 'BR' }
    ],
    width: 300,
    height: 200,
    ballRadius: 10,
    ballOn: 'blue',
    isOpenTable: false,
    shotsRemaining: 1
  };
  const plan = selectShot(state, {});
  assert.equal(plan.actionType, 'safety');
});

test('avoids clustered targets', () => {
  const state = {
    balls: [
      { id: 0, colour: 'cue', x: 50, y: 50 },
      { id: 1, colour: 'blue', x: 200, y: 100 },
      { id: 3, colour: 'blue', x: 215, y: 105 },
      { id: 2, colour: 'red', x: 150, y: 150 }
    ],
    pockets: [
      { x: 0, y: 0, name: 'TL' },
      { x: 300, y: 0, name: 'TR' },
      { x: 0, y: 200, name: 'BL' },
      { x: 300, y: 200, name: 'BR' }
    ],
    width: 300,
    height: 200,
    ballRadius: 10,
    ballOn: 'blue',
    isOpenTable: false,
    shotsRemaining: 1
  };
  const plan = selectShot(state, {});
  assert.equal(plan.actionType, 'safety');
});

