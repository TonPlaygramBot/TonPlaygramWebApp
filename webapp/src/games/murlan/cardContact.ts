import * as THREE from 'three';
import { calibrateHandRig, createPinchPose, applyPinchPose, applyFinger } from '../chess/anatomicalHand.ts';
import type { HandBoneRig, PinchPose, Finger } from '../chess/anatomicalHand.ts';

type Side = 'left' | 'right';
type Arm = {
  upper: THREE.Bone; elbow: THREE.Bone; hand: THREE.Bone;
  pinch: PinchPose; inverseBasis: THREE.Quaternion;
  rest: THREE.Quaternion[];
  relaxedFingers: Finger[];
  poseBones: THREE.Bone[];
  palmLength: number;
};
export type CardContactRig = {
  root: THREE.Object3D;
  arms: Partial<Record<Side, Arm>>;
  torso?: { bone: THREE.Bone; rest: THREE.Quaternion; axis: THREE.Vector3; basePosition: THREE.Vector3; forwardShift: number; lean: number; target: number; lastTime?: number; signature?: string };
};
export const CARD_PICKUP_REACH_MS = 440;
export const CARD_CARRY_MS = 820;
export const CARD_RELEASE_MS = 420;
export const CARD_RECOVER_MS = 520;
export const CARD_ACTION_MS = CARD_PICKUP_REACH_MS + CARD_CARRY_MS + CARD_RELEASE_MS + CARD_RECOVER_MS;
export const smoothCardMotion = (v: number) => {
  const t = THREE.MathUtils.clamp(v, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
const worldPosition = (object: THREE.Object3D) => object.getWorldPosition(new THREE.Vector3());

// Resolve the full digit chains, including Mixamo's "Hand" infix. Searching
// only for "rightindex" missed every finger in the original RPM model.
export function createCardContactRig(root: THREE.Object3D): CardContactRig {
  const bones: THREE.Bone[] = [];
  root.traverse((node) => { if ((node as THREE.Bone).isBone) bones.push(node as THREE.Bone); });
  const normalized = (name: string) => name.toLowerCase().replace(/mixamorig|[^a-z0-9]/g, '');
  const find = (...names: string[]) => bones.find((bone) => names.includes(normalized(bone.name)));
  const fingers: HandBoneRig = {};
  for (const side of ['left', 'right'] as const) {
    fingers[`${side}Hand`] = find(`${side}hand`);
    for (const digit of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'] as const) {
      fingers[`${side}${digit}`] = [1, 2, 3].map((i) =>
        find(`${side}hand${digit.toLowerCase()}${i}`, `${side}${digit.toLowerCase()}${i}`)
      ).filter((bone): bone is THREE.Bone => !!bone);
    }
  }
  const profiles = calibrateHandRig(fingers);
  const result: CardContactRig = { root, arms: {} };
  const spine = find('spine', 'spine1');
  if (spine) result.torso = { bone: spine, rest: spine.quaternion.clone(), axis: new THREE.Vector3(1, 0, 0), basePosition: root.position.clone(), forwardShift: 0, lean: 0, target: 0 };
  for (const side of ['left', 'right'] as const) {
    const upper = find(`${side}arm`, `${side}upperarm`);
    const elbow = find(`${side}forearm`, `${side}lowerarm`);
    const hand = fingers[`${side}Hand`];
    const profile = profiles[side];
    const pinch = createPinchPose(fingers, 0.0015, side);
    if (!upper || !elbow || !hand || !profile || !pinch) continue;
    const z = profile.pinchAxis.clone().normalize();
    const y = profile.forward.clone().projectOnPlane(z).normalize();
    const x = new THREE.Vector3().crossVectors(y, z).normalize();
    y.crossVectors(z, x).normalize();
    const inverseBasis = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)).invert();
    const relaxedFingers = [profile.fingers.Ring, profile.fingers.Pinky].filter((finger): finger is Finger => !!finger);
    const poseBones = [upper, elbow, hand, ...Object.values(profile.fingers).flatMap((finger) => finger.chain)];
    const palmLength = profile.fingers.Index
      ? hand.worldToLocal(worldPosition(profile.fingers.Index.chain[0])).length() : pinch.anchor.length() * 0.7;
    result.arms[side] = { upper, elbow, hand, pinch, inverseBasis, rest: [], relaxedFingers, poseBones, palmLength };
  }
  return result;
}

