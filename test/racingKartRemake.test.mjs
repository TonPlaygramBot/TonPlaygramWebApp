import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { KARTS, TRACKS, makeTrack, createRacer, equipKart, normalizeKart, stepRacer, stepRace, STEP } from '../webapp/src/games/kartroyale/simulation.mjs';
import { stepDrift, boostPads, stepBoostPads, stepSlipstream } from '../webapp/src/games/kartroyale/arcadeRules.mjs';
import { createHeldRaceInput } from '../webapp/src/games/kartroyale/heldRaceInput.mjs';
import { damageRacer } from '../webapp/src/games/kartroyale/collisions.mjs';
import { WORLD } from '../webapp/src/games/tiranastreets/shared/world.mjs';
const input={steer:0,throttle:false,brake:false,boost:false,drift:false,reverse:false,recover:false,shield:false,fire:false};
const make=()=>createRacer(makeTrack('blloku'),'you','You');
test('saved car and military choices migrate to a kart; every selectable kart has a real model',()=>{
  assert.deepEqual(KARTS.map(k=>k.id),['apex','oobi','oodi','ooli','oopi','photon','vortex','aegis']);
  for(const id of ['benz','buggy','shota','defender','unknown',null])assert.equal(normalizeKart(id),'apex');
  for(const kart of KARTS){
    const r=equipKart(make(),kart.id);assert.equal(r.kartId,kart.id);assert.equal(r.ammunition,0);
    for(const suffix of ['','-lod'])assert.equal(readFileSync(new URL(`../webapp/public/assets/kart-royale/karts/${kart.id}${suffix}.glb`,import.meta.url)).subarray(0,4).toString(),'glTF');
  }
});
test('three rewarded drift tiers increase turbo; a stationary turn and braking give no reward',()=>{
  const durations=[.75,1.4,2.2],rewards=[];
  for(const duration of durations){
    const r=make();r.speed=20;r.steering=1;r.boost=0;
    for(let t=0;t<duration;t+=STEP)stepDrift(r,{...input,drift:true},STEP);
    stepDrift(r,input,STEP);rewards.push(r.turbo);assert.equal(r.boostEvent,1);
    stepDrift(r,input,STEP);assert.equal(r.boostEvent,1);
  }
  assert.ok(rewards[0]>0&&rewards[1]>rewards[0]&&rewards[2]>rewards[1]);
  const stopped=make();stopped.steering=1;
  for(let i=0;i<150;i++)stepDrift(stopped,{...input,drift:true},STEP);
  stepDrift(stopped,input,STEP);assert.equal(stopped.turbo,0);
  const braking=make();braking.speed=20;braking.steering=1;braking.drifting=true;braking.driftCharge=2;
  stepDrift(braking,{...input,brake:true},STEP);assert.equal(braking.turbo,0);
});
test('boost strips work per racer with a cooldown and reject off-strip positions',()=>{
  const track=makeTrack('blloku'),pad=boostPads(track)[0];assert.ok(pad);
  const a=make(),b=make();
  for(const r of [a,b]){Object.assign(r,{x:pad.x,z:pad.z,speed:12,boost:0});stepBoostPads(r,track,1);assert.ok(r.turbo>0);assert.equal(r.boost,18);}
  stepBoostPads(a,track,2);assert.equal(a.boost,18);
  a.x+=Math.cos(pad.yaw)*8;a.z-=Math.sin(pad.yaw)*8;stepBoostPads(a,track,20);assert.equal(a.boost,18);
});
test('slipstream rewards following, never an oncoming or disconnected kart',()=>{
  for(const other of [{yaw:0,disconnected:false,yes:true},{yaw:Math.PI,disconnected:false,yes:false},{yaw:0,disconnected:true,yes:false}]){
    const a=make(),b=make();a.id='a';b.id='b';Object.assign(a,{x:0,z:0,yaw:0,speed:20});Object.assign(b,{x:0,z:10,speed:20,...other});
    for(let i=0;i<100;i++)stepSlipstream([a,b],STEP);
    assert.equal(a.turbo>0,other.yes);
  }
});
test('multi-touch steering + drift + boost survives independent releases, cancel, and keyboard overlap',()=>{
  const held=createHeldRaceInput();held.hold('left','steer',-1);held.hold('right','steer',1);held.hold('drift','drift',true);held.hold('boost','boost',true);
  assert.equal(held.read().steer,0);held.release('left');assert.equal(held.read().steer,1);
  held.release('boost');assert.equal(held.read().drift,true);assert.equal(held.read().steer,1);
  held.hold('key','steer',-1);held.release('right');assert.equal(held.read().steer,-1);
  held.clear();assert.deepEqual(held.read(),input);
});
test('bumper damage never retires a kart and stale fire input has no weapon effect',()=>{
  const r=make();for(let i=0;i<100;i++)damageRacer(r,14);assert.equal(r.retired,false);assert.equal(r.health,50);
  r.input.fire=true;r.ammunition=3;stepRace([r],makeTrack('blloku'),STEP,1);assert.equal(r.ammunition,0);assert.equal(r.missileHits,0);
});
test('compact circuits retain exact mapped street edges and both games share one city assembly',()=>{
  const key=(a,b)=>[a.join(','),b.join(',')].sort().join('|');
  const roads=new Set(WORLD.roads.filter(r=>!r.walk).map(r=>key(r.a,r.b)));
  for(const config of TRACKS){
    assert.ok(makeTrack(config.id).length<2200);
    for(let i=0;i<config.points.length;i++)assert.ok(roads.has(key(config.points[i],config.points[(i+1)%config.points.length])),config.id);
  }
  for(const path of ['blackwater/cityWorld.ts','kartroyale/tiranaScenery.ts'])assert.match(readFileSync(new URL('../webapp/src/games/'+path,import.meta.url),'utf8'),/new TiranaCityScene/);
  const flag=readFileSync(new URL('../webapp/public/assets/kart-royale/albania.svg',import.meta.url),'utf8');assert.match(flag,/viewBox="0 0 980 700"/);
});

test('track recovery preserves lap gates and progress; holding it cannot repeatedly teleport',()=>{
  const track=makeTrack('blloku'),r=make();r.lap=2;r.gates=6;r.nextGate=2;r.progress=1.4;r.x+=15;
  stepRacer(r,{...input,recover:true},track,STEP,10);
  assert.equal(r.lap,2);assert.equal(r.gates,6);assert.equal(r.nextGate,2);assert.equal(r.progress,1.4);
  assert.equal(r.speed,0);assert.equal(r.x,track.points[r.index].x);
  stepRacer(r,{...input,recover:true,throttle:true},track,STEP,10+STEP);assert.ok(r.speed>0);
});
