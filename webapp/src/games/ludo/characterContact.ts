import * as THREE from 'three';
export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Q = () => new THREE.Quaternion();
export const smooth = (t: number) => { t = THREE.MathUtils.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export type Rig = { bones: THREE.Bone[]; [key: string]: any };
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
  const mid = rig[side + 'Middle']?.[0] as THREE.Bone;
  const existing = hand.getObjectByName(`ludo-${side}-palm`);
  if (existing) return existing;
  const marker = new THREE.Object3D();
  marker.name = `ludo-${side}-palm`;
  marker.position.copy(mid ? hand.worldToLocal(world(mid)).multiplyScalar(.76) : V(0,.04,0));
  hand.add(marker);
  return marker;
}
export function palmOrientation(rig: Rig, side: 'right' | 'left', forward: THREE.Vector3, up: THREE.Vector3) {
  const hand = rig[side + 'Hand'] as THREE.Bone;
  if (!rig[side + 'Middle']?.[0] || !rig[side + 'Index']?.[0] || !rig[side + 'Pinky']?.[0]) return hand.getWorldQuaternion(Q());
  const finger = (rig[side + 'Middle'][0] as THREE.Bone).position.clone().normalize();
  const index = hand.worldToLocal(world(rig[side + 'Index'][0]));
  const pinky = hand.worldToLocal(world(rig[side + 'Pinky'][0]));
  const radial = index.sub(pinky); radial.addScaledVector(finger, -radial.dot(finger)).normalize();
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
  if (lean && rig.spine) {
    const length = world(upper).distanceTo(world(lower)) + world(lower).distanceTo(world(hand));
    let total = 0;
    for (let i = 0; i < 6; i++) {
      const excess = world(upper).distanceTo(wrist) - length + .003;
      if (excess <= 0 || total >= .64) break;
      const toward = wrist.clone().sub(world(upper)); toward.y = 0; toward.normalize();
      const angle = Math.min(.64-total, excess / Math.max(.08, world(upper).distanceTo(world(rig.spine))));
      setWorldQ(rig.spine, Q().setFromAxisAngle(V(0,1,0).cross(toward).normalize(), angle).multiply(rig.spine.getWorldQuaternion(Q())));
      total += angle;
    }
  }
  const shoulder = world(upper), elbow = world(lower), current = world(hand);
  const a = shoulder.distanceTo(elbow), b = elbow.distanceTo(current);
  const aim = wrist.clone().sub(shoulder), d = THREE.MathUtils.clamp(aim.length(), Math.abs(a-b)+.0001, a+b-.0001);
  aim.normalize();
  const bend = V(0, -1, 0);
  bend.addScaledVector(aim, -bend.dot(aim)).normalize();
  const along = (a*a + d*d - b*b) / (2*d);
  const desiredElbow = shoulder.clone().addScaledVector(aim, along).addScaledVector(bend, Math.sqrt(Math.max(0, a*a-along*along)));
  pointBone(upper, lower, desiredElbow);
  pointBone(lower, hand, shoulder.clone().addScaledVector(aim, d));
  setWorldQ(hand, q);
}

export function setWorldPose(object: THREE.Object3D, position: THREE.Vector3, quaternion?: THREE.Quaternion) {
  object.position.copy(object.parent ? object.parent.worldToLocal(position.clone()) : position);
  if (quaternion) object.quaternion.copy(object.parent ? object.parent.getWorldQuaternion(Q()).invert().multiply(quaternion) : quaternion);
  object.updateWorldMatrix(true, true);
}
export const armScale = (rig: Rig) => world(rig.rightUpperArm).distanceTo(world(rig.rightForeArm)) / .285;
export type BonePose = THREE.Quaternion[];
export const savePose = (rig: Rig): BonePose => rig.bones.map(bone => bone.quaternion.clone());
export function blendPose(rig: Rig, from: BonePose, to: BonePose, t: number) {
  rig.bones.forEach((bone, i) => bone.quaternion.slerpQuaternions(from[i], to[i], smooth(t)));
  rig.hips.updateWorldMatrix(true, true);
}
