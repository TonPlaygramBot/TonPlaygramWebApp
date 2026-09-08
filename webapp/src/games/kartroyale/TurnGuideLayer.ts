import * as T from 'three';
import {turnGuides} from './turnGuideCore.mjs';
import {WORLD} from '../tiranastreets/shared/world.mjs';
import {insideRing} from '../tirana-environment/surfaceCore.mjs';
import type {Track} from './simulation.mjs';
/** New approach-facing boards are part of Racing Royal's actual scenery. */
export class TurnGuideLayer {
  readonly group=new T.Group();
  constructor(track:Track){
    this.group.name='Racing Royal:direction-verified-turn-guides';
    const poleGeo=new T.CylinderGeometry(.045,.06,1.8,6),poleMat=new T.MeshStandardMaterial({color:'#79868c',metalness:.65,roughness:.5});
    const boards=new Map<string,T.MeshBasicMaterial>();
    for(const direction of ['left','right']){const c=document.createElement('canvas');c.width=512;c.height=256;const x=c.getContext('2d')!;x.fillStyle='#17252b';x.fillRect(0,0,512,256);x.strokeStyle='#effa96';x.lineWidth=12;x.strokeRect(8,8,496,240);x.lineWidth=24;x.lineJoin='miter';for(const mid of [150,290]){x.beginPath();const s=direction==='right'?1:-1;x.moveTo(mid-40*s,64);x.lineTo(mid+30*s,128);x.lineTo(mid-40*s,192);x.stroke();}const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;texture.userData.ephemeral=true;boards.set(direction,new T.MeshBasicMaterial({map:texture}));}
    for(const guide of turnGuides(track)){if(WORLD.buildings.some(b=>insideRing([guide.x,guide.z],b.p)||b.p.some((a,i)=>{const c=b.p[(i+1)%b.p.length],dx=c[0]-a[0],dz=c[1]-a[1],t=Math.max(0,Math.min(1,((guide.x-a[0])*dx+(guide.z-a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(guide.x-a[0]-dx*t,guide.z-a[1]-dz*t)<1;})))continue;const g=new T.Group();g.position.set(guide.x,0,guide.z);g.rotation.y=guide.yaw;const pole=new T.Mesh(poleGeo,poleMat);pole.position.y=.9;g.add(pole);const board=new T.Mesh(new T.PlaneGeometry(1.8,.9),boards.get(guide.direction));board.position.y=guide.y;g.add(board);this.group.add(g);}
  }
}
