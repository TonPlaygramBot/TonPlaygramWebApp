import * as T from 'three';
import type {ReferenceProfile} from './profiles.mjs';
import type {FacadeEdge} from './sourceCore.mjs';
type Add=(color:number,g:T.BufferGeometry)=>void;
type Wall=(e:FacadeEdge,color:number,u:number,y:number,w:number,h:number,d:number,offset?:number)=>void;

const GLASS=0x345663;
const DARK_GLASS=0x28434a;
const ARROW=0xd3ce92;
// The older street photograph shows pale arrows on prominent exterior edges,
// not on every courtyard return. Keep that distinction on the detailed outline.
function isArrowFront(e:FacadeEdge) {
 return e.length>=8&&(e.nz<-.7||e.nx>.72)&&!(e.z>642&&e.nx<0);
}
function arrow(add:Add,e:FacadeEdge,u:number,y:number,len:number,angle:number) {
 const l=len/2,head=len*.25,w=len*.048;
 const outline=new T.Shape();
 outline.moveTo(-l,-w);outline.lineTo(l-head,-w);outline.lineTo(l-head,-w*3);
 outline.lineTo(l,0);outline.lineTo(l-head,w*3);outline.lineTo(l-head,w);outline.lineTo(-l,w);outline.closePath();
 add(ARROW,new T.ShapeGeometry(outline).rotateZ(angle).rotateY(e.yaw)
  .translate(e.a[0]+e.ux*u+e.nx*.083,y,e.a[1]+e.uz*u+e.nz*.083));
}
type GlyphStroke=[number,number,number,number];
const LINES:Readonly<Record<string,readonly GlyphStroke[]>>={
 M:[[0,0,0,1],[0,1,.5,.46],[.5,.46,1,1],[1,1,1,0]],
 A:[[0,0,.5,1],[.5,1,1,0],[.22,.43,.78,.43]],
 R:[[0,0,0,1],[0,1,.89,1],[.89,1,.89,.51],[.89,.51,0,.51],[.40,.51,1,0]],
 I:[[.5,0,.5,1],[.16,1,.84,1],[.16,0,.84,0]],
 N:[[0,0,0,1],[0,1,1,0],[1,0,1,1]],
 J:[[.14,1,1,1],[.84,1,.84,.22],[.84,.22,.60,0],[.60,0,.21,0],[.21,0,0,.24]],
 H:[[0,0,0,1],[1,0,1,1],[0,.49,1,.49]],
 O:[[.19,0,.81,0],[.81,0,1,.21],[1,.21,1,.79],[1,.79,.81,1],[.81,1,.19,1],[.19,1,0,.79],[0,.79,0,.21],[0,.21,.19,0]],
 T:[[0,1,1,1],[.5,1,.5,0]],
 E:[[0,0,0,1],[0,1,1,1],[0,.51,.78,.51],[0,0,1,0]],
 L:[[0,1,0,0],[0,0,1,0]]
};
function marinajRoofSign(edges:FacadeEdge[],height:number,add:Add){
 // Exact Keko-facing long side of OSM way 1162828946. Operator and project
 // photographs show raised, pale roofline lettering. Use original plain
 // strokes, not the business logo, typeface, or image pixels.
 const edge=edges.find(e=>e.length>=20&&e.nx>.5&&e.nz<-.5);
 if(!edge)return;
 const words='MARINAJ HOTEL',hh=1.08,ww=.67,spacing=.91;
 for(const [i,letter] of [...words].entries())for(const [ax,ay,bx,by] of LINES[letter]??[]){
  const dx=(bx-ax)*ww,dy=(by-ay)*hh,
    u=(i-(words.length-1)/2)*spacing+((ax+bx)/2-.5)*ww,
    y=height-1.14+((ay+by)/2-.5)*hh;
  add(0xf4f2e7,new T.BoxGeometry(Math.hypot(dx,dy)+.035,.105,.12)
    .rotateZ(Math.atan2(dy,dx)).rotateY(edge.yaw)
    .translate(edge.x+edge.nz*u+edge.nx*.324,y,edge.z-edge.nx*u+edge.nz*.324));
 }
}
/** Returns true when the authored model owns all facade layers for this shell.
 * Geometry is simple and batched by the existing reference facade renderer. */
