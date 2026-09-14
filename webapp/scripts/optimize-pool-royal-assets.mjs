import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const folder = new URL(
  '../public/models/pool-royale/showood-seven-foot/',
  import.meta.url
);
const input = new URL('seven_foot_showood.glb', folder);
const output = new URL('showood-4k.glb', folder);
const source = await readFile(input);
if (source.readUInt32LE(0) !== 0x46546c67)
  throw new Error('Expected glTF 2 binary');
const jsonLength = source.readUInt32LE(12);
const gltf = JSON.parse(source.subarray(20, 20 + jsonLength));
const binary = source.subarray(28 + jsonLength);
function geometryDigest(document, buffer) {
  const hash = createHash('sha256');
  for (const node of document.nodes) {
    if (node.mesh == null || node.name === 'diamonds') continue;
    hash.update(
      JSON.stringify([
        node.name,
        node.matrix,
        node.translation,
        node.rotation,
        node.scale
      ])
    );
    for (const primitive of document.meshes[node.mesh].primitives) {
      for (const [name, index] of Object.entries({
        ...primitive.attributes,
        INDICES: primitive.indices
      })) {
        if (index == null) continue;
        const accessor = document.accessors[index],
          view = document.bufferViews[accessor.bufferView];
        hash.update(
          JSON.stringify([
            name,
            accessor.componentType,
            accessor.count,
            accessor.type,
            accessor.byteOffset,
            view.byteStride
          ])
        );
        hash.update(
          buffer.subarray(
            view.byteOffset ?? 0,
            (view.byteOffset ?? 0) + view.byteLength
          )
        );
      }
    }
  }
  return hash.digest('hex');
}
const sourceGeometrySha256 = geometryDigest(gltf, binary);
const removed = [];
// These dense markers are already hidden by the game and replaced by its
// selectable rail markers. Delete their buffers as well as their scene nodes.
gltf.nodes.forEach((node) => {
  if (node.name === 'diamonds') {
    removed.push(node.name);
    delete node.mesh;
  }
});
const prune = (key, refs) => {
  const used = [...new Set(refs.map((r) => r.object[r.key]))].sort(
    (a, b) => a - b
  );
  const map = new Map(used.map((old, i) => [old, i]));
  gltf[key] = used.map((i) => gltf[key][i]);
  refs.forEach((r) => {
    r.object[r.key] = map.get(r.object[r.key]);
  });
};
prune(
  'meshes',
  gltf.nodes
    .filter((n) => n.mesh != null)
    .map((object) => ({ object, key: 'mesh' }))
);
const primitives = gltf.meshes.flatMap((m) => m.primitives);
prune(
  'materials',
  primitives
    .filter((p) => p.material != null)
    .map((object) => ({ object, key: 'material' }))
);
// Cloth is replaced by the chosen 4K finish at runtime. Do not download/decode
// its unused embedded colour image before the replacement can be assigned.
for (const mat of gltf.materials)
  if (mat.name === 'cloth') delete mat.pbrMetallicRoughness.baseColorTexture;
const textureRefs = [];
const visit = (object) => {
  for (const [key, value] of Object.entries(object ?? {})) {
    if (key.endsWith('Texture') && value?.index != null)
      textureRefs.push({ object: value, key: 'index' });
    else if (value && typeof value === 'object') visit(value);
  }
};
gltf.materials.forEach(visit);
prune('textures', textureRefs);
prune(
  'images',
  gltf.textures.map((object) => ({ object, key: 'source' }))
);
const accessorRefs = [];
for (const p of primitives) {
  for (const key of Object.keys(p.attributes))
    accessorRefs.push({ object: p.attributes, key });
  if (p.indices != null) accessorRefs.push({ object: p, key: 'indices' });
}
prune('accessors', accessorRefs);
prune(
  'bufferViews',
  [...gltf.accessors.filter((a) => a.bufferView != null), ...gltf.images].map(
    (object) => ({ object, key: 'bufferView' })
  )
);
const images = new Map(gltf.images.map((i) => [i.bufferView, i]));
const chunks = [];
const imageReport = [];
let length = 0;
for (let i = 0; i < gltf.bufferViews.length; i++) {
  const view = gltf.bufferViews[i];
  let bytes = binary.subarray(
    view.byteOffset ?? 0,
    (view.byteOffset ?? 0) + view.byteLength
  );
  const image = images.get(i);
  if (image) {
    const metadata = await sharp(bytes).metadata();
    // Never upscale the source 1K images: the selectable surface pack supplies 4K.
    bytes = await sharp(bytes)
      .resize({
        width: 4096,
        height: 4096,
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 86, mozjpeg: true })
      .toBuffer();
    image.mimeType = 'image/jpeg';
    imageReport.push({
      name: image.name,
      width: Math.min(metadata.width, 4096),
      height: Math.min(metadata.height, 4096),
      bytes: bytes.length
    });
  }
  view.byteOffset = length;
  view.byteLength = bytes.length;
  chunks.push(bytes);
  length += bytes.length;
  const pad = (4 - (length % 4)) % 4;
  if (pad) {
    chunks.push(Buffer.alloc(pad));
    length += pad;
  }
}
gltf.buffers = [{ byteLength: length }];
gltf.asset.extras = {
  ...(gltf.asset.extras ?? {}),
  source: 'ekiefl/pooltool',
  revision: 'da37d9a4cc507c9dba59ffbf3dc4ec77f57c5d55',
  textureLimit: 4096
};
let json = Buffer.from(JSON.stringify(gltf));
json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 32)]);
const header = Buffer.alloc(20);
header.writeUInt32LE(0x46546c67);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(28 + json.length + length, 8);
header.writeUInt32LE(json.length, 12);
header.writeUInt32LE(0x4e4f534a, 16);
const binHeader = Buffer.alloc(8);
binHeader.writeUInt32LE(length);
binHeader.writeUInt32LE(0x004e4942, 4);
const result = Buffer.concat([header, json, binHeader, ...chunks]);
const geometrySha256 = geometryDigest(gltf, Buffer.concat(chunks));
if (geometrySha256 !== sourceGeometrySha256)
  throw new Error('Optimization changed retained geometry or UV buffers');
await mkdir(folder, { recursive: true });
await writeFile(output, result);
const report = {
  sourceBytes: source.length,
  optimizedBytes: result.length,
  savedPercent: Math.round((1 - result.length / source.length) * 100),
  sourceSha256: createHash('sha256').update(source).digest('hex'),
  sha256: createHash('sha256').update(result).digest('hex'),
  sourceGeometrySha256,
  geometrySha256,
  removed,
  textureLimit: 4096,
  images: imageReport
};
await writeFile(
  new URL('asset-report.json', folder),
  JSON.stringify(report, null, 2) + '\n'
);
console.log(fileURLToPath(output), report);
