import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from '../webapp/node_modules/three/build/three.module.js';
import {GLTFLoader} from '../webapp/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import {KARTS} from '../webapp/src/games/kartroyale/vehicleCatalog.mjs';
import {driverPose} from '../webapp/src/games/kartroyale/driverPose.mjs';
for(const kart of KARTS)test(`${kart.id}: portrait driver view contains wheel, both gloves and both feet`,async()=>{
 const bytes=readFileSync(new URL(`../webapp/public/assets/kart-royale/karts/${kart.id}.glb`,import.meta.url));
 const model=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'')).scene;
 model.updateMatrixWorld(true);const eye=model.getObjectByName('driver_eye').getWorldPosition(new T.Vector3());
 const camera=new T.PerspectiveCamera(96,390/844,.04,400);camera.position.copy(eye);camera.lookAt(eye.clone().add(new T.Vector3(0,-5.5,24)));camera.updateMatrixWorld();
 const height=kart.id==='oopi'?.1:0,ray=new T.Raycaster();
 for(const steering of [-1,0,1]){
  const pose=driverPose(steering);const points=[new T.Vector3(0,.70+height,.16),...Object.values(pose.arms).map(a=>new T.Vector3(...a.hand).add(new T.Vector3(0,height,0))),new T.Vector3(.176,.25+height,.80),new T.Vector3(-.176,.25+height,.80)];
  for(const point of points){const p=point.clone().project(camera);assert.ok(Math.abs(p.x)<.98&&p.y>-.85&&p.y<.7,`${kart.id} body control outside cockpit viewport: ${p.toArray()}`);}
  // Low nose keeps both pedal toes visible from the original seat, not a fake
  // overlay camera. Steering hardware may occlude glove contact intentionally.
  for(const point of points.slice(-2)){
   const direction=point.clone().sub(eye);const distance=direction.length();ray.set(eye,direction.normalize());ray.far=distance-.035;
   const hit=ray.intersectObject(model,true)[0];assert.ok(!hit,`${kart.id} pedal view blocked by ${hit?.object.name}`);
  }
 }
});
