import * as THREE from 'three';
import { saveBoneRig, applySeatedHumanPose } from './generated/rig';

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Q = () => new THREE.Quaternion();
export const smooth = (t: number) => { t = THREE.MathUtils.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export type Rig = ReturnType<typeof saveBoneRig>;
export const world = (o: THREE.Object3D) => o.getWorldPosition(V());
function setWorldQ(bone: THREE.Object3D, q: THREE.Quaternion) {
  bone.quaternion.copy(bone.parent!.getWorldQuaternion(Q()).invert().multiply(q));
  bone.updateWorldMatrix(false, true);
}
function pointBone(bone: THREE.Bone, child: THREE.Bone, point: THREE.Vector3) {
  const p = world(bone), old = world(child).sub(p).normalize(), next = point.clone().sub(p).normalize();
  setWorldQ(bone, Q().setFromUnitVectors(old, next).multiply(bone.getWorldQuaternion(Q())));
}
export function palmMarker(rig: Rig, side: 'right' | 'left') {
  const hand = rig[side + 'Hand'] as THREE.Bone;
  const mid = rig[side + 'Middle'][0] as THREE.Bone;
  const marker = new THREE.Object3D();
  marker.position.copy(hand.worldToLocal(world(mid))).multiplyScalar(.76);
  hand.add(marker);
  return marker;
}
export function palmOrientation(rig: Rig, side: 'right' | 'left', forward: THREE.Vector3, up: THREE.Vector3) {
  const hand = rig[side + 'Hand'] as THREE.Bone;
  const finger = (rig[side + 'Middle'][0] as THREE.Bone).position.clone().normalize();
  const index = hand.worldToLocal(world(rig[side + 'Index'][0]));
  const pinky = hand.worldToLocal(world(rig[side + 'Pinky'][0]));
  const radial = index.sub(pinky).addScaledVector(finger, -index.dot(finger)).normalize();
  const normal = radial.clone().cross(finger).normalize();
  const local = Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(radial, finger, normal));
  const fingersWorld = up.clone().negate().normalize();
  const radialWorld = forward.clone().addScaledVector(fingersWorld, -forward.dot(fingersWorld)).normalize();
  return Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(radialWorld, fingersWorld, radialWorld.clone().cross(fingersWorld)))
    .multiply(local.invert()).normalize();
}
// Fixed bone lengths with a downward elbow pole and an explicit palm effector.
export function solveArm(rig: Rig, side: 'right' | 'left', palm: THREE.Object3D, target: THREE.Vector3, handQ?: THREE.Quaternion, lean = false) {
  const upper = rig[side + 'UpperArm'] as THREE.Bone, lower = rig[side + 'ForeArm'] as THREE.Bone;
  const hand = rig[side + 'Hand'] as THREE.Bone;
  const q = handQ || hand.getWorldQuaternion(Q());
  const wrist = target.clone().sub(palm.position.clone().multiply(hand.getWorldScale(V())).applyQuaternion(q));
  if (lean) {
    const length = world(upper).distanceTo(world(lower)) + world(lower).distanceTo(world(hand));
    let total = 0;
    for (let i = 0; i < 6; i++) {
      const excess = world(upper).distanceTo(wrist) - length + .003;
      if (excess <= 0 || total >= .64) break;
      const toward = wrist.clone().sub(world(upper)); toward.y = 0; toward.normalize();
      const angle = Math.min(.64-total, excess / .24);
      setWorldQ(rig.spine, Q().setFromAxisAngle(V(0,1,0).cross(toward).normalize(), angle).multiply(rig.spine.getWorldQuaternion(Q())));
      total += angle;
    }
  }
  const shoulder = world(upper), elbow = world(lower), current = world(hand);
  const a = shoulder.distanceTo(elbow), b = elbow.distanceTo(current);
  const aim = wrist.clone().sub(shoulder), d = THREE.MathUtils.clamp(aim.length(), Math.abs(a-b)+.0001, a+b-.0001);
  aim.normalize();
  const bend = V(side === 'right' ? -.16 : .16, -1, -.1);
  bend.addScaledVector(aim, -bend.dot(aim)).normalize();
  const along = (a*a + d*d - b*b) / (2*d);
  const desiredElbow = shoulder.clone().addScaledVector(aim, along).addScaledVector(bend, Math.sqrt(Math.max(0, a*a-along*along)));
  pointBone(upper, lower, desiredElbow);
  pointBone(lower, hand, shoulder.clone().addScaledVector(aim, d));
  setWorldQ(hand, q);
}
export function pose(rig: Rig, mode = 'idle', amount = 1, grip = 0) {
  applySeatedHumanPose(rig, mode, amount, grip, { lateral: 0, forward: 1 }, { idleBreathAmp: 0 }, true);
  rig.hips.parent.updateWorldMatrix(true, true);
}
export function makeActor(json: object) {
  const actor = new THREE.ObjectLoader().parse(json);
  actor.scale.setScalar(.65);
  const rig = saveBoneRig(actor);
  pose(rig);
  actor.updateMatrixWorld(true);
  const floor = Math.min(world(rig.leftFoot).y, world(rig.rightFoot).y);
  actor.position.y -= floor;
  actor.position.z = -.74;
  actor.updateMatrixWorld(true);
  return { actor, rig, rightPalm: palmMarker(rig, 'right'), leftPalm: palmMarker(rig, 'left') };
}
export function aimQuaternion(origin: THREE.Vector3, target: THREE.Vector3, boreHeight = .015) {
  const d = target.clone().sub(origin), distance = d.length();
  const pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)) - Math.asin(THREE.MathUtils.clamp(boreHeight / distance, -.95, .95));
  const yaw = Math.atan2(d.x, d.z);
  return Q().setFromEuler(new THREE.Euler(-pitch, yaw, 0, 'YXZ'));
}
export type Weapon = { root: THREE.Group; stock: THREE.Vector3; grip: THREE.Vector3; support: THREE.Vector3; muzzle: THREE.Vector3; pistol: boolean };
export function heldPose(rig: Rig, weapon: Weapon, target: THREE.Vector3) {
  const shoulder = world(rig.rightUpperArm);
  const chest = world(rig.leftUpperArm).lerp(shoulder, .5);
  const anchor = weapon.pistol ? chest.clone().add(V(0, .035, .25)) : shoulder.clone().add(V(.017, .005, .025));
  const pivot = weapon.pistol ? weapon.grip : weapon.stock;
  const q = aimQuaternion(anchor, target, weapon.muzzle.y-pivot.y);
  return { q, position: anchor.sub(pivot.clone().applyQuaternion(q)) };
}
