import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build } from '../webapp/node_modules/esbuild/lib/main.js';
import { parse } from '../webapp/node_modules/@babel/parser/lib/index.js';
import { arenaHarness } from '../test/fixtures/murlanArenaHarness.mjs';
import sharp from '../webapp/node_modules/sharp/lib/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = process.argv[2] || '/workspace/murlan-card-review.html';
const source = await readFile(resolve(root, 'webapp/public/assets/pool-royale/readyplayer.me.glb'));
const jsonLength = source.readUInt32LE(12);
const gltf = JSON.parse(source.subarray(20, 20 + jsonLength).toString());
const binary = source.subarray(28 + jsonLength);
const images = new Map(gltf.images.map(image => [image.bufferView, image]));
const chunks = [];
let offset = 0;
// The inline preview keeps the exact mesh, skeleton and bind matrices. Only
// texture resolution is reduced; the production GLB remains byte-for-byte original.
for (let i = 0; i < gltf.bufferViews.length; i++) {
  const view = gltf.bufferViews[i];
  let bytes = binary.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
  const image = images.get(i);
  if (image) bytes = await sharp(bytes).resize({ width: 256, height: 256, fit: 'inside', withoutEnlargement: true })
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
const arenaSource = await readFile(resolve(root, 'webapp/src/pages/Games/MurlanRoyaleArena.jsx'), 'utf8');
const ast = parse(arenaSource, { sourceType:'module', plugins:['jsx'] }).program;
const names = ['findBoneByHints','captureBoneRotation','applyRotationOffset','createCharacterRig','runCharacterAction','updateCharacterCardContacts','queueCharacterActionAnimation','buildPoseVariant','applyRigActionPoseLerp','applyRigActionPoseBetween','lerpBoneToPose'];
const constants = ['MODEL_SCALE','CARD_H','CARD_W','CHARACTER_ACTION_BONE_KEYS'];
const {context,load}=arenaHarness(); constants.forEach(load);
const extracted = `import * as THREE from 'three';\nimport {createCardContactRig,saveCardContactRest,poseCardHand,restoreCardHand,pinCardToHand,cardContactPoint,sampleCardTransfer,smoothCardMotion,CARD_PICKUP_REACH_MS,CARD_CARRY_MS,CARD_RELEASE_MS,CARD_RECOVER_MS} from './webapp/src/games/murlan/cardContact.ts';\nimport {beginCardPlay,stepCardPlay} from './webapp/src/games/murlan/cardMotion.ts';\nconst HUMAN_CARD_HAND_DEBUG_HELPERS=false;\n` +
 constants.map(name=>`const ${name}=${JSON.stringify(context[name])};`).join('\n')+'\n'+
 ast.body.filter(node=>node.type==='FunctionDeclaration'&&names.includes(node.id.name)).map(node=>arenaSource.slice(node.start,node.end)).join('\n')+
 '\nexport {createCharacterRig,runCharacterAction,updateCharacterCardContacts,CARD_H,CARD_W};';
const result = await build({
  entryPoints: [resolve(root, 'webapp/src/previews/MurlanCardPreview.tsx')],
  bundle: true, format: 'esm', platform: 'browser', jsx: 'automatic', minify: true,
  target: 'es2022', write: false,
  define: { MURLAN_PREVIEW_MODEL: JSON.stringify(model) },
  plugins: [{name:'production-murlan-rig',setup(api){api.onResolve({filter:/^#murlan-preview-rig$/},()=>({path:'rig',namespace:'murlan-rig'}));api.onLoad({filter:/.*/,namespace:'murlan-rig'},()=>({contents:extracted,loader:'js',resolveDir:root}));}},{ name: 'inline-cdn-imports', setup(api) {
    api.onResolve({ filter: /^(three|react|react-dom)(\/.*)?$/ }, args => {
      if (args.path === 'three') return { path: 'https://cdn.jsdelivr.net/npm/three@0.164.0/build/three.module.js', external: true };
      if (args.path.startsWith('three/')) return undefined;
      if (args.path === 'react-dom/client') return { path: 'https://esm.sh/react-dom@18.3.1/client?deps=react@18.3.1', external: true };
      return { path: `https://esm.sh/${args.path.replace('react', 'react@18.3.1')}`, external: true };
    });
  } }]
});
const fragment = (await readFile(resolve(root, 'scripts/murlan-card-preview.fragment.html'), 'utf8'))
  .replace('/* MURLAN_CARD_PREVIEW */', () => result.outputFiles[0].text);
if (Buffer.byteLength(fragment) > 1_000_000) throw new Error('Inline preview exceeds 1 MB.');
await writeFile(output, fragment);
console.log(`Character preview written: ${output} (${Buffer.byteLength(fragment)} bytes)`);
