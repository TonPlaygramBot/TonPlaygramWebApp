import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import { PoolRoyalHumanPlayers } from '../webapp/src/pages/Games/shared/PoolRoyalHumanPlayers.ts';
import { CFG, updateHumanPose } from '../webapp/src/pages/Games/shared/poolRoyalReferenceHuman.ts';
import { bridgeSkinBounds } from '../webapp/src/pages/Games/shared/poolRoyalPlayerPose.ts';
import { readPoolRoyalMetrics } from '../scripts/read-pool-royal-metrics.mjs';
import { boneSnapshot, loadPoseModel, sampleReferenceTrace } from './fixtures/poolRoyalPoseTrace.mjs';

const options = { floorY: -3, clothY: 4, tableW: 20, tableL: 32 };
const frame = { activeSeat: 'A', state: 'dragging', cueBall: new THREE.Vector3(0, 4.3, 8),
  aimForward: new THREE.Vector3(0, 0, -1), power: 0.7, nowMs: 1000 };

test('all 67 bones match the supplied reference through idle, aim, strike and recovery on every side', async () => {
  const expected = JSON.parse(await readFile(new URL('./fixtures/poolRoyalReferencePose.json', import.meta.url)));
  const actual = await sampleReferenceTrace(updateHumanPose);
  for (const [key, snapshot] of Object.entries(expected)) {
    assert.deepEqual(actual[key], snapshot, `Reference pose drift at ${key}`);
  }
});

test('each seat has an independent skeleton and follows the active turn', async () => {
  const players = new PoolRoyalHumanPlayers(new THREE.Scene(), { ...options, model: await loadPoseModel() });
  assert.equal(await players.ready, true);
  const [a, b] = players.players;
  assert.notEqual(a.human.bones.hips, b.human.bones.hips);
  for (let i = 0; i < 60; i++) players.update(1 / 60, frame);
  assert.ok(a.human.poseT > 0.99);
  assert.equal(b.human.poseT, 0);
  for (let i = 0; i < 60; i++) players.update(1 / 60, { ...frame, activeSeat: 'B' });
  assert.ok(b.human.poseT > 0.99);
  assert.ok(a.human.poseT < 0.001);
  players.dispose();
});

test('parent scale and translation cannot change joint posing or add a visual yaw flip', async () => {
  const model = await loadPoseModel();
  const flatParent = new THREE.Group();
  const scaledParent = new THREE.Group();
  scaledParent.position.set(19, -5, 2);
  scaledParent.scale.setScalar(0.23);
  const flat = new PoolRoyalHumanPlayers(flatParent, { ...options, model });
  const scaled = new PoolRoyalHumanPlayers(scaledParent, { ...options, model });
  await Promise.all([flat.ready, scaled.ready]);
  const realNow = performance.now;
  performance.now = () => 1000;
  try {
    for (let i = 0; i < 60; i++) {
      flat.update(1 / 60, frame);
      scaled.update(1 / 60, frame);
    }
  } finally { performance.now = realNow; }
  flatParent.updateMatrixWorld(true);
  scaledParent.updateMatrixWorld(true);
  const a = flat.players[0].human;
  const b = scaled.players[0].human;
  assert.equal(a.model.rotation.y, Math.PI);
  assert.ok(Math.abs(a.yaw) < 1e-10);
  for (const key of Object.keys(a.bones)) {
    // Compare exact components; the untouched reference right wrist retains
    // its original basis while the calibrated bridge uses unit rotations.
    assert.deepEqual(a.bones[key].quaternion.toArray(), b.bones[key].quaternion.toArray(), key);
    const first = flatParent.worldToLocal(a.bones[key].getWorldPosition(new THREE.Vector3()));
    const second = scaledParent.worldToLocal(b.bones[key].getWorldPosition(new THREE.Vector3()));
    assert.ok(first.distanceTo(second) < 1e-7, `${key} world position`);
  }
  assert.equal(flat.humanHeight, options.tableL * 0.82);
  flat.dispose(); scaled.dispose();
});

