import * as THREE from 'three';

const MIN_VECTOR_EPS = 1e-6;

export const resolveAiPotGhostAim = ({
  cuePos,
  targetPos,
  pocketPos,
  ballRadius,
  spin,
  power,
  suggestedAimDir,
  suggestedWeight = 0.35
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

  const resolvedAim = finalCueVector.normalize();
  const suggested =
    suggestedAimDir && Number.isFinite(suggestedAimDir.x) && Number.isFinite(suggestedAimDir.y)
      ? new THREE.Vector2(suggestedAimDir.x, suggestedAimDir.y)
      : null;
  if (suggested && suggested.lengthSq() > MIN_VECTOR_EPS) {
    suggested.normalize();
    const blend = THREE.MathUtils.clamp(suggestedWeight, 0, 1);
    resolvedAim
      .multiplyScalar(Math.max(0, 1 - blend))
      .addScaledVector(suggested, blend);
    if (resolvedAim.lengthSq() > MIN_VECTOR_EPS) {
      resolvedAim.normalize();
    }
  }

  return {
    aimDir: resolvedAim,
    ghost
  };
};
