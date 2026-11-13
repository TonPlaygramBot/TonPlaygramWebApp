import test from 'node:test';
import assert from 'node:assert/strict';
import {pedestrianIntent,rememberPedestrianThreat} from '../webapp/src/games/tiranastreets/shared/pedestrianBehavior.mjs';
import {actorVelocity,sweptVehicleConflict,parkedVehicleObstacle} from '../webapp/src/games/tiranastreets/shared/trafficAwareness.mjs';
import {steerNPC} from '../webapp/src/games/tiranastreets/shared/npcNavigation.mjs';
import {updateCityLife} from '../webapp/src/games/tiranastreets/shared/cityLife.mjs';

const walker=()=>({id:'crossing-citizen',kind:'civilian',motion:'walk',x:0,z:0,health:100,heading:0,speed:0,path:[{x:0,z:0},{x:30,z:0}],pathIndex:1,panicUntil:0});
const state=()=>({elapsed:1,players:{}});

test('pedestrians catch approaching and reversing cars between the former 0.6-second samples',()=>{
  for(const direction of [-1,1]){
    const n=walker(),c={id:'fast-car',x:.4,z:-9*direction,heading:0,vx:0,vz:30*direction,w:2,d:4,driver:'player'};
    const intent=pedestrianIntent(n,state(),[c],[],{roads:[]});
    assert.equal(intent.speed,0);assert.equal(n.behavior,'yield');
    c.vz*=-1;
    assert.ok(pedestrianIntent(n,state(),[c],[],{roads:[]}).speed>0,'moving away clears the crossing');
  }
});

test('continuous prediction respects the full planned walking segment and oriented vehicle body',()=>{
  const n=walker();n.motion='cycle';
  const c={id:'car',x:6,z:-9,heading:0,vx:0,vz:6,w:2,d:4,driver:'player'};
  assert.equal(pedestrianIntent(n,state(),[c],[],{roads:[]}).speed,0,'a crossing beyond the old 1.6 m cap is detected');
  const bus={x:0,z:0,heading:Math.PI/2,vx:0,vz:0};
  assert.equal(sweptVehicleConflict(bus,{x:7,z:3},{x:0,z:-2},1.5,9,1),true);
  assert.equal(sweptVehicleConflict(bus,{x:11,z:3},{x:0,z:-2},1.5,9,1),false);
  const partial=actorVelocity({heading:Math.PI,speed:0,vz:5});
  assert.ok(Math.abs(partial.x)<1e-9);assert.equal(partial.z,5);
});

test('parked cars use obstacle detours while an occupied traffic queue retains priority',()=>{
  const parked={id:'parked',x:4,z:0,heading:0,speed:0,w:2,d:4};
  assert.equal(parkedVehicleObstacle(parked),true);
  assert.equal(parkedVehicleObstacle({...parked,npcDriver:true}),false);
  assert.equal(parkedVehicleObstacle({...parked,vz:3}),false);
  const n=walker(),s={...state(),difficulty:'normal',effects:[],cars:[parked],traffic:[],units:[],npcs:[n],policeVersion:1,dispatchQueue:{},
    players:{viewer:{id:'viewer',x:0,z:10,health:100,finished:true,lastCrime:-100}}};
  const env={world:{roads:[]},clear:()=>true,collide:()=>{},along:(actor,goal,speed,dt)=>{
    const dx=goal.x-actor.x,dz=goal.z-actor.z,length=Math.hypot(dx,dz),step=Math.min(length,speed*dt);
    if(length){actor.x+=dx/length*step;actor.z+=dz/length*step;actor.heading=Math.atan2(-dx,-dz);}
    return step===length;
  }};
  for(let i=0;i<600;i++){
    s.elapsed+=1/60;updateCityLife(s,1/60,env,{type:'free'});
    assert.ok(Math.abs(n.x-parked.x)>=1.4||Math.abs(n.z-parked.z)>=2.4,'walker never enters the parked body');
  }
  assert.ok(n.x>7,'citizen makes progress around the car');
});

test('gunshot witnesses beyond visual range flee the heard origin and cannot track a hidden attacker',()=>{
  const n={...walker(),x:50,path:[{x:40,z:0},{x:60,z:0}]},source={id:'shooter',x:0,z:0,health:100,lastCrime:1};
  rememberPedestrianThreat(n,source,1);
  const s={elapsed:1,players:{source}};
  let intent=pedestrianIntent(n,s,[],[],{roads:[]},[],[source],()=>false);
  assert.equal(n.behavior,'flee');assert.equal(intent.goal.x,60);
  source.x=65;s.elapsed=2;
  intent=pedestrianIntent(n,s,[],[],{roads:[]},[],[source],()=>false);
  assert.equal(intent.goal.x,60,'unseen movement cannot change the remembered origin');
  s.elapsed=4.1;pedestrianIntent(n,s,[],[],{roads:[]},[],[source],()=>false);
  assert.equal(n.behavior,'walk');assert.equal(n.fleeMemory,undefined,'sound memory has a bounded lifetime');
});

test('cached NPC routes are rejected when a new obstacle crosses their next segment',()=>{
  const n={id:'walker',kind:'civilian',x:0,z:0},goal={x:12,z:0};
  assert.equal(steerNPC(n,goal,()=>true,0),goal);
  const clear=(a,b)=>!(Math.min(a.x,b.x)<2&&Math.max(a.x,b.x)>2&&Math.abs(a.z+(b.z-a.z)*(2-a.x)/(b.x-a.x))<2);
  const changed=steerNPC(n,goal,clear,.1);
  assert.notDeepEqual(changed,goal);assert.ok(clear(n,changed),'new detour is reachable immediately');
});
