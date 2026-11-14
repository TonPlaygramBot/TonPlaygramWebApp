import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { parse } from '@babel/parser';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import {
  SnookerRoyalShotCamera,
  snookerRoyalFallbackEye,
  SNOOKER_PLAYER_SHOT_FOV,
  SNOOKER_CUE_BALL_SCREEN_Y
} from '../webapp/src/pages/Games/snookerRoyalShotCamera.ts';
import { captureRoyalPlayerView, royalCameraBlendFromDrag } from '../webapp/src/pages/Games/shared/royalCameraControls.ts';

const source = await readFile(new URL('../webapp/src/pages/Games/SnookerRoyal.jsx', import.meta.url), 'utf8');
const callbacks = new Map();
let beginShot;
function walk(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'VariableDeclarator' && node.id?.name) callbacks.set(node.id.name, node.init);
  if (node.type === 'CallExpression' && node.callee.object?.name === 'humanShotCamera' &&
      node.callee.property?.name === 'beginShot') beginShot = node;
  for (const child of Object.values(node)) {
    if (Array.isArray(child)) child.forEach(walk);
    else if (child?.type) walk(child);
  }
}
walk(parse(source, { sourceType: 'module', plugins: ['jsx'] }));

test('player shot is straight down the cue line in portrait at every heading and table scale', () => {
  for (const scale of [.23, .42, .65, 1, 1.2]) {
    const world = new THREE.Group();
    world.scale.setScalar(scale); world.position.set(7, -4, 11); world.rotation.y = .37;
    for (const yaw of [0, Math.PI / 4, Math.PI / 2, Math.PI, -Math.PI / 2, -Math.PI * .75]) {
      const ball = new THREE.Vector3(20, 24, -36);
      const direction = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
      const ballBefore = ball.clone(), forwardBefore = direction.clone();
      const pose = snookerRoyalFallbackEye(ball, direction, 30, 1);
      assert.ok(pose.position.clone().sub(ball).dot(direction) < 0, 'lens is behind the player shot');
      assert.ok(pose.position.y > ball.y + 1, 'lens stays above the ball and cloth');
      assert.ok(Math.abs(pose.position.clone().sub(ball).dot(new THREE.Vector3(-direction.z, 0, direction.x))) < 1e-10,
        'no lateral lens offset');
      for (const width of [320, 390, 430]) {
        const camera = new THREE.PerspectiveCamera(SNOOKER_PLAYER_SHOT_FOV, width / 844, .01, 4000);
        camera.position.copy(world.localToWorld(pose.position.clone()));
        camera.lookAt(world.localToWorld(pose.target.clone())); camera.updateMatrixWorld(true);
        const cueScreen = world.localToWorld(ball.clone()).project(camera);
        assert.ok(Math.abs(cueScreen.x) < 1e-8, 'cue ball is horizontally centered on the phone');
        assert.ok(Math.abs(cueScreen.y - SNOOKER_CUE_BALL_SCREEN_Y) < 1e-8, 'ball stays below the middle of the phone');
        assert.ok(cueScreen.z > -1 && cueScreen.z < 1);
        for (const edge of [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)]) {
          for (const sign of [-1, 1]) {
            const screen = world.localToWorld(ball.clone().addScaledVector(edge, sign)).project(camera);
            assert.ok(Math.abs(screen.x) < .9 && Math.abs(screen.y) < .8,
              'the complete cue ball fits inside the portrait screen and clears bottom controls');
          }
        }
        const ahead = world.localToWorld(ball.clone().addScaledVector(direction, 12)).project(camera);
        assert.ok(ahead.y > cueScreen.y && ahead.y < 1, 'shot travels visually up the phone screen');
      }
      assert.deepEqual(ball, ballBefore); assert.deepEqual(direction, forwardBefore);
    }
  }
});

function liveRig(localSeat = 'A') {
  const world = new THREE.Group();
  world.scale.setScalar(.65); world.position.y = -4;
  const cue = { mesh: new THREE.Object3D() }; cue.mesh.position.set(4, 24, -9); world.add(cue.mesh);
  const sideCamera = new THREE.PerspectiveCamera(30, 390 / 844, .01, 1000);
  sideCamera.position.set(100, 10, 0);
  const c = {
    THREE, world, cue, cueLen: 30, BALL_R: 1,
    humanShotCamera: new SnookerRoyalShotCamera(), snookerRoyalFallbackEye, captureRoyalPlayerView,
    aimDirRef: { current: new THREE.Vector2(0, 1) },
    activeRenderCameraRef: { current: sideCamera }, lastCameraTargetRef: { current: new THREE.Vector3() },
    topViewRef: { current: false }, lookModeRef: { current: false }, replayPlaybackRef: { current: false },
    cueGalleryStateRef: { current: null }, frameRef: { current: { activePlayer: localSeat } },
    localSeatRef: { current: localSeat }, characterShotShooter: localSeat,
    shootingRef: { current: true }, cueAnimating: true, shotImpactPending: true,
    cameraBlendRef: { current: 0 }, performance: { now: () => c.now }, now: 0
  };
  vm.createContext(c);
  c.begin = () => vm.runInContext(source.slice(beginShot.start, beginShot.end), c);
  const resolver = callbacks.get('resolveActiveHumanEyePose');
  c.resolve = vm.runInContext(`(${source.slice(resolver.start, resolver.end)})`, c);
  return c;
}

