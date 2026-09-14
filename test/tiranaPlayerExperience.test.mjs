import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from '../webapp/node_modules/typescript/lib/typescript.js';
import * as T from '../webapp/node_modules/three/build/three.module.js';
import {GLTFLoader} from '../webapp/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import {mergeGeometries} from '../webapp/node_modules/three/examples/jsm/utils/BufferGeometryUtils.js';
import {UPLOADED_WEAPONS} from '../webapp/src/games/tiranastreets/shared/uploadedWeapons.mjs';
import {IMPORTED_BY_ID} from '../webapp/src/games/tiranastreets/shared/importedAssets.mjs';
import {WEAPONS,WEAPON_BY_ID,STARTER_WEAPON,ensureStarterWeapons} from '../webapp/src/games/tiranastreets/shared/weapons.mjs';
import {MISSIONS,createState} from '../webapp/src/games/tiranastreets/shared/engine.mjs';
import {collectWeapon,dropWeapon} from '../webapp/src/games/tiranastreets/shared/cityPopulation.mjs';
import {createCampaign} from '../webapp/src/games/tiranastreets/street-career/campaignCore.mjs';
import {createBody} from '../webapp/src/games/tiranastreets/street-career/playerCore.mjs';
import * as humanoidRig from '../webapp/src/games/tiranastreets/street-career/humanoidRig.mjs';
import * as poses from '../webapp/src/games/tiranastreets/street-career/weaponPose.mjs';
import * as spatial from '../webapp/src/games/tiranastreets/street-career/spatialCore.mjs';
import * as vehicles from '../webapp/src/games/tiranastreets/street-career/vehicleCore.mjs';
import * as driver from '../webapp/src/games/tiranastreets/shared/driverView.mjs';
import * as terrain from '../webapp/src/games/blackwater/shared/terrain.mjs';
import * as physics from '../webapp/src/games/blackwater/shared/physics.mjs';
import * as battle from '../webapp/src/games/blackwater/shared/battlefield.mjs';
import {props} from '../webapp/src/games/blackwater/shared/layout.mjs';
import {groundHeight} from '../webapp/src/games/tirana-east/terrainCore.mjs';
import * as weaponCalibrations from '../webapp/src/games/tiranastreets/shared/weaponCalibration.mjs';
const campaign=createCampaign(MISSIONS,WEAPONS,STARTER_WEAPON);
function load(path,deps={},globals={}){
 const module={exports:{}};
 const output=ts.transpileModule(readFileSync(new URL('../'+path,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(output,{module,exports:module.exports,require:key=>deps[key]||{},console,setTimeout,clearTimeout,...globals});return module.exports;
}
const pockets=load('webapp/src/games/tiranastreets/PocketWeapons.ts',{'three':T});
const calibration=load('webapp/src/games/tiranastreets/weaponCalibration.ts',{'three':T,'./shared/weaponCalibration.mjs':weaponCalibrations});
const {GameEngine}=load('webapp/src/games/blackwater/engine.ts',{'three':T,'./core':physics,'./shared/terrain.mjs':terrain});
const {BattlefieldVehicle}=load('webapp/src/games/blackwater/BattlefieldVehicle.ts',{'three':T,'./core':physics,'./shared/terrain.mjs':terrain,'../tiranastreets/shared/driverView.mjs':driver});
const {FirstPersonBody,maskHead}=load('webapp/src/games/tiranastreets/street-career/FirstPersonBody.ts',{'../PocketWeapons':pockets,'../weaponCalibration':calibration,'three':T,'./humanoidRig.mjs':humanoidRig,'./weaponPose.mjs':poses,'./spatialCore.mjs':spatial,'./vehicleCore.mjs':vehicles,'../shared/weapons.mjs':{WEAPON_BY_ID},'../../tirana-east/terrainCore.mjs':{groundHeight}});
const visuals=load('webapp/src/games/tiranastreets/livingVisuals.ts',{'three':T,'./shared/importedAssets.mjs':{IMPORTED_BY_ID},'./shared/uploadedWeapons.mjs':{UPLOADED_WEAPONS}});

test('every playable weapon supplies its procedural prop or a valid local GLB within the held-model budget',async()=>{
 const seen=new Set(),procedural=new Set(),loader=new GLTFLoader();
 loader.register(()=>({name:'HEADLESS_TEXTURES',loadTexture:async()=>new T.Texture()}));
 for(const weapon of WEAPONS.filter(w=>w.id!=='fpsGunAttack')){
  if(pockets.isPocketWeapon(weapon.id)){
   procedural.add(weapon.id);const prop=pockets.pocketWeapon(weapon.id);assert.ok(prop instanceof T.Group,weapon.id);
   if(weapon.id==='punch')assert.equal(prop.children.length,0,'unarmed punching uses the player body without a downloaded prop');
   else assert.ok(!new T.Box3().setFromObject(prop).isEmpty(),weapon.id+' must have visible procedural geometry');
   prop.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});
   continue;
  }
  const url=visuals.weaponModelUrl(weapon.model);if(seen.has(url))continue;seen.add(url);
  const bytes=readFileSync(new URL('../webapp/public'+url,import.meta.url));
  assert.ok(bytes.length<5*1024*1024,weapon.id+' exceeds mobile weapon budget');
  const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  assert.ok(!new T.Box3().setFromObject(gltf.scene).isEmpty(),weapon.id);
 }
 assert.deepEqual(procedural,new Set(['punch','egg','tomato']));
 assert.ok(seen.size>10,'all distinct downloaded weapon models remain covered');
 assert.equal(visuals.weaponModelUrl(WEAPON_BY_ID.get(STARTER_WEAPON).model),'/assets/tirana-streets/living/ak47.glb');
});
test('starter readiness waits for the actual shared AK load and deduplicates requests',async()=>{
 const resources=load('webapp/src/games/tiranastreets/weaponModelResources.ts',{'three':T,'three/examples/jsm/utils/BufferGeometryUtils.js':{mergeGeometries}});
 class HeadlessLoader extends GLTFLoader {constructor(){super();this.register(()=>({name:'HEADLESS_TEXTURES',loadTexture:async()=>new T.Texture()}));}}
 let release,requests=0;const gate=new Promise(resolve=>{release=resolve;});
 const {FirstPersonBody:Rig}=load('webapp/src/games/tiranastreets/street-career/FirstPersonBody.ts',{'../PocketWeapons':pockets,'../weaponCalibration':calibration,'three':T,'./humanoidRig.mjs':humanoidRig,'./weaponPose.mjs':poses,'../shared/weapons.mjs':{WEAPON_BY_ID},'../livingVisuals':visuals,'../weaponModelResources':resources,'three/examples/jsm/loaders/GLTFLoader.js':{GLTFLoader:HeadlessLoader}},
  {URL,AbortController,window:{location:{href:'https://example.test/'}},fetch:async url=>{requests++;await gate;const bytes=readFileSync(new URL('../webapp/public'+url.pathname,import.meta.url));return {ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};}});
 const rig=new Rig(new T.Scene());let ready=false;
 const first=rig.prepare(STARTER_WEAPON),second=rig.prepare(STARTER_WEAPON).then(()=>{ready=true;});
 await Promise.resolve();assert.equal(ready,false);assert.equal(requests,1);release();await Promise.all([first,second]);
 assert.equal(rig.errors.length,0);assert.ok(rig.cloneWeapon(STARTER_WEAPON));assert.equal(requests,1);rig.dispose();
});

test('fresh careers equip a loaded AK-47 and preserve saved weapon choice',()=>{
 const profile=campaign.fresh(),w=WEAPON_BY_ID.get(STARTER_WEAPON);
 assert.equal(profile.loadout.weapon,'ak47VolleyAttack');assert.deepEqual(profile.loadout.inventory[STARTER_WEAPON],{ammo:w.magazine,reserve:w.magazine*3});
 profile.loadout.inventory.uziSprayAttack={ammo:4,reserve:21};profile.loadout.weapon='uziSprayAttack';
 assert.equal(campaign.normalize(JSON.parse(JSON.stringify(profile))).loadout.weapon,'uziSprayAttack');
 const state=createState([{id:'local',name:'You'}],'free-roam','solo');assert.equal(state.players.local.inventory[STARTER_WEAPON].ammo,w.magazine);
 assert.equal(state.pickups.length,300);assert.ok(state.pickups.every(item=>item.weapon!=='fpsGunAttack'&&WEAPON_BY_ID.has(item.weapon)));
 assert.equal(props.some(p=>WEAPON_BY_ID.has(p.assetId)),false,'visible ground guns must come from collectible loot');
});
test('retired FPS gun migrates once without destroying progress or other weapons',()=>{
 const p={weapon:'fpsGunAttack',inventory:{fpsGunAttack:{ammo:10,reserve:20},uziSprayAttack:{ammo:3,reserve:9}}};
 ensureStarterWeapons(p);assert.equal(p.weapon,STARTER_WEAPON);assert.equal(p.inventory.fpsGunAttack,undefined);
 const saved=JSON.stringify(p);ensureStarterWeapons(p);assert.equal(JSON.stringify(p),saved);assert.deepEqual(p.inventory.uziSprayAttack,{ammo:3,reserve:9});
});
test('every ground weapon can equip at full reserve, exactly once, cancelling reload',()=>{
 for(const w of WEAPONS.filter(w=>w.id!=='fpsGunAttack')){
  const p={id:'local',health:100,x:0,z:0,weapon:STARTER_WEAPON,reloadAt:9,nextShot:7,inventory:{[w.id]:{ammo:0,reserve:w.magazine*8}}};
  const state={elapsed:0,pickups:[{id:'loot',weapon:w.id,x:1,z:0,ammo:w.magazine}]};
  assert.equal(collectWeapon(state,p,'loot'),true,w.id);assert.equal(p.weapon,w.id);assert.equal(p.reloadAt,0);assert.equal(p.nextShot,0);
  assert.equal(p.inventory[w.id].reserve,w.magazine*8);assert.equal(collectWeapon(state,p,'loot'),false);
 }
});
test('invalid, expired, far and vehicle pickups cannot be consumed',()=>{
 const p={id:'local',health:100,x:0,z:0,inventory:{}};
 const state={elapsed:10,pickups:[{id:'loot',weapon:STARTER_WEAPON,x:1,z:0,ammo:30,expiresAt:9}]};
 assert.equal(collectWeapon(state,p,'loot'),false);state.pickups[0].expiresAt=20;p.carId='car';assert.equal(collectWeapon(state,p,'loot'),false);
 p.carId=null;p.x=10;assert.equal(collectWeapon(state,p,'loot'),false);assert.equal(state.pickups[0].collected,undefined);
});
test('NPC drops sit on the terrain or the NPC floor rather than underneath elevated streets',()=>{
 const state={elapsed:0,pickups:[]};dropWeapon(state,{id:'npc',kind:'gang',weapon:STARTER_WEAPON,x:0,z:0,y:120});assert.equal(state.pickups[0].y,120.15);
});
test('career cannot replace an active job and lose its checkpoint',()=>{
 const profile=campaign.fresh();profile.completed=['first-shift'];const active=campaign.begin(profile,'lana-run');
 const before=JSON.stringify(active);assert.equal(campaign.begin(active,'express'),null);assert.equal(JSON.stringify(active),before);
 assert.ok(campaign.begin(campaign.abandon(active),'express'));
});
test('three operations unlock in order and retain historical completed districts',()=>{
 assert.equal(battle.OPERATIONS.length,3);assert.deepEqual(battle.normalizeOperations({completed:['dajti-survival']}),{completed:[]});let p={completed:[]};
 assert.equal(battle.operationUnlocked(p,battle.OPERATIONS[2].id),false);
 for(const op of battle.OPERATIONS){assert.ok(battle.operationUnlocked(p,op.id));p=battle.finishOperation(p,op.id,true);}
 const old=battle.normalizeOperations({completed:['square-sweep','bazaar-intel','lana-hold','blloku-sweep']});
 assert.ok(old.completed.includes('blloku-sweep'));assert.ok(battle.operationUnlocked(old,'dajti-survival'));
 assert.deepEqual(battle.finishOperation(p,p.completed[0],true),p);
});
test('battlefield pickup keeps per-weapon ammo, cancels reload, and never picks up while driving',()=>{
 const item={weapon:'uzi',ammo:56},second={weapon:'ak47',ammo:60};let target=item;
 const g=Object.assign(Object.create(GameEngine.prototype),{phase:'playing',weapon:'ak47',ammo:7,reserve:51,inventory:{},reloadTimer:1,pendingReload:true,cooldown:.2,loot:[item,second],nearestLoot:()=>target,notify(){},emit(){},disposeLoot(){}});
 assert.equal(g.pickupWeapon(),true);assert.equal(g.weapon,'uzi');assert.equal(g.ammo,28);assert.equal(g.reserve,28);assert.equal(g.reloadTimer,0);assert.equal(g.pendingReload,false);
 target=second;assert.equal(g.pickupWeapon(),true);assert.equal(g.ammo,7);assert.equal(g.reserve,111);
 delete g.nearestLoot;g.vehicle={driving:true};g.health=100;assert.equal(g.pickupWeapon(),false);
});
test('chase-camera collision ray and actual camera position are identical in portrait',()=>{
 const vehicle=Object.assign(Object.create(BattlefieldVehicle.prototype),{car:{x:0,z:0,heading:.7,model:'sedan'},view:'chase'});
 const camera=new T.PerspectiveCamera(45,390/844,.01,2000);vehicle.camera(camera,[]);
 const origin=new T.Vector3(0,terrain.battleGround(0,0)+1.1,0),direction=new T.Vector3(Math.sin(.7),.3,Math.cos(.7)).normalize();
 assert.ok(camera.position.distanceTo(origin.clone().addScaledVector(direction,8))<1e-8);
 assert.equal(camera.near,.1);assert.equal(camera.fov,70);
});
test('driver hands and eye share the same support plane on hills',()=>{
 const car={x:100,z:100,heading:1.2,model:'sedan'},point=vehicles.vehicleAnchors(car).wheel;
 assert.deepEqual(vehicles.carPoint(car,point),driver.driverPoint(car,point));
});
test('on-foot camera is eye-level and follows screen directions, including crouch',()=>{
 const {StreetRenderer}=load('webapp/src/games/tiranastreets/street-career/StreetRenderer.ts',{'three':T,'../renderer':{CityRenderer:class{}},'./spatialCore.mjs':spatial,'../../tirana-east/terrainCore.mjs':{groundHeight}});
 const body={...createBody(),y:10,eye:1.68,aim:false,recoil:0},p={x:4,z:8};
 const r=Object.assign(Object.create(StreetRenderer.prototype),{simulation:{body,flight:{}},camera:new T.PerspectiveCamera(),yaw:0,pitch:.3,settings:{fov:74,shake:0}});
 r.presentFirstPerson({players:{local:p},cars:[]},'local',1/60);
 assert.ok(r.camera.position.distanceTo(new T.Vector3(4,11.68,8))<1e-8);assert.ok(r.camera.getWorldDirection(new T.Vector3()).y>0);
 body.eye=.86;body.crouched=true;r.presentFirstPerson({players:{local:p},cars:[]},'local',1/60);assert.equal(r.camera.position.y,10.86);
});
test('CC0 operator has weapon animations and a reversible first-person head mask',async()=>{
 const bytes=readFileSync(new URL('../webapp/public/assets/tirana-streets/living/operator.glb',import.meta.url));
 assert.ok(bytes.length<1.2*1024*1024);
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const names=new Set(gltf.animations.map(a=>a.name));for(const name of ['Idle','Walk','Run','Idle_Gun','Idle_Gun_Pointing','Run_Shoot'])assert.ok(names.has(name));
 const meshes=[];gltf.scene.traverse(o=>{if(o instanceof T.SkinnedMesh)meshes.push(o);});assert.ok(meshes.length>=4);
 const originals=meshes.map(m=>m.geometry);const undo=maskHead(gltf.scene);assert.ok(meshes.some((m,i)=>m.geometry.index.count<originals[i].index.count));
 undo();meshes.forEach((m,i)=>assert.equal(m.geometry,originals[i]));assert.equal(gltf.scene.getObjectByName('full-body-shadow-only'),undefined);
});
