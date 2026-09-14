import * as THREE from 'three';
import { createCheckersHumanActor, setCheckersHumanView, idleCheckersHuman, disposeCheckersHuman } from '../checkers/checkersHumanActors.ts';
import type { CheckersHumanActor } from '../checkers/checkersHumanActors.ts';
import { applySeatedBoardPose } from '../chess/seatedHumanRig.ts';
import { applyHandGrip, createPinchPose, applyPinchPose } from '../chess/anatomicalHand.ts';
import type { PinchPose } from '../chess/anatomicalHand.ts';
import { rotateJointToTarget } from '../chess/physicalPieceMove.ts';
import { advanceFourInRowDrop } from '../../utils/fourInRowMotion.ts';
import type { FourInRowDrop } from '../../utils/fourInRowMotion.ts';

export { idleCheckersHuman as idleFourInRowHuman, disposeCheckersHuman as disposeFourInRowHuman };
export type FourInRowHuman = CheckersHumanActor;
export type PlayerToken = 'player' | 'ai';
export const PICKUP_END = 0.52;
export const RELEASE_TIME = 1.62;
export const WITHDRAW_END = 2.12;
const smooth = (time: number, start: number, end: number) => {
  const t = THREE.MathUtils.clamp((time - start) / (end - start), 0, 1);
  return t * t * (3 - 2 * t);
};

export function createFourInRowHuman(template: THREE.Object3D, token: PlayerToken, tableRadius: number, tableY: number) {
  const height = tableRadius * 2.4;
  const entry = createCheckersHumanActor(template, {
    seat: token === 'player' ? 'bottom' : 'top',
    distance: tableRadius + height * 0.17 + 0.025,
    seatY: tableY - height * 0.08,
    height
  });
  entry.root.name = `four-in-row-human-${token}`;
  setCheckersHumanView(entry, '3d');
  return entry;
}

export function reserveCapacity(rows: number, columns: number) { return Math.ceil(rows * columns / 2); }
export function reserveCount(board: (PlayerToken | null)[][], token: PlayerToken) {
  return Math.max(0, reserveCapacity(board.length, board[0]?.length || 0) - board.flat().filter(cell => cell === token).length);
}

// Three real stacks per seat, drained from the top. A move's source is also the
// exact instance position, so the chip cannot jump from a decorative reserve.
export function reservePosition(index: number, token: PlayerToken, capacity: number, radius: number, thickness: number, tableY: number, tableRadius: number) {
  const perStack = Math.ceil(capacity / 3);
  const stack = Math.floor(index / perStack);
  const level = index % perStack;
  const side = token === 'player' ? 1 : -1;
  return new THREE.Vector3(side * (stack - 1) * radius * 3.1,
    tableY + thickness * (level + 0.5) + 0.006,
    side * tableRadius * 0.53);
}

export function createReserveInstances(prototype: THREE.Group, capacity: number, token: PlayerToken, radius: number, thickness: number, tableY: number, tableRadius: number) {
  const group = new THREE.Group();
  group.name = `four-in-row-reserve-${token}`;
  const matrix = new THREE.Matrix4();
  // The prototype is flat on the table; its children retain their local detail.
  for (const child of prototype.children as THREE.Mesh[]) {
    child.updateMatrix();
    const mesh = new THREE.InstancedMesh(child.geometry, child.material, capacity);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    for (let index = 0; index < capacity; index++) {
      matrix.makeTranslation(...reservePosition(index, token, capacity, radius, thickness, tableY, tableRadius).toArray());
      mesh.setMatrixAt(index, matrix.clone().multiply(child.matrix));
    }
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
  }
  return { group, setCount(count: number) {
    group.children.forEach(child => { (child as THREE.InstancedMesh).count = THREE.MathUtils.clamp(count, 0, capacity); });
  } };
}

export type HumanPlacement = FourInRowDrop & {
  token: PlayerToken;
  from: THREE.Vector3;
  motionTime: number;
  chipRadius: number;
  chipThickness: number;
  actor?: FourInRowHuman;
  pinch?: PinchPose | null;
  restHand?: THREE.Vector3;
  released?: boolean;
  dropFinished?: boolean;
  pose?: Map<THREE.Bone, THREE.Quaternion>;
};

export function sampleHumanPlacement(time: number, from: THREE.Vector3, columnTop: THREE.Vector3, radius: number) {
  // Lift clear of the upright rack before travelling toward its opening.
  const position = from.clone();
  const lift = smooth(time, PICKUP_END, 0.94);
  const carry = smooth(time, 0.94, 1.48);
  const travelY = columnTop.y + radius * 1.8;
  position.y = THREE.MathUtils.lerp(from.y, travelY, lift);
  position.x = THREE.MathUtils.lerp(from.x, columnTop.x, carry);
  position.z = THREE.MathUtils.lerp(from.z, columnTop.z, carry);
  position.y = THREE.MathUtils.lerp(position.y, columnTop.y, smooth(time, 1.48, RELEASE_TIME));
  const grip = smooth(time, 0.34, PICKUP_END) * (1 - smooth(time, 1.56, RELEASE_TIME));
  const reach = smooth(time, 0, 0.34) * (1 - smooth(time, 1.72, WITHDRAW_END));
  return { position, grip, reach, angle: Math.PI / 2 * smooth(time, 0.65, 0.94), released: time >= RELEASE_TIME };
}

