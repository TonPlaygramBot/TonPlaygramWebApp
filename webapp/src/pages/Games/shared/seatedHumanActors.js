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
  const skinMeshes = [];
  modelRoot?.traverse?.((obj) => {
    if (obj?.isBone) bones.push(obj);
    if (obj?.isSkinnedMesh && obj.geometry?.attributes?.skinIndex && obj.geometry?.attributes?.skinWeight) skinMeshes.push(obj);
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
    skinMeshes,
    modelRoot,
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
    // Index-to-pinky winding points toward the dorsum for RPM/Mixamo hands.
    // The palm faces the opposite side (toward the body in the bind A-pose).
    normal.crossVectors(forward, across).multiplyScalar(side === 'left' ? 1 : -1);
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
    lastContactLocal: new THREE.Vector3(),
    surfaceNormal: new THREE.Vector3(),
    surfacePadding: 0,
    skinSources: null,
    skinHull: [],
    pinchHull: [],
    indexHull: [],
    skinHullKey: '',
    matrix: new THREE.Matrix4(),
    result: { applied: false, reachable: false, error: Infinity }
  };
  const palmWorld = normal.clone().applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion()));
  state.digits = {};
  for (const name of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']) {
    state.digits[name] = (rig[`${side}${name}`] || []).map((bone, index, chain) => {
      const next = chain[index + 1] || bone.children.find((child) => child.isBone);
      const along = next ? next.position.clone().normalize() : new THREE.Vector3(0, 1, 0);
      const localPalm = palmWorld.clone().applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion()).invert());
      const flexAxis = new THREE.Vector3().crossVectors(along, localPalm).normalize();
      return { bone, next, flexAxis, base: new THREE.Quaternion().setFromEuler(rig.saved.get(bone)?.rotation || bone.rotation) };
    });
  }
  state.padRadius = (rig[`${side}Index`]?.[1]?.position.length() || 0.04) * 0.2;
  state.skinPadTips = {};
  // Some RPM terminal marker bones extend beyond the rendered fingertip.
  // Opposition must aim the actual distal skin caps, not those helper markers.
  for (const name of ['Thumb', 'Index']) {
    const distal = state.digits[name].at(-1);
    if (!distal) continue;
    const along = distal.next?.position.clone().normalize() || new THREE.Vector3(0, 1, 0);
    const candidates = [];
    const samples = [];
    const jointData = new THREE.Vector4();
    const weightData = new THREE.Vector4();
    for (const mesh of rig.skinMeshes || []) {
      mesh.updateMatrixWorld(true);
      const joints = mesh.geometry.attributes.skinIndex;
      const weights = mesh.geometry.attributes.skinWeight;
      for (let index = 0; index < joints.count; index += 1) {
        jointData.fromBufferAttribute(joints, index); weightData.fromBufferAttribute(weights, index);
        let weight = 0;
        for (let j = 0; j < 4; j += 1) if (mesh.skeleton.bones[jointData.getComponent(j)] === distal.bone) weight += weightData.getComponent(j);
        if (name === 'Thumb' && weight >= 0.5) samples.push({ mesh, index });
        if (weight < 0.98) continue;
        candidates.push(distal.bone.worldToLocal(mesh.getVertexPosition(index, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld)));
      }
    }
    if (candidates.length) {
      const end = Math.max(...candidates.map((point) => point.dot(along)));
      const cap = candidates.filter((point) => point.dot(along) >= end - state.padRadius * 0.65);
      const local = cap.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / cap.length);
      state.skinPadTips[name] = { bone: distal.bone, local };
      if (name === 'Thumb') state.thumbSkin = { bone: distal.bone, points: candidates, samples };
    }
  }
  state.thumbRadial = across.clone().multiplyScalar(side === 'left' ? -1 : 1);
  if (index && pinky) state.thumbRadial.copy(hand.worldToLocal(index.getWorldPosition(new THREE.Vector3())))
    .sub(hand.worldToLocal(pinky.getWorldPosition(new THREE.Vector3()))).normalize();
  const otherUpper = rig[side === 'left' ? 'rightUpperArm' : 'leftUpperArm'];
  state.elbowOutward = upper.getWorldPosition(new THREE.Vector3())
    .sub((otherUpper || rig.modelRoot || upper.parent).getWorldPosition(new THREE.Vector3())).normalize();
  if (rig.modelRoot) state.elbowOutward.transformDirection(rig.modelRoot.matrixWorld.clone().invert());
  state.armFrames = new Map();
  for (const [bone, child] of [[upper, lower], [lower, hand]]) {
    const boneInverse = bone.getWorldQuaternion(new THREE.Quaternion()).invert();
    const along = child.getWorldPosition(new THREE.Vector3()).sub(bone.getWorldPosition(new THREE.Vector3())).normalize();
    const down = new THREE.Vector3(0, -1, 0);
    if (rig.modelRoot) down.transformDirection(rig.modelRoot.matrixWorld);
    const normal = new THREE.Vector3().crossVectors(along, down).normalize().applyQuaternion(boneInverse);
    along.applyQuaternion(boneInverse);
    const across = new THREE.Vector3().crossVectors(along, normal).normalize();
    normal.crossVectors(across, along).normalize();
    state.armFrames.set(bone, new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(across, along, normal)).invert());
  }
  states[side] = state;
  return state;
}

