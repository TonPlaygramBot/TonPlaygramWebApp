import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const ORIGIN = 'https://tonplaygram.test';
const BUILD = 'test-build';
const COMPLETE_PATH = '/pwa/game-packs/.complete';
const APP_CACHE = 'tonplaygram-pack-tonplaygram-app-current';
const sources = await Promise.all([
  readFile(new URL('../webapp/public/service-worker.js', import.meta.url), 'utf8'),
  readFile(new URL('../webapp/public/pwa/game-pack-service-worker.js', import.meta.url), 'utf8')
]);

// Node rejects the browser-only navigate mode and relative Request URLs. Keep
// its native request/body semantics while adapting those two worker APIs.
class WorkerRequest extends Request {
  constructor(input, init = {}) {
    const { destination, mode, ...rest } = init;
    super(typeof input === 'string' ? new URL(input, ORIGIN) : input,
      { ...rest, ...(mode && mode !== 'navigate' ? { mode } : {}) });
    if (mode === 'navigate') Object.defineProperty(this, 'mode', { value: mode });
    if (destination) Object.defineProperty(this, 'destination', { value: destination });
  }
}

const requestUrl = input => new URL(typeof input === 'string' ? input : input.url, ORIGIN).href;

function memoryCaches() {
  const stores = new Map();
  const stats = { markerReads: 0, receiptParses: 0 };
  return {
    stats,
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const entries = stores.get(name);
      return {
        async put(input, response) { entries.set(requestUrl(input), response.clone()); },
        async delete(input) { return entries.delete(requestUrl(input)); },
        async match(input) {
          const response = entries.get(requestUrl(input))?.clone();
          if (new URL(requestUrl(input)).pathname === COMPLETE_PATH) {
            stats.markerReads++;
            if (response) {
              const json = response.json.bind(response);
              response.json = () => { stats.receiptParses++; return json(); };
            }
          }
          return response;
        },
        async keys() { return [...entries.keys()].map(url => new WorkerRequest(url)); }
      };
    },
    async match(input) {
      for (const entries of stores.values()) {
        const response = entries.get(requestUrl(input));
        if (response) return response.clone();
      }
      return undefined;
    }
  };
}

function workerHarness({ offline = false, build = BUILD, externalMap = {} } = {}) {
  const listeners = new Map();
  const cacheStorage = memoryCaches();
  const networkRequests = [];
  const lifecycle = { claimed: false, navigationPreloadDisabled: false };
  const nativeFetch = async (input, init) => {
    const request = input instanceof Request && !init ? input : new WorkerRequest(input, init);
    networkRequests.push(request);
    if (offline) throw new TypeError('Network is offline');
    return new Response(`network:${new URL(request.url).pathname}`, { headers: { 'Content-Type': 'text/plain' } });
  };
  const sandbox = {
    Request: WorkerRequest, Response, Headers, URL,
    console,
    caches: cacheStorage,
    fetch: nativeFetch,
    location: { origin: ORIGIN },
    clients: { async claim() { lifecycle.claimed = true; } },
    registration: {
      navigationPreload: {
        async enable() {},
        async disable() { lifecycle.navigationPreloadDisabled = true; }
      }
    },
    skipWaiting() {},
    addEventListener(type, callback) { listeners.set(type, callback); }
  };
  sandbox.self = sandbox;
  const context = vm.createContext(sandbox);
  sandbox.importScripts = url => {
    if (url === '/assets/external/url-map.js') {
      sandbox.__TONPLAYGRAM_EXTERNAL_ASSETS__ = externalMap;
      return;
    }
    assert.equal(url, '/pwa/app-build.js');
    sandbox.__TONPLAYGRAM_APP_BUILD__ = build;
    vm.runInContext(sources[1], context, { filename: 'game-pack-service-worker.js' });
  };
  vm.runInContext(sources[0], context, { filename: 'service-worker.js' });

  return {
    caches: cacheStorage,
    networkRequests,
    lifecycle,
    async seed(name, entries) {
      const cache = await cacheStorage.open(name);
      for (const [url, body] of Object.entries(entries)) {
        await cache.put(url, body instanceof Response ? body : new Response(body));
      }
    },
    async complete(name, { build: receiptBuild = build, ...entries } = {}) {
      await this.seed(name, {
        [COMPLETE_PATH]: JSON.stringify({ build: receiptBuild, version: 'current' }),
        ...entries
      });
    },
    async dispatch(url, init = {}) {
      const request = new WorkerRequest(url, init);
      let responsePromise;
      listeners.get('fetch')({
        request,
        preloadResponse: Promise.resolve(undefined),
        respondWith(value) { responsePromise = Promise.resolve(value); }
      });
      // A listener that does not call respondWith lets the browser perform the
      // network request directly, without any of the worker's cache handling.
      const intercepted = Boolean(responsePromise);
      return { intercepted, request, response: await (responsePromise || nativeFetch(request)) };
    },
    async activate() {
      const pending = [];
      listeners.get('activate')({ waitUntil(promise) { pending.push(promise); } });
      await Promise.all(pending);
    }
  };
}