test('striking freezes the root and yaw even when the aim and ball move', async () => {
  const players = new PoolRoyalHumanPlayers(new THREE.Scene(), { ...options, model: await loadPoseModel() });
  await players.ready;
  for (let i = 0; i < 30; i++) players.update(1 / 60, frame);
  players.update(1 / 60, { ...frame, state: 'striking' });
  const human = players.players[0].human;
  const start = human.root.position.clone();
  const yaw = human.yaw;
  for (let i = 0; i < 7; i++) players.update(1 / 60, { ...frame, state: 'striking',
    cueBall: new THREE.Vector3(12, 4.3, -8), aimForward: new THREE.Vector3(1, 0, 0) });
  assert.ok(human.root.position.distanceTo(start) < 1e-10);
  assert.equal(human.yaw, yaw);
  players.dispose();
});

test('hidden replay frames and disposal leave no stale visible or late-loading players', async () => {
  const parent = new THREE.Scene();
  const model = await loadPoseModel();
  const players = new PoolRoyalHumanPlayers(parent, { ...options, model });
  await players.ready;
  players.update(1 / 60, frame);
  const pose = boneSnapshot(players.players[0].human);
  players.update(1 / 60, { ...frame, hidden: true });
  assert.equal(players.group.visible, false);
  assert.deepEqual(boneSnapshot(players.players[0].human), pose);
  players.dispose();
  assert.equal(parent.children.length, 0);
  const late = new PoolRoyalHumanPlayers(parent, { ...options, model });
  late.dispose();
  assert.equal(await late.ready, false);
  assert.equal(parent.children.length, 0);
});


test('production-table calibration makes the original model smaller without changing its proportions', async () => {
  const metrics = await readPoolRoyalMetrics();
  const parent = new THREE.Scene();
  const players = new PoolRoyalHumanPlayers(parent, { ...metrics, model: await loadPoseModel() });
  await players.ready; parent.updateMatrixWorld(true);
  const height = new THREE.Box3().setFromObject(players.players[0].human.modelRoot).getSize(new THREE.Vector3()).y;
  const oldScale = (metrics.clothY - metrics.floorY) / CFG.tableTopY;
  assert.ok(players.referenceScale / oldScale > 0.69 && players.referenceScale / oldScale < 0.75);
  assert.ok(Math.abs(height - metrics.tableL * 0.82) < 1e-6);
  assert.ok(height / (metrics.clothY - metrics.floorY) > 1.8);
  assert.equal(players.group.scale.x, players.group.scale.y);
  assert.equal(players.group.scale.y, players.group.scale.z);
  players.dispose();
});

test('bridge skin rests on the actual cloth with unit wrist rotations through headings and power changes', async () => {
  const metrics = await readPoolRoyalMetrics();
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const parent = new THREE.Scene();
    const players = new PoolRoyalHumanPlayers(parent, { ...metrics, model: await loadPoseModel() });
    await players.ready;
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
    const ball = new THREE.Vector3(0, metrics.ballY, 0);
    for (const power of [0, 0.55, 1]) {
      const cueTip = ball.clone().addScaledVector(forward, -(metrics.cueGap + metrics.cuePull * power));
      const cueBack = cueTip.clone().addScaledVector(forward, -metrics.cueLength).setY(cueTip.y + metrics.cueButtLift);
      for (let i = 0; i < 90; i++) players.update(1 / 60, { ...frame, cueBall: ball, aimForward: forward, power, cueBack, cueTip });
      parent.updateMatrixWorld(true);
      const human = players.players[0].human;
      const bounds = bridgeSkinBounds(human);
      const clearance = bounds.min.y - metrics.clothY;
      assert.ok(clearance >= -metrics.ballR * 0.03 && clearance < metrics.ballR * 0.15, `skin clearance ${clearance} at ${yaw}, ${power}`);
      const q = human.bones.leftHand.getWorldQuaternion(new THREE.Quaternion());
      assert.ok(Math.abs(q.length() - 1) < 1e-7);
      const fingerAxis = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
      assert.ok(fingerAxis.dot(forward) > 0.999, 'fingers point along the shot');
      const eye = players.eyeView;
      assert.ok(eye && eye.position.y > metrics.clothY + metrics.ballR);
      assert.ok(eye.position.y < metrics.clothY + metrics.ballR * 6);
      assert.ok(ball.clone().sub(eye.position).dot(forward) > metrics.ballR * 2, 'eyes stay behind the cue ball');
    }
    players.dispose();
  }
});

