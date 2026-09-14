import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const ORIGIN = 'https://tonplaygram.test';
const BUILD = 'test-build';
const APP_CACHE = 'tonplaygram-pack-tonplaygram-app-current';
const COMPLETE = '/pwa/game-packs/.complete';
const REMOTE = 'https://models.example/tree/model.gltf';
const LOCAL = '/assets/external/models.example/tree/model.gltf';
const stripModule = source => source.replace(/^import .*;\n/gm, '')
  .replace(/^export \{[^\n]*\n?/gm, '').replace(/^export (async )?function /gm, '$1function ');
const sources = await Promise.all([
  'externalAssetUrls.js', 'externalAssets.js', 'gamePackFetchInterceptor.js'
].map(async file => stripModule(await readFile(new URL(`../webapp/src/pwa/${file}`, import.meta.url), 'utf8'))));

function memoryCaches() {
  const stores = new Map();
  const stats = { markerReads: 0, receiptParses: 0 };
  const urlOf = input => new URL(typeof input === 'string' ? input : input.url, ORIGIN).href;
  return {
    stats,
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const entries = stores.get(name);
      return {
        async put(input, response) { entries.set(urlOf(input), response.clone()); },
        async delete(input) { return entries.delete(urlOf(input)); },
        async match(input) {
          const url = urlOf(input);
          const response = entries.get(url)?.clone();
          if (new URL(url).pathname === COMPLETE) {
            stats.markerReads++;
            if (response) {
              const json = response.json.bind(response);
              response.json = () => { stats.receiptParses++; return json(); };
            }
          }
          return response;
        }
      };
    }
  };
}

function pageHarness() {
  const cacheStorage = memoryCaches();
  const networkRequests = [];
  class Loader { load() {} }
  const context = {
    URL, Request, Response, Headers, Symbol, console,
    APP_BUILD: BUILD, GAME_PACK_CACHE_PREFIX: 'tonplaygram-pack-', GAME_PACK_COMPLETE_PATH: COMPLETE,
    FileLoader: class extends Loader {}, ImageLoader: class extends Loader {},
    location: { origin: ORIGIN, href: `${ORIGIN}/games` },
    __TONPLAYGRAM_EXTERNAL_ASSETS__: { [REMOTE]: LOCAL },
    caches: cacheStorage,
    fetch: async (input, init) => {
      networkRequests.push([input, init]);
      return new Response('network bytes');
    }
  };
  context.window = context;
  vm.createContext(context);
  // Match main.jsx: external rewriting is installed before the cache wrapper.
  vm.runInContext(`${sources[0]}\n${sources[1]}\ninstallExternalAssetResolver();\n${sources[2]}\ninstallGamePackFetchInterceptor();`, context);
  return {
    context, caches: cacheStorage, networkRequests,
    fetch: (...args) => context.fetch(...args),
    async seed(name = APP_CACHE, { build = BUILD, header = false, assets = [], entries = { [LOCAL]: 'downloaded bytes' } } = {}) {
      const cache = await context.caches.open(name);
      await cache.put(COMPLETE, new Response(JSON.stringify({ build, assets }), {
        headers: header ? { 'X-TonPlaygram-App-Build': build } : {}
      }));
      for (const [url, body] of Object.entries(entries)) await cache.put(url, new Response(body));
      return cache;
    }
  };
}

test('real resolver/interceptor installation order serves provider fetches from the completed local download', async () => {
  const page = pageHarness();
  await page.seed();
  for (const input of [REMOTE, new Request(REMOTE), LOCAL]) {
    assert.equal(await (await page.fetch(input)).text(), 'downloaded bytes');
  }
  assert.equal(page.networkRequests.length, 0);
});

test('concurrent assets parse a 2,467-file legacy receipt once, while checking completion every time', async () => {
  const page = pageHarness();
  await page.seed(APP_CACHE, { assets: Array.from({ length: 2467 }, (_, index) => ({
    url: `/assets/game-${index}.glb`, size: 45678, sha256: 'a'.repeat(64)
  })) });
  const responses = await Promise.all(Array.from({ length: 50 }, () => page.fetch(LOCAL)));
  assert.ok((await Promise.all(responses.map(response => response.text()))).every(body => body === 'downloaded bytes'));
  assert.equal(page.caches.stats.receiptParses, 1);
  assert.equal(page.caches.stats.markerReads, 50);
  assert.equal(page.networkRequests.length, 0);
});

test('completion build headers avoid receipt parsing and still reject another build', async () => {
  for (const build of [BUILD, 'older-build']) {
    const page = pageHarness();
    await page.seed(APP_CACHE, { build, header: true });
    assert.equal(await (await page.fetch(LOCAL)).text(), build === BUILD ? 'downloaded bytes' : 'network bytes');
    assert.equal(page.caches.stats.receiptParses, 0);
  }
});

