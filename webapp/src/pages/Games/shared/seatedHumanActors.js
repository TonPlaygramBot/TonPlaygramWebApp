import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { CHESS_HUMAN_CHARACTER_OPTIONS } from '../../../config/chessBattleInventoryConfig.js';
import { applySRGBColorSpace } from '../../../utils/colorSpace.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clamp01 = (value, fallback = 0) => {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, value));
};
const smooth01 = (v) => {
  const t = clamp(v, 0, 1);
  return t * t * (3 - 2 * t);
};

const SEATED_HUMAN_DEFAULT_MODEL_URL = CHESS_HUMAN_CHARACTER_OPTIONS[0]?.modelUrls?.[0];
const SEATED_HUMAN_BASE_HEIGHT = 1.74;
const SEATED_HUMAN_VISUAL_SCALE_MULTIPLIER = 4.35;
const SEATED_HUMAN_REACH_FORWARD_GAIN = 0.62;
const SEATED_HUMAN_REACH_SIDE_GAIN = 0.34;
const SEATED_HUMAN_TORSO_REACH_GAIN = 0.16;
const SEATED_HUMAN_HEAD_REACH_GAIN = 0.08;

const seatedHumanTemplatePromiseById = new Map();
const chessDominoCharacterTextureCache = new Map();
let chessDominoCharacterTextureLoader = null;
const seatedHumanArmIKStates = new WeakMap();

function normalizePbrTexture(texture, maxAnisotropy = 1) {
  if (!texture) return;
  texture.flipY = false;
  texture.anisotropy = Math.max(texture.anisotropy ?? 1, maxAnisotropy);
  texture.needsUpdate = true;
}

