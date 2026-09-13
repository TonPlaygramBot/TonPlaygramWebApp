import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { build } from '../webapp/node_modules/esbuild/lib/main.js';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(
  process.env.SNAKE_PLAYWRIGHT_MODULE || 'playwright-core'
);
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(repo, 'scripts/snake-review/webgl');
await mkdir(out, { recursive: true });
const bundled = await build({
  entryPoints: [repo + '/webapp/src/previews/snake/SnakeTableReview.tsx'],
  bundle: true,
  format: 'esm',
  write: false,
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'error'
});
const browser = await chromium.launch({
  executablePath: process.env.SNAKE_CHROMIUM_PATH,
  args: [
    '--no-sandbox',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader'
  ]
});
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('CONSOLE ERROR', m.text());
  });
  page.on('pageerror', (e) => console.log('ERROR', e.message));
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    try {
      if (url.pathname === '/')
        return route.fulfill({
          contentType: 'text/html',
          body: '<html><body style="margin:0"><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>'
        });
      if (url.pathname === '/bundle.js')
        return route.fulfill({
          contentType: 'text/javascript',
          body: bundled.outputFiles[0].text
        });
      if (url.hostname === 'review.local') {
        const bytes = await readFile(
          repo + '/webapp/public' + decodeURIComponent(url.pathname)
        );
        return route.fulfill({
          body: bytes,
          contentType: url.pathname.endsWith('.gltf')
            ? 'model/gltf+json'
            : url.pathname.endsWith('.jpg')
              ? 'image/jpeg'
              : url.pathname.endsWith('.png')
                ? 'image/png'
                : 'application/octet-stream'
        });
      }
      return route.abort();
    } catch (e) {
      console.log('MISSING', url.href);
      return route.abort();
    }
  });
  await page.goto('http://review.local/');
  const snapshots = {};
  const themes = await page
    .getByLabel('Table')
    .locator('option')
    .evaluateAll((options) => options.map((o) => o.value));
  for (const theme of themes) {
    await page.getByLabel('Table').selectOption(theme);
    await page.waitForFunction(
      (theme) => {
        const r = window.snakeReview;
        return (
          r?.theme === theme &&
          r.arena.getSeatHuman(3) &&
          (theme === 'murlan-default' || r.arena.tableInfo.assetId === theme)
        );
      },
      theme,
      { timeout: 60000 }
    );
    await page.waitForTimeout(750);
    for (const view of (process.env.SNAKE_REVIEW_VIEWS || 'portrait,side,top').split(',')) {
      await page.getByLabel('View').selectOption(view);
      await page.waitForTimeout(350);
      await page.screenshot({ path: out + '/' + theme + '-' + view + '.png' });
    }
    snapshots[theme] = await page.evaluate(() => {
      const { arena, board, THREE } = window.snakeReview;
      const collect = (root, exclude) => {
        const out = [];
        root.updateMatrixWorld(true);
        const visit = (o) => {
          if (o === exclude || !o.visible) return;
          if (o.isMesh && o.geometry?.attributes.position) {
            if (o.isSkinnedMesh) o.skeleton.update();
            const p = [];
            for (let i = 0; i < o.geometry.attributes.position.count; i++)
              p.push(
                ...o
                  .getVertexPosition(i, new THREE.Vector3())
                  .applyMatrix4(o.matrixWorld)
                  .toArray()
              );
            const mat = Array.isArray(o.material) ? o.material[0] : o.material;
            const im = mat?.map?.image;
            out.push({
              p,
              i: o.geometry.index
                ? Array.from(o.geometry.index.array)
                : Array.from({ length: p.length / 3 }, (_, i) => i),
              c: mat?.color?.getHexString() || '777777',
              n: o.name,
              opacity: mat?.opacity ?? 1,
              map: im?.toDataURL && im.width <= 512 ? im.toDataURL() : null
            });
          }
          o.children.forEach(visit);
        };
        visit(root);
        return out;
      };
      return {
        table: collect(arena.tableInfo.group, arena.boardGroup),
        board: collect(arena.boardGroup, null),
        seat: collect(arena.getSeatChair(0).group, null)
      };
    });
    console.log('CHECKED', theme);
  }
  await writeFile(
    repo + '/webapp/src/previews/snake/generated/table-snapshots.json',
    JSON.stringify(snapshots)
  );
} finally {
  await browser.close();
}
