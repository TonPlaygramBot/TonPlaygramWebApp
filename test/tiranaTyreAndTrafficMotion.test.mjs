import test from 'node:test';
import assert from 'node:assert/strict';
import {driveVehicle} from '../webapp/src/games/tiranastreets/shared/vehicleDynamics.mjs';
import {drivingScale} from '../webapp/src/games/tiranastreets/shared/drivingScale.mjs';
import {updateTrafficPose} from '../webapp/src/games/tiranastreets/shared/trafficPose.mjs';
import {updateTraffic, lanePoint} from '../webapp/src/games/tiranastreets/shared/trafficSimulation.mjs';
import {WORLD} from '../webapp/src/games/tiranastreets/shared/world.mjs';

const fresh=(extra={})=>({id:'car',model:'sedan',x:0,z:0,heading:0,speed:20,vx:15,vz:-20,steering:0,...extra});

test('collision sideslip recovers within the tyre force budget without gaining energy',()=>{
  for(const model of ['sedan','sport','tirana-bus'])for(const speed of [0,20])for(const brake of [false,true]){
    const car=fresh({model,speed,vz:-speed}),initial=Math.hypot(car.vx,car.vz);
    const grip=drivingScale(car).grip;
    driveVehicle(car,{brake},1/120);
    assert.ok(15-car.vx<=grip/120+1e-9,`${model}: no instantaneous sideways grip`);
    assert.ok(car.vx>14.8,`${model}: retain impact momentum`);
    assert.ok(Math.hypot(car.vx,car.vz)<initial,`${model}: no energy created`);
  }
});

test('heavy braking reserves lateral grip and sustained countersteering recovers the slide',()=>{
  const coast=fresh(),brake=fresh();
  driveVehicle(coast,{},.1);driveVehicle(brake,{brake:true},.1);
  assert.ok(brake.vx>coast.vx,'braking cannot also use all cornering grip');
  assert.ok(Math.abs(brake.vz)<Math.abs(coast.vz));
  for(let i=0;i<300;i++)driveVehicle(coast,{x:0,y:.2},1/60);
  assert.ok(Math.abs(coast.slip)<.002,'tyres regain stable forward travel');
});

test('drift recovery is consistent across mobile frame rates',()=>{
  const outcomes=[30,60,120].map(hz=>{
    const car=fresh({model:'sport'});
    for(let i=0;i<hz*3;i++)driveVehicle(car,{x:.4,y:.3},1/hz);
    return car;
  });
  for(const car of outcomes.slice(1)){
    assert.ok(Math.hypot(car.x-outcomes[0].x,car.z-outcomes[0].z)<1e-8);
    assert.ok(Math.abs(car.slip-outcomes[0].slip)<1e-8);
  }
});

test('a collision stopping the car clears tyre-slip effects in the same step',()=>{
  const car=fresh();
  driveVehicle(car,{x:1,y:1,brake:true},1/120,c=>{c.vx=c.vz=c.speed=0;});
  assert.equal(car.slip,0);
  car.destroyed=true;driveVehicle(car,{x:1,y:1,brake:true},1/60);
  assert.equal(car.handbraking,false);assert.equal(car.yawRate,0);
});

test('traffic body holds its heading at a standstill while wheel steering recentres',()=>{
  const car=fresh({heading:.4,steerAngle:.2});
  for(let i=0;i<60;i++)updateTrafficPose(car,-1.2,0,1/60);
  assert.ok(Math.abs(car.heading-.4)<1e-12);assert.equal(car.yawRate,0);
  assert.ok(Math.abs(car.steerAngle)<.00002);
});

test('moving traffic exposes matching wheel/driver steering in both turn directions',()=>{
  for(const desired of [-.5,.5]){
    const car=fresh({model:'sedan'});
    updateTrafficPose(car,desired,.4,.05);
    assert.equal(Math.sign(car.heading),Math.sign(desired));
    assert.equal(Math.sign(car.steering),-Math.sign(desired));
    assert.equal(Math.sign(car.steerAngle),Math.sign(car.steering));
    assert.ok(Math.abs(car.steerAngle)<=drivingScale(car).steer);
  }
});

test('actual traffic update does not rotate a bus while passengers board',()=>{
  const [from,to]=WORLD.graph.edges.find(([a,b])=>Math.hypot(WORLD.graph.nodes[a][0]-WORLD.graph.nodes[b][0],WORLD.graph.nodes[a][1]-WORLD.graph.nodes[b][1])>40);
  const a=WORLD.graph.nodes[from],b=WORLD.graph.nodes[to],len=Math.hypot(a[0]-b[0],a[1]-b[1]);
  const edge={from,to,len,lane:0},origin=lanePoint(edge,.2),goal=lanePoint(edge),heading=Math.atan2(origin.x-goal.x,origin.z-goal.z)+.15;
  const car=fresh({...origin,heading,model:'tirana-bus',node:from,next:to,speed:0,vx:0,vz:0,cruise:7,seed:1,busStopAt:1000,doorsUntil:50});
  const state={elapsed:0,cars:[],traffic:[car],units:[],npcs:[],players:{local:{x:car.x,z:car.z}},junctionReservations:{}};
  for(let i=0;i<20;i++){state.elapsed+=.05;updateTraffic(state,.05,()=>{});}
  assert.equal(car.x,origin.x);assert.equal(car.z,origin.z);
  assert.ok(Math.abs(car.heading-heading)<1e-12);assert.equal(car.speed,0);
});
