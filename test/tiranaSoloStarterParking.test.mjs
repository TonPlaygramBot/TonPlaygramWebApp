import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createState,FREE_ROAM,SPAWN,collideVehicle} from '../webapp/src/games/tiranastreets-november/shared/engine.mjs';
import {StreetSimulation} from '../webapp/src/games/tiranastreets-november/street-career/StreetSimulation.mjs';
import {CANOPY_TREES} from '../webapp/src/games/tirana-street-life/canopyRegistry.mjs';
import {RAILINGS} from '../webapp/src/games/tiranastreets/shared/landscape.mjs';
import {VERIFIED_RAIL_PIECES} from '../webapp/src/games/tiranastreets-november/shared/verifiedStreetDecorData.mjs';
const railGap=(p,r)=>{
 const x=Math.sin(r.yaw),z=Math.cos(r.yaw),dx=p.x-r.x,dz=p.z-r.z;
 const t=Math.max(-r.length/2,Math.min(r.length/2,dx*x+dz*z));
 return Math.hypot(dx-x*t,dz-z*t);
};
const create=(mode='solo',mission=FREE_ROAM.id)=>createState([{id:'local',name:'Pilot'}],mission,mode);
test('fresh solo can see and enter the starter car outside the mapped tree envelope',()=>{
 const state=create(),sim=new StreetSimulation(state),c=state.cars.find(c=>c.id==='car-local');
 assert.equal(c.collectionVehicle,'golf-gti');
 assert.ok(CANOPY_TREES.every(t=>Math.hypot(t.x-c.x,t.z-c.z)>6));
 assert.equal(collideVehicle({...c}).length,0);
 assert.ok(Math.hypot(c.x-sim.player.x,c.z-sim.player.z)<3);
 assert.ok(sim.candidates().some(v=>v.label==='HYR'&&v.enabled&&v.targetId===c.id));
 sim.resume();
 assert.equal(sim.execute('interact',c.id),true);
 for(let i=0;i<72;i++)sim.step(1/60);
 assert.equal(sim.player.carId,c.id);
});
test('the special parking placement does not change team or mission starts',()=>{
 for(const [mode,id] of [['team',FREE_ROAM.id],['solo','first-shift']]){
  const c=create(mode,id).cars.find(c=>c.id==='car-local');
  assert.ok(Math.hypot(c.x-SPAWN.x,c.z-SPAWN.z)<2);
 }
});

test('starter bay departure can reach the public lane without a roadside rail or solid overlap',()=>{
 const c=create().cars.find(c=>c.id==='car-local');
 const ux=-Math.sin(c.heading),uz=-Math.cos(c.heading),rails=[...RAILINGS,...VERIFIED_RAIL_PIECES];
 for(let step=0;step<=12;step++){
  const t=step/12,q={...c,x:c.x+(ux*7+uz*6.05)*t,z:c.z+(uz*7-ux*6.05)*t};
  assert.ok(rails.every(r=>railGap(q,r)>2.15),'roadside barrier intersects departure');
  assert.equal(collideVehicle(q).length,0,'solid overlap on departure');
 }
});
