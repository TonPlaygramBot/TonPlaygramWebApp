import test from 'node:test';
import assert from 'node:assert/strict';
import {
  beginSwipe,
  sampleSwipe,
  readSwipe,
  swipeShot,
  screenAim,
  TAP_POWER
} from '../shared/tennis/swipe.js';
import {
  createMatch,
  neutralInput,
  setInput,
  advance,
  side
} from '../shared/tennis/engine.js';

function swipe(duration, width = 390, samples = 12, delay = 0) {
  const gesture = beginSwipe(width * 0.2, width, 0, width);
  if (delay) sampleSwipe(gesture, width * 0.2, width, delay);
  for (let i = 1; i <= samples; i++)
    sampleSwipe(
      gesture,
      width * (0.2 + (0.45 * i) / samples),
      width,
      delay + (duration * i) / samples
    );
  return gesture;
}

test('same-distance fast swipes are stronger; holding still never charges', () => {
  const slow = readSwipe(swipe(750)).power,
    medium = readSwipe(swipe(240)).power,
    fast = readSwipe(swipe(80)).power;
  assert.ok(slow < medium && medium < fast);
  assert.equal(fast, 1);
  const hold = beginSwipe(100, 400, 0, 390);
  sampleSwipe(hold, 100, 400, 4000);
  assert.equal(readSwipe(hold).power, TAP_POWER);
  assert.equal(readSwipe(swipe(80), 1000).power, TAP_POWER);
  assert.ok(readSwipe(swipe(80, 390, 12, 3000)).power > 0.85);
});

test('phone width and pointer event frequency do not alter equivalent swipe power', () => {
  const baseline = readSwipe(swipe(240)).power;
  for (const width of [320, 390, 480, 768])
    for (const frequency of [2, 4, 12, 60])
      assert.ok(
        Math.abs(readSwipe(swipe(240, width, frequency)).power - baseline) <
          1e-8
      );
});

test('jitter, duplicate timestamps, and out-of-order input stay finite and bounded', () => {
  const gesture = beginSwipe(200, 400, 0, 390);
  sampleSwipe(gesture, 201, 401, 4);
  assert.equal(readSwipe(gesture).power, TAP_POWER);
  sampleSwipe(gesture, 300, 400, 4);
  sampleSwipe(gesture, 900, 400, 2);
  sampleSwipe(gesture, NaN, Infinity, 10);
  assert.ok(Number.isFinite(readSwipe(gesture).power));
  assert.ok(readSwipe(gesture).power <= 1);
});

test('up/down strokes and left/right aiming follow the screen for both seats', () => {
  const up = beginSwipe(200, 450, 0, 390);
  sampleSwipe(up, 200, 300, 80);
  assert.equal(swipeShot(up), 'topspin');
  const lob = beginSwipe(200, 450, 0, 390);
  sampleSwipe(lob, 200, 300, 600);
  assert.equal(swipeShot(lob), 'lob');
  const down = beginSwipe(200, 300, 0, 390);
  sampleSwipe(down, 200, 390, 150);
  assert.equal(swipeShot(down), 'slice');
  for (const seat of [0, 1]) {
    assert.ok(screenAim(0.1, seat) * side(seat) < 0);
    assert.ok(screenAim(0.9, seat) * side(seat) > 0);
    assert.equal(Math.abs(screenAim(0.5, seat)), 0);
  }
});

function hit(power, shot, seat = 0, serve = false) {
  const state = createMatch({ ai: false, seed: 423 });
  if (serve && seat === 1) {
    state.score.server = 1;
    state.players[1].x = -1.8;
    state.players[1].z = -12.4;
  }
  if (!serve) {
    state.phase = 'rally';
    state.time = 2;
    state.players[seat].x = 0;
    state.players[seat].z = side(seat) * 9;
    Object.assign(state.ball, {
      x: 0,
      y: 1.2,
      z: side(seat) * 9,
      vx: 0,
      vy: 0,
      vz: side(seat) * 5,
      serve: false,
      bounces: 1,
      last: 1 - seat
    });
  }
  setInput(state, seat, {
    ...neutralInput(),
    assist: false,
    swing: 1,
    power,
    shot
  });
  for (
    let i = 0;
    i < 120 &&
    !state.events.some((e) => e.type === 'hit' || e.type === 'serve');
    i++
  )
    advance(state, 1 / 120);
  assert.ok(state.events.some((e) => e.type === 'hit' || e.type === 'serve'));
  return state;
}

test('faster swipes increase actual ball pace for every stroke and both serving seats', () => {
  for (const seat of [0, 1])
    for (const shot of ['flat', 'topspin', 'slice', 'lob', 'serve']) {
      const slow = hit(
        0.2,
        shot === 'serve' ? 'flat' : shot,
        seat,
        shot === 'serve'
      );
      const fast = hit(
        1,
        shot === 'serve' ? 'flat' : shot,
        seat,
        shot === 'serve'
      );
      assert.ok(
        Math.hypot(fast.ball.vx, fast.ball.vz) >
          Math.hypot(slow.ball.vx, slow.ball.vz) * 1.1,
        `${shot}: faster horizontal ball pace`
      );
      for (const state of [slow, fast]) {
        for (
          let i = 0;
          i < 360 && state.ball.bounces === 0 && state.phase === 'rally';
          i++
        )
          advance(state, 1 / 120);
        assert.ok(
          state.events.some((e) => e.type === 'bounce'),
          `${shot}: legal first bounce`
        );
        assert.equal(state.fault, 0);
      }
    }
});
