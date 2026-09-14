import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  collectStaticExternalAssets,
  collectExternalAssetInventory,
  collectBuiltExternalAssetInventory,
  extractModuleDependencySpecifiers,
  shouldExcludeWeaponKartGame
} from '../webapp/scripts/external-assets/source-inventory.mjs';

async function fixture(t, files) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'external-assets-inventory-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [relative, text] of Object.entries(files)) {
    const filename = path.join(root, relative);
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, text);
  }
  return { repoRoot: root };
}

test('finds exact static assets and constant templates without executing source or collecting comments and links', async t => {
  const options = await fixture(t, {
    'webapp/src/game.tsx': [
      'const BASE = "https://cdn.example.com/models";',
      'const model = `${BASE}/person.gltf`;',
      'const texture = "https://cdn.example.com/texture.png" + "?quality=high";',
      'const audio = "https:\\/\\/cdn.example.com/sound.mp3";',
      'const remote = "https://api.readyplayer.me/v1/avatars/character.glb";',
      '// https://cdn.example.com/comment.png',
      '/* https://cdn.example.com/doc.js */',
      'const account = "https://api.example.com/user.json";',
      'const credit = { licenseUrl: "https://cdn.example.com/license.json" };',
      'const view = <a href="https://cdn.example.com/download.glb">Credit</a>;',
      'throw new Error("Source must never run");'
    ].join('\n'),
    'webapp/src/duplicate.js': 'const model = "https://cdn.example.com/models/person.gltf#scene";',
    'webapp/src/game.test.ts': 'const ignored = "https://cdn.example.com/test.png";',
    'webapp/src/previews/dev.ts': 'const ignored = "https://cdn.example.com/preview.png";',
    'webapp/public/vendor/dependency.js': 'const ignored = "https://cdn.example.com/vendor-doc.js";',
    'webapp/public/assets/external/url-map.js': 'self.map={"https://cdn.example.com/generated.png":"/assets/external/generated.png"};',
    'webapp/public/assets/external/cdn.example.com/dep.js': 'const ignored="https://cdn.example.com/generated-dependency.glb";'
  });
  const assets = await collectStaticExternalAssets(options);
  assert.deepEqual(assets.map(asset => asset.url).sort(), [
    'https://api.readyplayer.me/v1/avatars/character.glb',
    'https://cdn.example.com/models/person.gltf',
    'https://cdn.example.com/sound.mp3',
    'https://cdn.example.com/texture.png?quality=high'
  ].sort());
  assert.deepEqual(assets.find(asset => asset.url.endsWith('person.gltf')).referrers, ['src/duplicate.js', 'src/game.tsx']);
});

test('scans runtime HTML/CSS resources and import scripts while excluding sign-in scripts and anchors', async t => {
  const options = await fixture(t, {
    'webapp/public/chess.html': [
      '<!-- <img src="https://cdn.example.com/comment.png"> -->',
      '<a href="https://cdn.example.com/anchor.png">external link</a>',
      '<link rel="preconnect" href="https://cdn.example.com">',
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Test&amp;display=swap">',
      '<script src="https://telegram.org/js/telegram-web-app.js"></script>',
      '<script src="https://cdn.example.com/engine.js"></script>',
      '<img src="https://images.unsplash.com/photo-123?width=256&amp;height=256">',
      '<script>const models = ["https://cdn.example.com/one.glb", "https://mirror.example.com/one.glb"];</script>',
      '<style>.board { background: url("https://cdn.example.com/board.webp"); }</style>'
    ].join('\n'),
    'webapp/src/game.css': [
      '/* url("https://cdn.example.com/comment.woff2") */',
      '@font-face { src: url(https://cdn.example.com/body.woff2); }',
      '@import "https://cdn.example.com/theme.css";'
    ].join('\n')
  });
  const assets = await collectStaticExternalAssets(options);
  assert.deepEqual(assets.map(asset => asset.url).sort(), [
    'https://fonts.googleapis.com/css2?family=Test&display=swap',
    'https://cdn.example.com/engine.js',
    'https://images.unsplash.com/photo-123?width=256&height=256',
    'https://cdn.example.com/one.glb',
    'https://mirror.example.com/one.glb',
    'https://cdn.example.com/board.webp',
    'https://cdn.example.com/body.woff2',
    'https://cdn.example.com/theme.css'
  ].sort());
});

