import {LOCAL_LIFE} from './localLifeData.mjs';
import {insideRing} from './surfaceCore.mjs';
import {STREET_LIFE} from '../tirana-street-life/streetLifeData.mjs';
/** Fit whole pieces inside a mapped polygon, including concave boundaries.
 * Point-only park records never receive an invented playground area. */
export {amenityAnchor} from './amenityPlacement.mjs';

const original=new Set(STREET_LIFE.fuel.map(s=>s.id));
export const LOCAL_FUEL=LOCAL_LIFE.sites.filter(s=>s.category==='fuel'&&!original.has(s.id)).map(s=>{
 let x=s.x,z=s.z,yaw=0,mountHeight=2.7;
 if(s.ring){
  const edges=s.ring.slice(0,-1).map((a,i)=>({a,b:s.ring[i+1],l:Math.hypot(a[0]-s.ring[i+1][0],a[1]-s.ring[i+1][1])})).sort((a,b)=>b.l-a.l);
  const e=edges[0];if(e){x=(e.a[0]+e.b[0])/2;z=(e.a[1]+e.b[1])/2;let nx=(e.b[1]-e.a[1])/e.l,nz=-(e.b[0]-e.a[0])/e.l;if(insideRing([x+nx*.2,z+nz*.2],s.ring)){nx=-nx;nz=-nz;}x+=nx*.4;z+=nz*.4;yaw=Math.atan2(nx,nz);}

 }
 return {...s,x,z,yaw,kind:'fuel-sign',width:3.2,signHeight:.85,mountHeight};
});
export const MAPPED_PARKS=LOCAL_LIFE.sites.filter(s=>s.category==='park'||s.category==='playground');
