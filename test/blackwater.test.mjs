import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { WORLD } from '../webapp/src/games/tiranastreets/shared/world.mjs';
import {
  MAP,
  ORIGIN,
  roads,
  buildings,
  START,
  EXTRACTION,
  OBSTACLES
} from '../webapp/src/games/blackwater/shared/layout.mjs';
import {
  collides,
  moveCircle,
  rayBox,
  lineClear,
  findPath
} from '../webapp/src/games/blackwater/shared/physics.mjs';
import {
  idleInput,
  sanitizeInput,
  makeMatch,
  stepMatch,
  spawnPoint
} from '../webapp/src/games/blackwater/shared/match.mjs';
import { validateSeatTableRequest } from '../bot/config/onlineGamePolicy.js';

test('the complete Tirana Streets layout retains its metric scale and east/south axes', () => {
  assert.equal(roads.length, WORLD.roads.length);
  assert.equal(buildings.length, WORLD.buildings.length);
  roads.forEach((r, i) => {
    for (const end of ['a', 'b']) {
      assert.ok(Math.abs(r[end][0] + ORIGIN.x - WORLD.roads[i][end][0]) < 1e-8);
      assert.ok(Math.abs(r[end][1] + ORIGIN.z - WORLD.roads[i][end][1]) < 1e-8);
    }
    assert.equal(r.w, WORLD.roads[i].w);
  });
  buildings.forEach((b, i) => assert.equal(b.id, WORLD.buildings[i].id));
  buildings.forEach((b, i) => assert.deepEqual(b.footprint, WORLD.buildings[i].p.map(([x,z]) => [x-ORIGIN.x,z-ORIGIN.z])));
  assert.equal(MAP.minX + ORIGIN.x, WORLD.bounds[0]);
  const assets = readFileSync(
    new URL('../webapp/src/games/blackwater/world.ts', import.meta.url),
    'utf8'
  );
  // Original BLACKWATER source commit 1f60946e2a6251f0f66b444c8a17243cc4721bff.
  const sha = (text) => createHash('sha256').update(text).digest('hex');
  assert.equal(
    sha(assets.slice(assets.indexOf('function makeGun()'))),
    '59e8646be0b09079f2bbb97f49b03f64fbefbc39be2e0cef671bbff6621cc0a8'
  );

});
test('spawns, extraction and AI routes are collision-free in the relocated scene', () => {
  assert.equal(collides(START.x, START.z, 0.4, OBSTACLES), false);
  assert.equal(collides(EXTRACTION.x, EXTRACTION.z, 0.4, OBSTACLES), false);
  for (let i = 0; i < 8; i++) {
    const p = spawnPoint(i);
    assert.equal(collides(p.x, p.z, 0.45, OBSTACLES), false);
    const path = findPath(p, START, OBSTACLES);
    assert.ok(path.length);
    assert.ok(Math.hypot(path.at(-1).x - START.x, path.at(-1).z - START.z) < 3);
  }
});
test('rotated building collision, occlusion and screen-relative movement agree', () => {
  const box = { x: 0, z: 0, w: 2, d: 10, h: 5, rot: Math.PI / 2 };
  assert.equal(collides(4, 0, 0.3, [box]), true);
  assert.equal(collides(0, 4, 0.3, [box]), false);
  assert.ok(
    Math.abs(rayBox({ x: 0, y: 1, z: 8 }, { x: 0, y: 0, z: -1 }, box) - 7) <
      1e-6
  );
  assert.equal(
    lineClear({ x: 0, y: 1, z: 8 }, { x: 0, y: 1, z: -8 }, [box]),
    false
  );
  const p = { x: 0, z: 8 };
  moveCircle(p, 0, -20, 0.34, [box]);
  assert.ok(p.z >= 1.3);
  const empty = [];
  const right = { x: 0, z: 0 };
  moveCircle(right, 2, 0, 0.34, empty);
  assert.ok(Math.abs(right.x - 2) < 1e-9);
});
test('TPG policy accepts only 2–4 players, Tirana, online mode and valid TPG stakes', () => {
  const criteria = {
    gameType: 'blackwater',
    maxPlayers: 2,
    stake: 100,
    matchMeta: { mapId: 'tirana', mode: 'online', token: 'TPG' }
  };
  for (const maxPlayers of [2, 3, 4])
    assert.equal(
      validateSeatTableRequest({ ...criteria, maxPlayers }).ok,
      true
    );
  for (const patch of [
    { maxPlayers: 1 },
    { maxPlayers: 5 },
    { stake: -1 },
    { stake: 0.5 },
    { stake: Infinity },
    { stake: Number.MAX_SAFE_INTEGER }
  ])
    assert.equal(validateSeatTableRequest({ ...criteria, ...patch }).ok, false);
  for (const patch of [{ mapId: 'fake' }, { mode: 'ai' }, { token: 'TON' }])
    assert.equal(
      validateSeatTableRequest({
        ...criteria,
        matchMeta: { ...criteria.matchMeta, ...patch }
      }).ok,
      false
    );
});
test('untrusted input cannot teleport, accelerate, inject ammo or report a winner', () => {
  assert.equal(
    sanitizeInput({ seq: 1, rx: NaN, forward: 0, yaw: 0, pitch: 0 }),
    null
  );
  assert.equal(sanitizeInput({ ...idleInput(), seq: -1 }), null);
  const input = sanitizeInput({
    ...idleInput(),
    seq: 1,
    rx: 100,
    forward: 100,
    x: 9000,
    hp: 999,
    ammo: 999,
    winnerAccountId: 'cheat'
  });
  assert.ok(Math.hypot(input.rx, input.forward) <= 1.00001);
  assert.equal(input.x, undefined);
  assert.equal(input.ammo, undefined);
  const m = makeMatch([
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' }
    ]),
    p = m.players[0],
    start = { x: p.x, z: p.z };
  p.connected = true;
  p.input = input;
  for (let n = 0; n < 60; n++) stepMatch(m);
  assert.ok(Math.hypot(p.x - start.x, p.z - start.z) <= 3.61);
});
test('server owns shots, damage, reloading, respawn and the winning score', () => {
  const m = makeMatch([
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' }
    ]),
    [a, b] = m.players;
  for (const p of m.players) p.connected = true;
  // A verified open lane in the same city, with no test-only damage multipliers.
  const lane = [
    { x: START.x, z: START.z },
    { x: START.x, z: START.z - 4 }
  ];
  assert.equal(
    lineClear({ ...lane[0], y: 1.5 }, { ...lane[1], y: 1.5 }, OBSTACLES),
    true
  );
  for (let kill = 0; kill < 5; kill++) {
    Object.assign(a, lane[0], { hp: 100, protection: 0 });
    Object.assign(b, lane[1], { hp: 100, protection: 0, respawn: 0 });
    a.input = { ...idleInput(), fire: true, pitch: -0.1 };
    b.input = idleInput();
    const before = a.kills;
    for (let n = 0; n < 240 && a.kills === before; n++) stepMatch(m);
    assert.equal(a.kills, before + 1);
    assert.equal(b.hp, 0);
    if (kill < 4) {
      a.input = idleInput();
      for (let n = 0; n < 190; n++) stepMatch(m);
      assert.equal(b.hp, 100);
      assert.equal(collides(b.x, b.z, 0.34, OBSTACLES), false);
    }
  }
  assert.equal(m.done, true);
  assert.equal(m.winnerAccountId, 'a');
  assert.ok(a.shots <= 30);
  assert.ok(a.hits >= 15);
});
test('walls stop shots and a scoreless timeout refunds the match', () => {
  const m = makeMatch([
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' }
    ]),
    [a, b] = m.players,
    o = buildings.find((b) => Math.abs(b.x) < 100 && Math.abs(b.z) < 100);
  const c = Math.cos(o.rot),
    s = Math.sin(o.rot);
  Object.assign(a, {
    x: o.x + c * (o.w / 2 + 3),
    z: o.z - s * (o.w / 2 + 3),
    connected: true,
    protection: 0
  });
  Object.assign(b, {
    x: o.x - c * (o.w / 2 + 3),
    z: o.z + s * (o.w / 2 + 3),
    connected: true,
    protection: 0
  });
  a.input = {
    ...idleInput(),
    fire: true,
    yaw: Math.atan2(-(b.x - a.x), -(b.z - a.z)),
    pitch: -0.02
  };
  for (let n = 0; n < 50; n++) stepMatch(m);
  assert.equal(b.hp, 100);
  assert.ok(a.ammo < 30);
  a.input = idleInput();
  m.elapsed = 180;
  stepMatch(m);
  assert.equal(m.winnerAccountId, '');
  assert.equal(m.reason, 'tie_refund');
});
