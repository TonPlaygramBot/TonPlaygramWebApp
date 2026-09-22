import assert from 'node:assert/strict';
import { test } from 'node:test';
import { poolCalledBallOptions, positionPocketCallButton, restorePendingBilliardsLayout } from '../webapp/src/pages/Games/shared/billiardsPresentationState.js';

test('a saved frame survives setup and restores only after live balls exist', () => {
  const pending = { current: [{ id: 'cue', active: true, pos: { x: 12, y: -5 } }, { id: 'ball_1', active: false, pos: { x: 3, y: 4 } }] };
  const live = [];
  const apply = snapshot => live.forEach(ball => Object.assign(ball, snapshot.find(saved => saved.id === ball.id)));
  assert.equal(restorePendingBilliardsLayout(pending, live, apply), false);
  assert.equal(pending.current.length, 2);
  live.push({ id: 'cue' }, { id: 'ball_1' });
  assert.equal(restorePendingBilliardsLayout(pending, live, apply), true);
  assert.deepEqual(live[0].pos, { x: 12, y: -5 });
  assert.equal(live[1].active, false);
  assert.equal(pending.current, null);
  assert.equal(restorePendingBilliardsLayout(pending, live, apply), false);
});

test('combination calls offer every numbered ball remaining in Pool rules', () => {
  assert.deepEqual(poolCalledBallOptions({ balls: [], meta: { state: { ballsOnTable: [15, 8, 1, 15, 0, 99] } } }),
    [{ id: 'ball_1' }, { id: 'ball_8' }, { id: 'ball_15' }]);
  assert.deepEqual(poolCalledBallOptions({}), []);
});

test('projected pocket controls match visible portrait screen directions', () => {
  const button = { style: {} };
  const rect = { left: 10, top: 20, width: 320, height: 640 };
  positionPocketCallButton(button, { x: -0.5, y: 0.5, z: 0 }, rect);
  assert.equal(button.style.transform, 'translate(90px, 180px) translate(-50%, -50%)');
  assert.equal(button.style.pointerEvents, 'auto');
  positionPocketCallButton(button, { x: 0, y: 0, z: 2 }, rect);
  assert.equal(button.style.opacity, '0');
  assert.equal(button.style.pointerEvents, 'none');
});
