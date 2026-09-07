// Serve, forehand and backhand timing/poses restored from LegacyGame.tsx.
// The original torso, wrist and two-arm IK curves now use the metre-based table.
import * as THREE from 'three';
import {
  clamp,
  side,
  TABLE_HEIGHT,
  type MatchState,
  type Seat
} from './engine';
const CFG = { tableY: TABLE_HEIGHT };
const clamp01 = (v: number) => clamp(v, 0, 1);
const lerp = THREE.MathUtils.lerp;
const easeOutCubic = (v: number) => 1 - Math.pow(1 - clamp01(v), 3);
const getWorldPos = (o: THREE.Object3D) =>
  o.getWorldPosition(new THREE.Vector3());
type PosePlayer = {
  pos: THREE.Vector3;
  yaw: number;
  side: Seat;
  action: string;
  swingT: number;
};
type PoseBall = {
  pos: THREE.Vector3;
  lastHitBy: Seat | null;
  phase: { kind: string; server: Seat };
};
function baseVectors(player: PosePlayer) {
  const forward = new THREE.Vector3(
    Math.sin(player.yaw),
    0,
    Math.cos(player.yaw)
  );
  return { forward, right: new THREE.Vector3(forward.z, 0, -forward.x) };
}
function servePalmPosition(player: PosePlayer) {
  const { forward, right } = baseVectors(player);
  return player.pos
    .clone()
    .addScaledVector(right, -0.18)
    .addScaledVector(forward, 0.18)
    .setY(TABLE_HEIGHT + 0.28);
}
function serveContactPosition(player: PosePlayer) {
  const { forward, right } = baseVectors(player);
  return player.pos
    .clone()
    .addScaledVector(right, 0.08)
    .addScaledVector(forward, 0.27)
    .setY(TABLE_HEIGHT + 0.31);
}
type BonePack = {
  spine?: THREE.Bone;
  chest?: THREE.Bone;
  neck?: THREE.Bone;
  rightShoulder?: THREE.Bone;
  rightUpperArm?: THREE.Bone;
  rightForeArm?: THREE.Bone;
  rightHand?: THREE.Bone;
  leftShoulder?: THREE.Bone;
  leftUpperArm?: THREE.Bone;
  leftForeArm?: THREE.Bone;
  leftHand?: THREE.Bone;
};

type BoneRest = { bone: THREE.Bone; q: THREE.Quaternion };

type ArmChain = {
  shoulder?: THREE.Bone;
  upper: THREE.Bone;
  fore: THREE.Bone;
  hand: THREE.Bone;
  upperLen: number;
  foreLen: number;
};

type StrokePose = {
  rightShoulder: THREE.Vector3;
  rightElbow: THREE.Vector3;
  rightHand: THREE.Vector3;
  leftShoulder: THREE.Vector3;
  leftElbow: THREE.Vector3;
  leftHand: THREE.Vector3;
  paddleGrip: THREE.Vector3;
  paddleCenter: THREE.Vector3;
  faceNormal: THREE.Vector3;
  torsoYaw: number;
  torsoLean: number;
  shoulderLift: number;
  wristPronation: number;
  crouch: number;
};

function findFirstBone(root: THREE.Object3D, tests: string[]) {
  const candidates: { bone: THREE.Bone; name: string }[] = [];
  root.traverse((o) => {
    const b = o as THREE.Bone;
    if (!b.isBone) return;
    candidates.push({
      bone: b,
      name: b.name.toLowerCase().replace(/[_.\-\s]/g, '')
    });
  });
  // Match whole names or namespaced suffixes. "rarm" occurs inside both
  // "upperarm_l" and "upperarm_r" and must never select the opposite arm.
  for (const name of tests) {
    const match = candidates.find(
      (c) => c.name === name || c.name.endsWith(name)
    );
    if (match) return match.bone;
  }
  return undefined;
}

