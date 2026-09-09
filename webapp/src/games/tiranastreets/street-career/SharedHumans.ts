import * as T from 'three';
import {GLTFLoader, type GLTF} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {clone} from 'three/examples/jsm/utils/SkeletonUtils.js';
import {LivingVisuals} from '../livingVisuals';
import type {NPC, Point} from '../shared/engine.mjs';
import {nearbyHumans, actorRole, stableActorHash, type HumanAsset} from './humanRoster.mjs';

import {chooseSharedHuman, type SharedAsset} from './sharedCastCore.mjs';
import {SHARED_GAME_CAST} from './SharedGameCast';

type Joint={bone:T.Bone;rest:T.Quaternion;name:string};
type Actor={root:T.Group;model:T.Object3D;asset:string;role:string;joints:Joint[];mixer:T.AnimationMixer;clips:T.AnimationClip[];action?:T.AnimationAction;motion:string;label:T.Sprite};
const rotation=new T.Quaternion(),euler=new T.Euler();
function disposeResources(root:T.Object3D) {
  const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>(),skeletons=new Set<T.Skeleton>();
  root.traverse(o=>{if(o instanceof T.SkinnedMesh)skeletons.add(o.skeleton);if(o instanceof T.Mesh||o instanceof T.Sprite){if(o instanceof T.Mesh)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const t of Object.values(m))if(t instanceof T.Texture)textures.add(t);}}});
  skeletons.forEach(s=>s.dispose());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
}
/** Reuses the actual Chess catalog plus the already bundled game humans.
 * Skeletons are private; original PBR geometry/textures are shared per source. */