test('eye camera uses the actual eyes under a transformed parent and restores both heads outside player view', async () => {
  const metrics = await readPoolRoyalMetrics();
  const parent = new THREE.Group(); parent.position.set(11, -20, 6); parent.scale.setScalar(0.21);
  const players = new PoolRoyalHumanPlayers(parent, { ...metrics, model: await loadPoseModel() });
  await players.ready;
  const ball = new THREE.Vector3(0, metrics.ballY, metrics.tableL * 0.31);
  for (let i = 0; i < 90; i++) players.update(1 / 60, { ...frame, cueBall: ball });
  const human = players.players[0].human;
  const eye = human.model.getObjectByName('LeftEye').getWorldPosition(new THREE.Vector3())
    .lerp(human.model.getObjectByName('RightEye').getWorldPosition(new THREE.Vector3()), 0.5);
  parent.worldToLocal(eye).addScaledVector(frame.aimForward, (ball.y - metrics.clothY) * 1.15);
  assert.ok(eye.distanceTo(players.eyeView.position) < 1e-7);
  players.setFirstPerson(true, 'A');
  assert.ok(players.players[0].headMeshes.every(mesh => !mesh.visible));
  assert.ok(players.players[1].headMeshes.every(mesh => mesh.visible));
  players.setFirstPerson(true, 'B');
  assert.ok(players.players[0].headMeshes.every(mesh => mesh.visible));
  players.setFirstPerson(false, 'B');
  assert.ok(players.players.every(player => player.headMeshes.every(mesh => mesh.visible)));
  players.update(1 / 60, { ...frame, hidden: true });
  assert.equal(players.eyeView, null);
  players.dispose();
});


test('the live cue axis clears the bridge skin at address', async () => {
  const metrics = await readPoolRoyalMetrics(), parent = new THREE.Scene();
  const players = new PoolRoyalHumanPlayers(parent, { ...metrics, model: await loadPoseModel() });
  await players.ready;
  const ball = new THREE.Vector3(0, metrics.ballY, metrics.tableL * 0.31);
  const cueTip = ball.clone().addScaledVector(frame.aimForward, -metrics.cueGap);
  const cueBack = cueTip.clone().addScaledVector(frame.aimForward, -metrics.cueLength).setY(cueTip.y + metrics.cueButtLift);
  for (let i = 0; i < 90; i++) players.update(1 / 60, { ...frame, cueBall: ball, power: 0, cueBack, cueTip });
  parent.updateMatrixWorld(true);
  const human = players.players[0].human;
  const hand = new Set([human.bones.leftHand, ...human.leftFingers]);
  const ray = new THREE.Ray(cueBack, cueTip.clone().sub(cueBack).normalize());
  let checked = 0;
  human.model.traverse(mesh => {
    if (!mesh.isSkinnedMesh || !mesh.geometry.index) return;
    const { skinIndex, skinWeight } = mesh.geometry.attributes;
    const vertices = new Map();
    for (let i = 0; i < skinIndex.count; i++) {
      let weight = 0;
      for (let j = 0; j < 4; j++) if (hand.has(mesh.skeleton.bones[skinIndex.getComponent(i, j)])) weight += skinWeight.getComponent(i, j);
      if (weight > 0.8) vertices.set(i, mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld));
    }
    const indices = mesh.geometry.index;
    for (let i = 0; i < indices.count; i += 3) {
      const triangle = [0, 1, 2].map(j => vertices.get(indices.getX(i + j)));
      if (triangle.some(vertex => !vertex)) continue;
      checked++;
      const hit = ray.intersectTriangle(...triangle, false, new THREE.Vector3());
      assert.ok(!hit || hit.distanceTo(cueBack) >= cueBack.distanceTo(cueTip), 'cue passes through bridge skin');
    }
  });
  assert.ok(checked > 100, 'check the actual skinned hand triangles');
  players.dispose();
});
