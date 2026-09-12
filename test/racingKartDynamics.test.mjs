import test from 'node:test';
import assert from 'node:assert/strict';
import {makeTrack,createRacer,stepRacer,STEP,equipKart} from '../webapp/src/games/kartroyale/simulation.mjs';
import {beginRollover} from '../webapp/src/games/kartroyale/kartDynamics.mjs';
import {resolveWallContact} from '../webapp/src/games/kartroyale/collisions.mjs';
const track=makeTrack('skanderbeg');
for(const id of ['apex','oobi','oodi','ooli','oopi']) {
 test(`${id}: reverse moves backwards, brakes stop, release resumes forward`,()=>{
  const r=equipKart(createRacer(track,id,id),id),x=r.x,z=r.z,yaw=r.yaw;
  for(let i=0;i<60;i++)stepRacer(r,{reverse:true,boost:true},track,STEP,i*STEP);
  assert.ok(r.speed<0 && r.speed>=-7);
  assert.ok((r.x-x)*Math.sin(yaw)+(r.z-z)*Math.cos(yaw)<-1);
  assert.equal(r.boost,100,'cannot boost backwards');
  for(let i=0;i<30;i++)stepRacer(r,{brake:true},track,STEP,i*STEP);
  assert.equal(r.speed,0);
  for(let i=0;i<60;i++)stepRacer(r,{},track,STEP,i*STEP);
  assert.ok(r.speed>0);
 });
 test(`${id}: energetic side contact stays upright and the kart can continue`,()=>{
  const r=equipKart(createRacer(track,id,id),id);
  Object.assign(r,{x:11,z:0,yaw:0,velocityYaw:Math.PI/2,speed:25});
  resolveWallContact(r,{x:0,z:0,distance:11},20,STEP);
  assert.equal(r.rollTime,0);assert.equal(r.retired,false);assert.ok(r.hop>0);
  assert.ok(r.health>=50 && r.health<100);
  for(let i=0;i<60;i++)stepRacer(r,{},track,STEP,i*STEP);
  assert.ok(Number.isFinite(r.x)&&Number.isFinite(r.z));assert.equal(r.rollAngle,0);
 });
}
test('reverse wall response keeps signed velocity consistent',()=>{
 const r=createRacer(track,'r','r');Object.assign(r,{x:0,z:-11,yaw:0,velocityYaw:0,speed:-7});
 resolveWallContact(r,{x:0,z:0,distance:11},20,STEP);
 assert.ok(Math.cos(r.velocityYaw)*r.speed>0,'rebounds away from rear wall');
 assert.ok(r.health>90);
});
test('head-on and light side contact do not trigger rollovers',()=>{
 const r=createRacer(track,'r','r');r.yaw=0;
 beginRollover(r,30,0,1);assert.equal(r.rollTime,0);
 beginRollover(r,10,1,0);assert.equal(r.rollTime,0);
});
