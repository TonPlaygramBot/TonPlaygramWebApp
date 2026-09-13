import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FirstPersonBody } from '../tiranastreets/street-career/FirstPersonBody';
import { createBody } from '../tiranastreets/street-career/playerCore.mjs';
import { disposeWeaponResources } from '../tiranastreets/weaponModelResources';
import type { Actor } from '../tiranastreets/cityBaseRenderer';
import type { Player } from '../tiranastreets/shared/engine.mjs';
import type { WeaponId } from './core';

export const BODY_WEAPON: Record<WeaponId, string> = {
  ar: 'krsvBurstAttack', smg: 'uziSprayAttack', ak47: 'ak47VolleyAttack',
  shotgun: 'shotgunBlastAttack', mosin: 'mosinMarksmanAttack', uzi: 'uziSprayAttack',
  sigsauer: 'sigsauerTacticalAttack', smith: 'smithSidearmAttack'
};

/** CC0 Quaternius human, Three.js animation mixer and the shared weapon-grip IK.
 * One physical body holds the same model represented by the equipped weapon.
 * The camera has no separate arms or generic FPS gun attached to it.
 */
export class BattlefieldPlayer {
  readonly rig: FirstPersonBody;
  private actor?: Actor;
  private body = createBody();
  private dead = false;
  private abort = new AbortController();
  readonly errors: string[] = [];
  constructor(private scene: T.Scene) { this.rig = new FirstPersonBody(scene); }
  async load() {
    const timer = setTimeout(() => this.abort.abort(), 15000);
    try {
      const response = await fetch('/assets/tirana-streets/living/operator.glb', {signal:this.abort.signal});
      if (!response.ok) throw Error(`Operator HTTP ${response.status}`);
      const gltf = await new GLTFLoader().parseAsync(await response.arrayBuffer(), '/assets/tirana-streets/living/');
      if (this.dead) { disposeWeaponResources([gltf.scene]); return; }
      const box = new T.Box3().setFromObject(gltf.scene), size = box.getSize(new T.Vector3());
      const scale = 1.78 / size.y, center = box.getCenter(new T.Vector3());
      gltf.scene.scale.setScalar(scale);
      gltf.scene.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
      const group = new T.Group(); group.name = 'Tirana:player-body'; group.add(gltf.scene);
      const mixer = new T.AnimationMixer(group);
      const clips = Object.fromEntries(gltf.animations.map(clip => [clip.name, mixer.clipAction(clip)]));
      this.actor = {group, mixer, clips, idle:clips.Idle, walk:clips.Walk, run:clips.Run, wheels:[], model:'operator'};
      this.scene.add(group);
      await this.rig.prepare(BODY_WEAPON.ak47);
    } catch (error) { if (!this.dead) this.errors.push(String(error)); }
    finally { clearTimeout(timer); }
  }
  update(frame: {x:number;z:number;y:number;yaw:number;pitch:number;health:number;weapon:WeaponId;speed:number;aim:boolean;crouch:boolean;recoil:number;reload:number;reloadDuration:number;cooldown:number;driving:boolean;time:number}, dt:number) {
    if (!this.actor) return;
    if (frame.driving) { this.actor.group.visible = false; this.rig.weapon.visible = false; return; }
    Object.assign(this.body, {y:frame.y, yaw:frame.yaw, pitch:frame.pitch, eye:frame.crouch?.86:1.68,
      crouched:frame.crouch, aim:frame.aim, recoil:frame.recoil, wall:10,
      action:frame.reload>0?{kind:'reload', start:frame.time-(frame.reloadDuration-frame.reload), duration:frame.reloadDuration}:null});
    this.body.gait += dt * frame.speed * 1.8;
    const player = {x:frame.x,z:frame.z,health:frame.health,speed:frame.speed,
      weapon:BODY_WEAPON[frame.weapon],nextShot:frame.time+frame.cooldown} as Player;
    this.rig.update(this.actor, player, this.body, frame.time, dt);
  }
  dispose() {
    this.dead = true; this.abort.abort(); this.rig.dispose();
    if (this.actor) {
      this.actor.mixer?.stopAllAction(); this.actor.mixer?.uncacheRoot(this.actor.group);
      this.actor.group.removeFromParent(); disposeWeaponResources([this.actor.group]);
    }
  }
}
