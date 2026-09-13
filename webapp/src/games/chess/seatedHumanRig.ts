import * as THREE from 'three';
import { calibrateHandRig, applyHandGrip } from './anatomicalHand.ts';
import { normalizeRigBoneName } from './physicalPieceMove.ts';
const clamp01 = (v: number | undefined, fallback = 0) => Number.isFinite(v) ? THREE.MathUtils.clamp(v!, 0, 1) : fallback;
const smooth01 = (v: number) => { const t = clamp01(v); return t * t * (3 - 2 * t); };
const SEATED_HUMAN_REACH_FORWARD_GAIN = 0.5;
const SEATED_HUMAN_REACH_SIDE_GAIN = 0.3;
export type SeatedHumanRig = ReturnType<typeof saveBoneRig>;

function normalizeBoneName(name: string = '') {
  return normalizeRigBoneName(name);
}

function findBoneByNeedle(bones: THREE.Bone[], ...needles: string[]) {
  const normalized = bones.map((bone) => ({ bone, name: normalizeBoneName(bone.name) }));
  for (const needle of needles) {
    const clean = normalizeBoneName(needle);
    const exact = normalized.find((entry) => entry.name === clean);
    if (exact) return exact.bone;
    const partial = normalized.find((entry) => entry.name.includes(clean));
    if (partial) return partial.bone;
  }
  return undefined;
}