function normalizeBoneName(name = '') {
  return String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findBoneByNeedle(bones, ...needles) {
  const normalized = bones.map((bone) => ({ bone, name: normalizeBoneName(bone.name) }));
  for (const needle of needles) {
    const clean = normalizeBoneName(needle);
    const exact = normalized.find((entry) => entry.name === clean);
    if (exact) return exact.bone;
    const partial = normalized.find((entry) => entry.name.includes(clean));
    if (partial) return partial.bone;
  }
  return null;
}

function findFingerChain(bones, side, finger) {
  return [1, 2, 3].map((joint) => findBoneByNeedle(
    bones, `${side}${finger}${joint}`, `${side}hand${finger}${joint}`
  )).filter(Boolean);
}

export function saveSeatedHumanBoneRig(modelRoot) {
  const bones = [];
  modelRoot?.traverse?.((obj) => {
    if (obj?.isBone) bones.push(obj);
  });
  const saved = new Map();
  bones.forEach((bone) => {
    saved.set(bone, {
      rotation: bone.rotation.clone(),
      position: bone.position.clone()
    });
  });
  const rig = {
    saved,
    hips: findBoneByNeedle(bones, 'hips', 'pelvis'),
    spine: findBoneByNeedle(bones, 'spine'),
    chest: findBoneByNeedle(bones, 'spine2', 'chest', 'upperchest'),
    neck: findBoneByNeedle(bones, 'neck'),
    head: findBoneByNeedle(bones, 'head'),
    leftUpperLeg: findBoneByNeedle(bones, 'leftupleg', 'leftthigh', 'leftupperleg'),
    leftLowerLeg: findBoneByNeedle(bones, 'leftleg', 'leftlowerleg', 'leftcalf'),
    leftFoot: findBoneByNeedle(bones, 'leftfoot'),
    rightUpperLeg: findBoneByNeedle(bones, 'rightupleg', 'rightthigh', 'rightupperleg'),
    rightLowerLeg: findBoneByNeedle(bones, 'rightleg', 'rightlowerleg', 'rightcalf'),
    rightFoot: findBoneByNeedle(bones, 'rightfoot'),
    leftUpperArm: findBoneByNeedle(bones, 'leftarm', 'leftupperarm'),
    leftForeArm: findBoneByNeedle(bones, 'leftforearm', 'leftlowerarm'),
    leftHand: findBoneByNeedle(bones, 'lefthand'),
    rightUpperArm: findBoneByNeedle(bones, 'rightarm', 'rightupperarm'),
    rightForeArm: findBoneByNeedle(bones, 'rightforearm', 'rightlowerarm'),
    rightHand: findBoneByNeedle(bones, 'righthand'),
    leftThumb: findFingerChain(bones, 'left', 'thumb'),
    leftIndex: findFingerChain(bones, 'left', 'index'),
    leftMiddle: findFingerChain(bones, 'left', 'middle'),
    leftRing: findFingerChain(bones, 'left', 'ring'),
    leftPinky: findFingerChain(bones, 'left', 'pinky'),
    rightThumb: findFingerChain(bones, 'right', 'thumb'),
    rightIndex: findFingerChain(bones, 'right', 'index'),
    rightMiddle: findFingerChain(bones, 'right', 'middle'),
    rightRing: findFingerChain(bones, 'right', 'ring'),
    rightPinky: findFingerChain(bones, 'right', 'pinky'),
    leftContactTips: ['thumb', 'index', 'middle'].map((finger) => findBoneByNeedle(
      bones, `lefthand${finger}4`, `left${finger}4`, `lefthand${finger}end`, `left${finger}end`
    )),
    rightContactTips: ['thumb', 'index', 'middle'].map((finger) => findBoneByNeedle(
      bones, `righthand${finger}4`, `right${finger}4`, `righthand${finger}end`, `right${finger}end`
    ))
  };
  // Capture anatomical hand axes before the seated pose changes the skeleton.
  modelRoot?.updateWorldMatrix?.(true, true);
  getArmIKState(rig, 'left');
  getArmIKState(rig, 'right');
  return rig;
}

function resetBoneRig(rig) {
  if (!rig?.saved) return;
  rig.saved.forEach((pose, bone) => {
    bone.rotation.copy(pose.rotation);
    bone.position.copy(pose.position);
  });
}

function addBoneRot(rig, bone, x = 0, y = 0, z = 0) {
  if (!rig || !bone) return;
  const base = rig.saved.get(bone);
  if (!base) return;
  bone.rotation.x = base.rotation.x + x;
  bone.rotation.y = base.rotation.y + y;
  bone.rotation.z = base.rotation.z + z;
}

function addBonePos(rig, bone, x = 0, y = 0, z = 0) {
  if (!rig || !bone) return;
  const base = rig.saved.get(bone);
  if (!base) return;
  bone.position.x = base.position.x + x;
  bone.position.y = base.position.y + y;
  bone.position.z = base.position.z + z;
}

function curlFingerChain(rig, chain = [], amount = 0, sideSpread = 0) {
  const grip = clamp(amount, 0, 1);
  chain.forEach((bone, index) => {
    const curl = index === 0 ? -0.38 : -0.72;
    const side = index === 0 ? sideSpread : sideSpread * 0.25;
    addBoneRot(rig, bone, curl * grip, 0.03 * grip, side * grip);
  });
}

function applyRightHandGrip(rig, gripAmount = 0) {
  if (!rig) return;
  const grip = clamp(gripAmount, 0, 1);
  const open = 1 - grip;
  curlFingerChain(rig, rig.rightIndex, grip, -0.08 + 0.08 * open);
  curlFingerChain(rig, rig.rightMiddle, grip, -0.02);
  curlFingerChain(rig, rig.rightRing, grip, 0.04 - 0.04 * open);
  curlFingerChain(rig, rig.rightPinky, grip, 0.09 - 0.06 * open);
  (rig.rightThumb || []).forEach((bone, index) => {
    const fold = index === 0 ? -0.28 : -0.48;
    addBoneRot(rig, bone, fold * grip, -0.24 * grip, 0.22 * grip);
  });
}

export function getSeatedHumanGripWorldPosition(rig, side = 'right') {
  if (!rig) return null;
  const tips = [
    rig[`${side}Thumb`]?.at(-1),
    rig[`${side}Index`]?.at(-1),
    rig[`${side}Middle`]?.at(-1)
  ].filter(Boolean);
  if (!tips.length) return null;
  const sum = new THREE.Vector3();
  tips.forEach((bone) => sum.add(bone.getWorldPosition(new THREE.Vector3())));
  return sum.multiplyScalar(1 / tips.length);
}

function rotateBoneTowardTarget(rig, bone, endBone, targetWorld, strength = 0.5) {
  if (!rig || !bone || !endBone || !targetWorld) return;
  const axisFrom = endBone.getWorldPosition(new THREE.Vector3()).sub(
    bone.getWorldPosition(new THREE.Vector3())
  );
  const axisTo = targetWorld.clone().sub(bone.getWorldPosition(new THREE.Vector3()));
  if (axisFrom.lengthSq() < 1e-6 || axisTo.lengthSq() < 1e-6) return;
  axisFrom.normalize();
  axisTo.normalize();
  const deltaQuat = new THREE.Quaternion().setFromUnitVectors(axisFrom, axisTo);
  const blendQuat = new THREE.Quaternion().slerpQuaternions(
    new THREE.Quaternion(),
    deltaQuat,
    THREE.MathUtils.clamp(strength, 0, 1)
  );
  bone.quaternion.premultiply(blendQuat);
  bone.updateMatrixWorld(true);
}

export function applySeatedHumanRightArmIK(rig, targetWorld, strength = 0.5) {
  if (!rig?.rightHand || !targetWorld) return;
  rotateBoneTowardTarget(rig, rig.rightUpperArm, rig.rightHand, targetWorld, strength * 0.62);
  rotateBoneTowardTarget(rig, rig.rightForeArm, rig.rightHand, targetWorld, strength * 0.9);
  rotateBoneTowardTarget(
    rig,
    rig.rightHand,
    rig.rightMiddle?.[rig.rightMiddle.length - 1] || rig.rightHand,
    targetWorld,
    strength * 0.4
  );
}

function getArmIKState(rig, side) {
  if (!rig || (side !== 'left' && side !== 'right')) return null;
  let states = seatedHumanArmIKStates.get(rig);
  if (!states) {
    states = {};
    seatedHumanArmIKStates.set(rig, states);
  }
  if (states[side]) return states[side];
  const upper = rig[`${side}UpperArm`];
  const lower = rig[`${side}ForeArm`];
  const hand = rig[`${side}Hand`];
  if (!upper || !lower || !hand) return null;
  hand.updateWorldMatrix(true, true);
  const forward = new THREE.Vector3();
  const across = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const fingerBases = ['Index', 'Middle', 'Ring'].map((name) => rig[`${side}${name}`]?.[0]).filter(Boolean);
  fingerBases.forEach((bone) => forward.add(hand.worldToLocal(bone.getWorldPosition(new THREE.Vector3()))));
  if (forward.lengthSq() < 1e-10) {
    forward.copy(hand.worldToLocal(lower.getWorldPosition(new THREE.Vector3()))).negate();
  }
  if (forward.lengthSq() < 1e-10) forward.set(0, 0, 1);
  forward.normalize();
  const index = rig[`${side}Index`]?.[0];
  const pinky = rig[`${side}Pinky`]?.[0];
  if (index && pinky) {
    across.copy(hand.worldToLocal(index.getWorldPosition(new THREE.Vector3())))
      .sub(hand.worldToLocal(pinky.getWorldPosition(new THREE.Vector3())));
    normal.crossVectors(forward, across).multiplyScalar(side === 'left' ? -1 : 1);
  }
  if (normal.lengthSq() < 1e-10) {
    normal.set(0, 1, 0).addScaledVector(forward, -forward.y);
    if (normal.lengthSq() < 1e-10) normal.set(1, 0, 0).addScaledVector(forward, -forward.x);
  }
  normal.normalize();
  across.crossVectors(normal, forward).normalize();
  normal.crossVectors(forward, across).normalize();
  const localBasisInverse = new THREE.Quaternion()
    .setFromRotationMatrix(new THREE.Matrix4().makeBasis(across, normal, forward)).invert();
  const state = {
    upper, lower, hand, forward, normal, localBasisInverse,
    tips: ['Thumb', 'Index', 'Middle'].map((name, index) =>
      rig[`${side}ContactTips`]?.[index] || rig[`${side}${name}`]?.at(-1)
    ).filter(Boolean),
    // Per-arm scratch objects keep this per-frame operation allocation-free.
    vectors: Array.from({ length: 17 }, () => new THREE.Vector3()),
    quaternions: Array.from({ length: 8 }, () => new THREE.Quaternion()),
    requestedWristTarget: new THREE.Vector3(),
    matrix: new THREE.Matrix4(),
    result: { applied: false, reachable: false, error: Infinity }
  };
  states[side] = state;
  return state;
}

function applySeatedHumanHandGrip(rig, side, amount) {
  if (side === 'right') {
    applyRightHandGrip(rig, amount);
    return;
  }
  const grip = clamp01(amount);
  // Mirror the lateral spread, while flexion stays in each bone's local frame.
  curlFingerChain(rig, rig.leftIndex, grip, 0.08 * grip);
  curlFingerChain(rig, rig.leftMiddle, grip, 0.02);
  curlFingerChain(rig, rig.leftRing, grip, -0.04 * grip);
  curlFingerChain(rig, rig.leftPinky, grip, -0.03 - 0.06 * grip);
  (rig.leftThumb || []).forEach((bone, index) => {
    addBoneRot(rig, bone, (index === 0 ? -0.28 : -0.48) * grip, 0.24 * grip, -0.22 * grip);
  });
}

function isFiniteVector(value) {
  return value && Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z);
}

function rotateArmBoneInWorld(bone, endpoint, target, state) {
  const origin = state.vectors[14];
  const from = state.vectors[15];
  const to = state.vectors[16];
  const parentRotation = state.quaternions[5];
  const delta = state.quaternions[6];
  const worldRotation = state.quaternions[7];
  bone.getWorldPosition(origin);
  endpoint.getWorldPosition(from).sub(origin);
  to.copy(target).sub(origin);
  if (from.lengthSq() < 1e-12 || to.lengthSq() < 1e-12) return;
  delta.setFromUnitVectors(from.normalize(), to.normalize());
  bone.getWorldQuaternion(worldRotation).premultiply(delta);
  if (bone.parent) {
    bone.parent.getWorldQuaternion(parentRotation).invert();
    worldRotation.premultiply(parentRotation);
  }
  bone.quaternion.copy(worldRotation).normalize();
  bone.updateWorldMatrix(false, true);
}

