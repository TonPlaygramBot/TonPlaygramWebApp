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
 test(`${id}: energetic side contact overturns and recovers; throttle cannot bypass it`,()=>{
  const r=equipKart(createRacer(track,id,id),id);r.speed=25;
  beginRollover(r,25,Math.cos(r.yaw),-Math.sin(r.yaw));assert.equal(r.rollTime,2.2);
  let inverted=false;
  for(let i=0;i<134;i++){stepRacer(r,{boost:true,steer:1},track,STEP,i*STEP);inverted ||= Math.abs(r.rollAngle)>3;}
  assert.ok(inverted);assert.equal(r.rollTime,0);assert.equal(r.rollAngle,0);assert.equal(r.lift,0);assert.equal(r.gates,0);
  assert.ok(r.speed<1 && Number.isFinite(r.x));
  beginRollover(r,30,Math.cos(r.yaw),-Math.sin(r.yaw));assert.equal(r.rollTime,0,'recovery cooldown');
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
