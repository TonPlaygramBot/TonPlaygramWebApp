import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMatch,
  stepMatch,
  advance,
  setInput,
  neutralInput
} from '../shared/tennis/engine.js';
import { BALL_RADIUS, GRAVITY, reviewActive } from '../shared/tennis/court.js';
import { advanceBall, ballAtRest } from '../shared/tennis/physics.js';

const surfaces = ['hard', 'clay', 'grass'];
const steps = [1 / 30, 1 / 60, 1 / 120, 1 / 240];
function landing({
  surface = 'hard',
  seat = 0,
  serve = false,
  bounces = 0,
  out = false
} = {}) {
  const s = createMatch({ ai: false, surface });
  s.time = 5;
  s.phase = 'rally';
  s.phaseAt = 4;
  s.rally = serve ? 1 : 2;
  s.score.server = seat;
  const sign = seat === 0 ? 1 : -1,
    dt = 0.02;
  s.players[seat].x = sign * 1.8;
  Object.assign(s.ball, {
    x: out ? 6 : -sign * 1.8,
    z: -sign * (serve ? 3 : 8),
    y: BALL_RADIUS + 6 * dt - (GRAVITY * dt * dt) / 2,
    vx: 0,
    vy: -6 + GRAVITY * dt,
    vz: 0,
    last: seat,
    serve,
    bounces,
    spin: 0
  });
  return s;
}
function finiteAboveFloor(b) {
  for (const key of ['x', 'y', 'z', 'vx', 'vy', 'vz'])
    assert.ok(Number.isFinite(b[key]), key);
  assert.ok(b.y >= BALL_RADIUS - 1e-9, `Ball sank below court: ${b.y}`);
}
function scoreUnchanged(s, score) {
  assert.deepEqual(s.score, score);
}

test('first legal contacts rise visibly on every court, at every step size, for either seat', () => {
  for (const surface of surfaces)
    for (const dt of steps)
      for (const seat of [0, 1]) {
        const s = landing({ surface, seat });
        while (s.ball.bounces === 0) stepMatch(s, dt);
        assert.equal(s.phase, 'rally');
        assert.equal(s.pointCount, 0);
        assert.ok(s.ball.vy > 3);
        const y = s.ball.y;
        for (let i = 0; i < Math.ceil(0.12 / dt); i++) stepMatch(s, dt);
        assert.ok(s.ball.y > y + 0.2);
        finiteAboveFloor(s.ball);
      }
});

test('out balls and second bounces rebound after the decision, without scoring again', () => {
  for (const surface of surfaces)
    for (const seat of [0, 1])
      for (const out of [false, true]) {
        const s = landing({ surface, seat, out, bounces: out ? 0 : 1 });
        advance(s, 0.04);
        assert.equal(s.phase, 'point');
        assert.equal(s.pointCount, 1);
        assert.equal(s.lastPoint, out ? 1 - seat : seat);
        assert.ok(s.ball.vy > 0);
        const score = structuredClone(s.score),
          y = s.ball.y;
        advance(s, 0.12);
        assert.ok(s.ball.y > y + 0.2);
        advance(s, 1);
        scoreUnchanged(s, score);
        finiteAboveFloor(s.ball);
        advance(s, 0.5);
        assert.equal(s.phase, 'serve');
        scoreUnchanged(s, score);
      }
});

test('first service faults rebound before reset; stray swings do not trigger the next serve', () => {
  for (const surface of surfaces)
    for (const seat of [0, 1]) {
      const s = landing({ surface, seat, serve: true, out: true });
      advance(s, 0.04);
      assert.equal(s.phase, 'fault');
      assert.equal(s.fault, 1);
      assert.equal(s.pointCount, 0);
      assert.ok(s.ball.vy > 0);
      const y = s.ball.y;
      setInput(s, seat, { ...neutralInput(), swing: 100, power: 1 });
      assert.equal(s.players[seat].queuedInput, null);
      advance(s, 0.12);
      assert.ok(s.ball.y > y + 0.2);
      advance(s, 1);
      advance(s, 0.6);
      assert.equal(s.phase, 'serve');
      assert.equal(s.fault, 1);
      assert.equal(s.score.server, seat);
      advance(s, 0.2);
      assert.equal(s.phase, 'serve');
      const second = landing({ surface, seat, serve: true, out: true });
      s.phase = 'rally';
      Object.assign(s.ball, second.ball);
      advance(s, 0.04);
      assert.equal(s.phase, 'point');
      assert.equal(s.lastPoint, 1 - seat);
      assert.equal(s.pointCount, 1);
      assert.ok(s.ball.vy > 0);
      const score = structuredClone(s.score);
      advance(s, 1);
      scoreUnchanged(s, score);
    }
});

