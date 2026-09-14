import test from 'node:test';
import assert from 'node:assert/strict';
import {createDrivingWorld} from '../webapp/src/games/kartroyale/freeRoamCore.mjs';
import {resolveObstacleContact} from '../webapp/src/games/kartroyale/collisions.mjs';
import {createRacer,stepRacer,makeTrack,TRACKS,STEP} from '../webapp/src/games/kartroyale/simulation.mjs';
import {resampleCircuit} from '../webapp/src/games/kartroyale/grandRouteCore.mjs';
import {roadBumps} from '../webapp/src/games/kartroyale/roadFeel.mjs';
import {stepJumps} from '../webapp/src/games/kartroyale/jumpRamps.mjs';
import {circuitSides} from '../webapp/src/games/kartroyale/trackEdges.mjs';
import {ribbonExclusion} from '../webapp/src/games/tirana-street-detail/roadDetailCore.mjs';
import {courseRoadSurface} from '../webapp/src/games/kartroyale/raceCourse.mjs';
import {WORLD} from '../webapp/src/games/tiranastreets/shared/world.mjs';
import {drivingWorldData} from '../webapp/src/games/kartroyale/roamObstacles.mjs';
import {CANOPY_TREES} from '../webapp/src/games/tirana-street-life/canopyRegistry.mjs';
import {RAILINGS} from '../webapp/src/games/tiranastreets/shared/landscape.mjs';

const track={...resampleCircuit([[0,0],[0,400],[400,400],[400,0]],360),width:10};
const racer=()=>Object.assign(createRacer(track,'you','You'),{x:0,z:0,yaw:Math.PI/2,velocityYaw:Math.PI/2,speed:50});
const city=(extra={})=>({bounds:[-200,-200,500,500],roads:[{a:[-150,-40],b:[200,-40],w:10}],buildings:[],...extra});

test('sweeps block tree trunks, narrow iron rails and long kart noses at boost speed',()=>{
  for(const obstacle of [{x:10,z:0,radius:.22,height:9,material:'tree'},{a:[10,-6],b:[10,6],radius:.055,height:1.2,material:'metal'}]){
    for(const direction of [1,-1]){
      const world=createDrivingWorld(city({obstacles:[obstacle]})),r=racer();
      Object.assign(r,{x:direction>0?24:0,yaw:Math.PI/2,velocityYaw:Math.PI/2,speed:50*direction,bodyLength:4.4,bodyWidth:1.9});
      world.move(r,direction>0?0:24,0,.05);
      assert.ok(direction>0?r.x<7.9:r.x>12.1,'the entire nose/rear stays outside');
      assert.ok(Math.abs(r.speed)<8);assert.equal(r.impactMaterial,obstacle.material);assert.equal(r.impactId,1);
    }
  }
});

test('head-on hits absorb energy; glancing steel contact slides and turns the chassis',()=>{
  const head=racer(),glance=racer();glance.velocityYaw=Math.atan2(7,30);
  resolveObstacleContact(head,-1,0,.01,STEP,'metal');
  resolveObstacleContact(glance,-1,0,.01,STEP,'metal');
  assert.ok(glance.speed>head.speed*3);assert.ok(glance.health>head.health);
  assert.ok(Number.isFinite(glance.collisionSpin));
  const tree=racer(),wall=racer();resolveObstacleContact(tree,-1,0,.01,STEP,'tree');resolveObstacleContact(wall,-1,0,.01,STEP,'concrete');
  assert.ok(wall.speed<tree.speed&&tree.speed<head.speed,'materials have different restitution');
});

test('separating/resting contacts cause no new damage, and repeated contacts share a cooldown',()=>{
  const r=racer();resolveObstacleContact(r,-1,0,.02,STEP,'tree');
  const health=r.health,id=r.impactId;
  for(let i=0;i<30;i++)resolveObstacleContact(r,-1,0,.01,STEP,'tree');
  assert.equal(r.health,health);assert.equal(r.impactId,id);
  r.speed=0;r.impactCooldown=0;resolveObstacleContact(r,-1,0,.01,STEP,'concrete');
  assert.equal(r.impactId,id);assert.equal(r.health,health);
});

const lake={outer:[[10,-10],[40,-10],[40,15],[10,15]],holes:[]};
test('water stalls the kart, splashes once and recovers to a dry road without awarding laps',()=>{
  const world=createDrivingWorld(city({waterPolygons:[lake]})),r=racer();
  r.roamRecovery={x:0,z:-40,yaw:Math.PI/2};r.x=25;world.move(r,0,0,.05);
  assert.equal(r.speed,0);assert.equal(r.impactMaterial,'water');assert.ok(r.waterRecovery>0);
  const impact=r.impactId;
  for(let i=0;i<56;i++)stepRacer(r,{throttle:true,boost:true},track,STEP,i*STEP,'street',world);
  assert.ok(r.z===-40&&r.x<2);assert.equal(r.waterRecovery,0);assert.equal(r.impactId,impact);
  assert.equal(r.lap,0);assert.equal(r.gates,0);assert.equal(r.progress,0);
});

