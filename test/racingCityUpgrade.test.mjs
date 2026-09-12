import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {WORLD} from '../webapp/src/games/tiranastreets/shared/world.mjs';
import {CITY_CIRCUITS} from '../webapp/src/games/kartroyale/city-circuits.mjs';
import {makeTrack,createRacer,equipKart,stepRace,STEP,RACE_LIMIT,nearestPoint} from '../webapp/src/games/kartroyale/simulation.mjs';
import {COLLECTION_BY_ID} from '../webapp/src/games/tiranastreets/shared/vehicleCollection.mjs';
import {vehicleDriverMount,cockpitStyle} from '../webapp/src/games/kartroyale/vehicleAssetConfig.mjs';
import {resolveKartContact} from '../webapp/src/games/kartroyale/collisions.mjs';
const key=(a,b)=>[a.join(','),b.join(',')].sort().join('|');
const edges=new Map(WORLD.roads.filter(r=>!r.walk).map(r=>[key(r.a,r.b),r]));
test('archived city routes retain mapped edges while active races use rounded compact circuits',()=>{
 assert.equal(CITY_CIRCUITS.routes.length,5);
 for(const route of CITY_CIRCUITS.routes){
  assert.ok(route.length>=route.originalLength*2.6);
  assert.ok(route.length>=4800&&route.length<=5400);
  assert.equal(new Set(route.points.map(p=>p.join(','))).size,route.points.length);
  route.points.forEach((a,i)=>{const edge=edges.get(key(a,route.points[(i+1)%route.points.length]));assert.ok(edge,route.id+' disconnected edge');assert.ok(route.widths[i]<=edge.w+.001);});
  const track=makeTrack(route.id);assert.ok(track.length>=800&&track.length<2200);assert.ok(track.turns.length>0);
  assert.equal(track.points.length%4,0);
  for(const p of track.points){const near=nearestPoint(track,p.x,p.z);assert.ok(near.distance<1e-7);assert.ok(near.width>=6&&near.width<=18);}
 }
});
test('street cameras retain source seats while stale racing car IDs migrate to kart footprints',()=>{
 const t=makeTrack();
 for(const car of COLLECTION_BY_ID.values()){
  const eye=vehicleDriverMount(car.id,{scale:1,offset:[0,0,0]});
  assert.ok(Math.abs(eye[1]-(car.driverSeat[1]+.62))<1e-8);assert.ok(eye[0]>0);assert.ok(eye[1]<car.height+.02);
  const r=equipKart(createRacer(t,car.id,car.name),car.id);assert.equal(r.kartId,'apex');assert.equal(r.bodyLength,2.7);assert.equal(r.bodyWidth,1.72);assert.ok(cockpitStyle(car.id));
 }
});
test('migrated car selections use the compact kart collision footprint',()=>{
 const t=makeTrack(),a=equipKart(createRacer(t,'a','A'),'benz'),b=equipKart(createRacer(t,'b','B'),'benz');
 Object.assign(a,{x:0,z:0,yaw:0,velocityYaw:0,speed:0});Object.assign(b,{x:0,z:2.4,yaw:0,velocityYaw:0,speed:0});
 resolveKartContact(a,b);assert.ok(Math.abs(b.z-a.z)>2.4);assert.equal(a.kartId,'apex');assert.equal(b.kartId,'apex');
});
test('all five Blender cockpit exports contain eye, steering, and instrument pivots',()=>{
 for(const style of ['sedan','sport','suv','armored','kart']){
  const path=new URL('../webapp/public/assets/kart-royale/cockpits/'+style+'.glb',import.meta.url),bytes=fs.readFileSync(path);
  assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(8),bytes.length);
  const doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
  assert.match(doc.asset.generator,/Blender/);assert.ok(doc.images?.length,'packed leather texture');
  for(const name of ['DriverEye','SteeringWheel','SpeedNeedle','TachNeedle'])assert.ok(doc.nodes.some(n=>n.name===name),style+' '+name);
  assert.ok(fs.statSync(new URL('../assets-source/racing-cockpits/'+style+'.blend',import.meta.url)).size>10000);
 }
});
for(const [i,route] of CITY_CIRCUITS.routes.entries())test(route.id+': a full race completes all thirteen ordered gates',()=>{
 const t=makeTrack(route.id),r=equipKart(createRacer(t,'ai','AI',0,true),['apex','benz','bmw','range','shota'][i]);
 let time=0;for(;time<RACE_LIMIT&&!r.finished&&!r.retired;time+=STEP)stepRace([r],t,STEP,time,'street');
 assert.ok(r.finished,JSON.stringify({track:route.id,car:r.kartId,time,health:r.health,lap:r.lap,index:r.index}));
 assert.equal(r.lap,4);assert.equal(r.gates,13);assert.ok(r.finishTime<RACE_LIMIT);
});

test('cockpit eye survives native orientation, scaling, and an exterior mesh parent',async()=>{
 const T=await import('../webapp/node_modules/three/build/three.module.js');
 const {default:ts}=await import('../webapp/node_modules/typescript/lib/typescript.js');
 const src=fs.readFileSync(new URL('../webapp/src/games/kartroyale/RacingCockpit.ts',import.meta.url),'utf8');
 const code=ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace("'three'",JSON.stringify(new URL('../webapp/node_modules/three/build/three.module.js',import.meta.url).href));
 const {RacingCockpit}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
 const root=new T.Group(),body=new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial());root.add(body);body.rotation.y=-Math.PI/2;body.scale.setScalar(.8);root.position.set(12,0,14);root.rotation.y=.7;
 const template=new T.Group();template.add(new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial()));
 const expected=root.localToWorld(new T.Vector3(.43,1.19,-.12)),c=new RacingCockpit(template,root,body,new T.Vector3(.43,1.19,-.12));
 c.update(true,0,0);assert.ok(c.eye(new T.Vector3()).distanceTo(expected)<1e-8);assert.ok(body.visible);assert.equal(body.material.visible,false);
 c.update(false,0,0);assert.equal(body.material.visible,true);
});
