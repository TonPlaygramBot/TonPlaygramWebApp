import {WEAPON_BY_ID} from '../shared/weapons.mjs';
import {direction3,pointAlong} from './spatialCore.mjs';
import {traceShot} from './shotCore.mjs';
import {reportCrime} from '../shared/cityLife.mjs';
import {groundHeight} from '../../tirana-east/terrainCore.mjs';

/** Fictional, bounded game equipment. No real-world flight or explosive data. */
export class EquipmentSimulation {
  constructor(sim){this.sim=sim;this.charges=[];this.drones=[];this.serial=0;}
  fire(){
    const s=this.sim,p=s.player,w=WEAPON_BY_ID.get(p.weapon);
    if(!['c4Charge','shahedDrone'].includes(p.weapon))return false;
    const inv=p.inventory[p.weapon],now=s.state.elapsed;
    if(!inv?.ammo||p.reloadAt||now<p.nextShot||p.health<=0||p.carId||p.aircraftId||s.arrest?.locked)return true;
    const eye=s.eye(),direction=direction3(s.body.yaw,s.body.pitch);
    if(p.weapon==='c4Charge'){
      if(this.charges.length>=4){s.body.notice='Four remote charges already placed.';return true;}
      const hit=s.world.cast(eye,direction,4,s.cars());
      if(hit.kind==='air'){s.body.notice='Aim at a nearby surface to place a charge.';return true;}
      const point=pointAlong(hit.point,direction,-.12);
      this.charges.push({id:`charge-${++this.serial}`,...point,heading:s.body.yaw});
      s.body.notice='Charge placed. Use DETONATE when ready.';
    }else{
      if(this.drones.length>=2){s.body.notice='Two drones already deployed.';return true;}
      const clearance=s.world.cast(eye,direction,2,s.cars());
      if(clearance.kind!=='air'){s.body.notice='Move clear of the wall before launching.';return true;}
      this.drones.push({id:`drone-${++this.serial}`,...pointAlong(eye,direction,1.4),direction,age:0,heading:s.body.yaw});
      s.body.notice='Drone launched along your aim. Flight ends on impact.';
    }
    inv.ammo--;p.nextShot=now+w.interval;s.body.combat='fire';
    reportCrime(s.state,p,45);s.event('fire',{weapon:p.weapon});
    return true;
  }
  detonate(){
    const s=this.sim,p=s.player;
    if(!this.charges.length||p.health<=0||p.carId||p.aircraftId||s.arrest?.locked)return false;
    const charges=this.charges.splice(0);
    for(const charge of charges){s.combat.emit('blast',charge,{radius:7});s.combat.blast(charge,7,95,p);}
    reportCrime(s.state,p,65);s.body.notice='Remote charges detonated.';return true;
  }
  step(dt){
    const s=this.sim;
    if(s.player.health<=0||s.arrest?.locked){this.charges.length=0;this.drones.length=0;return;}
    for(let i=this.drones.length-1;i>=0;i--){
      const drone=this.drones[i];drone.age+=dt;
      const distance=18*dt;
      const {hit,target}=traceShot(s.world,drone,drone.direction,distance,s.cars(),s.state.npcs);
      const next=pointAlong(drone,drone.direction,distance);
      if(target||hit.kind!=='air'||next.y<=groundHeight(next.x,next.z)+.1){
        const point=target||hit.kind!=='air'?pointAlong(hit.point,drone.direction,-.12):next;
        s.combat.emit('blast',point,{radius:8});s.combat.blast(point,8,100,s.player);this.drones.splice(i,1);
      }else if(drone.age>=5)this.drones.splice(i,1);
      else Object.assign(drone,next);
    }
  }
}