test('memoized legacy completion never hides removed markers or evicted assets', async () => {
  const page = pageHarness();
  const cache = await page.seed();
  assert.equal(await (await page.fetch(LOCAL)).text(), 'downloaded bytes');
  await cache.delete(COMPLETE);
  assert.equal(await (await page.fetch(LOCAL)).text(), 'network bytes');
  await page.seed(APP_CACHE, { build: 'older-build' });
  assert.equal(await (await page.fetch(LOCAL)).text(), 'network bytes');
  assert.equal(page.caches.stats.receiptParses, 2);
  await cache.delete(COMPLETE);
  await page.fetch(LOCAL);
  await page.seed();
  await cache.delete(LOCAL);
  assert.equal(await (await page.fetch(LOCAL)).text(), 'network bytes');
});

test('legacy build memoization is isolated to its CacheStorage and bounded across versions', async () => {
  const page = pageHarness();
  await page.seed();
  assert.equal(await (await page.fetch(LOCAL)).text(), 'downloaded bytes');
  page.context.caches = memoryCaches();
  await page.seed(APP_CACHE, { build: 'older-build' });
  assert.equal(await (await page.fetch(LOCAL)).text(), 'network bytes');
  assert.equal(page.context.caches.stats.receiptParses, 1);
  await page.context.caches.delete(APP_CACHE);
  for (let index = 0; index < 35; index++) {
    const name = `tonplaygram-pack-tonplaygram-app-version-${index}`;
    await page.seed(name);
    assert.equal(await (await page.fetch(LOCAL)).text(), 'downloaded bytes');
    await page.context.caches.delete(name);
  }
  await page.seed(APP_CACHE);
  assert.equal(await (await page.fetch(LOCAL)).text(), 'downloaded bytes', 'oldest memo was evicted after bounded version churn');
});

test('incomplete and malformed receipts are rejected, and a repaired receipt can become usable', async () => {
  const page = pageHarness();
  const cache = await page.caches.open(APP_CACHE);
  await cache.put(LOCAL, new Response('downloaded bytes'));
  assert.equal(await (await page.fetch(LOCAL)).text(), 'network bytes');
  await cache.put(COMPLETE, new Response('{invalid'));
  assert.equal(await (await page.fetch(LOCAL)).text(), 'network bytes');
  await page.seed();
  assert.equal(await (await page.fetch(LOCAL)).text(), 'downloaded bytes');
});

test('explicit policies, private traffic, updates and arbitrary queries keep their network bypasses', async () => {
  const page = pageHarness();
  await page.seed(APP_CACHE, { entries: {
    [LOCAL]: 'downloaded bytes', '/api/profile': 'private cached bytes', '/version.json': 'old version'
  } });
  for (const [input, init] of [
    [LOCAL, { cache: 'no-store' }], [REMOTE, { cache: 'reload' }],
    [LOCAL, { headers: { Authorization: 'Bearer private-session' } }],
    [REMOTE, { headers: { Authorization: 'Bearer private-session' } }],
    [LOCAL, { headers: { 'X-TonPlaygram-Verify': '1' } }],
    [LOCAL, { headers: { Range: 'bytes=1-3' } }],
    [LOCAL, { method: 'POST', body: 'private payload' }],
    ['/api/profile', {}], ['/version.json', {}], [LOCAL + '?variant=other', {}]
  ]) {
    assert.equal(await (await page.fetch(input, init)).text(), 'network bytes', String(input));
  }
  assert.equal(page.networkRequests[3][0], REMOTE, 'authenticated provider request stays untouched');
});

test('only the exact current-build Domino module query aliases its full-app manifest entry', async () => {
  const page = pageHarness();
  await page.seed(APP_CACHE, { entries: { '/domino-royal-game.js': 'downloaded Domino' } });
  assert.equal(await (await page.fetch(`/domino-royal-game.js?v=${BUILD}`)).text(), 'downloaded Domino');
  assert.equal(page.networkRequests.length, 0);
  for (const query of ['?v=older-build', `?v=${BUILD}&extra=1`, `?v=${BUILD}&v=${BUILD}`]) {
    assert.equal(await (await page.fetch('/domino-royal-game.js' + query)).text(), 'network bytes');
  }
  const legacy = pageHarness();
  await legacy.seed('tonplaygram-pack-domino-v1', { entries: { '/domino-royal-game.js': 'old game' } });
  assert.equal(await (await legacy.fetch(`/domino-royal-game.js?v=${BUILD}`)).text(), 'network bytes');
});
