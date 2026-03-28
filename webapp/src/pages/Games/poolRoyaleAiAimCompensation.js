import * as THREE from 'three';

const MIN_VECTOR_EPS = 1e-6;
const DEFAULT_CONTACT_CALIBRATION = 0.004;
const SIDE_SPIN_SQUIRT_SCALE = 0.032;
const POWER_DEFLECTION_SCALE = 0.018;
const TOPSPIN_THROW_SCALE = 0.006;

export const resolveAiPotGhostAim = ({
  cuePos,
  targetPos,
  pocketPos,
  ballRadius,
  spin,
  power,
  contactCalibration
} = {}) => {
  if (!cuePos || !targetPos || !pocketPos) return null;
  const radius = Math.max(0, ballRadius ?? 0);
  const toPocket = new THREE.Vector2().subVectors(pocketPos, targetPos);
  if (toPocket.lengthSq() <= MIN_VECTOR_EPS) return null;

  const toPocketDir = toPocket.normalize();
  const sideSpin = THREE.MathUtils.clamp(spin?.x ?? 0, -1, 1);
  const topBackSpin = THREE.MathUtils.clamp(spin?.y ?? 0, -1, 1);
  const power01 = THREE.MathUtils.clamp(power ?? 0.6, 0, 1);

  // Baseline geometric contact: cue-ball and object-ball centers should be 2R apart at impact.
  // Keep only a tiny spin/power calibration so aiming stays precise for ball-to-ball touch points.
  const calibration = THREE.MathUtils.clamp(
    contactCalibration ?? DEFAULT_CONTACT_CALIBRATION,
    -0.08,
    0.08
  );
  const contactDepth = radius * 2 * (1 + calibration + topBackSpin * power01 * 0.015);

  const ghost = new THREE.Vector2()
    .copy(targetPos)
    .sub(toPocketDir.clone().multiplyScalar(contactDepth));

  // Compensate for cue-ball squirt/deflection caused by side spin + power before impact.
  // Apply a small lateral offset on the ghost point opposite expected squirt so AI pre-aims naturally.
  const lateral = new THREE.Vector2(-toPocketDir.y, toPocketDir.x);
  const sideDeflection =
    sideSpin * (SIDE_SPIN_SQUIRT_SCALE + power01 * POWER_DEFLECTION_SCALE) * radius;
  const throwDeflection = topBackSpin * sideSpin * TOPSPIN_THROW_SCALE * power01 * radius;
  ghost.addScaledVector(lateral, -(sideDeflection + throwDeflection));

  const finalCueVector = new THREE.Vector2().subVectors(ghost, cuePos);
  if (finalCueVector.lengthSq() <= MIN_VECTOR_EPS) return null;

  return {
    aimDir: finalCueVector.normalize(),
    ghost,
    contactDepth
  };
};
