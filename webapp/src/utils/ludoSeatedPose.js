import * as THREE from 'three';
import { applyTuriSeatedPose } from '../games/shared/turiSeatedPose.js';
// Calibrated Ludo actor pose, shared with Snake without changing its rules.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const LUDO_ARENA_SHRINK_FACTOR = 0.374;
const ARENA_SCALE = 0.72 * LUDO_ARENA_SHRINK_FACTOR;
const MODEL_SCALE = 0.75 * ARENA_SCALE;
const CHAIR_GLOBAL_SCALE = 0.66;
const STOOL_SCALE = 1.5 * 1.3 * CHAIR_GLOBAL_SCALE;
const SEATED_HUMAN_FOOT_GROUND_CLEARANCE = -1.55 * MODEL_SCALE * STOOL_SCALE;
const SEATED_HUMAN_MOTION_TUNING = Object.freeze({
  idleBreathAmp: 0.012,
  throwPrecision: 1.08,
  tokenPrecision: 1.14
});
const SEATED_HUMAN_DOWNWARD_CONTACT_MODE_SET = new Set([
  'reachDice',
  'gripDice',
  'holdDice',
  'reachToken',
  'gripToken',
  'carryToken',
  'placeToken'
]);
const SEATED_HUMAN_DICE_CONTACT_MODE_SET = new Set(['reachDice', 'gripDice', 'holdDice']);
function resetBoneRig(rig) {
  if (!rig?.saved) return;
  rig.saved.forEach((saved, bone) => {
    bone.rotation.copy(saved.rotation);
    bone.position.copy(saved.position);
  });
}
function addBoneRot(rig, bone, x = 0, y = 0, z = 0, weight = 1) {
  if (!rig || !bone) return;
  const base = rig.saved.get(bone);
  if (!base) return;
  bone.rotation.x = base.rotation.x + x * weight;
  bone.rotation.y = base.rotation.y + y * weight;
  bone.rotation.z = base.rotation.z + z * weight;
}
function addBonePos(rig, bone, x = 0, y = 0, z = 0, weight = 1) {
  if (!rig || !bone) return;
  const base = rig.saved.get(bone);
  if (!base) return;
  bone.position.x = base.position.x + x * weight;
  bone.position.y = base.position.y + y * weight;
  bone.position.z = base.position.z + z * weight;
}
function smoother01(v) {
  const t = clamp(v, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}
function curlFingerChain(rig, chain = [], amount = 0, sideSpread = 0) {
  const grip = clamp(amount, 0, 1);
  chain.forEach((bone, index) => {
    const curl = index === 0 ? 0.38 : 0.72;
    const side = index === 0 ? sideSpread : sideSpread * 0.25;
    addBoneRot(rig, bone, curl * grip, 0.03 * grip, side * grip, 1);
  });
}
function applyRightHandGrip(rig, gripAmount = 0) {
  if (!rig) return;
  const grip = clamp(gripAmount, 0, 1);
  const open = 1 - grip;
  const squeeze = 0.78 + grip * 0.38;

  curlFingerChain(rig, rig.rightIndex, grip * squeeze, -0.06 + 0.04 * open);
  curlFingerChain(rig, rig.rightMiddle, grip * squeeze, -0.025);
  curlFingerChain(rig, rig.rightRing, grip * squeeze, 0.055 - 0.03 * open);
  curlFingerChain(rig, rig.rightPinky, grip * squeeze, 0.105 - 0.04 * open);

  (rig.rightThumb || []).forEach((bone, index) => {
    const fold = index === 0 ? 0.38 : 0.62;
    addBoneRot(rig, bone, fold * grip, -0.36 * grip, 0.27 * grip, 1);
  });
}
function applyLeftHandGrip(rig, gripAmount = 0) {
  if (!rig) return;
  const grip = clamp(gripAmount, 0, 1);
  curlFingerChain(rig, rig.leftIndex, grip * 0.92, 0.05);
  curlFingerChain(rig, rig.leftMiddle, grip * 1.02, 0.02);
  curlFingerChain(rig, rig.leftRing, grip * 1.04, -0.04);
  curlFingerChain(rig, rig.leftPinky, grip * 0.98, -0.08);
  (rig.leftThumb || []).forEach((bone, index) => {
    const fold = index === 0 ? 0.34 : 0.58;
    addBoneRot(rig, bone, fold * grip, 0.28 * grip, -0.22 * grip, 1);
  });
}
function applyFirearmTriggerGrip(rig, gripAmount = 0) {
  if (!rig) return;
  const grip = clamp(gripAmount, 0, 1);
  // Keep the trigger finger visibly extended forward with only the fingertip curled,
  // matching the reference FPS grip instead of closing every finger into a fist.
  (rig.rightIndex || []).forEach((bone, index) => {
    const triggerCurl = index === 0 ? 0.16 : index === 1 ? 0.32 : 0.42;
    addBoneRot(rig, bone, triggerCurl * grip, 0.015 * grip, -0.035 * grip, 1);
  });
  curlFingerChain(rig, rig.rightMiddle, grip * 1.08, -0.035);
  curlFingerChain(rig, rig.rightRing, grip * 1.12, 0.04);
  curlFingerChain(rig, rig.rightPinky, grip * 1.04, 0.09);
  (rig.rightThumb || []).forEach((bone, index) => {
    const fold = index === 0 ? 0.42 : 0.68;
    addBoneRot(rig, bone, fold * grip, -0.42 * grip, 0.32 * grip, 1);
  });
}
const FRONT_SIDE_Z = 1;
const LEG_FRONT_OFFSET_MIXAMO = 0;
function moveLegRootsToFront(rig, amount = LEG_FRONT_OFFSET_MIXAMO) {
  if (!rig) return;
  addBonePos(rig, rig.leftUpperLeg, 0, 0, FRONT_SIDE_Z * amount, 1);
  addBonePos(rig, rig.rightUpperLeg, 0, 0, FRONT_SIDE_Z * amount, 1);
}
function applySeatedHumanPose(
  rig,
  mode = 'idle',
  intensity = 1,
  handGrip = 0,
  throwBias = {},
  motionTuning = {},
  chairSupportsArmrest = true
) {
  if (!rig) return;
  resetBoneRig(rig);
  const t = smoother01(intensity);
  const breathe = Math.sin(performance.now() * 0.002) * (motionTuning.idleBreathAmp ?? SEATED_HUMAN_MOTION_TUNING.idleBreathAmp);
  const precision = clamp(motionTuning?.precision ?? 1, 0.8, 1.35);
  const throwLateral = clamp(throwBias?.lateral ?? 0, -1, 1);
  const throwForward = clamp(throwBias?.forward ?? 1, -1, 1);

  addBonePos(rig, rig.hips, 0, -0.62, -0.078, 1);
  moveLegRootsToFront(rig);
  addBoneRot(rig, rig.hips, -0.16, 0, 0, 1);
  addBoneRot(rig, rig.spine, 0.26 + breathe, 0, 0, 1);
  addBoneRot(rig, rig.chest, 0.16, 0, 0, 1);
  addBoneRot(rig, rig.neck, -0.04, 0, 0, 1);
  addBoneRot(rig, rig.head, -0.06, 0, 0, 1);

  // Push seated bodies lower on portrait view by folding legs further and dropping hips.
  addBoneRot(rig, rig.leftUpperLeg, -1.58, 0.16, 0.05, 1);
  addBoneRot(rig, rig.leftLowerLeg, -1.66, 0.02, 0.01, 1);
  addBoneRot(rig, rig.leftFoot, 0.26, 0.03, 0.02, 1);
  addBoneRot(rig, rig.rightUpperLeg, -1.58, 0.03, -0.02, 1);
  addBoneRot(rig, rig.rightLowerLeg, -1.66, -0.02, -0.01, 1);
  addBoneRot(rig, rig.rightFoot, 0.26, -0.02, -0.01, 1);

  if (chairSupportsArmrest) {
    addBoneRot(rig, rig.leftUpperArm, -0.28, 0.12, 0.96, 1);
    addBoneRot(rig, rig.leftForeArm, -0.62, 0.05, -0.24, 1);
    addBoneRot(rig, rig.leftHand, -0.16, 0, 0, 1);
  } else {
    addBoneRot(rig, rig.leftUpperArm, -0.96, 0.04, 0.08, 1);
    addBoneRot(rig, rig.leftForeArm, -0.12, 0.02, -0.08, 1);
    addBoneRot(rig, rig.leftHand, 0.06, 0, 0.02, 1);
  }

  let shoulderX = chairSupportsArmrest ? -0.2 : -0.98;
  let shoulderY = chairSupportsArmrest ? -0.02 : -0.03;
  let shoulderZ = chairSupportsArmrest ? -0.72 : -0.06;
  let forearmX = chairSupportsArmrest ? -0.5 : -0.12;
  let forearmY = chairSupportsArmrest ? -0.04 : 0.02;
  let forearmZ = chairSupportsArmrest ? 0.14 : -0.08;
  let wristX = chairSupportsArmrest ? -0.08 : 0.04;
  let wristY = 0;
  let wristZ = chairSupportsArmrest ? 0.06 : 0.02;
  let chestX = 0.12;
  let chestY = 0;
  let headX = -0.06;
  let headY = 0;
  const bodyLockedMode = mode !== 'idle';
  const isDiceReachMode = mode === 'reachDice' || mode === 'gripDice';

  if (mode === 'firearmAim') {
    shoulderX = THREE.MathUtils.lerp(shoulderX, -0.96, t);
    shoulderY = THREE.MathUtils.lerp(shoulderY, -0.09, t);
    shoulderZ = THREE.MathUtils.lerp(shoulderZ, -1.02, t);
    forearmX = THREE.MathUtils.lerp(forearmX, -0.22, t);
    forearmY = THREE.MathUtils.lerp(forearmY, -0.06, t);
    forearmZ = THREE.MathUtils.lerp(forearmZ, 0.1, t);
    wristX = THREE.MathUtils.lerp(wristX, 0.1, t);
    wristY = THREE.MathUtils.lerp(wristY, -0.05, t);
    wristZ = THREE.MathUtils.lerp(wristZ, -0.18, t);
    chestX = THREE.MathUtils.lerp(chestX, 0.2, t);
    headX = THREE.MathUtils.lerp(headX, -0.14, t);

  } else if (mode === 'firearmAimPistol') {
    shoulderX = THREE.MathUtils.lerp(shoulderX, -0.94, t);
    shoulderY = THREE.MathUtils.lerp(shoulderY, -0.04, t);
    shoulderZ = THREE.MathUtils.lerp(shoulderZ, -0.96, t);
    forearmX = THREE.MathUtils.lerp(forearmX, -0.18, t);
    forearmY = THREE.MathUtils.lerp(forearmY, -0.04, t);
    forearmZ = THREE.MathUtils.lerp(forearmZ, 0.07, t);
    wristX = THREE.MathUtils.lerp(wristX, 0.06, t);
    wristY = THREE.MathUtils.lerp(wristY, -0.03, t);
    wristZ = THREE.MathUtils.lerp(wristZ, -0.12, t);
  } else if (mode === 'firearmAimSmg') {
    shoulderX = THREE.MathUtils.lerp(shoulderX, -0.98, t);
    shoulderY = THREE.MathUtils.lerp(shoulderY, -0.1, t);
    shoulderZ = THREE.MathUtils.lerp(shoulderZ, -1.06, t);
    forearmX = THREE.MathUtils.lerp(forearmX, -0.26, t);
    forearmY = THREE.MathUtils.lerp(forearmY, -0.08, t);
    forearmZ = THREE.MathUtils.lerp(forearmZ, 0.12, t);
    wristX = THREE.MathUtils.lerp(wristX, 0.12, t);
    wristY = THREE.MathUtils.lerp(wristY, -0.06, t);
    wristZ = THREE.MathUtils.lerp(wristZ, -0.2, t);
  } else if (mode === 'firearmAimRifle') {
    shoulderX = THREE.MathUtils.lerp(shoulderX, -1.02, t);
    shoulderY = THREE.MathUtils.lerp(shoulderY, -0.11, t);
    shoulderZ = THREE.MathUtils.lerp(shoulderZ, -1.12, t);
    forearmX = THREE.MathUtils.lerp(forearmX, -0.28, t);
    forearmY = THREE.MathUtils.lerp(forearmY, -0.07, t);
    forearmZ = THREE.MathUtils.lerp(forearmZ, 0.14, t);
    wristX = THREE.MathUtils.lerp(wristX, 0.14, t);
    wristY = THREE.MathUtils.lerp(wristY, -0.07, t);
    wristZ = THREE.MathUtils.lerp(wristZ, -0.22, t);
    chestX = THREE.MathUtils.lerp(chestX, 0.22, t);
    headX = THREE.MathUtils.lerp(headX, -0.16, t);
  } else if (mode === 'firearmAimShotgun') {
    shoulderX = THREE.MathUtils.lerp(shoulderX, -1.06, t);
    shoulderY = THREE.MathUtils.lerp(shoulderY, -0.13, t);
    shoulderZ = THREE.MathUtils.lerp(shoulderZ, -1.16, t);
    forearmX = THREE.MathUtils.lerp(forearmX, -0.32, t);
    forearmY = THREE.MathUtils.lerp(forearmY, -0.1, t);
    forearmZ = THREE.MathUtils.lerp(forearmZ, 0.16, t);
    wristX = THREE.MathUtils.lerp(wristX, 0.18, t);
    wristY = THREE.MathUtils.lerp(wristY, -0.08, t);
    wristZ = THREE.MathUtils.lerp(wristZ, -0.24, t);
    chestX = THREE.MathUtils.lerp(chestX, 0.24, t);
    headX = THREE.MathUtils.lerp(headX, -0.18, t);
  } else if (mode === 'reachDice') {
    shoulderX = THREE.MathUtils.lerp(shoulderX, -0.92, t);
    shoulderY = THREE.MathUtils.lerp(shoulderY, -0.19, t);
    shoulderZ = THREE.MathUtils.lerp(shoulderZ, -1.22, t);
    forearmX = THREE.MathUtils.lerp(forearmX, -1.28, t);
    forearmY = THREE.MathUtils.lerp(forearmY, -0.3, t);
    forearmZ = THREE.MathUtils.lerp(forearmZ, -0.5, t);
    wristX = THREE.MathUtils.lerp(wristX, -0.58, t);
    wristY = THREE.MathUtils.lerp(wristY, 0.14, t);
    wristZ = THREE.MathUtils.lerp(wristZ, -0.42, t);
    chestX = THREE.MathUtils.lerp(chestX, 0.34, t);
    headX = THREE.MathUtils.lerp(headX, -0.2, t);
  } else if (mode === 'gripDice') {
    shoulderX = THREE.MathUtils.lerp(shoulderX, -0.9, t);
    shoulderY = THREE.MathUtils.lerp(shoulderY, -0.2, t);
    shoulderZ = THREE.MathUtils.lerp(shoulderZ, -1.1, t);
    forearmX = THREE.MathUtils.lerp(forearmX, -1.22, t);
    forearmY = THREE.MathUtils.lerp(forearmY, -0.31, t);
    forearmZ = THREE.MathUtils.lerp(forearmZ, -0.26, t);
    wristX = THREE.MathUtils.lerp(wristX, -0.62, t);
    wristY = THREE.MathUtils.lerp(wristY, 0.12, t);
    wristZ = THREE.MathUtils.lerp(wristZ, -0.28, t);
    chestX = THREE.MathUtils.lerp(chestX, 0.3, t);
    headX = THREE.MathUtils.lerp(headX, -0.18, t);
  } else if (mode === 'holdDice') {
    shoulderX = THREE.MathUtils.lerp(shoulderX, -0.5, t);
    shoulderY = THREE.MathUtils.lerp(shoulderY, -0.18, t);
    shoulderZ = THREE.MathUtils.lerp(shoulderZ, -0.34, t);
    forearmX = THREE.MathUtils.lerp(forearmX, -1.08, t);
    forearmY = THREE.MathUtils.lerp(forearmY, -0.1, t);
    forearmZ = THREE.MathUtils.lerp(forearmZ, 0.38, t);
    wristX = THREE.MathUtils.lerp(wristX, -0.56, t);
    wristY = THREE.MathUtils.lerp(wristY, 0.06, t);
    wristZ = THREE.MathUtils.lerp(wristZ, 0.14, t);
  } else if (mode === 'windUp') {
    shoulderX = THREE.MathUtils.lerp(shoulderX, -0.88, t);
    shoulderY = THREE.MathUtils.lerp(shoulderY, -0.38, t);
    shoulderZ = THREE.MathUtils.lerp(shoulderZ, -0.22, t);
    forearmX = THREE.MathUtils.lerp(forearmX, -1.06, t);
    forearmY = THREE.MathUtils.lerp(forearmY, -0.2, t);
    forearmZ = THREE.MathUtils.lerp(forearmZ, 0.38, t);
    wristX = THREE.MathUtils.lerp(wristX, -0.62, t);
    wristY = THREE.MathUtils.lerp(wristY, -0.12, t);
    wristZ = THREE.MathUtils.lerp(wristZ, 0.04, t);
    shoulderY += throwLateral * 0.24 * t * precision;
    forearmY += throwLateral * 0.14 * t * precision;
    wristY += throwLateral * 0.08 * t * precision;
    shoulderZ += (1 - throwForward) * 0.14 * t * precision;
  } else if (mode === 'release') {
    shoulderX = THREE.MathUtils.lerp(shoulderX, -1.08, t);
    shoulderY = THREE.MathUtils.lerp(shoulderY, -0.14, t);
    shoulderZ = THREE.MathUtils.lerp(shoulderZ, -0.98, t);
    forearmX = THREE.MathUtils.lerp(forearmX, -0.24, t);
    forearmY = THREE.MathUtils.lerp(forearmY, -0.06, t);
    forearmZ = THREE.MathUtils.lerp(forearmZ, 0.08, t);
    wristX = THREE.MathUtils.lerp(wristX, 0.14, t);
    wristY = THREE.MathUtils.lerp(wristY, -0.06, t);
    wristZ = THREE.MathUtils.lerp(wristZ, -0.16, t);
    shoulderY += throwLateral * 0.34 * t * precision;
    forearmY += throwLateral * 0.24 * t * precision;
    wristY += throwLateral * 0.2 * t * precision;
    shoulderZ += (1 - throwForward) * 0.2 * t * precision;
  } else if (mode === 'followThrough') {
    shoulderX = THREE.MathUtils.lerp(shoulderX, -0.8, t);
    shoulderY = THREE.MathUtils.lerp(shoulderY, -0.12, t);
    shoulderZ = THREE.MathUtils.lerp(shoulderZ, -0.96, t);
    forearmX = THREE.MathUtils.lerp(forearmX, -0.18, t);
    forearmY = THREE.MathUtils.lerp(forearmY, 0.02, t);
    forearmZ = THREE.MathUtils.lerp(forearmZ, 0.03, t);
    wristX = THREE.MathUtils.lerp(wristX, 0.06, t);
    wristY = THREE.MathUtils.lerp(wristY, 0.02, t);
    wristZ = THREE.MathUtils.lerp(wristZ, -0.2, t);
    shoulderY += throwLateral * 0.24 * t * precision;
    forearmY += throwLateral * 0.14 * t * precision;
    wristY += throwLateral * 0.1 * t * precision;
  } else if (mode === 'reachToken') {
    shoulderX = THREE.MathUtils.lerp(shoulderX, -0.82, t);
    shoulderY = THREE.MathUtils.lerp(shoulderY, 0.06, t);
    shoulderZ = THREE.MathUtils.lerp(shoulderZ, -0.98, t);
    forearmX = THREE.MathUtils.lerp(forearmX, -0.78, t);
    forearmY = THREE.MathUtils.lerp(forearmY, -0.22, t);
    forearmZ = THREE.MathUtils.lerp(forearmZ, -0.26, t);
    wristX = THREE.MathUtils.lerp(wristX, -0.2, t);
    wristY = THREE.MathUtils.lerp(wristY, 0.2, t);
    wristZ = THREE.MathUtils.lerp(wristZ, -0.22, t);
  } else if (mode === 'gripToken') {
    shoulderX = THREE.MathUtils.lerp(shoulderX, -0.88, t);
    shoulderY = THREE.MathUtils.lerp(shoulderY, 0.02, t);
    shoulderZ = THREE.MathUtils.lerp(shoulderZ, -0.96, t);
    forearmX = THREE.MathUtils.lerp(forearmX, -0.84, t);
    forearmY = THREE.MathUtils.lerp(forearmY, -0.16, t);
    forearmZ = THREE.MathUtils.lerp(forearmZ, -0.12, t);
    wristX = THREE.MathUtils.lerp(wristX, -0.36, t);
    wristY = THREE.MathUtils.lerp(wristY, 0.1, t);
    wristZ = THREE.MathUtils.lerp(wristZ, -0.08, t);
  } else if (mode === 'carryToken') {
    shoulderX = THREE.MathUtils.lerp(shoulderX, -0.86, t);
    shoulderY = THREE.MathUtils.lerp(shoulderY, -0.02, t);
    shoulderZ = THREE.MathUtils.lerp(shoulderZ, -1.02, t);
    forearmX = THREE.MathUtils.lerp(forearmX, -0.62, t);
    forearmY = THREE.MathUtils.lerp(forearmY, -0.14, t);
    forearmZ = THREE.MathUtils.lerp(forearmZ, -0.16, t);
    wristX = THREE.MathUtils.lerp(wristX, -0.06, t);
    wristY = THREE.MathUtils.lerp(wristY, 0.08, t);
    wristZ = THREE.MathUtils.lerp(wristZ, -0.08, t);
  } else if (mode === 'placeToken') {
    shoulderX = THREE.MathUtils.lerp(shoulderX, -0.78, t);
    shoulderY = THREE.MathUtils.lerp(shoulderY, 0.03, t);
    shoulderZ = THREE.MathUtils.lerp(shoulderZ, -0.88, t);
    forearmX = THREE.MathUtils.lerp(forearmX, -0.98, t);
    forearmY = THREE.MathUtils.lerp(forearmY, -0.2, t);
    forearmZ = THREE.MathUtils.lerp(forearmZ, -0.34, t);
    wristX = THREE.MathUtils.lerp(wristX, -0.38, t);
    wristY = THREE.MathUtils.lerp(wristY, 0.14, t);
    wristZ = THREE.MathUtils.lerp(wristZ, -0.2, t);
  }

  if (SEATED_HUMAN_DOWNWARD_CONTACT_MODE_SET.has(mode)) {
    wristX = THREE.MathUtils.lerp(wristX, -1.05, t);
    wristY = THREE.MathUtils.lerp(wristY, -0.28, t);
    wristZ = THREE.MathUtils.lerp(wristZ, 0.52, t);
    forearmY = THREE.MathUtils.lerp(forearmY, -0.2, t);
    forearmZ = THREE.MathUtils.lerp(forearmZ, 0.28, t);
  }

  if (SEATED_HUMAN_DICE_CONTACT_MODE_SET.has(mode)) {
    wristX = THREE.MathUtils.lerp(wristX, -0.82, t);
    wristY = THREE.MathUtils.lerp(wristY, -0.08, t);
    wristZ = THREE.MathUtils.lerp(wristZ, 0.18, t);
    forearmY = THREE.MathUtils.lerp(forearmY, -0.24, t);
    forearmZ = THREE.MathUtils.lerp(forearmZ, 0.12, t);
  }

  if (bodyLockedMode && !isDiceReachMode) {
    chestX = 0.12;
    chestY = 0;
    headX = -0.06;
    headY = 0;
  }

  addBoneRot(rig, rig.chest, chestX, chestY, 0, 1);
  addBoneRot(rig, rig.head, headX, headY, 0, 1);
  if (rig.characterId === 'turi') {
    applyTuriSeatedPose(rig.root);
    if (rig.rightUpperArm) {
      rig.rightUpperArm.rotation.x += shoulderX - (chairSupportsArmrest ? -0.2 : -0.98);
      rig.rightUpperArm.rotation.y += shoulderY - (chairSupportsArmrest ? -0.02 : -0.03);
      rig.rightUpperArm.rotation.z += shoulderZ - (chairSupportsArmrest ? -0.72 : -0.06);
    }
    if (rig.rightForeArm) {
      rig.rightForeArm.rotation.x += forearmX - (chairSupportsArmrest ? -0.5 : -0.12);
      rig.rightForeArm.rotation.y += forearmY - (chairSupportsArmrest ? -0.04 : 0.02);
      rig.rightForeArm.rotation.z += forearmZ - (chairSupportsArmrest ? 0.14 : -0.08);
    }
  } else {
    addBoneRot(rig, rig.rightUpperArm, shoulderX, shoulderY, shoulderZ, 1);
    addBoneRot(rig, rig.rightForeArm, forearmX, forearmY, forearmZ, 1);
  }
  addBoneRot(rig, rig.rightHand, wristX, wristY, wristZ, 1);
  if (String(mode || '').startsWith('firearmAim')) {
    applyFirearmTriggerGrip(rig, handGrip);
    applyLeftHandGrip(rig, Math.max(0.72, handGrip * 0.96));
  } else {
    applyRightHandGrip(rig, handGrip);
  }
}
function alignSeatedHumanFeetToGroundPlane(actor, rig, clearance = SEATED_HUMAN_FOOT_GROUND_CLEARANCE) {
  if (!actor?.isObject3D) return;
  actor.updateMatrixWorld(true);
  const footBones = [rig?.leftFoot, rig?.rightFoot].filter((bone) => bone?.isBone);
  if (!footBones.length) return;
  let minFootY = Infinity;
  footBones.forEach((bone) => {
    const worldPos = bone.getWorldPosition(new THREE.Vector3());
    if (Number.isFinite(worldPos.y)) minFootY = Math.min(minFootY, worldPos.y);
  });
  if (!Number.isFinite(minFootY)) return;
  actor.position.y -= minFootY - clearance;
  actor.updateMatrixWorld(true);
}
export { applySeatedHumanPose as applyLudoSeatedHumanPose, alignSeatedHumanFeetToGroundPlane as alignLudoHumanFeet };

export function inferChairSupportsArmrest(stoolTheme) {
  const label = `${stoolTheme?.id || ''} ${stoolTheme?.label || ''}`.toLowerCase();
  if (!label) return true;
  if (/school|dining|plastic|monobloc|painted|gallinera/.test(label)) return false;
  if (/arm|lounge|barber|wheelchair|antique/.test(label)) return true;
  return true;
}
