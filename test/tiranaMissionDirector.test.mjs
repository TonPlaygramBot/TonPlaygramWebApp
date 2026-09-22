import test from 'node:test';
import assert from 'node:assert/strict';
import {createMissionDirector,updateMissionDirector,missionGrade} from '../webapp/src/games/tiranastreets/street-career/missionDirectorCore.mjs';
import {createState,MISSIONS} from '../webapp/src/games/tiranastreets/shared/engine.mjs';
import {StreetSimulation} from '../webapp/src/games/tiranastreets/street-career/StreetSimulation.mjs';
import {StreetWorld} from '../webapp/src/games/tiranastreets/street-career/spatialCore.mjs';
import {captureCheckpoint,restoreCheckpoint,normalizeCheckpoint} from '../webapp/src/games/tiranastreets/street-career/checkpointCore.mjs';
import {createCampaign} from '../webapp/src/games/tiranastreets/street-career/campaignCore.mjs';
import {WEAPONS,STARTER_WEAPON} from '../webapp/src/games/tiranastreets/shared/weapons.mjs';
import {CHAPTERS,freshCareer,startChapter,currentStep,advanceCareer,normalizeCareer,careerBalance} from '../webapp/src/games/tiranastreets/career/careerCore.mjs';
const campaign=createCampaign(MISSIONS,WEAPONS,STARTER_WEAPON);
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
function completeStory(profile){while(profile.active){const s=currentStep(profile);profile=advanceCareer(profile,{type:'interact',...s,distance:1,lineOfSight:true,completedJourney:true});}return profile;}

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
test('combat extraction resets when airborne, boarding an aircraft or riding the cableway',()=>{
  const sim=simulation('boulevard-defense'),stop=sim.mission.stops[0];
  Object.assign(sim.player,{x:stop.x,z:stop.z,speed:0});sim.state.objectiveRemaining=0;
  sim.job.director.extracting=true;sim.approved=0;
  for(const kind of ['jump','aircraft','cableway']){
    sim.body.grounded=true;sim.player.aircraftId=null;sim.cableRide=null;
    sim.job.director.hold=4;
    if(kind==='jump')sim.body.grounded=false;
    if(kind==='aircraft')sim.player.aircraftId=sim.flight.aircraft[0].id;
    if(kind==='cableway')sim.cableRide={fraction:.5,returning:false};
    sim.updateObjective(1/60);assert.equal(sim.job.director.hold,0,kind);assert.equal(sim.canAdvance(sim.player,sim.mission),false,kind);
  }
  sim.body.grounded=true;sim.player.aircraftId=null;sim.cableRide=null;
  sim.updateObjective(1/60);assert.ok(sim.job.director.hold>0,'grounded on-foot extraction resumes normally');
});
test('vehicle recovery deadline survives save/reload without recreating its wreck and resets on replacement',()=>{
  const sim=simulation('after-hours');
  sim.job.director.recovery=10;sim.job.director.vehicleId='lost-car';sim.job.vehicleId='lost-car';
  const saved=normalizeCheckpoint(captureCheckpoint(sim),x=>x,sim.mission.stops.length);
  const next=simulation('after-hours');assert.equal(restoreCheckpoint(next,saved,campaign.apply),true);
  assert.equal(next.state.cars.length,0);assert.equal(next.job.vehicleId,null);
  next.updateObjective(.1);assert.ok(next.job.director.recovery>10,'missing wreck does not cancel the saved deadline');
  const car={id:'replacement',model:'sedan',health:140,x:next.player.x,z:next.player.z,driver:'local'};
  next.state.cars.push(car);next.player.carId=car.id;next.job.vehicleId=car.id;
  next.updateObjective(.1);assert.equal(next.job.director.recovery,0);
  assert.equal(restoreCheckpoint(next,saved,campaign.apply),true);
  next.player.carId=null;next.state.cars=[];next.job.vehicleId=null;
  for(let i=0;i<100;i++)next.updateObjective(.1);
  assert.equal(next.player.failed,true);assert.match(next.state.message,/vehicle/);
});
test('retry checkpoint detaches director state, restores extraction and preserves vehicle condition',()=>{
  const sim=simulation('boulevard-defense');sim.job.director.extracting=true;sim.job.director.hold=5;sim.job.director.integrity=72;
  const car={id:'owned',model:'sedan',x:sim.player.x,z:sim.player.z,heading:0,health:84,driver:'local'};
  sim.state.cars=[car];sim.player.carId=car.id;
  const saved=captureCheckpoint(sim);sim.job.director.hold=0;sim.job.director.integrity=0;assert.equal(saved.job.director.hold,5);assert.equal(saved.job.director.integrity,72);
  const clean=normalizeCheckpoint(saved,x=>x,1),next=simulation('boulevard-defense');assert.equal(restoreCheckpoint(next,clean,campaign.apply),true);
  assert.equal(next.approved,0);assert.equal(next.job.director.hold,5);assert.equal(next.state.streetMission.director,next.job.director);assert.equal(next.state.cars.find(c=>c.id==='owned').health,84);
  delete saved.job.director;const legacy=normalizeCheckpoint(saved,x=>x,1);assert.equal(legacy.job.director.integrity,100);assert.equal(legacy.job.director.hold,0);
});
test('career grades persist across replays without paying a second reward',()=>{
  let profile=campaign.begin(campaign.fresh(),'first-shift');
  const state={mode:'solo',phase:'finished',missionId:'first-shift',difficulty:'normal',players:{local:{...profile.loadout,finished:true,health:100,finishTime:60}},streetMission:{id:'first-shift',director:createMissionDirector()}};
  profile=campaign.resolve(profile,state,'local');assert.equal(profile.records['first-shift'].grade,'gold');const cash=profile.loadout.cash;
  profile=campaign.begin(profile,'first-shift');state.players.local={...profile.loadout,finished:true,health:100,finishTime:500};state.streetMission.director.damageTaken=200;
  profile=campaign.resolve(profile,state,'local');assert.equal(profile.loadout.cash,cash);assert.equal(profile.records['first-shift'].grade,'gold');assert.equal(profile.records['first-shift'].runs,2);
  assert.equal(missionGrade(createMissionDirector({integrity:40}),500,600),'bronze');
});
test('City Stories verifies items through multiple contacts and still awards each chapter once',()=>{
  let profile=freshCareer();for(const chapter of CHAPTERS){profile=startChapter(profile,chapter.id);while(profile.active){const step=currentStep(profile);assert.ok(step.requires.every(item=>profile.active.items.includes(item)));profile=advanceCareer(profile,{type:'interact',...step,distance:1,lineOfSight:true,completedJourney:true});}}
  assert.equal(careerBalance(profile),1010);assert.equal(Object.keys(profile.grades).length,6);
  assert.equal(careerBalance(completeStory(startChapter(profile,'culture-run'))),1010);
});
test('City Stories migrates old delivery phases and retries a reached checkpoint after timeout',()=>{
  const migrated=normalizeCareer({version:1,completed:['first-contact'],bestTimes:{},active:{id:'culture-run',step:1,elapsed:40,status:'active'}});
  assert.equal(migrated.active.step,2);assert.deepEqual(migrated.active.items,['schedule','entrance-note']);
  assert.equal(normalizeCareer({...migrated,active:{id:'culture-run',step:3,elapsed:0}}).active,null,'an invalid legacy step cannot skip the new route');
  let p=freshCareer();for(const c of CHAPTERS.slice(0,4))p=completeStory(startChapter(p,c.id));
  p=startChapter(p,'last-delivery');p.active.elapsed=30;p=advanceCareer(p,{type:'interact',...currentStep(p),distance:1,lineOfSight:true});assert.equal(p.active.step,1);
  p.active.elapsed=359.99;p=advanceCareer(p,{type:'tick',dt:.05});assert.equal(p.active.status,'failed');
  p=startChapter(p,'last-delivery');assert.equal(p.active.step,1);assert.equal(p.active.elapsed,30);assert.deepEqual(p.active.items,['sealed-parcel']);
  const bad={...p,active:{...p.active,items:[]}};assert.equal(advanceCareer(bad,{type:'interact',...currentStep(bad),distance:1,lineOfSight:true}),bad);
});
