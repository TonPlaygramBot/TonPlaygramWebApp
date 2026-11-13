import test from 'node:test';
import assert from 'node:assert/strict';
import {driveVehicle} from '../webapp/src/games/tiranastreets/shared/vehicleDynamics.mjs';
import {navigationGuidance, nearbyServices, formatRouteDistance} from '../webapp/src/games/tiranastreets/map/navigationGuidance.mjs';

const car=(extra={})=>({id:'test',model:'sedan',x:0,z:0,heading:0,speed:20,vx:0,vz:-20,steering:0,...extra});
test('steering transforms both momentum components without creating coasting energy',()=>{
  const c=car({vx:12,steering:1,yawRate:-.3});
  for(let i=0;i<240;i++){
    const before=Math.hypot(c.vx,c.vz);
    driveVehicle(c,{x:1,y:0},1/120);
    assert.ok(Math.hypot(c.vx,c.vz)<=before+1e-9,`energy increased at ${i}`);
  }
});
test('a fully stopped car never pivots from residual yaw and stick noise recentres',()=>{
  const c=car({speed:0,vx:0,vz:0,steering:1,yawRate:-.7,heading:.6});
  for(let i=0;i<120;i++)driveVehicle(c,{x:.02,y:0,brake:true},1/60);
  assert.equal(c.heading,.6);assert.equal(c.speed,0);assert.ok(Math.abs(c.steering)<1e-7);assert.equal(c.yawRate,0);
});
test('reverse steering has the correct screen direction without changing the forward control',()=>{
  const forward=car({speed:4,vz:-4}),reverse=car({speed:-4,vz:4});
  for(let i=0;i<30;i++){
    driveVehicle(forward,{x:1,y:1},1/60);driveVehicle(reverse,{x:1,y:-1},1/60);
  }
  assert.ok(forward.heading<0);assert.ok(reverse.heading>0);
  assert.ok(forward.x>0);assert.ok(reverse.x>0);
});
test('turn labels follow the direction visible on the north-up phone map',()=>{
  const routes=[
    [[0,100],[0,0],[100,0],'right'],
    [[0,100],[0,0],[-100,0],'left'],
    [[0,-100],[0,0],[100,0],'left'],
    [[0,-100],[0,0],[-100,0],'right']
  ];
  for(const [a,b,c,direction] of routes){
    const route=[a,b,c].map(([x,z])=>({x,z}));
    const g=navigationGuidance(route,route[0],route[2]);
    assert.equal(g.direction,direction);assert.equal(g.nextDistance,100);assert.equal(g.remaining,200);
  }
});
test('distance follows the remaining polyline and advances past completed turns',()=>{
  const route=[{x:0,z:100},{x:0,z:0},{x:100,z:0},{x:100,z:-80}],end=route.at(-1);
  const before=navigationGuidance(route,{x:0,z:40},end,'drive');
  assert.equal(before.remaining,220);assert.equal(before.nextDistance,40);assert.equal(before.direction,'right');
  const after=navigationGuidance(route,{x:40,z:0},end,'drive');
  assert.equal(after.remaining,140);assert.equal(after.nextDistance,60);assert.equal(after.direction,'left');
});
test('road-end guidance does not claim arrival before the actual entrance',()=>{
  const route=[{x:0,z:0},{x:100,z:0}],destination={x:100,z:35};
  const g=navigationGuidance(route,{x:98,z:0},destination,'drive');
  assert.equal(g.arrived,false);assert.equal(g.instruction,'Park, then walk to the entrance');assert.equal(g.accessDistance,35);
  assert.equal(navigationGuidance(route,{x:100,z:33},destination).arrived,true);
});
test('off-route and disconnected destinations give explicit guidance without fake routes',()=>{
  const route=[{x:0,z:0},{x:100,z:0}],end=route.at(-1);
  assert.equal(navigationGuidance(route,{x:20,z:45},end,'drive').direction,'rejoin');
  const missing=navigationGuidance([],{x:20,z:45},end,'drive');
  assert.equal(missing.direction,'unavailable');assert.equal(missing.etaSeconds,null);
  assert.equal(navigationGuidance(route,{x:NaN,z:0},end),null);
  assert.equal(navigationGuidance(route,{x:20,z:45},null),null);
});
test('duplicate/invalid route vertices remain safe and nearby services do not mutate source order',()=>{
  const g=navigationGuidance([{x:0,z:0},{x:0,z:0},{x:NaN,z:2},{x:100,z:0}],{x:30,z:0},{x:100,z:0});
  assert.equal(g.remaining,70);assert.equal(g.direction,'straight');
  const places=[{id:'far',x:100,z:0},{id:'near',x:10,z:0},{id:'closed',x:1,z:0,available:false}];
  const sorted=nearbyServices(places,{x:0,z:0});
  assert.deepEqual(sorted.map(p=>p.id),['near','far']);assert.equal(sorted[0].distance,10);assert.equal(places[0].id,'far');
  assert.equal(formatRouteDistance(1520),'1.5 km');assert.equal(formatRouteDistance(84.1),'84 m');
});
