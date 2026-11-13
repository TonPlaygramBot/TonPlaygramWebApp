import test from 'node:test';
import assert from 'node:assert/strict';
import {MISSIONS,FREE_ROAM,createState,missionElapsed,advanceState,WORLD,collideVehicle} from '../webapp/src/games/tiranastreets/shared/engine.mjs';
import {vehicleSeparation} from '../webapp/src/games/tiranastreets/shared/trafficSimulation.mjs';
import {STREET_OPERATIONS} from '../webapp/src/games/tiranastreets/shared/streetOperations.mjs';
import {StreetSimulation} from '../webapp/src/games/tiranastreets/street-career/StreetSimulation.mjs';
import {createCampaign} from '../webapp/src/games/tiranastreets/street-career/campaignCore.mjs';
import {captureCheckpoint,restoreCheckpoint} from '../webapp/src/games/tiranastreets/street-career/checkpointCore.mjs';
import {WEAPONS,STARTER_WEAPON} from '../webapp/src/games/tiranastreets/shared/weapons.mjs';
import {groundHeight} from '../webapp/src/games/tirana-east/terrainCore.mjs';
import {unifiedEntry} from '../webapp/src/games/blackwater/unifiedEntry.mjs';
const campaign=createCampaign(MISSIONS,WEAPONS,STARTER_WEAPON);
const make=()=>new StreetSimulation(createState([{id:'local',name:'Test'}],FREE_ROAM.id,'solo'));
test('legacy entry URLs resolve into the same city campaign or a district operation',()=>{
 for(const q of ['', '?activity=career','?activity=street-career','?activity=explore'])assert.equal(unifiedEntry(q).operation,undefined);
 for(const o of STREET_OPERATIONS)assert.equal(unifiedEntry(`?mode=ai&map=${o.map}`).operation,o.id);
 assert.equal(unifiedEntry('?map=stadium&difficulty=veteran').difficulty,'hard');
 assert.equal(unifiedEntry('?activity=career&map=stadium').operation,undefined,'saved career is never replaced by an old map query');
 assert.equal(unifiedEntry('?map=untrusted').operation,undefined);
});
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
test('all district operation zones, extraction points and opponents have actual urban clearance',()=>{
 const sim=make();
 for(const op of STREET_OPERATIONS){
  assert.equal(sim.beginMission(op.id),true);const m=sim.mission;
  assert.ok(campaign.available(campaign.fresh(),m.id));
  for(const q of [m.combatZone,...m.stops,...sim.state.npcs.filter(n=>n.kind==='gang')]){
   assert.ok(q.x>=WORLD.bounds[0]&&q.x<=WORLD.bounds[2]&&q.z>=WORLD.bounds[1]&&q.z<=WORLD.bounds[3],m.id+' inside city');
   assert.equal(sim.world.clearance({...q,y:groundHeight(q.x,q.z)+.08},1.78,.32),true,m.id+' clear '+JSON.stringify({x:q.x,z:q.z}));
  }
  assert.ok(Math.hypot(m.combatZone.x-m.stops[0].x,m.combatZone.z-m.stops[0].z)>30,'combat and extraction are distinct');
 }
});
test('operation completion uses the real interaction, hold, campaign payout and same-world return',()=>{
 const sim=make();let profile=campaign.begin(campaign.fresh(),'operation-square');sim.state.elapsed=2400;sim.beginMission(profile.active.id);
 const world=sim.state,cars=world.cars,p=sim.player,stop=sim.mission.stops[0];
 // Remove ambient actors solely to make the timed extraction deterministic.
 world.npcs=[];world.traffic=[];world.units=[];world.objectiveRemaining=0;
 Object.assign(p,{x:stop.x,z:stop.z+2,wanted:0});sim.body.y=groundHeight(p.x,p.z)+.08;sim.body.yaw=sim.intent.yaw=0;sim.body.pitch=sim.intent.pitch=-.4;
 for(let i=0;i<6;i++)sim.step(1/60);
 assert.equal(sim.execute('interact','objective:0'),true);
 for(let i=0;i<300;i++)sim.step(1/60);
 assert.equal(p.finished,true);assert.equal(world.phase,'finished');assert.ok(p.finishTime<6,'mission time excludes prior free-roam time');
 profile=campaign.resolve(profile,world,'local');assert.ok(profile.completed.includes('operation-square'));assert.equal(profile.loadout.cash,1250);
 assert.equal(sim.beginMission(FREE_ROAM.id),true);assert.equal(sim.state,world);assert.equal(world.cars,cars);assert.equal(p.finished,false);assert.equal(world.phase,'active');
});
test('operation checkpoints retain relative mission time and free-roam checkpoints migrate in v1 saves',()=>{
 const sim=make();sim.state.elapsed=1700;sim.beginMission('operation-square');sim.state.elapsed+=19;
 let profile=campaign.begin(campaign.fresh(),sim.mission.id);profile.active.phase=captureCheckpoint(sim);
 profile=campaign.normalize(JSON.parse(JSON.stringify(profile)));assert.equal(profile.active.phase.missionStartedAt,1700);
 const restored=make();restored.beginMission(profile.active.id);assert.equal(restoreCheckpoint(restored,profile.active.phase,campaign.apply),true);assert.equal(missionElapsed(restored.state),19);
 sim.beginMission(FREE_ROAM.id);profile=campaign.abandon(profile);profile.explore=captureCheckpoint(sim);
 const saved=campaign.normalize(JSON.parse(JSON.stringify(profile)));assert.equal(saved.explore.player.x,sim.player.x);assert.equal(saved.explore.player.z,sim.player.z);
 const old={...campaign.fresh()};delete old.explore;assert.equal(campaign.normalize(old).explore,null);
});
test('old rural and invalid vehicle checkpoints fall back before mutating the player',()=>{
 const sim=make(),saved=captureCheckpoint(sim),before={x:sim.player.x,z:sim.player.z,health:sim.player.health};
 for(const kind of ['player','car','aircraft']){
  const raw=structuredClone(saved);
  if(kind==='player')Object.assign(raw.player,{x:7331,z:-528});
  if(kind==='car')raw.car={id:'saved-rural',model:'sedan',x:7331,z:-528,heading:0};
  if(kind==='aircraft')raw.aircraft={kind:'helicopter',x:7331,z:-528,y:80,heading:0};
  assert.equal(restoreCheckpoint(sim,raw,campaign.apply),false,kind);
  assert.deepEqual({x:sim.player.x,z:sim.player.z,health:sim.player.health},before);
 }
 const mismatch=structuredClone(saved);mismatch.car={id:'mismatch',model:'sedan',x:saved.player.x+50,z:saved.player.z,heading:0};assert.equal(restoreCheckpoint(sim,mismatch,campaign.apply),false);
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
