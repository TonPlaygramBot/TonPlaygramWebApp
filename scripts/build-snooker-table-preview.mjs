import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build } from '../webapp/node_modules/esbuild/lib/main.js';
import { readSnookerViewMetrics } from './read-snooker-view-metrics.mjs';
import sharp from '../webapp/node_modules/sharp/lib/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = process.argv[2] || '/workspace/snooker-table-review.html';
const source = await readFile(resolve(root, 'webapp/public/assets/snooker-royal/mesxwi/snooker-table.glb'));
const jsonLength = source.readUInt32LE(12);
const gltf = JSON.parse(source.subarray(20, 20 + jsonLength).toString());
const binary = source.subarray(28 + jsonLength);
const images = new Map(gltf.images.map(image => [image.bufferView, image]));
const colorImages = new Set(gltf.materials.flatMap(material => {
  const texture = material.pbrMetallicRoughness?.baseColorTexture?.index;
  return texture == null ? [] : [gltf.textures[texture].source];
}));
const colorViews = new Set([...colorImages].map(index => gltf.images[index].bufferView));
const positionAccessors = new Set(gltf.meshes.flatMap(mesh => mesh.primitives.map(p => p.attributes.POSITION)));
const uvAccessors = new Set(gltf.meshes.flatMap(mesh => mesh.primitives.map(p => p.attributes.TEXCOORD_0)));
const chunks = [];
let offset = 0;
// The inline preview keeps the prepared table geometry and reduces textures only.
for (let i = 0; i < gltf.bufferViews.length; i++) {
  const view = gltf.bufferViews[i];
  let bytes = binary.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
  const image = images.get(i);
  if (!image) {
    bytes = Buffer.from(bytes);
    gltf.accessors.forEach((accessor, index) => {
      if (accessor.bufferView !== i || accessor.componentType !== 5126) return;
      const precision = positionAccessors.has(index) ? 100000 : uvAccessors.has(index) ? 10000 : 1000;
      const dimensions = {SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[accessor.type];
      for (let component=0; component<accessor.count*dimensions; component++) {
        const at=(accessor.byteOffset||0)+component*4;
        bytes.writeFloatLE(Math.round(bytes.readFloatLE(at)*precision)/precision,at);
      }
    });
  }
  if (image) bytes = await sharp(bytes).resize({ width: colorViews.has(i) ? 128 : 4, height: colorViews.has(i) ? 128 : 4, fit: 'inside', withoutEnlargement: true })
    .toFormat(image.mimeType === 'image/png' ? 'png' : 'jpeg', { quality: 82 }).toBuffer();
  view.byteOffset = offset; view.byteLength = bytes.length;
  chunks.push(bytes); offset += bytes.length;
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
const result = await build({
  entryPoints: [resolve(root, 'webapp/src/previews/SnookerTablePreview.tsx')],
  bundle: true, format: 'esm', platform: 'browser', jsx: 'automatic', minify: true,
  target: 'es2022', write: false,
  define: { SNOOKER_TABLE_PREVIEW_MODEL: JSON.stringify(model), SNOOKER_TABLE_PREVIEW_METRICS: JSON.stringify(await readSnookerViewMetrics()) },
  plugins: [{ name: 'inline-cdn-imports', setup(api) {
    api.onResolve({ filter: /^(three|react|react-dom)(\/.*)?$/ }, args => {
      if (args.path === 'three') return { path: 'https://cdn.jsdelivr.net/npm/three@0.164.0/build/three.module.js', external: true };
      if (args.path.startsWith('three/')) return undefined;
      if (args.path === 'react-dom/client') return { path: 'https://esm.sh/react-dom@18.3.1/client?deps=react@18.3.1', external: true };
      return { path: `https://esm.sh/${args.path.replace('react', 'react@18.3.1')}`, external: true };
    });
  } }]
});
const fragment = (await readFile(resolve(root, 'scripts/snooker-table-preview.fragment.html'), 'utf8'))
  .replace('/* SNOOKER_TABLE_PREVIEW */', () => result.outputFiles[0].text);
if (Buffer.byteLength(fragment) > 1_000_000) throw new Error(`Inline preview exceeds 1 MB: ${Buffer.byteLength(fragment)} bytes.`);
await writeFile(output, fragment);
console.log(`Table preview written: ${output} (${Buffer.byteLength(fragment)} bytes)`);
