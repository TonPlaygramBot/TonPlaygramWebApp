import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import { CHESS_TABLE_OPTIONS } from '../webapp/src/config/chessBattleInventoryConfig.js';
import { fitCheckersTable, CHECKERS_TABLE_FOOTPRINTS } from '../webapp/src/games/checkers/checkersTableFit.ts';
import { createTable, createHumans, legPoints, countLegIntersections, tableY, tile } from './checkersTableFixture.mjs';

const humans = await createHumans();
const points = humans.flatMap(legPoints);

for (const id of ['murlan-default', 'hexagonTable', 'grandOval', 'diamondEdge']) {
  test(`${id}: actual table clears both actors' thighs, knees, shins and feet`, () => {
    const table = createTable(id);
    const before = countLegIntersections(table.group, points);
    fitCheckersTable(table.group, { tableId: id, surfaceY: tableY });
    const after = countLegIntersections(table.group, points);
    console.log(`${id}: ${before} intersecting leg samples before, ${after} after`);
    assert.ok(before > 0, 'fixture must reproduce the original overlap');
    assert.equal(after, 0, 'table intersects a leg or its 8mm clearance');
    assert.equal(table.surfaceY, tableY, 'playing surface height changed');
    const bounds = new THREE.Box3().setFromObject(table.group);
    assert.ok(bounds.max.z - bounds.min.z > tile * 8 + 0.1, 'board overhangs table');
    for (const x of [-tile * 4 * 1.14, tile * 4 * 1.14]) for (const z of [-tile * 4 * 1.14, tile * 4 * 1.14]) {
      const ray = new THREE.Raycaster(new THREE.Vector3(x, tableY + 0.3, z), new THREE.Vector3(0, -1, 0));
      const support = ray.intersectObject(table.group, true)[0];
      assert.ok(support && support.point.y >= tableY - 0.035, 'decorative board corner overhangs the actual table shape');
    }
    const geometry = table.group.children[0].geometry;
    const bytes = geometry.getAttribute('position').array.slice();
    fitCheckersTable(table.group, { tableId: id, surfaceY: tableY });
    assert.deepEqual(geometry.getAttribute('position').array, bytes, 'repeat fit shrank the table again');
    table.dispose();
  });
}

test('every one of the 17 selectable tables has an explicit footprint', () => {
  assert.equal(CHESS_TABLE_OPTIONS.length, 17);
  for (const option of CHESS_TABLE_OPTIONS) assert.ok(CHECKERS_TABLE_FOOTPRINTS[option.id], option.id);
});

test('an imported single-mesh table with a long underframe also clears legs', () => {
  // Stress fixture for a combined mesh, not a substitute for inspecting each
  // remote Poly Haven asset. UVs and material groups must survive the fit.
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 1.2, 1.4), new THREE.MeshStandardMaterial());
  mesh.rotation.y = 0.18;
  const model = new THREE.Group(); model.add(mesh);
  model.position.set(0.3, 0.8, -0.2);
  fitCheckersTable(model, { tableId: 'WoodenTable_02', surfaceY: tableY, imported: true });
  assert.equal(countLegIntersections(model, points), 0);
  const bounds = new THREE.Box3().setFromObject(model);
  assert.ok(Math.abs(bounds.max.y - tableY) < 1e-6);
  assert.ok(bounds.getSize(new THREE.Vector3()).y <= 0.30001);
  assert.ok(mesh.geometry.getAttribute('uv'));
  assert.equal(mesh.geometry.groups.length, 6);
  assert.ok(Array.from(mesh.geometry.getAttribute('normal').array).every(Number.isFinite));
});
