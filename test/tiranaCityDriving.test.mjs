import test from 'node:test';
import assert from 'node:assert/strict';
import {DRIVING_PROFILES,drivingScale} from '../webapp/src/games/tiranastreets-november/shared/drivingScale.mjs';
import {driveVehicle} from '../webapp/src/games/tiranastreets-november/shared/vehicleDynamics.mjs';
import {roadCrashVisuals} from '../webapp/src/games/tiranastreets-november/roadCrashVisuals.mjs';

const c=(model,v=0,lateral=0)=>({collectionVehicle:model,heading:0,x:0,z:0,speed:v,vx:lateral,vz:-v});
test('four civilian profiles reach the new game caps with identical 60 and 120 Hz behavior',()=>{
 for(const [id,kph] of [['ford',110],['benz',125],['jaguar',115],['ferrari',185]]){
  const make=(hz)=>{const car=c(id);let ticks=0;for(let i=0;i<90*hz;i++)driveVehicle(car,{x:0,y:1},1/hz,()=>ticks++);return {car,ticks};};
  const a=make(60),b=make(120);
  assert.equal(drivingScale(a.car).maximum,kph/3.6);
  assert.ok(Math.abs(a.car.speed-kph/3.6)<1e-6);
  assert.equal(a.ticks,b.ticks);assert.ok(Math.abs(a.car.z-b.car.z)<1e-5);
 }
 assert.equal(DRIVING_PROFILES.armored.maximum,95/3.6);
 assert.equal(DRIVING_PROFILES.bike.maximum,150/3.6);
});
test('light input has fine steering, parking keeps full lock, and sideslip reduces lock',()=>{
 const small=c('ford',3),full=c('ford',3),slide=c('ford',3,15),park=c('ford');
 for(let i=0;i<20;i++){
  driveVehicle(small,{x:.25,y:0},1/120);
  driveVehicle(full,{x:1,y:0},1/120);driveVehicle(park,{x:1,y:0},1/120);
 }
 assert.ok(small.steerAngle<full.steerAngle*.2); assert.equal(park.heading,0);assert.ok(park.steerAngle>full.steerAngle);
 const a={...c('ford',3),steering:1}, b={...slide,steering:1};
 driveVehicle(a,{x:1,y:0},1/120);driveVehicle(b,{x:1,y:0},1/120);
 assert.ok(b.steerAngle<a.steerAngle*.65);
});
test('parking bumps add no debris cloud, hard road effects are bounded, other callers unchanged',()=>{
 assert.deepEqual(roadCrashVisuals(3,1),{debris:0,dustRadius:0,kick:0});
 assert.equal(roadCrashVisuals(7,1).dustRadius,0);
 assert.ok(roadCrashVisuals(12,2).debris>roadCrashVisuals(7,1).debris);
 assert.equal(roadCrashVisuals(160,60).debris,16);
 assert.equal(roadCrashVisuals(160,60).dustRadius,3.8);
 assert.deepEqual(roadCrashVisuals(undefined,3),{debris:12,dustRadius:3,kick:1});
});
