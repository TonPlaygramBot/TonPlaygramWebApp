import test from 'node:test';
import assert from 'node:assert/strict';
import {STEP,makeTrack,createRacer,stepRace,stepRacer,aiInput} from '../webapp/src/games/kartroyale/simulation.mjs';
import {createRaceTelemetry,recordTimingGate,stepPowertrain,rivalIntervals} from '../webapp/src/games/kartroyale/raceTelemetry.mjs';
import {GhostRecorder,ghostKey,loadGhost,sampleGhost} from '../webapp/src/games/kartroyale/ghostLap.mjs';
import {planRacecraft,aiRecoveryPose} from '../webapp/src/games/kartroyale/racecraft.mjs';
import {circuitDistance} from '../webapp/src/games/kartroyale/circuitMetrics.mjs';
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};};
const track=makeTrack('skanderbeg');

test('ordered gates record four sectors, reject recovered laps, then allow the next lap',()=>{
 const r=createRacer(track,'you','You');
 recordTimingGate(r,0,2);r.lap=1;r.lapStartedAt=2;
 for(const gate of [1,2,3])recordTimingGate(r,gate,2+gate*10);
 recordTimingGate(r,0,42);
 assert.deepEqual(r.telemetry.lastLap,{time:40,sectors:[10,10,10,10],valid:true,clean:true});
 r.lap=2;r.lapStartedAt=42;
 stepRacer(r,{recover:true},track,STEP,45);
 assert.equal(r.telemetry.valid,false);
 for(const gate of [1,2,3])recordTimingGate(r,gate,42+gate*8);
 recordTimingGate(r,0,74);
 assert.equal(r.telemetry.lastLap.valid,false);assert.equal(r.telemetry.bestLap,40);
 assert.equal(r.telemetry.valid,true);
});

test('a complete simulated race produces valid sector sums and a reloadable interpolated ghost',()=>{
 const r=createRacer(track,'you','You',0,true),store=storage(),key=ghostKey(track,r.kartId),rec=new GhostRecorder(store,key);
 for(let time=STEP;time<700&&!r.finished;time+=STEP){stepRace([r],track,STEP,time,'pro');rec.update(r,time);}
 assert.ok(r.finished);assert.equal(r.telemetry.completed,3);assert.ok(rec.best);
 assert.ok(r.telemetry.topSpeed>25);assert.ok(r.telemetry.distance>track.length*2.9);
 const ghost=loadGhost(store,key);assert.ok(ghost);assert.equal(ghost.time,rec.best.time);
 assert.ok(Math.abs(ghost.sectors.reduce((a,b)=>a+b,0)-ghost.time)<.001);
 assert.equal(ghost.samples[0][0],0);assert.equal(ghost.samples.at(-1)[0],ghost.time);
 const pose=sampleGhost(ghost,ghost.time/2);assert.ok(Object.values(pose).every(Number.isFinite));
 assert.equal(sampleGhost(ghost,ghost.time+1),null);
 assert.equal(sampleGhost(ghost,-1),null);
});

test('ghost snapshots ignore invalid laps and retain the earlier best if storage fills',()=>{
 const r={lap:1,lapStartedAt:1,x:0,z:0,yaw:0,telemetry:createRaceTelemetry()};
 const rec=new GhostRecorder({getItem:()=>null,setItem:()=>{throw Error('quota');}},'key');
 rec.update(r,1);rec.update(r,2);
 r.telemetry.lastLap={time:4,sectors:[1,1,1,1],valid:false};r.lap=2;r.lapStartedAt=5;rec.update(r,5);
 assert.equal(rec.best,null);
 rec.update(r,6);r.telemetry.lastLap={time:4,sectors:[1,1,1,1],valid:true};r.lap=3;r.lapStartedAt=9;rec.update(r,9);
 assert.equal(rec.best.time,4);assert.equal(rec.saved,false);assert.ok(rec.reference);
 const retry=new GhostRecorder(undefined,'key',{ghost:rec.best,saved:rec.saved});
 assert.equal(retry.reference.time,4);assert.equal(retry.saved,false);
});

