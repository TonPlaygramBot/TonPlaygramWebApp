import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {VEHICLE_COLLECTION,collectionVehicleFor} from '../webapp/src/games/tiranastreets/shared/vehicleCollection.mjs';
import {COLLECTION_PLACEMENTS} from '../webapp/src/games/tiranastreets/shared/collectionPlacements.mjs';
import {createState,interact,advanceState,control,FREE_ROAM,emptyInput} from '../webapp/src/games/tiranastreets/shared/engine.mjs';
import {ORIGIN,OBSTACLES,props,START,EXTRACTION,SPAWNS,BATTLEFIELD_MAPS} from '../webapp/src/games/blackwater/shared/layout.mjs';
import {footprintDistance} from '../webapp/src/games/tiranastreets/shared/architecture.mjs';
const expected=['benz','bmw','range','audi','ford','fiat','jaguar','ferrari','bugatti','landrover'];
test('all ten approved GLBs retain exact bytes, geometry counts and embedded materials',()=>{
 assert.deepEqual(VEHICLE_COLLECTION.map(c=>c.id),expected);
 for(const a of VEHICLE_COLLECTION){
  const bytes=readFileSync(new URL('../webapp/public'+a.url,import.meta.url));
  assert.equal(bytes.length,a.bytes,a.id);assert.equal(createHash('sha256').update(bytes).digest('hex'),a.sha256,a.id);
  assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(8),bytes.length);
  const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
  assert.ok(gltf.extensionsRequired.includes('KHR_draco_mesh_compression'));
  assert.ok(gltf.meshes.length>0&&gltf.materials.length>0);
  assert.ok(gltf.images.every(i=>Number.isInteger(i.bufferView)),'PBR maps must be embedded');
  assert.equal(gltf.asset.extras.name,a.name);
 }
});
test('the same ten cars exist as parked FPS props and enterable simulation vehicles',()=>{
 const state=createState([{id:'tester',name:'Tester'}],FREE_ROAM.id,'solo');
 assert.equal(state.cars.filter(collectionVehicleFor).length,10);
 assert.deepEqual(new Set(state.traffic.filter(collectionVehicleFor).map(c=>c.collectionVehicle)),new Set(expected));
 assert.equal(state.traffic.filter(collectionVehicleFor).length,28,'keep traffic population unchanged');
 for(const p of COLLECTION_PLACEMENTS){
  const car=state.cars.find(c=>c.id===p.id),prop=props.find(c=>c.collectionVehicle===p.collectionVehicle);
  assert.ok(car&&prop,p.id);assert.equal(car.x,p.x);assert.equal(car.z,p.z);
  assert.ok(Math.abs(prop.x+ORIGIN.x-p.x)<1e-9);assert.ok(Math.abs(prop.z+ORIGIN.z-p.z)<1e-9);
  assert.equal(prop.w,p.w);assert.equal(prop.d,p.d);assert.equal(prop.h,p.h);
  assert.ok(car.npcDriver&&!car.driver);assert.ok(OBSTACLES.includes(prop));
 }
});
test('full-sized parked models avoid buildings, existing props and player spawns',()=>{
 for(const c of props.filter(c=>c.collectionVehicle)){
  const radius=Math.hypot(c.w,c.d)/2;
  for(const o of OBSTACLES){if(o===c)continue;
   const clear=o.footprint?footprintDistance(c.x,c.z,o.footprint,o.holes):Math.hypot(c.x-o.x,c.z-o.z)-Math.hypot(o.w,o.d)/2;
   assert.ok(clear>radius,`${c.collectionVehicle} overlaps an existing obstacle`);
  }
  for(const p of [START,EXTRACTION,...SPAWNS,...BATTLEFIELD_MAPS.flatMap(m=>[m.start,m.extraction])])assert.ok(Math.hypot(c.x-p.x,c.z-p.z)>radius+3);
 }
});
test('each NPC yields its seat, the player can drive and exit, and no duplicate driver returns',()=>{
 for(const asset of VEHICLE_COLLECTION){
  const s=createState([{id:'tester',name:'Tester'}],FREE_ROAM.id,'solo'),p=s.players.tester;
  const c=s.cars.find(c=>c.collectionVehicle===asset.id);p.x=c.x;p.z=c.z;s.elapsed=.5;
  interact(s,'tester','vehicle');assert.equal(p.carId,c.id,asset.id);assert.equal(c.driver,'tester');assert.equal(c.npcDriver,false);
  const before={x:c.x,z:c.z};
  for(let i=0;i<60;i++){control(s,'tester',{...emptyInput(),y:1});advanceState(s,1/60);}
  assert.ok(Math.hypot(c.x-before.x,c.z-before.z)>.1,asset.id+' must drive');
  c.speed=0;interact(s,'tester','vehicle');assert.equal(p.carId,null);assert.equal(c.driver,null);assert.equal(c.npcDriver,false);
 }
});
test('AI traffic stays deterministic and every model retains a human driver identity',()=>{
 const a=createState([{id:'tester',name:'Tester'}],FREE_ROAM.id,'solo'),b=createState([{id:'tester',name:'Tester'}],FREE_ROAM.id,'solo');
 const before=a.traffic.map(c=>({x:c.x,z:c.z}));
 for(let i=0;i<120;i++){advanceState(a,1/60);advanceState(b,1/60);}
 assert.deepEqual(a.traffic,b.traffic);
 assert.ok(a.traffic.some((c,i)=>Math.hypot(c.x-before[i].x,c.z-before[i].z)>1));
 assert.ok(a.traffic.filter(collectionVehicleFor).every(c=>c.npcDriver&&collectionVehicleFor(c)&&Number.isFinite(c.heading)));
});
