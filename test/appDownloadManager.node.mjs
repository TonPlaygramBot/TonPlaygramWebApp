import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { APP_BUILD } from '../webapp/src/config/buildInfo.js';
import { GAME_PACK_COMPLETE_PATH } from '../webapp/src/pwa/gamePackCatalog.js';
import {
  cancelGamePackInstall,
  GAME_PACK_STORAGE_ERROR_MESSAGE,
  GAME_PACK_PROGRESS_EVENT,
  getGamePackInstallations,
  getGamePackStatus,
  getPackCacheName,
  installGamePack,
  reconcileGamePackInstallations
} from '../webapp/src/pwa/gamePackManager.js';
import { matchGamePackCache } from '../webapp/src/pwa/gamePackFetchInterceptor.js';

const ORIGIN = 'https://tonplaygram.example';
const APP_ID = 'tonplaygram-app';
const FIRST_MODEL = '/assets/aaa-first.glb';
const LAST_MODEL = '/assets/zzz-last.glb';
const requestUrl = request => new URL(typeof request === 'string' ? request : request.url, ORIGIN).href;

class MemoryCache {
  entries = new Map();
  constructor(name, storage) { this.name = name; this.storage = storage; }
  async match(request) { return this.entries.get(requestUrl(request))?.clone(); }
  async put(request, response) {
    await this.storage.beforePut?.(this.name, requestUrl(request));
    const bytes = await response.arrayBuffer();
    this.entries.set(requestUrl(request), new Response(bytes, { status: response.status, headers: response.headers }));
  }
  async delete(request) { return this.entries.delete(requestUrl(request)); }
  async keys() { return [...this.entries.keys()].map(url => new Request(url)); }
}

class MemoryCacheStorage {
  entries = new Map();
  async open(name) {
    if (!this.entries.has(name)) this.entries.set(name, new MemoryCache(name, this));
    return this.entries.get(name);
  }
  async keys() { return [...this.entries.keys()]; }
  async delete(name) { return this.entries.delete(name); }
  async match(request) {
    for (const cache of this.entries.values()) {
      const response = await cache.match(request);
      if (response) return response;
    }
  }
}

function setup({ quota = 1024 * 1024 * 1024, usage = 0 } = {}) {
  const events = new EventTarget();
  const state = new Map();
  const network = { calls: new Map(), failures: new Set(), manifests: new Map(), bodies: new Map(), responses: new Map(), options: new Map() };
  globalThis.caches = new MemoryCacheStorage();
  if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { storage: { estimate: async () => ({ quota, usage }), persisted: async () => true, persist: async () => true } }
  });
  globalThis.fetch = async (request, options) => {
    const pathname = new URL(requestUrl(request)).pathname;
    network.calls.set(pathname, (network.calls.get(pathname) || 0) + 1);
    network.options.set(pathname, options);
    if (network.responses.has(pathname)) return network.responses.get(pathname)(options);
    if (network.failures.has(pathname)) return new Response('Temporarily unavailable', { status: 503 });
    if (network.manifests.has(pathname)) return Response.json(network.manifests.get(pathname));
    if (network.bodies.has(pathname)) {
      return new Response(network.bodies.get(pathname), {
        headers: { 'Content-Type': pathname.endsWith('.html') ? 'text/html' : 'application/octet-stream' }
      });
    }
    return new Response('Missing fixture', { status: 404 });
  };
  globalThis.window = {
    location: { origin: ORIGIN, href: `${ORIGIN}/` },
    localStorage: { getItem: key => state.get(key) ?? null, setItem: (key, value) => state.set(key, value) },
    dispatchEvent: event => events.dispatchEvent(event),
    addEventListener: (...args) => events.addEventListener(...args),
    removeEventListener: (...args) => events.removeEventListener(...args),
    fetch: globalThis.fetch
  };
  network.add = fixture => {
    network.manifests.set(fixture.pack.manifestUrl, fixture.manifest);
    for (const [url, body] of Object.entries(fixture.bodies)) network.bodies.set(url, body);
  };
  network.assetCalls = () => [...network.calls].filter(([url]) => !network.manifests.has(url));
  return network;
}

const asset = (url, body) => ({
  url, sourceUrl: url, size: Buffer.byteLength(body), sha256: createHash('sha256').update(body).digest('hex')
});

