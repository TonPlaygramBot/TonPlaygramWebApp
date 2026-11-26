import {vehicleSize} from './trafficSimulation.mjs';
const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
const finitePoint = p => p && Number.isFinite(p.x) && Number.isFinite(p.z);
const freshReport = (n,time,seconds) => n.health !== 0 && finitePoint(n.lastSeen)
  && Number.isFinite(n.lastSeenAt) && n.lastSeenAt <= time && time-n.lastSeenAt < seconds;
// Ephemeral plans belong to the actor object, never a global NPC id. A retry or
// restored checkpoint therefore cannot inherit a discarded squad's maneuver.
const maneuvers = new WeakMap(), coverPlans = new WeakMap();
const recentlyHit = (n,time) => Number.isFinite(n.lastDamage) && time >= n.lastDamage && time-n.lastDamage < 1.1;

/** Count shots that actually left the weapon, not blocked attempts. */
export function recordTacticalShot(n,time) {
  if (!Number.isFinite(time)) return;
  if (!Number.isFinite(n.burstLastAt) || time < n.burstLastAt || time-n.burstLastAt > 2.5) n.burstShots=0;
  n.burstLastAt=time;
  n.burstShots=(n.burstShots||0)+1;
  if(n.burstShots>=3){n.burstShots=0;n.burstPauseUntil=time+(n.kind==='soldier'?.85:1.25);}
}
export function tacticalFireReady(n,time) {
  return Number.isFinite(time) && !recentlyHit(n,time) && time >= (n.burstPauseUntil||0);
}

