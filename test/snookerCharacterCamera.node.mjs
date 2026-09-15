import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { parse } from '@babel/parser';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import { PoolRoyalHumanPlayers } from '../webapp/src/pages/Games/shared/PoolRoyalHumanPlayers.ts';
import { SnookerRoyalShotCamera, snookerRoyalFallbackEye } from '../webapp/src/pages/Games/snookerRoyalShotCamera.ts';
import { TABLE_SIZE_OPTIONS } from '../webapp/src/config/snookerClubTables.js';
import { readSnookerViewMetrics } from '../scripts/read-snooker-view-metrics.mjs';
import { loadPoseModel } from './fixtures/poolRoyalPoseTrace.mjs';

const m = await readSnookerViewMetrics();
const source = await readFile(new URL('../webapp/src/pages/Games/SnookerRoyal.jsx', import.meta.url), 'utf8');
const gameAst = parse(source, { sourceType: 'module', plugins: ['jsx'] });
const callbacks = new Map();
const visit = node => {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'VariableDeclarator' && node.id?.type === 'Identifier') callbacks.set(node.id.name, node.init);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value?.type) visit(value);
  }
};
visit(gameAst);

// Execute the production handoff, with the real shot-camera state machine.
function cameraRig(world) {
  const context = {
    world,
    humanShotCamera: new SnookerRoyalShotCamera(),
    activeHumanCueViewRef: { current: null },
    cueAnimating: false,
    shootingRef: { current: false },
    shotImpactPending: false,
    cameraBlendRef: { current: 0 },
    topViewRef: { current: false },
    replayPlaybackRef: { current: false },
    cueGalleryStateRef: { current: null },
    TABLE_Y: m.tableY,
    BALL_CENTER_Y: m.ballY - m.tableY,
    BALL_R: m.ballR,
    CAMERA_CUE_SURFACE_MARGIN: m.cameraClearance,
    performance: { now: () => context.now },
    now: 0
  };
  vm.createContext(context);
  context.resolve = vm.runInContext(`(${m.eyeResolver})`, context);
  return context;
}

test('eye handoff preserves the existing safe view, target, blend and source pose', () => {
  const world = new THREE.Group();
  world.scale.setScalar(0.65);
  world.position.y = -2;
  const rig = cameraRig(world);
  const position = new THREE.Vector3(3, m.clothY + m.ballR * 4, 12);
  const target = new THREE.Vector3(3, m.ballY, -8);
  rig.activeHumanCueViewRef.current = { position, target, blend: 0.7 };
  const pose = rig.resolve();
  assert.ok(pose.position.distanceTo(world.localToWorld(position.clone())) < 1e-9);
  assert.ok(pose.target.distanceTo(world.localToWorld(target.clone())) < 1e-9);
  assert.equal(pose.blend, 0.7);
  assert.equal(position.y, m.clothY + m.ballR * 4);
});

test('shot camera holds through follow-through then yields to broadcast, on both table sizes', () => {
  for (const table of Object.values(TABLE_SIZE_OPTIONS)) {
    for (const scale of [table.scale, table.mobileScale, table.compactScale]) {
      const world = new THREE.Group();
      world.scale.setScalar(m.worldScale * scale);
      world.position.y = m.surfaceProxyY * m.worldScale * (1 - scale);
      const rig = cameraRig(world);
      const eye = { position: new THREE.Vector3(4, m.clothY - 3, 10),
        target: new THREE.Vector3(0, m.ballY, 0), blend: 1 };
      rig.activeHumanCueViewRef.current = eye;
      rig.cueAnimating = true;
      rig.shootingRef.current = true;
      for (const time of [0, 200, 400, 600, 750, 899]) {
        rig.now = time;
        if (time > 0) rig.cueAnimating = false;
        const pose = rig.resolve();
        assert.equal(pose.position.y, world.localToWorld(eye.position.clone()).y);
        assert.equal(pose.position.x, 4 * world.scale.x);
        assert.equal(pose.position.z, 10 * world.scale.z);
        assert.equal(eye.position.y, m.clothY - 3, 'the rig and held pose are not modified');
      }
      for (const time of [900, 2000, 15000]) {
        rig.now = time;
        assert.equal(rig.resolve(), null, 'broadcast owns the rest of the shot');
        assert.equal(rig.humanShotCamera.isBroadcasting, true);
        assert.equal(rig.humanShotCamera.isHoldingShot, false);
      }
      rig.shootingRef.current = false;
      rig.activeHumanCueViewRef.current = null;
      assert.equal(rig.resolve(), null, 'release the shot view when the next turn begins');
    }
  }
});