export function findHumanBones(model: THREE.Object3D): BonePack {
  return {
    spine: findFirstBone(model, ['spine', 'spine01', 'spine1']),
    chest: findFirstBone(model, [
      'chest',
      'spine2',
      'spine02',
      'spine03',
      'upperchest'
    ]),
    neck: findFirstBone(model, ['neck', 'neck01', 'neck1']),
    rightShoulder: findFirstBone(model, [
      'rightshoulder',
      'rshoulder',
      'clavicler'
    ]),
    rightUpperArm: findFirstBone(model, [
      'rightarm',
      'rightupperarm',
      'rarm',
      'rupperarm',
      'upperarmr'
    ]),
    rightForeArm: findFirstBone(model, [
      'rightforearm',
      'rightlowerarm',
      'rforearm',
      'rlowerarm',
      'lowerarmr'
    ]),
    rightHand: findFirstBone(model, ['righthand', 'rhand', 'handr']),
    leftShoulder: findFirstBone(model, [
      'leftshoulder',
      'lshoulder',
      'claviclel'
    ]),
    leftUpperArm: findFirstBone(model, [
      'leftarm',
      'leftupperarm',
      'larm',
      'lupperarm',
      'upperarml'
    ]),
    leftForeArm: findFirstBone(model, [
      'leftforearm',
      'leftlowerarm',
      'lforearm',
      'llowerarm',
      'lowerarml'
    ]),
    leftHand: findFirstBone(model, ['lefthand', 'lhand', 'handl'])
  };
}

export function captureRestPose(bones: BonePack) {
  const out: BoneRest[] = [];
  Object.values(bones).forEach((bone) => {
    if (bone && !out.some((r) => r.bone === bone))
      out.push({ bone, q: bone.quaternion.clone() });
  });
  return out;
}

export function makeArmChain(
  shoulder: THREE.Bone | undefined,
  upper: THREE.Bone | undefined,
  fore: THREE.Bone | undefined,
  hand: THREE.Bone | undefined
): ArmChain | undefined {
  if (!upper || !fore || !hand) return undefined;
  upper.updateMatrixWorld(true);
  fore.updateMatrixWorld(true);
  hand.updateMatrixWorld(true);
  const a = getWorldPos(upper);
  const b = getWorldPos(fore);
  const c = getWorldPos(hand);
  return {
    shoulder,
    upper,
    fore,
    hand,
    upperLen: Math.max(0.05, a.distanceTo(b)),
    foreLen: Math.max(0.05, b.distanceTo(c))
  };
}

function setBoneWorldQuaternion(bone: THREE.Bone, worldQ: THREE.Quaternion) {
  const parentWorldQ = new THREE.Quaternion();
  if (bone.parent) bone.parent.getWorldQuaternion(parentWorldQ);
  bone.quaternion.copy(parentWorldQ.invert().multiply(worldQ));
}

function rotateBoneSoChildPointsTo(
  bone: THREE.Bone,
  child: THREE.Object3D,
  targetDirWorld: THREE.Vector3
) {
  bone.updateMatrixWorld(true);
  child.updateMatrixWorld(true);
  const bonePos = getWorldPos(bone);
  const childPos = getWorldPos(child);
  const currentDir = childPos.sub(bonePos).normalize();
  const desiredDir = targetDirWorld.clone().normalize();
  if (currentDir.lengthSq() < 1e-8 || desiredDir.lengthSq() < 1e-8) return;
  const delta = new THREE.Quaternion().setFromUnitVectors(
    currentDir,
    desiredDir
  );
  const currentWorldQ = bone.getWorldQuaternion(new THREE.Quaternion());
  setBoneWorldQuaternion(bone, delta.multiply(currentWorldQ));
}

