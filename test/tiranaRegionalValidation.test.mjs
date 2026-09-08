import test from 'node:test';
import assert from 'node:assert/strict';
import {facadeSites, createSiteIndex} from '../webapp/src/games/tirana-region/facadeCore.mjs';
import {importRegionSource, stitchRegionRings} from '../webapp/scripts/tirana/regionImport.mjs';

const options={origin:[0,0],sourceURL:'https://www.openstreetmap.org/',acquiredAt:'2026-09-08T00:00:00Z',sha256:'a'.repeat(64)};
function source(){return {elements:[
 {type:'node',id:1,lat:0,lon:0},{type:'node',id:2,lat:0,lon:.01},
 {type:'node',id:3,lat:-.01,lon:.01},{type:'node',id:4,lat:-.01,lon:0},
 {type:'way',id:10,nodes:[1,2],tags:{highway:'primary'}},
 {type:'way',id:11,nodes:[1,2,3,4,1],tags:{building:'yes'}}]};}
function addHole(f,coordinates,id=20){
 const ids=coordinates.map(([lon,lat],i)=>{const nid=id*10+i;f.elements.push({type:'node',id:nid,lon,lat});return nid;});
 f.elements.push({type:'way',id,nodes:[...ids,ids[0]],tags:{natural:'water'}});
 let relation=f.elements.find(e=>e.type==='relation');
 if(!relation){relation={type:'relation',id:100,tags:{type:'multipolygon',natural:'water'},members:[{type:'way',ref:11,role:'outer'}]};f.elements.push(relation);}
 relation.members.push({type:'way',ref:id,role:'inner'});
}
const island=[[.002,-.002],[.004,-.002],[.004,-.004],[.002,-.004]];

test('equidistant shop frontage is stable under winding and vertex-start changes',()=>{
 const ring=[[0,0],[12,0],[12,12],[0,12]],roads=[{a:[-10,-6],b:[22,-6],w:6},{a:[-10,18],b:[22,18],w:6}];
 const make=p=>facadeSites({buildings:[{id:1,h:12,p}],roads});
 const expected=make(ring);
 for(const p of [ring,[...ring].reverse()])for(let i=0;i<4;i++)assert.deepEqual(make([...p.slice(i),...p.slice(0,i)]),expected);
});
test('invalid spatial cell sizes are rejected before a query can hang',()=>{
 for(const size of [0,-1,NaN,Infinity])assert.throws(()=>createSiteIndex([],size),/cell/i);
});
test('indexed sites cannot be moved behind the index by mutating input',()=>{
 const sites=[{id:'a',x:10,z:0,variant:0}],select=createSiteIndex(sites);sites[0].x=10000;
 assert.equal(select({x:0,z:0},20,1)[0]?.x,10);
});
test('returned site mutation cannot corrupt later queries',()=>{
 const select=createSiteIndex([{id:'a',x:10,z:0}]);
 const first=select({x:0,z:0},20,1);try{first[0].x=10000;}catch{/* Freezing is also acceptable. */}
 assert.equal(select({x:0,z:0},20,1)[0]?.x,10);
});
test('provenance rejects malformed HTTPS URLs',()=>{
 for(const sourceURL of ['https://','https:// bad host','https:///'])assert.throws(()=>importRegionSource(source(),{...options,sourceURL}),/Provenance/);
});
test('overflow dimensions stay unknown rather than becoming Infinity',()=>{
 const f=source();f.elements.find(e=>e.id===11).tags.height='9'.repeat(400);
 assert.equal(importRegionSource(f,options).buildings[0].h,null);
});
test('a closed ring cannot revisit the same source vertex',()=>{
 assert.throws(()=>stitchRegionRings([[1,2,3,2,1]]),/Degenerate|repeat|ambiguous/i);
});
test('self-crossing building footprints are rejected',()=>{
 const f=source();f.elements.find(e=>e.id===11).nodes=[1,3,2,4,1];
 assert.throws(()=>importRegionSource(f,options),/polygon|intersect|degenerate/i);
});
test('water island crossing the outer shoreline is rejected',()=>{
 const f=source();addHole(f,[[.002,-.002],[.012,-.002],[.012,-.004],[.002,-.004]]);
 assert.throws(()=>importRegionSource(f,options),/hole|outer|intersect/i);
});
test('water island touching the shoreline is rejected as ambiguous',()=>{
 const f=source();addHole(f,[[.002,-.002],[.01,-.002],[.01,-.004],[.002,-.004]]);
 assert.throws(()=>importRegionSource(f,options),/hole|outer|intersect/i);
});
test('overlapping water holes cannot silently double-subtract the lake',()=>{
 const f=source();addHole(f,island);addHole(f,[[.003,-.003],[.006,-.003],[.006,-.006],[.003,-.006]],21);
 assert.throws(()=>importRegionSource(f,options),/hole|overlap|ambiguous/i);
});
test('nested holes are rejected instead of guessed as islands',()=>{
 const f=source();addHole(f,island);addHole(f,[[.0025,-.0025],[.0035,-.0025],[.0035,-.0035],[.0025,-.0035]],21);
 assert.throws(()=>importRegionSource(f,options),/hole|overlap|ambiguous/i);
});
test('two valid disjoint islands keep their original vertices',()=>{
 const f=source();addHole(f,island);addHole(f,[[.006,-.006],[.008,-.006],[.008,-.008],[.006,-.008]],21);
 const before=structuredClone(f),r=importRegionSource(f,options);
 assert.equal(r.water.length,1);assert.equal(r.water[0].polygons[0].holes.length,2);assert.deepEqual(f,before);assert.equal(r.runtimeReady,false);
});
test('valid reversed water rings remain accepted',()=>{
 const f=source();addHole(f,[...island].reverse());
 assert.equal(importRegionSource(f,options).water[0].polygons[0].holes.length,1);
});
test('large finite spatial queries use occupied bins and retain the cap',()=>{
 const sites=Array.from({length:120},(_,i)=>({id:String(i),x:i,z:0}));
 assert.equal(createSiteIndex(sites)({x:0,z:0},Number.MAX_VALUE,1000).length,96);
 assert.equal(createSiteIndex(sites,Number.MIN_VALUE)({x:0,z:0},1,10).length,2);
 assert.deepEqual(createSiteIndex(sites)({x:0,z:0},100,0),[]);
});
test('an island edge escaping a concave shoreline is rejected',()=>{
 const f=source(),outline=[[0,0],[.01,0],[.01,-.01],[.006,-.01],[.006,-.004],[.004,-.004],[.004,-.01],[0,-.01]];
 const ids=outline.map(([lon,lat],i)=>{f.elements.push({type:'node',id:1000+i,lon,lat});return 1000+i;});
 f.elements.find(e=>e.id===11).nodes=[...ids,ids[0]];
 addHole(f,[[.003,-.006],[.007,-.006],[.007,-.008],[.003,-.008]]);
 assert.throws(()=>importRegionSource(f,options),/hole|outer|intersect/i);
});
test('zero-area polygons with distinct node IDs are rejected',()=>{
 const f=source();f.elements.find(e=>e.id===3).lat=0;f.elements.find(e=>e.id===3).lon=.02;
 f.elements.find(e=>e.id===11).nodes=[1,2,3,1];
 assert.throws(()=>importRegionSource(f,options),/degenerate|polygon/i);
});
test('two island boundaries touching are rejected',()=>{
 const f=source();addHole(f,island);addHole(f,[[.004,-.002],[.006,-.002],[.006,-.004],[.004,-.004]],21);
 assert.throws(()=>importRegionSource(f,options),/hole|overlap|ambiguous/i);
});
