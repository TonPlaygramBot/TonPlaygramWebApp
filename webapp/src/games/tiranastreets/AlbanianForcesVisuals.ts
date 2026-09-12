import * as T from 'three';
import {resetForcePose,poseForce} from './forcePose';
import {GLTFLoader, type GLTF} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {clone} from 'three/examples/jsm/utils/SkeletonUtils.js';
import {clearWeaponInstance, disposeWeaponResources} from './weaponModelResources';
import {forceVehicleFor, forceCharacterFor, type ForceAsset} from './shared/albanianForces.mjs';
import type {Point, NPC, Car} from './shared/engine.mjs';

export type ForceCar = Pick<Car, 'id' | 'x' | 'z' | 'heading' | 'speed' | 'steering' | 'model' | 'forceVehicle' | 'responding'>;
export type ForceNPC = Pick<NPC, 'id' | 'x' | 'z' | 'heading' | 'speed' | 'kind' | 'motion' | 'health' | 'forceCharacter' | 'anim'>;
export type ForceFrame = {cars: ForceCar[]; traffic: ForceCar[]; units: ForceCar[]; npcs: ForceNPC[]};
type Candidate = {key: string; asset: ForceAsset; entity: ForceCar | ForceNPC; distance: number; flashing: boolean};
type Source = {gltf: GLTF; frame: T.Group; used: number};
type Actor = {
  root: T.Group; asset: ForceAsset; wheels: T.Object3D[]; steering: T.Object3D[];
  lamps: {material: T.MeshStandardMaterial; base: number}[];
  mixer?: T.AnimationMixer; idle?: T.AnimationAction; walk?: T.AnimationAction;
  moving?: boolean;
  height?:number;
  gaitSpeed?:number;
};

/** Near-field visuals only. The existing actors remain the distant/loading
 * fallback. No asset download blocks starting or simulating the game. */
export class AlbanianForcesVisuals {
  readonly group = new T.Group();
  readonly errors = new Map<string, string>();
  private loader = new GLTFLoader();
  private sources = new Map<string, Source>();
  private actors = new Map<string, Actor>();
  private pending = new Map<string, AbortController>();
  private desired = new Map<string, ForceAsset>();
  private dead = false;
  private frame = 0;
  constructor() { this.group.name = 'Tirana:Albanian-Forces'; }

  has(key: string) { return this.actors.has(key); }
  getRoot(key: string) { return this.actors.get(key)?.root; }

  private pump() {
    if (this.dead) return;
    for (const asset of this.desired.values()) {
      if (this.pending.size >= 2) break;
      if (this.sources.has(asset.id) || this.pending.has(asset.id) || this.errors.has(asset.id)) continue;
      const abort = new AbortController();
      this.pending.set(asset.id, abort);
      void this.load(asset, abort);
    }
  }
  private async load(asset: ForceAsset, abort: AbortController) {
    const timer = setTimeout(() => abort.abort(), 20000);
    let gltf: GLTF | undefined;
    try {
      const response = await fetch(asset.url, {signal: abort.signal});
      if (!response.ok) throw Error(`HTTP ${response.status}`);
      const bytes = await response.arrayBuffer();
      if (this.dead) return;
      gltf = await this.loader.parseAsync(bytes, '/assets/tirana-streets/albanian-forces/glb/');
      if (this.dead) { disposeWeaponResources([gltf.scene]); return; }
      const frame = prepareForceModel(gltf.scene, asset);
      this.sources.set(asset.id, {gltf, frame, used: this.frame});
      gltf = undefined;
      this.trim();
    } catch (error) {
      if (gltf) disposeWeaponResources([gltf.scene]);
      if (!this.dead) {
        this.errors.set(asset.id, String(error));
        console.warn('Albanian Forces model unavailable; existing unit retained:', asset.id, error);
      }
    } finally {
      clearTimeout(timer);
      this.pending.delete(asset.id);
      this.pump();
    }
  }

