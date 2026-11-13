import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as T from '../webapp/node_modules/three/build/three.module.js';
import { collectResidentialInventory } from '../webapp/scripts/external-assets/residential-inventory.mjs';
import { localAssetUrl } from '../webapp/scripts/external-assets/downloader.mjs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const base = new URL('../webapp/public/assets/tirana-streets/residential/', import.meta.url);
const source = JSON.parse(await readFile(new URL('sources.json', base), 'utf8'));
const lock = JSON.parse(await readFile(new URL('../webapp/scripts/external-assets/source-lock.json', import.meta.url), 'utf8'));

test('all residential geometry and original textures have same-origin runtime URLs and reviewed source pins', async () => {
  const groups = await collectResidentialInventory({ repoRoot: root });
  assert.equal(groups.length, 13);
  assert.equal(source.license, 'CC0-1.0');
  for (const file of source.runtimeFiles) {
    assert.equal(lock.sourcePins[file.url], file.sha256, `frozen build pin for ${file.path}`);
    assert.equal(file.localUrl, localAssetUrl(file.url));
    assert.ok(groups.some(group => group.candidates.includes(file.url)));
  }
  const dependencies = new Set(source.runtimeFiles.map(file => file.localUrl));
  for (const kind of ['house', 'villa', 'apartment', 'facade-kit']) {
    const model = JSON.parse(await readFile(new URL(`${kind}.gltf`, base), 'utf8'));
    for (const resource of [...model.buffers, ...model.images]) assert.ok(dependencies.has(resource.uri), resource.uri);
    assert.equal(model.images.length, 12, 'all original material maps are retained');
  }
});

test('mapped facade kit exposes original human-scale modules without source display-grid offsets', async () => {
  const model = JSON.parse(await readFile(new URL('facade-kit.gltf', base), 'utf8'));
  assert.equal(model.nodes.length, 7);
  for (const name of source.facadeKit.modules) assert.ok(model.nodes.some(node => node.name === name));
  for (const node of model.nodes) assert.ok(!node.translation && !node.scale && !node.rotation);
  const wall = model.nodes.find(node => node.name === 'wall_standard_standard_01');
  const bounds = nodeBounds(model, wall);
  assert.ok(Math.abs(bounds.max.x - bounds.min.x - 3) < .001);
  assert.ok(Math.abs(bounds.max.y - bounds.min.y - 3) < .001);
});

function nodeBounds(model, node) {
  const matrix = new T.Matrix4().compose(
    new T.Vector3().fromArray(node.translation || [0, 0, 0]),
    new T.Quaternion().fromArray(node.rotation || [0, 0, 0, 1]),
    new T.Vector3().fromArray(node.scale || [1, 1, 1]),
  );
  const bounds = new T.Box3();
  for (const primitive of model.meshes[node.mesh].primitives) {
    const accessor = model.accessors[primitive.attributes.POSITION];
    const local = new T.Box3(new T.Vector3().fromArray(accessor.min), new T.Vector3().fromArray(accessor.max));
    bounds.union(local.applyMatrix4(matrix));
  }
  return bounds;
}

test('residences are compact complete buildings with a centered front entrance, not a catalogue grid', async () => {
  for (const variant of source.variants) {
    const model = JSON.parse(await readFile(new URL(variant.path, base), 'utf8'));
    const bounds = new T.Box3();
    for (const node of model.nodes) bounds.union(nodeBounds(model, node));
    const [width, height, depth] = variant.dimensions;
    assert.ok(bounds.max.x <= width / 2 + .34 && bounds.min.x >= -width / 2 - .34);
    assert.ok(bounds.max.z <= depth / 2 + .34 && bounds.min.z >= -depth / 2 - .34);
    assert.ok(Math.abs(bounds.min.y) < .001 && Math.abs(bounds.max.y - height) < .001);
    for (let face = 0; face < 4; face++) assert.ok(model.nodes.some(node => node.name.startsWith(`${variant.kind}_wall_${face}_`)));
    assert.equal(model.nodes.filter(node => node.name === `${variant.kind}_roof`).length, 1);
    const doors = model.nodes.filter(node => node.name === 'residential_entry_door');
    assert.equal(doors.length, 1);
    const center = nodeBounds(model, doors[0]).getCenter(new T.Vector3());
    assert.ok(Math.abs(center.x) < .001 && Math.abs(center.z - depth / 2) < .3);
  }
});
