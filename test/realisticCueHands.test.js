import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../webapp/node_modules/three/build/three.cjs';
import {
  cueHandSmoothingAlpha,
  prepareRealisticCueHandFrame,
  resolveCueFingerPose
} from '../webapp/src/pages/Games/shared/realisticCueHands.js';

test('cue hand smoothing alpha is stable and frame-rate safe', () => {
  assert.equal(cueHandSmoothingAlpha(20, 0), 0);
  assert.ok(cueHandSmoothingAlpha(20, 1 / 60) > 0);
  assert.ok(cueHandSmoothingAlpha(20, 1 / 30) > cueHandSmoothingAlpha(20, 1 / 60));
  assert.ok(cueHandSmoothingAlpha(20, 1) < 1);
});

test('relaxed grip is looser than firm grip', () => {
  const relaxed = resolveCueFingerPose('RightHandIndex2', 'grip', 1, 'relaxed');
  const firm = resolveCueFingerPose('RightHandIndex2', 'grip', 1, 'firm');
  assert.ok(relaxed.x > 0);
  assert.ok(firm.x > relaxed.x);
});

test('open bridge raises thumb toward index and spreads outer fingers', () => {
  const thumb = resolveCueFingerPose('LeftHandThumb1', 'bridge', 1, 'open');
  const pinky = resolveCueFingerPose('LeftHandPinky1', 'bridge', 1, 'open');
  assert.ok(thumb.y > 0);
  assert.ok(thumb.z < 0);
  assert.ok(pinky.y > 0);
  assert.ok(pinky.z > 0);
});

test('closed bridge loops index farther than open bridge', () => {
  const openIndex = resolveCueFingerPose('LeftHandIndex2', 'bridge', 1, 'open');
  const closedIndex = resolveCueFingerPose('LeftHandIndex2', 'bridge', 1, 'closed');
  assert.ok(closedIndex.x > openIndex.x);
});

test('hand target preparation smooths copies without mutating game vectors', () => {
  const human = { cfg: {} };
  const bridgeTarget = new THREE.Vector3(1, 2, 3);
  const frame = {
    state: 'dragging',
    bridgeTarget,
    idleLeft: new THREE.Vector3(0, 1, 0),
    idleRight: new THREE.Vector3(0, 1, 1)
  };

  const first = prepareRealisticCueHandFrame(human, 1 / 60, frame);
  assert.notEqual(first.bridgeTarget, bridgeTarget);
  assert.deepEqual(bridgeTarget.toArray(), [1, 2, 3]);

  const moved = { ...frame, bridgeTarget: new THREE.Vector3(2, 2, 3) };
  const second = prepareRealisticCueHandFrame(human, 1 / 60, moved);
  assert.ok(second.bridgeTarget.x > 1);
  assert.ok(second.bridgeTarget.x < 2);
});
