import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as T from '../webapp/node_modules/three/build/three.module.js';
import {GLTFLoader} from '../webapp/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import {UPLOADED_WEAPONS,forceWeaponFor} from '../webapp/src/games/tiranastreets/shared/uploadedWeapons.mjs';
import {WEAPON_BY_ID,ensureStarterWeapons} from '../webapp/src/games/tiranastreets/shared/weapons.mjs';
import {WEAPON_STORE_BY_ID} from '../webapp/src/games/tiranastreets/weaponStoreCatalog.mjs';
import {WEAPONS as FPS_WEAPONS} from '../webapp/src/games/blackwater/shared/physics.mjs';
import {DEFAULT_LOADOUT,validStartingLoadout,selectStartingLoadout,selectedStartingLoadout,applyStartingLoadout} from '../webapp/src/games/tiranastreets/startingLoadout.mjs';
import {playerAssetFor,selectPlayerAsset,selectedPlayerUrl} from '../webapp/src/games/tiranastreets/playerCatalog.mjs';

const readAsset=url=>readFileSync(new URL('../webapp/public'+url,import.meta.url));
const manifest=JSON.parse(readAsset('/assets/tirana-streets/weapons/manifest.json'));
const originalSelf=globalThis.self,originalBitmap=globalThis.createImageBitmap;
globalThis.self=globalThis;
// Decode actual geometry/skins while keeping this non-browser test GPU-free.
globalThis.createImageBitmap=async()=>({width:1024,height:1024,close(){}});
test.after(()=>{globalThis.self=originalSelf;globalThis.createImageBitmap=originalBitmap;});

test('five shipped GLBs resolve through store and both combat catalogs with verified embedded assets',async()=>{
 for(const w of UPLOADED_WEAPONS){
  const item=WEAPON_STORE_BY_ID.get(`tirana-${w.id}`),bytes=readAsset(item.modelUrl);
  assert.equal(item.modelUrl,w.modelUrl);assert.equal(WEAPON_BY_ID.get(w.id).model,w.id);
  assert.equal(FPS_WEAPONS[w.battlefieldId].mag,w.magazine);
  assert.ok(bytes.length<5*1024*1024);assert.ok(readAsset(w.thumbnail).length>100);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.weapons.find(m=>m.id===w.id).sha256);
  const doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
  assert.ok(doc.asset.extras.author);assert.ok(doc.asset.extras.license);
  assert.ok(doc.images.every(i=>i.bufferView!==undefined&&!i.uri));
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'');
  const size=new T.Box3().setFromObject(gltf.scene).getSize(new T.Vector3());
  assert.ok(size.z>size.x&&size.z>size.y,`${w.id}: barrel direction is the long axis`);
  assert.ok(size.z>.9&&size.z<1.1,`${w.id}: normalized without display floor`);
  gltf.scene.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of [].concat(o.material))m.dispose();}});
 }
});
test('selection rejects duplicates, unknown weapons and any count other than three',()=>{
 for(const ids of [[],DEFAULT_LOADOUT.slice(0,2),[...DEFAULT_LOADOUT,'ar15Attack'],['makarovAttack','makarovAttack','ar15Attack'],['invented','ar15Attack','vityazAttack']]){
  assert.equal(validStartingLoadout(ids),false);assert.throws(()=>selectStartingLoadout(ids));
 }
 const ids=[...DEFAULT_LOADOUT];selectStartingLoadout(ids);ids[0]='ar15Attack';assert.deepEqual(selectedStartingLoadout(),DEFAULT_LOADOUT);
});
test('new career begins with exactly three selected guns plus knife; save migration cannot re-add a fourth',()=>{
 const p={inventory:{},weapon:'ak47VolleyAttack'};ensureStarterWeapons(p);applyStartingLoadout(p,DEFAULT_LOADOUT,true);
 ensureStarterWeapons(p);ensureStarterWeapons(p);
 assert.deepEqual(Object.keys(p.inventory).filter(id=>id!=='combatKnife').sort(),[...DEFAULT_LOADOUT].sort());
 assert.equal(p.weapon,DEFAULT_LOADOUT[0]);
});
test('choosing starting equipment preserves purchased weapons and spent ammunition',()=>{
 const p={inventory:{ar15Attack:{ammo:2,reserve:7},makarovAttack:{ammo:0,reserve:0}},weapon:'ar15Attack'};
 const before=p.inventory.ar15Attack;applyStartingLoadout(p,['makarovAttack','ar15Attack','dragunovAttack']);
 assert.equal(p.inventory.ar15Attack,before);assert.deepEqual(p.inventory.makarovAttack,{ammo:0,reserve:0});
 applyStartingLoadout(p,['makarovAttack','ar15Attack','dragunovAttack']);assert.equal(p.inventory.dragunovAttack.reserve,30);
});
test('police and army role equipment uses all five uploaded weapons deterministically',()=>{
 assert.equal(forceWeaponFor('patrol_officer',0),'makarovAttack');
 assert.equal(forceWeaponFor('shqiponja_officer',0),'vityazAttack');
 assert.deepEqual([0,1,2].map(i=>forceWeaponFor('army_soldier',i)),['adaptiveCombatRifleAttack','ar15Attack','dragunovAttack']);
 for(const role of ['patrol_officer','traffic_officer','fnsh_officer','renea_officer','army_soldier'])for(let i=0;i<9;i++)assert.ok(WEAPON_BY_ID.has(forceWeaponFor(role,i)));
});
test('both selectable human bodies are real skinned models with locomotion and usable hands',async()=>{
 for(const id of ['human','operator']){
  const asset=playerAssetFor(id,{players:{}});assert.ok(asset);selectPlayerAsset(asset);assert.equal(selectedPlayerUrl(),asset.url);
  const bytes=readAsset(asset.url),gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'');
  assert.ok(gltf.animations.some(a=>a.name==='Idle'));assert.ok(gltf.animations.some(a=>a.name==='Walk'));
  let skinned=false,hand=false;gltf.scene.traverse(o=>{skinned ||= o.isSkinnedMesh;hand ||= /RightHand|WristR/i.test(o.name);});
  assert.ok(skinned);assert.ok(hand);
 }
 assert.throws(()=>selectPlayerAsset({id:'human',url:'https://example.com/untrusted.glb'}));selectPlayerAsset(null);
});
