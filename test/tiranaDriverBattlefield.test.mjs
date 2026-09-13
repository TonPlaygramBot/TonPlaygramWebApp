import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from '../webapp/node_modules/typescript/lib/typescript.js';
import * as T from '../webapp/node_modules/three/build/three.module.js';
import * as driver from '../webapp/src/games/tiranastreets/shared/driverView.mjs';
import {VEHICLE_COLLECTION} from '../webapp/src/games/tiranastreets/shared/vehicleCollection.mjs';
import {FORCE_VEHICLE_BOUNDS} from '../webapp/src/games/tiranastreets/shared/albanianForces.mjs';
import * as brains from '../webapp/src/games/blackwater/shared/botBrain.mjs';
import * as missions from '../webapp/src/games/blackwater/shared/battlefield.mjs';
import * as tactics from '../webapp/src/games/tiranastreets/shared/forceTactics.mjs';
import * as physics from '../webapp/src/games/blackwater/shared/physics.mjs';
import * as terrain from '../webapp/src/games/blackwater/shared/terrain.mjs';
import {BATTLEFIELD_MAPS,OBSTACLES} from '../webapp/src/games/blackwater/shared/layout.mjs';
import {advanceBattleObjective} from '../webapp/src/games/blackwater/shared/missionCore.mjs';
import {CITY_POPULATION} from '../webapp/src/games/tiranastreets/shared/cityPopulation.mjs';
import {nearbyHumans} from '../webapp/src/games/tiranastreets/street-career/humanRoster.mjs';
function loadTS(file,deps){const module={exports:{}};const code=ts.transpileModule(readFileSync(new URL('../'+file,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;vm.runInNewContext(code,{module,exports:module.exports,require:key=>deps[key]||{},console,Math,performance},{filename:file});return module.exports;}
const {BattlefieldVehicle}=loadTS('webapp/src/games/blackwater/BattlefieldVehicle.ts',{'three':T,'./core':physics,'./shared/terrain.mjs':terrain,'../tiranastreets/shared/driverView.mjs':driver});
const {GameEngine}=loadTS('webapp/src/games/blackwater/engine.ts',{'three':T,'./core':physics,'./shared/terrain.mjs':terrain,'./shared/botBrain.mjs':brains,'./shared/battlefield.mjs':missions,'../tiranastreets/shared/forceTactics.mjs':tactics});
const flat=()=>0,close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);

test('all collection, force, bus and generic cameras face forward from a fixed driver seat',()=>{
 const fleet=[...VEHICLE_COLLECTION.map(c=>({collectionVehicle:c.id})),...FORCE_VEHICLE_BOUNDS.map(c=>({forceVehicle:c.id})),...['sedan','sport','taxi','motorbike','tirana-bus'].map(model=>({model}))];
 for(const spec of fleet)for(const heading of [0,Math.PI/2,Math.PI,-Math.PI/2]){
  const car={x:10,z:20,heading,...spec},eye=driver.driverEye(car,flat),seat=driver.driverSocket(car),d=driver.driverDirection(car,heading,0,flat);
  close(eye.y,seat.y);close(d.x,-Math.sin(heading));close(d.z,-Math.cos(heading));
  close(Math.hypot(eye.x-car.x,eye.z-car.z),Math.hypot(seat.x,seat.z));
  assert.ok(seat.width>0&&seat.length>0);
 }
 assert.ok(driver.driverSocket({forceVehicle:'police_van'}).z<-1);
 assert.ok(driver.driverSocket({model:'motorbike'}).open);
});
test('eye, view and up use the same support-plane rotation on hills',()=>{
 const sample=(x,z)=>100+x*.2+z*.15,car={x:10,z:20,heading:.7,collectionVehicle:'range'};
 const seat=driver.driverSocket(car),up=new T.Vector3(-.2,1,-.15).normalize(),q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),up);
 const expected=new T.Vector3(seat.x,seat.y,seat.z).applyAxisAngle(new T.Vector3(0,1,0),car.heading).applyQuaternion(q).add(new T.Vector3(car.x,sample(car.x,car.z),car.z));
 const eye=driver.driverEye(car,sample),d=driver.driverDirection(car,car.heading,0,sample),u=driver.driverUp(car,sample);
 close(eye.x,expected.x);close(eye.y,expected.y);close(eye.z,expected.z);close(d.x*u.x+d.y*u.y+d.z*u.z,0);close(u.y,up.y);
});
test('actual Battlefield camera resets aim zoom/near plane in portrait and landscape',()=>{
 const car=Object.assign(Object.create(BattlefieldVehicle.prototype),{car:{x:0,z:0,heading:1,model:'sedan'},view:'cockpit'});
 for(const aspect of [390/844,844/390]){
  const camera=new T.PerspectiveCamera(40,aspect,.2,2800);car.camera(camera,[]);
  close(camera.fov,driver.driverFov(aspect));close(camera.near,.035);
  const expected=driver.driverEye(car.car,terrain.battleGround);close(camera.position.x,expected.x);close(camera.position.y,expected.y);
  const direction=camera.getWorldDirection(new T.Vector3()),forward=driver.driverDirection(car.car,car.car.heading,0,terrain.battleGround);close(direction.x,forward.x);close(direction.z,forward.z);
 }
});
test('every mapped district has a unique clear deployment, full wave and reachable extraction',()=>{
 assert.equal(new Set(BATTLEFIELD_MAPS.map(m=>m.id)).size,BATTLEFIELD_MAPS.length);
 assert.equal(new Set(BATTLEFIELD_MAPS.map(m=>`${m.start.x},${m.start.z}`)).size,BATTLEFIELD_MAPS.length);
 for(const m of BATTLEFIELD_MAPS){
  const obstacles=missions.sectorObstacles(m.start,220),spawn=missions.sectorSpawns(m.id,20,OBSTACLES,[m.start]);
  assert.equal(spawn.length,20,m.name);assert.ok(!physics.collides(m.start.x,m.start.z,.4,OBSTACLES),m.name);
  const end=physics.findPath(m.start,m.extraction,obstacles).at(-1);assert.ok(end&&Math.hypot(end.x-m.extraction.x,end.z-m.extraction.z)<2,m.name);
  for(const p of missions.sectorSpawns(m.id,7)){
   const arrival=physics.findPath(p,m.start,obstacles).at(-1);
   assert.ok(arrival&&Math.hypot(arrival.x-m.start.x,arrival.z-m.start.z)<4,`${m.name}: bot must reach the objective`);
  }
 }
 assert.ok(BATTLEFIELD_MAPS.length>100);
});
test('all districts have operations and existing completion order survives reload without duplicate rewards',()=>{
 for(const m of BATTLEFIELD_MAPS)assert.ok(missions.OPERATIONS.some(o=>o.map===m.id),m.name);
 let p={completed:[]};for(const op of missions.OPERATIONS)p=missions.finishOperation(p,op.id,true);
 assert.equal(p.completed.length,missions.OPERATIONS.length);assert.deepEqual(missions.normalizeOperations(JSON.parse(JSON.stringify(p))),p);
 assert.deepEqual(missions.finishOperation(p,missions.OPERATIONS[0].id,true),p);
});
test('city density and nearby render budgets increase together and retain deterministic nearest selection',()=>{
 assert.ok(CITY_POPULATION.vehicles>=5600&&CITY_POPULATION.pedestrians>=2400);
 const crowd=Array.from({length:150},(_,i)=>({id:String(i),x:i,z:0,motion:'walk'}));
 assert.equal(nearbyHumans(crowd,{x:0,z:0}).length,72);assert.equal(nearbyHumans(crowd,{x:0,z:0},true).length,28);
 assert.equal(nearbyHumans([...crowd].reverse(),{x:0,z:0})[0].id,'0');
});
const fresh=()=>({progress:0,intel:false,extracting:false,extraction:0});
const frame=mode=>({mode,elapsed:10,wave:1,health:100,driving:false,lastDamage:-100,player:{x:0,z:0},center:{x:0,z:0},intelPoint:{x:15,z:0},extractionPoint:{x:30,z:0},enemies:[{x:20,z:0,hp:100}]});
function tick(state,f,seconds){for(let i=0;i<seconds*60;i++){f.elapsed+=1/60;state=advanceBattleObjective(state,f,1/60);}return state;}
test('sweep requires elimination then five uninterrupted safe seconds at extraction',()=>{
 let s=fresh(),f=frame('sweep');f.player={...f.extractionPoint};s=tick(s,f,6);assert.equal(s.status,'playing');
 f.enemies[0].hp=0;s=tick(s,f,3);assert.equal(s.status,'playing');f.player.x+=5;s=tick(s,f,1);assert.equal(s.extraction,0);
 f.player={...f.extractionPoint};s=tick(s,f,6);assert.equal(s.status,'won');
});
test('hold is contested by enemies and cannot be completed from inside a car',()=>{
 let s=fresh(),f=frame('hold');f.enemies[0].x=3;s=tick(s,f,46);assert.equal(s.progress,0);
 f.enemies[0].x=20;f.driving=true;s=tick(s,f,46);assert.equal(s.progress,0);
 f.driving=false;s=tick(s,f,46);assert.equal(s.status,'won');f.health=0;assert.equal(advanceBattleObjective(s,f,.1).status,'lost');
});
test('intel pickup resets on leaving and extraction can be blocked by the guard squad',()=>{
 let s=fresh(),f=frame('extraction');f.player={...f.intelPoint};s=tick(s,f,2);assert.equal(s.intel,false);
 f.player.x=0;s=tick(s,f,1);assert.equal(s.progress,0);f.player={...f.intelPoint};s=tick(s,f,4);assert.equal(s.intel,true);
 f.player={...f.extractionPoint};f.enemies[0].x=30;s=tick(s,f,6);assert.equal(s.status,'playing');
 f.enemies[0].hp=0;s=tick(s,f,6);assert.equal(s.status,'won');
});
test('waves require all three rounds and last stand cannot award a dead player',()=>{
 const f=frame('waves');f.enemies[0].hp=0;assert.equal(advanceBattleObjective(fresh(),f,.1).status,'upgrade');f.wave=3;assert.equal(advanceBattleObjective(fresh(),f,.1).extracting,true);
 f.mode='last-stand';assert.equal(advanceBattleObjective(fresh(),f,.1).status,'won');f.health=0;assert.equal(advanceBattleObjective(fresh(),f,.1).status,'lost');
});
const self={id:'bot',x:0,z:0,hp:100},target={id:'player',x:30,z:0,hp:100};
test('AI uses observations, expires memory, hears the shot location and never reads a hidden moving target',()=>{
 const b=brains.createBrain('bot');brains.thinkBot(b,self,[target],1,.1,()=>true,self);
 assert.equal(brains.thinkBot(b,self,[{...target,x:200}],2,.1,()=>false,self).goal.x,30);
 assert.deepEqual(brains.thinkBot(b,self,[],15,.1,()=>false,{x:3,z:4}).goal,{x:3,z:4});
 const heard=brains.thinkBot(b,self,[{...target,x:200}],16,.1,()=>false,self,{noise:{x:8,z:5,at:15.5}});assert.deepEqual(heard.goal,{x:8,z:5});assert.equal(heard.fire,false);
});
test('AI reload consumes finite reserve, heals once without shooting, and seeks real ammunition',()=>{
 const b=brains.createBrain('bot');b.ammo=0;b.reserve=5;let out;
 for(let i=0;i<30;i++)out=brains.thinkBot(b,self,[],i*.1,.1,()=>true,self);
 assert.equal(b.ammo,5);assert.equal(b.reserve,0);b.ammo=0;
 out=brains.thinkBot(b,self,[],4,.1,()=>true,self,{loot:[{id:'ammo',x:1,z:0,ammo:20}]});assert.equal(out.pickup,'ammo');assert.equal(out.fire,false);
 let healing=0;for(let i=0;i<40;i++){out=brains.thinkBot(b,{...self,hp:20},[],5+i*.1,.1,()=>true,self);healing+=out.heal;assert.equal(out.fire,false);}assert.equal(healing,40);assert.equal(b.medkit,false);
});
test('AI prioritizes zone safety and follows hold and intel mission objectives',()=>{
 const b=brains.createBrain('bot');
 let d=brains.thinkBot(b,{...self,x:95},[target],1,.1,()=>true,self,{mode:'last-stand',zoneRadius:50});assert.equal(d.state,'zone');assert.ok(Math.hypot(d.goal.x,d.goal.z)<25);
 d=brains.thinkBot(b,{...self,x:40},[],20,.1,()=>false,self,{mode:'hold'});assert.equal(d.state,'objective');assert.ok(Math.hypot(d.goal.x,d.goal.z)<10);
 d=brains.thinkBot(b,self,[],30,.1,()=>false,self,{mode:'extraction',intelCollected:true,extractionPoint:{x:60,z:0}});assert.ok(Math.hypot(d.goal.x-60,d.goal.z)<4);
});
function engineFixture(mode){
 const game=Object.assign(Object.create(GameEngine.prototype),{battleMode:mode,sectorCenter:{x:0,z:0},intelPoint:{x:10,z:0},extractionPoint:{x:-25,z:0},intel:false,health:100,player:{x:100,z:0},elapsed:0,battleObstacles:[],loot:[],wave:1,gunNoise:null,difficulty:'recruit',rng:()=>1,scene:new T.Scene(),combatEffects:{shot(){}}});
 const e={id:0,group:new T.Group(),flash:new T.Object3D(),legs:[new T.Object3D(),new T.Object3D()],hp:100,brain:brains.createBrain('0'),flashTime:0,hurt:0,deadTime:0,cooldown:0,repath:0,path:[],walk:0};e.group.position.set(35,0,0);game.enemies=[e];return {game,e};
}
test('actual engine AI reaches and contests the hold beacon without seeing the player',()=>{
 const {game,e}=engineFixture('hold');for(let i=0;i<300;i++){game.elapsed+=.05;game.updateEnemy(e,.05);}assert.ok(Math.hypot(e.group.position.x,e.group.position.z)<8);
});
test('actual engine AI switches from intel defense to extraction defense',()=>{
 const {game,e}=engineFixture('extraction');for(let i=0;i<200;i++){game.elapsed+=.05;game.updateEnemy(e,.05);}assert.ok(Math.hypot(e.group.position.x-10,e.group.position.z)<5);
 game.intel=true;for(let i=0;i<300;i++){game.elapsed+=.05;game.updateEnemy(e,.05);}assert.ok(Math.hypot(e.group.position.x+25,e.group.position.z)<5);
});
