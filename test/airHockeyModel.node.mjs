import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import { splitAirHockeyGeometry, fitAirHockeyTable, fitAirHockeyPiece, AIR_HOCKEY_DIMENSIONS as D, SOURCE_FIELD } from '../webapp/src/components/airHockey/model.ts';
import { resolveAirHockeyRails } from '../webapp/src/components/airHockey/collisions.ts';
const file = await readFile(new URL('../webapp/public/assets/airhockey/air-hockey-table.glb', import.meta.url));
const length = file.readUInt32LE(12);
const glb = JSON.parse(file.subarray(20, 20 + length).toString());
const bin = file.subarray(28 + length);
const primitive = glb.meshes[0].primitives[0];
function attribute(id) {
  const a = glb.accessors[id], view = glb.bufferViews[a.bufferView];
  const size = { SCALAR: 1, VEC2: 2, VEC3: 3 }[a.type];
  const values = new Float32Array(a.count * size);
  for (let i = 0; i < a.count; i++) for (let c = 0; c < size; c++) {
    const offset = (view.byteOffset || 0) + (a.byteOffset || 0) + i * (view.byteStride || size * 4) + c * 4;
    values[i * size + c] = a.componentType === 5126 ? bin.readFloatLE(offset) : bin.readUInt32LE(offset);
  }
  return new THREE.BufferAttribute(values, size);
}
const source = new THREE.BufferGeometry();
source.setAttribute('position', attribute(primitive.attributes.POSITION));
source.setAttribute('normal', attribute(primitive.attributes.NORMAL));
source.setAttribute('uv', attribute(primitive.attributes.TEXCOORD_0));
source.setIndex(Array.from(attribute(primitive.indices).array));
const parts = splitAirHockeyGeometry(source);

test('uploaded GLB yields exactly one table, two mallets and one puck without losing triangles or UVs', () => {
  assert.equal(parts.length, 4);
  assert.equal(parts.reduce((sum, part) => sum + part.index.count, 0), source.index.count);
  for (const part of parts) assert.equal(part.attributes.uv.count, part.attributes.position.count);
  const heights = parts.slice(1).map((part) => part.boundingBox.getSize(new THREE.Vector3()).y).sort((a, b) => a - b);
  assert.ok(heights[0] < heights[1] * .5, 'Puck must be thinner than both mallets');
  assert.ok(Math.abs(heights[1] - heights[2]) < .01, 'Matching mallets');
});

test('model is centered on the unchanged field and includes its own legs', () => {
  const table = fitAirHockeyTable(parts[0].clone());
  const box = table.boundingBox;
  assert.ok(Math.abs(box.getCenter(new THREE.Vector3()).x) < .001);
  assert.ok(Math.abs(box.getCenter(new THREE.Vector3()).z) < .001);
  assert.ok(box.min.y < -30, 'Original legs retained');
  assert.ok(box.min.x < -D.playfieldWidth / 2 && box.max.x > D.playfieldWidth / 2);
  assert.ok(box.min.z < -D.playfieldHeight / 2 && box.max.z > D.playfieldHeight / 2);
  const point = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([
    SOURCE_FIELD.centerX, SOURCE_FIELD.surfaceY, SOURCE_FIELD.centerZ,
    SOURCE_FIELD.centerX - SOURCE_FIELD.halfLength, SOURCE_FIELD.surfaceY, SOURCE_FIELD.centerZ + SOURCE_FIELD.halfWidth
  ], 3));
  fitAirHockeyTable(point);
  assert.ok(new THREE.Vector3().fromBufferAttribute(point.attributes.position, 0).length() < .001);
  assert.ok(Math.abs(point.attributes.position.getX(1) - D.playfieldWidth / 2) < .001);
  assert.ok(Math.abs(point.attributes.position.getZ(1) - D.playfieldHeight / 2) < .001);
});

test('real puck and mallet geometry matches its collision radius and sits on the surface', () => {
  for (const part of parts.slice(1)) {
    const fitted = fitAirHockeyPiece(part.clone(), 2), box = fitted.boundingBox;
    assert.ok(Math.abs(Math.max(box.max.x - box.min.x, box.max.z - box.min.z) - 4) < .0001);
    assert.ok(Math.abs(box.min.y) < .0001);
    assert.ok(Math.abs(box.getCenter(new THREE.Vector3()).x) < .0001);
    assert.ok(Math.abs(box.getCenter(new THREE.Vector3()).z) < .0001);
  }
});

const field = { w: D.playfieldWidth, h: D.playfieldHeight, goalW: D.playfieldWidth * SOURCE_FIELD.goalHalfWidth / SOURCE_FIELD.halfWidth };
const radius = D.playfieldWidth * .0285;
test('all four corners rebound; no invisible pool pockets reset a rally', () => {
  for (const x of [-1, 1]) for (const z of [-1, 1]) {
    const point = { x: x * field.w / 2, z: z * field.h / 2 }, velocity = { x: x * 4, z: z * 6 };
    assert.equal(resolveAirHockeyRails(point, velocity, field, radius), 'rail');
    assert.ok(velocity.x * x < 0 && velocity.z * z < 0);
    assert.ok(Math.abs(point.x) <= field.w / 2 - radius);
    assert.ok(Math.abs(point.z) <= field.h / 2 - radius);
  }
});
test('only a puck that fits completely through an end goal scores', () => {
  for (const sign of [-1, 1]) {
    assert.equal(resolveAirHockeyRails({ x: 0, z: sign * field.h / 2 }, { x: 0, z: sign * 5 }, field, radius), sign < 0 ? 'north-goal' : 'south-goal');
    const point = { x: field.goalW / 2 - radius + .01, z: sign * field.h / 2 }, velocity = { x: 0, z: sign * 5 };
    assert.equal(resolveAirHockeyRails(point, velocity, field, radius), 'rail');
    assert.equal(velocity.z, -sign * 5);
  }
});
test('midfield motion is not changed by a rail check', () => {
  const point = { x: 3, z: 2 }, velocity = { x: 4, z: -5 };
  assert.equal(resolveAirHockeyRails(point, velocity, field, radius), null);
  assert.deepEqual(point, { x: 3, z: 2 }); assert.deepEqual(velocity, { x: 4, z: -5 });
});
