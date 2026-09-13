import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build } from '../webapp/node_modules/esbuild/lib/main.js';
import { GLTFLoader } from '../webapp/node_modules/three/examples/jsm/loaders/GLTFLoader.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const generated = resolve(root, 'webapp/src/previews/ludo/generated');
await mkdir(generated, { recursive: true });
const source = await readFile(resolve(root, 'webapp/src/pages/Games/LudoBattleRoyal.jsx'), 'utf8');
const between = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));
// Reuse the authored seated body, finger and dice poses from the game.
const rigSource = `// Generated from the live Ludo game.
// @ts-nocheck
import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { setWorldPose } from '../../../games/ludo/characterContact';
const clamp=THREE.MathUtils.clamp, SEATED_HUMAN_MOTION_TUNING={idleBreathAmp:0};
` +
  between('const BASE_ARENA_SCALE','const DEFAULT_PLAYER_COUNT') +
  between('const SEATED_HUMAN_DOWNWARD_CONTACT_MODE_SET','const SEATED_HELPER_FORWARD_DICE_PICKUP') +
  between('function normalizeBoneName(', 'const SEATED_HUMAN_TEXTURE_PROFILES') +
  between('const FRONT_SIDE_Z','function alignSeatedHumanFeetToGroundPlane(') +
  `
export {saveBoneRig,resetBoneRig,applySeatedHumanPose};
export function makePreviewSeat(template,scene,playerIndex): any {
` +
  `const angle=[Math.PI/2,0,Math.PI*1.5,Math.PI][playerIndex];
` +
  `const radius=AI_CHAIR_RADIUS+CHAIR_GLOBAL_PUSHBACK+(playerIndex===0?SELF_BOTTOM_CHAIR_EXTRA_PUSHBACK:0);
` +
  `const group=new THREE.Group();group.position.set(Math.cos(angle)*radius,CHAIR_BASE_HEIGHT,Math.sin(angle)*radius);
` +
  `group.lookAt(new THREE.Vector3(0,CHAIR_BASE_HEIGHT,0));scene.add(group);
` +
  `const chair={group,supportsArmrest:true},entry={};const createSeatedHumanActionHelpers=()=>null;
` +
  between('        const install = template => {','        install(defaultTemplate);') +
  `install(template);entry.applyPose=(mode,grip)=>applySeatedHumanPose(entry.rig,mode,1,grip,{lateral:0,forward:1},{idleBreathAmp:0},true);return entry;
}
`;
await writeFile(resolve(generated, 'rig.ts'), rigSource);

const bytes = await readFile(resolve(root, 'webapp/public/assets/table-tennis/chess-human.glb'));
const jsonSize = bytes.readUInt32LE(12);
const gltf = JSON.parse(bytes.subarray(20, 20 + jsonSize).toString());
// Preserve the actual character mesh and skeleton; omit texture maps and unused
// facial morph targets so the in-chat scene fits the inline size limit.
delete gltf.images; delete gltf.textures; delete gltf.samplers; delete gltf.animations;
for (const mesh of gltf.meshes || []) {
  delete mesh.weights;
  for (const primitive of mesh.primitives) delete primitive.targets;
}
for (const node of gltf.nodes || []) delete node.weights;
for (const material of gltf.materials || []) {
  delete material.normalTexture; delete material.occlusionTexture; delete material.emissiveTexture;
  delete material.extensions;
  if (material.pbrMetallicRoughness) {
    delete material.pbrMetallicRoughness.baseColorTexture;
    delete material.pbrMetallicRoughness.metallicRoughnessTexture;
  }
}
const binary = bytes.subarray(28 + jsonSize);
let json = Buffer.from(JSON.stringify(gltf));
json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
const header = Buffer.alloc(20);
header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4);
header.writeUInt32LE(28 + json.length + binary.length, 8);
header.writeUInt32LE(json.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
const binHeader = Buffer.alloc(8);
binHeader.writeUInt32LE(binary.length); binHeader.writeUInt32LE(0x004e4942, 4);
const packed = Buffer.concat([header, json, binHeader, binary]);
const model = await new GLTFLoader().parseAsync(packed.buffer.slice(packed.byteOffset, packed.byteOffset + packed.byteLength), '');
model.scene.traverse(object => {
  if (!object.isMesh) return;
  object.castShadow = true; object.receiveShadow = true; object.frustumCulled = false;
  const name = (object.name + ' ' + object.material.name).toLowerCase();
  const mat = object.material;
  if (/skin|body|head/.test(name)) mat.color.set('#c99d7d');
  if (/shirt|outfit|top/.test(name)) mat.color.set('#395b68');
  if (/pants|bottom/.test(name)) mat.color.set('#353e46');
  if (/hat|shoe|hair/.test(name)) mat.color.set('#574033');
  mat.roughness = .78;
});
const objectJson = JSON.stringify(model.scene.toJSON());
await writeFile(resolve(generated, 'avatar.json'), objectJson);
const modelData = gzipSync(objectJson).toString('base64');
const result = await build({
  entryPoints: [resolve(root, 'webapp/src/previews/ludo/LudoMotionPreview.tsx')],
  bundle: true, format: 'esm', platform: 'browser', jsx: 'automatic', minify: true,
  target: 'es2022', write: false, define: { LUDO_PREVIEW_MODEL: JSON.stringify(modelData) },
  plugins: [{ name: 'cdn', setup(api) {
    api.onResolve({ filter: /^(three|react|react-dom)(\/.*)?$/ }, args => {
      if (args.path.startsWith('three/')) return;
      if (args.path === 'three') return { path: 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js', external: true };
      if (args.path === 'react-dom/client') return { path: 'https://esm.sh/react-dom@18.3.1/client?deps=react@18.3.1', external: true };
      if (args.path === 'react/jsx-runtime') return { path: 'https://esm.sh/react@18.3.1/jsx-runtime', external: true };
      if (args.path === 'react') return { path: 'https://esm.sh/react@18.3.1', external: true };
    });
  } }]
});
const html = (await readFile(resolve(root, 'scripts/ludo-motion-preview.fragment.html'), 'utf8'))
  .replace('/* LUDO_PREVIEW */', () => result.outputFiles[0].text);
if (Buffer.byteLength(html) > 1_000_000) throw new Error('Preview exceeds inline size limit.');
const output = process.argv[2] || '/workspace/ludo-live-interactions.html';
await writeFile(output, html);
await writeFile(resolve(generated, 'bundle.js'), result.outputFiles[0].text);
console.log(`Built ${output} (${Buffer.byteLength(html)} bytes)`);
