import * as THREE from 'three';
import { saveBoneRig, applySeatedHumanPose } from './generated/rig';

import { V, world, palmMarker, type Rig } from '../../games/ludo/characterContact';
export { V, world, smooth, palmMarker, palmOrientation, solveArm } from '../../games/ludo/characterContact';
const Q = () => new THREE.Quaternion();
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
