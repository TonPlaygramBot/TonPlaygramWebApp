import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { findBilliardsAiEscape } from '../webapp/src/pages/Games/shared/billiardsAiEscape.js';

const { Vector2 } = createRequire(new URL('../webapp/package.json', import.meta.url))('three');

const ball = (id, x, y) => ({ id, active: true, pos: new Vector2(x, y) });
// Analytic ray tracer with the same live calcTarget return contract.
function trace(cue, dir, balls) {
  let tHit = Infinity;
  let targetBall = null;
  let railNormal = null;
  for (const object of balls) {
    const rel = object.pos.clone().sub(cue.pos);
    const along = rel.dot(dir);
    const perpSq = rel.lengthSq() - along * along;
    if (along <= 0 || perpSq > 4) continue;
    const t = Math.max(0, along - Math.sqrt(4 - perpSq));
    if (t < tHit) { tHit = t; targetBall = object; }
  }
  for (const axis of ['x', 'y']) {
    if (Math.abs(dir[axis]) < 1e-8) continue;
    const sign = Math.sign(dir[axis]);
    const t = (sign * 20 - cue.pos[axis]) / dir[axis];
    if (t >= 0 && t < tHit) {
      tHit = t;
      targetBall = null;
      railNormal = new Vector2(axis === 'x' ? -sign : 0, axis === 'y' ? -sign : 0);
    }
  }
  return { targetBall, railNormal, tHit, impact: cue.pos.clone().addScaledVector(dir, tHit) };
}

const options = (cue, balls, extra = {}) => ({ cue, balls, legal: object => object.id === 'legal',
  trace, radius: 1, limitX: 20, limitY: 20, powerFromDistance: distance => Math.min(0.9, distance / 100 + 0.2), ...extra });

test('uses legal direct first contact and preserves engine power', () => {
  const cue = ball('cue', -10, 0);
  const legal = ball('legal', 10, 0);
  const plan = findBilliardsAiEscape(options(cue, [cue, legal]));
  assert.equal(plan.targetBall, legal);
  assert.equal(plan.viaCushion, false);
  assert.equal(plan.distance, 18);
  assert.equal(plan.power, 0.56);
  assert.deepEqual(plan.aimDir.toArray(), [1, 0]);
});

test('blocked direct contact takes a verified reflected contact with the legal ball', () => {
  const cue = ball('cue', -10, 0);
  const legal = ball('legal', 10, 0);
  const wrong = ball('wrong', 0, 0);
  const plan = findBilliardsAiEscape(options(cue, [cue, wrong, legal]));
  assert.ok(plan?.viaCushion);
  assert.equal(plan.targetBall, legal);
  const first = trace(cue, plan.aimDir, [wrong, legal]);
  assert.equal(first.targetBall, null);
  const reflection = plan.aimDir.clone().addScaledVector(first.railNormal, -2 * plan.aimDir.dot(first.railNormal));
  const second = trace({ ...cue, pos: first.impact.clone().addScaledVector(first.railNormal, 0.01) }, reflection, [wrong, legal]);
  assert.equal(second.targetBall, legal);
});

test('rejects a wrong first ball on either direct or reflected leg', () => {
  const cue = ball('cue', -10, 0);
  const legal = ball('legal', 10, 0);
  const wrong = ball('wrong', 0, 0);
  const blockedTrace = (start, direction) => ({ targetBall: wrong, tHit: 4,
    impact: start.pos.clone().addScaledVector(direction, 4) });
  assert.equal(findBilliardsAiEscape(options(cue, [cue, wrong, legal], { trace: blockedTrace })), null);
  let calls = 0;
  const secondLegWrong = (start, direction) => {
    calls++;
    if (start === cue) return { targetBall: null, railNormal: direction.clone().negate(),
      tHit: 5, impact: start.pos.clone().addScaledVector(direction, 5) };
    return blockedTrace(start, direction);
  };
  assert.equal(findBilliardsAiEscape(options(cue, [cue, wrong, legal], { trace: secondLegWrong })), null);
  assert.ok(calls >= 2);
});

test('a pocket opening without a cushion cannot produce a synthetic rebound', () => {
  const cue = ball('cue', 0, 0);
  const legal = ball('legal', 5, 5);
  assert.equal(findBilliardsAiEscape(options(cue, [cue, legal], {
    trace: () => ({ targetBall: null, railNormal: null, tHit: 12, impact: new Vector2(20, 20) })
  })), null);
});

test('empty legal sets, inactive cue and invalid power never invent a shot', () => {
  const cue = ball('cue', -10, 0);
  const legal = ball('legal', 10, 0);
  assert.equal(findBilliardsAiEscape(options(cue, [cue, legal], { legal: () => false })), null);
  assert.equal(findBilliardsAiEscape(options({ ...cue, active: false }, [cue, legal])), null);
  assert.equal(findBilliardsAiEscape(options(cue, [cue, legal], { powerFromDistance: () => NaN })), null);
});