test('a complete app download wins over older game and runtime copies without network revalidation', async () => {
  const worker = workerHarness();
  const url = '/assets/shared-game.js';
  await worker.seed(`tonplaygram-runtime-${BUILD}`, { [url]: 'stale runtime' });
  await worker.complete('tonplaygram-pack-old-game-v1', { [url]: 'old game download' });
  await worker.complete(APP_CACHE, { [url]: 'complete app runtime' });

  const { response } = await worker.dispatch(url, { destination: 'script' });
  assert.equal(await response.text(), 'complete app runtime');
  assert.equal(worker.networkRequests.length, 0);
});

test('completed app downloads serve install metadata and auxiliary files outside legacy game asset roots', async () => {
  const worker = workerHarness({ offline: true });
  const files = {
    '/manifest.webmanifest': '{"name":"TonPlayGram"}',
    '/data/game-runtime.custom': 'bundled game sidecar'
  };
  await worker.complete(APP_CACHE, files);
  for (const [url, body] of Object.entries(files)) {
    const { response } = await worker.dispatch(url);
    assert.equal(await response.text(), body, url);
  }
  assert.equal(worker.networkRequests.length, 0);
});

test('offline game deep links and query strings use the completed same-build app shell', async () => {
  const worker = workerHarness({ offline: true });
  await worker.seed(`tonplaygram-static-${BUILD}`, { '/index.html': 'older installation shell' });
  await worker.complete(APP_CACHE, { '/index.html': '<html>complete app shell</html>' });

  for (const url of ['/', '/index.html', '/games/chess/lobby?invite=private-code']) {
    const { response } = await worker.dispatch(url, { mode: 'navigate', destination: 'document' });
    assert.equal(await response.text(), '<html>complete app shell</html>');
  }
  assert.equal(worker.networkRequests.length, 0);

  const missingBinary = await worker.dispatch('/assets/absent.glb');
  assert.equal(missingBinary.response.type, 'error');
});

test('incomplete, unreadable and different-build application downloads are never served', async () => {
  for (const marker of [null, '{invalid', JSON.stringify({ build: 'older-build' }), '{}']) {
    const worker = workerHarness();
    const entries = { '/assets/game.js': 'untrusted partial runtime', '/index.html': 'untrusted partial shell' };
    if (marker) entries[COMPLETE_PATH] = marker;
    await worker.seed(APP_CACHE, entries);
    for (const [url, init] of [
      ['/assets/game.js', { destination: 'script' }],
      ['/games/chess/lobby', { mode: 'navigate', destination: 'document' }]
    ]) {
      const { response } = await worker.dispatch(url, init);
      assert.equal(await response.text(), `network:${url}`);
    }
    assert.equal(worker.networkRequests.length, 2);
  }
});

test('API traffic, live services, updates and explicit network requests bypass app caches', async () => {
  const worker = workerHarness();
  const cases = [
    ['/api/profile', {}, false],
    ['/auth/session', {}, false],
    ['/socket.io/poll', {}, false],
    ['/colyseus/rooms', {}, false],
    ['/version.json', {}, true],
    ['/pwa/app-build.js', {}, true],
    ['/pwa/game-packs/index.json', {}, true],
    ['/assets/fresh.js', { cache: 'reload', destination: 'script' }, true],
    ['/assets/uncached.js', { cache: 'no-store', destination: 'script' }, true],
    ['/api/submit', { method: 'POST', body: 'payload' }, false]
  ];
  await worker.complete(APP_CACHE, Object.fromEntries(cases.map(([url]) => [url, 'must not be used'])));
  for (const [url, init, expectedIntercept] of cases) {
    const { intercepted, response } = await worker.dispatch(url, init);
    assert.equal(intercepted, expectedIntercept, url);
    assert.equal(await response.text(), `network:${url}`, url);
  }
  assert.equal(worker.networkRequests.length, cases.length);
});

