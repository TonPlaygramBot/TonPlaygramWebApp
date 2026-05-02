import * as THREE from 'three';

const CFG = {
  poseLambda: 9,
  moveLambda: 5.6,
  rotLambda: 8.5,
  humanScale: 1.18,
  humanVisualYawFix: Math.PI,
  stanceWidth: 0.52,
  bridgePalmTableLift: 0.006,
  edgeMargin: 0.58,
  desiredShootDistance: 1.06,
  chinToCueHeight: 0.11,
  cueArmElbowRise: 0.43,
  strikeTime: 0.12,
  holdTime: 0.05,
  tableTopY: 0.84,
  bridgeHandBackFromBall: 0.235,
  bridgeHandSide: -0.012,
  bridgeCueLift: 0.018,
  cueLength: 1.46,
  bridgeDist: 0.24,
  shootCueGripFromBack: 0.58,
  rightHandShotExtraBack: 0.18,
  rightHandShotLift: 0.055,
  rightHandForwardClamp: -0.08,
  rightHandOutward: 0.14,
  idleRightHandY: 0.8,
  idleRightHandX: 0.31,
  idleRightHandZ: -0.015,
  rightHandRollIdle: -2.2,
  rightHandRollShoot: -2.05,
  rightHandDownPose: 0.42,
  rightHandCueSocketLocal: new THREE.Vector3(-0.004, -0.014, 0.092),
  footGroundY: 0.035,
  kneeBendShot: 0.16,
  footLockStrength: 1.0,
  rightElbowShotRise: 0.84,
  rightElbowShotSide: -0.34,
  rightElbowShotBack: -0.82
};

const HUMAN_URL = 'https://threejs.org/examples/models/gltf/readyplayer.me.glb';

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const UP = Y_AXIS;
const BASIS_MAT = new THREE.Matrix4();

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const clamp01 = (v) => clamp(v, 0, 1);
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => t * t * (3 - 2 * t);
const dampScalar = (current, target, lambda, dt) =>
  THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));
const dampVector = (current, target, lambda, dt) =>
  current.lerp(target, 1 - Math.exp(-lambda * dt));
const yawFromForward = (forward) => Math.atan2(-forward.x, -forward.z);
const cleanName = (name) => String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function makeBasisQuaternion(side, up, forward) {
  BASIS_MAT.makeBasis(side.clone().normalize(), up.clone().normalize(), forward.clone().normalize());
  return new THREE.Quaternion().setFromRotationMatrix(BASIS_MAT);
}

function createFallbackHuman() {
  const group = new THREE.Group();
  const gray = new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.7, metalness: 0.05 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xf0c9a5, roughness: 0.8, metalness: 0 });
  const addBox = (size, pos, mat) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), mat);
    mesh.position.set(pos[0], pos[1], pos[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  addBox([0.42, 0.72, 0.22], [0, 1.18, 0], gray);
  addBox([0.14, 0.9, 0.14], [-0.09, 0.45, 0], gray);
  addBox([0.14, 0.9, 0.14], [0.09, 0.45, 0], gray);
  addBox([0.12, 0.72, 0.12], [-0.31, 1.18, 0], gray);
  addBox([0.12, 0.72, 0.12], [0.31, 1.18, 0], gray);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 20, 20), skin);
  head.position.set(0, 1.7, 0);
  head.castShadow = true;
  head.receiveShadow = true;
  group.add(head);
  return group;
}

function findBone(all, aliases) {
  const list = all.map((bone) => ({ bone, name: cleanName(bone.name) }));
  const names = aliases.map(cleanName);
  for (const alias of names) {
    const exact = list.find((x) => x.name === alias || x.name.endsWith(alias));
    if (exact) return exact.bone;
  }
  for (const alias of names) {
    const loose = list.find((x) => x.name.includes(alias));
    if (loose) return loose.bone;
  }
  return undefined;
}

