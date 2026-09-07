import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createState,
  control,
  advanceState,
  collide,
  lineOfSight,
  upgradeState,
  insidePolygon,
  WORLD
} from '../webapp/src/games/tiranastreets/shared/engine.mjs';
import {
  SHOP,
  insideShop,
  canReachCounter,
  SIGNALS,
  signalPhase,
  pedestrianGreen,
  stopForSignal,
  onCarriageway
} from '../webapp/src/games/tiranastreets/shared/streetLayout.mjs';
const fixture = () => createState([{ id: 'p', name: 'Walker' }], 'free-roam');
test('a person walks through the open shop door, reaches the counter, exits, and cannot walk through a wall', () => {
  const state = fixture(),
    p = state.players.p;
  Object.assign(p, { x: SHOP.x, z: SHOP.z + 6, carId: null, weapon: null });
  for (let i = 0; i < 80; i++) {
    control(state, 'p', { x: 0, y: 1, yaw: 0, seq: i + 1 });
    advanceState(state, 1 / 60);
  }
  assert.ok(insideShop(p));
  assert.ok(canReachCounter(p));
  assert.ok(
    lineOfSight({ x: SHOP.x, z: SHOP.z + 5 }, { x: SHOP.x, z: SHOP.z })
  );
  assert.equal(
    lineOfSight({ x: SHOP.x - 6, z: SHOP.z }, { x: SHOP.x, z: SHOP.z }),
    false
  );
  const wall = { x: SHOP.x - 4.9, z: SHOP.z };
  assert.ok(collide(wall, 0.4));
  assert.ok(Math.abs(wall.x - SHOP.x + 4.9) > 0.2);
  for (let i = 0; i < 100; i++) {
    control(state, 'p', { x: 0, y: -1, yaw: 0, seq: i + 81 });
    advanceState(state, 1 / 60);
  }
  assert.equal(insideShop(p), false);
  assert.ok(p.z > SHOP.z + 4.2);
  const outside = { x: SHOP.x + 5.1, z: SHOP.z, carId: null };
  assert.equal(canReachCounter(outside), false);
});
test('the shop footprint and front doorway do not overlap mapped buildings', () => {
  for (const dx of [-5.2, 0, 5.2])
    for (const dz of [-4.4, 0, 5.5])
      assert.equal(
        WORLD.buildings.some((b) =>
          insidePolygon(SHOP.x + dx, SHOP.z + dz, b.p)
        ),
        false
      );
});
test('opposing signal phases and the all-red pedestrian interval agree with traffic stops', () => {
  assert.ok(SIGNALS.length > 8);
  for (const s of SIGNALS) {
    const pole = {
      x: s.x + Math.cos(s.yaw) * (s.width / 2 + 0.48),
      z: s.z - Math.sin(s.yaw) * (s.width / 2 + 0.48)
    };
    assert.equal(onCarriageway(pole.x, pole.z, 0.35), false);
    assert.equal(
      WORLD.buildings.some((b) => insidePolygon(pole.x, pole.z, b.p)),
      false
    );
    for (let t = 0; t < 64; t += 0.25) {
      if (pedestrianGreen(s, t)) assert.equal(signalPhase(s, t), 'red');
    }
    const v = {
      x: s.x + Math.sin(s.yaw) * 4,
      z: s.z + Math.cos(s.yaw) * 4,
      heading: s.yaw
    };
    const offset = s.junction * 1.7;
    assert.equal(stopForSignal(v, 26 - offset), true);
  }
});
test('walking headings point along displacement for every portrait input and camera direction', () => {
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2])
    for (const [x, y] of [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0]
    ]) {
      const state = fixture(),
        p = state.players.p;
      Object.assign(p, { x: SHOP.x, z: SHOP.z + 1, carId: null, weapon: null });
      const start = { x: p.x, z: p.z };
      control(state, 'p', { x, y, yaw, seq: 1 });
      advanceState(state, 1 / 60);
      const dx = p.x - start.x,
        dz = p.z - start.z;
      assert.ok(
        (-Math.sin(p.heading) * dx - Math.cos(p.heading) * dz) /
          Math.hypot(dx, dz) >
          0.999
      );
    }
});
test('upgrading an active city preserves cash, ammunition, wanted level, NPC damage and pursuit units', () => {
  const s = fixture();
  s.lifeVersion = 2;
  s.npcs = s.npcs.filter(
    (n) => n.kind === 'dealer' || Number(n.id.split('-').pop()) < 28
  );
  s.npcs[1].health = 47;
  s.players.p.cash = 123;
  s.players.p.wanted = 312;
  s.elapsed = 98;
  s.units = [{ id: 'existing-unit' }];
  const inv = structuredClone(s.players.p.inventory);
  upgradeState(s);
  assert.equal(s.lifeVersion, 3);
  assert.equal(s.npcs.filter((n) => n.kind === 'civilian').length, 72);
  assert.equal(s.npcs.find((n) => n.id === 'citizen-0').health, 47);
  assert.equal(s.players.p.cash, 123);
  assert.equal(s.players.p.wanted, 312);
  assert.deepEqual(s.players.p.inventory, inv);
  assert.equal(s.units[0].id, 'existing-unit');
  assert.equal(s.elapsed, 98);
});

import {
  dragLook,
  DEFAULT_PITCH
} from '../webapp/src/games/tiranastreets/shared/aim.mjs';
import {
  RAILINGS,
  RIVER_TREES,
  RIVER_SEGMENTS,
  collideRailings,
  nearBridge,
  onFootpath
} from '../webapp/src/games/tiranastreets/shared/landscape.mjs';
import { sanitizeInput } from '../webapp/src/games/tiranastreets/shared/engine.mjs';
test('portrait finger motion turns the camera right/up on screen and pitch remains bounded', () => {
  const right = dragLook(0, DEFAULT_PITCH, 80, 0, 390, 844),
    up = dragLook(0, DEFAULT_PITCH, 0, -80, 390, 844);
  assert.ok(-Math.sin(right.yaw) > 0);
  assert.ok(up.pitch > DEFAULT_PITCH);
  assert.ok(Math.abs(DEFAULT_PITCH) < 0.06);
  assert.ok(dragLook(0, 0, 0, -1e6).pitch <= 0.7);
  assert.ok(dragLook(0, 0, 0, 1e6).pitch >= -0.65);
  assert.deepEqual(
    dragLook(0, 0, 40, 0, 390, 844),
    dragLook(0, 0, 40, 0, 844, 390)
  );
  const safe = sanitizeInput({ yaw: 1.5, aimYaw: NaN, aimPitch: Infinity });
  assert.equal(safe.aimPitch, 0);
  assert.ok(Number.isFinite(safe.aimYaw));
  assert.equal(sanitizeInput({ yaw: 1.5 }).aimYaw, 1.5);
});
test('iron railing collision is shared, keeps mapped footpaths and bridge approaches clear', () => {
  assert.ok(RAILINGS.length > 500);
  assert.ok(RIVER_TREES.length > 80);
  for (const r of RAILINGS) {
    assert.ok(r.length > 0 && r.length < 2.7);
    assert.equal(nearBridge(r.x, r.z, 2.8), false);
    if (!r.river) assert.equal(onFootpath(r.x, r.z, 1.2), false);
  }
  const r = RAILINGS.find((r) => !r.river),
    p = { x: r.x, z: r.z };
  assert.ok(collideRailings(p, 0.4));
  assert.ok(Math.hypot(p.x - r.x, p.z - r.z) > 0.4);
  assert.ok(RIVER_SEGMENTS.some((s) => s.a[0] < -400 || s.b[0] < -400));
});
