import test from 'node:test';
import assert from 'node:assert/strict';
import {CivicConvoySimulation} from '../webapp/src/games/tiranastreets/street-career/CivicConvoySimulation.mjs';
import {ReneaResponseSimulation,RENEA_RESPONSE} from '../webapp/src/games/tiranastreets/street-career/ReneaResponseSimulation.mjs';
import {CombatSimulation} from '../webapp/src/games/tiranastreets/street-career/CombatSimulation.mjs';
import {groundHeight} from '../webapp/src/games/tirana-east/terrainCore.mjs';
import {createState} from '../webapp/src/games/tiranastreets/shared/engine.mjs';
import {StreetSimulation} from '../webapp/src/games/tiranastreets/street-career/StreetSimulation.mjs';
import {StreetWorld} from '../webapp/src/games/tiranastreets/street-career/spatialCore.mjs';
import {traceShot} from '../webapp/src/games/tiranastreets/street-career/shotCore.mjs';

function fixture(){
 const player={id:'local',x:0,z:0,health:100,wanted:0,lastCrime:-100};
 const sim={player,body:{y:0,notice:''},arrest:{locked:false},state:{cars:[],traffic:[],units:[],npcs:[],players:{local:player},elapsed:0,effects:[],effectSeq:0,helicopters:[]},events:[],
 world:{clearance:()=>true,clear:()=>true,surface:(x,z)=>groundHeight(x,z),move:(q,dx,dz)=>{q.x+=dx;q.z+=dz;}},
 cars(){return [...this.state.cars,...this.state.traffic,...this.state.units];},event(kind){this.events.push(kind);},fireNPC(n){n.firedAt=this.state.elapsed;}};
 sim.combat=new CombatSimulation(sim);return sim;
}
const step=(sim,response,seconds)=>{for(let t=0;t<seconds-1e-8;t+=.05){sim.state.elapsed+=.05;response.step(.05);}};

test('vehicle hits trigger one protective escort squad and keep the principal seated',()=>{
 const sim=fixture();sim.civicConvoy=new CivicConvoySimulation(sim,{pathfinder:()=>[{x:0,z:1000},{x:0,z:0}],awareness:()=>13.5,spawnClear:()=>true});
 const convoy=sim.civicConvoy,car=convoy.principal;sim.player.x=car.x+15;sim.player.z=car.z;
 const before=convoy.vehicles.map(v=>[v.x,v.z]);
 sim.combat.damageVehicle(car,32,sim.player,'bullet');
 assert.equal(convoy.status,'protecting');assert.ok(sim.player.wanted>=220);assert.equal(convoy.npc.seated,true);
 assert.equal(sim.state.npcs.filter(n=>n.civicEscort).length,6);
 assert.ok(convoy.vehicles.every(v=>v.speed===0));
 sim.combat.damageVehicle(car,32,sim.player,'bullet');assert.equal(sim.state.npcs.filter(n=>n.civicEscort).length,6);
 step(sim,convoy,2);assert.deepEqual(convoy.vehicles.map(v=>[v.x,v.z]),before);
 assert.ok(convoy.escorts.some(n=>n.anim==='aim'));
 assert.ok(convoy.escorts.every(n=>Math.hypot(n.x-car.x,n.z-car.z)<55));
});

test('minor bumps and friendly damage do not dispatch convoy protection',()=>{
 const sim=fixture();const c=new CivicConvoySimulation(sim,{pathfinder:()=>[{x:0,z:1000},{x:0,z:0}],awareness:()=>13.5,spawnClear:()=>true});
 assert.equal(c.onAttack(c.principal,sim.player,'collision',2),false);
 assert.equal(c.onAttack(c.principal,{id:'officer',kind:'police'},'bullet',20),false);
 assert.equal(c.onAttack(c.principal,sim.player,'heat',20),false);
 assert.equal(c.status,'travelling');assert.equal(sim.state.npcs.filter(n=>n.civicEscort).length,0);
});

test('escorts reboard before travel resumes and a later incident creates only one nearby squad',()=>{
 const sim=fixture(),c=new CivicConvoySimulation(sim,{pathfinder:()=>[{x:0,z:1000},{x:0,z:0}],awareness:()=>13.5,spawnClear:()=>true});
 sim.civicConvoy=c;sim.player.x=c.principal.x+15;sim.player.z=c.principal.z;
 c.onAttack(c.principal,sim.player);step(sim,c,2);
 sim.player.wanted=0;sim.player.x=500;step(sim,c,50);
 assert.equal(c.status,'travelling');assert.equal(c.escorts.length,0);assert.equal(sim.state.npcs.filter(n=>n.civicEscort).length,0);
 c.onAttack(c.principal,sim.player);assert.equal(c.escorts.length,6);assert.equal(sim.state.npcs.filter(n=>n.civicEscort).length,6);
 assert.ok(c.escorts.every(n=>Math.hypot(n.x-c.principal.x,n.z-c.principal.z)<55));
});