function buildAvatarBones(model) {
  const all = [];
  model.traverse((obj) => obj?.isBone && all.push(obj));
  const f = (...names) => findBone(all, names);
  return {
    hips: f('hips', 'pelvis', 'mixamorigHips'), spine: f('spine', 'spine01', 'mixamorigSpine'), chest: f('spine2', 'chest', 'upperchest', 'mixamorigSpine2', 'mixamorigSpine1'), neck: f('neck', 'mixamorigNeck'), head: f('head', 'mixamorigHead'),
    leftUpperArm: f('leftupperarm', 'leftarm', 'upperarml', 'mixamorigLeftArm'), leftLowerArm: f('leftforearm', 'leftlowerarm', 'forearml', 'mixamorigLeftForeArm'), leftHand: f('lefthand', 'handl', 'mixamorigLeftHand'),
    rightUpperArm: f('rightupperarm', 'rightarm', 'upperarmr', 'mixamorigRightArm'), rightLowerArm: f('rightforearm', 'rightlowerarm', 'forearmr', 'mixamorigRightForeArm'), rightHand: f('righthand', 'handr', 'mixamorigRightHand'),
    leftUpperLeg: f('leftupleg', 'leftupperleg', 'leftthigh', 'mixamorigLeftUpLeg'), leftLowerLeg: f('leftleg', 'leftlowerleg', 'leftcalf', 'mixamorigLeftLeg'), leftFoot: f('leftfoot', 'footl', 'mixamorigLeftFoot'),
    rightUpperLeg: f('rightupleg', 'rightupperleg', 'rightthigh', 'mixamorigRightUpLeg'), rightLowerLeg: f('rightleg', 'rightlowerleg', 'rightcalf', 'mixamorigRightLeg'), rightFoot: f('rightfoot', 'footr', 'mixamorigRightFoot')
  };
}
const collectFingerBones = (hand) => {
  const out = [];
  hand?.traverse((obj) => {
    if (!obj?.isBone || obj === hand) return;
    const n = cleanName(obj.name);
    if (['thumb', 'index', 'middle', 'ring', 'pinky', 'little', 'finger'].some((s) => n.includes(s))) out.push(obj);
  });
  return out;
};

function normalizeHuman(model, opts = {}) {
  model.scale.setScalar(opts.humanScale ?? CFG.humanScale);
  model.rotation.set(0, opts.humanVisualYawFix ?? CFG.humanVisualYawFix, 0);
  model.position.set(0, 0, 0);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -box.min.y, -center.z);
}

export function createSnookerHumanRig(scene, opts = {}) {
  const human = { root: new THREE.Group(), modelRoot: new THREE.Group(), model: null, fallback: createFallbackHuman(), bones: {}, leftFingers: [], rightFingers: [], restQuats: new Map(), loaded: false, activeGlb: false, poseT: 0, walkT: 0, yaw: 0, breathT: 0, settleT: 0, strikeRoot: new THREE.Vector3(), strikeYaw: 0, strikeClock: 0, cfg: { ...CFG, ...opts } };
  human.root.visible = false;
  human.modelRoot.visible = false;
  scene.add(human.root, human.modelRoot, human.fallback);

  const loader = opts.loader || (opts.GLTFLoaderClass ? new opts.GLTFLoaderClass() : null);
  const modelUrl = opts.modelUrl || HUMAN_URL;
  if (!loader || !modelUrl) {
    human.loaded = true;
    human.fallback.visible = true;
    return human;
  }

  loader.setCrossOrigin?.('anonymous');
  loader.load(modelUrl, (gltf) => {
    const model = gltf?.scene;
    if (!model) {
      human.loaded = true;
      human.activeGlb = false;
      human.modelRoot.visible = false;
      human.fallback.visible = true;
      return;
    }
    normalizeHuman(model, opts);
    model.traverse((obj) => {
      if (!obj?.isMesh) return;
      obj.castShadow = true;
      obj.receiveShadow = true;
      obj.frustumCulled = false;
      const materials = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
      materials.forEach((m) => {
        if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
        m.needsUpdate = true;
      });
    });
    human.bones = buildAvatarBones(model);
    human.leftFingers = collectFingerBones(human.bones.leftHand);
    human.rightFingers = collectFingerBones(human.bones.rightHand);
    [...Object.values(human.bones), ...human.leftFingers, ...human.rightFingers].forEach((bone) => bone && human.restQuats.set(bone, bone.quaternion.clone()));
    human.activeGlb = Boolean(human.bones.hips && human.bones.spine && human.bones.head && human.bones.leftUpperArm && human.bones.leftLowerArm && human.bones.leftHand && human.bones.rightUpperArm && human.bones.rightLowerArm && human.bones.rightHand && human.bones.leftUpperLeg && human.bones.leftLowerLeg && human.bones.rightUpperLeg && human.bones.rightLowerLeg);
    human.model = model;
    human.modelRoot.add(model);
    human.modelRoot.visible = human.activeGlb;
    human.fallback.visible = !human.activeGlb;
    human.loaded = true;
  }, undefined, () => {
    human.loaded = true;
    human.activeGlb = false;
    human.modelRoot.visible = false;
    human.fallback.visible = true;
  });

  return human;
}

