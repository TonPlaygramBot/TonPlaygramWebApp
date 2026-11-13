import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from '../webapp/node_modules/esbuild/lib/main.js';
const dir=await mkdtemp(join(tmpdir(),'tirana-trees-'));
let api;
try{const file=join(dir,'api.mjs');await build({stdin:{contents:`export * as T from 'three';export {ImportedTreeLayer} from './src/games/tirana-street-life/ImportedTreeLayer';`,resolveDir:new URL('../webapp/',import.meta.url).pathname,loader:'ts'},bundle:true,format:'esm',platform:'node',outfile:file});api=await import(pathToFileURL(file));}finally{await rm(dir,{recursive:true,force:true});}
const {T,ImportedTreeLayer}=api;
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
function prototype(){const source=new T.Group(),material=new T.MeshStandardMaterial();const geometry=new T.BoxGeometry(4,10,6);geometry.translate(2,5,3);const parent=new T.Group();parent.position.set(5,2,8);const mesh=new T.Mesh(geometry,[material,material,material,material,material,material]);parent.add(mesh);source.add(parent);return {source,geometry,material};}
const tree={x:20,y:3,z:40,height:15,crown:9,seed:0,shape:'garden'};
test('one load preserves glTF groups and material identity; transformed tree is grounded and normalized',async()=>{
 const {source,geometry,material}=prototype();let calls=0;const layer=new ImportedTreeLayer(async()=>{calls++;return source;});layer.request();layer.request();await tick();assert.equal(calls,1);assert.ok(layer.ready);
 layer.begin();assert.ok(layer.add(tree));layer.end();const mesh=layer.group.children[0];assert.equal(mesh.geometry,geometry);assert.equal(mesh.material[0],material);assert.equal(mesh.geometry.groups.length,6);
 const matrix=new T.Matrix4();mesh.getMatrixAt(0,matrix);const bounds=geometry.boundingBox.clone().applyMatrix4(matrix);assert.equal(bounds.min.y,3);assert.equal(bounds.max.y,18);assert.equal(bounds.getCenter(new T.Vector3()).x,20);assert.equal(bounds.getCenter(new T.Vector3()).z,40);assert.equal(Math.max(bounds.max.x-bounds.min.x,bounds.max.z-bounds.min.z),9);layer.dispose();
});
test('bounded instances, battery shadows, cypress preservation and reset',async()=>{
 const layer=new ImportedTreeLayer(async()=>prototype().source);layer.request();await tick();layer.begin();assert.equal(layer.add({...tree,shape:'column'}),false);let accepted=0;for(let i=0;i<100;i++)accepted+=Number(layer.add(tree));layer.end();assert.equal(accepted,8);assert.equal(layer.group.userData.visibleTrees,8);
 layer.begin();accepted=0;for(let i=0;i<100;i++)accepted+=Number(layer.add(tree,true));layer.end();assert.equal(accepted,3);assert.equal(layer.group.children[0].castShadow,false);layer.begin();layer.end();assert.equal(layer.group.children[0].count,0);layer.dispose();
});
test('disposal is idempotent and late loads dispose each shared resource once',async()=>{
 let resolve;const pending=new Promise(r=>{resolve=r;});const {source,geometry,material}=prototype();let geometries=0,materials=0;geometry.addEventListener('dispose',()=>geometries++);material.addEventListener('dispose',()=>materials++);
 const layer=new ImportedTreeLayer(()=>pending);layer.request();layer.dispose();layer.dispose();resolve(source);await tick();assert.equal(geometries,1);assert.equal(materials,1);assert.equal(layer.ready,false);assert.equal(layer.group.children.length,0);
});
test('failed load retains fallback without repeated network attempts',async()=>{
 let calls=0;const layer=new ImportedTreeLayer(async()=>{calls++;throw Error('fixture');});const warn=console.warn;console.warn=()=>{};try{layer.request();await tick();layer.request();assert.equal(calls,1);assert.equal(layer.ready,false);assert.equal(layer.add(tree),false);assert.equal(layer.group.userData.status,'fallback');}finally{console.warn=warn;layer.dispose();}
});
