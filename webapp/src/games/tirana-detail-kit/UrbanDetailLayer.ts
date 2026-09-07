import * as THREE from 'three';
import {RECIPES,PALETTE} from './recipes.mjs';
import {createDetailPlacements,selectNearby} from './placements.mjs';
import type {Placement} from './placements.mjs';
/** One instanced batch per part. Same assets and footprint placement in both games. */
export class UrbanDetailLayer {
  readonly group=new THREE.Group();
  readonly placements:Placement[];
  private batches:{asset:string;mesh:THREE.InstancedMesh}[]=[];
  private last=0; private disposed=false;
  private matrix=new THREE.Matrix4(); private object=new THREE.Object3D();
  constructor(world:any,excluded:ReadonlySet<string>=new Set(),options:{roofsOnly?:boolean}={}){
    this.group.name='Tirana:original-urban-detail-kit';
    this.placements=createDetailPlacements(world,excluded).filter(p=>!options.roofsOnly||RECIPES[p.asset].category==='roof');
    this.group.userData.accuracy='Decorative original modules on mapped building footprints; not surveyed fixture positions';
    const mats=new Map<string,THREE.Material>(),box=new THREE.BoxGeometry(1,1,1),unit=new THREE.Object3D();
    const active=new Set(this.placements.map(p=>p.asset));
    for(const asset of active){
      const recipe=RECIPES[asset];
      // Bake recipe parts sharing a material into one geometry before instancing.
      const buckets=new Map<string,{positions:number[];normals:number[]}>();
      for(const part of recipe.parts){
        unit.position.fromArray(part.p);unit.rotation.set(...part.r as [number,number,number]);unit.scale.set(1,1,1);
        const geo=part.kind==='box'?box.clone():new THREE.CylinderGeometry(part.top,part.radius,part.height,part.segments);
        if(part.kind==='box')unit.scale.fromArray(part.s);
        unit.updateMatrix();geo.applyMatrix4(unit.matrix);
        const expanded=geo.toNonIndexed(),p=expanded.getAttribute('position'),n=expanded.getAttribute('normal'),bucket=buckets.get(part.m)||{positions:[],normals:[]};
        for(let i=0;i<p.count;i++){bucket.positions.push(p.getX(i),p.getY(i),p.getZ(i));bucket.normals.push(n.getX(i),n.getY(i),n.getZ(i));}
        buckets.set(part.m,bucket);expanded.dispose();geo.dispose();
      }
      for(const [key,b] of buckets){
        if(!mats.has(key))mats.set(key,new THREE.MeshStandardMaterial(PALETTE[key]));
        const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(b.positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(b.normals,3));g.computeBoundingSphere();
        const mesh=new THREE.InstancedMesh(g,mats.get(key)!,120);mesh.count=0;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=true;this.group.add(mesh);this.batches.push({asset,mesh});
      }
    }
    box.dispose();
  }
  update(target:{x:number;z:number},battery=false,now=performance.now()){
    if(this.disposed||now<this.last)return;this.last=now+400;
    const selected=selectNearby(this.placements,target,battery);
    for(const b of this.batches){let count=0;for(const p of selected){if(p.asset!==b.asset||count>=b.mesh.instanceMatrix.count)continue;this.object.position.set(p.x,p.y,p.z);this.object.rotation.set(0,p.yaw,0);this.object.scale.set(1,1,1);this.object.updateMatrix();this.matrix.copy(this.object.matrix);b.mesh.setMatrixAt(count++,this.matrix);}b.mesh.count=count;b.mesh.instanceMatrix.needsUpdate=true;}
  }
  dispose(){if(this.disposed)return;this.disposed=true;this.group.removeFromParent();const materials=new Set<THREE.Material>();for(const b of this.batches){b.mesh.geometry.dispose();(Array.isArray(b.mesh.material)?b.mesh.material:[b.mesh.material]).forEach(m=>materials.add(m));}materials.forEach(m=>m.dispose());this.group.clear();}
}
