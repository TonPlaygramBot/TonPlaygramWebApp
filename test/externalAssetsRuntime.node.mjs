import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
import { findDependencies, rewriteDependencies, parseGlb } from '../webapp/scripts/external-assets/downloader.mjs';
import { replaceExternalAssetUrls } from '../webapp/scripts/localize-external-assets.mjs';

const origin = 'https://app.example';
const remote = 'https://models.example/tree/model.gltf';
const target = '/assets/external/models.example/tree/model.gltf';

test('hosting revalidates stable vendored URLs and never caches their mutable mappings', async () => {
  const server = await readFile('bot/server.js', 'utf8');
  const start = server.indexOf('function setWebAssetCacheHeaders(');
  const end = server.indexOf('\napp.use(', start);
  assert.ok(start > 0 && end > start);
  const context = { path, webappPath: '/app/dist', ONE_YEAR_SECONDS: 31536000 };
  vm.createContext(context);
  vm.runInContext(server.slice(start, end), context);
  const policy = file => {
    const headers = {};
    context.setWebAssetCacheHeaders({ setHeader: (key, value) => { headers[key] = value; } }, `/app/dist/${file}`);
    return headers['Cache-Control'];
  };
  for (const file of ['url-map.js', 'url-map.json', 'manifest.json']) {
    assert.match(policy(`assets/external/${file}`), /no-store/);
  }
  assert.equal(policy('assets/external/provider/scene.glb'), 'public, max-age=0, must-revalidate');
  assert.match(policy('assets/index-abcdef12.js'), /immutable/);
  assert.match(policy('pwa/game-packs/tonplaygram-app.json'), /no-store/);
});
function glb(document, binary = Buffer.from([1, 2, 3, 4])) {
  const text = Buffer.from(JSON.stringify(document));
  const padded = Buffer.concat([text, Buffer.alloc((4 - text.length % 4) % 4, 0x20)]);
  const header = Buffer.alloc(12); header.write('glTF'); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + padded.length + binary.length, 8);
  const jsonHeader = Buffer.alloc(8); jsonHeader.writeUInt32LE(padded.length); jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binHeader = Buffer.alloc(8); binHeader.writeUInt32LE(binary.length); binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonHeader, padded, binHeader, binary]);
}

test('GLB sidecars are discovered and localized without changing geometry bytes', () => {
  const bytes = glb({ asset: { version: '2.0' }, buffers: [{ byteLength: 4 }], images: [{ uri: 'bark.png' }] });
  const source = 'https://models.example/tree/model.glb';
  const deps = findDependencies(bytes, source, 'model/gltf-binary');
  assert.equal(deps[0].url, 'https://models.example/tree/bark.png');
  const updated = rewriteDependencies(bytes, source, 'model/gltf-binary', { [deps[0].url]: '/assets/external/models.example/tree/bark.png' }, deps);
  const parsed = parseGlb(updated);
  assert.equal(parsed.document.images[0].uri, '/assets/external/models.example/tree/bark.png');
  assert.deepEqual(parsed.chunks[1].bytes, Buffer.from([1, 2, 3, 4]));
  assert.equal(updated.readUInt32LE(8), updated.length);
  assert.deepEqual(rewriteDependencies(bytes, source, 'model/gltf-binary', {}, deps), bytes);
  const truncated = bytes.subarray(0, bytes.length - 1);
  assert.throws(() => parseGlb(truncated), /header or length/);
});

test('build URL replacement handles ordinary and escaped JSON resource URLs', () => {
  const map = { [remote]: target };
  assert.equal(replaceExternalAssetUrls(`const model='${remote}';`, map), `const model='${target}';`);
  assert.equal(replaceExternalAssetUrls(JSON.stringify(remote).replaceAll('/', '\\/'), map), JSON.stringify(target).replaceAll('/', '\\/'));
  assert.equal(replaceExternalAssetUrls('https://api.example/account', map), 'https://api.example/account');
});

test('build URL replacement preserves longest literal prefixes, query metacharacters and replacement dollars', () => {
  const short = 'https://assets.example/model.glb';
  const long = short + '?variant=[red]+blue&uv=(2).*';
  const longest = long + '&query=$^|{x}';
  const map = {
    [short]: '/assets/plain.glb',
    [longest]: '/assets/query-$&-$$-$1.glb',
    [long]: '/assets/variant.glb'
  };
  const escaped = value => value.replaceAll('/', '\\/');
  const input = [short, longest, long, escaped(longest), 'https://assetsXexample/modelXglb'].join('\n');
  const expected = [map[short], map[longest], map[long], escaped(map[longest]), 'https://assetsXexample/modelXglb'].join('\n');
  assert.equal(replaceExternalAssetUrls(input, map), expected);
  assert.equal(replaceExternalAssetUrls(input, map), expected, 'cached matcher resets between modules');
  assert.equal(replaceExternalAssetUrls(input, {}), input);
  assert.equal(replaceExternalAssetUrls('https://remote.example/long-model.glb', {
    'https://remote.example/long-model.glb': '/models/intermediate.glb',
    '/models/intermediate.glb': '/assets/final.glb'
  }), '/assets/final.glb', 'chained aliases retain the existing ordered semantics');
});

