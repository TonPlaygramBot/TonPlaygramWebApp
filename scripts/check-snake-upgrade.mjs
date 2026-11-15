// Real production components, no asset or network mocks.
// Run from the repository root: node scripts/check-snake-upgrade.mjs
// Optional: SNAKE_QA_URL, SNAKE_QA_OUTPUT, CHROMIUM_PATH.
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = process.env.SNAKE_QA_OUTPUT
  ? resolve(process.env.SNAKE_QA_OUTPUT)
  : await mkdtemp(`${tmpdir()}/snake-upgrade-qa-`);
await mkdir(output, { recursive: true });
const report = { pages: [], browserError: null };
let server;
let browser;
try {
  let baseUrl = process.env.SNAKE_QA_URL;
  if (!baseUrl) {
    const { createServer } = await import('../webapp/node_modules/vite/dist/node/index.js');
    server = await createServer({
      root: resolve(root, 'webapp'),
      configFile: resolve(root, 'webapp/vite.config.js'),
      server: { host: '127.0.0.1', port: 0 }
    });
    await server.listen();
    const address = server.httpServer.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
  }
  browser = await chromium.launch({
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    headless: true,
    args: ['--no-sandbox', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage']
  });
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 740 }]) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const result = { viewport, pageErrors: [], failedRequests: [], consoleErrors: [], checks: [] };
    report.pages.push(result);
    page.on('pageerror', error => result.pageErrors.push(error.message));
    page.on('requestfailed', request => result.failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
    page.on('console', message => { if (message.type() === 'error') result.consoleErrors.push(message.text()); });
    await page.goto(`${baseUrl.replace(/\/$/, '')}/snake-player-review.html?ai=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const roll = page.locator('.snake-roll-button');
    await roll.waitFor({ state: 'visible', timeout: 60000 });
    await page.waitForFunction(() => {
      const button = document.querySelector('.snake-roll-button');
      return button && !button.disabled;
    }, undefined, { timeout: 45000 });
    await page.screenshot({ path: resolve(output, `portrait-${viewport.width}.png`) });
    const geometry = await page.evaluate(() => {
      const selectors = ['.snake-roll-button', '.snake-game-dock button', '.snake-game-header button'];
      const buttons = [...new Set(selectors.flatMap(selector => [...document.querySelectorAll(selector)]))]
        .filter(button => button.getClientRects().length)
        .map(button => {
          const box = button.getBoundingClientRect();
          return { label: button.getAttribute('aria-label') || button.textContent.trim(), x: box.x, y: box.y, width: box.width, height: box.height };
        });
      return { scrollWidth: document.documentElement.scrollWidth, width: innerWidth, height: innerHeight, buttons };
    });
    assert.ok(geometry.scrollWidth <= geometry.width, 'Portrait layout must not overflow horizontally');
    for (const button of geometry.buttons) {
      assert.ok(button.x >= -1 && button.x + button.width <= geometry.width + 1, `Button outside screen: ${button.label}`);
      assert.ok(button.y >= -1 && button.y + button.height <= geometry.height + 1, `Button outside screen: ${button.label}`);
      assert.ok(button.width >= 43 && button.height >= 43, `Touch target below 44px: ${button.label}`);
    }
    for (let i = 0; i < geometry.buttons.length; i += 1) {
      for (let j = i + 1; j < geometry.buttons.length; j += 1) {
        const a = geometry.buttons[i];
        const b = geometry.buttons[j];
        const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
        const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
        assert.ok(width <= 1 || height <= 1, `Controls overlap: ${a.label} / ${b.label}`);
      }
    }
    result.checks.push('portrait bounds, non-overlapping controls and touch targets');
    await roll.click();
    assert.equal(await roll.isDisabled(), true, 'Rolling must lock the roll control immediately');
    result.checks.push('roll lock');
    await page.waitForTimeout(8500);
    await page.screenshot({ path: resolve(output, `after-roll-${viewport.width}.png`) });
    const camera = page.getByRole('button', { name: /switch to (board|player|2d|3d)|^(2D|3D)$/i }).first();
    await camera.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: resolve(output, `camera-${viewport.width}.png`) });
    await page.getByRole('button', { name: 'Switch to player view', exact: true }).click();
    result.checks.push('board and player camera toggle');
    const settings = page.getByRole('button', { name: 'Open game settings menu', exact: true });
    await settings.click();
    await page.getByRole('dialog', { name: 'Arena settings', exact: true }).waitFor({ state: 'visible' });
    await page.screenshot({ path: resolve(output, `settings-${viewport.width}.png`) });
    await page.getByRole('dialog', { name: 'Arena settings', exact: true }).getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'How to play', exact: true }).click();
    await page.getByRole('dialog', { name: 'Snake & Ladder', exact: true }).waitFor({ state: 'visible' });
    result.checks.push('settings and rules dialogs');
    assert.deepEqual(result.pageErrors, [], 'Game should have no uncaught runtime errors');
    assert.ok(await page.locator('canvas').count(), 'Production Three.js canvas should be mounted');
    await context.close();
  }
} catch (error) {
  report.browserError = error.message;
  process.exitCode = 1;
} finally {
  await browser?.close();
  await server?.close();
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ output, ...report }, null, 2));
}
