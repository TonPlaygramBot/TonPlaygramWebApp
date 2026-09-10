import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const result=await build({stdin:{contents:`
import assert from 'node:assert/strict';
import * as T from 'three';
import {ReferenceFacades} from './src/games/tirana-city-source/ReferenceFacades';
import {RiniaFountain} from './src/games/tirana-city-source/RiniaFountain';
import {LANDMARK_DATA} from './src/games/tirana-city-source/allLandmarks.mjs';
const layer=new ReferenceFacades(),fountain=new RiniaFountain();
let triangles=0,meshes=0;
layer.group.traverse(o=>{if(o instanceof T.Mesh){meshes++;const p=o.geometry.getAttribute('position');assert.ok(Array.from(p.array).every(Number.isFinite));triangles+=(o.geometry.index?.count??p.count)/3;}});
assert.ok(triangles<900000,'mobile triangle budget: '+triangles);
console.log(JSON.stringify({meshes,triangles}));
assert.ok(meshes<400,'whole catalog material batches: '+meshes);
for(const b of LANDMARK_DATA.buildings)assert.equal(layer.group.children.filter(g=>g.userData.osmWay===b.id).length,1,b.id);
// The portrait inspector allocates only one selected site at a time.
for(const site of new Set(LANDMARK_DATA.buildings.map(b=>b.site))){
 const ids=new Set(LANDMARK_DATA.buildings.filter(b=>b.site===site).map(b=>b.id));
 const selected=new ReferenceFacades(undefined,ids);assert.equal(selected.group.children.length,ids.size);
 let batches=0;selected.group.traverse(o=>{if(o instanceof T.Mesh)batches++;});
 assert.ok(batches<90,'selected-site batch budget: '+site);selected.dispose();
}
for(const id of ['384505310','459085861']){
 const b=LANDMARK_DATA.buildings.find(b=>b.id===id),group=layer.group.children.find(g=>g.userData.osmWay===id);group.updateMatrixWorld(true);
 for(const hole of b.holes){
  const c=[0,1].map(i=>hole.reduce((s,p)=>s+p[i],0)/hole.length);
  const hits=new T.Raycaster(new T.Vector3(c[0],100,c[1]),new T.Vector3(0,-1,0)).intersectObject(group,true);
  assert.equal(hits.length,0,'courtyard roof stays open: '+id);
 }
}
const stadium=layer.group.children.find(g=>g.userData.osmWay==='relation/10311002');
const hole=LANDMARK_DATA.buildings.find(b=>b.id==='relation/10311002').holes[0];
const x=hole.reduce((s,p)=>s+p[0],0)/hole.length,z=hole.reduce((s,p)=>s+p[1],0)/hole.length;
stadium.updateMatrixWorld(true);
const hits=new T.Raycaster(new T.Vector3(x,140,z),new T.Vector3(0,-1,0)).intersectObject(stadium,true);
assert.ok(hits.length);assert.ok(hits.every(hit=>hit.point.y<1),'stadium pitch is not sealed by a roof');
fountain.update(3);const points=fountain.group.children.find(c=>c instanceof T.Points);assert.ok(Array.from(points.geometry.getAttribute('position').array).every(Number.isFinite));
layer.update({x:0,z:0},true);assert.equal(layer.group.children.find(g=>g.userData.osmWay==='293898197').visible,false);
layer.dispose();layer.dispose();fountain.dispose();fountain.dispose();assert.equal(layer.group.children.length,0);assert.equal(fountain.group.children.length,0);
console.log(JSON.stringify({buildings:LANDMARK_DATA.buildings.length,meshes,triangles,stadiumOpening:'clear',disposal:'passed'}));
`,resolveDir:root,loader:'ts'},bundle:true,write:false,format:'esm',platform:'node',logLevel:'warning'});
try { await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].contents).toString('base64')); } catch(error) { console.error(error.message); process.exitCode=1; }
