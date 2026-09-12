// CPU scene review for environments where browser navigation is unavailable.
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { createCanvas, loadImage } = require(
  process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
    ? process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES + '/@napi-rs/canvas'
    : '@napi-rs/canvas'
);
const output = process.argv[2] || '/tmp/table-tennis-scene-review';
await mkdir(output, { recursive: true });
const makeCanvas = () => {
  const canvas = createCanvas(390, 750),
    getContext = canvas.getContext.bind(canvas);
  canvas.style = {};
  canvas.setAttribute = () => {};
  canvas.addEventListener = () => {};
  canvas.removeEventListener = () => {};
  canvas.remove = () => {};
  canvas.getContext = (type, ...args) =>
    type === '2d' ? getContext(type, ...args) : null;
  return canvas;
};
globalThis.document = {
  createElement: makeCanvas,
  createElementNS: makeCanvas
};
globalThis.self = globalThis;
globalThis.createImageBitmap = async (blob) =>
  loadImage(Buffer.from(await blob.arrayBuffer()));
globalThis.window = { devicePixelRatio: 1 };
globalThis.ResizeObserver = class {
  observe() {}
  disconnect() {}
};
const base = path.resolve('webapp/src/games/tabletennis');
const code = await build({
  stdin: {
    contents: `export { TableTennisRenderer } from './render'; export { createMatch } from './engine'; export * as THREE from 'three';`,
    resolveDir: base,
    loader: 'ts'
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  plugins: [
    {
      name: 'packed-characters',
      setup(b) {
        b.onLoad({ filter: /tabletennis\/render\.ts$/ }, async ({ path }) => ({
          loader: 'ts',
          contents: (await readFile(path, 'utf8')).replace(
            '        } catch {',
            '        } catch (error) { console.error(String(error));'
          )
        }));
        b.onResolve({ filter: /^\.\/assetLoader$/ }, () => ({
          path: base + '/preview/assetLoader.ts'
        }));
      }
    }
  ]
});
const { TableTennisRenderer, createMatch, THREE } = await import(
  'data:text/javascript;base64,' +
    Buffer.from(code.outputFiles[0].text).toString('base64')
);
const host = { clientWidth: 390, clientHeight: 750, appendChild() {} };
const renderer = new TableTennisRenderer(host, console.log);
await renderer.appearance('dancingHall', ['athlete-male', 'athlete-female']);
const results = [];
for (const width of [320, 390, 480]) {
  host.clientWidth = width;
  renderer.renderer.setSize(width, 750);
  const s = createMatch({ ai: false, firstServer: 0 });
  renderer.renderer.last = 0;
  renderer.draw(s, 0, true);
  await writeFile(
    path.join(output, `portrait-${width}.png`),
    renderer.renderer.domElement.toBuffer('image/png')
  );
  const project = (v) =>
    renderer.stage
      .localToWorld(new THREE.Vector3(...v))
      .project(renderer.camera)
      .toArray();
  results.push({
    width,
    camera: renderer.camera.position.toArray(),
    tableFarCorners: [
      project([-0.7625, 0.76, -1.37]),
      project([0.7625, 0.76, -1.37])
    ],
    net: [project([-0.915, 0.915, 0]), project([0.915, 0.915, 0])],
    armTriangles: renderer.actors.map((a) =>
      a.parts.reduce((total, p) => total + (p.arms?.index?.count || 0) / 3, 0)
    ),
    grips: renderer.actors.map((a) =>
      renderer.stage
        .worldToLocal(
          a.rig.bones.rightHand.getWorldPosition(new THREE.Vector3())
        )
        .distanceTo(a.paddle.position)
    )
  });
}
await writeFile(
  path.join(output, 'geometry.json'),
  JSON.stringify(results, null, 2)
);
renderer.dispose();
console.log(JSON.stringify({ output, results }));