test('net faults deflect, fall and bounce; legal lets retain the current serve attempt', () => {
  for (const serve of [false, true])
    for (const seat of [0, 1]) {
      const s = landing({ seat, serve }),
        sign = seat === 0 ? 1 : -1;
      Object.assign(s.ball, {
        x: -sign * 1.8,
        z: sign * 0.12,
        y: 0.7,
        vy: -1,
        vz: -sign * 12
      });
      advance(s, 0.04);
      assert.equal(s.phase, serve ? 'fault' : 'point');
      assert.ok(s.ball.vz * sign > 0);
      assert.ok(s.ball.z * sign > 0);
      const score = structuredClone(s.score);
      let bounced = false;
      for (let i = 0; i < 90; i++) {
        stepMatch(s);
        finiteAboveFloor(s.ball);
        if (s.ball.bounces > 0 && s.ball.vy > 0) bounced = true;
      }
      assert.ok(bounced);
      scoreUnchanged(s, score);
      const letServe = landing({ seat, serve: true });
      letServe.fault = 1;
      Object.assign(letServe.ball, {
        x: -sign * 1.8,
        z: sign * 0.12,
        y: 1.04,
        vy: -1,
        vz: -sign * 12
      });
      for (let i = 0; i < 120 && letServe.phase === 'rally'; i++)
        stepMatch(letServe);
      assert.equal(letServe.phase, 'fault');
      assert.match(letServe.message, /Let/);
      assert.equal(letServe.fault, 1);
      assert.equal(letServe.pointCount, 0);
      assert.ok(letServe.ball.vy > 0);
      advance(letServe, 1);
      advance(letServe, 0.7);
      assert.equal(letServe.phase, 'serve');
      assert.equal(letServe.fault, 1);
    }
});

test('fast escaping serves count as faults and airborne winners keep falling', () => {
  for (const serve of [false, true])
    for (const bounces of [0, 1]) {
      const s = landing({ serve, bounces });
      Object.assign(s.ball, { x: 11.9, y: 2, vx: 45, vy: -1 });
      advance(s, 0.04);
      assert.equal(s.phase, serve && bounces === 0 ? 'fault' : 'point');
      assert.equal(s.pointCount, serve && bounces === 0 ? 0 : 1);
      const x = s.ball.x,
        y = s.ball.y,
        score = structuredClone(s.score);
      advance(s, 0.1);
      assert.ok(s.ball.x > x);
      assert.ok(s.ball.y < y);
      scoreUnchanged(s, score);
      finiteAboveFloor(s.ball);
    }
});

test('match-winning landings rebound and settle without changing the winner or score', () => {
  for (const surface of surfaces) {
    const s = landing({ surface, bounces: 1 });
    s.score.points = [3, 0];
    advance(s, 0.04);
    assert.equal(s.phase, 'over');
    assert.equal(s.winner, 0);
    assert.ok(s.ball.vy > 0);
    const score = structuredClone(s.score);
    for (let i = 0; i < 12; i++) {
      advance(s, 1);
      finiteAboveFloor(s.ball);
      scoreUnchanged(s, score);
    }
    assert.ok(ballAtRest(s.ball));
    assert.equal(s.pointCount, 1);
    assert.equal(s.winner, 0);
  }
});

test('line reviews pause the rebounding state and resume its motion exactly once', () => {
  const s = landing({ out: true });
  s.ball.x = 4.155;
  advance(s, 0.04);
  assert.ok(reviewActive(s));
  assert.ok(s.ball.vy > 0);
  const ball = structuredClone(s.ball),
    score = structuredClone(s.score);
  advance(s, 1);
  advance(s, 1);
  assert.deepEqual(s.ball, ball);
  advance(s, 1);
  advance(s, 1);
  advance(s, 0.6);
  assert.equal(reviewActive(s), false);
  assert.ok(s.ball.y > BALL_RADIUS + 0.2);
  scoreUnchanged(s, score);
  assert.equal(s.pointCount, 1);
});

