import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CivicConvoySimulation} from '../webapp/src/games/tiranastreets/street-career/CivicConvoySimulation.mjs';
import {CIVIC_VEHICLES,itineraryStop,measuredPath,pathPose} from '../webapp/src/games/tiranastreets/street-career/civicConvoyCore.mjs';
import {createState,stepState} from '../webapp/src/games/tiranastreets/shared/engine.mjs';
import {vehicleSeparation} from '../webapp/src/games/tiranastreets/shared/trafficSimulation.mjs';
import {pointInUrbanBounds} from '../webapp/src/games/tiranastreets/shared/urbanBounds.mjs';

const blank=()=>({state:{cars:[],traffic:[],units:[],npcs:[],players:{},elapsed:0}});
const straight=()=>[{x:0,z:1000},{x:0,z:0}];
test('convoy has the requested ten distinct vehicles and fictional repeating itinerary',()=>{
  assert.equal(CIVIC_VEHICLES.length,10);
  assert.equal(CIVIC_VEHICLES.filter(v=>v.collectionVehicle==='benz').length,1);
  assert.equal(CIVIC_VEHICLES.filter(v=>v.collectionVehicle==='range').length,3);
  assert.equal(CIVIC_VEHICLES.filter(v=>v.forceVehicle==='shqiponja_bike').length,4);
  assert.equal(CIVIC_VEHICLES.filter(v=>v.forceVehicle==='shqiponja_compact').length,2);
  assert.deepEqual(Array.from({length:12},(_,i)=>itineraryStop(i).id),['parliament','prime-minister','surrel','prime-minister','parliament','prime-minister','surrel','prime-minister','parliament','prime-minister','rinas','prime-minister']);
});
test('formation starts apart, advances on the path and brakes for traffic',()=>{
  const sim=blank();let allowed=13.5;
  const convoy=new CivicConvoySimulation(sim,{pathfinder:straight,awareness:()=>allowed});
  assert.equal(convoy.status,'travelling');assert.equal(sim.state.cars.length,10);
  for(let i=0;i<convoy.vehicles.length;i++)for(const other of convoy.vehicles.slice(i+1))assert.equal(vehicleSeparation(convoy.vehicles[i],other),null);
  for(let i=0;i<50;i++){sim.state.elapsed+=.1;convoy.step(.1);}
  assert.ok(convoy.speed>9);assert.ok(convoy.distance>110);
  allowed=0;const before=convoy.distance;
  for(let i=0;i<30;i++)convoy.step(.1);
  assert.equal(convoy.speed,0);assert.ok(convoy.distance-before<15);assert.ok(convoy.blocked);
  assert.ok(convoy.vehicles.every(c=>c.x===0&&c.vx===0&&c.steering===0));
});
test('new legs preserve the position of every trailing car',()=>{
  const sim=blank();let routeCount=0;
  const c=new CivicConvoySimulation(sim,{pathfinder:()=>routeCount++===0?straight():[{x:0,z:0},{x:300,z:0}],awareness:()=>13.5});
  c.distance=c.path.length;c.speed=0;c.place();const before=c.vehicles.map(v=>({x:v.x,z:v.z}));
  assert.equal(c.nextLeg(),true);c.place();
  for(let i=0;i<before.length;i++)assert.ok(Math.hypot(c.vehicles[i].x-before[i].x,c.vehicles[i].z-before[i].z)<1e-6);
});
test('missing routes and damaged vehicles never teleport',()=>{
  const sim=blank();let missing=false;
  const c=new CivicConvoySimulation(sim,{pathfinder:()=>missing?[]:straight(),awareness:()=>13.5});
  c.distance=c.path.length;c.place();const before=c.vehicles.map(v=>[v.x,v.z]);missing=true;
  assert.equal(c.nextLeg(),false);assert.equal(c.status,'route-unavailable');
  assert.deepEqual(c.vehicles.map(v=>[v.x,v.z]),before);
  c.status='travelling';c.vehicles[3].destroyed=true;c.step(.1);
  assert.equal(c.status,'halted');assert.deepEqual(c.vehicles.map(v=>[v.x,v.z]),before);
  const unavailable=new CivicConvoySimulation(blank(),{pathfinder:()=>[],awareness:()=>13.5});
  assert.equal(unavailable.status,'unavailable');assert.equal(unavailable.npc,null);
});
test('path lookup handles repeated points and clamps both ends',()=>{
  const path=measuredPath([{x:0,z:0},{x:0,z:0},{x:0,z:20},{x:20,z:20}]);
  assert.equal(path.length,40);assert.deepEqual(pathPose(path,-5),{x:0,z:0,heading:-Math.PI});
  assert.equal(pathPose(path,500).x,20);assert.equal(pathPose(path,500).z,20);
});
test('current city has safe formation space and connected legal routes for all destinations',()=>{
  const state=createState([{id:'local',name:'Convoy test'}],'free-roam');
  const c=new CivicConvoySimulation({state});
  assert.equal(c.status,'travelling');assert.equal(state.cars.filter(v=>v.civicConvoy).length,10);
  for(const car of c.vehicles)for(const other of [...state.traffic,...state.cars.filter(v=>!v.civicConvoy)])assert.equal(vehicleSeparation(car,other),null);
  // The shared engine must not move scripted state.cars on its own.
  const before=c.vehicles.map(v=>[v.x,v.z]);stepState(state,.05);
  assert.deepEqual(c.vehicles.map(v=>[v.x,v.z]),before);
  for(let leg=0;leg<12;leg++){
    c.distance=c.path.length;c.place();assert.equal(c.nextLeg(),true);assert.ok(c.path.length>100);
    assert.ok(c.path.points.every(point=>pointInUrbanBounds(point)));
  }
});
test('civic asset preserves a licensed original articulated mesh and source clips',()=>{
  const bytes=fs.readFileSync(new URL('../webapp/public/assets/tirana-streets/civic/edi-rama-stylized.glb',import.meta.url));
  const model=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
  assert.equal(model.extras.license,'CC0-1.0');assert.match(model.extras.likeness,/approximation/);
  assert.ok(model.skins.length>0);assert.ok(model.animations.some(a=>a.name==='Walk'));assert.ok(model.animations.some(a=>a.name==='Idle'));
  assert.equal(model.materials.find(m=>m.name==='Hair').pbrMetallicRoughness.baseColorFactor[0],.49);
});
