import {vehicleSize} from '../shared/trafficSimulation.mjs';
import {groundHeight} from '../../tirana-east/terrainCore.mjs';
const mass=c=>{const s=vehicleSize(c);return Math.max(.3,s.length*s.width/8.5);};
const velocity=c=>Number.isFinite(c.vx)&&Number.isFinite(c.vz)?{x:c.vx,z:c.vz}:{x:-Math.sin(c.heading)*c.speed,z:-Math.cos(c.heading)*c.speed};
/** Arcade impact response in mass-relative units. Normal closing speed determines
 * impulse; each vehicle's own change of velocity determines damage and injury. */
export function crashResponse(a,b,normal){
  const length=Math.hypot(normal.x,normal.z);if(length<1e-6)return null;
  const nx=normal.x/length,nz=normal.z/length,av=velocity(a),bv=b&&!b.destroyed?velocity(b):{x:0,z:0};
  const closing=-((av.x-bv.x)*nx+(av.z-bv.z)*nz);if(closing<=.01)return null;
  const ma=mass(a),mb=b&&!b.destroyed?mass(b):Infinity;
  const restitution=b?.destroyed?.02:b?.08:normal.kind==='bank'?0:.04;
  const impulse=closing*(1+restitution)/(1/ma+1/mb);
  const deltaA=impulse/ma,deltaB=Number.isFinite(mb)?impulse/mb:0;
  // Speed is m/s. Parking bumps and glancing scrapes stay cosmetic; mechanical
  // failure requires a severe change in velocity, not the closing speed alone.
  const damage=delta=>Math.min(150,Math.max(0,delta-5.5)**2*.2);
  return {closing,deltaA,deltaB,damageA:damage(deltaA),damageB:damage(deltaB),
    a:{x:av.x+deltaA*nx,z:av.z+deltaA*nz},b:{x:bv.x-deltaB*nx,z:bv.z-deltaB*nz}};
}
export class CrashSimulation{
  constructor(sim){this.sim=sim;this.contacts=new Map();}
  impact(a,b,normal){
    const response=crashResponse(a,b,normal);if(!response)return;
    const now=this.sim.state.elapsed;
    for(const [car,v] of [[a,response.a],[b,response.b]])if(car&&!car.destroyed){
      car.vx=v.x;car.vz=v.z;car.speed=-Math.sin(car.heading)*v.x-Math.cos(car.heading)*v.z;
      // Let AI cars receive the same impulse before gradually resuming their lane.
      car.impactUntil=now+Math.min(.65,response.closing*.025);
    }
    const key=b?[a.id,b.id].sort().join(':'):`${a.id}:${normal.id||normal.kind||'wall'}`;
    if(response.closing<3||now<(this.contacts.get(key)||0))return;
    this.contacts.set(key,now+.45);
    for(const [id,until]of this.contacts)if(until<now)this.contacts.delete(id);
    const occupants=[a,b].map(car=>car?this.sim.state.players[car.driver]:null);
    this.sim.combat.damageVehicle(a,response.damageA,this.sim.player,'collision');
    if(b&&!b.destroyed)this.sim.combat.damageVehicle(b,response.damageB,this.sim.player,'collision');
    const point={x:normal.point?.x??a.x,y:groundHeight(a.x,a.z)+.65,z:normal.point?.z??a.z};
    this.sim.combat.emit('crash',point,{radius:Math.min(6,response.closing/5),severity:response.closing});
    for(const [car,delta,occupant]of [[a,response.deltaA,occupants[0]],[b,response.deltaB,occupants[1]]])if(car){
      car.crashUntil=now+Math.min(.6,delta*.035);
      if(occupant&&delta>10)this.sim.damage(occupant,Math.min(60,(delta-10)*2),this.sim.player);
    }
    this.sim.event('collision',{severity:response.closing});
  }
}
