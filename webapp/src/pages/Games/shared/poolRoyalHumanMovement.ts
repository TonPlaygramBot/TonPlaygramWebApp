import * as THREE from 'three';
import { CFG, type HumanMotionFrame, type HumanRig } from './poolRoyalReferenceHuman.ts';
import { solveArm } from './poolRoyalPlayerPose.ts';

const UP = new THREE.Vector3(0, 1, 0);
const clamp = THREE.MathUtils.clamp;
export const shortestPoolRoyalTurn = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

/** Open rectangle intersection: travelling along the outside edge is permitted. */
export function crossesPoolRoyalTable(a: THREE.Vector3, b: THREE.Vector3, halfWidth: number, halfLength: number) {
  let enter = 0, leave = 1;
  for (const [axis, half] of [['x', halfWidth], ['z', halfLength]] as const) {
    const d = b[axis] - a[axis];
    if (Math.abs(d) < 1e-9) {
      if (Math.abs(a[axis]) >= half - 1e-7) return false;
      continue;
    }
    const first = (-half - a[axis]) / d, second = (half - a[axis]) / d;
    enter = Math.max(enter, Math.min(first, second));
    leave = Math.min(leave, Math.max(first, second));
    if (enter >= leave - 1e-7) return false;
  }
  return enter < leave - 1e-7 && leave > 0 && enter < 1;
}

/** Six-node visibility graph routes people around the table rather than through it. */
export function poolRoyalWalkRoute(start: THREE.Vector3, end: THREE.Vector3, tableW: number, tableL: number) {
  const margin = 0.21 * CFG.humanScale;
  const halfW = tableW / 2 + margin, halfL = tableL / 2 + margin;
  const points = [start.clone(), end.clone(),
    new THREE.Vector3(-halfW, 0, -halfL), new THREE.Vector3(halfW, 0, -halfL),
    new THREE.Vector3(halfW, 0, halfL), new THREE.Vector3(-halfW, 0, halfL)];
  const distances = [0, Infinity, Infinity, Infinity, Infinity, Infinity];
  const previous = [-1, -1, -1, -1, -1, -1];
  const visited = new Set<number>();
  for (let count = 0; count < points.length; count++) {
    let current = -1;
    for (let i = 0; i < points.length; i++) if (!visited.has(i) && (current < 0 || distances[i] < distances[current])) current = i;
    if (current === 1 || !Number.isFinite(distances[current])) break;
    visited.add(current);
    for (let next = 1; next < points.length; next++) {
      if (visited.has(next) || crossesPoolRoyalTable(points[current], points[next], halfW, halfL)) continue;
      const distance = distances[current] + points[current].distanceTo(points[next]);
      if (distance < distances[next]) { distances[next] = distance; previous[next] = current; }
    }
  }
  const route: THREE.Vector3[] = [];
  for (let next = 1; previous[next] >= 0; next = previous[next]) route.unshift(points[next]);
  // A malformed starting point must never authorize walking through the table.
  return route;
}

export type PoolRoyalMovement = {
  root: THREE.Vector3;
  yaw: number;
  velocity: THREE.Vector3;
  speed: number;
  settled: boolean;
};

export function createPoolRoyalMovement(root: THREE.Vector3, yaw: number): PoolRoyalMovement {
  return { root: root.clone(), yaw, velocity: new THREE.Vector3(), speed: 0, settled: true };
}

export function advancePoolRoyalMovement(movement: PoolRoyalMovement, target: THREE.Vector3,
  targetYaw: number, tableW: number, tableL: number, dt: number, poseT: number, striking: boolean): HumanMotionFrame {
  const before = movement.root.clone();
  const seconds = clamp(dt, 0, 0.05);
  const remaining = target.distanceTo(movement.root);
  const moving = remaining > 0.015 * CFG.humanScale;
  const route = moving ? poolRoyalWalkRoute(movement.root, target, tableW, tableL) : [];
  const direction = route[0]?.clone().sub(movement.root).setY(0).normalize();
  // Stand before a substantial walk. Small corrections may settle in the stance.
  const canWalk = !striking && (poseT < 0.12 || remaining < 0.07 * CFG.humanScale);
  const desiredSpeed = moving && canWalk && route.length
    ? Math.min(1.1 * CFG.scale, Math.sqrt(2 * 3.5 * CFG.scale * remaining)) : 0;
  movement.speed = THREE.MathUtils.damp(movement.speed, desiredSpeed, desiredSpeed ? 9 : 16, seconds);
  if (striking) movement.speed = 0;
  let travel = canWalk ? movement.speed * seconds : 0;
  for (const point of route) {
    const distance = movement.root.distanceTo(point);
    if (distance > travel) {
      movement.root.lerp(point, travel / distance);
      break;
    }
    movement.root.copy(point);
    travel -= distance;
    if (travel <= 0) break;
  }
  movement.velocity.copy(movement.root).sub(before).divideScalar(seconds || 1);
  const walkingYaw = direction && remaining > 0.16 * CFG.humanScale
    ? Math.atan2(-direction.x, -direction.z) : targetYaw;
  if (!striking) movement.yaw += clamp(shortestPoolRoyalTurn(movement.yaw, walkingYaw), -2.8 * seconds, 2.8 * seconds);
  movement.settled = remaining <= 0.025 * CFG.humanScale && Math.abs(shortestPoolRoyalTurn(movement.yaw, targetYaw)) < 0.045;
  return { root: movement.root, yaw: movement.yaw, distance: movement.root.distanceTo(before), speed: movement.velocity.length(), pelvisDrop: 0.065 * CFG.humanScale };
}