/**
 * Rotate an arm to a world-space surface contact without moving any scene root.
 * Bone lengths stay unchanged unless maxArmExtension is explicitly enabled.
 * Call after applySeatedHumanPose each frame.
 *
 * `targetWorld` is the contact on the domino/table, not its centre. Options:
 * - grip: finger closure (0..1); strength: pose blend (0..1, default 1).
 * - approachDirection: world direction from wrist toward fingers.
 * - palmNormal: world direction the palm faces (orthogonalized to approach).
 * - contactOffset: optional contact point in hand-local MODEL units; otherwise
 *   the current thumb/index/middle tips determine the actual grip centre.
 * - poleTarget: optional world elbow guide; otherwise preserve the pose's bend.
 * - maxArmExtension: opt-in length adjustment, capped at 1.65 of saved lengths;
 *   omitted/default 1 keeps the current bone translations unchanged.
 * Unreachable targets clamp to the arm's natural reach. The returned diagnostic
 * object is reused for this arm; copy it if a persistent snapshot is needed.
 */
export function applySeatedHumanArmIK(rig, side, targetWorld, options = {}) {
  const state = getArmIKState(rig, side);
  if (!state || !isFiniteVector(targetWorld)) return null;
  const strength = clamp01(options.strength, 1);
  if (strength === 0) return null;
  const { upper, lower, hand, vectors: v, quaternions: q } = state;
  const [shoulder, elbow, wrist, contactLocal, temp, handScale, approach, palm, lateral,
    wristTarget, direction, bend, elbowTarget, contactWorld] = v;
  const [oldUpper, oldLower, oldHand, handRotation, parentRotation] = q;
  oldUpper.copy(upper.quaternion);
  oldLower.copy(lower.quaternion);
  oldHand.copy(hand.quaternion);
  if (Number.isFinite(options.grip)) applySeatedHumanHandGrip(rig, side, options.grip);
  upper.updateWorldMatrix(true, true);
  upper.getWorldPosition(shoulder);
  lower.getWorldPosition(elbow);
  hand.getWorldPosition(wrist);
  hand.getWorldQuaternion(handRotation);
  hand.getWorldScale(handScale);
  contactLocal.set(0, 0, 0);
  if (isFiniteVector(options.contactOffset)) {
    contactLocal.copy(options.contactOffset);
  } else if (state.tips.length) {
    state.tips.forEach((bone) => contactLocal.add(hand.worldToLocal(bone.getWorldPosition(temp))));
    contactLocal.multiplyScalar(1 / state.tips.length);
  } else {
    // Fingerless rigs still aim the palm, rather than embedding the wrist.
    contactLocal.copy(state.forward).multiplyScalar(wrist.distanceTo(elbow) / Math.max(1e-6, handScale.length() / Math.sqrt(3)) * 0.28);
  }
  if (isFiniteVector(options.approachDirection) && approach.copy(options.approachDirection).lengthSq() > 1e-10) {
    approach.normalize();
    if (isFiniteVector(options.palmNormal)) palm.copy(options.palmNormal);
    else palm.copy(state.normal).applyQuaternion(handRotation);
    palm.addScaledVector(approach, -palm.dot(approach));
    if (palm.lengthSq() < 1e-10) {
      palm.set(0, 1, 0).addScaledVector(approach, -approach.y);
      if (palm.lengthSq() < 1e-10) palm.set(1, 0, 0).addScaledVector(approach, -approach.x);
    }
    palm.normalize();
    lateral.crossVectors(palm, approach).normalize();
    palm.crossVectors(approach, lateral).normalize();
    handRotation.setFromRotationMatrix(state.matrix.makeBasis(lateral, palm, approach))
      .multiply(state.localBasisInverse).normalize();
  }
  wristTarget.copy(targetWorld).sub(temp.copy(contactLocal).multiply(handScale).applyQuaternion(handRotation));
  state.requestedWristTarget.copy(wristTarget);
  let upperLength = shoulder.distanceTo(elbow);
  let lowerLength = elbow.distanceTo(wrist);
  if (upperLength < 1e-8 || lowerLength < 1e-8) return null;
  const extensionCap = clamp(Number.isFinite(options.maxArmExtension) ? options.maxArmExtension : 1, 1, 1.65);
  const savedLower = rig.saved?.get(lower)?.position;
  const savedHand = rig.saved?.get(hand)?.position;
  if (extensionCap > 1 && savedLower?.lengthSq() > 1e-12 && savedHand?.lengthSq() > 1e-12) {
    const upperRatio = lower.position.length() / savedLower.length();
    const lowerRatio = hand.position.length() / savedHand.length();
    const naturalReach = upperLength / upperRatio + lowerLength / lowerRatio;
    const requiredRatio = shoulder.distanceTo(wristTarget) / naturalReach + 1e-6;
    const extension = Math.min(extensionCap, Math.max(1, requiredRatio));
    // Always start from the saved lengths: repeated solves cannot compound a
    // torso helper's prior adjustment beyond the absolute per-arm cap.
    lower.position.copy(savedLower).multiplyScalar(extension);
    hand.position.copy(savedHand).multiplyScalar(extension);
    upper.updateWorldMatrix(false, true);
    lower.getWorldPosition(elbow);
    hand.getWorldPosition(wrist);
    upperLength = shoulder.distanceTo(elbow);
    lowerLength = elbow.distanceTo(wrist);
  }
  direction.copy(wristTarget).sub(shoulder);
  const requestedDistance = direction.length();
  if (requestedDistance < 1e-8) direction.copy(wrist).sub(shoulder);
  if (direction.lengthSq() < 1e-12) direction.set(0, 0, 1);
  direction.normalize();
  const minReach = Math.abs(upperLength - lowerLength) + 1e-7;
  const maxReach = upperLength + lowerLength - 1e-7;
  const distance = clamp(requestedDistance, minReach, maxReach);
  wristTarget.copy(shoulder).addScaledVector(direction, distance);
  if (isFiniteVector(options.poleTarget)) bend.copy(options.poleTarget).sub(shoulder);
  else bend.copy(elbow).sub(shoulder);
  bend.addScaledVector(direction, -bend.dot(direction));
  if (bend.lengthSq() < 1e-10) {
    bend.set(0, -1, 0).addScaledVector(direction, direction.y);
    if (bend.lengthSq() < 1e-10) bend.set(side === 'left' ? -1 : 1, 0, 0).addScaledVector(direction, -direction.x * (side === 'left' ? -1 : 1));
  }
  bend.normalize();
  const along = (upperLength * upperLength - lowerLength * lowerLength + distance * distance) / (2 * distance);
  const height = Math.sqrt(Math.max(0, upperLength * upperLength - along * along));
  elbowTarget.copy(shoulder).addScaledVector(direction, along).addScaledVector(bend, height);
  rotateArmBoneInWorld(upper, lower, elbowTarget, state);
  rotateArmBoneInWorld(lower, hand, wristTarget, state);
  hand.parent.getWorldQuaternion(parentRotation).invert();
  hand.quaternion.copy(parentRotation).multiply(handRotation).normalize();
  if (strength < 1) {
    upper.quaternion.slerpQuaternions(oldUpper, upper.quaternion, strength);
    lower.quaternion.slerpQuaternions(oldLower, lower.quaternion, strength);
    hand.quaternion.slerpQuaternions(oldHand, hand.quaternion, strength);
  }
  upper.updateWorldMatrix(false, true);
  contactWorld.copy(contactLocal);
  hand.localToWorld(contactWorld);
  state.result.applied = true;
  state.result.reachable = requestedDistance >= minReach && requestedDistance <= maxReach;
  state.result.error = contactWorld.distanceTo(targetWorld);
  return state.result;
}

