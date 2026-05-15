import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

export const DEMO_HUMAN_URL = 'https://threejs.org/examples/models/gltf/readyplayer.me.glb';

const UP = new THREE.Vector3(0, 1, 0);
const Y_AXIS = UP;
const BASIS_MAT = new THREE.Matrix4();
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => t * t * (3 - 2 * t);
const dampScalar = (current, target, lambda, dt) => THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));
const dampVector = (current, target, lambda, dt) => current.lerp(target, 1 - Math.exp(-lambda * dt));
const yawFromForward = (forward) => Math.atan2(-forward.x, -forward.z);
const cleanName = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

function makeBasisQuaternion(side, up, forward) {
  BASIS_MAT.makeBasis(side.clone().normalize(), up.clone().normalize(), forward.clone().normalize());
  return new THREE.Quaternion().setFromRotationMatrix(BASIS_MAT);
}

function createUniversalGLTFLoader(renderer, { dracoPath = '/vendor/three/examples/jsm/libs/draco/', basisPath = '/vendor/three/examples/jsm/libs/basis/' } = {}) {
  const loader = new GLTFLoader();
  loader.setCrossOrigin('anonymous');
  const draco = new DRACOLoader();
  draco.setDecoderPath(dracoPath);
  loader.setDRACOLoader(draco);
  const ktx2 = new KTX2Loader();
  ktx2.setTranscoderPath(basisPath);
  if (renderer) {
    try { ktx2.detectSupport(renderer); } catch {}
  }
  loader.setKTX2Loader(ktx2);
  loader.setMeshoptDecoder?.(MeshoptDecoder);
  return { loader, dispose: () => { draco.dispose?.(); ktx2.dispose?.(); } };
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
  model.traverse((obj) => { if (obj.isBone) all.push(obj); });
  const f = (...names) => findBone(all, names);
  return {
    hips: f('hips', 'pelvis', 'mixamorigHips'), spine: f('spine', 'spine01', 'mixamorigSpine'), chest: f('spine2', 'chest', 'upperchest', 'mixamorigSpine2', 'mixamorigSpine1'), neck: f('neck', 'mixamorigNeck'), head: f('head', 'mixamorigHead'),
    leftUpperArm: f('leftupperarm', 'leftarm', 'upperarml', 'mixamorigLeftArm'), leftLowerArm: f('leftforearm', 'leftlowerarm', 'forearml', 'mixamorigLeftForeArm'), leftHand: f('lefthand', 'handl', 'mixamorigLeftHand'),
    rightUpperArm: f('rightupperarm', 'rightarm', 'upperarmr', 'mixamorigRightArm'), rightLowerArm: f('rightforearm', 'rightlowerarm', 'forearmr', 'mixamorigRightForeArm'), rightHand: f('righthand', 'handr', 'mixamorigRightHand'),
    leftUpperLeg: f('leftupleg', 'leftupperleg', 'leftthigh', 'mixamorigLeftUpLeg'), leftLowerLeg: f('leftleg', 'leftlowerleg', 'leftcalf', 'mixamorigLeftLeg'), leftFoot: f('leftfoot', 'footl', 'mixamorigLeftFoot'),
    rightUpperLeg: f('rightupleg', 'rightupperleg', 'rightthigh', 'mixamorigRightUpLeg'), rightLowerLeg: f('rightleg', 'rightlowerleg', 'rightcalf', 'mixamorigRightLeg'), rightFoot: f('rightfoot', 'footr', 'mixamorigRightFoot')
  };
}

function collectFingerBones(hand) {
  const out = [];
  hand?.traverse((obj) => {
    if (!obj.isBone || obj === hand) return;
    const n = cleanName(obj.name);
    if (['thumb', 'index', 'middle', 'ring', 'pinky', 'little', 'finger'].some((s) => n.includes(s))) out.push(obj);
  });
  return out;
}

