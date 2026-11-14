import test from 'node:test';
import assert from 'node:assert/strict';
import {createMissionDirector,updateMissionDirector,missionGrade} from '../webapp/src/games/tiranastreets/street-career/missionDirectorCore.mjs';
import {createState,MISSIONS} from '../webapp/src/games/tiranastreets/shared/engine.mjs';
import {StreetSimulation} from '../webapp/src/games/tiranastreets/street-career/StreetSimulation.mjs';
import {StreetWorld} from '../webapp/src/games/tiranastreets/street-career/spatialCore.mjs';

import {WEAPONS,STARTER_WEAPON} from '../webapp/src/games/tiranastreets/shared/weapons.mjs';

const mission=id=>MISSIONS.find(m=>m.id===id);
const frame=(patch={})=>({health:100,distance:2,speed:0,remaining:0,driving:false,onFoot:true,grounded:true,parcel:false,wanted:0,final:true,firing:false,...patch});
function advance(d,m,f,seconds){for(let t=0;t<seconds-1e-8;t+=1/60)updateMissionDirector(d,m,f,1/60);}
function simulation(id){
  const state=createState([{id:'local',name:'Test'}],id,'solo');
  const sim=new StreetSimulation(state,new StreetWorld([],false));
  state.npcs=[];state.cars=[];state.traffic=[];state.units=[];state.nextDispatch=1e9;
  Object.assign(sim.player,{wanted:0,health:100,speed:0});
  return sim;
}
function tick(sim,seconds){for(let t=0;t<seconds-1e-8;t+=1/60)sim.step(1/60);}

