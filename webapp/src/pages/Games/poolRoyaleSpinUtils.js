const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const MAX_SPIN_OFFSET = 0.75;
export const SPIN_STUN_RADIUS = 0.16;
export const SPIN_RING1_RADIUS = 0.33;
export const SPIN_RING2_RADIUS = 0.66;
export const SPIN_RING3_RADIUS = MAX_SPIN_OFFSET;
export const SPIN_LEVEL0_MAG = 0;
export const SPIN_LEVEL1_MAG = SPIN_RING1_RADIUS;
export const SPIN_LEVEL2_MAG = SPIN_RING2_RADIUS;
export const SPIN_LEVEL3_MAG = SPIN_RING3_RADIUS;
export const STRAIGHT_SPIN_DEADZONE = 0.02;
export const STUN_TOPSPIN_BIAS = 0;
export const SPIN_EDGE_AXIS_LOCK_MAG = 0.7;
export const SPIN_EDGE_AXIS_LOCK_RATIO = 0.3;
export const SPIN_TOP_HALF_SCALE = 0.4;
export const SPIN_BOTTOM_HALF_SCALE = 1.25;

export const SPIN_DIRECTIONS = [
  {
    id: 'stun',
    label: 'STUN (no spin)',
    offset: { x: 0, y: 0 },
    effect:
      'Goditje në qendër: cue ball rrëshqet fillimisht dhe kalon në rolling pa topspin/backspin.'
  },
  {
    id: 'topspin',
    label: 'TOPSPIN (follow)',
    offset: { x: 0, y: MAX_SPIN_OFFSET },
    effect:
      'Goditje sipër qendrës: spin rreth boshtit horizontal në drejtim të lëvizjes, cue ball vazhdon përpara pas kontaktit.'
  },
  {
    id: 'backspin',
    label: 'BACKSPIN (draw)',
    offset: { x: 0, y: -MAX_SPIN_OFFSET },
    effect:
      'Goditje poshtë qendrës: spin rreth boshtit horizontal në drejtim të kundërt, cue ball ndalon dhe kthehet mbrapsht pas kontaktit.'
  },
  {
    id: 'left-english',
    label: 'SIDESPIN LEFT',
    offset: { x: -MAX_SPIN_OFFSET, y: 0 },
    effect:
      'Goditje majtas nga qendra: spin rreth boshtit vertikal, ndikon kryesisht në rebound me banda dhe në “throw”.'
  },
  {
    id: 'right-english',
    label: 'SIDESPIN RIGHT',
    offset: { x: MAX_SPIN_OFFSET, y: 0 },
    effect:
      'Goditje djathtas nga qendra: spin rreth boshtit vertikal në drejtim të kundërt, me të njëjtat efekte anësore.'
  },
  {
    id: 'top-left',
    label: 'TOPSPIN + LEFT',
    offset: { x: -SPIN_RING2_RADIUS, y: SPIN_RING2_RADIUS },
    effect:
      'Offset diagonal sipër-majtas: follow me efekt në banda dhe cut shots, me spin lateral aktiv.'
  },
  {
    id: 'top-right',
    label: 'TOPSPIN + RIGHT',
    offset: { x: SPIN_RING2_RADIUS, y: SPIN_RING2_RADIUS },
    effect:
      'Offset diagonal sipër-djathtas: follow me efekt në banda dhe cut shots, me spin lateral aktiv.'
  },
  {
    id: 'back-left',
    label: 'BACKSPIN + LEFT',
    offset: { x: -SPIN_RING2_RADIUS, y: -SPIN_RING2_RADIUS },
    effect:
      'Offset diagonal poshtë-majtas: draw me kontroll lateral pas kontaktit dhe reagim më agresiv me bandat.'
  },
  {
    id: 'back-right',
    label: 'BACKSPIN + RIGHT',
    offset: { x: SPIN_RING2_RADIUS, y: -SPIN_RING2_RADIUS },
    effect:
      'Offset diagonal poshtë-djathtas: draw me kontroll lateral pas kontaktit dhe reagim më agresiv me bandat.'
  }
];

export const clampToUnitCircle = (x, y) => {
  const length = Math.hypot(x, y);
  if (!Number.isFinite(length) || length <= 1) {
    return { x, y };
  }
  const scale = length > 1e-6 ? 1 / length : 0;
  return { x: x * scale, y: y * scale };
};

export const clampToMaxOffset = (x, y, maxOffset = MAX_SPIN_OFFSET) => {
  const length = Math.hypot(x, y);
  if (!Number.isFinite(length) || length <= maxOffset) {
    return { x, y };
  }
  const scale = length > 1e-6 ? maxOffset / length : 0;
  return { x: x * scale, y: y * scale };
};

