import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { socialAppAssets } from '../webapp/scripts/social-app-plugin.mjs';
import { webappEntry, creatorReturnPath } from '../shared/socialApp.js';

test('a social build caches only its own dependency graph, including lazy pages', () => {
  const chunk = (fileName, imports = [], dynamicImports = []) => ({ type: 'chunk', fileName, imports, dynamicImports, viteMetadata: { importedCss: new Set([fileName + '.css']) } });
  const bundle = {
    'social.js': { ...chunk('social.js', ['shared.js'], ['wall.js', 'hub.js']), isEntry: true, facadeModuleId: '/webapp/social-app/index.html' },
    'shared.js': chunk('shared.js'), 'wall.js': chunk('wall.js', ['shared.js']), 'hub.js': chunk('hub.js'), 'game.js': chunk('game.js')
  };
  const assets = socialAppAssets(bundle);
  assert.ok(assets.includes('/wall.js') && assets.includes('/hub.js.css'));
  assert.ok(!assets.includes('/game.js') && !assets.includes('/index.html'));
  assert.equal(assets.filter(path => path === '/shared.js').length, 1);
});
test('profile deep links select the social HTML and OAuth returns accept only exact local app paths', () => {
  assert.equal(webappEntry('/social-app/wall/profile/ada'), 'social-app/index.html');
  assert.equal(webappEntry('/social-app/creator-studio'), 'social-app/index.html');
  assert.equal(webappEntry('/social'), 'index.html');
  assert.equal(webappEntry('/social-app-lookalike/'), 'index.html');
  assert.equal(creatorReturnPath('/social-app/creator-studio'), '/social-app/creator-studio');
  for (const path of ['//evil.test', 'https://evil.test', '/social-app/creator-studio?next=evil', '/social-app/../account', undefined]) assert.equal(creatorReturnPath(path), '/creator-studio');
});
async function worker() {
  const events = {}, stores = new Map(), fetched = [];
  const caches = {
    async keys() { return [...stores.keys()]; }, async delete(name) { return stores.delete(name); },
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return { async addAll(requests) { for (const request of requests) store.set(new URL(request.url, 'https://tpg.test').pathname, new Response('social shell')); }, async match(path) { return store.get(path)?.clone(); } };
    }
  };
  const self = { location: { origin: 'https://tpg.test' }, clients: { claim: async () => {} }, addEventListener: (type, fn) => events[type] = fn };
  const code = (await readFile(new URL('../webapp/public/social-app/service-worker.js', import.meta.url), 'utf8'))
    .replace('__SOCIAL_VERSION__', 'test')
    .replace('/* SOCIAL_ASSETS */ []', JSON.stringify(['/social-app/index.html', '/assets/social.js']));
  vm.runInNewContext(code, { self, caches, URL, Response, Request: class extends Request { constructor(path, init) { super(new URL(path, 'https://tpg.test'), init); } }, importScripts() {}, fetch: async request => { fetched.push(request); throw new Error('offline'); } });
  return { events, stores, fetched };
}
test('social installation survives offline deep links and never deletes the main app caches', async () => {
  const { events, stores } = await worker();
  stores.set('tonplaygram-static-main', new Map()); stores.set('tonplaygram-social-old', new Map());
  let task;
  events.install({ waitUntil(promise) { task = promise; } }); await task;
  events.activate({ waitUntil(promise) { task = promise; } }); await task;
  assert.ok(stores.has('tonplaygram-static-main')); assert.ok(!stores.has('tonplaygram-social-old'));
  events.fetch({ request: { method: 'GET', url: 'https://tpg.test/social-app/wall/profile/ada', mode: 'navigate', headers: new Headers() }, respondWith(promise) { task = promise; } });
  assert.equal(await (await task).text(), 'social shell');
});
test('worker leaves private APIs, video bytes, other apps and non-GET requests to the network', async () => {
  const { events } = await worker();
  for (const path of ['/api/flamingo-wall/posts', '/api/creator/session', '/api/flamingo-wall/media/clip', '/wall', '/assets/game.js']) {
    events.fetch({ request: { method: 'GET', url: 'https://tpg.test' + path, mode: 'cors', headers: new Headers() }, respondWith() { assert.fail('Private/unrelated request intercepted: ' + path); } });
  }
  events.fetch({ request: { method: 'POST', url: 'https://tpg.test/social-app/wall' }, respondWith() { assert.fail('Mutation intercepted'); } });
});
test('the main worker never replaces Social pages or manifests with its downloaded game shell', async () => {
  const listeners = {};
  const self = {
    location: { origin: 'https://tpg.test' },
    addEventListener(type, fn) { listeners[type] = fn; },
    matchTonPlaygramDownload() { assert.fail('Social requested the main app download'); }
  };
  vm.runInNewContext(await readFile(new URL('../webapp/public/service-worker.js', import.meta.url), 'utf8'), { self, URL, Request, Response, Headers, importScripts() {} });
  for (const path of ['/social-app', '/social-app/wall', '/social-app/install', '/social-app/manifest.webmanifest']) {
    listeners.fetch({ request: { method: 'GET', url: 'https://tpg.test' + path, mode: 'navigate', headers: new Headers() }, respondWith() { assert.fail('Social was intercepted by the main worker'); } });
  }
});