  private create(key: string, asset: ForceAsset, source: Source): Actor {
    const root = clone(source.frame) as T.Group;
    const actor: Actor = {root, asset, wheels: [], steering: [], lamps: []};
    root.name = key;
    root.traverse(o => {
      if (o.name.startsWith('Wheel_')) actor.wheels.push(o);
      if (o.name.startsWith('Steer_')) actor.steering.push(o);
      if (o instanceof T.Mesh) {
        // Only the emergency lenses need private materials for flashing.
        const privateLamp = (m: T.Material) => {
          if (!(m instanceof T.MeshStandardMaterial) || !m.name.startsWith('Blue emergency')) return m;
          const material = m.clone();
          actor.lamps.push({material, base: m.emissiveIntensity});
          return material;
        };
        o.material = Array.isArray(o.material) ? o.material.map(privateLamp) : privateLamp(o.material);
      }
    });
    if (asset.category === 'person') {
      actor.mixer = new T.AnimationMixer(root);
      const idle = source.gltf.animations.find(c => c.name === 'Idle');
      const walk = source.gltf.animations.find(c => c.name === 'Walk');
      if (idle) actor.idle = actor.mixer.clipAction(idle);
      if (walk) actor.walk = actor.mixer.clipAction(walk);
      actor.idle?.play();
    }
    this.group.add(root);
    this.actors.set(key, actor);
    return actor;
  }

  update(state: ForceFrame, viewer: Point, time: number, dt: number, battery = false) {
    if (this.dead) return;
    this.frame++;
    const distance = (e: Point) => Math.hypot(e.x - viewer.x, e.z - viewer.z);
    const vehicles: Candidate[] = [];
    for (const car of [...state.cars, ...state.traffic, ...state.units]) {
      const asset = forceVehicleFor(car), d = distance(car);
      if (asset && d < (battery ? 32 : 65)) vehicles.push({
        key: car.id, asset, entity: car, distance: d,
        flashing: state.units.includes(car) || !!car.responding,
      });
    }
    const people: Candidate[] = [];
    for (const npc of state.npcs) {
      const asset = forceCharacterFor(npc), d = distance(npc);
      if (asset && (npc.motion !== 'drive' || npc.anim === 'ride') && d < (battery ? 24 : 45)) people.push({
        key: `npc-${npc.id}`, asset, entity: npc, distance: d, flashing: false,
      });
    }
    const nearest = (a: Candidate, b: Candidate) => a.distance - b.distance || a.key.localeCompare(b.key);
    const cap = battery ? 2 : 3;
    const selected = [...vehicles.sort(nearest).slice(0, cap), ...people.sort(nearest).slice(0, battery ? 4 : 8)];
    const keep = new Set(selected.map(c => c.key));
    for (const key of this.actors.keys()) if (!keep.has(key)) this.remove(key);
    this.desired = new Map(selected.map(c => [c.asset.id, c.asset]));
    for (const c of selected) {
      const source = this.sources.get(c.asset.id);
      if (!source) continue;
      source.used = this.frame;
      let actor = this.actors.get(c.key);
      if (actor && actor.asset.id !== c.asset.id) { this.remove(c.key); actor = undefined; }
      actor ||= this.create(c.key, c.asset, source);
      const e = c.entity, person = c.asset.category === 'person';
      const first = !actor.root.userData.placed;
      const oldX=actor.root.position.x,oldZ=actor.root.position.z;
      const alpha = first ? 1 : Math.min(1, dt * (person ? 12 : 18));
      actor.root.position.lerp(new T.Vector3(e.x, person ? .06 : .03, e.z), alpha);
      actor.root.rotation.y += Math.atan2(Math.sin(e.heading + Math.PI - actor.root.rotation.y), Math.cos(e.heading + Math.PI - actor.root.rotation.y)) * (first ? 1 : Math.min(1, dt * 14));
      actor.root.userData.placed = true;
      if (person) {
        const npc = e as ForceNPC, riding = npc.motion === 'drive';
        const measured=first||dt<=0?0:Math.hypot(actor.root.position.x-oldX,actor.root.position.z-oldZ)/dt;
        actor.gaitSpeed=(actor.gaitSpeed||0)+(measured-(actor.gaitSpeed||0))*(1-Math.exp(-dt*12));
        const moving=actor.gaitSpeed>.12&&npc.health>0&&!riding;
        resetForcePose(actor.root);
        const height=riding?.38:npc.anim==='cover'?-.32:.06;
        actor.height=(actor.height??height)+(height-(actor.height??height))*(1-Math.exp(-dt*12));
        actor.root.position.y=actor.height;
        actor.root.rotation.x = npc.health <= 0 ? -Math.PI / 2 : 0;
        if (actor.moving !== moving) {
          (moving ? actor.walk : actor.idle)?.reset().fadeIn(.18).play();
          (moving ? actor.idle : actor.walk)?.fadeOut(.18);
          actor.moving = moving;
        }
        if (npc.health > 0) actor.mixer?.update(dt * (moving ? Math.min(2.8, Math.max(.15, actor.gaitSpeed / 1.4)) : 1));
        poseForce(actor.root, npc.anim || (moving ? 'walk' : 'idle'), npc.health > 0,dt);
      } else {
        const car = e as ForceCar;
        for (const wheel of actor.wheels) wheel.rotation.z -= car.speed * dt / actor.asset.wheelRadius;
        for (const steer of actor.steering) steer.rotation.y = -car.steering * .32;
        actor.lamps.forEach((lamp, i) => {
          lamp.material.emissiveIntensity = c.flashing && Math.sin(time * 18 + i * Math.PI) > 0 ? 4 : lamp.base;
        });
      }
    }
    this.trim();
    this.pump();
  }

