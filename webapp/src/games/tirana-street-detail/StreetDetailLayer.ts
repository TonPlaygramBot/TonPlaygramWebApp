import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {buildFinishGltf,finishSVG,bicycleSVG,surfaceUV} from './finishAssets.mjs';
import {ribbonExclusion,streetDetailProfile,type RoadDetails,type Decal,type Post} from './roadDetailCore.mjs';
export type StreetDetailOptions={profile?:'fps'|'street'|'racing';textureSize?:1024|2048;track?:{points:readonly any[];width:number}};
type Nearby<A>=(viewer:{x:number;z:number},radius:number,limit:number)=>A[];
type Batch={kind:string;mesh:T.InstancedMesh;near:Nearby<Decal>};
function nearbyIndex<A extends {x:number;z:number}>(items:readonly A[]):Nearby<A>{
  const bins=new Map<string,{item:A;order:number}[]>();
  items.forEach((item,order)=>{const key=`${Math.floor(item.x/64)},${Math.floor(item.z/64)}`;if(!bins.has(key))bins.set(key,[]);bins.get(key)!.push({item,order});});
  return(viewer,radius,limit)=>{const hits:{item:A;order:number;d:number}[]=[];for(let x=Math.floor((viewer.x-radius)/64);x<=Math.floor((viewer.x+radius)/64);x++)for(let z=Math.floor((viewer.z-radius)/64);z<=Math.floor((viewer.z+radius)/64);z++)for(const v of bins.get(`${x},${z}`)||[]){const d=Math.hypot(v.item.x-viewer.x,v.item.z-viewer.z);if(d<radius)hits.push({...v,d});}return hits.sort((a,b)=>a.d-b.d||a.order-b.order).slice(0,limit).map(v=>v.item);};
}
const corner=(x:number,z:number)=>`${Math.round(x*100)},${Math.round(z*100)}`;
function release(root:T.Object3D){const g=new Set<T.BufferGeometry>(),m=new Set<T.Material>(),t=new Set<T.Texture>();root.traverse(o=>{if(o instanceof T.Mesh){g.add(o.geometry);for(const a of Array.isArray(o.material)?o.material:[o.material]){m.add(a);for(const v of Object.values(a))if(v instanceof T.Texture)t.add(v);}}});g.forEach(a=>a.dispose());m.forEach(a=>a.dispose());t.forEach(a=>a.dispose());}
function rasterize(svg:string):Promise<string>{
  return new Promise((resolve,reject)=>{const blob=new Blob([svg],{type:'image/svg+xml'}),url=URL.createObjectURL(blob),image=new Image();let done=false;
    const finish=(error?:unknown)=>{if(done)return;done=true;clearTimeout(timer);URL.revokeObjectURL(url);if(error)reject(error);};
    const timer=setTimeout(()=>finish(Error('Local material rasterisation timed out')),8000);
    image.onload=()=>{if(done)return;try{const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;const ctx=c.getContext('2d');if(!ctx)throw Error('2D texture canvas unavailable');ctx.drawImage(image,0,0);const png=c.toDataURL('image/png');finish();resolve(png);}catch(e){finish(e);}};
    image.onerror=()=>finish(Error('Local texture could not decode'));image.src=url;
  });
}
/** Shared actual game layer. Uses original core-glTF PBR maps and geometry;
 * metre-UV upgrades target source-footprint shells only, never human meshes. */