export function cardScaleForHand(rig: CardContactRig | undefined, height: number, fallback = 1) {
  const arm = rig?.arms.left;
  if (!arm) return fallback;
  return Math.min(fallback, arm.palmLength * arm.hand.getWorldScale(new THREE.Vector3()).x * 1.2 / height);
}

export function saveCardContactRest(rig: CardContactRig) {
  for (const arm of Object.values(rig.arms)) {
    arm.rest = [arm.upper, arm.elbow, arm.hand].map((bone) => bone.quaternion.clone());
  }
  if (rig.torso) {
    rig.torso.rest.copy(rig.torso.bone.quaternion);
    rig.torso.basePosition.copy(rig.root.position);
    const arm = rig.arms.right || rig.arms.left;
    if (arm) rig.torso.forwardShift = (worldPosition(arm.upper).distanceTo(worldPosition(arm.elbow)) +
      worldPosition(arm.elbow).distanceTo(worldPosition(arm.hand))) * 0.18 / rig.root.getWorldScale(new THREE.Vector3()).z;
    rig.torso.axis.set(1, 0, 0).applyQuaternion(rig.root.getWorldQuaternion(new THREE.Quaternion()))
      .applyQuaternion(rig.torso.bone.getWorldQuaternion(new THREE.Quaternion()).invert()).normalize();
  }
}

function applyTorsoLean(rig: CardContactRig, angle: number) {
  const torso = rig.torso;
  if (!torso) return;
  // A small seated lean-in supplies reach without lengthening the arm bones.
  rig.root.position.copy(torso.basePosition).add(new THREE.Vector3(0, 0, torso.forwardShift * angle / 0.63).applyQuaternion(rig.root.quaternion));
  torso.bone.quaternion.copy(torso.rest).multiply(new THREE.Quaternion().setFromAxisAngle(torso.axis, angle));
  rig.root.updateWorldMatrix(true, true);
}

// Adapt the seated upper body and arm to the existing screen layout. This
// function never writes any card transform, including while a card is selected.
export function supportFixedCards(rig: CardContactRig, cards: THREE.Object3D[], height: number,
  time: number, lockTorso = false, immediate = false) {
  if (!cards.length) { restoreCardHand(rig, 'left'); return; }
  const support = cards[Math.floor((cards.length - 1) * 0.65)];
  const torso = rig.torso;
  if (torso) {
    const targets = [cards[0], support, cards[cards.length - 1]];
    const signature = targets.map((card) => [...card.position.toArray(), ...card.quaternion.toArray(), ...card.scale.toArray()]
      .map((value) => value.toFixed(3)).join(',')).join('|');
    if (!lockTorso && signature !== torso.signature) {
      torso.signature = signature;
      let bestAngle = 0, bestError = Infinity;
      for (let step = 0; step <= 18; step++) {
        const angle = step * 0.035;
        applyTorsoLean(rig, angle);
        let error = 0;
        for (const side of ['left', 'right'] as const) {
          const arm = rig.arms[side];
          if (!arm) continue;
          const shoulder = worldPosition(arm.upper);
          const reach = shoulder.distanceTo(worldPosition(arm.elbow)) + worldPosition(arm.elbow).distanceTo(worldPosition(arm.hand));
          for (const card of side === 'left' ? [support] : targets) {
            const rotation = card.getWorldQuaternion(new THREE.Quaternion()).multiply(arm.inverseBasis);
            const wrist = cardContactPoint(card, height, new THREE.Vector3(), side)
              .sub(arm.pinch.anchor.clone().multiply(arm.hand.getWorldScale(new THREE.Vector3())).applyQuaternion(rotation));
            error = Math.max(error, shoulder.distanceTo(wrist) - reach * 0.96);
          }
        }
        if (error < bestError) { bestError = error; bestAngle = angle; }
        if (error <= 0) break;
      }
      torso.target = bestAngle;
    }
    const dt = torso.lastTime == null ? 1 / 60 : THREE.MathUtils.clamp((time - torso.lastTime) / 1000, 0, 0.1);
    torso.lastTime = time;
    torso.lean = immediate ? torso.target : THREE.MathUtils.lerp(torso.lean, torso.target, 1 - Math.exp(-10 * dt));
    applyTorsoLean(rig, torso.lean);
  }
  poseCardHand(rig, 'left', support, height, 1, 1);
}

