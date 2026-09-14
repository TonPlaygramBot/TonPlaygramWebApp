import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createNearestRoadIndex,createObstacleClearance,obstacleBlocks} from '../webapp/src/games/blackwater/shared/layoutSpatial.mjs';
import {BATTLEFIELD_MAP_CATALOG} from '../webapp/src/games/blackwater/shared/mapCatalog.mjs';

// Use the production narrow-phase geometry without importing its city registry.
const architecture=fs.readFileSync(new URL('../webapp/src/games/tiranastreets/shared/architecture.mjs',import.meta.url),'utf8');
const {footprintDistance}=vm.runInNewContext(architecture.slice(architecture.indexOf('export function polygonContains')).replaceAll('export function','function')+';({footprintDistance})');
const exhaustiveRoad=(roads,x,z)=>{
 let best,distance=Infinity;
 for(const r of roads){
  const dx=r.b[0]-r.a[0],dz=r.b[1]-r.a[1],l=dx*dx+dz*dz,t=l?Math.max(0,Math.min(1,((x-r.a[0])*dx+(z-r.a[1])*dz)/l)):0;
  const px=r.a[0]+dx*t,pz=r.a[1]+dz*t,d=Math.hypot(x-px,z-pz);
  if(d<distance){distance=d;best={x:px,z:pz,road:r,distance:d};}
 }return best;
};
const exhaustiveClear=(obstacles,x,z,r=.5)=>!obstacles.some(o=>o.footprint?footprintDistance(x,z,o.footprint,o.holes)<r:Math.hypot(x-o.x,z-o.z)<Math.hypot(o.w,o.d)/2+r);
const square=(x,z,size)=>[[x-size,z-size],[x+size,z-size],[x+size,z+size],[x-size,z+size]];

test('nearest-road index matches exhaustive projection and source-order ties across cells',()=>{
 const rows=[{id:'first-tie',a:[70,64],b:[110,64]},{id:'later-tie',a:[70,-64],b:[110,-64]},
  {id:'long',a:[-800,-700],b:[-300,700]},{id:'point',a:[500,500],b:[500,500]}];
 for(let x=-12;x<=12;x++)for(let z=-8;z<=8;z++)rows.push({id:`${x}:${z}`,a:[x*160,z*160],b:[x*160+72,z*160+19]});
 const nearest=createNearestRoadIndex(rows);
 for(let i=0;i<600;i++){
  const x=((i*7919)%6001)-3000,z=((i*3571)%4001)-2000;
  assert.deepEqual(nearest(x,z),exhaustiveRoad(rows,x,z),`query ${x},${z}`);
 }
 for(const [x,z] of [[128,128],[-128,-128],[0,0],[500,500],[9000,9000],[Infinity,0],[NaN,1]])assert.deepEqual(nearest(x,z),exhaustiveRoad(rows,x,z));
 const tied=createNearestRoadIndex(rows.slice(0,2));assert.equal(tied(90,0).road,rows[0]);
 assert.equal(createNearestRoadIndex([])(0,0),undefined);
});

test('obstacle broad phase preserves courtyard, strict boundary, radius and circular prop results',()=>{
 const rows=[{footprint:square(0,0,20),holes:[square(0,0,8)]},
  {footprint:[[-140,50],[-80,50],[-100,90],[-140,90]]},{x:80,z:0,w:12,d:18,rot:.7}];
 for(let x=0;x<60;x++)rows.push({footprint:square(1000+x*40,-200+x*20,8)});
 const clear=createObstacleClearance(rows,footprintDistance);
 for(let i=0;i<800;i++)for(const r of [0,.5,3,12]){
  const x=((i*37)%501)-200,z=((i*113)%401)-200;
  assert.equal(clear(x,z,r),exhaustiveClear(rows,x,z,r),`query ${x},${z},${r}`);
 }
 assert.equal(clear(0,0,.5),true);assert.equal(clear(0,0,8),true);assert.equal(clear(0,0,8.001),false);
 assert.equal(clear(20.5,0,.5),true);assert.equal(clear(20.5,0,.501),false);
 for(const [x,z,r] of [[20,0,-1],[Infinity,0,.5],[NaN,0,.5],[0,0,Infinity]])assert.equal(clear(x,z,r),exhaustiveClear(rows,x,z,r));
 let exactChecks=0;const bounded=createObstacleClearance(rows,(...args)=>{exactChecks++;return footprintDistance(...args);});
 bounded(100,0,.5);assert.ok(exactChecks<5,'distant footprints never reach the exact geometry test');
});

test('indexed static obstacles plus growing fleet preserve exhaustive clearance decisions',()=>{
 const statics=[{footprint:square(0,0,8),holes:[square(0,0,3)]},{x:50,z:50,w:8,d:12}],fleet=[];
 const clear=createObstacleClearance(statics,footprintDistance);
 for(let i=0;i<70;i++){
  const x=(i*17)%100-30,z=(i*31)%100-30,r=1+i%6;
  const indexed=clear(x,z,r)&&!fleet.some(o=>obstacleBlocks(o,x,z,r,footprintDistance));
  assert.equal(indexed,exhaustiveClear([...statics,...fleet],x,z,r));
  if(indexed)fleet.push({x,z,w:r,d:r*2});
 }
});

test('the production safeNear search chooses identical sector starts and extractions',()=>{
 const layout=fs.readFileSync(new URL('../webapp/src/games/blackwater/shared/layout.mjs',import.meta.url),'utf8');
 const expression=layout.match(/const safeNear = ([^\n]+);/)[1];
 const makeSafe=new Function('MAP','OBSTACLES','START','nearestRoad','clear',`return ${expression};`);
 const seeds=BATTLEFIELD_MAP_CATALOG.filter((_,i)=>i%11===0),roads=[],obstacles=[];
 for(const s of seeds){
  roads.push({a:[s.worldX-2,s.worldZ],b:[s.worldX+2,s.worldZ]},
   {a:[s.worldX-60,s.worldZ+35],b:[s.worldX+60,s.worldZ+35]});
  obstacles.push({footprint:square(s.worldX,s.worldZ,5)});
 }
 const map={minX:-30000,minZ:-30000,maxX:30000,maxZ:30000},start={x:0,z:0};
 const old=makeSafe(map,obstacles,start,(x,z)=>exhaustiveRoad(roads,x,z),(x,z,r,obs)=>exhaustiveClear(obs,x,z,r));
 const indexedClear=createObstacleClearance(obstacles,footprintDistance);
 const fixed=makeSafe(map,obstacles,start,createNearestRoadIndex(roads),(x,z,r)=>indexedClear(x,z,r));
 for(const s of seeds){
  const expected=old(s.worldX,s.worldZ),actual=fixed(s.worldX,s.worldZ);assert.deepEqual(actual,expected,s.id);
  assert.deepEqual(fixed(actual.x+18,actual.z+(s.id==='blloku'?42:-42)),old(expected.x+18,expected.z+(s.id==='blloku'?42:-42)),`${s.id} extraction`);
 }
});
