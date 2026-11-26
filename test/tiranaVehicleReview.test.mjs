import test from 'node:test';
import assert from 'node:assert/strict';
import {drivingScale,DRIVING_PROFILES} from '../webapp/src/games/tiranastreets-november/shared/drivingScale.mjs';
import {VEHICLE_COLLECTION} from '../webapp/src/games/tiranastreets-november/shared/vehicleCollection.mjs';
import {nearbyVehicleContacts} from '../webapp/src/games/tiranastreets-november/shared/vehicleContacts.mjs';
import {driveVehicle} from '../webapp/src/games/tiranastreets-november/shared/vehicleDynamics.mjs';

test('electric SUV uses the existing SUV profile without changing other road cars', ()=>{
  assert.match(VEHICLE_COLLECTION.find(c=>c.id==='jaguar').name,/I-Pace/);
  assert.equal(drivingScale({collectionVehicle:'jaguar'}),DRIVING_PROFILES.suv);
  for(const id of ['range','landrover'])assert.equal(drivingScale({collectionVehicle:id}),DRIVING_PROFILES.suv);
  assert.equal(drivingScale({model:'sedan'}),DRIVING_PROFILES.sedan);
  assert.equal(drivingScale({collectionVehicle:'ferrari'}),DRIVING_PROFILES.supercar);
  assert.equal(drivingScale({model:'tirana-bus'}),DRIVING_PROFILES.bus);
});

test('full throttle obeys the existing SUV cap and service brake reaches rest', ()=>{
  const car={id:'jaguar-fixture',collectionVehicle:'jaguar',x:0,z:0,heading:0,speed:0};
  let contacts=0;
  for(let i=0;i<3000;i++)driveVehicle(car,{x:0,y:1},1/60,()=>contacts++);
  assert.equal(contacts,6000,'exact substep contact cadence');
  assert.ok(car.speed>0);
  assert.ok(car.speed*3.6<=135.00001);
  for(let i=0;i<300;i++)driveVehicle(car,{x:0,y:1,brake:true},1/60);
  assert.equal(car.speed,0);
});

test('collision broad phase preserves order, strict boundary and identical references', ()=>{
  const player={id:'you',x:10,z:20};
  const inRange={id:'first',x:44.9,z:-14.9};
  const outer={id:'edge',x:45,z:20}, fleet={id:'fleet',x:12,z:24};
  const state={cars:[player,inRange,outer],traffic:[{...player},{id:'out',x:-200,z:20},fleet],units:[inRange]};
  const expected=[...state.cars,...state.traffic,...state.units].filter(other=>
    other.id!==player.id && Math.abs(other.x-player.x)<35 && Math.abs(other.z-player.z)<35);
  const actual=nearbyVehicleContacts(state,player,35);
  assert.equal(actual.length,3);assert.deepEqual(actual.map((vehicle,i)=>vehicle===expected[i]),[true,true,true]);
  assert.deepEqual(actual.map(v=>v.id),['first','fleet','first']);
});
