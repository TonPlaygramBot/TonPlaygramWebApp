import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import { resolvePoolRoyalAddressState } from '../webapp/src/pages/Games/shared/poolRoyalAddress.ts';
import { PoolRoyalHumanPlayers, choosePoolRoyalStance } from '../webapp/src/pages/Games/shared/PoolRoyalHumanPlayers.ts';
import { PoolRoyalShotCamera } from '../webapp/src/pages/Games/shared/poolRoyalShotCamera.ts';
import { PoolRoyalPocketLights } from '../webapp/src/pages/Games/shared/poolRoyalPocketLights.ts';
import { readPoolRoyalMetrics } from '../scripts/read-pool-royal-metrics.mjs';
import { loadPoseModel } from './fixtures/poolRoyalPoseTrace.mjs';

const m = await readPoolRoyalMetrics();
const ready = { ballsMoving: false, gameOver: false, ballInHand: false, breakReady: true };

test('the player addresses the cue ball immediately on the aiming turn, independent of power', async () => {
  assert.equal(resolvePoolRoyalAddressState(ready), 'dragging');
  for (const blocked of [{ ballsMoving: true }, { gameOver: true }, { ballInHand: true }, { breakReady: false }]) {
    assert.equal(resolvePoolRoyalAddressState({ ...ready, ...blocked }), 'idle');
  }
  assert.equal(resolvePoolRoyalAddressState({ ...ready, ballsMoving: true, stroke: { phase: 'pullback' } }), 'dragging');
  assert.equal(resolvePoolRoyalAddressState({ ...ready, ballsMoving: true, stroke: { phase: 'strike' } }), 'striking');
  const players = new PoolRoyalHumanPlayers(new THREE.Scene(), { ...m, model: await loadPoseModel(), realisticMovement: true });
  assert.ok(await players.ready);
  const input = { activeSeat: 'A', state: resolvePoolRoyalAddressState(ready), power: 0, nowMs: 1000,
    cueBall: new THREE.Vector3(0, m.ballY, m.tableL * .31), aimForward: new THREE.Vector3(0, 0, -1) };
  for (let i = 0; i < 130; i++) players.update(1 / 60, input);
  assert.equal(players.readyToShoot, true, 'already settled before a slider or Shoot press');
  const human = players.players[0].human;
  const body = human.modelRoot.position.clone();
  const eyes = players.eyeView.position.clone();
  const camera = new PoolRoyalShotCamera(.55);
  const pose = camera.resolve({ eye: players.eyeView, stroke: false, shooting: false, aiming: true, cueBlend: 1, now: 0 });
  assert.equal(pose.blend, 1);
  assert.ok(pose.position.distanceTo(eyes) < 1e-8);
  players.update(1 / 60, { ...input, state: 'striking', power: .6 });
  assert.ok(human.modelRoot.position.distanceTo(body) < 1e-7, 'Shoot cannot move the shooter towards the cue ball');
  assert.equal(camera.resolve({ eye: players.eyeView, stroke: false, shooting: false, aiming: true, cueBlend: 1, now: 1, excluded: true }), null);
  players.dispose();
});

test('close-rail stance removes the minimum retreat while keeping the hips outside the frame', () => {
  const cue = new THREE.Vector3(0, 0, 8), forward = new THREE.Vector3(0, 0, -1);
  const old = choosePoolRoyalStance(cue, forward, 9, 17);
  const next = choosePoolRoyalStance(cue, forward, 9, 17, true);
  assert.ok(next.distanceTo(cue) < old.distanceTo(cue) * .6);
  assert.ok(next.z > 17 / 2);
});

test('six pocket halos use two stable shadow-free uplights beneath the raised ball', () => {
  const scene = new THREE.Scene(); scene.scale.setScalar(.2);
  const lights = new PoolRoyalPocketLights(scene, { radius: 2, clothY: 4, popupY: 10 });
  const ids = lights.lights.map(light => light.uuid);
  for (let index = 0; index < 6; index++) lights.pulse(index, { x: index * 3, y: index * 5 }, 100 + index);
  lights.update(250);
  assert.equal(lights.halos.filter(halo => halo.visible).length, 6);
  assert.deepEqual(lights.lights.map(light => light.uuid), ids);
  assert.equal(lights.lights[0].position.x, 15);
  assert.equal(lights.lights[0].position.z, 25);
  for (const light of lights.lights) {
    assert.ok(light.position.y > 4 && light.position.y < 10 - 2);
    assert.equal(light.castShadow, false);
    assert.ok(Math.abs(light.distance - .4 * 9) < 1e-10, 'distance follows table world scale');
    assert.ok(Math.abs(light.intensity - .4 ** 2 * 14) < 1e-10);
  }
  const peak = lights.lights[0].intensity;
  lights.update(2400); assert.ok(lights.lights[0].intensity < peak);
  lights.update(2700); assert.ok(lights.lights.every(light => light.intensity === 0));
  assert.ok(lights.halos.every(halo => !halo.visible));
  // Delayed popup restarts the same pocket after the capture camera finishes.
  lights.pulse(2, { x: 6, y: 10 }, 5000); lights.update(5150);
  assert.ok(lights.halos[2].visible);
  let geometryDisposed = 0, materialsDisposed = 0;
  lights.halos[0].geometry.addEventListener('dispose', () => geometryDisposed++);
  lights.halos.forEach(halo => halo.material.addEventListener('dispose', () => materialsDisposed++));
  lights.dispose();
  assert.equal(geometryDisposed, 1); assert.equal(materialsDisposed, 6);
  assert.equal(scene.children.length, 0);
});
