import * as T from 'three';
import {WorldEnhancements as ExistingEnhancements} from './BaseWorldEnhancements';
import {ShopfrontDetails} from '../tirana-region/ShopfrontDetails';
import {WORLD} from '../tiranastreets/shared/world.mjs';
import {CIVIC_SITES} from './geography.mjs';
export {disposeTree,originalAsset,CivicDetails,DajtiLayer} from './BaseWorldEnhancements';
/** Existing civic/Dajti layer is preserved verbatim in BaseWorldEnhancements.
 * New details use the same world-space metre frame in both games. */
export class WorldEnhancements extends ExistingEnhancements{
 readonly shopfronts=new ShopfrontDetails(WORLD,new Set(CIVIC_SITES.map(s=>s.way)),this.civic.errors);
 constructor(){super();this.group.add(this.shopfronts.group);}
 override update(seconds:number,camera?:T.PerspectiveCamera,worldViewer?:{x:number;z:number},battery=false){
  super.update(seconds,camera);
  let viewer=worldViewer;
  if(!viewer&&camera){this.group.updateWorldMatrix(true,false);const p=this.group.worldToLocal(camera.getWorldPosition(new T.Vector3()));viewer={x:p.x,z:p.z};}
  this.shopfronts.update(seconds,viewer,battery);
 }
 override retire(){this.shopfronts.retire();super.retire();}
 override dispose(){this.shopfronts.dispose();super.dispose();}
}
const layers=new WeakMap<T.Scene,WorldEnhancements>();
export function attachEnhancements(scene:T.Scene,origin={x:0,z:0}){
 const previous=layers.get(scene);if(previous)return previous;
 const layer=new WorldEnhancements();layer.group.position.set(-origin.x,0,-origin.z);scene.add(layer.group);layers.set(scene,layer);return layer;
}
