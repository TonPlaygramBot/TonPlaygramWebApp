import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const result=await build({stdin:{contents:`
import assert from 'node:assert/strict';
import * as T from 'three';
import {StreetLifeLayer} from './src/games/tirana-street-life/StreetLifeLayer';
import {MatureTreeLayer} from './src/games/tirana-street-life/MatureTreeLayer';
import {STREET_LIFE} from './src/games/tirana-street-life/registry.mjs';
import {STREET_VIEWS} from './src/games/tirana-street-life/streetViews.mjs';
// Only the local raster canvas is stubbed. Actual THREE geometry, matrices,
// materials, instance counts, CPU frustum selection and disposal are exercised.
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)})})};
const streets=new StreetLifeLayer(),trees=new MatureTreeLayer();
assert.equal(streets.group.children.length,4);assert.equal(trees.group.children.length,16);
let clock=1,maxInstances=0,maxTrees=0;
for(const v of STREET_VIEWS)for(const battery of [false,true]){
 streets.update(clock,v,battery,true);trees.update(clock++,v,battery,true);
 let count=0;
 for(const [i,o] of streets.group.children.entries()){
  assert.ok(o instanceof T.InstancedMesh);assert.ok(o.count<=o.instanceMatrix.count);count+=o.count;
  for(let k=0;k<o.count*16;k++)assert.ok(Number.isFinite(o.instanceMatrix.array[k]));
  if(i===3){const tex=o.material.map;assert.ok(tex.image.width<=4096&&tex.image.height<=4096);assert.ok(tex.image.width*tex.image.height<=5000000);const uv=o.geometry.getAttribute('instanceAtlas');for(let k=0;k<o.count;k++){assert.ok(uv.getX(k)>=0&&uv.getY(k)>=0);assert.ok(uv.getX(k)+uv.getZ(k)<=1.00001&&uv.getY(k)+uv.getW(k)<=1.00001);}}
 }
 maxInstances=Math.max(maxInstances,count);
 const trunks=new Set();let total=0;
 trees.group.children.forEach((o,i)=>{
  assert.ok(o.count<=o.instanceMatrix.count);assert.ok(Array.from(o.geometry.getAttribute('position').array).every(Number.isFinite));
  if(i%2===0)for(let k=0;k<o.count;k++){const m=new T.Matrix4();o.getMatrixAt(k,m);const p=new T.Vector3().setFromMatrixPosition(m),id=p.x+','+p.z;assert.ok(!trunks.has(id),'one near/far owner for each mapped tree');trunks.add(id);total++;}
 });
 assert.ok(total<=(battery?260:640));maxTrees=Math.max(maxTrees,total);
}
const geoSet=new Set(),matSet=new Set(),texSet=new Set();let disposals=0;
for(const layer of [streets,trees])layer.group.traverse(o=>{if(o instanceof T.Mesh){geoSet.add(o.geometry);matSet.add(o.material);for(const v of Object.values(o.material))if(v instanceof T.Texture)texSet.add(v);}});
for(const resource of [...geoSet,...matSet,...texSet])resource.addEventListener('dispose',()=>disposals++);
streets.dispose();trees.dispose();streets.dispose();trees.dispose();assert.equal(disposals,geoSet.size+matSet.size+texSet.size);assert.equal(streets.group.children.length,0);assert.equal(trees.group.children.length,0);
// A race ribbon removes intersecting street objects and trees at construction.
const track={points:[{x:-805,z:600},{x:660,z:600}],width:5000};
const blockedStreets=new StreetLifeLayer(undefined,{profile:'racing',track}),blockedTrees=new MatureTreeLayer(undefined,{profile:'racing',track});
blockedStreets.update(1,{x:100,z:600},false,true);blockedTrees.update(1,{x:100,z:600},false,true);
assert.ok(blockedStreets.group.children.every(m=>m.count===0));assert.ok(blockedTrees.group.children.every(m=>m.count===0));blockedStreets.dispose();blockedTrees.dispose();
console.log(JSON.stringify({streetDraws:4,treeDraws:16,maxInstances,maxTrees,views:STREET_VIEWS.length,atlas:'bounded',disposal:'passed',raceRibbon:'clear'}));
`,resolveDir:root,loader:'ts'},bundle:true,write:false,format:'esm',platform:'node',logLevel:'warning'});
try{await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].contents).toString('base64'));}catch(error){console.error(error.stack?.split('\n').slice(0,2).map(l=>l.slice(0,600)).join('\n')||error.message);process.exitCode=1;}
