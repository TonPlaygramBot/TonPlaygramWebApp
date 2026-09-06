import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMatch,
  advance,
  setInput,
  neutralInput,
  initialScore,
  awardPoint
} from '../shared/tabletennis/engine.js';
test('service alternates in pairs, every point at deuce, and games require a two point margin', () => {
  const s = initialScore();
  awardPoint(s, 0);
  assert.equal(s.server, 0);
  awardPoint(s, 1);
  assert.equal(s.server, 1);
  for (let i = 0; i < 9; i++) {
    awardPoint(s, 0);
    awardPoint(s, 1);
  }
  assert.deepEqual(s.points, [10, 10]);
  assert.equal(s.server, 0);
  assert.equal(awardPoint(s, 0), false);
  assert.equal(s.server, 1);
  assert.equal(s.games[0], 0);
  awardPoint(s, 1);
  assert.equal(s.server, 0);
  awardPoint(s, 0);
  awardPoint(s, 0);
  assert.equal(s.games[0], 1);
  assert.deepEqual(s.history, [[13, 11]]);
  assert.equal(s.server, 1);
  for (let i = 0; i < 11; i++) awardPoint(s, 0);
  assert.equal(s.games[0], 2);
});
test('serve toss clears 16cm, first bounces on server half then receiver half', () => {
  const s = createMatch({ ai: false });
  setInput(s, 0, { ...neutralInput(), swing: 1 });
  let peak = 1.04;
  for (let n = 0; n < 400 && s.ball.serveStage < 2; n++) {
    advance(s, 1 / 240);
    if (s.phase === 'toss') peak = Math.max(peak, s.ball.y);
  }
  assert.ok(peak >= 1.2);
  assert.equal(s.ball.serveStage, 2);
  assert.deepEqual(
    s.events.filter((e) => e.type === 'bounce').map((e) => e.seat),
    [0, 1]
  );
  assert.deepEqual(s.score.points, [0, 0]);
});
test('a correct net-touch serve is a let, with no point or service change', () => {
  const s = createMatch({ ai: false });
  Object.assign(s, { phase: 'rally' });
  Object.assign(s.ball, {
    x: 0,
    z: -0.3,
    y: 0.8,
    vx: 0,
    vz: -1,
    vy: -2,
    serve: true,
    serveStage: 1,
    netTouch: true,
    last: 0
  });
  advance(s, 0.04);
  assert.equal(s.phase, 'point');
  assert.equal(s.message, 'Let · serve again');
  assert.deepEqual(s.score.points, [0, 0]);
  assert.equal(s.score.server, 0);
});
test('net, missed table and second bounce award the correct player', () => {
  for (const [patch, winner] of [
    [{ x: 0, z: 0.01, y: 0.82, vz: -4, vy: 0, bounces: 0 }, 1],
    [{ x: 1, z: -1, y: 0.11, vy: -3, vz: -1, bounces: 0 }, 1],
    [{ x: 0, z: -1, y: 0.79, vy: -3, vz: 0, bounces: 1 }, 0]
  ]) {
    const s = createMatch({ ai: false });
    s.phase = 'rally';
    s.inputs.forEach((i) => (i.autoHit = false));
    Object.assign(s.ball, { last: 0, serve: false, ...patch });
    advance(s, 0.04);
    assert.equal(s.score.points[winner], 1);
  }
});
test('controls reject nonfinite numbers, invalid shots and swing replay', () => {
  const s = createMatch();
  setInput(s, 0, {
    ...neutralInput(),
    aim: Infinity,
    power: NaN,
    moveX: 100,
    shot: 'hack',
    swing: 5
  });
  assert.equal(s.inputs[0].aim, 0);
  assert.equal(s.inputs[0].power, 0.5);
  assert.equal(s.inputs[0].moveX, 1.12);
  assert.equal(s.inputs[0].shot, 'drive');
  setInput(s, 0, { swing: 1 });
  assert.equal(s.inputs[0].swing, 5);
});
test('fixed step simulation is deterministic across frame partitions', () => {
  const a = createMatch({ seed: 81 }),
    b = createMatch({ seed: 81 });
  setInput(a, 0, { swing: 1 });
  setInput(b, 0, { swing: 1 });
  for (let i = 0; i < 180; i++) advance(a, 1 / 60);
  for (let i = 0; i < 360; i++) advance(b, 1 / 120);
  assert.deepEqual(a, b);
});
test('AI matches finish with rallies across all difficulty and match length choices', () => {
  for (const difficulty of [0, 1, 2])
    for (const gamesToWin of [1, 2, 3]) {
      const s = createMatch({ seed: 41, difficulty, gamesToWin });
      let swing = 0;
      for (let n = 0; n < 100000 && s.phase !== 'over'; n++) {
        if (s.phase === 'serve' && s.score.server === 0)
          setInput(s, 0, { ...neutralInput(), swing: ++swing, aim: 0.85 });
        advance(s, 0.1);
      }
      assert.equal(s.phase, 'over');
      assert.ok(s.bestRally > 2);
      assert.equal(Math.max(...s.score.games), gamesToWin);
      assert.ok(
        s.score.history.every(
          (p) => Math.max(...p) >= 11 && Math.abs(p[0] - p[1]) >= 2
        )
      );
    }
});
