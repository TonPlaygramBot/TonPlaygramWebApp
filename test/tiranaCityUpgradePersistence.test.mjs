import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,MISSIONS} from '../webapp/src/games/tiranastreets/shared/engine.mjs';
import {StreetSimulation} from '../webapp/src/games/tiranastreets/street-career/StreetSimulation.mjs';
import {createCampaign} from '../webapp/src/games/tiranastreets/street-career/campaignCore.mjs';
import {captureCheckpoint,restoreCheckpoint,normalizeCheckpoint} from '../webapp/src/games/tiranastreets/street-career/checkpointCore.mjs';
import {WEAPONS,STARTER_WEAPON} from '../webapp/src/games/tiranastreets/shared/weapons.mjs';
import {collectWeapon} from '../webapp/src/games/tiranastreets/shared/cityPopulation.mjs';
import {reserveCapacity} from '../webapp/src/games/tiranastreets/shared/ammunition.mjs';
const campaign=createCampaign(MISSIONS,WEAPONS,STARTER_WEAPON);
const create=()=>new StreetSimulation(createState([{id:'local',name:'Test'}],'free-roam','solo'));
const loadout=q=>campaign.normalize({...campaign.fresh(),loadout:q}).loadout;

test('partly collected ammunition stays depleted across normalized checkpoints',()=>{
  const sim=create(),item=sim.loot.find(l=>l.kind==='ammo'),w=WEAPONS.find(w=>w.id===item.weapon);
  sim.player.x=item.x;sim.player.z=item.z;sim.body.y=item.y;
  sim.player.inventory[item.weapon]={ammo:w.magazine,reserve:reserveCapacity(w)-7};
  const original=item.ammo,equipped=sim.player.weapon;
  assert.equal(collectWeapon(sim.state,sim.player,item.id),true);
  assert.equal(item.ammo,original-7);assert.equal(sim.player.weapon,equipped);
  const checkpoint=normalizeCheckpoint(captureCheckpoint(sim),loadout,1);
  assert.equal(checkpoint.pickupAmmo[item.id],original-7);
  const restored=create();
  assert.equal(restoreCheckpoint(restored,checkpoint,campaign.apply),true);
  assert.equal(restored.loot.find(l=>l.id===item.id).ammo,original-7);
  assert.equal(collectWeapon(restored.state,restored.player,item.id),false);
  assert.equal(restored.loot.find(l=>l.id===item.id).ammo,original-7);
});

test('consumed cache and rooftop pickup identities survive save normalization',()=>{
  const sim=create();sim.claimed.add('city-ammo-3');sim.claimed.add('sky-cafe-sniper');sim.claimed.add('not-a-real-pickup');
  const checkpoint=normalizeCheckpoint(captureCheckpoint(sim),loadout,1);
  assert.ok(checkpoint.claimed.includes('city-ammo-3'));assert.ok(checkpoint.claimed.includes('sky-cafe-sniper'));
  assert.equal(checkpoint.claimed.includes('not-a-real-pickup'),false);
});

test('home ownership, bank savings and stash survive mission begin and abandon without changing funds',()=>{
  const sim=create(),site=sim.economy.sites.find(s=>s.kind==='apartment');
  Object.assign(sim.player,{x:site.entrance.x,z:site.entrance.z,cash:10000});sim.body.y=site.entrance.y;
  assert.equal(sim.economy.transact('purchase',site.id),true);
  const bank=sim.economy.sites.find(s=>s.kind==='bank');
  Object.assign(sim.player,{x:bank.counter.x,z:bank.counter.z});sim.body.y=bank.counter.y;
  assert.equal(sim.economy.transact('deposit',bank.id,500),true);
  let profile=campaign.saveExplore({...campaign.fresh(),economy:sim.economy.snapshot()},sim.player);
  const total=profile.loadout.cash+profile.economy.bank+site.price;
  assert.equal(total,10000);
  profile=campaign.abandon(campaign.begin(profile,'first-shift','normal'));
  const storage={value:'',setItem(_key,value){this.value=value;},getItem(){return this.value;}};
  assert.equal(campaign.save(storage,profile),true);
  const loaded=campaign.load(storage),next=create();next.economy.restore(loaded.economy);
  assert.ok(next.economy.owns(site.id));assert.equal(next.economy.data.bank,500);
  assert.equal(loaded.loadout.cash+next.economy.data.bank+site.price,10000);
});