test('repeated physical bounces lose energy, retain heading and settle without sinking or frame-rate drift', () => {
  // 3 courts × 4 step sizes × 3 speeds × 3 spins = 108 complete trajectories.
  for (const surface of surfaces)
    for (const speed of [0.05, 6, 45])
      for (const spin of [-1, 0, 1]) {
        const finals = [];
        for (const dt of steps) {
          const b = {
            x: 20,
            z: 20,
            y: BALL_RADIUS + 1.8,
            vx: speed * 0.6,
            vy: 0,
            vz: speed * 0.8,
            bounces: 0,
            spin,
            serve: false,
            netTouch: false
          };
          let contacts = 0;
          for (let i = 0; i < Math.ceil(24 / dt) && !ballAtRest(b); i++) {
            advanceBall(b, dt, surface, {
              bounce: (impact, rebound) => {
                contacts++;
                assert.ok(rebound.vy >= 0);
                assert.ok(
                  rebound.vx ** 2 + rebound.vy ** 2 + rebound.vz ** 2 <
                    impact.vx ** 2 + impact.vy ** 2 + impact.vz ** 2
                );
                assert.ok(
                  Math.abs(rebound.vx * impact.vz - rebound.vz * impact.vx) <
                    1e-8
                );
              }
            });
            finiteAboveFloor(b);
          }
          assert.ok(contacts >= 3);
          assert.ok(ballAtRest(b));
          finals.push(b);
        }
        for (const b of finals) {
          assert.ok(Math.abs(b.x - finals[0].x) < 0.005);
          assert.ok(Math.abs(b.z - finals[0].z) < 0.005);
          assert.equal(b.bounces, finals[0].bounces);
        }
      }
});

test('grazing, stationary and ground-level contacts do not sink, spin up or poison time', () => {
  for (const surface of surfaces)
    for (const vy of [-0.00001, 0, 0.00001, 0.3]) {
      const b = {
        x: 20,
        z: 20,
        y: BALL_RADIUS,
        vx: 2,
        vy,
        vz: 3,
        bounces: 0,
        spin: 1,
        serve: false,
        netTouch: false
      };
      for (let i = 0; i < 1200; i++) {
        advanceBall(b, 1 / 120, surface);
        finiteAboveFloor(b);
      }
      assert.ok(ballAtRest(b));
    }
  const s = landing(),
    before = structuredClone(s);
  for (const dt of [NaN, Infinity, -Infinity, -1, 0]) stepMatch(s, dt);
  assert.deepEqual(s, before);
});

test('90 varied matches complete across surfaces and levels without stalled rallies or duplicate points', () => {
  const shots = ['flat', 'topspin', 'slice', 'lob'];
  for (const surface of surfaces)
    for (const difficulty of [0, 1, 2])
      for (let seed = 1; seed <= 10; seed++) {
        const s = createMatch({ surface, difficulty, seed });
        let nextSwing = 0,
          inputSeed = seed;
        for (let tick = 0; tick < 72000 && s.phase !== 'over'; tick++) {
          if (tick >= nextSwing) {
            inputSeed = (Math.imul(inputSeed, 1664525) + 1013904223) >>> 0;
            // Gaps between finger strokes exercise missed as well as queued returns.
            nextSwing = tick + 75 + (inputSeed % 150);
            setInput(s, 0, {
              ...neutralInput(),
              swing: tick + 1,
              shot: shots[inputSeed % 4],
              power: [0.1, 0.55, 1][inputSeed % 3],
              aim: [-0.85, 0, 0.85][(inputSeed >>> 8) % 3]
            });
          }
          const points = s.pointCount;
          stepMatch(s);
          assert.ok(s.pointCount === points || s.pointCount === points + 1);
          finiteAboveFloor(s.ball);
          assert.ok(
            s.phase !== 'rally' || s.time - s.phaseAt < 10,
            `${surface}/${difficulty}/${seed}: stalled rally`
          );
        }
        assert.equal(
          s.phase,
          'over',
          `${surface}/${difficulty}/${seed}: incomplete match`
        );
        assert.ok(s.pointCount >= 4);
        assert.ok(s.bestRally >= 2);
      }
});