test('reports fallback/model/module seeds and unresolved templates separately from downloadable URLs', async t => {
  const options = await fixture(t, {
    'webapp/src/game.js': [
      'const MODEL_URLS = ["https://cdn.example.com/one.gltf", "https://mirror.example.com/one.gltf"];',
      'const MODULE_URLS = ["https://esm.sh/three@1", "https://cdn.example.com/three.js"];',
      'const DECODER_BASE = "https://cdn.example.com/decoders/";',
      'const dynamic = id => `https://cdn.example.com/models/${id}.glb`;'
    ].join('\n')
  });
  const inventory = await collectExternalAssetInventory(options);
  assert.equal(inventory.assets.length, 4);
  assert.equal(inventory.modelSeeds.length, 2);
  assert.equal(inventory.moduleSeeds.length, 2);
  assert.equal(inventory.fallbackGroups.length, 2);
  assert.deepEqual(inventory.directoryPrefixes.map(entry => entry.url), ['https://cdn.example.com/decoders/']);
  assert.equal(inventory.dynamicReferences.length, 1);
  assert.match(inventory.dynamicReferences[0].expression, /\$\{id\}/);
  assert.deepEqual(extractModuleDependencySpecifiers([
    'import { Texture } from "three";',
    'export { decoder } from "./decoder.js";',
    'const p = import("https://cdn.example.com/runtime.js");',
    'const worker = new URL("./worker.js", import.meta.url);',
    'importScripts("./classic.js");',
    '// import "./comment.js";'
  ].join('\n')), ['./classic.js', './decoder.js', './worker.js', 'https://cdn.example.com/runtime.js', 'three']);
});

test('inspects built chunks and expands the known Drei provider only when bundled', async t => {
  const base = 'https://raw.githack.com/pmndrs/drei-assets/commit/hdri/';
  const options = await fixture(t, {
    'webapp/dist/assets/main.js': `const a="${base}"; const remote="https://cdn.example.com/bundled.wasm";`,
    'webapp/node_modules/@react-three/drei/core/useEnvironment.js': `const CUBEMAP_ROOT = '${base}';`,
    'webapp/node_modules/@react-three/drei/helpers/environment-assets.js': 'const presetsObj={studio:"studio.hdr",night:"night.hdr"};',
    'webapp/node_modules/unused/examples.js': 'const ignored="https://cdn.example.com/unused.glb";'
  });
  const inventory = await collectBuiltExternalAssetInventory(options);
  assert.equal(inventory.providerSeeds.length, 2);
  assert.deepEqual(inventory.assets.map(entry => entry.url).sort(), [
    'https://cdn.example.com/bundled.wasm', `${base}night.hdr`, `${base}studio.hdr`
  ].sort());
  await writeFile(path.join(options.repoRoot, 'webapp/dist/assets/main.js'), 'const local="/assets/game.js";');
  const withoutProvider = await collectBuiltExternalAssetInventory(options);
  assert.equal(withoutProvider.providerSeeds.length, 0);
  assert.equal(withoutProvider.assets.length, 0);
});

test('includes first-party TonConnect UI assets without bulk importing the live third-party wallet registry', async t => {
  const options = await fixture(t, {
    'webapp/src/app.jsx': 'import { TonConnectUIProvider } from "@tonconnect/ui-react";const game="https://cdn.example.com/game-texture.png";',
    'webapp/node_modules/@tonconnect/ui/package.json': '{"module":"./lib/index.mjs"}',
    'webapp/node_modules/@tonconnect/ui/lib/index.mjs': 'const icon="https://cdn.example.com/connect-icon.png";',
    'webapp/node_modules/@tonconnect/sdk/package.json': '{"module":"./lib/esm/index.mjs"}',
    'webapp/node_modules/@tonconnect/sdk/lib/esm/index.mjs': 'const wallet="https://third-party-wallet.example/icon.png";const live="https://config.ton.org/wallets-v2.json";const staging="https://raw.githubusercontent.com/ton-connect/wallets-list-staging/refs/heads/main/wallets-v2.json";',
    'webapp/node_modules/unused/examples.js': 'const unused="https://cdn.example.com/unused-icon.png";'
  });
  const assets = await collectStaticExternalAssets(options);
  assert.deepEqual(assets.map(entry => entry.url), ['https://cdn.example.com/connect-icon.png', 'https://cdn.example.com/game-texture.png']);
  assert.deepEqual(assets[0].referrers, ['node_modules/@tonconnect/ui/lib/index.mjs']);
  await writeFile(path.join(options.repoRoot, 'webapp/src/app.jsx'), 'import SDK from "@tonconnect/sdk";export default function App(){return null;}');
  assert.deepEqual(await collectStaticExternalAssets(options), []);
});

