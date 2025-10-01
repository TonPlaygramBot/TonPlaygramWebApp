import assert from 'node:assert';
import * as THREE from 'three';
import { computeAngleMask, chooseNearestAllowed } from '../aim/angleMask.js';
import { verifyCapsuleClear } from '../aim/capsuleVerify.js';

const { Vector3 } = THREE;
const TWO_PI = Math.PI * 2;

function makeParams(overrides = {}) {
  return {
    C: new Vector3(0, 0, 0),
    balls: [],
    rBall: 0.028,
    rShaft: 0.01,
    epsilon: 0.003,
    L: 0.6,
    table: { minX: -1, maxX: 1, minZ: -1, maxZ: 1 },
    ...overrides
  };
}

describe('aim angle mask', () => {
  test('no obstacles yields full freedom', () => {
    const mask = computeAngleMask(makeParams());
    assert.strictEqual(mask.blocked.length, 0);
    assert.strictEqual(mask.allowed.length, 1);
    assert.ok(Math.abs(mask.allowed[0].start) < 1e-9);
    assert.ok(Math.abs(mask.allowed[0].end - TWO_PI) < 1e-9);
  });

  test('single ball behind cue merges around zero', () => {
    const params = makeParams({
      balls: [{ pos: new Vector3(-0.2, 0, 0) }],
      L: 0.5
    });
    const mask = computeAngleMask(params);
    const totalBlocked = mask.blocked.reduce((sum, interval) => sum + (interval.end - interval.start), 0);
    const separation = 0.2;
    const R = params.rBall + params.rShaft + params.epsilon;
    const expectedDelta = Math.asin(Math.min(1, R / separation));
    assert.ok(Math.abs(totalBlocked - expectedDelta * 2) < 1e-3);
  });

  test('short L trims blocked window', () => {
    const params = makeParams({
      balls: [{ pos: new Vector3(-0.2, 0, 0) }],
      L: 0.16
    });
    const mask = computeAngleMask(params);
    const centreAllowed = chooseNearestAllowed(0.35, mask.allowed);
    assert.strictEqual(centreAllowed.distance, 0);
    const zeroChoice = chooseNearestAllowed(0, mask.allowed);
    assert.ok(zeroChoice.distance > 0.05);
    assert.ok(zeroChoice.hitInterval);
  });

  test('chooseNearestAllowed picks closest edge', () => {
    const allowed = [
      { start: 1, end: 1.5 },
      { start: 4, end: 5 }
    ];
    const result = chooseNearestAllowed(2, allowed);
    assert.ok(Math.abs(result.theta - 1.5) < 1e-9);
    assert.ok(Math.abs(result.distance - 0.5) < 1e-9);
  });

  test('capsule verification confirms clear aim', () => {
    const params = makeParams({
      balls: [{ pos: new Vector3(-0.2, 0, 0) }],
      L: 0.6
    });
    const mask = computeAngleMask(params);
    const allowedCentre = chooseNearestAllowed(Math.PI / 2, mask.allowed);
    const verification = verifyCapsuleClear(allowedCentre.theta, params);
    assert.ok(verification.ok);
    assert.ok(verification.minMargin > -1e-6);
  });

  test('capsule verification rejects blocked angle', () => {
    const params = makeParams({
      balls: [{ pos: new Vector3(-0.2, 0, 0) }],
      L: 0.6
    });
    const mask = computeAngleMask(params);
    const blockedInterval = mask.blocked[0];
    const midTheta = (blockedInterval.start + blockedInterval.end) / 2;
    const verification = verifyCapsuleClear(midTheta, params);
    assert.ok(!verification.ok);
    assert.ok(verification.offenders.length >= 1);
  });

  test('no allowed angles when cue length vanishes near obstacle', () => {
    const params = makeParams({
      balls: [{ pos: new Vector3(-0.01, 0, 0) }],
      L: 0
    });
    const mask = computeAngleMask(params);
    assert.strictEqual(mask.allowed.length, 0);
    const pick = chooseNearestAllowed(0, mask.allowed);
    assert.strictEqual(pick.hitInterval, null);
    assert.ok(!Number.isFinite(pick.distance));
  });
});
