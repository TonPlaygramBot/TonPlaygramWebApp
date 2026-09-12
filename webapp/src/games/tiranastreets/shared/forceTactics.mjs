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
  const u=local(a), v=local(b), w=(car.w || 2)/2+margin, d=(car.d || 4.6)/2+margin;
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
  const nx=dx/length,nz=dz/length, radius=Math.hypot(car.w||2,car.d||4.6)/2+.85;
  const side=(slot%2?1:-1)*(peek?radius+1:.65);
  return {x:car.x+nx*radius-nz*side,z:car.z+nz*radius+nx*side};
}
export function tacticalGoal(n, target, squad, cars, time, clear) {
  const visible=clear(n,target);
  if(visible){n.lastSeen={x:target.x,z:target.z};n.lastSeenAt=time;}
  // Officers investigate the last observed position instead of tracking a
  // hidden player through every wall. A squad report seeds the first search.
  else {
    const report=squad.filter(o=>o.lastSeen&&time-o.lastSeenAt<8).sort((a,b)=>b.lastSeenAt-a.lastSeenAt)[0];
    if(report){n.lastSeen={...report.lastSeen};n.lastSeenAt=report.lastSeenAt;}
    if(!n.lastSeen)return {goal:n,anim:'idle'};
    const searching=time-n.lastSeenAt<12&&Math.hypot(n.x-n.lastSeen.x,n.z-n.lastSeen.z)>1.2;
    return {goal:searching?n.lastSeen:n,anim:searching?'walk':'idle'};
  }
  const members=squad.filter(o=>o.health>0).sort((a,b)=>a.id.localeCompare(b.id));
  const index=Math.max(0,members.findIndex(o=>o.id===n.id)), leader=members[0]||n;
  const distance=Math.hypot(n.x-target.x,n.z-target.z);
  const underFire = n.health < (n.kind==='soldier'?150:100) || distance<27;
  let cover;
  if(underFire) { const available=cars.filter(c=>Math.abs(c.speed||0)<1 && !c.forceVehicle?.includes('bike') && Math.hypot(c.x-n.x,c.z-n.z)<18)
    .sort((a,b)=>Math.hypot(a.x-n.x,a.z-n.z)-Math.hypot(b.x-n.x,b.z-n.z)); cover=available.find(c=>c.id===n.coverId)||available[Math.floor(index/2)%Math.max(1,available.length)]; }
  if(cover) {
    const peek=(Math.floor(time/2.4)+index)%3===0;
    const goal=coverPoint(cover,target,index,peek);
    return {goal, anim: Math.hypot(n.x-goal.x,n.z-goal.z)>.7?'run':peek?'aim':'cover', coverId:cover.id};
  }
  // Alternating pairs flank while the lead pair holds a readable firing line.
  if(index>=2 && distance>11 && distance<42){
    const side=index%2?1:-1,yaw=Math.atan2(n.x-target.x,n.z-target.z);
    const goal={x:target.x+Math.sin(yaw+side*.65)*16,z:target.z+Math.cos(yaw+side*.65)*16};
    if(Math.hypot(n.x-goal.x,n.z-goal.z)>3)return {goal,anim:'run'};
  }
  const holding=distance<20 && visible;
  if(holding) return {goal:n,anim:'aim'};
  return {goal:leader===n?target:formationSlot(leader,target,index),anim:distance>30?'run':'walk'};
}
/** Pursuer / left interceptor / right interceptor / roadblock. Predictions
 * only use an observed heading; search orders share a timestamped report. */
export function pursuitGoal(unit,target,convoy,time,visible) {
  if(visible){unit.lastSeen={x:target.x,z:target.z,heading:target.heading||0,speed:Math.min(32,Math.abs(target.speed||0))};unit.lastSeenAt=time;}
  else {
    const report=convoy.filter(u=>u.lastSeen&&time-u.lastSeenAt<12).sort((a,b)=>b.lastSeenAt-a.lastSeenAt)[0];
    if(report&&(!unit.lastSeen||report.lastSeenAt>unit.lastSeenAt)){unit.lastSeen={...report.lastSeen};unit.lastSeenAt=report.lastSeenAt;}
  }
  if(!unit.lastSeen||time-unit.lastSeenAt>18)return {goal:unit,role:'hold'};
  const index=Math.max(0,convoy.findIndex(u=>u.id===unit.id)),seen=unit.lastSeen;
  if(!visible){const angle=index*Math.PI*.7;return {goal:{x:seen.x+Math.sin(angle)*Math.min(18,(time-unit.lastSeenAt)*2),z:seen.z+Math.cos(angle)*Math.min(18,(time-unit.lastSeenAt)*2)},role:'search'};}
  const lead=index===0?0:Math.min(55,seen.speed*(index>=3?2.2:1.2));
  const side=index===1?-7:index===2?7:0;
  return {goal:{x:seen.x-Math.sin(seen.heading)*lead+Math.cos(seen.heading)*side,z:seen.z-Math.cos(seen.heading)*lead-Math.sin(seen.heading)*side},role:index===0?'pursue':index>=3?'roadblock':'intercept'};
}
export function avoidVehicles(n, goal, cars) {
  const blocker=cars.find(c=>Math.abs(c.speed||0)<1 && vehicleBlocks(n,goal,c,.5));
  if(!blocker)return goal;
  const yaw=blocker.heading||0,c=Math.cos(yaw),s=Math.sin(yaw),w=(blocker.w||2)/2+.8,d=(blocker.d||4.6)/2+.8;
  const corners=[[-w,-d],[-w,d],[w,-d],[w,d]].map(([x,z])=>({x:blocker.x+x*c+z*s,z:blocker.z-x*s+z*c}));
  return corners.filter(p=>!vehicleBlocks(n,p,blocker,.4)&&Math.hypot(p.x-n.x,p.z-n.z)>.4)
    .sort((a,b)=>(Math.hypot(a.x-n.x,a.z-n.z)+Math.hypot(a.x-goal.x,a.z-goal.z))-(Math.hypot(b.x-n.x,b.z-n.z)+Math.hypot(b.x-goal.x,b.z-goal.z)))[0]||n;
}