test('actual shot callback cannot capture a side/orbit view and never follows moving balls', () => {
  for (const seat of ['A', 'B']) {
    const rig = liveRig(seat); rig.begin();
    const expected = snookerRoyalFallbackEye(rig.cue.mesh.position, new THREE.Vector3(0, 0, 1), 30, 1);
    const initial = rig.resolve();
    assert.deepEqual(initial.position, rig.world.localToWorld(expected.position.clone()));
    assert.deepEqual(initial.target, rig.world.localToWorld(expected.target.clone()));
    assert.equal(initial.fov, SNOOKER_PLAYER_SHOT_FOV);
    rig.humanShotCamera.markImpact(250); rig.shotImpactPending = false; rig.cueAnimating = false;
    rig.frameRef.current.activePlayer = seat === 'A' ? 'B' : 'A';
    for (const now of [251, 1150, 5000, 30000]) {
      rig.now = now;
      rig.cue.mesh.position.set(-20, -40, 80); // A scratch also cannot steal the camera.
      rig.aimDirRef.current.set(1, 0);
      assert.deepEqual(rig.resolve(), initial);
      assert.equal(rig.humanShotCamera.isBroadcasting, false);
    }
    rig.shootingRef.current = false;
    assert.equal(rig.resolve(), null);
    assert.equal(rig.humanShotCamera.isHoldingShot, false);
  }
});

test('manual overview, look, replay and gallery can temporarily override the held shot', () => {
  const rig = liveRig(); rig.begin();
  const initial = rig.resolve(); rig.cueAnimating = false; rig.shotImpactPending = false;
  for (const ref of ['topViewRef', 'lookModeRef', 'replayPlaybackRef', 'cueGalleryStateRef']) {
    rig[ref].current = ref === 'cueGalleryStateRef' ? { active: true } : true;
    rig.now += 5000;
    assert.equal(rig.resolve(), null);
    rig[ref].current = false;
    assert.deepEqual(rig.resolve(), initial, 'return to the exact player viewpoint even after 900 ms');
  }
});

test('AI and remote shots keep spectator ownership on either local seat', () => {
  for (const localSeat of ['A', 'B']) {
    const rig = liveRig(localSeat); rig.begin();
    rig.characterShotShooter = localSeat === 'A' ? 'B' : 'A';
    assert.equal(rig.resolve(), null);
    assert.equal(rig.humanShotCamera.isHoldingShot, false);
  }
});

test('shot framing leaves mobile standing-to-cue drag direction unchanged', () => {
  assert.ok(royalCameraBlendFromDrag(.5, 80, 844) < .5, 'drag visually down lowers the view');
  assert.ok(royalCameraBlendFromDrag(.5, -80, 844) > .5, 'drag visually up stands up');
});

test('delayed AI cue-view timer cannot fire after turn, frame or scene state changes', () => {
  const node = callbacks.get('beginCueView');
  for (const phase of ['before', 'after']) for (const invalidation of ['none', 'wrong-turn', 'finished', 'disposed', 'shooting']) {
    let scheduled, fired = 0, cameraUpdates = 0;
    const c = {
      disposed: false, hudRef: { current: { turn: 1, over: false } },
      shootingRef: { current: false }, aiShotTimeoutRef: { current: null },
      aiPlanRef: { current: { spin: { x: .3, y: -.25 } } },
      spinRef: { current: { x: 0, y: 0 } }, spinRequestRef: { current: { x: 0, y: 0 } },
      aiCueViewBlendRef: { current: 0 }, AI_CAMERA_DROP_BLEND: .2, AI_CAMERA_DROP_DURATION_MS: 300,
      shotDelay: 900, dropDelay: 400, setAiShotCueViewActive() {}, setAiShotPreviewActive() {},
      tweenCameraBlend() {}, applyCameraBlend() {}, clearTimeout() {},
      window: { setTimeout(callback, delay) { scheduled = callback; assert.equal(delay, 500); return 7; } },
      updateCamera() { cameraUpdates++; }, fire() { fired++; }
    };
    const invalidate = () => {
      if (invalidation === 'wrong-turn') c.hudRef.current.turn = 0;
      if (invalidation === 'finished') c.hudRef.current.over = true;
      if (invalidation === 'disposed') c.disposed = true;
      if (invalidation === 'shooting') c.shootingRef.current = true;
    };
    if (phase === 'before') invalidate();
    vm.runInNewContext(`(${source.slice(node.start, node.end)})`, c)();
    if (phase === 'before' && invalidation !== 'none') {
      assert.equal(scheduled, undefined, 'invalid ownership cannot even schedule a shot');
      assert.equal(fired, 0); assert.equal(cameraUpdates, 0);
      continue;
    }
    assert.equal(c.aiShotTimeoutRef.current, 7);
    if (phase === 'after') invalidate();
    scheduled();
    assert.equal(c.aiShotTimeoutRef.current, null);
    assert.equal(fired, invalidation === 'none' ? 1 : 0, invalidation);
    assert.equal(cameraUpdates, fired, 'invalidated timer cannot move the camera either');
    for (const spin of [c.spinRef.current, c.spinRequestRef.current]) {
      assert.equal(spin.x, fired ? .3 : 0);
      assert.equal(spin.y, fired ? -.25 : 0, 'the committed plan restores spin immediately before striking');
    }
  }
});
