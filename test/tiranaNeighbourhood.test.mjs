import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readSourceArchive} from '../webapp/scripts/tirana/sourceArchive.mjs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {WORLD as core} from '../webapp/src/games/tiranastreets/shared/centralWorld.mjs';
import {WORLD,collide,lineOfSight,createState,advanceState} from '../webapp/src/games/tiranastreets/shared/engine.mjs';
import {NEIGHBOURHOOD as n} from '../webapp/src/games/tirana-neighbourhood/data.mjs';
import {extendNeighbourhood} from '../webapp/src/games/tirana-neighbourhood/worldExtension.mjs';
import {buildMapGraph,findMapRoute} from '../webapp/src/games/tiranastreets/map/mapCore.mjs';
import {facadeEdges} from '../webapp/src/games/tirana-city-source/sourceCore.mjs';
import {ORIGIN,buildings as fpsBuildings} from '../webapp/src/games/blackwater/shared/layout.mjs';

test('frozen source checksum, complete records and unchanged central metre geometry',()=>{
 const archive=readSourceArchive(new URL('../assets-source/tirana-urban/source.osm.json.gz',import.meta.url));
 assert.equal(createHash('sha256').update(archive).digest('hex'),n.source.sha256);
 const raw=JSON.parse(gunzipSync(archive));assert.equal(raw.receipts.length,35);assert.equal(raw.elements.length,580579);
 const ids=new Set(raw.elements.map(e=>`${e.type}/${e.id}`));assert.equal(ids.size,raw.elements.length);
 assert.deepEqual(WORLD.origin,core.origin);assert.deepEqual(WORLD.roads.slice(0,core.roads.length),core.roads);assert.deepEqual(WORLD.buildings.slice(0,core.buildings.length),core.buildings);
 assert.deepEqual(WORLD.graph.nodes.slice(0,core.graph.nodes.length),core.graph.nodes);assert.deepEqual(WORLD.graph.edges.slice(0,core.graph.edges.length),core.graph.edges);
 assert.equal(n.buildings.length,44543);assert.equal(WORLD.roads.length-core.roads.length,118879);
 assert.ok(WORLD.regionalCoverage.provenSeamNodes>1000);
});
test('walk and drive routes reach the three source-identified focus areas from central Tirana',()=>{
 for(const mode of ['walk','drive']){
  const graph=buildMapGraph(WORLD,mode);
  for(const id of ['node/10950616148','node/6824084784','node/7699528590']){
   const site=n.places.find(p=>p.id===id);assert.ok(site);
   const route=findMapRoute(graph,{x:0,z:0},{x:site.point[0],z:site.point[1]});assert.equal(route.reachable,true,`${mode} ${site.name}: ${route.message}`);assert.ok(route.distance>1000&&route.distance<3000);
  }
 }
});
test('new source identities do not snap nearby endpoints/crossings and retain one-way routing',()=>{
 const c={roads:[{a:[0,0],b:[10,0],walk:false}],buildings:[],bounds:[0,0,100,100],graph:{nodes:[[0,0],[10,0]],edges:[[0,1]]}};
 const road=(nodeA,nodeB,a,b,extra={})=>({nodeA,nodeB,a,b,walk:false,layer:0,highway:'residential',...extra});
 const r={bounds:c.bounds,buildings:[],roads:[road('a','b',[0,0],[10,0]),road('b','c',[10,0],[20,0],{oneway:true}),road('foreign','far',[20,.01],[30,.01]),road('private','closed',[10,0],[10,20],{access:'private'}),road('high','bridge',[10,0],[15,5],{bridge:true,layer:1})]};
 const result=extendNeighbourhood(c,r);assert.equal(result.graph.nodes.length,3);assert.equal(result.graph.edges.length,2);assert.equal(result.graph.directions[1],1);
 const g=buildMapGraph(result,'drive');assert.equal(findMapRoute(g,{x:1,z:0},{x:19,z:0}).reachable,true);assert.equal(findMapRoute(g,{x:19,z:0},{x:1,z:0}).reachable,false);
});
test('source courtyards remain open in street collision, sight lines and FPS coordinates',()=>{
 const b=n.buildings.find(b=>b.id==='relation/5344956'),hole=b.holes[0];
 const p={x:hole.reduce((s,v)=>s+v[0]/hole.length,0),z:hole.reduce((s,v)=>s+v[1]/hole.length,0)},before={...p};
 assert.equal(collide(p,.4),false);assert.deepEqual(p,before);assert.equal(lineOfSight(p,{x:p.x+1,z:p.z}),true);
 const translated=fpsBuildings.find(f=>f.id===b.id);assert.deepEqual(translated.holes,hole?[hole.map(v=>[v[0]-ORIGIN.x,v[1]-ORIGIN.z])]:[]);
});
test('frontages fit their selected source wall and every category has a source-linked tenant',()=>{
 assert.equal(n.storefronts.length,1559);
 for(const category of ['market','pharmacy','barber','produce','cafe','civic','clinic'])assert.ok(n.storefronts.some(s=>s.model===category),category);
 for(const s of n.storefronts){
  assert.ok(n.places.some(p=>p.id===s.id));const b=n.buildings.find(b=>b.id===s.buildingId);assert.ok(b);
  assert.ok(facadeEdges(b.p).some(e=>{const u=(s.x-e.a[0])*e.ux+(s.z-e.a[1])*e.uz;return Math.abs((s.x-e.a[0])*e.nx+(s.z-e.a[1])*e.nz-.08)<1e-5&&u>=s.width/2+.124&&u<=e.length-s.width/2-.124;}),s.name);
 }
 assert.equal(n.polygonFeatures.filter(p=>p.tags.man_made==='reservoir_covered').length,7);
 assert.ok(n.unresolved.length>0);assert.ok(!n.storefronts.some(s=>/flabina/i.test(s.name)));
});
test('real free-roam state advances on the expanded city with finite player/vehicle positions',()=>{
 const state=createState([{id:'review',name:'Review'}],'free-roam');
 for(let i=0;i<180;i++)advanceState(state,1/60);
 for(const p of [...Object.values(state.players),...state.cars,...state.npcs])assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.z));
 assert.equal(state.phase,'active');
});
test('all eleven Blender GLBs and local PBR images match their manifest and contain finite geometry',()=>{
 const root=new URL('../webapp/public/assets/tirana-streets/neighbourhood/',import.meta.url),manifest=JSON.parse(readFileSync(new URL('manifest.json',root)));
 assert.equal(manifest.models.length,11);assert.match(manifest.blender,/4\.2\.9/);
 let total=0;
 for(const asset of [...manifest.models,...manifest.textures]){
  const bytes=readFileSync(new URL(asset.file,root));assert.equal(bytes.length,asset.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);total+=bytes.length;
  if(!asset.file.endsWith('.glb'))continue;
  assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(8),bytes.length);
  const length=bytes.readUInt32LE(12),g=JSON.parse(bytes.subarray(20,20+length)),binary=bytes.subarray(28+length);
  for(const image of g.images??[])assert.ok(manifest.textures.some(t=>t.file===image.uri));
  for(const a of g.accessors){const v=g.bufferViews[a.bufferView];assert.ok(v.byteOffset+v.byteLength<=binary.length);if(a.componentType!==5126)continue;const arity={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type];for(let i=0;i<a.count*arity;i++)assert.ok(Number.isFinite(binary.readFloatLE(v.byteOffset+(a.byteOffset??0)+i*4)));}
  for(const mesh of g.meshes)for(const p of mesh.primitives){assert.ok(p.attributes.NORMAL!==undefined);assert.ok(p.attributes.TEXCOORD_0!==undefined);}
 }
 assert.ok(total<5200000,`Asset transfer budget ${total}`);
});