function setWorldQuaternion(bone: THREE.Object3D, quaternion: THREE.Quaternion) {
  const parent = bone.parent?.getWorldQuaternion(new THREE.Quaternion()) ?? new THREE.Quaternion();
  bone.quaternion.copy(parent.invert().multiply(quaternion));
  bone.updateWorldMatrix(false, true);
}

function aimBone(bone: THREE.Bone, end: THREE.Bone, target: THREE.Vector3) {
  const origin = worldPosition(bone);
  const from = worldPosition(end).sub(origin).normalize();
  const to = target.clone().sub(origin).normalize();
  if (from.lengthSq() < 0.5 || to.lengthSq() < 0.5) return;
  const rotation = new THREE.Quaternion().setFromUnitVectors(from, to)
    .multiply(bone.getWorldQuaternion(new THREE.Quaternion()));
  setWorldQuaternion(bone, rotation);
}

// Analytic two-bone solve preserves bone lengths at any seat rotation/scale.
// The elbow pole is derived from the character's frame, never screen axes.
export function solveCardArm(arm: Arm, wrist: THREE.Vector3, pole: THREE.Vector3) {
  const shoulder = worldPosition(arm.upper);
  const elbow = worldPosition(arm.elbow);
  const hand = worldPosition(arm.hand);
  const a = shoulder.distanceTo(elbow), b = elbow.distanceTo(hand);
  if (a < 1e-7 || b < 1e-7) return;
  const direction = wrist.clone().sub(shoulder);
  const rawDistance = direction.length();
  if (rawDistance < 1e-7) return;
  direction.divideScalar(rawDistance);
  const distance = THREE.MathUtils.clamp(rawDistance, Math.abs(a - b) + 1e-6, (a + b) * 0.9995);
  const bend = pole.clone().sub(shoulder).projectOnPlane(direction);
  if (bend.lengthSq() < 1e-7) bend.copy(elbow).sub(shoulder).projectOnPlane(direction);
  if (bend.lengthSq() < 1e-7) bend.set(0, -1, 0).projectOnPlane(direction);
  bend.normalize();
  const along = (a * a + distance * distance - b * b) / (2 * distance);
  const height = Math.sqrt(Math.max(0, a * a - along * along));
  const elbowTarget = shoulder.clone().addScaledVector(direction, along).addScaledVector(bend, height);
  aimBone(arm.upper, arm.elbow, elbowTarget);
  aimBone(arm.elbow, arm.hand, shoulder.clone().addScaledVector(direction, distance));
}

export function cardGripOffset(cardHeight: number, side: Side = 'right') {
  // The supporting thumb holds the lower-left area; the playing hand takes
  // the opposite lower corner. The hands never have to occupy the same point.
  return new THREE.Vector3(cardHeight * (side === 'left' ? -0.10 : 0.16),
    -cardHeight * (side === 'left' ? 0.39 : 0.33), 0);
}

export function cardContactPoint(mesh: THREE.Object3D, cardHeight: number, out = new THREE.Vector3(), side: Side = 'right') {
  return mesh.localToWorld(out.copy(cardGripOffset(cardHeight, side)));
}

export function pinCardToHand(rig: CardContactRig, side: Side, mesh: THREE.Object3D, cardHeight: number) {
  const arm = rig.arms[side];
  if (!arm) return;
  const actual = arm.hand.localToWorld(arm.pinch.anchor.clone());
  const desired = cardContactPoint(mesh, cardHeight, new THREE.Vector3(), side);
  const position = worldPosition(mesh).add(actual.clone().sub(desired));
  mesh.position.copy(mesh.parent ? mesh.parent.worldToLocal(position) : position);
  mesh.updateWorldMatrix(false, true);
  return actual;
}

