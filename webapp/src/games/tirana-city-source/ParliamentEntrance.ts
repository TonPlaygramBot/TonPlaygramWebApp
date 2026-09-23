import {parliamentPalms} from './ParliamentPalms';
import * as T from 'three';
import DATA from '../tirana-landmark-rebuild/parliament-entry.mjs';
import {blenderGroup} from '../tirana-landmark-rebuild/geometry';
import type {FacadeEdge} from './sourceCore.mjs';
import {disposeWeaponResources} from '../tiranastreets/weaponModelResources';
export class ParliamentEntrance {
  readonly group=blenderGroup(DATA);private dead=false;
  constructor(front:FacadeEdge){
    this.group.name='Kuvendi: public plenary entrance';
    this.group.add(parliamentPalms());
    this.group.position.set((front.a[0]+front.b[0])/2+front.nx*.1,0,(front.a[1]+front.b[1])/2+front.nz*.1);
    this.group.rotation.y=Math.atan2(front.nx,front.nz);this.group.scale.x=Math.min(1,front.length/23);
    const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=96;
    const ctx=canvas.getContext('2d');if(ctx){
      ctx.clearRect(0,0,2048,96);ctx.fillStyle='#b99b53';ctx.font='500 64px Georgia, serif';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText('KUVENDI I REPUBLIKËS SË SHQIPËRISË',1024,48,1980);
      const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
      this.plaque(texture,22,.8,12.27,.39);
    }
    new T.TextureLoader().load('/assets/tirana-streets/references/kuvendi-emblem.svg',texture=>{
      if(this.dead){texture.dispose();return;}texture.colorSpace=T.SRGBColorSpace;
      this.plaque(texture,2.8,2.8*(461.88531/666.66669),8.7,.35);
    });
  }
  private plaque(map:T.Texture,w:number,h:number,y:number,z:number){
    const material=new T.MeshBasicMaterial({map,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
    const mesh=new T.Mesh(new T.PlaneGeometry(w,h),material);mesh.position.set(0,y,z);this.group.add(mesh);
  }
  dispose(){this.dead=true;this.group.removeFromParent();disposeWeaponResources([this.group]);this.group.clear();}
}
