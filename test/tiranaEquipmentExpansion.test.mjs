import test from 'node:test';
import assert from 'node:assert/strict';
import {EquipmentSimulation} from '../webapp/src/games/tiranastreets/street-career/EquipmentSimulation.mjs';
import {WEAPONS,WEAPON_BY_ID,STARTER_WEAPON} from '../webapp/src/games/tiranastreets/shared/weapons.mjs';
import {reserveCapacity,ammunitionQuote} from '../webapp/src/games/tiranastreets/shared/ammunition.mjs';
import {equipmentZoom,armorCapacity} from '../webapp/src/games/tiranastreets/shared/equipment.mjs';
import {createCampaign} from '../webapp/src/games/tiranastreets/street-career/campaignCore.mjs';
import {createState,MISSIONS} from '../webapp/src/games/tiranastreets/shared/engine.mjs';
import {lifeAction} from '../webapp/src/games/tiranastreets/shared/cityLife.mjs';
function fixture(weapon='c4Charge'){
 const player={id:'local',x:0,z:0,health:100,wanted:0,nextShot:0,weapon,inventory:{[weapon]:{ammo:1,reserve:2}}};
 const blasts=[],s={player,body:{yaw:0,pitch:0},state:{elapsed:0,effects:[],effectSeq:0},arrest:{locked:false},cars:()=>[],eye:()=>({x:0,y:20,z:0}),event(){},world:{cast:()=>({kind:'wall',point:{x:0,y:20,z:-2}})},combat:{emit(){},blast(...args){blasts.push(args);}}};
 return {s,equipment:new EquipmentSimulation(s),blasts};
}
test('C4 is placed only on a surface, consumes one charge and detonates once',()=>{
 const {s,equipment,blasts}=fixture();s.world.cast=()=>({kind:'air'});
 assert.equal(equipment.fire(),true);assert.equal(s.player.inventory.c4Charge.ammo,1);assert.equal(equipment.charges.length,0);
 s.world.cast=()=>({kind:'wall',point:{x:0,y:20,z:-2}});equipment.fire();equipment.fire();
 assert.equal(s.player.inventory.c4Charge.ammo,0);assert.equal(equipment.charges.length,1);assert.equal(blasts.length,0);
 assert.equal(equipment.detonate(),true);assert.equal(equipment.detonate(),false);assert.equal(blasts.length,1);
});
test('drone launch rejects obstruction and bounds concurrent deployments',()=>{
 const {s,equipment}=fixture('shahedDrone');equipment.fire();assert.equal(equipment.drones.length,0);
 s.world.cast=()=>({kind:'air'});equipment.fire();assert.equal(equipment.drones.length,1);assert.equal(s.player.inventory.shahedDrone.ammo,0);
 for(let i=0;i<5;i++){s.player.inventory.shahedDrone.ammo=1;s.state.elapsed+=3;equipment.fire();}
 assert.equal(equipment.drones.length,2);assert.equal(s.player.inventory.shahedDrone.ammo,1);
 s.player.health=0;equipment.step(.1);assert.equal(equipment.drones.length,0);
});
test('larger ammo reserves clamp purchases while passive equipment has no ammo',()=>{
 const rifle=WEAPON_BY_ID.get(STARTER_WEAPON);assert.equal(reserveCapacity(rifle),1200);
 assert.deepEqual(ammunitionQuote(rifle,{reserve:1198},'max'),{rounds:2,price:2,capacity:1200});
 assert.equal(reserveCapacity(WEAPON_BY_ID.get('c4Charge')),16);assert.equal(reserveCapacity(WEAPON_BY_ID.get('scope4x')),0);
});
test('scope and armor unlocks survive save normalization without becoming equipped',()=>{
 const campaign=createCampaign(MISSIONS,WEAPONS,STARTER_WEAPON),profile=campaign.fresh();
 profile.loadout.inventory.scope4x={ammo:1,reserve:0};profile.loadout.inventory.armorCarrier={ammo:1,reserve:0};profile.loadout.weapon='';
 profile.loadout.weapon='scope4x';assert.notEqual(campaign.normalize(profile).loadout.weapon,'scope4x');profile.loadout.weapon='';
 const restored=campaign.normalize(JSON.parse(JSON.stringify(profile))).loadout;
 assert.equal(restored.weapon,'');assert.equal(armorCapacity(restored),150);
 restored.weapon=STARTER_WEAPON;assert.equal(equipmentZoom(restored),4);restored.weapon='egg';assert.equal(equipmentZoom(restored),1);
 const state=createState([{id:'local'}],'free-roam','solo'),p=state.players.local;p.inventory=restored.inventory;p.weapon=STARTER_WEAPON;
 lifeAction(state,p,'equip:scope4x');assert.equal(p.weapon,STARTER_WEAPON);
 lifeAction(state,p,'holster');assert.equal(p.weapon,'');lifeAction(state,p,'holster');assert.equal(p.weapon,STARTER_WEAPON);
});
