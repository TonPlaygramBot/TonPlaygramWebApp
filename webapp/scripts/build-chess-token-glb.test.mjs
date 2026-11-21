import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { extractChessTokenGlb, PIECE_ROOTS, SOURCE_SHA256, SOURCE_URL } from './build-chess-token-glb.mjs';
import { GAME_PACK_DEFINITIONS } from '../src/pwa/gamePackDefinitions.js';
import { CHESS_TOKEN_MODEL_PATH } from '../src/utils/chessTokenModelPath.js';

const parse = bytes => {
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const length = bytes.readUInt32LE(12);
  const start = 28 + length;
  const json = JSON.parse(bytes.toString('utf8', 20, 20 + length));
  return { json, view: index => {
    const view = json.bufferViews[index];
    return bytes.subarray(start + view.byteOffset, start + view.byteOffset + view.byteLength);
  }};
};
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

test('both games name the same native-local model and the upstream asset is frozen', async () => {
  const lock = JSON.parse(await readFile(new URL('./external-assets/source-lock.json', import.meta.url), 'utf8'));
  assert.equal(lock.sourcePins[SOURCE_URL], SOURCE_SHA256);
  const pack = GAME_PACK_DEFINITIONS.find(entry => entry.id === 'shared-chess-tokens');
  assert.deepEqual(pack.files, [CHESS_TOKEN_MODEL_PATH.slice(1)]);
  assert.equal(pack.keepInNative, true);
  for (const id of ['snake', 'ludobattleroyal']) {
    assert.ok(GAME_PACK_DEFINITIONS.find(entry => entry.id === id).dependencies.includes(pack.id));
  }
  assert.throws(() => extractChessTokenGlb(Buffer.alloc(64)), /checksum/);
});

test('the real Khronos GLB is reduced deterministically without changing geometry or textures', {
  skip: !process.env.ABG_GLTF_ORIGINAL && 'Set ABG_GLTF_ORIGINAL to the pinned original binary'
}, async () => {
  const source = await readFile(process.env.ABG_GLTF_ORIGINAL);
  const output = extractChessTokenGlb(source);
  assert.equal(digest(output), '011861c886f776db76f3f19f344dafbc322842d3548a55e3fc02e20c9b6bcb33');
  const original = parse(source);
  const compact = parse(output);
  const { json } = compact;
  assert.deepEqual(json.scenes[0].nodes.map(index => json.nodes[index].name), PIECE_ROOTS);
  assert.equal(json.nodes.length, 7, 'the seventh node is the original pawn glass top');
  assert.ok(output.length < source.length / 2);
  assert.ok(json.images.length >= 12 && json.images.every(image => !image.uri));
  assert.equal(json.buffers.length, 1);
  assert.ok(!json.buffers[0].uri);
  const originalTextureDigests = new Set(original.json.images.map(image => digest(original.view(image.bufferView))));
  assert.ok(json.images.every(image => originalTextureDigests.has(digest(compact.view(image.bufferView)))));
  const originalMeshes = new Map(original.json.nodes.filter(node => node.mesh !== undefined).map(node => [node.name, original.json.meshes[node.mesh]]));
  for (const node of json.nodes) {
    const originals = originalMeshes.get(node.name).primitives;
    for (const [i, primitive] of json.meshes[node.mesh].primitives.entries()) {
      for (const [semantic, index] of Object.entries(primitive.attributes)) {
        const view = json.accessors[index].bufferView;
        const sourceView = original.json.accessors[originals[i].attributes[semantic]].bufferView;
        assert.equal(digest(compact.view(view)), digest(original.view(sourceView)), `${node.name}: ${semantic}`);
      }
    }
  }
  const top = json.nodes[json.nodes[0].children[0]];
  assert.equal(top.name, 'Pawn_Top_W1');
  const material = json.materials[json.meshes[top.mesh].primitives[0].material];
  assert.ok(material.extensions.KHR_materials_transmission.transmissionFactor > 0);
  assert.ok(material.extensions.KHR_materials_volume);
});