/** Apply independent left/right contacts; either omitted side keeps its pose. */
export function applySeatedHumanHandTargets(rig, targets = {}) {
  if (targets.left) applySeatedHumanArmIK(rig, 'left', targets.left.position, targets.left);
  if (targets.right) applySeatedHumanArmIK(rig, 'right', targets.right.position, targets.right);
}

/**
 * Optional active-action reach: lean at the waist before solving the hand.
 * Call after the base seated pose and before independent rack-hand targets.
 * Hips, actor roots and objects stay fixed. Arm extension is opt-in and capped;
 * a new base pose restores the original bone translations on the next frame.
 * Options include the ArmIK contact options plus maxLean (radians, default 65°)
 * and maxArmExtension (length multiplier, default 1: no stretching).
 */
export function applySeatedHumanReachPose(rig, side, targetWorld, options = {}) {
  const state = getArmIKState(rig, side);
  if (!state || !rig.spine || !isFiniteVector(targetWorld)) return null;
  // Prefer a natural torso lean before using this action's optional arm cap.
  const solveOptions = { ...options, maxArmExtension: 1 };
  const firstResult = applySeatedHumanArmIK(rig, side, targetWorld, solveOptions);
  if (!firstResult) return null;
  const savedArmLength = rig.saved?.get(state.lower)?.position.length() || state.lower.position.length();
  const result = { ...firstResult, leanRadians: 0, armExtension: state.lower.position.length() / savedArmLength };
  if (firstResult.reachable || firstResult.error < 1e-4) return result;
  const spine = rig.spine;
  const pivot = spine.getWorldPosition(new THREE.Vector3());
  const shoulder = state.upper.getWorldPosition(new THREE.Vector3());
  const upperLength = shoulder.distanceTo(state.lower.getWorldPosition(new THREE.Vector3()));
  const lowerLength = state.lower.getWorldPosition(new THREE.Vector3()).distanceTo(state.hand.getWorldPosition(new THREE.Vector3()));
  const maxReach = upperLength + lowerLength - 1e-6;
  const wristTarget = state.requestedWristTarget.clone();
  const torso = shoulder.clone().sub(pivot);
  // Use the middle of both shoulders to bend forward without tilting sideways.
  const otherShoulder = rig[side === 'right' ? 'leftUpperArm' : 'rightUpperArm'];
  if (otherShoulder) torso.add(otherShoulder.getWorldPosition(new THREE.Vector3()).sub(pivot)).multiplyScalar(0.5);
  const towardContact = wristTarget.clone().sub(pivot);
  const axis = new THREE.Vector3().crossVectors(torso, towardContact);
  if (axis.lengthSq() < 1e-10) return result;
  axis.normalize();
  const maxLean = clamp(Number.isFinite(options.maxLean) ? options.maxLean : THREE.MathUtils.degToRad(65), 0, THREE.MathUtils.degToRad(88));
  const shoulderOffset = shoulder.clone().sub(pivot);
  const candidate = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const distanceAt = (angle) => candidate.copy(shoulderOffset)
    .applyQuaternion(rotation.setFromAxisAngle(axis, angle)).add(pivot).distanceTo(wristTarget);
  let bestAngle = 0;
  let bestDistance = distanceAt(0);
  for (let step = 1; step <= 12; step += 1) {
    const angle = maxLean * step / 12;
    const distance = distanceAt(angle);
    if (distance < bestDistance) { bestDistance = distance; bestAngle = angle; }
    if (distance <= maxReach) {
      let low = maxLean * (step - 1) / 12;
      let high = angle;
      for (let i = 0; i < 7; i += 1) {
        const mid = (low + high) * 0.5;
        if (distanceAt(mid) <= maxReach) high = mid;
        else low = mid;
      }
      bestAngle = high;
      break;
    }
  }
  if (bestAngle > 0) {
    const spineWorld = spine.getWorldQuaternion(new THREE.Quaternion());
    const parentInverse = spine.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    rotation.setFromAxisAngle(axis, bestAngle);
    spine.quaternion.copy(parentInverse).multiply(rotation).multiply(spineWorld).normalize();
    spine.updateWorldMatrix(false, true);
    result.leanRadians = bestAngle;
  }
  let solved = applySeatedHumanArmIK(rig, side, targetWorld, solveOptions);
  const allowedExtension = clamp(Number.isFinite(options.maxArmExtension) ? options.maxArmExtension : 1, 1, 1.65);
  if (!solved.reachable && allowedExtension > 1) {
    solved = applySeatedHumanArmIK(rig, side, targetWorld, { ...options, maxArmExtension: allowedExtension });
    result.armExtension = state.lower.position.length() / savedArmLength;
  }
  result.applied = solved.applied;
  result.reachable = solved.reachable;
  result.error = solved.error;
  return result;
}

