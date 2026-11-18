import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {realisticFacadeLayout,selectRealisticFacades,type FacadeBuilding} from './realisticFacadeLayout.mjs';
const ASSET='/assets/tirana-streets/facade-modules/facade-modules.glb';
const MODULES={window:'window_small_01',alternate:'window_small_03',large:'window_large_01',door:'door_small_02'} as const;
type Batch={mesh:T.InstancedMesh;local:T.Matrix4;variant:string};
/** Original CC0 PBR facade geometry, bounded near-field instances. The source
 * shell and old facade remain the complete load/error/distant fallback. */
export class RealisticFacadeLayer {
  readonly group=new T.Group();
  readonly ready:Promise<void>;
  readonly buildings:FacadeBuilding[];
  readonly eligibleIds:Set<string>;
  version=0;
  readonly activeIds=new Set<string>();
  private batches:Batch[]=[];
  private source:T.Group|null=null;
  private disposed=false;
  private loaded=false;
  private signature='';
  private matrix=new T.Matrix4();
  private transform=new T.Object3D();
  private viewer={x:Infinity,z:Infinity};
  private battery?:boolean;
  constructor(world:any,excluded:ReadonlySet<string>,loadAssets=true,clearance?:(x:number,z:number,pad:number)=>boolean){
    this.group.name='Tirana · CC0 detailed architectural facade modules';
    this.buildings=realisticFacadeLayout(world,excluded,clearance);
    this.eligibleIds=new Set(this.buildings.map(b=>b.id));
    this.ready=loadAssets?new GLTFLoader().loadAsync(ASSET).then(gltf=>{
      if(this.disposed){this.release(gltf.scene);return;}
      this.source=gltf.scene;this.source.updateMatrixWorld(true);
      for(const name of new Set(Object.values(MODULES))){
        const root=this.source.getObjectByName(name);
        if(!root)throw new Error(`Missing facade module ${name}`);
        const inverse=root.matrixWorld.clone().invert();
        root.traverse(node=>{if(!(node instanceof T.Mesh))return;
          const mesh=new T.InstancedMesh(node.geometry,node.material,480);
          mesh.count=0;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;
          mesh.castShadow=true;mesh.receiveShadow=true;
          this.group.add(mesh);this.batches.push({mesh,local:inverse.clone().multiply(node.matrixWorld),variant:name});
        });
      }
      this.loaded=true;this.group.userData.loaded=true;
    }).catch(error=>{this.group.userData.assetError=String(error);this.activeIds.clear();this.batches.forEach(b=>b.mesh.dispose());this.group.clear();this.batches=[];if(this.source){this.release(this.source);this.source=null;}}):Promise.resolve();
  }
  update(viewer:{x:number;z:number},battery:boolean){
    if(this.disposed||!this.loaded)return;
    if(this.battery===battery&&Math.hypot(viewer.x-this.viewer.x,viewer.z-this.viewer.z)<3)return;
    this.viewer={x:viewer.x,z:viewer.z};this.battery=battery;
    const selected=selectRealisticFacades(this.buildings,viewer,battery);
    const signature=selected.map(b=>b.id).sort().join(',')+':'+battery;
    if(signature===this.signature)return;this.signature=signature;
    this.version++;
    this.activeIds.clear();for(const building of selected)this.activeIds.add(building.id);
    for(const batch of this.batches){
      let count=0;
      for(const building of selected)for(const p of building.placements){
        if(MODULES[p.variant]!==batch.variant)continue;
        this.transform.position.set(p.x,p.y,p.z);this.transform.rotation.set(0,p.yaw,0);this.transform.scale.set(p.width/3,p.height/3,1);this.transform.updateMatrix();
        this.matrix.multiplyMatrices(this.transform.matrix,batch.local);batch.mesh.setMatrixAt(count++,this.matrix);
      }
      batch.mesh.count=count;batch.mesh.castShadow=!battery;batch.mesh.instanceMatrix.needsUpdate=true;
    }
    this.group.userData.visibleBuildings=selected.length;
    this.group.userData.visibleModules=selected.reduce((sum,b)=>sum+b.placements.length,0);
  }
  private release(root:T.Object3D){
    const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();
    root.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
    for(const material of materials)for(const value of Object.values(material))if(value instanceof T.Texture)textures.add(value);
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
  }
  dispose(){if(this.disposed)return;this.disposed=true;this.activeIds.clear();this.group.removeFromParent();this.batches.forEach(b=>b.mesh.dispose());this.group.clear();this.batches=[];if(this.source)this.release(this.source);this.source=null;}
}

/** Preserve only currently hidden matrices, not a second copy of the whole city. */
export function updateFacadeFallback(mesh:T.InstancedMesh,ids:string[],active:ReadonlySet<string>,saved:Map<number,T.Matrix4>){
  const hidden=new T.Matrix4().makeScale(0,0,0);
  for(let i=0;i<ids.length;i++){
    if(active.has(ids[i])){
      if(!saved.has(i)){const original=new T.Matrix4();mesh.getMatrixAt(i,original);saved.set(i,original);mesh.setMatrixAt(i,hidden);}
    }else if(saved.has(i)){mesh.setMatrixAt(i,saved.get(i)!);saved.delete(i);}
  }
  mesh.instanceMatrix.needsUpdate=true;
}

export type FacadeShellRange={id:string;start:number;count:number};
/** Recessed source windows need real space behind the facade. Move only the
 * rendered fallback side faces inward; roof/caps and collision data never move. */
export function updateFacadeShell(geometry:T.BufferGeometry,ranges:FacadeShellRange[],active:ReadonlySet<string>,saved:Map<string,Float32Array>){
  const positions=geometry.getAttribute('position') as T.BufferAttribute,normals=geometry.getAttribute('normal');
  let changed=false;
  for(const range of ranges){
    if(active.has(range.id)&&!saved.has(range.id)){
      saved.set(range.id,new Float32Array(positions.array.slice(range.start*3,(range.start+range.count)*3)));
      for(let i=range.start;i<range.start+range.count;i++)if(Math.abs(normals.getY(i))<.5){
        positions.setXYZ(i,positions.getX(i)-normals.getX(i)*.30,positions.getY(i),positions.getZ(i)-normals.getZ(i)*.30);
      }
      changed=true;
    }else if(!active.has(range.id)&&saved.has(range.id)){
      positions.array.set(saved.get(range.id)!,range.start*3);saved.delete(range.id);changed=true;
    }
  }
  if(changed)positions.needsUpdate=true;
}
