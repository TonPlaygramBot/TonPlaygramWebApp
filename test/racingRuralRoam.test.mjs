import test from 'node:test';
import assert from 'node:assert/strict';
import {STEP,TRACKS,makeTrack,createRacer,stepRacer} from '../webapp/src/games/kartroyale/simulation.mjs';
import {resampleCircuit} from '../webapp/src/games/kartroyale/grandRouteCore.mjs';
import {jumpRamps,stepJumps} from '../webapp/src/games/kartroyale/jumpRamps.mjs';
import {surfaceHeight} from '../webapp/src/games/kartroyale/racingSurface.mjs';
import {createDrivingWorld} from '../webapp/src/games/kartroyale/freeRoamCore.mjs';
const straight={...resampleCircuit([[0,0],[0,2000],[2000,2000],[2000,0]],720),width:20};
const make=()=>Object.assign(createRacer(straight,'you','You'),{x:0,z:100,index:18,yaw:0,velocityYaw:0});

test('retired rural selections migrate to explicit city routes',()=>{
  for(const [old,current] of [['farke','tirana-myslym-shyri'],['surrel','tirana-zogu-pare'],['liqeni','tirana-prokop-mima']]){
    assert.ok(!TRACKS.some(t=>t.id===old));
    assert.equal(makeTrack(old),makeTrack(current));
    assert.equal(makeTrack(old).id,current);
    assert.equal(makeTrack(old).terrainMode,undefined);
  }
});
test('held brake stops first, engages reverse after the dwell, and release/gas cancel it',()=>{
  const r=make();r.speed=22;
  let time=0;
  while(r.speed>.01){stepRacer(r,{brake:true},straight,STEP,time+=STEP);assert.ok(r.speed>=0,'no immediate direction change');}
  for(let i=0;i<10;i++)stepRacer(r,{brake:true},straight,STEP,time+=STEP);
  assert.equal(r.speed,0);
  for(let i=0;i<80;i++)stepRacer(r,{brake:true,boost:true},straight,STEP,time+=STEP);
  assert.ok(r.speed< -3&&r.speed>=-7);assert.equal(r.reversing,true);assert.equal(r.boosting,false);
  stepRacer(r,{},straight,STEP,time+=STEP);assert.equal(r.reversing,false);assert.equal(r.brakeHold,0);
  for(let i=0;i<100;i++)stepRacer(r,{throttle:true},straight,STEP,time+=STEP);
  assert.ok(r.speed>5);assert.equal(r.reversing,false);
});
test('AI and overlapping gas/brake input never select automatic reverse',()=>{
  for(const ai of [false,true]){const r=make();r.ai=ai;for(let i=0;i<180;i++)stepRacer(r,{brake:true,throttle:!ai},straight,STEP,i*STEP);assert.equal(r.speed,0);assert.equal(r.reversing,false);}
});
test('retained city circuits have a physical boost jump with bounded height and a settled landing',()=>{
  for(const {id} of TRACKS.slice(0,6)){
    const track=makeTrack(id),ramp=jumpRamps(track)[0],r=createRacer(track,'you','You'),s=Math.sin(ramp.yaw),c=Math.cos(ramp.yaw);
    Object.assign(r,{x:ramp.x-s*9,z:ramp.z-c*9,yaw:ramp.yaw,velocityYaw:ramp.yaw,index:ramp.index,speed:30,boost:0});
    let peak=0,air=false,landed=false,wasAir=false;
    for(let i=0;i<180;i++){stepRacer(r,{throttle:true},track,STEP,i*STEP);peak=Math.max(peak,r.jumpHeight);air||=r.airborne;landed||=wasAir&&!r.airborne;wasAir=r.airborne;assert.ok([r.x,r.z,r.jumpHeight,r.jumpY].every(Number.isFinite),id);}
    assert.ok(air&&landed,id+' takes off and lands');assert.ok(peak>1.2&&peak<5,id+' jump height '+peak);assert.ok(r.boostEvent>0);assert.equal(r.finished,false);
  }
});
test('wrong-way, lateral misses, airborne passes and recovery cannot farm ramp boost',()=>{
  const track=makeTrack('pyramid'),ramp=jumpRamps(track)[0],s=Math.sin(ramp.yaw),c=Math.cos(ramp.yaw);
  for(const [offset,direction] of [[ramp.width,1],[0,-1]]){
    const r=createRacer(track,'you','You');Object.assign(r,{x:ramp.x+s*7+c*offset,z:ramp.z+c*7-s*offset,speed:30,velocityYaw:ramp.yaw+(direction<0?Math.PI:0),boost:0});
    stepJumps(r,track,STEP,1,ramp.x-s*7+c*offset,ramp.z-c*7-s*offset);assert.equal(r.airborne,false);assert.equal(r.boost,0);
  }
  const r=createRacer(track,'you','You');Object.assign(r,{airborne:true,jumpHeight:2,jumpVelocity:4,jumpY:surfaceHeight(track,r.x,r.z)+2});
  const before={gates:r.gates,lap:r.lap,progress:r.progress};stepRacer(r,{recover:true},track,STEP,8);
  assert.equal(r.airborne,false);assert.equal(r.jumpHeight,0);assert.deepEqual({gates:r.gates,lap:r.lap,progress:r.progress},before);
});
const city={bounds:[-200,-200,500,500],roads:[{a:[0,-100],b:[0,400],w:12},{a:[-100,120],b:[300,120],w:12}],buildings:[{p:[[40,60],[70,60],[70,90],[40,90]]}],waterAreas:[{polygons:[{outer:[[90,200],[140,200],[140,250],[90,250]],holes:[]}]}]};
test('free driving leaves the racing corridor, traverses intersections and never earns laps',()=>{
  const world=createDrivingWorld(city),r=make();Object.assign(r,{x:0,z:120,yaw:Math.PI/2,velocityYaw:Math.PI/2,speed:10});
  for(let i=0;i<160;i++)stepRacer(r,{throttle:true},straight,STEP,2000+i*STEP,'street',world);
  assert.ok(r.x>50,'no invisible race ribbon barrier');assert.ok(Math.abs(r.z-120)<.1,'no race steering assistance');assert.equal(r.lap,0);assert.equal(r.gates,0);assert.equal(r.finished,false);assert.ok(r.roamRecovery);
});
test('swept free-roam collision blocks thin buildings and lake edges at boosted speed',()=>{
  const world=createDrivingWorld(city);
  for(const [x,z,end,limit] of [[35,75,78,39],[80,220,155,89]]){
    const r=make();Object.assign(r,{x:end,z,yaw:Math.PI/2,velocityYaw:Math.PI/2,speed:53});world.move(r,x,z,.05);assert.ok(r.x<limit,'cannot tunnel into or through solid');assert.ok(r.wallContact);assert.ok(Math.abs(r.speed)<10,'normal impact loses speed');
  }
});
