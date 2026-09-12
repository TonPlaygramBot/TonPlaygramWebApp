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
  private impacts = new Map<string,{racer:Racer;age:number}>();
  constructor(_camera: T.PerspectiveCamera) {
    this.sparks.count=0;this.sparks.frustumCulled=false;this.sparks.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.group.add(this.smoke.mesh,this.sparks);
  }
  crash(racer:Racer){this.impacts.set(racer.id,{racer,age:0});}
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
      const turbo=r.turbo>0||r.input?.boost&&r.boost>1;
      const tier=driftTier(r.driftCharge);
      if(!r.drifting&&!turbo)continue;
      const s=Math.sin(r.yaw),c=Math.cos(r.yaw);
      for(let i=0;i<12;i++){
        const side=i%2?1:-1,age=((this.clock*3.7+i*.13)%1),trail=age*(turbo?3.4:1.6);
        put(r.x+c*side*.72-s*(.9+trail),.16+Math.sin(age*Math.PI)*.22,r.z-s*side*.72-c*(.9+trail),(.065+ (turbo?.04:0))*(1-age),this.colors[turbo?1:tier]);
      }
    }
    for(const [id,impact] of this.impacts){
      impact.age+=dt;if(impact.age>.5){this.impacts.delete(id);continue;}
      const r=impact.racer;
      for(let i=0;i<8;i++){const a=i*Math.PI/4,d=impact.age*3;put(r.x+Math.cos(a)*d,.2+Math.sin(impact.age*Math.PI*2)*.4,r.z+Math.sin(a)*d,.05*(1-impact.age*2),this.colors[2]);}
    }
    this.sparks.count=n;this.sparks.instanceMatrix.needsUpdate=true;if(this.sparks.instanceColor)this.sparks.instanceColor.needsUpdate=true;
  }
  clear(){this.impacts.clear();this.sparks.count=0;this.smoke.clear();}
  dispose(){this.group.removeFromParent();this.smoke.dispose();this.sparks.geometry.dispose();(this.sparks.material as T.Material).dispose();this.sparks.dispose();}
}
