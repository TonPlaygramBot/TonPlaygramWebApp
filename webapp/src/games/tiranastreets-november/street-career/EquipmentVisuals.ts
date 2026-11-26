import * as T from 'three';
import {CityAssetLoader,prepareCityAssetTextures} from '../CityAssetLoader';
import {calibrateWeaponModel} from '../weaponCalibration';
import {weaponModelUrl} from '../livingVisuals';
import {disposeWeaponResources} from '../weaponModelResources';
import type {EquipmentSimulation} from './EquipmentSimulation.mjs';
/** Reuse shipped GLTF props. At most four charges and two drones are visible. */
export class EquipmentVisuals {
 readonly group=new T.Group();
 private loader=new CityAssetLoader();
 private sources=new Map<string,T.Group>();
 private pending=new Set<string>();
 private failed=new Set<string>();
 private instances=new Map<string,T.Group>();
 private dead=false;
 private anisotropy:number;
 constructor(scene:T.Scene,renderer:T.WebGLRenderer){this.loader.configure(renderer);this.anisotropy=renderer.capabilities.getMaxAnisotropy();this.group.name='Tirana:deployed-equipment';scene.add(this.group);}
 private async load(kind:string){
  this.pending.add(kind);let source:T.Group|undefined;
  try{
   const model=kind==='drone'?'shahed-game-drone':'polyDynamiteBomb01Attack',url=weaponModelUrl(model);
   source=(await this.loader.loadAsync(url)).scene;
   if(this.dead){disposeWeaponResources([source]);return;}
   const frame=calibrateWeaponModel(source,url,kind==='drone'?2.8:.28);
   prepareCityAssetTextures(frame,this.anisotropy);this.sources.set(kind,frame);
  }catch(error){if(source)disposeWeaponResources([source]);this.failed.add(kind);console.warn('Deployed equipment model unavailable',kind,error);}
  finally{this.pending.delete(kind);if(this.dead&&!this.pending.size)this.loader.dispose();}
 }
 update(equipment:EquipmentSimulation){
  const keep=new Set<string>();
  for(const [kind,items] of [['charge',equipment.charges],['drone',equipment.drones]] as const){
   if(items.length&&!this.sources.has(kind)&&!this.pending.has(kind)&&!this.failed.has(kind))void this.load(kind);
   const source=this.sources.get(kind);if(!source)continue;
   for(const item of items){
    keep.add(item.id);let root=this.instances.get(item.id);
    if(!root){root=source.clone(true);this.instances.set(item.id,root);this.group.add(root);}
    root.position.set(item.x,item.y,item.z);
    if('direction' in item)root.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),new T.Vector3(item.direction.x,item.direction.y,item.direction.z).normalize());
    else root.rotation.y=item.heading+Math.PI;
   }
  }
  for(const [id,root] of this.instances)if(!keep.has(id)){root.removeFromParent();this.instances.delete(id);}
 }
 dispose(){this.dead=true;this.group.removeFromParent();this.instances.clear();disposeWeaponResources([...this.sources.values()]);this.sources.clear();if(!this.pending.size)this.loader.dispose();}
}
