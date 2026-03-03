import * as THREE from 'three';

const MIN_VECTOR_EPS = 1e-6;

export const resolveAiPotGhostAim = ({
  cuePos,
  targetPos,
  pocketPos,
  ballRadius,
  spin,
  power
} = {}) => {
  if (!cuePos || !targetPos || !pocketPos) return null;
  const radius = Math.max(0, ballRadius ?? 0);
  const toPocket = new THREE.Vector2().subVectors(pocketPos, targetPos);
  if (toPocket.lengthSq() <= MIN_VECTOR_EPS) return null;

  const toPocketDir = toPocket.normalize();
  const sideSpin = THREE.MathUtils.clamp(spin?.x ?? 0, -1, 1);
  const topBackSpin = THREE.MathUtils.clamp(spin?.y ?? 0, -1, 1);
  const power01 = THREE.MathUtils.clamp(power ?? 0.6, 0, 1);

  // Small compensation for squirt/throw so AI can still target the center pocket entry.
  const compensationAngle = sideSpin * power01 * 0.085;
  // Slightly adjust contact depth with top/back spin to account for throw speed changes.
  const contactDepth = radius * 2 * (1 + topBackSpin * power01 * 0.07);
  const ghost = new THREE.Vector2()
    .copy(targetPos)
    .sub(toPocketDir.clone().multiplyScalar(Math.max(radius * 1.5, contactDepth)));

  const finalCueVector = new THREE.Vector2().subVectors(ghost, cuePos);
  if (finalCueVector.lengthSq() <= MIN_VECTOR_EPS) return null;
  finalCueVector.rotateAround(new THREE.Vector2(0, 0), -compensationAngle);

  return {
    aimDir: finalCueVector.normalize(),
    ghost
  };
};
