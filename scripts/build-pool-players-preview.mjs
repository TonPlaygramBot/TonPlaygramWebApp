import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';
import { readPoolRoyalMetrics } from './read-pool-royal-metrics.mjs';
import sharp from '../webapp/node_modules/sharp/lib/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = process.argv[2] || '/workspace/pool-showood-precision.html';
const source = await readFile(resolve(root, 'webapp/public/assets/pool-royale/readyplayer.me.glb'));
const jsonLength = source.readUInt32LE(12);
const gltf = JSON.parse(source.subarray(20, 20 + jsonLength).toString());
const binary = source.subarray(28 + jsonLength);
const images = new Map(gltf.images.map(image => [image.bufferView, image]));
const chunks = [];
let offset = 0;
// The inline preview preserves the skeleton, bind matrices and topology. Avatar
// attributes are rounded below visible precision; production assets are untouched.
const rounded = new Set();
for (const mesh of gltf.meshes) for (const primitive of mesh.primitives) {
  for (const [semantic, accessorIndex] of Object.entries(primitive.attributes)) {
    if (rounded.has(accessorIndex) || semantic.startsWith('JOINTS')) continue;
    rounded.add(accessorIndex);
    const accessor = gltf.accessors[accessorIndex];
    if (accessor.componentType !== 5126) continue;
    const view = gltf.bufferViews[accessor.bufferView];
    const width = { VEC2: 2, VEC3: 3, VEC4: 4 }[accessor.type];
    const stride = view.byteStride || width * 4;
    const precision = /NORMAL|TANGENT/.test(semantic) ? 1e2 : 1e4;
    for (let i = 0; i < accessor.count; i++) for (let component = 0; component < width; component++) {
      const at = (view.byteOffset || 0) + (accessor.byteOffset || 0) + i * stride + component * 4;
      binary.writeFloatLE(Math.round(binary.readFloatLE(at) * precision) / precision, at);
    }
  }
}
// Facial blend shapes are unused by the billiards pose solver. Prune their
// buffers, retaining every body vertex, bone and original skin influence.
const usedAccessors = new Set();
for (const mesh of gltf.meshes) {
  delete mesh.weights;
  if (mesh.extras) delete mesh.extras.targetNames;
  for (const primitive of mesh.primitives) {
    delete primitive.targets;
    Object.values(primitive.attributes).forEach(index => usedAccessors.add(index));
    if (Number.isInteger(primitive.indices)) usedAccessors.add(primitive.indices);
  }
}
for (const node of gltf.nodes) delete node.weights;
for (const skin of gltf.skins || []) if (Number.isInteger(skin.inverseBindMatrices)) usedAccessors.add(skin.inverseBindMatrices);
if (gltf.animations?.length) throw new Error('Preview pruning needs explicit animation accessor support.');
const avatarAccessorMap = new Map();
gltf.accessors = gltf.accessors.filter((accessor, index) => {
  if (!usedAccessors.has(index)) return false;
  avatarAccessorMap.set(index, avatarAccessorMap.size); return true;
});
for (const mesh of gltf.meshes) for (const primitive of mesh.primitives) {
  for (const semantic of Object.keys(primitive.attributes)) primitive.attributes[semantic] = avatarAccessorMap.get(primitive.attributes[semantic]);
  if (Number.isInteger(primitive.indices)) primitive.indices = avatarAccessorMap.get(primitive.indices);
}
for (const skin of gltf.skins || []) if (Number.isInteger(skin.inverseBindMatrices)) skin.inverseBindMatrices = avatarAccessorMap.get(skin.inverseBindMatrices);
const usedViews = new Set([...gltf.accessors.map(accessor => accessor.bufferView), ...images.keys()]);
const avatarViewMap = new Map();
for (let i = 0; i < gltf.bufferViews.length; i++) {
  if (!usedViews.has(i)) continue;
  avatarViewMap.set(i, avatarViewMap.size);
  const view = gltf.bufferViews[i];
  let bytes = binary.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
  const image = images.get(i);
  if (image) bytes = await sharp(bytes).resize({ width: 48, height: 48, fit: 'inside', withoutEnlargement: true })
    .toFormat(image.mimeType === 'image/png' ? 'png' : 'jpeg', { quality: 72 }).toBuffer();
  view.byteOffset = offset; view.byteLength = bytes.length;
  chunks.push(bytes); offset += bytes.length;
  const padding = (4 - offset % 4) % 4;
  if (padding) { chunks.push(Buffer.alloc(padding)); offset += padding; }
}
gltf.bufferViews = gltf.bufferViews.filter((_, index) => usedViews.has(index));
for (const accessor of gltf.accessors) accessor.bufferView = avatarViewMap.get(accessor.bufferView);
for (const image of gltf.images) image.bufferView = avatarViewMap.get(image.bufferView);
gltf.buffers[0].byteLength = offset;
let json = Buffer.from(JSON.stringify(gltf));
json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
const header = Buffer.alloc(20);
header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
header.writeUInt32LE(28 + json.length + offset, 8);
header.writeUInt32LE(json.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
const binaryHeader = Buffer.alloc(8);
binaryHeader.writeUInt32LE(offset, 0); binaryHeader.writeUInt32LE(0x004e4942, 4);
const model = gzipSync(Buffer.concat([header, json, binaryHeader, ...chunks]), { level: 9 }).toString('base64');
// Include the actual Showood mesh with its exact positions and transforms. Only
// texture/UV data and decorative sight-marker meshes are omitted from this view.
const tablePath = process.argv[3] || resolve(root, 'webapp/public/models/pool-royale/showood-seven-foot/seven_foot_showood.glb');
const tableSource = await readFile(tablePath);
const tableJsonLength = tableSource.readUInt32LE(12);
const tableGltf = JSON.parse(tableSource.subarray(20, 20 + tableJsonLength).toString());
const tableBinary = tableSource.subarray(28 + tableJsonLength);
const tableChunks = [], tableViews = [], tableAccessors = [], accessorMap = new Map();
let tableOffset = 0;
const copyAccessor = index => {
  if (accessorMap.has(index)) return accessorMap.get(index);
  const accessor = tableGltf.accessors[index], view = tableGltf.bufferViews[accessor.bufferView];
  if (view.byteStride || accessor.sparse) throw new Error('Unexpected interleaved/sparse Showood geometry.');
  const bytes = tableBinary.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
  const mapped = tableAccessors.length;
  tableAccessors.push({ ...accessor, bufferView: tableViews.length });
  tableViews.push({ buffer: 0, byteOffset: tableOffset, byteLength: bytes.length });
  tableChunks.push(bytes); tableOffset += bytes.length;
  const padding = (4 - tableOffset % 4) % 4;
  if (padding) { tableChunks.push(Buffer.alloc(padding)); tableOffset += padding; }
  accessorMap.set(index, mapped); return mapped;
};
const sourceNodes = tableGltf.nodes;
tableGltf.nodes = sourceNodes.filter(node => !/diamonds|shadow|bevel/.test(node.name || '')).map(node => ({ ...node }));
const sourceMeshes = tableGltf.meshes;
tableGltf.meshes = tableGltf.nodes.map(node => {
  const mesh = sourceMeshes[node.mesh]; node.mesh = tableGltf.nodes.indexOf(node);
  return { ...mesh, primitives: mesh.primitives.map(primitive => ({
    attributes: { POSITION: copyAccessor(primitive.attributes.POSITION) },
    indices: copyAccessor(primitive.indices), material: primitive.material
  })) };
});
tableGltf.scenes = [{ nodes: tableGltf.nodes.map((_, index) => index) }];
tableGltf.scene = 0;
tableGltf.materials = tableGltf.materials.map(material => ({ name: material.name, doubleSided: true,
  pbrMetallicRoughness: { metallicFactor: 0, roughnessFactor: 0.76 } }));
delete tableGltf.images; delete tableGltf.textures; delete tableGltf.samplers;
tableGltf.accessors = tableAccessors; tableGltf.bufferViews = tableViews;
tableGltf.buffers = [{ byteLength: tableOffset }];
let tableJson = Buffer.from(JSON.stringify(tableGltf));
tableJson = Buffer.concat([tableJson, Buffer.alloc((4 - tableJson.length % 4) % 4, 32)]);
const tableHeader = Buffer.from(header);
tableHeader.writeUInt32LE(28 + tableJson.length + tableOffset, 8); tableHeader.writeUInt32LE(tableJson.length, 12);
const tableBinaryHeader = Buffer.from(binaryHeader); tableBinaryHeader.writeUInt32LE(tableOffset, 0);
const tableModel = gzipSync(Buffer.concat([tableHeader, tableJson, tableBinaryHeader, ...tableChunks]), { level: 9 }).toString('base64');
const result = await build({
  entryPoints: [resolve(root, 'webapp/src/previews/PoolRoyalPlayersPreview.tsx')],
  bundle: true, format: 'esm', platform: 'browser', jsx: 'automatic', minify: true,
  target: 'es2022', write: false,
  define: { POOL_PREVIEW_MODEL: JSON.stringify(model), POOL_PREVIEW_SHOWOOD: JSON.stringify(tableModel), POOL_PREVIEW_TABLE: JSON.stringify(await readPoolRoyalMetrics()) },
  plugins: [{ name: 'inline-cdn-imports', setup(api) {
    api.onResolve({ filter: /^(three|react|react-dom)(\/.*)?$/ }, args => {
      if (args.path === 'three') return { path: 'https://cdn.jsdelivr.net/npm/three@0.164.0/build/three.module.js', external: true };
      if (args.path.startsWith('three/')) return undefined;
      if (args.path === 'react-dom/client') return { path: 'https://esm.sh/react-dom@18.3.1/client?deps=react@18.3.1', external: true };
      return { path: `https://esm.sh/${args.path.replace('react', 'react@18.3.1')}`, external: true };
    });
  } }]
});
const fragment = (await readFile(resolve(root, 'scripts/pool-players-preview.fragment.html'), 'utf8'))
  .replace('/* POOL_PLAYERS_PREVIEW */', () => result.outputFiles[0].text);
if (Buffer.byteLength(fragment) > 1_000_000) throw new Error(`Inline preview exceeds 1 MB (${Buffer.byteLength(fragment)} bytes, avatar ${model.length}, table ${tableModel.length}).`);
await writeFile(output, fragment);
console.log(`Character preview written: ${output} (${Buffer.byteLength(fragment)} bytes)`);
