import * as T from 'three';
import {createLudoMissileFx} from '../../utils/ludoMissilePresentation';
export type VisualMissile = {x:number;y:number;z:number;age?:number;direction:{x:number;y:number;z:number}};
/** Ludo's same mesh/materials and attached fire/smoke. Seven bounded draw calls. */
export class MissileVisuals {
 readonly mesh:T.InstancedMesh;
 private parts:{mesh:T.InstancedMesh;local:T.Matrix4;trail:boolean}[]=[];
 private dummy=new T.Object3D();
 private direction=new T.Vector3();
 private nose=new T.Vector3(1,0,0);
 private matrix=new T.Matrix4();
 constructor(scene:T.Object3D,readonly capacity=8){
  const fx=createLudoMissileFx();fx.root.updateMatrixWorld(true);
  fx.root.traverse(o=>{if(!(o instanceof T.Mesh))return;
   const mesh=new T.InstancedMesh(o.geometry,o.material,capacity);
   mesh.name='Tirana:Ludo-missile-'+o.name;mesh.count=0;mesh.frustumCulled=false;
   mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);scene.add(mesh);
   this.parts.push({mesh,local:o.matrixWorld.clone(),trail:fx.trail.includes(o)});
  });
  this.mesh=this.parts[0].mesh;
 }
 update(missiles:readonly VisualMissile[]){
  let count=0;
  for(const m of missiles.slice(0,this.capacity)){
   if(![m.x,m.y,m.z,m.direction.x,m.direction.y,m.direction.z].every(Number.isFinite))continue;
   this.direction.set(m.direction.x,m.direction.y,m.direction.z);if(this.direction.lengthSq()<1e-8)continue;
   this.dummy.position.set(m.x,m.y,m.z);this.dummy.quaternion.setFromUnitVectors(this.nose,this.direction.normalize());this.dummy.updateMatrix();
   for(const part of this.parts){this.matrix.multiplyMatrices(this.dummy.matrix,part.local);if(part.trail){const pulse=1+Math.sin((m.age??0)*47+count)*.12;this.matrix.scale(new T.Vector3(pulse,pulse,pulse));}part.mesh.setMatrixAt(count,this.matrix);}
   count++;
  }
  for(const part of this.parts){part.mesh.count=count;part.mesh.instanceMatrix.needsUpdate=true;}
 }
 dispose(){for(const {mesh} of this.parts){mesh.removeFromParent();mesh.geometry.dispose();(mesh.material as T.Material).dispose();}}
}
