import * as THREE from 'three';

const DEG = Math.PI / 180;
const STATE_KEY = '__realisticCueHandsState';

export const REALISTIC_CUE_HAND_DEFAULTS = Object.freeze({
  handTargetLambda: 24,
  strikeHandTargetLambda: 34,
  wristLambda: 22,
  fingerLambda: 18,
  idleGripClosure: 0.64,
  aimGripClosure: 0.78,
  strikeGripClosure: 0.84,
  maxGripClosure: 0.9,
  gripFromBackRatio: 0.28,
  gripTargetBlend: 0.72,
  bridgeStyle: 'open',
  gripStyle: 'relaxed'
});

export const REALISTIC_CUE_HAND_PRESETS = Object.freeze({
  bridge: Object.freeze(['open', 'closed', 'rail']),
  grip: Object.freeze(['relaxed', 'firm'])
});

function clamp01(value) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function cueHandSmoothingAlpha(lambda, dt) {
  const safeLambda = Number.isFinite(lambda) ? Math.max(0, lambda) : 0;
  const safeDt = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.1)) : 0;
  return 1 - Math.exp(-safeLambda * safeDt);
}

function ensureState(human) {
  if (!human[STATE_KEY]) {
    human[STATE_KEY] = {
      vectors: new Map(),
      wrists: new Map(),
      fingers: new Map()
    };
  }
  return human[STATE_KEY];
}

function tuningFor(human, overrides = {}) {
  return {
    ...REALISTIC_CUE_HAND_DEFAULTS,
    ...(human?.cfg?.cueHands || {}),
    ...overrides
  };
}

function smoothVector(state, key, target, lambda, dt) {
  if (!target?.isVector3) return target;
  let value = state.vectors.get(key);
  if (!value) {
    value = target.clone();
    state.vectors.set(key, value);
    return value.clone();
  }
  value.lerp(target, cueHandSmoothingAlpha(lambda, dt));
  return value.clone();
}

export function resolveCueGripPoint(human, frameData, overrides = {}) {
  const cueBack = frameData?.cueBack;
  const cueTip = frameData?.cueTip;
  if (!cueBack?.isVector3 || !cueTip?.isVector3) {
    return frameData?.gripTarget?.isVector3 ? frameData.gripTarget.clone() : null;
  }

  const shaft = cueTip.clone().sub(cueBack);
  const cueLength = shaft.length();
  if (cueLength < 1e-6) {
    return frameData?.gripTarget?.isVector3 ? frameData.gripTarget.clone() : cueBack.clone();
  }

  const tuning = tuningFor(human, overrides);
  const ratio = THREE.MathUtils.clamp(
    Number.isFinite(tuning.gripFromBackRatio) ? tuning.gripFromBackRatio : 0.28,
    0.16,
    0.5
  );
  const cueAlignedGrip = cueBack.clone().addScaledVector(shaft.normalize(), cueLength * ratio);

  if (!frameData?.gripTarget?.isVector3) return cueAlignedGrip;

  // Respect a game-supplied grip target, but pull it toward the actual cue shaft so
  // the hand cannot visually float beside or cut through the butt of the cue.
  return frameData.gripTarget
    .clone()
    .lerp(cueAlignedGrip, clamp01(tuning.gripTargetBlend));
}

export function prepareRealisticCueHandFrame(human, dt, frameData, overrides = {}) {
  if (!human || !frameData) return frameData;
  const state = ensureState(human);
  const tuning = tuningFor(human, overrides);
  const shotState = frameData.state || 'idle';
  const shooting = shotState === 'dragging' || shotState === 'striking';
  const lambda = shooting ? tuning.strikeHandTargetLambda : tuning.handTargetLambda;
  const next = { ...frameData };

  // Only smooth targets that belong to the hands. Cue endpoints stay untouched so
  // cue/ball contact timing and game physics remain exactly owned by the game.
  for (const key of ['bridgeTarget', 'idleRight', 'idleLeft']) {
    if (frameData[key]?.isVector3) {
      next[key] = smoothVector(state, key, frameData[key], lambda, dt);
    }
  }

  const gripTarget = resolveCueGripPoint(human, frameData, overrides);
  if (gripTarget?.isVector3) {
    next.gripTarget = smoothVector(state, 'gripTarget', gripTarget, lambda, dt);
  }

  next.bridgeStyle = frameData.bridgeStyle || tuning.bridgeStyle;
  next.gripStyle = frameData.gripStyle || tuning.gripStyle;
  return next;
}

