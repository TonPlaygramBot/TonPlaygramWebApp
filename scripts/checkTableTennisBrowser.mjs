// Real React + Three.js verification. The fixture probe exists only in this test bundle.
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { readFile, writeFile, mkdtemp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = fileURLToPath(new URL('../', import.meta.url));
const base = path.join(root, 'webapp/src/games/tabletennis');
const output =
  process.env.TABLE_TENNIS_BROWSER_OUTPUT_DIR ||
  (await mkdtemp(path.join(tmpdir(), 'table-tennis-browser-')));
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
      name: 'table-tennis-test-probe',
      setup(b) {
        if (process.env.TABLE_TENNIS_PREVIEW_ASSETS === '1') {
          b.onResolve({ filter: /^\.\/assetLoader$/ }, (a) =>
            a.importer.endsWith('/render.ts')
              ? { path: path.join(base, 'preview/assetLoader.ts') }
              : null
          );
        }
        b.onLoad(
          { filter: /\/games\/tabletennis\/Game\.tsx$/ },
          async ({ path }) => {
            const source = await readFile(path, 'utf8'),
              marker = '  const currentTour = TOUR[career.tour],';
            assert.ok(
              source.includes(marker),
              'Update the fixture insertion point after refactoring Game'
            );
            return {
              loader: 'tsx',
              contents: source.replace(
                marker,
                `
        profile = { name: '@portrait_player_with_a_very_long_username', avatar: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="28" height="28"%3E%3Crect width="28" height="28" fill="%23436870"/%3E%3Ccircle cx="14" cy="10" r="5" fill="%23f6c4a0"/%3E%3Cpath d="M4 28a10 10 0 0 1 20 0" fill="%23bce591"/%3E%3C/svg%3E' };
        (globalThis as any).__ttProbe = {
          read: () => ({ state: structuredClone(frame.current), input: structuredClone(input.current),
            visual: renderer.current?.ball.position.toArray(), webgl: renderer.current?.renderer.constructor.name,
            models: renderer.current?.actors.map(a => Boolean(a.model)), skybox: Boolean(renderer.current?.skybox), env: renderer.current?.envId,
            envLoaded: renderer.current?.environment?.uuid, actorModels: renderer.current?.actors.map(a => a.model?.uuid) }),
          fresh: (config: any) => createMatch(config),
          load: (s: MatchState) => { cancelGesture(); frame.current = s; input.current = { ...neutralInput(), autoHit: false };
            room.current = null; active.current = true; pauseRef.current = false; setPaused(false); setAuto(false); setView('match'); setScore({ ...s }); },
          projection: (seat: Seat, ends: boolean, dx: number, dy: number) => {
            const r = renderer.current!, s = createMatch({ ai: false }); s.endsSwapped = ends;
            s.ball.z = (seat === 0 ? 1 : -1) * (ends ? -1 : 1) * 1.2;
            r.draw(s, seat, true); const h = r.shotDirection(dx, dy, s)!;
            const v = r.ball.position.clone(), a = r.stage.localToWorld(v.clone()).project(r.camera);
            v.x += h.x * .001; v.z += h.z * .001;
            const b = r.stage.localToWorld(v).project(r.camera);
            const x = (b.x - a.x) * r.camera.aspect, y = -(b.y - a.y), length = Math.hypot(x, y);
            return { x: x / length, y: y / length };
          }
        };
      ` + marker
              )
            };
          }
        );
      }
    }
  ]
});
await writeFile(
  path.join(output, 'index.html'),
  '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/game.css"><style>body{margin:0;background:#0a1e26}</style></head><body><div id="table-tennis-preview"></div><script type="module" src="/game.js"></script></body></html>'
);
const browser = await chromium.launch({
  executablePath: process.env.TABLE_TENNIS_BROWSER_EXECUTABLE || undefined,
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
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (e) => {
    if (e.type() === 'error') errors.push(e.text());
  });
  await page.clock.install();
  await page.clock.pauseAt(Date.now());
  await page.route('http://table-tennis.test/**', async (route) => {
    const p = new URL(route.request().url()).pathname;
    try {
      const file = p.startsWith('/assets/')
        ? path.join(root, 'webapp/public') + p
        : output + (p === '/' ? '/index.html' : p);
      await route.fulfill({
        body: await readFile(file),
        contentType: p.endsWith('.js')
          ? 'application/javascript'
          : p.endsWith('.css')
            ? 'text/css'
            : p.endsWith('.glb')
              ? 'model/gltf-binary'
              : p.endsWith('.hdr')
                ? 'application/octet-stream'
                : 'text/html'
      });
    } catch {
      await route.fulfill({ status: 404, body: 'Not found' });
    }
  });
  await page.goto('http://table-tennis.test/');
  await page.clock.runFor(320);
  await page.waitForFunction(
    () => __ttProbe?.read().models?.every(Boolean) && __ttProbe.read().skybox
  );
  const load = async (patch) => {
    await page.evaluate((patch) => {
      const s = __ttProbe.fresh({ ai: false, gamesToWin: 1 });
      s.inputs.forEach((i) => (i.autoHit = false));
      Object.assign(s, patch);
      __ttProbe.load(s);
    }, patch || {});
    await page.clock.runFor(20);
  };
  await load();
  assert.match(
    await page.evaluate(() => __ttProbe.read().webgl),
    /WebGLRenderer/
  );
  let projectionCases = 0;
  for (const width of [320, 390, 480]) {
    await page.setViewportSize({ width, height: 844 });
    await page.clock.runFor(32);
    for (const seat of [0, 1])
      for (const ends of [false, true])
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
          [1, 1],
          [-1, 1],
          [1, -1],
          [-1, -1]
        ]) {
          const h = await page.evaluate(
            ({ seat, ends, dx, dy }) =>
              __ttProbe.projection(seat, ends, dx, dy),
            { seat, ends, dx, dy }
          );
          assert.ok(
            (h.x * dx + h.y * dy) / Math.hypot(dx, dy) > 0.99999,
            'Finger heading must stay aligned on screen'
          );
          projectionCases++;
        }
    await load();
    await page.screenshot({ path: path.join(output, `portrait-${width}.png`) });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth
      ),
      false,
      'No horizontal overflow'
    );
    assert.ok(
      await page
        .locator('.tt-avatar img')
        .evaluate((img) => img.complete && img.naturalWidth > 0),
      'Profile avatar loads'
    );
    assert.ok(
      await page
        .locator('.tt-score-player > span:nth-child(2)')
        .first()
        .evaluate(
          (el) =>
            el.scrollWidth > el.clientWidth &&
            getComputedStyle(el).textOverflow === 'ellipsis'
        ),
      'Long username truncates cleanly'
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await load();
  await page.touchscreen.tap(190, 440);
  await page.clock.runFor(32);
  assert.equal(await page.evaluate(() => __ttProbe.read().state.phase), 'toss');
  assert.equal(await page.evaluate(() => __ttProbe.read().input.power), 0.1);
  const swipe = async (ms) => {
    await load();
    await page.mouse.move(190, 520);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) {
      await page.clock.runFor(ms / 8);
      await page.mouse.move(190, 520 - (120 * i) / 8);
    }
    await page.mouse.up();
    await page.clock.runFor(20);
    return page.evaluate(() => __ttProbe.read().input);
  };
  const slow = await swipe(480),
    fast = await swipe(48);
  assert.ok(
    fast.power > slow.power + 0.5,
    'Equal-distance fast swipe has more power'
  );
  assert.ok(
    fast.direction.z < 0,
    'Upward swipe travels towards the opponent; projection checks cover camera yaw'
  );
  await load();
  await page.mouse.move(190, 500);
  await page.mouse.down();
  await page.mouse.move(190, 430);
  await page
    .locator('.tt-scene')
    .dispatchEvent('pointercancel', { pointerId: 1 });
  await page.mouse.up();
  await page.clock.runFor(40);
  assert.equal(
    await page.evaluate(() => __ttProbe.read().state.phase),
    'serve',
    'Cancelled drag must not serve'
  );
  await load();
  await page.mouse.move(190, 500);
  await page.mouse.down();
  await page.getByRole('button', { name: 'Pause', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.mouse.up();
  await page.getByRole('button', { name: 'KEEP PLAYING' }).click();
  await page.clock.runFor(40);
  assert.equal(
    await page.evaluate(() => __ttProbe.read().state.phase),
    'serve',
    'Pause cancels held gesture'
  );
  const bounces = [];
  for (const kind of ['legal', 'out', 'second', 'side'])
    for (const seat of [0, 1]) {
      await page.evaluate(
        ({ kind, seat }) => {
          const s = __ttProbe.fresh({ ai: false, gamesToWin: 1 });
          s.phase = 'rally';
          s.inputs.forEach((i) => (i.autoHit = false));
          const sign = seat === 0 ? 1 : -1;
          Object.assign(s.ball, {
            last: seat,
            serve: false,
            x: kind === 'out' ? 1 : kind === 'side' ? 0.82 : 0,
            y: kind === 'out' ? 0.06 : kind === 'side' ? 0.75 : 0.82,
            z: -sign * 0.7,
            vx: kind === 'side' ? -4 : 0,
            vy: -2,
            vz: -sign * 0.3,
            bounces: kind === 'second' ? 1 : 0
          });
          __ttProbe.load(s);
        },
        { kind, seat }
      );
      await page.clock.runFor(60);
      const r = await page.evaluate(() => __ttProbe.read());
      assert.ok(
        r.visual.every(
          (v, i) =>
            Math.abs(v - [r.state.ball.x, r.state.ball.y, r.state.ball.z][i]) <
            1e-6
        )
      );
      assert.ok(r.state.ball.vy > 0 || kind === 'side');
      assert.equal(r.state.pointCount, kind === 'legal' ? 0 : 1);
      bounces.push({ kind, seat, phase: r.state.phase, vy: r.state.ball.vy });
    }
  await load();
  for (const arena of ['dancingHall', 'colorfulStudio', 'neonPhotostudio']) {
    const previous = await page.evaluate(() => ({
      env: __ttProbe.read().env,
      loaded: __ttProbe.read().envLoaded
    }));
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.getByLabel('Arena', { exact: true }).selectOption(arena);
    if (previous.env !== arena)
      await page.waitForFunction(
        (old) => __ttProbe.read().envLoaded !== old,
        previous.loaded
      );
    await page.getByRole('button', { name: 'KEEP PLAYING' }).click();
    await page.clock.runFor(120);
    await page.screenshot({ path: path.join(output, `arena-${arena}.png`) });
  }
  await load();
  const oldCharacter = await page.evaluate(
    () => __ttProbe.read().actorModels[0]
  );
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page
    .getByLabel('Human player', { exact: true })
    .selectOption('chess-human');
  await page.waitForFunction(
    (old) => __ttProbe.read().actorModels[0] !== old,
    oldCharacter
  );
  await page.getByRole('button', { name: 'KEEP PLAYING' }).click();
  await page.clock.runFor(120);
  await page.screenshot({ path: path.join(output, 'chess-human.png') });
  await page.evaluate(() => {
    const s = __ttProbe.fresh({ ai: false, gamesToWin: 1 });
    s.phase = 'rally';
    s.score.points = [10, 3];
    s.inputs.forEach((i) => (i.autoHit = false));
    Object.assign(s.ball, {
      serve: false,
      last: 0,
      bounces: 1,
      x: 0,
      y: 0.81,
      z: -0.7,
      vx: 0,
      vy: -2,
      vz: 0
    });
    __ttProbe.load(s);
  });
  await page.clock.runFor(160);
  await page.getByRole('button', { name: 'Rematch', exact: true }).click();
  await page.clock.runFor(160);
  assert.equal(await page.evaluate(() => __ttProbe.read().state.pointCount), 0);
  assert.equal(
    await page.evaluate(() => __ttProbe.read().state.phase),
    'serve'
  );
  assert.deepEqual(errors, [], 'No browser errors');
  const result = {
    projectionCases,
    slowPower: slow.power,
    fastPower: fast.power,
    bounces,
    errors
  };
  await writeFile(
    path.join(output, 'results.json'),
    JSON.stringify(result, null, 2)
  );
  console.log(JSON.stringify({ ok: true, output, ...result }));
} finally {
  await browser.close();
}
