import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from '../webapp/node_modules/esbuild/lib/main.js';
const temporary=await mkdtemp(join(tmpdir(),'tirana-neighbourhood-runtime-'));
let api;
try{
 const outfile=join(temporary,'runtime.mjs');
 await build({stdin:{contents:"export * as T from 'three';export {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';export {NeighbourhoodLayer} from './src/games/tirana-neighbourhood/NeighbourhoodLayer';export {NEIGHBOURHOOD} from './src/games/tirana-neighbourhood/data.mjs';",resolveDir:new URL('../webapp/',import.meta.url).pathname,loader:'ts'},outfile,bundle:true,platform:'node',format:'esm'});
 api=await import(pathToFileURL(outfile).href);
}finally{await rm(temporary,{recursive:true,force:true});}
const {T,GLTFLoader,NeighbourhoodLayer,NEIGHBOURHOOD:n}=api;
// Canvas text is stubbed; actual Three geometry/GLTF parsing/lifecycle executes.
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},fillText(){}})})};
async function geometryAsset(name){
 const bytes=await readFile(new URL(`../webapp/public/assets/tirana-streets/neighbourhood/${name}.glb`,import.meta.url)),length=bytes.readUInt32LE(12),g=JSON.parse(bytes.subarray(20,20+length)),binary=bytes.subarray(28+length);
 // Test decoding meshes without a DOM image decoder. Real PBR files/hashes and
 // accessor integrity are separately checked by tiranaNeighbourhood.test.mjs.
 for(const m of g.materials){delete m.normalTexture;delete m.occlusionTexture;delete m.emissiveTexture;delete m.pbrMetallicRoughness?.baseColorTexture;delete m.pbrMetallicRoughness?.metallicRoughnessTexture;}
 delete g.images;delete g.textures;let json=Buffer.from(JSON.stringify(g));json=Buffer.concat([json,Buffer.alloc((-json.length)&3,32)]);
 const out=Buffer.alloc(28+json.length+binary.length);out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(json.length,12);out.writeUInt32LE(0x4e4f534a,16);json.copy(out,20);out.writeUInt32LE(binary.length,20+json.length);out.writeUInt32LE(0x004e4942,24+json.length);binary.copy(out,28+json.length);
 return new GLTFLoader().parseAsync(out.buffer.slice(out.byteOffset,out.byteOffset+out.byteLength),'');
}
test('actual shared layer decodes Blender GLBs, places heroes, bounds instances and disposes once',async()=>{
 const start=performance.now(),layer=new NeighbourhoodLayer(),requests=[];
 layer.loader={loadAsync(url){const p=geometryAsset(url.split('/').at(-1).replace('.glb',''));requests.push(p);return p;}};
 layer.update(0,{x:-10000,z:-10000});assert.equal(requests.length,0);
 layer.update(1,{x:1185,z:226});await Promise.all(requests);await new Promise(resolve=>setImmediate(resolve));layer.update(2,{x:1185,z:226});
 assert.deepEqual(layer.group.userData.assetErrors,[]);assert.equal(layer.heroes.size,4);assert.ok(layer.kits.size>=1);
 const hero=layer.heroes.get('682723386'),b=n.buildings.find(b=>b.id==='682723386');
 assert.ok(Math.abs(hero.x-b.p.reduce((s,p)=>s+p[0]/b.p.length,0))<1e-6);assert.equal(layer.mapped.heroFallbacks.get(b.id).visible,false);
 let totalInstances=0,vertices=0;layer.group.traverse(o=>{if(o instanceof T.InstancedMesh){assert.ok(o.count<=48||o===layer.labels.labels);totalInstances+=o.count;}if(o instanceof T.Mesh)vertices+=o.geometry.attributes.position.count;});
 assert.ok(totalInstances>0);assert.ok(vertices<800000,`Vertex budget ${vertices}`);
 const geometries=new Set();layer.group.traverse(o=>{if(o instanceof T.Mesh)geometries.add(o.geometry);});let released=0;geometries.forEach(g=>g.addEventListener('dispose',()=>released++));
 layer.dispose();layer.dispose();assert.equal(released,geometries.size);assert.equal(layer.group.children.length,0);
 console.log(JSON.stringify({constructionAndDecodeMs:Math.round(performance.now()-start),renderGeometryVertices:vertices,visibleInstances:totalInstances}));
});
test('late asset completions release resources instead of resurrecting a retired city',async()=>{
 const layer=new NeighbourhoodLayer();let resolve;layer.loader={loadAsync:()=>new Promise(r=>resolve=r)};
 layer.request('market');layer.dispose();
 const geometry=new T.BoxGeometry(),material=new T.MeshStandardMaterial(),group=new T.Group();group.add(new T.Mesh(geometry,material));let disposed=0;geometry.addEventListener('dispose',()=>disposed++);material.addEventListener('dispose',()=>disposed++);
 resolve({scene:group});await new Promise(r=>setImmediate(r));assert.equal(disposed,2);assert.equal(layer.group.children.length,0);
});
