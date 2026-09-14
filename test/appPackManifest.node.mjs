import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { generateBuiltAppPack } from '../webapp/scripts/generate-app-pack-manifest.mjs';
import { copyPublicAssetsPlugin } from '../webapp/scripts/copy-public-assets.mjs';

async function fixture(t, extras = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'tonplaygram-app-pack-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const files = {
    'index.html': '<html><script type="module" src="/assets/main-abc.js"></script></html>',
    'assets/main-abc.js': 'import "./games/lazy-game.js";',
    'assets/games/lazy-game.js': 'export const game = "ready";',
    'version.json': JSON.stringify({ build: 'build-test-1' }),
    'pwa/game-packs/index.json': JSON.stringify({
      schemaVersion: 1,
      source: 'same-origin',
      packs: [{
        id: 'demo', title: 'Demo', gameSlugs: ['chess', 'pool'],
        version: 'legacy', manifestUrl: '/pwa/game-packs/demo.json'
      }]
    }),
    'pwa/game-packs/demo.json': JSON.stringify({ assets: [] }),
    ...extras
  };
  for (const [relative, contents] of Object.entries(files)) {
    const filename = path.join(root, relative);
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, contents);
  }
  return root;
}

test('includes every deployed runtime type with exact hashes and one visible application entry', async t => {
  const extraFiles = {
    'assets/scene/model.gltf': '{"buffers":[{"uri":"mesh.bin"}]}',
    'assets/scene/mesh.bin': Buffer.from([0, 1, 255, 8]),
    'assets/scene/normal.ktx2': 'texture',
    'vendor/draco/gltf/draco_decoder.wasm': 'wasm',
    'vendor/draco/gltf/draco_wasm_wrapper.js': 'decoder',
    'audio/background.m4a': 'music',
    'fonts/score.ttf': 'font',
    'fonts/body.woff2': 'font-two',
    'store-thumbs/table finish.webp': 'cover',
    'assets/odd#name?.bin': 'unusual url',
    'data/runtime.custom': 'unknown but deployed extension',
    'legacy-game.html': 'game',
    'manifest.webmanifest': '{"name":"TonPlayGram"}',
    'offline.html': 'offline launcher',
    'pwa/offline-assets.json': '["/legacy-game.html"]'
  };
  const root = await fixture(t, extraFiles);
  const { manifest, catalog } = await generateBuiltAppPack(root);
  assert.equal(manifest.id, 'tonplaygram-app');
  assert.equal(manifest.build, 'build-test-1');
  assert.deepEqual(manifest.dependencies, []);
  for (const [relative, contents] of Object.entries(extraFiles)) {
    const expectedUrl = `/${relative.split('/').map(encodeURIComponent).join('/')}`;
    const asset = manifest.assets.find(candidate => candidate.url === expectedUrl);
    assert.ok(asset, `Missing full-app asset: ${relative}`);
    assert.equal(asset.size, Buffer.byteLength(contents));
    assert.equal(asset.sha256, createHash('sha256').update(contents).digest('hex'));
    assert.equal(asset.sourceUrl, expectedUrl);
    assert.equal(asset.nativeRemovable, false);
  }
  assert.equal(manifest.assetCount, Object.keys(extraFiles).length + 3);
  assert.equal(manifest.totalBytes, manifest.assets.reduce((total, asset) => total + asset.size, 0));
  assert.deepEqual(catalog.packs.filter(pack => !pack.hidden).map(pack => pack.id), ['tonplaygram-app']);
  assert.deepEqual(catalog.packs[0].gameSlugs, ['chess', 'pool']);
  assert.equal(catalog.packs[1].id, 'demo');
  assert.equal(catalog.packs[1].version, 'legacy');
  assert.deepEqual(JSON.parse(await readFile(path.join(root, 'pwa/game-packs/tonplaygram-app.json'), 'utf8')), manifest);
});