function fixture({ id = APP_ID, version = 'v1', build = APP_BUILD, bodies } = {}) {
  const files = bodies || {
    '/index.html': `<script type="module" src="/assets/app-${version}.js"></script>`,
    [`/assets/app-${version}.js`]: `export const version = '${version}';`,
    [FIRST_MODEL]: 'Shared verified model',
    [LAST_MODEL]: `Last model for ${version}`
  };
  const assets = Object.entries(files).map(([url, body]) => asset(url, body));
  const pack = { id, title: 'TonPlayGram', version, build, dependencies: [], manifestUrl: `/pwa/game-packs/${id}.json` };
  const manifest = { ...pack, schemaVersion: 1, assetCount: assets.length, totalBytes: assets.reduce((sum, item) => sum + item.size, 0), assets };
  return { pack, manifest, bodies: files, catalog: { packs: [pack] } };
}

const install = fixture => installGamePack(fixture.pack.id, { catalog: fixture.catalog, concurrency: 1 });
const cacheFor = fixture => caches.open(getPackCacheName(fixture.pack.id, fixture.pack.version));
const receiptFor = async fixture => (await cacheFor(fixture)).match(`${ORIGIN}${GAME_PACK_COMPLETE_PATH}`);

test('full app refuses missing build, shell, compiled code, hashes, or mismatched manifests before downloading', async t => {
  const cases = [
    ['missing build', manifest => { delete manifest.build; }],
    ['different build', manifest => { manifest.build = 'another-build'; }],
    ['missing shell', manifest => { manifest.assets = manifest.assets.filter(item => item.url !== '/index.html'); manifest.assetCount--; }],
    ['missing compiled code', manifest => { manifest.assets = manifest.assets.filter(item => !item.url.endsWith('.js')); manifest.assetCount--; }],
    ['missing hash', manifest => { delete manifest.assets[0].sha256; }],
    ['malformed hash', manifest => { manifest.assets[0].sha256 = 'not-a-hash'; }],
    ['incomplete file count', manifest => { manifest.assetCount++; }]
  ];
  for (const [name, mutate] of cases) {
    await t.test(name, async () => {
      const network = setup();
      const app = fixture();
      mutate(app.manifest);
      network.add(app);
      await assert.rejects(install(app), /full app download is incomplete/i);
      assert.equal(getGamePackStatus(app.pack), 'partial');
      assert.equal(await receiptFor(app), undefined);
      assert.deepEqual(network.assetCalls(), []);
    });
  }
});

test('successful full download publishes its build receipt only with all verified files', async () => {
  const network = setup();
  const app = fixture();
  network.add(app);
  const installation = await install(app);
  assert.equal(getGamePackStatus(app.pack), 'installed');
  const receipt = await (await receiptFor(app)).json();
  assert.equal(receipt.version, app.pack.version);
  assert.equal(receipt.build, APP_BUILD);
  assert.equal(receipt.assets.length, Object.keys(app.bodies).length);
  const cache = await cacheFor(app);
  for (const entry of receipt.assets) {
    const response = await cache.match(`${ORIGIN}${entry.url}`);
    assert.equal(await response.text(), app.bodies[entry.url]);
    assert.equal(response.headers.get('X-TonPlaygram-Asset-Sha256'), entry.sha256);
  }
  assert.equal(installation.assetCount, receipt.assets.length);
  assert.equal(await (await matchGamePackCache(new Request(`${ORIGIN}${FIRST_MODEL}`))).text(), app.bodies[FIRST_MODEL]);
  await reconcileGamePackInstallations();
  assert.equal(getGamePackStatus(app.pack), 'installed');
});

test('interrupted full downloads remain unavailable and resume reuses verified files', async () => {
  const network = setup();
  const app = fixture();
  network.add(app);
  network.failures.add(LAST_MODEL);
  await assert.rejects(install(app), /503/);
  assert.equal(getGamePackStatus(app.pack), 'partial');
  assert.equal(await receiptFor(app), undefined);
  assert.equal(await matchGamePackCache(new Request(`${ORIGIN}${FIRST_MODEL}`)), null);
  assert.equal(network.calls.get(FIRST_MODEL), 1);
  network.failures.clear();
  await install(app);
  assert.equal(getGamePackStatus(app.pack), 'installed');
  assert.equal(network.calls.get(FIRST_MODEL), 1);
  assert.equal(network.calls.get(LAST_MODEL), 2);
  assert.ok(getGamePackInstallations()[APP_ID].reusedBytes > 0);
});

test('same-length corrupted asset data cannot complete a full download', async () => {
  const network = setup();
  const app = fixture();
  network.add(app);
  network.bodies.set(FIRST_MODEL, 'x'.repeat(app.bodies[FIRST_MODEL].length));
  await assert.rejects(install(app), /Integrity check failed/);
  assert.equal(getGamePackStatus(app.pack), 'partial');
  assert.equal(await receiptFor(app), undefined);
});

