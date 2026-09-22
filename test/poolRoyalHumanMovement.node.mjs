import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import { CFG } from '../webapp/src/pages/Games/shared/poolRoyalReferenceHuman.ts';
import { PoolRoyalHumanPlayers } from '../webapp/src/pages/Games/shared/PoolRoyalHumanPlayers.ts';
import { crossesPoolRoyalTable, poolRoyalWalkRoute, shortestPoolRoyalTurn,
  createPoolRoyalMovement, advancePoolRoyalMovement } from '../webapp/src/pages/Games/shared/poolRoyalHumanMovement.ts';
import { loadPoseModel } from './fixtures/poolRoyalPoseTrace.mjs';
import { readPoolRoyalMetrics } from '../scripts/read-pool-royal-metrics.mjs';

function soleHeight(human, foot) {
  const footBones = new Set();
  foot.traverse(bone => { if (bone.isBone) footBones.add(bone); });
  const vertex = new THREE.Vector3();
  let minimum = Infinity;
  human.model.traverse(mesh => {
    if (!mesh.isSkinnedMesh) return;
    const { skinIndex, skinWeight } = mesh.geometry.attributes;
    for (let i = 0; i < skinIndex.count; i++) {
      let weight = 0;
      for (let j = 0; j < 4; j++) if (footBones.has(mesh.skeleton.bones[skinIndex.getComponent(i, j)])) weight += skinWeight.getComponent(i, j);
      if (weight < 0.8) continue;
      mesh.getVertexPosition(i, vertex).applyMatrix4(mesh.matrixWorld);
      minimum = Math.min(minimum, vertex.y);
    }
  });
  return minimum;
}

test('walk routes never pass through the table, including opposite corners', () => {
  const width = 8, length = 16;
  const targets = [new THREE.Vector3(0, 0, 10), new THREE.Vector3(6, 0, 0),
    new THREE.Vector3(0, 0, -10), new THREE.Vector3(-6, 0, 0)];
  for (const start of targets) for (const end of targets) {
    const route = poolRoyalWalkRoute(start, end, width, length);
    let previous = start;
    assert.ok(route.length > 0);
    for (const point of route) {
      assert.equal(crossesPoolRoyalTable(previous, point, width / 2 + CFG.humanScale * 0.2,
        length / 2 + CFG.humanScale * 0.2), false);
      previous = point;
    }
    assert.ok(previous.distanceTo(end) < 1e-9);
  }
});

test('movement caps speed, stands before walking, and rotates across the short angle', () => {
  const movement = createPoolRoyalMovement(new THREE.Vector3(0, 0, 10), Math.PI - 0.01);
  const target = new THREE.Vector3(5, 0, 10);
  advancePoolRoyalMovement(movement, target, -Math.PI + 0.01, 8, 16, 1 / 60, 1, false);
  assert.ok(movement.root.distanceTo(new THREE.Vector3(0, 0, 10)) < 1e-9, 'stands before moving');
  assert.ok(Math.abs(shortestPoolRoyalTurn(Math.PI - 0.01, -Math.PI + 0.01) - 0.02) < 1e-9);
  for (let i = 0; i < 240; i++) {
    const before = movement.root.clone();
    advancePoolRoyalMovement(movement, target, -Math.PI + 0.01, 8, 16, 1 / 60, 0, false);
    assert.ok(movement.root.distanceTo(before) <= (1.1 * CFG.scale) / 60 + 1e-8);
  }
  assert.ok(movement.root.distanceTo(target) < 0.025 * CFG.humanScale);
  assert.equal(movement.settled, true);
});

