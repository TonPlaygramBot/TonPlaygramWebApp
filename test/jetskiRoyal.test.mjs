import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STEP,
  TRACKS,
  makeTrack,
  sample,
  nearest,
  createRacer,
  neutralInput,
  stepRace,
  sanitizeInput,
  standings
} from '../webapp/src/games/jetski/simulation.mjs';

test('six AI riders complete every course through its ordered gates', () => {
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
      assert.equal(r.gatesPassed, track.pointToPoint ? track.gates.length : 37);
      if (track.pointToPoint) assert.equal(r.lap, 1);
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

test('Lana bank impacts throw the rider clear and remount without skipping a gate', () => {
  const track = makeTrack('lana');
  const r = createRacer(track, 'you', 'You', 0);
  const contact = sample(track, 10, track.width - 0.15);
  r.x = contact.x;
  r.z = contact.z;
  r.heading = contact.heading + Math.PI / 2;
  r.vx = Math.sin(r.heading) * 22;
  r.vz = Math.cos(r.heading) * 22;
  r.lap = r.gatesPassed = r.nextGate = 1;
  r.input = { ...neutralInput(), throttle: true, boost: true };
  stepRace([r], track, STEP, 3);
  assert.ok(r.crash, 'hard impact ejects the rider');
  assert.equal(r.crashes, 1);
  assert.equal(r.penalty, 3);
  assert.ok(nearest(track, r.x, r.z).distance <= track.width + 0.01);
  const firstHeight = r.crash.height;
  stepRace([r], track, STEP, 3 + STEP);
  assert.ok(r.crash.height > firstHeight);
  assert.notEqual(r.crash.x, r.x);
  assert.equal(r.boosting, false);
  for (let i = 2; i < 90; i++) stepRace([r], track, STEP, 3 + i * STEP);
  assert.equal(r.crash.height, 0);
  for (let i = 90; i < 146; i++) stepRace([r], track, STEP, 3 + i * STEP);
  assert.equal(r.crash, null);
  assert.equal(r.nextGate, 1);
  assert.equal(r.gatesPassed, 1);
  assert.equal(r.penalty, 3);
});

test('hard hull collisions eject riders while a light contact only transfers momentum', () => {
  const track = makeTrack('ksamil');
  const point = sample(track, 15);
  const collide = (speed) => {
    const front = createRacer(track, 'front', 'Front', 0);
    const back = createRacer(track, 'back', 'Back', 1);
    front.x = point.x + Math.sin(point.heading) * 1.45;
    front.z = point.z + Math.cos(point.heading) * 1.45;
    back.x = point.x - Math.sin(point.heading) * 1.45;
    back.z = point.z - Math.cos(point.heading) * 1.45;
    front.heading = back.heading = point.heading;
    back.vx = Math.sin(point.heading) * speed;
    back.vz = Math.cos(point.heading) * speed;
    stepRace([front, back], track, STEP, 3);
    return [front, back];
  };
  const light = collide(3);
  assert.ok(light.every((r) => r.hitAt === 3 && r.crash === null));
  assert.ok(light[0].speed > 0);
  assert.ok(
    collide(24).every((r) => r.crash && r.crashes === 1 && r.penalty === 3)
  );
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

test('new courses have different racing conditions and every boost ring can be collected', () => {
  const headland = makeTrack('karaburun');
  const gorge = makeTrack('koman');
  assert.ok(headland.width > gorge.width);
  assert.ok(headland.wave > gorge.wave);
  assert.notDeepEqual(headland.current, gorge.current);
  assert.equal(headland.ramps.length, 3);

  const rider = createRacer(headland, 'you', 'You', 0);
  const ring = headland.pickups.at(-1);
  rider.x = ring.x;
  rider.z = ring.z;
  rider.boost = 10;
  stepRace([rider], headland, STEP, 1);
  assert.ok(rider.boost > 40);
  assert.equal(rider.pickupAt.at(-1), 1);

  const drifter = createRacer(gorge, 'drift', 'Drift', 0);
  const startX = drifter.x;
  for (let frame = 0; frame < 60; frame++)
    stepRace([drifter], gorge, STEP, (frame + 1) * STEP);
  assert.ok(Math.abs(drifter.x - startX - gorge.current.x) < 1e-8);
});
