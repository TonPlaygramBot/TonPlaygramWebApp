import * as THREE from 'three';
import { humanoidBones, solveHumanoidLimb } from '../tiranastreets/street-career/humanoidRig.mjs';

const rigs = new WeakMap();

/** Adapt Turi's authored joint axes to the seated games before their action
 * overlays run. World-space IK keeps knees ahead of hips, feet below knees,
 * and the two hands on their own side, without changing the imported model. */
export function applyTuriSeatedPose(root, { arms = true } = {}) {
  if (!root) return;
  let rig = rigs.get(root);
  if (!rig) {
    const bones = humanoidBones(root);
    if (!['hips', 'leftarm', 'rightarm', 'leftupleg', 'rightupleg'].every((name) => bones.has(name))) return;
    rig = { bones, point: new THREE.Vector3(), targets: new Map(), lengths: new Map() };
    root.updateWorldMatrix(true, true);
    const position = (name) => root.worldToLocal(bones.get(name).getWorldPosition(new THREE.Vector3()));
    for (const side of ['left', 'right']) {
      for (const [part, middle, end] of [['upleg', 'leg', 'foot'], ['arm', 'forearm', 'hand']]) {
        if (![part, middle, end].every((name) => bones.has(side + name))) continue;
        const start = position(side + part), joint = position(side + middle), tip = position(side + end);
        rig.lengths.set(side + part, [start.distanceTo(joint), joint.distanceTo(tip)]);
        rig.targets.set(side + part, new THREE.Vector3());
      }
    }
    rigs.set(root, rig);
  }
  root.updateWorldMatrix(true, true);
  const hips = root.worldToLocal(rig.bones.get('hips').getWorldPosition(rig.point));
  const hipsY = hips.y, hipsZ = hips.z;
  for (const side of ['left', 'right']) {
    const leg = rig.lengths.get(side + 'upleg');
    if (leg) {
      const target = rig.targets.get(side + 'upleg');
      root.worldToLocal(rig.bones.get(side + 'upleg').getWorldPosition(target));
      target.y -= leg[1] * 0.96;
      target.z += leg[0] * 0.96;
      solveHumanoidLimb(root, rig.bones, side, root.localToWorld(target), true);
    }
    const arm = rig.lengths.get(side + 'arm');
    if (arms && arm) {
      const target = rig.targets.get(side + 'arm');
      root.worldToLocal(rig.bones.get(side + 'arm').getWorldPosition(target));
      target.y = hipsY + (arm[0] + arm[1]) * 0.15;
      target.z = hipsZ + (arm[0] + arm[1]) * 0.62;
      solveHumanoidLimb(root, rig.bones, side, root.localToWorld(target));
    }
  }
  root.updateWorldMatrix(true, true);
}
