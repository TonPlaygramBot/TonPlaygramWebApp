import test from 'node:test';
import assert from 'node:assert/strict';
import {driverSocket,driverEye,driverFov} from '../webapp/src/games/tiranastreets/shared/driverView.mjs';
import {VEHICLE_COLLECTION} from '../webapp/src/games/tiranastreets/shared/vehicleCollection.mjs';
import {emergencyTarget,updateEmergencyResponse,trafficClearance} from '../webapp/src/games/tiranastreets/shared/emergencyResponse.mjs';
import {tacticalGoal} from '../webapp/src/games/tiranastreets/shared/forceTactics.mjs';
import {cutWaterFromParks,removeExactDuplicates} from '../webapp/scripts/tirana/sourceOverlap.mjs';
import {packRecords} from '../webapp/scripts/tirana/compactSource.mjs';
import {unpackRecords} from '../webapp/src/games/tirana-neighbourhood/unpackSource.mjs';

test('all original car sockets put the eye over the left seat and below the roof',()=>{
 for(const a of VEHICLE_COLLECTION){
  const car={collectionVehicle:a.id,x:100,z:200,heading:0},seat=driverSocket(car),eye=driverEye(car);
  assert.ok(seat.x<0);assert.ok(seat.y<a.height);assert.ok(seat.y>a.driverSeat[1]);assert.equal(eye.x,100+a.driverSeat[2]);
  const turned=driverEye({...car,heading:Math.PI/2});assert.ok(Math.abs(turned.z-(200-seat.x))<1e-9);
 }
 assert.equal(driverSocket({model:'motorbike'}).open,true);assert.ok(driverFov(.5)>driverFov(1.8));
});
test('ambulance responds to an injury, assists nearby patient, then returns without looping',()=>{
 const p={id:'p',x:10,z:0,health:40,wanted:0,lastDamage:0};
 const car={id:'ambulance',service:'ambulance',x:0,z:0,heading:-Math.PI/2,node:0,next:1,cruise:7};
 const state={elapsed:0,players:{p},cars:[],traffic:[car],units:[],npcs:[]};
 const env={world:{graph:{nodes:[[0,0],[10,0]]}},nearestNode:x=>x<5?0:1,route:(_a,b)=>[{x:b*10,z:0}],clear:()=>true,collide:()=>false,
  along:(c,to,speed,dt)=>{const d=Math.hypot(to.x-c.x,to.z-c.z),step=Math.min(d,speed*dt);c.x+=step;return step>=d;}};
 assert.equal(emergencyTarget('ambulance',[{...p,health:100,wanted:200}],0),undefined);
 for(let i=0;i<200;i++){state.elapsed+=.05;updateEmergencyResponse(state,.05,env);if(car.responsePhase==='returning')break;}
 assert.equal(car.responsePhase,'returning');assert.equal(p.health,80);assert.equal(car.completedTarget,'p');assert.equal(car.responding,false);
});
test('ambulance does not heal through a wall and traffic stops before a pedestrian',()=>{
 const p={id:'p',x:0,z:0,health:35,wanted:0,lastDamage:0};
 const car={id:'a',service:'ambulance',x:0,z:0,heading:0,node:0};
 updateEmergencyResponse({elapsed:1,players:{p},cars:[],traffic:[car],npcs:[],units:[]},.05,{world:{graph:{nodes:[[0,0]]}},nearestNode:()=>0,route:()=>[],clear:()=>false});
 assert.equal(p.health,35);assert.equal(car.responsePhase,'onscene');
 assert.equal(trafficClearance(car,[],[{x:0,z:-2,health:100,motion:'walk'}]),0);
});
test('police search last seen position instead of following an occluded player',()=>{
 const n={id:'a',x:0,z:0,health:100},target={x:0,z:12};
 tacticalGoal(n,target,[n],[],1,()=>true);
 const goal=tacticalGoal(n,{x:80,z:80},[n],[],3,()=>false);
 assert.deepEqual(goal.goal,{x:0,z:12});assert.equal(goal.anim,'walk');
 assert.equal(tacticalGoal(n,target,[n],[],20,()=>false).anim,'idle');
});
test('park grass excludes a lake hole; exact duplicates preserve one source identity',()=>{
 const p=[[0,0],[20,0],[20,20],[0,20]],lake=[[5,5],[15,5],[15,15],[5,15]];
 const cut=cutWaterFromParks([{id:'park',p,tags:{leisure:'park'}}],[{polygons:[{outer:lake,holes:[]}]}]);
 assert.equal(cut.features[0].holes.length,1);
 const a={id:'1',p,h:10,holes:[]},b={...a,id:'2',p:[...p].reverse()};assert.equal(removeExactDuplicates([a,b]).buildings.length,1);
});
test('compact source records retain values and explicit missing fields',()=>{
 const data=[{id:'a',h:3.2,tags:{building:'yes'},name:''},{id:'b',h:10,tags:{building:'yes'},name:'School'}];
 assert.deepEqual(unpackRecords(packRecords(data)),data);
});
