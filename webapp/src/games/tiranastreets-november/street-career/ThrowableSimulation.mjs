import {direction3} from './spatialCore.mjs';
import {traceShot} from './shotCore.mjs';
import {groundHeight} from '../../tirana-east/terrainCore.mjs';
/** Swept ballistic food props; a miss never counts as hitting an officer. */
export class ThrowableSimulation {
  constructor(sim){this.sim=sim;this.items=[];this.serial=0;}
  throw(weapon){
    const sim=this.sim,p=sim.player,now=sim.state.elapsed;
    if(this.items.length>=16)return;
    const eye=sim.eye(),d=direction3(sim.body.yaw,sim.body.pitch);
    p.inventory[weapon.id].ammo--;p.nextShot=now+weapon.interval;
    this.items.push({id:++this.serial,kind:weapon.id,...eye,vx:d.x*15,vy:d.y*15+2.1,vz:d.z*15,age:0});
    sim.event('throw',{weapon:weapon.id});
  }
  step(dt){
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