// Arcade personality values, independent of the visual rig and wanted tier.
export const FORCE_BEHAVIOR = Object.freeze({
  patrol_officer: Object.freeze({runSpeed:3.6,holdDistance:20,spacing:1.8,flank:false,searchSeconds:12}),
  traffic_officer: Object.freeze({runSpeed:3.1,holdDistance:28,spacing:2,flank:false,searchSeconds:8}),
  shqiponja_officer: Object.freeze({runSpeed:4.1,holdDistance:17,spacing:2.1,flank:true,searchSeconds:14}),
  fnsh_officer: Object.freeze({runSpeed:3.2,holdDistance:25,spacing:1.5,flank:false,searchSeconds:10}),
  renea_officer: Object.freeze({runSpeed:3.8,holdDistance:28,spacing:2.4,flank:true,searchSeconds:16})
});
export function forceBehavior(n){return FORCE_BEHAVIOR[n.forceCharacter]||{runSpeed:3.6,holdDistance:20,spacing:1.8,flank:true,searchSeconds:12};}
/** Deterministic arcade squad behavior shared by the city client/server. */
export function deployment(stars, intensity = 0) {
  const size = Math.min(20, Math.max(10, 10 + Math.floor(intensity / 40) * 2));
  if (stars === 2) return {role: 'shqiponja', vehicles: ['shqiponja_bike', 'shqiponja_bike', 'patrol_sedan'], seats: [2, 2, 2], character: 'shqiponja_officer'};
  const role = stars >= 5 ? 'army' : stars >= 4 ? 'renea' : stars >= 3 ? 'fnsh' : 'patrol';
  const count = stars >= 3 ? size : 2;
  const vehicle = stars >= 4 ? 'renea_armored_van' : stars === 3 ? 'fnsh_armored_van' : 'patrol_hatch';
  const seats = Array.from({length: Math.ceil(count / 5)}, (_, i) => Math.min(5, count - i * 5));
  return {role, vehicles: seats.map(() => vehicle), seats, character: role === 'army' ? 'army_soldier' : `${role}_officer`};
}
export function formationSlot(leader, target, index, spacing = 1.8) {
  const yaw = Math.atan2(target.x-leader.x, target.z-leader.z);
  const side = ((index % 2) ? 1 : -1) * spacing;
  const back = (Math.floor(index / 2) + 1) * spacing;
  return {x: leader.x + Math.cos(yaw)*side - Math.sin(yaw)*back,
    z: leader.z - Math.sin(yaw)*side - Math.cos(yaw)*back};
}
// Oriented rectangle segment intersection. Used by both incoming and outgoing fire.
export function vehicleBlocks(a, b, car, margin = 0) {
  if (car.forceVehicle?.includes('bike')) return false;
  const yaw = car.heading || 0, c = Math.cos(yaw), s = Math.sin(yaw);
  const local = p => ({x: (p.x-car.x)*c-(p.z-car.z)*s, z: (p.x-car.x)*s+(p.z-car.z)*c});
  const size=vehicleSize(car),u=local(a), v=local(b), w=size.width/2+margin, d=size.length/2+margin;
  let lo=0, hi=1;
  for(const [axis,extent] of [['x',w],['z',d]]) {
    const delta=v[axis]-u[axis];
    if(Math.abs(delta)<1e-8) { if(Math.abs(u[axis])>extent)return false; continue; }
    let t0=(-extent-u[axis])/delta, t1=(extent-u[axis])/delta;
    if(t0>t1)[t0,t1]=[t1,t0]; lo=Math.max(lo,t0);hi=Math.min(hi,t1);
    if(lo>hi)return false;
  }
  return hi>.015 && lo<.985;
}
export function coverPoint(car, target, slot=0, peek=false) {
  const dx=car.x-target.x, dz=car.z-target.z, length=Math.hypot(dx,dz)||1;
  const nx=dx/length,nz=dz/length, radius=Math.hypot(vehicleSize(car).width,vehicleSize(car).length)/2+.85;
  const side=(slot%2?1:-1)*(peek?radius+1:.65);
  return {x:car.x+nx*radius-nz*side,z:car.z+nz*radius+nx*side};
}
function chooseCover(n,target,members,cars,index,time,clear) {
  const valid=c=>!c.burning&&!c.destroyed&&Math.abs(c.speed||0)<1&&!c.forceVehicle?.includes('bike')
    &&distance(c,n)<18&&members.filter(m=>m.id!==n.id&&m.coverId===c.id).length<2;
  const cached=coverPlans.get(n);
  if(cached&&time>=cached.at&&time<cached.until&&distance(cached.target,target)<4){
    if(!cached.car)return null;
    if(valid(cached.car))return cached.car;
  }
  const candidates=cars.filter(valid).sort((a,b)=>distance(a,n)-distance(b,n));
  const preferred=candidates.findIndex(c=>c.id===n.coverId);
  const start=preferred>=0?preferred:(cached?.next||0)%Math.max(1,candidates.length);
  let chosen=null,checked=0;
  // Four new route probes per decision window; large squads do not test every
  // parked car each frame. Continue later candidates after unsuccessful probes.
  while(checked<Math.min(4,candidates.length)){
    const car=candidates[(start+checked++)%candidates.length];
    const goal=coverPoint(car,target,index,false);
    if(vehicleBlocks(target,goal,car)&&clear(n,goal)){chosen=car;break;}
  }
  coverPlans.set(n,{at:time,until:time+.55,target:{x:target.x,z:target.z},car:chosen,next:(start+checked)%Math.max(1,candidates.length)});
  return chosen;
}
export function tacticalGoal(n, target, squad, cars, time, clear, context = {}) {
  const profile=forceBehavior(n);
  const visible=context.observed!==false&&clear(n,target);
  if(visible){n.lastSeen={x:target.x,z:target.z};n.lastSeenAt=time;}
  else {
    // Only new, living squad observations can update a report. Repeated queries
    // against an old tracked position must not refresh the search indefinitely.
    const report=squad.filter(o=>o!==n&&freshReport(o,time,8)&&o.lastSeenAt>(n.lastSeenAt??-Infinity))
      .sort((a,b)=>b.lastSeenAt-a.lastSeenAt)[0];
    if(report){n.lastSeen={...report.lastSeen};n.lastSeenAt=report.lastSeenAt;}
    if(!freshReport(n,time,profile.searchSeconds))return {goal:n,anim:'idle'};
    // A car can hide the operator from the target. Keep the current cover long
    // enough to peek at the last observed position; never fire at that report.
    const holdingCover=n.coverId&&freshReport(n,time,6)&&cars.some(c=>c.id===n.coverId&&!c.destroyed&&!c.burning&&Math.abs(c.speed||0)<1);
    if(!holdingCover){
      const searching=distance(n,n.lastSeen)>1.2;
      return {goal:searching?n.lastSeen:n,anim:searching?'walk':'idle'};
    }
    target=n.lastSeen;
  }
  const members=squad.filter(o=>o.health>0).sort((a,b)=>a.id.localeCompare(b.id));
  const index=Math.max(0,members.findIndex(o=>o.id===n.id)), leader=members[0]||n;
  const range=distance(n,target);
  const suppressed=recentlyHit(n,time), reloading=time<(n.reloadUntil||0);
  const underFire=suppressed||reloading||n.health<30||range<27;
  const cover=underFire?chooseCover(n,target,members,cars,index,time,clear):null;
  if(cover) {
    let peek=!suppressed&&!reloading&&(Math.floor(time/2.4)+index)%3===0;
    let goal=coverPoint(cover,target,index,peek);
    // A usable hiding place does not imply space around both ends of the car.
    if(peek&&!clear(n,goal)){peek=false;goal=coverPoint(cover,target,index,false);}
    return {goal, anim:distance(n,goal)>.7?'run':reloading?'reload':peek?'aim':'cover',coverId:cover.id};
  }
  // A fixed destination and a fire interval give each flanker a readable move
  // and stop sequence. Recomputing the angle from its current position every
  // decision used to make the actor orbit forever and never engage.
  if(visible&&profile.flank&&index>=2&&range>11&&range<42&&!suppressed&&!reloading){
    let plan=maneuvers.get(n);
    if(!plan||time<plan.at||time>=plan.until||distance(plan.target,target)>8){
      const side=index%2?1:-1,yaw=Math.atan2(n.x-target.x,n.z-target.z);
      const goal={x:target.x+Math.sin(yaw+side*.65)*16,z:target.z+Math.cos(yaw+side*.65)*16};
      const vacant=members.every(o=>o===n||distance(o,goal)>1.6);
      plan={at:time,until:time+6,moveUntil:time+3,target:{x:target.x,z:target.z},goal:vacant&&clear(n,goal)?goal:null};
      maneuvers.set(n,plan);
    }
    if(plan.goal){
      if(time<plan.moveUntil&&distance(n,plan.goal)>.8)return {goal:plan.goal,anim:'run'};
      return {goal:n,anim:'aim'};
    }
  }
  if(suppressed||reloading)return {goal:n,anim:reloading?'reload':'cover'};
  if(range<profile.holdDistance)return {goal:n,anim:'aim'};
  return {goal:leader===n?target:formationSlot(leader,target,index,profile.spacing),anim:range>30?'run':'walk'};
}
/** Pursuer / left interceptor / right interceptor / roadblock. Predictions
 * only use an observed heading; search orders share a timestamped report. */
