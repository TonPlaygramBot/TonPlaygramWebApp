import * as T from 'three';
import {createLudoExplosionFx,updateLudoExplosionFx,LUDO_IMPACT_DURATION} from '../../utils/ludoMissilePresentation';
type Point={x:number;y:number;z:number};
/** Same Ludo impact timeline; instances bound a busy aircraft fight to 13 draws. */
export class LudoImpactVisuals {
 private template=createLudoExplosionFx();
 private parts:{source:T.Mesh<T.SphereGeometry,T.MeshStandardMaterial>;mesh:T.InstancedMesh;alpha:T.InstancedBufferAttribute}[]=[];
 private impacts:{point:Point;radius:number;age:number;rendered:boolean}[]=[];
 private pose=new T.Object3D();private matrix=new T.Matrix4();
 constructor(scene:T.Object3D,private capacity=4){
  for(const source of [this.template.flash,...this.template.fire,...this.template.smoke]){
   const material=source.material.clone();material.opacity=1;material.depthWrite=false;
   material.onBeforeCompile=shader=>{
    shader.vertexShader='attribute float impactAlpha;varying float vImpactAlpha;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvImpactAlpha=impactAlpha;');
    shader.fragmentShader='varying float vImpactAlpha;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=vImpactAlpha;');
   };
   material.customProgramCacheKey=()=> 'tirana-ludo-impact';
   const alpha=new T.InstancedBufferAttribute(new Float32Array(capacity),1);source.geometry.setAttribute('impactAlpha',alpha);
   const mesh=new T.InstancedMesh(source.geometry,material,capacity);mesh.count=0;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
   scene.add(mesh);this.parts.push({source,mesh,alpha});
  }
 }
 spawn(point:Point,radius:number){if(this.impacts.length>=this.capacity)this.impacts.shift();this.impacts.push({point:{...point},radius,age:0,rendered:false});}
 update(dt:number){
  for(const impact of this.impacts)if(impact.rendered)impact.age+=dt;
  this.impacts=this.impacts.filter(i=>i.age<=LUDO_IMPACT_DURATION);
  this.impacts.forEach((impact,i)=>{
   updateLudoExplosionFx(this.template,impact.age);this.template.root.updateMatrixWorld(true);
   this.pose.position.set(impact.point.x,impact.point.y,impact.point.z);this.pose.scale.setScalar(impact.radius*.3/.27);this.pose.updateMatrix();
   for(const part of this.parts){this.matrix.multiplyMatrices(this.pose.matrix,part.source.matrixWorld);part.mesh.setMatrixAt(i,this.matrix);part.alpha.setX(i,part.source.material.opacity);}
   impact.rendered=true;
  });
  for(const part of this.parts){part.mesh.count=this.impacts.length;part.mesh.instanceMatrix.needsUpdate=true;part.alpha.needsUpdate=true;}
 }
 reset(){this.impacts=[];for(const p of this.parts)p.mesh.count=0;}
 dispose(){this.reset();for(const p of this.parts){p.mesh.removeFromParent();p.mesh.geometry.dispose();(p.mesh.material as T.Material).dispose();p.source.material.dispose();}}
}
