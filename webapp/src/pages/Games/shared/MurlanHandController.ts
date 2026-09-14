import * as THREE from 'three';

type Side = 'left' | 'right';
type CardMesh = THREE.Mesh;
type Rig = {
  instance: THREE.Object3D;
  seatRoot: THREE.Object3D;
  seatConfig: { forward: THREE.Vector3; right: THREE.Vector3 };
  bones: Record<string, THREE.Bone | null | undefined>;
};
type Grip = { position: THREE.Vector3; rotation: THREE.Quaternion };
type Arm = {
  upper: THREE.Bone; fore: THREE.Bone; hand: THREE.Bone;
  rest: THREE.Quaternion[]; palm: THREE.Vector3; palmBasis: THREE.Quaternion;
  lengths: [THREE.Vector3, THREE.Vector3]; extension: number;
  grip: Grip; fingers: { bone: THREE.Bone; rest: THREE.Quaternion; curlAxis: THREE.Vector3 }[];
};
type Action = {
  type: 'PLAY' | 'PASS'; start: number; duration: number;
  card?: CardMesh; from: Grip; contact: THREE.Vector3; impacts: Set<number>;
  onImpact?: () => void;
  released?: Grip;
};

export const MURLAN_KNOCK_IMPACTS_MS = Object.freeze([300, 540]);
export const MURLAN_PASS_DURATION_MS = 900;
// Imported chairs use different pivots/heights. Fit only the arm chains; the
// existing character root and the user's card layout remain untouched.
export const MURLAN_HOLD_REACH_LIMIT = 2.8;
export const MURLAN_KNOCK_REACH_LIMIT = 3.2;
const up = new THREE.Vector3(0, 1, 0);
const smooth = (t: number) => { t = THREE.MathUtils.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const world = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());
const copyGrip = (g: Grip): Grip => ({ position: g.position.clone(), rotation: g.rotation.clone() });
const blendGrip = (a: Grip, b: Grip, t: number): Grip => ({
  position: a.position.clone().lerp(b.position, t), rotation: a.rotation.clone().slerp(b.rotation, t)
});

/** Resolve the exact wrist first; shoulder/clavicle substring matches are not upper arms. */
export function resolveMurlanArm(root: THREE.Object3D, side: Side) {
  const bones: THREE.Bone[] = [];
  root.traverse((o) => { if ((o as THREE.Bone).isBone) bones.push(o as THREE.Bone); });
  const initial = side[0];
  const names = [`${side}hand`, `hand${initial}`, `${initial}hand`, `handjoint${initial}`, `handjoint${initial}1`];
  const normalized = (name: string) => name.toLowerCase().replace(/^mixamorig\d*[:_]?/, '').replace(/[^a-z0-9]/g, '');
  const hand = bones.find((bone) => names.includes(normalized(bone.name)))
    ?? bones.find((bone) => new RegExp(`(?:${side}hand|handjoint${initial})$`).test(normalized(bone.name)));
  if (!hand) return null;
  const chain: THREE.Bone[] = [];
  for (let parent = hand.parent; parent && chain.length < 2; parent = parent.parent) {
    if ((parent as THREE.Bone).isBone && !/twist|roll/i.test(parent.name)) chain.push(parent as THREE.Bone);
  }
  if (chain.length !== 2) return null;
  return { upper: chain[1], fore: chain[0], hand };
}

function setWorldRotation(bone: THREE.Object3D, rotation: THREE.Quaternion) {
  const parent = bone.parent?.getWorldQuaternion(new THREE.Quaternion()) ?? new THREE.Quaternion();
  bone.quaternion.copy(parent.invert().multiply(rotation));
  bone.updateWorldMatrix(false, true);
}

function aimJoint(joint: THREE.Bone, end: THREE.Bone, target: THREE.Vector3) {
  const inParent = (point: THREE.Vector3) => joint.parent ? joint.parent.worldToLocal(point) : point;
  const origin = joint.position;
  const current = inParent(world(end)).sub(origin).normalize();
  const desired = inParent(target.clone()).sub(origin).normalize();
  if (desired.lengthSq() < 1e-10 || current.lengthSq() < 1e-10) return;
  const delta = new THREE.Quaternion().setFromUnitVectors(current, desired);
  joint.quaternion.premultiply(delta);
  joint.updateWorldMatrix(false, true);
}

