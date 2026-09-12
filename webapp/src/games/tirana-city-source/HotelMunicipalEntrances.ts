import * as T from 'three';
import {ROGNER_MAIN_ENTRANCE} from './entranceCore.mjs';
import type {FacadeEdge} from './sourceCore.mjs';
import type {ReferenceProfile} from './profiles.mjs';
type Add=(color:number,geometry:T.BufferGeometry)=>void;
type Wall=(edge:FacadeEdge,color:number,u:number,y:number,w:number,h:number,d:number,offset?:number)=>void;

/** Footprint-aligned exterior accents. The municipal corner is photo-estimated;
 * Rogner's main-door anchor is OSM node 6498475597. No internal layout is inferred. */
export function hotelMunicipalEntrances(profile:ReferenceProfile,edges:FacadeEdge[],add:Add,wall:Wall){
  if(!['city-hall','rogner'].includes(profile.style))return;
  const hotel=profile.style==='rogner';
  const anchor=hotel?[(ROGNER_MAIN_ENTRANCE.lon-19.8188)*111320*Math.cos(41.3275*Math.PI/180),(41.3275-ROGNER_MAIN_ENTRANCE.lat)*111320]:[39.1,-12.8];
  const candidates=edges.map(e=>{
    const u=Math.max(0,Math.min(e.length,(anchor[0]-e.a[0])*e.ux+(anchor[1]-e.a[1])*e.uz));
    return {e,u,d:Math.hypot(anchor[0]-e.a[0]-e.ux*u,anchor[1]-e.a[1]-e.uz*u)};
  }).sort((a,b)=>a.d-b.d);
  const found=candidates[0];if(!found)return;
  const {e,u}=found,glass=0x243d41,trim=profile.trim;
  if(hotel){
    wall(e,trim,u,2,4.5,3.9,.16,.14);wall(e,glass,u,1.9,3.9,3.6,.12,.27);
    for(const d of [-1.25,0,1.25])wall(e,0xa9aba3,u+d,1.9,.06,3.6,.08,.38);
    wall(e,trim,u,4.05,6,.24,3.8,1.8);
    for(const d of [-2.6,2.6])wall(e,0x8b9089,u+d,1.95,.14,3.9,.14,3.35);
    wall(e,0x637674,u,4.2,5.75,.10,3.65,1.8);
    wall(e,0xb8b1a0,u,.1,6,.2,4.3,1.75);
  }else{
    wall(e,0xa45e43,u,3.6,5.6,7,.08,.11);
    wall(e,trim,u,2.2,3.4,4.4,.16,.25);wall(e,0x263f34,u,2,2.7,3.8,.10,.38);
    for(const d of [-1.75,1.75]){wall(e,trim,u+d,2.3,.38,4.6,.45,.44);wall(e,trim,u+d,4.7,.65,.23,.62,.52);}
    wall(e,trim,u,4.9,4.5,.22,.55,.44);
    const s=new T.Shape([new T.Vector2(-2.25,0),new T.Vector2(2.25,0),new T.Vector2(0,1.3)]);
    const yaw=Math.atan2(e.nx,e.nz),x=e.a[0]+e.ux*u,z=e.a[1]+e.uz*u;
    add(trim,new T.ShapeGeometry(s).rotateY(yaw).translate(x+e.nx*.73,5,z+e.nz*.73));
    for(const dy of [1.2,2,2.8])for(const d of [-.65,.65])add(0xa58d4f,new T.TorusGeometry(.16,.03,4,10).rotateY(yaw).translate(x+e.ux*d+e.nx*.47,dy,z+e.uz*d+e.nz*.47));
    for(let step=0;step<4;step++)wall(e,0x9a998b,u,.08*(4-step),4.3+step*.2,.16*(4-step),.75+step*.38,.55+step*.2);
    wall(e,trim,u,7.4,3.4,.26,1.05,.55);
  }
}
