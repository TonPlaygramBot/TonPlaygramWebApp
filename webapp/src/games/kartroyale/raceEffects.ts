import * as T from 'three';
import { TyreSmoke } from './tyreSmoke';
import { driftTier } from './arcadeRules.mjs';
import type { Racer } from './simulation.mjs';
const MAX = 192;
/** One bounded GPU batch for drift sparks, turbo trails and bumper feedback. */
export class RaceEffects {
  readonly group = new T.Group();
  private smoke = new TyreSmoke();
  private sparks = new T.InstancedMesh(new T.SphereGeometry(1,5,4), new T.MeshBasicMaterial({toneMapped:false}), MAX);
  private transform = new T.Object3D();
  private colors = ['#c9f3ff','#38d8ff','#ffbe43','#d575ff'].map(c=>new T.Color(c));
  private clock = 0;
  private materialColors = {tree:new T.Color('#94704b'),wood:new T.Color('#b89160'),concrete:new T.Color('#c8c8bd'),metal:new T.Color('#ffd985'),water:new T.Color('#9ee3ef'),kart:new T.Color('#ffbe43')};
  private impacts = new Map<string,{x:number;y:number;z:number;nx:number;nz:number;strength:number;age:number;material:keyof RaceEffects['materialColors']}>();
  constructor(_camera: T.PerspectiveCamera) {
    this.sparks.count=0;this.sparks.frustumCulled=false;this.sparks.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.group.add(this.smoke.mesh,this.sparks);
  }
  crash(racer:Racer){this.impacts.set(racer.id,{x:racer.x,y:racer.groundY||0,z:racer.z,nx:racer.impactNx,nz:racer.impactNz,strength:racer.impact,age:0,material:racer.impactMaterial||'kart'});}
  update(dt:number,racers:Racer[],_visuals:Map<string,T.Group>,_me:string,_driver:boolean){
    if(dt<=0)return;
    this.clock+=dt;this.smoke.update(dt,racers);
    let n=0;
    const put=(x:number,y:number,z:number,size:number,color:T.Color)=>{
      if(n>=MAX)return;
      this.transform.position.set(x,y,z);this.transform.scale.setScalar(size);this.transform.updateMatrix();
      this.sparks.setMatrixAt(n,this.transform.matrix);this.sparks.setColorAt(n++,color);
    };
    for(const r of racers){
      if(r.finished||r.disconnected)continue;
      const turbo=r.speed>2&&!r.braking&&(r.boosting===true||(r.throttle||0)>.1&&(r.turbo>0||r.input?.boost&&r.boost>1));
      const tier=driftTier(r.driftCharge);
      if(!r.drifting&&!turbo)continue;
      const s=Math.sin(r.yaw),c=Math.cos(r.yaw);
      for(let i=0;i<12;i++){
        const side=i%2?1:-1,age=((this.clock*3.7+i*.13)%1),trail=age*(turbo?3.4:1.6);
        put(r.x+c*side*.72-s*(.9+trail),(r.groundY||0)+(r.jumpHeight||0)+.16+Math.sin(age*Math.PI)*.22,r.z-s*side*.72-c*(.9+trail),(.065+ (turbo?.04:0))*(1-age),this.colors[turbo?1:tier]);
      }
    }
    for(const [id,impact] of this.impacts){
      impact.age+=dt;if(impact.age>.5){this.impacts.delete(id);continue;}
      // Fragments remain at the contact site and travel away from its normal.
      for(let i=0;i<8;i++){
        const a=i*Math.PI/4,d=impact.age*(2+impact.strength*4);
        put(impact.x+Math.cos(a)*d-impact.nx*d*.5,
          impact.y+.16+Math.max(0,impact.age*(impact.material==='water'?4:2.8)-impact.age*impact.age*5),
          impact.z+Math.sin(a)*d-impact.nz*d*.5,(impact.material==='water'?.12:.05)*(1-impact.age*2),this.materialColors[impact.material]);
      }
    }
    this.sparks.count=n;this.sparks.instanceMatrix.needsUpdate=true;if(this.sparks.instanceColor)this.sparks.instanceColor.needsUpdate=true;
  }
  clear(){this.impacts.clear();this.sparks.count=0;this.smoke.clear();}
  dispose(){this.group.removeFromParent();this.smoke.dispose();this.sparks.geometry.dispose();(this.sparks.material as T.Material).dispose();this.sparks.dispose();}
}