/** Two-bone IK in world space. Only joint rotations change; card transforms are read-only. */
export function solveMurlanArm(arm: Pick<Arm, 'upper' | 'fore' | 'hand'>, wrist: THREE.Vector3, pole: THREE.Vector3) {
  arm.upper.updateWorldMatrix(true, true);
  const shoulder = world(arm.upper);
  const upperLength = shoulder.distanceTo(world(arm.fore));
  const lowerLength = world(arm.fore).distanceTo(world(arm.hand));
  if (Math.min(upperLength, lowerLength) < 1e-7) return Infinity;
  const direction = wrist.clone().sub(shoulder);
  const requested = direction.length();
  if (requested < 1e-7) direction.set(0, -1, 0); else direction.divideScalar(requested);
  const distance = THREE.MathUtils.clamp(requested, Math.abs(upperLength - lowerLength) + 1e-5, upperLength + lowerLength - 1e-5);
  const along = (upperLength * upperLength + distance * distance - lowerLength * lowerLength) / (2 * distance);
  const bend = Math.sqrt(Math.max(0, upperLength * upperLength - along * along));
  const perpendicular = pole.clone().sub(shoulder);
  perpendicular.addScaledVector(direction, -perpendicular.dot(direction));
  if (perpendicular.lengthSq() < 1e-8) perpendicular.copy(up).addScaledVector(direction, -up.dot(direction));
  if (perpendicular.lengthSq() < 1e-8) perpendicular.set(1, 0, 0);
  perpendicular.normalize();
  const elbow = shoulder.clone().addScaledVector(direction, along).addScaledVector(perpendicular, bend);
  const reachable = shoulder.clone().addScaledVector(direction, distance);
  aimJoint(arm.upper, arm.fore, elbow);
  aimJoint(arm.fore, arm.hand, reachable);
  // Mild nonuniform scaling inherited from the chair needs a few world-space refinements.
  for (let i = 0; i < 4 && world(arm.hand).distanceToSquared(reachable) > 1e-8; i++) {
    aimJoint(arm.fore, arm.hand, reachable);
    aimJoint(arm.upper, arm.hand, reachable);
  }
  return world(arm.hand).distanceTo(wrist);
}

/** Lower outside edge of the real card, including its current fan yaw, scale and parent. */
export function murlanCardGrip(card: CardMesh, side: Side, actorRight: THREE.Vector3): Grip {
  card.updateWorldMatrix(true, false);
  if (!card.geometry.boundingBox) card.geometry.computeBoundingBox();
  const box = card.geometry.boundingBox!;
  const cardRight = new THREE.Vector3(1, 0, 0).transformDirection(card.matrixWorld);
  const sign = (cardRight.dot(actorRight) >= 0 ? 1 : -1) * (side === 'right' ? 1 : -1);
  const local = new THREE.Vector3(
    sign > 0 ? box.max.x : box.min.x,
    THREE.MathUtils.lerp(box.min.y, box.max.y, 0.2),
    (box.min.z + box.max.z) / 2
  );
  const rotation = card.getWorldQuaternion(new THREE.Quaternion());
  // Fingers point into the fan from its outside edge; thumbs remain above the grip.
  rotation.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), sign * Math.PI / 2));
  return { position: card.localToWorld(local), rotation };
}

export function murlanFanGrips(cards: CardMesh[], actorRight: THREE.Vector3) {
  const visible = cards.filter((card) => card.visible);
  if (!visible.length) return null;
  let left = murlanCardGrip(visible[0], 'left', actorRight);
  let right = murlanCardGrip(visible[0], 'right', actorRight);
  for (let i = 1; i < visible.length; i++) {
    const a = murlanCardGrip(visible[i], 'left', actorRight);
    const b = murlanCardGrip(visible[i], 'right', actorRight);
    if (a.position.dot(actorRight) < left.position.dot(actorRight)) left = a;
    if (b.position.dot(actorRight) > right.position.dot(actorRight)) right = b;
  }
  return { left, right };
}

