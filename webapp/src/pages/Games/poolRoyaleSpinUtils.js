const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const MAX_SPIN_OFFSET = 0.7;
export const SPIN_STUN_RADIUS = 0.16;
export const SPIN_RING1_RADIUS = 0.32;
export const SPIN_RING2_RADIUS = 0.52;
export const SPIN_RING3_RADIUS = MAX_SPIN_OFFSET;
export const SPIN_LEVEL0_MAG = 0;
export const SPIN_LEVEL1_MAG = 0;
export const SPIN_LEVEL2_MAG = 0.45 * MAX_SPIN_OFFSET;
export const SPIN_LEVEL3_MAG = 0.9 * MAX_SPIN_OFFSET;
export const STRAIGHT_SPIN_DEADZONE = 0.02;
export const STUN_TOPSPIN_BIAS = 0;

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
    offset: { x: -0.45, y: 0.45 },
    effect:
      'Offset diagonal sipër-majtas: follow me efekt në banda dhe cut shots, me spin lateral aktiv.'
  },
  {
    id: 'top-right',
    label: 'TOPSPIN + RIGHT',
    offset: { x: 0.45, y: 0.45 },
    effect:
      'Offset diagonal sipër-djathtas: follow me efekt në banda dhe cut shots, me spin lateral aktiv.'
  },
  {
    id: 'back-left',
    label: 'BACKSPIN + LEFT',
    offset: { x: -0.45, y: -0.45 },
    effect:
      'Offset diagonal poshtë-majtas: draw me kontroll lateral pas kontaktit dhe reagim më agresiv me bandat.'
  },
  {
    id: 'back-right',
    label: 'BACKSPIN + RIGHT',
    offset: { x: 0.45, y: -0.45 },
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
  const scale = mag / distance;
  return { x: raw.x * scale, y: raw.y * scale };
};

export const normalizeSpinInput = (spin) => {
  let x = clamp(spin?.x ?? 0, -1, 1);
  let y = clamp(spin?.y ?? 0, -1, 1);
  const distance = Math.hypot(x, y);
  if (distance <= Math.max(SPIN_STUN_RADIUS, STRAIGHT_SPIN_DEADZONE)) {
    return { x: 0, y: STUN_TOPSPIN_BIAS };
  }
  return computeQuantizedOffsetScaled(x, y);
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
  const { cameraRight, cameraUp, cueForward } = options;
  return mapUiOffsetToCueFrame(
    quantized.x,
    quantized.y,
    cameraRight,
    cameraUp,
    cueForward
  );
};