type Foot = {
  upper: THREE.Bone; lower: THREE.Bone; ankle: THREE.Bone;
  point: THREE.Vector3; from: THREE.Vector3; to: THREE.Vector3;
  restRotation: THREE.Quaternion; rotation: THREE.Quaternion;
  yaw: number; fromYaw: number; toYaw: number; progress: number;
  ankleHeight: number;
};
export type PoolRoyalFeet = { feet: Foot[]; next: number; initialized: boolean };

/** Calibrate ankle height/orientation from the original rig, never from a guessed foot axis. */
export function createPoolRoyalFeet(human: HumanRig): PoolRoyalFeet {
  human.modelRoot.updateMatrixWorld(true);
  const feet = ['left', 'right'].map(side => {
    const upper = human.bones[`${side}UpperLeg` as 'leftUpperLeg']!;
    const lower = human.bones[`${side}LowerLeg` as 'leftLowerLeg']!;
    const ankle = human.bones[`${side}Foot` as 'leftFoot']!;
    const point = ankle.getWorldPosition(new THREE.Vector3());
    const footBones = new Set<THREE.Bone>();
    ankle.traverse(bone => { if ((bone as THREE.Bone).isBone) footBones.add(bone as THREE.Bone); });
    let soleY = Infinity;
    const vertex = new THREE.Vector3();
    human.model!.traverse(object => {
      const mesh = object as THREE.SkinnedMesh;
      if (!mesh.isSkinnedMesh) return;
      const { skinIndex, skinWeight } = mesh.geometry.attributes;
      for (let i = 0; i < skinIndex.count; i++) {
        let weight = 0;
        for (let j = 0; j < 4; j++) if (footBones.has(mesh.skeleton.bones[skinIndex.getComponent(i, j)])) weight += skinWeight.getComponent(i, j);
        if (weight < 0.8) continue;
        mesh.getVertexPosition(i, vertex).applyMatrix4(mesh.matrixWorld);
        soleY = Math.min(soleY, vertex.y);
      }
    });
    return { upper, lower, ankle, point, from: point.clone(), to: point.clone(),
      restRotation: ankle.getWorldQuaternion(new THREE.Quaternion()).normalize(), rotation: new THREE.Quaternion(),
      yaw: 0, fromYaw: 0, toYaw: 0, progress: 1,
      ankleHeight: Number.isFinite(soleY) ? point.y - soleY + 0.001 * CFG.humanScale : point.y };
  });
  return { feet, next: 0, initialized: false };
}

