import {sampleCircuitDistance} from './circuitMetrics.mjs';
import {surfaceHeight} from './racingSurface.mjs';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const finite=n=>Number.isFinite(n)?n:0;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const tracks=new WeakMap();
export const ACTION_CAREER_KEY='tonplaygram.racing.action-career.v1';
export const ACTION_MISSIONS=Object.freeze([
 {id:'depot-recovery',title:'Depot recovery',district:'Qendër',track:'skanderbeg',kind:'recovery',unlock:0,xp:180,seconds:300,drive:85,guards:2,brief:'Drive to the marked rendezvous, park and get out. Defeat two armed rivals, recover the parcel, then return to your kart and extract.'},
 {id:'river-relay',title:'River relay',district:'Lana',track:'lana',kind:'sabotage',unlock:180,xp:230,seconds:330,drive:120,guards:3,brief:'Follow the main road to a rival relay. Dismount, defeat three guards and shut down the relay before driving the data to extraction.'},
 {id:'medical-retrieval',title:'Emergency retrieval',district:'Blloku',track:'blloku',kind:'rescue',unlock:410,xp:280,seconds:360,drive:150,guards:4,brief:'Recover a stolen medical case. Clear four rival guards on foot, collect the supplies and drive them to the marked handover.'}
].map(m=>Object.freeze(m)));

export const neutralActionInput=()=>({moveX:0,moveZ:0,turn:0,sprint:false,fire:false,jump:false,interact:false,reload:false});
export const freshActionCareer=()=>({version:1,medals:{},best:{}});
export function normalizeActionCareer(raw){
 const p=freshActionCareer();if(raw?.version!==1)return p;
 for(const m of ACTION_MISSIONS){const medal=raw.medals?.[m.id],time=raw.best?.[m.id];if(Number.isInteger(medal)&&medal>=1&&medal<=3)p.medals[m.id]=medal;if(p.medals[m.id]&&Number.isFinite(time)&&time>0)p.best[m.id]=time;}
 return p;
}
export const actionCareerXP=p=>{const profile=normalizeActionCareer(p);return ACTION_MISSIONS.reduce((sum,m)=>sum+(profile.medals[m.id]?m.xp:0),0);};
export function loadActionCareer(storage){try{return normalizeActionCareer(JSON.parse(storage?.getItem(ACTION_CAREER_KEY)||'null'));}catch{return freshActionCareer();}}
export function saveActionCareer(storage,p){try{if(!storage)return false;storage.setItem(ACTION_CAREER_KEY,JSON.stringify(normalizeActionCareer(p)));return true;}catch{return false;}}

/** A human-sized collision proxy reuses the same buildings, barriers and water
 * as driving. Jumping changes presentation and projectile evasion; it does not
 * permit jumping through tall walls or across the river collision boundary. */
function probeAt(p,radius=.28){return {x:p.x,z:p.z,yaw:p.yaw||0,velocityYaw:p.yaw||0,speed:0,bodyLength:radius*2,bodyWidth:radius*2,health:100,shield:0,retired:false,finished:false,impactId:0,impactCooldown:1,yawRate:0,wallContact:false,waterRecovery:0,airborne:false,jumpHeight:0};}
function clearPoint(world,p,radius=.28){
 if(!world)return true;
 const probe=probeAt(p,radius);world.move(probe,p.x,p.z,0);
 return !probe.wallContact&&!probe.waterRecovery&&distance(probe,p)<.08;
}
/** Ground-level clearance is intentionally conservative: solid cover blocks
 * shots even if a model's visual accessory is shorter than the character. */