test('omits historical Tirana import guesses only for records with a selected hashed local original', async t => {
  const options = await fixture(t, {
    'webapp/src/games/tiranastreets/shared/importedAssets.mjs': `export const IMPORTED_ASSETS=${JSON.stringify([
      { id: 'imported', localUrl: '/assets/tirana-streets/imported/weapon.glb', sourceUrl: 'https://cdn.example.com/chosen.glb', sha256: 'a'.repeat(64), urls: ['https://cdn.example.com/old-guess.glb'] },
      { id: 'needs-runtime-fallback', sourceUrl: 'https://cdn.example.com/unbundled.glb', urls: ['https://cdn.example.com/required-fallback.glb'] }
    ])};`,
    'webapp/src/config/runtime.js': 'const runtime={localUrl:"/assets/other.glb",sourceUrl:"https://cdn.example.com/other.glb",sha256:"' + 'a'.repeat(64) + '",urls:["https://cdn.example.com/active-candidate.glb"]};'
  });
  const assets = await collectStaticExternalAssets(options);
  assert.deepEqual(assets.map(entry => entry.url), [
    'https://cdn.example.com/active-candidate.glb',
    'https://cdn.example.com/chosen.glb',
    'https://cdn.example.com/other.glb',
    'https://cdn.example.com/required-fallback.glb',
    'https://cdn.example.com/unbundled.glb'
  ]);
});

test('treats Wikimedia File articles as provenance while retaining actual Wikimedia image resources', async t => {
  const options = await fixture(t, {
    'webapp/src/games/tirana-city-source/profiles.mjs': 'export const profile={photo:"local-reference.jpg",source:"https://commons.wikimedia.org/wiki/File:City.jpg",photoSource:"https://commons.wikimedia.org/wiki/File%3ACity.jpg"};',
    'webapp/src/images.js': 'export const images=["https://upload.wikimedia.org/wikipedia/commons/a/ab/City.jpg","https://commons.wikimedia.org/wiki/Special:FilePath/City.jpg"];',
    'webapp/public/assets/tirana-streets/references/local-reference.jpg': 'existing local image'
  });
  const assets = await collectStaticExternalAssets(options);
  assert.deepEqual(assets.map(entry => entry.url), [
    'https://commons.wikimedia.org/wiki/Special:FilePath/City.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/a/ab/City.jpg'
  ]);
});

test('omits geometry-only referenceImage metadata in the two audited Tirana catalogs and keeps rendered photos', async t => {
  const options = await fixture(t, {
    'webapp/src/games/tirana-city-source/cityBusinessProfiles.mjs': 'export const profile={photo:null,referenceImage:"https://residenceinn.al/img/abouttttres-01.png"};export const rendered={photo:"https://cdn.example.com/rendered-photo.jpg"};',
    'webapp/src/games/tirana-city-source/businessBuildingProfiles.mjs': 'export const profile={photo:null,referenceImage:"https://cdn.example.com/geometry-reference.jpg"};export const rendered={src:"https://cdn.example.com/rendered-src.jpg"};',
    'webapp/src/actual-images.js': 'export const image={referenceImage:"https://cdn.example.com/active-reference.jpg"};'
  });
  assert.deepEqual((await collectStaticExternalAssets(options)).map(entry => entry.url), [
    'https://cdn.example.com/active-reference.jpg',
    'https://cdn.example.com/rendered-photo.jpg',
    'https://cdn.example.com/rendered-src.jpg'
  ]);
});

test('excludes only the orphan WeaponKart component and restores assets when referenced or covered by a source glob', async t => {
  const options = await fixture(t, {
    'webapp/src/components/WeaponKartGame.jsx': 'export default function WeaponKartGame(){return new Audio("https://cdn.example.com/kart.mp3")}',
    'webapp/src/other-orphan.jsx': 'const retained="https://cdn.example.com/other.mp3";',
    'webapp/src/app.jsx': 'export default function App(){return null;}',
    'webapp/src/previews/registry.jsx': 'export const previews=[];'
  });
  assert.equal(await shouldExcludeWeaponKartGame(options), true);
  assert.deepEqual((await collectStaticExternalAssets(options)).map(entry => entry.url), ['https://cdn.example.com/other.mp3']);
  for (const reference of [
    'import WeaponKartGame from "../components/WeaponKartGame.jsx";',
    'const modules=import.meta.glob("../components/*.jsx");',
    'const modules=require.context("../components",false,/jsx$/);'
  ]) {
    await writeFile(path.join(options.repoRoot, 'webapp/src/previews/registry.jsx'), reference);
    assert.equal(await shouldExcludeWeaponKartGame(options), false);
    assert.deepEqual((await collectStaticExternalAssets(options)).map(entry => entry.url), [
      'https://cdn.example.com/kart.mp3', 'https://cdn.example.com/other.mp3'
    ]);
  }
});
