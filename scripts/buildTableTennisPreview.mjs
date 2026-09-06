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
const fragment =
  '<div id="table-tennis-preview"></div>\n<style>\n' +
  css +
  '\n</style>\n<script type="module">\n' +
  js +
  '\n</script>\n';
if (Buffer.byteLength(fragment) > 1000000) throw Error('Preview exceeds 1 MB');
await writeFile('/workspace/table-tennis-royal.html', fragment);
const wrapper =
  '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Table Tennis Royal</title><style>body{margin:0;background:#0a1e26}#table-tennis-preview{width:390px;max-width:100%;margin:auto}</style></head><body>' +
  fragment +
  '</body></html>';
await writeFile('/workspace/scratch/table-tennis-browser.html', wrapper);
console.log('Preview bytes', Buffer.byteLength(fragment));
