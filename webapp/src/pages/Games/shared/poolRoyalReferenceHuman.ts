// Character pose equations from the user-supplied PoolPreview (7 September 2026).
// Keep the original handedness, model yaw, joint targets and easing in reference space.
import * as THREE from 'three';

export type ShotState = "idle" | "dragging" | "striking";
type BoneKey =
  | "hips" | "spine" | "chest" | "neck" | "head"
  | "leftUpperArm" | "leftLowerArm" | "leftHand"
  | "rightUpperArm" | "rightLowerArm" | "rightHand"
  | "leftUpperLeg" | "leftLowerLeg" | "leftFoot"
  | "rightUpperLeg" | "rightLowerLeg" | "rightFoot";
type AvatarBones = Partial<Record<BoneKey, THREE.Bone>>;
type BallState = { mesh: THREE.Mesh; pos: THREE.Vector3; vel: THREE.Vector3; isCue: boolean; number: number; radius: number };
type CueRig = { group: THREE.Group; shaft: THREE.Mesh; ferrule: THREE.Mesh; tip: THREE.Mesh; externalModel?: THREE.Object3D | null };
export type HumanRig = {
  root: THREE.Group;
  modelRoot: THREE.Group;
  model: THREE.Object3D | null;
  bones: AvatarBones;
  leftFingers: THREE.Bone[];
  rightFingers: THREE.Bone[];
  restQuats: Map<THREE.Bone, THREE.Quaternion>;
  activeGlb: boolean;
  poseT: number;
  walkT: number;
  yaw: number;
  breathT: number;
  settleT: number;
  strikeRoot: THREE.Vector3;
  strikeYaw: number;
  strikeClock: number;
};
type HumanFrame = {
  t: number;
  stroke: number;
  follow: number;
  walkAmount: number;
  forward: THREE.Vector3;
  side: THREE.Vector3;
  up: THREE.Vector3;
  rootWorld: THREE.Vector3;
  torsoCenterWorld: THREE.Vector3;
  chestCenterWorld: THREE.Vector3;
  neckWorld: THREE.Vector3;
  headCenterWorld: THREE.Vector3;
  leftElbow: THREE.Vector3;
  rightElbow: THREE.Vector3;
  leftHandWorld: THREE.Vector3;
  rightHandWorld: THREE.Vector3;
  leftKnee: THREE.Vector3;
  rightKnee: THREE.Vector3;
  leftFootWorld: THREE.Vector3;
  rightFootWorld: THREE.Vector3;
  cueBackWorld: THREE.Vector3;
  cueTipWorld: THREE.Vector3;
  supportMode: "hand" | "mechanical-rest";
  supportDirection?: THREE.Vector3;
};


export const HUMAN_URL = "/assets/pool-royale/readyplayer.me.glb";

const WORLD_SCALE = 3.5;

