import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import {
  createMatch,
  advance,
  setInput,
  side
} from '../shared/tabletennis/engine.js';

const compiled = await build({
  entryPoints: [
    new URL('../webapp/src/games/tabletennis/touch.ts', import.meta.url)
      .pathname
  ],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false
});
const { TableTouches, touchShot } = await import(
  'data:text/javascript;base64,' +
    Buffer.from(compiled.outputFiles[0].text).toString('base64')
);

test('a tap with finger jitter stays soft, including a long hold', () => {
  for (const duration of [8, 5000]) {
    const t = new TableTouches();
    t.down(1, 100, 100, 0, 390);
    const result = t.up(1, 106, 100, duration);
    assert.equal(result.kind, 'tap');
    assert.equal(result.power, 0.1);
    assert.equal(result.dx, 0);
    assert.equal(result.dy, 0);
  }
});

test('two fingers open settings only after both lift, without charging a shot', () => {
  for (const duration of [50, 5000]) {
    const t = new TableTouches();
    t.down(1, 100, 100, 0, 390);
    t.down(2, 200, 100, 5, 390);
    assert.equal(t.up(1, 100, 100, duration), null);
    const result = t.up(2, 200, 100, duration + 1);
    assert.equal(result.kind, 'menu');
    assert.equal(result.power, 0.1);
    assert.equal(t.up(2, 200, 100, duration + 2), null);
  }
});

test('two-finger backspin commits once and retains the primary finger heading', () => {
  for (const first of [1, 2]) {
    const t = new TableTouches();
    t.down(1, 100, 200, 0, 390);
    t.down(2, 200, 200, 2, 390);
    for (let n = 1; n <= 4; n++) {
      t.move(1, 100 + n * 10, 200 - n * 30, n * 16);
      t.move(2, 200 + n * 10, 200 - n * 30, n * 16);
    }
    const point = (id) => (id === 1 ? [140, 80] : [240, 80]);
    assert.equal(t.up(first, ...point(first), 65), null);
    const result = t.up(3 - first, ...point(3 - first), 66);
    assert.equal(result.kind, 'swipe');
    assert.equal(touchShot(result, true), 'backspin');
    assert.ok(result.power > 0.8);
    assert.ok(Math.abs(result.dx / result.dy + 1 / 3) < 1e-9);
    assert.equal(t.up(1, 140, 80, 70), null);
  }
});

test('cancelled or three-finger gestures never commit; the next tap remains soft', () => {
  const t = new TableTouches();
  t.down(1, 100, 200, 0, 390);
  t.move(1, 100, 40, 40);
  t.clear();
  assert.equal(t.up(1, 100, 40, 42), null);
  for (const id of [1, 2, 3]) t.down(id, id * 80, 200, 100, 390);
  for (const id of [1, 2, 3]) assert.equal(t.up(id, id * 80, 200, 150), null);
  t.down(1, 100, 200, 200, 390);
  assert.equal(t.up(1, 100, 200, 220).power, 0.1);
});

test('stroke selection follows velocity and ball height without changing direction', () => {
  const result = (duration) => {
    const t = new TableTouches();
    t.down(1, 100, 200, 0, 390);
    for (let n = 1; n <= 8; n++)
      t.move(1, 100 + n * 5, 200 - n * 15, (duration * n) / 8);
    return t.up(1, 140, 80, duration + 1);
  };
  const slow = result(480),
    fast = result(48);
  assert.equal(touchShot(slow, false), 'drive');
  assert.equal(touchShot(fast, false), 'topspin');
  assert.equal(touchShot(fast, true), 'smash');
  assert.ok(fast.power > slow.power + 0.5);
  assert.ok(Math.abs(slow.dx / slow.dy - fast.dx / fast.dy) < 1e-9);
});

test('manual depth targets are finite and confined to the player half at either end', () => {
  for (const seat of [0, 1])
    for (const ends of [false, true]) {
      const s = createMatch({ ai: false });
      s.endsSwapped = ends;
      const sign = side(seat, s);
      setInput(s, seat, { power: 0.5 });
      assert.equal(s.inputs[seat].moveX, null);
      assert.equal(s.inputs[seat].moveZ, null);
      setInput(s, seat, { moveZ: sign * 100 });
      assert.equal(s.inputs[seat].moveZ, sign * 2.27);
      setInput(s, seat, { moveZ: -sign * 100 });
      assert.equal(s.inputs[seat].moveZ, sign * 1.55);
      setInput(s, seat, { moveZ: NaN });
      assert.equal(s.inputs[seat].moveZ, sign * 1.55);
      setInput(s, seat, { moveZ: null });
      assert.equal(s.inputs[seat].moveZ, null);
    }
});

test('manual dragging moves both axes and releasing restores assisted footwork', () => {
  for (const seat of [0, 1])
    for (const ends of [false, true]) {
      const s = createMatch({ ai: false });
      s.endsSwapped = ends;
      s.phase = 'rally';
      s.players.forEach((p, n) => (p.z = side(n, s) * 1.7));
      Object.assign(s.ball, {
        x: 0,
        y: 5,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        last: seat,
        serve: false
      });
      const sign = side(seat, s);
      setInput(s, seat, {
        assist: false,
        autoHit: false,
        moveX: 0.4,
        moveZ: sign * 2.1
      });
      for (let n = 0; n < 48; n++) advance(s, 1 / 240);
      assert.ok(Math.abs(s.players[seat].x - 0.4) < 1e-8);
      assert.ok(Math.abs(s.players[seat].z - sign * 2.1) < 1e-8);
      setInput(s, seat, { assist: true, moveX: null, moveZ: null });
      for (let n = 0; n < 48; n++) advance(s, 1 / 240);
      assert.ok(Math.abs(s.players[seat].x) < 1e-8);
      assert.ok(Math.abs(s.players[seat].z - sign * 1.7) < 1e-8);
    }
});
