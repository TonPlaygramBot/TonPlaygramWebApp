import * as T from 'three';
import type {ReferenceProfile} from './profiles.mjs';
import type {FacadeEdge} from './sourceCore.mjs';

type Add=(color:number,geometry:T.BufferGeometry)=>void;
type Box=(color:number,x:number,y:number,z:number,w:number,h:number,d:number,yaw?:number)=>void;
type Wall=(e:FacadeEdge,color:number,u:number,y:number,w:number,h:number,d:number,offset?:number)=>void;

/** Batched facade details; colours and bay spacing are photo interpretations.
 * No per-window materials, textures, lights or animation loops. */
export function landmarkDetails(profile:ReferenceProfile,edges:FacadeEdge[],height:number,add:Add,box:Box,wall:Wall,centre:{x:number;z:number}) {
 const style=profile.style;
 if(!['grand','mangalem','delijorgji','studenti','studenti-renovated','teg','qtu','ring','toptani','sky','sheraton','stadium','plaza','congress'].includes(style))return false;
 const glass=0x365867,white=profile.trim;
 for(const e of edges){
  wall(e,white,e.length/2,height-.14,e.length,.28,.36,.09);
  if(e.length<1)continue;
  if(style==='stadium'){
   // Eight-sided low shell and separate tower use the same red ceramic fins.
   for(let y=2;y<height-1;y+=4.4){
    wall(e,glass,e.length/2,y+1.7,e.length,3.9,.16,.11);
    for(let i=0,u=.7;u<e.length;i++,u+=1.8){
     const red=[0xbf2339,0xe74448,0x991e32][i%3];
     wall(e,red,u,y+1.8,.37+(i%3)*.12,3.2+(i%2)*.6,.38,.3);
    }
   }
   continue;
  }
  if(style==='ring'||style==='sheraton'){
   const floor=3.2,start=style==='sheraton'?height*.3:.3;
   if(style==='sheraton'&&e.length<9)continue;
   wall(e,style==='ring'?0x3c737d:0x233c56,e.length/2,(height+start)/2,e.length,height-start-.4,.18,.17);
   for(let y=start;y<height;y+=floor)wall(e,0x273a43,e.length/2,y,e.length,.09,.16,.29);
   for(let u=.3;u<e.length;u+=2.15)wall(e,0x293f4b,u,(height+start)/2,.075,height-start,.13,.3);
   if(style==='ring')wall(e,0x2e3e45,e.length/2,height*.52,e.length,.55,1.4,.8);
   continue;
  }
  if(style==='qtu'){
   wall(e,0x293a40,e.length/2,height*.63,e.length,height*.7,.1,.1);
   wall(e,glass,e.length/2,height*.15,e.length-.2,height*.28,.1,.15);
   for(let y=height*.32+1.2;y<height-1;y+=2.5)for(let u=1.3;u<e.length-1;u+=2.5){
    const panel=new T.PlaneGeometry(1.67,1.67).rotateZ(Math.PI/4).rotateY(Math.atan2(e.nx,e.nz));
    panel.translate(e.a[0]+e.ux*u+e.nx*.24,y,e.a[1]+e.uz*u+e.nz*.24);add(0xb72e37,panel);
   }
   continue;
  }
  if(['teg','toptani'].includes(style)){
   const pitch=style==='toptani'?5:7;
   for(let y=2;y<height-1;y+=style==='toptani'?6:4){
    if(style==='toptani'){
     for(let u=pitch/2;u<e.length;u+=pitch){
      wall(e,glass,u,y+1.2,Math.min(3.8,e.length-.4),4.3,.14,.15);
      wall(e,white,u,y-.95,4.4,.23,.8,.4);
      for(let i=0;i<3;i++)wall(e,0xbac5c0,u-1.4+i*1.25,y+1.2,.5,4.3,.12,.29);
     }
    }else{
     wall(e,0x55595b,e.length/2,y,e.length,.55,.12,.1);
     if(y<3)wall(e,glass,e.length/2,y,e.length-.4,3.2,.1,.19);
     for(let u=4;u<e.length;u+=8)wall(e,white,u,height/2,.16,height-.3,.15,.22);
    }
   }
   continue;
  }
  if(style==='sky'){
   for(let y=2;y<height-13;y+=3.2){
    wall(e,glass,e.length/2,y,e.length-.25,1.7,.1,.12);
    for(let u=1;u<e.length;u+=2.4){
     wall(e,white,u,y,.14,1.85,.15,.23);
     if(e.length>8&&Math.floor(u/2.4)%3===0)wall(e,Math.floor(y/3.2)%2?0xa8a99f:0xe0ddce,u,y,1.1,3.15,.15,.27);
    }
    wall(e,white,e.length/2,y+1.2,e.length,.22,.23,.19);
   }
   continue;
  }
  if(style==='congress'){
   wall(e,glass,e.length/2,height*.4,e.length-.2,height*.6,.1,.1);
   wall(e,glass,e.length/2,height*.82,e.length-.2,height*.24,.12,1.5);
   for(let u=.6;u<e.length;u+=8.5){
    wall(e,white,u,height*.3,.65,height*.6,.7,.7);
    for(const side of [-1,0,1]){
     const start=new T.Vector3(e.a[0]+e.ux*u+e.nx*.7,height*.5,e.a[1]+e.uz*u+e.nz*.7);
     const end=new T.Vector3(start.x+e.ux*side*2.7+e.nx*.9,height*.7,start.z+e.uz*side*2.7+e.nz*.9);
     const dir=end.clone().sub(start),g=new T.CylinderGeometry(.2,.23,dir.length(),6);
     g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),dir.clone().normalize()));
     const mid=start.add(end).multiplyScalar(.5);g.translate(mid.x,mid.y,mid.z);add(white,g);
    }
   }
   for(let u=.6;u<e.length;u+=2.2)wall(e,white,u,height*.82,.11,height*.24,.16,1.65);
   wall(e,white,e.length/2,height-.3,e.length,.6,1.9,.65);
   continue;
  }
  const floor=style==='plaza'?3.4:3.2;
  const pitch=style==='plaza'?2.8:style==='mangalem'?3.6:3.8;
  const count=Math.max(1,Math.floor(e.length/pitch));
  for(let y=1.8;y<height-.9;y+=floor){
   if(['grand','delijorgji','sheraton'].includes(style))wall(e,white,e.length/2,y-1.2,e.length,.35,.24,.22);
   for(let i=0;i<count;i++){
    const u=(i+.5)*e.length/count,w=Math.min(1.85,e.length/count-.45);
    if(w<.3)continue;
    const trim=style==='grand'?0xc3708c:white;
    wall(e,trim,u,y,w+.28,2.1,.15,.13);
    wall(e,glass,u,y,w,1.85,.08,.24);
    wall(e,white,u,y,.065,1.85,.1,.29);
    if(style==='mangalem'&&(i+Math.round(y/floor))%3===0)wall(e,white,u,y,w,1.85,.1,.34);
    if(style==='studenti-renovated'&&e.length>20){
     wall(e,0xab2939,u,y,w+.65,2.4,.08,.3);
     wall(e,0xf0eee8,u,y-.75,w+.7,.85,1.05,.78);
     wall(e,0xf0eee8,u-w/2-.25,y,.2,3.15,1.05,.78);
    }
    if(style==='delijorgji'&&i%3===0)wall(e,0xb16b50,u,y,w+.2,3.2,.16,.2);
    if(['grand','delijorgji'].includes(style)&&i%3!==0&&y>4){
     wall(e,white,u,y-1,w+1.1,.18,1.3,.63);
     wall(e,0x647270,u,y-.5,w+1,.075,.06,1.22);
     for(let k=0;k<5;k++)wall(e,0x647270,u-(w+.8)/2+k*(w+.8)/4,y-.72,.025,.44,.05,1.22);
    }
    if(style==='plaza'){
     wall(e,white,u-w/2-.26,y,.34,3.4,.62,.4);
     wall(e,white,u,y-1.15,w+.65,.7,.65,.4);
    }
   }
  }
  if(style==='grand'&&e.length>8){
   for(let u=1;u<e.length;u+=1.3)wall(e,0x826549,u,height+.5,.1,.12,2,.55);
   for(const u of [1,e.length-1])wall(e,0x826549,u,height+.1,.1,.8,.1,1.4);
  }
 }
 if(style==='sky'){
  // The mechanism is 22.5 m across; enclosing roof diameter and vertical
  // dimensions below are photo estimates, not manufacturer's measurements.
  const radius=12.3;
  add(glass,new T.CylinderGeometry(7,7,3.3,40).translate(centre.x,height-10.3,centre.z));
  add(white,new T.CylinderGeometry(radius-.8,8,2.4,40).translate(centre.x,height-7.5,centre.z));
  add(glass,new T.CylinderGeometry(radius,radius-.8,2.5,40).translate(centre.x,height-5.05,centre.z));
  add(white,new T.ConeGeometry(radius+.5,3.2,40).translate(centre.x,height-2.2,centre.z));
  box(white,centre.x,height+.5,centre.z,.15,2,.15);
  for(let i=0;i<32;i++){
   const a=i*Math.PI/16;
   box(white,centre.x+Math.cos(a)*(radius-.35),height-5,centre.z+Math.sin(a)*(radius-.35),.11,2.5,.11);
  }
 }
 if(style==='teg'){
  // One entrance treatment on a long outward wall. Position/depth are authored
  // until a georeferenced entrance survey is available; footprint is unchanged.
  const e=[...edges].filter(e=>e.length>22).sort((a,b)=>b.nz-a.nz||b.length-a.length)[0];
  if(e){
   const u=e.length/2,w=Math.min(26,e.length-2),h=height-.7;
   wall(e,glass,u,h/2,w,h,.3,.3);
   for(let x=-w/2;x<=w/2;x+=2.5)wall(e,white,u+x,h/2,.1,h,.16,.55);
   wall(e,white,u,h,w+3,.2,9,4);
   for(let x=-w/2;x<=w/2;x+=2.5)wall(e,0x798e91,u+x,h+.15,.11,.13,9,4);
   for(const side of [-1,1]){
    const p=new T.Vector3(e.a[0]+e.ux*u+e.nx*6,.1,e.a[1]+e.uz*u+e.nz*6);
    const q=new T.Vector3(p.x+e.ux*side*w*.4,h,p.z+e.uz*side*w*.4);
    const direction=q.clone().sub(p);const geometry=new T.CylinderGeometry(.14,.18,direction.length(),6);
    geometry.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),direction.clone().normalize()));
    geometry.translate(...p.add(q).multiplyScalar(.5).toArray() as [number,number,number]);add(white,geometry);
   }
  }
 }
 return true;
}
