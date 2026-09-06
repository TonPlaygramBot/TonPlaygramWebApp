import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { isTelegramEnvironment, readStorage, parseAndroidRelease, resolvePublicCacheAsset, withTimeout } from '../webapp/src/pwa/installSupport.js';

const root = new URL('../', import.meta.url);
const source = path => readFile(new URL(path, root), 'utf8');
const releaseFixture = () => ({
  tag_name: 'android-v1.1.1-3', published_at: '2026-09-06T00:00:00Z', draft: false, prerelease: false,
  assets: ['TonPlaygram.apk', 'TonPlaygram.apk.sha256'].map(name => ({ name, state: 'uploaded', size: 1024,
    browser_download_url: `https://github.com/TonPlaygramBot/TonPlaygramWebApp/releases/download/android-v1.1.1-3/${name}` }))
});

async function moduleInContext(path, globals = {}, mocks = {}) {
  const context = vm.createContext({ console, URL, Request, Response, Headers, AbortController, DOMException, setTimeout, clearTimeout, ...globals });
  const modules = new Map();
  async function load(id) {
    if (modules.has(id)) return modules.get(id);
    const code = mocks[id] ?? await source(id);
    const mod = new vm.SourceTextModule(code, { context, identifier: id });
    modules.set(id, mod);
    await mod.link(async (specifier, referring) => {
      if (specifier in mocks) return load(specifier);
      return load(new URL(specifier, `file:///${referring.identifier}`).pathname.slice(1));
    });
    return mod;
  }
  const mod = await load(path);
  await mod.evaluate();
  return { exports: mod.namespace, context };
}

const memoryStorage = () => {
  const map = new Map();
  return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key), map };
};

