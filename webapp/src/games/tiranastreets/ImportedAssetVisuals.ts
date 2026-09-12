import {alignVehicle} from '../tirana-east/terrainTransforms';
import {groundHeight} from '../tirana-east/terrainCore.mjs';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/examples/jsm/loaders/DRACOLoader.js';
import {clone} from 'three/examples/jsm/utils/SkeletonUtils.js';
import {vehicleAssetUrl} from '../kartroyale/vehicleAssetConfig.mjs';
import {prepareVehicleAsset} from '../kartroyale/vehicleAssetAdapter';
import {IMPORTED_BY_ID} from './shared/importedAssets.mjs';
import {disposeWeaponResources} from './weaponModelResources';
export type ImportedPlacement={id:string;x:number;z:number;y?:number;heading?:number;racingAsset?:string;assetId?:string};
/** Demand-loaded originals, two concurrent requests, shared GPU resources. */
export class ImportedAssetVisuals {
  readonly group=new T.Group();
  readonly errors=new Map<string,string>();
  private sources=new Map<string,T.Group>();
  private instances=new Map<string,T.Group>();
  private pending=new Set<string>();
  private failed=new Set<string>();
  private dead=false;
  private draco=new DRACOLoader().setDecoderPath('/assets/tirana-streets/imported/draco/');
  private loader=new GLTFLoader().setDRACOLoader(this.draco);
  constructor(){this.group.name='Tirana:Imported-assets';}
  has(id:string){return this.instances.has(id);}
  getRoot(id:string){return this.instances.get(id);}
  private async load(key:string,racing:boolean) {
    this.pending.add(key);
    let scene:T.Group|undefined;
    try {
      const item=IMPORTED_BY_ID.get(key);
      const urls=racing?[vehicleAssetUrl(key)]:item?.localUrl?[item.localUrl]:item?.urls||[];
      let error:unknown;
      for(const url of urls) {try{scene=(await this.loader.loadAsync(url)).scene;break;}catch(e){error=e;}}
      if(!scene)throw error||Error('No source model');
      if(this.dead){disposeWeaponResources([scene]);return;}
      const frame=new T.Group();frame.add(scene);
      if(racing)prepareVehicleAsset(scene,key);
      else {
        const b=new T.Box3().setFromObject(scene),size=b.getSize(new T.Vector3());
        const scale=(item?.length||1)/Math.max(size.x,size.y,size.z);
        if(!Number.isFinite(scale))throw Error('Invalid asset bounds');
        scene.scale.multiplyScalar(scale);scene.updateMatrixWorld(true);
        const fit=new T.Box3().setFromObject(scene),center=fit.getCenter(new T.Vector3());
        scene.position.sub(new T.Vector3(center.x,fit.min.y,center.z));
      }
      frame.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;}});
      this.sources.set(key,frame);
    }catch(e){if(scene)disposeWeaponResources([scene]);this.errors.set(key,String(e));this.failed.add(key);}
    finally{this.pending.delete(key);}
  }
  update(entries:readonly ImportedPlacement[], viewer:{x:number;z:number}, battery=false) {
    if(this.dead)return;
    const nearest=entries.filter(e=>Math.hypot(e.x-viewer.x,e.z-viewer.z)<(IMPORTED_BY_ID.get(e.assetId||'')?.kind==='weapon'?14:battery?45:100))
      .sort((a,b)=>Math.hypot(a.x-viewer.x,a.z-viewer.z)-Math.hypot(b.x-viewer.x,b.z-viewer.z)).slice(0,battery?6:14);
    const keep=new Set(nearest.map(e=>e.id));
    for(const [id,root] of this.instances)if(!keep.has(id)){root.removeFromParent();this.instances.delete(id);}
    for(const e of nearest){
      const key=e.racingAsset||e.assetId;if(!key)continue;
      const source=this.sources.get(key);
      if(!source){if(this.pending.size<2&&!this.pending.has(key)&&!this.failed.has(key))void this.load(key,!!e.racingAsset);continue;}
      let root=this.instances.get(e.id);
      if(!root){root=clone(source) as T.Group;root.name=e.id;root.userData.assetKey=key;this.instances.set(e.id,root);this.group.add(root);}
      root.position.set(e.x,(e.y??.03)+groundHeight(e.x,e.z),e.z);root.rotation.y=(e.heading||0)+(e.racingAsset?Math.PI:0);if(e.racingAsset)alignVehicle(root,(e.heading||0)+Math.PI);
    }
    const live=new Set([...this.instances.values()].map(r=>r.userData.assetKey));
    for(const [key,source] of this.sources)if(this.sources.size>12 && !live.has(key)){disposeWeaponResources([source]);this.sources.delete(key);}
  }
  dispose(){this.dead=true;this.draco.dispose();this.group.removeFromParent();this.instances.clear();this.sources.forEach(s=>disposeWeaponResources([s]));this.sources.clear();}
}
