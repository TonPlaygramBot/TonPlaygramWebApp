import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import {
  careerResult,
  freshCareer,
  normalizeCareer,
  careerRound,
  rallyGoal,
  TOUR
} from '../shared/tabletennis/career.js';
import { createMatch } from '../shared/tabletennis/engine.js';
const { outputFiles } = await build({
  stdin: {
    contents: `export * from './camera'; export * from './animation'; export * as THREE from 'three';`,
    resolveDir: new URL('../webapp/src/games/tabletennis/', import.meta.url)
      .pathname,
    loader: 'ts'
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm'
});
const { tableCamera, tableFingerDirection, humanPose, THREE } = await import(
  'data:text/javascript;base64,' +
    Buffer.from(outputFiles[0].text).toString('base64')
);

test('portrait swipes retain all eight screen headings for both seats and end changes', () => {
  for (const width of [320, 390, 480])
    for (const swapped of [false, true])
      for (const seat of [0, 1]) {
        const stage = new THREE.Group(),
          camera = new THREE.PerspectiveCamera();
        stage.rotation.y =
          (seat === 0 ? 1 : -1) * (swapped ? -1 : 1) < 0 ? Math.PI : 0;
        stage.updateMatrixWorld(true);
        tableCamera(camera, width, 750);
        const sign = stage.rotation.y ? -1 : 1;
        const anchor = { x: 0.2 * sign, y: 1.05, z: 1.15 * sign };
        for (const [dx, dy] of [
          [0, -1],
          [1, -1],
          [1, 0],
          [1, 1],
          [0, 1],
          [-1, 1],
          [-1, 0],
          [-1, -1]
        ]) {
          const heading = tableFingerDirection(camera, stage, anchor, dx, dy);
          const project = (v) => stage.localToWorld(v).project(camera);
          const a = project(new THREE.Vector3(anchor.x, anchor.y, anchor.z));
          const b = project(
            new THREE.Vector3(
              anchor.x + heading.x * 0.0001,
              anchor.y,
              anchor.z + heading.z * 0.0001
            )
          );
          const sx = (b.x - a.x) * camera.aspect,
            sy = -(b.y - a.y);
          assert.ok(
            (sx * dx + sy * dy) / Math.hypot(sx, sy) / Math.hypot(dx, dy) >
              0.99999
          );
        }
        assert.equal(camera.position.y, 1.62);
        for (const x of [-0.915, 0.915]) {
          const net = new THREE.Vector3(x, 0.915, 0).project(camera);
          assert.ok(
            Math.abs(net.x) < 1 && Math.abs(net.y) < 1,
            'Entire net stays in portrait frame'
          );
        }
      }
});

test('ready wrists stay on their anatomical sides, and the racket is held forward', () => {
  const s = createMatch({ ai: false });
  s.phase = 'point';
  s.time = 3;
  for (const seat of [0, 1]) {
    const yaw = seat === 0 ? Math.PI : 0;
    const pose = humanPose(s, seat, yaw),
      anatomicalRight = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
    const base = new THREE.Vector3(s.players[seat].x, 0, s.players[seat].z);
    assert.ok(pose.rightHand.clone().sub(base).dot(anatomicalRight) > 0);
    assert.ok(pose.leftHand.clone().sub(base).dot(anatomicalRight) < 0);
    assert.ok(pose.paddleCenter.y > pose.paddleGrip.y + 0.1);
  }
});

test('career retains saves, rotates formats, and awards each event rally medal once', () => {
  const migrated = normalizeCareer({
    tour: 2,
    round: 1,
    wins: 7,
    credits: 4,
    upgrades: [1, 2, 0]
  });
  assert.deepEqual(migrated.medals, []);
  assert.equal(migrated.wins, 7);
  assert.equal(migrated.round, 1);
  let c = freshCareer();
  const original = structuredClone(c);
  c = careerResult(c, false, rallyGoal(0));
  assert.equal(c.credits, 1);
  assert.deepEqual(c.medals, ['rally-0']);
  assert.deepEqual(original, freshCareer());
  c = careerResult(c, false, rallyGoal(0));
  assert.equal(c.credits, 1);
  const formats = [];
  for (let i = 0; i < 15; i++) {
    const round = careerRound(c);
    formats.push(round.name);
    assert.equal(round.gamesToWin, c.round === 2 ? 2 : 1);
    const start = createMatch({ gamesToWin: round.gamesToWin });
    start.score.points = [...round.points];
    assert.deepEqual(
      start.score.points,
      c.round === 0 ? [6, 6] : c.round === 1 ? [4, 8] : [0, 0]
    );
    c = careerResult(c, true, rallyGoal(c.tour));
  }
  assert.equal(c.completed, true);
  assert.equal(c.wins, 15);
  assert.equal(c.medals.length, 5);
  assert.equal(c.credits, 30 + 5 + TOUR.reduce((sum, t) => sum + t.prize, 0));
  assert.equal(formats.filter((f) => f === 'Championship').length, 5);
  assert.deepEqual(careerResult(c, true, 99), { ...c, bestRally: 99 });
});
