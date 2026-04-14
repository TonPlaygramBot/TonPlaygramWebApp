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

export const easeOut = (t) => 1 - Math.pow(1 - THREE.MathUtils.clamp(t, 0, 1), 3);