function normalizeHuman(model, cfg) {
  model.rotation.set(0, cfg.humanVisualYawFix, 0);
  model.position.set(0, 0, 0);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const height = Math.max(box.max.y - box.min.y, 0.0001);
  model.scale.multiplyScalar(cfg.humanScale / height);
  model.updateMatrixWorld(true);
  const scaledBox = new THREE.Box3().setFromObject(model);
  const center = scaledBox.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -scaledBox.min.y, -center.z);
}

export function createDemoHumanConfig(overrides = {}) {
  return Object.freeze({
    scale: 3.5,
    tableTopY: 0.84 * 3.5,
    tableW: 2.55 * 3.5,
    tableL: 4.85 * 3.5,
    ballR: 0.045 * 3.5,
    idleGap: 0.012 * 3.5,
    contactGap: 0.0012 * 3.5,
    pullRange: 0.42 * 3.5,
    strikeTime: 0.12,
    holdTime: 0.05,
    cueLength: 1.78 * 3.5,
    bridgeDist: 0.28 * 3.5,
    edgeMargin: 0.68 * 3.5,
    desiredShootDistance: 1.25 * 3.5,
    poseLambda: 9,
    moveLambda: 5.6,
    rotLambda: 8.5,
    humanScale: 1.2 * 1.78 * 3.5,
    humanVisualYawFix: Math.PI,
    stanceWidth: 0.52 * 3.5,
    bridgePalmTableLift: 0.006 * 3.5,
    bridgeCueLift: 0.018 * 3.5,
    bridgeHandBackFromBall: 0.235 * 3.5,
    bridgeHandSide: -0.012 * 3.5,
    chinToCueHeight: 0.11 * 3.5,
    footGroundY: 0.035 * 3.5,
    footLockStrength: 1,
    kneeBendShot: 0.16 * 3.5,
    rightElbowShotRise: 0.18 * 3.5,
    rightElbowShotSide: -0.46 * 3.5,
    rightElbowShotBack: -0.78 * 3.5,
    rightForearmOutward: 0.36 * 3.5,
    rightForearmBack: 0.44 * 3.5,
    rightForearmDown: 0.48 * 3.5,
    rightForearmLength: 0.34 * 3.5,
    rightStrokePull: 0.30 * 3.5,
    rightStrokePush: 0.24 * 3.5,
    rightHandShotLift: -0.30 * 3.5,
    shootCueGripFromBack: 0.58 * 3.5,
    idleRightHandY: 0.8 * 3.5,
    idleRightHandX: 0.31 * 3.5,
    idleRightHandZ: -0.015 * 3.5,
    idleCueGripFromBack: 0.24 * 3.5,
    idleCueDir: new THREE.Vector3(0.055, 0.965, -0.13),
    rightHandRollIdle: -2.2,
    rightHandRollShoot: -2.05,
    rightHandDownPose: 0.42,
    rightHandCueSocketLocal: new THREE.Vector3(-0.004, -0.014, 0.092).multiplyScalar(3.5),
    ...overrides
  });
}

