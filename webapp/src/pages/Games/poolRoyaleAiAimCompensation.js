import * as THREE from 'three';

const MIN_VECTOR_EPS = 1e-6;
const DEFAULT_CONTACT_CALIBRATION = 0.0012;
const DEFAULT_SIDE_DEFLECTION_SCALE = 0.0115;
const DEFAULT_POWER_DEFLECTION_SCALE = 0.0125;

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
  const toPocketDistance = toPocket.length();

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
  const baseContactDepth = radius * 2 * (1 + calibration);

  const cueToTargetDir = new THREE.Vector2().subVectors(targetPos, cuePos);
  if (cueToTargetDir.lengthSq() <= MIN_VECTOR_EPS) return null;
  cueToTargetDir.normalize();
  const cutAlignment = THREE.MathUtils.clamp(cueToTargetDir.dot(toPocketDir), -1, 1);
  const cutSeverity = Math.sqrt(Math.max(0, 1 - cutAlignment * cutAlignment));
  const sideDeflection =
    sideSpin *
    power01 *
    DEFAULT_SIDE_DEFLECTION_SCALE *
    (0.32 + cutSeverity * 0.68);
  const powerDeflection =
    topBackSpin *
    (0.22 + 0.78 * Math.pow(power01, 1.18)) *
    DEFAULT_POWER_DEFLECTION_SCALE *
    (0.24 + 0.76 * cutSeverity) *
    THREE.MathUtils.clamp(
      toPocketDistance / Math.max(radius * 22, MIN_VECTOR_EPS),
      0.8,
      1.24
    );
  const cutCompensatedDepth = baseContactDepth * (1 - 0.024 * cutSeverity * cutSeverity);
  const lateralUnit = new THREE.Vector2(-toPocketDir.y, toPocketDir.x);

  const ghost = new THREE.Vector2()
    .copy(targetPos)
    .sub(toPocketDir.clone().multiplyScalar(cutCompensatedDepth))
    .addScaledVector(lateralUnit, sideDeflection)
    .addScaledVector(toPocketDir, powerDeflection);

  const finalCueVector = new THREE.Vector2().subVectors(ghost, cuePos);
  if (finalCueVector.lengthSq() <= MIN_VECTOR_EPS) return null;

  return {
    aimDir: finalCueVector.normalize(),
    ghost,
    contactDepth: cutCompensatedDepth
  };
};
