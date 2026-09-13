import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import {
  samplePhysicalMove,
  rotateJointToTarget,
  normalizeRigBoneName,
  updatePhysicalPieceMove,
  tipPosition
} from '../webapp/src/games/chess/physicalPieceMove.ts';

test('piece stays planted while reaching/gripping and fingers stay closed until touchdown', () => {
  const from = new THREE.Vector3(-1, 2, 3),
    to = new THREE.Vector3(4, 2, -3);
  for (const t of [0, 0.1, 0.2, 0.29, 0.3])
    assert.ok(samplePhysicalMove(t, from, to, 0.4).position.equals(from));
  for (const t of [0.35, 0.5, 0.7, 0.81])
    assert.equal(samplePhysicalMove(t, from, to, 0.4).grip, 1);
  for (const t of [0.82, 0.86, 0.9, 1])
    assert.ok(
      samplePhysicalMove(t, from, to, 0.4).position.distanceTo(to) < 1e-10
    );
  assert.equal(samplePhysicalMove(1, from, to, 0.4).grip, 0);
  for (let i = 1; i <= 1000; i++)
    assert.ok(
      samplePhysicalMove(i / 1000, from, to, 0.4).position.distanceTo(
        samplePhysicalMove((i - 1) / 1000, from, to, 0.4).position
      ) < 0.05
    );
});
test('joint solver gives the same pose for either seat and a scaled, rotated parent', () => {
  function solve(rotation, scale) {
    const root = new THREE.Group();
    root.rotation.set(0.2, rotation, 0.1);
    root.scale.setScalar(scale);
    root.position.set(3, 4, -2);
    const bone = new THREE.Bone(),
      tip = new THREE.Bone();
    tip.position.set(0, 1, 0);
    root.add(bone);
    bone.add(tip);
    root.updateMatrixWorld(true);
    const target = root.localToWorld(new THREE.Vector3(0.6, 0.8, 0));
    for (let i = 0; i < 20; i++)
      rotateJointToTarget(
        bone,
        tip.getWorldPosition(new THREE.Vector3()),
        target
      );
    return {
      q: bone.quaternion,
      error:
        tip.getWorldPosition(new THREE.Vector3()).distanceTo(target) / scale
    };
  }
  const a = solve(0, 1),
    b = solve(Math.PI, 3.2);
  assert.ok(a.error < 1e-6);
  assert.ok(b.error < 1e-6);
  assert.ok(a.q.angleTo(b.q) < 1e-6);
});
function loadRig() {
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
  const root = new THREE.Group();
  json.scenes[json.scene || 0].nodes.forEach((i) => root.add(nodes[i]));
  root.updateMatrixWorld(true);
  const source = fs.readFileSync(
    new URL('../webapp/src/pages/Games/ChessBattleRoyal.jsx', import.meta.url),
    'utf8'
  );
  const functions = source.slice(
    source.indexOf('function normalizeBoneName('),
    source.indexOf('function resetBoneRig(')
  );
  const rig = vm.runInNewContext(functions + '\nsaveBoneRig(root)', {
    root,
    normalizeRigBoneName
  });
  return { root, rig };
}
test('the actual chess avatar resolves all three thumb/index/middle joints', () => {
  const { rig } = loadRig();
  for (const name of [
    'rightThumb',
    'rightIndex',
    'rightMiddle',
    'leftThumb',
    'leftIndex',
    'leftMiddle'
  ])
    assert.equal(rig[name].length, 3, name);
  assert.equal(rig.rightHand.name, 'RightHand');
  assert.equal(rig.rightUpperArm.name, 'RightArm');
  assert.equal(
    normalizeRigBoneName('mixamorig:RightHandIndex1'),
    'mixamorigrightindex1'
  );
});
test('actual avatar fingertip contact stays finite under translated/scaled board parents', () => {
  const { root, rig } = loadRig();
  root.rotation.y = Math.PI;
  root.scale.setScalar(3.2);
  root.updateMatrixWorld(true);
  const parent = new THREE.Group();
  parent.position.set(7, 2, -5);
  parent.scale.setScalar(0.6);
  parent.rotation.y = 0.4;
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.015, 0.08),
    new THREE.MeshBasicMaterial()
  );
  parent.add(mesh);
  parent.updateMatrixWorld(true);
  const pinch = [rig.rightThumb, rig.rightIndex, rig.rightMiddle]
    .map(tipPosition)
    .reduce((a, b) => a.add(b), new THREE.Vector3())
    .multiplyScalar(1 / 3);
  const from = parent.worldToLocal(pinch.clone());
  from.y -= 0.08;
  const to = from.clone().add(new THREE.Vector3(0.04, 0, 0.03));
  const action = { mesh, from, to, gripHeight: 0.08, gripRadius: 0.006 };
  updatePhysicalPieceMove(rig, action, 0.5, 0.03);
  assert.ok(
    mesh.position.distanceTo(samplePhysicalMove(0.5, from, to, 0.03).position) <
      1e-10
  );
  const target = parent.localToWorld(
    mesh.position.clone().add(new THREE.Vector3(0, 0.08, 0))
  );
  for (const chain of [rig.rightThumb, rig.rightIndex, rig.rightMiddle]) {
    const tip = tipPosition(chain);
    assert.ok(tip.toArray().every(Number.isFinite));
    assert.ok(
      tip.distanceTo(target) < 0.035,
      `Fingertip is ${tip.distanceTo(target)} from the piece neck`
    );
  }
  updatePhysicalPieceMove(rig, action, 1, 0.03);
  assert.ok(mesh.position.distanceTo(to) < 1e-10);
});
