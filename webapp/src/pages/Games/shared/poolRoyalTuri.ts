import * as THREE from 'three';
import type { HumanRig } from './poolRoyalReferenceHuman.ts';

// Height of the original billiards reference GLB, before its scene scale.
// Both seats must use the same solver space even when their models differ.
export const BILLIARDS_REFERENCE_HEIGHT = 1.8733298803227571;

/** The supplied Turi has a head joint but no eye joints. Fit camera sockets
 * once from his authored head skin in joint space, so they follow the existing
 * stance/head animation without renaming any bone or changing the GLB. */
export function addTuriBilliardsEyeSockets(human: HumanRig) {
  const head = human.bones.head;
  if (!head || !human.model || human.model.getObjectByName('LeftEye')) return;
  human.modelRoot.updateMatrixWorld(true);
  const headBones = new Set<THREE.Object3D>();
  head.traverse(bone => headBones.add(bone));
  const bounds = new THREE.Box3();
  human.model.traverse(object => {
    const mesh = object as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    const { position, skinIndex, skinWeight } = mesh.geometry.attributes;
    for (let i = 0; i < position.count; i++) {
      let weight = 0;
      for (let j = 0; j < 4; j++)
        if (headBones.has(mesh.skeleton.bones[skinIndex.getComponent(i, j)])) weight += skinWeight.getComponent(i, j);
      if (weight > 0.8) bounds.expandByPoint(head.worldToLocal(
        mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld)));
    }
  });
  if (bounds.isEmpty()) throw new Error('Turi head skin is missing; eye view cannot be fitted.');
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  for (const [name, side] of [['LeftEye', 1], ['RightEye', -1]] as const) {
    const socket = new THREE.Object3D();
    socket.name = name;
    socket.position.set(center.x + size.x * 0.17 * side,
      bounds.min.y + size.y * 0.63, bounds.max.z * 0.72);
    head.add(socket);
  }
  human.modelRoot.updateMatrixWorld(true);
}
