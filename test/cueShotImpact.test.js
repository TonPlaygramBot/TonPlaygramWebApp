import {
  applyShotImpact,
  createShotImpactFallback,
  createShotImpactPayload,
  resolveShotImpactTime
} from '../webapp/src/pages/Games/cueShotImpact.js';

describe('cue shot impact orchestration', () => {
  test('applies shot exactly once when impact triggers', () => {
    let launchCount = 0;
    const payload = createShotImpactPayload(() => {
      launchCount += 1;
    });

    expect(applyShotImpact(payload)).toBe(true);
    expect(applyShotImpact(payload)).toBe(false);
    expect(launchCount).toBe(1);
  });

  test('impact fallback timing uses start + 85% strike duration with floor', () => {
    expect(resolveShotImpactTime(1000, 200)).toBe(1170);
    expect(resolveShotImpactTime(1000, 10)).toBe(1040);
    expect(resolveShotImpactTime(Number.NaN, 200)).toBeNull();
  });

  test('fallback executes queued shot and remains idempotent', () => {
    let launchCount = 0;
    const payload = createShotImpactPayload(() => {
      launchCount += 1;
    });
    const fallback = createShotImpactFallback(payload, 1337);

    expect(fallback).toBeTruthy();
    expect(fallback.time).toBe(1337);

    fallback.apply();
    fallback.apply();

    expect(launchCount).toBe(1);
    expect(payload.applied).toBe(true);
  });
});
