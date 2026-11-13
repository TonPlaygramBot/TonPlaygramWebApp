import test from 'node:test';
import assert from 'node:assert/strict';
import {CityEconomySimulation,normalizeCityEconomy,BANK_HOLD_SECONDS,BANK_COOLDOWN_SECONDS} from '../webapp/src/games/tiranastreets/street-career/CityEconomySimulation.mjs';
import {cityEconomySites,ECONOMY_PROPERTIES,ECONOMY_BANKS} from '../webapp/src/games/tiranastreets/street-career/cityEconomyCatalog.mjs';
import {WEAPON_BY_ID} from '../webapp/src/games/tiranastreets/shared/weapons.mjs';
import {reserveCapacity} from '../webapp/src/games/tiranastreets/shared/ammunition.mjs';
import {StreetWorld} from '../webapp/src/games/tiranastreets/street-career/spatialCore.mjs';
import {BuildingAccessSimulation} from '../webapp/src/games/tiranastreets/street-career/BuildingAccessSimulation.mjs';
import {buildingAccessSites} from '../webapp/src/games/tiranastreets/shared/buildingAccess.mjs';
import {createBody} from '../webapp/src/games/tiranastreets/street-career/playerCore.mjs';
const weapon=[...WEAPON_BY_ID.values()].find(w=>w.category!=='melee'&&w.category!=='throwable'&&!w.radius);
const bank={...ECONOMY_BANKS[0],entrance:{x:0,y:.08,z:0},counter:{x:0,y:.08,z:10}};
const home={...ECONOMY_PROPERTIES[0],entrance:{x:10,y:.08,z:0},counter:{x:10,y:.08,z:10}};
function fixture(raw){
 const player={id:'local',x:0,z:10,health:100,cash:10000,wanted:0,weapon:weapon.id,inventory:{[weapon.id]:{ammo:weapon.magazine,reserve:weapon.magazine*3}},tpg:123};
 const sim={player,body:{y:.08,grounded:true,interaction:'free',notice:''},state:{elapsed:0,missionId:'free-roam',effects:[],effectSeq:0},arrest:{locked:false},access:{travel:null},events:[],event(kind,data){this.events.push({kind,...data});}};
 const economy=new CityEconomySimulation(sim,raw,[bank,home]);sim.economy=economy;return {sim,player,economy};
}
test('bank deposits conserve street money; remote, negative and fractional transfers fail',()=>{
 const {economy,player}=fixture();
 assert.equal(economy.transact('deposit',bank.id,500),true);
 assert.equal(player.cash,9500);assert.equal(economy.data.bank,500);
 assert.equal(economy.transact('withdraw',bank.id,200),true);
 assert.equal(player.cash+economy.data.bank,10000);assert.equal(player.tpg,123);
 for(const amount of [0,-1,.5,NaN,Infinity,10001])assert.equal(economy.transact('withdraw',bank.id,amount),false);
 player.x=100;assert.equal(economy.transact('withdraw',bank.id,100),false);
});
test('property purchase occurs once at entrance, normalizes ownership and stores real carried ammo',()=>{
 const {economy,player}=fixture();player.x=10;player.z=0;
 assert.equal(economy.transact('purchase',home.id),true);assert.equal(player.cash,10000-home.price);
 assert.equal(economy.transact('purchase',home.id),false);
 player.z=10;
 assert.equal(economy.transact('store',home.id,weapon.magazine,weapon.id),true);
 assert.equal(player.inventory[weapon.id].reserve,weapon.magazine*2);
 const saved=economy.snapshot(),reloaded=fixture(saved).economy;
 assert.equal(reloaded.owns(home.id),true);assert.equal(reloaded.data.stash[home.id][weapon.id],weapon.magazine);
 assert.equal(economy.transact('take',home.id,weapon.magazine,weapon.id),true);
 assert.equal(player.inventory[weapon.id].reserve,weapon.magazine*3);
 assert.equal(economy.transact('take',home.id,1,weapon.id),false);
});
test('storage cannot exceed carried ammo limit or duplicate ammunition',()=>{
 const {economy,player}=fixture({version:1,owned:[home.id],stash:{[home.id]:{[weapon.id]:weapon.magazine*4}}});
 player.x=10;player.z=10;player.inventory[weapon.id].reserve=reserveCapacity(weapon);
 assert.equal(economy.transact('take',home.id,1,weapon.id),false);
 assert.equal(economy.transact('store',home.id,player.inventory[weapon.id].reserve+1,weapon.id),false);
 assert.equal(economy.data.stash[home.id][weapon.id],weapon.magazine*4);
});
test('mission retry cannot refund purchases or bank deposits because services require free roam',()=>{
 const {economy,player,sim}=fixture();sim.state.missionId='first-shift';
 assert.equal(economy.transact('deposit',bank.id,100),false);
 player.x=10;player.z=0;assert.equal(economy.transact('purchase',home.id),false);
 assert.equal(player.cash,10000);assert.equal(economy.data.bank,0);
});
test('bank job requires a hold then escape and loses reward on arrest; payout is once and local',()=>{
 const {economy,player,sim}=fixture();
 assert.equal(economy.transact('rob',bank.id),true);assert.ok(player.wanted>=260);
 economy.step(BANK_HOLD_SECONDS);assert.equal(economy.robbery.phase,'escape');assert.equal(player.cash,10000);
 player.x=120;economy.step(1);assert.equal(player.cash,10000);
 player.wanted=0;economy.step(1);assert.equal(player.cash,10000+bank.reward);assert.equal(player.tpg,123);
 economy.step(1);assert.equal(player.cash,10000+bank.reward);
 player.x=0;player.z=10;assert.equal(economy.transact('rob',bank.id),false);
 economy.step(BANK_COOLDOWN_SECONDS);assert.equal(economy.transact('rob',bank.id),true);
 sim.arrest.locked=true;economy.step(1);assert.equal(economy.robbery,null);assert.equal(player.cash,10000+bank.reward);
});
test('leaving hold area cancels job and cooldown survives reload without a pending reward',()=>{
 const {economy,player}=fixture();economy.transact('rob',bank.id);player.x=30;economy.step(1);
 assert.equal(economy.robbery,null);assert.equal(player.cash,10000);
 const reload=fixture(economy.snapshot()).economy;assert.equal(reload.robbery,null);assert.ok(reload.data.cooldowns[bank.id]>0);
});
test('normalizer discards unknown homes, weapons, banks and impossible values',()=>{
 const data=normalizeCityEconomy({version:1,bank:Infinity,owned:['unknown',home.id,home.id],stash:{[home.id]:{[weapon.id]:1e20,unknown:50}},cooldowns:{unknown:500,[bank.id]:1e9}});
 assert.equal(data.bank,0);assert.deepEqual(data.owned,[home.id]);assert.equal(data.stash[home.id][weapon.id],home.stashMagazines*weapon.magazine);
 assert.equal(data.cooldowns[bank.id],BANK_COOLDOWN_SECONDS);assert.equal(data.cooldowns.unknown,undefined);
 assert.equal(normalizeCityEconomy({bank:900}).bank,0);
});
test('all six sale listings and three banks have collision-clear ground entrance and lobby',()=>{
 const sites=cityEconomySites(),world=new StreetWorld();
 assert.equal(sites.length,ECONOMY_PROPERTIES.length+ECONOMY_BANKS.length);
 for(const site of sites){
  assert.ok(world.clearance(site.entrance,1.78,.32),`${site.id} entrance`);
  assert.ok(world.clearance(site.lobbyPoint,1.78,.32),`${site.id} lobby`);
  assert.ok(world.clearance(site.counter,1.78,.32),`${site.id} counter`);
 }
});
test('owned homes and bank entrance portals arrive inside and offer a safe exit',()=>{
 const world=new StreetWorld(),all=buildingAccessSites();
 for(const id of [bank.id,...ECONOMY_PROPERTIES.map(p=>p.id)]){
  const selected=all.find(s=>s.economyId===id),site=cityEconomySites().find(s=>s.id===id),{sim,player}=fixture();
  sim.world=world;sim.body=createBody();sim.state.pickups=[];
  sim.economy=new CityEconomySimulation(sim,{version:1,owned:[id]},[site]);
  sim.access=new BuildingAccessSimulation(sim,[selected]);
  Object.assign(player,{x:selected.entrance.x,z:selected.entrance.z});sim.body.y=selected.entrance.y;
  const enter=sim.access.candidates().find(c=>c.kind==='access-enter');assert.ok(enter);
  assert.ok(sim.access.execute(enter));sim.access.step(1);
  assert.equal(sim.body.interaction,'free');assert.equal(player.x,selected.lobbyPoint.x);
  const leave=sim.access.candidates().find(c=>c.kind==='access-leave');assert.ok(leave);
  assert.equal(sim.economy.candidates().length,0,`${id}: storage focus must not hide exit`);
  assert.ok(sim.access.execute(leave));sim.access.step(1);assert.equal(player.x,selected.entrance.x);
 }
});
