import test from 'node:test';
import assert from 'node:assert/strict';
import * as simulation from '../webapp/src/games/kartroyale/simulation.mjs';
import {
  resolveKartContact,
  resolveWallContact
} from '../webapp/src/games/kartroyale/collisions.mjs';
import { TIRANA_ROUTES } from '../webapp/src/games/kartroyale/tirana-routes.mjs';
import { WORLD } from '../webapp/src/games/tiranastreets/shared/world.mjs';
import {
  launchFood,
  stepFood,
  foodHit
} from '../webapp/src/games/kartroyale/foodFlight.mjs';
import { validateSeatTableRequest } from '../bot/config/onlineGamePolicy.js';
const {
  TRACKS,
  makeTrack,
  createRacer,
  damageRacer,
  stepRacer,
  stepRace,
  STEP
} = simulation;
const blank = { steer: 0, brake: true, drift: false, boost: false };
const racer = (id = 'a', slot = 0) => {
  const r = createRacer(makeTrack(), id, id, slot);
  Object.assign(r, { x: 0, z: 0, yaw: 0, velocityYaw: 0, speed: 0 });
  return r;
};
const energy = (rs) => rs.reduce((s, r) => s + r.speed * r.speed, 0);

test('all six circuits use closed, unique paths from Tirana Streets road segments', () => {
  assert.deepEqual(
    TRACKS.map((t) => t.id),
    ['skanderbeg', 'blloku', 'lana', 'pyramid', 'stadium','lana-pyramid-grand']
  );
  const edges = new Set(
    WORLD.roads
      .filter((r) => !r.walk)
      .flatMap((r) => [JSON.stringify([r.a, r.b]), JSON.stringify([r.b, r.a])])
  );
  for (const route of TIRANA_ROUTES) {
    assert.equal(
      new Set(route.points.map((p) => p.join(','))).size,
      route.points.length
    );
    route.points.forEach((p, i) =>
      assert.ok(
        edges.has(
          JSON.stringify([p, route.points[(i + 1) % route.points.length]])
        ),
        `${route.id} street continuity`
      )
    );
    const track = makeTrack(route.id);
    assert.ok(track.points.length >= 360 && track.points.length % 4 === 0);
    assert.ok(track.length > 800 && track.length < 2000);
    for (const p of track.points)
      assert.ok(
        Number.isFinite(p.x) && Number.isFinite(p.z) && Number.isFinite(p.yaw)
      );
    assert.ok(route.streets.length >= 3);
  }
});
test('every Tirana circuit is valid in the shared TPG queue; legacy names migrate', () => {
  for (const trackId of [
    ...TRACKS.map((t) => t.id),
    'harbor',
    'neon',
    'canyon',
    'alpine',
    'coast'
  ]) {
    const result = validateSeatTableRequest({
      gameType: 'kartroyale',
      stake: 100,
      maxPlayers: 2,
      matchMeta: { token: 'TPG', mode: 'online', trackId }
    });
    assert.equal(result.ok, true, trackId);
  }
  assert.equal(makeTrack('harbor').id, 'skanderbeg');
  assert.equal(makeTrack('coast').id, 'stadium');
});
test('combat and automatic pickups are absent, including stale client inputs', () => {
  assert.equal(simulation.POWERUPS, undefined);
  assert.equal(simulation.useWeapon, undefined);
  const t = makeTrack(),
    r = createRacer(t, 'a', 'a');
  r.health = 50;
  r.input = { ...blank, use: true };
  stepRace([r], t, STEP, 1);
  assert.equal(r.health, 50);
  assert.equal(r.weapon, undefined);
  assert.equal(r.shield, 0);
  assert.equal(r.shieldActive,false);
});
test('grazing a wall preserves tangential momentum; head-on impact causes greater gradual damage', () => {
  const head = racer(),
    glance = racer();
  Object.assign(head, { z: 5, speed: 25 });
  Object.assign(glance, { z: 5, speed: 25, velocityYaw: Math.acos(0.15) });
  const n = { x: 0, z: 0, distance: 5 };
  resolveWallContact(head, n, 10, STEP);
  resolveWallContact(glance, n, 10, STEP);
  assert.ok(head.health < glance.health);
  assert.ok(
    head.health > 91 && head.health < 93,
    '25 m/s hit costs about 8 integrity'
  );
  assert.ok(glance.speed > 22 && head.speed < 5);
  assert.ok(Math.abs(head.z - (5 - head.bodyLength/2 - .04)) < 1e-9);
  assert.equal(head.impactId, 1);
});
test('minor bumps are harmless, severe impacts are capped, and one contact cannot charge twice', () => {
  const r = racer();
  r.z = 5;
  r.speed = 3;
  resolveWallContact(r, { x: 0, z: 0, distance: 5 }, 10, STEP);
  assert.equal(r.health, 100);
  assert.equal(
    r.impactId,
    1,
    'even a harmless bump gets visual/audio feedback'
  );
  r.impactCooldown = 0;
  r.wallContact = false;
  r.z = 5;
  r.speed = 43;
  r.velocityYaw = 0;
  resolveWallContact(r, { x: 0, z: 0, distance: 5 }, 10, STEP);
  assert.equal(r.health, 86);
  assert.equal(r.retired, false);
  assert.equal(r.impactNz, 1);
  r.wallContact = false;
  r.z = 5;
  r.speed = 43;
  r.velocityYaw = 0;
  resolveWallContact(r, { x: 0, z: 0, distance: 5 }, 10, STEP);
  assert.equal(
    r.health,
    86,
    'recontact within 300 ms does not double-charge damage'
  );
});
test('food follows frame-independent ballistic arcs, can miss, and never mutates racers', () => {
  const r = racer();
  r.speed = 20;
  const before = structuredClone(r);
  const origin = { x: 9, y: 1.6, z: 7 };
  const a = launchFood(origin, r, 'egg', 42),
    b = { ...a };
  for (let i = 0; i < 60; i++) stepFood(a, 1 / 120);
  for (let i = 0; i < 30; i++) stepFood(b, 1 / 60);
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 1e-8);
  assert.deepEqual(r, before);
  assert.equal(
    foodHit({ x: 8, y: 1, z: -2 }, { x: 8, y: 1, z: 2 }, r, r),
    null
  );
  assert.equal(
    foodHit({ x: 0, y: 3, z: -2 }, { x: 0, y: 3, z: 2 }, r, r),
    null
  );
});
test('swept food collisions catch fast crossing karts instead of tunnelling', () => {
  assert.ok(
    foodHit(
      { x: -4, y: 1, z: 0 },
      { x: 4, y: 0.7, z: 0 },
      { x: 0, z: -3 },
      { x: 0, z: 3 }
    )
  );
  const stationary = { x: 0, z: 0 };
  assert.ok(
    foodHit(
      { x: 0, y: 0.8, z: -10 },
      { x: 0, y: 0.7, z: 10 },
      stationary,
      stationary
    )
  );
});
test('eight unique kart types are selectable and stale IDs cannot bypass validation', () => {
  assert.equal(simulation.KARTS.length, 8);
  assert.equal(
    new Set(simulation.KARTS.map((k) => k.id)).size,
    simulation.KARTS.length
  );
  for (const k of simulation.KARTS)
    assert.equal(simulation.normalizeKart(k.id), k.id);
  assert.equal(simulation.normalizeKart('unknown'), 'apex');
});
test('same-speed touching karts do not damage each other; a rear impact transfers speed and loses energy', () => {
  const a = racer(),
    b = racer('b', 1);
  b.z = 2;
  a.speed = b.speed = 24;
  resolveKartContact(a, b);
  assert.equal(a.health, 100);
  assert.equal(b.health, 100);
  a.z = 0;
  b.z = 2;
  a.speed = 28;
  b.speed = 7;
  const before = energy([a, b]);
  resolveKartContact(a, b);
  assert.ok(a.speed < 28 && b.speed > 7);
  assert.ok(energy([a, b]) <= before);
  assert.ok(a.health < 100 && b.health < 100);
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= 2.1);
});
test('separating and exactly overlapping karts never gain energy or produce NaNs', () => {
  const a = racer(),
    b = racer('b', 1);
  b.z = 1.9;
  b.speed = 25;
  resolveKartContact(a, b);
  assert.equal(a.health, 100);
  assert.equal(b.health, 100);
  a.x = b.x = 0;
  a.z = b.z = 0;
  a.speed = b.speed = 0;
  resolveKartContact(a, b);
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= a.bodyWidth + .08);
  assert.ok(Number.isFinite(a.speed) && Number.isFinite(b.speed));
});
test('scrape damage scales with elapsed time, and invalid damage cannot heal or corrupt a kart', () => {
  const scrape = (dt) => {
    const r = racer();
    r.wallContact = true;
    for (let t = 0; t < 1 - 1e-6; t += dt) {
      r.x = 0;
      r.z = 5;
      r.speed = 6;
      r.velocityYaw = 0;
      r.wallContact = true;
      resolveWallContact(r, { x: 0, z: 0, distance: 5 }, 10, dt);
    }
    return r.health;
  };
  assert.ok(Math.abs(scrape(1 / 60) - scrape(1 / 120)) < 1e-6);
  const r = racer();
  for (const value of [NaN, Infinity, -10])
    assert.equal(damageRacer(r, value), 0);
  assert.equal(r.health, 100);
});
test('bumper damage is capped and cannot retire or stop a kart', () => {
 const t=makeTrack(),r=createRacer(t,'a','a');
 for(let i=0;i<20;i++)damageRacer(r,35);
 assert.equal(r.health,50);assert.equal(r.retired,false);
 const gates=r.gates;
 stepRacer(r,{...blank,throttle:true,brake:false,boost:true},t,STEP,2);
 assert.ok(r.speed>0);assert.equal(r.gates,gates);assert.equal(r.finished,false);
});
