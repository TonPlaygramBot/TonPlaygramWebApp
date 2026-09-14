import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { createServer as createHttpServer } from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Run with a Vite server serving webapp/murlan-preview.html. Optional environment:
// MURLAN_PREVIEW_URL, MURLAN_QA_OUTPUT, PLAYWRIGHT_MODULE, CHROMIUM_EXECUTABLE.
// MURLAN_START_SERVER=1 starts Vite; MURLAN_STATIC_ROOT serves a built preview.
// MURLAN_OFFLINE_ASSETS=1 aborts external assets, using the shipped RPM fallback.
// MURLAN_UI_ONLY=1 disables WebGL and injects offscreen avatar overflow probes.
// MURLAN_STEPPED_FRAMES=1 runs one settled production frame on software GPUs.
const require = createRequire(import.meta.url);
const playwrightPath = process.env.PLAYWRIGHT_MODULE || 'playwright';
let chromium;
try {
  ({ chromium } = require(playwrightPath));
} catch {
  throw new Error('Install Playwright or set PLAYWRIGHT_MODULE to its package directory.');
}
const baseUrl = process.env.MURLAN_PREVIEW_URL || 'http://127.0.0.1:5173/murlan-preview.html';
const output = resolve(process.env.MURLAN_QA_OUTPUT || 'docs/validation/murlan-portrait');
await mkdir(output, { recursive: true });
let server;
if (process.env.MURLAN_STATIC_ROOT) {
  const staticRoot = resolve(process.env.MURLAN_STATIC_ROOT);
  const publicRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../webapp/public');
  const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json' };
  server = createHttpServer(async (request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    for (const root of [staticRoot, publicRoot]) {
      const path = resolve(root, `.${pathname}`);
      if (!path.startsWith(`${root}/`)) continue;
      try { const bytes = await readFile(path); response.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream' }); response.end(bytes); return; } catch {}
    }
    response.writeHead(404); response.end('Not found');
  });
  await new Promise(resolve => server.listen(5173, '127.0.0.1', resolve));
  console.log('Murlan static preview server ready');
} else if (process.env.MURLAN_START_SERVER === '1') {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../webapp');
  const { createServer } = await import('../webapp/node_modules/vite/dist/node/index.js');
  server = await createServer({ root, configFile: resolve(root, 'vite.config.js'), optimizeDeps: { entries: ['murlan-preview.html'] }, server: { host: '127.0.0.1', port: 5173, strictPort: true } });
  await server.listen();
  console.log('Murlan preview server ready');
}
const launchOptions = {
  headless: true,
  ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}),
  args: ['--disable-dev-shm-usage', '--no-zygote', '--single-process', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
};
let browser;
const results = [];
try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 740 }]) {
    browser = await chromium.launch(launchOptions);
    console.log('Murlan review browser ready');
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    console.log(`Portrait context ${viewport.width} ready`);
    const page = await context.newPage();
    if (process.env.MURLAN_UI_ONLY === '1') {
      await page.addInitScript(() => {
        const getContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, ...args) {
          return type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl' ? null : getContext.call(this, type, ...args);
        };
      });
    }
    if (process.env.MURLAN_STEPPED_FRAMES === '1') {
      await page.addInitScript(() => {
        const callbacks = new Map();
        let nextId = 1;
        window.requestAnimationFrame = callback => { const id = nextId++; callbacks.set(id, callback); return id; };
        window.cancelAnimationFrame = id => { callbacks.delete(id); };
        window.__murlanStepFrame = () => { const frame = [...callbacks.values()]; callbacks.clear(); frame.forEach(callback => callback(performance.now())); };
      });
    }
    if (process.env.MURLAN_OFFLINE_ASSETS === '1') {
      await page.route('**/*', route => {
        const url = new URL(route.request().url());
        return ['127.0.0.1', 'localhost'].includes(url.hostname) || url.protocol === 'data:' ? route.continue() : route.abort();
      });
    }
    console.log('Review page ready');
    const errors = [];
    const failedRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('requestfailed', request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    console.log(`Loaded ${viewport.width} portrait arena`);
    if (process.env.MURLAN_UI_ONLY !== '1') await page.locator('canvas').waitFor({ state: 'visible', timeout: 30000 });
    await page.getByRole('navigation', { name: 'Game tools' }).waitFor();
    if (process.env.MURLAN_UI_ONLY === '1') {
      await page.evaluate(() => {
        const arena = document.getElementById('root')?.firstElementChild;
        for (const side of ['left', 'right']) {
          const projectedAvatar = document.createElement('div');
          projectedAvatar.setAttribute('aria-hidden', 'true');
          projectedAvatar.style.cssText = `position:absolute;${side}:-10%;top:200px;width:64px;height:64px;pointer-events:none`;
          arena?.appendChild(projectedAvatar);
        }
      });
    }
    console.log(process.env.MURLAN_UI_ONLY === '1' ? 'Portrait controls ready (WebGL disabled)' : 'Canvas and controls ready');
    // Allow deal/model loading to settle without awaiting a fixed frame count;
    // CPU-only WebGL can render fewer frames per second in headless CI.
    if (process.env.MURLAN_UI_ONLY !== '1') await page.waitForTimeout(5000);
    if (process.env.MURLAN_STEPPED_FRAMES === '1') {
      console.log('Rendering one settled review frame');
      await page.evaluate(() => window.__murlanStepFrame());
    }
    const sceneMetrics = await page.evaluate(() => {
      const store = window.__murlanPreview;
      if (!store) return { exposed: false };
      const point = object => object.getWorldPosition(object.position.clone()).toArray();
      return {
        exposed: true,
        radius: store.tableInfo?.radius,
        surfaceY: store.tableInfo?.surfaceY,
        seats: store.seatConfigs.map(seat => ({ index: seat.seatIndex, chair: point(seat.chair) })),
        rigs: [...store.characterRigs.entries()].map(([index, rig]) => ({ index, position: point(rig.instance), errors: rig.handController?.errors, arms: Object.fromEntries(Object.entries(rig.handController?.arms || {}).map(([side, arm]) => [side, { extension: arm.extension, upper: point(arm.upper), elbow: point(arm.fore), wrist: point(arm.hand), grip: arm.grip.position.toArray() }])) })),
        cards: store.handCardMeshes?.map((cards, index) => ({ index, cards: cards.map(card => ({ id: card.userData.cardId, position: point(card) })) }))
      };
    });
    await writeFile(resolve(output, `scene-${viewport.width}.json`), JSON.stringify(sceneMetrics, null, 2));
    console.log('Scene metrics saved');
    // Freeze the review frame after the real animation settles. Software WebGL
    // otherwise competes with screenshot compositing on headless CI machines.
    await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
    const metrics = await page.evaluate(() => ({
      width: innerWidth,
      height: innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      overflow: Array.from(document.querySelectorAll('body *')).map(element => ({ tag: element.tagName, cls: element.getAttribute('class'), rect: element.getBoundingClientRect().toJSON() })).filter(entry => entry.rect.width && (entry.rect.right > innerWidth + 1 || entry.rect.left < -1)).slice(0, 20),
      canvas: Array.from(document.querySelectorAll('canvas')).map(canvas => ({ width: canvas.width, height: canvas.height })),
      controls: Array.from(document.querySelectorAll('.murlan-tool, .murlan-action')).map(button => {
        const rect = button.getBoundingClientRect();
        return { label: button.getAttribute('aria-label') || button.textContent.trim(), x: rect.x, y: rect.y, width: rect.width, height: rect.height, disabled: button.disabled };
      })
    }));
    console.log('Portrait layout measured');
    await writeFile(resolve(output, `layout-${viewport.width}.json`), JSON.stringify(metrics, null, 2));
    await page.screenshot({ path: resolve(output, `arena-${viewport.width}.png`) });
    console.log('Portrait screenshot saved');
    assert.equal(metrics.scrollWidth, viewport.width, 'No horizontal overflow on portrait phone');
    assert.equal(metrics.controls.length, 8, 'Five tools and three card actions');
    for (const control of metrics.controls) {
      assert.ok(control.width >= 44 && control.height >= 44, `${control.label} has a 44px touch target`);
      assert.ok(control.x >= 0 && control.y >= 0 && control.x + control.width <= viewport.width + 0.5 && control.y + control.height <= viewport.height + 0.5, `${control.label} stays within the viewport`);
    }
    await page.getByRole('button', { name: 'Table settings', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Table settings' });
    await dialog.waitFor({ state: 'visible' });
    const dialogBox = await dialog.boundingBox();
    assert.ok(dialogBox.x >= 0 && dialogBox.x + dialogBox.width <= viewport.width && dialogBox.y + dialogBox.height <= viewport.height, 'Settings dialog fits portrait screen');
    await page.screenshot({ path: resolve(output, `settings-${viewport.width}.png`) });
    await page.getByRole('button', { name: 'Close settings', exact: true }).press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await page.getByRole('button', { name: 'Table settings', exact: true }).evaluate(button => button === document.activeElement), true, 'Settings restores focus');
    assert.deepEqual(errors, [], 'No unhandled page errors');
    results.push({ viewport, metrics, sceneMetrics, uiOnly: process.env.MURLAN_UI_ONLY === '1', offlineAssets: process.env.MURLAN_OFFLINE_ASSETS === '1', lowResolution: new URL(baseUrl).searchParams.get('qaLowRes') === '1', steppedFrames: process.env.MURLAN_STEPPED_FRAMES === '1', errors, failedRequests, passed: true });
    await browser.close();
    browser = null;
  }
} catch (error) {
  console.error(error);
  throw error;
} finally {
  await writeFile(resolve(output, 'results.json'), JSON.stringify(results, null, 2));
  await browser?.close();
  await server?.close();
}
console.log(`Portrait ${process.env.MURLAN_UI_ONLY === '1' ? 'UI checks passed (WebGL disabled)' : 'arena checks passed'} at 390×844 and 320×740. Evidence: ${output}`);
