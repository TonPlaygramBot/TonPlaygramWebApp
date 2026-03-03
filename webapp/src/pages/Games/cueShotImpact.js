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


export function shouldResolveShot({ hasAnyMotion, shotApplied }) {
  return Boolean(shotApplied) && !Boolean(hasAnyMotion);
}

export function computeImpactFallbackTime({
  startTime,
  pullbackDuration = 0,
  strikeDuration = 0,
  impactThreshold = 0.92,
  minDelayMs = 40
}) {
  if (!Number.isFinite(startTime)) return null;
  const safePullback = Number.isFinite(pullbackDuration) ? Math.max(0, pullbackDuration) : 0;
  const safeStrike = Number.isFinite(strikeDuration) ? Math.max(0, strikeDuration) : 0;
  const safeThreshold = Number.isFinite(impactThreshold)
    ? Math.min(Math.max(impactThreshold, 0), 1)
    : 0.92;
  const safeMinDelay = Number.isFinite(minDelayMs) ? Math.max(0, minDelayMs) : 40;
  return startTime + Math.max(safeMinDelay, safePullback + safeStrike * safeThreshold);
}