test('overhead, replay and cue-gallery views retain camera ownership', () => {
  const rig = cameraRig(new THREE.Group());
  rig.cueAnimating = true;
  rig.activeHumanCueViewRef.current = { position: new THREE.Vector3(), target: new THREE.Vector3(), blend: 1 };
  for (const ref of ['topViewRef', 'replayPlaybackRef', 'cueGalleryStateRef']) {
    rig[ref].current = ref === 'cueGalleryStateRef' ? { active: true } : true;
    assert.equal(rig.resolve(), null);
    rig[ref].current = false;
  }
});

test('post-impact eye movement and a potted cue ball cannot move the shot view', () => {
  const rig = cameraRig(new THREE.Group());
  const eye = { position: new THREE.Vector3(4, 20, 30), target: new THREE.Vector3(0, 4, 0), blend: 1 };
  rig.activeHumanCueViewRef.current = eye;
  rig.humanShotCamera.beginShot(eye, eye);
  rig.shootingRef.current = true;
  rig.cueAnimating = true;
  rig.shotImpactPending = true;
  eye.position.y += 1;
  const beforeImpact = rig.resolve();
  rig.shotImpactPending = false;
  eye.position.set(50, 2, -60);
  eye.target.set(80, -10, -40);
  for (const cueAnimating of [true, false]) {
    rig.cueAnimating = cueAnimating;
    const afterImpact = rig.resolve();
    assert.deepEqual(afterImpact, beforeImpact, 'follow-through does not track the moving cue ball');
    assert.equal(afterImpact.blend, 1, 'follow-through stays fully at the player viewpoint');
  }
  rig.activeHumanCueViewRef.current = null;
  assert.deepEqual(rig.resolve(), beforeImpact, 'retain the view after a scratch or rig reset');
  rig.topViewRef.current = true;
  assert.equal(rig.resolve(), null);
  rig.topViewRef.current = false;
  assert.deepEqual(rig.resolve(), beforeImpact, 'manual overview returns to the same player viewpoint');
});

test('an unsettled character has a fixed address view above the actual ball plane', () => {
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const ball = new THREE.Vector3(4, 8, -35);
    const direction = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const eye = snookerRoyalFallbackEye(ball, direction, 30, 1);
    assert.ok(eye.position.y > ball.y + 1, 'camera clears the ball and cloth');
    assert.ok(eye.position.clone().sub(ball).dot(direction) < -1, 'view stays behind the shot');
    const camera = new THREE.PerspectiveCamera(m.cameraFov, 390 / 844, .01, 500);
    camera.position.copy(eye.position);
    camera.lookAt(eye.target);
    camera.updateMatrixWorld(true);
    const projected = ball.clone().project(camera);
    assert.ok(Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1, 'ball is visible in portrait');
    assert.deepEqual(ball.toArray(), [4, 8, -35], 'snapshot does not mutate the cue ball');
  }
});

test('missing character assets retain the pre-shot view instead of following the ball', () => {
  const rig = cameraRig(new THREE.Group());
  const fallback = { position: new THREE.Vector3(4, 20, 30), target: new THREE.Vector3(0, 4, 0), blend: 1 };
  rig.humanShotCamera.beginShot(null, fallback);
  rig.shootingRef.current = true;
  const pose = rig.resolve();
  fallback.position.set(100, 200, 300);
  assert.deepEqual(rig.resolve(), pose);
  rig.shootingRef.current = false;
  assert.equal(rig.resolve(), null);
  assert.equal(rig.humanShotCamera.isHoldingShot, false);
});

