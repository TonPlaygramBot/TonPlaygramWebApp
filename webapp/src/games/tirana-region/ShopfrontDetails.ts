import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {buildFacadeGltf} from './facadeAssets.mjs';
import {signSVG} from './advertArt.mjs';
import {facadeSites,createSiteIndex} from './facadeCore.mjs';
type Site={id:string;x:number;z:number;yaw:number;width:number;height:number;variant:number};
type Batch={mesh:T.InstancedMesh;variant:number};
function release(root:T.Object3D){const gs=new Set<T.BufferGeometry>(),ms=new Set<T.Material>(),ts=new Set<T.Texture>();root.traverse(o=>{if(o instanceof T.Mesh){gs.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){ms.add(m);for(const v of Object.values(m))if(v instanceof T.Texture)ts.add(v);}}});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());ts.forEach(t=>t.dispose());root.clear();}
/** Shared by Tirana Streets and Racing Royal. Exact stored footprint placement;
 * authored visuals, no edits to WORLD or collision. Hard-bounded, streamed slots. */
export class ShopfrontDetails{
 readonly group=new T.Group();readonly errors:string[];readonly ready:Promise<void>;
 private retired=false;private disposed=false;private batches:Batch[]=[];private last=-Infinity;
 private select:(p:{x:number;z:number},radius:number,limit:number)=>Site[];
 private textures=new Set<T.Texture>();private dummy=new T.Object3D();
 constructor(world:any,excluded:Set<string>=new Set(),errorSink:string[]=[]){
  this.errors=errorSink;
  this.group.name='Tirana:original-2K-glTF-shopfronts';
  this.group.userData={accuracy:'Existing source footprints; fictional shops and decorative facade details',textureResolution:2048,maxNearbyFacades:48};
  this.select=createSiteIndex(facadeSites(world,excluded));
  this.ready=Promise.all([0,1,2,3].map(async variant=>{
   const root=await new Promise<T.Group>((resolve,reject)=>new GLTFLoader().parse(JSON.stringify(buildFacadeGltf(variant)),'',g=>resolve(g.scene),reject));
   if(this.retired){release(root);return;}
   const url=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(signSVG(variant))}`;
   const texture=new T.TextureLoader().load(url,loaded=>{if(this.retired){loaded.dispose();return;}loaded.colorSpace=T.SRGBColorSpace;loaded.flipY=false;loaded.anisotropy=1;loaded.needsUpdate=true;},undefined,e=>{if(!this.retired)this.errors.push(`Advert ${variant}: ${String(e)}`);});
   texture.colorSpace=T.SRGBColorSpace;texture.flipY=false;this.textures.add(texture);
   root.updateMatrixWorld(true);
   root.traverse(o=>{if(!(o instanceof T.Mesh))return;for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof T.MeshStandardMaterial&&m.name==='advert'){m.map=texture;m.needsUpdate=true;}
    const mesh=new T.InstancedMesh(o.geometry,o.material,48);mesh.count=0;mesh.name=`Facade:${variant}:${o.name}`;mesh.receiveShadow=true;mesh.castShadow=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.group.add(mesh);this.batches.push({mesh,variant});
   });root.clear();
  }).map(p=>p.catch(e=>{if(!this.retired)this.errors.push(`Facade glTF: ${String(e)}`);}))).then(()=>{});
 }
 update(seconds:number,viewer?:{x:number;z:number},battery=false){
  if(this.retired||!viewer||!Number.isFinite(seconds)||seconds-this.last<.25&&seconds>=this.last)return;this.last=seconds;
  const selected=this.select(viewer,battery?135:240,battery?16:48);
  for(const batch of this.batches){let n=0;for(const s of selected){if(s.variant!==batch.variant)continue;this.dummy.position.set(s.x,.08,s.z);this.dummy.rotation.set(0,s.yaw,0);this.dummy.scale.set(Math.min(1,s.width/5.5),1,1);this.dummy.updateMatrix();batch.mesh.setMatrixAt(n++,this.dummy.matrix);}batch.mesh.count=n;batch.mesh.visible=n>0;batch.mesh.instanceMatrix.needsUpdate=true;batch.mesh.computeBoundingSphere();}
 }
 /** Called BEFORE an owning renderer disposes its scene traversal. */
 retire(){this.retired=true;this.textures.forEach(t=>t.dispose());this.textures.clear();}
 dispose(){if(this.disposed)return;this.disposed=true;this.retire();release(this.group);this.group.removeFromParent();this.batches=[];}
}
