import {reserveCapacity} from '../webapp/src/games/tiranastreets/shared/ammunition.mjs';
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

function load(path,deps={},globals={}){
 const module={exports:{}};
 const output=ts.transpileModule(readFileSync(new URL('../'+path,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(output,{module,exports:module.exports,require:key=>deps[key]||{},console,setTimeout,clearTimeout,...globals});return module.exports;
}
const pockets=load('webapp/src/games/tiranastreets/PocketWeapons.ts',{'three':T});
const calibration=load('webapp/src/games/tiranastreets/weaponCalibration.ts',{'three':T,'./shared/weaponCalibration.mjs':weaponCalibrations});

const visuals=load('webapp/src/games/tiranastreets/livingVisuals.ts',{'three':T,'./shared/importedAssets.mjs':{IMPORTED_BY_ID},'./shared/uploadedWeapons.mjs':{UPLOADED_WEAPONS}});

test('every playable weapon supplies its procedural prop or a valid local GLB within the held-model budget',async()=>{
 const seen=new Set(),procedural=new Set(),loader=new GLTFLoader();
 loader.register(()=>({name:'HEADLESS_TEXTURES',loadTexture:async()=>new T.Texture()}));
 for(const weapon of WEAPONS.filter(w=>w.id!=='fpsGunAttack'&&w.category!=='equipment')){
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

test('retired FPS gun migrates once without destroying progress or other weapons',()=>{
 const p={weapon:'fpsGunAttack',inventory:{fpsGunAttack:{ammo:10,reserve:20},uziSprayAttack:{ammo:3,reserve:9}}};
 ensureStarterWeapons(p);assert.equal(p.weapon,STARTER_WEAPON);assert.equal(p.inventory.fpsGunAttack,undefined);
 const saved=JSON.stringify(p);ensureStarterWeapons(p);assert.equal(JSON.stringify(p),saved);assert.deepEqual(p.inventory.uziSprayAttack,{ammo:3,reserve:9});
});
test('every ground weapon can equip at full reserve, exactly once, cancelling reload',()=>{
 for(const w of WEAPONS.filter(w=>w.id!=='fpsGunAttack'&&w.category!=='equipment')){
  const p={id:'local',health:100,x:0,z:0,weapon:STARTER_WEAPON,reloadAt:9,nextShot:7,inventory:{[w.id]:{ammo:0,reserve:reserveCapacity(w)}}};
  const state={elapsed:0,pickups:[{id:'loot',weapon:w.id,x:1,z:0,ammo:w.magazine}]};
  assert.equal(collectWeapon(state,p,'loot'),true,w.id);assert.equal(p.weapon,w.id);assert.equal(p.reloadAt,0);assert.equal(p.nextShot,0);
  assert.equal(p.inventory[w.id].reserve,reserveCapacity(w));assert.equal(collectWeapon(state,p,'loot'),false);
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

test('three operations unlock in order and retain historical completed districts',()=>{
 assert.equal(battle.OPERATIONS.length,3);assert.deepEqual(battle.normalizeOperations({completed:['dajti-survival']}),{completed:[]});let p={completed:[]};
 assert.equal(battle.operationUnlocked(p,battle.OPERATIONS[2].id),false);
 for(const op of battle.OPERATIONS){assert.ok(battle.operationUnlocked(p,op.id));p=battle.finishOperation(p,op.id,true);}
 const old=battle.normalizeOperations({completed:['square-sweep','bazaar-intel','lana-hold','blloku-sweep']});
 assert.ok(old.completed.includes('blloku-sweep'));assert.ok(battle.operationUnlocked(old,'dajti-survival'));
 assert.deepEqual(battle.finishOperation(p,p.completed[0],true),p);
});

test('driver hands and eye share the same support plane on hills',()=>{
 const car={x:100,z:100,heading:1.2,model:'sedan'},point=vehicles.vehicleAnchors(car).wheel;
 assert.deepEqual(vehicles.carPoint(car,point),driver.driverPoint(car,point));
});
