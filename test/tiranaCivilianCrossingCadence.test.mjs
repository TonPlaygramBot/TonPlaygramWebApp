import assert from 'node:assert/strict';
import {test} from 'node:test';
import {pedestrianIntent} from '../webapp/src/games/tiranastreets-november/shared/pedestrianBehavior.mjs';

const activeBus={id:'bus',x:0,z:-10,heading:Math.PI,speed:8,w:2.6,d:12,npcDriver:true};
const clearBus={...activeBus,x:20};
const parked={...activeBus,x:0,z:0,speed:0,npcDriver:false};
const pedestrian=id=>({id,kind:'civilian',motion:'walk',x:-2,z:0,path:[{x:-4,z:0},{x:5,z:0}],pathIndex:1});
const fixture={roads:[]};
function sample(person,time,cars=[]) {
 return pedestrianIntent(person,{elapsed:time,players:{}},cars,[person],fixture);
}

test('a short clear sample does not make a yielding pedestrian stutter forward',()=>{
 const walker=pedestrian('walker');
 const samples=[
  [1,[activeBus]], [1.05,[clearBus]], [1.1,[activeBus]], [1.15,[]],
  [1.2,[activeBus]], [1.25,[clearBus]],
 ];
 assert.deepEqual(samples.map(([t,cars])=>sample(walker,t,cars).anim),Array(6).fill('idle'));
 assert.deepEqual(samples.map(([t,cars])=>sample(pedestrian('fresh-'+t),t,cars).anim),
  ['idle','walk','idle','walk','idle','walk']);
 assert.equal(sample(walker,1.47,[]).anim,'walk');
 assert.equal(walker.pathIndex,1);
 assert.deepEqual([walker.x,walker.z],[-2,0]);
});

test('genuine crossing hazards still yield immediately while parked decor is ignored',()=>{
 const walker=pedestrian('immediate');
 assert.equal(sample(walker,3,[parked]).anim,'walk');
 assert.equal(sample(walker,3.01,[activeBus]).speed,0);
 assert.equal(walker.behavior,'yield');
 assert.equal(sample(walker,3.5,[parked]).anim,'walk');
});

test('hold is transient and isolated to the same ordinary walker',()=>{
 const walker=pedestrian('first');
 const other=pedestrian('second');
 const savedKeys=Object.keys(walker).sort();
 assert.equal(sample(walker,9,[activeBus]).anim,'idle');
 assert.equal(sample(other,9.03,[]).anim,'walk');
 assert.ok(Object.keys(walker).every(k=>savedKeys.includes(k)||k==='behavior'));
 assert.equal(sample(walker,1,[]).anim,'walk','simulation clock rewind never carries a hold forward');
 const cyclist={...pedestrian('cycle'),motion:'cycle'};
 assert.equal(sample(cyclist,10,[activeBus]).speed,0);
 assert.equal(sample(cyclist,10.01,[]).anim,'ride');
});
