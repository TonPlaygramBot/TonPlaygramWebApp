import test from 'node:test';
import assert from 'node:assert/strict';
import {createState, MISSIONS, movePlayer} from '../webapp/src/games/tiranastreets/shared/engine.mjs';
import {WEAPONS,STARTER_WEAPON} from '../webapp/src/games/tiranastreets/shared/weapons.mjs';
import {StreetSimulation} from '../webapp/src/games/tiranastreets/street-career/StreetSimulation.mjs';
import {StreetWorld} from '../webapp/src/games/tiranastreets/street-career/spatialCore.mjs';
import {createCampaign} from '../webapp/src/games/tiranastreets/street-career/campaignCore.mjs';
import {captureCheckpoint,restoreCheckpoint} from '../webapp/src/games/tiranastreets/street-career/checkpointCore.mjs';
import {takeVehicle} from '../webapp/src/games/tiranastreets/street-career/vehicleCore.mjs';
import {groundHeight} from '../webapp/src/games/tirana-east/terrainCore.mjs';
import {drivingScale} from '../webapp/src/games/tiranastreets/shared/drivingScale.mjs';
import {pursuitGoal} from '../webapp/src/games/tiranastreets/shared/forceTactics.mjs';
import {sectorSpawns,zoneRadius,OPERATIONS,finishOperation} from '../webapp/src/games/blackwater/shared/battlefield.mjs';
import {BATTLEFIELD_MAPS,OBSTACLES} from '../webapp/src/games/blackwater/shared/layout.mjs';
import {collides} from '../webapp/src/games/blackwater/shared/physics.mjs';
import {createBrain,thinkBot} from '../webapp/src/games/blackwater/shared/botBrain.mjs';
import {makeMatch,stepMatch,publicMatch,MATCH_LIMIT} from '../webapp/src/games/blackwater/shared/match.mjs';
const campaign=createCampaign(MISSIONS,WEAPONS,STARTER_WEAPON);
function sim(){const s=createState([{id:'local',name:'Pilot'}],'free-roam','solo'),sim=new StreetSimulation(s,new StreetWorld([],false));s.npcs=[];s.cars=[];s.traffic=[];s.units=[];s.nextDispatch=1e9;return sim;}
const car=(id,x,z)=>({id,x,z,heading:0,speed:0,vx:0,vz:0,steering:0,model:'sedan',driver:null});
test('contacts unlock independent ground and flight stories and survive a save reload',()=>{
 const profile=campaign.fresh();profile.completed=['first-shift'];
 for(const id of ['express','rinia-rescue','air-rescue','lana-run'])assert.ok(campaign.begin(profile,id),id);
 assert.equal(campaign.begin(profile,'sky-patrol'),null);
 profile.completed.push('air-rescue');const restored=campaign.normalize(JSON.parse(JSON.stringify(profile)));
 assert.ok(campaign.begin(restored,'sky-patrol'));assert.deepEqual(restored.completed,['first-shift','air-rescue']);
});
test('all district spawns are local, separated and outside city collision',()=>{
 for(const map of BATTLEFIELD_MAPS){const points=sectorSpawns(map.id,7);assert.equal(points.length,7,map.id);for(const p of points){assert.ok(!collides(p.x,p.z,.65,OBSTACLES),map.id);assert.ok(Math.hypot(p.x-map.start.x,p.z-map.start.z)>=24-.001);assert.ok(Math.hypot(p.x-map.start.x,p.z-map.start.z)<75);}}
});
test('bots acquire other bots, respect occlusion and reload before firing again',()=>{
 const brain=createBrain('a'),self={id:'a',x:0,z:0,hp:100},other={id:'b',x:3,z:0,hp:100},player={id:'player',x:8,z:0,hp:100};
 assert.equal(thinkBot(brain,self,[other,player],1,.1,()=>true,self).target.id,'b');
 assert.equal(thinkBot(brain,self,[other,player],1.8,.1,()=>true,self).fire,true);
 brain.ammo=0;assert.equal(thinkBot(brain,self,[other],2,.1,()=>true,self).fire,false);
 assert.equal(thinkBot(brain,self,[other],2.1,.1,()=>false,self).target,null);
 assert.deepEqual(thinkBot(brain,self,[{...other,x:30}],20,3,()=>false,{x:1,z:1}).goal,{x:1,z:1});
});
test('online last stand never respawns and awards only the surviving player',()=>{
 const match=makeMatch([{id:'a',name:'A'},{id:'b',name:'B'},{id:'c',name:'C'}],{rule:'last-stand'});
 match.players[0].hp=0;for(let i=0;i<100;i++)stepMatch(match,.05);
 assert.equal(match.players[0].hp,0);assert.equal(match.done,false);match.players[1].hp=0;stepMatch(match,.05);
 assert.equal(match.winnerAccountId,'c');assert.equal(publicMatch(match).alive,1);
});
test('unresolved last stand times out to a refund and operation rewards require the next win',()=>{
 const m=makeMatch([{id:'a'},{id:'b'}],{rule:'last-stand'});m.elapsed=MATCH_LIMIT;stepMatch(m,.05);
 assert.equal(m.reason,'tie_refund');assert.equal(m.winnerAccountId,'');
 assert.deepEqual(finishOperation({},OPERATIONS[1].id,true).completed,[]);
 assert.deepEqual(finishOperation({},OPERATIONS[0].id,false).completed,[]);
 assert.equal(finishOperation({},OPERATIONS[0].id,true).completed.length,1);
 assert.ok(zoneRadius(190)<zoneRadius(30));assert.equal(zoneRadius(1000),8);
});
test('police intercept observed motion then search a remembered location',()=>{
 const units=[0,1,2].map(i=>({id:String(i),x:0,z:0})),target={x:10,z:20,heading:0,speed:20};
 const orders=units.map(u=>pursuitGoal(u,target,units,1,true));assert.equal(orders[0].role,'pursue');assert.equal(orders[1].role,'intercept');assert.notEqual(orders[1].goal.x,orders[2].goal.x);
 const a=pursuitGoal(units[1],{x:999,z:999},units,3,false);assert.equal(a.role,'search');assert.ok(Math.hypot(a.goal.x-10,a.goal.z-20)<20);
 assert.equal(pursuitGoal(units[1],target,units,40,false).role,'hold');
});
test('police bikes and armored vans transfer ownership only once and cannot be stolen while burning',()=>{
 const s=sim(),p=s.player;for(const model of ['traffic_bike','patrol_sedan','renea_armored_van']){
 const c={...car(model,p.x+3,p.z),forceVehicle:model,driver:'npc'};s.state.units.push(c);p.carId=null;
 assert.equal(takeVehicle(s.state,p,c),true);assert.ok(!s.state.units.includes(c));assert.equal(s.state.cars.filter(v=>v.id===c.id).length,1);assert.equal(takeVehicle(s.state,p,c),false);
 }
 p.carId=null;const c={...car('burning',p.x+3,p.z),burning:true};s.state.cars.push(c);assert.equal(takeVehicle(s.state,p,c),false);
});
test('vehicle burning emits numeric ordered events and one explosion per wreck',()=>{
 const s=sim(),c=car('target',s.player.x+40,s.player.z);s.state.cars.push(c);
 c.driver=s.player.id;s.player.carId=c.id;s.player.armor=100;
 s.combat.damageVehicle(c,100);assert.equal(c.burning,true);s.combat.damageVehicle(c,100);s.combat.damageVehicle(c,100);
 assert.equal(c.destroyed,true);assert.equal(s.player.carId,null);assert.notEqual(s.body.interaction,'driving');assert.equal(s.state.effects.filter(e=>e.kind==='vehicle-explosion').length,1);
 assert.ok(s.state.effects.every(e=>Number.isInteger(e.id)));assert.equal(new Set(s.state.effects.map(e=>e.id)).size,s.state.effects.length);
});
test('missiles sweep the flight segment, fracture only the impact section and keep upper floors solid',()=>{
 const s=sim(),floor=groundHeight(0,0),wall={id:'wall',p:[[-10,-22],[10,-22],[10,-20],[-10,-20]],h:floor+25,minY:floor};
 s.world=new StreetWorld([wall],false);const a={x:0,z:0,y:floor+8,kind:'jet',pilot:'local',missiles:2,nextMissile:0};
 assert.equal(s.combat.launch(a,0,0),true);assert.equal(s.combat.launch(a,0,0),false);
 for(let i=0;i<40;i++){s.state.elapsed+=1/60;s.combat.step(1/60);}
 assert.equal(s.combat.missiles.length,0);assert.equal(s.world.fractures.length,1);
 assert.equal(s.world.cast({x:0,y:floor+8,z:0},{x:0,y:0,z:-1},21).kind,'air');
 assert.equal(s.world.cast({x:0,y:floor+18,z:0},{x:0,y:0,z:-1},30).kind,'wall');
});
test('both aircraft board, climb, fire and refuse an airborne exit; flight checkpoints restore ownership',()=>{
 for(const kind of ['helicopter','jet']){
 const s=sim(),a=s.flight.aircraft.find(a=>a.kind===kind),access=s.flight.access(a);Object.assign(s.player,access);
 assert.equal(s.flight.board(a.id),true,kind);s.intent.fast=true;s.flight.step(1);s.intent.fast=false;
 assert.ok(a.airborne,kind);assert.equal(s.flight.exit(),false);const old=a.missiles;s.intent.fire=true;s.flight.step(.05);assert.equal(a.missiles,old-1);
 const checkpoint=captureCheckpoint(s);assert.equal(checkpoint.aircraft.kind,kind);const next=sim();
 assert.ok(restoreCheckpoint(next,checkpoint,campaign.apply));assert.equal(next.flight.current.kind,kind);assert.equal(next.flight.current.pilot,next.player.id);
 }
});
test('faster car classes retain capped reverse speed and working brakes',()=>{
 assert.ok(drivingScale({model:'sedan'}).maximum*3.6>=110);assert.ok(drivingScale({model:'sport'}).maximum>drivingScale({model:'sedan'}).maximum);
 assert.equal(drivingScale({model:'sedan'}).reverse*3.6,20);
 const s=sim(),p=s.player,c=car('driver',p.x,p.z);c.driver=p.id;c.speed=20;s.state.cars.push(c);p.carId=c.id;p.inputAt=s.state.elapsed;p.input={x:0,y:0,brake:true};movePlayer(s.state,p,.1);assert.ok(c.speed<20);
});