test('ghost storage rejects malformed, out-of-order and stale geometry recordings',()=>{
 const store=storage(),g={version:1,time:4,sectors:[1,1,1,1],samples:[[0,0,0,3.1,0],[4,4,0,-3.1,0]]};
 store.setItem('g',JSON.stringify(g));assert.ok(loadGhost(store,'g'));
 assert.ok(Math.abs(sampleGhost(g,2).yaw)>3,'interpolation crosses the short yaw arc');
 for(const bad of [{...g,sectors:[1,1,1,10]},{...g,samples:[[0,0,0,0,0],[0,1,2,3,0]]},{...g,version:0}]){
  store.setItem('g',JSON.stringify(bad));assert.equal(loadGhost(store,'g'),null);
 }
 const edited={...track,points:track.points.map((p,i)=>i? p:{...p,x:p.x+1})};
 assert.notEqual(ghostKey(track,'apex'),ghostKey(edited,'apex'));assert.notEqual(ghostKey(track,'apex'),ghostKey(track,'oobi'));
});

test('gear hysteresis prevents chatter and RPM stays bounded during acceleration, braking and reverse',()=>{
 const r={speed:0,throttle:1};
 for(let i=0;i<600;i++){r.speed=Math.min(47,i*.1);stepPowertrain(r,STEP);assert.ok(r.powertrain.rpm>=1900&&r.powertrain.rpm<=10800);}
 assert.equal(r.powertrain.gear,6);
 for(let i=0;i<500;i++){r.speed=9.5+Math.sin(i)*.1;stepPowertrain(r,STEP);}
 const shifts=r.powertrain.shiftId;
 for(let i=0;i<200;i++)stepPowertrain(r,STEP);
 assert.equal(r.powertrain.shiftId,shifts);
 for(let i=0;i<300;i++){r.speed=-4;stepPowertrain(r,STEP);}
 assert.equal(r.powertrain.gear,1);
});

test('AI anticipates a rival cutting into its lane and conserves boost while turbo is active',()=>{
 const r={x:0,z:0,yaw:0,speed:32,slot:0,aiLane:0,bodyWidth:1.3,bodyLength:2},
 other={x:3,z:6,yaw:0,velocityYaw:-.35,speed:24,bodyWidth:1.3,bodyLength:2};
 const plan=planRacecraft(r,{yaw:0,lane:0,width:8},[r,other],0);
 assert.equal(plan.boostSafe,false);assert.equal(plan.blocked,false);
 const racer=createRacer(track,'ai','Rival',0,true);racer.turbo=1;
 assert.equal(aiInput(racer,track,1,'pro',[racer]).boost,false);
});

test('rival tower reports distance, ordered position and excludes disconnected racers',()=>{
 const list=rivalIntervals([{id:'a',progress:1.5},{id:'me',progress:1.4},{id:'b',progress:1.3},{id:'gone',progress:1.8,disconnected:true}],'me',1000);
 assert.deepEqual(list.map(r=>[r.id,r.position,r.meters]),[['a',1,100],['me',2,0],['b',3,100]]);
});

test('jammed AI recovers backwards into a clear lane without earning gates',()=>{
 const r=createRacer(track,'ai','AI',2,true),near={...track.points[100],index:100},other={...r,id:'other',x:near.x,z:near.z};
 Object.assign(r,{x:near.x,z:near.z,index:100,yaw:near.yaw,aiStuckTime:4,lap:1,gates:2});
 const pose=aiRecoveryPose(r,near,track,[r,other]);assert.ok(pose);
 assert.ok(circuitDistance(track,pose)<circuitDistance(track,near));
 assert.ok(Math.hypot(pose.x-other.x,pose.z-other.z)>3);
 stepRacer(r,{recover:true,aiRecovery:pose},track,STEP,10);
 assert.equal(r.gates,2);assert.equal(r.lap,1);assert.equal(r.telemetry.valid,false);
});
