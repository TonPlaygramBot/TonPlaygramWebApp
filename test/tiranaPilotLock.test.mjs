import test from 'node:test';
import assert from 'node:assert/strict';
import {FlightSimulation} from '../webapp/src/games/tiranastreets/street-career/FlightSimulation.mjs';
import {CombatSimulation} from '../webapp/src/games/tiranastreets/street-career/CombatSimulation.mjs';
import {pilotView,flightReadout,angleDifference} from '../webapp/src/games/tiranastreets/street-career/flightView.mjs';
import {findFlightTarget,guideMissile} from '../webapp/src/games/tiranastreets/street-career/flightTargeting.mjs';

function fixture(kind='jet'){
  const aircraft={id:'aircraft',kind,x:0,y:50,z:0,heading:0,speed:0,pitch:0,roll:0,health:240,pilot:'local',airborne:true,missiles:8,nextMissile:0};
  const target={id:'target',model:'sedan',x:0,y:49,z:-180,health:100,driver:null};
  const sim={player:{id:'local',aircraftId:aircraft.id,health:100,wanted:0},body:{yaw:0,pitch:0},intent:{x:0,y:0,fire:false,fast:false,brake:false},
    state:{elapsed:1,effects:[],effectSeq:0,npcs:[],players:{}},world:{surface:()=>0,cast:()=>({kind:'air',distance:Infinity}),clearance:()=>true},cars:()=>[target],event(){},damage(){}};
  const flight=Object.create(FlightSimulation.prototype);Object.assign(flight,{sim,aircraft:[aircraft],view:'pilot'});flight.clearLock();sim.flight=flight;
  sim.combat=new CombatSimulation(sim);
  return {sim,flight,aircraft,target};
}
for(const kind of ['jet','helicopter'])test(`${kind}: pilot eye is inside the aircraft footprint and right steering looks right`,()=>{
  const {flight,aircraft}=fixture(kind),pose=pilotView(aircraft,0,0,.46);
  assert.ok(Math.hypot(pose.eye.x-aircraft.x,pose.eye.z-aircraft.z)<3);
  assert.ok(pose.eye.y>aircraft.y);assert.equal(pose.direction.z,-1);assert.ok(Math.abs(pose.direction.x)<1e-9);
  flight.sim.intent.x=1;flight.step(.1);
  assert.ok(aircraft.heading<0);assert.ok(pilotView(aircraft,aircraft.heading,0,.46).direction.x>0);
  assert.ok(pilotView(aircraft,aircraft.heading,.3,.46).direction.y>0,'looking up points visually higher');
  assert.ok(pilotView(aircraft,aircraft.heading,-.3,.46).direction.y<0,'looking down points visually lower');
});
test('heading wraps across north and the HUD uses altitude above local terrain',()=>{
  assert.ok(Math.abs(angleDifference(-Math.PI+.01,Math.PI-.01)-.02)<1e-9);
  const readout=flightReadout({heading:-Math.PI/2,y:140,speed:10,verticalSpeed:-3},100);
  assert.deepEqual(readout,{heading:90,cardinal:'E',altitude:40,speed:36,climb:-3});
});
test('jet stick back brakes without reverse; helicopter retains slow backwards travel',()=>{
  for(const kind of ['jet','helicopter']){
    const {flight,sim,aircraft}=fixture(kind);sim.intent.y=-1;flight.step(.5);
    assert.equal(kind==='jet'?aircraft.speed===0:aircraft.speed<0,true);
    assert.ok(Math.abs(aircraft.speed)<13);
  }
});
test('lock needs sustained visible aim and releases on obstruction, destruction or manual unlock',()=>{
  const {sim,flight,aircraft,target}=fixture();
  assert.equal(flight.toggleLock(),true);flight.step(.5);assert.ok(flight.lock.progress>0&&flight.lock.progress<1);
  flight.step(.3);assert.equal(flight.lock.progress,1);assert.equal(flight.lock.targetId,target.id);
  sim.world.cast=()=>({kind:'wall',objectId:'building',distance:50});flight.step(.11);
  assert.equal(flight.lock.targetId,null);assert.equal(flight.lock.progress,0);
  sim.world.cast=()=>({kind:'air',distance:Infinity});flight.step(.8);assert.equal(flight.lock.progress,1);
  target.destroyed=true;flight.step(.11);assert.equal(flight.lock.targetId,null);
  flight.toggleLock();assert.equal(flight.lock.enabled,false);
  aircraft.airborne=false;assert.equal(flight.toggleLock(),false);
  aircraft.airborne=true;aircraft.civilian=true;assert.equal(flight.toggleLock(),false);
});
test('seeker ignores targets behind the pilot, out of range and the owned vehicle',()=>{
  const {sim,aircraft,target}=fixture();
  assert.equal(findFlightTarget(sim,aircraft,0,0),target);
  target.z=100;assert.equal(findFlightTarget(sim,aircraft,0,0),null);
  target.z=-701;assert.equal(findFlightTarget(sim,aircraft,0,0),null);
  target.z=-100;target.driver='local';assert.equal(findFlightTarget(sim,aircraft,0,0),null);
});
test('locked firing consumes one missile, guides a moving target, respects cooldown and loses cover lock',()=>{
  const {sim,flight,aircraft,target}=fixture();flight.toggleLock();flight.step(.8);sim.intent.fire=true;
  flight.step(1/60);assert.equal(aircraft.missiles,7);assert.equal(sim.combat.missiles.length,1);
  const missile=sim.combat.missiles[0];assert.equal(missile.targetId,target.id);flight.step(.2);assert.equal(aircraft.missiles,7);
  target.x=10;sim.combat.step(.1);assert.ok(missile.direction.x>0);
  assert.ok(Math.abs(Math.hypot(...Object.values(missile.direction))-1)<1e-9);
  sim.world.cast=(_from,_direction,distance)=>distance>100?{kind:'wall',objectId:'wall',distance:80}:{kind:'air',distance:Infinity};
  sim.combat.step(.1);assert.equal(missile.targetId,null);
});
test('guidance has a turn limit instead of snapping sideways',()=>{
  const missile={x:0,y:50,z:0,direction:{x:0,y:0,z:-1}};
  guideMissile(missile,{x:180,y:49,z:0},.016);
  assert.ok(missile.direction.x>0&&missile.direction.x<.03);assert.ok(missile.direction.z<-.99);
});
test('target acquisition bounds expensive visibility sweeps in dense traffic',()=>{
  const {sim,aircraft,target}=fixture();let queries=0,fleetReads=0;
  const cars=Array.from({length:2000},(_,i)=>({...target,id:`traffic-${i}`,z:-100-i*.1}));
  sim.cars=()=>{fleetReads++;return cars;};sim.world.cast=()=>{queries++;return {kind:'wall',objectId:'obstacle',distance:10};};
  assert.equal(findFlightTarget(sim,aircraft,0,0),null);assert.equal(queries,12);assert.equal(fleetReads,1);
});