export function poseCardHand(rig: CardContactRig, side: Side, mesh: THREE.Object3D,
  cardHeight: number, weight = 1, grip = 1, contactOverride?: THREE.Vector3) {
  const arm = rig.arms[side];
  if (!arm || !arm.rest.length) return;
  [arm.upper, arm.elbow, arm.hand].forEach((bone, i) => bone.quaternion.copy(arm.rest[i]));
  rig.root.updateWorldMatrix(true, true);
  applyCardGrip(rig, side, grip);
  const targetRotation = mesh.getWorldQuaternion(new THREE.Quaternion()).multiply(arm.inverseBasis);
  const contact = contactOverride?.clone() ?? cardContactPoint(mesh, cardHeight, new THREE.Vector3(), side);
  const scale = arm.hand.getWorldScale(new THREE.Vector3());
  const wrist = contact.clone().sub(arm.pinch.anchor.clone().multiply(scale).applyQuaternion(targetRotation));
  const rootRotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
  const pole = worldPosition(arm.upper).add(new THREE.Vector3(side === 'right' ? -0.3 : 0.3, -0.6, -0.15).applyQuaternion(rootRotation));
  solveCardArm(arm, wrist, pole);
  setWorldQuaternion(arm.hand, targetRotation);
  if (weight < 1) {
    [arm.upper, arm.elbow, arm.hand].forEach((bone, i) => bone.quaternion.slerpQuaternions(arm.rest[i], bone.quaternion.clone(), weight));
  }
  rig.root.updateWorldMatrix(true, true);
  return arm.hand.localToWorld(arm.pinch.anchor.clone()).distanceTo(contact);
}

export function restoreCardHand(rig: CardContactRig, side: Side) {
  const arm = rig.arms[side];
  if (!arm?.rest.length) return;
  [arm.upper, arm.elbow, arm.hand].forEach((bone, i) => bone.quaternion.copy(arm.rest[i]));
  applyCardGrip(rig, side, 0);
}

export function applyCardGrip(rig: CardContactRig, side: Side, grip: number) {
  const arm = rig.arms[side];
  if (!arm) return;
  applyPinchPose(arm.pinch, 0.16 + 0.84 * THREE.MathUtils.clamp(grip, 0, 1));
  for (const [index, finger] of arm.relaxedFingers.entries()) {
    finger.joints.forEach((joint, i) => {
      joint.flex = [0.38, 0.62, 0.4][i] + index * 0.06;
      joint.spread = 0;
      joint.opposition = 0;
    });
    applyFinger(finger);
  }
}

export function applyCardPickupGesture(rig: CardContactRig, progress: number) {
  const arm = rig.arms.right;
  if (!arm) return;
  // The index locates the edge first; the thumb opposes it last. The middle
  // finger supports underneath after contact instead of closing as a fist.
  const closure = [smoothCardMotion((progress - 0.72) / 0.28),
    smoothCardMotion((progress - 0.55) / 0.31), smoothCardMotion((progress - 0.80) / 0.20)];
  arm.pinch.fingers.forEach(({finger, pose}, index) => {
    finger.joints.forEach((joint, i) => {
      const t = closure[index];
      const relaxed = finger.thumb ? [0.10, 0.04, 0.02][i] : [0.10, 0.13, 0.08][i];
      joint.flex = THREE.MathUtils.lerp(relaxed, pose[i].flex, t);
      joint.spread = pose[i].spread * t;
      joint.opposition = pose[i].opposition * t;
    });
    applyFinger(finger);
  });
}

export function captureCardHandPose(rig: CardContactRig, side: Side) {
  return rig.arms[side]?.poseBones.map((bone) => bone.quaternion.clone()) || [];
}

export function blendCardHandPose(rig: CardContactRig, side: Side, from: THREE.Quaternion[], weight: number) {
  rig.arms[side]?.poseBones.forEach((bone, index) => {
    if (from[index]) bone.quaternion.slerpQuaternions(from[index], bone.quaternion.clone(), weight);
  });
  rig.root.updateWorldMatrix(true, true);
}

export function applyCardHandPose(rig: CardContactRig, side: Side, pose: THREE.Quaternion[]) {
  rig.arms[side]?.poseBones.forEach((bone, index) => {
    if (pose[index]) bone.quaternion.copy(pose[index]);
  });
  rig.root.updateWorldMatrix(true, true);
}