function solveTwoBoneArm(
  chain: ArmChain | undefined,
  elbowHint: THREE.Vector3,
  handTarget: THREE.Vector3
) {
  if (!chain) return false;
  const { upper, fore, hand, upperLen, foreLen } = chain;
  upper.updateMatrixWorld(true);
  fore.updateMatrixWorld(true);
  hand.updateMatrixWorld(true);

  const rootPos = getWorldPos(upper);
  const toTarget = handTarget.clone().sub(rootPos);
  const distRaw = Math.max(0.0001, toTarget.length());
  const dist = clamp(distRaw, 0.001, upperLen + foreLen - 0.001);
  const dir = toTarget.normalize();

  const hintDir = elbowHint.clone().sub(rootPos);
  let normal = new THREE.Vector3().crossVectors(dir, hintDir).normalize();
  if (normal.lengthSq() < 1e-8) {
    normal = new THREE.Vector3(0, 1, 0).cross(dir);
    if (normal.lengthSq() < 1e-8) normal = new THREE.Vector3(1, 0, 0);
    normal.normalize();
  }
  const bendAxis = new THREE.Vector3().crossVectors(normal, dir).normalize();
  const a =
    (upperLen * upperLen - foreLen * foreLen + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, upperLen * upperLen - a * a));
  const mid = rootPos.clone().addScaledVector(dir, a);
  const elbowA = mid.clone().addScaledVector(bendAxis, h);
  const elbowB = mid.clone().addScaledVector(bendAxis, -h);
  const elbow =
    elbowA.distanceToSquared(elbowHint) < elbowB.distanceToSquared(elbowHint)
      ? elbowA
      : elbowB;

  // Keep each model's anatomical shoulder position. The legacy hand paths are
  // in metres; forcing its clavicle onto a synthetic shoulder distorts the mesh.
  upper.updateMatrixWorld(true);
  rotateBoneSoChildPointsTo(
    upper,
    fore,
    elbow.clone().sub(getWorldPos(upper)).normalize()
  );
  fore.updateMatrixWorld(true);
  rotateBoneSoChildPointsTo(
    fore,
    hand,
    handTarget.clone().sub(getWorldPos(fore)).normalize()
  );
  hand.updateMatrixWorld(true);
  return true;
}

function addLocalRotation(
  bone: THREE.Bone | undefined,
  x: number,
  y: number,
  z: number
) {
  if (!bone) return;
  bone.quaternion.multiply(
    new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'XYZ'))
  );
}