  retryFailed() { this.errors.clear(); this.pump(); }
  private remove(key: string) {
    const actor = this.actors.get(key);
    if (!actor) return;
    actor.mixer?.stopAllAction();
    actor.mixer?.uncacheRoot(actor.root);
    actor.lamps.forEach(lamp => lamp.material.dispose());
    clearWeaponInstance(actor.root);
    actor.root.removeFromParent();
    this.actors.delete(key);
  }
  private trim() {
    const live = new Set([...this.actors.values()].map(a => a.asset.id));
    for (const [id, source] of [...this.sources].sort((a, b) => a[1].used - b[1].used)) {
      if (this.sources.size <= 8) break;
      if (live.has(id) || this.desired.has(id)) continue;
      disposeWeaponResources([source.frame]);
      this.sources.delete(id);
    }
  }
  dispose() {
    if (this.dead) return;
    this.dead = true;
    for (const abort of this.pending.values()) abort.abort();
    for (const key of this.actors.keys()) this.remove(key);
    for (const source of this.sources.values()) disposeWeaponResources([source.frame]);
    this.sources.clear(); this.desired.clear(); this.errors.clear();
    this.group.removeFromParent();
  }
}

/** Preserve metres, PBR maps, rig tracks, and wheel pivots from the pack. */
export function prepareForceModel(scene: T.Group, asset: ForceAsset): T.Group {
  const facing = new T.Group();
  facing.add(scene);
  // Pack vehicles face +X. Existing game actor models face +Z before heading.
  if (asset.category === 'vehicle') facing.rotation.y = -Math.PI / 2;
  facing.updateMatrixWorld(true);
  const bounds = new T.Box3().setFromObject(facing), size = bounds.getSize(new T.Vector3());
  if (!Number.isFinite(size.y) || size.y < .01) throw Error('Invalid force model bounds');
  const center = bounds.getCenter(new T.Vector3());
  const offset = new T.Group();
  offset.position.set(-center.x, -bounds.min.y, -center.z);
  offset.add(facing);
  const frame = new T.Group(); frame.add(offset);
  frame.traverse(o => { if (o instanceof T.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
  return frame;
}
