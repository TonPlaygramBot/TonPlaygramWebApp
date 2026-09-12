import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,advanceState,interact,emptyInput,movePlayer,publicState} from '../webapp/src/games/tiranastreets/shared/engine.mjs';
import {collectWeapon,dropWeapon,nearestShop} from '../webapp/src/games/tiranastreets/shared/cityPopulation.mjs';
import {trafficDecision,updateTraffic,redSignalGap} from '../webapp/src/games/tiranastreets/shared/trafficSimulation.mjs';
import {SIGNALS,signalPhase} from '../webapp/src/games/tiranastreets/shared/streetLayout.mjs';
import {harm,lifeAction} from '../webapp/src/games/tiranastreets/shared/cityLife.mjs';
import {driverEye} from '../webapp/src/games/tiranastreets/shared/driverView.mjs';
import {takeVehicle,exitPoint,vehicleAnchors,carPoint} from '../webapp/src/games/tiranastreets/street-career/vehicleCore.mjs';
import {StreetSimulation} from '../webapp/src/games/tiranastreets/street-career/StreetSimulation.mjs';
const state=()=>createState([{id:'local',name:'You'}],'free-roam');
test('population persists, uses a varied fleet, and every bus has passengers',()=>{
 const s=state();assert.equal(s.traffic.filter(c=>c.model!=='tirana-bus').length,2000);assert.equal(s.traffic.filter(c=>c.model==='tirana-bus').length,30);assert.equal(s.shops.length,15);assert.equal(s.pickups.length,300);assert.ok(s.npcs.length>=600);
 assert.equal(new Set(s.pickups.map(p=>`${p.x},${p.z}`)).size,300);assert.ok(new Set(s.traffic.map(c=>c.model)).size>=6);
 assert.ok(s.traffic.filter(c=>c.model==='tirana-bus').every(c=>c.passengers.length>=12));
 const ids=s.traffic.map(c=>c.id);advanceState(s,1);assert.deepEqual(s.traffic.map(c=>c.id),ids);assert.ok(s.traffic.filter(c=>c.speed>.1).length>1500);
 for(const c of s.traffic)assert.ok(Number.isFinite(c.x+c.z+c.speed));
 assert.equal(publicState(s).pickups.length,300);
});
test('all stores accept existing street purchases at their own location',()=>{
 const s=state(),p=s.players.local;
 for(const shop of s.shops){Object.assign(p,shop,{cash:1000,health:50,wanted:0});lifeAction(s,p,'buy:medkit');assert.equal(p.health,100);assert.equal(p.cash,910);assert.equal(nearestShop(s,p).id,shop.id);}
});
test('armed police and civilian deaths drop the actual weapon exactly once; collection is atomic',()=>{
 const s=state(),p=s.players.local,env={};
 for(const kind of ['police','civilian']){
  const n={id:kind,kind,health:100,x:p.x+1,z:p.z,weapon:'ak47VolleyAttack'};
  harm(s,n,100,p,env);harm(s,n,100,p,env);const drops=s.pickups.filter(l=>l.id.startsWith('drop:'+kind));assert.equal(drops.length,1);assert.equal(drops[0].weapon,n.weapon);
  assert.equal(collectWeapon(s,p,drops[0].id),true);const ammo=p.inventory[n.weapon].reserve;assert.equal(collectWeapon(s,p,drops[0].id),false);assert.equal(p.inventory[n.weapon].reserve,ammo);
 }
 const l=s.pickups.find(l=>l.source==='city');Object.assign(p,{x:l.x+10,z:l.z});assert.equal(collectWeapon(s,p,l.id),false);Object.assign(p,l,{carId:'occupied'});assert.equal(collectWeapon(s,p,l.id),false);
});
test('red-light stop uses the front bumper, green releases traffic, pedestrians and queues constrain speed',()=>{
 const signal=SIGNALS[0],car={id:'c',model:'sedan',heading:signal.yaw,speed:8,cruise:10,x:signal.x+Math.sin(signal.yaw)*15,z:signal.z+Math.cos(signal.yaw)*15};
 const red=Array.from({length:32},(_,i)=>i).find(t=>signalPhase(signal,t)==='red'),green=Array.from({length:32},(_,i)=>i).find(t=>signalPhase(signal,t)==='green');
 assert.ok(redSignalGap(car,red)>0);assert.equal(redSignalGap(car,green),Infinity);
 const fx=-Math.sin(car.heading),fz=-Math.cos(car.heading),ped={x:car.x+fx*6,z:car.z+fz*6,health:100};
 assert.equal(trafficDecision(car,[],[ped],green).reason,'pedestrian');assert.ok(trafficDecision(car,[],[ped],green).target<car.cruise);
 assert.equal(trafficDecision(car,[{...car,id:'other',x:car.x+fx*5,z:car.z+fz*5}],[],green).target,0);
});
test('bus can be taken, driven, and exited through the front cabin',()=>{
 const s=state(),p=s.players.local,bus=s.traffic.find(c=>c.model==='tirana-bus');Object.assign(p,carPoint(bus,vehicleAnchors(bus).doors[0]));
 assert.equal(takeVehicle(s,p,bus),true);assert.equal(s.traffic.includes(bus),false);assert.equal(s.cars.filter(c=>c.id===bus.id).length,1);
 const eye=driverEye(bus);assert.ok(Math.hypot(eye.x-bus.x,eye.z-bus.z)>7);assert.ok(exitPoint(s,bus,{surface:()=>.08,clearance:()=>true,clear:()=>true}));
 const old={x:bus.x,z:bus.z};p.input={...emptyInput(),y:1};p.inputAt=s.elapsed;movePlayer(s,p,.05);assert.ok(bus.speed>0);assert.ok(Math.hypot(old.x-bus.x,old.z-bus.z)>0);
});
test('street career shares the world pickup list and exposes pickup interaction',()=>{
 const s=state(),world={clear:()=>true,clearance:()=>true,surface:()=>.08};const sim=new StreetSimulation(s,world),p=sim.player,item=s.pickups[0];Object.assign(p,{x:item.x,z:item.z+1.5});sim.body.yaw=0;sim.body.pitch=-.65;
 assert.equal(sim.loot,s.pickups);assert.ok(sim.candidates().some(c=>c.targetId===item.id&&c.kind==='loot'));
 sim.finishInteract({targetId:item.id});assert.equal(item.collected,true);assert.equal(p.weapon,item.weapon);
});
test('bus interaction commits at the front door and collisions include the full bus body', async()=>{
 const {vehicleSeparation}=await import('../webapp/src/games/tiranastreets/shared/trafficSimulation.mjs');
 const s=state(),sim=new StreetSimulation(s,{clear:()=>true,clearance:()=>true,surface:()=>.08}),bus=s.traffic.find(c=>c.model==='tirana-bus');
 Object.assign(sim.player,carPoint(bus,vehicleAnchors(bus).doors[1]));sim.finishEnter({targetId:bus.id,side:1});assert.equal(sim.player.carId,bus.id);
 const a={id:'bus',model:'tirana-bus',x:0,z:0,heading:0},b={id:'car',model:'sedan',x:0,z:-9.5,heading:0};
 const delta=vehicleSeparation(a,b);assert.ok(delta);Object.assign(a,{x:a.x+delta.x,z:a.z+delta.z});assert.equal(vehicleSeparation(a,b),null);
});
test('all shop walls block movement and sight while their entrances remain open',async()=>{
 const {StreetWorld}=await import('../webapp/src/games/tiranastreets/street-career/spatialCore.mjs');const {shopObstacles}=await import('../webapp/src/games/tiranastreets/shared/cityPopulation.mjs');
 const s=state(),world=new StreetWorld(shopObstacles(),false);
 for(const shop of s.shops){assert.equal(world.clearance({x:shop.x+6.4,y:.18,z:shop.z-3},1.78),false);assert.equal(world.clearance({x:shop.x,y:.18,z:shop.z+1},1.78),true);assert.equal(world.clear({x:shop.x+8,y:1.7,z:shop.z-3},{x:shop.x,y:1.7,z:shop.z-3}),false);}
});
test('a sudden pedestrian incursion can cause an impact instead of an instant impossible stop',()=>{
 const s=state(),car=s.traffic.find(c=>c.model==='sedan'),fx=-Math.sin(car.heading),fz=-Math.cos(car.heading);
 s.traffic=[car];s.cars=[];s.units=[];s.players={};s.npcs=[{id:'late-crossing',kind:'civilian',health:100,x:car.x+fx*2.6,z:car.z+fz*2.6}];car.speed=10;car.cruise=10;
 let hits=0;updateTraffic(s,.05,(n,damage)=>{hits++;n.health-=damage;});assert.equal(hits,1);assert.ok(s.npcs[0].health<100);assert.ok(car.speed>0);
});