function setBoneWorldQuaternion(bone, q) { if (!bone || !q) return; const parentQ = new THREE.Quaternion(); bone.parent?.getWorldQuaternion(parentQ); bone.quaternion.copy(parentQ.invert().multiply(q)); bone.updateMatrixWorld(true); }
function firstBoneChild(bone) { return bone?.children.find((c) => c?.isBone); }
function rotateBoneToward(bone, target, strength = 1, fallbackDir = UP) {
  if (!bone || strength <= 0) return;
  const bonePos = bone.getWorldPosition(new THREE.Vector3());
  const childPos = firstBoneChild(bone)?.getWorldPosition(new THREE.Vector3()) || bonePos.clone().addScaledVector(fallbackDir.clone().normalize(), 0.25);
  const current = childPos.sub(bonePos).normalize();
  const desired = target.clone().sub(bonePos);
  if (desired.lengthSq() < 1e-6 || current.lengthSq() < 1e-6) return;
  const delta = new THREE.Quaternion().slerpQuaternions(new THREE.Quaternion(), new THREE.Quaternion().setFromUnitVectors(current, desired.normalize()), clamp01(strength));
  setBoneWorldQuaternion(bone, delta.multiply(bone.getWorldQuaternion(new THREE.Quaternion())));
}
function twistBone(bone, axis, amount) { if (!bone || Math.abs(amount) < 1e-5) return; setBoneWorldQuaternion(bone, new THREE.Quaternion().setFromAxisAngle(axis.clone().normalize(), amount).multiply(bone.getWorldQuaternion(new THREE.Quaternion()))); }
function aimTwoBone(upper, lower, elbow, hand, pole, upperStrength = 0.96, lowerStrength = 0.98) { for (let i = 0; i < 4; i += 1) { rotateBoneToward(upper, elbow, upperStrength, pole); rotateBoneToward(lower, hand, lowerStrength, pole); } }
function setHandBasis(bone, side, up, forward, roll = 0, strength = 1) { if (!bone || strength <= 0) return; const q = makeBasisQuaternion(side, up, forward); if (Math.abs(roll) > 1e-4) q.multiply(new THREE.Quaternion().setFromAxisAngle(forward.clone().normalize(), roll)); setBoneWorldQuaternion(bone, bone.getWorldQuaternion(new THREE.Quaternion()).slerp(q, clamp01(strength))); }

function cueSocketOffsetWorld(side, up, forward, roll, socketLocal = CFG.rightHandCueSocketLocal) {
  const q = makeBasisQuaternion(side, up, forward);
  if (Math.abs(roll) > 1e-5) q.multiply(new THREE.Quaternion().setFromAxisAngle(forward.clone().normalize(), roll));
  return socketLocal.clone().applyQuaternion(q);
}