export function createDemoHuman(parent, renderer, cfg = createDemoHumanConfig()) {
  const human = { root: new THREE.Group(), modelRoot: new THREE.Group(), model: null, bones: {}, leftFingers: [], rightFingers: [], restQuats: new Map(), activeGlb: false, poseT: 0, walkT: 0, yaw: 0, breathT: 0, settleT: 0, strikeRoot: new THREE.Vector3(), strikeYaw: 0, strikeClock: 0, cfg };
  human.root.visible = false;
  human.modelRoot.visible = false;
  parent.add(human.root, human.modelRoot);
  const { loader, dispose } = createUniversalGLTFLoader(renderer);
  loader.load(DEMO_HUMAN_URL, (gltf) => {
    const model = gltf.scene || gltf.scenes?.[0];
    if (!model) return;
    normalizeHuman(model, cfg);
    model.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        obj.frustumCulled = false;
        const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
        mats.forEach((m) => { if (m.map) { m.map.colorSpace = THREE.SRGBColorSpace; m.map.flipY = false; m.map.needsUpdate = true; } m.needsUpdate = true; });
      }
    });
    human.bones = buildAvatarBones(model);
    human.leftFingers = collectFingerBones(human.bones.leftHand);
    human.rightFingers = collectFingerBones(human.bones.rightHand);
    [...Object.values(human.bones), ...human.leftFingers, ...human.rightFingers].forEach((bone) => bone && human.restQuats.set(bone, bone.quaternion.clone()));
    human.activeGlb = Boolean(human.bones.hips && human.bones.spine && human.bones.head && human.bones.rightUpperArm && human.bones.rightLowerArm && human.bones.rightHand);
    human.model = model;
    human.modelRoot.add(model);
    human.modelRoot.visible = human.activeGlb;
  }, undefined, (error) => console.warn('Demo ReadyPlayer human failed to load', error));
  human.dispose = dispose;
  return human;
}

