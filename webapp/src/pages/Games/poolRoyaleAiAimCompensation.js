import * as THREE from 'three';

const MIN_VECTOR_EPS = 1e-6;
const DEFAULT_CONTACT_CALIBRATION = 0.004;
const SIDE_SPIN_COMPENSATION_SCALE = 0.28;
const POWER_DEFLECTION_SCALE = 0.32;

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
  const calibration = THREE.MathUtils.clamp(
    contactCalibration ?? DEFAULT_CONTACT_CALIBRATION,
    -0.08,
    0.08
  );
  const contactDepth = radius * 2 * (1 + calibration + topBackSpin * power01 * 0.015);

  const baseGhost = new THREE.Vector2()
    .copy(targetPos)
    .sub(toPocketDir.clone().multiplyScalar(contactDepth));

  const cueToTarget = new THREE.Vector2().subVectors(targetPos, cuePos);
  const cueToTargetLen = cueToTarget.length();
  if (cueToTargetLen <= MIN_VECTOR_EPS) return null;
  cueToTarget.normalize();

  const cutCos = THREE.MathUtils.clamp(cueToTarget.dot(toPocketDir), -1, 1);
  const cutSeverity = Math.sqrt(Math.max(0, 1 - cutCos * cutCos));
  const sidePerp = new THREE.Vector2(-cueToTarget.y, cueToTarget.x);

  // Compensate for power + spin induced deflection/throw before object-ball impact.
  const sideDeflection =
    radius *
    sideSpin *
    (0.38 + cutSeverity * 0.62) *
    (0.45 + power01 * 0.55) *
    SIDE_SPIN_COMPENSATION_SCALE;

  const topBackDeflection =
    radius *
    topBackSpin *
    power01 *
    (0.18 + cutSeverity * 0.22) *
    POWER_DEFLECTION_SCALE;

  const ghost = baseGhost
    .clone()
    .sub(sidePerp.multiplyScalar(sideDeflection))
    .sub(cueToTarget.clone().multiplyScalar(topBackDeflection));

  const finalCueVector = new THREE.Vector2().subVectors(ghost, cuePos);
  if (finalCueVector.lengthSq() <= MIN_VECTOR_EPS) return null;

  return {
    aimDir: finalCueVector.normalize(),
    ghost,
    contactDepth,
    compensation: {
      sideDeflection,
      topBackDeflection,
      cutSeverity
    }
  };
};
