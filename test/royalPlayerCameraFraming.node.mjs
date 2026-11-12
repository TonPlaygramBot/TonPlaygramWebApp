import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import { PoolRoyalHumanPlayers } from '../webapp/src/pages/Games/shared/PoolRoyalHumanPlayers.ts';
import { POOL_ROYAL_EYE_FOV, POOL_ROYAL_CUE_BALL_SCREEN_Y } from '../webapp/src/pages/Games/shared/poolRoyalPlayerPose.ts';
import { readPoolRoyalMetrics } from '../scripts/read-pool-royal-metrics.mjs';
import { readSnookerViewMetrics } from '../scripts/read-snooker-view-metrics.mjs';
import { loadPoseModel } from './fixtures/poolRoyalPoseTrace.mjs';

const model = await loadPoseModel();
const metrics = { pool: await readPoolRoyalMetrics(), snooker: await readSnookerViewMetrics() };
const forwardAt = yaw => new THREE.Vector3(0, 0, -1).applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);

test('both production player lenses use the field of view used to calculate framing', async () => {
  for (const game of ['PoolRoyale', 'SnookerRoyal']) {
    const source = await readFile(new URL(`../webapp/src/pages/Games/${game}.jsx`, import.meta.url), 'utf8');
    assert.equal(Number(source.match(/const STANDING_VIEW_FOV = ([\d.]+);/)[1]), POOL_ROYAL_EYE_FOV);
  }
});

for (const game of ['pool', 'snooker']) test(`${game}: actual eyes keep cue ball and shot ahead visible in portrait from rails and corners`, async () => {
  const m = metrics[game];
  const cases = [0, Math.PI / 2, Math.PI, -Math.PI / 2, Math.PI / 4, -Math.PI * 3 / 4]
    .map(yaw => ({ yaw, position: -.8 }));
  cases.push({ yaw: 0, position: 0 }, { yaw: Math.PI / 2, position: .7 });
  for (const [index, sample] of cases.entries()) {
    const world = new THREE.Group();
    world.position.set(11, -4, 5); world.scale.setScalar(index % 2 ? .23 : .65); world.rotation.y = .7;
    const players = new PoolRoyalHumanPlayers(world, { ...m, model, realisticMovement: game === 'pool', exactEyeCamera: true });
    assert.ok(await players.ready);
    const forward = forwardAt(sample.yaw);
    const boundary = Math.min(m.playW / 2 / (Math.abs(forward.x) || 1e-10), m.playL / 2 / (Math.abs(forward.z) || 1e-10));
    const ball = forward.clone().multiplyScalar(boundary * sample.position).setY(m.ballY);
    const seat = index % 2 ? 'B' : 'A';
    for (const power of [0, 1]) {
      const tip = ball.clone().addScaledVector(forward, -((m.cueGap ?? m.ballR * 1.15) + power * (m.cuePull ?? m.ballR * 9.33)));
      const back = tip.clone().addScaledVector(forward, -m.cueLength); back.y += m.cueButtLift ?? 0;
      for (let frame = 0; frame < 130; frame++) players.update(1 / 60, {
        activeSeat: seat, state: 'dragging', power, nowMs: frame * 1000 / 60,
        cueBall: ball, aimForward: forward, cueTip: tip, cueBack: back,
        cueRadius: m.cueRadius ?? m.ballR * .243,
        bridgeBounds: { halfWidth: m.playW / 2, halfLength: m.playL / 2 },
        bridgeRailY: m.ballY + m.ballR,
        bridgeObstacles: game === 'pool' ? [{ position: ball, radius: m.ballR }] : []
      });
      const eye = players.eyeView;
      assert.equal(players.readyToShoot, true, `${game} ${sample.yaw}: adjusted stance can finish preparation and shoot`);
      assert.ok(ball.clone().sub(eye.position).dot(forward) > m.ballR * 8, `${game} ${sample.yaw}: eyes behind the ball, including near-rail shots`);
      assert.ok(eye.position.y > m.clothY + m.ballR, 'eye clears cloth and ball');
      const human = players.players.find(player => player.seat === seat).human;
      const boneEye = human.model.getObjectByName('LeftEye').getWorldPosition(new THREE.Vector3())
        .lerp(human.model.getObjectByName('RightEye').getWorldPosition(new THREE.Vector3()), .5);
      assert.ok(world.localToWorld(eye.position.clone()).distanceTo(boneEye) < 1e-8, 'framing never displaces the lens from the real eyes');
      for (const width of [320, 390, 430]) {
        const camera = new THREE.PerspectiveCamera(POOL_ROYAL_EYE_FOV, width / 844, .04, 4000);
        camera.position.copy(boneEye); camera.lookAt(world.localToWorld(eye.target.clone())); camera.updateMatrixWorld(true);
        const screen = world.localToWorld(ball.clone()).project(camera);
        assert.ok(Math.abs(screen.x) < 1e-8, 'cue ball is horizontally centered');
        assert.ok(Math.abs(screen.y - POOL_ROYAL_CUE_BALL_SCREEN_Y) < 1e-8, 'cue ball stays at 64% down the phone screen');
        assert.ok(screen.z > -1 && screen.z < 1, 'cue ball is in front of the lens and inside the clipping planes');
        for (const offset of [new THREE.Vector3(m.ballR, 0, 0), new THREE.Vector3(0, m.ballR, 0), new THREE.Vector3(0, 0, m.ballR)]) {
          for (const sign of [-1, 1]) {
            const edge = world.localToWorld(ball.clone().addScaledVector(offset, sign)).project(camera);
            assert.ok(Math.abs(edge.x) < .9 && Math.abs(edge.y) < .8, 'the entire ball fits clear of the bottom controls');
          }
        }
        const ahead = world.localToWorld(ball.clone().addScaledVector(forward, m.ballR * 8)).project(camera);
        assert.ok(ahead.y > screen.y && ahead.y < 1, 'the shot continues visually UP the portrait screen');
      }
    }
    players.dispose();
  }
});

test('Snooker aim crossing +/-PI does not rotate the eyes the long way around', async () => {
  const m = metrics.snooker;
  for (const sign of [-1, 1]) {
    const players = new PoolRoyalHumanPlayers(new THREE.Group(), { ...m, model, exactEyeCamera: true });
    assert.ok(await players.ready);
    const frame = { activeSeat: 'A', state: 'dragging', power: 0, nowMs: 1000,
      cueBall: new THREE.Vector3(0, m.ballY, -m.playL * .35), aimForward: forwardAt(sign * (Math.PI - .01)) };
    for (let i = 0; i < 130; i++) players.update(1 / 60, frame);
    const beforeEye = players.eyeView.position.clone(), beforeYaw = players.players[0].human.yaw;
    players.update(1 / 60, { ...frame, aimForward: forwardAt(-sign * (Math.PI - .01)) });
    assert.ok(Math.abs(players.players[0].human.yaw - beforeYaw) < .01, 'tiny aim change takes the short turn');
    assert.ok(players.eyeView.position.distanceTo(beforeEye) < m.ballR * .5, 'eyes do not sweep sideways across the shot');
    players.dispose();
  }
});
