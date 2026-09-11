import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {deployment,formationSlot,vehicleBlocks,coverPoint,tacticalGoal} from '../webapp/src/games/tiranastreets/shared/forceTactics.mjs';
import {createState,stepState,publicState} from '../webapp/src/games/tiranastreets/shared/engine.mjs';
import {KARTS} from '../webapp/src/games/kartroyale/vehicleCatalog.mjs';
import {IMPORTED_ASSETS} from '../webapp/src/games/tiranastreets/shared/importedAssets.mjs';
import {props,OBSTACLES} from '../webapp/src/games/blackwater/shared/layout.mjs';
test('Shqiponja deploys two double-crewed motorcycles and one escort together',()=>{
 const plan=deployment(2);assert.deepEqual(plan.vehicles,['shqiponja_bike','shqiponja_bike','patrol_sedan']);assert.deepEqual(plan.seats,[2,2,2]);
 const s=createState([{id:'p',name:'P'}],'free-roam');s.players.p.wanted=150;s.players.p.lastCrime=0;s.nextDispatch=0;stepState(s);
 assert.equal(s.units.length,3);assert.equal(new Set(s.units.map(u=>u.squadId)).size,1);
 for(const unit of s.units)assert.equal(s.npcs.filter(n=>n.unit===unit.id).length,2);
 const snap=publicState(s);assert.equal(snap.npcs.filter(n=>n.unit).length,6);assert.ok(snap.npcs.filter(n=>n.unit).every(n=>n.squadId&&Number.isInteger(n.seat)));
});
test('FNSH, RENEA and army grow from 10 to 20 without orphaning personnel',()=>{
 for(const stars of [3,4,5]){const low=deployment(stars,0),high=deployment(stars,200);assert.equal(low.seats.reduce((a,b)=>a+b),10);assert.equal(high.seats.reduce((a,b)=>a+b),20);}
 const s=createState([{id:'p',name:'P'}],'free-roam');s.players.p.wanted=150;s.nextDispatch=0;stepState(s);const old=s.units[0].squadId;
 s.players.p.wanted=450;s.nextDispatch=0;stepState(s);
 assert.ok(s.units.every(u=>u.squadId!==old));assert.ok(s.npcs.filter(n=>n.unit).every(n=>s.units.some(u=>u.id===n.unit)));
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
test('all 11 Racing Royal classes are enterable city cars and parked Battlefield assets',()=>{
 const s=createState([{id:'p',name:'P'}],'free-roam');assert.equal(KARTS.length,11);
 for(const kart of KARTS){assert.ok(s.cars.some(c=>c.racingAsset===kart.id&&c.driver===null));assert.ok(props.some(p=>p.racingAsset===kart.id));}
});
test('all 26 original models are packaged, hashed and represented in the game',()=>{
 assert.equal(IMPORTED_ASSETS.length,26);assert.equal(IMPORTED_ASSETS.filter(a=>a.kind==='weapon').length,18);
 for(const item of IMPORTED_ASSETS){
  const b=readFileSync(new URL('../webapp/public'+item.localUrl,import.meta.url));assert.equal(createHash('sha256').update(b).digest('hex'),item.sha256,item.name);
  const json=item.localUrl.endsWith('.gltf')?JSON.parse(b):JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));
  for(const image of json.images||[]){assert.ok(image.bufferView!==undefined||image.uri?.startsWith('data:'),`${item.name}: texture must be bundled`);
   if(image.uri?.startsWith('data:')){const bytes=Buffer.from(image.uri.split(',')[1],'base64');assert.ok(!bytes.subarray(0,50).toString().includes('git-lfs'),`${item.name}: no LFS pointer masquerading as a texture`);assert.ok(bytes[0]===137||bytes[0]===255||bytes.subarray(0,4).toString()==='RIFF',`${item.name}: valid image signature`);}}

  for(const buffer of json.buffers||[])assert.ok(!buffer.uri||buffer.uri.startsWith('data:'),`${item.name}: buffer must be bundled`);
  const placement=props.find(p=>p.assetId===item.id||p.racingAsset===item.id);assert.ok(placement,item.id);assert.ok(OBSTACLES.includes(placement));
 }
});
test('a real response follows its route and dismounts as a squad instead of repathing forever',()=>{
 const s=createState([{id:'p',name:'P'}],'free-roam');s.players.p.wanted=250;s.players.p.lastCrime=1e5;s.nextDispatch=0;
 for(let i=0;i<7200;i++)stepState(s);
 const officers=s.npcs.filter(n=>n.unit);assert.ok(officers.length>=10);assert.ok(officers.every(n=>n.deployed));
 assert.ok(officers.some(n=>['cover','aim','run','walk'].includes(n.anim)));
});
