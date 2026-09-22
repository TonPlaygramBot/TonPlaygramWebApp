import test from 'node:test';
import assert from 'node:assert/strict';
import { buildingAccessSites, stairTreads, accessCollisionSolids, CAFE_REVOLUTION_SECONDS } from '../webapp/src/games/tiranastreets/shared/buildingAccess.mjs';
import { BuildingAccessSimulation } from '../webapp/src/games/tiranastreets/street-career/BuildingAccessSimulation.mjs';
import { FlightSimulation } from '../webapp/src/games/tiranastreets/street-career/FlightSimulation.mjs';
import { StreetWorld } from '../webapp/src/games/tiranastreets/street-career/spatialCore.mjs';
import { createBody, stepMotor, MOTOR } from '../webapp/src/games/tiranastreets/street-career/playerCore.mjs';
import { BRIDGE, tabakeveBridgeHeight } from '../webapp/src/games/tirana-tabakeve/quarterCore.mjs';
const sites=buildingAccessSites(),world=new StreetWorld();
function fixture(w=world, selected=sites){
 const state={elapsed:0,pickups:[],cars:[],traffic:[],units:[],helicopter:{id:'test-heli'},players:{}},body=createBody();
 const player={id:'local',x:0,z:0,heading:0,health:100,inventory:{},speed:0};state.players.local=player;
 const sim={state,player,body,world:w,intent:{x:0,y:0,yaw:0,pitch:0,fire:false},events:[],event(kind,data){this.events.push({kind,...data});},eye(){return {x:player.x,y:body.y+body.eye,z:player.z};},damage(_p,amount){player.health-=amount;}};
 sim.access=new BuildingAccessSimulation(sim,selected);return sim;
}
const place=(sim,p)=>{Object.assign(sim.player,{x:p.x,z:p.z});Object.assign(sim.body,{y:p.y,vy:0,grounded:true,interaction:'free'});};
const finish=sim=>{for(let i=0;i<1800&&sim.access.travel;i++){sim.state.elapsed+=1/60;sim.access.step(1/60);}assert.equal(sim.access.travel,null);};
test('selected public interiors, street exits, roof exits and equipment share clear supported locations',()=>{
 assert.ok(sites.filter(s=>s.stairs).length>=5);
 for(const s of sites){
  for(const p of [s.entrance,s.lobbyPoint,s.roof])assert.ok(world.clearance(p,1.78),`${s.name}: clear ${JSON.stringify(p)}`);
  assert.ok(Math.abs(world.surface(s.equipment.x,s.equipment.z,s.equipment.y+.1)-s.roofY)<.05,`${s.name}: equipment is supported`);
 }
});
test('Sky elevator performs street → lobby → café → lobby → street without teleport boarding or trapped egress',()=>{
 const sim=fixture(),s=sites.find(s=>s.kind==='cafe');
 const use=kind=>{const a=sim.access.candidates().find(a=>a.kind===kind);assert.ok(a,kind);assert.ok(sim.access.execute(a),kind);finish(sim);};
 place(sim,s.entrance);use('access-enter');assert.equal(sim.body.y,s.interiorY);
 place(sim,{...s.lobbyPoint,x:s.center.x-s.half+1});use('access-up');assert.equal(sim.body.y,s.roofY);
 use('access-down');assert.equal(sim.body.y,s.interiorY);use('access-leave');assert.equal(sim.body.y,s.entrance.y);
 assert.ok(world.clearance({...sim.player,y:sim.body.y},MOTOR.standing));
 const loot=sim.state.pickups.find(l=>l.id==='sky-cafe-sniper');assert.ok(loot);assert.equal(loot.y,s.roofY+.55);
});
test('roof equipment and elevators cannot be activated from the same horizontal point on the street',()=>{
 const sim=fixture(),s=sites.find(s=>s.roofY>100);
 place(sim,{...s.equipment,y:.08});assert.ok(!sim.access.candidates().some(a=>a.kind==='access-equipment'));
 place(sim,{...s.roof,y:.08});assert.ok(!sim.access.candidates().some(a=>a.kind==='access-down'));
 place(sim,{...s.equipment,y:s.roofY});const a=sim.access.candidates().find(a=>a.kind==='access-equipment');assert.ok(a);assert.ok(sim.access.execute(a));assert.equal(sim.access.parachute.packed,true);
 assert.ok(sim.access.execute(a));assert.equal(sim.access.binoculars,true);
 sim.intent.x=.5;sim.access.step(1/60);assert.equal(sim.access.binoculars,false);
});
test('physical switchback treads climb to a connected roof exit with the normal step limit',()=>{
 for(const s of sites.filter(s=>s.stairs)){
  const steps=stairTreads(s).filter(t=>!t.id.endsWith(':top')&&!t.id.endsWith(':roof-bridge')&&!t.id.endsWith(':roof-walkway'));
  const first=steps[0],p={x:first.x,y:s.interiorY,z:first.z+.8};
  for(const t of steps){
   world.move(p,t.x-p.x,t.z-p.z,1.78,MOTOR.step);
   assert.ok(Math.hypot(p.x-t.x,p.z-t.z)<.16,`${s.name}: reaches ${t.id} at ${JSON.stringify(p)}`);
   assert.ok(Math.abs(p.y-t.y)<.23,`${s.name}: supported on ${t.id}: ${p.y} vs ${t.y}`);
  }
  const last=steps.at(-1);for(const target of [{x:s.center.x+s.half-.5,z:last.z},{x:s.center.x+s.half-.5,z:s.center.z},{x:s.equipment.x,z:s.equipment.z}]){
   world.move(p,target.x-p.x,target.z-p.z,1.78,.28);assert.ok(world.surface(p.x,p.z,p.y+.02)>=s.roofY-.02,`${s.name}: continuous roof exit`);
  }
 }
});
test('canopy deployment is height-gated, steers, consumes a pack and safely lands on world collision',()=>{
 const flat=new StreetWorld([],false),sim=fixture(flat,[]);place(sim,{x:0,z:0,y:25});sim.body.grounded=false;sim.body.vy=-20;sim.access.parachute.packed=true;
 const action=sim.access.actions().find(a=>a.id==='parachute');assert.ok(action);assert.ok(sim.access.execute(action));assert.equal(sim.access.parachute.packed,false);
 const startZ=sim.player.z;
 for(let i=0;i<1800&&sim.access.parachute.open;i++){sim.state.elapsed+=1/60;sim.access.step(1/60);}
 assert.equal(sim.access.parachute.open,false);assert.ok(sim.body.grounded);assert.equal(sim.player.health,100);assert.ok(sim.player.z<startZ);assert.ok(sim.events.some(e=>e.kind==='parachute-land'));
 place(sim,{x:0,z:0,y:.08});sim.access.parachute.packed=true;assert.ok(!sim.access.actions().some(a=>a.id==='parachute'));
});
test('commercial aircraft require rooftop height and exit on that same roof',()=>{
 const sim=fixture();const flight=new FlightSimulation(sim);sim.flight=flight;
 const heli=flight.aircraft.find(a=>a.civilian);assert.ok(heli);assert.equal(heli.missiles,0);
 const entry=flight.access(heli);place(sim,{...entry,y:.08});assert.equal(flight.board(heli.id),false);
 place(sim,entry);assert.equal(flight.board(heli.id),true);assert.equal(flight.exit(),true);assert.ok(Math.abs(sim.body.y-heli.roofY)<.2);
});
test('revolving café carries a standing diner while the central service floor stays fixed',()=>{
 const sim=fixture(),s=sites.find(s=>s.kind==='cafe');place(sim,{x:s.center.x+10,z:s.center.z,y:s.roofY});const before={x:sim.player.x,z:sim.player.z};
 sim.access.step(1);assert.ok(Math.hypot(sim.player.x-before.x,sim.player.z-before.z)>.01);
 place(sim,{x:s.center.x,z:s.center.z,y:s.roofY});sim.access.step(1);assert.equal(sim.player.x,s.center.x);assert.equal(sim.player.z,s.center.z);assert.equal(CAFE_REVOLUTION_SECONDS,3600);
});
test('the hump-backed Tabakëve footbridge is physically traversable with the normal player motor',()=>{
 const c=Math.cos(BRIDGE.yaw),s=Math.sin(BRIDGE.yaw),p={x:BRIDGE.x-c*11.6,z:BRIDGE.z-s*11.6,heading:0,speed:0};
 const body=createBody(),state={elapsed:0},intent={x:0,y:1,yaw:Math.atan2(-c,-s),pitch:0};body.y=world.surface(p.x,p.z,.5);let highest=body.y,damage=0;
 for(let i=0;i<270;i++){state.elapsed+=1/60;stepMotor(state,p,body,intent,1/60,world,()=>{},n=>{damage+=n;});highest=Math.max(highest,body.y);}
 assert.ok(highest>4);assert.ok((p.x-BRIDGE.x)*c+(p.z-BRIDGE.z)*s>BRIDGE.length/2);assert.equal(damage,0);assert.ok(body.grounded);
});
