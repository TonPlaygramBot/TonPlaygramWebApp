import {rooftopHelicopterSites} from '../shared/rooftops.mjs';
import { WORLD } from '../shared/world.mjs';
import { groundHeight } from '../../tirana-east/terrainCore.mjs';
const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
export const SQUARE_AIRCRAFT_PADS = Object.freeze({jet:{x:-22,z:25},helicopter:{x:22,z:25}});
const gearHeight = a => a.kind === 'jet' ? 1.3 : .65;
function squarePad(sim,kind) {
  const preferred=SQUARE_AIRCRAFT_PADS[kind];
  for(const dz of [0,15,30,-15])for(const dx of [0,-8,8]){
    const x=preferred.x+dx,z=preferred.z+dz,y=groundHeight(x,z)+.08;
    if(sim.world.clearance({x,z,y},5,9))return {x,z,roofY:sim.world.surface(x,z,y+.25)};
  }
  throw new Error(`No clear Skanderbeg Square parking space for ${kind}`);
}

export class FlightSimulation {
  constructor(sim) {
    this.sim = sim;
    const h = sim.state.helicopter;
    if (h) {
      Object.assign(h,squarePad(sim,'helicopter'));
      Object.assign(h,{kind:'helicopter',buildingId:undefined,name:'Skanderbeg Square helicopter',roofAccess:false,
        y:h.roofY+.65,stairX:h.x+7,stairZ:h.z,homeX:h.x,homeZ:h.z,heading:0,
        careerManaged:true,health:220,missiles:24,roll:0,pitch:0,verticalSpeed:0});
    }
    const pad=squarePad(sim,'jet');
    sim.state.jet = { id:'tirana-fighter-jet',kind:'jet',careerManaged:true,
      ...pad,y:pad.roofY+1.3,stairX:pad.x+7,stairZ:pad.z,name:'Skanderbeg Square fighter jet',
      heading:0,speed:0,verticalSpeed:0,pilot:null,airborne:false,nextMissile:0,health:240,missiles:24,roll:0,pitch:0 };
    const sites=rooftopHelicopterSites(WORLD,2);
    const extra=sites.map((site,i)=>{const roofY=sim.world.surface(site.x,site.z);return {id:`tirana-rooftop-helicopter-${i+2}`,...site,kind:'helicopter',roofAccess:true,homeX:site.x,homeZ:site.z,roofY,y:roofY+.65,careerManaged:true,heading:Math.PI,speed:0,verticalSpeed:0,pilot:null,airborne:false,nextMissile:0,health:220,missiles:0,civilian:true,roll:0,pitch:0};});
    sim.state.helicopters=[h,...extra].filter(Boolean);
    this.aircraft = [...sim.state.helicopters,sim.state.jet];
  }
  get current() { return this.aircraft.find(a=>a.id===this.sim.player.aircraftId); }
  board(id) {
    const p=this.sim.player,b=this.sim.body,a=this.aircraft.find(a=>a.id===id);
    if (!a || a.pilot || a.airborne || Math.abs(a.speed)>2 || a.health<=0 || p.carId || p.aircraftId || p.health<=0) return false;
    const access=this.access(a);
    if (Math.hypot(p.x-access.x,p.z-access.z)>10) return false;
    if(Math.abs(b.y-(a.y-gearHeight(a)))>2.5)return false;
    a.pilot=p.id;p.aircraftId=a.id;p.x=a.x;p.z=a.z;p.speed=0;
    a.autoLand=false;a.autoHover=false;a.takeoffY=null;a.verticalSpeed=0;
    b.y=a.y;b.yaw=a.heading;b.pitch=0;b.interaction='flying';b.action=null;b.aim=false;
    this.sim.event('enter',{vehicleId:a.id});return true;
  }
  access(a) {
    return {x:a.x+Math.cos(a.heading)*(a.kind==='jet'?7:4.2),z:a.z-Math.sin(a.heading)*(a.kind==='jet'?7:4.2),y:a.y-gearHeight(a)};
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
      const floor=this.sim.world.surface(x,z,a.y);
      const q={x,z,y:floor+.08};
      if(Math.abs(floor-(a.y-gearHeight(a)))>1.5)continue;
      if(this.sim.world.clearance(q,1.78)){safe=q;break;}
    }
    if(!safe)return false;
    a.pilot=null;p.aircraftId=null;Object.assign(p,{x:safe.x,z:safe.z,speed:0});
    Object.assign(b,{y:safe.y,vy:0,vx:0,vz:0,grounded:true,interaction:'free'});
    this.sim.event('exit');return true;
  }
  step(dt) {
    if(!Number.isFinite(dt)||dt<=0)return;
    // Sweep at fixed-size intervals even when a slow frame supplies a large dt.
    for(let remaining=Math.min(dt,1);remaining>1e-8;remaining-=1/60)this.integrate(Math.min(remaining,1/60));
  }
  integrate(dt) {
    const a=this.current,p=this.sim.player,b=this.sim.body;
    if(!a)return;
    if(p.health<=0||p.failed){a.pilot=null;p.aircraftId=null;return;}
    const input=this.sim.intent;
    // Assisted hover/landing keeps both aircraft playable with two thumbs in portrait.
    a.heading-=(Math.abs(input.x)<.08?0:input.x)*dt*(a.kind==='jet'?1:1.35);
    const throttle=Math.abs(input.y)<.08?0:input.y;
    if(input.fast||Math.abs(throttle-(this.assistThrottle||0))>.15){a.autoLand=false;a.autoHover=false;}
    const height=gearHeight(a),support=this.sim.world.surface(a.x,a.z,a.y-height+.3),altitude=a.y-support-height;
    if(!a.airborne&&throttle>.15&&!input.brake&&!a.autoLand&&!a.autoHover)a.takeoffY=support+height+(a.kind==='jet'?12:8);
    if(input.brake||a.autoLand||a.autoHover)a.takeoffY=null;
    const takingOff=a.takeoffY!=null&&a.y<a.takeoffY-.15;
    if(!takingOff)a.takeoffY=null;
    // Clear landing gear and wings before accelerating across a city square.
    const ready=altitude>(a.kind==='jet'?4:2);
    const desired=(a.autoLand||a.autoHover||!ready?0:throttle)*(a.kind==='jet'?70:28);
    a.speed+=(desired-a.speed)*(1-Math.exp(-dt*(desired===0?4:2)));
    a.pitch+=(clamp(input.y*.12,-.15,.15)-a.pitch)*(1-Math.exp(-dt*5));
    a.roll+=(-input.x*.38-a.roll)*(1-Math.exp(-dt*5));
    const nextX=a.x-Math.sin(a.heading)*a.speed*dt,nextZ=a.z-Math.cos(a.heading)*a.speed*dt;
    const floor=this.sim.world.surface(nextX,nextZ,a.y-height+.3);
    const climb=input.fast?12:takingOff?Math.min(a.kind==='jet'?8:6,Math.max(.5,(a.takeoffY-a.y)*2)):0;
    const descent=input.brake||a.autoLand?Math.min(6,Math.max(.6,(a.y-floor-height)*1.5)):0;
    a.verticalSpeed=((input.brake||a.autoLand)?-descent:climb);
    const next={x:nextX,z:nextZ,
      y:clamp(a.y+a.verticalSpeed*dt,floor+height,groundHeight(nextX,nextZ)+650)};
    const delta={x:next.x-a.x,y:next.y-a.y,z:next.z-a.z},length=Math.hypot(delta.x,delta.y,delta.z);
    let collision=null;
    if(length>0){
      const direction={x:delta.x/length,y:delta.y/length,z:delta.z/length};
      // Nose/tail and wing/rotor edges share the actual 3D world query. A centre
      // ray alone let wings pass straight through adjacent buildings.
      for(const [side,forward]of [[0,0],[-4.5,0],[4.5,0],[0,a.kind==='jet'?6:3],[0,-3]]){
        const origin={x:a.x+Math.cos(a.heading)*side-Math.sin(a.heading)*forward,y:a.y,z:a.z-Math.sin(a.heading)*side-Math.cos(a.heading)*forward};
        const hit=this.sim.world.cast(origin,direction,length+.2);
        if(hit.kind==='wall'&&hit.distance<length+.15&&(!collision||hit.distance<collision.distance))collision=hit;
      }
    }
    if(collision){
      const normal=collision.normal;
      const impact=normal?Math.max(0,Math.sin(a.heading)*a.speed*normal.x-a.verticalSpeed*normal.y+Math.cos(a.heading)*a.speed*normal.z):Math.hypot(a.speed,a.verticalSpeed);
      a.health=Math.max(0,a.health-Math.max(0,impact-9)**2*.16);a.speed=0;a.takeoffY=null;
      if(a.health<=0){this.sim.combat.emit('blast',a,{radius:10});this.sim.damage(p,300,p);return;}
      b.notice='Obstacle ahead · climb or turn';a.autoLand=false;
      // A blocked forward stick must not also block the UP escape control.
      if(next.y>a.y&&this.sim.world.clearance({x:a.x,y:next.y,z:a.z},1,4.5))a.y=next.y;
    }else{
      a.x=clamp(next.x,WORLD.bounds[0]+8,WORLD.bounds[2]-8);
      a.z=clamp(next.z,WORLD.bounds[1]+8,WORLD.bounds[3]-8);a.y=next.y;
    }
    const wasAirborne=a.airborne;
    a.airborne=a.y>this.sim.world.surface(a.x,a.z,a.y-height+.3)+height+.12;
    if(wasAirborne&&!a.airborne){
      const impact=Math.max(0,Math.abs(a.speed)-14)*2+Math.max(0,-a.verticalSpeed-4)**2*1.5;
      if(impact>0){a.health=Math.max(0,a.health-impact);this.sim.combat.emit('crash',a,{radius:3});this.sim.damage(p,impact*.25,p);}
      a.y=this.sim.world.surface(a.x,a.z,a.y-height+.3)+height;
      a.speed*=.45;this.sim.event('land',{vehicleId:a.id});
      if(a.health<=0){this.sim.combat.emit('blast',a,{radius:10});this.sim.damage(p,300,p);a.pilot=null;p.aircraftId=null;return;}
    }
    if(!a.airborne){a.autoLand=false;a.verticalSpeed=0;}
    if(!a.airborne&&Math.abs(input.y)<.1)a.speed*=Math.exp(-dt*8);
    Object.assign(p,{x:a.x,z:a.z,heading:a.heading,speed:Math.abs(a.speed)});
    b.y=a.y;b.interaction='flying';b.grounded=false;b.action=null;
    if(input.fire&&a.airborne&&!a.civilian)this.sim.combat.launch(a,b.yaw,b.pitch);
  }
  assist(action) {const a=this.current;if(!a)return false;this.assistThrottle=this.sim.intent.y;a.autoHover=true;a.autoLand=action==='land';return true;}
  objective() {
    const a=this.current;
    return a ? {title:`${a.kind==='jet'?'Fighter jet':'Helicopter'} · ${Math.round(a.y-groundHeight(a.x,a.z))} m`,
      detail:`${a.civilian?'Commercial helicopter':a.missiles+' missiles'} · Stick takes off and moves · UP climbs · LAND stops and descends`,training:false} : null;
  }
}
