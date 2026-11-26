import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCityFootsteps} from '../webapp/src/games/tiranastreets-november/cityFootsteps.mjs';

function walkAt(fps, gait, speed, seconds) {
  const cadence=createCityFootsteps(), contacts=[];
  for(let i=0;i<=fps*seconds;i++){
    const contact=cadence.advance({x:i/fps*speed,z:0},1/fps,gait);
    if(contact)contacts.push(contact);
  }
  return contacts;
}

test('audible step count and alternating contacts are stable at different refresh rates',()=>{
  for (const fps of [30,60,90,120]) {
    const contacts=walkAt(fps,'walk',1.5,4);
    assert.equal(contacts.length,8);
    assert.deepEqual(contacts.map(c=>c.foot),[1,0,1,0,1,0,1,0]);
  }
});

test('crouch contacts are quieter than walking; sprint contacts are stronger',()=>{
  assert.ok(walkAt(60,'crouch-walk',1,2)[0].strength<walkAt(60,'walk',1.5,2)[0].strength);
  assert.ok(walkAt(60,'sprint',6,2)[0].strength>walkAt(60,'walk',1.5,2)[0].strength);
});

test('blocked movement, airborne travel, vehicle state, discontinuities and reset do not backfill contacts',()=>{
  const c=createCityFootsteps(), move=(x,gait='walk',dt=.05)=>c.advance({x,z:0},dt,gait);
  assert.equal(move(0),null);
  assert.equal(move(.6),null);
  for(let i=0;i<6;i++)assert.equal(move(.6),null);
  assert.equal(move(.8),null); // pending stride was cleared while blocked
  assert.equal(move(1.2,'jump'),null);
  assert.equal(move(1.8,'drive'),null);
  assert.equal(move(80),null);
  assert.equal(move(80.4,'walk',1),null);
  c.reset();
  assert.equal(move(1),null);
  assert.ok(move(1.8));
});
