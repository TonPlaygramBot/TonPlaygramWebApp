import test from 'node:test';
import assert from 'node:assert/strict';
import {createState} from '../webapp/src/games/tiranastreets/shared/engine.mjs';
import {StreetSimulation} from '../webapp/src/games/tiranastreets/street-career/StreetSimulation.mjs';
import {StreetWorld} from '../webapp/src/games/tiranastreets/street-career/spatialCore.mjs';
import {crashResponse} from '../webapp/src/games/tiranastreets/street-career/CrashSimulation.mjs';
import {groundHeight} from '../webapp/src/games/tirana-east/terrainCore.mjs';

function simulation(world=new StreetWorld([],false)) {
  const state=createState([{id:'local',name:'Pilot'}],'free-roam','solo');
  const sim=new StreetSimulation(state,world);
  state.npcs=[];state.cars=[];state.traffic=[];state.units=[];state.nextDispatch=1e9;
  return sim;
}
const car=(id='car',speed=0)=>({id,x:100,z:100,heading:0,speed,vx:0,vz:-speed,model:'sedan',driver:null});
function fly(sim,seconds){for(let t=0;t<seconds-1e-8;t+=1/60){sim.state.elapsed+=1/60;sim.flight.step(1/60);}}
function board(sim,a){Object.assign(sim.player,sim.flight.access(a));sim.body.y=groundHeight(sim.player.x,sim.player.z)+.08;assert.equal(sim.flight.board(a.id),true);}

test('parking impacts in either direction preserve mechanical condition and separating contacts do nothing',()=>{
  for(const speed of [1,3,5,-1,-3,-5]){
    const response=crashResponse(car('a',speed),null,{x:0,z:Math.sign(speed)});
    assert.ok(response);assert.equal(response.damageA,0);
    assert.equal(crashResponse(car('a',speed),null,{x:0,z:-Math.sign(speed)}),null);
  }
  const glancing={...car('a'),vx:25,vz:-2};
  assert.equal(crashResponse(glancing,null,{x:0,z:1}).damageA,0);
});

test('impact delta-v and mass produce progressive damage, not an automatic fire',()=>{
  const slow=crashResponse(car('a',10),null,{x:0,z:1});
  const fast=crashResponse(car('a',25),null,{x:0,z:1});
  assert.ok(slow.damageA<8&&fast.damageA>slow.damageA*8);
  const bus={...car('bus'),model:'tirana-bus'};
  const pair=crashResponse(car('a',20),bus,{x:0,z:1});
  assert.ok(pair.deltaA>pair.deltaB);
  const sim=simulation(),c=car('wreck',40);sim.state.cars=[c];sim.crashes.impact(c,null,{x:0,z:1});
  assert.equal(c.destroyed,true);assert.equal(!!c.burning,false);
  assert.equal(sim.state.effects.filter(e=>/explosion|ignite|blast/.test(e.kind)).length,0);
});

test('repeated small-arms hits disable a vehicle without ignition or blast casualties',()=>{
  const sim=simulation(),c=car();sim.state.cars=[c];
  const hit={objectId:c.id,kind:'car',point:{x:c.x,y:1,z:c.z}};
  for(let i=0;i<5;i++)sim.combat.impact(hit,32);
  assert.ok(c.health>105);assert.equal(!!c.burning,false);assert.equal(!!c.destroyed,false);
  c.driver=sim.player.id;sim.player.carId=c.id;sim.body.interaction='driving';
  const health=sim.player.health;
  for(let i=0;i<30;i++)sim.combat.impact(hit,32);
  assert.equal(c.destroyed,true);assert.equal(sim.player.carId,null);assert.equal(sim.player.health,health);
  assert.equal(sim.state.effects.filter(e=>e.kind==='vehicle-disabled').length,1);
  assert.equal(sim.state.effects.filter(e=>/explosion|ignite|blast/.test(e.kind)).length,0);
});

test('explosive damage stays distinct and emits at most one vehicle explosion',()=>{
  const sim=simulation(),c=car();sim.state.cars=[c];
  sim.combat.damageVehicle(c,160,sim.player,'explosive');
  sim.combat.damageVehicle(c,160,sim.player,'explosive');
  assert.equal(c.exploded,true);
  assert.equal(sim.state.effects.filter(e=>e.kind==='vehicle-explosion').length,1);
});

test('actual square pads have full clearance and both aircraft board, take off, hover, land and exit',()=>{
  const sim=simulation(new StreetWorld());
  for(const a of [sim.state.jet,sim.state.helicopter]){
    assert.ok(Math.hypot(a.x,a.z)<50);
    assert.ok(sim.world.clearance({x:a.x,z:a.z,y:groundHeight(a.x,a.z)+.1},5,9));
    board(sim,a);sim.intent.y=1;fly(sim,2.2);
    assert.equal(a.airborne,true,a.kind);assert.ok(a.y>6,a.kind);assert.equal(a.health,a.kind==='jet'?240:220);
    sim.intent.y=0;sim.flight.assist('hover');fly(sim,2);
    assert.ok(Math.abs(a.speed)<.1);assert.equal(sim.flight.exit(),false);
    sim.flight.assist('land');fly(sim,12);
    assert.equal(a.airborne,false,a.kind);assert.ok(Math.abs(a.speed)<.1);
    assert.equal(sim.flight.exit(),true,a.kind);assert.equal(sim.player.aircraftId,null);
  }
});

test('DOWN wins over UP and landing can be cancelled by deliberate climb input',()=>{
  const sim=simulation(),a=sim.state.jet;board(sim,a);sim.intent.fast=true;fly(sim,1);
  const high=a.y;sim.intent.brake=true;fly(sim,.25);assert.ok(a.y<high);
  sim.intent.brake=false;sim.intent.fast=false;sim.flight.assist('land');fly(sim,.25);
  const low=a.y;sim.intent.fast=true;fly(sim,.25);assert.equal(a.autoLand,false);assert.ok(a.y>low);
});

test('the career input and shared game loop drive the jet, fire missiles and honor pause',()=>{
  const sim=simulation(),a=sim.state.jet;board(sim,a);
  sim.setIntent({x:0,y:1,yaw:0,pitch:0,fast:true});
  for(let i=0;i<90;i++)sim.step(1/60);
  assert.equal(a.airborne,true);assert.ok(a.y>10);assert.equal(sim.body.interaction,'flying');
  const missiles=a.missiles;sim.setIntent({...sim.intent,fast:false,fire:true});sim.step(1/60);
  assert.equal(a.missiles,missiles-1);assert.ok(sim.state.effects.some(e=>e.kind==='launch'));
  sim.pause();const position={x:a.x,y:a.y,z:a.z};sim.step(.5);
  assert.deepEqual({x:a.x,y:a.y,z:a.z},position);
});

test('wing collision blocks lateral building penetration without repeated damage while stopped',()=>{
  const sim=simulation(),a=sim.state.jet;board(sim,a);a.y=15;a.airborne=true;
  // Narrow tower intersects only the right wing; the centre ray stays clear.
  sim.world=new StreetWorld([{id:'wing-tower',h:30,p:[[a.x+4,-4],[a.x+5,-4],[a.x+5,12],[a.x+4,12]]}],false);
  sim.intent.y=1;fly(sim,1.8);
  assert.ok(a.z>=12);assert.ok(a.health>0);assert.match(sim.body.notice,/Obstacle/);
  const health=a.health;sim.intent.y=0;fly(sim,1);assert.equal(a.health,health);
});
