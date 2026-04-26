export const BILARDO_MIN_RELEASE_POWER = 0.02;
export const BILARDO_STRIKE_TIME_MS = 120;
export const BILARDO_STRIKE_CONTACT_THRESHOLD = 0.88;

export function clampBilardoPower(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) return fallback;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

export function bilardoCueSpeed(power: number): number {
  const p = clampBilardoPower(power, 0);
  return 1.9 + 8.2 * Math.pow(p, 1.08);
}
