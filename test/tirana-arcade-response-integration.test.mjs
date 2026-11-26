import assert from 'node:assert/strict';
import {test} from 'node:test';
import {StreetSimulation} from '../webapp/src/games/tiranastreets-november/street-career/StreetSimulation.mjs';
import {ArcadeResponse} from '../webapp/src/games/tiranastreets-november/street-career/arcadeResponse.mjs';

const fixture = () => {
  const player={id:'local',x:0,z:0,health:100,wanted:300,weapon:'awpSniperAttack',
    inventory:{awpSniperAttack:{ammo:0},egg:{ammo:2},tomato:{ammo:2}},nextShot:0};
  const npc={id:'np',kind:'police',x:0,z:-1,weapon:'awpSniperAttack',health:100};
  const arrestEvents=[];
  const state={players:{local:player},elapsed:12,npcs:[npc],effects:[],effectSeq:0};
  const sim=Object.assign(Object.create(StreetSimulation.prototype),{
    state,arrest:{provoke:(n,k)=>arrestEvents.push([n.id,k])},arcadeResponse:new ArcadeResponse(),access:{parachute:{open:false}},
    body:{interaction:'free',yaw:0,pitch:0,y:0},world:{clear:()=>true},cars:()=>[],
    equipment:{fire:()=>false},throwables:{throw(w){player.inventory[w.id].ammo--;}},
    damage(){},event(){}
  });
  return {sim,player,npc,arrestEvents};
};

test('solo projectile path stays disabled after equipping and actual food throws',()=>{
  const {sim,player,npc}=fixture();
  sim.fire(); // empty weapon
  sim.fireNPC(npc,player);
  assert.equal(npc.loadedWeapon,undefined);
  for(const weapon of ['egg','tomato']){
    player.weapon=weapon;
    sim.fire();
    assert.equal(player.inventory[weapon].ammo,1);
    sim.fireNPC(npc,player);
    assert.equal(npc.loadedWeapon,undefined);
  }
  assert.equal(npc.shotsFired,undefined);
});
test('punch and kick produce a warning for officers, neither unlocks NPC projectiles',()=>{
  const {sim,player,npc,arrestEvents}=fixture();
  player.weapon='';
  sim.melee({kind:'punch'});
  assert.equal(sim.body.notice,'Stand back');
  sim.fireNPC(npc,player);
  assert.equal(npc.loadedWeapon,undefined);
  player.x=8;
  assert.equal(sim.arcadeResponse.update(sim.state.elapsed,sim.state.npcs,player),false);
  player.x=0;
  sim.melee({kind:'kick'});
  assert.ok(sim.arcadeResponse.warning);
  sim.fireNPC(npc,player);
  assert.equal(npc.shotsFired,undefined);
  npc.kind='civilian';
  sim.arcadeResponse.warning=null;
  sim.melee({kind:'punch'});
  assert.equal(sim.arcadeResponse.warning,null);
  assert.deepEqual(arrestEvents,[['np','unarmed'],['np','unarmed']]);
});
