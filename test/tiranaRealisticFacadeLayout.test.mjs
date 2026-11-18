import test from 'node:test';
import assert from 'node:assert/strict';
import {realisticFacadeLayout,selectRealisticFacades} from '../webapp/src/games/tirana-environment/realisticFacadeLayout.mjs';
import {polygonContains} from '../webapp/src/games/tiranastreets/shared/architecture.mjs';
const world={buildings:[{id:'fixture-rectangle',h:12,p:[[0,0],[12,0],[12,9],[0,9]]},{id:'fixture-concave',h:9,p:[[30,0],[42,0],[42,6],[36,6],[36,12],[30,12]]}]};
test('realistic bays retain mapped outlines and face outward at upright metre scale',()=>{
 const before=JSON.stringify(world),buildings=realisticFacadeLayout(world);
 assert.equal(buildings.length,2);assert.equal(JSON.stringify(world),before);
 for(const b of buildings){const original=world.buildings.find(v=>v.id===b.id);
  for(const p of b.placements){assert.ok(p.width>=2.5&&p.width<=4);assert.ok(p.height>=2.5&&p.height<=4);
   assert.ok(!polygonContains(p.x+Math.sin(p.yaw)*.1,p.z+Math.cos(p.yaw)*.1,original.p));
   assert.ok(p.y>=0&&p.y+p.height<=original.h+1e-6);
  }
 }
});
test('reference exclusions and road clearance never receive invented modules',()=>{
 assert.deepEqual(realisticFacadeLayout(world,new Set(world.buildings.map(b=>b.id))),[]);
 assert.deepEqual(realisticFacadeLayout(world,new Set(),()=>true),[]);
 assert.equal(realisticFacadeLayout({buildings:[{...world.buildings[0],neighbourhood:'protected'}]}).length,0);
});
test('whole-building nearest selection respects mobile instance budgets and deterministic ties',()=>{
 const b=realisticFacadeLayout(world),many=Array.from({length:20},(_,i)=>({...b[i%2],id:String(i),x:i,z:0}));
 for(const battery of [false,true]){const selected=selectRealisticFacades(many,{x:0,z:0},battery);
  assert.ok(selected.length>0);assert.ok(selected.reduce((sum,b)=>sum+b.placements.length,0)<=(battery?160:480));
  assert.deepEqual(selected,selectRealisticFacades(many,{x:0,z:0},battery));
 }
 assert.deepEqual(selectRealisticFacades(many,{x:5000,z:5000}),[]);
});
