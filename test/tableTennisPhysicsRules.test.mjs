import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMatch,
  advance,
  setInput,
  side,
  initialScore,
  awardPoint
} from '../shared/tabletennis/engine.js';
import { advanceBall, ballAtRest } from '../shared/tabletennis/physics.js';
import {
  beginSwipe,
  sampleSwipe,
  readSwipe
} from '../shared/tabletennis/swipe.js';
const ball = (patch = {}) => ({
  x: 0,
  y: 1.08,
  z: 0.5,
  vx: 0,
  vy: 0,
  vz: 0,
  spin: 0,
  netTouch: false,
  ...patch
});
function rally(patch = {}, config = {}) {
  const s = createMatch({ ai: false, ...config });
  s.phase = 'rally';
  s.inputs.forEach((i) => (i.autoHit = false));
  Object.assign(s.ball, {
    serve: false,
    last: 0,
    x: 0,
    y: 0.82,
    z: -0.7,
    vx: 0,
    vy: -2,
    vz: 0,
    bounces: 0,
    ...patch
  });
  return s;
}
test('30 cm table drop rebounds 23 cm; floor impact keeps moving until it settles', () => {
  const b = ball();
  let bounced = false,
    peak = 0.78;
  for (let i = 0; i < 300; i++) {
    advanceBall(b, 1 / 240, (c) => {
      if (c.kind === 'table') bounced = true;
    });
    if (bounced) peak = Math.max(peak, b.y);
  }
  assert.ok(Math.abs(peak - 0.78 - 0.23) < 0.001);
  const floor = ball({ x: 2, y: 0.07, vy: -3, vx: 1 });
  advanceBall(floor, 1 / 30);
  assert.ok(floor.vy > 0);
  assert.ok(floor.vx > 0);
  for (let i = 0; i < 2400; i++) advanceBall(floor, 1 / 240);
  assert.ok(ballAtRest(floor));
  assert.equal(floor.y, 0.02);
});
test('upper edges are playing surface; vertical apron and misses are out', () => {
  for (const x of [0.7625, 0.768, 0.779]) {
    const s = rally({ x });
    for (let i = 0; i < 15; i++) advance(s, 1 / 240);
    assert.equal(s.pointCount, 0);
    assert.equal(s.ball.bounces, 1);
    assert.ok(
      s.ball.vy > 0 || s.events.some((e) => e.label === 'Top edge · in')
    );
  }
  for (const b of [
    { x: 0.82, y: 0.75, vx: -4, vy: 0 },
    { x: 0.79, y: 0.81, vy: -2 }
  ]) {
    const s = rally(b);
    for (let i = 0; i < 240 && s.phase === 'rally'; i++) advance(s, 1 / 240);
    assert.equal(s.lastPoint, 1);
    assert.equal(s.pointCount, 1);
  }
});
test('swept collisions do not tunnel through the table at high speed', () => {
  for (const speed of [4, 12, 30, 60]) {
    const b = ball({ y: 0.9, vy: -speed, vx: 2 });
    let hits = 0;
    advanceBall(b, 1 / 30, (c) => {
      if (c.kind === 'table') hits++;
    });
    assert.equal(hits, 1);
    assert.ok(b.vy > 0);
    assert.ok(b.y >= 0.78);
  }
});
test('228 serve combinations: both seats, both ends, full power range and modest diagonals', () => {
  for (const seat of [0, 1])
    for (const ends of [false, true])
      for (let n = 2; n <= 20; n++)
        for (const slope of [-0.12, 0, 0.12]) {
          const s = createMatch({ ai: false, firstServer: seat });
          s.endsSwapped = s.score.endsSwapped = ends;
          s.ball.z = side(seat, s) * 1.58;
          s.players.forEach((p, n) => (p.z = side(n, s) * 1.7));
          s.inputs.forEach((i) => (i.autoHit = false));
          setInput(s, seat, {
            swing: 1,
            power: n / 20,
            direction: { x: slope, z: -side(seat, s) },
            autoHit: false
          });
          let peak = 1.04;
          for (
            let j = 0;
            j < 1000 && s.ball.serveStage < 2 && s.phase !== 'point';
            j++
          ) {
            advance(s, 1 / 240);
            if (s.phase === 'toss') peak = Math.max(peak, s.ball.y);
          }
          assert.ok(peak >= 1.2);
          assert.equal(
            s.ball.serveStage,
            2,
            JSON.stringify({ seat, ends, n, slope })
          );
          assert.equal(s.phase, 'rally');
          assert.equal(s.pointCount, 0);
          assert.deepEqual(
            s.events.filter((e) => e.type === 'bounce').map((e) => e.seat),
            [seat, 1 - seat]
          );
        }
});
test('return pace grows with swipe power for every stroke and preserves the supplied heading', () => {
  for (const seat of [0, 1])
    for (const shot of ['drive', 'topspin', 'backspin', 'smash']) {
      const speeds = [];
      for (const power of [0.1, 0.45, 1]) {
        const sign = side(seat),
          s = rally({
            last: 1 - seat,
            z: sign * 1.18,
            y: 1.08,
            vy: 0.3,
            vz: sign,
            bounces: 1
          });
        setInput(s, seat, {
          swing: 1,
          power,
          shot,
          direction: { x: 0.06, z: -sign },
          autoHit: false
        });
        advance(s, 1 / 240);
        assert.equal(s.ball.last, seat);
        speeds.push(Math.hypot(s.ball.vx, s.ball.vz));
        assert.ok(Math.abs(s.ball.vx / s.ball.vz - 0.06 / -sign) < 1e-9);
      }
      assert.ok(speeds[1] > speeds[0]);
      assert.ok(speeds[2] > speeds[1], JSON.stringify({ shot, speeds }));
    }
});
test('same-distance fast flick is stronger; a hold adds no power and does not reuse stale motion', () => {
  function swipe(ms) {
    const s = beginSwipe(0, 0, 0, 390);
    for (let n = 1; n <= 8; n++)
      sampleSwipe(s, 0, (-120 * n) / 8, (ms * n) / 8);
    return s;
  }
  assert.ok(readSwipe(swipe(48)).power > readSwipe(swipe(480)).power + 0.5);
  const held = swipe(48);
  sampleSwipe(held, 0, -120, 1000);
  assert.equal(readSwipe(held).power, 0.1);
  sampleSwipe(held, 0, -240, 1048);
  assert.ok(readSwipe(held).power > 0.5);
});
test('net-touch return can land legally; let serve repeats without changing points or server', () => {
  const ret = rally({ z: 0.02, y: 0.919, vz: -3, vy: -0.2 });
  for (
    let i = 0;
    i < 240 && ret.ball.bounces === 0 && ret.phase === 'rally';
    i++
  )
    advance(ret, 1 / 240);
  assert.ok(ret.events.some((e) => e.type === 'net'));
  assert.equal(ret.ball.bounces, 1);
  assert.equal(ret.pointCount, 0);
  const serve = rally({ serve: true, serveStage: 1, netTouch: true });
  advance(serve, 0.04);
  assert.equal(serve.message, 'Let · serve again');
  assert.equal(serve.pointCount, 0);
  assert.equal(serve.score.server, 0);
});
test('terminal point is awarded once while the ball continues bouncing and comes to rest', () => {
  const s = rally({ bounces: 1 }, { gamesToWin: 1 });
  s.score.points = [10, 4];
  advance(s, 0.04);
  assert.equal(s.phase, 'over');
  assert.ok(s.ball.vy > 0);
  const score = structuredClone(s.score);
  for (let i = 0; i < 300; i++) advance(s, 0.1);
  assert.ok(ballAtRest(s.ball));
  assert.equal(s.pointCount, 1);
  assert.deepEqual(s.score, score);
});
test('a 20 second wait is not a service fault; early input waits for a legal bounce', () => {
  const s = createMatch({ ai: false });
  for (let i = 0; i < 301; i++) advance(s, 0.1);
  assert.equal(s.phase, 'serve');
  assert.equal(s.pointCount, 0);
  const early = rally({ last: 1, z: 1.1, y: 0.84, vz: 0.5, vy: -1 });
  setInput(early, 0, { swing: 1, power: 0.2, autoHit: false });
  advance(early, 1 / 240);
  assert.equal(early.ball.last, 1);
  assert.equal(early.pointCount, 0);
  for (let i = 0; i < 40 && early.ball.last !== 0; i++) advance(early, 1 / 240);
  assert.equal(early.ball.last, 0);
  assert.equal(early.pointCount, 0);
});
test('ends change after games and once at five in a deciding game; player identities stay stable', () => {
  const s = initialScore(1);
  for (let i = 0; i < 11; i++) awardPoint(s, 0, 2);
  assert.equal(s.endsSwapped, true);
  assert.equal(s.firstServer, 0);
  for (let i = 0; i < 11; i++) awardPoint(s, 1, 2);
  assert.equal(s.endsSwapped, false);
  assert.equal(s.firstServer, 1);
  for (let i = 0; i < 5; i++) awardPoint(s, 0, 2);
  assert.equal(s.endsSwapped, true);
  assert.equal(s.decidingEndChanged, true);
  for (let i = 0; i < 5; i++) awardPoint(s, 1, 2);
  assert.equal(s.endsSwapped, true);
  assert.deepEqual(s.points, [5, 5]);
  assert.deepEqual(s.games, [1, 1]);
});
test('expedite starts at ten minutes below 18 points, alternates service and counts 13 receiver returns', () => {
  const s = rally();
  s.gamePlayTime = 599.999;
  advance(s, 1 / 240);
  assert.equal(s.score.expedite, true);
  assert.equal(s.pointCount, 0);
  assert.equal(s.score.server, 0);
  awardPoint(s.score, 1);
  assert.equal(s.score.server, 1);
  awardPoint(s.score, 0);
  assert.equal(s.score.server, 0);
  const busy = rally();
  busy.gamePlayTime = 601;
  busy.score.points = [9, 9];
  advance(busy, 1 / 240);
  assert.equal(busy.score.expedite, false);
  const returns = rally({ last: 1, z: 0.5 });
  returns.score.expedite = true;
  returns.receiverReturns = 12;
  advance(returns, 0.04);
  assert.equal(returns.lastPoint, 1);
  assert.equal(returns.message, 'Expedite · 13 returns');
});
