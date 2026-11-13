import * as T from 'three';
import {LivingVisuals} from '../tiranastreets/livingVisuals';
import {forceWeaponFor} from '../tiranastreets/shared/uploadedWeapons.mjs';
import type {NPC} from '../tiranastreets/shared/engine.mjs';
import {AlbanianForcesVisuals, type ForceFrame} from '../tiranastreets/AlbanianForcesVisuals';
import {FORCE_ASSETS} from '../tiranastreets/shared/albanianForces.mjs';
import type {ActorVisual} from './world';

type Combatant = ActorVisual & {id: number; networkId?: string; hp: number; hurt?:number; anim?: string; forceCharacter?: string};
const uniforms = FORCE_ASSETS.filter(a => a.category === 'person');
const empty = (): ForceFrame => ({cars: [], traffic: [], units: [], npcs: []});

/** Adapt the active FPS combatants, not a second simulation. Hitboxes, gun,
 * muzzle flash, AI, death timers and network transforms stay on the FPS actor. */
export class BattlefieldForces {
  readonly visuals = new AlbanianForcesVisuals();
  private weapons = new LivingVisuals(false);
  private mounts = new Map<string,T.Group>();
  private previous = new Map<string, {x: number; z: number}>();
  constructor(scene: T.Scene) { scene.add(this.visuals.group); }

  update(enemies: readonly Combatant[], viewer: {x: number; z: number}, time: number, dt: number, battery = false) {
    const frame = empty(), present = new Set<string>();
    for (const e of enemies) {
      const id = e.networkId || String(e.id), p = e.group.position;
      present.add(id);
      const before = this.previous.get(id);
      const speed = before && dt > 0 ? Math.hypot(p.x - before.x, p.z - before.z) / dt : 0;
      this.previous.set(id, {x: p.x, z: p.z});
      if (!e.group.visible) continue;
      frame.npcs.push({id, x: p.x, z: p.z, heading: e.group.rotation.y,
        speed, health: e.hp, hitUntil:time+(e.hurt||0), anim:e.anim || (speed>2?'run':speed>.15?'walk':'aim'), kind: 'soldier', motion: speed > .15 ? 'walk' : 'idle',
        forceCharacter: e.forceCharacter || uniforms[e.id % uniforms.length].id});
    }
    for (const id of this.previous.keys()) if (!present.has(id)) {this.previous.delete(id);this.weapons.forget(id);this.mounts.get(id)?.removeFromParent();this.mounts.delete(id);}
    this.visuals.update(frame, viewer, time, dt, battery);
    for (const e of enemies) {
      const root = this.visuals.getRoot(`npc-${e.networkId || String(e.id)}`);
      e.body.visible = !root;
      const id=e.networkId||String(e.id);
      let mount=this.mounts.get(id);
      if(!mount){mount=new T.Group();mount.rotation.y=Math.PI;e.group.add(mount);this.mounts.set(id,mount);}
      const character=e.forceCharacter||uniforms[e.id%uniforms.length].id;
      const slot=e.forceCharacter?e.id:Math.floor(e.id/uniforms.length);
      const equipped=this.weapons.pose(id,root||mount,{weapon:forceWeaponFor(character,slot),health:e.hp,anim:e.anim||'aim',motion:'idle'} as NPC,time);
      if(e.gun)e.gun.visible=!equipped;
      if (!root) continue;
      root.position.copy(e.group.position);
      // Original people face +Z; the FPS proxy faces -Z.
      root.rotation.set(e.group.rotation.x, e.group.rotation.y + Math.PI, e.group.rotation.z);
      root.scale.copy(e.group.scale);
    }
  }
  clear() { this.visuals.update(empty(), {x: 0, z: 0}, 0, 0); this.previous.clear();for(const [id,mount] of this.mounts){this.weapons.forget(id);mount.removeFromParent();}this.mounts.clear(); }
  dispose() { this.clear();this.weapons.dispose();this.visuals.dispose(); }
}