function poseHand(entry: HumanPlacement, frame: ReturnType<typeof sampleHumanPlacement>) {
  const actor = entry.actor;
  if (!actor?.rig.rightHand || !entry.mesh.parent) return;
  const { rig } = actor;
  const hand = rig.rightHand!;
  applySeatedBoardPose(rig, 'reachPiece', frame.reach, frame.grip,
    { forwardReach: 0.65, sideReach: frame.position.x / Math.max(entry.chipRadius * 12, 0.01) * (actor.seat === 'bottom' ? 1 : -1) });
  const chain = [rig.rightForeArm, rig.rightUpperArm, rig.rightUpperArm?.parent, rig.chest, rig.chest?.parent, rig.spine, rig.hips]
    .filter((bone): bone is THREE.Bone => Boolean(bone && (bone as THREE.Bone).isBone));
  // Warm-start CCD from the previous frame to preserve continuous shoulders and
  // converge on distant slots without spending every frame on a fresh solve.
  for (const bone of chain) {
    const previous = entry.pose?.get(bone);
    if (previous) bone.quaternion.slerp(previous, frame.reach * 0.98);
  }
  actor.root.updateWorldMatrix(true, true);
  if (!entry.pinch) entry.pinch = createPinchPose(rig, entry.chipThickness * 0.45);
  applyHandGrip(rig, 'right', frame.grip);
  if (entry.pinch) applyPinchPose(entry.pinch, frame.grip);
  const anchor = entry.pinch?.anchor || new THREE.Vector3();
  const pinchPosition = () => hand.localToWorld(anchor.clone());
  if (!entry.restHand) entry.restHand = pinchPosition();
  // Pinch the upper edge as the chip turns upright, then keep the open hand at
  // the slot during release. The falling chip is no longer attached to the hand.
  const contact = new THREE.Vector3(0, entry.chipThickness * 0.45, -entry.chipRadius * 0.82)
    .applyAxisAngle(new THREE.Vector3(1, 0, 0), frame.angle).add(frame.position);
  entry.mesh.parent.localToWorld(contact);
  contact.lerpVectors(entry.restHand, contact, frame.reach);
  const tolerance = entry.chipRadius * 0.025;
  for (let iteration = 0; iteration < 128; iteration++) {
    for (const joint of [rig.rightForeArm, rig.rightUpperArm]) if (joint) rotateJointToTarget(joint, pinchPosition(), contact);
    if (pinchPosition().distanceTo(contact) <= tolerance) break;
    const shoulder = rig.rightUpperArm?.parent;
    if (shoulder && (shoulder as THREE.Bone).isBone && shoulder !== rig.chest) rotateJointToTarget(shoulder as THREE.Bone, pinchPosition(), contact, 0.45);
    const middleSpine = rig.chest?.parent;
    if (middleSpine && (middleSpine as THREE.Bone).isBone && middleSpine !== rig.spine) rotateJointToTarget(middleSpine as THREE.Bone, pinchPosition(), contact, 0.22);
    if (rig.chest) rotateJointToTarget(rig.chest, pinchPosition(), contact, 0.35);
    if (rig.spine && rig.spine !== rig.chest) rotateJointToTarget(rig.spine, pinchPosition(), contact, 0.16);
    if (rig.hips) rotateJointToTarget(rig.hips, pinchPosition(), contact, 0.08);
  }
  entry.pose ||= new Map();
  for (const bone of chain) entry.pose.set(bone, bone.quaternion.clone());
}

export function advanceHumanPlacement(entry: HumanPlacement, delta: number) {
  const before = entry.motionTime;
  entry.motionTime += Math.max(0, delta);
  const frame = sampleHumanPlacement(entry.motionTime, entry.from, entry.columnTop, entry.chipRadius);
  if (!entry.released) {
    entry.mesh.position.copy(frame.position);
    entry.mesh.rotation.set(frame.angle, 0, 0);
  }
  poseHand(entry, frame);
  let landed = false;
  if (frame.released) {
    entry.released = true;
    const dropDelta = entry.motionTime - Math.max(before, RELEASE_TIME);
    if (!entry.dropFinished) {
      const result = advanceFourInRowDrop(entry, dropDelta);
      landed = result.landed;
      entry.dropFinished = result.finished;
    }
  }
  const finished = Boolean(entry.dropFinished && entry.motionTime >= WITHDRAW_END);
  if (finished && entry.actor) idleCheckersHuman(entry.actor);
  return { landed, finished };
}

export function playerEyePosition(actor: FourInRowHuman, arena: THREE.Object3D) {
  idleCheckersHuman(actor);
  actor.root.updateWorldMatrix(true, true);
  const { leftEye, rightEye, head } = actor.rig;
  const position = leftEye && rightEye
    ? leftEye.getWorldPosition(new THREE.Vector3()).lerp(rightEye.getWorldPosition(new THREE.Vector3()), 0.5)
    : (head?.getWorldPosition(new THREE.Vector3()) || actor.root.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 1, 0)))
      .add(new THREE.Vector3(0, 0.08, -0.04));
  return arena.worldToLocal(position);
}

export function portraitBoardFov(aspect: number, boardWidth: number, distance: number) {
  return Math.max(48, THREE.MathUtils.radToDeg(2 * Math.atan((boardWidth * 0.65) / (Math.max(0.1, distance) * Math.max(0.2, aspect)))));
}