export function saveBoneRig(modelRoot: THREE.Object3D) {
  const bones: THREE.Bone[] = [];
  modelRoot?.traverse?.((obj) => {
    if ((obj as THREE.Bone).isBone) bones.push(obj as THREE.Bone);
  });
  const saved = new Map();
  bones.forEach((bone) => {
    saved.set(bone, {
      rotation: bone.rotation.clone(),
      position: bone.position.clone()
    });
  });
  const rig = {
    saved,
    hips: findBoneByNeedle(bones, 'hips', 'pelvis'),
    spine: findBoneByNeedle(bones, 'spine'),
    chest: findBoneByNeedle(bones, 'spine2', 'chest', 'upperchest'),
    neck: findBoneByNeedle(bones, 'neck'),
    head: findBoneByNeedle(bones, 'head'),
    leftEye: findBoneByNeedle(bones, 'lefteye', 'eye_l', 'l_eye'),
    rightEye: findBoneByNeedle(bones, 'righteye', 'eye_r', 'r_eye'),
    leftUpperLeg: findBoneByNeedle(bones, 'leftupleg', 'leftthigh', 'leftupperleg'),
    leftLowerLeg: findBoneByNeedle(bones, 'leftleg', 'leftlowerleg', 'leftcalf'),
    leftFoot: findBoneByNeedle(bones, 'leftfoot'),
    rightUpperLeg: findBoneByNeedle(bones, 'rightupleg', 'rightthigh', 'rightupperleg'),
    rightLowerLeg: findBoneByNeedle(bones, 'rightleg', 'rightlowerleg', 'rightcalf'),
    rightFoot: findBoneByNeedle(bones, 'rightfoot'),
    leftUpperArm: findBoneByNeedle(bones, 'leftarm', 'leftupperarm'),
    leftForeArm: findBoneByNeedle(bones, 'leftforearm', 'leftlowerarm'),
    leftHand: findBoneByNeedle(bones, 'lefthand'),
    leftThumb: [
      findBoneByNeedle(bones, 'leftthumb1'),
      findBoneByNeedle(bones, 'leftthumb2'),
      findBoneByNeedle(bones, 'leftthumb3')
    ].filter((bone): bone is THREE.Bone => Boolean(bone)),
    leftIndex: [
      findBoneByNeedle(bones, 'leftindex1'),
      findBoneByNeedle(bones, 'leftindex2'),
      findBoneByNeedle(bones, 'leftindex3')
    ].filter((bone): bone is THREE.Bone => Boolean(bone)),
    leftMiddle: [
      findBoneByNeedle(bones, 'leftmiddle1'),
      findBoneByNeedle(bones, 'leftmiddle2'),
      findBoneByNeedle(bones, 'leftmiddle3')
    ].filter((bone): bone is THREE.Bone => Boolean(bone)),
    leftRing: [
      findBoneByNeedle(bones, 'leftring1'),
      findBoneByNeedle(bones, 'leftring2'),
      findBoneByNeedle(bones, 'leftring3')
    ].filter((bone): bone is THREE.Bone => Boolean(bone)),
    leftPinky: [
      findBoneByNeedle(bones, 'leftpinky1'),
      findBoneByNeedle(bones, 'leftpinky2'),
      findBoneByNeedle(bones, 'leftpinky3')
    ].filter((bone): bone is THREE.Bone => Boolean(bone)),
    rightUpperArm: findBoneByNeedle(bones, 'rightarm', 'rightupperarm'),
    rightForeArm: findBoneByNeedle(bones, 'rightforearm', 'rightlowerarm'),
    rightHand: findBoneByNeedle(bones, 'righthand'),
    rightThumb: [
      findBoneByNeedle(bones, 'rightthumb1'),
      findBoneByNeedle(bones, 'rightthumb2'),
      findBoneByNeedle(bones, 'rightthumb3')
    ].filter((bone): bone is THREE.Bone => Boolean(bone)),
    rightIndex: [
      findBoneByNeedle(bones, 'rightindex1'),
      findBoneByNeedle(bones, 'rightindex2'),
      findBoneByNeedle(bones, 'rightindex3')
    ].filter((bone): bone is THREE.Bone => Boolean(bone)),
    rightMiddle: [
      findBoneByNeedle(bones, 'rightmiddle1'),
      findBoneByNeedle(bones, 'rightmiddle2'),
      findBoneByNeedle(bones, 'rightmiddle3')
    ].filter((bone): bone is THREE.Bone => Boolean(bone)),
    rightRing: [
      findBoneByNeedle(bones, 'rightring1'),
      findBoneByNeedle(bones, 'rightring2'),
      findBoneByNeedle(bones, 'rightring3')
    ].filter((bone): bone is THREE.Bone => Boolean(bone)),
    rightPinky: [
      findBoneByNeedle(bones, 'rightpinky1'),
      findBoneByNeedle(bones, 'rightpinky2'),
      findBoneByNeedle(bones, 'rightpinky3')
    ].filter((bone): bone is THREE.Bone => Boolean(bone))
  };
  calibrateHandRig(rig);
  return rig;
}

export function resetBoneRig(rig: SeatedHumanRig) {
  if (!rig?.saved) return;
  rig.saved.forEach((pose, bone) => {
    bone.rotation.copy(pose.rotation);
    bone.position.copy(pose.position);
  });
}

export function addBoneRot(rig: SeatedHumanRig, bone: THREE.Bone | undefined, x = 0, y = 0, z = 0) {
  if (!rig || !bone) return;
  const base = rig.saved.get(bone);
  if (!base) return;
  bone.rotation.x = base.rotation.x + x;
  bone.rotation.y = base.rotation.y + y;
  bone.rotation.z = base.rotation.z + z;
}

export function addBonePos(rig: SeatedHumanRig, bone: THREE.Bone | undefined, x = 0, y = 0, z = 0) {
  if (!rig || !bone) return;
  const base = rig.saved.get(bone);
  if (!base) return;
  bone.position.x = base.position.x + x;
  bone.position.y = base.position.y + y;
  bone.position.z = base.position.z + z;
}

