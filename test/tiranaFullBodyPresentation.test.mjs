import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import {normalizePlayableHuman,humanoidBones,hideAuthoredPlayerWeapon} from '../webapp/src/games/tiranastreets/street-career/humanoidRig.mjs';
const webapp = fileURLToPath(new URL('../webapp/', import.meta.url)),
  require = createRequire(join(webapp, 'package.json'));
const { build } = require('esbuild'),
  { JSDOM } = require('jsdom'),
  T = await import(
    pathToFileURL(join(webapp, 'node_modules/three/build/three.module.js'))
  );
const dir = mkdtempSync(join(webapp, '.career-test-'));
process.on('exit', () => rmSync(dir, { recursive: true, force: true }));
after(() => rmSync(dir, { recursive: true, force: true }));
const bundle = async (name) => {
  const out = join(dir, name + '.mjs');
  await build({
    entryPoints: [
      join(webapp, 'src/games/tiranastreets/street-career/' + name + '.ts')
    ],
    outfile: out,
    bundle: true,
    platform: 'node',
    format: 'esm',
    external: ['three', 'three/*'],
    logLevel: 'silent'
  });
  return import(pathToFileURL(out));
};

const { GLTFLoader } = await import(
  pathToFileURL(require.resolve('three/examples/jsm/loaders/GLTFLoader.js'))
);
const { clone } = await import(
  pathToFileURL(require.resolve('three/examples/jsm/utils/SkeletonUtils.js'))
);
const dom = new JSDOM('<!doctype html><div></div>', {
  url: 'http://localhost'
});
for (const key of [
  'window',
  'document',
  'HTMLInputElement',
  'HTMLSelectElement',
  'HTMLTextAreaElement',
  'KeyboardEvent'
])
  globalThis[key] = dom.window[key];
globalThis.ProgressEvent = class {
  constructor(type, init) {
    this.type = type;
    Object.assign(this, init);
  }
};
const source = readFileSync(
    join(webapp, 'public/assets/tirana-streets/living/human.glb')
  ),
  length = source.readUInt32LE(12),
  json = JSON.parse(source.subarray(20, 20 + length));
// Read the real skin, skeleton and clips. Texture decoding requires WebGL/browser
// and is deliberately NOT part of these numeric rig tests.
const bin = source.subarray(28 + length);
json.buffers[0].uri =
  'data:application/octet-stream;base64,' + bin.toString('base64');
delete json.images;
delete json.textures;
delete json.materials;
for (const m of json.meshes) for (const p of m.primitives) delete p.material;
const gltf = await new GLTFLoader().parseAsync(JSON.stringify(json), '');
const makeActor = () => {
  const model = clone(gltf.scene),
    root = new T.Group();
  root.add(model);
  model.updateMatrixWorld(true);
  let box = new T.Box3().setFromObject(model),
    c = box.getCenter(new T.Vector3()),
    scale = 1.78 / (box.max.y - box.min.y);
  model.scale.setScalar(scale);
  model.position.set(-c.x * scale, -box.min.y * scale, -c.z * scale);
  const mixer = new T.AnimationMixer(root),
    actor = { group: root, mixer, model: 'character', wheels: [] };
  for (const key of ['idle', 'walk', 'run'])
    actor[key] = mixer.clipAction(
      gltf.animations.find((c) => c.name.toLowerCase() === key)
    );
  return actor;
};
const { createBody } = await import(
  '../webapp/src/games/tiranastreets/street-career/playerCore.mjs'
);

test('mapped window storeys and batched facade normals remain correct on elevated ground',async()=>{
 const out=join(dir,'building-windows.mjs');await build({entryPoints:[join(webapp,'src/games/tirana-neighbourhood/MappedBuildingCells.ts')],outfile:out,bundle:true,platform:'node',format:'esm',external:['three','three/*'],logLevel:'silent'});
 const {MappedBuildingCells}=await import(pathToFileURL(out));
 const {groundHeight,buildingGround}=await import('../webapp/src/games/tirana-east/terrainCore.mjs');
 const material=new T.MeshStandardMaterial(),layer=new MappedBuildingCells([],material,material,false,false);
 const b={id:'test',p:[[5000,5000],[5016,5000],[5016,5016],[5000,5016]],h:9.6,tags:{'building:levels':'3'}};
 const group=layer.build([b],true),glass=group.children.find(m=>m.userData.windows),p=glass.geometry.getAttribute('position'),norm=glass.geometry.getAttribute('normal');
 assert.equal(p.count,4*4*3*6);const base=buildingGround(b);assert.ok(Number.isFinite(groundHeight(5000,5000)));
 for(let i=0;i<p.count;i+=6){const a=new T.Vector3().fromBufferAttribute(p,i),b=new T.Vector3().fromBufferAttribute(p,i+1),c=new T.Vector3().fromBufferAttribute(p,i+2);assert.ok(a.y>base&&a.y<base+9.6);assert.ok(b.sub(a).cross(c.sub(a)).dot(new T.Vector3().fromBufferAttribute(norm,i))>0);}
 group.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});layer.dispose();material.dispose();
});
