import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleCueStrokeTimeline } from '../webapp/src/pages/Games/poolRoyaleCueStrokeTimeline.js';

test('cue stroke timeline keeps release phase active before hit is armed', () => {
  const pullbackDuration = 600;
  const strikeDuration = 1000;
  const holdDuration = 300;
  const recoverDuration = 200;

  const earlyRelease = sampleCueStrokeTimeline({
    elapsed: pullbackDuration + strikeDuration * 0.45,
    pullbackDuration,
    strikeDuration,
    holdDuration,
    recoverDuration
  });
  assert.equal(earlyRelease.phase, 'release');
  assert.equal(earlyRelease.hitArmed, false);
  assert.ok(earlyRelease.t > 0.4 && earlyRelease.t < 0.5);

  const nearImpact = sampleCueStrokeTimeline({
    elapsed: pullbackDuration + strikeDuration * 0.99,
    pullbackDuration,
    strikeDuration,
    holdDuration,
    recoverDuration
  });
  assert.equal(nearImpact.phase, 'release');
  assert.equal(nearImpact.hitArmed, true);
});

test('cue stroke timeline reaches recover and done phases in order', () => {
  const pullbackDuration = 400;
  const strikeDuration = 500;
  const holdDuration = 250;
  const recoverDuration = 300;

  const recover = sampleCueStrokeTimeline({
    elapsed: pullbackDuration + strikeDuration + holdDuration + recoverDuration * 0.4,
    pullbackDuration,
    strikeDuration,
    holdDuration,
    recoverDuration
  });
  assert.equal(recover.phase, 'recover');
  assert.equal(recover.done, false);

  const done = sampleCueStrokeTimeline({
    elapsed: pullbackDuration + strikeDuration + holdDuration + recoverDuration + 1,
    pullbackDuration,
    strikeDuration,
    holdDuration,
    recoverDuration
  });
  assert.equal(done.phase, 'done');
  assert.equal(done.done, true);
});
