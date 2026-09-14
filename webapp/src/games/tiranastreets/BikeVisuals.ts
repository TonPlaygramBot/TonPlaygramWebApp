import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {bikeFor} from './shared/bikeCatalog.mjs';
import {groundHeight} from '../tirana-east/terrainCore.mjs';
import {disposeWeaponResources} from './weaponModelResources';
type Rider={id:string;x:number;z:number;heading:number;speed?:number;bikeType?:string;model?:string;motion?:string;forceVehicle?:string};
/** Five Blender assets, one cache per layer, bounded visible clones. */
export class BikeVisuals{
 readonly group=new T.Group();readonly errors=new Map<string,string>();
 private sources=new Map<string,T.Group>();private actors=new Map<string,T.Group>();
 private pending=new Set<string>();private dead=false;
 constructor(){this.group.name='Tirana:five-bicycle-and-motorcycle-types';}
 has(id:string){return this.actors.has(id);}
 getRoot(id:string){return this.actors.get(id);}
 owns(a:Rider){return !!bikeFor(a);}
 private async load(id:string,url:string){
  this.pending.add(id);
  try{const {scene}=await new GLTFLoader().loadAsync(url);if(this.dead){disposeWeaponResources([scene]);return;}
   scene.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;}});this.sources.set(id,scene);
  }catch(e){if(!this.dead)this.errors.set(id,String(e));}finally{this.pending.delete(id);}
 }
 update(entries:readonly Rider[],viewer:{x:number;z:number},dt:number,battery=false){
  if(this.dead)return;
  const selected=entries.filter(e=>bikeFor(e)&&Math.hypot(e.x-viewer.x,e.z-viewer.z)<(battery?110:190))
   .sort((a,b)=>Math.hypot(a.x-viewer.x,a.z-viewer.z)-Math.hypot(b.x-viewer.x,b.z-viewer.z)).slice(0,battery?20:48);
  const keep=new Set(selected.map(e=>e.id));for(const [id,root]of this.actors)if(!keep.has(id)){root.removeFromParent();this.actors.delete(id);}
  for(const e of selected){const asset=bikeFor(e)!,source=this.sources.get(asset.id);
   if(!source){if(this.pending.size<2&&!this.pending.has(asset.id)&&!this.errors.has(asset.id))void this.load(asset.id,asset.url);continue;}
   let root=this.actors.get(e.id);
   if(!root){root=source.clone(true);root.name=`bike-${e.id}`;this.actors.set(e.id,root);this.group.add(root);}
   root.position.set(e.x,groundHeight(e.x,e.z)+.03,e.z);root.rotation.y=e.heading+Math.PI;
   root.traverse(o=>{if(o.name.startsWith('wheel-'))o.rotateZ((e.speed||0)*dt/.32);});
  }
 }
 dispose(){this.dead=true;this.group.removeFromParent();this.actors.clear();disposeWeaponResources([...this.sources.values()]);this.sources.clear();}
}