export function westernFacadeDetails(p:ReferenceProfile,edges:FacadeEdge[],height:number,add:Add,wall:Wall){
 if(p.style==='western-square-21')return square21(p,edges,height,wall);
 if(!['western-arrows','western-marinaj','western-kristal'].includes(p.style))return false;
 if(p.style==='western-marinaj')marinajRoofSign(edges,height,add);
 for(const e of edges){
  if(e.length<(p.style==='western-arrows'?6.5:2.5))continue;
  const main=e.length>=7, roof=height-.18;
  wall(e,p.trim,e.length/2,roof,e.length,.33,.18,.11);
  if(p.style==='western-arrows'){
   const floors=Math.max(3,Math.round(height/p.floor)), floor=height/floors;
   const n=Math.max(1,Math.min(11,Math.floor(e.length/3.4))),pitch=e.length/n;
   const painted=isArrowFront(e);
   if(main)wall(e,0x494944,e.length/2,floor*.48,e.length-.1,floor*.87,.08,.13);
   for(let j=0;j<n;j++) {
    const u=(j+.5)*pitch,balcony=main&&j%3===2;
    if(main)wall(e,GLASS,u,floor*.5,pitch*.77,floor*.68,.05,.225);
    for(let i=1;i<floors;i++){
     const y=(i+.55)*floor;
     if(painted&&j%2===0&&(i+j)%3!==0)arrow(add,e,u,y-.83,Math.min(2.4,pitch*.73),((i+j)%4===0?.45:0));
     if(balcony){
      wall(e,p.trim,u,y-floor*.36,pitch*.92,.21,.56,.31);
      wall(e,0x525955,u,y-floor*.19,pitch*.84,.09,.14,.63);
      wall(e,0xb4b3aa,u,y+floor*.04,pitch*.96,floor*.75,.055,.1);
     }
     wall(e,0xc6c8b8,u,y,pitch*(balcony?.7:.51),floor*.51,.055,.155);
     wall(e,DARK_GLASS,u,y,pitch*(balcony?.61:.43),floor*.44,.045,.23);
     wall(e,p.trim,u,y,.05,floor*.44,.05,.295);
    }
   }
  }else if(p.style==='western-marinaj'){
   const upper=Math.max(10,height-3.3), n=Math.max(2,Math.min(8,Math.floor(e.length/3.3))),pitch=e.length/n;
   const spine=e.nx>.35&&e.nz<0; // The Keko-facing turn has the stronger pale/glass read.
   wall(e,DARK_GLASS,e.length/2,2.0,e.length-.18,3.6,.09,.115);
   wall(e,DARK_GLASS,e.length/2,height-1.5,e.length-.24,2.48,.09,.135);
   wall(e,0x685649,e.length/2,4.05,e.length,.3,.3,.19);
   if(spine){
    wall(e,p.trim,e.length*.34,(upper+4.25)/2,e.length*.64,upper-4.25,.11,.08);
    wall(e,DARK_GLASS,e.length*.82,(upper+3.85)/2,e.length*.14,upper-3.85,.11,.14);
   }
   const rows=Math.max(1,Math.floor((upper-4.05)/p.floor)),floor=(upper-4.05)/rows;
   for(let i=0;i<rows;i++)for(let j=0;j<n;j++){
    const u=(j+.5)*pitch,y=4.05+(i+.53)*floor;
    if(spine&&j>=n*.7)continue;
    wall(e,spine?0x6a7776:0x665447,u,y,pitch*.77,floor*.74,.065,.175);
    wall(e,GLASS,u,y,pitch*.69,floor*.67,.04,.23);
    wall(e,p.trim,u,y,.055,floor*.67,.025,.27);
   }
   for(let j=1;j<n;j++)wall(e,p.trim,j*pitch,height-1.5,.065,2.48,.045,.23);
  }else{
   const n=Math.max(1,Math.min(8,Math.floor(e.length/3.25))),pitch=e.length/n;
   const podium=Math.min(6.1,height*.34),floors=Math.max(2,Math.round((height-podium)/p.floor)),floor=(height-podium)/floors;
   wall(e,0x847362,e.length/2,podium/2,e.length-.11,podium-.08,.07,.11);
   for(let j=0;j<n;j++){
    const u=(j+.5)*pitch;
    wall(e,j%2?GLASS:DARK_GLASS,u,podium*.48,pitch*.89,podium*.78,.08,.19);
    wall(e,p.trim,u,podium*.47,.065,podium*.77,.06,.273);
   }
   wall(e,p.trim,e.length/2,podium,e.length,.32,.42,.18);
   for(let i=0;i<floors;i++){
    const y=podium+(i+.55)*floor;
    for(let j=0;j<n;j++){
     const u=(j+.5)*pitch;
     if(j%3===0)wall(e,0xa78367,u,Math.min(y,height-floor*.47),pitch*.9,floor*.92,.045,.075);
     wall(e,0x576462,u,y,pitch*.68,floor*.59,.054,.14);
     wall(e,GLASS,u,y,pitch*.61,floor*.53,.045,.19);
     wall(e,p.trim,u,y-floor*.36,pitch*.91,.18,.55,.3);
     wall(e,p.trim,u,y-floor*.18,pitch*.91,.065,.09,.6);
    }
   }
  }
 }
 return true;
}


// A small material palette and batched facade geometry preserve the two
// mapped courtyard outlines. No external photo surfaces or collisions.
function square21(p:ReferenceProfile,edges:FacadeEdge[],height:number,wall:Wall){
 const floors=Math.max(4,Math.round(height/p.floor)),floor=height/floors;
 for(const e of edges){
  if(e.length<6)continue;
  const bays=Math.max(1,Math.min(12,Math.floor(e.length/3.6))),pitch=e.length/bays;
  const street=e.nz<-.7, base=floor*1.6;
  wall(e,DARK_GLASS,e.length/2,base*.5,e.length-.15,base-.15,.07,.1);
  wall(e,p.trim,e.length/2,base,e.length,.24,.26,.17);
  wall(e,p.trim,e.length/2,height-.22,e.length,.24,.23,.12);
  for(let j=0;j<bays;j++){
   const u=(j+.5)*pitch,leader=(j+Math.round(e.x))%5===0;
   const wing=(Math.floor(j/3)+Math.round(Math.abs(e.z)))%3;
   const pigment=[0xd8d0c1,0xa38a73,0xb0b0a4][wing];
   wall(e,pigment,u,(height+base)/2,pitch-.04,height-base-.11,.052,.078);
   wall(e,p.trim,u,base*.47,.07,base*.9,.04,.21);
   if(leader&&street) {
    for(let r=3;r<floors;r+=2)wall(e,0x53644a,u-pitch*.36,(r+.27)*floor,.36,.54,.22,.28);
   }
   for(let r=2;r<floors;r++){
    const y=(r+.51)*floor;
    wall(e,j%4?GLASS:DARK_GLASS,u,y,pitch*.66,floor*.62,.05,.17);
    wall(e,p.trim,u,y,.068,floor*.62,.045,.22);
    if(j%3===1&&r%2===0)wall(e,p.trim,u,y-floor*.34,pitch*.81,.13,.31,.22);
   }
  }
 }
 return true;
}
