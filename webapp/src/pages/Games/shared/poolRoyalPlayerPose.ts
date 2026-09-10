import * as THREE from 'three';
import { CFG, type HumanRig } from './poolRoyalReferenceHuman.ts';
import { bridgeIsClear, bridgeRequiredLift, findBridgeRetraction, type BridgeEnvironment, type BridgeStyle } from './poolRoyalBridgeSafety.ts';

const UP = new THREE.Vector3(0, 1, 0);
const point = (bone: THREE.Object3D) => bone.getWorldPosition(new THREE.Vector3());
const clamp = THREE.MathUtils.clamp;
const samples = new WeakMap<HumanRig, { mesh: THREE.SkinnedMesh; indices: number[]; parts: number[][]; vertices: Map<number, THREE.Vector3> }[]>();

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

function bridgeFingers(human: HumanRig, rotation: THREE.Quaternion, style: BridgeStyle = 'open') {
  // Local +Z faces the cloth. Flexion varies by phalanx; the thumb/index V
  // stays open while the three supporting fingers spread or fold for clearance.
  const poses = {
    open: { spread: [-0.035, 0.02, 0.20, 0.40], flex: [0.10, 0.20, 0.04] },
    compact: { spread: [-0.02, 0.04, 0.10, 0.18], flex: [-0.05, 0.65, 1.15] },
    raised: { spread: [-0.08, 0.16, 0.30, 0.42], flex: [-0.28, 0.9, 1.6] },
    rail: { spread: [-0.025, 0.025, 0.10, 0.16], flex: [0.02, 0.12, 0.18] }
  }[style];
  for (const [finger, name] of ['Index', 'Middle', 'Ring', 'Pinky'].entries()) {
    const chain = human.leftFingers.filter(bone => bone.name.includes(name)).sort((a, b) => a.name.localeCompare(b.name));
    for (let i = 0; i < chain.length - 1; i++) {
      const flex = style === 'rail' && finger >= 2 ? [0.12, 0.85, 1.25][i] : poses.flex[i];
      const direction = new THREE.Vector3(poses.spread[finger], 1, flex ?? 0.04).normalize().applyQuaternion(rotation);
      aimBone(chain[i], chain[i + 1], point(chain[i]).add(direction));
    }
  }
  const thumb = human.leftFingers.filter(bone => bone.name.includes('Thumb')).sort((a, b) => a.name.localeCompare(b.name));
  const directions = [new THREE.Vector3(-0.68, 0.74, 0.30), new THREE.Vector3(-0.45, 0.90, -0.03), new THREE.Vector3(-0.20, 0.98, -0.015)];
  for (let i = 0; i < thumb.length - 1; i++) aimBone(thumb[i], thumb[i + 1], point(thumb[i]).add(directions[i].clone().normalize().applyQuaternion(rotation)));
}

/** Skin vertices are cached once; contact uses the visible palm/fingers, not joint centres. */
export function bridgeSkinParts(human: HumanRig) {
  let entries = samples.get(human);
  if (!entries) {
    entries = [];
    const handBones = new Set([human.bones.leftHand, ...human.leftFingers]);
    human.model!.traverse(object => {
      const mesh = object as THREE.SkinnedMesh;
      if (!mesh.isSkinnedMesh) return;
      const { skinIndex, skinWeight } = mesh.geometry.attributes;
      const owners = new Map<number, number>();
      for (let i = 0; i < skinIndex.count; i++) {
        let weight = 0, strongest = 0, owner = -1;
        for (let j = 0; j < 4; j++) {
          const index = skinIndex.getComponent(i, j), w = skinWeight.getComponent(i, j);
          if (handBones.has(mesh.skeleton.bones[index])) {
            weight += w;
            if (w > strongest) { strongest = w; owner = index; }
          }
        }
        if (weight > 0.5) owners.set(i, owner);
      }
      const groups = new Map<number, Set<number>>();
      const index = mesh.geometry.index;
      for (let i = 0; i < (index?.count ?? skinIndex.count); i += 3) {
        const triangle = [0, 1, 2].map(j => index ? index.getX(i + j) : i + j);
        const owner = triangle.map(v => owners.get(v)).find(v => v !== undefined);
        if (owner === undefined) continue;
        if (!groups.has(owner)) groups.set(owner, new Set());
        // Include the whole triangle, not just vertices with strong hand weights.
        triangle.forEach(v => groups.get(owner)!.add(v));
      }
      const parts = [...groups.values()].map(set => [...set]);
      if (parts.length) {
        const indices = [...new Set(parts.flat())];
        entries!.push({ mesh, parts, indices, vertices: new Map(indices.map(index => [index, new THREE.Vector3()])) });
      }
    });
    samples.set(human, entries);
  }
  human.modelRoot.updateMatrixWorld(true);
  const boxes: THREE.Box3[] = [];
  for (const { mesh, indices, parts, vertices } of entries) {
    for (const index of indices) mesh.getVertexPosition(index, vertices.get(index)!).applyMatrix4(mesh.matrixWorld);
    for (const part of parts) {
      const box = new THREE.Box3();
      for (const index of part) box.expandByPoint(vertices.get(index)!);
      boxes.push(box);
    }
  }
  return boxes;
}