export class MurlanHandController {
  readonly rig: Rig;
  readonly actorRight: THREE.Vector3;
  readonly arms: Partial<Record<Side, Arm>> = {};
  action: Action | null = null;
  errors = { left: 0, right: 0 };
  constructor(rig: Rig) {
    this.rig = rig;
    this.actorRight = rig.seatConfig.right.clone();
    rig.instance.updateWorldMatrix(true, true);
    for (const side of ['left', 'right'] as const) {
      const resolved = resolveMurlanArm(rig.instance, side);
      if (!resolved) continue;
      const { upper, fore, hand } = resolved;
      const fingers: Arm['fingers'] = [];
      hand.traverse((o) => {
        if ((o as THREE.Bone).isBone && o !== hand) fingers.push({ bone: o as THREE.Bone, rest: o.quaternion.clone(), curlAxis: new THREE.Vector3() });
      });
      const middle = fingers.find(({ bone }) => /middle.*1$|middle1|middleproximal/i.test(bone.name))?.bone
        ?? fingers.find(({ bone }) => /index/i.test(bone.name))?.bone;
      const thumb = fingers.find(({ bone }) => /thumb/i.test(bone.name))?.bone;
      const localMiddle = middle ? hand.worldToLocal(world(middle)) : new THREE.Vector3(0, 0.07, 0);
      const localThumb = thumb ? hand.worldToLocal(world(thumb)) : new THREE.Vector3(0.03, 0.02, 0);
      const y = localMiddle.clone().normalize();
      const x = localThumb.clone().addScaledVector(y, -localThumb.dot(y)).normalize();
      if (side === 'right') x.negate();
      const z = new THREE.Vector3().crossVectors(x, y).normalize();
      x.crossVectors(y, z).normalize();
      const palmBasis = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
      const curlWorld = x.clone().applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion()));
      for (const finger of fingers) {
        finger.curlAxis.copy(curlWorld).applyQuaternion(finger.bone.getWorldQuaternion(new THREE.Quaternion()).invert()).normalize();
      }
      const palm = localMiddle.clone().multiplyScalar(0.75).addScaledVector(localThumb, 0.25);
      this.arms[side] = {
        upper, fore, hand, rest: [upper.quaternion.clone(), fore.quaternion.clone(), hand.quaternion.clone()],
        lengths: [fore.position.clone(), hand.position.clone()], extension: 1,
        palm, palmBasis, fingers,
        grip: { position: hand.localToWorld(palm.clone()), rotation: hand.getWorldQuaternion(new THREE.Quaternion()).multiply(palmBasis) }
      };
    }
    if (this.arms.left && this.arms.right) {
      this.actorRight.copy(world(this.arms.right.upper)).sub(world(this.arms.left.upper)).setY(0).normalize();
    }
  }

  start(type: 'PLAY' | 'PASS', now: number, card?: CardMesh, surfaceY = 0, onImpact?: () => void, surfaceRadius = Infinity) {
    const arm = this.arms.right;
    if (!arm) { this.action = null; return false; }
    const contact = arm.grip.position.clone();
    // Project onto the nearby tabletop from the current fan, not an arbitrary model angle.
    const outward = this.rig.seatConfig.forward;
    const shoulder = world(arm.upper);
    contact.copy(shoulder).addScaledVector(outward, -0.48).addScaledVector(this.actorRight, 0.08);
    const radius = Math.hypot(contact.x, contact.z);
    const safeRadius = Math.max(0, surfaceRadius * 0.88);
    if (radius > safeRadius) { contact.x *= safeRadius / radius; contact.z *= safeRadius / radius; }
    contact.y = surfaceY + 0.025;
    this.action = {
      type, start: now, duration: type === 'PASS' ? MURLAN_PASS_DURATION_MS : (card?.userData.animation?.duration ?? 1680) + 300,
      card, from: copyGrip(arm.grip), contact, impacts: new Set(), onImpact
    };
    return true;
  }

  cancel() { this.action = null; }

  update(now: number, cards: CardMesh[]) {
    const grips = murlanFanGrips(cards, this.actorRight);
    const action = this.action;
    for (const side of ['left', 'right'] as const) {
      const arm = this.arms[side];
      if (!arm) continue;
      let target = grips?.[side] ?? (side === 'right' && action ? action.from : arm.grip);
      let curl = grips ? 0.42 : 0;
      if (side === 'right' && action) {
        const elapsed = Math.max(0, now - action.start);
        if (action.type === 'PASS') {
          const across = this.actorRight;
          const along = new THREE.Vector3().crossVectors(up, across).normalize();
          const contact: Grip = { position: action.contact, rotation: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(across, along, up)) };
          const hover = copyGrip(contact); hover.position.y += 0.11;
          if (elapsed < 180) target = blendGrip(action.from, hover, smooth(elapsed / 180));
          else if (elapsed < 300) target = blendGrip(hover, contact, smooth((elapsed - 180) / 120));
          else if (elapsed < 420) target = blendGrip(contact, hover, smooth((elapsed - 300) / 120));
          else if (elapsed < 540) target = blendGrip(hover, contact, smooth((elapsed - 420) / 120));
          else target = blendGrip(contact, target, smooth((elapsed - 600) / 300));
          curl = 0.9;
        } else if (action.card) {
          const pickup = murlanCardGrip(action.card, 'right', this.actorRight);
          const returnAt = action.duration - 300;
          const reach = world(arm.upper).distanceTo(world(arm.fore)) + world(arm.fore).distanceTo(world(arm.hand));
          if (!action.released && elapsed > 180 && pickup.position.distanceTo(world(arm.upper)) > reach * 0.99) {
            action.released = copyGrip(arm.grip);
            // The existing card continues to its unchanged table destination after release.
            action.duration = elapsed + 300;
          }
          if (elapsed < 180) target = blendGrip(action.from, pickup, smooth(elapsed / 180));
          else if (action.released) target = blendGrip(action.released, target, smooth((elapsed - (action.duration - 300)) / 300));
          else if (elapsed < returnAt) target = pickup;
          else target = blendGrip(pickup, target, smooth((elapsed - returnAt) / 300));
          curl = !action.released && elapsed < returnAt ? 0.48 : 0;
        }
      }
      this.pose(side, target, curl);
    }
    // Fire only after the same frame has placed the hand. Skipped frames do not replay stale knocks.
    if (action?.type === 'PASS') {
      const elapsed = now - action.start;
      for (const impact of MURLAN_KNOCK_IMPACTS_MS) {
        if (elapsed >= impact && !action.impacts.has(impact)) {
          action.impacts.add(impact);
          if (elapsed - impact <= 100 && this.errors.right < 0.08) action.onImpact?.();
        }
      }
    }
    if (action && now >= action.start + action.duration) this.action = null;
  }

  private pose(side: Side, target: Grip, curl: number) {
    const arm = this.arms[side]!;
    // Start from the same seated rotations each frame; never accumulate solver drift.
    [arm.upper, arm.fore, arm.hand].forEach((bone, i) => bone.quaternion.copy(arm.rest[i]));
    arm.fore.position.copy(arm.lengths[0]).multiplyScalar(arm.extension);
    arm.hand.position.copy(arm.lengths[1]).multiplyScalar(arm.extension);
    arm.upper.updateWorldMatrix(true, true);
    const rotation = target.rotation.clone().multiply(arm.palmBasis.clone().invert());
    const palmOffset = arm.palm.clone().multiply(arm.hand.getWorldScale(new THREE.Vector3())).applyQuaternion(rotation);
    const wrist = target.position.clone().sub(palmOffset);
    const shoulder = world(arm.upper);
    // Calibrate only the arms to the established fan. Never lengthen them to chase a table-center play.
    if (!this.action || side === 'left' || this.action.type === 'PASS') {
      const reach = shoulder.distanceTo(world(arm.fore)) + world(arm.fore).distanceTo(world(arm.hand));
      const needed = wrist.distanceTo(shoulder) / Math.max(reach / arm.extension, 1e-6) * 1.015;
      arm.extension = THREE.MathUtils.clamp(Math.max(arm.extension, needed), 1,
        this.action?.type === 'PASS' && side === 'right' ? MURLAN_KNOCK_REACH_LIMIT : MURLAN_HOLD_REACH_LIMIT);
      arm.fore.position.copy(arm.lengths[0]).multiplyScalar(arm.extension);
      arm.hand.position.copy(arm.lengths[1]).multiplyScalar(arm.extension);
      arm.upper.updateWorldMatrix(false, true);
    }
    const pole = shoulder.clone().addScaledVector(this.actorRight, side === 'right' ? 0.55 : -0.55)
      .addScaledVector(this.rig.seatConfig.forward, 0.2).addScaledVector(up, -0.55);
    this.errors[side] = solveMurlanArm(arm, wrist, pole);
    setWorldRotation(arm.hand, rotation);
    // Correct the small offset introduced by nonuniform seat scaling using the actual palm transform.
    for (let i = 0; i < 3; i++) {
      const correction = target.position.clone().sub(arm.hand.localToWorld(arm.palm.clone()));
      if (correction.lengthSq() < 1e-7) break;
      solveMurlanArm(arm, world(arm.hand).add(correction), pole);
      setWorldRotation(arm.hand, rotation);
    }
    this.errors[side] = target.position.distanceTo(arm.hand.localToWorld(arm.palm.clone()));
    for (const finger of arm.fingers) {
      finger.bone.quaternion.copy(finger.rest);
      if (!/end|tip/i.test(finger.bone.name)) {
        const amount = /thumb/i.test(finger.bone.name) ? curl * 0.35 : curl;
        finger.bone.rotateOnAxis(finger.curlAxis, -amount);
      }
    }
    arm.grip = copyGrip(target);
  }
}
