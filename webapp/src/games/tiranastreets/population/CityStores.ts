import * as T from 'three';
import type {State,Point} from '../shared/engine.mjs';
import {WeaponStoreInterior} from '../WeaponStoreInterior';
import {shopLayout} from '../shared/shopLayout.mjs';
/** One source interior, fifteen shared-mesh instances, no per-store lights. */
export class CityStores {
 readonly group=new T.Group();private template=new WeaponStoreInterior();private shops=new Map<string,T.Group>();
 private accessGeometry=new T.BoxGeometry(1,1,1);private floor:T.Mesh;
 private signTexture:T.CanvasTexture;private signMaterial:T.MeshBasicMaterial;private signGeometry=new T.PlaneGeometry(7.4,1.35);
 constructor(){this.template.group.traverse(o=>{if(o instanceof T.Light)o.visible=false;});
  this.floor=this.template.group.children.find(o=>o instanceof T.Mesh&&o.geometry instanceof T.BoxGeometry&&o.geometry.parameters.width===13&&o.geometry.parameters.height===.18) as T.Mesh;
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=128;const ctx=canvas.getContext('2d')!;
  ctx.fillStyle='#172b31';ctx.fillRect(0,0,768,128);ctx.fillStyle='#d0ed7b';ctx.font='bold 66px sans-serif';ctx.textAlign='center';ctx.fillText('WEAPONS',384,78);
  this.signTexture=new T.CanvasTexture(canvas);this.signTexture.colorSpace=T.SRGBColorSpace;this.signMaterial=new T.MeshBasicMaterial({map:this.signTexture,side:T.DoubleSide});
  const sign=new T.Mesh(this.signGeometry,this.signMaterial);sign.position.set(0,3.65,-10.15);this.template.group.add(sign);
 }
 update(state:State,p:Point){
  for(const s of state.shops||[state.shop]){
   const id=s.id||s.name;let room=this.shops.get(id);if(!room){
    room=this.template.group.clone(true);room.name=s.name;
    const layout=shopLayout(s);room.userData.baseY=layout.baseY;
    if(layout.stairCount)room.traverse(o=>{if(o instanceof T.Mesh&&o.geometry===this.floor.geometry)o.visible=false;});
    if(layout.extras.length){
     const access=new T.InstancedMesh(this.accessGeometry,this.floor.material,layout.extras.length),matrix=new T.Matrix4();
     access.name='Terrain-aligned shop access';access.castShadow=access.receiveShadow=true;
     layout.extras.forEach((b,i)=>{matrix.makeScale(b.w,b.h-b.minY,b.d);matrix.setPosition(b.x,(b.h+b.minY)/2,b.z);access.setMatrixAt(i,matrix);});
     access.instanceMatrix.needsUpdate=true;access.computeBoundingSphere();room.add(access);
    }
    this.shops.set(id,room);this.group.add(room);
   }
   const distance=Math.hypot(p.x-s.x,p.z-s.z);
   room.position.set(s.x,room.userData.baseY,s.z);room.visible=distance<200;
   if(distance<55)this.template.updateDisplays(room);
  }
 }
 dispose(){this.group.traverse(o=>{if(o instanceof T.InstancedMesh)o.dispose();});this.group.removeFromParent();this.group.clear();this.shops.clear();this.template.dispose();this.accessGeometry.dispose();this.signTexture.dispose();this.signMaterial.dispose();this.signGeometry.dispose();}
}
