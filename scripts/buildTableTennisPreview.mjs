import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const base = path.resolve('webapp/src/games/tabletennis');
const urls = {
  react: 'https://esm.sh/react@18.3.1',
  'react/jsx-runtime': 'https://esm.sh/react@18.3.1/jsx-runtime',
  'react-dom': 'https://esm.sh/react-dom@18.3.1?deps=react@18.3.1',
  'react-dom/client':
    'https://esm.sh/react-dom@18.3.1/client?deps=react@18.3.1',
  three: 'https://cdn.jsdelivr.net/npm/three@0.164.0/build/three.module.js'
};
const r = await build({
  entryPoints: [base + '/standalone.tsx'],
  bundle: true,
  write: false,
  minify: true,
  format: 'esm',
  platform: 'browser',
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [
    {
      name: 'preview',
      setup(b) {
        b.onResolve(
          {
            filter:
              /^(react|react\/jsx-runtime|react-dom|react-dom\/client|three)$/
          },
          (a) => ({ path: urls[a.path], external: true })
        );
        b.onResolve({ filter: /^\.\/assetLoader$/ }, (a) =>
          a.importer.endsWith('/render.ts')
            ? { path: base + '/preview/assetLoader.ts' }
            : null
        );
        b.onResolve({ filter: /\.css$/ }, () => ({
          path: 'empty',
          namespace: 'css-empty'
        }));
        b.onLoad({ filter: /.*/, namespace: 'css-empty' }, () => ({
          contents: '',
          loader: 'js'
        }));
      }
    }
  ]
});
const css = await readFile(base + '/game.css', 'utf8'),
  js = r.outputFiles[0].text;
const template = await readFile(base + '/preview/fragment.html', 'utf8');
const fragment = template
  .replace('/* TABLE_TENNIS_CSS */', () => css)
  .replace('/* TABLE_TENNIS_JS */', () => js);
if (Buffer.byteLength(fragment) > 1000000) throw Error('Preview exceeds 1 MB');
const output = process.argv[2] || '/workspace/table-tennis-broadcast.html';
await writeFile(output, fragment);
console.log('Preview', output, 'bytes', Buffer.byteLength(fragment));
