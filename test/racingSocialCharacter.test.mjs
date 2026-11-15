import test from 'node:test';
import assert from 'node:assert/strict';
import {APPEARANCES,loadExploreCharacter,saveExploreCharacter} from '../webapp/src/games/tirana-social/socialCore.mjs';
import {chooseStreetHuman} from '../webapp/src/games/tiranastreets/street-career/sharedCastCore.mjs';
import {driveVehicle} from '../webapp/src/games/tiranastreets/shared/vehicleDynamics.mjs';
const storage=()=>{const values=new Map();return {getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};};
test('new social players start as Turi and a valid saved selection survives reopening',()=>{
  const store=storage();assert.equal(loadExploreCharacter(store),'turi');assert.equal(APPEARANCES[0],'turi');
  for(const id of APPEARANCES){saveExploreCharacter(store,id);assert.equal(loadExploreCharacter(store),id);}
  saveExploreCharacter(store,'unknown');assert.equal(loadExploreCharacter(store),APPEARANCES.at(-1));
  assert.equal(loadExploreCharacter({getItem(){throw Error('private');}}),'turi');
});
test('each explicit social character overrides randomized ambient citizens',()=>{
  const cast=[...APPEARANCES.map(id=>({id,roles:['civilian'],url:`/${id}.glb`})),...Array.from({length:8},(_,i)=>({id:`tirana-citizen-${i}`,roles:['civilian'],url:'/citizen.glb'}))];
  for(const characterId of APPEARANCES)assert.equal(chooseStreetHuman({id:'explorer-1',kind:'civilian',characterId},cast).id,characterId);
  assert.match(chooseStreetHuman({id:'ambient-1',kind:'civilian'},cast).id,/tirana-citizen-/);
});
test('social driving is modestly slower while brakes and reverse remain available',()=>{
  const car=()=>({id:'car',model:'sedan',heading:0,x:0,z:0,speed:0});
  const regular=car(),social=car();
  for(let i=0;i<1200;i++){driveVehicle(regular,{x:0,y:1},1/60);driveVehicle(social,{x:0,y:1},1/60,()=>{},.94);}
  assert.ok(social.speed<regular.speed*.96);assert.ok(social.speed>regular.speed*.9);
  for(let i=0;i<300;i++)driveVehicle(social,{x:0,y:0,brake:true},1/60,()=>{},.94);
  assert.ok(Math.abs(social.speed)<.01);
  for(let i=0;i<120;i++)driveVehicle(social,{x:0,y:-1},1/60,()=>{},.94);
  assert.ok(social.speed<0);
});
