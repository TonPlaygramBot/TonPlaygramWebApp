import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { Group, Mesh, MeshStandardMaterial, Texture } from '../webapp/node_modules/three/build/three.module.js';
import { createSnookerTableTextureQuality } from '../webapp/src/pages/Games/snookerTableTextures.ts';

function fixture({ supported = true, ready = Promise.resolve(true), fail = false, pending = null } = {}) {
  const table = new Group();
  table.userData.ready = ready;
  const material = new MeshStandardMaterial();
  material.name = 'Baize';
  material.map = new Texture();
  material.map.repeat.set(2, 3);
  material.normalMap = new Texture();
  material.roughnessMap = material.metalnessMap = new Texture();
  const second = material.clone();
  table.add(new Mesh(undefined, [material, second]));
  const renderer = {
    capabilities: { maxTextureSize: 4096, getMaxAnisotropy: () => 16 },
    extensions: { has: () => supported }
  };
  const loaded = [];
  let disposed = 0;
  let loaderDisposed = 0;
  const controller = createSnookerTableTextureQuality(table, renderer, () => ({
    async loadAsync(url) {
      if (pending) await pending;
      if (fail && url.endsWith('normal.ktx2')) throw new Error('Network error');
      const texture = new Texture();
      texture.addEventListener('dispose', () => { disposed++; });
      loaded.push(texture);
      return texture;
    },
    dispose() { loaderDisposed++; }
  }));
  return { table, material, second, controller, loaded, get disposed() { return disposed; },
    get loaderDisposed() { return loaderDisposed; } };
}

test('upgrades shared surfaces once, preserves UVs and packed channels, and restores on disposal', async () => {
  const value = fixture();
  const originals = [value.material.map, value.material.normalMap, value.material.roughnessMap];
  assert.equal(await value.controller.ready, true);
  assert.equal(value.loaded.length, 3, 'two meshes reuse the same three maps');
  assert.equal(value.material.map, value.second.map);
  assert.notEqual(value.material.map, originals[0]);
  assert.deepEqual(value.material.map.repeat.toArray(), [2, 3]);
  assert.equal(value.material.map.anisotropy, 16);
  assert.equal(value.material.roughnessMap, value.material.metalnessMap);
  assert.equal(value.table.userData.textureResolution, 4096);
  assert.equal(value.loaderDisposed, 1);
  value.controller.dispose();
  value.controller.dispose();
  assert.deepEqual([value.material.map, value.material.normalMap, value.material.roughnessMap], originals);
  assert.equal(value.material.metalnessMap, originals[2]);
  assert.equal(value.disposed, 3, 'each replacement disposed once');
});

test('unsupported GPU keeps the authored base maps without fetching 4K textures', async () => {
  const value = fixture({ supported: false });
  const original = value.material.map;
  assert.equal(await value.controller.ready, false);
  assert.equal(value.material.map, original);
  assert.equal(value.loaded.length, 0);
});

test('one failed map leaves all original bindings intact and frees successful downloads', async () => {
  const value = fixture({ fail: true });
  const original = value.material.map;
  assert.equal(await value.controller.ready, false);
  assert.equal(value.material.map, original);
  assert.equal(value.disposed, 2);
  assert.equal(value.loaderDisposed, 1);
});

test('leaving the scene before table readiness avoids starting downloads', async () => {
  let resolve;
  const ready = new Promise(done => { resolve = done; });
  const value = fixture({ ready });
  value.controller.dispose();
  resolve(true);
  assert.equal(await value.controller.ready, false);
  assert.equal(value.loaded.length, 0);
});

test('leaving the scene during downloads prevents late swaps and disposes results', async () => {
  let resolve;
  const pending = new Promise(done => { resolve = done; });
  const value = fixture({ pending });
  const original = value.material.map;
  await Promise.resolve();
  value.controller.dispose();
  resolve();
  assert.equal(await value.controller.ready, false);
  assert.equal(value.material.map, original);
  assert.equal(value.disposed, 3);
  assert.equal(value.loaderDisposed, 1);
});

test('all bundled replacements are native 4K KTX2 textures with a complete mip chain', async () => {
  const root = new URL('../webapp/public/assets/snooker-royal/mesxwi/4k/', import.meta.url);
  const names = await readdir(root);
  assert.equal(names.length, 18);
  for (const name of names) {
    const bytes = await readFile(new URL(name, root));
    assert.equal(bytes.subarray(0, 12).toString('hex'), 'ab4b5458203230bb0d0a1a0a', name);
    assert.equal(bytes.readUInt32LE(20), 4096, name);
    assert.equal(bytes.readUInt32LE(24), 4096, name);
    assert.equal(bytes.readUInt32LE(40), 13, name);
  }
});
