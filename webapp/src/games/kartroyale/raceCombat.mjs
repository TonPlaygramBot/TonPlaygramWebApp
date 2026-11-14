import { nearestPoint } from './legacySimulation.mjs';
import { sampleCircuitDistance } from './circuitMetrics.mjs';
import { surfaceHeight } from './racingSurface.mjs';

/** Local combat is deliberately opt-in. The shared race/server simulation stays
 * nonlethal and cannot be armed through the legacy wire fields. Call this AFTER
 * the regular fixed physics step, only for a local combat session. */
export const COMBAT_RULES = Object.freeze({
  magazine: 12, reserve: 48, reserveMax: 96, reloadSeconds: 1.4,
  shotInterval: .18, shotSpeed: 80, shotDamage: 16, range: 96,
  warningSeconds: .85, shieldMax: 100, shieldDrain: 22, shieldRecharge: 7,
  pickupRespawn: 18, maxProjectiles: 64, maxBursts: 40, maxPickups: 18
});
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const active = r => r && !r.finished && !r.retired && !r.disconnected;
const ground = (track, r) => (r.groundY ?? surfaceHeight(track,r.x,r.z)) + (r.jumpHeight || 0);
const position = (track, r) => ({x:r.x,z:r.z,y:ground(track,r)});
const weapon = () => ({ammo:COMBAT_RULES.magazine,reserve:COMBAT_RULES.reserve,reload:0,cooldown:0,shield:100,shieldActive:false,kills:0,hits:0,aiCooldown:1,windup:0,aim:0,targetId:''});

export function createRaceCombat(track, racers, playerId = 'you') {
  if (!track?.points?.length || !racers.some(r => r.id === playerId)) throw Error('Combat race needs a track and player');
  const weapons = {}, previous = {};
  for (const r of racers) {
    weapons[r.id] = weapon();
    weapons[r.id].aiCooldown = 1.5 + r.slot * .31;
    previous[r.id] = position(track,r);
  }
  const count = clamp(Math.floor(track.length / 130),6,COMBAT_RULES.maxPickups);
  const pickups = Array.from({length:count},(_,i) => {
    const p=sampleCircuitDistance(track,track.length*((i+.42)/count));
    const width=track.points[p.index].width || track.width;
    const lane=(i%2?1:-1)*Math.max(0,Math.min(1.2,width*.16));
    return {id:i,kind:['ammo','repair','shield'][i%3],x:p.x+Math.cos(p.yaw)*lane,z:p.z-Math.sin(p.yaw)*lane,cooldown:0};
  });
  const state = {playerId,player:weapons[playerId],weapons,previous,pickups,projectiles:[],warnings:[],bursts:[],elapsed:0,serial:0,shotId:0,explosionId:0};
  mirror(state,racers);
  return state;
}

function mirror(state,racers) {
  for(const r of racers){
    const w=state.weapons[r.id];if(!w)continue;
    r.ammunition=w.ammo;r.shieldMax=100;r.shield=w.shield;
    r.shieldActive=active(r)&&w.shieldActive;r.fireCooldown=w.cooldown;
  }
}
function burst(state,x,y,z,kind,ownerId='') {
  if(state.bursts.length>=COMBAT_RULES.maxBursts)state.bursts.shift();
  state.bursts.push({id:++state.serial,x,y,z,kind,ownerId,age:0});
}
function reload(w){if(w.reload<=0&&w.ammo<COMBAT_RULES.magazine&&w.reserve>0)w.reload=COMBAT_RULES.reloadSeconds;}

function fire(state,r,track,yaw) {
  const w=state.weapons[r.id];
  if(!active(r)||w.reload>0||w.cooldown>0||w.ammo<=0||state.projectiles.length>=COMBAT_RULES.maxProjectiles)return false;
  w.ammo--;w.cooldown=COMBAT_RULES.shotInterval;
  const listener=state.previous[state.playerId];
  if(r.id===state.playerId||listener&&Math.hypot(r.x-listener.x,r.z-listener.z)<80)state.shotId++;
  const muzzle=(r.bodyLength||2)*.5+.16,s=Math.sin(yaw),c=Math.cos(yaw);
  const x=r.x+s*muzzle,z=r.z+c*muzzle,y=ground(track,r)+.58;
  state.projectiles.push({id:++state.serial,ownerId:r.id,x,z,y,previousX:x,previousZ:z,vx:s*COMBAT_RULES.shotSpeed,vz:c*COMBAT_RULES.shotSpeed,travel:0,hint:r.index});
  burst(state,x,y,z,'muzzle',r.id);
  return true;
}

