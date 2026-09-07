import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createWaterState,
  updateWater,
  waterPoint,
  WATER_DURATION
} from '../webapp/src/games/kartroyale/protestResponse.mjs';
import { TIRANA_ROUTES } from '../webapp/src/games/kartroyale/tirana-routes.mjs';
import {
  makeTrack,
  createRacer,
  stepRacer,
  STEP,
  randomTrack,
  TRACKS
} from '../webapp/src/games/kartroyale/simulation.mjs';
const input = { steer: 0, brake: true, drift: false, boost: false };
test('Surrel and Farka are geographic departures, and all ten routes share the Bush Street finish', () => {
  const end = TIRANA_ROUTES[0].points.at(-1);
  assert.equal(
    new Set(TIRANA_ROUTES.map((r) => r.points[0].join(','))).size,
    10
  );
  for (const r of TIRANA_ROUTES) {
    assert.deepEqual(r.points.at(-1), end);
    assert.deepEqual(r.points.slice(-r.approach.length), r.approach);
    assert.ok(r.streets.some((s) => s.includes('Bush')));
  }
  const surrel = TIRANA_ROUTES.find((r) => r.id === 'surrel');
  assert.ok(surrel.points[0][0] > 7000);
  assert.ok(surrel.points[0][1] < 0);
  assert.ok(TIRANA_ROUTES.find((r) => r.id === 'farka').points[0][0] > 3000);
  for (let i = 0; i < 10; i++)
    assert.equal(
      randomTrack(() => i / 10),
      TRACKS[i].id
    );
});
test('teleporting to Parliament or a later road cannot earn a mission completion', () => {
  const t = makeTrack('surrel'),
    r = createRacer(t, 'you', 'Driver');
  for (const index of [
    t.points.length - 2,
    Math.floor(t.points.length / 2),
    t.points.length - 1
  ]) {
    Object.assign(r, { x: t.points[index].x, z: t.points[index].z, speed: 0 });
    stepRacer(r, input, t, STEP, 2);
    assert.equal(r.finished, false);
    assert.equal(r.gates, 0);
    assert.equal(r.progress, 0);
  }
});
test('water cannon responds only to recent nearby throws, observes delay and cooldown, and expires', () => {
  const s = createWaterState(),
    truck = { x: 0, z: 0 };
  const event = { id: 1, time: 1, x: 9, z: 2, seed: 12 };
  updateWater(s, [event], truck, 1.1, true);
  assert.equal(s.target, null);
  updateWater(s, [event], truck, 1.5, false);
  assert.equal(s.target, null);
  updateWater(s, [event], truck, 1.5, true);
  assert.equal(s.target.seed, 12);
  const began = s.started;
  updateWater(s, [{ ...event, id: 2, time: 2 }], truck, 2.5, true);
  assert.equal(s.started, began);
  updateWater(s, [], truck, began + WATER_DURATION + 0.01, true);
  assert.equal(s.target, null);
  updateWater(s, [{ ...event, id: 3, time: 8, x: 80 }], truck, 8.5, true);
  assert.equal(s.target, null);
  updateWater(s, [{ ...event, id: 4, time: 8 }], truck, 8.5, true);
  assert.equal(s.lastEvent, 4);
  const a = { x: 2, y: 3, z: 4 },
    b = { x: 9, y: 1, z: 6 };
  assert.deepEqual(waterPoint(a, b, 0), a);
  const p = waterPoint(a, b, 1);
  assert.ok(Math.hypot(p.x - b.x, p.z - b.z) < 1e-8);
});
test('all Blender cast models contain real skins, weighted vertices and a Throw animation', () => {
  for (const id of [
    'edi-rama',
    'belinda-balluku',
    'erion-brace',
    'ulsi-manja',
    'blendi-gonxhe',
    'police'
  ]) {
    const b = readFileSync(
      new URL(
        `../webapp/public/assets/kart-royale/cast/${id}.glb`,
        import.meta.url
      )
    );
    assert.equal(b.readUInt32LE(8), b.length);
    const d = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)));
    assert.ok(d.skins.length > 0, id);
    assert.ok(
      d.animations.some((a) => a.name.includes('Throw')),
      id
    );
    for (const p of d.meshes.flatMap((m) => m.primitives)) {
      assert.notEqual(p.attributes.JOINTS_0, undefined);
      assert.notEqual(p.attributes.WEIGHTS_0, undefined);
    }
    assert.ok(!d.images?.length, 'no reference photos embedded');
  }
  const b = readFileSync(
    new URL(
      '../webapp/public/assets/kart-royale/cast/water-cannon.glb',
      import.meta.url
    )
  );
  const d = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)));
  for (const name of ['turret', 'nozzle'])
    assert.ok(d.nodes.some((n) => n.name === name));
});
