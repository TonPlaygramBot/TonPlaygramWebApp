import {
  applyShotImpact,
  computeCueDriveBoost,
  computeSnookerRoyalCueStrike2D,
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

  test('boosts impact speed more for longer and stronger cue drives', () => {
    const soft = computeCueDriveBoost({
      pullDistance: 0.04,
      contactAdvance: 0.01,
      strikeDurationMs: 150,
      clampedPower: 0.2
    });
    const strong = computeCueDriveBoost({
      pullDistance: 0.18,
      contactAdvance: 0.05,
      strikeDurationMs: 90,
      clampedPower: 1
    });

    expect(soft).toBeGreaterThanOrEqual(0.85);
    expect(strong).toBeLessThanOrEqual(1.35);
    expect(strong).toBeGreaterThan(soft);
  });

  test('computes Pool Royale launch from the Snooker Royal cue strike formula', () => {
    const strike = computeSnookerRoyalCueStrike2D({
      power: 0.8,
      aimDir: { x: 0, y: 1 },
      spin: { x: 0.4, y: -0.5 },
      ballRadius: 0.026,
      shotFullSpeed: 1.66,
      worldScale: 0.304,
      shotPowerBoost: 0.455
    });

    const powerSpinScale = 0.55 + 0.8 * 0.45;
    const spinX = 0.4 * 0.82 * 0.25 * 1.8 * powerSpinScale;
    const spinY = -0.5 * 0.82 * 0.25 * powerSpinScale * 3.12;
    const speed = 1.66 * (0.25 + 0.75 * 0.8);
    const sideVelocity = spinX * 0.8 * 1.05 * 0.304 * 0.455;

    expect(strike.velocity.x).toBeCloseTo(sideVelocity, 12);
    expect(strike.velocity.y).toBeCloseTo(speed, 12);
    expect(strike.spin.x).toBeCloseTo(spinX, 12);
    expect(strike.spin.y).toBeCloseTo(spinY, 12);
    expect(strike.omega.x).toBeCloseTo(speed / 0.026 - spinY * 0.8 * 18, 12);
    expect(strike.omega.z).toBeCloseTo(-sideVelocity / 0.026 - spinX * 0.8 * 18, 12);
    expect(strike.launchDir.y).toBeGreaterThan(0.999);
  });
});
