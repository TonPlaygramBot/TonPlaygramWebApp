import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMatch,
  stepMatch,
  advance,
  setInput,
  neutralInput
} from '../shared/tennis/engine.js';
import {
  lineCall,
  HALF_WIDTH,
  HALF_LENGTH,
  SERVICE,
  CONTACT_RADIUS,
  CENTRE_LINE_HALF,
  BALL_RADIUS,
  GRAVITY,
  REVIEW_SECONDS,
  reviewActive,
  reviewBall
} from '../shared/tennis/court.js';

function landing(x, z, { seat = 0, serve = false, dt = 0.025 } = {}) {
  const s = createMatch({ ai: false });
  s.phase = 'rally';
  s.time = 5;
  s.phaseAt = 4;
  s.score.server = seat;
  s.players[seat].x = seat ? -1.8 : 1.8;
  Object.assign(s.ball, {
    x: x - 45 * dt,
    z: z + 30 * dt,
    y: BALL_RADIUS + 4 * dt - (GRAVITY * dt * dt) / 2,
    vx: 45,
    vy: -4 + GRAVITY * dt,
    vz: -30,
    last: seat,
    serve,
    bounces: 0
  });
  return s;
}

test('footprint contact with singles lines is in; tiny gaps and corner misses are out', () => {
  for (const seat of [0, 1]) {
    const sign = seat === 0 ? -1 : 1;
    for (const edge of [-1, 1]) {
      assert.equal(
        lineCall(edge * (HALF_WIDTH + CONTACT_RADIUS), sign * 8, seat).in,
        true
      );
      assert.equal(
        lineCall(edge * (HALF_WIDTH + CONTACT_RADIUS + 0.0001), sign * 8, seat)
          .in,
        false
      );
    }
    assert.equal(
      lineCall(0, sign * (HALF_LENGTH + CONTACT_RADIUS), seat).in,
      true
    );
    assert.equal(
      lineCall(HALF_WIDTH + 0.025, sign * (HALF_LENGTH + 0.025), seat).in,
      false
    );
    assert.equal(
      lineCall(HALF_WIDTH + 0.02, sign * (HALF_LENGTH + 0.02), seat).in,
      true
    );
  }
});

test('both diagonal service boxes include the centre and service paint', () => {
  for (const seat of [0, 1])
    for (const serverX of [-1.8, 1.8]) {
      const sign = seat === 0 ? -1 : 1,
        edge = Math.sign(serverX) * (CENTRE_LINE_HALF + CONTACT_RADIUS);
      assert.equal(lineCall(edge, sign * 3, seat, true, serverX).in, true);
      assert.equal(
        lineCall(
          edge + Math.sign(serverX) * 0.001,
          sign * 3,
          seat,
          true,
          serverX
        ).in,
        false
      );
      assert.equal(
        lineCall(
          -serverX,
          sign * (SERVICE + CONTACT_RADIUS),
          seat,
          true,
          serverX
        ).in,
        true
      );
      assert.equal(
        lineCall(
          -serverX,
          sign * (SERVICE + CONTACT_RADIUS + 0.001),
          seat,
          true,
          serverX
        ).in,
        false
      );
    }
});

test('45 m/s line calls use the exact intersection at every simulation step size', () => {
  for (const step of [1 / 30, 1 / 60, 1 / 120, 1 / 240]) {
    const s = landing(HALF_WIDTH + CONTACT_RADIUS + 0.002, -8);
    while (s.phase === 'rally') stepMatch(s, step);
    assert.ok(reviewActive(s));
    assert.ok(
      Math.abs(s.review.call.x - (HALF_WIDTH + CONTACT_RADIUS + 0.002)) < 1e-9
    );
    assert.ok(Math.abs(s.review.call.margin + 0.002) < 1e-9);
    assert.equal(s.pointCount, 1);
    assert.equal(s.lastPoint, 1);
  }
});

test('a close IN bounce waits for the point to finish before replaying', () => {
  const s = landing(HALF_WIDTH - 0.04, -8);
  stepMatch(s, 1 / 30);
  assert.equal(s.phase, 'rally');
  assert.equal(s.review, null);
  assert.equal(s.closeCall.call.in, true);
  const impact = structuredClone(s.closeCall);
  while (s.phase === 'rally') advance(s, 0.05);
  assert.ok(reviewActive(s));
  assert.deepEqual(s.review.impact, impact.impact);
  assert.equal(s.lastPoint, 0);
  assert.equal(s.pointCount, 1);
  const before = reviewBall(s.review, -0.025);
  assert.ok(Math.abs(before.x - (impact.impact.x - 45 * 0.025)) < 1e-9);
  const at = reviewBall(s.review, 0);
  assert.equal(at.y, BALL_RADIUS);
  assert.equal(at.x, impact.call.x);
  assert.ok(reviewBall(s.review, 0.05).y > BALL_RADIUS);
});

test('review pauses live play, consumes stray input, and resumes once', () => {
  const s = landing(HALF_WIDTH + 0.04, -8);
  stepMatch(s, 1 / 30);
  const ball = structuredClone(s.ball),
    count = s.pointCount;
  setInput(s, 0, { ...neutralInput(), swing: 20, power: 1 });
  for (let i = 0; i < 4; i++) advance(s, 1);
  assert.ok(reviewActive(s));
  assert.deepEqual(s.ball, ball);
  assert.equal(s.players[0].queuedInput, null);
  assert.equal(s.pointCount, count);
  advance(s, 1);
  advance(s, 1);
  assert.equal(reviewActive(s), false);
  assert.equal(s.phase, 'serve');
  assert.equal(s.pointCount, count);
  assert.equal(s.players[0].queued, 0);
});

test('first faults and match-winning calls complete their replay without changing the score twice', () => {
  const fault = landing(-1.8, -SERVICE - 0.04, { serve: true });
  stepMatch(fault, 1 / 30);
  assert.equal(fault.fault, 1);
  assert.equal(fault.pointCount, 0);
  assert.ok(reviewActive(fault));
  for (let i = 0; i < 6; i++) advance(fault, 1);
  assert.equal(fault.phase, 'serve');
  assert.equal(fault.fault, 1);
  const match = landing(HALF_WIDTH + 0.04, -8);
  match.score.points = [0, 3];
  stepMatch(match, 1 / 30);
  assert.equal(match.phase, 'over');
  assert.equal(match.winner, 1);
  assert.ok(reviewActive(match));
  for (let i = 0; i < 6; i++) advance(match, 1);
  assert.equal(reviewActive(match), false);
  assert.equal(match.pointCount, 1);
  assert.deepEqual(match.score.sets, [0, 1]);
  assert.ok(match.time >= 5 + REVIEW_SECONDS);
});
