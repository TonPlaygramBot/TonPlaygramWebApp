import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build } from '../webapp/node_modules/esbuild/lib/main.js';
import { BufferAttribute } from '../webapp/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../webapp/node_modules/three/examples/jsm/loaders/GLTFLoader.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const generated = resolve(root, 'webapp/src/previews/snake/generated');
await mkdir(generated, { recursive: true });
const files = {
  avatar: 'pool-royale/readyplayer.me.glb',
  polyAssaultRifle01Attack: 'tirana-streets/imported/polyAssaultRifle01Attack.glb',
  polyPistol01Attack: 'tirana-streets/imported/polyPistol01Attack.glb',
  polyShotgun01Attack: 'tirana-streets/imported/polyShotgun01Attack.glb'
};
const assets = {};
for (const [id, file] of Object.entries(files)) {
  const bytes = await readFile(resolve(root, 'webapp/public/assets', file));
  const jsonSize = bytes.readUInt32LE(12), gltf = JSON.parse(bytes.subarray(20, 20 + jsonSize).toString());
  // Same authored meshes and skeleton; omit maps and facial morphs only for the
  // bandwidth-limited in-chat review. Production keeps the original materials.
  delete gltf.images; delete gltf.textures; delete gltf.samplers; delete gltf.animations;
  for (const mesh of gltf.meshes || []) { delete mesh.weights; for (const p of mesh.primitives) delete p.targets; }
  for (const node of gltf.nodes || []) delete node.weights;
  for (const mat of gltf.materials || []) {
    delete mat.normalTexture; delete mat.occlusionTexture; delete mat.emissiveTexture; delete mat.extensions;
    if (mat.pbrMetallicRoughness) { delete mat.pbrMetallicRoughness.baseColorTexture; delete mat.pbrMetallicRoughness.metallicRoughnessTexture; }
  }
  const binary = bytes.subarray(28 + jsonSize);
  let json = Buffer.from(JSON.stringify(gltf)); json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
  const header = Buffer.alloc(20); header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + json.length + binary.length, 8); header.writeUInt32LE(json.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(binary.length); bh.writeUInt32LE(0x004e4942, 4);
  const packed = Buffer.concat([header, json, bh, binary]);
  const model = (await new GLTFLoader().parseAsync(packed.buffer.slice(packed.byteOffset, packed.byteOffset + packed.byteLength), '')).scene;
  model.traverse(object => { if (!object.isMesh) return; object.frustumCulled = false; object.geometry.deleteAttribute('uv'); object.geometry.deleteAttribute('uv1');
    for (const [name, attribute] of Object.entries(object.geometry.attributes)) {
      if (!attribute.isInterleavedBufferAttribute) continue;
      const array = name === 'skinIndex' ? new Uint16Array(attribute.count * attribute.itemSize) : new Float32Array(attribute.count * attribute.itemSize);
      for (let i = 0; i < attribute.count; i++) for (let c = 0; c < attribute.itemSize; c++) array[i * attribute.itemSize + c] = attribute.getComponent(i, c);
      object.geometry.setAttribute(name, new BufferAttribute(array, attribute.itemSize));
    }
    const mats = Array.isArray(object.material) ? object.material : [object.material];
    for (const mat of mats) { const name = (object.name + ' ' + mat.name).toLowerCase();
      if (id === 'avatar') {
        if (/skin|body|head/.test(name)) mat.color.set('#c99d7d');
        if (/shirt|outfit|top/.test(name)) mat.color.set('#395b68');
        if (/pants|bottom/.test(name)) mat.color.set('#353e46');
        if (/hat|shoe|hair/.test(name)) mat.color.set('#574033');
      }
      mat.roughness = 0.7;
    }
  });
  assets[id] = JSON.parse(JSON.stringify(model.toJSON(), (_, value) => typeof value === 'number' && !Number.isInteger(value) ? Number(value.toFixed(5)) : value));
}
await writeFile(resolve(generated, 'assets.json'), JSON.stringify(assets));
const packedAssets = gzipSync(JSON.stringify(assets)).toString('base64');
const result = await build({ entryPoints: [resolve(root, 'webapp/src/previews/snake/SnakeInteractionPreview.tsx')],
  bundle: true, format: 'esm', platform: 'browser', jsx: 'automatic', minify: true, target: 'es2022', write: false,
  define: { SNAKE_PREVIEW_ASSETS: JSON.stringify(packedAssets) },
  plugins: [{ name: 'cdn', setup(api) { api.onResolve({ filter: /^(three|react|react-dom)(\/.*)?$/ }, args => {
    if (args.path === 'three') return { path: 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js', external: true };
    if (args.path === 'react-dom/client') return { path: 'https://esm.sh/react-dom@18.3.1/client?deps=react@18.3.1', external: true };
    if (args.path === 'react/jsx-runtime') return { path: 'https://esm.sh/react@18.3.1/jsx-runtime', external: true };
    if (args.path === 'react') return { path: 'https://esm.sh/react@18.3.1', external: true };
  }); } }]
});
const html = (await readFile(resolve(root, 'scripts/snake-interaction-preview.fragment.html'), 'utf8')).replace('/* SNAKE_PREVIEW */', () => result.outputFiles[0].text);
if (Buffer.byteLength(html) > 1000000) throw new Error('Preview exceeds inline size limit: ' + Buffer.byteLength(html));
const output = process.argv[2] || '/workspace/snake-human-grip.html';
await writeFile(output, html);
console.log(`Built ${output} (${Buffer.byteLength(html)} bytes)`);