test('excludes update controls and generated manifests; digest is stable and tracks file contents', async t => {
  const root = await fixture(t, {
    'service-worker.js': 'worker-one',
    'pwa/app-build.js': 'marker-one',
    'pwa/game-pack-service-worker.js': 'bridge-one',
    '_redirects': '/* /index.html 200',
    '_headers': 'cache headers',
    '.vite/manifest.json': 'build-only',
    'assets/main-abc.js.map': 'source map'
  });
  const first = await generateBuiltAppPack(root);
  assert.equal(first.manifest.assetCount, 3);
  const repeated = await generateBuiltAppPack(root);
  assert.equal(repeated.manifest.version, first.manifest.version);
  assert.equal(repeated.catalog.packs.filter(pack => pack.id === 'tonplaygram-app').length, 1);
  await writeFile(path.join(root, 'version.json'), JSON.stringify({ build: 'build-test-2' }));
  await writeFile(path.join(root, 'service-worker.js'), 'worker-two');
  const metadataChange = await generateBuiltAppPack(root);
  assert.equal(metadataChange.manifest.version, first.manifest.version);
  assert.equal(metadataChange.manifest.build, 'build-test-2');
  await writeFile(path.join(root, 'assets/games/lazy-game.js'), 'export const game = "updated";');
  const contentChange = await generateBuiltAppPack(root);
  assert.notEqual(contentChange.manifest.version, first.manifest.version);
});

test('keeps CDN asset sources used by native-lite without authorizing native shell pruning', async t => {
  const root = await fixture(t, {
    'assets/model.glb': 'model',
    'pwa/game-packs/demo.json': JSON.stringify({ assets: [{
      url: '/assets/model.glb',
      sourceUrl: 'https://cdn.example.com/game-packs/assets/model.glb',
      nativeRemovable: true
    }] })
  });
  const { manifest } = await generateBuiltAppPack(root);
  const model = manifest.assets.find(asset => asset.url === '/assets/model.glb');
  assert.equal(model.sourceUrl, 'https://cdn.example.com/game-packs/assets/model.glb');
  assert.equal(model.nativeRemovable, false);
  assert.equal(manifest.assets.find(asset => asset.url === '/index.html').sourceUrl, '/index.html');
});

test('rejects missing shell, missing runtime, broken entry references and missing build metadata', async t => {
  const scenarios = [
    { remove: 'index.html', message: /missing index\.html/ },
    { remove: 'assets', message: /missing executable runtime chunks/ },
    { write: ['index.html', '<script type="module" src="/assets/missing.js"></script>'], message: /unavailable runtime/ },
    { write: ['index.html', '<html>not a production build</html>'], message: /no built module entry/ },
    { write: ['version.json', '{}'], message: /missing its build identifier/ }
  ];
  for (const scenario of scenarios) {
    const root = await fixture(t);
    if (scenario.remove) await rm(path.join(root, scenario.remove), { recursive: true });
    if (scenario.write) await writeFile(path.join(root, scenario.write[0]), scenario.write[1]);
    await assert.rejects(generateBuiltAppPack(root), scenario.message);
    await assert.rejects(readFile(path.join(root, 'pwa/game-packs/tonplaygram-app.json')), { code: 'ENOENT' });
  }
});

async function externalFixture(t, { manifestChanges = {}, mappingChanges, scriptMappingChanges, extras = {} } = {}) {
  const sourceUrl = 'https://cdn.example.com/model.glb';
  const url = '/assets/original-model.glb';
  const contents = 'verified original model';
  const mapping = { [sourceUrl]: url };
  const manifest = {
    schemaVersion: 1,
    complete: true,
    assets: [{ sourceUrl, url, size: Buffer.byteLength(contents), sha256: createHash('sha256').update(contents).digest('hex'), aliases: [], dependencies: [] }],
    groups: [{ id: 'game-character', sourceUrl, essential: true }],
    failures: [],
    urlMap: mapping,
    ...manifestChanges
  };
  return fixture(t, {
    'index.html': '<script src="/assets/external/url-map.js"></script><script type="module" src="/assets/main-abc.js"></script>',
    'assets/original-model.glb': contents,
    'assets/external/manifest.json': JSON.stringify(manifest),
    'assets/external/url-map.json': JSON.stringify(mappingChanges || manifest.urlMap),
    'assets/external/url-map.js': `/* Generated asset map. */\nself.__TONPLAYGRAM_EXTERNAL_ASSETS__ = ${JSON.stringify(scriptMappingChanges || manifest.urlMap)};\n`,
    ...extras
  });
}

test('a completed external import with verified local originals is included in the full application', async t => {
  const root = await externalFixture(t, { manifestChanges: { failures: [{ id: 'unused-mirror', essential: false, error: 'Optional mirror unavailable' }] } });
  const { manifest } = await generateBuiltAppPack(root);
  assert.ok(manifest.assets.find(asset => asset.url === '/assets/original-model.glb'));
  assert.ok(manifest.assets.find(asset => asset.url === '/assets/external/url-map.js'));
  assert.ok(manifest.assets.find(asset => asset.url === '/assets/external/manifest.json'));
});

