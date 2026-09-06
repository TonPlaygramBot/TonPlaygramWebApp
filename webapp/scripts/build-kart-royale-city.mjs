// Offline conversion of the CC0 Quaternius Downtown City MegaKit selection.
// Usage: node scripts/build-kart-royale-city.mjs /path/to/source/city /path/to/asphalt
// Source URLs, pinned source hashes and licensing: kart-royale-sources.json.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import sharp from 'sharp';
import { MeshoptSimplifier } from 'meshoptimizer';

const source = process.argv[2];
const asphalt = process.argv[3];
if (!source || !asphalt)
  throw new Error(
    'Provide city and asphalt source directories. See docs/kart-royale.md.'
  );
const out = fileURLToPath(
  new URL('../public/assets/kart-royale/', import.meta.url)
);
await mkdir(out, { recursive: true });
await MeshoptSimplifier.ready;
const doc = {
  asset: {
    version: '2.0',
    generator: 'TonPlaygram CC0 city conversion',
    copyright: 'Quaternius — CC0 1.0. See ATTRIBUTION.md.'
  },
  scene: 0,
  scenes: [{ nodes: [] }],
  nodes: [],
  meshes: [],
  materials: [],
  textures: [],
  images: [],
  samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }],
  accessors: [],
  bufferViews: [],
  buffers: [{ byteLength: 0 }]
};
const chunks = [],
  textureCache = new Map(),
  materialCache = new Map();
