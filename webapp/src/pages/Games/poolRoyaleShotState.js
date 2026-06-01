import * as THREE from 'three';

export const SHOT_STATE = Object.freeze({
  IDLE: 'idle',
  DRAGGING: 'dragging',
  STRIKING: 'striking'
});

export const resolveCommittedShot = ({
  capturedDragPower,
  fallbackPower = 0,
  minStrikePower = 0.02
}) => {
  const captured = Number.isFinite(capturedDragPower) ? capturedDragPower : fallbackPower;
  const clampedPower = THREE.MathUtils.clamp(captured, 0, 1);
  return {
    shotPower: clampedPower,
    state: clampedPower > minStrikePower ? SHOT_STATE.STRIKING : SHOT_STATE.IDLE
  };
};

export const resolvePoolRoyaleShotPowerScale = (power) => {
  const clampedPower = THREE.MathUtils.clamp(Number.isFinite(power) ? power : 0, 0, 1);
  const highEndT = THREE.MathUtils.clamp((clampedPower - 0.6) / 0.4, 0, 1);
  const highEndBoost = highEndT * highEndT * 0.55;
  return clampedPower * (1 + highEndBoost) * 1.3;
};

export const easeOut = (t) => 1 - Math.pow(1 - THREE.MathUtils.clamp(t, 0, 1), 3);
