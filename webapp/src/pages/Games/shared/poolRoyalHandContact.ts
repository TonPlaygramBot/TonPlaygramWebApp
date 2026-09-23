import * as THREE from 'three';
import { CFG, type HumanRig } from './poolRoyalReferenceHuman.ts';
import { solveArm } from './poolRoyalPlayerPose.ts';
import type { BridgeBounds, BridgeObstacle } from './poolRoyalBridgeSafety.ts';

export type HandContactScene = {
  clothY: number; railY: number;
  inner: BridgeBounds; outer: BridgeBounds;
  balls: BridgeObstacle[];
};
type Surface = { mesh: THREE.SkinnedMesh; indices: number[]; triangles: number[][] };
const surfaces = new WeakMap<HumanRig, Surface[]>();

function handTriangles(human: HumanRig) {
  let entries = surfaces.get(human);
  if (!entries) {
    entries = [];
    const bones = new Set([human.bones.leftHand, ...human.leftFingers]);
    human.model!.traverse(object => {
      const mesh = object as THREE.SkinnedMesh;
      if (!mesh.isSkinnedMesh || !mesh.geometry.index) return;
      const { skinIndex, skinWeight } = mesh.geometry.attributes;
      const selected = new Set<number>();
      for (let i = 0; i < skinIndex.count; i++) {
        let weight = 0;
        for (let j = 0; j < 4; j++) if (bones.has(mesh.skeleton.bones[skinIndex.getComponent(i, j)])) weight += skinWeight.getComponent(i, j);
        if (weight > 0.8) selected.add(i);
      }
      if (!selected.size) return;
      const triangles: number[][] = [], indices = new Set<number>();
      const index = mesh.geometry.index;
      for (let i = 0; i < index.count; i += 3) {
        const tri = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
        // Include boundary triangles too: checking only fully weighted vertices
        // left a hole in collision detection at the heel/wrist seam.
        if (tri.some(v => selected.has(v))) { triangles.push(tri); tri.forEach(v => indices.add(v)); }
      }
      entries!.push({ mesh, indices: [...indices], triangles });
    });
    surfaces.set(human, entries);
  }
  human.modelRoot.updateMatrixWorld(true);
  const triangles: THREE.Triangle[] = [], bounds = new THREE.Box3();
  for (const { mesh, indices, triangles: faces } of entries) {
    const vertices = new Map<number, THREE.Vector3>();
    for (const i of indices) {
      const point = mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
      vertices.set(i, point); bounds.expandByPoint(point);
    }
    for (const [a, b, c] of faces) triangles.push(new THREE.Triangle(vertices.get(a)!, vertices.get(b)!, vertices.get(c)!));
  }
  return { triangles, bounds };
}

/** Conservative solid table + rail volumes, and exact triangle/sphere tests.
 * The rail envelope includes the rounded jaws; pocket gaps never attract a hand. */
export function poolRoyalHandContact(human: HumanRig, scene: HandContactScene) {
  const { triangles, bounds } = handTriangles(human);
  const { inner: i, outer: o, clothY, railY } = scene;
  const margin = 0.001 * CFG.humanScale;
  const box = (x0: number, x1: number, z0: number, z1: number, top: number) =>
    new THREE.Box3(new THREE.Vector3(x0, 0, z0), new THREE.Vector3(x1, top + margin, z1));
  const solids = [
    box(-o.halfWidth, o.halfWidth, -o.halfLength, o.halfLength, clothY),
    box(-o.halfWidth, -i.halfWidth, -o.halfLength, o.halfLength, railY),
    box(i.halfWidth, o.halfWidth, -o.halfLength, o.halfLength, railY),
    box(-i.halfWidth, i.halfWidth, -o.halfLength, -i.halfLength, railY),
    box(-i.halfWidth, i.halfWidth, i.halfLength, o.halfLength, railY)
  ];
  let lift = 0;
  for (const solid of solids) {
    if (bounds.intersectsBox(solid) && triangles.some(triangle => solid.intersectsTriangle(triangle))) {
      lift = Math.max(lift, solid.max.y - bounds.min.y + margin);
    }
  }
  const closest = new THREE.Vector3();
  for (const ball of scene.balls) {
    const radius = ball.radius + margin;
    if (bounds.distanceToPoint(ball.position) > radius) continue;
    if (triangles.some(triangle => triangle.closestPointToPoint(ball.position, closest).distanceToSquared(ball.position) < radius * radius)) {
      lift = Math.max(lift, ball.position.y + radius - bounds.min.y + margin);
    }
  }
  return { clear: lift <= 0, lift, bounds };
}

/** Keep fingers and heel out of geometry even during the blend into the stance.
 * Prefer a nearby bridge along the shaft. If no cloth position fits, the host
 * can use the mechanical rest instead of squeezing a hand through an obstacle. */
export function protectPoolRoyalBridge(human: HumanRig, scene: HandContactScene,
  forward: THREE.Vector3, allowSlide = true) {
  const b = human.bones;
  const original = b.leftHand!.getWorldPosition(new THREE.Vector3());
  const rotation = b.leftHand!.getWorldQuaternion(new THREE.Quaternion()).normalize();
  const pole = new THREE.Vector3(forward.z, 0.16, -forward.x).addScaledVector(forward, -0.3).normalize();
  const place = (target: THREE.Vector3) => {
    solveArm(b.leftUpperArm!, b.leftLowerArm!, b.leftHand!, target, pole);
    b.leftHand!.quaternion.copy(b.leftHand!.parent!.getWorldQuaternion(new THREE.Quaternion()).normalize().invert().multiply(rotation)).normalize();
    human.modelRoot.updateMatrixWorld(true);
  };
  let contact = poolRoyalHandContact(human, scene);
  if (contact.clear) return true;
  if (allowSlide && human.poseT > 0.95) {
    for (const offset of [-0.04, -0.08, -0.12, -0.18, 0.04, 0.08]) {
      place(original.clone().addScaledVector(forward, offset * CFG.humanScale));
      if (poolRoyalHandContact(human, scene).clear) return true;
    }
    place(original);
    return false;
  }
  // Transitions/recovery use clearance before the hand reaches its final bridge.
  for (let iteration = 0; iteration < 4 && !contact.clear; iteration++) {
    const target = b.leftHand!.getWorldPosition(new THREE.Vector3()); target.y += contact.lift;
    place(target); contact = poolRoyalHandContact(human, scene);
  }
  return contact.clear;
}
