import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STEP,
  TRACKS,
  makeTrack,
  sample,
  createRacer,
  neutralInput,
  stepRace,
  sanitizeInput,
  standings
} from '../webapp/src/games/jetski/simulation.mjs';

test('six AI riders complete all courses through all 37 ordered gates', () => {
  for (const info of TRACKS) {
    const track = makeTrack(info.id),
      racers = Array.from({ length: 6 }, (_, i) =>
        createRacer(track, String(i), 'AI', i, true)
      );
    for (
      let frame = 0;
      frame < 18000 && !racers.every((r) => r.finished);
      frame++
    )
      stepRace(racers, track, STEP, frame * STEP);
    for (const r of racers) {
      assert.equal(r.finished, true, `${info.id}: rider ${r.id}`);
      assert.equal(r.gatesPassed, 37);
      assert.ok(r.finishTime > 30);
      assert.equal(r.penalty, 0);
    }
    assert.ok(
      standings(racers).every(
        (r, i, a) => !i || r.finishTime >= a[i - 1].finishTime
      )
    );
  }
});
test('screen-right input turns right in a forward +Z chase camera and release slows the craft', () => {
  const track = makeTrack('ksamil'),
    r = createRacer(track, 'you', 'You', 0),
    initial = r.heading;
  r.input = { ...neutralInput(), throttle: true, steer: 1 };
  for (let i = 0; i < 90; i++) stepRace([r], track, STEP, i * STEP);
  assert.ok(r.heading < initial);
  const speed = r.speed;
  r.input = neutralInput();
  for (let i = 0; i < 60; i++) stepRace([r], track, STEP, 2 + i * STEP);
  assert.ok(r.speed < speed);
});
test('backward start crossings and teleporting to the finish cannot award a lap', () => {
  const tr = makeTrack('ksamil'),
    r = createRacer(tr, 'a', 'A', 0),
    gate = tr.gates[0];
  r.x = gate.x + Math.sin(gate.heading);
  r.z = gate.z + Math.cos(gate.heading);
  r.vx = -Math.sin(gate.heading) * 20;
  r.vz = -Math.cos(gate.heading) * 20;
  for (let i = 0; i < 12; i++) stepRace([r], tr, STEP, i * STEP);
  assert.equal(r.gatesPassed, 0);
  r.nextGate = 6;
  r.lap = 1;
  r.x = gate.x;
  r.z = gate.z;
  stepRace([r], tr, STEP, 2);
  assert.equal(r.lap, 1);
  assert.equal(r.finished, false);
});
test('boost drains, pickups refill with cooldown, jumps land, recovery has penalty and cooldown', () => {
  const tr = makeTrack('ksamil'),
    r = createRacer(tr, 'a', 'A', 0);
  r.input = { ...neutralInput(), throttle: true, boost: true };
  for (let i = 0; i < 60; i++) stepRace([r], tr, STEP, i * STEP);
  assert.ok(r.boost < 80);
  r.input = neutralInput();
  r.vx = r.vz = 0;
  r.x = tr.pickups[0].x;
  r.z = tr.pickups[0].z;
  r.boost = 10;
  stepRace([r], tr, STEP, 3);
  assert.ok(r.boost > 40);
  r.boost = 10;
  stepRace([r], tr, STEP, 3.1);
  assert.ok(r.boost < 11);
  const ramp = tr.ramps[0];
  r.x = ramp.x;
  r.z = ramp.z;
  r.heading = ramp.heading;
  r.vx = Math.sin(r.heading) * 24;
  r.vz = Math.cos(r.heading) * 24;
  stepRace([r], tr, STEP, 5);
  assert.equal(r.airborne, true);
  for (let i = 0; i < 180; i++) stepRace([r], tr, STEP, 5 + i * STEP);
  assert.equal(r.airborne, false);
  assert.equal(r.landings, 1);
  r.input = { ...neutralInput(), recover: true };
  stepRace([r], tr, STEP, 10);
  assert.equal(r.penalty, 5);
  stepRace([r], tr, STEP, 10.1);
  assert.equal(r.penalty, 5);
});
test('input coercion rejects nonfinite numbers and truthy strings', () => {
  assert.deepEqual(
    sanitizeInput({
      steer: Infinity,
      throttle: 'true',
      brake: 1,
      boost: {},
      recover: []
    }),
    neutralInput()
  );
  assert.equal(sanitizeInput({ steer: 999 }).steer, 1);
});
test('fixed-step replay is deterministic', () => {
  const tr = makeTrack('dhermi'),
    run = () => {
      const r = createRacer(tr, 'r', 'R', 0, true);
      for (let i = 0; i < 1000; i++) stepRace([r], tr, STEP, i * STEP);
      return r;
    };
  assert.deepEqual(run(), run());
});
