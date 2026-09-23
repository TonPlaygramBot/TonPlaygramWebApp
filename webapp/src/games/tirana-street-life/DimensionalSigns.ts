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
const available=new Set(['conad','mulliri','spar','bkt','credins','raiffeisen','plaza','rogner','vodafone','one','big-market','university-tirana']);
type Sign={id:string;brand:string;x:number;z:number;yaw:number;width:number;height:number;y:number};
/** Operator artwork on Blender-authored raised silhouettes and metal cassettes.
 * Only exact, already mapped business identities receive their own logo. */
export class DimensionalSigns{
 readonly group=new T.Group();readonly errors=new Map<string,string>();
 private sources=new Map<string,T.Group>();private actors=new Map<string,T.Group>();private pending=new Set<string>();
 private dead=false;private last=-Infinity;private sites:Sign[]=[];
 constructor(){
  this.group.name='Tirana:Blender-raised-identity-signs';
  const seen=new Set<string>();
  for(const s of [...STREET_LIFE.storefronts,...NEIGHBOURHOOD.storefronts,...BUSINESS_SIGNS] as any[]){
   const ref=signReferenceFor(s.name);if(!pointInUrbanBounds(s,4)||!ref||!available.has(ref.id)||seen.has(s.id))continue;seen.add(s.id);
   this.sites.push({id:s.id,brand:ref.id,x:s.x,z:s.z,yaw:s.yaw||0,width:s.width||4.5,height:s.signHeight||.46,y:s.mountHeight||3.21});
  }
  for(const site of CITY_PLACES.sites){
   if(!/^Universiteti i Tiran[eë]s$/i.test(site.name||''))continue;
   const edge=frontage(site,WORLD.roads,CITY_SOURCE.entrances);if(!edge)continue;
   this.sites.push({id:`university-logo-${site.id}`,brand:'university-tirana',x:edge.x+edge.nx*.28,z:edge.z+edge.nz*.28,yaw:edge.yaw,width:1.15,height:1.1,y:4.4});
  }
  this.group.userData={mappedSigns:this.sites.length,brands:available.size,accuracy:'Mapped identities; authored relief and mounting dimensions'};
 }
 private async load(id:string){
  this.pending.add(id);
  try{const {scene}=await new GLTFLoader().loadAsync(`/assets/tirana-streets/city-mobility/signs/${id}.glb`);
   if(this.dead){disposeWeaponResources([scene]);return;}
   const bounds=new T.Box3().setFromObject(scene);scene.userData.width=bounds.max.x-bounds.min.x;
   this.sources.set(id,scene);
  }catch(e){if(!this.dead)this.errors.set(id,String(e));}finally{this.pending.delete(id);}
 }
 update(time:number,viewer?:{x:number;z:number},battery=false){
  if(!viewer||this.dead||time-this.last<.25&&time>=this.last)return;this.last=time;
  const selected=this.sites.filter(s=>Math.hypot(s.x-viewer.x,s.z-viewer.z)<(battery?100:190))
   .sort((a,b)=>Math.hypot(a.x-viewer.x,a.z-viewer.z)-Math.hypot(b.x-viewer.x,b.z-viewer.z)).slice(0,battery?10:24);
  const keep=new Set(selected.map(s=>s.id));for(const [id,g]of this.actors)if(!keep.has(id)){g.removeFromParent();this.actors.delete(id);}
  for(const s of selected){const source=this.sources.get(s.brand);
   if(!source){if(this.pending.size<2&&!this.pending.has(s.brand)&&!this.errors.has(s.brand))void this.load(s.brand);continue;}
   if(this.actors.has(s.id))continue;
   const root=new T.Group(),model=source.clone(true),scale=Math.min(s.height,s.width/(source.userData.width||4));
   model.scale.setScalar(scale);model.position.set(0,s.y-scale/2,.36);root.add(model);
   root.position.set(s.x,groundHeight(s.x,s.z),s.z);root.rotation.y=s.yaw;
   root.name=s.id;this.group.add(root);this.actors.set(s.id,root);
  }
 }
 dispose(){this.dead=true;this.group.removeFromParent();this.actors.clear();disposeWeaponResources([...this.sources.values()]);this.sources.clear();}
}
