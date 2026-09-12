import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { beginSwipe, sampleSwipe, readSwipe } from '../shared/tennis/swipe.js';
import {
  createMatch,
  advance,
  setInput,
  neutralInput,
  side
} from '../shared/tennis/engine.js';
import { planAiShot } from '../shared/tennis/ai.js';

const bundle = await build({
  stdin: {
    contents:
      "export { playerCamera, fingerDirection } from './camera'; export * as THREE from 'three';",
    resolveDir: fileURLToPath(
      new URL('../webapp/src/games/tennis', import.meta.url)
    )
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false
});
const { playerCamera, fingerDirection, THREE } = await import(
  'data:text/javascript;base64,' +
    Buffer.from(bundle.outputFiles[0].text).toString('base64')
);

test('player-eye camera stays at table-tennis eye height and player offset on portrait phones', () => {
  for (const width of [320, 390, 480])
    for (const height of [270, 460, 650])
      for (const seat of [0, 1])
        for (const x of [-4, 0, 4]) {
          const camera = new THREE.PerspectiveCamera(
            64,
            width / height,
            0.1,
            160
          );
          const p = { x, z: side(seat) * 12.4 };
          playerCamera(camera, seat, p);
          assert.equal(camera.position.y, 1.62);
          assert.equal(camera.position.x, x);
          assert.ok(
            Math.abs(camera.position.z - p.z - side(seat) * 0.32) < 1e-10
          );
          assert.equal(camera.near, 0.06);
          const horizontalFov = THREE.MathUtils.radToDeg(
            2 *
              Math.atan(
                Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) *
                  camera.aspect
              )
          );
          assert.ok(horizontalFov >= 58 - 1e-8);
          // From the baseline, the net and far athlete remain in view.
          for (const point of [
            new THREE.Vector3(-5.65, 1.05, 0),
            new THREE.Vector3(5.65, 1.05, 0),
            new THREE.Vector3(0, 1.8, -p.z)
          ]) {
            point.project(camera);
            assert.ok(
              Math.abs(point.x) < 1 && Math.abs(point.y) < 1 && point.z < 1
            );
          }
        }
});

test('screen vectors retain their angle and sign in all directions, for both seats', () => {
  for (const seat of [0, 1])
    for (const x of [-3, 0, 3]) {
      const camera = new THREE.PerspectiveCamera(64, 390 / 460, 0.1, 160),
        anchor = { x, y: 1.2, z: side(seat) * 10 };
      playerCamera(camera, seat, anchor);
      for (const [dx, dy] of [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
        [-0.3, -1],
        [0.3, -1]
      ]) {
        const direction = fingerDirection(camera, anchor, dx, dy);
        const start = new THREE.Vector3(anchor.x, anchor.y, anchor.z).project(
          camera
        );
        const end = new THREE.Vector3(
          anchor.x + direction.x * 0.0001,
          anchor.y,
          anchor.z + direction.z * 0.0001
        ).project(camera);
        const sx = (end.x - start.x) * camera.aspect,
          sy = -(end.y - start.y);
        assert.ok(
          (sx * dx + sy * dy) / (Math.hypot(sx, sy) * Math.hypot(dx, dy)) >
            0.99999
        );
      }
    }
});

test('gesture direction depends on motion, not start or release location, including last-moment turns', () => {
  for (const startX of [30, 150, 290]) {
    const swipe = beginSwipe(startX, 400, 0, 390);
    sampleSwipe(swipe, startX + 30, 300, 80);
    const result = readSwipe(swipe);
    assert.ok(result.dx > 0 && result.dy < 0);
    assert.ok(Math.abs(result.dx / -result.dy - 0.3) < 1e-10);
    sampleSwipe(swipe, startX - 20, 250, 240);
    assert.ok(readSwipe(swipe).dx < 0);
  }
});

test('queued direction and power survive later input; slow touches produce much less pace', () => {
  function hit(power, direction, seat) {
    const s = createMatch({ ai: false });
    s.phase = 'rally';
    s.time = 2;
    s.players[seat].x = 0;
    s.players[seat].z = side(seat) * 9;
    Object.assign(s.ball, {
      x: 0,
      y: 1.2,
      z: side(seat) * 9,
      vx: 0,
      vy: 0,
      vz: 0,
      serve: false,
      bounces: 1,
      last: 1 - seat
    });
    setInput(s, seat, {
      ...neutralInput(),
      assist: false,
      swing: 1,
      power,
      direction
    });
    setInput(s, seat, {
      ...neutralInput(),
      assist: false,
      swing: 1,
      power: 0.5,
      direction: { x: -1, z: 0 }
    });
    advance(s, 1 / 120);
    return s;
  }
  for (const seat of [0, 1])
    for (const dir of [
      { x: 0.1, z: -side(seat) },
      { x: -0.1, z: -side(seat) },
      { x: 1, z: 0 },
      { x: 0, z: side(seat) }
    ]) {
      const slow = hit(0.1, dir, seat),
        fast = hit(1, dir, seat);
      assert.equal(fast.ball.last, seat);
      const pace = (s) => Math.hypot(s.ball.vx, s.ball.vz);
      assert.ok(pace(fast) > pace(slow) * 1.6);
      assert.ok(
        (fast.ball.vx * dir.x + fast.ball.vz * dir.z) /
          (pace(fast) * Math.hypot(dir.x, dir.z)) >
          0.999999
      );
    }
});

test('Pro chooses open court, lobs a net player and drops against a deep defender', () => {
  const s = createMatch({ difficulty: 2 });
  s.players[1] = { ...s.players[1], x: 0, z: -7 };
  s.ball.x = 0;
  s.ball.z = -7;
  s.ball.y = 1.2;
  s.players[0].x = 3;
  s.players[0].z = 8;
  assert.ok(planAiShot(s, 0).aim < -0.8);
  s.players[0].x = -3;
  assert.ok(planAiShot(s, 0).aim > 0.8);
  s.players[0].z = 4;
  assert.equal(planAiShot(s, 0).shot, 'lob');
  s.players[0].z = 11.5;
  const drop = planAiShot(s, 0.4);
  assert.equal(drop.shot, 'slice');
  assert.ok(drop.depth < 0.2);
});

test('seeded match benchmark distinguishes Club, Tour and Pro with finite player timing', () => {
  const wins = [];
  for (const difficulty of [0, 1, 2]) {
    let aiWins = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const s = createMatch({ difficulty, seed });
      for (let i = 0; i < 72000 && s.phase !== 'over'; i++) {
        // A repeatable reference player: assisted movement, forehand to the right,
        // one input every 1.25 seconds, with real gaps between queued swings.
        if (i % 150 === 0)
          setInput(s, 0, { ...neutralInput(), swing: i + 1, aim: 0.85 });
        advance(s, 1 / 120);
      }
      assert.equal(s.phase, 'over');
      aiWins += s.winner === 1;
    }
    wins.push(aiWins);
  }
  assert.ok(
    wins[2] >= 24 && wins[2] >= wins[1] && wins[1] > wins[0],
    `AI wins / 30: ${wins}`
  );
});