test('the live render handoff skips tracking branches and renders the held player view', () => {
  const rig = cameraRig(new THREE.Group());
  const eye = { position: new THREE.Vector3(4, 20, 30), target: new THREE.Vector3(0, 4, 0), blend: 1 };
  rig.humanShotCamera.beginShot(eye, eye);
  rig.shootingRef.current = true;
  const camera = new THREE.PerspectiveCamera(90, 390 / 844, 0.01, 1000);
  const statements = callbacks.get('updateCamera').body.body;
  const index = statements.findIndex(s => s.declarations?.[0]?.id?.name === 'humanEyePose');
  assert.ok(index >= 0);
  const overlay = statements.find(s => s.type === 'IfStatement' && s.test?.name === 'humanEyePose');
  const handoff = source.slice(statements[index].start, statements[index + 1].end)
    + source.slice(overlay.start, overlay.end);
  for (const trackedBall of [new THREE.Vector3(50, 4, -30), new THREE.Vector3(-20, -10, 60)]) {
    camera.position.copy(trackedBall);
    const context = vm.createContext({
      renderCamera: camera, lookTarget: trackedBall, THREE,
      camera, shooting: true, cueAnimating: false, broadcastArgs: {},
      activeShotView: { mode: 'pocket', anchorType: 'side' },
      get ballsRef() { throw new Error('player view must skip the ball-tracking branches'); },
      resolveActiveHumanEyePose: rig.resolve, STANDING_VIEW_FOV: m.cameraFov
    });
    vm.runInContext(handoff, context);
    assert.deepEqual(camera.position, eye.position);
    assert.equal(camera.fov, m.cameraFov);
    camera.updateMatrixWorld(true);
    const targetScreen = eye.target.clone().project(camera);
    assert.ok(Math.abs(targetScreen.x) < 1e-8 && Math.abs(targetScreen.y) < 1e-8);
  }
});

test('explicit overhead bypasses legacy impact, action and pocket camera branches', () => {
  const statements = callbacks.get('updateCamera').body.body;
  const index = statements.findIndex(s => s.declarations?.[0]?.id?.name === 'humanEyePose');
  const chain = statements[index + 1];
  let genericBranch = chain;
  while (genericBranch.type === 'IfStatement') genericBranch = genericBranch.alternate;
  // Execute the production camera dispatch and legacy branches. Only the
  // unchanged generic orbit/overhead renderer is replaced with a sentinel.
  const dispatch = source.slice(chain.start, genericBranch.start) + '{ selectedOverhead = true; }';
  for (const mode of ['impact', 'action', 'pocket']) {
    const context = vm.createContext({
      humanEyePose: null, shooting: true, cueAnimating: false,
      replayPlaybackActive: false, galleryState: null,
      topViewRef: { current: true }, cameraHoldActive: mode === 'impact',
      cueImpactCameraRef: { current: {} }, activeShotView: { mode, anchorType: 'side' },
      get ballsRef() { throw new Error('manual overhead must skip the ball-tracking branches'); },
      selectedOverhead: false
    });
    vm.runInContext(dispatch, context);
    assert.equal(context.selectedOverhead, true, `${mode} cannot override explicit overhead`);
  }
});

test('starting a live shot no longer schedules an automatic overhead camera', () => {
  const scheduled = [];
  const c = {
    shooting: false, shootingRef: { current: false }, shotStartedAt: 0,
    getNow: () => 100, shotImpactPending: true, shotImpactFallbackTimer: null,
    maxPowerLiftTriggered: false, cueImpactCameraRef: { current: null },
    preShotTopViewRef: { current: false }, preShotTopViewLockRef: { current: false },
    topViewRef: { current: false }, topViewLockedRef: { current: false },
    shotCameraHoldTimeoutRef: { current: null }, SHOT_CAMERA_HOLD_MS: 2000,
    window: { setTimeout: (callback, delay) => scheduled.push({ callback, delay }) },
    clearTimeout() {}, enterTopView() { c.topViewRef.current = true; },
    exitTopView() { c.topViewRef.current = false; }, setShotActive() {}
  };
  vm.createContext(c);
  const node = callbacks.get('setShootingState');
  const setShootingState = vm.runInContext(`(${source.slice(node.start, node.end)})`, c);
  setShootingState(true);
  assert.equal(c.shootingRef.current, true);
  assert.equal(scheduled.length, 0, 'the shot-camera owner controls the broadcast handoff');
  assert.equal(c.topViewRef.current, false);
  setShootingState(false);
  assert.equal(c.shootingRef.current, false);
});

