import test from 'node:test';
import assert from 'node:assert/strict';
import {ammunitionQuote,reserveCapacity} from '../webapp/src/games/tiranastreets/shared/ammunition.mjs';
import {collectWeapon,CITY_POPULATION} from '../webapp/src/games/tiranastreets/shared/cityPopulation.mjs';
import {createState,upgradeState,MISSIONS} from '../webapp/src/games/tiranastreets/shared/engine.mjs';
import {lifeAction} from '../webapp/src/games/tiranastreets/shared/cityLife.mjs';
import {WEAPON_BY_ID,WEAPONS,STARTER_WEAPON} from '../webapp/src/games/tiranastreets/shared/weapons.mjs';
import {createCampaign} from '../webapp/src/games/tiranastreets/street-career/campaignCore.mjs';
import {StreetSimulation} from '../webapp/src/games/tiranastreets/street-career/StreetSimulation.mjs';
import {captureCheckpoint,restoreCheckpoint} from '../webapp/src/games/tiranastreets/street-career/checkpointCore.mjs';

const rifle=WEAPON_BY_ID.get('ak47VolleyAttack');
const fixture=()=>{
 const p={id:'local',x:0,z:0,health:100,cash:10000,armor:0,wanted:0,weapon:'glockSidearmAttack',inventory:{[rifle.id]:{ammo:rifle.magazine,reserve:0}},reloadAt:14,nextShot:0};
 return {elapsed:1,players:{local:p},shop:{x:0,z:0},effects:[],effectSeq:0,pickups:[{id:'city-ammo-0',kind:'ammo',source:'cache',x:0,y:.15,z:0,weapon:rifle.id,ammo:90,initialAmmo:90}]};
};

test('quotes charge only transferred ammunition and bound explosive reserves',()=>{
 assert.equal(reserveCapacity(rifle),rifle.magazine*20);
 assert.equal(reserveCapacity(WEAPON_BY_ID.get('egg')),96);
 assert.equal(reserveCapacity(WEAPON_BY_ID.get('combatKnife')),0);
 const quote=ammunitionQuote(rifle,{reserve:reserveCapacity(rifle)-2},'max');
 assert.equal(quote.rounds,2);assert.ok(quote.price>0);
 assert.ok(quote.price<ammunitionQuote(rifle,{reserve:0},'box').price);
 assert.deepEqual(ammunitionQuote(rifle,{reserve:reserveCapacity(rifle)},'max'),{rounds:0,price:0,capacity:reserveCapacity(rifle)});
 assert.equal(ammunitionQuote(rifle,{reserve:0},'invalid').rounds,0);
});

test('ammunition caches keep equipped weapon and reload, preserve excess, and cannot be double-collected',()=>{
 const s=fixture(),p=s.players.local,item=s.pickups[0];p.inventory[rifle.id].reserve=reserveCapacity(rifle)-7;
 assert.equal(collectWeapon(s,p,item.id),true);assert.equal(item.ammo,83);assert.equal(item.collected,undefined);
 assert.equal(p.weapon,'glockSidearmAttack');assert.equal(p.reloadAt,14);assert.equal(p.inventory[rifle.id].reserve,reserveCapacity(rifle));
 assert.equal(collectWeapon(s,p,item.id),false);assert.equal(item.ammo,83);
 p.inventory[rifle.id].reserve=0;assert.equal(collectWeapon(s,p,item.id),true);assert.equal(p.inventory[rifle.id].reserve,83);assert.equal(item.collected,true);
 assert.equal(collectWeapon(s,p,item.id),false);
});

test('missing weapon, invalid reach, vehicle, death and expired cache never consume ammo',()=>{
 for(const patch of [{inventory:{}},{x:4},{carId:'car'},{aircraftId:'heli'},{health:0},{finished:true},{failed:true}]){
  const s=fixture(),p=s.players.local;Object.assign(p,patch);
  assert.equal(collectWeapon(s,p,s.pickups[0].id),false);assert.equal(s.pickups[0].ammo,90);
 }
 const s=fixture();s.pickups[0].expiresAt=.5;assert.equal(collectWeapon(s,s.players.local,s.pickups[0].id),false);
});

