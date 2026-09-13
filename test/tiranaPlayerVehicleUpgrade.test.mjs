import test from 'node:test';
import assert from 'node:assert/strict';
import {CrashSimulation} from '../webapp/src/games/tiranastreets/street-career/CrashSimulation.mjs';
import {tracerSpan} from '../webapp/src/games/tiranastreets/tracerCore.mjs';
import {traceShot} from '../webapp/src/games/tiranastreets/street-career/shotCore.mjs';
import {StreetWorld} from '../webapp/src/games/tiranastreets/street-career/spatialCore.mjs';
import {FlightSimulation} from '../webapp/src/games/tiranastreets/street-career/FlightSimulation.mjs';
import {takeVehicle} from '../webapp/src/games/tiranastreets/street-career/vehicleCore.mjs';
import {StreetSimulation} from '../webapp/src/games/tiranastreets/street-career/StreetSimulation.mjs';
import {playerAssetFor,PLAYER_CATALOG} from '../webapp/src/games/tiranastreets/playerCatalog.mjs';
function crashFixture(){const damage=[],events=[];const sim={state:{elapsed:1,players:{}},player:{id:'local'},combat:{damageVehicle:(c,d)=>damage.push({id:c.id,amount:d}),emit:(...e)=>events.push(e)},event(){},damage(){}};return {crash:new CrashSimulation(sim),sim,damage,events};}
const car=(id,speed,z=0)=>({id,model:'sedan',x:0,z,heading:0,speed,vx:0,vz:-speed,steering:0,health:140});
test('head-on impact shares damage and impulse; resting contact cannot damage repeatedly',()=>{
 const {crash,damage}=crashFixture(),a=car('a',20),b=car('b',-20,-4);
 crash.impact(a,b,{x:0,z:1});assert.equal(damage.length,2);assert.ok(damage.every(d=>d.amount>50));assert.ok(a.vz>0&&b.vz<0);
 crash.impact(a,b,{x:0,z:1});assert.equal(damage.length,2);
});
test('parallel traffic and glancing scrapes do not receive head-on damage; wrecks remain finite',()=>{
 const {crash,damage}=crashFixture(),a=car('a',20),b=car('b',20,-4);
 crash.impact(a,b,{x:0,z:1});crash.impact(a,null,{x:1,z:0});assert.equal(damage.length,0);
 b.destroyed=true;b.speed=b.vz=0;crash.impact(a,b,{x:0,z:1});assert.ok(damage.every(d=>Number.isFinite(d.amount)));
});
test('tracers reach distant hits and never extend past cover even on a late first frame',()=>{
 for(const distance of [.02,.5,10,250])for(const age of [1/120,1/30,2]){const s=tracerSpan(distance,age);assert.ok(s.start>=0&&s.end<=distance);assert.ok(s.length<=5);}
 assert.equal(tracerSpan(250,2).end,250);assert.equal(tracerSpan(.02,1/30).length,.02);
});
test('both combatants share nearest cover/body tests',()=>{
 const world=new StreetWorld([],false),from={x:0,y:1.2,z:0},direction={x:0,y:0,z:-1};
 const actor={id:'target',x:0,y:0,z:-10,health:100};
 assert.equal(traceShot(world,from,direction,30,[],[actor]).target,actor);
 const cover={...car('cover',0,-4),y:0};
 const hit=traceShot(world,from,direction,30,[cover],[actor]);assert.equal(hit.target,null);assert.equal(hit.hit.objectId,'cover');
});
test('police, ambulance and fire vehicles transfer once and clear emergency routing',()=>{
 for(const service of ['police-patrol','ambulance','fire-brigade']){
 const c={...car(service,0),service,npcDriver:true,responseTarget:'patient',responsePhase:'responding',responsePath:[1,2],path:[1]},p={id:'local'};
 const state={traffic:[c],cars:[],units:[],npcs:[]};assert.equal(takeVehicle(state,p,c),true);assert.equal(state.traffic.length,0);assert.equal(state.cars.length,1);assert.equal(c.driver,'local');assert.deepEqual(c.responsePath,[]);assert.equal(c.responseTarget,null);assert.equal(takeVehicle(state,p,c),false);
 }
});
test('aircraft reject moving, airborne and vertically remote boarding; exit does not reload missiles',()=>{
 const world={surface:()=>0,clearance:()=>true},p={id:'local',x:6,z:0,health:100},body={y:0};
 const sim={state:{},player:p,body,world,event(){}};const flight=Object.create(FlightSimulation.prototype);flight.sim=sim;
 const a={id:'jet',kind:'jet',x:0,z:0,y:1.3,heading:0,health:200,speed:3,missiles:2};flight.aircraft=[a];
 assert.equal(flight.board('jet'),false);a.speed=0;a.airborne=true;assert.equal(flight.board('jet'),false);a.airborne=false;body.y=10;assert.equal(flight.board('jet'),false);body.y=0;assert.equal(flight.board('jet'),true);assert.equal(flight.exit(),true);assert.equal(a.missiles,2);
});
test('NPC firearm magazines and reload deadlines use the shared weapon stats',()=>{
 const npc={id:'police',kind:'police',weapon:'glockSidearmAttack',health:100,x:0,y:0,z:0,heading:0};
 const p={id:'local',health:100,x:0,y:0,z:-10,lastDamage:-1};const shots=[];
 const sim={state:{elapsed:1},player:p,body:{y:0,eye:1.68},world:new StreetWorld([],false),cars:()=>[],combat:{emit:(...e)=>shots.push(e)},damage(){}};
 const fire=()=>StreetSimulation.prototype.fireNPC.call(sim,npc,p);
 fire();assert.equal(npc.rounds,15);npc.rounds=0;sim.state.elapsed=2;fire();assert.equal(npc.reloadUntil,3.4);assert.equal(npc.anim,'reload');sim.state.elapsed=3;fire();assert.equal(npc.rounds,0);sim.state.elapsed=3.5;fire();assert.equal(npc.rounds,15);
});
test('only the three supplied local rigs can be selected',()=>{
 assert.deepEqual(PLAYER_CATALOG.map(p=>p.id),['tactical','polish','agent-47']);for(const p of PLAYER_CATALOG)assert.equal(playerAssetFor(p.id,{players:{}}),null);
 for(const id of ['operator','city','forest','sand'])assert.equal(playerAssetFor(id,{players:{[id]:{url:`/assets/tirana-streets/players/${id}.glb`,rigValidated:true}}}),null);
 assert.equal(playerAssetFor('tactical',{players:{tactical:{url:'https://example.com/fake.glb',rigValidated:true}}}),null);
 assert.deepEqual(playerAssetFor('tactical',{players:{tactical:{url:'/assets/tirana-streets/players/tactical.glb',rigValidated:true}}}),{id:'tactical',url:'/assets/tirana-streets/players/tactical.glb'});
});
