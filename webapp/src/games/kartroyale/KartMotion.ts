import type { Racer } from './simulation.mjs';

type Spring = { position:number; velocity:number };
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
/** Cosmetic suspension only. Physics and race progress never depend on render FPS. */
export class KartMotion {
  private pitchSpring:Spring={position:0,velocity:0};
  private rollSpring:Spring={position:0,velocity:0};
  private heightSpring:Spring={position:0,velocity:0};
  private travel=0;
  pitch=0; roll=0; height=0; wheelSpin=0; leftSteer=0; rightSteer=0; boost=0;
  update(r:Racer,dt:number,radius=.28,reduced=false) {
    dt=clamp(Number.isFinite(dt)?dt:0,0,.1);
    if(dt===0)return;
    const speed=Number.isFinite(r.speed)?r.speed:0;
    this.travel=(this.travel+Math.abs(speed)*dt)%10000;
    this.wheelSpin=(this.wheelSpin+speed*dt/Math.max(.1,radius))%(Math.PI*2);
    const rack=-(r.steering||0)*.42;
    // The inside front wheel turns slightly farther than the outside wheel.
    this.leftSteer=rack*(rack>0?1.1:.92);this.rightSteer=rack*(rack<0?1.1:.92);
    const powered=speed>2 && !r.braking && (r.throttle||0)>.1 &&
      (r.turbo>0 || (r.input?.boost===true && r.boost>1));
    this.boost+=(Number(powered)-this.boost)*(1-Math.exp(-dt*8));
    const pitch=reduced?0:clamp(-(r.acceleration||0)*.0026,-.07,.095);
    const roll=reduced?0:clamp((r.yawRate||0)*speed*.0025,-.09,.09);
    const height=reduced?0:Math.sin(this.travel*3+r.slot)*Math.min(.009,Math.abs(speed)*.0003);
    const spring=(state:Spring,target:number)=>{
      // Bounded substeps keep the damped spring stable on 30/60/120 Hz devices.
      const steps=Math.ceil(dt*120),step=dt/steps;
      for(let i=0;i<steps;i++) {
        state.velocity+=((target-state.position)*150-state.velocity*20)*step;
        state.position+=state.velocity*step;
      }
      return state.position;
    };
    this.pitch=spring(this.pitchSpring,pitch);
    this.roll=spring(this.rollSpring,roll);
    this.height=spring(this.heightSpring,height);
  }
}
