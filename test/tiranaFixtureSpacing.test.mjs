import test from 'node:test';
import assert from 'node:assert/strict';
import {pointSpacing} from '../webapp/src/games/tiranastreets/shared/pointSpacing.mjs';

test('incremental fixture spacing preserves exhaustive placement order across grid boundaries', () => {
  const index = pointSpacing(), placed = [];
  for (let i = 0; i < 2200; i++) {
    const p = {x: ((i * 73) % 641) - 320.001, z: ((i * 137) % 509) - 256.001};
    const radius = i % 5 === 0 ? 9 : 5;
    const occupied = placed.some(q => Math.hypot(q.x-p.x, q.z-p.z) < radius);
    assert.equal(index.occupied(p.x,p.z,radius), occupied);
    // Manhole covers are accepted unconditionally and still block later props.
    if (!occupied || i % 11 === 0) { placed.push(p); index.add(p); }
  }
});

test('spacing keeps strict contact distance and searches beyond a single neighbour cell', () => {
  const index = pointSpacing();
  index.add({x:-16,z:16});
  assert.equal(index.occupied(-16,21,5),false);
  assert.equal(index.occupied(-16,20.999,5),true);
  assert.equal(index.occupied(33,16,50),true);
  assert.equal(index.occupied(34,16,50),false);
});