function poseFingers(fingers, mode, weight) {
  const w = clamp01(weight);
  fingers.forEach((finger, i) => {
    const n = cleanName(finger.name); const thumb = n.includes('thumb'); const index = n.includes('index'); const middle = n.includes('middle'); const ring = n.includes('ring'); const pinky = n.includes('pinky') || n.includes('little');
    const base = !(n.includes('2') || n.includes('3') || n.includes('intermediate') || n.includes('distal')); const mid = n.includes('2') || n.includes('intermediate');
    if (mode === 'idle') { finger.rotation.x += 0.018 * w; finger.rotation.z += 0.01 * w * (i % 2 ? -1 : 1); return; }
    if (mode === 'grip') {
      if (thumb) { finger.rotation.x += 0.48 * w; finger.rotation.y += -0.82 * w; finger.rotation.z += 0.54 * w; return; }
      const curl = index ? (base ? 0.58 : mid ? 0.9 : 0.68) : middle ? (base ? 0.76 : mid ? 1.02 : 0.76) : ring ? (base ? 0.72 : mid ? 0.92 : 0.7) : pinky ? (base ? 0.62 : mid ? 0.82 : 0.62) : 0;
      finger.rotation.x += curl * w; finger.rotation.y += (index ? -0.12 : middle ? -0.03 : ring ? 0.04 : pinky ? 0.08 : 0) * w; finger.rotation.z += (index ? -0.08 : middle ? -0.02 : ring ? 0.06 : pinky ? 0.12 : 0) * w; return;
    }
    if (thumb) { finger.rotation.x += -0.18 * w; finger.rotation.y += 0.95 * w; finger.rotation.z += -0.95 * w; }
    else if (index) { finger.rotation.x += (base ? 0.26 : mid ? 0.42 : 0.28) * w; finger.rotation.y += -0.46 * w; finger.rotation.z += -0.42 * w; }
    else if (middle) { finger.rotation.x += (base ? 0.18 : mid ? 0.32 : 0.22) * w; finger.rotation.y += -0.12 * w; finger.rotation.z += -0.14 * w; }
    else if (ring || pinky) { finger.rotation.x += (base ? (ring ? 0.08 : 0.05) : mid ? (ring ? 0.18 : 0.16) : (ring ? 0.12 : 0.1)) * w; finger.rotation.y += (ring ? 0.18 : 0.34) * w; finger.rotation.z += (ring ? 0.28 : 0.46) * w; }
  });
}