test('cached media supports byte ranges, suffix ranges and unsatisfiable ranges offline', async () => {
  const worker = workerHarness({ offline: true });
  await worker.complete(APP_CACHE, {
    '/assets/audio/theme.m4a': new Response('0123456789', { headers: { 'Content-Type': 'audio/mp4' } })
  });
  for (const [range, body, contentRange] of [
    ['bytes=2-5', '2345', 'bytes 2-5/10'],
    ['bytes=7-', '789', 'bytes 7-9/10'],
    ['bytes=-3', '789', 'bytes 7-9/10']
  ]) {
    const { response } = await worker.dispatch('/assets/audio/theme.m4a', { destination: 'audio', headers: { Range: range } });
    assert.equal(response.status, 206);
    assert.equal(await response.text(), body);
    assert.equal(response.headers.get('Content-Range'), contentRange);
    assert.equal(response.headers.get('Content-Length'), String(body.length));
    assert.equal(response.headers.get('Accept-Ranges'), 'bytes');
    assert.equal(response.headers.get('Content-Type'), 'audio/mp4');
  }
  const invalid = await worker.dispatch('/assets/audio/theme.m4a', { headers: { Range: 'bytes=20-' } });
  assert.equal(invalid.response.status, 416);
  assert.equal(invalid.response.headers.get('Content-Range'), 'bytes */10');
  assert.equal(worker.networkRequests.length, 0);
});

test('mapped remote models resolve to downloaded local files without contacting the provider', async () => {
  const remote = 'https://cdn.example/model/scene.gltf';
  const local = '/assets/external/models/scene.gltf';
  const worker = workerHarness({ offline: true, externalMap: { [remote]: local } });
  await worker.complete(APP_CACHE, { [local]: '{"asset":{"version":"2.0"},"buffers":[]}' });
  const { response } = await worker.dispatch(remote);
  assert.equal((await response.json()).asset.version, '2.0');
  assert.equal(worker.networkRequests.length, 0);
});

test('no-store and reload vendored metadata use the complete app offline through remote and mapped local URLs', async () => {
  const remote = 'https://api.polyhaven.com/files/ArmChair_01';
  const local = '/assets/external/metadata/ArmChair_01.json';
  const worker = workerHarness({ offline: true, externalMap: { [remote]: local } });
  await worker.complete(APP_CACHE, { [local]: 'verified metadata for this build' });
  for (const url of [remote, local]) for (const cache of ['no-store', 'reload']) {
    const { response } = await worker.dispatch(url, { cache });
    assert.equal(await response.text(), 'verified metadata for this build');
  }
  assert.equal(worker.networkRequests.length, 0);
});

test('standalone model sidecars with a provider origin resolve only known local targets', async () => {
  const remote = 'https://models.example/tree/bark.png';
  const local = '/assets/external/models.example/tree/bark.png';
  const worker = workerHarness({ offline: true, externalMap: { [remote]: local } });
  await worker.complete(APP_CACHE, { [local]: 'verified bark bytes' });
  const { response } = await worker.dispatch(`https://models.example${local}`);
  assert.equal(await response.text(), 'verified bark bytes');
  assert.equal(worker.networkRequests.length, 0);
});

test('uncached mapped metadata fetches the local deployment with its original cache policy', async () => {
  const remote = 'https://api.polyhaven.com/files/ArmChair_01';
  const local = '/assets/external/metadata/ArmChair_01.json';
  const worker = workerHarness({ externalMap: { [remote]: local } });
  for (const cache of ['no-store', 'reload']) {
    const { response } = await worker.dispatch(remote, { cache });
    assert.equal(await response.text(), `network:${local}`);
    const request = worker.networkRequests.at(-1);
    assert.equal(request.url, `${ORIGIN}${local}`);
    assert.equal(request.cache, cache);
    assert.equal(request.credentials, 'same-origin');
  }
});

