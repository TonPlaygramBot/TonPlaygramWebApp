import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  WORLD,
  SPAWN,
  MISSIONS,
  createState,
  control,
  advanceState,
  interact,
  collide,
  insidePolygon,
  sanitizeInput,
  navigation,
  freshCareer,
  awardCareer
} from '../webapp/src/games/tiranastreets/shared/engine.mjs';
import {
  makeRoom,
  applyRoom,
  roomSnapshot
} from '../webapp/src/games/tiranastreets/shared/rooms.mjs';
import { createTiranaStreets } from '../bot/services/tiranaStreets.js';

const member = (id = 'p') => ({ id, name: `Driver ${id}` });
const state = (id = MISSIONS[0].id) => createState([member()], id);
const tick = (s, frames, raw) => {
  for (let i = 0; i < frames; i++) {
    control(s, 'p', { ...raw, seq: i + 1 });
    advanceState(s, 1 / 60);
  }
};
test('free roam stays playable beyond career deadlines without awarding progress', () => {
  const s = state('free-roam');
  for (let i = 0; i < 400; i++) advanceState(s, 2);
  assert.equal(s.phase, 'active');
  assert.equal(s.players.p.finished, false);
  assert.deepEqual(navigation(s, 'p'), []);
  assert.deepEqual(awardCareer(freshCareer(), s, 'p'), freshCareer());
});
test('real Tirana geography and every mission have connected, finite street routes', () => {
  assert.deepEqual(WORLD.origin, [41.3275, 19.8188]);
  assert.ok(WORLD.buildings.length > 1000);
  assert.ok(WORLD.roads.length > 1000);
  const pyramid = WORLD.landmarks.find((p) => p.id === 'pyramid');
  assert.ok(pyramid.x > 200 && pyramid.z > 450);
  for (const m of MISSIONS) {
    const s = state(m.id);
    for (let i = 0; i < m.stops.length; i++) {
      s.players.p.index = i;
      const path = navigation(s, 'p');
      assert.ok(path.length > 0);
      assert.deepEqual(path.at(-1), { x: m.stops[i].x, z: m.stops[i].z });
      assert.ok(
        path.every((p) => Number.isFinite(p.x) && Number.isFinite(p.z))
      );
      s.players.p.x = m.stops[i].x;
      s.players.p.z = m.stops[i].z;
    }
  }
});
test('walking follows screen right and screen forward at every camera quadrant', () => {
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2])
    for (const input of [
      { x: 1, y: 0 },
      { x: 0, y: 1 }
    ]) {
      const s = state(),
        p = s.players.p;
      p.x = 0;
      p.z = 0;
      tick(s, 30, { ...input, yaw });
      const right = p.x * Math.cos(yaw) - p.z * Math.sin(yaw),
        forward = -p.x * Math.sin(yaw) - p.z * Math.cos(yaw);
      assert.ok(
        input.x ? right > 1 : forward > 1,
        `yaw ${yaw}: ${right},${forward}`
      );
    }
});
test('enter nearby car, accelerate, steer right, brake and exit without inverted controls', () => {
  const s = state();
  advanceState(s, 0.5);
  interact(s, 'p', 'vehicle');
  const p = s.players.p,
    c = s.cars[0];
  assert.equal(p.carId, c.id);
  c.x = p.x = 0;
  c.z = p.z = 0;
  c.heading = p.heading = 0;
  c.speed = 5;
  s.traffic = [];
  tick(s, 30, { x: 1, y: 1 });
  assert.ok(c.heading < 0);
  assert.ok(p.x > 0);
  assert.ok(p.speed > 5);
  interact(s, 'p', 'vehicle');
  assert.equal(p.carId, c.id, 'moving cars cannot be exited');
  tick(s, 60, { brake: true });
  assert.ok(Math.abs(c.speed) < 1);
  advanceState(s, 0.4);
  interact(s, 'p', 'vehicle');
  assert.equal(p.carId, null);
  assert.equal(c.driver, null);
});
test('building collision ejects an actor instead of leaving it inside a footprint', () => {
  const building = WORLD.buildings.find((b) => b.p.length === 4 && b.h < 30);
  const p = {
    x: building.p.reduce((n, v) => n + v[0], 0) / 4,
    z: building.p.reduce((n, v) => n + v[1], 0) / 4
  };
  assert.ok(insidePolygon(p.x, p.z, building.p));
  assert.ok(collide(p, 0.5));
  assert.equal(insidePolygon(p.x, p.z, building.p), false);
});
test('untrusted controls are finite, bounded, sequenced and time out', () => {
  assert.deepEqual(sanitizeInput(null), {
    x: 0,
    y: 0,
    yaw: 0,
    aimYaw: 0,
    aimPitch: 0,
    fast: false,
    brake: false,
    fire: false,
    seq: 0
  });
  const input = sanitizeInput({
    x: 1e20,
    y: NaN,
    yaw: Infinity,
    fast: 'true',
    brake: 1,
    seq: Infinity
  });
  assert.equal(input.x, 1);
  assert.equal(input.y, 0);
  assert.equal(input.fast, false);
  const s = state();
  s.players.p.x = s.players.p.z = 0;
  control(s, 'p', { x: 1, seq: 10 });
  control(s, 'p', { x: -1, seq: 9 });
  assert.equal(s.players.p.input.x, 1);
  advanceState(s, 1);
  const x = s.players.p.x;
  advanceState(s, 1);
  assert.equal(s.players.p.x, x, 'stale input is neutral');
});
test('delivery requires stopping; ordered checkpoints award a chapter only once', () => {
  const s = state(),
    p = s.players.p,
    m = MISSIONS[0];
  p.carId = s.cars[0].id;
  s.cars[0].driver = p.id;
  for (const target of m.stops) {
    const c = s.cars[0];
    c.x = p.x = target.x;
    c.z = p.z = target.z;
    c.speed = p.speed = 12;
    c.vx = c.vz = 0;
    control(s, 'p', { y: 1, seq: Math.floor(s.elapsed * 1000) + 1 });
    advanceState(s, 1 / 60);
    assert.ok(p.index < m.stops.length);
    c.x = p.x = target.x;
    c.z = p.z = target.z;
    c.speed = c.vx = c.vz = 0;
    control(s, 'p', { seq: Math.floor(s.elapsed * 1000) + 2 });
    advanceState(s, 1 / 60);
  }
  assert.equal(p.finished, true);
  assert.equal(p.failed, false);
  assert.equal(s.phase, 'finished');
  const c = awardCareer(freshCareer(), s, 'p');
  assert.deepEqual(c.completed, [m.id]);
  assert.equal(c.credits, m.reward);
  assert.deepEqual(awardCareer(c, s, 'p'), c);
});
test('AI rival follows the street route and can finish within the race deadline', () => {
  const s = state('lana-run');
  s.players.p.x = -500;
  s.players.p.z = 0;
  for (let i = 0; i < 280 && s.phase === 'active'; i++) advanceState(s, 1);
  assert.equal(s.rival.finished, true);
  assert.equal(s.players.p.failed, true);
  assert.ok(s.elapsed < 280);
});
test('online lobby enforces host, ready, capacity and membership', () => {
  const a = member('a'),
    b = member('b'),
    r = makeRoom(
      'ABC234',
      a,
      { mode: 'rivals', missionId: 'first-shift' },
      1000
    );
  assert.throws(() => applyRoom(r, a, 'start', {}, 1100), /one more/);
  applyRoom(r, b, 'join', {}, 1200);
  assert.throws(() => applyRoom(r, b, 'start', {}, 1201), /host/);
  assert.throws(() => applyRoom(r, a, 'start', {}, 1202), /ready/);
  applyRoom(r, b, 'ready', { ready: true }, 1300);
  applyRoom(r, member('c'), 'join', {}, 1301);
  applyRoom(r, member('d'), 'join', {}, 1302);
  assert.throws(() => applyRoom(r, member('e'), 'join', {}, 1303), /full/);
  applyRoom(r, member('c'), 'ready', { ready: true }, 1400);
  applyRoom(r, member('d'), 'ready', { ready: true }, 1401);
  applyRoom(r, a, 'start', {}, 1500);
  assert.equal(Object.keys(r.state.players).length, 4);
  assert.throws(() => applyRoom(r, member('x'), 'input', {}, 1600), /Rejoin/);
  const snap = roomSnapshot(r, 'a');
  assert.equal(snap.state.players.a.input, undefined);
  assert.equal(snap.state.players.a.lastAction, undefined);
});
test('co-op shares checkpoints; rivals keep separate progress; host migration works', () => {
  for (const mode of ['coop', 'rivals']) {
    const r = makeRoom(
      'ABC234',
      member('a'),
      { mode, missionId: 'first-shift' },
      1000
    );
    applyRoom(r, member('b'), 'join', {}, 1001);
    applyRoom(r, member('b'), 'ready', { ready: true }, 1002);
    applyRoom(r, member('a'), 'start', {}, 1003);
    Object.assign(r.state.players.a, MISSIONS[0].stops[0]);
    applyRoom(r, member('a'), 'poll', {}, 1100);
    assert.equal(r.state.players.a.index, 1);
    assert.equal(r.state.players.b.index, mode === 'coop' ? 1 : 0);
    applyRoom(r, member('a'), 'leave', {}, 1200);
    assert.equal(r.host, 'b');
    assert.equal(r.state.players.a, undefined);
  }
});
test('room suspension advances deadlines without replaying held input', () => {
  const r = makeRoom(
    'ABC234',
    member(),
    { mode: 'career', missionId: 'first-shift' },
    1000
  );
  applyRoom(r, member(), 'input', { input: { x: 1, seq: 1 } }, 1001);
  const p = r.state.players.p,
    x = p.x;
  applyRoom(r, member(), 'poll', {}, 230000);
  assert.equal(p.x, x);
  assert.equal(p.failed, true);
});
test('registered app accounts own one room; concurrent create and spoofed results are rejected', async () => {
  let time = 100000;
  const saved = new Map();
  const service = createTiranaStreets({
    now: () => time,
    autoTick: false,
    career: {
      load: async (id) => saved.get(id) || freshCareer(),
      complete: async (id, state, pid) => {
        const c = awardCareer(saved.get(id) || freshCareer(), state, pid);
        saved.set(id, c);
        return c;
      }
    }
  });
  const socket = (id) => ({ data: { playerId: id, auth: { accountId: id } } });
  const a = socket('account-a'),
    b = socket('account-b');
  const req = (s, action, extra = {}) =>
    service.request(s, { accountId: s.data.playerId, action, ...extra });
  await assert.rejects(
    service.request(a, { accountId: 'account-b', action: 'profile' }),
    /registered/
  );
  await assert.rejects(
    req(a, 'create', { mode: 'career', missionId: 'city-lights' }),
    /earlier/
  );
  const results = await Promise.allSettled([
    req(a, 'create', { mode: 'rivals', missionId: 'first-shift' }),
    req(a, 'create', { mode: 'rivals', missionId: 'first-shift' })
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(service.rooms.size, 1);
  const roomId = results.find((r) => r.status === 'fulfilled').value.room.id;
  const joined = await req(b, 'join', { roomId });
  await req(b, 'ready', { roomId, ready: true });
  await req(a, 'start', { roomId });
  time += 500;
  const updated = await req(a, 'input', {
    roomId,
    input: { seq: 1, x: 0, y: 0 },
    x: 99999,
    finished: true,
    credits: 999999
  });
  assert.ok(updated.room.state.players[updated.room.playerId].x < 1000);
  assert.equal(updated.career.credits, 0);
  assert.equal(joined.room.members.length, 2);
  assert.equal(JSON.stringify(updated).includes('account-a'), false);
  service.close();
});
test('GLB assets have valid containers and all external images ship locally', async () => {
  const dir = new URL(
    '../webapp/public/assets/tirana-streets/',
    import.meta.url
  );
  for (const name of [
    'character',
    'sedan',
    'sedan-sports',
    'taxi',
    'police',
    'city'
  ]) {
    const data = await readFile(new URL(name + '.glb', dir));
    assert.equal(data.toString('ascii', 0, 4), 'glTF');
    assert.equal(data.readUInt32LE(4), 2);
    assert.equal(data.readUInt32LE(8), data.length);
    const json = JSON.parse(
      data.toString('utf8', 20, 20 + data.readUInt32LE(12))
    );
    assert.ok(json.meshes.length > 0);
    for (const image of json.images || [])
      if (image.uri && !image.uri.startsWith('data:'))
        assert.ok((await readFile(new URL(image.uri, dir))).length > 0);
  }
});
