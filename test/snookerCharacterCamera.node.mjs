import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import { PoolRoyalHumanPlayers } from '../webapp/src/pages/Games/shared/PoolRoyalHumanPlayers.ts';
import { PoolRoyalShotCamera } from '../webapp/src/pages/Games/shared/poolRoyalShotCamera.ts';
import { TABLE_SIZE_OPTIONS } from '../webapp/src/config/snookerClubTables.js';
import { readSnookerViewMetrics } from '../scripts/read-snooker-view-metrics.mjs';
import { loadPoseModel } from './fixtures/poolRoyalPoseTrace.mjs';

const m = await readSnookerViewMetrics();

// Execute the production handoff, with the real shot-camera state machine.
function cameraRig(world) {
  const context = {
    world,
    humanShotCamera: new PoolRoyalShotCamera(),
    activeHumanCueViewRef: { current: null },
    cueAnimating: false,
    shootingRef: { current: false },
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

test('below-cloth eyes stay clear during stroke, hold and release on both table sizes', () => {
  for (const table of Object.values(TABLE_SIZE_OPTIONS)) {
    for (const scale of [table.scale, table.mobileScale, table.compactScale]) {
      const world = new THREE.Group();
      world.scale.setScalar(m.worldScale * scale);
      world.position.y = m.surfaceProxyY * m.worldScale * (1 - scale);
      const minimumY = world.localToWorld(new THREE.Vector3(0, m.clothY + m.cameraClearance, 0)).y;
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
        assert.ok(pose.position.y >= minimumY - 1e-9);
        assert.equal(pose.position.x, 4 * world.scale.x);
        assert.equal(pose.position.z, 10 * world.scale.z);
        assert.equal(eye.position.y, m.clothY - 3, 'the rig and held pose are not modified');
      }
      rig.now = 900;
      assert.equal(rig.resolve(), null, 'original 600–900 ms handoff timing is preserved');
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

test('the real character is slightly taller and its shot camera clears the cloth in portrait', async () => {
  const world = new THREE.Group();
  const players = new PoolRoyalHumanPlayers(world, { ...m, model: await loadPoseModel() });
  assert.equal(await players.ready, true);
  world.updateMatrixWorld(true);
  const oldHeight = m.cueLength * 1.38;
  const height = new THREE.Box3().setFromObject(players.players[0].human.modelRoot).getSize(new THREE.Vector3()).y;
  assert.ok(height / oldHeight > 1.04 && height / oldHeight < 1.06);
  assert.equal(players.group.position.y, m.floorY, 'the character stays anchored to the floor');
  const rig = cameraRig(world);
  let corrected = 0;
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
        rig.now = i * 1000 / fps;
        const pose = rig.resolve();
        if (!pose) continue;
        if (players.eyeView.position.y < m.clothY) corrected++;
        assert.ok(pose.position.y >= m.clothY + m.cameraClearance - 1e-9);
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
  assert.ok(corrected > 0, 'exercise the actual below-cloth animation, not only a synthetic eye');
  players.dispose();
});
