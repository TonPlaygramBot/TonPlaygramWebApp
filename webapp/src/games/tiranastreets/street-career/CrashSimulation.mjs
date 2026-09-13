import { vehicleSize } from '../shared/trafficSimulation.mjs';
import { groundHeight } from '../../tirana-east/terrainCore.mjs';
const velocity = c => ({x:c.npcDriver?-Math.sin(c.heading)*c.speed:c.vx||0,z:c.npcDriver?-Math.cos(c.heading)*c.speed:c.vz||0});
const mass = c => {const s=vehicleSize(c);return Math.max(.3,s.length*s.width/8.5);};
/** Closing speed along the contact normal: scraping and parallel traffic do not
 * produce the damage of a head-on crash. Each contact has a damage cooldown. */
export class CrashSimulation {
  constructor(sim){this.sim=sim;this.contacts=new Map();}
  impact(a,b,normal){
    const length=Math.hypot(normal.x,normal.z);if(length<1e-6)return;
    const nx=normal.x/length,nz=normal.z/length,av=velocity(a),bv=b?velocity(b):{x:0,z:0};
    const closing=Math.max(0,-((av.x-bv.x)*nx+(av.z-bv.z)*nz));
    if(closing<=0)return;
    const ma=mass(a),mb=b&&!b.destroyed?mass(b):Infinity;
    const impulse=closing*1.12/(1/ma+1/mb);
    a.vx=av.x+impulse*nx/ma;a.vz=av.z+impulse*nz/ma;
    a.speed=-Math.sin(a.heading)*a.vx-Math.cos(a.heading)*a.vz;
    if(b&&!b.destroyed){b.vx=bv.x-impulse*nx/mb;b.vz=bv.z-impulse*nz/mb;b.speed=-Math.sin(b.heading)*b.vx-Math.cos(b.heading)*b.vz;}
    const now=this.sim.state.elapsed,key=b?[a.id,b.id].sort().join(':'):a.id+':wall';
    if(closing<3||now<(this.contacts.get(key)||0))return;
    this.contacts.set(key,now+.65);
    for(const [id,until]of this.contacts)if(until<now)this.contacts.delete(id);
    const damage=Math.min(150,(closing-2)**2*.28),share=Number.isFinite(mb)?mb/(ma+mb):1;
    this.sim.combat.damageVehicle(a,damage*share);
    if(b)this.sim.combat.damageVehicle(b,damage*(1-share));
    const point={x:a.x-normal.x*.5,y:groundHeight(a.x,a.z)+.65,z:a.z-normal.z*.5};
    this.sim.combat.emit('crash',point,{radius:Math.min(6,closing/5),severity:closing});
    for(const car of [a,b].filter(Boolean)){
      car.crashUntil=now+.45;
      const occupant=this.sim.state.players[car.driver];
      if(occupant&&closing>12)this.sim.damage(occupant,Math.min(60,(closing-12)*1.8),this.sim.player);
    }
    this.sim.event('collision',{severity:closing});
  }
}
