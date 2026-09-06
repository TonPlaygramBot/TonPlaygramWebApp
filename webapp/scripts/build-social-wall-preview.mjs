import { build } from 'esbuild';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../..', import.meta.url));
const feature = path.join(root, 'webapp/src/features/flamingo');
const output =
  process.argv[2] || path.join(root, 'demo/social-wall-preview.html');
const photo =
  'data:image/webp;base64,' +
  (await readFile(
    path.join(root, 'webapp/public/assets/kart-royale/cover.webp'),
    'base64'
  ));
const result = await build({
  entryPoints: [path.join(feature, 'preview/entry.tsx')],
  bundle: true,
  minify: true,
  write: false,
  format: 'iife',
  platform: 'browser',
  jsx: 'automatic',
  outfile: 'wall-preview.js',
  define: { 'process.env.NODE_ENV': '"production"' },
  inject: [path.join(feature, 'preview/transport.js')],
  plugins: [
    {
      name: 'isolated-wall-preview',
      setup(build) {
        build.onResolve({ filter: /utils\/api\.js$/ }, () => ({
          path: 'preview-api',
          namespace: 'preview'
        }));
        build.onLoad({ filter: /.*/, namespace: 'preview' }, () => ({
          contents: 'export const API_BASE_URL = "";',
          loader: 'js'
        }));
        build.onLoad({ filter: /preview\/transport\.js$/ }, async (args) => ({
          contents: (await readFile(args.path, 'utf8')).replace(
            '__WALL_PREVIEW_PHOTO__',
            photo
          ),
          loader: 'js'
        }));
      }
    }
  ]
});
const css = result.outputFiles.find((file) => file.path.endsWith('.css')).text;
const js = result.outputFiles
  .find((file) => file.path.endsWith('.js'))
  .text.replaceAll('</script', '<\\/script');
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>TonPlayGram social wall preview</title><style>body{margin:0;background:#090b0e}button,a,input,textarea{touch-action:manipulation}svg{vertical-align:middle}.preview-note{padding:10px 16px;text-align:center;font:13px/1.4 system-ui,sans-serif;background:#192132;color:#c7d4ea}.community-wall-page{min-height:0!important}${css}</style></head><body><div class="preview-note">Interactive preview · Posts stay in this preview</div><div id="tonplaygram-wall-preview"></div><script>${js}</script></body></html>`;
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, html);
console.log(`Created ${output} (${Buffer.byteLength(html)} bytes)`);