// A swept relative segment against the moving kart's oriented footprint. This
// prevents tunnelling at low frame rates and preserves misses between lanes.
function hitFraction(p,next,r,previous,track){
  const c=Math.cos(r.yaw),s=Math.sin(r.yaw),height=ground(track,r);
  const local=(x,z)=>[c*x-s*z,s*x+c*z];
  const a=local(p.x-previous.x,p.z-previous.z),b=local(next.x-r.x,next.z-r.z);
  a.push(p.y-previous.y);b.push(p.y-height);
  const low=[-(r.bodyWidth||1.27)*.5-.08,-(r.bodyLength||2)*.5-.08,.12];
  const high=[-low[0],-low[1],1.55];
  let enter=0,exit=1;
  for(let i=0;i<3;i++){
    const delta=b[i]-a[i];
    if(Math.abs(delta)<1e-8){if(a[i]<low[i]||a[i]>high[i])return null;}
    else {const n=(low[i]-a[i])/delta,f=(high[i]-a[i])/delta;enter=Math.max(enter,Math.min(n,f));exit=Math.min(exit,Math.max(n,f));}
    if(enter>exit)return null;
  }
  return enter;
}

// Bullets are confined to the road ribbon; a shot cannot cut across a city
// block, or carry through the inside of a hairpin to another road segment.
function roadExit(track,p,next){
  const distance=Math.hypot(next.x-p.x,next.z-p.z),steps=Math.max(1,Math.ceil(distance/1));
  for(let i=0;i<=steps;i++){
    const f=i/steps,x=p.x+(next.x-p.x)*f,z=p.z+(next.z-p.z)*f;
    const near=nearestPoint(track,x,z,p.hint);p.hint=near.index;
    if(near.distance>near.width*.5+.08)return f;
  }
  return Infinity;
}
function clearShot(track,r,x,z){
  const p={x:r.x,z:r.z,hint:r.index};
  return roadExit(track,p,{x,z})===Infinity;
}
function aiTarget(state,r,racers,track){
  let best=null,bestDistance=Infinity;
  for(const other of racers){
    if(other.id===r.id||!active(other))continue;
    const dx=other.x-r.x,dz=other.z-r.z,d=Math.hypot(dx,dz);
    if(d<4||d>62||d>=bestDistance||Math.abs(ground(track,other)-ground(track,r))>.9)continue;
    const angle=Math.atan2(dx,dz)-r.yaw;
    if(Math.cos(angle)<.94||!clearShot(track,r,other.x,other.z))continue;
    best=other;bestDistance=d;
  }
  return best;
}
function damage(state,target,amount,source,at){
  const w=state.weapons[target.id];
  if(w.shieldActive&&w.shield>0){const absorbed=Math.min(w.shield,amount*.85);w.shield-=absorbed;amount-=absorbed;}
  target.health=clamp((Number.isFinite(target.health)?target.health:100)-amount,0,100);
  target.hitFlash=.28;target.collision=Math.max(target.collision||0,.12);
  const shooter=state.weapons[source];if(shooter)shooter.hits++;
  burst(state,at.x,at.y,at.z,'impact',source);
  if(target.health<=0){
    target.retired=true;target.speed=0;target.throttle=0;target.drifting=false;target.boosting=false;target.turbo=0;
    w.shieldActive=false;w.windup=0;
    if(shooter)shooter.kills++;
    const listener=state.previous[state.playerId];
    if(listener&&Math.hypot(target.x-listener.x,target.z-listener.z)<100)state.explosionId++;
    burst(state,target.x,at.y,target.z,'explosion',source);
  }
}
function sweepCircle(ax,az,bx,bz,x,z,radius){
  const dx=bx-ax,dz=bz-az,den=dx*dx+dz*dz;
  const t=den>0?clamp(((x-ax)*dx+(z-az)*dz)/den,0,1):0;
  return Math.hypot(ax+dx*t-x,az+dz*t-z)<=radius;
}

/** dt is simulation time. No wall-clock timers, random rolls, hidden damage or
 * unlimited enemy ammo. A paused session (dt <= 0) is a strict no-op. */