export const CFG = {
  scale: WORLD_SCALE,
  tableTopY: 0.84 * WORLD_SCALE,
  tableW: 2.55 * WORLD_SCALE,
  tableL: 4.85 * WORLD_SCALE,
  tableVisualMultiplier: 1.18,
  topThickness: 0.09 * WORLD_SCALE,
  railW: 0.15 * WORLD_SCALE,
  railH: 0.08 * WORLD_SCALE,
  ballR: 0.045 * WORLD_SCALE,
  friction: 1.18,
  restitution: 0.92,
  minSpeed2: 0.00045 * WORLD_SCALE * WORLD_SCALE,
  idleGap: 0.012 * WORLD_SCALE,
  contactGap: 0.0012 * WORLD_SCALE,
  pullRange: 0.42 * WORLD_SCALE,
  strikeTime: 0.12,
  holdTime: 0.05,
  cueLength: 1.78 * WORLD_SCALE,
  bridgeDist: 0.28 * WORLD_SCALE,
  edgeMargin: 0.68 * WORLD_SCALE,
  desiredShootDistance: 1.25 * WORLD_SCALE,
  poseLambda: 9,
  moveLambda: 5.6,
  rotLambda: 8.5,
  humanScale: 1.18 * WORLD_SCALE,
  humanVisualYawFix: Math.PI,
  stanceWidth: 0.52 * WORLD_SCALE,
  bridgePalmTableLift: 0.006 * WORLD_SCALE,
  bridgeCueLift: 0.018 * WORLD_SCALE,
  bridgeHandBackFromBall: 0.235 * WORLD_SCALE,
  bridgeHandSide: -0.012 * WORLD_SCALE,
  chinToCueHeight: 0.11 * WORLD_SCALE,
  footGroundY: 0.035 * WORLD_SCALE,
  footLockStrength: 1.0,
  kneeBendShot: 0.16 * WORLD_SCALE,
  rightElbowShotRise: 0.18 * WORLD_SCALE,
  rightElbowShotSide: -0.46 * WORLD_SCALE,
  rightElbowShotBack: -0.78 * WORLD_SCALE,
  rightForearmOutward: 0.36 * WORLD_SCALE,
  rightForearmBack: 0.44 * WORLD_SCALE,
  rightForearmDown: 0.48 * WORLD_SCALE,
  rightForearmLength: 0.34 * WORLD_SCALE,
  rightStrokePull: 0.30 * WORLD_SCALE,
  rightStrokePush: 0.24 * WORLD_SCALE,
  rightHandShotLift: -0.30 * WORLD_SCALE,
  shootCueGripFromBack: 0.58 * WORLD_SCALE,
  idleRightHandY: 0.8 * WORLD_SCALE,
  idleRightHandX: 0.31 * WORLD_SCALE,
  idleRightHandZ: -0.015 * WORLD_SCALE,
  idleCueGripFromBack: 0.24 * WORLD_SCALE,
  idleCueDir: new THREE.Vector3(0.055, 0.965, -0.13),
  rightHandRollIdle: -2.2,
  rightHandRollShoot: -2.05,
  rightHandDownPose: 0.42,
  rightHandCueSocketLocal: new THREE.Vector3(-0.004, -0.014, 0.092).multiplyScalar(WORLD_SCALE),
};

const UP = new THREE.Vector3(0, 1, 0);
const Y_AXIS = UP;
const BASIS_MAT = new THREE.Matrix4();
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const clamp01 = (v: number) => clamp(v, 0, 1);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => t * t * (3 - 2 * t);
const dampScalar = (current: number, target: number, lambda: number, dt: number) => THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));
const dampVector = (current: THREE.Vector3, target: THREE.Vector3, lambda: number, dt: number) => current.lerp(target, 1 - Math.exp(-lambda * dt));
const yawFromForward = (forward: THREE.Vector3) => Math.atan2(-forward.x, -forward.z);
const cleanName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

function makeBasisQuaternion(side: THREE.Vector3, up: THREE.Vector3, forward: THREE.Vector3) {
  BASIS_MAT.makeBasis(side.clone().normalize(), up.clone().normalize(), forward.clone().normalize());
  return new THREE.Quaternion().setFromRotationMatrix(BASIS_MAT);
}

function createMaterial(color: number, roughness = 0.72, metalness = 0.03) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}
function enableShadow(obj: THREE.Object3D) {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
    }
  });
  return obj;
}
function createUnitCylinder(color: number) {
  return new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 18), createMaterial(color, 0.7, 0.03));
}
function setSegment(mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3, radius: number) {
  const dir = b.clone().sub(a);
  const len = Math.max(0.0001, dir.length());
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
  mesh.scale.set(radius, len, radius);
}
export function createCue(): CueRig {
  const group = new THREE.Group();
  const shaft = createUnitCylinder(0xd9b88d);
  const ferrule = createUnitCylinder(0xf8fafc);
  const tip = createUnitCylinder(0x2563eb);
  group.add(enableShadow(shaft), enableShadow(ferrule), enableShadow(tip));
  return { group, shaft, ferrule, tip, externalModel: null };
}
export function setCuePose(cue: CueRig, back: THREE.Vector3, tip: THREE.Vector3) {
  const dir = tip.clone().sub(back).normalize();
  const tipBack = tip.clone().addScaledVector(dir, -0.02 * CFG.scale);
  const ferruleBack = tipBack.clone().addScaledVector(dir, -0.03 * CFG.scale);
  setSegment(cue.shaft, back, ferruleBack, 0.012 * CFG.scale);
  setSegment(cue.ferrule, ferruleBack, tipBack, 0.0105 * CFG.scale);
  setSegment(cue.tip, tipBack, tip, 0.009 * CFG.scale);
  if (cue.externalModel) {
    const mid = back.clone().lerp(tip, 0.5);
    cue.externalModel.position.copy(mid);
    cue.externalModel.quaternion.setFromUnitVectors(UP, dir);
    cue.externalModel.scale.setScalar(CFG.cueLength / Math.max(0.001, cue.externalModel.userData.originalLength || CFG.cueLength));
  }
}
export function cuePoseFromGrip(grip: THREE.Vector3, dir: THREE.Vector3, gripFromBack: number, length = CFG.cueLength) {
  const n = dir.clone().normalize();
  return { back: grip.clone().addScaledVector(n, -gripFromBack), tip: grip.clone().addScaledVector(n, length - gripFromBack) };
}