test('the real character is subtly trimmed and its original shot camera is preserved in portrait', async () => {
  const world = new THREE.Group();
  const players = new PoolRoyalHumanPlayers(world, { ...m, model: await loadPoseModel() });
  assert.equal(await players.ready, true);
  world.updateMatrixWorld(true);
  const oldHeight = m.cueLength * 1.68;
  const height = new THREE.Box3().setFromObject(players.players[0].human.modelRoot).getSize(new THREE.Vector3()).y;
  assert.ok(Math.abs(height / oldHeight - 1.14) < 0.001, '14% above the original baseline and smaller than the prior silhouette');
  assert.equal(players.group.position.y, m.floorY, 'the character stays anchored to the floor');
  const rig = cameraRig(world);
  let cameraPoses = 0;
  for (const fps of [30, 60, 120]) for (const seat of ['A', 'B']) {
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const direction = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
      const ball = new THREE.Vector3(-direction.x * m.playW * 0.35, m.ballY, -direction.z * m.playL * 0.35);
      for (let i = 0; i < fps * 1.8; i++) {
        const striking = i / fps >= 1.3;
        players.update(1 / fps, { activeSeat: seat, state: striking ? 'striking' : 'dragging',
          cueBall: ball, aimForward: direction, power: 0.75, nowMs: i * 1000 / fps });
        rig.activeHumanCueViewRef.current = players.eyeView;
        rig.cueAnimating = striking;
        rig.shootingRef.current = striking;
        rig.shotImpactPending = striking;
        rig.now = i * 1000 / fps;
        const pose = rig.resolve();
        if (!pose) continue;
        cameraPoses++;
        assert.ok(pose.position.distanceTo(world.localToWorld(players.eyeView.position.clone())) < 1e-9);
        for (const aspect of [320 / 640, 390 / 844]) {
          const camera = new THREE.PerspectiveCamera(m.cameraFov, aspect, 0.01, 500);
          camera.position.copy(pose.position);
          camera.lookAt(pose.target);
          camera.updateMatrixWorld(true);
          const screen = pose.target.clone().project(camera);
          assert.ok(Math.abs(screen.x) < 1e-8 && Math.abs(screen.y) < 1e-8,
            'the original aim target stays centered on a portrait screen');
        }
      }
    }
  }
  assert.ok(cameraPoses > 0, 'exercise the actual pose-driven camera, not only a synthetic eye');
  players.dispose();
});

test('contact clock advances through manual view changes, and the next shot resets it', () => {
  const rig = cameraRig(new THREE.Group());
  const eye = { position: new THREE.Vector3(1, 5, 9), target: new THREE.Vector3(), blend: 1 };
  rig.humanShotCamera.beginShot(eye, eye);
  rig.shootingRef.current = true;
  rig.shotImpactPending = true;
  rig.now = 4000;
  assert.ok(rig.resolve(), 'a slow backswing does not start broadcast');
  rig.humanShotCamera.markImpact(4000, eye);
  rig.shotImpactPending = false;
  rig.cueAnimating = true;
  rig.now = 4901;
  assert.ok(rig.resolve(), 'never interrupt an unfinished follow-through');
  rig.topViewRef.current = true;
  rig.cueAnimating = false;
  assert.equal(rig.resolve(), null);
  assert.equal(rig.humanShotCamera.isBroadcasting, true);
  rig.topViewRef.current = false;
  assert.equal(rig.resolve(), null, 'returning from overhead cannot reacquire the player');
  rig.humanShotCamera.beginShot(eye, eye);
  rig.shotImpactPending = true;
  assert.ok(rig.resolve());
  assert.equal(rig.humanShotCamera.isBroadcasting, false);
});
