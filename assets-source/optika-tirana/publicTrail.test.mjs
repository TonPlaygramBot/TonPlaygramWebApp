import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WORLD} from '../../webapp/src/games/tiranastreets/shared/world.mjs';
import {createPublicTrail,advancePublicTrail,createPublicTrailSession} from './publicTrail.mjs';

test('only the three public landmarks from the existing city enter the trail; the map is unchanged',()=>{
  const original = structuredClone(WORLD.landmarks);
  const route = createPublicTrail(WORLD.landmarks);
  assert.deepEqual(route.map(r=>r.id),['square','clock','pyramid']);
  assert.deepEqual(WORLD.landmarks,original);
  assert.ok(Object.isFrozen(route));
});

test('arrival and action are both required; skipping or repeating a stop does not complete the trail',()=>{
  const trail = createPublicTrail(WORLD.landmarks);
  assert.deepEqual(advancePublicTrail(trail,0,trail[0],false),{index:0,complete:false});
  assert.deepEqual(advancePublicTrail(trail,0,trail[2],true),{index:0,complete:false});
  assert.deepEqual(advancePublicTrail(trail,0,trail[0],true),{index:1,complete:false});
  assert.deepEqual(advancePublicTrail(trail,1,trail[0],true),{index:1,complete:false});
  assert.deepEqual(advancePublicTrail(trail,1,trail[1],true),{index:2,complete:false});
  assert.deepEqual(advancePublicTrail(trail,2,trail[2],true),{index:3,complete:true});
});

test('invalid location, state or map data cannot unlock a stop',()=>{
  const trail = createPublicTrail(WORLD.landmarks);
  assert.deepEqual(advancePublicTrail(trail,0,{x:NaN,z:Infinity},true),{index:0,complete:false});
  assert.throws(()=>advancePublicTrail(trail,-1,trail[0],true),/Invalid trail state/);
  assert.throws(()=>createPublicTrail([]),/Public landmark unavailable/);
});

test('holding interact outside the stop cannot complete it on arrival',()=>{
  const session = createPublicTrailSession(WORLD.landmarks);
  const [square,clock] = session.trail;
  assert.deepEqual(session.update(clock,true),{index:0,complete:false});
  assert.deepEqual(session.update(square,true),{index:0,complete:false});
  assert.deepEqual(session.update(square,false),{index:0,complete:false});
  assert.deepEqual(session.update(square,true),{index:1,complete:false});
  assert.deepEqual(session.update(clock,true),{index:1,complete:false});
});
