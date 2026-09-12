import { build } from '../webapp/node_modules/esbuild/lib/main.js';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root = fileURLToPath(new URL('..', import.meta.url));
const result = await build({
  absWorkingDir: root,
  entryPoints: ['webapp/src/previews/SnookerShotPreview.tsx'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2020',
  outfile: 'snooker-shot-preview.js',
  write: false,
  define: { 'process.env.NODE_ENV': '"production"' }
});
const script = result.outputFiles.find((file) =>
  file.path.endsWith('.js')
).text;
const css = result.outputFiles.find((file) => file.path.endsWith('.css')).text;
const fragment = `<div id="snooker-shot-preview"></div>\n<style>\n${css}\n</style>\n<script>\n${script.replace(/<\/script/gi, '<\\/script')}\n</script>\n`;
if (Buffer.byteLength(fragment) >= 1_000_000)
  throw new Error('Preview exceeds the inline size budget');
const output = resolve(process.argv[2] || 'snooker-shot-preview.html');
await writeFile(output, fragment);
console.log(`Created ${output} (${Buffer.byteLength(fragment)} bytes)`);