function tableTennisPose(player: PosePlayer, ball: PoseBall): StrokePose {
  const { forward, right } = baseVectors(player);
  const tRaw = player.swingT > 0 ? clamp01(player.swingT) : 0;
  const action = player.action;
  const base = player.pos.clone();

  const crouch = action === 'ready' ? 0.1 : 0.06;
  const shoulderY = 1.34 - crouch;
  const rightShoulder = base
    .clone()
    .addScaledVector(right, 0.26)
    .addScaledVector(forward, -0.005)
    .setY(shoulderY);
  const leftShoulder = base
    .clone()
    .addScaledVector(right, -0.26)
    .addScaledVector(forward, -0.005)
    .setY(shoulderY);

  let rightElbow = rightShoulder
    .clone()
    .addScaledVector(right, 0.17)
    .addScaledVector(forward, 0.08)
    .setY(CFG.tableY + 0.34);
  let rightHand = rightShoulder
    .clone()
    .addScaledVector(right, 0.32)
    .addScaledVector(forward, 0.23)
    .setY(CFG.tableY + 0.18);
  let leftElbow = leftShoulder
    .clone()
    .addScaledVector(right, -0.18)
    .addScaledVector(forward, 0.07)
    .setY(CFG.tableY + 0.34);
  let leftHand = leftShoulder
    .clone()
    .addScaledVector(right, -0.28)
    .addScaledVector(forward, 0.2)
    .setY(CFG.tableY + 0.18);
  let paddleCenter = rightHand
    .clone()
    .addScaledVector(forward, 0.14)
    .setY(CFG.tableY + 0.2);
  let faceNormal = forward
    .clone()
    .multiplyScalar(-1)
    .add(new THREE.Vector3(0, 0.08, 0))
    .normalize();
  let torsoYaw = 0;
  let torsoLean = 0.1;
  let shoulderLift = 0;
  let wristPronation = 0;

  const readyServe =
    ball.lastHitBy === null &&
    ball.phase.kind === 'serve' &&
    ball.phase.server === player.side &&
    action === 'ready';

  if (action === 'serve' || readyServe) {
    const s = action === 'serve' ? tRaw : 0;
    const toss = clamp01(s / 0.34);
    const load = clamp01((s - 0.1) / 0.28);
    const drop = clamp01((s - 0.38) / 0.2);
    const contact = clamp01((s - 0.58) / 0.14);
    const follow = clamp01((s - 0.72) / 0.28);
    const palm = servePalmPosition(player);

    torsoYaw = -0.32 * load + 0.55 * contact - 0.18 * follow;
    torsoLean = 0.13 - 0.07 * load + 0.12 * contact;
    shoulderLift = 0.16 * contact;

    leftElbow = leftShoulder
      .clone()
      .addScaledVector(right, -0.08)
      .addScaledVector(forward, 0.14)
      .setY(lerp(CFG.tableY + 0.22, CFG.tableY + 0.72, toss) - 0.42 * contact);
    leftHand = palm
      .clone()
      .setY(lerp(CFG.tableY + 0.28, CFG.tableY + 0.88, toss) - 0.55 * contact);

    const prepHand = rightShoulder
      .clone()
      .addScaledVector(right, 0.24)
      .addScaledVector(forward, -0.12)
      .setY(CFG.tableY + 0.32);
    const dropHand = rightShoulder
      .clone()
      .addScaledVector(right, 0.3)
      .addScaledVector(forward, 0.03)
      .setY(CFG.tableY + 0.15);
    const contactHand = serveContactPosition(player)
      .addScaledVector(right, -0.08)
      .addScaledVector(forward, -0.04)
      .setY(CFG.tableY + 0.24);
    const followHand = base
      .clone()
      .addScaledVector(right, -0.26)
      .addScaledVector(forward, 0.24)
      .setY(CFG.tableY + 0.52);

    rightHand
      .copy(prepHand)
      .lerp(dropHand, drop)
      .lerp(contactHand, contact)
      .lerp(followHand, easeOutCubic(follow));
    rightElbow = rightShoulder
      .clone()
      .lerp(rightHand, 0.54)
      .addScaledVector(right, 0.06)
      .setY((rightShoulder.y + rightHand.y) * 0.5 - 0.02);
    paddleCenter = rightHand
      .clone()
      .addScaledVector(forward, 0.18 + 0.1 * contact)
      .addScaledVector(right, -0.03 * follow)
      .setY(rightHand.y + 0.04 + 0.12 * contact);
    faceNormal = forward
      .clone()
      .multiplyScalar(-0.75)
      .addScaledVector(right, -0.3)
      .add(new THREE.Vector3(0, -0.18, 0))
      .normalize();
    wristPronation = -0.75 * load + 1.3 * contact - 0.32 * follow;
  } else if (action === 'backhand') {
    const prep = clamp01(tRaw / 0.25);
    const contact = clamp01((tRaw - 0.36) / 0.18);
    const follow = clamp01((tRaw - 0.55) / 0.35);
    const sideOffset = clamp(ball.pos.x - player.pos.x, -0.28, 0.16);

    torsoYaw = 0.25 * prep - 0.42 * contact;
    torsoLean = 0.14;
    shoulderLift = 0.03;

    const prepHand = rightShoulder
      .clone()
      .addScaledVector(right, -0.18 + sideOffset)
      .addScaledVector(forward, 0.12)
      .setY(CFG.tableY + 0.2);
    const contactHand = ball.pos
      .clone()
      .addScaledVector(forward, -0.06)
      .setY(clamp(ball.pos.y - 0.02, CFG.tableY + 0.1, CFG.tableY + 0.42));
    const followHand = rightShoulder
      .clone()
      .addScaledVector(right, 0.12)
      .addScaledVector(forward, 0.42)
      .setY(CFG.tableY + 0.38);
    rightHand
      .copy(prepHand)
      .lerp(contactHand, contact)
      .lerp(followHand, easeOutCubic(follow));
    rightElbow = rightShoulder
      .clone()
      .lerp(rightHand, 0.5)
      .addScaledVector(right, -0.1)
      .setY((rightShoulder.y + rightHand.y) * 0.52);
    paddleCenter = rightHand
      .clone()
      .addScaledVector(forward, 0.16)
      .addScaledVector(right, -0.02)
      .setY(rightHand.y + 0.04);
    faceNormal = forward
      .clone()
      .multiplyScalar(-0.88)
      .addScaledVector(right, -0.22)
      .add(new THREE.Vector3(0, 0.06, 0))
      .normalize();
    leftElbow = leftShoulder
      .clone()
      .addScaledVector(right, -0.16)
      .addScaledVector(forward, 0.18)
      .setY(CFG.tableY + 0.36);
    leftHand = leftShoulder
      .clone()
      .addScaledVector(right, -0.22)
      .addScaledVector(forward, 0.34)
      .setY(CFG.tableY + 0.2);
    wristPronation = -0.85 + 0.7 * contact;
  } else {
    const prep = clamp01(tRaw / 0.24);
    const contact = clamp01((tRaw - 0.38) / 0.18);
    const follow = clamp01((tRaw - 0.56) / 0.42);
    const sideOffset = clamp(ball.pos.x - player.pos.x, -0.15, 0.32);

    torsoYaw = -0.5 * prep + 0.75 * contact - 0.15 * follow;
    torsoLean = 0.16 - 0.06 * contact;
    shoulderLift = 0.09 * contact;

    const prepHand = rightShoulder
      .clone()
      .addScaledVector(right, 0.34 + sideOffset)
      .addScaledVector(forward, -0.14)
      .setY(CFG.tableY + 0.18);
    const contactHand = ball.pos
      .clone()
      .addScaledVector(forward, -0.07)
      .addScaledVector(right, -0.02)
      .setY(clamp(ball.pos.y - 0.03, CFG.tableY + 0.1, CFG.tableY + 0.42));
    const followHand = base
      .clone()
      .addScaledVector(right, -0.24)
      .addScaledVector(forward, 0.35)
      .setY(CFG.tableY + 0.62);

    rightHand
      .copy(prepHand)
      .lerp(contactHand, contact)
      .lerp(followHand, easeOutCubic(follow));
    rightElbow = rightShoulder
      .clone()
      .lerp(rightHand, 0.5)
      .addScaledVector(right, 0.09 * (1 - follow))
      .setY((rightShoulder.y + rightHand.y) * 0.5 + 0.03);
    paddleCenter = rightHand
      .clone()
      .addScaledVector(forward, 0.16)
      .addScaledVector(right, 0.02)
      .setY(rightHand.y + 0.04 + 0.12 * follow);
    faceNormal = forward
      .clone()
      .multiplyScalar(-0.82)
      .addScaledVector(right, 0.16)
      .add(new THREE.Vector3(0, 0.1 + 0.18 * contact, 0))
      .normalize();

    leftElbow = leftShoulder
      .clone()
      .addScaledVector(right, -0.18)
      .addScaledVector(forward, 0.14)
      .setY(CFG.tableY + 0.38);
    leftHand = leftShoulder
      .clone()
      .addScaledVector(right, -0.28 + 0.18 * follow)
      .addScaledVector(forward, 0.26)
      .setY(CFG.tableY + 0.2 + 0.28 * follow);
    wristPronation = 0.55 * prep + 0.9 * contact + 0.22 * follow;
  }

  return {
    rightShoulder,
    rightElbow,
    rightHand,
    leftShoulder,
    leftElbow,
    leftHand,
    paddleGrip: rightHand.clone(),
    paddleCenter,
    faceNormal,
    torsoYaw,
    torsoLean,
    shoulderLift,
    wristPronation,
    crouch
  };
}

