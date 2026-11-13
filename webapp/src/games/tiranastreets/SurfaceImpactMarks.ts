import * as T from 'three';
import type {Effect} from './shared/engine.mjs';

type Surface='wall'|'ground'|'car'|'glass';
type Mark={position:T.Vector3;normal:T.Vector3;anchor?:T.Object3D;vehicleId?:string;at:number;size:number;surface:Surface;rotation:number};
type Feedback=(point:T.Vector3,normal:T.Vector3,surface:Surface,floor:number)=>void;
/** Surface-aligned chips, metallic scuffs and fractured glazing. All marks share
 * one draw call; moving panels retain local coordinates instead of floating in air. */
export class SurfaceImpactMarks {
  readonly mesh:T.InstancedMesh;
  private marks:Mark[]=[];
  private lastEvent=0;
  private transform=new T.Object3D();
  private normal=new T.Vector3();
  private forward=new T.Vector3(0,0,1);
  private point=new T.Vector3();
  private normalMatrix=new T.Matrix3();
  private ray=new T.Raycaster();
  private alpha:T.InstancedBufferAttribute;
  private style:T.InstancedBufferAttribute;
  private environment?:T.Object3D;
  private feedback?:Feedback;
  private glass:T.Mesh[]=[];
  private glassAt=-Infinity;
  private bounds=new T.Box3();
  private intersection=new T.Vector3();
  constructor(private capacity=96){
    const material=new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.82,
      depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,side:T.DoubleSide});
    material.defines={USE_UV:''};
    material.onBeforeCompile=shader=>{
      shader.vertexShader='attribute float markAlpha; attribute float markStyle; varying float vMarkAlpha; varying float vMarkStyle;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvMarkAlpha=markAlpha;vMarkStyle=markStyle;');
      shader.fragmentShader='varying float vMarkAlpha; varying float vMarkStyle;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        vec2 p=vUv*2.-1.;float radius=length(p),angle=atan(p.y,p.x);
        float edge=.84+.09*sin(angle*7.);
        float chip=(1.-smoothstep(edge-.2,edge,radius));
        vec3 paint=mix(vec3(.045),vec3(.42,.4,.36),smoothstep(.15,.72,radius));
        if(vMarkStyle>2.5){
          // Thin radial cracks, concentric fractures and a chipped dark centre.
          float spokes=pow(max(0.,1.-abs(sin(angle*5.+sin(radius*17.)*.18))),22.);
          float ring=1.-smoothstep(.014,.043,abs(radius-(.37+.035*sin(angle*8.))));
          float centre=1.-smoothstep(.035,.115,radius);
          chip=max(centre,max(spokes*.8,ring*.5)*smoothstep(.06,.2,radius))*(1.-smoothstep(.7,.98,radius));
          paint=mix(vec3(.77,.9,.94),vec3(.07,.13,.16),centre);
        }else if(vMarkStyle>1.5){
          // Exposed metal around the actual strike; streaks are confined to its panel.
          float scuff=(1.-smoothstep(.03,.16,abs(p.y+.055*sin(p.x*21.))))*(1.-smoothstep(.25,.96,abs(p.x)));
          float hole=1.-smoothstep(.06,.23,length(vec2(p.x*1.65,p.y)));
          chip=max(hole,scuff*.82);paint=mix(vec3(.62,.66,.69),vec3(.035),hole);
        }
        diffuseColor.a*=vMarkAlpha*chip;diffuseColor.rgb*=paint;
        if(diffuseColor.a<.015)discard;`);
    };
    material.customProgramCacheKey=()=> 'tirana-surface-impact-v3';
    this.mesh=new T.InstancedMesh(new T.PlaneGeometry(1,1),material,capacity);
    this.alpha=new T.InstancedBufferAttribute(new Float32Array(capacity),1);
    this.style=new T.InstancedBufferAttribute(new Float32Array(capacity),1);
    this.mesh.geometry.setAttribute('markAlpha',this.alpha);this.mesh.geometry.setAttribute('markStyle',this.style);
    this.mesh.name='Tirana:surface-impact-marks';this.mesh.count=0;this.mesh.frustumCulled=false;
    this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.mesh.renderOrder=2;
  }
  /** Optional real-mesh glazing projection. Only confirmed nearby impacts query
   * the bounded window list; collision/damage stays owned by the simulation. */
  bindEnvironment(root:T.Object3D,feedback?:Feedback){this.environment=root;this.feedback=feedback;this.glassAt=-Infinity;}
  private glassMaterial(mesh:T.Mesh,index=0):boolean{
    const material=Array.isArray(mesh.material)?mesh.material[index]:mesh.material;
    if(!material)return false;
    return !!(mesh.userData.windows||mesh.userData.surfaceMaterial==='glass'||material.userData.environmentWindow||
      /glass|glaz|windscreen|windshield|window|xhami/i.test(mesh.name+' '+material.name)||
      material instanceof T.MeshPhysicalMaterial&&material.transmission>.1);
  }
  private environmentSurface(mesh:T.Mesh):boolean{
    for(let o:T.Object3D|null=mesh;o;o=o.parent){
      if(o.userData.surfaceImpactExclude||o.userData.rigPoseOwner||o.userData.collectionVehicle||
        /combat-effects|blood-traces|surface-impact-marks|shared-npc|human-NPC|Albanian-Forces|first-person|held-weapon|aircraft|original-ten-car|skybox|skydome/i.test(o.name))return false;
    }
    return true;
  }
  private windowHit(now:number,battery:boolean):T.Intersection|undefined{
    if(!this.environment)return;
    if(now<this.glassAt||now-this.glassAt>.75){
      this.glass=[];this.glassAt=now;
      this.environment.traverseVisible(o=>{
        if(o instanceof T.Mesh&&!(o instanceof T.SkinnedMesh)&&o!==this.mesh&&this.glass.length<768&&this.environmentSurface(o)&&
          (Array.isArray(o.material)?o.material.some((_,i)=>this.glassMaterial(o,i)):this.glassMaterial(o)))this.glass.push(o);
      });
    }
    // A short segment around the physics hit cannot select a window across the
    // street. Broad-phase bounds avoid raycasting every facade triangle.
    const candidates:{mesh:T.Mesh;distance:number}[]=[];
    for(const mesh of this.glass){
      if(!mesh.parent||!this.attached(mesh)||!this.visible(mesh))continue;
      mesh.updateWorldMatrix(true,false);
      if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
      if(!mesh.geometry.boundingBox)continue;
      this.bounds.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
      const at=this.ray.ray.intersectBox(this.bounds,this.intersection);
      if(!at)continue;const distance=at.distanceTo(this.ray.ray.origin);
      if(distance<=this.ray.far+.01)candidates.push({mesh,distance});
    }
    candidates.sort((a,b)=>a.distance-b.distance);
    let closest:T.Intersection|undefined;
    for(const {mesh} of candidates.slice(0,battery?8:20)){
      const hit=this.ray.intersectObject(mesh,false).find(h=>h.face&&this.glassMaterial(mesh,h.face.materialIndex));
      if(hit&&(!closest||hit.distance<closest.distance))closest=hit;
    }
    return closest;
  }
  update(events:Effect[],now:number,vehicle:(id:string)=>T.Object3D|undefined,hiddenVehicleId?:string,viewer?:{x:number;y?:number;z:number},battery=false){
    let emitted=0,projected=0;
    for(const event of events){
      if(event.id<=this.lastEvent)continue;this.lastEvent=event.id;
      if(event.kind!=='hit'||!['wall','ground','car','glass'].includes(event.hitKind||''))continue;
      if(![event.x,event.y,event.z,event.nx,event.ny,event.nz].every(Number.isFinite))continue;
      if(viewer&&(event.x-viewer.x)**2+(event.z-viewer.z)**2>(battery?60:110)**2)continue;
      const position=new T.Vector3(event.x,event.y!,event.z),normal=new T.Vector3(event.nx,event.ny,event.nz);
      if(normal.lengthSq()<.1)continue;normal.normalize();
      let anchor:T.Object3D|undefined,surface=event.hitKind as Surface;
      if(surface!=='ground'&&(surface==='car'||this.environment)&&projected++>=(battery?12:24))continue;
      if(surface==='car'){
        anchor=vehicle(event.objectId||'');if(!anchor)continue;
        anchor.updateWorldMatrix(true,true);
        this.ray.set(position.clone().addScaledVector(normal,.6),normal.clone().negate());this.ray.far=2;
        // Project once onto the real curved panel rather than its physics box.
        const hit=this.ray.intersectObject(anchor,true).find(h=>h.face&&h.object instanceof T.Mesh&&!(h.object instanceof T.SkinnedMesh)&&this.visible(h.object));
        if(!hit?.face)continue;
        position.copy(hit.point);normal.copy(hit.face.normal).applyMatrix3(this.normalMatrix.getNormalMatrix(hit.object.matrixWorld)).normalize();
        if(normal.dot(this.ray.ray.direction)>0)normal.negate();
        if(this.glassMaterial(hit.object as T.Mesh,hit.face.materialIndex))surface='glass';
      }else if(surface==='wall'&&this.environment){
        this.ray.set(position.clone().addScaledVector(normal,.3),normal.clone().negate());this.ray.far=.65;
        const hit=this.windowHit(now,battery);
        if(hit?.face){
          position.copy(hit.point);normal.copy(hit.face.normal).applyMatrix3(this.normalMatrix.getNormalMatrix(hit.object.matrixWorld)).normalize();
          if(normal.dot(this.ray.ray.direction)>0)normal.negate();surface='glass';anchor=hit.object;
        }
      }
      // Feedback is emitted at most once per confirmed event, at the same visual
      // contact as the decal. Distant fire cannot exhaust a phone's shard budget.
      if(this.feedback&&emitted++<(battery?8:16))this.feedback(position,normal,surface,position.y-1.2);
      position.addScaledVector(normal,anchor?.012:.014);
      if(anchor){anchor.worldToLocal(position);normal.applyMatrix3(this.normalMatrix.setFromMatrix4(anchor.matrixWorld).transpose()).normalize();}
      const size=surface==='glass'?.65:surface==='ground'?.09:surface==='car'?.13:.075;
      const nearby=surface==='glass'&&this.marks.find(m=>m.surface===surface&&m.anchor===anchor&&m.position.distanceToSquared(position)<(surface==='glass'?.08:.012)**2&&m.normal.dot(normal)>.96);
      if(nearby){nearby.at=now;nearby.size=Math.min(size*1.3,nearby.size*1.08);continue;}
      if(this.marks.length===this.capacity)this.marks.shift();
      this.marks.push({position,normal,anchor,vehicleId:event.hitKind==='car'?event.objectId:undefined,at:now,size,surface,rotation:(event.id*2.399963)%Math.PI});
    }
    this.marks=this.marks.filter(m=>now-m.at<90&&(!m.anchor||!!m.anchor.parent&&(!this.environment||this.attached(m.anchor))));
    let count=0;
    for(const mark of this.marks){
      if(mark.anchor&&(mark.vehicleId&&mark.vehicleId===hiddenVehicleId||!this.visible(mark.anchor)))continue;
      this.point.copy(mark.position);this.normal.copy(mark.normal);
      if(mark.anchor){mark.anchor.updateWorldMatrix(true,false);this.point.applyMatrix4(mark.anchor.matrixWorld);this.normal.applyMatrix3(this.normalMatrix.getNormalMatrix(mark.anchor.matrixWorld)).normalize();}
      const range=battery?50:90;
      if(count>=(battery?Math.ceil(this.capacity*.6):this.capacity)||viewer&&(this.point.x-viewer.x)**2+(this.point.z-viewer.z)**2>range*range)continue;
      this.transform.position.copy(this.point);this.transform.quaternion.setFromUnitVectors(this.forward,this.normal);this.transform.rotateZ(mark.rotation);
      this.transform.scale.set(mark.size*(mark.surface==='car'?1.65:1),mark.size,mark.size);this.transform.updateMatrix();this.mesh.setMatrixAt(count,this.transform.matrix);
      this.alpha.setX(count,Math.max(0,Math.min(1,(90-(now-mark.at))/15)));
      this.style.setX(count++,mark.surface==='glass'?3:mark.surface==='car'?2:mark.surface==='ground'?1:0);
    }
    this.mesh.count=count;this.mesh.instanceMatrix.needsUpdate=true;this.alpha.needsUpdate=true;this.style.needsUpdate=true;
  }
  private attached(object:T.Object3D):boolean{for(let o:T.Object3D|null=object;o;o=o.parent)if(o===this.environment)return true;return false;}
  private visible(object:T.Object3D):boolean{for(let o:T.Object3D|null=object;o;o=o.parent)if(!o.visible)return false;return true;}
  reset(){this.marks=[];this.lastEvent=0;this.mesh.count=0;this.glass=[];this.glassAt=-Infinity;}
  dispose(){this.reset();this.environment=undefined;this.feedback=undefined;this.mesh.geometry.dispose();(this.mesh.material as T.Material).dispose();this.mesh.removeFromParent();}
}
