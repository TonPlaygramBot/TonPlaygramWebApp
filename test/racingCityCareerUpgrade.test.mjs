import test from 'node:test';
import assert from 'node:assert/strict';
import {CITY_JOBS,createCityJob,stepCityJob,finishCityJob,freshCityCareer,normalizeCityCareer,cityCareerXP,saveCityCareer,loadCityCareer} from '../webapp/src/games/kartroyale/cityJobs.mjs';
import {driverPose,DRIVER_REST,DRIVER_LEGS} from '../webapp/src/games/kartroyale/driverPose.mjs';
import {makeTrack,createRacer,STEP,stepRacer} from '../webapp/src/games/kartroyale/simulation.mjs';
import {planRacecraft} from '../webapp/src/games/kartroyale/racecraft.mjs';
const len=(a,b)=>Math.hypot(...a.map((n,i)=>n-b[i]));
function session(id='market-courier'){const job=CITY_JOBS.find(j=>j.id===id),track=makeTrack(job.track);return {job,state:createCityJob(id,track),r:createRacer(track,'you','You'),track};}
function stopAt(state,r,target){Object.assign(r,{x:target.x,z:target.z,speed:0});for(let i=0;i<95;i++)stepCityJob(state,r,STEP);}
test('delivery requires every stop and a stationary handover; fast drive-through cannot complete',()=>{
 const {state,r}=session();const target=state.targets[0];Object.assign(r,{x:target.x,z:target.z,speed:18});for(let i=0;i<100;i++)stepCityJob(state,r,STEP);assert.equal(state.stage,0);
 for(const target of state.targets)stopAt(state,r,target);assert.equal(state.status,'complete');assert.equal(state.stage,3);
 const out=finishCityJob(freshCityCareer(),state);assert.equal(out.xp,120);assert.equal(cityCareerXP(out.profile),120);assert.equal(finishCityJob(out.profile,state).xp,0);
});
test('timeout, cargo damage and invalid results never award city XP',()=>{
 const a=session();a.state.elapsed=a.job.seconds-.01;stepCityJob(a.state,a.r,STEP);assert.equal(a.state.status,'failed');
 const b=session('medical-express');b.r.health=79;stepCityJob(b.state,b.r,STEP);assert.equal(b.state.status,'failed');
 assert.equal(finishCityJob(freshCityCareer(),a.state).xp,0);assert.equal(finishCityJob(freshCityCareer(),{...a.state,status:'complete',medal:3}).xp,0);
 const c=session();stepCityJob(c.state,c.r,0);assert.equal(c.state.elapsed,0);
});
test('progression survives corrupt storage and never erases existing race career keys',()=>{
 const values=new Map([['tonplaygram.kartroyale.career.v1','existing']]),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
 const p=normalizeCityCareer({version:1,medals:{'market-courier':3,unknown:3,'pyramid-drift':99},best:{'market-courier':70}});
 assert.deepEqual(p.medals,{'market-courier':3});assert.equal(saveCityCareer(storage,p),true);assert.deepEqual(loadCityCareer(storage),p);assert.equal(values.get('tonplaygram.kartroyale.career.v1'),'existing');
 assert.equal(saveCityCareer({setItem(){throw Error();}},p),false);assert.deepEqual(loadCityCareer({getItem(){return '{broken';}}),freshCityCareer());
});
test('all six job routes exist; locked jobs cannot earn rewards ahead of progression',()=>{
 for(const job of CITY_JOBS){const {state}=session(job.id);assert.equal(state.targets.length,job.stops.length);assert.ok(state.targets.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.z)));}
 const {state,r}=session('medical-express');for(const target of state.targets)stopAt(state,r,target);assert.equal(state.status,'complete');assert.equal(finishCityJob(freshCityCareer(),state).xp,0);
});
test('drift score needs physical movement and banks only a clean released chain',()=>{
 const {state,r}=session('pyramid-drift');r.speed=12;r.drifting=true;r.steering=.6;
 stepCityJob(state,r,STEP);for(let i=0;i<20;i++)stepCityJob(state,r,STEP);assert.equal(state.chain,0,'stationary spoof is not a drift');
 for(let i=0;i<100;i++){r.z+=.2;stepCityJob(state,r,STEP);}assert.ok(state.chain>20);assert.equal(state.score,0);
 r.impactId++;stepCityJob(state,r,STEP);assert.equal(state.chain,0);
 for(let i=0;i<100;i++){r.z+=.2;stepCityJob(state,r,STEP);}r.drifting=false;r.z+=.2;stepCityJob(state,r,STEP);assert.ok(state.score>20);assert.equal(state.chain,0);
});
test('recovering across a checkpoint never collects the checkpoint in that step',()=>{
 const {state,r}=session('riverside-patrol');stepCityJob(state,r,STEP);Object.assign(r,{x:state.targets[0].x,z:state.targets[0].z,speed:15,recoveryAt:1});stepCityJob(state,r,STEP);assert.equal(state.stage,0);
});
test('precision job counts only smooth movement inside the speed band',()=>{
 const {state,r}=session('stadium-survey');stepCityJob(state,r,STEP);r.speed=15;
 for(let i=0;i<60;i++){r.z+=.25;stepCityJob(state,r,STEP);}assert.ok(state.score>.9);
 const before=state.score;r.speed=25;for(let i=0;i<60;i++){r.z+=.4;stepCityJob(state,r,STEP);}assert.equal(state.score,before);
});
test('hands follow the wheel rim and all limb lengths remain stable through steering and pedals',()=>{
 for(const steer of [-1,-.5,0,.5,1])for(const brake of [0,1]){
  const pose=driverPose(steer,-20,.4,22,1,false,{throttle:1-brake,brake,side:.02,forward:.01});
  for(const side of ['l','r']){const arm=pose.arms[side],rest=DRIVER_REST[side];assert.ok(Math.abs(Math.hypot(arm.hand[0],arm.hand[1]-.70)-.16)<1e-10);assert.ok(Math.abs(len(arm.shoulder,arm.elbow)-len(rest.shoulder,rest.elbow))<1e-6);assert.ok(Math.abs(len(arm.hand,arm.elbow)-len(rest.hand,rest.elbow))<1e-6);
   const leg=pose.legs[side],lr=DRIVER_LEGS[side];assert.ok(Math.abs(len(leg.hip,leg.knee)-len(lr.hip,lr.knee))<1e-6);assert.ok(Math.abs(len(leg.ankle,leg.knee)-len(lr.ankle,lr.knee))<.005);
  }
 }
 assert.equal(driverPose(1,20,1,30,5,true,{side:.1,forward:.1}).lean,0);
});
test('rivals choose a clear passing side and brake when boxed in',()=>{
 const track=makeTrack('blloku'),r=createRacer(track,'r','R',1,true),lead=createRacer(track,'lead','Lead');
 Object.assign(r,{x:0,z:0,yaw:0,speed:25,aiLane:0});Object.assign(lead,{x:0,z:6,yaw:0,speed:10});
 const near={lane:0,width:6,yaw:0},side={...lead,id:'side',x:2,z:0,speed:25};
 const plan=planRacecraft(r,near,[r,lead,side],5);assert.ok(plan.lane>0,'screen-right is the free side');assert.ok(plan.speedLimit<r.speed);
 const blocked=planRacecraft(r,{...near,width:2},[r,{...lead,z:2}],5);assert.equal(blocked.blocked,true);
});
test('normal steering never triggers rollover and controls retain screen-relative direction',()=>{
 for(const steer of [-1,1]){const {r,track}=session();const yaw=r.yaw;for(let i=0;i<25;i++)stepRacer(r,{throttle:true,steer},track,STEP,i*STEP);assert.ok((r.yaw-yaw)*steer<0);assert.equal(r.rollAngle,0);}
});
