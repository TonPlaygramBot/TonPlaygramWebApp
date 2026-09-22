import test from 'node:test';
import assert from 'node:assert/strict';
import {crowdNeighbors,crowdSteering,separateCrowd,chooseCrowdExit} from '../webapp/src/games/tiranastreets/shared/crowdBehavior.mjs';
import {pedestrianIntent} from '../webapp/src/games/tiranastreets/shared/pedestrianBehavior.mjs';
import {trafficRouteCost} from '../webapp/src/games/tiranastreets/shared/trafficSimulation.mjs';
import {updatePolicePatrols} from '../webapp/src/games/tiranastreets/shared/policeDispatch.mjs';
import {trafficClearance,updateEmergencyResponse} from '../webapp/src/games/tiranastreets/shared/emergencyResponse.mjs';

const walker=(id,x,z)=>({id,x,z,kind:'civilian',motion:'walk',health:100,panicUntil:0,path:[{x:-20,z:0},{x:20,z:0}],pathIndex:1});
const move=(n,goal,speed,dt)=>{const dx=goal.x-n.x,dz=goal.z-n.z,length=Math.hypot(dx,dz);if(!length)return;const step=Math.min(length,speed*dt);n.x+=dx/length*step;n.z+=dz/length*step;};

test('opposing walkers pass each other instead of freezing at touching distance',()=>{
  const a=walker('a',-.25,0),b=walker('b',.25,0);b.pathIndex=0;
  const state={elapsed:1,players:{}},world={roads:[]};
  for(let frame=0;frame<180;frame++){
    state.elapsed+=1/60;
    for(const n of [a,b]){
      const neighbors=crowdNeighbors(n,[a,b]);
      const intent=pedestrianIntent(n,state,[],[a,b],world,neighbors);
      const before={x:n.x,z:n.z};move(n,intent.goal,intent.speed,1/60);separateCrowd(n,neighbors,1/60);
      assert.ok(Math.hypot(n.x-before.x,n.z-before.z)<.07,'no overlap teleports');
    }
  }
  assert.ok(a.x>1&&b.x<-1,'both continue along their original route');
  assert.ok(Math.abs(a.z)<1&&Math.abs(b.z)<1,'passing stays near the sidewalk');
});

test('dense overlap correction and nearest-neighbor work are bounded and deterministic',()=>{
  const n=walker('center',0,0),crowd=Array.from({length:500},(_,i)=>walker(`citizen-${i}`,i%2?.1:-.1,0));
  const selected=crowdNeighbors(n,crowd),reversed=crowdNeighbors(n,[...crowd].reverse());
  assert.equal(selected.length,12);assert.deepEqual(selected.map(x=>x.actor.id),reversed.map(x=>x.actor.id));
  separateCrowd(n,selected,1/60);assert.ok(Math.hypot(n.x,n.z)<=.03+1e-9);
  const pair=[walker('a',0,0),walker('b',0,0)];
  for(let i=0;i<60;i++)for(const actor of pair)separateCrowd(actor,crowdNeighbors(actor,pair),1/60);
  assert.ok(Math.hypot(pair[0].x-pair[1].x,pair[0].z-pair[1].z)>.75);
  assert.equal(crowdSteering(n,{x:10,z:0},0,selected).speed,0,'vehicle yielding always takes priority');
});

test('connected sidewalk exits disperse a crowd without changing population or path topology',()=>{
  const n=walker('routing',0,0),east={x:20,z:0},north={x:0,z:20};
  const queue=[walker('one',2,0),walker('two',4,0),walker('three',6,0)];
  assert.equal(chooseCrowdExit(n,[east,north],[],0),east);
  assert.equal(chooseCrowdExit(n,[east,north],queue,0),north);
  Object.assign(n,{path:[{x:-10,z:0},{x:0,z:0}],pathIndex:1});
  pedestrianIntent(n,{elapsed:1,players:{}},[],queue,{roads:[{walk:true,a:[0,0],b:[20,0]},{walk:true,a:[0,0],b:[0,20]}]});
  assert.deepEqual(n.path,[{x:0,z:0},north]);assert.equal(queue.length,3);
});

test('outgoing lane costs avoid stopped queues and wrecks while ignoring opposing lanes',()=>{
  const car={id:'driver',x:0,z:0,model:'sedan'},from={x:0,z:0},east={x:30,z:0};
  const parked={id:'queue',x:8,z:0,speed:0,model:'sedan'};
  assert.ok(trafficRouteCost(car,from,east,[parked])>trafficRouteCost(car,from,east,[{...parked,speed:8}]));
  assert.ok(trafficRouteCost(car,from,east,[{...parked,destroyed:true}])>trafficRouteCost(car,from,east,[parked]));
  assert.equal(trafficRouteCost(car,from,east,[{...parked,z:5}]),0);
  assert.equal(trafficRouteCost(car,from,{x:0,z:30},[parked]),0);
});

test('assigned police spread pursuit roles and search last observed positions',()=>{
  const player={id:'p',x:0,z:0,heading:0,speed:12,health:100,wanted:450,carId:'car'};
  const units=Array.from({length:4},(_,i)=>({id:`unit-${i}`,x:-35+i*4,z:40,heading:0,health:100,driver:'npc',role:'patrol',target:'p',duty:'responding',home:{x:-100,z:100},lastSeen:{x:0,z:0},lastSeenAt:1,nextRoute:0,path:[],speed:0}));
  const state={elapsed:1,policeVersion:1,dispatchQueue:{p:{at:100}},players:{p:player},cars:[],traffic:[],units,npcs:units.map(u=>({id:`crew-${u.id}`,unit:u.id,health:100,motion:'drive',x:u.x,z:u.z}))};
  const env={world:{graph:{nodes:[[0,0]]}},nearestNode:()=>0,route:()=>[],clear:()=>true};
  updatePolicePatrols(state,1/60,env);
  assert.deepEqual(units.map(u=>u.pursuitRole),['pursue','intercept','intercept','roadblock']);
  assert.equal(new Set(units.map(u=>`${u.routeTarget.x},${u.routeTarget.z}`)).size,4);
  player.x=2000;player.z=-1000;state.elapsed=5;env.clear=()=>false;
  updatePolicePatrols(state,1/60,env);
  assert.ok(units.every(u=>u.pursuitRole==='search'));
  assert.ok(units.every(u=>Math.hypot(u.routeTarget.x,u.routeTarget.z)<=18),'hidden player never becomes a route destination');
});

test('wrecked emergency vehicles cannot move or heal and long buses receive body clearance',()=>{
  const patient={id:'patient',x:0,z:0,health:30,lastDamage:0};
  const car={id:'ambulance',service:'ambulance',model:'taxi',x:0,z:0,heading:0,node:0,destroyed:true,speed:4,vx:4,vz:0};
  updateEmergencyResponse({elapsed:1,players:{patient},cars:[],traffic:[car],units:[],npcs:[]},.05,{});
  assert.equal(patient.health,30);assert.equal(car.speed,0);assert.equal(car.vx,0);assert.equal(car.responding,false);
  assert.equal(trafficClearance(car,[{id:'bus',model:'tirana-bus',x:0,z:-10,heading:0}],[]),0);
});