export function applySeatedBoardPose(rig: SeatedHumanRig, mode = 'idle', intensity = 1, handGrip = 0, motionProfile: { forwardReach?: number; sideReach?: number } | null = null) {
  if (!rig) return;
  resetBoneRig(rig);
  const t = smooth01(intensity);
  const breathe = Math.sin(performance.now() * 0.002) * 0.01;

  // Baseline pose tuned to match the seated portrait reference:
  // upright torso, shoulders open, both arms spread and hovering over chair arms.
  addBonePos(rig, rig.hips, 0, -0.332, -0.052);
  addBoneRot(rig, rig.hips, -0.02, 0, 0);
  addBoneRot(rig, rig.spine, 0.1 + breathe * 0.5, 0, 0);
  addBoneRot(rig, rig.chest, 0.08 + breathe * 0.35, 0, 0);
  addBoneRot(rig, rig.neck, -0.02, 0, 0);
  addBoneRot(rig, rig.head, -0.03, 0, 0);

  addBoneRot(rig, rig.leftUpperLeg, -1.42, 0.08, 0.02);
  addBoneRot(rig, rig.leftLowerLeg, -1.42, 0.01, 0.01);
  addBoneRot(rig, rig.leftFoot, 0.14, 0.04, 0.02);
  addBoneRot(rig, rig.rightUpperLeg, -1.42, 0.01, -0.02);
  addBoneRot(rig, rig.rightLowerLeg, -1.42, -0.01, -0.01);
  addBoneRot(rig, rig.rightFoot, 0.14, -0.03, -0.02);

  addBoneRot(rig, rig.leftUpperArm, -0.36, 0.1, 1.02);
  addBoneRot(rig, rig.leftForeArm, -0.56, 0.06, -0.22);
  addBoneRot(rig, rig.leftHand, -0.14, 0.02, 0.02);
  let shoulderX = -0.36;
  let shoulderY = -0.03;
  let shoulderZ = -1.02;
  let forearmX = -0.56;
  let forearmY = -0.06;
  let forearmZ = 0.22;
  let wristX = -0.14;
  let wristY = 0.02;
  let wristZ = 0.02;
  let chestX = 0.16;
  let headX = -0.03;
  const rightHandGrip = handGrip;
  const forwardReach = clamp01(motionProfile?.forwardReach, 0);
  const sideReach = THREE.MathUtils.clamp(motionProfile?.sideReach ?? 0, -1, 1);

  if (mode === 'reachPiece') {
    shoulderX = THREE.MathUtils.lerp(shoulderX, -0.92, t);
    shoulderY = THREE.MathUtils.lerp(shoulderY, 0.06, t);
    shoulderZ = THREE.MathUtils.lerp(shoulderZ, -1.18, t);
    forearmX = THREE.MathUtils.lerp(forearmX, -0.74, t);
    forearmY = THREE.MathUtils.lerp(forearmY, -0.2, t);
    forearmZ = THREE.MathUtils.lerp(forearmZ, -0.28, t);
    wristX = THREE.MathUtils.lerp(wristX, -0.18, t);
    wristY = THREE.MathUtils.lerp(wristY, 0.16, t);
    wristZ = THREE.MathUtils.lerp(wristZ, -0.22, t);
    chestX = THREE.MathUtils.lerp(chestX, 0.28, t);
    headX = THREE.MathUtils.lerp(headX, 0.07, t);
  } else if (mode === 'gripPiece') {
    shoulderX = THREE.MathUtils.lerp(shoulderX, -0.96, t);
    shoulderY = THREE.MathUtils.lerp(shoulderY, 0.06, t);
    shoulderZ = THREE.MathUtils.lerp(shoulderZ, -1.12, t);
    forearmX = THREE.MathUtils.lerp(forearmX, -0.82, t);
    forearmY = THREE.MathUtils.lerp(forearmY, -0.18, t);
    forearmZ = THREE.MathUtils.lerp(forearmZ, -0.2, t);
    wristX = THREE.MathUtils.lerp(wristX, -0.26, t);
    wristY = THREE.MathUtils.lerp(wristY, 0.16, t);
    wristZ = THREE.MathUtils.lerp(wristZ, -0.16, t);
    chestX = THREE.MathUtils.lerp(chestX, 0.31, t);
    headX = THREE.MathUtils.lerp(headX, 0.09, t);
  } else if (mode === 'carryPiece') {
    shoulderX = THREE.MathUtils.lerp(shoulderX, -0.98, t);
    shoulderY = THREE.MathUtils.lerp(shoulderY, -0.02, t);
    shoulderZ = THREE.MathUtils.lerp(shoulderZ, -1.16, t);
    forearmX = THREE.MathUtils.lerp(forearmX, -0.62, t);
    forearmY = THREE.MathUtils.lerp(forearmY, -0.14, t);
    forearmZ = THREE.MathUtils.lerp(forearmZ, -0.09, t);
    wristX = THREE.MathUtils.lerp(wristX, -0.02, t);
    wristY = THREE.MathUtils.lerp(wristY, 0.14, t);
    wristZ = THREE.MathUtils.lerp(wristZ, -0.1, t);
    chestX = THREE.MathUtils.lerp(chestX, 0.27, t);
    headX = THREE.MathUtils.lerp(headX, 0.05, t);
  } else if (mode === 'placePiece') {
    shoulderX = THREE.MathUtils.lerp(shoulderX, -0.86, t);
    shoulderY = THREE.MathUtils.lerp(shoulderY, 0.02, t);
    shoulderZ = THREE.MathUtils.lerp(shoulderZ, -1.02, t);
    forearmX = THREE.MathUtils.lerp(forearmX, -0.88, t);
    forearmY = THREE.MathUtils.lerp(forearmY, -0.2, t);
    forearmZ = THREE.MathUtils.lerp(forearmZ, -0.28, t);
    wristX = THREE.MathUtils.lerp(wristX, -0.28, t);
    wristY = THREE.MathUtils.lerp(wristY, 0.14, t);
    wristZ = THREE.MathUtils.lerp(wristZ, -0.2, t);
    chestX = THREE.MathUtils.lerp(chestX, 0.3, t);
    headX = THREE.MathUtils.lerp(headX, 0.11, t);
  }

  const reachForwardDelta = forwardReach * SEATED_HUMAN_REACH_FORWARD_GAIN;
  const reachSideDelta = sideReach * SEATED_HUMAN_REACH_SIDE_GAIN;
  shoulderX = THREE.MathUtils.lerp(shoulderX, shoulderX - reachForwardDelta, t);
  shoulderY = THREE.MathUtils.lerp(shoulderY, shoulderY + reachSideDelta * 0.32, t);
  shoulderZ = THREE.MathUtils.lerp(shoulderZ, shoulderZ - reachSideDelta * 0.5, t);
  forearmX = THREE.MathUtils.lerp(forearmX, forearmX - reachForwardDelta * 0.88, t);
  forearmY = THREE.MathUtils.lerp(forearmY, forearmY + reachSideDelta * 0.22, t);
  forearmZ = THREE.MathUtils.lerp(forearmZ, forearmZ - reachSideDelta * 0.36, t);
  wristY = THREE.MathUtils.lerp(wristY, wristY + reachSideDelta * 0.2, t);
  wristZ = THREE.MathUtils.lerp(wristZ, wristZ - reachSideDelta * 0.16, t);
  chestX = THREE.MathUtils.lerp(chestX, chestX + reachForwardDelta * 0.5, t);
  headX = THREE.MathUtils.lerp(headX, headX + reachForwardDelta * 0.22, t);

  addBoneRot(rig, rig.chest, chestX, 0, 0);
  addBoneRot(rig, rig.head, headX, 0, 0);
  addBoneRot(rig, rig.rightUpperArm, shoulderX, shoulderY, shoulderZ);
  addBoneRot(rig, rig.rightForeArm, forearmX, forearmY, forearmZ);
  addBoneRot(rig, rig.rightHand, wristX, wristY, wristZ);
  applyHandGrip(rig, 'right', rightHandGrip);
}

