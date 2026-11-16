import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from '../webapp/node_modules/sharp/lib/index.js';
import { build } from '../webapp/node_modules/esbuild/lib/main.js';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';

const temp = await mkdtemp(join(tmpdir(), 'snooker-native-textures-'));
after(() => rm(temp, { recursive: true, force: true }));
const threePath = new URL('../webapp/node_modules/three/build/three.module.js', import.meta.url).pathname;
await build({ entryPoints: [new URL('../webapp/src/pages/Games/snookerUploadedTable.ts', import.meta.url).pathname], bundle: true, format: 'esm', platform: 'node', outfile: join(temp, 'table.mjs'), alias: { three: threePath }, external: [threePath] });
const { configureUploadedSnookerTextures } = await import(pathToFileURL(join(temp, 'table.mjs')));

test('published GLB has all 21 authored maps, with 18 native 4K maps and three 1K maps', async () => {
  const modelUrl = new URL('../webapp/public/assets/snooker-royal/mesxwi/snooker-table.glb', import.meta.url);
  const bytes = await readFile(modelUrl);
  assert.ok(bytes.length < 48 * 1024 * 1024);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength));
  const binary = bytes.subarray(28 + jsonLength);
  assert.equal(gltf.asset.extras.sourceSha256, '5fc4de8e3d2a8896ca4ea63ff638474b5ee7e0ff21c801267aeaca66c5ceb59d');
  assert.equal(gltf.images.length, 21);
  const sizes = [];
  for (const image of gltf.images) {
    const view = gltf.bufferViews[image.bufferView];
    assert.match(image.uri, /^textures\/table-\d{2}\.(jpg|png)$/);
    const payload = image.uri ? await readFile(new URL(image.uri, modelUrl)) : binary.subarray(view.byteOffset, view.byteOffset + view.byteLength);
    assert.ok(payload.length < 48 * 1024 * 1024);
    const metadata = await sharp(payload).metadata();
    assert.equal(metadata.width, metadata.height);
    sizes.push(metadata.width);
  }
  assert.equal(sizes.filter(size => size === 4096).length, 18);
  assert.equal(sizes.filter(size => size === 1024).length, 3);
});

test('runtime sampling keeps image, UV settings and map colour spaces intact', () => {
  const base = new THREE.Texture({ width: 4096, height: 4096 });
  base.colorSpace = THREE.SRGBColorSpace;
  base.repeat.set(2, 3);
  const normal = new THREE.Texture({ width: 4096, height: 4096 });
  const material = new THREE.MeshStandardMaterial({ map: base, normalMap: normal });
  const scene = new THREE.Group();
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(), [material, material]));
  configureUploadedSnookerTextures(scene, 16);
  for (const texture of [base, normal]) {
    assert.equal(texture.anisotropy, 16);
    assert.equal(texture.minFilter, THREE.LinearMipmapLinearFilter);
    assert.equal(texture.magFilter, THREE.LinearFilter);
    assert.equal(texture.generateMipmaps, true);
    assert.equal(texture.image.width, 4096);
    assert.equal(texture.version, 1, 'shared maps are configured once');
  }
  assert.equal(base.colorSpace, THREE.SRGBColorSpace);
  assert.equal(normal.colorSpace, THREE.NoColorSpace);
  assert.deepEqual(base.repeat.toArray(), [2, 3]);
});

test('missing or nonfinite anisotropy capability safely uses one', () => {
  const map = new THREE.Texture();
  const scene = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ map }));
  for (const limit of [undefined, NaN, Infinity, 0]) {
    configureUploadedSnookerTextures(scene, limit);
    assert.equal(map.anisotropy, 1);
  }
});

test('Pool/Snooker downloadable pack includes every relative table image', async () => {
  const { generateGamePackManifests, GAME_PACK_DEFINITIONS } = await import('../webapp/scripts/generate-game-pack-manifests.mjs');
  const definition = GAME_PACK_DEFINITIONS.find(pack => pack.gameSlugs?.includes('snookerroyale'));
  assert.ok(definition);
  const outputDir = join(temp, 'packs');
  await generateGamePackManifests({ outputDir, definitions: [definition] });
  const manifest = JSON.parse(await readFile(join(outputDir, `${definition.id}.json`), 'utf8'));
  const assetUrls = new Set(manifest.assets.map(asset => asset.url));
  const modelUrl = new URL('../webapp/public/assets/snooker-royal/mesxwi/snooker-table.glb', import.meta.url);
  const bytes = await readFile(modelUrl);
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
  for (const image of gltf.images) {
    assert.ok(assetUrls.has(`/assets/snooker-royal/mesxwi/${image.uri}`), image.uri);
  }
});