export function actionLineClear(world,from,to){
 if(!world)return true;
 const length=distance(from,to);if(length<.01)return true;
 const p=probeAt({...from,yaw:Math.atan2(to.x-from.x,to.z-from.z)},.025);
 p.x=to.x;p.z=to.z;p.speed=length/.05;world.move(p,from.x,from.z,.05);
 return !p.wallContact&&!p.waterRecovery&&distance(p,to)<.1;
}
export function actionCameraDistance(world,actor,yaw,desired=4.8){
 if(!world)return desired;
 for(let d=desired;d>=.6;d-=.25){const end={x:actor.x-Math.sin(yaw)*d,z:actor.z-Math.cos(yaw)*d};if(actionLineClear(world,actor,end))return d;}
 return .4;
}
function safeSample(track,metres,world,side=0){
 for(const advance of [0,2,-2,5,-5,9,-9]){
  const p=sampleCircuitDistance(track,metres+advance),width=track.points[p.index]?.width||track.width||6;
  for(const offset of [side*Math.min(1.1,width*.16),0]){
   const candidate={...p,x:p.x+Math.cos(p.yaw)*offset,z:p.z-Math.sin(p.yaw)*offset};
   if(clearPoint(world,candidate,.36))return {...candidate,groundY:surfaceHeight(track,candidate.x,candidate.z)};
  }
 }
 throw Error('The mission rendezvous is obstructed on this route. Choose another mission.');
}
export function createActionCareer(id,track,racer,world){
 const m=ACTION_MISSIONS.find(m=>m.id===id);if(!m||track.id!==m.track)throw Error('This action mission requires its mapped route.');
 const at=Math.min(m.drive,track.length*.08),park=safeSample(track,at,world),objective=safeSample(track,at+48,world),extraction=safeSample(track,at+125,world);
 const state={id,status:'active',mode:'driving',stage:'drive',objective:'Drive to the rendezvous, stop and tap EXIT KART.',elapsed:0,seconds:m.seconds,reason:'',medal:0,distance:distance(racer,park),
  actor:{x:racer.x,z:racer.z,yaw:racer.yaw,groundY:racer.groundY||0,jumpHeight:0,jumpVelocity:0,speed:0,health:100,stamina:100,exhausted:false},
  park,package:objective,extraction,ammo:12,reserve:48,reload:0,fireCooldown:0,firedAt:-10,interactHeld:false,jumpHeld:false,
  collected:false,staged:false,driveDistance:0,extractionHold:0,footDistance:0,kills:0,hitId:0,shots:[],projectiles:[],shotId:0,
  previous:{x:racer.x,z:racer.z},recoveryAt:racer.recoveryAt??-10,progressBlocked:0,
  enemies:Array.from({length:m.guards},(_,i)=>({id:`guard-${i}`,...safeSample(track,at+14+i*8,world,i%2?-1:1),health:60,yaw:park.yaw+Math.PI,cooldown:1.3+i*.55,warning:0,aimX:0,aimZ:0,firedAt:-10,sightCooldown:0,sightX:0,sightZ:0,hasSight:false}))};
 tracks.set(state,track);return state;
}
function safeDismount(state,r,world){
 const offset=(r.bodyWidth||1.3)*.5+.65;
 for(const [side,ahead] of [[1,0],[-1,0],[0,-1],[0,1]]){
  const p={x:r.x+Math.cos(r.yaw)*offset*side+Math.sin(r.yaw)*1.6*ahead,z:r.z-Math.sin(r.yaw)*offset*side+Math.cos(r.yaw)*1.6*ahead,yaw:r.yaw};
  if(clearPoint(world,p)&&actionLineClear(world,r,p))return p;
 }
 return null;
}
function objectiveText(s,r){
 const a=s.actor;
 if(s.stage==='drive'){s.distance=distance(s.mode==='onfoot'?a:r,s.park);s.objective=s.mode==='onfoot'?'Return to your kart and drive to the rendezvous.':'Drive to the rendezvous, stop and tap EXIT KART.';}
 else if(s.stage==='clear'){const alive=s.enemies.filter(e=>e.health>0);s.distance=alive.length?Math.min(...alive.map(e=>distance(e,a))):0;s.objective=`Defeat the rival guards · ${s.kills}/${s.enemies.length}. Red rings warn before they fire.`;}
 else if(s.stage==='collect'){s.distance=distance(a,s.package);s.objective=s.id==='river-relay'?'Reach the cyan relay and tap COLLECT to recover its data.':'Reach the cyan case marker and tap COLLECT.';}
 else if(s.stage==='return'){s.distance=distance(a,r);s.objective='Return to your parked kart and tap ENTER KART.';}
 else {s.distance=distance(r,s.extraction);s.objective='Drive to extraction and stop inside the cyan ring.';}
}
function pointSegment(p,a,b){const dx=b.x-a.x,dz=b.z-a.z,t=clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1),0,1);return Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t);}
function firePlayer(s,world){
 const a=s.actor,range=45,direction={x:Math.sin(a.yaw),z:Math.cos(a.yaw)};
 let target=null,best=range;
 for(const enemy of s.enemies){
  if(enemy.health<=0)continue;
  const dx=enemy.x-a.x,dz=enemy.z-a.z,d=Math.hypot(dx,dz),along=dx*direction.x+dz*direction.z,across=Math.abs(dx*direction.z-dz*direction.x);
  // A small angular assist is useful on portrait touch controls; no lock through cover.
  if(along>0&&d<best&&across<.4+d*.065&&a.jumpHeight<1.45&&actionLineClear(world,a,enemy)){target=enemy;best=d;}
 }
 const end=target||{x:a.x+direction.x*range,z:a.z+direction.z*range};
 s.shots.push({id:++s.shotId,x:a.x,z:a.z,y:a.groundY+a.jumpHeight+1.35,toX:end.x,toZ:end.z,toY:(target?.groundY??a.groundY)+1.1,at:s.elapsed,enemy:false,hit:!!target});
 s.ammo--;s.fireCooldown=.24;s.firedAt=s.elapsed;
 if(target){target.health=Math.max(0,target.health-30);if(target.health===0){target.warning=0;s.kills++;}}
}
function stepEnemies(s,r,world,dt){
 const a=s.actor;
 for(const e of s.enemies){
  if(e.health<=0)continue;
  e.yaw=Math.atan2(a.x-e.x,a.z-e.z);
  if(distance(e,a)>42){e.warning=0;continue;}
  // Static-world LOS is sampled at 5 Hz while nearby actors move smoothly;
  // collision sweeps still test each projectile step before it can hit.
  e.sightCooldown=Math.max(0,(e.sightCooldown||0)-dt);
  if(e.sightCooldown===0||Math.hypot(a.x-e.sightX,a.z-e.sightZ)>1){e.hasSight=actionLineClear(world,e,a);e.sightCooldown=.2;e.sightX=a.x;e.sightZ=a.z;}
  if(!e.hasSight){e.warning=0;continue;}
  if(e.warning>0){
   e.warning=Math.max(0,e.warning-dt);
   if(e.warning===0){
    const d=Math.hypot(e.aimX-e.x,e.aimZ-e.z)||1;
    s.projectiles.push({id:++s.shotId,x:e.x,z:e.z,y:e.groundY+1.05,dx:(e.aimX-e.x)/d*17,dz:(e.aimZ-e.z)/d*17,ttl:3});
    e.firedAt=s.elapsed;e.cooldown=2.8;
   }
  }else if((e.cooldown-=dt)<=0){e.warning=1;e.aimX=a.x;e.aimZ=a.z;}
 }
 for(const p of s.projectiles){
  const previous={x:p.x,z:p.z},next={x:p.x+p.dx*dt,z:p.z+p.dz*dt};
  p.ttl-=dt;
  if(!actionLineClear(world,previous,next)){p.ttl=0;continue;}
  p.x=next.x;p.z=next.z;
  if(a.jumpHeight<.8&&pointSegment(a,previous,next)<(s.mode==='onfoot'?.39:.85)){
   if(s.mode==='onfoot')a.health=Math.max(0,a.health-9);
   else r.health=Math.max(0,r.health-7);
   s.hitId++;p.ttl=0;
  }
 }
 s.projectiles=s.projectiles.filter(p=>p.ttl>0).slice(-20);
}
/** Call after stepRacer while driving; skip stepRacer while on foot. The parked
 * kart stays at its actual location. All timers use the fixed step, so pausing
 * does not progress warnings, attacks, reloads, stamina or mission deadlines. */