test('ordinary browser with Telegram SDK is not a Telegram session', () => {
  assert.equal(isTelegramEnvironment({ Telegram: { WebApp: { initData: '', platform: 'unknown' } } }), false);
  assert.equal(isTelegramEnvironment({}), false);
});
test('Telegram initData/platform are recognized', () => {
  assert.equal(isTelegramEnvironment({ Telegram: { WebApp: { initData: 'signed-data' } } }), true);
  assert.equal(isTelegramEnvironment({ Telegram: { WebApp: { platform: 'android' } } }), true);
});
test('blocked storage does not throw', () => {
  assert.equal(readStorage('test', { getItem() { throw new Error('denied'); } }), null);
});
test('valid published APK and checksum are accepted', () => {
  assert.equal(parseAndroidRelease(releaseFixture()).version, '1.1.1');
  assert.equal(parseAndroidRelease(releaseFixture()).versionCode, 3);
});
for (const kind of ['draft', 'prerelease', 'missing-checksum', 'empty-apk', 'wrong-repo', 'debug', 'unpublished']) {
  test(`APK validation rejects ${kind}`, () => {
    const data = releaseFixture();
    if (kind === 'draft' || kind === 'prerelease') data[kind] = true;
    if (kind === 'missing-checksum') data.assets.pop();
    if (kind === 'empty-apk') data.assets[0].size = 0;
    if (kind === 'wrong-repo') data.assets[0].browser_download_url = 'https://evil.example/TonPlaygram.apk';
    if (kind === 'debug') data.tag_name = 'launcher-latest';
    if (kind === 'unpublished') data.published_at = null;
    assert.equal(parseAndroidRelease(data), null);
  });
}
for (const asset of ['https://evil.example/x.js', '//evil.example/x.js', '/api/private.json', '/%61pi/private.json', '/api%2Fprivate.json', '/auth/user.json', '/wallet/data.json', '/game.js?token=secret', '/TonPlaygram.apk', '/.env', '/%2eenv.json']) {
  test(`cache rejects unsafe asset ${asset}`, () => assert.equal(resolvePublicCacheAsset(asset, 'https://app.example/'), null));
}
test('cache allows same-origin public models and nested base paths', () => {
  assert.equal(resolvePublicCacheAsset('/assets/model.glb', 'https://app.example/'), 'https://app.example/assets/model.glb');
  assert.equal(resolvePublicCacheAsset('assets/game.js', 'https://app.example/sub/'), 'https://app.example/sub/assets/game.js');
});
test('timeouts resolve, reject, and cancel without waiting forever', async () => {
  assert.equal(await withTimeout(Promise.resolve(7), 100, 'timeout'), 7);
  await assert.rejects(withTimeout(new Promise(() => {}), 5, 'timeout'), /timeout/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(withTimeout(Promise.resolve(1), 100, 'timeout', controller.signal), { name: 'AbortError' });
});

async function offlineHarness({ assets = ['/game.js'], failed = [], quota = false } = {}) {
  const storage = memoryStorage();
  const cached = new Map();
  let calls = 0;
  const cache = {
    match: async url => cached.get(url),
    put: async (url, response) => {
      if (quota) throw new DOMException('quota', 'QuotaExceededError');
      cached.set(url, response);
    }
  };
  const { exports } = await moduleInContext('webapp/src/pwa/offlineCache.js', {
    window: { isSecureContext: true, localStorage: storage, location: { origin: 'https://app.example' }, caches: {} },
    caches: { open: async () => cache }, navigator: { serviceWorker: { ready: Promise.resolve({}) } },
    fetch: async (url, options) => {
      if (String(url).endsWith('offline-assets.json')) return Response.json(assets);
      calls++;
      if (failed.includes(new URL(url).pathname)) return new Response('missing', { status: 404 });
      if (options?.signal?.aborted) throw new DOMException('cancelled', 'AbortError');
      return new Response('export default 1', { headers: { 'content-type': 'text/javascript' } });
    }
  }, { 'webapp/src/pwa/preloadGames.js': "export const RUNTIME_CACHE_NAME = 'tonplaygram-runtime-test';" });
  return { exports, storage, cached, calls: () => calls };
}
test('no automatic full download before cache opt-in', async () => {
  const { exports } = await offlineHarness();
  assert.equal(exports.shouldAutoWarmOfflineCache().shouldWarm, false);
});
test('complete cache is marked complete and retries reuse saved files', async () => {
  const h = await offlineHarness();
  const result = await h.exports.cacheOfflineAssets();
  assert.equal(result.successes, 1); assert.equal(result.failures, 0);
  assert.equal(h.storage.getItem('tonplaygram-offline-cache-version'), 'tonplaygram-runtime-test');
  await h.exports.cacheOfflineAssets();
  assert.equal(h.calls(), 1);
});
test('partial downloads retain failure count and never mark build complete', async () => {
  const h = await offlineHarness({ assets: ['/game.js', '/missing.js'], failed: ['/missing.js'] });
  const result = await h.exports.cacheOfflineAssets();
  assert.equal(result.failures, 1); assert.equal(result.successes, 1);
  assert.equal(h.storage.getItem('tonplaygram-offline-cache-version'), null);
});
test('all failed assets cause an error, not a success badge', async () => {
  const h = await offlineHarness({ failed: ['/game.js'] });
  await assert.rejects(h.exports.cacheOfflineAssets(), /No game files/);
});
test('quota error is actionable and does not mark cache complete', async () => {
  const h = await offlineHarness({ quota: true });
  await assert.rejects(h.exports.cacheOfflineAssets(), /storage is full/);
});
test('cancelled caching rejects without downloading files', async () => {
  const h = await offlineHarness(); const c = new AbortController(); c.abort();
  await assert.rejects(h.exports.cacheOfflineAssets({ signal: c.signal }), { name: 'AbortError' });
  assert.equal(h.calls(), 0);
});

async function hookHarness({ native = false, telegram = false, denied = false } = {}) {
  const listeners = new Map(); let openUrl = ''; let promptCalls = 0;
  const window = { location: { origin: 'https://app.example', href: 'https://app.example/?account=secret#tgWebAppData=secret' },
    matchMedia: () => ({ matches: false, addEventListener() {} }), addEventListener: (name, handler) => listeners.set(name, handler),
    open: url => { openUrl = url; }, Telegram: telegram ? { WebApp: { initData: 'signed', openLink: url => { openUrl = url; } } } : undefined };
  Object.defineProperty(window, 'localStorage', { get: () => { if (denied) throw new Error('denied'); return memoryStorage(); } });
  const { exports } = await moduleInContext('webapp/src/hooks/usePwaInstallPrompt.js', { window, navigator: { userAgent: 'Android', platform: 'Linux' } }, {
    react: 'export const useSyncExternalStore = (subscribe, getSnapshot) => getSnapshot();',
    '@capacitor/core': `export const Capacitor = { isNativePlatform: () => ${native} };`
  });
  const prompt = { preventDefault() {}, prompt: async () => { promptCalls++; return { outcome: 'accepted' }; } };
  return { hook: exports.default, emit: name => listeners.get(name)?.(prompt), calls: () => promptCalls, url: () => openUrl };
}
test('two install consumers share a one-shot prompt; acceptance is not installation', async () => {
  const h = await hookHarness(); h.emit('beforeinstallprompt');
  assert.equal(h.hook().canInstall, true);
  await h.hook().promptToInstall();
  assert.equal(await h.hook().promptToInstall(), false);
  assert.equal(h.calls(), 1); assert.equal(h.hook().installed, false);
  h.emit('appinstalled'); assert.equal(h.hook().installed, true);
});
test('native app suppresses the browser installation prompt', async () => {
  const h = await hookHarness({ native: true }); h.emit('beforeinstallprompt');
  assert.equal(h.hook().canInstall, false); assert.equal(h.hook().mode, 'none');
});
test('hook tolerates a throwing localStorage getter', async () => {
  const h = await hookHarness({ denied: true });
  assert.doesNotThrow(() => h.hook().dismiss());
});
test('external browser install strips all account and Telegram launch data', async () => {
  const h = await hookHarness({ telegram: true }); h.hook().openExternalInstall();
  assert.equal(h.url(), 'https://app.example/');
});

async function workerHarness() {
  const listeners = new Map(); const deleted = []; let skipped = 0; let claimed = 0;
  const context = vm.createContext({
    URL, Response, Headers,
    Request: class extends Request { constructor(url, options) { super(new URL(url, 'https://app.example'), options); } },
    importScripts() {},
    self: { location: { origin: 'https://app.example' }, registration: { navigationPreload: { enable: async () => {} } },
      clients: { claim: async () => { claimed++; } }, skipWaiting: async () => { skipped++; },
      addEventListener: (type, listener) => listeners.set(type, listener) },
    caches: { keys: async () => ['other-app-auth', 'tonplaygram-open-source-old', 'tonplaygram-runtime-old'],
      delete: async name => { deleted.push(name); },
      open: async () => ({ addAll: async () => {}, match: async () => null, put: async () => {} }), match: async () => null },
    fetch: async () => new Response('ok')
  });
  vm.runInContext(await source('webapp/public/service-worker.js'), context);
  return { listeners, deleted, skipped: () => skipped, claimed: () => claimed };
}
test('worker installation does not activate itself or discard other caches', async () => {
  const h = await workerHarness(); let task;
  h.listeners.get('install')({ waitUntil: value => { task = value; } }); await task;
  assert.equal(h.skipped(), 0);
  h.listeners.get('activate')({ waitUntil: value => { task = value; } }); await task;
  assert.deepEqual(h.deleted, ['tonplaygram-runtime-old']); assert.equal(h.claimed(), 1);
});
for (const url of ['https://app.example/api/wallet', 'https://app.example/%61pi/balance.json', 'https://github.com/TonPlaygramBot/TonPlaygramWebApp/releases/download/v/TonPlaygram.apk', 'https://api.github.com/repos/x/releases/latest', 'https://unknown.example/private.json']) {
  test(`worker bypasses private/download traffic: ${url}`, async () => {
    const h = await workerHarness(); let intercepted = false;
    h.listeners.get('fetch')({ request: new Request(url), respondWith: () => { intercepted = true; } });
    assert.equal(intercepted, false);
  });
}
test('public game model remains cacheable', async () => {
  const h = await workerHarness(); let response;
  h.listeners.get('fetch')({ request: new Request('https://app.example/assets/table.glb'), waitUntil() {}, respondWith: value => { response = value; } });
  assert.ok(response); assert.equal((await response).status, 200);
});
test('game-in-progress prevents a manual update reload', async () => {
  const storage = memoryStorage(); storage.setItem('tonplaygram-game-active', 'true');
  const { exports } = await moduleInContext('webapp/src/pwa/installSupport.js', { window: { localStorage: storage } });
  await assert.rejects(exports.applyWaitingWebUpdate({ waiting: {} }), /Finish your current game/);
});

test('production CORS allows the HTTPS Capacitor origin, not lookalike hosts', async () => {
  const { exports } = await moduleInContext('bot/utils/corsOrigin.js');
  assert.equal(exports.isAllowedApiOrigin('https://localhost', [], true), true);
  assert.equal(exports.isAllowedApiOrigin('https://localhost.evil.example', [], true), false);
  assert.equal(exports.isAllowedApiOrigin('https://untrusted.example', [], true), false);
});
