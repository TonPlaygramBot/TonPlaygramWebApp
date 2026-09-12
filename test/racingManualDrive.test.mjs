import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TRACKS,KARTS,STEP,makeTrack,createRacer,stepRacer,stepRace,equipKart} from '../webapp/src/games/kartroyale/simulation.mjs';
import {createHeldRaceInput} from '../webapp/src/games/kartroyale/heldRaceInput.mjs';
import {buildingClearance} from '../webapp/src/games/kartroyale/raceCourse.mjs';
import {ribbonExclusion,segmentDistance} from '../webapp/src/games/tirana-street-detail/roadDetailCore.mjs';
import {CANOPY_TREES} from '../webapp/src/games/tirana-street-life/canopyRegistry.mjs';
import {driverPose,DRIVER_REST} from '../webapp/src/games/kartroyale/driverPose.mjs';
const track=makeTrack('blloku');
const run=(r,input,n=60)=>{for(let i=0;i<n;i++)stepRacer(r,input,track,STEP,i*STEP);};
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
test('manual gas: neutral and boost alone cannot launch, release coasts, brake overrides gas',()=>{
 for(const kart of KARTS){
  const r=equipKart(createRacer(track,'human','Driver'),kart.id);
  run(r,{},120);assert.equal(r.speed,0);
  r.turbo=2;run(r,{boost:true},30);assert.equal(r.speed,0);
  run(r,{throttle:'true'},30);assert.equal(r.speed,0);
  run(r,{throttle:true},60);assert.ok(r.speed>8,kart.id);
  const speed=r.speed;run(r,{},15);assert.ok(r.speed>0&&r.speed<speed);
  run(r,{throttle:true,brake:true},90);assert.equal(r.speed,0);
 }
});
test('gas, slide drift and steering have independent ownership and clear on suspension',()=>{
 const input=createHeldRaceInput();input.hold('gas','throttle',true);input.hold('left','steer',-1);input.hold('slide','drift',true);
 assert.equal(input.read().throttle,true);input.release('slide');assert.equal(input.read().throttle,true);assert.equal(input.read().steer,-1);
 input.release('gas');assert.equal(input.read().throttle,false);assert.equal(input.read().steer,-1);input.clear();assert.equal(input.read().steer,0);
});
test('rounded courses leave building clearance and no eligible canopy intersects the widened ribbon',()=>{
 let excluded=0;
 for(const config of TRACKS){
  const t=makeTrack(config.id),blocked=ribbonExclusion(t);
  assert.ok(t.turns.length>0);assert.equal(t.points.length%4,0);
  for(const p of t.points){assert.ok(p.width>=6);assert.ok(buildingClearance(p.x,p.z)-p.width/2>=1.59,config.id);assert.ok(blocked(p.x,p.z,0));}
  for(const tree of CANOPY_TREES){
   const radius=Math.max(.8,tree.crown*.75);
   if(blocked(tree.x,tree.z,radius)){excluded++;continue;}
   // Independent brute-force geometry check against every segment.
   for(let i=0;i<t.points.length;i++){
    const a=t.points[i],b=t.points[(i+1)%t.points.length];
    assert.ok(segmentDistance(tree.x,tree.z,[a.x,a.z],[b.x,b.z])>=Math.max(a.width,b.width)/2+radius+1-1e-6);
   }
  }
 }
 assert.ok(excluded>0,'Previously overlapping trees must actually be excluded');
});
test('animated arms keep their lengths and both gloved hands on the steering rim',()=>{
 for(const steer of [-1,-.5,0,.5,1])for(const acceleration of [-35,0,25])for(const rate of [-1.5,0,1.5]){
  const pose=driverPose(steer,acceleration,rate,35,2);
  for(const [side,arm] of Object.entries(pose.arms)){
   const rest=DRIVER_REST[side];
   assert.ok(Math.abs(distance(arm.shoulder,arm.elbow)-distance(rest.shoulder,rest.elbow))<1e-6);
   assert.ok(Math.abs(distance(arm.elbow,arm.hand)-distance(rest.elbow,rest.hand))<1e-6);
   assert.ok(Math.abs(distance(arm.hand,[0,.70,.16])-.16)<1e-8);
  }
 }
});
test('Blender full and mobile models contain wheel, aero, helmet and five harness pivots',()=>{
 const gltf=name=>{const b=readFileSync(new URL(`../webapp/public/assets/kart-royale/karts/${name}.glb`,import.meta.url));assert.equal(b.subarray(0,4).toString(),'glTF');return JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());};
 for(const suffix of ['','-lod']){
  for(const id of ['photon','vortex','aegis']){
   const g=gltf(id+suffix),names=new Set(g.nodes.map(n=>n.name));
   for(const name of ['body','steering_wheel','aero_wing','steer_fl','steer_fr','wheel_fl','wheel_fr','wheel_rl','wheel_rr'])assert.ok(names.has(name),`${id}/${name}`);
  }
  const names=new Set(gltf('race-driver'+suffix).nodes.map(n=>n.name));
  for(const name of ['helmet','torso','hand_l','hand_r','elbow_l','elbow_r','boot_l','boot_r','harness_shoulder_l','harness_shoulder_r','harness_lap_l','harness_lap_r','harness_crotch'])assert.ok(names.has(name),name);
 }
});
test('completed laps have three positive split times, without recovery creating a split',()=>{
 const r=equipKart(createRacer(track,'ai','Driver',0,true),'vortex');
 for(let time=0;time<500&&!r.finished;time+=STEP)stepRace([r],track,STEP,time,'pro');
 assert.equal(r.finished,true);assert.equal(r.lapTimes.length,3);assert.ok(r.lapTimes.every(t=>t>10));
 assert.ok(r.lapTimes.reduce((sum,t)=>sum+t,0)<=r.finishTime+.01);
});
test('exported seated drivers keep their hands aligned with each kart wheel after model fitting',async()=>{
 const T=await import('../webapp/node_modules/three/build/three.module.js');
 const {GLTFLoader}=await import('../webapp/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
 const {default:ts}=await import('../webapp/node_modules/typescript/lib/typescript.js');
 const source=readFileSync(new URL('../webapp/src/games/kartroyale/KartDriver.ts',import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace("'three'",JSON.stringify(new URL('../webapp/node_modules/three/build/three.module.js',import.meta.url).href)).replace("'./driverPose.mjs'",JSON.stringify(new URL('../webapp/src/games/kartroyale/driverPose.mjs',import.meta.url).href));
 const {KartDriver}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
 // Geometry/transform verification does not need the original kart's paint image.
 const loader=new GLTFLoader();loader.register(()=>({name:'CPUTransformTextures',loadTexture:()=>Promise.resolve(new T.Texture())}));
 const load=async id=>{const bytes=readFileSync(new URL(`../webapp/public/assets/kart-royale/karts/${id}.glb`,import.meta.url));return (await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;};
 const template=await load('race-driver');
 for(const kart of KARTS){
  const model=await load(kart.id),body=model.getObjectByName('body'),wheel=model.getObjectByName('steering_wheel'),driver=new KartDriver(template,'#44caff',kart.id==='oopi');body.add(driver.root);
  model.position.set(10,.13,-20);model.rotation.y=.8;model.scale.setScalar(.93);
  for(const steer of [-1,0,1]){
   wheel.rotation.z=steer*.65;const r=equipKart(createRacer(track,'you','Driver'),kart.id);Object.assign(r,{steering:steer,speed:25,yawRate:steer,acceleration:10,throttle:1});driver.update(r,1,false);model.updateMatrixWorld(true);
   for(const [side,x] of [['l',.16],['r',-.16]]){const actual=driver.root.getObjectByName('hand_'+side).getWorldPosition(new T.Vector3()),expected=wheel.localToWorld(new T.Vector3(x,0,0));assert.ok(actual.distanceTo(expected)<1e-6,`${kart.id}/${side} hand slipped off wheel`);}
   driver.update(r,1,true);assert.equal(driver.root.getObjectByName('helmet').visible,false);driver.update(r,1,false);assert.equal(driver.root.getObjectByName('helmet').visible,true);
  }
 }
});
