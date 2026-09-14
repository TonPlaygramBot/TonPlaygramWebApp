import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {disposeWeaponResources} from '../tiranastreets/weaponModelResources';
import FAR from '../tirana-landmark-rebuild/namazgah-far.mjs';
import {blenderGroup} from '../tirana-landmark-rebuild/geometry';
/** Authored exterior, with an immediate Blender fallback at every distance.
 * The scan is never requested. Failed detail downloads leave the complete model. */
export class BlenderMosque {
  private root=new T.Group();private far=blenderGroup(FAR);private near?:T.Group;
  private pending=false;private dead=false;private retryAt=0;
  constructor(host:T.Group,polygon:number[][]){
    const yaw=Math.atan2(-.8,-.6),c=Math.cos(yaw),s=Math.sin(yaw);
    const xs=polygon.map(p=>p[0]*c-p[1]*s),zs=polygon.map(p=>p[0]*s+p[1]*c);
    const x=(Math.min(...xs)+Math.max(...xs))/2,z=(Math.min(...zs)+Math.max(...zs))/2;
    this.root.position.set(x*c+z*s,.06,-x*s+z*c);this.root.rotation.y=yaw;
    this.root.name='Blender Namazgah exterior';this.root.add(this.far);host.add(this.root);
    host.userData.asset='landmark-rebuild/namazgah-near.glb';
    host.userData.geometryAccuracy='Public photo interpretation; 35 m dome and 50 m minarets, other dimensions unsurveyed';
  }
  update(viewer:{x:number;z:number},battery=false){
    if(this.dead)return;
    const close=!battery&&Math.hypot(viewer.x-this.root.position.x,viewer.z-this.root.position.z)<280;
    this.far.visible=!close||!this.near;if(this.near)this.near.visible=close;
    if(!close||this.pending||this.near||performance.now()<this.retryAt)return;
    this.pending=true;
    void new GLTFLoader().loadAsync('/assets/tirana-streets/landmark-rebuild/namazgah-near.glb').then(({scene})=>{
      if(this.dead){disposeWeaponResources([scene]);return;}
      scene.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;}});
      // Visibility is reconciled on the next frame with the CURRENT viewer.
      scene.visible=false;this.near=scene;this.root.add(scene);
    }).catch(()=>{this.retryAt=performance.now()+30000;}).finally(()=>{this.pending=false;});
  }
  dispose(){this.dead=true;this.root.removeFromParent();disposeWeaponResources([this.root]);this.root.clear();}
}
