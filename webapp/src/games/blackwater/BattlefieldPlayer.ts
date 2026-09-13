import * as T from 'three';
import {selectedPlayerUrl} from '../tiranastreets/playerCatalog.mjs';
import {normalizePlayableHuman, hideAuthoredPlayerWeapon} from '../tiranastreets/street-career/humanoidRig.mjs';
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

/** Selected uploaded human, Three.js animation mixer and shared weapon-grip IK.
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
  async load(initialWeapon:WeaponId='ak47') {
    const timer = setTimeout(() => this.abort.abort(), 30000);
    let source:T.Group|undefined;
    try {
      const url=selectedPlayerUrl();
      if(!url)throw Error('Choose a player before starting the operation.');
      const response = await fetch(url, {signal:this.abort.signal});
      if (!response.ok) throw Error(`Player download failed (HTTP ${response.status}).`);
      const limit=24*1024*1024;
      if(Number(response.headers.get('content-length')||0)>limit)throw Error('Player exceeds the mobile model budget.');
      const bytes=await response.arrayBuffer();
      if(bytes.byteLength>limit)throw Error('Player exceeds the mobile model budget.');
      const gltf = await new GLTFLoader().parseAsync(bytes, url.slice(0,url.lastIndexOf('/')+1));
      source=gltf.scene;
      if (this.dead) return;
      // Keep the authored skeleton, rest transforms and PBR materials intact.
      const group = normalizePlayableHuman(gltf.scene); group.name = 'Tirana:player-body';
      hideAuthoredPlayerWeapon(group);
      const mixer = new T.AnimationMixer(group);
      const clips = Object.fromEntries(gltf.animations.map(clip => [clip.name, mixer.clipAction(clip)]));
      const idle=gltf.animations.find(clip=>/idle/i.test(clip.name));
      if(idle&&!clips.Idle)clips.Idle=mixer.clipAction(idle);
      this.actor = {group, mixer, clips, idle:clips.Idle, walk:clips.Walk, run:clips.Run, wheels:[], model:'local-player'};
      this.scene.add(group);source=undefined;
      await this.rig.prepare(BODY_WEAPON[initialWeapon]);
    } catch (error) {
      // GameEngine checks this list before setting playerReady; a missing selected
      // skin must leave the startup error visible instead of spawning invisibly.
      if (!this.dead) this.errors.push(`Selected player: ${String(error)}`);
    }
    finally { clearTimeout(timer);if(source)disposeWeaponResources([source]); }
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
