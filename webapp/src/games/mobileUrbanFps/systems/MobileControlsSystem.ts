import * as THREE from 'three';

export type NormalizedJoystick = {
  moveX: number;
  moveY: number;
  knobX: number;
  knobY: number;
};

export function normalizeJoystickInput(
  dx: number,
  dy: number,
  radius: number,
  deadZone = 0.055
): NormalizedJoystick {
  const rawLength = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  const clampedLength = Math.min(radius, rawLength);
  const normalizedLength = clampedLength / radius;
  const playableLength =
    normalizedLength <= deadZone
      ? 0
      : (normalizedLength - deadZone) / (1 - deadZone);

  return {
    moveX: Math.cos(angle) * playableLength,
    moveY: -Math.sin(angle) * playableLength,
    knobX: Math.cos(angle) * clampedLength,
    knobY: Math.sin(angle) * clampedLength
  };
}

export function mapPortraitLookDelta(
  dx: number,
  dy: number,
  aimSensitivity: number
) {
  const divisor = THREE.MathUtils.lerp(62, 24, aimSensitivity);
  const maxDelta = THREE.MathUtils.lerp(0.75, 1.55, aimSensitivity);
  return {
    lookX: THREE.MathUtils.clamp(dx / divisor, -maxDelta, maxDelta),
    lookY: THREE.MathUtils.clamp(dy / divisor, -maxDelta, maxDelta)
  };
}