function applySeatedHumanHandGrip(rig, side, amount, options) {
  const state = getArmIKState(rig, side);
  if (!state) return;
  const blend = clamp01(options.gripModeBlend, 1);
  if (options.gripFromMode && blend < 1) {
    applySeatedHumanHandModeGrip(rig, side, amount, options.gripFromMode);
    const start = Object.values(state.digits).flat().map(({ bone }) => bone.quaternion.clone());
    applySeatedHumanHandModeGrip(rig, side, amount, options.gripMode);
    Object.values(state.digits).flat().forEach(({ bone }, index) => bone.quaternion.slerp(start[index], 1 - blend));
    state.hand.updateWorldMatrix(true, true);
    return;
  }
  applySeatedHumanHandModeGrip(rig, side, amount, options.gripMode);
}

function applySeatedHumanHandModeGrip(rig, side, amount, gripMode) {
  const state = getArmIKState(rig, side);
  if (!state) return;
  const grip = clamp01(amount);
  const mode = gripMode || (grip >= 0.75 ? 'fist' : 'pinch');
  const closure = mode === 'fist' ? grip : clamp01(grip / 0.4);
  const flexion = mode === 'fist' ? [1.1, 1.2, 0.8]
    : mode === 'support' ? [0.4, 0.62, 0.35] : [0.95, 1.0, 0.65];
  const rotation = state.quaternions[5];
  for (const name of ['Index', 'Middle', 'Ring', 'Pinky']) {
    const fingerFlexion = mode !== 'fist' && name !== 'Index'
      ? mode === 'support' ? [0.8, 1.05, 0.65] : [1.15, 1.25, 0.85] : flexion;
    state.digits[name].forEach(({ bone, flexAxis, base }, index) => {
      rotation.setFromAxisAngle(flexAxis, mode === 'palm' ? 0 : fingerFlexion[index] * closure);
      bone.quaternion.copy(base).multiply(rotation).normalize();
    });
  }
  state.digits.Thumb.forEach(({ bone, flexAxis, base }, index) => {
    rotation.setFromAxisAngle(flexAxis, mode === 'palm' ? 0 : [0.12, 0.25, 0.35][index] * closure);
    bone.quaternion.copy(base).multiply(rotation).normalize();
  });
  if (mode === 'palm') {
    state.hand.updateWorldMatrix(true, true);
    const palm = state.normal.clone().applyQuaternion(state.hand.getWorldQuaternion(new THREE.Quaternion()));
    for (const joints of Object.values(state.digits)) for (const { bone, next } of joints) {
      if (!next) continue;
      const origin = bone.getWorldPosition(new THREE.Vector3());
      const along = next.getWorldPosition(new THREE.Vector3()).sub(origin);
      const length = along.length();
      along.addScaledVector(palm, -along.dot(palm));
      if (along.lengthSq() > 1e-10) rotateArmBoneInWorld(bone, next, along.normalize().multiplyScalar(length).add(origin), state);
    }
    return;
  }
  // Opposition comes from the thumb's saddle joint, not arbitrary Euler yaw
  // added equally to all three joints. Aim it toward the index pad while
  // keeping the thumb outside the closed fingers for a knock/fist.
  const thumbRoot = rig[`${side}Thumb`]?.[0];
  const thumbTip = rig[`${side}ContactTips`]?.[0] || rig[`${side}Thumb`]?.at(-1);
  const indexPad = mode === 'fist' ? rig[`${side}Index`]?.[1]
    : rig[`${side}ContactTips`]?.[1] || rig[`${side}Index`]?.at(-1);
  if (!thumbRoot || !thumbTip || !indexPad || grip === 0) return;
  state.hand.updateWorldMatrix(true, true);
  const origin = thumbRoot.getWorldPosition(state.vectors[14]);
  const thumbSkin = mode === 'pinch' ? state.skinPadTips.Thumb : null;
  const indexSkin = mode === 'pinch' ? state.skinPadTips.Index : null;
  const from = (thumbSkin ? thumbSkin.bone.localToWorld(state.vectors[15].copy(thumbSkin.local)) : thumbTip.getWorldPosition(state.vectors[15])).sub(origin);
  const to = (indexSkin ? indexSkin.bone.localToWorld(state.vectors[16].copy(indexSkin.local)) : indexPad.getWorldPosition(state.vectors[16])).sub(origin);
  const oppositionAxis = state.vectors[4].copy(mode === 'fist' ? state.normal : state.thumbRadial)
    .applyQuaternion(state.hand.getWorldQuaternion(state.quaternions[6]));
  to.addScaledVector(oppositionAxis, (mode === 'support' ? 0.025 : mode === 'pinch' ? 0.006 : 0.019) * state.hand.getWorldScale(state.vectors[5]).length() / Math.sqrt(3));
  if (from.lengthSq() < 1e-12 || to.lengthSq() < 1e-12) return;
  const angle = from.angleTo(to);
  const blend = angle > 1e-8 ? Math.min(1, THREE.MathUtils.degToRad(70) * closure / angle) : 0;
  rotation.setFromUnitVectors(from.normalize(), to.normalize());
  state.quaternions[6].identity().slerp(rotation, blend);
  thumbRoot.getWorldQuaternion(state.quaternions[7]).premultiply(state.quaternions[6]);
  thumbRoot.parent.getWorldQuaternion(rotation).invert();
  thumbRoot.quaternion.copy(rotation).multiply(state.quaternions[7]).normalize();
  thumbRoot.updateWorldMatrix(false, true);
}

