import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduledActorStep} from '../webapp/src/games/tiranastreets/shared/actorSchedule.mjs';
import {TrafficGrid,citySpatialGrids,trafficDecision} from '../webapp/src/games/tiranastreets/shared/trafficSimulation.mjs';
import {pedestrianIntent} from '../webapp/src/games/tiranastreets/shared/pedestrianBehavior.mjs';
import {screenStick} from '../webapp/src/games/tiranastreets/street-career/humanRoster.mjs';

test('distant work is spread across frames without losing simulation time',()=>{
  const actors=Array.from({length:2400},(_,i)=>({id:`citizen-${i}`}));
  const elapsed=actors.map(()=>0),work=[];
  for(let frame=1;frame<=240;frame++){
    let count=0;
    actors.forEach((a,i)=>{const dt=scheduledActorStep(a,frame/60,1/60,.4);elapsed[i]+=dt;if(dt)count++;});work.push(count);
  }
  assert.ok(Math.max(...work)<actors.length*.15,'no synchronized update of the entire crowd');
  for(let i=0;i<actors.length;i++){
    elapsed[i]+=scheduledActorStep(actors[i],241/60,1/60,0);
    assert.ok(Math.abs(elapsed[i]-241/60)<1e-9,'nearby transition consumes the remaining time exactly once');
  }
});
test('schedules do not leak bookkeeping into save/network actors and ignore invalid deltas',()=>{
  const a={id:'npc'};assert.equal(scheduledActorStep(a,0,0,.4),0);
  assert.equal(scheduledActorStep(a,1,NaN,.4),0);
  assert.equal(scheduledActorStep(a,1,-1,.4),0);
  scheduledActorStep(a,1,.02,.4);assert.deepEqual(a,{id:'npc'});
  assert.equal(scheduledActorStep(a,0,.02,0),.02,'time rewind discards prior pending time');
});
test('pooled grids remove stale actors, work across negative cells and survive distant coordinates',()=>{
  const a={id:'a',x:-.1,z:-32.1},b={id:'b',x:32,z:32};
  const grid=new TrafficGrid([a,b]);assert.deepEqual(grid.near(a.x,a.z,0),[a]);
  assert.equal(grid.near(a.x,a.z,0),grid.near(a.x,a.z,0));
  a.x=96;a.z=128;grid.reset([a]);assert.equal(grid.near(-.1,-32.1,0).length,0);
  assert.deepEqual(grid.near(a.x,a.z,0),[a]);assert.ok(!grid.near(32,32,0).includes(b));
  const c={id:'c',x:32*65536,z:-32*65536};grid.reset([a,c]);assert.deepEqual(grid.near(c.x,c.z,0),[c]);
  for(let i=0;i<100;i++){a.x=i*100;grid.reset([a]);grid.near(a.x,a.z,48);}
  assert.equal(grid.cells.size,1);assert.ok(grid.cellPool.length<=512);
});
test('shared broad phase retains crossing actors until its next refresh and invalidates roster changes',()=>{
  const n={id:'n',x:31.8,z:0,health:100},s={elapsed:0,cars:[],traffic:[],units:[],npcs:[n],players:{}};
  const initial=citySpatialGrids(s);n.x=33.5;s.elapsed=.016;
  assert.ok(citySpatialGrids(s).people.near(34,0,1).includes(n));
  assert.equal(citySpatialGrids(s).time,0);
  s.elapsed=.05;assert.equal(citySpatialGrids(s).time,.05);
  s.npcs=[{id:'new',x:0,z:0,health:100}];assert.ok(citySpatialGrids(s).people.near(0,0,0).some(a=>a.id==='new'));
});
test('traffic still yields to a pedestrian and a stopped car in its lane',()=>{
  const car={id:'car',x:0,z:0,heading:0,cruise:10,model:'sedan'};
  const pedestrian={id:'walker',x:0,z:-5,health:100};
  const decision=trafficDecision(car,[],[pedestrian],0);assert.equal(decision.reason,'pedestrian');assert.ok(decision.target<10);
  const stopped={id:'stopped',x:0,z:-6,heading:0,model:'sedan',speed:0};
  assert.equal(trafficDecision(car,[stopped],[],0).reason,'vehicle');
});
test('joystick dead zone preserves visual directions, diagonal normalization and full reach',()=>{
  assert.deepEqual(screenStick(1,1,44,.08),{x:0,y:0});
  assert.deepEqual(screenStick(0,-44,44,.08),{x:0,y:1});
  assert.equal(screenStick(44,0,44,.08).x,1);assert.equal(screenStick(-44,0,44,.08).x,-1);
  const d=screenStick(44,-44,44,.08);assert.ok(Math.abs(Math.hypot(d.x,d.y)-1)<1e-9);
  assert.deepEqual(screenStick(NaN,0),{x:0,y:0});
});
test('fleeing citizens continue through safe connected paths and forget an unseen threat',()=>{
  const world={roads:[{walk:true,a:[0,0],b:[10,0]},{walk:true,a:[10,0],b:[20,0]}]};
  const n={id:'citizen',x:10,z:0,health:100,kind:'civilian',motion:'walk',panicUntil:20,path:[{x:0,z:0},{x:10,z:0}],pathIndex:1};
  const s={elapsed:10,players:{p:{x:0,z:0,health:100,lastCrime:10}}};
  assert.deepEqual(pedestrianIntent(n,s,[],[],world).goal,{x:20,z:0});
  s.players.p.x=-100;s.elapsed=11;pedestrianIntent(n,s,[],[],world);assert.equal(n.behavior,'flee');
  s.elapsed=14;pedestrianIntent(n,s,[],[],world);assert.equal(n.behavior,'walk');assert.equal(n.fleeMemory,undefined);
});
test('fleeing citizens reach walking-path corners before turning onto the next segment',()=>{
  const world={roads:[{walk:true,a:[0,0],b:[10,0]},{walk:true,a:[10,0],b:[10,10]},{walk:true,a:[10,10],b:[20,10]}]};
  const n={id:'turning-citizen',x:5,z:0,health:100,kind:'civilian',motion:'walk',panicUntil:20,path:[{x:0,z:0},{x:10,z:0}],pathIndex:0};
  const s={elapsed:10,players:{p:{x:0,z:0,health:100,lastCrime:10}}};
  assert.deepEqual(pedestrianIntent(n,s,[],[],world).goal,{x:10,z:0},'stay on the current sidewalk segment');
  assert.equal(n.pathIndex,1,'the selected escape endpoint becomes the current route target');
  n.x=10;
  assert.deepEqual(pedestrianIntent(n,s,[],[],world).goal,{x:10,z:10});
  assert.deepEqual(n.path,[{x:10,z:0},{x:10,z:10}]);
  n.z=5;
  assert.deepEqual(pedestrianIntent(n,s,[],[],world).goal,{x:10,z:10},'do not skip the following corner');
  n.z=10;
  assert.deepEqual(pedestrianIntent(n,s,[],[],world).goal,{x:20,z:10});
  assert.deepEqual(n.path,[{x:10,z:10},{x:20,z:10}]);
});
