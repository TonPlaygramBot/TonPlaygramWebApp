import * as T from 'three';
import type { Racer } from './simulation.mjs';

/** Cosmetic only. Fixed particle pool and no dynamic lights keep mobile cost bounded. */
export class KartExhaust {
  readonly root = new T.Group();
  private flame: T.Mesh;
  private core: T.Mesh;
  private puffs: T.Mesh[] = [];
  private intensity = 0;
  constructor() {
    this.root.name = 'kart_exhaust';
    this.root.position.set(.43, .32, -1.08);
    const pipe = new T.Mesh(new T.CylinderGeometry(.075, .075, .28, 12, 1, true),
      new T.MeshStandardMaterial({color:'#555c62',metalness:.85,roughness:.3,side:T.DoubleSide}));
    pipe.rotation.x=Math.PI/2;
    this.root.add(pipe);
    const nozzle = new T.Mesh(new T.CircleGeometry(.064,12),new T.MeshBasicMaterial({color:'#080b0d',side:T.DoubleSide}));
    nozzle.position.z=-.145;this.root.add(nozzle);
    const makeFlame=(color:string,radius:number)=>{
      const mesh=new T.Mesh(new T.ConeGeometry(radius,1,8),new T.MeshBasicMaterial({color,transparent:true,opacity:.75,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));
      mesh.rotation.x=-Math.PI/2;mesh.visible=false;this.root.add(mesh);return mesh;
    };
    this.flame=makeFlame('#ff7b21',.11);this.core=makeFlame('#a4e9ff',.055);
    for(let i=0;i<5;i++){
      const puff=new T.Mesh(new T.IcosahedronGeometry(1,1),new T.MeshBasicMaterial({color:'#a9adb0',transparent:true,opacity:0,depthWrite:false}));
      puff.visible=false;this.root.add(puff);this.puffs.push(puff);
    }
    this.root.traverse(o=>{if(o instanceof T.Mesh)o.geometry.userData.kartOwned=true;});
  }
  update(r:Racer,dt:number,time:number,reduced:boolean) {
    const running=!r.retired&&!r.finished&&!r.disconnected;
    const boost=running&&r.speed>2&&!r.braking&&(r.boosting===true||((r.throttle||0)>.1&&(r.turbo>0||(r.input?.boost===true&&r.boost>1))));
    this.intensity+=(Number(boost)-this.intensity)*(1-Math.exp(-Math.max(0,dt)*14));
    const length=this.intensity*(reduced?.42:.48+Math.sin(time*37)*.08);
    for(const [mesh,factor] of [[this.flame,1],[this.core,.65]] as const){
      mesh.visible=length>.015;mesh.scale.set(1,length*factor,1);mesh.position.z=-.15-length*factor*.5;
    }
    const throttle=Math.max(0,Math.min(1,r.throttle||0));
    for(let i=0;i<this.puffs.length;i++){
      const puff=this.puffs[i],age=(time*(.65+throttle*.4)+i/this.puffs.length)%1;
      puff.visible=running&&!reduced&&this.intensity<.2&&throttle>.08;
      puff.position.set(Math.sin(i*2+time)*age*.035,age*.22,-.18-age*(.35+Math.abs(r.speed)*.025));
      puff.scale.setScalar(.035+age*.10);
      (puff.material as T.MeshBasicMaterial).opacity=(1-age)*.13*throttle;
    }
  }
}
