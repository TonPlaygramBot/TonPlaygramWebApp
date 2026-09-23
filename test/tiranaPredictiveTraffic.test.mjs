import test from 'node:test';
import assert from 'node:assert/strict';
import {trafficDecision} from '../webapp/src/games/tiranastreets/shared/trafficSimulation.mjs';
import {crossingConflict, followingSpeed} from '../webapp/src/games/tiranastreets/shared/trafficAwareness.mjs';

const car = {id:'ego',x:7000,z:5000,heading:0,speed:10,vx:0,vz:-10,cruise:12,model:'sedan'};
test('predicts a pedestrian approaching the lane before their body reaches it',()=>{
  const n={id:'walker',x:7003,z:4990,heading:Math.PI/2,speed:2,health:100};
  const result=trafficDecision(car,[],[n],0);
  assert.equal(result.reason,'pedestrian');assert.ok(result.target<car.speed);
  assert.equal(trafficDecision(car,[],[{...n,heading:-Math.PI/2}],0).reason,'');
  assert.equal(trafficDecision(car,[],[{...n,speed:0}],0).reason,'');
});
test('a crossing car triggers anticipation but parallel adjacent traffic remains clear',()=>{
  const crossing={...car,id:'crossing',x:7008,z:4986,heading:Math.PI/2,vx:-6,vz:0,speed:6};
  assert.equal(trafficDecision(car,[crossing],[],0).reason,'vehicle');
  assert.equal(trafficDecision(car,[{...car,id:'neighbor',x:7003,z:4995}],[],0).reason,'');
  assert.equal(crossingConflict(car,{...crossing,vx:6},3,5),false);
});
test('moving queues preserve headway without braking as though the leader were a wall',()=>{
  const leader={...car,id:'lead',z:4980,speed:8,vz:-8};
  const moving=trafficDecision(car,[leader],[],0);
  const stopped=trafficDecision(car,[{...leader,speed:0,vz:0}],[],0);
  assert.ok(moving.target>stopped.target);
  assert.ok(followingSpeed(12,10,12,10)>=10);
  assert.equal(followingSpeed(12,10,-.1,10),0);
});
test('prediction rejects actors behind and stationary distant sidewalk occupants',()=>{
  assert.equal(crossingConflict(car,{x:7000,z:5005,vx:0,vz:-10},2,4),false);
  assert.equal(crossingConflict(car,{x:7003,z:4970,vx:0,vz:0},2,4),false);
  const ahead={id:'walker',x:7000,z:4999,health:100};
  assert.equal(trafficDecision(car,[],[ahead],0).target,0);
});
