import test from 'node:test';
import assert from 'node:assert/strict';
import {createRacer,stepRacer} from '../webapp/src/games/kartroyale/legacySimulation.mjs';
import {createRaceCombat,stepRaceCombat,COMBAT_RULES} from '../webapp/src/games/kartroyale/raceCombat.mjs';

function track(){
  const points=[{x:0,z:0},{x:0,z:150},{x:100,z:150},{x:100,z:0}];
  let distance=0;for(let i=0;i<points.length;i++){
    const p=points[i],q=points[(i+1)%points.length];p.distance=distance;p.yaw=Math.atan2(q.x-p.x,q.z-p.z);p.width=8;distance+=Math.hypot(q.x-p.x,q.z-p.z);
  }
  return {id:'combat-fixture',name:'Road circuit',district:'test',width:8,length:distance,points,bounds:[-4,-4,104,154],center:{x:50,z:75},x:50,z:75,bend:0};
}
function setup(){
  const t=track(),you=createRacer(t,'you','Player',0),rival=createRacer(t,'rival','Rival',1,true);
  Object.assign(you,{x:0,z:10,index:0,yaw:0,velocityYaw:0,speed:0,groundY:0,jumpHeight:0});
  Object.assign(rival,{x:0,z:27,index:0,yaw:0,velocityYaw:0,speed:0,groundY:0,jumpHeight:0});
  const racers=[you,rival],combat=createRaceCombat(t,racers);
  combat.weapons.rival.aiCooldown=999;return {t,you,rival,racers,combat};
}
function run(f,seconds,input={}){for(let i=0;i<Math.ceil(seconds*60);i++)stepRaceCombat(f.combat,f.racers,f.t,input,1/60);}
const neutral={steer:0,throttle:false,brake:false,boost:false,drift:false,fire:true,shield:true};

test('ordinary simulation keeps combat inert; local combat owns a separate weapon state',()=>{
  const f=setup();
  stepRacer(f.you,neutral,f.t,1/60,0);
  assert.equal(f.you.ammunition,0);assert.equal(f.you.shield,0);assert.equal(f.rival.health,100);
  stepRaceCombat(f.combat,f.racers,f.t,{},1/60);
  assert.equal(f.you.ammunition,12);assert.equal(f.you.shield,100);
  const other=createRaceCombat(f.t,f.racers);f.combat.player.ammo=3;
  assert.equal(other.player.ammo,12);
});

test('forward shot hits first kart only and consumes ammunition once per cooldown',()=>{
  const f=setup(),behind={...f.rival,id:'behind',z:36};f.racers.push(behind);
  f.combat=createRaceCombat(f.t,f.racers);for(const w of Object.values(f.combat.weapons))w.aiCooldown=999;
  stepRaceCombat(f.combat,f.racers,f.t,{fire:true},1/60);
  assert.equal(f.combat.player.ammo,11);assert.equal(f.combat.projectiles.length,1);assert.equal(f.combat.shotId,1);
  run(f,.4);
  assert.equal(f.rival.health,84);assert.equal(behind.health,100);assert.equal(f.combat.player.hits,1);
  assert.equal(f.combat.projectiles.length,0);
});

test('projectile sweep catches a kart crossing its path but preserves a parallel near miss',()=>{
  const f=setup();f.rival.x=3;f.combat.previous.rival.x=3;
  stepRaceCombat(f.combat,f.racers,f.t,{fire:true},1/60);run(f,.5);
  assert.equal(f.rival.health,100);
  f.rival.z=14;f.rival.x=-3;f.combat.previous.rival={x:3,z:14,y:0};
  f.combat.projectiles=[{id:999,ownerId:'you',x:0,y:.58,z:10,vx:0,vz:80,previousX:0,previousZ:10,travel:0,hint:0}];
  stepRaceCombat(f.combat,f.racers,f.t,{},.1);
  assert.equal(f.rival.health,84);
});

test('shots stop at the road edge and cannot cut through a city block',()=>{
  const f=setup();f.rival.x=20;f.rival.z=30;f.combat.previous.rival={x:20,y:0,z:30};f.you.yaw=Math.PI/4;
  stepRaceCombat(f.combat,f.racers,f.t,{fire:true},1/60);run(f,.6);
  assert.equal(f.rival.health,100);assert.equal(f.combat.projectiles.length,0);
  assert.ok(f.combat.bursts.length===0||f.combat.bursts.every(b=>b.ownerId!=='rival'));
});

