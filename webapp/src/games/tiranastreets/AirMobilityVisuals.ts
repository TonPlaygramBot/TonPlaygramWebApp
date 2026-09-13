import {RooftopVisuals} from './RooftopVisuals';
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { State } from "./shared/engine.mjs";
import { MissileVisuals } from "./MissileVisuals";
import { groundHeight } from "../tirana-east/terrainCore.mjs";

/** Recenter spinning geometry without moving the authored model. */
export function rotorPivot(object: THREE.Mesh) {
  const parent = object.parent!; object.geometry.computeBoundingBox();
  const bounds = object.geometry.boundingBox!, size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  object.updateWorldMatrix(true, false); object.localToWorld(center); parent.worldToLocal(center);
  const pivot = new THREE.Group(); pivot.name='rotor-pivot';pivot.position.copy(center); pivot.quaternion.copy(object.quaternion);
  parent.add(pivot); parent.updateWorldMatrix(true, true); pivot.attach(object);
  const axis = size.x <= size.y && size.x <= size.z ? new THREE.Vector3(1,0,0) : size.y <= size.z ? new THREE.Vector3(0,1,0) : new THREE.Vector3(0,0,1);
  pivot.userData.spinAxis=axis.toArray();
  return { pivot, axis };
}

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
  authoritativeMissiles = false;
  private rotorParts: ReturnType<typeof rotorPivot>[] = [];
  private rotorSpeed = 0;
  private blur = new THREE.Mesh(new THREE.RingGeometry(.4, 4, 32), new THREE.MeshBasicMaterial({color:0x8d9388,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));
  private wash = new THREE.Mesh(new THREE.RingGeometry(2, 4, 32), new THREE.MeshBasicMaterial({color:0xaa9879,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));
  private exhaust = new THREE.Mesh(new THREE.ConeGeometry(.45, 2.5, 12), new THREE.MeshBasicMaterial({color:0xffac65,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));
  private missileVisuals: MissileVisuals;
  private missiles: { x:number;y:number;z:number; born:number; from:THREE.Vector3; to:THREE.Vector3; direction:THREE.Vector3 }[] = [];
  private elapsed = 0;
  private rooftops:RooftopVisuals;
  private extraHelicopters=new Map<string,{root:THREE.Group;rotors:THREE.Object3D[]}>();
  private pads=new Map<string,THREE.Group>();
  private seen = new Set<number>();

  constructor(private scene: THREE.Scene) {
    scene.add(this.group);this.rooftops=new RooftopVisuals(scene);
    this.missileVisuals = new MissileVisuals(this.group);
    this.blur.rotation.x = -Math.PI/2; this.blur.position.y = 1.35;
    this.wash.rotation.x = -Math.PI/2; this.group.add(this.wash);
    this.exhaust.rotation.x = Math.PI/2; this.exhaust.position.z = 6;
    this.jet.add(this.exhaust);
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
    const materials=new Set<THREE.Material>();const textures=new Set<THREE.Texture>();const geometries=new Set<THREE.BufferGeometry>();
    root.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
    geometries.forEach(g=>g.dispose());
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
    this.helicopter.add(body, boom, rotor, this.blur);
    this.rotorParts = [rotorPivot(rotor)];
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
        this.blur.removeFromParent();this.release(this.helicopter);this.helicopter.clear();
        this.extraHelicopters.forEach(h=>h.root.removeFromParent());this.extraHelicopters.clear();
        this.helicopter.add(model);
        const parts:THREE.Mesh[]=[];
        model.traverse(o=>{if(o instanceof THREE.Mesh && /rotor|propell?ar|propeller/i.test(o.name))parts.push(o);});
        parts.sort((a,b)=>Number(/back|tail/i.test(a.name))-Number(/back|tail/i.test(b.name)));
        this.rotorParts = parts.map(rotorPivot);
        this.rotor = model.getObjectByName("AW101_propellar") || model.getObjectByName("rotor") || model.getObjectByName("Rotor") || null;
        this.helicopter.add(this.blur);
        if(this.rotorParts[0]){this.rotorParts[0].pivot.getWorldPosition(this.blur.position);this.helicopter.worldToLocal(this.blur.position);}
        return;
      } catch { /* try the same Snake & Ladder source through its fallback CDN */ }
    }
  }

  private buildStairs(state: State) {
    for(const a of state.helicopters||[state.helicopter]){
      if(!a||this.group.getObjectByName(`emergency-stairs:${a.id}`))continue;
      const stairs=new THREE.Group();stairs.name=`emergency-stairs:${a.id}`;
      const mat=new THREE.MeshStandardMaterial({color:0x383e40,metalness:.8,roughness:.35});
      const ground=groundHeight(a.stairX,a.stairZ),height=Math.max(3,a.roofY-ground),levels=Math.ceil(height/3),rise=height/levels;
      const landing=new THREE.BoxGeometry(4.2,.16,1.25),flightGeometry=new THREE.BoxGeometry(4.2,.12,1);
      for(let i=0;i<levels;i++){
        const step=new THREE.Mesh(landing,mat);step.position.set(i%2?1.6:-1.6,(i+1)*rise,0);stairs.add(step);
        const flight=new THREE.Mesh(flightGeometry,mat);flight.position.set(0,(i+.5)*rise,0);flight.rotation.z=(i%2?-1:1)*Math.atan2(rise,4.2);stairs.add(flight);
      }
      stairs.position.set(a.stairX,ground,a.stairZ);this.group.add(stairs);
    }
  }

  update(state: State, dt: number) {
    const h = state.helicopter, j = state.jet;
    this.rooftops.update(state.elapsed);
    const fleet=state.helicopters||[h].filter(Boolean);
    const active=new Set(fleet.map(a=>a!.id));
    for(const [id,entry]of this.extraHelicopters)if(!active.has(id)){entry.root.removeFromParent();this.extraHelicopters.delete(id);}
    for(const a of fleet){if(!a)continue;
      if(!this.pads.has(a.id)){
        const pad=new THREE.Group(),ring=new THREE.Mesh(new THREE.RingGeometry(4.7,5,48),new THREE.MeshBasicMaterial({color:0xd6e4b1,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;pad.add(ring);
        const mat=new THREE.MeshBasicMaterial({color:0xd6e4b1});for(const x of [-.9,.9]){const bar=new THREE.Mesh(new THREE.BoxGeometry(.3,.04,2.8),mat);bar.position.x=x;pad.add(bar);}pad.add(new THREE.Mesh(new THREE.BoxGeometry(1.8,.04,.3),mat));
        pad.position.set(a.homeX??a.x,a.roofY+.025,a.homeZ??a.z);pad.name=`Helipad:${a.name||a.id}`;this.group.add(pad);this.pads.set(a.id,pad);
      }
      if(a.id===h?.id)continue;
      let entry=this.extraHelicopters.get(a.id);
      if(!entry){const root=this.helicopter.clone(true),rotors:THREE.Object3D[]=[];root.traverse(o=>{if(o.name==='rotor-pivot')rotors.push(o);});entry={root,rotors};this.extraHelicopters.set(a.id,entry);this.group.add(root);}
      entry.root.visible=(a.health??1)>0;entry.root.position.set(a.x,a.y,a.z);entry.root.rotation.set(a.pitch||0,a.heading,a.roll||0,'YXZ');
      if(a.pilot)for(const rotor of entry.rotors)rotor.rotateOnAxis(new THREE.Vector3().fromArray(rotor.userData.spinAxis||[0,1,0]),dt*34);
    }
    if(state.elapsed < this.elapsed){this.seen.clear();this.missiles=[];}
    this.elapsed=state.elapsed;
    this.helicopter.visible=!!h&&(h.health??1)>0;
    this.jet.visible=!!j&&(j.health??1)>0;
    if(h){
      this.buildStairs(state);
      this.helicopter.position.set(h.x,h.y,h.z);
      this.helicopter.rotation.set(h.pitch||0,h.heading,h.roll||0,'YXZ');
    }
    const target=h?.pilot&&(h.health??1)>0?34:0;
    this.rotorSpeed=THREE.MathUtils.lerp(this.rotorSpeed,target,1-Math.exp(-Math.max(0,dt)*1.5));
    if(this.rotorSpeed<.01)this.rotorSpeed=0;
    for(const part of this.rotorParts)part.pivot.rotateOnAxis(part.axis,dt*this.rotorSpeed);
    (this.blur.material as THREE.MeshBasicMaterial).opacity=this.rotorSpeed/34*.15;
    this.blur.visible=this.helicopter.visible;
    const floor=h?groundHeight(h.x,h.z):0, altitude=h?Math.max(0,h.y-floor):100;
    this.wash.visible=!!h&&this.helicopter.visible&&altitude<24&&this.rotorSpeed>4;
    if(h){this.wash.position.set(h.x,floor+.1,h.z);this.wash.scale.setScalar(1+altitude*.13);this.wash.rotation.z+=dt*.35;}
    (this.wash.material as THREE.MeshBasicMaterial).opacity=Math.max(0,1-altitude/24)*this.rotorSpeed/34*.16;
    if(j){
      this.jet.position.set(j.x,j.y,j.z);this.jet.rotation.set(j.pitch||0,j.heading,j.roll||0,'YXZ');
      const power=j.pilot?THREE.MathUtils.clamp(Math.abs(j.speed||0)/80,.25,1):0;
      this.exhaust.scale.set(1,power*(1+Math.sin(state.elapsed*37)*.08),1);
      (this.exhaust.material as THREE.MeshBasicMaterial).opacity=power*.55;
    }
    if(!this.authoritativeMissiles)for(const effect of state.effects){
      if(effect.kind!=='missile'||this.seen.has(effect.id))continue;
      this.seen.add(effect.id);if(this.seen.size>128)this.seen.delete(this.seen.values().next().value!);
      const from=new THREE.Vector3(effect.x,effect.y??h?.y??1,effect.z),to=new THREE.Vector3(effect.toX,effect.toY??groundHeight(effect.toX,effect.toZ)+.4,effect.toZ);
      if(this.missiles.length>=8)this.missiles.shift();
      this.missiles.push({x:from.x,y:from.y,z:from.z,born:state.elapsed,from,to,direction:to.clone().sub(from).normalize()});
    }
    this.missiles=this.authoritativeMissiles?[]:this.missiles.filter(m=>{
      const t=THREE.MathUtils.clamp((state.elapsed-m.born)/.72,0,1);
      m.x=THREE.MathUtils.lerp(m.from.x,m.to.x,t);m.y=THREE.MathUtils.lerp(m.from.y,m.to.y,t);m.z=THREE.MathUtils.lerp(m.from.z,m.to.z,t);return t<1;
    });
    this.missileVisuals.update(this.missiles);
  }

  dispose() {
    this.disposed=true;this.rooftops.dispose();
    this.missileVisuals.dispose();
    this.release(this.group);
    this.group.removeFromParent();
  }
}
