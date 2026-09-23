import * as THREE from 'three';
import { applyHandGrip, applyPinchPose, calibrateHandRig, createPinchPose } from '../games/chess/anatomicalHand.ts';
import type { HandBoneRig, PinchPose } from '../games/chess/anatomicalHand.ts';
import { rotateJointToTarget } from '../games/chess/physicalPieceMove.ts';

type DiceRig = HandBoneRig & {
  rightUpperArm?: THREE.Bone;
  rightForeArm?: THREE.Bone;
  chest?: THREE.Bone;
  spine?: THREE.Bone;
};
const V = () => new THREE.Vector3();
const Q = () => new THREE.Quaternion();
const smooth = (value: number) => {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
const phase = (ms: number, from: number, to: number) => smooth((ms - from) / (to - from));

export const LUDO_DICE_TIMING = Object.freeze({
  reach: 280, close: 440, lift: 660, windup: 840, release: 1040, follow: 1200, end: 1580
});

export type LudoDiceHand = {
  rig: DiceRig;
  pinch?: PinchPose;
  radius: number;
};

// Calibrate once in the imported bind pose, exactly as the Checkers hands do.
// Some Ludo imports include a fourth terminal marker; it is not a finger joint.
export function createLudoDiceHand(source: DiceRig): LudoDiceHand {
  const rig = { ...source };
  for (const digit of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'] as const) {
    const key = `right${digit}` as const;
    rig[key] = source[key]?.slice(0, 3);
  }
  calibrateHandRig(rig);
  return { rig, radius: 0 };
}

export type DiceContact = {
  binding: LudoDiceHand;
  anchor: THREE.Vector3;
  rest: THREE.Vector3;
  restQ: THREE.Quaternion;
  gripQ: THREE.Quaternion;
  size: number;
};

export function createLudoDiceContact(binding: LudoDiceHand, dice: THREE.Object3D, size: number): DiceContact | undefined {
  const { rig } = binding;
  const hand = rig.rightHand;
  if (!hand || !rig.rightUpperArm || !rig.rightForeArm || !dice.parent) return;
  hand.updateWorldMatrix(true, true);
  dice.updateWorldMatrix(true, true);
  const worldSize = size * Math.abs(dice.getWorldScale(V()).x);
  if (!binding.pinch || Math.abs(binding.radius - worldSize / 2) > 1e-6) {
    binding.radius = worldSize / 2;
    binding.pinch = createPinchPose(rig, binding.radius);
  }
  // An incomplete model can still reach with its wrist without inventing joints.
  const anchor = binding.pinch?.anchor.clone() || V();
  const restQ = hand.getWorldQuaternion(Q());
  const gripQ = restQ.clone();
  const profile = calibrateHandRig(rig).right;
  if (profile && binding.pinch) {
    // A pinch axis runs from index tip to thumb tip, NOT across the knuckles.
    // Using it as the palm's lateral axis reversed this model's wrist. Build an
    // anatomical palm frame instead: fingers toward the die, palm toward table.
    const fingers = profile.forward.clone().normalize();
    const lateral = profile.radial.clone().projectOnPlane(fingers).normalize();
    const local = Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(lateral, fingers, lateral.clone().cross(fingers)));
    const forward = dice.getWorldPosition(V()).sub(rig.rightUpperArm.getWorldPosition(V())).setY(0);
    if (forward.lengthSq() < 1e-8) forward.copy(fingers).applyQuaternion(restQ).setY(0);
    if (forward.lengthSq() < 1e-8) forward.set(0, 0, 1);
    forward.normalize();
    const right = forward.clone().cross(new THREE.Vector3(0, -1, 0)).normalize();
    // A slight downward pitch keeps the wrist relaxed as the pads close.
    forward.y = -0.2;
    forward.normalize();
    gripQ.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, forward, right.clone().cross(forward)))
      .multiply(local.invert()).normalize();
  }
  return { binding, anchor, rest: hand.localToWorld(anchor.clone()), restQ, gripQ, size: worldSize };
}

