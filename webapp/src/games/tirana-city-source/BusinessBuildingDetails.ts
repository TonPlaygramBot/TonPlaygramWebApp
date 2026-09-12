import * as T from 'three';
import type {ReferenceProfile} from './profiles.mjs';
import type {FacadeEdge} from './sourceCore.mjs';
type Add=(color:number,geometry:T.BufferGeometry)=>void;
type Wall=(e:FacadeEdge,color:number,u:number,y:number,w:number,h:number,d:number,offset?:number)=>void;

/** Separate architectural vocabularies fitted to real outlines. ReferenceFacades
 * batches by material; only projecting slabs use solid geometry. */
export function businessBuildingDetails(p:ReferenceProfile,edges:FacadeEdge[],height:number,add:Add,wall:Wall){
 if(p.site!=='business-reference')return false;
 const glass=0x435c68,dark=0x343735;
 const arch=(e:FacadeEdge,u:number,y:number,w:number,h:number,offset:number)=>{
  const shape=(width:number,tall:number)=>{const s=new T.Shape(),r=width/2;s.moveTo(-r,0);s.lineTo(r,0);s.lineTo(r,tall-r);s.absarc(0,tall-r,r,0,Math.PI,false);s.lineTo(-r,0);return s;};
  for(const [color,w0,h0,dy,depth] of [[p.trim,w+.25,h+.2,0,offset],[glass,w,h,.07,offset+.025]]){
   add(color,new T.ShapeGeometry(shape(w0,h0),8).rotateY(e.yaw).translate(e.a[0]+e.ux*u+e.nx*depth,y+dy,e.a[1]+e.uz*u+e.nz*depth));
  }
 };
 for(const e of edges){
  if(e.length<.4)continue;
  const front=!p.front||e.nx*p.front[0]+e.nz*p.front[1]>.3;
  const start=p.style==='xheko-tower'?19.2:0;
  const floors=p.style==='gloria'?3:Math.max(1,Math.round(height/p.floor)),floor=height/floors;
  wall(e,p.trim,e.length/2,height-.16,e.length,.3,.4,.13);
  if(p.style==='credins-hq'){
   if(front){
    wall(e,glass,e.length/2,height/2,e.length-.12,height-.2,.09,.14);
    for(let u=.2;u<e.length;u+=1.8)wall(e,p.trim,u,height/2,.06,height,.08,.24);
    for(let y=.2;y<height;y+=1.6)wall(e,p.trim,e.length/2,y,e.length,.065,.08,.24);
    wall(e,glass,e.length/2,height+.65,e.length,1.3,.08,.15);
    for(let u=.2;u<e.length;u+=1.8)wall(e,p.trim,u,height+.65,.06,1.3,.08,.24);
   }else for(let row=0;row<floors;row++)for(let u=1.2+(row%2)*1.1;u<e.length-.6;u+=3.4)wall(e,glass,u,(row+.55)*floor,.48,floor*.73,.08,.14);
   continue;
  }
  if(start===0){
   wall(e,p.style==='monarc'||p.style==='elysee'?0x8b8981:p.color,e.length/2,1.45,e.length,2.9,.12,.09);
   if(p.style==='monarc')for(let y=.35;y<3;y+=.45)wall(e,p.trim,e.length/2,y,e.length,.035,.08,.18);
  }
  for(let y=Math.max(floor,start);y<height-.3;y+=floor)wall(e,p.trim,e.length/2,y,e.length,.2,.16,.13);
  if(e.length<2.5)continue;
  const columns=Math.max(1,Math.floor(e.length/(p.style==='senator'?3.6:3.3))),pitch=e.length/columns,w=Math.min(1.6,pitch*.56);
  for(let row=0;row<floors;row++){
   const base=row*floor;if(base<start-.01)continue;
   if(p.style==='gloria'&&row===floors-1){
    wall(e,glass,e.length/2,base+floor*.45,e.length-.4,floor*.8,.09,.18);
    for(let u=.25;u<e.length;u+=1.7)wall(e,dark,u,base+floor*.45,.09,floor*.8,.1,.26);
    wall(e,dark,e.length/2,height-.15,e.length+.4,.28,.7,.22);
    continue;
   }
   for(let i=0;i<columns;i++){
    // Senator's largely solid lateral elevations stay restrained.
    if(p.style==='senator'&&!front&&i%3!==0)continue;
    const u=(i+.5)*pitch,y=base+floor*.56,wh=Math.min(2.15,floor*.62);
    const arched=front&&['mondial','xheko-podium'].includes(p.style)||p.style==='xheko-tower'&&row>=floors-2;
    if(arched)arch(e,u,y-wh/2,w,wh,.19);
    else{
     wall(e,p.trim,u,y,w+.22,wh+.23,.12,.11);
     wall(e,glass,u,y,w,wh,.08,.21);
    }
    wall(e,p.trim,u,y,.045,wh,.06,.29);
    wall(e,p.trim,u,y-wh/2-.1,w+.3,.13,.16,.22);
    if(p.style==='monarc')for(const side of [-1,1]){
     wall(e,0x6d3d30,u+side*(w/2+.21),y,.33,wh,.12,.19);
     for(let v=-.7;v<=.7;v+=.35)wall(e,0x9a6c4e,u+side*(w/2+.21),y+v,.3,.035,.07,.28);
    }
    const balcony=front&&row>0&&['mondial','dinasty','elysee','xheko-tower'].includes(p.style);
    if(balcony){
     const projection=p.style==='xheko-tower'?.55:.65;
     wall(e,p.trim,u,base+.13,pitch*.84,.18,projection+.3,projection/2);
     wall(e,p.style==='elysee'?p.trim:dark,u,base+.9,pitch*.8,.065,.07,projection+.18);
     for(let bar=0;bar<5;bar++)wall(e,p.style==='elysee'?p.trim:dark,u+(bar-2)*pitch*.18,base+.53,.028,.7,.035,projection+.18);
     if(p.style==='dinasty')for(const side of [-1,1])wall(e,0x996749,u+side*pitch*.43,y,.16,wh,.22,.36);
    }
    if(front&&p.style==='gloria'&&row===1){
     wall(e,glass,u,y,w*.95,wh,.12,.56);
     for(const side of [-1,1])wall(e,p.trim,u+side*w*.5,y,.09,wh+.2,.55,.32);
     wall(e,p.trim,u,y+wh/2,w+.22,.16,.64,.36);
    }
   }
  }
  if(front&&['senator','xheko-podium','gloria'].includes(p.style))for(let u=.2;u<e.length;u+=pitch)wall(e,p.trim,u,height*.47,.2,height*.89,.16,.15);
  if(['monarc','mondial','dinasty','xheko-podium'].includes(p.style)){
   const wood=p.style==='dinasty'?0x694635:dark;
   wall(e,wood,e.length/2,height+1.8,e.length,.18,.22,-.7);
   for(let u=.7;u<e.length-.3;u+=3.4){
    wall(e,wood,u,height+.9,.12,1.8,.12,-.7);
    wall(e,wood,u,height+1.8,.12,.12,2.2,-1.1);
   }
  }
  if(p.style==='elysee'&&front&&e.length>8){
   wall(e,glass,e.length*.16,height*.55,1.9,height*.82,.12,.25);
   for(let y=3.2;y<height;y+=3.2)wall(e,p.trim,e.length*.16,y,2,.1,.13,.34);
  }
 }
 return true;
}
