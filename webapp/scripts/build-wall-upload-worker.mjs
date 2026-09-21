import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
await build({
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