test('requires finished external imports when the application shell loads the generated asset map', async t => {
  for (const changes of [
    { manifestChanges: { complete: false } },
    { manifestChanges: { complete: undefined } },
    { manifestChanges: { failures: [{ sourceUrl: 'https://cdn.example.com/required.glb', error: 'Unavailable' }] } }
  ]) {
    const root = await externalFixture(t, changes);
    await assert.rejects(generateBuiltAppPack(root), /external game asset import is incomplete|unresolved required asset/);
    await assert.rejects(readFile(path.join(root, 'pwa/game-packs/tonplaygram-app.json')), { code: 'ENOENT' });
  }
  const missingFiles = await externalFixture(t);
  await rm(path.join(missingFiles, 'assets/external/url-map.js'));
  await assert.rejects(generateBuiltAppPack(missingFiles), /requires assets\/external\/url-map\.js/);
});

test('rejects stale runtime maps, missing mapping targets and corrupted imported asset payloads', async t => {
  const wrongMap = { 'https://cdn.example.com/model.glb': '/assets/missing.glb' };
  for (const changes of [
    { mappingChanges: wrongMap },
    { scriptMappingChanges: wrongMap }
  ]) {
    const root = await externalFixture(t, changes);
    await assert.rejects(generateBuiltAppPack(root), /runtime mappings differ/);
  }
  const missingTarget = await externalFixture(t, {
    manifestChanges: { urlMap: { 'https://cdn.example.com/model.glb': '/assets/original-model.glb', 'https://cdn.example.com/texture.png': '/assets/missing-texture.png' } }
  });
  await assert.rejects(generateBuiltAppPack(missingTarget), /mapping target is missing/);
  const corrupted = await externalFixture(t, { extras: { 'assets/original-model.glb': 'corrupted payload' } });
  await assert.rejects(generateBuiltAppPack(corrupted), /checksum\/size differs/);
  await assert.rejects(readFile(path.join(corrupted, 'pwa/game-packs/tonplaygram-app.json')), { code: 'ENOENT' });
});

test('rejects imported models with unresolved dependencies or missing required inventory groups', async t => {
  const root = await externalFixture(t);
  const manifestPath = path.join(root, 'assets/external/manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.assets[0].dependencies = [{ reference: 'texture.png', url: 'https://cdn.example.com/texture.png' }];
  await writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(generateBuiltAppPack(root), /dependency is missing/);
  manifest.assets[0].dependencies = [];
  manifest.groups.push({ id: 'required-scene', sourceUrl: 'https://cdn.example.com/scene.gltf', essential: true });
  await writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(generateBuiltAppPack(root), /Required external asset group is missing/);
});

test('public copying preserves emitted bundle paths, copies other files and hard-links external assets', async t => {
  const distDir = await fixture(t, { 'assets/external/emitted.js': 'compiled external module' });
  const publicDir = await fixture(t, {
    'index.html': '<script type="module" src="/src/main.jsx"></script>',
    'assets/main-abc.js': 'uncompiled public entry',
    'assets/external/emitted.js': 'uncompiled external module',
    'assets/external/model.glb': 'immutable imported model',
    'offline.html': 'public offline launcher'
  });
  const expectedIndex = await readFile(path.join(distDir, 'index.html'), 'utf8');
  const expectedChunk = await readFile(path.join(distDir, 'assets/main-abc.js'), 'utf8');
  const plugin = copyPublicAssetsPlugin();
  plugin.configResolved({ root: distDir, publicDir, build: { outDir: '.' } });
  await plugin.writeBundle({}, {
    'index.html': {}, 'assets/main-abc.js': {}, 'assets/external/emitted.js': {}
  });
  assert.equal(await readFile(path.join(distDir, 'index.html'), 'utf8'), expectedIndex);
  assert.equal(await readFile(path.join(distDir, 'assets/main-abc.js'), 'utf8'), expectedChunk);
  assert.equal(await readFile(path.join(distDir, 'assets/external/emitted.js'), 'utf8'), 'compiled external module');
  assert.equal(await readFile(path.join(distDir, 'offline.html'), 'utf8'), 'public offline launcher');
  for (const [relative, hardLinked] of [['assets/external/model.glb', true], ['offline.html', false]]) {
    const source = await stat(path.join(publicDir, relative));
    const target = await stat(path.join(distDir, relative));
    assert.equal(source.dev === target.dev && source.ino === target.ino, hardLinked, relative);
  }
  const { manifest } = await generateBuiltAppPack(distDir);
  assert.ok(manifest.assets.some(asset => asset.url === '/assets/external/model.glb'));
  assert.ok(manifest.assets.some(asset => asset.url === '/offline.html'));
});
