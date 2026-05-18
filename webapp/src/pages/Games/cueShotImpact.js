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

const clamp01 = (value) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
};

const readAxis = (value, fallback = 0) => (Number.isFinite(value) ? value : fallback);

/**
 * Mirrors SnookerRoyalProvided.jsx applyCueShot for Pool Royale's X/Y table plane.
 * It treats the cue stick as a physical strike through the cue ball: linear
 * velocity is launched down the cue direction, side spin nudges the cue ball
 * from the off-centre contact point, and angular velocity starts at natural roll
 * with top/back/side spin added exactly like Snooker Royal.
 */
export function computeSnookerRoyalCueStrike2D({
  power = 0,
  aimDir = { x: 0, y: 1 },
  spin = { x: 0, y: 0 },
  ballRadius = 1,
  shotFullSpeed = 1,
  shotMinFactor = 0.25,
  shotPowerRange = 0.75,
  shotSpinScale = 0.25,
  spinGlobalScale = 0.82,
  sideSpinMultiplier = 1.8,
  backspinMultiplier = 3.12,
  topspinMultiplier = 1.944,
  shotPowerBoost = 0.455,
  worldScale = 1
} = {}) {
  const p = clamp01(power);
  const dirX = readAxis(aimDir?.x, 0);
  const dirY = readAxis(aimDir?.y, 1);
  const dirLen = Math.hypot(dirX, dirY);
  const dir = dirLen > 1e-8
    ? { x: dirX / dirLen, y: dirY / dirLen }
    : { x: 0, y: 1 };
  const side = { x: dir.y, y: -dir.x };
  const spinMapped = {
    x: readAxis(spin?.x, 0) * spinGlobalScale,
    y: readAxis(spin?.y, 0) * spinGlobalScale
  };
  const powerSpinScale = 0.55 + p * 0.45;
  const rawTopSpin = spinMapped.y * shotSpinScale * powerSpinScale;
  const resolvedSpin = {
    x: spinMapped.x * shotSpinScale * sideSpinMultiplier * powerSpinScale,
    y: rawTopSpin < 0 ? rawTopSpin * backspinMultiplier : rawTopSpin * topspinMultiplier
  };
  const speed = shotFullSpeed * (shotMinFactor + shotPowerRange * p);
  const sideVelocity = resolvedSpin.x * p * 1.05 * worldScale * shotPowerBoost;
  const velocity = {
    x: dir.x * speed + side.x * sideVelocity,
    y: dir.y * speed + side.y * sideVelocity
  };
  const launchSpeed = Math.hypot(velocity.x, velocity.y);
  const safeRadius = Math.max(1e-6, Number.isFinite(ballRadius) ? ballRadius : 1);
  const omega = { x: 0, y: 0, z: 0 };
  if (launchSpeed > 1e-6) {
    omega.x += velocity.y / safeRadius;
    omega.z += -velocity.x / safeRadius;
    omega.x += -resolvedSpin.y * p * 18;
    omega.z += -resolvedSpin.x * p * 18;
  }
  const launchDir = launchSpeed > 1e-8
    ? { x: velocity.x / launchSpeed, y: velocity.y / launchSpeed }
    : null;
  return {
    velocity,
    spin: resolvedSpin,
    omega,
    launchDir
  };
}

export function shouldResolveShot({ hasAnyMotion, shotApplied }) {
  return Boolean(shotApplied) && !Boolean(hasAnyMotion);
}