function driveHuman(human, frame) {
  if (!human.activeGlb || !human.model) {
    human.fallback.visible = true;
    human.fallback.position.copy(frame.rootWorld);
    human.fallback.rotation.y = human.yaw;
    human.fallback.rotation.x = -0.16 * frame.t;
    human.fallback.position.y -= 0.035 * frame.t;
    return;
  }
  human.fallback.visible = false;
  human.modelRoot.visible = true;
  human.modelRoot.position.copy(frame.rootWorld);
  human.modelRoot.rotation.y = human.yaw;
  human.modelRoot.updateMatrixWorld(true);
  human.restQuats.forEach((q, bone) => bone.quaternion.copy(q));
  human.modelRoot.updateMatrixWorld(true);

  const b = human.bones;
  const ik = easeInOut(clamp01(frame.t));
  const idle = 1 - ik;
  const cueDir = frame.cueTipWorld.clone().sub(frame.cueBackWorld).normalize();
  const shotQ = makeBasisQuaternion(frame.side, UP, frame.forward);

  if (frame.walkAmount * idle > 0.001) {
    const s = Math.sin(human.walkT * 6.2), c = Math.cos(human.walkT * 6.2), w = frame.walkAmount * idle;
    if (b.leftUpperLeg) b.leftUpperLeg.rotation.x += s * 0.22 * w;
    if (b.rightUpperLeg) b.rightUpperLeg.rotation.x -= s * 0.22 * w;
    if (b.leftLowerLeg) b.leftLowerLeg.rotation.x += Math.max(0, -s) * 0.18 * w;
    if (b.rightLowerLeg) b.rightLowerLeg.rotation.x += Math.max(0, s) * 0.18 * w;
    if (b.leftUpperArm) b.leftUpperArm.rotation.x -= s * 0.2 * w;
    if (b.rightUpperArm) b.rightUpperArm.rotation.x += s * 0.2 * w;
    if (b.spine) b.spine.rotation.z += c * 0.02 * w;
    if (b.hips) b.hips.rotation.z -= c * 0.014 * w;
  }

  if (ik >= 0.025) {
    rotateBoneToward(b.hips, frame.torsoCenterWorld, (0.12 + 0.35 * ik) * ik, frame.forward);
    twistBone(b.hips, frame.side, -0.045 * ik);
    twistBone(b.hips, frame.forward, -0.025 * ik);
    rotateBoneToward(b.spine, frame.chestCenterWorld, (0.34 + 0.34 * ik) * ik, frame.forward);
    twistBone(b.spine, frame.side, -0.2 * ik);
    twistBone(b.spine, frame.forward, -0.04 * ik);
    rotateBoneToward(b.chest, frame.neckWorld, (0.5 + 0.28 * ik) * ik, frame.forward);
    twistBone(b.chest, frame.side, -0.32 * ik);
    twistBone(b.chest, frame.forward, -0.025 * ik);
    rotateBoneToward(b.neck, frame.headCenterWorld, 0.64 * ik, frame.forward);
    twistBone(b.neck, frame.side, -0.12 * ik);
    setBoneWorldQuaternion(b.head, b.head ? b.head.getWorldQuaternion(new THREE.Quaternion()).slerp(shotQ.clone().multiply(new THREE.Quaternion().setFromAxisAngle(frame.side, -0.12 * ik)).multiply(new THREE.Quaternion().setFromAxisAngle(frame.forward, -0.025 * ik)), 0.74 * ik) : shotQ);
    human.modelRoot.updateMatrixWorld(true);
  }

  const rightGrip = frame.rightHandWorld.clone();
  const rightIdleElbow = rightGrip.clone().addScaledVector(UP, 0.1 + 0.28 * ik).addScaledVector(frame.side, -0.22 - 0.04 * ik).addScaledVector(frame.forward, -0.03 * idle);
  const rightElbow = frame.rightElbow.clone().lerp(rightIdleElbow, idle * 0.52);
  const rightHold = 0.88 + 0.12 * ik;
  const rightArmPole = UP.clone().multiplyScalar(1.32).addScaledVector(frame.side, -0.62).addScaledVector(frame.forward, -1.05).normalize();
  aimTwoBone(b.rightUpperArm, b.rightLowerArm, rightElbow, rightGrip, rightArmPole, rightHold, rightHold);

  const standingHandSide = frame.side.clone().multiplyScalar(-1)
    .addScaledVector(UP, -0.55)
    .addScaledVector(frame.forward, 0.16)
    .normalize();
  const standingHandUp = UP.clone().multiplyScalar(-1.0)
    .addScaledVector(frame.side, -0.64)
    .addScaledVector(frame.forward, 0.2)
    .normalize();
  const standingCueDir = new THREE.Vector3(0.055, 0.965, -0.13).applyAxisAngle(Y_AXIS, human.yaw).normalize();
  const handForwardForOrientation = ik >= 0.025 ? standingCueDir : cueDir;
  const rollForOrientation = ik >= 0.025
    ? (human.cfg?.rightHandRollIdle ?? CFG.rightHandRollIdle)
    : (human.cfg?.rightHandRollIdle ?? CFG.rightHandRollIdle) + 0.02 * frame.stroke;
  setHandBasis(b.rightHand, standingHandSide, standingHandUp, handForwardForOrientation, rollForOrientation, 1.0);
  poseFingers(human.rightFingers, 'grip', 0.95);

  if (ik < 0.025) { poseFingers(human.leftFingers, 'idle', 1); return; }

  const leftHand = frame.leftHandWorld.clone().addScaledVector(frame.forward, 0.032 * ik).addScaledVector(frame.side, -0.018 * ik).addScaledVector(UP, -0.018 * ik);
  const leftElbow = frame.leftElbow.clone().addScaledVector(frame.forward, 0.045 * ik).addScaledVector(frame.side, -0.05 * ik).addScaledVector(UP, -0.01 * ik);
  aimTwoBone(b.leftUpperArm, b.leftLowerArm, leftElbow, leftHand, frame.side.clone().multiplyScalar(-1).addScaledVector(UP, 0.1).normalize(), 0.98 * ik, 1.0 * ik);
  twistBone(b.leftUpperArm, frame.forward, -0.2 * ik);
  twistBone(b.leftLowerArm, frame.forward, 0.025 * ik);
  const bridgeSide = frame.side.clone().multiplyScalar(-1).addScaledVector(frame.forward, -0.52).normalize();
  const bridgeUp = UP.clone().multiplyScalar(0.78).addScaledVector(frame.forward, -0.28).addScaledVector(frame.side, -0.16).normalize();
  setHandBasis(b.leftHand, bridgeSide, bridgeUp, cueDir, -0.68 * ik, 1.0 * ik);
  poseFingers(human.leftFingers, 'bridge', ik);

  aimTwoBone(
    b.leftUpperLeg,
    b.leftLowerLeg,
    frame.leftKnee,
    frame.leftFootWorld,
    frame.forward.clone().addScaledVector(UP, 0.18).normalize(),
    0.9 * ik,
    1.0 * ik
  );
  twistBone(b.leftUpperLeg, frame.forward, -0.035 * ik);
  setHandBasis(b.leftFoot, frame.side, frame.up, frame.forward, -0.02 * ik, (human.cfg?.footLockStrength ?? CFG.footLockStrength) * ik);

  aimTwoBone(
    b.rightUpperLeg,
    b.rightLowerLeg,
    frame.rightKnee,
    frame.rightFootWorld,
    frame.forward.clone().multiplyScalar(-1).addScaledVector(UP, 0.18).normalize(),
    0.9 * ik,
    1.0 * ik
  );
  twistBone(b.rightUpperLeg, frame.forward, 0.03 * ik);
  setHandBasis(b.rightFoot, frame.side, frame.up, frame.forward, 0.02 * ik, (human.cfg?.footLockStrength ?? CFG.footLockStrength) * ik);
}

