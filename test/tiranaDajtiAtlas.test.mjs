import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {expandedAtlasBounds,atlasPin} from '../webapp/src/games/tiranastreets/map/atlasExtent.mjs';
import {fitView,panView,zoomView,inBounds,buildMapGraph,findMapRoute,writeFavorites,readFavorites} from '../webapp/src/games/tiranastreets/map/mapCore.mjs';
// Synthetic small fixtures exercise the extension contract, not surveyed geography.
const bounds=Object.freeze([-805,-380,660,1150]);
const lower=Object.freeze({x:3500,z:-2600}),upper=Object.freeze({x:7200,z:-4600});
const terminals=Object.freeze([lower,upper]);
const expanded=expandedAtlasBounds(bounds,terminals);

test('atlas covers both reference points while preserving original bounds by value',()=>{
 assert.deepEqual(bounds,[-805,-380,660,1150]);
 assert.deepEqual(expanded,[-805,-5050,7650,1150]);
 assert.notEqual(expanded,bounds);assert.ok(Object.isFrozen(expanded));
 for(const p of terminals)assert.ok(inBounds(p,expanded));
});
test('no references means no geographic expansion or mutation',()=>{
 const next=expandedAtlasBounds(bounds,[]);assert.deepEqual(next,bounds);assert.notEqual(next,bounds);
});
test('invalid references and extents are rejected without modifying city data',()=>{
 for(const p of [null,{x:NaN,z:0},{x:1,z:Infinity}])assert.throws(()=>expandedAtlasBounds(bounds,[p]));
 for(const b of [[0,0,0,1],[1,0,0,1],[0,0,1],null])assert.throws(()=>expandedAtlasBounds(b,terminals));
 for(const margin of [-1,Infinity,5001])assert.throws(()=>expandedAtlasBounds(bounds,terminals,margin));
});
test('original city viewport remains the initial and reset framing',()=>{
 const initial=fitView(bounds,390/500);
 assert.deepEqual(initial,fitView(bounds,390/500));
 const full=fitView(expanded,390/500);assert.ok(full.w>initial.w);
 for(const p of terminals)assert.ok(p.x>=full.x&&p.x<=full.x+full.w&&p.z>=full.z&&p.z<=full.z+full.h);
});
test('drag right/down moves visible geography right/down without axis remapping',()=>{
 const view={x:2000,z:-2500,w:900,h:1200},next=panView(view,39,50,390,500,expanded);
 const feature={x:2400,z:-2100};
 assert.ok((feature.x-next.x)/next.w>(feature.x-view.x)/view.w);
 assert.ok((feature.z-next.z)/next.h>(feature.z-view.z)/view.h);
});
test('zoom preserves its screen anchor inside the extended atlas',()=>{
 const view={x:2000,z:-3500,w:2000,h:2600},anchor={x:3000,z:-2200};
 const next=zoomView(view,2,anchor,expanded);
 assert.equal(next.w,1000);assert.equal((anchor.x-view.x)/view.w,(anchor.x-next.x)/next.w);
 assert.equal((anchor.z-view.z)/view.h,(anchor.z-next.z)/next.h);
});
test('viewing the region does not turn Dajti pins into routable destinations',()=>{
 assert.equal(atlasPin(lower,bounds).available,false);
 assert.equal(atlasPin(upper,bounds).available,false);
 assert.equal(atlasPin({x:0,z:0},bounds).available,true);
 assert.equal(atlasPin({x:660,z:1150},bounds).available,true);
 assert.deepEqual(upper,{x:7200,z:-4600});
});
test('old roads and route graph are untouched and no cable line becomes a road',()=>{
 const world={origin:[41.3275,19.8188],bounds,roads:[{a:[0,0],b:[100,0],walk:true}]};
 const before=JSON.stringify(world),graph=buildMapGraph(world,'walk');
 expandedAtlasBounds(world.bounds,terminals);
 assert.equal(JSON.stringify(world),before);assert.deepEqual(graph,buildMapGraph(world,'walk'));
 assert.equal(findMapRoute(graph,{x:0,z:0},upper).reachable,false);
 assert.equal(findMapRoute(graph,{x:0,z:0},{x:80,z:0}).reachable,true);
});
test('favourites retain geographic coordinates; off-district pins remain unavailable after reload',()=>{
 const world={origin:[41.3275,19.8188],bounds};let text='';
 const storage={setItem(_k,v){text=v;},getItem(){return text;}};
 const saved=[{id:'city',name:'City',x:100,z:100},{id:'regional',name:'Regional reference',...upper}];
 assert.equal(writeFavorites(storage,saved,world),true);
 const before=text;expandedAtlasBounds(bounds,terminals);assert.equal(text,before);
 const loaded=readFavorites(storage,world);assert.equal(loaded[0].available,true);assert.equal(loaded[1].available,false);
 assert.ok(Math.abs(loaded[1].x-upper.x)<1e-6);assert.ok(Math.abs(loaded[1].z-upper.z)<1e-6);
});
test('the existing city rendering, marker drawing and minimap source remain unchanged',()=>{
 const source=readFileSync(new URL('../webapp/src/games/tiranastreets/map/CityMapCore.tsx',import.meta.url),'utf8');
 const segment=source.slice(source.indexOf('const Geometry ='),source.indexOf('function ExplorerMap'));
 assert.equal(createHash('sha256').update(segment).digest('hex'),'6f15312a89629b1fc09e9910b4cf4176b76bbed7ea9fb2f3cc7e3ced595cf511');
 assert.ok(source.includes('useState<View>(()=>fitView(WORLD.bounds,1))'));
 assert.ok(source.includes('fit(WORLD.bounds)'));
 assert.ok(source.includes('fit(ATLAS_BOUNDS)'));
});