export function stepActionCareer(s,r,input,dt,world){
 if(s.status!=='active'||!Number.isFinite(dt)||dt<=0)return s;
 dt=Math.min(dt,.05);s.elapsed+=dt;const a=s.actor,track=tracks.get(s),m=ACTION_MISSIONS.find(m=>m.id===s.id);
 if(!m)return s;
 const jump=!!input.jumpPressed||!!input.jump&&!s.jumpHeld,interact=!!input.interactPressed||!!input.interact&&!s.interactHeld;
 s.jumpHeld=!!input.jump;s.interactHeld=!!input.interact;
 const travel=distance(r,s.previous),continuous=Number.isFinite(travel)&&travel<=Math.max(3,Math.abs(finite(r.speed))*dt*2+.5)&&s.recoveryAt===(r.recoveryAt??-10);
 if(!continuous)s.progressBlocked=1;
 else s.progressBlocked=Math.max(0,s.progressBlocked-dt);
 s.previous={x:r.x,z:r.z};s.recoveryAt=r.recoveryAt??-10;
 if(r.retired||r.disconnected||r.health<=0||a.health<=0){s.status='failed';s.reason='Mission failed. Retry with full health and ammunition.';return s;}
 if(s.elapsed>=s.seconds){s.status='failed';s.reason='Time expired. Retry the mission.';return s;}
 s.fireCooldown=Math.max(0,s.fireCooldown-dt);
 if(s.reload>0){s.reload=Math.max(0,s.reload-dt);if(s.reload===0){const count=Math.min(12-s.ammo,s.reserve);s.ammo+=count;s.reserve-=count;}}
 if(input.reload&&s.reload===0&&s.ammo<12&&s.reserve>0)s.reload=1.35;
 if(s.mode==='driving'){
  if(continuous&&!r.waterRecovery&&r.speed>0)s.driveDistance+=travel;
  Object.assign(a,{x:r.x,z:r.z,yaw:r.yaw,groundY:r.groundY||0,jumpHeight:0,jumpVelocity:0,speed:0});
  a.stamina=Math.min(100,a.stamina+dt*17);
  if(input.fire&&s.ammo>0&&s.reload===0&&s.fireCooldown===0)firePlayer(s,world);
  if(interact&&Math.abs(r.speed)<.8&&!r.waterRecovery&&!s.progressBlocked){
   const exit=safeDismount(s,r,world);
   if(exit){
    s.mode='onfoot';Object.assign(a,exit);r.speed=0;r.throttle=0;
    if(s.stage==='drive'&&distance(r,s.park)<6&&s.driveDistance>=20){s.stage='clear';s.staged=true;}
   }
  }
 }else{
  r.speed=0;r.throttle=0;
  // A camera looking forward (+Z at yaw zero) sees -X on its right. Match
  // screen directions, just as the shared kart steering does.
  a.yaw=wrap(a.yaw-clamp(finite(input.turn),-1,1)*dt*2.1);
  let side=clamp(finite(input.moveX),-1,1),forward=clamp(finite(input.moveZ),-1,1),magnitude=Math.hypot(side,forward);
  if(magnitude>1){side/=magnitude;forward/=magnitude;magnitude=1;}
  if(a.stamina<=1)a.exhausted=true;else if(a.stamina>=30)a.exhausted=false;
  const running=!!input.sprint&&magnitude>.1&&!a.exhausted&&a.stamina>1,speed=running?5.6:2.5;
  a.stamina=clamp(a.stamina+dt*(running?-21:13),0,100);
  if(jump&&a.jumpHeight===0&&a.stamina>=12){a.jumpVelocity=5.2;a.stamina-=12;}
  a.jumpVelocity-=12*dt;a.jumpHeight=Math.max(0,a.jumpHeight+a.jumpVelocity*dt);if(a.jumpHeight===0)a.jumpVelocity=0;
  const previous={x:a.x,z:a.z},dx=(Math.sin(a.yaw)*forward-Math.cos(a.yaw)*side)*speed*dt,dz=(Math.cos(a.yaw)*forward+Math.sin(a.yaw)*side)*speed*dt;
  const p=probeAt(a);p.x+=dx;p.z+=dz;p.speed=Math.hypot(dx,dz)/dt;p.velocityYaw=Math.atan2(dx,dz);
  if(world)world.move(p,previous.x,previous.z,dt);
  if(!p.waterRecovery){a.x=p.x;a.z=p.z;}
  a.speed=distance(a,previous)/dt;s.footDistance+=distance(a,previous);
  if(track)a.groundY=surfaceHeight(track,a.x,a.z);
  if(input.fire&&s.ammo>0&&s.reload===0&&s.fireCooldown===0)firePlayer(s,world);
  if(s.stage==='clear'&&s.enemies.every(e=>e.health<=0))s.stage='collect';
  if(interact&&a.jumpHeight<.05){
   if(s.stage==='collect'&&distance(a,s.package)<2.4&&actionLineClear(world,a,s.package)){
    s.collected=true;s.stage='return';a.health=Math.min(100,a.health+20);
   }else if(distance(a,r)<3&&actionLineClear(world,a,r)){
    s.mode='driving';Object.assign(a,{x:r.x,z:r.z,yaw:r.yaw,speed:0});
    if(s.stage==='return'){s.stage='extract';s.driveDistance=0;s.previous={x:r.x,z:r.z};}
   }
  }
 }
 stepEnemies(s,r,world,dt);
 if(a.health<=0||r.health<=0){s.status='failed';s.reason=a.health<=0?'You were defeated. Move during the red warning, use cover, or jump to evade.':'Your kart was disabled. Retry the mission and evade the red attack warnings.';return s;}
 if(s.stage==='extract'&&s.mode==='driving'){
  s.extractionHold=continuous&&!s.progressBlocked&&s.driveDistance>=30&&distance(r,s.extraction)<6&&Math.abs(r.speed)<.8&&!r.waterRecovery?s.extractionHold+dt:0;
  if(s.extractionHold>=.75){s.status='complete';s.medal=1+Number(a.health>=60&&s.elapsed<s.seconds*.85)+Number(a.health>=85&&s.elapsed<s.seconds*.65);s.reason=`${['','Bronze','Silver','Gold'][s.medal]} · mission complete`;}
 }
 s.shots=s.shots.filter(shot=>s.elapsed-shot.at<.18).slice(-16);
 objectiveText(s,r);return s;
}
export function finishActionCareer(profile,state){
 const p=normalizeActionCareer(profile),m=ACTION_MISSIONS.find(m=>m.id===state?.id);
 if(!m||state.status!=='complete'||state.stage!=='extract'||!state.collected||!state.staged||state.kills!==m.guards||state.actor.health<=0||state.driveDistance<30||!(state.elapsed>0&&state.elapsed<m.seconds)||!Number.isInteger(state.medal)||state.medal<1||state.medal>3||actionCareerXP(p)<m.unlock)return {profile:p,xp:0};
 const first=!p.medals[m.id];p.medals[m.id]=Math.max(p.medals[m.id]||0,state.medal);p.best[m.id]=Math.min(p.best[m.id]||Infinity,state.elapsed);return {profile:p,xp:first?m.xp:0};
}
