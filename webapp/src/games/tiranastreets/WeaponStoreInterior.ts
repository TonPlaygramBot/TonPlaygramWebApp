import * as T from 'three';
import { SPAWN } from './shared/engine.mjs';
import { WEAPON_STORE_CATALOG } from './weaponStoreCatalog.mjs';
import {UPLOADED_WEAPONS} from './shared/uploadedWeapons.mjs';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {prepareWeaponScene,releaseBatchedSourceGeometry,disposeWeaponResources} from './weaponModelResources';

/** Open-front, walk-in original interior. Shared geometry/materials keep the
 * entire room inexpensive on mobile. Uploaded models load once near a shop,
 * and all fifteen interiors share their geometry, PBR maps and materials. */
export class WeaponStoreInterior {
  readonly group = new T.Group();
  private readonly geometries: T.BufferGeometry[] = [];
  private readonly materials: T.Material[] = [];
  private displayModels = new Map<string,T.Group>();
  private requested = false;
  private dead = false;
  constructor() {
    this.group.name = 'TonPlaygramWeaponStore';
    this.group.position.set(SPAWN.x + 12, 0, SPAWN.z + 2);
    const dark = this.material(0x172126), wood = this.material(0x724b31);
    const lime = this.material(0xc8f25b, .45, .05), wall = this.material(0xd6d0bf);
    const box = (w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material) => {
      const geometry = new T.BoxGeometry(w,h,d); this.geometries.push(geometry);
      const mesh = new T.Mesh(geometry,m); mesh.position.set(x,y,z); mesh.castShadow = mesh.receiveShadow = true;
      this.group.add(mesh); return mesh;
    };
    // The street-facing side stays open: the player can physically cross the
    // threshold without a loading screen or expensive interior scene.
    box(13,.18,13,0,.09,-4, dark); box(13,4,.22,0,2,-10.4,wall);
    box(.22,4,13,-6.4,2,-4,wall); box(.22,4,13,6.4,2,-4,wall);
    box(8,1.05,1.1,0,.55,-7.9,wood);
    box(11,.12,2.1,0,2.35,-9.9,dark);
    WEAPON_STORE_CATALOG.forEach((item,index) => {
      const x = -4.7 + (index % 4) * 3.15, z = -9.25 + Math.floor(index/4)*2.35;
      box(2.35,.08,.75,x,1.7,z,lime);
      const weapon = box(item.category === 'sidearm' ? .75 : 1.65,.16,.18,x,2.05,z-.42,dark);
      weapon.rotation.z = index % 2 ? .08 : -.08;
      weapon.userData.weaponStoreItemId = item.id;
      const display=new T.Group();display.name=`display:${item.weaponId}`;
      display.position.copy(weapon.position);display.rotation.copy(weapon.rotation);
      weapon.position.set(0,0,0);weapon.rotation.set(0,0,0);display.add(weapon);this.group.add(display);
    });
    box(4.8,.16,.8,0,3.72,-10.15,lime);
    this.group.add(new T.HemisphereLight(0xfff1cf,0x26352f,1.1));
    const light = new T.PointLight(0xffd28a,14,16,2); light.position.set(0,3.2,-5); this.group.add(light);
  }
  private material(color:number,roughness=.75,metalness=0) {
    const material = new T.MeshStandardMaterial({color,roughness,metalness});
    this.materials.push(material); return material;
  }
  setBatteryMode(enabled:boolean) { this.group.traverse(o => { if (o instanceof T.Light) o.visible = !enabled; }); }
  updateDisplays(room:T.Group=this.group) {
    if(this.dead)return;
    if(!this.requested){this.requested=true;void this.loadDisplays();}
    for(const [id,model] of this.displayModels){
      const display=room.getObjectByName(`display:${id}`);
      if(!display||display.userData.installed)continue;
      display.clear();display.add(model.clone(true));display.userData.installed=true;
    }
  }
  private async loadDisplays() {
    const loader=new GLTFLoader();
    for(const w of UPLOADED_WEAPONS){
      if(this.dead)return;
      try{
        const gltf=await loader.loadAsync(w.modelUrl);
        if(this.dead){disposeWeaponResources([gltf.scene]);return;}
        const prepared=prepareWeaponScene(gltf.scene),frame=new T.Group();frame.add(prepared);
        frame.rotation.y=Math.PI/2;frame.updateMatrixWorld(true);
        const box=new T.Box3().setFromObject(frame),size=box.getSize(new T.Vector3());
        const scale=(w.category==='sidearm'?.75:1.65)/Math.max(size.x,size.y,size.z);
        frame.scale.setScalar(scale);frame.position.copy(box.getCenter(new T.Vector3()).multiplyScalar(-scale));
        if(prepared!==gltf.scene)releaseBatchedSourceGeometry(gltf.scene);
        this.displayModels.set(w.id,frame);
      }catch(error){console.warn('Weapon store display unavailable',w.id,error);}
    }
  }
  dispose() { this.dead=true;this.group.removeFromParent();disposeWeaponResources([...this.displayModels.values()]);this.displayModels.clear();this.geometries.forEach(g=>g.dispose()); this.materials.forEach(m=>m.dispose()); }
}