let size = 0;
function bufferView(bytes) {
  const data = Buffer.from(
    bytes.buffer || bytes,
    bytes.byteOffset || 0,
    bytes.byteLength
  );
  const index = doc.bufferViews.length;
  doc.bufferViews.push({
    buffer: 0,
    byteOffset: size,
    byteLength: data.length
  });
  const padding = (4 - (data.length % 4)) % 4;
  chunks.push(data, Buffer.alloc(padding));
  size += data.length + padding;
  return index;
}
function accessor(data, type, bounds = false) {
  const n = type === 'VEC3' ? 3 : type === 'VEC2' ? 2 : 1;
  const a = {
    bufferView: bufferView(data),
    componentType: data instanceof Float32Array ? 5126 : 5125,
    count: data.length / n,
    type
  };
  if (bounds) {
    a.min = Array(n).fill(Infinity);
    a.max = Array(n).fill(-Infinity);
    for (let i = 0; i < data.length; i++) {
      a.min[i % n] = Math.min(a.min[i % n], data[i]);
      a.max[i % n] = Math.max(a.max[i % n], data[i]);
    }
  }
  doc.accessors.push(a);
  return doc.accessors.length - 1;
}
function readAccessor(gltf, bin, id) {
  const a = gltf.accessors[id],
    v = gltf.bufferViews[a.bufferView];
  const width = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
  const bytes = a.componentType === 5123 ? 2 : 4;
  const result =
    a.componentType === 5126
      ? new Float32Array(a.count * width)
      : new Uint32Array(a.count * width);
  for (let i = 0; i < a.count; i++)
    for (let j = 0; j < width; j++) {
      const offset =
        (v.byteOffset || 0) +
        (a.byteOffset || 0) +
        i * (v.byteStride || bytes * width) +
        j * bytes;
      result[i * width + j] =
        a.componentType === 5126
          ? bin.readFloatLE(offset)
          : bytes === 2
            ? bin.readUInt16LE(offset)
            : bin.readUInt32LE(offset);
    }
  return result;
}
async function texture(gltf, info) {
  if (!info) return undefined;
  const image = gltf.images[gltf.textures[info.index].source];
  if (!textureCache.has(image.uri)) {
    // 1K brick detail close to the camera; shared 512px trim/normal maps elsewhere.
    const resolution = /RedBrick_BaseColor/.test(image.uri) ? 1024 : 512;
    const jpg = await sharp(join(source, image.uri))
      .resize(resolution, resolution)
      .jpeg({
        quality: /Normal|ORM/.test(image.uri) ? 94 : 86,
        chromaSubsampling: '4:4:4'
      })
      .toBuffer();
    const imageId = doc.images.length;
    doc.images.push({
      name: image.name,
      mimeType: 'image/jpeg',
      bufferView: bufferView(jpg)
    });
    const textureId = doc.textures.length;
    doc.textures.push({ sampler: 0, source: imageId });
    textureCache.set(image.uri, textureId);
  }
  return { ...info, index: textureCache.get(image.uri) };
}
async function material(gltf, id) {
  const original = gltf.materials[id],
    name = original.name;
  if (materialCache.has(name)) return materialCache.get(name);
  let m;
  if (name === 'MI_Glass') {
    // Exterior-only racing scene: opaque reflective glazing avoids transparent
    // sorting/overdraw across instanced blocks; interiors are not loaded.
    m = {
      name: 'city_glass',
      pbrMetallicRoughness: {
        baseColorFactor: [0.09, 0.16, 0.19, 1],
        metallicFactor: 0.72,
        roughnessFactor: 0.24
      }
    };
  } else {
    const p = original.pbrMetallicRoughness || {};
    m = {
      name,
      doubleSided: false,
      normalTexture: await texture(gltf, original.normalTexture),
      pbrMetallicRoughness: {
        ...p,
        baseColorTexture: await texture(gltf, p.baseColorTexture),
        metallicRoughnessTexture: await texture(
          gltf,
          p.metallicRoughnessTexture
        )
      }
    };
  }
  const index = doc.materials.length;
  doc.materials.push(m);
  materialCache.set(name, index);
  return index;
}
const report = [];
for (const [file, name] of [
  ['Building_Small_1', 'brick_block'],
  ['Building_Medium_2_001', 'corner_block']
]) {
  const gltf = JSON.parse(await readFile(join(source, file + '.gltf'), 'utf8'));
  const bin = await readFile(join(source, gltf.buffers[0].uri));
  const retained = gltf.meshes[0].primitives.filter(
    (p) => !/Interior|FakeInterior/.test(gltf.materials[p.material].name)
  );
  const bounds = {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity]
  };
  for (const p of retained) {
    const a = gltf.accessors[p.attributes.POSITION];
    for (let i = 0; i < 3; i++) {
      bounds.min[i] = Math.min(bounds.min[i], a.min[i]);
      bounds.max[i] = Math.max(bounds.max[i], a.max[i]);
    }
  }
  const center = [
    (bounds.min[0] + bounds.max[0]) / 2,
    bounds.min[1],
    (bounds.min[2] + bounds.max[2]) / 2
  ];
  for (const lod of [false, true]) {
    const primitives = [];
    let tris = 0;
    for (const p of retained) {
      const positions = readAccessor(gltf, bin, p.attributes.POSITION);
      const normals = readAccessor(gltf, bin, p.attributes.NORMAL);
      const uv = readAccessor(gltf, bin, p.attributes.TEXCOORD_0);
      let indices = readAccessor(gltf, bin, p.indices);
      for (let i = 0; i < positions.length; i++) positions[i] -= center[i % 3];
      // Preserve hard edges/UV seams while reducing ornamental detail at distance.
      if (indices.length > 600) {
        const attrs = new Float32Array((positions.length / 3) * 5);
        for (let i = 0; i < positions.length / 3; i++)
          attrs.set(
            [...normals.slice(i * 3, i * 3 + 3), ...uv.slice(i * 2, i * 2 + 2)],
            i * 5
          );
        [indices] = MeshoptSimplifier.simplifyWithAttributes(
          indices,
          positions,
          3,
          attrs,
          5,
          [0.15, 0.15, 0.15, 0.5, 0.5],
          null,
          Math.floor((indices.length * (lod ? 0.16 : 0.65)) / 3) * 3,
          lod ? 0.06 : 0.001,
          lod ? ['Permissive'] : ['LockBorder']
        );
      }
      // Only keep referenced vertices, dropping unused UV/vertex-shader channels.
      const used = [...new Set(indices)],
        remap = new Map(used.map((v, i) => [v, i]));
      const compact = (data, width) =>
        new Float32Array(
          used.flatMap((i) =>
            Array.from(data.slice(i * width, i * width + width))
          )
        );
      primitives.push({
        attributes: {
          POSITION: accessor(compact(positions, 3), 'VEC3', true),
          NORMAL: accessor(compact(normals, 3), 'VEC3'),
          TEXCOORD_0: accessor(compact(uv, 2), 'VEC2')
        },
        indices: accessor(
          new Uint32Array(Array.from(indices, (i) => remap.get(i))),
          'SCALAR'
        ),
        material: await material(gltf, p.material)
      });
      tris += indices.length / 3;
    }
    const nodeName = name + (lod ? '_lod' : '');
    doc.scenes[0].nodes.push(doc.nodes.length);
    doc.nodes.push({
      name: nodeName,
      mesh: doc.meshes.length,
      extras: {
        source: file,
        lod,
        size: bounds.max.map((v, i) => v - bounds.min[i])
      }
    });
    doc.meshes.push({ name: nodeName, primitives });
    report.push({
      name: nodeName,
      triangles: tris,
      size: bounds.max.map((v, i) => +(v - bounds.min[i]).toFixed(2))
    });
  }
}
doc.buffers[0].byteLength = size;
let json = Buffer.from(JSON.stringify(doc));
json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 32)]);
const bin = Buffer.concat(chunks),
  header = Buffer.alloc(20),
  binHeader = Buffer.alloc(8);
header.write('glTF');
header.writeUInt32LE(2, 4);
header.writeUInt32LE(28 + json.length + bin.length, 8);
header.writeUInt32LE(json.length, 12);
header.write('JSON', 16);
binHeader.writeUInt32LE(bin.length);
binHeader.write('BIN\0', 4);
const result = Buffer.concat([header, json, binHeader, bin]);
await writeFile(join(out, 'city.glb'), result);
for (const type of ['diff', 'nor_gl', 'rough']) {
  await sharp(join(asphalt, `asphalt_${type}.jpg`))
    .resize(1024, 1024)
    .jpeg({ quality: type === 'diff' ? 85 : 94, chromaSubsampling: '4:4:4' })
    .toFile(join(out, `asphalt-${type}.jpg`));
}
console.log(
  JSON.stringify(
    { bytes: result.length, textures: doc.images.length, models: report },
    null,
    2
  )
);
