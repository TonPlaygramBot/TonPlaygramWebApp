import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from '../webapp/node_modules/typescript/lib/typescript.js';
import * as T from '../webapp/node_modules/three/build/three.module.js';
import * as spatial from '../webapp/src/games/tiranastreets/street-career/spatialCore.mjs';
import * as shots from '../webapp/src/games/tiranastreets/street-career/shotCore.mjs';
import {createBody} from '../webapp/src/games/tiranastreets/street-career/playerCore.mjs';
import {WEAPON_BY_ID} from '../webapp/src/games/tiranastreets/shared/weapons.mjs';

function load(path, deps={}, globals={}) {
  const module={exports:{}};
  const code=ts.transpileModule(readFileSync(new URL('../webapp/src/games/tiranastreets/'+path,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  vm.runInNewContext(code,{module,exports:module.exports,require:key=>deps[key]||{},setTimeout,clearTimeout,...globals});
  return module.exports;
}
const {FollowCamera}=load('street-career/FollowCamera.ts',{'three':T});
const {LocalShadowBudget}=load('LocalShadowBudget.ts',{'three':T});
const stations=load('radio/stations.ts');
const {VehicleRadio}=load('radio/VehicleRadio.ts',{'./stations':stations});
function cameraOptions(patch={}) {
  return {key:'walk',anchor:{x:0,y:1.6,z:0},yaw:0,pitch:-.1,distance:3,shoulder:.48,dt:1/60,cast:(_o,_d,max)=>max,ground:()=>0,...patch};
}
test('portrait camera keeps the player ahead; upward swipe lifts the look direction',()=>{
  const camera=new T.PerspectiveCamera(74,390/844,.15,300),rig=new FollowCamera();
  rig.update(camera,cameraOptions());
  assert.ok(camera.position.z>2.5);assert.ok(camera.position.y>1.6);assert.ok(camera.position.x>0);
  const before=camera.getWorldDirection(new T.Vector3()).y;
  rig.update(camera,cameraOptions({pitch:.4}));
  assert.ok(camera.getWorldDirection(new T.Vector3()).y>before);
  assert.ok(camera.position.y>=.28);
});
test('near-plane corners retract immediately and recover gradually without a one-metre wall override',()=>{
  const camera=new T.PerspectiveCamera(74,390/844,.15,300),rig=new FollowCamera();
  rig.update(camera,cameraOptions());
  // Only the right near-plane corner meets the wall. Centre-ray-only tests miss it.
  rig.update(camera,cameraOptions({cast:(o,d,max)=>d.z>0&&o.x>.1?.4:max}));
  const distance=camera.position.distanceTo(new T.Vector3(0,1.6,0));
  assert.ok(distance<=.201);
  rig.update(camera,cameraOptions());
  assert.ok(camera.position.distanceTo(new T.Vector3(0,1.6,0))<1);
});
test('outward damping is consistent at 30/60/120 Hz and resets at teleport',()=>{
  const distances=[];
  for(const hz of [30,60,120]){
    const camera=new T.PerspectiveCamera(),rig=new FollowCamera();
    rig.update(camera,cameraOptions({distance:1}));
    for(let i=0;i<hz;i++)rig.update(camera,cameraOptions({distance:8,dt:1/hz}));
    distances.push(camera.position.length());
    rig.update(camera,cameraOptions({anchor:{x:1000,y:30,z:1000}}));
    assert.ok(camera.position.distanceTo(new T.Vector3(1000,30,1000))<4);
  }
  assert.ok(Math.max(...distances)-Math.min(...distances)<1e-6);
});
test('shadow atlas follows distant terrain and runs at 20/30 Hz on a 120 Hz display',()=>{
  for(const high of [false,true]){
    const light=new T.DirectionalLight(),budget=new LocalShadowBudget();
    Object.assign(light.shadow.camera,{left:-38,right:38,top:38,bottom:-38});
    let refreshes=0;
    for(let i=0;i<120;i++){
      if(budget.update(light,{x:2000+i/120,y:180,z:-1500},1/120,high))refreshes++;
      light.shadow.needsUpdate=false;
    }
    assert.ok(refreshes<=(high?31:21));assert.ok(refreshes>=(high?25:17));
    assert.ok(light.target.position.distanceTo(new T.Vector3(2001,180,-1500))<.3);
    assert.ok(budget.update(light,{x:-900,y:0,z:800},0,high));
  }
});
function radioFixture(Radio=VehicleRadio){
  const audios=[],memory=new Map();
  const radio=new Radio({getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)},()=>{
    const a={src:'',volume:0,preload:'',paused:false,loads:0,
      play(){this.pending=new Promise((resolve,reject)=>{this.resolve=resolve;this.reject=reject;});return this.pending;},
      pause(){this.paused=true;},removeAttribute(){this.src='';},load(){this.loads++;}};
    audios.push(a);return a;
  });
  return {radio,audios,memory};
}
test('radio makes no request until a driving user gesture; exit releases its connection',()=>{
  const {radio,audios}=radioFixture();radio.setContext(true,.6);assert.equal(audios.length,0);
  radio.toggle();assert.equal(audios.length,1);assert.equal(audios[0].volume,.45*.6);
  audios[0].onplaying();assert.equal(radio.snapshot().status,'playing');
  radio.setContext(false);assert.equal(audios[0].src,'');assert.ok(audios[0].paused);assert.equal(radio.snapshot().status,'paused');
  radio.dispose();
});
test('fast station changes, stale failures and pause never revive an obsolete stream',async()=>{
  const {radio,audios}=radioFixture();radio.setContext(true);radio.toggle();
  const stalePlaying=audios[0].onplaying;radio.next();
  assert.equal(audios[0].src,'');assert.equal(audios.length,2);
  audios[1].onplaying();stalePlaying();audios[0].reject({name:'NotAllowedError'});await Promise.resolve();
  assert.equal(radio.snapshot().status,'playing');assert.equal(radio.snapshot().station,'club-fm');
  radio.setContext(false);audios[1].resolve();await Promise.resolve();assert.equal(radio.snapshot().status,'paused');radio.dispose();
});
test('mobile autoplay denial offers retry; bad network stops and never loops requests',async()=>{
  const {radio,audios}=radioFixture();radio.setContext(true);radio.toggle();audios[0].reject({name:'NotAllowedError'});await Promise.resolve();
  assert.equal(radio.snapshot().status,'blocked');assert.equal(audios[0].src,'');
  radio.toggle();assert.equal(audios.length,2);audios[1].onerror();assert.equal(radio.snapshot().status,'unavailable');
  for(let i=0;i<100;i++)radio.setContext(true);
  assert.equal(audios.length,2);radio.dispose();
});
test('stream timeout, end and teardown release handlers and pending timers',()=>{
  let timer,cleared=0;
  const {VehicleRadio:TimedRadio}=load('radio/VehicleRadio.ts',{'./stations':stations},{setTimeout:cb=>{timer=cb;return 1;},clearTimeout:()=>{cleared++;}});
  const {radio,audios}=radioFixture(TimedRadio);radio.setContext(true);radio.toggle();timer();
  assert.equal(radio.snapshot().status,'unavailable');assert.equal(audios[0].onplaying,null);
  radio.toggle();audios[1].onended();assert.equal(radio.snapshot().status,'unavailable');
  radio.toggle();radio.dispose();timer();assert.equal(radio.snapshot().status,'off');assert.ok(cleared>0);
  radio.next();assert.equal(audios.length,3);
});
test('station/volume survive storage but enabled playback never auto-starts a fresh session',()=>{
  const {radio,memory}=radioFixture();radio.next(-1);radio.setVolume(.75);
  const restored=new VehicleRadio({getItem:k=>memory.get(k),setItem(){}},()=>{throw Error('must not allocate media');});
  assert.equal(restored.snapshot().station,'radio-shqip');assert.equal(restored.snapshot().volume,.75);assert.equal(restored.snapshot().enabled,false);
  restored.setContext(true);restored.dispose();radio.dispose();
  const privateRadio=new VehicleRadio({getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}});
  privateRadio.setVolume(Number.NaN);assert.equal(privateRadio.snapshot().volume,.45);privateRadio.dispose();
});
test('all shipped stations have distinct HTTPS audio and official page URLs',()=>{
  const entries=stations.ALBANIAN_STATIONS;
  assert.equal(new Set(entries.map(s=>s.id)).size,5);
  for(const station of entries){assert.equal(new URL(station.stream).protocol,'https:');assert.equal(new URL(station.website).protocol,'https:');}
});

test('actual StreetRenderer shoulder reticle projects the same nearby actor hit as the simulation; aim uses the eyes',()=>{
  const {StreetRenderer}=load('street-career/StreetRenderer.ts',{
    three:T,'../renderer':{CityRenderer:class{}},'./spatialCore.mjs':spatial,
    './shotCore.mjs':shots,'../shared/weapons.mjs':{WEAPON_BY_ID},
    './weaponPose.mjs':{weaponAnchors:()=>({zoom:1})}
  });
  const player={x:4,z:8,weapon:'ak47VolleyAttack'},body={...createBody(),y:10,eye:1.68};
  const eye={x:4,y:11.68,z:8},actor={id:'target',x:4,y:10,z:2,health:100,height:1.76};
  const world={cast:(origin,direction,distance)=>({distance,point:spatial.pointAlong(origin,direction,distance),kind:'air'}),surface:()=>10};
  const sim={body,flight:{},access:{binoculars:false,parachute:{open:false}},eye:()=>eye,cars:()=>[],world};
  let masked;
  const renderer=Object.assign(Object.create(StreetRenderer.prototype),{
    simulation:sim,followCamera:new FollowCamera(),camera:new T.PerspectiveCamera(74,390/844,.15,300),
    bodyRig:{setEyeView:value=>{masked=value;},weapon:{}},yaw:0,pitch:0,settings:{walkingView:'shoulder',fov:74}
  });
  const state={players:{local:player},cars:[],npcs:[actor]};
  renderer.presentFirstPerson(state,'local',1/60);renderer.camera.updateMatrixWorld();
  assert.equal(masked,false);assert.ok(renderer.camera.position.z>eye.z+2);
  const hit=shots.traceShot(world,eye,spatial.direction3(0,0),250,[],[actor]).hit;
  const projected=new T.Vector3(hit.point.x,hit.point.y,hit.point.z).project(renderer.camera);
  assert.ok(Math.abs(projected.x)<1e-8&&Math.abs(projected.y)<1e-8);
  body.aim=true;renderer.presentFirstPerson(state,'local',1/60);
  assert.equal(masked,true);assert.equal(renderer.camera.position.distanceTo(eye),0);
  body.aim=false;world.cast=(o,d,max)=>({distance:d.z>0?.3:max,point:spatial.pointAlong(o,d,max),kind:'wall'});
  renderer.presentFirstPerson(state,'local',1/60);
  assert.equal(masked,true,'a wall cannot push the camera inside an unmasked head');
  assert.equal(renderer.camera.position.distanceTo(eye),0);
});
