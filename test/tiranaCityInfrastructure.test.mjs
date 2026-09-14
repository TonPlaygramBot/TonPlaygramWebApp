import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,nearestNode,route,stepState,interact} from '../webapp/src/games/tiranastreets/shared/engine.mjs';
import {dispatchPolice,nearestAvailableUnit,POLICE_RESPONSE_DELAY} from '../webapp/src/games/tiranastreets/shared/policeDispatch.mjs';
import {BIKE_TYPES,bikeFor} from '../webapp/src/games/tiranastreets/shared/bikeCatalog.mjs';
import {pedestrianIntent} from '../webapp/src/games/tiranastreets/shared/pedestrianBehavior.mjs';
import {ROUNDABOUTS} from '../webapp/src/games/tiranastreets/shared/roundabouts.mjs';
import {junctionPhase,roundaboutGap} from '../webapp/src/games/tiranastreets/shared/junctionControl.mjs';
import {ArrestSimulation} from '../webapp/src/games/tiranastreets/street-career/ArrestSimulation.mjs';
const original=createState([{id:'local',name:'You'}],'free-roam'),env={nearestNode,route};
const clone=()=>structuredClone(original);
test('the GTI is the enterable starting car and all five bike types populate the city',()=>{
 const s=clone(),p=s.players.local,c=s.cars.find(c=>c.id==='car-local');assert.equal(c.collectionVehicle,'golf-gti');assert.ok(Math.hypot(c.x-p.x,c.z-p.z)<6);
 s.elapsed=1;interact(s,p.id,'vehicle');assert.equal(p.carId,c.id);
 for(const b of BIKE_TYPES)assert.ok(s.traffic.filter(c=>bikeFor(c)?.id===b.id).length>=100,b.id);
 assert.equal(s.npcs.filter(n=>n.role==='traffic-controller').length,ROUNDABOUTS.length);
});
test('dispatch delays, ranks existing road routes, and never moves or replaces a unit',()=>{
 const s=clone(),p=s.players.local,ids=s.units.map(u=>u.id),positions=s.units.map(u=>[u.x,u.z]),crew=s.npcs.filter(n=>n.unit).map(n=>n.id);
 p.wanted=65;dispatchPolice(s,env);assert.equal(s.units.filter(u=>u.target).length,0);
 const expected=nearestAvailableUnit(s.units,p,env).unit.id;
 s.elapsed=POLICE_RESPONSE_DELAY;dispatchPolice(s,env);assert.deepEqual(s.units.filter(u=>u.target).map(u=>u.id),[expected]);
 assert.deepEqual(s.units.map(u=>[u.x,u.z]),positions);
 p.wanted=450;s.elapsed+=4;dispatchPolice(s,env);assert.ok(s.units.some(u=>u.id===expected&&u.target===p.id));
 assert.deepEqual(s.units.map(u=>u.id),ids);assert.deepEqual(s.npcs.filter(n=>n.unit).map(n=>n.id),crew);
 p.wanted=0;dispatchPolice(s,env);assert.equal(s.units.filter(u=>u.target).length,0);assert.deepEqual(s.units.map(u=>u.id),ids);
});
test('unreachable nearby units cannot outrank a reachable patrol',()=>{
 const unit=(id,x)=>({id,x,z:0,role:'patrol',duty:'patrol',driver:'npc'}),units=[unit('blocked',1),unit('ready',10)];
 const e={nearestNode:x=>x,route:a=>a===1?[]:[{x:a,z:0},{x:20,z:0}]};
 assert.equal(nearestAvailableUnit(units,{x:20,z:0,wanted:65},e).unit.id,'ready');
 units[1].driver='player';assert.equal(nearestAvailableUnit(units,{x:20,z:0,wanted:65},e),null);
});
test('a real response moves continuously and dismounts only after reaching the incident',()=>{
 const s=clone(),p=s.players.local,u=s.units.find(u=>!u.stationId&&u.forceVehicle==='patrol_sedan');
 const end=route(nearestNode(u.x,u.z),nearestNode(u.x,u.z+60));assert.ok(end.length);
 Object.assign(p,end.at(-1),{wanted:65,lastCrime:1e9});s.traffic=[];s.cars=[];s.npcs=s.npcs.filter(n=>n.unit===u.id);s.units=[u];
 dispatchPolice(s,env);s.elapsed=4;dispatchPolice(s,env);
 let travelled=0,arrived=false;
 for(let i=0;i<4200;i++){const x=u.x,z=u.z;stepState(s);const delta=Math.hypot(u.x-x,u.z-z);assert.ok(delta<=12/60+.001);travelled+=delta;if(s.npcs.some(n=>n.deployed)){arrived=true;break;}}
 assert.ok(travelled>5);assert.ok(arrived);assert.ok(Math.hypot(u.x-p.x,u.z-p.z)<24);
});
test('custody reuses station vehicles and their crew, retaining them when released',()=>{
 const s=clone(),sim={state:s,player:s.players.local,body:{}};const arrest=new ArrestSimulation(sim),ids=s.units.map(u=>u.id),npcs=s.npcs.length;
 assert.equal(arrest.dispatch(),true);const van=arrest.van,position={x:van.x,z:van.z};assert.ok(van.stationId);assert.equal(van.driver,'custody');
 arrest.backupOfficers();assert.equal(s.npcs.length,npcs);assert.deepEqual({x:van.x,z:van.z},position);
 arrest.release('');assert.equal(van.duty,'returning');assert.deepEqual(s.units.map(u=>u.id),ids);assert.equal(s.npcs.length,npcs);
});
test('pedestrians yield to an approaching vehicle and resume across connected paths',()=>{
 const n={id:'walker',x:0,z:0,motion:'walk',health:100,path:[{x:0,z:0},{x:10,z:0}],pathIndex:1,panicUntil:0},state={elapsed:1,players:{}},world={roads:[{walk:true,a:[10,0],b:[20,0]}]};
 const intent=pedestrianIntent(n,state,[{id:'car',x:1,z:-4,heading:Math.PI,vz:5,w:2,d:4}],[],world);assert.equal(intent.speed,0);assert.equal(n.behavior,'yield');
 assert.ok(pedestrianIntent(n,state,[],[],world).speed>0);n.x=10;pedestrianIntent(n,state,[],[],world);assert.deepEqual(n.path[1],{x:20,z:0});
});
test('roundabout controllers release one approach then allow a clearance interval',()=>{
 const s=ROUNDABOUTS[0],car={x:s.x,z:s.z+s.radius+20,heading:0,d:4.5};
 const green=Array.from({length:28},(_,i)=>i).find(t=>junctionPhase(s,t)==='north-south');
 const red=Array.from({length:28},(_,i)=>i).find(t=>junctionPhase(s,t)==='clear');
 assert.equal(roundaboutGap(car,green),Infinity);assert.ok(Number.isFinite(roundaboutGap(car,red)));
 car.z=s.z+s.radius;assert.equal(roundaboutGap(car,red),Infinity);
});