function inferHandContactLocal(rig, side, state, options, result) {
  if (options.gripFromMode && clamp01(options.gripModeBlend, 1) < 1 && !isFiniteVector(options.contactOffset)) {
    const destination = inferHandContactLocal(rig, side, state, { ...options, gripFromMode: null }, new THREE.Vector3());
    inferHandContactLocal(rig, side, state, { ...options, gripMode: options.gripFromMode, gripFromMode: null }, result);
    return result.lerp(destination, clamp01(options.gripModeBlend, 1));
  }
  const mode = options.gripMode || (options.grip >= 0.75 ? 'fist' : 'pinch');
  const hand = state.hand;
  result.set(0, 0, 0);
  if (isFiniteVector(options.contactOffset)) return result.copy(options.contactOffset);
  if (mode === 'fist' || mode === 'palm') {
    const points = [];
    const digits = mode === 'palm' ? Object.values(state.digits) : ['Index', 'Middle', 'Ring'].map((name) => state.digits[name]);
    let supportDepth = -Infinity;
    if (state.skinHull.length) points.push(...state.skinHull);
    else for (const joints of digits) for (const { bone, next } of joints) {
      for (const pointBone of [bone, next].filter(Boolean)) {
        const point = hand.worldToLocal(pointBone.getWorldPosition(new THREE.Vector3()));
        points.push(point);
      }
    }
    for (const point of points) supportDepth = Math.max(supportDepth, point.dot(state.normal));
    let contacts = 0;
    for (const point of points) if (point.dot(state.normal) >= supportDepth - state.padRadius * 0.6) {
      result.add(point); contacts += 1;
    }
    if (contacts) {
      result.multiplyScalar(1 / contacts);
      return result.addScaledVector(state.normal, supportDepth - result.dot(state.normal) + (state.skinHull.length ? 0 : state.padRadius));
    }
  }
  const tips = [
    rig[`${side}ContactTips`]?.[0] || rig[`${side}Thumb`]?.at(-1),
    rig[`${side}ContactTips`]?.[1] || rig[`${side}Index`]?.at(-1)
  ].filter(Boolean);
  if (mode === 'pinch' && state.skinPadTips.Thumb && state.skinPadTips.Index) {
    for (const pad of Object.values(state.skinPadTips)) result.add(hand.worldToLocal(pad.bone.localToWorld(pad.local.clone())));
    return result.multiplyScalar(0.5);
  }
  if (!tips.length) tips.push(...state.tips);
  for (const tip of tips) result.add(hand.worldToLocal(tip.getWorldPosition(state.vectors[4])));
  if (tips.length) result.multiplyScalar(1 / tips.length);
  return result;
}