test('direct damage to the dismounted principal triggers protection and cannot resurrect a downed actor',()=>{
 const sim=new StreetSimulation(createState([{id:'local',name:'Principal test'}],'free-roam','solo'),new StreetWorld([],false));
 const convoy=sim.civicConvoy;convoy.status='visiting';const npc=convoy.npc;
 assert.ok(sim.state.npcs.includes(npc));assert.equal(npc.seated,false);
 const side={x:Math.cos(npc.heading+Math.PI/2),z:-Math.sin(npc.heading+Math.PI/2)};
 const hit=traceShot(sim.world,{x:npc.x+side.x*4,y:groundHeight(npc.x,npc.z)+1.2,z:npc.z+side.z*4},{x:-side.x,y:0,z:-side.z},8,sim.cars(),[npc]);
 assert.equal(hit.target,npc,'dismounted principal participates in the normal hit query');
 sim.damage(npc,20,sim.player);
 assert.equal(convoy.status,'protecting');assert.equal(convoy.npc,npc);assert.equal(npc.health,80);assert.equal(npc.seated,true);
 convoy.status='visiting';const standing=convoy.npc;
 sim.damage(standing,100,sim.player);
 const position={x:standing.x,z:standing.z};
 assert.equal(convoy.npc.health,0);assert.equal(convoy.npc.seated,false);assert.equal(convoy.npc.downUntil,Infinity);
 step(sim,convoy,40);assert.deepEqual({x:convoy.npc.x,z:convoy.npc.z},position);assert.equal(convoy.npc.health,0);
});

test('four-star alert visibly approaches then deploys six ground-ready RENEA operators once',()=>{
 const sim=fixture(),response=new ReneaResponseSimulation(sim);
 sim.player.wanted=300;step(sim,response,1);assert.equal(response.aircraft,null);
 sim.player.wanted=301;step(sim,response,.05);assert.equal(response.phase,'approach');
 const initial=response.aircraft.x;assert.equal(sim.state.helicopters.length,1);assert.equal(response.aircraft.responseOnly,true);
 step(sim,response,1);assert.ok(response.aircraft.x<initial);assert.equal(sim.state.npcs.length,0);
 step(sim,response,12);
 assert.equal(sim.state.npcs.length,RENEA_RESPONSE.crew);
 assert.ok(sim.state.npcs.every(n=>n.forceCharacter==='renea_officer'&&!n.airDeploying));
 assert.ok(sim.state.npcs.every(n=>n.y===undefined),'ground AI resumes terrain-relative placement');
 step(sim,response,65);assert.equal(response.aircraft,null);assert.equal(sim.state.helicopters.length,0);
 assert.equal(sim.state.npcs.length,6);assert.equal(sim.events.filter(k=>k==='renea-dispatch').length,1);
});

test('blocked deployment space never creates a helicopter or troops inside buildings',()=>{
 const sim=fixture(),response=new ReneaResponseSimulation(sim);sim.player.wanted=400;sim.world.clearance=()=>false;
 step(sim,response,8);assert.equal(response.aircraft,null);assert.equal(sim.state.npcs.length,0);
 sim.world.clearance=()=>true;step(sim,response,3);assert.ok(response.aircraft);
});

test('cleared wanted level aborts an arrival and cooldown blocks repeated spawns',()=>{
 const sim=fixture(),response=new ReneaResponseSimulation(sim);sim.player.wanted=400;step(sim,response,1);
 sim.player.wanted=0;step(sim,response,7);assert.equal(response.aircraft,null);assert.equal(sim.state.npcs.length,0);
 sim.player.wanted=400;step(sim,response,2);assert.equal(response.aircraft,null);
});

test('a later distant incident reuses the response budget instead of leaving air support permanently blocked',()=>{
 const sim=fixture(),response=new ReneaResponseSimulation(sim);sim.player.wanted=400;
 step(sim,response,70);assert.equal(sim.state.npcs.length,6);const oldIds=new Set(sim.state.npcs.map(n=>n.id));
 sim.player.x=1000;step(sim,response,.1);assert.equal(response.phase,'approach');
 step(sim,response,14);assert.equal(sim.state.npcs.length,6);assert.ok(sim.state.npcs.every(n=>!oldIds.has(n.id)));
});
