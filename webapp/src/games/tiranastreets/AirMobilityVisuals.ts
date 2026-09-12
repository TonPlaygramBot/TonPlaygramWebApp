import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { State } from "./shared/engine.mjs";

const HELICOPTER_URLS = [
  "/assets/tirana-streets/imported/helicopter.glb",
  "https://cdn.jsdelivr.net/gh/srcejon/sdrangel-3d-models@main/helicopter.glb",
  "https://raw.githubusercontent.com/srcejon/sdrangel-3d-models/main/helicopter.glb",
];

export class AirMobilityVisuals {
  readonly group = new THREE.Group();
  private helicopter = new THREE.Group();
  private jet = new THREE.Group();
  private disposed = false;
  private rotor: THREE.Object3D | null = null;
  private missiles: { mesh: THREE.Group; born: number; from: THREE.Vector3; to: THREE.Vector3 }[] = [];
  private seen = new Set<number>();

  constructor(private scene: THREE.Scene) {
    scene.add(this.group);
    this.buildFallbackHelicopter();
    this.jet.name = 'Tirana:pilotable-F15';
    this.group.add(this.jet);
    void this.loadJet();
    void this.loadSharedHelicopter();
  }
  private async loadJet() {
    const loader=new GLTFLoader();
    try {
      const gltf=await loader.loadAsync('/assets/tirana-streets/imported/f15.glb');
      if(this.disposed){this.release(gltf.scene);return;}
      const bounds=new THREE.Box3().setFromObject(gltf.scene),size=bounds.getSize(new THREE.Vector3());
      gltf.scene.scale.setScalar(15/Math.max(size.x,size.y,size.z));
      gltf.scene.updateMatrixWorld(true);
      const center=new THREE.Box3().setFromObject(gltf.scene).getCenter(new THREE.Vector3());
      gltf.scene.position.sub(center);this.jet.add(gltf.scene);
    } catch { /* Visible fallback until the original local asset is available. */
      if(this.disposed)return;
      const material=new THREE.MeshStandardMaterial({color:0x77838a,metalness:.65,roughness:.4});
      const body=new THREE.Mesh(new THREE.ConeGeometry(1,12,12),material);body.rotation.x=-Math.PI/2;
      const wings=new THREE.Mesh(new THREE.BoxGeometry(9,.15,3),material);
      const tail=new THREE.Mesh(new THREE.BoxGeometry(.15,2.4,2),material);tail.position.set(0,1,4);
      this.jet.add(body,wings,tail);
    }
  }
  private release(root:THREE.Object3D) {
    const materials=new Set<THREE.Material>();const textures=new Set<THREE.Texture>();
    root.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
    materials.forEach(m=>{for(const v of Object.values(m))if(v instanceof THREE.Texture)textures.add(v);m.dispose();});textures.forEach(t=>t.dispose());
  }

  private buildFallbackHelicopter() {
    const body = new THREE.Mesh(new THREE.SphereGeometry(1.45, 20, 12), new THREE.MeshStandardMaterial({ color: 0x59634f, metalness: .55, roughness: .42 }));
    body.scale.set(1, .72, 1.8);
    body.castShadow = true;
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(.18, .48, 4.8, 10), new THREE.MeshStandardMaterial({ color: 0x434b3d, metalness: .45 }));
    boom.rotation.x = Math.PI / 2;
    boom.position.z = 3;
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(8, .06, .18), new THREE.MeshStandardMaterial({ color: 0x202522, metalness: .8 }));
    rotor.position.y = 1.35;
    this.rotor = rotor;
    this.helicopter.add(body, boom, rotor);
    this.group.add(this.helicopter);
  }

  private async loadSharedHelicopter() {
    const loader = new GLTFLoader();
    for (const url of HELICOPTER_URLS) {
      try {
        const gltf = await loader.loadAsync(url);
        const model = gltf.scene;
        if(this.disposed){this.release(model);return;}
        const bounds = new THREE.Box3().setFromObject(model);
        const size = bounds.getSize(new THREE.Vector3());
        model.scale.setScalar(8 / Math.max(size.x, size.y, size.z, .01));
        model.updateMatrixWorld(true);
        const fitted = new THREE.Box3().setFromObject(model);
        const c = fitted.getCenter(new THREE.Vector3());
        model.position.sub(c);
        this.release(this.helicopter);this.helicopter.clear();
        this.helicopter.add(model);
        this.rotor = model.getObjectByName("rotor") || model.getObjectByName("Rotor") || null;
        return;
      } catch { /* try the same Snake & Ladder source through its fallback CDN */ }
    }
  }

  private buildStairs(state: State) {
    if (!state.helicopter || this.group.getObjectByName("emergency-stairs")) return;
    const stairs = new THREE.Group();
    stairs.name = "emergency-stairs";
    const mat = new THREE.MeshStandardMaterial({ color: 0x383e40, metalness: .8, roughness: .35 });
    const levels = Math.max(3, Math.ceil(state.helicopter.roofY / 3));
    for (let i = 0; i < levels; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(4.2, .16, 1.25), mat);
      step.position.set(i % 2 ? 1.6 : -1.6, i * 3 + 1.2, 0);
      stairs.add(step);
      const flight = new THREE.Mesh(new THREE.BoxGeometry(4.2, .12, 1), mat);
      flight.position.set(0, i * 3 + 2.05, 0);
      flight.rotation.z = (i % 2 ? -1 : 1) * .55;
      stairs.add(flight);
    }
    stairs.position.set(state.helicopter.stairX, 0, state.helicopter.stairZ);
    this.group.add(stairs);
  }

  update(state: State, dt: number) {
    const h = state.helicopter;
    if (!h) return;
    this.buildStairs(state);
    this.helicopter.position.set(h.x, h.y, h.z);
    this.helicopter.rotation.y = h.heading;
    this.helicopter.rotation.x = h.pitch || 0;
    this.helicopter.rotation.z = h.roll || 0;
    this.helicopter.visible = (h.health ?? 1)>0;
    const j=state.jet;this.jet.visible=!!j&&(j.health??1)>0;
    if(j){this.jet.position.set(j.x,j.y,j.z);this.jet.rotation.set(j.pitch||0,j.heading,j.roll||0,'YXZ');}
    if (this.rotor) this.rotor.rotation.y += dt * (h.pilot ? 28 : 2);
    for (const effect of state.effects) {
      if (effect.kind !== "missile" || this.seen.has(effect.id)) continue;
      this.seen.add(effect.id);
      if(this.seen.size>128)this.seen.delete(this.seen.values().next().value!);
      const root = new THREE.Group();
      const shell = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, 1.2, 10), new THREE.MeshStandardMaterial({ color: 0xd9ddd7, metalness: .7 }));
      shell.rotation.x = Math.PI / 2;
      root.add(shell);
      this.group.add(root);
      this.missiles.push({ mesh: root, born: state.elapsed, from: new THREE.Vector3(effect.x, effect.y || h.y, effect.z), to: new THREE.Vector3(effect.toX, .4, effect.toZ) });
    }
    this.missiles = this.missiles.filter((m) => {
      const t = Math.min(1, (state.elapsed - m.born) / .72);
      m.mesh.position.lerpVectors(m.from, m.to, t);
      m.mesh.position.y += Math.sin(t * Math.PI) * 7;
      if (t < 1) return true;
      m.mesh.removeFromParent();
      this.release(m.mesh);
      return false;
    });
  }

  dispose() {
    this.disposed=true;
    this.release(this.group);
    this.group.removeFromParent();
  }
}