test('enemy shots have a visible windup and can be avoided by changing lane',()=>{
  const f=setup();f.you.z=40;f.rival.z=10;f.combat.previous.you.z=40;f.combat.previous.rival.z=10;f.combat.weapons.rival.aiCooldown=0;
  stepRaceCombat(f.combat,f.racers,f.t,{},1/60);
  assert.equal(f.combat.warnings.length,1);assert.equal(f.combat.warnings[0].targetId,'you');
  run(f,.5);assert.equal(f.combat.projectiles.length,0);
  f.you.x=3;f.combat.previous.you.x=3;
  run(f,.9);assert.equal(f.combat.shotId,1);assert.equal(f.you.health,100);
});

test('shield absorbs a hit, uses a finite reserve, and recharges only while released',()=>{
  const f=setup();f.rival.z=5;f.you.z=10;f.combat.previous.you.z=10;
  f.combat.projectiles=[{id:1,ownerId:'rival',x:0,y:.58,z:8,vx:0,vz:80,previousX:0,previousZ:8,travel:0,hint:0}];
  stepRaceCombat(f.combat,f.racers,f.t,{shield:true},.05);
  assert.ok(Math.abs(f.you.health-97.6)<1e-8);assert.ok(f.combat.player.shield<86);
  const charge=f.combat.player.shield;run(f,.5,{shield:true});assert.ok(f.combat.player.shield<charge);
  const drained=f.combat.player.shield;run(f,.5);assert.ok(f.combat.player.shield>drained);
  f.combat.player.shield=0;run(f,.5,{shield:true});assert.equal(f.combat.player.shield,0);assert.equal(f.combat.player.shieldActive,false);
});

test('empty magazine reloads from finite reserve and firing cannot invent ammunition',()=>{
  const f=setup();f.rival.x=3;f.combat.previous.rival.x=3;f.combat.player.ammo=1;f.combat.player.reserve=2;
  stepRaceCombat(f.combat,f.racers,f.t,{fire:true},1/60);
  assert.equal(f.combat.player.ammo,0);assert.equal(f.combat.player.reserve,2);assert.equal(f.combat.player.reload,COMBAT_RULES.reloadSeconds);
  run(f,1);assert.equal(f.combat.player.ammo,0);
  run(f,.5);assert.equal(f.combat.player.ammo,2);assert.equal(f.combat.player.reserve,0);
  run(f,.4,{fire:true});assert.equal(f.combat.player.ammo,0);assert.equal(f.combat.player.reload,0);
  const shots=f.combat.shotId;run(f,2,{fire:true});assert.equal(f.combat.shotId,shots);
});

test('road supplies use a movement sweep, cooldowns and caps; recovery cannot collect a path',()=>{
  const f=setup();f.combat.pickups=[{id:0,kind:'repair',x:0,z:14,cooldown:0}];f.you.health=50;
  f.you.z=18;f.you.speed=80;stepRaceCombat(f.combat,f.racers,f.t,{},.1);
  assert.equal(f.you.health,74);assert.equal(f.combat.pickups[0].cooldown,18);
  f.combat.pickups[0].cooldown=0;f.you.health=98;f.you.z=14;stepRaceCombat(f.combat,f.racers,f.t,{},.1);assert.equal(f.you.health,100);
  f.combat.pickups[0].cooldown=0;f.you.health=50;f.combat.previous.you.z=0;f.you.z=40;f.you.speed=0;
  stepRaceCombat(f.combat,f.racers,f.t,{},.1);assert.equal(f.you.health,50);assert.equal(f.combat.pickups[0].cooldown,0);
});

test('lethal combat damage retires a kart exactly once and counts a knockout',()=>{
  const f=setup();f.rival.health=10;
  stepRaceCombat(f.combat,f.racers,f.t,{fire:true},1/60);run(f,.5,{fire:true});
  assert.equal(f.rival.health,0);assert.equal(f.rival.retired,true);assert.equal(f.rival.speed,0);
  assert.equal(f.combat.player.kills,1);assert.equal(f.combat.explosionId,1);
  run(f,.5,{fire:true});assert.equal(f.combat.player.kills,1);
});

test('pause is a strict no-op and effect buffers remain bounded during sustained fire',()=>{
  const f=setup(),before=JSON.stringify(f.combat);
  for(const dt of [0,-1,NaN,Infinity])stepRaceCombat(f.combat,f.racers,f.t,{fire:true,shield:true},dt);
  assert.equal(JSON.stringify(f.combat),before);
  f.rival.x=3;f.combat.previous.rival.x=3;
  for(let i=0;i<5000;i++){
    f.combat.player.ammo=12;f.combat.player.reserve=96;stepRaceCombat(f.combat,f.racers,f.t,{fire:true},1/60);
    assert.ok(f.combat.projectiles.length<=COMBAT_RULES.maxProjectiles);assert.ok(f.combat.bursts.length<=COMBAT_RULES.maxBursts);
  }
});
