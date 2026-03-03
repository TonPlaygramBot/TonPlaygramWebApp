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


export function shouldResolveShot({ anyBallMoving, impactPending }) {
  if (impactPending) return false;
  return !anyBallMoving;
}
