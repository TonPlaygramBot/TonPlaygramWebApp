import * as THREE from 'three';

const MIN_VECTOR_EPS = 1e-6;
const DEFAULT_CONTACT_CALIBRATION = 0.004;
const DEFAULT_SIDE_DEFLECTION_SCALE = 0.026;
const DEFAULT_POWER_DEFLECTION_SCALE = 0.014;

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

  const cueToTargetDir = new THREE.Vector2().subVectors(targetPos, cuePos);
  if (cueToTargetDir.lengthSq() <= MIN_VECTOR_EPS) return null;
  cueToTargetDir.normalize();
  const cutAlignment = THREE.MathUtils.clamp(cueToTargetDir.dot(toPocketDir), -1, 1);
  const cutSeverity = Math.sqrt(Math.max(0, 1 - cutAlignment * cutAlignment));
  const powerCurve = Math.pow(power01, 1.28);
  const sideDeflection =
    sideSpin *
    (0.34 + powerCurve * 0.66) *
    DEFAULT_SIDE_DEFLECTION_SCALE *
    (0.36 + cutSeverity * 0.64);
  const powerDeflection =
    topBackSpin *
    (0.28 + powerCurve * 0.72) *
    DEFAULT_POWER_DEFLECTION_SCALE *
    (0.42 + 0.58 * (1 - cutSeverity));
  const lateralUnit = new THREE.Vector2(-toPocketDir.y, toPocketDir.x);

  const ghost = new THREE.Vector2()
    .copy(targetPos)
    .sub(toPocketDir.clone().multiplyScalar(contactDepth))
    .addScaledVector(lateralUnit, sideDeflection)
    .addScaledVector(toPocketDir, powerDeflection);

  const finalCueVector = new THREE.Vector2().subVectors(ghost, cuePos);
  if (finalCueVector.lengthSq() <= MIN_VECTOR_EPS) return null;

  return {
    aimDir: finalCueVector.normalize(),
    ghost,
    contactDepth
  };
};