function findBone(all: THREE.Bone[], aliases: string[]) {
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
function buildAvatarBones(model: THREE.Object3D): AvatarBones {
  const all: THREE.Bone[] = [];
  model.traverse((obj) => {
    const bone = obj as THREE.Bone;
    if (bone.isBone) all.push(bone);
  });
  const f = (...names: string[]) => findBone(all, names);
  return {
    hips: f("hips", "pelvis", "mixamorigHips"), spine: f("spine", "spine01", "mixamorigSpine"), chest: f("spine2", "chest", "upperchest", "mixamorigSpine2", "mixamorigSpine1"), neck: f("neck", "mixamorigNeck"), head: f("head", "mixamorigHead"),
    leftUpperArm: f("leftupperarm", "leftarm", "upperarml", "mixamorigLeftArm"), leftLowerArm: f("leftforearm", "leftlowerarm", "forearml", "mixamorigLeftForeArm"), leftHand: f("lefthand", "handl", "mixamorigLeftHand"),
    rightUpperArm: f("rightupperarm", "rightarm", "upperarmr", "mixamorigRightArm"), rightLowerArm: f("rightforearm", "rightlowerarm", "forearmr", "mixamorigRightForeArm"), rightHand: f("righthand", "handr", "mixamorigRightHand"),
    leftUpperLeg: f("leftupleg", "leftupperleg", "leftthigh", "mixamorigLeftUpLeg"), leftLowerLeg: f("leftleg", "leftlowerleg", "leftcalf", "mixamorigLeftLeg"), leftFoot: f("leftfoot", "footl", "mixamorigLeftFoot"),
    rightUpperLeg: f("rightupleg", "rightupperleg", "rightthigh", "mixamorigRightUpLeg"), rightLowerLeg: f("rightleg", "rightlowerleg", "rightcalf", "mixamorigRightLeg"), rightFoot: f("rightfoot", "footr", "mixamorigRightFoot"),
  };
}
function collectFingerBones(hand?: THREE.Bone) {
  const out: THREE.Bone[] = [];
  hand?.traverse((obj) => {
    const bone = obj as THREE.Bone;
    if (!bone.isBone || bone === hand) return;
    const n = cleanName(bone.name);
    if (["thumb", "index", "middle", "ring", "pinky", "little", "finger"].some((s) => n.includes(s))) out.push(bone);
  });
  return out;
}
function normalizeHuman(model: THREE.Object3D) {
  model.scale.setScalar(CFG.humanScale);
  model.rotation.set(0, CFG.humanVisualYawFix, 0);
  model.position.set(0, 0, 0);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -box.min.y, -center.z);
}

