import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from '../webapp/node_modules/esbuild/lib/main.js';
const temp=await mkdtemp(join(tmpdir(),'tirana-fixtures-'));let api;
try{
 const output=join(temp,'runtime.mjs');
 await build({stdin:{contents:`export * as T from 'three';export {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';export {UrbanDetailLayer} from './src/games/tirana-detail-kit/UrbanDetailLayer';`,resolveDir:new URL('../webapp/',import.meta.url).pathname,loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:output});api=await import(pathToFileURL(output));
}finally{await rm(temp,{recursive:true,force:true});}
const {T,GLTFLoader,UrbanDetailLayer}=api;
const bytes=await readFile(new URL('../webapp/public/assets/tirana-streets/detail-kit/urban-fixtures.glb',import.meta.url));
const manifest=JSON.parse(await readFile(new URL('../webapp/public/assets/tirana-streets/detail-kit/manifest.json',import.meta.url)));
const load=async()=> (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'/')).scene;
const world={buildings:Array.from({length:50},(_,i)=>({id:String(i),h:12,p:[[i*3,0],[i*3+20,0],[i*3+20,20],[i*3,20]]}))};
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
test('all exported fixture assets are embedded, hash-verified and retain UV/material detail',async()=>{
 assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.sha256);assert.equal(bytes.length,manifest.bytes);assert.ok(bytes.length<600000);
 const scene=await load();for(const name of manifest.assets){const group=scene.getObjectByName(name);assert.ok(group,name);let meshes=0;group.traverse(o=>{if(o.isMesh){meshes++;assert.ok(o.geometry.attributes.uv);assert.ok(o.geometry.attributes.normal);assert.ok(o.material.isMeshStandardMaterial);}});assert.ok(meshes);}
});
test('real GLB swaps atomically with unchanged placements and bounded instancing',async()=>{
 let calls=0;const layer=new UrbanDetailLayer(world,new Set(),{loadAsset:async()=>{calls++;return load();}});const ids=layer.placements.map(p=>p.id);
 layer.update({x:30,z:0},false,0);await tick();await tick();assert.equal(layer.group.userData.assetStatus,'glb');
 layer.update({x:30,z:0},false,401);assert.deepEqual(layer.placements.map(p=>p.id),ids);assert.equal(calls,1);
 let visible=0;layer.group.traverse(o=>{if(o.isInstancedMesh){assert.ok(o.count<=120);assert.ok(o.geometry.attributes.uv);visible+=o.count;}});assert.ok(visible>0);
 layer.update({x:30,z:0},true,802);layer.dispose();layer.dispose();layer.update({x:30,z:0},false,1203);assert.equal(layer.group.children.length,0);
});
test('incomplete asset keeps the fallback and cleans partial resources',async()=>{
 const layer=new UrbanDetailLayer(world,new Set(),{loadAsset:async()=>new T.Group()});layer.update({x:30,z:0},false,0);const first=layer.group.children[0];await tick();assert.equal(layer.group.userData.assetStatus,'fallback-error');assert.equal(layer.group.children[0],first);layer.dispose();
});
test('late response after disposal releases resources and does not resurrect meshes',async()=>{
 let resolve;const promise=new Promise(r=>{resolve=r;});const scene=await load();let disposed=0;scene.traverse(o=>{if(o.isMesh)o.geometry.addEventListener('dispose',()=>disposed++);});
 const layer=new UrbanDetailLayer(world,new Set(),{loadAsset:()=>promise});layer.update({x:30,z:0},false,0);layer.dispose();resolve(scene);await tick();assert.ok(disposed>0);assert.equal(layer.group.children.length,0);
});
