import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from '../webapp/node_modules/esbuild/lib/main.js';
import clipping from '../webapp/node_modules/polygon-clipping/dist/polygon-clipping.esm.js';
import {roadSurfaceIndex,roadRing,splitRoadCells} from '../webapp/src/games/tirana-environment/roadSurfaceCore.mjs';
import {sampleTreeRow,treeOccupancy} from '../webapp/src/games/tirana-street-life/canopyCore.mjs';
import {CANOPY_SUPPLEMENT} from '../webapp/src/games/tirana-street-life/canopySupplement.mjs';
import {CANOPY_TREES} from '../webapp/src/games/tirana-street-life/canopyRegistry.mjs';
import {CITY_COMPLETION} from '../webapp/src/games/tirana-city-completion/data.mjs';
import {WORLD} from '../webapp/src/games/tiranastreets/shared/world.mjs';
const dir=await mkdtemp(join(tmpdir(),'tirana-stream-'));
let api;
try{const file=join(dir,'runtime.mjs');await build({stdin:{contents:`export * as T from 'three';export {UrbanRoadCells} from './src/games/tirana-neighbourhood/UrbanRoadCells';export {MappedBuildingCells} from './src/games/tirana-neighbourhood/MappedBuildingCells';export {appendBuildingShell,shellGeometry} from './src/games/tirana-neighbourhood/buildingShell';export {MatureTreeLayer} from './src/games/tirana-street-life/MatureTreeLayer';`,resolveDir:new URL('../webapp/',import.meta.url).pathname,loader:'ts'},bundle:true,format:'esm',platform:'node',outfile:file});api=await import(pathToFileURL(file));}finally{await rm(dir,{recursive:true,force:true});}
const {T}=api;
const area=polygons=>polygons.reduce((sum,p)=>sum+p.reduce((v,r,i)=>v+(i?-1:1)*Math.abs(r.reduce((a,q,j)=>{const b=r[(j+1)%r.length];return a+q[0]*b[1]-q[1]*b[0];},0))/2,0),0);
test('pavements subtract both arms of junctions, including adjacent cells and reversed ways',()=>{
 for(const reverse of [false,true]){
  const roads=[{a:[-50,0],b:[50,0],w:8},{a:[0,-50],b:[0,50],w:6},{a:[-40,-20],b:[40,20],w:4,walk:true}];
  if(reverse)roads.forEach(r=>[r.a,r.b]=[r.b,r.a]);
  const cut=roadSurfaceIndex(roads),outer=[roadRing(roads[0],12)],result=cut(outer);
  assert.ok(area(result)>100);for(const r of roads.filter(r=>!r.walk))assert.ok(area(clipping.intersection(result,[roadRing(r)]))<1e-7);
  const crossing=cut([roadRing(roads[2])]);assert.ok(area(crossing)>50);for(const r of roads.filter(r=>!r.walk))assert.ok(area(clipping.intersection(crossing,[roadRing(r)]))<1e-7);
 }
});
test('all actual central road shoulders are clear of the full mapped carriageway',()=>{
 const cut=roadSurfaceIndex(WORLD.roads);let samples=0;
 for(const r of WORLD.roads.filter(r=>!r.neighbourhood&&!r.walk&&!r.tunnel&&!r.bridge).filter((r,i)=>i%61===0)){
  const ring=roadRing(r,r.w+3.8);if(!ring)continue;const result=cut([ring]);
  assert.ok(area(clipping.intersection(result,[roadRing(r)]))<1e-6);samples++;
 }
 assert.ok(samples>60);
});
test('row spacing continues through short segments and repeated points, with live deduplication',()=>{
 const row=sampleTreeRow([[0,0],[2,0],[2,0],[4,0],[6,0],[8,0],[10,0],[12,0],[14,0],[20,0]]);
 assert.deepEqual(row.map(t=>t.x),[4,12]);
 const grid=treeOccupancy([]);for(const p of row){assert.equal(grid.has(p.x,p.z),false);grid.add(p);assert.equal(grid.has(p.x+.5,p.z),true);}
 assert.throws(()=>sampleTreeRow([[0,0],[1,0]],0));
});
test('tree ownership is unique and satellite uncertainty is retained',()=>{
 const all=[...CANOPY_TREES,...CITY_COMPLETION.trees];assert.equal(new Set(all.map(t=>t.id)).size,all.length);
 assert.equal(CANOPY_SUPPLEMENT.source.satelliteVerified,false);assert.ok(CANOPY_SUPPLEMENT.trees.length>=100);
 for(const t of CANOPY_SUPPLEMENT.trees){assert.ok(Number.isFinite(t.x+t.z+t.crown+t.height));assert.ok(t.sourceId);if(t.zone==='mapped-tree-row')assert.match(t.accuracy,/estimated/);}
});
test('cheap footprint shells retain courtyards, source heights and upward-facing roofs',()=>{
 const b={id:'courtyard',p:[[0,0],[20,0],[20,20],[0,20],[0,0]],holes:[[[7,7],[7,13],[13,13],[13,7],[7,7]]],h:16,minHeight:2};
 const positions=[],colors=[];api.appendBuildingShell(b,positions,colors);const geo=api.shellGeometry(positions,colors),mat=new T.MeshStandardMaterial({vertexColors:true});const mesh=new T.Mesh(geo,mat);mesh.updateMatrixWorld();
 const ray=new T.Raycaster(new T.Vector3(3,30,3),new T.Vector3(0,-1,0));assert.equal(ray.intersectObject(mesh)[0].point.y,16);
 ray.set(new T.Vector3(10,30,10),new T.Vector3(0,-1,0));assert.equal(ray.intersectObject(mesh).length,0);
 geo.computeBoundingBox();assert.equal(geo.boundingBox.min.y,2);assert.equal(geo.boundingBox.max.y,16);assert.ok(positions.length/9<100);geo.dispose();mat.dispose();
});
test('building streaming renders beyond the previous range and disposes cancelled jobs',()=>{
 const buildings=Array.from({length:32},(_,i)=>({id:String(i),p:[[i*100,0],[i*100+20,0],[i*100+20,20],[i*100,20]],h:15}));
 const wall=new T.MeshStandardMaterial({vertexColors:true}),glass=new T.MeshStandardMaterial();
 const cells=new api.MappedBuildingCells(buildings,wall,glass,false,false);
 for(let i=0;i<100;i++)cells.update({x:0,z:0},false);
 assert.equal(cells.group.userData.pendingJobs,0);assert.equal(cells.group.userData.radius,2400);
 cells.group.updateMatrixWorld(true);const ray=new T.Raycaster(new T.Vector3(2305,30,5),new T.Vector3(0,-1,0));assert.ok(ray.intersectObject(cells.group,true).length);
 cells.update({x:2900,z:0},true);cells.dispose();cells.dispose();cells.update({x:0,z:0},false);assert.equal(cells.group.children.length,0);wall.dispose();glass.dispose();
});
test('tree LOD retains distant canopy, bounded instances and responds immediately to quality changes',()=>{
 const ctx=new Proxy({},{get:(_t,key)=>key==='canvas'?{}:()=>{}});globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>ctx})};
 const trees=Array.from({length:7000},(_,i)=>({id:String(i),x:(i%100)*12-600,z:Math.floor(i/100)*12-420,shape:'upright',height:12,crown:6,seed:i,zone:'test'}));
 const layer=new api.MatureTreeLayer(trees);layer.update(0,{x:0,z:0},false);
 assert.equal(layer.group.userData.visibleTrunks,6000);assert.equal(layer.group.userData.radius,1400);
 layer.group.traverse(o=>{if(o.isInstancedMesh){assert.ok(o.count<=o.instanceMatrix.count);for(let i=0;i<o.count*16;i++)assert.ok(Number.isFinite(o.instanceMatrix.array[i]));}});
 layer.update(.01,{x:0,z:0},true);assert.equal(layer.group.userData.visibleTrunks,2600);assert.equal(layer.group.userData.radius,850);
 layer.dispose();layer.dispose();assert.equal(layer.group.children.length,0);delete globalThis.document;
});
test('road streaming uses the larger radius, prioritizes nearby cells and cancels cleanly',()=>{
 const layer=new api.UrbanRoadCells(false);let maximum=0;
 for(let i=0;i<5000;i++){const start=performance.now();layer.update(i/60,{x:0,z:420},false);maximum=Math.max(maximum,performance.now()-start);if(!layer.group.userData.pendingJobs)break;}
 assert.equal(layer.group.userData.pendingJobs,0);assert.equal(layer.group.userData.radius,2400);assert.ok(layer.group.children.length>100);
 layer.group.updateMatrixWorld(true);const paving=[];layer.group.traverse(o=>{if(o.name==='Pavement outside carriageways')paving.push(o);});assert.ok(paving.length>0);
 for(const mesh of paving){const p=mesh.geometry.getAttribute('position');if(!p)continue;for(let i=0;i<p.count;i++)assert.ok(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)));}
 console.log('road streaming maximum update ms',maximum.toFixed(2),'cells',layer.group.children.length);
 for(let i=0;i<5000;i++){layer.update(100+i/60,{x:4000,z:3000},true);if(!layer.group.userData.pendingJobs)break;}assert.ok(layer.group.userData.cachedCells<=220);layer.dispose();layer.dispose();layer.update(101,{x:0,z:420},false);assert.equal(layer.group.children.length,0);
});
