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
/** Returns true when the authored model owns all facade layers for this shell.
 * Geometry is simple and batched by the existing reference facade renderer. */
export function westernFacadeDetails(p:ReferenceProfile,edges:FacadeEdge[],height:number,add:Add,wall:Wall){
 if(!['western-arrows','western-marinaj','western-kristal'].includes(p.style))return false;
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
