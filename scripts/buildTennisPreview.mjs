import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const base = path.join(root, 'webapp/src/games/tennis');
const three =
  'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';
// Reuse the reduced CC0 meshes already bundled for chat previews.
const packedSource = await readFile(
  path.join(root, 'webapp/src/games/tabletennis/preview/packed.ts'),
  'utf8'
);
const packedJs = ts.transpileModule(packedSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext }
}).outputText;
const { models: packed } = await import(
  'data:text/javascript;base64,' + Buffer.from(packedJs).toString('base64')
);
const models = [packed['athlete-male'], packed['athlete-female']];
const result = await build({
  entryPoints: [path.join(base, 'standalone.tsx')],
  bundle: true,
  write: false,
  minify: true,
  format: 'esm',
  platform: 'browser',
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [
    {
      name: 'conversation-preview',
      setup(builder) {
        builder.onResolve({ filter: /^three$/ }, () => ({
          path: three,
          external: true
        }));
        builder.onResolve({ filter: /^\.\/assetLoader$/ }, (args) =>
          args.importer === path.join(base, 'render.ts')
            ? { path: 'athletes', namespace: 'embedded' }
            : null
        );
        builder.onLoad({ filter: /.*/, namespace: 'embedded' }, () => ({
          contents: `import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
          const models = ${JSON.stringify(models)};
          export const athleteUrl = (seat) => String(seat);
          export async function loadAthlete(url) {
            const bytes = Uint8Array.from(atob(models[Number(url)]), c => c.charCodeAt(0));
            const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
            const { scene } = await new GLTFLoader().parseAsync(await new Response(stream).arrayBuffer(), '');
            return { model: scene, authored: false };
          }`,
          loader: 'js',
          resolveDir: base
        }));
        builder.onResolve({ filter: /\.css$/ }, () => ({
          path: 'css',
          namespace: 'empty'
        }));
        builder.onLoad({ filter: /.*/, namespace: 'empty' }, () => ({
          contents: '',
          loader: 'js'
        }));
      }
    }
  ]
});
const css = await readFile(path.join(base, 'game.css'), 'utf8');
const template = await readFile(
  path.join(root, 'scripts/tennis-preview.fragment.html'),
  'utf8'
);
const fragment = template
  // Callback replacements preserve literal $&/$` sequences in minified code.
  .replace('/* TENNIS_CSS */', () => css)
  .replace('/* TENNIS_JS */', () => result.outputFiles[0].text);
if (Buffer.byteLength(fragment) > 1_000_000)
  throw Error('Preview exceeds 1 MB');
const destination = process.argv[2] || '/workspace/tennis-royal.html';
await writeFile(destination, fragment);
console.log(`Tennis preview: ${Buffer.byteLength(fragment)} bytes`);
