import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  KARTS,
  normalizeKart,
  equipKart,
  createRacer,
  makeTrack,
  STEP,
  stepRacer,
  aiInput
} from '../webapp/src/games/kartroyale/simulation.mjs';
import { MILITARY_VEHICLES } from '../webapp/src/games/kartroyale/militaryVehicleCatalog.mjs';
import {
  vehicleAssetUrl,
  normaliseVehicleDimensions,
  vehicleDriverMount
} from '../webapp/src/games/kartroyale/vehicleAssetConfig.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function glb(url) {
  const b = fs.readFileSync(path.join(root, 'webapp/public', url));
  assert.equal(b.readUInt32LE(0), 0x46546c67);
  assert.equal(b.readUInt32LE(4), 2);
  assert.equal(b.readUInt32LE(8), b.length);
  const j = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)));
  assert(
    j.bufferViews.every(
      (v) => v.byteOffset + v.byteLength <= j.buffers[0].byteLength
    )
  );
  return j;
}
test('four requested vehicles extend the original five without changing old IDs', () => {
  assert.deepEqual(
    KARTS.slice(0, 5).map((k) => k.id),
    ['apex', 'oobi', 'oodi', 'ooli', 'oopi']
  );
  assert.deepEqual(
    MILITARY_VEHICLES.map((k) => k.id),
    ['shota', 'brabus-g', 'defender', 'brabus-s65']
  );
  assert.equal(new Set(KARTS.map((k) => k.id)).size, 9);
  for (const v of MILITARY_VEHICLES) {
    assert.equal(normalizeKart(v.id), v.id);
    const r = equipKart(createRacer(makeTrack(), 'p', 'Player'), v.id);
    assert.equal(r.kartId, v.id);
    assert.equal(r.shield, v.shield);
    assert.equal(r.ammunition, v.ammunition);
  }
  assert.equal(normalizeKart('../../anything'), 'apex');
});
for (const v of MILITARY_VEHICLES) {
  test(`${v.id}: self-contained GLB and opponent LOD retain the rig`, () => {
    for (const low of [false, true]) {
      const g = glb(vehicleAssetUrl(v.id, low));
      const names = new Set(g.nodes.map((n) => n.name));
      for (const name of [
        'body',
        'wheel_fl',
        'wheel_fr',
        'wheel_rl',
        'wheel_rr',
        'steer_fl',
        'steer_fr'
      ])
        assert(names.has(name), `${v.id}: ${name}`);
      if (!low) {
        assert(names.has('interior'));
        assert(names.has('steering_wheel'));
        assert(g.materials.some((m) => m.normalTexture));
      }
      assert(
        g.images.length > 0 &&
          g.images.every((im) => im.bufferView !== undefined && !im.uri)
      );
      assert(g.materials.some((m) => m.name === 'military_paint'));
    }
    assert(
      fs.statSync(path.join(root, 'webapp/public', vehicleAssetUrl(v.id, true)))
        .size <
        fs.statSync(path.join(root, 'webapp/public', vehicleAssetUrl(v.id)))
          .size
    );
  });
  test(`${v.id}: finishes a race using unchanged shared fixed-step physics`, () => {
    const track = makeTrack('skanderbeg');
    const r = equipKart(createRacer(track, 'test', 'Driver', 0, true), v.id);
    for (let t = 0; t < 480 && !r.finished; t += STEP)
      stepRacer(r, aiInput(r, track, t, 'rookie'), track, STEP, t, 'rookie');
    assert(r.finished, `${v.id} failed to complete`);
    assert(Number.isFinite(r.speed) && r.gates === 13);
  });
  test(`${v.id}: controls steer in the player's screen direction and stop`, () => {
    const track = { ...makeTrack(), width: 1000 };
    for (const steer of [-1, 1]) {
      const r = equipKart(createRacer(track, 'you', 'You'), v.id);
      r.speed = 20;
      const yaw = r.yaw;
      stepRacer(
        r,
        {
          steer,
          brake: false,
          drift: false,
          boost: false,
          shield: false,
          fire: false
        },
        track,
        STEP,
        1
      );
      assert.equal(Math.sign(r.yaw - yaw), -steer);
    }
    const r = equipKart(createRacer(track, 'stop', 'You'), v.id);
    r.speed = 25;
    for (let i = 0; i < 150; i++)
      stepRacer(
        r,
        {
          steer: 0,
          brake: true,
          drift: false,
          boost: false,
          shield: false,
          fire: false
        },
        track,
        STEP,
        i * STEP
      );
    assert.equal(r.speed, 0);
  });
}
test('asset fitting applies one scale to the body, floor and actual left-hand seat', () => {
  const fit = normaliseVehicleDimensions({
    min: [-1.5, 0.04, -2.9],
    max: [1.5, 3.8, 3.5]
  });
  assert(Math.abs(fit.scale * 6.4 - 3.25) < 1e-10);
  assert.equal(0.04 * fit.scale + fit.offset[1], 0);
  const eye = vehicleDriverMount('shota', fit);
  assert(eye[0] > 0, 'Vehicle-left is screen-left facing +Z');
  assert(Math.abs(eye[1] - (2.29 - 0.04) * fit.scale) < 1e-10);
  assert.throws(() =>
    normaliseVehicleDimensions({ min: [0, 0, 0], max: [1, 1, 0] })
  );
});
