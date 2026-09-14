import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {deployment,formationSlot,vehicleBlocks,coverPoint,tacticalGoal} from '../webapp/src/games/tiranastreets/shared/forceTactics.mjs';
import {createState,stepState,publicState} from '../webapp/src/games/tiranastreets/shared/engine.mjs';
import {IMPORTED_ASSETS} from '../webapp/src/games/tiranastreets/shared/importedAssets.mjs';
import {props,OBSTACLES} from '../webapp/src/games/blackwater/shared/layout.mjs';
test('wanted escalation preserves patrols and their personnel',()=>{
 const s=createState([{id:'p',name:'P'}],'free-roam');const ids=s.units.map(u=>u.id),crew=s.npcs.filter(n=>n.unit).map(n=>n.id);
 s.players.p.wanted=150;stepState(s);assert.deepEqual(s.units.map(u=>u.id),ids);
 s.players.p.wanted=450;stepState(s);assert.deepEqual(s.units.map(u=>u.id),ids);assert.deepEqual(s.npcs.filter(n=>n.unit).map(n=>n.id),crew);
 assert.ok(s.npcs.filter(n=>n.unit).every(n=>s.units.some(u=>u.id===n.unit)));
 const snap=publicState(s);assert.ok(snap.npcs.filter(n=>n.unit).every(n=>n.squadId&&Number.isInteger(n.seat)));
});
test('car cover blocks fire, side peeking clears it, formation slots differ',()=>{
 const car={id:'car',x:0,z:0,w:2,d:4.6,heading:0},target={x:0,z:-15};
 const behind=coverPoint(car,target,0);assert.ok(vehicleBlocks(target,behind,car));
 const peek=coverPoint(car,target,0,true);assert.equal(vehicleBlocks(target,peek,car),false);
 const a=formationSlot({x:0,z:10},target,1),b=formationSlot({x:0,z:10},target,2);assert.ok(Math.hypot(a.x-b.x,a.z-b.z)>1.5);
 const npc={id:'n',...behind,kind:'police',health:100};const covered=tacticalGoal(npc,target,[npc],[car],3,()=>true);assert.equal(covered.anim,'cover');
 assert.equal(tacticalGoal(npc,target,[npc],[car],0,()=>true).anim,'run');
 assert.equal(vehicleBlocks({x:-5,z:0},{x:5,z:0},{...car,forceVehicle:'shqiponja_bike'}),false);
});
test('Tirana uses its road collection and starting GTI without Racing Royal kart spawns or collision props',()=>{
 const s=createState([{id:'p',name:'P'}],'free-roam');
 assert.equal(s.cars.filter(c=>c.collectionVehicle).length,11);
 assert.equal(s.cars.some(c=>c.racingAsset),false);
 assert.equal(props.some(p=>p.racingAsset),false);
 assert.equal(OBSTACLES.some(p=>p.racingAsset),false);
});
test('all 26 originals remain packaged and hashed; ground weapons are no longer decorative obstacles',()=>{
 assert.equal(IMPORTED_ASSETS.length,26);assert.equal(IMPORTED_ASSETS.filter(a=>a.kind==='weapon').length,18);
 for(const item of IMPORTED_ASSETS){
  const b=readFileSync(new URL('../webapp/public'+item.localUrl,import.meta.url));assert.equal(createHash('sha256').update(b).digest('hex'),item.sha256,item.name);
  const json=item.localUrl.endsWith('.gltf')?JSON.parse(b):JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));
  for(const image of json.images||[]){assert.ok(image.bufferView!==undefined||image.uri?.startsWith('data:'),`${item.name}: texture must be bundled`);
   if(image.uri?.startsWith('data:')){const bytes=Buffer.from(image.uri.split(',')[1],'base64');assert.ok(!bytes.subarray(0,50).toString().includes('git-lfs'),`${item.name}: no LFS pointer masquerading as a texture`);assert.ok(bytes[0]===137||bytes[0]===255||bytes.subarray(0,4).toString()==='RIFF',`${item.name}: valid image signature`);}}

  for(const buffer of json.buffers||[])assert.ok(!buffer.uri||buffer.uri.startsWith('data:'),`${item.name}: buffer must be bundled`);
  if(item.kind==='weapon'){
   assert.equal(props.some(p=>p.assetId===item.id),false,item.id);
   assert.equal(OBSTACLES.some(p=>p.assetId===item.id),false,item.id);
  }
 }
});