function setBoneWorldQuaternion(bone?: THREE.Bone, q?: THREE.Quaternion) {
  if (!bone || !q) return;
  const parentQ = new THREE.Quaternion();
  bone.parent?.getWorldQuaternion(parentQ);
  bone.quaternion.copy(parentQ.invert().multiply(q));
  bone.updateMatrixWorld(true);
}
function firstBoneChild(bone?: THREE.Bone) {
  return bone?.children.find((child) => (child as THREE.Bone).isBone) as THREE.Bone | undefined;
}
function rotateBoneToward(bone: THREE.Bone | undefined, target: THREE.Vector3, strength = 1, fallbackDir = UP) {
  if (!bone || strength <= 0) return;
  const bonePos = bone.getWorldPosition(new THREE.Vector3());
  const childPos = firstBoneChild(bone)?.getWorldPosition(new THREE.Vector3()) || bonePos.clone().addScaledVector(fallbackDir.clone().normalize(), 0.25 * CFG.scale);
  const current = childPos.sub(bonePos).normalize();
  const desired = target.clone().sub(bonePos);
  if (desired.lengthSq() < 1e-6 || current.lengthSq() < 1e-6) return;
  const delta = new THREE.Quaternion().slerpQuaternions(new THREE.Quaternion(), new THREE.Quaternion().setFromUnitVectors(current, desired.normalize()), clamp01(strength));
  setBoneWorldQuaternion(bone, delta.multiply(bone.getWorldQuaternion(new THREE.Quaternion())));
}
function twistBone(bone: THREE.Bone | undefined, axis: THREE.Vector3, amount: number) {
  if (!bone || Math.abs(amount) < 1e-5) return;
  setBoneWorldQuaternion(bone, new THREE.Quaternion().setFromAxisAngle(axis.clone().normalize(), amount).multiply(bone.getWorldQuaternion(new THREE.Quaternion())));
}
function aimTwoBone(upper: THREE.Bone | undefined, lower: THREE.Bone | undefined, elbow: THREE.Vector3, hand: THREE.Vector3, pole: THREE.Vector3, upperStrength = 0.96, lowerStrength = 0.98) {
  for (let i = 0; i < 4; i++) {
    rotateBoneToward(upper, elbow, upperStrength, pole);
    rotateBoneToward(lower, hand, lowerStrength, pole);
  }
}
function setHandBasis(bone: THREE.Bone | undefined, side: THREE.Vector3, up: THREE.Vector3, forward: THREE.Vector3, roll = 0, strength = 1) {
  if (!bone || strength <= 0) return;
  const q = makeBasisQuaternion(side, up, forward);
  if (Math.abs(roll) > 1e-4) q.multiply(new THREE.Quaternion().setFromAxisAngle(forward.clone().normalize(), roll));
  setBoneWorldQuaternion(bone, bone.getWorldQuaternion(new THREE.Quaternion()).slerp(q, clamp01(strength)));
}
function cueSocketOffsetWorld(side: THREE.Vector3, up: THREE.Vector3, forward: THREE.Vector3, roll: number, socketLocal = CFG.rightHandCueSocketLocal) {
  const q = makeBasisQuaternion(side, up, forward);
  if (Math.abs(roll) > 1e-5) q.multiply(new THREE.Quaternion().setFromAxisAngle(forward.clone().normalize(), roll));
  return socketLocal.clone().applyQuaternion(q);
}
function poseFingers(fingers: THREE.Bone[], mode: "idle" | "bridge" | "grip", weight: number) {
  const w = clamp01(weight);
  fingers.forEach((finger, i) => {
    const n = cleanName(finger.name);
    const thumb = n.includes("thumb"), index = n.includes("index"), middle = n.includes("middle"), ring = n.includes("ring"), pinky = n.includes("pinky") || n.includes("little");
    const base = !(n.includes("2") || n.includes("3") || n.includes("intermediate") || n.includes("distal"));
    const mid = n.includes("2") || n.includes("intermediate");
    const tip = n.includes("3") || n.includes("distal");
    if (mode === "idle") { finger.rotation.x += 0.018 * w; finger.rotation.z += 0.01 * w * (i % 2 ? -1 : 1); return; }
    if (mode === "grip") {
      if (thumb) { finger.rotation.x += 0.48 * w; finger.rotation.y += -0.82 * w; finger.rotation.z += 0.54 * w; return; }
      const curl = index ? (base ? 0.58 : mid ? 0.9 : 0.68) : middle ? (base ? 0.76 : mid ? 1.02 : 0.76) : ring ? (base ? 0.72 : mid ? 0.92 : 0.7) : pinky ? (base ? 0.62 : mid ? 0.82 : 0.62) : 0;
      finger.rotation.x += curl * w;
      finger.rotation.y += (index ? -0.12 : middle ? -0.03 : ring ? 0.04 : pinky ? 0.08 : 0) * w;
      finger.rotation.z += (index ? -0.08 : middle ? -0.02 : ring ? 0.06 : pinky ? 0.12 : 0) * w;
      return;
    }
    if (thumb) { finger.rotation.x += -0.18 * w; finger.rotation.y += 0.95 * w; finger.rotation.z += -0.95 * w; }
    else if (index) { finger.rotation.x += (base ? 0.26 : mid ? 0.42 : 0.28) * w; finger.rotation.y += -0.46 * w; finger.rotation.z += -0.42 * w; }
    else if (middle) { finger.rotation.x += (base ? 0.18 : mid ? 0.32 : 0.22) * w; finger.rotation.y += -0.12 * w; finger.rotation.z += -0.14 * w; }
    else if (ring || pinky) { finger.rotation.x += (base ? (ring ? 0.08 : 0.05) : mid ? (ring ? 0.18 : 0.16) : tip ? (ring ? 0.12 : 0.1) : 0.1) * w; finger.rotation.y += (ring ? 0.18 : 0.34) * w; finger.rotation.z += (ring ? 0.28 : 0.46) * w; }
  });
}
function driveHuman(human: HumanRig, frame: HumanFrame) {
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
  const standingCueDir = CFG.idleCueDir.clone().applyAxisAngle(Y_AXIS, human.yaw).normalize();
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
  const rightIdleElbow = rightGrip.clone().addScaledVector(UP, 0.04 * CFG.scale + 0.14 * CFG.scale * ik).addScaledVector(frame.side, -0.2 * CFG.scale).addScaledVector(frame.forward, -0.03 * CFG.scale * idle);
  const rightElbow = frame.rightElbow.clone().lerp(rightIdleElbow, idle * 0.5);
  const pole = frame.side.clone().multiplyScalar(-1).addScaledVector(UP, 0.32).addScaledVector(frame.forward, -0.55).normalize();
  aimTwoBone(b.rightUpperArm, b.rightLowerArm, rightElbow, rightGrip, pole, 0.9 + 0.1 * ik, 1.0);
  const standingHandSide = frame.side.clone().multiplyScalar(-1).addScaledVector(UP, -0.55).addScaledVector(frame.forward, 0.16).normalize();
  const standingHandUp = UP.clone().multiplyScalar(-1.0).addScaledVector(frame.side, -0.64).addScaledVector(frame.forward, 0.2).normalize();
  const handForwardForOrientation = ik >= 0.025 ? standingCueDir : cueDir;
  const rollForOrientation = ik >= 0.025 ? CFG.rightHandRollIdle : CFG.rightHandRollIdle + 0.02 * frame.stroke;
  setHandBasis(b.rightHand, standingHandSide, standingHandUp, handForwardForOrientation, rollForOrientation, 1.0);
  poseFingers(human.rightFingers, "grip", 0.95);
  if (ik < 0.025) { poseFingers(human.leftFingers, "idle", 1); return; }
  const leftHand = frame.leftHandWorld.clone().addScaledVector(frame.forward, 0.032 * CFG.scale * ik).addScaledVector(frame.side, -0.018 * CFG.scale * ik).addScaledVector(UP, -0.018 * CFG.scale * ik);
  const leftElbow = frame.leftElbow.clone().addScaledVector(frame.forward, 0.045 * CFG.scale * ik).addScaledVector(frame.side, -0.05 * CFG.scale * ik).addScaledVector(UP, -0.01 * CFG.scale * ik);
  aimTwoBone(b.leftUpperArm, b.leftLowerArm, leftElbow, leftHand, frame.side.clone().multiplyScalar(-1).addScaledVector(UP, 0.1).normalize(), 0.98 * ik, 1.0 * ik);
  twistBone(b.leftUpperArm, frame.forward, -0.2 * ik);
  twistBone(b.leftLowerArm, frame.forward, 0.025 * ik);
  if (frame.supportMode === "mechanical-rest") {
    const restUp = frame.supportDirection?.clone().normalize() ?? frame.forward.clone();
    const restForward = new THREE.Vector3().crossVectors(frame.side, restUp).normalize();
    setHandBasis(b.leftHand, frame.side, restUp, restForward, -0.28 * ik, 1.0 * ik);
    poseFingers(human.leftFingers, "grip", 0.94 * ik);
  } else {
    const bridgeSide = frame.side.clone().multiplyScalar(-1).addScaledVector(frame.forward, -0.52).normalize();
    const bridgeUp = UP.clone().multiplyScalar(0.78).addScaledVector(frame.forward, -0.28).addScaledVector(frame.side, -0.16).normalize();
    setHandBasis(b.leftHand, bridgeSide, bridgeUp, cueDir, -0.68 * ik, 1.0 * ik);
    poseFingers(human.leftFingers, "bridge", ik);
  }
  aimTwoBone(b.leftUpperLeg, b.leftLowerLeg, frame.leftKnee, frame.leftFootWorld, frame.forward.clone().addScaledVector(UP, 0.18).normalize(), 0.9 * ik, 1.0 * ik);
  twistBone(b.leftUpperLeg, frame.forward, -0.035 * ik);
  setHandBasis(b.leftFoot, frame.side, frame.up, frame.forward, -0.02 * ik, CFG.footLockStrength * ik);
  aimTwoBone(b.rightUpperLeg, b.rightLowerLeg, frame.rightKnee, frame.rightFootWorld, frame.forward.clone().multiplyScalar(-1).addScaledVector(UP, 0.18).normalize(), 0.9 * ik, 1.0 * ik);
  twistBone(b.rightUpperLeg, frame.forward, 0.03 * ik);
  setHandBasis(b.rightFoot, frame.side, frame.up, frame.forward, 0.02 * ik, CFG.footLockStrength * ik);
}
export function updateHumanPose(human: HumanRig, dt: number, state: ShotState, rootTarget: THREE.Vector3, aimForward: THREE.Vector3, bridgeTarget: THREE.Vector3, idleRight: THREE.Vector3, idleLeft: THREE.Vector3, cueBack: THREE.Vector3, cueTip: THREE.Vector3, power: number, clothY = CFG.tableTopY, supportMode: "hand" | "mechanical-rest" = "hand", supportDirection?: THREE.Vector3, rearGripOffset = 0) {
  human.poseT = dampScalar(human.poseT, state === "idle" ? 0 : 1, CFG.poseLambda, dt);
  human.breathT += dt * (state === "idle" ? 1.05 : 0.5);
  human.settleT = dampScalar(human.settleT, state === "dragging" ? 1 : 0, 5.5, dt);
  if (state === "striking") {
    if (human.strikeClock === 0) { human.strikeRoot.copy(human.root.position.lengthSq() > 0.001 ? human.root.position : rootTarget); human.strikeYaw = human.yaw; }
    human.strikeClock += dt;
  } else human.strikeClock = 0;
  const rootGoal = state === "striking" ? human.strikeRoot : rootTarget;
  dampVector(human.root.position, rootGoal, state === "striking" ? 12 : CFG.moveLambda, dt);
  const moveAmountRaw = human.root.position.distanceTo(rootGoal);
  human.walkT += dt * (2 + Math.min(7, moveAmountRaw * 10 / CFG.scale));
  human.yaw = dampScalar(human.yaw, state === "striking" ? human.strikeYaw : yawFromForward(aimForward), CFG.rotLambda, dt);
  const t = easeInOut(human.poseT), idle = 1 - t;
  const breath = Math.sin(human.breathT * Math.PI * 2) * ((0.006 + idle * 0.004) * CFG.scale);
  const walk = Math.sin(human.walkT * 6.2) * Math.min(1, moveAmountRaw * 12 / CFG.scale);
  const walkAmount = clamp01(moveAmountRaw * 18 / CFG.scale) * idle;
  const dragStroke = state === "dragging" ? Math.sin(performance.now() * 0.011) * (0.25 + power * 0.75) : 0;
  const strikeFollow = state === "striking" ? Math.sin(clamp01(human.strikeClock / (CFG.strikeTime + CFG.holdTime)) * Math.PI) : 0;
  const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(Y_AXIS, human.yaw).normalize();
  const side = new THREE.Vector3(forward.z, 0, -forward.x).normalize();
  const local = (v: THREE.Vector3) => v.clone().applyAxisAngle(Y_AXIS, human.yaw).add(human.root.position);
  const powerLean = power * t;
  const rootWorld = human.root.position.clone().addScaledVector(forward, (0.018 * powerLean + 0.026 * strikeFollow) * CFG.scale);
  rootWorld.y = 0;
  const torso = local(new THREE.Vector3(0, lerp(1.3, 1.14, t) * CFG.scale + breath, (lerp(0.02, -0.16, t) - 0.014 * powerLean) * CFG.scale));
  const chest = local(new THREE.Vector3(0, lerp(1.52, 1.24, t) * CFG.scale + breath, (lerp(0.02, -0.42, t) - 0.024 * powerLean) * CFG.scale));
  const neck = local(new THREE.Vector3(0, lerp(1.68, 1.28, t) * CFG.scale + breath, (lerp(0.02, -0.61, t) - 0.028 * powerLean) * CFG.scale));
  const head = local(new THREE.Vector3(0, lerp(1.84, 1.37, t) * CFG.scale + breath - CFG.chinToCueHeight * 0.16 * t, (lerp(0.04, -0.72, t) - 0.028 * powerLean) * CFG.scale));
  const leftShoulder = local(new THREE.Vector3(-0.23 * CFG.scale, lerp(1.58, 1.36, t) * CFG.scale + breath, (lerp(0, -0.46, t) - 0.018 * human.settleT) * CFG.scale));
  const rightShoulder = local(new THREE.Vector3(0.23 * CFG.scale, lerp(1.58, 1.36, t) * CFG.scale + breath, (lerp(0, -0.34, t) - 0.018 * human.settleT) * CFG.scale));
  const leftHip = local(new THREE.Vector3(-0.13 * CFG.scale, 0.92 * CFG.scale, 0.02 * CFG.scale));
  const rightHip = local(new THREE.Vector3(0.13 * CFG.scale, 0.92 * CFG.scale, 0.02 * CFG.scale));
  const leftFoot = local(new THREE.Vector3(-0.13 * CFG.scale, CFG.footGroundY, 0.03 * CFG.scale + walk * 0.018 * CFG.scale).lerp(new THREE.Vector3(-CFG.stanceWidth * 0.42, CFG.footGroundY, -0.34 * CFG.scale), t));
  const rightFoot = local(new THREE.Vector3(0.13 * CFG.scale, CFG.footGroundY, -0.03 * CFG.scale - walk * 0.018 * CFG.scale).lerp(new THREE.Vector3(CFG.stanceWidth * 0.5, CFG.footGroundY, 0.34 * CFG.scale), t));
  const bridgePalmTarget = bridgeTarget.clone().addScaledVector(forward, -0.006 * CFG.scale * t).addScaledVector(side, -0.012 * CFG.scale * t);
  if (supportMode === "hand") bridgePalmTarget.setY(clothY + CFG.bridgePalmTableLift).addScaledVector(UP, -0.01 * CFG.scale * human.settleT);
  const leftHand = idleLeft.clone().lerp(bridgePalmTarget, t);
  const cueDirForHand = cueTip.clone().sub(cueBack).normalize();
  const handIk = easeInOut(clamp01(t));
  const idleGripSide = side.clone().multiplyScalar(-1).addScaledVector(UP, -0.55).addScaledVector(forward, 0.16).normalize();
  const idleGripUp = UP.clone().multiplyScalar(-1.0).addScaledVector(side, -0.64).addScaledVector(forward, 0.2).normalize();
  const liveGripSide = side.clone().multiplyScalar(-1).addScaledVector(UP, lerp(-0.55, -0.62, handIk)).addScaledVector(side, 0.5 * handIk).addScaledVector(forward, lerp(0.16, -0.08, handIk)).normalize();
  const liveGripUp = UP.clone().multiplyScalar(lerp(-1.0, 0.12, handIk)).addScaledVector(side, lerp(-0.64, -0.04, handIk)).addScaledVector(forward, lerp(0.2, -0.48, handIk)).normalize();
  const lockedRightElbow = rightShoulder.clone().addScaledVector(UP, lerp(0.04 * CFG.scale, CFG.rightElbowShotRise, t)).addScaledVector(side, lerp(-0.18 * CFG.scale, CFG.rightElbowShotSide, t)).addScaledVector(forward, lerp(-0.04 * CFG.scale, CFG.rightElbowShotBack, t));
  const pullBack = state === "dragging" ? -CFG.rightStrokePull * easeOutCubic(power) : 0;
  const pushForward = state === "striking" ? CFG.rightStrokePush * strikeFollow : 0;
  const smallPractice = state === "dragging" ? dragStroke * 0.035 * CFG.scale : 0;
  const forearmStroke = pullBack + pushForward + smallPractice;
  const forearmBase = lockedRightElbow.clone().addScaledVector(side, CFG.rightForearmOutward * t).addScaledVector(UP, -CFG.rightForearmDown * t).addScaledVector(UP, CFG.rightHandShotLift * t).addScaledVector(forward, -CFG.rightForearmBack * t).addScaledVector(cueDirForHand, CFG.rightForearmLength);
  const liveCueGripPoint = forearmBase.clone()
    .addScaledVector(cueDirForHand, forearmStroke - Math.max(0, rearGripOffset) * t);
  const idleWristTarget = idleRight.clone().sub(cueSocketOffsetWorld(idleGripSide, idleGripUp, cueDirForHand, CFG.rightHandRollIdle));
  const liveWristTarget = liveCueGripPoint.clone().sub(cueSocketOffsetWorld(liveGripSide, liveGripUp, cueDirForHand, lerp(CFG.rightHandRollIdle, CFG.rightHandRollShoot - CFG.rightHandDownPose, handIk)));
  const rightHand = idleWristTarget.clone().lerp(liveWristTarget, t);
  const leftElbow = leftShoulder.clone().lerp(leftHand, 0.62).addScaledVector(UP, 0.006 * CFG.scale * t).addScaledVector(side, -0.044 * CFG.scale * t).addScaledVector(forward, 0.065 * CFG.scale * t);
  const leftKnee = leftHip.clone().lerp(leftFoot, 0.53).addScaledVector(UP, lerp(0.2 * CFG.scale, CFG.kneeBendShot, t)).addScaledVector(forward, 0.04 * CFG.scale * t).addScaledVector(side, -0.012 * CFG.scale * t);
  const rightKnee = rightHip.clone().lerp(rightFoot, 0.52).addScaledVector(UP, lerp(0.2 * CFG.scale, CFG.kneeBendShot * 0.88, t)).addScaledVector(forward, -0.03 * CFG.scale * t).addScaledVector(side, 0.014 * CFG.scale * t);
  driveHuman(human, { t, stroke: forearmStroke / CFG.scale, follow: strikeFollow, walkAmount, forward, side, up: UP, rootWorld, torsoCenterWorld: torso, chestCenterWorld: chest, neckWorld: neck, headCenterWorld: head, leftElbow, rightElbow: lockedRightElbow, leftHandWorld: leftHand, rightHandWorld: rightHand, leftKnee, rightKnee, leftFootWorld: leftFoot, rightFootWorld: rightFoot, cueBackWorld: cueBack, cueTipWorld: cueTip, supportMode, supportDirection });
}

