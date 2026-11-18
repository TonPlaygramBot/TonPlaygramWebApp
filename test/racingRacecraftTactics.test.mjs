import test from 'node:test';
import assert from 'node:assert/strict';
import {planRacecraft} from '../webapp/src/games/kartroyale/racecraft.mjs';
const near={lane:0,width:8,yaw:0};
const racer=(id,x=0,z=0,speed=20)=>({id,x,z,speed,yaw:0,slot:0,bodyWidth:1.48,bodyLength:2});
test('chooses a measured passing lane rather than the road edge',()=>{
 const me=racer('me'),leader=racer('leader',0,12,12);
 const plan=planRacecraft(me,near,[me,leader],1);
 assert.ok(Math.abs(plan.lane)>1.8 && Math.abs(plan.lane)<2.2);
 assert.equal(plan.aiPassUntil,2.35);
});
test('anticipates a fast rear rival before changing lanes',()=>{
 const me=racer('me'),leader=racer('leader',0,12,12),rear=racer('rear',2,-9,35);
 const plan=planRacecraft(me,near,[me,leader,rear],1);
 assert.ok(plan.lane>0,'negative lane occupied by approaching rear rival');
});
test('abandons a committed pass when a rival occupies its swept path',()=>{
 const me={...racer('me'),aiPassLane:-2,aiPassUntil:5,aiLane:0};
 const beside=racer('beside',1.9,0,20);
 const plan=planRacecraft(me,near,[me,beside],1);
 assert.equal(plan.lane,0); assert.equal(plan.aiPassUntil,1);
});
test('retains a safe committed lane without weaving after leader is passed',()=>{
 const me={...racer('me'),aiPassLane:1.9,aiPassUntil:5,aiLane:1};
 const plan=planRacecraft(me,{...near,lane:1},[me],1);
 assert.equal(plan.lane,1.9); assert.equal(plan.aiPassUntil,5);
});
test('brakes behind a blocked leader and cannot boost through it',()=>{
 const me=racer('me'),leader=racer('leader',0,3,0);
 const plan=planRacecraft(me,{...near,width:3},[me,leader],1);
 assert.equal(plan.blocked,true); assert.equal(plan.boostSafe,false);
 assert.equal(plan.speedLimit,0);
});
test('planning is deterministic and never mutates or moves a rival',()=>{
 const me=Object.freeze(racer('me')),leader=Object.freeze(racer('leader',0,12,12));
 const field=Object.freeze([me,leader]);
 assert.deepEqual(planRacecraft(me,near,field,3),planRacecraft(me,near,field,3));
 assert.deepEqual(me,racer('me')); assert.deepEqual(leader,racer('leader',0,12,12));
});