function setBoneWorldQuaternion(bone, q) {
  if (!bone || !q) return;
  const parentQ = new THREE.Quaternion();
  bone.parent?.getWorldQuaternion(parentQ);
  bone.quaternion.copy(parentQ.invert().multiply(q));
  bone.updateMatrixWorld(true);
}
function firstBoneChild(bone) { return bone?.children.find((child) => child.isBone); }
function rotateBoneToward(bone, target, strength = 1, fallbackDir = UP, cfg) {
  if (!bone || strength <= 0) return;
  const bonePos = bone.getWorldPosition(new THREE.Vector3());
  const childPos = firstBoneChild(bone)?.getWorldPosition(new THREE.Vector3()) || bonePos.clone().addScaledVector(fallbackDir.clone().normalize(), 0.25 * cfg.scale);
  const current = childPos.sub(bonePos).normalize();
  const desired = target.clone().sub(bonePos);
  if (desired.lengthSq() < 1e-6 || current.lengthSq() < 1e-6) return;
  const delta = new THREE.Quaternion().slerpQuaternions(new THREE.Quaternion(), new THREE.Quaternion().setFromUnitVectors(current, desired.normalize()), clamp01(strength));
  setBoneWorldQuaternion(bone, delta.multiply(bone.getWorldQuaternion(new THREE.Quaternion())));
}
function twistBone(bone, axis, amount) {
  if (!bone || Math.abs(amount) < 1e-5) return;
  setBoneWorldQuaternion(bone, new THREE.Quaternion().setFromAxisAngle(axis.clone().normalize(), amount).multiply(bone.getWorldQuaternion(new THREE.Quaternion())));
}
function aimTwoBone(upper, lower, elbow, hand, pole, upperStrength = 0.96, lowerStrength = 0.98, cfg) {
  for (let i = 0; i < 4; i += 1) {
    rotateBoneToward(upper, elbow, upperStrength, pole, cfg);
    rotateBoneToward(lower, hand, lowerStrength, pole, cfg);
  }
}
function setHandBasis(hand, side, up, forward, roll = 0, strength = 1) {
  if (!hand || strength <= 0) return;
  const q = makeBasisQuaternion(side, up, forward).multiply(new THREE.Quaternion().setFromAxisAngle(forward.clone().normalize(), roll));
  setBoneWorldQuaternion(hand, hand.getWorldQuaternion(new THREE.Quaternion()).slerp(q, clamp01(strength)));
}
function poseFingers(fingers, mode, amount) {
  const w = clamp01(amount);
  fingers.forEach((finger) => {
    const n = cleanName(finger.name);
    const thumb = n.includes('thumb'), index = n.includes('index'), middle = n.includes('middle'), ring = n.includes('ring'), pinky = n.includes('pinky') || n.includes('little');
    const base = /1|proximal|metacarpal/.test(n), mid = /2|intermediate/.test(n), tip = /3|distal/.test(n);
    if (mode === 'idle') { finger.rotation.x += (thumb ? 0.1 : base ? 0.08 : mid ? 0.12 : 0.08) * w; return; }
    if (mode === 'grip') {
      if (thumb) { finger.rotation.x += 0.48 * w; finger.rotation.y += -0.82 * w; finger.rotation.z += 0.54 * w; return; }
      const curl = index ? (base ? 0.58 : mid ? 0.9 : 0.68) : middle ? (base ? 0.76 : mid ? 1.02 : 0.76) : ring ? (base ? 0.72 : mid ? 0.92 : 0.7) : pinky ? (base ? 0.62 : mid ? 0.82 : 0.62) : 0;
      finger.rotation.x += curl * w;
      return;
    }
    if (thumb) { finger.rotation.x += -0.18 * w; finger.rotation.y += 0.95 * w; finger.rotation.z += -0.95 * w; }
    else if (index) { finger.rotation.x += (base ? 0.26 : mid ? 0.42 : 0.28) * w; finger.rotation.y += -0.46 * w; finger.rotation.z += -0.42 * w; }
    else if (middle) { finger.rotation.x += (base ? 0.18 : mid ? 0.32 : 0.22) * w; finger.rotation.y += -0.12 * w; finger.rotation.z += -0.14 * w; }
    else if (ring || pinky) { finger.rotation.x += (base ? (ring ? 0.08 : 0.05) : mid ? (ring ? 0.18 : 0.16) : tip ? (ring ? 0.12 : 0.1) : 0.1) * w; finger.rotation.y += (ring ? 0.18 : 0.34) * w; finger.rotation.z += (ring ? 0.28 : 0.46) * w; }
  });
}
function cueSocketOffsetWorld(side, up, forward, roll, cfg) {
  const socket = cfg.rightHandCueSocketLocal;
  const q = makeBasisQuaternion(side, up, forward).multiply(new THREE.Quaternion().setFromAxisAngle(forward.clone().normalize(), roll));
  return socket.clone().applyQuaternion(q);
}
function driveHuman(human, frame) {
  const cfg = human.cfg;
  if (!human.activeGlb || !human.model) return;
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
  const standingCueDir = cfg.idleCueDir.clone().applyAxisAngle(Y_AXIS, human.yaw).normalize();
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
    rotateBoneToward(b.hips, frame.torsoCenterWorld, (0.12 + 0.35 * ik) * ik, frame.forward, cfg);
    twistBone(b.hips, frame.side, -0.045 * ik);
    twistBone(b.spine, frame.side, -0.2 * ik);
    rotateBoneToward(b.spine, frame.chestCenterWorld, (0.34 + 0.34 * ik) * ik, frame.forward, cfg);
    rotateBoneToward(b.chest, frame.neckWorld, (0.5 + 0.28 * ik) * ik, frame.forward, cfg);
    twistBone(b.chest, frame.side, -0.32 * ik);
    rotateBoneToward(b.neck, frame.headCenterWorld, 0.64 * ik, frame.forward, cfg);
    setBoneWorldQuaternion(b.head, b.head ? b.head.getWorldQuaternion(new THREE.Quaternion()).slerp(shotQ.clone().multiply(new THREE.Quaternion().setFromAxisAngle(frame.side, -0.12 * ik)), 0.74 * ik) : shotQ);
    human.modelRoot.updateMatrixWorld(true);
  }
  const rightGrip = frame.rightHandWorld.clone();
  const rightIdleElbow = rightGrip.clone().addScaledVector(UP, 0.04 * cfg.scale + 0.14 * cfg.scale * ik).addScaledVector(frame.side, -0.2 * cfg.scale).addScaledVector(frame.forward, -0.03 * cfg.scale * idle);
  const rightElbow = frame.rightElbow.clone().lerp(rightIdleElbow, idle * 0.5);
  aimTwoBone(b.rightUpperArm, b.rightLowerArm, rightElbow, rightGrip, frame.side.clone().multiplyScalar(-1).addScaledVector(UP, 0.32).addScaledVector(frame.forward, -0.55).normalize(), 0.9 + 0.1 * ik, 1, cfg);
  const standingHandSide = frame.side.clone().multiplyScalar(-1).addScaledVector(UP, -0.55).addScaledVector(frame.forward, 0.16).normalize();
  const standingHandUp = UP.clone().multiplyScalar(-1).addScaledVector(frame.side, -0.64).addScaledVector(frame.forward, 0.2).normalize();
  setHandBasis(b.rightHand, standingHandSide, standingHandUp, ik >= 0.025 ? cueDir : standingCueDir, ik >= 0.025 ? cfg.rightHandRollShoot : cfg.rightHandRollIdle, 1);
  poseFingers(human.rightFingers, 'grip', 0.95);
  if (ik < 0.025) { poseFingers(human.leftFingers, 'idle', 1); return; }
  aimTwoBone(b.leftUpperArm, b.leftLowerArm, frame.leftElbow, frame.leftHandWorld, frame.side.clone().multiplyScalar(-1).addScaledVector(UP, 0.1).normalize(), 0.98 * ik, ik, cfg);
  setHandBasis(b.leftHand, frame.side.clone().multiplyScalar(-1).addScaledVector(frame.forward, -0.52).normalize(), UP.clone().multiplyScalar(0.78).addScaledVector(frame.forward, -0.28).addScaledVector(frame.side, -0.16).normalize(), cueDir, -0.68 * ik, ik);
  poseFingers(human.leftFingers, 'bridge', ik);
  aimTwoBone(b.leftUpperLeg, b.leftLowerLeg, frame.leftKnee, frame.leftFootWorld, frame.forward.clone().addScaledVector(UP, 0.18).normalize(), 0.9 * ik, ik, cfg);
  aimTwoBone(b.rightUpperLeg, b.rightLowerLeg, frame.rightKnee, frame.rightFootWorld, frame.forward.clone().multiplyScalar(-1).addScaledVector(UP, 0.18).normalize(), 0.9 * ik, ik, cfg);
}

