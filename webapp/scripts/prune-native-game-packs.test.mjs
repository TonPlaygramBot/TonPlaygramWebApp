import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { generateBuiltAppPack } from './generate-app-pack-manifest.mjs';
import { generateGamePackManifests } from './generate-game-pack-manifests.mjs';
import { pruneNativeGamePacks } from './prune-native-game-packs.mjs';

const asset = (url, nativeRemovable = true) => ({
  url, sourceUrl: 'https://packs.example.invalid' + url, nativeRemovable
});

async function makeDist(t, assets, files, cover) {
  const distDir = await mkdtemp(path.join(os.tmpdir(), 'native-pack-prune-'));
  t.after(() => rm(distDir, { recursive: true, force: true }));
  const diskPath = p => path.join(distDir, p);
  const put = async (p, content) => {
    const dest = diskPath(p);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, content);
  };
  for (const file of files) await put(file, file);
  await put('/pwa/game-packs/index.json', JSON.stringify({
    source: 'cdn', packs: [{ manifestUrl: '/pwa/game-packs/fixture.json', cover }]
  }));
  await put('/pwa/game-packs/fixture.json', JSON.stringify({ assets }));
  return { distDir, diskPath };
}

test('pruning the last asset removes nested empty folders, without removing retained sibling files', async t => {
  const model = '/assets/city/completion/model.glb';
  const nested = '/assets/city/props/nested/prop.glb';
  const wrappedDecoder = '/assets/city/decoder/draco_wasm_wrapper.js';
  const cover = '/assets/city/cover.webp';
  const { distDir, diskPath } = await makeDist(t,
    [asset(model), asset(nested), asset(wrappedDecoder, false), asset(cover)],
    [model, nested, wrappedDecoder, cover], cover);
  const report = await pruneNativeGamePacks({ distDir });
  assert.equal(report.removedFiles, 2);
  assert.equal(report.removedBytes, Buffer.byteLength(model) + Buffer.byteLength(nested));
  assert.deepEqual(report.preservedCovers, [cover]);
  await assert.rejects(stat(diskPath('/assets/city/completion')), { code: 'ENOENT' });
  await assert.rejects(stat(diskPath('/assets/city/props')), { code: 'ENOENT' });
  assert.equal(await readFile(diskPath(wrappedDecoder), 'utf8'), wrappedDecoder);
  assert.equal(await readFile(diskPath(cover), 'utf8'), cover);
});

test('missing assets do not remove another retained sibling or inflate report totals', async t => {
  const missing = '/assets/city/absent.glb';
  const retained = '/assets/city/license.txt';
  const { distDir, diskPath } = await makeDist(t, [asset(missing)], [retained]);
  const report = await pruneNativeGamePacks({ distDir });
  assert.equal(report.removedFiles, 0);
  assert.equal(report.removedBytes, 0);
  assert.equal(await readFile(diskPath(retained), 'utf8'), retained);
});

test('Racing Draco stays in native lite and in the full manifest, but sibling assets still defer', async t => {
  const root = '/assets/tirana-streets/imported/draco/';
  const bundled = ['draco_decoder.wasm', 'draco_decoder.js', 'draco_wasm_wrapper.js']
    .map(file => root + file);
  const deferred = [root + 'other.wasm', '/assets/tirana-streets/other/draco_decoder.wasm'];
  const { distDir, diskPath } = await makeDist(t, [], [...bundled, ...deferred, '/assets/main.js']);
  await writeFile(diskPath('/index.html'), '<script type="module" src="/assets/main.js"></script>');
  await writeFile(diskPath('/version.json'), JSON.stringify({ build: 'decoder-fixture' }));

  const outputDir = diskPath('/pwa/game-packs');
  await generateGamePackManifests({
    publicDir: distDir,
    outputDir,
    cdnBaseUrl: 'https://packs.example.invalid'
  });
  const cityPath = path.join(outputDir, 'shared-tirana-city.json');
  const cityBytes = await readFile(cityPath, 'utf8');
  const city = new Map(JSON.parse(cityBytes).assets.map(asset => [asset.url, asset]));
  const { manifest } = await generateBuiltAppPack(distDir);
  const full = new Map(manifest.assets.map(asset => [asset.url, asset]));
  for (const url of [...bundled, ...deferred]) {
    const expectedSource = bundled.includes(url) ? url : 'https://packs.example.invalid' + url;
    assert.equal(city.get(url).nativeRemovable, deferred.includes(url), url);
    assert.equal(city.get(url).sourceUrl, expectedSource, url);
    assert.equal(full.get(url).sourceUrl, expectedSource, url);
    assert.equal(full.get(url).size, city.get(url).size, url);
    assert.equal(full.get(url).sha256, city.get(url).sha256, url);
  }

  const fullPath = path.join(outputDir, 'tonplaygram-app.json');
  const fullBytes = await readFile(fullPath, 'utf8');
  const report = await pruneNativeGamePacks({ distDir });
  assert.equal(report.removedFiles, deferred.length);
  for (const url of bundled) assert.equal(await readFile(diskPath(url), 'utf8'), url);
  for (const url of deferred) await assert.rejects(stat(diskPath(url)), { code: 'ENOENT' });
  assert.equal(await readFile(cityPath, 'utf8'), cityBytes);
  assert.equal(await readFile(fullPath, 'utf8'), fullBytes);
});
