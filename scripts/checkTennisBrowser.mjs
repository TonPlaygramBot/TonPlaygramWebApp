// Verify the actual React/Three game with a test-only state probe. No account or live stake is used.
import { build } from 'esbuild';
import { chromium as pw } from 'playwright';
import { readFile, writeFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
const base = path.join(root, 'webapp/src/games/tennis');
const output =
  process.env.TENNIS_BROWSER_OUTPUT_DIR ||
  (await mkdtemp(path.join(tmpdir(), 'tennis-browser-')));
await mkdir(output, { recursive: true });
await build({
  entryPoints: [path.join(base, 'standalone.tsx')],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  outdir: output,
  entryNames: 'game',
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [
    {
      name: 'tennis-test-probe',
      setup(b) {
        b.onLoad({ filter: /\/games\/tennis\/Game\.tsx$/ }, async (args) => {
          const source = await readFile(args.path, 'utf8');
          const marker =
            '  const updateHud = () => setHud(structuredClone(frame.current));';
          assert.ok(
            source.includes(marker),
            'Update the browser probe insertion point after refactoring Game'
          );
          return {
            loader: 'tsx',
            contents: source.replace(
              marker,
              marker +
                `
      (globalThis as any).__tennisProbe = {
        read: () => ({ state: structuredClone(frame.current), visual: renderer.current?.ball.position.toArray(), webgl: renderer.current?.renderer.constructor.name }),
        load: (patch: Partial<MatchState>) => { const s = createMatch({ ai: false }); Object.assign(s, patch); frame.current = s; input.current = neutralInput(); nextSwing.current = 0; updateHud(); },
        fresh: (config: any) => createMatch(config)
      };`
            )
          };
        });
      }
    }
  ]
});
await writeFile(
  path.join(output, 'index.html'),
  `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/game.css"><style>body{margin:0;background:#092730}</style></head><body><div id="tennis-royal-preview"></div><script type="module" src="/game.js"></script></body></html>`
);
const browser = await pw.launch({
  executablePath: process.env.TENNIS_BROWSER_EXECUTABLE || undefined,
  args: [
    '--no-sandbox',
    '--no-zygote',
    '--single-process',
    '--in-process-gpu',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader'
  ],
  headless: true,
  timeout: 15000
});
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true
  });
  await page.clock.install();
  await page.clock.pauseAt(Date.now());
  const errors = [],
    warnings = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (e) => {
    if (e.type() === 'error')
      errors.push({ text: e.text(), location: e.location() });
    if (e.type() === 'warning') warnings.push(e.text());
  });
  page.on('requestfailed', (r) =>
    console.log('REQUEST_FAILED', r.url(), r.failure())
  );
  await page.route('http://tennis.test/**', async (route) => {
    const p = new URL(route.request().url()).pathname;
    const file = p.startsWith('/assets/')
      ? path.join(root, 'webapp/public') + p
      : output + (p === '/' ? '/index.html' : p);
    try {
      await route.fulfill({
        body: await readFile(file),
        contentType: p.endsWith('.js')
          ? 'application/javascript'
          : p.endsWith('.css')
            ? 'text/css'
            : p.endsWith('.glb')
              ? 'model/gltf-binary'
              : 'text/html'
      });
    } catch {
      await route.fulfill({ status: 404, body: 'Not found' });
    }
  });
  await page.goto('http://tennis.test/');
  await page.clock.runFor(320);
  await page.waitForFunction(
    () => !!globalThis.__tennisProbe?.read().webgl,
    null,
    {
      timeout: 20000
    }
  );
  await page
    .getByRole('button', { name: 'Pause match', exact: true })
    .waitFor();
  const info = await page.evaluate(() => ({
    ...__tennisProbe.read(),
    buttons: Array.from(document.querySelectorAll('button')).map(
      (b) => b.getAttribute('aria-label') || b.textContent
    )
  }));
  const traces = [];
  for (const surface of ['hard', 'clay', 'grass'])
    for (const seat of [0, 1])
      for (const kind of ['legal', 'out', 'second', 'fault']) {
        await page.evaluate(
          ({ surface, seat, kind }) => {
            const s = __tennisProbe.fresh({ ai: false, surface });
            s.phase = 'rally';
            s.time = 5;
            s.phaseAt = 4;
            s.rally = 2;
            s.score.server = seat;
            const sign = seat === 0 ? 1 : -1;
            s.players[seat].x = sign * 1.8;
            Object.assign(s.ball, {
              x: kind === 'out' || kind === 'fault' ? 6 : -sign * 1.8,
              z: -sign * (kind === 'fault' ? 3 : 8),
              y: 0.12 + 6 * 0.02 - (14 * 0.02 * 0.02) / 2,
              vx: 0,
              vy: -6 + 14 * 0.02,
              vz: 0,
              bounces: kind === 'second' ? 1 : 0,
              last: seat,
              serve: kind === 'fault'
            });
            __tennisProbe.load(s);
          },
          { surface, seat, kind }
        );
        await page.clock.runFor(48);
        const a = await page.evaluate(() => __tennisProbe.read());
        await page.clock.runFor(128);
        const b = await page.evaluate(() => __tennisProbe.read());
        traces.push({
          surface,
          seat,
          kind,
          phase: a.state.phase,
          initialY: a.visual[1],
          laterY: b.visual[1],
          vy: a.state.ball.vy
        });
        assert.equal(
          a.state.phase,
          kind === 'legal' ? 'rally' : kind === 'fault' ? 'fault' : 'point'
        );
        assert.ok(
          b.visual[1] > a.visual[1] + 0.15,
          `${surface}/${seat}/${kind}: rendered ball did not rebound`
        );
        assert.equal(
          b.state.pointCount,
          kind === 'legal' || kind === 'fault' ? 0 : 1
        );
        assert.ok(Math.abs(b.visual[1] - b.state.ball.y) < 1e-6);
      }
  await writeFile(
    path.join(output, 'bounce-traces.json'),
    JSON.stringify(traces, null, 2)
  );
  const controls = [];
  const fresh = async () => {
    await page.evaluate(() =>
      __tennisProbe.load(__tennisProbe.fresh({ ai: false }))
    );
    await page.clock.runFor(112);
  };
  const read = () => page.evaluate(() => __tennisProbe.read());
  for (const width of [320, 390, 480]) {
    await page.setViewportSize({ width, height: 844 });
    await fresh();
    await page.touchscreen.tap(width * 0.5, 490);
    await page.clock.runFor(784);
    const soft = (await read()).state;
    assert.equal(soft.phase, 'rally');
    assert.equal(soft.inputs[0].power, 0.1);
    const softPace = Math.hypot(soft.ball.vx, soft.ball.vz);
    await fresh();
    await page.mouse.move(width * 0.68, 545);
    await page.mouse.down();
    await page.clock.runFor(16);
    await page.mouse.move(width * 0.59, 490);
    await page.clock.runFor(16);
    await page.mouse.move(width * 0.49, 435);
    await page.clock.runFor(16);
    await page.mouse.up();
    await page.clock.runFor(784);
    const fast = (await read()).state,
      fastPace = Math.hypot(fast.ball.vx, fast.ball.vz);
    assert.equal(fast.phase, 'rally');
    assert.ok(fast.inputs[0].power > 0.8);
    assert.ok(fast.inputs[0].direction.x < 0 && fast.inputs[0].direction.z < 0);
    assert.ok(fastPace > softPace * 1.5);
    const layout = await page.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
      buttons: [...document.querySelectorAll('button')].map((b) => {
        const r = b.getBoundingClientRect();
        return { x: r.x, right: r.right };
      })
    }));
    assert.ok(layout.scroll <= layout.width);
    assert.ok(layout.buttons.every((r) => r.x >= 0 && r.right <= layout.width));
    controls.push({ width, softPace, fastPace, power: fast.inputs[0].power });
  }
  await fresh();
  await page.mouse.move(240, 500);
  await page.mouse.down();
  await page.clock.runFor(32);
  await page.getByRole('button', { name: 'Pause match', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.mouse.up();
  const paused = await read();
  await page.clock.runFor(512);
  assert.equal((await read()).state.time, paused.state.time);
  await page.getByRole('button', { name: 'BACK TO COURT' }).click();
  await page.clock.runFor(192);
  assert.equal((await read()).state.phase, 'serve');
  assert.equal((await read()).state.players[0].queuedInput, null);
  await page.mouse.move(240, 500);
  await page.mouse.down();
  await page.clock.runFor(32);
  await page
    .locator('.tr-court')
    .dispatchEvent('pointercancel', { pointerId: 1 });
  await page.mouse.up();
  await page.clock.runFor(192);
  assert.equal((await read()).state.phase, 'serve');
  await page
    .getByRole('button', {
      name: 'Shot type: flat. Change stroke',
      exact: true
    })
    .click();
  await page
    .getByRole('button', {
      name: 'Shot type: topspin. Change stroke',
      exact: true
    })
    .waitFor();
  await page.evaluate(() => {
    const s = __tennisProbe.fresh({ ai: false });
    s.phase = 'rally';
    s.rally = 2;
    Object.assign(s.ball, {
      x: 4.155,
      z: -8,
      y: 0.14,
      vx: 0,
      vy: -4,
      vz: 0,
      serve: false,
      bounces: 0
    });
    __tennisProbe.load(s);
  });
  await page.clock.runFor(112);
  assert.ok((await read()).state.review);
  await page.screenshot({ path: path.join(output, 'review.png') });
  const point = (await read()).state.pointCount;
  await page.clock.runFor(5400);
  assert.equal((await read()).state.phase, 'serve');
  assert.equal((await read()).state.pointCount, point);
  await page.evaluate(() => {
    const s = __tennisProbe.fresh({ ai: false });
    s.phase = 'rally';
    s.rally = 2;
    s.score.points = [3, 0];
    Object.assign(s.ball, {
      x: 0,
      z: -8,
      y: 0.14,
      vx: 0,
      vy: -4,
      vz: 0,
      serve: false,
      bounces: 1
    });
    __tennisProbe.load(s);
  });
  await page.clock.runFor(112);
  await page.getByRole('button', { name: 'REMATCH', exact: true }).click();
  await page.clock.runFor(192);
  assert.equal((await read()).state.phase, 'serve');
  assert.equal((await read()).state.pointCount, 0);
  console.log(
    JSON.stringify({
      controls,
      pause: 'passed',
      cancel: 'passed',
      stroke: 'passed',
      review: 'passed',
      rematch: 'passed'
    })
  );
  await page.screenshot({ path: path.join(output, 'game.png') });
  console.log(
    JSON.stringify({
      browser: browser.version(),
      phase: info.state.phase,
      renderer: info.webgl,
      visual: info.visual,
      buttons: info.buttons,
      errors,
      warnings: warnings.slice(0, 5)
    })
  );
  console.log(
    JSON.stringify({
      cases: traces.length,
      ascending: traces.filter((t) => t.laterY > t.initialY + 0.15).length
    })
  );
  assert.equal(
    errors.filter(
      (e) => !e.location?.url?.startsWith('https://fonts.googleapis.com/')
    ).length,
    0
  );
} finally {
  await browser.close();
  if (!process.env.TENNIS_BROWSER_OUTPUT_DIR)
    await rm(output, { recursive: true, force: true });
}
