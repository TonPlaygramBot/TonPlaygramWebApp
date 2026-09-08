import * as T from 'three';
import type {Member} from './types';
/** Face-mounted identity panels, not a replacement facial skin/UV or face scan. */
export class FacePanels {
  private panels=new Map<string,{sprite:T.Sprite;texture:T.Texture;key:unknown;video?:HTMLVideoElement;label:T.Sprite;labelTexture:T.Texture;dead:boolean}>();
  private point=new T.Vector3();
  update(member:Member,root:T.Object3D,stream?:MediaStream){
    const key=member.media.camera&&stream?stream:member.avatar||member.name;let p=this.panels.get(member.id);
    if(!p||p.key!==key){this.remove(member.id);
      const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d')!;c.fillStyle='#19383e';c.fillRect(0,0,128,128);c.fillStyle='#fff3da';c.textAlign='center';c.font='bold 56px sans-serif';c.fillText(member.name.slice(0,1).toUpperCase(),64,86);
      const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
      const sprite=new T.Sprite(new T.SpriteMaterial({map:texture,depthTest:true,transparent:false}));sprite.scale.set(.25,.28,1);sprite.name=`face-panel:${member.id}`;
      const card=document.createElement('canvas');card.width=512;card.height=72;const ctx=card.getContext('2d')!;ctx.fillStyle='#142d38';ctx.fillRect(0,0,512,72);ctx.fillStyle='#fff4d5';ctx.font='bold 34px sans-serif';ctx.textAlign='center';ctx.fillText(member.name,256,48,486);const labelTexture=new T.CanvasTexture(card);labelTexture.colorSpace=T.SRGBColorSpace;const label=new T.Sprite(new T.SpriteMaterial({map:labelTexture,depthTest:true}));label.name=`explorer-label:${member.id}`;label.position.y=2.04;label.scale.set(1.4,.20,1);root.add(label);
      p={sprite,texture,key,label,labelTexture,dead:false};this.panels.set(member.id,p);root.add(sprite);
      if(key===stream&&stream){const video=document.createElement('video');video.autoplay=true;video.playsInline=true;video.muted=true;video.srcObject=stream;void video.play().catch(()=>{});p.video=video;texture.dispose();p.texture=new T.VideoTexture(video);p.texture.colorSpace=T.SRGBColorSpace;sprite.material.map=p.texture;sprite.material.needsUpdate=true;}
      else if(member.avatar){const entry=p;new T.TextureLoader().load(member.avatar,t=>{if(entry.dead){t.dispose();return;}entry.texture.dispose();entry.texture=t;t.colorSpace=T.SRGBColorSpace;entry.sprite.material.map=t;entry.sprite.material.needsUpdate=true;},undefined,()=>{});}
    }
    if(p.sprite.parent!==root){root.add(p.sprite,p.label);}
    for(const child of root.children)if(child instanceof T.Sprite&&!child.name)child.visible=false;
    // Existing rigs use different bone names. Anchor to their actual head when available.
    let head:T.Object3D|undefined;root.traverse(o=>{if(o instanceof T.Bone&&/head$/i.test(o.name))head ||= o;});
    if(head){root.updateWorldMatrix(true,true);head.getWorldPosition(this.point);root.worldToLocal(this.point);p.sprite.position.copy(this.point);p.sprite.position.z+=.13;}
    else p.sprite.position.set(0,1.6,.14);
  }
  retain(ids:Set<string>){for(const id of this.panels.keys())if(!ids.has(id))this.remove(id);}
  private remove(id:string){const p=this.panels.get(id);if(!p)return;p.dead=true;if(p.video){p.video.pause();p.video.srcObject=null;}p.sprite.removeFromParent();p.label.removeFromParent();p.label.material.dispose();p.labelTexture.dispose();p.sprite.material.dispose();p.texture.dispose();this.panels.delete(id);}
  dispose(){for(const id of [...this.panels.keys()])this.remove(id);}
}
