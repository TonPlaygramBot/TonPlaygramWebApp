import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/examples/jsm/loaders/DRACOLoader.js';
import {disposeWeaponResources} from '../tiranastreets/weaponModelResources';
/** The uploaded Namazgjah scan replaces only its matching mapped building.
 * The existing shell remains until the local model has loaded successfully. */
export class UploadedMosque{
 private pending=false;private dead=false;private loaded=false;private decoder=new DRACOLoader().setDecoderPath('/assets/tirana-streets/imported/draco/').setWorkerLimit(1);
 private model?:T.Group;
 constructor(private host:T.Group,private x:number,private z:number){}
 update(viewer:{x:number;z:number}){
  if(this.pending||this.dead||this.loaded||Math.hypot(viewer.x-this.x,viewer.z-this.z)>900)return;
  this.pending=true;
  void new GLTFLoader().setDRACOLoader(this.decoder).loadAsync('/assets/tirana-streets/city-mobility/namazgjah.glb').then(({scene})=>{
   if(this.dead){disposeWeaponResources([scene]);return;}
   for(const child of [...this.host.children]){child.removeFromParent();child.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.LineSegments)o.geometry.dispose();});}
   scene.position.set(this.x,.06,this.z);scene.name='Uploaded Great Mosque of Tirana';
   scene.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;}});
   this.host.add(scene);this.model=scene;this.loaded=true;
   this.host.userData.uploadedAsset='great_mosque_of_tirana_albania.glb';
  }).catch(e=>{this.host.userData.assetError=String(e);}).finally(()=>this.decoder.dispose());
 }
 dispose(){this.dead=true;if(this.model){this.model.removeFromParent();disposeWeaponResources([this.model]);}if(!this.pending)this.decoder.dispose();}
}
