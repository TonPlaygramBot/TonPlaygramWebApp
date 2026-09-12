import { readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';
import sharp from '../webapp/node_modules/sharp/lib/index.js';
const root = new URL('../', import.meta.url);
const files = {
  adrian: 'table-tennis/athlete-male',
  maya: 'table-tennis/athlete-female',
  alley: 'royal-lanes/models/royal-alley',
  pin: 'royal-lanes/models/distant-pin'
};
const models = {};
for (const [name, path] of Object.entries(files)) {
  const data = await readFile(
    new URL(`webapp/public/assets/${path}.glb`, root)
  );
  const n = data.readUInt32LE(12),
    g = JSON.parse(data.subarray(20, 20 + n)),
    bin = data.subarray(28 + n);
  // Preview-only mantissa quantization; preserve topology, joints, weights and bind matrices.
  const seen = new Set();
  for (const mesh of g.meshes || [])
    for (const primitive of mesh.primitives)
      for (const [semantic, id] of Object.entries(primitive.attributes || {})) {
        if (
          !/^(POSITION|NORMAL|TANGENT|TEXCOORD)/.test(semantic) ||
          seen.has(id)
        )
          continue;
        seen.add(id);
        const a = g.accessors[id];
        if (a.componentType !== 5126 || a.bufferView === undefined) continue;
        const v = g.bufferViews[a.bufferView],
          count = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type],
          stride = v.byteStride || count * 4;
        for (let i = 0; i < a.count; i++)
          for (let c = 0; c < count; c++) {
            const at =
              (v.byteOffset || 0) + (a.byteOffset || 0) + i * stride + c * 4;
            bin.writeUInt32LE((bin.readUInt32LE(at) & 0xfffff000) >>> 0, at);
          }
      }
  const images = new Map((g.images || []).map((i) => [i.bufferView, i]));
  const chunks = [];
  let offset = 0;
  for (let i = 0; i < g.bufferViews.length; i++) {
    const v = g.bufferViews[i];
    let bytes = bin.subarray(
      v.byteOffset || 0,
      (v.byteOffset || 0) + v.byteLength
    );
    const image = images.get(i);
    if (image)
      bytes = await sharp(bytes)
        .resize({
          width: 128,
          height: 128,
          fit: 'inside',
          withoutEnlargement: true
        })
        .toFormat(image.mimeType === 'image/png' ? 'png' : 'jpeg', {
          quality: 76
        })
        .toBuffer();
    v.byteOffset = offset;
    v.byteLength = bytes.length;
    chunks.push(bytes);
    offset += bytes.length;
    const pad = (4 - (offset % 4)) % 4;
    if (pad) {
      chunks.push(Buffer.alloc(pad));
      offset += pad;
    }
  }
  g.buffers[0].byteLength = offset;
  let json = Buffer.from(JSON.stringify(g));
  json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 32)]);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + json.length + offset, 8);
  header.writeUInt32LE(json.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  const bh = Buffer.alloc(8);
  bh.writeUInt32LE(offset);
  bh.writeUInt32LE(0x004e4942, 4);
  models[name] = gzipSync(
    Buffer.concat([header, json, bh, ...chunks])
  ).toString('base64');
  console.log(name, models[name].length);
}
const result = await build({
  entryPoints: [
    new URL('webapp/src/previews/RoyalLanesBowlerPreview.tsx', root).pathname
  ],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  jsx: 'automatic',
  minify: true,
  target: 'es2022',
  write: false,
  define: { ROYAL_MODELS: JSON.stringify(models) },
  plugins: [
    {
      name: 'cdn',
      setup(api) {
        api.onResolve(
          { filter: /^(three|react|react-dom|cannon-es)(\/.*)?$/ },
          (args) => {
            if (args.path === 'three')
              return {
                path: 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js',
                external: true
              };
            if (args.path.startsWith('three/')) return undefined;
            if (args.path === 'cannon-es')
              return {
                path: 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js',
                external: true
              };
            if (args.path === 'react-dom/client')
              return {
                path: 'https://esm.sh/react-dom@18.3.1/client?deps=react@18.3.1',
                external: true
              };
            return {
              path: `https://esm.sh/${args.path.replace('react', 'react@18.3.1')}`,
              external: true
            };
          }
        );
      }
    }
  ]
});
const fragment = (
  await readFile(
    new URL('scripts/royal-lanes-preview.fragment.html', root),
    'utf8'
  )
).replace('/* ROYAL_LANES_PREVIEW */', () => result.outputFiles[0].text);
if (Buffer.byteLength(fragment) > 1_000_000)
  throw Error(`Preview exceeds 1 MB: ${Buffer.byteLength(fragment)}`);
const output = process.argv[2] || '/workspace/royal-lanes-bowlers.html';
await writeFile(output, fragment);
console.log(`${output}: ${Buffer.byteLength(fragment)} bytes`);