function updateHandSkinHull(rig, state, options) {
  if (!rig.skinMeshes?.length) return;
  const mode = options.gripMode || (options.grip >= 0.75 ? 'fist' : 'pinch');
  const key = `${options.gripFromMode || ''}:${mode}:${Math.round((options.grip || 0) * 10000)}:${Math.round(clamp01(options.gripModeBlend, 1) * 10000)}`;
  if (key === state.skinHullKey) return;
  if (!state.skinSources) {
    const handBones = new Set();
    state.hand.traverse((bone) => { if (bone.isBone) handBones.add(bone); });
    const padBones = new Set();
    for (const name of ['Thumb', 'Index']) state.digits[name].at(-1)?.bone.traverse((bone) => { if (bone.isBone) padBones.add(bone); });
    state.skinSources = rig.skinMeshes.map((mesh) => {
      const indices = [];
      const padIndices = new Set();
      const indexIndices = new Set();
      const joints = mesh.geometry.attributes.skinIndex;
      const weights = mesh.geometry.attributes.skinWeight;
      const jointData = new THREE.Vector4();
      const weightData = new THREE.Vector4();
      for (let i = 0; i < joints.count; i += 1) {
        jointData.fromBufferAttribute(joints, i);
        weightData.fromBufferAttribute(weights, i);
        let handWeight = 0;
        let padWeight = 0;
        let indexWeight = 0;
        for (let j = 0; j < 4; j += 1) if (handBones.has(mesh.skeleton.bones[jointData.getComponent(j)])) handWeight += weightData.getComponent(j);
        for (let j = 0; j < 4; j += 1) if (padBones.has(mesh.skeleton.bones[jointData.getComponent(j)])) padWeight += weightData.getComponent(j);
        for (let j = 0; j < 4; j += 1) if (mesh.skeleton.bones[jointData.getComponent(j)] === state.digits.Index.at(-1)?.bone) indexWeight += weightData.getComponent(j);
        // Fully hand-weighted vertices are invariant in hand-local space when
        // the arm/torso moves, so this hull only needs updating as grip changes.
        if (handWeight >= 0.995) indices.push(i);
        if (padWeight >= 0.5) padIndices.add(i);
        if (indexWeight >= 0.5) indexIndices.add(i);
      }
      return { mesh, indices, padIndices, indexIndices };
    }).filter((source) => source.indices.length);
  }
  let count = 0;
  state.pinchHull.length = 0;
  state.indexHull.length = 0;
  for (const { mesh, indices, padIndices, indexIndices } of state.skinSources) {
    mesh.updateMatrixWorld(true);
    for (const index of indices) {
      const point = state.skinHull[count] || new THREE.Vector3();
      mesh.getVertexPosition(index, point).applyMatrix4(mesh.matrixWorld);
      state.hand.worldToLocal(point);
      state.skinHull[count++] = point;
      if (padIndices.has(index)) state.pinchHull.push(point);
      if (indexIndices.has(index)) state.indexHull.push(point);
    }
  }
  state.skinHull.length = count;
  state.skinHullKey = key;
}

