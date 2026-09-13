import fs from 'node:fs';
import { saveBoneRig, applySeatedBoardPose } from '../webapp/src/games/chess/seatedHumanRig.ts';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
export function loadRig(modelRoot = null) {
  const bytes = fs.readFileSync(
    new URL(
      '../webapp/public/assets/table-tennis/chess-human.glb',
      import.meta.url
    )
  );
  const json = JSON.parse(
    bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString()
  );
  const nodes = json.nodes.map((n) => {
    const node = new THREE.Bone();
    node.name = n.name || '';
    if (n.translation) node.position.fromArray(n.translation);
    if (n.rotation) node.quaternion.fromArray(n.rotation);
    if (n.scale) node.scale.fromArray(n.scale);
    return node;
  });
  json.nodes.forEach((n, i) =>
    n.children?.forEach((j) => nodes[i].add(nodes[j]))
  );
  const root = modelRoot || new THREE.Group();
  if (!modelRoot)
    json.scenes[json.scene || 0].nodes.forEach((i) => root.add(nodes[i]));
  root.updateMatrixWorld(true);
  const rig = saveBoneRig(root);
  const pose = (mode, intensity, grip, motion) => applySeatedBoardPose(rig, mode, intensity, grip, motion);
  return { root, rig, pose };
}