export function stepRaceCombat(state,racers,track,input,dt,_time){
  if(!Number.isFinite(dt)||dt<=0)return;
  dt=Math.min(dt,.1);input||={};state.elapsed+=dt;
  for(const b of state.bursts)b.age+=dt;
  state.bursts=state.bursts.filter(b=>b.age<(b.kind==='explosion'?1.05:b.kind==='muzzle'?.07:.5));
  for(const pickup of state.pickups)pickup.cooldown=Math.max(0,pickup.cooldown-dt);
  for(const r of racers){
    const w=state.weapons[r.id];if(!w)continue;
    w.cooldown=Math.max(0,w.cooldown-dt);w.aiCooldown=Math.max(0,w.aiCooldown-dt);
    if(w.reload>0){
      w.reload=Math.max(0,w.reload-dt);
      if(!w.reload){const amount=Math.min(COMBAT_RULES.magazine-w.ammo,w.reserve);w.ammo+=amount;w.reserve-=amount;}
    }
    if(!active(r)){w.shieldActive=false;w.windup=0;continue;}
    const controlled=r.id===state.playerId;
    const wantsShield=controlled&&input.shield===true;
    w.shieldActive=wantsShield&&w.shield>0;
    w.shield=clamp(w.shield+dt*(wantsShield?(w.shieldActive?-COMBAT_RULES.shieldDrain:0):COMBAT_RULES.shieldRecharge),0,100);
    if(w.shield<=0)w.shieldActive=false;
    if(controlled){
      if(input.reload)reload(w);
      if(input.fire)fire(state,r,track,r.yaw);
    }else if(w.windup>0){
      w.windup=Math.max(0,w.windup-dt);
      if(w.windup<=0){fire(state,r,track,w.aim);w.aiCooldown=2.1+(r.slot%3)*.24;w.targetId='';}
    }else if(w.aiCooldown<=0&&w.ammo>0&&w.reload<=0){
      const target=aiTarget(state,r,racers,track);
      if(target){w.windup=COMBAT_RULES.warningSeconds;w.aim=Math.atan2(target.x-r.x,target.z-r.z);w.targetId=target.id;}
      else w.aiCooldown=.22;
    }
    if(w.ammo<=0)reload(w);
  }
  const live=[];
  for(const p of state.projectiles){
    const next={x:p.x+p.vx*dt,z:p.z+p.vz*dt};
    let first=roadExit(track,p,next),target=null;
    for(const r of racers){
      if(r.id===p.ownerId||!active(r))continue;
      const f=hitFraction(p,next,r,state.previous[r.id]||position(track,r),track);
      if(f!==null&&f<first){first=f;target=r;}
    }
    if(first<=1){
      const at={x:p.x+(next.x-p.x)*first,y:p.y,z:p.z+(next.z-p.z)*first};
      if(target)damage(state,target,COMBAT_RULES.shotDamage,p.ownerId,at);
      else burst(state,at.x,at.y,at.z,'impact');
      continue;
    }
    p.previousX=p.x;p.previousZ=p.z;p.x=next.x;p.z=next.z;p.travel+=COMBAT_RULES.shotSpeed*dt;
    if(p.travel<COMBAT_RULES.range)live.push(p);
  }
  state.projectiles=live;
  for(const pickup of state.pickups){
    if(pickup.cooldown>0)continue;
    for(const r of racers){
      if(!active(r)||r.airborne||(r.jumpHeight||0)>.65)continue;
      const w=state.weapons[r.id];if(!w)continue;
      const previous=state.previous[r.id]||position(track,r);
      // Teleport/recovery cannot collect pickups crossed only by relocation.
      if(Math.hypot(r.x-previous.x,r.z-previous.z)>Math.max(12,Math.abs(r.speed)*dt*2.5))continue;
      if(!sweepCircle(previous.x,previous.z,r.x,r.z,pickup.x,pickup.z,1.25))continue;
      let collected=false;
      if(pickup.kind==='ammo'&&w.reserve<COMBAT_RULES.reserveMax){w.reserve=Math.min(COMBAT_RULES.reserveMax,w.reserve+24);collected=true;}
      if(pickup.kind==='repair'&&r.health<100){r.health=Math.min(100,r.health+24);collected=true;}
      if(pickup.kind==='shield'&&w.shield<100){w.shield=Math.min(100,w.shield+40);collected=true;}
      if(collected){pickup.cooldown=COMBAT_RULES.pickupRespawn;burst(state,pickup.x,ground(track,r)+.4,pickup.z,'pickup',r.id);break;}
    }
  }
  state.warnings=racers.filter(r=>active(r)&&state.weapons[r.id]?.windup>0).map(r=>{
    const w=state.weapons[r.id];return {id:r.id,ownerId:r.id,targetId:w.targetId,x:r.x,z:r.z,yaw:w.aim,remaining:w.windup};
  });
  for(const r of racers)state.previous[r.id]=position(track,r);
  mirror(state,racers);
}