function fingerDescriptor(name) {
  const n = String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  let finger = 'unknown';
  if (n.includes('thumb')) finger = 'thumb';
  else if (n.includes('index')) finger = 'index';
  else if (n.includes('middle')) finger = 'middle';
  else if (n.includes('ring')) finger = 'ring';
  else if (n.includes('pinky') || n.includes('little')) finger = 'pinky';

  let segment = 0;
  if (n.includes('distal') || /(?:thumb|index|middle|ring|pinky|little)3/.test(n)) segment = 2;
  else if (n.includes('intermediate') || /(?:thumb|index|middle|ring|pinky|little)2/.test(n)) segment = 1;
  else if (n.includes('proximal') || /(?:thumb|index|middle|ring|pinky|little)1/.test(n)) segment = 0;

  return { finger, segment };
}

const IDLE = Object.freeze({
  thumb: [[7, -5, 5], [5, -3, 3], [3, -1, 2]],
  index: [[7, -2, -2], [11, -1, -1], [7, 0, 0]],
  middle: [[9, 0, 0], [13, 0, 0], [9, 0, 0]],
  ring: [[11, 2, 2], [15, 2, 2], [10, 1, 2]],
  pinky: [[13, 4, 4], [17, 3, 4], [11, 2, 3]]
});

// Relaxed cradle: thumb/index close the loop, but the last three fingers only
// follow the cue. Values deliberately avoid a clenched-fist silhouette.
const GRIP_RELAXED = Object.freeze({
  thumb: [[18, -32, 24], [15, -22, 17], [9, -10, 8]],
  index: [[24, -8, -5], [38, -4, -3], [24, 0, 0]],
  middle: [[32, -2, -2], [46, 0, 0], [30, 0, 0]],
  ring: [[36, 3, 4], [50, 2, 5], [34, 0, 4]],
  pinky: [[32, 6, 7], [44, 4, 8], [30, 2, 6]]
});

const GRIP_FIRM = Object.freeze({
  thumb: [[22, -36, 28], [18, -26, 20], [11, -12, 10]],
  index: [[29, -9, -6], [44, -5, -3], [29, 0, 0]],
  middle: [[38, -2, -2], [53, 0, 0], [36, 0, 0]],
  ring: [[42, 4, 5], [56, 3, 6], [40, 1, 5]],
  pinky: [[38, 7, 8], [50, 5, 9], [36, 3, 7]]
});

// Open bridge: palm remains visually flat, thumb rises into the index finger to
// create the V channel, and ring/pinky spread out to create a stable tripod.
const BRIDGE_OPEN = Object.freeze({
  thumb: [[-10, 48, -46], [-6, 31, -30], [-2, 12, -12]],
  index: [[12, -22, -18], [20, -10, -8], [12, -2, -2]],
  middle: [[8, -4, -6], [14, 0, -4], [8, 0, 0]],
  ring: [[5, 12, 20], [10, 8, 20], [6, 4, 12]],
  pinky: [[4, 22, 32], [8, 16, 30], [5, 10, 18]]
});

// Closed bridge: index loops over the shaft while thumb and middle finger build
// the lower channel. This is optional and activated with frameData.bridgeStyle.
const BRIDGE_CLOSED = Object.freeze({
  thumb: [[-4, 40, -36], [-2, 28, -24], [0, 12, -10]],
  index: [[42, -32, -28], [58, -24, -22], [42, -14, -12]],
  middle: [[18, -8, -8], [28, -3, -6], [18, 0, -2]],
  ring: [[9, 12, 20], [15, 8, 20], [9, 4, 12]],
  pinky: [[7, 22, 30], [12, 15, 28], [8, 9, 17]]
});

// Rail bridge keeps the palm flatter and uses the index as the upper guide.
const BRIDGE_RAIL = Object.freeze({
  thumb: [[-8, 54, -40], [-5, 36, -25], [-2, 14, -10]],
  index: [[26, -28, -20], [38, -18, -14], [24, -8, -6]],
  middle: [[7, -2, -4], [12, 0, -2], [7, 0, 0]],
  ring: [[5, 10, 17], [9, 7, 16], [5, 3, 10]],
  pinky: [[4, 17, 25], [8, 12, 24], [5, 7, 15]]
});

function profileFor(mode, style) {
  if (mode === 'grip') return style === 'firm' ? GRIP_FIRM : GRIP_RELAXED;
  if (mode === 'bridge') {
    if (style === 'closed') return BRIDGE_CLOSED;
    if (style === 'rail') return BRIDGE_RAIL;
    return BRIDGE_OPEN;
  }
  return IDLE;
}

