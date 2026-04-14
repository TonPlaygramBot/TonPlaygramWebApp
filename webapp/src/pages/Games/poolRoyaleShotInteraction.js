export const ShotState = Object.freeze({
  IDLE: 'idle',
  DRAGGING: 'dragging',
  STRIKING: 'striking'
});

export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const computePullDistance = ({
  power = 0,
  pullRange = 0,
  maxPull = Number.POSITIVE_INFINITY,
  minVisualPull = 0
} = {}) => {
  const clampedPower = clamp(power ?? 0, 0, 1);
  const easedPull = Math.max(0, pullRange) * easeOut(clampedPower);
  const upperBound = Number.isFinite(maxPull) ? Math.max(maxPull, 0) : easedPull;
  return clamp(easedPull, 0, Math.max(upperBound, minVisualPull));
};

export const shouldTriggerImpact = ({
  cuePosition,
  impactPosition,
  elapsed = 0,
  strikeDuration = 0,
  contactGap = 0
} = {}) => {
  if (!cuePosition || !impactPosition) return false;
  if (elapsed >= strikeDuration) return true;
  const distance = (() => {
    if (typeof cuePosition.distanceTo === 'function') {
      return cuePosition.distanceTo(impactPosition);
    }
    const dx = (cuePosition.x ?? 0) - (impactPosition.x ?? 0);
    const dy = (cuePosition.y ?? 0) - (impactPosition.y ?? 0);
    const dz = (cuePosition.z ?? 0) - (impactPosition.z ?? 0);
    return Math.hypot(dx, dy, dz);
  })();
  return distance <= Math.max(0, contactGap);
};
