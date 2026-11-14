import {groundHeight} from '../../tirana-east/terrainCore.mjs';
import {forceWeaponFor} from '../shared/uploadedWeapons.mjs';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export const RENEA_RESPONSE = Object.freeze({stars:4,arrivalSpeed:52,approachDistance:220,crew:6,cooldown:45});
/** Bounded, fictional encounter reinforcement. One visible aircraft brings one
 * squad to a checked open location; there is no offscreen troop teleport. */
export class ReneaResponseSimulation {
  constructor(sim){this.sim=sim;this.aircraft=null;this.phase='idle';this.crew=[];this.cooldown=0;this.serial=0;this.nextSearch=0;}
  landingSite(target){
    const {world}=this.sim;
    for(const radius of [28,40,55])for(let i=0;i<12;i++){
      const angle=i*Math.PI/6,x=target.x+Math.cos(angle)*radius,z=target.z+Math.sin(angle)*radius;
      const y=groundHeight(x,z)+.08,q={x,y,z};
      // A full-height column prevents deployment through roofs, trees or walls.
      if(!world.clearance(q,22,7)||Math.abs(world.surface(x,z,y+.3)-groundHeight(x,z))>.5)continue;
      if(this.sim.cars().some(c=>distance(c,q)<9))continue;
      return q;
    }
    return null;
  }
  dispatch(target){
    const site=this.landingSite(target);if(!site)return false;
    const retired=new Set(this.crew);this.sim.state.npcs=this.sim.state.npcs.filter(n=>!retired.has(n));this.crew=[];
    const from={x:site.x+RENEA_RESPONSE.approachDistance,z:site.z+100};
    // Survey the whole short approach against the game's collision world.
    let cruise=site.y+65;
    for(let i=0;i<=12;i++){
      const t=i/12,x=from.x+(site.x-from.x)*t,z=from.z+(site.z-from.z)*t;
      cruise=Math.max(cruise,this.sim.world.surface(x,z)+35);
    }
    this.site=site;this.cruise=cruise;this.phase='approach';this.targetId=target.id;this.deployed=0;this.dropTimer=0;
    const a={id:'renea-response-helicopter',kind:'helicopter',name:'RENEA response',responseOnly:true,careerManaged:true,
      ...from,y:cruise,roofY:site.y,stairX:site.x,stairZ:site.z,homeX:from.x,homeZ:from.z,
      heading:Math.atan2(from.x-site.x,from.z-site.z),speed:RENEA_RESPONSE.arrivalSpeed,pilot:'renea-dispatch',
      health:240,missiles:0,nextMissile:Infinity,airborne:true,roll:0,pitch:.06};
    this.aircraft=a;this.sim.state.helicopters??=[];this.sim.state.helicopters.push(a);
    this.sim.body.notice='Four-star alert · RENEA helicopter inbound';
    this.sim.event?.('renea-dispatch');return true;
  }
  deployOne(){
    const slot=this.deployed,side=slot%2?-1:1,x=this.site.x+side*2.4,z=this.site.z+(Math.floor(slot/2)-1)*2;
    const y=groundHeight(x,z)+.08,q={x,y,z};
    if(!this.sim.world.clearance(q,18,.5))return false;
    const n={...q,y:this.aircraft.y-1.4,id:`renea-air:${this.serial}:${slot}`,kind:'police',forceCharacter:'renea_officer',
      squadId:'renea-air:'+this.serial,airDeploying:true,deployed:true,health:140,heading:this.aircraft.heading,
      speed:0,motion:'walk',anim:'idle',weapon:forceWeaponFor('renea_officer',slot),nextShot:this.sim.state.elapsed+2,
      downUntil:0,panicUntil:0};
    this.crew.push(n);this.sim.state.npcs.push(n);this.deployed++;return true;
  }
  finish(){
    const a=this.aircraft;if(a)this.sim.state.helicopters=this.sim.state.helicopters.filter(h=>h!==a);
    this.aircraft=null;this.phase='idle';this.cooldown=this.sim.state.elapsed+RENEA_RESPONSE.cooldown;
  }
  step(dt){
    if(!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.1);
    const p=this.sim.player,now=this.sim.state.elapsed;
    for(const n of this.crew)if(n.airDeploying){
      const floor=groundHeight(n.x,n.z)+.08;
      // A downed operator still reaches the ground before ordinary body handling.
      n.y=Math.max(floor,n.y-dt*6);n.speed=0;
      if(n.y<=floor+.001){n.airDeploying=false;delete n.y;n.anim=n.health>0?'idle':'down';}
    }
    if(!this.aircraft){
      if(p.health<=0||p.arrest||this.sim.arrest?.locked||Math.ceil((p.wanted||0)/100)<RENEA_RESPONSE.stars||now<this.cooldown||now<this.nextSearch)return;
      // Keep one local squad. A remote squad beyond the visual/engagement
      // region may be retired for a new incident elsewhere after the cooldown.
      if(this.crew.some(n=>n.health>0&&distance(n,p)<260))return;
      this.nextSearch=now+2;this.serial++;this.dispatch(p);return;
    }
    const a=this.aircraft;
    if(p.health<=0||p.arrest||this.sim.arrest?.locked||p.wanted<=0){this.phase='depart';a.speed=0;}
    if(this.phase==='approach'){
      const d=distance(a,this.site),travel=Math.min(d,dt*RENEA_RESPONSE.arrivalSpeed);
      if(d>.01){a.x+=(this.site.x-a.x)/d*travel;a.z+=(this.site.z-a.z)/d*travel;}
      if(d<=travel+.01){this.phase='lower';a.speed=0;a.pitch=0;}
    }else if(this.phase==='lower'){
      a.y=Math.max(this.site.y+14,a.y-dt*28);
      if(a.y<=this.site.y+14){this.phase='deploy';this.sim.body.notice='RENEA deploying nearby';this.sim.event?.('renea-deploy');}
    }else if(this.phase==='deploy'){
      this.dropTimer-=dt;
      if(this.deployed<RENEA_RESPONSE.crew&&this.dropTimer<=0){
        // Failed spawn checks do not cause an endless hover loop.
        if(!this.deployOne())this.deployed++;this.dropTimer=.35;
      }
      if(this.deployed>=RENEA_RESPONSE.crew&&!this.crew.some(n=>n.airDeploying)){this.phase='depart';a.heading=-Math.PI/2;}
    }else if(this.phase==='depart'){
      a.y=Math.min(this.cruise,a.y+dt*22);a.x+=dt*RENEA_RESPONSE.arrivalSpeed;a.speed=RENEA_RESPONSE.arrivalSpeed;
      if(distance(a,this.site)>RENEA_RESPONSE.approachDistance+70)this.finish();
    }
  }
}