export function applySeatedHumanPose(rig, mode = 'idle', intensity = 1, handGrip = 0, motionProfile = null) {
  if (!rig) return;
  resetBoneRig(rig);
  const t = smooth01(intensity);
  const breathe = Math.sin(performance.now() * 0.002) * 0.01;

  addBonePos(rig, rig.hips, 0, -0.332, -0.052);
  addBoneRot(rig, rig.hips, -0.08, 0, 0);
  addBoneRot(rig, rig.spine, 0.18 + breathe, 0, 0);
  addBoneRot(rig, rig.chest, 0.16 + breathe * 0.5, 0, 0);
  addBoneRot(rig, rig.neck, -0.02, 0, 0);
  addBoneRot(rig, rig.head, -0.03, 0, 0);

  addBoneRot(rig, rig.leftUpperLeg, -1.18, 0.14, 0.04);
  addBoneRot(rig, rig.leftLowerLeg, -1.2, 0.02, 0.01);
  addBoneRot(rig, rig.leftFoot, 0.14, 0.04, 0.02);
  addBoneRot(rig, rig.rightUpperLeg, -1.18, 0.02, -0.03);
  addBoneRot(rig, rig.rightLowerLeg, -1.2, -0.02, -0.01);
  addBoneRot(rig, rig.rightFoot, 0.14, -0.03, -0.02);

  addBoneRot(rig, rig.leftUpperArm, -0.54, 0.03, 0.18);
  addBoneRot(rig, rig.leftForeArm, -0.18, 0.02, -0.04);
  addBoneRot(rig, rig.leftHand, -0.06, 0.01, 0.01);
  let shoulderX = -0.54;
  let shoulderY = -0.03;
  let shoulderZ = -0.18;
  let forearmX = -0.18;
  let forearmY = -0.02;
  let forearmZ = 0.04;
  let wristX = -0.06;
  let wristY = 0.02;
  let wristZ = 0.02;
  let chestX = 0.16;
  let headX = -0.03;
  const forwardReach = clamp01(motionProfile?.forwardReach, 0);
  const sideReach = THREE.MathUtils.clamp(motionProfile?.sideReach ?? 0, -1, 1);

  if (mode === 'reachPiece') {
    shoulderX = THREE.MathUtils.lerp(shoulderX, -1.22, t);
    shoulderY = THREE.MathUtils.lerp(shoulderY, 0.14, t);
    shoulderZ = THREE.MathUtils.lerp(shoulderZ, -1.34, t);
    forearmX = THREE.MathUtils.lerp(forearmX, -1.04, t);
    forearmY = THREE.MathUtils.lerp(forearmY, -0.28, t);
    forearmZ = THREE.MathUtils.lerp(forearmZ, -0.38, t);
    wristX = THREE.MathUtils.lerp(wristX, -0.4, t);
    wristY = THREE.MathUtils.lerp(wristY, 0.2, t);
    wristZ = THREE.MathUtils.lerp(wristZ, -0.34, t);
    chestX = THREE.MathUtils.lerp(chestX, 0.28, t);
    headX = THREE.MathUtils.lerp(headX, 0.04, t);
  } else if (mode === 'gripPiece') {
    shoulderX = THREE.MathUtils.lerp(shoulderX, -1.28, t);
    shoulderY = THREE.MathUtils.lerp(shoulderY, 0.14, t);
    shoulderZ = THREE.MathUtils.lerp(shoulderZ, -1.32, t);
    forearmX = THREE.MathUtils.lerp(forearmX, -1.14, t);
    forearmY = THREE.MathUtils.lerp(forearmY, -0.18, t);
    forearmZ = THREE.MathUtils.lerp(forearmZ, -0.3, t);
    wristX = THREE.MathUtils.lerp(wristX, -0.46, t);
    wristY = THREE.MathUtils.lerp(wristY, 0.2, t);
    wristZ = THREE.MathUtils.lerp(wristZ, -0.28, t);
    chestX = THREE.MathUtils.lerp(chestX, 0.3, t);
    headX = THREE.MathUtils.lerp(headX, 0.05, t);
  } else if (mode === 'carryPiece') {
    shoulderX = THREE.MathUtils.lerp(shoulderX, -0.98, t);
    shoulderY = THREE.MathUtils.lerp(shoulderY, -0.02, t);
    shoulderZ = THREE.MathUtils.lerp(shoulderZ, -1.16, t);
    forearmX = THREE.MathUtils.lerp(forearmX, -0.62, t);
    forearmY = THREE.MathUtils.lerp(forearmY, -0.14, t);
    forearmZ = THREE.MathUtils.lerp(forearmZ, -0.09, t);
    wristX = THREE.MathUtils.lerp(wristX, -0.02, t);
    wristY = THREE.MathUtils.lerp(wristY, 0.2, t);
    wristZ = THREE.MathUtils.lerp(wristZ, -0.1, t);
    chestX = THREE.MathUtils.lerp(chestX, 0.24, t);
    headX = THREE.MathUtils.lerp(headX, 0.03, t);
  } else if (mode === 'placePiece') {
    shoulderX = THREE.MathUtils.lerp(shoulderX, -1.2, t);
    shoulderY = THREE.MathUtils.lerp(shoulderY, 0.1, t);
    shoulderZ = THREE.MathUtils.lerp(shoulderZ, -1.26, t);
    forearmX = THREE.MathUtils.lerp(forearmX, -1.18, t);
    forearmY = THREE.MathUtils.lerp(forearmY, -0.28, t);
    forearmZ = THREE.MathUtils.lerp(forearmZ, -0.38, t);
    wristX = THREE.MathUtils.lerp(wristX, -0.48, t);
    wristY = THREE.MathUtils.lerp(wristY, 0.2, t);
    wristZ = THREE.MathUtils.lerp(wristZ, -0.32, t);
    chestX = THREE.MathUtils.lerp(chestX, 0.29, t);
    headX = THREE.MathUtils.lerp(headX, 0.06, t);
  }

  const reachForwardDelta = forwardReach * SEATED_HUMAN_REACH_FORWARD_GAIN;
  const reachSideDelta = sideReach * SEATED_HUMAN_REACH_SIDE_GAIN;
  shoulderX = THREE.MathUtils.lerp(shoulderX, shoulderX - reachForwardDelta, t);
  shoulderY = THREE.MathUtils.lerp(shoulderY, shoulderY + reachSideDelta * 0.32, t);
  shoulderZ = THREE.MathUtils.lerp(shoulderZ, shoulderZ - reachSideDelta * 0.5, t);
  forearmX = THREE.MathUtils.lerp(forearmX, forearmX - reachForwardDelta * 0.88, t);
  forearmY = THREE.MathUtils.lerp(forearmY, forearmY + reachSideDelta * 0.22, t);
  forearmZ = THREE.MathUtils.lerp(forearmZ, forearmZ - reachSideDelta * 0.36, t);
  wristY = THREE.MathUtils.lerp(wristY, wristY + reachSideDelta * 0.2, t);
  wristZ = THREE.MathUtils.lerp(wristZ, wristZ - reachSideDelta * 0.16, t);
  chestX = THREE.MathUtils.lerp(
    chestX,
    chestX + reachForwardDelta * SEATED_HUMAN_TORSO_REACH_GAIN,
    t
  );
  headX = THREE.MathUtils.lerp(
    headX,
    headX + reachForwardDelta * SEATED_HUMAN_HEAD_REACH_GAIN,
    t
  );

  addBoneRot(rig, rig.chest, chestX, 0, 0);
  addBoneRot(rig, rig.head, headX, 0, 0);
  addBoneRot(rig, rig.rightUpperArm, shoulderX, shoulderY, shoulderZ);
  addBoneRot(rig, rig.rightForeArm, forearmX, forearmY, forearmZ);
  addBoneRot(rig, rig.rightHand, wristX, wristY, wristZ);
  applyRightHandGrip(rig, handGrip);
}

