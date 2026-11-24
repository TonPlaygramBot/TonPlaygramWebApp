import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = new URL(process.env.TIRANA_QA_ORIGIN ?? 'http://127.0.0.1:4183');
assert.equal(origin.protocol, 'http:');
assert.equal(origin.hostname, '127.0.0.1');
const browser = await chromium.launch({
  channel: 'chromium', headless: true, chromiumSandbox: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader'],
});
try {
  const ctx = await browser.newContext({
    viewport: {width: 393, height: 852}, deviceScaleFactor: 2,
    isMobile: true, hasTouch: true, serviceWorkers: 'block',
  });
  await ctx.route('**/*', async r => {
    if (new URL(r.request().url()).origin === origin.origin &&
        ['GET','HEAD'].includes(r.request().method())) await r.continue();
    else await r.abort();
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let city = false;
  page.on('response', r => {
    if (r.status() === 200 && new URL(r.url()).pathname === '/assets/tirana-city-game/central-city.json') city = true;
  });
  await page.addInitScript(() => {
    const counts = new WeakMap();
    globalThis.__tiranaDraws = () => {
      const canvas = document.querySelector('.tsc-view canvas');
      return canvas && canvas.width > 0 && canvas.height > 0 && (counts.get(canvas) || 0);
    };
    for (const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']) {
      const proto = globalThis.WebGL2RenderingContext?.prototype;
      if (!proto || !Object.hasOwn(proto,name)) continue;
      const raw = proto[name];
      proto[name] = function(...args) {
        const result = Reflect.apply(raw, this, args);
        const canvas = this.canvas;
        if (canvas instanceof HTMLCanvasElement && !this.isContextLost()) {
          counts.set(canvas, (counts.get(canvas) || 0) + 1);
        }
        return result;
      };
    }
  });
  await page.goto(new URL('/games', origin).href);
  await page.locator('a[href="/games/tiranastreets/lobby"]').first().tap();
  await page.waitForURL(new URL('/games/tiranastreets/lobby', origin).href);
  assert.equal(await page.locator('.tsc-view canvas').count(), 0);
  await page.getByRole('link', {name:'Eksploro Tiranën', exact:true}).click();
  await page.getByRole('button',{name:'Harta',exact:true}).waitFor({timeout:30_000});
  await page.waitForFunction(() => globalThis.__tiranaDraws() > 2, null, { timeout: 30_000 });
  assert(city, 'Central city JSON did not return HTTP 200');
  const gpu = await page.locator('.tsc-view canvas').evaluate(canvas => {
    const gl = canvas.getContext('webgl2');
    if (!gl || gl.isContextLost()) return null;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    return { version:gl.getParameter(gl.VERSION),
      renderer:dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '(not exposed)' };
  });
  assert.match(gpu?.version ?? '', /^WebGL 2/);
  assert.equal(await page.locator('.tsc-play [role=alert]').count(), 0);
  await page.getByRole('button',{name:'Harta',exact:true}).tap();
  await page.getByRole('dialog',{name:'Harta e qytetit'}).waitFor();
  await page.getByRole('button',{name:'Mbylle',exact:true}).tap();
  await page.getByRole('dialog').waitFor({state:'detached'});
  const camera = page.getByRole('button',{name:/Ndrysho kamerën/});
  const before = await camera.getAttribute('aria-label');
  await camera.tap();
  await page.waitForFunction(x => document.querySelector('button[aria-label^="Ndrysho kamerën"]')?.getAttribute('aria-label') !== x, before);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({pass:true,gpu,portrait:[393,852],
    observed:'WebGL2 draw calls after exact central city JSON HTTP 200; touch map and camera controls'}));
} finally {
  await browser.close();
}
