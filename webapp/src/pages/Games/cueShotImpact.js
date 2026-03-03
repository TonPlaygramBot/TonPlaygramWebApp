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

export function resolveShotImpactTime(startTimeMs, strikeDurationMs) {
  if (!Number.isFinite(startTimeMs)) return null;
  const strikeDuration = Number.isFinite(strikeDurationMs) ? strikeDurationMs : 0;
  return startTimeMs + Math.max(40, strikeDuration * 0.85);
}

export function createShotImpactFallback(payload, impactAtMs) {
  if (!Number.isFinite(impactAtMs)) return null;
  return {
    time: impactAtMs,
    apply: () => applyShotImpact(payload)
  };
}