/** Actual surface effector chosen by the new API; legacy grip getter is unchanged. */
export function getSeatedHumanHandContactWorldPosition(rig, side = 'right') {
  const state = getArmIKState(rig, side);
  if (!state) return null;
  return state.hand.localToWorld(state.lastContactLocal.clone()).addScaledVector(state.surfaceNormal, -state.surfacePadding);
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

function orientArmBoneInPlane(bone, target, planeNormal, state) {
  const along = state.vectors[14].copy(target).sub(bone.getWorldPosition(state.vectors[15])).normalize();
  const across = state.vectors[16].crossVectors(along, planeNormal).normalize();
  const normal = new THREE.Vector3().crossVectors(across, along).normalize();
  const world = state.quaternions[6].setFromRotationMatrix(state.matrix.makeBasis(across, along, normal))
    .multiply(state.armFrames.get(bone));
  bone.parent.getWorldQuaternion(state.quaternions[7]).invert();
  bone.quaternion.copy(state.quaternions[7]).multiply(world).normalize();
  bone.updateWorldMatrix(false, true);
}

function conformThumbToPinchSurface(state, options) {
  if (options.skipThumbConform) return;
  const surface = options.pinchSurface;
  if (!surface?.matrixWorld?.isMatrix4 || !isFiniteVector(surface.halfExtents) || !state.thumbSkin) return;
  const blend = clamp01(options.gripModeBlend, 1);
  const mode = options.gripMode || (options.grip >= 0.75 ? 'fist' : 'pinch');
  const strength = mode === 'pinch' ? (options.gripFromMode ? blend : 1)
    : options.gripFromMode === 'pinch' ? 1 - blend : 0;
  if (strength <= 0) return;
  const inverse = surface.matrixWorld.clone().invert();
  const half = surface.halfExtents;
  const chain = state.digits.Thumb;
  const before = chain.map(({ bone }) => bone.quaternion.clone());
  const position = new THREE.Vector3();
  const local = new THREE.Vector3();
  const nearest = new THREE.Vector3();
  const goal = new THREE.Vector3();
  const effector = new THREE.Vector3();
  let selected = state.thumbSkin.samples[0];
  for (let iteration = 0; iteration < 14; iteration += 1) {
    let bestDistance = Infinity;
    let deepest = 0;
    for (const sample of state.thumbSkin.samples) {
      sample.mesh.getVertexPosition(sample.index, position).applyMatrix4(sample.mesh.matrixWorld);
      local.copy(position).applyMatrix4(inverse);
      nearest.copy(local).clamp(half.clone().negate(), half);
      const inside = Math.abs(local.x) < half.x && Math.abs(local.y) < half.y && Math.abs(local.z) < half.z;
      if (inside) {
        let shortest = Infinity;
        for (const axis of ['x', 'y', 'z']) {
          const candidate = local.clone(); candidate[axis] = Math.sign(local[axis] || 1) * half[axis];
          const distance = candidate.clone().applyMatrix4(surface.matrixWorld).distanceTo(position);
          if (distance < shortest) { shortest = distance; nearest.copy(candidate); }
        }
      }
      nearest.applyMatrix4(surface.matrixWorld);
      const distance = nearest.distanceTo(position);
      if (inside ? distance > deepest : deepest === 0 && distance < bestDistance) {
        if (inside) deepest = distance;
        bestDistance = distance;
        selected = sample;
        const outward = inside ? nearest.clone().sub(position) : position.clone().sub(nearest);
        if (outward.lengthSq() < 1e-12) outward.copy(options.surfaceNormal || new THREE.Vector3(0, 1, 0));
        goal.copy(nearest).addScaledVector(outward.normalize(), 0.001);
      }
    }
    if (deepest === 0 && bestDistance < 0.0015) break;
    for (let index = chain.length - 1; index >= 0; index -= 1) {
      const joint = chain[index];
      const origin = joint.bone.getWorldPosition(new THREE.Vector3());
      const from = selected.mesh.getVertexPosition(selected.index, effector).applyMatrix4(selected.mesh.matrixWorld).sub(origin);
      const toward = goal.clone().sub(origin);
      if (from.lengthSq() < 1e-12 || toward.lengthSq() < 1e-12) continue;
      if (index > 0) {
        const axis = joint.flexAxis.clone().applyQuaternion(joint.bone.getWorldQuaternion(new THREE.Quaternion()));
        from.addScaledVector(axis, -from.dot(axis)).normalize();
        toward.addScaledVector(axis, -toward.dot(axis)).normalize();
        const delta = Math.atan2(axis.dot(new THREE.Vector3().crossVectors(from, toward)), from.dot(toward));
        const relative = joint.base.clone().invert().multiply(joint.bone.quaternion);
        const current = 2 * Math.atan2(new THREE.Vector3(relative.x, relative.y, relative.z).dot(joint.flexAxis), relative.w);
        const angle = clamp(current + clamp(delta, -0.3, 0.3), 0, 1.45);
        joint.bone.quaternion.copy(joint.base).multiply(new THREE.Quaternion().setFromAxisAngle(joint.flexAxis, angle));
      } else {
        const delta = new THREE.Quaternion().setFromUnitVectors(from.normalize(), toward.normalize());
        const angle = 2 * Math.acos(clamp(delta.w, -1, 1));
        const limited = new THREE.Quaternion().slerp(delta, angle > 0 ? Math.min(1, 0.3 / angle) : 1);
        const world = joint.bone.getWorldQuaternion(new THREE.Quaternion()).premultiply(limited);
        const parent = joint.bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
        joint.bone.quaternion.copy(parent).multiply(world);
        const total = before[index].angleTo(joint.bone.quaternion);
        if (total > Math.PI / 3) joint.bone.quaternion.slerp(before[index], 1 - (Math.PI / 3) / total);
      }
      joint.bone.updateWorldMatrix(false, true);
    }
  }
  chain.forEach(({ bone }, index) => bone.quaternion.slerp(before[index], 1 - strength));
  state.hand.updateWorldMatrix(false, true);
  // Cached hull coordinates remain the canonical pre-contact grip. The next
  // numeric grip call restores those rotations before reusing that hull.
}

/**
 * Rotate an arm to a world-space surface contact without moving any scene root.
 * Bone lengths stay unchanged unless maxArmExtension is explicitly enabled.
 * Call after applySeatedHumanPose each frame.
 *
 * `targetWorld` is the contact on the domino/table, not its centre. Options:
 * - grip: finger closure (0..1); strength: pose blend (0..1, default 1).
 * - gripMode: 'pinch', 'support', 'palm', or 'fist'; inferred if omitted.
 * - approachDirection: world direction from wrist toward fingers.
 * - palmNormal: world direction the palm faces (orthogonalized to approach).
 * - gripMode: support, pinch, fist, or palm; gripFromMode/gripModeBlend blend
 *   articulated digit rotations and the contact effector between two modes.
 * - contactOffset: optional contact point in hand-local MODEL units; otherwise
 *   thumb/index pads determine a pinch; palm/fist modes use the outer hand hull.
 * - surfaceNormal/surfacePadding: outward world surface normal and optional
 *   world pad clearance, preventing bone centres being embedded in a tile.
 *   surfacePaddingScale can smoothly release that clearance (default 1).
 * - pinchSurface: optional { matrixWorld, halfExtents } in object-local units;
 *   the final solve conforms actual thumb skin to this finite object surface.
 * - poleTarget: optional world elbow guide; otherwise use the stable body pole.
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
  if (Number.isFinite(options.grip)) applySeatedHumanHandGrip(rig, side, options.grip, options);
  else state.skinHullKey = '';
  upper.updateWorldMatrix(true, true);
  upper.getWorldPosition(shoulder);
  lower.getWorldPosition(elbow);
  hand.getWorldPosition(wrist);
  hand.getWorldQuaternion(handRotation);
  hand.getWorldScale(handScale);
  updateHandSkinHull(rig, state, options);
  inferHandContactLocal(rig, side, state, options, contactLocal);
  if (!state.tips.length && !isFiniteVector(options.contactOffset)) {
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
  state.lastContactLocal.copy(contactLocal);
  state.surfaceNormal.set(0, 0, 0);
  state.surfacePadding = 0;
  if (isFiniteVector(options.surfaceNormal) && state.surfaceNormal.copy(options.surfaceNormal).lengthSq() > 1e-10) {
    state.surfaceNormal.normalize();
    const modeBlend = clamp01(options.gripModeBlend, 1);
    const mode = options.gripMode || (options.grip >= 0.75 ? 'fist' : 'pinch');
    const pinchWeight = mode === 'pinch' ? (options.gripFromMode ? modeBlend : 1)
      : options.gripFromMode === 'pinch' ? 1 - modeBlend : 0;
    if (pinchWeight > 0 && state.indexHull.length && !isFiniteVector(options.contactOffset)) {
      const localNormal = state.surfaceNormal.clone().applyQuaternion(handRotation.clone().invert()).multiply(handScale);
      let support = state.indexHull[0];
      for (const point of state.indexHull) if (point.dot(localNormal) < support.dot(localNormal)) support = point;
      const rest = inferHandContactLocal(rig, side, state, { ...options, gripMode: 'support', gripFromMode: null }, new THREE.Vector3());
      contactLocal.copy(rest).lerp(support, pinchWeight);
      state.lastContactLocal.copy(contactLocal);
    }
    state.surfacePadding = Number.isFinite(options.surfacePadding) ? Math.max(0, options.surfacePadding)
      : state.padRadius * handScale.length() / Math.sqrt(3);
    if (state.skinHull.length && !Number.isFinite(options.surfacePadding)) {
      // Put the actual posed skin hull outside the selected tile edge. A fixed
      // radius around an averaged bone tip misses the long thumb-tip vertices.
      state.surfacePadding = -Infinity;
      let indexPadding = -Infinity;
      for (const point of state.skinHull) {
        const depth = temp.copy(contactLocal).sub(point).multiply(handScale).applyQuaternion(handRotation).dot(state.surfaceNormal);
        state.surfacePadding = Math.max(state.surfacePadding, depth);
      }
      if (pinchWeight > 0 && state.indexHull.length) {
        for (const point of state.indexHull) {
          const depth = temp.copy(contactLocal).sub(point).multiply(handScale).applyQuaternion(handRotation).dot(state.surfaceNormal);
          indexPadding = Math.max(indexPadding, depth);
        }
        state.surfacePadding = THREE.MathUtils.lerp(state.surfacePadding, indexPadding, pinchWeight);
      }
      state.surfacePadding += 0.001;
    }
    state.surfacePadding *= clamp01(options.surfacePaddingScale, 1);
  }
  wristTarget.copy(targetWorld).addScaledVector(state.surfaceNormal, state.surfacePadding)
    .sub(temp.copy(contactLocal).multiply(handScale).applyQuaternion(handRotation));
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
  else {
    // Swing a perpendicular anatomical bend with the arm direction instead of
    // projecting a guide that can become parallel to the moving rack reach.
    // The forward/outward reference avoids the antipode throughout these seated
    // actions, and is deterministic when a replay seeks directly to a pose.
    const reference = state.elbowOutward.clone().multiplyScalar(0.8).add(new THREE.Vector3(0, 0, 0.6)).normalize();
    if (rig.modelRoot) reference.transformDirection(rig.modelRoot.matrixWorld);
    bend.set(0, -1, 0).addScaledVector(reference, reference.y).normalize();
    bend.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(reference, direction));
  }
  bend.addScaledVector(direction, -bend.dot(direction));
  if (bend.lengthSq() < 1e-10) {
    bend.set(0, -1, 0).addScaledVector(direction, direction.y);
    if (bend.lengthSq() < 1e-10) bend.set(side === 'left' ? -1 : 1, 0, 0).addScaledVector(direction, -direction.x * (side === 'left' ? -1 : 1));
  }
  bend.normalize();
  const along = (upperLength * upperLength - lowerLength * lowerLength + distance * distance) / (2 * distance);
  const height = Math.sqrt(Math.max(0, upperLength * upperLength - along * along));
  elbowTarget.copy(shoulder).addScaledVector(direction, along).addScaledVector(bend, height);
  const planeNormal = new THREE.Vector3().crossVectors(direction, bend).normalize();
  orientArmBoneInPlane(upper, elbowTarget, planeNormal, state);
  orientArmBoneInPlane(lower, wristTarget, planeNormal, state);
  hand.parent.getWorldQuaternion(parentRotation).invert();
  hand.quaternion.copy(parentRotation).multiply(handRotation).normalize();
  if (strength < 1) {
    upper.quaternion.slerp(oldUpper, 1 - strength);
    lower.quaternion.slerp(oldLower, 1 - strength);
    hand.quaternion.slerp(oldHand, 1 - strength);
  }
  upper.updateWorldMatrix(false, true);
  conformThumbToPinchSurface(state, options);
  contactWorld.copy(contactLocal);
  hand.localToWorld(contactWorld);
  contactWorld.addScaledVector(state.surfaceNormal, -state.surfacePadding);
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
  // Plan a modest share of the permitted arm adjustment before a deep lean,
  // so the torso does not carry the support shoulder through its rack wrist.
  const solveOptions = { ...options, maxArmExtension: 1, skipThumbConform: true };
  const firstResult = applySeatedHumanArmIK(rig, side, targetWorld, solveOptions);
  if (!firstResult) return null;

  if (options.maxArmExtension > 1 && rig.chest) {
    const torsoJoint = rig.chest;
    const origin = torsoJoint.getWorldPosition(new THREE.Vector3());
    const shoulder = state.upper.getWorldPosition(new THREE.Vector3());
    const armSpan = shoulder.distanceTo(state.lower.getWorldPosition(new THREE.Vector3())) + state.lower.getWorldPosition(new THREE.Vector3()).distanceTo(state.hand.getWorldPosition(new THREE.Vector3()));
    const amount = smooth01((shoulder.distanceTo(state.requestedWristTarget) / armSpan - 0.85) / 0.6);
    const from = shoulder.clone().sub(origin).setY(0).normalize();
    const toward = state.requestedWristTarget.clone().sub(origin).setY(0).normalize();
    const angle = Math.atan2(new THREE.Vector3().crossVectors(from, toward).y, from.dot(toward));
    const yaw = clamp(angle, -Math.PI / 4, Math.PI / 4) * amount * clamp01(options.torsoStrength ?? 1);
    const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const world = torsoJoint.getWorldQuaternion(new THREE.Quaternion()).premultiply(rotation);
    const parent = torsoJoint.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    torsoJoint.quaternion.copy(parent).multiply(world).normalize();
    torsoJoint.updateWorldMatrix(false, true);
    applySeatedHumanArmIK(rig, side, targetWorld, solveOptions);
  }
  const savedArmLength = rig.saved?.get(state.lower)?.position.length() || state.lower.position.length();
  const result = { ...firstResult, leanRadians: 0, clavicleRadians: 0, armExtension: state.lower.position.length() / savedArmLength };
  const spine = rig.spine;
  const pivot = spine.getWorldPosition(new THREE.Vector3());
  const shoulder = state.upper.getWorldPosition(new THREE.Vector3());
  const upperLength = shoulder.distanceTo(state.lower.getWorldPosition(new THREE.Vector3()));
  const lowerLength = state.lower.getWorldPosition(new THREE.Vector3()).distanceTo(state.hand.getWorldPosition(new THREE.Vector3()));
  const reachExtensionCap = clamp(Number.isFinite(options.maxArmExtension) ? options.maxArmExtension : 1, 1, 1.65);
  const preferredExtension = reachExtensionCap;
  const maxReach = (upperLength + lowerLength) * preferredExtension - 1e-6;
  const wristTarget = state.requestedWristTarget.clone();
  if (firstResult.reachable && shoulder.distanceTo(wristTarget) < maxReach * 0.96) return result;
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
  // Rodrigues' rotation formula gives the continuous minimum of the
  // shoulder-to-wrist distance. A sampled minimum can jump by an entire sample
  // interval precisely where a fully extended arm changes reachability.
  const targetOffset = wristTarget.clone().sub(pivot);
  const a = shoulderOffset.dot(targetOffset) - shoulderOffset.dot(axis) * targetOffset.dot(axis);
  const b = new THREE.Vector3().crossVectors(axis, shoulderOffset).dot(targetOffset);
  const stationary = Math.atan2(b, a);
  let bestAngle = distanceAt(maxLean) < distanceAt(0) ? maxLean : 0;
  if (stationary > 0 && stationary < maxLean && distanceAt(stationary) < distanceAt(bestAngle)) bestAngle = stationary;
  const minimumDistanceAngle = bestAngle;
  if (distanceAt(0) <= maxReach) bestAngle = 0;
  else if (bestAngle > 0 && distanceAt(bestAngle) <= maxReach) {
    let low = 0;
    let high = bestAngle;
    for (let i = 0; i < 20; i += 1) {
      const mid = (low + high) / 2;
      if (distanceAt(mid) <= maxReach) high = mid;
      else low = mid;
    }
    bestAngle = high;
  }
  const leanGap = Math.max(0, minimumDistanceAngle - bestAngle);
  const leanBand = THREE.MathUtils.degToRad(8);
  bestAngle = minimumDistanceAngle - leanGap * smooth01(leanGap / leanBand);
  if (bestAngle > 0) {
    const spineWorld = spine.getWorldQuaternion(new THREE.Quaternion());
    const parentInverse = spine.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    rotation.setFromAxisAngle(axis, bestAngle);
    spine.quaternion.copy(parentInverse).multiply(rotation).multiply(spineWorld).normalize();
    spine.updateWorldMatrix(false, true);
    result.leanRadians = bestAngle;
  }
  let solved = applySeatedHumanArmIK(rig, side, targetWorld, solveOptions);
  const clavicle = state.upper.parent;
  const maxProtraction = clamp(Number.isFinite(options.maxShoulderProtraction) ? options.maxShoulderProtraction : THREE.MathUtils.degToRad(40), 0, THREE.MathUtils.degToRad(45));
  if (!solved.reachable && clavicle?.isBone && /shoulder|clavicle/i.test(clavicle.name) && maxProtraction > 0) {
    const origin = clavicle.getWorldPosition(new THREE.Vector3());
    const from = state.upper.getWorldPosition(new THREE.Vector3()).sub(origin);
    const toward = state.requestedWristTarget.clone().sub(origin);
    const angle = from.angleTo(toward);
    if (angle > 1e-8) {
      const delta = new THREE.Quaternion().setFromUnitVectors(from.normalize(), toward.normalize());
      const shoulderOffset = state.upper.getWorldPosition(new THREE.Vector3()).sub(origin);
      const wrist = state.requestedWristTarget.clone();
      const protractionLimit = Math.min(angle, maxProtraction);
      const probe = new THREE.Vector3();
      const probeRotation = new THREE.Quaternion();
      const distanceAt = (radians) => probe.copy(shoulderOffset)
        .applyQuaternion(probeRotation.identity().slerp(delta, radians / angle)).add(origin).distanceTo(wrist);
      let protraction = protractionLimit;
      if (distanceAt(protractionLimit) <= maxReach) {
        let low = 0;
        let high = protractionLimit;
        for (let i = 0; i < 16; i += 1) {
          const mid = (low + high) / 2;
          if (distanceAt(mid) <= maxReach) high = mid;
          else low = mid;
        }
        protraction = high;
      }
      const rotation = new THREE.Quaternion().slerp(delta, protraction / angle);
      const world = clavicle.getWorldQuaternion(new THREE.Quaternion()).premultiply(rotation);
      const parent = clavicle.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
      clavicle.quaternion.copy(parent).multiply(world).normalize();
      clavicle.updateWorldMatrix(false, true);
      result.clavicleRadians = protraction;
      solved = applySeatedHumanArmIK(rig, side, targetWorld, solveOptions);
    }
  }
  const allowedExtension = clamp(Number.isFinite(options.maxArmExtension) ? options.maxArmExtension : 1, 1, 1.65);
  if (!solved.reachable && allowedExtension > 1) {
    solved = applySeatedHumanArmIK(rig, side, targetWorld, { ...options, maxArmExtension: allowedExtension, skipThumbConform: true });
    result.armExtension = state.lower.position.length() / savedArmLength;
  }
  if (bestAngle > 0 && rig.neck && rig.head) {
    // A table reach bends the torso, not the player's gaze into the felt.
    // Share the counter-rotation across the cervical joint and skull instead
    // of asking a single neck bone to take the entire forward lean.
    for (const [bone, share] of [[rig.neck, 0.72], [rig.head, 0.28]]) {
      const counter = new THREE.Quaternion().setFromAxisAngle(axis, -bestAngle * share);
      const world = bone.getWorldQuaternion(new THREE.Quaternion()).premultiply(counter);
      const parent = bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
      bone.quaternion.copy(parent).multiply(world).normalize();
      bone.updateWorldMatrix(false, true);
    }
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
