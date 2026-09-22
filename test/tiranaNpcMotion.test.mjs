import test from 'node:test';
import assert from 'node:assert/strict';
import {updateCityLife} from '../webapp/src/games/tiranastreets/shared/cityLife.mjs';

function fixture({wall=Infinity,distant=false}={}){
  const npc={id:'citizen-motion',kind:'civilian',motion:'walk',health:100,x:0,z:0,heading:0,speed:0,
    path:[{x:0,z:0},{x:100,z:0}],pathIndex:1,panicUntil:0};
  const state={elapsed:1,difficulty:'normal',effects:[],cars:[],traffic:[],units:[],npcs:[npc],
    players:{viewer:{id:'viewer',x:distant?1000:0,z:10,health:100,finished:true,lastCrime:-100}},
    policeVersion:1,dispatchQueue:{}};
  let requested=0;
  const env={world:{roads:[]},clear:()=>true,
    collide:actor=>{if(actor===npc)actor.x=Math.min(actor.x,wall);},
    along:(actor,goal,speed,dt)=>{
      requested=speed;
      const dx=goal.x-actor.x,dz=goal.z-actor.z,length=Math.hypot(dx,dz);
      if(!length){actor.speed=0;return true;}
      const move=Math.min(length,speed*dt);
      actor.x+=dx/length*move;actor.z+=dz/length*move;
      actor.heading=Math.atan2(-dx,-dz);actor.speed=speed;
      return move===length;
    }};
  return {npc,state,requested:()=>requested,step(dt=1/60){state.elapsed+=dt;updateCityLife(state,dt,env,{type:'free'});}};
}

test('a collision-stopped civilian reports zero gait speed while preserving its walking intent',()=>{
  const f=fixture({wall:0});f.step();
  assert.ok(f.requested()>0);assert.equal(f.npc.x,0);assert.equal(f.npc.speed,0);
  assert.equal(f.npc.anim,'walk');assert.equal(f.npc.heading,-Math.PI/2);
});

test('partial collisions report actual displacement rather than full requested gait speed',()=>{
  const f=fixture({wall:.005}),dt=1/60;f.step(dt);
  assert.ok(f.requested()>.3);assert.ok(Math.abs(f.npc.speed-.005/dt)<1e-9);
  f.step(dt);assert.equal(f.npc.speed,0);
});

test('collision depenetration cannot accelerate the gait beyond intended walking speed',()=>{
  const f=fixture({wall:-2});f.step();
  assert.equal(f.npc.x,-2);assert.equal(f.npc.speed,f.requested());
});

test('distant scheduled motion retains its real speed between simulation updates',()=>{
  const f=fixture({distant:true});let moved=0;
  for(let i=0;i<120;i++){
    const before=f.npc.x;f.step();
    if(f.npc.x!==before){moved++;assert.ok(Math.abs(f.npc.speed-f.requested())<1e-9);}
    else if(moved)assert.ok(f.npc.speed>0,'render cadence does not turn throttled walkers idle');
  }
  assert.ok(moved>=4&&moved<=6);
});