test('browser estimates do not prevent verified downloads that storage accepts', async t => {
  await t.test('enough space without the former ten-percent reserve', async () => {
    const app = fixture();
    const available = Math.ceil(app.manifest.totalBytes * 1.05);
    assert.ok(available >= app.manifest.totalBytes && available < app.manifest.totalBytes * 1.1);
    const network = setup({ quota: 100 + available, usage: 100 });
    network.add(app);
    await install(app);
    assert.equal(getGamePackStatus(app.pack), 'installed');
    assert.ok(await receiptFor(app));
  });
  await t.test('a conservative estimate cannot veto successful browser writes', async () => {
    const network = setup({ quota: 101, usage: 100 });
    const app = fixture();
    network.add(app);
    await install(app);
    assert.equal(network.assetCalls().length, app.manifest.assetCount);
    assert.equal(getGamePackStatus(app.pack), 'installed');
    assert.ok(await receiptFor(app));
  });
  await t.test('unavailable storage estimates do not prevent a download', async () => {
    const network = setup();
    navigator.storage.estimate = async () => { throw new Error('Estimate unavailable'); };
    const app = fixture();
    network.add(app);
    await install(app);
    assert.equal(getGamePackStatus(app.pack), 'installed');
    assert.ok(await receiptFor(app));
  });
});

test('storage failures explain how to recover and never publish completion', async t => {
  await t.test('a browser write quota error leaves a resumable download', async () => {
    const network = setup();
    const app = fixture();
    network.add(app);
    caches.beforePut = async (name, url) => {
      if (name === getPackCacheName(APP_ID, app.pack.version) && url.endsWith(LAST_MODEL)) {
        throw new DOMException('Storage full', 'QuotaExceededError');
      }
    };
    await assert.rejects(install(app), error => {
      assert.equal(error.name, 'QuotaExceededError');
      assert.equal(error.message, GAME_PACK_STORAGE_ERROR_MESSAGE);
      assert.equal(error.cause.name, 'QuotaExceededError');
      return true;
    });
    assert.equal(getGamePackStatus(app.pack), 'partial');
    assert.equal(getGamePackInstallations()[APP_ID].lastError, GAME_PACK_STORAGE_ERROR_MESSAGE);
    assert.equal(await receiptFor(app), undefined);
    assert.equal(network.calls.get(FIRST_MODEL), 1);
    caches.beforePut = null;
    await install(app);
    assert.equal(getGamePackStatus(app.pack), 'installed');
    assert.equal(network.calls.get(FIRST_MODEL), 1);
    assert.ok(getGamePackInstallations()[APP_ID].reusedBytes > 0);
    assert.ok(await receiptFor(app));
  });
  await t.test('quota failure when publishing the receipt cannot mark files complete', async () => {
    const network = setup();
    const app = fixture();
    network.add(app);
    caches.beforePut = async (name, url) => {
      if (url.endsWith(GAME_PACK_COMPLETE_PATH)) throw new DOMException('Storage full', 'QuotaExceededError');
    };
    await assert.rejects(install(app), { name: 'QuotaExceededError', message: GAME_PACK_STORAGE_ERROR_MESSAGE });
    assert.equal(getGamePackStatus(app.pack), 'partial');
    assert.equal(await receiptFor(app), undefined);
    caches.beforePut = null;
    await install(app);
    assert.equal(getGamePackStatus(app.pack), 'installed');
    assert.ok(network.assetCalls().every(([, calls]) => calls === 1));
  });
});

test('a failed full-app update preserves the previous complete version and assets', async () => {
  const network = setup();
  const previous = fixture();
  network.add(previous);
  const oldInstallation = await install(previous);
  const next = fixture({ version: 'v2', build: 'next-build' });
  network.add(next);
  network.failures.add(LAST_MODEL);
  await assert.rejects(install(next), /503/);
  const current = getGamePackInstallations()[APP_ID];
  assert.equal(current.cacheName, oldInstallation.cacheName);
  assert.equal(current.version, previous.pack.version);
  assert.equal(getGamePackStatus(next.pack), 'update-available');
  assert.equal((await (await receiptFor(previous)).json()).build, APP_BUILD);
  assert.equal(await receiptFor(next), undefined);
  assert.equal(await (await matchGamePackCache(new Request(`${ORIGIN}${LAST_MODEL}`))).text(), previous.bodies[LAST_MODEL]);
});

