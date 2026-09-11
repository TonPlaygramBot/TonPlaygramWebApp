import * as T from 'three';
import {AlbanianForcesVisuals, type ForceFrame} from '../tiranastreets/AlbanianForcesVisuals';
import {FORCE_ASSETS} from '../tiranastreets/shared/albanianForces.mjs';
import type {ActorVisual} from './world';

type Combatant = ActorVisual & {id: number; networkId?: string; hp: number};
const uniforms = FORCE_ASSETS.filter(a => a.category === 'person');
const empty = (): ForceFrame => ({cars: [], traffic: [], units: [], npcs: []});

/** Adapt the active FPS combatants, not a second simulation. Hitboxes, gun,
 * muzzle flash, AI, death timers and network transforms stay on the FPS actor. */
export class BattlefieldForces {
  readonly visuals = new AlbanianForcesVisuals();
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
        speed, health: e.hp, kind: 'soldier', motion: speed > .15 ? 'walk' : 'idle',
        forceCharacter: uniforms[e.id % uniforms.length].id});
    }
    for (const id of this.previous.keys()) if (!present.has(id)) this.previous.delete(id);
    this.visuals.update(frame, viewer, time, dt, battery);
    for (const e of enemies) {
      const root = this.visuals.getRoot(`npc-${e.networkId || String(e.id)}`);
      e.body.visible = !root;
      if (!root) continue;
      root.position.copy(e.group.position);
      // Original people face +Z; the FPS proxy faces -Z.
      root.rotation.set(e.group.rotation.x, e.group.rotation.y + Math.PI, e.group.rotation.z);
      root.scale.copy(e.group.scale);
    }
  }
  clear() { this.visuals.update(empty(), {x: 0, z: 0}, 0, 0); this.previous.clear(); }
  dispose() { this.visuals.dispose(); this.previous.clear(); }
}
