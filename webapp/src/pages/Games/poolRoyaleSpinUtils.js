const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const SPIN_INPUT_DEAD_ZONE = 0.015;
export const SPIN_RESPONSE_EXPONENT = 1.9;
export const SPIN_RESPONSE_EXPONENT_BACKSPIN = 1.65;
export const MAX_SPIN_OFFSET = 0.7;

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

export const normalizeSpinInput = (spin) => {
  const x = spin?.x ?? 0;
  const y = spin?.y ?? 0;
  const magnitude = Math.hypot(x, y);
  if (!Number.isFinite(magnitude) || magnitude < SPIN_INPUT_DEAD_ZONE) {
    return { x: 0, y: 0 };
  }
  return clampToMaxOffset(x, y);
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
  return { x: clamped.x * scale, y: clamped.y * scale };
};

export const mapSpinForPhysics = (spin) => {
  const adjusted = {
    x: clamp(spin?.x ?? 0, -1, 1),
    y: clamp(spin?.y ?? 0, -1, 1)
  };
  const limited = clampToMaxOffset(adjusted.x, adjusted.y);
  return {
    // UI uses screen-space: +X is right, +Y is up. Flip X to align side spin to
    // the table axes, and flip Y so high/low spin matches the cue-ball roll.
    x: -limited.x,
    y: -limited.y
  };
};