export function humanPose(s: MatchState, seat: Seat, yaw: number) {
  const p = s.players[seat],
    age = s.time - p.swingAt,
    recent = age >= 0 && age < 0.33;
  const serving =
    (s.score.server === seat && (s.phase === 'serve' || s.phase === 'toss')) ||
    (recent && s.ball.serve && s.ball.last === seat);
  const incoming = s.phase === 'rally' && s.ball.last !== seat;
  const contact = new THREE.Vector3(
    recent ? p.hitX : s.ball.x,
    recent ? p.hitY : s.ball.y,
    recent ? p.hitZ : s.ball.z
  );
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const backhand =
    contact
      .clone()
      .sub(new THREE.Vector3(p.x, 0, p.z))
      .dot(right) < -0.025 || s.inputs[seat].shot === 'backspin';
  let action = 'ready',
    progress = 0;
  if (serving) {
    if (s.phase === 'toss') {
      action = 'serve';
      progress = clamp01((s.time - s.phaseAt) / 0.465) * 0.7;
    } else if (recent) {
      action = 'serve';
      progress = 0.7 + clamp01(age / 0.3) * 0.3;
    }
  } else if (recent) {
    action = backhand ? 'backhand' : 'forehand';
    progress = 0.56 + clamp01(age / 0.33) * 0.44;
  } else if (incoming) {
    const approaching = Math.max(
      0,
      (side(seat, s) * (p.z - side(seat, s) * 0.55) -
        side(seat, s) * s.ball.z) /
        Math.max(0.1, side(seat, s) * s.ball.vz)
    );
    if (approaching < 0.24) {
      action = backhand ? 'backhand' : 'forehand';
      progress = 0.38 * (1 - clamp01(approaching / 0.24));
    }
  }
  const player = {
    pos: new THREE.Vector3(p.x, 0, p.z),
    yaw,
    side: seat,
    action,
    swingT: progress
  };
  const pose = tableTennisPose(player, {
    pos: contact,
    lastHitBy: serving && s.phase === 'serve' ? null : s.ball.last,
    phase: { kind: serving ? 'serve' : 'rally', server: s.score.server }
  });
  // The free palm follows the real toss and clears the line to the receiver.
  if (serving && s.phase === 'serve')
    pose.leftHand.set(s.ball.x, s.ball.y - 0.04, s.ball.z);
  if (serving && s.phase === 'toss')
    pose.leftHand
      .copy(servePalmPosition(player))
      .addScaledVector(right, -0.1 * clamp01((s.time - s.phaseAt) / 0.2));
  return { ...pose, action };
}
export type HumanSkeleton = ReturnType<typeof bindHuman>;
export function bindHuman(model: THREE.Object3D) {
  const bones = findHumanBones(model);
  const meshes: THREE.SkinnedMesh[] = [];
  model.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh)
      meshes.push(o as THREE.SkinnedMesh);
  });
  const body = meshes.find((m) => m.skeleton.bones.includes(bones.spine!));
  const followers: { bone: THREE.Bone; source: THREE.Bone }[] = [];
  if (body)
    for (const mesh of meshes)
      for (const bone of mesh.skeleton.bones) {
        if (
          body.skeleton.bones.includes(bone) ||
          followers.some((f) => f.bone === bone)
        )
          continue;
        const source = body.skeleton.bones.find(
          (b) =>
            bone.name === b.name ||
            (bone.name.startsWith(b.name + '_') &&
              /^\d+$/.test(bone.name.slice(b.name.length + 1)))
        );
        if (source) followers.push({ bone, source });
      }
  return {
    bones,
    followers,
    rest: captureRestPose(bones),
    right: makeArmChain(
      bones.rightShoulder,
      bones.rightUpperArm,
      bones.rightForeArm,
      bones.rightHand
    ),
    left: makeArmChain(
      bones.leftShoulder,
      bones.leftUpperArm,
      bones.leftForeArm,
      bones.leftHand
    )
  };
}
export function applyHumanPose(
  rig: HumanSkeleton,
  pose: ReturnType<typeof humanPose>,
  stage: THREE.Group,
  root: THREE.Group,
  paddle: THREE.Group
) {
  for (const r of rig.rest) r.bone.quaternion.copy(r.q);
  const { bones } = rig;
  addLocalRotation(
    bones.spine,
    pose.torsoLean,
    pose.torsoYaw * 0.28,
    pose.torsoYaw * 0.08
  );
  addLocalRotation(
    bones.chest,
    pose.torsoLean * 0.6,
    pose.torsoYaw * 0.44,
    pose.torsoYaw * 0.18
  );
  addLocalRotation(
    bones.neck,
    -pose.torsoLean * 0.35,
    -pose.torsoYaw * 0.16,
    0
  );
  addLocalRotation(bones.rightShoulder, 0, 0, pose.shoulderLift * 0.3);
  root.updateWorldMatrix(true, true);
  const world = (v: THREE.Vector3) => stage.localToWorld(v.clone());
  solveTwoBoneArm(rig.right, world(pose.rightElbow), world(pose.rightHand));
  solveTwoBoneArm(rig.left, world(pose.leftElbow), world(pose.leftHand));
  addLocalRotation(bones.rightHand, 0.03, pose.wristPronation, -0.1);
  for (const { bone, source } of rig.followers) {
    bone.quaternion.copy(source.quaternion);
    bone.position.copy(source.position);
    bone.scale.copy(source.scale);
  }
  root.updateWorldMatrix(true, true);
  const grip = bones.rightHand
    ? stage.worldToLocal(getWorldPos(bones.rightHand))
    : pose.paddleGrip;
  const yAxis = pose.paddleCenter.clone().sub(pose.paddleGrip).normalize();
  const zAxis = pose.faceNormal
    .clone()
    .addScaledVector(yAxis, -pose.faceNormal.dot(yAxis))
    .normalize();
  const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis).normalize();
  zAxis.crossVectors(xAxis, yAxis).normalize();
  paddle.quaternion.setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis)
  );
  paddle.position.copy(grip).addScaledVector(yAxis, 0.115);
}