export function chooseHumanEdgePosition(cueBallWorld, aimForward, opts = {}) { const cfg = { ...CFG, ...opts }; const desired = cueBallWorld.clone().addScaledVector(aimForward, -cfg.desiredShootDistance); const xEdge = (opts.tableW ?? 2.0) / 2 + cfg.edgeMargin; const zEdge = (opts.tableL ?? 3.6) / 2 + cfg.edgeMargin; const candidates = [new THREE.Vector3(-xEdge, 0, clamp(desired.z, -zEdge, zEdge)), new THREE.Vector3(xEdge, 0, clamp(desired.z, -zEdge, zEdge)), new THREE.Vector3(clamp(desired.x, -xEdge, xEdge), 0, -zEdge), new THREE.Vector3(clamp(desired.x, -xEdge, xEdge), 0, zEdge)]; return candidates.sort((a, b) => a.distanceToSquared(desired) - b.distanceToSquared(desired))[0].clone(); }

export function updateSnookerHumanPose(human, dt, frameData) {
  if (!human || !frameData || !Number.isFinite(dt) || dt < 0 || !frameData.rootTarget || !frameData.aimForward) return;
  const cfg = { ...CFG, ...(human.cfg || {}) }; const state = frameData.state || 'idle';
  human.poseT = dampScalar(human.poseT, state === 'idle' ? 0 : 1, cfg.poseLambda, dt); human.breathT += dt * (state === 'idle' ? 1.05 : 0.5); human.settleT = dampScalar(human.settleT, state === 'dragging' ? 1 : 0, 5.5, dt);
  if (state === 'striking') { if (human.strikeClock === 0) { human.strikeRoot.copy(human.root.position.lengthSq() > 0.001 ? human.root.position : frameData.rootTarget); human.strikeYaw = human.yaw; } human.strikeClock += dt; } else human.strikeClock = 0;
  const rootGoal = state === 'striking' ? human.strikeRoot : frameData.rootTarget; dampVector(human.root.position, rootGoal, state === 'striking' ? 12 : cfg.moveLambda, dt);
  const moveAmountRaw = human.root.position.distanceTo(rootGoal); human.walkT += dt * (2 + Math.min(7, moveAmountRaw * 10)); human.yaw = dampScalar(human.yaw, state === 'striking' ? human.strikeYaw : yawFromForward(frameData.aimForward), cfg.rotLambda, dt);
  const t = easeInOut(human.poseT), idle = 1 - t, breath = Math.sin(human.breathT * Math.PI * 2) * (0.006 + idle * 0.004), walk = Math.sin(human.walkT * 6.2) * Math.min(1, moveAmountRaw * 12), walkAmount = clamp01(moveAmountRaw * 18) * idle;
  const power = frameData.power ?? 0; const stroke = state === 'dragging' ? Math.sin(performance.now() * 0.011) * (0.25 + power * 0.75) : 0; const follow = state === 'striking' ? Math.sin(clamp01(human.strikeClock / (cfg.strikeTime + cfg.holdTime)) * Math.PI) : 0;
  const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(Y_AXIS, human.yaw).normalize(); const side = new THREE.Vector3(forward.z, 0, -forward.x).normalize(); const local = (v) => v.clone().applyAxisAngle(Y_AXIS, human.yaw).add(human.root.position); const powerLean = power * t;
  const rootWorld = human.root.position.clone().addScaledVector(forward, 0.018 * powerLean + 0.026 * follow);
  const torso = local(new THREE.Vector3(0, lerp(1.3, 1.12, t) + breath, lerp(0.02, -0.16, t) - 0.014 * powerLean));
  const chest = local(new THREE.Vector3(0, lerp(1.52, 1.22, t) + breath, lerp(0.02, -0.42, t) - 0.024 * powerLean));
  const neck = local(new THREE.Vector3(0, lerp(1.68, 1.25, t) + breath, lerp(0.02, -0.61, t) - 0.028 * powerLean));
  const head = local(new THREE.Vector3(0, lerp(1.84, 1.34, t) + breath - cfg.chinToCueHeight * 0.16 * t, lerp(0.04, -0.72, t) - 0.028 * powerLean));
  const leftShoulder = local(new THREE.Vector3(-0.23, lerp(1.58, 1.36, t) + breath, lerp(0, -0.46, t) - 0.018 * human.settleT));
  const rightShoulder = local(new THREE.Vector3(0.23, lerp(1.58, 1.36, t) + breath, lerp(0, -0.34, t) - 0.018 * human.settleT));
  const leftHip = local(new THREE.Vector3(-0.13, 0.92, 0.02)); const rightHip = local(new THREE.Vector3(0.13, 0.92, 0.02));
  const leftFoot = local(new THREE.Vector3(-0.13, cfg.footGroundY, 0.03 + walk * 0.018).lerp(new THREE.Vector3(-cfg.stanceWidth * 0.42, cfg.footGroundY, -0.34), t));
  const rightFoot = local(new THREE.Vector3(0.13, cfg.footGroundY, -0.03 - walk * 0.018).lerp(new THREE.Vector3(cfg.stanceWidth * 0.5, cfg.footGroundY, 0.34), t));
  const bridgePalmTarget = frameData.bridgeTarget.clone().addScaledVector(forward, -0.006 * t).addScaledVector(side, -0.012 * t).setY(cfg.tableTopY + cfg.bridgePalmTableLift).addScaledVector(UP, -0.01 * human.settleT);
  const leftHand = frameData.idleLeft.clone().lerp(bridgePalmTarget, t);
  const cueDirForHand = frameData.cueTip.clone().sub(frameData.cueBack).normalize();
  const handIk = easeInOut(clamp01(t));
  const idleGripSide = side.clone().multiplyScalar(-1).addScaledVector(UP, -0.55).addScaledVector(forward, 0.16).normalize();
  const idleGripUp = UP.clone().multiplyScalar(-1.0).addScaledVector(side, -0.64).addScaledVector(forward, 0.2).normalize();
  const liveGripSide = side.clone().multiplyScalar(-1).addScaledVector(UP, lerp(-0.55, -0.2, handIk)).addScaledVector(side, 0.18 * handIk).addScaledVector(forward, lerp(0.16, -0.02, handIk)).normalize();
  const liveGripUp = UP.clone().multiplyScalar(lerp(-1.0, 0.74, handIk)).addScaledVector(side, lerp(-0.64, -0.22, handIk)).addScaledVector(forward, lerp(0.2, -0.22, handIk)).normalize();
  const backGripPoint = frameData.cueBack.clone().addScaledVector(cueDirForHand, cfg.shootCueGripFromBack);
  const liveCueGripPoint = backGripPoint
    .clone()
    .addScaledVector(forward, 0.002 * stroke * t + 0.002 * follow * power);
  const idleWristTarget = frameData.idleRight.clone().sub(cueSocketOffsetWorld(idleGripSide, idleGripUp, cueDirForHand, cfg.rightHandRollIdle, cfg.rightHandCueSocketLocal));
  const liveWristTarget = liveCueGripPoint.clone().sub(cueSocketOffsetWorld(liveGripSide, liveGripUp, cueDirForHand, lerp(cfg.rightHandRollIdle, cfg.rightHandRollShoot - (cfg.rightHandDownPose ?? 0), handIk), cfg.rightHandCueSocketLocal));
  const rightHand = idleWristTarget.clone().lerp(liveWristTarget, t);
  const leftElbow = leftShoulder.clone().lerp(leftHand, 0.62).addScaledVector(UP, 0.006 * t).addScaledVector(side, -0.044 * t).addScaledVector(forward, 0.065 * t);
  const rightElbow = rightHand.clone().addScaledVector(UP, lerp(0.12, cfg.rightElbowShotRise, t)).addScaledVector(side, lerp(-0.18, cfg.rightElbowShotSide, t)).addScaledVector(forward, lerp(-0.04, cfg.rightElbowShotBack, t));
  const leftKnee = leftHip.clone().lerp(leftFoot, 0.53).addScaledVector(UP, lerp(0.2, cfg.kneeBendShot, t)).addScaledVector(forward, 0.04 * t).addScaledVector(side, -0.012 * t);
  const rightKnee = rightHip.clone().lerp(rightFoot, 0.52).addScaledVector(UP, lerp(0.2, cfg.kneeBendShot * 0.88, t)).addScaledVector(forward, -0.03 * t).addScaledVector(side, 0.014 * t);
  human.root.visible = true;
  driveHuman(human, { t, breath, stroke, follow, walkAmount, forward, side, up: UP, rootWorld, torsoCenterWorld: torso, chestCenterWorld: chest, neckWorld: neck, headCenterWorld: head, leftElbow, rightElbow, leftHandWorld: leftHand, rightHandWorld: rightHand, leftKnee, rightKnee, leftFootWorld: leftFoot, rightFootWorld: rightFoot, cueBackWorld: frameData.cueBack || frameData.bridgeTarget || frameData.rootTarget, cueTipWorld: frameData.cueTip || frameData.gripTarget || frameData.rootTarget });
}

export const updateBilardoHumanPose = updateSnookerHumanPose;