export function bridgeSkinBounds(human: HumanRig) {
  const box = new THREE.Box3();
  for (const part of bridgeSkinParts(human)) box.union(part);
  return box;
}

/** Validate the final blended pose, so IK reach limits and pose easing cannot undo safety. */
function clearBridgeSkin(human: HumanRig, forward: THREE.Vector3, environment: BridgeEnvironment) {
  const b = human.bones;
  const clearance = CFG.humanScale * 0.003;
  let parts = bridgeSkinParts(human);
  if (bridgeIsClear(parts, environment, clearance)) return 'open' as BridgeStyle;
  const wrist = point(b.leftHand!);
  const rotation = b.leftHand!.getWorldQuaternion(new THREE.Quaternion()).normalize();
  const side = new THREE.Vector3(forward.z, 0, -forward.x);
  const pole = side.clone().addScaledVector(UP, 0.16).addScaledVector(forward, -0.3).normalize();
  const place = (target: THREE.Vector3, style: BridgeStyle) => {
    solveArm(b.leftUpperArm!, b.leftLowerArm!, b.leftHand!, target, pole);
    worldQuaternion(b.leftHand!, rotation);
    bridgeFingers(human, rotation, style);
    let posed = bridgeSkinParts(human);
    // A curled finger must not sink into the cloth while making room for a ball.
    if (environment.clothY !== undefined) for (let i = 0; i < 3; i++) {
      const penetration = environment.clothY + CFG.humanScale * 0.002 - Math.min(...posed.map(box => box.min.y));
      if (penetration <= 0) break;
      target.y += penetration;
      solveArm(b.leftUpperArm!, b.leftLowerArm!, b.leftHand!, target, pole);
      worldQuaternion(b.leftHand!, rotation);
      bridgeFingers(human, rotation, style);
      posed = bridgeSkinParts(human);
    }
    return posed;
  };
  for (const style of ['open', 'compact', 'raised'] as const) {
    parts = place(wrist.clone(), style);
    const offset = findBridgeRetraction(parts, forward, environment, clearance, CFG.humanScale * 0.18);
    if (offset) {
      parts = place(wrist.clone().add(offset), style);
      if (bridgeIsClear(parts, environment, clearance)) return style;
    }
  }
  // At a rail, plant on its top instead of pushing fingers through its vertical face.
  // In a cluster, curl the fingers and lift above the measured ball surface.
  const rail = parts.some(box => box.min.x < -environment.bounds.halfWidth || box.max.x > environment.bounds.halfWidth ||
    box.min.z < -environment.bounds.halfLength || box.max.z > environment.bounds.halfLength);
  const style = rail ? 'rail' : 'raised';
  const target = wrist.clone();
  parts = place(target, style);
  for (let i = 0; i < 8 && !bridgeIsClear(parts, environment, clearance); i++) {
    target.y += bridgeRequiredLift(parts, environment, clearance) + clearance;
    parts = place(target, style);
  }
  return style;
}

export function refinePoolRoyalBridge(human: HumanRig, bridgeTarget: THREE.Vector3,
  forward: THREE.Vector3, clothY: number, style: BridgeStyle = 'open', environment?: BridgeEnvironment) {
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
  // Start from the actual rendered cue axis rather than a fixed ball offset,
  // then place the palm slightly beside it so the thumb/index channel supports
  // the shaft without the wrist floating or intersecting the cue.
  const wrist = bridgeTarget.clone()
    .addScaledVector(side, 0.1 * CFG.humanScale)
    .addScaledVector(forward, -0.033 * CFG.humanScale)
    .setY(clothY + 0.031 * CFG.humanScale);
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
  place(); bridgeFingers(human, rotation, style);
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
  return environment ? clearBridgeSkin(human, forward, environment) : style;
}

export type HumanEyeView = { position: THREE.Vector3; target: THREE.Vector3; blend: number };

/** Eyes and target are in the controller parent's coordinates, including floor and scale. */
export function poolRoyalEyeView(human: HumanRig, group: THREE.Group, ball: THREE.Vector3,
  forward: THREE.Vector3, ballRadius: number, followPlayerEyes = false): HumanEyeView | null {
  const left = human.model?.getObjectByName('LeftEye');
  const right = human.model?.getObjectByName('RightEye');
  if (!left || !right || (!followPlayerEyes && human.poseT < 0.2)) return null;
  group.updateWorldMatrix(true, true);
  const eye = point(left).lerp(point(right), 0.5);
  group.parent?.worldToLocal(eye);
  // Hide the shooter's face for this view rather than pushing the camera away
  // from the eyes. Standing and walking use the same live bone attachment.
  if (!followPlayerEyes) eye.addScaledVector(forward, ballRadius * 2);
  const target = ball.clone().addScaledVector(forward, ballRadius * 5);
  return { position: eye, target, blend: followPlayerEyes ? 1 : THREE.MathUtils.smoothstep(human.poseT, 0.2, 0.95) };
}