test('legacy pack migration reuses files and removes old downloads only after full success', async () => {
  const network = setup();
  const legacy = fixture({ id: 'legacy-game', bodies: { [FIRST_MODEL]: 'Shared verified model' } });
  network.add(legacy);
  const legacyInstallation = await install(legacy);
  const metadata = await caches.open('tonplaygram-pack-metadata-v1');
  await metadata.put(`${ORIGIN}/retained-catalog.json`, Response.json({ available: true }));
  const app = fixture();
  network.add(app);
  network.failures.add(LAST_MODEL);
  await assert.rejects(install(app), /503/);
  assert.ok((await caches.keys()).includes(legacyInstallation.cacheName));
  assert.equal(getGamePackStatus(legacy.pack), 'installed');
  assert.ok(await receiptFor(legacy));
  network.failures.clear();
  await install(app);
  assert.equal(getGamePackStatus(app.pack), 'installed');
  assert.equal((await caches.keys()).includes(legacyInstallation.cacheName), false);
  assert.deepEqual(Object.keys(getGamePackInstallations()), [APP_ID]);
  assert.equal(network.calls.get(FIRST_MODEL), 1);
  assert.ok(await metadata.match(`${ORIGIN}/retained-catalog.json`));
  assert.ok(await receiptFor(app));
});


function controlledDownload(network, url) {
  let controller;
  let started;
  let cancelled = false;
  const ready = new Promise(resolve => { started = resolve; });
  network.responses.set(url, () => new Response(new ReadableStream({
    start(value) { controller = value; started(); },
    cancel() { cancelled = true; }
  }), { headers: { 'Content-Type': 'application/octet-stream' } }));
  return {
    ready,
    write: bytes => controller.enqueue(typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes),
    finish: () => controller.close(),
    get cancelled() { return cancelled; }
  };
}

const observeProgress = () => {
  const progress = [];
  window.addEventListener(GAME_PACK_PROGRESS_EVENT, event => progress.push(event.detail));
  return progress;
};

test('a continuously active download can exceed two minutes and reports each chunk exactly once', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const network = setup();
  const app = fixture();
  network.add(app);
  const stream = controlledDownload(network, FIRST_MODEL);
  const progress = observeProgress();
  const pending = install(app);
  await stream.ready;
  const body = app.bodies[FIRST_MODEL];
  const bytesBefore = progress.at(-1).downloadedBytes;
  for (let offset = 0; offset < body.length; offset += 7) {
    t.mock.timers.tick(80000);
    stream.write(body.slice(offset, offset + 7));
    await nextTurn();
    assert.equal(progress.at(-1).downloadedBytes, bytesBefore + Math.min(offset + 7, body.length));
    assert.equal(getGamePackStatus(app.pack), 'downloading');
  }
  stream.finish();
  const installation = await pending;
  assert.equal(installation.downloadedBytes, app.manifest.totalBytes);
  assert.equal(progress.findLast(item => item.phase === 'complete').percent, 100);
  assert.equal(network.options.get(FIRST_MODEL).headers['X-TonPlaygram-Verify'], '1');
  assert.equal(getGamePackStatus(app.pack), 'installed');
});

test('a stalled stream times out from its last received chunk and resumes without a completion receipt', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const network = setup();
  const app = fixture();
  network.add(app);
  const stream = controlledDownload(network, FIRST_MODEL);
  const pending = install(app);
  const failure = assert.rejects(pending, /connection stopped responding.*Resume/i);
  await stream.ready;
  t.mock.timers.tick(80000);
  stream.write(app.bodies[FIRST_MODEL].slice(0, 7));
  await nextTurn();
  t.mock.timers.tick(119999);
  await nextTurn();
  assert.equal(getGamePackStatus(app.pack), 'downloading');
  t.mock.timers.tick(1);
  await failure;
  assert.equal(stream.cancelled, true);
  assert.equal(await receiptFor(app), undefined);
  assert.equal(await (await cacheFor(app)).match(FIRST_MODEL), undefined);
  network.responses.delete(FIRST_MODEL);
  const installation = await install(app);
  assert.equal(getGamePackStatus(app.pack), 'installed');
  assert.equal(installation.downloadedBytes + installation.reusedBytes, app.manifest.totalBytes);
  assert.equal(network.calls.get('/index.html'), 1);
});

