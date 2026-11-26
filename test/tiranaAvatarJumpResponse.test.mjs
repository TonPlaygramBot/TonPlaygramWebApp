import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createBody,jumpBlockedReason,MOTOR,stepMotor} from '../webapp/src/games/tiranastreets-november/street-career/playerCore.mjs';

const dt=1/60;
const world={move(q,x,z){q.x+=x;q.z+=z;},surface(){return 0;},clearance(){return true;}};
const no=()=>{};
test('ground, coyote and last portion of a landing can accept a jump press',()=>{
 const b=createBody();
 assert.equal(jumpBlockedReason(b,2,0),'');
 b.grounded=false;b.groundAt=1.95;b.vy=-.2;
 assert.equal(jumpBlockedReason(b,2,.1),'');
 b.groundAt=1;b.vy=-4.5;
 assert.equal(jumpBlockedReason(b,2,.5),'');
 assert.equal(jumpBlockedReason(b,2,1.5),'In the air');
 b.vy=2;
 assert.equal(jumpBlockedReason(b,2,.15),'In the air');
 b.grounded=true;b.crouched=true;
 assert.equal(jumpBlockedReason(b,2,0),'Stand before jumping');
});
test('a late buffered press takes effect only after landing and is consumed once',()=>{
 const b=Object.assign(createBody(),{y:.51,vy:-4.5,grounded:false,groundAt:0});
 const s={elapsed:2},p={x:0,z:0};const events=[];
 assert.equal(jumpBlockedReason(b,s.elapsed,b.y),'');
 b.jumpUntil=s.elapsed+MOTOR.buffer;
 for(let i=0;i<55;i++) {
  s.elapsed+=dt;stepMotor(s,p,b,{x:0,y:0,yaw:0,pitch:0},dt,world,e=>events.push(e),no);
  if(i===0)assert.ok(b.vy<0);
 }
 assert.equal(events.filter(e=>e==='jump').length,1);
 assert.ok(events.indexOf('land')<events.indexOf('jump'),'must land before jumping');
 assert.equal(b.jumpUntil,-1);
});
