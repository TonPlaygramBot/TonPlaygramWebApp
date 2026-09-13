import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { saveBoneRig, applySeatedBoardPose } from '../chess/seatedHumanRig.ts';
import { PHYSICAL_MOVE_DURATION_MS, samplePhysicalMove, updatePhysicalPieceMove, normalizeRigBoneName } from '../chess/physicalPieceMove.ts';
import type { PhysicalMoveAction } from '../chess/physicalPieceMove.ts';

export { PHYSICAL_MOVE_DURATION_MS };
export type CheckersSeat = 'bottom' | 'top';
export const CHECKERS_HUMAN_CAMERA_TARGET_HEIGHT = 0.8;
export function checkersPortraitFov(aspect: number, baseFov = 52) {
  return THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(baseFov / 2)) * Math.max(1, (9 / 14) / Math.max(aspect, 0.1))));
}
export type CheckersHumanActor = ReturnType<typeof createCheckersHumanActor>;
export type CheckersHumanMove = PhysicalMoveAction & {
  fromCell: { r: number; c: number };
  toCell: { r: number; c: number };
};

// Seat identities follow the existing portrait layout; the board is never rotated.
export function checkersSeatForSide(side: string, localSide: string): CheckersSeat {
  return side === localSide ? 'bottom' : 'top';
}

// Preserve the real skinned hands in the player's first-person camera, while
// keeping their head and torso out of the board view. Both views use one rig.
function createFirstPersonArms(actor: THREE.Object3D) {
  const originals: THREE.Mesh[] = [];
  const arms: THREE.SkinnedMesh[] = [];
  actor.traverse((node) => {
    if (!(node as THREE.Mesh).isMesh) return;
    originals.push(node as THREE.Mesh);
    const source = node as THREE.SkinnedMesh;
    const skinIndex = source.geometry.getAttribute('skinIndex');
    const skinWeight = source.geometry.getAttribute('skinWeight');
    if (!source.isSkinnedMesh || !skinIndex || !skinWeight) return;
    const armBones = source.skeleton.bones.map((bone) =>
      /^(left|right)(arm|upperarm|forearm|lowerarm|hand|thumb|index|middle|ring|pinky)/.test(normalizeRigBoneName(bone.name))
    );
    const included = new Uint8Array(skinIndex.count);
    for (let vertex = 0; vertex < included.length; vertex++) {
      let weight = 0;
      for (let component = 0; component < skinIndex.itemSize; component++) {
        if (armBones[skinIndex.getComponent(vertex, component)]) weight += skinWeight.getComponent(vertex, component);
      }
      included[vertex] = weight >= 0.5 ? 1 : 0;
    }
    const indices: number[] = [];
    const index = source.geometry.index;
    const count = index?.count || skinIndex.count;
    const groups = source.geometry.groups.length ? source.geometry.groups : [{ start: 0, count, materialIndex: 0 }];
    const geometry = source.geometry.clone();
    geometry.clearGroups();
    for (const group of groups) {
      const start = indices.length;
      for (let i = group.start; i + 2 < Math.min(count, group.start + group.count); i += 3) {
        const a = index ? index.getX(i) : i;
        const b = index ? index.getX(i + 1) : i + 1;
        const c = index ? index.getX(i + 2) : i + 2;
        if (included[a] && included[b] && included[c]) indices.push(a, b, c);
      }
      geometry.addGroup(start, indices.length - start, group.materialIndex);
    }
    if (!indices.length) { geometry.dispose(); return; }
    geometry.setIndex(indices);
    const mesh = source.clone(false);
    mesh.name = `${source.name}-first-person-arms`;
    mesh.geometry = geometry;
    mesh.skeleton = source.skeleton;
    mesh.visible = false;
    mesh.userData.sourceMesh = source;
    arms.push(mesh);
  });
  for (const mesh of arms) {
    const source = mesh.userData.sourceMesh as THREE.Mesh;
    source.parent?.add(mesh);
    delete mesh.userData.sourceMesh;
  }
  return { originals, arms };
}

export function createCheckersHumanActor(template: THREE.Object3D, options: {
  seat: CheckersSeat; distance: number; seatY: number; height: number;
}) {
  const actor = cloneSkinned(template);
  const root = new THREE.Group();
  root.name = `checkers-human-${options.seat}`;
  root.add(actor);
  // Normalize the imported root as well as its meshes before saving the bind pose.
  const bounds = new THREE.Box3().setFromObject(actor);
  actor.scale.setScalar(template.userData.seatedHumanScale || options.height / Math.max(bounds.max.y - bounds.min.y, 0.01));
  const rig = saveBoneRig(actor);
  applySeatedBoardPose(rig, 'idle', 1, 0);
  root.updateMatrixWorld(true);
  const pelvis = rig.hips?.getWorldPosition(new THREE.Vector3()) || new THREE.Vector3();
  actor.position.y += options.seatY - pelvis.y + (template.userData.seatedYOffset || 0);
  root.rotation.y = (options.seat === 'bottom' ? Math.PI : 0) + (template.userData.seatedYawOffset || 0);
  // Sit on the front of the existing chair cushion so the far king row is
  // reachable without stretching the imported arm bones.
  const seatedDistance = options.distance - options.height * 0.17 + (template.userData.seatedZOffset || 0);
  root.position.z = options.seat === 'bottom' ? seatedDistance : -seatedDistance;
  root.updateMatrixWorld(true);
  const firstPerson = options.seat === 'bottom' ? createFirstPersonArms(actor) : { originals: [], arms: [] };
  return { root, actor, rig, seat: options.seat, firstPerson };
}

export function setCheckersHumanView(entry: CheckersHumanActor, view: '2d' | '3d') {
  const firstPerson = entry.seat === 'bottom' && view === '3d';
  entry.firstPerson.originals.forEach((mesh) => { mesh.visible = !firstPerson; });
  entry.firstPerson.arms.forEach((mesh) => { mesh.visible = firstPerson; });
}

export function updateCheckersHumanMove(entry: CheckersHumanActor | undefined, action: CheckersHumanMove, u: number, tile: number) {
  const clearance = tile * 0.9;
  const frame = samplePhysicalMove(u, action.from, action.to, clearance);
  if (entry?.rig.rightHand) {
    const row = (action.fromCell.r + action.toCell.r) / 2;
    const forwardReach = entry.seat === 'bottom' ? 1 - row / 7 : row / 7;
    const sideReach = ((action.fromCell.c + action.toCell.c) / 2 - 3.5) / 3.5;
    applySeatedBoardPose(entry.rig, 'reachPiece', frame.reach, frame.grip, { forwardReach, sideReach });
    // The same calibrated thumb/index/middle contact solver as Chess. Checker
    // grip dimensions come from the actual chip, not the taller chess pieces.
    updatePhysicalPieceMove(entry.rig, action, u, clearance);
  } else {
    action.mesh.position.copy(frame.position);
  }
  return frame;
}

export function idleCheckersHuman(entry: CheckersHumanActor) {
  applySeatedBoardPose(entry.rig, 'idle', 1, 0);
}

export function disposeCheckersHuman(entry: CheckersHumanActor) {
  entry.root.removeFromParent();
  // Templates share geometry/materials; each clone owns only its skeleton GPU data.
  const skeletons = new Set<THREE.Skeleton>();
  entry.actor.traverse((node) => {
    if ((node as THREE.SkinnedMesh).isSkinnedMesh) skeletons.add((node as THREE.SkinnedMesh).skeleton);
  });
  skeletons.forEach((skeleton) => skeleton.dispose());
  entry.firstPerson.arms.forEach((mesh) => mesh.geometry.dispose());
}