export const computeQuantizedOffsetScaled = (
  rawX,
  rawY,
  options = {}
) => {
  const maxOffset = options.maxOffset ?? MAX_SPIN_OFFSET;
  const stunRadius = options.stunRadius ?? SPIN_STUN_RADIUS;
  const ring1Radius = options.ring1Radius ?? SPIN_RING1_RADIUS;
  const ring2Radius = options.ring2Radius ?? SPIN_RING2_RADIUS;
  const ring3Radius = options.ring3Radius ?? SPIN_RING3_RADIUS;
  const level0Mag = options.level0Mag ?? SPIN_LEVEL0_MAG;
  const level1Mag = options.level1Mag ?? SPIN_LEVEL1_MAG;
  const level2Mag = options.level2Mag ?? SPIN_LEVEL2_MAG;
  const level3Mag = options.level3Mag ?? SPIN_LEVEL3_MAG;
  const angleStep = options.angleStepRad ?? Math.PI / 4;

  const raw = clampToMaxOffset(rawX, rawY, maxOffset);
  const distance = Math.hypot(raw.x, raw.y);
  let mag = level3Mag;
  if (distance <= stunRadius) {
    mag = level0Mag;
  } else if (distance <= ring1Radius) {
    mag = level1Mag;
  } else if (distance <= ring2Radius) {
    mag = level2Mag;
  } else if (distance <= ring3Radius) {
    mag = level3Mag;
  }
  if (mag === 0 || distance <= 1e-6) {
    return { x: 0, y: 0 };
  }
  const angle = Math.atan2(raw.y, raw.x);
  const snappedAngle = angleStep > 0
    ? Math.round(angle / angleStep) * angleStep
    : angle;
  return {
    x: Math.cos(snappedAngle) * mag,
    y: Math.sin(snappedAngle) * mag
  };
};

export const normalizeSpinInput = (spin) => {
  let x = clamp(spin?.x ?? 0, -1, 1);
  let y = clamp(spin?.y ?? 0, -1, 1);
  const distance = Math.hypot(x, y);
  if (distance <= Math.max(SPIN_STUN_RADIUS, STRAIGHT_SPIN_DEADZONE)) {
    return { x: 0, y: STUN_TOPSPIN_BIAS };
  }
  const clamped = clampToMaxOffset(x, y, MAX_SPIN_OFFSET);
  const edgeMagnitude = Math.hypot(clamped.x, clamped.y);
  if (edgeMagnitude >= SPIN_EDGE_AXIS_LOCK_MAG) {
    const absX = Math.abs(clamped.x);
    const absY = Math.abs(clamped.y);
    if (absX <= absY * SPIN_EDGE_AXIS_LOCK_RATIO) {
      return { x: 0, y: clamped.y };
    }
    if (absY <= absX * SPIN_EDGE_AXIS_LOCK_RATIO) {
      return { x: clamped.x, y: 0 };
    }
  }
  return clamped;
};

export const mapUiOffsetToCueFrame = (
  uiX,
  uiY,
  cameraRight,
  cameraUp,
  cueForward
) => {
  if (!cameraRight || !cameraUp || !cueForward) {
    return { x: uiX, y: uiY };
  }
  const right = cameraRight;
  const up = cameraUp;
  const forward = cueForward;
  const offsetWorld = {
    x: right.x * uiX + up.x * uiY,
    y: right.y * uiX + up.y * uiY,
    z: right.z * uiX + up.z * uiY
  };
  offsetWorld.y = 0;
  const forwardPlanarLength = Math.hypot(forward.x, forward.z);
  const forwardPlanar =
    forwardPlanarLength > 1e-6
      ? { x: forward.x / forwardPlanarLength, z: forward.z / forwardPlanarLength }
      : { x: 0, z: 1 };
  const side = { x: -forwardPlanar.z, z: forwardPlanar.x };
  return {
    x: -(offsetWorld.x * side.x + offsetWorld.z * side.z),
    y: offsetWorld.x * forwardPlanar.x + offsetWorld.z * forwardPlanar.z
  };
};

export const mapSpinForPhysics = (spin, options = {}) => {
  const adjusted = {
    x: clamp(spin?.x ?? 0, -1, 1),
    y: clamp(spin?.y ?? 0, -1, 1)
  };
  const quantized = normalizeSpinInput(adjusted);
  let scaledY = quantized.y;
  if (scaledY > 0) {
    scaledY *= SPIN_TOP_HALF_SCALE;
  } else if (scaledY < 0) {
    scaledY *= SPIN_BOTTOM_HALF_SCALE;
  }
  scaledY = clamp(scaledY, -1, 1);
  const scaled = { x: quantized.x, y: scaledY };
  const { cameraRight, cameraUp, cueForward } = options;
  return mapUiOffsetToCueFrame(
    -scaled.x,
    scaled.y,
    cameraRight,
    cameraUp,
    cueForward
  );
};

// Smooth damp helper adapted from Unity's Mathf.SmoothDamp (MIT licensed).
export const smoothDamp = (
  current,
  target,
  currentVelocity,
  smoothTime,
  maxSpeed,
  deltaTime
) => {
  const clampedSmooth = Math.max(0.0001, smoothTime || 0);
  const omega = 2 / clampedSmooth;
  const x = omega * deltaTime;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  let change = current - target;
  const originalTarget = target;
  const maxChange = (maxSpeed ?? Number.POSITIVE_INFINITY) * clampedSmooth;
  if (Number.isFinite(maxChange)) {
    change = clamp(change, -maxChange, maxChange);
  }
  target = current - change;
  const temp = (currentVelocity + omega * change) * deltaTime;
  let velocity = (currentVelocity - omega * temp) * exp;
  let output = target + (change + temp) * exp;
  if ((originalTarget - current > 0) === (output > originalTarget)) {
    output = originalTarget;
    velocity = (output - originalTarget) / Math.max(deltaTime, 1e-4);
  }
  return { value: output, velocity };
};
