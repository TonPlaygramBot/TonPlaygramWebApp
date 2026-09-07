import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import { PoolRoyalHumanPlayers } from '../webapp/src/pages/Games/shared/PoolRoyalHumanPlayers.ts';
import { CFG, updateHumanPose } from '../webapp/src/pages/Games/shared/poolRoyalReferenceHuman.ts';
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
    // The supplied wrist basis is intentionally preserved, including its
    // non-unit quaternions; angleTo assumes normalized inputs.
    assert.deepEqual(a.bones[key].quaternion.toArray(), b.bones[key].quaternion.toArray(), key);
    const first = flatParent.worldToLocal(a.bones[key].getWorldPosition(new THREE.Vector3()));
    const second = scaledParent.worldToLocal(b.bones[key].getWorldPosition(new THREE.Vector3()));
    assert.ok(first.distanceTo(second) < 1e-7, `${key} world position`);
  }
  assert.equal(flat.referenceScale, (options.clothY - options.floorY) / CFG.tableTopY);
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
