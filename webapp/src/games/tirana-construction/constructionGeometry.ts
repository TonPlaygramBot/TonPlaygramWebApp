import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {buildingGround} from '../tirana-east/terrainCore.mjs';
import {facadeEdges} from '../tirana-city-source/sourceCore.mjs';
import {constructionProfile,equipmentPad,insideFootprint} from './constructionCore.mjs';
const C={concrete:0xa8a59a,brick:0xad694b,steel:0x525b5c,yellow:0xe4ad32,blue:0x59858a,rubber:0x272c2d,glass:0x365b66};
/** Same geometry feeds streamed game cells and the software inspection viewer.
 * One vertex-colour mesh per batch. No per-column materials or draw calls. */
export function constructionGeometry(b:any,detail=false):T.BufferGeometry|null {
 const profile=constructionProfile(b);if(!profile)return null;
 const {floors,pitch,stage}=profile,base=buildingGround(b)+profile.low;
 const parts:T.BufferGeometry[]=[];
 const add=(g:T.BufferGeometry,color:number)=>{const geo=g.index?g.toNonIndexed():g;if(geo!==g)g.dispose();const c=new T.Color(color),a=new Float32Array(geo.getAttribute('position').count*3);for(let i=0;i<a.length;i+=3){a[i]=c.r;a[i+1]=c.g;a[i+2]=c.b;}geo.setAttribute('color',new T.BufferAttribute(a,3));parts.push(geo);};
 const box=(color:number,x:number,y:number,z:number,w:number,h:number,d:number,yaw=0)=>add(new T.BoxGeometry(w,h,d).rotateY(yaw).translate(x,base+y,z),color);
 const edges=facadeEdges(b.p),pad=equipmentPad(b);
 if(!detail){
  for(let floor=0;floor<=floors;floor++){
   const y=floor*pitch;
   // Design-informed massing within the retained authored collision envelope.
   const tier=Math.min(2,Math.floor(floor/Math.max(1,Math.ceil(floors/3))));
   const scale=b.development==='mount-tirana'?1-tier*.14:b.development==='hora-vertikale'?.82:b.development==='bond-tower'?.86:1;
   const cx=b.p.reduce((n:number,p:number[])=>n+p[0]/b.p.length,0),cz=b.p.reduce((n:number,p:number[])=>n+p[1]/b.p.length,0);
   const shift=b.development==='hora-vertikale'?(Math.floor(floor/7)%2?1:-1)*1.1:b.development==='bond-tower'?tier*.65:0;
   const ring=b.p.map((p:number[])=>[cx+(p[0]-cx)*scale+shift,cz+(p[1]-cz)*scale]);
   const floorEdges=facadeEdges(ring),shape=new T.Shape(ring.map((p:number[])=>new T.Vector2(p[0],-p[1])));
   for(const hole of b.holes||[])shape.holes.push(new T.Path(hole.map((p:number[])=>new T.Vector2(p[0],-p[1]))));
   add(new T.ExtrudeGeometry(shape,{depth:.22,steps:1,bevelEnabled:false}).rotateX(-Math.PI/2).translate(0,base+Math.max(0,y-.22),0),C.concrete);
   if(floor===floors)continue;
   for(const [ei,e] of floorEdges.entries()){
    const count=Math.max(1,Math.min(16,Math.ceil(e.length/5))),yaw=-Math.atan2(e.uz,e.ux);
    for(let j=0;j<count;j++){
     const u=(j+.08)*e.length/count,x=e.a[0]+e.ux*u-e.nx*.28,z=e.a[1]+e.uz*u-e.nz*.28;
     box(C.concrete,x,y+pitch/2,z,.42,pitch,.42,yaw);
     // Open bays and exposed upper floors remain visible in both infill stages.
     if(stage!=='frame'&&floor<(stage==='infill'?Math.ceil(floors*.55):floors-1)&&(ei+j)%3!==0){
      const mid=(j+.5)*e.length/count,w=Math.max(.2,e.length/count-.6);
      box(C.brick,e.a[0]+e.ux*mid-e.nx*.18,y+1.05,e.a[1]+e.uz*mid-e.nz*.18,w,Math.min(1.75,pitch-.35),.18,yaw);
     }
    }
   }
  }
  if(pad&&floors>1){
   // Interior supports and an open dog-leg stairwell visible through the bays.
   for(const dx of [-2.6,2.6])for(const dz of [-3.8,3.8])box(C.concrete,pad.x+dx,profile.height/2,pad.z+dz,.48,profile.height,.48);
   for(let floor=0;floor<floors;floor++)for(let flight=0;flight<2;flight++)for(let step=0;step<8;step++){
    const rise=pitch/16,y=floor*pitch+flight*pitch/2+(step+1)*rise;
    box(C.concrete,pad.x-1.3+(flight? .85:-.85),y-.08,pad.z+(flight?1.2-step*.32:-1.2+step*.32),1.55,.16,.34);
   }
   for(let floor=0;floor<floors;floor++)box(C.concrete,pad.x-1.3,floor*pitch+pitch/2-.1,pad.z+1.5,3.25,.2,.65);
  }
  if(pad){
  const {x,z}=pad,top=profile.height+8;
  // Lattice tower crane, counterweight, jib and hanging hoist; all authored.
  for(const dx of [-.6,.6])for(const dz of [-.6,.6])box(C.yellow,x+dx,profile.height+4,z+dz,.12,8,.12);
  for(let y=profile.height+1;y<top;y+=2){box(C.yellow,x,y,z- .6,1.3,.1,.1);box(C.yellow,x,y,z+.6,1.3,.1,.1);}
  const reach=Math.max(14,Math.min(32,Math.sqrt(Math.abs(b.p.reduce((sum:number,p:number[],i:number)=>sum+p[0]*b.p[(i+1)%b.p.length][1]-b.p[(i+1)%b.p.length][0]*p[1],0)/2))));
  box(C.yellow,x+reach*.3,top,z,reach,.22,.8);box(C.yellow,x+reach*.3,top+1.3,z,reach,.1,.12);
  const beam=(ax:number,ay:number,az:number,bx:number,by:number,bz:number)=>{const a=new T.Vector3(ax,base+ay,az),v=new T.Vector3(bx,base+by,bz).sub(a);const g=new T.CylinderGeometry(.055,.055,v.length(),4);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),v.clone().normalize()));g.translate(a.x+v.x/2,a.y+v.y/2,a.z+v.z/2);add(g,C.yellow);};
  for(let u=-reach*.2;u<reach*.8-1;u+=2)for(const side of [-1,1])beam(x+u,top,z+side*.4,x+Math.min(reach*.8,u+2),top+1.3,z);
  for(let y=profile.height;y<top-1;y+=2)for(const side of [-1,1])beam(x-.6,y,z+side*.6,x+.6,y+2,z+side*.6);
  box(C.concrete,x-reach*.15,top+.45,z,2.6,.9,1.5);
  box(C.steel,x+reach*.7,top-5,z,.045,10,.045);box(C.steel,x+reach*.7,top-10,z,.35,.16,.3);
  }
  // A perimeter fence explains why unfinished structures are not enterable.
  for(const e of edges){const yaw=-Math.atan2(e.uz,e.ux);box(C.blue,(e.a[0]+e.b[0])/2-e.nx*.08,.8,(e.a[1]+e.b[1])/2-e.nz*.08,e.length,1.6,.08,yaw);}
 }else if(pad){
  const {x,z}=pad;
  // Delivery truck below the open ground-floor bays, not across a public road.
  const tx=x+2.8,tz=z;
  box(C.steel,tx,.65,tz,1.7,.25,4.8);box(C.yellow,tx,1.4,tz-1.5,1.85,1.4,1.5);
  box(C.glass,tx,1.65,tz-2.27,1.5,.55,.04);box(C.blue,tx,1.1,tz+.65,1.85,.7,2.8);
  for(const dx of [-.93,.93])for(const dz of [-1.4,1.4])add(new T.CylinderGeometry(.42,.42,.25,8).rotateZ(Math.PI/2).translate(tx+dx,base+.45,tz+dz),C.rubber);
  for(let i=0;i<5;i++)box(C.brick,x-2.8,.18+i*.16,z+2,1.3,.13,.8);
  // Protruding reinforcement at the roof edge is small and close-range only.
  for(const e of edges)for(let u=.6;u<e.length;u+=5){const x=e.a[0]+e.ux*u-e.nx*.3,z=e.a[1]+e.uz*u-e.nz*.3;if(insideFootprint([x,z],b))box(C.steel,x,profile.height+.5,z,.04,1,.04);}
 }
 if(!parts.length)return null;
 const geometry=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());geometry?.computeBoundingSphere();return geometry;
}
