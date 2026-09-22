import {groundHeight} from '../../tirana-east/terrainCore.mjs';
import * as T from 'three';
import {GLTFLoader, type GLTF} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {clone} from 'three/examples/jsm/utils/SkeletonUtils.js';
import {LivingVisuals} from '../livingVisuals';
import type {NPC, Point} from '../shared/engine.mjs';
import {nearbyHumans, actorRole, stableActorHash, type HumanAsset} from './humanRoster.mjs';

import {chooseSharedHuman, type SharedAsset} from './sharedCastCore.mjs';
import {SHARED_GAME_CAST} from './SharedGameCast';
import {HumanoidAnimation} from './humanoidAnimation.mjs';
import {humanoidBones} from './humanoidRig.mjs';

type Actor={root:T.Group;model:T.Object3D;asset:string;role:string;animation:HumanoidAnimation;gaitSpeed:number;poseTime:number;placed:boolean;deathAt?:number;label:T.Sprite};
function disposeResources(root:T.Object3D) {
  const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>(),skeletons=new Set<T.Skeleton>();
  root.traverse(o=>{if(o instanceof T.SkinnedMesh)skeletons.add(o.skeleton);if(o instanceof T.Mesh||o instanceof T.Sprite){if(o instanceof T.Mesh)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const t of Object.values(m))if(t instanceof T.Texture)textures.add(t);}}});
  skeletons.forEach(s=>s.dispose());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
}
/** Reuses the actual Chess catalog plus the already bundled game humans.
 * Skeletons are private; original PBR geometry/textures are shared per source. */