export class SharedHumans {
  readonly group=new T.Group(); readonly errors:string[]=[];
  private bike?:T.Group;private bikes=new Map<string,T.Group>();
  private sources=new Map<string,GLTF>(); private requested=new Set<string>();
  private failed=new Set<string>();
  private actors=new Map<string,Actor>(); private queue:SharedAsset[]=[];private loading=0;
  private aborts=new Set<AbortController>();
  private dead=false;private held=new LivingVisuals();
  private signs=new Map<string,T.SpriteMaterial>();
  private loader=new GLTFLoader();
  constructor(private cast:readonly SharedAsset[]=SHARED_GAME_CAST){
    this.group.name='Tirana:shared-games-human-NPCs';
    this.primeLocalHumans();
    void this.loader.loadAsync('/assets/tirana-streets/living/motorbike.glb').then(g=>{
      if(this.dead){disposeResources(g.scene);return;}
      g.scene.rotation.y=-Math.PI/2;g.scene.updateMatrixWorld(true);
      const b=new T.Box3().setFromObject(g.scene),size=b.getSize(new T.Vector3()),c=b.getCenter(new T.Vector3()),scale=2.1/Math.max(size.x,size.z);
      if(!Number.isFinite(scale)||scale<=0){disposeResources(g.scene);throw Error('Invalid two-wheeler');}
      g.scene.scale.setScalar(scale);g.scene.position.set(-c.x*scale,-b.min.y*scale,-c.z*scale);
      this.bike=new T.Group();this.bike.add(g.scene);
    }).catch(e=>{if(!this.dead)this.errors.push(`Existing two-wheeler: ${String(e)}`);});
  }
  private primeLocalHumans(){
    const priority=['rpm-current','chess-human','athlete-male','athlete-female','mixamo-soldier'];
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
    const box=new T.Box3().setFromObject(model),center=box.getCenter(new T.Vector3()),scale=1.76/(box.max.y-box.min.y);
    model.scale.multiplyScalar(scale);model.position.add(new T.Vector3(-center.x*scale,-box.min.y*scale,-center.z*scale));
    root.name=`shared-npc:${n.id}`;root.userData={sourceId:asset.sourceId,modelURL:asset.url,role};root.add(model);
    const joints:Joint[]=[];
    model.traverse(o=>{if(o instanceof T.Bone)joints.push({bone:o,rest:o.quaternion.clone(),name:o.name.toLowerCase().replace(/[^a-z0-9]/g,'')});if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;}});
    const label=new T.Sprite(this.sign(role==='police'?'POLICE':role==='soldier'?'MILITARY':role==='dealer'?'ARBEN':asset.label.toUpperCase()));
    label.position.y=2.05;label.scale.set(.95,.238,1);root.add(label);
    // Role markings are separate authored accessories; never recolour skin/PBR maps.
    if(role==='police'||asset.id.endsWith('gold')||asset.id.endsWith('violet')){
      const color=role==='police'?0x142b4b:asset.id.endsWith('gold')?0xf6bc54:0xb195ff;
      const band=new T.Mesh(new T.BoxGeometry(.12,.11,.04),new T.MeshStandardMaterial({color,roughness:.8}));
      band.name='role-armband';band.position.set(.28,1.24,.03);root.add(band);
    }
    const actor:Actor={root,model,asset:asset.id,role,joints,mixer:new T.AnimationMixer(model),clips:g.animations,motion:'',label};
    this.actors.set(n.id,actor);this.group.add(root);return actor;
  }
  private pose(a:Actor,n:NPC,time:number,dt:number){
    const moving=n.speed>.15&&n.health>0,cycle=n.motion==='cycle',running=n.anim==='run'||n.speed>3;
    const motion=moving?(running?'run':'walk'):'idle';
    const clip=a.clips.find(c=>new RegExp(motion,'i').test(c.name));
    if(a.motion!==motion){a.action?.fadeOut(.15);a.action=clip?a.mixer.clipAction(clip).reset().fadeIn(.15).play():undefined;a.motion=motion;}
    if(clip){a.mixer.update(dt);}else{
      // No cross-rig Mixamo retargeting: animate each imported rig from its own rest pose.
      const phase=time*(running?10:6)+stableActorHash(n.id)%31,swing=moving?Math.sin(phase)*(running?.65:.35):0;
      for(const j of a.joints){let x=0,z=0;const name=j.name;
        if(/(leftupleg|thighl|upperlegl)$/.test(name))x=cycle?-1.15+swing*.35:swing;
        else if(/(rightupleg|thighr|upperlegr)$/.test(name))x=cycle?-1.15-swing*.35:-swing;
        else if(/(leftleg|calfl|lowerlegl)$/.test(name))x=cycle?1.3:Math.max(0,-swing)*.75;
        else if(/(rightleg|calfr|lowerlegr)$/.test(name))x=cycle?1.3:Math.max(0,swing)*.75;
        else if(/(leftarm|leftupperarm|upperarml)$/.test(name)){z=-1.0;x=n.weapon?-.9:-swing;}
        else if(/(rightarm|rightupperarm|upperarmr)$/.test(name)){z=1.0;x=n.weapon?-.9:swing;}
        else if(/(leftforearm|rightforearm|lowerarm[lr])$/.test(name))x=n.weapon?-.45:-.1;
        j.bone.quaternion.copy(j.rest).multiply(rotation.setFromEuler(euler.set(x,0,z)));
      }
    }
  }
  update(npcs:readonly NPC[],viewer:Point,time:number,dt:number,battery=false){
    if(this.dead)return;const selected=nearbyHumans(npcs,viewer,battery),keep=new Set(selected.map(n=>n.id));
    for(const [id] of this.actors)if(!keep.has(id))this.remove(id);
    for(const n of selected){let asset=chooseSharedHuman(n,this.cast);this.request(asset);if(!this.sources.has(asset.url)){const role=actorRole(n.kind);const fallback=this.cast.find(a=>a.url.startsWith('/')&&a.roles.includes(role)&&this.sources.has(a.url));if(fallback)asset=fallback;}const source=this.sources.get(asset.url);if(!source||n.motion==='cycle'&&!this.bike)continue;
      let a=this.actors.get(n.id);if(a&&(a.asset!==asset.id||a.role!==actorRole(n.kind))){this.remove(n.id);a=undefined;}
      a ||= this.create(n,asset,source);
      a.root.position.set(n.x,n.motion==='cycle'?-.18:.06,n.z);a.root.rotation.set(n.health<=0?-Math.PI/2:0,n.heading+Math.PI,0);
      a.label.visible=n.health>0&&Math.hypot(n.x-viewer.x,n.z-viewer.z)<18;
      if(n.health>0)this.pose(a,n,time,dt);
      this.held.pose(`shared-${n.id}`,a.root,n,time);
      if(n.motion==='cycle'&&this.bike&&n.health>0){let bike=this.bikes.get(n.id);if(!bike){bike=this.bike.clone(true);this.bikes.set(n.id,bike);this.group.add(bike);}bike.position.set(n.x,0,n.z);bike.rotation.y=n.heading+Math.PI;}
      else{this.bikes.get(n.id)?.removeFromParent();this.bikes.delete(n.id);}
    }
  }
  private remove(id:string){
    const a=this.actors.get(id);if(!a)return;
    this.bikes.get(id)?.removeFromParent();this.bikes.delete(id);this.held.forget(`shared-${id}`);a.mixer.stopAllAction();a.mixer.uncacheRoot(a.model);
    const skeletons=new Set<T.Skeleton>();a.model.traverse(o=>{if(o instanceof T.SkinnedMesh)skeletons.add(o.skeleton);});skeletons.forEach(s=>s.dispose());
    const band=a.root.getObjectByName('role-armband');if(band)disposeResources(band);
    a.root.removeFromParent();this.actors.delete(id);
  }
  dispose(){
    if(this.dead)return;this.dead=true;this.queue=[];for(const abort of this.aborts)abort.abort();this.aborts.clear();
    for(const id of [...this.actors.keys()])this.remove(id);
    this.held.dispose();if(this.bike)disposeResources(this.bike);for(const g of this.sources.values())disposeResources(g.scene);this.sources.clear();
    for(const m of this.signs.values()){m.map?.dispose();m.dispose();}this.signs.clear();this.failed.clear();this.requested.clear();this.group.removeFromParent();
  }
}
