import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {BICYCLE,bicycleAction,canRideBicycle,findParkedBicycle} from './cityBicycle.mjs';
import {buildMobility,initialState,stepRoam,vehicleAction} from './walkDrive.mjs';
import {combineHistoric} from './historicGrid.mjs';

const fixture=(water=[])=>buildMobility({bounds:[-30,-80,30,80],buildings:[],markings:[],water,
  landmarks:[{id:'square',x:0,z:0}],roads:[{a:[0,-75],b:[0,75],w:8}]});
test('exact CC0 model remains local and mounted controls comprise a full independent ride',()=>{
  const glb=readFileSync(new URL('../../../public'+BICYCLE.url,import.meta.url));
  const hash=createHash('sha1').update('blob '+glb.length+'\0').update(glb).digest('hex');
  assert.equal(hash,'8e737fb1198075f9a2303b180f81375ecfe16110');
  const m=fixture(),s=initialState(m),parked={...s.car};
  s.bike=findParkedBicycle(s,m);s.x=s.bike.x+1.4;s.z=s.bike.z;
  assert.equal(bicycleAction(s,m),'');assert.equal(s.mode,'drive');
  const startZ=s.z;
  for(let i=0;i<180;i++)stepRoam(s,m,{x:0,y:1},1/30);
  assert.equal(s.bike.speed,4.2);assert.ok(Math.abs(s.z-startZ)>17);
  assert.ok(s.bike.wheel>0);
  assert.match(bicycleAction(s,m),/Freno/);
  assert.match(vehicleAction(s,m),/biçikleta/);
  for(let i=0;i<30;i++)stepRoam(s,m,{x:0,y:-1,brake:true},1/30);
  assert.equal(s.bike.speed,0);
  assert.equal(bicycleAction(s,m),'');assert.equal(s.mode,'walk');
  assert.deepEqual(s.car,parked);
  assert.equal(s.ride,undefined);
});
test('off-road, water, sedan overlap, remote mount and blocked dismount reject',()=>{
  const m=fixture(),s=initialState(m);s.bike=findParkedBicycle(s,m);
  assert.equal(canRideBicycle(s,m,9,0,0),false);
  const wet=fixture([{a:[-4,20],b:[4,20],w:2}]);
  assert.equal(canRideBicycle(s,m,0,20,0),true);
  assert.equal(canRideBicycle(s,wet,0,20,0),false);
  assert.equal(canRideBicycle(s,m,s.car.x,s.car.z,s.car.yaw),false);
  s.x=s.bike.x+10;s.z=s.bike.z;
  assert.notEqual(bicycleAction(s,m),'');assert.equal(s.mode,'walk');
  s.x=s.bike.x+1.4;s.walkY=1;assert.notEqual(bicycleAction(s,m),'');
  s.walkY=0;assert.equal(bicycleAction(s,m),'');
  assert.notEqual(bicycleAction(s,{...m,obstructed:()=>true}),'');
  assert.equal(s.ride,'bike');
});
test('real historical start parks a rideable bike and permits short travel with the existing roadway',()=>{
  const index=JSON.parse(readFileSync(new URL('../../../public/assets/tirana-city-game/historic/start.json',import.meta.url)));
  const m=buildMobility({...combineHistoric(index,[index.first]),spawnAnchor:index.spawn}),s=initialState(m);
  s.bike=findParkedBicycle(s,m);assert.ok(s.bike);
  assert.ok(Math.hypot(s.car.x-s.bike.x,s.car.z-s.bike.z)<=10);
  const start={...s.bike};
  s.x=s.bike.x+1.4;s.z=s.bike.z;
  assert.equal(bicycleAction(s,m),'');
  for(let i=0;i<50;i++)stepRoam(s,m,{x:0,y:1},1/30);
  assert.ok(Math.hypot(s.x-start.x,s.z-start.z)>1);
  for(let i=0;i<30;i++)stepRoam(s,m,{x:0,y:-1,brake:true},1/30);
  assert.equal(bicycleAction(s,m),'');
});