test('bulk purchase is atomic, preserves selected weapon, and rejects unavailable amounts and paid unlock bypasses',()=>{
 const s=fixture(),p=s.players.local,q=ammunitionQuote(rifle,p.inventory[rifle.id],'max');
 lifeAction(s,p,`buy:ammo:max:${rifle.id}`);assert.equal(p.cash,10000-q.price);assert.equal(p.inventory[rifle.id].reserve,reserveCapacity(rifle));assert.equal(p.weapon,'glockSidearmAttack');assert.equal(p.reloadAt,14);
 const cash=p.cash;lifeAction(s,p,`buy:ammo:max:${rifle.id}`);assert.equal(p.cash,cash);
 p.inventory[rifle.id].reserve=0;p.cash=0;lifeAction(s,p,`buy:ammo:box:${rifle.id}`);assert.equal(p.inventory[rifle.id].reserve,0);
 p.cash=10000;lifeAction(s,p,`buy:ammo:unbounded:${rifle.id}`);assert.equal(p.cash,10000);
 delete p.inventory[rifle.id];lifeAction(s,p,`buy:${rifle.id}`);assert.equal(p.cash,10000);assert.equal(p.inventory[rifle.id],undefined);
});

test('restocking refuses wanted, aircraft, arrest and ended sessions',()=>{
 for(const patch of [{wanted:1},{aircraftId:'heli'},{carId:'car'},{arrest:{phase:'custody'}},{failed:true},{finished:true}]){
  const s=fixture(),p=s.players.local;Object.assign(p,patch);lifeAction(s,p,`buy:ammo:box:${rifle.id}`);
  assert.equal(p.cash,10000);assert.equal(p.inventory[rifle.id].reserve,0);
 }
});

test('city adds distinct nearby-store destinations and hidden caches without reducing original weapons',()=>{
 const s=createState([{id:'local',name:'Test'}],'free-roam');
 assert.equal(s.shops.length,CITY_POPULATION.shops);assert.equal(s.shops.length,24);
 assert.equal(s.pickups.filter(p=>p.kind!=='ammo').length,300);
 assert.equal(s.pickups.filter(p=>p.kind==='ammo').length,96);
 assert.equal(new Set(s.pickups.map(p=>p.id)).size,396);
 for(const p of s.pickups.filter(p=>p.kind==='ammo')){assert.ok(Number.isFinite(p.x+p.y+p.z));assert.ok(p.ammo>0);assert.equal(p.ammo,p.initialAmmo);}
});

test('older multiplayer populations receive new shops and caches without resetting claimed loot or traffic',()=>{
 const s=createState([{id:'local',name:'Test'}],'free-roam'),traffic=s.traffic;
 s.populationVersion=1;s.shops=s.shops.slice(0,15);s.pickups=s.pickups.filter(p=>p.kind!=='ammo');
 s.pickups[0].collected=true;s.pickups[0].collectedBy='local';
 s.npcs=s.npcs.filter(n=>!/^dealer-arsenal-(1[6-9]|2\d)$/.test(n.id));
 upgradeState(s);assert.equal(s.populationVersion,2);assert.equal(s.traffic,traffic);assert.equal(s.shops.length,24);assert.equal(s.pickups.length,396);
 assert.equal(s.pickups[0].collected,true);assert.equal(s.pickups[0].collectedBy,'local');
 assert.ok(s.npcs.find(n=>n.id==='dealer-arsenal-24'));
 const count=s.npcs.length;upgradeState(s);assert.equal(s.npcs.length,count);assert.equal(s.pickups.length,396);
});

test('expanded reserves and partially collected ammunition survive saved career restoration',()=>{
 const s=createState([{id:'local',name:'Test'}],'free-roam'),world={clear:()=>true,clearance:()=>true,surface:()=>.08};
 const sim=new StreetSimulation(s,world),item=s.pickups.find(p=>p.kind==='ammo'&&p.weapon===rifle.id);
 assert.ok(item);Object.assign(sim.player,{x:item.x,z:item.z});sim.player.inventory[rifle.id]={ammo:rifle.magazine,reserve:reserveCapacity(rifle)-7};
 assert.equal(collectWeapon(s,sim.player,item.id),true);
 const campaign=createCampaign(MISSIONS,WEAPONS,STARTER_WEAPON),profile=campaign.fresh();profile.explore=captureCheckpoint(sim);
 const saved=campaign.normalize(JSON.parse(JSON.stringify(profile))).explore;
 assert.equal(saved.player.inventory[rifle.id].reserve,reserveCapacity(rifle));assert.equal(saved.pickupAmmo[item.id],item.ammo);
 const restored=new StreetSimulation(createState([{id:'local',name:'Test'}],'free-roam'),world);
 assert.equal(restoreCheckpoint(restored,saved,campaign.apply),true);
 assert.equal(restored.loot.find(p=>p.id===item.id).ammo,item.ammo);
});