export function chooseHumanEdgePosition(cueBallWorld: THREE.Vector3, aimForward: THREE.Vector3, tableW = CFG.tableW, tableL = CFG.tableL) {
  const desired = cueBallWorld.clone().addScaledVector(aimForward, -CFG.desiredShootDistance);
  const xEdge = tableW / 2 + CFG.edgeMargin;
  const zEdge = tableL / 2 + CFG.edgeMargin;
  const candidates = [
    new THREE.Vector3(-xEdge, 0, clamp(desired.z, -zEdge, zEdge)),
    new THREE.Vector3(xEdge, 0, clamp(desired.z, -zEdge, zEdge)),
    new THREE.Vector3(clamp(desired.x, -xEdge, xEdge), 0, -zEdge),
    new THREE.Vector3(clamp(desired.x, xEdge * -1, xEdge), 0, zEdge),
  ];
  return candidates.sort((a, b) => a.distanceToSquared(desired) - b.distanceToSquared(desired))[0].clone();
}


/** Attach an independently cloned skeleton without changing its bind pose or materials. */
export function createReferenceHuman(model: THREE.Object3D): HumanRig {
  const human: HumanRig = {
    root: new THREE.Group(), modelRoot: new THREE.Group(), model,
    bones: {}, leftFingers: [], rightFingers: [], restQuats: new Map(),
    activeGlb: false, poseT: 0, walkT: 0, yaw: 0, breathT: 0, settleT: 0,
    strikeRoot: new THREE.Vector3(), strikeYaw: 0, strikeClock: 0
  };
  human.root.visible = false;
  normalizeHuman(model);
  enableShadow(model);
  human.bones = buildAvatarBones(model);
  human.leftFingers = collectFingerBones(human.bones.leftHand);
  human.rightFingers = collectFingerBones(human.bones.rightHand);
  [...Object.values(human.bones), ...human.leftFingers, ...human.rightFingers]
    .forEach(bone => bone && human.restQuats.set(bone, bone.quaternion.clone()));
  // Both arms are required: an incomplete bridge arm must not silently become a player.
  human.activeGlb = Object.values(human.bones).length === 17 &&
    Object.values(human.bones).every(Boolean);
  human.modelRoot.add(model);
  human.modelRoot.visible = human.activeGlb;
  return human;
}
