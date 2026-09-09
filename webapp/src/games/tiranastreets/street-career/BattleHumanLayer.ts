import * as T from 'three';
import {SharedHumans} from './SharedHumans';
import type {NPC} from '../shared/engine.mjs';
/** Visual adapter only. Original enemy roots still own gameplay, hitboxes,
 * death transforms and muzzle flashes. No second simulation or RAF is created. */
export class BattleHumanLayer {
  private humans=new SharedHumans(undefined,{bikes:false,labels:false,armed:true});
  private hidden=new Map<T.Object3D,boolean>();
  private previous=new Map<string,{x:number;z:number}>();
  private last=0;private dead=false;
  constructor(private scene:T.Scene){scene.add(this.humans.group);}
  update(viewer:{x:number;z:number},seconds:number,battery=false){
    if(this.dead)return;
    const dt=this.last?Math.max(0,Math.min(.05,seconds-this.last)):0;this.last=seconds;
    const roots=this.scene.children.filter(o=>typeof o.userData.tiranaHumanId==='string');
    const live=new Set(roots.map(o=>o.userData.tiranaHumanId as string));
    const npcs=roots.map(root=>{
      const id=root.userData.tiranaHumanId as string,p=this.previous.get(id);
      const speed=p&&dt>0?Math.min(7,Math.hypot(root.position.x-p.x,root.position.z-p.z)/dt):0;
      this.previous.set(id,{x:root.position.x,z:root.position.z});
      return {id,x:root.position.x,z:root.position.z,heading:root.rotation.y,speed,
        kind:'gang',motion:'walk',health:100,weapon:null,downUntil:0,anim:speed>3?'run':'walk'} as NPC;
    });
    this.humans.update(npcs,viewer,seconds,dt,battery);
    for(const root of roots){
      const human=this.humans.actor(root.userData.tiranaHumanId);
      for(const child of root.children){
        if(child.userData.tiranaKeepEquipment)continue;
        if(human){if(!this.hidden.has(child))this.hidden.set(child,child.visible);child.visible=false;}
        else if(this.hidden.has(child)){child.visible=this.hidden.get(child)!;this.hidden.delete(child);}
      }
      if(human){human.position.copy(root.position);human.position.y+=.06;human.rotation.copy(root.rotation);human.rotateY(Math.PI);human.scale.copy(root.scale);human.visible=root.visible;}
    }
    for(const id of this.previous.keys())if(!live.has(id))this.previous.delete(id);
    for(const child of this.hidden.keys())if(!child.parent||!roots.includes(child.parent))this.hidden.delete(child);
  }
  dispose(){if(this.dead)return;this.dead=true;for(const [child,visible] of this.hidden)child.visible=visible;this.hidden.clear();this.previous.clear();this.humans.dispose();}
}
