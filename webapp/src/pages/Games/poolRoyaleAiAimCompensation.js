import * as THREE from 'three';

const MIN_VECTOR_EPS = 1e-6;
const DEFAULT_CONTACT_CALIBRATION = 0.0015;
const DEFAULT_SIDE_DEFLECTION_SCALE = 0.0135;
const DEFAULT_POWER_DEFLECTION_SCALE = 0.015;

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
  const contactDepth = radius * 2 * (1 + calibration);

  const cueToTargetDir = new THREE.Vector2().subVectors(targetPos, cuePos);
  if (cueToTargetDir.lengthSq() <= MIN_VECTOR_EPS) return null;
  cueToTargetDir.normalize();
  const cutAlignment = THREE.MathUtils.clamp(cueToTargetDir.dot(toPocketDir), -1, 1);
  const cutSeverity = Math.sqrt(Math.max(0, 1 - cutAlignment * cutAlignment));
  const sideDeflection =
    sideSpin *
    power01 *
    DEFAULT_SIDE_DEFLECTION_SCALE *
    (0.45 + cutSeverity * 0.55);
  const powerDeflection =
    topBackSpin *
    (0.35 + 0.65 * Math.pow(power01, 1.2)) *
    DEFAULT_POWER_DEFLECTION_SCALE *
    (0.3 + 0.7 * cutSeverity) *
    THREE.MathUtils.clamp(
      toPocketDistance / Math.max(radius * 22, MIN_VECTOR_EPS),
      0.75,
      1.35
    );
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
