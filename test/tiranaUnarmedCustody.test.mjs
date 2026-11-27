import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createState,FREE_ROAM} from '../webapp/src/games/tiranastreets-november/shared/engine.mjs';
import {StreetSimulation} from '../webapp/src/games/tiranastreets-november/street-career/StreetSimulation.mjs';
import {WEAPONS} from '../webapp/src/games/tiranastreets-november/shared/weapons.mjs';
import {StreetWorld} from '../webapp/src/games/tiranastreets-november/street-career/spatialCore.mjs';

function scene(){
 const state=createState([{id:'local',name:'Fixture'}],FREE_ROAM.id,'solo');
 const world=new StreetWorld([]);world.clear=()=>true;
 const sim=new StreetSimulation(state,world),player=sim.player;
 Object.assign(player,{x:0,z:0,weapon:'',wanted:0});
 Object.assign(sim.body,{yaw:0,pitch:0,y:.12});
 const officer={id:'officer-fixture',kind:'police',x:0,z:-1,heading:0,health:100,motion:'walk',speed:0,weapon:WEAPONS.find(w=>w.category==='sidearm')?.id};
 state.npcs=[officer];state.elapsed=4;
 const env={clear:()=>true,along(){},collide(){}};
 return {state,sim,player,officer,env};
}

test('unarmed contact enters warning before the default wanted-state response; an NPC does not fire',()=>{
 const {state,sim,player,officer,env}=scene();
 sim.melee({kind:'punch'});
 assert.equal(sim.arrest.current?.reason,'unarmed');
 assert.equal(sim.arrest.current?.phase,'pursuit');
 assert.ok(player.wanted>0&&officer.health<100);
 assert.equal(sim.arrest.officer(officer,player,1/60,env),true);
 const before=state.effects.length;
 sim.fireNPC(officer,player);
 assert.equal(state.effects.length,before);
 assert.equal(sim.arrest.current.phase,'pursuit');
});

test('surrender stops at non-violent custody and does not trigger the fictional spray event',()=>{
 const {state,sim,player}=scene();
 sim.melee({kind:'kick'});
 assert.ok(sim.resolve().some(a=>a.id==='surrender'&&a.enabled));
 assert.equal(sim.execute('surrender'),true);
 assert.equal(player.arrest.phase,'down');
 assert.equal(sim.arrest.locked,true);
 assert.ok(!state.effects.some(e=>e.kind==='pepper-spray'));
 assert.equal(sim.execute('surrender'),false);
});

test('continued pursuit uses the existing fictional spray path only after the warning',()=>{
 const {state,sim,player,officer,env}=scene();
 sim.melee({kind:'punch'});
 state.elapsed=5;
 sim.arrest.officer(officer,player,1/60,env);
 assert.equal(player.arrest.phase,'pursuit');
 state.elapsed=8.25;
 sim.arrest.officer(officer,player,1/60,env);
 assert.equal(player.arrest.phase,'spray');
 assert.ok(state.effects.some(e=>e.kind==='pepper-spray'));
 assert.ok(!state.effects.some(e=>e.kind==='shot'));
});

test('an unarmed miss or using a different item does not set the unarmed tag',()=>{
 const {sim,player,officer}=scene();
 officer.x=10;
 sim.melee({kind:'punch'});
 assert.equal(sim.arrest.current,null);
 officer.x=0;player.weapon='combatKnife';
 sim.melee({kind:'punch'});
 assert.equal(sim.arrest.current,null);
});

test('an ended unarmed-only chase does not leak into ordinary wanted-state shooting',()=>{
 const {sim,player}=scene();
 sim.melee({kind:'punch'});
 assert.ok(player.wanted>0);
 sim.arrest.release('Ended');
 assert.equal(player.wanted,0);assert.equal(sim.arrest.current,null);
});