test('runtime redirects mapped fetch, custom Three loaders, images and media while preserving unrelated requests', async () => {
  const code = (await readFile('webapp/src/pwa/externalAssetUrls.js', 'utf8')).replaceAll('export function ', 'function ') + '\n' +
    (await readFile('webapp/src/pwa/externalAssets.js', 'utf8')).replace(/^import .*;\n/gm, '').replace(/^export \{[^\n]*\n/gm, '').replaceAll('export function ', 'function ');
  const calls = [];
  class Element { setAttribute(name, value) { this[name + 'Attribute'] = value; } }
  class Img extends Element { set src(value) { this.value = value; } get src() { return this.value; } }
  class Media extends Element { set src(value) { this.value = value; } }
  class Video extends Media { set poster(value) { this.cover = value; } }
  class Loader {
    constructor() { this.path = ''; this.manager = { resolveURL: value => value }; }
    load(url) { return this.manager.resolveURL(this.path + url); }
  }
  const context = {
    URL, Request, Headers, Symbol, Object, FileLoader: class extends Loader {}, ImageLoader: class extends Loader {},
    Element, HTMLImageElement: Img, HTMLMediaElement: Media, HTMLVideoElement: Video,
    location: { origin, href: origin + '/games' }, __TONPLAYGRAM_EXTERNAL_ASSETS__: { [remote]: target },
    fetch: async (input, init) => { calls.push([input, init]); return new Response('ok'); }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(code + '\ninstallExternalAssetResolver();', context);
  await context.fetch(remote, { cache: 'no-store' });
  assert.equal(calls[0][0], origin + target);
  assert.equal(calls[0][1].cache, 'no-store');
  await context.fetch('https://api.example/account');
  assert.equal(calls[1][0], 'https://api.example/account');
  await context.fetch(remote, { method: 'POST', body: 'preserve' });
  assert.equal(calls[2][0], remote);
  await context.fetch(remote + '#mesh');
  assert.equal(calls[3][0], origin + target + '#mesh');
  await context.fetch(remote, { headers: { Authorization: 'Bearer private-session' } });
  assert.equal(calls[4][0], remote);
  const loader = new context.FileLoader(); loader.path = 'https://models.example/tree/';
  assert.equal(loader.load('model.gltf'), origin + target);
  assert.equal(loader.manager.resolveURL('https://models.example' + target), origin + target);
  const image = new Img(); image.src = remote; assert.equal(image.src, origin + target);
  image.setAttribute('src', remote); assert.equal(image.srcAttribute, origin + target);
  const media = new Media(); media.src = remote; assert.equal(media.value, origin + target);
});

test('page download interceptor preserves authenticated and verification requests without checking cached assets', async () => {
  const code = (await readFile('webapp/src/pwa/gamePackFetchInterceptor.js', 'utf8'))
    .replace(/^import .*;\n/gm, '')
    .replace(/^export \{[^\n]*\n?/gm, '')
    .replace(/^export (async )?function /gm, '$1function ');
  const calls = [];
  let cacheLookups = 0;
  const context = {
    URL, Request, Response, Headers, Symbol, console,
    APP_BUILD: 'test-build', GAME_PACK_CACHE_PREFIX: 'tonplaygram-pack-',
    GAME_PACK_COMPLETE_PATH: '/pwa/game-packs/.complete',
    location: { origin, href: origin + '/' },
    caches: { keys: async () => { cacheLookups += 1; return []; } },
    fetch: async (input, init) => { calls.push([input, init]); return new Response('network bytes'); }
  };
  context.window = context;
  vm.createContext(context);
  const urlResolver = (await readFile('webapp/src/pwa/externalAssetUrls.js', 'utf8')).replaceAll('export function ', 'function ');
  vm.runInContext(urlResolver + '\n' + code + '\ninstallGamePackFetchInterceptor();', context);
  const asset = origin + target;
  const cases = [
    [asset, { headers: { Authorization: 'Bearer private-session' } }],
    [new Request(asset, { headers: { Authorization: 'Bearer private-request' } }), undefined],
    [asset, { headers: { 'X-TonPlaygram-Verify': '1' } }],
    [new Request(asset, { headers: { 'X-TonPlaygram-Verify': '1' } }), undefined]
  ];
  for (const [input, init] of cases) {
    const response = await context.fetch(input, init);
    assert.equal(await response.text(), 'network bytes');
    assert.equal(calls.at(-1)[0], input);
    assert.equal(calls.at(-1)[1], init);
  }
  assert.equal(cacheLookups, 0);
  assert.equal(calls.length, cases.length);
  await context.fetch(asset);
  assert.equal(cacheLookups, 1, 'ordinary public requests still inspect completed downloads');
});
