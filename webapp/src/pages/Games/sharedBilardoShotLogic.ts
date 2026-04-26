export const BILARDO_MIN_RELEASE_POWER = 0.02;
export const BILARDO_STRIKE_CONTACT_THRESHOLD = 0.88;

export function clampShotPower(power: number): number {
  if (!Number.isFinite(power)) return 0;
  if (power < 0) return 0;
  if (power > 1) return 1;
  return power;
}

export function computeBilardoCueSpeed(power: number): number {
  const p = clampShotPower(power);
  return 1.9 + 8.2 * Math.pow(p, 1.08);
}