/** Alternating swing feet with world-space support contacts; step phase follows actual travel. */
export function plantPoolRoyalFeet(human: HumanRig, feet: PoolRoyalFeet, movement: PoolRoyalMovement, dt: number, striking: boolean) {
  const rotation = new THREE.Quaternion().setFromAxisAngle(UP, movement.yaw);
  const stance = THREE.MathUtils.smoothstep(human.poseT, 0.15, 0.95);
  const wants = feet.feet.map((foot, index) => new THREE.Vector3(
    (index ? 1 : -1) * THREE.MathUtils.lerp(0.15, 0.2, stance) * CFG.humanScale,
    foot.ankleHeight,
    THREE.MathUtils.lerp(0.075, index ? 0.2 : -0.2, stance) * CFG.humanScale
  ).applyQuaternion(rotation).add(movement.root).addScaledVector(movement.velocity, 0.16));
  if (!feet.initialized) {
    feet.feet.forEach((foot, index) => { foot.point.copy(wants[index]); foot.yaw = movement.yaw; });
    feet.initialized = true;
  }
  const stepping = feet.feet.some(foot => foot.progress < 1);
  if (!striking && !stepping) {
    for (let count = 0; count < 2; count++) {
      const index = (feet.next + count) % 2, foot = feet.feet[index];
      if (foot.point.distanceTo(wants[index]) < (movement.settled ? 0.045 : 0.2) * CFG.humanScale &&
        Math.abs(shortestPoolRoyalTurn(foot.yaw, movement.yaw)) < 0.18) continue;
      foot.from.copy(foot.point); foot.to.copy(wants[index]);
      foot.fromYaw = foot.yaw; foot.toYaw = movement.yaw; foot.progress = 0;
      feet.next = 1 - index;
      break;
    }
  }
  for (const foot of feet.feet) {
    if (foot.progress < 1 && !striking) {
      foot.progress = Math.min(1, foot.progress + Math.min(dt, 0.05) / 0.25);
      const t = THREE.MathUtils.smoothstep(foot.progress, 0, 1);
      foot.point.lerpVectors(foot.from, foot.to, t);
      foot.point.y += Math.sin(foot.progress * Math.PI) * 0.065 * CFG.humanScale;
      foot.yaw = foot.fromYaw + shortestPoolRoyalTurn(foot.fromYaw, foot.toYaw) * t;
    }
    const pole = new THREE.Vector3(0, 0, -1).applyQuaternion(rotation);
    solveArm(foot.upper, foot.lower, foot.ankle, foot.point, pole);
    foot.rotation.copy(foot.restRotation).premultiply(new THREE.Quaternion().setFromAxisAngle(UP, foot.yaw));
    const parent = foot.ankle.parent!.getWorldQuaternion(new THREE.Quaternion()).normalize().invert();
    foot.ankle.quaternion.copy(parent.multiply(foot.rotation)).normalize();
    foot.ankle.updateMatrixWorld(true);
  }
  return feet.feet.every(foot => foot.progress >= 1);
}

/** Re-solve the rear arm after torso/bridge refinement has changed the shoulder. */
export function settlePoolRoyalRearGrip(human: HumanRig, target: THREE.Vector3, forward: THREE.Vector3) {
  const b = human.bones;
  const rotation = b.rightHand!.getWorldQuaternion(new THREE.Quaternion()).normalize();
  const pole = new THREE.Vector3(-forward.z, 0.6, forward.x).addScaledVector(forward, -0.7).normalize();
  solveArm(b.rightUpperArm!, b.rightLowerArm!, b.rightHand!, target, pole);
  b.rightHand!.quaternion.copy(b.rightHand!.parent!.getWorldQuaternion(new THREE.Quaternion()).normalize().invert().multiply(rotation)).normalize();
  human.modelRoot.updateMatrixWorld(true);
}

/** Let the free hand hang beside the thigh instead of retaining the rig's A-pose. */
export function relaxPoolRoyalFreeArm(human: HumanRig, movement: PoolRoyalMovement) {
  const weight = 1 - THREE.MathUtils.smoothstep(human.poseT, 0.02, 0.55);
  if (weight <= 0) return;
  const { leftUpperArm: upper, leftLowerArm: lower, leftHand: hand } = human.bones;
  if (!upper || !lower || !hand) return;
  const bones = [upper, lower, hand], before = bones.map(bone => bone.quaternion.clone());
  const turn = new THREE.Quaternion().setFromAxisAngle(UP, movement.yaw);
  const swing = Math.sin(human.walkT * 6.2) * Math.min(1, movement.velocity.length() / (1.1 * CFG.scale));
  const target = new THREE.Vector3(-0.25 * CFG.humanScale, 1.0 * CFG.humanScale,
    (0.04 + swing * 0.1) * CFG.humanScale).applyQuaternion(turn).add(movement.root);
  const pole = new THREE.Vector3(-1, 0, -0.3).applyQuaternion(turn).normalize();
  solveArm(upper, lower, hand, target, pole);
  const fingers = new THREE.Vector3(0, -1, 0);
  const across = new THREE.Vector3(0, 0, -1).applyQuaternion(turn);
  const wrist = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(across, fingers,
    across.clone().cross(fingers))).normalize();
  hand.quaternion.copy(hand.parent!.getWorldQuaternion(new THREE.Quaternion()).normalize().invert().multiply(wrist));
  bones.forEach((bone, index) => bone.quaternion.slerpQuaternions(before[index], bone.quaternion.clone(), weight).normalize());
  human.modelRoot.updateMatrixWorld(true);
}
