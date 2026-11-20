import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from '../webapp/node_modules/esbuild/lib/main.js';
const dir=await mkdtemp(join(tmpdir(),'tirana-mature-runtime-'));
let api;
try{const file=join(dir,'api.mjs');await build({stdin:{contents:`export * as T from 'three';export {MatureTreeLayer} from './src/games/tirana-street-life/MatureTreeLayer';`,resolveDir:new URL('../webapp/',import.meta.url).pathname,loader:'ts'},bundle:true,format:'esm',platform:'node',outfile:file});api=await import(pathToFileURL(file));}finally{await rm(dir,{recursive:true,force:true});}
const {T,MatureTreeLayer}=api;
const tick=()=>new Promise(r=>setTimeout(r,0));
const source=()=>{const g=new T.Group();g.add(new T.Mesh(new T.BoxGeometry(3,5,3),new T.MeshStandardMaterial()));return g;};
function fixture(trees){
 const old=globalThis.document;
 globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({beginPath(){},ellipse(){},fill(){}})})};
 try{return new MatureTreeLayer(trees);}finally{globalThis.document=old;}
}
const tree=(id,x,shape='garden')=>({id,x,z:0,shape,height:8,crown:4,seed:1,zone:'mapped'});
const generated=l=>l.batches.reduce((n,b)=>n+b.wood.count,0);
test('actual mature layer handles delayed medium readiness, hysteresis and exact single ownership',async()=>{
 const layer=fixture([tree('one',60)]);let finishMedium,nearCalls=0,mediumCalls=0;
 layer.imported.loadSource=async()=>{nearCalls++;return source();};
 layer.mediumImported.loadSource=()=>{mediumCalls++;return new Promise(r=>{finishMedium=r;});};
 try{
  layer.update(0,{x:0,z:0});assert.equal(generated(layer),1);
  await tick();layer.update(.01,{x:0,z:0}); // readiness change must bypass movement throttle
  assert.equal(layer.group.userData.importedTrunks,1);assert.equal(layer.group.userData.mediumImportedTrunks,0);assert.equal(generated(layer),0);
  finishMedium(source());await tick();layer.update(.02,{x:0,z:0});
  assert.equal(layer.group.userData.mediumImportedTrunks,1);assert.equal(layer.imported.group.userData.visibleTrees,0);assert.equal(generated(layer),0);
  layer.update(1,{x:10,z:0},false,true);assert.equal(layer.group.userData.mediumImportedTrunks,1); // 50 m dead band
  layer.update(2,{x:16,z:0},false,true);assert.equal(layer.group.userData.mediumImportedTrunks,0); //44m returns close
  assert.equal(layer.imported.group.userData.visibleTrees,1);assert.equal(nearCalls,1);assert.equal(mediumCalls,1);
 }finally{layer.dispose();layer.dispose();}
 assert.equal(layer.group.children.length,0);
});
test('actual mature layer combines both LOD budgets and preserves unsupported species fallback',async()=>{
 const trees=[...Array.from({length:12},(_,i)=>tree('g'+i,5+i*7)),tree('cypress',2,'column')];
 const layer=fixture(trees);
 layer.imported.loadSource=async()=>source();layer.mediumImported.loadSource=async()=>source();
 try{
  layer.update(0,{x:0,z:0});await tick();layer.update(1,{x:0,z:0},false,true);await tick();layer.update(2,{x:0,z:0},false,true);
  assert.equal(layer.group.userData.importedTrunks,8);assert.equal(generated(layer),5);
  assert.equal(layer.imported.group.userData.visibleTrees+layer.mediumImported.group.userData.visibleTrees,8);
  layer.update(3,{x:0,z:0},true,true);assert.equal(layer.group.userData.importedTrunks,3);assert.equal(generated(layer),10);
  for(const child of [...layer.imported.group.children,...layer.mediumImported.group.children])if(child.count)assert.equal(child.castShadow,false);
  layer.retire();layer.update(4,{x:1000,z:0},true,true);assert.equal(layer.group.userData.importedTrunks,3);
 }finally{layer.dispose();}
});
