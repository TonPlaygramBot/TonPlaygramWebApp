import test from 'node:test';
import assert from 'node:assert/strict';
import { STEP, createRacer, stepRacer } from '../webapp/src/games/kartroyale/simulation.mjs';
import { resampleCircuit } from '../webapp/src/games/kartroyale/grandRouteCore.mjs';
import { steeringStickInput } from '../webapp/src/games/kartroyale/heldRaceInput.mjs';
import { ghostKey, loadGhost } from '../webapp/src/games/kartroyale/ghostLap.mjs';

const track = { ...resampleCircuit([[0, 0], [0, 2000], [2000, 2000], [2000, 0]], 720), width: 200 };
// Isolate steering from road-edge help and collisions, as on an open city road.
const openRoad = { move() {} };
const driver = () => Object.assign(createRacer(track, 'you', 'You'), {
  x: 0, z: 200, yaw: 0, velocityYaw: 0, speed: 33
});
const advance = (r, steer, steps) => {
  for (let i = 0; i < steps; i++)
    stepRacer(r, { throttle: true, steer }, track, STEP, i * STEP, 'street', openRoad);
};

test('thumb steering has a continuous centre, finer small corrections and full lock on both edges', () => {
  for (const sign of [-1, 1]) {
    assert.equal(Math.abs(steeringStickInput(sign * .08)), 0);
    assert.ok(Math.abs(steeringStickInput(sign * .081)) < .001);
    const small = steeringStickInput(sign * .3);
    assert.equal(Math.sign(small), sign);
    assert.ok(Math.abs(small) > .1 && Math.abs(small) < .25);
    assert.equal(steeringStickInput(sign), sign);
    assert.equal(steeringStickInput(sign * 2), sign);
    let previous = 0;
    for (let i = 0; i <= 100; i++) {
      const next = Math.abs(steeringStickInput(sign * i / 100));
      assert.ok(next >= previous);
      previous = next;
    }
  }
  for (const invalid of [NaN, Infinity, -Infinity]) assert.equal(steeringStickInput(invalid), 0);
});

test('releasing the joystick centres the wheels and settles the turn promptly', () => {
  for (const direction of [-1, 1]) {
    const r = driver();
    advance(r, direction, 60);
    const heading = r.yaw;
    assert.equal(Math.sign(r.steering), direction);
    advance(r, 0, 9);
    assert.ok(Math.abs(r.steering) < .07, 'wheels centred within 150 ms');
    assert.ok(Math.abs(r.yawRate) < .2, 'turn settles with the released wheel');
    assert.ok(Math.abs(r.yaw - heading) < .08, 'release does not carry a long turn');
  }
});

test('countersteering reverses the rack promptly and both directions remain symmetric', () => {
  const left = driver(), right = driver();
  advance(left, -1, 60); advance(right, 1, 60);
  advance(left, 1, 5); advance(right, -1, 5);
  assert.ok(left.steering > .2 && right.steering < -.2, 'opposite lock responds within 84 ms');
  assert.ok(Math.abs(left.steering + right.steering) < 1e-12);
  assert.ok(Math.abs(left.yaw + right.yaw) < 1e-12);
  assert.ok(Math.abs(left.x + right.x) < 1e-12);
  assert.ok(Math.abs(left.z - right.z) < 1e-12);
});

test('slower handling starts comparable ghost records without deleting old faster laps', () => {
  const current = ghostKey({ ...track, id: 'test-road' }, 'apex');
  const previous = current.replace('.handling2.', '.');
  assert.notEqual(current, previous);
  const oldBest = { version: 1, time: 4, sectors: [1, 1, 1, 1], samples: [[0, 0, 0, 0, 0], [4, 0, 100, 0, 0]] };
  const saved = new Map([[previous, JSON.stringify(oldBest)]]);
  const storage = { getItem: key => saved.get(key) };
  assert.equal(loadGhost(storage, current), null);
  assert.deepEqual(loadGhost(storage, previous), oldBest);
});
