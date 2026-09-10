import test from 'node:test';
import assert from 'node:assert/strict';
import {createState, control, interact, advanceState, emptyInput} from '../webapp/src/games/tiranastreets/shared/engine.mjs';

test('rooftop helicopter is placed on a mapped building and can be piloted',()=>{
  const state=createState([{id:'p',name:'Pilot'}],'free-roam'),p=state.players.p,h=state.helicopter;
  assert.ok(h.roofY>10);assert.ok(Number.isFinite(h.stairX));
  Object.assign(p,{x:h.stairX,z:h.stairZ});interact(state,'p','helicopter');
  assert.equal(h.pilot,'p');assert.equal(p.aircraftId,h.id);
  control(state,'p',{...emptyInput(),y:1,fast:true,seq:1});advanceState(state,1);
  assert.ok(h.airborne);assert.ok(h.y>h.roofY+1);assert.ok(Math.hypot(h.x-p.x,h.z-p.z)<.01);
});

test('airborne helicopter fires rate-limited missiles',()=>{
  const state=createState([{id:'p',name:'Pilot'}],'free-roam'),p=state.players.p,h=state.helicopter;
  Object.assign(p,{x:h.stairX,z:h.stairZ});interact(state,'p','helicopter');
  control(state,'p',{...emptyInput(),fast:true,fire:true,seq:1});advanceState(state,.3);
  assert.ok(state.effects.some(e=>e.kind==='missile'));
  const first=state.effectSeq;advanceState(state,.1);assert.equal(state.effectSeq,first);
});

test('city population includes children, dog walkers and emergency services',()=>{
  const state=createState([{id:'p',name:'P'}],'free-roam');
  assert.ok(state.npcs.some(n=>n.role==='child'));
  assert.ok(state.npcs.some(n=>n.role==='dog-walker'));
  for(const service of ['ambulance','fire-brigade','police-patrol'])
    assert.ok(state.traffic.some(v=>v.service===service));
});
