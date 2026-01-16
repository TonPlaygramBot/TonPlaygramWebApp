const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const SPIN_INPUT_DEAD_ZONE = 0.015;
export const SPIN_RESPONSE_EXPONENT = 1.9;
export const SPIN_RESPONSE_EXPONENT_BACKSPIN = 1.65;
export const SPIN_MAX_OFFSET = 0.7;

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
  const exponent = clamped.y < 0 ? SPIN_RESPONSE_EXPONENT_BACKSPIN : SPIN_RESPONSE_EXPONENT;
  const curvedMag = Math.pow(clampedMag, exponent);
  const scale = clampedMag > 1e-6 ? curvedMag / clampedMag : 0;
  const normalized = { x: clamped.x * scale, y: clamped.y * scale };
  return {
    x: normalized.x * SPIN_MAX_OFFSET,
    y: normalized.y * SPIN_MAX_OFFSET
  };
};

export const mapSpinForPhysics = (spin) => {
  const adjusted = clampToUnitCircle(
    clamp(spin?.x ?? 0, -1, 1),
    clamp(spin?.y ?? 0, -1, 1)
  );
  const curved = applySpinResponseCurve(adjusted);
  return {
    // UI uses screen-space: +X is right, +Y is up. Flip X to align side spin to
    // the table axes, and flip Y so high/low spin matches the cue-ball roll.
    x: -curved.x,
    y: -curved.y
  };
};