// Only rotations change: imported arm and finger lengths remain intact.
// The die is never translated to compensate for an inaccurate hand helper.
export function poseLudoDiceContact(contact: DiceContact, target: THREE.Vector3, reach: number, grip: number) {
  const { binding: { rig, pinch }, anchor, rest, restQ, gripQ, size } = contact;
  const hand = rig.rightHand!;
  applyHandGrip(rig, 'right', grip * 0.65);
  if (pinch) applyPinchPose(pinch, grip);
  const desiredQ = restQ.clone().slerp(gripQ, reach);
  const aim = rest.clone().lerp(target, reach);
  aim.y += Math.sin(reach * Math.PI) * size * 1.3;
  const position = () => hand.localToWorld(anchor.clone());
  const orient = () => {
    hand.quaternion.copy(hand.parent!.getWorldQuaternion(Q()).invert().multiply(desiredQ));
    hand.updateWorldMatrix(false, true);
  };
  orient();
  const tolerance = Math.max(size * 0.015, 1e-5);
  for (let i = 0; i < 64; i++) {
    for (const joint of [rig.rightForeArm, rig.rightUpperArm]) {
      if (joint) { rotateJointToTarget(joint, position(), aim); orient(); }
    }
    if (position().distanceTo(aim) <= tolerance) break;
    // A small torso reach lets distant placements work without stretching arms.
    if (rig.chest) { rotateJointToTarget(rig.chest, position(), aim, 0.18); orient(); }
    if (rig.spine && rig.spine !== rig.chest) { rotateJointToTarget(rig.spine, position(), aim, 0.08); orient(); }
  }
}

export function sampleLudoDiceThrow(ms: number, start: THREE.Vector3, forward: THREE.Vector3, size: number) {
  const t = LUDO_DICE_TIMING;
  const lift = phase(ms, t.close, t.lift);
  const wind = phase(ms, t.lift, t.windup);
  const push = phase(ms, t.windup, t.release);
  const follow = phase(ms, t.release, t.follow);
  const position = start.clone().addScaledVector(forward, size * (-1.1 * wind + 2.5 * push + 0.65 * follow));
  position.y += size * (1.65 * lift + 0.35 * wind + 0.35 * push + 0.1 * follow);
  return {
    position,
    reach: phase(ms, 0, t.reach) * (1 - phase(ms, t.follow, t.end)),
    grip: phase(ms, t.reach, t.close) * (1 - phase(ms, t.release - 80, t.release + 60)),
    attached: ms >= t.close && ms <= t.release,
    released: ms >= t.release,
    done: ms >= t.end
  };
}

export function createLudoDiceThrow(contact: DiceContact, dice: THREE.Object3D, destination: THREE.Vector3, initialGrip = 0) {
  const start = dice.getWorldPosition(V());
  const forward = dice.parent!.localToWorld(destination.clone()).sub(start).setY(0);
  if (forward.lengthSq() < 1e-8) forward.copy(start).sub(contact.rest).setY(0);
  if (forward.lengthSq() < 1e-8) forward.set(0, 0, 1);
  forward.normalize();
  const hand = contact.binding.rig.rightHand!;
  return {
    contact, dice, start, forward, released: false, initialGrip,
    approach: { ...contact, rest: hand.localToWorld(contact.anchor.clone()), restQ: hand.getWorldQuaternion(Q()) }
  };
}

export type LudoDiceThrow = ReturnType<typeof createLudoDiceThrow>;

// One sample drives the fingers, arm and held die. Once released, only the
// existing dice flight owns its transform; follow-through cannot pull it back.
export function updateLudoDiceThrow(action: LudoDiceThrow, elapsedMs: number) {
  const { contact, dice, start, forward } = action;
  const frame = sampleLudoDiceThrow(elapsedMs, start, forward, contact.size);
  if (elapsedMs < LUDO_DICE_TIMING.close) {
    frame.grip = THREE.MathUtils.lerp(action.initialGrip, 1, phase(elapsedMs, LUDO_DICE_TIMING.reach, LUDO_DICE_TIMING.close));
  }
  if (!action.released && dice.parent) {
    // Clamp to the exact release sample even after a dropped/background frame.
    const held = sampleLudoDiceThrow(Math.min(elapsedMs, LUDO_DICE_TIMING.release), start, forward, contact.size);
    dice.position.copy(dice.parent.worldToLocal(held.position));
  }
  poseLudoDiceContact(elapsedMs <= LUDO_DICE_TIMING.reach ? action.approach : contact, frame.position, frame.reach, frame.grip);
  action.released ||= frame.released;
  return frame;
}
