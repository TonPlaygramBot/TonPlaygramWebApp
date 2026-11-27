import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,FREE_ROAM} from '../webapp/src/games/tiranastreets-november/shared/engine.mjs';
import {StreetSimulation} from '../webapp/src/games/tiranastreets-november/street-career/StreetSimulation.mjs';
import {trafficDecision} from '../webapp/src/games/tiranastreets-november/shared/trafficSimulation.mjs';

test('public solo campaign never creates scheduled protest state and keeps normal city life',()=>{
 const state=createState([{id:'local',name:'Player'}],FREE_ROAM.id,'solo');
 const sim=new StreetSimulation(state);
 const roles=state.npcs.map(n=>n.kind);
 assert.ok(roles.includes('civilian'));
 assert.ok(state.units.length || state.npcs.some(n=>n.kind==='police'||n.role==='patrol'));
 assert.ok(state.traffic.length);
 for(const elapsed of [0,25,90,180,300,1200]){
  state.elapsed=elapsed;
  sim.step(1/60);
  assert.equal(Object.hasOwn(state,'cityEvent'),false);
  assert.ok(!state.npcs.some(n=>n.role==='protester'||n.cityEvent||n.id.startsWith('rally-')));
 }
 assert.equal(sim.setCityEvents,undefined);
 assert.ok(sim.beginMission('first-shift'));
 sim.step(1/60);
 assert.equal(state.missionId,'first-shift');
 assert.equal(Object.hasOwn(state,'cityEvent'),false);
});

test('obsolete closure input cannot interfere with normal pedestrian braking',()=>{
 const car={id:'ego',x:7000,z:5000,heading:0,speed:10,vx:0,vz:-10,cruise:12,model:'sedan'};
 const walker={id:'crossing',x:7003,z:4990,heading:Math.PI/2,speed:2,health:100};
 assert.equal(trafficDecision(car,[],[walker],0).reason,'pedestrian');
 assert.deepEqual(trafficDecision(car,[],[walker],0,{enabled:true,phase:'cordon'}),trafficDecision(car,[],[walker],0));
});
