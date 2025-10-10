export const DEG2RAD = Math.PI / 180;
const TWO_PI = Math.PI * 2;

export function degToRad(deg: number): number {
  return deg * DEG2RAD;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function shortestAngleDelta(target: number, current: number): number {
  let diff = target - current;
  while (diff > Math.PI) diff -= TWO_PI;
  while (diff < -Math.PI) diff += TWO_PI;
  return diff;
}

export function computeRFit(
  viewH: number,
  viewW: number,
  tableW: number,
  tableH: number,
  thetaRad: number,
): number {
  if (viewW <= 0 || viewH <= 0) return 0;
  const a = viewH / viewW;
  const vFov = degToRad(50);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * (1 / a));
  const hx = 0.5 * tableW * 1.05;
  const hz = 0.5 * tableH * 1.05;
  const r_w = hx / Math.tan(hFov / 2);
  const cosTheta = Math.cos(thetaRad);
  const denom = Math.tan(vFov / 2);
  const r_h = cosTheta > 1e-6 ? (hz / cosTheta) / denom : (hz / 1e-6) / denom;
  return Math.max(r_w, r_h) * 1.02;
}

export const ORBIT_DEFAULT_THETA = degToRad(35);
export const ORBIT_MIN_THETA = degToRad(30);
export const ORBIT_MAX_THETA = degToRad(55);
export const ORBIT_SMOOTHING = 0.18;
export const CAMERA_FOV_DEG = 50;
export const CAMERA_NEAR = 0.05;
export const CAMERA_FAR = 1000;
