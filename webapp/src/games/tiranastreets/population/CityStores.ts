import * as T from 'three';
import type {State,Point} from '../shared/engine.mjs';
import {WeaponStoreInterior} from '../WeaponStoreInterior';
/** One source interior, fifteen shared-mesh instances, no per-store lights. */
export class CityStores {
 readonly group=new T.Group();private template=new WeaponStoreInterior();private shops=new Map<string,T.Group>();
 private signTexture:T.CanvasTexture;private signMaterial:T.MeshBasicMaterial;private signGeometry=new T.PlaneGeometry(7.4,1.35);
 constructor(){this.template.group.traverse(o=>{if(o instanceof T.Light)o.visible=false;});
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=128;const ctx=canvas.getContext('2d')!;
  ctx.fillStyle='#172b31';ctx.fillRect(0,0,768,128);ctx.fillStyle='#d0ed7b';ctx.font='bold 66px sans-serif';ctx.textAlign='center';ctx.fillText('WEAPONS',384,78);
  this.signTexture=new T.CanvasTexture(canvas);this.signTexture.colorSpace=T.SRGBColorSpace;this.signMaterial=new T.MeshBasicMaterial({map:this.signTexture,side:T.DoubleSide});
  const sign=new T.Mesh(this.signGeometry,this.signMaterial);sign.position.set(0,3.65,-10.15);this.template.group.add(sign);
 }
 update(state:State,p:Point){
  for(const s of state.shops||[state.shop]){
   const id=s.id||s.name;let room=this.shops.get(id);if(!room){room=this.template.group.clone(true);room.name=s.name;this.shops.set(id,room);this.group.add(room);}
   room.position.set(s.x,0,s.z);room.visible=Math.hypot(p.x-s.x,p.z-s.z)<200;
  }
 }
 dispose(){this.group.removeFromParent();this.group.clear();this.shops.clear();this.template.dispose();this.signTexture.dispose();this.signMaterial.dispose();this.signGeometry.dispose();}
}
