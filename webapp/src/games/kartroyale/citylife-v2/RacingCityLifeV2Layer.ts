import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {V2_ASSETS_READY} from './asset-status.mjs';
import {CATALOG,BASE_URL} from './catalog.mjs';
import {verifyAsset} from './verify.mjs';
import {LIMITS,makeSites,selectSites,type Site,type Track,type World} from './placement.mjs';
type Loaded={site:Site;root:T.Group;mixer:T.AnimationMixer};
/** Bounded, visual-only race dressing; never participates in collision, race state or combat. */
export class RacingCityLifeV2Layer{
 readonly group=new T.Group();
 private readonly sites:Site[];
 private loaded=new Map<string,Loaded>();
 private pending=new Map<string,AbortController>();
 private wanted=new Set<string>();
 private failed=new Set<string>();
 private dead=false;private planned=-Infinity;private last=0;
 constructor(track:Track,world:World){
  this.group.name='Racing Royal / CityLife V2 Revised';
  this.group.userData={version:'v2-revised',status:V2_ASSETS_READY?'ready':'awaiting-binary-import',errors:[]};
  this.sites=V2_ASSETS_READY?makeSites(track,world):[];
  this.group.userData.validatedSites=this.sites.length;
 }
 update(now:number,x:number,z:number,battery:boolean){
  if(this.dead||!V2_ASSETS_READY||![now,x,z].every(Number.isFinite))return;
  const dt=this.last?Math.max(0,Math.min(.05,now-this.last)):0;this.last=now;
  const budget=battery?LIMITS.battery:LIMITS.normal;
  if(now-this.planned>=.5){
   this.planned=now;const near=selectSites(this.sites,{x,z},battery);this.wanted=new Set(near.map(s=>s.asset));
   for(const [id,abort]of this.pending)if(!this.wanted.has(id))abort.abort();
   const unwanted=[...this.loaded.values()].filter(a=>!this.wanted.has(a.site.asset)).sort((a,b)=>Math.hypot(b.site.x-x,b.site.z-z)-Math.hypot(a.site.x-x,a.site.z-z));
   for(const a of unwanted){if(this.loaded.size+this.pending.size>=budget||Math.hypot(a.site.x-x,a.site.z-z)>LIMITS.leave)this.drop(a.site.asset);}
   for(const site of near){if(this.pending.size>=LIMITS.parallel||this.loaded.size+this.pending.size>=budget)break;if(!this.loaded.has(site.asset)&&!this.pending.has(site.asset)&&!this.failed.has(site.asset))void this.load(site);}
  }
  for(const a of this.loaded.values()){a.root.visible=this.wanted.has(a.site.asset);if(a.root.visible)a.mixer.update(dt);}
 }
 private async load(site:Site){
  const asset=CATALOG.find(a=>a.id===site.asset);if(!asset)return;
  const abort=new AbortController();this.pending.set(site.asset,abort);let root:T.Group|undefined;
  const timer=setTimeout(()=>abort.abort(),20000);
  try{
   const response=await fetch(BASE_URL+asset.file,{signal:abort.signal});
   if(!response.ok)throw Error('HTTP '+response.status);
   const bytes=await response.arrayBuffer();await verifyAsset(bytes,asset);
   if(this.dead||abort.signal.aborted||!this.wanted.has(site.asset))return;
   const gltf=await new GLTFLoader().parseAsync(bytes,BASE_URL);root=gltf.scene;
   if(this.dead||abort.signal.aborted||!this.wanted.has(site.asset)){this.free(root);root=undefined;return;}
   root.position.set(site.x,.03,site.z);root.rotation.y=site.yaw;
   root.traverse(o=>{if((o as T.Mesh).isMesh){o.castShadow=false;o.receiveShadow=true;}});
   const mixer=new T.AnimationMixer(root),idle=gltf.animations.find(c=>c.name==='Idle');if(idle)mixer.clipAction(idle).play();
   this.group.add(root);this.loaded.set(site.asset,{site,root,mixer});this.group.userData.status='active';
  }catch(e){
   if(root&&!this.loaded.has(site.asset))this.free(root);
   if(!this.dead&&!abort.signal.aborted){this.failed.add(site.asset);this.group.userData.errors.push(`${site.asset}: ${e instanceof Error?e.message:String(e)}`);}
  }finally{clearTimeout(timer);this.pending.delete(site.asset);}
 }
 private drop(id:string){
  const a=this.loaded.get(id);if(!a)return;a.mixer.stopAllAction();a.mixer.uncacheRoot(a.root);a.root.removeFromParent();this.free(a.root);this.loaded.delete(id);
 }
 private free(root:T.Object3D){
  const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>(),skeletons=new Set<T.Skeleton>();
  root.traverse(o=>{const mesh=o as T.SkinnedMesh;if(!mesh.isMesh)return;geometries.add(mesh.geometry);if(mesh.isSkinnedMesh)skeletons.add(mesh.skeleton);for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){materials.add(material);for(const v of Object.values(material))if(v instanceof T.Texture)textures.add(v);}});
  skeletons.forEach(s=>s.dispose());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>{t.dispose();const image=t.source?.data as {close?:()=>void}|undefined;image?.close?.();});
 }
 /** Called by the race owner's existing disposal sentinel. Attached mesh resources
  * remain for its traversal; only detached/late loads are disposed by this layer. */
 retire(){
  if(this.dead)return;this.dead=true;for(const a of this.pending.values())a.abort();
  for(const a of this.loaded.values()){a.mixer.stopAllAction();a.mixer.uncacheRoot(a.root);const bones=new Set<T.Skeleton>();a.root.traverse(o=>{if((o as T.SkinnedMesh).isSkinnedMesh)bones.add((o as T.SkinnedMesh).skeleton);});bones.forEach(s=>s.dispose());}
  this.wanted.clear();this.loaded.clear();
 }
}