test('bridge decks remain driveable; the adjacent river bank still catches a kart',()=>{
  const world=createDrivingWorld(city({roads:[{a:[0,0],b:[50,0],w:8,bridge:true}],waterPolygons:[lake]}));
  const r=racer();r.x=38;world.move(r,0,0,.05);assert.ok(Math.abs(r.x-38)<1e-8);assert.ok(!r.waterRecovery);
  const beside=racer();beside.z=10;beside.x=38;world.move(beside,0,10,.05);assert.ok(beside.x<10&&beside.waterRecovery>0);
});

test('islands and building courtyards are free, their inner boundaries still stop passage',()=>{
  const ring={outer:[[-30,-30],[30,-30],[30,30],[-30,30]],holes:[[[-10,-10],[10,-10],[10,10],[-10,10]]]};
  const world=createDrivingWorld(city({waterPolygons:[ring]})),r=racer();r.speed=0;
  world.move(r,0,0,STEP);assert.ok(!r.waterRecovery);
  r.speed=50;r.x=25;world.move(r,0,0,.05);assert.ok(r.x<10&&r.waterRecovery>0);
});

test('airborne karts can clear low rails but cannot pass through a tree canopy/trunk',()=>{
  for(const [material,height,blocked] of [['metal',1.2,false],['tree',9,true]]){
    const world=createDrivingWorld(city({obstacles:[{a:[10,-6],b:[10,6],radius:.1,height,material}]})),r=racer();
    Object.assign(r,{x:20,airborne:true,jumpHeight:2});world.move(r,0,0,.05);assert.equal(r.x<10,blocked);
  }
});

test('production free roam indexes rendered trunks, ironwork, fixtures and river channels',()=>{
  const data=drivingWorldData();
  assert.ok(data.trees.length>=CANOPY_TREES.length);
  assert.ok(data.obstacles.filter(o=>o.material==='metal').length>=RAILINGS.length);
  assert.ok(data.waterPolygons.length>50);
  for(const t of data.trees)assert.ok(Number.isFinite(t.radius)&&t.radius>0);
  for(const material of ['tree','metal','concrete'])assert.ok(data.trees.length&&data.obstacles.some(o=>o.material===material));
});

test('every circuit uses source road widths, with all mitered edges inside its road ribbon',()=>{
  const key=(a,b)=>[a.join(','),b.join(',')].sort().join('|'),roads=new Map(WORLD.roads.map(r=>[key(r.a,r.b),r.w]));
  for(const config of TRACKS){
    const widths=config.points.map((p,i)=>roads.get(key(p,config.points[(i+1)%config.points.length])));
    const surface=courseRoadSurface(config.points,widths),t=makeTrack(config.id),sides=circuitSides(t.points,t.width/2);
    assert.ok(t.width<=Math.max(...widths)+1e-8,config.id+' no extra lanes');
    for(const side of Object.values(sides))for(const p of side)assert.ok(surface.contains(p.x,p.z),config.id+' road edge');
    assert.ok(t.points.every(p=>p.width>=1.8),config.id+' no impassable pinholes');
  }
});

test('the full road footprint excludes scenery at folded bends and neighbouring segments',()=>{
  const t=makeTrack('blloku'),blocked=ribbonExclusion(t),sides=circuitSides(t.points,t.width/2);
  for(const p of [...t.points,...sides.left,...sides.right])assert.ok(blocked(p.x,p.z,.3));
});

test('every circuit has frequent physical humps, including turn approaches',()=>{
  for(const config of TRACKS){const bumps=roadBumps(makeTrack(config.id));assert.ok(bumps.length>=4,config.id+' humps');assert.ok(bumps.some(b=>b.corner),config.id+' corner hump');}
});

test('hump takeoff scales with speed and lands without awarding nitro or re-launching midair',()=>{
  const t=makeTrack('blloku'),b=roadBumps(t).find(b=>!b.corner)||roadBumps(t)[0],s=Math.sin(b.yaw),c=Math.cos(b.yaw);
  for(const speed of [5,30]){
    const r=racer();Object.assign(r,{x:b.x+s*.2,z:b.z+c*.2,yaw:b.yaw,velocityYaw:b.yaw,speed,boost:0});
    stepJumps(r,t,STEP,3,b.x-s*.2,b.z-c*.2);
    assert.equal(r.airborne,speed===30);assert.equal(r.boost,0);
    let peak=r.jumpHeight;
    for(let i=0;i<120;i++){stepJumps(r,t,STEP,3+(i+1)*STEP,r.x,r.z);peak=Math.max(peak,r.jumpHeight);}
    assert.ok(!r.airborne);assert.equal(r.jumpHeight,0);assert.equal(r.boost,0);
    if(speed===30)assert.ok(peak>.18&&peak<.85);
  }
});
