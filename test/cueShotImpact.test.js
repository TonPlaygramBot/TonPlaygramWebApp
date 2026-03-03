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

  test('does not resolve shot while cue impact is still pending', () => {
    expect(shouldResolveShot({ anyBallMoving: false, impactPending: true })).toBe(false);
    expect(shouldResolveShot({ anyBallMoving: true, impactPending: true })).toBe(false);
  });

  test('resolves only after impact is applied and all balls are stopped', () => {
    expect(shouldResolveShot({ anyBallMoving: true, impactPending: false })).toBe(false);
    expect(shouldResolveShot({ anyBallMoving: false, impactPending: false })).toBe(true);
  });
});
