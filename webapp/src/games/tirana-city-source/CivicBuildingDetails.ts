import * as T from 'three';
import type {ReferenceProfile} from './profiles.mjs';
import type {FacadeEdge} from './sourceCore.mjs';

type Add=(color:number,g:T.BufferGeometry)=>void;
type Box=(color:number,x:number,y:number,z:number,w:number,h:number,d:number,yaw?:number)=>void;
type Wall=(e:FacadeEdge,color:number,u:number,y:number,w:number,h:number,d:number,offset?:number)=>void;
const STYLES=new Set(['orthodox','orthodox-annex','st-paul','namazgja','prime-minister','presidency','parliament','gallery','hotel-dajti','children-theatre','house-leaves','archaeology','rectorate','polytechnic-tower','polytechnic-wing','interior','health','infrastructure','education','agriculture','finance','jordan-misja','concert-hall','xheko','monarc','twin-towers','aba','etc','sacred-heart']);

/** Authored details from dated, inspected exteriors, never photogrammetry.
 * All components are merged by material by ReferenceFacades. Frontage-only
 * ornament is deliberately separate from the less documented side elevations. */
export function civicBuildingDetails(p:ReferenceProfile,edges:FacadeEdge[],height:number,polygon:number[][],holes:number[][][],add:Add,box:Box,wall:Wall):boolean {
 if(!STYLES.has(p.style))return false;
 const style=p.style,h=p.shellHeight??height;
 const xs=polygon.map(v=>v[0]),zs=polygon.map(v=>v[1]);
 const minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
 const cx=(minX+maxX)/2,cz=(minZ+maxZ)/2,width=maxX-minX,depth=maxZ-minZ;
 const direction=p.front??[0,-1];
 const front=edges.filter(e=>e.length>4).sort((a,b)=>(b.nx*direction[0]+b.nz*direction[1])*2+Math.log(b.length)-(a.nx*direction[0]+a.nz*direction[1])*2-Math.log(a.length))[0];
 const glass=0x354e58,wood=0x655246,slate=0x566976;
 const at=(e:FacadeEdge,u:number,y:number,offset=.2)=>new T.Vector3(e.a[0]+e.ux*u+e.nx*offset,y,e.a[1]+e.uz*u+e.nz*offset);
 const place=(e:FacadeEdge,g:T.BufferGeometry,u:number,y:number,offset=.2)=>{const v=at(e,u,y,offset);return g.rotateY(Math.atan2(e.nx,e.nz)).translate(v.x,v.y,v.z);};
 const arch=(e:FacadeEdge,u:number,y:number,w:number,hh:number,color=glass)=>{
  const r=w/2,s=new T.Shape();s.moveTo(-r,0);s.lineTo(r,0);s.lineTo(r,hh-r);s.absarc(0,hh-r,r,0,Math.PI,false);s.closePath();
  add(color,place(e,new T.ShapeGeometry(s,12),u,y,.24));
 };
 const pediment=(e:FacadeEdge,u:number,y:number,w:number,hh:number,color=p.trim)=>{
  const s=new T.Shape([new T.Vector2(-w/2,0),new T.Vector2(w/2,0),new T.Vector2(0,hh)]);
  add(color,place(e,new T.ShapeGeometry(s),u,y,.35));
 };
 const window=(e:FacadeEdge,u:number,y:number,w=1.4,hh=1.9,shutter=false)=>{
  wall(e,p.trim,u,y,w+.24,hh+.24,.12,.1);wall(e,glass,u,y,w,hh,.08,.2);
  wall(e,p.trim,u,y,.06,hh,.06,.28);wall(e,p.trim,u,y-hh/2-.12,w+.36,.12,.38,.3);
  if(shutter)for(const sign of [-1,1])wall(e,style==='monarc'?0x583f3f:0x355545,u+sign*(w/2+.26),y,.42,hh,.12,.29);
 };
 const cylinder=(color:number,x:number,y:number,z:number,rt:number,rb:number,hh:number,n=16)=>add(color,new T.CylinderGeometry(rt,rb,hh,n).translate(x,y,z));
 const dome=(x:number,z:number,y:number,r:number,rise:number,color=slate)=>add(color,new T.SphereGeometry(r,24,10,0,Math.PI*2,0,Math.PI/2).scale(1,rise/r,1).translate(x,y,z));
 const cross=(x:number,z:number,y:number,size=2)=>{box(p.trim,x,y,z,.15,size,.16);box(p.trim,x,y+size*.18,z,size*.65,.15,.16);};
 const stairs=(e:FacadeEdge,w:number,steps=4)=>{for(let i=0;i<steps;i++)wall(e,p.trim,e.length/2,.12*(steps-i),w+i*.7,.24*(steps-i),.8+i*.7,1+i*.25);};
 const pitchedRoof=(rise:number)=>{
  // Split at the ridge before triangulation: a four-corner footprint alone
  // has no ridge vertices and would incorrectly produce a flat roof.
  const clip=(ring:number[][],side:number)=>{
   const out:number[][]=[];
   for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length],ia=(a[0]-cx)*side>=0,ib=(b[0]-cx)*side>=0;
    if(ia)out.push(a);
    if(ia!==ib){const t=(cx-a[0])/(b[0]-a[0]);out.push([cx,a[1]+t*(b[1]-a[1])]);}
   }return out;
  };
  for(const side of [-1,1]){
  const ring=clip(polygon,side);if(ring.length<3)continue;
  const shape=new T.Shape(ring.map(v=>new T.Vector2(v[0],-v[1])));
  holes.map(r=>clip(r,side)).filter(r=>r.length>=3).forEach(r=>shape.holes.push(new T.Path(r.map(v=>new T.Vector2(v[0],-v[1])))));
  const g=new T.ExtrudeGeometry(shape,{depth:.2,bevelEnabled:false}).rotateX(-Math.PI/2),a=g.getAttribute('position');
  for(let i=0;i<a.count;i++){
   const ridge=1-Math.min(1,Math.abs(a.getX(i)-cx)/(width/2));
   a.setY(i,h+a.getY(i)+rise*ridge);
  }g.computeVertexNormals();add(style==='house-leaves'?0x785447:0x95816d,g);
  }
 };
 // Source-specific silhouettes precede facade details, with separate annexes.
 if(style==='orthodox'){
  const r=Math.min(width,depth)*.36;
  cylinder(p.trim,cx,h+3,cz,r,r,6,32);dome(cx,cz,h+6,r,Math.max(3,height-h-6));
  cross(cx,cz,height+1.5);
  for(let i=0;i<24;i++){
   const a=i*Math.PI/12;const e={a:[cx+Math.cos(a)*r,cz+Math.sin(a)*r],nx:Math.cos(a),nz:Math.sin(a),ux:-Math.sin(a),uz:Math.cos(a)} as FacadeEdge;
   arch(e,0,h+1,1.05,3.2);
  }
 } else if(style==='namazgja'){
  const r=Math.min(width,depth)*.22;
  cylinder(p.trim,cx,h+4,cz,r,r,8,24);dome(cx,cz,h+8,r,height-h-8);
  for(const [dx,dz] of [[-1,0],[1,0],[0,-1],[0,1]])dome(cx+dx*r,cz+dz*r,h+2,r*.66,r*.7);
  for(const [dx,dz] of [[-1,-1],[-1,1],[1,-1],[1,1]]){
   const x=cx+dx*width*.36,z=cz+dz*depth*.36;
   cylinder(p.color,x,5,z,1.8,2.1,10,8);cylinder(p.trim,x,29,z,.8,1,40,12);
   for(const y of [26,35,44]){cylinder(p.trim,x,y,z,1.65,1.4,.6);cylinder(p.color,x,y+.65,z,1.4,1.4,.7);}
   add(slate,new T.ConeGeometry(1.2,8,12).translate(x,53,z));cylinder(0xbea369,x,57.6,z,.09,.09,1.2,6);
  }
 } else if(style==='st-paul'){
  pitchedRoof(8);cross(cx,cz,height+3,3);
 } else if(style==='house-leaves'||style==='sacred-heart')pitchedRoof(height-h);
 if(style==='children-theatre'&&front){
  const mid=at(front,front.length/2,8,-Math.min(6,depth*.2));
  box(p.color,mid.x,8,mid.z,Math.min(18,front.length*.55),4,Math.min(12,depth*.5),front.yaw);
  wall(front,p.trim,front.length/2,10.2,Math.min(19,front.length*.6),.4,1.1,-1);
  for(let i=0;i<4;i++)window(front,front.length/2+(i-1.5)*3.2,8.15,2,2.35);
 }
 for(const e of edges){
  wall(e,p.trim,e.length/2,h-.18,e.length,.36,.45,.09);
  if(e.length<2.3)continue;
  const n=Math.max(1,Math.floor(e.length/3.5)),pitch=e.length/n;
  if(['orthodox','namazgja','sacred-heart'].includes(style)){
   for(let i=0;i<n;i++){
    const u=(i+.5)*pitch;arch(e,u,2,Math.min(2.4,pitch-.7),h*.55);
    if(style==='namazgja')wall(e,p.trim,u,5,.12,6,.1,.35);
   }continue;
  }
  if(style==='twin-towers'){
   wall(e,0x244b6b,e.length/2,h/2,e.length-.15,h-.8,.1,.1);
   for(let y=3;y<h;y+=3.8)wall(e,0x849a9d,e.length/2,y,e.length,.12,.1,.23);
   for(const u of [e.length*.16,e.length*.84])wall(e,p.trim,u,h/2,Math.min(2.8,e.length*.15),h,1,.5);
   continue;
  }
  if(['aba','etc','health','gallery'].includes(style)){
   const floor=style==='health'?3.6:style==='gallery'?h:3.2;
   if(style==='gallery'){
    wall(e,0x537880,e.length/2,2,e.length-.2,3.4,.1,.14);
    const bays=Math.max(1,Math.round(e.length/3.7));
    for(let i=0;i<bays;i++){const u=(i+.5)*e.length/bays;wall(e,p.trim,u,h*.65,e.length/bays-.5,h*.65,.8,.45);}
    continue;
   }
   for(let y=1.8;y<h-1;y+=floor){
    wall(e,style==='etc'&&e.length>16?0x516d76:0x5b828a,e.length/2,y,e.length-.2,2.05,.1,.14);
    const color=style==='aba'?[0xb75349,0xd8bd62,0x70a192][Math.floor(y/floor)%3]:p.trim;
    wall(e,color,e.length/2,y-1.3,e.length,.36,.38,.3);
    for(let u=1;u<e.length;u+=2.2)wall(e,p.trim,u,y,.065,2.15,.1,.24);
   }
   if(style==='health')for(let y=3.2;y<h-1;y+=3.6)for(let j=0;j<3;j++)wall(e,0x939e9a,e.length/2,y+j*.08,e.length,.035,.1,.24);
   if(style==='etc'&&e.length<8)wall(e,p.trim,e.length/2,h+.3,e.length+1,.5,3,1.2);
   continue;
  }
  if(style==='jordan-misja'){
   for(let i=0;i<n;i++)for(let y=2;y<h-1;y+=3.2)window(e,(i+.5)*pitch,y,1.5,2.05);
   if(e.nx>.3){for(let i=0;i<=n;i++){
    const v=at(e,i*pitch,h/2,.55);cylinder(p.trim,v.x,v.y,v.z,.28,.32,h-.5,10);
   }}continue;
  }
  if(['archaeology','rectorate'].includes(style)){
   for(let i=0;i<n;i++)for(const y of [2.2,6.5])window(e,(i+.5)*pitch,y,1.4,2);
   if(e.nx*direction[0]+e.nz*direction[1]>.65&&e.length>15){
    wall(e,wood,e.length/2,h*.45,e.length-1,h*.83,.1,.13);
    for(let i=0;i<=n;i++)wall(e,p.trim,i*pitch,h/2,.6,h,.9,.65);
    wall(e,p.trim,e.length/2,h-.3,e.length,.6,1.5,.65);
   }continue;
  }
  if(style==='presidency'){
   for(let i=0;i<n;i++)for(const y of [2.8,7.3,11.8])window(e,(i+.5)*pitch,y,1.2,1.8);
   for(let i=0;i<=n;i++)wall(e,p.trim,i*pitch,h/2,.42,h-.5,.55,.4);
   continue;
  }
  const classical=['interior','education','agriculture','infrastructure','finance'].includes(style);
  if(classical){
   const base=style==='education'?0x8f9590:0xdfc782;
   wall(e,base,e.length/2,1.8,e.length,3.6,.1,.13);
   for(const y of [3.7,h*.66])wall(e,p.trim,e.length/2,y,e.length,.23,.45,.28);
   if(style==='education')for(let y=.4;y<3.7;y+=.4)wall(e,p.trim,e.length/2,y,e.length,.045,.1,.24);
  }
  if(style==='monarc')for(let y=.5;y<h;y+=.48)wall(e,p.trim,e.length/2,y,e.length,.028,.05,.17);
  const rows=style==='polytechnic-tower'?5:style==='concert-hall'?3:Math.max(2,Math.round(h/3.6));
  for(let row=0;row<rows;row++)for(let i=0;i<n;i++){
   const u=(i+.5)*pitch,y=(row+.55)*h/rows;
   if(e===front&&['parliament','children-theatre','polytechnic-tower','prime-minister'].includes(style))continue;
   window(e,u,y,Math.min(1.6,pitch-.7),Math.min(2,h/rows*.6),classical||style==='hotel-dajti'||style==='monarc');
   if(classical&&row===1){
    if(style==='infrastructure'||style==='agriculture')arch(e,u,y+1.2,1.95,1.1,p.trim);
    else pediment(e,u,y+1.18,2.3,.55);
   }
   if(style==='monarc'&&row===0)arch(e,u,.1,Math.min(2,pitch-.6),2.6,wood);
   if(style==='xheko'){arch(e,u,y-.8,Math.min(1.4,pitch-.8),1.8);wall(e,p.trim,u,y-1.1,2.2,.18,.65,.5);}
  }
  if(style==='xheko'){
   wall(e,p.trim,e.length/2,h+.6,e.length,.18,.28,.2);
   for(let u=.4;u<e.length;u+=.8)wall(e,p.trim,u,h+.25,.16,.7,.18,.23);
  }
 }
 if(front){
  const e=front,u=e.length/2;
  if(style==='prime-minister'){
   for(let i=0;i<3;i++){window(e,u+(i-1)*3.8,2.5,2.5,4);window(e,u+(i-1)*3.8,10.2,2.4,7);}
   wall(e,p.trim,u,5.6,13,.5,2.2,1);wall(e,p.trim,u,6.15,13,.8,.3,2.1);
   wall(e,0xc5bfaa,e.length*.83,11,Math.min(7,e.length*.18),7,.35,.3);stairs(e,16,5);
  } else if(style==='presidency'){
   wall(e,p.trim,u,5.5,15,.5,4,1.8);
   for(const d of [-6,6])wall(e,p.trim,u+d,2.7,.5,5.4,.55,3.5);stairs(e,17,6);
  } else if(style==='parliament'){
   const span=Math.min(18,e.length*.85);
   wall(e,p.trim,u,4,4.2,7,.15,.17);wall(e,wood,u,3.2,3.4,6,.12,.29);
   for(const d of [-.5,-.17,.17,.5]){
    wall(e,0xc5d0cf,u+d*span,h*.46,.55,h*.83,.55,.5);
    wall(e,p.trim,u+d*span,h*.87,1.25,.35,.65,.6);
   }
   wall(e,p.trim,u,h-.5,span+1,.45,.6,.3);pediment(e,u,h,span+1,1.1,0x99adb4);
   for(const d of [-1,1])window(e,u+d*span*.32,3.5,2.3,3.5);stairs(e,span,3);
  } else if(style==='polytechnic-tower'){
   for(let i=0;i<5;i++){
    arch(e,(i+.5)*e.length/5,h-4.1,e.length/7,3.1,wood);
    for(const y of [6.7,10.3,13.9,17.5])window(e,(i+.5)*e.length/5,y,1.25,1.8);
   }
   for(let i=0;i<3;i++)arch(e,(i+.5)*e.length/3,.15,Math.min(4,e.length/5),4.8,wood);
   stairs(e,e.length+3,8);
  } else if(style==='children-theatre'){
   arch(e,u,.1,3.6,5.1,wood);wall(e,p.trim,u,5.8,13,.38,2,.8);
   for(const d of [-5.5,5.5])wall(e,p.trim,u+d,2.7,.55,5.4,.8,1.6);
  } else if(style==='sacred-heart'){
   arch(e,u,.1,4,6,wood);pediment(e,u,h,e.length,5);
   const pos=at(e,u,h+1,.5);add(p.trim,new T.TorusGeometry(1.6,.22,6,24).rotateY(Math.atan2(e.nx,e.nz)).translate(pos.x,pos.y,pos.z));cross(pos.x,pos.z,height+2);
  } else if(style==='education'){
   for(const y of [4.6,8.1]){wall(e,p.trim,u,y,Math.min(9,e.length),.3,1.6,.7);wall(e,p.trim,u,y+.6,Math.min(9,e.length),.8,.2,1.4);}
  }
 }
 return true;
}