export class StreetDetailLayer {
  readonly group=new T.Group();readonly ready:Promise<void>;
  private dead=false;private disposed=false;private last=-Infinity;
  private batches:Batch[]=[];private postMesh:T.InstancedMesh;private posts:readonly Post[];private nearPosts:Nearby<Post>;
  private dummy=new T.Object3D();private material?:T.MeshStandardMaterial;
  private sources:T.Group[]=[];private replacements=new Map<T.Material,T.MeshStandardMaterial>();
  private targets:{root:T.Object3D;excluded:readonly T.Object3D[]}[]=[];private upgraded=new WeakSet<T.Mesh>();
  private corners:Set<string>;private profile:'fps'|'street'|'racing';
  private glyph?:T.Texture;
  constructor(world:any,details:RoadDetails,private errors:string[]=[],options:StreetDetailOptions={}){
    this.profile=options.profile||'street';this.group.name='Tirana:shared-road-markings-concrete-and-PBR';
    this.group.userData={accuracy:details.accuracy,cycleSections:details.cycles.length,textureSize:options.textureSize||2048};
    this.corners=new Set((world.buildings||[]).flatMap((b:any)=>b.p.map((p:number[])=>corner(p[0],p[1]))));
    const blockedByRace=options.track?ribbonExclusion(options.track):undefined;
    const offTrack=(x:number,z:number,pad:number)=>!blockedByRace||!blockedByRace(x,z,pad);
    // The original race ribbon, barrier and start-grid take priority. City props
    // never sit inside that driveable ribbon and do not alter race collision.
    this.posts=details.posts.filter(p=>offTrack(p.x,p.z,1));this.nearPosts=nearbyIndex(this.posts);
    const colors:Record<string,number>={'crossing-bed':0x813f39,'cycle-bed':0x56634a,'cycle-edge':0xe6e2cc,edge:0xf1efe7,center:0xf1efe7,zebra:0xf4f1e8,stop:0xf4f1e8,bicycle:0xffffff};
    for(const kind of Object.keys(colors)){
      // FPS StreetVisuals owns white crossings; the drive/combat renderer does not.
      // Both city renderers already own their centre dashes.
      if(streetDetailProfile(this.profile).skipPaint.includes(kind))continue;
      const items=details.decals.filter(p=>p.kind===kind&&offTrack(p.x,p.z,Math.hypot(p.w,p.d)/2));
      if(!items.length)continue;
      const material=new T.MeshStandardMaterial({color:colors[kind],roughness:.92,metalness:0,transparent:kind==='bicycle',alphaTest:kind==='bicycle'?.1:0,depthWrite:kind!=='bicycle',polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
      const mesh=new T.InstancedMesh(new T.PlaneGeometry(1,1).rotateX(-Math.PI/2),material,Math.min(1200,items.length));
      mesh.name=`Street paint:${kind}`;mesh.count=0;mesh.receiveShadow=true;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;
      this.batches.push({kind,mesh,near:nearbyIndex(items)});this.group.add(mesh);
    }
    // Same physical envelope while asynchronous glTF material parsing completes.
    this.postMesh=new T.InstancedMesh(new T.CylinderGeometry(.135,.17,.78,16).translate(0,.39,0),new T.MeshStandardMaterial({color:0x9e9d92,roughness:.94}),Math.max(1,Math.min(256,this.posts.length)));
    this.postMesh.name='Concrete pedestrian posts';this.postMesh.count=0;this.postMesh.frustumCulled=false;this.postMesh.receiveShadow=true;this.group.add(this.postMesh);
    const size=options.textureSize||2048;
    this.ready=Promise.all(['color','normal','orm'].map(async key=>[key,await rasterize(finishSVG(key as 'color'|'normal'|'orm',size))] as const))
      .then(async maps=>{
        if(this.dead)return;
        const gltf=await new GLTFLoader().parseAsync(JSON.stringify(buildFinishGltf(Object.fromEntries(maps))), '');
        if(this.dead){release(gltf.scene);return;}
        this.sources.push(gltf.scene);
        // Plaster has no node instance; explicitly resolve the material dependency.
        const plaster=await gltf.parser.getDependency('material',0) as T.MeshStandardMaterial;
        if(this.dead){plaster.dispose();return;}
        this.material=plaster;
        for(const value of Object.values(plaster))if(value instanceof T.Texture)value.anisotropy=2;
        const model=gltf.scene.getObjectByName('concrete-post') as T.Mesh;
        if(model?.isMesh){this.postMesh.geometry.dispose();(this.postMesh.material as T.Material).dispose();this.postMesh.geometry=model.geometry;this.postMesh.material=model.material;}
        for(const target of this.targets)this.apply(target.root,target.excluded);
      }).catch(e=>{if(!this.dead)this.errors.push(`Street PBR finish: ${String(e)}`);});
    void rasterize(bicycleSVG()).then(png=>new T.TextureLoader().load(png,t=>{
      if(this.dead){t.dispose();return;}t.colorSpace=T.SRGBColorSpace;this.glyph=t;
      const batch=this.batches.find(b=>b.kind==='bicycle');if(batch){const m=batch.mesh.material as T.MeshStandardMaterial;m.map=t;m.needsUpdate=true;}
    },undefined,e=>{if(!this.dead)this.errors.push(`Cycle symbol: ${String(e)}`);})).catch(e=>{if(!this.dead)this.errors.push(String(e));});
  }
  bindBuildings(root:T.Object3D,excluded:readonly T.Object3D[]=[]){this.targets.push({root,excluded});if(this.material)this.apply(root,excluded);}
  private apply(root:T.Object3D,excluded:readonly T.Object3D[]){
    const material=this.material;if(!material||this.dead)return;
    root.traverse(o=>{
      if(!(o instanceof T.Mesh)||o instanceof T.InstancedMesh||o instanceof T.SkinnedMesh||this.upgraded.has(o)||Array.isArray(o.material))return;
      // Restrict replacement to original untextured architectural shells.
      const old=o.material;if(!(old instanceof T.MeshStandardMaterial)||old.map||old.transparent||old.metalness>.1)return;
      let parent:T.Object3D|null=o;
      while(parent&&parent!==root){if(excluded.includes(parent)||parent===this.group||parent.position.lengthSq()>1e-10||parent.quaternion.angleTo(new T.Quaternion())>1e-8||parent.scale.distanceTo(new T.Vector3(1,1,1))>1e-8)return;parent=parent.parent;}
      const geo=o.geometry,pos=geo.getAttribute('position'),normal=geo.getAttribute('normal');if(!pos||!normal||pos.count<24)return;
      geo.computeBoundingBox();const b=geo.boundingBox;if(!b||b.min.y<-.11||b.max.y-b.min.y<6||b.max.y>300)return;
      const matches=new Set<string>();for(let i=0;i<pos.count&&matches.size<3;i++){const k=corner(pos.getX(i),pos.getZ(i));if(this.corners.has(k))matches.add(k);}if(matches.size<3)return;
      const uv=new T.BufferAttribute(new Float32Array(pos.count*2),2);
      for(let i=0;i<pos.count;i++){const p=surfaceUV(pos.getX(i),pos.getY(i),pos.getZ(i),normal.getX(i),normal.getY(i),normal.getZ(i));uv.setXY(i,p[0],p[1]);}
      geo.setAttribute('uv',uv);
      let finish=this.replacements.get(old);if(!finish){finish=old.clone();finish.name=`Tirana glTF PBR / ${old.name||'mapped building'}`;finish.map=material.map;finish.normalMap=material.normalMap;finish.normalScale.copy(material.normalScale);finish.roughnessMap=material.roughnessMap;finish.roughness=1;finish.metalness=0;finish.aoMap=material.aoMap;finish.aoMapIntensity=.35;finish.needsUpdate=true;this.replacements.set(old,finish);}
      o.material=finish;this.upgraded.add(o);o.userData.tiranaPbrFinish=true;
    });
  }
  update(time:number,viewer?:{x:number;z:number},battery=false){
    if(this.dead||!viewer||![time,viewer.x,viewer.z].every(Number.isFinite)||time>=this.last&&time-this.last<.25)return;this.last=time;
    const radius=battery?100:220,profile=streetDetailProfile(this.profile),base=profile.roadY;
    for(const b of this.batches){const visible=b.near(viewer,radius,Math.min(b.mesh.instanceMatrix.count,battery?400:1200));let n=0;
      for(const p of visible){const y=base+(b.kind==='crossing-bed'?.01:b.kind==='cycle-bed'?.011:.016);this.dummy.position.set(p.x,y,p.z);this.dummy.rotation.set(0,p.yaw,0);this.dummy.scale.set(p.w,1,p.d);this.dummy.updateMatrix();b.mesh.setMatrixAt(n++,this.dummy.matrix);}b.mesh.count=n;b.mesh.instanceMatrix.needsUpdate=true;b.mesh.visible=n>0;
      if(b.kind==='bicycle'&&!this.glyph)b.mesh.visible=false;
    }
    const posts=this.nearPosts(viewer,radius,Math.min(this.postMesh.instanceMatrix.count,battery?96:256));let n=0;
    for(const p of posts){this.dummy.position.set(p.x,profile.postY,p.z);this.dummy.rotation.set(0,0,0);this.dummy.scale.set(1,1,1);this.dummy.updateMatrix();this.postMesh.setMatrixAt(n++,this.dummy.matrix);}this.postMesh.count=n;this.postMesh.instanceMatrix.needsUpdate=true;
  }
  /** Used by the Racing Royal owner before its scene-resource traversal. */
  retire(){this.dead=true;this.targets=[];}
  dispose(){if(this.disposed)return;this.disposed=true;this.retire();release(this.group);this.group.removeFromParent();for(const root of this.sources)release(root);this.material?.dispose();this.glyph?.dispose();for(const material of this.replacements.values())material.dispose();this.replacements.clear();}
}