test('defense requires a cleared area, on-foot stationarity and uninterrupted simulation time',()=>{
  const d=createMissionDirector({extracting:true}),m=mission('boulevard-defense');
  for(const invalid of [{remaining:1},{distance:30},{driving:true},{speed:2},{onFoot:false},{grounded:false}]){advance(d,m,frame(invalid),14);assert.equal(d.hold,0);}
  advance(d,m,frame(),8);assert.ok(d.hold>7.99);
  advance(d,m,frame({paused:true}),8);assert.ok(d.hold<8.01);
  updateMissionDirector(d,m,frame({health:95}),1/60);assert.equal(d.hold,0);
  advance(d,m,frame({health:95}),12);assert.ok(d.hold>=12-1e-7);
  updateMissionDirector(d,m,frame({health:95,damageAt:30}),1/60);assert.equal(d.hold,0,'armor-absorbed hits also interrupt extraction');
});
test('pursuit hideout cannot be completed while wanted, moving or firing',()=>{
  const d=createMissionDirector(),m=mission('after-hours');
  for(const invalid of [{wanted:1},{speed:3},{firing:true},{driving:false},{distance:20}]){advance(d,m,frame({driving:true,...invalid}),4);assert.equal(d.hold,0);}
  advance(d,m,frame({driving:true}),2);assert.ok(d.hold<3);
  updateMissionDirector(d,m,frame({driving:true,firing:true}),1/60);assert.equal(d.hold,0);
  advance(d,m,frame({driving:true}),3);assert.ok(d.hold>=3-1e-7);
});
test('flight extraction requires the correct aircraft stably landed for two seconds',()=>{
  const d=createMissionDirector(),m=mission('air-rescue');
  for(const invalid of [{correctAircraft:false},{airborne:true},{verticalSpeed:2},{speed:4}]){advance(d,m,frame({correctAircraft:true,verticalSpeed:0,airborne:false,...invalid}),3);assert.equal(d.hold,0);}
  advance(d,m,frame({correctAircraft:true,verticalSpeed:0,airborne:false}),2);assert.ok(d.hold>=2-1e-7);
});
test('cargo damage counts actual health losses once and a replacement car does not create damage',()=>{
  const d=createMissionDirector(),m=mission('express');
  updateMissionDirector(d,m,frame({parcel:true,vehicleId:'a',vehicleHealth:140}),1/60);
  updateMissionDirector(d,m,frame({parcel:true,health:90,vehicleId:'a',vehicleHealth:100}),1/60);
  assert.equal(d.integrity,80);assert.equal(d.damageTaken,10);assert.equal(d.vehicleDamage,40);
  advance(d,m,frame({parcel:true,health:90,vehicleId:'a',vehicleHealth:100}),1);assert.equal(d.integrity,80);
  updateMissionDirector(d,m,frame({parcel:true,health:100,vehicleId:'b',vehicleHealth:20}),1/60);assert.equal(d.integrity,80);
  const tutorial=createMissionDirector();updateMissionDirector(tutorial,mission('first-shift'),frame({parcel:true,health:1}),1/60);assert.equal(tutorial.integrity,100);
});
test('cargo loss fails once and destroyed-vehicle recovery has a bounded resettable window',()=>{
  const cargo=createMissionDirector({integrity:1});updateMissionDirector(cargo,mission('express'),frame({parcel:true,health:90}),1/60);assert.match(cargo.failure,/delivery/);
  const d=createMissionDirector(),m=mission('lana-run');
  advance(d,m,frame({vehicleDestroyed:true}),12);assert.ok(d.recovery>11.99);assert.equal(d.failure,'');
  updateMissionDirector(d,m,frame({driving:true}),1/60);assert.equal(d.recovery,0);
  advance(d,m,frame({vehicleDestroyed:true}),20);assert.match(d.failure,/vehicle/);
});
test('cleared rescue uses the real interaction and engine completion path',()=>{
  const sim=simulation('rinia-rescue'),stop=sim.mission.stops[0];
  Object.assign(sim.player,{x:stop.x,z:stop.z+2});
  sim.body.yaw=sim.intent.yaw=0;sim.body.pitch=sim.intent.pitch=-.4;
  tick(sim,.1);assert.equal(sim.player.finished,false);
  assert.equal(sim.execute('interact','objective:0'),true);
  tick(sim,.6);assert.equal(sim.job.director.extracting,true);assert.equal(sim.player.finished,false);
  tick(sim,1);sim.pause();const hold=sim.job.director.hold;tick(sim,2);assert.equal(sim.job.director.hold,hold);
  sim.resume();tick(sim,2);assert.equal(sim.player.finished,true);assert.equal(sim.state.phase,'finished');
});
test('pursuit engine does not award a drive-through at the final hideout',()=>{
  const sim=simulation('after-hours'),p=sim.player,t=sim.mission.stops.at(-1);
  p.index=sim.job.stage=sim.mission.stops.length-1;
  const car={id:'owned',model:'sedan',x:t.x,z:t.z,heading:0,speed:0,vx:0,vz:0,steering:0,health:140,driver:'local'};
  sim.state.cars=[car];Object.assign(p,{x:t.x,z:t.z,carId:car.id});sim.job.vehicleId=car.id;sim.body.interaction='driving';
  tick(sim,1);assert.equal(p.finished,false);assert.ok(sim.job.director.hold>0);
  tick(sim,2.1);assert.equal(p.finished,true);assert.equal(sim.state.phase,'finished');
});
test('combat extraction resets when airborne or boarding an aircraft',()=>{
  const sim=simulation('boulevard-defense'),stop=sim.mission.stops[0];
  Object.assign(sim.player,{x:stop.x,z:stop.z,speed:0});sim.state.objectiveRemaining=0;
  sim.job.director.extracting=true;sim.approved=0;
  for(const kind of ['jump','aircraft']){
    sim.body.grounded=true;sim.player.aircraftId=null;
    sim.job.director.hold=4;
    if(kind==='jump')sim.body.grounded=false;
    if(kind==='aircraft')sim.player.aircraftId=sim.flight.aircraft[0].id;
    sim.updateObjective(1/60);assert.equal(sim.job.director.hold,0,kind);assert.equal(sim.canAdvance(sim.player,sim.mission),false,kind);
  }
  sim.body.grounded=true;sim.player.aircraftId=null;
  sim.updateObjective(1/60);assert.ok(sim.job.director.hold>0,'grounded on-foot extraction resumes normally');
});
