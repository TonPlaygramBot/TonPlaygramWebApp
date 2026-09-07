import * as THREE from 'three';
import { CFG, type HumanRig } from './poolRoyalReferenceHuman.ts';

const UP = new THREE.Vector3(0, 1, 0);
const point = (bone: THREE.Object3D) => bone.getWorldPosition(new THREE.Vector3());
const clamp = THREE.MathUtils.clamp;
const samples = new WeakMap<HumanRig, { mesh: THREE.SkinnedMesh; indices: number[] }[]>();

function worldQuaternion(bone: THREE.Bone, rotation: THREE.Quaternion) {
  const parent = bone.parent!.getWorldQuaternion(new THREE.Quaternion()).normalize();
  bone.quaternion.copy(parent.invert().multiply(rotation)).normalize();
  bone.updateMatrixWorld(true);
}

function aimBone(bone: THREE.Bone, child: THREE.Bone, target: THREE.Vector3) {
  const origin = point(bone);
  const from = point(child).sub(origin).normalize();
  const to = target.clone().sub(origin).normalize();
  const rotation = new THREE.Quaternion().setFromUnitVectors(from, to);
  worldQuaternion(bone, rotation.multiply(bone.getWorldQuaternion(new THREE.Quaternion()).normalize()));
}

/** Length-constrained IK: rotate joints, never stretch limbs or edit bind matrices. */
export function solveArm(upper: THREE.Bone, lower: THREE.Bone, hand: THREE.Bone,
  target: THREE.Vector3, pole: THREE.Vector3) {
  const shoulder = point(upper);
  const upperLength = shoulder.distanceTo(point(lower));
  const lowerLength = point(lower).distanceTo(point(hand));
  const direction = target.clone().sub(shoulder);
  const distance = clamp(direction.length(), Math.abs(upperLength - lowerLength) + 1e-5, (upperLength + lowerLength) * 0.999);
  direction.normalize();
  const bend = pole.clone().addScaledVector(direction, -pole.dot(direction)).normalize();
  const along = (upperLength ** 2 - lowerLength ** 2 + distance ** 2) / (2 * distance);
  const elbow = shoulder.clone().addScaledVector(direction, along)
    .addScaledVector(bend, Math.sqrt(Math.max(0, upperLength ** 2 - along ** 2)));
  aimBone(upper, lower, elbow);
  aimBone(lower, hand, target);
}

// Ready Player Me's hand longitudinal axis is +Y (not +Z). Its local X runs
// from thumb to little finger. This orthonormal basis keeps the palm flat.
function palmQuaternion(forward: THREE.Vector3, side: THREE.Vector3) {
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
    side, forward, side.clone().cross(forward).normalize()
  )).normalize();
}

function bridgeFingers(human: HumanRig, rotation: THREE.Quaternion) {
  const spreads = { Index: -0.035, Middle: 0.02, Ring: 0.20, Pinky: 0.40 };
  for (const [name, spread] of Object.entries(spreads)) {
    const chain = human.leftFingers.filter(bone => bone.name.includes(name)).sort((a, b) => a.name.localeCompare(b.name));
    for (let i = 0; i < chain.length - 1; i++) {
      const direction = new THREE.Vector3(spread, 1, [0.10, 0.20, 0.04][i] ?? 0.04).normalize().applyQuaternion(rotation);
      aimBone(chain[i], chain[i + 1], point(chain[i]).add(direction));
    }
  }
  // Raise the thumb alongside the index base to form an open cue channel.
  const thumb = human.leftFingers.filter(bone => bone.name.includes('Thumb')).sort((a, b) => a.name.localeCompare(b.name));
  const directions = [new THREE.Vector3(-0.68, 0.74, 0.30), new THREE.Vector3(-0.45, 0.90, -0.03), new THREE.Vector3(-0.20, 0.98, -0.015)];
  for (let i = 0; i < thumb.length - 1; i++) aimBone(thumb[i], thumb[i + 1], point(thumb[i]).add(directions[i].clone().normalize().applyQuaternion(rotation)));
}

/** Skin vertices are cached once; contact uses the visible palm/fingers, not joint centres. */
export function bridgeSkinBounds(human: HumanRig) {
  let entries = samples.get(human);
  if (!entries) {
    entries = [];
    const handBones = new Set([human.bones.leftHand, ...human.leftFingers]);
    human.model!.traverse(object => {
      const mesh = object as THREE.SkinnedMesh;
      if (!mesh.isSkinnedMesh) return;
      const { skinIndex, skinWeight } = mesh.geometry.attributes;
      const indices: number[] = [];
      for (let i = 0; i < skinIndex.count; i++) {
        let weight = 0;
        for (let j = 0; j < 4; j++) if (handBones.has(mesh.skeleton.bones[skinIndex.getComponent(i, j)])) weight += skinWeight.getComponent(i, j);
        if (weight > 0.8) indices.push(i);
      }
      if (indices.length) entries!.push({ mesh, indices });
    });
    samples.set(human, entries);
  }
  human.modelRoot.updateMatrixWorld(true);
  const box = new THREE.Box3(), vertex = new THREE.Vector3();
  for (const { mesh, indices } of entries) for (const index of indices) {
    mesh.getVertexPosition(index, vertex).applyMatrix4(mesh.matrixWorld);
    box.expandByPoint(vertex);
  }
  return box;
}

