import assert from 'node:assert/strict';
import test from 'node:test';
import {StreetRouteRefresh} from '../webapp/src/games/tiranastreets-november/street-career/streetRouteRefresh.mjs';

test('idle navigation ticks avoid repeating a city route query', () => {
  const gate = new StreetRouteRefresh();
  const calls = Array.from({length: 80}, () => gate.request('walk', {x: 12, z: 34}, {x: 56, z: 78}));
  assert.equal(calls.filter(Boolean).length, 1);
});

test('player movement, route mode, target mutation and explicit changes refresh', () => {
  const gate = new StreetRouteRefresh();
  const p = {x: 3, z: 5}, t = {x: 11, z: 13};
  assert.equal(gate.request('walk', p, t), true);
  assert.equal(gate.request('walk', p, t), false);
  p.z += 1;
  assert.equal(gate.request('walk', p, t), true);
  assert.equal(gate.request('drive', p, t), true);
  t.x += 20;
  assert.equal(gate.request('drive', p, t), true);
  gate.clear();
  assert.equal(gate.request('drive', p, t), true);
});

test('invalid coordinates do not suppress the next valid query', () => {
  const gate = new StreetRouteRefresh();
  const p = {x: 3, z: 5}, t = {x: 11, z: 13};
  assert.equal(gate.request('walk', p, t), true);
  assert.equal(gate.request('walk', {x: NaN,z: 5}, t), true);
  assert.equal(gate.request('walk', p, t), true);
});
