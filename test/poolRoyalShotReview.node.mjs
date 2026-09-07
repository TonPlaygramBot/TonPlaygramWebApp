import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import { PoolRoyalShotCamera } from '../webapp/src/pages/Games/shared/poolRoyalShotCamera.ts';
import { createPoolRoyalCue, posePoolRoyalCue } from '../webapp/src/pages/Games/shared/createPoolRoyalCue.ts';
import { PoolRoyalHumanPlayers } from '../webapp/src/pages/Games/shared/PoolRoyalHumanPlayers.ts';
import { loadPoseModel } from './fixtures/poolRoyalPoseTrace.mjs';

test('AI and human strokes override broadcast camera ownership and retain the eyes through impact', () => {
  for (const cueBlend of [0, 0.9, 1]) {
    const camera = new PoolRoyalShotCamera();
    const eye = { position: new THREE.Vector3(0, 5, 9), target: new THREE.Vector3(0, 4, 0), blend: 0.9 };
    const shot = camera.resolve({ eye, stroke: true, shooting: true, cueBlend, now: 100 });
    assert.equal(shot.blend, 1); assert.deepEqual(shot.position, eye.position);
    eye.position.x = 100; // held camera must not follow the standing animation after the shot
    const held = camera.resolve({ eye: null, stroke: false, shooting: true, cueBlend, now: 500 });
    assert.equal(held.position.x, 0); assert.equal(held.blend, 1);
    assert.ok(camera.resolve({ eye: null, stroke: false, shooting: true, cueBlend, now: 850 }).blend < 1);
    assert.equal(camera.resolve({ eye, stroke: false, shooting: true, cueBlend, now: 1100 }), null);
    assert.equal(camera.resolve({ eye, stroke: true, shooting: true, cueBlend, now: 1200, excluded: true }), null);
  }
});

test('the original cue tip and butt align exactly for all shot headings', () => {
  const cue = createPoolRoyalCue({ ballRadius: 1, length: 38, tipRadius: 0.17 });
  const bounds = new THREE.Box3().setFromObject(cue.body);
  assert.ok(Math.abs(bounds.min.z - cue.tipLocal.z) < 1e-6, 'tip marker must match the actual leather cap surface');
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const back = new THREE.Vector3(Math.sin(yaw) * 10, 8, Math.cos(yaw) * 10);
    const tip = new THREE.Vector3(0, 7, 0);
    posePoolRoyalCue(cue.body, back, tip, cue.tipLocal, cue.buttLocal);
    cue.body.updateMatrixWorld(true);
    assert.ok(cue.body.localToWorld(cue.tipLocal.clone()).distanceTo(tip) < 1e-8);
    assert.ok(cue.body.localToWorld(cue.buttLocal.clone()).distanceTo(back) < 1e-8);
  }
});

test('both holders use the selected game cue, and camera occlusion restores heads and shared resources', async () => {
  const scene = new THREE.Scene();
  const players = new PoolRoyalHumanPlayers(scene, { floorY: 0, clothY: 4, tableW: 5.4, tableL: 9,
    model: await loadPoseModel() });
  const cue = createPoolRoyalCue({ ballRadius: 0.12, length: 4.5, tipRadius: 0.02 });
  // Set before asynchronous avatar loading to exercise the real scene construction order.
  players.setCueAppearance(cue.body, cue.tipLocal, cue.buttLocal);
  await players.ready;
  for (let i=0;i<60;i++) players.update(1/60, { activeSeat: 'B', state: 'dragging',
    cueBall: new THREE.Vector3(0,4.12,2.7), aimForward: new THREE.Vector3(0,0,-1), power: 0.5, nowMs: 1000 });
  assert.equal(players.players.length, 2);
  for (const player of players.players) {
    assert.equal(player.cue.group.visible, false); assert.ok(player.cueModel);
    const wood = player.cueModel.children.find(child => child.material === cue.shaftMaterial);
    assert.ok(wood); cue.shaftMaterial.color.setHex(0x123456); assert.equal(wood.material.color.getHex(), 0x123456);
  }
  const b = players.players[1];
  const head = b.human.bones.head.getWorldPosition(new THREE.Vector3());
  const camera = new THREE.PerspectiveCamera(); camera.position.copy(head).add(new THREE.Vector3(0, 0, 0.25));
  players.updateCameraVisibility(camera, head.clone().add(new THREE.Vector3(0,0,-5)));
  assert.ok(b.headMeshes.every(mesh => !mesh.visible));
  camera.position.set(30,30,30); players.updateCameraVisibility(camera, new THREE.Vector3(0,4,0));
  assert.ok(players.players.every(player => player.headMeshes.every(mesh => mesh.visible)));
  let disposed = false; cue.shaftMaterial.addEventListener('dispose', () => disposed = true);
  players.dispose(); assert.equal(disposed, false);
});
