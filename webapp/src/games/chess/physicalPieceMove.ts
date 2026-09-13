import * as THREE from 'three';
import {
  applyHandGrip,
  applyPinchPose,
  createPinchPose
} from './anatomicalHand.ts';
import type { HandBoneRig, PinchPose } from './anatomicalHand.ts';
export { tipPosition } from './anatomicalHand.ts';

export const PHYSICAL_MOVE_DURATION_MS = 1600;
export type FingerRig = HandBoneRig & {
  rightUpperArm?: THREE.Bone;
  rightForeArm?: THREE.Bone;
  rightHand?: THREE.Bone;
  rightThumb?: THREE.Bone[];
  rightIndex?: THREE.Bone[];
  rightMiddle?: THREE.Bone[];
  chest?: THREE.Bone;
  spine?: THREE.Bone;
};
const smooth = (v: number) => {
  const t = THREE.MathUtils.clamp(v, 0, 1);
  return t * t * (3 - 2 * t);
};
const phase = (u: number, a: number, b: number) => smooth((u - a) / (b - a));

export const normalizeRigBoneName = (name = '') =>
  String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/(left|right)hand(?=thumb|index|middle|ring|pinky)/g, '$1');

// One clock owns both hand and piece. In particular, the piece remains on the
// board until the fingers close, and the fingers open only after touchdown.
export function samplePhysicalMove(
  u: number,
  from: THREE.Vector3,
  to: THREE.Vector3,
  clearance: number
) {
  u = THREE.MathUtils.clamp(u, 0, 1);
  const position = from.clone().lerp(to, phase(u, 0.43, 0.7));
  position.y += clearance * phase(u, 0.3, 0.43) * (1 - phase(u, 0.7, 0.82));
  const grip = phase(u, 0.2, 0.3) * (1 - phase(u, 0.82, 0.9));
  const reach = phase(u, 0, 0.2) * (1 - phase(u, 0.9, 1));
  return {
    position,
    grip,
    reach,
    attached: u >= 0.3 && u < 0.82,
    done: u >= 1
  };
}

// CCD works in world space, but each bone stores a rotation relative to its
// parent. Conjugate the world delta into that parent frame (including the
// opposite player's 180-degree seat rotation) before applying it.
export function rotateJointToTarget(
  bone: THREE.Bone,
  effector: THREE.Vector3,
  target: THREE.Vector3,
  strength = 1
) {
  bone.updateWorldMatrix(true, false);
  const origin = bone.getWorldPosition(new THREE.Vector3());
  const from = effector.clone().sub(origin),
    to = target.clone().sub(origin);
  if (from.lengthSq() < 1e-12 || to.lengthSq() < 1e-12) return;
  const worldDelta = new THREE.Quaternion().setFromUnitVectors(
    from.normalize(),
    to.normalize()
  );
  const angle = 2 * Math.acos(THREE.MathUtils.clamp(worldDelta.w, -1, 1));
  const boundedStrength = Math.min(strength, angle > 0 ? 0.35 / angle : 1);
  worldDelta.slerp(new THREE.Quaternion(), 1 - boundedStrength);
  const parent =
    bone.parent?.getWorldQuaternion(new THREE.Quaternion()) ||
    new THREE.Quaternion();
  const localDelta = parent
    .clone()
    .invert()
    .multiply(worldDelta)
    .multiply(parent);
  bone.quaternion.premultiply(localDelta).normalize();
  bone.updateWorldMatrix(false, true);
}

export type PhysicalMoveAction = {
  mesh: THREE.Object3D;
  from: THREE.Vector3;
  to: THREE.Vector3;
  gripHeight?: number;
  gripRadius?: number;
  restHandWorld?: THREE.Vector3;
  gripAnchorLocal?: THREE.Vector3;
  pinchPose?: PinchPose;
};

export function updatePhysicalPieceMove(
  rig: FingerRig,
  action: PhysicalMoveAction,
  u: number,
  clearance: number
) {
  const { mesh } = action;
  if (!mesh.parent || !rig.rightHand) return;
  const hand = rig.rightHand;
  hand.updateWorldMatrix(true, true);
  if (action.gripHeight === undefined) {
    mesh.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(mesh);
    const size = box.getSize(new THREE.Vector3());
    const scale = mesh.parent.getWorldScale(new THREE.Vector3());
    action.gripHeight = (size.y * 0.64) / Math.max(Math.abs(scale.y), 1e-6);
    action.gripRadius = Math.max(0.004, Math.min(size.x, size.z) * 0.18);
  }
  const frame = samplePhysicalMove(u, action.from, action.to, clearance);
  mesh.position.copy(frame.position);
  mesh.updateWorldMatrix(true, true);
  const contact = mesh.parent.localToWorld(
    frame.position.clone().add(new THREE.Vector3(0, action.gripHeight, 0))
  );
  if (!action.gripAnchorLocal) {
    action.pinchPose = createPinchPose(rig, action.gripRadius || 0.01);
    action.gripAnchorLocal =
      action.pinchPose?.anchor.clone() || new THREE.Vector3();
  }
  applyHandGrip(rig, 'right', frame.grip);
  if (action.pinchPose) applyPinchPose(action.pinchPose, frame.grip);
  const pinchPosition = () =>
    hand.localToWorld(action.gripAnchorLocal!.clone());
  if (!action.restHandWorld) action.restHandWorld = pinchPosition();
  const pinchTarget = action.restHandWorld.clone().lerp(contact, frame.reach);
  const tolerance = 0.001 * Math.abs(hand.getWorldScale(new THREE.Vector3()).x);
  for (let iteration = 0; iteration < 128; iteration++) {
    for (const joint of [rig.rightForeArm, rig.rightUpperArm]) {
      if (joint) rotateJointToTarget(joint, pinchPosition(), pinchTarget);
    }
    if (pinchPosition().distanceTo(pinchTarget) > tolerance) {
      if (rig.chest)
        rotateJointToTarget(rig.chest, pinchPosition(), pinchTarget, 0.35);
      if (rig.spine && rig.spine !== rig.chest)
        rotateJointToTarget(rig.spine, pinchPosition(), pinchTarget, 0.16);
    } else {
      break;
    }
  }
  return frame;
}
