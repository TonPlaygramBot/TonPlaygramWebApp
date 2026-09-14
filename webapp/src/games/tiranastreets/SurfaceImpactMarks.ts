import * as T from 'three';
import type {Effect} from './shared/engine.mjs';

type Mark={position:T.Vector3;normal:T.Vector3;anchor?:T.Object3D;vehicleId?:string;at:number;size:number};
/** Surface-aligned bullet chips, with local coordinates for moving vehicle panels.
 * One draw call and a fixed pool; unsupported/absent surfaces never leave floating marks. */
export class SurfaceImpactMarks {
  readonly mesh:T.InstancedMesh;
  private marks:Mark[]=[];
  private lastEvent=0;
  private transform=new T.Object3D();
  private normal=new T.Vector3();
  private forward=new T.Vector3(0,0,1);
  private point=new T.Vector3();
  private orientation=new T.Quaternion();
  private ray=new T.Raycaster();
  constructor(private capacity=96){
    const material=new T.MeshBasicMaterial({color:0x282724,transparent:true,opacity:.78,
      depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,side:T.DoubleSide});
    material.defines={USE_UV:''};
    material.onBeforeCompile=shader=>{
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        vec2 p=vUv*2.-1.;float radius=length(p);
        float edge=.84+.09*sin(atan(p.y,p.x)*7.);
        diffuseColor.a*=1.-smoothstep(edge-.2,edge,radius);
        diffuseColor.rgb*=mix(.3,1.,smoothstep(.15,.72,radius));
        if(diffuseColor.a<.015)discard;`);
    };
    material.customProgramCacheKey=()=> 'tirana-surface-impact-v1';
    this.mesh=new T.InstancedMesh(new T.PlaneGeometry(1,1),material,capacity);
    this.mesh.name='Tirana:surface-impact-marks';this.mesh.count=0;this.mesh.frustumCulled=false;
    this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.mesh.renderOrder=2;
  }
  update(events:Effect[],now:number,vehicle:(id:string)=>T.Object3D|undefined,hiddenVehicleId?:string){
    for(const event of events){
      if(event.id<=this.lastEvent)continue;this.lastEvent=event.id;
      if(event.kind!=='hit'||!['wall','ground','car'].includes(event.hitKind||''))continue;
      if(![event.x,event.y,event.z,event.nx,event.ny,event.nz].every(Number.isFinite))continue;
      const position=new T.Vector3(event.x,event.y!,event.z),normal=new T.Vector3(event.nx,event.ny,event.nz);
      if(normal.lengthSq()<.1)continue;normal.normalize();
      let anchor:T.Object3D|undefined;
      if(event.hitKind==='car'){
        anchor=vehicle(event.objectId||'');if(!anchor)continue;
        anchor.updateWorldMatrix(true,true);
        this.ray.set(position.clone().addScaledVector(normal,.6),normal.clone().negate());this.ray.far=2;
        // The physics box may be wider than a curved panel: project onto the real
        // original vehicle mesh once per hit instead of painting the collision box.
        const hit=this.ray.intersectObject(anchor,true).find(h=>h.face&&!(h.object instanceof T.SkinnedMesh));
        if(!hit?.face)continue;
        position.copy(hit.point);normal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
        if(normal.dot(this.ray.ray.direction)>0)normal.negate();
        position.addScaledVector(normal,.012);
        anchor.worldToLocal(position);anchor.getWorldQuaternion(this.orientation).invert();normal.applyQuaternion(this.orientation);
      }else position.addScaledVector(normal,.014);
      if(this.marks.length===this.capacity)this.marks.shift();
      this.marks.push({position,normal,anchor,vehicleId:anchor?event.objectId:undefined,at:now,size:event.hitKind==='ground'?.09:.065});
    }
    this.marks=this.marks.filter(m=>now-m.at<90&&(!m.anchor||!!m.anchor.parent));
    let count=0;
    for(const mark of this.marks){
      if(mark.anchor&&(mark.vehicleId===hiddenVehicleId||!this.visible(mark.anchor)))continue;
      this.point.copy(mark.position);this.normal.copy(mark.normal);
      if(mark.anchor){mark.anchor.updateWorldMatrix(true,false);this.point.applyMatrix4(mark.anchor.matrixWorld);mark.anchor.getWorldQuaternion(this.orientation);this.normal.applyQuaternion(this.orientation);}
      this.transform.position.copy(this.point);this.transform.quaternion.setFromUnitVectors(this.forward,this.normal);
      this.transform.scale.setScalar(mark.size);this.transform.updateMatrix();this.mesh.setMatrixAt(count++,this.transform.matrix);
    }
    this.mesh.count=count;this.mesh.instanceMatrix.needsUpdate=true;
  }
  private visible(object:T.Object3D):boolean{for(let o:T.Object3D|null=object;o;o=o.parent)if(!o.visible)return false;return true;}
  reset(){this.marks=[];this.lastEvent=0;this.mesh.count=0;}
  dispose(){this.reset();this.mesh.geometry.dispose();(this.mesh.material as T.Material).dispose();this.mesh.removeFromParent();}
}