export function resolveCueFingerPose(name, mode = 'idle', weight = 1, style = 'open') {
  const { finger, segment } = fingerDescriptor(name);
  const profile = profileFor(mode, style);
  const values = profile[finger]?.[segment] || [0, 0, 0];
  const w = clamp01(weight);
  return {
    x: values[0] * DEG * w,
    y: values[1] * DEG * w,
    z: values[2] * DEG * w,
    finger,
    segment
  };
}

function poseFingerSet(human, fingers, mode, weight, style, dt, lambda) {
  if (!Array.isArray(fingers) || fingers.length === 0) return;
  const state = ensureState(human);
  const alpha = cueHandSmoothingAlpha(lambda, dt);

  for (const finger of fingers) {
    if (!finger) continue;
    const rest = human.restQuats?.get(finger) || finger.quaternion.clone();
    const pose = resolveCueFingerPose(finger.name, mode, weight, style);
    const offset = new THREE.Quaternion().setFromEuler(new THREE.Euler(pose.x, pose.y, pose.z, 'XYZ'));
    const target = rest.clone().multiply(offset);
    let smoothed = state.fingers.get(finger);
    if (!smoothed) {
      smoothed = finger.quaternion.clone();
      state.fingers.set(finger, smoothed);
    }
    smoothed.slerp(target, alpha);
    finger.quaternion.copy(smoothed);
  }
}

function setBoneWorldQuaternion(bone, worldQuaternion) {
  if (!bone || !worldQuaternion) return;
  const parentQ = new THREE.Quaternion();
  bone.parent?.getWorldQuaternion(parentQ);
  bone.quaternion.copy(parentQ.invert().multiply(worldQuaternion));
  bone.updateMatrixWorld(true);
}

function smoothWristWorldQuaternion(human, key, bone, dt, lambda) {
  if (!bone) return;
  const state = ensureState(human);
  const target = bone.getWorldQuaternion(new THREE.Quaternion());
  let smoothed = state.wrists.get(key);
  if (!smoothed) {
    smoothed = target.clone();
    state.wrists.set(key, smoothed);
    return;
  }
  // Hemisphere correction prevents an equivalent quaternion with the opposite
  // sign from producing a visible wrist snap between frames.
  if (smoothed.dot(target) < 0) target.set(-target.x, -target.y, -target.z, -target.w);
  smoothed.slerp(target, cueHandSmoothingAlpha(lambda, dt));
  setBoneWorldQuaternion(bone, smoothed);
}

function gripClosureFor(frameData, tuning) {
  const state = frameData?.state || 'idle';
  const power = clamp01(frameData?.power || 0);
  let closure = state === 'idle'
    ? tuning.idleGripClosure
    : state === 'striking'
      ? tuning.strikeGripClosure
      : tuning.aimGripClosure;

  // Harder shots close only slightly more. A billiards grip should still read as
  // a cradle instead of a clenched fist.
  closure += power * 0.035;
  return Math.min(tuning.maxGripClosure, closure);
}

export function refineRealisticCueHands(human, dt, frameData = {}, overrides = {}) {
  if (!human?.activeGlb || !human?.bones) return;
  const tuning = tuningFor(human, overrides);
  const safeDt = Number.isFinite(dt) && dt > 0 ? dt : 1 / 60;
  const state = frameData.state || 'idle';
  const shooting = state === 'dragging' || state === 'striking';

  // Smooth wrist orientation after the core IK solver. The core remains the
  // authority for pose/IK; this layer removes frame-to-frame hand snapping.
  smoothWristWorldQuaternion(human, 'right', human.bones.rightHand, safeDt, tuning.wristLambda);
  smoothWristWorldQuaternion(human, 'left', human.bones.leftHand, safeDt, tuning.wristLambda);

  const gripStyle = frameData.gripStyle || tuning.gripStyle;
  poseFingerSet(
    human,
    human.rightFingers,
    'grip',
    gripClosureFor(frameData, tuning),
    gripStyle,
    safeDt,
    tuning.fingerLambda
  );

  const bridgeStyle = frameData.bridgeStyle || tuning.bridgeStyle;
  poseFingerSet(
    human,
    human.leftFingers,
    shooting ? 'bridge' : 'idle',
    shooting ? 1 : 0.82,
    bridgeStyle,
    safeDt,
    tuning.fingerLambda
  );

  human.modelRoot?.updateMatrixWorld?.(true);
}

export function driveHumanPoseWithRealisticHands(baseUpdate, human, dt, frameData, overrides = {}) {
  if (typeof baseUpdate !== 'function') return undefined;
  const prepared = prepareRealisticCueHandFrame(human, dt, frameData, overrides);
  const result = baseUpdate(human, dt, prepared);
  refineRealisticCueHands(human, dt, prepared, overrides);
  return result;
}
