import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build } from '../webapp/node_modules/esbuild/lib/main.js';
import sharp from '../webapp/node_modules/sharp/lib/index.js';
import { readMurlanPreviewMetrics } from './read-murlan-preview-metrics.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = process.argv[2] || '/workspace/murlan-royal-hands.html';
const source = await readFile(resolve(root, 'webapp/public/assets/pool-royale/readyplayer.me.glb'));
const jsonLength = source.readUInt32LE(12);
const gltf = JSON.parse(source.subarray(20, 20 + jsonLength).toString());
const binary = source.subarray(28 + jsonLength);
const images = new Map(gltf.images.map(image => [image.bufferView, image]));
const chunks = [];
let offset = 0;
// Keep exact production vertices, weights, bind matrices and skeleton. Smaller
// embedded texture images make this inspection fragment fit the inline limit.
for (let index = 0; index < gltf.bufferViews.length; index++) {
  const view = gltf.bufferViews[index];
  let bytes = binary.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
  const image = images.get(index);
  if (image) bytes = await sharp(bytes).resize({ width: 224, height: 224, fit: 'inside', withoutEnlargement: true })
    .toFormat(image.mimeType === 'image/png' ? 'png' : 'jpeg', { quality: 82 }).toBuffer();
  view.byteOffset = offset; view.byteLength = bytes.length; chunks.push(bytes); offset += bytes.length;
  const padding = (4 - offset % 4) % 4;
  if (padding) { chunks.push(Buffer.alloc(padding)); offset += padding; }
}
gltf.buffers[0].byteLength = offset;
let json = Buffer.from(JSON.stringify(gltf));
json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
const header = Buffer.alloc(20);
header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
header.writeUInt32LE(28 + json.length + offset, 8);
header.writeUInt32LE(json.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
const binaryHeader = Buffer.alloc(8);
binaryHeader.writeUInt32LE(offset, 0); binaryHeader.writeUInt32LE(0x004e4942, 4);
const model = gzipSync(Buffer.concat([header, json, binaryHeader, ...chunks])).toString('base64');
const knock = (await readFile(resolve(root, 'webapp/public/assets/sounds/murlan-table-knock.mp3'))).toString('base64');
const metrics = await readMurlanPreviewMetrics();
const packedMetrics = JSON.stringify(metrics, (_key, value) =>
  typeof value === 'number' ? Number(value.toFixed(6)) : value);
const result = await build({
  entryPoints: [resolve(root, 'webapp/src/previews/MurlanHandsPreview.tsx')],
  bundle: true, format: 'esm', platform: 'browser', jsx: 'automatic', minify: true,
  target: 'es2022', write: false,
  define: { MURLAN_PREVIEW_MODEL: JSON.stringify(model), MURLAN_PREVIEW_KNOCK: JSON.stringify(knock),
    MURLAN_PREVIEW_METRICS: JSON.stringify(gzipSync(Buffer.from(packedMetrics)).toString('base64')) },
  plugins: [{ name: 'inline-cdn-imports', setup(api) {
    api.onResolve({ filter: /^(three|react|react-dom)(\/.*)?$/ }, args => {
      if (args.path === 'three') return { path: 'https://cdn.jsdelivr.net/npm/three@0.164.0/build/three.module.js', external: true };
      if (args.path.startsWith('three/')) return undefined;
      if (args.path === 'react-dom/client') return { path: 'https://esm.sh/react-dom@18.3.1/client?deps=react@18.3.1', external: true };
      return { path: `https://esm.sh/${args.path.replace('react', 'react@18.3.1')}`, external: true };
    });
  } }]
});
const fragment = (await readFile(resolve(root, 'scripts/murlan-hands-preview.fragment.html'), 'utf8'))
  .replace('/* MURLAN_HANDS_PREVIEW */', () => result.outputFiles[0].text);
if (Buffer.byteLength(fragment) > 1_000_000) throw new Error('Inline preview exceeds 1 MB.');
await writeFile(output, fragment);
const saved = await readFile(output, 'utf8');
if (!saved.startsWith('<div id="murlan-royal-hands-preview">') || saved.includes('/* MURLAN_HANDS_PREVIEW */')) {
  throw new Error('Generated motion preview did not pass read-back validation.');
}
console.log(`Murlan motion preview written: ${output} (${Buffer.byteLength(saved)} bytes)`);
