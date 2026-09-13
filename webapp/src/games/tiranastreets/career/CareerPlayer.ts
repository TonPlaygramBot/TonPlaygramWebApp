import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {selectedPlayerUrl} from '../playerCatalog.mjs';
import {FirstPersonBody} from '../street-career/FirstPersonBody';
import {normalizePlayableHuman,hideAuthoredPlayerWeapon} from '../street-career/humanoidRig.mjs';
import {createBody} from '../street-career/playerCore.mjs';
import {disposeWeaponResources} from '../weaponModelResources';
import type {Actor} from '../cityBaseRenderer';
import type {Player} from '../shared/engine.mjs';

/** City Stories shares the selected skin and body animation, while keeping its
 * existing unarmed exploration and contact missions. */
export class CareerPlayer {
  readonly errors:string[]=[];
  private actor?:Actor;
  private rig:FirstPersonBody;
  private body=createBody();
  private abort?:AbortController;
  private request?:Promise<void>;
  private disposed=false;
  constructor(private scene:T.Scene){this.rig=new FirstPersonBody(scene);}
  get ready(){return !!this.actor&&!this.disposed;}
  load():Promise<void>{
    if(this.request)return this.request;
    if(this.ready||this.disposed)return Promise.resolve();
    this.errors.length=0;
    this.request=this.fetchSelected().finally(()=>{this.request=undefined;});
    return this.request;
  }
  private async fetchSelected(){
    const abort=new AbortController();this.abort=abort;
    const timer=setTimeout(()=>abort.abort(),30000);
    let source:T.Group|undefined;
    try{
      const selected=selectedPlayerUrl();
      if(!selected)throw Error('Choose a player before starting City Stories.');
      const url=new URL(selected,window.location.href),response=await fetch(url,{signal:abort.signal});
      if(!response.ok)throw Error(`Player download failed (HTTP ${response.status}).`);
      const limit=24*1024*1024;
      if(Number(response.headers.get('content-length')||0)>limit)throw Error('Player exceeds the mobile model budget.');
      const bytes=await response.arrayBuffer();
      if(bytes.byteLength>limit)throw Error('Player exceeds the mobile model budget.');
      const gltf=await new GLTFLoader().parseAsync(bytes,new URL('.',url).href);source=gltf.scene;
      if(this.disposed)return;
      const group=normalizePlayableHuman(source);group.name='Tirana:city-stories-player';
      hideAuthoredPlayerWeapon(group);
      const mixer=new T.AnimationMixer(group),clips=Object.fromEntries(gltf.animations.map(clip=>[clip.name,mixer.clipAction(clip)]));
      const idle=gltf.animations.find(clip=>/idle/i.test(clip.name));
      if(idle&&!clips.Idle)clips.Idle=mixer.clipAction(idle);
      this.actor={group,mixer,clips,idle:clips.Idle,walk:clips.Walk,run:clips.Run,wheels:[],model:'local-player'};
      this.scene.add(group);source=undefined;
    }catch(error){if(!this.disposed)this.errors.push(error instanceof Error?error.message:String(error));}
    finally{clearTimeout(timer);if(source)disposeWeaponResources([source]);}
  }
  update(frame:{x:number;z:number;yaw:number;pitch:number;speed:number;time:number;hidden:boolean},dt:number){
    if(!this.actor||this.disposed)return;
    if(frame.hidden){this.actor.group.visible=false;this.rig.weapon.visible=false;return;}
    Object.assign(this.body,{y:0,yaw:frame.yaw,pitch:frame.pitch,eye:1.68,grounded:true,wall:10});
    this.body.gait+=dt*frame.speed*1.8;
    const player={x:frame.x,z:frame.z,health:100,speed:frame.speed,weapon:'',nextShot:0} as Player;
    this.rig.update(this.actor,player,this.body,frame.time,dt);
  }
  dispose(){
    if(this.disposed)return;
    this.disposed=true;this.abort?.abort();this.rig.dispose();
    if(this.actor){
      this.actor.mixer?.stopAllAction();this.actor.mixer?.uncacheRoot(this.actor.group);
      this.actor.group.removeFromParent();disposeWeaponResources([this.actor.group]);this.actor=undefined;
    }
  }
}