test('cancelling a pending stream wakes the reader and preserves already verified files for resume', async () => {
  const network = setup();
  const app = fixture();
  network.add(app);
  const stream = controlledDownload(network, FIRST_MODEL);
  const pending = install(app);
  const failure = assert.rejects(pending, { name: 'AbortError' });
  await stream.ready;
  stream.write(app.bodies[FIRST_MODEL].slice(0, 7));
  await nextTurn();
  assert.equal(cancelGamePackInstall(APP_ID), true);
  await failure;
  assert.equal(stream.cancelled, true);
  assert.equal(await receiptFor(app), undefined);
  assert.equal(await (await cacheFor(app)).match(FIRST_MODEL), undefined);
  assert.equal(getGamePackInstallations()[APP_ID].lastError, null);
  network.responses.delete(FIRST_MODEL);
  await install(app);
  assert.equal(getGamePackStatus(app.pack), 'installed');
  assert.equal(network.calls.get('/index.html'), 1);
});

test('full-app verification hashes files above the legacy 24 MB limit and rejects same-size corruption', async () => {
  const network = setup();
  const body = new Uint8Array(24 * 1024 * 1024 + 1);
  const app = fixture({ bodies: { ...fixture().bodies, '/assets/large-texture.hdr': body } });
  network.add(app);
  // The declared hash belongs to the original bytes, not this modified response.
  body[body.length - 1] = 1;
  await assert.rejects(install(app), /Integrity check failed.*large-texture/);
  assert.equal(await receiptFor(app), undefined);
  assert.equal(await (await cacheFor(app)).match('/assets/large-texture.hdr'), undefined);
});

test('full-app large files are serialized while smaller files remain parallel, and queued work cancels', async () => {
  const network = setup();
  const app = fixture();
  const large = url => ({ url, sourceUrl: url, size: 24 * 1024 * 1024 + 1, sha256: '0'.repeat(64) });
  // Put large entries first to prove the scheduler keeps the small shell ready.
  app.manifest.assets.unshift(large('/assets/large-first.hdr'), large('/assets/large-second.hdr'));
  app.manifest.assetCount = app.manifest.assets.length;
  app.manifest.totalBytes = app.manifest.assets.reduce((sum, entry) => sum + entry.size, 0);
  network.add(app);
  const first = controlledDownload(network, '/assets/large-first.hdr');
  const second = controlledDownload(network, '/assets/large-second.hdr');
  const pending = installGamePack(APP_ID, { catalog: app.catalog, concurrency: 20 });
  const failure = assert.rejects(pending, { name: 'AbortError' });
  await first.ready;
  await nextTurn();
  assert.equal(network.calls.get('/index.html'), 1);
  assert.equal(network.calls.get('/assets/app-v1.js'), 1);
  assert.equal(network.calls.get('/assets/large-second.hdr'), undefined);
  assert.equal(cancelGamePackInstall(APP_ID), true);
  await failure;
  assert.equal(first.cancelled, true);
  assert.equal(second.cancelled, false);
  assert.equal(network.calls.get('/assets/large-second.hdr'), undefined);
  assert.equal(await receiptFor(app), undefined);
});


test('vendored CDN sources request fresh local bytes while unmapped legacy sources retain CORS downloads', async t => {
  const previousMap = globalThis.__TONPLAYGRAM_EXTERNAL_ASSETS__;
  t.after(() => {
    if (previousMap === undefined) delete globalThis.__TONPLAYGRAM_EXTERNAL_ASSETS__;
    else globalThis.__TONPLAYGRAM_EXTERNAL_ASSETS__ = previousMap;
  });
  const network = setup();
  const app = fixture();
  const remote = 'https://assets.example.net/original/model.glb';
  app.manifest.assets.find(entry => entry.url === FIRST_MODEL).sourceUrl = remote;
  globalThis.__TONPLAYGRAM_EXTERNAL_ASSETS__ = { [remote]: FIRST_MODEL };
  network.add(app);
  await install(app);
  assert.equal(network.calls.get('/original/model.glb'), undefined);
  assert.equal(network.options.get(FIRST_MODEL).mode, 'same-origin');
  assert.equal(network.options.get(FIRST_MODEL).credentials, 'same-origin');
  assert.equal(network.options.get(FIRST_MODEL).cache, 'no-store');
  assert.equal(network.options.get(FIRST_MODEL).headers['X-TonPlaygram-Verify'], '1');

  const legacy = fixture({ id: 'legacy-cdn', bodies: { '/assets/legacy-model.glb': 'Original CDN model' } });
  legacy.manifest.assets[0].sourceUrl = 'https://legacy.example.net/original/legacy-model.glb';
  network.add(legacy);
  network.bodies.set('/original/legacy-model.glb', 'Original CDN model');
  await install(legacy);
  const options = network.options.get('/original/legacy-model.glb');
  assert.equal(options.mode, 'cors');
  assert.equal(options.credentials, 'omit');
  assert.equal(options.headers, undefined);
});