export function pursuitGoal(unit,target,convoy,time,visible) {
  if(visible){unit.lastSeen={x:target.x,z:target.z,heading:target.heading||0,speed:Math.min(32,Math.abs(target.speed||0))};unit.lastSeenAt=time;}
  else {
    const report=convoy.filter(u=>!u.destroyed&&freshReport(u,time,12)).sort((a,b)=>b.lastSeenAt-a.lastSeenAt)[0];
    if(report&&(!unit.lastSeen||report.lastSeenAt>unit.lastSeenAt)){unit.lastSeen={...report.lastSeen};unit.lastSeenAt=report.lastSeenAt;}
  }
  if(!freshReport(unit,time,18))return {goal:unit,role:'hold'};
  const index=Math.max(0,convoy.findIndex(u=>u.id===unit.id)),seen=unit.lastSeen;
  if(!visible){const angle=index*Math.PI*.7;return {goal:{x:seen.x+Math.sin(angle)*Math.min(18,(time-unit.lastSeenAt)*2),z:seen.z+Math.cos(angle)*Math.min(18,(time-unit.lastSeenAt)*2)},role:'search'};}
  const lead=index===0?0:Math.min(55,seen.speed*(index>=3?2.2:1.2));
  const side=index===1?-7:index===2?7:0;
  return {goal:{x:seen.x-Math.sin(seen.heading)*lead+Math.cos(seen.heading)*side,z:seen.z-Math.cos(seen.heading)*lead-Math.sin(seen.heading)*side},role:index===0?'pursue':index>=3?'roadblock':'intercept'};
}
export function avoidVehicles(n, goal, cars) {
  const blocker=cars.find(c=>Math.abs(c.speed||0)<1 && vehicleBlocks(n,goal,c,.5));
  if(!blocker)return goal;
  const yaw=blocker.heading||0,c=Math.cos(yaw),s=Math.sin(yaw),w=vehicleSize(blocker).width/2+.8,d=vehicleSize(blocker).length/2+.8;
  const corners=[[-w,-d],[-w,d],[w,-d],[w,d]].map(([x,z])=>({x:blocker.x+x*c+z*s,z:blocker.z-x*s+z*c}));
  return corners.filter(p=>!vehicleBlocks(n,p,blocker,.4)&&Math.hypot(p.x-n.x,p.z-n.z)>.4)
    .sort((a,b)=>(Math.hypot(a.x-n.x,a.z-n.z)+Math.hypot(a.x-goal.x,a.z-goal.z))-(Math.hypot(b.x-n.x,b.z-n.z)+Math.hypot(b.x-goal.x,b.z-goal.z)))[0]||n;
}
