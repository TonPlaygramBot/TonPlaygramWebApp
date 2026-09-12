import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {STEP,KARTS,TRACKS,makeTrack,createRacer,equipKart,stepRacer,stepRace} from '../webapp/src/games/kartroyale/simulation.mjs';
import {resampleCircuit} from '../webapp/src/games/kartroyale/grandRouteCore.mjs';
import {sampleCircuitDistance,cornerSpeedLimit} from '../webapp/src/games/kartroyale/circuitMetrics.mjs';
import {boostPads,stepBoostPads} from '../webapp/src/games/kartroyale/arcadeRules.mjs';
const straight={...resampleCircuit([[0,0],[0,2000],[2000,2000],[2000,0]],720),width:20};
const make=(id='apex')=>Object.assign(equipKart(createRacer(straight,'you','You'),id),sampleCircuitDistance(straight,200),{velocityYaw:0});
test('all eight karts accelerate past the old cap and nitro produces a faster straight',()=>{
  for(const kart of KARTS){
    const cruise=make(kart.id),nitro=make(kart.id);
    for(const r of [cruise,nitro])r.padCooldowns=Object.fromEntries(boostPads(straight).map(p=>[p.id,Infinity]));
    for(let i=0;i<360;i++)stepRacer(cruise,{throttle:true},straight,STEP,i*STEP);
    assert.ok(cruise.speed>35,`${kart.id}: ${cruise.speed}`);
    Object.assign(nitro,{speed:cruise.speed});
    for(let i=0;i<180;i++)stepRacer(nitro,{throttle:true,boost:true},straight,STEP,i*STEP);
    assert.ok(nitro.speed>cruise.speed+9,kart.id);
    assert.ok(nitro.boost>=0&&nitro.boost<25);
  }
});
test('turbo expiry decelerates smoothly; brake overrides gas and stops without reversing',()=>{
  const r=make();r.speed=52;r.turbo=.001;
  stepRacer(r,{throttle:true},straight,STEP,0);
  assert.ok(r.speed>51,'no instant jump to cruise speed');
  for(let i=0;i<240;i++)stepRacer(r,{throttle:true},straight,STEP,i*STEP);
  assert.ok(r.speed<=39.01);
  const start=r.z;
  for(let i=0;i<90;i++)stepRacer(r,{throttle:true,brake:true,boost:true},straight,STEP,i*STEP);
  assert.equal(r.speed,0);assert.ok(r.z-start<25);
});
test('every circuit gets more distributed pads with room to brake and no duplicate strips',()=>{
  for(const config of TRACKS){
    const track=makeTrack(config.id),pads=boostPads(track);
    assert.ok(pads.length>=7,config.id);
    for(let i=0;i<pads.length;i++){
      const p=pads[i];assert.ok(cornerSpeedLimit(track,p,65)>=32);
      assert.ok(p.width<=(track.points[p.index].width??track.width)*.62+.001);
      for(let j=i+1;j<pads.length;j++)assert.ok(Math.hypot(p.x-pads[j].x,p.z-pads[j].z)>=28);
    }
  }
});
test('swept boost pickup catches a full crossing, rejects misses and wrong-way travel',()=>{
  const track=makeTrack('blloku'),pad=boostPads(track)[0],s=Math.sin(pad.yaw),c=Math.cos(pad.yaw);
  for(const [offset,direction,expected] of [[0,1,24],[pad.width,1,0],[0,-1,0]]){
    const r=createRacer(track,'you','You');Object.assign(r,{speed:53,boost:0,velocityYaw:pad.yaw+(direction<0?Math.PI:0),x:pad.x+s*5+c*offset,z:pad.z+c*5-s*offset});
    stepBoostPads(r,track,1,pad.x-s*5+c*offset,pad.z-c*5-s*offset);assert.equal(r.boost,expected);
    stepBoostPads(r,track,2,pad.x-s*5+c*offset,pad.z-c*5-s*offset);assert.equal(r.boost,expected,'same racer cannot farm the strip');
  }
});
test('faster AI completes three ordered laps on every circuit',()=>{
  for(const config of TRACKS){
    const track=makeTrack(config.id),r=equipKart(createRacer(track,'ai','AI',0,true),'photon');
    for(let time=0;time<700&&!r.finished;time+=STEP)stepRace([r],track,STEP,time,'pro');
    assert.ok(r.finished,config.id);assert.equal(r.lapTimes.length,3);assert.ok(r.lapTimes.every(t=>t>10));
  }
});
test('suspension converges across frame rates and reduced motion keeps the body quiet',async()=>{
  const {default:ts}=await import('../webapp/node_modules/typescript/lib/typescript.js');
  const source=readFileSync(new URL('../webapp/src/games/kartroyale/KartMotion.ts',import.meta.url),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
  const {KartMotion}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
  const r=make();Object.assign(r,{speed:40,steering:.8,yawRate:.7,acceleration:20,throttle:1});
  const poses=[30,60,120].map(fps=>{const pose=new KartMotion();for(let i=0;i<fps*3;i++)pose.update(r,1/fps);return pose;});
  for(const pose of poses){assert.ok(Math.abs(pose.pitch-poses[0].pitch)<.001);assert.ok(Math.abs(pose.roll)<.1);assert.ok(Math.abs(pose.rightSteer)>Math.abs(pose.leftSteer));}
  const quiet=new KartMotion();for(let i=0;i<90;i++)quiet.update(r,1/30,.28,true);
  assert.equal(quiet.pitch,0);assert.equal(quiet.roll,0);assert.equal(quiet.height,0);assert.notEqual(quiet.wheelSpin,0);
});
