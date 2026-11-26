import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {ALI_DEMI_FURNITURE, aliDemiFurnitureVisible, buildAliDemiFurniture} from '../webapp/src/games/tiranastreets-november/aliDemiFurniture.mjs';
import {aliDemiSurfaces} from '../webapp/src/games/tiranastreets-november/shared/aliDemiRecreation.mjs';
import {insidePolygon} from '../webapp/src/games/tiranastreets-november/shared/engine.mjs';
import {WORLD} from '../webapp/src/games/tiranastreets-november/shared/world.mjs';

function segmentDistance(x, z, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz) || 0));
  return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
}
const edgeDistance = (x, z, ring) => Math.min(...ring.map(
  (a, i) => segmentDistance(x, z, a, ring[(i + 1) % ring.length]),
));

test('furnishings stay in the mapped park verge and clear of roads, paths and buildings', () => {
  const {park, skate, pitches} = aliDemiSurfaces(WORLD.origin);
  for (const [i, {name, x, z}] of ALI_DEMI_FURNITURE.entries()) {
    const radius = name === 'park_bench' ? 1.05 : .37;
    assert.ok(insidePolygon(x, z, park) && edgeDistance(x, z, park) > radius);
    for (const playingSurface of [skate, ...pitches]) {
      assert.ok(!insidePolygon(x, z, playingSurface) && edgeDistance(x, z, playingSurface) > radius);
    }
    assert.ok(!WORLD.roads.some(r => segmentDistance(x, z, r.a, r.b) < r.w / 2 + radius + (r.walk ? .4 : 2)));
    assert.ok(!WORLD.buildings.some(b => insidePolygon(x, z, b.p) || edgeDistance(x, z, b.p) < radius));
    assert.ok(!ALI_DEMI_FURNITURE.slice(0, i).some(p => Math.hypot(p.x - x, p.z - z) < 2));
  }
});

test('the existing GLB builds seven placements in four material batches with no shadow draws', async () => {
  const require = createRequire(new URL('../webapp/package.json', import.meta.url));
  const loaderUrl = pathToFileURL(require.resolve('three/addons/loaders/GLTFLoader.js'));
  const {GLTFLoader} = await import(loaderUrl);
  const raw = await readFile(new URL('../webapp/public/assets/tirana-streets/street-furniture.glb', import.meta.url));
  const {scene} = await new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), '');
  const furniture = buildAliDemiFurniture(scene);
  assert.equal(furniture.visible, false);
  assert.deepEqual(furniture.children.map(mesh => mesh.count).sort((a, b) => a - b), [3, 3, 4, 4]);
  assert.ok(furniture.children.every(mesh => mesh.isInstancedMesh && mesh.boundingSphere && !mesh.castShadow));
  const triangles = furniture.children.reduce((sum, mesh) =>
    sum + mesh.count * (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3, 0);
  assert.ok(triangles < 1_200);
});

test('neighborhood props turn off at a distance and use a lower battery range', () => {
  assert.ok(aliDemiFurnitureVisible(1460, 13, true));
  assert.ok(aliDemiFurnitureVisible(1550, 13, false));
  assert.ok(!aliDemiFurnitureVisible(1550, 13, true));
  assert.ok(!aliDemiFurnitureVisible(0, 0, false));
});
