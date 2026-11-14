import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import { SnookerRoyalShotCamera } from '../webapp/src/pages/Games/snookerRoyalShotCamera.ts';

test('address stays fixed during backswing, contact and follow-through despite animation movement', () => {
  const camera = new SnookerRoyalShotCamera();
  const eye = { position: new THREE.Vector3(4, 8, -15), target: new THREE.Vector3(4, 2, 10), blend: 1 };
  const address = { position: eye.position.clone(), target: eye.target.clone(), blend: 1 };
  camera.beginShot(eye, eye);
  const resolve = (now, stroke, impactPending) => camera.resolve({
    eye, now, stroke, impactPending, shooting: true, cueBlend: 0
  });
  for (const now of [0, 17, 100, 230]) {
    eye.position.add(new THREE.Vector3(2, 1, -1));
    eye.target.x += 5;
    assert.deepEqual(resolve(now, true, true), address);
  }
  camera.markImpact(250, eye);
  assert.deepEqual(resolve(251, true, false), address, 'contact does not resnapshot a moving head');
  assert.deepEqual(resolve(1149, false, false), address);
  assert.deepEqual(resolve(1150, false, false), address);
  assert.deepEqual(resolve(30000, false, false), address, 'a long shot stays at the original player viewpoint');
  assert.equal(camera.isBroadcasting, false);
  assert.equal(camera.resolve({ eye: null, now: 30001, stroke: false, impactPending: false,
    shooting: false, cueBlend: 0 }), null);
  assert.equal(camera.isHoldingShot, false, 'release only after the stroke and ball motion finish');
});
