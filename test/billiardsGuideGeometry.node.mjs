import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clipGuideTravel } from '../webapp/src/pages/Games/shared/billiardsGuideGeometry.js';

const input = { origin: { x: 0, y: 0 }, direction: { x: 1, y: 0 },
  radius: 1, maxDistance: 12, halfWidth: 20, halfLength: 40 };

test('a guide stops at the requested preview length or first cushion', () => {
  assert.equal(clipGuideTravel(input), 12);
  assert.equal(clipGuideTravel({ ...input, maxDistance: 100 }), 20);
  assert.equal(clipGuideTravel({ ...input, direction: { x: 0, y: -4 }, maxDistance: 100 }), 40);
});

test('a guide stops at the first ball centre contact instead of running through a cluster', () => {
  const balls = [{ id: 'far', pos: { x: 10, y: 0 } }, { id: 'near', pos: { x: 5, y: 0 } }];
  assert.equal(clipGuideTravel({ ...input, balls }), 3);
  assert.equal(clipGuideTravel({ ...input, balls, ignoreIds: ['near'] }), 8);
  balls[0].active = false;
  assert.equal(clipGuideTravel({ ...input, balls, ignoreIds: ['near'] }), 12);
});

test('zero-distance contacts, cuts and outgoing cushion reflections remain finite', () => {
  assert.equal(clipGuideTravel({ ...input, balls: [{ id: 1, pos: { x: 2, y: 0 } }] }), 0);
  assert.equal(clipGuideTravel({ ...input, balls: [{ id: 1, pos: { x: -2, y: 0 } }] }), 12);
  const cut = clipGuideTravel({ ...input, balls: [{ id: 1, pos: { x: 6, y: 1 } }] });
  assert.ok(Math.abs(cut - (6 - Math.sqrt(3))) < 1e-9);
  assert.equal(clipGuideTravel({ ...input, origin: { x: 20, y: 0 }, direction: { x: -1, y: 0 } }), 12);
  assert.equal(clipGuideTravel({ ...input, origin: { x: 20, y: 0 } }), 0);
  assert.equal(clipGuideTravel({ ...input, direction: { x: 0, y: 0 } }), 0);
});
