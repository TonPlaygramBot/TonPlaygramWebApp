import test from 'node:test';
import assert from 'node:assert/strict';
import {ACTION_MISSIONS,createActionCareer,stepActionCareer,neutralActionInput,finishActionCareer,freshActionCareer,actionCareerXP,loadActionCareer,saveActionCareer,actionLineClear,actionCameraDistance} from '../webapp/src/games/kartroyale/actionCareer.mjs';
import {createDrivingWorld} from '../webapp/src/games/kartroyale/freeRoamCore.mjs';
import {makeTrack,createRacer} from '../webapp/src/games/kartroyale/simulation.mjs';
import {freeRoamWorld} from '../webapp/src/games/kartroyale/freeRoam.mjs';
import {npcWeaponPose} from '../webapp/src/games/tiranastreets/shared/npcWeaponPose.mjs';

function fixture(id='depot-recovery',world){
 const m=ACTION_MISSIONS.find(m=>m.id===id),track={id:m.track,width:8,length:4000,points:[{x:0,z:0,width:8},{x:0,z:1000,width:8},{x:1000,z:1000,width:8},{x:1000,z:0,width:8}]};
 const r={x:0,z:0,yaw:0,speed:0,health:100,groundY:0,bodyWidth:1.3,recoveryAt:-10,throttle:0};
 return {r,track,s:createActionCareer(id,track,r,world),world};
}
function tick(f,input={},count=1){for(let i=0;i<count;i++)stepActionCareer(f.s,f.r,{...neutralActionInput(),...input},.05,f.world);}
function interact(f){tick(f);tick(f,{interact:true});tick(f);}
function drive(f,target){
 let steps=0;
 while(Math.hypot(f.r.x-target.x,f.r.z-target.z)>.2&&steps++<2500){const dx=target.x-f.r.x,dz=target.z-f.r.z,d=Math.hypot(dx,dz),amount=Math.min(.5,d);f.r.x+=dx/d*amount;f.r.z+=dz/d*amount;f.r.yaw=Math.atan2(dx,dz);f.r.speed=10;tick(f);}
 f.r.speed=0;tick(f);assert.ok(steps<2500);
}
function walk(f,target){
 let steps=0;
 while(Math.hypot(f.s.actor.x-target.x,f.s.actor.z-target.z)>1.7&&steps++<2000){f.s.actor.yaw=Math.atan2(target.x-f.s.actor.x,target.z-f.s.actor.z);tick(f,{moveZ:1,sprint:true});}
 tick(f);assert.ok(steps<2000);
}
function complete(f){
 drive(f,f.s.park);assert.ok(f.s.driveDistance>20);interact(f);assert.equal(f.s.mode,'onfoot');assert.equal(f.s.stage,'clear');
 for(const enemy of f.s.enemies){let steps=0;f.s.actor.yaw=Math.atan2(enemy.x-f.s.actor.x,enemy.z-f.s.actor.z);while(enemy.health>0&&steps++<70)tick(f,{fire:true});assert.equal(enemy.health,0);}
 assert.equal(f.s.stage,'collect');walk(f,f.s.package);interact(f);assert.equal(f.s.stage,'return');assert.equal(f.s.collected,true);
 walk(f,f.r);interact(f);assert.equal(f.s.mode,'driving');assert.equal(f.s.stage,'extract');assert.equal(f.s.driveDistance,0);
 drive(f,f.s.extraction);tick(f,{},20);assert.equal(f.s.status,'complete');return f.s;
}

