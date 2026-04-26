export function createShotImpactPayload(launchShot) {
  return {
    applied: false,
    launchShot
  };
}

export function applyShotImpact(payload) {
  if (!payload || payload.applied) return false;
  payload.applied = true;
  payload.launchShot?.();
  return true;
}

export function createShotImpactFallback(payload, impactAtMs) {
  if (!Number.isFinite(impactAtMs)) return null;
  return {
    time: impactAtMs,
    apply: () => applyShotImpact(payload)
  };
}

export function computeCueDriveBoost({
  pullDistance = 0,
  contactAdvance = 0,
  strikeDurationMs = 120,
  clampedPower = 0
} = {}) {
  const safePower = Number.isFinite(clampedPower) ? Math.max(0, Math.min(1, clampedPower)) : 0;
  const strokeDistance = Math.max(
    0,
    (Number.isFinite(pullDistance) ? pullDistance : 0) +
      (Number.isFinite(contactAdvance) ? contactAdvance : 0)
  );
  const strokeSeconds = Math.max(0.05, (Number.isFinite(strikeDurationMs) ? strikeDurationMs : 120) / 1000);
  const strokeSpeed = strokeDistance / strokeSeconds;
  const driveFromSpeed = Math.max(0, Math.min(1, strokeSpeed / 3.25));
  const driveFromPower = Math.max(0, Math.min(1, safePower));
  return Math.max(0.85, Math.min(1.35, 0.9 + driveFromSpeed * 0.34 + driveFromPower * 0.11));
}


export function shouldResolveShot({ hasAnyMotion, shotApplied }) {
  return Boolean(shotApplied) && !Boolean(hasAnyMotion);
}

export function computeBilardoShotSpeed(power = 0) {
  const clamped = Number.isFinite(power) ? Math.max(0, Math.min(1, power)) : 0;
  return 1.9 + 8.2 * Math.pow(clamped, 1.08);
}
