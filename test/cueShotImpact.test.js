import {
  applyShotImpact,
  createShotImpactFallback,
  createShotImpactPayload,
  shouldResolveShot
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

  test('resolves only after the shot impact was applied', () => {
    expect(shouldResolveShot({ hasAnyMotion: false, shotApplied: false })).toBe(false);
    expect(shouldResolveShot({ hasAnyMotion: true, shotApplied: true })).toBe(false);
    expect(shouldResolveShot({ hasAnyMotion: false, shotApplied: true })).toBe(true);
  });
});