test('explicit installer verification always fetches exact local deployment bytes', async () => {
  const remote = 'https://api.polyhaven.com/files/ArmChair_01';
  const local = '/assets/external/metadata/ArmChair_01.json';
  const worker = workerHarness({ externalMap: { [remote]: local } });
  await worker.complete(APP_CACHE, { [local]: 'old downloaded bytes' });
  for (const cache of ['default', 'no-store']) {
    const { response, request } = await worker.dispatch(local, { cache, headers: { 'X-TonPlaygram-Verify': '1' } });
    assert.equal(await response.text(), `network:${local}`);
    const networkRequest = worker.networkRequests.at(-1);
    assert.equal(networkRequest, request, 'internal fetch wrapper preserves the original verification request');
    assert.equal(networkRequest.url, `${ORIGIN}${local}`);
    assert.equal(networkRequest.cache, cache);
    assert.equal(networkRequest.headers.get('X-TonPlaygram-Verify'), '1');
  }
});

test('mapped media preserves Range responses and local network fallback headers', async () => {
  const remote = 'https://audio.example/theme.m4a';
  const local = '/assets/external/audio/theme.m4a';
  const worker = workerHarness({ externalMap: { [remote]: local } });
  await worker.complete(APP_CACHE, { [local]: new Response('0123456789', { headers: { 'Content-Type': 'audio/mp4' } }) });
  const saved = await worker.dispatch(remote, { headers: { Range: 'bytes=2-5' } });
  assert.equal(saved.response.status, 206);
  assert.equal(await saved.response.text(), '2345');
  assert.equal(saved.response.headers.get('Content-Range'), 'bytes 2-5/10');
  assert.equal(worker.networkRequests.length, 0);
  const noStore = await worker.dispatch(remote, { cache: 'no-store', headers: { Range: 'bytes=2-5' } });
  assert.equal(noStore.response.status, 206);
  assert.equal(await noStore.response.text(), '2345');
  assert.equal(worker.networkRequests.length, 0);
  const uncached = workerHarness({ externalMap: { [remote]: local } });
  await uncached.dispatch(remote, { cache: 'no-store', headers: { Range: 'bytes=2-5' } });
  assert.equal(uncached.networkRequests[0].url, `${ORIGIN}${local}`);
  assert.equal(uncached.networkRequests[0].headers.get('range'), 'bytes=2-5');
});

test('private APIs, authenticated requests and POSTs remain unchanged despite external map entries', async () => {
  const local = '/assets/external/public.json';
  const privateApi = 'https://accounts.example/api/profile';
  const publicUrl = 'https://cdn.example/config.json';
  const worker = workerHarness({ externalMap: { [privateApi]: local, [publicUrl]: local } });
  const cases = [
    [privateApi, { cache: 'no-store' }],
    [publicUrl, { headers: { Authorization: 'Bearer private-session' } }],
    [publicUrl, { method: 'POST', body: 'private payload' }],
    ['https://accounts.example/auth/session', {}]
  ];
  for (const [url, init] of cases) {
    const { intercepted } = await worker.dispatch(url, init);
    assert.equal(intercepted, false);
    assert.equal(worker.networkRequests.at(-1).url, url);
  }
});

test('invalid external mapping targets cannot redirect public requests to private or remote endpoints', async () => {
  const remote = 'https://cdn.example/model.glb';
  for (const target of ['/api/profile', '/auth/session', 'https://other.example/redirect.glb']) {
    const worker = workerHarness({ externalMap: { [remote]: target } });
    await worker.dispatch(remote);
    assert.equal(worker.networkRequests[0].url, remote);
  }
});

test('activation preserves all downloads and unrelated caches while removing old app runtime/static caches', async () => {
  const worker = workerHarness();
  const keep = [
    APP_CACHE,
    'tonplaygram-pack-pool-legacy',
    'tonplaygram-pack-metadata-v1',
    `tonplaygram-static-${BUILD}`,
    `tonplaygram-runtime-${BUILD}`,
    'unrelated-feature-cache',
    'tonplaygram-user-drafts'
  ];
  const remove = ['tonplaygram-static-older', 'tonplaygram-runtime-older'];
  for (const name of [...keep, ...remove]) await worker.caches.open(name);
  await worker.activate();
  assert.deepEqual((await worker.caches.keys()).sort(), keep.sort());
  assert.equal(worker.lifecycle.claimed, true);
  assert.equal(worker.lifecycle.navigationPreloadDisabled, true);
});

