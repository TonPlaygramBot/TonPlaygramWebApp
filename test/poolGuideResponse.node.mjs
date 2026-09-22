import assert from 'node:assert/strict';
import { test } from 'node:test';
import { poolCueGuideResponse } from '../webapp/src/pages/Games/poolRoyaleGuideResponse.js';

test('a full-ball centre strike has no fictitious outgoing cue-ball line', () => {
  const result = poolCueGuideResponse({ incoming: { x: 1, y: 0 }, tangent: null, transfer: 0, ballImpact: true });
  assert.equal(result.strength, 0);
});

test('cut stun, draw, follow and cushion reflection retain distinct directions', () => {
  const input = { incoming: { x: 1, y: 0 }, tangent: { x: 0.5, y: -0.5 }, transfer: Math.SQRT1_2, ballImpact: true };
  const cut = poolCueGuideResponse(input);
  assert.ok(Math.abs(cut.direction.x + cut.direction.y) < 1e-10);
  const draw = poolCueGuideResponse({ ...input, tangent: null, transfer: 0, spinY: -1 });
  const follow = poolCueGuideResponse({ ...input, tangent: null, transfer: 0, spinY: 1 });
  assert.equal(draw.direction.x, -1);
  assert.equal(follow.direction.x, 1);
  const rail = poolCueGuideResponse({ incoming: { x: 1, y: 0 }, tangent: { x: -1, y: 0 } });
  assert.equal(rail.direction.x, -1);
});
