import {direction3} from './spatialCore.mjs';
import {traceShot} from './shotCore.mjs';
import {WEAPON_BY_ID} from '../shared/weapons.mjs';
import {groundHeight} from '../../tirana-east/terrainCore.mjs';
/** Swept ballistic food props; a miss never counts as hitting an officer. */
export class ThrowableSimulation {
  constructor(sim){this.sim=sim;this.items=[];this.serial=0;this.charge=null;}
  ready(weapon){
    const s=this.sim,p=s.player,b=s.body;
    return !s.paused && !s.access?.binoculars && !s.access?.parachute?.open &&
      !s.arrest?.locked && weapon?.category==='throwable' &&
      p.weapon===weapon.id && p.health>0 && !p.carId && !p.aircraftId &&
      b.interaction==='free' && !b.action && !p.reloadAt &&
      s.state.elapsed >= p.nextShot && p.inventory[weapon.id]?.ammo>0 &&
      this.items.length<16;
  }
  begin(){
    const s=this.sim,w=WEAPON_BY_ID.get(s.player.weapon);
    if(this.charge||!this.ready(w))return false;
    this.charge={id:w.id,at:s.state.elapsed,release:null,launched:false};
    s.body.foodPose={load:0,reach:0,released:false};
    return true;
  }
  release(){
    const q=this.charge, s=this.sim;
    if(!q||q.release!==null)return false;
    if(!this.ready(WEAPON_BY_ID.get(q.id))){this.cancel();return false;}
    q.release=s.state.elapsed;
    q.power=Math.max(0,Math.min(1,(q.release-q.at)/.82));
    return true;
  }
  cancel(){
    this.charge=null;
    if(this.sim.body.foodPose)this.sim.body.foodPose=undefined;
  }
  throw(weapon){
    if(this.charge||!this.ready(weapon))return false;
    return this.begin()&&this.release();
  }
  launch(weapon,power){
    const sim=this.sim,p=sim.player,now=sim.state.elapsed;
    const eye=sim.eye(),d=direction3(sim.body.yaw,sim.body.pitch);
    const speed=10+13*power;
    p.inventory[weapon.id].ammo--;p.nextShot=now+weapon.interval;
    this.items.push({
      id:++this.serial,kind:weapon.id,
      x:eye.x+d.x*.49+Math.cos(sim.body.yaw)*.26,y:eye.y+d.y*.49-.11,z:eye.z+d.z*.49-Math.sin(sim.body.yaw)*.26,
      vx:d.x*speed,vy:d.y*speed+1.9+power*.7,vz:d.z*speed,age:0
    });
    sim.event('throw',{weapon:weapon.id});
  }
  updateCharge(){
    const q=this.charge,s=this.sim;
    if(!q)return;
    if(q.id!==s.player.weapon||s.paused||s.player.health<=0||s.body.interaction!=='free'||s.body.action){this.cancel();return;}
    const now=s.state.elapsed;
    if(q.release===null){
      const load=Math.min(1,(now-q.at)/.32);
      s.body.foodPose={load,reach:0,released:false};
      return;
    }
    const elapsed=now-q.release;
    if(!q.launched && elapsed>=.15){
      const w=WEAPON_BY_ID.get(q.id);
      if(!this.ready(w)){this.cancel();return;}
      this.launch(w,q.power);q.launched=true;
    }
    if(elapsed>=.38){this.cancel();return;}
    const reach=elapsed<.15?elapsed/.15:Math.max(0,1-(elapsed-.15)/.23);
    s.body.foodPose={load:Math.min(1,.36+q.power*.64)*(1-reach),reach,released:q.launched};
  }
  step(dt){
    this.updateCharge();
    const sim=this.sim,cars=sim.cars();
    for(const item of this.items){
      item.age+=dt;const to={x:item.x+item.vx*dt,y:item.y+item.vy*dt-4.9*dt*dt,z:item.z+item.vz*dt};
      item.vy-=9.8*dt;
      const dx=to.x-item.x,dy=to.y-item.y,dz=to.z-item.z,length=Math.hypot(dx,dy,dz);
      if(length<1e-8)continue;
      const {hit,target}=traceShot(sim.world,item,{x:dx/length,y:dy/length,z:dz/length},length,cars,sim.state.npcs);
      if(hit.kind!=='air'||target||to.y<=groundHeight(to.x,to.z)+.08){
        const point=hit.kind==='air'&&!target?{...to,y:groundHeight(to.x,to.z)+.1}:hit.point;
        const horizontal=Math.hypot(dx,dz)||1,ground=hit.kind==='ground'||hit.kind==='air'&&!target;
        sim.combat.emit(`${item.kind}-splat`,point,{weapon:item.kind,targetId:target?.id,nx:ground?0:-dx/horizontal,ny:ground?1:0,nz:ground?0:-dz/horizontal});item.age=10;
        if(target){
          target.splatteredUntil=sim.state.elapsed+6;target.splatter=item.kind;
          sim.arrest.provoke(target,item.kind);sim.event('food-hit',{targetId:target.id,weapon:item.kind});
        }
      }else Object.assign(item,to);
    }
    this.items=this.items.filter(p=>p.age<4);
  }
}
