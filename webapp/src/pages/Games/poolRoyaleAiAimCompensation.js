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
  const topBackSpin = THREE.MathUtils.clamp(spin?.y ?? 0, -1, 1);
  const power01 = THREE.MathUtils.clamp(power ?? 0.6, 0, 1);

  // Keep cue-ball approach aligned to the geometric ghost-ball line.
  // Spin is still used after contact by the runtime physics, but it should not
  // change the pre-impact aiming direction.
  // Slightly adjust contact depth with top/back spin to account for post-impact speed changes.
  const contactDepth = radius * 2 * (1 + topBackSpin * power01 * 0.07);
  const ghost = new THREE.Vector2()
    .copy(targetPos)
    .sub(toPocketDir.clone().multiplyScalar(Math.max(radius * 1.5, contactDepth)));

  const finalCueVector = new THREE.Vector2().subVectors(ghost, cuePos);
  if (finalCueVector.lengthSq() <= MIN_VECTOR_EPS) return null;

  return {
    aimDir: finalCueVector.normalize(),
    ghost
  };
};
