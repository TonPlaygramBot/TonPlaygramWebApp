const SPIN_INPUT_DEAD_ZONE = 0.02;
const SPIN_RESPONSE_EXPONENT = 1.65;

const clampToUnitCircle = (x, y) => {
  const L = Math.hypot(x, y);
  if (!Number.isFinite(L) || L <= 1) {
    return { x, y };
  }
  const scale = L > 1e-6 ? 1 / L : 0;
  return { x: x * scale, y: y * scale };
};

const normalizeSpinInput = (spin) => {
  const x = spin?.x ?? 0;
  const y = spin?.y ?? 0;
  const magnitude = Math.hypot(x, y);
  if (!Number.isFinite(magnitude) || magnitude < SPIN_INPUT_DEAD_ZONE) {
    return { x: 0, y: 0 };
  }
  return clampToUnitCircle(x, y);
};

const applySpinResponseCurve = (spin) => {
  const x = spin?.x ?? 0;
  const y = spin?.y ?? 0;
  const magnitude = Math.hypot(x, y);
  if (!Number.isFinite(magnitude) || magnitude < SPIN_INPUT_DEAD_ZONE) {
    return { x: 0, y: 0 };
  }
  const clamped = clampToUnitCircle(x, y);
  const clampedMag = Math.hypot(clamped.x, clamped.y);
  if (clampedMag < 1e-6) return { x: 0, y: 0 };
  const curvedMag = Math.pow(clampedMag, SPIN_RESPONSE_EXPONENT);
  const scale = curvedMag / clampedMag;
  return { x: clamped.x * scale, y: clamped.y * scale };
};

const mapSpinForPhysics = (spin, { invertY = true } = {}) => {
  const curved = applySpinResponseCurve(spin);
  return {
    x: curved?.x ?? 0,
    y: invertY ? -(curved?.y ?? 0) : (curved?.y ?? 0)
  };
};

export {
  SPIN_INPUT_DEAD_ZONE,
  applySpinResponseCurve,
  mapSpinForPhysics,
  normalizeSpinInput
};
