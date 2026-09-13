import { build } from '../webapp/node_modules/esbuild/lib/main.js';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const outfile = resolve(root, 'scripts/snake-review/frames.mjs');
await build({ entryPoints: [resolve(root, 'scripts/snake-review/frames.ts')], bundle: true,
  platform: 'node', format: 'esm', outfile, nodePaths: [resolve(root, 'webapp/node_modules')], logLevel: 'warning' });
await import(pathToFileURL(outfile).href);
