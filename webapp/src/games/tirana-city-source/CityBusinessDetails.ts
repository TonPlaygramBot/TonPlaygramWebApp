import * as T from 'three';
import type {ReferenceProfile} from './profiles.mjs';
import type {FacadeEdge} from './sourceCore.mjs';
type Add=(color:number,geometry:T.BufferGeometry)=>void;
type Wall=(edge:FacadeEdge,color:number,u:number,y:number,w:number,h:number,d:number,offset?:number)=>void;

/** Fits observed exterior motifs to retained mapped edges. Thin faces are
 * batched planes; only projecting rails, balconies and roof beams are solid. */
export function cityBusinessDetails(p:ReferenceProfile,edges:FacadeEdge[],height:number,_add:Add,wall:Wall){
 if(p.site!=='city-business-reference')return false;
 const glass=0x3f5965,dark=0x303c3d,wood=0x9a6b44;
 const floors=Math.max(1,Math.round(height/p.floor)),floor=height/floors;
 const band=(e:FacadeEdge,color:number,y:number,h=.16,depth=.14,offset=.12)=>wall(e,color,e.length/2,y,e.length,h,depth,offset);
 const window=(e:FacadeEdge,u:number,y:number,w:number,h:number)=>{
  wall(e,p.trim,u,y,w+.2,h+.22,.12,.12);wall(e,glass,u,y,w,h,.08,.23);
  wall(e,p.trim,u,y,.045,h,.06,.30);
 };
 // A shared block must not acquire the hotel's facade along its whole length.
 // Intersect the edge with the documented tenant-detail radius, not just its midpoint.
 const detailEdge=(e:FacadeEdge):FacadeEdge|null=>{
  if(!p.detailAnchor||!p.detailRadius)return e;
  const dx=p.detailAnchor[0]-e.a[0],dz=p.detailAnchor[1]-e.a[1];
  const along=dx*e.ux+dz*e.uz,normal=dx*e.nx+dz*e.nz;
  if(Math.abs(normal)>=p.detailRadius)return null;
  const reach=Math.sqrt(p.detailRadius*p.detailRadius-normal*normal);
  const lo=Math.max(0,along-reach),hi=Math.min(e.length,along+reach);
  if(hi-lo<.4)return null;
  return {...e,a:[e.a[0]+e.ux*lo,e.a[1]+e.uz*lo],b:[e.a[0]+e.ux*hi,e.a[1]+e.uz*hi],length:hi-lo};
 };
 for(const sourceEdge of edges){
  if(sourceEdge.length<.4)continue;
  const detailed=detailEdge(sourceEdge);
  if(!detailed){
   for(let u=1.5;u<sourceEdge.length-1;u+=3.3)for(let y=1.8;y<height-.7;y+=floor)window(sourceEdge,u,y,1.4,1.7);
   continue;
  }
  // Plain windows outside the locally interpreted portion of a shared edge.
  if(p.detailRadius)for(let u=1.5;u<sourceEdge.length-1;u+=3.3){
   const x=sourceEdge.a[0]+sourceEdge.ux*u,z=sourceEdge.a[1]+sourceEdge.uz*u;
   if(Math.hypot(x-p.detailAnchor![0],z-p.detailAnchor![1])<=p.detailRadius)continue;
   for(let y=1.8;y<height-.7;y+=floor)window(sourceEdge,u,y,1.4,1.7);
  }
  const e=detailed,front=!p.front||e.nx*p.front[0]+e.nz*p.front[1]>.35;
  band(e,p.trim,height-.15,.3,.32,.12);
  if(p.style==='black-diamond'){
   band(e,0x354b5a,height/2,height-.12,.08,.10);
   for(let u=.2;u<e.length;u+=1.65)wall(e,dark,u,height/2,.055,height,.07,.20);
   for(let y=3.2;y<height;y+=1.6)band(e,dark,y,.045,.06,.20);
   if(front&&e.length>3){
    wall(e,0x2b536b,1.1,height*.55,1.9,height*.89,.08,.24);
    for(let y=4.8;y<height;y+=3.2)wall(e,0x4f6e7b,1.1,y,1.9,.075,.07,.31);
    wall(e,glass,e.length*.55,2.7,e.length*.7,5.3,.08,.24);
   }
   continue;
  }
  if(e.length<2.5)continue;
  const columns=Math.max(1,Math.floor(e.length/(p.style==='hilton'?3.8:3.3))),pitch=e.length/columns;
  const width=Math.min(1.65,pitch*.58);
  band(e,['chateau-linza','residence-inn'].includes(p.style)?0x9c998b:p.color,1.4,2.8,.1,.09);
  for(let row=0;row<floors;row++){
   const base=row*floor,y=base+floor*.55,wh=Math.min(2.1,floor*.64);
   const observed=front&&base<(p.detailHeight??height);
   if(['iliria','boka','residence-inn','chateau-linza'].includes(p.style))band(e,p.trim,base+.1,.18,.15,.15);
   if(p.style==='hilton'&&row===0){
    band(e,glass,1.55,2.8,.08,.16);
    for(let u=.3;u<e.length;u+=2.3)wall(e,p.trim,u,1.55,.08,2.8,.07,.25);
    continue;
   }
   if(p.style==='colosseo'&&observed&&row===floors-1){
    band(e,glass,y,floor*.77,.08,.22);
    for(let u=.25;u<e.length;u+=1.6)wall(e,p.trim,u,y,.12,floor*.8,.10,.32);
    continue;
   }
   for(let i=0;i<columns;i++){
    const u=(i+.5)*pitch;
    window(e,u,y,width,wh);
    if(!observed)continue;
    if(p.style==='hilton')wall(e,p.trim,u,y-wh/2+.18,width,.055,.07,.30);
    if(p.style==='boka'){
     for(const side of [-1,1]){
      wall(e,0x214c41,u+side*(width*.35),y,width*.42,wh,.1,.32);
      for(let v=-wh/2+.15;v<wh/2;v+=.22)wall(e,0x356050,u+side*width*.35,y+v,width*.4,.025,.06,.41);
     }
    }
    if(p.style==='iliria'&&row>0)wall(e,dark,u,y-wh*.32,width*.86,wh*.28,.09,.34);
    if(p.style==='residence-inn'&&row>0){
     wall(e,dark,u,base+.78,width,.055,.07,.4);
     for(let bar=0;bar<5;bar++)wall(e,dark,u+(bar-2)*width/5,base+.49,.025,.58,.035,.4);
    }
    if(['colosseo','chateau-linza','vila-verde'].includes(p.style)&&row>0){
     const rail=p.style==='colosseo'?p.trim:dark;
     wall(e,p.trim,u,base+.08,pitch*.84,.17,.82,.34);
     wall(e,rail,u,base+.92,pitch*.8,.07,.08,.74);
     for(let bar=0;bar<5;bar++)wall(e,rail,u+(bar-2)*pitch*.17,base+.52,p.style==='colosseo'?.075:.028,.72,.05,.74);
     if(p.style==='chateau-linza')wall(e,0xc97961,u,base+.46,pitch*.72,.55,.10,.73);
    }
   }
   if(!observed)continue;
   if(['moncafe','sarotel'].includes(p.style)&&row>0){
    band(e,p.trim,base+.1,.2,.98,.4);
    band(e,p.style==='moncafe'?p.color:dark,base+.8,p.style==='moncafe'?.58:.065,.10,.87);
    if(p.style==='sarotel')for(let u=.3;u<e.length;u+=.5)wall(e,dark,u,base+.48,.025,.64,.035,.87);
   }
   if(p.style==='bonsai'){
    wall(e,wood,e.length*.14,y,e.length*.27,floor,.09,.34);
    if(row>0){
     wall(e,p.trim,e.length*.69,base+.07,e.length*.53,.18,.9,.37);
     wall(e,0x638065,e.length*.69,base+.52,e.length*.53,.77,.12,.87);
     for(let v=.2;v<.9;v+=.14)wall(e,0xacc0a0,e.length*.69,base+v,e.length*.53,.035,.06,.95);
    }
   }
   if(p.style==='vila-verde'){
    wall(e,0x64a832,e.length*.78,base+.38,e.length*.18,.7,.09,.35);
    for(let v=.1;v<.7;v+=.25)wall(e,0x365c37,e.length*.78,base+v,e.length*.18,.04,.07,.43);
   }
  }
  if(front&&['bonsai','vila-verde','residence-inn','privilege','sarotel'].includes(p.style)){
   const u=e.length*(p.style==='bonsai'?.44:p.style==='residence-inn'?.5:.17);
   const w=Math.min(1.8,e.length*.18),h=p.style==='sarotel'?Math.min(12.8,height):height;
   wall(e,p.style==='privilege'?wood:glass,u,h/2,w,h-.25,.08,.37);
   for(let y=1.6;y<h;y+=p.style==='sarotel'?1.6:floor)wall(e,p.trim,u,y,w,.085,.07,.46);
   if(p.style==='bonsai')for(const side of [-1,1])wall(e,p.trim,u+side*w*.55,h/2,.12,h,.4,.43);
   if(p.style==='vila-verde')wall(e,0x64a832,e.length*.34,height/2,.45,height,.14,.38);
  }
  if(front&&p.style==='privilege'){
   band(e,p.trim,height-.55,1.1,.6,.32);
   for(const u of [.3,e.length-.3])wall(e,p.trim,u,height/2,.5,height,.55,.30);
   band(e,p.trim,height-floor+.4,.6,.8,.33);
  }
  if(front&&p.style==='moncafe'){
   const u=e.length*.5,w=Math.min(3.2,e.length*.25);
   wall(e,0x436449,u,height*.63,w,height*.73,.15,.93);
   for(let row=0;row<16;row++)for(let col=0;col<4;col++){
    const color=[0x638157,0x829464,0x466b43,0xabb187][(row*7+col*3)%4];
    wall(e,color,u+(col-1.5)*w/4,height*.28+row*height*.044,w*.27,height*.05,.10,1.06+(col%2)*.025);
   }
   band(e,dark,height+1.7,.15,1.5,-.4);
   for(let u=.3;u<e.length;u+=2.4)wall(e,dark,u,height+.8,.1,1.7,.1,-.5);
   for(let u=.3;u<e.length;u+=.5)wall(e,dark,u,height+1.73,.07,.08,1.7,-.45);
  }
  if(front&&['opera','sarotel','boka'].includes(p.style)){
   const width=Math.min(e.length*.6,5.2),u=e.length*.5;
   wall(e,glass,u,1.55,width*.7,2.9,.10,.37);
   wall(e,p.style==='boka'?0x286251:p.style==='opera'?p.trim:dark,u,3.1,width,.18,1,.47);
   if(p.style==='opera')for(const side of [-1,1])wall(e,p.trim,u+side*width*.45,1.5,.18,3,.2,.82);
  }
 }
 return true;
}
