import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import { PoolRoyalHumanPlayers } from '../webapp/src/pages/Games/shared/PoolRoyalHumanPlayers.ts';
import { readPoolRoyalMetrics } from '../scripts/read-pool-royal-metrics.mjs';
import { loadPoseModel } from './fixtures/poolRoyalPoseTrace.mjs';

// Independent mesh-triangle checks exercise final IK, skinning and parent transforms.
function handTriangles(human) {
  const triangles = [];
  const hand = new Set([human.bones.leftHand, ...human.leftFingers]);
  human.model.traverse(mesh => {
    if (!mesh.isSkinnedMesh) return;
    const { skinIndex, skinWeight } = mesh.geometry.attributes;
    const vertices = new Map();
    const selected = new Set();
    for (let i = 0; i < skinIndex.count; i++) {
      let weight = 0;
      for (let j = 0; j < 4; j++) if (hand.has(mesh.skeleton.bones[skinIndex.getComponent(i, j)])) weight += skinWeight.getComponent(i, j);
      if (weight > 0.5) selected.add(i);
    }
    const index = mesh.geometry.index;
    for (let i = 0; i < (index?.count ?? skinIndex.count); i += 3) {
      const ids = [0, 1, 2].map(j => index ? index.getX(i + j) : i + j);
      if (!ids.some(id => selected.has(id))) continue;
      const points = ids.map(id => {
        if (!vertices.has(id)) vertices.set(id, mesh.getVertexPosition(id, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld));
        return vertices.get(id);
      });
      triangles.push(new THREE.Triangle(...points));
    }
  });
  assert.ok(triangles.length > 100);
  return triangles;
}

function assertClear(human, environment, label) {
  const closest = new THREE.Vector3();
  for (const triangle of handTriangles(human)) {
    for (const ball of environment.obstacles) {
      triangle.closestPointToPoint(ball.position, closest);
      assert.ok(closest.distanceTo(ball.position) > ball.radius + 0.001, `${label}: ball touches hand`);
    }
    for (const vertex of [triangle.a, triangle.b, triangle.c]) {
      assert.ok(vertex.y >= environment.clothY - 1e-6, `${label}: skin enters cloth`);
      const outside = Math.abs(vertex.x) > environment.bounds.halfWidth || Math.abs(vertex.z) > environment.bounds.halfLength;
      assert.ok(!outside || vertex.y > environment.bounds.cushionTopY, `${label}: skin enters cushion`);
    }
  }
}

for (const seat of ['A', 'B']) test(`${seat}: actual hand skin clears balls and both cushion faces through poses and strikes`, async () => {
  const m = await readPoolRoyalMetrics(), model = await loadPoseModel();
  const parent = new THREE.Scene();
  const players = new PoolRoyalHumanPlayers(parent, { ...m, followPlayerEyes: true, model });
  await players.ready;
  const bounds = { halfWidth: m.bridgeHalfW, halfLength: m.bridgeHalfL, cushionTopY: m.railTopY };
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2, Math.PI / 4]) {
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
    const side = new THREE.Vector3(forward.z, 0, -forward.x);
    const rear = Math.min(Math.abs(forward.x) > 1e-6 ? (bounds.halfWidth - m.ballR * 1.1) / Math.abs(forward.x) : Infinity,
      Math.abs(forward.z) > 1e-6 ? (bounds.halfLength - m.ballR * 1.1) / Math.abs(forward.z) : Infinity);
    for (const layout of ['open', 'cluster', 'rail', 'corner']) {
      const ball = forward.clone().multiplyScalar(-rear * (layout === 'rail' || layout === 'corner' ? 1 : 0.62)).setY(m.ballY);
      if (layout === 'corner') {
        ball.x = Math.sign(ball.x || -1) * (bounds.halfWidth - m.ballR * 1.1);
        ball.z = Math.sign(ball.z || 1) * (bounds.halfLength - m.ballR * 1.1);
      }
      const obstacles = [{ position: ball, radius: m.ballR }];
      if (layout === 'cluster') for (let i = 0; i < 3; i++) obstacles.push({
        position: ball.clone().addScaledVector(forward, -m.ballR * (6 + i * 2.2)).addScaledVector(side, m.ballR * 2.4), radius: m.ballR
      });
      const tip = ball.clone().addScaledVector(forward, -m.cueGap);
      const back = tip.clone().addScaledVector(forward, -m.cueLength).setY(tip.y + m.cueButtLift);
      const frame = { activeSeat: seat, state: 'dragging', cueBall: ball, aimForward: forward, power: 0.5,
        nowMs: 1000, cueBack: back, cueTip: tip, bridgeObstacles: obstacles, bridgeBounds: bounds };
      for (let i = 0; i < 65; i++) {
        players.update(1 / 60, frame); parent.updateMatrixWorld(true);
        if ([0, 4, 12, 64].includes(i)) assertClear(players.players[seat === 'A' ? 0 : 1].human, { obstacles, bounds, clothY: m.clothY }, `${layout}/${yaw}/${i}`);
      }
      for (const pull of [0, m.cuePull, 0]) {
        players.update(1 / 60, { ...frame, state: 'striking', cueBack: back.clone().addScaledVector(forward, -pull), cueTip: tip.clone().addScaledVector(forward, -pull) });
        parent.updateMatrixWorld(true);
        assertClear(players.players[seat === 'A' ? 0 : 1].human, { obstacles, bounds, clothY: m.clothY }, `${layout}/${yaw}/stroke`);
      }
    }
  }
  players.dispose();
});

test('standing and walking camera stays at the eye midpoint under a transformed parent', async () => {
  const m = await readPoolRoyalMetrics(), parent = new THREE.Group();
  parent.position.set(8, -2, 4); parent.scale.setScalar(0.3); parent.rotation.y = 0.4;
  const players = new PoolRoyalHumanPlayers(parent, { ...m, followPlayerEyes: true, model: await loadPoseModel() });
  await players.ready;
  for (const state of ['idle', 'dragging', 'striking', 'idle']) for (let i = 0; i < 30; i++) {
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(THREE.Object3D.DEFAULT_UP, i * 0.04);
    players.update(1 / 60, { activeSeat: 'A', state, cueBall: new THREE.Vector3(i * 0.05, m.ballY, m.tableL * 0.31), aimForward: forward, power: 0.5, nowMs: i * 16 });
    parent.updateMatrixWorld(true);
    const model = players.players[0].human.model;
    const eye = model.getObjectByName('LeftEye').getWorldPosition(new THREE.Vector3())
      .lerp(model.getObjectByName('RightEye').getWorldPosition(new THREE.Vector3()), 0.5);
    assert.ok(parent.worldToLocal(eye).distanceTo(players.eyeView.position) < 1e-7);
  }
  players.dispose();
});
