import {pointInUrbanBounds} from '../tiranastreets/shared/urbanBounds.mjs';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {STREET_LIFE} from './registry.mjs';
import {NEIGHBOURHOOD} from '../tirana-neighbourhood/data.mjs';
import {BUSINESS_SIGNS} from '../tirana-city-source/businessSignRegistry.mjs';
import {CITY_PLACES} from '../tirana-city-source/registry.mjs';
import {CITY_SOURCE} from '../tirana-city-source/sourceData.mjs';
import {frontage} from '../tirana-city-source/sourceCore.mjs';
import {WORLD} from '../tiranastreets/shared/world.mjs';
import {signReferenceFor} from './signReferences.mjs';
import {groundHeight} from '../tirana-east/terrainCore.mjs';
import {disposeWeaponResources} from '../tiranastreets/weaponModelResources';
import {RELIEF_BRANDS} from './identityReliefManifest.mjs';
import {nearbyIndex} from './streetModels.mjs';
const legacy=new Set(['conad','mulliri','spar','bkt','credins','raiffeisen','plaza','rogner','vodafone','one','big-market','university-tirana']);
const available=new Set([...legacy,...RELIEF_BRANDS]);
type Sign={id:string;brand:string;x:number;z:number;yaw:number;width:number;height:number;y:number;depth:number};
function loadIdentityModel(id:string):Promise<T.Group>{
 return new Promise((resolve,reject)=>{
  let settled=false;
  const timer=setTimeout(()=>{settled=true;reject(Error(`Identity request timed out: ${id}`));},20000);
  const folder=RELIEF_BRANDS.has(id)?'city-identity':'city-mobility/signs';
  new GLTFLoader().load(`/assets/tirana-streets/${folder}/${id}.glb`,gltf=>{
   if(settled){disposeWeaponResources([gltf.scene]);return;}settled=true;clearTimeout(timer);resolve(gltf.scene);
  },undefined,error=>{if(settled)return;settled=true;clearTimeout(timer);reject(error);});
 });
}
/** Only mapped identities receive the corresponding operator artwork. Sources
 * are shared, loaded two at a time and evicted only after their instances leave. */
export class DimensionalSigns{
 readonly group=new T.Group();readonly errors=new Map<string,string>();
 private sources=new Map<string,T.Group>();private actors=new Map<string,T.Group>();
 private pending=new Set<string>();private retryAt=new Map<string,number>();
 private dead=false;private last=-Infinity;private sites:Sign[]=[];
 private near:(p:{x:number;z:number},r:number,n:number)=>Sign[];
 constructor(){
  this.group.name='Tirana:raised-identity-signs';
  const seen=new Set<string>();
  for(const s of [...STREET_LIFE.storefronts,...NEIGHBOURHOOD.storefronts,...BUSINESS_SIGNS] as any[]){
   const ref=signReferenceFor(s.name);if(!pointInUrbanBounds(s,4)||!ref||!available.has(ref.id)||seen.has(s.id))continue;
   seen.add(s.id);this.sites.push({id:s.id,brand:ref.id,x:s.x,z:s.z,yaw:s.yaw||0,
    width:s.width||4.5,height:s.signHeight||.46,y:s.mountHeight||3.21,
    // Building/fuel panels are mounted 0.8 m out; the old 0.36 m relief was hidden behind them.
    depth:['building-sign','fuel-sign'].includes(s.kind)?.94:.36});
  }
  for(const site of CITY_PLACES.sites){
   if(!/^(?:Rektorati i )?Universiteti[t]? t[eë] Tiran[eë]s$/i.test(site.name||''))continue;
   const edge=frontage(site,WORLD.roads,CITY_SOURCE.entrances);if(!edge)continue;
   this.sites.push({id:`university-logo-${site.id}`,brand:'university-tirana',x:edge.x+edge.nx*.28,
    z:edge.z+edge.nz*.28,yaw:edge.yaw,width:1.15,height:1.1,y:4.4,depth:.36});
  }
  this.near=nearbyIndex(this.sites);
  this.group.userData={mappedSigns:this.sites.length,brands:available.size,accuracy:'Mapped identities; authored relief and mounting dimensions'};
 }
 private async load(id:string){
  this.pending.add(id);
  try{
   const scene=await loadIdentityModel(id);
   if(this.dead){disposeWeaponResources([scene]);return;}
   const box=new T.Box3().setFromObject(scene),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());
   // Use measured height as well as width: source cassettes are not exactly 1 m high.
   const source=new T.Group();source.add(scene);scene.position.sub(center);scene.updateMatrix();
   source.userData={width:size.x,height:size.y};
   this.sources.set(id,source);this.errors.delete(id);this.retryAt.delete(id);
  }catch(e){if(!this.dead){this.errors.set(id,String(e));this.retryAt.set(id,performance.now()+15000);}}
  finally{this.pending.delete(id);}
 }
 update(time:number,viewer?:{x:number;z:number},battery=false){
  if(!viewer||this.dead||time-this.last<.25&&time>=this.last)return;this.last=time;
  const selected=this.near(viewer,battery?110:200,battery?12:28),keep=new Set(selected.map(s=>s.id));
  for(const [id,g]of this.actors)if(!keep.has(id)){g.removeFromParent();this.actors.delete(id);}
  const wantedBrands=new Set(selected.map(s=>s.brand));
  for(const s of selected){const source=this.sources.get(s.brand);
   if(!source){if(this.pending.size<2&&!this.pending.has(s.brand)&&performance.now()>=(this.retryAt.get(s.brand)||0))void this.load(s.brand);continue;}
   // Map order is the cache's LRU, independent of the number of branches in town.
   this.sources.delete(s.brand);this.sources.set(s.brand,source);
   if(this.actors.has(s.id))continue;
   const root=new T.Group(),model=source.clone(true),scale=Math.min(s.height/source.userData.height,s.width/source.userData.width);
   model.scale.setScalar(scale);model.position.set(0,s.y,s.depth);root.add(model);
   root.position.set(s.x,groundHeight(s.x,s.z),s.z);root.rotation.y=s.yaw;root.name=s.id;root.userData.brand=s.brand;
   root.traverse(o=>{o.updateMatrix();o.matrixAutoUpdate=false;});
   this.group.add(root);this.actors.set(s.id,root);
  }
  for(const [id,source]of this.sources){
   if(this.sources.size<=(battery?14:28))break;
   if(wantedBrands.has(id))continue;disposeWeaponResources([source]);this.sources.delete(id);
  }
  this.group.userData.visibleSigns=this.actors.size;this.group.userData.cachedBrands=this.sources.size;
 }
 dispose(){if(this.dead)return;this.dead=true;this.group.removeFromParent();this.group.clear();this.actors.clear();
  disposeWeaponResources([...this.sources.values()]);this.sources.clear();this.retryAt.clear();}
}