test('all three missions complete through real drive, foot combat, collection, return and extraction; replay XP is unique',()=>{
 let profile=freshActionCareer();
 for(const m of ACTION_MISSIONS){const f=fixture(m.id),state=complete(f),out=finishActionCareer(profile,state);assert.equal(out.xp,m.xp);profile=out.profile;assert.equal(finishActionCareer(profile,state).xp,0);assert.ok(state.footDistance>70);}
 assert.equal(actionCareerXP(profile),690);
});
test('all mission staging points, guards, objectives and extraction fit the current Tirana collision world',()=>{
 const world=freeRoamWorld();
 for(const m of ACTION_MISSIONS){const track={...makeTrack(m.track),terrainMode:'regional'},r=createRacer(track,'you','You'),s=createActionCareer(m.id,track,r,world);
  for(const target of [s.park,s.package,s.extraction,...s.enemies]){const p={...r,x:target.x,z:target.z,speed:0,bodyWidth:.56,bodyLength:.56,waterRecovery:0,impactCooldown:1};world.move(p,p.x,p.z,0);assert.equal(p.wallContact,false,`${m.id} ${target.id||'destination'} is obstructed`);assert.equal(p.waterRecovery,0);assert.ok(Math.hypot(p.x-target.x,p.z-target.z)<.08);}
 }
});
test('screen-right movement and aim remain visually right at every camera yaw',()=>{
 for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2,.7])for(const side of [-1,1]){const f=fixture();f.s.mode='onfoot';Object.assign(f.s.actor,{x:0,z:0,yaw});tick(f,{moveX:side});const rightProjection=f.s.actor.x*-Math.cos(yaw)+f.s.actor.z*Math.sin(yaw);assert.ok(rightProjection*side>0);
  const before=f.s.actor.yaw;tick(f,{turn:side});assert.ok(Math.atan2(Math.sin(f.s.actor.yaw-before),Math.cos(f.s.actor.yaw-before))*side<0);
 }
});
test('diagonal walking is normalized; sprint consumes stamina, jumping is edge-triggered and pause freezes timers',()=>{
 const a=fixture(),b=fixture();a.s.mode=b.s.mode='onfoot';tick(a,{moveZ:1});tick(b,{moveZ:1,moveX:1});assert.ok(Math.abs(a.s.actor.speed-b.s.actor.speed)<1e-9);
 tick(a,{moveZ:1,sprint:true,jump:true},1);assert.ok(a.s.actor.jumpHeight>0);tick(a,{jump:true},40);assert.equal(a.s.actor.jumpHeight,0,'holding jump must not bunny-hop');
 tick(a,{moveZ:1,sprint:true},105);assert.ok(a.s.actor.stamina<30);assert.ok(a.s.actor.exhausted);
 a.s.reload=1;const before=structuredClone(a.s);stepActionCareer(a.s,a.r,{...neutralActionInput(),fire:true,turn:1},0);assert.deepEqual(a.s,before);
});
test('recovery and teleports cannot stage a mission or award extraction progress',()=>{
 const f=fixture();Object.assign(f.r,{x:f.s.park.x,z:f.s.park.z,recoveryAt:1});tick(f,{interact:true});assert.equal(f.s.mode,'driving');assert.equal(f.s.driveDistance,0);assert.equal(f.s.stage,'drive');
 f.s.stage='extract';f.s.collected=f.s.staged=true;f.s.driveDistance=0;Object.assign(f.r,{x:f.s.extraction.x,z:f.s.extraction.z,recoveryAt:2});tick(f,{},80);assert.equal(f.s.status,'active');assert.equal(f.s.extractionHold,0);
 assert.equal(finishActionCareer(freshActionCareer(),{...f.s,status:'complete',medal:3}).xp,0);
});
test('solid cover stops walking, jumping and gunfire; chase camera retracts before a wall',()=>{
 const world=createDrivingWorld({bounds:[-200,-200,2000,2000],roads:[],buildings:[{p:[[-2,3],[2,3],[2,5],[-2,5]],h:5}],waterPolygons:[{outer:[[8,-3],[15,-3],[15,3],[8,3]],holes:[]}]});
 const f=fixture('depot-recovery',world);f.s.mode='onfoot';Object.assign(f.s.actor,{x:0,z:0,yaw:0});tick(f,{moveZ:1,sprint:true,jump:true},40);assert.ok(f.s.actor.z<3);assert.ok(f.s.actor.z>=0);
 assert.equal(actionLineClear(world,{x:0,z:0},{x:0,z:10}),false);assert.equal(actionLineClear(world,{x:3,z:0},{x:3,z:10}),true);
 const camera=actionCameraDistance(world,{x:0,z:8},0,6);assert.ok(camera<3&&camera>.5);
 Object.assign(f.s.actor,{x:6,z:0,yaw:Math.PI/2});tick(f,{moveZ:1,sprint:true,jump:true},30);assert.ok(f.s.actor.x<8,'jump must not bypass water');
});
test('shooting needs forward aim, clear line of sight, ammunition and cooldown; reload conserves rounds',()=>{
 const f=fixture();f.s.mode='onfoot';f.s.stage='clear';const enemy=f.s.enemies[0];Object.assign(f.s.actor,{x:enemy.x,z:enemy.z-10,yaw:Math.PI});tick(f,{fire:true});assert.equal(enemy.health,60);assert.equal(f.s.ammo,11);
 f.s.actor.yaw=0;tick(f,{},6);tick(f,{fire:true});assert.equal(enemy.health,30);const ammunition=f.s.ammo;tick(f,{fire:true});assert.equal(f.s.ammo,ammunition);
 const total=f.s.ammo+f.s.reserve;tick(f,{reload:true});assert.ok(f.s.reload>0);tick(f,{},30);assert.equal(f.s.ammo,12);assert.equal(f.s.ammo+f.s.reserve,total);
 const world=createDrivingWorld({bounds:[-200,-200,2000,2000],roads:[],buildings:[{p:[[enemy.x-2,enemy.z-6],[enemy.x+2,enemy.z-6],[enemy.x+2,enemy.z-4],[enemy.x-2,enemy.z-4]],h:10}]});f.world=world;const health=enemy.health;tick(f,{fire:true},10);assert.equal(enemy.health,health);
});
test('guard attack locks a visible warning before firing, can be evaded, and damages kart or pedestrian separately',()=>{
 const f=fixture();const enemy=f.s.enemies[0];f.s.enemies=[enemy];f.s.mode='onfoot';f.s.stage='clear';Object.assign(f.s.actor,{x:enemy.x,z:enemy.z-8});enemy.cooldown=0;tick(f);assert.ok(enemy.warning>0);assert.equal(f.s.projectiles.length,0);assert.equal(f.s.actor.health,100);
 tick(f,{},18);assert.equal(f.s.projectiles.length,0);f.s.actor.x+=3;tick(f,{},20);assert.equal(f.s.actor.health,100,'moving out of the locked warning evades the shot');
 Object.assign(f.s.actor,{x:enemy.x,z:enemy.z-3});enemy.cooldown=0;enemy.warning=0;tick(f,{},30);assert.ok(f.s.actor.health<100);
 f.s.mode='driving';Object.assign(f.r,{x:enemy.x,z:enemy.z-3});enemy.cooldown=0;enemy.warning=0;tick(f,{},30);assert.ok(f.r.health<100);
});
test('timeout and defeat fail cleanly and cannot earn XP; corrupt or unavailable persistence is safe',()=>{
 const a=fixture();a.s.elapsed=a.s.seconds-.01;tick(a);assert.equal(a.s.status,'failed');assert.equal(finishActionCareer(freshActionCareer(),a.s).xp,0);
 const b=fixture();b.s.actor.health=0;tick(b);assert.equal(b.s.status,'failed');
 const profile=freshActionCareer();profile.medals['depot-recovery']=2;profile.best['depot-recovery']=120;const values=new Map([['unrelated','keep']]),storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
 assert.equal(saveActionCareer(storage,profile),true);assert.deepEqual(loadActionCareer(storage),profile);assert.equal(values.get('unrelated'),'keep');assert.deepEqual(loadActionCareer({getItem(){return '{';}}),freshActionCareer());assert.equal(saveActionCareer({setItem(){throw Error();}},profile),false);
});
test('fatal damage on the extraction tick cannot be overwritten by completion or award XP',()=>{
 const f=fixture();Object.assign(f.s,{stage:'extract',mode:'driving',collected:true,staged:true,kills:2,driveDistance:35,extractionHold:.74});
 Object.assign(f.r,{x:f.s.extraction.x,z:f.s.extraction.z,health:7});f.s.previous={x:f.r.x,z:f.r.z};f.s.projectiles=[{id:99,x:f.r.x,z:f.r.z,y:1,dx:0,dz:0,ttl:1}];
 tick(f);assert.equal(f.r.health,0);assert.equal(f.s.status,'failed');assert.equal(finishActionCareer(freshActionCareer(),f.s).xp,0);
});
test('queued interact and jump taps survive a release before the next simulation step',()=>{
 const f=fixture();drive(f,f.s.park);tick(f,{interactPressed:true});assert.equal(f.s.mode,'onfoot');tick(f,{jumpPressed:true});assert.ok(f.s.actor.jumpHeight>0);
});
test('held weapon muzzle and projectile facing share the full-size Turi forward direction',()=>{
 for(const yaw of [0,.7,Math.PI/2,Math.PI]){
  const pose=npcWeaponPose({x:10,z:20,y:0,heading:yaw+Math.PI,weapon:'assaultRifleAttack',anim:'aim'}),localMuzzle={x:-.06,y:1.425,z:.589};
  assert.ok(Math.abs(pose.worldMuzzle.x-(10+Math.cos(yaw)*localMuzzle.x+Math.sin(yaw)*localMuzzle.z))<1e-9);
  assert.ok(Math.abs(pose.worldMuzzle.z-(20-Math.sin(yaw)*localMuzzle.x+Math.cos(yaw)*localMuzzle.z))<1e-9);
 }
});
