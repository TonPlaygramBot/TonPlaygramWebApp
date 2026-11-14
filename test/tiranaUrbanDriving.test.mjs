import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {buildSync} from '../webapp/node_modules/esbuild/lib/main.js';
import {driveVehicle} from '../webapp/src/games/tiranastreets/shared/vehicleDynamics.mjs';
import {drivingScale} from '../webapp/src/games/tiranastreets/shared/drivingScale.mjs';
import {vehiclePolygonContact,slideVehicle} from '../webapp/src/games/tiranastreets/shared/vehicleContacts.mjs';
import {driverSocket,driverWheel,driverEye} from '../webapp/src/games/tiranastreets/shared/driverView.mjs';
import {hasAuthoredCabin,cabinSurface} from '../webapp/src/games/tiranastreets/shared/vehicleCabins.mjs';
import {VEHICLE_COLLECTION} from '../webapp/src/games/tiranastreets/shared/vehicleCollection.mjs';
import {load,T} from '../webapp/scripts/vehicle-wheels/loadAsset.mjs';
const temp=new URL('../webapp/node_modules/.cache/urban-driving-test.mjs',import.meta.url);
mkdirSync(new URL('.',temp),{recursive:true});

const fresh=(model='sedan',speed=0)=>({id:'test',x:0,z:0,heading:0,model,speed,vx:0,vz:-speed,steering:0});
const run=(car,input,seconds,dt=1/60,contact)=>{for(let i=0;i<Math.round(seconds/dt);i++)driveVehicle(car,input,dt,contact);return car;};

test('handling follows original vehicle class and keeps maximum/reverse in metres per second',()=>{
 assert.equal(drivingScale({collectionVehicle:'ford'}).kind,'compact');
 assert.equal(drivingScale({collectionVehicle:'range'}).kind,'suv');
 assert.equal(drivingScale({collectionVehicle:'ferrari'}).kind,'supercar');
 assert.equal(drivingScale({forceVehicle:'renea_armored_van'}).kind,'armored');
 const sport=run(fresh('sport'),{y:1},5),bus=run(fresh('tirana-bus'),{y:1},5);
 assert.ok(sport.speed>bus.speed*1.7);
 for(const model of ['sport','sedan','tirana-bus']){
  const car=run(fresh(model),{y:1},60);assert.ok(car.speed<=drivingScale(car).maximum+.001);
  run(car,{y:-1},60);assert.ok(car.speed>=-20/3.6-.001);assert.ok(car.speed<0);
 }
});
test('service brake stops without reverse; opposite pedal first stops before reversing',()=>{
 const car=fresh('sedan',25);let minimum=Infinity;
 run(car,{brake:true,y:0},5,1/60,c=>minimum=Math.min(minimum,c.speed));
 assert.equal(car.speed,0);assert.ok(minimum>=0);assert.ok(-car.z>18&&-car.z<28);
 const reversing=fresh('sedan',10);driveVehicle(reversing,{y:-1},.05);assert.ok(reversing.speed>0);
 run(reversing,{y:-1},3);assert.ok(reversing.speed<0);
});
test('steering direction, speed sensitivity, grip recovery and timestep behavior stay predictable',()=>{
 const slow=fresh('sedan',4),fast=fresh('sedan',30);
 run(slow,{x:1,y:1},.5);run(fast,{x:1,y:1},.5);
 assert.ok(slow.x>0&&fast.x>0);assert.ok(Math.abs(fast.steerAngle)<Math.abs(slow.steerAngle)*.55);
 const a=run(fresh(),{x:.5,y:1},8,1/30),b=run(fresh(),{x:.5,y:1},8,1/120);
 assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<.01);assert.ok(Math.abs(a.speed-b.speed)<.001);
 const slide=fresh('sport',25);run(slide,{x:1,y:1,brake:true},.5);assert.ok(slide.handbraking&&Math.abs(slide.slip)>.08);
 run(slide,{x:0,y:.2},2);assert.ok(Math.abs(slide.slip)<.02);
});
test('substeps contact a thin wall during a slow frame instead of tunneling at racing speed',()=>{
 const car=fresh('sport',55),wall={id:'test-wall',p:[[-10,-5.1],[10,-5.1],[10,-5],[-10,-5]],h:10};let impacts=0;
 driveVehicle(car,{y:1},.1,c=>{const contact=vehiclePolygonContact(c,wall);if(contact){impacts++;c.x+=contact.x;c.z+=contact.z;slideVehicle(c,contact);}});
 assert.ok(impacts>0);assert.ok(car.z>-5);assert.ok(Math.abs(car.speed)<1);
 const stationary={...fresh(),destroyed:true};run(stationary,{x:1,y:1},2);assert.equal(stationary.z,0);assert.equal(stationary.speed,0);
});
test('invalid input and skipped/oversized frames remain finite and bounded',()=>{
 const car=fresh();driveVehicle(car,{x:Infinity,y:NaN},Infinity);assert.equal(car.z,0);
 driveVehicle(car,{x:Infinity,y:1},5);assert.ok(Math.abs(car.z)<.1);
 for(const value of [car.x,car.z,car.speed,car.steering,car.yawRate,car.rpm])assert.ok(Number.isFinite(value));
});
test('six audited GLBs contain distinct original cabin surfaces; seat-only GLBs use honest fallback',()=>{
 const found=[];
 for(const asset of VEHICLE_COLLECTION){
  const car={collectionVehicle:asset.id};if(!hasAuthoredCabin(car))continue;found.push(asset.id);
  const bytes=readFileSync(new URL('../webapp/public'+asset.url,import.meta.url));
  const doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
  assert.ok(doc.nodes.some(node=>(doc.meshes[node.mesh]?.primitives||[]).some(p=>cabinSurface(car,node.name,doc.materials[p.material]?.name))),asset.id);
 }
 assert.deepEqual(found.sort(),['benz','bmw','ferrari','ford','golf-gti','jaguar']);
 for(const id of ['range','audi','fiat','bugatti','landrover'])assert.equal(hasAuthoredCabin({collectionVehicle:id}),false);
});