export class SharedHumans {
  readonly group=new T.Group(); readonly errors:string[]=[];
  private sources=new Map<string,GLTF>(); private requested=new Set<string>();
  private failed=new Set<string>();
  private actors=new Map<string,Actor>(); private queue:SharedAsset[]=[];private loading=0;
  private aborts=new Set<AbortController>();
  private dead=false;private held=new LivingVisuals();
  private signs=new Map<string,T.SpriteMaterial>();
  private loader=new GLTFLoader();
  private frustum=new T.Frustum();
  private projection=new T.Matrix4();
  private bounds=new T.Sphere(new T.Vector3(),2.4);
  constructor(private cast:readonly SharedAsset[]=SHARED_GAME_CAST){
    this.group.name='Tirana:shared-games-human-NPCs';
    this.primeLocalHumans();
  }
  private primeLocalHumans(){
    const priority=['tirana-citizen-0','tirana-citizen-1','rpm-current','chess-human','athlete-male','athlete-female','mixamo-soldier'];
    for(const id of priority){const asset=this.cast.find(a=>a.id===id&&a.url.startsWith('/'));if(asset)this.request(asset);}
  }
  retryFailed(){
    if(this.dead)return;
    // Only failed requests may lose their deduplication entry. Queued and
    // in-flight models remain owned by the existing request.
    for(const url of this.failed)this.requested.delete(url);
    this.failed.clear();
    this.primeLocalHumans();
  }
  has(id:string){return this.actors.has(id);}
  get loadedCount(){return this.actors.size;}
  private request(asset:SharedAsset){
    if(this.requested.has(asset.url)||this.dead)return;
    this.requested.add(asset.url);this.queue.push(asset);this.pump();
  }
  private pump(){
    while(!this.dead&&this.loading<2&&this.queue.length){
      const asset=this.queue.shift()!;this.loading++;
      this.loadCatalogAsset(asset).then(g=>{
        if(this.dead){disposeResources(g.scene);return;}
        const box=new T.Box3().setFromObject(g.scene),height=box.max.y-box.min.y;
        let skinned=false;g.scene.traverse(o=>{if(o instanceof T.SkinnedMesh)skinned=true;});
        if(!skinned||!Number.isFinite(height)||height<.01){disposeResources(g.scene);throw Error('Not a usable rigged full-body human');}
        this.failed.delete(asset.url);this.sources.set(asset.url,g);
      }).catch(e=>{if(!this.dead){this.failed.add(asset.url);this.errors.push(`${asset.label}: ${String(e)}. Compatible loaded human or existing actor is retained.`);}}).finally(()=>{this.loading--;this.pump();});
    }
  }
  private async loadCatalogAsset(asset:SharedAsset):Promise<GLTF>{
    const urls=asset.urls||[asset.url];let last:unknown;
    for(const url of urls){
      if(this.dead)throw Error('Disposed');
      const abort=new AbortController();this.aborts.add(abort);const timer=setTimeout(()=>abort.abort(),10000);
      try{
        const absolute=new URL(url,window.location.href);
        const response=await fetch(absolute,{signal:abort.signal,credentials:'omit'});
        if(!response.ok)throw Error(`HTTP ${response.status}`);
        if(Number(response.headers.get('content-length')||0)>16*1024*1024)throw Error('Avatar exceeds 16 MB budget');
        const limit=16*1024*1024,reader=response.body?.getReader();
        let bytes:ArrayBuffer;
        if(reader){
          const chunks:Uint8Array[]= [];let size=0;
          try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>limit){await reader.cancel();throw Error('Avatar exceeds 16 MB budget');}chunks.push(part.value);}}
          finally{reader.releaseLock();}
          const combined=new Uint8Array(size);let offset=0;for(const chunk of chunks){combined.set(chunk,offset);offset+=chunk.byteLength;}bytes=combined.buffer;
        }else bytes=await response.arrayBuffer();
        if(bytes.byteLength>16*1024*1024||bytes.byteLength<12||new DataView(bytes).getUint32(0,true)!==0x46546c67)throw Error('Invalid/budget-exceeding GLB');
        return await this.loader.parseAsync(bytes,new URL('.',absolute).href);
      }catch(e){last=e;}finally{clearTimeout(timer);this.aborts.delete(abort);}
    }
    throw last||Error('No catalog source');
  }
  private sign(text:string){
    let material=this.signs.get(text);if(material)return material;
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;
    const ctx=canvas.getContext('2d');if(!ctx)throw Error('Character label canvas unavailable');
    ctx.fillStyle='#142830';ctx.fillRect(0,0,256,64);ctx.fillStyle='#f3e8c7';
    ctx.font='bold 28px sans-serif';ctx.textAlign='center';ctx.fillText(text,128,43);
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
    material=new T.SpriteMaterial({map:texture,depthTest:true,transparent:true});this.signs.set(text,material);return material;
  }
  private create(n:NPC,asset:HumanAsset,g:GLTF){
    const model=clone(g.scene),root=new T.Group(),role=actorRole(n.kind);
    const facing=new T.Group();facing.add(model);facing.updateMatrixWorld(true);
    const bones=humanoidBones(model),left=bones.get('leftarm'),right=bones.get('rightarm');
    // Mixamo's bundled soldier faces the opposite way from the RPM citizens.
    // Align anatomical left/right once; preserve the source rig and its clips.
    if(left&&right&&left.getWorldPosition(new T.Vector3()).x<right.getWorldPosition(new T.Vector3()).x)facing.rotation.y=Math.PI;
    const box=new T.Box3().setFromObject(facing),center=box.getCenter(new T.Vector3()),scale=1.76/(box.max.y-box.min.y);
    // Keep the imported scene transform intact; animation may target it.
    const normalizer=new T.Group();normalizer.add(facing);normalizer.scale.setScalar(scale);
    normalizer.position.set(-center.x*scale,-box.min.y*scale,-center.z*scale);
    root.name=`shared-npc:${n.id}`;root.userData={sourceId:asset.sourceId,modelURL:asset.url,role,rigPoseOwner:'shared-human'};root.add(normalizer);
    if(asset.id.startsWith('tirana-citizen-')){const h=stableActorHash(n.id);root.scale.setScalar(.94+(h%7)*.019);}
    model.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;}});
    const label=new T.Sprite(this.sign(role==='police'?'POLICE':role==='soldier'?'MILITARY':role==='dealer'?'ARBEN':asset.label.toUpperCase()));
    label.position.y=2.05;label.scale.set(.95,.238,1);root.add(label);
    // Role markings are separate authored accessories; never recolour skin/PBR maps.
    if(role==='police'||asset.id.endsWith('gold')||asset.id.endsWith('violet')){
      const color=role==='police'?0x142b4b:asset.id.endsWith('gold')?0xf6bc54:0xb195ff;
      const band=new T.Mesh(new T.BoxGeometry(.12,.11,.04),new T.MeshStandardMaterial({color,roughness:.8}));
      band.name='role-armband';band.position.set(.28,1.24,.03);root.add(band);
    }
    const actor:Actor={root,model,asset:asset.id,role,animation:new HumanoidAnimation(root,model,g.animations),gaitSpeed:0,poseTime:0,placed:false,label};
    this.actors.set(n.id,actor);this.group.add(root);return actor;
  }
  private pose(a:Actor,n:NPC,time:number,dt:number){
    a.animation.update(n,time,dt,a.gaitSpeed);
  }
  update(npcs:readonly NPC[],viewer:Point,time:number,dt:number,battery=false,camera?:T.Camera){
    if(this.dead)return;const selected=nearbyHumans(npcs,viewer,battery),available=typeof navigator!=='undefined'&&navigator.onLine===false?this.cast.filter(a=>a.url.startsWith('/')):this.cast,keep=new Set(selected.map(n=>n.id));
    if(camera){camera.updateMatrixWorld();this.projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);this.frustum.setFromProjectionMatrix(this.projection);}
    for(const [id] of this.actors)if(!keep.has(id))this.remove(id);
    for(const n of selected){
      const role=actorRole(n.kind);
      let asset=n.kind==='civilian'||n.kind==='dealer'||n.kind==='gang'
        ? this.cast.find(a=>a.id===`tirana-citizen-${stableActorHash(n.id)%8}`)||chooseSharedHuman(n,available)
        : chooseSharedHuman(n,available);
      this.request(asset);
      const shown=this.actors.get(n.id);
      // Keep a loaded actor during a slow request, but allow the requested
      // original to replace a temporary fallback as soon as it is available.
      if(!this.sources.has(asset.url)){
        const fallback=shown&&shown.role===role?this.cast.find(a=>a.id===shown.asset):undefined;
        if(fallback)asset=fallback;
        else if(this.failed.has(asset.url))asset=this.cast.find(a=>a.url.startsWith('/')&&a.roles.includes(role)&&this.sources.has(a.url))||asset;
      }
      const source=this.sources.get(asset.url);if(!source)continue;
      let a=this.actors.get(n.id);if(a&&(a.asset!==asset.id||a.role!==actorRole(n.kind))){this.remove(n.id);a=undefined;}
      a ||= this.create(n,asset,source);
      const first=!a.placed,distance=Math.hypot(n.x-viewer.x,n.z-viewer.z);
      const measured=n.health<=0?0:Math.min(10,Math.abs(n.speed||0));
      a.gaitSpeed+=(measured-a.gaitSpeed)*(1-Math.exp(-Math.max(0,dt)*12));a.placed=true;
      const alpha=first||dt<=0||Math.hypot(n.x-a.root.position.x,n.z-a.root.position.z)>12?1:1-Math.exp(-dt*18);
      a.root.position.x+=(n.x-a.root.position.x)*alpha;a.root.position.z+=(n.z-a.root.position.z)*alpha;
      a.root.position.y=(n.y??groundHeight(a.root.position.x,a.root.position.z))+(n.motion==='cycle'?-.18:n.anim==='cover'||n.anim==='crouch'?-.24:.06);
      if(n.health<=0)a.deathAt??=time;else a.deathAt=undefined;
      const fall=a.deathAt===undefined?0:Math.min(1,(time-a.deathAt)/.6);
      const yaw=first?n.heading+Math.PI:a.root.rotation.y+Math.atan2(Math.sin(n.heading+Math.PI-a.root.rotation.y),Math.cos(n.heading+Math.PI-a.root.rotation.y))*alpha;
      a.root.rotation.set(-Math.PI/2*fall*fall*(3-2*fall),yaw,0);
      a.label.visible=n.health>0&&distance<18;
      this.bounds.center.copy(a.root.position);this.bounds.center.y+=1;
      // The host updates the eye camera later in this frame. Use its previous
      // frustum only to budget animation, never to hide a newly revealed person.
      const onScreen=!camera||distance<4||this.frustum.intersectsSphere(this.bounds);
      a.poseTime=Math.min(.15,a.poseTime+Math.max(0,dt));
      // Keep motion and interactions immediate near the player; sample distant
      // skeletons less often while preserving every original mesh and texture.
      if(n.health>0&&(first||onScreen&&(distance<35||a.poseTime>=(distance<90?.05:.1)))){this.pose(a,n,time,a.poseTime);a.poseTime=0;}
      if(n.anim==='hit')a.root.rotation.z=Math.sin((time-(n.hitUntil||time)+.38)*18)*.13;
      if(first||onScreen)this.held.pose(`shared-${n.id}`,a.root,n,time);

    }
  }
  private remove(id:string){
    const a=this.actors.get(id);if(!a)return;
    this.held.forget(`shared-${id}`);a.animation.dispose();
    const skeletons=new Set<T.Skeleton>();a.model.traverse(o=>{if(o instanceof T.SkinnedMesh)skeletons.add(o.skeleton);});skeletons.forEach(s=>s.dispose());
    const band=a.root.getObjectByName('role-armband');if(band)disposeResources(band);
    a.root.removeFromParent();this.actors.delete(id);
  }
  dispose(){
    if(this.dead)return;this.dead=true;this.queue=[];for(const abort of this.aborts)abort.abort();this.aborts.clear();
    for(const id of [...this.actors.keys()])this.remove(id);
    this.held.dispose();for(const g of this.sources.values())disposeResources(g.scene);this.sources.clear();
    for(const m of this.signs.values()){m.map?.dispose();m.dispose();}this.signs.clear();this.failed.clear();this.requested.clear();this.group.removeFromParent();
  }
}
