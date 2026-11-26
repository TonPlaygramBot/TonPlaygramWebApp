import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBody,MOTOR,stepMotor} from '../webapp/src/games/tiranastreets-november/street-career/playerCore.mjs';
import {groundMotion,groundCadence,stridePhase} from '../webapp/src/games/tiranastreets-november/street-career/groundMotion.mjs';
import {StreetSimulation} from '../webapp/src/games/tiranastreets-november/street-career/StreetSimulation.mjs';
import {createState,FREE_ROAM} from '../webapp/src/games/tiranastreets-november/shared/engine.mjs';
import {StreetWorld} from '../webapp/src/games/tiranastreets-november/street-career/spatialCore.mjs';
import {carPoint,vehicleAnchors} from '../webapp/src/games/tiranastreets-november/street-career/vehicleCore.mjs';

const DT=1/60;
function rig(){
  const p={x:0,z:0},b=createBody(),world={
    move(q,x,z){q.x+=x;q.z+=z;},
    clearance(){return true;},
    surface(){return 0;}
  },state={elapsed:0};
  b.y=0;
  let pose;
  return {p,b,world,step(x,y,free=true){
    state.elapsed+=DT;
    stepMotor(state,p,b,{x,y,yaw:0,pitch:0},DT,world,()=>{},()=>{});
    pose=groundMotion(pose,{speed:p.speed,travelX:b.travelX,travelZ:b.travelZ,free:free&&b.grounded,dt:DT});
    return pose;
  }};
}
test('the same original locomotion stays in Walk at half stick, switches at real running speed, and settles',()=>{
  const r=rig();
  let p;
  for(let i=0;i<60;i++)p=r.step(0,.5);
  assert.ok(p.moving&&!p.running);
  assert.ok(Math.abs(p.speed-MOTOR.walk)<.001);
  assert.ok(Math.abs(groundCadence(p.speed,false)-1)<.001);
  for(let i=0;i<60;i++)p=r.step(0,1);
  assert.ok(p.running&&Math.abs(p.speed-MOTOR.run)<.001);
  assert.ok(Math.abs(groundCadence(p.speed,true)-1)<.001);
  assert.ok(groundCadence(MOTOR.sprint,true)>1.6);
  for(let i=0;i<30;i++)p=r.step(0,0);
  assert.deepEqual(p,{speed:0,moving:false,running:false});
});
test('vehicle entry, airborne and blocked collision never play a stale ground stride',()=>{
  const r=rig();
  for(let i=0;i<30;i++)r.step(1,0);
  r.world.move=()=>{};
  assert.deepEqual(r.step(1,0),{speed:0,moving:false,running:false});
  assert.ok(r.b.vx>5,'stick input still commands movement into the obstruction');
  for(const travel of [[8,6],[NaN,0]])assert.deepEqual(
    groundMotion({speed:10,moving:true,running:true},{speed:10,travelX:travel[0],travelZ:travel[1],free:false,dt:.016}),
    {speed:0,moving:false,running:false}
  );
  assert.deepEqual(groundMotion(undefined,{speed:0,travelX:8,travelZ:6,free:true,dt:.016}),{speed:0,moving:false,running:false});
});
test('clip phase wraps, including negative clip time and invalid metadata',()=>{
  assert.ok(Math.abs(stridePhase(11.5,2)-.75)<1e-9);
  assert.equal(stridePhase(-.5,2),.75);
  assert.equal(stridePhase(1,0),0);
  assert.equal(stridePhase(Infinity,1),0);
});

function entry(){
  const state=createState([{id:'local',name:'Turi'}],FREE_ROAM.id,'solo');
  const sim=new StreetSimulation(state,new StreetWorld([],false));
  const p=sim.player,car=state.cars.find(c=>c.id==='car-local');
  assert.ok(car,'real local starter car');
  assert.equal(car.driver==null,true);
  const door=vehicleAnchors(car).doors[0],approach=carPoint(car,{...door,x:door.x-.62}),target=carPoint(car,door);
  const facing=Math.atan2(approach.x-target.x,approach.z-target.z);
  Object.assign(p,{x:approach.x,z:approach.z,heading:facing,weapon:''});
  Object.assign(sim.body,{y:approach.y,yaw:facing,pitch:-.65,grounded:true});
  sim.resume();
  return {state,sim,p,car};
}
const raw=(car,y)=>({x:0,y,yaw:car.heading,pitch:0,fast:false,brake:false,fire:false,seq:100});
test('authorized civilian boarding refuses pedals until seated and discards pre-entry input even through catch-up substeps',()=>{
  const {sim,p,state,car}=entry();
  assert.equal(sim.execute('interact',car.id),true,JSON.stringify(sim.resolve().filter(a=>a.id==='interact')));
  assert.equal(sim.body.interaction,'entering');
  const start=state.elapsed,duration=sim.body.action.duration;
  // Simulate a held keyboard forward / already latched joystick across the
  // entire animation. No further input is read on the next catch-up step.
  sim.setIntent(raw(car,1));
  while(state.elapsed+2*DT<start+duration){
    sim.step(DT);
    assert.equal(p.carId??null,null);
    assert.equal(car.speed,0);
  }
  for(let i=0;i<8;i++)sim.step(DT);
  assert.equal(p.carId,car.id);
  assert.equal(sim.body.interaction,'driving');
  assert.equal(sim.intent.y,0);
  assert.equal(p.input.y,0);
  assert.equal(car.speed,0);
  sim.setIntent(raw(car,1));
  for(let i=0;i<8;i++)sim.step(DT);
  assert.ok(car.speed>.1,'the first fresh post-seat pedal sample drives normally');
});
