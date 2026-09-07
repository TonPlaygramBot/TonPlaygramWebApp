import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const base = path.join(root, 'webapp/src/games/tennis');
const urls = {
  react: 'https://esm.sh/react@18.3.1',
  'react/jsx-runtime': 'https://esm.sh/react@18.3.1/jsx-runtime',
  'react-dom/client':
    'https://esm.sh/react-dom@18.3.1/client?deps=react@18.3.1',
  three: 'https://cdn.jsdelivr.net/npm/three@0.164.0/build/three.module.js'
};
// The app already includes reduced versions of the same CC0 meshes for chat.
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
        builder.onResolve(
          { filter: /^(react|react\/jsx-runtime|react-dom\/client|three)$/ },
          (args) => ({ path: urls[args.path], external: true })
        );
        builder.onResolve({ filter: /^\.\/assetLoader$/ }, (args) =>
          args.importer === path.join(base, 'render.ts')
            ? { path: 'athletes', namespace: 'embedded' }
            : null
        );
        builder.onLoad({ filter: /.*/, namespace: 'embedded' }, () => ({
          contents: `import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
          const models = ${JSON.stringify(models)};
          export async function loadAthlete(seat) {
            const bytes = Uint8Array.from(atob(models[seat]), c => c.charCodeAt(0));
            const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
            return new GLTFLoader().parseAsync(await new Response(stream).arrayBuffer(), '').then(g => g.scene);
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