test('actual rig walks around the table upright and settles its feet before a shot', async () => {
  const metrics = await readPoolRoyalMetrics();
  const players = new PoolRoyalHumanPlayers(new THREE.Scene(), { ...metrics, model: await loadPoseModel(), realisticMovement: true });
  await players.ready;
  const frame = { activeSeat: 'A', state: 'dragging', cueBall: new THREE.Vector3(0, metrics.ballY, 0),
    aimForward: new THREE.Vector3(0, 0, -1), power: 0.5, nowMs: 0 };
  for (let i = 0; i < 180; i++) players.update(1 / 60, { ...frame, nowMs: i * 1000 / 60 });
  assert.equal(players.readyToShoot, true);
  const human = players.players[0].human;
  const leftFoot = human.bones.leftFoot.getWorldPosition(new THREE.Vector3());
  for (let i = 0; i < 20; i++) players.update(1 / 60, { ...frame, nowMs: (180 + i) * 1000 / 60 });
  assert.ok(leftFoot.distanceTo(human.bones.leftFoot.getWorldPosition(new THREE.Vector3())) < metrics.ballR * 0.03,
    'planted foot does not breathe/slide with the torso');
  let walked = 0, upright = 0;
  for (let i = 0; i < 900; i++) {
    const before = human.root.position.clone();
    players.update(1 / 60, { ...frame, aimForward: new THREE.Vector3(0, 0, 1), nowMs: (200 + i) * 1000 / 60 });
    if (players.walking) walked++;
    if (human.root.position.distanceTo(before) > 1e-5 && human.poseT < 0.15) upright++;
    assert.equal(crossesPoolRoyalTable(before, human.root.position,
      metrics.tableW / players.referenceScale / 2, metrics.tableL / players.referenceScale / 2), false);
  }
  assert.ok(walked > 30 && upright > 30);
  assert.equal(players.readyToShoot, true);
  players.dispose();
});

test('realistic strike fixes body, bridge and both feet while the ball moves', async () => {
  const metrics = await readPoolRoyalMetrics();
  const players = new PoolRoyalHumanPlayers(new THREE.Scene(), { ...metrics, model: await loadPoseModel(), realisticMovement: true });
  await players.ready;
  const frame = { activeSeat: 'A', state: 'dragging', cueBall: new THREE.Vector3(0, metrics.ballY, metrics.tableL * 0.3),
    aimForward: new THREE.Vector3(0, 0, -1), power: 0.6, nowMs: 0 };
  for (let i = 0; i < 180; i++) players.update(1 / 60, frame);
  assert.equal(players.readyToShoot, true);
  const human = players.players[0].human;
  const names = ['hips', 'spine', 'head', 'leftHand', 'leftFoot', 'rightFoot'];
  const before = new Map(names.map(name => [name, human.bones[name].getWorldPosition(new THREE.Vector3())]));
  for (let i = 0; i < 20; i++) players.update(1 / 60, { ...frame, state: 'striking',
    cueBall: new THREE.Vector3(i, metrics.ballY, -i), aimForward: new THREE.Vector3(1, 0, 0) });
  for (const name of names) assert.ok(before.get(name).distanceTo(human.bones[name].getWorldPosition(new THREE.Vector3())) < 1e-7, name);
  const root = human.root.position.clone();
  for (let i = 0; i < 30; i++) players.update(1 / 60, { ...frame, state: 'idle', cueBall: new THREE.Vector3(i, metrics.ballY, -i) });
  assert.ok(human.root.position.distanceTo(root) < 1e-8, 'shooter stays put while balls roll');
  players.dispose();
});

test('actual shoe soles meet the floor on every side and the standing free hand points down', async () => {
  const metrics = await readPoolRoyalMetrics();
  const model = await loadPoseModel();
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const parent = new THREE.Scene();
    const players = new PoolRoyalHumanPlayers(parent, { ...metrics, model, realisticMovement: true });
    await players.ready;
    const direction = new THREE.Vector3(0, 0, -1).applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
    const frame = { activeSeat: 'A', state: 'dragging', cueBall: new THREE.Vector3(0, metrics.ballY, 0),
      aimForward: direction, power: 0.5, nowMs: 0 };
    for (let i = 0; i < 180; i++) players.update(1 / 60, frame);
    assert.equal(players.readyToShoot, true);
    parent.updateMatrixWorld(true);
    const human = players.players[0].human;
    for (const foot of [human.bones.leftFoot, human.bones.rightFoot]) {
      const clearance = soleHeight(human, foot) - metrics.floorY;
      assert.ok(clearance >= -metrics.ballR * 0.03 && clearance < metrics.ballR * 0.08,
        `sole ${foot.name}: floor clearance ${clearance} at ${yaw}`);
    }
    for (let i = 0; i < 90; i++) players.update(1 / 60, { ...frame, state: 'idle' });
    const fingers = new THREE.Vector3(0, 1, 0).applyQuaternion(human.bones.leftHand.getWorldQuaternion(new THREE.Quaternion()));
    assert.ok(fingers.y < -0.99, 'idle fingers point towards the floor, not outward in the bind pose');
    players.dispose();
  }
});
