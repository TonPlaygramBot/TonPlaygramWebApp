import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHESS_TOKEN_MODEL_PATH } from '../src/utils/chessTokenModelPath.js';

// Exact CC BY 4.0 A Beautiful Game source from the existing frozen asset inventory.
// Only extract six authored pieces. No geometry or texture encoding is changed.
export const SOURCE_URL = 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/ABeautifulGame/glTF-Binary/ABeautifulGame.glb';
export const SOURCE_SHA256 = 'bd7133b4b322aae97c589b8839dae8155ad2546acb35ae32a127e722a959d007';
export const PIECE_ROOTS = ['Pawn_Body_W1', 'Castle_W1', 'Knight_W1', 'Bishop_W1', 'Queen_W', 'King_W'];

export function extractChessTokenGlb(source) {
  if (createHash('sha256').update(source).digest('hex') !== SOURCE_SHA256) {
    throw new Error('A Beautiful Game source checksum mismatch');
  }
  const jsonLength = source.readUInt32LE(12);
  const binStart = 28 + jsonLength;
  const input = JSON.parse(source.toString('utf8', 20, 20 + jsonLength));
  const out = {
    asset: { ...input.asset }, extensionsUsed: input.extensionsUsed,
    scene: 0, scenes: [], nodes: [], meshes: [], accessors: [],
    materials: [], textures: [], samplers: [], images: [], bufferViews: [], buffers: []
  };
  const maps = new Map();
  const data = [];
  let offset = 0;
  const take = (key, index, transform) => {
    const map = maps.get(key) ?? new Map();
    maps.set(key, map);
    if (map.has(index)) return map.get(index);
    const item = structuredClone(input[key][index]);
    const outputIndex = out[key].length;
    map.set(index, outputIndex);
    out[key].push(item);
    transform?.(item);
    return outputIndex;
  };
  const view = index => take('bufferViews', index, item => {
    const start = binStart + (item.byteOffset || 0);
    const bytes = source.subarray(start, start + item.byteLength);
    const pad = (4 - offset % 4) % 4;
    if (pad) data.push(Buffer.alloc(pad));
    item.byteOffset = offset + pad;
    data.push(bytes);
    offset += pad + bytes.length;
  });
  const accessor = index => take('accessors', index, item => {
    if (item.bufferView !== undefined) item.bufferView = view(item.bufferView);
    if (item.sparse) {
      item.sparse.indices.bufferView = view(item.sparse.indices.bufferView);
      item.sparse.values.bufferView = view(item.sparse.values.bufferView);
    }
  });
  const texture = index => take('textures', index, item => {
    if (item.sampler !== undefined) item.sampler = take('samplers', item.sampler);
    item.source = take('images', item.source, image => { image.bufferView = view(image.bufferView); });
  });
  const remapTextures = object => {
    for (const [key, value] of Object.entries(object)) {
      if (!value || typeof value !== 'object') continue;
      if (key.endsWith('Texture') && Number.isInteger(value.index)) value.index = texture(value.index);
      else remapTextures(value);
    }
  };
  const mesh = index => take('meshes', index, item => {
    for (const primitive of item.primitives) {
      primitive.attributes = Object.fromEntries(Object.entries(primitive.attributes).map(([key, value]) => [key, accessor(value)]));
      if (primitive.indices !== undefined) primitive.indices = accessor(primitive.indices);
      if (primitive.material !== undefined) primitive.material = take('materials', primitive.material, remapTextures);
    }
  });
  const node = index => take('nodes', index, item => {
    if (item.mesh !== undefined) item.mesh = mesh(item.mesh);
    if (item.children) item.children = item.children.map(node);
  });
  out.scenes.push({ nodes: PIECE_ROOTS.map(name => {
    const index = input.scenes[input.scene].nodes.find(i => input.nodes[i].name === name);
    if (index === undefined) throw new Error(`Missing chess piece: ${name}`);
    return node(index);
  }) });

  out.buffers.push({ byteLength: offset });
  const text = Buffer.from(JSON.stringify(out));
  const json = Buffer.concat([text, Buffer.alloc((4 - text.length % 4) % 4, 0x20)]);
  const bin = Buffer.concat([...data, Buffer.alloc((4 - offset % 4) % 4)]);
  const header = Buffer.alloc(12);
  header.write('glTF');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + json.length + bin.length, 8);
  const chunk = (bytes, type) => {
    const prefix = Buffer.alloc(8);
    prefix.writeUInt32LE(bytes.length);
    prefix.write(type, 4);
    return Buffer.concat([prefix, bytes]);
  };
  return Buffer.concat([header, chunk(json, 'JSON'), chunk(bin, 'BIN\0')]);
}

async function build() {
  const publicDir = new URL('../public/', import.meta.url);
  const sourcePath = process.argv[2] ?? (() => {
    throw new Error('Expected local source path from the pinned external asset map');
  })();
  const outputPath = process.argv[3] ?? fileURLToPath(new URL(CHESS_TOKEN_MODEL_PATH.slice(1), publicDir));
  const output = extractChessTokenGlb(await readFile(sourcePath));
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, output);
  console.log(`A Beautiful Game: six original pieces with embedded textures (${output.length} bytes)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (!process.argv[2]) {
    const publicDir = new URL('../public/', import.meta.url);
    const map = JSON.parse(await readFile(new URL('assets/external/url-map.json', publicDir), 'utf8'));
    const local = map[SOURCE_URL];
    if (!local?.startsWith('/assets/external/')) throw new Error('Pinned A Beautiful Game GLB was not vendored');
    process.argv[2] = fileURLToPath(new URL(local.slice(1), publicDir));
  }
  await build();
}
