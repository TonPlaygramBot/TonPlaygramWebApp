import { WORLD } from '../shared/world.mjs';
import { groundHeight } from '../../tirana-east/terrainCore.mjs';
import { direction3, pointAlong } from './spatialCore.mjs';
const clamp = (n,a,b) => Math.max(a,Math.min(b,n));

export class FlightSimulation {
  constructor(sim) {
    this.sim = sim;
    const h = sim.state.helicopter;
    if (h) {h.roofY=sim.world.surface(h.x,h.z);h.y=h.roofY+.65;}
    if (h) Object.assign(h,{kind:'helicopter',homeX:h.x,homeZ:h.z,careerManaged:true,health:220,missiles:24,roll:0,pitch:0});
    // A clear apron is found in the existing world. No map axes or coordinates are remapped.
    const p = sim.player;
    const nodes = [...WORLD.graph.nodes].sort((a,b)=>Math.hypot(a[0]-p.x,a[1]-p.z)-Math.hypot(b[0]-p.x,b[1]-p.z));
    const at = nodes.find(([x,z])=>sim.world.clearance({x,z,y:groundHeight(x,z)+.15},4,7)) || [p.x+12,p.z];
    const floor = groundHeight(at[0],at[1]);
    sim.state.jet = { id:'tirana-fighter-jet',kind:'jet',careerManaged:true,
      x:at[0],z:at[1],y:floor+1.3,roofY:floor,stairX:at[0]+6,stairZ:at[1],
      heading:0,speed:0,pilot:null,airborne:false,nextMissile:0,health:240,missiles:24,roll:0,pitch:0 };
    this.aircraft = [h,sim.state.jet].filter(Boolean);
  }
  get current() { return this.aircraft.find(a=>a.id===this.sim.player.aircraftId); }
  board(id) {
    const p=this.sim.player,b=this.sim.body,a=this.aircraft.find(a=>a.id===id);
    if (!a || a.pilot || a.health<=0 || p.carId || p.aircraftId || p.health<=0) return false;
    const access=this.access(a);
    if (Math.hypot(p.x-access.x,p.z-access.z)>10) return false;
    a.pilot=p.id;p.aircraftId=a.id;p.x=a.x;p.z=a.z;p.speed=0;
    b.y=a.y;b.yaw=a.heading;b.pitch=0;b.interaction='flying';b.action=null;b.aim=false;
    this.sim.event('enter',{vehicleId:a.id});return true;
  }
  access(a) {
    const home = a.kind==='helicopter' && Math.hypot(a.x-a.homeX,a.z-a.homeZ)<4 && a.y>=a.roofY;
    return home ? {x:a.stairX,z:a.stairZ} : {x:a.x+6,z:a.z};
  }
  canExit() {
    const a=this.current;
    return !!a && !a.airborne && Math.abs(a.speed)<2;
  }
  exit() {
    if (!this.canExit()) return false;
    const a=this.current,p=this.sim.player,b=this.sim.body;
    const access=this.access(a);
    let safe;
    for(let r=0;r<=8&&!safe;r+=2)for(let n=0;n<8;n++){
      const x=access.x+Math.cos(n*Math.PI/4)*r,z=access.z+Math.sin(n*Math.PI/4)*r;
      const q={x,z,y:groundHeight(x,z)+.08};
      if(this.sim.world.clearance(q,1.78)){safe=q;break;}
    }
    if(!safe)return false;
    a.pilot=null;p.aircraftId=null;Object.assign(p,{x:safe.x,z:safe.z,speed:0});
    Object.assign(b,{y:safe.y,vy:0,vx:0,vz:0,grounded:true,interaction:'free'});
    a.missiles=24;this.sim.event('exit');return true;
  }
  step(dt) {
    const a=this.current,p=this.sim.player,b=this.sim.body;
    if(!a)return;
    if(p.health<=0||p.failed){a.pilot=null;p.aircraftId=null;return;}
    const input=this.sim.intent;
    // Assisted hover/landing keeps both aircraft playable with two thumbs in portrait.
    a.heading-=input.x*dt*(a.kind==='jet'?.85:1.25);
    const desired=input.y*(a.kind==='jet'?70:28);
    a.speed+=(desired-a.speed)*(1-Math.exp(-dt*1.8));
    a.pitch+=(clamp(input.y*.12,-.15,.15)-a.pitch)*(1-Math.exp(-dt*5));
    a.roll+=(-input.x*.38-a.roll)*(1-Math.exp(-dt*5));
    const floor=this.sim.world.surface(a.x,a.z,a.y-.25);
    const height=a.kind==='jet'?1.3:.65;
    const next={x:a.x-Math.sin(a.heading)*a.speed*dt,z:a.z-Math.cos(a.heading)*a.speed*dt,
      y:clamp(a.y+((input.fast?12:0)-(input.brake?9:0))*dt,floor+height,groundHeight(a.x,a.z)+650)};
    const delta={x:next.x-a.x,y:next.y-a.y,z:next.z-a.z},length=Math.hypot(delta.x,delta.y,delta.z);
    const collision=length>0?this.sim.world.cast(a,{x:delta.x/length,y:delta.y/length,z:delta.z/length},length+1.6):null;
    if(collision && collision.kind==='wall' && collision.distance<length+1.4){
      a.health=Math.max(0,a.health-Math.abs(a.speed)*dt*5);a.speed*=.7;
      if(a.health<=0){this.sim.combat.emit('blast',a,{radius:10});this.sim.damage(p,300,p);return;}
      b.notice='Obstacle ahead · climb or turn';
    }else{
      a.x=clamp(next.x,WORLD.bounds[0]+8,WORLD.bounds[2]-8);
      a.z=clamp(next.z,WORLD.bounds[1]+8,WORLD.bounds[3]-8);a.y=next.y;
    }
    a.airborne=a.y>this.sim.world.surface(a.x,a.z,a.y-.25)+height+.4;
    if(!a.airborne&&Math.abs(input.y)<.1)a.speed*=Math.exp(-dt*8);
    Object.assign(p,{x:a.x,z:a.z,heading:a.heading,speed:Math.abs(a.speed)});
    b.y=a.y;b.interaction='flying';b.grounded=false;b.action=null;
    if(input.fire&&a.airborne)this.sim.combat.launch(a,b.yaw,b.pitch);
  }
  objective() {
    const a=this.current;
    return a ? {title:`${a.kind==='jet'?'Fighter jet':'Helicopter'} · ${Math.round(a.y-groundHeight(a.x,a.z))} m`,
      detail:`${a.missiles} missiles · UP climbs · DOWN lands · drag to aim`,training:false} : null;
  }
}