function createSeatedHumanFallbackTexture(primary = '#cdb8a0', secondary = '#8a6a4e') {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, primary);
  grad.addColorStop(1, secondary);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 180; i += 1) {
    const x = (i * 53) % size;
    const y = (i * 79) % size;
    const w = 8 + ((i * 11) % 22);
    const h = 4 + ((i * 7) % 14);
    ctx.globalAlpha = 0.09 + (i % 4) * 0.06;
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.55)';
    ctx.fillRect(x, y, w, h);
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  applySRGBColorSpace(tex);
  tex.flipY = false;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function normalizeHumanModelUrlCandidates(modelUrls = []) {
  const next = [];
  const seen = new Set();
  const push = (value) => {
    if (!value || typeof value !== 'string') return;
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    next.push(normalized);
  };
  modelUrls.forEach((url) => {
    push(url);
    const normalizedUrl = `${url || ''}`.trim();
    const lowerUrl = normalizedUrl.toLowerCase();
    if (lowerUrl.endsWith('.glb')) push(normalizedUrl.replace(/\.glb(\?.*)?$/i, '.gltf$1'));
    else if (lowerUrl.endsWith('.gltf')) push(normalizedUrl.replace(/\.gltf(\?.*)?$/i, '.glb$1'));
    if (lowerUrl.includes('/gltf/')) {
      push(normalizedUrl.replace(/\/gltf\//i, '/glTF-Binary/'));
      push(normalizedUrl.replace(/\/gltf\//i, '/glb/'));
      push(normalizedUrl.replace(/\/gltf\//i, '/GLB/'));
    }
    const rawGithubMatch = url.match(/^https?:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/);
    if (rawGithubMatch) {
      const [, owner, repo, branch, path] = rawGithubMatch;
      push(`https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/${path}`);
      push(`https://cdn.statically.io/gh/${owner}/${repo}/${branch}/${path}`);
    }
  });
  return next;
}

function getRenderableMeshBounds(object) {
  const box = new THREE.Box3();
  let hasMeshBounds = false;
  object?.updateMatrixWorld?.(true);
  object?.traverse?.((node) => {
    if (!node?.isMesh) return;
    const nodeBox = new THREE.Box3().setFromObject(node);
    if (!Number.isFinite(nodeBox.min.y) || !Number.isFinite(nodeBox.max.y)) return;
    box.expandByPoint(nodeBox.min);
    box.expandByPoint(nodeBox.max);
    hasMeshBounds = true;
  });
  return hasMeshBounds ? box : null;
}

const CHESS_DOMINO_CHARACTER_CLOTH_MATERIALS = Object.freeze({
  denim: {
    source: 'Poly Haven denim_fabric 1k glTF CC0',
    color: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/denim_fabric/denim_fabric_diff_1k.jpg',
    normal: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/denim_fabric/denim_fabric_nor_gl_1k.jpg',
    roughness: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/denim_fabric/denim_fabric_rough_1k.jpg',
    tint: 0x314d86
  },
  check: {
    source: 'Poly Haven gingham_check 1k glTF CC0',
    color: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/gingham_check/gingham_check_diff_1k.jpg',
    normal: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/gingham_check/gingham_check_nor_gl_1k.jpg',
    roughness: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/gingham_check/gingham_check_rough_1k.jpg',
    tint: 0x9f3651
  },
  hessian: {
    source: 'Poly Haven hessian_230 1k glTF CC0',
    color: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/hessian_230/hessian_230_diff_1k.jpg',
    normal: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/hessian_230/hessian_230_nor_gl_1k.jpg',
    roughness: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/hessian_230/hessian_230_rough_1k.jpg',
    tint: 0xa27445
  },
  floral: {
    source: 'Poly Haven floral_jacquard 1k glTF CC0',
    color: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/floral_jacquard/floral_jacquard_diff_1k.jpg',
    normal: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/floral_jacquard/floral_jacquard_nor_gl_1k.jpg',
    roughness: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/floral_jacquard/floral_jacquard_rough_1k.jpg',
    tint: 0x6d3f7f
  },
  fleece: {
    source: 'Poly Haven knitted_fleece 1k glTF CC0',
    color: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/knitted_fleece/knitted_fleece_diff_1k.jpg',
    normal: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/knitted_fleece/knitted_fleece_nor_gl_1k.jpg',
    roughness: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/knitted_fleece/knitted_fleece_rough_1k.jpg',
    tint: 0x4b5563
  },
  picnic: {
    source: 'Poly Haven fabric_pattern_07 1k glTF CC0',
    color: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/fabric_pattern_07/fabric_pattern_07_col_1_1k.jpg',
    normal: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/fabric_pattern_07/fabric_pattern_07_nor_gl_1k.jpg',
    roughness: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/fabric_pattern_07/fabric_pattern_07_rough_1k.jpg',
    tint: 0xc44f42
  }
});

const CHESS_DOMINO_CHARACTER_CLOTH_COMBOS = Object.freeze({
  royalDenim: { upper: { material: 'denim', tint: 0x2f5f9f, repeat: 4.2 }, lower: { material: 'hessian', tint: 0x9b6b3f, repeat: 3.4 }, accent: { material: 'fleece', tint: 0xd8dee9, repeat: 5 } },
  casinoCheck: { upper: { material: 'check', tint: 0xb7375d, repeat: 3.8 }, lower: { material: 'denim', tint: 0x243e70, repeat: 4.4 }, accent: { material: 'hessian', tint: 0xf4d7a1, repeat: 3.2 } },
  linenStreet: { upper: { material: 'hessian', tint: 0xb68452, repeat: 3.6 }, lower: { material: 'fleece', tint: 0x374151, repeat: 5.2 }, accent: { material: 'denim', tint: 0x4a6fa4, repeat: 4 } },
  jacquardNight: { upper: { material: 'floral', tint: 0x7c3f88, repeat: 3.2 }, lower: { material: 'denim', tint: 0x1f335f, repeat: 4.5 }, accent: { material: 'check', tint: 0xe3c16f, repeat: 4 } },
  softFleece: { upper: { material: 'fleece', tint: 0x556070, repeat: 5.3 }, lower: { material: 'hessian', tint: 0x8b633f, repeat: 3.7 }, accent: { material: 'floral', tint: 0xb88ab8, repeat: 3 } },
  patternedRed: { upper: { material: 'picnic', tint: 0xc44f42, repeat: 3.4 }, lower: { material: 'denim', tint: 0x263f73, repeat: 4.7 }, accent: { material: 'fleece', tint: 0xf1f5f9, repeat: 5 } },
  mixedDenim: { upper: { material: 'denim', tint: 0x3b6ea8, repeat: 4 }, lower: { material: 'check', tint: 0x4f6f93, repeat: 4.2 }, accent: { material: 'hessian', tint: 0xd6a35f, repeat: 3.2 } }
});

function loadChessDominoCharacterTexture(url, { isColor = false, repeat = 4, maxAnisotropy = 1 } = {}) {
  if (!url) return null;
  const cacheKey = `${url}|${isColor ? 'color' : 'data'}|${repeat}`;
  if (chessDominoCharacterTextureCache.has(cacheKey)) return chessDominoCharacterTextureCache.get(cacheKey);
  if (!chessDominoCharacterTextureLoader) {
    chessDominoCharacterTextureLoader = new THREE.TextureLoader();
    chessDominoCharacterTextureLoader.setCrossOrigin?.('anonymous');
  }
  const texture = chessDominoCharacterTextureLoader.load(url, (loaded) => {
    loaded.needsUpdate = true;
  }, undefined, () => chessDominoCharacterTextureCache.delete(cacheKey));
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  normalizePbrTexture(texture, maxAnisotropy);
  if (isColor) applySRGBColorSpace(texture);
  texture.userData.chessDominoCanDispose = false;
  chessDominoCharacterTextureCache.set(cacheKey, texture);
  return texture;
}

function isChessHumanNearlyWhiteMaterial(mat) {
  if (!mat?.color) return false;
  return mat.color.r > 0.82 && mat.color.g > 0.82 && mat.color.b > 0.82 && !mat.map;
}

function isChessHumanLowSaturationLightMaterial(mat) {
  if (!mat?.color || mat.map) return false;
  const max = Math.max(mat.color.r, mat.color.g, mat.color.b);
  const min = Math.min(mat.color.r, mat.color.g, mat.color.b);
  return max > 0.72 && max - min < 0.18;
}

function classifyChessDominoHumanSurface(obj, mat) {
  const name = `${obj?.name || ''} ${mat?.name || ''}`.toLowerCase();
  if (/eye|iris|pupil|cornea|wolf3d_eyes/.test(name)) return 'eye';
  if (/hair|brow|beard|mustache|moustache|lash|wolf3d_hair|wolf3d_beard|wolf3d_eyebrow/.test(name)) return 'hair';
  if (/teeth|tooth|tongue|mouth|gum/.test(name)) return 'mouth';
  if (/shoe|boot|sole|sneaker|footwear|wolf3d_outfit_footwear/.test(name)) return 'shoe';
  if (/skin|head|face|neck|hand|finger|wolf3d_head|wolf3d_body|bodymesh/.test(name) && !/outfit|shirt|pants|trouser|shoe|sock|cloth|jacket|hood|dress|skirt|uniform|suit/.test(name)) return 'skin';
  if (/shirt|top|torso|chest|jacket|hood|dress|skirt|sleeve|upper|outfit_top|wolf3d_outfit_top/.test(name)) return 'upperCloth';
  if (/pants|trouser|jean|short|legging|bottom|outfit_bottom|wolf3d_outfit_bottom/.test(name)) return 'lowerCloth';
  if (/tie|scarf|belt|strap|bag|hat|cap|glove|sock|accessory|accent/.test(name)) return 'accentCloth';
  if (/cloth|clothing|uniform|outfit|suit/.test(name)) return 'upperCloth';
  if (isChessHumanNearlyWhiteMaterial(mat) && /torso|chest|spine|pelvis|hip|leg|arm|body|mesh/.test(name)) return 'upperCloth';
  return 'other';
}

function resolveChessDominoClothSlot(option, slot, seatIndex = 0) {
  const combo = CHESS_DOMINO_CHARACTER_CLOTH_COMBOS[option?.dominoClothTheme] || CHESS_DOMINO_CHARACTER_CLOTH_COMBOS.royalDenim;
  const slotConfig = combo?.[slot] || combo?.upper || { material: 'denim' };
  const material = CHESS_DOMINO_CHARACTER_CLOTH_MATERIALS[slotConfig.material] || CHESS_DOMINO_CHARACTER_CLOTH_MATERIALS.denim;
  const repeatBoost = seatIndex === 0 ? 0.75 : 0;
  return {
    ...material,
    tint: slotConfig.tint ?? material.tint ?? 0xffffff,
    repeat: (slotConfig.repeat ?? 3.5) + repeatBoost
  };
}

function applyChessDominoClothMaterial(mat, cloth, maxAnisotropy = 1) {
  mat.map = loadChessDominoCharacterTexture(cloth.color, { isColor: true, repeat: cloth.repeat, maxAnisotropy });
  mat.normalMap = loadChessDominoCharacterTexture(cloth.normal, { repeat: cloth.repeat, maxAnisotropy });
  mat.roughnessMap = loadChessDominoCharacterTexture(cloth.roughness, { repeat: cloth.repeat, maxAnisotropy });
  mat.color = new THREE.Color(cloth.tint ?? 0xffffff);
  mat.normalScale = new THREE.Vector2(0.28, 0.28);
  mat.roughness = 0.86;
  mat.metalness = 0.015;
  mat.userData = { ...(mat.userData || {}), chessDominoCloth: cloth.source };
}

function enhanceChessDominoCharacterMaterials(instance, option, maxAnisotropy = 1, seatIndex = 0) {
  if (!option?.dominoClothTheme || !instance?.traverse) return;
  const clothSlots = {
    upperCloth: resolveChessDominoClothSlot(option, 'upper', seatIndex),
    lowerCloth: resolveChessDominoClothSlot(option, 'lower', seatIndex),
    accentCloth: resolveChessDominoClothSlot(option, 'accent', seatIndex)
  };
  const skinColor = new THREE.Color(option?.skinTone ?? 0xd2a07c);
  const hairColor = new THREE.Color(option?.hairColor ?? 0x21150f);
  const eyeColor = new THREE.Color(option?.eyeColor ?? 0x3f5f75);

  instance.traverse((obj) => {
    if (!obj?.isMesh) return;
    const sourceMaterials = Array.isArray(obj.material) ? obj.material : [obj.material];
    const enhancedMaterials = sourceMaterials.map((sourceMat) => {
      if (!sourceMat) return sourceMat;
      const mat = sourceMat.clone ? sourceMat.clone() : new THREE.MeshStandardMaterial();
      const surface = classifyChessDominoHumanSurface(obj, mat);
      if (clothSlots[surface]) {
        applyChessDominoClothMaterial(mat, clothSlots[surface], maxAnisotropy);
      } else if (surface === 'hair') {
        mat.map = null;
        mat.color = hairColor.clone();
        mat.roughness = 0.56;
        mat.metalness = 0.02;
        mat.envMapIntensity = 0.28;
      } else if (surface === 'eye') {
        mat.map = null;
        mat.color = eyeColor.clone();
        mat.roughness = 0.18;
        mat.metalness = 0;
        mat.envMapIntensity = 1.1;
      } else if (surface === 'skin') {
        if (isChessHumanLowSaturationLightMaterial(mat)) mat.color = skinColor.clone();
        mat.roughness = Math.min(mat.roughness ?? 0.62, 0.62);
        mat.metalness = 0;
      } else if (surface === 'shoe') {
        if (isChessHumanLowSaturationLightMaterial(mat)) mat.color = new THREE.Color(0x111827);
        mat.roughness = 0.78;
        mat.metalness = 0.02;
      } else if (surface === 'mouth') {
        if (isChessHumanNearlyWhiteMaterial(mat)) mat.color = new THREE.Color(0xf8fafc);
        mat.roughness = 0.32;
        mat.metalness = 0;
      } else if (isChessHumanNearlyWhiteMaterial(mat)) {
        mat.color = skinColor.clone();
        mat.roughness = 0.58;
        mat.metalness = 0;
      }
      if (mat.map) normalizePbrTexture(mat.map, maxAnisotropy);
      if (mat.normalMap) normalizePbrTexture(mat.normalMap, maxAnisotropy);
      if (mat.roughnessMap) normalizePbrTexture(mat.roughnessMap, maxAnisotropy);
      mat.needsUpdate = true;
      return mat;
    });
    obj.material = Array.isArray(obj.material) ? enhancedMaterials : enhancedMaterials[0];
  });
}

function normalizeSeatedHumanRootToChair(root) {
  const box = getRenderableMeshBounds(root);
  if (!box) return;
  const centerX = (box.min.x + box.max.x) * 0.5;
  const centerZ = (box.min.z + box.max.z) * 0.5;
  root.position.x -= centerX;
  root.position.z -= centerZ;
  root.position.y -= box.min.y;
  root.updateMatrixWorld(true);
}

function measureObjectHeight(object) {
  if (!object) return SEATED_HUMAN_BASE_HEIGHT;
  const box = getRenderableMeshBounds(object) || new THREE.Box3().setFromObject(object);
  if (!Number.isFinite(box.min.y) || !Number.isFinite(box.max.y)) return SEATED_HUMAN_BASE_HEIGHT;
  return Math.max(0.01, box.max.y - box.min.y);
}

export function computeSeatedHumanScale(actorTemplate, targetHeight) {
  const measuredHeight = measureObjectHeight(actorTemplate);
  return (targetHeight / Math.max(measuredHeight, 0.01)) * SEATED_HUMAN_VISUAL_SCALE_MULTIPLIER;
}

export function createRestoredSeatedHumanActor(
  actorTemplate,
  chairGroup,
  { targetHeight = 1.13, seatHeight = 0, supportsArmrest = true } = {}
) {
  if (!actorTemplate?.isObject3D || !chairGroup?.isObject3D) return null;
  const actor = cloneSkeleton(actorTemplate);
  // Keep restored actors on the same visual scale path as the original seated
  // humans.  The loader stores the historic 4.35 presentation multiplier (and
  // any character-specific adapter) here; recomputing only the literal height
  // made restored Snake players a fraction of their former on-screen size.
  const storedScale = Number(actorTemplate.userData?.seatedHumanScale);
  const seatedScale = Number.isFinite(storedScale) && storedScale > 0
    ? storedScale
    : computeSeatedHumanScale(actor, targetHeight);
  actor.scale.multiplyScalar(seatedScale);
  chairGroup.add(actor);

  const rig = saveSeatedHumanBoneRig(actor);
  if (!rig.hips || !rig.leftHand || !rig.rightHand) {
    actor.removeFromParent();
    return null;
  }

  applySeatedHumanPose(rig, 'idle', 1, 0, {}, {}, supportsArmrest);
  actor.updateMatrixWorld(true);
  const seatWorld = chairGroup.localToWorld(new THREE.Vector3(0, seatHeight, 0));
  const hipsWorld = rig.hips.getWorldPosition(new THREE.Vector3());
  const actorWorld = actor.getWorldPosition(new THREE.Vector3()).add(seatWorld.sub(hipsWorld));
  actor.position.copy(chairGroup.worldToLocal(actorWorld));
  actor.rotation.y += Number(actorTemplate.userData?.seatedYawOffset) || 0;
  actor.position.y += Number(actorTemplate.userData?.seatedYOffset) || 0;
  actor.position.z += Number(actorTemplate.userData?.seatedZOffset) || 0;
  actor.updateMatrixWorld(true);
  return { actor, rig };
}

export async function loadSeatedHumanTemplate({
  option,
  renderer = null,
  maxAnisotropy = 1,
  targetHeight = 1,
  createLoader
} = {}) {
  const fallbackOption = CHESS_HUMAN_CHARACTER_OPTIONS[0] || {};
  const selectedOption = option || fallbackOption;
  const cacheKey = `${selectedOption.id || fallbackOption.id || 'default'}:${targetHeight}`;
  const cached = seatedHumanTemplatePromiseById.get(cacheKey);
  if (cached) return cached;
  const promise = (async () => {
    const loader = createLoader ? createLoader(renderer) : null;
    if (!loader?.loadAsync) throw new Error('Missing seated human GLTF loader');
    loader.setCrossOrigin?.('anonymous');
    const modelUrls = Array.isArray(selectedOption?.modelUrls) ? selectedOption.modelUrls.filter(Boolean) : [];
    const candidateUrls = modelUrls.length ? normalizeHumanModelUrlCandidates(modelUrls) : [SEATED_HUMAN_DEFAULT_MODEL_URL].filter(Boolean);
    let lastError = null;
    let root = null;
    for (const url of candidateUrls) {
      try {
        const gltf = await loader.loadAsync(url);
        root = gltf?.scene || gltf?.scenes?.[0];
        if (root) break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!root) throw lastError || new Error('Missing seated human scene');

    normalizeSeatedHumanRootToChair(root);
    const selectedAdapter = selectedOption?.seatedAdapter || {};
    const skinTex = createSeatedHumanFallbackTexture('#d8c0a6', '#b48d6b');
    const clothTex = createSeatedHumanFallbackTexture('#55739a', '#2c3f54');
    const hairTex = createSeatedHumanFallbackTexture('#7b5d3f', '#3f2f20');
    [skinTex, clothTex, hairTex].forEach((texture) => normalizePbrTexture(texture, maxAnisotropy));
    root.traverse((obj) => {
      if (!obj?.isMesh) return;
      obj.castShadow = true;
      obj.receiveShadow = true;
      obj.frustumCulled = false;
      const meshName = `${obj.name || ''}`.toLowerCase();
      const useSkin = /head|face|neck|ear|hand/.test(meshName);
      const useHair = /hair|beard|mustache|moustache|eyebrow/.test(meshName);
      const fallbackTex = useHair ? hairTex : useSkin ? skinTex : clothTex;
      const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
      const hasOriginalTexture = mats.some((mat) => Boolean(mat?.map || mat?.emissiveMap || mat?.normalMap || mat?.roughnessMap || mat?.metalnessMap));
      mats.forEach((mat) => {
        const needsFallbackMap = !hasOriginalTexture && !mat?.map;
        if (needsFallbackMap) mat.map = fallbackTex;
        if (needsFallbackMap && mat?.color?.setHex) mat.color.setHex(0xffffff);
        if (mat?.map) {
          applySRGBColorSpace(mat.map);
          normalizePbrTexture(mat.map, maxAnisotropy);
        }
        if (mat?.emissiveMap) {
          applySRGBColorSpace(mat.emissiveMap);
          normalizePbrTexture(mat.emissiveMap, maxAnisotropy);
        }
        if (mat?.normalMap) normalizePbrTexture(mat.normalMap, maxAnisotropy);
        if (mat?.roughnessMap) normalizePbrTexture(mat.roughnessMap, maxAnisotropy);
        if (mat?.metalnessMap) normalizePbrTexture(mat.metalnessMap, maxAnisotropy);
        mat.needsUpdate = true;
      });
    });
    enhanceChessDominoCharacterMaterials(root, selectedOption, maxAnisotropy, 0);
    const seatedScaleMultiplier = Number.isFinite(selectedAdapter?.seatedScaleMultiplier) ? selectedAdapter.seatedScaleMultiplier : 1;
    root.userData = {
      ...(root.userData || {}),
      seatedHumanScale: computeSeatedHumanScale(root, targetHeight) * seatedScaleMultiplier,
      seatedYawOffset: Number.isFinite(selectedAdapter?.seatedYawOffset) ? selectedAdapter.seatedYawOffset : 0,
      seatedYOffset: Number.isFinite(selectedAdapter?.seatedYOffset) ? selectedAdapter.seatedYOffset : 0,
      seatedZOffset: Number.isFinite(selectedAdapter?.seatedZOffset) ? selectedAdapter.seatedZOffset : 0
    };
    return root;
  })();
  seatedHumanTemplatePromiseById.set(cacheKey, promise);
  promise.catch(() => seatedHumanTemplatePromiseById.delete(cacheKey));
  return promise;
}
