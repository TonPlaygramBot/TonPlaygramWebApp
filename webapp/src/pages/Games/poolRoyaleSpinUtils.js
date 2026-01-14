const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const SPIN_INPUT_DEAD_ZONE = 0.015;
export const SPIN_RESPONSE_EXPONENT = 1.75;

export const clampToUnitCircle = (x, y) => {
  const length = Math.hypot(x, y);
  if (!Number.isFinite(length) || length <= 1) {
    return { x, y };
  }
  const scale = length > 1e-6 ? 1 / length : 0;
  return { x: x * scale, y: y * scale };
};

export const normalizeSpinInput = (spin) => {
  const x = spin?.x ?? 0;
  const y = spin?.y ?? 0;
  const magnitude = Math.hypot(x, y);
  if (!Number.isFinite(magnitude) || magnitude < SPIN_INPUT_DEAD_ZONE) {
    return { x: 0, y: 0 };
  }
  return clampToUnitCircle(x, y);
};

export const applySpinResponseCurve = (spin) => {
  const x = spin?.x ?? 0;
  const y = spin?.y ?? 0;
  const magnitude = Math.hypot(x, y);
  if (!Number.isFinite(magnitude) || magnitude < SPIN_INPUT_DEAD_ZONE) {
    return { x: 0, y: 0 };
  }
  const clamped = clampToUnitCircle(x, y);
  const clampedMag = Math.hypot(clamped.x, clamped.y);
  const curvedMag = Math.pow(clampedMag, SPIN_RESPONSE_EXPONENT);
  const scale = clampedMag > 1e-6 ? curvedMag / clampedMag : 0;
  return { x: clamped.x * scale, y: clamped.y * scale };
};

export const mapSpinForPhysics = (spin, options = {}) => {
  const adjusted = {
    x: clamp(spin?.x ?? 0, -1, 1),
    y: clamp(spin?.y ?? 0, -1, 1)
  };
  const curved = applySpinResponseCurve(adjusted);
  const aimDir = options?.aimDir;
  const axes = options?.axes;
  if (!aimDir || !axes?.axis || !axes?.perp) {
    return {
      x: curved.x,
      y: curved.y
    };
  }
  const aimX = aimDir.x ?? 0;
  const aimY = aimDir.y ?? 0;
  const aimLen = Math.hypot(aimX, aimY);
  if (aimLen < 1e-6) {
    return {
      x: curved.x,
      y: curved.y
    };
  }
  const normAimX = aimX / aimLen;
  const normAimY = aimY / aimLen;
  const lateralX = -normAimY;
  const lateralY = normAimX;
  const worldX =
    (axes.perp.x ?? 0) * curved.x + (axes.axis.x ?? 0) * curved.y;
  const worldY =
    (axes.perp.y ?? 0) * curved.x + (axes.axis.y ?? 0) * curved.y;
  return {
    x: worldX * lateralX + worldY * lateralY,
    y: worldX * normAimX + worldY * normAimY
  };
};
