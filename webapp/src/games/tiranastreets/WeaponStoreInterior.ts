import * as T from 'three';
import { SPAWN } from './shared/engine.mjs';
import { WEAPON_STORE_CATALOG } from './weaponStoreCatalog.mjs';

/** Open-front, walk-in original interior. Shared geometry/materials keep the
 * entire room and seven displays inexpensive on mobile. */
export class WeaponStoreInterior {
  readonly group = new T.Group();
  private readonly geometries: T.BufferGeometry[] = [];
  private readonly materials: T.Material[] = [];
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
      const x = -4.7 + (index % 4) * 3.15, z = index < 4 ? -9.25 : -6.9;
      box(2.35,.08,.75,x,1.7,z,lime);
      const weapon = box(item.category === 'sidearm' ? .75 : 1.65,.16,.18,x,2.05,z-.42,dark);
      weapon.rotation.z = index % 2 ? .08 : -.08;
      weapon.userData.weaponStoreItemId = item.id;
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
  dispose() { this.group.removeFromParent(); this.geometries.forEach(g=>g.dispose()); this.materials.forEach(m=>m.dispose()); }
}
