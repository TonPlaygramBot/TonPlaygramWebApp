import test from 'node:test';
import assert from 'node:assert/strict';
import { thumbStick, TouchChannels } from '../webapp/src/games/tiranastreets/shared/touch.mjs';
import {
  STREET_PROPS,
  STREET_SOLIDS,
  collideStreetProps
} from '../webapp/src/games/tiranastreets/shared/streetDressing.mjs';
import {
  SIGNALS,
  onCarriageway,
  pavementHeight
} from '../webapp/src/games/tiranastreets/shared/streetLayout.mjs';

test('two fingers retain independent movement and aim ownership', () => {
  const channels = new TouchChannels();
  assert.equal(channels.begin('move', 8), true);
  assert.equal(channels.begin('look', 13), true);
  assert.equal(channels.begin('look', 21), false);
  assert.equal(channels.end('look', 8), false);
  assert.equal(channels.owns('look', 13), true);
  assert.equal(channels.end('move', 8), true);
  assert.equal(channels.owns('look', 13), true);
  channels.clear();
  assert.equal(channels.owns('look', 13), false);
  assert.equal(channels.begin('look', 21), true);
});
test('one finger cannot drive two competing pedals or camera channels', () => {
  const channels = new TouchChannels();
  assert.equal(channels.begin('gas', 3), true);
  assert.equal(channels.begin('gas', 4), false);
  assert.equal(channels.begin('brake', 3), false);
  assert.equal(channels.begin('brake', 4), true);
  assert.equal(channels.end('gas', 4), false);
});
test('portrait thumbstick preserves screen directions and clamps diagonals', () => {
  for (const [dx, dy, x, y] of [
    [50, 0, 1, 0],
    [-50, 0, -1, 0],
    [0, -50, 0, 1],
    [0, 50, 0, -1]
  ]) {
    const stick = thumbStick(dx, dy, 50);
    assert.ok(Math.abs(stick.x - x) < 1e-9 && Math.abs(stick.y - y) < 1e-9);
    assert.ok(
      Math.sign(stick.knobX) === Math.sign(dx) &&
        Math.sign(stick.knobY) === Math.sign(dy)
    );
  }
  const diagonal = thumbStick(200, -200, 50);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 1) < 1e-9);
  assert.ok(Math.hypot(diagonal.knobX, diagonal.knobY) <= 36.001);
  assert.equal(thumbStick(2, 2, 50).x, 0);
});
test('outer ring auto-run has hysteresis and never activates while driving', () => {
  assert.equal(thumbStick(0, -46, 50).sprint, true);
  assert.equal(thumbStick(0, -43, 50).sprint, false);
  assert.equal(thumbStick(0, -43, 50, false, true).sprint, true);
  assert.equal(thumbStick(0, -37, 50, false, true).sprint, false);
  assert.equal(thumbStick(0, -70, 50, true).sprint, false);
  for (const args of [
    [NaN, 0, 50],
    [0, Infinity, 50],
    [0, 0, 0]
  ])
    assert.equal(thumbStick(...args).sprint, false);
});
test('solid street furniture stays off traffic lanes and crossing approaches', () => {
  assert.ok(STREET_PROPS.filter((p) => p.name === 'bus_shelter').length >= 10);
  for (const p of STREET_PROPS.filter(
    (p) => !['manhole_cover', 'tactile_tile'].includes(p.name)
  )) {
    assert.equal(onCarriageway(p.x, p.z, 0.35), false, p.name);
    assert.ok(pavementHeight(p.x, p.z) > 0.2);
    assert.ok(
      SIGNALS.every((s) => Math.hypot(p.x - s.x, p.z - s.z) >= s.width / 2 + 8)
    );
  }
});
test('rotated planter and cabinet solids eject the actor; shelter entrance stays open', () => {
  for (const s of STREET_SOLIDS.filter((s) =>
    ['utility_cabinet', 'stone_planter'].includes(s.name)
  ).slice(0, 30)) {
    const p = { x: s.x, z: s.z };
    assert.equal(collideStreetProps(p, 0.35), true);
    assert.ok(Math.hypot(p.x - s.x, p.z - s.z) > 0.5);
    assert.equal(collideStreetProps(p, 0.34), false);
  }
  for (const s of STREET_PROPS.filter((p) => p.name === 'bus_shelter')) {
    const p = {
      x: s.x + Math.sin(s.yaw) * 0.5,
      z: s.z + Math.cos(s.yaw) * 0.5
    };
    assert.equal(collideStreetProps(p, 0.3), false, 'Open central entrance');
  }
});
