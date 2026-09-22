import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
export async function buildWallUploadWorker() {
return build({
  entryPoints: [
    fileURLToPath(
      new URL('../src/features/flamingo/wallUploadWorker.js', import.meta.url)
    )
  ],
  outfile: fileURLToPath(
    new URL('../public/pwa/wall-upload-worker.js', import.meta.url)
  ),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  minify: true
});
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await buildWallUploadWorker();
