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
  const holding=distance<20 && clear(n,target);
  if(holding) return {goal:n,anim:'aim'};
  return {goal:leader===n?target:formationSlot(leader,target,index),anim:distance>30?'run':'walk'};
}
export function avoidVehicles(n, goal, cars) {
  const blocker=cars.find(c=>Math.abs(c.speed||0)<1 && vehicleBlocks(n,goal,c,.5));
  if(!blocker)return goal;
  const yaw=blocker.heading||0,c=Math.cos(yaw),s=Math.sin(yaw),w=(blocker.w||2)/2+.8,d=(blocker.d||4.6)/2+.8;
  const corners=[[-w,-d],[-w,d],[w,-d],[w,d]].map(([x,z])=>({x:blocker.x+x*c+z*s,z:blocker.z-x*s+z*c}));
  return corners.filter(p=>!vehicleBlocks(n,p,blocker,.4)&&Math.hypot(p.x-n.x,p.z-n.z)>.4)
    .sort((a,b)=>(Math.hypot(a.x-n.x,a.z-n.z)+Math.hypot(a.x-goal.x,a.z-goal.z))-(Math.hypot(b.x-n.x,b.z-n.z)+Math.hypot(b.x-goal.x,b.z-goal.z)))[0]||n;
}
