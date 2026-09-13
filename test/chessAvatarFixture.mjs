import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import {
  calibrateHandRig,
  applyHandGrip
} from '../webapp/src/games/chess/anatomicalHand.ts';
import {
  normalizeRigBoneName,
  rotateJointToTarget
} from '../webapp/src/games/chess/physicalPieceMove.ts';
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
  const source = fs.readFileSync(
    new URL('../webapp/src/pages/Games/ChessBattleRoyal.jsx', import.meta.url),
    'utf8'
  );
  const functions = source.slice(
    source.indexOf('function normalizeBoneName('),
    source.indexOf('function createSeatedHumanFallbackTexture(')
  );
  const seated = source.slice(
    source.indexOf('function applySeatedHumanPose('),
    source.indexOf('const seatedHumanTemplatePromiseById')
  );
  const context = vm.createContext({
    root,
    normalizeRigBoneName,
    calibrateHandRig,
    applyHandGrip,
    THREE,
    rotateJointToTarget,
    clamp: THREE.MathUtils.clamp,
    clamp01: (v, fallback = 0) =>
      Number.isFinite(v) ? THREE.MathUtils.clamp(v, 0, 1) : fallback,
    SEATED_HUMAN_REACH_FORWARD_GAIN: Number(
      source.match(/const SEATED_HUMAN_REACH_FORWARD_GAIN = ([\d.]+)/)[1]
    ),
    SEATED_HUMAN_REACH_SIDE_GAIN: Number(
      source.match(/const SEATED_HUMAN_REACH_SIDE_GAIN = ([\d.]+)/)[1]
    ),
    performance: { now: () => 0 },
    CHESS_FIREARM_HOLD_PROFILE_BY_TYPE: { default: {} }
  });
  const rig = vm.runInContext(
    functions + seated + '\nsaveBoneRig(root)',
    context
  );
  const pose = (mode, intensity, grip, motion) =>
    context.applySeatedHumanPose(rig, mode, intensity, grip, motion);
  return { root, rig, pose };
}