export function refinePoolRoyalBridge(human: HumanRig, ball: THREE.Vector3,
  forward: THREE.Vector3, clothY: number) {
  const weight = THREE.MathUtils.smoothstep(human.poseT, 0.1, 0.95);
  if (!weight) return;
  const b = human.bones;
  // Lower the shooting head toward the cue through the spine, leaving the
  // hips and feet in their original stance. The eye camera follows this pose.
  const torsoBones = [b.spine!, b.chest!, b.neck!, b.head!];
  const torsoBefore = torsoBones.map(bone => bone.quaternion.clone().normalize());
  const headRotation = b.head!.getWorldQuaternion(new THREE.Quaternion()).normalize();
  const headTarget = point(b.head!).setY(clothY + 0.065 * CFG.humanScale);
  for (let i = 0; i < 3; i++) {
    aimBone(b.chest!, b.head!, headTarget);
    aimBone(b.spine!, b.head!, headTarget);
    worldQuaternion(b.head!, headRotation);
  }
  torsoBones.forEach((bone, i) => bone.quaternion.slerpQuaternions(torsoBefore[i], bone.quaternion.clone(), weight).normalize());
  human.modelRoot.updateMatrixWorld(true);
  const side = new THREE.Vector3(forward.z, 0, -forward.x).normalize();
  const rotation = palmQuaternion(forward, side);
  const bones = [b.leftUpperArm!, b.leftLowerArm!, b.leftHand!, ...human.leftFingers];
  const previous = bones.map(bone => bone.quaternion.clone().normalize());
  const wrist = ball.clone().addScaledVector(forward, -0.28 * CFG.humanScale)
    .addScaledVector(side, 0.075 * CFG.humanScale).setY(clothY + 0.034 * CFG.humanScale);
  const shoulder = point(b.leftUpperArm!);
  const reach = (shoulder.distanceTo(point(b.leftLowerArm!)) + point(b.leftLowerArm!).distanceTo(point(b.leftHand!))) * 0.97;
  const delta = wrist.clone().sub(shoulder);
  const along = delta.dot(forward);
  const perpendicularSq = delta.lengthSq() - along * along;
  if (delta.length() > reach && perpendicularSq < reach * reach) {
    // Long shots move the bridge back along the cue line, keeping the arm at
    // its real length instead of stretching it or hovering above the cloth.
    wrist.addScaledVector(forward, Math.sqrt(reach * reach - perpendicularSq) - along);
  }
  const pole = side.clone().addScaledVector(UP, 0.16).addScaledVector(forward, -0.3).normalize();
  const place = () => {
    solveArm(b.leftUpperArm!, b.leftLowerArm!, b.leftHand!, wrist, pole);
    worldQuaternion(b.leftHand!, rotation);
  };
  place(); bridgeFingers(human, rotation);
  // Lift/lower the wrist until the skinned finger pads meet the cloth; the
  // correction translates the target and resolves the arm at its real length.
  for (let i = 0; i < 4; i++) {
    const clearance = clothY + 0.002 * CFG.humanScale - bridgeSkinBounds(human).min.y;
    if (Math.abs(clearance) < 0.0005) break;
    wrist.y += clearance;
    place();
  }
  bones.forEach((bone, i) => bone.quaternion.slerpQuaternions(previous[i], bone.quaternion.clone(), weight).normalize());
  human.modelRoot.updateMatrixWorld(true);
}

export type HumanEyeView = { position: THREE.Vector3; target: THREE.Vector3; blend: number };

/** Eyes and target are in the controller parent's coordinates, including floor and scale. */
export function poolRoyalEyeView(human: HumanRig, group: THREE.Group, ball: THREE.Vector3,
  forward: THREE.Vector3, ballRadius: number): HumanEyeView | null {
  const left = human.model?.getObjectByName('LeftEye');
  const right = human.model?.getObjectByName('RightEye');
  if (!left || !right || human.poseT < 0.2) return null;
  group.updateWorldMatrix(true, true);
  const eye = point(left).lerp(point(right), 0.5);
  group.parent!.worldToLocal(eye);
  // A small forward nudge clears the face and brings the table closer while
  // retaining the height of the actual eyes and the shooter's handedness.
  eye.addScaledVector(forward, ballRadius * 1.15);
  const target = ball.clone().addScaledVector(forward, ballRadius * 5);
  return { position: eye, target, blend: THREE.MathUtils.smoothstep(human.poseT, 0.2, 0.95) };
}
