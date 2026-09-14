import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const evidenceDirectory = dirname(fileURLToPath(import.meta.url));
const webappDirectory = resolve(evidenceDirectory, '../../../webapp');
const require = createRequire(`${webappDirectory}/package.json`);
const viteEntry = new URL('./dist/node/index.js', pathToFileURL(require.resolve('vite/package.json')));
const { preview } = await import(viteEntry.href);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const scratch = process.env.TONPLAYGRAM_VALIDATION_OUTPUT || evidenceDirectory;
process.chdir(webappDirectory);
// Browser and server must share one exec process in this runtime.
const server = await preview({ preview: { host: '127.0.0.1', port: 4173 } });
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const report = { origin, viewport: { width: 390, height: 844 }, errors: [] };
let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined, headless: true,
    args: process.env.PLAYWRIGHT_CHROMIUM_ARGS ? JSON.parse(process.env.PLAYWRIGHT_CHROMIUM_ARGS) : ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const context = await browser.newContext({ viewport: report.viewport, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('#app-download').waitFor({ timeout: 30000 });
  await page.waitForFunction(() => {
    const button = [...document.querySelectorAll('#app-download button')].find(item => item.textContent.includes('Download TonPlayGram'));
    return button && !button.disabled;
  }, {}, { timeout: 30000 });
  report.home = await page.locator('#app-download').innerText();
  report.homeOverflow = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
  report.storage = await page.evaluate(() => navigator.storage.estimate());
  await page.screenshot({ path: `${scratch}/ton-home-final-390.png` });

  report.localAssets = await page.evaluate(async () => {
    const entries = Object.entries(window.__TONPLAYGRAM_EXTERNAL_ASSETS__ || {});
    const cases = [
      ['texture', /\.(?:jpe?g|png|webp)(?:\?|$)/i],
      ['model', /\.(?:gltf|glb)(?:\?|$)/i],
      ['audio', /\.(?:mp3|ogg|wav)(?:\?|$)/i]
    ];
    const probes = [];
    for (const [kind, pattern] of cases) {
      const found = entries.find(([remote]) => pattern.test(remote));
      if (!found) { probes.push({ kind, found: false }); continue; }
      const [remote, local] = found;
      const response = await fetch(remote, { method: 'HEAD' });
      probes.push({ kind, remote, local, status: response.status, servedLocally: new URL(response.url).origin === location.origin, length: response.headers.get('content-length') });
    }
    return { mappedUrls: entries.length, probes };
  });
  if (!report.localAssets.mappedUrls || report.localAssets.probes.some(item => item.found !== false && (!item.servedLocally || item.status !== 200))) {
    throw new Error('External asset mapping verification failed.');
  }

  await page.getByRole('button', { name: 'Download TonPlayGram', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#app-download [role="alert"]') || [...document.querySelectorAll('#app-download button')].some(button => button.textContent.includes('Pause download')), {}, { timeout: 30000 });
  const pause = page.getByRole('button', { name: 'Pause download', exact: true });
  if (await pause.count()) {
    await pause.click();
    await page.waitForFunction(() => [...document.querySelectorAll('#app-download button')].some(button => /Resume download|Retry download/.test(button.textContent)), {}, { timeout: 30000 });
    const visibleError = await page.locator('#app-download [role="alert"]').count() ? await page.locator('#app-download [role="alert"]').innerText() : null;
    report.download = { result: visibleError ? 'visible-error-after-start' : 'started-and-paused', pauseRequested: true, error: visibleError, text: await page.locator('#app-download').innerText() };
  } else {
    report.download = { result: 'visible-error', error: await page.locator('#app-download [role="alert"]').innerText() };
  }
  await page.screenshot({ path: `${scratch}/ton-download-final-390.png` });

  await page.goto(`${origin}/games`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.getByRole('heading', { name: 'Games Lobby' }).waitFor({ timeout: 30000 });
  report.games = {
    homeLink: await page.locator('a[href="/#app-download"]').innerText(),
    perGameDownloadButtons: await page.getByRole('button', { name: /download game/i }).count(),
    overflow: await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
  };
  await page.screenshot({ path: `${scratch}/ton-games-final-390.png` });
  await page.locator('a[href="/#app-download"]').click();
  report.homeLinkTarget = { url: page.url(), top: await page.locator('#app-download').evaluate(element => element.getBoundingClientRect().top) };
  if (report.errors.length || report.homeOverflow.document > 390 || report.games.overflow.document > 390) throw new Error('Portrait UI check found errors or horizontal overflow.');

  // This is an explicitly partial, temporary test fixture in a fresh browser
  // context. Do not represent it as a complete app download or offline gameplay.
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), {}, { timeout: 30000 });
  report.offlineFixture = await page.evaluate(async () => {
    const rawFetch = window[Symbol.for('tonplaygram.external-asset-fetch')];
    if (!rawFetch) throw new Error('Native fetch capture is required to test the worker independently of page URL mapping.');
    const manifest = await (await rawFetch('/pwa/game-packs/tonplaygram-app.json', { cache: 'no-store' })).json();
    const map = Object.entries(window.__TONPLAYGRAM_EXTERNAL_ASSETS__ || {});
    const byPath = new Map(manifest.assets.map(asset => [asset.url, asset]));
    const chosen = [];
    for (const [kind, expression] of [['texture', /\.(?:jpe?g|png|webp)(?:\?|$)/i], ['model', /\.(?:gltf|glb)(?:\?|$)/i], ['audio', /\.(?:mp3|ogg|wav)(?:\?|$)/i]]) {
      const candidates = map.filter(([remote]) => expression.test(remote))
        .map(([remote, local]) => ({ ...byPath.get(local), remote, kind }))
        .filter(asset => asset.url && asset.size >= 128 && asset.size < 8 * 1024 ** 2)
        .sort((left, right) => left.size - right.size);
      if (!candidates.length) throw new Error(`No bounded emitted mapped ${kind} fixture is available.`);
      chosen.push(candidates[0]);
    }
    const shell = byPath.get('/index.html');
    const loaded = new Set(performance.getEntriesByType('resource').map(item => new URL(item.name).pathname));
    const lazyGame = manifest.assets.filter(asset => /^\/assets\/(?:AirHockey|ChessBattleRoyal|CheckersBattleRoyal|FourInRowRoyal|TennisRoyal)[^/]*-[a-f0-9]+\.js$/.test(asset.url) && !loaded.has(asset.url) && asset.size < 2 * 1024 ** 2).sort((left, right) => left.size - right.size)[0];
    if (!shell || !lazyGame) throw new Error('Missing verified shell or unvisited game JavaScript fixture.');
    chosen.push({ ...shell, kind: 'shell' }, { ...lazyGame, kind: 'unvisited-game-chunk' });
    const sha256 = async buffer => [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))].map(byte => byte.toString(16).padStart(2, '0')).join('');
    const cacheName = 'tonplaygram-pack-tonplaygram-app-offline-browser-fixture';
    const cache = await caches.open(cacheName);
    for (const asset of chosen) {
      const response = await rawFetch(asset.url, { cache: 'reload', headers: { 'X-TonPlaygram-Verify': '1' } });
      const buffer = await response.clone().arrayBuffer();
      const actualHash = await sha256(buffer);
      if (!response.ok || actualHash !== asset.sha256 || buffer.byteLength !== asset.size) throw new Error(`Emitted fixture failed integrity verification: ${asset.url}`);
      await cache.put(new URL(asset.url, location.origin), response);
      if (asset.kind === 'audio') asset.rangeSha256 = await sha256(buffer.slice(0, 128));
    }
    const receipt = { version: manifest.version, build: manifest.build, assets: chosen.map(({ url, size, sha256 }) => ({ url, size, sha256 })) };
    await cache.put(new URL('/pwa/game-packs/.complete', location.origin), new Response(JSON.stringify(receipt), { headers: { 'Content-Type': 'application/json' } }));
    // Remove runtime/static copies so only the explicitly seeded fixture can
    // satisfy the following offline requests. No installed UI state is written.
    for (const name of await caches.keys()) if (name !== cacheName) await caches.delete(name);
    window.__TONPLAYGRAM_BROWSER_OFFLINE_FIXTURE__ = chosen;
    return { type: 'explicit partial test fixture', completeAppDownloadTested: false, offlineGameplayTested: false, build: manifest.build, version: manifest.version, completeInventoryBytes: manifest.totalBytes, completeInventoryFiles: manifest.assetCount, totalBytes: chosen.reduce((sum, asset) => sum + asset.size, 0), assets: chosen.map(({ kind, url, remote, size, sha256 }) => ({ kind, url, remote, size, sha256 })), controller: navigator.serviceWorker.controller.scriptURL };
  });
  await page.context().setOffline(true);
  report.offlineDelivery = await page.evaluate(async () => {
    const rawFetch = window[Symbol.for('tonplaygram.external-asset-fetch')];
    const sha256 = async buffer => [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))].map(byte => byte.toString(16).padStart(2, '0')).join('');
    const assets = window.__TONPLAYGRAM_BROWSER_OFFLINE_FIXTURE__;
    const results = [];
    for (const asset of assets.filter(item => item.kind !== 'shell')) {
      const response = await rawFetch(asset.remote || asset.url, asset.remote ? { cache: 'no-store' } : undefined);
      const actualHash = await sha256(await response.arrayBuffer());
      if (response.status !== 200 || actualHash !== asset.sha256) throw new Error(`Offline bytes differ: ${asset.kind}`);
      results.push({ kind: asset.kind, status: response.status, exactBytes: true, originalRemoteUrl: Boolean(asset.remote) });
    }
    const audio = assets.find(item => item.kind === 'audio');
    const range = await rawFetch(audio.remote, { headers: { Range: 'bytes=0-127' }, cache: 'no-store' });
    const rangeHash = await sha256(await range.arrayBuffer());
    if (range.status !== 206 || rangeHash !== audio.rangeSha256 || range.headers.get('content-range') !== `bytes 0-127/${audio.size}`) throw new Error('Offline audio range response differs.');
    let liveApiFailedOffline = false;
    try { await rawFetch('/api/browser-offline-fixture?uncached=1', { cache: 'no-store' }); } catch { liveApiFailedOffline = true; }
    if (!liveApiFailedOffline) throw new Error('Live API request unexpectedly succeeded while offline.');
    return { files: results, audioRange: { status: range.status, exactBytes: true, contentRange: range.headers.get('content-range') }, liveApiFailedOffline };
  });
  const navigationPage = await page.context().newPage();
  const navigationCdp = await page.context().newCDPSession(navigationPage);
  // Validate shell navigation delivery alone; this deliberately small fixture
  // does not contain the dependencies required to execute the entire game.
  await navigationCdp.send('Emulation.setScriptExecutionDisabled', { value: true });
  const navigation = await navigationPage.goto(`${origin}/games/airhockey/lobby?offline-fixture=unvisited`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const { createHash } = require('node:crypto');
  const navigationHash = createHash('sha256').update(await navigation.body()).digest('hex');
  const expectedShell = report.offlineFixture.assets.find(asset => asset.kind === 'shell');
  report.offlineNavigation = { status: navigation.status(), fromServiceWorker: navigation.fromServiceWorker(), exactShellBytes: navigationHash === expectedShell.sha256, path: new URL(navigation.url()).pathname };
  if (!report.offlineNavigation.exactShellBytes || !report.offlineNavigation.fromServiceWorker) throw new Error('Offline unvisited navigation did not receive the downloaded shell.');
  await navigationPage.close();
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.failure = error.message;
  console.error(error);
  process.exitCode = 1;
} finally {
  await writeFile(`${scratch}/ton-portrait-final-report.json`, JSON.stringify(report, null, 2));
  if (browser) await browser.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
