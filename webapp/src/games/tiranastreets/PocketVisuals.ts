import * as T from 'three';
import {pocketWeapon} from './PocketWeapons';
import type {StreetSimulation} from './street-career/StreetSimulation.mjs';
/** Fixed pools for food projectiles, irregular splats and a short spray cone. */
export class PocketVisuals {
  readonly group=new T.Group();
  private fruit=new Map<string,T.InstancedMesh[]>();
  private splats:T.InstancedMesh;
  private spray:T.InstancedMesh;
  private dummy=new T.Object3D();private color=new T.Color();private last=0;private state:unknown;
  private up=new T.Vector3(0,1,0);private normal=new T.Vector3();private offset=new T.Vector3();private orientation=new T.Quaternion();
  private marks:{x:number;y:number;z:number;kind:string;at:number;nx:number;ny:number;nz:number;targetId?:string;dx?:number;dz?:number}[]=[];
  constructor(scene:T.Scene){
    this.group.name='Tirana:food-and-custody-effects';scene.add(this.group);
    for(const id of ['egg','tomato']){
      const model=pocketWeapon(id),meshes:T.InstancedMesh[]=[];
      model.updateMatrixWorld(true);model.traverse(o=>{if(o instanceof T.Mesh){const geometry=o.geometry.clone().applyMatrix4(o.matrixWorld),m=new T.InstancedMesh(geometry,o.material,16);o.geometry.dispose();m.count=0;m.frustumCulled=false;meshes.push(m);this.group.add(m);}});this.fruit.set(id,meshes);
    }
    this.splats=new T.InstancedMesh(new T.SphereGeometry(1,7,5),new T.MeshStandardMaterial({roughness:.8}),192);
    this.spray=new T.InstancedMesh(new T.SphereGeometry(1,8,6),new T.MeshBasicMaterial({color:0xd7aa70,transparent:true,opacity:.16,depthWrite:false}),12);
    for(const mesh of [this.splats,this.spray]){mesh.count=0;mesh.frustumCulled=false;this.group.add(mesh);}
    this.group.traverse(o=>{if(o instanceof T.InstancedMesh)o.instanceMatrix.setUsage(T.DynamicDrawUsage);});
  }
  update(sim:StreetSimulation){
    if(this.state!==sim.state){this.marks=[];this.last=0;this.state=sim.state;}
    for(const [kind,meshes] of this.fruit){const items=sim.throwables.items.filter((p:any)=>p.kind===kind).slice(0,16);
      meshes.forEach(mesh=>{mesh.count=items.length;items.forEach((p:any,i:number)=>{this.dummy.position.set(p.x,p.y,p.z);this.dummy.rotation.set(p.age*9,0,p.age*7);this.dummy.scale.setScalar(1);this.dummy.updateMatrix();mesh.setMatrixAt(i,this.dummy.matrix);});mesh.instanceMatrix.needsUpdate=true;});
    }
    for(const e of sim.state.effects){if(e.id<=this.last)continue;this.last=e.id;if(e.kind==='egg-splat'||e.kind==='tomato-splat'){
      const n=sim.state.npcs.find(n=>n.id===e.targetId);
      this.marks.push({x:e.x,y:e.y??0,z:e.z,kind:e.kind,at:e.at,nx:e.nx??0,ny:e.ny??1,nz:e.nz??0,targetId:e.targetId,dx:n?e.x-n.x:0,dz:n?e.z-n.z:0});
    }}
    this.marks=this.marks.filter(m=>sim.state.elapsed-m.at<5).slice(-24);this.splats.count=0;
    for(const m of this.marks)for(let k=0;k<7;k++){
      const age=sim.state.elapsed-m.at,fade=Math.min(1,5-age),angle=k*2.399,r=k?.1:0;
      const n=m.targetId?sim.state.npcs.find(n=>n.id===m.targetId):undefined;
      this.normal.set(m.nx,m.ny,m.nz).normalize();this.orientation.setFromUnitVectors(this.up,this.normal);
      this.offset.set(Math.cos(angle)*r,.025,Math.sin(angle)*r).applyQuaternion(this.orientation);
      this.dummy.position.set(n?n.x+(m.dx||0):m.x,m.y,n?n.z+(m.dz||0):m.z).add(this.offset);this.dummy.quaternion.copy(this.orientation);this.dummy.scale.set(.11*fade,.025*fade,.1*fade);this.dummy.updateMatrix();
      this.splats.setMatrixAt(this.splats.count,this.dummy.matrix);this.color.set(m.kind==='tomato-splat'?0xc54125:k?0xf2e7cd:0xe6b62d);this.splats.setColorAt(this.splats.count++,this.color);
    }
    this.splats.instanceMatrix.needsUpdate=true;if(this.splats.instanceColor)this.splats.instanceColor.needsUpdate=true;
    const c=sim.player.arrest,n=c&&sim.state.npcs.find(n=>n.id===c.officerId);this.spray.count=0;
    if(c?.phase==='spray'&&n)for(let i=0;i<12;i++){
      const t=((sim.state.elapsed-c.at)*3+i/12)%1;this.dummy.position.set(n.x+(sim.player.x-n.x)*t,sim.body.y+1.35+.12*Math.sin(i*2.399),n.z+(sim.player.z-n.z)*t);
      this.dummy.rotation.set(0,0,0);this.dummy.scale.setScalar(.025+t*.18);this.dummy.updateMatrix();this.spray.setMatrixAt(this.spray.count++,this.dummy.matrix);
    }
    this.spray.instanceMatrix.needsUpdate=true;
  }
  dispose(){const materials=new Set<T.Material>();this.group.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);if(o instanceof T.InstancedMesh)o.dispose();}});materials.forEach(m=>m.dispose());this.group.removeFromParent();this.group.clear();}
}
