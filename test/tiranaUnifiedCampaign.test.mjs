import test from 'node:test';
import assert from 'node:assert/strict';
import {MISSIONS,FREE_ROAM,createState,missionElapsed,advanceState,WORLD,collideVehicle} from '../webapp/src/games/tiranastreets/shared/engine.mjs';
import {vehicleSeparation} from '../webapp/src/games/tiranastreets/shared/trafficSimulation.mjs';
import {STREET_OPERATIONS} from '../webapp/src/games/tiranastreets/shared/streetOperations.mjs';
import {StreetSimulation} from '../webapp/src/games/tiranastreets/street-career/StreetSimulation.mjs';

import {WEAPONS,STARTER_WEAPON} from '../webapp/src/games/tiranastreets/shared/weapons.mjs';
import {groundHeight} from '../webapp/src/games/tirana-east/terrainCore.mjs';

const make=()=>new StreetSimulation(createState([{id:'local',name:'Test'}],FREE_ROAM.id,'solo'));

test('jobs transition in place, preserving live traffic, vehicle damage, body and NPC police',()=>{
 const sim=make(),state=sim.state,p=sim.player,cars=state.cars,traffic=state.traffic,body=sim.body,access=sim.access;
 const car=cars[0];Object.assign(car,{health:71,driver:p.id});p.carId=car.id;p.health=74;p.x=car.x;p.z=car.z;
 const inventory=p.inventory,police=state.npcs.filter(n=>n.kind==='police');state.elapsed=1800;
 assert.equal(sim.beginMission('operation-square','hard'),true);
 assert.equal(sim.state,state);assert.equal(state.cars,cars);assert.equal(state.traffic,traffic);assert.equal(p.inventory,inventory);assert.equal(sim.body,body);assert.equal(sim.access,access);
 assert.equal(car.health,71);assert.equal(p.health,74);assert.equal(p.carId,car.id);assert.equal(missionElapsed(state),0);
 assert.ok(police.every(n=>state.npcs.includes(n)));
 assert.equal(state.npcs.filter(n=>n.kind==='gang').length,4);
 assert.ok(state.npcs.filter(n=>n.kind==='gang').every(n=>n.nextShot>=1803));
 state.elapsed+=23;assert.equal(missionElapsed(state),23);
 assert.equal(sim.beginMission(FREE_ROAM.id),true);assert.equal(state.npcs.filter(n=>n.kind==='gang').length,0);assert.equal(p.carId,car.id);assert.equal(car.health,71);
});
test('dead, arrested, unknown and online mission starts do not mutate the live session',()=>{
 const sim=make();sim.player.health=0;assert.equal(sim.beginMission('operation-square'),false);assert.equal(sim.state.missionId,FREE_ROAM.id);
 sim.player.health=100;sim.player.arrest={phase:'transport'};assert.equal(sim.beginMission('operation-square'),false);delete sim.player.arrest;
 assert.equal(sim.beginMission('unknown'),false);sim.state.mode='coop';assert.equal(sim.beginMission('operation-square'),false);assert.equal(sim.state.missionId,FREE_ROAM.id);
});

test('a race accepted from a building or the driver seat spawns its rival on a clear street without moving the player',()=>{
 const sim=make(),p=sim.player,car=sim.state.cars[0];
 const building=WORLD.buildings.find(b=>b.h>18&&b.p.length>=4&&Math.hypot(b.p[0][0],b.p[0][1])<300);
 const roof={x:building.p.reduce((n,q)=>n+q[0],0)/building.p.length,z:building.p.reduce((n,q)=>n+q[1],0)/building.p.length};
 for(const mode of ['roof','driver']){
  sim.beginMission(FREE_ROAM.id);
  if(mode==='roof'){Object.assign(p,roof,{carId:null});sim.body.y=building.h;}
  else{Object.assign(p,{x:car.x,z:car.z,carId:car.id});car.driver=p.id;car.health=57;}
  const before={x:p.x,z:p.z,carId:p.carId,y:sim.body.y};
  assert.equal(sim.beginMission('lana-run'),true,mode);
  assert.deepEqual({x:p.x,z:p.z,carId:p.carId,y:sim.body.y},before,mode+' preserves player');
  const rival=sim.state.rival;assert.ok(rival,mode);assert.ok(rival.path.length>1);
  assert.deepEqual(collideVehicle({...rival}),[],mode+' full footprint clear');
  assert.ok([...sim.state.cars,...sim.state.traffic,...sim.state.units].every(other=>!vehicleSeparation(rival,other)),mode+' vehicle spacing');
  assert.ok(Math.hypot(rival.x-p.x,rival.z-p.z)>=4,mode+' player spacing');
  assert.equal(car.health,mode==='driver'?57:car.health);
 }
});
