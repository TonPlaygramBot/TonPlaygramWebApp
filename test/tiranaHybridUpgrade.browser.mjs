/** Real Tirana route, real simulation and WebGL at portrait phone sizes.
 * Only the account balance API is a fixture. No rendering/physics is mocked.
 * Run after the normal asset preparation:
 *   PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node test/tiranaHybridUpgrade.browser.mjs
 *   node test/tiranaHybridUpgrade.browser.mjs --build-only
 * Screenshots/logs are written to a temporary directory printed at completion.
 * Software WebGL is a visual smoke check, never a physical-phone FPS benchmark.
 */
import assert from 'node:assert/strict';
import {createReadStream, existsSync} from 'node:fs';
import {mkdtemp, readFile, writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {extname, join, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from '../webapp/node_modules/esbuild/lib/main.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const webapp = join(root, 'webapp');
const output = await mkdtemp(join(tmpdir(), 'tirana-hybrid-smoke-'));
const buildOnly = process.argv.includes('--build-only');
const result = {scope: 'Real React route, input, simulation and WebGL; account API fixture only', errors: [], failedAssets: []};
const bundle = await build({
  stdin: {
    contents: `import React from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import TiranaStreets from './src/pages/Games/TiranaStreets.jsx';
createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={['/games/tiranastreets?mode=ai']}><TiranaStreets/></MemoryRouter>);`,
    resolveDir: webapp,
    loader: 'tsx'
  },
  bundle: true,
  format: 'esm',
  jsx: 'automatic',
  minify: true,
  sourcemap: false,
  metafile: true,
  outfile: join(output, 'game.js'),
  define: {'process.env.NODE_ENV': '"production"'},
  plugins: buildOnly ? [] : [{
    name: 'read-only-runtime-observer',
    setup(builder) {
      builder.onLoad({filter: /street-career\/StreetCareerRuntime\.ts$/}, async ({path}) => {
        const source = await readFile(path, 'utf8');
        const anchor = '    this.profile = campaign.load(storage);';
        assert.equal(source.split(anchor).length, 2, 'runtime observer anchor must be unique');
        return {
          contents: source.replace(anchor, `    (window as any).__tiranaSmokeRuntime = this;\n${anchor}`),
          loader: 'ts'
        };
      });
    }
  }],
  logLevel: 'warning'
});
await writeFile(join(output, 'bundle-meta.json'), JSON.stringify(bundle.metafile, null, 2));
console.log(`Tirana production route bundle: ${join(output, 'game.js')}`);

if (!buildOnly) {
  const {chromium} = await import('playwright');
  const publicRoot = resolve(webapp, 'public');
  const types = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ktx2': 'image/ktx2'};
  const server = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname === '/') {
      res.setHeader('Content-Type', 'text/html');
      res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/game.css"><style>html,body,#root{margin:0;width:100%;height:100%;background:#17222d}</style><div id="root"></div><script type="module" src="/game.js"></script>');
      return;
    }
    if (pathname === '/api/tirana-store/account') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({balanceTPG: 1234.5, ownedWeaponIds: []}));
      return;
    }
    const folder = pathname === '/game.js' || pathname === '/game.css' ? output : publicRoot;
    const file = resolve(folder, '.' + pathname);
    if (!file.startsWith(folder + sep) || !existsSync(file)) {
      res.writeHead(404); res.end(); return;
    }
    res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
    const stream = createReadStream(file);
    stream.on('error', () => { if (!res.headersSent) res.writeHead(404); res.end(); });
    stream.pipe(res);
  });
  let browser;
  let page;
  try {
    await new Promise((resolveListen, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolveListen); });
    browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
    });
    page = await browser.newPage({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true});
    page.on('pageerror', error => result.errors.push(error.message));
    page.on('response', response => {
      if (response.status() >= 400 && /^\/(assets|vendor)\//.test(new URL(response.url()).pathname))
        result.failedAssets.push({path: new URL(response.url()).pathname, status: response.status()});
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/`, {waitUntil: 'domcontentloaded'});
    await page.getByRole('group', {name: 'Available players'}).getByRole('button').filter({hasText: 'Turi'}).click();
    await page.getByRole('button', {name: 'Next · Choose weapons', exact: true}).click({timeout: 180000});
    await page.getByRole('button', {name: /^Continue as Turi/}).click();
    await page.waitForFunction(() => window.__tiranaSmokeRuntime?.ready, null, {timeout: 180000});
    await page.waitForSelector('.tsc-stick');
    assert.equal(await page.locator('.tsc-error').count(), 0, 'city startup has no fatal graphics/load error');
    assert.ok(await page.evaluate(() => {
      const runtime = window.__tiranaSmokeRuntime;
      return runtime.renderer.renderer.getContext() && !runtime.renderer.renderer.getContext().isContextLost();
    }), 'real WebGL context survives city startup');

    const cdp = await page.context().newCDPSession(page);
    const stick = await page.locator('.tsc-stick').boundingBox();
    assert.ok(stick);
    const touch = {id: 1, x: stick.x + stick.width / 2, y: stick.y + stick.height / 2, radiusX: 3, radiusY: 3, force: 1};
    const before = await page.evaluate(() => {
      const runtime = window.__tiranaSmokeRuntime;
      return {x: runtime.state.players.local.x, z: runtime.state.players.local.z, elapsed: runtime.state.elapsed};
    });
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [touch]});
    touch.y -= 28;
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [touch]});
    await page.waitForFunction(previous => {
      const runtime = window.__tiranaSmokeRuntime, p = runtime.state.players.local;
      return Math.hypot(p.x - previous.x, p.z - previous.z) > .1;
    }, before, {timeout: 15000});
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    assert.equal(await page.evaluate(() => window.__tiranaSmokeRuntime.input.touch.y), 0, 'releasing the finger clears movement');

    await page.getByRole('button', {name: 'MENU', exact: true}).click();
    assert.equal(await page.evaluate(() => window.__tiranaSmokeRuntime.paused), true);
    assert.equal(await page.evaluate(() => window.__tiranaSmokeRuntime.input.touch.fire), false);
    await page.locator('dialog[open]').getByRole('button', {name: 'RESUME', exact: true}).click();
    await page.getByRole('button', {name: 'Change walking camera view'}).click();
    result.viewports = [];
    for (const viewport of [{width: 390, height: 844}, {width: 320, height: 740}]) {
      await page.setViewportSize(viewport);
      for (const selector of ['.tsc-header', '.tsc-stick', '.tsc-slot-primary']) {
        const rect = await page.locator(selector).boundingBox();
        assert.ok(rect && rect.x >= -1 && rect.y >= -1 && rect.x + rect.width <= viewport.width + 1 && rect.y + rect.height <= viewport.height + 1,
          `${selector} remains inside ${viewport.width}×${viewport.height}: ${JSON.stringify(rect)}`);
      }
      const path = join(output, `portrait-${viewport.width}.png`);
      await page.screenshot({path, timeout: 30000});
      result.viewports.push({...viewport, screenshot: path});
    }
    assert.deepEqual(result.errors, [], 'no unhandled browser exception');
    assert.deepEqual(result.failedAssets, [], 'asset preparation supplies every requested local asset');
    result.passed = true;
    console.log('TIRANA_HYBRID_BROWSER_PASS');
  } catch (error) {
    result.passed = false;
    result.failure = String(error);
    if (page) await page.screenshot({path: join(output, 'failure.png'), timeout: 10000}).catch(() => {});
    throw error;
  } finally {
    await writeFile(join(output, 'result.json'), JSON.stringify(result, null, 2));
    await browser?.close();
    if (server.listening) await new Promise(resolveClose => server.close(resolveClose));
    console.log(`Tirana smoke results: ${output}`);
  }
}
