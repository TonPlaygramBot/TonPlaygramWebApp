import * as T from 'three';
import type {ReferenceProfile} from './profiles.mjs';
import type {FacadeEdge} from './sourceCore.mjs';
type Add=(color:number,g:T.BufferGeometry)=>void;
type Wall=(e:FacadeEdge,color:number,u:number,y:number,w:number,h:number,d:number,offset?:number)=>void;
/** Dated facade readings on mapped outlines. Repeated details are merged by
 * ReferenceFacades; hidden elevations and exact bay dimensions are estimates. */
export function neighbourhoodBuildingDetails(p:ReferenceProfile,edges:FacadeEdge[],height:number,add:Add,wall:Wall){
 if(!['sami-frasheri','servete-maci','book-arches','book-wing'].includes(p.style))return false;
 for(const e of edges){
  if(e.length<.3)continue;
  wall(e,p.trim,e.length/2,height+.08,e.length,.16,.28,.12);
  if(p.style==='sami-frasheri'){
   wall(e,0x354349,e.length/2,height/2,e.length-.08,height-.35,.09,.13);
   for(let y=.3;y<height;y+=3.2)wall(e,0xc5c8bf,e.length/2,y,e.length,.15,.18,.25);
   for(let u=.3;u<e.length;u+=1.15){
    wall(e,0x8c948c,u,height/2,.075,height,.12,.24);
    // Wave fins use eight contiguous segments, independent of camera axes.
    const slices=8,step=(height-2.2)/slices;
    for(let i=0;i<slices;i++){
     const y=2.2+(i+.5)*step,wave=.55+.24*Math.sin(y*.72+u*.035);
     wall(e,p.trim,u,y,.085,step+.015,wave,.25+wave/2);
    }
   }
  }else if(p.style==='servete-maci'){
   wall(e,e.x<255?0x77b7ad:0xc65b48,e.length/2,1.65,e.length,3.25,.12,.11);
   for(const y of [3.3,6.8])wall(e,p.trim,e.length/2,y,e.length,.16,.2,.2);
   if(e.length>12)for(let u=.85;u<e.length-.5;u+=1.75)for(const y of [4.95,8.55]){
    wall(e,0x858b84,u,y,.72,2.8,.12,.12);wall(e,0x48605f,u,y,.5,2.55,.08,.21);
    wall(e,p.trim,u,y,.05,2.55,.06,.27);
   }
  }else{
   const floors=Math.max(1,Math.round(height/3.65)),floor=height/floors;
   const columns=Math.max(1,Math.floor(e.length/(p.style==='book-arches'?4.9:3.8))),pitch=e.length/columns;
   for(let row=0;row<floors;row++)for(let i=0;i<columns;i++){
    const u=(i+.5)*pitch,y=row*floor+.25,w=pitch*.8,h=floor*.87;
    if(p.style==='book-arches'){
     const radius=w/2,s=new T.Shape();s.moveTo(-radius,0);s.lineTo(radius,0);s.lineTo(radius,h*.57);s.absellipse(0,h*.57,radius,h*.43,0,Math.PI,false,0);s.lineTo(-radius,0);
     add(0x435c68,new T.ShapeGeometry(s,10).rotateY(e.yaw).translate(e.a[0]+e.ux*u+e.nx*.08,y,e.a[1]+e.uz*u+e.nz*.08));
    }else wall(e,0x425864,u,y+h/2,w*.67,h,.09,.12);
    wall(e,p.trim,u,y+.12,w,.18,.7,.38);
    wall(e,0xabb4af,u,y+.6,w,.06,.07,.76);
    for(const du of [-.3,0,.3])wall(e,0xbac3be,u+du*w,y+.38,.035,.5,.04,.76);
    wall(e,0x919e9f,u,y+h*.45,.055,h*.85,.06,.18);
   }
  }
 }
 return true;
}