test('worker coalesces 2,467-file legacy receipt parsing across simultaneous game assets', async () => {
  const worker = workerHarness({ offline: true });
  await worker.seed(APP_CACHE, {
    [COMPLETE_PATH]: JSON.stringify({ build: BUILD, assets: Array.from({ length: 2467 }, (_, index) => ({
      url: `/assets/game-${index}.glb`, size: 45678, sha256: 'a'.repeat(64)
    })) }),
    '/assets/game.glb': 'downloaded model'
  });
  const results = await Promise.all(Array.from({ length: 50 }, () => worker.dispatch('/assets/game.glb')));
  assert.ok((await Promise.all(results.map(({ response }) => response.text()))).every(body => body === 'downloaded model'));
  assert.equal(worker.caches.stats.receiptParses, 1);
  assert.equal(worker.caches.stats.markerReads, 50);
  assert.equal(worker.networkRequests.length, 0);
});

test('worker completion headers bypass receipt parsing while keeping the build boundary', async () => {
  for (const build of [BUILD, 'older-build']) {
    const worker = workerHarness();
    await worker.seed(APP_CACHE, {
      [COMPLETE_PATH]: new Response(JSON.stringify({ build }), { headers: { 'X-TonPlaygram-App-Build': build } }),
      '/assets/game.glb': 'downloaded model'
    });
    const { response } = await worker.dispatch('/assets/game.glb');
    assert.equal(await response.text(), build === BUILD ? 'downloaded model' : 'network:/assets/game.glb');
    assert.equal(worker.caches.stats.receiptParses, 0);
  }
});

test('worker memoization cannot expose staging or evicted files after completion was previously read', async () => {
  const worker = workerHarness();
  await worker.complete(APP_CACHE, { '/assets/game.glb': 'downloaded model' });
  assert.equal(await (await worker.dispatch('/assets/game.glb')).response.text(), 'downloaded model');
  const cache = await worker.caches.open(APP_CACHE);
  await cache.delete(COMPLETE_PATH);
  assert.equal(await (await worker.dispatch('/assets/game.glb')).response.text(), 'network:/assets/game.glb');
  await worker.complete(APP_CACHE, { build: 'older-build', '/assets/game.glb': 'old model' });
  assert.equal(await (await worker.dispatch('/assets/game.glb')).response.text(), 'network:/assets/game.glb');
  assert.equal(worker.caches.stats.receiptParses, 2);
  await cache.delete(COMPLETE_PATH);
  await worker.dispatch('/assets/game.glb');
  await worker.complete(APP_CACHE, { '/assets/game.glb': 'downloaded model' });
  await cache.delete('/assets/game.glb');
  assert.equal(await (await worker.dispatch('/assets/game.glb')).response.text(), 'network:/assets/game.glb');
});

test('only the same-build full-app Domino query can use the unqueried downloaded module', async () => {
  const worker = workerHarness();
  await worker.complete(APP_CACHE, { '/domino-royal-game.js': 'downloaded Domino' });
  const installed = await worker.dispatch(`/domino-royal-game.js?v=${BUILD}`, { destination: 'script' });
  assert.equal(await installed.response.text(), 'downloaded Domino');
  assert.equal(worker.networkRequests.length, 0);
  for (const query of ['?v=older-build', `?v=${BUILD}&extra=1`, `?v=${BUILD}&v=${BUILD}`]) {
    const { response } = await worker.dispatch('/domino-royal-game.js' + query, { destination: 'script' });
    assert.equal(await response.text(), 'network:/domino-royal-game.js');
  }
  const legacy = workerHarness();
  await legacy.complete('tonplaygram-pack-domino-v1', { '/domino-royal-game.js': 'old Domino' });
  assert.equal(await (await legacy.dispatch(`/domino-royal-game.js?v=${BUILD}`)).response.text(), 'network:/domino-royal-game.js');
});