export function reachableCardPosition(rig: CardContactRig, mesh: THREE.Object3D,
  cardHeight: number, target: THREE.Vector3, rotation: THREE.Quaternion) {
  const arm = rig.arms.right;
  if (!arm) return target.clone();
  const shoulder = worldPosition(arm.upper);
  const reach = (shoulder.distanceTo(worldPosition(arm.elbow)) + worldPosition(arm.elbow).distanceTo(worldPosition(arm.hand))) * 0.94;
  const handRotation = rotation.clone().multiply(arm.inverseBasis);
  const wristOffset = arm.pinch.anchor.clone().multiply(arm.hand.getWorldScale(new THREE.Vector3())).applyQuaternion(handRotation);
  const cardOffset = cardGripOffset(cardHeight).multiply(mesh.getWorldScale(new THREE.Vector3())).applyQuaternion(rotation);
  const wrist = target.clone().add(cardOffset).sub(wristOffset);
  // Prefer the table's height. Use the available horizontal reach at that
  // height, keeping a soft elbow instead of pulling a locked arm at the target.
  wrist.y = THREE.MathUtils.clamp(wrist.y, shoulder.y - reach * 0.94, shoulder.y + reach * 0.94);
  const horizontal = new THREE.Vector3(wrist.x - shoulder.x, 0, wrist.z - shoulder.z);
  horizontal.clampLength(0, Math.sqrt(Math.max(0, reach * reach - (wrist.y - shoulder.y) ** 2)));
  wrist.x = shoulder.x + horizontal.x;
  wrist.z = shoulder.z + horizontal.z;
  return wrist.add(wristOffset).sub(cardOffset);
}

export function heldCardPose(rig: CardContactRig, orientation: THREE.Quaternion,
  index: number, count: number, cardHeight: number, scale: number, selected = false) {
  const arm = rig.arms.left;
  if (!arm?.rest.length) return;
  [arm.upper, arm.elbow, arm.hand].forEach((bone, i) => bone.quaternion.copy(arm.rest[i]));
  rig.root.updateWorldMatrix(true, true);
  applyCardGrip(rig, 'left', 1);
  const rootRotation = rig.root.getWorldQuaternion(new THREE.Quaternion());
  const shoulder = worldPosition(arm.upper);
  const reach = shoulder.distanceTo(worldPosition(arm.elbow)) + worldPosition(arm.elbow).distanceTo(worldPosition(arm.hand));
  const wrist = worldPosition(arm.hand).add(new THREE.Vector3(-0.075, -0.07, -0.09).multiplyScalar(reach).applyQuaternion(rootRotation));
  const pole = shoulder.clone().add(new THREE.Vector3(0.3, -0.6, -0.15).multiplyScalar(reach).applyQuaternion(rootRotation));
  solveCardArm(arm, wrist, pole);
  // A slight reading tilt and a compact fan keep the wrist relaxed while the
  // cards retain the viewing direction established by the production camera.
  const reading = orientation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.16));
  setWorldQuaternion(arm.hand, reading.clone().multiply(arm.inverseBasis));
  const pivot = arm.hand.localToWorld(arm.pinch.anchor.clone());
  const offset = count > 1 ? index / (count - 1) - 0.5 : 0;
  const angle = -offset * Math.min(1.12, Math.max(0, count - 1) * 0.12);
  const quaternion = reading.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1), angle));
  const position = cardGripOffset(cardHeight, 'left').multiplyScalar(-scale)
    .add(new THREE.Vector3(0, selected ? cardHeight * scale * 0.10 : 0, index * 0.0008))
    .applyQuaternion(quaternion).add(pivot);
  return { position, quaternion };
}

export function sampleCardTransfer(progress: number, from: THREE.Vector3, to: THREE.Vector3,
  fromRotation: THREE.Quaternion, toRotation: THREE.Quaternion, lift: number) {
  const t = smoothCardMotion(progress);
  const position = from.clone().lerp(to, t);
  // Zero velocity at both contacts; the arc remains above the table.
  position.y += Math.sin(Math.PI * t) * Math.max(0, lift);
  return { position, quaternion: fromRotation.clone().slerp(toRotation, t) };
}
