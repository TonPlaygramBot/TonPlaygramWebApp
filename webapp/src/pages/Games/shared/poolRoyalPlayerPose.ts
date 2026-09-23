import * as THREE from 'three';
import { CFG, type HumanRig } from './poolRoyalReferenceHuman.ts';

const UP = new THREE.Vector3(0, 1, 0);
const point = (bone: THREE.Object3D) => bone.getWorldPosition(new THREE.Vector3());
const clamp = THREE.MathUtils.clamp;
const samples = new WeakMap<HumanRig, { mesh: THREE.SkinnedMesh; indices: number[] }[]>();
const bridgeFits = new WeakMap<HumanRig, { key: string; shift: number }>();

export type BridgeCue = { back: THREE.Vector3; tip: THREE.Vector3; radius: number };

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

function bridgeFingers(human: HumanRig, rotation: THREE.Quaternion,
  style: 'open' | 'compact' | 'raised' = 'open', precise = false) {
  const spreads = style === 'compact'
    ? { Index: -0.02, Middle: 0.08, Ring: 0.24, Pinky: 0.34 }
    : style === 'raised'
      ? { Index: -0.12, Middle: 0.18, Ring: 0.34, Pinky: 0.48 }
      : { Index: -0.035, Middle: 0.02, Ring: 0.20, Pinky: 0.40 };
  for (const [name, spread] of Object.entries(spreads)) {
    const chain = human.leftFingers.filter(bone => bone.name.includes(name)).sort((a, b) => a.name.localeCompare(b.name));
    for (let i = 0; i < chain.length - 1; i++) {
      const slope = precise ? [0.13, 0.16, 0.08] : [0.10, 0.20, 0.04];
      const direction = new THREE.Vector3(spread, 1, slope[i] ?? 0.01).normalize().applyQuaternion(rotation);
      aimBone(chain[i], chain[i + 1], point(chain[i]).add(direction));
    }
  }
  // Raise the thumb alongside the index base to form an open cue channel.
  const thumb = human.leftFingers.filter(bone => bone.name.includes('Thumb')).sort((a, b) => a.name.localeCompare(b.name));
  const directions = precise
    ? [new THREE.Vector3(-0.62, 0.72, 0.30), new THREE.Vector3(0.45, 0.86, 0.03), new THREE.Vector3(0.50, 0.86, -0.015)]
    : [new THREE.Vector3(-0.68, 0.74, 0.30), new THREE.Vector3(-0.45, 0.90, -0.03), new THREE.Vector3(-0.20, 0.98, -0.015)];
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

/** The minimum distance from the shaft axis to the visible hand triangles.
 * Projecting to the shaft cross-section also catches triangle interiors, which
 * a vertex-only test or centre-line ray misses on the low-poly palm. */
export function bridgeCueClearance(human: HumanRig, cue: BridgeCue, sideShift = 0,
  supplied?: THREE.Triangle[]) {
  const triangles = supplied ?? bridgeCueSections(human, cue);
  const origin = new THREE.Vector3(-sideShift, 0, 0), closest = new THREE.Vector3();
  let distanceSq = Infinity;
  for (const triangle of triangles) distanceSq = Math.min(distanceSq,
    triangle.closestPointToPoint(origin, closest).distanceToSquared(origin));
  return Math.sqrt(distanceSq) - cue.radius;
}

function bridgeCueSections(human: HumanRig, cue: BridgeCue) {
  if (!samples.has(human)) bridgeSkinBounds(human);
  const axis = cue.tip.clone().sub(cue.back).normalize();
  const side = new THREE.Vector3(axis.z, 0, -axis.x).normalize();
  const up = new THREE.Vector3().crossVectors(axis, side).normalize();
  const triangles: THREE.Triangle[] = [];
  for (const { mesh, indices } of samples.get(human)!) {
    if (!mesh.geometry.index) continue;
    const vertices = new Map<number, THREE.Vector3>();
    for (const index of indices) {
      const v = mesh.getVertexPosition(index, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld).sub(cue.back);
      vertices.set(index, new THREE.Vector3(v.dot(side), v.dot(up), 0));
    }
    const index = mesh.geometry.index;
    for (let i = 0; i < index.count; i += 3) {
      const a = vertices.get(index.getX(i)), b = vertices.get(index.getX(i + 1)), c = vertices.get(index.getX(i + 2));
      if (a && b && c) triangles.push(new THREE.Triangle(a, b, c));
    }
  }
  return triangles;
}

function fitBridgeChannel(human: HumanRig, cue: BridgeCue, bridge: THREE.Vector3,
  clothY: number, style: string) {
  const axis = cue.tip.clone().sub(cue.back).normalize();
  const along = bridge.clone().sub(cue.back).dot(axis);
  const height = cue.back.y + axis.y * along - clothY;
  const key = `${style}:${height.toFixed(3)}:${axis.y.toFixed(3)}:${cue.radius.toFixed(4)}`;
  const cached = bridgeFits.get(human);
  if (cached?.key === key) return cached.shift;
  const sections = bridgeCueSections(human, cue);
  if (!sections.length) return 0;
  const gap = 0.0008 * CFG.humanScale;
  // Approach the cue from the thumb side. Stop at skin contact; never jump
  // through a finger to another clear interval on the opposite side.
  const step = 0.004 * CFG.humanScale;
  let safe = 0.065 * CFG.humanScale;
  if (bridgeCueClearance(human, cue, safe, sections) < gap) return 0;
  let blocked = safe;
  for (let i = 0; i < 34; i++) {
    blocked = safe - step;
    if (bridgeCueClearance(human, cue, blocked, sections) < gap) break;
    safe = blocked;
  }
  for (let i = 0; i < 12; i++) {
    const middle = (safe + blocked) * 0.5;
    if (bridgeCueClearance(human, cue, middle, sections) >= gap) safe = middle;
    else blocked = middle;
  }
  bridgeFits.set(human, { key, shift: safe });
  return safe;
}

export function refinePoolRoyalBridge(human: HumanRig, bridgeTarget: THREE.Vector3,
  forward: THREE.Vector3, clothY: number, style: 'open' | 'compact' | 'raised' = 'open', cue?: BridgeCue) {
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
  place(); bridgeFingers(human, rotation, style, Boolean(cue));
  // Lift/lower the wrist until the skinned finger pads meet the cloth; the
  // correction translates the target and resolves the arm at its real length.
  for (let i = 0; i < 4; i++) {
    const clearance = clothY + 0.002 * CFG.humanScale - bridgeSkinBounds(human).min.y;
    if (Math.abs(clearance) < 0.0005) break;
    wrist.y += clearance;
    place();
  }
  if (cue && human.poseT > 0.95) {
    const shift = fitBridgeChannel(human, cue, bridgeTarget, clothY, style);
    wrist.addScaledVector(side, shift);
    place();
  }
  bones.forEach((bone, i) => bone.quaternion.slerpQuaternions(previous[i], bone.quaternion.clone(), weight).normalize());
  human.modelRoot.updateMatrixWorld(true);
}

export type HumanEyeView = { position: THREE.Vector3; target: THREE.Vector3; blend: number };

/** Eyes and target are in the controller parent's coordinates, including floor and scale. */
export function poolRoyalEyeView(human: HumanRig, group: THREE.Group, ball: THREE.Vector3,
  forward: THREE.Vector3, ballRadius: number, exactEyes = false): HumanEyeView | null {
  const left = human.model?.getObjectByName('LeftEye');
  const right = human.model?.getObjectByName('RightEye');
  if (!left || !right || human.poseT < 0.2) return null;
  group.updateWorldMatrix(true, true);
  const eye = point(left).lerp(point(right), 0.5);
  group.parent!.worldToLocal(eye);
  // Older integrations retain their offset. Pool uses the anatomical midpoint;
  // camera-specific face suppression handles self-occlusion without moving it.
  if (!exactEyes) eye.addScaledVector(forward, ballRadius * 2);
  const target = ball.clone().addScaledVector(forward, ballRadius * 5);
  return { position: eye, target, blend: THREE.MathUtils.smoothstep(human.poseT, 0.2, 0.95) };
}