export function cuePoseFromDemoGrip(grip, dir, gripFromBack, length) {
  const n = dir.clone().normalize();
  return { back: grip.clone().addScaledVector(n, -gripFromBack), tip: grip.clone().addScaledVector(n, length - gripFromBack) };
}

export function updateDemoHumanPose(human, dt, state, rootTarget, aimForward, bridgeTarget, idleRight, idleLeft, cueBack, cueTip, power) {
  const cfg = human.cfg;
  human.poseT = dampScalar(human.poseT, state === 'idle' ? 0 : 1, cfg.poseLambda, dt);
  human.breathT += dt * (state === 'idle' ? 1.05 : 0.5);
  human.settleT = dampScalar(human.settleT, state === 'dragging' ? 1 : 0, 5.5, dt);
  if (state === 'striking') {
    if (human.strikeClock === 0) { human.strikeRoot.copy(human.root.position.lengthSq() > 0.001 ? human.root.position : rootTarget); human.strikeYaw = human.yaw; }
    human.strikeClock += dt;
  } else human.strikeClock = 0;
  const rootGoal = state === 'striking' ? human.strikeRoot : rootTarget;
  dampVector(human.root.position, rootGoal, state === 'striking' ? 12 : cfg.moveLambda, dt);
  const moveAmountRaw = human.root.position.distanceTo(rootGoal);
  human.walkT += dt * (2 + Math.min(7, moveAmountRaw * 10 / cfg.scale));
  human.yaw = dampScalar(human.yaw, state === 'striking' ? human.strikeYaw : yawFromForward(aimForward), cfg.rotLambda, dt);
  const t = easeInOut(human.poseT), idle = 1 - t;
  const breath = Math.sin(human.breathT * Math.PI * 2) * ((0.006 + idle * 0.004) * cfg.scale);
  const walk = Math.sin(human.walkT * 6.2) * Math.min(1, moveAmountRaw * 12 / cfg.scale);
  const walkAmount = clamp01(moveAmountRaw * 18 / cfg.scale) * idle;
  const dragStroke = state === 'dragging' ? Math.sin(performance.now() * 0.011) * (0.25 + power * 0.75) : 0;
  const strikeFollow = state === 'striking' ? Math.sin(clamp01(human.strikeClock / (cfg.strikeTime + cfg.holdTime)) * Math.PI) : 0;
  const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(Y_AXIS, human.yaw).normalize();
  const side = new THREE.Vector3(forward.z, 0, -forward.x).normalize();
  const local = (v) => v.clone().applyAxisAngle(Y_AXIS, human.yaw).add(human.root.position);
  const rootWorld = human.root.position.clone();
  const torso = local(new THREE.Vector3(0, lerp(1.3, 1.14, t) * cfg.scale + breath, lerp(0.02, -0.16, t) * cfg.scale));
  const chest = local(new THREE.Vector3(0, lerp(1.52, 1.24, t) * cfg.scale + breath, lerp(0.02, -0.42, t) * cfg.scale));
  const neck = local(new THREE.Vector3(0, lerp(1.68, 1.28, t) * cfg.scale + breath, lerp(0.02, -0.61, t) * cfg.scale));
  const head = local(new THREE.Vector3(0, lerp(1.84, 1.37, t) * cfg.scale + breath, lerp(0.04, -0.72, t) * cfg.scale));
  const leftShoulder = local(new THREE.Vector3(-0.23 * cfg.scale, lerp(1.58, 1.36, t) * cfg.scale + breath, (lerp(0, -0.46, t) - 0.018 * human.settleT) * cfg.scale));
  const rightShoulder = local(new THREE.Vector3(0.23 * cfg.scale, lerp(1.58, 1.36, t) * cfg.scale + breath, (lerp(0, -0.34, t) - 0.018 * human.settleT) * cfg.scale));
  const leftHip = local(new THREE.Vector3(-0.13 * cfg.scale, 0.92 * cfg.scale, 0.02 * cfg.scale));
  const rightHip = local(new THREE.Vector3(0.13 * cfg.scale, 0.92 * cfg.scale, 0.02 * cfg.scale));
  const leftFoot = local(new THREE.Vector3(-0.13 * cfg.scale, cfg.footGroundY, 0.03 * cfg.scale + walk * 0.018 * cfg.scale).lerp(new THREE.Vector3(-cfg.stanceWidth * 0.42, cfg.footGroundY, -0.34 * cfg.scale), t));
  const rightFoot = local(new THREE.Vector3(0.13 * cfg.scale, cfg.footGroundY, -0.03 * cfg.scale - walk * 0.018 * cfg.scale).lerp(new THREE.Vector3(cfg.stanceWidth * 0.5, cfg.footGroundY, 0.34 * cfg.scale), t));
  const bridgePalmTarget = bridgeTarget.clone().addScaledVector(forward, -0.006 * cfg.scale * t).addScaledVector(side, -0.012 * cfg.scale * t).setY(cfg.tableTopY + cfg.bridgePalmTableLift).addScaledVector(UP, -0.01 * cfg.scale * human.settleT);
  const leftHand = idleLeft.clone().lerp(bridgePalmTarget, t);
  const cueDirForHand = cueTip.clone().sub(cueBack).normalize();
  const handIk = easeInOut(clamp01(t));
  const idleGripSide = side.clone().multiplyScalar(-1).addScaledVector(UP, -0.55).addScaledVector(forward, 0.16).normalize();
  const idleGripUp = UP.clone().multiplyScalar(-1).addScaledVector(side, -0.64).addScaledVector(forward, 0.2).normalize();
  const liveGripSide = side.clone().multiplyScalar(-1).addScaledVector(UP, lerp(-0.55, -0.62, handIk)).addScaledVector(side, 0.5 * handIk).addScaledVector(forward, lerp(0.16, -0.08, handIk)).normalize();
  const liveGripUp = UP.clone().multiplyScalar(lerp(-1, 0.12, handIk)).addScaledVector(side, lerp(-0.64, -0.04, handIk)).addScaledVector(forward, lerp(0.2, -0.48, handIk)).normalize();
  const lockedRightElbow = rightShoulder.clone().addScaledVector(UP, lerp(0.04 * cfg.scale, cfg.rightElbowShotRise, t)).addScaledVector(side, lerp(-0.18 * cfg.scale, cfg.rightElbowShotSide, t)).addScaledVector(forward, lerp(-0.04 * cfg.scale, cfg.rightElbowShotBack, t));
  const forearmStroke = (state === 'dragging' ? -cfg.rightStrokePull * easeOutCubic(power) : 0) + (state === 'striking' ? cfg.rightStrokePush * strikeFollow : 0) + (state === 'dragging' ? dragStroke * 0.035 * cfg.scale : 0);
  const forearmBase = lockedRightElbow.clone().addScaledVector(side, cfg.rightForearmOutward * t).addScaledVector(UP, -cfg.rightForearmDown * t).addScaledVector(UP, cfg.rightHandShotLift * t).addScaledVector(forward, -cfg.rightForearmBack * t).addScaledVector(cueDirForHand, cfg.rightForearmLength);
  const liveCueGripPoint = forearmBase.clone().addScaledVector(cueDirForHand, forearmStroke);
  const idleWristTarget = idleRight.clone().sub(cueSocketOffsetWorld(idleGripSide, idleGripUp, cueDirForHand, cfg.rightHandRollIdle, cfg));
  const liveWristTarget = liveCueGripPoint.clone().sub(cueSocketOffsetWorld(liveGripSide, liveGripUp, cueDirForHand, lerp(cfg.rightHandRollIdle, cfg.rightHandRollShoot - cfg.rightHandDownPose, handIk), cfg));
  const rightHand = idleWristTarget.clone().lerp(liveWristTarget, t);
  const leftElbow = leftShoulder.clone().lerp(leftHand, 0.62).addScaledVector(UP, 0.006 * cfg.scale * t).addScaledVector(side, -0.044 * cfg.scale * t).addScaledVector(forward, 0.065 * cfg.scale * t);
  const leftKnee = leftHip.clone().lerp(leftFoot, 0.53).addScaledVector(UP, lerp(0.2 * cfg.scale, cfg.kneeBendShot, t)).addScaledVector(forward, 0.04 * cfg.scale * t).addScaledVector(side, -0.012 * cfg.scale * t);
  const rightKnee = rightHip.clone().lerp(rightFoot, 0.52).addScaledVector(UP, lerp(0.2 * cfg.scale, cfg.kneeBendShot * 0.88, t)).addScaledVector(forward, -0.03 * cfg.scale * t).addScaledVector(side, 0.014 * cfg.scale * t);
  driveHuman(human, { t, stroke: forearmStroke / cfg.scale, follow: strikeFollow, walkAmount, forward, side, up: UP, rootWorld, torsoCenterWorld: torso, chestCenterWorld: chest, neckWorld: neck, headCenterWorld: head, leftElbow, rightElbow: lockedRightElbow, leftHandWorld: leftHand, rightHandWorld: rightHand, leftKnee, rightKnee, leftFootWorld: leftFoot, rightFootWorld: rightFoot, cueBackWorld: cueBack, cueTipWorld: cueTip });
  return { idleCue: cuePoseFromDemoGrip(idleRight, cfg.idleCueDir.clone().applyAxisAngle(Y_AXIS, human.yaw).normalize(), cfg.idleCueGripFromBack, cfg.cueLength), rootTarget, bridgeHandTarget: bridgePalmTarget };
}
