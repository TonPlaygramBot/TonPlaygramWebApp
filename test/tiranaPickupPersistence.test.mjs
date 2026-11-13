import test from 'node:test';
import assert from 'node:assert/strict';
import {createCampaign,CHAPTER_IDS} from '../webapp/src/games/tiranastreets/street-career/campaignCore.mjs';
import {capturePickupState,restorePickupState,rollbackPickupState,restoreCheckpoint} from '../webapp/src/games/tiranastreets/street-career/checkpointCore.mjs';
const api=createCampaign(CHAPTER_IDS.map(id=>({id,reward:100})),[{id:'starter',magazine:30}],'starter');
const make=()=>({player:{id:'local',health:100},claimed:new Set(),loot:[
  {id:'city-weapon-0',source:'city',ammo:30},
  {id:'city-ammo-0',source:'cache',ammo:90,initialAmmo:90},
  {id:'sky-cafe-sniper',source:'authored-cafe-restroom',ammo:10},
  {id:'drop:gang-0:1',source:'npc',ammo:30}
]});
test('mission-start inventory and static pickup states are deep snapshots',()=>{
  const before=api.fresh();before.worldPickups={claimed:['city-weapon-0'],pickupAmmo:{'city-ammo-0':70}};
  const active=api.begin(before,'first-shift');
  before.worldPickups.claimed.push('sky-cafe-sniper');before.worldPickups.pickupAmmo['city-ammo-0']=10;
  assert.deepEqual(active.active.worldPickups,{claimed:['city-weapon-0'],pickupAmmo:{'city-ammo-0':70}});
  active.worldPickups.pickupAmmo['city-ammo-0']=0;active.loadout.inventory.starter.reserve=150;
  const abandoned=api.abandon(active);
  assert.equal(abandoned.loadout.inventory.starter.reserve,90);
  assert.deepEqual(abandoned.worldPickups,{claimed:['city-weapon-0'],pickupAmmo:{'city-ammo-0':70}});
});
test('abandon rolls back city ammunition exactly with its inventory without respawning combat drops',()=>{
  const sim=make();sim.claimed=new Set(['city-weapon-0','city-ammo-0','sky-cafe-sniper','drop:gang-0:1']);
  sim.loot.forEach(item=>{item.collected=true;item.collectedBy='local';});sim.loot[1].ammo=0;
  rollbackPickupState(sim,{claimed:['city-weapon-0'],pickupAmmo:{'city-ammo-0':70}});
  assert.equal(sim.loot[0].collected,true);
  assert.equal(sim.loot[1].collected,false);assert.equal(sim.loot[1].ammo,70);assert.equal(sim.loot[1].collectedBy,undefined);
  assert.equal(sim.loot[2].collected,false);assert.equal(sim.loot[3].collected,true);
  assert.equal(sim.claimed.has('drop:gang-0:1'),true);
});
test('retry can select a phase resource snapshot or starting snapshot without keeping later depletion',()=>{
  const sim=make(),start={claimed:[],pickupAmmo:{'city-ammo-0':80}},phase={claimed:['city-weapon-0'],pickupAmmo:{'city-ammo-0':50}};
  restorePickupState(sim,{claimed:['city-weapon-0','city-ammo-0'],pickupAmmo:{}});
  rollbackPickupState(sim,phase);assert.equal(sim.loot[1].ammo,50);assert.equal(sim.loot[1].collected,false);assert.equal(sim.loot[0].collected,true);
  rollbackPickupState(sim,start);assert.equal(sim.loot[1].ammo,80);assert.equal(sim.loot[0].collected,false);
});
test('death and failed positional restores retain static depletion independently of character location',()=>{
  const sim=make();sim.player.health=0;sim.claimed.add('city-weapon-0');sim.loot[1].ammo=20;
  const saved=capturePickupState(sim);assert.deepEqual(saved,{claimed:['city-weapon-0'],pickupAmmo:{'city-ammo-0':20}});
  const next=make();restorePickupState(next,saved);
  const restored=restoreCheckpoint(next,{...saved,player:{x:1e9,z:1e9}},()=>{throw Error('must not apply invalid position');});
  assert.equal(restored,false);assert.equal(next.loot[0].collected,true);assert.equal(next.loot[1].ammo,20);
});
test('ordinary load and arrest restoration only deplete and never refill existing caches',()=>{
  const sim=make();sim.loot[1].ammo=15;sim.claimed.add('city-weapon-0');
  restorePickupState(sim,{claimed:[],pickupAmmo:{'city-ammo-0':70}});
  assert.equal(sim.loot[1].ammo,15);assert.equal(sim.loot[0].collected,true);
  const saved=capturePickupState(sim),next=make();restorePickupState(next,saved);
  assert.equal(next.loot[1].ammo,15);assert.equal(next.loot[0].collected,true);
});
test('older active careers migrate their mission-start city state from the explore save',()=>{
  const raw=api.begin(api.fresh(),'first-shift');delete raw.active.worldPickups;
  raw.worldPickups={claimed:['city-weapon-0'],pickupAmmo:{'city-ammo-0':20}};
  raw.explore={claimed:[],pickupAmmo:{'city-ammo-0':80}};
  const normalized=api.normalize(raw);
  assert.deepEqual(normalized.active.worldPickups,{claimed:[],pickupAmmo:{'city-ammo-0':80}});
  assert.deepEqual(normalized.worldPickups,{claimed:['city-weapon-0'],pickupAmmo:{'city-ammo-0':20}});
});
