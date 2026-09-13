import test from 'node:test';
import assert from 'node:assert/strict';
import {vehicleOverlapsPolygon,vehiclePolygonContact,slideVehicle} from '../webapp/src/games/tiranastreets/shared/vehicleContacts.mjs';
import {crashResponse} from '../webapp/src/games/tiranastreets/street-career/CrashSimulation.mjs';
import {vehicleSeparation,trafficDecision,vehicleSize} from '../webapp/src/games/tiranastreets/shared/trafficSimulation.mjs';
import {weaponPose,weaponAnchors} from '../webapp/src/games/tiranastreets/street-career/weaponPose.mjs';
import {WEAPONS} from '../webapp/src/games/tiranastreets/shared/weapons.mjs';
import {direction3} from '../webapp/src/games/tiranastreets/street-career/spatialCore.mjs';
import {rooftopHelicopterSites,roofClearance,ROOFTOP_POOLS} from '../webapp/src/games/tiranastreets/shared/rooftops.mjs';
import {WORLD} from '../webapp/src/games/tiranastreets/shared/world.mjs';
import {steerNPC,friendlyInFiringLane} from '../webapp/src/games/tiranastreets/shared/npcNavigation.mjs';
import {createBrain,thinkBot} from '../webapp/src/games/blackwater/shared/botBrain.mjs';
const car=(extra={})=>({id:'car',model:'sedan',x:0,z:0,heading:0,vx:0,vz:-20,speed:20,...extra});
const edge=vehicleSize(car()).width/2+.05;
const wall={id:'wall',p:[[edge,-20],[3,-20],[3,20],[edge,20]]};
test('5 cm near miss remains clear; a real side contact resolves by centimetres, not the old radius',()=>{
 const c=car();assert.equal(vehicleOverlapsPolygon(c,wall),false);assert.equal(vehiclePolygonContact(c,wall),null);
 c.x=.1;const hit=vehiclePolygonContact(c,wall);assert.ok(hit&&hit.x<0&&Math.abs(hit.x)<.06);assert.ok(Math.abs(hit.z)<1e-10);
 c.x+=hit.x;assert.equal(vehicleOverlapsPolygon(c,wall),false);
});
test('front, rear, rotated bodies and the full bus length have actual footprint contacts',()=>{
 for(const heading of [0,.5,Math.PI/2,Math.PI]){
  const c=car({heading,x:.9});const hit=vehiclePolygonContact(c,wall);assert.ok(hit);
  assert.equal(vehicleOverlapsPolygon({...c,x:c.x+hit.x,z:c.z+hit.z},wall),false);
 }
 const end={p:[[-3,-9.1],[3,-9.1],[3,-8.9],[-3,-8.9]]};
 assert.equal(vehiclePolygonContact(car(),end),null);assert.ok(vehiclePolygonContact(car({model:'tirana-bus'}),end));
 assert.equal(vehicleSeparation(car(),car({id:'near',x:vehicleSize(car()).width+.01})),null);
});
test('courtyards and concave building recesses remain drivable',()=>{
 const courtyard={p:[[-10,-10],[10,-10],[10,10],[-10,10]],holes:[[[-3,-4],[3,-4],[3,4],[-3,4]]]};
 assert.equal(vehiclePolygonContact(car(),courtyard),null);
 const lShape={p:[[-10,-10],[10,-10],[10,-5],[-5,-5],[-5,10],[-10,10]]};
 assert.equal(vehiclePolygonContact(car(),lShape),null);
 const trapped=car({x:4});const hit=vehiclePolygonContact(trapped,courtyard);assert.ok(hit);
 assert.equal(vehicleOverlapsPolygon({...trapped,x:trapped.x+hit.x,z:trapped.z+hit.z},courtyard),false);
});
test('scrapes preserve travel; head-on speed, object mass and relative velocity control damage',()=>{
 const fast=car(),slow=car({vz:-5,speed:5});
 assert.ok(crashResponse(fast,null,{x:0,z:1}).damageA>crashResponse(slow,null,{x:0,z:1}).damageA*10);
 const scrape=crashResponse(car({vx:-1}),null,{x:1,z:0});assert.equal(scrape.damageA,0);assert.equal(scrape.a.z,-20);
 assert.equal(crashResponse(fast,car({id:'convoy'}),{x:0,z:1}),null);
 assert.equal(crashResponse(car({vz:5}),null,{x:0,z:1}),null);
 const bus=crashResponse(fast,car({model:'tirana-bus',vx:0,vz:0,speed:0}),{x:0,z:1});assert.ok(bus.deltaA>bus.deltaB*4);
 const slide=car({vx:-1});slideVehicle(slide,{x:1,z:0});assert.equal(slide.vx,0);assert.equal(slide.vz,-20);assert.equal(slide.speed,20);
});
test('crossing traffic uses projected width/length without stopping for an adjacent parallel car',()=>{
 const driver=car({x:7000,z:5000,cruise:10});
 assert.equal(trafficDecision(driver,[car({id:'adjacent',x:7002.4,z:4995})],[],0).reason,'');
 const crossing=car({id:'crossing',x:7002,z:4993,heading:Math.PI/2});
 assert.equal(trafficDecision(driver,[crossing],[],0).reason,'vehicle');
});
test('all 41 weapons keep their sights exactly on the camera ray at every yaw and pitch',()=>{
 assert.equal(WEAPONS.length,41);
 for(const w of WEAPONS)for(const yaw of [0,.9,Math.PI])for(const pitch of [-1,0,.8]){
  const p={x:12,z:42,weapon:w.id},b={yaw,pitch,y:5,eye:1.6,aim:true,wall:2};
  const pose=weaponPose(p,b),d=direction3(yaw,pitch),eye={x:p.x,y:b.y+b.eye,z:p.z};
  const v={x:pose.sight.x-eye.x,y:pose.sight.y-eye.y,z:pose.sight.z-eye.z};
  assert.ok(Math.hypot(v.y*d.z-v.z*d.y,v.z*d.x-v.x*d.z,v.x*d.y-v.y*d.x)<1e-10,w.id);
  assert.ok(Object.values(pose.muzzle).every(Number.isFinite));assert.ok(pose.anchors.muzzle.z>0);
 }
 assert.equal(weaponAnchors('awpSniperAttack').zoom,6);assert.equal(weaponAnchors('ar15Attack').zoom,3);
});
test('three separate high roofs fit rotor clearance, with pools only at the researched hotels',()=>{
 const sites=rooftopHelicopterSites(WORLD,3);assert.equal(sites.length,3);assert.equal(new Set(sites.map(s=>s.buildingId)).size,3);
 for(const site of sites){const building=WORLD.buildings.find(b=>b.id===site.buildingId);assert.ok(building.h>=35);assert.ok(roofClearance(site,building)>=6);}
 for(const pool of ROOFTOP_POOLS)assert.ok(WORLD.buildings.some(b=>String(b.id)===pool.buildingId));
});
test('NPC detours stay reachable, persist while blocked and yield once the goal is clear',()=>{
 const n={id:'civilian',x:0,z:0},goal={x:10,z:0};
 const clear=(a,b)=>!(Math.min(a.x,b.x)<2&&Math.max(a.x,b.x)>2&&Math.abs(a.z+(b.z-a.z)*(2-a.x)/(b.x-a.x))<2);
 const next=steerNPC(n,goal,clear,0);assert.ok(clear(n,next));assert.notDeepEqual(next,goal);assert.ok(Math.abs(next.z)>1);
 assert.equal(steerNPC(n,goal,clear,.2),next);assert.equal(steerNPC(n,goal,()=>true,.5),goal);
 assert.equal(friendlyInFiringLane(n,goal,[{id:'ally',x:5,z:0,health:100}]),true);
 assert.equal(friendlyInFiringLane(n,goal,[{id:'ally',x:5,z:1,health:100}]),false);
});
test('bots reject unreachable or occupied cover and preserve a newer squad observation over old noise',()=>{
 const brain=createBrain('bot'),self={id:'bot',x:0,z:0,hp:25},target={id:'enemy',x:20,z:0,hp:100};
 const d=thinkBot(brain,self,[target],1,.1,(a)=>a.x===0,self,{covers:[{x:3,z:0},{x:4.5,z:0},{x:6,z:0}],allies:[{id:'friend',x:3,z:0}],canReach:(a,b)=>b.x!==6});
 assert.equal(d.state,'cover');assert.deepEqual(d.goal,{x:4.5,z:0});assert.equal(d.fire,false);
 brain.seenAt=0;thinkBot(brain,self,[],10,.1,()=>false,self,{reports:[{lastSeen:{x:12,z:2},seenAt:9.5}],noise:{x:25,z:0,at:9}});
 assert.deepEqual(brain.lastSeen,{x:12,z:2});
});
